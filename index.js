// 剧情导演 - SillyTavern third-party UI extension

const MODULE_NAME = 'story_director_liminale';
const EXTENSION_NAME = '剧情导演';
const SETTINGS_PANEL_ID = 'story-director-settings';
const MODAL_ID = 'story-director-modal';
const FLOAT_ID = 'story-director-float';
const INPUT_ENTRY_ID = 'story-director-input-entry';
const INPUT_BUTTON_ID = 'story-director-input-button';

const DEFAULT_BLUEPRINT = `【世界观】
现代都市 / 校园 / 西幻 / 末日 / 无限流 / 其他

【剧情基调】
例如：慢热恋爱、悬疑调查、群像成长、轻喜剧、黑暗奇幻

【长期目标】
玩家和主要角色最终想完成什么？

【主要角色与关系】
- <user>：
- <char>：
- 其他NPC：

【剧情偏好】
例如：多日常互动、少强制跳时间、NPC要有自主行动、支线可以自然出现

【禁用内容】
不希望出现的剧情、关系走向或题材。

【给导演的额外叮嘱】
例如：慢热、多日常、少强制跳时间、NPC保持自主行动。`;

const DEFAULT_SYSTEM_PROMPT = `你是一位顶尖剧作家导演，长期为沉浸式角色扮演故事设计暗线、节奏、冲突、人物动机与可选择的推进路径。

你的任务是根据当前对话、角色设定、玩家写入的剧本方案与勾选的参考项，整理当前故事的下一阶段规划。规划应像导演手记与任务看板，而不是精确到小时的日程表。

核心原则：
1. 以篇章阶段、任务目标、触发节点、NPC自主行动和世界变化为主，让剧情可推进也可变动。
2. 尊重已经发生的剧情事实、角色关系与人设，不推翻既有事件，不替玩家强行决定唯一行动。
3. 任务要可选择、可延后、可因玩家行动改变结果，保留即兴空间。
4. NPC拥有独立目标、情绪和下一步行动，即使玩家暂时不干预，世界也会自然流动。
5. 输出必须是一个JSON对象，不要Markdown，不要代码块，不要解释文本。
6. 所有数组字段都可以为空数组，但字段名必须完整保留。
7. 每个可写入输入框的项目都要给出 inject_prompt。inject_prompt 使用玩家可直接发送给角色的口吻，避免暴露插件或导演系统。`;

const JSON_SCHEMA_TEXT = `固定输出格式：
{
  "schema_version": "1.1",
  "story_status": {
    "title": "当前故事标题，8-20字",
    "current_arc": "当前主线篇章",
    "current_stage": "当前阶段",
    "cycle": "大致周期，如 今夜/未来3天/本周/下一阶段",
    "progress": 0,
    "tension": 0,
    "romance": 0,
    "mystery": 0,
    "danger": 0,
    "mood": "一句话氛围",
    "summary": "80-160字概述当前剧情局势"
  },
  "quests": [
    {
      "id": "q1",
      "type": "main/side/hidden/relationship/world",
      "title": "任务标题",
      "objective": "玩家可选择追求的目标",
      "description": "任务说明，写明为何此刻适合出现",
      "priority": "high/medium/low",
      "status": "open/optional/urgent/dormant",
      "deadline": "无/未来几轮/今夜/3天内/本周",
      "trigger": "触发或推进条件",
      "reward": "剧情收益、关系变化或线索",
      "inject_prompt": "玩家可直接发送到输入框的推进文本"
    }
  ],
  "story_nodes": [
    {
      "id": "n1",
      "title": "剧情节点标题",
      "trigger": "触发条件：地点/时间/对话/任务完成/玩家无行动时",
      "foreshadowing": "伏笔或前置信号",
      "event": "会发生什么",
      "consequences": "可能后果，不要锁死唯一结果",
      "priority": "high/medium/low",
      "inject_prompt": "玩家可直接发送到输入框的推进文本"
    }
  ],
  "npc_updates": [
    {
      "name": "NPC姓名",
      "role": "NPC定位",
      "current_goal": "此NPC当前目标",
      "progress": 0,
      "emotional_state": "情绪状态",
      "next_action": "NPC接下来会做什么",
      "hidden_agenda": "隐藏动机；若无则写无",
      "relationship_to_user": "与<user>关系变化",
      "inject_prompt": "玩家可直接发送到输入框的互动文本"
    }
  ],
  "world_updates": [
    {
      "type": "news/weather/faction/rumor/environment/calendar/other",
      "title": "世界变化标题",
      "content": "世界变化内容",
      "impact": "对玩家、NPC或主线的影响",
      "timing": "现在/今晚/未来几轮/未来3天/本周",
      "inject_prompt": "玩家可直接发送到输入框的推进文本"
    }
  ],
  "director_comment": "导演评语：分析节奏、冲突、情感线和下一步建议，80-160字",
  "next_refresh_hint": "建议何时重新刷新，如 3轮对话后/完成一个任务后/场景切换后"
}`;

const DEFAULT_SETTINGS = Object.freeze({
  enabled: true,
  providerMode: 'external',
  apiUrl: '',
  apiKey: '',
  model: '',
  availableModels: [],
  temperature: 0.75,
  floatingButton: true,
  floatPosition: { x: null, y: null },
  theme: 'light',
  systemPrompt: DEFAULT_SYSTEM_PROMPT,
  autoRefresh: false,
  autoRefreshEvery: 10,
  templates: [
    {
      id: 'default-free-blueprint',
      name: '通用自由剧本方案',
      content: DEFAULT_BLUEPRINT,
      createdAt: new Date().toISOString(),
    },
  ],
  contextOptions: {
    includeChatHistory: true,
    contextDepth: 5,
    includeCharDesc: true,
    includeUserDesc: false,
    tagMode: 'remove', // remove | extract
    tagNames: '',
  },
  selectedPresetItems: {},
  selectedWorldBookItemsByChat: {},
  enabledWorldBooksByChat: {},
  lastLog: {
    status: 'none',
    time: '',
    duration: '',
    request: '',
    response: '',
    error: '',
  },
});

let settings = null;
let activeTab = 'dashboard';
let contextScanCache = { presets: {}, boundWorldBooks: {}, otherWorldBooks: {}, presetNames: [], boundWorldBookNames: [], otherWorldBookNames: [], scannedAt: '' };
let busy = false;
let abortController = null;
let cancelRequested = false;
let initialized = false;
let eventBound = false;
let inputMenuObserver = null;

function ctx() {
  return globalThis.SillyTavern?.getContext?.() || {};
}

function clone(value) {
  if (typeof structuredClone === 'function') return structuredClone(value);
  return JSON.parse(JSON.stringify(value));
}

function isPlainObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value);
}

function mergeDefaults(target, defaults) {
  for (const [key, value] of Object.entries(defaults)) {
    if (!Object.prototype.hasOwnProperty.call(target, key)) {
      target[key] = clone(value);
    } else if (isPlainObject(value) && isPlainObject(target[key])) {
      mergeDefaults(target[key], value);
    }
  }
}

function getSettings() {
  const context = ctx();
  const extensionSettings = context.extensionSettings || (context.extensionSettings = {});
  if (!extensionSettings[MODULE_NAME]) extensionSettings[MODULE_NAME] = clone(DEFAULT_SETTINGS);
  mergeDefaults(extensionSettings[MODULE_NAME], DEFAULT_SETTINGS);
  migrateSettings(extensionSettings[MODULE_NAME]);
  return extensionSettings[MODULE_NAME];
}

function migrateSettings(s) {
  if (typeof s.maxContextMessages !== 'undefined' && typeof s.contextOptions?.contextDepth === 'undefined') {
    s.contextOptions.contextDepth = Number(s.maxContextMessages) || 5;
  }
  delete s.maxContextMessages;
  if (s.contextOptions) {
    delete s.contextOptions.manualContext;
    delete s.contextOptions.presetNames;
    delete s.contextOptions.worldBookNames;
    delete s.contextOptions.removeHtmlComments;
  }
}

function saveSettings() {
  ctx().saveSettingsDebounced?.();
}

async function saveMetadata() {
  if (typeof ctx().saveMetadata === 'function') await ctx().saveMetadata();
}

function getChatKey() {
  const context = ctx();
  return context.chatId || context.groupId || String(context.characterId ?? 'default');
}

function getChatStore() {
  const context = ctx();
  const meta = context.chatMetadata || (context.chatMetadata = {});
  if (!meta[MODULE_NAME]) {
    meta[MODULE_NAME] = { blueprint: DEFAULT_BLUEPRINT, plan: null, history: [], messageCounter: 0, updatedAt: '' };
  }
  mergeDefaults(meta[MODULE_NAME], { blueprint: DEFAULT_BLUEPRINT, plan: null, history: [], messageCounter: 0, updatedAt: '' });
  return meta[MODULE_NAME];
}

function htmlEscape(input) {
  return String(input ?? '').replace(/[&<>"']/g, (m) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[m]));
}

function normalizeUrl(url) {
  let value = String(url || '').trim().replace(/\/+$/, '');
  if (value.endsWith('/v1')) value = value.slice(0, -3);
  return value;
}

function uid(prefix = 'id') {
  if (globalThis.crypto?.randomUUID) return `${prefix}-${globalThis.crypto.randomUUID().slice(0, 8)}`;
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

function toast(message, type = 'info') {
  const t = globalThis.toastr;
  if (t?.[type]) t[type](message);
  else console.log(`[${EXTENSION_NAME}] ${message}`);
}

function apiToast() {
  toast('请检查API设置', 'error');
}

function getCharacterName() {
  const context = ctx();
  if (context.groupId && Array.isArray(context.groups)) {
    const group = context.groups.find((g) => g.id === context.groupId);
    return group?.name || '当前群聊';
  }
  const ch = context.characters?.[context.characterId];
  return ch?.name || context.name2 || '<char>';
}

function getCharacterDescription() {
  const context = ctx();
  const ch = context.characters?.[context.characterId];
  return ch?.description || ch?.data?.description || '';
}

function getPersonaDescription() {
  const context = ctx();
  const power = globalThis.power_user || context.power_user || {};
  if (power.personas && power.persona_index !== undefined) {
    return power.personas?.[power.persona_index]?.description || '';
  }
  return power.persona_description || globalThis.name2_description || context.user?.description || '';
}

function parseTagNames() {
  const raw = String(settings.contextOptions.tagNames || '').trim();
  const list = raw.split(/[,，\s\n]+/).map((x) => x.trim().replace(/^<|>$/g, '')).filter(Boolean);
  return list.length ? list : ['thinking'];
}

function cleanContextText(text) {
  let value = String(text || '');
  value = value.replace(/<!--[\s\S]*?-->/g, '');
  const tags = parseTagNames();
  if (settings.contextOptions.tagMode === 'extract') {
    const extracted = [];
    for (const tag of tags) {
      const reg = new RegExp(`<${escapeRegExp(tag)}\\b[^>]*>([\\s\\S]*?)<\\/${escapeRegExp(tag)}>`, 'gi');
      let match;
      while ((match = reg.exec(value)) !== null) extracted.push(match[1].trim());
    }
    value = extracted.join('\n\n');
  } else {
    for (const tag of tags) {
      const reg = new RegExp(`<${escapeRegExp(tag)}\\b[^>]*>[\\s\\S]*?<\\/${escapeRegExp(tag)}>`, 'gi');
      value = value.replace(reg, '');
    }
    value = value.replace(/<script[\s\S]*?<\/script>/gi, '').replace(/<style[\s\S]*?<\/style>/gi, '');
    value = value.replace(/<[^>]+>/g, '');
  }
  return value.replace(/\n{3,}/g, '\n\n').trim();
}

function escapeRegExp(text) {
  return String(text).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function getChatHistoryText() {
  const context = ctx();
  const chat = Array.isArray(context.chat) ? context.chat : [];
  const max = Math.max(1, Math.min(200, Number(settings.contextOptions.contextDepth || 5)));
  const recent = chat.slice(-max);
  return recent.map((m) => {
    const role = m.is_user ? '<user>' : (m.name || '<char>');
    const text = cleanContextText(m.mes || '');
    return text ? `${role}: ${text}` : '';
  }).filter(Boolean).join('\n');
}

function processRandomMacros(text) {
  return String(text || '').replace(/\{\{random:(.*?)\}\}/gi, (_, raw) => {
    const options = raw.split(',').map((x) => x.trim()).filter(Boolean);
    return options.length ? options[Math.floor(Math.random() * options.length)] : '';
  });
}

async function resolveMacro(text) {
  try {
    if (typeof globalThis.substituteParams === 'function') {
      let result = globalThis.substituteParams(text);
      if (result instanceof Promise) result = await result;
      return String(result || '').replace(/\{\{(setvar|addvar|incvar|decvar|multiplyvar|dividevar):[^}]*\}\}/gi, '');
    }
  } catch (error) {
    console.warn(`[${MODULE_NAME}] macro resolve failed`, error);
  }
  return text;
}

function parseAnyString(value) {
  if (!value) return [];
  if (typeof value === 'string') return [value];
  if (Array.isArray(value)) return value.flatMap(parseAnyString);
  if (typeof value === 'object') return Object.values(value).flatMap(parseAnyString);
  return [];
}

function uniqueClean(list) {
  return [...new Set((list || []).map((x) => String(x || '').trim()).filter(Boolean))];
}

function detectCurrentPresetNames() {
  const context = ctx();
  const candidates = [];
  try {
    const helperCurrent = globalThis.TavernHelper?.getCurrentPreset?.();
    candidates.push(...parseAnyString(helperCurrent?.name || helperCurrent));
  } catch (_) {}
  const paths = [
    globalThis.power_user?.preset_settings,
    globalThis.power_user?.instruct?.preset,
    globalThis.preset_settings,
    globalThis.oai_settings?.preset_settings,
    globalThis.textgenerationwebui_settings?.preset,
    globalThis.novelai_settings?.preset,
    context.power_user?.preset_settings,
    context.settings?.preset_settings,
    context.preset_settings,
  ];
  for (const p of paths) candidates.push(...parseAnyString(p));
  return uniqueClean(candidates);
}

function getPresetEntries(name) {
  try {
    const preset = globalThis.TavernHelper?.getPreset?.(name);
    if (preset && Array.isArray(preset.prompts)) return preset.prompts;
    if (preset && Array.isArray(preset)) return preset;
  } catch (error) {
    console.warn(`[${MODULE_NAME}] get preset failed`, name, error);
  }
  return [];
}

async function getWorldBookEntries(name) {
  try {
    if (typeof globalThis.TavernHelper?.getWorldbook === 'function') {
      const wb = await globalThis.TavernHelper.getWorldbook(name);
      if (wb) return normalizeWorldBookEntries(wb);
    }
  } catch (error) {
    console.warn(`[${MODULE_NAME}] TavernHelper worldbook failed`, name, error);
  }
  try {
    if (typeof globalThis.getWorldbook === 'function') {
      const wb = await globalThis.getWorldbook(name);
      if (wb) return normalizeWorldBookEntries(wb);
    }
  } catch (error) {
    console.warn(`[${MODULE_NAME}] global getWorldbook failed`, name, error);
  }
  try {
    const token = document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') || globalThis.token || '';
    const res = await fetch('/api/worldinfo/get', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': token },
      body: JSON.stringify({ name }),
    });
    if (res.ok) return normalizeWorldBookEntries(await res.json(), name);
  } catch (error) {
    console.warn(`[${MODULE_NAME}] worldinfo endpoint failed`, name, error);
  }
  return [];
}

function normalizeWorldBookEntries(wb, name = '') {
  if (Array.isArray(wb)) return wb;
  if (wb?.entries) return Object.values(wb.entries);
  if (name && wb?.[name]?.entries) return Object.values(wb[name].entries);
  if (wb && typeof wb === 'object') return Object.values(wb).filter((x) => x && typeof x === 'object');
  return [];
}

async function listWorldBooks() {
  const names = [];
  try {
    if (typeof globalThis.TavernHelper?.getWorldbookNames === 'function') {
      names.push(...parseAnyString(await globalThis.TavernHelper.getWorldbookNames()));
    }
  } catch (_) {}
  try {
    const token = document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') || globalThis.token || '';
    const res = await fetch('/api/worldinfo/list', { headers: { 'X-CSRF-Token': token } });
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data)) names.push(...parseAnyString(data));
      if (Array.isArray(data?.world_names)) names.push(...parseAnyString(data.world_names));
      if (Array.isArray(data?.worldNames)) names.push(...parseAnyString(data.worldNames));
      if (data && typeof data === 'object' && !Array.isArray(data)) names.push(...Object.keys(data));
    }
  } catch (_) {}
  names.push(...parseAnyString(globalThis.world_names));
  names.push(...parseAnyString(globalThis.world_info_names));
  return uniqueClean(names).filter((x) => !['world_names', 'worldNames', 'settings'].includes(x));
}

function detectBoundWorldBookNames() {
  const context = ctx();
  const ch = context.characters?.[context.characterId] || {};
  const candidates = [];
  candidates.push(...parseAnyString(context.world_names));
  candidates.push(...parseAnyString(context.worldNames));
  candidates.push(...parseAnyString(globalThis.world_names));
  candidates.push(...parseAnyString(globalThis.selected_world_info));
  candidates.push(...parseAnyString(ch.world));
  candidates.push(...parseAnyString(ch.data?.world));
  candidates.push(...parseAnyString(ch.data?.extensions?.world));
  candidates.push(...parseAnyString(ch.data?.extensions?.world_info));
  candidates.push(...parseAnyString(ch.data?.character_book?.name));
  return uniqueClean(candidates);
}

async function refreshContextSources(showToast = true) {
  const presetNames = detectCurrentPresetNames();
  const boundNames = detectBoundWorldBookNames();
  const allWorldNames = await listWorldBooks();
  const otherNames = allWorldNames.filter((n) => !boundNames.includes(n));
  const cache = { presets: {}, boundWorldBooks: {}, otherWorldBooks: {}, presetNames, boundWorldBookNames: boundNames, otherWorldBookNames: otherNames, scannedAt: new Date().toISOString() };

  for (const name of presetNames) cache.presets[name] = getPresetEntries(name);
  for (const name of boundNames) cache.boundWorldBooks[name] = await getWorldBookEntries(name);

  const worldStore = getWorldSelectionStore();
  for (const name of boundNames) {
    if (!worldStore[name]) worldStore[name] = {};
    for (const item of cache.boundWorldBooks[name] || []) {
      const id = getContextItemId(item);
      if (typeof worldStore[name][String(id)] === 'undefined') worldStore[name][String(id)] = true;
    }
  }

  const enabledStore = getEnabledWorldBookStore();
  for (const name of otherNames) {
    if (enabledStore[name]) cache.otherWorldBooks[name] = await getWorldBookEntries(name);
  }

  contextScanCache = cache;
  saveSettings();
  if (showToast) toast('已刷新取材。', 'success');
  if (document.getElementById(MODAL_ID)?.classList.contains('open')) renderModal();
}

function getWorldSelectionStore() {
  const chatKey = getChatKey();
  settings.selectedWorldBookItemsByChat ||= {};
  if (!settings.selectedWorldBookItemsByChat[chatKey]) settings.selectedWorldBookItemsByChat[chatKey] = {};
  return settings.selectedWorldBookItemsByChat[chatKey];
}

function getEnabledWorldBookStore() {
  const chatKey = getChatKey();
  settings.enabledWorldBooksByChat ||= {};
  if (!settings.enabledWorldBooksByChat[chatKey]) settings.enabledWorldBooksByChat[chatKey] = {};
  return settings.enabledWorldBooksByChat[chatKey];
}

function isPresetItemSelected(presetName, itemId) {
  return !!settings.selectedPresetItems?.[presetName]?.[String(itemId)];
}

function setPresetItemSelected(presetName, itemId, selected) {
  settings.selectedPresetItems ||= {};
  if (!settings.selectedPresetItems[presetName]) settings.selectedPresetItems[presetName] = {};
  settings.selectedPresetItems[presetName][String(itemId)] = selected;
  saveSettings();
}

function isWorldItemSelected(wbName, itemId) {
  return !!getWorldSelectionStore()?.[wbName]?.[String(itemId)];
}

function setWorldItemSelected(wbName, itemId, selected) {
  const store = getWorldSelectionStore();
  if (!store[wbName]) store[wbName] = {};
  store[wbName][String(itemId)] = selected;
  saveSettings();
}

function getContextItemId(item) {
  return item.uid ?? item.id ?? item.identifier ?? item.name ?? item.comment ?? JSON.stringify(item).slice(0, 24);
}

async function buildExtraContextText() {
  if (!contextScanCache.scannedAt) await refreshContextSources(false);
  let output = '';
  if (settings.contextOptions.includeCharDesc) {
    const desc = await resolveMacro(getCharacterDescription());
    if (desc) output += `\n【当前角色设定】\n${cleanContextText(desc)}\n`;
  }
  if (settings.contextOptions.includeUserDesc) {
    const desc = await resolveMacro(getPersonaDescription());
    if (desc) output += `\n【玩家人设】\n${cleanContextText(desc)}\n`;
  }

  for (const [presetName, entries] of Object.entries(contextScanCache.presets || {})) {
    for (const item of entries || []) {
      const itemId = getContextItemId(item);
      if (!isPresetItemSelected(presetName, itemId)) continue;
      const title = item.name || item.identifier || item.role || '未命名预设条目';
      let content = await resolveMacro(item.content || item.message || item.text || '');
      content = processRandomMacros(content);
      if (content) output += `\n【预设 - ${presetName}: ${title}】\n${cleanContextText(content)}\n`;
    }
  }

  const allWorldGroups = { ...(contextScanCache.boundWorldBooks || {}), ...(contextScanCache.otherWorldBooks || {}) };
  for (const [wbName, entries] of Object.entries(allWorldGroups)) {
    for (const item of entries || []) {
      const itemId = getContextItemId(item);
      if (!isWorldItemSelected(wbName, itemId)) continue;
      const title = item.name || item.comment || (Array.isArray(item.key) ? item.key.join(', ') : item.key) || '未命名世界书条目';
      let content = await resolveMacro(item.content || item.text || '');
      content = processRandomMacros(content);
      if (content) output += `\n【世界书 - ${wbName}: ${title}】\n${cleanContextText(content)}\n`;
    }
  }
  return output.trim();
}

async function buildPrompt() {
  const store = getChatStore();
  const pieces = [];
  pieces.push(`【当前对象】\n角色/群聊：${getCharacterName()}\n`);
  pieces.push(`【编剧】\n${store.blueprint || DEFAULT_BLUEPRINT}\n`);
  if (settings.contextOptions.includeChatHistory) pieces.push(`【近期对话】\n${getChatHistoryText() || '暂无对话记录'}\n`);
  const extra = await buildExtraContextText();
  if (extra) pieces.push(`【参考项】\n${extra}\n`);
  if (store.plan) pieces.push(`【上一次审片状态】\n${JSON.stringify(store.plan, null, 2)}\n`);
  pieces.push(JSON_SCHEMA_TEXT);
  pieces.push('请只输出JSON对象。所有百分比数值范围为0-100。任务、剧情节点、NPC动态和世界变化都要贴合当前故事，保留玩家选择自由。');
  return pieces.join('\n\n');
}

function validateApiSettings() {
  if (settings.providerMode === 'external') return !!(normalizeUrl(settings.apiUrl) && settings.apiKey && settings.model);
  return typeof ctx().generateRaw === 'function';
}

async function callExternalApi(messages) {
  const base = normalizeUrl(settings.apiUrl);
  if (!validateApiSettings()) throw new Error('INVALID_API_SETTINGS');
  abortController = new AbortController();
  const body = { model: settings.model, messages, temperature: Number(settings.temperature || 0.75), stream: false };
  const res = await fetch(`${base}/v1/chat/completions`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${settings.apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal: abortController.signal,
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`HTTP ${res.status}${text ? ` · ${text.slice(0, 300)}` : ''}`);
  }
  const data = await res.json();
  return data.choices?.[0]?.message?.content || data.choices?.[0]?.text || '';
}

async function callSillyTavernModel(messages) {
  const context = ctx();
  if (typeof context.generateRaw !== 'function') throw new Error('INVALID_API_SETTINGS');
  return await context.generateRaw({ prompt: messages, systemPrompt: settings.systemPrompt });
}

function extractJson(text) {
  let content = String(text || '').trim();
  content = content.replace(/^```(?:json)?/i, '').replace(/```$/g, '').trim();
  const start = content.indexOf('{');
  const end = content.lastIndexOf('}');
  if (start !== -1 && end !== -1 && end > start) content = content.slice(start, end + 1);
  content = content.replace(/,\s*([}\]])/g, '$1');
  return JSON.parse(content);
}

function normalizePlan(plan) {
  const base = {
    schema_version: '1.1',
    story_status: { title: '当前故事', current_arc: '', current_stage: '', cycle: '', progress: 0, tension: 0, romance: 0, mystery: 0, danger: 0, mood: '', summary: '' },
    quests: [], story_nodes: [], npc_updates: [], world_updates: [], director_comment: '', next_refresh_hint: '',
  };
  if (!isPlainObject(plan)) plan = {};
  mergeDefaults(plan, base);
  plan.quests = Array.isArray(plan.quests) ? plan.quests : [];
  plan.story_nodes = Array.isArray(plan.story_nodes) ? plan.story_nodes : [];
  plan.npc_updates = Array.isArray(plan.npc_updates) ? plan.npc_updates : [];
  plan.world_updates = Array.isArray(plan.world_updates) ? plan.world_updates : [];
  return plan;
}

async function generateDirectorPlan(showSuccessToast = true, silentFailure = false) {
  if (!settings.enabled) return toast('剧情导演已关闭。', 'warning');
  if (busy) return;
  if (!validateApiSettings()) {
    settings.lastLog.status = 'error';
    settings.lastLog.error = '请检查API设置';
    saveSettings();
    if (!silentFailure) apiToast();
    return;
  }
  busy = true;
  cancelRequested = false;
  renderBusyState();
  const startedAt = Date.now();
  let messages = [];
  try {
    const userPrompt = await buildPrompt();
    messages = [{ role: 'system', content: settings.systemPrompt || DEFAULT_SYSTEM_PROMPT }, { role: 'user', content: userPrompt }];
    settings.lastLog = { status: 'loading', time: new Date().toLocaleString(), duration: '', request: JSON.stringify(messages, null, 2), response: '', error: '' };
    saveSettings();

    const raw = settings.providerMode === 'sillytavern' ? await callSillyTavernModel(messages) : await callExternalApi(messages);
    if (cancelRequested) throw new Error('USER_CANCELLED');
    settings.lastLog.response = raw;
    const newPlan = normalizePlan(extractJson(raw));
    const store = getChatStore();
    const now = new Date().toISOString();
    store.history = [{ id: uid('hist'), createdAt: now, plan: clone(newPlan) }, ...(Array.isArray(store.history) ? store.history : [])].slice(0, 5);
    store.plan = newPlan;
    store.updatedAt = now;
    store.messageCounter = 0;
    await saveMetadata();
    settings.lastLog.status = 'success';
    settings.lastLog.duration = `${((Date.now() - startedAt) / 1000).toFixed(1)}s`;
    saveSettings();
    if (showSuccessToast) toast('剧情导演已更新。', 'success');
  } catch (error) {
    const msg = error?.name === 'AbortError' ? 'USER_CANCELLED' : (error?.message || String(error));
    settings.lastLog.status = msg === 'USER_CANCELLED' ? 'cancelled' : 'error';
    settings.lastLog.error = msg === 'INVALID_API_SETTINGS' ? '请检查API设置' : (msg === 'USER_CANCELLED' ? '已取消生成' : msg);
    settings.lastLog.duration = `${((Date.now() - startedAt) / 1000).toFixed(1)}s`;
    saveSettings();
    if (!silentFailure) {
      if (msg === 'USER_CANCELLED') toast('已取消生成。', 'warning');
      else if (msg === 'INVALID_API_SETTINGS' || settings.providerMode === 'external') apiToast();
      else toast(`生成失败：${settings.lastLog.error}`, 'error');
    }
  } finally {
    abortController = null;
    cancelRequested = false;
    busy = false;
    renderModal();
    renderSettingsPanel();
    renderFloatButton();
  }
}

async function fetchModels() {
  try {
    const base = normalizeUrl(settings.apiUrl);
    if (!base || !settings.apiKey) throw new Error('missing');
    const res = await fetch(`${base}/v1/models`, { headers: { Authorization: `Bearer ${settings.apiKey}` } });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    settings.availableModels = (data.data || []).map((x) => x.id).filter(Boolean);
    if (!settings.model && settings.availableModels.length) settings.model = settings.availableModels[0];
    saveSettings();
    toast(`已拉取 ${settings.availableModels.length} 个模型。`, 'success');
    renderModal();
  } catch (_) {
    apiToast();
  }
}

function stopGeneration() {
  cancelRequested = true;
  if (abortController) abortController.abort();
  settings.lastLog.status = 'cancelled';
  settings.lastLog.error = '已取消生成';
  saveSettings();
  busy = false;
  renderBusyState();
  renderSettingsPanel();
  if (document.getElementById(MODAL_ID)?.classList.contains('open')) renderModal();
  toast('已取消生成。', 'warning');
}

function injectToInput(text) {
  const value = String(text || '').trim();
  if (!value) return false;
  try {
    const context = ctx();
    if (typeof context.setInputText === 'function') {
      context.setInputText(value);
      return true;
    }
  } catch (_) {}
  try {
    if (typeof globalThis.triggerSlash === 'function') {
      globalThis.triggerSlash('/setinput ' + value);
      return true;
    }
  } catch (_) {}
  const selectors = ['#send_textarea', 'textarea#send_textarea', 'textarea[name="user_input"]', '#chat-input textarea', 'textarea'];
  const input = selectors.flatMap((s) => Array.from(document.querySelectorAll(s))).find((el) => !el.disabled && !el.readOnly);
  if (!input) return false;
  input.focus();
  const proto = input.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
  const descriptor = Object.getOwnPropertyDescriptor(proto, 'value');
  if (descriptor?.set) descriptor.set.call(input, value); else input.value = value;
  input.dispatchEvent(new Event('input', { bubbles: true }));
  input.dispatchEvent(new Event('change', { bubbles: true }));
  return true;
}

function openModal(tab = activeTab) {
  if (!settings.enabled) return toast('剧情导演已关闭。', 'warning');
  activeTab = tab;
  let modal = document.getElementById(MODAL_ID);
  if (!modal) {
    modal = document.createElement('div');
    modal.id = MODAL_ID;
    document.body.appendChild(modal);
  }
  renderModal();
  modal.classList.add('open');
}

function closeModal() {
  document.getElementById(MODAL_ID)?.classList.remove('open');
}

function renderSettingsPanel() {
  let panel = document.getElementById(SETTINGS_PANEL_ID);
  if (!panel) {
    panel = document.createElement('div');
    panel.id = SETTINGS_PANEL_ID;
    const host = document.getElementById('extensions_settings2') || document.getElementById('extensions_settings') || document.body;
    host.appendChild(panel);
  }
  const store = getChatStore();
  const current = store.plan ? htmlEscape(store.plan.story_status?.current_arc || store.plan.story_status?.title || '已有规划') : '尚未生成';
  panel.innerHTML = `
    <div class="inline-drawer sd-inline-drawer">
      <div class="inline-drawer-toggle inline-drawer-header">
        <b>剧情导演</b>
        <div class="inline-drawer-icon fa-solid fa-circle-chevron-down down"></div>
      </div>
      <div class="inline-drawer-content">
        <div class="sd-settings-copy">故事自成脉络&nbsp;&nbsp;命运早有伏笔</div>
        <label class="checkbox_label sd-checkline"><input type="checkbox" class="sd-toggle-enabled" ${settings.enabled ? 'checked' : ''}> 启用剧情导演</label>
        <div class="sd-button-row">
          <button class="sd-btn sd-open-dashboard" ${settings.enabled ? '' : 'disabled'}>打开剧情导演</button>
          <button class="sd-btn sd-generate-now" ${settings.enabled && !busy ? '' : 'disabled'}>${busy ? '生成中…' : '刷新剧情'}</button>${busy ? '<button class="sd-btn sd-stop">取消</button>' : ''}
        </div>
        <label class="checkbox_label sd-checkline"><input type="checkbox" class="sd-toggle-float" ${settings.floatingButton ? 'checked' : ''} ${settings.enabled ? '' : 'disabled'}> 显示悬浮按钮</label>
        <div class="sd-mini-status">当前：${current}${store.updatedAt ? ` · ${new Date(store.updatedAt).toLocaleString()}` : ''}</div>
      </div>
    </div>`;
  panel.querySelector('.sd-open-dashboard')?.addEventListener('click', () => openModal('dashboard'));
  panel.querySelector('.sd-generate-now')?.addEventListener('click', () => generateDirectorPlan());
  panel.querySelector('.sd-stop')?.addEventListener('click', stopGeneration);
  panel.querySelector('.sd-toggle-enabled')?.addEventListener('change', (e) => {
    settings.enabled = e.target.checked;
    saveSettings();
    renderSettingsPanel();
    renderFloatButton();
    renderInputMenuEntry();
  });
  panel.querySelector('.sd-toggle-float')?.addEventListener('change', (e) => {
    settings.floatingButton = e.target.checked;
    saveSettings();
    renderFloatButton();
  });
}

function clampFloatPosition() {
  settings.floatPosition ||= { x: null, y: null };
  const size = window.matchMedia?.('(max-width: 760px)')?.matches ? 44 : 48;
  const margin = 10;
  const maxX = Math.max(margin, window.innerWidth - size - margin);
  const maxY = Math.max(margin, window.innerHeight - size - margin);
  if (typeof settings.floatPosition.x !== 'number') settings.floatPosition.x = maxX;
  if (typeof settings.floatPosition.y !== 'number') settings.floatPosition.y = Math.max(margin, window.innerHeight - size - 84);
  settings.floatPosition.x = Math.min(maxX, Math.max(margin, Number(settings.floatPosition.x)));
  settings.floatPosition.y = Math.min(maxY, Math.max(margin, Number(settings.floatPosition.y)));
  return { x: settings.floatPosition.x, y: settings.floatPosition.y, size, margin, maxX, maxY };
}

function applyFloatPosition(btn) {
  const pos = clampFloatPosition();
  btn.style.left = `${pos.x}px`;
  btn.style.top = `${pos.y}px`;
  btn.style.right = 'auto';
  btn.style.bottom = 'auto';
}

function bindFloatDrag(btn) {
  if (btn.dataset.dragBound) return;
  btn.dataset.dragBound = '1';
  let startX = 0;
  let startY = 0;
  let originX = 0;
  let originY = 0;
  let moved = false;

  btn.addEventListener('pointerdown', (event) => {
    if (event.button !== undefined && event.button !== 0) return;
    const pos = clampFloatPosition();
    startX = event.clientX;
    startY = event.clientY;
    originX = pos.x;
    originY = pos.y;
    moved = false;
    btn.setPointerCapture?.(event.pointerId);
  });

  btn.addEventListener('pointermove', (event) => {
    if (!btn.hasPointerCapture?.(event.pointerId)) return;
    const dx = event.clientX - startX;
    const dy = event.clientY - startY;
    if (Math.abs(dx) + Math.abs(dy) > 4) moved = true;
    settings.floatPosition ||= { x: null, y: null };
    settings.floatPosition.x = originX + dx;
    settings.floatPosition.y = originY + dy;
    applyFloatPosition(btn);
  });

  const finish = (event) => {
    if (!btn.hasPointerCapture?.(event.pointerId)) return;
    btn.releasePointerCapture?.(event.pointerId);
    const pos = clampFloatPosition();
    settings.floatPosition.x = pos.x + pos.size / 2 < window.innerWidth / 2 ? pos.margin : pos.maxX;
    settings.floatPosition.y = pos.y;
    applyFloatPosition(btn);
    saveSettings();
    if (moved) {
      btn.dataset.justDragged = '1';
      setTimeout(() => { delete btn.dataset.justDragged; }, 120);
    }
  };
  btn.addEventListener('pointerup', finish);
  btn.addEventListener('pointercancel', finish);

  btn.addEventListener('click', (event) => {
    if (btn.dataset.justDragged === '1') {
      event.preventDefault();
      event.stopPropagation();
      return;
    }
    openModal('dashboard');
  });
}

function renderFloatButton() {
  let btn = document.getElementById(FLOAT_ID);
  if (!settings.enabled || !settings.floatingButton) {
    btn?.remove();
    return;
  }
  if (!btn) {
    btn = document.createElement('button');
    btn.id = FLOAT_ID;
    btn.type = 'button';
    btn.title = '浮生剧编';
    btn.textContent = '剧';
    document.body.appendChild(btn);
    bindFloatDrag(btn);
  }
  btn.textContent = '剧';
  btn.title = '浮生剧编';
  bindFloatDrag(btn);
  applyFloatPosition(btn);
}

function renderBusyState() {
  document.querySelectorAll('.sd-generate-now, .sd-generate-main').forEach((el) => {
    el.disabled = busy || !settings.enabled;
    el.textContent = busy ? '生成中…' : '刷新剧情';
  });
}

function renderModal() {
  const modal = document.getElementById(MODAL_ID);
  if (!modal) return;
  const tabs = [
    ['dashboard', '审片'],
    ['blueprint', '编剧'],
    ['tasksnodes', '任务节点'],
    ['castworld', '角色世界'],
    ['context', '扩展'],
    ['settings', '设置'],
    ['plug', '🔌'],
  ];
  const wasOpen = modal.classList.contains('open');
  modal.className = `sd-theme-${settings.theme === 'dark' ? 'dark' : 'light'}${wasOpen ? ' open' : ''}`;
  modal.innerHTML = `
    <div class="sd-backdrop"></div>
    <section class="sd-window" role="dialog" aria-label="浮生剧编">
      <header class="sd-header">
        <div class="sd-titlebox">
          <h2>浮生剧编</h2>
          <p>故事自成脉络&nbsp;&nbsp;命运早有伏笔</p>
        </div>
        <div class="sd-header-actions">
          <button class="sd-plug-shortcut" title="API与日志">🔌</button>
          <button class="sd-theme-toggle" title="切换外观">🎨</button>
          <button class="sd-close" title="关闭">×</button>
        </div>
      </header>
      <nav class="sd-tabs">
        ${tabs.map(([id, label]) => `<button class="sd-tab ${activeTab === id ? 'active' : ''}" data-tab="${id}">${label}</button>`).join('')}
      </nav>
      <main class="sd-body">${renderActiveTab()}</main>
    </section>`;
  modal.querySelector('.sd-backdrop')?.addEventListener('click', closeModal);
  modal.querySelector('.sd-close')?.addEventListener('click', closeModal);
  modal.querySelector('.sd-plug-shortcut')?.addEventListener('click', () => { activeTab = 'plug'; renderModal(); });
  modal.querySelector('.sd-theme-toggle')?.addEventListener('click', () => {
    settings.theme = settings.theme === 'dark' ? 'light' : 'dark';
    saveSettings();
    renderModal();
  });
  modal.querySelectorAll('.sd-tab').forEach((el) => el.addEventListener('click', () => {
    activeTab = el.dataset.tab;
    renderModal();
  }));
  bindActiveTabEvents(modal);
  renderBusyState();
}

function currentPlan() {
  return getChatStore().plan;
}

function renderActiveTab() {
  switch (activeTab) {
    case 'blueprint': return renderBlueprintTab();
    case 'tasksnodes': return renderTasksNodesTab();
    case 'castworld': return renderCastWorldTab();
    case 'context': return renderContextTab();
    case 'settings': return renderDirectorSettingsTab();
    case 'plug': return renderPlugTab();
    default: return renderDashboardTab();
  }
}

function metric(label, value) {
  const n = Math.max(0, Math.min(100, Number(value || 0)));
  return `<div class="sd-metric"><div class="sd-metric-top"><span>${label}</span><b>${n}%</b></div><div class="sd-bar"><i style="width:${n}%"></i></div></div>`;
}

function renderDashboardTab() {
  const p = currentPlan();
  if (!p) {
    return `<section class="sd-card sd-plan-card"><h3>剧情规划</h3><div class="sd-empty">尚未生成剧情规划</div><div class="sd-button-row sd-center"><button class="sd-btn sd-primary sd-generate-main">刷新剧情</button>${busy ? '<button class="sd-btn sd-stop">取消</button>' : ''}</div></section>`;
  }
  const st = p.story_status || {};
  return `
    <section class="sd-card sd-hero">
      <div class="sd-kicker">${htmlEscape(st.cycle || '下一阶段')}</div>
      <h3>${htmlEscape(st.title || '当前故事')}</h3>
      <p>${htmlEscape(st.summary || '')}</p>
      <div class="sd-two"><b>主线：</b>${htmlEscape(st.current_arc || '-')}</div>
      <div class="sd-two"><b>阶段：</b>${htmlEscape(st.current_stage || '-')}</div>
      <div class="sd-two"><b>氛围：</b>${htmlEscape(st.mood || '-')}</div>
      <div class="sd-button-row"><button class="sd-btn sd-primary sd-generate-main">刷新剧情</button>${busy ? '<button class="sd-btn sd-stop">停止</button>' : ''}</div>
    </section>
    <div class="sd-grid sd-grid-2">${metric('进度', st.progress)}${metric('张力', st.tension)}${metric('情感', st.romance)}${metric('悬疑', st.mystery)}${metric('危险', st.danger)}</div>
    <div class="sd-grid sd-grid-4">
      ${countCard('任务', p.quests?.length || 0, 'tasksnodes')}
      ${countCard('节点', p.story_nodes?.length || 0, 'tasksnodes')}
      ${countCard('角色', p.npc_updates?.length || 0, 'castworld')}
      ${countCard('世界', p.world_updates?.length || 0, 'castworld')}
    </div>
    <section class="sd-card"><h3>导演手记</h3><p>${htmlEscape(p.director_comment || '暂无')}</p><p class="sd-muted">${htmlEscape(p.next_refresh_hint || '')}</p></section>
    ${renderHistorySection()}`;
}

function countCard(label, count, jump) {
  return `<button class="sd-count-card" data-jump="${jump}"><b>${count}</b><span>${label}</span></button>`;
}

function renderHistorySection() {
  const history = Array.isArray(getChatStore().history) ? getChatStore().history : [];
  const rows = history.slice(0, 5).map((record) => {
    const st = record.plan?.story_status || {};
    return `<article class="sd-history-card"><div><h4>${htmlEscape(st.title || st.current_arc || '未命名审片')}</h4><p class="sd-muted">${htmlEscape(formatDateTime(record.createdAt))}</p></div><div class="sd-button-row"><button class="sd-btn sd-load-history" data-id="${htmlEscape(record.id)}">载入</button><button class="sd-btn sd-danger sd-delete-history" data-id="${htmlEscape(record.id)}">删除</button></div></article>`;
  }).join('');
  return `<section class="sd-card"><h3>历史记录</h3><p class="sd-muted">最多保留5条审片记录。</p>${rows || '<p class="sd-muted">暂无历史记录。</p>'}</section>`;
}

function formatDateTime(date) {
  if (!date) return '';
  try { return new Date(date).toLocaleString(); } catch (_) { return String(date); }
}

function renderTasksNodesTab() {
  const p = currentPlan();
  if (!p) return renderNoPlan();
  return `<section class="sd-card"><h3>任务</h3>${renderItemList(p.quests || [], 'quest')}</section><section class="sd-card"><h3>节点</h3>${renderItemList(p.story_nodes || [], 'node')}</section>`;
}

function renderCastWorldTab() {
  const p = currentPlan();
  if (!p) return renderNoPlan();
  return `<section class="sd-card"><h3>角色动向</h3>${renderItemList(p.npc_updates || [], 'npc')}</section><section class="sd-card"><h3>世界回声</h3>${renderItemList(p.world_updates || [], 'world')}</section>`;
}

function renderNoPlan() {
  return `<section class="sd-card sd-plan-card"><div class="sd-empty">尚未生成剧情规划</div><div class="sd-button-row sd-center"><button class="sd-btn sd-primary sd-generate-main">刷新剧情</button>${busy ? '<button class="sd-btn sd-stop">取消</button>' : ''}</div></section>`;
}

function renderItemList(items, kind) {
  if (!items.length) return '<p class="sd-muted">暂无</p>';
  return items.map((item, idx) => renderItemCard(item, kind, idx)).join('');
}

function renderItemCard(item, kind, idx) {
  const title = item.title || item.name || `项目 ${idx + 1}`;
  const prompt = item.inject_prompt || item.objective || item.event || item.next_action || item.content || '';
  const fields = [];
  if (kind === 'quest') {
    fields.push(['目标', item.objective], ['说明', item.description], ['优先级', item.priority], ['状态', item.status], ['期限', item.deadline], ['触发', item.trigger], ['收获', item.reward]);
  } else if (kind === 'node') {
    fields.push(['触发', item.trigger], ['伏笔', item.foreshadowing], ['事件', item.event], ['后果', item.consequences], ['优先级', item.priority]);
  } else if (kind === 'npc') {
    fields.push(['定位', item.role], ['目标', item.current_goal], ['进度', item.progress !== undefined ? `${item.progress}%` : ''], ['情绪', item.emotional_state], ['行动', item.next_action], ['隐情', item.hidden_agenda], ['关系', item.relationship_to_user]);
  } else {
    fields.push(['类型', item.type], ['内容', item.content], ['影响', item.impact], ['时机', item.timing]);
  }
  return `<article class="sd-item-card"><div class="sd-card-title"><h4>${htmlEscape(title)}</h4>${badge(item.type || item.priority || item.status || '')}</div><dl>${fields.filter(([, v]) => v !== undefined && v !== '').map(([k, v]) => `<dt>${htmlEscape(k)}</dt><dd>${htmlEscape(v)}</dd>`).join('')}</dl>${prompt ? `<details class="sd-inject-preview"><summary>写入文本</summary><pre>${htmlEscape(prompt)}</pre></details><button class="sd-btn sd-inject" data-text="${htmlEscape(prompt)}">写入输入框</button>` : ''}</article>`;
}

function badge(text) {
  return text ? `<span class="sd-badge">${htmlEscape(text)}</span>` : '';
}

function renderBlueprintTab() {
  const store = getChatStore();
  const templates = settings.templates || [];
  return `
    <section class="sd-card">
      <h3>当前聊天的剧本</h3>
      <textarea class="text_pole sd-textarea sd-blueprint" spellcheck="false">${htmlEscape(store.blueprint || DEFAULT_BLUEPRINT)}</textarea>
      <div class="sd-button-row">
        <button class="sd-btn sd-save-blueprint">保存当前剧本</button>
        <button class="sd-btn sd-save-template">保存到剧本库</button>
        <button class="sd-btn sd-export-templates">导出剧本</button>
        <label class="sd-btn sd-file-label">导入剧本<input type="file" accept="application/json" class="sd-import-templates"></label>
      </div>
    </section>
    <section class="sd-card"><h3>剧本库</h3><div class="sd-template-list">${templates.length ? templates.map(renderTemplateCard).join('') : '<p class="sd-muted">暂无剧本</p>'}</div></section>`;
}

function renderTemplateCard(t) {
  return `<article class="sd-template-card"><div><h4>${htmlEscape(t.name || '未命名剧本')}</h4><p class="sd-muted">${htmlEscape(formatDate(t.createdAt))}</p></div><div class="sd-button-row"><button class="sd-btn sd-load-template" data-id="${htmlEscape(t.id)}">载入</button><button class="sd-btn sd-danger sd-delete-template" data-id="${htmlEscape(t.id)}">删除</button></div></article>`;
}

function formatDate(date) {
  if (!date) return '';
  try { return new Date(date).toLocaleDateString(); } catch (_) { return String(date); }
}

function renderContextTab() {
  const opts = settings.contextOptions;
  return `
    <section class="sd-card"><h3>扩展设定</h3><p class="sd-muted">勾选后将会作为剧情导演参考项。</p></section>
    <details class="sd-accordion" open>
      <summary><b>基础引用</b><span>对话与设定</span></summary>
      <label class="checkbox_label"><input type="checkbox" class="sd-opt" data-key="includeChatHistory" ${opts.includeChatHistory ? 'checked' : ''}> 引用近期对话</label>
      <label>引用最近几条对话</label><input class="text_pole sd-context-depth" type="number" min="1" max="200" value="${htmlEscape(opts.contextDepth || 5)}">
      <label class="checkbox_label"><input type="checkbox" class="sd-opt" data-key="includeCharDesc" ${opts.includeCharDesc ? 'checked' : ''}> 引用当前角色设定</label>
      <label class="checkbox_label"><input type="checkbox" class="sd-opt" data-key="includeUserDesc" ${opts.includeUserDesc ? 'checked' : ''}> 引用玩家人设</label>
    </details>
    <details class="sd-accordion">
      <summary><b>上下文处理</b><span>标签</span></summary>
      <label class="radio_label"><input type="radio" name="sd-tag-mode" value="remove" ${opts.tagMode !== 'extract' ? 'checked' : ''}> 屏蔽HTML和标签</label>
      <label class="radio_label"><input type="radio" name="sd-tag-mode" value="extract" ${opts.tagMode === 'extract' ? 'checked' : ''}> 提取标签</label>
      <input class="text_pole sd-tag-names" placeholder="多个标签用逗号分隔 如：content,thinking…" value="${htmlEscape(opts.tagNames || '')}">
    </details>
    <details class="sd-accordion" open>
      <summary><b>预设&世界书</b><span>${contextScanCache.scannedAt ? '已刷新' : '待刷新'}</span></summary>
      <div class="sd-button-row"><button class="sd-btn sd-refresh-context">刷新</button></div>
      ${renderScannedContext()}
    </details>`;
}

function renderScannedContext() {
  const presetHtml = Object.entries(contextScanCache.presets || {}).map(([name, items]) => renderContextGroup('preset', name, items, '当前预设')).join('');
  const boundHtml = Object.entries(contextScanCache.boundWorldBooks || {}).map(([name, items]) => renderContextGroup('world', name, items, '绑定世界书')).join('');
  const otherLoadedHtml = Object.entries(contextScanCache.otherWorldBooks || {}).map(([name, items]) => renderContextGroup('world', name, items, '其他世界书')).join('');
  const otherNames = (contextScanCache.otherWorldBookNames || []).filter((n) => !contextScanCache.otherWorldBooks?.[n]);
  const otherNameHtml = otherNames.length ? `<details class="sd-context-group"><summary><b>其他世界书</b><span>${otherNames.length} 本</span></summary>${otherNames.map((name) => `<label class="checkbox_label sd-worldbook-name"><input type="checkbox" class="sd-toggle-wb" data-name="${htmlEscape(name)}" ${getEnabledWorldBookStore()[name] ? 'checked' : ''}> ${htmlEscape(name)}</label>`).join('')}</details>` : '';
  if (!presetHtml && !boundHtml && !otherLoadedHtml && !otherNameHtml) return '<p class="sd-muted">未读取到预设或世界书。</p>';
  return `<div class="sd-scanned">${presetHtml}${boundHtml}${otherLoadedHtml}${otherNameHtml}</div>`;
}

function renderContextGroup(kind, name, items, titlePrefix) {
  const rows = (items || []).map((item) => {
    const id = getContextItemId(item);
    const title = item.name || item.identifier || item.comment || item.role || (Array.isArray(item.key) ? item.key.join(', ') : item.key) || '未命名条目';
    const content = item.content || item.message || item.text || '';
    const checked = kind === 'preset' ? isPresetItemSelected(name, id) : isWorldItemSelected(name, id);
    return `<details class="sd-context-item"><summary><label><input type="checkbox" class="sd-context-check" data-kind="${kind}" data-group="${htmlEscape(name)}" data-id="${htmlEscape(String(id))}" ${checked ? 'checked' : ''}> ${htmlEscape(title)}</label></summary><pre>${htmlEscape(cleanContextText(content).slice(0, 2000))}</pre></details>`;
  }).join('') || '<p class="sd-muted">未读取到条目。</p>';
  return `<details class="sd-context-group" open><summary><b>${htmlEscape(titlePrefix)}：${htmlEscape(name)}</b><span>${items?.length || 0} 条</span></summary>${rows}</details>`;
}

function renderDirectorSettingsTab() {
  return `
    <section class="sd-card">
      <h3>刷新</h3>
      <label class="checkbox_label"><input type="checkbox" class="sd-auto-refresh" ${settings.autoRefresh ? 'checked' : ''}> 自动刷新剧情</label>
      <label>每多少条AI回复后自动刷新</label>
      <input class="text_pole sd-auto-every" type="number" min="2" max="50" value="${htmlEscape(settings.autoRefreshEvery || 10)}">
    </section>
    <section class="sd-card">
      <h3>系统提示词</h3>
      <textarea class="text_pole sd-textarea sd-system-prompt" spellcheck="false">${htmlEscape(settings.systemPrompt || DEFAULT_SYSTEM_PROMPT)}</textarea>
      <div class="sd-button-row"><button class="sd-btn sd-save-director-settings">保存设置</button><button class="sd-btn sd-reset-system">恢复默认</button></div>
    </section>`;
}

function renderPlugTab() {
  const isExternal = settings.providerMode === 'external';
  const log = settings.lastLog || DEFAULT_SETTINGS.lastLog;
  return `
    <section class="sd-card">
      <h3>模型来源</h3>
      <label class="radio_label"><input type="radio" name="sd-provider" value="external" ${isExternal ? 'checked' : ''}> OpenAI（自定义）</label>
      <label class="radio_label"><input type="radio" name="sd-provider" value="sillytavern" ${!isExternal ? 'checked' : ''}> 使用SillyTavern当前🔌设置</label>
    </section>
    <section class="sd-card ${isExternal ? '' : 'sd-disabled-card'}">
      <h3>API</h3>
      <label>API URL</label><input class="text_pole sd-api-url" placeholder="https://api.example.com/v1" value="${htmlEscape(settings.apiUrl || '')}">
      <label>API Key</label><input class="text_pole sd-api-key" type="password" placeholder="sk-..." value="${htmlEscape(settings.apiKey || '')}">
      <label>模型</label>
      <div class="sd-inline-field"><select class="text_pole sd-model-select"><option value="">手动输入或拉取模型</option>${(settings.availableModels || []).map((m) => `<option value="${htmlEscape(m)}" ${m === settings.model ? 'selected' : ''}>${htmlEscape(m)}</option>`).join('')}</select><button class="sd-btn sd-fetch-models">拉取模型</button></div>
      <input class="text_pole sd-model-input" placeholder="模型名称" value="${htmlEscape(settings.model || '')}">
      <label>Temperature</label><input class="text_pole sd-temperature" type="number" min="0" max="2" step="0.05" value="${htmlEscape(settings.temperature)}">
      <div class="sd-button-row"><button class="sd-btn sd-save-api">保存API</button></div>
    </section>
    <section class="sd-card"><h3>日志</h3><p><b>${htmlEscape(log.status || 'none')}</b> · ${htmlEscape(log.time || '-')} · ${htmlEscape(log.duration || '-')}</p>${log.error ? `<p class="sd-error">${htmlEscape(log.error)}</p>` : ''}</section>
    <details class="sd-accordion"><summary><b>Request</b><span>最近一次请求</span></summary><pre>${htmlEscape(log.request || '暂无')}</pre></details>
    <details class="sd-accordion"><summary><b>Response</b><span>最近一次返回</span></summary><pre>${htmlEscape(log.response || '暂无')}</pre></details>`;
}

function bindActiveTabEvents(root) {
  root.querySelectorAll('.sd-generate-main').forEach((el) => el.addEventListener('click', () => generateDirectorPlan()));
  root.querySelectorAll('.sd-stop').forEach((el) => el.addEventListener('click', stopGeneration));
  root.querySelectorAll('.sd-count-card').forEach((el) => el.addEventListener('click', () => { activeTab = el.dataset.jump; renderModal(); }));
  root.querySelectorAll('.sd-load-history').forEach((el) => el.addEventListener('click', async () => {
    const record = (getChatStore().history || []).find((x) => x.id === el.dataset.id);
    if (!record?.plan) return;
    getChatStore().plan = clone(record.plan);
    getChatStore().updatedAt = record.createdAt || new Date().toISOString();
    await saveMetadata();
    toast('已载入历史记录。', 'success');
    renderModal();
    renderSettingsPanel();
  }));
  root.querySelectorAll('.sd-delete-history').forEach((el) => el.addEventListener('click', async () => {
    getChatStore().history = (getChatStore().history || []).filter((x) => x.id !== el.dataset.id);
    await saveMetadata();
    toast('历史记录已删除。', 'success');
    renderModal();
  }));
  root.querySelectorAll('.sd-inject').forEach((el) => el.addEventListener('click', () => {
    const ok = injectToInput(el.dataset.text || '');
    toast(ok ? '已写入输入框。' : '未找到输入框。', ok ? 'success' : 'error');
    if (ok) closeModal();
  }));

  root.querySelector('.sd-save-blueprint')?.addEventListener('click', async () => {
    getChatStore().blueprint = root.querySelector('.sd-blueprint')?.value || DEFAULT_BLUEPRINT;
    await saveMetadata();
    toast('当前剧本已保存。', 'success');
  });
  root.querySelector('.sd-save-template')?.addEventListener('click', async () => {
    const name = await promptInput('保存到剧本库', '剧本名称：', '我的剧本');
    if (!name) return;
    settings.templates.push({ id: uid('tpl'), name, content: root.querySelector('.sd-blueprint')?.value || DEFAULT_BLUEPRINT, createdAt: new Date().toISOString() });
    saveSettings();
    renderModal();
  });
  root.querySelectorAll('.sd-load-template').forEach((el) => el.addEventListener('click', async () => {
    const t = settings.templates.find((x) => x.id === el.dataset.id);
    if (!t) return;
    getChatStore().blueprint = t.content;
    await saveMetadata();
    toast('已载入剧本。', 'success');
    renderModal();
  }));
  root.querySelectorAll('.sd-delete-template').forEach((el) => el.addEventListener('click', async () => {
    const yes = await confirmDialog('删除剧本', '确认删除这个剧本？');
    if (!yes) return;
    settings.templates = (settings.templates || []).filter((x) => x.id !== el.dataset.id);
    ctx().extensionSettings[MODULE_NAME].templates = settings.templates;
    saveSettings();
    toast('已删除。', 'success');
    renderModal();
  }));
  root.querySelector('.sd-export-templates')?.addEventListener('click', exportTemplates);
  root.querySelector('.sd-import-templates')?.addEventListener('change', importTemplates);

  root.querySelectorAll('.sd-opt').forEach((el) => el.addEventListener('change', () => {
    settings.contextOptions[el.dataset.key] = el.checked;
    saveSettings();
  }));
  root.querySelector('.sd-context-depth')?.addEventListener('change', (e) => {
    settings.contextOptions.contextDepth = Math.max(1, Math.min(200, Number(e.target.value || 5)));
    saveSettings();
  });
  root.querySelectorAll('input[name="sd-tag-mode"]').forEach((el) => el.addEventListener('change', () => {
    settings.contextOptions.tagMode = el.value;
    saveSettings();
  }));
  root.querySelector('.sd-tag-names')?.addEventListener('change', (e) => {
    settings.contextOptions.tagNames = e.target.value || '';
    saveSettings();
  });
  root.querySelector('.sd-refresh-context')?.addEventListener('click', () => refreshContextSources(true));
  root.querySelectorAll('.sd-context-check').forEach((el) => el.addEventListener('change', () => {
    if (el.dataset.kind === 'preset') setPresetItemSelected(el.dataset.group, el.dataset.id, el.checked);
    else setWorldItemSelected(el.dataset.group, el.dataset.id, el.checked);
  }));
  root.querySelectorAll('.sd-toggle-wb').forEach((el) => el.addEventListener('change', async () => {
    const store = getEnabledWorldBookStore();
    store[el.dataset.name] = el.checked;
    saveSettings();
    await refreshContextSources(false);
  }));

  root.querySelector('.sd-save-director-settings')?.addEventListener('click', () => {
    settings.autoRefresh = !!root.querySelector('.sd-auto-refresh')?.checked;
    settings.autoRefreshEvery = Math.max(2, Math.min(50, Number(root.querySelector('.sd-auto-every')?.value || 10)));
    settings.systemPrompt = root.querySelector('.sd-system-prompt')?.value || DEFAULT_SYSTEM_PROMPT;
    saveSettings();
    toast('设置已保存。', 'success');
  });
  root.querySelector('.sd-reset-system')?.addEventListener('click', () => {
    settings.systemPrompt = DEFAULT_SYSTEM_PROMPT;
    saveSettings();
    renderModal();
  });

  root.querySelectorAll('input[name="sd-provider"]').forEach((el) => el.addEventListener('change', () => {
    settings.providerMode = el.value;
    saveSettings();
    renderModal();
  }));
  root.querySelector('.sd-fetch-models')?.addEventListener('click', () => {
    settings.apiUrl = root.querySelector('.sd-api-url')?.value || '';
    settings.apiKey = root.querySelector('.sd-api-key')?.value || '';
    saveSettings();
    fetchModels();
  });
  root.querySelector('.sd-model-select')?.addEventListener('change', (e) => {
    if (e.target.value) root.querySelector('.sd-model-input').value = e.target.value;
  });
  root.querySelector('.sd-save-api')?.addEventListener('click', () => {
    settings.apiUrl = root.querySelector('.sd-api-url')?.value || '';
    settings.apiKey = root.querySelector('.sd-api-key')?.value || '';
    settings.model = root.querySelector('.sd-model-input')?.value || '';
    settings.temperature = Number(root.querySelector('.sd-temperature')?.value || 0.75);
    saveSettings();
    toast('API已保存。', 'success');
  });
}

async function promptInput(title, text, value = '') {
  const context = ctx();
  try {
    if (context.Popup?.show?.input) return await context.Popup.show.input(title, text, value);
  } catch (_) {}
  return globalThis.prompt(`${title}\n${text}`, value);
}

async function confirmDialog(title, text) {
  const context = ctx();
  try {
    if (context.Popup?.show?.confirm) {
      const result = await context.Popup.show.confirm(title, text);
      if (result === true) return true;
      const value = String(result).toLowerCase();
      return ['true', 'ok', 'yes', 'confirm', 'confirmed', 'affirmative', '1'].some((x) => value.includes(x));
    }
  } catch (_) {}
  return globalThis.confirm(`${title}\n${text}`);
}

function exportTemplates() {
  const blob = new Blob([JSON.stringify({ version: 2, templates: settings.templates || [] }, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `story-director-blueprints-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

async function importTemplates(event) {
  const file = event.target.files?.[0];
  if (!file) return;
  try {
    const text = await file.text();
    const data = JSON.parse(text);
    const incoming = Array.isArray(data) ? data : data.templates;
    if (!Array.isArray(incoming)) throw new Error('没有找到剧本数组。');
    for (const item of incoming) {
      if (!item?.content) continue;
      settings.templates.push({ id: item.id || uid('tpl'), name: item.name || '导入剧本', content: item.content, createdAt: item.createdAt || new Date().toISOString() });
    }
    saveSettings();
    toast('剧本已导入。', 'success');
    renderModal();
  } catch (error) {
    toast(`导入失败：${error.message}`, 'error');
  } finally {
    event.target.value = '';
  }
}


function renderInputMenuEntry() {
  document.getElementById(INPUT_ENTRY_ID)?.remove();
  document.getElementById(INPUT_BUTTON_ID)?.remove();
  if (!settings.enabled) return;

  const menu = document.querySelector('#extensionsMenu, #extensions_menu, #input_extra_menu, #send_form_menu, .extensionsMenu');
  if (menu) {
    const entry = document.createElement('div');
    entry.id = INPUT_ENTRY_ID;
    entry.className = 'list-group-item flex-container story-director-input-entry';
    entry.innerHTML = '<span class="sd-menu-glyph">剧</span><span>浮生剧编</span>';
    entry.addEventListener('click', () => openModal('dashboard'));
    menu.appendChild(entry);
    return;
  }

  const sendForm = document.querySelector('#send_form, #form_sheld, #chat-input, .send_form');
  const textarea = document.querySelector('#send_textarea, textarea#send_textarea');
  const parent = sendForm || textarea?.parentElement;
  if (!parent || parent.querySelector(`#${INPUT_BUTTON_ID}`)) return;
  const button = document.createElement('button');
  button.id = INPUT_BUTTON_ID;
  button.type = 'button';
  button.title = '浮生剧编';
  button.textContent = '剧';
  button.addEventListener('click', () => openModal('dashboard'));
  if (textarea && textarea.parentElement === parent) parent.insertBefore(button, textarea);
  else parent.insertBefore(button, parent.firstChild);
}

function startInputMenuObserver() {
  if (inputMenuObserver) return;
  inputMenuObserver = new MutationObserver(() => {
    if (document.getElementById(INPUT_ENTRY_ID) || document.getElementById(INPUT_BUTTON_ID)) return;
    renderInputMenuEntry();
  });
  inputMenuObserver.observe(document.body, { childList: true, subtree: true });
}

function bindEvents() {
  if (eventBound) return;
  eventBound = true;
  const context = ctx();
  const source = context.eventSource;
  const types = context.event_types || {};
  if (!source?.on) return;
  const refreshHandler = async () => {
    try {
      if (!settings.enabled) return;
      const store = getChatStore();
      store.messageCounter = Number(store.messageCounter || 0) + 1;
      await saveMetadata();
      if (settings.autoRefresh && settings.autoRefreshEvery > 0 && store.messageCounter >= settings.autoRefreshEvery && !busy) {
        await generateDirectorPlan(false, true);
      }
      renderSettingsPanel();
    } catch (error) {
      console.warn(`[${MODULE_NAME}] auto refresh handler failed`, error);
    }
  };
  const rerenderHandler = () => {
    settings = getSettings();
    renderSettingsPanel();
    renderFloatButton();
    renderInputMenuEntry();
    if (document.getElementById(MODAL_ID)?.classList.contains('open')) renderModal();
  };
  source.on(types.MESSAGE_RECEIVED || 'message_received', refreshHandler);
  source.on(types.CHAT_CHANGED || 'chat_changed', rerenderHandler);
  source.on(types.GROUP_UPDATED || 'group_updated', rerenderHandler);
  source.on(types.CHARACTER_SELECTED || 'character_selected', rerenderHandler);
}

function init() {
  if (initialized) return;
  initialized = true;
  settings = getSettings();
  renderSettingsPanel();
  renderFloatButton();
  renderInputMenuEntry();
  startInputMenuObserver();
  window.addEventListener('resize', () => { const btn = document.getElementById(FLOAT_ID); if (btn) applyFloatPosition(btn); });
  bindEvents();
  console.log(`[${EXTENSION_NAME}] loaded`);
}

export async function onActivate() {
  init();
}

export async function onClean() {
  document.getElementById(SETTINGS_PANEL_ID)?.remove();
  document.getElementById(MODAL_ID)?.remove();
  document.getElementById(FLOAT_ID)?.remove();
  document.getElementById(INPUT_ENTRY_ID)?.remove();
  document.getElementById(INPUT_BUTTON_ID)?.remove();
  inputMenuObserver?.disconnect?.();
  inputMenuObserver = null;
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => setTimeout(init, 0));
} else {
  setTimeout(init, 0);
}
