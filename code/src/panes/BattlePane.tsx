/** 战斗页 —— 原型场景 3 战斗页签 / 场景 4 失败提示的 1:1 实现（对阵单职责） */
import { useEffect, useRef } from 'react';
import { DIAG_TEXTS } from '../engine/combat';
import { REALMS } from '../engine/content';
import { getStage, mapName, MAP_STAGE_COUNT, type EnemyTag } from '../engine/enemies';
import { COUNTER_HINTS, hasNode } from '../engine/prestige';
import { ROUTES } from '../engine/routes';
import {
  effBreakCost, mapUnlocked, nextStageOf, playerBuild, useGameStore, type MapNo,
} from '../store/gameStore';

const f0 = (n: number) => Math.round(n).toLocaleString('en-US');

export function BattlePane({ goCultivate }: { goCultivate: () => void }) {
  const s = useGameStore();
  const cleared = s.clearedStages;
  const viewMap = s.selectedMap;
  // 只展示当前页签地图上的战斗；其它图的战斗不占对阵位（切图即面向该图下一关）
  const battle = s.battle && s.battle.map === viewMap ? s.battle : null;
  const next = nextStageOf(viewMap, cleared);
  const build = playerBuild(s);

  const revealedTurns = battle ? battle.result.turns.slice(0, battle.revealed) : [];
  const last = revealedTurns[revealedTurns.length - 1];
  const phpPct = last ? last.phpPct : 1;
  const ehpPct = last ? last.ehpPct : 1;
  // 少林金钟护盾：气血条上的浅蓝护盾段（所有者 2026-07-07 UI 裁决）。
  // 条总刻度 = max(气血上限, 当前气血 + 护盾)——开战满血满盾时护盾段依然可见。
  const shieldNow = build.shieldPct > 0 ? (last ? last.pShield : build.hp * build.shieldPct) : 0;
  const hpNow = build.hp * phpPct;
  const barTotal = Math.max(build.hp, hpNow + shieldNow);
  const battleEnemy = battle?.enemy ?? null;
  const idleEnemy = next !== null ? getStage(viewMap, next) : null;
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
          {([1, 2, 3] as MapNo[]).map((m) => {
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
                    <i style={{ width: `${(hpNow / barTotal) * 100}%` }} />
                    {shieldNow > 0 && <em className="shield-fill" style={{ width: `${(shieldNow / barTotal) * 100}%` }} />}
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
                    {next !== null && (
                      <button
                        className="btn"
                        style={{ maxWidth: 320, marginTop: 12 }}
                        onClick={() => s.challengeStage(viewMap, next)}
                      >
                        {battle && battleDone && !battle.result.win && battle.stage === next
                          ? '立即重试（免费）'
                          : `挑战 第 ${next} 关 · ${idleEnemy!.name}`}
                      </button>
                    )}
                    {next === null && <div className="cap-note" style={{ marginTop: 12 }}>本图已全通关</div>}
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
            <div className="log-line">
              <span className="turn" />
              <span className="win-t">
                {battle.reward.refarm ? '回刷收获' : '收获'}　内力 +{f0(battle.reward.neili)}　银两 +{f0(battle.reward.silver)}　阅历 +{f0(battle.reward.xp)}
              </span>
            </div>
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
