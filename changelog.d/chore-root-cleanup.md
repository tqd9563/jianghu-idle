### 移除

- **仓库根目录清理**：删除已提交的临时产物——`patch.js` / `patch.py`、17 张 `runtime-theme-*` / `prototype-nav-*` 截图、`.playwright-mcp/` 会话记录；`.gitignore` 新增 `.playwright-mcp/` 与 `code/dist/`。

### 变更

- **原型目录迁移**：`wiki/design/`（prototype.html、style-compare.html）迁至 `docs/design/`，`wiki/` 目录移除；README、code/README、App.tsx 中的引用同步更新。
- **文档索引修正**：根 README 目录树与 `docs/README.md` §3 归类表从归档前的 `docs/mvp*/` 旧路径更新为当前 rules/ systems/ design/ archive/ 结构。
- **旧路径引用修正**：PRODUCT.md、code/README、engine 注释、离线数值表中残留的 `docs/mvp0|mvp1/...` 归档前路径统一改为 rules/ systems/ archive/ 现行路径（CHANGELOG 历史条目按原样保留）。
