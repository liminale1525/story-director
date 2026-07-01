// 千幕 · 共读模块纯逻辑层（解析 / 分章 / 切片）
// 类比 qianmu-tts.js：不碰 DOM、不读 settings、不依赖 index.js，纯函数 + 数据。
// 仅负责把「一段文本/一个文件」变成可阅读的章节结构 + 可召回的切片，召回打分另由调用方组合。

/* ============================================================
   一、TXT 编码嗅探
   浏览器 TextDecoder 支持 utf-8 / utf-16le / utf-16be / gbk / gb18030 / big5。
   先看 BOM，无 BOM 则各编码各解一遍，按「乱码评分」取最低分（替换符/空字符/控制符越少越好）。
   ============================================================ */

const TXT_ENCODINGS = ['utf-8', 'gb18030', 'big5', 'utf-16le', 'utf-16be'];

// 乱码评分：U+FFFD 替换符权重最高，其次 NUL，再次非常规控制符。分越低越像正常文本。
function scoreDecodedTextQuality(text) {
  if (!text) return Number.POSITIVE_INFINITY;
  let score = 0;
  const len = text.length;
  for (let i = 0; i < len; i++) {
    const code = text.charCodeAt(i);
    if (code === 0xFFFD) score += 1000;
    else if (code === 0) score += 200;
    else if (code < 9 || (code > 13 && code < 32)) score += 10;   // 排除 \t\n\r 之外的控制符
  }
  // 归一化到密度，避免长文本天然分高；空文本视为极差
  return len ? score / len : Number.POSITIVE_INFINITY;
}

// 从 ArrayBuffer 解码 TXT，自动选最优编码。返回字符串。
export function decodeTxtBuffer(buffer) {
  const bytes = new Uint8Array(buffer);
  // BOM 检测
  if (bytes.length >= 3 && bytes[0] === 0xEF && bytes[1] === 0xBB && bytes[2] === 0xBF) {
    return new TextDecoder('utf-8').decode(bytes.subarray(3));
  }
  if (bytes.length >= 2 && bytes[0] === 0xFF && bytes[1] === 0xFE) {
    return new TextDecoder('utf-16le').decode(bytes.subarray(2));
  }
  if (bytes.length >= 2 && bytes[0] === 0xFE && bytes[1] === 0xFF) {
    return new TextDecoder('utf-16be').decode(bytes.subarray(2));
  }
  // 无 BOM：各编码试解，取乱码评分最低者
  let best = null, bestScore = Number.POSITIVE_INFINITY;
  for (const enc of TXT_ENCODINGS) {
    let decoded;
    try { decoded = new TextDecoder(enc).decode(bytes); }
    catch (_) { continue; }
    const sc = scoreDecodedTextQuality(decoded);
    if (sc < bestScore) { bestScore = sc; best = decoded; }
  }
  return best != null ? best : new TextDecoder('utf-8').decode(bytes);
}

/* ============================================================
   二、排版归一化
   统一中英文引号撇号、全角空格、压缩多余空行；不动正文语义。
   ============================================================ */

export function normalizeTextBlock(text) {
  let s = String(text || '');
  s = s.replace(/\r\n?/g, '\n');            // 统一换行
  s = s.replace(/　/g, '  ');           // 全角空格 → 两个半角（保留缩进感）
  s = s.replace(/ /g, ' ');            // 不间断空格
  s = s.replace(/[\t ]+\n/g, '\n');         // 行尾空白
  s = s.replace(/\n{3,}/g, '\n\n');         // 连续空行压到最多一个空行
  return s.trim();
}

/* ============================================================
   三、分章
   多套常见中文/英文章节正则；命中则按标题切分，未命中再按字数兜底。
   分章只服务「翻页阅读」——分错不影响记忆质量（记忆走句界滑窗切片，见第四节）。
   ============================================================ */

// 章节标题行的识别正则（逐行判定，需整行基本就是标题）。
const CHAPTER_PATTERNS = [
  // 第X章/卷/回/节/部/篇/集/幕（含中文数字与阿拉伯数字）
  /^\s{0,6}第\s*[0-9零一二三四五六七八九十百千万两壹贰叁肆伍陆柒捌玖拾佰仟]+\s*[章卷回节節部篇集幕折][^\n]{0,40}$/,
  // 序章/楔子/序言/前言/引子/后记/尾声/番外/终章 等特殊段
  /^\s{0,6}(序章|序言|序|楔子|引子|前言|后记|後記|尾声|尾聲|终章|終章|番外|后序|跋|附录|附錄|内容简介|作品相关)[^\n]{0,40}$/,
  // Chapter N / CHAPTER N
  /^\s{0,6}(chapter|CHAPTER|Chapter)\s+[0-9IVXLCDM]+[^\n]{0,40}$/,
  // 纯阿拉伯数字编号标题（1. / 01 / 1、）——较弱，放最后
  /^\s{0,6}[0-9]{1,3}\s*[、.．]\s*\S[^\n]{0,40}$/,
];

function looksLikeChapterTitle(line) {
  const t = line.trim();
  if (!t || t.length > 50) return false;
  return CHAPTER_PATTERNS.some((re) => re.test(t));
}

// 主分章入口。返回 [{ title, content }]。
// minChapters：低于此章数视为分章失败，退回字数兜底；fallbackCharCount：兜底每章字数。
export function splitChapters(text, opts = {}) {
  const minChapters = opts.minChapters ?? 2;
  const fallbackCharCount = clampCharCount(opts.fallbackCharCount ?? 2400);
  const normalized = normalizeTextBlock(text);
  if (!normalized) return [{ title: '全文', content: '' }];

  const lines = normalized.split('\n');
  const chapters = [];
  let cur = null;
  let preface = [];   // 第一个标题之前的内容（序/无题开头）

  for (const line of lines) {
    if (looksLikeChapterTitle(line)) {
      if (cur) chapters.push(cur);
      cur = { title: line.trim(), content: '' };
    } else if (cur) {
      cur.content += (cur.content ? '\n' : '') + line;
    } else {
      preface.push(line);
    }
  }
  if (cur) chapters.push(cur);

  // 把开头无题内容并为「前言」章（仅当确有正文时）
  const prefaceText = preface.join('\n').trim();
  if (prefaceText) chapters.unshift({ title: '前言', content: prefaceText });

  // 清理空章节
  const cleaned = chapters
    .map((c) => ({ title: c.title || '无题', content: c.content.trim() }))
    .filter((c) => c.content.length > 0);

  if (cleaned.length >= minChapters) return cleaned;

  // 分章失败 → 字数兜底
  return splitByCharCount(normalized, fallbackCharCount);
}

function clampCharCount(n) {
  const v = Number(n) || 2400;
  return Math.max(500, Math.min(50000, v));
}

// 按字数切分，每段尽量收在「安全句界」上。
export function splitByCharCount(text, charCount = 2400) {
  const target = clampCharCount(charCount);
  const s = normalizeTextBlock(text);
  if (!s) return [{ title: '全文', content: '' }];
  const chapters = [];
  let start = 0;
  let idx = 1;
  while (start < s.length) {
    let end = Math.min(start + target, s.length);
    if (end < s.length) end = pickSafeBoundary(s, end);
    const content = s.slice(start, end).trim();
    if (content) chapters.push({ title: `第 ${idx} 节`, content });
    idx++;
    start = end;
  }
  return chapters.length ? chapters : [{ title: '全文', content: s }];
}

/* ============================================================
   四、句界滑窗切片（给记忆/召回用，不依赖章节边界）
   512 字符目标 / 64 重叠 / 不跨章；每片结尾推到最近句界。
   回避小数点、列表序号、缩写造成的假句界。
   ============================================================ */

const CHUNK_SIZE = 512;
const CHUNK_OVERLAP = 64;
const MIN_CHUNK_TEXT_LENGTH = 20;

// 句末标点（中英）
const SENTENCE_ENDINGS = new Set(['。', '！', '？', '…', '.', '!', '?', ';', '；', '\n']);
// 句末标点后允许跟随并一并纳入的闭合符
const TRAILING_CLOSERS = new Set(['」', '』', '）', ')', ']', '】', '"', '”', '’', '》']);

// 判断 s[i] 处是否为安全句界（i 指向句末标点的下一个位置作为切点）
function isSafeSentenceEnd(s, i) {
  const ch = s[i - 1];
  if (!SENTENCE_ENDINGS.has(ch)) return false;
  // 小数点 3.14：句号两侧都是数字 → 不算
  if (ch === '.' && /[0-9]/.test(s[i - 2] || '') && /[0-9]/.test(s[i] || '')) return false;
  return true;
}

// 从 from 起向最近句界对齐：先向前找，找不到再向后找；都没有则返回 from。
function pickSafeBoundary(s, from) {
  const back = 120, fwd = 180;
  for (let i = from; i > from - back && i > 0; i--) {
    if (isSafeSentenceEnd(s, i)) return swallowClosers(s, i);
  }
  for (let i = from; i < from + fwd && i < s.length; i++) {
    if (isSafeSentenceEnd(s, i)) return swallowClosers(s, i);
  }
  return from;
}

// 句末标点后若紧跟闭合引号/括号，连同纳入
function swallowClosers(s, i) {
  let j = i;
  while (j < s.length && TRAILING_CLOSERS.has(s[j])) j++;
  return j;
}

// 对单章正文做切片。返回 [{ text, start, end }]（start/end 为章内偏移）。
export function chunkChapterText(text, opts = {}) {
  const size = opts.size || CHUNK_SIZE;
  const overlap = opts.overlap ?? CHUNK_OVERLAP;
  const step = Math.max(1, size - overlap);
  const s = String(text || '');
  const chunks = [];
  let start = 0;
  while (start < s.length) {
    let end = Math.min(start + size, s.length);
    if (end < s.length) end = pickSafeBoundary(s, end);
    if (end <= start) end = Math.min(start + size, s.length);   // 防呆
    const slice = s.slice(start, end).trim();
    if (slice.length >= MIN_CHUNK_TEXT_LENGTH) chunks.push({ text: slice, start, end });
    if (end >= s.length) break;
    start = Math.max(end - overlap, start + step);
  }
  return chunks;
}

// 跨全书切片（带 chapterIndex）。chapters=[{title,content}]。
export function chunkBook(chapters, opts = {}) {
  const out = [];
  (chapters || []).forEach((ch, ci) => {
    for (const c of chunkChapterText(ch.content || '', opts)) {
      out.push({ chapterIndex: ci, chapterTitle: ch.title || '', text: c.text, start: c.start, end: c.end });
    }
  });
  return out;
}

/* ============================================================
   五、内容签名（FNV-1a）—— 判断书内容是否变更、是否需重建索引
   ============================================================ */

export function contentSignature(text) {
  let h = 0x811c9dc5;
  const s = String(text || '');
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16) + ':' + s.length;
}

/* ============================================================
   六、统计工具
   ============================================================ */

export function countChars(text) {
  return String(text || '').length;
}

export function totalChars(chapters) {
  return (chapters || []).reduce((sum, c) => sum + countChars(c.content), 0);
}
