# 江湖无尽录（jianghu-idle）

一款自由的武侠江湖放置游戏。当前阶段：**MVP-0**——60 分钟压缩原型，唯一验证假设是「prestige 循环成立」（修炼→挑战→卡点→归隐→声望永久加成→下一轮更快）。

## 技术栈

Vite + TypeScript + React；纯静态产物、localStorage 存档、无后端。数值引擎为独立纯 TS 模块，与 `docs/mvp0/sim/mvp0_sim.py`（EV 确定性模拟器）做 golden 对照。

## 上手

```bash
cd code && npm install && npm run dev   # 开发
npm test                                # 数值引擎 golden 用例
python3 docs/mvp0/sim/mvp0_sim.py  # 复现设计侧模拟（无依赖）
```

## 目录

```
code/                 前端源码（Vite + TS + React）
docs/
  README.md           文档规范（目录、命名、写作约定）
  overview/           设计初案（长线 GDD）等全局权威文档
  mvp0/               MVP-0 权威文档链：spec / formulas / content / economy /
                      simulation-report / scope / telemetry / playtest-plan（未执行存档）/
                      closure.md（单人口径收口 + 敞口台账）/ copy/（冻结文案）/ sim/ 模拟器
  mvp1/               MVP-1 权威文档链（当前：spec.md v0.3：离线功能交付口径，
                      验收主体为 §8.1 功能清单 A1–A7；offline-rewards.md 离线数值增补表）
  mvp2/               MVP-2 方向记录 cadence.md（多会话内容准备、自然回流验证前提与后续版本节奏）
  directions/         未立项的设计方向记录（经脉/窍穴、周天充能、武学收集与星级、
                      归隐打字机演出、推荐境界呈现），MVP-1 数值重推或完整版立项时重审
  reviews/            历史评审记录（只读，不修改）
wiki/design/          获批交互原型 prototype.html、风格对比页
DESIGN.md             设计规范唯一权威（token frontmatter + 六段式）
PRODUCT.md            产品上下文（register / 用户 / 设计原则 / 反参考）
CHANGELOG.md          变更日志（Keep a Changelog）
```

## 约定

- 文档链是实现的唯一输入源：数值出自内容表/公式表，UI 出自原型 + DESIGN.md，均不得在代码里即兴修改。
- 分支：`dev` 为集成分支，功能分支 `<type>/<name>`；commit 遵循 Angular 规范；CHANGELOG 与代码同 commit。
- MVP-0 测试期冻结未启用、已随收口解除（见 `docs/mvp0/closure.md` §5）；任何数值改动仍须过 sim golden 对照。
