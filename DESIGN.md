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
  grade-fine: "oklch(0.78 0.12 145)"
  grade-superior: "oklch(0.78 0.09 215)"
  grade-rare: "oklch(0.76 0.13 300)"
  grade-supreme: "oklch(0.72 0.16 50)"
  route-vigorous: "oklch(0.72 0.16 28)"
  route-lasting: "oklch(0.76 0.11 135)"
  route-guarding: "oklch(0.74 0.10 245)"
  route-devious: "oklch(0.74 0.11 320)"
  route-venomous: "oklch(0.70 0.10 175)"
  black-ink: "oklch(0.82 0.09 300)"
  black-card: "oklch(0.13 0.02 300 / 0.75)"
  black-line: "oklch(0.4 0.08 300 / 0.35)"
  lantern-gold: "oklch(0.8 0.08 70)"
  seal-red: "oklch(0.5 0.17 28 / 0.92)"
  grade-bronze: "oklch(0.80 0.07 55)"
  grade-silver: "oklch(0.88 0.01 240)"
  grade-gold: "oklch(0.78 0.13 78)"
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
  cell: "6px"
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
  tag-grade-common:
    backgroundColor: "oklch(0.30 0.014 262 / 0.55)"
    textColor: "{colors.ink-muted}"
    rounded: "{rounded.tag}"
    padding: "1px 6px"
  tag-grade-fine:
    backgroundColor: "oklch(0.72 0.14 145 / 0.12)"
    textColor: "{colors.grade-fine}"
    rounded: "{rounded.tag}"
    padding: "1px 6px"
  tag-grade-superior:
    backgroundColor: "oklch(0.74 0.10 215 / 0.12)"
    textColor: "{colors.grade-superior}"
    rounded: "{rounded.tag}"
    padding: "1px 6px"
  tag-grade-rare:
    backgroundColor: "oklch(0.7 0.14 300 / 0.14)"
    textColor: "{colors.grade-rare}"
    rounded: "{rounded.tag}"
    padding: "1px 6px"
  tag-grade-supreme:
    backgroundColor: "oklch(0.72 0.16 50 / 0.14)"
    textColor: "{colors.grade-supreme}"
    rounded: "{rounded.tag}"
    padding: "1px 6px"
  tag-route:
    backgroundColor: "transparent"
    textColor: "{colors.route-vigorous}"
    rounded: "3px"
    padding: "1px 7px"
  bag-cell:
    backgroundColor: "oklch(0.18 0.012 262 / 0.35)"
    rounded: "5px"
    size: "46px"
  item-tile:
    backgroundColor: "oklch(0.22 0.015 262 / 0.55)"
    rounded: "{rounded.cell}"
    padding: "3px"
  mask-card:
    backgroundColor: "oklch(0.18 0.03 300 / 0.8)"
    textColor: "{colors.ink}"
    rounded: "{rounded.button}"
    padding: "10px 8px"
    width: "200px"
  stall-item:
    backgroundColor: "oklch(0.22 0.015 262 / 0.5)"
    rounded: "{rounded.button}"
    padding: "10px"
  seg-switch:
    backgroundColor: "oklch(0.19 0.014 262 / 0.8)"
    rounded: "{rounded.button}"
    padding: "3px"
  seg-switch-item-active:
    backgroundColor: "{colors.wash-raised}"
    textColor: "{colors.ink}"
    rounded: "{rounded.control}"
    padding: "6px 18px"
  stat-tile:
    backgroundColor: "oklch(0.18 0.012 262 / 0.45)"
    rounded: "{rounded.button}"
    padding: "14px 14px 12px"
  achv-tile:
    backgroundColor: "oklch(0.18 0.012 262 / 0.45)"
    rounded: "{rounded.button}"
    padding: "12px 10px 10px"
---

# Design System: 江湖无尽录

> 获批原型：`docs/design/ui-overhaul-prototype.html`（issue #26 视觉 + 骨架大改，2026-09-30 定稿）；`docs/design/battle-loot-prototype.html`（issue #45 战斗挂机、装备、市集与黑市，2026-10-13 定稿，在前者之上增补）；`docs/design/report-panel-prototype.html`（dev 构建内的提报面板，2026-10-15 定稿，只复用既有 token，不新增）；`docs/design/prestige-shop-prototype.html`（前尘页：底蕴 / 机缘 / 侠名录三段，成就徽记铜 / 银 / 金三品，2026-10-16 定稿，在前者之上增补）。本文件与原型冲突时以原型为准并回改本文件。

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
- 装备数值一律整数；界面上不写解释性小字，规则靠形态和悬停说清。
- 道具图走写实材质（金属、皮革、玉石），与水墨底图、线装书封有意对比；一名一图。

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

### 装备品阶（五阶）
- **凡品**：墨淡字、灰淡底，格子素色。**精良** (`grade-fine`)、**上乘** (`grade-superior`)、**珍品** (`grade-rare`)、**极品** (`grade-supreme`)：章用同色淡底，背包格用同色描边 + 底部同色晕 + 右下角标，极品另加外发光。装备名（含词条前缀）整体着品阶色。
- 武学品质三阶（寻常 / 上乘 / 绝学）与装备品阶是两套：武学用灰 / 冷青 / 暖金填充章，装备用五阶描边。

### 武学路数（五色）
- **刚猛** `route-vigorous` 朱砂红、**绵长** `route-lasting` 竹青、**守御** `route-guarding` 石青、**诡谲** `route-devious` 紫、**阴毒** `route-venomous` 黛绿。色相刻意避开品阶的灰 / 青 210° / 金 78° 与装备品阶的绿 145° / 青 215° / 紫 300° / 橙。

### 成就三品（铜 / 银 / 金）
- 侠名录的成就层级不靠描边、不靠字，靠**徽记本身的材质**：铜版原图、银版去色提亮、金版暖黄加外晕，三套图一线三枚；未点亮灰度压暗。层名文字按品着色（`grade-bronze` / `grade-silver` / `grade-gold`），卡面不写「铜 / 银 / 金」字样。

### 黑市（暗调）
- 进入黑市整页换紫黑调：标题 `black-ink`，卡片 `black-card` + `black-line` 描边，底图压暗；灯笼与更漏用 `lantern-gold`。黑市是唯一允许整页换色相的页面。

### Named Rules
**The One Candle Rule.** 烛火暖金只标「现在能做的事」和「当前位置」。已完成的东西一律退成墨金，未解锁的一律退成墨浅。
**The Dot Lives In The Rail Rule.** 提示点（金点）只出现在侧栏页签上，主界面任何地方都不放提示点。
**The Grade On The Edge, Route In The Seal Rule.** 品阶靠描边和名字色说，路数靠一枚描边章说；两者不共用色相，不共用形态。
**The Grade Is The Metal Rule.** 成就的品质长在徽记材质上（铜币 → 银币 → 金币），不加框、不加字；和装备「品阶在描边」是两套语言，不混用。

## 3. Typography

**Display Font:** Noto Serif SC（思源宋体，回退 Songti SC）
**Body Font:** LXGW WenKai（霞鹜文楷，回退 PingFang SC）

**Character:** 宋体端正压住标题与江湖专名，文楷带一点手写温度，让大段说明和战报读起来像话本。数字一律 `tabular-nums`。

### Hierarchy
- **Headline**（700，clamp(32px, 5vw, 64px)，字距 0.2em）：只用于整屏演出的主标题（小有所成、此生至此）。
- **Display**（700，28px，字距 0.18em）：页标题（运转周天、村外小径、百川诀）。侧栏境界名 30px。
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

### Tags（装备品阶与路数）
- **品阶章**（`.gtag`）：11px，同色淡底、同色字，五阶各一色；跟在装备名后面。
- **路数章**（`.qtag.tag`）：透明底、1px 同色细描边、前置一枚 6px 同色亮点；跟在武学品质章后面。不用填充、不用侧条，和品阶章一眼分开。

### 行囊（形态格背包）
- 10 列 × 8 行共 80 格，格 46px、间距 4px；空格 `bag-cell` 淡底细描边。
- 物件按部位占格：兵器 1×3、暗器 1×2、衣甲 2×2、佩饰 1×1；游戏自动紧凑摆放，玩家不拖动。
- 物件格 `item-tile`：写实道具图按原比例填满，品阶靠描边 + 底晕 + 右下角标；左上金点 = 新得，右上 ▲ = 比身上好；比身上差的凡品、精良压暗。
- 比较面板：左 150×210 大图（品阶色径向晕底），右名字 + 逐项 ▲▼ 对比 + 词条 + 「穿戴」「卖出（价）」；穿着中只剩「卸下」，不写「正穿着」。
- 手机宽度：格缩到 32px，仍 10 列；大图缩到 110 宽。

### 市集与黑市
- 市集：摊位分段切换（武馆 / 兵器铺 / 衣饰铺 / 药铺），铺子用 `stall-item` 小卡：道具图 + 名 + 品阶章 + 类目 + 属性 + 价格按钮；武馆用行。
- 黑市入口：解锁前市集不露任何提示；解锁那一笔买下时进整屏演出，之后摊位条末尾多一个紫描边的「黑市」页签，点入整页拉黑转场（0.45s，从左向右）。
- 黑市：三张 `mask-card` 蒙面牌（问号遮罩 120×150，名 + 价），买下即揭晓为道具图 + 品阶色名；下方一排十枚铜钱表示本世剩余次数，标题右侧更漏倒计时。不写概率，不写保底，不写剩余件数的文字。

### 前尘页（底蕴 / 机缘 / 侠名录）
- 页顶一条分段切换（`seg-switch`，同市集摊位条），一次只摊开一区；三区各一张夜色水墨底图，随页签淡入切换。
- 底蕴：一张修行感悟宽卡 + 八张属性小卡 4 × 2（`stat-tile`）：宋体名 + 属性字、级数大字、「现 +x · 下一级 +y」两行、价格按钮；没有「尽数」。
- 机缘：一次性购买项行列表（`.row-i`），名 + 类型章 + 一句短效果，价格写在按钮上，已购写「已得」。
- 侠名录：成就徽记 6 × 4 网格（`achv-tile`）：徽记 + 当前层名，卡面不放进度、不写品字；悬停两行「当前效果」「下一级：名 · 计量 n/门槛」。

### Signature Components
- **陈列**：武学与内功都用 AI 线装书册封面（书名写在题签上）。内功按品质用蓝 / 青 / 金三张封面；武学同三张封面按品阶换色（寻常麻布灰褐、上乘绛紫、绝学朱红描金，题签固定米黄），右下压一枚朱砂类目印（剑 / 刀 / 枪 / 棍 / 拳 / 掌 / 指 / 腿 / 镖），未拼齐的在本品阶色上压暗。类目筛选分器械 / 肉身 / 暗器三组。
- **战报**：每回合一个【第 N 回合】抬头，下面成段叙述；「你」墨金、敌名朱红、招式名冷青、伤害数字加粗。句式来自 `docs/rules/copy/battle-narration.md`。
- **整屏演出**：突破（金）、出关（冷蓝）、战败（暗红）、转世（暮金）、传功（冷青）、暗门（灯笼暖光压紫黑）六种径向渐变底，内容居中无框：小字题眼 → 大标题 → 一行说明 / 话本段落 → 得失对照或三选一 → 按钮。
- **挂机态**：战斗页顶部一条淡金描边状态栏（呼吸金点 + 「挂机中」+ 关数 / 场次 / 拾得 + 收手），挑战按钮仍在其下。
- **战报掉落行**：胜利后「拾得：」+ 装备名按品阶着色、武学全本 / 残页用冷青。

## 6. Do's and Don'ts

### Do:
- **Do** 让每页的 AI 底图固定铺在舞台背后同一位置，上浓下淡（遮罩 100% → 35% → 0）。
- **Do** 空状态收起：无伤只在侧栏写一行「身无伤病」，有伤才出现伤势卡，且排在最下，不挤动其它卡片。
- **Do** 把公式与推导放进悬停（带点状下划线的数值可悬停）。
- **Do** 一次只摊开眼前需要的：65 关只列当前附近十来关，全表按需展开。
- **Do** 用「转世」称呼玩家主动结束一世（归隐是转世的一种，不再作为玩家可见的动作名）。
- **Do** 让装备的品阶不点开也能看出来：描边、底晕、角标三重信号，凡品素色。
- **Do** 把数量用物件表示：剩余次数是一排铜钱，剩余件数是还蒙着的牌，倒计时是更漏。
- **Do** 让成就的品质长在徽记材质上（铜 / 银 / 金三套图），进度收进悬停。
- **Do** 把可反复购买项写成「现 +x · 下一级 +y」，每买一级都看得见下一级给多少。

### Don't:
- **Don't** 做廉价页游感：闪烁按钮、满屏红点、战力飙升弹字。
- **Don't** 做低幼卡通休闲风。
- **Don't** 做通用 SaaS 仪表盘气质：不要表格表头、不要一格一框、不要卡片套卡片。
- **Don't** 在主界面放提示点，也不要把「开发用语」给玩家看（「前沿」「台阶」「乘区」「第 0 重基础效果」）。
- **Don't** 用 `border-left` / `border-right` 大于 1px 做彩色侧条；不要渐变文字；不要装饰性毛玻璃。
- **Don't** 用实心金色大按钮、扁平分段色块进度条。
- **Don't** 在人物属性里显示「突破后」数值——突破前后对比只在突破演出里出现。
- **Don't** 加解释性小字：按钮下的规则说明、面板里的「装备等级越高属性越高」、页标题下的副标题一律不写；规则靠形态、文案靠悬停。效果说明一律短句（「行囊空间 +2」「丹田上限提高两成」），不写「夜里少散功」这类白话。
- **Don't** 用「一二三」印或描边表示成就层级；也不要在成就卡面放进度条或「铜 / 银 / 金」字样。
- **Don't** 在界面上出现小数：装备数值生成时就取整，装备等级这类内部数不露出。
- **Don't** 在黑市解锁前露任何入口或进度提示；不公示概率与保底。
- **Don't** 让武学书封照搬内功的三色；也不要用不透明填充章表示路数。
