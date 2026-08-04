/**
 * 战斗引擎 —— 权威来源：规格书 §7.2（六状态/结算顺序）+ 公式表 §2/§4
 * EV 模式与 sim/mvp0_sim.py fight() 逐行对齐（golden fixture 逐数校验）；
 * RNG 模式为运行时形态：同一结算结构，概率分支由注入的 rng 掷出。
 */
import { BASE_CRIT_DMG, BASE_CRIT_RATE, REALMS, type RouteId } from './content';
import type { EnemyDef } from './enemies';
import { HIT_FLOOR, mitigationMultiplier } from './formulas';
import { ROUTES } from './routes';
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

export interface Build {
  hp: number; atk: number; plainMult: number; def: number;
  hit: number; dodge: number; crit: number; cd: number;
  firstCrit: boolean; shieldPct: number; thorns: number;
  poison: { init: number; perHit: number; coef: number; cap: number; burst: number };
  sqNeed: number; burstMult: number; lowhpDr: number;
  route: RouteId;
}

/** 与 sim make_build() 对齐；nodes = 已购机制节点数（顺序生效） */
export function makeBuild(route: RouteId, realm: number, lv: number, nodes: number): Build {
  const b = REALMS[realm - 1];
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
    hp: b.hp * (1 + hpPct), atk: b.atk * (1 + atkPct),
    plainMult: route === 'tangmen' ? 0.6 : 1.0,
    def: b.def * (1 + defPct), hit: b.accuracy, dodge: b.evasion,
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
  kind: 'attack' | 'miss' | 'crit' | 'burst' | 'poison_apply' | 'poison_tick' | 'poison_burst'
      | 'thorns_to_player' | 'thorns_to_enemy' | 'enemy_poison_tick' | 'purify' | 'enrage' | 'defeat' | 'victory';
  dmg?: number;
  text: string;
  phpPct: number;
  ehpPct: number;
  /** 状态快照（§7.1 触发状态可见性）：剑意层 / 我方护盾余量 / 敌方毒层 */
  pSq: number;
  pShield: number;
  ePoison: number;
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
  burstCount: number;      // 爆发剑招次数
  burstDmg: number;        // 爆发剑招总伤害
  shieldAbsorbed: number;  // 护盾吸收总量
  thornsOut: number;       // 金钟反震总输出
  poisonDmg: number;       // 毒伤总量（含毒爆）
  poisonBurstCount: number; // 毒爆次数
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
}

const f1 = (v: number) => Math.round(v * 10) / 10;

export function fight(build: Build, enemy: EnemyDef, opts: FightOptions): FightResult {
  const ev = opts.mode === 'ev';
  const rng = opts.rng ?? Math.random;
  const roll = (p: number) => (ev ? p : rng() < p ? 1 : 0);

  let php = build.hp;
  let pshield = build.hp * build.shieldPct;
  let ehp = enemy.hp;
  const tags = enemy.tags as readonly string[];
  const isBoss = tags.includes('高血') || (tags.includes('高防') && tags.includes('高攻'));
  const dmgMult = isBoss ? 1 + (opts.bossDmgBonus ?? 0) : 1;

  let sq = 0;
  let elayers = 0;      // 敌人身上的毒层（玩家施加）
  let playerPoison = 0; // 玩家身上的毒层（毒敌施加）
  let abStacks = 0;     // 玩家身上的破甲层
  const pHit = hitChance(build.hit, enemy.dodge);
  const eHit = hitChance(enemy.hit, build.dodge);

  const turns: TurnEvent[] = [];
  const stats: FightStats = {
    pHitRate: pHit, abStacksMax: 0, purgeCount: 0, thornsTaken: 0,
    dmgDealt: 0, dmgTaken: 0, critCount: 0, burstCount: 0, burstDmg: 0,
    shieldAbsorbed: 0, thornsOut: 0, poisonDmg: 0, poisonBurstCount: 0,
  };
  let pAttempts = 0, pHits = 0;
  const pct = () => ({
    phpPct: Math.max(php, 0) / build.hp, ehpPct: Math.max(ehp, 0) / enemy.hp,
    pSq: sq, pShield: Math.max(pshield, 0), ePoison: elayers,
  });
  const push = (rd: number, side: TurnEvent['side'], kind: TurnEvent['kind'], text: string, dmg?: number) =>
    turns.push({ rd, side, kind, text, dmg, ...pct() });

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

    // ---- 玩家行动（结算顺序 1：命中 → 暴击 → 减免 → 护盾 → 气血）----
    const forced = rd === 1 && build.firstCrit;
    const hitRoll = roll(pHit);
    pAttempts += 1; pHits += hitRoll;
    const critRoll = forced ? 1 : roll(build.crit);
    const critEv = ev
      ? (forced ? build.cd : 1 - build.crit + build.crit * build.cd)
      : (critRoll ? build.cd : 1);
    let dealt = build.atk * critEv * mitigationMultiplier(enemy.def) * hitRoll * dmgMult * build.plainMult;

    if (build.sqNeed < 99) {
      sq += ev ? pHit * (forced ? 1 : build.crit) : hitRoll * critRoll;
      if (sq >= build.sqNeed) {
        sq -= build.sqNeed;
        const burst = build.atk * build.burstMult * mitigationMultiplier(enemy.def) * dmgMult;
        dealt += burst;
        stats.burstCount += 1;
        stats.burstDmg += burst;
        push(rd, 'player', 'burst', `剑意迸发！爆发剑招造成 ${f1(burst)} 伤害`, f1(burst));
      }
    }
    if (build.poison.perHit) {
      elayers = Math.min(build.poison.cap, elayers + hitRoll * build.poison.perHit);
    }
    ehp -= dealt;
    stats.dmgDealt += dealt;
    if (!ev && hitRoll === 0) {
      push(rd, 'player', 'miss', '你的攻击被闪避');
    } else if (dealt > 0) {
      const critMark = (forced || critRoll === 1) && !ev;
      if (critMark) stats.critCount += 1;
      push(rd, 'player', critMark ? 'crit' : 'attack',
        `你${build.plainMult !== 1 ? '普攻（×0.60）' : '普攻'}${critMark ? '暴击！' : '命中，'}造成 ${f1(dealt)} 伤害${build.poison.perHit && hitRoll ? `，毒 +1 层（${Math.round(elayers)}/${build.poison.cap}）` : ''}${critMark && build.sqNeed < 99 ? `，剑意 ${sq}/${build.sqNeed}` : ''}`,
        f1(dealt));
    }
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
    let eatk = enemy.atk;
    if (tags.includes('狂暴') && rd >= ENRAGE_START) {
      eatk *= 1 + ENRAGE_STEP * (rd - ENRAGE_START + 1);
      if (rd === ENRAGE_START) push(rd, 'enemy', 'enrage', `${enemy.name}狂性大发，攻击开始逐回合提升！`);
    }
    const pdfs = build.def * (1 - Math.min(abStacks, 3) * ARMOR_BREAK_PP);
    const eHitRoll = roll(eHit);
    let edmg = eatk * eHitRoll * mitigationMultiplier(pdfs);
    if (build.lowhpDr && php < 0.3 * build.hp) edmg *= 1 - build.lowhpDr;
    const absorb = Math.min(pshield, edmg);
    pshield -= absorb;
    php -= edmg - absorb;
    stats.dmgTaken += edmg;
    stats.shieldAbsorbed += absorb;
    if (!ev && eHitRoll === 0) {
      push(rd, 'enemy', 'miss', `${enemy.name}的攻击被闪避`);
    } else if (edmg > 0) {
      push(rd, 'enemy', 'attack',
        `${enemy.name}${tags.includes('破甲') ? '破甲一击' : '攻击'}，你受到 ${f1(edmg - absorb)} 伤害${absorb > 0 ? `（护盾吸收 ${f1(absorb)}）` : ''}`,
        f1(edmg - absorb));
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

    // ---- 回合结束（结算顺序 3：毒 → 狂暴/净化）----
    if (elayers > 0) {
      const tick = elayers * build.atk * build.poison.coef * dmgMult;
      ehp -= tick;
      stats.dmgDealt += tick;
      stats.poisonDmg += tick;
      push(rd, 'player', 'poison_tick', `毒发：${Math.round(elayers)} 层 → ${f1(tick)} 毒伤（无视防御）`, f1(tick));
      if (elayers >= build.poison.cap - 1e-9) {
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
  6: '你的输出不足，强化主武学或提升境界。',
  7: '差一点就赢了——再强化一次武学，或等内力突破境界。',
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
