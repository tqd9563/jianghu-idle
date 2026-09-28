---
name: 江湖无尽录
description: 夜色江湖风格的武侠放置游戏——烛火账台上，每一笔数值都清晰可查
colors:
  night-bg: "oklch(0.165 0.014 262)"
  night-surface: "oklch(0.215 0.016 262)"
  night-surface-raised: "oklch(0.26 0.018 262)"
  night-chrome: "oklch(0.19 0.015 262)"
  night-nav: "oklch(0.13 0.012 262)"
  ink-warm: "oklch(0.90 0.012 85)"
  ink-muted: "oklch(0.70 0.015 85)"
  ink-faint: "oklch(0.56 0.015 262)"
  line: "oklch(0.32 0.02 262)"
  line-strong: "oklch(0.48 0.03 262)"
  candle-gold: "oklch(0.76 0.13 78)"
  candle-ink: "oklch(0.18 0.03 78)"
  sword-cyan: "oklch(0.74 0.10 215)"
  poison-green: "oklch(0.72 0.14 145)"
  blood-red: "oklch(0.64 0.17 25)"
  bruise-violet: "oklch(0.66 0.11 310)"
  shield-blue: "oklch(0.70 0.10 240)"
  crit-ember: "oklch(0.70 0.16 45)"
  cinnabar: "oklch(0.68 0.09 38)"
  ink-gold: "oklch(0.74 0.075 76)"
  bar-track: "oklch(0.28 0.018 262)"
typography:
  display:
    fontFamily: "Songti SC, STSong, SimSun, serif"
    fontSize: "19px–40px"
    fontWeight: 700
    letterSpacing: "0.06em–0.22em"
  body:
    fontFamily: "-apple-system, PingFang SC, Microsoft YaHei, system-ui, sans-serif"
    fontSize: "14px"
    lineHeight: 1.55
  data:
    fontFamily: "-apple-system, PingFang SC, system-ui, sans-serif"
    fontSize: "13px–16px"
    fontWeight: 600
    fontVariation: "tabular-nums"
  label:
    fontFamily: "-apple-system, PingFang SC, system-ui, sans-serif"
    fontSize: "11px"
    letterSpacing: "0.05em"
rounded:
  xs: "4px"
  sm: "6px"
  md: "8px"
  lg: "10px"
  xl: "12px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "12px"
  lg: "16px"
  xl: "24px"
components:
  button-primary:
    backgroundColor: "{colors.candle-gold}"
    textColor: "{colors.candle-ink}"
    rounded: "{rounded.sm}"
    padding: "9px 0"
  button-ghost:
    backgroundColor: "transparent"
    textColor: "{colors.ink-warm}"
    rounded: "{rounded.sm}"
    padding: "9px 0"
  button-danger:
    backgroundColor: "{colors.blood-red}"
    textColor: "oklch(0.98 0.005 25)"
    rounded: "{rounded.sm}"
    padding: "9px 0"
  panel:
    backgroundColor: "{colors.night-surface}"
    rounded: "{rounded.md}"
    padding: "12px 14px"
  tag:
    backgroundColor: "transparent"
    rounded: "{rounded.xs}"
    padding: "1px 7px"
  severity-meter:
    backgroundColor: "{colors.bar-track}"
    rounded: "{rounded.xs}"
    width: "4px"
    height: "11px"
  age-line:
    textColor: "{colors.ink-muted}"
    typography: "{typography.data}"
    fontSize: "12px"
  soul-chip:
    backgroundColor: "{colors.night-surface}"
    textColor: "{colors.ink-gold}"
    rounded: "{rounded.md}"
    padding: "6px 11px"
  game-tab-active:
    backgroundColor: "transparent"
    textColor: "{colors.ink-warm}"
    padding: "11px 22px"
  pulse-capsule:
    backgroundColor: "{colors.night-surface}"
    textColor: "{colors.ink-muted}"
    rounded: "{rounded.sm}"
    padding: "3px 12px"
---

# Design System: 江湖无尽录

## 1. Overview

**Creative North Star: "夜雨客栈的账台"**

江湖夜雨里的一方账台：烛火照着账本，窗外是刀光与雨声。整套系统由两种气质咬合而成——**武侠的夜**（深蓝黑的底色、烛火暖金、剑气冷青、宋体竖排感的专名）与**账台的秤**（tabular-nums 等宽数字、来源分解、双列对照表、一切数值可查）。氛围负责让玩家相信自己身在江湖，账本负责让玩家相信每一个数字。两者缺一：只有氛围是廉价页游，只有账本是 SaaS 后台——这两个都是 PRODUCT.md 点名的反参考。

本系统明确拒绝：闪烁按钮、满屏红点、战力飙升弹字的**廉价页游感**；高饱和圆润的**低幼卡通休闲风**；以及有密度没气质的**通用 SaaS 仪表盘**。日常界面安静克制，情绪演出只在峰终时刻（归隐结算、境界突破）集中投放。

**Key Characteristics:**
- 深夜低照度分层：bg → surface → surface-raised 三级色调承载深度，阴影极轻
- 烛火暖金只标记「进展与主行动」，剑气冷青只标记「信息与教学」
- 语义状态色是一张词汇表（战斗：毒/血/盾/暴；修炼：朱砂/墨金），永不用于装饰
- 宋体衬线只给江湖专名（标题/境界/敌名/仪式），界面与数据一律无衬线
- 高密度但有层级：页签分职责，仪表簇统一基线，留白即层级

## 2. Colors

夜幕蓝黑为纸，烛火暖金为笔，五种战斗状态色为印。

### Primary
- **烛火暖金 candle-gold** (oklch(0.76 0.13 78)): 主行动按钮、激活页签下划线、周天充能条、声望数值、关键数字的微光。它是「进展」的颜色——凡是金色的东西，都值得玩家看一眼。
- **烛芯墨 candle-ink** (oklch(0.18 0.03 78)): 金底上的文字，饱和色上永不用纯黑。

### Secondary
- **剑气冷青 sword-cyan** (oklch(0.74 0.10 215)): 信息与教学——克制提示、乘区透视的本轮加成、战斗日志的状态事件、链接。冷青与暖金是系统内唯一一对冷暖对话。

### Tertiary（语义状态色，仅限状态含义）

**战斗组**
- **毒翠 poison-green** (oklch(0.72 0.14 145)): 毒层/毒伤/资源增速（+16.9/秒）。
- **血褐 blood-red** (oklch(0.64 0.17 25)): 气血条、战败、危险操作按钮。
- **盾青 shield-blue** (oklch(0.70 0.10 240)): 护盾/少林。
- **燎原橙 crit-ember** (oklch(0.70 0.16 45)): 暴击/华山。
- **淤紫 bruise-violet** (oklch(0.66 0.11 310)): 内伤。经脉气血受损之色，与血褐（外伤）、毒翠（毒伤）三色构成伤势谱——**三者色相拉开，便于在同屏并存时一眼分辨伤型**；不与修炼组的朱砂/墨金混淆。

**修炼组**
- **朱砂 cinnabar** (oklch(0.68 0.09 38)): 「可下手」态——有冲穴机会时星曜转朱砂并呼吸脉动。朱砂点穴、朱砂入药，武侠语境里本就是「此处可施为」的记号。第二个用途是**垂暮**：年岁离寿元不足一次重伤时，年岁数字与「垂暮」小标转朱砂——同是「到了该出手/该收手的节点」。平日看不到，警示要稀缺才有效。
- **墨金 ink-gold** (oklch(0.74 0.075 76)): 「已成」态——已通窍穴、已圆满周天的满月、已贯通经脉。它是烛火暖金在水墨语境下的低饱和变体，**不与 candle-gold 混用**：暖金标进展（还在涨），墨金标既成（已落定）。其反面「未成」也用墨金：**魂魄未稳**芯片与强制转世演出里的「魂魄未稳」标题——它不是伤，所以不进伤势三色。两色的字面值用于文字与图例；星曜/月相是位图精灵，其着色由 CSS `filter` 近似逼近这两个色值，不另立 token。

### Neutral
- **夜幕 night-bg** (oklch(0.165 0.014 262)): 页面底色。**导航深黑 night-nav** (oklch(0.13 0.012 262))、**账台灰 night-chrome** (oklch(0.19 0.015 262))、**卡面 night-surface** (oklch(0.215 0.016 262))、**浮面 night-surface-raised** (oklch(0.26 0.018 262)) 依次抬升。
- **暖墨 ink-warm** (oklch(0.90 0.012 85)): 正文，微暖的灰白——烛光下的纸色。**次墨 ink-muted** (oklch(0.70 0.015 85)) 说明文字；**淡墨 ink-faint** (oklch(0.56 0.015 262)) 标签与注脚。
- **描线 line** (oklch(0.32 0.02 262)) / **重线 line-strong** (oklch(0.48 0.03 262)): 边框与分隔。

**The Candlelight Rule.** 烛火暖金只照两样东西：进展（充能、声望、周天）与主行动（每屏至多一个金色按钮）。金色一旦泛滥，账台就成了赌场。

**The Semantic Ink Rule.** 语义状态色只允许携带各自的语义出现：战斗状态色禁止拿毒翠做「成功提示」、拿血褐做普通强调；朱砂只表示「可冲穴」，墨金只表示「已成」。

状态即颜色，颜色即状态，且永远伴随文字标签或形状差异（不以颜色为唯一区分——月相三态另有形状差异，星曜三态另有明度差异，伤势三档另有格数差异）。

**伤势三色的双重身份**：毒翠与血褐各自承担两层含义——毒翠＝战斗中的毒层 / 角色身上的毒伤，血褐＝气血条与战败 / 角色身上的外伤。两层同属「受损」语义，不构成冲突；淤紫则专表内伤，别无他用。受伤导致的产出下降（如挂机内力速率转血褐）算在血褐的「受损」语义内，是授权用法。

## 3. Typography

**Display Font:** Songti SC（STSong / SimSun 兜底，衬线）
**Body Font:** -apple-system / PingFang SC（系统无衬线栈）
**Data:** 同 Body，`font-variant-numeric: tabular-nums` 强制等宽

**Character:** 宋体的骨与系统无衬线的肉——专名有江湖气，数据有账本的整齐。两种字族按「语义领地」分配，绝不混用。

### Hierarchy
- **Display**（700, 19–40px, letter-spacing 0.06–0.22em）: 游戏标题、境界名、敌人名、仪式大字（「事了拂衣去」）。仅限江湖专名。
- **Title**（600, 14–17px）: 面板标题、弹窗标题。无衬线。
- **Body**（400, 13–14px, lh 1.55）: 说明、日志、机制描述。
- **Data**（600, 13–16px, tabular-nums）: 一切数值。资源、属性、进度、价格。
- **Label**（400, 11–12px, +0.05em, 淡墨）: 字段标签、注脚、来源分解小字。

**The Serif-Is-Sacred Rule.** 宋体只出现在有名字的东西上——人、地、境界、招式、仪式。按钮文字、表格、说明一律无衬线。衬线一旦进表格，账台就成了戏台。

**The Tabular Rule.** 任何会变化的数字必须 tabular-nums 等宽渲染，右对齐成列。数字跳动时列不能晃。

## 4. Elevation

深夜低照度：深度主要靠**三级色调分层**（night-bg → night-surface → night-surface-raised）与 1px 描线承载，阴影是极轻的辅助（`0 2px 8px oklch(0.08 0.01 262 / 0.5)`）。发光效果全系统只有两处特权：关键资源数字的微光（`text-shadow: 0 0 12px oklch(0.76 0.13 78 / 0.35)`）与峰终演出的金色辉光——日常界面禁止 glow。

### Shadow Vocabulary
- **panel**（`0 2px 8px oklch(0.08 0.01 262 / 0.5)`）: 面板静置阴影。
- **modal**（`0 12px 48px oklch(0.05 0.01 262 / 0.7)`）: 弹窗浮出。
- **num-glow**（`0 0 12px oklch(0.76 0.13 78 / 0.35)`）: 仅限顶栏资源数值与仪式数字。

**The Midnight Rule.** 平面为常态，辉光是仪式。发光授权按**场景**发放而非按组件发放，全系统共三处：① 顶栏资源数值微光；② 峰终演出金色辉光；③ **内景场景**——丹田内视是返观内照，场景本身即演出，故整场授权发光（气光、柔晕、罡气、经脉辉光）。外视人影不在此列，仍受日常约束，只许丹田一处气光透出。三处之外，若某个日常组件看起来在发光，说明它越权了。

## 5. Components

组件气质：清瘦、方正、描线分明——像账本的格线，不像卡牌的镶边。

### Buttons
- **Shape:** 圆角 6px，全宽或定宽，padding 9px 0。
- **Primary:** 烛火暖金底 + 烛芯墨字（600）；hover 提亮 `filter: brightness(1.08)`；每屏至多一个。
- **Ghost:** 透明底 + 1px 重线描边 + 暖墨字；hover 覆冷青浅底 `oklch(0.74 0.10 215 / 0.14)`。
- **Danger:** 血褐底 + 近白字，仅限不可逆操作（归隐确认、低收益归隐）。
- **Pulse:** 金色呼吸光圈动画，仅限「当前唯一推荐行动」（突破就绪、归隐入口），全屏同时至多一个。
- **Disabled:** bar-track 底 + 淡墨字。

### Chips（tag / status-pill / pulse-capsule）
- **敌人标签 tag:** 1px 语义色描边 + 同色文字，透明或极浅同色底，圆角 4px，11px。精英=金、Boss=血褐、机制=冷青浅底。
- **状态药丸 status-pill:** 圆角 10px 胶囊，语义色点 + 等宽数字（「中毒 4/8 层」）。
- **进度胶囊 pulse-capsule:** 页签行右侧常驻，surface 底 + 描线 + 72px 迷你进度条，可点击跳转。

### 严重度指示器 severity-meter
三格微条（4×11px，间距 2px，圆角 1px），填充格用伤型语义色、空格用 `oklch(0.36 0.02 262)`——**空格必须可见**，否则数不出「三格里填了几格」，三重编码退化成单纯的颜色区分。轻＝1 格、中＝2 格、重＝3 格，始终与文字标签（「外伤 · 中」）同时出现。

### 年岁行 age-line
挂在侧栏境界名之下、同一身份块：`{年岁} 岁　江湖历 {年} 年`，12px 等宽数字，年岁数值 ink-warm、江湖历退到 ink-faint。**不做倒计时、不画进度条**——寿元是容量上限，不是沙漏。垂暮态在年岁后插一枚朱砂描边小标。境界名后不再显示「境界 N / 7」。原型 `docs/design/reincarnation-prototype.html` §1。

### 魂魄芯片 soul-chip
与身体芯片（`wound-chip`）同一形制并排：标签 11px 淡墨 +「未稳」13px 墨金 + 副文 11px。边框为墨金 45% 透明。**魂魄安稳时不渲染**——没到那一步就不露出。强制转世演出与主动归隐共用结算卡，只多卡顶死因行与声望下方的「魂魄未稳」交代（墨金小标 + 12.5px 正文，上方 1px 分隔线），两种死因只换死因那一句。

### Cards / Containers
- **Panel:** night-surface 底、1px 描线、圆角 8px、panel 阴影；头部 10px 14px 带下描线，主体 12px 14px。禁止卡中嵌卡。
- **仪表簇 res-group:** 单一容器（账台灰底、圆角 8px），格间 1px 描线分隔，格内「标签+数值+速率」一行式基线对齐。
- **三栏损益 sc-col:** 获得=金浅底 / 失去=血浅底 / 保留=青浅底，各配 40% 透明度同色描边。

### Inputs / Fields
MVP-0 无表单输入组件；实现若需（如测试者编号），沿用 ghost 按钮的描线语言：surface 底、1px line-strong、圆角 6px、focus 冷青 2px outline。

### Navigation（game-tabs）
- 无底色页签，active = 暖墨字 600 + 2px 金色下划线；hover 仅提字色；disabled 淡墨且锁定文案即目标指引（「武学 · 境界 2 解锁」）。
- 页签行右侧驻进度胶囊——**切走页签不得丢失进度脉搏**，这是页签分层的前提条款。

### 修炼面板（signature component）
两态场景：**外视**（人影全景，看气象）⇄ 点丹田切入**内视**（丹田内景，看详情、冲穴）。取代原「周天充能条」——等宽分段条承载不了「丹田是会长大的蓄水池」这一心智模型（周天规格 §1）。

- **外视**：水墨人影为底并压暗，丹田处一团气光。气光由三层叠出——暗晕（multiply，在白袍上压出受光凹陷）+ 气光（screen）+ 径向遮罩羽化边缘。硬边圆盘贴在水墨画上必然像贴纸，**边缘必须羽化**。气光强弱即进度，**外视不做液位裁切**：小尺寸下那条水平切边会暴露成矩形。经脉走「弃线留光」（粗描边 + 重模糊），不画几何线——几何的准与水墨的晕互相打架。
- **内视**：三层合成，自后向前 = 墨渊星空背景 / 液体器皿 / 星图器物层。每层只吃自己那一档数据，互不复述（绑定表见周天规格 §4.2）。
- **液面**：由波形 `mask` 裁出液体**自身**的边缘。禁止用叠加色带模拟液面——色带的填色与素材永远对不上，且色带之外会露出 clip 的水平直线。
- **器物层**：周天 = 月相串（晦月 → 上弦 → 满月），窍穴 = 星曜（墨星 / 朱砂星 / 墨金星）+ 星官连线。**禁止在人影上布可数的窍穴点**：窍穴数随境界从 4 涨到 20+，人影只承载境界级气象，离散读数归器物层。

**素材分工**：凡需与丹田数值实时对表的量（液位、转速、三态切换）一律代码实现；AI 素材只供质感与形状。预渲染素材穷举不了连续变量。素材制作纪律见 `docs/systems/zhoutian/spec.md` §4.4。

### 乘区透视（signature component）
`基础值 × (1+永久)% × (1+本轮)% = 结果` 的横式展开：基础=次墨、永久=金、本轮=冷青、结果=金色 15px 加重，配色例图注。这是「数值透明」立场的旗舰组件。

## 6. Do's and Don'ts

### Do:
- **Do** 所有可变数字用 tabular-nums 并右对齐成列；来源分解（基础 × 永久 × 本轮）用 11.5px 淡墨小字挂在数值行下。
- **Do** 保持单一数据源：同一数值在修炼页/战斗页/武学页三处渲染必须一致（golden 对照覆盖）——三处数字打架是本系统唯一的「信任崩塌级」事故。
- **Do** 把演出预算全部花在峰终：归隐结算（金色辉光 + 数字滚动 + 分步淡入）与突破瞬间；日常交互 150–300ms 尖锐 ease-out（`cubic-bezier(0.22, 1, 0.36, 1)`）。
- **Do** 每个动效配 `prefers-reduced-motion` 降级（演出降为交叉淡入）。
- **Do** 锁定态写明解锁条件（「声望阁 · 归隐后解锁」），锁定文案即目标指引。
- **Do** AI 美术素材只承担质感与形状；一切与数值实时对表的表现（液位、转速、状态切换）由代码驱动，素材与数据的接缝永远划在这条线上。
- **Do** 循环视频素材用首尾同帧生成并验收接缝（首尾帧灰度均差 < 1%），同时复核中间帧确有位移——防止模型退化成静止画面。

### Don't:
- **Don't** 廉价页游感：禁止闪烁按钮、红点轰炸、战力飙升弹字、多个按钮同时呼吸发光（PRODUCT.md 反参考原文）。
- **Don't** 低幼卡通休闲风：禁止高饱和亮色大圆角糖果质感（PRODUCT.md 反参考）。
- **Don't** 通用 SaaS 仪表盘气质：密度可以像工具，气质不能像工具——江湖专名必须走宋体，界面语言必须是武侠母语（运转周天，不是充能；丹田，不是钱包）（PRODUCT.md 反参考）。
- **Don't** 用 `border-left > 1px` 彩条做强调；不用渐变文字；不用装饰性毛玻璃。
- **Don't** 在日常组件上使用辉光、在非语义场合使用五种战斗状态色、在表格里使用衬线。
- **Don't** 给 `<video>` 或其祖先挂 CSS `filter`——会打断合成快路径，实测产生硬边矩形假影；调色一律用 ffmpeg 预先烘进素材。
- **Don't** 把位图素材当数据显示用：任何需要连续变化的量都不能靠预渲染素材穷举。
- **Don't** 发明第 8 项属性的展示位（§7.2 白名单 7 项的 1:1 映射即教学），不给无加成的属性行写「= 基础」之类废字——留白即层级。
