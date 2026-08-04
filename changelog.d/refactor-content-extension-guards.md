### 修复

- **生产构建恢复可用**：`npm run build`（`tsc -b && vite build`）在 main 上即失败，项目无法产出生产包——`BattlePane.tsx` 精英挑战标签内联重复实现了 `tagLabel()` 且比较项恒不成立、`gameStore.ts` 的 `BOSS4_KEY`/`BOSS5_KEY` 声明后从未使用。前者改用既有 `tagLabel()`（顺带消除重复），后者删除死代码，`tsc` 与 build 均恢复通过。

### 变更

- **地图 ID 收敛为单一数据源**：`enemies.ts` 新增 `MAP_IDS` / `MapId`，此前散落在 enemies/offlineRewards/gameStore 的 5 处 `1 | 2 | 3 | 4 | 5` 字面量联合全部由其派生；新增地图只需改 `MAP_IDS`、地图名与关卡数三项数据。
- **离线收益与地图解锁改为派生**：`maxIdleStage()` 的关卡数表、全局序号偏移与 `/^m([1-5])s(\d+)$/` 正则、`mapUnlocked()` 的 if 链此前均按 5 张地图写死——新增地图时不报错但结果静默错误（新图关卡被正则丢弃、解锁条件沿用旧图）。现按 `MAP_IDS` 顺序推导，并以 `TOTAL_GLOBAL_STAGES` 取代两处硬编码的 48。派生结果与重构前逐值一致（全局序号 8/18/28/38/48、解锁链、越界与空输入）。
- **路线分支加穷尽性检查**：新增 `engine/exhaustive.ts` 的 `assertNever()`；`combat.ts` 的 `makeBuild()` 此前用 `else` 兜底唐门——新增路线会静默套用毒流参数，现改为显式 `tangmen` 分支 + `assertNever`；`SkillPane.tsx` 的 `RouteMechList` switch 无 default，新增路线静默渲染空白，现同样兜底。实测新增第 4 条路线，编译器报错文件从 3 个增至 4 个且覆盖 combat/SkillPane 两处此前静默的缺口。
