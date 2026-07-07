# 文档规范

本文是 `docs/` 的目录、命名与写作规范。人类与 AI 在新增、移动或修改文档前都应先读本文。

---

## 1. 基本原则

- 文档链是实现的唯一输入源：数值出自内容表 / 公式表，UI 出自原型 + `DESIGN.md`，代码不得即兴改规则。
- 文档优先表达「当前权威口径」，历史理由只保留必要摘要；不要把评审过程全文塞进 frontmatter 或变更日志。
- 文件路径表达类别，文件名表达主题；不要用超长文件名承担目录职责。
- 搬迁或改名文档时，必须同步更新所有引用。
- 历史评审记录默认只读；除非明确要求，不修改 `docs/reviews/`。

---

## 2. 推荐目录结构

仓库已于 2026-07-07 完成从早期 `docs/core-loop/` 平铺布局到以下结构的迁移：

```text
docs/
  README.md                 文档规范
  overview/                 全局设计初案、长线 GDD
  mvp0/                     MVP-0 权威文档链
    spec.md                 核心循环规格
    formulas.md             公式表
    content.md              内容表
    economy.md              声望 / 经济表
    telemetry.md            埋点规格
    scope.md                范围边界
    playtest-plan.md        测试计划或未执行存档
    simulation-report.md    模拟报告
    closure.md              阶段收口记录
    copy/                   呈现文案规格
      battle.md
      retire.md
    sim/                    模拟脚本、样本、预检数据
  mvp1/                     MVP-1 权威文档链
    spec.md
    offline-rewards.md
    acceptance.md
    telemetry.md
    prototypes/
      settlement-return-check.md
  directions/               未立项方向记录
  reviews/                  历史评审记录，只读
```

### 2.1 迁移后规则

`docs/core-loop/` 已不存在，不得再向该路径新增文件。新增 MVP 文档直接放入对应 `docs/mvp*/` 目录：

- 目录已表达 MVP 归属，文件名不再带 `mvp-N-` 前缀。
- 新文件名尽量短，优先使用 `offline-rewards.md` 这类主题名。
- 新增后若发现同类文档已超过 3 个，应优先提出目录整理，而不是继续堆平铺文件。
- 历史例外：`docs/reviews/` 与 `CHANGELOG.md` 历史条目中的旧路径（`docs/core-loop/...`、`mvp-N-*.md`）作为历史记录保留原文，不回溯改写。

---

## 3. 文档类型归类

| 类型 | 推荐位置 | 说明 |
|---|---|---|
| 核心规格 | `docs/mvp*/spec.md` | 定义范围、规则、验收口径。 |
| 数值 / 公式表 | `docs/mvp*/formulas.md`、`docs/mvp*/offline-rewards.md` | 可实现的表与公式。 |
| 内容表 | `docs/mvp*/content.md` | 地图、敌人、关卡、路线等内容数据。 |
| 文案规格 | `docs/mvp*/copy/*.md` | 如战斗文案、归隐文案，不与公式表平级。 |
| 阶段收口 | `docs/mvp*/closure.md` | 记录阶段结论、敞口、门禁。 |
| 模拟 / 报告 | `docs/mvp*/simulation-report.md`、`docs/mvp*/sim/` | 报告与脚本分开。 |
| 方向记录 | `docs/directions/*.md` | 未立项、不进当前 MVP 的设计方向。 |
| 评审记录 | `docs/reviews/*.md` | 历史记录，只读。 |

`battle-copy`、`retire-copy` 这类文件属于文案规格，应迁入 `copy/`。`closure-note` 属于阶段收口，应迁为 `closure.md`。

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

---

## 6. 文件命名规则

- 使用小写 kebab-case：`offline-rewards.md`。
- 目录已经表达 MVP 时，文件名不要再重复 `mvp-0` / `mvp-1`。
- 文件名控制在 2–4 个词以内。
- 避免 `-note`、`-tables`、`-spec` 泛化后缀，除非它能区分同目录多个同名概念。

历史迁移映射（2026-07-07 已执行，旧路径已全部失效）：

| 迁移前（core-loop 平铺） | 迁移后 |
|---|---|
| `mvp-0-core-loop-spec.md` | `docs/mvp0/spec.md` |
| `mvp-0-formula-tables.md` | `docs/mvp0/formulas.md` |
| `mvp-0-content-tables.md` | `docs/mvp0/content.md` |
| `mvp-0-reputation-economy.md` | `docs/mvp0/economy.md` |
| `mvp-0-telemetry-spec.md` | `docs/mvp0/telemetry.md` |
| `mvp-0-scope-boundary.md` | `docs/mvp0/scope.md` |
| `mvp-0-playtest-plan.md` | `docs/mvp0/playtest-plan.md` |
| `mvp-0-simulation-report.md` | `docs/mvp0/simulation-report.md` |
| `mvp-0-closure-note.md` | `docs/mvp0/closure.md` |
| `mvp-0-battle-copy.md` | `docs/mvp0/copy/battle.md` |
| `mvp-0-retire-copy.md` | `docs/mvp0/copy/retire.md` |
| `sim/`（整目录） | `docs/mvp0/sim/` |
| `mvp-1-core-loop-spec.md` | `docs/mvp1/spec.md` |
| `mvp-1-offline-reward-tables.md` | `docs/mvp1/offline-rewards.md` |
| `mvp-2-cadence.md` | `docs/mvp2/cadence.md` |

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
