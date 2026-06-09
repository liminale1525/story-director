# Story Director 固定输出格式

插件允许玩家自由写“剧本方案”，但模型输出必须统一成以下结构，方便前端固定展示。

```json
{
  "schema_version": "1.0",
  "story_status": {
    "title": "当前故事标题",
    "current_arc": "当前主线篇章",
    "current_stage": "当前阶段",
    "cycle": "大致周期",
    "progress": 0,
    "tension": 0,
    "romance": 0,
    "mystery": 0,
    "danger": 0,
    "mood": "氛围",
    "summary": "当前局势概述"
  },
  "quests": [
    {
      "id": "q1",
      "type": "main/side/hidden/relationship/world",
      "title": "任务标题",
      "objective": "目标",
      "description": "说明",
      "priority": "high/medium/low",
      "status": "open/optional/urgent/dormant",
      "deadline": "无/未来几轮/今夜/3天内/本周",
      "trigger": "触发条件",
      "reward": "收益",
      "inject_prompt": "可直接写入输入框的文本"
    }
  ],
  "story_nodes": [
    {
      "id": "n1",
      "title": "节点标题",
      "trigger": "触发条件",
      "foreshadowing": "伏笔",
      "event": "事件",
      "consequences": "后果",
      "priority": "high/medium/low",
      "inject_prompt": "可直接写入输入框的文本"
    }
  ],
  "npc_updates": [
    {
      "name": "NPC姓名",
      "role": "NPC定位",
      "current_goal": "当前目标",
      "progress": 0,
      "emotional_state": "情绪状态",
      "next_action": "下一步行动",
      "hidden_agenda": "隐藏动机",
      "relationship_to_user": "与玩家关系",
      "inject_prompt": "可直接写入输入框的文本"
    }
  ],
  "world_updates": [
    {
      "type": "news/weather/faction/rumor/environment/calendar/other",
      "title": "世界变化标题",
      "content": "内容",
      "impact": "影响",
      "timing": "现在/今晚/未来几轮/未来3天/本周",
      "inject_prompt": "可直接写入输入框的文本"
    }
  ],
  "director_comment": "导演评语",
  "next_refresh_hint": "建议何时重新刷新"
}
```
