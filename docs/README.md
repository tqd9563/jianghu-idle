# 文档规范

本文是 `docs/` 的目录、命名与写作规范。人类与 AI 在新增、移动或修改文档前都应先读本文。

---

## 0. 当前权威索引

### 当前实现权威（代码直接引用的数值/规则/文案）

| 文档 | 角色 | 代码引用 |
|---|---|---|
| `rules/formulas.md` | 核心公式表（境界曲线/突破消耗/武学/战斗/诊断） | formulas.ts, routes.ts, prestige.ts, enemies.ts |
| `rules/content.md` | 内容表（境界 1–7/5 地图/三路线/资源/秘籍接口） | content.ts, enemies.ts, routes.ts, mvp2Content.ts |
| `rules/economy.md` | 声望经济表（节点定义/归隐结算） | prestige.ts, enemies.ts |
| `rules/telemetry.md` | 埋点规格（三份合一） | telemetry.ts |
| `rules/offline-rewards.md` | 离线数值表（含决策保留/验收判据） | offlineRewards.ts, storage.ts |
| `rules/manual-fragments.md` | 秘籍残页规则层 | fragmentLogic.ts, fragments.ts |
| `rules/copy/battle.md` + `rules/copy/retire.md` + `rules/copy/zhoutian.md` | 冻结文案 | BattlePane.tsx, RetireFlow.tsx, RetireCeremony.tsx, RepPane.tsx, AcupointPanel.tsx |
| `systems/sim/mvp0_sim.py` | golden 对照 sim | combat.golden.test.ts, formulas.test.ts |

### 全局设计

| 文档 | 角色 |
|---|---|
| `overview/game-design.md` | 长线 GDD（通俗重写版，框架口径零变更） |
| `overview/worldview.md` | 世界观宪章 |

### 当前主题权威（主题版本设定+规格化）

| 文档 | 角色 | 代码引用 |
|---|---|---|
| `systems/zhoutian/design.md` | 周天系统（设定 + 数值表） | acupoints.ts, CultivatePane.tsx |
| `systems/zhoutian/spec.md` | 周天规格补充（呈现一致性 / 敌人曲线锚定） | AcupointPanel.tsx |
| `systems/zhoutian/sim.py` | 周天 sim | acupoints.test.ts |
| `systems/sect-neigong/design.md` | 门派/内功/主动武学设定（未规格化） | — |
| `rules/copy/zhoutian.md` | 周天冻结文案 | AcupointPanel.tsx |

### 历史收口与复现（已收口，不再作为开发权威；按需复现验证）

| 文档 | 状态 | 复现入口 |
|---|---|---|
| `archive/mvp0/closure.md` | 已收口，敞口 R1–R7 永久挂账 | — |
| `archive/mvp0/spec.md` | 已收口历史 | — |
| `archive/mvp0/scope.md` / `playtest-plan.md` / `simulation-report.md` | 未执行/已归档 | — |
| `archive/mvp2/closure.md` | 已收口，R7 销账，R8 待填 | — |
| `archive/mvp2/cadence.md` §7 | 主题版本节奏口径 | — |
| `archive/mvp2/sim/run_all_tests.py` | MVP-2 验证链主入口 | `python3 docs/archive/mvp2/sim/run_all_tests.py` |
| `archive/mvp2/sim/checkpoint_snapshot.py` | 动态加载 `systems/sim/mvp0_sim.py` | — |
| `archive/directions/*.md` | 已降为历史，被 systems/ 取代 | — |
| `archive/systems/zhoutian-meridian.md` + `zhoutian-meridian-spec.md` | 已被 `systems/zhoutian/design.md` v2.0 合并取代 | — |
| `archive/reviews/game-design-review.md` | 只读历史评审 | — |

---

## 1. 基本原则

- 文档链是实现的唯一输入源：数值出自内容表 / 公式表，UI 出自原型 + `DESIGN.md`，代码不得即兴改规则。
- 文档优先表达「当前权威口径」，历史理由只保留必要摘要；不要把评审过程全文塞进 frontmatter 或变更日志。
- 同一裁决 / 口径只在**一处**全文表述（权威位置），其余位置用 `§x.y` 指针，禁止逐处复述。
- 章节号是稳定锚点：代码注释与跨文档引用都锚在 `§x.y` 上——删并章节必须全仓修引用，否则保号不删。
- 文件路径表达类别，文件名表达主题；不要用超长文件名承担目录职责。
- 搬迁或改名文档时，必须同步更新所有引用。
- 历史评审记录默认只读；除非明确要求，不修改 `docs/archive/reviews/`。

---

## 2. 推荐目录结构

```text
docs/
  README.md                 文档规范 + 权威索引（§0）
  ISSUES.md                 问题记录
  overview/                 全局设计：game-design.md（长线 GDD）、worldview.md（世界观）
  rules/                    当前实现权威：公式表/内容表/经济表/埋点/离线/残页 + copy/（冻结文案）
  systems/                  当前主题权威，按模块分文件夹（见 §3.1）
    <模块名>/               如 zhoutian/、sect-neigong/
      design.md             该模块设定（结构、机制、裁决）
      spec.md               该模块规格（可实现数值表；与 design 合并时可省）
      sim.py                该模块专属 sim（可选）
    sim/                    跨模块全局 sim：mvp0_sim.py、export_fixtures.py
  design/                   获批交互原型 prototype.html、风格对比页
  archive/                  历史归档（只读）：mvp0/、mvp1/、mvp2/、systems/、directions/、reviews/
```

---

## 3. 文档类型归类

| 类型 | 推荐位置 | 说明 |
|---|---|---|
| 数值 / 公式表 | `docs/rules/formulas.md`、`docs/rules/offline-rewards.md` | 可实现的表与公式。 |
| 内容表 | `docs/rules/content.md` | 地图、敌人、关卡、路线等内容数据。 |
| 文案规格 | `docs/rules/copy/*.md` | 如战斗文案、归隐文案，不与公式表平级。 |
| 模块设定 / 规格 | `docs/systems/<模块名>/` | 当前主题模块的权威口径，命名见 §3.1。 |
| 全局模拟脚本 | `docs/systems/sim/` | 跨模块 sim 与 fixture 导出脚本。 |
| 交互原型 | `docs/design/` | 获批原型 prototype.html、风格对比页。 |
| 历史归档 | `docs/archive/` | mvp0/ mvp1/ mvp2/ systems/ directions/ reviews/，只读；历史核心规格（spec.md）与阶段收口（closure.md）均在此。 |

### 3.1 systems/ 模块目录规范

**路径表达模块，文件名表达类型**（§1 命名原则在本目录的落地）。每个系统/模块一个文件夹，文件夹内文件名从固定类型词表中取，不自创后缀：

| 文件 | 内容 | 必需性 |
|---|---|---|
| `design.md` | 设定：结构、机制、裁决 | 必需 |
| `spec.md` | 规格：可实现的数值表 | 规格化后必需；与 design 合并成单文档时省略，并在 design frontmatter 注明含规格 |
| `sim.py` | 该模块专属 sim 脚本 | 可选；多脚本时改用 `sim/` 子目录 |

配套规则：

- **文件齐备度 = 模块生命周期**：只有 `design.md` = 设定定稿未规格化；含 `spec.md`（或 design 注明含规格）= 可进实现。扫一眼目录即知每个模块的进度。
- **模块名用 kebab-case**，2–3 个词，表达系统而非文档（`zhoutian/`、`sect-neigong/`）。
- **被合并或取代的文档立即迁 `archive/systems/`**，不与取代它的文档并存于 `systems/`；合并文档须留「口径守恒表」记录旧 § → 新 § 映射，供旧引用回溯。
- 玩家可见文案不进本目录，统一归 `rules/copy/`。

---

## 4. Frontmatter 风格

文档开头使用短引用块。每个元素单独成段，中间空一行。只放索引信息，不放长论证。

推荐：

```md
> **版本**：v0.2
>
> **日期**：2026-07-06
>
> **状态**：草案
>
> **范围**：MVP-1 基础离线收益
>
> **上游**：`spec.md` §5 / §8.1
```

不推荐：

```md
> **版本**：v0.2（按所有者确认：资源口径为内力 / 银两 / 阅历；按当前最大可挂机关卡驱动；当前无在线挂机收益表；首发不接 VIP / 月卡 / 广告 / 特权）
```

长解释下沉到正文的「口径」「约束」「推导锚点」章节。

补充规则：

- 推荐字段：**版本 / 日期 / 状态 / 范围 / 上游**，按需加**配套、数值纪律**等；每字段一行、字段间空一行。
- **版本字段只放版本号**（至多附一个短括号，如 `v1.1（新增敞口 R7）`）；版本做了什么写进变更日志，不塞进版本号括号。
- **状态字段承载文档生命周期**（草案 / 已定稿 / 已交付 / 已收口 / 未执行存档），并给出结论所在的指针；不要用多段「状态声明」在正文反复宣告。

---

## 5. 变更日志风格

变更日志只写「改了什么」，不要写完整原因链。原因链放正文。

推荐：

```md
| 版本 | 日期 | 变更内容 |
|---|---|---|
| v0.2 | 2026-07-06 | 收敛资源口径、驱动方式与首发范围。 |
```

不推荐：

```md
| v0.2 | 2026-07-06 | 项目口径收敛：核心资源改为内力 / 银两 / 阅历；主驱动改为当前最大可挂机关卡；因当前无在线挂机收益表，本文直接给首发基础离线收益；删除 VIP / 月卡 / 广告 / 特权表；稀有掉落仅保留为空扩展，不进首发核心验收。 |
```

补充规则：**版本演进叙事不进正文**——「v0.2 原为 X、v0.3 改为 Y」类过程叙事只出现在变更日志（和 git 历史）；正文只表达当前口径，必要时留一枚「（v0.3 定稿）」日期戳指回变更日志。

---

## 6. 文件命名规则

- 使用小写 kebab-case：`offline-rewards.md`。
- 目录已经表达 MVP 时，文件名不要再重复 `mvp-0` / `mvp-1`。
- 文件名控制在 2–4 个词以内。
- 避免 `-note`、`-tables`、`-spec` 泛化后缀，除非它能区分同目录多个同名概念。

---

## 7. 搬迁流程

文档搬迁应作为一次明确的 IA 重构完成，不要零散移动。

1. 列出移动映射表。
2. 移动文件。
3. 全仓搜索旧路径和旧文件名。
4. 更新 README、frontmatter、正文相对链接与脚本路径。
5. 对脚本路径跑最小验证，例如模拟脚本、测试命令或链接搜索。
6. 在变更说明中列出保留的兼容路径或已删除路径。

禁止只移动文件而不修引用。

---

## 8. AI 写作约束

AI 在新增或修改文档时必须遵守：

- 先读本文和目标目录相邻文档，匹配现有口径。
- 不把猜测写成事实；未知项用「开放问题」或「待定」。
- 不在文档中新增未被用户或上游文档授权的系统范围。
- 不为了显得完整而添加商业化、留存、装备、奇遇等当前 MVP 明确排除项。
- 产表类文档必须给字段定义、首发值、验收映射和调参优先级。
- UI / 文案类文档必须引用 `DESIGN.md` 或对应原型，不在数值表里顺手设计界面。
- 新文档从第一版起按 §9 精简纪律写作；修订既有文档遵守 §9.2 边界。

---

## 9. 正文精简纪律

来源：2026-07-07 全链精简批次（MVP-1 规格书 17.8k → 9.4k 字符、口径零变更）反向固化的规则。目标是让新文档**从第一版起就不需要这样一轮精简**。

### 9.1 写作规则

1. **结论先行，理由一行**：每个裁决 = 结论 + ≤1 行理由摘要 + 出处指针。完整论证链要么删（git 与变更日志留痕即够），要么归 `docs/reviews/`。
2. **指针不转录**：引用其他文档时给 `文件 §x.y` 指针，不整段抄录原文——转录会在上游修订后变成陈旧副本。确需引用时 ≤1 句。
3. **表格单元格 = 一行结论**：裁决表的「理由」列放一句话；放不下的论证下沉正文对应小节或删。
4. **状态只宣告一次**：文档生命周期由 frontmatter「状态」字段承载（§4）；正文不设多点「状态声明」，不在每节重复同一终裁。
5. **长度自检**：单行超过 ~150 字，先怀疑是理由链该被压成结论；同一个词组（如某终裁的完整表述）在文中出现 ≥3 次，前 1 次留全文、其余改指针。

### 9.2 修订既有文档的边界（精简 / 重写 pass 的契约）

1. **表述可改，口径不可改**：数值、表格行列、验收判据、锁定规则一字不动；发现口径本身有问题，单独提出走裁决，不夹带在精简里。
2. **章节号不动**（同 §1 锚点原则）：精简后所有 `§x.y` 标题必须原位存在。
3. **冻结文案件（`copy/`）主体逐字不动**：只可整理头部注记；文案变更走冻结件发版流程，与精简严格分批。
4. **精简后必须验证**：全仓引用存在性检查 + 受影响脚本/测试跑通；变更日志记一行「表述精简，口径零变更」并升修订号。
