/**
 * 战斗页 —— 基准：docs/design/ui-overhaul-prototype.html `#p-battle` / `#d-fail` + DESIGN.md（issue #26 视觉大改）。
 * 结构：页头（地图名 + 难度进度 + 难度切换）→ 江湖路驿站 → 关卡进度线与眼前一段 → 对阵（无底框）→ 挑战按钮 → 叙事战报。
 * 战报句子来自 engine/narration.ts（冻结文案 docs/rules/copy/battle-narration.md），收获行见其 §7。
 */
import { Fragment, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { RUMOR } from '../engine/sect';
import { DIAG_TEXTS, type FightResult, type TurnEvent } from '../engine/combat';
import { WUXUE, type WuxueId } from '../engine/wuxue';
import { NEIGONG } from '../engine/neigong';
import { REALMS } from '../engine/content';
import {
  getStage, isSealed, MAP_IDS, mapName, stageKey, TIER_NAMES, TIERS, trackLength,
  type EnemyDef, type EnemyTag, type TierId,
} from '../engine/enemies';
import { narrateTurn, type NarrCtx, type Seg } from '../engine/narration';
import { COUNTER_HINTS, FAME_BOSS, FAME_ELITE, hasNode } from '../engine/prestige';
import {
  currentMult, effBreakCost, mapUnlocked, nextStageOf, playerBuild, tierUnlocked,
  qiMaxOf, useGameStore, type MapNo,
} from '../store/gameStore';
import { fmtBig } from '../fmt';

const f0 = (n: number) => fmtBig(Math.round(n));
/** data-tip 走 innerHTML：拼进去的名字统一转义 */
const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!));

/** 未解锁时的解锁条件（封存另显「大周天未开」） */
function unlockHint(map: MapNo, tier: TierId): string {
  if (tier === 0) return `击败${mapName((map - 1) as MapNo)} · 初入 Boss 后开启`;
  return `击败${mapName(map)} · ${TIER_NAMES[(tier - 1) as TierId]} Boss 后开启`;
}

/** 标签展示名：内部值「毒」UI 显示「剧毒」（retire-copy §7） */
const tagLabel = (t: EnemyTag) => (t === '毒' ? '剧毒' : t);

/** Boss 印章字：段末是 Boss，段中是头目 */
const bossSeal = (e: EnemyDef) => (e.stage === trackLength(e.map, e.tier) ? 'Boss' : '头目');

export function BattlePane({ goCultivate }: { goCultivate: () => void }) {
  const s = useGameStore();
  const cleared = s.clearedStages;
  const unlocked = s.tiersUnlocked ?? ['1-0'];
  const viewMap = s.selectedMap;
  const viewTier = s.selectedTier;
  // 只展示当前所选地图 / 难度上的战斗
  const battle = s.battle && s.battle.map === viewMap && s.battle.tier === viewTier ? s.battle : null;
  const sealed = isSealed(viewMap, viewTier);
  const open = tierUnlocked(viewMap, viewTier, unlocked);
  const total = trackLength(viewMap, viewTier);
  const next = open ? nextStageOf(viewMap, viewTier, cleared) : null;
  const build = playerBuild(s);
  const qiCap = qiMaxOf(s);
  const isDone = (st: number) => cleared.includes(stageKey(viewMap, viewTier, st));

  // 选关（已通关卡可回刷；默认跟随下一关，全通默认末关）
  const [viewStage, setViewStage] = useState<number | null>(null);
  const [showAll, setShowAll] = useState(false);
  useEffect(() => setViewStage(null), [viewMap, viewTier]);
  const idleStage = viewStage ?? next ?? total;
  const isRefarmTarget = isDone(idleStage);

  const turns = battle ? battle.result.turns.slice(0, battle.revealed) : [];
  const last = turns[turns.length - 1];
  const fighting = battle !== null && !battle.resolved;
  const battleDone = battle ? battle.revealed >= battle.result.turns.length : false;
  const victory = battle !== null && battleDone && battle.result.win;
  const lost = battle !== null && battleDone && !battle.result.win;
  const phpPct = last ? last.phpPct : 1;
  const ehpPct = last ? last.ehpPct : 1;
  // 少林护体：气血墨条上的浅蓝护盾段，自左端伸展、扣盾时右缘削减（2026-07-07 UI 裁决）
  const shieldNow = build.shieldPct > 0 ? (last ? last.pShield : build.hp * build.shieldPct) : 0;
  const qiNow = battle && last && (s.equipped ?? []).length > 0 ? last.pQi : qiCap;
  const idleEnemy = open && total > 0 ? getStage(viewMap, viewTier, idleStage) : null;
  const enemy = battle ? battle.enemy : idleEnemy;

  // 名号：精英 / Boss 首次击败给声望（economy.md §1.3），跨世只一次
  const fameKey = enemy ? `stage:${stageKey(enemy.map, enemy.tier, enemy.stage)}` : '';
  const fameClaimed = (s.fameClaimed ?? []).includes(fameKey);
  const fameReward = enemy && enemy.kind !== 'normal'
    ? Math.floor((enemy.kind === 'boss' ? FAME_BOSS : FAME_ELITE) * currentMult(s)) : 0;

  // 页头进度：已过关数、精英首杀
  const stages = Array.from({ length: total }, (_, i) => i + 1);
  const defs = open ? stages.map((st) => getStage(viewMap, viewTier, st)) : [];
  const doneCount = stages.filter(isDone).length;
  const elites = defs.filter((d) => d.kind === 'elite');
  const eliteDone = elites.filter((d) => isDone(d.stage)).length;

  const narrCtx: NarrCtx | null = enemy ? {
    enemy, route: s.route ?? null, neigongName: s.neigong ? NEIGONG[s.neigong].name : null,
    sqNeed: build.sqNeed, poisonCap: build.poison.cap,
  } : null;

  // 战报跟随最新一段滚动
  const logRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = logRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [battle?.revealed, victory, battle?.reward]);

  const stageBtn = (st: number) => {
    const d = defs[st - 1];
    const done = isDone(st);
    const cur = st === next;
    const sel = st === (battle ? battle.stage : idleStage);
    const cls = [done && 'done', d.kind !== 'normal' && d.kind, cur && 'cur', sel && !cur && 'sel'].filter(Boolean).join(' ');
    return (
      <button
        key={st} type="button" className={cls} disabled={(!done && !cur) || fighting}
        data-tip={`第 ${st} 关 · ${esc(d.name)}${done ? ' · 可回刷' : cur ? ' · 下一关' : ''}`}
        onClick={() => setViewStage(st)}
      >{st}</button>
    );
  };

  // 眼前一段：下一关前 3 关到后 6 关，首末关常驻
  const anchor = next ?? total;
  const from = Math.max(1, anchor - 3);
  const to = Math.min(total, anchor + 6);

  // 江湖路已走过的一段：从第一站圆点量到当前站圆点（站名宽度不一，只能量）
  const roadRef = useRef<HTMLDivElement>(null);
  const [walked, setWalked] = useState<{ left: number; width: number }>({ left: 0, width: 0 });
  useLayoutEffect(() => {
    const measure = () => {
      const dots = roadRef.current?.querySelectorAll<HTMLElement>('.station .dot');
      if (!dots || dots.length === 0) return;
      const base = roadRef.current!.getBoundingClientRect().left;
      const mid = (el: HTMLElement) => { const r = el.getBoundingClientRect(); return r.left + r.width / 2 - base; };
      const first = mid(dots[0]);
      setWalked({ left: first, width: mid(dots[MAP_IDS.indexOf(viewMap)]) - first });
    };
    measure();
    addEventListener('resize', measure);
    return () => removeEventListener('resize', measure);
  }, [viewMap]);

  return (
    <>
      <header className="jh-head">
        <div>
          <h1>{mapName(viewMap)}</h1>
          <div className="sub">
            {sealed ? '大周天未开'
              : !open ? `${TIER_NAMES[viewTier]} · 未开启`
                : <>{TIER_NAMES[viewTier]} · 已过 <b>{doneCount}</b> / {total} 关{elites.length > 0 && <> · 精英首杀 <b>{eliteDone}</b> / {elites.length}</>}</>}
          </div>
        </div>
        {!isSealed(viewMap, 0) && (
          <div className="jh-seg bt-tiers" role="group" aria-label="难度">
            {TIERS.map((t) => {
              const tSealed = isSealed(viewMap, t);
              const tOpen = tierUnlocked(viewMap, t, unlocked);
              const tip = tSealed ? '大周天未开' : !tOpen ? unlockHint(viewMap, t) : undefined;
              return (
                <button
                  key={t} type="button" aria-pressed={t === viewTier} aria-disabled={!tOpen || undefined}
                  data-tip={tip} onClick={() => tOpen && s.selectTier(t)}
                >{TIER_NAMES[t]}</button>
              );
            })}
          </div>
        )}
      </header>

      {/* 江湖路：五张地图是一条路上的驿站；未开的悬停说明缘由 */}
      <div className="bt-road" ref={roadRef}>
        <div className="walked" style={{ left: walked.left, width: walked.width }} />
        {MAP_IDS.map((m) => {
          const ok = mapUnlocked(m, unlocked);
          const why = isSealed(m, 0) ? '大周天未开' : !ok ? unlockHint(m, 0) : '';
          return (
            <button
              key={m} type="button" className={`station${ok ? ' open' : ''}${m === viewMap ? ' here' : ''}`}
              aria-disabled={!ok || undefined} onClick={() => ok && s.selectMap(m)}
            >
              <span className="dot" /><span className="nm">{mapName(m)}</span>
              {why && <span className="why">{why}</span>}
            </button>
          );
        })}
      </div>

      {sealed || !open ? (
        <p className="bt-note">
          {sealed
            ? `大周天未开 · 小周天止于任督俱通，${mapName(viewMap)}之险留待下一版；本版最终一战在蜀道险关 · 初入的尽头。`
            : `${TIER_NAMES[viewTier]}尚未开启 · ${unlockHint(viewMap, viewTier)}。`}
        </p>
      ) : (
        <>
          <div className="bt-track">
            <div className="tbar">
              <div className="rail-line" />
              <div className="fill" style={{ width: `${((next ?? total + 1) - 1) / total * 100}%` }} />
              {defs.filter((d) => d.kind !== 'normal').map((d) => (
                <span
                  key={d.stage} className={`mk ${d.kind}${isDone(d.stage) ? ' got' : ''}`}
                  style={{ left: `${(d.stage - 0.5) / total * 100}%` }}
                  data-tip={`第 ${d.stage} 关 · ${esc(d.name)}${isDone(d.stage) ? '（已首杀）' : ''}`}
                />
              ))}
              {next !== null && <span className="here" style={{ left: `${(next - 0.5) / total * 100}%` }} />}
            </div>
            <div className="meta">
              <span>
                {next !== null
                  ? <>下一关 <b>第 {next} 关</b>{next < total ? ` · 距 Boss 还有 ${total - next} 关` : ' · Boss'}</>
                  : '本难度已全部通关 · 任一关可回刷'}
              </span>
              <button type="button" onClick={() => setShowAll((v) => !v)}>{showAll ? '收起 ▴' : '全部关卡 ▾'}</button>
            </div>
            <div className="near">
              {from > 1 && <>{stageBtn(1)}<span className="gap">…</span></>}
              {stages.slice(from - 1, to).map(stageBtn)}
              {to < total && <><span className="gap">…</span>{stageBtn(total)}</>}
            </div>
            {showAll && <div className="all">{stages.map(stageBtn)}</div>}
          </div>

          {enemy && (
            <div className="bt-arena">
              <div className="duel">
                <div className="side">
                  <div className="name">你</div>
                  <div className="desc">{REALMS[s.realm - 1].name}{s.neigong ? ` · ${NEIGONG[s.neigong].name}` : ''}</div>
                  <div className="meter">
                    <div className="lbl">
                      <span>气血</span>
                      <span>{shieldNow > 0 && <em className="shield-n">护体 {f0(shieldNow)}　</em>}<b>{f0(build.hp * phpPct)}</b> / {f0(build.hp)}</span>
                    </div>
                    <div className="jh-ink-bar hp">
                      <i style={{ width: `${phpPct * 100}%` }} />
                      {shieldNow > 0 && <em className="shield" style={{ width: `${Math.min(shieldNow / build.hp, 1) * 100}%` }} />}
                    </div>
                  </div>
                  {qiCap > 0 && (
                    <div className="meter">
                      <div className="lbl"><span>真气</span><span><b>{f0(qiNow)}</b> / {f0(qiCap)}</span></div>
                      <div className="jh-ink-bar qi"><i style={{ width: `${Math.min(1, qiNow / qiCap) * 100}%` }} /></div>
                    </div>
                  )}
                  {fighting && last && build.sqNeed < 99 && (
                    <div className="state">剑意 {Math.floor(last.pSq)} / {build.sqNeed}</div>
                  )}
                </div>

                <div className="vs">
                  <span className="big">{victory ? '胜' : lost ? '败' : fighting ? '交手' : '对决'}</span>
                  <span className="rd">{fighting && last ? `第 ${Math.max(1, last.rd)} 回合` : battleDone ? `${battle!.result.rounds} 回合` : ''}</span>
                </div>

                <div className="side enemy">
                  <div className="name">
                    {enemy.kind === 'boss' && <span className="seal">{bossSeal(enemy)}</span>}
                    {enemy.kind === 'elite' && <span className="seal elite">精英</span>}
                    {enemy.tags.map((t) => (
                      <span
                        key={t} className="jh-tag"
                        data-tip={hasNode(s.ownedRepNodes, 'zairu_jianghu') ? `${tagLabel(t)} · ${COUNTER_HINTS[t]}` : undefined}
                      >{tagLabel(t)}</span>
                    ))}
                    {enemy.name}
                  </div>
                  <div className="desc">第 {enemy.stage} 关 · 推荐境界 {enemy.recommendedRealm}</div>
                  <div className="meter">
                    <div className="lbl"><span>气血</span><span><b>{f0(enemy.hp * ehpPct)}</b> / {f0(enemy.hp)}</span></div>
                    <div className="jh-ink-bar hp"><i style={{ width: `${ehpPct * 100}%` }} /></div>
                  </div>
                  {fighting && last && build.poison.cap > 0 && (
                    <div className="state">身中毒 {Math.round(last.ePoison)} / {build.poison.cap} 层</div>
                  )}
                  {enemy.kind !== 'normal' && (
                    <div className="fame">{fameClaimed ? '名号已传' : `首次击败 · 声望 +${fmtBig(fameReward)}`}</div>
                  )}
                </div>
              </div>

              <div className="act">
                {fighting ? (
                  <button type="button" className="jh-btn fight" disabled>交手中 · 第 {Math.max(1, last?.rd ?? 1)} 回合</button>
                ) : (
                  <button
                    type="button" className="jh-btn fight"
                    data-tip={isRefarmTarget
                      ? '已通关的关卡只掉五成银两，连续重打同一关逐次递减（间隔 10 分钟重置）'
                      : idleEnemy && idleEnemy.kind !== 'normal' ? '精英与 Boss 之战有 15–30 秒演出，不可跳过' : undefined}
                    onClick={() => s.challengeStage(viewMap, viewTier, idleStage)}
                  >
                    {isRefarmTarget ? '重打' : '挑战'} · 第<span className="n">{idleStage}</span>关
                  </button>
                )}
                <label className="bt-switch" data-tip="胜后自动打下一关；重打的关胜后原地再打；输了自动停下">
                  <input type="checkbox" checked={s.autoAdvance} onChange={(e) => s.setAutoAdvance(e.target.checked)} />
                  自动连战
                </label>
              </div>
            </div>
          )}
        </>
      )}

      <section className="bt-log-wrap">
        <h2 className="jh-sec">战报</h2>
        <div className="bt-log" ref={logRef}>
          {battle?.rumor && <div className="p rumor"><span className="serif">江湖传闻</span>　{RUMOR}</div>}
          {turns.length === 0 && !battle?.rumor && <div className="empty">尚未交手</div>}
          {narrCtx && <Narration turns={turns} ctx={narrCtx} />}
          {victory && battle.reward && (
            <>
              <div className="p loot">获得：银两 {f0(battle.reward.silver)}{battle.reward.refarm ? '（回刷五成）' : ''}</div>
              {battle.reward.drop && <div className="p loot">首杀掉落：{battle.reward.drop}</div>}
              {(battle.reward.fame ?? 0) > 0 && (
                <div className="p loot">名号传开：挑落{battle.enemy.name}，声望 +{fmtBig(battle.reward.fame!)}</div>
              )}
            </>
          )}
        </div>
      </section>

      {battle && battleDone && battle.result.stats.casts > 0 && <CastStats stats={battle.result.stats} />}

      {s.failure && <FailureCeremony goCultivate={goCultivate} />}
    </>
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

/** 武学出招统计（spec §4.7）：每门武学出招次数、伤害占比；路数机制与普攻也列出，便于看出机制没有变弱 */
function CastStats({ stats }: { stats: FightResult['stats'] }) {
  const total = stats.dmgDealt || 1;
  const skillSum = Object.values(stats.skillDmg).reduce((a, b) => a + b, 0);
  const mech = stats.burstDmg + stats.thornsOut + stats.poisonDmg;
  const plain = Math.max(0, total - skillSum - mech);
  const rows: { name: string; n: string; dmg: number; serif: boolean }[] = [
    ...Object.entries(stats.skillCasts)
      .sort((a, b) => (stats.skillDmg[b[0]] ?? 0) - (stats.skillDmg[a[0]] ?? 0))
      .map(([id, n]) => ({ name: WUXUE[id as WuxueId].name, n: `出招 ${n} 次`, dmg: stats.skillDmg[id] ?? 0, serif: true })),
    { name: '路数机制', n: stats.burstCount > 0 ? `剑招 ${stats.burstCount} 次` : '', dmg: mech, serif: false },
    { name: '普攻', n: '', dmg: plain, serif: false },
  ];
  return (
    <div className="jh-card bt-casts">
      <div className="head"><span className="serif">武学出招</span><small>本场出招 {stats.casts} 次</small></div>
      <div className="jh-rows">
        {rows.map((r) => (
          <div key={r.name} className="jh-row">
            <div className="t"><span className={r.serif ? 'serif' : 'plain'}>{r.name}</span>{r.n && <small>{r.n}</small>}</div>
            <div className="a">
              <span className="share"><i style={{ width: `${(r.dmg / total) * 100}%` }} /></span>
              <span className="pct">{Math.round((r.dmg / total) * 100)}%</span>
            </div>
          </div>
        ))}
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

  // 悬停：诊断（公式表 §5）+ 战报（battle.md §2）
  const tip = [
    `<b>${esc(DIAG_TEXTS[f.diagCodes[0]])}</b>`,
    ...(f.diagCodes[1] ? [`另：${esc(DIAG_TEXTS[f.diagCodes[1]])}`] : []),
    '',
    `历时 ${f.rounds} / 50 回合`,
    `我方输出 ${f0(st.dmgDealt)}（敌余 ${left}%）`,
    `我方承伤 ${f0(st.dmgTaken)}（余 ${Math.round(f.playerHpPct * 100)}%）`,
    `实际命中 ${Math.round(f.hitRate * 100)}%`,
    ...(f.route === 'huashan' ? [`暴击 ${st.critCount} 次 · 爆发剑招 ${st.burstCount} 次（占输出 ${outPct(st.burstDmg)}%）`] : []),
    ...(f.route === 'shaolin' ? [`护盾吸收 ${f0(st.shieldAbsorbed)} · 反伤输出 ${f0(st.thornsOut)}（占输出 ${outPct(st.thornsOut)}%）`] : []),
    ...(f.route === 'tangmen' ? [`毒伤占输出 ${outPct(st.poisonDmg)}% · 毒爆 ${st.poisonBurstCount} 次 · 毒层被清 ${st.purgeCount} 次`] : []),
    ...(st.abStacksMax > 0 ? [`身中破甲 ${st.abStacksMax} 层`] : []),
    ...(st.thornsTaken > 0 ? [`承受反伤 ${f0(st.thornsTaken)}`] : []),
  ].join('<br>');

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
          <button type="button" className="jh-btn quiet" onClick={() => { s.dismissFailure(); s.challengeStage(f.map, f.tier, f.stage); }}>
            立即重试
          </button>
          <button type="button" className="jh-btn" onClick={() => { s.dismissFailure(); goCultivate(); }}>
            回去修炼 · 周天 <span className="n">{chargePct}</span>%
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
