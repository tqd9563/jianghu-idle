/**
 * 三路线定义 —— 权威来源：docs/rules/content.md §3（v1.1，C6 平衡修复后）
 * 与 docs/rules/formulas.md 路线参数一致。禁止在此调参。
 */
import type { RouteId } from './content';

export interface RouteDef {
  id: RouteId;
  name: string;
  motif: string;
  skillName: string;
  /** 选择即得（路线赠予，不占武学等级） */
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
  /** 每级武学效果（逐级累加，内容表 §3.1） */
  perLevel: {
    atkPct?: number;
    hpPct?: number;
    defPct?: number;
    critRatePP?: number;
    critDmgPP?: number;
    thornsPP?: number;
    poisonCoefPP?: number;
  };
  /** 机制节点（阅历购买，内容表 §3.2） */
  mechNodes: { id: string; cost: number; label: string }[];
}

export const ROUTES: Record<RouteId, RouteDef> = {
  huashan: {
    id: 'huashan',
    name: '华山 · 剑',
    motif: '快剑爆发 · 短战最强，看脸不稳',
    skillName: '朝阳剑法',
    grant: { critRatePP: 0.10, critDmgPP: 0.20, firstStrikeCrit: true },
    perLevel: { atkPct: 0.06, critRatePP: 0.025, critDmgPP: 0.08 },
    mechNodes: [
      { id: 'hs1', cost: 40, label: '剑意需求 5 → 4' },
      { id: 'hs2', cost: 80, label: '剑招倍率 400% → 550%' },
      { id: 'hs3', cost: 150, label: '剑意需求 → 3' },
    ],
  },
  shaolin: {
    id: 'shaolin',
    name: '少林 · 金钟',
    motif: '铁壁反伤 · 打不死你，磨死对手',
    skillName: '金钟罩',
    grant: { shieldPctHP: 0.30, thornsPct: 0.25, defPct: 0.20 },
    perLevel: { hpPct: 0.06, defPct: 0.06, thornsPP: 0.03 },
    mechNodes: [
      { id: 'sl1', cost: 40, label: '开场护盾 +15pp' },
      { id: 'sl2', cost: 80, label: '反伤 +15pp' },
      { id: 'sl3', cost: 150, label: '低血(<30%)受伤 −30%' },
    ],
  },
  tangmen: {
    id: 'tangmen',
    name: '唐门 · 毒',
    motif: '叠毒后期 · 越拖越强，开局最软',
    skillName: '淬毒心法',
    grant: {
      poisonInit: 1,
      poisonPerHit: 1,
      poisonCoef: 0.12,
      poisonCap: 8,
      poisonBurstPct: 0.5,
      basicAtkMult: 0.6,
    },
    perLevel: { atkPct: 0.01, poisonCoefPP: 0.018 },
    mechNodes: [
      { id: 'tm1', cost: 40, label: '初始毒层 +2' },
      { id: 'tm2', cost: 80, label: '层上限 8 → 10' },
      { id: 'tm3', cost: 150, label: '毒爆 50% → 80%' },
    ],
  },
};
