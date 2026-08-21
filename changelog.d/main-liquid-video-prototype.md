### 新增

- **丹田液体 AI 视频材质原型**：新增 `docs/design/zhoutian-liquid-video-prototype.html`，验证 P0 液体动效的混合路线——AI 图生视频循环（可灵 v2.5，首帧 dantian-closeup.png）作液体材质，代码只负责液位（`clip-path: inset()` 随修为裁切）、转速（`video.playbackRate` 绑挂机倍速，封顶 4）与周天圆满事件（闪光 + 液面沉底）。视频随液面下移，保证低液位时旋涡丹核仍泡在液体里。素材 `docs/art-explore/dantian-liquid-loop.mp4`（1440×1440 / 5s / 18MB，未压缩，仅供原型评审）。
