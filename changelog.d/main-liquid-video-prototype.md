### 新增

- **丹田液体 AI 视频材质原型**：新增 `docs/design/zhoutian-liquid-video-prototype.html`，验证 P0 液体动效的混合路线——AI 图生视频循环（可灵 v2.5，首帧 dantian-closeup.png）作液体材质，代码只负责液位（`clip-path: inset()` 随修为裁切）、转速（`video.playbackRate` 绑挂机倍速，封顶 4）与周天圆满事件（闪光 + 液面沉底）。视频随液面下移，保证低液位时旋涡丹核仍泡在液体里。素材 `docs/art-explore/dantian-liquid-loop.mp4`（1440×1440 / 5s / 18MB，未压缩，仅供原型评审）。

### 变更

- **丹田液体循环视频消除接缝**：改用可灵首尾帧模式重新生成（同一张图同时作首帧与尾帧），循环点首尾帧像素差从 9.1% 降至 1.3%，旋涡转满一周回到原位，5 秒循环跳变肉眼不再可见（中间帧与首帧差 7.0%，确认非静止画面）。原型改挂 `dantian-liquid-loop-v2.mp4`，v1 素材保留备查。
