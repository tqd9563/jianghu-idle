/**
 * 存档最低规格（MVP-0 规格书 §12 实现路线图前置）：
 * 本地自动持久化 + 刷新/崩溃无损恢复 + 测试者一键重置 + 与埋点同级导出。
 * MVP-0「页面关闭期间不结算任何收益」条款已随 MVP-1 开工解除（docs/rules/offline-rewards.md §1.2）：
 * savedAt 时间戳即离线时长的权威来源，出关结算见 engine/offlineRewards.ts + store.init。
 */

import { newWorldSeed } from '../engine/roster';
import { NEIGONG, STARTER_NEIGONG, TIERS, neigongOf, type NeigongId } from '../engine/neigong';
import { rankOf, type SectId } from '../engine/sect';
import type { RouteId } from '../engine/content';
import { WUXUE, type WuxueId } from '../engine/wuxue';
import { allStages, getStage, MAP_IDS, stageKey, trackLength, unlocksAfterMap } from '../engine/enemies';
import legacyV17 from './legacy/v17-stages.json';

export const SAVE_KEY = 'jianghu-idle:save:v1';
const DEBUG_OFFLINE_CAP_KEY = 'jianghu-idle:debug:offline-cap-min';
const LIVE_TEST_WINDOW_KEY = 'jianghu-idle:live-test-window:v1';

/**
 * 存档版本号。
 * v1 = MVP-0/1/2 无周天系统；v2 = 主题版本加窍穴/经脉/气势字段；
 * v3 = 窍穴 id 由位置编码（r2-a11）改为穴位拼音（quchi），与境界/脉序解耦；
 * v4 = 长线节奏（issue #22）：境界总额约放大百倍、新增宿慧与修行感悟；
 * v5 = 长线关卡（issue #22 第 5b 步）：关卡键改为「图 × 难度 × 关」，新增难度解锁；
 * v6 = 多天一世（issue #22 第 6 步）：境界总额与关卡表重解、寿元随境界、新增本世时长；
 * v7 = 图 1 初入最前面补 6 关入门关（境界 1 裸属性可打），原有关卡编号顺延；
 * v8 = 门径并入内功（issue #36）：路线 → 同路数寻常内功、武学等级 → 重数、机制节点 → 台阶，秘籍阁废止。
 * v13 = 武学一式一页（battle-loot/design.md §4）：残页从计数改为已得的式，寻常全本并入整门，取消顿悟领悟。
 * v14 = 传功缓坡（battle-loot/design.md §5.1）：图 1 初入入门关之后插 15 关，第 7 关起原有关卡编号顺延。
 * v15 = 关卡精简（content.md v2.12）：图 1 初入 101 → 40 关，缓坡与主段按当量折算到新编号。
 * v16 = 熟练阈值重标（issue #79）：每式出招数按「新圆满 ÷ 旧圆满」放大，已解锁的式不收回。
 * v17 = 真气展示尺度 ×10（battle-loot/design.md 裁决 48）：装备「蕴气」词条数值 ×10。
 * v18 = 卷章图关（living-jianghu/design.md §2.2）：取消三档难度，关卡键改为「图 × 关」，按当量折算进度与首杀。
 * v19 = 江湖名册（living-jianghu/design.md §2.1）：补世界种子，旧存档的江湖从这一世起推演，前世的击败不补记。
 * v20 = 门派改造（sect-overhaul/design.md §6）：旧九派换成二十一家、差事改六档、补地位与累计贡献、剔除占位内功。
 */
export const SAVE_VERSION = 20;

/**
 * 低于此版本的存档强制重开，不迁移：长线数值与旧档量级不兼容
 * （pacing/design.md §1「旧存档强制重开」，zhoutian/design.md §5 v3.0 已拍板）。
 */
export const MIN_COMPATIBLE_SAVE_VERSION = 6;

/**
 * v2 → v3 窍穴 id 映射：旧 id 编码了「境界-脉序-穴序」，一旦调整窍穴所属境界
 * 就得改 id、就得迁移存档；新 id 取穴位本身，位置怎么挪都不用再动存档。
 * 本表是一次性的历史包袱，不随后续内容调整增长。
 */
const ACUPOINT_ID_V2_TO_V3: Readonly<Record<string, string>> = {
  'r2-a11': 'quchi',    'r2-a12': 'hegu',
  'r2-a21': 'shaohai',  'r2-a22': 'shenmen',
  'r3-a11': 'futu',     'r3-a12': 'zusanli',  'r3-a13': 'fenglong',
  'r3-a21': 'xuehai',   'r3-a22': 'sanyinjiao',
  'r4-a11': 'guanyuan', 'r4-a12': 'qihai',    'r4-a13': 'danzhong',
  'r4-a21': 'yongquan', 'r4-a22': 'taixi',    'r4-a23': 'fuliu',
  'r5-a11': 'mingmen',  'r5-a12': 'dazhui',   'r5-a13': 'baihui',
  'r5-a21': 'henggu',   'r5-a22': 'dahe',     'r5-a23': 'youmen',
  'r5-a31': 'wushu',    'r5-a32': 'weidao',
};

export interface LiveTestWindowRecord {
  readonly windowId: string;
  readonly startedAt: number;
  readonly tablesVersionStarted: string;
}

/** node 测试环境无 localStorage 时退化为内存实现（行为一致，不持久） */
const mem = new Map<string, string>();
const store: Pick<Storage, 'getItem' | 'setItem' | 'removeItem'> =
  typeof localStorage !== 'undefined'
    ? localStorage
    : {
        getItem: (k) => mem.get(k) ?? null,
        setItem: (k, v) => void mem.set(k, v),
        removeItem: (k) => void mem.delete(k),
      };

export function saveGame(state: unknown): void {
  store.setItem(SAVE_KEY, JSON.stringify({ savedAt: Date.now(), version: SAVE_VERSION, state }));
}

export function loadGame<T>(): T | null {
  const raw = store.getItem(SAVE_KEY);
  if (!raw) return null;
  try {
    return (JSON.parse(raw) as { state: T }).state;
  } catch {
    return null;
  }
}

/** 加载存档并返回版本号（旧存档无 version 字段则视为 v1）；gameStore 用此决定迁移策略 */
export function loadGameWithVersion<T>(): { state: T; version: number } | null {
  const raw = store.getItem(SAVE_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as { state: T; version?: number };
    return { state: parsed.state, version: parsed.version ?? 1 };
  } catch {
    return null;
  }
}

/**
 * 存档迁移：从 fromVer 迁移到 toVer。
 * v1→v2 只新增字段（由 gameStore 的 {...FRESH, ...saved} merge 处理），此处无操作。
 * v2→v3 重写窍穴 id（见 ACUPOINT_ID_V2_TO_V3）：acupointProgress 的键与
 * acupointLog 的元素都按 id 存，两处都要换；映射不到的键原样保留，不静默丢弃玩家进度。
 */
export function migrate<T>(state: T, fromVer: number, toVer: number): T {
  let out = state;
  if (fromVer < 3) out = migrateAcupointIdsV2ToV3(out);
  if (fromVer < 7) out = migrateIntroStagesV6ToV7(out);
  if (fromVer < 8) out = migrateNeigongV7ToV8(out);
  if (fromVer < 9) out = migrateIdleV8ToV9(out);
  if (fromVer < 10) out = migrateTeachV9ToV10(out);
  if (fromVer < 11) out = migrateRumorV10ToV11(out);
  if (fromVer < 12) out = migratePrestigeV11ToV12(out);
  if (fromVer < 13) out = migrateFormPagesV12ToV13(out);
  if (fromVer < 14) out = migrateTeachRampV13ToV14(out);
  if (fromVer < 15 && toVer >= 15) out = migrateStageCompressV14ToV15(out);   // 旧用例只迁到 14 时不折算
  if (fromVer < 16 && toVer >= 16) out = migrateShulianV15ToV16(out);
  if (fromVer < 17 && toVer >= 17) out = migrateQiScaleV16ToV17(out);
  if (fromVer < 18 && toVer >= 18) out = migrateStageLineV17ToV18(out);
  if (fromVer < 19 && toVer >= 19) out = migrateRosterV18ToV19(out);
  if (fromVer < 20 && toVer >= 20) out = migrateSectV19ToV20(out);
  return out;
}

/** 旧版秘籍自带的前几式（上乘 2、绝学 3）：迁移时补成残页，已有的不收回 */
const OLD_GIVEN = { 上乘: 2, 绝学: 3 } as const;

/**
 * v12 → v13（battle-loot/design.md §4 一式一页）：宁多给不收回——
 * 某一式攒过残页（哪怕没凑齐）、有招式秘籍、本世已悟、或是旧秘籍自带的式，都算得了这一页；
 * 寻常书匣里任一式全本即得整门；本世领悟与前世悟过的记录作废（解锁改看前一式圆满）。
 */
function migrateFormPagesV12ToV13<T>(state: T): T {
  const s = state as Record<string, unknown>;
  if (!['ownedWuxue', 'pages', 'books', 'learnedForms', 'pastLearned', 'ownedScrolls'].some((k) => k in s)) return state;
  const owned = new Set((s.ownedWuxue as WuxueId[] | undefined) ?? []);
  const pages = new Set<string>();
  const add = (key: string) => {
    const id = key.split(':')[0] as WuxueId;
    const d = WUXUE[id];
    if (!d) return;
    if (d.quality === '寻常') owned.add(id);
    else { pages.add(key); if (key.endsWith(':1')) owned.add(id); }
  };
  const old = s.pages;
  if (Array.isArray(old)) (old as string[]).forEach(add);
  else if (old) Object.entries(old as Record<string, number>).filter(([, n]) => n > 0).forEach(([k]) => add(k));
  ((s.books as string[] | undefined) ?? []).forEach(add);
  ((s.learnedForms as string[] | undefined) ?? []).forEach(add);
  const scrolls = (s.ownedScrolls as string[] | undefined) ?? [];
  scrolls.filter((k) => !k.startsWith('juance:')).forEach(add);
  for (const id of owned) {
    const q = WUXUE[id]?.quality;
    if (q === '上乘' || q === '绝学') for (let k = 1; k <= OLD_GIVEN[q]; k++) pages.add(`${id}:${k}`);
  }
  const { books: _b, learnedForms: _l, pastLearned: _p, ...rest } = s;
  return {
    ...rest,
    ownedWuxue: [...owned],
    pages: [...pages],
    ownedScrolls: scrolls.filter((k) => k.startsWith('juance:')),
  } as T;
}

/** v10 → v11（实装五九派）：拜山传闻从布尔改为「哪张图」的编号，true → 1 */
/**
 * v12（prestige-shop/design.md）：声望阁改前尘。再入江湖改名重出江湖；武道笔记 / 师门指引 / 破关心得退出购买
 * （效果并入侠名录成就，实装二迁为对应成就一层）；新增底蕴八条级数，旧档补零。
 */
function migratePrestigeV11ToV12<T>(state: T): T {
  const s = state as Record<string, unknown>;
  if (!Array.isArray(s.ownedRepNodes)) return state;   // 没买过节点的档不动；底蕴缺字段由 FRESH 兜底
  const rename: Record<string, string> = { zairu_jianghu: 'chongchu_jianghu' };
  const retired = new Set(['wudao_biji', 'shimen_zhiyin', 'poguan_xinde']);
  const owned = s.ownedRepNodes as string[];
  const gone = owned.filter((id) => retired.has(id));
  return {
    ...s,
    ownedRepNodes: [...new Set(owned.filter((id) => !retired.has(id)).map((id) => rename[id] ?? id))],
    ...(gone.length ? { retiredNodes: gone } : {}),
  } as T;
}

function migrateRumorV10ToV11<T>(state: T): T {
  const s = state as { rumorPending?: unknown };
  if (!s || typeof s !== 'object' || typeof s.rumorPending !== 'boolean') return state;
  return { ...s, rumorPending: s.rumorPending ? 1 : 0 } as T;
}

/**
 * v9 → v10（battle-loot 实装四）：内功改在传功后选、市集按战败开张。旧存档已过境界 1 的，视为前辈已传功、市集已开张，
 * 免得卡在选内功或丢了书肆。
 */
function migrateTeachV9ToV10<T>(state: T): T {
  const s = state as { realm?: number; neigong?: string | null; run?: number };
  if (!s || typeof s !== 'object' || typeof s.realm !== 'number') return state;   // 只动真实存档，碎片对象不补键
  const taught = s.realm >= 2 || (s.run ?? 1) >= 2 || !!s.neigong;
  return { ...s, taught, marketOpen: !!s.neigong } as T;
}

/**
 * v8 → v9（battle-loot 实装一）：自动连战开关与连续回刷衰减三字段废止，挂机状态改由 idle 字段承载（缺省 null，
 * 由 {...FRESH, ...saved} 合并补上）。只删旧键，不补新键。
 */
function migrateIdleV8ToV9<T>(state: T): T {
  const s = state as Record<string, unknown>;
  if (!s || typeof s !== 'object') return state;
  const out = { ...s };
  for (const k of ['autoAdvance', 'refarmKey', 'refarmCount', 'refarmAt']) delete out[k];
  return out as T;
}

/** v14 在入门关之后插入的传功缓坡关数（迁移专用，冻结在 v14 口径，不随关卡表变化） */
const V14_RAMP_STAGES = 15;

/**
 * v13 → v14：图 1 初入第 7 关起顺延 15 关（入门关 1–6 不动）。按关卡键记的字段都顺延：
 * 通关记录、挑战次数、已领成就（'stage:' 前缀）、挂机关。已通过旧第 7 关的存档，缓坡视为已通。
 */
function migrateTeachRampV13ToV14<T>(state: T): T {
  const s = state as {
    clearedStages?: string[];
    attempts?: Record<string, number>;
    fameClaimed?: string[];
    idle?: { map: number; tier: number; stage: number } | null;
  };
  if (!s || typeof s !== 'object') return state;
  const shift = (key: string) =>
    key.replace(M1T0_RE, (all, pre: string | undefined, n: string) =>
      Number(n) > V7_INTRO_STAGES ? `${pre ?? ''}m1t0s${Number(n) + V14_RAMP_STAGES}` : all);
  const out: typeof s = { ...s };
  if (Array.isArray(s.clearedStages)) {
    const passed = s.clearedStages.some((k) => Number(k.match(M1T0_RE)?.[2] ?? 0) > V7_INTRO_STAGES);
    const ramp = Array.from({ length: V14_RAMP_STAGES }, (_, i) => `m1t0s${V7_INTRO_STAGES + 1 + i}`);
    out.clearedStages = [...s.clearedStages.map(shift), ...(passed ? ramp : [])];
  }
  if (s.attempts && typeof s.attempts === 'object') {
    out.attempts = Object.fromEntries(Object.entries(s.attempts).map(([k, v]) => [shift(k), v]));
  }
  if (Array.isArray(s.fameClaimed)) out.fameClaimed = s.fameClaimed.map(shift);
  if (s.idle && s.idle.map === 1 && s.idle.tier === 0 && s.idle.stage > V7_INTRO_STAGES) {
    out.idle = { ...s.idle, stage: s.idle.stage + V14_RAMP_STAGES };
  }
  return out as T;
}

/**
 * v14 → v15：图 1 初入 101 → 40 关（content.md v2.12）。旧关号按当量折到新关号（取当量不高于旧关的最后一关）：
 * 入门关 1–6 不动；缓坡 7–21（每关 +0.05）→ 7–11（每关 +0.15）；主段 22–100（每关 +0.05）→ 12–39（每关 +0.14）；Boss 101 → 40。
 * 通关记录、挑战次数、已领成就、挂机关都照此折算；折到同一关的去重、次数相加。公式冻结在 v15 口径，不随关卡表变化。
 */
function v15StageOf(n: number): number {
  if (n <= 6) return n;
  if (n <= 21) return 7 + Math.floor((n - 7) / 3);
  if (n <= 100) return 12 + Math.floor(((n - 22) * 5) / 14);
  return 40;
}

function migrateStageCompressV14ToV15<T>(state: T): T {
  const s = state as {
    clearedStages?: string[];
    attempts?: Record<string, number>;
    fameClaimed?: string[];
    idle?: { map: number; tier: number; stage: number } | null;
  };
  if (!s || typeof s !== 'object') return state;
  const fold = (key: string) =>
    key.replace(M1T0_RE, (_all, pre: string | undefined, n: string) => `${pre ?? ''}m1t0s${v15StageOf(Number(n))}`);
  const out: typeof s = { ...s };
  if (Array.isArray(s.clearedStages)) out.clearedStages = [...new Set(s.clearedStages.map(fold))];
  if (s.attempts && typeof s.attempts === 'object') {
    const merged: Record<string, number> = {};
    for (const [k, v] of Object.entries(s.attempts)) merged[fold(k)] = (merged[fold(k)] ?? 0) + v;
    out.attempts = merged;
  }
  if (Array.isArray(s.fameClaimed)) out.fameClaimed = [...new Set(s.fameClaimed.map(fold))];
  if (s.idle && s.idle.map === 1 && s.idle.tier === 0) out.idle = { ...s.idle, stage: v15StageOf(s.idle.stage) };
  return out as T;
}

/** v17 真气倍数；冻结在 v17 口径，不随 QI_SCALE 变化 */
const V17_QI_SCALE = 10;

/**
 * v16 → v17（真气 ×10）：存档里唯一的真气绝对值是装备的「蕴气」词条。装备散在行囊、身上、挂机小结、
 * 黑市揭晓货等多处，所以整棵存档树里凡是「有 slot 和 afx 的对象」都当装备处理，qi 词条 ×10。
 */
function migrateQiScaleV16ToV17<T>(state: T): T {
  const walk = (v: unknown): unknown => {
    if (Array.isArray(v)) return v.map(walk);
    if (!v || typeof v !== 'object') return v;
    const o = Object.fromEntries(Object.entries(v).map(([k, x]) => [k, walk(x)])) as Record<string, unknown>;
    if (typeof o.slot === 'string' && Array.isArray(o.afx)) {
      o.afx = (o.afx as unknown[]).map((a) => Array.isArray(a) && a[0] === 'qi' && typeof a[1] === 'number' ? ['qi', a[1] * V17_QI_SCALE] : a);
    }
    return o;
  };
  return walk(state) as T;
}

/** v16 熟练放大倍数 = 新圆满 ÷ 旧圆满（寻常 250/25、上乘 300/28、绝学 350/32）；冻结在 v16 口径 */
const V16_SHULIAN_K = { 寻常: 10, 上乘: 300 / 28, 绝学: 350 / 32 } as const;

/**
 * v15 → v16（issue #79 熟练阈值重标）：每式出招数 × 新旧圆满之比、向上取整。旧档已圆满的式照旧圆满，
 * 靠它接上的下一式不收回；未知武学按寻常倍数。
 */
function migrateShulianV15ToV16<T>(state: T): T {
  const s = state as { formCasts?: Record<string, number> };
  if (!s || typeof s !== 'object' || !s.formCasts || typeof s.formCasts !== 'object') return state;
  const formCasts: Record<string, number> = {};
  for (const [k, v] of Object.entries(s.formCasts)) {
    const q = WUXUE[k.split(':')[0] as WuxueId]?.quality ?? '寻常';
    formCasts[k] = Math.ceil(v * V16_SHULIAN_K[q] - 1e-9);
  }
  return { ...s, formCasts } as T;
}

/** v7 在图 1 初入最前面插入的入门关数（迁移专用，冻结在 v7 口径，不随关卡表变化） */
const V7_INTRO_STAGES = 6;
const M1T0_RE = /^(stage:)?m1t0s(\d+)$/;

/**
 * v6 → v7：图 1 初入原第 N 关变成第 N+6 关。凡按关卡键记的字段都顺延：
 * 通关记录、挑战次数、回刷衰减键、已领成就（'stage:' 前缀）。
 * 已通过图 1 初入任意一关的存档，入门关视为已通，免得回头重打。
 */
function migrateIntroStagesV6ToV7<T>(state: T): T {
  const s = state as {
    clearedStages?: string[];
    attempts?: Record<string, number>;
    refarmKey?: string | null;
    fameClaimed?: string[];
  };
  if (!s || typeof s !== 'object') return state;
  const shift = (key: string) =>
    key.replace(M1T0_RE, (_, pre: string | undefined, n: string) =>
      `${pre ?? ''}m1t0s${Number(n) + V7_INTRO_STAGES}`);

  // 只改存档里本来就有的字段：补出 undefined 键会在 {...FRESH, ...saved} 合并时盖掉默认值
  const out: typeof s = { ...s };
  if (Array.isArray(s.clearedStages)) {
    const shifted = s.clearedStages.map(shift);
    const touched = s.clearedStages.some((k) => M1T0_RE.test(k));
    const intro = Array.from({ length: V7_INTRO_STAGES }, (_, i) => `m1t0s${i + 1}`);
    out.clearedStages = touched ? [...intro, ...shifted] : shifted;
  }
  if (s.attempts && typeof s.attempts === 'object') {
    out.attempts = Object.fromEntries(Object.entries(s.attempts).map(([k, v]) => [shift(k), v]));
  }
  if (typeof s.refarmKey === 'string') out.refarmKey = shift(s.refarmKey);
  if (Array.isArray(s.fameClaimed)) out.fameClaimed = s.fameClaimed.map(shift);
  return out as T;
}

function migrateAcupointIdsV2ToV3<T>(state: T): T {
  const s = state as {
    acupointProgress?: Record<string, unknown>;
    acupointLog?: string[];
  };
  if (!s || typeof s !== 'object') return state;

  const progress = s.acupointProgress;
  const nextProgress = progress
    ? Object.fromEntries(
        Object.entries(progress).map(([id, v]) => [ACUPOINT_ID_V2_TO_V3[id] ?? id, v])
      )
    : progress;

  const log = s.acupointLog;
  const nextLog = Array.isArray(log)
    ? [...new Set(log.map(id => ACUPOINT_ID_V2_TO_V3[id] ?? id))]
    : log;

  return { ...s, acupointProgress: nextProgress, acupointLog: nextLog } as T;
}

export function resetGame(): void {
  store.removeItem(SAVE_KEY);
}

/** 上次持久化时间戳（离线时长权威来源）；无存档或旧格式损坏返回 null */
export function loadSavedAt(): number | null {
  const raw = store.getItem(SAVE_KEY);
  if (!raw) return null;
  try {
    const at = (JSON.parse(raw) as { savedAt?: unknown }).savedAt;
    return typeof at === 'number' && Number.isFinite(at) ? at : null;
  } catch {
    return null;
  }
}

/** 验收调试：把当前存档时间戳回拨 N 秒（#offlinesim），模拟离线时段；无存档时不动 */
export function backdateSavedAt(seconds: number): void {
  const raw = store.getItem(SAVE_KEY);
  if (!raw) return;
  try {
    const parsed = JSON.parse(raw) as { savedAt?: number };
    if (typeof parsed.savedAt !== 'number') return;
    parsed.savedAt -= seconds * 1000;
    store.setItem(SAVE_KEY, JSON.stringify(parsed));
  } catch { /* 存档损坏时保持原样，交给 loadGame 的兜底 */ }
}

/**
 * A4 验收调试通道：临时压低离线上限（分钟），跨关页/重开持久生效；null 清除。
 * 非正式配置——正式验收记录中 debug_cap 位必须裸露（offline_settled 事件同名字段）。
 */
export function setDebugOfflineCap(min: number | null): void {
  if (min === null || !Number.isFinite(min) || min <= 0) store.removeItem(DEBUG_OFFLINE_CAP_KEY);
  else store.setItem(DEBUG_OFFLINE_CAP_KEY, String(min));
}

export function getDebugOfflineCap(): number | null {
  const raw = store.getItem(DEBUG_OFFLINE_CAP_KEY);
  const n = raw === null ? NaN : Number(raw);
  return Number.isFinite(n) && n > 0 ? n : null;
}

export function loadLiveTestWindow(): LiveTestWindowRecord | null {
  const raw = store.getItem(LIVE_TEST_WINDOW_KEY);
  if (!raw) return null;
  try {
    const value = JSON.parse(raw) as Partial<LiveTestWindowRecord>;
    if (typeof value.windowId !== 'string' || value.windowId.length === 0) return null;
    if (typeof value.startedAt !== 'number' || !Number.isFinite(value.startedAt)) return null;
    if (typeof value.tablesVersionStarted !== 'string' || value.tablesVersionStarted.length === 0) return null;
    return { windowId: value.windowId, startedAt: value.startedAt, tablesVersionStarted: value.tablesVersionStarted };
  } catch {
    return null;
  }
}

export function startLiveTestWindow(tablesVersion: string, now = Date.now()): LiveTestWindowRecord {
  const active = loadLiveTestWindow();
  if (active) return active;
  const record: LiveTestWindowRecord = {
    windowId: `nw-${now}-${Math.random().toString(36).slice(2, 10)}`,
    startedAt: now,
    tablesVersionStarted: tablesVersion,
  };
  store.setItem(LIVE_TEST_WINDOW_KEY, JSON.stringify(record));
  return record;
}

export function endLiveTestWindow(): LiveTestWindowRecord | null {
  const active = loadLiveTestWindow();
  if (active) store.removeItem(LIVE_TEST_WINDOW_KEY);
  return active;
}

/** Focused test seam; live-test state is intentionally independent from game reset. */
export function resetLiveTestWindowForTests(): void {
  store.removeItem(LIVE_TEST_WINDOW_KEY);
}

/** 秘籍阁三本真传 → 同路数上乘内功（sect-neigong/spec.md §6.2 补偿） */
const TRUE_BOOK_ROUTE: Record<string, RouteId> = {
  true_jinglei: 'huashan', true_zhenyue: 'shaolin', true_shigu: 'tangmen',
};

/**
 * v7 → v8（sect-neigong/spec.md §6.2）：
 * - 当前路线 → 所修内功 = 该路数寻常内功；三部寻常内功全部视为已拥有；
 * - 武学等级 n → 内功重数 n；机制节点丢弃，台阶按重数直接视为已过（不再判顿悟）；
 * - 秘籍阁集齐的真传 → 拥有同路数上乘内功；其余残页、遗篇与换线计数丢弃；
 * - 阅历保留数值（冻结）；悟性从中位 1.0 起步，下一世再随机。
 */
/** v18 → v19：补世界种子与空的名册干预（旧存档没有击败记录可折，江湖从这一世起推演） */
export function migrateRosterV18ToV19<T>(state: T): T {
  const s = state as Record<string, unknown>;
  return {
    ...s,
    worldSeed: typeof s.worldSeed === 'number' && s.worldSeed > 0 ? s.worldSeed : newWorldSeed(),
    rosterKills: Array.isArray(s.rosterKills) ? s.rosterKills : [],
    lifeDefeats: Array.isArray(s.lifeDefeats) ? s.lifeDefeats : [],
  } as T;
}

/** 旧九派 → 新门派（sect-overhaul/design.md §6） */
const SECT_V19_TO_V20: Readonly<Record<string, SectId>> = {
  huashan: 'cangya', shaolin: 'qianyan', tangmen: 'huaying', gaibang: 'qianfan', wudang: 'qianyuan',
  emei: 'shuiyue', kongtong: 'fenglei', yanmen: 'cangwu', baigu: 'zhangyue',
};

/**
 * v19 → v20（门派改造）：所拜门派换成新 id（不认识的置空）；差事「短 / 长」换成一档 2 / 8 小时；
 * 补本世累计贡献与地位；拜山传闻的键由图序改为卷号；新四路的占位内功剔除。编年里的旧派名不改。
 */
export function migrateSectV19ToV20<T>(state: T): T {
  const s = state as Record<string, unknown>;
  if (!s || typeof s !== 'object') return state;
  const out = { ...s };
  if ('sect' in s) {
    out.sect = typeof s.sect === 'string' ? SECT_V19_TO_V20[s.sect] ?? null : null;
    out.sectGearBought = [];
  }
  const task = s.sectTask as { kind?: string; endsAt: number } | null | undefined;
  if (task && typeof task === 'object' && 'kind' in task) {
    out.sectTask = { tier: 1, hours: task.kind === 'long' ? 8 : 2, endsAt: task.endsAt };
  }
  if ('contrib' in s) {
    const total = typeof s.contrib === 'number' ? s.contrib : 0;
    out.contribTotal = total;
    out.sectRank = rankOf(total);
  }
  if (typeof s.rumorPending === 'number' && s.rumorPending > 0) out.rumorPending = s.rumorPending + 1;
  if (Array.isArray(s.ownedNeigong)) out.ownedNeigong = (s.ownedNeigong as string[]).filter((id) => id in NEIGONG);
  return out as T;
}

export function migrateNeigongV7ToV8<T>(state: T): T {
  const s = state as Record<string, unknown>;
  if (!s || typeof s !== 'object') return state;
  // 只迁移真带着门径字段的存档：补出新键会在 {...FRESH, ...saved} 合并时盖掉默认值（同 v6→v7 口径）
  if (!('route' in s) && !('skillLevel' in s)) return state;
  const out: Record<string, unknown> = { ...s };
  const route = (s.route ?? null) as RouteId | null;
  const zhong = typeof s.skillLevel === 'number' ? s.skillLevel : 0;
  const owned: NeigongId[] = [...STARTER_NEIGONG];
  for (const b of Array.isArray(s.completedBooks) ? (s.completedBooks as string[]) : []) {
    const r = TRUE_BOOK_ROUTE[b];
    if (r) owned.push(neigongOf(r, '上乘'));
  }
  out.neigong = route ? neigongOf(route, '寻常') : null;
  out.zhong = route ? zhong : 0;
  out.tiersPassed = route ? TIERS.slice(0, 3).filter((t) => zhong >= t.at).length : 0;
  out.dunwuSec = 0;
  out.ownedNeigong = owned;
  out.wuxing = 1;
  // 老玩家熟悉声望阁；新出现的内功页签留金点
  out.seenTabs = ['rep'];
  for (const k of ['skillLevel', 'ownedMechNodes', 'mechXpInvested', 'switchCount',
    'collectedPages', 'completedBooks', 'shopPurchasesThisRun']) delete out[k];
  return out as T;
}

// ---------------------------------------------------------------- v17 → v18：卷章图关

/** v17 关卡表（图 × 难度 × 关）的类别与当量，冻结于迁移旁（新表已不含三档） */
const V17_STAGES = legacyV17 as unknown as Record<string, [string, number][]>;
const V17_KEY = /^(stage:)?m(\d)t(\d)s(\d+)$/;
/** 原段末 Boss 深浅（难度 × 10 + 图序）→ 卷：按 Boss 所在境界段的末卷 */
const V17_DEPTH_TO_VOL: Record<number, number> = { 1: 4, 2: 6, 11: 6, 3: 8, 12: 8, 21: 8, 4: 10, 13: 10, 22: 10 };
/** 原 Boss 首杀必掉的前沿键 → 新卷键（与 wuxue.BOSS_DROPS 同一映射） */
const V17_DROP_TO_VOL: Record<string, string> = { '1-0': 'v4', '1-1': 'v5', '2-0': 'v6', '3-0': 'v7', '1-2': 'v8', '2-1': 'v9' };

function v17Stage(key: string): { kind: string; x: number } | null {
  const m = V17_KEY.exec(key);
  const row = m ? V17_STAGES[`${m[2]}-${m[3]}`]?.[Number(m[4]) - 1] : undefined;
  return row ? { kind: row[0], x: row[1] } : null;
}

/**
 * v17 → v18：三档难度取消、改为卷章图关单线（living-jianghu/design.md §2.2）。按当量折算：
 * - 本世已过：取旧进度打到的最高当量 F，新表从卷一起按开放次序，当量不超过 F 的关依次记为已过（每张图从第 1 关连续）；
 * - 已开放的图（跨世）：旧已解锁前沿中起点最深者的起点当量 U，新表按开放次序开到起点不超过 U 的图；
 * - 首杀（跨世）：每个旧精英 / Boss 首杀换成新表里当量最接近、尚未占用的同类关卡，侠名录计数不变；
 * - 历来最深 Boss 与 Boss 必掉记录：按境界段换成卷；挂机：换到不超过原挂机关当量的最高一关已过关卡；尝试次数清空。
 */
function migrateStageLineV17ToV18<T>(state: T): T {
  const s = { ...(state as Record<string, unknown>) };
  const EPS = 1e-9;
  const xs = (keys: unknown) => (Array.isArray(keys) ? keys : []).map((k) => v17Stage(String(k))).filter((r) => r !== null);

  // 本世已过
  const F = Math.max(-Infinity, ...xs(s.clearedStages).map((r) => r.x));
  const cleared: string[] = [];
  if (F > -Infinity) {
    const open = new Set<number>([1]);
    for (const id of MAP_IDS) {
      if (!open.has(id)) continue;
      let all = true;
      for (let st = 1; st <= trackLength(id); st++) {
        if ((getStage(id, st).x ?? 0) > F + EPS) { all = false; break; }
        cleared.push(stageKey(id, st));
      }
      if (all) unlocksAfterMap(id).forEach((n) => open.add(n));
    }
  }
  s.clearedStages = cleared;

  // 已开放的图
  const tiers = Array.isArray(s.tiersUnlocked) ? (s.tiersUnlocked as string[]) : ['1-0'];
  const U = Math.max(...tiers.map((t) => V17_STAGES[t]?.[0]?.[1] ?? -Infinity), getStage(1, 1).x ?? 1);
  const opened = new Set<number>([1]);
  for (const id of MAP_IDS) {
    const full = cleared.includes(stageKey(id, trackLength(id)));
    if (!opened.has(id) && !full) continue;
    if (full || (getStage(id, 1).x ?? 0) <= U + EPS) unlocksAfterMap(id).filter((n) => full || (getStage(n, 1).x ?? 0) <= U + EPS).forEach((n) => opened.add(n));
  }
  s.mapsUnlocked = [...opened].sort((a, b) => a - b);
  delete s.tiersUnlocked;

  // 首杀
  const fame = Array.isArray(s.fameClaimed) ? (s.fameClaimed as string[]) : [];
  const pool = allStages().filter((e) => e.kind !== 'normal');
  const used = new Set<string>();
  const newFame: string[] = [];
  const olds = fame.map((k) => ({ k, r: v17Stage(k) })).sort((a, b) => (a.r?.x ?? 0) - (b.r?.x ?? 0));
  for (const { k, r } of olds) {
    if (!r) { newFame.push(k); continue; }
    const kind = r.kind === 'b' ? 'boss' : 'elite';
    const best = pool
      .filter((e) => e.kind === kind && !used.has(stageKey(e.map, e.stage)))
      .sort((a, b) => Math.abs((a.x ?? 0) - r.x) - Math.abs((b.x ?? 0) - r.x))[0];
    if (best) { used.add(stageKey(best.map, best.stage)); newFame.push(`stage:${stageKey(best.map, best.stage)}`); }
  }
  s.fameClaimed = newFame;

  if (typeof s.deepestBossEver === 'number') s.deepestBossEver = V17_DEPTH_TO_VOL[s.deepestBossEver] ?? 0;
  if (Array.isArray(s.dropsClaimed)) s.dropsClaimed = (s.dropsClaimed as string[]).map((k) => V17_DROP_TO_VOL[k] ?? k);

  // 挂机
  const idle = s.idle as { map?: number; tier?: number; stage?: number } | null | undefined;
  if (idle && typeof idle.map === 'number') {
    const ix = v17Stage(`m${idle.map}t${idle.tier ?? 0}s${idle.stage}`)?.x ?? -Infinity;
    const best = cleared.map((k) => { const [m, st] = k.slice(1).split('s').map(Number); return { m, st, x: getStage(m, st).x ?? 0 }; })
      .filter((c) => c.x <= ix + EPS).sort((a, b) => b.x - a.x)[0];
    const { tier: _tier, ...rest } = idle;
    s.idle = best ? { ...rest, map: best.m, stage: best.st } : null;
  }
  s.attempts = {};
  return s as T;
}
