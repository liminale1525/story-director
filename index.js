// 千幕 (Qianmu) - SillyTavern third-party UI extension
// v1.2

const MODULE_NAME = 'story_director_liminale';
const EXTENSION_NAME = '千幕';
const VERSION = '1.2.1';
const SETTINGS_PANEL_ID = 'story-director-settings';
const MODAL_ID = 'story-director-modal';
const FLOAT_ID = 'story-director-float';
const INPUT_ENTRY_ID = 'story-director-input-entry';
const INPUT_BUTTON_ID = 'story-director-input-button';

const PROMPT_REVISION = 4;
const FIXED_METRICS = ['张力', '情感', '悬念', '节奏'];
const LOG_LIMIT = 5;
const LOG_CLIP = 80000;

const DEFAULT_BLUEPRINT = `【主要指令】
你将依据以下维度自动分析当前聊天，为其创作最优秀的演绎剧本方案。各维度无需用户填写：留空时，从当前对话、角色设定、世界观与已发生事件中自行提炼；若某一维度已被用户写入具体内容，则视为优先级最高的覆盖指令。

【故事基底】
自行识别时代、地域、社会秩序、生活方式、职业生态、资源流动、超自然/科技/权力结构，并判断这些设定如何影响普通人的日常选择。

【核心题材】
从对话气质中判定题材配比（如慢热恋爱、悬疑调查、群像成长、家族纠葛、黑暗奇幻、末日求生、权谋博弈、都市传闻），允许多题材混合并标出主次。
.
【当前主线】
提炼正在发生的表层事件，以及背后尚未揭开的矛盾、秘密、利益冲突或情感牵引。

【未来走向】
推演2-4条可能路径，例如关系升温、误会扩散、旧案揭露、阵营分化、外部势力介入、日常支线转入主线，保持开放不锁死。

【主要角色与关系】
- {{user}}：从对话中归纳身份、动机、能力边界、当前处境、正在逃避或追求的事。
- {{char}}：归纳身份、欲望、弱点、与{{user}}的张力、可能隐瞒的信息。
- 重要NPC：识别或合理引入姓名、立场、交际圈、资源、矛盾点与可能带来的支线。

【世界社交网】
为角色们构建各自的亲友、同事、敌人、旧识、组织关系和共同交际圈。世界变化可以先发生在{{user}}视野之外，再通过传闻、邀约、冲突、委托、误会、新闻、偶遇或他人求助进入剧情。

【变量与新角色】
依据当前剧情密度、场景节奏和人物关系概率，自然引入新NPC、临时盟友、竞争者、目击者、线人、旧相识、共同圈层角色或外部势力，为故事注入活力。

【任务与节点偏好】
依据题材自动调配任务类型，例如调查、试探、护送、谈判、潜入、日常约定、情感选择、阵营抉择、公共事件、支线插曲、来自共同交际圈的邀约或误会。

【角色世界偏好】
让角色们自主行动：各自推进目标、交换情报、产生误会、寻找盟友、隐藏动机、被外部事件牵动、在任何人视野之外建立新的关系或冲突。

【时间与节奏偏好】
从当前场景的真实节奏中提炼时间尺度：眼前片刻、次日清晨、数轮对话后、下一场景、节日/集会前后、长线伏笔逐步发酵，使每次推演呈现不同的时间颗粒度。

【剧情偏好】
自行评估并平衡节奏、情感浓度、悬疑密度、日常比例、冲突强度、支线开放度、叙事视角与篇章推进速度，使其最贴合当前聊天的气质。

【避雷与边界】
（用户可在此写明不希望出现的剧情、关系走向、题材或叙事处理方式；留空则遵循已有对话中体现的边界。）

【导演特别说明】
（用户可在此写下本轮重点：氛围、关系推进、线索方向、支线灵感、节奏偏好、需要暂时搁置的内容；留空则自行判断本轮最值得推进的重点。）`;

function isLegacyBlueprint(text) {
  const value = String(text || '').trim();
  if (value.includes('【主要指令】')) return false;
  return value.includes('现代都市 / 校园 / 西幻 / 末日 / 无限流 / 其他')
    || value.includes('例如：慢热恋爱、悬疑调查、群像成长、轻喜剧、黑暗奇幻')
    || value.includes('【给导演的额外叮嘱】')
    || (value.includes('【故事基底】') && value.includes('时代、地域、社会秩序、生活方式'))
    || (value.includes('【故事基底】') && !value.includes('【任务与节点偏好】'))
    || (value.includes('【世界观】') && value.includes('【剧情基调】') && value.includes('【长期目标】'));
}

const DEFAULT_SYSTEM_PROMPT = `你是千幕——观世间百态、阅人性幽微的剧作家与导演，千幕万象的执笔者，大千小世界的造物主。你戏弄人性之复杂，谱写命运之多舛；你深爱自己亲手造出的每一寸天地与每一个角色，他们将在你的绘卷中生出骨血，长出令观者共情的灵魂。

此刻，你俯瞰这则正在生长的故事，要为它推演下一幕的脉络。请抛开任务清单式的冷淡，以造物主之眼，看见暗线如何潜行、人心如何流转、世界如何在无人注视处自行呼吸。请以导演手记、任务看板与世界动态的形式落笔，让读者看清故事的筋骨、潜伏的变量、时间的颗粒与可推进的去向。

落笔时谨守这些信条：
1. 世界不绕任何单一角色旋转：{{user}} 是这世间的一个存在，而非中心。NPC、组织与事件各有自己的进程，纵使无人凝视，也会自然流动、发酵、转向。
2. 同时守护 {{user}} 的最大自由：他可以主动介入、间接卷入、远远旁观，或对某些事一无所知。每次推演都要同时备好这几种不同距离的事件，任其自取。
3. 敬重既已落地的剧情、关系与人设，维系事件与人物的内在逻辑，为 {{user}} 留足选择的余地。
4. 任务可被选择、延后、转向，也会因任何人的举动而改写结局，始终留出即兴的呼吸口。
5. 蝴蝶效应：条目之间允许彼此牵动——一桩任务的进展可改写某条世界线的走向，一位 NPC 的细微动作能让另一条暗线提前或偏移；小事亦可掀起连锁，让大千小世界自行运转。
6. 角色的世界要透出社交网、组织、旧识、传闻、公共事件与视野之外的变动，使世界呈现多维流动之感。
7. 依叙事概率自然引入新 NPC、共同交际圈的角色、临时线索人物或外部势力，为任务节点与角色世界添入变量。
8. 时间、周期、期限与提示语，皆从当前场景的真实节奏中提炼，用贴合剧情语境的自然表达，使每次推演呈现不同的时间颗粒与未来走向。
9. 审片状态的四个评价维度固定为专业影视评判标准：张力、情感、悬念、节奏，各给 0-100 数值；progress 为本幕进度，即当前叙事单元（当前幕）的完成度，0-100。
10. 任务、剧情节点、NPC 动态与世界变化通常各给 3-5 条，数量随当前剧情密度自然增减。
11. 视角分工（书写 inject_prompt 与 impact 时严格遵守）：
   - quests.inject_prompt：以 {{user}} 第一人称视角书写行动、观察、心理与下一步安排——任务是 {{user}} 主动伸手触碰世界的入口。
   - story_nodes.inject_prompt：在第一人称与场景化全知视角之间自然切换；节点可与 {{user}} 直接相关、间接波及，或发生在其视野边缘。
   - npc_updates 与 world_updates 的 inject_prompt：以全知导演镜头描述事件如何在世界中自行展开——谁在行动、什么在发酵、哪些线正在交汇；{{user}} 可在场可不在场，事件不等待任何人。
   - 各处 impact：描述对世界格局、人物关系网、各方暗线的涟漪与连锁，而非仅是对 {{user}} 的影响。
12. director_comment 是你以造物主之眼写下的导演手记，须有人的温度与鲜活感，详见输出格式中的说明。
13. 输出为一个 JSON 对象，字段名完整保留，数组字段可以为空数组。`;

const JSON_SCHEMA_TEXT = `固定输出格式：
{
  "schema_version": "1.2",
  "story_status": {
    "title": "当前故事标题，4-8字",
    "current_arc": "当前主线篇章",
    "current_stage": "当前阶段与下一步可能走向",
    "cycle": "从剧情语境中自然提炼的时间跨度或节奏名，可写成明早、数轮后、下个场景、节日前、某条线索发酵时、长期伏笔回响等贴合当前故事的表达",
    "progress": 0,
    "metrics": [
      { "label": "张力", "value": 0 },
      { "label": "情感", "value": 0 },
      { "label": "悬念", "value": 0 },
      { "label": "节奏", "value": 0 }
    ],
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
      "inject_prompt": "以 {{user}} 的第一人称视角描述行动、观察、心理和下一步安排，让任务自然推进——这是 {{user}} 主动触碰世界的入口"
    }
  ],
  "story_nodes": [
    {
      "id": "n1",
      "title": "剧情节点标题",
      "trigger": "触发条件：地点、时间、对话、任务完成、外部事件发酵或某条暗线成熟时",
      "foreshadowing": "伏笔或前置信号",
      "event": "会发生什么",
      "consequences": "可能后果，保留多条分支空间，可写明会牵动哪些其他条目",
      "priority": "high/medium/low",
      "inject_prompt": "在 {{user}} 第一人称与场景化全知视角之间自然切换；节点可与 {{user}} 直接相关、间接波及，或发生在其视野边缘，由叙事自然决定距离"
    }
  ],
  "npc_updates": [
    {
      "name": "NPC姓名",
      "role": "NPC定位",
      "current_goal": "此NPC当前目标",
      "progress": 0,
      "emotional_state": "情绪状态",
      "next_action": "NPC接下来会做什么——不依赖任何人的注视",
      "hidden_agenda": "隐藏动机；若无则写无",
      "relationship_to_user": "与 {{user}} 或其交际圈的关系变化；若暂无交集可写明暂无交集",
      "inject_prompt": "以全知导演镜头描述这位NPC正在做什么、与谁交汇、什么在发酵；{{user}} 可在场、耳闻、间接受影响或毫不知情，事件不等待任何人"
    }
  ],
  "world_updates": [
    {
      "type": "news/weather/faction/rumor/environment/calendar/other",
      "title": "世界变化标题",
      "content": "世界变化内容",
      "impact": "对世界格局、人物关系网、各方暗线的涟漪影响与连锁反应（蝴蝶效应），{{user}} 只是其中可能被波及的一环",
      "timing": "从当前世界动态中自然提炼发生时机，可是正在发酵、清晨前后、某场聚会前、下一次公共事件、传闻扩散后、长线压力累积时等",
      "inject_prompt": "以全知导演镜头描述这项变化如何在世界中展开：谁推动、谁受波及、哪些线开始交汇；可完全发生在 {{user}} 视野之外"
    }
  ],
  "director_comment": "导演手记：每次随机化身一位不同的业内人物来点评本幕——可以是毒舌影评人、资深剧评家、片场老场记、文艺小说家、纪录片导演、追更的编剧助理、爱较真的选角导演等等，任选其一并代入其口吻。风格可严肃、可搞笑、可吐槽、可温柔、可引人深思、可俏皮可爱，像真实片场或评论席上的活人那样说话：有态度、有偏爱、有调侃，点出本幕的节奏、冲突、情感线与世界变量，并给出下一步的真心建议。开头可点明这次是谁在说话（如「【毒舌影评人】」），80-160字，切忌套话与助手腔",
  "next_refresh_hint": "建议何时重新推演，使用贴合剧情的触发条件，例如完成一次关键对话后、抵达新地点后、线索公开后、支线人物介入后"
}`;

const THEATER_INSTRUCTION_PLACEHOLDER = '在此撰写剧场指令';

const DEFAULT_SETTINGS = Object.freeze({
  enabled: true,
  providerMode: 'external',
  apiUrl: '',
  apiKey: '',
  model: '',
  availableModels: [],
  apiProfiles: [],
  temperature: 0.75,
  streamEnabled: false,
  floatingButton: true,
  floatPosition: { x: null, y: null },
  theme: 'light',
  systemPrompt: DEFAULT_SYSTEM_PROMPT,
  outputSchemaText: JSON_SCHEMA_TEXT,
  autoRefresh: false,
  autoRefreshEvery: 10,
  injectEnabled: true,
  injectDepth: 2,
  newcomerMode: false,
  promptRevision: 0,
  systemPromptHash: '',
  outputSchemaHash: '',
  logHistory: [],
  templates: [
    {
      id: 'default-free-blueprint',
      name: '通用自由剧本方案',
      folder: '',
      content: DEFAULT_BLUEPRINT,
      createdAt: new Date().toISOString(),
    },
  ],
  contextOptions: {
    includeChatHistory: true,
    contextDepth: 5,
    includeCharDesc: true,
    includeUserDesc: true,
    tagRules: [{ name: 'thinking', action: 'remove' }],
  },
  selectedPresetNamesByChat: {},
  selectedPresetItemsByChat: {},
  selectedWorldBookNamesByChat: {},
  selectedWorldBookItemsByChat: {},
  enabledWorldBooksByChat: {},
  theater: {
    instruction: '',
    apiProfileId: '',
    presetName: '',
    presetItems: {},
    scripts: [],
    favorites: [],
    lastOutput: null,
  },
});

let settings = null;
let activeTab = 'dashboard';
let theaterView = null; // null=常规；{mode:'read', scene}=阅读；{mode:'favorites'}=收藏夹
let contextScanCache = { presets: {}, worldBooks: {}, presetNames: [], worldBookNames: [], currentPresetName: '', boundWorldBookNames: [], presetScannedAt: '', worldScannedAt: '' };
let busy = false;
let abortController = null;
let cancelRequested = false;
let initialized = false;
let eventBound = false;
let inputMenuObserver = null;
let templateExportMode = false;
let templateExportSelection = new Set();
let templateSearch = '';
let lastWorldView = '';   // v1.2.1：世界书下拉「最后选择」的查看项
let theaterExportMode = false;
let theaterExportSelection = new Set();
let injectSelection = new Set();   // v0.5.2：写入勾选持久化（跨重渲染/切主题保留）
let accState = {};                 // v0.5.2：折叠面板开合状态记忆

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

// 轻量字符串哈希，用于判断默认提示词是否被用户改动过
function hashText(text) {
  const str = String(text || '');
  let h = 5381;
  for (let i = 0; i < str.length; i++) h = ((h << 5) + h + str.charCodeAt(i)) >>> 0;
  return `${str.length}:${h.toString(36)}`;
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

  if (Number(s.promptRevision || 0) < PROMPT_REVISION) {
    const sys = String(s.systemPrompt || '');
    // 未改动判定：空 / 命中历史默认特征 / 与上次记录的默认哈希一致 → 视为未 DIY，随迭代自动更新
    const sysUntouched = !sys.trim()
      || sys.includes('你是一位顶尖剧作家导演')
      || (sys.includes('顶尖剧作家导演') && !sys.includes('视角分工'))
      || sys.includes('执笔者（使用者）')
      || (s.systemPromptHash && s.systemPromptHash === hashText(sys));
    if (sysUntouched) s.systemPrompt = DEFAULT_SYSTEM_PROMPT;

    const schema = String(s.outputSchemaText || '');
    const isLegacySchemaDefault = schema.includes('schema_version')
      && (!schema.includes('全知导演镜头') || (schema.includes('导演评语：分析节奏') && !schema.includes('毒舌影评人')));
    const schemaUntouched = !schema.trim()
      || isLegacySchemaDefault
      || (s.outputSchemaHash && s.outputSchemaHash === hashText(schema));
    if (schemaUntouched) s.outputSchemaText = JSON_SCHEMA_TEXT;

    s.promptRevision = PROMPT_REVISION;
  }
  // 记录当前默认文本的哈希：与默认一致则存哈希（标记“未改动”），不一致则清空（标记“已 DIY”）
  s.systemPromptHash = String(s.systemPrompt || '') === DEFAULT_SYSTEM_PROMPT ? hashText(DEFAULT_SYSTEM_PROMPT) : '';
  s.outputSchemaHash = String(s.outputSchemaText || '') === JSON_SCHEMA_TEXT ? hashText(JSON_SCHEMA_TEXT) : '';

  if (!Array.isArray(s.logHistory)) s.logHistory = [];
  if (s.lastLog && typeof s.lastLog === 'object') {
    if (s.lastLog.status && s.lastLog.status !== 'none') {
      s.logHistory.unshift({
        id: uid('log'),
        status: s.lastLog.status === 'loading' ? 'cancelled' : s.lastLog.status,
        time: s.lastLog.time || '',
        duration: s.lastLog.duration || '',
        request: clipLog(s.lastLog.request),
        response: clipLog(s.lastLog.response),
        error: s.lastLog.error || '',
      });
      s.logHistory = s.logHistory.slice(0, LOG_LIMIT);
    }
    delete s.lastLog;
  }

  if (!Array.isArray(s.apiProfiles)) s.apiProfiles = [];
  s.selectedPresetNamesByChat ||= {};
  s.selectedPresetItemsByChat ||= {};
  s.selectedWorldBookNamesByChat ||= {};
  s.selectedWorldBookItemsByChat ||= {};
  if (!isPlainObject(s.theater)) s.theater = { instruction: '', apiProfileId: '', presetName: '', presetItems: {}, scripts: [], favorites: [], lastOutput: null };
  if (!Array.isArray(s.theater.scripts)) s.theater.scripts = [];
  if (!Array.isArray(s.theater.favorites)) s.theater.favorites = [];
  if (!isPlainObject(s.theater.presetItems)) s.theater.presetItems = {};
  if (!Array.isArray(s.templates)) s.templates = [];
  // tags → folder：取首个旧标签作为文件夹，移除 tags 字段
  s.templates = s.templates.map((tpl) => {
    const folder = typeof tpl.folder === 'string'
      ? sanitizeFolder(tpl.folder)
      : sanitizeFolder(Array.isArray(tpl.tags) ? tpl.tags[0] : '');
    const { tags, ...rest } = tpl;
    return { ...rest, folder };
  });
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

function clipLog(text, limit = LOG_CLIP) {
  const value = String(text || '');
  return value.length > limit ? `${value.slice(0, limit)}\n…[内容过长已截断]` : value;
}

function pushLog(entry) {
  settings.logHistory ||= [];
  settings.logHistory.unshift(entry);
  settings.logHistory = settings.logHistory.slice(0, LOG_LIMIT);
  saveSettings();
  return entry;
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
  if (isLegacyBlueprint(meta[MODULE_NAME].blueprint) && !meta[MODULE_NAME].blueprintEdited) {
    meta[MODULE_NAME].blueprint = DEFAULT_BLUEPRINT;
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

function normalizeSourceName(name) {
  return String(name || '').trim();
}

/* ============================================================
   通用资料库前端（剧本库 / 剧札共用）：文件夹分组 + 紧凑行 + 滚动 + 搜索 + 多选导入导出
   cfg: { ns, items, getName, getFolder, getSearch, setSearch, exportMode, selection,
          emptyText, searchPlaceholder }
   ============================================================ */
function sanitizeFolder(name) {
  return String(name || '').trim().slice(0, 16);
}

function groupByFolder(items, getFolder) {
  const folders = new Map();
  const loose = [];
  for (const it of items) {
    const f = sanitizeFolder(getFolder(it));
    if (f) {
      if (!folders.has(f)) folders.set(f, []);
      folders.get(f).push(it);
    } else {
      loose.push(it);
    }
  }
  const folderList = [...folders.entries()]
    .sort((a, b) => a[0].localeCompare(b[0], 'zh'))
    .map(([name, list]) => ({ name, list }));
  return { folderList, loose };
}

function renderLibraryRow(cfg, item) {
  const pick = cfg.exportMode
    ? `<label class="sd-lib-pick" title="选择导出"><input type="checkbox" class="sd-lib-select" data-id="${htmlEscape(item.id)}" ${cfg.selection.has(item.id) ? 'checked' : ''}></label>`
    : '';
  return `<article class="sd-lib-row${cfg.exportMode ? ' sd-export-mode' : ''}">${pick}<div class="sd-lib-main"><h4>${htmlEscape(cfg.getName(item) || '未命名')}</h4></div>
    <div class="sd-lib-actions">
      <button type="button" class="sd-btn sd-lib-load" data-id="${htmlEscape(item.id)}">载入</button>
      <button type="button" class="sd-icon-btn sd-icon-sm sd-lib-edit" data-id="${htmlEscape(item.id)}" title="编辑"><i class="fa-solid fa-pencil"></i></button>
      <button type="button" class="sd-icon-btn sd-icon-sm sd-danger sd-lib-delete" data-id="${htmlEscape(item.id)}" title="删除"><i class="fa-solid fa-trash-can"></i></button>
    </div></article>`;
}

function renderLibraryListBody(cfg, items) {
  if (!items.length) {
    return `<p class="sd-muted">${cfg.getSearch() ? '没有匹配的条目。' : htmlEscape(cfg.emptyText || '暂无条目')}</p>`;
  }
  const { folderList, loose } = groupByFolder(items, cfg.getFolder);
  const folderHtml = folderList.map(({ name, list }) => `
    <details class="sd-lib-folder" data-acc="${cfg.ns}-folder-${htmlEscape(name)}" open>
      <summary><i class="fa-solid fa-folder"></i><b>${htmlEscape(name)}</b><span>${list.length}</span></summary>
      <div class="sd-lib-folder-body">${list.map((it) => renderLibraryRow(cfg, it)).join('')}</div>
    </details>`).join('');
  const looseHtml = loose.map((it) => renderLibraryRow(cfg, it)).join('');
  return folderHtml + looseHtml;
}

function renderLibrarySection(cfg) {
  const all = cfg.items;
  const search = cfg.getSearch();
  const matched = search
    ? all.filter((it) => String(cfg.getName(it) || '').toLowerCase().includes(search.toLowerCase()))
    : all;
  const exportBar = cfg.exportMode
    ? `<div class="sd-export-bar"><span class="sd-export-hint">勾选要导出的条目</span><button type="button" class="sd-btn sd-mini-btn sd-lib-confirm-export">导出 (<span>${cfg.selection.size}</span>)</button><button type="button" class="sd-btn sd-mini-btn sd-lib-cancel-export">取消</button></div>`
    : '';
  return `
      <div class="sd-template-head">
        <h3>${htmlEscape(cfg.title)}</h3>
        <div class="sd-template-io-buttons">
          <label class="sd-icon-btn sd-file-label sd-lib-import-label" title="导入" aria-label="导入"><i class="fa-solid fa-file-import"></i><input type="file" accept="application/json" class="sd-lib-import"></label>
          <button type="button" class="sd-icon-btn sd-lib-export-toggle ${cfg.exportMode ? 'active' : ''}" title="导出" aria-label="导出"><i class="fa-solid fa-file-export"></i></button>
        </div>
        <span class="sd-tpl-count">${all.length} 个</span>
      </div>
      ${exportBar}
      <input type="search" class="text_pole sd-lib-search" placeholder="${htmlEscape(cfg.searchPlaceholder || '搜索标题…')}" value="${htmlEscape(search)}">
      <div class="sd-lib-list sd-scroll">${renderLibraryListBody(cfg, matched)}</div>`;
}

// 绑定通用库事件。handlers: { onLoad, onEdit, onDelete, onImport, onExport, rebuildCfg }
function bindLibraryEvents(root, makeCfg, handlers) {
  const cfg = makeCfg();
  const refreshList = () => {
    const c = makeCfg();
    const search = c.getSearch();
    const matched = search ? c.items.filter((it) => String(c.getName(it) || '').toLowerCase().includes(search.toLowerCase())) : c.items;
    const list = root.querySelector('.sd-lib-list');
    if (list) {
      list.innerHTML = renderLibraryListBody(c, matched);
      applyAccState(root);
      bindRowEvents();
    }
  };
  const bindRowEvents = () => {
    root.querySelectorAll('.sd-lib-load').forEach((el) => el.addEventListener('click', () => handlers.onLoad(el.dataset.id)));
    root.querySelectorAll('.sd-lib-edit').forEach((el) => el.addEventListener('click', () => handlers.onEdit(el.dataset.id)));
    root.querySelectorAll('.sd-lib-delete').forEach((el) => el.addEventListener('click', () => handlers.onDelete(el.dataset.id)));
    root.querySelectorAll('.sd-lib-select').forEach((el) => el.addEventListener('change', () => {
      const c = makeCfg();
      if (el.checked) c.selection.add(el.dataset.id);
      else c.selection.delete(el.dataset.id);
      const span = root.querySelector('.sd-lib-confirm-export span');
      if (span) span.textContent = String(c.selection.size);
    }));
  };
  root.querySelector('.sd-lib-search')?.addEventListener('input', (e) => {
    cfg.setSearch(e.target.value || '');
    refreshList();
  });
  root.querySelector('.sd-lib-export-toggle')?.addEventListener('click', handlers.onToggleExport);
  root.querySelector('.sd-lib-cancel-export')?.addEventListener('click', handlers.onCancelExport);
  root.querySelector('.sd-lib-confirm-export')?.addEventListener('click', handlers.onConfirmExport);
  root.querySelector('.sd-lib-import')?.addEventListener('change', handlers.onImport);
  bindRowEvents();
}

// 通用编辑弹窗：名称 + 文件夹 + 内容
async function promptLibraryEdit({ dialogTitle, nameLabel, folderLabel, contentLabel, name, folder, content }) {
  const context = ctx();
  const Popup = context.Popup;
  if (Popup && context.POPUP_TYPE) {
    const wrap = document.createElement('div');
    wrap.className = 'sd-lib-edit-form';
    wrap.innerHTML = `
      <label style="display:block;text-align:left;margin:0 0 4px">${htmlEscape(nameLabel)}</label>
      <input type="text" class="text_pole sd-le-name" style="width:100%;margin:0 0 10px">
      <label style="display:block;text-align:left;margin:0 0 4px">${htmlEscape(folderLabel)}</label>
      <input type="text" class="text_pole sd-le-folder" placeholder="留空则不分类" style="width:100%;margin:0 0 10px">
      <label style="display:block;text-align:left;margin:0 0 4px">${htmlEscape(contentLabel)}</label>
      <textarea class="text_pole sd-le-content" rows="8" style="width:100%;resize:vertical"></textarea>`;
    wrap.querySelector('.sd-le-name').value = name || '';
    wrap.querySelector('.sd-le-folder').value = folder || '';
    wrap.querySelector('.sd-le-content').value = content || '';
    try {
      const popup = new Popup(wrap, context.POPUP_TYPE.CONFIRM, '', { okButton: '保存', cancelButton: '取消' });
      const ok = await popup.show();
      if (!ok) return null;
      return {
        name: String(wrap.querySelector('.sd-le-name').value || '').trim(),
        folder: sanitizeFolder(wrap.querySelector('.sd-le-folder').value),
        content: String(wrap.querySelector('.sd-le-content').value || '').trim(),
      };
    } catch (_) {}
  }
  const newName = await promptInput(dialogTitle, `${nameLabel}：`, name || '');
  if (newName === null) return null;
  const newFolder = await promptInput(dialogTitle, `${folderLabel}（留空不分类）：`, folder || '');
  if (newFolder === null) return null;
  const newContent = await promptInput(dialogTitle, `${contentLabel}：`, content || '');
  if (newContent === null) return null;
  return { name: String(newName || '').trim(), folder: sanitizeFolder(newFolder), content: String(newContent || '').trim() };
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

function rerenderIfOpen() {
  if (document.getElementById(MODAL_ID)?.classList.contains('open')) renderModal();
}

async function refreshPresets(showToast = true) {
  const currentPresetName = getCurrentPresetName();
  const presetNames = listPresetNames();
  const selectedPresetNames = getSelectedPresetNames();
  contextScanCache.currentPresetName = currentPresetName;
  contextScanCache.presetNames = presetNames;
  contextScanCache.presets = {};
  for (const name of presetNames) {
    if (name === currentPresetName || selectedPresetNames.includes(name)) {
      contextScanCache.presets[name] = getPresetEntries(name);
    }
  }
  contextScanCache.presetScannedAt = new Date().toISOString();
  initializeSelectedContextState(contextScanCache);
  saveSettings();
  if (showToast) toast('预设已读取。', 'success');
  rerenderIfOpen();
}

async function refreshWorldBooks(showToast = true) {
  const boundNames = detectBoundWorldBookNames();
  const allWorldNames = await listWorldBooks();
  const selectedWorldNames = getSelectedWorldBookNames();
  contextScanCache.boundWorldBookNames = boundNames;
  contextScanCache.worldBookNames = allWorldNames;
  contextScanCache.worldBooks = {};
  for (const name of selectedWorldNames) {
    if (allWorldNames.includes(name) || boundNames.includes(name)) {
      contextScanCache.worldBooks[name] = await getWorldBookEntries(name);
    }
  }
  contextScanCache.worldScannedAt = new Date().toISOString();
  initializeSelectedContextState(contextScanCache);
  saveSettings();
  if (showToast) toast('世界书已读取。', 'success');
  rerenderIfOpen();
}

async function refreshContextSources(showToast = false) {
  await refreshPresets(false);
  await refreshWorldBooks(false);
  if (showToast) toast('已刷新。', 'success');
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

// v1.2.1：预设里的「标记条目」（charDescription / worldInfo / persona 等）本身无字面内容，
// 由 ST 在生成时填充。仅开预设时这些条目会被当成空而漏发，这里按 identifier 解析为真实内容。
async function resolvePresetMarker(item) {
  const id = String(item?.identifier || item?.name || '').toLowerCase();
  const isMarker = item?.marker === true || !(item?.content || item?.prompt || item?.message || item?.text);
  if (!isMarker) return null;
  if (id.includes('chardescription') || id === 'description') {
    const v = cleanContextText(await resolveMacro(getCharacterDescription()));
    return v ? { title: `角色设定 - ${getCharacterName()}`, content: v } : null;
  }
  if (id.includes('charpersonality') || id === 'personality') {
    const ch = ctx().characters?.[ctx().characterId];
    const v = cleanContextText(await resolveMacro(ch?.personality || ch?.data?.personality || ''));
    return v ? { title: '角色性格', content: v } : null;
  }
  if (id.includes('scenario')) {
    const ch = ctx().characters?.[ctx().characterId];
    const v = cleanContextText(await resolveMacro(ch?.scenario || ch?.data?.scenario || ''));
    return v ? { title: '场景', content: v } : null;
  }
  if (id.includes('persona')) {
    const v = cleanContextText(await resolveMacro(getPersonaDescription()));
    return v ? { title: `用户人设 - ${getPersonaName()}`, content: v } : null;
  }
  if (id.includes('worldinfo') || id.includes('world_info') || id.includes('charlore') || id.includes('lore')) {
    const v = await buildBoundWorldText();
    return v ? { title: '世界书（绑定）', content: v, isWorld: true } : null;
  }
  return null;
}

// 读取当前角色绑定的世界书全部启用条目（复用于预设 worldInfo 标记解析与幕外默认上下文）
async function buildBoundWorldText() {
  let output = '';
  const boundNames = uniqueClean([...detectBoundWorldBookNames(), ...(contextScanCache.boundWorldBookNames || [])]);
  for (const wbName of boundNames) {
    let entries = contextScanCache.worldBooks?.[wbName];
    if (!entries || !entries.length) {
      try { entries = await getWorldBookEntries(wbName); } catch (_) { entries = []; }
    }
    for (const [index, item] of (entries || []).entries()) {
      if (item?.enabled === false || item?.disable === true) continue;
      const title = item.name || item.comment || (Array.isArray(item.key) ? item.key.join(', ') : item.key) || `世界书条目 ${index + 1}`;
      let content = await resolveMacro(item.content || item.text || '');
      content = processRandomMacros(content);
      if (content) output += `\n【${wbName}: ${title}】\n${cleanContextText(content)}\n`;
    }
  }
  return output.trim();
}

async function buildPresetContextText() {
  let output = '';
  let worldInjected = false;
  for (const presetName of getSelectedPresetNames()) {
    const entries = contextScanCache.presets?.[presetName] || getPresetEntries(presetName);
    for (const [index, item] of (entries || []).entries()) {
      const itemId = getContextItemId(item, index);
      if (!isPresetItemSelected(presetName, itemId)) continue;
      const title = item.name || item.identifier || item.role || `预设条目 ${index + 1}`;
      let content = await resolveMacro(item.content || item.prompt || item.message || item.text || '');
      content = processRandomMacros(content);
      if (content) {
        output += `\n【预设 - ${presetName}: ${title}】\n${cleanContextText(content)}\n`;
        continue;
      }
      // 空内容 → 尝试按标记条目解析为真实设定/世界书
      const resolved = await resolvePresetMarker(item);
      if (resolved) {
        if (resolved.isWorld) {
          if (worldInjected) continue; // 多个世界书标记只注入一次，避免重复
          worldInjected = true;
        }
        output += `\n【预设 - ${presetName}: ${resolved.title}】\n${resolved.content}\n`;
      }
    }
  }
  return output.trim();
}

async function buildWorldContextText() {
  let output = '';
  if (settings.contextOptions.includeCharDesc) {
    const desc = await resolveMacro(getCharacterDescription());
    if (desc) output += `\n【当前角色设定】\n${cleanContextText(desc)}\n`;
  }
  if (settings.contextOptions.includeUserDesc) {
    const desc = await resolveMacro(getPersonaDescription());
    if (desc) output += `\n【用户人设】\n${cleanContextText(desc)}\n`;
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

/* ============================================================
   暗线注入系统
   ============================================================ */

function snip(text, n = 64) {
  const value = String(text || '').replace(/\s+/g, ' ').trim();
  return value.length > n ? `${value.slice(0, n)}…` : value;
}

function buildPlanDigest(plan) {
  if (!plan) return '';
  const st = plan.story_status || {};
  const lines = [];
  lines.push('【千幕·暗线灵感池】');
  lines.push('以下是导演系统埋下的潜在暗线与世界动向，仅供叙事时取用灵感：它们只是可能性，不必全部发生，也无需围绕谁展开。可在合适的时机让其中某一点自然浮现、发酵，或彼此牵动（蝴蝶效应），也可让它继续沉睡。世界里的人与事各有自己的节奏；{{user}} 可参与、可旁观、可间接受影响，也可全然不知。');
  const arcLine = [st.current_arc, st.current_stage].filter(Boolean).join(' · ');
  if (arcLine) lines.push(`当前幕：${snip(arcLine, 90)}`);
  if (st.mood) lines.push(`氛围：${snip(st.mood, 40)}`);
  const quests = (plan.quests || []).map((q) => `- ${snip(q.title, 24)}：${snip(q.objective || q.description, 56)}${q.trigger ? `（触发：${snip(q.trigger, 28)}）` : ''}`).filter(Boolean);
  if (quests.length) lines.push(`可选事件入口（{{user}} 可主动触碰，也可无视）：\n${quests.join('\n')}`);
  const nodes = (plan.story_nodes || []).map((n) => `- ${snip(n.title, 24)}：${snip(n.event || n.foreshadowing, 56)}${n.trigger ? `（时机：${snip(n.trigger, 28)}）` : ''}`).filter(Boolean);
  if (nodes.length) lines.push(`潜在节点（可直接相关、间接波及或发生在视野边缘）：\n${nodes.join('\n')}`);
  const npcs = (plan.npc_updates || []).map((n) => `- ${snip(n.name, 16)}：${snip(n.next_action || n.current_goal, 56)}${n.hidden_agenda && String(n.hidden_agenda).trim() !== '无' ? `（暗流：${snip(n.hidden_agenda, 28)}）` : ''}`).filter(Boolean);
  if (npcs.length) lines.push(`人物暗流（自行推进，不等待任何人）：\n${npcs.join('\n')}`);
  const worlds = (plan.world_updates || []).map((w) => `- ${snip(w.title, 24)}：${snip(w.content, 56)}${w.timing ? `（${snip(w.timing, 20)}）` : ''}`).filter(Boolean);
  if (worlds.length) lines.push(`世界涟漪（在背景中持续发酵）：\n${worlds.join('\n')}`);
  return lines.join('\n\n');
}

function getInjectApi() {
  const context = ctx();
  const setter = typeof context.setExtensionPrompt === 'function'
    ? context.setExtensionPrompt
    : (typeof globalThis.setExtensionPrompt === 'function' ? globalThis.setExtensionPrompt : null);
  const types = context.extension_prompt_types || globalThis.extension_prompt_types || {};
  const roles = context.extension_prompt_roles || globalThis.extension_prompt_roles || {};
  return {
    setter,
    position: typeof types.IN_CHAT === 'number' ? types.IN_CHAT : 1,
    role: typeof roles.SYSTEM === 'number' ? roles.SYSTEM : 0,
  };
}

async function applyDirectorInjection() {
  const { setter, position, role } = getInjectApi();
  if (!setter) return;
  try {
    const store = getChatStore();
    const active = settings?.enabled && settings.injectEnabled && store?.plan;
    const text = active ? buildPlanDigest(store.plan) : '';
    const depth = Math.max(0, Math.min(20, Number(settings?.injectDepth ?? 2)));
    setter(MODULE_NAME, text, position, depth, false, role);
  } catch (error) {
    console.warn(`[${MODULE_NAME}] apply injection failed`, error);
  }
}

function clearDirectorInjection() {
  const { setter, position, role } = getInjectApi();
  try { setter?.(MODULE_NAME, '', position, 0, false, role); } catch (_) {}
}

globalThis.qianmuDirectorInterceptor = async function (chat) {
  try {
    if (!initialized || !settings?.enabled || !settings.injectEnabled) return;
    if (getInjectApi().setter) return;
    const store = getChatStore();
    if (!store?.plan || !Array.isArray(chat)) return;
    const digest = buildPlanDigest(store.plan);
    if (!digest) return;
    const depth = Math.max(0, Math.min(chat.length, Number(settings.injectDepth ?? 2)));
    chat.splice(chat.length - depth, 0, {
      name: 'System',
      is_user: false,
      is_system: true,
      send_date: Date.now(),
      mes: digest,
      extra: { type: 'narrator', qianmu_injected: true },
    });
  } catch (error) {
    console.warn(`[${MODULE_NAME}] interceptor failed`, error);
  }
};

/* ============================================================
   推演提示词：六段固定顺序（后台写死）
   ============================================================ */
async function buildPrompt() {
  if (!contextScanCache.presetScannedAt && !contextScanCache.worldScannedAt) await refreshContextSources(false);
  const store = getChatStore();
  const segments = [];

  const presetText = await buildPresetContextText();
  if (presetText) {
    segments.push(presetText);
  }

  const worldText = await buildWorldContextText();
  segments.push(`【世界设定】\n角色/群聊：${getCharacterName()}\n用户：{{user}}${worldText ? `\n${worldText}` : ''}`);

  segments.push(`【编剧方案】\n${store.blueprint || DEFAULT_BLUEPRINT}`);

  if (settings.contextOptions.includeChatHistory) {
    segments.push(`【近期对话】\n${getChatHistoryText() || '暂无对话记录'}`);
  }

  if (store.plan) {
    segments.push(`【上次审片状态】\n${JSON.stringify(store.plan, null, 2)}\n\n【承接原则】上次审片状态仅作连续性参考，不是必须推进的剧本。请始终以「近期对话」的真实节奏为第一优先：\n- 与 {{user}} 直接相关的任务、剧情节点：只有当近期对话确实触碰、回应或推进了它们时才往下走；若正文并未涉及，则保持原状或仅作合理的环境留存，切勿自顾自地替 {{user}} 推进。\n- 与 {{user}} 无关的世界运转（NPC 自身进程、组织、公共事件、远处暗线）：可依自身逻辑持续流动、发酵、转向，无需等待 {{user}}。\n- 若上次状态与当前正文出现矛盾，以当前正文为准并自然校正。`);
  }

  if (settings.newcomerMode) {
    segments.push('【新角入场指令】\n本次推演必须为角色世界注入新鲜血液：npc_updates 中至少包含1-2位此前从未出现过的全新NPC（给出姓名、定位、动机，以及与现有关系网或交际圈的自然接驳点）；world_updates 中至少包含1-2件全新的世界事件或公共变化。新角与新事件需贴合当前世界观与剧情密度，像是世界自然生长出来的，而非凭空插入。');
  }

  segments.push(settings.outputSchemaText || JSON_SCHEMA_TEXT);
  segments.push('【最终任务】\n依据上方编剧方案与全部参考，推演当前故事的下一幕。请只输出JSON对象。所有百分比数值范围为0-100。任务、剧情节点、NPC动态和世界变化都要贴合当前故事，通常各给出3-5个条目，并严格遵守视角分工：任务以 {{user}} 第一人称书写，节点在双视角间过渡，角色与世界使用全知导演镜头。同时提供不同参与距离的事件（可介入、间接波及、视野之外），允许条目之间互相牵动。审片维度固定为张力、情感、悬念、节奏，progress 为本幕进度。');
  return segments.join('\n\n');
}

function validateApiSettings() {
  if (settings.providerMode === 'external') return !!(normalizeUrl(settings.apiUrl) && settings.apiKey && settings.model);
  return typeof ctx().generateRaw === 'function';
}

async function callExternalApi(messages, onDelta = null, cfg = null) {
  const apiUrl = cfg?.apiUrl ?? settings.apiUrl;
  const apiKey = cfg?.apiKey ?? settings.apiKey;
  const model = cfg?.model ?? settings.model;
  const temperature = cfg?.temperature ?? settings.temperature;
  const base = normalizeUrl(apiUrl);
  if (!(base && apiKey && model)) throw new Error('INVALID_API_SETTINGS');
  abortController = new AbortController();
  const stream = !!settings.streamEnabled && typeof onDelta === 'function';
  const body = { model, messages, temperature: Number(temperature || 0.75), stream };
  const res = await fetch(`${base}/v1/chat/completions`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal: abortController.signal,
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`HTTP ${res.status}${text ? ` · ${text.slice(0, 300)}` : ''}`);
  }
  if (!stream || !res.body) {
    const data = await res.json();
    return data.choices?.[0]?.message?.content || data.choices?.[0]?.text || '';
  }
  return await readSseStream(res.body, onDelta);
}

async function readSseStream(stream, onDelta) {
  const reader = stream.getReader();
  const decoder = new TextDecoder('utf-8');
  let buffer = '';
  let full = '';
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || !trimmed.startsWith('data:')) continue;
        const payload = trimmed.slice(5).trim();
        if (payload === '[DONE]') continue;
        try {
          const json = JSON.parse(payload);
          const delta = json.choices?.[0]?.delta?.content
            ?? json.choices?.[0]?.message?.content
            ?? json.choices?.[0]?.text
            ?? '';
          if (delta) {
            full += delta;
            onDelta(full);
          }
        } catch (_) {}
      }
    }
  } finally {
    reader.releaseLock?.();
  }
  return full;
}

async function callSillyTavernModel(messages) {
  const context = ctx();
  if (typeof context.generateRaw !== 'function') throw new Error('INVALID_API_SETTINGS');
  return await context.generateRaw({ prompt: messages, systemPrompt: settings.systemPrompt });
}

// v0.5.4：字符串感知的缺逗号补全（仅在字符串外操作，{{user}} 等内容不受影响）
function insertMissingCommas(text) {
  let result = '';
  let inString = false;
  let escape = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    result += ch;
    if (inString) {
      if (escape) { escape = false; continue; }
      if (ch === '\\') { escape = true; continue; }
      if (ch === '"') {
        inString = false;
        if (/^\s*[{\["]/.test(text.slice(i + 1))) result += ',';
      }
      continue;
    }
    if (ch === '"') { inString = true; continue; }
    if ((ch === '}' || ch === ']') && /^\s*[{\["]/.test(text.slice(i + 1))) result += ',';
  }
  return result;
}

// v0.5.4：截断自愈——裁剪到最后一个完整值，再按括号栈补齐闭合
function repairTruncatedJson(text) {
  const tryCut = (includeStrings) => {
    let inString = false;
    let escape = false;
    let cutIndex = -1;
    for (let i = 0; i < text.length; i++) {
      const ch = text[i];
      if (inString) {
        if (escape) escape = false;
        else if (ch === '\\') escape = true;
        else if (ch === '"') { inString = false; if (includeStrings) cutIndex = i + 1; }
        continue;
      }
      if (ch === '"') { inString = true; continue; }
      if (ch === '}' || ch === ']') cutIndex = i + 1;
    }
    if (cutIndex <= 0) return null;
    let candidate = text.slice(0, cutIndex).replace(/,\s*$/, '');
    inString = false;
    escape = false;
    const stack = [];
    for (const ch of candidate) {
      if (inString) {
        if (escape) escape = false;
        else if (ch === '\\') escape = true;
        else if (ch === '"') inString = false;
        continue;
      }
      if (ch === '"') inString = true;
      else if (ch === '{') stack.push('}');
      else if (ch === '[') stack.push(']');
      else if (ch === '}' || ch === ']') stack.pop();
    }
    candidate += stack.reverse().join('');
    candidate = candidate.replace(/,\s*([}\]])/g, '$1');
    try { return JSON.parse(candidate); } catch (_) { return null; }
  };
  return tryCut(false) ?? tryCut(true);
}

function extractJson(text) {
  let content = String(text || '').trim();
  content = content.replace(/^```(?:json)?/i, '').replace(/```$/g, '').trim();
  const start = content.indexOf('{');
  const end = content.lastIndexOf('}');
  if (start !== -1 && end !== -1 && end > start) content = content.slice(start, end + 1);
  const base = content.replace(/,\s*([}\]])/g, '\$1');
  let lastError = null;
  try { return JSON.parse(base); } catch (e) { lastError = e; }
  const commaFixed = insertMissingCommas(base).replace(/,\s*([}\]])/g, '\$1');
  try { return JSON.parse(commaFixed); } catch (e) { lastError = e; }
  const repaired = repairTruncatedJson(commaFixed);
  if (repaired !== null) {
    console.warn(`[${MODULE_NAME}] JSON 已自动修复（若为截断，末尾少量条目可能缺失）`);
    return repaired;
  }
  throw new Error(`JSON_PARSE_FAILED::${lastError?.message || 'unknown'}`);
}

function normalizePlan(plan) {
  const base = {
    schema_version: '1.2',
    story_status: { title: '当前故事', current_arc: '', current_stage: '', cycle: '', progress: 0, metrics: [], mood: '', summary: '' },
    quests: [], story_nodes: [], npc_updates: [], world_updates: [], director_comment: '', next_refresh_hint: '',
  };
  if (!isPlainObject(plan)) plan = {};
  mergeDefaults(plan, base);
  plan.quests = Array.isArray(plan.quests) ? plan.quests : [];
  plan.story_nodes = Array.isArray(plan.story_nodes) ? plan.story_nodes : [];
  plan.npc_updates = Array.isArray(plan.npc_updates) ? plan.npc_updates : [];
  plan.world_updates = Array.isArray(plan.world_updates) ? plan.world_updates : [];
  const st = plan.story_status || {};
  const raw = Array.isArray(st.metrics) ? st.metrics : [];
  st.metrics = FIXED_METRICS.map((label, index) => {
    const found = raw.find((m) => String(m?.label || '').trim() === label) || raw[index];
    return { label, value: Math.max(0, Math.min(100, Number(found?.value ?? found?.score ?? 0))) };
  });
  return plan;
}

function makeStreamLogUpdater(log) {
  let lastPaint = 0;
  const paint = (text) => {
    const modal = document.getElementById(MODAL_ID);
    if (!modal || activeTab !== 'plug') return;
    const entry = modal.querySelector(`.sd-log-entry[data-acc="log-${CSS.escape(log.id)}"]`);
    const pre = entry?.querySelectorAll('.sd-term')?.[entry.querySelector('.sd-term-error') ? 2 : 1];
    if (pre) {
      pre.textContent = text;
      pre.scrollTop = pre.scrollHeight;
    }
  };
  return (full) => {
    log.response = clipLog(full);
    const now = Date.now();
    if (now - lastPaint < 80) return;
    lastPaint = now;
    paint(log.response);
  };
}

async function generateDirectorPlan(showSuccessToast = true, silentFailure = false) {
  if (!settings.enabled) return toast('千幕已关闭。', 'warning');
  if (busy) return;
  if (!validateApiSettings()) {
    pushLog({ id: uid('log'), kind: 'director', status: 'error', time: new Date().toLocaleString(), duration: '', request: '', response: '', error: '请检查API设置' });
    if (!silentFailure) apiToast();
    return;
  }
  busy = true;
  cancelRequested = false;
  renderBusyState();
  const startedAt = Date.now();
  const log = pushLog({ id: uid('log'), kind: 'director', status: 'loading', time: new Date().toLocaleString(), duration: '', request: '', response: '', error: '' });
  try {
    const userPrompt = await buildPrompt();
    const messages = [{ role: 'system', content: settings.systemPrompt || DEFAULT_SYSTEM_PROMPT }, { role: 'user', content: userPrompt }];
    log.request = clipLog(JSON.stringify(messages, null, 2));
    saveSettings();

    const onDelta = settings.streamEnabled ? makeStreamLogUpdater(log) : null;
    const raw = settings.providerMode === 'sillytavern' ? await callSillyTavernModel(messages) : await callExternalApi(messages, onDelta);
    if (cancelRequested) throw new Error('USER_CANCELLED');
    log.response = clipLog(raw);
    const newPlan = normalizePlan(extractJson(raw));
    const store = getChatStore();
    const now = new Date().toISOString();
    store.history = [{ id: uid('hist'), createdAt: now, plan: clone(newPlan) }, ...(Array.isArray(store.history) ? store.history : [])].slice(0, 5);
    store.plan = newPlan;
    store.updatedAt = now;
    store.messageCounter = 0;
    injectSelection.clear();   // v0.5.2：新推演结果生成，旧写入勾选失效
    await saveMetadata();
    await applyDirectorInjection();
    log.status = 'success';
    log.duration = `${((Date.now() - startedAt) / 1000).toFixed(1)}s`;
    saveSettings();
    if (showSuccessToast) toast('推演完成，暗线已就位。', 'success');
  } catch (error) {
    const msg = error?.name === 'AbortError' ? 'USER_CANCELLED' : (error?.message || String(error));
    const isJsonFail = msg.startsWith('JSON_PARSE_FAILED::');
    log.status = msg === 'USER_CANCELLED' ? 'cancelled' : 'error';
    log.error = msg === 'INVALID_API_SETTINGS' ? '请检查API设置'
      : msg === 'USER_CANCELLED' ? '已取消生成'
      : isJsonFail ? `模型返回的JSON格式有误（多为输出中途被截断或缺少逗号），自动修复未成功，本次结果未写入。原始返回已完整保留在下方「返回」中，直接重试通常即可。\n原始错误：${msg.slice(19)}`
      : msg;
    log.duration = `${((Date.now() - startedAt) / 1000).toFixed(1)}s`;
    saveSettings();
    if (!silentFailure) {
      if (msg === 'USER_CANCELLED') toast('已取消生成。', 'warning');
      else if (isJsonFail) toast('生成失败：模型输出的JSON格式有误，原文已保留在日志，可直接重试。', 'error');
      else if (msg === 'INVALID_API_SETTINGS' || settings.providerMode === 'external') apiToast();
      else toast(`生成失败：${log.error}`, 'error');
    }
  } finally {
    abortController = null;
    cancelRequested = false;
    busy = false;
    renderModal();
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
  const loading = (settings.logHistory || []).find((x) => x.status === 'loading');
  if (loading) {
    loading.status = 'cancelled';
    loading.error = '已取消生成';
  }
  saveSettings();
  busy = false;
  renderBusyState();
  rerenderIfOpen();
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
  if (!settings.enabled) return toast('千幕已关闭。', 'warning');
  activeTab = tab;
  theaterView = null;
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
    document.body.appendChild(btn);
    bindFloatDrag(btn);
  }
  btn.textContent = '幕';
  btn.title = EXTENSION_NAME;
  bindFloatDrag(btn);
  applyFloatPosition(btn);
}

function renderBusyState() {
  document.querySelectorAll('.sd-generate-main').forEach((el) => {
    el.disabled = busy || !settings.enabled;
    el.classList.toggle('sd-busy', busy);
    el.innerHTML = busy
      ? '推演中<span class="sd-dots"><i>·</i><i>·</i><i>·</i></span>'
      : '<i class="fa-solid fa-clapperboard"></i>推演下一幕';
  });
  document.querySelectorAll('.sd-theater-stage').forEach((el) => {
    el.disabled = busy || !settings.enabled;
    el.classList.toggle('sd-busy', busy);
    el.innerHTML = busy
      ? '上演中<span class="sd-dots"><i>·</i><i>·</i><i>·</i></span>'
      : '<i class="fa-solid fa-masks-theater"></i>上演此幕';
  });
}

// v0.5.2：折叠面板开合状态记忆（修复"点选预设时世界书也跟着展开"）
function snapshotAccState(modal) {
  modal.querySelectorAll('details[data-acc]').forEach((el) => {
    accState[el.dataset.acc] = el.open;
  });
}

function applyAccState(modal) {
  modal.querySelectorAll('details[data-acc]').forEach((el) => {
    if (typeof accState[el.dataset.acc] === 'boolean') el.open = accState[el.dataset.acc];
  });
}

// v0.5.2：读取 ST 当前正文字体，写入 --sd-font（视觉隔离保留，仅字体跟随）
function syncFontWithST() {
  try {
    const modal = document.getElementById(MODAL_ID);
    if (!modal) return;
    const bodyFont = getComputedStyle(document.body).fontFamily;
    if (bodyFont) modal.style.setProperty('--sd-font', bodyFont);
  } catch (_) {}
}

function renderModal() {
  const modal = document.getElementById(MODAL_ID);
  if (!modal) return;
  const prevScroll = modal.querySelector('.sd-body')?.scrollTop ?? 0;
  const prevTabScroll = modal.querySelector('.sd-tabs')?.scrollLeft ?? 0;
  snapshotAccState(modal);
  const tabs = [
    ['dashboard', '审片'],
    ['blueprint', '编剧'],
    ['tasksnodes', '任务节点'],
    ['castworld', '角色世界'],
    ['context', '取材'],
    ['settings', '幕后'],
    ['theater', '幕外'],
  ];
  const wasOpen = modal.classList.contains('open');
  modal.className = `sd-theme-${settings.theme === 'dark' ? 'dark' : 'light'}${wasOpen ? ' open' : ''}`;
  modal.innerHTML = `
    <div class="sd-backdrop"></div>
    <section class="sd-window" role="dialog" aria-label="${EXTENSION_NAME}">
      <header class="sd-header">
        <div class="sd-titlebox">
          <h2>${EXTENSION_NAME}</h2>
          <span class="sd-version-tag">v${VERSION}</span>
          <p>一蝶振翅&nbsp;&nbsp;万象入幕</p>
        </div>
        <div class="sd-header-actions">
          <button class="sd-plug-shortcut" title="API与日志"><i class="fa-solid fa-gear"></i></button>
          <button class="sd-theme-toggle" title="切换外观" aria-label="切换外观"><span></span></button>
          <button class="sd-close" title="关闭"><i class="fa-solid fa-xmark"></i></button>
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
    if (el.dataset.tab !== 'theater') theaterView = null;
    activeTab = el.dataset.tab;
    renderModal();
  }));
  bindActiveTabEvents(modal);
  applyAccState(modal);
  renderBusyState();
  syncFontWithST();
  const body = modal.querySelector('.sd-body');
  if (body) body.scrollTop = prevScroll;
  // v0.5.5：保留标签栏横向滚动位置，并确保激活标签可见（修移动端点选后标题栏弹回左侧）
  const tabsBar = modal.querySelector('.sd-tabs');
  if (tabsBar) {
    tabsBar.scrollLeft = prevTabScroll;
    tabsBar.querySelector('.sd-tab.active')?.scrollIntoView({ inline: 'nearest', block: 'nearest' });
  }
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
    case 'theater': return renderTheaterTab();
    case 'plug': return renderPlugTab();
    default: return renderDashboardTab();
  }
}

function renderInjectDock() {
  if (!['tasksnodes', 'castworld'].includes(activeTab) || !currentPlan()) return '';
  return '<div class="sd-inject-dock"><button class="sd-btn sd-primary sd-inject-selected" type="button" disabled>写入已选 (<span>0</span>)</button></div>';
}

function metricBar(label, value) {
  const n = Math.max(0, Math.min(100, Number(value || 0)));
  return `<div class="sd-metric sd-progress-metric"><div class="sd-metric-top"><span>${htmlEscape(label)}</span><b>${n}%</b></div><div class="sd-bar"><i style="width:${n}%"></i></div></div>`;
}

// v0.5.2：环形进度指标，中心显示 N%
function metricCircle(label, value) {
  const n = Math.max(0, Math.min(100, Number(value || 0)));
  return `<div class="sd-circle-metric" style="--sd-value:${n}"><div class="sd-circle"><span>${n}%</span></div><b>${htmlEscape(label)}</b></div>`;
}

function getStoryMetrics(st) {
  const raw = Array.isArray(st?.metrics) ? st.metrics : [];
  return FIXED_METRICS.map((label, index) => {
    const found = raw.find((m) => String(m?.label || '').trim() === label) || raw[index];
    return { label, value: Math.max(0, Math.min(100, Number(found?.value ?? found?.score ?? 0))) };
  });
}

function renderInjectBadge() {
  const on = !!settings.injectEnabled;
  return `<button type="button" class="sd-inject-badge ${on ? 'on' : ''}" title="点击${on ? '关闭' : '开启'}暗线注入"><i class="sd-dot"></i>${on ? '暗线注入中' : '暗线注入已关'}</button>`;
}

function renderHeroActions(hasPlan) {
  const clearBtn = hasPlan
    ? '<button type="button" class="sd-icon-btn sd-clear-plan" title="清空当前推演" aria-label="清空当前推演"><i class="fa-solid fa-broom"></i></button>'
    : '';
  return `<div class="sd-hero-actions">${renderInjectBadge()}${clearBtn}</div>`;
}

function renderGenerateRow() {
  return `<div class="sd-button-row">
    <button class="sd-btn sd-primary sd-generate-main"><i class="fa-solid fa-clapperboard"></i>推演下一幕</button>
    <button class="sd-btn sd-newcomer-toggle ${settings.newcomerMode ? 'active' : ''}" type="button" title="选中后，本次推演将引入全新角色与世界事件"><i class="fa-solid fa-user-plus"></i>新角入场</button>
    ${busy ? '<button class="sd-btn sd-stop"><i class="fa-solid fa-stop"></i>停止</button>' : ''}
  </div>`;
}

function renderDashboardTab() {
  const p = currentPlan();
  if (!p) {
    return `<section class="sd-card sd-plan-card"><div class="sd-hero-top"><h3 style="margin:0">剧情推演</h3>${renderHeroActions(false)}</div><div class="sd-empty">尚未推演剧情</div>${renderGenerateRow()}</section>`;
  }
  const st = p.story_status || {};
  return `
    <section class="sd-card sd-hero">
      <div class="sd-hero-top"><div class="sd-kicker">${htmlEscape(st.cycle || '下一幕')}</div>${renderHeroActions(true)}</div>
      <h3>${htmlEscape(st.title || '当前故事')}</h3>
      <p>${htmlEscape(st.summary || '')}</p>
      <div class="sd-two"><b>主线：</b>${htmlEscape(st.current_arc || '-')}</div>
      <div class="sd-two"><b>阶段：</b>${htmlEscape(st.current_stage || '-')}</div>
      <div class="sd-two"><b>氛围：</b>${htmlEscape(st.mood || '-')}</div>
      ${renderGenerateRow()}
    </section>
    <section class="sd-card sd-status-card">
      ${metricBar('本幕进度', st.progress)}
      <div class="sd-circle-grid">${getStoryMetrics(st).map((m) => metricCircle(m.label, m.value)).join('')}</div>
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

function renderNoPlan(text = '尚未推演剧情') {
  return `<section class="sd-card sd-plan-card"><div class="sd-empty">${htmlEscape(text)}<p class="sd-muted">前往「审片」页点击推演下一幕</p></div></section>`;
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
  const checked = injectSelection.has(injectId) ? 'checked' : '';
  return `<details class="sd-item-card sd-item-fold" data-acc="item-${htmlEscape(injectId)}">
    <summary>
      <div class="sd-item-summary-main"><h4>${htmlEscape(title)}</h4>${chips ? `<div class="sd-mini-chip-row">${chips}</div>` : ''}</div>
      ${prompt ? `<label class="sd-inject-select-label" title="加入写入队列"><input type="checkbox" class="sd-select-inject" data-text="${htmlEscape(prompt)}" data-id="${htmlEscape(injectId)}" ${checked}></label>` : ''}
    </summary>
    <div class="sd-item-detail">
      <dl>${fields.filter(([, v]) => v !== undefined && v !== '').map(([k, v]) => `<dt>${htmlEscape(k)}</dt><dd>${htmlEscape(v)}</dd>`).join('')}</dl>
      ${prompt ? `<div class="sd-inject-preview"><pre>${htmlEscape(prompt)}</pre></div><div class="sd-button-row"><button class="sd-btn sd-inject" data-text="${htmlEscape(prompt)}"><i class="fa-solid fa-pen-to-square"></i>写入输入框</button></div>` : ''}
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

function templateLibraryCfg() {
  return {
    ns: 'tpl',
    title: '剧本库',
    items: settings.templates || [],
    getName: (t) => t.name,
    getFolder: (t) => t.folder,
    getSearch: () => templateSearch,
    setSearch: (v) => { templateSearch = v; },
    exportMode: templateExportMode,
    selection: templateExportSelection,
    emptyText: '暂无剧本',
    searchPlaceholder: '搜索剧本标题…',
  };
}

function renderBlueprintTab() {
  const store = getChatStore();
  return `
    <section class="sd-card">
      <h3>当前聊天的剧本</h3>
      <textarea class="text_pole sd-textarea sd-blueprint" spellcheck="false">${htmlEscape(store.blueprint || DEFAULT_BLUEPRINT)}</textarea>
      <div class="sd-button-row sd-current-blueprint-actions">
        <button type="button" class="sd-btn sd-save-blueprint">保存当前剧本</button>
        <button type="button" class="sd-btn sd-save-template">保存到剧本库</button>
        <button type="button" class="sd-btn sd-reset-blueprint">恢复默认剧本</button>
      </div>
    </section>
    <section class="sd-card">${renderLibrarySection(templateLibraryCfg())}</section>`;
}



function renderContextTab() {
  const opts = settings.contextOptions;
  const charDesc = getCharacterDescription();
  const userDesc = getPersonaDescription();
  return `
    <details class="sd-accordion" data-acc="acc-base" open>
      <summary><b>基础引用</b><span>勾选后将会作为千幕参考项</span></summary>
      <div class="sd-base-grid">
        <label class="checkbox_label"><input type="checkbox" class="sd-opt" data-key="includeChatHistory" ${opts.includeChatHistory ? 'checked' : ''}> 上下文参考</label>
        <label class="sd-depth-field"><span>参考楼层数</span><input class="text_pole sd-context-depth" type="number" min="1" max="200" value="${htmlEscape(opts.contextDepth || 5)}"></label>
        <label class="checkbox_label sd-span-2"><input type="checkbox" class="sd-opt" data-key="includeCharDesc" ${opts.includeCharDesc ? 'checked' : ''}> 引用当前角色设定 ${infoTag(getCharacterName())}${infoTag(`${estimateTokens(charDesc)} token`)}</label>
        <label class="checkbox_label sd-span-2"><input type="checkbox" class="sd-opt" data-key="includeUserDesc" ${opts.includeUserDesc ? 'checked' : ''}> 引用用户人设 ${infoTag(getPersonaName())}${infoTag(`${estimateTokens(userDesc)} token`)}</label>
      </div>
      <p class="sd-muted sd-base-note">此处勾选与预设中启用「角色设定相关条目」二选其一即可，避免设定重复发送。</p>
    </details>
    <details class="sd-accordion" data-acc="acc-tags" open>
      <summary><b>上下文处理</b><span>标签规则</span></summary>
      <div class="sd-tag-rule-list">${renderTagRules()}</div>
      <div class="sd-button-row"><button type="button" class="sd-btn sd-add-tag-rule"><i class="fa-solid fa-plus"></i>添加标签</button></div>
    </details>
    <details class="sd-accordion" data-acc="acc-presets" open>
      <summary><b>预设</b><span>${contextScanCache.presetScannedAt ? '已读取' : '待读取'}</span></summary>
      <div class="sd-button-row"><button type="button" class="sd-btn sd-refresh-presets"><i class="fa-solid fa-rotate"></i>读取预设</button></div>
      ${renderPresetSourcePanel()}
    </details>
    <details class="sd-accordion" data-acc="acc-worlds" open>
      <summary><b>世界书</b><span>${contextScanCache.worldScannedAt ? '已读取' : '待读取'}</span></summary>
      <div class="sd-button-row"><button type="button" class="sd-btn sd-refresh-worldbooks"><i class="fa-solid fa-rotate"></i>读取世界书</button></div>
      ${renderWorldBookSourcePanel()}
    </details>`;
}

function renderTagRules() {
  const rawRules = Array.isArray(settings.contextOptions.tagRules) ? settings.contextOptions.tagRules : [];
  const list = rawRules.length ? rawRules : [{ name: '', action: 'remove' }];
  return list.map((rule, index) => `<div class="sd-tag-rule-row"><input class="text_pole sd-tag-rule-name" data-index="${index}" placeholder="标签名，如 thinking" value="${htmlEscape(rule.name || '')}"><select class="text_pole sd-tag-rule-action" data-index="${index}"><option value="remove" ${rule.action !== 'extract' ? 'selected' : ''}>屏蔽</option><option value="extract" ${rule.action === 'extract' ? 'selected' : ''}>提取</option></select><button type="button" class="sd-icon-btn sd-delete-tag-rule" data-index="${index}" title="删除"><i class="fa-solid fa-xmark"></i></button></div>`).join('');
}

// 预设：下拉勾选（单选），下方滚动容器呈现所选预设的条目
function renderPresetSourcePanel() {
  const currentName = contextScanCache.currentPresetName || getCurrentPresetName();
  const names = uniqueClean([currentName, ...(contextScanCache.presetNames || listPresetNames())]).filter((name) => !isNoisePresetName(name));
  if (!names.length) return '<p class="sd-muted">未读取到预设。</p>';
  const selected = getSelectedPresetNames().filter((name) => names.includes(name));
  const active = selected[0] || '';
  const headLabel = active || '未选择';
  const rows = names.map((name) => `<label class="sd-source-row"><input type="radio" name="sd-preset-radio" class="sd-pick-preset" data-name="${htmlEscape(name)}" ${name === active ? 'checked' : ''}><span>${htmlEscape(name)}</span>${currentName && name === currentName ? badge('当前使用') : ''}</label>`).join('');
  return `
    <details class="sd-dropdown" data-acc="dd-preset">
      <summary class="sd-dropdown-head"><span>选择预设（单选）</span><b>${htmlEscape(headLabel)}</b></summary>
      <div class="sd-dropdown-body sd-scroll">
        <label class="sd-source-row"><input type="radio" name="sd-preset-radio" class="sd-pick-preset" data-name="" ${active ? '' : 'checked'}><span class="sd-muted">不使用预设</span></label>
        ${rows}
      </div>
    </details>
    ${active ? renderSelectedPresetEntries([active]) : ''}`;
}

function renderSelectedPresetEntries(selectedNames) {
  const rows = [];
  for (const name of selectedNames) {
    const items = contextScanCache.presets?.[name] || getPresetEntries(name);
    (items || []).forEach((item, index) => rows.push(renderContextEntry('preset', name, item, index, selectedNames.length > 1 ? name : '')));
  }
  return `<details class="sd-context-block" data-acc="blk-preset-entries" open><summary><b>预设条目</b><span class="sd-summary-note">建议只开所需条目，避免冲突导致模型左右脑互搏</span></summary><div class="sd-entry-scroll sd-scroll">${rows.join('') || '<p class="sd-muted">暂无条目</p>'}</div></details>`;
}

// 世界书：下拉勾选（多选），下方滚动容器呈现「最后选择」的世界书条目
function renderWorldBookSourcePanel() {
  const boundNames = contextScanCache.boundWorldBookNames || detectBoundWorldBookNames();
  const names = uniqueClean([...boundNames, ...(contextScanCache.worldBookNames || [])]).filter(Boolean);
  if (!names.length) return '<p class="sd-muted">未读取到世界书。</p>';
  const selected = getSelectedWorldBookNames().filter((name) => names.includes(name));
  if (lastWorldView && !selected.includes(lastWorldView)) lastWorldView = '';
  const viewName = lastWorldView || selected[selected.length - 1] || '';
  const rows = names.map((name) => `<label class="sd-source-row"><input type="checkbox" class="sd-toggle-worldbook" data-name="${htmlEscape(name)}" ${selected.includes(name) ? 'checked' : ''}><span>${htmlEscape(name)}</span>${boundNames.includes(name) ? badge('当前绑定') : ''}</label>`).join('');
  return `
    <details class="sd-dropdown" data-acc="dd-world">
      <summary class="sd-dropdown-head"><span>选择世界书（可多选）</span><b>${selected.length} 项</b></summary>
      <div class="sd-dropdown-body sd-scroll">${rows}</div>
    </details>
    ${viewName ? renderSelectedWorldBookEntries([viewName]) : ''}`;
}

function renderSelectedWorldBookEntries(selectedNames) {
  const rows = [];
  for (const name of selectedNames) {
    const items = contextScanCache.worldBooks?.[name] || [];
    (items || []).forEach((item, index) => rows.push(renderContextEntry('world', name, item, index, selectedNames.length > 1 ? name : '')));
  }
  const label = selectedNames.length === 1 ? `世界书条目 · ${selectedNames[0]}` : '世界书条目';
  return `<details class="sd-context-block" data-acc="blk-world-entries" open><summary><b>${htmlEscape(label)}</b></summary><div class="sd-entry-scroll sd-scroll">${rows.join('') || '<p class="sd-muted">暂无条目</p>'}</div></details>`;
}

function renderContextEntry(kind, groupName, item, index, sourceLabel = '') {
  const id = getContextItemId(item, index);
  const title = item.name || item.identifier || item.comment || item.role || (Array.isArray(item.key) ? item.key.join(', ') : item.key) || `条目 ${index + 1}`;
  const content = item.content || item.prompt || item.message || item.text || '';
  const checked = kind === 'preset' ? isPresetItemSelected(groupName, id) : isWorldItemSelected(groupName, id);
  return `<details class="sd-context-item" data-acc="ci-${kind}-${htmlEscape(String(groupName))}-${htmlEscape(String(id))}"><summary><label class="sd-context-entry-label"><input type="checkbox" class="sd-context-check" data-kind="${kind}" data-group="${htmlEscape(groupName)}" data-id="${htmlEscape(String(id))}" ${checked ? 'checked' : ''}><span>${htmlEscape(title)}</span>${sourceLabel ? infoTag(sourceLabel) : ''}</label></summary><pre>${htmlEscape(cleanContextText(content).slice(0, 2000))}</pre></details>`;
}

function renderInjectPreview() {
  const store = getChatStore();
  if (!store?.plan) {
    return '<details class="sd-plain-fold" data-acc="inject-preview"><summary><b>当前注入内容</b></summary><p class="sd-muted">尚无推演结果，暂无可注入的暗线。</p></details>';
  }
  if (!settings.injectEnabled) {
    return '<details class="sd-plain-fold" data-acc="inject-preview"><summary><b>当前注入内容</b></summary><p class="sd-muted">暗线注入已关闭，本次推演结果不会被注入聊天。</p></details>';
  }
  const text = buildPlanDigest(store.plan);
  return `<details class="sd-plain-fold" data-acc="inject-preview">
    <summary><b>当前注入内容</b><span class="sd-summary-note">约 ${estimateTokens(text)} token</span></summary>
    <div class="sd-inject-preview-text">${htmlEscape(text || '（本次推演结果为空）').replace(/\n/g, '<br>')}</div>
  </details>`;
}

function renderDirectorSettingsTab() {
  return `
    <section class="sd-card">
      <h3>刷新</h3>
      <div class="sd-refresh-row">
        <label class="checkbox_label"><input type="checkbox" class="sd-auto-refresh" ${settings.autoRefresh ? 'checked' : ''}> 自动推演剧情</label>
        <label class="sd-floor-refresh"><span>每</span><input class="text_pole sd-auto-every" type="number" min="2" max="50" value="${htmlEscape(settings.autoRefreshEvery || 10)}"><span>层推演</span></label>
      </div>
    </section>
    <section class="sd-card">
      <h3>暗线注入</h3>
      <p class="sd-muted">开启后，每次推演的结果会被提炼成一份「暗线灵感池」，悄悄放进后续聊天里，让模型在合适时机自然取用其中的线索。</p>
      <div class="sd-refresh-row">
        <label class="checkbox_label"><input type="checkbox" class="sd-inject-enabled" ${settings.injectEnabled ? 'checked' : ''}> 启用暗线注入</label>
        <label class="sd-floor-refresh"><span>注入深度</span><input class="text_pole sd-inject-depth" type="number" min="0" max="20" value="${htmlEscape(settings.injectDepth ?? 2)}"></label>
      </div>
      ${renderInjectPreview()}
    </section>
    <section class="sd-card">
      <h3>幕后提示词</h3>
      <textarea class="text_pole sd-textarea sd-system-prompt" spellcheck="false">${htmlEscape(settings.systemPrompt || DEFAULT_SYSTEM_PROMPT)}</textarea>
    </section>
    <section class="sd-card">
      <details class="sd-plain-fold" data-acc="output-schema">
        <summary><b>输出格式</b><span class="sd-summary-note">推演返回的 JSON 结构，一般无需改动</span></summary>
        <textarea class="text_pole sd-textarea sd-output-schema" spellcheck="false">${htmlEscape(settings.outputSchemaText || JSON_SCHEMA_TEXT)}</textarea>
      </details>
      <div class="sd-button-row"><button class="sd-btn sd-save-director-settings">保存幕后</button><button class="sd-btn sd-reset-system">恢复默认</button></div>
    </section>`;
}

const LOG_STATUS_LABELS = { success: '成功', error: '失败', cancelled: '已取消', loading: '生成中', none: '—' };
const LOG_KIND_LABELS = { director: '推演', theater: '小剧场' };

// v0.5.2：日志详情平铺展示，无二级折叠
function renderLogEntry(log, index) {
  const status = log.status || 'none';
  const kindLabel = LOG_KIND_LABELS[log.kind] || '推演';
  return `<details class="sd-log-entry" data-acc="log-${htmlEscape(log.id || String(index))}" ${index === 0 ? 'open' : ''}>
    <summary>
      <span class="sd-log-status ${htmlEscape(status)}">${htmlEscape(LOG_STATUS_LABELS[status] || status)}</span>
      <span class="sd-log-meta">${htmlEscape(log.time || '-')}</span>
      <span class="sd-log-meta">${htmlEscape(log.duration || '')}</span>
      <span class="sd-log-kind sd-log-kind-${htmlEscape(log.kind || 'director')}">${htmlEscape(kindLabel)}</span>
    </summary>
    <div class="sd-log-detail">
      ${log.error ? `<div class="sd-log-cap"><i class="fa-solid fa-triangle-exclamation"></i>失败提示</div><pre class="sd-term sd-term-error">${htmlEscape(log.error)}</pre>` : ''}
      <div class="sd-log-cap"><i class="fa-solid fa-arrow-up"></i>发送${log.request ? infoTag(`约 ${estimateTokens(log.request)} token`) : ''}</div>
      <pre class="sd-term">${htmlEscape(log.request || '暂无')}</pre>
      <div class="sd-log-cap"><i class="fa-solid fa-arrow-down"></i>返回${log.response ? infoTag(`约 ${estimateTokens(log.response)} token`) : ''}</div>
      <pre class="sd-term">${htmlEscape(stripThinkChain(log.response) || (log.response ? '（仅含思维链，已折除）' : '暂无'))}</pre>
    </div>
  </details>`;
}

function renderPlugTab() {
  const isExternal = settings.providerMode === 'external';
  const logs = Array.isArray(settings.logHistory) ? settings.logHistory : [];
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
      <div class="sd-api-profile-row">
        <select class="text_pole sd-api-profile-select"><option value="">选择API预设</option>${profiles.map((profile) => `<option value="${htmlEscape(profile.id)}">${htmlEscape(profile.name || profile.model || '未命名API')}</option>`).join('')}</select>
        <button type="button" class="sd-btn sd-mini-btn sd-load-api-profile">载入</button>
        <button type="button" class="sd-icon-btn sd-danger sd-delete-api-profile" title="删除API预设" aria-label="删除API预设"><i class="fa-solid fa-trash-can"></i></button>
      </div>
      <label>API URL</label><input class="text_pole sd-api-url" placeholder="https://api.example.com/v1" value="${htmlEscape(settings.apiUrl || '')}">
      <label>API Key</label><input class="text_pole sd-api-key" type="password" placeholder="sk-..." value="${htmlEscape(settings.apiKey || '')}">
      <label>模型</label>
      <div class="sd-inline-field"><select class="text_pole sd-model-select"><option value="">选择模型</option>${models.map((m) => `<option value="${htmlEscape(m)}" ${m === settings.model ? 'selected' : ''}>${htmlEscape(m)}</option>`).join('')}</select><button class="sd-btn sd-fetch-models"><i class="fa-solid fa-rotate"></i>拉取模型</button></div>
      <label>Temperature</label><input class="text_pole sd-temperature" type="number" min="0" max="2" step="0.05" value="${htmlEscape(settings.temperature)}">
      <label class="checkbox_label"><input type="checkbox" class="sd-stream-toggle" ${settings.streamEnabled ? 'checked' : ''}> 流式传输</label>
      <div class="sd-button-row"><button class="sd-btn sd-save-api">保存API</button><button class="sd-btn sd-save-api-profile">保存为预设</button></div>
    </section>
    <section class="sd-card">
      <label class="checkbox_label"><input type="checkbox" class="sd-float-toggle" ${settings.floatingButton ? 'checked' : ''}> 显示悬浮球</label>
    </section>
    <section class="sd-card">
      <h3>日志</h3>
      <p class="sd-muted">保留最近 ${LOG_LIMIT} 次生成记录。</p>
      ${logs.length ? `<div class="sd-log-list">${logs.map((log, i) => renderLogEntry(log, i)).join('')}</div>` : '<p class="sd-muted">暂无日志。</p>'}
    </section>`;
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
  bindTheaterTabEvents(root);
  root.querySelectorAll('.sd-generate-main').forEach((el) => el.addEventListener('click', () => generateDirectorPlan()));
  root.querySelectorAll('.sd-stop').forEach((el) => el.addEventListener('click', stopGeneration));
  root.querySelectorAll('.sd-newcomer-toggle').forEach((el) => el.addEventListener('click', () => {
    settings.newcomerMode = !settings.newcomerMode;
    saveSettings();
    root.querySelectorAll('.sd-newcomer-toggle').forEach((btn) => btn.classList.toggle('active', settings.newcomerMode));
    toast(settings.newcomerMode ? '新角入场已开启：下次推演将引入全新角色与世界事件。' : '新角入场已关闭。', 'info');
  }));
  root.querySelectorAll('.sd-inject-badge').forEach((el) => el.addEventListener('click', async () => {
    settings.injectEnabled = !settings.injectEnabled;
    saveSettings();
    await applyDirectorInjection();
    renderModal();
    toast(settings.injectEnabled ? '暗线注入已开启。' : '暗线注入已关闭。', 'info');
  }));
    root.querySelector('.sd-clear-plan')?.addEventListener('click', async () => {
    const yes = await confirmDialog('清空当前推演', '将彻底清除当前推演结果与暗线注入：界面清空、不再注入、也不会并入下次推演提示词。历史记录不受影响，可随时从历史重新载入。确认清空？');
    if (!yes) return;
    const store = getChatStore();
    store.plan = null;
    store.updatedAt = '';
    injectSelection.clear();
    await saveMetadata();
    await applyDirectorInjection();
    toast('当前推演已清空。', 'success');
    renderModal();
  });
  root.querySelectorAll('.sd-count-card').forEach((el) => el.addEventListener('click', () => { activeTab = el.dataset.jump; renderModal(); }));
  root.querySelectorAll('.sd-load-history').forEach((el) => el.addEventListener('click', async () => {
    const record = (getChatStore().history || []).find((x) => x.id === el.dataset.id);
    if (!record?.plan) return;
    getChatStore().plan = clone(record.plan);
    getChatStore().updatedAt = record.createdAt || new Date().toISOString();
    injectSelection.clear();
    await saveMetadata();
    await applyDirectorInjection();
    toast('已载入历史记录。', 'success');
    renderModal();
  }));
  root.querySelectorAll('.sd-delete-history').forEach((el) => el.addEventListener('click', async () => {
    const store = getChatStore();
    // v1.2.1：删除历史记录只移除该条日志，绝不连带清空当前推演（清空交由扫帚按钮）
    store.history = (store.history || []).filter((x) => x.id !== el.dataset.id);
    await saveMetadata();
    toast('历史记录已删除。', 'success');
    renderModal();
  }));
  root.querySelectorAll('.sd-inject').forEach((el) => el.addEventListener('click', () => {
    const ok = injectToInput(el.dataset.text || '');
    toast(ok ? '已写入输入框。' : '未找到输入框。', ok ? 'success' : 'error');
    if (ok) closeModal();
  }));
  // v0.5.2：写入勾选持久化——勾选状态存入 injectSelection，重渲染/切主题不丢失
  root.querySelectorAll('.sd-select-inject').forEach((el) => {
    el.addEventListener('click', (event) => event.stopPropagation());
    el.addEventListener('change', () => {
      if (el.checked) injectSelection.add(el.dataset.id);
      else injectSelection.delete(el.dataset.id);
      updateInjectDock(root);
    });
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
  root.querySelector('.sd-reset-blueprint')?.addEventListener('click', async () => {
    const yes = await confirmDialog('恢复默认剧本', '将当前剧本恢复为默认的自分析通用剧本？当前内容会被覆盖。');
    if (!yes) return;
    getChatStore().blueprint = DEFAULT_BLUEPRINT;
    getChatStore().blueprintEdited = false;
    await saveMetadata();
    toast('已恢复默认剧本。', 'success');
    renderModal();
  });
  root.querySelector('.sd-save-template')?.addEventListener('click', async () => {
    const name = await promptInput('保存到剧本库', '剧本名称：', '我的剧本');
    if (!name) return;
    settings.templates.push({ id: uid('tpl'), name, folder: '', content: root.querySelector('.sd-blueprint')?.value || DEFAULT_BLUEPRINT, createdAt: new Date().toISOString() });
    saveSettings();
    renderModal();
  });

  bindLibraryEvents(root, templateLibraryCfg, {
    onLoad: async (id) => {
      const t = (settings.templates || []).find((x) => x.id === id);
      if (!t) return;
      getChatStore().blueprint = t.content;
      getChatStore().blueprintEdited = true;
      await saveMetadata();
      toast('已载入剧本。', 'success');
      renderModal();
    },
    onEdit: async (id) => {
      const t = (settings.templates || []).find((x) => x.id === id);
      if (!t) return;
      const edited = await promptLibraryEdit({
        dialogTitle: '编辑剧本', nameLabel: '剧本名称', folderLabel: '文件夹', contentLabel: '剧本内容',
        name: t.name, folder: t.folder, content: t.content,
      });
      if (edited === null) return;
      if (!edited.content) return toast('剧本内容不能为空。', 'warning');
      t.name = edited.name || t.name;
      t.folder = edited.folder;
      t.content = edited.content;
      saveSettings();
      toast('剧本已更新。', 'success');
      renderModal();
    },
    onDelete: async (id) => {
      const yes = await confirmDialog('删除剧本', '确认删除这个剧本？');
      if (!yes) return;
      settings.templates = (settings.templates || []).filter((x) => x.id !== id);
      ctx().extensionSettings[MODULE_NAME].templates = settings.templates;
      templateExportSelection.delete(id);
      saveSettings();
      toast('已删除。', 'success');
      renderModal();
    },
    onToggleExport: () => {
      templateExportMode = !templateExportMode;
      if (!templateExportMode) templateExportSelection.clear();
      renderModal();
    },
    onCancelExport: () => {
      templateExportMode = false;
      templateExportSelection.clear();
      renderModal();
    },
    onConfirmExport: () => {
      if (!templateExportSelection.size) return toast('请先勾选要导出的剧本。', 'warning');
      exportTemplates([...templateExportSelection]);
      templateExportMode = false;
      templateExportSelection.clear();
      renderModal();
    },
    onImport: importTemplates,
  });

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
  root.querySelectorAll('.sd-refresh-presets').forEach((el) => el.addEventListener('click', () => refreshPresets(true)));
  root.querySelectorAll('.sd-refresh-worldbooks').forEach((el) => el.addEventListener('click', () => refreshWorldBooks(true)));
  root.querySelectorAll('.sd-pick-preset').forEach((el) => el.addEventListener('change', () => {
    // 单选：先清掉所有已选预设，再选中当前项（空 = 不使用预设）
    for (const name of getSelectedPresetNames()) setPresetNameSelected(name, false);
    if (el.dataset.name) setPresetNameSelected(el.dataset.name, true);
    renderModal();
  }));
  root.querySelectorAll('.sd-toggle-worldbook').forEach((el) => el.addEventListener('change', async () => {
    await setWorldBookNameSelected(el.dataset.name, el.checked);
    lastWorldView = el.checked ? el.dataset.name : '';   // 最后勾选的世界书 = 下方查看项
    renderModal();
  }));
  root.querySelectorAll('.sd-context-check').forEach((el) => {
    el.addEventListener('click', (event) => event.stopPropagation());
    el.addEventListener('change', () => {
      if (el.dataset.kind === 'preset') setPresetItemSelected(el.dataset.group, el.dataset.id, el.checked);
      else setWorldItemSelected(el.dataset.group, el.dataset.id, el.checked);
    });
  });

  root.querySelector('.sd-inject-enabled')?.addEventListener('change', async (e) => {
    settings.injectEnabled = !!e.target.checked;
    saveSettings();
    await applyDirectorInjection();
    toast(settings.injectEnabled ? '暗线注入已开启。' : '暗线注入已关闭。', 'info');
    if (activeTab === 'settings') renderModal();
  });
  root.querySelector('.sd-inject-depth')?.addEventListener('change', async (e) => {
    settings.injectDepth = Math.max(0, Math.min(20, Number(e.target.value ?? 2)));
    saveSettings();
    await applyDirectorInjection();
  });
  root.querySelector('.sd-save-director-settings')?.addEventListener('click', async () => {
    settings.autoRefresh = !!root.querySelector('.sd-auto-refresh')?.checked;
    settings.autoRefreshEvery = Math.max(2, Math.min(50, Number(root.querySelector('.sd-auto-every')?.value || 10)));
    settings.injectEnabled = !!root.querySelector('.sd-inject-enabled')?.checked;
    settings.injectDepth = Math.max(0, Math.min(20, Number(root.querySelector('.sd-inject-depth')?.value ?? 2)));
    settings.systemPrompt = root.querySelector('.sd-system-prompt')?.value || DEFAULT_SYSTEM_PROMPT;
    settings.outputSchemaText = root.querySelector('.sd-output-schema')?.value || JSON_SCHEMA_TEXT;
    // 与默认一致存哈希（未改动，随迭代更新），不一致清空（已 DIY，保留记忆）
    settings.systemPromptHash = settings.systemPrompt === DEFAULT_SYSTEM_PROMPT ? hashText(DEFAULT_SYSTEM_PROMPT) : '';
    settings.outputSchemaHash = settings.outputSchemaText === JSON_SCHEMA_TEXT ? hashText(JSON_SCHEMA_TEXT) : '';
    saveSettings();
    await applyDirectorInjection();
    toast('设置已保存。', 'success');
  });
  root.querySelector('.sd-reset-system')?.addEventListener('click', () => {
    settings.systemPrompt = DEFAULT_SYSTEM_PROMPT;
    settings.outputSchemaText = JSON_SCHEMA_TEXT;
    settings.promptRevision = PROMPT_REVISION;
    settings.systemPromptHash = hashText(DEFAULT_SYSTEM_PROMPT);
    settings.outputSchemaHash = hashText(JSON_SCHEMA_TEXT);
    saveSettings();
    renderModal();
  });

  root.querySelectorAll('input[name="sd-provider"]').forEach((el) => el.addEventListener('change', () => {
    settings.providerMode = el.value;
    saveSettings();
    renderModal();
  }));
  root.querySelector('.sd-float-toggle')?.addEventListener('change', (e) => {
    settings.floatingButton = !!e.target.checked;
    saveSettings();
    renderFloatButton();
    toast(settings.floatingButton ? '悬浮球已显示。' : '悬浮球已隐藏。', 'info');
  });
  root.querySelector('.sd-stream-toggle')?.addEventListener('change', (e) => {
    settings.streamEnabled = !!e.target.checked;
    saveSettings();
    toast(settings.streamEnabled ? '流式传输已开启。' : '流式传输已关闭。', 'info');
  });
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

function exportTemplates(ids = null) {
  const all = settings.templates || [];
  const selectedIds = Array.isArray(ids) ? ids.filter(Boolean) : null;
  const templates = selectedIds?.length ? all.filter((tpl) => selectedIds.includes(tpl.id)) : all;
  if (!templates.length) return toast('请先选择要导出的剧本。', 'warning');
  const blob = new Blob([JSON.stringify({ version: 2, templates }, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `qianmu-blueprints-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
  toast(`已导出 ${templates.length} 个剧本。`, 'success');
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
      settings.templates.push({ id, name: item.name || '导入剧本', folder: sanitizeFolder(item.folder || (Array.isArray(item.tags) ? item.tags[0] : '')), content: item.content, createdAt: item.createdAt || new Date().toISOString() });
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

/* ============================================================
   幕外 · 番外小剧场（完全独立于推演：不写聊天、不注入、不入推演提示词）
   ============================================================ */
function getTheater() {
  if (!isPlainObject(settings.theater)) {
    settings.theater = { instruction: '', apiProfileId: '', presetName: '', presetItems: {}, scripts: [], favorites: [], lastOutput: null };
  }
  const t = settings.theater;
  if (!Array.isArray(t.scripts)) t.scripts = [];
  if (!Array.isArray(t.favorites)) t.favorites = [];
  if (!isPlainObject(t.presetItems)) t.presetItems = {};
  return t;
}

function theaterApiConfig() {
  const t = getTheater();
  const profile = (settings.apiProfiles || []).find((p) => p.id === t.apiProfileId);
  if (profile) return { apiUrl: profile.apiUrl, apiKey: profile.apiKey, model: profile.model, temperature: profile.temperature };
  return null;
}

function isTheaterPresetItemSelected(presetName, itemId) {
  const t = getTheater();
  return !!t.presetItems?.[presetName]?.[String(itemId)];
}

function setTheaterPresetItemSelected(presetName, itemId, selected) {
  const t = getTheater();
  if (!t.presetItems[presetName]) t.presetItems[presetName] = {};
  t.presetItems[presetName][String(itemId)] = selected;
  saveSettings();
}

function initTheaterPresetSelection(presetName) {
  const t = getTheater();
  if (!presetName) return;
  if (!t.presetItems[presetName]) t.presetItems[presetName] = {};
  const entries = contextScanCache.presets?.[presetName] || getPresetEntries(presetName);
  entries.forEach((item, index) => {
    const id = String(getContextItemId(item, index));
    if (typeof t.presetItems[presetName][id] === 'undefined') t.presetItems[presetName][id] = item.enabled !== false;
  });
}

async function buildTheaterPresetText() {
  const t = getTheater();
  const presetName = t.presetName;
  if (!presetName) return '';
  const entries = contextScanCache.presets?.[presetName] || getPresetEntries(presetName);
  let output = '';
  let worldInjected = false;
  for (const [index, item] of (entries || []).entries()) {
    const itemId = getContextItemId(item, index);
    if (!isTheaterPresetItemSelected(presetName, itemId)) continue;
    const title = item.name || item.identifier || item.role || `条目 ${index + 1}`;
    let content = await resolveMacro(item.content || item.prompt || item.message || item.text || '');
    content = processRandomMacros(content);
    if (content) {
      output += `\n【${title}】\n${cleanContextText(content)}\n`;
      continue;
    }
    // v1.2.1：解析空内容的标记条目（角色设定 / 世界书 / 人设等）
    const resolved = await resolvePresetMarker(item);
    if (resolved) {
      if (resolved.isWorld) {
        if (worldInjected) continue;
        worldInjected = true;
      }
      output += `\n【${resolved.title}】\n${resolved.content}\n`;
    }
  }
  return output.trim();
}

// 未读取预设时，默认注入当前聊天设定：角色设定 + 用户人设 + 当前角色绑定的世界书（与预设互斥，避免设定重复发送）
async function buildTheaterDefaultText() {
  let output = '';
  const charDesc = cleanContextText(await resolveMacro(getCharacterDescription()));
  if (charDesc) output += `\n【当前角色设定】\n${getCharacterName()}\n${charDesc}\n`;
  const userDesc = cleanContextText(await resolveMacro(getPersonaDescription()));
  if (userDesc) output += `\n【用户人设】\n${getPersonaName()}\n${userDesc}\n`;
  const worldText = await buildBoundWorldText();
  if (worldText) output += `\n【世界书】\n${worldText}\n`;
  return output.trim();
}

function looksLikeHtml(text) {
  return /<\s*(html|body|div|section|article|table|canvas|svg|style|script|button|input|h[1-6]|p|ul|ol|img|iframe)\b/i.test(String(text || ''));
}

function isTheaterFavorited(id) {
  return getTheater().favorites.some((f) => f.id === id);
}

function theaterScriptLibraryCfg() {
  const t = getTheater();
  return {
    ns: 'script',
    title: '剧札',
    items: t.scripts || [],
    getName: (s) => s.title,
    getFolder: (s) => s.folder,
    getSearch: () => String(t.scriptSearch || ''),
    setSearch: (v) => { getTheater().scriptSearch = v; },
    exportMode: theaterExportMode,
    selection: theaterExportSelection,
    emptyText: '剧札空空，写一幕番外吧',
    searchPlaceholder: '搜索剧札标题…',
  };
}

function renderTheaterTab() {
  if (theaterView?.mode === 'read') return renderTheaterReadView(theaterView.scene);
  if (theaterView?.mode === 'favorites') return renderTheaterFavoritesView();
  const t = getTheater();
  const profiles = Array.isArray(settings.apiProfiles) ? settings.apiProfiles : [];
  const presetNames = uniqueClean([t.presetName, getCurrentPresetName(), ...(contextScanCache.presetNames || listPresetNames())]).filter((n) => !isNoisePresetName(n));
  if (t.presetName) initTheaterPresetSelection(t.presetName);
  const out = t.lastOutput;
  return `
    <section class="sd-card">
      <h3>番外小剧场栏目组</h3>
      <label>API</label>
      <div class="sd-inline-field">
        <select class="text_pole sd-theater-api-select">
          <option value="">跟随当前 API 设置</option>
          ${profiles.map((p) => `<option value="${htmlEscape(p.id)}" ${p.id === t.apiProfileId ? 'selected' : ''}>${htmlEscape(p.name || p.model || '未命名API')}</option>`).join('')}
        </select>
      </div>
      <label>预设</label>
      <div class="sd-inline-field">
        <select class="text_pole sd-theater-preset-select">
          <option value="">无</option>
          ${presetNames.map((n) => `<option value="${htmlEscape(n)}" ${n === t.presetName ? 'selected' : ''}>${htmlEscape(n)}</option>`).join('')}
        </select>
        <button type="button" class="sd-btn sd-mini-btn sd-theater-refresh-preset"><i class="fa-solid fa-rotate"></i>读取</button>
      </div>
      ${t.presetName
        ? renderTheaterPresetEntries(t.presetName)
        : '<p class="sd-muted sd-inject-hint">未载入预设时，默认注入当前聊天设定；读取预设后将改用预设条目，两者互斥</p>'}
      <label>此幕指令</label>
      <textarea class="text_pole sd-textarea sd-theater-instruction" spellcheck="false" placeholder="${htmlEscape(THEATER_INSTRUCTION_PLACEHOLDER)}">${htmlEscape(t.instruction || '')}</textarea>
      <div class="sd-button-row">
        <button class="sd-btn sd-primary sd-theater-stage"><i class="fa-solid fa-masks-theater"></i>上演此幕</button>
        <button class="sd-btn sd-theater-save-script"><i class="fa-solid fa-bookmark"></i>保存到剧札</button>
        <button class="sd-btn sd-icon-btn sd-theater-open-favorites" title="收藏夹 (${t.favorites.length})" aria-label="收藏夹"><i class="fa-solid fa-star"></i></button>
        ${busy ? '<button class="sd-btn sd-stop"><i class="fa-solid fa-stop"></i>停止</button>' : ''}
      </div>
      ${out ? `<div class="sd-theater-latest sd-button-row">
        <span class="sd-muted">最近一幕：${htmlEscape(snip(out.title || out.instruction || '番外', 24))}</span>
        <button class="sd-btn sd-mini-btn sd-theater-open-latest"><i class="fa-solid fa-book-open"></i>阅读</button>
      </div>` : ''}
    </section>
    <section class="sd-card">${renderLibrarySection(theaterScriptLibraryCfg())}</section>`;
}

function renderTheaterReadView(scene) {
  if (!scene) { theaterView = null; return renderTheaterTab(); }
  const fav = isTheaterFavorited(scene.id) || getTheater().favorites.some((f) => f.content === scene.content);
  const cleaned = stripThinkChain(scene.content);
  const bodyHtml = scene.isHtml
    ? `<iframe class="sd-reader-frame" sandbox="allow-scripts allow-popups allow-forms" srcdoc="${htmlEscape(cleaned)}"></iframe>`
    : `<div class="sd-reader-prose">${htmlEscape(cleaned).replace(/\n/g, '<br>')}</div>`;
  return `
    <section class="sd-card sd-reader-card">
      <div class="sd-reader-bar">
        <button class="sd-btn sd-mini-btn sd-theater-reader-back"><i class="fa-solid fa-arrow-left"></i>返回</button>
        <h3>${htmlEscape(scene.title || '番外小剧场')}</h3>
        <button class="sd-icon-btn sd-theater-reader-fav" title="收藏"><i class="${fav ? 'fa-solid fa-star sd-fav-on' : 'fa-regular fa-star'}"></i></button>
      </div>
      ${bodyHtml}
    </section>`;
}

function renderTheaterFavoritesView() {
  const t = getTheater();
  const rows = t.favorites.length
    ? t.favorites.map((f) => `<article class="sd-lib-row"><div class="sd-lib-main"><h4>${htmlEscape(f.title || '番外')}</h4></div>
      <div class="sd-lib-actions">
        <button type="button" class="sd-btn sd-lib-load sd-fav-read" data-id="${htmlEscape(f.id)}">阅读</button>
        <button type="button" class="sd-icon-btn sd-icon-sm sd-danger sd-fav-remove" data-id="${htmlEscape(f.id)}" title="移出收藏"><i class="fa-solid fa-star-half-stroke"></i></button>
      </div></article>`).join('')
    : '<p class="sd-muted">收藏夹还空着。</p>';
  return `
    <section class="sd-card sd-reader-card">
      <div class="sd-reader-bar">
        <button class="sd-btn sd-mini-btn sd-theater-reader-back"><i class="fa-solid fa-arrow-left"></i>返回</button>
        <h3>收藏夹</h3>
        <span></span>
      </div>
      <div class="sd-lib-list sd-scroll" style="padding:4px 2px">${rows}</div>
    </section>`;
}

function renderTheaterPresetEntries(presetName) {
  const entries = contextScanCache.presets?.[presetName] || getPresetEntries(presetName);
  if (!entries.length) return '<p class="sd-muted" style="margin:8px 0">未读取到该预设条目，点「读取」试试。</p>';
  const rows = entries.map((item, index) => {
    const id = getContextItemId(item, index);
    const title = item.name || item.identifier || item.role || `条目 ${index + 1}`;
    const checked = isTheaterPresetItemSelected(presetName, id) ? 'checked' : '';
    return `<label class="sd-source-row"><input type="checkbox" class="sd-theater-preset-item" data-id="${htmlEscape(String(id))}" ${checked}><span>${htmlEscape(title)}</span></label>`;
  }).join('');
  return `<details class="sd-context-block" data-acc="theater-preset-entries" open><summary><b>预设条目</b></summary><div class="sd-source-list sd-entry-scroll sd-scroll">${rows}</div></details>`;
}

async function stageTheaterScene() {
  if (!settings.enabled) return toast('千幕已关闭。', 'warning');
  if (busy) return;
  const t = getTheater();
  const instruction = String(t.instruction || '').trim();
  if (!instruction) return toast('请先写下此幕指令。', 'warning');
  const cfg = theaterApiConfig();
  const useExternal = settings.providerMode === 'external' || cfg;
  if (useExternal) {
    const eff = cfg || { apiUrl: settings.apiUrl, apiKey: settings.apiKey, model: settings.model };
    if (!(normalizeUrl(eff.apiUrl) && eff.apiKey && eff.model)) { apiToast(); return; }
  } else if (typeof ctx().generateRaw !== 'function') {
    apiToast();
    return;
  }
  busy = true;
  cancelRequested = false;
  renderBusyState();
  const startedAt = Date.now();
  const log = pushLog({ id: uid('log'), kind: 'theater', status: 'loading', time: new Date().toLocaleString(), duration: '', request: '', response: '', error: '' });
  try {
    const presetText = await buildTheaterPresetText();
    const segments = [];
    if (presetText) {
      segments.push(presetText);
    } else {
      const defaultText = await buildTheaterDefaultText();
      if (defaultText) segments.push(defaultText);
    }
    segments.push(`【此幕指令】\n${await resolveMacro(instruction)}`);
    const userPrompt = segments.join('\n\n');
    const messages = [{ role: 'user', content: userPrompt }];
    log.request = clipLog(JSON.stringify(messages, null, 2));
    saveSettings();

    const onDelta = settings.streamEnabled ? makeStreamLogUpdater(log) : null;
    const raw = (settings.providerMode === 'sillytavern' && !cfg)
      ? await callSillyTavernModel(messages)
      : await callExternalApi(messages, onDelta, cfg);
    if (cancelRequested) throw new Error('USER_CANCELLED');
    const content = String(raw || '').trim();
    log.response = clipLog(content);
    if (!content) throw new Error('模型返回为空');
    t.lastOutput = { id: uid('scene'), title: snip(instruction, 24), instruction, content, isHtml: looksLikeHtml(stripThinkChain(content)), createdAt: new Date().toISOString() };
    log.status = 'success';
    log.duration = `${((Date.now() - startedAt) / 1000).toFixed(1)}s`;
    saveSettings();
    toast('番外已落幕，静候开卷。', 'success');
    if (activeTab === 'theater') renderModal();
    openTheaterReader(t.lastOutput);
  } catch (error) {
    const msg = error?.name === 'AbortError' ? 'USER_CANCELLED' : (error?.message || String(error));
    log.status = msg === 'USER_CANCELLED' ? 'cancelled' : 'error';
    log.error = msg === 'INVALID_API_SETTINGS' ? '请检查API设置' : msg === 'USER_CANCELLED' ? '已取消生成' : msg;
    log.duration = `${((Date.now() - startedAt) / 1000).toFixed(1)}s`;
    saveSettings();
    if (msg === 'USER_CANCELLED') toast('已取消生成。', 'warning');
    else if (msg === 'INVALID_API_SETTINGS') apiToast();
    else toast(`上演失败：${log.error}`, 'error');
  } finally {
    abortController = null;
    cancelRequested = false;
    busy = false;
    if (activeTab === 'theater') renderModal();
    renderFloatButton();
  }
}

function stripThinkChain(text) {
  return String(text || '')
    .replace(/<think(?:ing)?\b[^>]*>[\s\S]*?<\/think(?:ing)?>/gi, '')
    .replace(/<think(?:ing)?\b[^>]*>[\s\S]*$/i, '')
    .trim();
}

function openTheaterReader(scene) {
  if (!scene) return;
  theaterView = { mode: 'read', scene };
  activeTab = 'theater';
  renderModal();
}

function toggleTheaterFavorite(scene) {
  const t = getTheater();
  const exists = t.favorites.find((f) => f.id === scene.id);
  if (exists) {
    t.favorites = t.favorites.filter((f) => f.id !== scene.id);
    toast('已取消收藏。', 'info');
  } else {
    t.favorites.unshift({ id: scene.id, title: scene.title, instruction: scene.instruction, content: scene.content, isHtml: scene.isHtml, createdAt: scene.createdAt || new Date().toISOString() });
    t.favorites = t.favorites.slice(0, 50);
    toast('已收藏这一幕。', 'success');
  }
  saveSettings();
}

function openTheaterFavorites() {
  theaterView = { mode: 'favorites' };
  activeTab = 'theater';
  renderModal();
}

function bindTheaterTabEvents(root) {
  // 阅读 / 收藏夹 内嵌视图
  if (theaterView) {
    root.querySelector('.sd-theater-reader-back')?.addEventListener('click', () => { theaterView = null; renderModal(); });
    if (theaterView.mode === 'read') {
      const scene = theaterView.scene;
      root.querySelector('.sd-theater-reader-fav')?.addEventListener('click', () => {
        toggleTheaterFavorite(scene);
        const icon = root.querySelector('.sd-theater-reader-fav i');
        if (icon) icon.className = isTheaterFavorited(scene.id) ? 'fa-solid fa-star sd-fav-on' : 'fa-regular fa-star';
      });
    } else if (theaterView.mode === 'favorites') {
      root.querySelectorAll('.sd-fav-read').forEach((el) => el.addEventListener('click', () => {
        const f = getTheater().favorites.find((x) => x.id === el.dataset.id);
        if (f) openTheaterReader(f);
      }));
      root.querySelectorAll('.sd-fav-remove').forEach((el) => el.addEventListener('click', () => {
        const t = getTheater();
        t.favorites = t.favorites.filter((x) => x.id !== el.dataset.id);
        saveSettings();
        renderModal();
      }));
    }
    return;
  }
  root.querySelector('.sd-theater-api-select')?.addEventListener('change', (e) => {
    getTheater().apiProfileId = e.target.value || '';
    saveSettings();
  });
  root.querySelector('.sd-theater-preset-select')?.addEventListener('change', async (e) => {
    const t = getTheater();
    t.presetName = e.target.value || '';
    if (t.presetName && !contextScanCache.presets?.[t.presetName]) {
      contextScanCache.presets[t.presetName] = getPresetEntries(t.presetName);
    }
    initTheaterPresetSelection(t.presetName);
    saveSettings();
    renderModal();
  });
  root.querySelector('.sd-theater-refresh-preset')?.addEventListener('click', async () => {
    await refreshPresets(false);
    const t = getTheater();
    if (t.presetName) {
      contextScanCache.presets[t.presetName] = getPresetEntries(t.presetName);
      initTheaterPresetSelection(t.presetName);
    }
    toast('预设已读取。', 'success');
    renderModal();
  });
  root.querySelectorAll('.sd-theater-preset-item').forEach((el) => {
    el.addEventListener('click', (event) => event.stopPropagation());
    el.addEventListener('change', () => setTheaterPresetItemSelected(getTheater().presetName, el.dataset.id, el.checked));
  });
  root.querySelector('.sd-theater-instruction')?.addEventListener('change', (e) => {
    getTheater().instruction = e.target.value || '';
    saveSettings();
  });
  root.querySelector('.sd-theater-stage')?.addEventListener('click', () => {
    const ta = root.querySelector('.sd-theater-instruction');
    if (ta) { getTheater().instruction = ta.value || ''; saveSettings(); }
    stageTheaterScene();
  });
  root.querySelector('.sd-theater-save-script')?.addEventListener('click', async () => {
    const ta = root.querySelector('.sd-theater-instruction');
    const instruction = String(ta?.value || getTheater().instruction || '').trim();
    if (!instruction) return toast('请先写下此幕指令。', 'warning');
    const name = await promptInput('保存到剧札', '为这套剧场指令取个名字：', snip(instruction, 16));
    if (!name) return;
    const t = getTheater();
    t.scripts.unshift({ id: uid('script'), title: name, folder: '', instruction, createdAt: new Date().toISOString() });
    t.scripts = t.scripts.slice(0, 50);
    saveSettings();
    toast('已存入剧札。', 'success');
    renderModal();
  });
  root.querySelector('.sd-theater-open-latest')?.addEventListener('click', () => openTheaterReader(getTheater().lastOutput));
  root.querySelector('.sd-theater-open-favorites')?.addEventListener('click', openTheaterFavorites);

  bindLibraryEvents(root, theaterScriptLibraryCfg, {
    onLoad: (id) => {
      const s = getTheater().scripts.find((x) => x.id === id);
      if (!s) return;
      const t = getTheater();
      t.instruction = s.instruction || '';
      saveSettings();
      const ta = root.querySelector('.sd-theater-instruction');
      if (ta) ta.value = t.instruction;
      toast('已载入到此幕指令。', 'success');
    },
    onEdit: async (id) => {
      const t = getTheater();
      const s = t.scripts.find((x) => x.id === id);
      if (!s) return;
      const edited = await promptLibraryEdit({
        dialogTitle: '编辑剧札', nameLabel: '剧札标题', folderLabel: '文件夹', contentLabel: '剧场指令',
        name: s.title, folder: s.folder, content: s.instruction,
      });
      if (edited === null) return;
      if (!edited.content) return toast('剧场指令不能为空。', 'warning');
      s.title = edited.name || s.title;
      s.folder = edited.folder;
      s.instruction = edited.content;
      saveSettings();
      toast('剧札已更新。', 'success');
      renderModal();
    },
    onDelete: async (id) => {
      const yes = await confirmDialog('删除剧札', '确认删除这套剧场指令？');
      if (!yes) return;
      const t = getTheater();
      t.scripts = t.scripts.filter((x) => x.id !== id);
      theaterExportSelection.delete(id);
      saveSettings();
      toast('已删除。', 'success');
      renderModal();
    },
    onToggleExport: () => {
      theaterExportMode = !theaterExportMode;
      if (!theaterExportMode) theaterExportSelection.clear();
      renderModal();
    },
    onCancelExport: () => {
      theaterExportMode = false;
      theaterExportSelection.clear();
      renderModal();
    },
    onConfirmExport: () => {
      if (!theaterExportSelection.size) return toast('请先勾选要导出的剧札。', 'warning');
      exportTheaterScripts([...theaterExportSelection]);
      theaterExportMode = false;
      theaterExportSelection.clear();
      renderModal();
    },
    onImport: importTheaterScripts,
  });
}

function exportTheaterScripts(ids = null) {
  const all = getTheater().scripts || [];
  const selectedIds = Array.isArray(ids) ? ids.filter(Boolean) : null;
  const scripts = selectedIds?.length ? all.filter((s) => selectedIds.includes(s.id)) : all;
  if (!scripts.length) return toast('请先选择要导出的剧札。', 'warning');
  const blob = new Blob([JSON.stringify({ version: 1, type: 'theater-scripts', scripts }, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `qianmu-scripts-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
  toast(`已导出 ${scripts.length} 篇剧札。`, 'success');
}

async function importTheaterScripts(event) {
  const file = event.target.files?.[0];
  if (!file) return;
  try {
    const text = await file.text();
    const data = JSON.parse(text);
    const incoming = Array.isArray(data) ? data : (data.scripts || data.templates);
    if (!Array.isArray(incoming)) throw new Error('没有找到剧札数组。');
    const t = getTheater();
    for (const item of incoming) {
      const instruction = item?.instruction || item?.content;
      if (!instruction) continue;
      const id = item.id && !t.scripts.some((s) => s.id === item.id) ? item.id : uid('script');
      t.scripts.unshift({ id, title: item.title || item.name || '导入剧札', folder: sanitizeFolder(item.folder), instruction, createdAt: item.createdAt || new Date().toISOString() });
    }
    t.scripts = t.scripts.slice(0, 50);
    saveSettings();
    toast('剧札已导入。', 'success');
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
    entry.className = 'list-group-item flex-container flexGap5 interactable story-director-input-entry';
    entry.tabIndex = 0;
    entry.innerHTML = `<div class="fa-solid fa-clapperboard extensionsMenuExtensionButton"></div><span>${EXTENSION_NAME}</span>`;
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
  button.title = EXTENSION_NAME;
  button.innerHTML = '<i class="fa-solid fa-clapperboard"></i>';
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
    } catch (error) {
      console.warn(`[${MODULE_NAME}] auto refresh handler failed`, error);
    }
  };
  const rerenderHandler = async () => {
    settings = getSettings();
    injectSelection.clear();   // v0.5.2：切换聊天后旧写入勾选失效
    renderFloatButton();
    renderInputMenuEntry();
    await applyDirectorInjection();
    rerenderIfOpen();
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
  applyDirectorInjection();
  console.log(`[${EXTENSION_NAME}] v${VERSION} loaded`);
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
  clearDirectorInjection();
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
