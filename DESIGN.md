---
name: 江湖无尽录
description: 夜色水墨里的武侠放置游戏——信息长在画里，不装在盒子里
colors:
  night-bg: "oklch(0.155 0.013 262)"
  night-deep: "oklch(0.125 0.012 262)"
  wash: "oklch(0.19 0.014 262)"
  wash-raised: "oklch(0.225 0.016 262)"
  ink: "oklch(0.91 0.012 85)"
  ink-muted: "oklch(0.76 0.015 85)"
  ink-faint: "oklch(0.64 0.014 262)"
  hair: "oklch(0.30 0.016 262 / 0.7)"
  candle-gold: "oklch(0.78 0.13 78)"
  candle-ink: "oklch(0.19 0.03 78)"
  ink-gold: "oklch(0.75 0.075 76)"
  done-line: "oklch(0.50 0.045 70)"
  todo-line: "oklch(0.40 0.014 262 / 0.7)"
  cinnabar: "oklch(0.66 0.14 32)"
  blood: "oklch(0.62 0.17 25)"
  qi-cyan: "oklch(0.74 0.10 215)"
  poison: "oklch(0.72 0.14 145)"
  crit-ember: "oklch(0.72 0.16 50)"
  card-cool: "oklch(0.25 0.017 262 / 0.55)"
  card-teal: "oklch(0.26 0.032 215 / 0.55)"
  card-wood: "oklch(0.25 0.03 58 / 0.5)"
  card-lacquer: "oklch(0.13 0.011 262 / 0.82)"
typography:
  display:
    fontFamily: "Noto Serif SC, Songti SC, STSong, serif"
    fontSize: "28px"
    fontWeight: 700
    letterSpacing: "0.18em"
  headline:
    fontFamily: "Noto Serif SC, Songti SC, STSong, serif"
    fontSize: "clamp(32px, 5vw, 64px)"
    fontWeight: 700
    letterSpacing: "0.2em"
  title:
    fontFamily: "Noto Serif SC, Songti SC, STSong, serif"
    fontSize: "15px"
    fontWeight: 600
    letterSpacing: "0.2em"
  body:
    fontFamily: "LXGW WenKai, -apple-system, PingFang SC, Microsoft YaHei, sans-serif"
    fontSize: "14px"
    lineHeight: 1.6
    fontFeature: "tnum"
  label:
    fontFamily: "LXGW WenKai, -apple-system, PingFang SC, sans-serif"
    fontSize: "12px"
    letterSpacing: "0.05em"
rounded:
  tag: "4px"
  control: "8px"
  button: "10px"
  card: "12px"
  sheet: "16px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "14px"
  lg: "22px"
  xl: "34px"
components:
  button-primary:
    backgroundColor: "oklch(0.78 0.13 78 / 0.10)"
    textColor: "{colors.candle-gold}"
    rounded: "{rounded.button}"
    padding: "11px 26px"
  button-quiet:
    backgroundColor: "transparent"
    textColor: "{colors.ink-muted}"
    rounded: "{rounded.button}"
    padding: "11px 26px"
  button-inline:
    backgroundColor: "transparent"
    textColor: "{colors.candle-gold}"
    rounded: "{rounded.control}"
    padding: "5px 14px"
  card:
    backgroundColor: "{colors.card-cool}"
    rounded: "{rounded.card}"
    padding: "16px 18px"
  card-wound:
    backgroundColor: "oklch(0.62 0.17 25 / 0.12)"
    rounded: "{rounded.card}"
    padding: "16px 18px"
  tag-common:
    backgroundColor: "oklch(0.30 0.014 262 / 0.55)"
    textColor: "{colors.ink-muted}"
    rounded: "{rounded.tag}"
  tag-fine:
    backgroundColor: "oklch(0.74 0.10 215 / 0.10)"
    textColor: "oklch(0.80 0.08 210)"
    rounded: "{rounded.tag}"
  tag-peak:
    backgroundColor: "oklch(0.78 0.13 78 / 0.10)"
    textColor: "{colors.candle-gold}"
    rounded: "{rounded.tag}"
  nav-item-active:
    backgroundColor: "oklch(0.78 0.13 78 / 0.09)"
    textColor: "{colors.candle-gold}"
    rounded: "{rounded.control}"
    padding: "9px 12px"
---

# Design System: 江湖无尽录

> 获批原型：`docs/design/ui-overhaul-prototype.html`（issue #26 视觉 + 骨架大改，2026-09-30 定稿）。本文件与原型冲突时以原型为准并回改本文件。

## 1. Overview

**Creative North Star: "月下水墨卷"**

整个游戏是一幅夜里展开的水墨长卷。每一页背后固定铺一幅 AI 水墨画（侧栏右侧、视口高度、上浓下淡），信息浮在画上，不装进盒子。外壳只有一层：左侧「人物卷」侧栏（身份、资源、导航合一），右侧舞台一次只放一页。没有顶栏，没有状态条。

日常界面克制，只给做决定需要的信息；推导公式放进悬停，教程不常驻。情绪集中投放在四个整屏演出上：突破、出关、战败、转世，它们与页面不是一套语言，是更重的一档。

本系统明确拒绝 PRODUCT.md 列出的三种反面：**廉价页游感**（闪烁按钮、满屏红点、战力飙升弹字）、**低幼卡通休闲风**、**通用 SaaS 仪表盘气质**（这是游戏，不是后台管理系统）。

**Key Characteristics:**
- 一层外壳：人物卷侧栏 + 舞台；手机宽度改为顶部资源条 + 底部页签栏。
- 底图固定铺满舞台背后，所有页同位；人物、对阵等主画面直接画在底图上，不加底框。
- 卡片只用于真正成组的信息（身手、破境、伤势、心法要诀、商店），从不嵌套。
- 进度线全站一个规则：实线已完成、虚线剩余。
- 标题用思源宋体，正文用霞鹜文楷，数字等宽。

## 2. Colors

夜色靛黑为底，烛火暖金是唯一的主强调，其余颜色只在战斗与状态里出现。

### Primary
- **烛火暖金 Candle Gold** (`oklch(0.78 0.13 78)`)：主按钮文字与描边、当前页签、当前节点、可买的价格。任一屏幕上占比 ≤10%。
- **墨金 Ink Gold** (`oklch(0.75 0.075 76)`)：「已成」状态——已通窍穴、已过节点、已首杀精英、已走过的路。暖金标「进行中 / 可操作」，墨金标「已完成」。

### Secondary
- **冷青 Qi Cyan** (`oklch(0.74 0.10 215)`)：真气条、武学招式名、招式附加效果、上乘品质。
- **朱砂 Cinnabar** (`oklch(0.66 0.14 32)`)：可冲窍穴、Boss 标记、「主修」角标。

### Tertiary（战斗与状态专用）
- **血褐 Blood** (`oklch(0.62 0.17 25)`)：气血墨条、伤势卡底色、战败演出底色。
- **毒翠 Poison** (`oklch(0.72 0.14 145)`)、**暴击余烬 Crit Ember** (`oklch(0.72 0.16 50)`)：战报里的毒伤与暴击数字。

### Neutral
- **夜底 Night Bg** (`oklch(0.155 0.013 262)`)：页面底色，叠一层 5% 噪点作纸绢纹理。
- **深夜 Night Deep** (`oklch(0.125 0.012 262)`)：侧栏底色。
- **淡洗 Wash** / **淡洗加深 Wash Raised**：分段切换器底、选中项底，不描边。
- **墨 Ink** (`oklch(0.91 0.012 85)`)：正文与数值；**墨淡 Ink Muted**：次级文字；**墨浅 Ink Faint**：说明、标签。三者在夜底上均 ≥4.5:1。
- **墨线 Hair** (`oklch(0.30 0.016 262 / 0.7)`)：唯一允许的分隔线，1px。
- **卡片底**：默认冷灰 `card-cool`，设置面板可切墨青 / 檀木 / 漆底描金；伤势卡固定血褐淡底。

### Named Rules
**The One Candle Rule.** 烛火暖金只标「现在能做的事」和「当前位置」。已完成的东西一律退成墨金，未解锁的一律退成墨浅。
**The Dot Lives In The Rail Rule.** 提示点（金点）只出现在侧栏页签上，主界面任何地方都不放提示点。

## 3. Typography

**Display Font:** Noto Serif SC（思源宋体，回退 Songti SC）
**Body Font:** LXGW WenKai（霞鹜文楷，回退 PingFang SC）

**Character:** 宋体端正压住标题与江湖专名，文楷带一点手写温度，让大段说明和战报读起来像话本。数字一律 `tabular-nums`。

### Hierarchy
- **Headline**（700，clamp(32px, 5vw, 64px)，字距 0.2em）：只用于整屏演出的主标题（小有所成、此生至此）。
- **Display**（700，28px，字距 0.18em）：页标题（运转周天、村外小径、惊雷诀）。侧栏境界名 30px。
- **Title**（600，15–17px，字距 0.2em）：卡片标题、武学/内功名、导航项（18px，字距 0.35em）。
- **Body**（400，14px，行高 1.6；战报 1.85）：正文、战报、说明。长段不超过 30em。
- **Label**（400，11–12.5px）：卡片副注、数值标签、节点名。

### Named Rules
**The Serif Is For Names Rule.** 宋体只给标题、江湖专名（境界、武学、内功、招式、门派、地图）与按钮文字；数值与说明一律正文字体。

## 4. Elevation

平面为主，靠明度差分层，不靠边框。卡片是比底色亮一档的半透明渐变，没有投影；只有浮起的东西（弹出的设置面板、悬停提示、陈列中的书册）才有投影。

### Shadow Vocabulary
- **浮层** (`box-shadow: 0 14px 40px oklch(0.05 0.01 262 / 0.7)`)：设置面板、悬停提示。
- **陈列物** (`filter: drop-shadow(0 8px 14px oklch(0.05 0.01 262 / 0.6))`)：书脊、书册封面。
- **选中辉光** (`0 0 12px oklch(0.78 0.13 78 / 0.35)`)：当前节点、选中书册、当前关卡点。
- **漆底描金卡**：`inset 0 1px 0 oklch(0.75 0.075 76 / 0.32)` 顶边一道金线，是唯一带内描边的卡片变体。

### Named Rules
**The No Box Around The Painting Rule.** 底图、人物、对阵这类「画」不能放进带底色的盒子；AI 图接入时用椭圆或纵向羽化、去饱和，人物图用 `mix-blend-mode: screen` 融进底图。

## 5. Components

### Buttons
- **描金主按钮**（`.main-btn` / 突破、挑战）：暗底淡金渐变 + 1px 金描边 + 金色宋体字，圆角 10px；悬停描边加亮并外发金光。第二行小字（价格、耗费）用正文字体墨淡色。
- **轻按钮**（`.main-btn.quiet`）：透明底、墨线描边、墨淡字，用于「再闯一阵」「立即重试」这类次选。
- **行内按钮**（`.btn2`）：13.5px 宋体金字 + 金色细描边，圆角 8px。商店统一「价格写在按钮上」（如「450 贡献」），买不起时置灰，下方一行小字「还差 130」。
- **禁用态**：去掉底色，只留墨线描边与墨浅字，文字写明缘由（「周天运转中 · 约 21 分钟后可突破」）。
- 不做实心金色大块按钮。

### Tags（品质）
- **寻常**：墨淡字、灰淡底。**上乘**：冷青字、冷青淡底 + 冷青细描边。**绝学**：暖金字、金淡底 + 金描边 + 微光。武学、内功、商店统一使用。

### Cards / Containers
- **Corner Style:** 12px。**Background:** `var(--card)`（默认冷灰，可切换）。**Border:** 无。**Padding:** 16px 18px。
- 卡片头：左侧宋体标题，右侧可选一行墨浅小字。同一行并排的卡片顶端对齐。
- 卡片内列表用「行」（`.row-i`）：标题 + 标签 + 一行说明，右侧操作；行间 1px 墨线，不给每行套框。

### Progress（进度线）
- 全站一个规则：**实线 = 已完成，虚线 = 剩余**。实线 1.5px `done-line`，虚线 1px `todo-line`（3px 线 / 3px 空）。
- 变体：燃香（周天，带火星与三段刻痕）、关卡进度线（精英菱形、Boss 朱砂菱形）、内功节点路、武学熟练四节点（生疏 · 熟练 · 精通 · 圆满）、门派任务进度。
- 气血 / 真气用「墨条」：7px / 5px 圆头条，尾端 14px 羽化。

### Navigation（人物卷侧栏）
- 宽 248px，深夜底。自上而下：品牌名 → 境界名（30px 宋体）+ 第几世 · 岁数 · 江湖历 → 身体状况一行 → 内力（带速率）/ 银两 / 声望 → 毛笔墨线 → 页签 → 底部「转世」与设置齿轮。
- 页签：18px 宋体、字距 0.35em；当前项暖金字 + 淡金底；未解锁的页签不显示，新开的带金点。
- 设置齿轮弹出设置面板（卡片底色、画面主题）。
- 手机宽度（≤860px）：侧栏收起，顶部一条资源条，底部固定页签栏。

### Signature Components
- **陈列**：武学用线装书脊（竖排书名，按品质换布色，底部类别简笔图标），内功用线装书册封面（书名写在题签上）。都带类型筛选的分段切换。
- **战报**：每回合一个【第 N 回合】抬头，下面成段叙述；「你」墨金、敌名朱红、招式名冷青、伤害数字加粗。句式来自 `docs/rules/copy/battle-narration.md`。
- **整屏演出**：突破（金）、出关（冷蓝）、战败（暗红）、转世（暮金）四种径向渐变底，内容居中无框：小字题眼 → 大标题 → 一行说明 → 得失对照 → 按钮。

## 6. Do's and Don'ts

### Do:
- **Do** 让每页的 AI 底图固定铺在舞台背后同一位置，上浓下淡（遮罩 100% → 35% → 0）。
- **Do** 空状态收起：无伤只在侧栏写一行「身无伤病」，有伤才出现伤势卡，且排在最下，不挤动其它卡片。
- **Do** 把公式与推导放进悬停（带点状下划线的数值可悬停）。
- **Do** 一次只摊开眼前需要的：65 关只列当前附近十来关，全表按需展开。
- **Do** 用「转世」称呼玩家主动结束一世（归隐是转世的一种，不再作为玩家可见的动作名）。

### Don't:
- **Don't** 做廉价页游感：闪烁按钮、满屏红点、战力飙升弹字。
- **Don't** 做低幼卡通休闲风。
- **Don't** 做通用 SaaS 仪表盘气质：不要表格表头、不要一格一框、不要卡片套卡片。
- **Don't** 在主界面放提示点，也不要把「开发用语」给玩家看（「前沿」「台阶」「乘区」「第 0 重基础效果」）。
- **Don't** 用 `border-left` / `border-right` 大于 1px 做彩色侧条；不要渐变文字；不要装饰性毛玻璃。
- **Don't** 用实心金色大按钮、扁平分段色块进度条。
- **Don't** 在人物属性里显示「突破后」数值——突破前后对比只在突破演出里出现。
