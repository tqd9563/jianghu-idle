/**
 * 战况（issue #77，原型 docs/design/battle-stats-prototype.html）：
 * 从已揭示的回合事件现数本场统计。交手中逐回合刷新、打完即总账，两者同一套口径；只读，不参与结算。
 */
import type { FightStats, TurnEvent } from './combat';

/** 路数机制一行：排山倒海（叠浪爆发）、毒发（毒伤 + 毒爆）、反震（金钟反伤） */
export type MechKey = '排山倒海' | '毒发' | '反震';

export interface BattleTally {
  /** 我方出手：每回合一次行动，连击追加另算一次 */
  acts: number;
  /** 其中武学出招 */
  casts: number;
  /** 没被闪开的出手 */
  hits: number;
  /** 命中且会心的出手（引擎 critCount 连被闪开的也算、不含连击追加，口径不同） */
  crits: number;
  /** 对手出手（被封穴的回合不算） */
  foeActs: number;
  /** 闪开对手的次数 */
  dodges: number;
  /** 我方总输出 / 单次最高 */
  out: number;
  maxHit: number;
  /** 我方承伤（含护盾吸收部分）与其中细项 */
  taken: number;
  shield: number;
  thornsIn: number;
  /** 对手净化清掉毒层的次数 */
  purged: number;
  /** 各武学：出招次数与伤害（连击追加的那一下记在出招的武学上） */
  skills: Record<string, { casts: number; dmg: number }>;
  /** 路数机制：伤害与次数（毒发不计次） */
  mech: Partial<Record<MechKey, { dmg: number; n: number }>>;
  /** 普攻：次数与伤害 */
  plain: { n: number; dmg: number };
}

const skillOf = (form: string | undefined) => (form ? form.slice(0, form.lastIndexOf(':')) : '');

export function tallyTurns(turns: readonly TurnEvent[]): BattleTally {
  const t: BattleTally = {
    acts: 0, casts: 0, hits: 0, crits: 0, foeActs: 0, dodges: 0,
    out: 0, maxHit: 0, taken: 0, shield: 0, thornsIn: 0, purged: 0,
    skills: {}, mech: {}, plain: { n: 0, dmg: 0 },
  };
  let lastSkill = '';
  let prevPoison = 0;   // 上一条事件时敌方身上的毒层：净化清掉非零层才算一次
  const deal = (d: number) => { t.out += d; t.maxHit = Math.max(t.maxHit, d); };
  const mech = (k: MechKey, d: number, count: boolean) => {
    const m = (t.mech[k] ??= { dmg: 0, n: 0 });
    m.dmg += d;
    if (count) m.n += 1;
    t.out += d;
    t.maxHit = Math.max(t.maxHit, d);
  };
  for (const e of turns) {
    const d = e.dmg ?? 0;
    if (e.side === 'player') {
      switch (e.kind) {
        case 'cast': {
          lastSkill = skillOf(e.form);
          const sk = (t.skills[lastSkill] ??= { casts: 0, dmg: 0 });
          sk.casts += 1; sk.dmg += d;
          t.acts += 1; t.casts += 1;
          if (!e.missed) t.hits += 1;
          if (e.crit && !e.missed) t.crits += 1;
          deal(d);
          break;
        }
        case 'followup': {
          const sk = (t.skills[lastSkill] ??= { casts: 0, dmg: 0 });
          sk.dmg += d;
          t.acts += 1;
          if (!e.missed) t.hits += 1;
          if (e.crit && !e.missed) t.crits += 1;
          deal(d);
          break;
        }
        case 'attack': case 'crit':
          t.acts += 1; t.hits += 1; t.plain.n += 1; t.plain.dmg += d;
          if (e.kind === 'crit') t.crits += 1;
          deal(d);
          break;
        case 'miss':
          t.acts += 1; t.plain.n += 1;
          break;
        case 'burst': mech('排山倒海', d, true); break;
        case 'poison_tick': case 'poison_burst': mech('毒发', d, false); break;
        case 'thorns_to_enemy': mech('反震', d, false); break;
        default: break;
      }
    } else if (e.side === 'enemy') {
      switch (e.kind) {
        case 'attack':
          t.foeActs += 1;
          t.taken += d + (e.absorb ?? 0);
          t.shield += e.absorb ?? 0;
          break;
        case 'miss':
          t.foeActs += 1; t.dodges += 1;
          break;
        case 'thorns_to_player':
          t.taken += d + (e.absorb ?? 0);
          t.shield += e.absorb ?? 0;
          t.thornsIn += d + (e.absorb ?? 0);
          break;
        case 'enemy_poison_tick':
          t.taken += d;
          break;
        case 'purify':
          if (prevPoison > 0) t.purged += 1;
          break;
        default: break;
      }
    }
    prevPoison = e.ePoison;
  }
  return t;
}

/** 身中破甲：回合事件里没有层数快照，只在打完后从总账取 */
export const armorBroken = (stats: Pick<FightStats, 'abStacksMax'> | null) => stats?.abStacksMax ?? 0;

/** 百分比（整数）；分母为 0 记 0 */
export const rate = (a: number, b: number) => (b > 0 ? Math.round((a / b) * 100) : 0);
