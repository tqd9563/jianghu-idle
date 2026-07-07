# MVP-1 埋点增补规格

> **版本**：v1.0
>
> **日期**：2026-07-07
>
> **状态**：当期事件已定稿；节拍类指标保留定义、后置启用
>
> **范围**：MVP-1 出关结算 / 会话事件（当期启用）+ 回访节拍派生指标（后置启用）
>
> **上游**：`spec.md` §7.3 / §8.1；`offline-rewards.md` 表 A / 表 C；`../mvp0/telemetry.md`（信封与导出管线复用）

---

## 0. 变更日志

| 版本 | 日期 | 变更内容 |
|---|---|---|
| v1.0 | 2026-07-07 | 首版：定稿当期两事件（offline_settled / offline_settlement_closed），登记三项后置派生指标。 |

---

## 1. 纪律

- 按 MVP-0 埋点规格范围纪律另立本文，不在 `../mvp0/telemetry.md` 上扩建；该文档零改动。
- 复用 MVP-0 公共信封 `{ e, ts, run, realm, route }` 与本地持久化 / 一键导出管线（`telemetry.ts` 不换格式）。
- 事件名以本文为准，实现不得自创；后置指标当期**只采集不判定**（判定阈值随阶段 B 预登记表定稿，`spec.md` §8.2）。

---

## 2. 当期启用事件（服务 §8.1 A1 对账）

### 2.1 `offline_settled` —— 出关结算入账

发射时点：`store.init` 完成离线结算并入账之后（含静默入账）；原始离线 < 5 秒的热刷新不发射（A5 在线连续处理的实现下界）。

| 字段 | 类型 | 说明 |
|---|---|---|
| `raw_offline_s` | int | 原始离线秒（时钟回拨时为 0） |
| `effective_min` | float | 有效闭关分钟（截断后，2 位小数） |
| `cap_min` | int | 实际生效上限（含调试覆盖） |
| `capped` | bool | 是否触顶 |
| `stage_basis` | int | 当前最大可挂机关卡（全局 1–28） |
| `tier_id` | int | 命中的表 A 档位 id（1001–1008） |
| `efficiency` | float | 离线效率因子 |
| `neili` / `silver` / `xp` | int | 三资源实发值（floor 后） |
| `silent` | bool | 是否静默入账（raw < 180s 不弹结算屏） |
| `debug_cap` | bool | 本次是否使用调试覆盖上限（A4 验收记录须裸露） |

**A1 三处同源约定**：本事件三资源字段 = store 入账增量 = 结算屏显示值，同一份 `calculateOfflineRewards` 输出，禁止任何一处独立计算。

### 2.2 `offline_settlement_closed` —— 结算屏关闭

无专有字段。用途：`closed.ts − settled.ts` 即结算屏停留时长；结算屏关闭到首个决策事件的时延是 §6-4「30 秒内有事可做」的锚点（当期只采集，阈值判定后置）。

---

## 3. 后置启用（保留定义，不新增代码）

以下指标全部由既有事件派生，后置节拍验证（`spec.md` §8.2/§8.3，R7 销账窗口）启用时在分析脚本增列；当期不写脚本、不判定：

| 指标 | 派生口径 | 服务判据 |
|---|---|---|
| 回访间隔分布 | 相邻 `offline_settled` 的 `raw_offline_s` 分布 vs `cap_min` | §8.2-1 回访意愿 / §8.2-5 节奏形成 |
| 触顶浪费率 | `capped = true` 且 `debug_cap = false` 的占比 | §8.2-4 上限机制有效 |
| 空会话占比 / 决策时延 | `offline_settlement_closed` 到下一决策事件（`wugong_upgraded` / `realm_breakthrough` / `key_battle_end` / `mech_node_bought` / `prestige_node_bought` / `route_changed`）的存在性与时延 | §8.2-3 回访有决策 |
| 结算屏停留带 | `offline_settlement_closed.ts − offline_settled.ts` | §8.2-2 出关结算可信 |

---

## 4. 与 MVP-0 口径的隔离（A7）

- 离线时段不进入 `run_duration_s`（tick 活跃秒口径不变），不进入保底停滞计时——`offline_settled` 与轮内净时间两口径互不污染。
- MVP-0 既有事件的字段与发射时点零改动；`charge_segment_full` 在出关后首个 tick 按新水位一次性补发（同 ts 连发即补发口径，A2 注记）。
