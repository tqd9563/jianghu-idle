### 变更

- **内视器物层改用 AI 水墨精灵图**：周天月相与窍穴星曜不再用 CSS 画几何图形，改为莉刻生成的水墨素材——`sprite-moon.png`（淡墨月轮，含月海纹理与清冷光晕）与 `sprite-star.png`（八芒水墨星辰，带灵气飘带）。素材生成在纯黑底上，用 Python 按「减黑场 + 亮度转 alpha」抠成透明 PNG，再由 CSS `filter` 分出三态：墨星（灰度压暗）/ 朱砂星（可冲，脉动）/ 金星（已通）。月相三态改为暗盘打底叠精灵图，上弦用 `objectBoundingBox` 裁右半。
- **内视背景不再是一片死黑**：新增墨渊星空底图 `inner-void-bg.jpg`（浓淡墨云气 + 疏星），叠一层向心的暗角渐变，器皿周围有了纵深与氛围。
- **旧金色液体素材清理**：`dantian-liquid-loop.mp4`（18MB）与 `dantian-liquid-loop-v2.mp4`（14MB）已无原型引用，从仓库移除；v1/v2/liquid-video 三个历史原型的引用一并改指墨色成片 `dantian-ink-loop-graded.mp4`，避免留下 404。仓库内美术资产体积由约 33MB 降至约 1.2MB。

### 新增

- **水墨精灵与背景素材**：`sprite-star.png`、`sprite-moon.png`、`inner-void-bg.jpg`，以及未抠图的原始生成件 `sprite-ink-star.png`、`sprite-ink-moon.png`、`inner-ink-void-bg.png`（留作重新抠图/调参的母版）。

### 修复

- **液面割裂感**：此前液面是一条盖在液体之上的不透明色带（`.wave` div），颜色与墨色素材对不上，且色带下缘露出 `clip-path` 的水平直线。改为让波浪成为液体自身的边缘——液体盒子以 `top: var(--empty)` 定位，顶边由波形 `mask-image` 裁出（200px 一个循环、`mask-position` 平移实现无缝流动），波峰即墨色素材本身，颜色天然一致、无直线。视频改为锚在器皿底部的 `.liquid-anchor`（`aspect-ratio: 1`），使液位变化时画面不跳动。删除 `.wave` 与 `.surface-line`。
- **丹田空腔纯黑**：空腔底色由近纯黑 `oklch(0.075 0.01 262)` 提到有墨色层次的深蓝灰 `oklch(0.175 0.020 256)` 向外渐暗，氤氲气雾透明度由 0.22 提到 0.30。
