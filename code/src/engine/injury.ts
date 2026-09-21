/**
 * 受伤系统 —— 权威来源：docs/systems/injury/spec.md
 * 纯函数模块：不引入 UI/存储依赖；不修改 combat.ts 的 fight()，
 * 伤势只在战斗前叠加到 Build 上（仿 applyFragmentEffectsToBuild，spec §0 红线）。
 */
import type { Build } from './combat';
import type { EnemyDef } from './enemies';

/** 伤型 ID（spec §1 伤型表；新增伤型只加一行，机制骨架不变） */
export const INJURY_IDS = ['wai', 'nei', 'du'] as const;
export type InjuryId = (typeof INJURY_IDS)[number];

/** 严重度：0=无 1=轻 2=中 3=重；越过 3 即致死（spec §2 / §4） */
export type Severity = 0 | 1 | 2 | 3;
export const SEVERITY_LETHAL = 4;

export interface InjuryDef {
  id: InjuryId;
  name: string;
  /** 修炼影响权重：乘在严重度压制值上，得出挂机产出压制（spec §1） */
  idleWeight: number;
}

/** 表 1：伤型表（spec §1） */
export const INJURY_DEFS: Record<InjuryId, InjuryDef> = {
  wai: { id: 'wai', name: '外伤', idleWeight: 0.25 },
  nei: { id: 'nei', name: '内伤', idleWeight: 0.75 },
  du:  { id: 'du',  name: '毒伤', idleWeight: 0.45 },
};

/** 表 2：严重度表（spec §2）——战力压制值与自愈时长（游戏内分钟，降一档） */
export const SEVERITY_PRESS: Record<Exclude<Severity, 0>, number> = { 1: 0.10, 2: 0.25, 3: 0.45 };
export const SEVERITY_HEAL_MIN: Record<Exclude<Severity, 0>, number> = { 1: 3, 2: 8, 3: 20 };
export const SEVERITY_NAME: Record<Severity, string> = { 0: '无', 1: '轻', 2: '中', 3: '重' };

/** 挂机产出地板（spec §3）——防止多重伤把修炼归零 */
export const IDLE_FLOOR = 0.40;

/** 惨胜血线（spec §4）——关键战通关后余血低于此值留伤 */
export const PYRRHIC_HP_PCT = 0.25;

/** 折寿（spec §6）——升入重度时一次性折损的寿元年数 */
export const LIFESPAN_LOSS_HEAVY = 15;

/** 境界自愈修正（spec §5）——修为越高自愈略快，下限 0.5 */
export function healRealmFactor(realm: number): number {
  return Math.max(0.5, 1 - 0.05 * (realm - 1));
}

/** 单处伤势的运行时状态 */
export interface InjuryState {
  severity: Severity;
  /** 当前档位已累积的自愈分钟数 */
  healAccMin: number;
}

/** 全身伤势（按伤型索引） */
export type Injuries = Record<InjuryId, InjuryState>;

export function freshInjuries(): Injuries {
  return {
    wai: { severity: 0, healAccMin: 0 },
    nei: { severity: 0, healAccMin: 0 },
    du:  { severity: 0, healAccMin: 0 },
  };
}

export function isHurt(inj: Injuries): boolean {
  return INJURY_IDS.some((id) => inj[id].severity > 0);
}

/** 受一次创的结果（spec §4 / §6） */
export interface InflictResult {
  injuries: Injuries;
  /** 本次是否升入重度（触发折寿） */
  becameHeavy: boolean;
  /** 本次是否越过致死线（触发强制转世） */
  lethal: boolean;
  /** 本次折损的寿元年数 */
  lifespanLost: number;
}

/**
 * 受一次创：该伤型 severity +1；升入重度折寿；越致死线返回 lethal（spec §4 / §6）。
 * 单严重度轴升降，不叠层。
 */
export function inflict(inj: Injuries, id: InjuryId): InflictResult {
  const next = inj[id].severity + 1;
  if (next >= SEVERITY_LETHAL) {
    return { injuries: inj, becameHeavy: false, lethal: true, lifespanLost: 0 };
  }
  const severity = next as Severity;
  const injuries: Injuries = { ...inj, [id]: { severity, healAccMin: 0 } };
  const becameHeavy = severity === 3;
  return {
    injuries,
    becameHeavy,
    lethal: false,
    lifespanLost: becameHeavy ? LIFESPAN_LOSS_HEAVY : 0,
  };
}

/**
 * 按游戏内时间自愈：攒够该档时长则降一档（spec §5）。
 * 在线与离线同样调用——离线按结算时长传入即可。
 */
export function heal(inj: Injuries, minutes: number, realm: number): Injuries {
  if (minutes <= 0 || !isHurt(inj)) return inj;
  const factor = healRealmFactor(realm);
  const out: Injuries = { ...inj };
  for (const id of INJURY_IDS) {
    let { severity, healAccMin } = out[id];
    let left = minutes;
    while (severity > 0 && left > 0) {
      const need = SEVERITY_HEAL_MIN[severity as Exclude<Severity, 0>] * factor - healAccMin;
      if (left >= need) {
        left -= need;
        severity = (severity - 1) as Severity;
        healAccMin = 0;
      } else {
        healAccMin += left;
        left = 0;
      }
    }
    out[id] = { severity, healAccMin };
  }
  return out;
}

/** 养到全愈还需多少游戏内分钟（UI 倒计时与「先养伤」用） */
export function healTimeNeededMin(inj: Injuries, realm: number): number {
  const factor = healRealmFactor(realm);
  let worst = 0;
  for (const id of INJURY_IDS) {
    const { severity, healAccMin } = inj[id];
    if (severity === 0) continue;
    let total = 0;
    for (let s = 1; s <= severity; s++) total += SEVERITY_HEAL_MIN[s as Exclude<Severity, 0>] * factor;
    worst = Math.max(worst, total - healAccMin);
  }
  return worst;
}

/**
 * 挂机内力产出乘数（spec §3）：三伤按权重乘法叠加，设地板。
 * 产出乘数 = max(FLOOR, Π(1 − 压制值[severity] × idleWeight[伤型]))
 */
export function idleOutputMultiplier(inj: Injuries): number {
  let mult = 1;
  for (const id of INJURY_IDS) {
    const s = inj[id].severity;
    if (s > 0) mult *= 1 - SEVERITY_PRESS[s as Exclude<Severity, 0>] * INJURY_DEFS[id].idleWeight;
  }
  return Math.max(IDLE_FLOOR, mult);
}

/**
 * 把伤势叠加到 Build（spec §1 combat 列）：
 * 外伤压防御与血上限、内伤压攻击、毒伤压命中闪避。
 * 血上限按压制值 ×0.66（spec §1 伤型表）。
 */
export function applyInjuriesToBuild(build: Build, inj: Injuries): Build {
  if (!isHurt(inj)) return build;
  const p = (id: InjuryId) => {
    const s = inj[id].severity;
    return s > 0 ? SEVERITY_PRESS[s as Exclude<Severity, 0>] : 0;
  };
  const wai = p('wai'), nei = p('nei'), du = p('du');
  return {
    ...build,
    def: build.def * (1 - wai),
    hp: build.hp * (1 - wai * 0.66),
    atk: build.atk * (1 - nei),
    hit: build.hit * (1 - du),
    dodge: build.dodge * (1 - du),
  };
}

/** 伤型归属（spec §4）：带毒标签→毒伤，Boss→外伤，精英→内伤 */
export function injuryKindFor(enemy: EnemyDef): InjuryId {
  if (enemy.tags.includes('毒')) return 'du';
  return enemy.kind === 'boss' ? 'wai' : 'nei';
}

/** 是否为会产生伤势的「硬仗」（spec §4）：Boss 与精英，普通关不产伤 */
export function isHardBattle(enemy: EnemyDef): boolean {
  return enemy.kind === 'boss' || enemy.kind === 'elite';
}

/**
 * 战后判定是否受伤（spec §4）：硬仗失败，或硬仗惨胜（余血 < 25%）。
 * 返回 null 表示不受伤。
 */
export function injuryFromBattle(
  enemy: EnemyDef,
  win: boolean,
  playerHpPct: number,
): InjuryId | null {
  if (!isHardBattle(enemy)) return null;
  if (!win) return injuryKindFor(enemy);
  return playerHpPct < PYRRHIC_HP_PCT ? injuryKindFor(enemy) : null;
}

/** 寿元折损（spec §6 接口约定）：重度以下为 0 */
export function lifespanLossOf(severity: Severity): number {
  return severity >= 3 ? LIFESPAN_LOSS_HEAVY : 0;
}

/** 最重的一处伤（顶栏指示器用；并列时按 外伤→内伤→毒伤 取首个） */
export function worstInjury(inj: Injuries): { id: InjuryId; severity: Severity } | null {
  let best: { id: InjuryId; severity: Severity } | null = null;
  for (const id of INJURY_IDS) {
    const s = inj[id].severity;
    if (s > 0 && (best === null || s > best.severity)) best = { id, severity: s };
  }
  return best;
}

/** 带伤处数（顶栏「另 N 处」用） */
export function hurtCount(inj: Injuries): number {
  return INJURY_IDS.filter((id) => inj[id].severity > 0).length;
}
