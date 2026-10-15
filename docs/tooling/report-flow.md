# 提报流程：从游戏里按一下到 issue 入池

> **版本**：v0.1
>
> **日期**：2026-10-15
>
> **状态**：第一段已实装（提报入口）；第二段 fix-todo 待做
>
> **范围**：dev 构建内的提报面板、本地中间件、GitHub issue 状态流转
>
> **上游**：`docs/design/report-panel-prototype.html`

## 1. 目标

玩的时候发现问题，按一下就把问题连同上下文送进队列，不切出玩家状态。队列由 fix-todo 异步消化，交回带证据的 PR。

## 2. 提报入口（已实装）

- 入口：侧栏脚下的「报」印，或快捷键 ⌥R。只在 `npm run dev` 的开发构建出现，生产包不含。
- 框选：拖一个红框。框到的文字元素会被记下可见文本和选择器，这是给 fix-todo 的定位信息，比截图上的红框更好找。可以「再框一处」。
- 截图：松手时由本地中间件调 macOS `screencapture` 只截框选区域（所有红框的并集向外扩 120px，保留上下文），红框留在页面上一起烙进图里。也可 ⌘V 换成自己画的截图。首次使用 macOS 会向运行 dev server 的终端索要「屏幕录制」权限。
- 填写：标题自动拼成「页签 · 首个框中元素：描述第一句」，可改。类型二选一（缺陷 / 优化），「需我裁决」开关打开后 fix-todo 跳过这条。
- 自动附带：当前存档、页签、URL hash、最近 20 条控制台错误。

代码：`code/src/dev/ReportPanel.tsx`、`code/src/dev/reportLog.ts`、`code/vite-report.ts`。

## 3. 落盘与 issue

- 每单一个目录 `reports/<yyyymmdd-hhmmss>/`，含 `shot.png`、`save.json`、`report.json`、`issue.md`、`issue.json`。目录不入库。
- 截图与存档再经 Contents API 推到仓库的孤儿分支 `report-assets`（首次自动从空树建出，不含代码），issue 正文用 `blob/report-assets/...?raw=true` 链接内嵌显示截图。
- issue 由 `gh issue create` 建在本仓库，标题即面板标题，正文：描述、内嵌截图、类型 / 裁决 / 页签 / hash / 单号、框中元素清单；有控制台错误才附一段。存档不在正文里给链接，fix-todo 按单号到 `report-assets` 分支或本机 `reports/<单号>/` 取。
- 标签：`report` + `type::bug` 或 `type::enhancement` + `status::todo`；需裁决加 `needs-decision`。

## 4. 状态流转

| 状态 | 标签 | 谁改 |
|---|---|---|
| 待开始 | `status::todo` | 提报时自动打 |
| 进行中 | `status::doing` | fix-todo 领单时 |
| 待发布 | `status::pr` | fix-todo 开 PR 时 |
| 已发布 | issue 关闭 | PR 以 `Closes #N` 合入 |

看板就是 GitHub Issues 按 `report` 标签筛，不另做。

## 5. fix-todo（待做）

项目级 skill：领最早的 `status::todo` 且无 `needs-decision` 的单，按 R6 开 worktree，用附带存档复现，修复后截「修复后」图，开 PR 贴前后对比并通知。定时或手动触发，严格串行。

## 变更日志

| 版本 | 日期 | 变更内容 |
|---|---|---|
| v0.1 | 2026-10-15 | 第一段实装：提报面板、中间件、标签与状态流转。 |
