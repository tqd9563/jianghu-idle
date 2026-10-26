/**
 * 声望、宿慧、修行感悟、底蕴与机缘 —— 权威来源：docs/rules/economy.md、docs/systems/prestige-shop/design.md；
 * 玩家可见文案唯一冻结源：docs/rules/copy/retire.md。
 * 只搬运定稿数值与冻结文案，禁止在此调参/改写。
 */
import { allStages, isChapterBoss, mapDef, stageKey, type EnemyTag } from './enemies';

export type RepNodeId =
  | 'chongchu_jianghu' | 'qingzhuang_shanglu' | 'gaixian_yizhe' | 'baoluo_wanxiang' | 'huiyan_shizhu'
  | 'yaodao_bingchu' | 'anhun_dingpo' | 'haina_baichuan' | 'jiaqing_jiushu' | 'renzu_guizong'
  | 'taojia_huanjia' | 'shuangguan_qixia' | 'bizhou_zizhen' | 'kegu_mingxin';

export interface RepNodeDef {
  id: RepNodeId;
  name: string;
  price: number;
  type: string;
  desc: string;
}

/**
 * 十四件机缘（prestige-shop/design.md §2b；价表由 pacing_sim 标定，合计 4,040）。
 * 旧五件传承：再入江湖改名重出江湖；武道笔记 / 师门指引 / 破关心得退出购买，效果并入侠名录成就。
 * 卡面文案逐字取自 retire-copy §5.1。
 */
export const REP_NODES: RepNodeDef[] = [
  { id: 'chongchu_jianghu',   name: '重出江湖', price: 60,  type: '信息', desc: '开战前显示敌人机制的克制提示' },
  { id: 'qingzhuang_shanglu', name: '轻装上路', price: 70,  type: '策略', desc: '书肆秘籍八折' },
  { id: 'gaixian_yizhe',      name: '改弦易辙', price: 80,  type: '资源', desc: '转修手续费减半' },
  { id: 'baoluo_wanxiang',    name: '包罗万象', price: 90,  type: '资源', desc: '行囊空间 +2' },
  { id: 'huiyan_shizhu',      name: '慧眼识珠', price: 100, type: '信息', desc: '市集售卖的商品显示词条' },
  { id: 'yaodao_bingchu',     name: '药到病除', price: 110, type: '战斗', desc: '疗伤所需银两减半' },
  { id: 'anhun_dingpo',       name: '安魂定魄', price: 120, type: '策略', desc: '魂魄未稳缩短为五年' },
  { id: 'haina_baichuan',     name: '海纳百川', price: 170, type: '资源', desc: '武学装配槽 +1' },
  { id: 'jiaqing_jiushu',     name: '驾轻就熟', price: 230, type: '策略', desc: '转世后内功首段台阶免顿悟' },
  { id: 'renzu_guizong',      name: '认祖归宗', price: 270, type: '策略', desc: '转世后自动拜入前世门派' },
  { id: 'taojia_huanjia',     name: '讨价还价', price: 340, type: '资源', desc: '市集商品八折' },
  { id: 'shuangguan_qixia',   name: '双管齐下', price: 600, type: '策略', desc: '可同时承接两项门派任务' },
  { id: 'bizhou_zizhen',      name: '敝帚自珍', price: 900, type: '策略', desc: '转世时保留一件装备' },
  { id: 'kegu_mingxin',       name: '刻骨铭心', price: 900, type: '策略', desc: '转世时保留一门武学的招式与熟练' },
];

export const REP_NODE_MAP: Record<RepNodeId, RepNodeDef> = Object.fromEntries(
  REP_NODES.map((n) => [n.id, n]),
) as Record<RepNodeId, RepNodeDef>;

export const hasNode = (owned: string[], id: RepNodeId) => owned.includes(id);

// ---- 机缘效果（prestige-shop/design.md §2b） ----

/** 改弦易辙：转修手续费减半 */
export const switchFeeMult = (owned: string[]) => (hasNode(owned, 'gaixian_yizhe') ? 0.5 : 1);
/** 包罗万象：行囊多出两行（每行 10 格） */
export const bagExtraCells = (owned: string[]) => (hasNode(owned, 'baoluo_wanxiang') ? 20 : 0);
/** 安魂定魄：魂魄未稳由十年缩为五年 */
export const soulWeakYears = (owned: string[]) => (hasNode(owned, 'anhun_dingpo') ? 5 : 10);
/** 海纳百川：武学装配多一槽（原「丹田上限 +20%」实测把首达境界 4 提前 8 天，改为与内力节奏无关的容量） */
export const extraWuxueSlots = (owned: string[]) => (hasNode(owned, 'haina_baichuan') ? 1 : 0);
/** 讨价还价：市集商品八折（兵器铺 / 衣饰铺）；轻装上路管书肆（武馆秘籍） */
export const marketDiscount = (owned: string[]) => (hasNode(owned, 'taojia_huanjia') ? 0.8 : 1);

/** 重出江湖：机制标签克制提示（retire-copy §7 逐条冻结；组合标签逐条各附，不合成） */
export const COUNTER_HINTS: Record<EnemyTag, string> = {
  高闪: '身法奇快，命中不足者十剑九空',
  破甲: '能削你防御，硬抗流越拖越亏',
  反伤: '攻势会反噬自身，重击者伤己越重',
  毒: '毒入肌理，护盾与防御皆挡不住',
  净化: '会定期清去毒层，毒功难以积势',
  高血: '气血浑厚，比拼的是持续输出',
  狂暴: '拖得越久攻势越凶，宜速战速决',
  高防: '铜皮铁骨，普攻难破；毒伤无视防御',
  高攻: '出手极重，需足够气血或护盾扛住',
};

// ---- 底蕴：八条可反复购买的战斗属性项（prestige-shop/design.md §2） ----

export type DiyunId = 'qixue' | 'gongji' | 'fangyu' | 'mingzhong' | 'shanbi' | 'huixin' | 'huixin_shanghai' | 'zhenqi';
export type DiyunLevels = Record<DiyunId, number>;

export interface DiyunDef {
  id: DiyunId;
  name: string;
  /** 首级收益：比例项为基础值的比例，加点项为百分点（0.005 = 0.5 点） */
  first: number;
  /** 'pct' 按境界基础值比例乘入；'pts' 直接加点（会心率 / 会心倍率） */
  kind: 'pct' | 'pts';
}

export const DIYUN: DiyunDef[] = [
  { id: 'qixue',           name: '气血',     first: 0.05,  kind: 'pct' },
  { id: 'gongji',          name: '攻击',     first: 0.05,  kind: 'pct' },
  { id: 'fangyu',          name: '防御',     first: 0.05,  kind: 'pct' },
  { id: 'mingzhong',       name: '命中',     first: 0.03,  kind: 'pct' },
  { id: 'shanbi',          name: '闪避',     first: 0.03,  kind: 'pct' },
  { id: 'huixin',          name: '会心',     first: 0.005, kind: 'pts' },
  { id: 'huixin_shanghai', name: '会心伤害', first: 0.05,  kind: 'pts' },
  { id: 'zhenqi',          name: '真气',     first: 0.05,  kind: 'pct' },
];
export const DIYUN_MAP: Record<DiyunId, DiyunDef> = Object.fromEntries(DIYUN.map((d) => [d.id, d])) as Record<DiyunId, DiyunDef>;
export const DIYUN_IDS = DIYUN.map((d) => d.id);
export const freshDiyun = (): DiyunLevels => Object.fromEntries(DIYUN_IDS.map((id) => [id, 0])) as DiyunLevels;

/** 价格等比：第 n 级 = round(10 × 1.35^(n−1)) 声望，不限购 */
export const DIYUN_P0 = 10;
export const DIYUN_Q = 1.35;
/** 收益逐级递减：第 n 级 = 首级 × 0.96^(n−1) */
export const DIYUN_DECAY = 0.96;
export const diyunPrice = (level: number) => Math.round(DIYUN_P0 * DIYUN_Q ** (level - 1));
/** 第 level 级这一级给的收益 */
export const diyunGainAt = (first: number, level: number) => first * DIYUN_DECAY ** (level - 1);
/** 买到 level 级的累计收益 */
export const diyunCum = (first: number, level: number) => first * (1 - DIYUN_DECAY ** level) / (1 - DIYUN_DECAY);
/** 某一条当前的累计收益 */
export const diyunBonus = (lv: Partial<DiyunLevels> | undefined, id: DiyunId) => diyunCum(DIYUN_MAP[id].first, lv?.[id] ?? 0);

// ---- 产出乘区：宿慧 + 修行感悟（economy.md §2 / §3） ----

/** 宿慧：首达境界 X 的一次性永久产出加成，跨归隐保留（economy.md §2，pacing_sim 表二） */
export const SUHUI: Readonly<Record<number, number>> = { 2: 1.6, 3: 3.7, 4: 7.6, 5: 13.4 };

/** 历来到过的最高境界 peakRealm 对应的宿慧合计 */
export function suhuiTotal(peakRealm: number): number {
  return Object.entries(SUHUI).reduce((sum, [realm, v]) => sum + (Number(realm) <= peakRealm ? v : 0), 0);
}

/** 修行感悟：第 n 级 +0.2× 基础产出，价格 ⌈8.5 × n⌉ 声望，不限购（economy.md §3；底蕴分走 15% 声望后的补偿价） */
export const GANWU_GAIN = 0.2;
export const GANWU_P0 = 8.5;
export const ganwuPrice = (level: number) => Math.ceil(GANWU_P0 * level);

/** 从当前等级起，用 reputation 最多能连买几级、共花多少（「尽数传承」） */
export function ganwuAffordable(level: number, reputation: number): { levels: number; cost: number } {
  let levels = 0, cost = 0;
  while (cost + ganwuPrice(level + levels + 1) <= reputation) {
    cost += ganwuPrice(level + levels + 1);
    levels += 1;
  }
  return { levels, cost };
}

/** 产出乘区 M = 1 + 宿慧 + 修行感悟（formulas.md §3.2；伤势、魂魄另乘，不计入 M） */
export function outputMult(peakRealm: number, ganwuLevel: number): number {
  return 1 + suhuiTotal(peakRealm) + GANWU_GAIN * ganwuLevel;
}

// ---- 归隐声望：基础 × 行为乘数 + 成就（economy.md §1） ----

/** 基础声望 = 10 × 本世乘区加权有效时长（小时）；在线全额、离线 × 60% */
export const BASE_REP_PER_HOUR = 10;
/** 行为乘数「打到自己的前沿」（economy.md §1.2）：深浅改按卷后几乎每世都拿得到，由 1.2 降为 1.1，对齐旧结构约七成触发的期望 */
export const FRONT_MULT = 1.1;
/** 成就层（economy.md §1.3）：一次性，按当前乘区 × 系数给，即时入账 */
/** 卷章图关后精英 84、Boss 28（原 35 / 9），单价 ×0.7 保成就层约占累计声望 7%（living-jianghu/design.md §2.7） */
export const FAME_ELITE = 4.5;
export const FAME_BOSS = 16.8;
export const FAME_MERIDIAN = 80;

/** 章末 Boss 关卡键 → 深浅 = 所在卷（economy.md §1.2）；同卷并排各章一样深 */
const BOSS_DEPTH: ReadonlyMap<string, number> = new Map(
  allStages()
    .filter((e) => e.kind === 'boss' && isChapterBoss(e.map, e.stage))
    .map((e) => [stageKey(e.map, e.stage), mapDef(e.map).vol]),
);
/** 名号键：精英与所有 Boss（含头目）首次击败都给名号声望（economy.md §1.3） */
const FAME_KIND: ReadonlyMap<string, 'elite' | 'boss'> = new Map(
  allStages()
    .filter((e) => e.kind !== 'normal')
    .map((e) => [stageKey(e.map, e.stage), e.kind as 'elite' | 'boss']),
);
export const isBossKey = (key: string) => FAME_KIND.get(key) === 'boss';
export const isEliteKey = (key: string) => FAME_KIND.get(key) === 'elite';
/** 该键是否是计深浅的段末 Boss */
export const bossDepthOf = (key: string) => BOSS_DEPTH.get(key) ?? 0;

/** 本世击败过的最深章末 Boss（深浅 = 卷序）；一个都没打过为 0 */
export function deepestBoss(clearedStages: readonly string[]): number {
  return clearedStages.reduce((d, k) => Math.max(d, BOSS_DEPTH.get(k) ?? 0), 0);
}

export interface RetireSettle {
  /** 本世乘区加权有效时长（小时） */
  weightedHours: number;
  base: number;
  /** 是否打到自己的前沿：本世最深 Boss 不浅于历来最深，且至少打过一个 Boss */
  frontReached: boolean;
  frontMult: number;
  /** 本世已入账的名号与经脉声望（成就层即时入账，结算只展示不再重复发放） */
  fameThisLife: number;
  /** 本次归隐入账 = 基础 × 行为乘数（成就层已即时入账） */
  total: number;
}

/**
 * 本世声望结算（economy.md §1）：基础 = 10 × 乘区加权小时；× 行为乘数；成就层另计且已即时入账。
 * 口径与 pacing_sim 表五一致（c = NODE_P0 = 10）。
 */
export function settleRetire(args: {
  /** 侠名录·转世线：基础声望 +5 / 10 / 15% */
  baseMult?: number;
  weightedHours: number;
  clearedStages: readonly string[];
  deepestBossEver: number;
  fameThisLife: number;
}): RetireSettle {
  const base = Math.floor(BASE_REP_PER_HOUR * args.weightedHours * (args.baseMult ?? 1));
  const thisLife = deepestBoss(args.clearedStages);
  const frontReached = thisLife > 0 && thisLife >= args.deepestBossEver;
  const frontMult = frontReached ? FRONT_MULT : 1;
  return {
    weightedHours: args.weightedHours, base, frontReached, frontMult,
    fameThisLife: args.fameThisLife,
    total: Math.floor(base * frontMult),
  };
}
