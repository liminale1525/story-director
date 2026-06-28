// 千幕 · MiniMax TTS 调用层
// 纯函数式：不依赖 index.js，不读写 DOM/settings，输入参数→输出音频。
// 经参考脚本 minimax_single_tts_v1_2 验证：ST 环境浏览器直连 MiniMax 不被 CORS 拦。
// 故默认直连；保留选填 proxyBase 以兼容个别需自建反代的环境。

// 官方端点（以本地权威版 minimax相关说明 为准）
export const MINIMAX_ENDPOINTS = Object.freeze({
  '国内 api.minimaxi.com': 'https://api.minimaxi.com/v1/t2a_v2',
  '国内备用 api-bj.minimaxi.com': 'https://api-bj.minimaxi.com/v1/t2a_v2',
  '国际 api.minimax.io': 'https://api.minimax.io/v1/t2a_v2',
});

// 模型枚举（speech-2.8 系列支持情绪+语气词标签，做默认）
export const MINIMAX_MODELS = Object.freeze([
  'speech-2.8-hd', 'speech-2.8-turbo',
  'speech-2.6-hd', 'speech-2.6-turbo',
  'speech-02-hd', 'speech-02-turbo',
  'speech-01-hd', 'speech-01-turbo',
]);

// 情绪枚举（官方）：calm=中性 fluent=生动 whisper=低语。
// 注意：官方无 "neutral"，中性是 calm；whisper 仅 2.6 系列支持。
// 不传 emotion 时模型按文本自动判断（官方推荐）——故 'auto' 在请求里=省略该字段。
export const MINIMAX_EMOTIONS = Object.freeze([
  'auto', 'happy', 'sad', 'angry', 'fearful', 'disgusted', 'surprised', 'calm', 'fluent', 'whisper',
]);

// 错误码→中文友好提示（取自官方 base_resp.status_code）
const STATUS_MESSAGES = {
  1000: '未知错误，请重试',
  1001: '请求超时，请重试',
  1002: '触发限流，请稍后再试',
  1004: '鉴权失败，请检查 API Key',
  1039: '触发 TPM 限流，请稍后再试',
  1042: '非法字符占比超过 10%，请检查文本',
  2013: '输入参数不正确（检查模型/音色/文本）',
  2049: 'API Key 无效或额度不足',
};

function statusMessage(code, fallbackMsg) {
  if (code === 0) return '';
  return STATUS_MESSAGES[code] || fallbackMsg || `MiniMax 返回错误码 ${code}`;
}

// 解析最终调用地址：proxyBase 非空时，用它替换官方 origin（path 保持 /v1/t2a_v2）
function resolveUrl(endpoint, proxyBase) {
  const base = String(endpoint || MINIMAX_ENDPOINTS['国内 api.minimaxi.com']);
  const proxy = String(proxyBase || '').trim();
  if (!proxy) return base;
  try {
    const u = new URL(base);
    const p = proxy.replace(/\/+$/, '');
    // proxyBase 可给完整地址（含 path）或仅 origin；含 t2a 则原样用，否则拼官方 path
    if (/t2a/i.test(p)) return p;
    return p + u.pathname;
  } catch (_) {
    return base;
  }
}

// hex 字符串 → Blob（音频）。MiniMax 默认返回 hex 编码音频。
export function hexToBlob(hex, mime = 'audio/mpeg') {
  const clean = String(hex || '').trim();
  if (!clean) throw new Error('空音频数据');
  const len = clean.length >> 1;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = parseInt(clean.substr(i * 2, 2), 16);
  }
  return new Blob([bytes], { type: mime });
}

function mimeForFormat(fmt) {
  switch (String(fmt || 'mp3').toLowerCase()) {
    case 'wav': case 'pcmu_wav': return 'audio/wav';
    case 'flac': return 'audio/flac';
    case 'pcm': case 'pcmu_raw': return 'audio/basic';
    case 'opus': return 'audio/ogg';
    default: return 'audio/mpeg';
  }
}

/**
 * 合成一句语音。
 * @param {Object} opts
 * @param {string} opts.apiKey      MiniMax API Key（自动剥离误填的 "Bearer " 前缀）
 * @param {string} opts.text        待合成文本
 * @param {string} [opts.voiceId]   音色 ID
 * @param {string} [opts.model]     模型，默认 speech-2.8-hd
 * @param {number} [opts.speed]     语速 [0.5,2]，默认 1
 * @param {number} [opts.vol]       音量 (0,10]，默认 1
 * @param {number} [opts.pitch]     语调 [-12,12]，默认 0
 * @param {string} [opts.emotion]   情绪，'auto' 或省略=模型自动判断
 * @param {string} [opts.format]    音频格式，默认 mp3
 * @param {string} [opts.endpoint]  官方端点之一
 * @param {string} [opts.proxyBase] 选填反代地址
 * @param {string} [opts.groupId]   选填 GroupId（新接口一般可空）
 * @param {string} [opts.languageBoost] 选填语种增强
 * @returns {Promise<{blob:Blob, mime:string, extra:Object, traceId:string}>}
 */
export async function synthesize(opts = {}) {
  const apiKey = String(opts.apiKey || '').replace(/^Bearer\s+/i, '').trim();
  if (!apiKey) throw new Error('未配置 MiniMax API Key');
  const text = String(opts.text || '').trim();
  if (!text) throw new Error('文本为空');
  if (text.length > 10000) throw new Error('文本超过 10000 字符上限');
  const voiceId = String(opts.voiceId || '').trim();
  if (!voiceId) throw new Error('未指定音色 ID');

  const model = MINIMAX_MODELS.includes(opts.model) ? opts.model : 'speech-2.8-hd';
  const format = String(opts.format || 'mp3').toLowerCase();

  const voice_setting = { voice_id: voiceId };
  if (Number.isFinite(opts.speed)) voice_setting.speed = clamp(opts.speed, 0.5, 2);
  if (Number.isFinite(opts.vol)) voice_setting.vol = clamp(opts.vol, 0.01, 10);
  if (Number.isFinite(opts.pitch)) voice_setting.pitch = Math.round(clamp(opts.pitch, -12, 12));
  // emotion：仅当明确给了非 auto 的合法值才传；否则省略=模型自动判断
  if (opts.emotion && opts.emotion !== 'auto' && MINIMAX_EMOTIONS.includes(opts.emotion)) {
    voice_setting.emotion = opts.emotion;
  }

  const body = {
    model,
    text,
    stream: false,
    voice_setting,
    audio_setting: { sample_rate: 32000, bitrate: 128000, format, channel: 1 },
    output_format: 'hex',
  };
  if (opts.languageBoost && opts.languageBoost !== 'auto') body.language_boost = opts.languageBoost;
  else if (opts.languageBoost === 'auto') body.language_boost = 'auto';

  let url = resolveUrl(opts.endpoint, opts.proxyBase);
  // GroupId 选填：新接口一般不需要；若用户填了，作为 query 兜底附上
  const groupId = String(opts.groupId || '').trim();
  if (groupId) {
    url += (url.includes('?') ? '&' : '?') + 'GroupId=' + encodeURIComponent(groupId);
  }

  let res;
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify(body),
    });
  } catch (e) {
    // 直连被 CORS/网络拦截时落到这里
    throw new Error('网络请求失败（可能是跨域或网络问题）：' + (e && e.message ? e.message : e));
  }

  if (!res.ok) {
    throw new Error(`HTTP ${res.status} ${res.statusText || ''}`.trim());
  }

  let data;
  try { data = await res.json(); }
  catch (_) { throw new Error('返回非 JSON，无法解析'); }

  const code = data && data.base_resp ? Number(data.base_resp.status_code) : -1;
  if (code !== 0) {
    throw new Error(statusMessage(code, data && data.base_resp && data.base_resp.status_msg));
  }
  const hex = data && data.data && data.data.audio;
  if (!hex) throw new Error('返回结果缺少音频数据');

  const mime = mimeForFormat(format);
  const blob = hexToBlob(hex, mime);
  return {
    blob,
    mime,
    extra: (data && data.extra_info) || {},
    traceId: (data && data.trace_id) || '',
  };
}

function clamp(n, lo, hi) {
  n = Number(n);
  if (!Number.isFinite(n)) return lo;
  return Math.min(hi, Math.max(lo, n));
}

// 稳定缓存键：同文本+音色+模型+语速+情绪+格式 命中同一条缓存
export function cacheKeyFor(opts = {}) {
  const parts = [
    String(opts.text || ''),
    String(opts.voiceId || ''),
    String(opts.model || 'speech-2.8-hd'),
    Number.isFinite(opts.speed) ? opts.speed : 1,
    Number.isFinite(opts.pitch) ? opts.pitch : 0,
    Number.isFinite(opts.vol) ? opts.vol : 1,
    opts.emotion && opts.emotion !== 'auto' ? opts.emotion : 'auto',
    String(opts.format || 'mp3'),
  ];
  return 'tts:' + djb2(parts.join(''));
}

function djb2(str) {
  let h = 5381;
  for (let i = 0; i < str.length; i++) h = ((h << 5) + h + str.charCodeAt(i)) >>> 0;
  return h.toString(36);
}
