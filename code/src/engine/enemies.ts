/**
 * 五地图 48 关敌人表 —— 权威来源：docs/rules/content.md §2；
 * 数据由 content.ts 与 mvp2Content.ts 导出。
 * 生成公式与 sim/mvp0_sim.py build_stages() 逐行对齐（含 Python banker's rounding），
 * golden 测试会对照 fixture 中的敌人属性逐数校验。禁止在此调参。
 */
import { MVP2_STAGE_ENEMIES, MVP2_MAP_REWARD_PLANS, MVP2_BOSS_VALUES, MVP2_BOSS_REWARDS } from './mvp2Content';

export type EnemyTag = '高血' | '高闪' | '破甲' | '反伤' | '毒' | '净化' | '高防' | '高攻' | '狂暴';

export interface EnemyDef {
  map: 1 | 2 | 3 | 4 | 5;
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
  reward: { neili: number; silver: number; xp: number };
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

const MAP_NAMES = ['村外小径', '洛阳近郊', '华山古道', '蜀道险关', '铁壁绝谷'] as const;
export function mapName(map: 1 | 2 | 3 | 4 | 5): string {
  return MAP_NAMES[map - 1];
}
export const MAP_STAGE_COUNT: Record<1 | 2 | 3 | 4 | 5, number> = { 1: 8, 2: 10, 3: 10, 4: 10, 5: 10 };

const NAMES_1 = ['拦路泼皮', '拦路泼皮', '山野猎户', '山野猎户', '山贼喽啰', '山贼喽啰', '山贼小头目', '山贼头目'];
const NAMES_2 = ['城郊恶棍', '城郊恶棍', '镖局逃卒', '游侠儿', '镖局逃卒', '恶寺武僧', '铁臂僧', '恶寺武僧', '恶寺护法', '铁掌恶僧'];
const NAMES_3 = ['古道剑客', '古道剑客', '荆棘武者', '落魄镖师', '五毒散人', '黑风寨卒', '清风道人', '黑风寨卒', '黑风副寨主', '黑风寨主'];

function rec1(i: number): number { return i <= 4 ? 1 : i <= 7 ? 2 : 3; }
function rec2(i: number): number { return i <= 9 ? 3 : 4; }
function rec3(i: number): number { return i <= 7 ? 4 : 5; }

function buildStages(): EnemyDef[] {
  const out: EnemyDef[] = [];
  // 地图 1：8 关（Boss@8）
  for (let i = 1; i <= 8; i++) {
    let e = {
      hp: pyRound(25 * 1.28 ** (i - 1)), atk: pyRound(4 * 1.17 ** (i - 1), 1),
      def: pyRound(2 * 1.15 ** (i - 1), 1), hit: 90 + 2 * i, dodge: 8, tags: [] as EnemyTag[],
    };
    let reward = { neili: 60, silver: 10, xp: 3 };
    let kind: EnemyDef['kind'] = 'normal';
    if (i === 8) {
      e = { hp: 550, atk: 15, def: 10, hit: 112, dodge: 8, tags: ['高血'] };
      reward = { neili: 250, silver: 60, xp: 30 };
      kind = 'boss';
    }
    out.push({ map: 1, stage: i, name: NAMES_1[i - 1], ...e, kind, recommendedRealm: rec1(i), reward });
  }
  // 地图 2：10 关，精英@4(高闪)/@7(破甲)，Boss@10
  for (let i = 1; i <= 10; i++) {
    const e = {
      hp: pyRound(115 * 1.15 ** (i - 1)), atk: pyRound(11 * 1.1 ** (i - 1), 1),
      def: pyRound(9 * 1.12 ** (i - 1), 1), hit: 105 + 2 * i, dodge: 12, tags: [] as EnemyTag[],
    };
    let reward = { neili: 150, silver: 20, xp: 5 };
    let kind: EnemyDef['kind'] = 'normal';
    if (i === 4) { e.tags = ['高闪']; e.dodge = 50; e.hp = pyRound(e.hp * 1.4); reward = { neili: 300, silver: 40, xp: 10 }; kind = 'elite'; }
    if (i === 7) { e.tags = ['破甲']; e.hp = pyRound(e.hp * 1.4); reward = { neili: 300, silver: 40, xp: 10 }; kind = 'elite'; }
    if (i === 10) {
      Object.assign(e, { hp: 950, atk: 34, def: 55, hit: 132, dodge: 14, tags: ['高防', '高攻'] as EnemyTag[] });
      reward = { neili: 800, silver: 120, xp: 50 };
      kind = 'boss';
    }
    out.push({ map: 2, stage: i, name: NAMES_2[i - 1], ...e, kind, recommendedRealm: rec2(i), reward });
  }
  // 地图 3：10 关，精英@3(反伤)/@5(毒)/@7(净化)，Boss@10
  for (let i = 1; i <= 10; i++) {
    const e = {
      hp: pyRound(340 * 1.14 ** (i - 1)), atk: pyRound(24 * 1.07 ** (i - 1), 1),
      def: pyRound(20 * 1.1 ** (i - 1), 1), hit: 130 + 2 * i, dodge: 16, tags: [] as EnemyTag[],
    };
    let reward = { neili: 300, silver: 30, xp: 8 };
    let kind: EnemyDef['kind'] = 'normal';
    if (i === 3) { e.tags = ['反伤']; e.hp = pyRound(e.hp * 1.4); reward = { neili: 500, silver: 60, xp: 15 }; kind = 'elite'; }
    if (i === 5) { e.tags = ['毒']; e.hp = pyRound(e.hp * 1.3); reward = { neili: 500, silver: 60, xp: 15 }; kind = 'elite'; }
    if (i === 7) { e.tags = ['净化']; e.hp = pyRound(e.hp * 1.4); reward = { neili: 500, silver: 60, xp: 15 }; kind = 'elite'; }
    if (i === 10) {
      Object.assign(e, { hp: 2500, atk: 46, def: 35, hit: 152, dodge: 18, tags: ['高血', '狂暴'] as EnemyTag[] });
      reward = { neili: 1500, silver: 200, xp: 80 };
      kind = 'boss';
    }
    out.push({ map: 3, stage: i, name: NAMES_3[i - 1], ...e, kind, recommendedRealm: rec3(i), reward });
  }
  return out;
}

/** MVP-2A 地图 4/5 stages 1-9 + Boss 4/5 stage 10：从 mvp2Content.ts 导出的 Mvp2StageEnemy 与 MVP2_BOSS_VALUES 转为 EnemyDef。 */
let _mvp2Stages: EnemyDef[] | null = null;
function getMvp2Stages(): EnemyDef[] {
  if (_mvp2Stages !== null) return _mvp2Stages;
  const stages: EnemyDef[] = MVP2_STAGE_ENEMIES.map((entry) => {
    const plan = MVP2_MAP_REWARD_PLANS.find((p) => p.map === entry.map)!;
    const reward = entry.kind === 'elite' ? plan.elite : plan.normal;
    return {
      map: entry.map,
      stage: entry.stage,
      name: entry.name,
      hp: entry.hp,
      atk: entry.atk,
      def: entry.def,
      hit: entry.hit,
      dodge: entry.dodge,
      tags: [...entry.tags],
      kind: entry.kind,
      recommendedRealm: entry.recommendedRealm,
      reward,
    };
  });
  // Boss 4/5 stage 10（content.md §8.2 战斗值 + §9.3 击杀奖励）
  for (const boss of MVP2_BOSS_VALUES) {
    const reward = MVP2_BOSS_REWARDS.find((r) => r.boss === boss.boss)!;
    stages.push({
      map: boss.boss,
      stage: 10,
      name: boss.name,
      hp: boss.hp,
      atk: boss.atk,
      def: boss.def,
      hit: boss.hit,
      dodge: boss.dodge,
      tags: [...boss.tags],
      kind: 'boss',
      recommendedRealm: boss.boss === 4 ? 6 : 7,
      reward: { neili: reward.neili, silver: reward.silver, xp: reward.xp },
    });
  }
  _mvp2Stages = stages;
  return _mvp2Stages;
}

/**
 * STAGES 只含 MVP-0 三地图 28 关——prestige.ts 既有 ELITE_KEYS/TOTAL_STAGES 计算依赖此口径
 * （`docs/rules/economy.md §1.2` 三图全通 +30% 表现加成）。MVP-2 地图 4/5 stages 1-9 通过
 * `getStage()` lazy 合并查询，避免循环依赖初始化与 MVP-0 既有声望判据破坏。
 */
export const STAGES: readonly EnemyDef[] = buildStages();

export function getStage(map: 1 | 2 | 3 | 4 | 5, stage: number): EnemyDef {
  const s = (map === 4 || map === 5)
    ? getMvp2Stages().find((x) => x.map === map && x.stage === stage)
    : STAGES.find((x) => x.map === map && x.stage === stage);
  if (!s) throw new Error(`no stage m${map}s${stage}`);
  return s;
}

/** 埋点 target ID（埋点规格 §1.3）：boss1/boss2/boss3、elite_m2s4、m3s6 */
export function targetId(e: EnemyDef): string {
  if (e.kind === 'boss') return `boss${e.map}`;
  if (e.kind === 'elite') return `elite_m${e.map}s${e.stage}`;
  return `m${e.map}s${e.stage}`;
}

/** 回刷收益（公式表 §6）：内力 20% / 银两 50% / 阅历 0 */
export function refarmReward(e: EnemyDef): { neili: number; silver: number; xp: number } {
  return { neili: Math.round(e.reward.neili * 0.2), silver: Math.round(e.reward.silver * 0.5), xp: 0 };
}
