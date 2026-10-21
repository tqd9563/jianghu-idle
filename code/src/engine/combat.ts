/**
 * 战斗引擎 —— 权威来源：规格书 §7.2（六状态/结算顺序）+ 公式表 §2/§4
 * EV 模式与 sim/mvp0_sim.py fight() 逐行对齐（golden fixture 逐数校验）；
 * RNG 模式为运行时形态：同一结算结构，概率分支由注入的 rng 掷出。
 */
import { BASE_CRIT_DMG, BASE_CRIT_RATE, REALMS, STAT_SCALE, huohouEffect, zhaoshiLevel, type RouteId } from './content';
import type { EnemyDef } from './enemies';
import { HIT_FLOOR, mitigationMultiplier } from './formulas';
import { ROUTES } from './routes';
import { EFFECT_ROUNDS, LASTING_EFFECTS, QI_REGEN, TRIGGER_CAP, type FormEffect } from './wuxue';
import { assertNever } from './exhaustive';

// 敌人标签参数（公式表，与 sim 常量一致）
export const ROUND_CAP = 50;
const ENRAGE_START = 13;
const ENRAGE_STEP = 0.08;
const PURIFY_EVERY = 3;
const THORNS_ENEMY = 0.3;
const ARMOR_BREAK_PP = 0.15;
const ENEMY_POISON_COEF = 0.08;
const CRIT_CAP = 0.8;
/** 伤害浮动（formulas.md §1.3 v1.8）：RNG 模式每次出手 ×[1−DMG_SPREAD, 1+DMG_SPREAD]，均值 1；EV 模式不浮动 */
export const DMG_SPREAD = 0.1;

export interface Build {
  hp: number; atk: number; plainMult: number; def: number;
  hit: number; dodge: number; crit: number; cd: number;
  firstCrit: boolean; shieldPct: number; thorns: number;
  poison: { init: number; perHit: number; coef: number; cap: number; burst: number };
  sqNeed: number; burstMult: number; lowhpDr: number;
  route: RouteId;
}

/**
 * 与 sim 对齐：招式部分 = mvp0_sim.make_build(lv ≤ 10)，火候部分 = longline_sim.build 的叠加
 * （formulas.md §3.4 v1.6）。nodes = 已购机制节点数（顺序生效）。
 */
export function makeBuild(route: RouteId, realm: number, level: number, nodes: number): Build {
  const b = REALMS[realm - 1];
  const lv = zhaoshiLevel(level);
  const hh = huohouEffect(level);
  const r = ROUTES[route];
  let crit = BASE_CRIT_RATE;
  let cd = BASE_CRIT_DMG;
  let atkPct = 0, hpPct = 0, defPct = 0, shieldPct = 0, thorns = 0;
  let poison = { init: 0, perHit: 0, coef: 0, cap: 0, burst: 0 };
  let sqNeed = 99, burstMult = 0, lowhpDr = 0, firstCrit = false;

  if (route === 'huashan') {
    firstCrit = true;
    crit += r.grant.critRatePP! + r.perLevel.critRatePP! * lv;
    cd += r.grant.critDmgPP! + r.perLevel.critDmgPP! * lv;
    atkPct += r.perLevel.atkPct! * lv;
    sqNeed = 5; burstMult = 4.0;
    if (nodes >= 1) sqNeed = 4;
    if (nodes >= 2) burstMult = 5.5;
    if (nodes >= 3) sqNeed = 3;
  } else if (route === 'shaolin') {
    shieldPct = r.grant.shieldPctHP!;
    thorns = r.grant.thornsPct! + r.perLevel.thornsPP! * lv;
    defPct = r.grant.defPct! + r.perLevel.defPct! * lv;
    hpPct = r.perLevel.hpPct! * lv;
    if (nodes >= 1) shieldPct += 0.15;
    if (nodes >= 2) thorns += 0.15;
    if (nodes >= 3) lowhpDr = 0.3;
  } else if (route === 'tangmen') {
    const g = r.grant;
    poison = {
      init: g.poisonInit!, perHit: g.poisonPerHit!,
      coef: g.poisonCoef! + r.perLevel.poisonCoefPP! * lv,
      cap: g.poisonCap!, burst: g.poisonBurstPct!,
    };
    atkPct += r.perLevel.atkPct! * lv;
    if (nodes >= 1) poison.init += 2;
    if (nodes >= 2) poison.cap = 10;
    if (nodes >= 3) poison.burst = 0.8;
  } else {
    // 新增路线必须在此补分支，否则编译期报错（不再静默套用毒流参数）
    assertNever(route, 'makeBuild 未处理的路线');
  }

  return {
    hp: b.hp * (1 + hpPct) * hh.statMult, atk: b.atk * (1 + atkPct) * hh.statMult,
    plainMult: route === 'tangmen' ? 0.6 : 1.0,
    def: b.def * (1 + defPct) * hh.statMult, hit: b.accuracy + hh.hit, dodge: b.evasion + hh.dodge,
    crit: Math.min(crit, CRIT_CAP), cd, firstCrit, shieldPct, thorns,
    poison, sqNeed, burstMult, lowhpDr, route,
  };
}

function hitChance(hit: number, dodge: number): number {
  return Math.max(HIT_FLOOR, Math.min(1, hit / (hit + dodge)));
}

export interface TurnEvent {
  rd: number;
  side: 'player' | 'enemy' | 'end';
  kind: 'attack' | 'cast' | 'miss' | 'crit' | 'burst' | 'poison_apply' | 'poison_tick' | 'poison_burst'
      | 'thorns_to_player' | 'thorns_to_enemy' | 'enemy_poison_tick' | 'purify' | 'enrage' | 'defeat' | 'victory'
      | 'followup' | 'sealed';
  dmg?: number;
  text: string;
  phpPct: number;
  ehpPct: number;
  /** 状态快照（§7.1 触发状态可见性）：叠浪重数 / 我方护盾余量 / 敌方毒层 */
  pSq: number;
  pShield: number;
  ePoison: number;
  /** 持续特效快照（战斗页增减益标记）：[特效, 余几回合, 数值]；增益挂己方、减益挂敌方由特效决定 */
  lasting: [FormEffect, number, number][];
  /** 敌人被封穴、下一次行动会落空 */
  eSealed: boolean;
  /** 当前真气（装了武学才有，spec §1.4） */
  pQi: number;
  /** 叙事战报用的补充信息（只读展示，不参与结算）：出招的招式键 `武学 id:式序`、本招是否暴击 / 被闪、
   *  敌方攻击被护盾吸收的量、牵机镖引爆的毒伤 */
  form?: string;
  crit?: boolean;
  missed?: boolean;
  absorb?: number;
  detonate?: number;
  /** 本招特效确实生效（持续类挂上、连击 / 封穴掷中、回气 / 回元 / 护体 / 附毒 / 透劲结算了），战报据此追加特效句 */
  fx?: FormEffect;
}

/** 战斗统计 —— 纯累加器，不参与结算；失败战报（战斗文案冻结件）与诊断规则消费 */
export interface FightStats {
  pHitRate: number;        // 实际命中率（EV 模式即命中概率）
  abStacksMax: number;     // 敌方施加的破甲层数峰值
  purgeCount: number;      // 净化清除毒层的次数（清空非零层才计）
  thornsTaken: number;     // 反伤敌反弹给玩家的总伤害（护盾吸收前）
  dmgDealt: number;        // 我方总输出（普攻+爆发+毒伤+毒爆+反伤）
  dmgTaken: number;        // 我方总承伤（减免后，含护盾吸收部分：敌攻+反噬+毒）
  critCount: number;       // 暴击次数（RNG 模式）
  burstCount: number;      // 排山倒海次数
  burstDmg: number;        // 排山倒海总伤害
  shieldAbsorbed: number;  // 护盾吸收总量
  thornsOut: number;       // 金钟反震总输出
  poisonDmg: number;       // 毒伤总量（含毒爆）
  poisonBurstCount: number; // 毒爆次数
  /** 武学出招（spec §4.7 触发统计）：总次数、按武学的次数与伤害、按招式的次数（熟练度来源） */
  casts: number;
  skillCasts: Record<string, number>;
  skillDmg: Record<string, number>;
  formCasts: Record<string, number>;
  /** 抽式时这门有式出不起（真气不足滑向轻招）的次数（裁决 45 sim 用） */
  lowQiCasts: number;
}

/** 一式招式（倍率已含共鸣；耗气 / 冷却已含熟练加成，battle-loot/spec.md §3.6） */
export interface CombatForm {
  key: string;
  name: string;
  mult: number;
  effect: FormEffect | null;
  /** 本式特效数值（四档插值，spec §3.4）；独门机制为 0 */
  fx: number;
  cost: number;
  /** 未打折的基础耗气，抽式权重用（缺省同 cost） */
  baseCost?: number;
  cd: number;
}

/** 一门装配中的武学：只列已领悟的招式；p = 对总触发率的贡献（不随熟练变，裁决 45） */
export interface CombatSkill {
  id: string;
  name: string;
  p: number;
  forms: CombatForm[];
}

export interface FightResult {
  win: boolean;
  rounds: number;
  playerHpPct: number;
  enemyHpPct: number;
  turns: TurnEvent[];
  stats: FightStats;
}

export interface FightOptions {
  mode: 'ev' | 'rng';
  rng?: () => number;
  bossDmgBonus?: number;
  /** 对精英 / Boss 伤害加成（装备「破军」词条，battle-loot/design.md §3.2）：按关卡种类生效，普通关为 0 */
  hardDmgBonus?: number;
  /** 装配的武学；只在实战掷骰模式出招，EV 模式（失败诊断）只算普攻 */
  loadout?: CombatSkill[];
  /** 真气上限（开战即满） */
  qiMax?: number;
}

const f1 = (v: number) => Math.round(v * 10) / 10;

export function fight(build: Build, enemy: EnemyDef, opts: FightOptions): FightResult {
  const ev = opts.mode === 'ev';
  // 本关防御常数（formulas.md §1.3 v1.6）：随关卡当量放大，旧关卡缺省 100
  const defK = enemy.defK ?? 100 * STAT_SCALE;
  const rng = opts.rng ?? Math.random;
  const roll = (p: number) => (ev ? p : rng() < p ? 1 : 0);
  const spread = () => (ev ? 1 : 1 + DMG_SPREAD * (2 * rng() - 1));

  let php = build.hp;
  let pshield = build.hp * build.shieldPct;
  let ehp = enemy.hp;
  const tags = enemy.tags as readonly string[];
  const isBoss = tags.includes('高血') || (tags.includes('高防') && tags.includes('高攻'));
  const dmgMult = (isBoss ? 1 + (opts.bossDmgBonus ?? 0) : 1) * (enemy.kind !== 'normal' ? 1 + (opts.hardDmgBonus ?? 0) : 1);

  let sq = 0;
  let elayers = 0;      // 敌人身上的毒层（玩家施加）
  let playerPoison = 0; // 玩家身上的毒层（毒敌施加）
  let abStacks = 0;     // 玩家身上的破甲层
  const pHit = hitChance(build.hit, enemy.dodge);
  // 武学（spec §2.5 / battle-loot/spec.md §3.3）：候选 = 冷却好且真气够；总触发率 = Σ 各门几率（封顶）；加权抽门、等概率抽式。
  // 不装武学时不消耗任何额外随机数，金标准逐项不变
  const loadout = ev ? [] : (opts.loadout ?? []);
  const useSkills = loadout.length > 0;
  const qiMax = useSkills ? opts.qiMax ?? 0 : 0;
  let qi = qiMax;
  const cds = loadout.map(() => 0);
  let fightCasts = 0;
  // 持续增益 / 减益（spec §3.4）：名字 → [剩余回合, 数值]，回合末递减；同名只刷新不叠加
  const lasting: Partial<Record<FormEffect, [number, number]>> = {};
  const lv = (e: FormEffect) => lasting[e]?.[1] ?? 0;
  const eHitNow = () => hitChance(enemy.hit - lv('迷目'), build.dodge + lv('轻身'));
  let sealed = false;   // 封穴：敌人跳过下一次行动
  // 非蚀骨被「附毒」挂上的毒：系数 12%、上限 8 层、不毒爆（spec §2.6）
  const pCap = build.poison.cap || 8;
  const pCoef = build.poison.coef || 0.12;

  const turns: TurnEvent[] = [];
  const stats: FightStats = {
    pHitRate: pHit, abStacksMax: 0, purgeCount: 0, thornsTaken: 0,
    dmgDealt: 0, dmgTaken: 0, critCount: 0, burstCount: 0, burstDmg: 0,
    shieldAbsorbed: 0, thornsOut: 0, poisonDmg: 0, poisonBurstCount: 0,
    casts: 0, skillCasts: {}, skillDmg: {}, formCasts: {}, lowQiCasts: 0,
  };
  let pAttempts = 0, pHits = 0;
  const pct = () => ({
    phpPct: Math.max(php, 0) / build.hp, ehpPct: Math.max(ehp, 0) / enemy.hp,
    pSq: sq, pShield: Math.max(pshield, 0), ePoison: elayers, pQi: qi,
    lasting: (Object.keys(lasting) as FormEffect[]).map((k): [FormEffect, number, number] => [k, lasting[k]![0], lasting[k]![1]]),
    eSealed: sealed,
  });
  type TurnExtra = Pick<TurnEvent, 'form' | 'crit' | 'missed' | 'absorb' | 'detonate'>;
  const push = (rd: number, side: TurnEvent['side'], kind: TurnEvent['kind'], text: string, dmg?: number, extra?: TurnExtra) =>
    turns.push({ rd, side, kind, text, dmg, ...pct(), ...extra });

  const finish = (win: boolean, rounds: number): FightResult => {
    if (!ev) stats.pHitRate = pAttempts > 0 ? pHits / pAttempts : pHit;
    push(rounds, 'end', win ? 'victory' : 'defeat', win ? `${enemy.name}倒下了——胜` : '你倒下了。战败');
    return {
      win, rounds,
      playerHpPct: Math.max(php, 0) / build.hp,
      enemyHpPct: Math.max(ehp, 0) / enemy.hp,
      turns, stats,
    };
  };

  for (let rd = 1; rd <= ROUND_CAP; rd++) {
    if (rd === 1 && build.poison.init) {
      elayers = Math.min(build.poison.cap, build.poison.init);
      push(0, 'player', 'poison_apply', `唐门暗器出手，施毒 ${elayers} 层`);
    }

    // ---- 玩家行动（结算顺序 1：出招判定 → 命中 → 暴击 → 减免 → 护盾 → 气血）----
    let skill: CombatSkill | null = null;
    let form: CombatForm | null = null;
    let fx: FormEffect | undefined;
    if (useSkills) {
      const cand = loadout.map((_, i) => i).filter((i) => cds[i] === 0 && qi >= Math.min(...loadout[i].forms.map((f) => f.cost)));
      const total = Math.min(TRIGGER_CAP, cand.reduce((a, i) => a + loadout[i].p, 0));
      if (cand.length > 0 && rng() < total) {
        let r = rng() * cand.reduce((a, i) => a + loadout[i].p, 0);
        let i = cand[cand.length - 1];
        for (const c of cand) { r -= loadout[c].p; if (r < 0) { i = c; break; } }
        skill = loadout[i];
        // 抽式（裁决 45）：出得起的式里按基础耗气加权，贵的出得多；真气不足时自然滑向轻招
        const usable = skill.forms.filter((f) => f.cost <= qi);
        if (usable.length < skill.forms.length) stats.lowQiCasts += 1;
        const wsum = usable.reduce((a, f) => a + (f.baseCost ?? f.cost), 0);
        let w = rng() * wsum;
        form = usable[usable.length - 1];
        for (const f of usable) { w -= f.baseCost ?? f.cost; if (w < 0) { form = f; break; } }
        qi -= form.cost;
        cds[i] = form.cd + 1;
      }
      for (let j = 0; j < cds.length; j++) cds[j] = Math.max(0, cds[j] - 1);
    }
    const eff = form?.effect ?? null;
    const fv = form?.fx ?? 0;
    const forced = rd === 1 && build.firstCrit;
    const hitRoll = roll(pHit);
    pAttempts += 1; pHits += hitRoll;
    const critNow = Math.min(CRIT_CAP, build.crit + lv('凝眸'));
    const critRoll = forced || eff === '必暴' ? 1 : roll(critNow);
    // 必暴另加会心伤害（四档）
    const cdNow = build.cd + (eff === '必暴' ? fv : 0);
    const critEv = ev
      ? (forced ? build.cd : 1 - build.crit + build.crit * build.cd)
      : (critRoll ? cdNow : 1);
    // 招式：倍率 × 蓄势；反震按「攻击 + 防御」计；蚀骨「普攻 ×0.60」只作用于普攻（spec S3）
    const atkNow = build.atk * (1 + lv('运劲'));
    const baseAtk = atkNow + (eff === '反震' ? build.def : 0);
    const mult = form ? form.mult * (eff === '蓄势' ? 1 + 0.1 * fightCasts : 1) : 1;
    // 敌方防御：破绽（持续）与透劲（本式）都打折
    const edefNow = enemy.def * (1 - lv('破绽')) * (eff === '透劲' ? 1 - fv : 1);
    let dealt = baseAtk * mult * critEv * mitigationMultiplier(edefNow, defK) * hitRoll * dmgMult
      * (form ? 1 : build.plainMult) * spread();
    if (form) fightCasts += 1;
    else if (useSkills) qi = Math.min(qiMax, qi + QI_REGEN);
    if (form && eff) {
      switch (eff) {
        case '护体': pshield += fv * build.hp; fx = eff; break;
        case '回气': qi = Math.min(qiMax, qi + form.cost * fv); fx = eff; break;
        case '回元': qi = Math.min(qiMax, qi + fv); fx = eff; break;
        case '透劲': fx = eff; break;
        case '封穴': if (rng() < fv) { sealed = true; fx = eff; } break;
        default:
          if (LASTING_EFFECTS.has(eff)) { lasting[eff] = [EFFECT_ROUNDS, fv]; fx = eff; }
      }
    }
    let detonate = 0;
    if (eff === '引爆' && elayers > 0) {
      detonate = elayers * build.atk * pCoef * 3 * dmgMult;
      dealt += detonate;
      stats.poisonDmg += detonate;
      elayers = 0;
    }

    // 叠满即排山倒海：伤害并入本次出手结算，但战报里排在触发它的会心之后（pushBurst）
    let burstAmt = 0;
    if (build.sqNeed < 99) {
      sq += ev ? pHit * (forced ? 1 : build.crit) : hitRoll * critRoll;
      if (sq >= build.sqNeed) {
        sq -= build.sqNeed;
        burstAmt = build.atk * build.burstMult * mitigationMultiplier(enemy.def, defK) * dmgMult * spread();
        dealt += burstAmt;
        stats.burstCount += 1;
        stats.burstDmg += burstAmt;
      }
    }
    const pushBurst = () => {
      if (burstAmt <= 0) return;
      push(rd, 'player', 'burst', `浪已叠满！排山倒海造成 ${f1(burstAmt)} 伤害`, f1(burstAmt));
      burstAmt = 0;
    };
    const shownDealt = dealt - burstAmt;
    // 附毒：额外叠 1 层，另有几率再 +1（spec §3.4）
    let extraPoison = 0;
    if (eff === '附毒') { extraPoison = 1 + (fv > 0 && rng() < fv ? 1 : 0); fx = eff; }
    const perHit = build.poison.perHit + extraPoison;
    if (perHit) {
      elayers = Math.min(pCap, elayers + hitRoll * perHit);
    }
    if (eff === '引爆' && detonate > 0) fx = eff;
    ehp -= dealt;
    stats.dmgDealt += dealt;
    if (skill && form) {
      stats.casts += 1;
      stats.skillCasts[skill.id] = (stats.skillCasts[skill.id] ?? 0) + 1;
      stats.skillDmg[skill.id] = (stats.skillDmg[skill.id] ?? 0) + dealt;
      stats.formCasts[form.key] = (stats.formCasts[form.key] ?? 0) + 1;
      const crit = critRoll === 1;
      if (crit) stats.critCount += 1;
      push(rd, 'player', 'cast',
        hitRoll === 0
          ? `施展「${skill.name} · ${form.name}」，被闪避`
          : `施展「${skill.name} · ${form.name}」${crit ? '，暴击' : ''}${eff && eff !== '必暴' ? `（${eff}）` : ''}，造成 ${f1(shownDealt)} 伤害${detonate > 0 ? `（引爆毒层 ${f1(detonate)}）` : ''}`,
        f1(shownDealt), { form: form.key, crit, missed: hitRoll === 0, ...(detonate > 0 ? { detonate: f1(detonate) } : {}), ...(fx ? { fx } : {}) });
      pushBurst();
      // 连击：有几率追加一次普攻（不叠浪、不叠毒）
      if (eff === '连击' && hitRoll && rng() < fv) {
        const h2 = roll(pHit);
        const c2 = roll(critNow);
        const d2 = atkNow * build.plainMult * (c2 ? build.cd : 1) * mitigationMultiplier(edefNow, defK) * h2 * dmgMult * spread();
        ehp -= d2;
        stats.dmgDealt += d2;
        stats.skillDmg[skill.id] = (stats.skillDmg[skill.id] ?? 0) + d2;
        push(rd, 'player', 'followup', h2 ? `招势未尽，顺手又补了一记，造成 ${f1(d2)} 伤害` : '招势未尽，顺手又补了一记，被闪避', f1(d2), { crit: c2 === 1, missed: h2 === 0 });
      }
    } else if (!ev && hitRoll === 0) {
      push(rd, 'player', 'miss', '你的攻击被闪避');
    } else if (dealt > 0) {
      const critMark = (forced || critRoll === 1) && !ev;
      if (critMark) stats.critCount += 1;
      push(rd, 'player', critMark ? 'crit' : 'attack',
        `你${build.plainMult !== 1 ? '普攻（×0.60）' : '普攻'}${critMark ? '暴击！' : '命中，'}造成 ${f1(shownDealt)} 伤害${build.poison.perHit && hitRoll ? `，毒 +1 层（${Math.round(elayers)}/${build.poison.cap}）` : ''}`,
        f1(shownDealt));
    }
    pushBurst();
    if (tags.includes('反伤') && dealt > 0) {
      const refl = dealt * THORNS_ENEMY;
      const absorb = Math.min(pshield, refl);
      pshield -= absorb;
      php -= refl - absorb;
      stats.thornsTaken += refl;
      stats.dmgTaken += refl;
      stats.shieldAbsorbed += absorb;
      push(rd, 'enemy', 'thorns_to_player', `${enemy.name}反弹了你的攻势，你受到 ${f1(refl - absorb)} 反伤`, f1(refl - absorb));
    }
    if (ehp <= 0) return finish(true, rd);

    // ---- 敌人行动 ----
    let eatk = enemy.atk * (1 - lv('卸力'));
    if (tags.includes('狂暴') && rd >= ENRAGE_START) {
      eatk *= 1 + ENRAGE_STEP * (rd - ENRAGE_START + 1);
      if (rd === ENRAGE_START) push(rd, 'enemy', 'enrage', `${enemy.name}狂性大发，攻击开始逐回合提升！`);
    }
    const pdfs = build.def * (1 - Math.min(abStacks, 3) * ARMOR_BREAK_PP);
    if (sealed) {
      sealed = false;
      push(rd, 'enemy', 'sealed', `${enemy.name}穴道被封，这一回合动弹不得`);
      eatk = 0;
    }
    const eHitRoll = eatk > 0 ? roll(eHitNow()) : 0;
    let edmg = eatk * eHitRoll * mitigationMultiplier(pdfs, defK) * spread();
    if (build.lowhpDr && php < 0.3 * build.hp) edmg *= 1 - build.lowhpDr;
    const absorb = Math.min(pshield, edmg);
    pshield -= absorb;
    php -= edmg - absorb;
    stats.dmgTaken += edmg;
    stats.shieldAbsorbed += absorb;
    if (!ev && eHitRoll === 0 && eatk > 0) {
      push(rd, 'enemy', 'miss', `${enemy.name}的攻击被闪避`);
    } else if (edmg > 0) {
      push(rd, 'enemy', 'attack',
        `${enemy.name}${tags.includes('破甲') ? '破甲一击' : '攻击'}，你受到 ${f1(edmg - absorb)} 伤害${absorb > 0 ? `（护盾吸收 ${f1(absorb)}）` : ''}`,
        f1(edmg - absorb), absorb > 0 ? { absorb: f1(absorb) } : undefined);
    }
    // 反伤按减免后、护盾吸收前伤害计（§7.2），单向截断
    if (build.thorns && edmg > 0) {
      const t = edmg * build.thorns;
      ehp -= t;
      stats.dmgDealt += t;
      stats.thornsOut += t;
      push(rd, 'player', 'thorns_to_enemy', `金钟反震，${enemy.name}受到 ${f1(t)} 反伤`, f1(t));
    }
    if (tags.includes('破甲')) {
      abStacks = Math.min(3, abStacks + eHitRoll);
      stats.abStacksMax = Math.max(stats.abStacksMax, abStacks);
    }
    if (tags.includes('毒')) {
      playerPoison = Math.min(5, playerPoison + eHitRoll);
    }
    if (ehp <= 0) return finish(true, rd);

    // ---- 回合结束（结算顺序 3：毒 → 狂暴/净化；持续特效递减）----
    for (const k of Object.keys(lasting) as FormEffect[]) {
      const v = lasting[k]!;
      if (v[0] <= 1) delete lasting[k]; else v[0] -= 1;
    }
    if (elayers > 0) {
      const tick = elayers * build.atk * pCoef * dmgMult;
      ehp -= tick;
      stats.dmgDealt += tick;
      stats.poisonDmg += tick;
      push(rd, 'player', 'poison_tick', `毒发：${Math.round(elayers)} 层 → ${f1(tick)} 毒伤（无视防御）`, f1(tick));
      if (build.poison.burst > 0 && elayers >= build.poison.cap - 1e-9) {
        const burst = build.poison.cap * build.atk * build.poison.burst * dmgMult;
        ehp -= burst;
        elayers = 0;
        stats.dmgDealt += burst;
        stats.poisonDmg += burst;
        stats.poisonBurstCount += 1;
        push(rd, 'player', 'poison_burst', `毒层满溢，毒爆！造成 ${f1(burst)} 伤害`, f1(burst));
      }
      if (ehp <= 0) return finish(true, rd);
    }
    if (playerPoison > 0) {
      const tick = playerPoison * enemy.atk * ENEMY_POISON_COEF;
      php -= tick; // 毒绕过护盾直扣气血
      stats.dmgTaken += tick;
      push(rd, 'enemy', 'enemy_poison_tick', `毒入肌理（${Math.round(playerPoison)} 层），你受到 ${f1(tick)} 毒伤（绕过护盾）`, f1(tick));
    }
    if (tags.includes('净化') && rd % PURIFY_EVERY === 0) {
      if (elayers > 0) stats.purgeCount += 1;
      elayers = 0;
      push(rd, 'enemy', 'purify', `${enemy.name}运功清毒，毒层被净化`);
    }
    if (php <= 0) return finish(false, rd);
  }
  return finish(false, ROUND_CAP);
}

/** 失败提示诊断（公式表 §5）：从上到下取第一条命中，最多附加一条次优先 */
export const DIAG_TEXTS: Record<number, string> = {
  1: '当前境界偏低，继续修炼可提高基础属性。',
  2: '你的命中不足，华山暴击流面对高闪敌人不稳定。',
  3: '敌人破甲较高，少林防御收益被削弱。',
  4: '敌人净化了毒层，唐门需要更高叠毒速度或换目标。',
  5: '敌人反弹了你的爆发，考虑降低单次伤害或先强化生存。',
  6: '你的输出不足，精进内功或提升境界。',
  7: '差一点就赢了——再精进几重内功，或等内力突破境界。',
};

export function diagnose(
  build: Build, enemy: EnemyDef, result: FightResult, playerRealm: number,
): number[] {
  const tags = enemy.tags as readonly string[];
  const hits: number[] = [];
  if (playerRealm < enemy.recommendedRealm) hits.push(1);
  if (tags.includes('高闪') && result.stats.pHitRate < 0.75 && build.route === 'huashan') hits.push(2);
  if (tags.includes('破甲') && result.stats.abStacksMax >= 2 && build.route === 'shaolin') hits.push(3);
  if (tags.includes('净化') && result.stats.purgeCount >= 2 && build.route === 'tangmen') hits.push(4);
  if (tags.includes('反伤') && result.stats.thornsTaken >= 0.3 * build.hp) hits.push(5);
  if (result.rounds >= ROUND_CAP || result.enemyHpPct > 0.4) hits.push(6);
  if (hits.length === 0) hits.push(7);
  return hits.slice(0, 2);
}
