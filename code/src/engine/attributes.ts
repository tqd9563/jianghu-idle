/**
 * 最终属性计算 —— 权威来源：初案 §四 乘区规则 + 内容表 §1/§3
 * 每个最终量 = 基础值 × (1 + 永久加成和) × (1 + 本轮临时加成和)，层内加法合并。
 * MVP-0 首轮永久加成为 0；「破关心得」（对 Boss +10%）是条件加成，由战斗模块单独结算，不入常值。
 * 单一数据源红线：修炼页 / 战斗页 / 武学页的属性均由本模块计算。
 */
import { BASE_CRIT_DMG, BASE_CRIT_RATE, REALMS, type RouteId } from './content';
import { ROUTES } from './routes';

export interface FinalAttributes {
  hp: number;
  atk: number;
  def: number;
  accuracy: number;
  evasion: number;
  critRate: number;
  critDmg: number;
  /** 唐门普攻系数（其余路线 1.0） */
  basicAtkMult: number;
  /** 唐门毒伤系数（基础 12% + 武学 pp），非唐门为 0 */
  poisonCoef: number;
  /** 乘区分解（供乘区透视/属性面板小字） */
  zones: {
    atkBase: number;
    atkPermPct: number;
    atkTempPct: number;
    defTempPct: number;
    hpTempPct: number;
  };
}

const round1 = (v: number) => Math.round(v * 10) / 10;

export function computeAttributes(
  realm: number,
  route: RouteId | null,
  skillLevel: number,
  permPct = 0,
  /** 窍穴/贯通加成总和（spec §9：加法合并进临时乘区，作用于 hp/atk/def）。
   *  由调用方用 acupoints.totalAcupointBonus(realm, openedCount, meridianCount) 计算 */
  acupointPct = 0,
): FinalAttributes {
  const base = REALMS[realm - 1];
  const def = route ? ROUTES[route] : null;
  const g = def?.grant ?? {};
  const p = def?.perLevel ?? {};
  const L = route ? skillLevel : 0;

  // 本轮临时乘区（路线赠予 + 武学 + 窍穴/贯通，加法合并）；永久乘区首轮为 0
  const atkTempPct = (p.atkPct ?? 0) * L + acupointPct;
  const defTempPct = (g.defPct ?? 0) + (p.defPct ?? 0) * L + acupointPct;
  const hpTempPct = (p.hpPct ?? 0) * L + acupointPct;

  return {
    hp: Math.round(base.hp * (1 + permPct) * (1 + hpTempPct)),
    atk: round1(base.atk * (1 + permPct) * (1 + atkTempPct)),
    def: round1(base.def * (1 + permPct) * (1 + defTempPct)),
    accuracy: round1(base.accuracy * (1 + permPct)),
    evasion: round1(base.evasion * (1 + permPct)),
    critRate: (BASE_CRIT_RATE + (g.critRatePP ?? 0) + (p.critRatePP ?? 0) * L) * (1 + permPct),
    critDmg: (BASE_CRIT_DMG + (g.critDmgPP ?? 0) + (p.critDmgPP ?? 0) * L) * (1 + permPct),
    basicAtkMult: g.basicAtkMult ?? 1,
    poisonCoef: g.poisonCoef ? g.poisonCoef + (p.poisonCoefPP ?? 0) * L : 0,
    zones: { atkBase: base.atk, atkPermPct: permPct, atkTempPct, defTempPct, hpTempPct },
  };
}
