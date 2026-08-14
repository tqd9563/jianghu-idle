# 江湖无尽录（jianghu-idle）

一款自由的武侠江湖放置游戏。当前阶段：**MVP-2 已收口**（2026-07-20）——MVP-2A 内容量准备 + 2B 数值重锚 + 2C 自然回流验证三阶段全项成立（单人口径），R7「放置节拍假设」销账；后续按 `docs/archive/mvp2/cadence.md` §7 转入主题版本 / 垂直切片节奏，停止 MVP 编号。

## 技术栈

Vite + TypeScript + React；纯静态产物、localStorage 存档、无后端。数值引擎为独立纯 TS 模块，与 `docs/systems/sim/mvp0_sim.py`（EV 确定性模拟器）做 golden 对照。

## 上手

```bash
cd code && npm install && npm run dev   # 开发
npm test                                # 数值引擎 golden 用例
python3 docs/systems/sim/mvp0_sim.py  # 复现设计侧模拟（无依赖）
```

## 目录

```
code/                 前端源码（Vite + TS + React）
docs/
  README.md           文档规范 + 权威索引（目录、命名、写作约定）
  BACKLOG.md          需求池（想法 / 已确认 / 进行中 / 已完成）
  overview/           全局设计：game-design.md（长线 GDD）、worldview.md（世界观）
  rules/              当前实现权威：公式表 / 内容表 / 经济表 / 埋点 / 离线 / 残页 + copy/（冻结文案）
  systems/            当前主题权威：周天、门派/内功/主动武学 + sim/ 模拟器
  design/             获批交互原型 prototype.html、风格对比页
  archive/            历史归档（只读）：mvp0/ mvp1/ mvp2/ directions/ reviews/
DESIGN.md             设计规范唯一权威（token frontmatter + 六段式）
PRODUCT.md            产品上下文（register / 用户 / 设计原则 / 反参考）
CHANGELOG.md          变更日志（Keep a Changelog）
```

## 约定

- 文档链是实现的唯一输入源：数值出自内容表/公式表，UI 出自原型 + DESIGN.md，均不得在代码里即兴修改。
- 分支：`dev` 为集成分支，功能分支 `<type>/<name>`；commit 遵循 Angular 规范；CHANGELOG 与代码同 commit。
- MVP-0 测试期冻结未启用、已随收口解除（见 `docs/archive/mvp0/closure.md` §5）；任何数值改动仍须过 sim golden 对照。
