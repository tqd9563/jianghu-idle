/**
 * 战斗页 —— 基准：docs/design/ui-overhaul-prototype.html `#p-battle` / `#d-fail` + DESIGN.md（issue #26 视觉大改）。
 * 活江湖第一期批三（docs/design/living-jianghu-prototype.html + DESIGN.md「江湖舆图」「据点战斗页」「长卷对阵区」）：
 * 江湖舆图 → 点卷放大到地域分图 → 点据点进场景战斗页（关卡点在画里的路上、长卷对阵、挑战 / 挂机、叙事战报）。
 * 挂机入口按 docs/design/battle-loot-prototype.html `.act2`（battle-loot/design.md §2.1）：已通关卡「在此挂机」+「重打一次」，下一关「挑战」；挂机中顶上一条状态栏。
 * 战报句子来自 engine/narration.ts（冻结文案 docs/rules/copy/battle-narration.md），收获行见其 §7。
 */
import { Fragment, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { RUMORS } from '../engine/sect';
import { DIAG_TEXTS, type TurnEvent } from '../engine/combat';
import { WUXUE, formName, type FormEffect, type WuxueId } from '../engine/wuxue';
import { NEIGONG } from '../engine/neigong';
import { REALMS } from '../engine/content';
import {
  getStage, isChapterBoss, mapDef, mapName, stageKey, trackLength, VOLUMES,
  type EnemyDef, type EnemyTag,
} from '../engine/enemies';
import { factionStyle, holderOfStage } from '../engine/roster';
import { ERA_START } from '../engine/reincarnation';
import { JianghuMap } from './battle/JianghuMap';
import { StageScene, type StageNode } from './battle/StageScene';
import { DuelBand } from './battle/DuelBand';
import { FOE_CAP, FOE_PT, HERO_CAP, HERO_PT, cnNum, portraitOf, sceneOf } from './battle/art';
import { narrateTurn, type Hand, type NarrCtx, type Seg } from '../engine/narration';
import { armorBroken, rate, tallyTurns, type MechKey } from '../engine/battleTally';
import { COUNTER_HINTS, FAME_BOSS, FAME_ELITE, hasNode } from '../engine/prestige';
import {
  currentMult, effBreakCost, mapUnlocked, nextStageOf, playerBuild,
  qiMaxOf, useGameStore,
} from '../store/gameStore';
import { fmtBig } from '../fmt';
import { gearFullName } from '../engine/gear';
import { isTeachFailure } from '../store/gameStore';
import { formTitle } from '../engine/formNames';

const f0 = (n: number) => fmtBig(Math.round(n));

/** data-tip 走 innerHTML：拼进去的名字统一转义 */
const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!));

/** 增减益标记（docs/design/battle-status-prototype.html）：石印图标一行。有时限的下挂三点亮几枚余几回合；
 *  叠层的（毒、叠浪，以后同类机制照此）右下角标层数，叠满会爆发的印面发亮；数值收进悬停 */
const FX_ICON: Partial<Record<FormEffect, string>> = {
  运劲: 'yunjin', 凝眸: 'ningmou', 轻身: 'qingshen', 卸力: 'xieli', 迷目: 'mimu', 破绽: 'pozhan',
};
const BUFFS: ReadonlySet<FormEffect> = new Set(['运劲', '凝眸', '轻身']);
const pc = (v: number) => Math.round(v * 100);
const FX_SAY: Partial<Record<FormEffect, (v: number) => string>> = {
  运劲: (v) => `攻击 +${pc(v)}%`, 凝眸: (v) => `会心 +${pc(v)}%`, 轻身: (v) => `闪避 +${v}`,
  卸力: (v) => `攻击 −${pc(v)}%`, 迷目: (v) => `命中 −${v}`, 破绽: (v) => `防御 −${pc(v)}%`,
};
type FxChip = { key: string; icon: string; side: 'buff' | 'debuff'; tip: string; left?: number; layers?: number; brim?: boolean };

function FxRow({ chips }: { chips: FxChip[] }) {
  return (
    <div className="fx-row">
      {chips.map((c) => (
        <div key={c.key} className={`fx ${c.side}${c.left === 1 ? ' last' : ''}${c.brim ? ' brim' : ''}`} data-tip={c.tip}>
          <img src={`/art/fx/${c.icon}.png`} alt="" />
          {c.left !== undefined && (
            <span className="pips">{[1, 2, 3].map((n) => <span key={n} className={n <= c.left! ? 'on' : ''} />)}</span>
          )}
          {c.layers !== undefined && <span className="n">{c.layers}</span>}
        </div>
      ))}
    </div>
  );
}

/** 叠浪：重数、所需重数、排山倒海倍率；brim = 触发叠满的会心已揭示、排山倒海还在下一拍（引擎此刻已归零，这里先顶满） */
type Tide = { need: number; mult: number; brim: boolean };

/** 从当前快照拼出双方的标记；同一特效重新挂上时换 key，让图标重新落印 */
function fxChips(turns: TurnEvent[], poisonCap: number, tide: Tide | null): { mine: FxChip[]; foe: FxChip[] } {
  const last = turns[turns.length - 1];
  const mine: FxChip[] = [], foe: FxChip[] = [];
  if (!last) return { mine, foe };
  if (tide) {
    const n = tide.brim ? tide.need : Math.floor(last.pSq);
    if (n > 0) mine.push({
      key: 'dielang', icon: 'dielang', side: 'buff', layers: n, brim: tide.brim,
      tip: `<span class="fx-buff">叠浪</span>　${n} / ${tide.need} 重<br><span class="l">叠满：排山倒海 ${Math.round(tide.mult * 100)}%</span>`,
    });
  }
  if (last.ePoison > 0) {
    const n = Math.round(last.ePoison);
    foe.push({ key: 'du', icon: 'du', side: 'debuff', layers: n, tip: `<span class="fx-du">毒</span>　${n} / ${poisonCap} 层` });
  }
  for (const [k, left, v] of last.lasting) {
    const icon = FX_ICON[k];
    if (!icon) continue;
    let cast = turns.length - 1;
    while (cast > 0 && turns[cast].fx !== k) cast--;
    const side = BUFFS.has(k) ? 'buff' : 'debuff';
    const tip = `<span class="fx-${side}">${k}</span>　${FX_SAY[k]!(v)}<br><span class="l">余 ${left} 回合</span>`;
    (side === 'buff' ? mine : foe).push({ key: `${k}:${cast}`, icon, side, left, tip });
  }
  if (last.eSealed) foe.push({ key: 'fengxue', icon: 'fengxue', side: 'debuff', tip: '<span class="fx-debuff">封穴</span>　下一次出手落空' });
  return { mine, foe };
}

/** 标签展示名：内部值「毒」UI 显示「剧毒」（retire-copy §7） */
const tagLabel = (t: EnemyTag) => (t === '毒' ? '剧毒' : t);

/** Boss 印章字：一章门户末关是 Boss */
const bossSeal = (e: EnemyDef) => (isChapterBoss(e.map, e.stage) ? 'Boss' : '头目');

export function BattlePane({ goCultivate }: { goCultivate: () => void }) {
  const s = useGameStore();
  const cleared = s.clearedStages;
  const unlocked = s.mapsUnlocked ?? [1];
  const viewMap = s.selectedMap;
  const viewDef = mapDef(viewMap);
  // 三层：江湖舆图 → 地域分图（zoomVol）→ 据点战斗页；在打或挂机时直接进据点
  const [view, setView] = useState<'map' | 'fight'>(() => (s.battle || s.idle ? 'fight' : 'map'));
  const [zoomVol, setZoomVol] = useState<number | null>(null);
  const hereVol = unlocked.reduce((v, m) => Math.max(v, mapDef(m).vol), 1);
  // 只展示当前所选图上的战斗
  const battle = s.battle && s.battle.map === viewMap ? s.battle : null;
  const open = mapUnlocked(viewMap, unlocked);
  const total = trackLength(viewMap);
  const next = open ? nextStageOf(viewMap, cleared) : null;
  const build = playerBuild(s);
  const qiCap = qiMaxOf(s);
  const isDone = (st: number) => cleared.includes(stageKey(viewMap, st));

  // 选关（已通关卡可回刷；默认跟随下一关，全通默认末关）
  const [viewStage, setViewStage] = useState<number | null>(null);
  useEffect(() => setViewStage(null), [viewMap]);
  const idleStage = viewStage ?? next ?? total;
  const isRefarmTarget = isDone(idleStage);
  // 挂机中（只显示本图的）
  const idling = s.idle && s.idle.map === viewMap ? s.idle : null;

  const turns = battle ? battle.result.turns.slice(0, battle.revealed) : [];
  const last = turns[turns.length - 1];
  const fighting = battle !== null && !battle.resolved;
  const battleDone = battle ? battle.revealed >= battle.result.turns.length : false;
  const victory = battle !== null && battleDone && battle.result.win;
  const lost = battle !== null && battleDone && !battle.result.win;
  const phpPct = last ? last.phpPct : 1;
  const ehpPct = last ? last.ehpPct : 1;
  // 少林护体：气血条上的浅蓝护盾段（2026-07-07 UI 裁决）
  const shieldNow = build.shieldPct > 0 ? (last ? last.pShield : build.hp * build.shieldPct) : 0;
  const tide = build.sqNeed < 99 && battle
    ? { need: build.sqNeed, mult: build.burstMult, brim: battle.result.turns[battle.revealed]?.kind === 'burst' } : null;
  const fx = fighting ? fxChips(turns, build.poison.cap || 8, tide) : null;
  const qiNow = battle && last && (s.equipped ?? []).length > 0 ? last.pQi : qiCap;
  const idleEnemy = open && total > 0 ? getStage(viewMap, idleStage) : null;
  const enemy = battle ? battle.enemy : idleEnemy;

  // 名号：精英 / Boss 首次击败给声望（economy.md §1.3），跨世只一次
  const fameKey = enemy ? `stage:${stageKey(enemy.map, enemy.stage)}` : '';
  const fameClaimed = (s.fameClaimed ?? []).includes(fameKey);
  const fameReward = enemy && enemy.kind !== 'normal'
    ? Math.floor((enemy.kind === 'boss' ? FAME_BOSS : FAME_ELITE) * currentMult(s)) : 0;

  const stages = Array.from({ length: total }, (_, i) => i + 1);
  const defs = open ? stages.map((st) => getStage(viewMap, st)) : [];
  const doneCount = stages.filter(isDone).length;

  // 守关人（江湖名册，roster.ts）：本世在任者，第几任、通用人像
  const life = Math.floor(s.eraStart ?? ERA_START);
  const holder = (st: number) => holderOfStage(s.worldSeed, s.rosterKills ?? [], life, stageKey(viewMap, st));
  const look = (st: number, name: string) => {
    const h = holder(st);
    const fs = h ? factionStyle(h.post.faction) : null;
    return h && fs ? portraitOf(fs.style, h.person.female, name) : { pt: FOE_PT, cap: FOE_CAP };
  };
  const nodes: StageNode[] = defs.map((d) => {
    const role = d.kind === 'boss' ? 'boss' : d.kind === 'elite' ? (d.stage === total ? 'warden' : 'aide') : null;
    const h = role ? holder(d.stage) : null;
    const done = isDone(d.stage);
    const tip = h
      ? `<b>${esc(d.name)}</b> · ${esc(h.post.faction)}${esc(h.post.title)}<br>第 ${cnNum(h.term + 1)} 任${done ? ' · 可回刷' : ''}`
      : `第${cnNum(d.stage)}关 · ${esc(d.name)}${done ? ' · 可回刷' : d.stage === next ? ' · 下一关' : ''}`;
    return { stage: d.stage, done, role, pt: role ? look(d.stage, d.name).pt : undefined, tip };
  });

  const narrCtx: NarrCtx | null = enemy ? {
    enemy, route: s.route ?? null, hand: s.worn?.兵器?.cat ?? (s.worn?.暗器 ? '暗器' : 'none'),
    neigongName: s.neigong ? NEIGONG[s.neigong].name : null,
    sqNeed: build.sqNeed, poisonCap: build.poison.cap, seed: battle?.seed ?? 0,
  } : null;

  // 战报 / 战况同一处切换（issue #77）：打完时「战况」亮金点，看过这一场即灭
  const [logTab, setLogTab] = useState<'log' | 'tally'>('log');
  const [tallySeen, setTallySeen] = useState<number | null>(null);
  const hasTally = battle !== null && turns.length > 0;
  const tab = hasTally ? logTab : 'log';
  useEffect(() => { if (tab === 'tally' && battle && battleDone) setTallySeen(battle.seed ?? 0); }, [tab, battle, battleDone]);
  const tallyDot = hasTally && battleDone && tab !== 'tally' && tallySeen !== (battle!.seed ?? 0);

  // 战报跟随最新一段滚动
  const logRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = logRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [battle?.revealed, victory, battle?.reward]);

  // 舞台底图：舆图与有场景图的据点自带画面，收起页底图
  const hasScene = view === 'fight' && open && !!sceneOf(viewMap, total);
  useEffect(() => {
    document.documentElement.classList.toggle('bt-own-art', view === 'map' || hasScene);
    return () => document.documentElement.classList.remove('bt-own-art');
  }, [view, hasScene]);

  if (view === 'map') {
    return (
      <JianghuMap
        unlocked={unlocked} cleared={cleared} hereVol={hereVol} zoomVol={zoomVol} onZoom={setZoomVol}
        onOpen={(m) => { s.selectMap(m); setView('fight'); }}
      />
    );
  }

  const vol = VOLUMES[viewDef.vol - 1];
  const camp = viewDef.faction ? factionStyle(viewDef.faction)?.camp ?? '正' : null;
  const foeLook = enemy ? look(enemy.stage, enemy.name) : { pt: FOE_PT, cap: FOE_CAP };
  const foeHolder = enemy && enemy.kind !== 'normal' ? holder(enemy.stage) : null;

  return (
    <div className="bt-fight">
      <StageScene
        map={viewMap} nodes={nodes} next={next} selected={battle ? battle.stage : idleStage} fighting={fighting}
        onSelect={setViewStage}
      >
        <button type="button" className="bt-back" onClick={() => { setZoomVol(viewDef.vol); setView('map'); }}>← {vol.region}</button>
        <h2>{mapName(viewMap)}</h2>
        <div className="of">
          {camp
            ? <><span className={`seal ${camp === '正' ? 'aide' : 'boss'} camp`}>{camp}</span>{viewDef.faction} · {viewDef.layer === 'gate' ? '门户' : '外围'}</>
            : '赶路'}
        </div>
        <div className="prog">{open ? <>已过 <b>{doneCount}</b> / {total} 关</> : null}</div>
      </StageScene>

      {!open ? (
        <p className="bt-note">{mapName(viewMap)}尚未开启。</p>
      ) : enemy && (
        <>
          <DuelBand
            turns={turns}
            me={{
              name: '你', desc: `${REALMS[s.realm - 1].name}${s.neigong ? ` · ${NEIGONG[s.neigong].name}` : ''}`,
              hp: build.hp * phpPct, hpMax: build.hp, shield: shieldNow > 0 ? shieldNow : undefined,
              qi: qiCap > 0 ? qiNow : undefined, qiMax: qiCap > 0 ? qiCap : undefined,
              pt: HERO_PT, cap: HERO_CAP, ko: lost,
              extra: fx && fx.mine.length > 0 ? <FxRow chips={fx.mine} /> : null,
            }}
            foe={{
              name: enemy.name,
              desc: (
                <>
                  {enemy.kind === 'boss' && <span className="seal-k boss">{bossSeal(enemy)}</span>}
                  {enemy.kind === 'elite' && <span className="seal-k">精英</span>}
                  {enemy.tags.map((t) => (
                    <span
                      key={t} className="jh-tag"
                      data-tip={hasNode(s.ownedRepNodes, 'chongchu_jianghu') ? `${tagLabel(t)} · ${COUNTER_HINTS[t]}` : undefined}
                    >{tagLabel(t)}</span>
                  ))}
                  {foeHolder
                    ? <span data-tip={`第 ${cnNum(foeHolder.term + 1)} 任 · 推荐境界 ${enemy.recommendedRealm}`}>{foeHolder.post.faction}{foeHolder.post.title}</span>
                    : <span>第 {enemy.stage} 关 · 推荐境界 {enemy.recommendedRealm}</span>}
                </>
              ),
              hp: enemy.hp * ehpPct, hpMax: enemy.hp,
              pt: foeLook.pt, cap: foeLook.cap, boss: enemy.kind === 'boss', ko: victory,
              extra: (
                <>
                  {fx && fx.foe.length > 0 && <FxRow chips={fx.foe} />}
                  {enemy.kind !== 'normal' && (
                    <div className="fame">{fameClaimed ? '名号已传' : `首次击败 · 声望 +${fmtBig(fameReward)}`}</div>
                  )}
                </>
              ),
            }}
          />

          <div className="bt-act">
            {fighting ? (
              <button type="button" className="bt-duel-btn" disabled>交手中</button>
            ) : battle && battle.chainAt !== null && battle.chainMode === 'push' && battle.chainStage !== null && !s.failure ? (
              <button type="button" className="bt-duel-btn" disabled>即将挑战第{cnNum(battle.chainStage)}关</button>
            ) : idling ? (
              next !== null && (
                <button type="button" className="bt-duel-btn" onClick={() => s.challengeStage(viewMap, next)}>挑战第{cnNum(next)}关</button>
              )
            ) : isRefarmTarget ? (
              <button type="button" className="bt-duel-btn" onClick={() => s.idleAt(viewMap, idleStage)}>在此挂机</button>
            ) : (
              <button
                type="button" className="bt-duel-btn"
                data-tip={idleEnemy && idleEnemy.kind !== 'normal' ? '精英与 Boss 之战有 15–30 秒演出，不可跳过' : undefined}
                onClick={() => s.challengeStage(viewMap, idleStage)}
              >挑战第{cnNum(idleStage)}关</button>
            )}
            <div className="bt-act-sub">
              {idling && (
                <span className="idle-bar">
                  <span className="pulse" />
                  <span>第 <b>{idling.stage}</b> 关</span>
                  <span className="serif">挂机中</span>
                  <button type="button" className="jh-btn2 quiet" onClick={() => s.stopIdle()}>停止</button>
                </span>
              )}
              {!fighting && !idling && isRefarmTarget && (
                <button type="button" className="jh-btn2 quiet" onClick={() => s.challengeStage(viewMap, idleStage)}>重打一次</button>
              )}
              <label className="bt-chain">
                <input type="checkbox" checked={s.autoChain ?? false} onChange={(e) => s.setAutoChain(e.target.checked)} />
                <span className="box" aria-hidden="true" />
                <span className="t">自动连战</span>
              </label>
            </div>
          </div>
        </>
      )}

      <section className="bt-log-wrap">
        <div className="bt-tabs" role="tablist">
          <button type="button" role="tab" aria-selected={tab === 'log'} className="jh-sec" onClick={() => setLogTab('log')}>战报</button>
          {hasTally && (
            <button type="button" role="tab" aria-selected={tab === 'tally'} className="jh-sec" onClick={() => setLogTab('tally')}>
              战况{tallyDot && <span className="dot" aria-label="新" />}
            </button>
          )}
          {hasTally && (
            <span className={`res${battleDone ? (battle!.result.win ? ' win' : ' lose') : ''}`}>
              {battleDone ? `${battle!.result.win ? '胜' : '败'} · ${battle!.result.rounds} 回合` : `第 ${Math.max(1, last?.rd ?? 1)} 回合`}
            </span>
          )}
        </div>
        {tab === 'tally' && battle && narrCtx ? (
          <BattleTally turns={turns} abStacks={battleDone ? armorBroken(battle.result.stats) : 0} hand={narrCtx.hand} route={narrCtx.route} />
        ) : (
        <div className="bt-log" ref={logRef} role="tabpanel">
          {!!battle?.rumor && <div className="p rumor"><span className="serif">江湖传闻</span>　{RUMORS[battle.rumor as 1 | 2 | 3]}</div>}
          {turns.length === 0 && !battle?.rumor && <div className="empty">尚未交手</div>}
          {narrCtx && <Narration turns={turns} ctx={narrCtx} />}
          {victory && battle.reward && (
            <>
              <div className="p loot">获得：银两 {f0(battle.reward.silver)}{battle.reward.refarm ? '（回刷五成）' : ''}</div>
              {battle.reward.drop && <div className="p loot">首杀掉落：{battle.reward.drop}</div>}
              {battle.reward.wuxue && (
                <div className="p loot">
                  拾得：<span className="serif qi">{WUXUE[battle.reward.wuxue.id].name}</span>
                  {battle.reward.wuxue.kind === 'book' ? (battle.reward.wuxue.dup ? null : ' 全本')
                    : <> 残页 · <span data-tip={formTitle(battle.reward.wuxue.id, battle.reward.wuxue.k)}>{formName(battle.reward.wuxue.k)}</span></>}
                  {battle.reward.wuxue.dup && <span className="dup"> 已有 · 银两 +{battle.reward.wuxue.silver}</span>}
                </div>
              )}
              {battle.reward.gear && (
                <div className="p loot">
                  拾得：<span className={`serif g${battle.reward.gear.grade}`}>{gearFullName(battle.reward.gear)}</span>
                  {battle.reward.gearSold ? `（行囊已满，卖得 ${battle.reward.gearSold} 两）` : ''}
                </div>
              )}
              {(battle.reward.fame ?? 0) > 0 && (
                <div className="p loot">名号传开：挑落{battle.enemy.name}，声望 +{fmtBig(battle.reward.fame!)}</div>
              )}
            </>
          )}
        </div>
        )}
      </section>

      {s.failure && <FailureCeremony goCultivate={goCultivate} />}
    </div>
  );
}

/** 叙事战报：每回合一个抬头，下面一句一段（开战施毒并入第 1 回合） */
function Narration({ turns, ctx }: { turns: TurnEvent[]; ctx: NarrCtx }) {
  let lastRd = 0;
  return (
    <>
      {turns.map((t, i) => {
        const rd = Math.max(1, t.rd);
        const head = rd !== lastRd;
        lastRd = rd;
        const cls = t.kind === 'victory' ? 'p win' : t.kind === 'defeat' ? 'p lose' : 'p';
        return (
          <Fragment key={i}>
            {head && <div className="rh">【第 {rd} 回合】</div>}
            <div className={cls}><Segs segs={narrateTurn(t, ctx)} /></div>
          </Fragment>
        );
      })}
    </>
  );
}

function Segs({ segs }: { segs: Seg[] }) {
  return <>{segs.map((g, i) => (g.k === 'txt' ? <Fragment key={i}>{g.v}</Fragment> : <span key={i} className={g.k}>{g.v}</span>))}</>;
}

/** 普攻一行的称呼跟手里的家伙走（同战报普攻句）：赤手写拳脚（少林拳掌），持兵器写「剑击」之类 */
const PLAIN_LABEL: Record<Hand, string> = { none: '拳脚', 剑: '剑击', 刀: '刀击', 枪: '枪击', 棍: '棍击', 暗器: '暗器' };
/** 路数行配色：毒发毒绿、排山倒海会心橙、反震墨金（金钟），都避开武学青 */
const MECH_ORDER: MechKey[] = ['排山倒海', '毒发', '反震'];
const MECH_CLS: Record<MechKey, string> = { 排山倒海: 'm-burst', 毒发: 'm-poison', 反震: 'm-thorns' };
const TALLY_SKILLS_SHOWN = 6;

/**
 * 战况（issue #77，原型 docs/design/battle-stats-prototype.html）：交手 / 武学两块，一本账不装盒子。
 * 全部从已揭示的回合事件现数（engine/battleTally.ts），交手中逐回合刷新；细项为 0 不画，未出招的武学不列。
 */
function BattleTally({ turns, abStacks, hand, route }: { turns: TurnEvent[]; abStacks: number; hand: Hand; route: NarrCtx['route'] }) {
  const t = tallyTurns(turns);
  const [more, setMore] = useState(false);
  const skills = Object.entries(t.skills)
    .filter(([, v]) => v.casts > 0)
    .map(([id, v]) => ({ key: id, name: WUXUE[id as WuxueId]?.name ?? id, cnt: `${v.casts} 招`, dmg: v.dmg, cls: '' }))
    .sort((a, b) => b.dmg - a.dmg);
  const tail = [
    ...MECH_ORDER.filter((k) => (t.mech[k]?.dmg ?? 0) > 0)
      .map((k) => ({ key: k, name: k, cnt: k === '排山倒海' ? `${t.mech[k]!.n} 次` : '', dmg: t.mech[k]!.dmg, cls: `mech ${MECH_CLS[k]}` })),
    { key: 'plain', name: hand === 'none' && route === 'shaolin' ? '拳掌' : PLAIN_LABEL[hand], cnt: `${t.plain.n} 下`, dmg: t.plain.dmg, cls: 'plain' },
  ];
  const max = Math.max(1, ...skills.map((r) => r.dmg), ...tail.map((r) => r.dmg));
  const shown = more ? skills : skills.slice(0, TALLY_SKILLS_SHOWN);
  const rest = skills.length - shown.length;
  const row = (r: (typeof tail)[number]) => (
    <div key={r.key} className={`wx ${r.cls}`} data-tip={`${r.name}　伤害 ${f0(r.dmg)}`}>
      <span className="n">{r.name}</span>
      <span className="c">{r.cnt}</span>
      <span className="bar"><i style={{ transform: `scaleX(${r.dmg / max})` }} /></span>
      <span className="p">{rate(r.dmg, t.out)}%</span>
    </div>
  );
  const li = (k: string, v: string, sub = false) => (
    <div className={`li${sub ? ' sub' : ''}`}><span className="k">{k}</span><span className="lead" /><span className="v">{v}</span></div>
  );
  return (
    <div className="bt-tally" role="tabpanel">
      <div className="grp">
        <div className="sh">交手</div>
        <div className="ledger">
          {li('出手', String(t.acts))}
          {li('出招率', `${rate(t.casts, t.acts)}%`)}
          {li('命中', `${rate(t.hits, t.acts)}%`)}
          {li('会心', `${rate(t.crits, t.hits)}%`)}
          {li('闪避', `${rate(t.dodges, t.foeActs)}%`)}
        </div>
        <div className="ledger dmg">
          {li('输出', f0(t.out))}
          {t.maxHit > 0 && li('最重一击', f0(t.maxHit), true)}
          {li('承伤', f0(t.taken))}
          {t.shield > 0 && li('护盾吸收', f0(t.shield), true)}
          {t.thornsIn > 0 && li('受反伤', f0(t.thornsIn), true)}
          {abStacks > 0 && li('身中破甲', `${abStacks} 层`, true)}
          {t.purged > 0 && li('毒被化解', `${t.purged} 次`, true)}
        </div>
      </div>
      <div className="wxb">
        <div className="sh">武学</div>
        {shown.map(row)}
        {rest > 0 && <button type="button" className="more" onClick={() => setMore(true)}>余 {rest} 门</button>}
        {tail.map(row)}
      </div>
    </div>
  );
}

/** 战败演出（原型 #d-fail）：不写败因长句，诊断与战报统计放进「剩余气血」一行的悬停 */
function FailureCeremony({ goCultivate }: { goCultivate: () => void }) {
  const s = useGameStore();
  const f = s.failure!;
  const st = f.stats;
  const breakCost = effBreakCost(s);
  const chargePct = breakCost !== null ? Math.min(100, Math.round((s.dantian / breakCost) * 100)) : 100;
  const outPct = (v: number) => (st.dmgDealt > 0 ? Math.round((v / st.dmgDealt) * 100) : 0);
  const left = Math.round(f.enemyHpPct * 100);
  // 推关输了、有关可退：倒计时不选就退回挂机（裁决 44；原型 idle-ux-prototype.html ②）
  const b = s.battle;
  const back = b && b.resolved && b.mode === 'push' && b.chainMode === 'idle' && b.chainAt !== null ? b.chainStage : null;
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (back === null) return;
    const id = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(id);
  }, [back]);
  const left5 = back !== null ? Math.max(1, Math.ceil((b!.chainAt! - now) / 1000)) : 0;

  // 悬停：诊断（公式表 §5）+ 战报（battle.md §2）
  const tip = [
    `<b>${esc(DIAG_TEXTS[f.diagCodes[0]])}</b>`,
    ...(f.diagCodes[1] ? [`另：${esc(DIAG_TEXTS[f.diagCodes[1]])}`] : []),
    '',
    `历时 ${f.rounds} / 50 回合`,
    `我方输出 ${f0(st.dmgDealt)}（敌余 ${left}%）`,
    `我方承伤 ${f0(st.dmgTaken)}（余 ${Math.round(f.playerHpPct * 100)}%）`,
    `实际命中 ${Math.round(f.hitRate * 100)}%`,
    ...(f.route === 'huashan' ? [`会心 ${st.critCount} 次 · 排山倒海 ${st.burstCount} 次（占输出 ${outPct(st.burstDmg)}%）`] : []),
    ...(f.route === 'shaolin' ? [`护盾吸收 ${f0(st.shieldAbsorbed)} · 反伤输出 ${f0(st.thornsOut)}（占输出 ${outPct(st.thornsOut)}%）`] : []),
    ...(f.route === 'tangmen' ? [`毒伤占输出 ${outPct(st.poisonDmg)}% · 毒爆 ${st.poisonBurstCount} 次 · 毒层被清 ${st.purgeCount} 次`] : []),
    ...(st.abStacksMax > 0 ? [`身中破甲 ${st.abStacksMax} 层`] : []),
    ...(st.thornsTaken > 0 ? [`承受反伤 ${f0(st.thornsTaken)}`] : []),
  ].join('<br>');

  // 第一世 1-7 战败：隐世前辈出场（battle-loot/design.md §5.1），起身行礼后进传功
  if (isTeachFailure(s)) {
    return createPortal(
      <div className="jh-ceremony cold" role="dialog" aria-label="战败">
        <div>
          <div className="kick">战 败</div>
          <h2 className="mid">{f.enemyName}</h2>
          <div className="d">第 {f.stage} 关 · 鏖战 {f.rounds} 回合</div>
          <div className="bt-fail-left">
            <div className="lbl"><span>剩余气血</span><span>{left}%</span></div>
            <div className="jh-ink-bar hp"><i style={{ width: `${left}%` }} /></div>
          </div>
          <div className="story">
            村口的地痞终究只是地痞。这一回你撞上的是真正在江湖上混饭吃的人，拳脚之间自有章法，你的蛮力一到他面前便散了。
            <br /><br />倒在路边喘气的时候，一位背着药篓的老者停在你跟前，看了你半晌：<em>「根骨尚可，可惜没人教。」</em>
          </div>
          <div className="acts">
            <button type="button" className="jh-btn" onClick={() => s.dismissFailure()}>起身行礼</button>
          </div>
        </div>
      </div>,
      document.body,
    );
  }

  // 挂到 body：舞台 .jh-stage 自成层叠上下文（isolation），留在里面会被侧栏压住，盖不满整屏
  return createPortal(
    <div className="jh-ceremony cold" role="dialog" aria-label="战败">
      <div>
        <div className="kick">战 败</div>
        <h2 className="mid">{f.enemyName}</h2>
        <div className="d">第 {f.stage} 关 · 鏖战 {f.rounds} 回合</div>
        <div className="bt-fail-left" data-tip={tip}>
          <div className="lbl"><span className="jh-dotted">剩余气血</span><span>{left}%</span></div>
          <div className="jh-ink-bar hp"><i style={{ width: `${left}%` }} /></div>
        </div>
        <div className="acts">
          {back !== null ? (
            <>
              <button type="button" className="jh-btn quiet" onClick={() => s.retryFailed()}>再战一场</button>
              <button type="button" className="jh-btn count" onClick={() => s.retreatNow()}>
                退回第 {back} 关挂机<span className="left">{left5}</span>
              </button>
            </>
          ) : (
            <>
              <button type="button" className="jh-btn quiet" onClick={() => { s.dismissFailure(); s.challengeStage(f.map, f.stage); }}>
                再战一场
              </button>
              <button type="button" className="jh-btn" onClick={() => { s.dismissFailure(); goCultivate(); }}>
                回去修炼 · 周天 <span className="n">{chargePct}</span>%
              </button>
            </>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}
