/**
 * 侠名录 —— 二十二条成就线，三层被动（prestige-shop/design.md §2c）。
 * 计量达标即点亮，跨世累计、永久生效；不花声望、不给名号声望。层级以徽记材质表示：铜 / 银 / 金。
 *
 * 计量分两类：
 *   - 计数（存档 `achv`）：胜场、冲穴、招式圆满、门派任务、黑市、银两、养伤、战败——发生时累加；
 *   - 推导（从已有存档字段数）：头目 / 精英 / 经脉（fameClaimed）、残页（拼齐的口诀）、阅历（收得武学门数）、转世（run − 1）。
 * 门槛由真实代码的模拟玩家标定：标准玩家约第 7 / 21 / 50 天摸到一二三层（`telemetry/achv.sim.test.ts`，
 * 实测 `docs/systems/sim/achv_measured.json`，2026-10-19）。九类器械按主修类目的胜场定，挂机场次多，门槛高。
 */
import { isBossKey, isEliteKey } from './prestige';
import { WUXUE, type WuxueCat, type WuxueId } from './wuxue';

export type AchvId =
  | 'jian' | 'dao' | 'qiang' | 'gun' | 'quan' | 'zhang' | 'zhi' | 'tui' | 'anqi'
  | 'boss' | 'elite' | 'jingmai' | 'chongxue' | 'zhaoshi' | 'canye' | 'menpai' | 'heishi'
  | 'yinliang' | 'yueli' | 'yangshang' | 'zhanbai' | 'zhuanshi';

/** 存档里累加的计数 */
export type AchvCounts = Partial<Record<AchvId, number>>;

export interface AchvDef {
  id: AchvId;
  /** 三层名（铜 / 银 / 金） */
  tiers: [string, string, string];
  /** 计量名（悬停「下一级：名 · 计量 n/门槛」） */
  what: string;
  /** 三层门槛 */
  th: [number, number, number];
  /** 三层效果值（含义见 eff 文案） */
  val: [number, number, number];
  /** 效果文案，{v} 换成当前层的值 */
  eff: string;
}

/** 兵器 / 肉身 / 暗器九类：按装配武学的类目计胜场 */
export const CAT_ACHV: Record<WuxueCat, AchvId> = {
  剑: 'jian', 刀: 'dao', 枪: 'qiang', 棍: 'gun', 拳: 'quan', 掌: 'zhang', 指: 'zhi', 腿: 'tui', 暗器: 'anqi',
};

const CAT_TH: [number, number, number] = [1000, 8000, 50000];
const CAT_VAL: [number, number, number] = [0.10, 0.20, 0.30];
const cat = (id: AchvId, name: string, tiers: [string, string, string]): AchvDef =>
  ({ id, tiers, what: `${name}胜场`, th: CAT_TH, val: CAT_VAL, eff: `${name}伤害 +{v}` });

export const ACHV: AchvDef[] = [
  cat('jian', '剑法', ['初窥剑意', '剑气纵横', '人剑合一']),
  cat('dao', '刀法', ['快刀斩麻', '大刀阔斧', '刀罡无影']),
  cat('qiang', '枪法', ['横枪跃马', '单枪匹马', '枪出如龙']),
  cat('gun', '棍法', ['棍起生风', '横扫千军', '棍压群雄']),
  cat('quan', '拳法', ['拳不离手', '拳拳到肉', '拳开山岳']),
  cat('zhang', '掌法', ['掌风初成', '排山倒海', '掌震乾坤']),
  cat('zhi', '指法', ['指上功夫', '指点江山', '弹指惊雷']),
  cat('tui', '腿法', ['身轻如燕', '飞檐走壁', '踏雪无痕']),
  cat('anqi', '暗器', ['例无虚发', '百步穿杨', '百发百中']),
  { id: 'boss', tiers: ['破关斩将', '势如破竹', '摧枯拉朽'], what: '首杀头目', th: [8, 14, 18], val: [0.05, 0.10, 0.15], eff: '头目伤害 +{v}' },
  { id: 'elite', tiers: ['小有名气', '声名远播', '名动江湖'], what: '首杀精英', th: [27, 44, 58], val: [0.15, 0.30, 0.50], eff: '名号声望 +{v}' },
  { id: 'jingmai', tiers: ['气走周天', '脱胎换骨', '返璞归真'], what: '贯通经脉', th: [2, 3, 4], val: [0.15, 0.30, 0.50], eff: '经脉声望 +{v}' },
  { id: 'chongxue', tiers: ['运气如常', '举重若轻', '游刃有余'], what: '冲穴次数', th: [35, 120, 220], val: [0.02, 0.04, 0.06], eff: '冲穴耗内力 −{v}' },
  { id: 'zhaoshi', tiers: ['勤学苦练', '触类旁通', '融会贯通'], what: '招式圆满', th: [5, 20, 60], val: [0.20, 0.35, 0.50], eff: '熟练增速 +{v}' },
  { id: 'canye', tiers: ['零敲碎打', '拾遗补阙', '集腋成裘'], what: '拼齐口诀', th: [1, 20, 90], val: [0.20, 0.35, 0.50], eff: '残页掉率 +{v}' },
  { id: 'menpai', tiers: ['初入师门', '论功行赏', '栋梁之材'], what: '门派任务', th: [2, 18, 90], val: [0.10, 0.20, 0.30], eff: '门派贡献 +{v}' },
  { id: 'heishi', tiers: ['探头探脑', '暗度陈仓', '轻车熟路'], what: '黑市购买', th: [5, 30, 100], val: [2, 4, 6], eff: '蒙面货每世 +{v} 件' },
  { id: 'yinliang', tiers: ['积少成多', '日进斗金', '富甲一方'], what: '累计银两', th: [60_000, 500_000, 5_000_000], val: [0.10, 0.20, 0.30], eff: '银两掉落 +{v}' },
  // 阅历本版冻结（sect-neigong/spec.md §4.4），原「累计阅历」点不亮——改计收得武学门数，效果改整式掉率（design.md §2c 实装二改）
  { id: 'yueli', tiers: ['略知一二', '见多识广', '博古通今'], what: '收得武学', th: [25, 40, 55], val: [0.10, 0.20, 0.30], eff: '武学整式掉率 +{v}' },
  { id: 'yangshang', tiers: ['养精蓄锐', '妙手回春', '金刚不坏'], what: '养好的伤', th: [5, 15, 50], val: [0.20, 0.35, 0.50], eff: '伤势恢复 +{v}' },
  { id: 'zhanbai', tiers: ['屡败屡战', '全身而退', '百折不挠'], what: '战败次数', th: [6, 30, 100], val: [1, 2, 3], eff: '每世免伤 {v} 次' },
  { id: 'zhuanshi', tiers: ['初露锋芒', '名扬四海', '威震武林'], what: '转世次数', th: [6, 18, 26], val: [0.02, 0.04, 0.06], eff: '基础声望 +{v}' },
];
export const ACHV_MAP: Record<AchvId, AchvDef> = Object.fromEntries(ACHV.map((a) => [a.id, a])) as Record<AchvId, AchvDef>;

/** 推导计量要读的存档字段 */
export interface AchvSource {
  achv?: AchvCounts;
  fameClaimed?: readonly string[];
  pages?: readonly string[];
  ownedWuxue?: readonly WuxueId[];
  run?: number;
  /** 退出购买的旧传承（存档 v12 迁移记下）：至少给对应成就一层 */
  retiredNodes?: readonly string[];
}

/** 旧传承 → 成就一层（economy.md §4 v2.5）：武道笔记 / 师门指引并入招式，破关心得并入头目 */
const RETIRED_FLOOR: Record<string, AchvId> = { wudao_biji: 'zhaoshi', shimen_zhiyin: 'zhaoshi', poguan_xinde: 'boss' };

/** 某条线当前的计量 */
export function achvCount(s: AchvSource, id: AchvId): number {
  switch (id) {
    case 'boss': return (s.fameClaimed ?? []).filter((k) => k.startsWith('stage:') && isBossKey(k.slice(6))).length;
    case 'elite': return (s.fameClaimed ?? []).filter((k) => k.startsWith('stage:') && isEliteKey(k.slice(6))).length;
    case 'jingmai': return (s.fameClaimed ?? []).filter((k) => k.startsWith('meridian:')).length;
    case 'canye': return (s.pages ?? []).filter((k) => WUXUE[k.split(':')[0] as WuxueId] !== undefined).length;
    case 'yueli': return (s.ownedWuxue ?? []).length;
    case 'zhuanshi': return Math.max(0, (s.run ?? 1) - 1);
    default: return s.achv?.[id] ?? 0;
  }
}

/** 某条线当前的层（0–3） */
export function achvTier(s: AchvSource, id: AchvId): number {
  const a = ACHV_MAP[id];
  const c = achvCount(s, id);
  const tier = a.th.filter((t) => c >= t).length;
  const floor = (s.retiredNodes ?? []).some((n) => RETIRED_FLOOR[n] === id) ? 1 : 0;
  return Math.max(tier, floor);
}

/** 只供 sim 排查：关掉指定线的效果（计量照记）。`telemetry/simBot.ts` 读 ACHV_OFF 设置 */
const OFF = new Set<AchvId>();
export function setAchvOff(ids: readonly AchvId[]): void {
  OFF.clear();
  for (const id of ids) OFF.add(id);
}

/** 某条线当前生效的值（未点亮为 0） */
export function achvVal(s: AchvSource, id: AchvId): number {
  if (OFF.has(id)) return 0;
  const t = achvTier(s, id);
  return t === 0 ? 0 : ACHV_MAP[id].val[t - 1];
}

/** 某类武学的伤害加成 */
export function catDmgBonus(s: AchvSource, c: WuxueCat): number {
  return achvVal(s, CAT_ACHV[c]);
}

/** 效果文案（悬停第一行）：比例值写百分数，件 / 次写整数 */
export function achvEffText(a: AchvDef, tier: number): string {
  const v = a.val[tier - 1];
  const txt = Number.isInteger(v) ? String(v) : `${Math.round(v * 100)}%`;
  return a.eff.replace('{v}', txt);
}

/** 累加计数，返回新的 `achv` 与本次跨过的层（供埋点） */
export function bumpAchv(
  s: AchvSource, add: AchvCounts,
): { achv: AchvCounts; ups: { id: AchvId; tier: number }[] } {
  const achv: AchvCounts = { ...(s.achv ?? {}) };
  const ups: { id: AchvId; tier: number }[] = [];
  for (const [id, n] of Object.entries(add) as [AchvId, number][]) {
    if (!n) continue;
    const before = achvTier({ ...s, achv }, id);
    achv[id] = (achv[id] ?? 0) + n;
    const after = achvTier({ ...s, achv }, id);
    if (after > before) ups.push({ id, tier: after });
  }
  return { achv, ups };
}

/** 装配武学的类目（去重）：一场胜利给每个类目各记一场 */
export function equippedCats(equipped: readonly WuxueId[] | undefined): WuxueCat[] {
  return [...new Set((equipped ?? []).map((id) => WUXUE[id]?.cat).filter((c): c is WuxueCat => !!c))];
}

/** 胜 n 场时各类目要加的计数 */
export function winCounts(equipped: readonly WuxueId[] | undefined, n: number): AchvCounts {
  return Object.fromEntries(equippedCats(equipped).map((c) => [CAT_ACHV[c], n]));
}
