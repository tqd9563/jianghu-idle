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
  shield-blue: "oklch(0.70 0.10 240)"
  crit-ember: "oklch(0.70 0.16 45)"
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
- 六种战斗状态色是语义词汇表（毒/血/盾/暴/气），永不用于装饰
- 宋体衬线只给江湖专名（标题/境界/敌名/仪式），界面与数据一律无衬线
- 高密度但有层级：页签分职责，仪表簇统一基线，留白即层级

## 2. Colors

夜幕蓝黑为纸，烛火暖金为笔，五种战斗状态色为印。

### Primary
- **烛火暖金 candle-gold** (oklch(0.76 0.13 78)): 主行动按钮、激活页签下划线、周天充能条、声望数值、关键数字的微光。它是「进展」的颜色——凡是金色的东西，都值得玩家看一眼。
- **烛芯墨 candle-ink** (oklch(0.18 0.03 78)): 金底上的文字，饱和色上永不用纯黑。

### Secondary
- **剑气冷青 sword-cyan** (oklch(0.74 0.10 215)): 信息与教学——克制提示、乘区透视的本轮加成、战斗日志的状态事件、链接。冷青与暖金是系统内唯一一对冷暖对话。

### Tertiary（战斗语义色，仅限状态含义）
- **毒翠 poison-green** (oklch(0.72 0.14 145)): 毒层/毒伤/资源增速（+16.9/秒）。
- **血褐 blood-red** (oklch(0.64 0.17 25)): 气血条、战败、危险操作按钮。
- **盾青 shield-blue** (oklch(0.70 0.10 240)): 护盾/少林。
- **燎原橙 crit-ember** (oklch(0.70 0.16 45)): 暴击/华山。

### Neutral
- **夜幕 night-bg** (oklch(0.165 0.014 262)): 页面底色。**导航深黑 night-nav** (oklch(0.13 0.012 262))、**账台灰 night-chrome** (oklch(0.19 0.015 262))、**卡面 night-surface** (oklch(0.215 0.016 262))、**浮面 night-surface-raised** (oklch(0.26 0.018 262)) 依次抬升。
- **暖墨 ink-warm** (oklch(0.90 0.012 85)): 正文，微暖的灰白——烛光下的纸色。**次墨 ink-muted** (oklch(0.70 0.015 85)) 说明文字；**淡墨 ink-faint** (oklch(0.56 0.015 262)) 标签与注脚。
- **描线 line** (oklch(0.32 0.02 262)) / **重线 line-strong** (oklch(0.48 0.03 262)): 边框与分隔。

**The Candlelight Rule.** 烛火暖金只照两样东西：进展（充能、声望、周天）与主行动（每屏至多一个金色按钮）。金色一旦泛滥，账台就成了赌场。

**The Semantic Ink Rule.** 五种战斗状态色只允许携带各自的语义出现，禁止拿毒翠做「成功提示」、拿血褐做普通强调。状态即颜色，颜色即状态，且永远伴随文字标签（不以颜色为唯一区分）。

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

**The Midnight Rule.** 平面为常态，辉光是仪式。若某个日常组件看起来在发光，说明它越权了。

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

### Cards / Containers
- **Panel:** night-surface 底、1px 描线、圆角 8px、panel 阴影；头部 10px 14px 带下描线，主体 12px 14px。禁止卡中嵌卡。
- **仪表簇 res-group:** 单一容器（账台灰底、圆角 8px），格间 1px 描线分隔，格内「标签+数值+速率」一行式基线对齐。
- **三栏损益 sc-col:** 获得=金浅底 / 失去=血浅底 / 保留=青浅底，各配 40% 透明度同色描边。

### Inputs / Fields
MVP-0 无表单输入组件；实现若需（如测试者编号），沿用 ghost 按钮的描线语言：surface 底、1px line-strong、圆角 6px、focus 冷青 2px outline。

### Navigation（game-tabs）
- 无底色页签，active = 暖墨字 600 + 2px 金色下划线；hover 仅提字色；disabled 淡墨且锁定文案即目标指引（「武学 · 境界 2 解锁」）。
- 页签行右侧驻进度胶囊——**切走页签不得丢失进度脉搏**，这是页签分层的前提条款。

### 周天充能条（signature component）
5 个等宽分段（14px 高、圆角 4px、5px 间距），满段金色实心、进行段 65% 透明金、空段 bar-track；下方「丹田内力 X / Y」与「第 N 周天 Z%」左右对齐。周天进度是丹田内力的**派生显示**（规格书 §6.1 v0.9），完整版可升级为环形经脉窍点形态（经脉方向记录）。

### 乘区透视（signature component）
`基础值 × (1+永久)% × (1+本轮)% = 结果` 的横式展开：基础=次墨、永久=金、本轮=冷青、结果=金色 15px 加重，配色例图注。这是「数值透明」立场的旗舰组件。

## 6. Do's and Don'ts

### Do:
- **Do** 所有可变数字用 tabular-nums 并右对齐成列；来源分解（基础 × 永久 × 本轮）用 11.5px 淡墨小字挂在数值行下。
- **Do** 保持单一数据源：同一数值在修炼页/战斗页/武学页三处渲染必须一致（golden 对照覆盖）——三处数字打架是本系统唯一的「信任崩塌级」事故。
- **Do** 把演出预算全部花在峰终：归隐结算（金色辉光 + 数字滚动 + 分步淡入）与突破瞬间；日常交互 150–300ms 尖锐 ease-out（`cubic-bezier(0.22, 1, 0.36, 1)`）。
- **Do** 每个动效配 `prefers-reduced-motion` 降级（演出降为交叉淡入）。
- **Do** 锁定态写明解锁条件（「声望阁 · 归隐后解锁」），锁定文案即目标指引。

### Don't:
- **Don't** 廉价页游感：禁止闪烁按钮、红点轰炸、战力飙升弹字、多个按钮同时呼吸发光（PRODUCT.md 反参考原文）。
- **Don't** 低幼卡通休闲风：禁止高饱和亮色大圆角糖果质感（PRODUCT.md 反参考）。
- **Don't** 通用 SaaS 仪表盘气质：密度可以像工具，气质不能像工具——江湖专名必须走宋体，界面语言必须是武侠母语（运转周天，不是充能；丹田，不是钱包）（PRODUCT.md 反参考）。
- **Don't** 用 `border-left > 1px` 彩条做强调；不用渐变文字；不用装饰性毛玻璃。
- **Don't** 在日常组件上使用辉光、在非语义场合使用五种战斗状态色、在表格里使用衬线。
- **Don't** 发明第 8 项属性的展示位（§7.2 白名单 7 项的 1:1 映射即教学），不给无加成的属性行写「= 基础」之类废字——留白即层级。
