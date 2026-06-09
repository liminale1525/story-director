# 浮生剧编输出格式

扩展会在幕后要求模型输出固定 JSON 对象。前端根据这些字段展示审片、任务节点、角色世界和写入文本。

```json
{
  "schema_version": "1.1",
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
    "mood": "一句话氛围",
    "summary": "当前局势概述"
  },
  "quests": [],
  "story_nodes": [],
  "npc_updates": [],
  "world_updates": [],
  "director_comment": "导演评语",
  "next_refresh_hint": "下次刷新建议"
}
```
