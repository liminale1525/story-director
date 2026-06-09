# 浮生剧编输出格式

前端根据这些字段展示审片、任务节点、角色世界和写入文本。周期、期限与时机字段建议从当前剧情语境中自然提炼，呈现未来可能的发展走向。

```json
{
  "schema_version": "1.1",
  "story_status": {
    "title": "当前故事标题",
    "current_arc": "当前主线篇章",
    "current_stage": "当前阶段与下一步可能走向",
    "cycle": "贴合剧情语境的时间跨度或节奏名",
    "progress": 0,
    "tension": 0,
    "romance": 0,
    "mystery": 0,
    "danger": 0,
    "mood": "一句话氛围",
    "summary": "当前局势与未来可展开方向"
  },
  "quests": [],
  "story_nodes": [],
  "npc_updates": [],
  "world_updates": [],
  "director_comment": "导演评语",
  "next_refresh_hint": "下次刷新建议"
}
```
