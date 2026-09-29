/**
 * 长线关卡表 —— 权威来源：docs/rules/content.md §2.0（v2.3）。
 *
 * 结构：图 × 难度（初入 / 历练 / 绝境）× 关。每一关只记「关卡当量」，敌人属性由 enemyStatsAt
 * 换算；关卡清单由 docs/systems/sim/export_stage_table.py 从 longline_sim 生成（data/longline-stages.json），
 * 禁止在此手改关卡——改规则先改 sim 再重导出。
 */
import stageData from './data/longline-stages.json';

export type EnemyTag = '高血' | '高闪' | '破甲' | '反伤' | '毒' | '净化' | '高防' | '高攻' | '狂暴';

/**
 * 地图 ID 单一数据源 —— MapId 与 store 的 MapNo 由此派生（内容扩充防御，见 exhaustive.ts）。
 */
export const MAP_IDS = [1, 2, 3, 4, 5] as const;
export type MapId = (typeof MAP_IDS)[number];

/** 三档难度（pacing/design.md §3.3；名称 2026-09-28 用户选定） */
export const TIERS = [0, 1, 2] as const;
export type TierId = (typeof TIERS)[number];
export const TIER_NAMES: Record<TierId, string> = { 0: '初入', 1: '历练', 2: '绝境' };

export interface EnemyDef {
  map: MapId;
  tier: TierId;
  stage: number;
  name: string;
  hp: number;
  atk: number;
  def: number;
  hit: number;
  dodge: number;
  tags: EnemyTag[];
  kind: 'normal' | 'elite' | 'boss';
  recommendedRealm: number;
  /** 关卡不掉内力（formulas.md §6.1 v1.6），neili 恒为 0 */
  reward: { neili: number; silver: number; xp: number };
  /** 本关防御常数 K（formulas.md §1.3 v1.6）；缺省 100 */
  defK?: number;
  /** 关卡当量（content.md §2.0） */
  x?: number;
  /** 需境界 6 才打得过的收官 Boss（本版终点） */
  final?: boolean;
}

/** Python round()：banker's rounding（四舍六入五取偶），digits 位小数 */
export function pyRound(x: number, digits = 0): number {
  const m = Math.pow(10, digits);
  const v = x * m;
  const floor = Math.floor(v);
  const diff = v - floor;
  const EPS = 1e-9;
  let r: number;
  if (diff > 0.5 + EPS) r = floor + 1;
  else if (diff < 0.5 - EPS) r = floor;
  else r = floor % 2 === 0 ? floor : floor + 1;
  return r / m;
}

const MAP_NAMES: Record<MapId, string> = { 1: '村外小径', 2: '洛阳近郊', 3: '华山古道', 4: '蜀道险关', 5: '铁壁绝谷' };
export function mapName(map: MapId): string {
  return MAP_NAMES[map];
}

// ─────────────────────────────────────────────────────────────
// 敌人：由「关卡当量」换算（content.md §2.0，与 longline_sim.enemy_at 同式）
// ─────────────────────────────────────────────────────────────

/** 当量 1 的敌人模板 */
export const ENEMY_BASE = { hp: 60, atk: 6, def: 3.5, hit: 100, dodge: 8 } as const;

/** 属性类标签的修正（content.md §2.0）；反伤 / 毒 / 净化 / 破甲 / 狂暴 在战斗里结算，不改属性 */
export const TAG_MODS: Partial<Record<EnemyTag, Partial<Record<'hp' | 'atk' | 'def' | 'dodge', number>>>> = {
  高闪: { dodge: 3.0 },
  高血: { hp: 2.0 },
  高防: { def: 1.6 },
  高攻: { atk: 1.4 },
};

/** 本关防御常数：K = 100 × 1.7^max(0, 当量 − 3)（formulas.md §1.3 v1.6） */
export function defKAt(x: number): number {
  return 100 * Math.pow(1.7, Math.max(0, x - 3));
}

/** 当量 x 的敌人属性：气血/攻击/防御 × 1.7^(x−1)，命中 +12(x−1)，闪避 +3(x−1)，再乘属性类标签修正 */
export function enemyStatsAt(x: number, tags: readonly EnemyTag[] = []): {
  hp: number; atk: number; def: number; hit: number; dodge: number; defK: number;
} {
  const k = Math.pow(1.7, x - 1);
  const s = {
    hp: ENEMY_BASE.hp * k, atk: ENEMY_BASE.atk * k, def: ENEMY_BASE.def * k,
    hit: ENEMY_BASE.hit + 12 * (x - 1), dodge: ENEMY_BASE.dodge + 3 * (x - 1),
    defK: defKAt(x),
  };
  for (const t of tags) {
    for (const [key, mult] of Object.entries(TAG_MODS[t] ?? {}) as ['hp' | 'atk' | 'def' | 'dodge', number][]) {
      s[key] *= mult;
    }
  }
  return s;
}

// ─────────────────────────────────────────────────────────────
// 前沿（图 × 难度）与关卡
// ─────────────────────────────────────────────────────────────

interface StageRow {
  stage: number; kind: EnemyDef['kind']; name: string; x: number; tags: string[];
  recommendedRealm: number; silver: number; xp: number; final?: boolean;
}
interface TrackRow { map: number; tier: number; stages: StageRow[] }

export const trackKey = (map: MapId, tier: TierId) => `${map}-${tier}`;
/** 关卡键：`m{图}t{难度}s{关}`（存档 clearedStages、成就 fameClaimed 共用） */
export const stageKey = (map: MapId, tier: TierId, stage: number) => `m${map}t${tier}s${stage}`;
const KEY_RE = /^m(\d)t(\d)s(\d+)$/;
export function parseStageKey(key: string): { map: MapId; tier: TierId; stage: number } | null {
  const m = KEY_RE.exec(key);
  return m ? { map: Number(m[1]) as MapId, tier: Number(m[2]) as TierId, stage: Number(m[3]) } : null;
}

const TRACKS: ReadonlyMap<string, readonly StageRow[]> = new Map(
  (stageData.tracks as TrackRow[]).map((t) => [trackKey(t.map as MapId, t.tier as TierId), t.stages]),
);

/**
 * 封存（pacing/design.md §4）：显示为锁定、写「大周天未开」。
 * 图 3 绝境需境界 6 之后才开，本版一并封存（content.md §2.0 v2.3）。
 */
export function isSealed(map: MapId, tier: TierId): boolean {
  return !TRACKS.has(trackKey(map, tier));
}

/** 该前沿的关数（含 Boss）；封存为 0 */
export function trackLength(map: MapId, tier: TierId): number {
  return TRACKS.get(trackKey(map, tier))?.length ?? 0;
}

export function getStage(map: MapId, tier: TierId, stage: number): EnemyDef {
  const row = TRACKS.get(trackKey(map, tier))?.[stage - 1];
  if (!row) throw new Error(`no stage ${stageKey(map, tier, stage)}`);
  return {
    map, tier, stage,
    name: row.name,
    ...enemyStatsAt(row.x, row.tags as EnemyTag[]),
    tags: row.tags as EnemyTag[],
    kind: row.kind,
    recommendedRealm: row.recommendedRealm,
    reward: { neili: 0, silver: row.silver, xp: row.xp },
    x: row.x,
    final: row.final ?? false,
  };
}

/** 全部关卡（按图、难度、关序），供声望判据与测试遍历 */
export function allStages(): EnemyDef[] {
  const out: EnemyDef[] = [];
  for (const t of stageData.tracks as TrackRow[]) {
    for (const s of t.stages) out.push(getStage(t.map as MapId, t.tier as TierId, s.stage));
  }
  return out;
}

/** 前沿深浅：难度优先、同档比图序（economy.md §1.2）；只有段末 Boss 计深浅 */
export const trackDepth = (map: MapId, tier: TierId) => tier * 10 + map;

/** 埋点 target ID：关卡键 */
export function targetId(e: EnemyDef): string {
  return stageKey(e.map, e.tier, e.stage);
}

/** 回刷收益（公式表 §6）：银两 50% / 阅历 0；关卡不掉内力 */
export function refarmReward(e: EnemyDef): { neili: number; silver: number; xp: number } {
  return { neili: 0, silver: Math.round(e.reward.silver * 0.5), xp: 0 };
}
