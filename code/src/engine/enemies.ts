/**
 * 单线关卡表 —— 活江湖第一期（docs/systems/living-jianghu/design.md §2.2 卷 · 章 · 图 · 关）。
 *
 * 结构：卷（地域）→ 一张赶路图 + 2–3 章并排（一章一家势力：外围 → 门户两张据点图）→ 关。
 * 每一关只记「关卡当量」，敌人属性由 enemyStatsAt 换算；关卡清单由
 * docs/systems/sim/export_stage_line.py 从 longline_sim 生成（data/stage-line.json），
 * 禁止在此手改关卡——改规则先改 sim 再重导出。
 */
import lineData from './data/stage-line.json';
import { STAT_SCALE } from './content';
import { postOfStage } from './roster';

export type EnemyTag = '高血' | '高闪' | '破甲' | '反伤' | '毒' | '净化' | '高防' | '高攻' | '狂暴';

/** 图在一卷里的层：赶路图 / 势力外围 / 势力门户 */
export type MapLayer = 'road' | 'outer' | 'gate';
/** 战报口吻（narration.ts foeKind）：空串表示按名字判断 */
export type FoeTone = '' | 'beast' | 'bandit' | 'master';

export interface MapDef {
  id: number;
  /** 第几卷 */
  vol: number;
  /** 卷内第几章；赶路图为 0 */
  chapter: number;
  layer: MapLayer;
  name: string;
  /** 所属势力；赶路图为 null */
  faction: string | null;
}
export interface VolumeDef {
  no: number;
  region: string;
  title: string;
  /** 所在境界段 */
  band: number;
  maps: number[];
  factions: { name: string; camp: '正' | '邪' }[];
}

interface StageRow {
  stage: number; kind: EnemyDef['kind']; name: string; x: number; tags: string[];
  recommendedRealm: number; silver: number; xp: number; foe: string; final?: boolean;
}
interface MapRow extends MapDef { stages: StageRow[] }

const MAP_ROWS = lineData.maps as MapRow[];
const ROW_OF: ReadonlyMap<number, MapRow> = new Map(MAP_ROWS.map((m) => [m.id, m]));

/** 地图 ID：按推图次序编号（卷一赶路图为 1）；地图序即深浅 */
export const MAP_IDS: readonly number[] = MAP_ROWS.map((m) => m.id);
export type MapId = number;
export const VOLUMES: readonly VolumeDef[] = lineData.volumes as VolumeDef[];
const CN_NUM = ['', '一', '二', '三', '四', '五', '六', '七', '八', '九', '十'];
export const volName = (vol: number) => `卷${CN_NUM[vol] ?? vol}`;

export function mapDef(map: MapId): MapDef {
  const r = ROW_OF.get(map);
  if (!r) throw new Error(`no map ${map}`);
  return { id: r.id, vol: r.vol, chapter: r.chapter, layer: r.layer, name: r.name, faction: r.faction };
}
export const mapName = (map: MapId): string => ROW_OF.get(map)?.name ?? '';
export const volumeOf = (map: MapId): VolumeDef => VOLUMES[(ROW_OF.get(map)?.vol ?? 1) - 1];

/**
 * 打通一张图（末关）后开放的图：赶路图 → 本卷各章外围；外围 → 同章门户；门户 → 下一卷赶路图。
 * 并排各章互不依赖，打穿任一章门户即进下一卷（design.md §2.2）。
 */
export function unlocksAfterMap(map: MapId): MapId[] {
  const m = ROW_OF.get(map);
  if (!m) return [];
  const vol = VOLUMES[m.vol - 1];
  if (m.layer === 'road') return vol.maps.filter((id) => ROW_OF.get(id)?.layer === 'outer');
  if (m.layer === 'outer') return vol.maps.filter((id) => { const g = ROW_OF.get(id); return g?.layer === 'gate' && g.chapter === m.chapter; });
  const next = VOLUMES[m.vol];
  return next ? [next.maps[0]] : [];
}

export interface EnemyDef {
  map: MapId;
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
  /** 战报口吻；空串按名字判断（narration.ts foeKind） */
  foe?: FoeTone;
  /** 精英与 Boss 的岗位称谓（管事、长老、罗汉堂首座……，roster.ts）；普通关无 */
  post?: string;
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

// ─────────────────────────────────────────────────────────────
// 敌人：由「关卡当量」换算（content.md §2.0，与 longline_sim.enemy_at 同式）
// ─────────────────────────────────────────────────────────────

/** 当量 1 的敌人模板 */
export const ENEMY_BASE = { hp: 60 * STAT_SCALE, atk: 6 * STAT_SCALE, def: 3.5 * STAT_SCALE, hit: 100, dodge: 8 } as const;

/** 属性类标签的修正（content.md §2.0）；反伤 / 毒 / 净化 / 破甲 / 狂暴 在战斗里结算，不改属性 */
export const TAG_MODS: Partial<Record<EnemyTag, Partial<Record<'hp' | 'atk' | 'def' | 'dodge', number>>>> = {
  高闪: { dodge: 3.0 },
  高血: { hp: 2.0 },
  高防: { def: 1.6 },
  高攻: { atk: 1.4 },
};

/** 本关防御常数：K = 100 × STAT_SCALE × 1.7^max(0, 当量 − 3)（formulas.md §1.3 v1.6；与防御同尺度） */
export function defKAt(x: number): number {
  return 100 * STAT_SCALE * Math.pow(1.7, Math.max(0, x - 3));
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
// 关卡
// ─────────────────────────────────────────────────────────────

/** 第一世卷一第 7 关教学战的敌人强度（关卡当量）：按境界 2 段起点打，裸属性必败；传功后同一关回到缓坡起点（battle-loot/design.md §5.1） */
export const TEACH_X: number = lineData.teachX;

/** 关卡键：`m{图}s{关}`（存档 clearedStages、成就 fameClaimed 共用） */
export const stageKey = (map: MapId, stage: number) => `m${map}s${stage}`;
const KEY_RE = /^m(\d+)s(\d+)$/;
export function parseStageKey(key: string): { map: MapId; stage: number } | null {
  const m = KEY_RE.exec(key);
  return m && ROW_OF.has(Number(m[1])) ? { map: Number(m[1]), stage: Number(m[2]) } : null;
}

/** 该图的关数（含末关） */
export function trackLength(map: MapId): number {
  return ROW_OF.get(map)?.stages.length ?? 0;
}

/**
 * 本世精英与 Boss 的在任者名（江湖名册，roster.ts）：由 store 在每世开局写入；
 * 没写入时（测试、名册之外的关）用关卡表里的岗位称呼。
 */
let STAGE_NAMES: ReadonlyMap<string, string> = new Map();
export function setStageNames(names: ReadonlyMap<string, string>): void {
  STAGE_NAMES = names;
}

export function getStage(map: MapId, stage: number): EnemyDef {
  const row = ROW_OF.get(map)?.stages[stage - 1];
  if (!row) throw new Error(`no stage ${stageKey(map, stage)}`);
  return {
    map, stage,
    name: STAGE_NAMES.get(stageKey(map, stage)) ?? row.name,
    ...enemyStatsAt(row.x, row.tags as EnemyTag[]),
    tags: row.tags as EnemyTag[],
    kind: row.kind,
    recommendedRealm: row.recommendedRealm,
    reward: { neili: 0, silver: row.silver, xp: row.xp },
    x: row.x,
    final: row.final ?? false,
    foe: row.foe as FoeTone,
    post: postOfStage(stageKey(map, stage))?.title,
  };
}

/** 全部关卡（按图序、关序），供声望判据与测试遍历 */
export function allStages(): EnemyDef[] {
  return MAP_ROWS.flatMap((m) => m.stages.map((s) => getStage(m.id, s.stage)));
}

/** 各境界段普通关的当量区间（卷一赶路图归境界 1 段，其余按卷所在段；卷一蒿里寨一章并入境界 2 段） */
const BAND_RANGE: ReadonlyMap<number, [number, number]> = (() => {
  const r = new Map<number, [number, number]>();
  for (const m of MAP_ROWS) {
    const band = m.vol === 1 ? (m.layer === 'road' ? 1 : 2) : VOLUMES[m.vol - 1].band;
    for (const st of m.stages) {
      if (st.kind !== 'normal') continue;
      const cur = r.get(band) ?? [st.x, st.x];
      r.set(band, [Math.min(cur[0], st.x), Math.max(cur[1], st.x)]);
    }
  }
  return r;
})();

/** 这一关在所在境界段里的位置（0–1，按当量）：装备品阶按它取权重（battle-loot/spec.md §2.1） */
export function bandPos(map: MapId, stage: number): number {
  const m = ROW_OF.get(map);
  const row = m?.stages[stage - 1];
  if (!m || !row) return 0;
  const band = m.vol === 1 ? (m.layer === 'road' ? 1 : 2) : VOLUMES[m.vol - 1].band;
  const [lo, hi] = BAND_RANGE.get(band) ?? [row.x, row.x];
  return hi > lo ? Math.min(1, Math.max(0, (row.x - lo) / (hi - lo))) : 0;
}

/** 是否是门户图的末关（一章的 Boss） */
export const isChapterBoss = (map: MapId, stage: number) =>
  ROW_OF.get(map)?.layer === 'gate' && stage === trackLength(map);

/** 埋点 target ID：关卡键 */
export function targetId(e: EnemyDef): string {
  return stageKey(e.map, e.stage);
}

/** 回刷收益（公式表 §6）：银两 50% / 阅历 0；关卡不掉内力 */
/** 重打一关给首通银两的几成（battle-loot/design.md 裁决 14 / 39：五成改两成半，银两不能太富裕） */
export const REFARM_SILVER = 0.25;
export function refarmReward(e: EnemyDef): { neili: number; silver: number; xp: number } {
  return { neili: 0, silver: Math.round(e.reward.silver * REFARM_SILVER), xp: 0 };
}
