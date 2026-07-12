# 《江湖无尽录》MVP-2A 内容表

> **版本**：v0.3
>
> **日期**：2026-07-10
>
> **状态**：草案——Realm 6/7 与 Boss 4/5 战斗数值已定；其余内容收益仍待定
>
> **范围**：境界跨度、主线地图、Boss 门槛、挑战节点、敌人变体与秘籍残页接口
>
> **上游**：`content-depth.md`、`manual-fragments.md`、`cadence.md` §3、`../overview/worldview.md`、`../mvp0/content.md`
>
> **数值纪律**：Realm 6/7 与 Boss 4/5 战斗值为本段权威；收益、事件与 bank 未授权时保持待定

---

## 0. 变更日志

| 版本 | 日期 | 变更内容 |
|---|---|---|
| v0.1 | 2026-07-10 | 新建：MVP-2A 内容纵深结构表骨架，未填最终数值。 |
| v0.2 | 2026-07-10 | 收口内容数量边界：2 张新地图、2 个主线 Boss、2 个固定挑战节点。 |
| v0.3 | 2026-07-12 | 定稿 Realm 6/7、Boss 4/5 绝对战斗值、技能上限与可复现调参规则。 |

---

## 1. 表格使用纪律

| 规则 | 说明 |
|---|---|
| 结构先行 | 本表先确定有哪些内容位、各自负责什么，不定数值强度。 |
| 数值后置 | 任一 HP、攻击、防御、收益、成本、价格、轮长、分钟锚点均由 MVP-2B 定。 |
| 复用白名单 | 新行只复用既有属性、状态、标签与战斗结算。 |
| 不开系统 | 挑战节点不是秘境；敌人变体不是新机制；地图扩容不是剧情系统。 |
| 奖励分工 | 主线推进、真传试炼、声望商店各司其职，见 `manual-fragments.md` §3。 |

---

## 2. 境界跨度表（结构）

| realm_band | role | unlock_purpose | numeric_status |
|---|---|---|---|
| `mvp0_band` | 既有 5 境界压缩段 | 作为 MVP-2A 前半程和回归对照 | 沿用 MVP-0；重锚由 MVP-2B 复核 |
| `mvp2a_extension_band` | MVP-2A 后续成长段 | 承接 `map_04_candidate` / `map_05_candidate`、Boss 4 / Boss 5 与两处挑战节点 | MVP-2B 定 |
| `future_late_band` | 完整版后段占位 | 不进 MVP-2A，仅防误把终局写入本批 | 不进本批 |

字段定义：

| 字段 | 定义 |
|---|---|
| `realm_band` | 境界跨度结构 ID，不等于具体境界名表。 |
| `role` | 该跨度在 MVP-2A 中承担的进度角色。 |
| `unlock_purpose` | 该跨度解锁内容或承接卡点的目的。 |
| `numeric_status` | 数值状态；除既有 MVP-0 对照外，均为 MVP-2B 定。 |

---

## 3. 地图与主线节点表（结构）

| map_id | display_name_status | position | purpose | boss_gate | numeric_status |
|---|---|---|---|---|---|
| `map_01`-`map_03` | 既有 | MVP-0 主线 | 作为前半程与回归对照 | Boss 1-3 | 沿用 MVP-0；MVP-2B 复核 |
| `map_04_candidate` | `[待命名]` | MVP-2A 新增主线前段 | 承接 MVP-0 末端，教学新敌人组合，提供中段 Boss 锚点 | `boss_04_candidate` | MVP-2B 定 |
| `map_05_candidate` | `[待命名]` | MVP-2A 新增主线后段 | 作为 3-5 天窗口末端可见目标，承接末端 Boss 与高压挑战 | `boss_05_candidate` | MVP-2B 定 |

字段定义：

| 字段 | 定义 |
|---|---|
| `map_id` | 地图结构 ID；`map_04_candidate` / `map_05_candidate` 为本批批准结构位，命名与数值待定。 |
| `display_name_status` | 地图名状态；未定名不得写组织归属或门派源流。 |
| `position` | 在 MVP-2A 主线中的位置。 |
| `purpose` | 对自然回流验证的作用。 |
| `boss_gate` | 该地图对应的主线门槛。 |
| `numeric_status` | 数值状态。 |

---

## 4. Boss 与门槛节点表（结构）

| boss_id | map_or_gate | mechanical_role | required_existing_tags | reward_pointer | numeric_status |
|---|---|---|---|---|---|
| `boss_01`-`boss_03` | 既有 MVP-0 主线 | 前半程声望与归隐对照 | 既有标签 | `../mvp0/economy.md` | 沿用 MVP-0；MVP-2B 复核 |
| `boss_04_candidate` | `map_04_candidate` | 新增中段主线瓶颈；中段归隐 / 声望锚点 | 高防 + 高攻；备选高闪 + 轻反伤 | 主线推进 / 首通资源 / 归隐表现；不掉真传残页 | MVP-2B 定 |
| `boss_05_candidate` | `map_05_candidate` | MVP-2A 末端主线目标；末端归隐 / 声望主锚点 | 高攻 + 净化 + 高防或反伤之一 | 主线推进 / 首通资源 / 归隐表现主锚点；不掉真传残页 | MVP-2B 定 |

字段定义：

| 字段 | 定义 |
|---|---|
| `boss_id` | Boss / 门槛结构 ID。 |
| `map_or_gate` | 所属地图或解锁门槛。 |
| `mechanical_role` | 它制造的决策或瓶颈职责。 |
| `required_existing_tags` | 只允许引用既有标签；不得新增状态或结算规则。 |
| `reward_pointer` | 奖励归属指针；不在本文给数值。 |
| `numeric_status` | 数值状态。 |

---

## 5. 挑战节点表（结构）

| challenge_id | unlock | purpose | uses_existing_systems | reward_pointer | numeric_status |
|---|---|---|---|---|---|
| `trial_jinglei` / `trial_zhenyue` / `trial_shigu` | Boss 2 后 | 门径真传试炼 | 是；详见 `manual-fragments.md` §3.1 | 门径真传残页 | MVP-2B 定 |
| `elite_challenge_04_candidate` | `map_04_candidate` 中段或 Boss 4 前后 | 中段回访挑战；训练第一组变体组合 | 是 | 挑战首通 / 表现项待经济表裁决；不掉真传残页 | MVP-2B 定 |
| `elite_challenge_05_candidate` | `map_05_candidate` 中段或 Boss 5 前后 | 窗口末端可选攻克目标；验证高压组合 | 是 | 挑战首通 / 表现项待经济表裁决；不掉真传残页 | MVP-2B 定 |

字段定义：

| 字段 | 定义 |
|---|---|
| `challenge_id` | 固定挑战节点 ID。 |
| `unlock` | 解锁位置或条件。 |
| `purpose` | 该挑战在回访目标中的作用。 |
| `uses_existing_systems` | 是否只用既有战斗系统；本批必须为“是”。 |
| `reward_pointer` | 奖励职责，不填数值。 |
| `numeric_status` | 数值状态。 |

主线里程碑口径：`boss_04_candidate` 与 `boss_05_candidate` 是 MVP-2A 新增主线里程碑；精英挑战不是主线里程碑，只是回访目标。

---

## 6. 敌人变体表（结构）

| variant_id | teaches_or_tests | allowed_tags | recommended_use | new_rule_required |
|---|---|---|---|---|
| `variant_high_dodge` | 爆发落空与命中 / 必中需求 | 高闪 | `map_04_candidate` 普通敌；`elite_challenge_04_candidate`；`boss_04_candidate` 备选 | 否 |
| `variant_counter` | 高爆发反噬与血线管理 | 反伤 | `elite_challenge_04_candidate`；`map_05_candidate` 精英；`boss_05_candidate` 备选 | 否 |
| `variant_high_defense` | 破防、成长投入与通用战力检查 | 高防 | `map_04_candidate` 普通敌；`boss_04_candidate`；`boss_05_candidate` 备选 | 否 |
| `variant_poison_pressure` | 毒绕过护盾后的血线压力 | 毒 | `map_04_candidate` 精英；`elite_challenge_04_candidate` 备选 | 否 |
| `variant_cleanse` | 叠毒被打断后的节奏压力 | 净化 | `map_05_candidate` 普通敌；`elite_challenge_05_candidate`；`boss_05_candidate` | 否 |
| `variant_high_attack` | 高压短战与防御 / 护盾价值 | 高攻 | `map_05_candidate` 普通敌；`elite_challenge_05_candidate`；`boss_05_candidate` | 否 |

字段定义：

| 字段 | 定义 |
|---|---|
| `variant_id` | 敌人变体结构 ID。 |
| `teaches_or_tests` | 它让玩家理解或验证的战斗问题。 |
| `allowed_tags` | 允许使用的既有标签组合。 |
| `recommended_use` | 推荐分布位置；只表达结构意图，不代表最终数值强度。 |
| `new_rule_required` | 是否需要新属性、状态或结算规则；MVP-2A 必须为否。 |

---

## 7. 与秘籍残页的接口

| 接口 | 规则 |
|---|---|
| 主线 Boss | 不作为门径真传残页主渠道；继续服务推进、首通与归隐声望锚点。Boss 4 为中段锚点，Boss 5 为末端主锚点。 |
| 真传试炼 | 门径真传残页的固定来源，规则见 `manual-fragments.md` §3.1。 |
| 精英挑战 | 首版不掉真传残页；奖励职责限挑战首通 / 表现项，具体由经济表裁决。 |
| 声望商店 | 只做缺页补齐，不替代推 Boss / 打试炼。 |
| 离线 | 不推进 Boss / 关卡 / 试炼；不产残页。 |

---

## 8. MVP-2B 待填字段

| 类别 | 待填项 |
|---|---|
| 境界 | 具体名称、属性、突破成本、周天段与耗时锚点。 |
| 地图 | 节点数量、敌人分布、资源收益、推荐境界。 |
| Boss | 气血、攻击、防御、命中、闪避、标签组合、推荐境界。 |
| 挑战节点 | 难度、失败成本、首通奖励、是否计入声望表现。 |
| 敌人变体 | 数值倍率、出现位置、与三武学门径的通过性矩阵。 |
| 秘籍接口 | 真传试炼难度、残页节奏、商店价格与永久成长预算。 |

### 8.1 Realm 6/7 数值权威

| realm | HP | ATK | DEF | HIT | DODGE | 突破内力 | 武学上限 |
|---:|---:|---:|---:|---:|---:|---:|---:|
| 6 | 1,680 | 168 | 88 | 160 | 25 | 48,000 | 10 |
| 7 | 3,360 | 336 | 176 | 172 | 28 | 108,000 | 10 |

推导：从 Realm 5 冻结值逐境界对 HP/ATK/DEF 乘 `2.0`，每步以 Decimal `ROUND_HALF_UP` 取整；HIT/DODGE 每境界 `+12/+3`，防御公式 K=100 不变。本段技能上限固定 10：Realm 6 的 Boss 4 基线 r6l8 可升 l9；Realm 7 的 Boss 5 首战基线 r7l9 可升 l10，阶段完成目标仍为 r7l10，不开放 lv11。

### 8.2 Boss 4/5 战斗值与搜索纪律

| Boss | 首战基线 | 阶段转换 / 完成目标 | HP | ATK | DEF | HIT | DODGE | tags |
|---|---|---|---:|---:|---:|---:|---:|---|
| 4 | r6l8 | r5l8 → r6l9 | 3,024 | 470 | 422 | 160 | 25 | `high_defense`, `high_attack` |
| 5 | r7l9 | r6l9 → r7l10 | 5,376 | 504 | 722 | 172 | 28 | `high_attack`, `cleanse`, `high_defense` |

数值由 `sim/combat_tuning.py` 机械搜索：依 `(hp_scale, atk_scale, defense_scale)` 字典序扫描；HP `100%..3000%` 步长 10pp、ATK `5%..300%` 步长 5pp、DEF `20%..500%` 步长 10pp，均相对对应境界基础值 `ROUND_HALF_UP`。约束为三路线基线全败，且至少一个同路线武学 `+1` 通过；首个满足项即唯一 tie-break。战斗公式与三节点路线机制忠实移植 MVP-0，未修改其 golden 模块。

### 8.3 单次调整矩阵语义

一段周天仅是 `1/5` 资源进度，在现有模型没有属性，战斗结果记 `N/A`。武学调整只升一级且不得超过 lv10。改修使用同境界/目标等级的另一门径，200 银两可选且不累计；它是合法补充路径，不是所有路线的强制路径。完整逐路线结果见 `simulation-report.md` §3。

---

## 9. 验收映射

| MVP-2A 验收问题 | 本表提供的输入 |
|---|---|
| 3-5 天窗口是否有未完成目标 | `map_04_candidate` / `map_05_candidate`、Boss 与挑战节点结构位。 |
| 回访后是否有真实决策 | Boss、挑战节点、真传试炼与残页补齐分工。 |
| 是否避免系统膨胀 | §1 使用纪律、§6 新规则列、§7 残页接口。 |
| MVP-2B 能否重锚 | 所有数值敏感字段均标 MVP-2B 定。 |
