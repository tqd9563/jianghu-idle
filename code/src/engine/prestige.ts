/**
 * 声望、宿慧与修行感悟 —— 权威来源：docs/rules/economy.md v2.3；
 * 玩家可见文案唯一冻结源：docs/rules/copy/retire.md。
 * 只搬运定稿数值与冻结文案，禁止在此调参/改写。
 */
import { allStages, stageKey, trackDepth, trackLength, type EnemyTag } from './enemies';

export type RepNodeId =
  | 'zairu_jianghu' | 'qingzhuang_shanglu' | 'wudao_biji' | 'shimen_zhiyin' | 'poguan_xinde';

export interface RepNodeDef {
  id: RepNodeId;
  name: string;
  price: number;
  type: string;
  desc: string;
}

/**
 * 五件传承（economy.md §4 v2.2 定价：修行感悟买完后每日结余 220，约第 12 天前买齐）。
 * 旧梦重温、快速入门、江湖熟路已废止。卡面文案逐字取自 retire-copy §5.1。
 */
export const REP_NODES: RepNodeDef[] = [
  { id: 'zairu_jianghu',      name: '再入江湖', price: 150,  type: '信息', desc: '开战前，敌人的每个机制标签都附上一条克制提示' },
  { id: 'qingzhuang_shanglu', name: '轻装上路', price: 220,  type: '策略', desc: '每一世里，第一次更换路线不收银两' },
  { id: 'wudao_biji',         name: '武道笔记', price: 440,  type: '资源', desc: '每一世开局自带 40 点阅历' },
  { id: 'shimen_zhiyin',      name: '师门指引', price: 660,  type: '策略', desc: '每一世开局免费获得当前路线的一重参悟，更换路线后跟随新路线' },
  { id: 'poguan_xinde',       name: '破关心得', price: 1100, type: '战斗', desc: '对各图头目（Boss）造成的伤害提高 10%' },
];

export const REP_NODE_MAP: Record<RepNodeId, RepNodeDef> = Object.fromEntries(
  REP_NODES.map((n) => [n.id, n]),
) as Record<RepNodeId, RepNodeDef>;

export const hasNode = (owned: string[], id: RepNodeId) => owned.includes(id);

// ---- 节点效果（与 sim run_playthrough2 逐项对齐，声望经济表 §6.1/§6.3） ----

/** 破关心得：对 Boss（高血 或 高防+高攻）伤害 +10%，走 fight 的 bossDmgBonus */
export const bossDmgBonus = (owned: string[]) => (hasNode(owned, 'poguan_xinde') ? 0.10 : 0);

/** 武道笔记：新一轮开局继承阅历 */
export const carryXp = (owned: string[]) => (hasNode(owned, 'wudao_biji') ? 40 : 0);

/** 再入江湖：机制标签克制提示（retire-copy §7 逐条冻结；组合标签逐条各附，不合成） */
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

// ---- 产出乘区：宿慧 + 修行感悟（economy.md §2 / §3） ----

/** 宿慧：首达境界 X 的一次性永久产出加成，跨归隐保留（economy.md §2，pacing_sim 表二） */
export const SUHUI: Readonly<Record<number, number>> = { 2: 1.6, 3: 3.7, 4: 7.6, 5: 13.4 };

/** 历来到过的最高境界 peakRealm 对应的宿慧合计 */
export function suhuiTotal(peakRealm: number): number {
  return Object.entries(SUHUI).reduce((sum, [realm, v]) => sum + (Number(realm) <= peakRealm ? v : 0), 0);
}

/** 修行感悟：第 n 级 +0.2× 基础产出，价格 10 × n 声望，不限购（economy.md §3） */
export const GANWU_GAIN = 0.2;
export const ganwuPrice = (level: number) => 10 * level;

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
/** 行为乘数「打到自己的前沿」（economy.md §1.2） */
export const FRONT_MULT = 1.2;
/** 成就层（economy.md §1.3）：一次性，按当前乘区 × 系数给，即时入账 */
export const FAME_ELITE = 6.4;
export const FAME_BOSS = 24;
export const FAME_MERIDIAN = 80;

/** 段末 Boss 关卡键 → 深浅（难度优先、同档比图序，economy.md §1.2）；图 1 初入中段的头目不计深浅 */
const BOSS_DEPTH: ReadonlyMap<string, number> = new Map(
  allStages()
    .filter((e) => e.kind === 'boss' && e.stage === trackLength(e.map, e.tier))
    .map((e) => [stageKey(e.map, e.tier, e.stage), trackDepth(e.map, e.tier)]),
);
/** 名号键：精英与所有 Boss（含头目）首次击败都给名号声望（economy.md §1.3） */
const FAME_KIND: ReadonlyMap<string, 'elite' | 'boss'> = new Map(
  allStages()
    .filter((e) => e.kind !== 'normal')
    .map((e) => [stageKey(e.map, e.tier, e.stage), e.kind as 'elite' | 'boss']),
);
export const isBossKey = (key: string) => FAME_KIND.get(key) === 'boss';
export const isEliteKey = (key: string) => FAME_KIND.get(key) === 'elite';
/** 该键是否是计深浅的段末 Boss */
export const bossDepthOf = (key: string) => BOSS_DEPTH.get(key) ?? 0;

/** 本世击败过的最深段末 Boss（深浅 = 难度 × 10 + 图序）；一个都没打过为 0 */
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
  weightedHours: number;
  clearedStages: readonly string[];
  deepestBossEver: number;
  fameThisLife: number;
}): RetireSettle {
  const base = Math.floor(BASE_REP_PER_HOUR * args.weightedHours);
  const thisLife = deepestBoss(args.clearedStages);
  const frontReached = thisLife > 0 && thisLife >= args.deepestBossEver;
  const frontMult = frontReached ? FRONT_MULT : 1;
  return {
    weightedHours: args.weightedHours, base, frontReached, frontMult,
    fameThisLife: args.fameThisLife,
    total: Math.floor(base * frontMult),
  };
}
