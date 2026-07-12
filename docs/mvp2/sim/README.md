# MVP-2B 离线效率模拟框架

> **版本**：v0.8
>
> **日期**：2026-07-12
>
> **状态**：已有 50% 预测候选；尚无实测或生产最终推荐
>
> **上游**：`../cadence.md` §4.1、`../content.md` §4 / §8、`../manual-fragments.md` §3 / §6

## 1. 用途

本框架固定比较：

- 离线效率：35% / 50% / 65%；
- 离线时长：2 / 4 / 8 小时；
- 轮次：首轮 / 第二轮 / 后续轮；
- 卡点：Boss 2 / Boss 3 / Boss 4 / Boss 5 前；
- 共 108 个确定性场景。

输出包括获得资源、可承担的有效投入、越过卡点风险与单次登录压缩整轮风险。风险只表示“资源已足以承担声明的投入”，不会自动推进关卡、Boss、试炼、突破、归隐或残页。

## 2. 运行

```bash
uv run docs/mvp2/sim/test.py
uv run docs/mvp2/sim/offline_sim.py --assumptions docs/mvp2/sim/normalized-candidate-v0.json
uv run docs/mvp2/sim/offline_sim.py --assumptions docs/mvp2/sim/normalized-candidate-v0.json --json
uv run docs/mvp2/sim/offline_sim.py --assumptions docs/mvp2/sim/normalized-candidate-v0.json --summary
uv run docs/mvp2/sim/offline_sim.py --assumptions docs/mvp2/sim/normalized-candidate-v0.json --sensitivity
uv run docs/mvp2/sim/offline_sim.py --real-mapping
python docs/mvp2/sim/offline_sim.py --checkpoint-snapshots
python docs/mvp2/sim/offline_sim.py --real-evaluation
python docs/mvp2/sim/offline_sim.py --real-evaluation --json
python docs/mvp2/sim/offline_sim.py --attainment-evaluation
python docs/mvp2/sim/offline_sim.py --attainment-evaluation --json
```

若本机暂未安装 `uv`，核心模块不依赖第三方库，可直接运行：

```bash
python docs/mvp2/sim/offline_sim.py --assumptions docs/mvp2/sim/normalized-candidate-v0.json
```

## 3. 当前输入边界

`normalized-candidate-v0.json` 使用归一化资源指数验证场景矩阵与风险边界，其资源速率、投入成本和永久成长倍率均为**合成假设**，不得写回内容表、经济表或实现。报告分别显示“离线新增”与“可用总量”，避免把下线前存量误算成离线贡献。

待 MVP-2B 补齐并改为显式假设输入的项目：

1. Boss 4 / Boss 5 每小时基础资源率（Boss 2 / Boss 3 已审计，见 `resource-mapping.md` §6）；
2. 回归前资源存量；
3. “一次有效投入”及卡点门槛的真实成本；
4. 第二轮与后续轮永久成长倍率；
5. Boss 4 / Boss 5 的需求矩阵；
6. 秘籍与声望叠加后的整轮剩余需求。

## 4. 裁决纪律

本报告不排序、不推荐效率档。最终比例必须同时满足：4 小时通常支持至少一次有效投入；8 小时不能直接越过关键卡点或把整轮压缩为一次登录。框架不导入或修改 `../../mvp0/sim/mvp0_sim.py`。

`--summary` 将 108 条明细压成每档 12 个“轮次 × 卡点”单元：统计 4 小时有效投入、8 小时卡点准备一次覆盖和 8 小时整轮压缩风险。它只用于筛选进入正式资源曲线验证的候选档，不构成最终效率裁决。

`--sensitivity` 固定效率 50%、bank 0.30h、有效投入 2.10h、整轮剩余 8.00h，扫描 gate `4.50 / 5.00 / 5.50h`、第二轮倍率 `1.20 / 1.24 / 1.28`、后续轮倍率 `1.26 / 1.30 / 1.34`，共 27 组。只有同时满足 4h 有效投入 `12/12`、8h 卡点覆盖 `≤4/12`、8h 整轮风险 `0/12` 的组合才标记为可进入真实资源验证；该标记不代表最终生产参数。

`--real-mapping` 展示 Boss 2/3 冻结曲线及 Boss 4/5 完整准备成本；Boss 5 阶段转换 r6l9→r7l10 与首战基线 r7l9 分开记录。机器记录见 `real-mapping-v0.json`。

`--checkpoint-snapshots` 从 MVP-0 的 opt-in trace 生成三路线 Boss 2/3 首次挑战前库存 JSON；累计收入/支出字段用于证明事件奖励已在钱包或消费史中，禁止离线评估重复加算。

`--real-evaluation` 不读取归一化候选。`2066/h` 的 50% 通过仍是构造结果；战斗完整性由 `combat_tuning.py` 的可复现搜索与矩阵参与门禁。当前 50%/65% 同时满足资源敏感性，但事件、bank、主动产出和 Day 1/Day 3 达成证据未闭合，输出 `no_recommendation: evidence_incomplete`。

`--attainment-evaluation` 只读取 `attainment-input-v1.json` 的累计主动小时、累计离线块、8h 块封顶和 24h/72h 截止点。Day1/Day3 累计主动为 3h/10.5h；主动率 `35,554÷3` 是 50% Day1 恰达的构造预测；Boss 奖励因未授权显式为 0。门禁为 4h 有意义投入、Boss4/Boss5 各自 8h 防直越、Day1/Day3 与战斗矩阵；50%/65% 合格时按所有者政策选择最低档 50%。整轮坍缩因缺少 remaining-run threshold 尚未验证；输出仅为 `candidate_recommendation / evidence_forecast`，生产最终定档仍需自然窗口实测。

地图奖励的唯一计算权威是 `map_rewards.py::MAP_REWARDS`；JSON 仅为机器可读镜像。每次加载预测输入都会严格核对地图关卡布局、14% 目标、普通/精英分档及三资源累计，任一差异立即拒绝运行。

## 5. 变更日志

| 版本 | 日期 | 变更内容 |
|---|---|---|
| v0.1 | 2026-07-11 | 建立合成场景矩阵、摘要、敏感性与真实映射入口。 |
| v0.2 | 2026-07-12 | 新增可复现库存快照与 Boss 2/3 首轮真实部分门禁。 |
| v0.3 | 2026-07-12 | 修正快照状态差额、境界对应闲置率与非累计调整余量语义。 |
| v0.4 | 2026-07-12 | 将可选调整流动性从主门禁拆为独立诊断。 |
| v0.5 | 2026-07-12 | 新增所有者政策校准敏感性、Boss 4/5 单次调整结构门禁与证据完整性推荐政策。 |
| v0.6 | 2026-07-12 | 新增 Realm 6/7、Boss 4/5 确定性搜索、战斗矩阵与完整成本推荐门禁。 |
| v0.7 | 2026-07-12 | 新增地图奖励搜索、墙钟事件时间线、路线快照与 35/50/65 达成预测。 |
| v0.8 | 2026-07-12 | 采用 Day3 10.5h 主动方案及最低合格效率候选政策。 |
