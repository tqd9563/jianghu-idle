/**
 * 内功 —— 权威来源：docs/systems/sect-neigong/spec.md §1（名录 / 重数 / 台阶 / 真气 / 转修）与 §3（悟性与顿悟）、
 * docs/systems/sect-overhaul/design.md §3.2（二十一家的内功名与档位、兼修）、§2（同源流同品质数值相同）。
 * 武道源流（狂澜 / 镇岳 / 蚀骨，原称路数）沿用路线 id：huashan / shaolin / tangmen，路数参数仍在 routes.ts。
 * 寻常内功 = 原「招式十成 + 火候」构筑（spec §7 判据零），所以关卡与敌人不用重调。禁止在此调参。
 */
import { QI_SCALE, huohouRealms, type RouteId } from './content';
import { makeBuild, type Build } from './combat';
import type { SectId } from './sect';

export type Quality = '寻常' | '上乘' | '绝学';
export type NeigongId =
  // 原九部（苍崖派 / 千岩寺 / 瘴月教），id 不变
  | 'jingleijue' | 'zhenyuegong' | 'shiguxinfa'
  | 'leimingjianjing' | 'panshigong' | 'xuanyinjue'
  | 'yuntaixinfa' | 'putixingong' | 'qianguxinjue'
  // 二十一家新内功（sect-overhaul/design.md §3.2），按卷
  | 'feiquanjue'
  | 'chidangong' | 'nujiaojue'
  | 'zheshegong' | 'xuanyinhuagujue' | 'tengshezhendian'
  | 'wuzhuxinfa'
  | 'jinghuajue' | 'hanxianggong'
  | 'lingxugong' | 'fuyaojue'
  | 'tingchaojue' | 'shenqihuaxugong' | 'guixudafa'
  | 'yuezhigong' | 'budongmingwangjue' | 'jiudingzhenjing'
  | 'fenghuxinfa' | 'hupogong' | 'baihuxiaofengjing'
  | 'dishagong' | 'zhenmingxinjing'
  | 'shouyigong' | 'qingjingzuowangjue' | 'qianyuanyiqijing' | 'zifuxinfa'
  | 'chilangjue' | 'xueshagong'
  | 'zhishuixinfa' | 'shuiyueguanxinjing'
  | 'linglongxinfa' | 'tianshujue'
  | 'konghuanggong' | 'wanhuangguixujue'
  | 'xueguranyuangong'
  | 'qiwujue' | 'fengmingxinjing' | 'fengzhuqingminggong'
  | 'guilinjue' | 'jiuyouhuadujing'
  | 'yinleijue' | 'bentinggong' | 'leigangzhenjing'
  | 'shuanghuajue' | 'hanposuomaigong' | 'guijizhenjing'
  | 'xueshajue' | 'yanyanggong' | 'darixiuluoxuedian';

export interface NeigongDef {
  id: NeigongId;
  name: string;
  quality: Quality;
  route: RouteId;
  /** 所属门派（在其货架上换） */
  sect: SectId;
  /** 石印图键（public/art/neigong/<icon>.png）；缺省用 id。新内功暂借同源流旧石印，等美术补 */
  icon?: string;
}

/** 原九部：三路 × 三品质，新内功借它们的石印 */
const OLD_NINE: Record<'huashan' | 'shaolin' | 'tangmen', Record<Quality, NeigongId>> = {
  huashan: { 寻常: 'jingleijue', 上乘: 'leimingjianjing', 绝学: 'yuntaixinfa' },
  shaolin: { 寻常: 'zhenyuegong', 上乘: 'panshigong', 绝学: 'putixingong' },
  tangmen: { 寻常: 'shiguxinfa', 上乘: 'xuanyinjue', 绝学: 'qianguxinjue' },
};
const ICON_SET: Record<RouteId, keyof typeof OLD_NINE> = {
  huashan: 'huashan', shaolin: 'shaolin', tangmen: 'tangmen', taixu: 'shaolin', xuanji: 'tangmen', jinghong: 'huashan', fenxue: 'huashan',
};

const ROWS: [NeigongId, string, Quality, RouteId, SectId][] = [
  ['jingleijue', '百川诀', '寻常', 'huashan', 'cangya'],
  ['leimingjianjing', '沧海功', '上乘', 'huashan', 'cangya'],
  ['yuntaixinfa', '沧溟真经', '绝学', 'huashan', 'cangya'],
  ['feiquanjue', '飞泉诀', '上乘', 'jinghong', 'cangya'],
  ['chidangong', '赤胆功', '寻常', 'fenxue', 'qianfan'],
  ['nujiaojue', '怒蛟诀', '上乘', 'fenxue', 'qianfan'],
  ['zheshegong', '蛰蛇功', '寻常', 'tangmen', 'qianshe'],
  ['xuanyinhuagujue', '玄阴化骨诀', '上乘', 'tangmen', 'qianshe'],
  ['tengshezhendian', '腾蛇真典', '绝学', 'tangmen', 'qianshe'],
  ['zhenyuegong', '定慧功', '寻常', 'shaolin', 'qianyan'],
  ['panshigong', '伽蓝诀', '上乘', 'shaolin', 'qianyan'],
  ['putixingong', '菩提心经', '绝学', 'shaolin', 'qianyan'],
  ['wuzhuxinfa', '无住心法', '寻常', 'taixu', 'qianyan'],
  ['jinghuajue', '镜花诀', '寻常', 'xuanji', 'huaying'],
  ['hanxianggong', '寒香功', '上乘', 'xuanji', 'huaying'],
  ['lingxugong', '凌虚功', '寻常', 'jinghong', 'lingfeng'],
  ['fuyaojue', '扶摇诀', '上乘', 'jinghong', 'lingfeng'],
  ['tingchaojue', '听潮诀', '寻常', 'taixu', 'shenhai'],
  ['shenqihuaxugong', '蜃气化虚功', '上乘', 'taixu', 'shenhai'],
  ['guixudafa', '归墟大法', '绝学', 'taixu', 'shenhai'],
  ['yuezhigong', '岳峙功', '寻常', 'shaolin', 'qingtian'],
  ['budongmingwangjue', '不动明王诀', '上乘', 'shaolin', 'qingtian'],
  ['jiudingzhenjing', '九鼎真经', '绝学', 'shaolin', 'qingtian'],
  ['fenghuxinfa', '风虎心法', '寻常', 'huashan', 'huxiao'],
  ['hupogong', '虎魄功', '上乘', 'huashan', 'huxiao'],
  ['baihuxiaofengjing', '白虎啸风经', '绝学', 'huashan', 'huxiao'],
  ['dishagong', '地煞功', '寻常', 'shaolin', 'beimang'],
  ['zhenmingxinjing', '镇冥心经', '上乘', 'shaolin', 'beimang'],
  ['shouyigong', '守一功', '寻常', 'taixu', 'qianyuan'],
  ['qingjingzuowangjue', '清静坐忘诀', '上乘', 'taixu', 'qianyuan'],
  ['qianyuanyiqijing', '乾元一炁经', '绝学', 'taixu', 'qianyuan'],
  ['zifuxinfa', '紫府心法', '上乘', 'xuanji', 'qianyuan'],
  ['chilangjue', '赤浪诀', '寻常', 'fenxue', 'hengjiang'],
  ['xueshagong', '血煞功', '上乘', 'fenxue', 'hengjiang'],
  ['zhishuixinfa', '止水心法', '寻常', 'xuanji', 'shuiyue'],
  ['shuiyueguanxinjing', '水月观心经', '上乘', 'xuanji', 'shuiyue'],
  ['linglongxinfa', '玲珑心法', '寻常', 'jinghong', 'tiangong'],
  ['tianshujue', '天枢诀', '上乘', 'jinghong', 'tiangong'],
  ['konghuanggong', '空篁功', '寻常', 'taixu', 'youhuang'],
  ['wanhuangguixujue', '万篁归虚诀', '上乘', 'taixu', 'youhuang'],
  ['shiguxinfa', '蚀骨心法', '寻常', 'tangmen', 'zhangyue'],
  ['xuanyinjue', '玄阴诀', '上乘', 'tangmen', 'zhangyue'],
  ['qianguxinjue', '万蛊归元经', '绝学', 'tangmen', 'zhangyue'],
  ['xueguranyuangong', '血蛊燃元功', '上乘', 'fenxue', 'zhangyue'],
  ['qiwujue', '栖梧诀', '寻常', 'jinghong', 'cangwu'],
  ['fengmingxinjing', '凤鸣心经', '上乘', 'jinghong', 'cangwu'],
  ['fengzhuqingminggong', '凤翥青冥功', '绝学', 'jinghong', 'cangwu'],
  ['guilinjue', '鬼磷诀', '寻常', 'tangmen', 'bilin'],
  ['jiuyouhuadujing', '九幽化毒经', '上乘', 'tangmen', 'bilin'],
  ['yinleijue', '隐雷诀', '寻常', 'huashan', 'fenglei'],
  ['bentinggong', '奔霆功', '上乘', 'huashan', 'fenglei'],
  ['leigangzhenjing', '雷罡真经', '绝学', 'huashan', 'fenglei'],
  ['shuanghuajue', '霜华诀', '寻常', 'xuanji', 'yinshan'],
  ['hanposuomaigong', '寒魄锁脉功', '上乘', 'xuanji', 'yinshan'],
  ['guijizhenjing', '归寂真经', '绝学', 'xuanji', 'yinshan'],
  ['xueshajue', '血沙诀', '寻常', 'fenxue', 'mingsha'],
  ['yanyanggong', '炎阳功', '上乘', 'fenxue', 'mingsha'],
  ['darixiuluoxuedian', '大日修罗血典', '绝学', 'fenxue', 'mingsha'],
];

export const NEIGONG: Record<NeigongId, NeigongDef> = Object.fromEntries(ROWS.map(([id, name, quality, route, sect]) => {
  const icon = OLD_NINE[ICON_SET[route]][quality];
  return [id, { id, name, quality, route, sect, ...(icon === id ? {} : { icon }) }];
})) as Record<NeigongId, NeigongDef>;

export const NEIGONG_IDS = Object.keys(NEIGONG) as NeigongId[];
export const QUALITY_ORDER: Quality[] = ['寻常', '上乘', '绝学'];

/**
 * 各路的正典三部（neigongOf 的查表）：旧三路沿用原九部；新四路取源流门派那三档
 * （蜃海教 / 阴山派 / 苍梧派 / 鸣沙教）。书肆内功、Boss 掉落、v7→v8 迁移与 sim 都从这里取，门派再多也不变。
 */
const ROUTE_CANON: Record<RouteId, Record<Quality, NeigongId>> = {
  ...OLD_NINE,
  taixu: { 寻常: 'tingchaojue', 上乘: 'shenqihuaxugong', 绝学: 'guixudafa' },
  xuanji: { 寻常: 'shuanghuajue', 上乘: 'hanposuomaigong', 绝学: 'guijizhenjing' },
  jinghong: { 寻常: 'qiwujue', 上乘: 'fengmingxinjing', 绝学: 'fengzhuqingminggong' },
  fenxue: { 寻常: 'xueshajue', 上乘: 'yanyanggong', 绝学: 'darixiuluoxuedian' },
};

/** 某路数某品质的正典内功 */
export function neigongOf(route: RouteId, quality: Quality): NeigongId {
  return ROUTE_CANON[route][quality];
}

/** 三部寻常内功：首世三选一 */
export const STARTER_NEIGONG: NeigongId[] = ['jingleijue', 'zhenyuegong', 'shiguxinfa'];

// ---------------------------------------------------------------- 重数（spec §1.2）

/** 第 n 重的内力价 = 3,490 × 1.08^(n−1)，与品质无关；四舍五入到整数 */
export function zhongCost(n: number): number {
  return Math.round(3490 * Math.pow(1.08, n - 1));
}

/** 火候每重折合境界数的品质倍率 */
export const HUOHOU_MULT: Record<Quality, number> = { 寻常: 1.0, 上乘: 1.02, 绝学: 1.04 };

/** 火候折合的境界数（含品质倍率） */
export function foldRealms(zhong: number, quality: Quality): number {
  return huohouRealms(zhong) * HUOHOU_MULT[quality];
}

// ---------------------------------------------------------------- 台阶（spec §1.3）

export type TierName = '登堂' | '入室' | '大成' | '化境' | '归真';

export interface TierDef {
  name: TierName;
  /** 跨阶所需重数 */
  at: number;
  /** 挂机每 10 分钟一判的基础顿悟概率 */
  p: number;
  /** 需卷册（归真） */
  scroll?: boolean;
  /** 各路数的质变说明（UI 用） */
  effect: Record<RouteId, string>;
}

export const TIERS: TierDef[] = [
  { name: '登堂', at: 2, p: 0.5, effect: { huashan: '叠满 5 重 → 4 重', shaolin: '开场护盾 +15pp', tangmen: '初始毒层 +2', taixu: '借力 +30pp', xuanji: '寂印 4 → 3', jinghong: '追加几率 +15pp', fenxue: '每损一成攻击 +5% → +8%' } },
  { name: '入室', at: 4, p: 0.5, effect: { huashan: '排山倒海 400% → 550%', shaolin: '反伤 +15pp', tangmen: '毒层上限 8 → 10', taixu: '闪过即反手一击', xuanji: '点穴 100% → 180%', jinghong: '追加可连三击', fenxue: '濒死保住两成半气血（每战一次）' } },
  { name: '大成', at: 6, p: 0.5, effect: { huashan: '叠满 → 3 重', shaolin: '气血 < 30% 受伤 −30%', tangmen: '毒爆 50% → 80%', taixu: '卸力 10% → 20%', xuanji: '封穴后留一枚寂印', jinghong: '追加倍率 60% → 90%', fenxue: '吸血 +6pp' } },
  { name: '化境', at: 20, p: 0.02, effect: { huashan: '排山倒海 +50pp', shaolin: '反伤 +5pp', tangmen: '毒伤系数 +3pp', taixu: '借力 +20pp', xuanji: '点穴 +50pp', jinghong: '追加倍率 +10pp', fenxue: '每损一成攻击 +2pp' } },
  { name: '归真', at: 40, p: 0.01, scroll: true, effect: { huashan: '暴伤 +20pp', shaolin: '开场护盾 +8pp', tangmen: '毒伤系数 +2pp', taixu: '闪避 ×1.2', xuanji: '攻击 ×1.08', jinghong: '追加几率 +5pp', fenxue: '吸血 +3pp' } },
];

/** 该品质有几级台阶：寻常 3、上乘 4、绝学 5 */
export const TIER_COUNT: Record<Quality, number> = { 寻常: 3, 上乘: 4, 绝学: 5 };

/** 顿悟一判的间隔（秒）：挂机修炼每 10 分钟 */
export const DUNWU_INTERVAL_SEC = 600;

/**
 * 升重是否被台阶挡住：重数到了下一台阶、但还没跨过去。
 * 返回 null = 不挡；否则返回挡住的台阶（及是否因缺卷册而连顿悟都判不了）。
 */
export function tierGate(
  quality: Quality, zhong: number, passed: number, hasScroll = false,
): { tier: TierDef; index: number; needScroll: boolean } | null {
  if (passed >= TIER_COUNT[quality]) return null;
  const tier = TIERS[passed];
  if (zhong < tier.at) return null;
  return { tier, index: passed, needScroll: !!tier.scroll && !hasScroll };
}

/** 一次顿悟判定的成功概率 = 基础概率 × 悟性 */
export function dunwuChance(tier: TierDef, wuxing: number): number {
  return Math.min(1, tier.p * wuxing);
}

// ---------------------------------------------------------------- 构筑

/**
 * 内功构筑：前三阶即原机制节点 1/2/3（makeBuild 的 nodes），火候按品质倍率放大，
 * 化境 / 归真在最外层改参数。寻常内功与 makeBuild 逐项一致。
 */
export function neigongBuild(id: NeigongId, realm: number, zhong: number, passed: number): Build {
  const ng = NEIGONG[id];
  const b = makeBuild(ng.route, realm, zhong, Math.min(passed, 3));
  const extra = huohouRealms(zhong) * (HUOHOU_MULT[ng.quality] - 1);
  if (extra > 0) {
    const k = Math.pow(1.7, extra);
    b.hp *= k; b.atk *= k; b.def *= k;
    b.hit += 12 * extra; b.dodge += 3 * extra;
  }
  if (passed >= 4) {
    switch (ng.route) {
      case 'huashan': b.burstMult += 0.5; break;
      case 'shaolin': b.thorns += 0.05; break;
      case 'tangmen': b.poison = { ...b.poison, coef: b.poison.coef + 0.03 }; break;
      case 'taixu': b.jieli += 0.2; break;
      case 'xuanji': b.markDmg += 0.5; break;
      case 'jinghong': b.comboMult += 0.1; break;
      case 'fenxue': b.rage += 0.02; break;
    }
  }
  if (passed >= 5) {
    switch (ng.route) {
      case 'huashan': b.cd += 0.2; break;
      case 'shaolin': b.shieldPct += 0.08; break;
      case 'tangmen': b.poison = { ...b.poison, coef: b.poison.coef + 0.02 }; break;
      case 'taixu': b.dodge *= 1.2; break;
      case 'xuanji': b.atk *= 1.08; break;
      case 'jinghong': b.comboRate += 0.05; break;
      case 'fenxue': b.leech += 0.03; break;
    }
  }
  return b;
}

// ---------------------------------------------------------------- 真气（spec §1.4）

export const QI_COEF: Record<Quality, number> = { 寻常: 1.0, 上乘: 1.1, 绝学: 1.2 };

/** 真气上限 = (700 + 150 × (境界 − 2) + 10 × 重数) × 品质系数：sim 尺度先取整再 × QI_SCALE，所以总是 10 的倍数 */
export function qiMax(realm: number, zhong: number, quality: Quality): number {
  return Math.round((70 + 15 * (Math.max(realm, 2) - 2) + zhong) * QI_COEF[quality]) * QI_SCALE;
}

// ---------------------------------------------------------------- 转修（spec §1.5）

/** 同路数转修少掉的重数：保留八成累计内力 ≈ ln(1.25)/ln(1.08) ≈ 2.9 重 */
export const SAME_ROUTE_ZHONG_LOSS = 3;

/** 转修后的起始重数：同路数少 3 重，跨路数归零 */
export function zhongAfterSwitch(from: NeigongId, to: NeigongId, zhong: number): number {
  return NEIGONG[from].route === NEIGONG[to].route ? Math.max(0, zhong - SAME_ROUTE_ZHONG_LOSS) : 0;
}

/** 一世之内转修的银两手续费 = 境界 × 100 [待测试] */
export const switchFee = (realm: number) => realm * 100;

// ---------------------------------------------------------------- 悟性（spec §3）

export const WUXING_MIN = 0.8;
export const WUXING_MAX = 1.2;
/** 声望阁「武道笔记」：每世悟性 +0.1（spec S9） */
export const WUDAO_BIJI_WUXING = 0.1;

/** 新一世的悟性：0.8–1.2 均匀，保留两位小数 */
export function rollWuxing(rand: number, bonus = 0): number {
  return Math.round((WUXING_MIN + (WUXING_MAX - WUXING_MIN) * rand + bonus) * 100) / 100;
}
