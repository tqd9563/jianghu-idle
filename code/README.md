# 江湖无尽录 · MVP-0 前端

Vite + TypeScript + React。数值引擎为纯 TS 模块（`src/engine/`），与 UI 解耦，同 `docs/core-loop/sim/mvp0_sim.py` 做 golden 对照。

## 命令

```bash
npm run dev      # 开发服务器
npm test         # vitest（含 golden 对照种子用例）
npm run build    # 产物纯静态，分发即测试
```

## 目录

```
src/
  engine/      纯函数数值引擎：formulas（公式表 §2/§3）、content（内容表定稿数据）
  save/        localStorage 存档（规格书 §12 前置：持久化/恢复/一键重置；关闭页面不结算）
  telemetry/   埋点（telemetry-spec v1.0：公共信封 + JSON 一键导出）
  styles/      tokens.css —— 唯一权威是根目录 DESIGN.md，此处为其 CSS 落地
```

## 实现纪律

- UI 实现基准：`wiki/design/prototype.html`（获批原型）+ 根目录 `DESIGN.md`，1:1 还原。
- 数值/文案不得在代码里调参或改写：数值出自内容表/公式表，文案（失败提示、归隐流程）测试期冻结。
- 同一数值多处渲染必须单一数据源（修炼页/战斗页/武学页三处一致，golden 对照覆盖）。

## 已知环境坑：rolldown 原生绑定

本机 node 为 arm64、shell 跑在 Rosetta（x86_64）下，npm 平台过滤会跳过 `@rolldown/binding-darwin-arm64` 可选依赖，导致 vite/vitest 启动报 `Cannot find native binding`。重装 `node_modules` 后若复现，手动解包：

```bash
npm pack @rolldown/binding-darwin-arm64@<rolldown版本> \
  && mkdir -p node_modules/@rolldown/binding-darwin-arm64 \
  && tar -xzf rolldown-binding-darwin-arm64-*.tgz --strip-components=1 -C node_modules/@rolldown/binding-darwin-arm64 \
  && rm rolldown-binding-darwin-arm64-*.tgz
```
