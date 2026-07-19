/** 战斗页 —— 原型场景 3 战斗页签 / 场景 4 失败提示的 1:1 实现（对阵单职责） */
import { useEffect, useRef, useState } from 'react';
import { DIAG_TEXTS } from '../engine/combat';
import { REALMS } from '../engine/content';
import { getStage, mapName, MAP_STAGE_COUNT, type EnemyTag } from '../engine/enemies';
import { COUNTER_HINTS, hasNode } from '../engine/prestige';
import { ROUTES } from '../engine/routes';
import {
  effBreakCost, mapUnlocked, nextStageOf, playerBuild, useGameStore, type MapNo,
} from '../store/gameStore';

const f0 = (n: number) => Math.round(n).toLocaleString('en-US');

import { BattleVictoryRow } from '../components/BattleVictoryRow';
import { MVP2_ELITE_CHALLENGE_ENEMIES } from '../engine/mvp2Content';

export function BattlePane({ goCultivate }: { goCultivate: () => void }) {
  const s = useGameStore();
  const cleared = s.clearedStages;
  const viewMap = s.selectedMap;
  // 只展示当前页签地图上的战斗；其它图的战斗不占对阵位（切图即面向该图下一关）
  const battle = s.battle && s.battle.map === viewMap ? s.battle : null;
  const next = nextStageOf(viewMap, cleared);
  const build = playerBuild(s);

  // 选关（已通关卡可回刷；默认跟随推进关卡，全通图默认末关）
  const [viewStage, setViewStage] = useState<number | null>(null);
  useEffect(() => setViewStage(null), [viewMap]);
  const idleStage = viewStage ?? next ?? MAP_STAGE_COUNT[viewMap];
  const isRefarmTarget = cleared.includes(`m${viewMap}s${idleStage}`);

  const revealedTurns = battle ? battle.result.turns.slice(0, battle.revealed) : [];
  const last = revealedTurns[revealedTurns.length - 1];
  const phpPct = last ? last.phpPct : 1;
  const ehpPct = last ? last.ehpPct : 1;
  // 少林金钟护盾：气血条上的浅蓝护盾段（所有者 2026-07-07 UI 裁决，07-07 二裁：
  // 自血条左端向右伸展、覆盖在气血层之上；扣盾时右缘向左削减）。
  const shieldNow = build.shieldPct > 0 ? (last ? last.pShield : build.hp * build.shieldPct) : 0;
  const hpNow = build.hp * phpPct;
  const battleEnemy = battle?.enemy ?? null;
  const idleEnemy = getStage(viewMap, idleStage);
  const enemy = battle ? battleEnemy : idleEnemy;
  const battleDone = battle ? battle.revealed >= battle.result.turns.length : false;
  const victory = battle !== null && battleDone && battle.result.win;

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
          {([1, 2, 3, 4, 5] as MapNo[]).map((m) => {
            const unlocked = mapUnlocked(m, cleared);
            const clearedCount = Array.from({ length: MAP_STAGE_COUNT[m] }, (_, i) => i + 1)
              .filter((i) => cleared.includes(`m${m}s${i}`)).length;
            const full = clearedCount === MAP_STAGE_COUNT[m];
            return (
              <div
                key={m}
                className={`map-tab${viewMap === m ? ' active' : ''}${unlocked ? '' : ' locked'}`}
                onClick={() => s.selectMap(m)}
              >
                {mapName(m)}
                <span className="prog">
                  {!unlocked
                    ? `通关${mapName((m - 1) as MapNo)}解锁`
                    : full
                      ? `已通关 ${clearedCount}/${MAP_STAGE_COUNT[m]}`
                      : `${clearedCount} / ${MAP_STAGE_COUNT[m]}`}
                </span>
              </div>
            );
          })}
        </div>

        {/* 选关条：已通关卡可点选回刷（回退挂机），当前推进关金色，未解锁灰置 */}
        <div className="stage-strip">
          {Array.from({ length: MAP_STAGE_COUNT[viewMap] }, (_, i) => i + 1).map((st) => {
            const done = cleared.includes(`m${viewMap}s${st}`);
            const isNext = st === next;
            const locked = !done && !isNext;
            const def = getStage(viewMap, st);
            const active = st === (battle ? battle.stage : idleStage);
            return (
              <button
                key={st}
                disabled={locked || (battle !== null && !battleDone)}
                className={`stage-pill${isNext ? ' next' : ''}${active ? ' active' : ''}${def.kind !== 'normal' ? ' key' : ''}`}
                title={`第 ${st} 关 · ${def.name}${done ? '（已通关 · 可回刷）' : isNext ? '（当前推进）' : '（未解锁）'}`}
                onClick={() => setViewStage(st)}
              >
                {st}
              </button>
            );
          })}
        </div>

        {/* 精英挑战入口（§5.2 v0.9）：所属地图 stages 1-5 全通 + 推荐境界达标时显示；本轮首胜后不可重复 */}
        {MVP2_ELITE_CHALLENGE_ENEMIES.filter((e) => e.map === viewMap).map((e) => {
          const stagesCleared = Array.from({ length: e.unlockAfterStage }, (_, i) => i + 1)
            .every((i) => cleared.includes(`m${viewMap}s${i}`));
          const realmReady = s.realm >= e.recommendedRealm;
          const completed = (s.eliteChallengeWinsThisRun?.[e.id] ?? 0) > 0;
          const inProgress = battle?.mode === 'elite' && battle?.eliteChallengeId === e.id;
          const canChallenge = stagesCleared && realmReady && !completed && !inProgress;
          const disabledReason = !stagesCleared
            ? `需通关本图 stages 1-${e.unlockAfterStage}`
            : !realmReady
              ? `需达到境界 ${e.recommendedRealm}`
              : completed
                ? '本轮已击败'
                : null;
          return (
            <div key={e.id} className="elite-challenge-entry" style={{
              margin: '8px 0 4px', padding: '8px 12px',
              background: 'var(--night-surface-raised)', borderRadius: '6px',
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              opacity: stagesCleared ? 1 : 0.5,
            }}>
              <div>
                <div className="serif" style={{ fontSize: '13.5px', fontWeight: 600 }}>
                  精英挑战
                  {e.tags.map((t) => <span key={t} className="tag trait" style={{ marginLeft: 6 }}>{t === '毒' ? '剧毒' : t}</span>)}
                </div>
                <div style={{ fontSize: '11.5px', color: 'var(--ink-muted)' }}>推荐境界 {e.recommendedRealm}</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <button
                  className="btn"
                  style={{ width: 'auto', marginTop: 0, padding: '6px 14px', fontSize: '12.5px' }}
                  disabled={!canChallenge}
                  onClick={() => s.challengeElite(e.id)}
                >
                  {inProgress ? '战斗中…' : completed ? '✓ 已击败' : '挑战'}
                </button>
                {!canChallenge && disabledReason && !inProgress && (
                  <div className="cap-note" style={{ marginTop: 4, fontSize: '11px' }}>{disabledReason}</div>
                )}
              </div>
            </div>
          );
        })}

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
                  {battle && !battleDone && last && (build.sqNeed < 99 || build.poison.cap > 0) && (
                    <div className="status-chips">
                      {build.sqNeed < 99 && <span className="chip sq">剑意 {Math.floor(last.pSq)}/{build.sqNeed}</span>}
                      {build.poison.cap > 0 && <span className="chip poison">敌方毒层 {Math.round(last.ePoison)}/{build.poison.cap}</span>}
                    </div>
                  )}
                  <div className="mini-stats">
                    <span>攻<b>{Math.round(build.atk * 10) / 10}</b></span>
                    <span>防<b>{Math.round(build.def * 10) / 10}</b></span>
                    <span>命<b>{build.hit}</b></span>
                    <span>闪<b>{build.dodge}</b></span>
                  </div>
                </div>
                <div className="vs serif">{battle && battleDone && !battle.result.win ? '败' : '对决'}</div>
                <div className="fighter">
                  <div className="fname serif">
                    {enemy.name}
                    {enemy.kind === 'elite' && <span className="tag elite">精英</span>}
                    {enemy.kind === 'boss' && <span className="tag boss">Boss {enemy.map}</span>}
                    {enemy.tags.map((t) => <span key={t} className="tag trait">{tagLabel(t)}</span>)}
                  </div>
                  <div className="frealm">{mapName(enemy.map)} · 第 {enemy.stage} 关 · 推荐境界 {enemy.recommendedRealm}</div>
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
                    <span>攻<b>{enemy.atk}</b></span>
                    <span>防<b>{enemy.def}</b></span>
                    <span>命<b>{enemy.hit}</b></span>
                    <span>闪<b>{enemy.dodge}</b></span>
                  </div>
                </div>
              </div>

              <div className="battle-controls">
                {!battle || battleDone ? (
                  <>
                    <button
                      className={isRefarmTarget ? 'btn ghost' : 'btn'}
                      style={{ maxWidth: 320, marginTop: 12 }}
                      onClick={() => s.challengeStage(viewMap, idleStage)}
                    >
                      {battle && battleDone && !battle.result.win && battle.stage === idleStage
                        ? '立即重试（免费）'
                        : isRefarmTarget
                          ? `回刷 第 ${idleStage} 关 · ${idleEnemy.name}`
                          : `挑战 第 ${idleStage} 关 · ${idleEnemy.name}`}
                    </button>
                    {isRefarmTarget && (
                      <div className="cap-note" style={{ marginTop: 8 }}>
                        回刷收益低于首通，连续回刷同一关逐次递减（间隔 10 分钟重置）；开自动连战即回刷循环
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
            <p className="cap-note" style={{ margin: 0, textAlign: 'center', padding: '16px 0' }}>本图已全通关</p>
          )}
        </div>

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
                  {battle.mode === 'trial'
                    ? '试炼通过'
                    : `${battle.reward.refarm ? '回刷收获' : '收获'}　内力 +${f0(battle.reward.neili)}　银两 +${f0(battle.reward.silver)}　阅历 +${f0(battle.reward.xp)}`}
                </span>
              </div>
              <BattleVictoryRow pageId={battle.reward.grantedPageId} />
            </>
          )}
        </div>
      </section>

      {s.failure && <FailureModal goCultivate={goCultivate} />}
    </div>
  );
}

/** 标签展示名：内部值「毒」UI 显示「剧毒」（retire-copy §7） */
function tagLabel(t: EnemyTag): string {
  return t === '毒' ? '剧毒' : t;
}

function logCls(kind: string): string {
  switch (kind) {
    case 'crit': case 'burst': return 'crit-t';
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
            <button className="btn ghost" onClick={() => { s.dismissFailure(); s.challengeStage(f.map, f.stage); }}>
              立即重试（免费）
            </button>
          </div>
          <div className="cap-note">重试免费无惩罚；Boss/精英战斗有 15–30 秒演出不可跳过——重试节奏由演出时长自然限速</div>
        </div>
      </div>
    </div>
  );
}
