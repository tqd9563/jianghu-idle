# MVP-2 自然窗口埋点规格

> **版本**：v1.0
>
> **日期**：2026-07-14
>
> **状态**：已定稿
>
> **范围**：MVP-2C 单人 3–5 天自然回流窗口的开始、回访、轻量观察记录与结束
>
> **上游**：`cadence.md` §5 / §6 / §8、`../mvp0/telemetry.md`（公共信封与导出管线）、`../mvp1/telemetry.md`（离线结算事件）

---

## 0. 变更日志

| 版本 | 日期 | 变更内容 |
|---|---|---|
| v1.0 | 2026-07-14 | 定稿自然窗口四事件、版本漂移字段、客观访问快照与主观观察字段。 |

---

## 1. 纪律

- 复用 MVP-0 公共信封 `{ e, ts, run, realm, route }` 与本地持久化 / JSON 导出管线。
- 窗口只能由测试者主动开关；不设告警、日程、待办提醒或任何玩家侧提示，避免测试装置制造回流（`cadence.md` §5 / §8）。
- 窗口内不边测边改。窗口开始时冻结 `tables_version_started`；每次事件同时记录 `tables_version_current` 与漂移结果，供废窗判定。
- 客观字段只读取现有游戏状态与既有规则，不新增玩法阈值；主观字段只由观察者填写。

---

## 2. 窗口标识与版本字段

| 字段 | 类型 | 说明 |
|---|---|---|
| `window_id` | string | 新窗口开始时生成的本地唯一 ID；刷新与跨日回访保持不变，结束后清除活动记录。 |
| `started_at` | int | 窗口首次开始的 epoch 毫秒；刷新不改写。 |
| `tables_version_started` | string | 开窗时冻结的 `TABLES_VERSION`。 |
| `tables_version_current` | string | 事件发射时当前 `TABLES_VERSION`。 |
| `tables_version_changed` | bool | `tables_version_started !== tables_version_current`；为 true 时该窗口违反 §8「不边测边改」纪律。 |

---

## 3. 事件

### 3.1 `natural_window_started`

活动窗口不存在、测试者主动开始时发射一次。除 §2 字段外无专有字段；重复开始同一活动窗口不重发。

### 3.2 `natural_window_visit`

活动窗口内每次页面初始化完成后发射一次；若本页初始化后才新开窗口，则紧随 `natural_window_started` 发射一次。同一页面对同一窗口最多一次。

客观快照字段：

| 字段 | 类型 | 说明 |
|---|---|---|
| `max_cleared_stage` | string \| null | 当前轮已通关关卡中按既有全局顺序最远的 stage key；未通关为 null。 |
| `cleared_stage_count` | int | 当前轮 `clearedStages` 数量。 |
| `offline_settlement_present` | bool | 本次初始化是否有待呈现的既有出关结算。 |
| `offline_settlement_capped` | bool \| null | 有待呈现结算时取其 `capped`；否则 null。 |
| `decision_breakthrough` | bool | 按既有突破成本与当前内力是否可立即突破。 |
| `decision_skill` | bool | 已择路、未到当前境界既有技能上限且当前内力足够升一级。 |
| `decision_battle` | bool | 当前已解锁地图中是否存在下一待通关关卡。 |
| `decision_retire` | bool | 既有标准或保底归隐当前是否可用。 |

`run`、`realm`、`route` 来自公共信封。以上字段用于解释内容是否耗尽、回访后是否有现成决策，不替代 `cadence.md` §6 的人工判定。

### 3.3 `natural_window_note`

活动窗口内由观察者提交轻量记录时发射；不活动时不得发射。字段对应 `cadence.md` §5：

| 字段 | 类型 | 说明 |
|---|---|---|
| `natural_open` | bool | 是否自然想打开。 |
| `open_reason` | string | 打开原因，写入前去除首尾空白。 |
| `settlement_understood` | bool \| null | 出关结算是否看懂；本次无可观察结算时为 null。 |
| `decision` | string | 本次做了什么决策，去除首尾空白。 |
| `next_goal` | string | 关闭前下次目标，去除首尾空白。 |
| `feeling` | string | 一句话感受，去除首尾空白。 |

距离上次关闭、是否触顶等客观信息由事件时间与 `natural_window_visit` / `offline_settled` 派生，不要求观察者重复录入。

### 3.4 `natural_window_ended`

测试者主动结束活动窗口时发射一次，携带 §2 字段；发射后清除活动窗口记录。无活动窗口时结束操作无事件。

---

## 4. 判读边界

- 内容耗尽、目标是否存在、回访是否纯收菜、下一目标是否形成，按 `cadence.md` §6 联合客观快照与观察记录判读。
- `tables_version_changed = true` 只标记窗口发生表版本漂移，不自动解释结果或修补窗口。
- 本规格不定义提醒、打开诱因、玩家提示、留存阈值或新游戏决策；未被现有状态安全表达的内容保持未知。
