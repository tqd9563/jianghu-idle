# 文档系统性重构方案

> **版本**：v0.7
>
> **日期**：2026-07-25
>
> **状态**：方向记录，未立项——方案待所有者确认后执行
>
> **范围**：docs/ 目录全量文档系统性梳理方案（MVP-0/1/2 收口后，主题版本节奏下）
>
> **动机**：MVP-0/1/2 已收口，后续转入主题版本节奏；当前文档堆积过多、引用链过深、历史包袱与当前权威混杂，需系统性梳理

---

## 0. 方案路径选择

本方案经 Oracle 审查后采用**低风险渐进路径**：先解决"读者不知道什么是当前权威"的核心痛点，不立即全量归档。

**理由**：全仓 30 个文件引用旧路径（14 .ts + 3 .tsx + 2 .py + 10 .md + 1 动态路径构造），其中 2 处是运行时/测试依赖（`session.sim.test.ts` 输出目录、`checkpoint_snapshot.py` 动态加载 `mvp0_sim.py`）；另有 1 处人工 fixture 再生成注释（`combat.golden.test.ts` 说明 fixture 来源，但测试实际导入 `./golden/ev-fixtures.json`，非运行时依赖）。全量移动会引发大量路径变更、历史链接断裂和 Git blame 噪音，收益不成比例。

**分两阶段**：
- **阶段一（本次执行）**：建权威索引 + 精简规范文档 + 清理入仓垃圾。不动文件位置，零路径变更风险。
- **阶段二（后续按需）**：逐份迁移权威文档到 `rules/`，每份独立 PR + 口径守恒表。仅当确认收益大于风险时执行。

---

## 1. 现状诊断

### 1.1 数量与体量

> **统计范围**：`docs/` 目录下全部 .md 文件 + .py sim 脚本，不含 __pycache__/.pytest_cache 缓存。统计日期：2026-07-25。行数/体量可能随后续编辑变化，以实际文件为准。

| 层 | 文档数 | 体量 | 当前价值 |
|---|---|---|---|
| overview/（全局设计） | 2 | 38KB | 当前权威 |
| systems/（主题模块设定） | 4 + 1 sim | 60KB | 当前权威 |
| mvp0/（MVP-0 文档链） | 9 + sim | 130KB | 部分仍生效（formulas/content/copy/sim），大部分已收口 |
| mvp1/（MVP-1 文档链） | 4 | 44KB | 已收口，离线口径仍被代码引用 |
| mvp2/（MVP-2 文档链） | 7 + sim | 65KB | 已收口，cadence §7 仍有效；sim 不是纯历史（30+ 脚本含动态加载链） |
| directions/（方向记录） | 5 + 本方案 | 53KB | 已降为历史，全部被 systems/ 取代 |
| reviews/（评审记录） | 1 | 27KB | 只读历史 |
| 根目录规范 | 2 | 11KB | README 规范 + ISSUES |

### 1.2 核心问题

| # | 问题 | 证据 |
|---|---|---|
| P1 | **读者不知道什么是当前权威** | `mvp0/` 下 9 个文档并排，formulas.md（当前权威）与 spec.md（已收口历史）无法区分；无入口索引 |
| P2 | **引用链过深** | 「周天」要读 zhoutian-meridian.md + zhoutian-meridian-spec.md + zhoutian-direction-note.md + formulas.md §3.3 + spec.md §6.1 = 跳读 5 个文档 |
| P3 | **文档规范本身冗长** | `docs/README.md` 166 行，§2.1 迁移后规则 + §6 历史迁移映射表占大半 |
| P4 | **__pycache__ / .pytest_cache 入仓** | `mvp0/sim/__pycache__/` + `mvp2/sim/__pycache__/` + `.pytest_cache/` 共 30+ 缓存文件 |
| P5 | **方向记录未清理** | directions/ 5 个文件已被 systems/ 取代，仍占 35KB |
| P6 | **冻结文案分散** | `mvp0/copy/`（battle/retire）+ `systems/copy/`（zhoutian）两处管理 |
| P7 | **MVP 规格书过大** | `mvp0/spec.md` 446 行/40KB，最大文档，大部分已被实现 |

### 1.3 引用依赖全景（全仓搜索结果）

全仓 **29 个文件**引用 `docs/mvp0|docs/mvp1|docs/mvp2|docs/directions|docs/reviews` 路径。按类型分类：

#### 运行时/测试依赖（必须逐项修复，迁移会导致失败）

| 文件 | 行 | 引用 | 类型 |
|---|---|---|---|
| `code/src/telemetry/session.sim.test.ts` | :15 | `resolve(process.cwd(), '../docs/mvp0/sim/sample')` | 测试输出目录 |
| `docs/mvp2/sim/checkpoint_snapshot.py` | :11 | `Path(__file__).parents[2] / "mvp0" / "sim" / "mvp0_sim.py"` | 动态加载核心 sim |

> `combat.golden.test.ts:3` 提及 `docs/mvp0/sim/export_fixtures.py`，但只是注释说明 fixture 来源；测试实际导入 `./golden/ev-fixtures.json`，不运行时加载该脚本。归入"代码注释"类，但若需重新导出 fixture，它是人工再生成流程依赖。

#### 代码注释权威指针（批量更新，不影响运行）

13 个 .ts 文件 + 3 个 .tsx 文件（含 `combat.golden.test.ts`），头部注释 `权威来源：docs/mvp0/...` 或 `docs/mvp2/...`。完整清单见附录 A。

#### Python 脚本 provenance 字符串（数据溯源，不阻塞运行）

`docs/mvp2/sim/real_mapping.py` 内 9 处 `provenance=("docs/mvp0/content.md §1/§3/§4", ...)` 等。

#### 文档间互相引用（指针，不转录）

10 个 .md 文件互相引用 `../mvp0/`、`../mvp1/`、`../mvp2/` 路径。

---

## 2. 重构目标

| 指标 | 当前 | 目标 | 说明 |
|---|---|---|---|
| 日常导航面（入口页暴露的权威文档） | 28 个 | 12–14 个 | 读者只需看索引表即可找到当前权威 |
| 仓库体量（含归档） | 320KB | 不减少 | 归档不删除，只标记；仅删缓存和确认无引用的派生数据 |
| 入口索引 | 无 | 3 张表 | 当前实现权威 / 当前主题权威 / 历史收口与复现 |
| 跨文档跳读 | 5 个/概念 | ≤2 个/概念 | 合并设定+规格化、三份 telemetry 合一 |

---

## 3. 阶段一：建权威索引 + 精简规范 + 清理垃圾（本次执行）

### 3.1 在 `docs/README.md` 顶部增加三张权威索引表

```markdown
## 0. 当前权威索引

### 当前实现权威（代码直接引用的数值/规则/文案）

| 文档 | 角色 | 代码引用 |
|---|---|---|
| `mvp0/formulas.md` | 核心公式表（境界曲线/突破消耗/武学/战斗/诊断） | formulas.ts, routes.ts, prestige.ts, enemies.ts |
| `mvp0/content.md` | 内容表（境界/敌人/关卡数据） | content.ts, enemies.ts, routes.ts |
| `mvp0/economy.md` | 声望经济表（节点定义/归隐结算） | prestige.ts, enemies.ts |
| `mvp0/telemetry.md` + `mvp1/telemetry.md` + `mvp2/telemetry.md` | 埋点规格 | telemetry.ts |
| `mvp1/offline-rewards.md` | 离线数值表 | offlineRewards.ts |
| `mvp1/spec.md` §5/§8.1 | 离线功能口径 | offlineRewards.ts, storage.ts |
| `mvp0/copy/battle.md` + `mvp0/copy/retire.md` | 冻结文案 | BattlePane.tsx, RetireFlow.tsx |
| `mvp0/sim/mvp0_sim.py` | golden 对照 sim | combat.golden.test.ts, formulas.test.ts |
| `mvp2/content.md` | MVP-2 已落地内容数值（境界 6-7/精英挑战/秘籍残页数据） | mvp2Content.ts, enemies.ts |
| `mvp2/manual-fragments.md` | 秘籍残页规则层 | fragmentLogic.ts, fragments.ts |

### 当前主题权威（主题版本设定+规格化）

| 文档 | 角色 | 代码引用 |
|---|---|---|
| `systems/zhoutian-meridian.md` + `zhoutian-meridian-spec.md` | 周天系统设定+规格化 | acupoints.ts, CultivatePane.tsx |
| `systems/sect-neigong-active-skill.md` | 门派/内功/主动武学设定 | — |
| `systems/copy/zhoutian.md` | 周天冻结文案 | AcupointPanel.tsx |
| `systems/sim/zhoutian_sim.py` | 周天 sim | acupoints.test.ts |

### 历史收口与复现（已收口，不再作为开发权威；按需复现验证）

| 文档 | 状态 | 复现入口 |
|---|---|---|
| `mvp0/closure.md` | 已收口，敞口 R1–R7 永久挂账 | — |
| `mvp0/spec.md` | 已收口历史 | — |
| `mvp0/scope.md` / `playtest-plan.md` / `simulation-report.md` | 未执行/已归档 | — |
| `mvp2/closure.md` | 已收口，R7 销账，R8 待填 | — |
| `mvp2/cadence.md` §7 | 主题版本节奏口径 | — |
| `mvp2/sim/run_all_tests.py` | MVP-2 验证链主入口 | `python3 docs/mvp2/sim/run_all_tests.py` |
| `mvp2/sim/checkpoint_snapshot.py` | 动态加载 `mvp0/sim/mvp0_sim.py` | 路径：`Path(__file__).parents[2] / "mvp0" / "sim" / "mvp0_sim.py"` |
| `directions/*.md` | 已降为历史，被 systems/ 取代 | — |
| `reviews/game-design-review.md` | 只读历史评审 | — |
```

**验证**：索引表覆盖所有 29 个引用文件的文档来源；每个文档标注了当前角色（权威/历史/复现）。

### 3.2 精简 `docs/README.md` 正文

删除 §2.1 迁移后规则（历史）、§6 历史迁移映射表（历史）。保留 §1 基本原则、§3 文档类型归类（更新为含索引表指针）、§4 frontmatter 风格、§5 变更日志风格、§7 搬迁流程、§8 AI 写作约束、§9 精简纪律。

预计从 166 行精简至约 130 行。

### 3.3 清理入仓垃圾

```powershell
# 删除 Python 缓存（git rm 而非普通删除，确保 Git 跟踪状态同步）
git rm -r --cached docs/mvp0/sim/__pycache__
git rm -r --cached docs/mvp2/sim/__pycache__
git rm -r --cached docs/mvp2/sim/.pytest_cache
Remove-Item -Recurse -Force docs/mvp0/sim/__pycache__
Remove-Item -Recurse -Force docs/mvp2/sim/__pycache__
Remove-Item -Recurse -Force docs/mvp2/sim/.pytest_cache
# 加 .gitignore
Add-Content .gitignore "`n__pycache__/`n.pytest_cache/`n*.pyc"
```

**注意**：`sample/*.json` 是 `session.sim.test.ts` 的测试输出目录，**不删除**——删除会导致测试失败。`pretest/*.json` 是收口审计证据（`mvp0/closure.md` 引用），**不删除**。

**验证**：`git status` 确认缓存文件删除；`npm test` 确认 160 个测试仍通过（缓存不影响测试）。

### 3.4 在已收口文档头部加状态注记

对**整体已收口**的文档加历史注记；对**部分章节仍生效**的文档加"部分生效"注记。

**整体历史注记**（全文不再作为开发权威）：

```markdown
> **当前角色**：历史收口文档（见 `../README.md` §0 权威索引）
```

需要加整体历史注记的文件：`mvp0/spec.md`、`mvp0/scope.md`、`mvp0/playtest-plan.md`、`mvp0/simulation-report.md`、`mvp0/closure.md`、`mvp1/acceptance.md`、`mvp2/closure.md`、`mvp2/simulation-report.md`、`mvp2/content-depth.md`、`mvp2/resource-mapping.md`、`mvp2/telemetry.md`。

**部分生效注记**（§x.y 仍是当前实现口径，其余已收口）：

```markdown
> **当前角色**：阶段已收口；§x.y 仍是当前实现口径（见 `../README.md` §0 权威索引）
```

需要加部分生效注记的文件：
- `mvp1/spec.md`：§5（离线功能口径）/§8.1（验收判据）仍生效
- `mvp1/offline-rewards.md`：离线数值表仍生效
- `mvp1/telemetry.md`：埋点事件仍生效（合并在 §3.1 当前实现权威表）
- `mvp2/cadence.md`：§7（主题版本节奏口径）仍生效

**不需要加注记**的文件（仍是当前权威）：`mvp0/formulas.md`、`mvp0/content.md`、`mvp0/economy.md`、`mvp0/telemetry.md`、`mvp0/copy/*`、`mvp0/sim/mvp0_sim.py`、`mvp2/content.md`、`mvp2/manual-fragments.md`。

**directions/ 处理**：对 `directions/` 下 5 个已降为历史的方向笔记加历史注记；**排除 `directions/doc-restructure-plan.md`（本方案自身，状态为"待所有者确认后执行"，不应标为历史）**。

---

## 3.5 最终目标信息架构

阶段一（索引+注记）改善导航，阶段二（迁移+合并）完成实际整合。以下为全部文档最终归宿：

```text
docs/
  README.md                    文档规范 + 三张权威索引表（精简后 ~130 行）
  ISSUES.md                    问题记录
  overview/
    game-design.md             长线 GDD（通俗重写，~120 行；原 game-design-proposal.md 精简）
    worldview.md               世界观宪章（不变）
  rules/                        当前实现权威（从 mvp0/mvp1/mvp2 抽出合并）
    formulas.md                核心公式表（精简，~100 行）
    content.md                 内容表（合并 mvp0/content + mvp2/content 当前生效部分）
    economy.md                 声望经济表（精简）
    telemetry.md               埋点规格（三份合一，~120 行）
    offline-rewards.md         离线数值表（从 mvp1/offline-rewards.md 迁入；mvp1/spec.md §5/§8.1 口径合并入此）
    manual-fragments.md        秘籍残页规则层（从 mvp2/manual-fragments.md 迁入）
    copy/
      battle.md                战斗冻结文案（从 mvp0/copy 迁入）
      retire.md                归隐冻结文案（从 mvp0/copy 迁入）
      zhoutian.md              周天冻结文案（从 systems/copy 迁入）
  systems/                      当前主题权威
    zhoutian.md                周天系统（设定+规格化合并，~200 行）
    sect-neigong-active-skill.md  门派/内功/武学设定（不变）
    sim/
      zhoutian_sim.py          周天 sim
      mvp0_sim.py              核心 golden sim（从 mvp0/sim 迁入）
      export_fixtures.py       fixture 导出工具（从 mvp0/sim 迁入）
  archive/                      历史归档（只读，不作为开发权威）
    mvp0/                      MVP-0 完整文档链快照（先复制原目录，再从 rules/ 写精简版；archive/ 不被修改）
    mvp1/                      MVP-1 完整文档链快照
    mvp2/                      MVP-2 完整文档链快照（含 sim/ 复现链）
    directions/                方向记录（5 份已降为历史）
    reviews/                   评审记录
```

**归档操作顺序**（解决"完整快照"与迁移矛盾）：
1. 先 `Copy-Item -Recurse docs/mvp0/ docs/archive/mvp0/` 形成只读快照
2. 再将精简后的权威文档写入 `docs/rules/`（新文件，不从 archive/ 移走）
3. `archive/mvp0/` 保留原始完整内容，不被后续编辑修改——附录 A 已包含在 `archive/mvp0/formulas.md` 快照中，不新增提取件
4. 若需独立引用附录 A，指向 `archive/mvp0/formulas.md §附录A`（快照内已有，不新增文件）

### 完成定义

用户诉求"去繁求简、整合成新文档"在以下条件全部满足时视为完成：

1. `rules/` 目录存在且包含 formulas/content/economy/telemetry/offline-rewards/manual-fragments 六份精简/合并后的权威文档
2. `rules/copy/` 统一管理所有冻结文案（battle/retire/zhoutian）
3. `systems/zhoutian.md` 合并设定+规格化为单一文档
4. `overview/game-design.md` 通俗重写完成
5. `docs/README.md` 顶部三张权威索引表指向新路径
6. `archive/` 保留完整历史快照（先复制后精简，archive/ 不被修改）
7. 全仓旧路径引用零残留（运行时依赖 + 注释 + provenance 全部更新）
8. `npm test` + `python3 docs/archive/mvp2/sim/run_all_tests.py` 全通过（`checkpoint_snapshot.py` SIM_PATH 已更新指向 `docs/systems/sim/mvp0_sim.py`；`session.sim.test.ts` OUT_DIR 已改为非归档路径如 `code/test-output/`）

阶段二可分批实施（每份独立 PR），但上述 1–8 必须全部完成才算用户诉求达成。阶段一（索引+注记）是阶段二的前置条件，不单独构成"整合完成"。

---

## 4. 阶段二：逐份迁移权威文档（可分批实施，最小范围必须完成）

### 4.1 迁移原则

- 每份文档独立 PR，不批量迁移
- 迁移前生成**口径守恒表**（旧 § → 新 § 映射、数值表逐项比对、删除内容归宿）
- 迁移后全仓搜索旧路径，更新所有引用（运行时/测试依赖必须逐项验证）
- 归档目录保留完整历史快照，不从归档中移走文件（避免"归档不完整"矛盾）

### 4.2 迁移矩阵模板（每份迁移 PR 必须包含）

```markdown
## 口径守恒表

| 旧路径 | 新路径 | 旧 § | 新 § | 内容 | 原值 | 新值/逐字校验 | 核对证据 |
|---|---|---|---|---|---|---|---|
| mvp0/formulas.md | rules/formulas.md | §3.1 | §3.1 | 境界曲线底数 1.7 | ×1.7 | ×1.7（逐字一致） | `diff` 行级比对 + formulas.test.ts PASS |
| mvp0/formulas.md | rules/formulas.md | §3.3 | §3.3 | 突破消耗 2800/5000/10000/21000 | 2800/5000/10000/21000 | 逐字一致 | content.ts REALMS 值比对 |
| mvp0/formulas.md | rules/formulas.md | 附录 A | 删除 | 模拟报告 | 全表 | — | 归档至 archive/mvp0/formulas.md §附录A（快照内已有） |

## 运行时依赖更新

| 文件 | 行 | 旧引用 | 新引用 | 验证 |
|---|---|---|---|---|
| code/src/engine/formulas.ts | :2 | docs/mvp0/formulas.md | docs/rules/formulas.md | tsc + npm test |
| code/src/engine/routes.ts | :2 | docs/mvp0/formulas.md | docs/rules/formulas.md | tsc + npm test |

## 删除内容归宿

| 删除内容 | 原位置 | 归宿 | 理由 |
|---|---|---|---|
| 附录 A 模拟报告 | formulas.md §附录A | archive/mvp0/formulas.md §附录A（快照内已有，不新增提取件） | 历史证据，golden 结果可复现 |
| 防误读标注 | formulas.md §3.3 注记 | archive/ | MVP-0 原型尺度说明 |
```

### 4.3 迁移优先级（按引用依赖排序）

| 优先级 | 文档 | 运行时依赖 | 风险 |
|---|---|---|---|
| 1 | `mvp0/formulas.md` → `rules/formulas.md` | 5 个 .ts 注释引用 | 低（注释 only） |
| 2 | `mvp0/content.md` + `mvp2/content.md` 合并 → `rules/content.md` | 6 个 .ts 注释引用 | 中（合并去重 + 口径守恒） |
| 3 | `mvp0/economy.md` → `rules/economy.md` | 2 个 .ts 注释引用 | 低 |
| 4 | 三份 telemetry 合一 → `rules/telemetry.md` | 1 个 .ts 注释引用 | 中（合并去重） |
| 5 | `mvp1/offline-rewards.md` + `mvp1/spec.md §5/§8.1` → `rules/offline-rewards.md` | 3 个 .ts 注释引用 | 中（合并离线口径） |
| 6 | `mvp2/manual-fragments.md` → `rules/manual-fragments.md` | 2 个 .ts 注释引用 | 低 |
| 7 | `mvp0/sim/mvp0_sim.py` → `systems/sim/mvp0_sim.py` | **2 处运行时依赖 + 1 处人工再生成注释** | **高** |
| 8 | `systems/zhoutian-meridian.md` + `spec.md` 合一 | 0 运行时依赖 | 中（合并口径守恒） |

**优先级 7 风险最高**：需同步更新 3 处运行时/测试依赖：
1. `checkpoint_snapshot.py:11` 的 `SIM_PATH`：从 `Path(__file__).parents[2] / "mvp0" / "sim" / "mvp0_sim.py"` 改为指向 `docs/systems/sim/mvp0_sim.py`（或改为显式参数）
2. `session.sim.test.ts:15` 的 `OUT_DIR`：从 `../docs/mvp0/sim/sample` 改为非归档路径（如 `../code/test-output/`），避免向 `archive/` 只读快照写入测试输出
3. `combat.golden.test.ts:3` 注释：更新 fixture 来源路径指向新位置

### 4.4 reviews/ 治理规则同步

`AGENTS.md` 和 `docs/README.md` 写死了 `docs/reviews/` 为只读目录。若迁移 `reviews/` 到 `archive/reviews/`，必须同步修改：
- `AGENTS.md` 中 `docs/reviews/` 的引用
- `docs/README.md` §2 目录结构 + §3 文档类型归类

**建议**：阶段一不迁移 `reviews/`，仅在索引表标注角色。

---

## 5. 内容整合策略（阶段二执行）

### 5.1 `systems/zhoutian.md`（合并设定 + 规格化）

**当前**：`zhoutian-meridian.md`（204 行）+ `zhoutian-meridian-spec.md`（160 行）= 364 行。

**合并后**：约 200 行，结构：

```text
# 周天 · 经脉 · 窍穴系统

## 1. 一句话总览（蓄水池比喻，来自设定 §1.1）
## 2. 核心机制（用具体数字走一遍，来自设定 §1.2）
## 3. 数值表（来自规格化 §2-§6，定稿值）
## 4. 归隐与保留（来自规格化 §8）
## 5. 敞口（来自规格化 §12）
```

**口径守恒**：设定 §10 裁决记录（D1–D4）逐字保留；规格化 §6.3 单穴加成表逐行比对；变更日志合并。

### 5.2 `rules/formulas.md`（精简）

**当前**：180 行，含附录 A 模拟报告、防误读标注。

**精简后**：约 100 行。附录 A 保留在 `archive/mvp0/formulas.md §附录A`（快照内已有，不新增提取件；golden 结果可复现）。防误读标注移至归档（MVP-0 原型尺度说明）。**附录 A 不直接删除**——它被 `mvp2/resource-mapping.md` 和 `real_mapping.py` 引用，保留归档入口。

### 5.3 `rules/telemetry.md`（三份合一）

**当前**：`mvp0/telemetry.md`（157 行）+ `mvp1/telemetry.md`（52 行）+ `mvp2/telemetry.md`（66 行）= 275 行。

**合并后**：约 120 行。公共信封定义只留一份；事件清单按主题分组（MVP-0 基础 / MVP-1 离线 / MVP-2 自然窗口 / 主题版本）。

### 5.4 `overview/game-design.md`（通俗重写）

**当前**：`game-design-proposal.md` 237 行/29KB，含大量推导过程。

**重写后**：约 120 行，通俗语言。**前后示例**：

| 原文（jargon） | 重写（通俗） |
|---|---|
| 「转生建议包装为归隐、破而后立、重入江湖」 | 「每一轮江湖走完，可以选择'归隐'——散功重修，带着声望重新开始」 |
| 「资源三列账：来源、主消耗、后期 sink」 | 「每种资源都要回答三个问题：从哪来、花在哪、满了怎么办」 |
| 「乘区 ≤2、加法合并进本轮临时乘区」 | 「临时加成是加法叠加的，不会相乘膨胀」 |

---

## 6. 可读性提升策略

### 6.1 写作原则

1. **结论先行**：每段以结论开头，理由 ≤1 行
2. **通俗比喻**：复杂机制用生活化比喻（「丹田=蓄水池」「周天=进度条上的刻度线」）
3. **表格优先**：数值和规则用表格
4. **指针不转录**：引用其他文档给 `§x.y` 指针，不抄录
5. **去 jargon**：避免「裁决」「锁定点」「推广式」等内部术语

### 6.2 标题策略（保留稳定锚点）

**不改变章节编号**（README §1 锚点原则）。采用「编号 + 副标题」形式：

```markdown
## 5.2 冲击与温和失败：冲穴失败会怎样
```

保留 `§5.2` 锚点，加副标题让读者一眼看到主题。不重排编号、不删除章节。

### 6.3 验收方法

每种重写须满足：
1. 原章节号保留（`§x.y` 不动）
2. 原数值与验收判据逐字不变（口径守恒表比对）
3. 首次读者能回答该节的核心问题
4. 所有链接/指针有效

---

## 7. 执行时机

| 步骤 | 时机 | 分支 |
|---|---|---|
| 阶段一（索引+精简+清理） | 周天主题版本收口后 | 新建 `chore/doc-restructure` 分支 |
| 阶段二（逐份迁移） | 按需，每个主题版本间隙 | 每份独立 PR |

**禁止**：文档重构与主题版本功能代码混在同一批提交。

---

## 8. 迁移步骤（阶段一）

### 步骤 1：清理入仓垃圾

```powershell
git rm -r --cached docs/mvp0/sim/__pycache__
git rm -r --cached docs/mvp2/sim/__pycache__
git rm -r --cached docs/mvp2/sim/.pytest_cache
Remove-Item -Recurse -Force docs/mvp0/sim/__pycache__
Remove-Item -Recurse -Force docs/mvp2/sim/__pycache__
Remove-Item -Recurse -Force docs/mvp2/sim/.pytest_cache
Add-Content .gitignore "`n__pycache__/`n.pytest_cache/`n*.pyc"
```

**验证**：`git status` 确认缓存删除；`npm test` 确认 160 测试通过。

### 步骤 2：精简 `docs/README.md`

删除 §2.1 迁移后规则、§6 历史迁移映射表。顶部加三张权威索引表（§3.1）。保留当前规则部分。

**验证**：全仓搜索 `docs/README.md` 引用确认无断裂；`npm test` 通过。

### 步骤 3：给已收口文档加状态注记

按 §3.4 的分类清单执行：
- **整体历史注记**：`mvp0/spec.md`、`mvp0/scope.md`、`mvp0/playtest-plan.md`、`mvp0/simulation-report.md`、`mvp0/closure.md`、`mvp1/acceptance.md`、`mvp2/closure.md`、`mvp2/simulation-report.md`、`mvp2/content-depth.md`、`mvp2/resource-mapping.md`、`mvp2/telemetry.md`、`directions/` 下 5 个方向笔记（**排除 `doc-restructure-plan.md` 本身**）
- **部分生效注记**：`mvp1/spec.md`（§5/§8.1 生效）、`mvp1/offline-rewards.md`、`mvp1/telemetry.md`、`mvp2/cadence.md`（§7 主题版本节奏生效）

注记格式见 §3.4。

### 步骤 4：阶段一收尾验证

```powershell
# 1. 确认缓存已删
Test-Path docs/mvp0/sim/__pycache__; Test-Path docs/mvp2/sim/__pycache__
# 两者均应返回 False

# 2. 确认测试通过
cd code; npx --no-install vitest run; cd ..

# 3. 全仓递归枚举旧路径引用，与附录 A 逐项核对
$files = @()
$files += Get-ChildItem -Path "code\src" -Recurse -File -Include "*.ts","*.tsx"
$files += Get-ChildItem -Path "docs" -Recurse -File -Include "*.md","*.py"
$files += Get-Item "code\README.md","AGENTS.md","README.md","PRODUCT.md"
$files | Select-String -Pattern "docs/mvp0|docs/mvp1|docs/mvp2|docs/directions|docs/reviews" | Select-Object Filename,LineNumber,Line

# 4. 确认已收口文档都加了注记
$annotated = @(
  # 整体历史注记
  "docs\mvp0\spec.md","docs\mvp0\scope.md","docs\mvp0\playtest-plan.md","docs\mvp0\simulation-report.md","docs\mvp0\closure.md",
  "docs\mvp1\acceptance.md","docs\mvp2\closure.md","docs\mvp2\simulation-report.md","docs\mvp2\content-depth.md","docs\mvp2\resource-mapping.md","docs\mvp2\telemetry.md",
  "docs\directions\meridian-direction-note.md","docs\directions\recommended-realm-direction-note.md","docs\directions\retire-typewriter-direction-note.md","docs\directions\wuxue-collection-direction-note.md","docs\directions\zhoutian-direction-note.md",
  # 部分生效注记
  "docs\mvp1\spec.md","docs\mvp1\offline-rewards.md","docs\mvp1\telemetry.md","docs\mvp2\cadence.md"
)
$annotated | ForEach-Object { [PSCustomObject]@{File=$_; Found=(Select-String -Path $_ -Pattern "当前角色" -Quiet)} } | Format-Table -AutoSize

# 5. MVP-2 sim 复现链仍可运行（checkpoint_snapshot.py 动态加载未断裂）
python3 docs/mvp2/sim/run_all_tests.py
```

**验证通过条件**：步骤 1 返回 False；步骤 2 全测试 PASS；步骤 3 输出与附录 A 30 个文件一致；步骤 4 每个文件 Found=True；步骤 5 sim 全门禁通过。

### 步骤 5：CHANGELOG 记录

```markdown
### 变更
- **文档系统性梳理阶段一**：docs/README.md 增加三张权威索引表（当前实现权威/当前主题权威/历史收口与复现）；精简迁移历史；给已收口文档加状态注记；清理 __pycache__/.pytest_cache 入仓垃圾。
```

---

## 9. 风险与注意事项

| 风险 | 缓解 |
|---|---|
| 阶段一零路径变更 | 不移动文件，只加注记和索引 |
| 阶段二 `mvp0_sim.py` 迁移破坏动态加载 | 优先级 5，须同步更新 `checkpoint_snapshot.py:11` 路径 |
| 阶段二合并文档时口径被误改 | 每份 PR 附口径守恒表（§4.2），数值/验收逐项比对 |
| `sample/*.json` 被误删 | 标注为测试输出目录，不删；仅删缓存 |
| `reviews/` 迁移改变治理规则 | 阶段一不迁移，仅标注角色；阶段二须同步改 AGENTS.md |
| 迁移命令不适配 Windows | 用 PowerShell 命令（`Remove-Item`、`Add-Content`）而非 `rm -rf` |
| 附录 A 被误删 | 附录 A 被 `mvp2/resource-mapping.md` 和 `real_mapping.py` 引用，保留归档入口 |

---

## 10. 重构后文档清单（阶段一目标态）

| 路径 | 行数（估） | 角色 |
|---|---|---|
| `docs/README.md` | ~130 | 文档规范 + 三张权威索引表 |
| `docs/ISSUES.md` | ~14 | 问题记录 |
| `docs/overview/game-design-proposal.md` | ~237 | 长线 GDD（阶段二重写） |
| `docs/overview/worldview.md` | ~94 | 世界观宪章 |
| `docs/mvp0/formulas.md` | ~180 | 当前实现权威（阶段二迁入 rules/） |
| `docs/mvp0/content.md` | ~108 | 当前实现权威（阶段二迁入 rules/） |
| `docs/mvp0/economy.md` | ~125 | 当前实现权威（阶段二迁入 rules/） |
| `docs/mvp0/telemetry.md` | ~157 | 当前实现权威（阶段二合一） |
| `docs/mvp0/copy/battle.md` | ~90 | 冻结文案 |
| `docs/mvp0/copy/retire.md` | ~145 | 冻结文案 |
| `docs/mvp0/sim/mvp0_sim.py` | ~624 | golden sim（阶段二迁入 systems/sim/） |
| `docs/mvp1/*` | — | 已收口（加状态注记） |
| `docs/mvp2/*` | — | 已收口（加状态注记；sim 保留复现入口） |
| `docs/directions/*` | — | 已降历史（加状态注记） |
| `docs/reviews/*` | — | 只读历史 |
| `docs/systems/*` | — | 当前主题权威（不变） |

**阶段一成果**：零路径变更 + 权威索引表 + 已收口文档标注角色 + 缓存清理。读者从 README 顶部索引表即可找到当前权威，无需翻阅全部 28 个文档。

---

## 附录 A：代码注释权威指针完整清单（30 个文件）

> 全仓文本搜索 `docs/mvp0|docs/mvp1|docs/mvp2|docs/directions|docs/reviews` 命中 29 个文件；另有 1 个文件（`checkpoint_snapshot.py`）通过 `Path(__file__).parents[2] / "mvp0"` 动态构造路径，未命中文本搜索，合计 30 个。

### 运行时/测试依赖（2 处，迁移时必须逐项修复）

| 文件 | 行 | 引用 | 类型 |
|---|---|---|---|
| `code/src/telemetry/session.sim.test.ts` | :15 | `../docs/mvp0/sim/sample` | 测试输出目录 |
| `docs/mvp2/sim/checkpoint_snapshot.py` | :11 | `Path(__file__).parents[2] / "mvp0" / "sim" / "mvp0_sim.py"` | 动态加载 |

### 代码注释权威指针（16 处，批量更新，不影响运行）

> 含 `combat.golden.test.ts:3`（注释说明 fixture 来源，测试实际导入 `./golden/ev-fixtures.json`，非运行时依赖；但重新导出 fixture 时是人工再生成流程依赖）。

| 文件 | 行 | 引用 |
|---|---|---|
| `code/src/telemetry/telemetry.ts` | :2 | `docs/mvp0/telemetry.md` |
| `code/src/engine/routes.ts` | :2-3 | `docs/mvp0/content.md §3` + `docs/mvp0/formulas.md` |
| `code/src/save/storage.ts` | :4 | `docs/mvp1/spec.md §5` |
| `code/src/engine/formulas.ts` | :2-3 | `docs/mvp0/formulas.md §2/§3` + `docs/mvp0/sim/mvp0_sim.py` |
| `code/src/engine/prestige.ts` | :2-3 | `docs/mvp0/economy.md` + `docs/mvp0/copy/retire.md` |
| `code/src/engine/enemies.ts` | :2-3 | `docs/mvp0/content.md §2` + `docs/mvp2/content.md §9.2` |
| `code/src/engine/offlineRewards.ts` | :2-3 | `docs/mvp1/offline-rewards.md` + `docs/mvp1/spec.md §5/§8.1` |
| `code/src/engine/offlineRewards.test.ts` | :2-3 | `docs/mvp1/spec.md §8.1` + `docs/mvp1/offline-rewards.md §3.3` |
| `code/src/engine/content.ts` | :2-3 | `docs/mvp0/content.md` + `docs/mvp2/content.md §8.1` |
| `code/src/engine/mvp2Content.ts` | :1,63,225 | `docs/mvp2/content.md` |
| `code/src/engine/fragmentLogic.ts` | :1 | `docs/mvp2/manual-fragments.md` |
| `code/src/engine/fragments.ts` | :2 | `docs/mvp2/manual-fragments.md` |
| `code/src/engine/combat.golden.test.ts` | :3 | `docs/mvp0/sim/export_fixtures.py`（注释，非运行时） |
| `code/src/panes/RepPane.tsx` | — | `docs/mvp0/economy.md` |
| `code/src/overlays/RetireFlow.tsx` | — | `docs/mvp0/copy/retire.md` |
| `code/src/overlays/RetireCeremony.tsx` | — | `docs/mvp0/copy/retire.md` |

### Python provenance 字符串（9 处，数据溯源）

| 文件 | 引用 |
|---|---|
| `docs/mvp2/sim/real_mapping.py` | 9 处 `provenance=("docs/mvp0/content.md §...", ...)` |
| `docs/mvp2/sim/elite_challenge_search.py` | `docs/mvp2/content.md §5/§6/§9.4` |

### 文档间互相引用（10 个 .md 文件）

| 文件 | 引用 |
|---|---|
| `AGENTS.md` | `docs/reviews/` |
| `README.md` | `docs/mvp0/`、`docs/mvp2/` |
| `PRODUCT.md` | `docs/mvp0/` |
| `docs/README.md` | `docs/mvp0/`、`docs/mvp1/`、`docs/mvp2/`、`docs/reviews/` |
| `docs/overview/game-design-proposal.md` | `docs/mvp0/` |
| `code/README.md` | `docs/mvp0/sim/` |
| `docs/mvp1/spec.md` | `../mvp0/closure.md` |
| `docs/mvp2/sim/README.md` | `mvp0/sim/` |
| `CHANGELOG.md` | `docs/mvp2/` |
| `docs/directions/doc-restructure-plan.md` | 本文档自身 |

---

## 变更日志

| 版本 | 日期 | 变更内容 |
|---|---|---|
| v0.1 | 2026-07-25 | 首版方案。 |
| v0.2 | 2026-07-25 | 经 Oracle 审查后重构：改为两阶段渐进路径（先建索引不立即全量归档）；补全 29 个文件引用清单（附录 A）；区分运行时依赖 vs 注释 vs provenance；解决"完整归档"矛盾；加口径守恒表模板；修正标题策略（编号+副标题）；修正体量指标；修正删除依据（sample 不删）；修正迁移命令为 PowerShell；加执行时机建议。 |
| v0.3 | 2026-07-25 | 经 Oracle 第二轮审查修复 7 项：§3.1 补 mvp2/content.md + manual-fragments.md 入当前实现权威表；§3.4 拆分整体历史 vs 部分生效注记（mvp1/spec.md §5/§8.1 等仍生效不标历史）；排除 doc-restructure-plan.md 自身被标历史；§1.3 + 附录 A 移 combat.golden.test.ts 到注释类（非运行时依赖）、计数修正 29→30（含 checkpoint_snapshot.py 动态路径未命中文本搜索）；§4.2 口径守恒表加"原值/新值"和"核对证据"列；§8 步骤 3 同步 §3.4 分类清单、加步骤 4 PowerShell 全仓枚举验证 + sim 复现链验证。 |
| v0.4 | 2026-07-25 | 经 Oracle 第三轮审查修复 4 项：§0 运行时依赖计数 3→2（combat.golden.test.ts 移到注释类）；§4.3 迁移矩阵同步 2 处运行时 + 1 处人工注释；§3.4 mvp2/cadence.md 从整体历史移到部分生效（§7 仍有效）；§8 步骤 3 文件列表同步 §3.4、步骤 4 Select-String 改为 Get-ChildItem -Recurse 递归枚举。 |
| v0.5 | 2026-07-25 | 经 Oracle 第四轮审查修复 4 项：补 frontmatter 版本/范围字段；新增 §3.5 最终目标信息架构目录树 + 完成定义（8 条完成条件）；§4 改为"可分批实施，最小范围必须完成"；§8 $annotated 验证清单补全 §3.4 全部文件（content-depth/resource-mapping/5 个 direction 笔记）；§1.1 加统计范围与日期注记。 |
| v0.6 | 2026-07-25 | 经 Oracle 第六轮审查修复 5 项：§3.5 目录树补 rules/offline-rewards.md + rules/manual-fragments.md；§3.5 加归档操作顺序（先复制 archive/ 快照再写 rules/，archive/ 不被修改）；§3.5 统一附录路径为 archive/mvp0/formulas-appendix-a.md；§4.3 迁移优先级补 offline-rewards 和 manual-fragments 条目（优先级 5/6）；完成定义第 1 条改为六份文档。 |
| v0.7 | 2026-07-25 | 经 Oracle 第七轮审查修复 3 项：§3.5 归档操作顺序第 4 步改为"附录 A 保留在 archive/mvp0/formulas.md §附录A（快照内已有，不新增提取件）"；§4.3 优先级 7 风险说明补 session.sim.test.ts OUT_DIR 迁移（改为非归档路径）+ combat.golden.test.ts 注释更新；§4.2/§5.2 全部 formulas-appendix-a.md 引用统一为 archive/mvp0/formulas.md §附录A；完成定义第 8 条验证命令路径更新为 docs/archive/mvp2/sim/ + SIM_PATH + OUT_DIR 说明。 |
