/**
 * 最终属性计算 —— 权威来源：初案 §四 乘区规则 + 内容表 §1/§3
 * 每个最终量 = 基础值 × (1 + 永久加成和) × (1 + 本轮临时加成和)，层内加法合并。
 * MVP-0 首轮永久加成为 0；「破关心得」（对 Boss +10%）是条件加成，由战斗模块单独结算，不入常值。
 * 单一数据源红线：修炼页 / 战斗页 / 内功页的属性均由本模块计算。
 */
import { BASE_CRIT_DMG, BASE_CRIT_RATE, REALMS, huohouRealms, zhaoshiLevel, type RouteId } from './content';
import { ROUTES } from './routes';
import type { GearBonus } from './gear';
import { diyunBonus, type DiyunLevels } from './prestige';

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
  /** 蚀骨毒伤系数（基础 12% + 逐重 pp），非蚀骨为 0 */
  poisonCoef: number;
  /** 乘区分解（供乘区透视/属性面板小字） */
  zones: {
    atkBase: number;
    atkPermPct: number;
    atkTempPct: number;
    defTempPct: number;
    hpTempPct: number;
    /** 前尘·底蕴累计加成（prestige-shop/design.md §2）；比例项为乘区比例，会心两项为加点 */
    diyun: {
      hpPct: number;
      atkPct: number;
      defPct: number;
      hitPct: number;
      dodgePct: number;
      critPP: number;
      cdPP: number;
    };
    /** 命中 / 闪避的火候平加值（在底蕴乘区之前加） */
    hitFlat: number;
    dodgeFlat: number;
  };
}

const round1 = (v: number) => Math.round(v * 10) / 10;

export function computeAttributes(
  realm: number,
  route: RouteId | null,
  /** 内功重数（sect-neigong/spec.md §1.2） */
  zhong: number,
  permPct = 0,
  /** 窍穴/贯通加成总和（spec §9：加法合并进临时乘区，作用于 hp/atk/def）。
   *  由调用方用 acupoints.totalAcupointBonus(realm, openedCount, meridianCount) 计算 */
  acupointPct = 0,
  /** 内功品质的火候倍率（neigong.HUOHOU_MULT：寻常 1.0 · 上乘 1.02 · 绝学 1.04） */
  huohouMult = 1,
  /** 一身装备的合计加成（battle-loot/spec.md §6：百分比乘进基础值，命中 / 闪避相加，会心封顶 80%） */
  gear?: GearBonus,
  /** 前尘·底蕴八条级数（prestige-shop/design.md §2）：在火候之后、装备之前乘入 */
  diyun?: Partial<DiyunLevels>,
): FinalAttributes {
  const base = REALMS[realm - 1];
  const def = route ? ROUTES[route] : null;
  const g = def?.grant ?? {};
  const p = def?.perLevel ?? {};
  // 逐重效果封顶十重；火候从第 1 重起与境界曲线同形叠在最外层（sect-neigong/spec.md §1.2）
  const L = route ? zhaoshiLevel(zhong) : 0;
  const dx = route ? huohouRealms(zhong) * huohouMult : 0;
  const hh = { statMult: Math.pow(1.7, dx), hit: 12 * dx, dodge: 3 * dx };

  // 本轮临时乘区（路数赠予 + 逐重 + 窍穴/贯通，加法合并）；永久乘区首轮为 0
  const atkTempPct = (p.atkPct ?? 0) * L + acupointPct;
  const defTempPct = (g.defPct ?? 0) + (p.defPct ?? 0) * L + acupointPct;
  const hpTempPct = (p.hpPct ?? 0) * L + acupointPct;

  const ge = gear ?? { atk: 0, hp: 0, def: 0, hit: 0, dodge: 0, atkPct: 0, hpPct: 0, defPct: 0, critPP: 0, cdPP: 0 };
  const dq = {
    hpPct: diyunBonus(diyun, 'qixue'),
    atkPct: diyunBonus(diyun, 'gongji'),
    defPct: diyunBonus(diyun, 'fangyu'),
    hitPct: diyunBonus(diyun, 'mingzhong'),
    dodgePct: diyunBonus(diyun, 'shanbi'),
    critPP: diyunBonus(diyun, 'huixin'),
    cdPP: diyunBonus(diyun, 'huixin_shanghai'),
  };
  return {
    hp: Math.round((base.hp * (1 + permPct) * (1 + hpTempPct) * hh.statMult * (1 + dq.hpPct) + ge.hp) * (1 + ge.hpPct)),
    atk: round1((base.atk * (1 + permPct) * (1 + atkTempPct) * hh.statMult * (1 + dq.atkPct) + ge.atk) * (1 + ge.atkPct)),
    def: round1((base.def * (1 + permPct) * (1 + defTempPct) * hh.statMult * (1 + dq.defPct) + ge.def) * (1 + ge.defPct)),
    accuracy: round1((base.accuracy * (1 + permPct) + hh.hit) * (1 + dq.hitPct) + ge.hit),
    evasion: round1((base.evasion * (1 + permPct) + hh.dodge) * (1 + dq.dodgePct) + ge.dodge),
    critRate: Math.min(0.8, (BASE_CRIT_RATE + (g.critRatePP ?? 0) + (p.critRatePP ?? 0) * L) * (1 + permPct) + dq.critPP + ge.critPP / 100),
    critDmg: (BASE_CRIT_DMG + (g.critDmgPP ?? 0) + (p.critDmgPP ?? 0) * L) * (1 + permPct) + dq.cdPP + ge.cdPP / 100,
    basicAtkMult: g.basicAtkMult ?? 1,
    poisonCoef: g.poisonCoef ? g.poisonCoef + (p.poisonCoefPP ?? 0) * L : 0,
    zones: { atkBase: base.atk, atkPermPct: permPct, atkTempPct, defTempPct, hpTempPct, diyun: dq, hitFlat: hh.hit, dodgeFlat: hh.dodge },
  };
}
