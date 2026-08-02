# 《江湖无尽录》MVP-0 埋点与度量规格

> **版本**：v1.1
>
> **日期**：2026-07-06
>
> **范围**：§10 各标准的采集与计算口径（测什么、多少算过以 `spec.md` §10 为准）；v1.1 = 净时间/`run_duration_s` 定稿为 tick 活跃秒
>
> **配套**：`playtest-plan.md`（消费导出数据）、`formulas.md` §5（诊断规则编号）、`content.md` §2（关卡编号）、`economy.md`（结算字段与节点 ID）
>
> **范围纪律**：只服务一次性设计验证，不是产品分析体系——纯本地、JSON 一键导出、无服务端管线；MVP-1 长期数据体系另立规格（`../mvp1/telemetry.md`），勿在本文上扩建
>
> **当前权威移至**：`../../rules/telemetry.md` v2.0（与 mvp1/mvp2 telemetry 合并去重，口径零变更）。本文件仍保留为历史证据。

## 推导锚点

每个事件都必须能回答「服务 §10 的哪一条」；回答不了的事件不进清单：

| 锚点 | 目标 | 来源 |
|---|---|---|
| 标准 1：首次归隐完成率 | > 80%（只计完成两轮时长预算者） | 规格书 §10.1-1 及测试注 |
| 标准 2：能复述卡点原因 | 问卷为主，战斗数据交叉验证 | 规格书 §10.1-2 |
| 标准 3：Boss 2/3 前 ≥1 次有意义调整 | 行为事件判定 | 规格书 §10.1-3 |
| 标准 4：愿意开始第二轮 | 行为证据 + 问卷 | 规格书 §10.1-4 |
| 标准 5：第二轮明显更快 | 四里程碑提速 25%–40%（境界 2 为 30%–50%） | 规格书 §8.5/§10.1-5 |
| 标准 6：三流派各有优势场景 | 精英/Boss 战斗记录按路线分层 | 规格书 §10.1-6 |
| 节拍红线：相邻可见进展 ≤5 分钟 | §10.2「玩家只是在等」现象的客观佐证 | 规格书 §6.1/§10.2 |

> **§10.1 条目数说明**：规格书 §10.1 为六条成功标准（模拟表中编号 C1–C7 是把「完成率」与「归隐意愿」拆分统计的实现编号）。本文按规格书六条对齐。

---

## 1. 事件清单

### 1.0 公共信封（所有事件共有字段）

```json
{ "e": "事件名", "ts": 1751702400123, "run": 1, "realm": 3, "route": "tangmen" }
```

| 字段 | 类型 | 说明 |
|---|---|---|
| `e` | string | 事件名，snake_case，见下表 |
| `ts` | int | epoch 毫秒。轮内耗时一律由 `ts − 本轮 run_start.ts − 本轮累计暂停时长` 派生，事件里不冗余存相对时间 |
| `run` | int | 轮次编号，1 起。归隐确认（`retire_confirmed`）后 +1 |
| `realm` | int | 事件发生时的当前境界（1–5） |
| `route` | string \| null | 当前路线：`huashan` / `shaolin` / `tangmen` / null（未选） |

路线、地图、关卡、精英、Boss、声望节点、诊断规则的取值域分别以内容表 §2/§3 与声望经济表 §2、公式表 §5 的编号为准，实现不得自创 ID。

### 1.1 会话与轮次

| 事件名 | 触发时机 | 专有字段 |
|---|---|---|
| `test_session_start` | 测试者进入游戏、观察员录入编号后 | `tester_id`（匿名编号如 `T03`）、`build`（前端构建号）、`tables_version`（数值表版本，如 `formula-v1.2/content-v1.1/economy-v1.0`）、`telemetry_spec: 1` |
| `test_session_end` | 观察员结束测试时手动触发 | `reason`：`completed`（完成两轮时长预算）/ `external_dropout`（时间/外部原因中断，出分母）/ `design_dropout`（不想玩了/卡死放弃，留在分母） |
| `test_paused` / `test_resumed` | 观察员通过调试面板手动暂停/恢复（如厕、被打断） | 无。所有时间类派生指标必须扣除 paused→resumed 区间，否则一次 5 分钟离席就能吞掉「提速 25%」的信号 |
| `run_start` | 首轮 = session_start 后立即；后续 = 归隐确认后新轮初始化完成时 | `owned_nodes`（已购声望节点 ID 数组）、`carry_xp`（继承阅历，当前只有武道笔记的 40） |

### 1.2 成长与调整（标准 3 的判定输入）

| 事件名 | 触发时机 | 专有字段 |
|---|---|---|
| `charge_segment_full` | 丹田内力越过新一段阈值（本境界新高水位首次越过才触发，回落后再越不重复；规格书 §6.1 v0.9 单钱包模型） | `realm_target`、`segment`（1–5） |
| `realm_breakthrough` | 玩家手动点击突破成功 | `realm_to` |
| `route_selected` | 首次选择路线（境界 2 弹层确认） | `route_to` |
| `route_changed` | 换路线结算完成 | `route_from`、`route_to`、`xp_refunded`、`fee_paid`（0 = 轻装上路生效） |
| `wugong_upgraded` | 武学升级 | `level_to`、`cost_neili` |
| `mech_node_bought` | 机制节点购买（阅历，内容表 §3.2） | `node_id`、`cost_xp` |

### 1.3 战斗与推进

| 事件名 | 触发时机 | 专有字段 |
|---|---|---|
| `stage_first_clear` | 任意关卡首通（本轮内） | `map`（1–3）、`stage`（关序号）、`kind`：`normal` / `elite` / `boss` |
| `key_battle_end` | **Boss 与精英的每一次挑战结束**（胜负都记），以及**任意普通关的失败**（普通关的胜利不单记，由 `stage_first_clear` 覆盖；回刷战斗刻意不采——不服务 §10 任何条目） | `target`（如 `boss2`、`elite_m2s4`、`m3s6`）、`tags`（敌人机制标签数组）、`result`：`win` / `lose`、`attempt`（对该目标的本轮第几次挑战）、`rounds`、`player_hp_pct`（战后玩家剩余气血%）、`enemy_hp_pct`、`diag`（仅 lose：命中的诊断规则编号数组，主 + 至多一条次优先，取值 1–7，定义见公式表 §5） |

### 1.4 归隐与声望（峰终时刻全链路）

| 事件名 | 触发时机 | 专有字段 |
|---|---|---|
| `retire_unlocked` | 归隐首次可用 | `kind`：`standard`（境界 5 + Boss 3）/ `fallback`（保底，即「保底归隐触发」）、`trigger`：`boss3_kill` / `fail_streak` / `stall_timeout`（后两者为规格书 §6.6 保底的两个触发器，记录连败次数/停滞分钟于 `detail`） |
| `retire_preview_opened` | 三栏损益预览打开（§8.6-1） | `kind` |
| `retire_cancelled` | 预览或二次确认中退出 | `step`：`preview` / `confirm` |
| `retire_confirmed` | 二次确认通过，归隐执行 | `kind`、`prestige_base`、`perf_bonus_pct`、`time_penalty`（正常为 1.0）、`fallback_discount`（正常为 1.0）、`prestige_total`、`run_duration_s`（**tick 累计活跃秒**：页面关闭与暂停期间不累计，定稿见《声望经济表》§6.4） |
| `prestige_node_bought` | 声望节点购买 | `node_id`（声望经济表 §2 的 8 节点）、`price`、`balance_after` |

### 1.5 自查：§10.1 逐条覆盖对照

| §10.1 | 需要的证据 | 覆盖事件 | 自查结论 |
|---|---|---|---|
| 1 完成率 | 分母（有效样本）与分子（首轮归隐达成） | `test_session_start/end`、`retire_confirmed(run=1)` | 覆盖。**协调清单原缺 `test_session_end`**——没有它无法区分「时间脱落」与「设计脱落」，分母口径（§10 测试注）无法执行，已补 |
| 2 卡点归因 | 主观复述（问卷）+ 实际失败原因 | `key_battle_end.diag` | 覆盖；问卷侧见测试方案 §5 |
| 3 有意义调整 | Boss 失败与下次挑战之间的调整动作 | `wugong_upgraded`、`realm_breakthrough`、`route_changed`、`mech_node_bought` | 覆盖。**协调清单原缺武学升级与机制节点购买两类事件**——它们恰是 §6.5 列出的最常见合法解法，缺了则标准 3 只能测出「换线」这种低频调整，已补 |
| 4 二轮意愿 | 是否开二轮 + 犹豫信号 | `run_start(run=2)`、`retire_preview_opened/cancelled`、`prestige_node_bought` 时刻 | 覆盖 |
| 5 二轮提速 | 四里程碑双轮时刻 | `realm_breakthrough(realm_to=2)`、`key_battle_end(boss1, win)`、`key_battle_end(boss2, attempt=1)`、`key_battle_end(boss3, win)` | 覆盖；「抵达 Boss 2」口径见 §2.2 |
| 6 流派优势场景 | 各路线对各标签敌人的战斗表现 | `key_battle_end`（含精英）按 `route × tags` 分层 | 覆盖。**精英战必须入清单**——克制矩阵全部落在精英身上（内容表 §2「精英分布与克制教学职责」），只采 Boss 则标准 6 无数据 |
| §6.1 节拍红线 | 相邻可见进展间隔 | §2.6 定义的可见进展事件集 | 覆盖，服务 §10.2「只是在等」现象的客观判定 |

---

## 2. 派生指标口径

所有时间均为**轮内净时间**：`事件.ts − 该轮 run_start.ts − 区间内累计暂停时长`。**实现权威口径为 tick 累计活跃秒**（页面关闭期间同样剔除——对齐「页面关闭不结算」红线；受控测试环境下页面常开，两口径等价），定稿见《声望经济表》§6.4；离线分析脚本按 ts 差扣暂停计算时，须用导出数据中的 `run_duration_s` 交叉校验。

### 2.1 首次归隐完成率（标准 1）

```text
分母 = test_session_end.reason ∈ {completed, design_dropout} 的测试者数
       （external_dropout 剔除——时间原因脱落不计，§10 测试注口径）
分子 = 分母中存在 retire_confirmed(run=1) 的测试者数
目标 = 分子/分母 > 80%（规格书 §10.1-1；小样本报告方式见测试方案 §2）
附报 = 分子中 kind=standard 与 kind=fallback 的比例
       （保底是安全网不是达标路径：若 fallback 占比 > 1/3，即使完成率达标
        也应按 §10.2「首次归隐不可达」方向复查曲线——本判读线为本文新增建议，
        规格书未定义，测试后按实际分布回填规格书 §10）
```

### 2.2 二轮提速比（标准 5，对齐 §8.5 四里程碑）

```text
提速比(m) = 1 − t₂(m) / t₁(m)，tᵣ(m) = 第 r 轮到达里程碑 m 的轮内净时间

| 里程碑 m       | 取时事件                                   | 目标（§8.5）  |
|---------------|-------------------------------------------|--------------|
| 到达境界 2     | realm_breakthrough(realm_to=2)             | 30%–50%      |
| 击败 Boss 1    | key_battle_end(target=boss1, result=win) 首次 | 25%–40%   |
| 抵达 Boss 2    | key_battle_end(target=boss2, attempt=1)（首次挑战即视为抵达，胜负不论） | 25%–40% |
| 击败 Boss 3    | key_battle_end(target=boss3, result=win) 首次 | 可更快，但第二轮须仍存在 ≥1 次调整（用 §2.3 判据核验） |
```

### 2.3 「有意义调整」判据（标准 3）

```text
对某 Boss 的一次失败 key_battle_end(target=bossN, result=lose) 而言：
  若在该事件与对同一 Boss 的下一次 key_battle_end 之间，发生 ≥1 个
  {wugong_upgraded, realm_breakthrough, route_changed, mech_node_bought} 事件，
  则该次失败后的重试记为「调整后重试」；否则记为「纯重试」。

标准 3 达成（单个测试者）= Boss 2 或 Boss 3 的失败序列中至少存在一次「调整后重试」。
附报：纯重试占比——若某测试者对同一 Boss 纯重试 ≥3 次，对应 §10.2
「玩家只是在等/无脑连点」现象，供测试报告引用。
```

窗口以「下一次挑战」为界而非固定时长：15–30 秒不可跳过的战斗演出（规格书 §7.1）已保证两次挑战之间有真实决策窗，无需再叠时间窗参数。

### 2.4 二轮意愿的行为证据（标准 4，辅助问卷）

```text
主证据 = run_start(run=2) 存在（在时长预算内主动开二轮）
辅助信号 = 归隐犹豫时长：retire_unlocked → retire_confirmed 的净时间；
           预览反复率：retire_preview_opened 次数与 retire_cancelled 次数
（犹豫长短本身不判对错——「继续刷表现分」是合法策略（§8.2），
 行为数据只用于给访谈提供追问线索，结论以问卷为准）
```

### 2.5 峰终流程兑现检查（§8.6-4）

```text
落地兑现时延 = 首个 prestige_node_bought.ts − retire_confirmed.ts
目标 ≤ 30 秒（规格书 §8.6-4「永久变强在归隐后 30 秒内被兑现」）
```

### 2.6 最大无进展间隔（§6.1 节拍红线）

```text
可见进展事件集 = { charge_segment_full, realm_breakthrough, stage_first_clear,
                   wugong_upgraded, mech_node_bought, key_battle_end(result=win) }
最大无进展间隔 = 单轮内相邻两个可见进展事件的最大净时间差
红线 = ≤ 5 分钟（规格书 §6.1；模拟基线 4.4 分钟，见公式表附录 A）
```

### 2.7 标准 2 / 标准 6 的数据侧角色

两条标准以问卷/观察为主判（见测试方案 §5），埋点只做交叉验证：标准 2 用 `key_battle_end.diag` 对照测试者口述归因是否与实际失败原因一致；标准 6 把 `key_battle_end` 按 `route × tags` 分层汇总（跨测试者），核对「唐门对高防更顺、华山对高闪吃瘪」等克制关系是否在真人数据中复现模拟表结论。

---

## 3. 导出方式（最低格式约定）

- **持久化**：事件随存档同级写入 localStorage（追加式数组），崩溃/刷新不丢；这是存档最低规格（实现路线图）对埋点的唯一要求。
- **导出**：调试面板一个「导出测试数据」按钮，生成单个 JSON 文件下载，命名 `mvp0_{tester_id}_{yyyymmdd}.json`。
- **格式**：

```json
{
  "meta": {
    "tester_id": "T03",
    "build": "…",
    "tables_version": "formula-v1.2/content-v1.1/economy-v1.0",
    "telemetry_spec": 1,
    "exported_at": 1751709600000
  },
  "events": [ { "e": "…", "ts": 0, "run": 1, "realm": 1, "route": null } ]
}
```

- **消费方式**：派生指标（§2）由一个本地脚本离线计算（建议并入 `sim/` 目录，python3 无依赖，与模拟器同仓便于口径对照），不做实时看板。**已落地**：`sim/analyze_telemetry.py`（§2.1–§2.7 逐节实现，多测试者汇总）；样例输入见 `sim/sample/`（由前端会话模拟器 `code/src/telemetry/session.sim.test.ts` 以假时钟 + 种子随机驱动真实事件链生成，确定性可复现，其中含 §4 要求的 2 分钟暂停验收案例，实测净时间交叉校验 Δ0.0s）。
- **隐私**：`tester_id` 为匿名编号，文件中不出现姓名/联系方式；对应关系只存在于测试方案的纸面名册。

---

## 4. 实现验收清单

- [ ] 全部事件按 §1 字段落点，ID 取值域与三张内容/经济表一致。
- [ ] 暂停区间在所有净时间计算中被正确扣除（用一次人工 2 分钟暂停案例验收）。
- [ ] 预试跑导出文件经 §2 脚本计算后，六条标准 + 两条附加指标全部能算出数值（预试跑的验收职责见测试方案 §4）。
- [ ] 刷新页面后事件序列无丢失、无重复。
