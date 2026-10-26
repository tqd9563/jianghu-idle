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
  camp-zheng: "oklch(0.76 0.09 245)"
  camp-xie: "oklch(0.72 0.11 320)"
  camp-court: "oklch(0.76 0.10 135)"
  camp-jianghu: "oklch(0.78 0.012 262)"
  mist: "oklch(0.72 0.01 262 / 0.9)"
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
  seal: "3px"
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
  seal-camp-zheng:
    backgroundColor: "oklch(0.12 0.01 262 / 0.8)"
    textColor: "{colors.camp-zheng}"
    rounded: "{rounded.seal}"
    size: "16px"
  seal-camp-xie:
    backgroundColor: "oklch(0.12 0.01 262 / 0.8)"
    textColor: "{colors.camp-xie}"
    rounded: "{rounded.seal}"
    size: "16px"
  chronicle-chip-active:
    backgroundColor: "{colors.wash-raised}"
    textColor: "{colors.ink}"
    rounded: "{rounded.cell}"
    padding: "3px 7px"
  chronicle-big:
    backgroundColor: "oklch(0.62 0.17 25 / 0.10)"
    textColor: "{colors.ink}"
    rounded: "{rounded.control}"
    padding: "12px 10px"
  stage-check:
    backgroundColor: "oklch(0.12 0.01 262 / 0.85)"
    textColor: "{colors.ink-gold}"
    rounded: "50%"
    size: "24px"
  guardian-medallion:
    backgroundColor: "{colors.night-deep}"
    rounded: "50%"
    size: "56px"
  guardian-medallion-master:
    backgroundColor: "{colors.night-deep}"
    rounded: "50%"
    size: "64px"
---

# Design System: 江湖无尽录

> 获批原型：`docs/design/ui-overhaul-prototype.html`（issue #26 视觉 + 骨架大改，2026-09-30 定稿）；`docs/design/battle-loot-prototype.html`（issue #45 战斗挂机、装备、市集与黑市，2026-10-13 定稿，在前者之上增补）；`docs/design/report-panel-prototype.html`（dev 构建内的提报面板，2026-10-15 定稿，只复用既有 token，不新增）；`docs/design/prestige-shop-prototype.html`（前尘页：底蕴 / 机缘 / 侠名录三段，成就徽记铜 / 银 / 金三品，2026-10-16 定稿，在前者之上增补）；`docs/design/gongfa-prototype.html`（issue #80 内功、武学合为「武功」一页：装配印匣、3 × 3 藏书、磁青书页与换书翻页，2026-10-21 定稿，取代前者里的内功页、武学页）；`docs/design/living-jianghu-prototype.html`（活江湖第一期：江湖舆图与地域分图、场景式据点战斗页、长卷对阵区、江湖编年右栏、转世醒来，2026-10-23 定稿，取代前者里战斗页的关卡进度线与对阵区）。本文件与原型冲突时以原型为准并回改本文件。

## 1. Overview

**Creative North Star: "月下水墨卷"**

整个游戏是一幅夜里展开的水墨长卷。每一页背后固定铺一幅 AI 水墨画（侧栏右侧、视口高度、上浓下淡），信息浮在画上，不装进盒子。外壳只有一层：左侧「人物卷」侧栏（身份、资源、导航合一），中间舞台一次只放一页，右侧一栏「江湖编年」让世界在旁边自己走。没有顶栏，没有状态条。

日常界面克制，只给做决定需要的信息；推导公式放进悬停，教程不常驻。情绪集中投放在四个整屏演出上：突破、出关、战败、转世，它们与页面不是一套语言，是更重的一档。

本系统明确拒绝 PRODUCT.md 列出的三种反面：**廉价页游感**（闪烁按钮、满屏红点、战力飙升弹字）、**低幼卡通休闲风**、**通用 SaaS 仪表盘气质**（这是游戏，不是后台管理系统）。

**Key Characteristics:**
- 一层外壳：人物卷侧栏 + 舞台 + 江湖编年右栏；修炼、战斗页编年常驻（可手动收起），其余页收成窄边。手机宽度改为顶部资源条 + 底部页签栏。
- 战斗页是一卷地图：江湖舆图 → 地域分图（据点画在地里）→ 据点场景（关卡点立在画里的路上）。状态用雾、烛光、印、对钩、剪影这些游戏手法说，不靠图例。
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
- 内功三路借用其中三色：归海＝刚猛朱、镇岳＝守御石青、蚀骨＝阴毒黛绿（路数章、心法石印同色）。

### 成就三品（铜 / 银 / 金）
- 侠名录的成就层级不靠描边、不靠字，靠**徽记本身的材质**：铜版原图、银版去色提亮、金版暖黄加外晕，三套图一线三枚；未点亮灰度压暗。层名文字按品着色（`grade-bronze` / `grade-silver` / `grade-gold`），卡面不写「铜 / 银 / 金」字样。

### 黑市（暗调）
- 进入黑市整页换紫黑调：标题 `black-ink`，卡片 `black-card` + `black-line` 描边，底图压暗；灯笼与更漏用 `lantern-gold`。黑市是唯一允许整页换色相的页面。

### 势力与编年类别（活江湖）
- 编年条目与势力名牌按类别着色：**正道** `camp-zheng` 石青、**邪道** `camp-xie` 紫、**朝廷** `camp-court` 竹青、**江湖**（世家、帮会、镖局）`camp-jianghu` 银灰。玩家自己的事不标「此身」，直接写这一世的名字，用墨金。
- **大事**：朱砂字类别 + 血褐 10% 淡底（`chronicle-big`），是编年里唯一带底色的条目。
- 势力的正 / 邪写成 16px 小方印（`seal-camp-zheng` / `seal-camp-xie`），跟在势力名前。
- **云雾** `mist`：地域分图上未开的据点被几团缓慢漂移的雾遮住（模糊 14px）。

### Named Rules
**The Camp Color Stays In The Chronicle Rule.** 正邪朝廷的类别色只出现在编年、势力印与势力名牌上，不进武功页、行囊与战斗数值——那里同色相的是路数色，两套不得同屏混用。
**The One Candle Rule.** 烛火暖金只标「现在能做的事」和「当前位置」。已完成的东西一律退成墨金，未解锁的一律退成墨浅。
**The Dot Lives In The Rail Rule.** 提示点（金点）只出现在侧栏页签上，主界面任何地方都不放提示点。
**The Grade On The Edge, Route In The Seal Rule.** 品阶靠描边和名字色说，路数靠章与石印的颜色说；两者不共用色相。武功页的印匣即此：方匣描边与名字着品质色，匣中石印着路数色。
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

- **压字暗晕** (`text-shadow: 0 0 8px #000, 0 0 3px #000`)：叠在画上的文字（卷名、据点名、关名、场景标题）一律加这层暗晕保证可读，不给文字加底框。
- **飘字层**：伤害飘字放在独立的最上层，不进任何带遮罩的容器；26px 宋体朱红，会心 36px 暖金，耗真气 18px 冷青，招式名 15px 墨色；1.1s 上飘淡出。

### Named Rules
**The Painted-In Rule.** 地图上的建筑、据点不能是贴上去的小图：把那块地图截出来图生图，让建筑画进地里，再用 HTML 热区与雾 / 烛光 / 印表达状态。贴图无论怎么调色都看得出来。
**The Torn Edge Rule.** 画面（场景）与操作区（对阵底带）之间要分得清，但不画亮线、不一刀直切：底带顶边一道细毛边墨痕（噪点位移 9），下压 30px 暗影唇口。
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
- 气血 / 真气：对阵区用**刷痕条**——一笔干笔刷痕作遮罩（`public/art/scene/brush.png`，起笔厚、收笔飞白），气血 15px 朱红渐变、真气 10px 冷青渐变，空的部分留暗；敌方镜像。条上方一行「气血 / 真气」名目在外侧、「现值 / 上限」在内侧，现值墨色、上限墨浅。受击时着色部分 0.28s 缩短，浅色残影停 0.45s 再 0.7s 跟上（实装用 `transform: scaleX` 做，不对 `width` 做动画）。其余地方的气血仍用「墨条」：7px / 5px 圆头条，尾端 14px 羽化。

### Navigation（人物卷侧栏）
- 宽 248px，深夜底。自上而下：品牌名 → 境界名（30px 宋体）+ 第几世 · 岁数 · 江湖历 → 身体状况一行 → 内力（带速率）/ 银两 / 声望 → 毛笔墨线 → 页签 → 底部「转世」与设置齿轮。
- 页签：18px 宋体、字距 0.35em；当前项暖金字 + 淡金底；未解锁的页签不显示，新开的带金点。
- 设置齿轮弹出设置面板（卡片底色、画面主题）。
- 手机宽度（≤860px）：侧栏收起，顶部一条资源条，底部固定页签栏。

### Tags（装备品阶与路数）
- **品阶章**（`.gtag`）：11px，同色淡底、同色字，五阶各一色；跟在装备名后面。
- **路数章**（`.jh-tag.tag` / 书页 `.ptag.rt`）：与品质章同形的实底章——同色淡底（约 14%）+ 1px 同色细描边 + 同色字；跟在品质章后面。不用侧条；和品质章靠色相分开（issue #80 起由描边章改为实底）。

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

### 武功页（内功 + 武学合一，issue #80）
- 侧栏一个「武功」页签。页头下「装配」一行：主修印匣、一道竖细线、武学印匣（槽数 = 境界 + 4，空槽虚线方框）。
- **印匣**（`.ya`）：64px 方匣，描边与底晕按品质（寻常灰、上乘冷青、绝学暖金加外晕），匣中一枚 AI 石印（武学按类目 `public/art/cat/`、内功九部各一枚按心法名取象 `public/art/neigong/`），石印按路数换色；下写名字（品质色）与一行小字（武学触发几率、内功「第 N 重」暖金）。
- 下方左 296px「藏书」栏：标题旁「内功 / 武学」切换；3 × 3 搁板一页九本（武学可翻页、筛选为类目石印小图标，内功按路数筛选）。书只在一处：已装的武学不在藏书里陈列。
- 右侧一本**翻开的磁青书**（AI 仿真磁青纸 `public/art/wuxue-open-ciqing.jpg`，书名、式名、要诀名泥金，数值象牙白），高度与藏书栏等高、约 4:3。左页：竖写书名、品质 / 路数章、类目或心法信息、参数行、底部一行缘由 + 按钮（装配 / 卸下、精进一重、转修 / 散功重修）。右页：武学每一式一行（七式时页内滚动、底部淡出），内功心法要诀每条一行，右侧挂会改它的关名（已过墨金、下一关暖金、更后淡出、品质够不着更淡），改了什么只放悬停。
- 内功书页左页列内功提供的基础属性（气血 / 攻击 / 防御 / 命中 / 闪避）；精进后数字从旧值逐格跳到新值约 0.9 秒。非主修那本按转修后的样子显示（同路减 3 重、跨路 0 重）。
- **换书翻页**：先合上露出封面（同藏书书封，题签写书名）0.3 秒，再以中缝为轴翻开约 1 秒，左页内容等封面落定再淡入；首次进页、减少动态效果、手机宽度不翻。
- 手机宽度：藏书与书上下叠，书的两页也上下叠。

### 前尘页（底蕴 / 机缘 / 侠名录）
- 页顶一条分段切换（`seg-switch`，同市集摊位条），一次只摊开一区；三区各一张夜色水墨底图，随页签淡入切换。
- 底蕴：一张修行感悟宽卡 + 八张属性小卡 4 × 2（`stat-tile`）：宋体名 + 属性字、级数大字、「现 +x · 下一级 +y」两行、价格按钮；没有「尽数」。
- 机缘：一次性购买项行列表（`.row-i`），名 + 类型章 + 一句短效果，价格写在按钮上，已购写「已得」。
- 侠名录：成就徽记 6 × 4 网格（`achv-tile`）：徽记 + 当前层名，卡面不放进度、不写品字；悬停两行「当前效果」「下一级：名 · 计量 n/门槛」。

### 江湖舆图与地域分图（战斗页第一、二层）
- 第一层：整张 AI 水墨舆图 16:9，四周椭圆羽化融进夜底，不加框。十卷标在地理位置上：圆点 + 卷名（宋体 17px）+ 「卷N · 卷题」小字；走过的卷墨金点、这一世所在的卷暖金点外发光、未开的墨浅，悬停说明怎么开。**不画连卷的驿路线**（卷序与地理不顺，连线会交叉）。
- 点当前卷：整张图以该卷为中心放大 3 倍（0.9s ease-quart），卷名隐去；动画走完后淡入一张**地域分图**（同一块地图图生图、据点直接画在地里），盖住拉糊的舆图。左上「← 江湖舆图」返回。
- 据点是分图上的一块热区（约 13% × 21%），下挂名字（宋体 15px）与一行「正 / 邪印 · 势力 · 进度」：未开的被云雾遮住、墨浅名；在打的有一圈轻轻呼吸的烛光（`mix-blend-mode: screen`）、暖金名，下挂「已过 / 总关数」；已通关的墨金名，只写势力不写进度，不落印；没开打的写「N 关」。悬停未开的据点说「先通关某某」。名字下垫一团墨晕，浅色地图上也认得清。舆图与分图取月夜灰蓝、多留白、少树木田埂的画法（2026-10-26 用户定），不用浓黑满铺。

### 据点战斗页（场景关卡）
- 上半是该据点的整幅场景图（16:9，底部渐隐），一条路由近及远穿过画面；标题、归属（正 / 邪印 · 势力 · 外围 / 门户）与「已过 N / 20 关」叠在左上的暗处。玩家可见文案不用「资源点」，写「外围」。
- 关卡点落在路上，**以底座圆心为锚**：已过的关是墨金对勾（`stage-check`）+ 关名；当前关是护院剪影（约场景高 8%）立在烛光底座上、暖金关名；之后四关是较小剪影（约 6%）立在暗底座上；更远的关只留路上小点，收成一组「第十一至十九关」。守关的副手 / 镇守 / 门主是圆形头像（`guardian-medallion`，门主朱砂描边更大）挂竖印「副 / 守 / 主」，悬停见第几任与前世留痕。各关之间点线相连，已过一段墨金。远处节点按纵深略缩（0.62 + 0.38 × y）。
- 战报开头一行进章因由（势力名墨金 + 一句书面语），可能再有一行江湖传闻（墨浅）。
- 关卡点沿路按画面上的弧长等分取点，各关间距相同（模板点本身前疏后密，不直接用）。
- 场景图按**路形模板**图生图：A 照顾家绸庄（路由左下进、过右侧拱桥、登台阶到右上门楼），B 为 A 左右翻转，C 为盘山路（由下中蜿蜒到上中偏右）。关卡点坐标复用模板，按图里关数沿路等弧长取点。路形 B 的路收在左上，标题与进度改放右上。
- 守关人像按起名的套路分套（草莽、正派、邪派、僧、尼、道、世家、官军、女子门派、刺客），每套一两张头像、一张长卷像，同套里按人名取一张；女子没有长卷像时用头像去色代替。
- 没出图的退路：卷没有分图时，留放大的舆图，据点按「赶路图在左、各家外围在上、门户在下」自动摆放；据点没有场景图时，关卡线退回一条墨线小路（走过实线、未走虚线，守关人用竖印）。
- 手机宽度：场景里的关卡点缩小、只留当前一关的关名，远处的分组标签不显示；对阵区不放人像，绰号单起一行。

### 长卷对阵区
- 场景下方一条通栏水墨底带（`public/art/scene/duel-band.jpg`），顶边按 The Torn Edge Rule 与场景分开。两端各约 22% 是水墨人物长卷像（灰白墨晕作背光），向中间以线性遮罩化开；守关人用其水墨长卷像（缺图时以头像去色压暗代替）。
- 中段：双方姓名（宋体 28px，不折行）+ 一行出身 + 刷痕气血 / 真气条；正中「VS」与姓名同体同色（宋体 28px）。
- 挑战按钮落在带内：金底卷云龙纹牌（`public/art/scene/duel-btn2.png`），墨黑宋体 22px、字距 0.4em；交手中写「交手中」并压暗。
- 节奏与数值以线上引擎为准（每回合 2.7 秒）；受击人像一震（0.32s 平移 + 提亮）。

### 江湖编年右栏
- 宽 320px，深夜底，与人物卷侧栏对称；页签「江湖 / 往世」，选中墨金下划线。
- 「江湖」用**头条简讯**：最近一桩大事作头条（朱砂「江湖大事」+ 年份 + 宋体 19px 正文），其下一排类别筛选（`chronicle-chip-active`），再下一行一事：类别名着类别色 + 正文 + 墨浅年份。新事从顶部淡入。
- 「往世」：一世一行（第几世 · 名号姓名 · 生卒与死因），点开用**年表**：左列中文年份（「二百一十九年」）、一道细轴、每事一个类别色圆点 + 季节 + 正文。
- 修炼、战斗页常驻，右上「›」可收起（记在本机）；其余页收成 52px 窄边，竖写「江湖编年」，有新事挂计数（来的是大事则朱砂），点开从右侧浮出（0.35s），点外面收起。窄桌面（≤1280px）收进舞台下方。

### Signature Components
- **陈列**：武学与内功都用 AI 线装书册封面（书名写在题签上；题签按三张封面原图上画好的米色签逐张量位）。内功按品质用蓝 / 青 / 金三张封面；武学同三张封面按品阶换色（寻常麻布灰褐、上乘绛紫、绝学朱红描金，题签固定米黄），右下压一枚朱砂类目印（剑 / 刀 / 枪 / 棍 / 拳 / 掌 / 指 / 腿 / 镖），未拼齐的在本品阶色上压暗。武功页藏书栏里类目筛选用类目石印小图标、只列有书的类目。
- **战报**：每回合一个【第 N 回合】抬头，下面成段叙述；「你」墨金、敌名朱红、招式名冷青、伤害数字加粗。句式来自 `docs/rules/copy/battle-narration.md`。据点战报开头可有「进章因由」「江湖传闻」两行，左侧宋体题头。
- **整屏演出**：突破（金）、出关（冷蓝）、战败（暗红）、转世（暮金）、传功（冷青）、暗门（灯笼暖光压紫黑）、转世醒来（冷青，题眼「江湖历 N 年 · 第几世」→ 新名 → 籍贯年岁 → 三四段「此后江湖」书面语，前世名号墨金）七种径向渐变底，内容居中无框：小字题眼 → 大标题 → 一行说明 / 话本段落 → 得失对照或三选一 → 按钮。
- **挂机态**：战斗页顶部一条淡金描边状态栏（呼吸金点 + 「挂机中」+ 关数 / 场次 / 拾得 + 收手），挑战按钮仍在其下。
- **增减益标记**：双方气血 / 真气条下一行 30px 石印（`public/art/fx/`），己方靠左、敌方靠右；增益墨金印、减益朱砂印、毒墨绿印。**战斗中一切状态都走这一行，不另起条或文字行**：有时限的印下挂三点，亮几枚余几回合，最后一回合印面明暗呼吸；叠层的（叠浪、毒，以后的剑气 / 印记同此）右下角标层数，角标随归属着色，叠满待爆发时印面发亮、爆发后隐去；一次性的（封穴）不挂点也不标数，挂到生效那回合。数值只在悬停给两行（「叠浪　2 / 3 重」/「叠满：排山倒海 550%」）。新机制要新图标时，按同一石印模板生成（器物组：单一粗笔剪影、无纹理细节）。原型 `docs/design/battle-status-prototype.html`。
- **战报掉落行**：胜利后「拾得：」+ 装备名按品阶着色、武学全本 / 残页用冷青。
- **战况**：与战报同处切换的页签（宋体节标题当页签，选中墨金下划线；打完「战况」亮一枚金点，看过即灭；右端写「胜 / 败 · N 回合」，交手中写「第 N 回合」）。内容是一本账、不装盒子，全用正文字体：「交手」一块（出手 / 出招率 / 命中 / 会心 / 闪避；输出、承伤及其为 0 不画的细项），「武学」一块（每门一行：名 · 招数 · 细墨线 · 占输出几成，武学冷青、毒发毒翠、排山倒海余烬、反震墨金、普攻灰；条长按本场最大一项满格；未出招的不列，超过 6 门收进「余 n 门」）。数字靠右、点线引到标签。原型 `docs/design/battle-stats-prototype.html`。
- **自动连战勾选**：挑战按钮下一枚 13px 小方框 +「自动连战」，默认不勾；勾上框内墨金对勾、字提亮一档。

## 6. Do's and Don'ts

### Do:
- **Do** 让每页的 AI 底图固定铺在舞台背后同一位置，上浓下淡（遮罩 100% → 35% → 0）。
- **Do** 空状态收起：无伤只在侧栏写一行「身无伤病」，有伤才出现伤势卡，且排在最下，不挤动其它卡片。
- **Do** 把公式与推导放进悬停（带点状下划线的数值可悬停）。
- **Do** 一次只摊开眼前需要的：据点场景只画眼前五关的人影，更远的收成一组。
- **Do** 用游戏手法表达状态：未开被云雾遮住、在打的有烛光、已破落印、已过打钩，不用菱形圆点加图例。
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
- **Don't** 让武学书封照搬内功的三色；也不要让路数章与品质章同色相。
- **Don't** 把关卡画成一排数字按钮或网页分页器、步骤条；关卡长在场景的路上。
- **Don't** 在地图上贴地标小图，或在场景与对阵区之间画亮金分隔线。
- **Don't** 把设计文档术语给玩家看：「资源点」写「外围」，「岗位」「推演」不出现。
