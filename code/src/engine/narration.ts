/**
 * 叙事战报 —— 冻结文案：docs/rules/copy/battle-narration.md（句式库全文在那里，本文件与之逐字一致，测试校验）。
 *
 * 把战斗引擎的每条 TurnEvent 翻成一段话本式的句子。只做展示，不碰结算。
 * - 句子按「敌人类型」（野兽 / 山贼草莽 / 江湖高手）和「武学每一式」配置；
 * - 同一类句子有 2–3 个变体，按回合号确定性挑选（不用随机数），同一场战斗重放文字一致；
 * - 输出是「片段」数组，渲染层按片段类型上色（你=墨金、敌名=朱红、招式名=冷青、数字加粗 / 暴击余烬色），
 *   不拼 HTML 字符串。
 */
import type { RouteId } from './content';
import type { EnemyDef } from './enemies';
import type { TurnEvent } from './combat';
import { assertNever } from './exhaustive';
import { formTitle } from './formNames';
import { CATALOG_LINES, WUXUE, type FormEffect, type WuxueId } from './wuxue';

// ---------------------------------------------------------------- 类型

/** 片段类型：txt 普通字、me 你、foe 敌名、sk 招式 / 功法名、dm 伤害数字、cr 暴击数字 */
export type SegKind = 'txt' | 'me' | 'foe' | 'sk' | 'dm' | 'cr';
export interface Seg { k: SegKind; v: string }

/** 敌人类型（§1）：野兽、山贼草莽、江湖高手 / 头目 */
export type FoeKind = 'beast' | 'bandit' | 'master';

export interface NarrCtx {
  enemy: Pick<EnemyDef, 'name' | 'kind' | 'tags'>;
  /** 所修内功的路数；未修内功为 null */
  route: RouteId | null;
  /** 手里拿的：兵器槽的类别；兵器槽空而暗器槽有物为「暗器」；都没有为 none（普攻写成拳脚） */
  hand: Hand;
  /** 所修内功名（排山倒海句里用）；未修为 null */
  neigongName: string | null;
  /** 积势需求（归海路数）；99 = 不积势 */
  sqNeed: number;
  /** 毒层上限（唐门）；0 = 不叠毒 */
  poisonCap: number;
  /** 本场战斗的随机种子（开战时掷定）：决定变体顺序，同一场重放文字不变；缺省为 0 */
  seed?: number;
}

// ---------------------------------------------------------------- 敌人类型推断（§1）

const BEAST_RE = /犬|狼|虎|豹|熊|蛇|猪|猿|鹰|狐|蛟|兽/;
const MASTER_RE = /剑客|刀客|武者|镖师|僧|道人|游侠|都督|寨主|头目|头子/;

/** 有绰号（「」）或精英 / Boss 一律算高手；名字带兽类字算野兽；带门派 / 行当字算高手；其余是草莽 */
export function foeKind(enemy: Pick<EnemyDef, 'name' | 'kind'>): FoeKind {
  const n = enemy.name;
  if (n.startsWith('「') || enemy.kind !== 'normal') return 'master';
  if (BEAST_RE.test(n)) return 'beast';
  if (MASTER_RE.test(n)) return 'master';
  return 'bandit';
}

// ---------------------------------------------------------------- 句式库（§3–§5，与冻结文档逐字一致）
// 占位：{我} 你 · {敌} 敌名 · {招} 招式名 · {功} 内功名 · {伤} 伤害 · {层} 层数 · {上限} 上限 · {盾} 护盾吸收 · {爆} 引爆毒伤

type Lines = readonly string[];
type ByFoe = Record<FoeKind, Lines>;
/** 普攻句子按手里的家伙分：赤手（none / 少林拳掌）、剑、刀、枪、棍、暗器 */
export type Hand = 'none' | '剑' | '刀' | '枪' | '棍' | '暗器';
type PlainKey = Hand | 'shaolin';

/** §3.1 你的普攻 · 命中（按手中兵器） */
export const PLAIN_HIT: Record<PlainKey, Lines> = {
  none: [
    '{我}抢上一步，一拳捣在{敌}胸口，造成{伤}点伤害。',
    '{我}侧身让过来势，顺手一掌拍在{敌}肩头，造成{伤}点伤害。',
    '{我}虚晃一招，趁{敌}回防不及，一脚踢中其腰间，造成{伤}点伤害。',
  ],
  剑: [
    '{我}踏步抢攻，剑尖直点{敌}胸前，逼得对方连退两步，造成{伤}点伤害。',
    '{我}身形一晃，反手一剑削向{敌}肩头，带起一蓬血花，造成{伤}点伤害。',
    '{我}虚晃一招，趁{敌}回防不及，一剑扫中其腰间，造成{伤}点伤害。',
  ],
  shaolin: [
    '{我}稳扎马步，一拳直捣{敌}中门，造成{伤}点伤害。',
    '{我}硬接来势，反手一掌推在{敌}肩头，推得对方一个趔趄，造成{伤}点伤害。',
    '{我}步步进逼，肘膝连撞{敌}胸腹，造成{伤}点伤害。',
  ],
  刀: [
    '{我}刀光一闪，顺势劈向{敌}肩头，造成{伤}点伤害。',
    '{我}拧腰横刀，一刀扫中{敌}腰间，造成{伤}点伤害。',
    '{我}虚晃一招，趁{敌}回防不及，刀背重重砸在其背上，造成{伤}点伤害。',
  ],
  枪: [
    '{我}长枪一抖，枪尖直点{敌}胸前，造成{伤}点伤害。',
    '{我}拨开来势，顺手一枪扎中{敌}肩头，造成{伤}点伤害。',
    '{我}枪杆横扫，抽在{敌}腰间，打得对方踉跄半步，造成{伤}点伤害。',
  ],
  棍: [
    '{我}抡棍横扫，一棍抽在{敌}肋下，造成{伤}点伤害。',
    '{我}棍头一点，正戳在{敌}胸口，逼得对方连退两步，造成{伤}点伤害。',
    '{我}虚晃一招，趁{敌}回防不及，一棍扫中其小腿，造成{伤}点伤害。',
  ],
  暗器: [
    '{我}袖底一扬，两枚透骨钉直奔{敌}而去，造成{伤}点伤害。',
    '{我}脚下游走，顺手甩出一把铁蒺藜，打在{敌}身上，造成{伤}点伤害。',
    '{我}指间寒光一闪，一枚毒针钉进{敌}臂上，造成{伤}点伤害。',
  ],
};

/** §3.2 你的普攻 · 暴击（按手中兵器） */
export const PLAIN_CRIT: Record<PlainKey, Lines> = {
  none: [
    '{我}看准{敌}一个破绽，一拳正中要害，足足造成{伤}点伤害！',
    '{我}这一掌又快又狠，结结实实印在{敌}心口，造成{伤}点伤害！',
  ],
  剑: [
    '{我}看准{敌}一个破绽，剑走偏锋直取要害，这一剑又快又狠，足足造成{伤}点伤害！',
    '剑光一闪，{我}这一刺正中{敌}空门，力透重围，造成{伤}点伤害！',
  ],
  shaolin: [
    '{我}沉腰发力，一拳打得{敌}弯下腰去，足足造成{伤}点伤害！',
    '{我}看准空门，一掌拍在{敌}要害，掌力透体而入，造成{伤}点伤害！',
  ],
  刀: [
    '{我}看准{敌}一个破绽，一刀劈下势大力沉，足足造成{伤}点伤害！',
    '刀风呼啸，{我}这一刀正劈在{敌}要害，造成{伤}点伤害！',
  ],
  枪: [
    '{我}看准{敌}一个破绽，一枪如毒龙出洞直取要害，足足造成{伤}点伤害！',
    '枪影一闪，{我}这一刺正中{敌}空门，透背而出，造成{伤}点伤害！',
  ],
  棍: [
    '{我}看准{敌}一个破绽，一棍当头砸落，足足造成{伤}点伤害！',
    '棍风呼啸，{我}这一棍结结实实砸在{敌}肩上，造成{伤}点伤害！',
  ],
  暗器: [
    '{我}一镖正中{敌}要穴，入肉极深，足足造成{伤}点伤害！',
    '{我}趁{敌}换气，一把钢针尽数没入其胸前，造成{伤}点伤害！',
  ],
};

/** §3.3 你的攻击被闪开（按敌人类型） */
export const PLAYER_MISS: ByFoe = {
  beast: [
    '{我}一招递出，{敌}却猛地蹿开，只扑到一片尘土。',
    '{敌}矮身一伏，{我}这一击擦着它的背脊落空。',
  ],
  bandit: [
    '{我}出手稍急，被{敌}连滚带爬地躲了过去。',
    '{敌}往旁边一闪，{我}这一招落了空。',
  ],
  master: [
    '{敌}脚下一错，轻描淡写地让过了{我}这一击。',
    '{我}一招刚到，{敌}已飘身退开半丈，落了个空。',
    '{敌}侧身一让，{我}的攻势尽数走空。',
  ],
};

/** §3.4 敌方出手命中（按敌人类型） */
export const FOE_HIT: ByFoe = {
  beast: [
    '{敌}低吼一声扑上前来，利爪划过{我}的臂膀，撕去{伤}点气血。',
    '{敌}绕着{我}游走半圈，冷不防一口咬来，{我}躲闪稍慢，受到{伤}点伤害。',
    '{敌}借势猛冲，撞得{我}气血翻涌，受到{伤}点伤害。',
  ],
  bandit: [
    '{敌}骂骂咧咧地抡刀砍来，{我}躲闪不及，受到{伤}点伤害。',
    '{敌}趁{我}换招，一棍扫中{我}的小腿，受到{伤}点伤害。',
    '{敌}扑上来一阵乱打，{我}挨了几下，受到{伤}点伤害。',
  ],
  master: [
    '{敌}欺身而上，一掌拍向{我}胸口，{我}硬接下来，受到{伤}点伤害。',
    '{敌}招式一变，从{我}意想不到的方向攻来，{我}受到{伤}点伤害。',
    '{敌}出手沉稳，一招一式都压着{我}打，{我}受到{伤}点伤害。',
  ],
};

/** §3.5 敌方出手被闪开（按敌人类型） */
export const FOE_MISS: ByFoe = {
  beast: [
    '{敌}猛地扑来，{我}侧身一让，它扑了个空。',
    '{敌}张口便咬，{我}早有防备，退步避开。',
  ],
  bandit: [
    '{敌}一刀砍下，{我}轻轻一闪，刀锋劈在空处。',
    '{敌}偷袭不成，被{我}躲了过去。',
  ],
  master: [
    '{敌}一招攻来，{我}看破来势，间不容发地避开。',
    '{敌}出手如电，{我}堪堪躲过，衣角被劲风带起。',
  ],
};

/** §3.6 敌方狂暴（按敌人类型） */
export const FOE_ENRAGE: ByFoe = {
  beast: [
    '{敌}被打出了凶性，双眼通红，攻势一回合比一回合凶猛！',
    '{敌}仰天长嚎，浑身毛发倒竖，扑咬越来越狠！',
  ],
  bandit: [
    '{敌}红了眼，嗷嗷叫着扑上来，出手越来越狠！',
    '{敌}被逼急了，豁出命来乱砍，攻势一回合重过一回合！',
  ],
  master: [
    '{敌}长啸一声，招式陡然变得狠辣，攻势逐回合加重！',
    '{敌}眼中杀意大盛，再不留手，出招一回合快过一回合！',
  ],
};

/** §3.7 胜（按敌人类型） */
export const VICTORY: ByFoe = {
  beast: [
    '{敌}哀嚎一声，夹着尾巴逃进了林子深处。',
    '{敌}挣扎几下，终于趴在地上不动了。',
    '{敌}低吼着退了几步，转身落荒而逃。',
  ],
  bandit: [
    '{敌}扔下兵刃，连滚带爬地逃走了。',
    '{敌}扑通跪倒，连声求饶，{我}懒得与他计较。',
    '{敌}被打翻在地，半天爬不起来。',
  ],
  master: [
    '{敌}踉跄后退，拱手道了声“佩服”，转身没入夜色。',
    '{敌}长叹一声，垂下兵刃认输。',
    '{敌}单膝跪地，再也提不起一丝力气。',
  ],
};

/** §3.8 败（按敌人类型） */
export const DEFEAT: ByFoe = {
  beast: [
    '{我}终于支撑不住，被{敌}扑倒在地，只得狼狈退走。',
    '{我}气血耗尽，眼前一黑，{敌}的吼声还在耳边。',
  ],
  bandit: [
    '{我}一个踉跄，被{敌}一脚踹翻，只得忍痛退走。',
    '{我}力气耗尽，{敌}得意地啐了一口。',
  ],
  master: [
    '{我}内息一乱，被{敌}一招击退，胸口气血翻涌。',
    '{敌}收招而立，淡淡道：“再练几年吧。”{我}只得抱拳退下。',
  ],
};

/** §4 路数机制与状态 */
export const MECH = {
  /** 归海势满，排山倒海 */
  burst: [
    '势已积满，{我}借{功}之力一击倾出，{敌}如遭山崩海啸，受到{伤}点伤害！',
    '{我}胸中积势再也按捺不住，{功}一催，这一击排山倒海般压向{敌}，造成{伤}点伤害！',
    '百川汇流，一朝归海，{我}借{功}之力连下数击，{敌}受到{伤}点伤害！',
  ],
  /** 唐门普攻命中后追加：毒层数 */
  poisonAdd: ['毒入一层，已积 {层} / {上限} 层。'],
  /** 唐门开战施毒 */
  poisonApply: [
    '开战之际，{我}袖中暗器先发，{敌}身上已中{层}层毒。',
    '两人还未交手，{我}已悄悄弹出毒针，{敌}先中了{层}层毒。',
  ],
  /** 毒发（回合末） */
  poisonTick: [
    '毒性发作，{敌}面色发青，{层}层毒蚀去{伤}点气血。',
    '{敌}身上的毒一阵阵往里钻，{层}层毒共造成{伤}点伤害。',
    '{敌}动作渐渐迟滞，{层}层毒又蚀去{伤}点气血。',
  ],
  /** 毒层满溢，毒爆 */
  poisonBurst: [
    '毒层积满，在{敌}体内轰然炸开，造成{伤}点伤害！',
    '{敌}经脉里的毒一齐发作，毒爆之下受到{伤}点伤害！',
  ],
  /** 敌方反伤：你打人，被反震 */
  thornsToPlayer: [
    '{敌}一身硬功，{我}这一击被反震回来，震得虎口发麻，受到{伤}点反伤。',
    '{我}打在{敌}身上如击铁石，劲力倒卷而回，受到{伤}点反伤。',
  ],
  /** 少林金钟反震：人打你，被反震 */
  thornsToEnemy: [
    '{我}金钟罩劲力一吐，{敌}被反震得气血翻涌，受到{伤}点伤害。',
    '{敌}这一击打在{我}身上，反被震退半步，受到{伤}点反伤。',
    '{我}护体罡气一震，把{敌}的力道原样奉还，造成{伤}点伤害。',
  ],
  /** 你身上的毒发作（毒敌施加，绕过护盾） */
  foePoisonTick: [
    '{敌}留下的毒在{我}经脉里游走，蚀去{伤}点气血，护体真气也挡不住。',
    '{我}只觉伤口发麻，毒入肌理，又损了{伤}点气血。',
  ],
  /** 敌方净化毒层 */
  purify: [
    '{敌}运功逼毒，身上的毒尽数化去。',
    '{敌}盘膝一坐，吐纳之间把体内的毒逼了出来。',
  ],
  /** 敌方出手追加：带破甲 */
  armorBreak: ['这一击破开了{我}的护身劲力。'],
  /** 敌方出手追加：护盾吸收了一部分 */
  absorb: ['护体真气替{我}挡下了{盾}点。'],
  /** 敌方出手被护盾全数吸收（替换整句） */
  absorbAll: ['{敌}这一击打在{我}的护体真气上，被尽数化去（{盾}点）。'],
} as const satisfies Record<string, Lines>;

/** §5.2 武学出招的通用追加句 */
export const CAST_EXTRA = {
  /** 出招被闪开（替换整句） */
  miss: [
    '{我}使出一招{招}，却被{敌}堪堪避开，招式落空。',
    '{招}使到一半，{敌}已抽身退开，{我}这一招扑了个空。',
  ],
  /** 出招暴击 */
  crit: [
    '这一招正中要害，力道倍增！',
    '恰逢破绽，这一下伤得极重！',
  ],
} as const satisfies Record<string, Lines>;

/** §5.3 招式特效追加句（只在带特效的式后面追加；必暴已由暴击句体现） */
export const EFFECT_LINES: Record<Exclude<FormEffect, '必暴'>, string> = {
  护体: '护体真气随招而生，又厚一层。',
  回气: '招随气转，这一式的真气回了大半。',
  附毒: '锋上淬毒，{敌}身上的毒又添了。',
  运劲: '一股劲力贯入四肢，接下来几招更见沉猛。',
  连击: '招势未尽，{我}顺手又补了一记。',
  凝眸: '心神一凝，{敌}身上的破绽看得更清楚了。',
  轻身: '身法随招变轻，接下来更难被打中。',
  回元: '招意圆转，一部分真气回到了丹田。',
  透劲: '劲力透体而入，{敌}的护身功夫挡不住。',
  封穴: '这一下封住了穴道，{敌}一时动弹不得。',
  卸力: '{敌}手臂一麻，之后出手的力道弱了几分。',
  迷目: '{敌}眼前一花，之后出手便没那么准了。',
  破绽: '{敌}门户已乱，之后更容易被打伤。',
  蓄势: '剑势层层相叠，后招更重。',
  反震: '杵借身沉，连一身筋骨之力也压了上去。',
  引爆: '机括一响，{敌}体内积毒尽数炸开，其中{爆}点是毒伤。',
};

/** §5.4 连击补的那一记与封穴 */
export const FOLLOWUP: Record<'hit' | 'miss', Lines> = {
  hit: ['{我}招势未尽，顺手又补了一记，又添{伤}点伤害。'],
  miss: ['{我}招势未尽，顺手又补了一记，却被{敌}侧身让过。'],
};
export const SEALED: Lines = ['{敌}穴道被封，这一回合动弹不得。'];

/** §5.1 每门武学每一式的专属句子（顺序与 FORM_NAMES 一致）：现有 14 门在此，第一批新增 52 门随名录表并入 */
export const FORM_LINES: Record<WuxueId, Lines> = { ...FORM_LINES_BASE(), ...CATALOG_LINES };
function FORM_LINES_BASE(): Record<WuxueId, Lines> { return {
  // 流云剑 · 剑法 · 飘逸
  liuyunjian: [
    '{我}剑势舒展，如白云出岫，正是这招{招}，看似漫不经心，剑尖已递到{敌}眼前，造成{伤}点伤害。',
    '{我}回身一剑，轻柔如风拂柳枝，一招{招}自{敌}身侧划过，造成{伤}点伤害。',
    '{我}长剑横掠，一式{招}如秋江上骤起的云影，一剑斩断来势，{敌}受了{伤}点伤害。',
  ],
  // 开山掌 · 拳掌 · 刚猛
  kaishanzhang: [
    '{我}沉肩坠肘，双掌平平推出，一招{招}势如推山，{敌}胸口一闷，受了{伤}点伤害。',
    '{我}单掌劈落，一式{招}带着裂石之声砸在{敌}肩头，造成{伤}点伤害。',
    '{我}吐气开声，一招{招}双掌齐出，掌风呼啸如山崩，{敌}被震得连退数步，受了{伤}点伤害。',
  ],
  // 袖里针 · 暗器 · 阴诡
  xiulizhen: [
    '{我}衣袖轻拂，一招{招}，几点寒芒无声无息没入{敌}身上，造成{伤}点伤害。',
    '{我}身形一晃，影子还在原地，一招{招}的细针已从侧面钉进{敌}臂弯，造成{伤}点伤害。',
    '{我}扬袖一洒，一招{招}，银针如梅瓣簌簌飘落，{敌}躲得开一枚躲不开十枚，受了{伤}点伤害。',
  ],
  // 行者棍 · 棍法 · 沉雄
  xingzhegun: [
    '{我}棍梢贴地一挑，一招{招}，专打{敌}下盘，造成{伤}点伤害。',
    '{我}将长棍往肩上一担，一式{招}横扫而出，棍身结结实实抽在{敌}腰间，造成{伤}点伤害。',
    '{我}棍头一点，一招{招}看似随手问路，却正戳在{敌}的要穴上，造成{伤}点伤害。',
  ],
  // 惊鸿剑 · 剑法 · 轻灵迅疾
  jinghongjian: [
    '剑光只一闪，{我}这招{招}快得看不清出处，{敌}身上已多了一道血口，造成{伤}点伤害。',
    '{我}足下轻点，身随剑走，一招{招}绕着{敌}游了半圈，剑尖连点三处，造成{伤}点伤害。',
    '{我}纵身而起，一式{招}自高处斜掠而下，{敌}抬头时剑锋已至，受了{伤}点伤害。',
    '{我}与{敌}错身而过，一招{招}只留下一道剑影，{敌}回过神来才觉疼，受了{伤}点伤害。',
    '{我}剑尖一抖，一招{招}化出满眼剑影，真假难辨，{敌}挡了个空，受了{伤}点伤害。',
  ],
  // 伏虎拳 · 拳掌 · 猛烈
  fuhuquan: [
    '{我}低喝一声，一招{招}合身扑上，拳风如虎啸，砸得{敌}身形一晃，造成{伤}点伤害。',
    '{我}矮身抢进，一式{招}直捣{敌}心口，这一拳又沉又狠，造成{伤}点伤害。',
    '{我}佯作败退，猛地拧腰回身，一招{招}反砸{敌}面门，造成{伤}点伤害。',
    '{我}双拳连环击出，一式{招}拳拳到肉，{敌}招架不住，受了{伤}点伤害。',
    '{我}一拳压下，一招{招}势大力沉，硬生生将{敌}按得单膝跪地，造成{伤}点伤害。',
  ],
  // 飞蝗石 · 暗器 · 密集
  feihuangshi: [
    '{我}屈指一弹，一招{招}，石子破空而去，正打在{敌}腕上，造成{伤}点伤害。',
    '{我}连发两石，一招{招}，后石追着前石撞在{敌}身上，造成{伤}点伤害。',
    '{我}双手连扬，一式{招}，碎石如蝗群扑面，{敌}顾此失彼，受了{伤}点伤害。',
    '{我}抄起一把石子凌空洒下，一招{招}打得{敌}抱头遮挡，造成{伤}点伤害。',
    '{我}腾身半空，一招{招}，石子如星雨般从四面八方落下，{敌}无处可躲，受了{伤}点伤害。',
  ],
  // 断水刀 · 刀法 · 连绵
  duanshuidao: [
    '{我}拇指一推，刀已出鞘，这招{招}快如电闪，一刀划过{敌}胸前，造成{伤}点伤害。',
    '{我}横刀一斩，一式{招}刀势如截断江流，{敌}的攻势为之一滞，受了{伤}点伤害。',
    '{我}刀随身转，一招{招}绵绵不绝，一刀接一刀涌向{敌}，造成{伤}点伤害。',
    '{我}刀锋一收复又一吐，一式{招}如回卷的浪头，从{敌}意想不到之处砍到，造成{伤}点伤害。',
    '{我}长刀一挥，一招{招}挟大江东去之势滚滚压来，{敌}被逼得连连后退，受了{伤}点伤害。',
  ],
  // 苍崖剑诀 · 剑法 · 孤峭古拙
  cangyajianjue: [
    '{我}抱剑一礼，一招{招}起手平和，剑尖却稳稳点中{敌}肩井，造成{伤}点伤害。',
    '{我}凝神不动，待{敌}近身时才一剑递出，一式{招}后发先至，造成{伤}点伤害。',
    '{我}挺剑直刺，一招{招}剑光如白虹横空，穿透{敌}的守势，造成{伤}点伤害。',
    '{我}剑走龙形，一式{招}自下而上翻卷而起，{敌}被挑得门户大开，受了{伤}点伤害。',
    '{我}单足立定，一招{招}剑势孤峭，{敌}攻到身前反被一剑逼退，受了{伤}点伤害。',
    '{我}长剑一振，一式{招}剑风如万壑松涛齐鸣，层层压向{敌}，造成{伤}点伤害。',
    '{我}收尽剑势，只出一剑。这招{招}朴拙无华，却如崖石崩落，{敌}避无可避，受了{伤}点伤害。',
  ],
  // 落星剑 · 剑法 · 星象、越打越重
  luoxingjian: [
    '{我}剑尖低垂，一招{招}贴地扫出，剑光如星辉铺满{敌}脚下，造成{伤}点伤害。',
    '{我}踏七星步斜走，一式{招}剑锋斜挑{敌}肋下，造成{伤}点伤害。',
    '{我}身剑合一疾冲而出，一招{招}快得如流星划过，{敌}受了{伤}点伤害。',
    '{我}腾身倒转，一式{招}自上而下泻落，剑光如银河倾下，罩住{敌}全身，造成{伤}点伤害。',
    '{我}剑身一横，一招{招}映着冷光晃过{敌}双眼，趁其目眩一剑刺入，造成{伤}点伤害。',
    '{我}手腕连抖，一式{招}七点剑光连成一线，尽数落在{敌}身上，造成{伤}点伤害。',
    '{我}高举长剑，一招{招}如天星坠海，一剑之下{敌}被砸得踉跄倒退，受了{伤}点伤害。',
  ],
  // 罗汉伏魔棍 · 棍法 · 佛门沉雄
  luohanfumogun: [
    '{我}双手合棍，一招{招}看似行礼，棍头却已撞向{敌}胸口，造成{伤}点伤害。',
    '{我}长棍贴地横扫，一式{招}扫得尘土飞扬，{敌}腿上吃了一记，受了{伤}点伤害。',
    '{我}将棍一横，一招{招}拦腰截断{敌}的来路，顺势一推，造成{伤}点伤害。',
    '{我}棍尖直指{敌}心口，一式{招}稳如磐石，一戳之下造成{伤}点伤害。',
    '{我}抱棍一撞，一招{招}如晨钟轰鸣，{敌}被震得耳中嗡嗡作响，受了{伤}点伤害。',
    '{我}跃起抡棍，一式{招}当头砸落，{敌}举手硬接，双臂发麻，受了{伤}点伤害。',
    '{我}长棍舞成一片棍影，一招{招}四面八方都是棍头，{敌}挡不胜挡，受了{伤}点伤害。',
  ],
  // 降魔杵法 · 杵法 · 金刚威猛
  xiangmochufa: [
    '{我}双手擎杵过顶，一招{招}直直砸落，{敌}举手招架，被压得身子一矮，受了{伤}点伤害。',
    '{我}握杵连捣，一式{招}一下重过一下，捣在{敌}身上，造成{伤}点伤害。',
    '{我}抡杵斜劈，一招{招}挟开山之力，砸得{敌}护身劲力散了大半，造成{伤}点伤害。',
    '{我}怒目圆睁，一式{招}杵随身进，气势压得{敌}心神一乱，受了{伤}点伤害。',
    '{我}将杵往地上一顿，一招{招}震波直透{敌}脚底，造成{伤}点伤害。',
    '{我}横杵一推，一式{招}以身为锤、以杵为钉，把{敌}撞得倒飞出去，造成{伤}点伤害。',
    '{我}周身筋骨齐鸣，一招{招}举杵如擎烈日，轰然砸下，{敌}受了{伤}点伤害。',
  ],
  // 落英飞针 · 暗器 · 花雨阴柔
  luoyingfeizhen: [
    '{我}翻腕一撒，一招{招}，细针如落花纷纷扬扬，{敌}身上一麻，受了{伤}点伤害。',
    '{我}身形飘动，一式{招}，飞针顺着步子一路洒去，绕着{敌}钉了一圈，造成{伤}点伤害。',
    '{我}借风发针，一招{招}轻飘飘的看不出去向，落处正是{敌}颈侧，造成{伤}点伤害。',
    '{我}双袖齐挥，一式{招}，针雨扑面而来，{敌}只挡住了一半，受了{伤}点伤害。',
    '{我}十指连弹，一招{招}，漫天红芒点点落在{敌}周身穴道，造成{伤}点伤害。',
    '{我}拈起一枚针，一式{招}不紧不慢地钉进{敌}破绽，造成{伤}点伤害。',
    '{我}似乎什么也没做，一招{招}的飞针已悄然入肉，{敌}到这时才觉出疼，受了{伤}点伤害。',
  ],
  // 牵机镖 · 暗器 · 机巧诡变
  qianjibiao: [
    '{我}指间扣着一缕细丝，一招{招}，镖随丝走，拐着弯钉进{敌}后背，造成{伤}点伤害。',
    '{我}掷出一镖，看似偏了，一式{招}镖身却在半空一折，扎进{敌}腰眼，造成{伤}点伤害。',
    '{我}抖腕一拉，一招{招}，镖锋贴着{敌}咽喉掠过，带出一道血线，造成{伤}点伤害。',
    '{我}反手一掷，一式{招}飞镖绕了个大圈，从{敌}背后回旋而至，造成{伤}点伤害。',
    '{我}正面扬手佯攻，一招{招}的真镖却从脚下踢出，{敌}防了上面丢了下面，受了{伤}点伤害。',
    '{我}双手连发，一式{招}，每一镖的去路都不相同，{敌}左支右绌，受了{伤}点伤害。',
    '{我}最后一镖出手，一招{招}悄无声息，{敌}中镖之处迅速发黑，受了{伤}点伤害。',
  ],
}; }

// ---------------------------------------------------------------- 组句

interface Vars {
  foe: string;
  form?: string;
  gong?: string;
  dmg?: number;
  crit?: boolean;
  n?: number;
  cap?: number;
  shield?: number;
  det?: number;
}

const num = (v: number | undefined) => String(Math.round(v ?? 0));
const TOKEN_RE = /\{(我|敌|招|功|伤|层|上限|盾|爆)\}/g;

/** 把一条模板填成片段；未知占位原样保留（测试会拦下） */
export function fill(tpl: string, v: Vars): Seg[] {
  const out: Seg[] = [];
  let last = 0;
  for (const m of tpl.matchAll(TOKEN_RE)) {
    if (m.index > last) out.push({ k: 'txt', v: tpl.slice(last, m.index) });
    switch (m[1]) {
      case '我': out.push({ k: 'me', v: '你' }); break;
      case '敌': out.push({ k: 'foe', v: v.foe }); break;
      case '招': out.push({ k: 'sk', v: v.form ?? '' }); break;
      case '功': out.push({ k: 'sk', v: v.gong ?? '' }); break;
      case '伤': out.push({ k: v.crit ? 'cr' : 'dm', v: num(v.dmg) }); break;
      case '层': out.push({ k: 'dm', v: num(v.n) }); break;
      case '上限': out.push({ k: 'txt', v: num(v.cap) }); break;
      case '盾': out.push({ k: 'dm', v: num(v.shield) }); break;
      case '爆': out.push({ k: 'dm', v: num(v.det) }); break;
    }
    last = m.index + m[0].length;
  }
  if (last < tpl.length) out.push({ k: 'txt', v: tpl.slice(last) });
  return out;
}

/** (种子, 回合, salt) → [0, 1) 的固定散列 */
function hash01(seed: number, rd: number, salt: number): number {
  let h = Math.imul(seed ^ 0x9e3779b9, 0x85ebca6b) ^ Math.imul(rd + 1, 0xc2b2ae35) ^ Math.imul(salt + 1, 0x27d4eb2f);
  h = Math.imul(h ^ (h >>> 15), 0x2c1b3c6d);
  h = Math.imul(h ^ (h >>> 12), 0x297a2d39);
  return ((h ^ (h >>> 15)) >>> 0) / 4294967296;
}

/**
 * 按种子随机挑变体，相邻两回合不取同一条（battle-narration.md §0）。
 * 只由 (种子, 回合, salt) 决定，同一场战斗重放文字不变；salt 区分不同类句子。
 */
function pick(lines: Lines, rd: number, salt: number, seed: number): string {
  const n = lines.length;
  let prev = -1;
  let idx = 0;
  for (let r = 0; r <= Math.max(0, rd); r++) {
    idx = Math.floor(hash01(seed, r, salt) * n);
    if (idx === prev) idx = (idx + 1 + Math.floor(hash01(seed, r, salt + 7) * (n - 1))) % n;
    prev = idx;
  }
  return lines[idx];
}

/** 招式键 `武学 id:式序` → [武学, 式序]；认不出返回 null */
function parseForm(key: string | undefined): [WuxueId, number] | null {
  if (!key) return null;
  const [id, k] = key.split(':');
  return id in WUXUE ? [id as WuxueId, Number(k)] : null;
}

/**
 * 一条引擎事件 → 一段叙述（片段数组）。
 * 同一场战斗、同一事件永远得到同一段文字。
 */
export function narrateTurn(t: TurnEvent, ctx: NarrCtx): Seg[] {
  const fk = foeKind(ctx.enemy);
  const foe = ctx.enemy.name;
  const rd = t.rd;
  const route = ctx.route;
  // 普攻句子跟手里的家伙走：赤手时少林路数写拳掌、其余写拳脚
  const plain: PlainKey = ctx.hand === 'none' && route === 'shaolin' ? 'shaolin' : ctx.hand;
  const base: Vars = { foe, dmg: t.dmg, gong: ctx.neigongName ?? '归海' };
  const line = (lines: Lines, salt: number, v: Partial<Vars> = {}) => fill(pick(lines, rd, salt, ctx.seed ?? 0), { ...base, ...v });

  switch (t.kind) {
    case 'attack': {
      if (t.side === 'enemy') {
        if (t.absorb && !t.dmg) return line(MECH.absorbAll, 0, { shield: t.absorb });
        const segs = line(FOE_HIT[fk], 1);
        if ((ctx.enemy.tags as readonly string[]).includes('破甲')) segs.push(...line(MECH.armorBreak, 0));
        if (t.absorb) segs.push(...line(MECH.absorb, 0, { shield: t.absorb }));
        return segs;
      }
      const segs = line(PLAIN_HIT[plain], 0);
      if (ctx.poisonCap > 0 && route === 'tangmen') segs.push(...line(MECH.poisonAdd, 0, { n: t.ePoison, cap: ctx.poisonCap }));
      return segs;
    }
    case 'crit': {
      const segs = line(PLAIN_CRIT[plain], 0, { crit: true });
      if (ctx.poisonCap > 0 && route === 'tangmen') segs.push(...line(MECH.poisonAdd, 0, { n: t.ePoison, cap: ctx.poisonCap }));
      return segs;
    }
    case 'miss':
      return t.side === 'enemy' ? line(FOE_MISS[fk], 0) : line(PLAYER_MISS[fk], 0);
    case 'cast': {
      const f = parseForm(t.form);
      const formName = f ? formTitle(f[0], f[1]) : '';
      if (t.missed) return line(CAST_EXTRA.miss, 0, { form: formName });
      const tpl = f ? FORM_LINES[f[0]][f[1] - 1] : undefined;
      const segs = tpl ? fill(tpl, { ...base, form: formName, crit: t.crit }) : line(PLAIN_HIT[plain], 0, { crit: t.crit });
      if (t.crit) segs.push(...line(CAST_EXTRA.crit, 0));
      // 特效追加句：只在本招特效确实生效时追加（引擎标在 fx 上）；必暴由暴击句体现，连击另有补刀事件
      if (t.fx && t.fx !== '必暴' && t.fx !== '连击') segs.push(...fill(EFFECT_LINES[t.fx], { ...base, det: t.detonate }));
      return segs;
    }
    case 'burst':
      return line(MECH.burst, 1, { crit: true });
    case 'poison_apply':
      return line(MECH.poisonApply, 0, { n: t.ePoison });
    case 'poison_tick':
      return line(MECH.poisonTick, 0, { n: t.ePoison });
    case 'poison_burst':
      return line(MECH.poisonBurst, 0, { crit: true });
    case 'thorns_to_player':
      return line(MECH.thornsToPlayer, 0);
    case 'thorns_to_enemy':
      return line(MECH.thornsToEnemy, 1);
    case 'enemy_poison_tick':
      return line(MECH.foePoisonTick, 0);
    case 'purify':
      return line(MECH.purify, 0);
    case 'followup':
      return t.missed ? line(FOLLOWUP.miss, 0) : line(FOLLOWUP.hit, 0, { crit: t.crit });
    case 'sealed':
      return line(SEALED, 0);
    case 'enrage':
      return line(FOE_ENRAGE[fk], 0);
    case 'victory':
      return line(VICTORY[fk], 0);
    case 'defeat':
      return line(DEFEAT[fk], 0);
    default:
      return assertNever(t.kind, 'narrateTurn 未处理的事件');
  }
}

/** 全部句式模板（测试用：逐条核对冻结文档、占位合法、无禁用词） */
export function allTemplates(): string[] {
  const groups: Lines[] = [
    ...Object.values(PLAIN_HIT), ...Object.values(PLAIN_CRIT),
    ...Object.values(PLAYER_MISS), ...Object.values(FOE_HIT), ...Object.values(FOE_MISS),
    ...Object.values(FOE_ENRAGE), ...Object.values(VICTORY), ...Object.values(DEFEAT),
    ...Object.values(MECH), ...Object.values(CAST_EXTRA), Object.values(EFFECT_LINES),
    ...Object.values(FOLLOWUP), SEALED,
    ...Object.values(FORM_LINES),
  ];
  return groups.flat();
}
