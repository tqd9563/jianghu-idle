# 战斗页美术生成（莉刻）

批三出卷一至卷三的地域分图、据点场景与守关人像，用的是这里的脚本。后续各卷补图照同一流程。

1. **参考图**：上传到莉刻，得到 asset id，写进 `assets.txt`（每行「键 id」）。现用的键：
   - `gz`：顾家绸庄场景，路形 A；
   - `gzm`：顾家绸庄左右翻转，路形 B；
   - `tc`：`tpl-c.jpg` 盘山路草图，路形 C；
   - `jn`：江南分图；
   - `pt`：顾三头像；
   - `ink`：长卷像。
2. **写任务**：在 `mkjobs.py` 里写提示词，运行后得到 `jobs-full.json`。场景提示词 = 路形句 + 统一风格句 + 这处据点的描述。
3. **提交与下载**：先 `python3 gen.py jobs-full.json` 提交，再 `python3 fetch.py` 轮询，完成的图下载到 `out/`。
4. **放进游戏**：`python3 place.py` 把图压缩后放进 `code/public/art/`：
   - 场景 `scene/<名>.jpg`；
   - 分图 `region/<名>.jpg`；
   - 头像 `pt/<套>-<变体>.jpg`；
   - 长卷像 `pt/ink-<套>.jpg`。
5. **登记**：在 `code/src/panes/battle/art.ts` 登记：
   - 场景（`SCENES`：图名 → 文件与路形）；
   - 分图（`REGIONS`：据点热区中心，看图标定）。

路形模板的关卡点坐标写在 `art.ts` 的 `PATH_A` / `PATH_C` 里，B 是 A 的左右镜像。生图时让路照模板走，关卡点就不必逐张手标。`tpl-c.json` 是 C 的 20 个点。
