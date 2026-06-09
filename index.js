// Story Director / 剧情导演
// A SillyTavern third-party UI extension.

const MODULE_NAME = 'story_director_liminale';
const EXTENSION_NAME = 'Story Director / 剧情导演';
const SETTINGS_PANEL_ID = 'story-director-settings';
const MODAL_ID = 'story-director-modal';
const FLOAT_ID = 'story-director-float';

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

【导演特别说明】
这里可以写任意基础剧情构思。插件会要求AI统一输出固定JSON格式，方便前端展示。`;

const DEFAULT_SYSTEM_PROMPT = `你是一名 SillyTavern 角色扮演专用的“剧情导演 + 系统助手”。
你的任务不是替玩家强制安排每小时日程，而是根据已有对话、角色设定、玩家写入的剧本方案和扩展设定，生成可灵活推进的剧情规划、任务发布、剧情节点、NPC动态和世界变化。

核心原则：
1. 不要把剧情写成死板日程表；以“阶段、任务、触发节点、NPC自主行动、世界变化”为主。
2. 尊重当前对话事实，不得推翻已发生剧情，不得强行改变角色人设。
3. 任务要可选、可延后、可被玩家自由采用；不要替玩家决定唯一行动。
4. NPC必须有独立目标和下一步行动，让世界即使玩家暂时不干预也会推进。
5. 输出必须是一个JSON对象，不要Markdown，不要代码块，不要解释文本。
6. 所有数组字段都可以为空数组，但字段名必须完整保留。
7. 每个可写入输入框的项目都要给出 inject_prompt，用于玩家一键塞入输入框继续推进。inject_prompt 要用玩家可直接发送给角色的口吻，避免泄露“这是插件生成”的元信息。`;

const JSON_SCHEMA_TEXT = `必须严格输出如下JSON对象结构：
{
  "schema_version": "1.0",
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
  providerMode: 'external', // external | sillytavern
  apiUrl: '',
  apiKey: '',
  model: '',
  availableModels: [],
  temperature: 0.75,
  maxContextMessages: 30,
  autoRefresh: false,
  autoRefreshEvery: 10,
  floatingButton: true,
  systemPrompt: DEFAULT_SYSTEM_PROMPT,
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
    includeCharDesc: true,
    includeUserDesc: false,
    removeHtmlComments: true,
    manualContext: '',
    presetNames: '',
    worldBookNames: '',
  },
  selectedPresetItems: {},
  selectedWorldBookItemsByChat: {},
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
let contextScanCache = { presets: {}, worldBooks: {} };
let busy = false;
let abortController = null;
let initialized = false;

function ctx() {
  return globalThis.SillyTavern?.getContext?.() || {};
}

function clone(value) {
  if (typeof structuredClone === 'function') return structuredClone(value);
  return JSON.parse(JSON.stringify(value));
}

function getSettings() {
  const context = ctx();
  const extensionSettings = context.extensionSettings || (context.extensionSettings = {});
  if (!extensionSettings[MODULE_NAME]) {
    extensionSettings[MODULE_NAME] = clone(DEFAULT_SETTINGS);
  }
  const s = extensionSettings[MODULE_NAME];
  mergeDefaults(s, DEFAULT_SETTINGS);
  return s;
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

function isPlainObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value);
}

function saveSettings() {
  ctx().saveSettingsDebounced?.();
}

async function saveMetadata() {
  if (typeof ctx().saveMetadata === 'function') {
    await ctx().saveMetadata();
  }
}

function getChatKey() {
  const context = ctx();
  return context.chatId || context.groupId || String(context.characterId ?? 'default');
}

function getChatStore() {
  const context = ctx();
  const meta = context.chatMetadata || {};
  if (!meta[MODULE_NAME]) {
    meta[MODULE_NAME] = {
      blueprint: DEFAULT_BLUEPRINT,
      plan: null,
      messageCounter: 0,
      updatedAt: '',
    };
  }
  mergeDefaults(meta[MODULE_NAME], {
    blueprint: DEFAULT_BLUEPRINT,
    plan: null,
    messageCounter: 0,
    updatedAt: '',
  });
  return meta[MODULE_NAME];
}

function htmlEscape(input) {
  return String(input ?? '').replace(/[&<>"']/g, (m) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
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

function getCharacterName() {
  const context = ctx();
  if (context.groupId && context.groups?.length) {
    const group = context.groups.find((g) => g.id === context.groupId);
    return group?.name || '当前群聊';
  }
  const ch = context.characters?.[context.characterId];
  return ch?.name || context.name2 || '<char>';
}

function getChatHistoryText() {
  const context = ctx();
  const chat = Array.isArray(context.chat) ? context.chat : [];
  const max = Math.max(1, Number(settings.maxContextMessages || 30));
  const recent = chat.slice(-max);
  return recent.map((m) => {
    const role = m.is_user ? '<user>' : (m.name || '<char>');
    const text = cleanContextText(m.mes || '');
    return `${role}: ${text}`;
  }).join('\n');
}

function cleanContextText(text) {
  let value = String(text || '');
  if (settings.contextOptions.removeHtmlComments) {
    value = value.replace(/<!--[\s\S]*?-->/g, '');
  }
  return value.replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
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

function parseNameList(text) {
  return String(text || '').split(/[\n,，]/).map((x) => x.trim()).filter(Boolean);
}

function getPresetEntries(name) {
  try {
    const preset = globalThis.TavernHelper?.getPreset?.(name);
    if (preset && Array.isArray(preset.prompts)) return preset.prompts;
  } catch (error) {
    console.warn(`[${MODULE_NAME}] get preset failed`, name, error);
  }
  return [];
}

async function getWorldBookEntries(name) {
  try {
    if (typeof globalThis.TavernHelper?.getWorldbook === 'function') {
      const wb = await globalThis.TavernHelper.getWorldbook(name);
      if (wb) return Array.isArray(wb) ? wb : Object.values(wb.entries || wb);
    }
  } catch (error) {
    console.warn(`[${MODULE_NAME}] TavernHelper worldbook failed`, name, error);
  }
  try {
    if (typeof globalThis.getWorldbook === 'function') {
      const wb = await globalThis.getWorldbook(name);
      if (wb) return Array.isArray(wb) ? wb : Object.values(wb.entries || wb);
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
    if (res.ok) {
      const data = await res.json();
      if (data.entries) return Object.values(data.entries);
      if (data[name]?.entries) return Object.values(data[name].entries);
      return Array.isArray(data) ? data : Object.values(data || {});
    }
  } catch (error) {
    console.warn(`[${MODULE_NAME}] worldinfo endpoint failed`, name, error);
  }
  return [];
}

async function scanExtendedContext() {
  contextScanCache = { presets: {}, worldBooks: {} };
  for (const name of parseNameList(settings.contextOptions.presetNames)) {
    contextScanCache.presets[name] = getPresetEntries(name);
  }
  for (const name of parseNameList(settings.contextOptions.worldBookNames)) {
    contextScanCache.worldBooks[name] = await getWorldBookEntries(name);
  }
  toast('扩展设定已扫描。', 'success');
  renderModal();
}

function getWorldSelectionStore() {
  const chatKey = getChatKey();
  if (!settings.selectedWorldBookItemsByChat[chatKey]) {
    settings.selectedWorldBookItemsByChat[chatKey] = {};
  }
  return settings.selectedWorldBookItemsByChat[chatKey];
}

function isPresetItemSelected(presetName, itemId) {
  return !!settings.selectedPresetItems?.[presetName]?.[String(itemId)];
}

function setPresetItemSelected(presetName, itemId, selected) {
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

async function buildExtraContextText() {
  let output = '';
  if (settings.contextOptions.includeCharDesc) {
    const desc = await resolveMacro(getCharacterDescription());
    if (desc) output += `\n【当前角色设定】\n${cleanContextText(desc)}\n`;
  }
  if (settings.contextOptions.includeUserDesc) {
    const desc = await resolveMacro(getPersonaDescription());
    if (desc) output += `\n【玩家人设】\n${cleanContextText(desc)}\n`;
  }
  if (settings.contextOptions.manualContext?.trim()) {
    output += `\n【手写扩展设定】\n${settings.contextOptions.manualContext.trim()}\n`;
  }

  for (const [presetName, entries] of Object.entries(contextScanCache.presets || {})) {
    for (const item of entries || []) {
      const itemId = item.id ?? item.identifier ?? item.name ?? item.role ?? JSON.stringify(item).slice(0, 24);
      if (!isPresetItemSelected(presetName, itemId)) continue;
      const title = item.name || item.identifier || item.role || '未命名预设条目';
      let content = await resolveMacro(item.content || item.message || item.text || '');
      content = processRandomMacros(content);
      if (content) output += `\n【预设规则 - ${presetName}: ${title}】\n${cleanContextText(content)}\n`;
    }
  }

  const wbStore = getWorldSelectionStore();
  for (const [wbName, entries] of Object.entries(contextScanCache.worldBooks || {})) {
    for (const item of entries || []) {
      const itemId = item.uid ?? item.id ?? item.name ?? item.comment ?? JSON.stringify(item).slice(0, 24);
      if (!wbStore?.[wbName]?.[String(itemId)]) continue;
      const title = item.name || item.comment || (Array.isArray(item.key) ? item.key.join(', ') : item.key) || '未命名世界书条目';
      let content = await resolveMacro(item.content || item.text || '');
      content = processRandomMacros(content);
      if (content) output += `\n【世界书背景 - ${wbName}: ${title}】\n${cleanContextText(content)}\n`;
    }
  }
  return output.trim();
}

async function buildPrompt() {
  const store = getChatStore();
  const pieces = [];
  pieces.push(`【当前对象】\n角色/群聊：${getCharacterName()}\n`);
  pieces.push(`【玩家写入的剧本方案】\n${store.blueprint || DEFAULT_BLUEPRINT}\n`);
  if (settings.contextOptions.includeChatHistory) {
    pieces.push(`【近期对话记录】\n${getChatHistoryText() || '暂无对话记录'}\n`);
  }
  const extra = await buildExtraContextText();
  if (extra) pieces.push(`【扩展设定】\n${extra}\n`);
  if (store.plan) {
    pieces.push(`【上一次剧情导演状态】\n${JSON.stringify(store.plan, null, 2)}\n`);
  }
  pieces.push(JSON_SCHEMA_TEXT);
  pieces.push('请只输出JSON对象。不要输出Markdown代码块。所有百分比数值范围为0-100。请确保每条任务、剧情节点、NPC动态、世界变化都适合当前故事，并保留玩家选择自由。');
  return pieces.join('\n\n');
}

async function callExternalApi(messages) {
  const base = normalizeUrl(settings.apiUrl);
  if (!base || !settings.apiKey || !settings.model) {
    throw new Error('请先在 API 页填写 API URL、API Key 和模型名，或切换为“使用 SillyTavern 当前模型”。');
  }
  abortController = new AbortController();
  const body = {
    model: settings.model,
    messages,
    temperature: Number(settings.temperature || 0.75),
    stream: false,
  };
  const res = await fetch(`${base}/v1/chat/completions`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${settings.apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
    signal: abortController.signal,
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`API 请求失败：HTTP ${res.status}${text ? `，${text.slice(0, 300)}` : ''}`);
  }
  const data = await res.json();
  return data.choices?.[0]?.message?.content || data.choices?.[0]?.text || '';
}

async function callSillyTavernModel(messages) {
  const context = ctx();
  if (typeof context.generateRaw !== 'function') {
    throw new Error('当前 SillyTavern 版本没有暴露 generateRaw，请改用外置 OpenAI-Compatible API。');
  }
  return await context.generateRaw({
    prompt: messages,
    systemPrompt: settings.systemPrompt,
  });
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
    schema_version: '1.0',
    story_status: {
      title: '当前故事', current_arc: '', current_stage: '', cycle: '', progress: 0,
      tension: 0, romance: 0, mystery: 0, danger: 0, mood: '', summary: '',
    },
    quests: [], story_nodes: [], npc_updates: [], world_updates: [],
    director_comment: '', next_refresh_hint: '',
  };
  mergeDefaults(plan, base);
  plan.quests = Array.isArray(plan.quests) ? plan.quests : [];
  plan.story_nodes = Array.isArray(plan.story_nodes) ? plan.story_nodes : [];
  plan.npc_updates = Array.isArray(plan.npc_updates) ? plan.npc_updates : [];
  plan.world_updates = Array.isArray(plan.world_updates) ? plan.world_updates : [];
  return plan;
}

async function generateDirectorPlan(showSuccessToast = true) {
  if (busy) return;
  busy = true;
  renderBusyState();
  const startedAt = Date.now();
  const userPrompt = await buildPrompt();
  const messages = [
    { role: 'system', content: settings.systemPrompt || DEFAULT_SYSTEM_PROMPT },
    { role: 'user', content: userPrompt },
  ];
  settings.lastLog = {
    status: 'loading',
    time: new Date().toLocaleString(),
    duration: '',
    request: JSON.stringify(messages, null, 2),
    response: '',
    error: '',
  };
  saveSettings();

  try {
    const raw = settings.providerMode === 'sillytavern'
      ? await callSillyTavernModel(messages)
      : await callExternalApi(messages);
    settings.lastLog.response = raw;
    const plan = normalizePlan(extractJson(raw));
    const store = getChatStore();
    store.plan = plan;
    store.updatedAt = new Date().toISOString();
    store.messageCounter = 0;
    await saveMetadata();
    settings.lastLog.status = 'success';
    settings.lastLog.duration = `${((Date.now() - startedAt) / 1000).toFixed(1)}s`;
    saveSettings();
    if (showSuccessToast) toast('剧情导演已更新。', 'success');
  } catch (error) {
    settings.lastLog.status = 'error';
    settings.lastLog.error = error?.message || String(error);
    settings.lastLog.duration = `${((Date.now() - startedAt) / 1000).toFixed(1)}s`;
    saveSettings();
    toast(`生成失败：${settings.lastLog.error}`, 'error');
  } finally {
    abortController = null;
    busy = false;
    renderModal();
    renderSettingsPanel();
  }
}

async function fetchModels() {
  try {
    const base = normalizeUrl(settings.apiUrl);
    if (!base || !settings.apiKey) throw new Error('请先填写 API URL 和 API Key。');
    const res = await fetch(`${base}/v1/models`, {
      headers: { Authorization: `Bearer ${settings.apiKey}` },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    settings.availableModels = (data.data || []).map((x) => x.id).filter(Boolean);
    if (!settings.model && settings.availableModels.length) settings.model = settings.availableModels[0];
    saveSettings();
    toast(`已拉取 ${settings.availableModels.length} 个模型。`, 'success');
    renderModal();
  } catch (error) {
    toast(`拉取模型失败：${error.message}`, 'error');
  }
}

function stopGeneration() {
  if (abortController) abortController.abort();
  busy = false;
  renderBusyState();
  toast('已尝试停止请求。', 'warning');
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
  if (descriptor?.set) descriptor.set.call(input, value);
  else input.value = value;
  input.dispatchEvent(new Event('input', { bubbles: true }));
  input.dispatchEvent(new Event('change', { bubbles: true }));
  return true;
}

function openModal(tab = activeTab) {
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
  const plan = store.plan;
  panel.innerHTML = `
    <div class="sd-settings-block">
      <div class="sd-settings-title">🎬 Story Director / 剧情导演</div>
      <div class="sd-settings-desc">把固定日程升级为剧情规划、任务发布、剧情节点、NPC动态与世界变化。</div>
      <div class="sd-row sd-row-wrap">
        <button class="menu_button sd-open-dashboard">打开剧情导演</button>
        <button class="menu_button sd-generate-now" ${busy ? 'disabled' : ''}>${busy ? '生成中…' : '刷新剧情'}</button>
      </div>
      <label class="checkbox_label sd-checkbox-line">
        <input type="checkbox" class="sd-toggle-float" ${settings.floatingButton ? 'checked' : ''}> 显示悬浮按钮
      </label>
      <div class="sd-mini-status">当前：${plan ? htmlEscape(plan.story_status?.current_arc || plan.story_status?.title || '已有规划') : '尚未生成'} ${store.updatedAt ? `· ${new Date(store.updatedAt).toLocaleString()}` : ''}</div>
    </div>`;
  panel.querySelector('.sd-open-dashboard')?.addEventListener('click', () => openModal('dashboard'));
  panel.querySelector('.sd-generate-now')?.addEventListener('click', () => generateDirectorPlan());
  panel.querySelector('.sd-toggle-float')?.addEventListener('change', (e) => {
    settings.floatingButton = e.target.checked;
    saveSettings();
    renderFloatButton();
  });
}

function renderFloatButton() {
  let btn = document.getElementById(FLOAT_ID);
  if (!settings.floatingButton) {
    btn?.remove();
    return;
  }
  if (!btn) {
    btn = document.createElement('button');
    btn.id = FLOAT_ID;
    btn.type = 'button';
    btn.title = '剧情导演';
    btn.textContent = '🎬';
    document.body.appendChild(btn);
    btn.addEventListener('click', () => openModal('dashboard'));
  }
}

function renderBusyState() {
  document.querySelectorAll('.sd-generate-now, .sd-generate-main').forEach((el) => {
    el.disabled = busy;
    el.textContent = busy ? '生成中…' : '刷新剧情';
  });
}

function renderModal() {
  const modal = document.getElementById(MODAL_ID);
  if (!modal) return;
  const tabs = [
    ['dashboard', '总览'], ['quests', '任务'], ['nodes', '节点'], ['npcs', '角色'],
    ['world', '世界'], ['blueprint', '剧本方案'], ['context', '扩展设定'], ['api', 'API'], ['log', '日志'],
  ];
  modal.innerHTML = `
    <div class="sd-backdrop"></div>
    <section class="sd-window" role="dialog" aria-label="剧情导演">
      <header class="sd-header">
        <div>
          <h2>Story Director</h2>
          <p>剧情规划 + 系统助手任务发布</p>
        </div>
        <button class="sd-close" title="关闭">×</button>
      </header>
      <nav class="sd-tabs">
        ${tabs.map(([id, label]) => `<button class="sd-tab ${activeTab === id ? 'active' : ''}" data-tab="${id}">${label}</button>`).join('')}
      </nav>
      <main class="sd-body">${renderActiveTab()}</main>
    </section>`;
  modal.querySelector('.sd-backdrop')?.addEventListener('click', closeModal);
  modal.querySelector('.sd-close')?.addEventListener('click', closeModal);
  modal.querySelectorAll('.sd-tab').forEach((el) => el.addEventListener('click', () => {
    activeTab = el.dataset.tab;
    renderModal();
  }));
  bindActiveTabEvents(modal);
  renderBusyState();
}

function plan() {
  return getChatStore().plan;
}

function renderActiveTab() {
  switch (activeTab) {
    case 'quests': return renderQuestTab();
    case 'nodes': return renderNodesTab();
    case 'npcs': return renderNpcTab();
    case 'world': return renderWorldTab();
    case 'blueprint': return renderBlueprintTab();
    case 'context': return renderContextTab();
    case 'api': return renderApiTab();
    case 'log': return renderLogTab();
    default: return renderDashboardTab();
  }
}

function metric(label, value) {
  const n = Math.max(0, Math.min(100, Number(value || 0)));
  return `<div class="sd-metric"><div class="sd-metric-top"><span>${label}</span><b>${n}%</b></div><div class="sd-bar"><i style="width:${n}%"></i></div></div>`;
}

function renderDashboardTab() {
  const p = plan();
  if (!p) return renderEmptyState('尚未生成剧情规划。先写好剧本方案和API，然后点击刷新剧情。');
  const st = p.story_status || {};
  return `
    <div class="sd-action-row">
      <button class="menu_button sd-generate-main">刷新剧情</button>
      ${busy ? '<button class="menu_button sd-stop">停止</button>' : ''}
    </div>
    <section class="sd-card sd-hero">
      <div class="sd-kicker">${htmlEscape(st.cycle || '下一阶段')}</div>
      <h3>${htmlEscape(st.title || '当前故事')}</h3>
      <p>${htmlEscape(st.summary || '')}</p>
      <div class="sd-two"><b>主线：</b>${htmlEscape(st.current_arc || '-')}</div>
      <div class="sd-two"><b>阶段：</b>${htmlEscape(st.current_stage || '-')}</div>
      <div class="sd-two"><b>氛围：</b>${htmlEscape(st.mood || '-')}</div>
    </section>
    <div class="sd-grid sd-grid-2">
      ${metric('进度', st.progress)}${metric('张力', st.tension)}${metric('情感', st.romance)}${metric('悬疑', st.mystery)}${metric('危险', st.danger)}
    </div>
    <section class="sd-card"><h3>导演点评</h3><p>${htmlEscape(p.director_comment || '')}</p><p class="sd-muted">下次刷新建议：${htmlEscape(p.next_refresh_hint || '完成一个节点后')}</p></section>
    <div class="sd-grid sd-grid-4">
      ${smallCountCard('任务', p.quests?.length || 0, 'quests')}
      ${smallCountCard('节点', p.story_nodes?.length || 0, 'nodes')}
      ${smallCountCard('NPC', p.npc_updates?.length || 0, 'npcs')}
      ${smallCountCard('世界', p.world_updates?.length || 0, 'world')}
    </div>`;
}

function smallCountCard(label, count, tab) {
  return `<button class="sd-count-card" data-jump="${tab}"><b>${count}</b><span>${label}</span></button>`;
}

function renderQuestTab() {
  const items = plan()?.quests || [];
  if (!items.length) return renderEmptyState('暂无任务。');
  return items.map((q) => renderItemCard(q.title, [q.type, q.priority, q.deadline], `
    <p>${htmlEscape(q.description || '')}</p>
    <dl><dt>目标</dt><dd>${htmlEscape(q.objective || '')}</dd><dt>触发</dt><dd>${htmlEscape(q.trigger || '')}</dd><dt>收益</dt><dd>${htmlEscape(q.reward || '')}</dd><dt>状态</dt><dd>${htmlEscape(q.status || '')}</dd></dl>
  `, q.inject_prompt)).join('');
}

function renderNodesTab() {
  const items = plan()?.story_nodes || [];
  if (!items.length) return renderEmptyState('暂无剧情节点。');
  return items.map((n) => renderItemCard(n.title, [n.priority, n.trigger], `
    <p>${htmlEscape(n.event || '')}</p>
    <dl><dt>伏笔</dt><dd>${htmlEscape(n.foreshadowing || '')}</dd><dt>后果</dt><dd>${htmlEscape(n.consequences || '')}</dd></dl>
  `, n.inject_prompt)).join('');
}

function renderNpcTab() {
  const items = plan()?.npc_updates || [];
  if (!items.length) return renderEmptyState('暂无NPC动态。');
  return items.map((n) => renderItemCard(n.name, [n.role, `${Number(n.progress || 0)}%`], `
    <dl><dt>目标</dt><dd>${htmlEscape(n.current_goal || '')}</dd><dt>情绪</dt><dd>${htmlEscape(n.emotional_state || '')}</dd><dt>下一步</dt><dd>${htmlEscape(n.next_action || '')}</dd><dt>隐藏动机</dt><dd>${htmlEscape(n.hidden_agenda || '')}</dd><dt>与玩家关系</dt><dd>${htmlEscape(n.relationship_to_user || '')}</dd></dl>
  `, n.inject_prompt)).join('');
}

function renderWorldTab() {
  const items = plan()?.world_updates || [];
  if (!items.length) return renderEmptyState('暂无世界变化。');
  return items.map((w) => renderItemCard(w.title, [w.type, w.timing], `
    <p>${htmlEscape(w.content || '')}</p>
    <dl><dt>影响</dt><dd>${htmlEscape(w.impact || '')}</dd></dl>
  `, w.inject_prompt)).join('');
}

function renderItemCard(title, badges, body, injectPrompt) {
  return `
    <article class="sd-card sd-item-card">
      <div class="sd-card-title"><h3>${htmlEscape(title || '未命名')}</h3><div>${(badges || []).filter(Boolean).map((x) => `<span class="sd-badge">${htmlEscape(x)}</span>`).join('')}</div></div>
      ${body}
      ${injectPrompt ? `<details class="sd-inject-preview"><summary>查看写入文本</summary><pre>${htmlEscape(injectPrompt)}</pre></details>` : ''}
      <button class="menu_button sd-inject" data-text="${htmlEscape(injectPrompt || '')}">写入输入框</button>
    </article>`;
}

function renderEmptyState(text) {
  return `<div class="sd-empty"><p>${htmlEscape(text)}</p><button class="menu_button sd-generate-main">刷新剧情</button></div>`;
}

function renderBlueprintTab() {
  const store = getChatStore();
  return `
    <section class="sd-card">
      <h3>当前聊天的剧本方案</h3>
      <p class="sd-muted">这里保留最大自由度：玩家只写基础剧情构思；AI输出格式由插件固定。</p>
      <textarea class="text_pole sd-textarea sd-blueprint" spellcheck="false">${htmlEscape(store.blueprint || DEFAULT_BLUEPRINT)}</textarea>
      <div class="sd-row sd-row-wrap">
        <button class="menu_button sd-save-blueprint">保存到当前聊天</button>
        <button class="menu_button sd-save-template">另存为模板</button>
        <button class="menu_button sd-export-templates">导出模板JSON</button>
        <label class="menu_button sd-file-label">导入模板JSON<input type="file" class="sd-import-templates" accept="application/json,.json"></label>
      </div>
    </section>
    <section class="sd-card">
      <h3>已保存模板</h3>
      <div class="sd-template-list">
        ${settings.templates.map((t) => `<details class="sd-accordion"><summary><b>${htmlEscape(t.name)}</b><span>${new Date(t.createdAt || Date.now()).toLocaleDateString()}</span></summary><pre>${htmlEscape(t.content)}</pre><div class="sd-row"><button class="menu_button sd-load-template" data-id="${htmlEscape(t.id)}">载入到当前聊天</button><button class="menu_button sd-delete-template" data-id="${htmlEscape(t.id)}">删除</button></div></details>`).join('')}
      </div>
    </section>`;
}

function renderContextTab() {
  const opts = settings.contextOptions;
  const charDesc = getCharacterDescription();
  const personaDesc = getPersonaDescription();
  return `
    <section class="sd-card">
      <h3>扩展设定</h3>
      <p class="sd-muted">默认折叠，只在需要时展开查看和选择。勾选后会作为剧情导演参考，但不会直接显示在聊天里。</p>
      <label class="checkbox_label"><input type="checkbox" class="sd-opt" data-key="includeChatHistory" ${opts.includeChatHistory ? 'checked' : ''}> 引用近期对话</label>
      <label class="checkbox_label"><input type="checkbox" class="sd-opt" data-key="includeCharDesc" ${opts.includeCharDesc ? 'checked' : ''}> 引用当前角色设定</label>
      <label class="checkbox_label"><input type="checkbox" class="sd-opt" data-key="includeUserDesc" ${opts.includeUserDesc ? 'checked' : ''}> 引用玩家人设</label>
      <label class="checkbox_label"><input type="checkbox" class="sd-opt" data-key="removeHtmlComments" ${opts.removeHtmlComments ? 'checked' : ''}> 清理HTML注释/标签</label>
    </section>
    <details class="sd-accordion"><summary><b>当前角色设定预览</b><span>${charDesc ? '有内容' : '无内容'}</span></summary><pre>${htmlEscape(cleanContextText(charDesc || '未读取到角色设定。'))}</pre></details>
    <details class="sd-accordion"><summary><b>玩家人设预览</b><span>${personaDesc ? '有内容' : '无内容'}</span></summary><pre>${htmlEscape(cleanContextText(personaDesc || '未读取到玩家人设。'))}</pre></details>
    <details class="sd-accordion" open><summary><b>手写扩展设定</b><span>自由补充</span></summary><textarea class="text_pole sd-textarea sd-manual-context" spellcheck="false">${htmlEscape(opts.manualContext || '')}</textarea><button class="menu_button sd-save-context">保存扩展设定</button></details>
    <details class="sd-accordion"><summary><b>预设 / 世界书高级选择</b><span>可选</span></summary>
      <label>预设名称，每行一个或逗号分隔</label>
      <textarea class="text_pole sd-small-textarea sd-preset-names">${htmlEscape(opts.presetNames || '')}</textarea>
      <label>世界书名称，每行一个或逗号分隔</label>
      <textarea class="text_pole sd-small-textarea sd-wb-names">${htmlEscape(opts.worldBookNames || '')}</textarea>
      <div class="sd-row sd-row-wrap"><button class="menu_button sd-save-context-names">保存名称</button><button class="menu_button sd-scan-context">扫描并展开条目</button></div>
      ${renderScannedContext()}
    </details>`;
}

function renderScannedContext() {
  const presetHtml = Object.entries(contextScanCache.presets || {}).map(([name, items]) => renderContextGroup('preset', name, items)).join('');
  const wbHtml = Object.entries(contextScanCache.worldBooks || {}).map(([name, items]) => renderContextGroup('world', name, items)).join('');
  if (!presetHtml && !wbHtml) return '<p class="sd-muted">尚未扫描，或当前环境不支持自动读取。仍可使用“手写扩展设定”。</p>';
  return `<div class="sd-scanned">${presetHtml}${wbHtml}</div>`;
}

function renderContextGroup(kind, name, items) {
  const label = kind === 'preset' ? '预设' : '世界书';
  const rows = (items || []).map((item) => {
    const id = item.uid ?? item.id ?? item.identifier ?? item.name ?? item.comment ?? JSON.stringify(item).slice(0, 24);
    const title = item.name || item.identifier || item.comment || item.role || (Array.isArray(item.key) ? item.key.join(', ') : item.key) || '未命名条目';
    const content = item.content || item.message || item.text || '';
    const checked = kind === 'preset' ? isPresetItemSelected(name, id) : isWorldItemSelected(name, id);
    return `<details class="sd-context-item"><summary><label><input type="checkbox" class="sd-context-check" data-kind="${kind}" data-group="${htmlEscape(name)}" data-id="${htmlEscape(String(id))}" ${checked ? 'checked' : ''}> ${htmlEscape(title)}</label></summary><pre>${htmlEscape(cleanContextText(content).slice(0, 2000))}</pre></details>`;
  }).join('') || '<p class="sd-muted">未读取到条目。</p>';
  return `<details class="sd-accordion" open><summary><b>${label}: ${htmlEscape(name)}</b><span>${items?.length || 0} 条</span></summary>${rows}</details>`;
}

function renderApiTab() {
  const isExternal = settings.providerMode === 'external';
  return `
    <section class="sd-card">
      <h3>模型来源</h3>
      <label class="radio_label"><input type="radio" name="sd-provider" value="external" ${isExternal ? 'checked' : ''}> 外置 OpenAI-Compatible API（填API即可用）</label>
      <label class="radio_label"><input type="radio" name="sd-provider" value="sillytavern" ${!isExternal ? 'checked' : ''}> 使用 SillyTavern 当前连接模型（无需另填Key）</label>
    </section>
    <section class="sd-card ${isExternal ? '' : 'sd-disabled-card'}">
      <h3>外置 API 配置</h3>
      <label>API URL</label>
      <input class="text_pole sd-api-url" placeholder="https://api.example.com/v1" value="${htmlEscape(settings.apiUrl || '')}">
      <label>API Key</label>
      <input class="text_pole sd-api-key" type="password" placeholder="sk-..." value="${htmlEscape(settings.apiKey || '')}">
      <label>模型</label>
      <div class="sd-row">
        <select class="text_pole sd-model-select">
          <option value="">手动输入或拉取模型</option>
          ${(settings.availableModels || []).map((m) => `<option value="${htmlEscape(m)}" ${m === settings.model ? 'selected' : ''}>${htmlEscape(m)}</option>`).join('')}
        </select>
        <button class="menu_button sd-fetch-models">拉取模型</button>
      </div>
      <input class="text_pole sd-model-input" placeholder="模型名称" value="${htmlEscape(settings.model || '')}">
      <label>Temperature</label>
      <input class="text_pole sd-temperature" type="number" min="0" max="2" step="0.05" value="${htmlEscape(settings.temperature)}">
      <button class="menu_button sd-save-api">保存API配置</button>
    </section>
    <section class="sd-card">
      <h3>刷新设置</h3>
      <label>读取最近消息数</label>
      <input class="text_pole sd-max-context" type="number" min="5" max="200" value="${htmlEscape(settings.maxContextMessages)}">
      <label class="checkbox_label"><input type="checkbox" class="sd-auto-refresh" ${settings.autoRefresh ? 'checked' : ''}> 自动刷新剧情导演</label>
      <label>每多少条AI回复后自动刷新</label>
      <input class="text_pole sd-auto-every" type="number" min="2" max="50" value="${htmlEscape(settings.autoRefreshEvery)}">
      <button class="menu_button sd-save-refresh">保存刷新设置</button>
    </section>
    <section class="sd-card">
      <h3>系统提示词</h3>
      <p class="sd-muted">通常不需要改。玩家自由度请写在“剧本方案”，这里只负责固定输出格式与导演原则。</p>
      <textarea class="text_pole sd-textarea sd-system-prompt" spellcheck="false">${htmlEscape(settings.systemPrompt || DEFAULT_SYSTEM_PROMPT)}</textarea>
      <button class="menu_button sd-save-system">保存系统提示词</button>
    </section>`;
}

function renderLogTab() {
  const log = settings.lastLog || DEFAULT_SETTINGS.lastLog;
  return `
    <section class="sd-card"><h3>状态</h3><p><b>${htmlEscape(log.status || 'none')}</b> · ${htmlEscape(log.time || '-')} · ${htmlEscape(log.duration || '-')}</p>${log.error ? `<p class="sd-error">${htmlEscape(log.error)}</p>` : ''}</section>
    <details class="sd-accordion"><summary><b>Request</b><span>最近一次请求</span></summary><pre>${htmlEscape(log.request || '暂无')}</pre></details>
    <details class="sd-accordion"><summary><b>Response</b><span>最近一次返回</span></summary><pre>${htmlEscape(log.response || '暂无')}</pre></details>`;
}

function bindActiveTabEvents(root) {
  root.querySelectorAll('.sd-generate-main').forEach((el) => el.addEventListener('click', () => generateDirectorPlan()));
  root.querySelectorAll('.sd-stop').forEach((el) => el.addEventListener('click', stopGeneration));
  root.querySelectorAll('.sd-count-card').forEach((el) => el.addEventListener('click', () => { activeTab = el.dataset.jump; renderModal(); }));
  root.querySelectorAll('.sd-inject').forEach((el) => el.addEventListener('click', () => {
    const ok = injectToInput(el.dataset.text || '');
    toast(ok ? '已写入输入框。' : '未找到输入框。', ok ? 'success' : 'error');
    if (ok) closeModal();
  }));

  root.querySelector('.sd-save-blueprint')?.addEventListener('click', async () => {
    getChatStore().blueprint = root.querySelector('.sd-blueprint')?.value || DEFAULT_BLUEPRINT;
    await saveMetadata();
    toast('剧本方案已保存到当前聊天。', 'success');
  });
  root.querySelector('.sd-save-template')?.addEventListener('click', async () => {
    const name = await promptInput('模板名称', '给这个剧本方案起个名字：', '我的剧情模板');
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
    toast('模板已载入当前聊天。', 'success');
    renderModal();
  }));
  root.querySelectorAll('.sd-delete-template').forEach((el) => el.addEventListener('click', async () => {
    if (settings.templates.length <= 1) return toast('至少保留一个模板。', 'warning');
    const yes = await confirmDialog('删除模板', '确认删除这个模板？');
    if (!yes) return;
    settings.templates = settings.templates.filter((x) => x.id !== el.dataset.id);
    saveSettings();
    renderModal();
  }));
  root.querySelector('.sd-export-templates')?.addEventListener('click', exportTemplates);
  root.querySelector('.sd-import-templates')?.addEventListener('change', importTemplates);

  root.querySelectorAll('.sd-opt').forEach((el) => el.addEventListener('change', () => {
    settings.contextOptions[el.dataset.key] = el.checked;
    saveSettings();
  }));
  root.querySelector('.sd-save-context')?.addEventListener('click', () => {
    settings.contextOptions.manualContext = root.querySelector('.sd-manual-context')?.value || '';
    saveSettings();
    toast('手写扩展设定已保存。', 'success');
  });
  root.querySelector('.sd-save-context-names')?.addEventListener('click', () => {
    settings.contextOptions.presetNames = root.querySelector('.sd-preset-names')?.value || '';
    settings.contextOptions.worldBookNames = root.querySelector('.sd-wb-names')?.value || '';
    saveSettings();
    toast('名称已保存。', 'success');
  });
  root.querySelector('.sd-scan-context')?.addEventListener('click', async () => {
    settings.contextOptions.presetNames = root.querySelector('.sd-preset-names')?.value || '';
    settings.contextOptions.worldBookNames = root.querySelector('.sd-wb-names')?.value || '';
    saveSettings();
    await scanExtendedContext();
  });
  root.querySelectorAll('.sd-context-check').forEach((el) => el.addEventListener('change', () => {
    if (el.dataset.kind === 'preset') setPresetItemSelected(el.dataset.group, el.dataset.id, el.checked);
    else setWorldItemSelected(el.dataset.group, el.dataset.id, el.checked);
  }));

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
    toast('API配置已保存。', 'success');
  });
  root.querySelector('.sd-save-refresh')?.addEventListener('click', () => {
    settings.maxContextMessages = Number(root.querySelector('.sd-max-context')?.value || 30);
    settings.autoRefresh = !!root.querySelector('.sd-auto-refresh')?.checked;
    settings.autoRefreshEvery = Number(root.querySelector('.sd-auto-every')?.value || 10);
    saveSettings();
    toast('刷新设置已保存。', 'success');
  });
  root.querySelector('.sd-save-system')?.addEventListener('click', () => {
    settings.systemPrompt = root.querySelector('.sd-system-prompt')?.value || DEFAULT_SYSTEM_PROMPT;
    saveSettings();
    toast('系统提示词已保存。', 'success');
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
      return String(result).toLowerCase().includes('affirmative') || result === true;
    }
  } catch (_) {}
  return globalThis.confirm(`${title}\n${text}`);
}

function exportTemplates() {
  const blob = new Blob([JSON.stringify({ version: 1, templates: settings.templates }, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `story-director-templates-${new Date().toISOString().slice(0, 10)}.json`;
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
    if (!Array.isArray(incoming)) throw new Error('JSON中未找到 templates 数组。');
    for (const item of incoming) {
      if (!item?.content) continue;
      settings.templates.push({
        id: item.id || uid('tpl'),
        name: item.name || '导入模板',
        content: item.content,
        createdAt: item.createdAt || new Date().toISOString(),
      });
    }
    saveSettings();
    toast('模板已导入。', 'success');
    renderModal();
  } catch (error) {
    toast(`导入失败：${error.message}`, 'error');
  } finally {
    event.target.value = '';
  }
}

function bindEvents() {
  const context = ctx();
  const source = context.eventSource;
  const types = context.event_types || {};
  if (!source?.on) return;
  const refreshHandler = async () => {
    try {
      const store = getChatStore();
      store.messageCounter = Number(store.messageCounter || 0) + 1;
      await saveMetadata();
      if (settings.autoRefresh && settings.autoRefreshEvery > 0 && store.messageCounter >= settings.autoRefreshEvery && !busy) {
        await generateDirectorPlan(false);
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
    if (document.getElementById(MODAL_ID)?.classList.contains('open')) renderModal();
  };
  source.on(types.MESSAGE_RECEIVED || 'message_received', refreshHandler);
  source.on(types.CHAT_CHANGED || 'chat_changed', rerenderHandler);
}

function init() {
  if (initialized) return;
  initialized = true;
  settings = getSettings();
  renderSettingsPanel();
  renderFloatButton();
  bindEvents();
  console.log(`[${EXTENSION_NAME}] loaded`);
}

export async function onActivate() {
  init();
}

export async function onClean() {
  const context = ctx();
  if (context.extensionSettings?.[MODULE_NAME]) {
    delete context.extensionSettings[MODULE_NAME];
    context.saveSettingsDebounced?.();
  }
  if (context.chatMetadata?.[MODULE_NAME]) {
    delete context.chatMetadata[MODULE_NAME];
    await context.saveMetadata?.();
  }
  document.getElementById(SETTINGS_PANEL_ID)?.remove();
  document.getElementById(MODAL_ID)?.remove();
  document.getElementById(FLOAT_ID)?.remove();
}

// Fallback for older or custom loaders that do not call lifecycle hooks.
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => setTimeout(init, 0));
} else {
  setTimeout(init, 0);
}
