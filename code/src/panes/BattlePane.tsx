/** 战斗页 —— 地图 × 难度 × 关（长线原型 docs/design/longline-prototype.html §1；风格随 issue #26 整改） */
import { useEffect, useRef, useState } from 'react';
import { DIAG_TEXTS, type FightResult } from '../engine/combat';
import { WUXUE, type WuxueId } from '../engine/wuxue';
import { REALMS } from '../engine/content';
import {
  getStage, isSealed, MAP_IDS, mapName, stageKey, TIER_NAMES, TIERS, trackLength,
  type EnemyTag, type TierId,
} from '../engine/enemies';
import { COUNTER_HINTS, FAME_BOSS, FAME_ELITE, hasNode } from '../engine/prestige';
import { ROUTES } from '../engine/routes';
import {
  currentMult, effBreakCost, mapUnlocked, nextStageOf, openFronts, playerBuild, tierUnlocked,
  qiMaxOf, useGameStore, type MapNo,
} from '../store/gameStore';
import { fmtBig } from '../fmt';

const f0 = (n: number) => fmtBig(Math.round(n));


/** 未解锁时的解锁条件（封存另显「大周天未开」） */
function unlockHint(map: MapNo, tier: TierId): string {
  if (tier === 0) return `通关${mapName((map - 1) as MapNo)} · 初入解锁`;
  return `通关${mapName(map)} · ${TIER_NAMES[(tier - 1) as TierId]} Boss 解锁`;
}

export function BattlePane({ goCultivate }: { goCultivate: () => void }) {
  const s = useGameStore();
  const cleared = s.clearedStages;
  const unlocked = s.tiersUnlocked ?? ['1-0'];
  const viewMap = s.selectedMap;
  const viewTier = s.selectedTier;
  const fronts = openFronts(s);
  const isFront = (m: MapNo, t?: TierId) => fronts.some((f) => f.map === m && (t === undefined || f.tier === t));
  // 只展示当前前沿上的战斗；其它前沿的战斗不占对阵位
  const battle = s.battle && s.battle.map === viewMap && s.battle.tier === viewTier ? s.battle : null;
  const sealed = isSealed(viewMap, viewTier);
  const open = tierUnlocked(viewMap, viewTier, unlocked);
  const total = trackLength(viewMap, viewTier);
  const next = open ? nextStageOf(viewMap, viewTier, cleared) : null;
  const build = playerBuild(s);
  const qiCap = qiMaxOf(s);
  const hasLoadout = (s.equipped ?? []).length > 0;

  // 选关（已通关卡可回刷；默认跟随推进关卡，全通默认末关）
  const [viewStage, setViewStage] = useState<number | null>(null);
  useEffect(() => setViewStage(null), [viewMap, viewTier]);
  const idleStage = viewStage ?? next ?? total;
  const isRefarmTarget = cleared.includes(stageKey(viewMap, viewTier, idleStage));

  const revealedTurns = battle ? battle.result.turns.slice(0, battle.revealed) : [];
  const last = revealedTurns[revealedTurns.length - 1];
  const phpPct = last ? last.phpPct : 1;
  const ehpPct = last ? last.ehpPct : 1;
  // 少林金钟护盾：气血条上的浅蓝护盾段（所有者 2026-07-07 UI 裁决，07-07 二裁：
  // 自血条左端向右伸展、覆盖在气血层之上；扣盾时右缘向左削减）。
  const shieldNow = build.shieldPct > 0 ? (last ? last.pShield : build.hp * build.shieldPct) : 0;
  const hpNow = build.hp * phpPct;
  const idleEnemy = open && total > 0 ? getStage(viewMap, viewTier, idleStage) : null;
  const enemy = battle ? battle.enemy : idleEnemy;
  const battleDone = battle ? battle.revealed >= battle.result.turns.length : false;
  const victory = battle !== null && battleDone && battle.result.win;
  // 名号：精英 / Boss 首次击败给声望（economy.md §1.3），跨世只一次
  const fameKey = enemy ? `stage:${stageKey(enemy.map, enemy.tier, enemy.stage)}` : '';
  const fameClaimed = (s.fameClaimed ?? []).includes(fameKey);
  const fameReward = enemy && enemy.kind !== 'normal'
    ? Math.floor((enemy.kind === 'boss' ? FAME_BOSS : FAME_ELITE) * currentMult(s)) : 0;

  // 战斗日志跟随最新行滚动
  const logRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = logRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [battle?.revealed, victory]);

  return (
    <div className="pane-wrap wide">
      <section className="panel">
        <div className="map-tabs">
          {MAP_IDS.map((m) => {
            const mapSealed = isSealed(m, 0);
            const ok = mapUnlocked(m, unlocked);
            const opened = TIERS.filter((t) => tierUnlocked(m, t, unlocked)).length;
            return (
              <div
                key={m}
                className={`map-tab${viewMap === m ? ' active' : ''}${mapSealed ? ' sealed' : ok ? '' : ' locked'}`}
                onClick={() => s.selectMap(m)}
              >
                {mapName(m)}
                <span className="prog">
                  {mapSealed ? '大周天未开' : !ok ? unlockHint(m, 0) : `已开 ${opened} 档`}
                </span>
                {isFront(m) && <span className="front-dot" title="今天有关可推" />}
              </div>
            );
          })}
        </div>

        {!isSealed(viewMap, 0) && (
          <div className="tier-row">
            <span className="lbl">难度</span>
            <div className="tiers" role="group" aria-label="难度">
              {TIERS.map((t) => {
                const tSealed = isSealed(viewMap, t);
                const tOpen = tierUnlocked(viewMap, t, unlocked);
                const tTotal = trackLength(viewMap, t);
                const tDone = Array.from({ length: tTotal }, (_, i) => i + 1)
                  .filter((i) => cleared.includes(stageKey(viewMap, t, i))).length;
                const cls = tSealed ? ' sealed' : !tOpen ? ' locked' : tDone === tTotal ? ' cleared' : '';
                return (
                  <button
                    key={t}
                    type="button"
                    className={`tier${cls}`}
                    aria-pressed={t === viewTier}
                    onClick={() => s.selectTier(t)}
                  >
                    <span className="tn serif">{TIER_NAMES[t]}</span>
                    <span className="ts">{tSealed ? '大周天未开' : !tOpen ? '未解锁' : `${tDone} / ${tTotal}`}</span>
                    {isFront(viewMap, t) && <span className="front-dot" />}
                  </button>
                );
              })}
            </div>
            <span className="tier-hint">
              {sealed ? '' : !open ? unlockHint(viewMap, viewTier)
                : isFront(viewMap, viewTier) ? '前沿 · 今天可推' : '本档已通，归隐后重推'}
            </span>
          </div>
        )}

        {sealed ? (
          <div className="sealed-card">
            <div className="t serif">大周天未开</div>
            <div className="d">
              小周天止于任督俱通。{mapName(viewMap)}{viewMap === 5 ? '' : ` · ${TIER_NAMES[viewTier]}`}之险，留待下一版大周天。<br />
              本版的最终一战在蜀道险关 · 初入的尽头。
            </div>
          </div>
        ) : !open ? (
          <div className="sealed-card locked">
            <div className="t serif">未解锁</div>
            <div className="d">{unlockHint(viewMap, viewTier)}</div>
          </div>
        ) : (
        <>
        {/* 选关条：已通关卡可点选回刷，当前推进关金色，未解锁灰置；精英标「精」、Boss / 头目标「首」 */}
        <div className="stage-strip">
          {Array.from({ length: total }, (_, i) => i + 1).map((st) => {
            const done = cleared.includes(stageKey(viewMap, viewTier, st));
            const isNext = st === next;
            const locked = !done && !isNext;
            const def = getStage(viewMap, viewTier, st);
            const active = st === (battle ? battle.stage : idleStage);
            return (
              <button
                key={st}
                disabled={locked || (battle !== null && !battleDone)}
                className={`stage-pill${done ? ' done' : ''}${isNext ? ' next' : ''}${active ? ' active' : ''}${def.kind === 'elite' ? ' elite' : def.kind === 'boss' ? ' boss' : ''}`}
                title={`第 ${st} 关 · ${def.name}${done ? '（已通关 · 可回刷）' : isNext ? '（当前推进）' : '（未解锁）'}`}
                onClick={() => setViewStage(st)}
              >
                {st}{def.kind === 'elite' ? <span className="k">精</span> : def.kind === 'boss' ? <span className="k">首</span> : null}
              </button>
            );
          })}
        </div>

        <div className="battle-stage">
          {enemy ? (
            <>
              <div className="fighters">
                <div className="fighter">
                  <div className="fname serif">
                    你 {s.route && <span className={`tag route-tag-${s.route}`}>{ROUTES[s.route].name.slice(0, 2)}</span>}
                  </div>
                  <div className="frealm">{REALMS[s.realm - 1].name} · 境界 {s.realm}</div>
                  <div className="hp-num">
                    <span>气血</span>
                    <span>
                      {f0(hpNow)} / {f0(build.hp)}
                      {shieldNow > 0 && <b className="shield-num">盾 {f0(shieldNow)}</b>}
                    </span>
                  </div>
                  <div className="bar hp">
                    <i style={{ width: `${phpPct * 100}%` }} />
                    {shieldNow > 0 && <em className="shield-fill" style={{ width: `${Math.min(shieldNow / build.hp, 1) * 100}%` }} />}
                  </div>
                  {hasLoadout && (
                    <>
                      <div className="hp-num">
                        <span>真气</span>
                        <span>{f0(battle && last ? last.pQi : qiCap)} / {f0(qiCap)}</span>
                      </div>
                      <div className="bar qi"><i style={{ width: `${qiCap > 0 ? Math.min(1, (battle && last ? last.pQi : qiCap) / qiCap) * 100 : 0}%` }} /></div>
                    </>
                  )}
                  {battle && !battleDone && last && (build.sqNeed < 99 || build.poison.cap > 0) && (
                    <div className="status-chips">
                      {build.sqNeed < 99 && <span className="chip sq">剑意 {Math.floor(last.pSq)}/{build.sqNeed}</span>}
                      {build.poison.cap > 0 && <span className="chip poison">敌方毒层 {Math.round(last.ePoison)}/{build.poison.cap}</span>}
                    </div>
                  )}
                  <div className="mini-stats">
                    <span>攻<b>{Math.round(build.atk * 10) / 10}</b></span>
                    <span>防<b>{Math.round(build.def * 10) / 10}</b></span>
                    <span>命<b>{Math.round(build.hit)}</b></span>
                    <span>闪<b>{Math.round(build.dodge)}</b></span>
                  </div>
                </div>
                <div className="vs serif">{battle && battleDone && !battle.result.win ? '败' : '对决'}</div>
                <div className="fighter">
                  <div className="fname serif">
                    {enemy.name}
                    {enemy.kind === 'elite' && <span className="tag elite">精英</span>}
                    {enemy.kind === 'boss' && <span className="tag boss">{enemy.stage === trackLength(enemy.map, enemy.tier) ? 'Boss' : '头目'}</span>}
                    {enemy.tags.map((t) => <span key={t} className="tag trait">{tagLabel(t)}</span>)}
                  </div>
                  <div className="frealm">{mapName(enemy.map)} · {TIER_NAMES[enemy.tier]} · 第 {enemy.stage} 关 · 推荐境界 {enemy.recommendedRealm}</div>
                  {hasNode(s.ownedRepNodes, 'zairu_jianghu') && enemy.tags.length > 0 && (
                    <ul className="tag-hints">
                      {enemy.tags.map((t) => (
                        <li key={t}><b>{tagLabel(t)}</b> · {COUNTER_HINTS[t]}</li>
                      ))}
                    </ul>
                  )}
                  <div className="hp-num"><span>气血</span><span>{f0(enemy.hp * (battle ? ehpPct : 1))} / {f0(enemy.hp)}</span></div>
                  <div className="bar enemy-hp"><i style={{ width: `${(battle ? ehpPct : 1) * 100}%` }} /></div>
                  <div className="mini-stats">
                    <span>攻<b>{f0(enemy.atk)}</b></span>
                    <span>防<b>{f0(enemy.def)}</b></span>
                    <span>命<b>{Math.round(enemy.hit)}</b></span>
                    <span>闪<b>{Math.round(enemy.dodge)}</b></span>
                  </div>
                  {enemy.kind !== 'normal' && (
                    <div className={`fame-line${fameClaimed ? ' gone' : ''}`}>
                      {fameClaimed ? '名号已传 · 首通声望已得' : <>首次击败 · 名号传开 <b>+{fmtBig(fameReward)}</b> 声望</>}
                    </div>
                  )}
                </div>
              </div>

              <div className="battle-controls">
                {!battle || battleDone ? (
                  <>
                    <button
                      className={isRefarmTarget ? 'btn ghost' : 'btn'}
                      style={{ maxWidth: 320, marginTop: 12 }}
                      onClick={() => s.challengeStage(viewMap, viewTier, idleStage)}
                    >
                      {battle && battleDone && !battle.result.win && battle.stage === idleStage
                        ? '立即重试（免费）'
                        : isRefarmTarget
                          ? `重打 第 ${idleStage} 关 · ${idleEnemy!.name}`
                          : `挑战 第 ${idleStage} 关 · ${idleEnemy!.name}`}
                    </button>
                    {isRefarmTarget && (
                      <div className="cap-note" style={{ marginTop: 8 }}>
                        已通关的关卡只掉五成银两，连续重打同一关逐次递减（间隔 10 分钟重置）
                      </div>
                    )}
                  </>
                ) : (
                  <div className="cap-note" style={{ marginTop: 12 }}>
                    战斗结算中…（第 {last?.rd ?? 1} 回合）Boss/精英战斗有 15–30 秒演出，不可跳过
                  </div>
                )}
                <label className="auto-advance">
                  <input type="checkbox" checked={s.autoAdvance} onChange={(e) => s.setAutoAdvance(e.target.checked)} />
                  自动连战（失败自动停下）
                </label>
              </div>
            </>
          ) : (
            <p className="cap-note" style={{ margin: 0, textAlign: 'center', padding: '16px 0' }}>本档已全通关</p>
          )}
        </div>
        </>
        )}

        <div className="log" ref={logRef}>
          <div className="log-title">战斗记录 · 自动结算</div>
          {revealedTurns.length === 0 && <div className="log-line">等待开战…</div>}
          {revealedTurns.map((t, i) => (
            <div key={i} className="log-line">
              <span className="turn">回合 {t.rd}</span>
              <span className={logCls(t.kind)}>{t.text}</span>
            </div>
          ))}
          {victory && battle.reward && (
            <>
              <div className="log-line">
                <span className="turn" />
                <span className="win-t">
                  {`${battle.reward.refarm ? '回刷收获' : '收获'}　银两 +${f0(battle.reward.silver)}`}
                </span>
              </div>
              {battle.reward.drop && (
                <div className="log-line">
                  <span className="turn" />
                  <span className="fame-t"><span className="serif">首杀所得</span>　{battle.reward.drop}</span>
                </div>
              )}
              {(battle.reward.fame ?? 0) > 0 && (
                <div className="log-line">
                  <span className="turn" />
                  <span className="fame-t"><span className="serif">名号传开</span>　挑落{battle.enemy.name}，江湖为之侧目　声望 +{fmtBig(battle.reward.fame!)}</span>
                </div>
              )}
            </>
          )}
        </div>
        {battle && battleDone && battle.result.stats.casts > 0 && <CastStats stats={battle.result.stats} />}
      </section>

      {s.failure && <FailureModal goCultivate={goCultivate} />}
    </div>
  );
}

/** 标签展示名：内部值「毒」UI 显示「剧毒」（retire-copy §7） */
function tagLabel(t: EnemyTag): string {
  return t === '毒' ? '剧毒' : t;
}

/** 武学触发统计（spec §4.7）：每门武学出招次数、伤害占比；路数机制与普攻也列出，便于看出机制没有变弱 */
function CastStats({ stats }: { stats: FightResult['stats'] }) {
  const total = stats.dmgDealt || 1;
  const skillSum = Object.values(stats.skillDmg).reduce((a, b) => a + b, 0);
  const mech = stats.burstDmg + stats.thornsOut + stats.poisonDmg;
  const plain = Math.max(0, total - skillSum - mech);
  const rows: [string, string, number, string][] = [
    ...Object.entries(stats.skillCasts)
      .sort((a, b) => (stats.skillDmg[b[0]] ?? 0) - (stats.skillDmg[a[0]] ?? 0))
      .map(([id, n]) => [WUXUE[id as WuxueId].name, String(n), stats.skillDmg[id] ?? 0, ''] as [string, string, number, string]),
    ['路数机制', stats.burstCount > 0 ? `剑招 ${stats.burstCount}` : '—', mech, 'mech'],
    ['普攻', '—', plain, 'plain'],
  ];
  return (
    <div className="cast-stats">
      <div className="log-title">武学触发统计 · 出招 {stats.casts} 次</div>
      <table>
        <thead><tr><th>来源</th><th>出招</th><th>伤害占比</th></tr></thead>
        <tbody>
          {rows.map(([name, n, dmg, cls]) => (
            <tr key={name} className={cls}>
              <td>{name}</td><td>{n}</td>
              <td><span className="share"><span className="bar"><i style={{ width: `${(dmg / total) * 100}%` }} /></span>{Math.round((dmg / total) * 100)}%</span></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function logCls(kind: string): string {
  switch (kind) {
    case 'crit': case 'burst': return 'crit-t';
    case 'cast': return 'cast-t';
    case 'poison_apply': case 'poison_tick': case 'poison_burst': case 'enemy_poison_tick': return 'poison-t';
    case 'miss': case 'purify': return 'info-t';
    case 'thorns_to_player': case 'thorns_to_enemy': return 'shield-t';
    case 'defeat': case 'enrage': return 'lose-t';
    case 'victory': return 'win-t';
    default: return '';
  }
}

function FailureModal({ goCultivate }: { goCultivate: () => void }) {
  const s = useGameStore();
  const f = s.failure!;
  const st = f.stats;
  const breakCost = effBreakCost(s);
  const chargePct = breakCost !== null ? Math.min(100, Math.round((s.dantian / breakCost) * 100)) : 100;
  const outPct = (v: number) => (st.dmgDealt > 0 ? Math.round((v / st.dmgDealt) * 100) : 0);

  return (
    <div className="modal-backdrop open">
      <div className="modal" role="dialog" aria-label="战斗失败">
        <div className="modal-head"><span className="fail-title serif">战败 · {f.enemyName}</span></div>
        <div className="modal-body">
          <div className="fail-diag">
            <div className="fd-main"><b>{DIAG_TEXTS[f.diagCodes[0]]}</b></div>
            {f.diagCodes[1] && <div className="fd-extra">另：{DIAG_TEXTS[f.diagCodes[1]]}</div>}
          </div>
          <div className="battle-report">
            <div className="br-title">战报</div>
            <div className="br-line">历时 {f.rounds} / 50 回合</div>
            <div className="br-line">我方输出 {f0(st.dmgDealt)}（敌余 {Math.round(f.enemyHpPct * 100)}%）</div>
            <div className="br-line">我方承伤 {f0(st.dmgTaken)}（余 {Math.round(f.playerHpPct * 100)}%）</div>
            <div className="br-line">实际命中 {Math.round(f.hitRate * 100)}%</div>
            {f.route === 'huashan' && (
              <div className="br-line route">暴击 {st.critCount} 次 · 爆发剑招 {st.burstCount} 次（占输出 {outPct(st.burstDmg)}%）</div>
            )}
            {f.route === 'shaolin' && (
              <div className="br-line route">护盾吸收 {f0(st.shieldAbsorbed)} · 反伤输出 {f0(st.thornsOut)}（占输出 {outPct(st.thornsOut)}%）</div>
            )}
            {f.route === 'tangmen' && (
              <div className="br-line route">毒伤占输出 {outPct(st.poisonDmg)}% · 毒爆 {st.poisonBurstCount} 次 · 毒层被清 {st.purgeCount} 次</div>
            )}
            {st.abStacksMax > 0 && <div className="br-line enemy">身中破甲 {st.abStacksMax} 层</div>}
            {st.thornsTaken > 0 && <div className="br-line enemy">承受反伤 {f0(st.thornsTaken)}</div>}
          </div>
          <div className="modal-actions">
            <button className="btn" onClick={() => { s.dismissFailure(); goCultivate(); }}>
              回去修炼（周天进度 {chargePct}%）
            </button>
            <button className="btn ghost" onClick={() => { s.dismissFailure(); s.challengeStage(f.map, f.tier, f.stage); }}>
              立即重试（免费）
            </button>
          </div>
          <div className="cap-note">重试免费无惩罚；Boss/精英战斗有 15–30 秒演出不可跳过——重试节奏由演出时长自然限速</div>
        </div>
      </div>
    </div>
  );
}
