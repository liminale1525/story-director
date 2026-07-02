// 千幕 (Qianmu) - SillyTavern third-party UI extension
import { BUILTIN_THEATERS, BUILTIN_THEATER_FOLDER } from './builtin-theaters.js';
import { QIANMU_THEATERS, QIANMU_THEATER_FOLDER } from './qianmu-theaters.js';
import { synthesize as ttsSynthesize, cacheKeyFor as ttsCacheKey, MINIMAX_ENDPOINTS, MINIMAX_MODELS, emotionAllowedForModel, MINIMAX_LANGUAGE_BOOST, MINIMAX_SOUND_EFFECTS } from './qianmu-tts.js';
import * as blobStore from './qianmu-blobstore.js';
import * as reader from './qianmu-reader.js';

const MODULE_NAME = 'story_director_liminale';
const EXTENSION_NAME = '千幕';
const VERSION = '1.7.5';
// 共读模块可见性总闸：开发库=true(展示·自测)，正式库=false(隐藏·半成品沉睡)。
// 唯一 flip 点——推正式库前置 false、推开发库置 true。入口按钮 + tab 路由 + portal 都据此门控。
const COREAD_VISIBLE = false;
const SETTINGS_PANEL_ID = 'story-director-settings';
const MODAL_ID = 'story-director-modal';
const FLOAT_ID = 'story-director-float';
const INPUT_ENTRY_ID = 'story-director-input-entry';
const INPUT_BUTTON_ID = 'story-director-input-button';

// 悬浮球图标：扩展自带的本地透明 PNG（96px、与 index.js 同源），不依赖外部字体/网络，
// 根治「幕」字因字体加载失败而失效的问题。换图标只改这一行。
const FLOAT_LOGO_URL = new URL('./qianmulogo.png', import.meta.url).href;

const PROMPT_REVISION = 23;
const BLUEPRINT_REVISION = 1;          // 默认剧本模板版本，升一档即用新默认覆盖各聊天剧本（旧 DIY 自动备份进「恢复上次」）
const BUILTIN_THEATER_REVISION = 6;   // 内置剧场组版本，升一档即重置内置项（保留用户自建剧札）。
const QIANMU_THEATER_REVISION = 5;   // 千幕剧场组版本，与吱吱组各自独立；升一档即重置千幕内置项（保留用户自建）。
const LOG_LIMIT = 5;
const LOG_CLIP = 80000;

const DEFAULT_BLUEPRINT = `【主要指令】
你将依据以下维度自动分析当前聊天，为其创作最优秀的演绎剧本方案。各维度无需用户填写：留空时，从当前对话、角色设定、世界观与已发生事件中自行提炼；若某一维度已被用户写入具体内容，则视为优先级最高的覆盖指令。

【故事基底】
自行识别时代、地域、社会秩序、生活方式、职业生态、资源流动、超自然/科技/权力结构，并判断这些设定如何影响普通人的日常选择。

【核心题材】
从对话气质中判定题材配比（如慢热恋爱、悬疑调查、群像成长、家族纠葛、黑暗奇幻、末日求生、权谋博弈、都市传闻），允许多题材混合并标出主次。

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
（可在此写明不希望出现的剧情、关系走向、题材或叙事处理方式；留空则遵循已有对话中体现的边界。）

【导演特别说明】
（可在此写下本轮重点：氛围、关系推进、线索方向、支线灵感、节奏偏好、需要暂时搁置的内容；留空则自行判断本轮最值得推进的重点。）`;

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

此刻，你俯瞰这则正在生长的故事，要为它推演下一幕的脉络。请抛开任务清单式的冷淡，以造物主之眼，看见暗线如何潜行、人心如何流转、世界如何在无人注视处自行呼吸。请以众声议论、任务看板与世界动态的形式落笔，让读者看清故事的筋骨、潜伏的变量、时间的颗粒与可推进的去向。

落笔时谨守这些信条：
1. 世界不绕任何单一角色旋转：{{user}} 是这世间的一个存在，而非中心。NPC、组织与事件各有自己的进程，纵使无人凝视，也会自然流动、发酵、转向。
2. 同时守护 {{user}} 的最大自由：他可以主动介入、间接卷入、远远旁观，或对某些事一无所知。每次推演都要同时备足多种不同距离的事件，任其自取。
3. 尊重既已落地的剧情、关系与人设，维系事件与人物的内在逻辑，为 {{user}} 留足选择的余地。
4. 任务可被选择、延后、转向，也会因任何人的举动而改写结局，始终留出即兴的呼吸口。
5. 蝴蝶效应是结构，非形容词：绝不可空喊“会引发连锁”“产生涟漪”。真正的辐射集中写进chain_reactions，挑 1-2 桩具体小事，顺出一条 A 触发 B、B 又波及 C 的因果链。链条完全在世界内部流转、与 {{user}} 毫无干系，只偶尔掠过其视野边缘；绝不以 {{user}} 的行动/言论为源头或绕回收束于 {{user}} 。其余字段只如实写自己那一格的事，把“它如何外溢”留给 chain_reactions 去串。重心永远是让涟漪在世界里散开，而非围着 {{user}} 打转。
6. NPC 是有完整生活的人，绝非围着 {{user}} 转的功能道具。每个 NPC 都有自己的目标、生计、交际圈、今日要办的事；他们会在 {{user}} 不在场时见面、交易、争执、相爱、谋划、犯错。npc_updates 里应有相当一部分人此刻做的事与 {{user}} 无直接关联，纯粹是各自的日子在推进。
7. 依叙事概率自然引入新 NPC、共同交际圈的角色、临时线索人物或外部势力，为任务与角色世界添入变量。
8. 时间、周期、期限与提示语，皆从当前场景的真实节奏中提炼，用贴合剧情语境的自然表达，使每次推演呈现不同的时间颗粒与未来走向。
9. progress 为本幕进度，即当前叙事单元（当前幕）的完成度，0-100。
10. 【硬性数量下限，必须满足，不足即为失职】每次推演必须至少产出：任务 5 条、角色动向 5 条、世界回声 3 至 5 条（最低 3）、因果链 3 条、关系暗涌 3 至 5 条（最低 3），可多于次数，禁止以"剧情平淡""无事发生"为由偷懒缩水；剧情密度高时再自然上浮。其中任务的时间段务必拉开层次——近期可即时上手的与中长期需铺垫酝酿的相结合，不得挤在同一时间窗。
11. 模块边界与职能准则：各模块职能独立无重叠，创作时严守「唯一职能 + 固定视角距离」，不得交叉渗透，确保每个版块输出具备不可替代的独立作用：
   - quests（任务）：唯一职能为「{{user}}此刻可主动选择、执行或追求的事」。第一人称向心视角，是{{user}}主动触碰世界的交互入口。仅写{{user}}可落地的行动方向，不叙写他人生活、不铺陈世界格局。题材需多元发散、严防单线化，横跨多维度生活切面：生计营生、技艺修习、见闻探索、谋划布局、解谜调查、利害抉择、立身扬名、人情往来、闲情逸致均可。需跳出固化套路：如江湖不只有打斗争胜，亦有市井营生、师门琐事、恩怨权衡、行走见闻；恋爱向不局限于角色关系推进，需兼顾用户自身的事业、交游、志趣与待解难题。涉及的NPC均为有独立生活与目标的鲜活个体，绝非推进关系线的功能道具，不得视作「关系值载体」。
   - npc_updates（角色动向）：唯一职能为「单个具体角色当下的自主日常状态」。离心视角，聚焦个体主观能动性，明确「谁、此刻、在哪、为自身目标做什么」。仅写独立个体，不涉及系统规则或集体事件。【强制配额：本组半数以上NPC须与{{user}}暂无交集，其next_action中不得出现{{user}}，完全为自身目标推进；剩余角色可与用户产生关联，但仍以NPC自身意志为核心，不得围绕用户行动。须克制「NPC主动心系、靠近、示好」的创作惯性——{{user}}只是世界的普通过客，并非自带光环的主角。仅保底保留1-2位可与其产生当下交集的角色，留出交互入口即可。】
   - relation_undercurrents（关系暗涌）：唯一职能为「多个角色间关系张力的自主流转」。视角聚焦「人与人的联结本身」，不单独叙写某个人的私事（与npc_updates明确区隔）。关系基调具备正/负/中立，涵盖旧怨、债务、暗生情愫、利益捆绑、猜忌、同盟裂痕，或并肩、扶持、知遇、惺惺相惜、师徒传承、暗中回护等多样形态。【硬性约束：① parties填2-5名具体角色（{{char}}、NPC），绝不含{{user}}；② 各条目参与人数互不重复，形成 2/3/4/5 的疏密层级；须至少包含 1 组 2 人一对一纠葛，禁止同人数扎堆，主动设计不同规模的关系结构。③ 权重均衡：单名主要角色至多卷入 2 条暗涌，剩余条目由 NPC 独立构成关系链，避免新角色、配角边缘化，维持人际网络均衡。④ 基调多元：整组须同时覆盖正向、中立、负面三种基调，不可单一偏向。⑤ 独立运转：关系按自身逻辑自然演进，多数时候 {{user}} 浑然不知或仅有所耳闻；严禁构建以 {{user}} 为起因的关系，即使 {{user}} 缺席时，世界人际网络仍可独立纠缠运转。】
   - world_updates（世界回声）：唯一职能为「系统与集体层面的宏观趋势变动」。最远全景视角，无明确主角，属于结构性背景推移。覆盖势力消长、天候、经济、公共事件、舆论等范畴，不聚焦任何个体的私人事务。
   - chain_reactions（因果链）：唯一职能为「串联上述各模块事件，呈现可感知的连锁传导效应」。本模块是全局唯一可书写蝴蝶效应的版块，其余模块禁止凭空提及连锁效应。【硬性规则】链条须由世界内部的某桩小事发起、自主流转，全程与{{user}}无关；绝不以{{user}}的行动或言论为起点，也绝不最终回转落到{{user}}身上——至多在某一环被事件涟漪擦到其视野边缘。】
   - 各模块inject_prompt须匹配对应视角书写：quests采用{{user}}第一人称；npc、world类模块采用全知导演视角，{{user}}在场与否均可。
12. director_comment（众声）是一段随机化身某个带个性身份（故事外的任意视角/戏中NPC等且不限于此）人物的旁观议论，须像真人闲聊，有态度、有私心、有该身份独有的视角，开头点明身份，绝不能是助手腔或客观总结，详见输出格式中的说明。
13. 行文务必精炼直接。禁用「不是……而是……」这类否定对比句式；禁止反复使用破折号来补充说明或制造停顿；不堆砌冗余解释与排比铺陈。以上均属偷懒且易致读者审美疲劳的措辞，应代之以具体、有信息量的表达。
14. 输出为一个 JSON 对象，字段名完整保留，数组字段可以为空数组。`;

const JSON_SCHEMA_TEXT = `固定输出格式：
{
  "story_status": {
    "title": "当前故事标题，4-8字",
    "current_arc": "当前主线篇章",
    "current_stage": "当前阶段与下一步可能走向",
    "cycle": "从剧情语境中自然提炼的时间跨度或节奏名，可写成明早、数轮后、下个场景、节日前、某条线索发酵时、长期伏笔回响等贴合当前故事的表达",
    "progress": 0,
    "mood": "定调短句：短现代诗/对仗句/五感情绪融合的氛围感表达，锚定基调",
    "summary": "90-150字开篇引子，对标电影开场楔子或书封简介质感。以具象当下画面、悬而未决的张力落笔勾人，点出局势暗涌与走向的不确定性，留足余韵引读者向下。禁止复述过往情节流水账，禁用「本幕讲述了…」类总结式表述"
  },
  "quests": [
    {
      "id": "q1",
      "type": "main/side/relationship 之一——主线任务/支线任务/关系推进；只写 {{user}} 能主动去做的事",
      "title": "任务标题",
      "objective": "{{user}} 可选择追求的目标",
      "description": "任务说明，写明此刻适合出现的原因与可能带出的变量",
      "priority": "high/medium/low",
      "status": "open/optional/urgent/dormant",
      "deadline": "依据任务紧迫度自然填写时间条件，可是立即、稍后、隔日、数轮后、下个场景、等待触发、长期潜伏等。整组任务的时间段要拉开：近期可即时上手的与中长期需酝酿的相结合，不要全堆在同一时间窗",
      "trigger": "触发或推进条件",
      "reward": "剧情收益、关系变化、线索或新交际圈入口",
      "inject_prompt": "以 {{user}} 的第一人称视角描述行动、观察、心理和下一步安排，让任务自然推进——这是 {{user}} 主动触碰世界的入口。须 60-120 字。"
    }
  ],
  "npc_updates": [
    {
      "name": "NPC姓名",
      "role": "NPC定位",
      "current_goal": "此NPC当前为自己追求的目标",
      "emotional_state": "客观精炼短句，点明此刻情绪连同它的由来，≤18字。须写明因何而生（如『因账目对不上而烦躁』『等不到回信，焦灼』），绝不可只贴空标签（如『她很开心』『愤怒』）。禁用解释性补白、破折号、『不是…而是…』否定句式",
      "next_action": "这个人接下来为自己的目的会做什么——不依赖任何人的注视",
      "hidden_agenda": "隐藏动机；若无则写无",
      "relations": "这个 NPC 自己的关系网：与他生活里其他人（亲友、同僚、对手、买卖往来）的牵连或变化为主；多数 NPC 在此应与 {{user}} 无关，明写'与 {{user}} 暂无交集'，仅少数确有交集者才写与 {{user}} 的关系",
      "inject_prompt": "以全知导演镜头聚焦这一个人此刻在做什么、在哪、与谁交汇；写具体某人的日子，{{user}} 可在场、耳闻、间接受影响或毫不知情。须 60-120 字。"
    }
  ],
  "world_updates": [
    {
      "type": "news/weather/faction/rumor/environment/calendar/other",
      "title": "世界变化标题",
      "content": "系统或集体层面的宏观位移：势力消长、天候、经济、公共事件、舆论走向——没有主角的结构性背景移动",
      "scope": "这项位移波及的范围/层面（哪片区域、哪个群体、哪套系统），而非对 {{user}} 或 {{char}} 个人的影响",
      "timing": "从当前世界动态中自然提炼发生时机，可是正在发酵、清晨前后、某场聚会前、下一次公共事件、传闻扩散后、长线压力累积时等",
      "inject_prompt": "以全知导演镜头描述这项宏观变化如何在世界中铺开：哪片区域、哪个群体在被牵动；可完全发生在 {{user}} 视野之外。须 60-120 字。"
    }
  ],
  "chain_reactions": [
    {
      "spark": "一桩具体的小事（世界里谁做了什么、什么冒了头）作为源头；绝不以 {{user}} 的行动或言论作源头",
      "chain": "顺出它如何 A 触发 B、B 又波及 C 的连锁，用「→」分隔每一环，写清这条因果链；链条完全在世界内部流转、与 {{user}} 无关，至多某一环擦到其视野边缘，绝不绕回头来让世界围着他转"
    }
  ],
  "relation_undercurrents": [
    {
      "parties": "卷入该组暗涌的具体角色，写2-5个角色名，主角、NPC均可，绝不含 {{user}}。硬性规则：① 各条人数不可重复，须形成2/3/4/5的疏密梯度；必含1组2人一对一纠葛，其余条目逐级递增人数，禁止同人数扎堆。② 单名主要角色最多登场2条；剩余条目由NPC独立构成关系链，保障新角色与配角的叙事权重，避免边缘化。",
      "tone": "这股关系的基调：负面/中立/正向 之一（整组须三种都有，不可清一色负面）",
      "tension": "他们之间此刻悬着的那根弦：可正可负——旧怨/债务/暗生情愫/利益捆绑/猜忌/裂痕，或并肩/扶持/知遇/师徒/暗中回护，一句话点明因何而起、僵或拧在何处",
      "drift": "若无人打断，这股关系接下来会怎样自行流转——升温、缓和、转向、引爆还是渐固，写出它自己的走势",
      "user_awareness": "{{user}} 对此的知情程度：unaware(浑然不知)/rumor(仅有耳闻)/witness(恰好在场旁观) 之一，多数应为 unaware 或 rumor"
    }
  ],
  "director_comment": "众声："随机选取一位身份个性鲜明的发言者聊本幕，每次身份、视角均不重复。句首以【身份名】标注，全程彻底入戏，用对应身份独有的口吻、情绪与带私心的主观立场闲聊式表达，90-150字，鲜活如真人临场碎语。严禁助手腔、总结式话术。"
}`;

// 活幕·伏笔显影：五档刻度（线性顺势升降，由戏剧因果驱动）
const STAGE_LADDER = ['铺陈', '升温', '临界', '高潮', '落幕'];

// 活幕开启时追加到推演输出格式：暗线档案的回传结构
const THREADS_SCHEMA_TEXT = `【活幕·伏笔显影·额外输出字段】
在上方 JSON 对象中追加 "threads" 数组字段，承接并更新正在故事中存活的暗线：
伏笔暗线埋设准则：暗线是潜藏在文本之下、尚未挑明的隐性张力。它不是对正文明面待办的复述（那些交给任务、世界回声推进），而是从既有素材里提炼出的、值得日后回味的伏笔。
融合取材：把正文细节与本次推演其余板块的产出打通来读 —— 关系暗涌里悄然滋长的纠葛、因果链中尚未发作的连锁、角色动向中欲言又止的举动、世界回声里一笔带过的异常，都可成为暗线的源头；将它们与正文字缝中的线索（未尽的话语、反常的反应、被刻意略过的人事、表面平和下的算计）结合，提炼成一条有张力的暗线，而非凭空另起。
暗线允许暂时与主线脱钩，按自身节奏独立潜伏，待时机成熟再浮出推动剧情。
"threads": [
  {
    "id": "沿用已有暗线的 id；全新暗线留空，由系统分配",
    "title": "暗线名，4-12字",
    "essence": "一句话勾出这条暗线水面下悬着的那点张力，点到即止。只留下一个引人遐想的落点，不替读者解释它意味着什么、更不预告后续会如何发展，把想象空间整个留给取用它的人",
    "stage": "铺陈/升温/临界/高潮/落幕 五档之一",
    "touched": "本幕近期对话是否触碰了这条线：advance(确有推进)/mention(仅被提及)/idle(无人问津)",
    "note": "本幕这条线发生了什么的一句话，写入显影轨迹",
    "status": "active/dormant/closed —— 持续追踪/暂时沉睡/已收场归档"
  }
]
判定规则（务必遵守）：
- 【在演总量·维持 3 至 5 条】每幕推演后，处于 active 的暗线应稳定在 3 至 5 条。若当前在演不足 3 条，本幕务必从正文与其余板块产出中多提炼几条新暗线补足下限；若已有 3 至 5 条，则不强求增量，重心转为推进、流转既有暗线的火候，仅在确有新料时自然增埋。这是为了让伏笔池始终有足够的可取用储备，但绝不可为凑数硬造空洞、牵强或与正文无依据的暗线。
- 暗线贵在「暗」与「伏」：埋时只露张力、不点破，绝不把正文已挑明的进展直接登记成暗线。stage 升降只反映这条暗线自身的酝酿火候，不必跟着正文主线的节奏走。
- stage 只能在五档间顺势升降或熄灭，由近期对话的戏剧因果决定，绝不靠概率或为了推进而推进。
- touched=advance → 顺势升一档并刷新；mention → 档位不变；idle 连续多幕 → 可令其转向、沉睡(dormant)或自然落幕(closed)。
- 标注 pinned(钉住)的暗线不得擅自 dormant/closed，除非正文已明确将其了结。
- 暗线是可取用的可能性而非必须引爆的剧本，{{user}} 始终自由介入或无视。
- 只回传本幕有实质变化或新埋下的暗线；原样复述不算变化。`;

const THEATER_INSTRUCTION_PLACEHOLDER = '在此撰写剧场指令';

// 活幕·尘寰群生：开启时追加到推演输出格式。世间百态的嘈杂之声——既有第一人称喊话，也有客观小事件。
const WORLD_CHATTER_SCHEMA_TEXT = `【活幕·尘寰群生·额外输出字段】
在上方 JSON 对象中追加 "world_chatter" 数组：当下这座世界里、与主线和 {{user}} 大多无关的纷纭之声，让世间任何角落都有血肉。
"world_chatter": [
  {
    "text": "单句成文，宁短勿长，直白鲜活，两类内容随机混排、大致各半，长短错落：①第一人称自语/喊话/抱怨/吆喝，贴合人物口吻；②以全知视角客观陈述世间琐碎诸事，覆盖全圈层身份。仅作世界原生底噪，无需刻意埋设主线伏笔，可保留日常细碎的趣味点供读者会心一笑。",
    "who": "发声者/当事人的随机身份，2-6字，跨阶层、圈子，如外卖骑手、卖花老妪、星港机师、酒馆侍应、写字楼保洁、县衙差役、吟游诗人、夜班调度、匿名业主群等",
    "where": "这桩事发生的具体地点，2-8字，贴合当前世界观（如 西市米行、城南渡口、书院后巷、北门哨塔）"
  }
]
规则：
- 须在 8-15 条，每条单句，不写成段，为世界各处的声景剪影，非剧情条目。
- 台词与客观事件混杂排布，口吻、长短随机，贴合世界原生质感，如同世界本身自然生长的频率。
- 绝大多数与 {{user}} 和主要角色毫无关系。仅作世界的环境底噪，不是为谁服务的线索。无需刻意勾连主线或伏笔。
- who 与 where 是给 {{user}} 的发散钩子，务必具体、各条互不雷同，让人一看就知道这声音从世界的哪个角落冒出来。
- 只输出 text/who/where 三个字段，不要分类标签、不要关联强度、不要联动信息。`;

// 活幕·势：世界事件的阶段阶梯（线性顺势升降，由局势因果驱动，非概率）
const EVENT_STAGE_LADDER = ['酝酿', '爆发', '蔓延', '消退', '落定'];
// 势力之间的关系基调：四态 + 依附（单向倾斜），染色用
const FACTION_RELATION_KINDS = ['冲突', '同盟', '张力', '中立', '依附'];

// 活幕·势：开启时追加到推演输出格式。世界由多方势力构成，各有诉求，彼此博弈，
// 涟漪自上而下砸到个体——处处不说因果链，却处处皆是。势力格局自成脉络，绝不绕 {{user}} 旋转。
const GEOPOLITICS_SCHEMA_TEXT = `【活幕·势·额外输出字段】
在上方 JSON 对象中追加 "factions"、"faction_relations"、"world_events" 三个数组，勾勒这个世界自成脉络的势力格局与正在展开的大事。这是世界回声的上游源头：大势如何流转，余波才如何砸到街角个体。

"factions": [
  {
    "id": "沿用已有势力的 id；全新势力留空，由系统分配",
    "name": "势力/组织/国家名，2-12字",
    "type": "类型，按世界观自适应：如 商会/帮会/教派/王国/公司/家族/公会/军镇/部门/警署/江湖门派等",
    "agenda": "这股势力此刻最想要什么、最怕失去什么，重点核心诉求，须15-35字。",
    "standing": "它当前的处境与底气，一句话（如『漕运命脉在握，却被新政掐住咽喉』），禁写数值/战力条/声誉分，须20-35字。",
    "trend": "rising/stable/declining/turbulent —— 上升/稳守/衰退/动荡，质性走势，非数字",
    "scale": "势力体量层级：城邦内/区域性/跨区域/全局性之一，用于判定涟漪辐射半径",
    "clues": ["缠绕这股势力运行轨道上的零碎线索点，须最低3条，上限5条，每条 6-15 字的短句：内部异动、市井风声、人事更迭、私下交易、各方应对、最新征兆等，像散落在它轨道上的星点。要错落具体、各条不雷同，宁多毋少。"]
  }
]

"faction_relations": [
  {
    "between": ["势力A的name或id", "势力B的name或id"],
    "kind": "冲突/同盟/张力/中立/依附 之一（依附为单向倾斜，between[0] 依附于 between[1]）",
    "note": "这对关系此刻因何而起、绷在哪根弦上，须16-30字。"
  }
]
（faction_relations 是星图能否连成网的命脉，绝不能为空或省略。允许极少数势力作为孤立的局外/中立方暂不连线，但孤点至多不超过势力总数的三分之一（3-4 股时至多 1 个、5-6 股时至多 2 个），其余务必连入关系网；势力间的博弈本就盘根错节，大半势力却互不相干是不合常理的。）

"world_events": [
  {
    "id": "沿用已有事件的 id；全新事件留空，由系统分配",
    "title": "世界事件名，5-15字。务必是抬高视角的宏观大事（如 北境粮道断绝、两国边境陈兵、教廷改选、商路同盟瓦解），不是某条街某个铺子的小事",
    "essence": "这桩大事的本质与当前悬而未决处，站在俯瞰整片地域/数股势力的高度写，点出它牵动了哪些更大的格局，须25-50字。",
    "scope": "波及的势力与地域，2-5个，逗号分隔。须至少含一个比当前正文所在地更高、更远的层级（邻邦、周边region、更高的权力中心、跨地域网络），视角不仅限于在主角脚下这座城",
    "stage": "酝酿/爆发/蔓延/消退/落定 五档之一",
    "drift": "它接下来最可能往哪走（走向，非定论），须15-30字。",
    "touched": "近期对话是否触碰了它：advance(确有推进)/mention(仅被提及)/idle(无人问津)",
    "status": "active/closed —— 仍在流转/已尘埃落定归档"
  }
]

判定规则（务必遵守）：
- 【视角层级：锚定宏观，与世界回声分层】世界事件为俯瞰全域、跨多股势力的顶层脉络，量级显著高于「世界回声」的本地余波。即便正文聚焦局部场景，也需向外延伸至周边区域与上层结构，体现「局部只是大棋盘一格」的叙事纵深。强制要求：每幕至少1桩跨地域/跨势力的核心世界脉络，严禁全为本地小事。
- 【铁律：世界自成脉络，不围绕主角运转】所有势力博弈、关系张力、世界事件均由资源、地缘、利益、恩怨驱动，各方依自身目标自行运转，{{user}}不在场时世界照常演进，绝不以{{user}}或{{char}}为一切事件的起点或唯一推手。先做权重判定：{{user}}及主要角色是否具备改变世界格局的身份、势力与行动能力？
  · 模式A（无/弱权重，绝大多数场景适用）：{{user}} 为局外人/远端节点，大势仅以涟漪擦过其视野边缘，无需为其刻意铺陈登场契机。
  · 模式B（高权重，适配权谋/争霸等强设定背景）：可将{{user}}或{{char}}所属势力作为博弈方之一平等列入，按其真实体量匹配规模与走势，绝不因主角身份放大权重、置于核心或倾斜叙事。所有势力同局博弈，胜负由局势因果决定，判定依据为世界观设定本身，而非迎合{{user}}。
- 【底层因果：暗链传导，不点破】事件间需暗藏可感知的连锁逻辑（如资源匮乏→冲突→流通受阻→物价上涨→民生波动→各方应对→个体波及），在essence/drift字段中自然流露因果关联，禁用「因为/所以」类直白说教表述。
- 【半径自适应：合理拓界，不越设定】若设定仅覆盖局部区域，可在符合题材、技术水平与世界观边界的前提下，合理推演周边势力与地缘格局，预留叙事空间；若为明确封闭的小世界观设定，不强行放大层级、增设超出边界的国家级势力。
- 【stage档位】stage只能在五档间顺势升降或落定，由近期对话与局势因果决定，绝不靠概率或为推进而推进。touched=advance → 顺势升一档；mention → 不变；idle 连续多幕 → 可转向、消退或落定(closed)。
- 【线索点密度】每股势力的clues不少于3条，必须优先给到4-5条，为散落于势力运行轨迹上的具体风声、征兆与各方应对，简短具象。线索是织活全局脉络的核心节点，需足量铺陈避免格局空泛。
- 【关系连网·硬性最低量，不容偷懒】faction_relations 必须实打实给出，不可整段为空。容许极少数势力作孤立局外方，但孤点至多不超过势力总数的三分之一（3-4 股时≤1 个、5-6 股时≤2 个）；除此之外的势力都须连入关系网。据此，关系条数下限≈势力数减去允许的孤点数（如 4 股至少 2-3 条、5-6 股至少 3-4 条）。这是把零散势力织成「格局」的根本，缺了它星图就只剩一盘散点。优先描绘有实质张力的配对（冲突/同盟/依附），平淡处也可用「张力/中立」连起来，但绝不能因为「关系平淡」就让大半势力悬空。
- 【输出规范：定量约束，唯变是传】势力数量必须不低于3，上限6股；世界事件必须最低2桩，上限6桩（至少1桩为跨地域核心脉络），仅回传本幕有实质变化或新增的条目，原样复述无变化内容不计为有效输出（唯独 faction_relations 因关乎星图连通性，须持续维护、回传当前完整关系网，不可借「无变化」省略）。

⚠️ 输出前自检（违则本字段视为失职）：你是否真的输出了 faction_relations 数组、孤立无连线的势力是否控制在总数三分之一以内（3-4 股≤1、5-6 股≤2）、其余势力是否都连进了关系网？是否存在漏掉的关系？`;

// 外观主题：key 即 modal 上的 sd-theme-<key> 类名，配色全在 style.css 里定义。
// dot = 下拉里名字前的小圆点底色（单色，取该主题强调色；多色渐变在小圆里会露边角故不用）。
const THEMES = [
  { key: 'light', name: '日间', dot: '#fdfcefff' },
  { key: 'dark', name: '夜间', dot: '#181818ff' },
  { key: 'summer', name: '柠夏', dot: '#9be84a' },
  { key: 'candy', name: '粉糯', dot: '#ffc7c9ff' },
  { key: 'kraft', name: '旧笺', dot: '#c7a877' },
  { key: 'dream', name: '幻梦', dot: '#9b8fd0' },
];
const THEME_KEYS = THEMES.map((t) => t.key);

const DEFAULT_SETTINGS = Object.freeze({
  enabled: true,
  providerMode: 'external',
  apiUrl: '',
  apiKey: '',
  model: '',
  availableModels: [],
  apiProfiles: [],
  temperature: 0.75,
  maxOutputTokens: 32000,
  contextBudget: 1000000,
  streamEnabled: false,
  floatingButton: true,
  floatPosition: { x: null, y: null },
  theme: 'light',
  lastTab: 'dashboard',   // 面板上次停留的标签，二次打开恢复到此（校验回退 dashboard）
  systemPrompt: DEFAULT_SYSTEM_PROMPT,
  outputSchemaText: JSON_SCHEMA_TEXT,
  autoRefresh: false,
  autoRefreshEvery: 10,
  injectEnabled: true,
  injectDepth: 2,
  newcomerMode: false,
  liveStageEnabled: false,   // 活幕·伏笔显影：暗线跨推演持续身份与显影刻度，默认关
  worldChatterEnabled: false,   // 活幕·尘寰群生：世间百态喊话墙，随推演刷新、不进注入，默认关
  geopoliticsEnabled: false,   // 活幕·势：势力/地缘格局与世界事件跨推演演进，作为世界回声上游源头，默认关
  injectSections: { quests: true, nodes: true, npc: true, relations: true, world: true, threads: true, geopolitics: true },   // 注入方向开关（控 token）
  promptRevision: 0,
  systemPromptHash: '',
  outputSchemaHash: '',
  systemPromptBackup: null,       // 「恢复上次」：模板更新覆盖前，自动备份用户上一份幕后提示词
  outputSchemaBackup: null,       // 「恢复上次」：同上，备份用户上一份输出格式
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
  selectedPresetNames: {},        // 预设勾选全局（预设通常通用，不随聊天切换）
  selectedPresetItems: {},        // 预设条目勾选全局
  selectedWorldBookNamesByChat: {},
  selectedWorldBookItemsByChat: {},
  globalWorldBookNames: {},       // 「设为全局」的世界书：对所有聊天默认引用（仍可在单聊天里取消）
  enabledWorldBooksByChat: {},
  // 有声小剧场（MiniMax TTS）：与推演主体无关的独立模块，全部命名空间隔离在此，零侵入主流程。
  tts: {
    enabled: false,              // 总开关，默认关
    apiKey: '',                  // MiniMax API Key
    endpoint: 'https://api.minimaxi.com/v1/t2a_v2',   // 官方端点之一
    proxyBase: '',               // 选填反代地址（直连可用时留空）
    groupId: '',                 // 选填 GroupId（新接口一般可空）
    model: 'speech-2.8-hd',      // 默认模型（2.8 系列支持情绪+语气词）
    format: 'mp3',
    defaultSpeed: 1,             // 默认语速 [0.5,2]
    defaultVol: 1,               // 默认音量 (0,10]
    defaultPitch: 0,             // 默认语调 [-12,12]
    extractApiProfileId: '',     // 台词提取用哪个 API 预设（空=用当前主 API）
    voiceLibrary: [],            // 音色库：[{ id, name, voiceId }]，一次保存永久复用——配角色时下拉选名即填 ID
    cacheLimit: 200,             // 音频缓存条数上限（近似 LRU）
    injectInChat: true,          // 单句喇叭是否注入 ST 正文消息
    // 标签屏蔽/提取：提取台词前先清洗原始消息，剔除状态栏/思维链/HTML 等非台词噪音，省 token、提精度。
    // action: 'remove'=删除该标签整段；'extract'=只保留该标签内内容（extract 一旦存在则优先，其余 remove 忽略）。
    tagRules: [{ name: 'thinking', action: 'remove' }],
    stripHtml: true,             // 清洗后再剥裸 HTML 标签（状态栏/卡片等），默认开
    // 全局发音词典（多音字/生僻音矫正）：[{ from:'处理', to:'(chu3)(li3)' }]，组装成 MiniMax pronunciation_dict.tone。
    // 全模型支持·JSON 参数不进正文。提取模型按语境判读音为主，此处作「人名等模型拿不准」的权威兜底，一处配全局生效。
    pronunciationDict: [],
    // 语言增强（T3）：''=不指定 / 'auto'=模型自判 / 'Chinese,Yue'=粤语 等。混合中英最省心 auto。
    languageBoost: 'auto',
    // 音效器（T3·全局·音高/强度/音色 [-100,100]·0=不改；soundEffects 四选一或空）。后续可扩展音色级。
    vmPitch: 0,
    vmIntensity: 0,
    vmTimbre: 0,
    soundEffects: '',
    soundFxAuto: false,          // 音效自动化：开则提取模型按语境给每句挑音效(per-line fx)，覆盖全局。靠模型智商·不稳定·默认关
    // 按音色(voiceId)的音效器覆盖：{ [voiceId]: {vmPitch,vmIntensity,vmTimbre,soundEffects} }。
    // 有则该音色处处覆盖全局 T3（音效仍让位于自动化 per-line fx）。音色库小铅笔弹窗内「高级·音效器」折叠区编辑。
    voiceFxById: {},
    // 提取（人设参照）：人设默认注入(取材式·让情绪有性格基线、"我/你"锚定身份)。世界书取材式——刷新→下拉多选书→选中书展开条目勾选。
    // 注：世界书「选择」本身按聊天存(getChatStore.ttsExtractWorldBooks/ttsExtractWorldItems)·不同聊天各自绑定；下面两折叠态为全局 UI 偏好。
    extractWbFoldOpen: true,     // 下拉「选择」折叠态（持久·全局 UI 偏好）
    extractItemsFoldOpen: true,  // 条目列折叠态（持久·全局 UI 偏好）
    extractPrompt: '',           // 自定义台词提取系统提示词（空=用内置默认 TTS_EXTRACT_SYSTEM）
    extractPromptBackup: null,   // 「恢复上次」：方案载入/重置覆盖前自动备份
    guidanceSchemes: [],         // 台词指导方案库：[{ id, name, folder, content, createdAt }]
    testText: '你好，这是一段试听。',   // 统一试听台词
    npcEnabled: false,           // NPC 泛用音色：未在本聊天映射命中的说话人按原型库自动归类，默认关
    npcArchetypes: [],           // NPC 原型音色库：[{ id, label, voiceId }]（label 如「严肃老年男」）
    npcAssignByChat: {},         // 按聊天记忆「说话人→原型 id」：{ chatKey: { speaker: archId } }，熟脸 NPC 不漂移
  },
  theater: {
    instruction: '',
    apiProfileId: '',
    presetName: '',
    presetItems: {},
    scripts: [],
    favorites: [],
    lastOutput: null,
    readerFontScale: 'medium',
    useChatHistory: true,
    historyDepth: 5,
  },
  // 共读电子书模块：与推演主体无关的独立模块，命名空间隔离在此，零侵入主流程。
  // 重数据（书正文/封面/会话/检索日志）在 IndexedDB(qianmu-blobstore)，此处只存轻量书目索引 + 阅读偏好。
  coread: {
    enabled: false,                 // 总开关，默认关
    books: [],                      // 轻量书目索引：[{ id, title, author, addedAt, chapterCount, charCount, tags:[], boundChar, progress, lastChapterIndex, lastScrollRatio, ragEnabled }]，正文在 IndexedDB
    libViewMode: 'grid',            // 书架视图：grid | list
    libSort: 'addedAt-desc',        // 排序：title/author/progress/addedAt × asc/desc
    libTags: [],                    // 当前标签筛选
    // 阅读排版（阅读器跟随千幕主题与字体，不单选）
    fontSizePx: 19,
    lineHeight: 1.9,
    paraSpacing: 1.0,               // 段间距（em 倍率）
    contentWidthRem: 42,            // 正文宽度（rem，滑动条 28–66）
    justify: false,                 // 两端对齐
    spacingPreset: 'normal',        // 间距预设：compact | normal | loose | custom
    hlColor: '',                    // 划线颜色（空＝跟随主题强调色）；新划线快照此色
    fallbackChapterChars: 2400,     // 分章失败时的字数兜底
    voiceCacheLimit: 100,           // 共读语音条缓存上限（条），用户可自定义
    bgCustom: '',                   // 阅读背景自定义 CSS（DIY，1B 接线）
    bubbleCustom: '',               // 对话气泡自定义 CSS（DIY，1B 接线）
    drawerHeight: 240,              // 对话抽屉高度(px)，可拖拽
    // 伴读设定层（1B·复用取材的拉取/呈现·选择独立·身份/人设默认跟随 ST 当前选择+千幕注入逻辑）
    companion: {
      worldBooks: [],               // 共读专属选中的世界书名（独立于主线选择·条目级勾选另存）
      worldItems: {},               // 共读专属世界书条目勾选 {bookName:{itemId:true/false}}（独立·条目级）
      visibleCharsBefore: 800,      // 书友可读范围：仅取「当前阅读位置前」N 字（防剧透·断句对齐）
      foldWbOpen: true,             // 设定浮层：世界书下拉展开态（持久·跨重开书）
      foldItemsOpen: true,          // 设定浮层：条目列展开态（持久·跨重开书）
    },
  },
});

let settings = null;
let activeTab = 'dashboard';
let theaterView = null; // null=常规；{mode:'read', scene}=阅读；{mode:'favorites'}=收藏夹
let readerView = null;  // 共读：null=书架；{ bookId, fullscreen, chapterIndex }=阅读器全屏子视图
let editorView = null;  // null=常规；{target, title, value, returnTab}=行内全屏编辑（沿用阅读页逻辑，不另开 body 窗口）
let ttsEditorReturnScroll = null;  // 进入行内编辑器前的正文滚动位，关闭后恢复（防弹回顶部）
let theaterScriptSource = '';   // 当前此幕指令来自哪个剧札标题；空=即兴（手动输入/未保存）
let chatterExpanded = false;       // 尘寰群生：false=动态浮现舞台，true=展开完整台本列表
let contextScanCache = { presets: {}, worldBooks: {}, presetNames: [], worldBookNames: [], currentPresetName: '', boundWorldBookNames: [], presetScannedAt: '', worldScannedAt: '' };
let contextAutoScanned = false;    // 本次 ST 会话内是否已自动补扫过取材（重进/刷新后首开取材页时懒加载一次）
let ttsExtractAutoScanned = false; // 同上·配音「人设参照」世界书：首开配音页时懒加载一次，让已选世界书/条目免刷新即显
let modalJustOpened = false;        // 仅本次「打开」后的首帧渲染加入场动画，之后的静默重渲染（刷新/扫描/切换）不再重播，消除闪动
let busy = false;                  // 推演忙碌态
let abortController = null;         // 推演中止句柄
let cancelRequested = false;       // 推演取消标记
let theaterBusy = false;           // 幕外忙碌态（与推演独立，允许并发）
let theaterAbort = null;           // 幕外中止句柄
let theaterCancel = false;         // 幕外取消标记
let initialized = false;
let eventBound = false;
let inputMenuObserver = null;
let templateExportMode = false;
let templateExportSelection = new Set();
let templateSearch = '';
let lastWorldView = '';   // 世界书下拉「最后选择」的查看项
let theaterExportMode = false;
let theaterExportSelection = new Set();
let ttsSchemeSearch = '';            // 台词指导方案库搜索
let ttsSchemeExportMode = false;     // 台词指导方案库多选导出态
let ttsSchemeExportSelection = new Set();
let injectSelection = new Map();   // 写入勾选持久化（id→text，跨重渲染/切主题/切标签保留，Map 顺序即勾选先后）
let accState = {};                 // 折叠面板开合状态记忆

function ctx() {
  return globalThis.SillyTavern?.getContext?.() || {};
}
// 当前聊天最后一层的索引（-1 表示空聊天）。自动推演用它判定「是不是真新增的一层」，重 roll 同层不重复计数
function lastChatIdx() {
  const chat = ctx().chat;
  return Array.isArray(chat) ? chat.length - 1 : -1;
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
    // 模板更新策略：新默认无条件覆盖现有模板；覆盖前，若当前是用户 DIY（非空、非历史默认、与上次默认哈希不符），
    // 先把这份 DIY 存进「恢复上次」备份，用户可一键找回。历史内置默认不算 DIY、不备份。
    const sys = String(s.systemPrompt || '');
    const sysUntouched = !sys.trim()
      || sys.includes('你是一位顶尖剧作家导演')
      || (sys.includes('顶尖剧作家导演') && !sys.includes('视角分工'))
      || sys.includes('执笔者（使用者）')
      || sys === DEFAULT_SYSTEM_PROMPT
      || (s.systemPromptHash && s.systemPromptHash === hashText(sys));
    if (!sysUntouched) s.systemPromptBackup = sys;   // 仅备份真·DIY
    s.systemPrompt = DEFAULT_SYSTEM_PROMPT;

    const schema = String(s.outputSchemaText || '');
    const isLegacySchemaDefault = schema.includes('schema_version')
      && (!schema.includes('全知导演镜头') || (schema.includes('导演评语：分析节奏') && !schema.includes('毒舌影评人')));
    const schemaUntouched = !schema.trim()
      || isLegacySchemaDefault
      || schema === JSON_SCHEMA_TEXT
      || (s.outputSchemaHash && s.outputSchemaHash === hashText(schema));
    if (!schemaUntouched) s.outputSchemaBackup = schema;   // 仅备份真·DIY
    s.outputSchemaText = JSON_SCHEMA_TEXT;

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
  s.globalWorldBookNames ||= {};
  // 预设勾选 按聊天 → 全局 一次性迁移（取条目最丰富的那个聊天作为种子，避免丢失既有搭配）
  s.selectedPresetNames ||= {};
  s.selectedPresetItems ||= {};
  if (!s._presetGlobalMigrated) {
    if (!Object.keys(s.selectedPresetNames).length) {
      const pickRichest = (byChat) => Object.values(byChat || {})
        .reduce((best, cur) => (Object.keys(cur || {}).length > Object.keys(best || {}).length ? cur : best), {});
      const seedNames = pickRichest(s.selectedPresetNamesByChat);
      const seedItems = pickRichest(s.selectedPresetItemsByChat);
      if (Object.keys(seedNames).length) s.selectedPresetNames = clone(seedNames);
      if (Object.keys(seedItems).length) s.selectedPresetItems = clone(seedItems);
    }
    s._presetGlobalMigrated = true;
  }
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
    meta[MODULE_NAME] = { blueprint: DEFAULT_BLUEPRINT, plan: null, history: [], lastPlanIdx: -1, planAtLen: 0, updatedAt: '', threads: [], threadSeq: 0, factions: [], worldEvents: [], geoSeq: 0 };
  }
  mergeDefaults(meta[MODULE_NAME], { blueprint: DEFAULT_BLUEPRINT, plan: null, history: [], lastPlanIdx: -1, planAtLen: 0, updatedAt: '', threads: [], threadSeq: 0, factions: [], worldEvents: [], geoSeq: 0 });
  if (!Array.isArray(meta[MODULE_NAME].threads)) meta[MODULE_NAME].threads = [];   // 活幕·伏笔显影档案层
  if (!Array.isArray(meta[MODULE_NAME].factions)) meta[MODULE_NAME].factions = [];   // 活幕·势：势力/地缘格局层
  if (!Array.isArray(meta[MODULE_NAME].worldEvents)) meta[MODULE_NAME].worldEvents = [];   // 活幕·势：世界事件层
  if (!meta[MODULE_NAME].ttsLines || typeof meta[MODULE_NAME].ttsLines !== 'object') meta[MODULE_NAME].ttsLines = {};   // 有声：已提取台词列表 内容指纹key→lines，持久化跨刷新
  if (!meta[MODULE_NAME].ttsLineKeyByMes || typeof meta[MODULE_NAME].ttsLineKeyByMes !== 'object') meta[MODULE_NAME].ttsLineKeyByMes = {};   // 有声：楼层mesid→最近一次台词key，原地编正文后凭此+台词原文在场校验迁移缓存（免重提）
  if (!Array.isArray(meta[MODULE_NAME].ttsVoiceMap)) meta[MODULE_NAME].ttsVoiceMap = [];   // 有声：本聊天角色→音色映射，按聊天切配置（类比推演按聊天）
  if (isLegacyBlueprint(meta[MODULE_NAME].blueprint) && !meta[MODULE_NAME].blueprintEdited) {
    meta[MODULE_NAME].blueprint = DEFAULT_BLUEPRINT;
  }
  // 剧本模板更新：BLUEPRINT_REVISION 升档后，新默认覆盖本聊天剧本；覆盖前若为用户 DIY 则备份进「恢复上次」。
  // 新建 store 的 blueprint 即默认值、不算 DIY，只盖版本号不备份；故仅真·DIY 会写入 blueprintBackup。
  if (Number(meta[MODULE_NAME].blueprintRevision || 0) < BLUEPRINT_REVISION) {
    const bp = String(meta[MODULE_NAME].blueprint || '');
    const bpDiy = !!meta[MODULE_NAME].blueprintEdited && bp.trim()
      && !isLegacyBlueprint(bp) && bp !== DEFAULT_BLUEPRINT;
    if (bpDiy) meta[MODULE_NAME].blueprintBackup = bp;
    meta[MODULE_NAME].blueprint = DEFAULT_BLUEPRINT;
    meta[MODULE_NAME].blueprintEdited = false;
    meta[MODULE_NAME].blueprintRevision = BLUEPRINT_REVISION;
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

let uidCounter = 0;
function uid(prefix = 'id') {
  uidCounter = (uidCounter + 1) % 1000000;
  const rand = globalThis.crypto?.randomUUID ? globalThis.crypto.randomUUID().slice(0, 8) : Math.random().toString(36).slice(2, 9);
  return `${prefix}-${Date.now().toString(36)}-${uidCounter.toString(36)}-${rand}`;
}

// 导出文件名时间戳：本地时区 YYYY-MM-DD_HH-MM-SS
function fileStamp() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}_${p(d.getHours())}-${p(d.getMinutes())}-${p(d.getSeconds())}`;
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
  const power = globalThis.power_user || context.power_user || context.powerUserSettings || {};
  // ST 当前激活人设的描述存于 power_user.persona_description；多版本字段不一，取不到则回落 {{persona}} 宏，
  // 交由 resolveMacro（优先 ctx().substituteParams）跨版本稳定解析（描述内可能再嵌 {{char}}/{{user}}）
  return power.persona_description || context.persona_description || globalThis.persona_description || '{{persona}}';
}

function getPersonaName() {
  const context = ctx();
  const power = globalThis.power_user || context.power_user || context.powerUserSettings || {};
  // name1 = ST 当前用户/人设显示名；取不到回落 {{user}} 宏由 substituteParams 解析
  return context.name1 || globalThis.name1 || power.persona || '{{user}}';
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
  const lines = recent.map((m) => {
    const role = m.is_user ? '<user>' : (m.name || '<char>');
    const text = cleanContextText(m.mes || '');
    return text ? `${role}: ${text}` : '';
  }).filter(Boolean);
  return capByBudget(lines).join('\n');
}

// 上下文长度预算（字符近似 token）软裁剪：从最近一层往前累加，超出即停，优先保留最近楼层。
// 全局统一上限，推演与幕外各自独立调用、互不污染。0 或未设视为不限。
function capByBudget(lines) {
  const budget = Number(settings.contextBudget || 0);
  if (!(budget > 0)) return lines;
  const kept = [];
  let total = 0;
  for (let i = lines.length - 1; i >= 0; i--) {
    total += lines[i].length + 1;
    if (total > budget && kept.length) break;
    kept.unshift(lines[i]);
  }
  return kept;
}

// 幕外专用：取最近 N 层「可见」楼层原文（过滤被记忆/隐藏插件标记的 is_system 楼），再走全局上下文长度软裁剪。
// 与推演 getChatHistoryText 完全独立：自己的楼层数，互不污染。
function getTheaterChatHistoryText() {
  const context = ctx();
  const chat = Array.isArray(context.chat) ? context.chat : [];
  const depth = Math.max(1, Math.min(200, Number(getTheater().historyDepth || 5)));
  const visible = chat.filter((m) => m && m.is_system !== true);
  const recent = visible.slice(-depth);
  const lines = recent.map((m) => {
    const role = m.is_user ? '<user>' : (m.name || '<char>');
    const text = cleanContextText(m.mes || '');
    return text ? `${role}: ${text}` : '';
  }).filter(Boolean);
  return capByBudget(lines).join('\n');
}

function processRandomMacros(text) {
  return String(text || '').replace(/\{\{random:(.*?)\}\}/gi, (_, raw) => {
    const options = raw.split(',').map((x) => x.trim()).filter(Boolean);
    return options.length ? options[Math.floor(Math.random() * options.length)] : '';
  });
}

async function resolveMacro(text) {
  try {
    // ST 官方稳定入口是 getContext().substituteParams；globalThis 上不一定挂得到（导入全局函数不可靠）。
    // 故优先取 context 版，回落 globalThis 版，再回落原文。{{persona}}/{{user}} 等宏由它解析。
    const context = ctx();
    const sub = (typeof context?.substituteParams === 'function')
      ? context.substituteParams
      : (typeof globalThis.substituteParams === 'function' ? globalThis.substituteParams : null);
    if (sub) {
      let result = sub(text);
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

function groupByFolder(items, getFolder, getName, sortAlpha) {
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
  // 文件夹始终按名字母序（在上）；开启 sortAlpha 时，文件夹内条目与散条目（在下）也按名字母序
  if (sortAlpha && typeof getName === 'function') {
    const byName = (a, b) => String(getName(a) || '').localeCompare(String(getName(b) || ''), 'zh');
    for (const list of folders.values()) list.sort(byName);
    loose.sort(byName);
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
  const { folderList, loose } = groupByFolder(items, cfg.getFolder, cfg.getName, cfg.sortAlpha);
  const folderHtml = folderList.map(({ name, list }) => {
    const folderPick = cfg.exportMode
      ? `<label class="sd-lib-folder-pick" title="选择整个文件夹"><input type="checkbox" class="sd-lib-folder-select" ${list.length && list.every((it) => cfg.selection.has(it.id)) ? 'checked' : ''}></label>`
      : '';
    return `
    <details class="sd-lib-folder" data-acc="${cfg.ns}-folder-${htmlEscape(name)}">
      <summary>${folderPick}<i class="fa-solid fa-folder"></i><b>${htmlEscape(name)}</b><span>${list.length}</span></summary>
      <div class="sd-lib-folder-body">${list.map((it) => renderLibraryRow(cfg, it)).join('')}</div>
    </details>`;
  }).join('');
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
    ? `<div class="sd-export-bar"><button type="button" class="sd-btn sd-mini-btn sd-lib-select-all">全选</button><span class="sd-export-hint">已选 <span class="sd-lib-sel-count">${cfg.selection.size}</span> 项</span><button type="button" class="sd-btn sd-mini-btn sd-danger sd-lib-batch-delete">删除</button><button type="button" class="sd-btn sd-mini-btn sd-lib-confirm-export">导出</button><button type="button" class="sd-btn sd-mini-btn sd-lib-cancel-export">取消</button></div>`
    : '';
  return `
      <div class="sd-lib-scope" data-lib="${htmlEscape(cfg.ns)}">
      <div class="sd-template-head">
        <h3>${htmlEscape(cfg.title)}</h3>
        <div class="sd-template-io-buttons">
          <label class="sd-icon-btn sd-file-label sd-lib-import-label" title="导入" aria-label="导入"><i class="fa-solid fa-file-import"></i><input type="file" accept="application/json" class="sd-lib-import"></label>
          <button type="button" class="sd-icon-btn sd-lib-export-toggle ${cfg.exportMode ? 'active' : ''}" title="多选" aria-label="多选"><i class="fa-solid fa-square-check"></i></button>
        </div>
        <span class="sd-tpl-count">${all.length} 个</span>
      </div>
      ${exportBar}
      <input type="search" class="text_pole sd-lib-search" placeholder="${htmlEscape(cfg.searchPlaceholder || '搜索标题…')}" value="${htmlEscape(search)}">
      <div class="sd-lib-list sd-scroll">${renderLibraryListBody(cfg, matched)}</div>
      </div>`;
}

// 绑定通用库事件。handlers: { onLoad, onEdit, onDelete, onImport, onExport, rebuildCfg }
function bindLibraryEvents(rootEl, makeCfg, handlers) {
  const cfg = makeCfg();
  // 作用域隔离：只在本库自己的容器内查询，绝不串到另一个库（剧本库 / 剧札共用同套 class）
  const root = rootEl.querySelector(`.sd-lib-scope[data-lib="${cfg.ns}"]`);
  if (!root) return;   // 当前标签未渲染该库，跳过
  const updateSelCount = () => {
    const c = makeCfg();
    const cnt = root.querySelector('.sd-lib-sel-count');
    if (cnt) cnt.textContent = String(c.selection.size);
  };
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
      updateSelCount();
      const fold = el.closest('.sd-lib-folder');
      const fpick = fold?.querySelector('.sd-lib-folder-select');
      if (fpick) {
        const boxes = [...fold.querySelectorAll('.sd-lib-select')];
        fpick.checked = boxes.length > 0 && boxes.every((b) => b.checked);
      }
    }));
    root.querySelectorAll('.sd-lib-folder-select').forEach((el) => el.addEventListener('click', (e) => e.stopPropagation()));
    root.querySelectorAll('.sd-lib-folder-select').forEach((el) => el.addEventListener('change', () => {
      const c = makeCfg();
      const fold = el.closest('.sd-lib-folder');
      fold?.querySelectorAll('.sd-lib-select').forEach((box) => {
        box.checked = el.checked;
        if (el.checked) c.selection.add(box.dataset.id);
        else c.selection.delete(box.dataset.id);
      });
      updateSelCount();
    }));
  };
  root.querySelector('.sd-lib-search')?.addEventListener('input', (e) => {
    cfg.setSearch(e.target.value || '');
    refreshList();
  });
  root.querySelector('.sd-lib-export-toggle')?.addEventListener('click', handlers.onToggleExport);
  root.querySelector('.sd-lib-cancel-export')?.addEventListener('click', handlers.onCancelExport);
  root.querySelector('.sd-lib-confirm-export')?.addEventListener('click', handlers.onConfirmExport);
  root.querySelector('.sd-lib-batch-delete')?.addEventListener('click', handlers.onBatchDelete);
  root.querySelector('.sd-lib-select-all')?.addEventListener('click', () => {
    const c = makeCfg();
    const search = c.getSearch();
    const matched = search ? c.items.filter((it) => String(c.getName(it) || '').toLowerCase().includes(search.toLowerCase())) : c.items;
    const allSelected = matched.length > 0 && matched.every((it) => c.selection.has(it.id));
    if (allSelected) matched.forEach((it) => c.selection.delete(it.id));
    else matched.forEach((it) => c.selection.add(it.id));
    refreshList();
    updateSelCount();
  });
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

// 剧名 + 文件夹弹窗（保存到剧札用）：占位符提示、无默认填充
async function promptNameAndFolder({ dialogTitle, namePlaceholder, name = '', folder = '' }) {
  const context = ctx();
  const Popup = context.Popup;
  if (Popup && context.POPUP_TYPE) {
    const wrap = document.createElement('div');
    wrap.className = 'sd-lib-edit-form';
    wrap.innerHTML = `
      <input type="text" class="text_pole sd-nf-name" placeholder="${htmlEscape(namePlaceholder || '名称')}" style="width:100%;margin:0 0 10px">
      <input type="text" class="text_pole sd-nf-folder" placeholder="文件夹（留空则不分类）" style="width:100%;margin:0">`;
    wrap.querySelector('.sd-nf-name').value = name || '';
    wrap.querySelector('.sd-nf-folder').value = folder || '';
    try {
      const popup = new Popup(wrap, context.POPUP_TYPE.CONFIRM, '', { okButton: '保存', cancelButton: '取消' });
      const ok = await popup.show();
      if (!ok) return null;
      return {
        name: String(wrap.querySelector('.sd-nf-name').value || '').trim(),
        folder: sanitizeFolder(wrap.querySelector('.sd-nf-folder').value),
      };
    } catch (_) {}
  }
  const newName = await promptInput(dialogTitle, `${namePlaceholder || '名称'}：`, name || '');
  if (newName === null) return null;
  const newFolder = await promptInput(dialogTitle, '文件夹（留空不分类）：', folder || '');
  if (newFolder === null) return null;
  return { name: String(newName || '').trim(), folder: sanitizeFolder(newFolder) };
}

// 音色库条目弹窗：音色名 + 音色 ID（沿用剧札 Popup 交互，无 textarea）
// withKeywords=true（NPC 原型用）：额外加「关键词描述」字段，喂给提取模型辅助声线归类（仅输入提示，不参与本地匹配/记忆）
async function promptVoiceLibEntry({ dialogTitle, name = '', voiceId = '', folder = '', keywords = '', nameLabel = '音色名', namePlaceholder = '如 活泼少女音', withKeywords = false, withFx = false, fx = null }) {
  const context = ctx();
  const Popup = context.Popup;
  if (Popup && context.POPUP_TYPE) {
    const wrap = document.createElement('div');
    wrap.className = 'sd-lib-edit-form';
    const kwField = withKeywords
      ? `<label style="display:block;text-align:left;margin:0 0 4px">关键词描述<span style="opacity:.6;font-weight:400">（辅助提取模型判断声线，越具体越准）</span></label>
         <input type="text" class="text_pole sd-vl-kw" placeholder="如 大学生、干净、18-25岁清朗音" style="width:100%;margin:0 0 10px">`
      : '';
    const f = isPlainObject(fx) ? fx : {};
    const fxField = withFx
      ? `<details class="sd-vl-fx" style="margin-top:12px;text-align:left">
           <summary style="cursor:pointer">高级 · 音效器</summary>
           <div style="padding:8px 2px 0">
             <label style="display:block;margin:0 0 2px">音高（低沉↔明亮）<b class="sd-vlfx-pitch-val">${Number(f.vmPitch ?? 0)}</b></label>
             <input type="range" class="sd-vlfx-pitch" min="-100" max="100" step="5" value="${Number(f.vmPitch ?? 0)}" style="width:100%">
             <label style="display:block;margin:6px 0 2px">强度（刚劲↔轻柔）<b class="sd-vlfx-intensity-val">${Number(f.vmIntensity ?? 0)}</b></label>
             <input type="range" class="sd-vlfx-intensity" min="-100" max="100" step="5" value="${Number(f.vmIntensity ?? 0)}" style="width:100%">
             <label style="display:block;margin:6px 0 2px">音色（浑厚↔清脆）<b class="sd-vlfx-timbre-val">${Number(f.vmTimbre ?? 0)}</b></label>
             <input type="range" class="sd-vlfx-timbre" min="-100" max="100" step="5" value="${Number(f.vmTimbre ?? 0)}" style="width:100%">
             <label style="display:block;margin:8px 0 2px">音效</label>
             <select class="text_pole sd-vlfx-soundfx" style="width:100%">${MINIMAX_SOUND_EFFECTS.map((o) => `<option value="${o.value}" ${(f.soundEffects || '') === o.value ? 'selected' : ''}>${o.label}</option>`).join('')}</select>
           </div>
         </details>`
      : '';
    wrap.innerHTML = `
      <label style="display:block;text-align:left;margin:0 0 4px">${htmlEscape(nameLabel)}</label>
      <input type="text" class="text_pole sd-vl-name" placeholder="${htmlEscape(namePlaceholder)}" style="width:100%;margin:0 0 10px">
      ${kwField}
      <label style="display:block;text-align:left;margin:0 0 4px">音色 ID</label>
      <input type="text" class="text_pole sd-vl-id" placeholder="MiniMax Voice ID" style="width:100%;margin:0 0 10px">
      <label style="display:block;text-align:left;margin:0 0 4px">文件夹</label>
      <input type="text" class="text_pole sd-vl-folder" placeholder="留空则不分类" style="width:100%;margin:0">
      ${fxField}`;
    wrap.querySelector('.sd-vl-name').value = name || '';
    wrap.querySelector('.sd-vl-id').value = voiceId || '';
    wrap.querySelector('.sd-vl-folder').value = folder || '';
    if (withKeywords) wrap.querySelector('.sd-vl-kw').value = keywords || '';
    if (withFx) {
      // 滑块实时回显
      wrap.querySelectorAll('.sd-vl-fx input[type=range]').forEach((el) => {
        const out = el.parentElement.querySelector(`.sd-vlfx-${el.className.match(/sd-vlfx-(\w+)/)?.[1]}-val`);
        el.addEventListener('input', () => { if (out) out.textContent = String(Math.round(el.value)); });
      });
    }
    try {
      const popup = new Popup(wrap, context.POPUP_TYPE.CONFIRM, '', { okButton: '保存', cancelButton: '取消' });
      const ok = await popup.show();
      if (!ok) return null;
      const out = {
        name: String(wrap.querySelector('.sd-vl-name').value || '').trim(),
        voiceId: String(wrap.querySelector('.sd-vl-id').value || '').trim(),
        folder: sanitizeFolder(wrap.querySelector('.sd-vl-folder').value),
        keywords: withKeywords ? String(wrap.querySelector('.sd-vl-kw').value || '').trim() : '',
      };
      if (withFx) {
        out.fx = {
          vmPitch: Number(wrap.querySelector('.sd-vlfx-pitch').value) || 0,
          vmIntensity: Number(wrap.querySelector('.sd-vlfx-intensity').value) || 0,
          vmTimbre: Number(wrap.querySelector('.sd-vlfx-timbre').value) || 0,
          soundEffects: String(wrap.querySelector('.sd-vlfx-soundfx').value || ''),
        };
      }
      return out;
    } catch (_) {}
  }
  const newName = await promptInput(dialogTitle, `${nameLabel}：`, name || '');
  if (newName === null) return null;
  let newKw = '';
  if (withKeywords) {
    const kw = await promptInput(dialogTitle, '关键词描述（辅助判断声线，可空）：', keywords || '');
    if (kw === null) return null;
    newKw = String(kw || '').trim();
  }
  const newId = await promptInput(dialogTitle, '音色 ID：', voiceId || '');
  if (newId === null) return null;
  const newFolder = await promptInput(dialogTitle, '文件夹（留空不分类）：', folder || '');
  if (newFolder === null) return null;
  return { name: String(newName || '').trim(), voiceId: String(newId || '').trim(), folder: sanitizeFolder(newFolder), keywords: newKw };
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

/* ============================================================
   世界书写入能力（共读模块反哺 / 通用）
   ── getWorldBookEntries 读链路的镜像，只新增、不改读取。
   ── ST 稳定写入路径=斜杠命令：/getchatbook（取或建聊天绑定世界书并绑定）、
      /createentry（建带默认值的空条目，返回 UID）、/setentryfield（填字段）。
      ST 内部会同步落盘 + 重载内存缓存，故无需手动 reload。
   ============================================================ */

// 执行一段斜杠命令脚本，返回管道末值（字符串）。优先 executeSlashCommandsWithOptions，兜底 executeSlashCommands。
async function runSlash(command) {
  const context = ctx();
  try {
    if (typeof context.executeSlashCommandsWithOptions === 'function') {
      const r = await context.executeSlashCommandsWithOptions(command, { handleParserErrors: true, handleExecutionErrors: true });
      return String(r?.pipe ?? '');
    }
  } catch (e) { console.warn(`[${MODULE_NAME}] executeSlashCommandsWithOptions failed`, command, e); }
  try {
    const exec = typeof context.executeSlashCommands === 'function'
      ? context.executeSlashCommands.bind(context)
      : (typeof globalThis.executeSlashCommands === 'function' ? globalThis.executeSlashCommands : null);
    if (exec) {
      const r = await exec(command);
      return String(r?.pipe ?? '');
    }
  } catch (e) { console.warn(`[${MODULE_NAME}] executeSlashCommands failed`, command, e); }
  return '';
}

// 取或建当前聊天绑定的世界书（Chat Lore），返回其名；无绑定则 ST 自动创建并绑定。
async function getOrCreateChatBook() {
  const name = await runSlash('/getchatbook');
  return String(name || '').trim();
}

// 斜杠命令值转义：管道符 | 会终止命令，需转义；换行折叠为空格（共读总结本就精炼，避免破坏单条命令解析）。
function escapeSlashValue(s) {
  return String(s ?? '').replace(/\|/g, '\\|').replace(/\r?\n+/g, ' ').trim();
}

// 向指定世界书写入/更新一条目。opts: { book, uid?, comment?, content?, keys?:[], order?, position?, vectorized?, group? }
// 传 uid 则更新该条，否则新建（ST 填默认值）。dedup（uid 映射）由调用方管理，本函数不做模糊查重以免误改别条。
// 返回 uid 字符串（失败为 ''）。
async function writeWorldEntry(opts = {}) {
  const book = String(opts.book || '').trim();
  if (!book) return '';
  const fileArg = `file="${book.replace(/"/g, '')}"`;
  let uid = String(opts.uid ?? '').trim();
  if (!uid) {
    const keyArg = Array.isArray(opts.keys) && opts.keys.length
      ? `key=${opts.keys.map(escapeSlashValue).join(',')}` : '';
    uid = String(await runSlash(`/createentry ${fileArg} ${keyArg}`.trim()) || '').trim();
    if (!uid) return '';
  }
  const set = (field, val) => runSlash(`/setentryfield ${fileArg} uid=${uid} field=${field} ${val}`);
  if (opts.comment != null) await set('comment', escapeSlashValue(opts.comment));
  if (opts.content != null) await set('content', escapeSlashValue(opts.content));
  if (Array.isArray(opts.keys) && opts.keys.length) await set('key', opts.keys.map(escapeSlashValue).join(','));
  if (opts.order != null) await set('order', Number(opts.order));
  if (opts.position != null) await set('position', Number(opts.position));
  if (opts.vectorized != null) await set('vectorized', opts.vectorized ? 1 : 0);
  if (opts.group != null) await set('group', escapeSlashValue(opts.group));
  return uid;
}

// 删除世界书条目（按 uid）。
async function deleteWorldEntry(book, uid) {
  const b = String(book || '').trim();
  const u = String(uid ?? '').trim();
  if (!b || !u) return false;
  await runSlash(`/setentryfield file="${b.replace(/"/g, '')}" uid=${u} field=content `);   // 先清空内容
  await runSlash(`/setentryfield file="${b.replace(/"/g, '')}" uid=${u} field=disable 1`);   // 再禁用（ST 无标准删条斜杠，禁用即不参与召回）
  return true;
}

// 临时验证钩子（1A-1）：在 ST 控制台执行 await qmTestWorldWrite() 应能往当前聊天 Chat Lore 写入一条「千幕共读·测试」。
// 验证通过后将移除。
globalThis.qmTestWorldWrite = async function () {
  const book = await getOrCreateChatBook();
  if (!book) return { ok: false, reason: '无法取得/创建聊天世界书（executeSlashCommands 不可用？）' };
  const uid = await writeWorldEntry({
    book,
    comment: '千幕共读·测试',
    content: '这是一条由千幕共读模块写入的测试条目，确认写入链路通畅。',
    keys: ['千幕共读测试'],
    order: 100,
  });
  return { ok: !!uid, book, uid };
};

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

// 千幕界面是否处于打开态。幕外小剧场的完成/开卷提示只在界面内弹——关掉界面后台跑完不打扰 ST 正文
function isModalOpen() {
  return !!document.getElementById(MODAL_ID)?.classList.contains('open');
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

// 懒加载补扫：ST 重进/刷新后 contextScanCache 是空的（仅存于内存），勾选状态却留在 settings。
// 首开取材页时若尚未扫描过，则后台静默补扫一次，扫完重渲染，让面板照实回到「已读取 + 既有勾选」。
function maybeAutoScanContext() {
  if (contextAutoScanned) return;
  if (contextScanCache.presetScannedAt && contextScanCache.worldScannedAt) { contextAutoScanned = true; return; }
  contextAutoScanned = true;   // 先置位，避免渲染→扫描→重渲染→再扫描的循环
  refreshContextSources(false).catch((error) => console.warn(`[${MODULE_NAME}] auto scan context failed`, error));
}

// 配音「人设参照」世界书懒加载补扫：ST 重进/刷新后 contextScanCache 空（仅内存），但选择存在 settings.tts。
// 首开配音页时静默补扫一次——扫世界书名 + 拉「本聊天已选中的那些书」的条目，扫完重渲，让已选状态免刷新即显。
function maybeAutoScanTtsExtract() {
  if (ttsExtractAutoScanned) return;
  const sel = ttsExtractWorldBooks();
  if (!sel.length) { ttsExtractAutoScanned = true; return; }   // 没选过书就没什么要恢复的
  // 已扫过（缓存里这些书的条目都在）则无需再扫
  if (contextScanCache.worldScannedAt && sel.every((n) => Array.isArray(contextScanCache.worldBooks?.[n]))) { ttsExtractAutoScanned = true; return; }
  ttsExtractAutoScanned = true;   // 先置位，避免渲染→扫描→重渲染循环
  (async () => {
    try {
      await refreshWorldBooks(false);
      for (const n of sel) { if (!Array.isArray(contextScanCache.worldBooks?.[n])) await coreadEnsureWorldEntries(n); }
      rerenderIfOpen();
    } catch (error) { console.warn(`[${MODULE_NAME}] auto scan tts extract failed`, error); }
  })();
}

function getPresetNameStore() {
  // 预设名全局存储（不随聊天切换）
  settings.selectedPresetNames ||= {};
  return settings.selectedPresetNames;
}

function getPresetSelectionStore() {
  // 预设条目勾选全局存储
  settings.selectedPresetItems ||= {};
  return settings.selectedPresetItems;
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

function getGlobalWorldBookStore() {
  settings.globalWorldBookNames ||= {};
  return settings.globalWorldBookNames;
}

function isWorldBookGlobal(name) {
  return !!getGlobalWorldBookStore()[name];
}

function setWorldBookGlobal(name, isGlobal) {
  const store = getGlobalWorldBookStore();
  if (isGlobal) store[name] = true;
  else delete store[name];
  saveSettings();
}

function getSelectedWorldBookNames() {
  const store = getWorldNameStore();
  for (const name of detectBoundWorldBookNames()) {
    if (typeof store[name] === 'undefined') store[name] = true;
  }
  // 全局世界书：在每个聊天里默认计入引用；但若本聊天显式取消（store[name] === false）则尊重本地取消
  const globalNames = Object.keys(getGlobalWorldBookStore()).filter((n) => getGlobalWorldBookStore()[n]);
  const result = new Set(Object.entries(store).filter(([, sel]) => sel).map(([n]) => n));
  for (const name of globalNames) {
    if (store[name] !== false) result.add(name);
  }
  return [...result];
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

// 预设里的「标记条目」（charDescription / worldInfo / persona 等）本身无字面内容，
// 由 ST 在生成时填充。仅开预设时这些条目会被当成空而漏发，这里按 identifier 解析为真实内容。
async function resolvePresetMarker(item) {
  const id = String(item?.identifier || item?.name || '').toLowerCase();
  const isMarker = item?.marker === true || !(item?.content || item?.prompt || item?.message || item?.text);
  if (!isMarker) return null;
  // 角色设定 / 用户人设 / 世界书：基础引用已必然注入，预设里的同类标记跳过，避免重复
  if (id.includes('chardescription') || id === 'description') return null;
  if (id.includes('persona')) return null;
  if (id.includes('worldinfo') || id.includes('world_info') || id.includes('charlore') || id.includes('lore')) return null;
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
  return null;
}

// 读取当前角色绑定的世界书全部启用条目（复用于预设 worldInfo 标记解析与幕外默认上下文）
async function buildBoundWorldText() {
  const boundNames = uniqueClean([...detectBoundWorldBookNames(), ...(contextScanCache.boundWorldBookNames || [])]);
  const rows = [];
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
      if (!content) continue;
      const order = Number(item.order ?? item.insertion_order ?? item.priority ?? 100);
      rows.push({ order, block: `\n【${wbName}: ${title}】\n${cleanContextText(content)}\n` });
    }
  }
  return rows.sort((a, b) => a.order - b.order).map((r) => r.block).join('').trim();
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
  // 收集勾选的世界书条目，按 ST 的 position 分「角色定义前(0)」与「其余」两组，组内按 order 升序，
  // 尊重作者编排里最关键的语义（垫在人设前作背景 / 压在人设后作强调），但不强行还原 AN/示例/@深度等千幕无对应物的位置。
  const before = [];
  const after = [];
  for (const wbName of getSelectedWorldBookNames()) {
    const entries = contextScanCache.worldBooks?.[wbName] || [];
    for (const [index, item] of (entries || []).entries()) {
      const itemId = getContextItemId(item, index);
      if (!isWorldItemSelected(wbName, itemId)) continue;
      const title = item.name || item.comment || (Array.isArray(item.key) ? item.key.join(', ') : item.key) || `世界书条目 ${index + 1}`;
      let content = await resolveMacro(item.content || item.text || '');
      content = processRandomMacros(content);
      if (!content) continue;
      const pos = Number(item.position ?? item.insertion_position ?? 1);   // ST：0=角色定义前，其余归"后"
      const order = Number(item.order ?? item.insertion_order ?? item.priority ?? 100);
      const block = `\n【世界书 - ${wbName}: ${title}】\n${cleanContextText(content)}\n`;
      (pos === 0 ? before : after).push({ order, block });
    }
  }
  const byOrder = (a, b) => a.order - b.order;
  let output = '';
  // 角色定义前的世界书条目
  for (const e of before.sort(byOrder)) output += e.block;
  // 角色设定与用户人设：后台必然注入，前端不再提供开关。名字过宏解析，避免标题出现字面 {{user}}/{{char}}
  const charDesc = await resolveMacro(getCharacterDescription());
  if (charDesc) output += `\n【当前角色设定 - ${await resolveMacro(getCharacterName())}】\n${cleanContextText(charDesc)}\n`;
  const userDesc = await resolveMacro(getPersonaDescription());
  if (userDesc) output += `\n【用户人设 - ${await resolveMacro(getPersonaName())}】\n${cleanContextText(userDesc)}\n`;
  // 角色定义后（含 ST 中 AN/示例/@深度等位置，千幕统一归此）
  for (const e of after.sort(byOrder)) output += e.block;
  return output.trim();
}

/* ============================================================
   暗线注入系统
   ============================================================ */

function snip(text, n = 64) {
  const value = String(text || '').replace(/\s+/g, ' ').trim();
  return value.length > n ? `${value.slice(0, n)}…` : value;
}

// 注入预览/注入段的字数弹性档：按各字段要求生成字数的约 2 倍设上限，留足溢出余地。
// 生成那点字数本就 OK，截断纯属显示问题——统一抬到弹性档，根除「人物暗流/关系暗涌/世界大势」等显示不全。
// 改这一处即可整体调节，三个 digest 函数（buildPlanDigest/buildThreadsDigest/buildGeopoliticsDigest）共用。
const INJ_LEN = {
  label: 60,    // 短名/标题/起点/时机/阶段名：title、name、spark、timing
  line: 150,    // 一句话字段：objective、content、tension、drift、essence、hidden_agenda、note、next_action、mood
  parties: 100, // 多名当事方
  chain: 240,   // 多环因果链
  arc: 120,     // 当前幕弧线
};

/* ============================================================
   活幕·伏笔显影：暗线档案承接（跨推演的持续身份层）
   纯函数，无副作用；store 来自 chatMetadata，与 plan 平级、独立累积。
   ============================================================ */
function sanitizeStage(stage) {
  return STAGE_LADDER.includes(stage) ? stage : '铺陈';
}

// 顺势升一档（不越过「落幕」）
function advanceStage(stage) {
  const idx = STAGE_LADDER.indexOf(sanitizeStage(stage));
  return STAGE_LADDER[Math.min(idx + 1, STAGE_LADDER.length - 1)];
}

// 把本次推演返回的 threads 合并进档案：按 id 承接旧线、升降显影、归档终局、收纳新线。
// store：getChatStore() 结果；incoming：plan.threads（模型回传，可空）。原地更新 store.threads。
function mergeThreads(store, incoming) {
  const round = Number(store.threadSeq || 0) + 1;
  store.threadSeq = round;
  const list = Array.isArray(store.threads) ? store.threads : (store.threads = []);
  const byId = new Map(list.map((t) => [t.id, t]));
  const seen = new Set();

  for (const raw of Array.isArray(incoming) ? incoming : []) {
    if (!raw || (!raw.title && !raw.id)) continue;
    const touched = ['advance', 'mention', 'idle'].includes(raw.touched) ? raw.touched : 'mention';
    const reqStatus = ['active', 'dormant', 'closed'].includes(raw.status) ? raw.status : 'active';
    let t = raw.id ? byId.get(raw.id) : null;
    if (t) {
      // 承接已有暗线
      if (raw.title) t.title = String(raw.title).slice(0, 24);
      if (raw.essence) t.essence = String(raw.essence).slice(0, 120);
      const prevStage = t.stage;
      t.stage = touched === 'advance' ? advanceStage(raw.stage || t.stage) : sanitizeStage(raw.stage || t.stage);
      // 钉住的暗线模型不得擅自沉睡/归档（除非已推到落幕）
      t.status = (t.pinned && reqStatus !== 'active' && t.stage !== '落幕') ? 'active' : reqStatus;
      if (touched === 'idle') t.silentRounds = Number(t.silentRounds || 0) + 1;
      else { t.silentRounds = 0; t.lastTouched = round; }
      if (raw.note || t.stage !== prevStage) {
        t.trail = Array.isArray(t.trail) ? t.trail : [];
        t.trail.push({ round, stage: t.stage, note: snip(raw.note || `${prevStage}→${t.stage}`, 40) });
        if (t.trail.length > 12) t.trail = t.trail.slice(-12);
      }
    } else {
      // 新埋暗线
      t = {
        id: uid('thread'),
        title: String(raw.title || '未命名暗线').slice(0, 24),
        essence: String(raw.essence || '').slice(0, 120),
        stage: sanitizeStage(raw.stage),
        pinned: false,
        origin: round,
        lastTouched: round,
        silentRounds: 0,
        status: reqStatus,
        trail: [{ round, stage: sanitizeStage(raw.stage), note: snip(raw.note || '初次埋线', 40) }],
      };
      list.unshift(t);
      byId.set(t.id, t);
    }
    seen.add(t.id);
  }

  // 本幕模型未提及的暗线：沉寂计数 +1；过久无人问津且未钉住则自然沉睡
  for (const t of list) {
    if (seen.has(t.id) || t.status === 'closed') continue;
    t.silentRounds = Number(t.silentRounds || 0) + 1;
    if (!t.pinned && t.status === 'active' && t.silentRounds >= 4) t.status = 'dormant';
  }

  // 归档落幕：已 closed 的保留少量供回看，超量裁掉最旧的
  const active = list.filter((t) => t.status !== 'closed');
  const closed = list.filter((t) => t.status === 'closed');
  store.threads = [...active.slice(0, 24), ...closed.slice(0, 8)];
}

/* ============================================================
   活幕·势：势力格局 / 世界事件的跨推演续命（自成脉络的世界引擎）
   思路同伏笔显影：用 LLM 当「推演引擎」吐质性局势变化，不做数值模拟；
   状态跨幕续命，「你不看也在变」靠推演时世界时钟往前演——零后台循环、零 tick。
   ============================================================ */
function sanitizeEventStage(stage) {
  return EVENT_STAGE_LADDER.includes(stage) ? stage : '酝酿';
}
function advanceEventStage(stage) {
  const idx = EVENT_STAGE_LADDER.indexOf(sanitizeEventStage(stage));
  return EVENT_STAGE_LADDER[Math.min(idx + 1, EVENT_STAGE_LADDER.length - 1)];
}
const FACTION_TRENDS = ['rising', 'stable', 'declining', 'turbulent'];
const FACTION_SCALES = ['城邦内', '区域性', '跨区域', '全局性'];
const GEO_REVIEW_CYCLE = 3;   // 格局「体检」节奏：每 N 个推演轮（geoSeq）做一次新陈代谢模态判断，其余轮专注演进、阵容稳定

// 把势力名/id 归一到一个稳定 key（关系连线两端要对齐到 faction 真身）
function resolveFactionKey(ref, byId, byName) {
  const s = String(ref || '').trim();
  if (!s) return '';
  if (byId.has(s)) return s;
  const f = byName.get(s);
  return f ? f.id : '';
}

// 把本次推演返回的 factions / faction_relations / world_events 并进档案：
// 势力按 id 承接、关系按无序对去重续命、事件按 id 跨幕升降阶段。原地更新 store。
function mergeGeopolitics(store, plan) {
  const round = Number(store.geoSeq || 0) + 1;
  store.geoSeq = round;

  // ---- 势力 ----
  const fList = Array.isArray(store.factions) ? store.factions : (store.factions = []);
  const fById = new Map(fList.map((f) => [f.id, f]));
  const fByName = new Map(fList.map((f) => [String(f.name || '').trim(), f]));
  const fSeen = new Set();
  const rawIdMap = new Map();   // 模型本次回传的 raw.id → 最终落地的 faction id（新势力会被重分配 id，relations 的 between 仍可能引用 raw.id，靠此兜底解析）
  for (const raw of Array.isArray(plan?.factions) ? plan.factions : []) {
    if (!raw || (!raw.name && !raw.id)) continue;
    let f = raw.id ? fById.get(raw.id) : (raw.name ? fByName.get(String(raw.name).trim()) : null);
    const trend = FACTION_TRENDS.includes(raw.trend) ? raw.trend : 'stable';
    const scale = FACTION_SCALES.includes(raw.scale) ? raw.scale : '区域性';
    // 线索点：schema 引导 6-15 字短句、最多 5 条。slice 上限放宽到 30 作防御，模型偶尔超长也完整保留、靠气泡换行显示，不半截截断
    const clues = Array.isArray(raw.clues)
      ? raw.clues.map((c) => String(c || '').trim().slice(0, 30)).filter(Boolean).slice(0, 5)
      : null;
    if (f) {
      if (raw.name) f.name = String(raw.name).slice(0, 16);
      if (raw.type) f.type = String(raw.type).slice(0, 12);
      if (raw.agenda) f.agenda = String(raw.agenda).slice(0, 80);
      if (raw.standing) f.standing = String(raw.standing).slice(0, 80);
      f.trend = trend;
      f.scale = scale;
      if (clues && clues.length) f.clues = clues;   // 本幕给了新线索就刷新，否则沿用旧的
      f.lastTouched = round;
    } else {
      f = {
        id: uid('fac'),
        name: String(raw.name || '未命名势力').slice(0, 16),
        type: String(raw.type || '').slice(0, 12),
        agenda: String(raw.agenda || '').slice(0, 80),
        standing: String(raw.standing || '').slice(0, 80),
        trend, scale, clues: clues || [], origin: round, lastTouched: round,
      };
      fList.unshift(f);
      fById.set(f.id, f);
      if (f.name) fByName.set(f.name, f);
    }
    if (raw.id) rawIdMap.set(String(raw.id), f.id);   // 旧 id → 实际 id（即便势力被重分配新 id，模型回传的 between 仍能命中）
    fSeen.add(f.id);
  }
  // 久未提及的势力自然退场（保留近况，避免格局无限膨胀）
  store.factions = fList.filter((f) => fSeen.has(f.id) || round - Number(f.lastTouched || 0) < 5).slice(0, 12);

  // ---- 势力关系（无序对去重，全量替换为本幕回传 + 仍存活的旧关系）----
  const liveIds = new Set(store.factions.map((f) => f.id));
  const byId = new Map(store.factions.map((f) => [f.id, f]));
  const byName = new Map(store.factions.map((f) => [String(f.name || '').trim(), f]));
  const relMap = new Map();
  const pairKey = (a, b) => [a, b].sort().join('::');
  // between 引用解析：先按当前 id/name，再回退到「模型回传 raw.id → 实际 id」映射（解决清空重推后 id 被重分配致关系全断的问题）
  const resolveBetween = (ref) => {
    const direct = resolveFactionKey(ref, byId, byName);
    if (direct) return direct;
    const mapped = rawIdMap.get(String(ref || '').trim());
    return mapped && liveIds.has(mapped) ? mapped : '';
  };
  // 先保留上幕仍然两端都在的关系
  for (const r of Array.isArray(store.factionRelations) ? store.factionRelations : []) {
    if (liveIds.has(r.a) && liveIds.has(r.b)) relMap.set(pairKey(r.a, r.b), r);
  }
  for (const raw of Array.isArray(plan?.faction_relations) ? plan.faction_relations : []) {
    const pair = Array.isArray(raw?.between) ? raw.between : [];
    const a = resolveBetween(pair[0]);
    const b = resolveBetween(pair[1]);
    if (!a || !b || a === b) continue;
    const kind = FACTION_RELATION_KINDS.includes(raw.kind) ? raw.kind : '张力';
    // 依附为单向：a 依附 b，保留方向
    const rec = kind === '依附' ? { a, b, kind, note: String(raw.note || '').slice(0, 70), dir: true }
                                 : { a, b, kind, note: String(raw.note || '').slice(0, 70) };
    relMap.set(pairKey(a, b), rec);
  }
  store.factionRelations = Array.from(relMap.values()).slice(0, 16);

  // ---- 世界事件 ----
  const eList = Array.isArray(store.worldEvents) ? store.worldEvents : (store.worldEvents = []);
  const eById = new Map(eList.map((e) => [e.id, e]));
  const eByTitle = new Map(eList.map((e) => [String(e.title || '').trim(), e]));
  const eSeen = new Set();
  for (const raw of Array.isArray(plan?.world_events) ? plan.world_events : []) {
    if (!raw || (!raw.title && !raw.id)) continue;
    const touched = ['advance', 'mention', 'idle'].includes(raw.touched) ? raw.touched : 'mention';
    const reqStatus = raw.status === 'closed' ? 'closed' : 'active';
    let e = raw.id ? eById.get(raw.id) : (raw.title ? eByTitle.get(String(raw.title).trim()) : null);
    if (e) {
      if (raw.title) e.title = String(raw.title).slice(0, 18);
      if (raw.essence) e.essence = String(raw.essence).slice(0, 100);
      if (raw.scope) e.scope = String(raw.scope).slice(0, 64);
      if (raw.drift) e.drift = String(raw.drift).slice(0, 70);
      const prev = e.stage;
      e.stage = touched === 'advance' ? advanceEventStage(raw.stage || e.stage) : sanitizeEventStage(raw.stage || e.stage);
      e.status = e.stage === '落定' ? 'closed' : reqStatus;
      if (touched === 'idle') e.silentRounds = Number(e.silentRounds || 0) + 1;
      else { e.silentRounds = 0; e.lastTouched = round; }
      if (e.stage !== prev) {
        e.trail = Array.isArray(e.trail) ? e.trail : [];
        e.trail.push({ round, stage: e.stage });
        if (e.trail.length > 8) e.trail = e.trail.slice(-8);
      }
    } else {
      const stage = sanitizeEventStage(raw.stage);
      e = {
        id: uid('evt'),
        title: String(raw.title || '未命名事件').slice(0, 18),
        essence: String(raw.essence || '').slice(0, 100),
        scope: String(raw.scope || '').slice(0, 64),
        drift: String(raw.drift || '').slice(0, 70),
        stage, status: stage === '落定' ? 'closed' : reqStatus,
        origin: round, lastTouched: round, silentRounds: 0,
        trail: [{ round, stage }],
      };
      eList.unshift(e);
      eById.set(e.id, e);
    }
    eSeen.add(e.id);
  }
  // 本幕未提及的活跃事件：沉寂计数；过久无人问津自然消退落定
  for (const e of eList) {
    if (eSeen.has(e.id) || e.status === 'closed') continue;
    e.silentRounds = Number(e.silentRounds || 0) + 1;
    if (e.silentRounds >= 4) { e.stage = '落定'; e.status = 'closed'; }
  }
  const eActive = eList.filter((e) => e.status !== 'closed');
  const eClosed = eList.filter((e) => e.status === 'closed');
  store.worldEvents = [...eActive.slice(0, 12), ...eClosed.slice(0, 6)];
}

function buildPlanDigest(plan) {
  if (!plan) return '';
  const sec = settings?.injectSections || { quests: true, nodes: true, npc: true, relations: true, world: true, threads: true };
  const st = plan.story_status || {};
  const lines = [];
  lines.push('【千幕·暗线灵感池】');
  lines.push('以下是导演系统埋下的潜在暗线与世界动向，仅供叙事时取用灵感：它们只是可能性，不必全部发生，也无需围绕谁展开。可在合适的时机让其中某一点自然浮现、发酵，或彼此牵动（蝴蝶效应），也可让它继续沉睡。世界里的人与事各有自己的节奏；{{user}} 可参与、可旁观、可间接受影响，也可全然不知。');
  const arcLine = [st.current_arc, st.current_stage].filter(Boolean).join(' · ');
  if (arcLine) lines.push(`当前幕：${snip(arcLine, INJ_LEN.arc)}`);
  if (st.mood) lines.push(`氛围：${snip(st.mood, INJ_LEN.line)}`);
  if (sec.quests !== false) {
    const quests = (plan.quests || []).map((q) => `- ${snip(q.title, INJ_LEN.label)}：${snip(q.objective || q.description, INJ_LEN.line)}${q.trigger ? `（触发：${snip(q.trigger, INJ_LEN.line)}）` : ''}`).filter(Boolean);
    if (quests.length) lines.push(`可选事件入口（{{user}} 可主动触碰，也可无视）：\n${quests.join('\n')}`);
  }
  if (sec.nodes !== false) {
    const chains = (plan.chain_reactions || []).map((c) => `- ${snip(c.spark, INJ_LEN.label)} → ${snip(c.chain, INJ_LEN.chain)}`).filter(Boolean);
    if (chains.length) lines.push(`暗流连锁（世界自行流转的因果，可悄然波及）：\n${chains.join('\n')}`);
  }
  if (sec.npc !== false) {
    const npcs = (plan.npc_updates || []).map((n) => `- ${snip(n.name, INJ_LEN.label)}：${snip(n.next_action || n.current_goal, INJ_LEN.line)}${n.hidden_agenda && String(n.hidden_agenda).trim() !== '无' ? `（暗流：${snip(n.hidden_agenda, INJ_LEN.line)}）` : ''}`).filter(Boolean);
    if (npcs.length) lines.push(`人物暗流（自行推进，不等待任何人）：\n${npcs.join('\n')}`);
  }
  if (sec.relations !== false) {
    const rels = (plan.relation_undercurrents || []).map((r) => {
      const who = snip(r.parties, INJ_LEN.parties);
      const ten = snip(r.tension, INJ_LEN.line);
      if (!who && !ten) return '';
      return `- ${who}：${ten}${r.drift ? `（走势：${snip(r.drift, INJ_LEN.line)}）` : ''}`;
    }).filter(Boolean);
    if (rels.length) lines.push(`关系暗涌（角色之间自行纠缠的张力，可正可负，多在 {{user}} 视野之外）：\n${rels.join('\n')}`);
  }
  if (sec.world !== false) {
    const worlds = (plan.world_updates || []).map((w) => `- ${snip(w.title, INJ_LEN.label)}：${snip(w.content, INJ_LEN.line)}${w.timing ? `（${snip(w.timing, INJ_LEN.label)}）` : ''}`).filter(Boolean);
    if (worlds.length) lines.push(`世界涟漪（在背景中持续发酵）：\n${worlds.join('\n')}`);
  }
  // 活幕·伏笔显影：把存活暗线的显影火候作为「取用时机」灵感注入（钉住与高潮临近者优先）
  if (settings?.liveStageEnabled && sec.threads !== false) {
    const threadsLine = buildThreadsDigest();
    if (threadsLine) lines.push(threadsLine);
  }
  // 活幕·势：把势力格局与世界事件作为「上游源头」注入（L1→L4：大势如何流转，余波才如何砸到街角个体）
  if (settings?.geopoliticsEnabled && sec.geopolitics !== false) {
    const geoLine = buildGeopoliticsDigest();
    if (geoLine) lines.push(geoLine);
  }
  return lines.join('\n\n');
}

// 势·注入段：势力格局 + 关系张力 + 进行中的世界事件，作为世界回声的上游源头喂给正文
// 写明「处处皆是却不点破」——大势是余波的来处，落到个体耳边时绝不直说源头在两层之上。
function buildGeopoliticsDigest() {
  const store = getChatStore();
  const factions = Array.isArray(store.factions) ? store.factions : [];
  const events = (Array.isArray(store.worldEvents) ? store.worldEvents : []).filter((e) => e.status !== 'closed');
  const rels = Array.isArray(store.factionRelations) ? store.factionRelations : [];
  if (!factions.length && !events.length) return '';
  const byId = new Map(factions.map((f) => [f.id, f]));
  const nameOf = (id) => byId.get(id)?.name || '某势力';
  const out = ['世界大势（自成脉络的上游源头：以下势力博弈与大事是街头巷尾余波的来处。取用时让其影响顺势渗到个体的衣食住行、闲谈风声里，处处可感却绝不点破因果，更不让世界绕 {{user}} 旋转）：'];
  // 张力最盛的几对关系先行（冲突/张力优先），点出当前世界绷在哪
  const hotRels = rels.filter((r) => r.kind === '冲突' || r.kind === '张力' || r.kind === '依附')
    .map((r) => `- ${nameOf(r.a)} ${r.kind === '依附' ? '依附于' : `与 ${nameOf(r.b)} ${r.kind}`}${r.kind !== '依附' ? '' : ` ${nameOf(r.b)}`}${r.note ? `：${snip(r.note, INJ_LEN.line)}` : ''}`);
  if (hotRels.length) out.push(hotRels.slice(0, 6).join('\n'));
  const evLines = events.map((e) => `- ${snip(e.title, INJ_LEN.label)}【${e.stage}】：${snip(e.essence, INJ_LEN.line)}${e.drift ? `（走向：${snip(e.drift, INJ_LEN.line)}）` : ''}`);
  if (evLines.length) out.push('进行中的世界事件：\n' + evLines.slice(0, 5).join('\n'));
  return out.join('\n');
}

// 伏笔显影注入段：只取 active 暗线，钉住/临界者排前，标出显影火候提示取用时机
function buildThreadsDigest() {
  const store = getChatStore();
  const active = (store.threads || []).filter((t) => t.status === 'active');
  if (!active.length) return '';
  const weight = (t) => (t.pinned ? 100 : 0) + STAGE_LADDER.indexOf(sanitizeStage(t.stage));
  const sorted = [...active].sort((a, b) => weight(b) - weight(a)).slice(0, 8);
  const rows = sorted.map((t) => {
    const heat = t.stage === '临界' || t.stage === '高潮' ? '，火候渐起，可择机让它浮现' : '';
    return `- ${t.pinned ? '（重点）' : ''}${snip(t.title, INJ_LEN.label)}【${t.stage}】：${snip(t.essence, INJ_LEN.line)}${heat}`;
  });
  return `伏笔显影（各暗线的显影火候，仅供把握取用时机，仍是可介入可无视的可能性）：\n${rows.join('\n')}`;
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
    // 悬空判定：删楼回退到「推演时的聊天长度」之前，注入的暗线已对应不上现状 → 暂不注入，待下次推演刷新
    const len = Array.isArray(ctx().chat) ? ctx().chat.length : 0;
    const dangling = Number.isFinite(Number(store?.planAtLen)) && Number(store.planAtLen) > 0 && len < Number(store.planAtLen);
    const active = settings?.enabled && settings.injectEnabled && store?.plan && !dangling;
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
  if (!contextScanCache.presetScannedAt) await refreshPresets(false);
  if (!contextScanCache.worldScannedAt) await refreshWorldBooks(false);   // 切角色后世界书扫描态被作废，这里照新绑定补扫
  const store = getChatStore();
  const segments = [];

  // 注入顺序：先铺世界设定（角色/用户人设 + 世界书），再上预设。
  // 预设里多为风格/越狱/分镜指令，置于设定之后才能在"世界已立"的前提下最大化生效，避免叙事逻辑错位。
  const worldText = await buildWorldContextText();
  // 名字也要过宏解析：getPersonaName 取不到时回落 {{user}}，直接拼进去会让日志出现字面「用户：{{user}}」
  const charNameR = await resolveMacro(getCharacterName());
  const personaNameR = await resolveMacro(getPersonaName());
  segments.push(`【世界设定】\n角色/群聊：${charNameR}\n用户：${personaNameR}${worldText ? `\n${worldText}` : ''}`);

  const presetText = await buildPresetContextText();
  if (presetText) {
    segments.push(presetText);
  }

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

  // 活幕·伏笔显影：把存活暗线档案喂回，让模型对照近期对话承接显影火候
  if (settings.liveStageEnabled) {
    const archive = buildThreadsArchiveSegment(store);
    if (archive) segments.push(archive);
  }

  // 活幕·势：把现有势力格局与世界事件喂回，让模型对照近期对话推动大势演进
  if (settings.geopoliticsEnabled) {
    const geo = buildGeopoliticsArchiveSegment(store);
    if (geo) segments.push(geo);
  }

  segments.push(settings.outputSchemaText || JSON_SCHEMA_TEXT);
  if (settings.liveStageEnabled) segments.push(THREADS_SCHEMA_TEXT);
  if (settings.worldChatterEnabled) segments.push(WORLD_CHATTER_SCHEMA_TEXT);
  if (settings.geopoliticsEnabled) segments.push(GEOPOLITICS_SCHEMA_TEXT);
  segments.push('【最终任务·发送前重申，违则失职】\n依据上方编剧方案与全部参考，推演当前故事的下一幕，只输出 JSON 对象，所有百分比数值范围 0-100。\n硬约束（务必逐条满足）：\n1. 数量下限不可破：任务≥5、角色动向≥5、世界回声 3-5（最低 3）、因果链≥3、关系暗涌≥3，剧情密度高时再自然上浮，绝不允许以「剧情平淡」为由缩水。\n2. 视角分工不可串：任务用 {{user}} 第一人称；角色动向、世界回声、因果链、关系暗涌用全知导演镜头。关系暗涌的 parties 写 2-5 个角色（主要角色/NPC 皆可），绝不含 {{user}}，且负面/中立/正向基调都要有；各条人数务必有别、勿齐刷一个数，至少一条仅 2 人（一对一）、其余须各取不同规模。\n3. 辐射扩散：相当一部分 npc_updates 与 world_updates 须与 {{user}} 此刻无关，是角色各自生活在推进的事；让其中一些因果相连、彼此波及，再借传闻/偶遇/委托/误会辐射到 {{user}} 视野边缘——避免一切围着 {{user}} 打转。因果链一律由世界内部起头、自行流转，绝不以 {{user}} 为源头或收束点。同时提供不同参与距离的事件（可介入、间接波及、纯属背景）。\n4. 文风铁律（全字段强制）：禁用「不是……而是……」否定对比句式；禁止用破折号补充说明或制造停顿；情绪、氛围等短句须客观精炼、点明由来，不写空标签、不堆解释性补白。\n5. progress 为本幕进度；当前主线 summary 写成勾人的楔子式引子，不作流水账复述。');
  if (settings.geopoliticsEnabled) segments.push('【势·关系网·最后重申】\n输出 factions 后，务必同步输出 faction_relations 数组。容许极少数势力作孤立局外方，但孤点至多不超过势力总数的三分之一（4 股≤1、5-6 股≤2），其余势力都要连入关系网。这是星图能否成形的命门，你必须把该连的势力都连上，绝不会交一盘大半悬空的散点。');
  return segments.join('\n\n');
}

// 活幕：构建「在演伏笔档案」段——逐条列出存活暗线供模型承接（钉住者标记，附沉寂幕数）
function buildThreadsArchiveSegment(store) {
  const active = (store.threads || []).filter((t) => t.status !== 'closed');
  if (!active.length) return '';
  const rows = active.map((t) => {
    const tag = t.pinned ? '（重点·勿擅自了结）' : '';
    const sleep = t.status === 'dormant' ? '（已沉睡，正文重新触及可唤醒）' : (t.silentRounds ? `（已沉寂${t.silentRounds}幕）` : '');
    return `- [id:${t.id}] ${tag}${snip(t.title, 24)}【${t.stage}】：${snip(t.essence, 60)}${sleep}`;
  });
  // 在演总量提醒：维持 3-5 条 active 暗线。不足则提示本幕补足，已达标则提示重在推进、不硬凑。
  const liveCount = active.filter((t) => t.status === 'active').length;
  const tally = liveCount < 3
    ? `\n⚠️ 当前在演暗线仅 ${liveCount} 条，低于 3-5 条的储备下限。本幕务必从正文与其余板块产出中再提炼几条新暗线补足，让伏笔池有足够可取用储备，但不可硬造空洞牵强的暗线。`
    : `\n（当前在演 ${liveCount} 条，已在 3-5 条的健康储备区间。本幕重在推进、流转既有暗线的火候，仅在确有新料时自然增埋，不必为凑数硬加。）`;
  return `【在演伏笔显影档案】\n以下暗线已在故事中存活，各有持续身份(id)与显影刻度。请对照「近期对话」逐条判定本幕走向，并在输出的 threads 字段中沿用对应 id 回传更新；标「重点」的暗线不得擅自沉睡或归档。\n${rows.join('\n')}${tally}`;
}

// 活幕·势：构建「在演格局档案」段——把现有势力/关系/世界事件喂回，让模型对照近期对话推动大势演进
// 「你不看也在变」就靠这里：模型会把局势按「过去这段时间该发生多少」往前演，哪怕正文没碰到。
function buildGeopoliticsArchiveSegment(store) {
  const factions = Array.isArray(store.factions) ? store.factions : [];
  const events = (Array.isArray(store.worldEvents) ? store.worldEvents : []).filter((e) => e.status !== 'closed');
  const rels = Array.isArray(store.factionRelations) ? store.factionRelations : [];
  if (!factions.length && !events.length) return '';
  const byId = new Map(factions.map((f) => [f.id, f]));
  const nameOf = (id) => byId.get(id)?.name || '某势力';
  const trendCn = { rising: '↑上升', stable: '—稳守', declining: '↓衰退', turbulent: '※动荡' };
  const parts = ['【在演·势·格局档案】\n以下势力格局与世界事件已自成脉络地存活。请对照「近期对话」推动其继续演进（哪怕正文未直接触及，世界也按自身时间往前走），并在 factions/faction_relations/world_events 字段中沿用对应 id 回传更新：'];
  if (factions.length) {
    parts.push('势力：\n' + factions.map((f) => `- [id:${f.id}] ${snip(f.name, 16)}（${snip(f.type, 12)}·${f.scale || '区域性'}·${trendCn[f.trend] || '—稳守'}）：${snip(f.standing || f.agenda, 56)}`).join('\n'));
  }
  if (rels.length) {
    parts.push('势力关系：\n' + rels.map((r) => `- ${nameOf(r.a)} ${r.kind === '依附' ? '依附→' : `[${r.kind}]`} ${nameOf(r.b)}${r.note ? `：${snip(r.note, 40)}` : ''}`).join('\n'));
  }
  // 关系网维护提醒：星图靠 faction_relations 连成网，模型在更新轮常偷懒漏掉，导致连线越演越稀甚至清空。
  // 容许少量孤点（至多 floor(势力数/3)），故连通所需最低边数 ≈ 势力数 - 允许孤点数 - 1；现存关系不足此数才提醒。
  if (factions.length >= 2) {
    const allowOrphans = Math.floor(factions.length / 3);
    const minEdges = Math.max(0, factions.length - allowOrphans - 1);
    if (rels.length < minEdges) {
      parts.push(`⚠️ 当前关系网偏稀（${factions.length} 股势力仅 ${rels.length} 条关系），大半势力已沦为孤点。本轮务必在 faction_relations 中补全、回传完整关系网：孤立局外方至多保留 ${allowOrphans} 个，其余势力都要连入网中（关系总数至少 ${minEdges} 条），平淡处也用「张力/中立」连上，绝不可整段省略或越演越空。`);
    }
  }
  if (events.length) {
    parts.push('世界事件：\n' + events.map((e) => `- [id:${e.id}] ${snip(e.title, 18)}【${e.stage}】：${snip(e.essence, 56)}${e.scope ? `（波及：${snip(e.scope, 30)}）` : ''}`).join('\n'));
  }
  // 格局新陈代谢节奏：节奏（每 GEO_REVIEW_CYCLE 轮一次「体检」）由代码定，是否缺张力→进哪个模式的质性判断交给模型。
  // 非体检轮专注演进现有格局、不折腾；体检轮才做模态判断，避免模型每轮都想改动阵容、也避免长期一潭死水。
  // upcomingRound = 本次推演即将写入的轮号（mergeGeopolitics 里 round = geoSeq+1），与之对齐。
  if (factions.length) {
    const upcomingRound = Number(store.geoSeq || 0) + 1;
    const isReview = upcomingRound % GEO_REVIEW_CYCLE === 0;
    parts.push(isReview
      ? '【本轮格局体检】此为定期复盘的一轮。先审视上方整体：诸势力间是否仍有活的张力与悬念？是否有谁长期停滞、已沦为无戏的背景板？据此二选一：\n· 若格局已显疲态（张力松弛、久无新博弈、或某势力沦为僵化摆设）→ 进入「推陈出新」：顺剧情与世界逻辑引入 1 股新兴势力（id 留空，由系统分配），或让某积弱者主动退场（标 declining 并在本轮回传中淡出），为格局注入新的变量与冲突。\n· 若格局仍在合理博弈、张力尚存 → 进入「稳中微调」：保持现有阵容，只推进既有矛盾的火候流转，不为变而变。\n切忌硬凑：新势力须从世界与正文里自然长出，而非空降。'
      : '本轮专注推进现有格局的内部流转（火候、关系松紧、事件阶段），保持阵容稳定；除非正文确有新组织/新变量自然涌现，否则不必新增或裁撤势力。');
  }
  return parts.join('\n');
}

function validateApiSettings() {
  if (settings.providerMode === 'external') return !!(normalizeUrl(settings.apiUrl) && settings.apiKey && settings.model);
  return !!getGenerateRaw();
}

async function callExternalApi(messages, onDelta = null, cfg = null, controller = null) {
  const apiUrl = cfg?.apiUrl ?? settings.apiUrl;
  const apiKey = cfg?.apiKey ?? settings.apiKey;
  const model = cfg?.model ?? settings.model;
  const temperature = cfg?.temperature ?? settings.temperature;
  const base = normalizeUrl(apiUrl);
  if (!(base && apiKey && model)) throw new Error('INVALID_API_SETTINGS');
  const ac = controller || (abortController = new AbortController());   // 调用方可传入独立句柄（幕外/推演各管各的）
  const stream = !!settings.streamEnabled && typeof onDelta === 'function';
  const body = { model, messages, temperature: Number(temperature || 0.75), stream };
  const maxTokens = Number(settings.maxOutputTokens || 0);
  if (maxTokens > 0) body.max_tokens = maxTokens;
  const res = await fetch(`${base}/v1/chat/completions`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal: ac.signal,
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
          const choice = json.choices?.[0] || {};
          const delta = choice.delta?.content
            ?? choice.message?.content
            ?? choice.text
            ?? '';
          if (delta) { full += delta; if (onDelta) onDelta(full); }
        } catch (_) {}
      }
    }
  } finally {
    reader.releaseLock?.();
  }
  return full;
}

function getGenerateRaw() {
  const context = ctx();
  if (typeof context.generateRaw === 'function') return context.generateRaw.bind(context);
  if (typeof globalThis.generateRaw === 'function') return globalThis.generateRaw;
  return null;
}

// 跟随 ST 当前 API：按官方 generateRaw 文档约定调用——prompt 传用户内容、systemPrompt 单独传（可空）。
// systemPrompt 由调用方显式传入：推演传导演系统提示词；幕外不传，保持与推演链路隔离，避免被灌入推演系统提示词。
// onDelta：开启流式时的实时预览回调。generateRaw 不暴露流式回调，仅能借 ST 的 STREAM_TOKEN_RECEIVED 事件尽力预览
// （部分构建/raw 生成不发此事件，则无逐字预览，但最终结果仍以 generateRaw 返回值为准、完全正确）。
async function callSillyTavernModel(userPrompt, systemPrompt = '', onDelta = null) {
  const generateRaw = getGenerateRaw();
  if (!generateRaw) throw new Error('INVALID_API_SETTINGS');
  const args = { prompt: userPrompt };
  if (systemPrompt) args.systemPrompt = systemPrompt;
  const context = ctx();
  const source = context.eventSource;
  const streamType = context.event_types?.STREAM_TOKEN_RECEIVED || 'stream_token_received';
  let streamHandler = null;
  if (onDelta && source?.on && source?.off) {
    let acc = '';
    streamHandler = (payload) => {
      // 兼容两种事件载荷：累积文本（以 acc 开头且更长）或单 token 增量（追加）
      const s = typeof payload === 'string' ? payload : String(payload?.text ?? payload ?? '');
      if (!s) return;
      if (s.length >= acc.length && s.startsWith(acc)) acc = s;
      else acc += s;
      try { onDelta(acc); } catch (_) {}
    };
    source.on(streamType, streamHandler);
  }
  try {
    const out = await generateRaw(args);
    return String(out ?? '');
  } finally {
    if (streamHandler) source.off(streamType, streamHandler);
  }
}

// 字符串感知的缺逗号补全（仅在字符串外操作，{{user}} 等内容不受影响）
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

// 截断自愈——裁剪到最后一个完整值，再按括号栈补齐闭合
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
    story_status: { title: '当前故事', current_arc: '', current_stage: '', cycle: '', progress: 0, mood: '', summary: '' },
    quests: [], npc_updates: [], world_updates: [], chain_reactions: [], relation_undercurrents: [], director_comment: '',
  };
  if (!isPlainObject(plan)) plan = {};
  mergeDefaults(plan, base);
  plan.quests = Array.isArray(plan.quests) ? plan.quests : [];
  plan.npc_updates = Array.isArray(plan.npc_updates) ? plan.npc_updates : [];
  plan.world_updates = Array.isArray(plan.world_updates) ? plan.world_updates : [];
  plan.chain_reactions = Array.isArray(plan.chain_reactions) ? plan.chain_reactions : [];
  plan.relation_undercurrents = Array.isArray(plan.relation_undercurrents) ? plan.relation_undercurrents : [];
  if (typeof plan.threads !== 'undefined' && !Array.isArray(plan.threads)) plan.threads = [];   // 活幕回传，保留原样供 mergeThreads 处理
  if (typeof plan.world_chatter !== 'undefined' && !Array.isArray(plan.world_chatter)) plan.world_chatter = [];   // 尘寰群生：纯展示，留在 plan 上随推演刷新
  if (typeof plan.factions !== 'undefined' && !Array.isArray(plan.factions)) plan.factions = [];   // 活幕·势：势力格局回传，供 mergeGeopolitics 处理
  if (typeof plan.world_events !== 'undefined' && !Array.isArray(plan.world_events)) plan.world_events = [];   // 活幕·势：世界事件回传
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
    const raw = settings.providerMode === 'sillytavern'
      ? await callSillyTavernModel(userPrompt, settings.systemPrompt || DEFAULT_SYSTEM_PROMPT, onDelta)
      : await callExternalApi(messages, onDelta);
    if (cancelRequested) throw new Error('USER_CANCELLED');
    log.response = clipLog(raw);
    const newPlan = normalizePlan(extractJson(raw));
    const store = getChatStore();
    const now = new Date().toISOString();
    store.plan = newPlan;
    store.updatedAt = now;
    store.lastPlanIdx = (Array.isArray(ctx().chat) ? ctx().chat.length : 1) - 1;   // 任何推演（手动/自动）后都以当前末尾为新基准，自动推演从此重新累积
    store.planAtLen = Array.isArray(ctx().chat) ? ctx().chat.length : 0;            // 记下推演时的聊天长度：若日后删楼回退到此长度之前，则注入的暗线已悬空，自动清空待下次推演
    if (settings.liveStageEnabled) mergeThreads(store, newPlan.threads);   // 活幕：承接伏笔显影档案
    delete newPlan.threads;   // 档案已并入 store.threads（唯一真源），从 plan 剔除避免「上次审片状态」重复注入
    if (settings.geopoliticsEnabled) mergeGeopolitics(store, newPlan);   // 活幕·势：承接势力格局/世界事件档案
    delete newPlan.factions; delete newPlan.faction_relations; delete newPlan.world_events;   // 已并入 store（唯一真源），从 plan 剔除避免重复注入
    // 历史快照须在剔除活档案字段之后再 clone：world 格局/伏笔是跨幕累积的活档案，绝不能随「载入历史」回滚复活，
    // 否则旧 factions/world_events/threads 会被重新塞回 store.plan、经【上次审片状态】喂回模型，导致清空后仍复刻旧格局。
    store.history = [{ id: uid('hist'), createdAt: now, plan: clone(newPlan) }, ...(Array.isArray(store.history) ? store.history : [])].slice(0, 5);
    injectSelection.clear();   // 新推演结果生成，旧写入勾选失效
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
    // 失败提示照常后台弹出（推演完成/失败的反馈关界面也要能收到）；日志里始终有完整记录可回看
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
  const loading = (settings.logHistory || []).find((x) => x.status === 'loading' && x.kind !== 'theater');
  if (loading) {
    loading.status = 'cancelled';
    loading.error = '已取消生成';
  }
  saveSettings();
  busy = false;
  renderBusyState();
  rerenderIfOpen();
  // 取消提示统一由生成流程的 catch 负责，避免在此重复弹出
}

// 幕外停止：只中止幕外这条链路，绝不影响正在跑的推演
function stopTheater() {
  theaterCancel = true;
  if (theaterAbort) theaterAbort.abort();
  const loading = (settings.logHistory || []).find((x) => x.status === 'loading' && x.kind === 'theater');
  if (loading) {
    loading.status = 'cancelled';
    loading.error = '已取消生成';
  }
  saveSettings();
  theaterBusy = false;
  renderBusyState();
  rerenderIfOpen();
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
// 校验一个 tab id 当前是否可落脚：coread 隐藏时、geopolitics 关闭时回落 dashboard。
// 用于「二次打开恢复上次 tab」——记录的 tab 若因开关变化已不可用，安全回落首页。
function resolveRestorableTab(tab) {
  const KNOWN = ['dashboard', 'tasksnodes', 'castworld', 'blueprint', 'context', 'settings', 'theater', 'tts', 'geopolitics', 'coread', 'plug'];
  if (!KNOWN.includes(tab)) return 'dashboard';
  if (tab === 'coread' && !COREAD_VISIBLE) return 'dashboard';
  if (tab === 'geopolitics' && !settings.geopoliticsEnabled) return 'dashboard';
  return tab;
}

function openModal(tab) {
  if (!settings.enabled) return toast('千幕已关闭。', 'warning');
  seedBuiltinTheaters();   // 开窗渲染前补种：根除「更新后首开剧札为空、需重开才显示」（幂等，两组 revision 最新即早退）
  // tab 显式传入则用之；否则恢复上次停留的标签（校验回退）——修「不管上次停在哪，重开都回首页」。
  activeTab = resolveRestorableTab(tab != null ? tab : (settings.lastTab || 'dashboard'));
  theaterView = null;
  let modal = document.getElementById(MODAL_ID);
  if (!modal) {
    modal = document.createElement('div');
    modal.id = MODAL_ID;
    document.body.appendChild(modal);
  }
  modalJustOpened = true;   // 标记首帧需入场动画；renderModal 消费后即清，后续静默重渲染不再播
  modal.classList.add('open');
  document.body.classList.add('sd-qm-modal-open');   // 压制 ST 快捷回复栏：搜索框聚焦不再牵出 QR 栏（CSS 端按此类隐藏）
  renderModal();
}

function closeModal() {
  document.getElementById(MODAL_ID)?.classList.remove('open');
  document.body.classList.remove('sd-qm-modal-open');
  unmountReaderPortal();   // 关模态连带收掉全屏阅读 portal
}

// 行内全屏文本编辑（编剧/幕后提示词/此幕指令共用）：在千幕界面内切换出编辑视图，沿用阅读页布局+吸顶返回/保存，
// 不另在 body 挂独立窗口（窄屏 fixed 定位会以 .sd-window 为基准跑偏）。
function openTextEditor({ target, title, value, placeholder = '', commit }) {
  // 记住进入编辑器前的正文滚动位，关闭后恢复——否则 renderModal 会把页面弹回顶部
  ttsEditorReturnScroll = document.getElementById(MODAL_ID)?.querySelector('.sd-body')?.scrollTop ?? 0;
  editorView = { target, title: title || '编辑', value: value || '', placeholder, commit, returnTab: activeTab };
  renderModal();
}

function closeEditorView() {
  editorView = null;
  renderModal();
  const body = document.getElementById(MODAL_ID)?.querySelector('.sd-body');
  if (body && ttsEditorReturnScroll != null) body.scrollTop = ttsEditorReturnScroll;
  ttsEditorReturnScroll = null;
}

// 行内编辑保存：按 target 直写对应数据模型，与各自原有持久化口径一致
async function commitEditorValue(target, val) {
  if (target === 'sd-blueprint') {
    getChatStore().blueprint = val || DEFAULT_BLUEPRINT;
    getChatStore().blueprintEdited = true;
    await saveMetadata();
  } else if (target === 'sd-system-prompt') {
    settings.systemPrompt = val || DEFAULT_SYSTEM_PROMPT;
    settings.systemPromptHash = settings.systemPrompt === DEFAULT_SYSTEM_PROMPT ? hashText(DEFAULT_SYSTEM_PROMPT) : '';
    saveSettings();
  } else if (target === 'sd-theater-instruction') {
    getTheater().instruction = val || '';
    theaterScriptSource = '';   // 手动改动即视为即兴，脱离剧札来源
    saveSettings();
  } else if (target.startsWith('ttsscheme:')) {
    const id = target.slice('ttsscheme:'.length);
    const schemes = settings.tts?.guidanceSchemes || [];
    const sch = schemes.find((x) => x.id === id);
    if (sch) { sch.content = val || ''; saveSettings(); }
  }
}

function renderEditorView() {
  const ev = editorView;
  return `
    <section class="sd-card sd-reader-card sd-editor-card">
      <div class="sd-sticky-bar sd-editor-bar">
        <button type="button" class="sd-btn sd-mini-btn sd-editor-back"><i class="fa-solid fa-arrow-left"></i>返回</button>
        <h3>${htmlEscape(ev.title)}</h3>
        <button type="button" class="sd-btn sd-mini-btn sd-primary sd-editor-save"><i class="fa-solid fa-check"></i>保存</button>
      </div>
      <textarea class="text_pole sd-editor-area" spellcheck="false" placeholder="${htmlEscape(ev.placeholder)}">${htmlEscape(ev.value)}</textarea>
    </section>`;
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
    openModal();   // 无参=恢复上次停留的 tab（校验回退首页）
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
  // 本地 logo 铺满圆形悬浮球（object-fit:cover 由 CSS 控）；img 不拦指针，拖拽/点击仍落在按钮上
  btn.innerHTML = `<img src="${FLOAT_LOGO_URL}" alt="${EXTENSION_NAME}" draggable="false">`;
  btn.title = EXTENSION_NAME;
  bindFloatDrag(btn);
  applyFloatPosition(btn);
}

function renderBusyState() {
  // 推演键自身在「推演下一幕 ⇄ 停止推演」之间原地切换，不额外加按钮
  document.querySelectorAll('.sd-generate-main').forEach((el) => {
    el.disabled = !settings.enabled;
    el.classList.toggle('sd-as-stop', busy);
    el.innerHTML = busy
      ? '<i class="fa-solid fa-stop"></i>停止推演'
      : '<i class="fa-solid fa-clapperboard"></i>推演下一幕';
  });
  // 幕外上演键同理原地切换
  document.querySelectorAll('.sd-theater-stage').forEach((el) => {
    el.disabled = !settings.enabled;
    el.classList.toggle('sd-as-stop', theaterBusy);
    el.innerHTML = theaterBusy
      ? '<i class="fa-solid fa-stop"></i>停止上演'
      : '<i class="fa-solid fa-masks-theater"></i>上演此幕';
  });
}

// 折叠面板开合状态记忆
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

// 读取 ST 当前正文字体，写入 --sd-font（视觉隔离保留，仅字体跟随）
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
  // 记录当前 tab 供下次打开恢复。只在真变化且非临时视图时落盘，避免每次静默重渲染都写。
  // theater 的阅读/收藏子视图（theaterView）是临时态，仍记 tab='theater' 无妨；editorView 是行内编辑、不改 activeTab。
  if (activeTab && settings.lastTab !== activeTab) {
    settings.lastTab = activeTab;
    saveSettings();
  }
  const prevScroll = modal.querySelector('.sd-body')?.scrollTop ?? 0;
  const prevTabScroll = modal.querySelector('.sd-tabs')?.scrollLeft ?? 0;
  snapshotAccState(modal);
  const tabs = [
    ['dashboard', '审片'],
    ['tasksnodes', '任务'],
    ['castworld', '世界'],
    ['blueprint', '编剧'],
    ['context', '取材'],
    ['settings', '幕后'],
    ['theater', '幕外'],
    ['tts', '配音'],
  ];
  const wasOpen = modal.classList.contains('open');
  const animIn = modalJustOpened;   // 仅「打开」后的首帧入场动画，消费后清零，静默重渲染不再播（消除刷新闪动）
  modalJustOpened = false;
  const themeKey = THEME_KEYS.includes(settings.theme) ? settings.theme : 'light';
  modal.className = `sd-theme-${themeKey}${wasOpen ? ' open' : ''}${animIn ? ' sd-anim-in' : ''}`;
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
          ${COREAD_VISIBLE ? `<button class="sd-coread-shortcut ${activeTab === 'coread' ? 'active' : ''}" title="共读" aria-label="共读"><i class="fa-solid fa-book-open"></i></button>` : ''}
          <button class="sd-geo-shortcut ${activeTab === 'geopolitics' ? 'active' : ''}" title="世界格局" aria-label="世界格局"><i class="fa-solid fa-atom"></i></button>
          <button class="sd-plug-shortcut" title="API与日志"><i class="fa-solid fa-gear"></i></button>
          <div class="sd-theme-pick">
            <button class="sd-theme-btn" title="外观主题" aria-label="外观主题" aria-haspopup="true"><i class="fa-solid fa-palette"></i></button>
            <div class="sd-theme-menu" role="menu" hidden>
              ${THEMES.map((t) => `
                <button class="sd-theme-opt ${themeKey === t.key ? 'active' : ''}" role="menuitemradio" aria-checked="${themeKey === t.key}" data-theme="${t.key}">
                  <span class="sd-theme-dot" style="background:${t.dot}"></span>
                  <span class="sd-theme-name">${t.name}</span>
                </button>`).join('')}
            </div>
          </div>
          <button class="sd-close" title="关闭"><i class="fa-solid fa-xmark"></i></button>
        </div>
      </header>
      <nav class="sd-tabs">
        ${tabs.map(([id, label]) => `<button class="sd-tab ${activeTab === id ? 'active' : ''}" data-tab="${id}">${label}</button>`).join('')}
      </nav>
      <main class="sd-body">${['tasksnodes', 'castworld', 'context'].includes(activeTab) && !editorView ? `<div class="sd-cols-inner">${renderActiveTab()}</div>` : renderActiveTab()}</main>
      ${renderInjectDock()}
    </section>`;
  modal.querySelector('.sd-backdrop')?.addEventListener('click', closeModal);
  modal.querySelector('.sd-window')?.addEventListener('click', (event) => event.stopPropagation());
  modal.querySelector('.sd-close')?.addEventListener('click', closeModal);
  modal.querySelector('.sd-plug-shortcut')?.addEventListener('click', () => { activeTab = 'plug'; renderModal(); });
  modal.querySelector('.sd-geo-shortcut')?.addEventListener('click', () => { activeTab = 'geopolitics'; renderModal(); });
  modal.querySelector('.sd-coread-shortcut')?.addEventListener('click', () => { activeTab = 'coread'; renderModal(); });
  const themePick = modal.querySelector('.sd-theme-pick');
  const themeMenu = themePick?.querySelector('.sd-theme-menu');
  modal.querySelector('.sd-theme-btn')?.addEventListener('click', (event) => {
    event.stopPropagation();
    if (!themeMenu) return;
    const willOpen = themeMenu.hidden;
    themeMenu.hidden = !willOpen;
    themePick.classList.toggle('open', willOpen);
    if (willOpen) {
      // 点菜单外任意处即收起，只挂一次
      const closeOnce = (ev) => {
        if (themePick.contains(ev.target)) return;
        themeMenu.hidden = true;
        themePick.classList.remove('open');
        document.removeEventListener('click', closeOnce, true);
      };
      document.addEventListener('click', closeOnce, true);
    }
  });
  modal.querySelectorAll('.sd-theme-opt').forEach((el) => el.addEventListener('click', () => {
    const next = el.dataset.theme;
    if (next && next !== settings.theme) { settings.theme = next; saveSettings(); }
    renderModal();   // 重渲染会重建菜单（默认收起态）
  }));
  modal.querySelectorAll('.sd-tab').forEach((el) => el.addEventListener('click', () => {
    if (el.dataset.tab !== 'theater') theaterView = null;
    editorView = null;   // 切标签即退出行内编辑视图
    activeTab = el.dataset.tab;
    renderModal();
  }));
  bindActiveTabEvents(modal);
  applyAccState(modal);
  renderBusyState();
  syncFontWithST();
  const body = modal.querySelector('.sd-body');
  if (body) body.scrollTop = prevScroll;
  // 保留标签栏横向滚动位置，并确保激活标签可见；两端按可滚动方向显隐渐隐遮罩
  const tabsBar = modal.querySelector('.sd-tabs');
  if (tabsBar) {
    tabsBar.scrollLeft = prevTabScroll;
    tabsBar.querySelector('.sd-tab.active')?.scrollIntoView({ inline: 'nearest', block: 'nearest' });
    updateTabsFade(tabsBar);
    if (!tabsBar.dataset.fadeBound) {
      tabsBar.dataset.fadeBound = '1';
      tabsBar.addEventListener('scroll', () => updateTabsFade(tabsBar), { passive: true });
      bindTabsScrollControls(tabsBar);
    }
  }
}

// 标签栏横向滚动增强：滚轮纵→横、PC 鼠标按住拖动。移动端触摸滑动由 CSS overflow-x 原生承担，不在此干预。
function bindTabsScrollControls(bar) {
  // 滚轮：竖直滚轮转为横向滚动（横向滚轮/触控板横扫保持原生）
  bar.addEventListener('wheel', (e) => {
    if (e.deltaY === 0) return;
    const max = bar.scrollWidth - bar.clientWidth;
    if (max <= 2) return;   // 无可滚动内容则让滚轮冒泡给页面
    bar.scrollLeft += e.deltaY;
    e.preventDefault();
  }, { passive: false });

  // 鼠标按住拖动（仅鼠标；触摸交给原生）。拖动超阈值时吞掉随后的 click，避免误触切标签。
  let dragging = false;
  let startX = 0;
  let startScroll = 0;
  let moved = 0;
  bar.addEventListener('pointerdown', (e) => {
    if (e.pointerType !== 'mouse' || e.button !== 0) return;
    dragging = true;
    moved = 0;
    startX = e.clientX;
    startScroll = bar.scrollLeft;
  });
  bar.addEventListener('pointermove', (e) => {
    if (!dragging) return;
    const dx = e.clientX - startX;
    moved = Math.max(moved, Math.abs(dx));
    bar.scrollLeft = startScroll - dx;
    if (moved > 3) {
      bar.classList.add('sd-tabs-dragging');
      if (bar.hasPointerCapture?.(e.pointerId) === false) { try { bar.setPointerCapture(e.pointerId); } catch (_) {} }
      e.preventDefault();
    }
  });
  const endDrag = (e) => {
    if (!dragging) return;
    dragging = false;
    bar.classList.remove('sd-tabs-dragging');
    try { bar.releasePointerCapture?.(e.pointerId); } catch (_) {}
    if (moved > 3) {
      // 抑制本次拖动末尾触发的 click（捕获阶段一次性拦截）
      const swallow = (ev) => { ev.stopPropagation(); ev.preventDefault(); };
      bar.addEventListener('click', swallow, { capture: true, once: true });
      // 若拖动后未产生 click（极少数），下一帧自动移除该一次性监听，避免误吞下一次真实点击
      setTimeout(() => bar.removeEventListener('click', swallow, { capture: true }), 0);
    }
  };
  bar.addEventListener('pointerup', endDrag);
  bar.addEventListener('pointercancel', endDrag);
  bar.addEventListener('pointerleave', endDrag);
}

// 标签栏两端渐隐：仅在该侧确有可滚动内容时才加雾化遮罩，提示「这边还能滑」，滑到尽头则隐去该侧
function updateTabsFade(bar) {
  const max = bar.scrollWidth - bar.clientWidth;
  const x = bar.scrollLeft;
  const overflowing = max > 2;
  bar.classList.toggle('sd-tabs-fade-left', overflowing && x > 2);
  bar.classList.toggle('sd-tabs-fade-right', overflowing && x < max - 2);
}

function currentPlan() {
  return getChatStore().plan;
}

function renderActiveTab() {
  if (editorView) return renderEditorView();
  switch (activeTab) {
    case 'blueprint': return renderBlueprintTab();
    case 'tasksnodes': return renderTasksNodesTab();
    case 'castworld': return renderCastWorldTab();
    case 'context': return renderContextTab();
    case 'settings': return renderDirectorSettingsTab();
    case 'theater': return renderTheaterTab();
    case 'tts': return renderTtsTab();
    case 'geopolitics': return renderGeopoliticsTab();
    case 'coread': return COREAD_VISIBLE ? renderCoreadTab() : renderDashboardTab();   // 隐藏时误入 coread 回落仪表盘
    case 'plug': return renderPlugTab();
    default: return renderDashboardTab();
  }
}

/* ============================================================
   活幕·势：三合一可视化面板
   顶部抽象态势带 + 中部 SVG 势力关系星图（确定性布局·染色连线·冲突脉动）+ 底部 Boss 事件卡。
   纯 SVG 自绘、走主题变量、确定性布局保证刷新不跳。
   ============================================================ */
const GEO_REL_COLOR = { 冲突: 'var(--sd-geo-conflict)', 同盟: 'var(--sd-geo-ally)', 张力: 'var(--sd-geo-tension)', 中立: 'var(--sd-geo-neutral)', 依附: 'var(--sd-geo-vassal)' };
const GEO_TREND_CN = { rising: '上升', stable: '稳守', declining: '衰退', turbulent: '动荡' };
const GEO_TREND_ICON = { rising: '▲', stable: '＝', declining: '▼', turbulent: '✦' };
// 世界事件五阶段各自配色与类名（标签 + 阶梯 + 边缘统一取用）
const EVENT_STAGE_CLS = { 酝酿: 'brew', 爆发: 'erupt', 蔓延: 'spread', 消退: 'fade', 落定: 'settle' };

// 世界温度：由关系张力 + 事件烈度合成 0-100，映射四档态势
function computeWorldHeat(rels, events) {
  const relWeight = { 冲突: 26, 张力: 13, 依附: 5, 中立: 0, 同盟: -8 };
  let heat = 0;
  for (const r of rels) heat += relWeight[r.kind] || 0;
  for (const e of events) {
    if (e.status === 'closed') continue;
    heat += e.stage === '爆发' ? 18 : e.stage === '蔓延' ? 14 : e.stage === '酝酿' ? 7 : 2;
  }
  return Math.max(0, Math.min(100, Math.round(heat)));
}
function heatTier(heat) {
  if (heat >= 72) return { key: 'boil', label: '鼎沸', desc: '多方火并，世界沸反盈天' };
  if (heat >= 45) return { key: 'turmoil', label: '动荡', desc: '冲突四起，暗潮已掀明浪' };
  if (heat >= 20) return { key: 'undercurrent', label: '暗流', desc: '表面平静，底下各有盘算' };
  return { key: 'calm', label: '承平', desc: '大势安稳，余波细微' };
}

// 确定性环形布局：第 i 股势力固定落在同一角度，刷新不跳
function geoNodeLayout(n, cx, cy, r) {
  const pts = [];
  for (let i = 0; i < n; i++) {
    // 从正上方起，等角分布；半径随个数微调由调用方给
    const ang = (-90 + (i * 360) / Math.max(1, n)) * (Math.PI / 180);
    pts.push({ x: +(cx + r * Math.cos(ang)).toFixed(1), y: +(cy + r * Math.sin(ang)).toFixed(1) });
  }
  return pts;
}

// 「势」星轨：天体运行图式可视化。
// 背景多条倾斜椭圆各自恒定旋转、彼此交错（世界持续运转）；势力主点钉在稳定屏幕位、彩色不透明、随时可点；
// 每股势力的零碎线索化作环绕其局部轨道的单色明灭点；两两关联以由内而外渐变的色弧串联，半透明交叠处自然叠亮。
function renderFactionStarMap(factions, rels) {
  const n = factions.length;
  if (!n) return '';
  const W = 380, H = 392, cx = 190, cy = 196;
  const R = n <= 2 ? 72 : n <= 4 ? 104 : 124;
  const pts = geoNodeLayout(n, cx, cy, R);
  const idx = new Map(factions.map((f, i) => [f.id, i]));
  const relCount = factions.map(() => 0);

  // 背景星轨：3 条贯穿全图的倾斜椭圆，各自速度/方向不同地恒定旋转，交错出「世界在转」的底盘；
  // 每条环上随机散落几颗小星点，随环一同旋转
  const bed = [0, 1, 2].map((k) => {
    const rx = 158 - k * 26, ry = (158 - k * 26) * (0.46 + 0.15 * k);
    const tilt = 26 + k * 57;
    const dur = 132 + k * 46;            // 慢速，各环错开
    const rev = k % 2 ? ' sd-geo-orbit-rev' : '';
    const dotN = 5 + k;                  // 5/6/7 颗
    let dots = '';
    for (let j = 0; j < dotN; j++) {
      // 沿椭圆参数角散落（伪随机偏移，确定性、刷新不跳），落点再按倾角旋转回去
      const a = (j / dotN) * Math.PI * 2 + (k * 1.3 + j * 2.39) % (Math.PI * 2);
      const ex = rx * Math.cos(a), ey = ry * Math.sin(a);
      const tr = tilt * Math.PI / 180, ct = Math.cos(tr), st = Math.sin(tr);
      const dx = +(cx + ex * ct - ey * st).toFixed(1);
      const dy = +(cy + ex * st + ey * ct).toFixed(1);
      const r = (1.3 + ((k * 3 + j * 5) % 3) * 0.6).toFixed(1);
      const dl = (((k * 5 + j * 7) % 11) * 0.4).toFixed(2);
      dots += `<circle class="sd-geo-bed-dot" cx="${dx}" cy="${dy}" r="${r}" style="--d:${dl}s"></circle>`;
    }
    return `<g class="sd-geo-orbit${rev}" style="--dur:${dur}s"><ellipse cx="${cx}" cy="${cy}" rx="${rx.toFixed(1)}" ry="${ry.toFixed(1)}" transform="rotate(${tilt} ${cx} ${cy})"></ellipse>${dots}</g>`;
  }).join('');

  // 关联色弧：两两势力间一条朝心微弯的弧。底层极淡定位线 + 上层一束流光顺线游走（取消虚线、改流光感）
  const edges = rels.map((rel) => {
    const a = idx.get(rel.a), b = idx.get(rel.b);
    if (a == null || b == null) return '';
    relCount[a]++; relCount[b]++;
    const p1 = pts[a], p2 = pts[b];
    const mx = (p1.x + p2.x) / 2, my = (p1.y + p2.y) / 2;
    const tox = cx - mx, toy = cy - my;
    const tlen = Math.hypot(tox, toy) || 1;
    const bend = Math.min(40, Math.hypot(p2.x - p1.x, p2.y - p1.y) * 0.2);
    const ctrlX = +(mx + (tox / tlen) * bend).toFixed(1);
    const ctrlY = +(my + (toy / tlen) * bend).toFixed(1);
    const d = `M${p1.x},${p1.y} Q${ctrlX},${ctrlY} ${p2.x},${p2.y}`;
    const color = GEO_REL_COLOR[rel.kind] || GEO_REL_COLOR['中立'];
    const kindCls = { 冲突: 'conflict', 同盟: 'ally', 张力: 'tension', 中立: 'neutral', 依附: 'vassal' }[rel.kind] || 'neutral';
    const marker = rel.kind === '依附' ? ' marker-end="url(#sd-geo-arrow)"' : '';
    const title = `${factions[a].name} · ${rel.kind} · ${factions[b].name}${rel.note ? `\n${rel.note}` : ''}`;
    // base = 细定位线；flow = 一束亮流光。用 pathLength=100 把所有线归一化，dasharray/动画走固定值 → 普适地动起来
    return `<g class="sd-geo-edge sd-geo-edge-${kindCls}" data-ea="${htmlEscape(rel.a)}" data-eb="${htmlEscape(rel.b)}">`
      + `<path class="sd-geo-edge-base" d="${d}" stroke="${color}" fill="none"${marker}><title>${htmlEscape(title)}</title></path>`
      + `<path class="sd-geo-edge-flow" d="${d}" stroke="${color}" fill="none" pathLength="100"></path>`
      + `</g>`;
  }).join('');

  // 中央轴心：呼吸大小的星（世界锚点），呼应天体图的「恒星」
  const axis = `<g class="sd-geo-axis"><circle class="sd-geo-axis-halo" cx="${cx}" cy="${cy}" r="13"></circle>`
    + `<path class="sd-geo-axis-star" d="${starPath(cx, cy, 7.5, 3)}"></path></g>`;

  // 势力主点：彩色状态点（同小点风格、更大）+ 上方小标签；点击仍出档案卡
  const nodes = factions.map((f, i) => {
    const p = pts[i];
    const trend = ['rising', 'stable', 'declining', 'turbulent'].includes(f.trend) ? f.trend : 'stable';
    const tone = `sd-geo-node-${trend}`;
    const rad = 8 + Math.min(6, relCount[i] * 1.5);   // 8-14：牵连越密体量越显，但只比线索点略大
    const label = snip(f.name, 6);
    const tip = `${f.name}（${snip(f.type, 12)}·${f.scale || ''}·${GEO_TREND_CN[f.trend] || '稳守'}）${f.standing ? `\n${f.standing}` : ''}${f.agenda ? `\n诉求：${f.agenda}` : ''}`;
    // 局部轨道：环绕主点的倾斜椭圆，朝外侧倾，线索星点落在其上 → 环形星盘观感
    const clues = Array.isArray(f.clues) ? f.clues.filter(Boolean).slice(0, 5) : [];
    const m = clues.length;
    const baseA = Math.atan2(p.y - cy, p.x - cx);     // 朝外方向
    const orx = rad + 24, ory = rad + 15;             // 局部轨道长短轴（线索点放大后外推一点免压主点）
    const cosT = Math.cos(baseA), sinT = Math.sin(baseA);
    const ringPath = `<ellipse class="sd-geo-clue-orbit" cx="0" cy="0" rx="${orx}" ry="${ory}" transform="rotate(${(baseA * 180 / Math.PI).toFixed(1)})"></ellipse>`;
    const clueSvg = clues.map((c, j) => {
      const ang = (j / Math.max(1, m)) * Math.PI * 2 + (i * 0.9) + 0.5;
      const ex = orx * Math.cos(ang), ey = ory * Math.sin(ang);
      const dx = +(ex * cosT - ey * sinT).toFixed(1);
      const dy = +(ex * sinT + ey * cosT).toFixed(1);
      const cr = (4.2 + ((i * 3 + j * 7) % 3) * 0.9).toFixed(1);   // 4.2 / 5.1 / 6.0：明显大于装饰点
      const delay = (((i * 3 + j * 5) % 13) * 0.32).toFixed(2);
      return `<circle class="sd-geo-clue-hit" cx="${dx}" cy="${dy}" r="11" data-clue="${htmlEscape(c)}"></circle>`
        + `<circle class="sd-geo-clue" cx="${dx}" cy="${dy}" r="${cr}" style="--d:${delay}s"><title>${htmlEscape(c)}</title></circle>`;
    }).join('');
    // 标签放主点正上方、抬到局部线索轨道之上（不再遮住线索点），并夹住不越出画布顶
    const tagW = label.length * 11 + 14;
    let tagTop = -(rad + orx + 12);                 // 抬到线索轨道最外缘之上留白
    if (p.y + tagTop < 2) tagTop = 2 - p.y;         // 顶部节点夹回画布内
    const tag = `<g class="sd-geo-node-tag" transform="translate(${(-tagW / 2).toFixed(1)},${tagTop.toFixed(1)})">`
      + `<rect class="sd-geo-tag-bg" width="${tagW}" height="16" rx="8"></rect>`
      + `<text class="sd-geo-tag-text" x="${(tagW / 2).toFixed(1)}" y="11.5" text-anchor="middle">${GEO_TREND_ICON[f.trend] || '＝'} ${htmlEscape(label)}</text></g>`;
    return `<g class="sd-geo-node ${tone}" data-fid="${htmlEscape(f.id)}" transform="translate(${p.x},${p.y})" tabindex="0" role="button" aria-label="${htmlEscape(f.name)}"><title>${htmlEscape(tip)}</title>`
      + `<g class="sd-geo-clues">${ringPath}${clueSvg}</g>`
      + `<circle class="sd-geo-node-dot" r="${rad}"></circle>`
      + tag
      + `</g>`;
  }).join('');

  return `<svg class="sd-geo-map" viewBox="0 0 ${W} ${H}" role="img" aria-label="势力关系星轨" preserveAspectRatio="xMidYMid meet">`
    + `<defs><marker id="sd-geo-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill="var(--sd-geo-vassal)"></path></marker></defs>`
    + `<g class="sd-geo-bed">${bed}</g>`
    + axis
    + `<g class="sd-geo-edges">${edges}</g><g class="sd-geo-nodes">${nodes}</g></svg>`;
}

// 生成 spikes 角星路径（中央轴心用）
function starPath(cx, cy, outer, inner) {
  const spikes = 4;
  let d = '';
  for (let i = 0; i < spikes * 2; i++) {
    const r = i % 2 ? inner : outer;
    const a = (i / (spikes * 2)) * Math.PI * 2 - Math.PI / 2;
    const x = +(cx + r * Math.cos(a)).toFixed(2), y = +(cy + r * Math.sin(a)).toFixed(2);
    d += (i ? 'L' : 'M') + x + ',' + y;
  }
  return d + 'Z';
}

function renderWorldEventCard(e) {
  const stages = EVENT_STAGE_LADDER;
  const cur = sanitizeEventStage(e.stage);
  const ci = stages.indexOf(cur);
  const ladder = stages.map((s, i) => {
    const state = e.status === 'closed' ? 'done' : i < ci ? 'past' : i === ci ? 'now' : 'future';
    return `<span class="sd-evt-step sd-evt-${state} sd-evt-st-${EVENT_STAGE_CLS[s]}" title="${s}"><i></i><em>${s}</em></span>`;
  }).join('');
  const stageCls = `sd-evt-stage-${EVENT_STAGE_CLS[cur] || 'settle'}`;
  return `<details class="sd-evt-card ${stageCls} ${e.status === 'closed' ? 'sd-evt-closed' : ''}" data-acc="evt-${htmlEscape(e.id || e.title || '')}" open>
    <summary class="sd-evt-head"><h4>${htmlEscape(snip(e.title, 18))}</h4><span class="sd-evt-badge">${cur}</span></summary>
    <div class="sd-evt-body">
      ${e.essence ? `<p class="sd-evt-essence">${htmlEscape(e.essence)}</p>` : ''}
      <div class="sd-evt-ladder">${ladder}</div>
      <div class="sd-evt-foot">${e.scope ? `<span class="sd-evt-scope" title="波及范围"><i class="fa-solid fa-earth-asia"></i><span>${htmlEscape(e.scope)}</span></span>` : ''}${e.drift && e.status !== 'closed' ? `<span class="sd-evt-drift"><i class="fa-solid fa-arrow-trend-up"></i><span>${htmlEscape(e.drift)}</span></span>` : ''}</div>
    </div>
  </details>`;
}

function renderGeopoliticsTab() {
  const store = getChatStore();
  const factions = Array.isArray(store.factions) ? store.factions : [];
  const rels = (Array.isArray(store.factionRelations) ? store.factionRelations : []).filter((r) => factions.some((f) => f.id === r.a) && factions.some((f) => f.id === r.b));
  const events = Array.isArray(store.worldEvents) ? store.worldEvents : [];
  const activeEvents = events.filter((e) => e.status !== 'closed');
  const closedEvents = events.filter((e) => e.status === 'closed');

  if (!factions.length && !events.length) {
    return `<div class="sd-geo-tab"><div class="sd-empty sd-geo-empty">
      <i class="fa-solid fa-atom"></i>
      <p><b>世界格局</b> 尚未生成。</p>
      <p class="sd-muted">${settings.geopoliticsEnabled ? '推演后，世界的势力格局、地缘张力会在此自成脉络。' : '该功能默认关闭。请到「幕后」页勾选「启用世界格局」，之后推演时世界的势力格局、地缘张力会在此自成脉络。'}</p>
    </div></div>`;
  }

  const heat = computeWorldHeat(rels, activeEvents);
  const tier = heatTier(heat);
  // 顶部态势带：温度条 + 当前档位 + 关系基调速览
  const relTally = rels.reduce((m, r) => { m[r.kind] = (m[r.kind] || 0) + 1; return m; }, {});
  const tallyChips = FACTION_RELATION_KINDS.filter((k) => relTally[k]).map((k) =>
    `<span class="sd-geo-chip" data-kind="${k}"><i style="background:${GEO_REL_COLOR[k]}"></i>${k} ${relTally[k]}</span>`).join('');

  const bandHtml = `<section class="sd-geo-band sd-geo-tier-${tier.key}">
    <div class="sd-geo-band-top">
      <div class="sd-geo-tier"><span class="sd-geo-tier-label">${tier.label}</span><span class="sd-geo-tier-desc">${tier.desc}</span></div>
      <div class="sd-geo-band-right">
        <div class="sd-geo-heat-num">${heat}<small>世界温度</small></div>
        <button type="button" class="sd-icon-btn sd-icon-sm sd-geo-clear" title="清空世界格局（势力 / 关系 / 世界事件）" aria-label="清空世界格局"><i class="fa-solid fa-broom"></i></button>
      </div>
    </div>
    <div class="sd-geo-heat-track"><i style="width:${heat}%"></i></div>
    ${tallyChips ? `<div class="sd-geo-chips">${tallyChips}</div>` : ''}
  </section>`;

  const mapHtml = factions.length ? `<section class="sd-geo-stage">
    <div class="sd-geo-mapwrap">
      ${renderFactionStarMap(factions, rels)}
      <div class="sd-geo-cluepop" hidden></div>
      <div class="sd-geo-detail" hidden></div>
    </div>
    <div class="sd-geo-legend">
      <span><i style="background:${GEO_REL_COLOR['冲突']}"></i>冲突</span>
      <span><i style="background:${GEO_REL_COLOR['同盟']}"></i>同盟</span>
      <span><i style="background:${GEO_REL_COLOR['张力']}"></i>张力</span>
      <span><i style="background:${GEO_REL_COLOR['中立']}"></i>中立</span>
      <span><i style="background:${GEO_REL_COLOR['依附']}"></i>依附</span>
    </div>
    <p class="sd-muted sd-hint-sm sd-geo-maptip">点击主点获取情报，<i class="sd-geo-tip-clue" aria-hidden="true"></i>点击蓝点查探风声</p>
  </section>` : '';

  const eventsHtml = `<section class="sd-geo-events">
    ${activeEvents.length
      ? `<details class="sd-plain-fold sd-geo-events-fold" data-acc="geo-events-fold" open><summary><b>世界事件</b><span class="sd-summary-note">${activeEvents.length} 桩进行中</span></summary><div class="sd-evt-grid">${activeEvents.map(renderWorldEventCard).join('')}</div></details>`
      : `<div class="sd-section-title"><h3>世界事件</h3></div><p class="sd-muted">暂无进行中的世界事件。</p>`}
    ${closedEvents.length ? `<details class="sd-geo-closed" data-acc="geo-closed-fold"><summary>已落定的旧事（${closedEvents.length}）</summary><div class="sd-evt-grid">${closedEvents.map(renderWorldEventCard).join('')}</div></details>` : ''}
  </section>`;

  return `<div class="sd-geo-tab">
    ${bandHtml}${mapHtml}${eventsHtml}
  </div>`;
}

// 「势」星图交互：点选势力 → 高亮其牵连关系、淡化无关者，下方详情面板展开该势力档案
function bindGeopoliticsTabEvents(root) {
  if (activeTab !== 'geopolitics') return;
  // 世界格局一键清除：势力 / 关系 / 世界事件同属跨幕活档案，与伏笔一样独立于扫帚单独清。
  // 绑定放在 svg 存在性判断之前——有世界事件无势力时面板无 svg，但清除按钮仍在态势带、需可点。
  root.querySelector('.sd-geo-clear')?.addEventListener('click', async () => {
    const store = getChatStore();
    const n = (store.factions || []).length + (store.worldEvents || []).length;
    if (!n) return;
    const yes = await confirmDialog('清空世界格局', '将清空全部势力、关系与世界事件，此操作不可撤销、无法从历史找回。确认清空？');
    if (!yes) return;
    store.factions = [];
    store.factionRelations = [];
    store.worldEvents = [];
    store.geoSeq = 0;
    await saveMetadata();
    await applyDirectorInjection();   // 世界格局参与上游注入，清空后同步刷新
    toast('世界格局已清空。', 'success');
    renderModal();
  });
  const svg = root.querySelector('.sd-geo-map');
  const panel = root.querySelector('.sd-geo-detail');
  if (!svg || !panel) return;
  const store = getChatStore();
  const factions = Array.isArray(store.factions) ? store.factions : [];
  const rels = Array.isArray(store.factionRelations) ? store.factionRelations : [];
  const byId = new Map(factions.map((f) => [f.id, f]));
  const nameOf = (id) => byId.get(id)?.name || '某势力';
  let focused = null;

  const clear = () => {
    focused = null;
    svg.classList.remove('sd-geo-focused');
    svg.querySelectorAll('.sd-geo-node, .sd-geo-edge').forEach((el) => el.classList.remove('sd-on', 'sd-dim'));
    panel.hidden = true;
    panel.innerHTML = '';
  };

  const focus = (fid) => {
    const f = byId.get(fid);
    if (!f) return;
    focused = fid;
    svg.classList.add('sd-geo-focused');
    const linked = new Set([fid]);
    svg.querySelectorAll('.sd-geo-edge').forEach((g) => {
      const a = g.getAttribute('data-ea'), b = g.getAttribute('data-eb');
      const hit = a === fid || b === fid;
      g.classList.toggle('sd-on', hit);
      g.classList.toggle('sd-dim', !hit);
      if (hit) { linked.add(a); linked.add(b); }
    });
    svg.querySelectorAll('.sd-geo-node').forEach((g) => {
      const on = linked.has(g.getAttribute('data-fid'));
      g.classList.toggle('sd-on', g.getAttribute('data-fid') === fid);
      g.classList.toggle('sd-dim', !on);
    });
    // 详情面板：势力档案 + 它牵连的每一道关系
    const trendChip = `<span class="sd-geo-d-trend sd-geo-d-trend-${f.trend || 'stable'}">${GEO_TREND_ICON[f.trend] || '＝'} ${GEO_TREND_CN[f.trend] || '稳守'}</span>`;
    const myRels = rels.filter((r) => r.a === fid || r.b === fid).map((r) => {
      const other = r.a === fid ? r.b : r.a;
      const dirTxt = r.kind === '依附' ? (r.a === fid ? `依附于 ${nameOf(other)}` : `${nameOf(other)} 依附于此`) : `与 ${nameOf(other)}`;
      const kindCls = { 冲突: 'conflict', 同盟: 'ally', 张力: 'tension', 中立: 'neutral', 依附: 'vassal' }[r.kind] || 'neutral';
      return `<li class="sd-geo-d-rel sd-geo-d-rel-${kindCls}"><span class="sd-geo-d-kind">${htmlEscape(r.kind)}</span><span class="sd-geo-d-rtext">${htmlEscape(dirTxt)}${r.note ? ` · ${htmlEscape(r.note)}` : ''}</span></li>`;
    }).join('');
    panel.innerHTML = `<div class="sd-geo-d-head"><h4>${htmlEscape(f.name)}</h4>${trendChip}<button type="button" class="sd-geo-d-close" aria-label="关闭"><i class="fa-solid fa-xmark"></i></button></div>`
      + `<div class="sd-geo-d-meta">${[f.type, f.scale].filter(Boolean).map((t) => `<span>${htmlEscape(t)}</span>`).join('')}</div>`
      + (f.standing ? `<p class="sd-geo-d-standing">${htmlEscape(f.standing)}</p>` : '')
      + (f.agenda ? `<p class="sd-geo-d-agenda"><i class="fa-solid fa-bullseye"></i>${htmlEscape(f.agenda)}</p>` : '')
      + (myRels ? `<ul class="sd-geo-d-rels">${myRels}</ul>` : '<p class="sd-muted sd-hint-sm">暂无牵连关系。</p>');
    panel.hidden = false;
    panel.querySelector('.sd-geo-d-close')?.addEventListener('click', (e) => { e.stopPropagation(); clear(); });
  };

  svg.querySelectorAll('.sd-geo-node').forEach((node) => {
    const act = (e) => {
      e.stopPropagation();
      hidePop();   // 聚焦会缩放线索点、令其偏移，先收起气泡免其滞留旧位被裁
      const fid = node.getAttribute('data-fid');
      if (focused === fid) clear(); else focus(fid);
    };
    node.addEventListener('click', act);
    node.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); act(e); } });
  });

  // 线索星点：点击冒出短句气泡（定位到该点附近），不触发势力聚焦。命中靠透明的大命中圈，移动端友好
  const pop = root.querySelector('.sd-geo-cluepop');
  const wrap = root.querySelector('.sd-geo-mapwrap');
  const hidePop = () => { if (pop) { pop.hidden = true; pop.textContent = ''; } svg.querySelectorAll('.sd-geo-clue.sd-on').forEach((c) => c.classList.remove('sd-on')); };
  svg.querySelectorAll('.sd-geo-clue-hit').forEach((hit) => {
    hit.addEventListener('click', (e) => {
      e.stopPropagation();
      if (!pop || !wrap) return;
      svg.querySelectorAll('.sd-geo-clue.sd-on').forEach((c) => c.classList.remove('sd-on'));
      const dot = hit.nextElementSibling;   // 紧随其后的可见星点
      if (dot && dot.classList.contains('sd-geo-clue')) dot.classList.add('sd-on');
      pop.textContent = hit.getAttribute('data-clue') || '';
      // 把命中圈中心换算到 wrap 内的像素坐标，浮在其上方
      const dr = hit.getBoundingClientRect();
      const wr = wrap.getBoundingClientRect();
      pop.hidden = false;
      pop.style.removeProperty('--sd-clue-arrow');   // 复位箭头偏移，避免上次残留
      const cx = dr.left + dr.width / 2 - wr.left;    // 命中点中心 x（wrap 内）
      const cy = dr.top - wr.top;                     // 命中点顶 y
      // 气泡 translateX(-50%)、宽度可变：按「气泡左右边缘都留在 wrap 内」钳其中心，而非钳锚点——
      // 否则贴边时左侧会出框被裁、右侧被容器挤窄到两三字换行。
      const M = 8;
      const halfW = pop.offsetWidth / 2;
      const minL = halfW + M, maxL = wr.width - halfW - M;
      const left = maxL >= minL ? Math.min(maxL, Math.max(minL, cx)) : wr.width / 2;
      pop.style.left = `${left}px`;
      pop.style.top = `${Math.max(0, cy - 2)}px`;
      // 气泡因夹边而偏离了星点：把下方小三角横移回去，仍指向星点（限制在气泡内不出边）
      const arrow = Math.max(-halfW + 10, Math.min(halfW - 10, cx - left));
      pop.style.setProperty('--sd-clue-arrow', `${arrow.toFixed(1)}px`);
    });
  });

  // 点空白处取消聚焦与气泡
  svg.addEventListener('click', (e) => { if (e.target === svg || e.target.closest('.sd-geo-bed') || e.target.closest('.sd-geo-axis')) { clear(); hidePop(); } });
}

function renderInjectDock() {
  if (editorView) return '';   // 行内编辑视图独占界面，不浮写入坞
  if (!['tasksnodes', 'castworld'].includes(activeTab) || !currentPlan()) return '';
  return '<div class="sd-inject-dock"><button class="sd-btn sd-primary sd-inject-selected" type="button" disabled>写入已选 (<span>0</span>)</button></div>';
}

function metricBar(label, value) {
  const n = Math.max(0, Math.min(100, Number(value || 0)));
  return `<div class="sd-metric sd-progress-metric"><div class="sd-metric-top"><span>${htmlEscape(label)}</span><b>${n}%</b></div><div class="sd-bar"><i style="width:${n}%"></i></div></div>`;
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
  const mainContent = busy
    ? '<i class="fa-solid fa-stop"></i>停止推演'
    : '<i class="fa-solid fa-clapperboard"></i>推演下一幕';
  return `<div class="sd-button-row">
    <button class="sd-btn sd-primary sd-generate-main ${busy ? 'sd-as-stop' : ''}">${mainContent}</button>
    <button class="sd-btn sd-newcomer-toggle ${settings.newcomerMode ? 'active' : ''}" type="button" title="选中后，本次推演将引入全新角色与世界事件"><i class="fa-solid fa-user-plus"></i>新角入场</button>
  </div>`;
}

function renderDashboardTab() {
  const p = currentPlan();
  if (!p) {
    // 无 plan 时仍渲染历史区 + 伏笔卡——清空当前推演不应连带把历史审片记录、伏笔活档案也藏掉
    // （伏笔是跨幕活档案、独立于单次推演结果；扫帚只管推演结果，伏笔有自己的一键清空）
    return `<section class="sd-card sd-plan-card"><div class="sd-hero-top"><h3 style="margin:0">剧情推演</h3>${renderHeroActions(false)}</div><div class="sd-empty">尚未推演剧情</div>${renderGenerateRow()}</section>
    ${renderThreadsCard()}
    ${renderHistorySection()}`;
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
      <div class="sd-count-tags">
        ${countGroupTag('任务', 'tasksnodes', [['任务', p.quests?.length || 0], ['因果', p.chain_reactions?.length || 0]])}
        ${countGroupTag('世界', 'castworld', [['角色', p.npc_updates?.length || 0], ['关系', p.relation_undercurrents?.length || 0], ['世界', p.world_updates?.length || 0]])}
      </div>
    </section>
    <section class="sd-card"><h3>众声</h3><p>${htmlEscape((p.director_comment || '').replace(/^\s*众声\s*[:：]?\s*/, '') || '暂无')}</p></section>
    ${renderThreadsCard()}
    ${renderHistorySection()}`;
}

// 因果链：把分散在各卡里的"蝴蝶效应"空话收束成一处具体可视化的因果链。
function renderChainReactionsCard(p) {
  const list = Array.isArray(p.chain_reactions) ? p.chain_reactions : [];
  const body = list.length
    ? `<ol class="sd-chain-flowlist">${list.map((c) => {
        const spark = String(c.spark || '').trim();
        const chain = String(c.chain || '').trim();
        if (!spark && !chain) return '';
        // 把因果链按「→」拆成节点，做成可视化的流向链路
        const steps = [spark, ...chain.split(/\s*(?:→|->|⇒|，再|，又|，进而|，于是|然后|继而)\s*/)]
          .map((s) => String(s || '').trim()).filter(Boolean);
        const nodes = steps.map((s, i) => `<span class="sd-chain-node${i === 0 ? ' sd-chain-node-spark' : ''}">${htmlEscape(snip(s, 48))}</span>`).join('<i class="fa-solid fa-angle-right sd-chain-link"></i>');
        return `<li class="sd-chain-item"><div class="sd-chain-track">${nodes}</div></li>`;
      }).filter(Boolean).join('')}</ol>`
    : '<p class="sd-muted">尚未浮现因果链，将在下次推演时捕捉振翅连锁。</p>';
  return `<section class="sd-card sd-chain-card">
    <details class="sd-plain-fold" data-acc="tnfold-chain" open>
      <summary><b>因果链</b><span class="sd-summary-note">世界自行流转的连锁</span></summary>
      <div class="sd-fold-body">${body}</div>
    </details>
  </section>`;
}

// 伏笔显影卡：列出存活暗线及显影刻度，可钉住/唤醒/归档；整卡可折叠并记忆开合
function renderThreadsCard() {
  if (!settings.liveStageEnabled) return '';
  const store = getChatStore();
  const all = Array.isArray(store.threads) ? store.threads : [];
  const live = all.filter((t) => t.status !== 'closed');
  const closed = all.filter((t) => t.status === 'closed');
  const stageIdx = (s) => STAGE_LADDER.indexOf(sanitizeStage(s));
  const sorted = [...live].sort((a, b) => (Number(a.origin || 0) - Number(b.origin || 0)) || String(a.id).localeCompare(String(b.id)));
  const rowHtml = (t) => {
    const pct = Math.round((stageIdx(t.stage) / (STAGE_LADDER.length - 1)) * 100);
    const dormant = t.status === 'dormant';
    return `<article class="sd-thread-row${dormant ? ' sd-thread-dormant' : ''}${t.pinned ? ' sd-thread-pinned' : ''}">
      <div class="sd-thread-head">
        <button type="button" class="sd-icon-btn sd-icon-sm sd-thread-pin${t.pinned ? ' sd-thread-pin-on' : ''}" data-id="${htmlEscape(t.id)}" title="${t.pinned ? '已钉住，点击取消' : '钉住（重点追踪，不被自动归档）'}" aria-pressed="${t.pinned ? 'true' : 'false'}"><i class="fa-${t.pinned ? 'solid' : 'regular'} fa-thumbtack"></i></button>
        <h4>${htmlEscape(snip(t.title, 24))}</h4>
        <span class="sd-thread-stage">${htmlEscape(t.stage)}${dormant ? ' · 沉睡' : ''}</span>
        ${dormant ? `<button type="button" class="sd-icon-btn sd-icon-sm sd-thread-wake" data-id="${htmlEscape(t.id)}" title="唤醒"><i class="fa-solid fa-rotate-right"></i></button>` : ''}
        <button type="button" class="sd-icon-btn sd-icon-sm sd-thread-close" data-id="${htmlEscape(t.id)}" title="归档"><i class="fa-solid fa-box-archive"></i></button>
      </div>
      <div class="sd-bar sd-thread-bar"><i style="width:${pct}%"></i></div>
      ${t.essence ? `<p class="sd-thread-essence">${htmlEscape(snip(t.essence, 70))}</p>` : ''}
    </article>`;
  };
  const body = sorted.length
    ? sorted.map(rowHtml).join('')
    : '<p class="sd-muted">暂无在演伏笔。</p>';
  const closedFold = closed.length
    ? `<details class="sd-plain-fold sd-threads-closed-fold" data-acc="threads-closed"><summary><b>已落幕</b><span class="sd-summary-note">${closed.length} 条</span></summary>${closed.map((t) => `<article class="sd-thread-row sd-thread-closed"><div class="sd-thread-head"><h4>${htmlEscape(snip(t.title, 24))}</h4><span class="sd-thread-stage">${htmlEscape(t.stage)}</span><button type="button" class="sd-icon-btn sd-icon-sm sd-thread-purge" data-id="${htmlEscape(t.id)}" title="彻底删除"><i class="fa-solid fa-trash-can"></i></button></div>${t.essence ? `<p class="sd-thread-essence">${htmlEscape(snip(t.essence, 70))}</p>` : ''}</article>`).join('')}</details>`
    : '';
  return `<section class="sd-card sd-threads-card">
    <details class="sd-threads-fold" data-acc="threads-card" open>
      <summary class="sd-threads-summary"><b>伏笔显影</b><span class="sd-tpl-count">${live.length} 条在演</span>${all.length ? '<button type="button" class="sd-icon-btn sd-icon-sm sd-threads-clear" title="清空全部伏笔（在演与已落幕）" aria-label="清空全部伏笔"><i class="fa-solid fa-broom"></i></button>' : ''}</summary>
      <div class="sd-threads-body">
        ${body}
        ${closedFold}
      </div>
    </details>
  </section>`;
}

// 审片页跳转标签：按版块（任务线/角色世界）各一枚，标功能合并名 + 该版块各分项条数，点击跳到对应标签页。
// 任务线 = 任务标签页（任务 + 因果链）；角色世界 = 角色世界标签页（角色 + 关系 + 世界）。
function countGroupTag(label, jump, parts) {
  const inner = parts.map(([name, count]) => `<span class="sd-ct-part">${htmlEscape(name)}<b>${count}</b></span>`).join('');
  return `<button class="sd-count-tag sd-count-group" data-jump="${jump}"><span class="sd-ct-label">${htmlEscape(label)}</span>${inner}</button>`;
}

function renderHistorySection() {
  const history = Array.isArray(getChatStore().history) ? getChatStore().history : [];
  const rows = history.slice(0, 5).map((record) => {
    const st = record.plan?.story_status || {};
    return `<article class="sd-lib-row"><div class="sd-lib-main"><h4>${htmlEscape(st.title || st.current_arc || '未命名审片')}</h4><p class="sd-muted sd-fav-time">${htmlEscape(formatDateTime(record.createdAt))}</p></div>
      <div class="sd-lib-actions">
        <button type="button" class="sd-btn sd-lib-load sd-load-history" data-id="${htmlEscape(record.id)}">载入</button>
        <button type="button" class="sd-icon-btn sd-icon-sm sd-danger sd-delete-history" data-id="${htmlEscape(record.id)}" title="删除" aria-label="删除"><i class="fa-solid fa-trash-can"></i></button>
      </div></article>`;
  }).join('');
  return `<section class="sd-card"><div class="sd-field-head"><h3>历史记录</h3><span class="sd-summary-note">最多保留 5 条审片记录</span></div>${rows || '<p class="sd-muted">暂无历史记录。</p>'}</section>`;
}

function formatDateTime(date) {
  if (!date) return '';
  try { return new Date(date).toLocaleString(); } catch (_) { return String(date); }
}

function renderTasksNodesTab() {
  const p = currentPlan();
  if (!p) return renderNoPlan('任务尚未生成');
  return `${renderPlanSectionFold('任务', p.quests || [], 'quest', 'tnfold-quest')}${renderChainReactionsCard(p)}`;
}

function renderCastWorldTab() {
  const p = currentPlan();
  if (!p) return renderNoPlan('角色世界尚未生成');
  // 尘寰群生置顶（市井剪影，先声夺人），再是可折叠的角色动向 / 关系暗涌 / 世界回声（记忆开合，避免本页过长）
  return `${renderWorldChatterCard(p)}${renderPlanSectionFold('角色动向', p.npc_updates || [], 'npc', 'castfold-npc')}${renderRelationUndercurrentsCard(p)}${renderPlanSectionFold('世界回声', p.world_updates || [], 'world', 'castfold-world')}`;
}

// 关系暗涌：角色之间自行纠缠的张力（可负可中可正），独立于 {{user}} 演变。一行一簇关系，标出基调、走势与 user 知情程度。
function renderRelationUndercurrentsCard(p) {
  const normTone = (t) => {
    const s = String(t || '').trim().toLowerCase();
    if (/(neg|负|阴|敌|怨|裂)/.test(s)) return 'neg';
    if (/(pos|正|暖|和|盟|护)/.test(s)) return 'pos';
    if (s) return 'neu';
    return '';
  };
  const list = (Array.isArray(p.relation_undercurrents) ? p.relation_undercurrents : [])
    .map((r) => ({
      parties: String(r && r.parties || '').trim(),
      tone: normTone(r && r.tone),
      tension: String(r && r.tension || '').trim(),
      drift: String(r && r.drift || '').trim(),
      awareness: String(r && r.user_awareness || '').trim().toLowerCase(),
    }))
    .filter((r) => r.parties || r.tension);
  const awareLabel = { unaware: '浑然不知', rumor: '仅有耳闻', witness: '在场旁观' };
  const toneLabel = { neg: '负面', neu: '中立', pos: '正向' };
  const body = list.length
    ? list.map((r) => {
        const tag = awareLabel[r.awareness] || '';
        const tone = r.tone ? `<span class="sd-relus-tone sd-relus-tone-${r.tone}">${toneLabel[r.tone]}</span>` : '';
        return `<article class="sd-relus-row sd-relus-${r.tone || 'neu'}">
          <div class="sd-relus-head">${tone}<span class="sd-relus-parties">${htmlEscape(snip(r.parties, 40))}</span>${tag ? `<span class="sd-relus-aware" title="{{user}} 的知情程度">${htmlEscape(tag)}</span>` : ''}</div>
          ${r.tension ? `<p class="sd-relus-tension">${htmlEscape(snip(r.tension, 90))}</p>` : ''}
          ${r.drift ? `<p class="sd-relus-drift"><i class="fa-solid fa-arrow-trend-up"></i>${htmlEscape(snip(r.drift, 80))}</p>` : ''}
        </article>`;
      }).join('')
    : '<p class="sd-muted">本次推演未浮现角色之间的暗涌。下次推演时，导演会从世界里牵出几簇自行纠缠的关系。</p>';
  return `<section class="sd-card sd-relus-card">
    <details class="sd-plain-fold" data-acc="castfold-relus" open>
      <summary><b>关系暗涌</b><span class="sd-summary-note">${list.length} 条</span></summary>
      <div class="sd-fold-body">${body}</div>
    </details>
  </section>`;
}

// 可折叠版分区：summary 显示标题+条数，整组可收起；data-acc 记忆开合状态
function renderPlanSectionFold(title, items, kind, accKey) {
  return `<section class="sd-card sd-plan-section">
    <details class="sd-plain-fold" data-acc="${htmlEscape(accKey)}" open>
      <summary><b>${htmlEscape(title)}</b><span class="sd-summary-note">${items?.length || 0} 条</span></summary>
      <div class="sd-fold-body">${renderItemList(items || [], kind)}</div>
    </details>
  </section>`;
}

// 尘寰群生卡：世间嘈杂之声。默认是一方动态浮现的「市井舞台」——气泡缓缓滚动渐隐渐出，中段清晰、边缘模糊；
// 点「展开」切换为完整台本列表（出处坐标 + 台词，台本式两行），便于通读。
function renderWorldChatterCard(p) {
  if (!settings.worldChatterEnabled) return '';
  const list = (Array.isArray(p.world_chatter) ? p.world_chatter : [])
    .map((c) => ({
      text: String(c && (c.text ?? c) || '').trim(),
      who: String(c && c.who || '').trim(),
      where: String(c && c.where || '').trim(),
    }))
    .filter((c) => c.text);
  if (!list.length) {
    return `<section class="sd-card sd-chatter-card">
      <div class="sd-section-title"><h3>尘寰群生</h3><span>随推演刷新</span></div>
      <p class="sd-muted">暂未捕获群声。将在下次推演时，从世界里采集。</p>
    </section>`;
  }
  const lineHtml = (c) => `<div class="sd-chatter-line">${(c.who || c.where) ? `<span class="sd-chatter-src">${htmlEscape([c.who, c.where].filter(Boolean).join(' · '))}</span>` : ''}<span class="sd-chatter-say">${htmlEscape(c.text)}</span></div>`;

  // 展开态：完整台本列表
  if (chatterExpanded) {
    return `<section class="sd-card sd-chatter-card">
      <div class="sd-section-title"><h3>尘寰群生</h3><button type="button" class="sd-icon-btn sd-chatter-toggle" title="收起" aria-label="收起"><i class="fa-solid fa-compress"></i></button></div>
      <div class="sd-chatter-list">${list.map(lineHtml).join('')}</div>
    </section>`;
  }

  // 浮现态：定高舞台，气泡上滚渐隐渐出；为成环顺滑，列表整体复制一份首尾相接。
  // 用 index 派生的负 delay 让各条错峰，nth 着色让中段更清晰、远端更淡。
  const stage = [...list, ...list].map((c, i) => {
    const delay = (i * 1.6).toFixed(1);
    return `<div class="sd-chatter-float" style="animation-delay:-${delay}s">${lineHtml(c)}</div>`;
  }).join('');
  return `<section class="sd-card sd-chatter-card">
    <div class="sd-section-title"><h3>尘寰群生</h3><button type="button" class="sd-icon-btn sd-chatter-toggle" title="展开" aria-label="展开"><i class="fa-solid fa-expand"></i></button></div>
    <div class="sd-chatter-stage" aria-label="市井浮声"><div class="sd-chatter-track">${stage}</div></div>
  </section>`;
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
  } else if (kind === 'npc') {
    fields.push(['目标', item.current_goal], ['行动', item.next_action], ['隐情', item.hidden_agenda], ['关系网', item.relations || item.relationship_to_user]);
  } else {
    fields.push(['内容', item.content], ['波及', item.scope]);
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
  } else if (kind === 'npc') {
    push('定位', item.role);
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
      <div class="sd-field-head"><h3>当前聊天的剧本</h3><button type="button" class="sd-icon-btn sd-icon-sm sd-expand-editor" data-target="sd-blueprint" data-title="当前聊天的剧本" title="展开编辑" aria-label="展开编辑"><i class="fa-solid fa-up-right-and-down-left-from-center"></i></button></div>
      <textarea class="text_pole sd-textarea sd-blueprint" spellcheck="false">${htmlEscape(store.blueprint || DEFAULT_BLUEPRINT)}</textarea>
      <div class="sd-button-row sd-current-blueprint-actions">
        <button type="button" class="sd-btn sd-save-blueprint">保存当前剧本</button>
        <button type="button" class="sd-btn sd-save-template">保存到剧本库</button>
        <button type="button" class="sd-btn sd-restore-blueprint" title="找回更新前你上一次使用的剧本" ${store.blueprintBackup ? '' : 'disabled'}>恢复上次</button>
        <button type="button" class="sd-btn sd-reset-blueprint">恢复默认剧本</button>
      </div>
    </section>
    <section class="sd-card">${renderLibrarySection(templateLibraryCfg())}</section>`;
}



function renderContextTab() {
  const opts = settings.contextOptions;
  // 懒加载：ST 重进/刷新后内存里的扫描缓存为空，但勾选状态仍在 settings 里。
  // 首次进入取材页时后台补扫一次，让面板照实显示「已读取 + 既有勾选」，无需手动点读取。
  maybeAutoScanContext();
  return `
    <section class="sd-card sd-base-card">
      <div class="sd-base-row">
        <label class="checkbox_label"><input type="checkbox" class="sd-opt" data-key="includeChatHistory" ${opts.includeChatHistory ? 'checked' : ''}> 上下文参考</label>
        <label class="sd-depth-field"><span>参考楼层数</span><input class="text_pole sd-context-depth" type="number" min="1" max="200" value="${htmlEscape(opts.contextDepth || 5)}"></label>
      </div>
      <div class="sd-base-row">
        <span class="sd-fixed-ref"><span class="sd-fixed-ref-label">当前角色</span>${infoTag(getCharacterName())}</span>
        <span class="sd-fixed-ref"><span class="sd-fixed-ref-label">当前用户</span>${infoTag(getPersonaName())}</span>
      </div>
    </section>
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
      <summary class="sd-dropdown-head"><span>选择预设</span><b>${htmlEscape(headLabel)}</b></summary>
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
  if (lastWorldView && !names.includes(lastWorldView)) lastWorldView = '';
  const viewName = lastWorldView || selected[selected.length - 1] || '';
  // 勾选框只管选中/取消；书名是独立按钮，点名只切换下方查看的条目，不动选中状态
  const rows = names.map((name) => `<div class="sd-source-row sd-world-row${viewName === name ? ' sd-world-viewing' : ''}">
    <input type="checkbox" class="sd-toggle-worldbook" data-name="${htmlEscape(name)}" ${selected.includes(name) ? 'checked' : ''} title="选中作为引用">
    <button type="button" class="sd-world-name" data-name="${htmlEscape(name)}"><span>${htmlEscape(name)}</span>${boundNames.includes(name) ? badge('当前绑定') : ''}${isWorldBookGlobal(name) ? badge('全局') : ''}</button>
    <button type="button" class="sd-icon-btn sd-icon-sm sd-world-global${isWorldBookGlobal(name) ? ' sd-world-global-on' : ''}" data-name="${htmlEscape(name)}" title="${isWorldBookGlobal(name) ? '已设为全局，点击取消（所有聊天默认引用）' : '设为全局：对所有聊天默认引用（单个聊天仍可取消）'}" aria-pressed="${isWorldBookGlobal(name) ? 'true' : 'false'}"><i class="fa-${isWorldBookGlobal(name) ? 'solid' : 'regular'} fa-earth-asia"></i></button>
  </div>`).join('');
  return `
    <details class="sd-dropdown" data-acc="dd-world">
      <summary class="sd-dropdown-head"><span>选择世界书</span><b>${selected.length} 项</b></summary>
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

// 注入范围开关：勾选哪些类别会被写进暗线灵感池（控注入 token）
function renderInjectSections() {
  const sec = settings.injectSections || {};
  const items = [
    ['quests', '任务入口'],
    ['nodes', '因果链'],
    ['npc', '人物动向'],
    ['relations', '关系暗涌'],
    ['world', '世界涟漪'],
  ];
  if (settings.liveStageEnabled) items.push(['threads', '伏笔显影']);
  if (settings.geopoliticsEnabled) items.push(['geopolitics', '世界格局']);
  const boxes = items.map(([key, label]) => `<label class="checkbox_label sd-inject-section"><input type="checkbox" class="sd-inject-section-toggle" data-key="${key}" ${sec[key] !== false ? 'checked' : ''}> ${label}</label>`).join('');
  return `<details class="sd-plain-fold" data-acc="inject-sections"><summary><b>注入范围</b></summary><div class="sd-inject-section-grid">${boxes}</div></details>`;
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
  // 与日志同款的终端式呈现：等宽块 + token 估算
  return `<details class="sd-plain-fold" data-acc="inject-preview">
    <summary><b>当前注入内容</b>${infoTag(`约 ${estimateTokens(text)} token`)}</summary>
    <pre class="sd-term sd-inject-term">${htmlEscape(text || '（本次推演结果为空）')}</pre>
  </details>`;
}

function renderDirectorSettingsTab() {
  return `
    <section class="sd-card">
      <h3>刷新</h3>
      <p class="sd-muted sd-hint-sm">仅计入角色回复层</p>
      <div class="sd-refresh-row">
        <label class="checkbox_label"><input type="checkbox" class="sd-auto-refresh" ${settings.autoRefresh ? 'checked' : ''}> 自动推演剧情</label>
        <label class="sd-floor-refresh"><span>每</span><input class="text_pole sd-auto-every" type="number" min="2" max="50" value="${htmlEscape(settings.autoRefreshEvery || 10)}"><span>层</span></label>
      </div>
    </section>
    <section class="sd-card">
      <h3>暗线注入</h3>
      <p class="sd-muted sd-hint-sm">把推演结果提炼成暗线灵感，悄悄注入后续聊天</p>
      <div class="sd-refresh-row">
        <label class="checkbox_label"><input type="checkbox" class="sd-inject-enabled" ${settings.injectEnabled ? 'checked' : ''}> 启用暗线注入</label>
        <label class="sd-floor-refresh"><span>注入深度</span><input class="text_pole sd-inject-depth" type="number" min="0" max="20" value="${htmlEscape(settings.injectDepth ?? 2)}"></label>
      </div>
      ${renderInjectSections()}
      ${renderInjectPreview()}
    </section>
    <section class="sd-card">
      <div class="sd-livefeature-row">
        <label class="checkbox_label"><input type="checkbox" class="sd-livestage-enabled" ${settings.liveStageEnabled ? 'checked' : ''}> 启用伏笔显影</label>
        <p class="sd-muted sd-hint-sm">推演时按正文呼应判定进度（铺陈→升温→临界→高潮→落幕），使暗线有连续命运</p>
      </div>
      <div class="sd-livefeature-row">
        <label class="checkbox_label"><input type="checkbox" class="sd-worldchatter-enabled" ${settings.worldChatterEnabled ? 'checked' : ''}> 启用尘寰群生</label>
        <p class="sd-muted sd-hint-sm">在「世界」页生成当前世界的芸芸众声</p>
      </div>
      <div class="sd-livefeature-row">
        <label class="checkbox_label"><input type="checkbox" class="sd-geopolitics-enabled" ${settings.geopoliticsEnabled ? 'checked' : ''}> 启用世界格局</label>
        <p class="sd-muted sd-hint-sm">势力格局、地缘张力与世界事件，并作为世界回声的上游源头</p>
      </div>
    </section>
    <section class="sd-card">
      <details class="sd-plain-fold" data-acc="system-prompt">
        <summary><b>幕后提示词</b><button type="button" class="sd-icon-btn sd-icon-sm sd-expand-editor" data-target="sd-system-prompt" data-title="幕后提示词" title="展开编辑" aria-label="展开编辑"><i class="fa-solid fa-up-right-and-down-left-from-center"></i></button></summary>
        <textarea class="text_pole sd-textarea sd-system-prompt" spellcheck="false">${htmlEscape(settings.systemPrompt || DEFAULT_SYSTEM_PROMPT)}</textarea>
      </details>
    </section>
    <section class="sd-card">
      <details class="sd-plain-fold" data-acc="output-schema">
        <summary><b>输出格式</b><span class="sd-summary-note">推演返回的JSON结构，一般无需改动</span></summary>
        <textarea class="text_pole sd-textarea sd-output-schema" spellcheck="false">${htmlEscape(settings.outputSchemaText || JSON_SCHEMA_TEXT)}</textarea>
      </details>
      <div class="sd-button-row"><button class="sd-btn sd-save-director-settings">保存幕后</button><button class="sd-btn sd-restore-system" title="找回更新前你上一次使用的提示词与输出格式" ${(settings.systemPromptBackup || settings.outputSchemaBackup) ? '' : 'disabled'}>恢复上次</button><button class="sd-btn sd-reset-system">恢复默认</button></div>
    </section>`;
}

const LOG_STATUS_LABELS = { success: '成功', error: '失败', cancelled: '已取消', loading: '生成中', none: '—' };
const LOG_KIND_LABELS = { director: '推演', theater: '小剧场' };

// 日志详情平铺展示，无二级折叠
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
      <pre class="sd-term">${htmlEscape(log.response || '暂无')}</pre>
    </div>
  </details>`;
}

// 提取·世界书（取材式·独立于主线）：刷新→下拉多选书→选中书展开条目勾选。折叠态持久。
function renderTtsExtractWorldBooks() {
  const t = settings.tts || {};
  const boundNames = contextScanCache.boundWorldBookNames || detectBoundWorldBookNames();
  const allNames = uniqueClean([...boundNames, ...(contextScanCache.worldBookNames || [])]).filter(Boolean);
  const selected = ttsExtractWorldBooks().filter((n) => allNames.includes(n));
  if (ttsExtractWorldView && !allNames.includes(ttsExtractWorldView)) ttsExtractWorldView = '';
  const viewName = ttsExtractWorldView || selected[selected.length - 1] || '';
  const head = `<div class="sd-tts-extract-wb-head"><span>世界书</span><button type="button" class="sd-btn sd-mini-btn sd-tts-extract-wb-scan"><i class="fa-solid fa-rotate"></i> ${allNames.length ? '刷新' : '扫描'}</button></div>`;
  if (!allNames.length) {
    return `<div class="sd-tts-extract-wb">${head}</div>`;
  }
  const bookRows = allNames.map((name) => `
    <div class="sd-tts-extract-wb-row${viewName === name ? ' sd-tts-extract-wb-viewing' : ''}">
      <input type="checkbox" class="sd-tts-extract-wb-toggle" data-name="${htmlEscape(name)}"${selected.includes(name) ? ' checked' : ''} title="选中作为提取参照">
      <button type="button" class="sd-tts-extract-wb-name" data-name="${htmlEscape(name)}"><span>${htmlEscape(name)}</span>${boundNames.includes(name) ? '<em class="sd-tts-extract-wb-tag">绑定</em>' : ''}</button>
    </div>`).join('');
  const items = viewName ? (contextScanCache.worldBooks?.[viewName] || []) : [];
  let itemSelCount = 0;
  const itemRows = items.map((item, index) => {
    const id = getContextItemId(item, index);
    const title = item.name || item.comment || (Array.isArray(item.key) ? item.key.join(', ') : item.key) || `条目 ${index + 1}`;
    const checked = isTtsExtractWorldItemSelected(viewName, id, item.enabled);
    if (checked) itemSelCount++;
    return `<label class="sd-tts-extract-wb-item"><input type="checkbox" class="sd-tts-extract-wb-check" data-book="${htmlEscape(viewName)}" data-id="${htmlEscape(String(id))}"${checked ? ' checked' : ''}><span>${htmlEscape(title)}</span></label>`;
  }).join('');
  const headRight = selected.length >= 2 ? `${selected.length} 项` : (selected.length === 1 ? htmlEscape(selected[0]) : '未选择');
  return `<div class="sd-tts-extract-wb">${head}
    <details class="sd-tts-extract-wb-dropdown" data-fold="wb"${t.extractWbFoldOpen !== false ? ' open' : ''}>
      <summary><span>选择</span><b>${headRight}</b></summary>
      <div class="sd-tts-extract-wb-list">${bookRows}</div>
    </details>
    ${viewName
      ? `<details class="sd-tts-extract-wb-itemfold" data-fold="items"${t.extractItemsFoldOpen !== false ? ' open' : ''}>
          <summary><span>${htmlEscape(viewName)} · 条目</span><b>已选 ${itemSelCount}/${items.length}</b></summary>
          <div class="sd-tts-extract-wb-items">${itemRows || '<span class="sd-muted" style="font-size:.82em">该世界书暂无条目。</span>'}</div>
        </details>`
      : '<span class="sd-muted" style="font-size:.78em">勾选或点击书名查看条目，再按需勾选要带的条目。</span>'}
  </div>`;
}

function renderTtsVoiceMapRows(map, lib = []) {
  if (!map.length) return '<p class="sd-muted sd-hint-sm">尚未配置角色。点「添加角色」，下拉选音色库里的音色（或在库为空时手填 ID）；未配置的角色不会生成语音。</p>';
  const hasLib = Array.isArray(lib) && lib.length > 0;
  return map.map((row, i) => {
    // 音色库非空 → 下拉选（值为 voiceId）；当前 voiceId 不在库里则补一个临时项保留显示；库为空 → 退回手填输入框
    let idField;
    if (hasLib) {
      const inLib = lib.some((v) => v.voiceId === row.voiceId);
      const opts = [`<option value="" ${!row.voiceId ? 'selected' : ''}>— 选择音色 —</option>`]
        .concat(lib.map((v) => `<option value="${htmlEscape(v.voiceId)}" ${v.voiceId === row.voiceId ? 'selected' : ''}>${htmlEscape(v.name || v.voiceId)}</option>`));
      if (row.voiceId && !inLib) opts.push(`<option value="${htmlEscape(row.voiceId)}" selected>（自定义）${htmlEscape(row.voiceId)}</option>`);
      idField = `<select class="text_pole sd-tts-vid-sel">${opts.join('')}</select>`;
    } else {
      idField = `<input class="text_pole sd-tts-vid" placeholder="音色 ID" value="${htmlEscape(row.voiceId || '')}">`;
    }
    return `
    <div class="sd-tts-voice-row" data-idx="${i}">
      <input class="text_pole sd-tts-vname" placeholder="角色名" value="${htmlEscape(row.name || '')}">
      ${idField}
      <button type="button" class="sd-icon-btn sd-danger sd-tts-vdel" title="删除该角色" aria-label="删除该角色"><i class="fa-solid fa-trash-can"></i></button>
    </div>`;
  }).join('');
}

// 音色库 / NPC 原型 共用渲染：按文件夹分组（沿用剧札 sd-lib-folder/row 外观），条目只显示名字，小图标，data-id 寻址。
// kind: 'lib'（音色库，名字字段 name）| 'npc'（原型，名字字段 label）。试听/编辑/删除按钮 class 按 kind 区分。
function renderTtsVoiceEntryRows(list, kind) {
  const isNpc = kind === 'npc';
  const getName = (it) => isNpc ? it.label : it.name;
  const cls = isNpc ? { test: 'sd-tts-narch-test', edit: 'sd-tts-narch-edit', del: 'sd-tts-narch-del' }
                    : { test: 'sd-tts-lib-test', edit: 'sd-tts-lib-edit', del: 'sd-tts-lib-del' };
  if (!list.length) {
    return `<p class="sd-muted sd-hint-sm">${isNpc ? '尚未配置原型。点「添加原型」，填入原型名（如 严肃老年男）与音色 ID。' : '音色库为空。点「添加音色」，填入音色名（如 温柔青年音）与 MiniMax 音色 ID。'}</p>`;
  }
  const ns = isNpc ? 'ttsnpc' : 'ttslib';
  const row = (it) => `
    <article class="sd-lib-row">
      <div class="sd-lib-main"><h4>${htmlEscape(getName(it) || '未命名')}</h4></div>
      <div class="sd-lib-actions">
        <button type="button" class="sd-icon-btn sd-icon-sm ${cls.test}" data-id="${htmlEscape(it.id)}" title="试听" aria-label="试听"><i class="fa-solid fa-play"></i></button>
        <button type="button" class="sd-icon-btn sd-icon-sm ${cls.edit}" data-id="${htmlEscape(it.id)}" title="编辑" aria-label="编辑"><i class="fa-solid fa-pencil"></i></button>
        <button type="button" class="sd-icon-btn sd-icon-sm sd-danger ${cls.del}" data-id="${htmlEscape(it.id)}" title="删除" aria-label="删除"><i class="fa-solid fa-trash-can"></i></button>
      </div>
    </article>`;
  const { folderList, loose } = groupByFolder(list, (it) => it.folder, getName, true);
  const folderHtml = folderList.map(({ name, list: items }) => `
    <details class="sd-lib-folder" data-acc="${ns}-folder-${htmlEscape(name)}">
      <summary><i class="fa-solid fa-folder"></i><b>${htmlEscape(name)}</b><span>${items.length}</span></summary>
      <div class="sd-lib-folder-body">${items.map(row).join('')}</div>
    </details>`).join('');
  return folderHtml + loose.map(row).join('');
}

function renderTtsVoiceLibRows(lib) {
  return renderTtsVoiceEntryRows(Array.isArray(lib) ? lib : [], 'lib');
}

function renderTtsNpcRows(list) {
  return renderTtsVoiceEntryRows(Array.isArray(list) ? list : [], 'npc');
}
function renderTtsTagRows(rules) {
  const list = rules.length ? rules : [{ name: '', action: 'remove' }];
  return list.map((rule, index) => `
    <div class="sd-tts-tag-row" data-idx="${index}">
      <input class="text_pole sd-tts-tag-name" placeholder="标签名，如 thinking、status" value="${htmlEscape(rule.name || '')}">
      <select class="text_pole sd-tts-tag-action"><option value="remove" ${rule.action !== 'extract' ? 'selected' : ''}>屏蔽</option><option value="extract" ${rule.action === 'extract' ? 'selected' : ''}>提取</option></select>
      <button type="button" class="sd-icon-btn sd-danger sd-tts-tag-del" title="删除" aria-label="删除"><i class="fa-solid fa-xmark"></i></button>
    </div>`).join('');
}

// 发音词典行：原文 → 读音/替换。空列表给一空行引导。
function renderTtsPronDictRows(dict) {
  const list = dict.length ? dict : [{ from: '', to: '' }];
  return list.map((e, index) => `
    <div class="sd-tts-prondict-row" data-idx="${index}">
      <input class="text_pole sd-tts-prondict-from" placeholder="原文，如 处理" value="${htmlEscape(e.from || '')}">
      <span class="sd-tts-prondict-arrow">→</span>
      <input class="text_pole sd-tts-prondict-to" placeholder="读音，如 chu3li3" value="${htmlEscape(e.to || '')}">
      <button type="button" class="sd-icon-btn sd-danger sd-tts-prondict-del" title="删除" aria-label="删除"><i class="fa-solid fa-xmark"></i></button>
    </div>`).join('');
}

function ttsSchemeLibraryCfg() {
  return {
    ns: 'ttsscheme',
    title: '台词指导方案库',
    items: settings.tts?.guidanceSchemes || [],
    getName: (x) => x.name,
    getFolder: (x) => x.folder,
    getSearch: () => ttsSchemeSearch,
    setSearch: (v) => { ttsSchemeSearch = v; },
    exportMode: ttsSchemeExportMode,
    selection: ttsSchemeExportSelection,
    emptyText: '暂无方案',
    searchPlaceholder: '搜索方案标题…',
  };
}

// 收藏夹列表占位（点刷新后由 ttsRefreshFavorites 异步填充）
function renderTtsFavoritesPlaceholder() {
  return '<p class="sd-muted sd-hint-sm">点「刷新收藏」加载已收藏的语音。</p>';
}

function renderTtsTab() {
  const t = settings.tts || {};
  const map = ttsActiveVoiceMap();
  const lib = Array.isArray(t.voiceLibrary) ? t.voiceLibrary : [];
  const profiles = Array.isArray(settings.apiProfiles) ? settings.apiProfiles : [];
  const endpoints = Object.entries(MINIMAX_ENDPOINTS);
  const dis = t.enabled ? '' : 'sd-disabled-card';
  const epEmoji = (name) => name.includes('国际') ? '🌏 国际' : name.includes('备用') ? '🇨🇳 备用' : '🇨🇳 国内';
  return `
    <section class="sd-card">
      <div class="sd-toggle-row">
        <label class="checkbox_label"><input type="checkbox" class="sd-tts-enabled" ${t.enabled ? 'checked' : ''}> 启用配音</label>
      </div>
    </section>
    <section class="sd-card ${dis}">
      <details class="sd-plain-fold" data-acc="tts-api" open>
        <summary><b>MiniMax</b></summary>
        <label>API Key</label><input class="text_pole sd-tts-key" type="password" placeholder="MiniMax API Key" value="${htmlEscape(t.apiKey || '')}">
        <label>URL</label>
        <select class="text_pole sd-tts-endpoint">${endpoints.map(([name, url]) => `<option value="${htmlEscape(url)}" ${url === t.endpoint ? 'selected' : ''}>${epEmoji(name)}</option>`).join('')}</select>
        <p class="sd-muted sd-hint-sm sd-tts-endpoint-url">${htmlEscape(t.endpoint || (endpoints[0] && endpoints[0][1]) || '')}</p>
        <label>模型</label>
        <select class="text_pole sd-tts-model">${MINIMAX_MODELS.map((m) => `<option value="${htmlEscape(m)}" ${m === t.model ? 'selected' : ''}>${htmlEscape(m)}</option>`).join('')}</select>
        <label>台词分析抓取模型</label>
        <select class="text_pole sd-tts-extract-api"><option value="">使用千幕当前主 API</option>${profiles.map((p) => `<option value="${htmlEscape(p.id)}" ${p.id === t.extractApiProfileId ? 'selected' : ''}>${htmlEscape(p.name || p.model || '未命名API')}</option>`).join('')}</select>
        <div class="sd-button-row"><button type="button" class="sd-btn sd-tts-test-conn"><i class="fa-solid fa-plug-circle-check"></i>测试连接</button><button type="button" class="sd-btn sd-tts-save-conn">保存</button></div>
      </details>
    </section>
    <section class="sd-card ${dis}">
      <details class="sd-plain-fold" data-acc="tts-voice" open>
        <summary><b>主音色匹配</b></summary>
        <div class="sd-tts-voice-list">${renderTtsVoiceMapRows(map, lib)}</div>
        <div class="sd-button-row"><button type="button" class="sd-btn sd-mini-btn sd-tts-add-voice"><i class="fa-solid fa-plus"></i>添加角色</button></div>
      </details>
    </section>
    <section class="sd-card ${dis}">
      <details class="sd-plain-fold" data-acc="tts-extract-ctx">
        <summary><b>人设参照</b></summary>
        <div class="sd-tts-extract-tags">
          <span class="sd-reader-setup-tag"><i class="fa-solid fa-user"></i> 角色：${htmlEscape(getCharacterName() || '未选择')}</span>
          <span class="sd-reader-setup-tag"><i class="fa-solid fa-circle-user"></i> 我：${htmlEscape(getPersonaName() || '未选择')}</span>
        </div>
        ${renderTtsExtractWorldBooks()}
      </details>
    </section>
    <section class="sd-card ${dis}">
      <details class="sd-plain-fold" data-acc="tts-lib" open>
        <summary><b>音色库</b></summary>
        <label>试听台词</label><input class="text_pole sd-tts-test-text" placeholder="输入一句话，用于各音色试听" value="${htmlEscape(t.testText || '你好，这是一段试听。')}">
        <div class="sd-tts-lib-list sd-scroll">${renderTtsVoiceLibRows(lib)}</div>
        <div class="sd-button-row"><button type="button" class="sd-btn sd-mini-btn sd-tts-add-lib"><i class="fa-solid fa-plus"></i>添加音色</button></div>
      </details>
    </section>
    <section class="sd-card ${dis}">
      <details class="sd-plain-fold" data-acc="tts-npc" open>
        <summary><b>泛用音色库</b><span class="sd-tts-sub">提取模型自动根据此库为非主角色人物适配音色</span></summary>
        <label class="checkbox_label"><input type="checkbox" class="sd-tts-npc-enabled" ${t.npcEnabled ? 'checked' : ''}> 启用</label>
        <div class="sd-tts-npc-list sd-scroll">${renderTtsNpcRows(Array.isArray(t.npcArchetypes) ? t.npcArchetypes : [])}</div>
        <div class="sd-button-row">
          <button type="button" class="sd-btn sd-mini-btn sd-tts-add-npc"><i class="fa-solid fa-plus"></i>添加原型</button>
          <button type="button" class="sd-btn sd-mini-btn sd-tts-npc-forget" title="清空本聊天已记忆的 NPC→原型 分配，下次重新归类">清空本聊天分配</button>
        </div>
      </details>
    </section>
    <section class="sd-card ${dis}">
      <details class="sd-plain-fold" data-acc="tts-params" open>
        <summary><b>默认参数</b></summary>
        <label>语速 <span class="sd-tts-speed-val">${Number(t.defaultSpeed ?? 1).toFixed(2)}</span></label>
        <input type="range" class="sd-tts-speed" min="0.5" max="2" step="0.05" value="${Number(t.defaultSpeed ?? 1)}">
        <label>音量 <span class="sd-tts-vol-val">${Number(t.defaultVol ?? 1).toFixed(1)}</span></label>
        <input type="range" class="sd-tts-vol" min="0.1" max="10" step="0.1" value="${Number(t.defaultVol ?? 1)}">
        <label>语调 <span class="sd-tts-pitch-val">${Number(t.defaultPitch ?? 0)}</span></label>
        <input type="range" class="sd-tts-pitch" min="-12" max="12" step="1" value="${Number(t.defaultPitch ?? 0)}">
      </details>
    </section>
    <section class="sd-card ${dis}">
      <details class="sd-plain-fold" data-acc="tts-lang-fx">
        <summary><b>语言增强/音效器</b></summary>
        <label>语言增强</label>
        <div class="sd-muted sd-hint-sm sd-tts-fx-hint">混合中英用自动即可；粤语须选粤语/广东话</div>
        <select class="text_pole sd-tts-langboost">${MINIMAX_LANGUAGE_BOOST.map((o) => `<option value="${o.value}" ${(t.languageBoost || 'auto') === o.value ? 'selected' : ''}>${o.label}</option>`).join('')}</select>
        <label style="margin-top:10px">音效</label>
        <div class="sd-muted sd-hint-sm sd-tts-fx-hint">全局生效，慎用</div>
        <select class="text_pole sd-tts-soundfx">${MINIMAX_SOUND_EFFECTS.map((o) => `<option value="${o.value}" ${(t.soundEffects || '') === o.value ? 'selected' : ''}>${o.label}</option>`).join('')}</select>
        <label class="checkbox_label" style="margin-top:10px"><input type="checkbox" class="sd-tts-soundfx-auto" ${t.soundFxAuto ? 'checked' : ''}> 启用音效自动化</label>
        <div class="sd-muted sd-hint-sm sd-tts-fx-hint">提取模型按语境为每句挑音效，与全局设置互斥</div>
        <label style="margin-top:10px">音高（低沉↔明亮）<span class="sd-tts-vmpitch-val">${Number(t.vmPitch ?? 0)}</span></label>
        <input type="range" class="sd-tts-vmpitch" min="-100" max="100" step="5" value="${Number(t.vmPitch ?? 0)}">
        <label>强度（刚劲↔轻柔）<span class="sd-tts-vmintensity-val">${Number(t.vmIntensity ?? 0)}</span></label>
        <input type="range" class="sd-tts-vmintensity" min="-100" max="100" step="5" value="${Number(t.vmIntensity ?? 0)}">
        <label>音色（浑厚↔清脆）<span class="sd-tts-vmtimbre-val">${Number(t.vmTimbre ?? 0)}</span></label>
        <input type="range" class="sd-tts-vmtimbre" min="-100" max="100" step="5" value="${Number(t.vmTimbre ?? 0)}">
      </details>
    </section>
    <section class="sd-card ${dis}">
      <details class="sd-plain-fold" data-acc="tts-tags" open>
        <summary><b>标签规则</b></summary>
        <div class="sd-tts-tag-list">${renderTtsTagRows(Array.isArray(t.tagRules) ? t.tagRules : [])}</div>
        <div class="sd-button-row"><button type="button" class="sd-btn sd-mini-btn sd-tts-add-tag"><i class="fa-solid fa-plus"></i>添加标签</button></div>
        <label class="checkbox_label"><input type="checkbox" class="sd-tts-strip-html" ${t.stripHtml !== false ? 'checked' : ''}> 屏蔽裸 HTML 标签（状态栏/卡片等）</label>
      </details>
    </section>
    <section class="sd-card ${dis}">
      <details class="sd-plain-fold" data-acc="tts-prondict">
        <summary><b>发音词典</b></summary>
        <p class="sd-muted sd-hint-sm">「原文」填要改的词，「读音」填拼音带声调数字，如 处理 → chu3li3。全局生效。</p>
        <div class="sd-tts-prondict-list">${renderTtsPronDictRows(Array.isArray(t.pronunciationDict) ? t.pronunciationDict : [])}</div>
        <div class="sd-button-row"><button type="button" class="sd-btn sd-mini-btn sd-tts-add-prondict"><i class="fa-solid fa-plus"></i>添加词条</button></div>
      </details>
    </section>
    <section class="sd-card ${dis}">
      <details class="sd-plain-fold" data-acc="tts-favorites" open>
        <summary><b>收藏夹</b></summary>
        <div class="sd-tts-fav-list sd-scroll">${renderTtsFavoritesPlaceholder()}</div>
        <div class="sd-button-row"><button type="button" class="sd-btn sd-mini-btn sd-tts-fav-refresh"><i class="fa-solid fa-rotate"></i>刷新收藏</button></div>
      </details>
    </section>
    <section class="sd-card ${dis}">
      <details class="sd-plain-fold" data-acc="tts-cache" open>
        <summary><b>音频缓存</b></summary>
        <p class="sd-muted sd-hint-sm">音频缓存不支持跨端，如需换设备记得导出。</p>
        <label>缓存条数上限</label><input class="text_pole sd-tts-cache-limit" type="number" min="0" step="10" value="${Number(t.cacheLimit ?? 200)}">
        <div class="sd-button-row">
          <button type="button" class="sd-btn sd-mini-btn sd-tts-cache-export"><i class="fa-solid fa-file-export"></i>导出缓存</button>
          <label class="sd-btn sd-mini-btn sd-tts-cache-import-label" title="导入音频缓存文件"><i class="fa-solid fa-file-import"></i>导入缓存<input type="file" accept="application/json" class="sd-tts-cache-import" hidden></label>
          <button type="button" class="sd-btn sd-mini-btn sd-danger sd-tts-cache-clear" title="清空音频缓存"><i class="fa-solid fa-broom"></i>清空缓存</button>
        </div>
      </details>
    </section>
    <section class="sd-card ${dis}">
      <details class="sd-plain-fold" data-acc="tts-extract-prompt">
        <summary><b>台词提取提示词</b></summary>
        <textarea class="text_pole sd-textarea sd-tts-extract-prompt" spellcheck="false" placeholder="留空则使用内置默认">${htmlEscape(t.extractPrompt || TTS_EXTRACT_SYSTEM)}</textarea>
        <div class="sd-button-row">
          <button type="button" class="sd-btn sd-tts-save-prompt">保存提示词</button>
          <button type="button" class="sd-btn sd-tts-save-scheme">保存到方案库</button>
          <button type="button" class="sd-btn sd-tts-restore-prompt" title="找回载入/重置前你上一次使用的提示词" ${t.extractPromptBackup ? '' : 'disabled'}>恢复上次</button>
          <button type="button" class="sd-btn sd-tts-reset-prompt">恢复默认</button>
        </div>
        ${renderLibrarySection(ttsSchemeLibraryCfg())}
      </details>
    </section>`;
}

function bindTtsTabEvents(root) {
  if (activeTab !== 'tts') return;
  const t = settings.tts;
  maybeAutoScanTtsExtract();   // 首开配音页：懒加载补扫世界书，让「人设参照」已选状态免手动刷新即显（重进/重启后）

  // 总开关
  root.querySelector('.sd-tts-enabled')?.addEventListener('change', (e) => {
    t.enabled = !!e.target.checked;
    saveSettings();
    if (t.enabled) ttsStartChat(); else ttsStopChat();
    renderModal();
  });

  // 接口字段：失焦即存
  const bindField = (sel, key, transform) => {
    root.querySelector(sel)?.addEventListener('change', (e) => {
      t[key] = transform ? transform(e.target.value) : e.target.value;
      saveSettings();
    });
  };
  bindField('.sd-tts-key', 'apiKey');
  bindField('.sd-tts-endpoint', 'endpoint');
  // URL 选择变化时，标题下方实时显示具体网址
  root.querySelector('.sd-tts-endpoint')?.addEventListener('change', (e) => {
    const out = root.querySelector('.sd-tts-endpoint-url');
    if (out) out.textContent = e.target.value || '';
  });
  bindField('.sd-tts-model', 'model');
  bindField('.sd-tts-extract-api', 'extractApiProfileId');
  bindField('.sd-tts-cache-limit', 'cacheLimit', (v) => Math.max(0, Number(v) || 0));
  bindField('.sd-tts-test-text', 'testText', (v) => String(v || ''));

  // MiniMax 接口：测试连接（合成一句试听语音并播放）/ 保存（字段失焦本已存，此处显式存 + 反馈）
  root.querySelector('.sd-tts-test-conn')?.addEventListener('click', async (e) => {
    const btn = e.currentTarget;
    // 以当前界面值为准（不强依赖已 change 落盘）
    const apiKey = (root.querySelector('.sd-tts-key')?.value || '').trim();
    const endpoint = root.querySelector('.sd-tts-endpoint')?.value || t.endpoint;
    const model = root.querySelector('.sd-tts-model')?.value || t.model;
    if (!apiKey) { toast('请先填写 MiniMax API Key。', 'warning'); return; }
    // 测试音色：固定用 MiniMax 内置音色，仅验连通性——不取用户库/映射（那些 ID 可能对当前账号/模型无效，导致测试不稳）
    const voiceId = 'male-qn-qingse';
    const btnIcon = btn.querySelector('i');
    const prevIcon = btnIcon?.className;
    if (btnIcon) btnIcon.className = 'fa-solid fa-spinner fa-spin';
    btn.disabled = true;
    try {
      const { blob } = await ttsSynthesize({
        apiKey, text: '你好，这是一段连接测试。', voiceId, model,
        speed: Number(t.defaultSpeed ?? 1), pitch: Number(t.defaultPitch ?? 0),
        format: t.format || 'mp3', endpoint, proxyBase: t.proxyBase, groupId: t.groupId,
      });
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      audio.addEventListener('ended', () => URL.revokeObjectURL(url), { once: true });
      await audio.play().catch(() => {});
      toast('已成功连接', 'success');
    } catch (err) {
      toast(`连接失败：${err?.message || err}`, 'error');
    } finally {
      btn.disabled = false;
      if (btnIcon && prevIcon) btnIcon.className = prevIcon;
    }
  });
  root.querySelector('.sd-tts-save-conn')?.addEventListener('click', () => {
    // 把当前界面值显式写入并落盘（即便用户没触发 change）
    t.apiKey = (root.querySelector('.sd-tts-key')?.value || '').trim();
    t.endpoint = root.querySelector('.sd-tts-endpoint')?.value || t.endpoint;
    t.model = root.querySelector('.sd-tts-model')?.value || t.model;
    t.extractApiProfileId = root.querySelector('.sd-tts-extract-api')?.value || '';
    saveSettings();
    toast('已保存', 'success');
  });

  // 滑块：实时回显 + 存
  const bindSlider = (sel, valSel, key, fmt) => {
    const el = root.querySelector(sel);
    const out = root.querySelector(valSel);
    if (!el) return;
    el.addEventListener('input', () => { if (out) out.textContent = fmt(el.value); });
    el.addEventListener('change', () => { t[key] = Number(el.value); saveSettings(); });
  };
  bindSlider('.sd-tts-speed', '.sd-tts-speed-val', 'defaultSpeed', (v) => Number(v).toFixed(2));
  bindSlider('.sd-tts-vol', '.sd-tts-vol-val', 'defaultVol', (v) => Number(v).toFixed(1));
  bindSlider('.sd-tts-pitch', '.sd-tts-pitch-val', 'defaultPitch', (v) => String(Math.round(v)));
  // T3 音效器三滑块（音高/强度/音色 -100..100）
  bindSlider('.sd-tts-vmpitch', '.sd-tts-vmpitch-val', 'vmPitch', (v) => String(Math.round(v)));
  bindSlider('.sd-tts-vmintensity', '.sd-tts-vmintensity-val', 'vmIntensity', (v) => String(Math.round(v)));
  bindSlider('.sd-tts-vmtimbre', '.sd-tts-vmtimbre-val', 'vmTimbre', (v) => String(Math.round(v)));
  // T3 语言增强 / 音效 下拉
  root.querySelector('.sd-tts-langboost')?.addEventListener('change', (e) => { t.languageBoost = e.target.value || ''; saveSettings(); });
  root.querySelector('.sd-tts-soundfx')?.addEventListener('change', (e) => { t.soundEffects = e.target.value || ''; saveSettings(); });
  root.querySelector('.sd-tts-soundfx-auto')?.addEventListener('change', (e) => { t.soundFxAuto = !!e.target.checked; saveSettings(); });

  // 提取·世界书（取材式）：扫描 / 折叠记忆 / 书级多选 / 点书名切查看 / 条目勾选
  root.querySelector('.sd-tts-extract-wb-scan')?.addEventListener('click', async (e) => {
    const btn = e.currentTarget;
    const icon = btn.querySelector('i');
    if (icon) icon.className = 'fa-solid fa-spinner fa-spin';
    btn.disabled = true;
    try { await refreshWorldBooks(false); } catch (_) {}
    // 已选书按需补拉条目（主线只拉主线选中的书）
    for (const n of ttsExtractWorldBooks()) { if (!Array.isArray(contextScanCache.worldBooks?.[n])) { try { await coreadEnsureWorldEntries(n); } catch (_) {} } }
    renderModal();
  });
  // 两个折叠栏（下拉「选择」/ 条目列）持久化开合
  root.querySelectorAll('.sd-tts-extract-wb-dropdown, .sd-tts-extract-wb-itemfold').forEach((d) => {
    d.addEventListener('toggle', () => {
      if (d.dataset.fold === 'wb') t.extractWbFoldOpen = d.open;
      else if (d.dataset.fold === 'items') t.extractItemsFoldOpen = d.open;
      saveSettings();
    });
  });
  // 书级多选：勾选即切到该书查看条目 + 按需补拉
  root.querySelectorAll('.sd-tts-extract-wb-toggle').forEach((cb) => {
    cb.addEventListener('change', async (e) => {
      const name = e.target.dataset.name;
      toggleTtsExtractWorldBook(name, !!e.target.checked);
      if (e.target.checked) { ttsExtractWorldView = name; if (!Array.isArray(contextScanCache.worldBooks?.[name])) { try { await coreadEnsureWorldEntries(name); } catch (_) {} } }
      renderModal();
    });
  });
  // 点书名：切到该书查看条目（不改选中态）+ 按需补拉
  root.querySelectorAll('.sd-tts-extract-wb-name').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const name = btn.dataset.name;
      ttsExtractWorldView = name;
      if (!Array.isArray(contextScanCache.worldBooks?.[name])) { try { await coreadEnsureWorldEntries(name); } catch (_) {} }
      renderModal();
    });
  });
  // 条目勾选：存 + 即时更新条目列标题「已选 N/M」计数（不整体重渲）
  root.querySelectorAll('.sd-tts-extract-wb-check').forEach((cb) => {
    cb.addEventListener('change', (e) => {
      setTtsExtractWorldItemSelected(e.target.dataset.book, e.target.dataset.id, !!e.target.checked);
      const fold = e.target.closest('.sd-tts-extract-wb-itemfold');
      const b = fold?.querySelector('summary b');
      if (b) {
        const checks = fold.querySelectorAll('.sd-tts-extract-wb-check');
        b.textContent = `已选 ${Array.from(checks).filter((c) => c.checked).length}/${checks.length}`;
      }
    });
  });

  // 角色映射：增 / 删 / 改（始终读写本聊天 store.ttsVoiceMap）
  root.querySelector('.sd-tts-add-voice')?.addEventListener('click', () => {
    const map = ttsActiveVoiceMap();
    map.push({ name: '', voiceId: '', speed: null, emotion: 'auto' });
    ttsSaveVoiceMap();
    renderModal();
  });
  root.querySelectorAll('.sd-tts-voice-row').forEach((rowEl) => {
    const idx = Number(rowEl.dataset.idx);
    const map = ttsActiveVoiceMap();
    rowEl.querySelector('.sd-tts-vname')?.addEventListener('change', (e) => {
      if (map[idx]) { map[idx].name = e.target.value.trim(); ttsSaveVoiceMap(); }
    });
    // 音色 ID：库非空时为下拉(.sd-tts-vid-sel)，库为空时为手填输入框(.sd-tts-vid)
    rowEl.querySelector('.sd-tts-vid-sel')?.addEventListener('change', (e) => {
      if (map[idx]) { map[idx].voiceId = e.target.value.trim(); ttsSaveVoiceMap(); }
    });
    rowEl.querySelector('.sd-tts-vid')?.addEventListener('change', (e) => {
      if (map[idx]) { map[idx].voiceId = e.target.value.trim(); ttsSaveVoiceMap(); }
    });
    rowEl.querySelector('.sd-tts-vdel')?.addEventListener('click', () => {
      map.splice(idx, 1);
      ttsSaveVoiceMap();
      renderModal();
    });
  });

  // 音色库：增（弹窗填名+ID+文件夹）/ 编辑 / 删 / 试听。条目按 data-id 寻址（文件夹分组后下标不连续）
  root.querySelector('.sd-tts-add-lib')?.addEventListener('click', async () => {
    const r = await promptVoiceLibEntry({ dialogTitle: '添加音色', name: '', voiceId: '', folder: '' });
    if (!r) return;
    if (!r.name || !r.voiceId) { toast('音色名与 ID 都要填。', 'warning'); return; }
    t.voiceLibrary = Array.isArray(t.voiceLibrary) ? t.voiceLibrary : [];
    t.voiceLibrary.push({ id: uid('vlib'), name: r.name, voiceId: r.voiceId, folder: r.folder || '' });
    saveSettings();
    renderModal();
  });
  root.querySelectorAll('.sd-tts-lib-test').forEach((btn) => btn.addEventListener('click', async (e) => {
    const cur = (t.voiceLibrary || []).find((v) => v.id === btn.dataset.id);
    const text = (root.querySelector('.sd-tts-test-text')?.value || '').trim();
    await ttsPreviewVoice(cur?.voiceId || '', text, e.currentTarget);
  }));
  root.querySelectorAll('.sd-tts-lib-edit').forEach((btn) => btn.addEventListener('click', async () => {
    const cur = (t.voiceLibrary || []).find((v) => v.id === btn.dataset.id);
    if (!cur) return;
    const r = await promptVoiceLibEntry({ dialogTitle: '编辑音色', name: cur.name, voiceId: cur.voiceId, folder: cur.folder || '', withFx: true, fx: ttsVoiceFx(cur.voiceId) });
    if (!r) return;
    if (!r.name || !r.voiceId) { toast('音色名与 ID 都要填。', 'warning'); return; }
    const oldVid = cur.voiceId;
    cur.name = r.name; cur.voiceId = r.voiceId; cur.folder = r.folder || '';
    ttsSaveVoiceFx(oldVid, r.voiceId, r.fx);   // 存 per-voice 音效器（voiceId 变则迁移·全默认则清除）
    saveSettings();
    renderModal();
  }));
  root.querySelectorAll('.sd-tts-lib-del').forEach((btn) => btn.addEventListener('click', () => {
    const i = (t.voiceLibrary || []).findIndex((v) => v.id === btn.dataset.id);
    if (i < 0) return;
    t.voiceLibrary.splice(i, 1);
    saveSettings();
    renderModal();
  }));

  // NPC 原型音色：开关 / 增（弹窗填原型名+ID+文件夹）/ 编辑 / 删 / 试听 / 忘记本聊天分配（与音色库同构，按 data-id 寻址）
  root.querySelector('.sd-tts-npc-enabled')?.addEventListener('change', (e) => {
    t.npcEnabled = !!e.target.checked;
    saveSettings();
  });
  root.querySelector('.sd-tts-add-npc')?.addEventListener('click', async () => {
    const r = await promptVoiceLibEntry({ dialogTitle: '添加原型', name: '', voiceId: '', folder: '', keywords: '', nameLabel: '原型名', namePlaceholder: '如 严肃老年男', withKeywords: true });
    if (!r) return;
    if (!r.name || !r.voiceId) { toast('原型名与 ID 都要填。', 'warning'); return; }
    t.npcArchetypes = Array.isArray(t.npcArchetypes) ? t.npcArchetypes : [];
    t.npcArchetypes.push({ id: uid('npc'), label: r.name, voiceId: r.voiceId, folder: r.folder || '', keywords: r.keywords || '' });
    saveSettings();
    renderModal();
  });
  root.querySelectorAll('.sd-tts-narch-test').forEach((btn) => btn.addEventListener('click', async (e) => {
    const cur = (t.npcArchetypes || []).find((a) => a.id === btn.dataset.id);
    const text = (root.querySelector('.sd-tts-test-text')?.value || '').trim();
    await ttsPreviewVoice(cur?.voiceId || '', text, e.currentTarget);
  }));
  root.querySelectorAll('.sd-tts-narch-edit').forEach((btn) => btn.addEventListener('click', async () => {
    const cur = (t.npcArchetypes || []).find((a) => a.id === btn.dataset.id);
    if (!cur) return;
    // 注意：改名只动 label，不动 id；已记忆的「说话人→原型」按 id 绑定，故改名 / 改 ID / 改关键词都不会丢失已分配的 NPC 音色匹配
    const r = await promptVoiceLibEntry({ dialogTitle: '编辑原型', name: cur.label, voiceId: cur.voiceId, folder: cur.folder || '', keywords: cur.keywords || '', nameLabel: '原型名', namePlaceholder: '如 严肃老年男', withKeywords: true });
    if (!r) return;
    if (!r.name || !r.voiceId) { toast('原型名与 ID 都要填。', 'warning'); return; }
    cur.label = r.name; cur.voiceId = r.voiceId; cur.folder = r.folder || ''; cur.keywords = r.keywords || '';
    saveSettings();
    renderModal();
  }));
  root.querySelectorAll('.sd-tts-narch-del').forEach((btn) => btn.addEventListener('click', () => {
    const i = (t.npcArchetypes || []).findIndex((a) => a.id === btn.dataset.id);
    if (i < 0) return;
    t.npcArchetypes.splice(i, 1);
    saveSettings();
    renderModal();
  }));
  root.querySelector('.sd-tts-npc-forget')?.addEventListener('click', async () => {
    const key = getChatKey();
    const has = t.npcAssignByChat && t.npcAssignByChat[key] && Object.keys(t.npcAssignByChat[key]).length;
    if (!has) { toast('本聊天还没有 NPC 分配记忆。', 'info'); return; }
    const yes = await confirmDialog('忘记本聊天分配', '将清空本聊天已记忆的「NPC→原型」分配，下次提取会重新归类。确认？');
    if (!yes) return;
    delete t.npcAssignByChat[key];
    saveSettings();
    toast('已清空本聊天 NPC 分配记忆。', 'success');
  });

  // 标签规则：增 / 删 / 改 + 剥 HTML 开关
  root.querySelector('.sd-tts-add-tag')?.addEventListener('click', () => {
    t.tagRules = Array.isArray(t.tagRules) ? t.tagRules : [];
    t.tagRules.push({ name: '', action: 'remove' });
    saveSettings();
    renderModal();
  });
  root.querySelectorAll('.sd-tts-tag-row').forEach((rowEl) => {
    const idx = Number(rowEl.dataset.idx);
    t.tagRules = Array.isArray(t.tagRules) ? t.tagRules : [];
    rowEl.querySelector('.sd-tts-tag-name')?.addEventListener('change', (e) => {
      if (!t.tagRules[idx]) t.tagRules[idx] = { name: '', action: 'remove' };
      t.tagRules[idx].name = e.target.value.trim().replace(/^<|>$/g, '');
      saveSettings();
    });
    rowEl.querySelector('.sd-tts-tag-action')?.addEventListener('change', (e) => {
      if (!t.tagRules[idx]) t.tagRules[idx] = { name: '', action: 'remove' };
      t.tagRules[idx].action = e.target.value === 'extract' ? 'extract' : 'remove';
      saveSettings();
    });
    rowEl.querySelector('.sd-tts-tag-del')?.addEventListener('click', () => {
      t.tagRules.splice(idx, 1);
      saveSettings();
      renderModal();
    });
  });
  root.querySelector('.sd-tts-strip-html')?.addEventListener('change', (e) => {
    t.stripHtml = !!e.target.checked;
    saveSettings();
  });

  // 发音词典：添加 / 编辑 / 删除
  root.querySelector('.sd-tts-add-prondict')?.addEventListener('click', () => {
    t.pronunciationDict = Array.isArray(t.pronunciationDict) ? t.pronunciationDict : [];
    t.pronunciationDict.push({ from: '', to: '' });
    saveSettings();
    renderModal();
  });
  root.querySelectorAll('.sd-tts-prondict-row').forEach((rowEl) => {
    const idx = Number(rowEl.dataset.idx);
    t.pronunciationDict = Array.isArray(t.pronunciationDict) ? t.pronunciationDict : [];
    rowEl.querySelector('.sd-tts-prondict-from')?.addEventListener('change', (e) => {
      if (!t.pronunciationDict[idx]) t.pronunciationDict[idx] = { from: '', to: '' };
      t.pronunciationDict[idx].from = e.target.value.trim();
      saveSettings();
    });
    rowEl.querySelector('.sd-tts-prondict-to')?.addEventListener('change', (e) => {
      if (!t.pronunciationDict[idx]) t.pronunciationDict[idx] = { from: '', to: '' };
      t.pronunciationDict[idx].to = e.target.value.trim();
      saveSettings();
    });
    rowEl.querySelector('.sd-tts-prondict-del')?.addEventListener('click', () => {
      t.pronunciationDict.splice(idx, 1);
      saveSettings();
      renderModal();
    });
  });

  // 台词提取提示词：保存 / 恢复默认 / 恢复上次 / 保存到方案库
  root.querySelector('.sd-tts-save-prompt')?.addEventListener('click', () => {
    const val = root.querySelector('.sd-tts-extract-prompt')?.value ?? '';
    t.extractPrompt = String(val).trim() === TTS_EXTRACT_SYSTEM.trim() ? '' : val;   // 与默认相同则存空=跟随默认
    saveSettings();
    toast('台词提取提示词已保存。', 'success');
  });
  root.querySelector('.sd-tts-reset-prompt')?.addEventListener('click', async () => {
    const yes = await confirmDialog('恢复默认提示词', '将台词提取提示词恢复为内置默认？当前内容会被覆盖（覆盖前自动备份，可「恢复上次」找回）。');
    if (!yes) return;
    const cur = (root.querySelector('.sd-tts-extract-prompt')?.value ?? '').trim();
    if (cur && cur !== TTS_EXTRACT_SYSTEM.trim()) t.extractPromptBackup = cur;
    t.extractPrompt = '';
    saveSettings();
    renderModal();
    toast('已恢复默认提示词。', 'success');
  });
  root.querySelector('.sd-tts-restore-prompt')?.addEventListener('click', async () => {
    if (!t.extractPromptBackup) { toast('没有可恢复的上一份提示词。', 'info'); return; }
    const yes = await confirmDialog('恢复上次提示词', '将台词提取提示词替换为上一次使用的那一份？当前内容会被覆盖。');
    if (!yes) return;
    t.extractPrompt = t.extractPromptBackup;
    t.extractPromptBackup = null;
    saveSettings();
    renderModal();
    toast('已恢复上一份提示词。', 'success');
  });
  root.querySelector('.sd-tts-save-scheme')?.addEventListener('click', async () => {
    const val = (root.querySelector('.sd-tts-extract-prompt')?.value ?? '').trim();
    if (!val) { toast('提示词为空，无法保存为方案。', 'warning'); return; }
    const name = await promptInput('保存台词指导方案', '方案名称：', '');
    if (!name) return;
    t.guidanceSchemes = Array.isArray(t.guidanceSchemes) ? t.guidanceSchemes : [];
    const existing = t.guidanceSchemes.find((x) => x.name === name);
    const scheme = { id: existing?.id || uid('ttssch'), name, folder: existing?.folder || '', content: val, createdAt: existing?.createdAt || new Date().toISOString() };
    t.guidanceSchemes = existing ? t.guidanceSchemes.map((x) => x.id === existing.id ? scheme : x) : [...t.guidanceSchemes, scheme];
    saveSettings();
    renderModal();
    toast('已保存到方案库。', 'success');
  });

  // 台词指导方案库：复用通用库（载入=写入提示词框，编辑=行内编辑，删除）
  bindLibraryEvents(root, ttsSchemeLibraryCfg, {
    onLoad: (id) => {
      const sch = (t.guidanceSchemes || []).find((x) => x.id === id);
      if (!sch) return;
      const cur = (root.querySelector('.sd-tts-extract-prompt')?.value ?? '').trim();
      if (cur && cur !== TTS_EXTRACT_SYSTEM.trim()) t.extractPromptBackup = cur;   // 覆盖前备份
      t.extractPrompt = sch.content || '';
      saveSettings();
      renderModal();
      toast(`已载入方案「${sch.name}」。`, 'success');
    },
    onEdit: (id) => {
      const sch = (t.guidanceSchemes || []).find((x) => x.id === id);
      if (!sch) return;
      openTextEditor({
        target: `ttsscheme:${id}`,
        title: `编辑方案 · ${sch.name}`,
        value: sch.content || '',
        placeholder: '台词提取提示词内容',
      });
    },
    onDelete: async (id) => {
      const sch = (t.guidanceSchemes || []).find((x) => x.id === id);
      if (!sch) return;
      const yes = await confirmDialog('删除方案', `确认删除方案「${sch.name}」？`);
      if (!yes) return;
      t.guidanceSchemes = (t.guidanceSchemes || []).filter((x) => x.id !== id);
      saveSettings();
      renderModal();
    },
  });

  // 收藏夹：进入有声页即自动加载（无需手点刷新），刷新钮保留作手动重载
  root.querySelector('.sd-tts-fav-refresh')?.addEventListener('click', () => ttsRefreshFavorites(root));
  if (root.querySelector('.sd-tts-fav-list')) ttsRefreshFavorites(root);

  // 清空缓存
  root.querySelector('.sd-tts-cache-clear')?.addEventListener('click', async () => {
    if (!blobStore.blobStoreAvailable()) { toast('当前环境不支持本地缓存。', 'warning'); return; }
    const yes = await confirmDialog('清空音频缓存', '将删除所有已缓存的合成语音（收藏的不受影响）。确认清空？');
    if (!yes) return;
    try { await blobStore.clearAudioCache(); toast('音频缓存已清空。', 'success'); }
    catch (err) { toast(`清空失败：${err?.message || err}`, 'error'); }
  });
  root.querySelector('.sd-tts-cache-export')?.addEventListener('click', (e) => ttsExportAudioCache(e.currentTarget));
  root.querySelector('.sd-tts-cache-import')?.addEventListener('change', (e) => ttsImportAudioCache(e));
}

// 当前聊天显示名：优先角色名 / 群名，回退 chatId；用于导出文件名
function ttsChatDisplayName() {
  const c = ctx();
  const name = c.name2 || c.groupId && (c.groups || []).find?.((g) => g.id === c.groupId)?.name || c.characterId != null && c.characters?.[c.characterId]?.name || c.chatId || '聊天';
  return String(name || '聊天').replace(/[\\/:*?"<>|\n\r\t]+/g, '_').slice(0, 32) || '聊天';
}

// 导出音频缓存：把 IndexedDB 里全部音频 blob 转 base64 打包成 JSON 下载（文件名=聊天名+时间戳）。
// 用于跨端迁移（音频缓存是浏览器本地 IndexedDB，不随聊天元数据同步）。
async function ttsExportAudioCache(btn) {
  if (!blobStore.blobStoreAvailable()) { toast('当前环境不支持本地缓存。', 'warning'); return; }
  const icon = btn?.querySelector('i');
  const prev = icon?.className;
  if (icon) icon.className = 'fa-solid fa-spinner fa-spin';
  if (btn) btn.disabled = true;
  try {
    const list = await blobStore.listAudio();
    if (!list.length) { toast('音频缓存为空，没有可导出的内容。', 'info'); return; }
    const blobToB64 = (blob) => new Promise((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(String(r.result || '').split(',')[1] || '');   // 去掉 data:...;base64, 前缀
      r.onerror = () => reject(r.error);
      r.readAsDataURL(blob);
    });
    const entries = [];
    for (const e of list) {
      entries.push({ key: e.key, meta: e.meta || {}, createdAt: e.createdAt || 0, type: e.blob?.type || 'audio/mpeg', data: await blobToB64(e.blob) });
    }
    const payload = { version: 1, type: 'qianmu-tts-audio-cache', exportedAt: new Date().toISOString(), count: entries.length, entries };
    const blob = new Blob([JSON.stringify(payload)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `qianmu-语音缓存-${ttsChatDisplayName()}-${fileStamp()}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    toast(`已导出 ${entries.length} 条音频缓存。`, 'success');
  } catch (err) {
    toast(`导出失败：${err?.message || err}`, 'error');
  } finally {
    if (icon && prev) icon.className = prev;
    if (btn) btn.disabled = false;
  }
}

// 导入音频缓存：读 JSON、base64 还原成 blob，批量写入 IndexedDB（已存在的 key 跳过，不覆盖本地新生成的）。
async function ttsImportAudioCache(event) {
  const file = event.target.files?.[0];
  if (!file) return;
  event.target.value = '';
  if (!blobStore.blobStoreAvailable()) { toast('当前环境不支持本地缓存。', 'warning'); return; }
  let data;
  try {
    data = JSON.parse(await file.text());
    if (data?.type !== 'qianmu-tts-audio-cache' || !Array.isArray(data.entries)) throw new Error('格式不符');
  } catch (_) {
    return toast('导入失败：不是有效的千幕语音缓存文件。', 'error');
  }
  try {
    const b64ToBlob = (b64, type) => {
      const bin = atob(b64 || '');
      const len = bin.length;
      const bytes = new Uint8Array(len);
      for (let i = 0; i < len; i++) bytes[i] = bin.charCodeAt(i);
      return new Blob([bytes], { type: type || 'audio/mpeg' });
    };
    const entries = data.entries.map((e) => ({ key: e.key, meta: e.meta || {}, createdAt: e.createdAt || Date.now(), blob: e.data ? b64ToBlob(e.data, e.type) : null }));
    const { added, skipped } = await blobStore.bulkPutAudio(entries);
    toast(`导入完成：新增 ${added} 条${skipped ? `，跳过 ${skipped} 条（已存在或无效）` : ''}。`, 'success');
  } catch (err) {
    toast(`导入失败：${err?.message || err}`, 'error');
  }
}

// 试听某音色：用统一试听台词 + 当前默认参数合成播放（不进缓存，纯预览）
async function ttsPreviewVoice(voiceId, text, btn) {
  const t = settings.tts || {};
  if (!t.apiKey) { toast('请先填写 MiniMax API Key。', 'warning'); return; }
  if (!voiceId) { toast('该行还没填音色 ID。', 'warning'); return; }
  if (!text) { toast('请先在上方填写试听台词。', 'warning'); return; }
  const icon = btn?.querySelector('i');
  const prev = icon?.className;
  if (icon) icon.className = 'fa-solid fa-spinner fa-spin';
  if (btn) btn.disabled = true;
  try {
    const vfx = ttsVoiceFx(voiceId);   // per-voice 音效器覆盖（试听须与正文合成一致）
    const { blob } = await ttsSynthesize({
      apiKey: t.apiKey, text, voiceId, model: t.model,
      speed: Number(t.defaultSpeed ?? 1), vol: Number(t.defaultVol ?? 1), pitch: Number(t.defaultPitch ?? 0),
      format: t.format || 'mp3', endpoint: t.endpoint, proxyBase: t.proxyBase, groupId: t.groupId,
      pronunciationTone: ttsPronunciationTone(),
      languageBoost: t.languageBoost || '',
      vmPitch: Number.isFinite(vfx?.vmPitch) ? vfx.vmPitch : Number(t.vmPitch ?? 0),
      vmIntensity: Number.isFinite(vfx?.vmIntensity) ? vfx.vmIntensity : Number(t.vmIntensity ?? 0),
      vmTimbre: Number.isFinite(vfx?.vmTimbre) ? vfx.vmTimbre : Number(t.vmTimbre ?? 0),
      soundEffects: (vfx && vfx.soundEffects) ? vfx.soundEffects : (t.soundEffects || ''),
    });
    const url = URL.createObjectURL(blob);
    const audio = new Audio(url);
    audio.addEventListener('ended', () => URL.revokeObjectURL(url), { once: true });
    await audio.play();
  } catch (err) {
    toast(`试听失败：${err?.message || err}`, 'error');
  } finally {
    if (btn) btn.disabled = false;
    if (icon && prev) icon.className = prev;
  }
}

// 收藏夹：从 IndexedDB 列出已收藏语音，渲染重听/删除
async function ttsRefreshFavorites(root) {
  const box = root.querySelector('.sd-tts-fav-list');
  if (!box) return;
  if (!blobStore.blobStoreAvailable()) { box.innerHTML = '<p class="sd-muted sd-hint-sm">当前环境不支持本地收藏。</p>'; return; }
  box.innerHTML = '<p class="sd-muted sd-hint-sm"><i class="fa-solid fa-spinner fa-spin"></i> 加载中…</p>';
  let favs = [];
  try { favs = await blobStore.listFavorites(); }
  catch (_) { box.innerHTML = '<p class="sd-muted sd-hint-sm sd-tts-err">读取收藏失败。</p>'; return; }
  if (!favs.length) { box.innerHTML = '<p class="sd-muted sd-hint-sm">还没有收藏的语音。双击正文台词的小喇叭，在快捷窗里点收藏。</p>'; return; }
  box.innerHTML = favs.map((f) => {
    const spk = htmlEscape(f.meta?.speaker || '');
    const txt = htmlEscape(f.label || f.meta?.text || '');
    return `<div class="sd-tts-fav-row" data-id="${htmlEscape(f.id)}">
      <button type="button" class="sd-tts-play sd-tts-fav-play" title="重听"><i class="fa-solid fa-volume-high"></i></button>
      ${spk ? `<span class="sd-tts-spk">${spk}</span>` : ''}
      <span class="sd-tts-txt">${txt}</span>
      <button type="button" class="sd-icon-btn sd-icon-sm sd-danger sd-tts-fav-del" title="删除收藏"><i class="fa-solid fa-trash-can"></i></button>
    </div>`;
  }).join('');
  box.querySelectorAll('.sd-tts-fav-row').forEach((rowEl) => {
    const id = rowEl.dataset.id;
    rowEl.querySelector('.sd-tts-fav-play')?.addEventListener('click', async () => {
      try {
        const fav = await blobStore.getFavorite(id);
        if (fav?.blob) await ttsPlayBlob(fav.blob, rowEl);
      } catch (err) { toast(`播放失败：${err?.message || err}`, 'error'); }
    });
    rowEl.querySelector('.sd-tts-fav-del')?.addEventListener('click', async () => {
      const yes = await confirmDialog('删除收藏', '确认从收藏夹删除这条语音？');
      if (!yes) return;
      try { await blobStore.removeFavorite(id); ttsRefreshFavorites(root); }
      catch (err) { toast(`删除失败：${err?.message || err}`, 'error'); }
    });
  });
}

/* ============================================================
   有声小剧场 · 台词提取（阶段 3）
   复用千幕现有 API 链路（主 API 或指定 API 预设），用专用提示词把正文里
   「被引号包裹但确实是台词」的部分抽出来，附带说话人与情绪。
   非台词引号（书名、强调、心理活动、术语等）一律剔除。
   ============================================================ */

// 提取系统提示词：约束模型只产出严格 JSON，且只保留真台词。
const TTS_EXTRACT_SYSTEM = `你是有声剧配音指导导演，需从小说正文中按台词出场顺序，提取角色真实发声的对话并完成配音前置标注，最终仅输出纯JSON格式结果。

### 顶层规则（优先级高于所有标注细则，全程强制执行）
#### 1. 音色连贯优先
同一说话人同一段内容的声线、情绪基调须保持连续稳定，贴合真人连贯表达的自然状态。仅当正文出现**明确且强烈的情绪/戏剧转折信号**时，方可切换情绪标注；纯叙事动作描写（如行走、转身、放置物品等）不属于情绪转折依据，遇到时须延续上一句的基调，不得无故调整语气明暗。

#### 2. auto 的定位：让权给声学模型
语音合成模型有声学层面的自然韵律判断，在它能感知上下文时通常比逐句人工标注更稳，故情绪项默认 \`auto\`、语速项默认省略。但默认值以「认真研判后无信号」为前提。该做的语境研判（见下节）必须逐句做到位，有信号就标、无信号才 auto。日常对话、平铺叙事、表意模糊的语句用默认值；有明确情绪线索的句子给出对应标注。

#### 3. 核心任务优先级
标注的核心价值是「准确识别说话人、精准提取纯台词文本」；情绪与语速为辅助补充项，判定存疑时回落默认值。

---

### 语境研判规则（内部判断依据，不输出至最终结果）
标注前**必须**先判定单句所处的语境类型，据此控制干预力度：上下文越充分、越放手给声学模型；语境越孤立、越需要你主动补一档温和标注为它托底。这是三档不同的处理策略，请认真区分、不要三档都当成 auto。

#### A类｜连贯对话场景
- 场景特征：本句与前后台词紧密衔接，对话上下文充分（如连续多段对白、多轮往来互动）。
- 标注策略：干预力度最低。声学模型此处有充足上下文，情绪项几乎全部 \`auto\`，仅在整段对话出现明确情绪拐点时标注一次具体值。

#### B类｜孤立单句场景
- 场景特征：本句前后多为叙事动作描写，单句独立成段，缺乏对话上下文支撑（如动作场景中的零散喊话）。
- 标注策略：此处声学模型缺上下文、纯 auto 易显平淡，你应当主动补一档温和情绪为它托底。结合句面含义与人设，给一个贴合人设的平缓情绪值（如 \`calm / fluent / happy\`）。这是 B 类的职责所在，遇到时须补足，避免因求稳而退回 auto。唯一限制：情绪须平缓，不给 \`angry / fearful\` 等激烈值（孤立单句配激烈情绪易显突兀）。

#### C类｜亲密场景
- 标注策略：按声线状态（主导方/承受方）执行第六节的专项细化规则。

---

### 判定纪律（硬性约束）
1. 语境分类仅用于调整标注干预强度：A 类放手 auto、B 类主动托底、C 类专项细化，三档区别对待，避免混为一谈全填 auto。
2. 语境类型为内部判断维度，禁止输出至最终 JSON，输出字段仅保留 \`speaker / text / emotion\`（可选 \`speed\`）。
3. B 类补充的情绪必须贴合人设且强度平缓，不使用激烈情绪值。

{{QM_CONTEXT}}

### 一、有效台词判定
有效台词＝角色在正文当下开口说出的话语，须被引号（「」『』“”、英文双引号""）包裹。无引号内容一律不计入。

以下四类引号内容全部排除：
1. 非口语类标识：书籍/作品名、起强调作用的词语、专有名词、独立成句的拟声词。
2. 未出声内容：心理活动、内心默念、暗自思忖等未开口的表述。
3. 转述式引用（重点规避）：引号内容在句中充当名词性成分，是被叙事者转述、回忆、指代的话语片段，无角色当下的发声动作引导。
   > 反例：那句「保重」散在了风里。
   > 反例：他脑子里反复回响着她临走说的“别等我”。
   > 反例：三个字“对不起”堵在喉咙里始终没说出口。
4. 旁白叙述、动作神态描写中的引语化表述。

判定要领：区分「独立话语」与「转述引用」看引号在句中的语法角色。引号自成一句、是角色当下说出的完整话语，即为有效台词（哪怕没有"说/道"这类引导词，对白往复中的无归属短句同样算）；引号在更大句子里充当主语/宾语等名词成分、被叙事者转述或指代（第3类反例那样），则排除。全文无有效台词时返回 \`{"lines": []}\`。

> 正例：林砚放下茶杯，缓声道：“此事不必再议。” → 提取：此事不必再议。
> 反例：他攥紧掌心，暗自咬牙「绝不能就此认输」。 → 内心活动，不提取。

### 二、说话人（speaker）判定
**核心铁则**：说话人仅由「台词外部的归属描述」判定；台词内容里的“我/你/他”只是角色正常口语措辞，**绝对不参与说话人判定**。

判定优先级从高到低：
1. **显式归属优先**：台词紧邻处有明确姓名/身份提示（如「XX说」「XX冷笑道」），直接取对应角色名。
   > 易错示例：张三皱眉道：“我不会同意的。” → speaker=张三
   > 提醒：台词内的“我”是张三的自称，不能据此混淆说话人；说话人永远以台词外的归属描述为准。
2. **人设还原次之**：仅当台词外的说话人以人称代词/泛称（我、你、老先生等）表述时，结合【角色定位】人设将其还原为角色本名（第一人称“我”通常是叙事主体角色、第二人称“你”通常是对话另一方）；禁止直接填写「我」「你」。
   > 示例：我转过身道：“走吧。” + 【角色定位】指明叙事主体为沈清 → speaker=沈清
3. 无法明确判定时填「未知」，严禁将旁白叙事者标注为说话人。

### 三、台词文本（text）
完整保留角色原话与语气助词（嗯、哼、哈哈等），移除包裹的引号符号，剔除台词外的动作、神态补充描写。
**连续话语合并**：当**同一说话人**的多段引号台词，中间**仅被动作/神态描写隔开**、语义上属于一口气说完的连贯话语时，应合并为**同一条** line（拼接各段台词原文、剔除中间的动作描写）；这样语音合成更流畅、情绪更连贯。
> 示例：他握住她的手，「别怕，」目光温柔，「有我在。」 → 合并为一条 → text="别怕，有我在。"（同一说话人、中间只是动作神态）
> 反例：不同说话人的对话往复、或中间插入了他人台词，**不得**合并。

**停顿标记（仅用于合并句的拼接处，其余一律不加）**：合并多段台词时，两段之间原本被略去了动作/停顿，直接拼接会贴得太紧、缺气口。故**仅在合并处**按被略去内容的"轻重"插入一个停顿标记 \`<#秒数#>\`，还原真人念白的换气：
- 纯语气停顿（迟疑、咂摸、顿了顿、欲言又止）→ \`<#0.2#>\`
- 短促动作（转身、放下杯子、递过东西等一两秒的小动作）→ \`<#0.4#>\`
- 明确的动作段或情绪转折（长叹、走到窗边、沉默良久等）→ \`<#0.7#>\`

强约束（务必遵守，宁缺毋滥）：
1. **只在合并句内部的两段拼接处**加标记；**未合并的单句台词内部绝对不加**，句首句尾也不加。
2. 一个拼接处最多一个标记；拿不准轻重时**一律省略**，不加胜过加错。
3. 标记格式严格为 \`<#数字#>\`，数字只取 0.2 / 0.4 / 0.7 三档之一，不得自造其他数值或格式。
> 示例：他握住她的手，「别怕，」他顿了顿，目光温柔，「有我在。」 → text="别怕，<#0.4#>有我在。"（中间是"顿了顿+看她"的短动作，插 0.4 秒气口）

### 四、情绪（emotion）标注
可选值固定为：\`happy, sad, angry, fearful, disgusted, surprised, calm, fluent, whisper, auto\`

标注前**先按上文语境研判定档**（A/B/C），再据下列细则落值：
1. **A 类放手 auto**：连贯对话有充足上下文，情绪几乎全填 auto，仅整段明确情绪拐点标一次。
2. **B 类主动托底**：孤立单句应给一档**贴人设的平缓情绪**（calm/fluent/happy 等）为声学模型托底，不要退回 auto；但不给 angry/fearful 等激烈值。
3. **强信号从其信号**：无论哪档，正文明写怒吼/嘶喊/失声痛哭/颤抖惊惧/压低耳语等清晰强信号时，直接标对应的具体情绪（此时可用激烈值）。
4. **贴合人设**：标具体情绪时，强度与表达须符合角色定位，避免脱离人设的 OOC 标注。
5. **连贯抗跳变**：同一角色相邻台词情绪保持连续，绝不因一句纯叙事动作就切换（见顶层规则1）。
   > 错误示范：同角色相邻两句无任何剧情转折，前句标 happy、后句突然标 surprised
6. 仅当语境模糊、既无对话上下文也无任何情绪线索、且不属 B 类需托底的情形时，才回落 auto。auto 的定位是让权给声学模型（见顶层规则2）。

### 五、语速（speed，可选）
**默认一律省略**（等同 1.0，最泛用稳定，且语速效果与音色强绑定）。仅当某句有**明确强节奏信号**时才给值，否则不要填。
纪律（务必遵守，超范围的极端语速留给用户手动单条调）：
- 绝大多数句子省略该字段；确需调整时**只在 0.90 ~ 1.35 之间**微调，**严禁低于 0.90、严禁高于 1.35**。
- 明显情绪激动/紧张/急促/娇喘等 → 略快，约 1.1 ~ 1.2；明显沉稳/庄重/迟缓/低语 → 略慢，约 0.90 ~ 0.95。存疑不填。

### 六、亲密场景细化（仅当正文为亲密/情欲场景时适用，其余场景忽略本节）
此类场景中，语速与情绪按角色在互动中的**声线状态**细腻贴合（以互动中的声线表现为准，与角色平日身份高低无关），结合性别表现（仍服从顶层规则2，无明确声线信号时回落 auto / 省略语速）：
- **承受方**（气息紊乱、语句破碎、被动回应者）：声线起伏大，语速通常略快更显生动（约 1.15 ~ 1.3），情绪多为 fearful/surprised/whisper/auto 随情境流动；女性此类声线尤常见气声、颤音，适度偏快。
- **主导方**（掌控节奏、主动引导者）：声线克制，语速偏常态或略慢（约 0.90 ~ 1.05），情绪多为 calm/fluent/低沉，即便情动也相对收敛。
- 结合角色性别与人设定位判断，避免把承受方判得过于平稳、把主导方判得过于慌乱；语速仍严守第五节的 0.90 ~ 1.35 上下限。

### 输出规范
仅输出纯JSON结构，不得添加任何解释文字、代码块标记、额外备注。
标准格式示例：
\`{"lines": [{"speaker": "角色名", "text": "台词原话", "emotion": "auto"}]}\`（emotion 默认 auto、speed 默认省略）`;

// 提取用 API 配置：优先 settings.tts.extractApiProfileId 指定的预设，否则用主 API（返回 null 表示走主 API/ST）
function ttsExtractApiConfig() {
  const id = settings.tts?.extractApiProfileId || '';
  if (!id) return null;
  const profile = (settings.apiProfiles || []).find((p) => p.id === id);
  if (profile) return { apiUrl: profile.apiUrl, apiKey: profile.apiKey, model: profile.model, temperature: profile.temperature };
  return null;
}

// 调用模型做提取：与幕外同样的分发逻辑（cfg 存在或 external 走直连，否则走 ST generateRaw）。
// 不走流式（提取要完整 JSON），独立 AbortController，避免干扰推演/幕外。
async function callTtsExtractModel(systemPrompt, userPrompt, cfg) {
  const useExternal = settings.providerMode === 'external' || cfg;
  if (useExternal) {
    const eff = cfg || { apiUrl: settings.apiUrl, apiKey: settings.apiKey, model: settings.model };
    if (!(normalizeUrl(eff.apiUrl) && eff.apiKey && eff.model)) throw new Error('INVALID_API_SETTINGS');
    const messages = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ];
    return await callExternalApi(messages, null, cfg, new AbortController());
  }
  if (!getGenerateRaw()) throw new Error('INVALID_API_SETTINGS');
  return await callSillyTavernModel(userPrompt, systemPrompt, null);
}

// TTS 专用标签清洗：提取台词前先剔除状态栏/思维链/HTML 等非台词噪音（省 token、提精度）。
// 用 settings.tts.tagRules（与「取材」的规则独立）；extract 规则一旦存在则只保留其内容，否则按 remove 删除各标签段。
// stripHtml 开则最后剥裸 HTML 标签。注释 <!-- --> 一律去除。
// 用 ST 自己的正则引擎把文本处理成与显示层一致（治本·自动兼容用户所有正则）。
// 能力探测 + 优雅回落：不同 ST 版本此 API 可能不存在或签名不同 → 任何异常/非串返回都回落原文，绝不炸。
// placement=2（AI 输出层，与 horae/柏宝书 那类隐藏正则的 placement 对齐）；不同版本枚举差异不影响回落安全。
function ttsApplyStRegex(text) {
  const raw = String(text || '');
  try {
    const context = ctx();
    const fn = (typeof context?.getRegexedString === 'function')
      ? context.getRegexedString
      : (typeof globalThis.getRegexedString === 'function' ? globalThis.getRegexedString : null);
    if (!fn) return raw;
    // 签名跨版本差异：多数为 (rawString, placement, options?)。placement 用数值 2（AI 输出）。
    const out = fn(raw, 2, { isPrompt: false });
    return (typeof out === 'string' && out.length) ? out : raw;   // 非串/空 → 回落原文（避免误删成空）
  } catch (_) {
    return raw;   // API 缺失/签名不符/抛错 → 回落原文，交下面的内置清单兜底
  }
}

// 剥离台词里的停顿标记 <#秒#>（如 <#0.3#>）：合成时保留给 MiniMax，但列表显示 / 内联图标定位匹配前须去掉
// （否则标记混进文本会破坏定位、界面也难看）。仅去标记本身、不动其余文字。
function ttsStripPauseMarks(text) {
  return String(text || '').replace(/<#\s*\d+(?:\.\d+)?\s*#>/g, '');
}

function ttsCleanText(text) {
  let value = String(text || '');
  // 治本优先：调 ST 自己的正则引擎 getRegexedString，把原始消息处理成「与显示层逐字一致」的文本，
  // 从源头消除「原文有、显示无」的幻影台词（用户装什么隐藏正则/新插件都自动兼容，无需我们维护标签清单）。
  // 能力探测 + 优雅回落：不同 ST 版本可能没有此 API 或签名不同，故 try/catch，失败则走下面的内置标签清单（治标保命）。
  value = ttsApplyStRegex(value);
  value = value.replace(/<!--[\s\S]*?-->/g, '');
  // 内置状态/记忆块清理（回落兜底）：horae/柏宝书 等插件用「markdownOnly 正则」只从显示正文删掉这些块、却不动原始消息。
  // getRegexedString 可用时这些块已被 ST 删过、此处多为空转；不可用时这里兜底。整块删（标签+内容），使提取所见与显示对齐。
  const BUILTIN_STRIP_TAGS = ['horae', 'horaeevent', 'horaerpg', 'horaetable', 'bbs_start', 'bbs_end', 'bbs_items', 'statusblock', 'statusbar', 'mvu'];
  for (const tag of BUILTIN_STRIP_TAGS) {
    // 成对块（含冒号变体如 <horaetable：…>）：整块删
    value = value.replace(new RegExp(`<${tag}\\b[^>]*>[\\s\\S]*?<\\/${tag}[^>]*>`, 'gi'), '');
    // 残留的单个开/闭标签兜底删
    value = value.replace(new RegExp(`<\\/?${tag}\\b[^>]*>`, 'gi'), '');
  }
  const t = settings.tts || {};
  const rules = (Array.isArray(t.tagRules) ? t.tagRules : [])
    .map((r) => ({ name: String(r.name || '').trim().replace(/^<|>$/g, ''), action: r.action === 'extract' ? 'extract' : 'remove' }))
    .filter((r) => r.name);
  const extractRules = rules.filter((r) => r.action === 'extract');
  if (extractRules.length) {
    const extracted = [];
    for (const rule of extractRules) {
      const reg = new RegExp(`<${escapeRegExp(rule.name)}\\b[^>]*>([\\s\\S]*?)<\\/${escapeRegExp(rule.name)}>`, 'gi');
      let m;
      while ((m = reg.exec(value)) !== null) extracted.push(m[1].trim());
    }
    value = extracted.join('\n\n');
  } else {
    for (const rule of rules) {
      const reg = new RegExp(`<${escapeRegExp(rule.name)}\\b[^>]*>[\\s\\S]*?<\\/${escapeRegExp(rule.name)}>`, 'gi');
      value = value.replace(reg, '');
    }
  }
  if (t.stripHtml !== false) {
    value = value.replace(/<script[\s\S]*?<\/script>/gi, '').replace(/<style[\s\S]*?<\/style>/gi, '');
    value = value.replace(/<[^>]+>/g, '');
  }
  return value.replace(/\n{3,}/g, '\n\n').trim();
}

// 从一段正文提取台词。返回 [{ speaker, text, emotion }]，已剔除空文本。
// 失败抛错由调用方提示；返回空数组表示「这段没有真台词」。
async function extractDialogue(text) {
  const passage = String(text || '').trim();
  if (!passage) return [];
  const cfg = ttsExtractApiConfig();
  const t = settings.tts || {};
  let sysPrompt = (t.extractPrompt || '').trim() || TTS_EXTRACT_SYSTEM;
  // 提取上下文注入（治 OOC/情绪失准/人称锚定）：把角色人设 + user 人设（+选中的世界书条目）喂给提取模型，
  // 让它判情绪有性格基线、据人设把「我/你」锚定到具体角色。取材式——从 ST 现成读取器拉，与主线共享同源。
  // 顺序治理：默认提示词含 {{QM_CONTEXT}} 占位符 → 把人设/世界书插在「规则之前」（先立"谁"和"世界"，规则再带着人设去套）。
  // 自定义提示词若无占位符则回落追加末尾（老行为，向后兼容）。上下文为空时占位符清成空串。
  const ctxBlock = ttsBuildExtractContext();
  if (sysPrompt.includes('{{QM_CONTEXT}}')) {
    sysPrompt = sysPrompt.replace('{{QM_CONTEXT}}', ctxBlock ? ctxBlock.replace(/^\n+/, '') : '');
  } else {
    sysPrompt += ctxBlock;
  }
  // NPC 泛用音色开启且配了原型：追加归类指令，让模型给非主角台词标一个最贴的原型标签
  const archetypes = (Array.isArray(t.npcArchetypes) ? t.npcArchetypes : []).filter((a) => a.label && a.voiceId);
  const npcOn = t.npcEnabled && archetypes.length > 0;
  if (npcOn) {
    // 每个原型列成「原型名（关键词描述）」，让模型据关键词精准判声线，而非只靠笼统的原型名猜
    const labels = archetypes.map((a) => a.label).join('、');
    const archLines = archetypes.map((a) => {
      const kw = String(a.keywords || '').trim();
      return kw ? `- ${a.label}：${kw}` : `- ${a.label}`;
    }).join('\n');
    sysPrompt += `\n\n【NPC 音色归类】对每句台词额外判断说话人最贴合的人物原型，填入字段 "npc"，只能从下列原型名中选一个：[${labels}]。每个原型附带关键词描述（年龄、气质、声线特征等），请结合说话人在正文中的身份、年龄、性格与情境，对照关键词描述选出最贴的那个；没有特别贴合的，就按大致声线（性别 / 年龄段 / 气质）挑最接近的一个，不要留空、也不要新造原型名。主角 / 已知重要角色（通常已单独配音色）可留空 ""。\n原型清单：\n${archLines}\n输出格式扩展为：{"lines": [{"speaker": "角色名", "text": "台词", "emotion": "auto", "npc": "原型名或空"}]}`;
  }
  // 音效自动化（可选·靠模型判断·默认关）：开则让模型给「确需空间感/失真感」的句子挑一个音效标签，填 "fx"。
  if (t.soundFxAuto) {
    sysPrompt += `\n\n【音效 fx（可选·按语境·宁缺毋滥）】仅当某句台词所处场景明显需要空间/介质感时，才给一个 "fx" 字段，从这四个里选一个：spacious_echo(空旷回音·如空谷/大厅)、auditorium_echo(礼堂广播·如扩音喇叭/舞台)、lofi_telephone(电话失真·如电话/无线电通话)、robotic(电音·如机器人/AI/机械音)。绝大多数正常对话都不需要音效——没有明确场景需求就不要给 fx（省略或留空 ""）。切忌滥用。`;
  }
  const userPrompt = `【正文】\n${passage}`;
  const raw = await callTtsExtractModel(sysPrompt, userPrompt, cfg);
  const content = String(raw || '').trim();
  if (!content) return [];
  let parsed;
  try { parsed = extractJson(content); }
  catch (_) { throw new Error('台词提取结果无法解析'); }
  const lines = Array.isArray(parsed?.lines) ? parsed.lines : (Array.isArray(parsed) ? parsed : []);
  const validEmotions = new Set(['happy', 'sad', 'angry', 'fearful', 'disgusted', 'surprised', 'calm', 'fluent', 'whisper']);
  const fxOn = !!t.soundFxAuto;
  const validFx = new Set(['spacious_echo', 'auditorium_echo', 'lofi_telephone', 'robotic']);
  return lines
    .map((l) => {
      const text = String(l?.text || '').trim();
      // 模型给的语速：仅接受 0.90~1.35 范围内且非默认 1.0 的值（超范围/非法/=1 → 省略，回落角色/全局默认）。
      // 用户手动单条覆盖走另路(popup)可 0.5~2 全域，不受此限。
      const rawSpeed = Number(l?.speed);
      const speed = (Number.isFinite(rawSpeed) && rawSpeed >= 0.9 && rawSpeed <= 1.35 && Math.abs(rawSpeed - 1) > 0.001) ? Math.round(rawSpeed * 100) / 100 : undefined;
      const out = {
        speaker: String(l?.speaker || '').trim() || '未知',
        text,
        emotion: validEmotions.has(l?.emotion) ? l.emotion : 'auto',
        npc: npcOn ? String(l?.npc || '').trim() : '',   // 模型判定的 NPC 原型标签（仅 npcOn 时有意义）
        fx: fxOn && validFx.has(l?.fx) ? l.fx : '',      // 音效自动化：模型判的 per-line 音效（仅 fxOn 且在白名单内才留）
      };
      if (speed !== undefined) out.speed = speed;        // 模型给的合规语速（受方情动略快等）；缺省不填
      return out;
    })
    .filter((l) => l.text);
}

/* ============================================================
   有声小剧场 · 正文注入与播放（阶段 4）
   懒触发：每条消息只挂一个 🎧 钮，点了才提取台词、铺开各句 🔊。
   事件委托 + 幂等标记：不轮询、不改写 ST 正文 innerHTML，只追加兄弟挂件。
   ============================================================ */

const TTS_BAR_CLASS = 'sd-tts-bar';
const TTS_INTERCLIP_GAP_MS = 720;  // 连播句间停顿(ms)：略长于纯断句，留出自然换气感、不粘连也不拖沓
let ttsChatBound = false;          // #chat 委托/观察者是否已挂
let ttsChatObserver = null;
let ttsScanTimer = null;           // 扫描防抖：观察者短时间多次触发只在安定后扫一次，避免插在 ST 半渲染态里
// 防抖扫描：DOM 连续变动（进聊天注水、流式回复）期间合并成一次，待 ST 安定再扫，规避注入打断 ST 渲染。
function ttsScanDebounced(delay = 120) {
  if (ttsScanTimer) clearTimeout(ttsScanTimer);
  ttsScanTimer = setTimeout(() => { ttsScanTimer = null; try { ttsScanMessages(); } catch (_) {} }, delay);
}
let ttsLineCache = new Map();      // 内容指纹 → [{speaker,text,emotion}]（本会话内提取结果，避免重复调模型）

// 台词列表的「内容指纹」：按消息正文本身算 key，而非楼层 mesid——
// 楼层会因重 roll/swipe/插楼漂移，正文不变指纹就不变，故跨刷新/重排都能稳定命中；正文一变（重 roll/编辑）指纹即变，自动重提。
function ttsContentKey(raw) {
  const s = String(raw || '');
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) >>> 0;
  return 'h' + h.toString(36) + '_' + s.length;   // 'h' 前缀避免被当数组下标；带长度近乎杜绝碰撞
}
// 原地编正文后的缓存迁移：内容指纹随正文一变即漂移、新 key 查不到旧台词列表。
// 凭楼层 mesid 锚到「最近一次该楼的 key」，再以**台词原文是否仍逐字在场**为闸门——
// 全部台词句仍出现在新正文清洗后的 passage 里（即只改了旁白/非台词）→ 把旧 lines 迁到新 key（含持久化 speed/emotion override），免重提、音频逐句仍命中；
// 任一句台词原文消失（真改了台词）→ 不迁移，该条回 🎧 等用户手动重提。mesid 锚点 + 逐字闸门双保险，不靠模糊猜测。
function ttsMigrateLinesOnEdit(mesEl, newKey) {
  const mesid = ttsMesId(mesEl);
  if (mesid === '') return null;
  let store;
  try { store = getChatStore(); } catch (_) { return null; }
  const oldKey = store.ttsLineKeyByMes?.[mesid];
  if (!oldKey || oldKey === newKey) return null;
  const oldLines = ttsLineCache.get(oldKey) || store.ttsLines?.[oldKey];
  if (!Array.isArray(oldLines) || !oldLines.length) return null;
  // 闸门：每句台词原文仍逐字在新 passage 中（去引号+折空白归一，宽松到只防「台词真被改」）
  const norm = (s) => String(s || '').replace(/["'“”‘’「」『』]/g, '').replace(/\s+/g, '');
  const passage = norm(ttsCleanText(ttsRawText(mesEl)));
  const allPresent = oldLines.every((l) => {
    const needle = norm(l.text);
    return needle.length < 2 || passage.includes(needle);
  });
  if (!allPresent) return null;   // 台词真变了：不迁移
  // 迁移：旧 lines 落到新 key、更新锚点。**不删旧 key**——内容指纹寻址下，内容相同的别的楼层可能也指向旧 key，
  // 删了会把那些楼层的缓存一并打掉（串楼）。孤儿键无害，由 ttsPruneLineStore 统一按上限裁剪。
  store.ttsLines[newKey] = oldLines;
  ttsLineCache.set(newKey, oldLines);
  store.ttsLineKeyByMes[mesid] = newKey;
  try { ttsPruneLineStore(store.ttsLines); saveMetadata(); } catch (_) {}
  return oldLines;
}
// 取消息原始正文：只认 chat[mesid].mes（原始文本，正则不改它，故指纹免疫正则开关）。
// 取不到（如切聊天/开关正则重建时 DOM 已在、ctx().chat 尚未对齐）返回空串——
// 调用方据空串跳过，交下一轮扫描用正确指纹恢复；绝不回退读 DOM 文本，
// 否则会读到正则渲染后的显示文本、算出漂移指纹，致已有台词/音频缓存认领不回（孤儿化）。
function ttsRawText(mesEl) {
  const mesid = ttsMesId(mesEl);
  const chat = ctx().chat;
  if (mesid !== '' && Array.isArray(chat)) {
    const idx = Number(mesid);
    if (Number.isInteger(idx) && chat[idx]) return String(chat[idx].mes || '');
  }
  return '';
}
// 楼层号：mesid/mesId 任一
function ttsMesId(mesEl) {
  return mesEl?.getAttribute('mesid') || mesEl?.getAttribute('mesId') || '';
}
// 裁剪持久化 ttsLines：超上限按插入序（Object 保序）丢最旧的孤儿条目，防聊天存档膨胀。
// 上限取 100：列表存在聊天 JSON 里、每回合随 saveMetadata 序列化写盘，故收紧（不同于音频缓存——那在 IndexedDB 懒加载、不进存档）；100 条覆盖任何正常回看，丢了也只是一次廉价重提。
function ttsPruneLineStore(store, limit = 100) {
  const keys = Object.keys(store);
  if (keys.length <= limit) return;
  for (const k of keys.slice(0, keys.length - limit)) delete store[k];
}
let ttsCurrentAudio = null;        // 当前播放的 Audio（新播放前先停旧的）
let ttsCurrentUrl = '';            // 当前 objectURL（播完撤销）
let ttsSeqToken = 0;               // 连播序列令牌：自增即令旧连播失效（停止/重启）
let ttsPlayCleanup = null;         // 当前 ttsPlayBlob 的收尾回调：停止时主动调，令 await 的播放 Promise 立即 resolve、旧连播循环得以解开（不被暂停的音频卡死）
let ttsPopupEl = null;             // 快捷窗 DOM
let ttsExtractWorldView = '';      // 提取卡：当前查看条目的世界书名

// 当前生效的角色→音色映射：始终绑定当前聊天，取本聊天 store.ttsVoiceMap（类比推演按聊天）。
// 未打开聊天时 store 为临时对象、映射为空，故界面显示为空。返回真实数组引用（增删改后调 ttsSaveVoiceMap 落盘）。
function ttsActiveVoiceMap() {
  const store = getChatStore();
  if (!Array.isArray(store.ttsVoiceMap)) store.ttsVoiceMap = [];
  return store.ttsVoiceMap;
}

// 配音「人设参照」世界书选择：**按聊天存**（绑当前聊天·类比 ttsVoiceMap）。不同聊天各自记住绑哪些书/条目。
// 未打开聊天时 store 为临时对象，选择为空、界面显示未选。返回真实引用（改后 saveMetadata 落盘）。
function ttsExtractWorldItemsStore() {
  const store = getChatStore();
  if (!isPlainObject(store.ttsExtractWorldItems)) store.ttsExtractWorldItems = {};
  return store.ttsExtractWorldItems;
}
// 书级多选（按聊天）。
function ttsExtractWorldBooks() {
  const store = getChatStore();
  if (!Array.isArray(store.ttsExtractWorldBooks)) store.ttsExtractWorldBooks = [];
  return store.ttsExtractWorldBooks;
}
function toggleTtsExtractWorldBook(name, selected) {
  if (!name) return;
  const arr = ttsExtractWorldBooks();
  const i = arr.indexOf(name);
  const want = typeof selected === 'boolean' ? selected : i < 0;
  if (want && i < 0) arr.push(name);
  else if (!want && i >= 0) arr.splice(i, 1);
  saveMetadata();
}
function isTtsExtractWorldItemSelected(book, itemId, fallbackEnabled) {
  const store = ttsExtractWorldItemsStore()[book];
  if (store && typeof store[itemId] === 'boolean') return store[itemId];
  return fallbackEnabled !== false;
}
function setTtsExtractWorldItemSelected(book, itemId, selected) {
  const store = ttsExtractWorldItemsStore();
  if (!isPlainObject(store[book])) store[book] = {};
  store[book][itemId] = !!selected;
  saveMetadata();
}

// 组装提取上下文块（角色/persona 人设 + 选中的世界书条目），追加进提取系统提示词。
// 人设默认注入（治 OOC/情绪/人称）；世界书只注入用户勾选的条目。都空则返回空串。世界书用主线扫描缓存 contextScanCache（同源）。
function ttsBuildExtractContext() {
  const blocks = [];
  // 人设：默认注入（AI 角色 + user 人设）。取材式，从 ST 现成读取器拉。
  const charName = getCharacterName();
  const charDesc = getCharacterDescription();
  const userName = getPersonaName();
  const userDesc = getPersonaDescription();
  const plines = [];
  if (charName) plines.push(`- AI 角色：${charName}${charDesc ? `\n  人设：${clipLog(charDesc, 800)}` : ''}`);
  if (userName) plines.push(`- 用户（user）：${userName}${userDesc && userDesc !== '{{persona}}' ? `\n  人设：${clipLog(userDesc, 500)}` : ''}`);
  if (plines.length) blocks.push(`【角色定位】判断说话人身份与情绪时，须结合以下人设基线（性格决定情绪的表达方式与上限，勿判成脱离性格的 OOC 情绪；正文用第一/第二人称叙事时据此把"我/你"还原到对应角色本名）：\n${plines.join('\n')}`);
  // 世界书：只注入「书级选中 且 条目勾选」的条目（独立于主线选择）。
  const wb = contextScanCache?.worldBooks || {};
  const selectedBooks = ttsExtractWorldBooks();
  const chunks = [];
  for (const name of selectedBooks) {
    const entries = Array.isArray(wb[name]) ? wb[name] : [];
    entries.forEach((it, index) => {
      const id = getContextItemId(it, index);
      if (!isTtsExtractWorldItemSelected(name, id, it?.enabled)) return;
      const c = cleanContextText(it?.content || it?.prompt || '');
      if (c) chunks.push(c);
    });
  }
  const joined = chunks.join('\n').trim();
  if (joined) blocks.push(`【世界设定参考】辅助理解专有名词、角色关系与情境（仅参考，不影响台词判定规则）：\n${clipLog(joined, 2000)}`);
  return blocks.length ? `\n\n${blocks.join('\n\n')}` : '';
}

// 落盘当前映射：写本聊天元数据
function ttsSaveVoiceMap() {
  try { saveMetadata(); } catch (_) {}
}

// 按说话人查音色配置。优先本聊天映射（精确→去空白包含）；未命中且 NPC 开启则查「本聊天记忆」的原型音色。
// 返回 { voiceId, speed?, emotion? } 或 null（不生成）。
function ttsResolveVoice(speaker) {
  const t = settings.tts || {};
  const map = ttsActiveVoiceMap();
  const name = String(speaker || '').trim();
  if (!name) return null;
  let row = map.find((r) => r.voiceId && String(r.name || '').trim() === name);
  if (!row) {
    const norm = name.replace(/\s+/g, '');
    row = map.find((r) => r.voiceId && r.name && (norm.includes(String(r.name).replace(/\s+/g, '')) || String(r.name).replace(/\s+/g, '').includes(norm)));
  }
  if (row) return row;
  // NPC 泛用：查本聊天已记忆的「说话人→原型」分配
  if (t.npcEnabled) {
    const archId = t.npcAssignByChat?.[getChatKey()]?.[name];
    if (archId) {
      const arch = (t.npcArchetypes || []).find((a) => a.id === archId && a.voiceId);
      if (arch) return { name, voiceId: arch.voiceId, speed: null, emotion: 'auto' };
    }
  }
  return null;
}

// 提取后：给未在本聊天映射命中、但模型标了 NPC 原型的说话人，按聊天记忆分配原型并落库（熟脸不漂移）。
// 返回是否有新分配（调用方据此决定是否 saveSettings）。
function ttsAssignNpc(lines) {
  const t = settings.tts || {};
  if (!t.npcEnabled || !Array.isArray(t.npcArchetypes) || !t.npcArchetypes.length) return false;
  const map = ttsActiveVoiceMap();
  const inVoiceMap = (name) => {
    const norm = String(name).replace(/\s+/g, '');
    return map.some((r) => r.voiceId && r.name && (String(r.name).trim() === name || norm.includes(String(r.name).replace(/\s+/g, '')) || String(r.name).replace(/\s+/g, '').includes(norm)));
  };
  const key = getChatKey();
  t.npcAssignByChat = t.npcAssignByChat || {};
  t.npcAssignByChat[key] = t.npcAssignByChat[key] || {};
  const mem = t.npcAssignByChat[key];
  let changed = false;
  for (const l of lines) {
    const name = String(l.speaker || '').trim();
    if (!name || name === '未知') continue;
    if (inVoiceMap(name)) continue;        // 主角等已显式配音色，不动
    if (mem[name]) continue;               // 已记忆，保持稳定（熟脸不漂移）
    const label = String(l.npc || '').trim();
    if (!label) continue;
    const arch = t.npcArchetypes.find((a) => a.voiceId && (a.label === label || String(a.label).replace(/\s+/g, '') === label.replace(/\s+/g, '')));
    if (arch) { mem[name] = arch.id; changed = true; }
  }
  return changed;
}

// 合成参数：默认值 ← 角色行 ← 单句（line 自带的 speed/emotion 覆盖，已持久化）。返回 null 表示该说话人无音色、应跳过。
function ttsBuildParams(line) {
  const t = settings.tts || {};
  const voice = ttsResolveVoice(line.speaker);
  if (!voice) return null;
  // 情绪：单句显式（非 auto）优先 → 角色默认 → auto
  const emotion = (line.emotion && line.emotion !== 'auto') ? line.emotion
    : (voice.emotion && voice.emotion !== 'auto' ? voice.emotion : 'auto');
  // 语速：单句显式 → 角色默认 → 全局默认
  const speed = Number.isFinite(line.speed) ? line.speed
    : (Number.isFinite(voice.speed) ? voice.speed : Number(t.defaultSpeed ?? 1));
  const vfx = ttsVoiceFx(voice.voiceId);   // per-voice 音效器覆盖（无则 null，回落全局 T3）
  return {
    apiKey: t.apiKey,
    text: line.text,   // 合成用干净台词原文（多音字矫正交 T1 全局发音词典·synth 合成态已移除）
    voiceId: voice.voiceId,
    model: t.model,
    speed,
    vol: Number(t.defaultVol ?? 1),   // 全局默认音量（每音色微调已移除）
    pitch: Number(t.defaultPitch ?? 0),
    emotion,
    format: t.format || 'mp3',
    endpoint: t.endpoint,
    proxyBase: t.proxyBase,
    groupId: t.groupId,
    pronunciationTone: ttsPronunciationTone(),
    languageBoost: t.languageBoost || '',
    // 音效器：per-voice(按 voiceId)覆盖全局 T3；音效另受自动化 per-line fx 更高优先
    vmPitch: Number.isFinite(vfx?.vmPitch) ? vfx.vmPitch : Number(t.vmPitch ?? 0),
    vmIntensity: Number.isFinite(vfx?.vmIntensity) ? vfx.vmIntensity : Number(t.vmIntensity ?? 0),
    vmTimbre: Number.isFinite(vfx?.vmTimbre) ? vfx.vmTimbre : Number(t.vmTimbre ?? 0),
    soundEffects: (t.soundFxAuto && line.fx) ? line.fx : (vfx && vfx.soundEffects ? vfx.soundEffects : (t.soundEffects || '')),   // 自动化per-line ＞ per-voice ＞ 全局
  };
}

// 取某音色的 per-voice 音效器覆盖（无则 null）。
function ttsVoiceFx(voiceId) {
  const map = settings.tts?.voiceFxById;
  if (!voiceId || !isPlainObject(map)) return null;
  const v = map[voiceId];
  return isPlainObject(v) ? v : null;
}

// 存 per-voice 音效器：全默认(全 0 且无音效)则清除该条(不留空壳)；voiceId 改动则从旧键迁到新键。
function ttsSaveVoiceFx(oldVoiceId, newVoiceId, fx) {
  const t = settings.tts || (settings.tts = {});
  if (!isPlainObject(t.voiceFxById)) t.voiceFxById = {};
  if (oldVoiceId && oldVoiceId !== newVoiceId) delete t.voiceFxById[oldVoiceId];
  const f = isPlainObject(fx) ? fx : {};
  const allDefault = !Number(f.vmPitch) && !Number(f.vmIntensity) && !Number(f.vmTimbre) && !f.soundEffects;
  if (!newVoiceId || allDefault) { if (newVoiceId) delete t.voiceFxById[newVoiceId]; return; }
  t.voiceFxById[newVoiceId] = {
    vmPitch: Number(f.vmPitch) || 0,
    vmIntensity: Number(f.vmIntensity) || 0,
    vmTimbre: Number(f.vmTimbre) || 0,
    soundEffects: String(f.soundEffects || ''),
  };
}

// 全局发音词典 → MiniMax pronunciation_dict.tone 数组（["处理/(chu3)(li3)", …]）。
// 过滤空项、去掉用户误填的斜杠（from/to 各自不该含 /，否则破坏 "原文/替换" 语义）。
// 把用户填的「读音」规范成 MiniMax 认的格式：拼音/IPA 必须用**英文半角小括号**逐音节包裹（如 (chu3)(li3)），
// 否则 MiniMax 当纯文本替换、把声调数字原样念出来（用户报的 bug）。三步兜底：
// ①全角括号（）→半角()（中文输入法默认全角，MiniMax 不认）；②已有括号的直接采纳（信任用户已包好，仅补全角转换）；
// ③完全无括号但形如带声调数字的拼音（chu3li3 / chu3 li3 / hang2）→按「字母+声调数字1-6」自动逐音节切分并包裹。
// 纯文本替换（如 危险/dangerous、符号替换）无声调数字、也无括号 → 原样保留（走 MiniMax 的文本展开替换，正确）。
function ttsNormalizePronToTo(raw) {
  let v = String(raw || '').trim();
  if (!v) return '';
  // ① 全角括号 → 半角
  v = v.replace(/（/g, '(').replace(/）/g, ')');
  // ② 已含半角括号：信任用户已按音节包好，直接用
  if (v.includes('(')) return v;
  // ③ 无括号：仅当整体是「拼音音节(字母)+声调数字(1-6)」的一段（可含空格分隔）才自动包裹；
  //    形如 chu3li3 / chu3 li3 / hang2 / soeng6。含中文/其他 → 判为纯文本替换，不动。
  const compact = v.replace(/\s+/g, '');
  if (/^(?:[a-züv]+[1-6])+$/i.test(compact)) {
    // 按「字母串+一个声调数字」为一个音节切分，逐个包裹
    const syllables = compact.match(/[a-züv]+[1-6]/gi) || [];
    return syllables.map((s) => `(${s})`).join('');
  }
  return v;   // 纯文本替换 / 无法识别 → 原样（不塞括号，避免误伤）
}

function ttsPronunciationTone() {
  const dict = Array.isArray(settings.tts?.pronunciationDict) ? settings.tts.pronunciationDict : [];
  return dict
    // from 去斜杠（避免破坏「原文/替换」分隔）；to 走规范器（全角转半角 + 裸拼音自动包裹）
    .map((e) => ({ from: String(e?.from || '').replace(/\//g, '').trim(), to: ttsNormalizePronToTo(e?.to) }))
    .filter((e) => e.from && e.to)
    .map((e) => `${e.from}/${e.to}`);
}

// 带缓存合成：命中 IndexedDB 直接取，否则调 API 并存缓存。force=true 跳过缓存（重生成）。
// 返回 { blob, params, cached }；params 用于下载/收藏命名，cached 用于决定是否弹提示。
async function ttsSynthCached(line, force = false) {
  const params = ttsBuildParams(line);
  if (!params) throw new Error(`「${line.speaker}」未配置音色`);
  if (!params.apiKey) throw new Error('未配置 MiniMax API Key');
  const key = ttsCacheKey(params);
  const useCache = blobStore.blobStoreAvailable();
  if (!force && useCache) {
    try {
      const hit = await blobStore.getAudio(key);
      if (hit?.blob) return { blob: hit.blob, params, cached: true };
    } catch (_) {}
  }
  const { blob } = await ttsSynthesize(params);
  if (useCache) {
    try {
      await blobStore.putAudio(key, blob, { speaker: line.speaker, text: line.text });
      await blobStore.pruneAudio(Number(settings.tts?.cacheLimit ?? 200));
    } catch (_) {}
  }
  return { blob, params, cached: false };
}

// 停止当前播放（单句或连播）。bumpSeq=true 同时令进行中的连播失效。
function ttsStopPlayback(bumpSeq = true) {
  if (bumpSeq) ttsSeqToken++;
  if (ttsCurrentAudio) {
    try { ttsCurrentAudio.pause(); } catch (_) {}
    ttsCurrentAudio = null;
  }
  if (bumpSeq && ttsPlayCleanup) ttsPlayCleanup();   // 仅真·停止(bumpSeq)时主动收尾在播那句：解开 await 的播放 Promise（暂停不触发 ended），令旧连播循环即刻继续、查 token 后退出。false 路径（连播内部换句）不收尾——否则单句插播会无 token 变更地解开连播 await，致连播续播与单句抢播。
  if (ttsCurrentUrl) { try { URL.revokeObjectURL(ttsCurrentUrl); } catch (_) {} ttsCurrentUrl = ''; }
  // 列表项与正文内联图标都可能带高亮，一并清
  document.querySelectorAll('.sd-playing').forEach((el) => el.classList.remove('sd-playing'));
  // 连播钮复位为「播放」外观——仅在「真·停止」(bumpSeq=true) 时做。
  // 连播内部每句切换调 ttsStopPlayback(false) 停上一句，那不是停止整段，复位会致停止键频闪回播放键。
  if (bumpSeq) {
    document.querySelectorAll('.sd-tts-playing').forEach((b) => {
      b.classList.remove('sd-tts-playing');
      const isToolbar = b.classList.contains('sd-tts-playall');
      b.innerHTML = '<i class="fa-regular fa-circle-play"></i>';
      b.title = isToolbar ? '连续播放本条全部台词（命中缓存秒回）；播放中再点即停止' : '连续播放本条全部台词';
    });
  }
}

// 播放一个 blob，返回在结束/出错/被停止时 resolve 的 Promise。hi 为需高亮的元素数组（列表项 + 对应正文内联图标，同步亮灭）。
function ttsPlayBlob(blob, hi = []) {
  ttsStopPlayback(false);   // 停旧的单句，但不打断连播序列
  const els = (Array.isArray(hi) ? hi : [hi]).filter(Boolean);
  return new Promise((resolve) => {
    const url = URL.createObjectURL(blob);
    const audio = new Audio(url);
    ttsCurrentAudio = audio;
    ttsCurrentUrl = url;
    els.forEach((el) => el.classList.add('sd-playing'));
    let done = false;
    const cleanup = () => {
      if (done) return;          // 幂等：ended/error/被停止 任一触发后再调皆无操作
      done = true;
      if (ttsPlayCleanup === cleanup) ttsPlayCleanup = null;
      els.forEach((el) => el.classList.remove('sd-playing'));
      if (ttsCurrentUrl === url) { try { URL.revokeObjectURL(url); } catch (_) {} ttsCurrentUrl = ''; }
      if (ttsCurrentAudio === audio) ttsCurrentAudio = null;
      resolve();
    };
    ttsPlayCleanup = cleanup;     // 供 ttsStopPlayback 主动收尾，解开 await（暂停的音频不会触发 ended）
    audio.addEventListener('ended', cleanup, { once: true });
    audio.addEventListener('error', cleanup, { once: true });
    audio.play().catch(cleanup);
  });
}

// 给单条消息找/建台词条容器（插在 🎧 钮之后；幂等）
function ttsEnsureBar(mesEl) {
  let bar = mesEl.querySelector(`.${TTS_BAR_CLASS}`);
  if (bar) return bar;
  const tb = mesEl.querySelector('.sd-tts-toolbar');
  const textEl = mesEl.querySelector('.mes_text');
  const anchor = tb || textEl;
  if (!anchor) return null;
  bar = document.createElement('div');
  bar.className = TTS_BAR_CLASS;
  anchor.insertAdjacentElement('afterend', bar);
  return bar;
}

// 扫描 #chat，给每条消息幂等追加工具栏（🎧 提取/折叠 + 🔁 重新提取）；不提取，点了才提取。
// 工具栏只挂一次（sdTtsHooked 标记）；自动恢复 ttsAutoRestore 解耦出来每次扫描都跑——首扫可能早于元数据注水，
// 那时查不到持久化台词，需后续扫描重试。恢复纯读缓存/持久化、幂等，重复跑无副作用。
function ttsScanMessages() {
  const t = settings.tts || {};
  if (!t.enabled || !t.injectInChat) return;
  const chat = document.getElementById('chat');
  if (!chat) return;
  chat.querySelectorAll('.mes').forEach((mesEl) => {
    if (mesEl.getAttribute('is_system') === 'true') { mesEl.dataset.sdTtsHooked = '1'; return; }
    const textEl = mesEl.querySelector('.mes_text');
    if (!textEl) return;
    if (mesEl.dataset.sdTtsHooked !== '1') {
      mesEl.dataset.sdTtsHooked = '1';
      const bar = document.createElement('div');
      bar.className = 'sd-tts-toolbar';
      bar.innerHTML = `
        <button type="button" class="sd-tts-trigger" title="提取/展开台词列表" aria-label="提取台词"><i class="fa-solid fa-clapperboard"></i></button>
        <button type="button" class="sd-tts-reextract" title="重新提取台词列表（仅刷新文本）" aria-label="重新提取台词"><i class="fa-solid fa-film"></i></button>
        <button type="button" class="sd-tts-regenall" title="重新生成本条全部语音" aria-label="重生本条全部语音" hidden><i class="fa-solid fa-rotate"></i></button>
        <button type="button" class="sd-tts-playall" title="连续播放本条全部台词" aria-label="连续播放" hidden><i class="fa-regular fa-circle-play"></i></button>`;
      textEl.insertAdjacentElement('afterend', bar);
    }
    ttsAutoRestore(mesEl);   // 每次扫描都试：本条此前已提取过则渲染台词条与播放键（只读缓存/持久化、不调模型、幂等；已渲染则内部即返回）
  });
}

// 委托点击：🎧 触发 / 🔁 重提取 / 🔊 单句（双击=快捷窗）/ ▶ 连播（播放中再点=停止）/ 🌀 重生语音
function ttsOnChatClick(e) {
  const reext = e.target.closest('.sd-tts-reextract');
  if (reext) { e.preventDefault(); ttsHandleTrigger(reext.closest('.mes')?.querySelector('.sd-tts-trigger') || reext, true); return; }
  const trig = e.target.closest('.sd-tts-trigger');
  if (trig) { e.preventDefault(); ttsHandleTrigger(trig); return; }
  const regenAll = e.target.closest('.sd-tts-regenall');
  if (regenAll) { e.preventDefault(); ttsHandlePlayAll(regenAll, true); return; }   // force=true 全量重生成
  const playAll = e.target.closest('.sd-tts-playall, .sd-tts-inline-playall');
  if (playAll) {
    e.preventDefault();
    // 合并的连播/停止钮：播放态再点即停止；否则开始连播
    if (playAll.classList.contains('sd-tts-playing')) { ttsStopPlayback(true); return; }
    ttsHandlePlayAll(playAll, false);
    return;
  }
  const playBtn = e.target.closest('.sd-tts-play');
  if (playBtn) { e.preventDefault(); ttsHandleLinePlayClick(playBtn); return; }
}

// 切换某条消息所有连播钮（外层工具栏 + 正文内联）的 播放↔停止 外观。playing=true → 停止图标+「停止」文案+.sd-tts-playing
function ttsSetPlayingState(mesEl, playing) {
  if (!mesEl) return;
  mesEl.querySelectorAll('.sd-tts-playall, .sd-tts-inline-playall').forEach((b) => {
    b.classList.toggle('sd-tts-playing', !!playing);
    const iconCls = playing ? 'fa-solid fa-circle-stop' : 'fa-regular fa-circle-play';
    // 工具栏与内联钮均仅图标（去文案）
    b.innerHTML = `<i class="${iconCls}"></i>`;
    b.title = playing ? '停止播放' : '连续播放本条全部台词';
  });
}

// 单句播放钮：单击播放，双击弹快捷窗。用延迟守卫区分（合成本就比 250ms 慢，延迟无感）。
let ttsClickTimer = null;
function ttsHandleLinePlayClick(btn) {
  if (ttsClickTimer) { clearTimeout(ttsClickTimer); ttsClickTimer = null; ttsOpenQuickPopup(btn); return; }
  ttsClickTimer = setTimeout(() => {
    ttsClickTimer = null;
    ttsPlayLineFromBtn(btn);
  }, 250);
}

// 从播放钮解析「第几句 + line 对象 + 所属消息」。列表项与内联图标都带 data-idx，回查缓存 lines 拿到持久化的 speed/emotion。
// 缓存与持久化同引用，故直接拿到的 line 改了即生效；缓存丢失时用 dataset 兜底现搭（不含 override）。
function ttsResolveLineFromBtn(btn) {
  const mesEl = btn.closest('.mes');
  const idxHost = btn.closest('[data-idx]');
  const idx = Number(idxHost?.dataset.idx);
  const key = mesEl?.querySelector(`.${TTS_BAR_CLASS}`)?.dataset.key || '';
  const lines = key ? ttsLineCache.get(key) : null;
  let line = (lines && Number.isInteger(idx) && lines[idx]) ? lines[idx] : null;
  if (!line) {
    // 缓存查不到：优先按 idx 取列表项快照（speaker/text/emotion/speed 齐），再退到按钮自身 dataset（内联图标也带），最后才裸兜底
    const rowEl = (Number.isInteger(idx) && mesEl)
      ? mesEl.querySelector(`.sd-tts-line[data-idx="${idx}"]`) : null;
    const host = rowEl || btn.closest('.sd-tts-line') || idxHost || btn;
    line = { speaker: host.dataset?.speaker || '未知', text: host.dataset?.text || '', emotion: host.dataset?.emotion || 'auto' };
    if (host.dataset?.speed !== undefined && host.dataset.speed !== '') line.speed = Number(host.dataset.speed);   // override 过的语速，缺则回落默认
  }
  return { mesEl, idx: Number.isInteger(idx) ? idx : -1, line, key };
}

// 把第 idx 句的 override（speed/emotion）写入 line 并落盘（缓存与持久化同引用，改了即生效）。
// 内存缓存缺失（如进聊天后仅持久化、该 key 尚未坐实 ttsLineCache）时回落持久化并重新坐实缓存，
// 确保 override 落到**后续点击会读到的同一份**对象——否则改动只留在弹窗临时 line 上、播放路径读不到（重生成不覆盖旧缓存的根因）。
function ttsPersistLineOverride(mesEl, idx, patch) {
  const key = mesEl?.querySelector(`.${TTS_BAR_CLASS}`)?.dataset.key || '';
  let lines = key ? ttsLineCache.get(key) : null;
  if (!lines && key) {
    const saved = getChatStore().ttsLines?.[key];
    if (Array.isArray(saved)) { lines = saved; ttsLineCache.set(key, lines); }   // 重新坐实，后续 resolve 命中同引用
  }
  if (!lines || !Number.isInteger(idx) || !lines[idx]) return null;
  Object.assign(lines[idx], patch);
  try { saveMetadata(); } catch (_) {}
  return lines[idx];
}

// override 后同步该句 DOM 数据集（列表项 + 正文内联图标）：作为缓存全失时的兜底真相源，
// 让 ttsResolveLineFromBtn/连播的字面兜底也能算出含 override 的正确 key（speed 无值则清掉，回落默认）。
function ttsSyncLineDataset(mesEl, idx, line) {
  if (!mesEl || !Number.isInteger(idx) || !line) return;
  mesEl.querySelectorAll(`.sd-tts-line[data-idx="${idx}"], .sd-tts-inline[data-idx="${idx}"]`).forEach((el) => {
    el.dataset.emotion = line.emotion || 'auto';
    if (Number.isFinite(line.speed)) el.dataset.speed = String(line.speed);
    else delete el.dataset.speed;
  });
}

// 某句所有可高亮元素：列表项 + 对应正文内联图标（同步亮灭）
function ttsHighlightEls(mesEl, idx) {
  if (!mesEl || !Number.isInteger(idx) || idx < 0) return [];
  return Array.from(mesEl.querySelectorAll(`.sd-tts-line[data-idx="${idx}"], .sd-tts-inline.sd-tts-play[data-idx="${idx}"]`));
}

// 播放一句已解析台词：spinner → 合成（force=重生成跳缓存）→ 仅真合成弹提示 → 列表+内联同步高亮
async function ttsPlayResolvedLine(line, mesEl, idx, spinBtn, force = false) {
  const icon = spinBtn?.querySelector('i');
  const prev = icon?.className;
  if (icon) icon.className = 'fa-solid fa-spinner fa-spin';
  try {
    const { blob, cached } = await ttsSynthCached(line, force);
    if (icon && prev) icon.className = prev;
    if (!cached) toast('配音已完成', 'success');   // 仅真合成才通知，缓存重播不刷屏
    await ttsPlayBlob(blob, ttsHighlightEls(mesEl, idx));
  } catch (err) {
    if (icon && prev) icon.className = prev;
    toast(`配音失败：${err?.message || err}`, 'error');
  }
}

async function ttsPlayLineFromBtn(btn, force = false) {
  if (btn.disabled) return;
  const { mesEl, idx, line } = ttsResolveLineFromBtn(btn);
  await ttsPlayResolvedLine(line, mesEl, idx, btn, force);
}

// 🎧 触发：提取台词 → 渲染台词条 + 正文内联 🔊。force=true 为重新提取（清缓存重 roll）
async function ttsHandleTrigger(trig, force = false) {
  const mesEl = trig.closest('.mes');
  if (!mesEl) return;
  const bar = ttsEnsureBar(mesEl);
  if (!bar) return;
  // 非强制 + 已渲染：纯折叠/展开已生成的台词条（内联图标随之显隐），不需正文。连播/停止钮一经提取即常驻，折叠不隐藏、不停播——交用户用按钮自控。
  if (!force && bar.dataset.loaded === '1') {
    bar.hidden = !bar.hidden;
    mesEl.querySelectorAll('.sd-tts-inline').forEach((el) => { el.hidden = bar.hidden; });
    return;
  }
  // 据原始正文算「内容指纹」做缓存 key
  const raw = ttsRawText(mesEl);
  if (!raw) { toast('正文尚未就绪，请稍候重试', 'info'); return; }   // 竞态窗口取不到原始正文：拦下，免按空文本算漂移 key 生成孤儿
  const key = ttsContentKey(raw);
  if (force) {
    // 重新提取：清掉本条缓存（内存 + 持久化）与已注入内联，强制重跑
    ttsLineCache.delete(key);
    try { delete getChatStore().ttsLines[key]; saveMetadata(); } catch (_) {}
    bar.dataset.loaded = '';
    ttsClearInlineIcons(mesEl);
  }
  if (bar.dataset.loading === '1') return;
  bar.dataset.loading = '1';
  bar.hidden = false;
  bar.innerHTML = '<span class="sd-tts-status"><i class="fa-solid fa-spinner fa-spin"></i> 正在提取台词…</span>';
  const icon = trig.querySelector('i');
  const prevIcon = icon?.className;
  if (icon) icon.className = 'fa-solid fa-spinner fa-spin';
  try {
    // 三级取：内存缓存 → 本聊天持久化（跨刷新/重排存活，按内容指纹寻址）→ 调模型提取
    let lines = ttsLineCache.has(key) ? ttsLineCache.get(key) : null;
    if (!lines) {
      const saved = getChatStore().ttsLines?.[key];
      if (Array.isArray(saved) && saved.length) { lines = saved; ttsLineCache.set(key, lines); }
    }
    if (!lines && !force) lines = ttsMigrateLinesOnEdit(mesEl, key);   // 编了正文但台词没变：迁移旧缓存，免白白调模型（force=用户主动要全量重提则跳过）
    if (!lines) {
      const passage = ttsCleanText(raw);
      lines = await extractDialogue(passage);
      ttsLineCache.set(key, lines);
      try { const store = getChatStore(); store.ttsLines[key] = lines; ttsPruneLineStore(store.ttsLines); saveMetadata(); } catch (_) {}   // 持久化，重开 ST 直接取回
    }
    if (ttsAssignNpc(lines)) saveSettings();   // NPC 原型分配（熟脸记忆），落库
    ttsApplyLines(mesEl, bar, lines, key);
    toast(lines.length ? `台词指导已完成（${lines.length} 句）` : '台词指导已完成（未发现台词）', 'success');
  } catch (err) {
    bar.dataset.loading = '';
    bar.innerHTML = `<span class="sd-tts-status sd-tts-err">提取失败：${htmlEscape(err?.message || String(err))}</span>`;
    toast(`台词指导失败：${err?.message || err}`, 'error');
  } finally {
    if (icon && prevIcon) icon.className = prevIcon;
  }
}

// 把一组 lines 落到某条消息的台词条：渲染列表 + 正文内联 🔊 + 外层连播钮显隐。提取/自动恢复共用。
// collapsed=true：渲染后默认折叠（台词条 + 内联图标隐藏，仅留工具栏播放键）——用于进聊天自动恢复，避免铺满屏幕。
function ttsApplyLines(mesEl, bar, lines, key, collapsed = false) {
  bar.dataset.loaded = '1';
  bar.dataset.loading = '';
  bar.dataset.key = key;                      // 供播放路径回查缓存 lines（取持久化的 speed/emotion）
  // 记录楼层→当前 key 锚点：供原地编正文后凭 mesid 找回旧台词列表迁移（见 ttsMigrateLinesOnEdit）
  const mesid = ttsMesId(mesEl);
  if (mesid !== '') {
    try { const s = getChatStore(); if (s.ttsLineKeyByMes[mesid] !== key) { s.ttsLineKeyByMes[mesid] = key; saveMetadata(); } } catch (_) {}
  }
  ttsRenderLines(bar, lines);
  ttsInjectInlineIcons(mesEl, lines);   // 正文内联 🔊（仅已配音色的台词）
  ttsToggleToolbarPlay(mesEl, lines.some((l) => ttsResolveVoice(l.speaker)));   // 外层连播/停止钮：有可播台词才显
  if (collapsed) {
    bar.hidden = true;
    mesEl.querySelectorAll('.sd-tts-inline').forEach((el) => { el.hidden = true; });   // 内联图标随台词条一并收起，点 🎧 再展开
  }
}

// 进入聊天扫描时：若本条正文此前已提取过（持久化命中），直接渲染台词条与播放键，无需用户再点 🎧。
// 仅读缓存/持久化、绝不调模型；未提取过的消息原样留一个 🎧 钮等用户点。
function ttsAutoRestore(mesEl) {
  const bar = mesEl.querySelector(`.${TTS_BAR_CLASS}`);
  if (bar && bar.dataset.loaded === '1') {
    // 已渲染过。自愈：若有可播台词、但正文里的内联 🔊 被外部重渲（如 ST 保存原地编辑重写 .mes_text）抹掉了，按缓存幂等补回。
    // 这条路径替代了「跟 ST 重渲抢时序补一次」的脆弱做法——交给扫描兜底，幂等、跑几次都无害。不动列表/音频/key、不调模型。
    const k = bar.dataset.key || '';
    const cached = k ? ttsLineCache.get(k) : null;
    if (Array.isArray(cached) && cached.some((l) => ttsResolveVoice(l.speaker))
        && !mesEl.querySelector('.mes_text .sd-tts-inline')) {
      ttsInjectInlineIcons(mesEl, cached);
      if (bar.hidden) mesEl.querySelectorAll('.sd-tts-inline').forEach((el) => { el.hidden = true; });   // 折叠态：补回的图标随之隐藏
    }
    return;
  }
  const raw = ttsRawText(mesEl);
  if (!raw) return;
  const key = ttsContentKey(raw);
  let lines = ttsLineCache.has(key) ? ttsLineCache.get(key) : null;
  if (!lines) {
    let saved = null;
    try { saved = getChatStore().ttsLines?.[key]; } catch (_) {}
    if (Array.isArray(saved) && saved.length) { lines = saved; ttsLineCache.set(key, lines); }
  }
  // 新 key 查不到：可能是原地编了正文（仅旁白/非台词）。凭 mesid 锚点 + 台词原文在场校验迁移旧缓存，免重提。
  if (!lines) lines = ttsMigrateLinesOnEdit(mesEl, key);
  if (!Array.isArray(lines) || !lines.length) return;   // 没提取过 / 台词真改了：留 🎧 等点
  if (ttsAssignNpc(lines)) saveSettings();
  const ensured = ttsEnsureBar(mesEl);
  if (ensured) ttsApplyLines(mesEl, ensured, lines, key, true);   // 自动恢复：默认折叠，点 🎧 展开
}

function ttsRenderLines(bar, lines) {
  if (!lines.length) {
    bar.innerHTML = '<span class="sd-tts-status">本条未发现可朗读的台词。</span>';
    return;
  }
  const rows = lines.map((l, i) => {
    const voiced = !!ttsResolveVoice(l.speaker);
    return `
      <div class="sd-tts-line${voiced ? '' : ' sd-tts-novoice'}" data-idx="${i}" data-speaker="${htmlEscape(l.speaker)}" data-text="${htmlEscape(l.text)}" data-emotion="${htmlEscape(l.emotion || 'auto')}"${Number.isFinite(l.speed) ? ` data-speed="${l.speed}"` : ''}>
        <button type="button" class="sd-tts-play" title="${voiced ? '播放（双击设置语速/情绪并重生成）' : '该角色未配置音色'}" ${voiced ? '' : 'disabled'}><i class="fa-solid fa-headphones"></i></button>
        <span class="sd-tts-spk">${htmlEscape(l.speaker)}</span>
        <span class="sd-tts-txt">${htmlEscape(ttsStripPauseMarks(l.text))}</span>
      </div>`;
  }).join('');
  const anyVoiced = lines.some((l) => ttsResolveVoice(l.speaker));
  bar.innerHTML = `
    <div class="sd-tts-lines">${rows}</div>
    ${anyVoiced ? '' : '<div class="sd-tts-bar-actions"><span class="sd-tts-status">未配置任何角色音色，请先配置。</span></div>'}`;
}

// 提取成功后，把外层工具栏的「连续播放/重生语音/停止」钮显隐切换；anyVoiced=false 则不显示
function ttsToggleToolbarPlay(mesEl, show) {
  const tb = mesEl?.querySelector('.sd-tts-toolbar');
  if (!tb) return;
  tb.querySelectorAll('.sd-tts-playall, .sd-tts-regenall').forEach((b) => { b.hidden = !show; });
}

// 清除某条消息正文里已注入的内联 🔊（重新提取前调用）
function ttsClearInlineIcons(mesEl) {
  mesEl.querySelectorAll('.sd-tts-inline').forEach((el) => el.remove());
}

// 正文内联 🔊：把已配音色的台词，在 .mes_text 内对应句尾插入一个小喇叭（与列表共用合成+缓存+快捷窗）。
// 文本匹配：把 .mes_text 全部文本节点拼成全文做定位，再把匹配末尾映射回具体节点/偏移插入——
// 故台词即便被加粗/链接拆到多个节点（末条最常见）也能命中。
function ttsInjectInlineIcons(mesEl, lines) {
  ttsClearInlineIcons(mesEl);
  const textEl = mesEl.querySelector('.mes_text');
  if (!textEl) return;
  // 保留原始下标（与列表项 data-idx 一致），过滤出有音色且有文本的句子
  const voicedLines = lines.map((l, i) => ({ line: l, idx: i })).filter((x) => x.line.text && ttsResolveVoice(x.line.speaker));
  if (!voicedLines.length) return;

  // 标签兜底（防小耳机窜进摘要/状态栏等被排除区域）：内联图标只应落在「提取所见」的正文里。
  // 提取用 ttsCleanText 按 tagRules 过滤（extract 模式=只留某些标签内容 / remove 模式=删某些标签段），
  // 但图标匹配扫的是整个 .mes_text DOM——摘要标签的台词仍在 DOM 里，全文兜底匹配就可能窜过去。
  // 故这里用**同一套 tagRules** 把匹配范围限定到与提取一致的区域。
  // 关键守卫：仅当这些自定义标签**真作为 DOM 元素存在**时才启用范围限制；若 ST 把标签渲成纯文本/结构不同，
  // extractActive 为假 → 不做任何限制（回落旧行为，绝不因探测失败导致全体图标消失）。
  const buildTagScope = () => {
    const rules = (Array.isArray(settings.tts?.tagRules) ? settings.tts.tagRules : [])
      .map((r) => ({ name: String(r.name || '').trim().replace(/^<|>$/g, '').toLowerCase(), action: r.action === 'extract' ? 'extract' : 'remove' }))
      .filter((r) => r.name);
    const extractNames = new Set(rules.filter((r) => r.action === 'extract').map((r) => r.name));
    const removeNames = new Set(rules.filter((r) => r.action === 'remove').map((r) => r.name));
    const hasEl = (names) => {
      for (const n of names) { try { if (textEl.getElementsByTagName(n).length) return true; } catch (_) {} }
      return false;
    };
    return {
      extractNames, removeNames,
      extractActive: extractNames.size > 0 && hasEl(extractNames),   // 只在 extract 标签内匹配
      removeActive: removeNames.size > 0 && hasEl(removeNames),       // 跳过 remove 标签内
    };
  };
  const tagScope = buildTagScope();
  // node 的祖先链（到 textEl 为止）里是否有标签名命中 names
  const inNamedAncestor = (node, names) => {
    let el = node.parentElement;
    while (el && el !== textEl) {
      if (names.has(el.tagName.toLowerCase())) return true;
      el = el.parentElement;
    }
    return false;
  };
  // 收集 .mes_text 下全部文本节点（跳过内联钮内部），拼全文 + 段映射。splitText 不改文本内容，故每句重收一次即可。
  // scoped=true 时额外按 tagRules 限定范围（防小耳机窜进摘要等被排除区域）；但仅作「加分项」——
  // 见下方安全网：若限定后扫出为空（说明 DOM 结构与假设不符，如 ST 把 content 标签渲成了非包裹结构），
  // 自动回落 scoped=false 全量扫，绝不因范围假设失误导致全体图标消失（功能优先于边缘兜底）。
  const collect = (scoped) => {
    const segs = [];
    let full = '';
    const w = document.createTreeWalker(textEl, NodeFilter.SHOW_TEXT, {
      acceptNode: (n) => {
        if (n.parentElement?.closest('.sd-tts-inline')) return NodeFilter.FILTER_REJECT;
        // 跳过 <style>/<script> 内的文本节点：美化模板(如 custom-minimal-timeline-node)带内嵌 CSS，
        // TreeWalker 的 SHOW_TEXT 会把 CSS 文本也收进 full，插在台词字符之间→台词在 full 里不连续→五档全失。
        // 提取路径 ttsCleanText 已 stripHtml 去 style，此处对齐（否则内联匹配所见与提取不一致）。
        if (n.parentElement?.closest('style, script')) return NodeFilter.FILTER_REJECT;
        if (scoped) {
          // extract 模式：只接受在 extract 标签内的文本；remove 模式：拒绝在 remove 标签内的文本
          if (tagScope.extractActive && !inNamedAncestor(n, tagScope.extractNames)) return NodeFilter.FILTER_REJECT;
          if (tagScope.removeActive && inNamedAncestor(n, tagScope.removeNames)) return NodeFilter.FILTER_REJECT;
        }
        return NodeFilter.FILTER_ACCEPT;
      },
    });
    let node;
    while ((node = w.nextNode())) {
      const s = node.nodeValue || '';
      segs.push({ node, start: full.length, end: full.length + s.length });
      full += s;
    }
    return { full, segs };
  };
  // 全文位置 pos → (节点, 节点内偏移)
  const locateNode = (segs, pos) => {
    for (const seg of segs) {
      if (pos > seg.start && pos <= seg.end) return { node: seg.node, offset: pos - seg.start };
    }
    const last = segs[segs.length - 1];
    return last ? { node: last.node, offset: (last.node.nodeValue || '').length } : null;
  };
  // 引号兜底:模型偶尔会让正文与提取文本的引号有出入(嵌套混用/全半角错位/多/少一个),字节级 indexOf 必失。
  // 故第三档把双方所有引号类字符抹掉再找,再用位置映射回原文具体偏移。
  // 字符集只收书面对话常态引号:直/弯双引号、直/弯单引号(双引号内嵌套用)、CJK 角括号两级。
  // 刻意不含【】()及德/法/CJK 罕用变体——前者多用于标签/状态栏,后者书面对话几乎不出现,纳入只增误匹配。
  // ⚠️ 全部用 Unicode 转义,严禁写字面引号:字面弯引号在某些编辑器/shell/编码往返里会被悄悄改成直引号(本 bug 的根因),
  //    而漏掉直引号(U+0022/U+0027)又会让「一侧直引号、一侧弯引号」的对话在去引号归一后仍不相等→字节匹配失败。
  //    收录:直双 U+0022、弯双 U+201C/U+201D、直单 U+0027、弯单 U+2018/U+2019、CJK 角括号两级 U+300C-U+300F。
  const QUOTES = /[\u0022\u201C\u201D\u0027\u2018\u2019\u300C\u300D\u300E\u300F]/g;
  const stripQuotes = (s) => s.replace(QUOTES, '');
  // 归一化 full：返回去引号后的串 + map[i]=去引号串第 i 位在原 full 里的位置（含末位 = full.length，便于落末尾）
  const normalizeWithMap = (s) => {
    let out = '';
    const map = [];
    for (let i = 0; i < s.length; i++) {
      const c = s[i];
      if (QUOTES.test(c)) { QUOTES.lastIndex = 0; continue; }
      QUOTES.lastIndex = 0;
      map.push(i);
      out += c;
    }
    map.push(s.length);
    return { norm: out, map };
  };
  const stripEdges = (s) => s.replace(/^[\s“”"「」『』,，。.!！?？、…—\-]+|[\s“”"「」『』,，。.!！?？、…—\-]+$/g, '');
  // 第四档「深度归一」兜底：模型返回文本常与正文中段差一个空格 / 全角半角标点错位（，↔,、？↔?）/ 多空白，
  // 前三档（精确/去首尾/去引号）都按字节比中段，差一个就全句落空→正文无图标（列表却有，因列表不需定位）。
  // 这一档把双方都「去全部空白 + 去引号 + 全角标点折半角(仅标点·绝不碰正文字)」再找，带位置映射回原文真实下标。
  const PUNCT_FOLD = { '，': ',', '。': '.', '！': '!', '？': '?', '；': ';', '：': ':', '（': '(', '）': ')', '、': ',', '—': '-', '～': '~' };
  const deepNormWithMap = (s) => {
    let out = '';
    const map = [];
    for (let i = 0; i < s.length; i++) {
      let c = s[i];
      if (/\s/.test(c)) continue;                       // 去全部空白
      QUOTES.lastIndex = 0;
      if (QUOTES.test(c)) { QUOTES.lastIndex = 0; continue; }   // 去引号
      if (PUNCT_FOLD[c]) c = PUNCT_FOLD[c];             // 全角标点→半角（仅标点）
      map.push(i);
      out += c;
    }
    map.push(s.length);
    return { norm: out, map };
  };
  const deepNorm = (s) => deepNormWithMap(s).norm;

  let cursor = 0;        // 全文位置游标，逐句前移（提取顺序≈正文顺序时走这条快路）
  const usedStarts = new Set();   // 已落点的起始位，防全文兜底时把同一处重复命中
  // 从 from 起在 full 里找 needle，返回 {start,end} 或 null。五档：1)精确 2)去首尾标点 3)双方去引号+位置回映 4)深度归一(去空白+引号+全角标点折半角)+位置回映 5)尾锚定(合并句兜底)
  const findFrom = (full, needle, from) => {
    let i = full.indexOf(needle, from);
    if (i >= 0) return { start: i, end: i + needle.length, tier: 1 };
    const core = stripEdges(needle);
    if (core.length >= 2 && core !== needle) {
      i = full.indexOf(core, from);
      if (i >= 0) return { start: i, end: i + core.length, tier: 2 };
    }
    const needleNQ = stripQuotes(needle.trim());
    if (needleNQ.length >= 2) {
      const { norm, map } = normalizeWithMap(full);
      let ncursor = 0;
      while (ncursor < map.length - 1 && map[ncursor] < from) ncursor++;
      const ni = norm.indexOf(needleNQ, ncursor);
      if (ni >= 0) return { start: map[Math.min(ni, map.length - 1)], end: map[Math.min(ni + needleNQ.length, map.length - 1)], tier: 3 };
    }
    // 第四档：深度归一（去空白+引号+全角标点折半角）——吃掉「中段差一个空格/全半角标点错位」这类最常见失配
    const needleDeep = deepNorm(needle);
    if (needleDeep.length >= 2) {
      const { norm, map } = deepNormWithMap(full);
      let dcursor = 0;
      while (dcursor < map.length - 1 && map[dcursor] < from) dcursor++;
      const di = norm.indexOf(needleDeep, dcursor);
      if (di >= 0) return { start: map[Math.min(di, map.length - 1)], end: map[Math.min(di + needleDeep.length, map.length - 1)], tier: 4 };
    }
    // 第五档·尾锚定（治「合并台词」）：模型把同一说话人被动作隔开的多段引号拼成一句 → 正文里此串不连续存在，前四档必失。
    // 但那句台词的**最后一段引号内容**在正文里必然连续出现。故取 needle 的「最长连续后缀」——从尽量长开始，
    // 逐字从前端缩短，直到这个后缀在正文里能连续找到为止。这样能自动跳过「横跨动作描写/段落分裂处」的失配
    // （长后缀含中间动作→找不到→缩短→最终缩到真·最后一段引号内容→命中），🔊 落在合并句末尾。
    if (needleDeep.length >= 3) {
      const { norm, map } = deepNormWithMap(full);
      let dcursor = 0;
      while (dcursor < map.length - 1 && map[dcursor] < from) dcursor++;
      const MIN_TAIL = 3;                                  // 后缀至少 3 字（含标点）：合并句末段常是「下来。」这类短句(归一 下来.=3)，4 字门槛会漏
      const MAX_TAIL = Math.min(24, needleDeep.length);    // 上限 24，避免超长串徒劳扫描
      let best = -1, bestLen = 0;
      for (let len = MAX_TAIL; len >= MIN_TAIL; len--) {
        const suf = needleDeep.slice(needleDeep.length - len);
        const si = norm.indexOf(suf, dcursor);
        if (si >= 0) { best = si; bestLen = len; break; }   // 最长可命中后缀即止（长优先→短，precision 不降）
      }
      if (best >= 0) {
        // start 用后缀起点（供 usedStarts 去重）；end 锚到**最后一个命中字的原文位置 +1**（紧贴台词末字之后），
        // 不能用 map[best+bestLen]（那是下一个保留字的位置，跨越了中间的空白/引号/动作→落点会溢出到下一段落或正文末尾，
        // 致🔊另起一段·用户报的合并句末段跨行 bug）。best+bestLen-1 是末字在 norm 的下标，map 回原文再 +1 即紧贴其后。
        const lastCharPos = map[Math.min(best + bestLen - 1, map.length - 1)];
        return { start: map[Math.min(best, map.length - 1)], end: Math.min(lastCharPos + 1, full.length), tier: 5, tailLen: bestLen };
      }
    }
    return null;
  };
  // 安全网：先试范围限定扫一次；限定后若扫出为空（DOM 结构与假设不符），本条消息一律回落全量扫。
  // 只在真有 tagRules 限定意义时才试（否则直接全量），避免每条消息白跑一次限定 collect。
  const wantScope = tagScope.extractActive || tagScope.removeActive;
  const useScoped = wantScope ? (collect(true).full.trim().length > 0) : false;
  for (const { line, idx: lineIdx } of voicedLines) {
    const needle = ttsStripPauseMarks(line.text).trim();   // 去停顿标记再匹配（标记不在正文里，留着必失配）
    if (needle.length < 2) continue;
    const { full, segs } = collect(useScoped);
    // 先从游标前向找（提取顺序==正文顺序时最快、且天然按序去重）；
    // 找不到再从 0 全文兜底——根治「提取顺序≠正文顺序」时靠前的句被游标甩过→正文无图标（列表却有）。
    let hit = findFrom(full, needle, cursor);
    if (!hit || usedStarts.has(hit.start)) {
      let scan = findFrom(full, needle, 0);
      while (scan && usedStarts.has(scan.start)) scan = findFrom(full, needle, scan.end);   // 跳过已用，找下一处
      if (scan) hit = scan;
    }
    if (!hit) {
      // 诊断：5 档全失（同位置确定性丢失时排查真因用）。打出未定位台词 + 渲染后正文片段，
      // 用户复现后把这行发来即可精准定位是正则改写/文本插入/其他，而非再盲加匹配档。
      try { console.warn(`[${MODULE_NAME}] 内联🔊未定位 · 台词="${needle.slice(0, 60)}" · 归一后="${deepNorm(needle).slice(0, 60)}" · 正文归一片段="${deepNorm(full).slice(0, 200)}"`); } catch (_) {}
      continue;   // 五档全失：跳过内联，列表里仍有该句
    }
    usedStarts.add(hit.start);
    let endPos = hit.end;
    // 诊断（命中侧）：打出命中档位 + 落点前后文，用于区分「误配到别处」vs「命中正确但不可见」。
    // 仅第 5 档（尾锚定·合并句兜底，最易误配到叙事里同词）打，避免刷屏；前四档精确度高不记录。
    if (hit.tier === 5) {
      try {
        const ctxStart = Math.max(0, hit.start - 15);
        console.warn(`[${MODULE_NAME}] 内联🔊尾锚定命中(tier5·tail${hit.tailLen}) · 台词="${needle.slice(0, 40)}" · 落点前后文="…${full.slice(ctxStart, hit.end + 5)}…" · start=${hit.start}`);
      } catch (_) {}
    }
    if (hit.start >= cursor) cursor = endPos;   // 仅前向命中才推进游标，保持快路单调
    // 若插入点紧跟着闭合引号（"」'』等），顺势越过去——视觉上挂在台词整体外缘更自然。
    // 但要防「越过引号后跨到下一段落/文本节点」：合并句末段正好在段落末尾时，跳过 」会把落点推到下一段开头→图标另起一段。
    // 故先记原落点所在节点，越引号后若换了节点，回退到原落点（宁可挨着引号内侧，也不跳到下一段）。
    const endNodeBefore = locateNode(segs, endPos)?.node || null;
    let skipped = endPos;
    while (skipped < full.length && QUOTES.test(full[skipped])) { QUOTES.lastIndex = 0; skipped++; }
    QUOTES.lastIndex = 0;
    const skippedNode = locateNode(segs, skipped)?.node || null;
    endPos = (skippedNode === endNodeBefore) ? skipped : endPos;   // 越引号未换节点才采纳；换了则守在原落点
    const at = locateNode(segs, endPos);
    if (!at) continue;
    const target = at.node;
    let after;
    if (at.offset >= (target.nodeValue || '').length) after = target.nextSibling;   // 落在节点末尾
    else after = target.splitText(at.offset);                                        // 节点中间：切开
    const icon = document.createElement('button');
    icon.type = 'button';
    icon.className = 'sd-tts-play sd-tts-inline';
    icon.title = '播放（双击设置语速/情绪并重生成）';
    icon.dataset.idx = String(lineIdx);   // 与列表项同下标，回查缓存 lines 取持久化 override + 同步高亮
    // 自描述兜底：与列表项 .sd-tts-line 一样带 speaker/text/emotion，缓存查不到（key 失配/内存清/重渲染）时也能现搭出正确 line，
    // 不致回落成「未知」→「未配置音色」（内联图标不在 .sd-tts-line 内，解析时 host=图标自身，靠这几个 dataset 兜底）
    icon.dataset.speaker = line.speaker || '未知';
    icon.dataset.text = line.text || '';
    icon.dataset.emotion = line.emotion || 'auto';
    if (Number.isFinite(line.speed)) icon.dataset.speed = String(line.speed);   // 提取注入的语速快照：快捷窗回落 dataset 时也能显出确切值（与情绪同款）
    icon.innerHTML = '<i class="fa-solid fa-headphones"></i>';
    if (after) after.parentNode.insertBefore(icon, after);
    else target.parentNode.appendChild(icon);
  }
  // 在正文最靠前的小喇叭前插「连续播放本条」钮。注意：因有乱序兜底，插入顺序≠DOM 顺序，
  // 故取 DOM 中实际第一个内联图标作锚点（而非最先创建的那个），保证连播钮真在最前。
  const domFirstIcon = textEl.querySelector('.sd-tts-inline');
  if (domFirstIcon) {
    const playAll = document.createElement('button');
    playAll.type = 'button';
    playAll.className = 'sd-tts-inline sd-tts-inline-playall';
    playAll.title = '连续播放本条全部台词';
    playAll.setAttribute('aria-label', '连续播放本条');
    playAll.innerHTML = '<i class="fa-regular fa-circle-play"></i>';
    domFirstIcon.parentNode.insertBefore(playAll, domFirstIcon);
  }
}

// 连续播放本条：先一次性合成全部已配音色台词，全部就绪后再顺序播放（避免边生成边播的卡顿）。
// force=false：命中缓存秒回、仅缺的合成、全缓存则静默；force=true（重生语音）：跳缓存强制重合成全部、写回同 key（连播后续读新缓存）。
// 可被停止/新连播打断；折叠后台词条 hidden 但仍在 DOM，故照常可播。btn 可为外层工具栏钮或正文内联连播钮。
// 全程包 try/finally：任何抛错都复位忙碌态并弹提示，杜绝按钮卡死在 disabled（disabled 按钮不触发点击、也不弹提示）。
async function ttsHandlePlayAll(btn, force = false) {
  const mesEl = btn.closest('.mes');
  const bar = mesEl?.querySelector(`.${TTS_BAR_CLASS}`) || btn.closest(`.${TTS_BAR_CLASS}`);
  if (!bar) { toast('未找到台词条，请先点 🎧 提取。', 'info'); return; }
  const lineEls = Array.from(bar.querySelectorAll('.sd-tts-line:not(.sd-tts-novoice)'));
  if (!lineEls.length) { toast('本条没有可播放的台词。', 'info'); return; }

  ttsStopPlayback(true);             // 停掉旧播放并使其失效（被打断的旧调用经 ttsPlayCleanup 解开 await，自行退出）
  const myToken = ++ttsSeqToken;
  ttsSetPlayingState(mesEl, true);   // 连播/停止钮切到「停止」外观，播放期间可随时点停
  try {
    // 以缓存 lines 为准（含持久化 speed/emotion）；按列表项 data-idx 取对应 line，没缓存则 dataset 兜底
    const key = bar.dataset.key || '';
    const cachedLines = key ? ttsLineCache.get(key) : null;
    const jobs = lineEls.map((el) => {
      const idx = Number(el.dataset.idx);
      let line = (cachedLines && Number.isInteger(idx) && cachedLines[idx]) ? cachedLines[idx] : null;
      if (!line) {
        line = { speaker: el.dataset.speaker || '未知', text: el.dataset.text || '', emotion: el.dataset.emotion || 'auto' };
        if (el.dataset.speed !== undefined && el.dataset.speed !== '') line.speed = Number(el.dataset.speed);   // override 过的语速，缺则回落默认
      }
      return { idx: Number.isInteger(idx) ? idx : -1, line, blob: null };
    });

    // 是否需要弹「配音中」提示：重生语音(force)必弹；否则先探缓存，全命中则静默
    let needSynth = force;
    if (!force) {
      for (const job of jobs) {
        const params = ttsBuildParams(job.line);
        if (!params) continue;
        let hit = false;
        if (blobStore.blobStoreAvailable()) { try { hit = await blobStore.hasAudio(ttsCacheKey(params)); } catch (_) {} }
        if (!hit) { needSynth = true; break; }
      }
    }
    if (myToken !== ttsSeqToken) return;

    // 阶段一：合成全部（force 跳缓存重合成并写回同 key；否则命中缓存秒回。逐条失败不中断）
    if (needSynth) toast(force ? '全部语音重新生成中…' : '全部台词配音中…', 'info');
    let failed = 0, lastErr = '';
    for (const job of jobs) {
      if (myToken !== ttsSeqToken) return;
      try { const { blob } = await ttsSynthCached(job.line, force); job.blob = blob; }
      catch (err) { failed++; lastErr = err?.message || String(err); }
    }
    if (myToken !== ttsSeqToken) return;
    const ready = jobs.filter((j) => j.blob);
    if (!ready.length) { toast(`配音失败（${lastErr || '无可用台词'}）`, 'error'); return; }
    if (needSynth) {
      const okMsg = force ? '全部语音已更新' : '全部配音已交付';
      toast(failed ? `${okMsg}（${failed} 句失败已跳过）` : okMsg, 'success');
    }

    // 阶段二：顺序播放，列表项 + 对应正文内联图标同步高亮
    for (let bi = 0; bi < ready.length; bi++) {
      if (myToken !== ttsSeqToken) break;
      const job = ready[bi];
      await ttsPlayBlob(job.blob, ttsHighlightEls(mesEl, job.idx));
      // 句间留一个舒适的小停顿（不粘连、也不拖沓）；末句后不停；被抢占则不停
      if (bi < ready.length - 1 && myToken === ttsSeqToken) {
        await new Promise((r) => setTimeout(r, TTS_INTERCLIP_GAP_MS));
      }
    }
  } catch (err) {
    toast(`配音失败：${err?.message || err}`, 'error');
  } finally {
    // 仅当本次调用仍是最新（未被新的连播/重生抢占）时才复位播放态——
    // 否则被抢占的旧调用会把新调用刚切上的「停止」外观打回「播放」。被抢占时新调用自己会负责复位。
    if (myToken === ttsSeqToken) ttsSetPlayingState(mesEl, false);
    // 自愈：连播中/后 ST 可能重渲 .mes_text 内部、抹掉内联图标（子树变动·顶层 childList 观察器看不到→不会自动补）。
    // 这里幂等补一次：图标还在则 ttsAutoRestore 内部即返回，被抹了则按缓存重注入。根治「连播后小图标全消失、重进才回」。
    if (mesEl) ttsAutoRestore(mesEl);
  }
}

// 双击单句 → 快捷窗：语速滑块 + 情绪下拉 + 重生成/下载/收藏。改动持久化进 line 对象（跨刷新稳定）。
function ttsOpenQuickPopup(btn) {
  const { mesEl, idx, line } = ttsResolveLineFromBtn(btn);
  ttsCloseQuickPopup();
  const curSpeed = Number.isFinite(line.speed) ? line.speed : Number(settings.tts?.defaultSpeed ?? 1);
  const curEmotion = (line.emotion && line.emotion !== 'auto') ? line.emotion : 'auto';
  const emotions = ['auto', 'happy', 'sad', 'angry', 'fearful', 'disgusted', 'surprised', 'calm', 'fluent', 'whisper'];
  const emoLabel = { auto: '自动 (auto)', happy: '高兴 (happy)', sad: '悲伤 (sad)', angry: '愤怒 (angry)', fearful: '害怕 (fearful)', disgusted: '厌恶 (disgusted)', surprised: '惊讶 (surprised)', calm: '中性 (calm)', fluent: '生动 (fluent)', whisper: '低语 (whisper)' };
  // 当前模型：whisper 仅 2.6、fluent 仅 2.6/2.8。不支持的情绪直接不显示在列表里（而非置灰），列表更干净。
  const curModel = MINIMAX_MODELS.includes(settings.tts?.model) ? settings.tts.model : 'speech-2.8-hd';
  const emoOptions = emotions
    .filter((em) => emotionAllowedForModel(em, curModel))
    .map((em) => `<option value="${em}" ${em === curEmotion ? 'selected' : ''}>${emoLabel[em]}</option>`)
    .join('');
  const pop = document.createElement('div');
  pop.className = `sd-tts-popup sd-theme-${THEME_KEYS.includes(settings.theme) ? settings.theme : 'light'}`;
  pop.innerHTML = `
    <div class="sd-tts-popup-row"><span>语速</span><input type="range" class="sd-tts-pop-speed" min="0.5" max="2" step="0.05" value="${curSpeed}"><b class="sd-tts-pop-speed-val">${curSpeed.toFixed(2)}</b></div>
    <div class="sd-tts-popup-row"><span>情绪</span><select class="sd-tts-pop-emotion">${emoOptions}</select></div>
    <div class="sd-tts-popup-actions">
      <button type="button" class="sd-tts-pop-icon sd-tts-pop-regen" title="按当前语速/情绪重新生成并播放"><i class="fa-solid fa-rotate"></i></button>
      <button type="button" class="sd-tts-pop-icon sd-tts-pop-download" title="下载这句"><i class="fa-solid fa-download"></i></button>
      <button type="button" class="sd-tts-pop-icon sd-tts-pop-fav" title="收藏这句"><i class="fa-solid fa-star"></i></button>
    </div>`;
  document.body.appendChild(pop);
  ttsPopupEl = pop;
  // 定位到按钮下方
  const r = btn.getBoundingClientRect();
  pop.style.left = `${Math.min(window.innerWidth - pop.offsetWidth - 8, Math.max(8, r.left))}px`;
  pop.style.top = `${Math.min(window.innerHeight - pop.offsetHeight - 8, r.bottom + 6)}px`;

  const speedEl = pop.querySelector('.sd-tts-pop-speed');
  const speedVal = pop.querySelector('.sd-tts-pop-speed-val');
  speedEl.addEventListener('input', () => { speedVal.textContent = Number(speedEl.value).toFixed(2); });
  // 读快捷窗当前控件 → 写入 line 对象并落盘（持久化，单击播放/连播/刷新后都沿用同一份）
  const applyOverride = () => {
    const patch = { speed: Number(speedEl.value), emotion: pop.querySelector('.sd-tts-pop-emotion').value };
    Object.assign(line, patch);                       // 即时生效（缓存同引用）
    const canon = ttsPersistLineOverride(mesEl, idx, patch);   // 落盘并坐实到「后续点击会读到的同一份」对象
    ttsSyncLineDataset(mesEl, idx, canon || line);    // 同步 DOM 数据集，缓存全失时字面兜底也能算出含 override 的正确 key
    return patch;
  };
  pop.querySelector('.sd-tts-pop-regen')?.addEventListener('click', async () => {
    applyOverride();
    ttsCloseQuickPopup();
    await ttsPlayResolvedLine(line, mesEl, idx, btn, true);   // force 跳缓存按新参数重生成并自动播放
  });
  pop.querySelector('.sd-tts-pop-download')?.addEventListener('click', async (ev) => {
    applyOverride();
    await ttsDownloadLine(line, ev.currentTarget);
  });
  pop.querySelector('.sd-tts-pop-fav')?.addEventListener('click', async (ev) => {
    applyOverride();
    await ttsFavoriteLine(line, ev.currentTarget);
  });
  // 点外部关闭
  setTimeout(() => document.addEventListener('pointerdown', ttsPopupOutside, { capture: true }), 0);
}

// 文件名净化：取说话人+台词前段，去非法字符
function ttsSafeName(speaker, text) {
  const base = `${speaker || '台词'}-${String(text || '').slice(0, 16)}`;
  return base.replace(/[\\/:*?"<>|\n\r\t]+/g, '_').slice(0, 48) || '台词';
}

// 下载单句：合成(走缓存)→导出 blob
async function ttsDownloadLine(line, btn) {
  const icon = btn?.querySelector('i');
  const prev = icon?.className;
  if (icon) icon.className = 'fa-solid fa-spinner fa-spin';
  try {
    const { blob, params } = await ttsSynthCached(line, false);
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${ttsSafeName(line.speaker, line.text)}.${params.format || 'mp3'}`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    toast('已下载。', 'success');
  } catch (err) {
    toast(`下载失败：${err?.message || err}`, 'error');
  } finally {
    if (icon && prev) icon.className = prev;
  }
}

// 收藏单句：合成(走缓存)→存 IndexedDB 收藏 store
async function ttsFavoriteLine(line, btn) {
  if (!blobStore.blobStoreAvailable()) { toast('当前环境不支持本地收藏。', 'warning'); return; }
  const icon = btn?.querySelector('i');
  const prev = icon?.className;
  if (icon) icon.className = 'fa-solid fa-spinner fa-spin';
  try {
    const { blob, params } = await ttsSynthCached(line, false);
    const favId = `fav:${ttsCacheKey(params)}`;
    await blobStore.addFavorite(favId, blob, { speaker: line.speaker, text: line.text, format: params.format || 'mp3' }, line.text);
    toast('已收藏。', 'success');
  } catch (err) {
    toast(`收藏失败：${err?.message || err}`, 'error');
  } finally {
    if (icon && prev) icon.className = prev;
  }
}
function ttsPopupOutside(e) {
  if (ttsPopupEl && !ttsPopupEl.contains(e.target)) ttsCloseQuickPopup();
}
function ttsCloseQuickPopup() {
  document.removeEventListener('pointerdown', ttsPopupOutside, { capture: true });
  if (ttsPopupEl) { ttsPopupEl.remove(); ttsPopupEl = null; }
}

// 启停 #chat 注入（总开关/注入开关变化、切聊天时调用）
function ttsStartChat() {
  const t = settings.tts || {};
  if (!t.enabled || !t.injectInChat) { ttsStopChat(); return; }
  const chat = document.getElementById('chat');
  if (!chat) return;   // ST 尚未就绪，留待 MESSAGE_RECEIVED/CHAT_CHANGED 再触发
  if (!ttsChatBound) {
    chat.addEventListener('click', ttsOnChatClick);
    ttsChatObserver = new MutationObserver(() => ttsScanDebounced());
    ttsChatObserver.observe(chat, { childList: true });   // 只看顶层 childList，极轻
    ttsChatBound = true;
  }
  ttsScanMessages();
  // 首扫可能早于 ST 注水聊天元数据（ttsLines），自动恢复查不到；延迟再扫一次兜底，让缓存「进聊天即加载」。
  ttsScanDebounced(400);
}
function ttsStopChat() {
  if (!ttsChatBound) return;
  if (ttsScanTimer) { clearTimeout(ttsScanTimer); ttsScanTimer = null; }
  const chat = document.getElementById('chat');
  chat?.removeEventListener('click', ttsOnChatClick);
  ttsChatObserver?.disconnect();
  ttsChatObserver = null;
  ttsChatBound = false;
  ttsStopPlayback(true);
  ttsCloseQuickPopup();
  document.querySelectorAll('.sd-tts-toolbar').forEach((el) => el.remove());
  document.querySelectorAll('.sd-tts-inline').forEach((el) => el.remove());
  document.querySelectorAll(`.${TTS_BAR_CLASS}`).forEach((el) => el.remove());
  document.querySelectorAll('.mes[data-sd-tts-hooked]').forEach((el) => { delete el.dataset.sdTtsHooked; });
}

function renderPlugTab() {
  const isExternal = settings.providerMode === 'external';
  const logs = Array.isArray(settings.logHistory) ? settings.logHistory : [];
  const models = uniqueClean([settings.model, ...(settings.availableModels || [])]);
  const profiles = Array.isArray(settings.apiProfiles) ? settings.apiProfiles : [];
  return `
    <section class="sd-card">
      <h3>模型来源</h3>
      <div class="sd-source-pick">
        <label class="sd-source-opt ${isExternal ? 'active' : ''}"><input type="radio" name="sd-provider" value="external" ${isExternal ? 'checked' : ''}><span class="sd-source-dot"></span>OpenAI（自定义）</label>
        <label class="sd-source-opt ${!isExternal ? 'active' : ''}"><input type="radio" name="sd-provider" value="sillytavern" ${!isExternal ? 'checked' : ''}><span class="sd-source-dot"></span>使用SillyTavern当前API设置</label>
      </div>
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
      <label>最大输出 token</label><input class="text_pole sd-max-output" type="number" min="0" step="256" placeholder="0 表示不限" value="${htmlEscape(settings.maxOutputTokens ?? 32000)}">
      <label>上下文长度</label><input class="text_pole sd-context-budget" type="number" min="0" step="1000" placeholder="0 表示不限" value="${htmlEscape(settings.contextBudget ?? 1000000)}">
      <div class="sd-button-row"><button class="sd-btn sd-test-api"><i class="fa-solid fa-plug-circle-check"></i>测试连接</button><button class="sd-btn sd-save-api">保存API</button><button class="sd-btn sd-save-api-profile">保存为预设</button></div>
    </section>
    <section class="sd-card">
      <div class="sd-toggle-row">
        <label class="checkbox_label"><input type="checkbox" class="sd-stream-toggle" ${settings.streamEnabled ? 'checked' : ''}> 流式传输</label>
        <label class="checkbox_label"><input type="checkbox" class="sd-float-toggle" ${settings.floatingButton ? 'checked' : ''}> 显示悬浮球</label>
      </div>
      <p class="sd-muted sd-hint-sm">仅支持自定义API</p>
    </section>
    <section class="sd-card">
      <h3>日志</h3>
      <p class="sd-muted">保留最近 ${LOG_LIMIT} 次生成记录。</p>
      ${logs.length ? `<div class="sd-log-list">${logs.map((log, i) => renderLogEntry(log, i)).join('')}</div>` : '<p class="sd-muted">暂无日志。</p>'}
    </section>
    <section class="sd-card">
      <h3>配置备份</h3>
      <p class="sd-muted">导出千幕的全部本地配置，导入将覆盖当前配置。</p>
      <div class="sd-button-row">
        <button class="sd-btn sd-export-config"><i class="fa-solid fa-file-export"></i>导出配置</button>
        <button class="sd-btn sd-import-config"><i class="fa-solid fa-file-import"></i>导入配置</button>
        <input type="file" class="sd-import-config-file" accept="application/json,.json" hidden>
      </div>
    </section>`;
}

function updateInjectDock(root = document) {
  const dockButton = root.querySelector?.('.sd-inject-selected');
  if (!dockButton) return;
  const count = injectSelection.size;   // 跨界面合计：以选择集为准，不依赖当前页 DOM
  const span = dockButton.querySelector('span');
  if (span) span.textContent = String(count);
  dockButton.disabled = count === 0;
}

function bindActiveTabEvents(root) {
  // 行内全屏编辑视图：返回 / 保存（保存直写数据模型，再退回原标签）
  if (editorView) {
    root.querySelector('.sd-editor-back')?.addEventListener('click', closeEditorView);
    root.querySelector('.sd-editor-save')?.addEventListener('click', async () => {
      const val = root.querySelector('.sd-editor-area')?.value ?? '';
      await commitEditorValue(editorView.target, val);
      editorView = null;
      renderModal();
      const body = document.getElementById(MODAL_ID)?.querySelector('.sd-body');
      if (body && ttsEditorReturnScroll != null) body.scrollTop = ttsEditorReturnScroll;
      ttsEditorReturnScroll = null;
      toast('已保存。', 'success');
    });
    return; // 编辑视图独占界面，不再绑定其余标签事件
  }
  bindTheaterTabEvents(root);
  bindGeopoliticsTabEvents(root);
  bindTtsTabEvents(root);
  bindCoreadTabEvents(root);
  // 展开编辑：把目标 textarea 拉进行内全屏编辑视图，保存时按 target 直写数据模型
  root.querySelectorAll('.sd-expand-editor').forEach((el) => el.addEventListener('click', (e) => {
    e.preventDefault(); e.stopPropagation();   // 按钮可能位于 <summary> 内，阻止顺带折叠
    const ta = root.querySelector(`.${el.dataset.target}`);
    if (!ta) return;
    openTextEditor({
      target: el.dataset.target,
      title: el.dataset.title || '编辑',
      value: ta.value,
      placeholder: ta.placeholder || '',
    });
  }));
  root.querySelectorAll('.sd-generate-main').forEach((el) => el.addEventListener('click', () => {
    if (busy) stopGeneration();
    else generateDirectorPlan();
  }));
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
    const yes = await confirmDialog('清空当前推演', '将彻底清除当前推演结果与暗线注入，也不会并入下次推演提示词，可随时从历史重新载入。确认清空？');
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
  root.querySelectorAll('.sd-count-tag').forEach((el) => el.addEventListener('click', () => { activeTab = el.dataset.jump; renderModal(); }));
  // 尘寰群生：浮现舞台 ⇄ 完整台本列表
  root.querySelector('.sd-chatter-toggle')?.addEventListener('click', () => { chatterExpanded = !chatterExpanded; renderModal(); });
  // 活幕·伏笔显影卡：钉住 / 唤醒 / 归档
  // 钉住与唤醒不重排行（列表按 origin 固定），故走定点 DOM 更新，避免整屏 renderModal 造成界面闪烁
  root.querySelectorAll('.sd-thread-pin').forEach((el) => el.addEventListener('click', async () => {
    const t = (getChatStore().threads || []).find((x) => x.id === el.dataset.id);
    if (!t) return;
    t.pinned = !t.pinned;
    if (t.pinned && t.status === 'dormant') { t.status = 'active'; t.silentRounds = 0; }
    // —— 就地更新此行视觉，不重绘 ——
    const row = el.closest('.sd-thread-row');
    el.classList.toggle('sd-thread-pin-on', t.pinned);
    el.setAttribute('aria-pressed', t.pinned ? 'true' : 'false');
    el.title = t.pinned ? '已钉住，点击取消' : '钉住（重点追踪，不被自动归档）';
    const icon = el.querySelector('i');
    if (icon) icon.className = `fa-${t.pinned ? 'solid' : 'regular'} fa-thumbtack`;
    if (row) {
      row.classList.toggle('sd-thread-pinned', t.pinned);
      if (t.status === 'active') {
        row.classList.remove('sd-thread-dormant');
        const stage = row.querySelector('.sd-thread-stage');
        if (stage) stage.textContent = t.stage;
        row.querySelector('.sd-thread-wake')?.remove();
      }
    }
    await saveMetadata();
    await applyDirectorInjection();
  }));
  root.querySelectorAll('.sd-thread-wake').forEach((el) => el.addEventListener('click', async () => {
    const t = (getChatStore().threads || []).find((x) => x.id === el.dataset.id);
    if (!t) return;
    t.status = 'active';
    t.silentRounds = 0;
    // —— 就地更新此行视觉，不重绘 ——
    const row = el.closest('.sd-thread-row');
    if (row) {
      row.classList.remove('sd-thread-dormant');
      const stage = row.querySelector('.sd-thread-stage');
      if (stage) stage.textContent = t.stage;
    }
    el.remove();
    await saveMetadata();
    await applyDirectorInjection();
    toast('已唤醒这条伏笔，下次推演将重新追踪。', 'success');
  }));
  root.querySelectorAll('.sd-thread-close').forEach((el) => el.addEventListener('click', async () => {
    const t = (getChatStore().threads || []).find((x) => x.id === el.dataset.id);
    if (!t) return;
    const yes = await confirmDialog('归档伏笔', `确认将「${snip(t.title, 20)}」归档？归档后不再注入，可在「已落幕」中回看。`);
    if (!yes) return;
    t.status = 'closed';
    t.pinned = false;
    await saveMetadata();
    await applyDirectorInjection();
    toast('已归档。', 'success');
    renderModal();
  }));
  root.querySelectorAll('.sd-thread-purge').forEach((el) => el.addEventListener('click', async () => {
    const store = getChatStore();
    const t = (store.threads || []).find((x) => x.id === el.dataset.id);
    if (!t) return;
    const yes = await confirmDialog('彻底删除', `将「${snip(t.title, 20)}」从档案中永久删除？此操作不可撤销。`);
    if (!yes) return;
    store.threads = (store.threads || []).filter((x) => x.id !== el.dataset.id);
    await saveMetadata();
    toast('已删除。', 'success');
    renderModal();
  }));
  // 伏笔一键清空：伏笔是跨幕活档案、独立于扫帚（扫帚只管推演结果），故单独提供清空入口
  root.querySelector('.sd-threads-clear')?.addEventListener('click', async (e) => {
    e.preventDefault(); e.stopPropagation();   // 按钮在 summary 内，拦掉折叠开合
    const store = getChatStore();
    const n = (store.threads || []).length;
    if (!n) return;
    const yes = await confirmDialog('清空伏笔', `将清空全部 ${n} 条伏笔（含在演与已落幕），此操作不可撤销。确认清空？`);
    if (!yes) return;
    store.threads = [];
    await saveMetadata();
    await applyDirectorInjection();   // 伏笔参与注入，清空后同步刷新注入
    toast('伏笔已清空。', 'success');
    renderModal();
  });
  root.querySelectorAll('.sd-load-history').forEach((el) => el.addEventListener('click', async () => {
    const record = (getChatStore().history || []).find((x) => x.id === el.dataset.id);
    if (!record?.plan) return;
    const restored = clone(record.plan);
    // 防御：旧版历史快照可能残留活档案字段（factions/伏笔等）。载入只回滚推演方案，绝不让世界格局/伏笔随之复活，
    // 否则旧 factions 会经【上次审片状态】喂回模型、复刻旧格局（与扫帚清空的语义冲突）。
    delete restored.factions; delete restored.faction_relations; delete restored.world_events; delete restored.threads;
    getChatStore().plan = restored;
    getChatStore().updatedAt = record.createdAt || new Date().toISOString();
    injectSelection.clear();
    await saveMetadata();
    await applyDirectorInjection();
    toast('已载入历史记录。', 'success');
    renderModal();
  }));
  root.querySelectorAll('.sd-delete-history').forEach((el) => el.addEventListener('click', async () => {
    const store = getChatStore();
    // 删除历史记录只移除该条日志，绝不连带清空当前推演（清空交由扫帚按钮）
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
  // 写入勾选持久化——勾选状态存入 injectSelection，重渲染/切主题不丢失
  root.querySelectorAll('.sd-select-inject').forEach((el) => {
    el.addEventListener('click', (event) => event.stopPropagation());
    el.addEventListener('change', () => {
      // 跨界面合计：勾选写入选择集（Map 保留先后顺序），取消则移除
      if (el.checked) injectSelection.set(el.dataset.id, el.dataset.text || '');
      else injectSelection.delete(el.dataset.id);
      updateInjectDock(root);
    });
  });
  root.querySelector('.sd-inject-selected')?.addEventListener('click', () => {
    // 按勾选先后顺序合计写入（含其它标签页中已选、当前未渲染的条目）
    const texts = Array.from(injectSelection.values()).map((t) => String(t || '')).filter(Boolean);
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
  root.querySelector('.sd-restore-blueprint')?.addEventListener('click', async () => {
    const store = getChatStore();
    if (!store.blueprintBackup) { toast('没有可恢复的上一份剧本。', 'info'); return; }
    const yes = await confirmDialog('恢复上次剧本', '将当前剧本替换为更新前你上一次使用的那一份？当前内容会被覆盖。');
    if (!yes) return;
    store.blueprint = store.blueprintBackup;
    store.blueprintBackup = null;
    store.blueprintEdited = true;
    await saveMetadata();
    toast('已恢复上一份剧本。', 'success');
    renderModal();
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
    onBatchDelete: async () => {
      if (!templateExportSelection.size) return toast('请先勾选要删除的剧本。', 'warning');
      const yes = await confirmDialog('批量删除', `确认删除选中的 ${templateExportSelection.size} 个剧本？`);
      if (!yes) return;
      settings.templates = (settings.templates || []).filter((x) => !templateExportSelection.has(x.id));
      ctx().extensionSettings[MODULE_NAME].templates = settings.templates;
      templateExportSelection.clear();
      templateExportMode = false;
      saveSettings();
      toast('已删除。', 'success');
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
    // 勾选时顺带把它作为下方查看项；取消时若取消的正是当前查看项，则清空查看
    if (el.checked) lastWorldView = el.dataset.name;
    else if (lastWorldView === el.dataset.name) lastWorldView = '';
    renderModal();
  }));
  root.querySelectorAll('.sd-world-name').forEach((el) => el.addEventListener('click', async () => {
    // 点书名只切换下方查看的条目，不改变选中状态
    const name = el.dataset.name;
    if (!contextScanCache.worldBooks?.[name]) {
      contextScanCache.worldBooks[name] = await getWorldBookEntries(name);
    }
    lastWorldView = name;
    renderModal();
  }));
  root.querySelectorAll('.sd-world-global').forEach((el) => el.addEventListener('click', async (event) => {
    event.stopPropagation();
    const name = el.dataset.name;
    const turnOn = !isWorldBookGlobal(name);
    setWorldBookGlobal(name, turnOn);
    if (turnOn) {
      // 设为全局时清掉本聊天可能存在的显式取消，并确保已扫描其条目
      const nameStore = getWorldNameStore();
      if (nameStore[name] === false) delete nameStore[name];
      if (!contextScanCache.worldBooks?.[name]) contextScanCache.worldBooks[name] = await getWorldBookEntries(name);
      initializeSelectedContextState(contextScanCache);
      saveSettings();
    }
    toast(turnOn ? `「${name}」已设为全局，所有聊天默认引用。` : `「${name}」已取消全局。`, 'info');
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
  root.querySelector('.sd-livestage-enabled')?.addEventListener('change', async (e) => {
    settings.liveStageEnabled = !!e.target.checked;
    saveSettings();
    await applyDirectorInjection();
    toast(settings.liveStageEnabled ? '伏笔显影已开启：下次推演起，暗线将跨幕承接。' : '伏笔显影已关闭。', 'info');
    renderModal();
  });
  root.querySelector('.sd-worldchatter-enabled')?.addEventListener('change', (e) => {
    settings.worldChatterEnabled = !!e.target.checked;
    saveSettings();
    toast(settings.worldChatterEnabled ? '尘寰群生已开启。' : '尘寰群生已关闭。', 'info');
  });
  root.querySelector('.sd-geopolitics-enabled')?.addEventListener('change', async (e) => {
    settings.geopoliticsEnabled = !!e.target.checked;
    if (!settings.geopoliticsEnabled && activeTab === 'geopolitics') activeTab = 'settings';   // 关掉时若正停在「世界格局」页，退回幕后
    saveSettings();
    await applyDirectorInjection();
    toast(settings.geopoliticsEnabled ? '世界格局已开启：下次推演起，势力格局与世界事件将跨幕演进。' : '世界格局已关闭。', 'info');
    renderModal();
  });
  root.querySelectorAll('.sd-inject-section-toggle').forEach((el) => el.addEventListener('change', async () => {
    settings.injectSections ||= {};
    settings.injectSections[el.dataset.key] = el.checked;
    saveSettings();
    await applyDirectorInjection();
    if (activeTab === 'settings') renderModal();
  }));
  // 自动推演开关：即时保存并弹 ST 提示，无需再点「保存幕后」（与暗线注入等开关一致的即时反馈）
  root.querySelector('.sd-auto-refresh')?.addEventListener('change', (e) => {
    settings.autoRefresh = !!e.target.checked;
    getChatStore().lastPlanIdx = lastChatIdx();   // 从当前层重新起算，开启那一刻不把已有楼层算进去
    saveMetadata();
    saveSettings();
    toast(settings.autoRefresh ? `自动推演已开启。` : '自动推演已关闭。', 'info');
  });
  root.querySelector('.sd-auto-every')?.addEventListener('change', (e) => {
    settings.autoRefreshEvery = Math.max(2, Math.min(50, Number(e.target.value || 10)));
    e.target.value = settings.autoRefreshEvery;
    getChatStore().lastPlanIdx = lastChatIdx();
    saveMetadata();
    saveSettings();
    if (settings.autoRefresh) toast(`已设为每 ${settings.autoRefreshEvery} 层角色回复自动推演。`, 'info');
  });
  root.querySelector('.sd-save-director-settings')?.addEventListener('click', async () => {
    settings.autoRefresh = !!root.querySelector('.sd-auto-refresh')?.checked;
    settings.autoRefreshEvery = Math.max(2, Math.min(50, Number(root.querySelector('.sd-auto-every')?.value || 10)));
    settings.injectEnabled = !!root.querySelector('.sd-inject-enabled')?.checked;
    settings.injectDepth = Math.max(0, Math.min(20, Number(root.querySelector('.sd-inject-depth')?.value ?? 2)));
    if (root.querySelector('.sd-livestage-enabled')) settings.liveStageEnabled = !!root.querySelector('.sd-livestage-enabled').checked;
    if (root.querySelector('.sd-worldchatter-enabled')) settings.worldChatterEnabled = !!root.querySelector('.sd-worldchatter-enabled').checked;
    if (root.querySelector('.sd-geopolitics-enabled')) settings.geopoliticsEnabled = !!root.querySelector('.sd-geopolitics-enabled').checked;
    settings.systemPrompt = root.querySelector('.sd-system-prompt')?.value || DEFAULT_SYSTEM_PROMPT;
    settings.outputSchemaText = root.querySelector('.sd-output-schema')?.value || JSON_SCHEMA_TEXT;
    // 与默认一致存哈希（未改动，随迭代更新），不一致清空（已 DIY，保留记忆）
    settings.systemPromptHash = settings.systemPrompt === DEFAULT_SYSTEM_PROMPT ? hashText(DEFAULT_SYSTEM_PROMPT) : '';
    settings.outputSchemaHash = settings.outputSchemaText === JSON_SCHEMA_TEXT ? hashText(JSON_SCHEMA_TEXT) : '';
    saveSettings();
    await applyDirectorInjection();
    toast('设置已保存。', 'success');
  });
  root.querySelector('.sd-restore-system')?.addEventListener('click', async () => {
    if (!settings.systemPromptBackup && !settings.outputSchemaBackup) { toast('没有可恢复的上一份幕后设置。', 'info'); return; }
    const yes = await confirmDialog('恢复上次幕后', '将幕后提示词与输出格式替换为更新前你上一次使用的那一份？当前内容会被覆盖。');
    if (!yes) return;
    if (settings.systemPromptBackup) { settings.systemPrompt = settings.systemPromptBackup; settings.systemPromptBackup = null; }
    if (settings.outputSchemaBackup) { settings.outputSchemaText = settings.outputSchemaBackup; settings.outputSchemaBackup = null; }
    settings.systemPromptHash = settings.systemPrompt === DEFAULT_SYSTEM_PROMPT ? hashText(DEFAULT_SYSTEM_PROMPT) : '';
    settings.outputSchemaHash = settings.outputSchemaText === JSON_SCHEMA_TEXT ? hashText(JSON_SCHEMA_TEXT) : '';
    saveSettings();
    await applyDirectorInjection();
    toast('已恢复上一份幕后设置。', 'success');
    renderModal();
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
    settings.maxOutputTokens = Math.max(0, Number(root.querySelector('.sd-max-output')?.value || 0));
    settings.contextBudget = Math.max(0, Number(root.querySelector('.sd-context-budget')?.value || 0));
    saveSettings();
    toast('API已保存。', 'success');
  });
  root.querySelector('.sd-export-config')?.addEventListener('click', exportConfig);
  root.querySelector('.sd-import-config')?.addEventListener('click', () => root.querySelector('.sd-import-config-file')?.click());
  root.querySelector('.sd-import-config-file')?.addEventListener('change', importConfig);
  root.querySelector('.sd-test-api')?.addEventListener('click', async (e) => {
    const btn = e.currentTarget;
    const apiUrl = root.querySelector('.sd-api-url')?.value || '';
    const apiKey = root.querySelector('.sd-api-key')?.value || '';
    const model = root.querySelector('.sd-model-select')?.value || '';
    const base = normalizeUrl(apiUrl);
    if (!(base && apiKey && model)) { toast('请先填写 API URL、Key 与模型。', 'warning'); return; }
    btn.disabled = true;
    const icon = btn.querySelector('i');
    const prevIcon = icon?.className;
    if (icon) icon.className = 'fa-solid fa-spinner fa-spin';
    try {
      const res = await fetch(`${base}/v1/chat/completions`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ model, messages: [{ role: 'user', content: 'ping' }], max_tokens: 1, stream: false }),
      });
      if (res.ok) {
        toast('连接成功', 'success');
      } else {
        const text = await res.text().catch(() => '');
        toast(`连接失败：HTTP ${res.status}${text ? ` · ${text.slice(0, 120)}` : ''}`, 'error');
      }
    } catch (err) {
      toast(`连接失败：${err?.message || err}`, 'error');
    } finally {
      btn.disabled = false;
      if (icon && prevIcon) icon.className = prevIcon;
    }
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
  if (context.Popup?.show?.confirm) {
    // Popup 可用：以其结果为准。被取消时部分 ST 版本会 reject，视作「否」，不再兜底原生弹窗（否则会二次弹出）
    try {
      const result = await context.Popup.show.confirm(title, text);
      if (result === true) return true;
      const value = String(result).toLowerCase();
      return ['true', 'ok', 'yes', 'confirm', 'confirmed', 'affirmative', '1'].some((x) => value.includes(x));
    } catch (_) {
      return false;
    }
  }
  return globalThis.confirm(`${title}\n${text}`);
}

// 导入同名冲突弹窗：返回 { action: 'overwrite'|'skip', all: bool } 或 null（取消整次导入）
async function importConflictDialog(names, single = false) {
  const context = ctx();
  const Popup = context.Popup;
  const count = names.length;
  const preview = single
    ? `「${names[0]}」`
    : names.slice(0, 8).map((n) => `「${n}」`).join('、') + (count > 8 ? ` 等 ${count} 项` : '');
  if (Popup && context.POPUP_TYPE) {
    const wrap = document.createElement('div');
    wrap.className = 'sd-conflict-form';
    const head = single
      ? `<p style="text-align:left;margin:0 0 8px">已存在同名条目：${htmlEscape(preview)}</p>`
      : `<p style="text-align:left;margin:0 0 8px">检测到 ${count} 个同名条目：${htmlEscape(preview)}</p>`;
    wrap.innerHTML = `
      ${head}
      <p style="text-align:left;margin:0 0 10px;color:var(--sd-muted);font-size:.9em">覆盖将更新为导入内容，跳过则保留现有条目。</p>
      <label style="display:flex;align-items:center;gap:6px;text-align:left;margin:0"><input type="checkbox" class="sd-conflict-all"${single ? '' : ' checked'}> 对${single ? '剩余' : '全部'}同名条目应用同一选择</label>`;
    try {
      const popup = new Popup(wrap, context.POPUP_TYPE.TEXT, '', {
        okButton: '覆盖', cancelButton: '取消',
        customButtons: [{ text: '跳过', result: 2 }],
      });
      const result = await popup.show();
      const all = !!wrap.querySelector('.sd-conflict-all')?.checked;
      if (result === 1 || result === true) return { action: 'overwrite', all };
      if (result === 2) return { action: 'skip', all };
      return null;
    } catch (_) {
      return null;
    }
  }
  const ok = globalThis.confirm(`${single ? '已存在同名条目' : `检测到 ${count} 个同名条目`}：${preview}\n\n确定=覆盖，取消=跳过`);
  return { action: ok ? 'overwrite' : 'skip', all: true };
}

// 解析所有同名冲突：返回 Map<name, 'overwrite'|'skip'>；取消整次导入返回 null
async function resolveImportConflicts(names) {
  const decisions = new Map();
  if (!names.length) return decisions;
  // 先弹一次总览，勾选「全部应用」则一锤定音
  const first = await importConflictDialog(names);
  if (first === null) return null;
  if (first.all) {
    names.forEach((n) => decisions.set(n, first.action));
    return decisions;
  }
  // 未勾选全部：第一项用本次选择，其余逐项询问（可中途勾选「剩余全部应用」）
  decisions.set(names[0], first.action);
  for (let i = 1; i < names.length; i++) {
    const choice = await importConflictDialog(names.slice(i), true);
    if (choice === null) return null;
    if (choice.all) {
      for (let j = i; j < names.length; j++) decisions.set(names[j], choice.action);
      break;
    }
    decisions.set(names[i], choice.action);
  }
  return decisions;
}
const API_CONFIG_KEYS = ['apiUrl', 'apiKey', 'model', 'availableModels', 'apiProfiles', 'providerMode'];

async function exportConfig() {
  const includeApi = await confirmDialog('导出配置', '是否一并导出API配置？');
  const snapshot = clone(settings);
  if (!includeApi) {
    for (const key of API_CONFIG_KEYS) delete snapshot[key];
  }
  const payload = { version: 1, type: 'qianmu-config', includeApi, exportedAt: new Date().toISOString(), settings: snapshot };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `qianmu-config-${fileStamp()}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
  toast(includeApi ? '配置已导出（含 API）。' : '配置已导出（不含 API）。', 'success');
}

async function importConfig(event) {
  const file = event.target.files?.[0];
  if (!file) return;
  event.target.value = '';
  let incoming;
  try {
    const data = JSON.parse(await file.text());
    incoming = data?.settings && typeof data.settings === 'object' ? data.settings : null;
    if (!incoming || data.type !== 'qianmu-config') throw new Error('格式不符');
  } catch (_) {
    return toast('导入失败：不是有效的千幕配置文件。', 'error');
  }
  const yes = await confirmDialog('导入配置', '导入将覆盖当前全部本地配置，此操作不可撤销，确认导入？');
  if (!yes) return;
  const context = ctx();
  const extensionSettings = context.extensionSettings || (context.extensionSettings = {});
  // 覆盖式导入：以导入内容为准，再用 mergeDefaults 递归补齐缺失字段（含嵌套对象的新增默认）。
  // 旧版本导出的配置可能缺 injectSections / theater / contextOptions 里新增的嵌套字段，浅层 Object.assign 会整体替换、丢掉这些新默认；
  // mergeDefaults 只在键缺失时填默认、对嵌套 plain object 递归，故导入内容里已有的值保留、新版新增字段用默认补上。
  const merged = clone(incoming);
  mergeDefaults(merged, DEFAULT_SETTINGS);
  const hasApi = API_CONFIG_KEYS.some((key) => typeof incoming[key] !== 'undefined');
  if (!hasApi) {
    for (const key of API_CONFIG_KEYS) merged[key] = settings[key];
  }
  extensionSettings[MODULE_NAME] = merged;
  settings = getSettings();
  seedBuiltinTheaters();   // 导入的配置可能早于内置剧场组，补种一次
  saveSettings();
  await applyDirectorInjection();
  renderFloatButton();
  renderModal();
  toast('配置已导入并覆盖。', 'success');
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
  a.download = `qianmu-blueprints-${fileStamp()}.json`;
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
    const valid = incoming.filter((item) => item?.content);
    settings.templates ||= [];
    const byName = new Map((settings.templates).map((tpl) => [tpl.name, tpl]));
    const conflictNames = [...new Set(valid.map((item) => item.name || '导入剧本').filter((n) => byName.has(n)))];
    const decisions = await resolveImportConflicts(conflictNames);
    if (decisions === null) { toast('已取消导入。', 'info'); return; }
    let added = 0, updated = 0, skipped = 0;
    for (const item of valid) {
      const name = item.name || '导入剧本';
      const existing = byName.get(name);
      if (existing) {
        if (decisions.get(name) === 'skip') { skipped++; continue; }
        existing.folder = sanitizeFolder(item.folder || existing.folder || (Array.isArray(item.tags) ? item.tags[0] : ''));
        existing.content = item.content;
        updated++;
        continue;
      }
      const tpl = { id: uid('tpl'), name, folder: sanitizeFolder(item.folder || (Array.isArray(item.tags) ? item.tags[0] : '')), content: item.content, createdAt: item.createdAt || new Date().toISOString() };
      settings.templates.push(tpl);
      byName.set(name, tpl);
      added++;
    }
    saveSettings();
    toast(`导入完成：新增 ${added}，覆盖 ${updated}，跳过 ${skipped}。`, 'success');
    renderModal();
  } catch (error) {
    toast(`导入失败：${error.message}`, 'error');
  } finally {
    event.target.value = '';
  }
}

/* ============================================================
   共读 · 电子书陪读模块（阶段 1A：书架 + 阅读器骨架）
   ── 独立模块，sd-reader-* 命名空间，零侵入推演主流程。
   ── 重数据（正文/封面/会话/检索日志）在 IndexedDB(blobStore)；settings.coread 只存轻量书目索引 + 阅读偏好。
   ── 阅读器是模态内全屏子视图（仿 theaterView，由 readerView 模块级状态驱动）。
   ============================================================ */

// 全屏 portal 需从模态复制的主题变量（避免 CSS 重复声明，永远跟随千幕当前主题）
const READER_PORTAL_VARS = ['--sd-text', '--sd-muted', '--sd-border', '--sd-hairline', '--sd-glass', '--sd-glass-weak', '--sd-card', '--sd-folder-head', '--sd-input-bg', '--sd-accent', '--sd-primary', '--sd-primary-text', '--sd-window-bg', '--sd-pre', '--sd-font'];
// 全屏 portal 不透明底色（按主题给实色，避免透出下方 ST 页面）
const READER_PORTAL_BG = { light: '#f3efe7', dark: '#1c1e22', summer: '#e9f5ee', candy: '#faf0f4', kraft: '#f1e7cf', dream: '#f0eff8' };

// 打开阅读器时把该书正文载入此缓存（重数据不进 settings/DOM 反复读）；关闭阅读器即清。
let readerContentCache = null;   // { bookId, fullText, chapters:[{title,content}], sig }
let readerScrollSaveTimer = null;
let companionWorldView = '';     // 伴读设定浮层中：当前查看条目的世界书名

function coread() {
  if (!isPlainObject(settings.coread)) settings.coread = clone(DEFAULT_SETTINGS.coread);
  return settings.coread;
}

// 伴读设定（1B）：书友身份 + 取材式独立勾选（复用主线拉取/呈现，但选择存 companion·互不影响）。
function coreadCompanion() {
  const c = coread();
  if (!isPlainObject(c.companion)) c.companion = clone(DEFAULT_SETTINGS.coread.companion);
  if (!Array.isArray(c.companion.worldBooks)) c.companion.worldBooks = [];
  if (!isPlainObject(c.companion.worldItems)) c.companion.worldItems = {};
  return c.companion;
}

// 共读世界书「书」级选中（独立于主线）。
function coreadToggleCompanionWorldBook(name, selected) {
  if (!name) return;
  const cp = coreadCompanion();
  const i = cp.worldBooks.indexOf(name);
  const want = typeof selected === 'boolean' ? selected : i < 0;
  if (want && i < 0) cp.worldBooks.push(name);
  else if (!want && i >= 0) cp.worldBooks.splice(i, 1);
  saveSettings();
}
function isCompanionWorldItemSelected(book, itemId, fallbackEnabled) {
  const store = coreadCompanion().worldItems[book];
  if (store && typeof store[itemId] === 'boolean') return store[itemId];
  return fallbackEnabled !== false;
}
function setCompanionWorldItemSelected(book, itemId, selected) {
  const cp = coreadCompanion();
  if (!isPlainObject(cp.worldItems[book])) cp.worldItems[book] = {};
  cp.worldItems[book][itemId] = !!selected;
  saveSettings();
}

// 扫描世界书（复用主线 refreshWorldBooks→contextScanCache，含条目数据），扫完重渲设定浮层。
async function coreadSetupScanWorldBooks(overlay) {
  const body = overlay?.querySelector('.sd-reader-setup-body');
  const scanBtn = body?.querySelector('.sd-reader-cwb-scan');
  if (scanBtn) scanBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> 扫描中';
  try { await refreshWorldBooks(false); } catch (_) {}
  if (body) body.innerHTML = renderCompanionSetupBody();
}

// 懒加载某世界书条目到 contextScanCache（refreshWorldBooks 只为「主线选中」的书拉条目，
// 共读独立选择的书不在其列→需按需补拉，否则面板永远「暂无条目」）。
async function coreadEnsureWorldEntries(name) {
  if (!name) return;
  const cache = contextScanCache.worldBooks || (contextScanCache.worldBooks = {});
  if (Array.isArray(cache[name])) return;   // 已有缓存不重复拉
  try { cache[name] = await getWorldBookEntries(name); } catch (_) { cache[name] = []; }
}

function coreadBookMeta(bookId) {
  return (coread().books || []).find((b) => b.id === bookId) || null;
}

// 网格封面（无图时）：书名 + 作者，长名自动省略不出框。
function readerCoverPlaceholder(title, author) {
  return `<div class="sd-reader-cover-ph">
    <span class="sd-reader-cover-title">${htmlEscape(title || '未命名')}</span>
    ${author ? `<span class="sd-reader-cover-author">${htmlEscape(author)}</span>` : ''}
  </div>`;
}

/* ── 导入（一期：上传文件，集成在导入按钮；TXT 走编码嗅探，其余格式后续接） ── */

async function coreadImportText(rawText, title = '', author = '') {
  const text = String(rawText || '').trim();
  if (!text) { toast('内容为空，无法导入。', 'warning'); return null; }
  if (!blobStore.blobStoreAvailable()) { toast('当前环境不支持本地存储（IndexedDB），无法导入书籍。', 'error'); return null; }
  const finalTitle = String(title || '').trim() || text.split('\n')[0].slice(0, 24).trim() || '未命名书籍';
  const chapters = reader.splitChapters(text, { fallbackCharCount: coread().fallbackChapterChars });
  const charCount = reader.totalChars(chapters);
  const sig = reader.contentSignature(text);
  const bookId = uid('book');
  try {
    await blobStore.putBook(bookId, { meta: { title: finalTitle, author }, fullText: text, chapters, sig });
  } catch (e) {
    console.warn(`[${MODULE_NAME}] putBook failed`, e);
    toast('写入本地存储失败。', 'error');
    return null;
  }
  coread().books.unshift({
    id: bookId, title: finalTitle, author: String(author || ''),
    addedAt: Date.now(), chapterCount: chapters.length, charCount,
    tags: [], boundChar: '', progress: 0, lastChapterIndex: 0, lastScrollRatio: 0, ragEnabled: false,
  });
  saveSettings();
  toast(`已导入《${finalTitle}》：${chapters.length} 章 · ${charCount.toLocaleString()} 字。`, 'success');
  return bookId;
}

// 把正文补写进一本「已在书目、本机缺正文」的书（跨端迁移后用同名 TXT 补全）。
async function coreadRefillBook(bookId, rawText) {
  const meta = coreadBookMeta(bookId);
  if (!meta) return false;
  const text = String(rawText || '').trim();
  if (!text) { toast('内容为空。', 'warning'); return false; }
  if (!blobStore.blobStoreAvailable()) { toast('当前环境不支持本地存储（IndexedDB）。', 'error'); return false; }
  const chapters = reader.splitChapters(text, { fallbackCharCount: coread().fallbackChapterChars });
  const charCount = reader.totalChars(chapters);
  const sig = reader.contentSignature(text);
  try {
    await blobStore.putBook(bookId, { meta: { title: meta.title, author: meta.author }, fullText: text, chapters, sig });
  } catch (e) {
    console.warn(`[${MODULE_NAME}] refill putBook failed`, e);
    toast('写入本地存储失败。', 'error');
    return false;
  }
  meta.chapterCount = chapters.length;
  meta.charCount = charCount;
  meta.lastChapterIndex = Math.min(meta.lastChapterIndex || 0, chapters.length - 1);
  saveSettings();
  toast(`已补全《${meta.title}》正文：${chapters.length} 章。`, 'success');
  return true;
}

// 触发文件选择（集成在导入按钮）。一期实际解析 TXT；其余常见格式占位提示后续支持。
// refillBookId 非空 → 补写到既有书（跨端缺正文），否则新建。
function coreadTriggerImport(refillBookId = '') {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.txt,.text,text/plain';
  input.style.display = 'none';
  document.body.appendChild(input);
  input.addEventListener('change', async () => {
    const file = input.files?.[0];
    input.remove();
    if (!file) return;
    const isTxt = /\.(txt|text)$/i.test(file.name) || file.type === 'text/plain';
    if (!isTxt) { toast('当前仅支持 TXT；EPUB 等格式即将支持。', 'warning'); return; }
    const name = String(file.name || '').replace(/\.(txt|text)$/i, '').trim();
    try {
      const buf = await file.arrayBuffer();
      const text = reader.decodeTxtBuffer(buf);
      if (refillBookId) {
        const ok = await coreadRefillBook(refillBookId, text);
        if (ok) coreadOpenBook(refillBookId);
      } else {
        const id = await coreadImportText(text, name);
        if (id) renderModal();
      }
    } catch (e) {
      console.warn(`[${MODULE_NAME}] import file failed`, e);
      toast('读取文件失败。', 'error');
    }
  });
  input.click();
}

async function coreadDeleteBook(bookId) {
  const meta = coreadBookMeta(bookId);
  if (!meta) return;
  coread().books = coread().books.filter((b) => b.id !== bookId);
  saveSettings();
  try { await blobStore.deleteBook(bookId); } catch (_) {}
  toast(`已删除《${meta.title}》。`, 'info');
}

/* ── 进入/退出阅读器 ───────────────────────────────────── */

async function coreadOpenBook(bookId) {
  const meta = coreadBookMeta(bookId);
  if (!meta) { toast('找不到这本书。', 'error'); return; }
  let rec = null;
  try { rec = await blobStore.getBook(bookId); } catch (_) {}
  // 跨端：书目索引（settings，会同步）在，但正文 blob 在 IndexedDB（不跨端）→ 本机没有，友好提示而非报错弹窗
  if (!rec || !Array.isArray(rec.chapters)) {
    const redo = await confirmDialog(
      `《${meta.title}》的正文未在本设备缓存`,
      '书目信息会随千幕配置同步，但书籍正文存放在本机本地存储，不随设备迁移。可重新导入同名 TXT 补全，或用「导入/导出」迁移阅读数据。是否现在重新导入？'
    );
    if (redo) coreadTriggerImport(bookId);   // 带 bookId：补全到这本，而非新建
    return;
  }
  readerContentCache = { bookId, fullText: rec.fullText || '', chapters: rec.chapters, sig: rec.sig || '' };
  const startCh = Number.isInteger(meta.lastChapterIndex) ? meta.lastChapterIndex : 0;
  readerView = {
    bookId, chapterIndex: Math.max(0, Math.min(startCh, rec.chapters.length - 1)),
    scrollRatio: meta.lastScrollRatio || 0, barHidden: false,
    sessionStart: nowMs(),
  };
  // 阅读器始终走 body portal（逃离模态 backdrop-filter 包含块；窄屏/移动端真·全页，不被 .sd-window 裁切）
  renderModal();        // 模态内此 tab 转为占位
  refreshReaderPortal();
}

function coreadCloseReader() {
  coreadSaveProgress();   // 落进度 + 累计阅读时长
  unmountReaderPortal();
  readerView = null;
  readerContentCache = null;
  renderModal();
}

// 当前毫秒（Date.now 在某些受限上下文被禁用时降级到 performance.now 基准）
function nowMs() {
  try { return Date.now(); } catch (_) { return Math.floor(performance.now()); }
}

// 保存阅读进度（章节 + 滚动比例 + 累计阅读时长 → 轻量索引）。
function coreadSaveProgress() {
  if (!readerView || !readerContentCache) return;
  const meta = coreadBookMeta(readerView.bookId);
  if (!meta) return;
  meta.lastChapterIndex = readerView.chapterIndex;
  meta.lastScrollRatio = readerView.scrollRatio || 0;
  const total = readerContentCache.chapters.length || 1;
  meta.progress = Math.round(((readerView.chapterIndex + (readerView.scrollRatio || 0)) / total) * 100);
  // 累计本书阅读总时长（毫秒）；分段结算，避免长时间挂着算一坨
  if (readerView.sessionStart) {
    const delta = nowMs() - readerView.sessionStart;
    if (delta > 0 && delta < 6 * 3600 * 1000) meta.readMs = (meta.readMs || 0) + delta;
    readerView.sessionStart = nowMs();
  }
  saveSettings();
}

/* ── 全屏 portal（覆盖整个 ST 页面，逃离模态 backdrop-filter 形成的包含块） ── */

function unmountReaderPortal() {
  document.getElementById('sd-reader-portal')?.remove();
}

// 重建 portal 内容并重绑事件（章节切换/划线等局部刷新统一走这里，不动模态）
function refreshReaderPortal() {
  if (!readerView) { unmountReaderPortal(); return; }
  const portal = mountReaderPortal(buildReaderStage());
  bindReaderStageEvents(portal);
}

function mountReaderPortal(innerHtml) {
  unmountReaderPortal();
  const modal = document.getElementById(MODAL_ID);
  const portal = document.createElement('div');
  portal.id = 'sd-reader-portal';
  portal.className = 'sd-reader-portal';
  // 复制当前主题 CSS 变量到 portal，免重复声明、永远与千幕主题一致
  if (modal) {
    const cs = getComputedStyle(modal);
    for (const v of READER_PORTAL_VARS) {
      const val = cs.getPropertyValue(v);
      if (val) portal.style.setProperty(v, val.trim());
    }
  }
  // 不透明实色底（按主题），避免透出下方 ST 页面
  const themeKey = THEME_KEYS.includes(settings.theme) ? settings.theme : 'light';
  portal.style.background = READER_PORTAL_BG[themeKey] || READER_PORTAL_BG.light;
  portal.innerHTML = innerHtml;
  document.body.appendChild(portal);
  return portal;
}

/* ── 渲染：书架 / 阅读器分派 ───────────────────────────── */

function renderCoreadTab() {
  // 阅读器永远走 body portal（逃离模态包含块，窄屏不裁切）；模态内此 tab 仅占位
  if (readerView) {
    return `<div class="sd-reader-fs-placeholder"><i class="fa-solid fa-book-open-reader"></i><p>阅读中…<br><button class="sd-reader-resume sd-btn">回到阅读</button></p></div>`;
  }
  return renderLibraryView();
}

function sortedLibraryBooks() {
  const books = [...(coread().books || [])];
  const [field, dir] = String(coread().libSort || 'addedAt-desc').split('-');
  const mul = dir === 'asc' ? 1 : -1;
  const val = (b) => {
    switch (field) {
      case 'title': return b.title || '';
      case 'author': return b.author || '';
      case 'progress': return b.progress || 0;
      case 'length': return b.charCount || 0;
      default: return b.addedAt || 0;
    }
  };
  books.sort((a, b) => {
    const va = val(a), vb = val(b);
    if (typeof va === 'string') return mul * va.localeCompare(vb, 'zh');
    return mul * (va - vb);
  });
  const tags = coread().libTags || [];
  return tags.length ? books.filter((b) => tags.every((t) => (b.tags || []).includes(t))) : books;
}

function allLibraryTags() {
  const set = new Set();
  for (const b of coread().books || []) for (const t of (b.tags || [])) set.add(t);
  return [...set];
}

function renderLibraryView() {
  const c = coread();
  const books = sortedLibraryBooks();
  const tags = allLibraryTags();
  const viewMode = c.libViewMode === 'list' ? 'list' : 'grid';
  const cards = books.map((b) => {
    const prog = Math.max(0, Math.min(100, b.progress || 0));
    if (viewMode === 'list') {
      // 纯文字行：无封面
      return `
        <div class="sd-reader-row" data-book="${htmlEscape(b.id)}">
          <div class="sd-reader-row-main">
            <span class="sd-reader-row-title" title="${htmlEscape(b.title)}">${htmlEscape(b.title)}</span>
            <span class="sd-reader-row-sub">${b.author ? htmlEscape(b.author) + ' · ' : ''}${(b.chapterCount || 0)}章 · ${(b.charCount || 0).toLocaleString()}字</span>
          </div>
          <span class="sd-reader-row-prog">${prog}%</span>
          <button class="sd-reader-card-del" data-book="${htmlEscape(b.id)}" title="删除"><i class="fa-solid fa-trash"></i></button>
        </div>`;
    }
    return `
      <div class="sd-reader-card" data-book="${htmlEscape(b.id)}">
        <div class="sd-reader-card-cover">${readerCoverPlaceholder(b.title, b.author)}
          <div class="sd-reader-prog"><span>${prog}%</span></div>
        </div>
        <div class="sd-reader-card-meta">
          <div class="sd-reader-card-title" title="${htmlEscape(b.title)}">${htmlEscape(b.title)}</div>
          <div class="sd-reader-card-sub">${(b.chapterCount || 0)}章 · ${(b.charCount || 0).toLocaleString()}字</div>
        </div>
        <button class="sd-reader-card-del" data-book="${htmlEscape(b.id)}" title="删除"><i class="fa-solid fa-trash"></i></button>
      </div>`;
  }).join('');

  return `
    <div class="sd-reader-lib sd-reader-lib-${viewMode}">
      <div class="sd-reader-lib-bar">
        <button class="sd-reader-view-toggle" title="切换视图"><i class="fa-solid ${viewMode === 'grid' ? 'fa-list' : 'fa-table-cells-large'}"></i></button>
        <input type="search" class="sd-reader-search" placeholder="搜索书名 / 作者" />
        <select class="sd-reader-sort" title="排序">
          <option value="addedAt-desc"${c.libSort === 'addedAt-desc' ? ' selected' : ''}>最近添加</option>
          <option value="addedAt-asc"${c.libSort === 'addedAt-asc' ? ' selected' : ''}>最早添加</option>
          <option value="title-asc"${c.libSort === 'title-asc' ? ' selected' : ''}>书名 A→Z</option>
          <option value="progress-desc"${c.libSort === 'progress-desc' ? ' selected' : ''}>进度高→低</option>
        </select>
        <button class="sd-reader-import sd-btn" title="导入书籍"><i class="fa-solid fa-plus"></i> 导入</button>
      </div>
      ${tags.length ? `<div class="sd-reader-tags">${tags.map((t) => `<button class="sd-reader-tag ${(c.libTags || []).includes(t) ? 'active' : ''}" data-tag="${htmlEscape(t)}">${htmlEscape(t)}</button>`).join('')}</div>` : ''}
      ${books.length ? `<div class="sd-reader-grid">${cards}</div>` : `<div class="sd-reader-empty"><i class="fa-solid fa-book-open"></i><p>书架还是空的。点「导入」添加第一本书，开始和角色共读。</p></div>`}
    </div>`;
}

// 章节正文 → 段落 HTML。自动判定分段；hiList=本章划线对象 [{id,text,hlStyle,color}]，命中处包带样式 <mark>。
function buildReaderParagraphs(text, hiList) {
  const s = String(text || '');
  const hasBlankLines = /\n\s*\n/.test(s);
  const blocks = hasBlankLines
    ? s.split(/\n\s*\n/).map((b) => b.replace(/\n+/g, ' ').trim())
    : s.split('\n').map((l) => l.trim());
  // 长文本优先，避免短串先命中把长串切断
  const hi = (hiList || [])
    .filter((h) => h && String(h.text || '').trim().length >= 2)
    .map((h) => ({ id: h.id, text: String(h.text).trim(), style: h.hlStyle || 'mark', color: sanitizeHexColor(h.color) }))
    .sort((a, b) => b.text.length - a.text.length);
  const out = blocks.filter(Boolean).map((p) => {
    if (!hi.length) return `<p>${htmlEscape(p)}</p>`;
    // 在「纯文本」上定位匹配区间（绝不在已注入的 HTML 标签/属性里误命中）；
    // 长串优先占位、贪心跳过重叠 → 杜绝嵌套 <mark> 与属性串被短划线击穿。
    const ranges = [];
    for (const h of hi) {
      let from = 0, idx;
      while ((idx = p.indexOf(h.text, from)) !== -1) {
        ranges.push({ start: idx, end: idx + h.text.length, h });
        from = idx + h.text.length;
      }
    }
    if (!ranges.length) return `<p>${htmlEscape(p)}</p>`;
    ranges.sort((a, b) => a.start - b.start || (b.end - b.start) - (a.end - a.start));
    let cursor = 0, html = '';
    for (const r of ranges) {
      if (r.start < cursor) continue;   // 与已占位区间重叠 → 跳过
      html += htmlEscape(p.slice(cursor, r.start));
      const styleAttr = r.h.color ? ` style="--hl-color:${r.h.color}"` : '';
      html += `<mark class="sd-reader-hl sd-reader-hl-${r.h.style}" data-note="${htmlEscape(r.h.id)}"${styleAttr}>${htmlEscape(p.slice(r.start, r.end))}</mark>`;
      cursor = r.end;
    }
    html += htmlEscape(p.slice(cursor));
    return `<p>${html}</p>`;
  }).join('');
  return out || '<p class="sd-reader-blank">（本章无正文）</p>';
}

// 颜色白名单：只接受 #rgb / #rrggbb，挡注入。空/非法 → ''（回落主题色）。
function sanitizeHexColor(c) {
  const s = String(c || '').trim();
  return /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(s) ? s : '';
}

// 阅读时长格式化（ms → 「Xh Ym」/「Y 分钟」/「不足 1 分钟」）
function formatReadDuration(ms) {
  const m = Math.floor((ms || 0) / 60000);
  if (m < 1) return '不足 1 分钟';
  if (m < 60) return `${m} 分钟`;
  return `${Math.floor(m / 60)} 时 ${m % 60} 分`;
}

// 页宽(rem) → 正文左右内边距(%)。窄屏/移动端 max-width 顶不到时，靠内边距给出可见的「页宽」效果。
// 宽设置→小边距(更宽列)；窄设置→大边距(更窄列)。28→14% … 66→0%。
function widthToPad(widthRem) {
  const w = Math.max(28, Math.min(66, widthRem || 42));
  return ((66 - w) / 38 * 14).toFixed(1);
}

// 构建阅读器舞台 HTML（始终在 body portal 内）。手机阅读 APP 式：点正文切换上下操作栏。
function buildReaderStage() {
  const cache = readerContentCache;
  const meta = coreadBookMeta(readerView.bookId);
  if (!cache || !meta) return '';
  const total = cache.chapters.length;
  const ci = Math.max(0, Math.min(readerView.chapterIndex, total - 1));
  const chapter = cache.chapters[ci] || { title: '', content: '' };
  const c = coread();
  const notes = Array.isArray(meta.notes) ? meta.notes : [];
  const chHi = notes.filter((n) => n.kind === 'highlight' && n.chapterIndex === ci).map((n) => ({ id: n.id, text: n.text, hlStyle: n.hlStyle, color: n.color }));
  const bookmarked = notes.some((n) => n.kind === 'bookmark' && n.chapterIndex === ci);
  const bodyStyle = `font-size:${c.fontSizePx || 19}px;line-height:${c.lineHeight || 1.9};text-align:${c.justify ? 'justify' : 'left'};--sd-rd-para:${c.paraSpacing || 1}em;--sd-rd-px:${widthToPad(Math.max(28, Math.min(66, c.contentWidthRem || 42)))}%;`;
  const paras = buildReaderParagraphs(chapter.content, chHi);
  const widthRem = Math.max(28, Math.min(66, c.contentWidthRem || 42));
  const barHidden = readerView.barHidden ? ' sd-reader-bar-hidden' : '';
  const pct = Math.max(0, Math.min(100, meta.progress || 0));
  const preset = c.spacingPreset || 'normal';
  const customOpen = preset === 'custom' ? ' open' : '';
  const hlColor = sanitizeHexColor(c.hlColor) || '#d8a657';
  const drawerH = Math.max(180, Math.min(520, c.dialogHeight || 300));
  const pinned = readerView.dialogPinned ? ' sd-reader-dialog-pinned' : '';

  return `
    <div class="sd-reader-stage${barHidden}${pinned}" style="--sd-rd-dialogh:${drawerH}px">
      <!-- 顶栏（固定不抽回）：书签 / 书名 / 返回(右) -->
      <div class="sd-reader-topbar">
        <button class="sd-reader-mark-btn ${bookmarked ? 'active' : ''}" title="书签"><i class="fa-${bookmarked ? 'solid' : 'regular'} fa-bookmark"></i></button>
        <div class="sd-reader-chtitle">${htmlEscape(chapter.title || meta.title)}</div>
        <button class="sd-reader-back" title="返回书架"><i class="fa-solid fa-xmark"></i></button>
      </div>

      <!-- 正文：点空白切换底栏显隐 -->
      <div class="sd-reader-body" style="${bodyStyle}">
        <article class="sd-reader-article" style="max-width:${widthRem}rem">
          <h2 class="sd-reader-h2">${htmlEscape(chapter.title || '')}</h2>
          ${paras}
        </article>
      </div>

      <!-- 划线工具浮窗（选区/点划线后弹·跟随选区定位·父级 划线|笔记，划线展开样式+取色） -->
      <div class="sd-reader-hltools" hidden>
        <div class="sd-reader-hltools-lv sd-reader-hltools-main">
          <button data-act="highlight"><i class="fa-solid fa-highlighter"></i><span>划线</span></button>
          <button data-act="note"><i class="fa-solid fa-pen"></i><span>笔记</span></button>
        </div>
        <div class="sd-reader-hltools-lv sd-reader-hltools-styles" hidden>
          <button data-back title="返回"><i class="fa-solid fa-chevron-left"></i></button>
          <button data-style="wavy" title="波浪线"><i class="fa-solid fa-wave-square"></i></button>
          <button data-style="underline" title="下划线"><i class="fa-solid fa-underline"></i></button>
          <button data-style="mark" title="荧光（自动半透明）"><i class="fa-solid fa-highlighter"></i></button>
          <label class="sd-reader-hlcolor" title="划线颜色"><input type="color" class="sd-reader-hlcolor-input" value="${hlColor}"><span style="background:${hlColor}"></span></label>
        </div>
        <div class="sd-reader-hltools-lv sd-reader-hltools-exist" hidden>
          <button data-act="note"><i class="fa-solid fa-pen"></i><span>笔记</span></button>
          <button data-act="remove"><i class="fa-solid fa-eraser"></i><span>取消划线</span></button>
        </div>
      </div>

      <!-- 底栏（可抽回）：目录 / 进度 / 对话 / 语音条 / 设置 -->
      <div class="sd-reader-bottombar">
        <button class="sd-reader-bb sd-reader-toc-btn"><i class="fa-solid fa-list-ul"></i><span>目录</span></button>
        <button class="sd-reader-bb sd-reader-progress-btn"><i class="fa-solid fa-gauge-simple"></i><span>${pct}%</span></button>
        <button class="sd-reader-bb sd-reader-dialog-btn"><i class="fa-solid fa-comments"></i><span>对话</span></button>
        <button class="sd-reader-bb sd-reader-voice-btn"><i class="fa-solid fa-comment-dots"></i><span>语音条</span></button>
        <button class="sd-reader-bb sd-reader-typo-btn"><i class="fa-solid fa-gear"></i><span>设置</span></button>
      </div>

      <!-- 目录 / 笔记 / 书签 抽屉（笔记编辑直接在「笔记」页内切换·不再独立抽屉） -->
      <div class="sd-reader-panel sd-reader-toc">
        <div class="sd-reader-panel-grip"></div>
        <div class="sd-reader-panel-tabs">
          <button class="active" data-ptab="toc">目录</button>
          <button data-ptab="notes">笔记</button>
          <button data-ptab="marks">书签</button>
        </div>
        <div class="sd-reader-panel-body">
          <div class="sd-reader-ptab sd-reader-ptab-toc">
            ${cache.chapters.map((ch, i) => `<button class="sd-reader-toc-item ${i === ci ? 'active' : ''}" data-ch="${i}">${htmlEscape(ch.title || ('第 ' + (i + 1) + ' 节'))}</button>`).join('')}
          </div>
          <div class="sd-reader-ptab sd-reader-ptab-notes" hidden>
            <div class="sd-reader-notes-view">${renderReaderNotes(meta)}</div>
          </div>
          <div class="sd-reader-ptab sd-reader-ptab-marks" hidden>${renderReaderMarks(meta)}</div>
        </div>
      </div>

      <!-- 对话抽屉（共读书友·1B 接入；现为占位·可拖拽调高·可图钉固定） -->
      <div class="sd-reader-panel sd-reader-dialog${readerView.dialogPinned ? ' open' : ''}" style="height:${drawerH}px">
        <div class="sd-reader-panel-grip sd-reader-dialog-grip"></div>
        <div class="sd-reader-dialog-head">
          <span><i class="fa-solid fa-comments"></i> 共读对话</span>
          <div class="sd-reader-dialog-head-btns">
            <button class="sd-reader-dialog-setup" title="伴读设定（书友 / 取材 / 上下文）"><i class="fa-solid fa-gear"></i></button>
            <button class="sd-reader-dialog-pin ${readerView.dialogPinned ? 'active' : ''}" title="固定对话框（固定后正文照常滚动）"><i class="fa-solid fa-thumbtack"></i></button>
          </div>
        </div>
        <div class="sd-reader-dialog-body">
          <div class="sd-reader-panel-empty">共读书友功能即将接入（1B）。届时这里是与角色就「读到此处」实时讨论的对话流，讨论会被蒸馏后反哺主线。</div>
        </div>
        <div class="sd-reader-dialog-input">
          <textarea class="sd-reader-dialog-ta" placeholder="共读对话即将开放……" disabled rows="1"></textarea>
          <button class="sd-reader-dialog-send" disabled title="发送"><i class="fa-solid fa-paper-plane"></i></button>
        </div>
      </div>

      <!-- 语音条抽屉 -->
      <div class="sd-reader-panel sd-reader-voice">
        <div class="sd-reader-panel-grip"></div>
        <div class="sd-reader-panel-tabs"><button class="active">共读语音条</button></div>
        <div class="sd-reader-panel-body">${renderReaderVoiceClips(meta)}</div>
      </div>

      <!-- 进度抽屉：上行左右半（百分比 | 已读时长）；下行 当前/全文；再下滑块 -->
      <div class="sd-reader-panel sd-reader-progress">
        <div class="sd-reader-panel-grip"></div>
        <div class="sd-reader-prog-inner">
          <div class="sd-reader-prog-halves">
            <div class="sd-reader-prog-half"><div class="sd-reader-prog-pct">${pct}<small>%</small></div><div class="sd-reader-prog-cap">已读</div></div>
            <div class="sd-reader-prog-half"><div class="sd-reader-prog-dur">${formatReadDuration(meta.readMs)}</div><div class="sd-reader-prog-cap">阅读时长</div></div>
          </div>
          <div class="sd-reader-prog-page">${ci + 1} / ${total}</div>
          <div class="sd-reader-prog-ctl">
            <button class="sd-reader-prev" ${ci <= 0 ? 'disabled' : ''} title="上一章"><i class="fa-solid fa-backward-step"></i></button>
            <input type="range" class="sd-reader-prog-slider" min="0" max="${Math.max(0, total - 1)}" value="${ci}">
            <button class="sd-reader-next" ${ci >= total - 1 ? 'disabled' : ''} title="下一章"><i class="fa-solid fa-forward-step"></i></button>
          </div>
        </div>
      </div>

      <!-- 设置抽屉：字号 / 间距预设(+自定义) / 两端对齐 / 语音缓存 / 导入导出 -->
      <div class="sd-reader-panel sd-reader-typo">
        <div class="sd-reader-panel-grip"></div>
        <div class="sd-reader-typo-inner">
          <div class="sd-reader-typo-row"><span>字号</span><input type="range" class="sd-reader-font" min="14" max="30" step="1" value="${c.fontSizePx || 19}"><b class="sd-reader-font-val">${c.fontSizePx || 19}</b></div>
          <div class="sd-reader-typo-row sd-reader-preset-row">
            <span>间距</span>
            <div class="sd-reader-preset-seg">
              <button data-preset="compact" class="${preset === 'compact' ? 'active' : ''}">紧凑</button>
              <button data-preset="normal" class="${preset === 'normal' ? 'active' : ''}">适中</button>
              <button data-preset="loose" class="${preset === 'loose' ? 'active' : ''}">宽松</button>
            </div>
            <button class="sd-reader-preset-custom ${preset === 'custom' ? 'active' : ''}" title="自定义间距"><i class="fa-solid fa-sliders"></i></button>
          </div>
          <div class="sd-reader-custom-wrap${customOpen}">
            <div class="sd-reader-typo-row"><span>行距</span><input type="range" class="sd-reader-lh" min="1.4" max="2.6" step="0.1" value="${c.lineHeight || 1.9}"><b class="sd-reader-lh-val">${(c.lineHeight || 1.9).toFixed(1)}</b></div>
            <div class="sd-reader-typo-row"><span>段距</span><input type="range" class="sd-reader-para" min="0.4" max="2.4" step="0.1" value="${c.paraSpacing || 1}"><b class="sd-reader-para-val">${(c.paraSpacing || 1).toFixed(1)}</b></div>
            <div class="sd-reader-typo-row"><span>页宽</span><input type="range" class="sd-reader-width" min="28" max="66" step="1" value="${widthRem}"><b class="sd-reader-width-val">${widthRem}</b></div>
          </div>
          <div class="sd-reader-typo-row sd-reader-typo-checks"><label><input type="checkbox" class="sd-reader-justify"${c.justify ? ' checked' : ''}> <span>两端对齐</span></label></div>
          <div class="sd-reader-typo-row"><span style="width:auto">语音条缓存上限</span><input type="number" class="sd-reader-voicelimit" min="10" max="2000" step="10" value="${c.voiceCacheLimit || 100}"><span style="width:auto;color:var(--sd-muted)">条</span></div>
          <div class="sd-reader-typo-io">
            <button class="sd-reader-export sd-btn"><i class="fa-solid fa-file-export"></i> 导出阅读数据</button>
            <button class="sd-reader-import-data sd-btn"><i class="fa-solid fa-file-import"></i> 导入阅读数据</button>
          </div>
        </div>
      </div>

      <!-- 笔记编辑浮层（脱离五抽屉体系·居中浮层·自带 z-index·永不牵出抽屉/底栏） -->
      <div class="sd-reader-noteoverlay" hidden>
        <div class="sd-reader-noteoverlay-card">
          <div class="sd-reader-noteoverlay-head"><i class="fa-solid fa-pen"></i> 笔记</div>
          <div class="sd-reader-noteedit-quote"></div>
          <textarea class="sd-reader-noteedit-input" placeholder="写下你的想法（留空＝仅作摘录）……"></textarea>
          <div class="sd-reader-noteedit-actions">
            <button class="sd-btn sd-reader-noteedit-cancel">取消</button>
            <button class="sd-btn sd-primary sd-reader-noteedit-ok">保存</button>
          </div>
        </div>
      </div>

      <!-- 伴读设定浮层（1B-1·与笔记浮层同范式·脱抽屉·居中·取材式独立勾选） -->
      <div class="sd-reader-setupoverlay" hidden>
        <div class="sd-reader-setupoverlay-card">
          <div class="sd-reader-noteoverlay-head"><i class="fa-solid fa-gear"></i> 伴读设定</div>
          <div class="sd-reader-setup-body">${renderCompanionSetupBody()}</div>
          <div class="sd-reader-noteedit-actions">
            <button class="sd-btn sd-reader-setup-close">完成</button>
          </div>
        </div>
      </div>
    </div>`;
}

// 伴读设定浮层内容：身份直显(标签·联动 ST 当前)+世界书取材式选择(书/条目独立)+可见正文范围。
// 人设走「千幕已有取材注入逻辑」一种方式，无需在此重复勾选；轨道A 的对话记忆条数挪到 1C 蒸馏设置(短信体按条算·100-200 触发总结·此处版面不放)。
function renderCompanionSetupBody() {
  const cp = coreadCompanion();
  const stChar = getCharacterName() || '未选择';
  const stUser = getPersonaName() || '未选择';
  // 复用主线扫描缓存（点「扫描」会 refreshWorldBooks 填充 contextScanCache·与取材同源）
  const boundNames = contextScanCache.boundWorldBookNames || detectBoundWorldBookNames();
  const allNames = uniqueClean([...boundNames, ...(contextScanCache.worldBookNames || [])]).filter(Boolean);
  const cpSelected = cp.worldBooks.filter((n) => allNames.includes(n));
  if (companionWorldView && !allNames.includes(companionWorldView)) companionWorldView = '';
  const viewName = companionWorldView || cpSelected[cpSelected.length - 1] || '';
  const bookRows = allNames.map((name) => `
    <div class="sd-reader-cwb-row${viewName === name ? ' sd-reader-cwb-viewing' : ''}">
      <input type="checkbox" class="sd-reader-cwb-toggle" data-name="${htmlEscape(name)}"${cpSelected.includes(name) ? ' checked' : ''} title="选中作为共读引用">
      <button type="button" class="sd-reader-cwb-name" data-name="${htmlEscape(name)}"><span>${htmlEscape(name)}</span>${boundNames.includes(name) ? '<em class="sd-reader-cwb-tag">当前绑定</em>' : ''}</button>
    </div>`).join('');
  const items = viewName ? (contextScanCache.worldBooks?.[viewName] || []) : [];
  const itemRows = items.map((item, index) => {
    const id = getContextItemId(item, index);
    const title = item.name || item.comment || (Array.isArray(item.key) ? item.key.join(', ') : item.key) || `条目 ${index + 1}`;
    const content = item.content || item.prompt || '';
    const checked = isCompanionWorldItemSelected(viewName, id, item.enabled);
    return `<details class="sd-reader-cwb-item" data-acc="ci-cwb-${htmlEscape(String(viewName))}-${htmlEscape(String(id))}">
      <summary><label class="sd-reader-cwb-itemlab"><input type="checkbox" class="sd-reader-cwb-itemcheck" data-book="${htmlEscape(viewName)}" data-id="${htmlEscape(String(id))}"${checked ? ' checked' : ''}><span>${htmlEscape(title)}</span></label></summary>
      <pre>${htmlEscape(cleanContextText(content).slice(0, 2000))}</pre>
    </details>`;
  }).join('');
  // 下拉右上角：多选→数量；单选→书名；未选→未选择
  const headRight = cpSelected.length >= 2 ? `${cpSelected.length} 项` : (cpSelected.length === 1 ? htmlEscape(cpSelected[0]) : '未选择');
  return `
    <div class="sd-reader-setup-row">
      <div class="sd-reader-setup-tags">
        <span class="sd-reader-setup-tag"><i class="fa-solid fa-user"></i> 书友：${htmlEscape(stChar)}</span>
        <span class="sd-reader-setup-tag"><i class="fa-solid fa-circle-user"></i> 我：${htmlEscape(stUser)}</span>
      </div>
    </div>
    <div class="sd-reader-setup-row">
      <div class="sd-reader-cwb-head">
        <span><label class="sd-reader-setup-lab">共读世界书</label><em class="sd-muted" style="font-size:.78em">独立于主线选择</em></span>
        <button class="sd-btn sd-reader-cwb-scan"><i class="fa-solid fa-rotate"></i> ${allNames.length ? '刷新' : '扫描'}</button>
      </div>
      ${allNames.length
        ? `<details class="sd-reader-cwb-dropdown" data-fold="wb"${cp.foldWbOpen !== false ? ' open' : ''}>
            <summary><span>选择</span><b>${headRight}</b></summary>
            <div class="sd-reader-cwb-list">${bookRows}</div>
          </details>
          ${viewName
            ? `<details class="sd-reader-cwb-itemfold" data-fold="items"${cp.foldItemsOpen !== false ? ' open' : ''}>
                <summary><span>${htmlEscape(viewName)} · 条目</span><b>${items.length}</b></summary>
                <div class="sd-reader-cwb-items">${itemRows || '<span class="sd-muted" style="font-size:.82em">该世界书暂无条目。</span>'}</div>
              </details>`
            : '<span class="sd-muted" style="font-size:.78em">勾选或点击书名查看其条目，再按需勾选共读引用。</span>'}`
        : '<span class="sd-muted" style="font-size:.82em">点「扫描」从 ST 当前聊天读取可选世界书。</span>'}
    </div>
    <div class="sd-reader-setup-row">
      <label class="sd-reader-setup-lab">书友可读范围（字数）</label>
      <input type="number" class="sd-reader-setup-visible" min="200" max="4000" step="100" value="${Number(cp.visibleCharsBefore) || 800}">
    </div>`;
}

// 共读语音条列表（1B 对话接入后由 reader_voice 填充；当前为占位空态）
function renderReaderVoiceClips(meta) {
  const clips = Array.isArray(meta.voiceClips) ? meta.voiceClips : [];
  if (!clips.length) return '<div class="sd-reader-panel-empty">还没有共读语音条。开启与角色的共读对话后，生成的短信体语音会按时间排列在这里。</div>';
  return clips.slice().reverse().map((v) => `
    <div class="sd-reader-voice-item" data-clip="${htmlEscape(v.id)}">
      <button class="sd-reader-voice-play" data-clip="${htmlEscape(v.id)}" title="播放"><i class="fa-solid fa-circle-play"></i></button>
      <div class="sd-reader-voice-main">
        <div class="sd-reader-voice-text">${htmlEscape(v.text || '')}</div>
        <div class="sd-reader-voice-time">${v.at ? new Date(v.at).toLocaleString() : ''}</div>
      </div>
    </div>`).join('');
}

// 笔记列表。meta.notes=[{id,chapterIndex,text,annotation,kind,hlStyle,at}]，kind: highlight | bookmark
// 划线有批注 → 「笔记」标签；仅划线无批注 → 「摘录」标签。点条目可定位回正文。
function renderReaderNotes(meta) {
  const notes = (meta.notes || []).filter((n) => n.kind === 'highlight');
  if (!notes.length) return '<div class="sd-reader-panel-empty">还没有笔记。点顶部划线钮，选中正文即可划线；划线后可补笔记。</div>';
  return notes.slice().reverse().map((n) => {
    const isNote = !!(n.annotation && n.annotation.trim());
    return `
    <div class="sd-reader-note-item" data-note="${htmlEscape(n.id)}" data-ch="${n.chapterIndex}">
      <div class="sd-reader-note-head"><span class="sd-reader-note-kind ${isNote ? 'sd-reader-kind-note' : ''}">${isNote ? '笔记' : '摘录'}</span>
        <button class="sd-reader-note-jump" data-ch="${n.chapterIndex}" title="定位到正文">第${(n.chapterIndex || 0) + 1}节</button>
        <button class="sd-reader-note-edit" data-note="${htmlEscape(n.id)}" title="${isNote ? '编辑笔记' : '加笔记'}"><i class="fa-solid fa-pen"></i></button>
        <button class="sd-reader-note-del" data-note="${htmlEscape(n.id)}" title="删除"><i class="fa-solid fa-xmark"></i></button>
      </div>
      <div class="sd-reader-note-text">${htmlEscape(n.text || '')}</div>
      ${isNote ? `<div class="sd-reader-note-anno">${htmlEscape(n.annotation)}</div>` : ''}
    </div>`;
  }).join('');
}

function renderReaderMarks(meta) {
  const marks = (meta.notes || []).filter((n) => n.kind === 'bookmark');
  if (!marks.length) return '<div class="sd-reader-panel-empty">还没有书签。阅读时点右上角书签图标添加。</div>';
  return marks.slice().reverse().map((n) => `
    <div class="sd-reader-note-item" data-note="${htmlEscape(n.id)}">
      <div class="sd-reader-note-head">
        <button class="sd-reader-note-jump" data-ch="${n.chapterIndex}" title="跳转"><i class="fa-solid fa-bookmark"></i> 第${(n.chapterIndex || 0) + 1}节</button>
        <button class="sd-reader-note-del" data-note="${htmlEscape(n.id)}" title="删除"><i class="fa-solid fa-xmark"></i></button>
      </div>
      ${n.text ? `<div class="sd-reader-note-text">${htmlEscape(n.text)}</div>` : ''}
    </div>`).join('');
}

/* ── 事件绑定 ─────────────────────────────────────────── */

function bindCoreadTabEvents(root) {
  if (activeTab !== 'coread') { unmountReaderPortal(); return; }
  if (readerView) {
    // portal 由 coreadOpenBook/refreshReaderPortal 维护；切回 tab 时确保它在
    if (!document.getElementById('sd-reader-portal')) refreshReaderPortal();
    root.querySelector('.sd-reader-resume')?.addEventListener('click', () => refreshReaderPortal());
    return;
  }
  unmountReaderPortal();
  bindLibraryViewEvents(root);
}

function bindLibraryViewEvents(root) {
  root.querySelector('.sd-reader-import')?.addEventListener('click', coreadTriggerImport);
  root.querySelector('.sd-reader-view-toggle')?.addEventListener('click', () => {
    coread().libViewMode = coread().libViewMode === 'list' ? 'grid' : 'list';
    saveSettings(); renderModal();
  });
  root.querySelector('.sd-reader-sort')?.addEventListener('change', (e) => {
    coread().libSort = e.target.value; saveSettings(); renderModal();
  });
  root.querySelectorAll('.sd-reader-tag').forEach((el) => el.addEventListener('click', () => {
    const t = el.dataset.tag;
    const arr = coread().libTags || (coread().libTags = []);
    const i = arr.indexOf(t);
    if (i >= 0) arr.splice(i, 1); else arr.push(t);
    saveSettings(); renderModal();
  }));
  // 实时搜索（纯 DOM 过滤）；阻断事件冒泡 + 抢占 focusin，避免触发 ST 输入框快捷栏
  const search = root.querySelector('.sd-reader-search');
  if (search) {
    ['focusin', 'focus', 'click', 'pointerdown', 'mousedown', 'touchstart', 'keydown', 'keyup', 'keypress', 'input'].forEach((ev) =>
      search.addEventListener(ev, (e) => e.stopPropagation()));
    search.addEventListener('input', (e) => {
      const q = String(e.target.value || '').trim().toLowerCase();
      root.querySelectorAll('.sd-reader-card, .sd-reader-row').forEach((card) => {
        const b = coreadBookMeta(card.dataset.book);
        const hit = !q || (b && ((b.title || '').toLowerCase().includes(q) || (b.author || '').toLowerCase().includes(q)));
        card.style.display = hit ? '' : 'none';
      });
    });
  }
  root.querySelectorAll('.sd-reader-card, .sd-reader-row').forEach((card) => card.addEventListener('click', (e) => {
    if (e.target.closest('.sd-reader-card-del')) return;
    coreadOpenBook(card.dataset.book);
  }));
  root.querySelectorAll('.sd-reader-card-del').forEach((el) => el.addEventListener('click', async (e) => {
    e.stopPropagation();
    const id = el.dataset.book;
    const b = coreadBookMeta(id);
    if (b && await confirmDialog(`确定删除《${b.title}》？正文与阅读进度都会清除（不影响已写入聊天世界书的共读记忆）。`)) {
      await coreadDeleteBook(id); renderModal();
    }
  }));
}

// 在 stageRoot（portal）内绑定阅读器事件。
function bindReaderStageEvents(stageRoot) {
  if (!stageRoot) return;
  const q = (sel) => stageRoot.querySelector(sel);
  const stage = q('.sd-reader-stage');
  // 收抽屉：图钉固定的对话抽屉不收
  const closePanels = () => stageRoot.querySelectorAll('.sd-reader-panel').forEach((p) => {
    if (readerView.dialogPinned && p.classList.contains('sd-reader-dialog')) return;
    p.classList.remove('open');
  });
  const togglePanel = (sel) => {
    const target = q(sel);
    const wasOpen = target?.classList.contains('open');
    closePanels();
    if (target && !wasOpen) target.classList.add('open');
    syncBottombar();
  };
  // 任一抽屉打开 → 底栏收回（含对话抽屉）；全关 → 底栏复位
  const syncBottombar = () => {
    const open = !!stageRoot.querySelector('.sd-reader-panel.open');
    readerView.barHidden = open;
    stage?.classList.toggle('sd-reader-bar-hidden', open);
  };
  q('.sd-reader-back')?.addEventListener('click', () => coreadCloseReader());

  // 底栏五抽屉互斥开合
  q('.sd-reader-toc-btn')?.addEventListener('click', () => togglePanel('.sd-reader-toc'));
  q('.sd-reader-voice-btn')?.addEventListener('click', () => togglePanel('.sd-reader-voice'));
  q('.sd-reader-progress-btn')?.addEventListener('click', () => togglePanel('.sd-reader-progress'));
  q('.sd-reader-typo-btn')?.addEventListener('click', () => togglePanel('.sd-reader-typo'));

  // 抽屉内 目录/笔记/书签 切页（切走「笔记」时退出编辑态）
  stageRoot.querySelectorAll('.sd-reader-toc .sd-reader-panel-tabs button').forEach((btn) => btn.addEventListener('click', () => {
    const tab = btn.dataset.ptab;
    stageRoot.querySelectorAll('.sd-reader-toc .sd-reader-panel-tabs button').forEach((b) => b.classList.toggle('active', b === btn));
    stageRoot.querySelector('.sd-reader-ptab-toc').hidden = tab !== 'toc';
    stageRoot.querySelector('.sd-reader-ptab-notes').hidden = tab !== 'notes';
    stageRoot.querySelector('.sd-reader-ptab-marks').hidden = tab !== 'marks';
    exitNoteEdit(stageRoot);
  }));
  // 目录跳章
  stageRoot.querySelectorAll('.sd-reader-toc-item').forEach((el) => el.addEventListener('click', () => {
    readerView.chapterIndex = Number(el.dataset.ch) || 0;
    readerView.scrollRatio = 0;
    coreadSaveProgress(); refreshReaderPortal();
  }));
  // 笔记/书签：定位 + 编辑 + 删除（事件委托·列表重渲后仍生效·原地不关抽屉）
  stageRoot.querySelectorAll('.sd-reader-ptab-notes, .sd-reader-ptab-marks').forEach((panel) => panel.addEventListener('click', (e) => {
    const jump = e.target.closest('.sd-reader-note-jump');
    const edit = e.target.closest('.sd-reader-note-edit');
    const del = e.target.closest('.sd-reader-note-del');
    if (jump) { readerView.chapterIndex = Number(jump.dataset.ch) || 0; readerView.scrollRatio = 0; coreadSaveProgress(); refreshReaderPortal(); return; }
    if (edit) { e.stopPropagation(); openReaderNoteDialog(edit.dataset.note); return; }
    if (del) { e.stopPropagation(); coreadDeleteNote(del.dataset.note); del.closest('.sd-reader-note-item')?.remove(); updateReaderArticle(stageRoot); return; }
  }));
  // 笔记编辑浮层：保存 / 取消 / 点遮罩空白关闭（脱离抽屉体系·不牵出底栏）
  q('.sd-reader-noteedit-cancel')?.addEventListener('click', () => exitNoteEdit(stageRoot));
  q('.sd-reader-noteedit-ok')?.addEventListener('click', () => saveNoteEdit(stageRoot));
  q('.sd-reader-noteoverlay')?.addEventListener('click', (e) => {
    if (e.target === e.currentTarget) exitNoteEdit(stageRoot);   // 仅点遮罩本身关闭，点卡片内不关
  });
  // 书签开关（顶栏）
  q('.sd-reader-mark-btn')?.addEventListener('click', () => coreadToggleBookmark(stageRoot));

  // 进度滑块（按章）+ 上下章
  const slider = q('.sd-reader-prog-slider');
  slider?.addEventListener('input', (e) => {
    const label = q('.sd-reader-prog-page');
    if (label) label.textContent = `${Number(e.target.value) + 1} / ${readerContentCache?.chapters.length || 1}`;
  });
  slider?.addEventListener('change', (e) => {
    readerView.chapterIndex = Number(e.target.value) || 0; readerView.scrollRatio = 0; coreadSaveProgress(); refreshReaderPortal();
  });
  q('.sd-reader-prev')?.addEventListener('click', () => { if (readerView.chapterIndex > 0) { readerView.chapterIndex--; readerView.scrollRatio = 0; coreadSaveProgress(); refreshReaderPortal(); } });
  q('.sd-reader-next')?.addEventListener('click', () => { if (readerContentCache && readerView.chapterIndex < readerContentCache.chapters.length - 1) { readerView.chapterIndex++; readerView.scrollRatio = 0; coreadSaveProgress(); refreshReaderPortal(); } });

  // ── 排版调节（即时作用于正文，不重渲染） ──
  const bodyEl = q('.sd-reader-body');
  const article = q('.sd-reader-article');
  q('.sd-reader-font')?.addEventListener('input', (e) => {
    coread().fontSizePx = Number(e.target.value) || 19; saveSettings();
    if (bodyEl) bodyEl.style.fontSize = `${coread().fontSizePx}px`;
    const v = q('.sd-reader-font-val'); if (v) v.textContent = String(coread().fontSizePx);
  });
  q('.sd-reader-lh')?.addEventListener('input', (e) => {
    coread().lineHeight = Number(e.target.value) || 1.9; coread().spacingPreset = 'custom'; saveSettings();
    if (bodyEl) bodyEl.style.lineHeight = String(coread().lineHeight);
    const v = q('.sd-reader-lh-val'); if (v) v.textContent = coread().lineHeight.toFixed(1);
  });
  q('.sd-reader-para')?.addEventListener('input', (e) => {
    coread().paraSpacing = Number(e.target.value) || 1; coread().spacingPreset = 'custom'; saveSettings();
    if (bodyEl) bodyEl.style.setProperty('--sd-rd-para', `${coread().paraSpacing}em`);
    const v = q('.sd-reader-para-val'); if (v) v.textContent = coread().paraSpacing.toFixed(1);
  });
  q('.sd-reader-width')?.addEventListener('input', (e) => {
    const w = Number(e.target.value) || 42;
    coread().contentWidthRem = w; saveSettings();
    if (article) article.style.maxWidth = `${w}rem`;
    if (bodyEl) bodyEl.style.setProperty('--sd-rd-px', `${widthToPad(w)}%`);   // 窄屏靠内边距生效
    const v = q('.sd-reader-width-val'); if (v) v.textContent = String(w);
  });
  q('.sd-reader-justify')?.addEventListener('change', (e) => {
    coread().justify = !!e.target.checked; saveSettings();
    if (bodyEl) bodyEl.style.textAlign = coread().justify ? 'justify' : 'left';
  });
  // 间距预设：紧凑 / 适中 / 宽松 → 一键套行距+段距；自定义钮展开独立滑块
  stageRoot.querySelectorAll('.sd-reader-preset-seg button').forEach((btn) => btn.addEventListener('click', () => {
    applySpacingPreset(btn.dataset.preset, stageRoot);
  }));
  q('.sd-reader-preset-custom')?.addEventListener('click', () => {
    const wrap = q('.sd-reader-custom-wrap');
    const open = wrap?.classList.toggle('open');
    coread().spacingPreset = open ? 'custom' : (coread().spacingPreset === 'custom' ? 'normal' : coread().spacingPreset);
    q('.sd-reader-preset-custom')?.classList.toggle('active', !!open);
    if (!open) applySpacingPreset(coread().spacingPreset, stageRoot);
    saveSettings();
  });
  // 语音条缓存上限
  q('.sd-reader-voicelimit')?.addEventListener('change', (e) => {
    const n = Math.max(10, Math.min(2000, Number(e.target.value) || 100));
    coread().voiceCacheLimit = n; e.target.value = n; saveSettings();
  });
  // 阅读数据导入 / 导出
  q('.sd-reader-export')?.addEventListener('click', () => coreadExportData());
  q('.sd-reader-import-data')?.addEventListener('click', () => coreadImportData());

  // 对话抽屉：开合 + 拖拽调高 + 图钉固定（占位·1B 接入对话内容）
  q('.sd-reader-dialog-btn')?.addEventListener('click', () => togglePanel('.sd-reader-dialog'));
  bindDialogGrip(q('.sd-reader-dialog'), q('.sd-reader-dialog-grip'));
  q('.sd-reader-dialog-pin')?.addEventListener('click', (e) => {
    e.stopPropagation();
    readerView.dialogPinned = !readerView.dialogPinned;
    stage?.classList.toggle('sd-reader-dialog-pinned', readerView.dialogPinned);
    q('.sd-reader-dialog-pin')?.classList.toggle('active', readerView.dialogPinned);
    if (readerView.dialogPinned) q('.sd-reader-dialog')?.classList.add('open');
    syncBottombar();
  });

  // ── 伴读设定浮层（1B-1·复用取材拉取/呈现·选择 companion 独立·脱抽屉居中） ──
  const setupOverlay = q('.sd-reader-setupoverlay');
  // 重渲后恢复折叠开合：两大容器从 settings 持久化(跨重开书不丢)；条目项用 accState(本会话)
  const rerenderSetup = () => { const body = setupOverlay?.querySelector('.sd-reader-setup-body'); if (body) { body.innerHTML = renderCompanionSetupBody(); applyAccState(setupOverlay); } };
  const openSetup = async () => {
    if (!setupOverlay) return;
    rerenderSetup();
    setupOverlay.hidden = false;
    // 已有选中的书（上次会话留存）→ 首开就按需补拉其条目，避免「暂无条目」假象
    const cp = coreadCompanion();
    const pre = companionWorldView || cp.worldBooks[cp.worldBooks.length - 1] || '';
    if (pre) { await coreadEnsureWorldEntries(pre); rerenderSetup(); }
  };
  const closeSetup = () => { if (setupOverlay) setupOverlay.hidden = true; };
  // details 开合记忆：data-fold 两大容器→持久化 settings(跨重开书)；data-acc 条目项→accState(本会话)
  setupOverlay?.addEventListener('toggle', (e) => {
    const d = e.target;
    if (d?.dataset?.fold === 'wb') { coreadCompanion().foldWbOpen = d.open; saveSettings(); }
    else if (d?.dataset?.fold === 'items') { coreadCompanion().foldItemsOpen = d.open; saveSettings(); }
    else if (d?.dataset?.acc) accState[d.dataset.acc] = d.open;
  }, true);
  q('.sd-reader-dialog-setup')?.addEventListener('click', (e) => { e.stopPropagation(); openSetup(); });
  setupOverlay?.addEventListener('click', (e) => { if (e.target === e.currentTarget) closeSetup(); });
  // 文本/数字输入委托（浮层内容重渲后仍生效）
  setupOverlay?.addEventListener('input', (e) => {
    const vis = e.target.closest('.sd-reader-setup-visible');
    if (vis) { coreadCompanion().visibleCharsBefore = Math.max(200, Math.min(4000, Number(vis.value) || 800)); saveSettings(); return; }
  });
  // 勾选委托：书级 + 条目级
  setupOverlay?.addEventListener('change', async (e) => {
    const bk = e.target.closest('.sd-reader-cwb-toggle');
    if (bk) {
      coreadToggleCompanionWorldBook(bk.dataset.name, !!bk.checked);
      if (bk.checked) { companionWorldView = bk.dataset.name; await coreadEnsureWorldEntries(bk.dataset.name); }   // 选中即切到该书并按需补拉条目
      rerenderSetup();
      return;
    }
    const it = e.target.closest('.sd-reader-cwb-itemcheck');
    if (it) { setCompanionWorldItemSelected(it.dataset.book, it.dataset.id, !!it.checked); return; }
  });
  // 点击委托：完成 / 扫描 / 点书名切查看
  setupOverlay?.addEventListener('click', async (e) => {
    if (e.target.closest('.sd-reader-setup-close')) { closeSetup(); return; }
    const scan = e.target.closest('.sd-reader-cwb-scan');
    if (scan) { await coreadSetupScanWorldBooks(setupOverlay); return; }
    const nameBtn = e.target.closest('.sd-reader-cwb-name');
    if (nameBtn) { companionWorldView = nameBtn.dataset.name; await coreadEnsureWorldEntries(nameBtn.dataset.name); rerenderSetup(); return; }
  });

  // ── 划线工具浮窗：选中正文 / 点已划线 → 跟随定位弹出（父级 划线|笔记） ──
  const tools = q('.sd-reader-hltools');
  const anyPanelOpen = () => !!stageRoot.querySelector('.sd-reader-panel.open');
  const hideTools = () => { if (tools) tools.hidden = true; };
  let pendingText = '';   // 新选区文本
  let pendingMark = '';   // 已划线 noteId
  if (bodyEl && tools) {
    const lvMain = tools.querySelector('.sd-reader-hltools-main');
    const lvStyles = tools.querySelector('.sd-reader-hltools-styles');
    const lvExist = tools.querySelector('.sd-reader-hltools-exist');
    const showLevel = (lv) => {
      lvMain.hidden = lv !== 'main'; lvStyles.hidden = lv !== 'styles'; lvExist.hidden = lv !== 'exist';
    };
    // 跟随选区/划线定位：优先上方，顶部不够则下方；左右夹到舞台内
    const showTools = (rect, level) => {
      showLevel(level);
      tools.hidden = false;
      requestAnimationFrame(() => {
        const host = stageRoot.getBoundingClientRect();
        const w = tools.offsetWidth || 160, h = tools.offsetHeight || 44;
        let top = rect.top - host.top - h - 10;
        if (top < 58) top = rect.bottom - host.top + 10;   // 顶部空间不足 → 选区下方
        top = Math.min(top, host.height - h - 80);
        let left = rect.left - host.left + rect.width / 2 - w / 2;
        left = Math.max(8, Math.min(left, host.width - w - 8));
        tools.style.left = `${left}px`; tools.style.top = `${Math.max(8, top)}px`;
      });
    };
    // 选中正文 → 父级
    const onSelect = () => {
      const sel = window.getSelection?.();
      const text = sel ? String(sel).trim() : '';
      if (!text) return;
      pendingText = text; pendingMark = '';
      try { showTools(sel.getRangeAt(0).getBoundingClientRect(), 'main'); } catch (_) {}
    };
    bodyEl.addEventListener('mouseup', () => setTimeout(onSelect, 0));
    bodyEl.addEventListener('touchend', () => setTimeout(onSelect, 0));
    // 父级：划线 → 展开样式级；笔记 → 建划线(荧光默认)并即开笔记
    lvMain.querySelector('[data-act="highlight"]').onclick = () => showLevel('styles');
    lvMain.querySelector('[data-act="note"]').onclick = () => {
      const text = pendingText; hideTools();
      window.getSelection?.()?.removeAllRanges?.();
      if (text) { const id = coreadAddHighlight(text, 'mark'); updateReaderArticle(stageRoot); if (id) openReaderNoteDialog(id); }
    };
    // 样式级：返回箭头 / 三样式 / 取色（荧光自动半透明由 CSS color-mix 负责）
    lvStyles.querySelector('[data-back]').onclick = () => showLevel('main');
    lvStyles.querySelector('.sd-reader-hlcolor-input')?.addEventListener('input', (e) => {
      const col = sanitizeHexColor(e.target.value);
      coread().hlColor = col; saveSettings();
      const sw = lvStyles.querySelector('.sd-reader-hlcolor span'); if (sw) sw.style.background = col || '#d8a657';
    });
    lvStyles.querySelectorAll('button[data-style]').forEach((btn) => btn.addEventListener('click', () => {
      const text = pendingText; hideTools();
      window.getSelection?.()?.removeAllRanges?.();
      showLevel('main');   // 划线后自动返回上一级
      if (text) { coreadAddHighlight(text, btn.dataset.style || 'mark'); updateReaderArticle(stageRoot); }
    }));
    // 已划线级：笔记 / 取消划线
    lvExist.querySelector('[data-act="note"]').onclick = () => { const id = pendingMark; hideTools(); if (id) openReaderNoteDialog(id); };
    lvExist.querySelector('[data-act="remove"]').onclick = () => {
      const id = pendingMark; hideTools();
      if (id) { coreadDeleteNote(id); updateReaderArticle(stageRoot); }   // 原地更新·不重渲不跳动
    };
    // 点正文里的划线 → 已划线级
    bodyEl.addEventListener('click', (e) => {
      const mark = e.target.closest('.sd-reader-hl');
      if (!mark) return;
      e.stopPropagation();
      pendingMark = mark.dataset.note; pendingText = '';
      showTools(mark.getBoundingClientRect(), 'exist');
    });
  }

  // ── 正文空白点击：两段式收栏（先收浮窗 → 再收抽屉 → 再收底栏） ──
  bodyEl?.addEventListener('click', (e) => {
    if (e.target.closest('.sd-reader-hl')) return;   // 划线已由上面处理
    const sel = window.getSelection?.();
    if (sel && String(sel).trim()) return;
    if (tools && !tools.hidden) { hideTools(); return; }
    if (anyPanelOpen()) { closePanels(); syncBottombar(); return; }
    readerView.barHidden = !readerView.barHidden;
    stage?.classList.toggle('sd-reader-bar-hidden', readerView.barHidden);
  });

  // 滚动位置恢复（仅 portal 重建时：开书/换章用·停在记忆位置；划线等原地更新不触发） + 保存
  if (bodyEl) {
    if (readerView.scrollRatio > 0) {
      requestAnimationFrame(() => { bodyEl.scrollTop = readerView.scrollRatio * (bodyEl.scrollHeight - bodyEl.clientHeight); });
    }
    bodyEl.addEventListener('scroll', () => {
      const denom = bodyEl.scrollHeight - bodyEl.clientHeight;
      readerView.scrollRatio = denom > 0 ? bodyEl.scrollTop / denom : 0;
      clearTimeout(readerScrollSaveTimer);
      readerScrollSaveTimer = setTimeout(coreadSaveProgress, 600);
    });
  }
}

// 拖拽对话抽屉高度（grip 上下拖）。保存到 coread().dialogHeight。
function bindDialogGrip(panel, grip) {
  if (!panel || !grip) return;
  let startY = 0, startH = 0, dragging = false;
  const onMove = (e) => {
    if (!dragging) return;
    const y = e.touches ? e.touches[0].clientY : e.clientY;
    const h = Math.max(180, Math.min(520, startH + (startY - y)));
    panel.style.height = `${h}px`;
  };
  const onUp = () => {
    if (!dragging) return;
    dragging = false;
    const h = Math.max(180, Math.min(520, parseInt(panel.style.height) || 300));
    coread().dialogHeight = h; saveSettings();
    document.removeEventListener('mousemove', onMove);
    document.removeEventListener('mouseup', onUp);
    document.removeEventListener('touchmove', onMove);
    document.removeEventListener('touchend', onUp);
  };
  const onDown = (e) => {
    dragging = true;
    startY = e.touches ? e.touches[0].clientY : e.clientY;
    startH = panel.offsetHeight;
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
    document.addEventListener('touchmove', onMove, { passive: false });
    document.addEventListener('touchend', onUp);
    e.preventDefault();
  };
  grip.addEventListener('mousedown', onDown);
  grip.addEventListener('touchstart', onDown, { passive: false });
}

// 间距预设 → 行距/段距数值；同步滑块与正文（不重建 portal）
function applySpacingPreset(preset, stageRoot) {
  const map = { compact: { lh: 1.5, para: 0.6 }, normal: { lh: 1.9, para: 1.0 }, loose: { lh: 2.3, para: 1.6 } };
  const p = map[preset]; if (!p) return;
  const c = coread();
  c.spacingPreset = preset; c.lineHeight = p.lh; c.paraSpacing = p.para; saveSettings();
  const bodyEl = stageRoot.querySelector('.sd-reader-body');
  if (bodyEl) { bodyEl.style.lineHeight = String(p.lh); bodyEl.style.setProperty('--sd-rd-para', `${p.para}em`); }
  stageRoot.querySelectorAll('.sd-reader-preset-seg button').forEach((b) => b.classList.toggle('active', b.dataset.preset === preset));
  stageRoot.querySelector('.sd-reader-preset-custom')?.classList.remove('active');
  stageRoot.querySelector('.sd-reader-custom-wrap')?.classList.remove('open');
  const lh = stageRoot.querySelector('.sd-reader-lh'); if (lh) lh.value = String(p.lh);
  const pa = stageRoot.querySelector('.sd-reader-para'); if (pa) pa.value = String(p.para);
  const lhv = stageRoot.querySelector('.sd-reader-lh-val'); if (lhv) lhv.textContent = p.lh.toFixed(1);
  const pav = stageRoot.querySelector('.sd-reader-para-val'); if (pav) pav.textContent = p.para.toFixed(1);
}

// 原地更新正文 <mark> + 笔记/书签列表（不重建 portal·不丢滚动位置·划线/取消/记笔记后调用）
function updateReaderArticle(stageRoot) {
  const root = stageRoot || document.getElementById('sd-reader-portal');
  if (!root || !readerContentCache) return;
  const meta = coreadBookMeta(readerView.bookId);
  if (!meta) return;
  const ci = Math.max(0, Math.min(readerView.chapterIndex, readerContentCache.chapters.length - 1));
  const chapter = readerContentCache.chapters[ci] || { title: '', content: '' };
  const notes = Array.isArray(meta.notes) ? meta.notes : [];
  const chHi = notes.filter((n) => n.kind === 'highlight' && n.chapterIndex === ci).map((n) => ({ id: n.id, text: n.text, hlStyle: n.hlStyle, color: n.color }));
  const article = root.querySelector('.sd-reader-article');
  if (article) article.innerHTML = `<h2 class="sd-reader-h2">${htmlEscape(chapter.title || '')}</h2>${buildReaderParagraphs(chapter.content, chHi)}`;
  // 笔记/书签列表同步（若抽屉开着，内容不至于过时）
  const nv = root.querySelector('.sd-reader-notes-view'); if (nv) nv.innerHTML = renderReaderNotes(meta);
  const mk = root.querySelector('.sd-reader-ptab-marks'); if (mk) mk.innerHTML = renderReaderMarks(meta);
}

// 新增划线（带样式 + 颜色快照）。text + style:'mark'|'wavy'|'underline'。返回新 noteId（供「笔记」接力打开批注）。
// 不在此重建/更新 DOM，由调用方 updateReaderArticle 原地刷新（不跳动）。
function coreadAddHighlight(text, style) {
  const meta = coreadBookMeta(readerView.bookId);
  if (!meta) return '';
  if (!Array.isArray(meta.notes)) meta.notes = [];
  const id = uid('note');
  meta.notes.push({
    id, kind: 'highlight', chapterIndex: readerView.chapterIndex,
    text: String(text || '').slice(0, 400), hlStyle: style || 'mark',
    color: sanitizeHexColor(coread().hlColor), annotation: '', at: nowMs(),
  });
  saveSettings();
  toast('已划线', 'success');
  return id;
}

function coreadDeleteNote(noteId) {
  const meta = coreadBookMeta(readerView.bookId);
  if (!meta || !Array.isArray(meta.notes)) return;
  meta.notes = meta.notes.filter((n) => n.id !== noteId);
  saveSettings();
}

// 切换当前章书签。
function coreadToggleBookmark(stageRoot) {
  const meta = coreadBookMeta(readerView.bookId);
  if (!meta) return;
  if (!Array.isArray(meta.notes)) meta.notes = [];
  const ci = readerView.chapterIndex;
  const existing = meta.notes.find((n) => n.kind === 'bookmark' && n.chapterIndex === ci);
  if (existing) {
    meta.notes = meta.notes.filter((n) => n !== existing);
    toast('已移除书签', 'info');
  } else {
    const ch = readerContentCache?.chapters[ci];
    meta.notes.push({ id: uid('mark'), kind: 'bookmark', chapterIndex: ci, text: ch?.title || '', at: nowMs() });
    toast('已添加书签', 'success');
  }
  saveSettings();
  // 原地更新顶栏书签图标 + 书签列表，不重渲染
  const btn = stageRoot.querySelector('.sd-reader-mark-btn');
  const on = meta.notes.some((n) => n.kind === 'bookmark' && n.chapterIndex === ci);
  if (btn) { btn.classList.toggle('active', on); const i = btn.querySelector('i'); if (i) i.className = `fa-${on ? 'solid' : 'regular'} fa-bookmark`; }
  const mk = stageRoot.querySelector('.sd-reader-ptab-marks'); if (mk) mk.innerHTML = renderReaderMarks(meta);
}

// 笔记批注：复用「目录」抽屉的「笔记」页·list↔edit 内部切换（窄屏移动端不出界·不叠层）。
function openReaderNoteDialog(noteId) {
  const meta = coreadBookMeta(readerView.bookId);
  const note = meta?.notes?.find((n) => n.id === noteId);
  const portal = document.getElementById('sd-reader-portal');
  const overlay = portal?.querySelector('.sd-reader-noteoverlay');
  if (!note || !overlay) return;
  readerView.editingNoteId = noteId;
  // 纯浮层：不开任何抽屉、不动底栏；居中浮于一切之上
  const text = String(note.text || '');
  overlay.querySelector('.sd-reader-noteedit-quote').textContent = text.slice(0, 200) + (text.length > 200 ? '…' : '');
  const ta = overlay.querySelector('.sd-reader-noteedit-input');
  ta.value = note.annotation || '';
  overlay.hidden = false;
  setTimeout(() => ta.focus(), 60);
}

// 关闭笔记编辑浮层
function exitNoteEdit(stageRoot) {
  readerView.editingNoteId = '';
  const root = stageRoot || document.getElementById('sd-reader-portal');
  const overlay = root?.querySelector('.sd-reader-noteoverlay');
  if (overlay) overlay.hidden = true;
}

// 保存笔记编辑
function saveNoteEdit(stageRoot) {
  const meta = coreadBookMeta(readerView.bookId);
  const note = meta?.notes?.find((n) => n.id === readerView.editingNoteId);
  const ta = stageRoot.querySelector('.sd-reader-noteedit-input');
  if (note && ta) {
    note.annotation = String(ta.value || '').trim();
    saveSettings();
    toast(note.annotation ? '已记笔记' : '已保存', 'success');
  }
  exitNoteEdit(stageRoot);
  updateReaderArticle(stageRoot);   // 同步列表标签（摘录↔笔记）
}

/* ── 阅读数据导入 / 导出（整模块：书目索引 + 正文 + 封面 + 笔记 + 会话；语音 1B 接入后并入） ── */

async function coreadExportData() {
  if (!blobStore.blobStoreAvailable()) { toast('当前环境不支持本地存储，无法导出。', 'error'); return; }
  const books = [];
  for (const meta of coread().books || []) {
    let rec = null;
    try { rec = await blobStore.getBook(meta.id); } catch (_) {}
    let coverB64 = '';
    try {
      const cover = await blobStore.getCover(meta.id);
      if (cover) coverB64 = await blobToBase64(cover);
    } catch (_) {}
    books.push({ meta, fullText: rec?.fullText || '', chapters: rec?.chapters || [], sig: rec?.sig || '', coverB64 });
  }
  const payload = {
    type: 'qianmu-coread', version: 1, exportedAt: new Date().toISOString(),
    prefs: { ...coread(), books: undefined },   // 偏好（不含书目，书目随 books 走）
    books,
  };
  delete payload.prefs.books;
  const blob = new Blob([JSON.stringify(payload)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = `qianmu-coread-${fileStamp()}.json`;
  document.body.appendChild(a); a.click(); a.remove();
  URL.revokeObjectURL(url);
  toast(`已导出阅读数据：${books.length} 本书。`, 'success');
}

function coreadImportData() {
  const input = document.createElement('input');
  input.type = 'file'; input.accept = 'application/json,.json'; input.style.display = 'none';
  document.body.appendChild(input);
  input.addEventListener('change', async () => {
    const file = input.files?.[0]; input.remove();
    if (!file) return;
    let data;
    try {
      data = JSON.parse(await file.text());
      if (data.type !== 'qianmu-coread' || !Array.isArray(data.books)) throw new Error('格式不符');
    } catch (_) { toast('导入失败：不是有效的千幕阅读数据文件。', 'error'); return; }
    if (!blobStore.blobStoreAvailable()) { toast('当前环境不支持本地存储，无法导入。', 'error'); return; }
    if (!await confirmDialog('导入阅读数据', `将导入 ${data.books.length} 本书的正文、笔记与阅读进度。同 id 的书会被覆盖，是否继续？`)) return;
    let ok = 0;
    for (const b of data.books) {
      if (!b?.meta?.id) continue;
      try {
        await blobStore.putBook(b.meta.id, { meta: { title: b.meta.title, author: b.meta.author }, fullText: b.fullText || '', chapters: b.chapters || [], sig: b.sig || '' });
        if (b.coverB64) { try { await blobStore.putCover(b.meta.id, base64ToBlob(b.coverB64)); } catch (_) {} }
        const idx = (coread().books || []).findIndex((x) => x.id === b.meta.id);
        if (idx >= 0) coread().books[idx] = b.meta; else coread().books.unshift(b.meta);
        ok++;
      } catch (e) { console.warn(`[${MODULE_NAME}] import book failed`, e); }
    }
    // 偏好并入（保留本机书目，不被覆盖）
    if (isPlainObject(data.prefs)) {
      for (const k of Object.keys(data.prefs)) {
        if (k === 'books' || k === 'enabled') continue;
        coread()[k] = data.prefs[k];
      }
    }
    saveSettings();
    toast(`已导入 ${ok} 本书。`, 'success');
    renderModal();
  });
  input.click();
}

function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result || '').split(',')[1] || '');
    r.onerror = reject;
    r.readAsDataURL(blob);
  });
}

function base64ToBlob(b64, mime = 'image/*') {
  const bin = atob(b64);
  const arr = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
  return new Blob([arr], { type: mime });
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
  if (typeof t.useChatHistory === 'undefined') t.useChatHistory = true;
  if (typeof t.historyDepth === 'undefined') t.historyDepth = 5;
  return t;
}

// 内置剧场组「吱吱小剧场」种入剧札：保留用户自建项，版本升级时整组替换。
// 内置项以 builtin:true + 稳定 id（sd-bt-*）双标记。判定走 isBuiltinScript：
// 早期版本种入的内置项可能没写 builtin 标志（仅有 sd-bt-* id），仅靠 !s.builtin 过滤会漏判、
// 导致升级时旧内置被当用户项留下 + 新内置又全量追加 → 整组重复翻倍。故 id 命名空间兜底。
function isBuiltinScript(s) {
  return !!s && (s.builtin === true || (typeof s.id === 'string' && (s.id.startsWith('sd-bt-') || s.id.startsWith('sd-qm-'))));
}
// 更古早的 seed 曾用 uid('script') 铸内置项（id=script-*、无 builtin 标志），isBuiltinScript 认不出，
// 升级时被当用户项留下 → 与新内置同名重复。清扫规则：标题命中内置、且在内置文件夹、且正文与当前
// 内置逐字一致者，视为「纯遗留副本」剔除；正文被改过的（用户 DIY 副本）正文不同、保留不动。
function isOrphanBuiltinCopy(s, builtinByTitle) {
  if (!s || isBuiltinScript(s)) return false;
  const canon = builtinByTitle.get(String(s.title || ''));
  if (!canon) return false;
  return (s.folder === BUILTIN_THEATER_FOLDER || s.folder === QIANMU_THEATER_FOLDER)
    && String(s.instruction || '').trim() === String(canon.instruction || '').trim();
}
function seedBuiltinTheaters() {
  const t = getTheater();
  const ziziStale = Number(t.builtinRevision || 0) !== BUILTIN_THEATER_REVISION;
  const qmStale = Number(t.qianmuRevision || 0) !== QIANMU_THEATER_REVISION;
  if (!ziziStale && !qmStale) return;   // 两组都最新，无需重种
  // 内置项整体重铸（吱吱 sd-bt-* + 千幕 sd-qm-*），逐字遗留副本一并清扫；两组都升级时一次写回
  const builtinByTitle = new Map([
    ...BUILTIN_THEATERS.map((item) => [item.title, item]),
    ...QIANMU_THEATERS.map((item) => [item.title, item]),
  ]);
  // 留下「真用户项」：既不是受管内置（flag/id），也不是逐字相同的遗留内置副本
  const userScripts = (t.scripts || [])
    .filter((s) => !isBuiltinScript(s) && !isOrphanBuiltinCopy(s, builtinByTitle));
  const ziziBuiltins = BUILTIN_THEATERS.map((item, index) => ({
    id: `sd-bt-${index}`,
    title: item.title,
    folder: BUILTIN_THEATER_FOLDER,
    instruction: item.instruction,
    builtin: true,
    createdAt: '2025-01-01T00:00:00.000Z',
  }));
  const qmBuiltins = QIANMU_THEATERS.map((item, index) => ({
    id: `sd-qm-${index}`,
    title: item.title,
    folder: QIANMU_THEATER_FOLDER,
    instruction: item.instruction,
    builtin: true,
    createdAt: '2025-01-01T00:00:00.000Z',
  }));
  t.scripts = [...userScripts, ...ziziBuiltins, ...qmBuiltins];
  t.builtinRevision = BUILTIN_THEATER_REVISION;
  t.qianmuRevision = QIANMU_THEATER_REVISION;
  saveSettings();
}

// 规整剧札顺序：用户自建项在前、内置项在后，不设数量上限（保留全部）
function normalizeScripts(scripts) {
  const list = Array.isArray(scripts) ? scripts : [];
  const user = list.filter((s) => !isBuiltinScript(s));
  const builtins = list.filter((s) => isBuiltinScript(s));
  return [...user, ...builtins];
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
    // 解析空内容的标记条目（角色设定 / 世界书 / 人设等）
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

// 幕外始终注入当前聊天设定：角色设定 + 用户人设 + 当前角色绑定的世界书（独立于推演链路，不受取材开关影响）
async function buildTheaterDefaultText() {
  let output = '';
  const charDesc = cleanContextText(await resolveMacro(getCharacterDescription()));
  if (charDesc) output += `\n【当前角色设定】\n${await resolveMacro(getCharacterName())}\n${charDesc}\n`;
  const userDesc = cleanContextText(await resolveMacro(getPersonaDescription()));
  if (userDesc) output += `\n【用户人设】\n${await resolveMacro(getPersonaName())}\n${userDesc}\n`;
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
    sortAlpha: true,   // 剧札：文件夹在上、散条目在下，二者均按名字母序
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
        : ''}
      <div class="sd-theater-history-row">
        <label class="checkbox_label"><input type="checkbox" class="sd-theater-use-history" ${t.useChatHistory !== false ? 'checked' : ''}> 衔接当前正文</label>
        <label class="sd-depth-field"><span>参考楼层</span><input class="text_pole sd-theater-history-depth" type="number" min="1" max="200" value="${htmlEscape(t.historyDepth || 5)}" ${t.useChatHistory !== false ? '' : 'disabled'}></label>
      </div>
      <div class="sd-field-head"><label>此幕指令</label><button type="button" class="sd-icon-btn sd-icon-sm sd-expand-editor" data-target="sd-theater-instruction" data-title="此幕指令" title="展开编辑" aria-label="展开编辑"><i class="fa-solid fa-up-right-and-down-left-from-center"></i></button></div>
      <textarea class="text_pole sd-textarea sd-theater-instruction sd-theater-instruction-compact" spellcheck="false" placeholder="${htmlEscape(THEATER_INSTRUCTION_PLACEHOLDER)}">${htmlEscape(t.instruction || '')}</textarea>
      <div class="sd-button-row">
        <button class="sd-btn sd-primary sd-theater-stage ${theaterBusy ? 'sd-as-stop' : ''}">${theaterBusy ? '<i class="fa-solid fa-stop"></i>停止上演' : '<i class="fa-solid fa-masks-theater"></i>上演此幕'}</button>
        <button class="sd-btn sd-theater-save-script"><i class="fa-solid fa-bookmark"></i>保存到剧札</button>
        <button class="sd-icon-btn sd-theater-open-favorites" title="收藏夹 (${t.favorites.length})" aria-label="收藏夹"><i class="fa-solid fa-star"></i></button>
      </div>
      ${out ? `<div class="sd-theater-latest sd-button-row">
        <span class="sd-muted">最近一幕：${htmlEscape(theaterOpening(out))}</span>
        <button class="sd-btn sd-mini-btn sd-theater-open-latest"><i class="fa-solid fa-book-open"></i>阅读</button>
      </div>` : ''}
    </section>
    <section class="sd-card">${renderLibrarySection(theaterScriptLibraryCfg())}</section>`;
}

// 番外正文开端：提取 <幕外正文> 内正文（并清洗 HTML 标签）取开头若干字，作为列表/最近一幕的显示名
function theaterOpening(scene, n = 28) {
  if (!scene) return '番外';
  let text = extractTheaterBody(String(scene.content || ''));
  if (scene.isHtml || /<[^>]+>/.test(text)) {
    text = text.replace(/<style[\s\S]*?<\/style>/gi, '').replace(/<script[\s\S]*?<\/script>/gi, '').replace(/<[^>]+>/g, ' ');
  }
  text = text.replace(/\s+/g, ' ').trim();
  return text ? snip(text, n) : '番外';
}

// 阅读页副标题：来自剧札则 @剧札名，否则 @即兴
function theaterSubtitle(scene) {
  const src = String(scene?.source || '').trim();
  return src ? `@${src}` : '@即兴';
}

const THEATER_READ_TITLE = '幕外一折';

// 番外正文按 Markdown 渲染：用 ST 自带 showdown 转 HTML、DOMPurify 消毒（安全）。
// 取不到库时回落为转义纯文本 + 换行（与旧行为一致，绝不直出未消毒 HTML）。
function renderTheaterMarkdown(text) {
  const raw = String(text || '');
  try {
    const libs = globalThis.SillyTavern?.libs;
    const showdown = libs?.showdown;
    const DOMPurify = libs?.DOMPurify;
    if (showdown && DOMPurify) {
      const conv = new showdown.Converter({
        simpleLineBreaks: true, tables: true, strikethrough: true,
        literalMidWordUnderscores: true, emoji: true, openLinksInNewWindow: true,
      });
      return DOMPurify.sanitize(conv.makeHtml(raw));
    }
  } catch (_) {}
  return htmlEscape(raw).replace(/\n/g, '<br>');
}

// 给 iframe 阅读内容注入「隐藏滚动条但保留滚动」的样式：有 <head> 插 head 内，否则前置。
// 仅用于弹窗内阅读 iframe（阅读区不大、滚动条挤占且不美观）；新页面整页打开不调用此函数、滚动条照常。
function withHiddenScrollbar(html) {
  const style = '<style>html{scrollbar-width:none;-ms-overflow-style:none;}html::-webkit-scrollbar,body::-webkit-scrollbar{width:0;height:0;display:none;}</style>';
  const h = String(html || '');
  if (/<head[^>]*>/i.test(h)) return h.replace(/<head[^>]*>/i, (m) => m + style);
  return style + h;
}

function renderTheaterReadView(scene) {
  if (!scene) { theaterView = null; return renderTheaterTab(); }
  const fav = isTheaterFavorited(scene.id) || getTheater().favorites.some((f) => f.content === scene.content);
  const cleaned = extractTheaterBody(scene.content);
  const scale = getTheater().readerFontScale || 'medium';
  const editing = !!theaterView?.editing;
  const bodyHtml = editing
    ? `<textarea class="text_pole sd-reader-edit-area" spellcheck="false">${htmlEscape(cleaned)}</textarea>`
    : (scene.isHtml
      ? `<iframe class="sd-reader-frame" sandbox="allow-scripts allow-popups allow-forms" srcdoc="${htmlEscape(withHiddenScrollbar(cleaned))}"></iframe>`
      : `<div class="sd-reader-prose" data-scale="${scale}">${renderTheaterMarkdown(cleaned)}</div>`);
  const fontControl = (editing || scene.isHtml) ? '' : `<div class="sd-reader-font" role="group" aria-label="字号">
        ${['small', 'medium', 'large'].map((s) => `<button type="button" class="sd-reader-font-btn ${scale === s ? 'active' : ''}" data-scale="${s}">${s === 'small' ? '小' : s === 'medium' ? '中' : '大'}</button>`).join('')}
      </div>`;
  const rightBtns = editing
    ? '<button class="sd-btn sd-mini-btn sd-primary sd-reader-save"><i class="fa-solid fa-check"></i>保存</button>'
    : `<button type="button" class="sd-icon-btn sd-reader-newpage" title="在新页面打开独立阅读" aria-label="在新页面打开"><i class="fa-solid fa-arrow-up-right-from-square"></i></button>
       <button type="button" class="sd-icon-btn sd-reader-edit" title="编辑" aria-label="编辑"><i class="fa-solid fa-pen"></i></button>
       <button class="sd-icon-btn sd-theater-reader-fav" title="收藏"><i class="${fav ? 'fa-solid fa-star sd-fav-on' : 'fa-regular fa-star'}"></i></button>`;
  return `
    <section class="sd-card sd-reader-card">
      <div class="sd-reader-bar sd-sticky-bar">
        <button class="sd-btn sd-mini-btn sd-theater-reader-back"><i class="fa-solid fa-arrow-left"></i>返回</button>
        ${fontControl}
        ${rightBtns}
      </div>
      <div class="sd-reader-title">
        <h3>${htmlEscape(THEATER_READ_TITLE)}</h3>
        <p class="sd-reader-subtitle">${htmlEscape(theaterSubtitle(scene))}</p>
      </div>
      ${bodyHtml}
    </section>`;
}

function renderTheaterFavoritesView() {
  const t = getTheater();
  const rows = t.favorites.length
    ? t.favorites.map((f) => `<article class="sd-lib-row"><div class="sd-lib-main"><h4>${htmlEscape(theaterOpening(f))}</h4><p class="sd-muted sd-fav-time">${htmlEscape(theaterSubtitle(f))} · ${htmlEscape(formatDateTime(f.createdAt))}</p></div>
      <div class="sd-lib-actions">
        <button type="button" class="sd-btn sd-lib-load sd-fav-read" data-id="${htmlEscape(f.id)}">阅读</button>
        <button type="button" class="sd-icon-btn sd-icon-sm sd-danger sd-fav-remove" data-id="${htmlEscape(f.id)}" title="移出收藏"><i class="fa-solid fa-star-half-stroke"></i></button>
      </div></article>`).join('')
    : '<p class="sd-muted">收藏夹还空着。</p>';
  return `
    <section class="sd-card sd-reader-card">
      <div class="sd-reader-bar sd-sticky-bar">
        <button class="sd-btn sd-mini-btn sd-theater-reader-back"><i class="fa-solid fa-arrow-left"></i>返回</button>
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
  return `<details class="sd-context-block" data-acc="theater-preset-entries"><summary><b>预设条目</b></summary><div class="sd-source-list sd-entry-scroll sd-scroll">${rows}</div></details>`;
}

async function stageTheaterScene() {
  if (!settings.enabled) return toast('千幕已关闭。', 'warning');
  if (theaterBusy) return;
  const t = getTheater();
  const instruction = String(t.instruction || '').trim();
  if (!instruction) return toast('请先写下此幕指令。', 'warning');
  const cfg = theaterApiConfig();
  const useExternal = settings.providerMode === 'external' || cfg;
  if (useExternal) {
    const eff = cfg || { apiUrl: settings.apiUrl, apiKey: settings.apiKey, model: settings.model };
    if (!(normalizeUrl(eff.apiUrl) && eff.apiKey && eff.model)) { apiToast(); return; }
  } else if (!getGenerateRaw()) {
    apiToast();
    return;
  }
  theaterBusy = true;
  theaterCancel = false;
  theaterAbort = new AbortController();
  renderBusyState();
  const startedAt = Date.now();
  const log = pushLog({ id: uid('log'), kind: 'theater', status: 'loading', time: new Date().toLocaleString(), duration: '', request: '', response: '', error: '' });
  try {
    const segments = [];
    // 幕外始终注入当前聊天的角色设定 + 用户人设 + 绑定世界书（独立于推演链路），预设条目作为额外叠加
    const defaultText = await buildTheaterDefaultText();
    if (defaultText) segments.push(defaultText);
    const presetText = await buildTheaterPresetText();
    if (presetText) segments.push(presetText);
    const useHistory = getTheater().useChatHistory !== false;
    if (useHistory) {
      const history = getTheaterChatHistoryText();
      if (history) segments.push(`【当前正文片段】（衔接背景：人物当前状态、关系与口吻锚点，并非要你续写正文）\n${history}`);
    }
    segments.push(`【此幕指令】\n${await resolveMacro(instruction)}`);
    if (useHistory) {
      segments.push('以上正文片段是衔接背景，请据此保持人物口吻、关系与既有事实一致；番外可自由延展想象，但不要与正文已发生的事实冲突。');
    }
    // 思维链隔离：要求把最终番外正文用 <幕外正文> 包裹，模型的推理/思考一律放在标签外。
    // 阅读页只取标签内正文，裸思维链不再泄漏；日志仍存完整原文便于调试。
    segments.push('【输出格式】请把最终要呈现给读者的番外正文，完整包裹在 <幕外正文> 与 </幕外正文> 标签之间。任何思考、分析、自我提示都放在标签之外，标签内只保留纯净的正文本身。若输出 HTML 页面，则把整段 HTML 放进标签内即可。');
    const userPrompt = segments.join('\n\n');
    const messages = [{ role: 'user', content: userPrompt }];
    log.request = clipLog(JSON.stringify(messages, null, 2));
    saveSettings();

    const onDelta = settings.streamEnabled ? makeStreamLogUpdater(log) : null;
    const raw = (settings.providerMode === 'sillytavern' && !cfg)
      ? await callSillyTavernModel(userPrompt, '', onDelta)
      : await callExternalApi(messages, onDelta, cfg, theaterAbort);
    if (theaterCancel) throw new Error('USER_CANCELLED');
    const content = String(raw || '').trim();
    log.response = clipLog(content);
    if (!content) throw new Error('模型返回为空');
    t.lastOutput = { id: uid('scene'), source: theaterScriptSource || '', instruction, content, isHtml: looksLikeHtml(extractTheaterBody(content)), createdAt: new Date().toISOString() };
    log.status = 'success';
    log.duration = `${((Date.now() - startedAt) / 1000).toFixed(1)}s`;
    saveSettings();
    // 完成提示与自动开卷仅在界面打开时进行：关掉千幕后台跑完不弹窗、不抢占界面，重开后从「最近一幕」即可阅读
    if (isModalOpen()) {
      toast('番外已落幕，静候开卷。', 'success');
      openTheaterReader(t.lastOutput);
    }
  } catch (error) {
    const msg = error?.name === 'AbortError' ? 'USER_CANCELLED' : (error?.message || String(error));
    log.status = msg === 'USER_CANCELLED' ? 'cancelled' : 'error';
    log.error = msg === 'INVALID_API_SETTINGS' ? '请检查API设置' : msg === 'USER_CANCELLED' ? '已取消生成' : msg;
    log.duration = `${((Date.now() - startedAt) / 1000).toFixed(1)}s`;
    saveSettings();
    if (isModalOpen()) {
      if (msg === 'USER_CANCELLED') toast('已取消生成。', 'warning');
      else if (msg === 'INVALID_API_SETTINGS') apiToast();
      else toast(`上演失败：${log.error}`, 'error');
    }
  } finally {
    theaterAbort = null;
    theaterCancel = false;
    theaterBusy = false;
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

// 幕外展示用正文提取：优先取 <幕外正文>…</幕外正文> 标签内的内容（裸思维链一并被挡在标签外丢弃）；
// 对模型偶发的标签残缺（漏闭合/漏起始/无标签/碎片）全部免疫，绝不因格式问题导致正文取空、连累「最近一幕」与按钮布局。
// 日志展示不走这里，仍显示完整原文。
function extractTheaterBody(text) {
  const raw = String(text || '');
  let body = '';
  // ① 完整标签对：取中间正文
  let m = raw.match(/<\s*幕外正文\s*>([\s\S]*?)<\s*\/\s*幕外正文\s*>/i);
  if (m && m[1].trim()) body = m[1];
  // ② 只有起始标签（漏闭合/被截断）：取其后全部
  if (!body) { m = raw.match(/<\s*幕外正文\s*>([\s\S]*)$/i); if (m && m[1].trim()) body = m[1]; }
  // ③ 只有闭合标签（漏起始）：取其前全部
  if (!body) { m = raw.match(/^([\s\S]*?)<\s*\/\s*幕外正文\s*>/i); if (m && m[1].trim()) body = m[1]; }
  // ④ 完全无标签：用全文回落
  if (!body) body = raw;
  // 防御：剥掉残留的「幕外正文」起始/闭合标签碎片，再剥裸思维链，杜绝碎片混入显示
  body = body.replace(/<\s*\/?\s*幕外正文\s*>/gi, '');
  return stripThinkChain(body).trim();
}

function openTheaterReader(scene) {
  if (!scene) return;
  theaterView = { mode: 'read', scene };
  activeTab = 'theater';
  renderModal();
}

// 保存阅读页编辑：更新 scene 内容并重判 HTML，同步到最近一幕与收藏（按 id 匹配）
function saveTheaterSceneEdit(scene, value) {
  const content = String(value || '').trim();
  if (!content) return toast('内容不能为空。', 'warning');
  scene.content = content;
  scene.isHtml = looksLikeHtml(extractTheaterBody(content));
  const t = getTheater();
  if (t.lastOutput && t.lastOutput.id === scene.id) {
    t.lastOutput.content = content;
    t.lastOutput.isHtml = scene.isHtml;
  }
  const fav = t.favorites.find((f) => f.id === scene.id);
  if (fav) { fav.content = content; fav.isHtml = scene.isHtml; }
  saveSettings();
  toast('已保存修改。', 'success');
}

function toggleTheaterFavorite(scene) {
  const t = getTheater();
  const exists = t.favorites.find((f) => f.id === scene.id);
  if (exists) {
    t.favorites = t.favorites.filter((f) => f.id !== scene.id);
    toast('已取消收藏。', 'info');
  } else {
    t.favorites.unshift({ id: scene.id, source: scene.source || '', instruction: scene.instruction, content: scene.content, isHtml: scene.isHtml, createdAt: scene.createdAt || new Date().toISOString() });
    t.favorites = t.favorites.slice(0, 50);
    toast('已收藏这一幕。', 'success');
  }
  saveSettings();
}

// 在浏览器新页面独立阅读当前一幕：HTML 幕原样载入，散文幕包一层阅读排版骨架
function openSceneInNewPage(scene) {
  if (!scene) return;
  const cleaned = extractTheaterBody(String(scene.content || ''));
  let doc;
  if (scene.isHtml || looksLikeHtml(cleaned)) {
    doc = /<html[\s>]/i.test(cleaned)
      ? cleaned
      : `<!doctype html><html lang="zh"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${htmlEscape(THEATER_READ_TITLE)}</title></head><body>${cleaned}</body></html>`;
  } else {
    const body = renderTheaterMarkdown(cleaned);
    doc = `<!doctype html><html lang="zh"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${htmlEscape(THEATER_READ_TITLE)}</title>
<style>body{margin:0;background:#f6f2ea;color:#2b2620;font-family:-apple-system,"Segoe UI","PingFang SC","Microsoft YaHei",sans-serif;line-height:1.85;}
.wrap{max-width:42rem;margin:0 auto;padding:48px 24px 96px;}
.wrap h1,.wrap h2,.wrap h3,.wrap h4{line-height:1.3;}
.wrap img{max-width:100%;height:auto;border-radius:8px;}
.wrap p{margin:0 0 1.1em;}
.wrap blockquote{margin:0 0 1.1em;padding:2px 16px;border-left:3px solid #c9bfa8;color:#6f6553;}
.sub{color:#8a7f6d;font-size:.9rem;margin:0 0 28px;letter-spacing:.02em;}</style></head>
<body><div class="wrap"><p class="sub">${htmlEscape(theaterSubtitle(scene))}</p>${body}</div></body></html>`;
  }
  try {
    const blob = new Blob([doc], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const win = globalThis.open(url, '_blank');
    if (!win) { URL.revokeObjectURL(url); toast('浏览器拦截了新页面，请允许本站弹窗后重试。', 'error'); return; }
    setTimeout(() => URL.revokeObjectURL(url), 60000);
  } catch (_) {
    toast('无法在新页面打开这一幕。', 'error');
  }
}

function openTheaterFavorites() {
  theaterView = { mode: 'favorites' };
  activeTab = 'theater';
  renderModal();
}

function bindTheaterTabEvents(root) {
  // 阅读 / 收藏夹 内嵌视图
  if (theaterView) {
    root.querySelector('.sd-theater-reader-back')?.addEventListener('click', () => {
      // 编辑态下「返回」先退出编辑回到阅读，避免误丢改动；阅读态再退出阅读
      if (theaterView?.editing) { theaterView.editing = false; renderModal(); return; }
      theaterView = null;
      renderModal();
    });
    if (theaterView.mode === 'read') {
      const scene = theaterView.scene;
      root.querySelector('.sd-reader-newpage')?.addEventListener('click', () => openSceneInNewPage(scene));
      root.querySelector('.sd-reader-edit')?.addEventListener('click', () => { theaterView.editing = true; renderModal(); });
      root.querySelector('.sd-reader-save')?.addEventListener('click', () => {
        const area = root.querySelector('.sd-reader-edit-area');
        if (!area) return;
        saveTheaterSceneEdit(scene, area.value);
        theaterView.editing = false;
        renderModal();
      });
      root.querySelector('.sd-theater-reader-fav')?.addEventListener('click', () => {
        toggleTheaterFavorite(scene);
        const icon = root.querySelector('.sd-theater-reader-fav i');
        if (icon) icon.className = isTheaterFavorited(scene.id) ? 'fa-solid fa-star sd-fav-on' : 'fa-regular fa-star';
      });
      root.querySelectorAll('.sd-reader-font-btn').forEach((el) => el.addEventListener('click', () => {
        getTheater().readerFontScale = el.dataset.scale;
        saveSettings();
        const prose = root.querySelector('.sd-reader-prose');
        if (prose) prose.dataset.scale = el.dataset.scale;
        root.querySelectorAll('.sd-reader-font-btn').forEach((b) => b.classList.toggle('active', b.dataset.scale === el.dataset.scale));
      }));
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
  root.querySelector('.sd-theater-use-history')?.addEventListener('change', (e) => {
    getTheater().useChatHistory = e.target.checked;
    saveSettings();
    renderModal();
  });
  root.querySelector('.sd-theater-history-depth')?.addEventListener('change', (e) => {
    getTheater().historyDepth = Math.max(1, Math.min(200, Number(e.target.value || 5)));
    saveSettings();
  });
  root.querySelector('.sd-theater-instruction')?.addEventListener('change', (e) => {
    getTheater().instruction = e.target.value || '';
    theaterScriptSource = '';   // 手动改动指令即视为即兴，脱离剧札来源
    saveSettings();
  });
  root.querySelector('.sd-theater-stage')?.addEventListener('click', () => {
    if (theaterBusy) { stopTheater(); return; }
    const ta = root.querySelector('.sd-theater-instruction');
    if (ta) { getTheater().instruction = ta.value || ''; saveSettings(); }
    stageTheaterScene();
  });
  root.querySelector('.sd-theater-save-script')?.addEventListener('click', async () => {
    const ta = root.querySelector('.sd-theater-instruction');
    const instruction = String(ta?.value || getTheater().instruction || '').trim();
    if (!instruction) return toast('请先写下此幕指令。', 'warning');
    const result = await promptNameAndFolder({ dialogTitle: '保存到剧札', namePlaceholder: '此幕剧名' });
    if (!result) return;
    if (!result.name) return toast('请为这一幕取个剧名。', 'warning');
    const t = getTheater();
    t.scripts.unshift({ id: uid('script'), title: result.name, folder: result.folder || '', instruction, createdAt: new Date().toISOString() });
    t.scripts = normalizeScripts(t.scripts);
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
      theaterScriptSource = s.title || '';   // 记录来源剧札名，供阅读页副标题显示
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
      if (isBuiltinScript(s)) {
        // 内置项不就地改（更新会被还原），改成派生一份用户副本，内置保持原样
        const fork = { id: uid('script'), title: edited.name || s.title, folder: sanitizeFolder(edited.folder), instruction: edited.content, createdAt: new Date().toISOString() };
        t.scripts = normalizeScripts([fork, ...t.scripts]);
        saveSettings();
        toast('内置剧札不可直接修改，已另存为你的副本。', 'success');
        renderModal();
        return;
      }
      s.title = edited.name || s.title;
      s.folder = edited.folder;
      s.instruction = edited.content;
      saveSettings();
      toast('剧札已更新。', 'success');
      renderModal();
    },
    onDelete: async (id) => {
      const yes = await confirmDialog('删除剧札', '确认删除这个剧札？');
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
    onBatchDelete: async () => {
      if (!theaterExportSelection.size) return toast('请先勾选要删除的剧札。', 'warning');
      const yes = await confirmDialog('批量删除', `确认删除选中的 ${theaterExportSelection.size} 个剧札？`);
      if (!yes) return;
      const t = getTheater();
      t.scripts = (t.scripts || []).filter((x) => !theaterExportSelection.has(x.id));
      theaterExportSelection.clear();
      theaterExportMode = false;
      saveSettings();
      toast('已删除。', 'success');
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
  a.download = `qianmu-scripts-${fileStamp()}.json`;
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
    const valid = incoming
      .map((item) => ({ item, instruction: item?.instruction || item?.content, title: item?.title || item?.name || '导入剧札' }))
      .filter((x) => x.instruction);
    // 去重只认用户项；与内置同名只视作"撞名"，不覆盖内置，改存成可见的用户副本
    const userByTitle = new Map((t.scripts || []).filter((s) => !isBuiltinScript(s)).map((s) => [s.title, s]));
    const builtinTitles = new Set((t.scripts || []).filter((s) => isBuiltinScript(s)).map((s) => s.title));
    const takenTitles = new Set([...userByTitle.keys(), ...builtinTitles]);
    const uniqueCopyTitle = (base) => {
      if (!takenTitles.has(base)) return base;
      let n = 1;
      while (takenTitles.has(`${base} (${n})`)) n++;
      return `${base} (${n})`;
    };
    const conflictNames = [...new Set(valid.map((x) => x.title).filter((n) => userByTitle.has(n)))];
    const decisions = await resolveImportConflicts(conflictNames);
    if (decisions === null) { toast('已取消导入。', 'info'); return; }
    let added = 0, updated = 0, skipped = 0, copied = 0;
    const fresh = [];
    for (const { item, instruction, title } of valid) {
      const existing = userByTitle.get(title);
      if (existing) {   // 命中用户项：按选择覆盖或跳过（覆盖保留原 id）
        if (decisions.get(title) === 'skip') { skipped++; continue; }
        existing.instruction = instruction;
        existing.folder = sanitizeFolder(item.folder || existing.folder);
        updated++;
        continue;
      }
      // 未命中用户项：若与内置撞名则换个可见副本名，内置保持原样
      const finalTitle = builtinTitles.has(title) ? uniqueCopyTitle(title) : title;
      if (finalTitle !== title) copied++; else added++;
      const script = { id: uid('script'), title: finalTitle, folder: sanitizeFolder(item.folder), instruction, createdAt: item.createdAt || new Date().toISOString() };
      fresh.push(script);
      userByTitle.set(finalTitle, script);
      takenTitles.add(finalTitle);
    }
    // 新条目作为用户剧札插到最前；normalizeScripts 只整顺序、不限数量
    t.scripts = normalizeScripts([...fresh, ...(t.scripts || [])]);
    saveSettings();
    const parts = [`新增 ${added}`, `覆盖 ${updated}`, `跳过 ${skipped}`];
    if (copied) parts.push(`内置同名另存副本 ${copied}`);
    toast(`导入完成：${parts.join('，')}。`, 'success');
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
    entry.addEventListener('click', () => openModal());   // 恢复上次 tab
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
  button.addEventListener('click', () => openModal());   // 恢复上次 tab
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
  // 自动推演触发：每有新角色回复（MESSAGE_RECEIVED）就照实数一遍——以 lastPlanIdx 为基准，统计其后真正新增的
  // 角色回复层，满阈值即刻推演、读取当下完整聊天。重 roll 同层改写不新增索引、天然不计；删楼则把基准夹回当前末尾自动重算。
  const refreshHandler = async () => {
    try {
      if (!settings.enabled) return;
      const chat = ctx().chat;
      const len = Array.isArray(chat) ? chat.length : 0;
      const store = getChatStore();
      let mark = Number(store.lastPlanIdx ?? -1);
      if (mark < 0 || mark > len - 1) mark = len - 1;   // 首次启用/删楼后：基准夹到当前末尾，既不漏数也不让历史楼层一次触发
      store.lastPlanIdx = mark;
      let layers = 0;                                    // 基准之后真正新增的「角色回复」层（你发的楼、system 都不计）
      for (let i = mark + 1; i < len; i++) {
        const m = chat[i];
        if (m && !m.is_user && !m.is_system) layers++;
      }
      if (settings.autoRefresh && settings.autoRefreshEvery > 0 && !busy && layers >= settings.autoRefreshEvery) {
        store.lastPlanIdx = len - 1;                     // 以当前末尾为新基准，下一轮重新累积
        await saveMetadata();
        await generateDirectorPlan(false, true);
      } else {
        await saveMetadata();
      }
    } catch (error) {
      console.warn(`[${MODULE_NAME}] auto refresh handler failed`, error);
    }
  };
  const rerenderHandler = async () => {
    settings = getSettings();
    injectSelection.clear();   // 切换聊天后旧写入勾选失效
    // 新角色/聊天可能绑定了不同世界书：作废世界书扫描态，下次推演或开取材页自动补扫（预设不随角色变，留存）
    contextScanCache.worldScannedAt = '';
    contextScanCache.boundWorldBookNames = [];
    contextAutoScanned = false;
    ttsExtractAutoScanned = false;   // 切聊天：配音「人设参照」也重新按新聊天补扫一次
    ttsLineCache.clear();      // 切聊天：旧消息台词缓存失效
    renderFloatButton();
    renderInputMenuEntry();
    await applyDirectorInjection();
    rerenderIfOpen();
    ttsStartChat();            // 新聊天 DOM 重建，重挂注入
  };
  // APP_READY：ST 注水 extensionSettings 完成的信号。init 经 setTimeout 抢跑可能早于注水，
  // 此时读到的 floatPosition 仍是默认 → 悬浮球落默认中位。注水后重读 settings 并按保存位重绘，根治「重载后球回默认位」偶发。
  const appReadyHandler = () => {
    settings = getSettings();
    renderFloatButton();
    ttsStartChat();   // ST 就绪后 #chat 已存在，挂上有声注入（init 抢跑时 #chat 可能尚未就位）
  };
  // 原地编辑正文：刻意不复位缓存——保留已提取台词与已生成音频，交用户手动决定（🔁 全量重提取 / 双击单句更新）。
  // 但 ST 保存编辑会重渲 .mes_text 内部 HTML，抹掉注入其中的内联 🔊（工具栏/台词条是兄弟节点、不受影响）。
  // 故只触发一次防抖扫描，由 ttsAutoRestore 的「自愈」分支按缓存幂等补回内联图标（延时让 ST 重渲先落定）。
  const ttsMessageEditedHandler = () => {
    const t = settings.tts || {};
    if (!t.enabled || !t.injectInChat) return;
    ttsScanDebounced(250);
  };
  const pairs = [
    [types.APP_READY || 'app_ready', appReadyHandler],   // 注水后把悬浮球挪回上次拖动的位置（修偶发回默认位）
    [types.MESSAGE_RECEIVED || 'message_received', refreshHandler],   // 仅角色回复触发；重 roll/删楼由 refreshHandler 照实重算
    [types.MESSAGE_DELETED || 'message_deleted', applyDirectorInjection],   // 删楼即刻重判注入：若已回退到推演前的长度，悬空检测会清空注入
    [types.MESSAGE_EDITED || 'message_edited', ttsMessageEditedHandler],   // 原地编辑：仅按缓存补回被重渲抹掉的内联 🔊（不动列表/音频/key）
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
  seedBuiltinTheaters();
  renderSettingsPanel();
  renderFloatButton();
  renderInputMenuEntry();
  startInputMenuObserver();
  resizeHandler = () => {
    const btn = document.getElementById(FLOAT_ID);
    if (btn) applyFloatPosition(btn);
    const tabsBar = document.getElementById(MODAL_ID)?.querySelector('.sd-tabs');
    if (tabsBar) updateTabsFade(tabsBar);
  };
  window.addEventListener('resize', resizeHandler);
  bindEvents();
  applyDirectorInjection();
  ttsStartChat();   // 若 ST 已就绪则即刻挂注入；未就绪由 APP_READY 兜底
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
  ttsStopChat();   // 清理有声注入的 observer/委托/挂件，避免停用或重载后残留
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
