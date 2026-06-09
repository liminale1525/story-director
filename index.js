// 浮生剧编 - SillyTavern third-party UI extension

const MODULE_NAME = 'story_director_liminale';
const EXTENSION_NAME = '浮生剧编';
const SETTINGS_PANEL_ID = 'story-director-settings';
const MODAL_ID = 'story-director-modal';
const FLOAT_ID = 'story-director-float';
const INPUT_ENTRY_ID = 'story-director-input-entry';
const INPUT_BUTTON_ID = 'story-director-input-button';

const DEFAULT_BLUEPRINT = `【故事基底】
时代、地域、社会秩序、生活方式、职业生态、资源流动、超自然/科技/权力结构，以及这些设定如何影响普通人的日常选择。

【核心题材】
例如：慢热恋爱、悬疑调查、群像成长、家族纠葛、黑暗奇幻、末日求生、权谋博弈、都市传闻、共同交际圈引发的支线。

【当前主线】
{{user}} 与主要角色正在面对什么局面？表层事件是什么，背后尚未揭开的矛盾、秘密、利益冲突或情感牵引是什么？

【未来走向】
关系、真相、阵营、个人成长或世界变化可能通向哪些方向？可以写多条可能路径，例如关系升温、误会扩散、旧案揭露、阵营分化、外部势力介入、日常支线转入主线。

【主要角色与关系】
- {{user}}：身份、动机、能力边界、当前处境、正在逃避或追求的事。
- {{char}}：身份、欲望、弱点、与 {{user}} 的张力、可能隐瞒的信息。
- 重要NPC：姓名、立场、交际圈、资源、矛盾点、可能带来的支线。

【世界社交网】
角色之间可以有各自的亲友、同事、敌人、旧识、组织关系和共同交际圈。世界变化可以先发生在 {{user}} 视野之外，再通过传闻、邀约、冲突、委托、误会、新闻、偶遇或他人求助进入剧情。

【变量与新角色】
任务、节点、角色世界可以依据叙事需要自然引入新NPC、临时盟友、竞争者、目击者、线人、旧相识、共同圈层角色或外部势力。新变量依据当前剧情密度、场景节奏和人物关系概率出现，为故事注入活力。

【任务与节点偏好】
希望出现什么类型的任务？例如调查、试探、护送、谈判、潜入、日常约定、情感选择、阵营抉择、公共事件、支线插曲、来自共同交际圈的邀约或误会。

【角色世界偏好】
希望角色们如何自主行动？例如各自推进目标、交换情报、产生误会、寻找盟友、隐藏动机、被外部事件牵动、在 {{user}} 视野之外建立新的关系或冲突。

【时间与节奏偏好】
希望剧情以怎样的时间尺度推进？例如眼前片刻、次日清晨、数轮对话后、下一场景、节日/集会前后、长线伏笔逐步发酵。可以写你偏好的节奏感和时间跨度。

【剧情偏好】
节奏、情感浓度、悬疑密度、日常比例、冲突强度、支线开放度、叙事视角、篇章推进速度。

【避雷与边界】
不希望出现的剧情、关系走向、题材或叙事处理方式。

【导演特别说明】
简短写下本轮重点：氛围、关系推进、线索方向、支线灵感、节奏偏好、需要暂时搁置的内容，或希望浮现的新变量。`;

function isLegacyBlueprint(text) {
  const value = String(text || '').trim();
  return value.includes('现代都市 / 校园 / 西幻 / 末日 / 无限流 / 其他')
    || value.includes('例如：慢热恋爱、悬疑调查、群像成长、轻喜剧、黑暗奇幻')
    || value.includes('【给导演的额外叮嘱】')
    || (value.includes('【故事基底】') && !value.includes('【任务与节点偏好】'))
    || (value.includes('【故事基底】') && !value.includes('【时间与节奏偏好】'))
    || (value.includes('【世界观】') && value.includes('【剧情基调】') && value.includes('【长期目标】'));
}

const DEFAULT_SYSTEM_PROMPT = `你是一位顶尖剧作家导演，长期为沉浸式角色扮演故事设计暗线、节奏、冲突、人物动机与可选择的推进路径。

你的任务是根据当前对话、角色设定、{{user}} 写入的剧本方案与勾选的参考项，整理当前故事的下一阶段规划。请以导演手记、任务看板和世界动态记录的形式呈现，让使用者能看见故事脉络、潜在变量、时间节奏与可推进方向。

核心原则：
1. 以篇章阶段、任务目标、触发节点、NPC自主行动和世界变化为主，让剧情可推进也可变动。
2. 尊重已经发生的剧情事实、角色关系与人设，维护既有事件和人物逻辑，保留 {{user}} 的选择空间。
3. 任务可以选择、延后、转向，并能因 {{user}} 的行动改变结果，保留即兴空间。
4. NPC拥有独立目标、情绪和下一步行动，即使 {{user}} 暂时不干预，世界也会自然流动。
5. 角色世界要体现社交网、组织、旧识、传闻、公共事件与视野之外的变化，使世界呈现多维流动感。
6. 依据叙事发展概率自然引入新NPC、共同交际圈角色、临时线索人物或外部势力，为任务节点和角色世界增加变量。
7. 时间、周期、期限和提示语要从当前场景真实节奏中提炼，使用贴合剧情语境的自然表达，使每次规划都呈现不同的时间颗粒度与未来走向。
8. 输出为一个JSON对象，字段名完整保留，数组字段可以为空数组。
9. 每个可写入输入框的项目都要给出 inject_prompt。inject_prompt 以 {{user}} 的第一人称视角描述行动、观察、心理和下一步安排，让场景自然推进。`;

const JSON_SCHEMA_TEXT = `固定输出格式：
{
  "schema_version": "1.1",
  "story_status": {
    "title": "当前故事标题，8-20字",
    "current_arc": "当前主线篇章",
    "current_stage": "当前阶段与下一步可能走向",
    "cycle": "从剧情语境中自然提炼的时间跨度或节奏名，可写成明早、数轮后、下个场景、节日前、某条线索发酵时、长期伏笔回响等贴合当前故事的表达",
    "progress": 0,
    "tension": 0,
    "romance": 0,
    "mystery": 0,
    "danger": 0,
    "mood": "一句话氛围",
    "summary": "80-160字概述当前剧情局势，并点出未来可能展开的方向"
  },
  "quests": [
    {
      "id": "q1",
      "type": "main/side/hidden/relationship/world",
      "title": "任务标题",
      "objective": "{{user}} 可选择追求的目标",
      "description": "任务说明，写明此刻适合出现的原因与可能带出的变量",
      "priority": "high/medium/low",
      "status": "open/optional/urgent/dormant",
      "deadline": "依据任务紧迫度自然填写时间条件，可是立即、稍后、隔日、数轮后、下个场景、等待触发、长期潜伏等",
      "trigger": "触发或推进条件",
      "reward": "剧情收益、关系变化、线索或新交际圈入口",
      "inject_prompt": "以 {{user}} 的第一人称视角描述行动、观察、心理和下一步安排，让任务自然推进"
    }
  ],
  "story_nodes": [
    {
      "id": "n1",
      "title": "剧情节点标题",
      "trigger": "触发条件：地点、时间、对话、任务完成、外部事件发酵或 {{user}} 暂停行动时",
      "foreshadowing": "伏笔或前置信号",
      "event": "会发生什么",
      "consequences": "可能后果，保留多条分支空间",
      "priority": "high/medium/low",
      "inject_prompt": "以 {{user}} 的第一人称视角描述行动、观察、心理和下一步安排，让节点自然进入场景"
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
      "relationship_to_user": "与 {{user}} 或其交际圈的关系变化",
      "inject_prompt": "以 {{user}} 的第一人称视角描述可感知的社交变化、线索、邀约或互动安排"
    }
  ],
  "world_updates": [
    {
      "type": "news/weather/faction/rumor/environment/calendar/other",
      "title": "世界变化标题",
      "content": "世界变化内容",
      "impact": "对 {{user}}、NPC、交际圈或主线的影响",
      "timing": "从当前世界动态中自然提炼发生时机，可是正在发酵、清晨前后、某场聚会前、下一次公共事件、传闻扩散后、长线压力累积时等",
      "inject_prompt": "以 {{user}} 的第一人称视角描述自己如何得知、观察或回应这项世界变化"
    }
  ],
  "director_comment": "导演评语：分析节奏、冲突、情感线、世界变量和下一步建议，80-160字",
  "next_refresh_hint": "建议何时重新刷新，使用贴合剧情的触发条件，例如完成一次关键对话后、抵达新地点后、线索公开后、支线人物介入后"
}`;

const DEFAULT_SETTINGS = Object.freeze({
  enabled: true,
  providerMode: 'external',
  apiUrl: '',
  apiKey: '',
  model: '',
  availableModels: [],
  apiProfiles: [],
  temperature: 0.75,
  floatingButton: true,
  floatPosition: { x: null, y: null },
  theme: 'light',
  systemPrompt: DEFAULT_SYSTEM_PROMPT,
  outputSchemaText: JSON_SCHEMA_TEXT,
  autoRefresh: false,
  autoRefreshEvery: 10,
  templates: [
    {
      id: 'default-free-blueprint',
      name: '通用自由剧本方案',
      tags: ['通用'],
      content: DEFAULT_BLUEPRINT,
      createdAt: new Date().toISOString(),
    },
  ],
  contextOptions: {
    includeChatHistory: true,
    contextDepth: 5,
    includeCharDesc: true,
    includeUserDesc: false,
    tagRules: [{ name: 'thinking', action: 'remove' }],
  },
  selectedPresetNamesByChat: {},
  selectedPresetItemsByChat: {},
  selectedWorldBookNamesByChat: {},
  selectedWorldBookItemsByChat: {},
  enabledWorldBooksByChat: {},
  lastLog: {
    status: 'none',
    time: '',
    duration: '',
    response: '',
    error: '',
  },
});

let settings = null;
let activeTab = 'dashboard';
let contextScanCache = { presets: {}, worldBooks: {}, presetNames: [], worldBookNames: [], currentPresetName: '', boundWorldBookNames: [], scannedAt: '' };
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
  if (typeof s.outputSchemaText === 'undefined') s.outputSchemaText = JSON_SCHEMA_TEXT;
  if (String(s.outputSchemaText || '').includes('今夜/未来3天/本周/下一阶段') || String(s.outputSchemaText || '').includes('现在/今晚/未来几轮/未来3天/本周')) {
    s.outputSchemaText = JSON_SCHEMA_TEXT;
  }
  if (String(s.systemPrompt || '').includes('故事脉络、潜在变量与可推进方向') && !String(s.systemPrompt || '').includes('时间节奏与可推进方向')) {
    s.systemPrompt = DEFAULT_SYSTEM_PROMPT;
  }
  if (!Array.isArray(s.apiProfiles)) s.apiProfiles = [];
  s.selectedPresetNamesByChat ||= {};
  s.selectedPresetItemsByChat ||= {};
  s.selectedWorldBookNamesByChat ||= {};
  s.selectedWorldBookItemsByChat ||= {};
  if (!Array.isArray(s.templates)) s.templates = [];
  s.templates = s.templates.map((tpl) => ({ ...tpl, tags: sanitizeTemplateTags(tpl.tags) }));
  if (s.contextOptions) {
    if (!Array.isArray(s.contextOptions.tagRules)) {
      const names = String(s.contextOptions.tagNames || '').split(/[,，\s\n]+/).map((x) => x.trim()).filter(Boolean);
      const action = s.contextOptions.tagMode === 'extract' || s.contextOptions.extractTags ? 'extract' : 'remove';
      s.contextOptions.tagRules = (names.length ? names : ['thinking']).map((name) => ({ name: name.replace(/^<|>$/g, ''), action }));
    }
    delete s.contextOptions.tagMode;
    delete s.contextOptions.tagNames;
    delete s.contextOptions.removeTags;
    delete s.contextOptions.extractTags;
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
  if (isLegacyBlueprint(meta[MODULE_NAME].blueprint)) {
    meta[MODULE_NAME].blueprint = DEFAULT_BLUEPRINT;
    meta[MODULE_NAME].blueprintEdited = false;
  }
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

function getPersonaName() {
  const context = ctx();
  const power = globalThis.power_user || context.power_user || {};
  if (power.personas && power.persona_index !== undefined) {
    return power.personas?.[power.persona_index]?.name || context.name1 || '{{user}}';
  }
  return context.name1 || globalThis.name1 || '{{user}}';
}

function estimateTokens(text) {
  const value = String(text || '').trim();
  if (!value) return 0;
  const cjk = (value.match(/[\u4e00-\u9fff]/g) || []).length;
  const latin = value.replace(/[\u4e00-\u9fff]/g, '').trim().split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.ceil(cjk / 1.7 + latin * 1.25));
}

function infoTag(text) {
  return `<span class="sd-info-tag">${htmlEscape(text)}</span>`;
}

function getTagRules() {
  const rules = Array.isArray(settings.contextOptions.tagRules) ? settings.contextOptions.tagRules : [];
  return rules.map((rule) => ({
    name: String(rule.name || '').trim().replace(/^<|>$/g, ''),
    action: rule.action === 'extract' ? 'extract' : 'remove',
  })).filter((rule) => rule.name);
}

function cleanContextText(text) {
  let value = String(text || '');
  value = value.replace(/<!--[\s\S]*?-->/g, '');
  const rules = getTagRules();
  const extractRules = rules.filter((rule) => rule.action === 'extract');
  if (extractRules.length) {
    const extracted = [];
    for (const rule of extractRules) {
      const reg = new RegExp(`<${escapeRegExp(rule.name)}\\b[^>]*>([\\s\\S]*?)<\\/${escapeRegExp(rule.name)}>`, 'gi');
      let match;
      while ((match = reg.exec(value)) !== null) extracted.push(match[1].trim());
    }
    value = extracted.join('\n\n');
  } else {
    for (const rule of rules) {
      const reg = new RegExp(`<${escapeRegExp(rule.name)}\\b[^>]*>[\\s\\S]*?<\\/${escapeRegExp(rule.name)}>`, 'gi');
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

function sanitizeTemplateTags(tags) {
  return uniqueClean(Array.isArray(tags) ? tags : String(tags || '').split(/[，,\s]+/))
    .map((tag) => tag.slice(0, 4))
    .filter(Boolean)
    .slice(0, 8);
}

function normalizeSourceName(name) {
  return String(name || '').trim();
}

function isNoisePresetName(name) {
  const value = normalizeSourceName(name);
  return !value || ['in_use', 'settings', 'prompts', 'prompt_order', 'preset_settings', '当前预设'].includes(value);
}

function getCurrentPresetName() {
  const context = ctx();
  const chatSettings = context.chatCompletionSettings || {};
  const candidates = [
    chatSettings.name,
    chatSettings.preset,
    chatSettings.presetName,
    chatSettings.preset_name,
    globalThis.power_user?.preset_settings,
    globalThis.oai_settings?.preset_settings,
    globalThis.textgenerationwebui_settings?.preset,
    globalThis.novelai_settings?.preset,
    context.preset_settings,
    context.settings?.preset_settings,
  ].flatMap(parseAnyString).filter((name) => !isNoisePresetName(name));
  return uniqueClean(candidates)[0] || '';
}

function getCurrentPresetEntries() {
  const prompts = ctx().chatCompletionSettings?.prompts;
  if (!Array.isArray(prompts)) return [];
  return normalizePresetEntries(prompts);
}

function normalizePresetEntries(entries) {
  return (Array.isArray(entries) ? entries : Object.values(entries || {}))
    .filter((item) => item && typeof item === 'object')
    .filter((item) => String(item.identifier || item.name || '').trim() !== 'in_use')
    .filter((item) => item.content || item.prompt || item.message || item.text || item.name || item.identifier);
}

function parseNameSource(source) {
  if (!source) return [];
  if (typeof source === 'string') return [source];
  if (Array.isArray(source)) return source.flatMap((item) => {
    if (typeof item === 'string') return [item];
    if (item && typeof item === 'object') return [item.name, item.id, item.filename].filter(Boolean);
    return [];
  });
  if (typeof source === 'object') return Object.keys(source);
  return [];
}

function listPresetNames() {
  const context = ctx();
  const names = [getCurrentPresetName()].filter(Boolean);
  const sources = [
    globalThis.preset_names,
    globalThis.presetNames,
    globalThis.oai_settings?.presets,
    globalThis.oai_settings?.preset_names,
    globalThis.textgenerationwebui_presets,
    globalThis.novelai_presets,
    globalThis.power_user?.presets,
    context.preset_names,
    context.presetNames,
    context.presets,
  ];
  for (const source of sources) names.push(...parseNameSource(source));
  try {
    const helperNames = globalThis.TavernHelper?.getPresetNames?.();
    names.push(...parseNameSource(helperNames));
  } catch (_) {}
  return uniqueClean(names).filter((name) => !isNoisePresetName(name));
}

function getPresetEntries(name) {
  const currentName = getCurrentPresetName();
  if (currentName && name === currentName) {
    const currentEntries = getCurrentPresetEntries();
    if (currentEntries.length) return currentEntries;
  }
  try {
    const preset = globalThis.TavernHelper?.getPreset?.(name);
    if (preset?.prompts) return normalizePresetEntries(preset.prompts);
    if (Array.isArray(preset)) return normalizePresetEntries(preset);
  } catch (error) {
    console.warn(`[${MODULE_NAME}] get preset failed`, name, error);
  }
  const pools = [globalThis.presets, globalThis.oai_settings?.presets, globalThis.power_user?.presets, ctx().presets];
  for (const pool of pools) {
    const preset = pool?.[name] || (Array.isArray(pool) ? pool.find((item) => item?.name === name) : null);
    if (preset?.prompts) return normalizePresetEntries(preset.prompts);
    if (Array.isArray(preset)) return normalizePresetEntries(preset);
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
    const headers = typeof ctx().getRequestHeaders === 'function'
      ? ctx().getRequestHeaders()
      : { 'Content-Type': 'application/json', 'X-CSRF-Token': document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') || globalThis.token || '' };
    const res = await fetch('/api/worldinfo/get', {
      method: 'POST',
      headers,
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
    const headers = typeof ctx().getRequestHeaders === 'function'
      ? ctx().getRequestHeaders()
      : { 'X-CSRF-Token': document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') || globalThis.token || '' };
    const res = await fetch('/api/worldinfo/list', { headers });
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
  return uniqueClean(names).filter((x) => !['world_names', 'worldNames', 'settings', 'entries'].includes(x));
}

function detectBoundWorldBookNames() {
  const context = ctx();
  const ch = context.characters?.[context.characterId] || {};
  const candidates = [];
  candidates.push(...parseAnyString(ch.data?.extensions?.world));
  candidates.push(...parseAnyString(ch.data?.extensions?.world_info));
  candidates.push(...parseAnyString(ch.world));
  candidates.push(...parseAnyString(ch.data?.world));
  candidates.push(...parseAnyString(context.world_names));
  candidates.push(...parseAnyString(context.worldNames));
  candidates.push(...parseAnyString(globalThis.selected_world_info));
  return uniqueClean(candidates).filter(Boolean);
}

async function refreshContextSources(showToast = true) {
  const currentPresetName = getCurrentPresetName();
  const presetNames = listPresetNames();
  const boundNames = detectBoundWorldBookNames();
  const allWorldNames = await listWorldBooks();
  const selectedPresetNames = getSelectedPresetNames();
  const selectedWorldNames = getSelectedWorldBookNames();
  const cache = { presets: {}, worldBooks: {}, presetNames, worldBookNames: allWorldNames, currentPresetName, boundWorldBookNames: boundNames, scannedAt: new Date().toISOString() };

  for (const name of presetNames) {
    if (name === currentPresetName || selectedPresetNames.includes(name)) cache.presets[name] = getPresetEntries(name);
  }
  for (const name of selectedWorldNames) {
    if (allWorldNames.includes(name) || boundNames.includes(name)) cache.worldBooks[name] = await getWorldBookEntries(name);
  }

  initializeSelectedContextState(cache);
  contextScanCache = cache;
  saveSettings();
  if (showToast) toast('已刷新。', 'success');
  if (document.getElementById(MODAL_ID)?.classList.contains('open')) renderModal();
}

function getPresetNameStore() {
  const chatKey = getChatKey();
  settings.selectedPresetNamesByChat ||= {};
  if (!settings.selectedPresetNamesByChat[chatKey]) settings.selectedPresetNamesByChat[chatKey] = {};
  return settings.selectedPresetNamesByChat[chatKey];
}

function getPresetSelectionStore() {
  const chatKey = getChatKey();
  settings.selectedPresetItemsByChat ||= {};
  if (!settings.selectedPresetItemsByChat[chatKey]) settings.selectedPresetItemsByChat[chatKey] = {};
  return settings.selectedPresetItemsByChat[chatKey];
}

function getWorldNameStore() {
  const chatKey = getChatKey();
  settings.selectedWorldBookNamesByChat ||= {};
  if (!settings.selectedWorldBookNamesByChat[chatKey]) settings.selectedWorldBookNamesByChat[chatKey] = {};
  return settings.selectedWorldBookNamesByChat[chatKey];
}

function getWorldSelectionStore() {
  const chatKey = getChatKey();
  settings.selectedWorldBookItemsByChat ||= {};
  if (!settings.selectedWorldBookItemsByChat[chatKey]) settings.selectedWorldBookItemsByChat[chatKey] = {};
  return settings.selectedWorldBookItemsByChat[chatKey];
}

function getEnabledWorldBookStore() {
  return getWorldNameStore();
}

function getSelectedPresetNames() {
  const store = getPresetNameStore();
  const currentName = getCurrentPresetName();
  if (currentName && typeof store[currentName] === 'undefined') store[currentName] = true;
  return Object.entries(store).filter(([, selected]) => selected).map(([name]) => name);
}

function setPresetNameSelected(name, selected) {
  const store = getPresetNameStore();
  store[name] = selected;
  if (selected && !contextScanCache.presets?.[name]) contextScanCache.presets[name] = getPresetEntries(name);
  initializeSelectedContextState(contextScanCache);
  saveSettings();
}

function getSelectedWorldBookNames() {
  const store = getWorldNameStore();
  for (const name of detectBoundWorldBookNames()) {
    if (typeof store[name] === 'undefined') store[name] = true;
  }
  return Object.entries(store).filter(([, selected]) => selected).map(([name]) => name);
}

async function setWorldBookNameSelected(name, selected) {
  const store = getWorldNameStore();
  store[name] = selected;
  if (selected && !contextScanCache.worldBooks?.[name]) contextScanCache.worldBooks[name] = await getWorldBookEntries(name);
  initializeSelectedContextState(contextScanCache);
  saveSettings();
}

function isPresetItemSelected(presetName, itemId) {
  return !!getPresetSelectionStore()?.[presetName]?.[String(itemId)];
}

function setPresetItemSelected(presetName, itemId, selected) {
  const store = getPresetSelectionStore();
  if (!store[presetName]) store[presetName] = {};
  store[presetName][String(itemId)] = selected;
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

function getContextItemId(item, index = 0) {
  return item.uid ?? item.id ?? item.identifier ?? item.name ?? item.comment ?? item.key ?? `item_${index}`;
}

function initializeSelectedContextState(cache) {
  const presetStore = getPresetSelectionStore();
  for (const [name, entries] of Object.entries(cache.presets || {})) {
    if (!presetStore[name]) presetStore[name] = {};
    (entries || []).forEach((item, index) => {
      const id = String(getContextItemId(item, index));
      if (typeof presetStore[name][id] === 'undefined') presetStore[name][id] = item.enabled !== false;
    });
  }
  const worldStore = getWorldSelectionStore();
  for (const [name, entries] of Object.entries(cache.worldBooks || {})) {
    if (!worldStore[name]) worldStore[name] = {};
    (entries || []).forEach((item, index) => {
      const id = String(getContextItemId(item, index));
      if (typeof worldStore[name][id] === 'undefined') worldStore[name][id] = item.enabled !== false;
    });
  }
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
    if (desc) output += `\n【用户人设】\n${cleanContextText(desc)}\n`;
  }

  for (const presetName of getSelectedPresetNames()) {
    const entries = contextScanCache.presets?.[presetName] || getPresetEntries(presetName);
    for (const [index, item] of (entries || []).entries()) {
      const itemId = getContextItemId(item, index);
      if (!isPresetItemSelected(presetName, itemId)) continue;
      const title = item.name || item.identifier || item.role || `预设条目 ${index + 1}`;
      let content = await resolveMacro(item.content || item.prompt || item.message || item.text || '');
      content = processRandomMacros(content);
      if (content) output += `\n【预设 - ${presetName}: ${title}】\n${cleanContextText(content)}\n`;
    }
  }

  for (const wbName of getSelectedWorldBookNames()) {
    const entries = contextScanCache.worldBooks?.[wbName] || [];
    for (const [index, item] of (entries || []).entries()) {
      const itemId = getContextItemId(item, index);
      if (!isWorldItemSelected(wbName, itemId)) continue;
      const title = item.name || item.comment || (Array.isArray(item.key) ? item.key.join(', ') : item.key) || `世界书条目 ${index + 1}`;
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
  pieces.push(`【当前对象】\n角色/群聊：${getCharacterName()}\n用户：{{user}}\n`);
  pieces.push(`【编剧】\n${store.blueprint || DEFAULT_BLUEPRINT}\n`);
  if (settings.contextOptions.includeChatHistory) pieces.push(`【近期对话】\n${getChatHistoryText() || '暂无对话记录'}\n`);
  const extra = await buildExtraContextText();
  if (extra) pieces.push(`【参考项】\n${extra}\n`);
  if (store.plan) pieces.push(`【上一次审片状态】\n${JSON.stringify(store.plan, null, 2)}\n`);
  pieces.push(settings.outputSchemaText || JSON_SCHEMA_TEXT);
  pieces.push('请只输出JSON对象。所有百分比数值范围为0-100。任务、剧情节点、NPC动态和世界变化都要贴合当前故事，保留 {{user}} 的选择自由，并依据叙事概率引入新NPC或共同交际圈变量。');
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
  if (!settings.enabled) return toast('浮生剧编已关闭。', 'warning');
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
    if (showSuccessToast) toast('浮生剧编已更新。', 'success');
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

function parseModelList(data) {
  const candidates = [];
  if (Array.isArray(data?.data)) candidates.push(...data.data.map((x) => x?.id || x?.name || x));
  if (Array.isArray(data?.models)) candidates.push(...data.models.map((x) => x?.id || x?.name || x));
  if (Array.isArray(data)) candidates.push(...data.map((x) => x?.id || x?.name || x));
  if (data?.data && typeof data.data === 'object' && !Array.isArray(data.data)) candidates.push(...Object.keys(data.data));
  if (data?.models && typeof data.models === 'object' && !Array.isArray(data.models)) candidates.push(...Object.keys(data.models));
  return uniqueClean(candidates).sort((a, b) => a.localeCompare(b));
}

async function fetchModels() {
  try {
    const base = normalizeUrl(settings.apiUrl);
    if (!base || !settings.apiKey) throw new Error('missing');
    const res = await fetch(`${base}/v1/models`, { headers: { Authorization: `Bearer ${settings.apiKey}` } });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    settings.availableModels = parseModelList(data);
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
  if (!settings.enabled) return toast('浮生剧编已关闭。', 'warning');
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
  document.getElementById(SETTINGS_PANEL_ID)?.remove();
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
    settings.floatPosition.x = pos.x;
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
    ['settings', '幕后'],
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
          <button class="sd-plug-shortcut" title="API与日志">⚙</button>
          <button class="sd-theme-toggle" title="切换外观" aria-label="切换外观"><span></span></button>
          <button class="sd-close" title="关闭">×</button>
        </div>
      </header>
      <nav class="sd-tabs">
        ${tabs.map(([id, label]) => `<button class="sd-tab ${activeTab === id ? 'active' : ''}" data-tab="${id}">${label}</button>`).join('')}
      </nav>
      <main class="sd-body">${renderActiveTab()}</main>
      ${renderInjectDock()}
    </section>`;
  modal.querySelector('.sd-backdrop')?.addEventListener('click', closeModal);
  modal.querySelector('.sd-window')?.addEventListener('click', (event) => event.stopPropagation());
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

function renderInjectDock() {
  if (!['tasksnodes', 'castworld'].includes(activeTab) || !currentPlan()) return '';
  return '<div class="sd-inject-dock"><button class="sd-btn sd-primary sd-inject-selected" type="button" disabled>写入已选 <span>0</span></button></div>';
}

function metricBar(label, value) {
  const n = Math.max(0, Math.min(100, Number(value || 0)));
  return `<div class="sd-metric sd-progress-metric"><div class="sd-metric-top"><span>${label}</span><b>${n}%</b></div><div class="sd-bar"><i style="width:${n}%"></i></div></div>`;
}

function metricCircle(label, value) {
  const n = Math.max(0, Math.min(100, Number(value || 0)));
  return `<div class="sd-circle-metric" style="--sd-value:${n}"><div class="sd-circle"><span>${n}%</span></div><b>${label}</b></div>`;
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
    <section class="sd-card sd-status-card">
      ${metricBar('进度', st.progress)}
      <div class="sd-circle-grid">${metricCircle('张力', st.tension)}${metricCircle('情感', st.romance)}${metricCircle('悬疑', st.mystery)}${metricCircle('危险', st.danger)}</div>
    </section>
    <div class="sd-grid sd-grid-4 sd-dashboard-counts">
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
  if (!p) return renderNoPlan('任务节点尚未生成');
  return `${renderPlanSection('任务', p.quests || [], 'quest')}${renderPlanSection('节点', p.story_nodes || [], 'node')}`;
}

function renderCastWorldTab() {
  const p = currentPlan();
  if (!p) return renderNoPlan('角色世界尚未生成');
  return `${renderPlanSection('角色动向', p.npc_updates || [], 'npc')}${renderPlanSection('世界回声', p.world_updates || [], 'world')}`;
}

function renderPlanSection(title, items, kind) {
  return `<section class="sd-card sd-plan-section"><div class="sd-section-title"><h3>${htmlEscape(title)}</h3><span>${items?.length || 0} 条</span></div>${renderItemList(items || [], kind)}</section>`;
}

function renderNoPlan(text = '尚未生成剧情规划') {
  return `<section class="sd-card sd-plan-card"><div class="sd-empty">${htmlEscape(text)}</div><div class="sd-button-row sd-center"><button class="sd-btn sd-primary sd-generate-main">刷新剧情</button>${busy ? '<button class="sd-btn sd-stop">取消</button>' : ''}</div></section>`;
}

function renderItemList(items, kind) {
  if (!items.length) return '<p class="sd-muted">暂无</p>';
  return items.map((item, idx) => renderItemCard(item, kind, idx)).join('');
}

function renderItemCard(item, kind, idx) {
  const title = item.title || item.name || `项目 ${idx + 1}`;
  const prompt = item.inject_prompt || item.objective || item.event || item.next_action || item.content || '';
  const injectId = `${kind}-${idx}-${getContextItemId(item)}`;
  const chips = renderItemChips(item, kind);
  const fields = [];
  if (kind === 'quest') {
    fields.push(['目标', item.objective], ['说明', item.description], ['触发', item.trigger], ['收获', item.reward]);
  } else if (kind === 'node') {
    fields.push(['触发', item.trigger], ['伏笔', item.foreshadowing], ['事件', item.event], ['后果', item.consequences]);
  } else if (kind === 'npc') {
    fields.push(['目标', item.current_goal], ['行动', item.next_action], ['隐情', item.hidden_agenda], ['关系网', item.relationship_to_user]);
  } else {
    fields.push(['内容', item.content], ['影响', item.impact]);
  }
  return `<details class="sd-item-card sd-item-fold">
    <summary>
      <div class="sd-item-summary-main"><h4>${htmlEscape(title)}</h4>${chips ? `<div class="sd-mini-chip-row">${chips}</div>` : ''}</div>
      ${prompt ? `<label class="sd-inject-select-label" title="加入多选写入"><input type="checkbox" class="sd-select-inject" data-text="${htmlEscape(prompt)}" data-id="${htmlEscape(injectId)}"> 多选</label>` : ''}
    </summary>
    <div class="sd-item-detail">
      <dl>${fields.filter(([, v]) => v !== undefined && v !== '').map(([k, v]) => `<dt>${htmlEscape(k)}</dt><dd>${htmlEscape(v)}</dd>`).join('')}</dl>
      ${prompt ? `<div class="sd-inject-preview"><pre>${htmlEscape(prompt)}</pre></div><div class="sd-button-row"><button class="sd-btn sd-inject" data-text="${htmlEscape(prompt)}">写入输入框</button></div>` : ''}
    </div>
  </details>`;
}

function renderItemChips(item, kind) {
  const chips = [];
  const push = (label, value) => {
    if (value !== undefined && value !== null && String(value).trim() !== '') chips.push(`<span class="sd-badge"><b>${htmlEscape(label)}</b>${htmlEscape(value)}</span>`);
  };
  if (kind === 'quest') {
    push('类型', item.type);
    push('优先级', item.priority);
    push('状态', item.status);
    push('期限', item.deadline);
  } else if (kind === 'node') {
    push('优先级', item.priority);
  } else if (kind === 'npc') {
    push('定位', item.role);
    if (item.progress !== undefined) push('进度', `${item.progress}%`);
    push('情绪', item.emotional_state);
  } else {
    push('类型', item.type);
    push('时机', item.timing);
  }
  return chips.join('');
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
      <div class="sd-button-row sd-blueprint-actions sd-current-blueprint-actions">
        <button type="button" class="sd-btn sd-save-blueprint">保存当前剧本</button>
        <button type="button" class="sd-btn sd-save-template">保存到剧本库</button>
      </div>
    </section>
    <section class="sd-card">
      <div class="sd-section-title"><h3>剧本库</h3><span>${templates.length} 个</span></div>
      <div class="sd-button-row sd-blueprint-actions sd-library-actions">
        <button type="button" class="sd-btn sd-export-templates">批量导出</button>
        <label class="sd-btn sd-file-label">批量导入<input type="file" accept="application/json" class="sd-import-templates"></label>
      </div>
      <div class="sd-template-list">${templates.length ? templates.map(renderTemplateCard).join('') : '<p class="sd-muted">暂无剧本</p>'}</div>
    </section>`;
}

function renderTemplateCard(t) {
  const tags = sanitizeTemplateTags(t.tags);
  const tagHtml = tags.length
    ? `<div class="sd-template-tags">${tags.map((tag) => `<span class="sd-template-tag">${htmlEscape(tag)}<button type="button" class="sd-template-remove-tag" data-id="${htmlEscape(t.id)}" data-tag="${htmlEscape(tag)}" title="删除标签">×</button></span>`).join('')}</div>`
    : '<div class="sd-template-tags"><span class="sd-muted">暂无标签</span></div>';
  return `<article class="sd-template-card"><div class="sd-template-main"><h4>${htmlEscape(t.name || '未命名剧本')}</h4><p class="sd-muted">${htmlEscape(formatDate(t.createdAt))}</p>${tagHtml}</div><div class="sd-button-row sd-template-actions"><button type="button" class="sd-btn sd-load-template" data-id="${htmlEscape(t.id)}">载入</button><button type="button" class="sd-btn sd-add-template-tag" data-id="${htmlEscape(t.id)}">加标签</button><button type="button" class="sd-btn sd-danger sd-delete-template" data-id="${htmlEscape(t.id)}">删除</button></div></article>`;
}

function formatDate(date) {
  if (!date) return '';
  try { return new Date(date).toLocaleDateString(); } catch (_) { return String(date); }
}

function renderContextTab() {
  const opts = settings.contextOptions;
  const charDesc = getCharacterDescription();
  const userDesc = getPersonaDescription();
  return `
    <details class="sd-accordion" open>
      <summary><b>基础引用</b><span>勾选后将会作为浮生剧编参考项</span></summary>
      <div class="sd-inline-setting"><label class="checkbox_label"><input type="checkbox" class="sd-opt" data-key="includeChatHistory" ${opts.includeChatHistory ? 'checked' : ''}> 上下文参考</label><label class="sd-depth-field"><span>参考楼层数</span><input class="text_pole sd-context-depth" type="number" min="1" max="200" value="${htmlEscape(opts.contextDepth || 5)}"></label></div>
      <label class="checkbox_label"><input type="checkbox" class="sd-opt" data-key="includeCharDesc" ${opts.includeCharDesc ? 'checked' : ''}> 引用当前角色设定 ${infoTag(getCharacterName())}${infoTag(`${estimateTokens(charDesc)} token`)}</label>
      <label class="checkbox_label"><input type="checkbox" class="sd-opt" data-key="includeUserDesc" ${opts.includeUserDesc ? 'checked' : ''}> 引用用户人设 ${infoTag(getPersonaName())}${infoTag(`${estimateTokens(userDesc)} token`)}</label>
    </details>
    <details class="sd-accordion" open>
      <summary><b>上下文处理</b><span>标签规则</span></summary>
      <div class="sd-tag-rule-list">${renderTagRules()}</div>
      <div class="sd-button-row"><button type="button" class="sd-btn sd-add-tag-rule">添加标签</button></div>
    </details>
    <details class="sd-accordion" open>
      <summary><b>预设</b><span>${contextScanCache.scannedAt ? '已刷新' : '待刷新'}</span></summary>
      <div class="sd-button-row"><button type="button" class="sd-btn sd-refresh-context">刷新</button></div>
      ${renderPresetSourcePanel()}
    </details>
    <details class="sd-accordion" open>
      <summary><b>世界书</b><span>${contextScanCache.scannedAt ? '已刷新' : '待刷新'}</span></summary>
      <div class="sd-button-row"><button type="button" class="sd-btn sd-refresh-context">拉取</button></div>
      ${renderWorldBookSourcePanel()}
    </details>`;
}

function renderTagRules() {
  const rawRules = Array.isArray(settings.contextOptions.tagRules) ? settings.contextOptions.tagRules : [];
  const list = rawRules.length ? rawRules : [{ name: '', action: 'remove' }];
  return list.map((rule, index) => `<div class="sd-tag-rule-row"><input class="text_pole sd-tag-rule-name" data-index="${index}" placeholder="标签名，如 thinking" value="${htmlEscape(rule.name || '')}"><select class="text_pole sd-tag-rule-action" data-index="${index}"><option value="remove" ${rule.action !== 'extract' ? 'selected' : ''}>屏蔽</option><option value="extract" ${rule.action === 'extract' ? 'selected' : ''}>提取</option></select><button type="button" class="sd-icon-btn sd-delete-tag-rule" data-index="${index}" title="删除">×</button></div>`).join('');
}

function renderPresetSourcePanel() {
  const currentName = contextScanCache.currentPresetName || getCurrentPresetName();
  const names = uniqueClean([currentName, ...(contextScanCache.presetNames || listPresetNames())]).filter((name) => !isNoisePresetName(name));
  if (!names.length) return '<p class="sd-muted">未读取到预设。</p>';
  const selected = getSelectedPresetNames().filter((name) => names.includes(name));
  const choiceRows = names.map((name) => `<label class="checkbox_label sd-source-row"><input type="checkbox" class="sd-toggle-preset" data-name="${htmlEscape(name)}" ${selected.includes(name) ? 'checked' : ''}><span>${htmlEscape(name)}</span>${currentName && name === currentName ? badge('当前使用') : ''}</label>`).join('');
  return `<details class="sd-context-block" open><summary><b>选择预设</b><span>${selected.length}/${names.length}</span></summary><div class="sd-source-list">${choiceRows}</div></details>${renderSelectedPresetEntries(selected)}`;
}

function renderSelectedPresetEntries(selectedNames) {
  const rows = [];
  for (const name of selectedNames) {
    const items = contextScanCache.presets?.[name] || getPresetEntries(name);
    (items || []).forEach((item, index) => rows.push(renderContextEntry('preset', name, item, index, selectedNames.length > 1 ? name : '')));
  }
  return `<details class="sd-context-block" open><summary><b>预设条目</b><span>${rows.length} 条</span></summary>${rows.join('') || '<p class="sd-muted">选择预设后点击刷新。</p>'}</details>`;
}

function renderWorldBookSourcePanel() {
  const boundNames = contextScanCache.boundWorldBookNames || detectBoundWorldBookNames();
  const names = uniqueClean([...boundNames, ...(contextScanCache.worldBookNames || [])]).filter(Boolean);
  if (!names.length) return '<p class="sd-muted">未读取到世界书。</p>';
  const selected = getSelectedWorldBookNames().filter((name) => names.includes(name));
  const choiceRows = names.map((name) => `<label class="checkbox_label sd-source-row"><input type="checkbox" class="sd-toggle-worldbook" data-name="${htmlEscape(name)}" ${selected.includes(name) ? 'checked' : ''}><span>${htmlEscape(name)}</span>${boundNames.includes(name) ? badge('当前绑定') : ''}</label>`).join('');
  return `<details class="sd-context-block" open><summary><b>选择世界书</b><span>${selected.length}/${names.length}</span></summary><div class="sd-source-list">${choiceRows}</div></details>${renderSelectedWorldBookEntries(selected)}`;
}

function renderSelectedWorldBookEntries(selectedNames) {
  const rows = [];
  for (const name of selectedNames) {
    const items = contextScanCache.worldBooks?.[name] || [];
    (items || []).forEach((item, index) => rows.push(renderContextEntry('world', name, item, index, selectedNames.length > 1 ? name : '')));
  }
  return `<details class="sd-context-block" open><summary><b>世界书条目</b><span>${rows.length} 条</span></summary>${rows.join('') || '<p class="sd-muted">选择世界书后点击拉取。</p>'}</details>`;
}

function renderContextEntry(kind, groupName, item, index, sourceLabel = '') {
  const id = getContextItemId(item, index);
  const title = item.name || item.identifier || item.comment || item.role || (Array.isArray(item.key) ? item.key.join(', ') : item.key) || `条目 ${index + 1}`;
  const content = item.content || item.prompt || item.message || item.text || '';
  const checked = kind === 'preset' ? isPresetItemSelected(groupName, id) : isWorldItemSelected(groupName, id);
  return `<details class="sd-context-item"><summary><label class="sd-context-entry-label"><input type="checkbox" class="sd-context-check" data-kind="${kind}" data-group="${htmlEscape(groupName)}" data-id="${htmlEscape(String(id))}" ${checked ? 'checked' : ''}><span>${htmlEscape(title)}</span>${sourceLabel ? infoTag(sourceLabel) : ''}</label></summary><pre>${htmlEscape(cleanContextText(content).slice(0, 2000))}</pre></details>`;
}

function renderDirectorSettingsTab() {
  return `
    <section class="sd-card">
      <h3>刷新</h3>
      <label class="checkbox_label"><input type="checkbox" class="sd-auto-refresh" ${settings.autoRefresh ? 'checked' : ''}> 自动刷新剧情</label>
      <label>每多少楼层刷新</label>
      <input class="text_pole sd-auto-every" type="number" min="2" max="50" value="${htmlEscape(settings.autoRefreshEvery || 10)}">
    </section>
    <section class="sd-card">
      <h3>幕后提示词</h3>
      <textarea class="text_pole sd-textarea sd-system-prompt" spellcheck="false">${htmlEscape(settings.systemPrompt || DEFAULT_SYSTEM_PROMPT)}</textarea>
    </section>
    <section class="sd-card">
      <h3>输出格式</h3>
      <textarea class="text_pole sd-textarea sd-output-schema" spellcheck="false">${htmlEscape(settings.outputSchemaText || JSON_SCHEMA_TEXT)}</textarea>
      <div class="sd-button-row"><button class="sd-btn sd-save-director-settings">保存幕后</button><button class="sd-btn sd-reset-system">恢复默认</button></div>
    </section>`;
}

function renderPlugTab() {
  const isExternal = settings.providerMode === 'external';
  const log = settings.lastLog || DEFAULT_SETTINGS.lastLog;
  const models = uniqueClean([settings.model, ...(settings.availableModels || [])]);
  const profiles = Array.isArray(settings.apiProfiles) ? settings.apiProfiles : [];
  return `
    <section class="sd-card">
      <h3>模型来源</h3>
      <label class="radio_label"><input type="radio" name="sd-provider" value="external" ${isExternal ? 'checked' : ''}> OpenAI（自定义）</label>
      <label class="radio_label"><input type="radio" name="sd-provider" value="sillytavern" ${!isExternal ? 'checked' : ''}> 使用SillyTavern当前API设置</label>
    </section>
    <section class="sd-card ${isExternal ? '' : 'sd-disabled-card'}">
      <h3>API</h3>
      <label>API预设</label>
      <div class="sd-inline-field sd-api-profile-row"><select class="text_pole sd-api-profile-select"><option value="">选择API预设</option>${profiles.map((profile) => `<option value="${htmlEscape(profile.id)}">${htmlEscape(profile.name || profile.model || '未命名API')}</option>`).join('')}</select><button class="sd-btn sd-load-api-profile">载入</button><button class="sd-btn sd-danger sd-delete-api-profile">删除</button></div>
      <label>API URL</label><input class="text_pole sd-api-url" placeholder="https://api.example.com/v1" value="${htmlEscape(settings.apiUrl || '')}">
      <label>API Key</label><input class="text_pole sd-api-key" type="password" placeholder="sk-..." value="${htmlEscape(settings.apiKey || '')}">
      <label>模型</label>
      <div class="sd-inline-field"><select class="text_pole sd-model-select"><option value="">选择模型</option>${models.map((m) => `<option value="${htmlEscape(m)}" ${m === settings.model ? 'selected' : ''}>${htmlEscape(m)}</option>`).join('')}</select><button class="sd-btn sd-fetch-models">拉取模型</button></div>
      <label>Temperature</label><input class="text_pole sd-temperature" type="number" min="0" max="2" step="0.05" value="${htmlEscape(settings.temperature)}">
      <div class="sd-button-row"><button class="sd-btn sd-save-api">保存API</button><button class="sd-btn sd-save-api-profile">保存为预设</button></div>
    </section>
    <section class="sd-card"><h3>日志</h3><p><b>${htmlEscape(log.status || 'none')}</b> · ${htmlEscape(log.time || '-')} · ${htmlEscape(log.duration || '-')}</p>${log.error ? `<p class="sd-error">${htmlEscape(log.error)}</p>` : ''}</section>
    <details class="sd-accordion"><summary><b>Response</b><span>最近一次返回</span></summary><pre>${htmlEscape(log.response || '暂无')}</pre></details>`;
}

function updateInjectDock(root = document) {
  const dockButton = root.querySelector?.('.sd-inject-selected');
  if (!dockButton) return;
  const count = root.querySelectorAll('.sd-select-inject:checked').length;
  const span = dockButton.querySelector('span');
  if (span) span.textContent = String(count);
  dockButton.disabled = count === 0;
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
  root.querySelectorAll('.sd-select-inject').forEach((el) => {
    el.addEventListener('click', (event) => event.stopPropagation());
    el.addEventListener('change', () => updateInjectDock(root));
  });
  root.querySelector('.sd-inject-selected')?.addEventListener('click', () => {
    const texts = Array.from(root.querySelectorAll('.sd-select-inject:checked')).map((el) => el.dataset.text || '').filter(Boolean);
    if (!texts.length) return;
    const ok = injectToInput(texts.join('\n\n'));
    toast(ok ? `已写入 ${texts.length} 项。` : '未找到输入框。', ok ? 'success' : 'error');
    if (ok) closeModal();
  });
  updateInjectDock(root);

  root.querySelector('.sd-save-blueprint')?.addEventListener('click', async () => {
    getChatStore().blueprint = root.querySelector('.sd-blueprint')?.value || DEFAULT_BLUEPRINT;
    getChatStore().blueprintEdited = true;
    await saveMetadata();
    toast('当前剧本已保存。', 'success');
  });
  root.querySelector('.sd-save-template')?.addEventListener('click', async () => {
    const name = await promptInput('保存到剧本库', '剧本名称：', '我的剧本');
    if (!name) return;
    settings.templates.push({ id: uid('tpl'), name, tags: [], content: root.querySelector('.sd-blueprint')?.value || DEFAULT_BLUEPRINT, createdAt: new Date().toISOString() });
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
  root.querySelectorAll('.sd-add-template-tag').forEach((el) => el.addEventListener('click', async () => {
    const t = settings.templates.find((x) => x.id === el.dataset.id);
    if (!t) return;
    const raw = await promptInput('添加剧本标签', '标签，单个不超过4字；多个可用逗号分隔：', '悬疑');
    if (!raw) return;
    t.tags = sanitizeTemplateTags([...(t.tags || []), ...String(raw).split(/[，,\s]+/)]);
    saveSettings();
    renderModal();
  }));
  root.querySelectorAll('.sd-template-remove-tag').forEach((el) => el.addEventListener('click', () => {
    const t = settings.templates.find((x) => x.id === el.dataset.id);
    if (!t) return;
    t.tags = sanitizeTemplateTags(t.tags).filter((tag) => tag !== el.dataset.tag);
    saveSettings();
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
  root.querySelectorAll('.sd-tag-rule-name, .sd-tag-rule-action').forEach((el) => el.addEventListener('change', () => {
    const rows = Array.from(root.querySelectorAll('.sd-tag-rule-row'));
    settings.contextOptions.tagRules = rows.map((row) => ({
      name: row.querySelector('.sd-tag-rule-name')?.value || '',
      action: row.querySelector('.sd-tag-rule-action')?.value || 'remove',
    })).filter((rule) => String(rule.name || '').trim());
    saveSettings();
  }));
  root.querySelector('.sd-add-tag-rule')?.addEventListener('click', (event) => {
    event.preventDefault();
    settings.contextOptions.tagRules ||= [];
    settings.contextOptions.tagRules.push({ name: '', action: 'remove' });
    saveSettings();
    renderModal();
  });
  root.querySelectorAll('.sd-delete-tag-rule').forEach((el) => el.addEventListener('click', (event) => {
    event.preventDefault();
    const index = Number(el.dataset.index);
    settings.contextOptions.tagRules = (settings.contextOptions.tagRules || []).filter((_, i) => i !== index);
    if (!settings.contextOptions.tagRules.length) settings.contextOptions.tagRules = [{ name: 'thinking', action: 'remove' }];
    saveSettings();
    renderModal();
  }));
  root.querySelectorAll('.sd-refresh-context').forEach((el) => el.addEventListener('click', () => refreshContextSources(true)));
  root.querySelectorAll('.sd-toggle-preset').forEach((el) => el.addEventListener('change', async () => {
    setPresetNameSelected(el.dataset.name, el.checked);
    renderModal();
  }));
  root.querySelectorAll('.sd-unselect-preset').forEach((el) => el.addEventListener('click', () => {
    setPresetNameSelected(el.dataset.name, false);
    renderModal();
  }));
  root.querySelectorAll('.sd-toggle-worldbook').forEach((el) => el.addEventListener('change', async () => {
    await setWorldBookNameSelected(el.dataset.name, el.checked);
    renderModal();
  }));
  root.querySelectorAll('.sd-unselect-worldbook').forEach((el) => el.addEventListener('click', async () => {
    await setWorldBookNameSelected(el.dataset.name, false);
    renderModal();
  }));
  root.querySelectorAll('.sd-context-check').forEach((el) => {
    el.addEventListener('click', (event) => event.stopPropagation());
    el.addEventListener('change', () => {
      if (el.dataset.kind === 'preset') setPresetItemSelected(el.dataset.group, el.dataset.id, el.checked);
      else setWorldItemSelected(el.dataset.group, el.dataset.id, el.checked);
    });
  });

  root.querySelector('.sd-save-director-settings')?.addEventListener('click', () => {
    settings.autoRefresh = !!root.querySelector('.sd-auto-refresh')?.checked;
    settings.autoRefreshEvery = Math.max(2, Math.min(50, Number(root.querySelector('.sd-auto-every')?.value || 10)));
    settings.systemPrompt = root.querySelector('.sd-system-prompt')?.value || DEFAULT_SYSTEM_PROMPT;
    settings.outputSchemaText = root.querySelector('.sd-output-schema')?.value || JSON_SCHEMA_TEXT;
    saveSettings();
    toast('设置已保存。', 'success');
  });
  root.querySelector('.sd-reset-system')?.addEventListener('click', () => {
    settings.systemPrompt = DEFAULT_SYSTEM_PROMPT;
    settings.outputSchemaText = JSON_SCHEMA_TEXT;
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
  root.querySelector('.sd-save-api')?.addEventListener('click', () => {
    settings.apiUrl = root.querySelector('.sd-api-url')?.value || '';
    settings.apiKey = root.querySelector('.sd-api-key')?.value || '';
    settings.model = root.querySelector('.sd-model-select')?.value || '';
    settings.temperature = Number(root.querySelector('.sd-temperature')?.value || 0.75);
    saveSettings();
    toast('API已保存。', 'success');
  });
  root.querySelector('.sd-save-api-profile')?.addEventListener('click', async () => {
    const apiUrl = root.querySelector('.sd-api-url')?.value || '';
    const apiKey = root.querySelector('.sd-api-key')?.value || '';
    const model = root.querySelector('.sd-model-select')?.value || '';
    const temperature = Number(root.querySelector('.sd-temperature')?.value || 0.75);
    const name = await promptInput('保存API预设', '预设名称：', model || 'API预设');
    if (!name) return;
    settings.apiProfiles ||= [];
    const existing = settings.apiProfiles.find((x) => x.name === name);
    const profile = { id: existing?.id || uid('api'), name, apiUrl, apiKey, model, temperature };
    settings.apiProfiles = existing ? settings.apiProfiles.map((x) => x.id === existing.id ? profile : x) : [...settings.apiProfiles, profile];
    saveSettings();
    toast('API预设已保存。', 'success');
    renderModal();
  });
  root.querySelector('.sd-load-api-profile')?.addEventListener('click', () => {
    const id = root.querySelector('.sd-api-profile-select')?.value || '';
    const profile = (settings.apiProfiles || []).find((x) => x.id === id);
    if (!profile) return toast('请先选择API预设。', 'warning');
    settings.providerMode = 'external';
    settings.apiUrl = profile.apiUrl || '';
    settings.apiKey = profile.apiKey || '';
    settings.model = profile.model || '';
    settings.temperature = Number(profile.temperature || 0.75);
    if (settings.model && !settings.availableModels.includes(settings.model)) settings.availableModels = uniqueClean([settings.model, ...(settings.availableModels || [])]);
    saveSettings();
    toast('API预设已载入。', 'success');
    renderModal();
  });
  root.querySelector('.sd-delete-api-profile')?.addEventListener('click', async () => {
    const id = root.querySelector('.sd-api-profile-select')?.value || '';
    if (!id) return toast('请先选择API预设。', 'warning');
    const yes = await confirmDialog('删除API预设', '确认删除这个API预设？');
    if (!yes) return;
    settings.apiProfiles = (settings.apiProfiles || []).filter((x) => x.id !== id);
    saveSettings();
    renderModal();
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
      const id = item.id && !(settings.templates || []).some((tpl) => tpl.id === item.id) ? item.id : uid('tpl');
      settings.templates.push({ id, name: item.name || '导入剧本', tags: sanitizeTemplateTags(item.tags), content: item.content, createdAt: item.createdAt || new Date().toISOString() });
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

let resizeHandler = null;
let eventBindings = [];

function unbindEvents() {
  const source = ctx().eventSource;
  if (source?.off) {
    for (const [type, handler] of eventBindings) source.off(type, handler);
  }
  eventBindings = [];
  eventBound = false;
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
  const pairs = [
    [types.MESSAGE_RECEIVED || 'message_received', refreshHandler],
    [types.CHAT_CHANGED || 'chat_changed', rerenderHandler],
    [types.GROUP_UPDATED || 'group_updated', rerenderHandler],
    [types.CHARACTER_SELECTED || 'character_selected', rerenderHandler],
  ];
  for (const [type, handler] of pairs) {
    source.on(type, handler);
    eventBindings.push([type, handler]);
  }
}

function init() {
  if (initialized) return;
  initialized = true;
  settings = getSettings();
  renderSettingsPanel();
  renderFloatButton();
  renderInputMenuEntry();
  startInputMenuObserver();
  resizeHandler = () => { const btn = document.getElementById(FLOAT_ID); if (btn) applyFloatPosition(btn); };
  window.addEventListener('resize', resizeHandler);
  bindEvents();
  console.log(`[${EXTENSION_NAME}] loaded`);
}

export async function onActivate() {
  cleanupRuntime(false);
  init();
}

export async function onEnable() {
  cleanupRuntime(false);
  init();
}

export async function onDisable() {
  cleanupRuntime(false);
}

export async function onUpdate() {
  cleanupRuntime(false);
  init();
}

export async function onDelete() {
  cleanupRuntime(false);
}

function cleanupRuntime(resetSettings = false) {
  document.getElementById(SETTINGS_PANEL_ID)?.remove();
  document.getElementById(MODAL_ID)?.remove();
  document.getElementById(FLOAT_ID)?.remove();
  document.getElementById(INPUT_ENTRY_ID)?.remove();
  document.getElementById(INPUT_BUTTON_ID)?.remove();
  inputMenuObserver?.disconnect?.();
  inputMenuObserver = null;
  if (resizeHandler) window.removeEventListener('resize', resizeHandler);
  resizeHandler = null;
  unbindEvents();
  initialized = false;
  if (resetSettings && ctx().extensionSettings) delete ctx().extensionSettings[MODULE_NAME];
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => setTimeout(init, 0));
} else {
  setTimeout(init, 0);
}
