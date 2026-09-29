# 埋点规格（合并版）

> **版本**：v2.6
>
> **日期**：2026-09-29
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
| `run_start` | 新轮开始（归隐确认后） | `owned_nodes`, `wuxing`（本世悟性） |
| `neigong_selected` | 境界 2 选定本世所修内功 | `neigong`, `quality` |
| `charge_segment_full` | 新高水位的周天段圆满 | `segment`, `realm_target` |
| `realm_breakthrough` | 突破成功 | `realm_to`, `first_reach`（首达即得宿慧） |
| `zhong_upgraded` | 内功升一重 | `neigong`, `zhong_to`, `cost_neili` |
| `dunwu` | 顿悟跨过内功台阶 | `neigong`, `tier`, `zhong`, `wuxing` |
| `wuxue_equipped` | 装上一门武学 | `wuxue`, `slots` |
| `form_learned` | 顿悟领悟武学新招 | `form` |
| `shop_bought` | 书肆购买 | `item`, `price` |
| `boss_drop` | Boss 首杀掉落 | `track`, `got` |
| `rep_node_bought` | 购买声望节点 | `node_id` |
| `battle_end` | 战斗结束 | `target`, `win`, `turns`, `hp_left_pct` |
| `key_battle_end` | Boss/精英战斗结束 | `target`, `win`, `turns` |
| `adjustment` | 失败后有意义调整 | `action`, `context` |
| `neigong_switched` | 一世之内转修 | `from`, `to`, `same_route`, `zhong_from`, `zhong_to`, `fee_paid` |
| `retire_unlocked` | 本世首次可归隐 | `kind`（恒为 `standard`）, `trigger`（`first_breakthrough`） |
| `retire_confirmed` | 归隐确认，或寿终正寝自动归隐 | `kind`（`standard` 主动 / `natural` 寿终正寝）, `age_at_end`, `weighted_hours`, `prestige_base`, `front_mult`, `fame_this_life`, `prestige_total`, `run_duration_s` |
| `test_paused` / `test_resumed` | 观察员暂停/恢复 | — |

### MVP-1 离线事件

| 事件名 | 触发时机 | 关键字段 |
|---|---|---|
| `offline_settled` | 出关结算完成 | `idle_sec`, `neili`, `silver`, `cap_hit`, `cap_min`, `debug_cap` |
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

### 受伤与转世事件

| 事件名 | 触发时机 | 关键字段 |
|---|---|---|
| `injury_inflicted` | 硬仗失败或惨胜留伤 | `target`, `injury`, `severity`, `win`, `player_hp_pct`, `became_heavy`, `lethal`, `lifespan_lost` |
| `forced_reincarnation` | 战死触发被迫转世 | `cause`（恒为 `battle`；v2.4 起寿终改报 `retire_confirmed` 的 `natural`）, `age_at_death`, `lifespan_lost`, `prestige_total`, `run_duration_s`, `era_end` |

- `injury_inflicted` 自受伤系统（PR #16）起已在代码中上报，v2.1 补登。
- 强制转世**不发** `retire_confirmed`；两者互斥，各自计一次转世。其后照常发 `run_start`。

### 长线声望事件（v2.2）

| 事件名 | 触发时机 | 关键字段 |
|---|---|---|
| `fame_gained` | 首次击败精英 / Boss、首次贯通经脉（跨世一次） | `source`（`elite` / `boss` / `meridian`）, `key`, `reputation` |
| `ganwu_bought` | 购买修行感悟（一级或尽数） | `level_from`, `level_to`, `price`, `balance_after` |
| `tier_unlocked` | 打通段末 Boss 开出新前沿（跨世保留） | `by`（关卡键）, `opened`（`{图}-{难度}` 列表） |

- 关卡键 v2.3 起为 `m{图}t{难度}s{关}`：`stage_first_clear` 增加 `tier` 字段，`key_battle_end.target` / `injury_inflicted.target` 改为关卡键（原 `boss1` / `elite_m2s4` 形态退役）。
- 长线起保底归隐废止（`economy.md` §1.4）：`retire_unlocked` 不再有 `fallback` 形态；`retire_confirmed` 的 `perf_bonus_pct` / `time_penalty` / `fallback_discount` 三个字段随 v1.3 公式退役，改报三层公式的构成（`weighted_hours` × 10 → `prestige_base`，× `front_mult` → `prestige_total`）。

---

## 口径守恒表

| 旧文档 | 新 § | 内容 | 处理 | 核对证据 |
|---|---|---|---|---|
| `mvp0/telemetry.md` | 公共信封 + MVP-0 事件 | 信封定义 + 核心事件表 | 逐字保留 | `telemetry.ts` 事件名比对 |
| `mvp1/telemetry.md` | MVP-1 事件 | 离线结算/会话事件 | 逐字保留 | 同上 |
| `mvp2/telemetry.md` | MVP-2 事件 | 自然窗口事件 | 逐字保留 | 同上 |
| 三份公共信封 | 公共信封 | 重复的 `run/realm/route` 定义 | 去重合并 | 三文件信封定义一致 |

## 变更日志

| 版本 | 日期 | 变更内容 |
|---|---|---|
| v2.6 | 2026-09-29 | 武学实装：新增 `wuxue_equipped` / `form_learned` / `shop_bought` / `boss_drop`。 |
| v2.5 | 2026-09-29 | 门径并入内功（issue #36）：`route_selected` / `route_switch` / `skill_upgrade` / `mech_node_bought` 改为 `neigong_selected` / `neigong_switched` / `zhong_upgraded`，新增 `dunwu`；秘籍阁废止，`page_acquired` 等残页事件删除；阅历冻结，`run_start.carry_xp` 与 `offline_settled.xp` 删除。 |
| v2.4 | 2026-09-29 | 多天一世：寿终正寝改报 `retire_confirmed`（`kind: natural`），新增字段 `age_at_end`；`forced_reincarnation` 只剩战死（`../systems/pacing/design.md` 裁决 19）。 |
| v2.3 | 2026-09-29 | 长线第 5b 步：关卡键加难度，`stage_first_clear` 加 `tier`，target 改关卡键；新增 `tier_unlocked`。 |
| v2.2 | 2026-09-28 | 长线第 4 步：`realm_breakthrough` 加 `first_reach`；`retire_unlocked` 只剩 `first_breakthrough` 一种触发；`retire_confirmed` 改报三层公式构成；新增 `fame_gained`、`ganwu_bought`。 |
| v2.1 | 2026-09-24 | 新增「受伤与转世事件」：补登 `injury_inflicted`，新增 `forced_reincarnation`；注明 `fallback_discount` 恒为 1。 |
| v2.0 | — | 合并三份阶段埋点规格，去重去散，口径零变更。 |
