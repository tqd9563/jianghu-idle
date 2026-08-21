### 新增

- **周天人影底板原型**：新增 `docs/design/zhoutian-figure-prototype.html`，验证「AI 生成水墨人影作静态底图 + 手写 SVG 经脉层」的可行性。经脉气流沿用 `index.css` 既有的 `qi-flow`（stroke-dashoffset 位移）方案，整套动效只由 `--qi-speed` / `--qi-op` / `--glow` / `--aura` 四个 CSS 变量驱动，境界表与突破消耗取自 `content.ts` 的 `REALMS` 真实数据，模拟 tick 与 `App.tsx` 同为 250ms。
- **美术风格探索图**：新增 `docs/art-explore/`，含莉刻平台生成的五张水墨探索图。其中 `figure-base-dark.png` / `figure-base-light.png` 为不含金线的纯水墨打坐人影，作为上述原型的可叠加底图，分别对应夜雨账台与宣纸武谱两种皮肤。
