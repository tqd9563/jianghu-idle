/**
 * 三路数定义（原「三路线 / 武学门径」，现为内功的路数）—— 权威来源：docs/rules/content.md §3.1
 * 与 docs/systems/sect-neigong/spec.md §1。路数决定战斗核心机制；台阶质变在 neigong.ts。禁止在此调参。
 */
import type { RouteId } from './content';

export interface RouteDef {
  id: RouteId;
  /** 路数名（惊雷 / 镇岳 / 蚀骨）：华山、少林、唐门只作门派名（worldview.md §7-1） */
  name: string;
  motif: string;
  /** 修习即得（路数赠予，不占重数） */
  grant: {
    critRatePP?: number;      // 华山：暴击率 +10pp
    critDmgPP?: number;       // 华山：暴击伤害 +20pp
    firstStrikeCrit?: boolean; // 华山：开战首击必定暴击
    shieldPctHP?: number;     // 少林：开战护盾 = 30% 气血
    thornsPct?: number;       // 少林：反伤 25%（减免后、护盾吸收前）
    defPct?: number;          // 少林：防御 +20%（本轮临时乘区，加法合并）
    poisonInit?: number;      // 唐门：第 0 回合施毒 1 层
    poisonPerHit?: number;    // 唐门：每次命中 +1 层
    poisonCoef?: number;      // 唐门：毒伤系数 12%
    poisonCap?: number;       // 唐门：层数上限 8
    poisonBurstPct?: number;  // 唐门：满层毒爆 50%
    basicAtkMult?: number;    // 唐门：普攻伤害 ×0.60（轻手暗器）
  };
  /** 第 1–10 重的逐重效果（逐重累加，内容表 §3.1） */
  perLevel: {
    atkPct?: number;
    hpPct?: number;
    defPct?: number;
    critRatePP?: number;
    critDmgPP?: number;
    thornsPP?: number;
    poisonCoefPP?: number;
  };
}

export const ROUTES: Record<RouteId, RouteDef> = {
  huashan: {
    id: 'huashan',
    name: '惊雷',
    motif: '快剑爆发 · 短战最强，看脸不稳',
    grant: { critRatePP: 0.10, critDmgPP: 0.20, firstStrikeCrit: true },
    perLevel: { atkPct: 0.06, critRatePP: 0.025, critDmgPP: 0.08 },
  },
  shaolin: {
    id: 'shaolin',
    name: '镇岳',
    motif: '铁壁反震 · 打不死你，磨死对手',
    grant: { shieldPctHP: 0.30, thornsPct: 0.25, defPct: 0.20 },
    perLevel: { hpPct: 0.06, defPct: 0.06, thornsPP: 0.03 },
  },
  tangmen: {
    id: 'tangmen',
    name: '蚀骨',
    motif: '叠毒后发 · 越拖越强，开局最软',
    grant: {
      poisonInit: 1,
      poisonPerHit: 1,
      poisonCoef: 0.12,
      poisonCap: 8,
      poisonBurstPct: 0.5,
      basicAtkMult: 0.6,
    },
    perLevel: { atkPct: 0.01, poisonCoefPP: 0.018 },
  },
};
