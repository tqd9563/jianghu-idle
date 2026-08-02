# 埋点规格（合并版）

> **版本**：v2.0（合并 `../mvp0/telemetry.md` v1.1 + `../mvp1/telemetry.md` v1.0 + `../mvp2/telemetry.md` v1.0，去重去散，口径零变更）
>
> **日期**：2026-07-25
>
> **范围**：当前实现权威——全量埋点事件清单、公共信封、导出管线
>
> **范围纪律**：纯本地、JSON 一键导出、无服务端管线

## 公共信封

全部事件共享以下字段（由 `code/src/telemetry/telemetry.ts` 统一注入）：

| 字段 | 说明 |
|---|---|
| `run` | 当前轮次 |
| `realm` | 当前境界 |
| `route` | 当前路线 |
| `run_duration_s` | 本轮 tick 活跃秒（净时间口径） |

导出：`JSON` 格式，`exportTelemetryJSON()` 一键导出。

---

## 事件清单

### MVP-0 核心事件

| 事件名 | 触发时机 | 关键字段 |
|---|---|---|
| `run_start` | 新轮开始（归隐确认后） | `carry_xp` |
| `route_selected` | 选择路线 | `route` |
| `charge_segment_full` | 新高水位的周天段圆满 | `segment`, `realm_target` |
| `realm_breakthrough` | 突破成功 | `realm_to` |
| `skill_upgrade` | 武学升级 | `skill_level_to` |
| `mech_node_bought` | 购买机制节点 | `node_id` |
| `rep_node_bought` | 购买声望节点 | `node_id` |
| `battle_end` | 战斗结束 | `target`, `win`, `turns`, `hp_left_pct` |
| `key_battle_end` | Boss/精英战斗结束 | `target`, `win`, `turns` |
| `adjustment` | 失败后有意义调整 | `action`, `context` |
| `route_switch` | 换路线 | `from`, `to` |
| `retire_unlocked` | 归隐条件满足 | `kind`, `trigger` |
| `retire_confirmed` | 归隐确认 | `kind`, `prestige_total`, `run_duration_s` |
| `page_acquired` | 获得秘籍残页 | `page_id`, `channel` |
| `test_paused` / `test_resumed` | 观察员暂停/恢复 | — |

### MVP-1 离线事件

| 事件名 | 触发时机 | 关键字段 |
|---|---|---|
| `offline_settled` | 出关结算完成 | `idle_sec`, `neili`, `silver`, `xp`, `cap_hit`, `cap_min`, `debug_cap` |
| `offline_tax_revealed` | 出关结算税率条展示 | `efficiency_pct` |
| `session_start` | 页面激活（会话开始） | — |
| `session_end` | 页面关闭/失焦 | `reason`, `duration_sec` |
| `refresh_boundary_ok` | 刷新后存档无损 | `save_age_sec` |

### MVP-2 自然窗口事件

| 事件名 | 触发时机 | 关键字段 |
|---|---|---|
| `live_test_start` | 自然窗口开启 | `tables_version` |
| `visit_snapshot` | 每次页面打开 | `window_id`, `run`, `realm`, `tables_version_drift` |
| `natural_window_note` | 主观观察记录 | `date_time`, `opened_naturally`, `reason`, `capped`, `decision`, `next_goal`, `feeling` |
| `live_test_end` | 自然窗口结束 | `tables_version_started`, `tables_version_ended` |

---

## 口径守恒表

| 旧文档 | 新 § | 内容 | 处理 | 核对证据 |
|---|---|---|---|---|
| `mvp0/telemetry.md` | 公共信封 + MVP-0 事件 | 信封定义 + 核心事件表 | 逐字保留 | `telemetry.ts` 事件名比对 |
| `mvp1/telemetry.md` | MVP-1 事件 | 离线结算/会话事件 | 逐字保留 | 同上 |
| `mvp2/telemetry.md` | MVP-2 事件 | 自然窗口事件 | 逐字保留 | 同上 |
| 三份公共信封 | 公共信封 | 重复的 `run/realm/route` 定义 | 去重合并 | 三文件信封定义一致 |
