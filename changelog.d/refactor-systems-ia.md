### 变更

- **systems/ 按模块分文件夹**：`docs/systems/` 改为「一模块一文件夹、文件名表达类型」结构——`zhoutian/{design.md,sim.py}`、`sect-neigong/design.md`，跨模块 sim 仍留 `systems/sim/`；`docs/README.md` 新增 §3.1 模块目录规范（固定类型词表 design/spec/sim、文件齐备度即模块生命周期、被取代文档立即归档）。
- **引用同步**：acupoints.ts / acupoints.test.ts / AcupointPanel.tsx 注释、`rules/content.md`、`rules/copy/zhoutian.md`、`overview/game-design.md` 与 zhoutian sim 自身的路径指针全部更新；旧 spec 章节号在合并文档中无 1:1 对应，改为指向 `zhoutian/design.md` 并注明映射见其「口径守恒表」。

### 修复

- **MVP-2 验证链恢复可运行**：`archive/mvp2/sim/checkpoint_snapshot.py` 动态加载 `mvp0_sim.py` 的相对层级在文档归档时未随之调整（`parents[2]` → `parents[3]`），导致 `run_all_tests.py` 启动即 FileNotFoundError；修复后 21 项全通过。

### 移除

- **已被取代文档归档**：`zhoutian-meridian.md` v1.2 与 `zhoutian-meridian-spec.md` v1.0（已由 `zhoutian/design.md` v2.0 合并取代）移入 `docs/archive/systems/`，不再与取代它们的文档并存。
- **测试产物不再入库**：`code/.gitignore` 忽略 `test-output/` 下生成的 fixture 样本（保留 `.gitkeep`）。
