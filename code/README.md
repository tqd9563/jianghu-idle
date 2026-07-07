# 江湖无尽录 · MVP-0/1 前端

Vite + TypeScript + React。数值引擎为纯 TS 模块（`src/engine/`），与 UI 解耦，同 `docs/mvp0/sim/mvp0_sim.py` 做 golden 对照。

## 命令

```bash
npm run dev      # 开发服务器
npm test         # vitest（含 golden 对照种子用例）
npm run build    # 产物纯静态，分发即测试
```

## 目录

```
src/
  engine/      纯函数数值引擎：formulas（公式表 §2/§3）、content（内容表定稿数据）、
               offlineRewards（MVP-1 离线收益，docs/mvp1/offline-rewards.md 表 A/C）
  save/        localStorage 存档（持久化/恢复/一键重置；savedAt 即离线时长权威来源，
               MVP-0「关闭页面不结算」条款已随 MVP-1 解除）
  telemetry/   埋点（mvp0/telemetry.md v1.1 + mvp1/telemetry.md：公共信封 + JSON 一键导出）
  styles/      tokens.css —— 唯一权威是根目录 DESIGN.md，此处为其 CSS 落地
```

## 观察员/调试通道（URL hash）

正式测试会话**不要携带 seed**（会覆盖存档，且 `run_start` 不触发，污染完成率分母）。

```
#seed=<preset>       预置状态：realm3 / ready / boss2 / retire / fallback / run2
#tab=<id>            直达页签：cultivate / battle / skill / rep
#fight=1             载入后自动挑战下一关
#retire=preview      直接打开归隐盘点（ceremony = 直接执行归隐看结算演出）
#switch=1            直接打开换路线弹窗（需 tab=skill 且已择路的 seed）
#observer=1          打开观察员面板（会话编号/暂停恢复/导出测试数据与存档/重置）
#offlinecap=10       MVP-1 验收 A4：压低离线上限（分钟，持久生效）；#offlinecap=0 清除
#offlinesim=1800     MVP-1 验收：存档时间戳回拨 N 秒，载入即触发出关结算（可与 seed 组合）
```

观察员面板也可随时用 `Ctrl+Shift+O` 开关；测试者不应看到该面板。

## 实现纪律

- UI 实现基准：`wiki/design/prototype.html`（获批原型）+ 根目录 `DESIGN.md`，1:1 还原。
- 数值/文案不得在代码里调参或改写：数值出自内容表/公式表（MVP-1 离线数值出自 `docs/mvp1/offline-rewards.md`）且改动必过 sim golden 对照；玩家可见文案以 `docs/mvp0/copy/retire.md`/`docs/mvp0/copy/battle.md` 为唯一权威，变更先改文档发版再实现。（测试期冻结未启用、已随 MVP-0 收口解除，见 `docs/mvp0/closure.md` §5——单源纪律不随冻结解除。）
- 同一数值多处渲染必须单一数据源（修炼页/战斗页/武学页三处一致，golden 对照覆盖）。

## 已知环境坑：rolldown 原生绑定

本机 node 为 arm64、shell 跑在 Rosetta（x86_64）下，npm 平台过滤会跳过 `@rolldown/binding-darwin-arm64` 可选依赖，导致 vite/vitest 启动报 `Cannot find native binding`。重装 `node_modules` 后若复现，手动解包：

```bash
npm pack @rolldown/binding-darwin-arm64@<rolldown版本> \
  && mkdir -p node_modules/@rolldown/binding-darwin-arm64 \
  && tar -xzf rolldown-binding-darwin-arm64-*.tgz --strip-components=1 -C node_modules/@rolldown/binding-darwin-arm64 \
  && rm rolldown-binding-darwin-arm64-*.tgz
```
