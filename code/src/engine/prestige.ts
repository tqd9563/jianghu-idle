/**
 * 声望与归隐 —— 权威来源：docs/rules/economy.md v1.2（§6 实现口径定稿）
 * + 规格书 §6.6/§8（v0.10）；玩家可见文案唯一冻结源：docs/rules/copy/retire.md v1.0。
 * 只搬运定稿数值与冻结文案，禁止在此调参/改写。
 */
import { allStages, pyRound, type EnemyTag } from './enemies';

export type RepNodeId =
  | 'qingzhuang_shanglu' | 'zairu_jianghu' | 'wudao_biji' | 'kuaisu_rumen'
  | 'jianghu_shulu' | 'jiumeng_chongwen' | 'poguan_xinde' | 'shimen_zhiyin';

export interface RepNodeDef {
  id: RepNodeId;
  name: string;
  price: number;
  type: string;
  desc: string;
}

/** 8 节点定稿（声望经济表 §2 v1.1）；卡面文案逐字取自 retire-copy §5.1 */
export const REP_NODES: RepNodeDef[] = [
  { id: 'qingzhuang_shanglu', name: '轻装上路', price: 30, type: '策略', desc: '每一轮里，第一次更换路线不收银两' },
  { id: 'zairu_jianghu',      name: '再入江湖', price: 40, type: '信息', desc: '开战前，敌人的每个机制标签都附上一条克制提示' },
  { id: 'wudao_biji',         name: '武道笔记', price: 40, type: '资源', desc: '每轮开局自带 40 点阅历' },
  { id: 'kuaisu_rumen',       name: '快速入门', price: 50, type: '节奏', desc: '突破至「初窥门径」「小有所成」的内力消耗降低 30%' },
  { id: 'jianghu_shulu',      name: '江湖熟路', price: 50, type: '效率', desc: '地图战斗获得的内力提高 20%' },
  { id: 'jiumeng_chongwen',   name: '旧梦重温', price: 60, type: '效率', desc: '挂机修炼的内力产出提高 20%' },
  { id: 'poguan_xinde',       name: '破关心得', price: 70, type: '战斗', desc: '对各图头目（Boss）造成的伤害提高 10%' },
  { id: 'shimen_zhiyin',      name: '师门指引', price: 80, type: '策略', desc: '每轮开局免费获得当前路线的一重参悟，更换路线后跟随新路线' },
];

export const REP_NODE_MAP: Record<RepNodeId, RepNodeDef> = Object.fromEntries(
  REP_NODES.map((n) => [n.id, n]),
) as Record<RepNodeId, RepNodeDef>;

export const hasNode = (owned: string[], id: RepNodeId) => owned.includes(id);

// ---- 节点效果（与 sim run_playthrough2 逐项对齐，声望经济表 §6.1/§6.3） ----

/** 旧梦重温：挂机内力产出 ×1.2（只作用于挂机，不作用于战斗奖励） */
export const idleMult = (owned: string[]) => (hasNode(owned, 'jiumeng_chongwen') ? 1.2 : 1);

/** 快速入门：境界 2/3 突破消耗 −30%（sim early_realm_discount） */
export function breakthroughDiscount(realmTo: number, owned: string[]): number {
  return realmTo <= 3 && hasNode(owned, 'kuaisu_rumen') ? 0.7 : 1;
}

/** 破关心得：对 Boss（高血 或 高防+高攻）伤害 +10%，走 fight 的 bossDmgBonus */
export const bossDmgBonus = (owned: string[]) => (hasNode(owned, 'poguan_xinde') ? 0.10 : 0);

/** 江湖熟路：地图战斗（含首通与回刷）内力奖励 ×1.2；银两/阅历不乘（§6.1 定稿按 sim） */
export const battleNeiliMult = (owned: string[]) => (hasNode(owned, 'jianghu_shulu') ? 1.2 : 1);

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

// ---- 归隐门槛与声望结算 ----

/** 保底触发实现值（声望经济表 §6.2 定稿）：Boss 3 累计失败 ≥4（调整不重置）/ 停滞 12 分钟 / 折扣 0.60 */
export const FALLBACK_FAIL_STREAK = 4;
export const FALLBACK_STALL_MIN = 12;
export const FALLBACK_DISCOUNT = 0.60;
/** 短轮惩罚门槛（声望经济表 §1.3）：≥15 分钟无修正，之下 ×(t/15)² */
export const TIME_PENALTY_MIN = 15;

/** 里程碑声望（声望经济表 §1.1）；行文案见 retire-copy §2.1 */
/** 里程碑 = 各图 Boss（声望经济表 §1.1，五图合计 200） */
const MILESTONES = [
  { key: 'm1s8', boss: '山贼头目', value: 20 },
  { key: 'm2s10', boss: '铁掌恶僧', value: 30 },
  { key: 'm3s10', boss: '黑风寨主', value: 50 },
  { key: 'm4s10', boss: '镇关都督', value: 40 },
  { key: 'm5s10', boss: '无相居士', value: 60 },
] as const;

/** 精英与全通判据覆盖全部五图（§1.2：每精英 +4%、48 关全通 +10%，合计封顶 +30%） */
const ELITE_KEYS = allStages().filter((e) => e.kind === 'elite').map((e) => `m${e.map}s${e.stage}`);
const TOTAL_STAGES = allStages().length;

export interface RetireSettle {
  kind: 'standard' | 'fallback';
  milestones: { boss: string; value: number; achieved: boolean }[];
  base: number;
  eliteKills: number;
  fullClear: boolean;
  /** 表现加成（0–0.30，声望经济表 §1.2 封顶） */
  perfPct: number;
  /** 耗时修正（正常 1.0，声望经济表 §1.3） */
  timePenalty: number;
  /** 保底折扣（标准 1.0 / 保底 0.60，声望经济表 §1.4） */
  discount: number;
  total: number;
}

/**
 * 本轮声望 = 基础 × (1 + 表现加成) × 耗时修正 × 保底折扣（声望经济表 §1）。
 * 口径 = sim settle_reputation；末位取整用 Python 银行家舍入（pyRound），防 .5 边界差一。
 */
export function settleRetire(
  kind: 'standard' | 'fallback',
  clearedStages: string[],
  runPlaySec: number,
): RetireSettle {
  const milestones = MILESTONES.map((m) => ({
    boss: m.boss, value: m.value, achieved: clearedStages.includes(m.key),
  }));
  const base = milestones.reduce((sum, m) => sum + (m.achieved ? m.value : 0), 0);
  const eliteKills = ELITE_KEYS.filter((k) => clearedStages.includes(k)).length;
  const fullClear = clearedStages.length >= TOTAL_STAGES;
  const perfPct = Math.min(0.30, eliteKills * 0.04 + (fullClear ? 0.10 : 0));
  const minutes = runPlaySec / 60;
  const timePenalty = minutes >= TIME_PENALTY_MIN ? 1 : Math.pow(minutes / TIME_PENALTY_MIN, 2);
  const discount = kind === 'fallback' ? FALLBACK_DISCOUNT : 1;
  const total = pyRound(base * (1 + perfPct) * timePenalty * discount);
  return { kind, milestones, base, eliteKills, fullClear, perfPct, timePenalty, discount, total };
}
