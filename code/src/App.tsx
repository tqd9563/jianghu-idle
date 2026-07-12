/**
 * 实现基准：wiki/design/prototype.html（获批原型）+ 根目录 DESIGN.md，1:1 还原。
 * 当前覆盖：修炼页 / 武学页 / 路线选择 / 突破演出；战斗与声望阁下一步。
 */
import { useEffect, useState } from 'react';
import { computeAttributes } from './engine/attributes';
import { REALMS } from './engine/content';
import { mapName, MAP_STAGE_COUNT } from './engine/enemies';
import { zhoutianProgress } from './engine/formulas';
import { effBreakCost, effIdleRate, nextStageOf, retireKind, useGameStore } from './store/gameStore';
import { ThemeSwitcher } from './components/ThemeSwitcher';
import { applyDebugHash } from './debug';
import { BattlePane } from './panes/BattlePane';
import { CultivatePane } from './panes/CultivatePane';
import { RepPane } from './panes/RepPane';
import { SkillPane } from './panes/SkillPane';
import { RouteSelect } from './overlays/RouteSelect';
import { BreakthroughCeremony } from './overlays/BreakthroughCeremony';
import { ObserverPanel } from './overlays/ObserverPanel';
import { OfflineSettlement } from './overlays/OfflineSettlement';
import { RetireCeremony } from './overlays/RetireCeremony';
import { RetireFlow } from './overlays/RetireFlow';

type TabId = 'cultivate' | 'battle' | 'skill' | 'rep';

const fmt = (n: number) => Math.floor(n).toLocaleString('en-US');

export default function App() {
  const s = useGameStore();
  const [tab, setTab] = useState<TabId>('cultivate');
  const [observerOpen, setObserverOpen] = useState(false);

  useEffect(() => {
    const { tab: debugTab, fight: autoFight, retire: debugRetire, observer } = applyDebugHash();
    if (debugTab) setTab(debugTab as TabId);
    if (observer) setObserverOpen(true);
    s.init();
    if (autoFight) {
      const st = useGameStore.getState();
      const next = nextStageOf(st.selectedMap, st.clearedStages);
      if (next !== null) st.challengeStage(st.selectedMap, next);
    }
    if (debugRetire) {
      const st = useGameStore.getState();
      st.openRetire();
      if (debugRetire === 'ceremony') { st.proceedRetire(); st.confirmRetire(); }
    }
    const t = setInterval(() => useGameStore.getState().tick(Date.now()), 250);
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.shiftKey && e.code === 'KeyO') setObserverOpen((v) => !v);
    };
    window.addEventListener('keydown', onKey);
    return () => { clearInterval(t); window.removeEventListener('keydown', onKey); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!s.started) return null;

  const realmDef = REALMS[s.realm - 1];
  const rate = effIdleRate(s);
  const breakCost = effBreakCost(s);
  const progress = breakCost !== null ? zhoutianProgress(s.dantian, breakCost) : null;
  const attrs = computeAttributes(s.realm, s.route, s.skillLevel);
  const routeSelectOpen = s.realm >= 2 && s.route === null && s.retireCeremony === null;
  const retire = retireKind(s);
  const repUnlocked = s.repTotal > 0 || s.run > 1;

  return (
    <div className="app">
      <nav className="game-rail">
        <div className="rail-identity">
          <div className="game-title serif">
            江湖无尽录<span className="round">第 {s.run} 轮</span>
          </div>
          <div className="realm-chip">
            <span className="name serif">{realmDef.name}</span>
            <span className="lv">境界 {s.realm} / {REALMS.length}</span>
          </div>
        </div>
        <ThemeSwitcher />
        <div className="nav-group">
          <button className={tabCls(tab, 'cultivate')} onClick={() => setTab('cultivate')}>修炼</button>
          <button className={tabCls(tab, 'battle')} onClick={() => setTab('battle')}>战斗</button>
          {s.route ? (
            <button className={tabCls(tab, 'skill')} onClick={() => setTab('skill')}>武学</button>
          ) : (
            <button className="game-tab" disabled title="突破至境界 2 后解锁">武学</button>
          )}
          {repUnlocked ? (
            <button className={tabCls(tab, 'rep')} onClick={() => setTab('rep')}>声望阁</button>
          ) : (
            <button className="game-tab" disabled title="首次归隐后解锁">声望阁</button>
          )}
        </div>
      </nav>

      <header className="topbar">
        {retire && (
          <button
            className={`retire-btn${retire === 'standard' ? ' ready' : ''}`}
            onClick={s.openRetire}
            title={retire === 'standard'
              ? '挂剑归隐 · 本轮圆满 · 声望全额'
              : '挂剑归隐 · 未竟之轮 · 声望六成\n黑风寨主仍未被击败。现在归隐，声望按六成结算；击败黑风寨主可获得全额声望。'}
          >
            归隐<span className={`retire-dot ${retire}`} />
          </button>
        )}
        <div className="res-group">
          <div className="res">
            <span className="label">内力</span>
            <span className="value">{fmt(s.dantian)}</span>
            <span className="rate">+{rate.toFixed(1)} / 秒</span>
          </div>
          <div className="res"><span className="label">银两</span><span className="value">{fmt(s.silver)}</span></div>
          <div className="res"><span className="label">阅历</span><span className="value">{fmt(s.xp)}</span></div>
          <div className="res rep">
            <span className="label">声望</span>
            <span className="value">{fmt(s.reputation)}</span>
            {s.repTotal > 0 && <span className="rate faint">累计 {fmt(s.repTotal)}</span>}
          </div>
        </div>
      </header>

      <main className="s3-main">
        <div className="pulse-bar">
          {progress && (
            <button className="strip-item" onClick={() => setTab('cultivate')}>
              运转周天{' '}
              <span className="mini-bar">
                <i style={{ width: `${Math.min(100, (s.dantian / breakCost!) * 100)}%` }} />
              </span>{' '}
              <b>{progress.segmentsFull}/5</b>
              {!progress.ready && <> · 第{CN[progress.segmentsFull + 1]}周天 {Math.floor(progress.currentSegmentPct * 100)}%</>}
              {progress.ready && <> · 圆满</>}
            </button>
          )}
          {(() => {
            const m = s.selectedMap;
            const clearedCount = Array.from({ length: MAP_STAGE_COUNT[m] }, (_, i) => i + 1)
              .filter((i) => s.clearedStages.includes(`m${m}s${i}`)).length;
            const lastTurn = s.battle?.result.turns[s.battle.revealed - 1];
            return (
              <button className="strip-item" onClick={() => setTab('battle')}>
                {mapName(m)} <b>{clearedCount}/{MAP_STAGE_COUNT[m]}</b>
                {s.battle && !s.battle.resolved && (
                  <>
                    {' '}· 对战 {s.battle.enemy.name}{' '}
                    <span className="mini-bar fight"><i style={{ width: `${(lastTurn?.ehpPct ?? 1) * 100}%` }} /></span>
                  </>
                )}
              </button>
            );
          })()}
        </div>

        {tab === 'cultivate' && <CultivatePane />}
        {tab === 'battle' && <BattlePane goCultivate={() => setTab('cultivate')} />}
        {tab === 'skill' && s.route && <SkillPane />}
        {tab === 'rep' && <RepPane />}
      </main>

      {routeSelectOpen && <RouteSelect />}
      <RetireFlow />
      {s.retireCeremony && (
        <RetireCeremony onDone={() => { s.closeRetireCeremony(); setTab('rep'); }} />
      )}
      {s.paused && <div className="paused-chip">测试暂停中 · 计时与产出已冻结</div>}
      {observerOpen && <ObserverPanel onClose={() => setObserverOpen(false)} />}
      {s.retireToast && (
        <div className="toast" role="status">
          <span>
            {s.retireToast === 'fail_streak'
              ? '四战黑风寨主未果。可就此归隐（声望六成），也可再作调整——击败他可获全额声望。'
              : '许久没有新的进展了。可就此归隐（声望六成）——击败黑风寨主可获得全额声望。'}
          </span>
          <button className="toast-close" onClick={s.dismissRetireToast} aria-label="关闭">×</button>
        </div>
      )}
      {s.ceremony !== null && (
        <BreakthroughCeremony
          realmTo={s.ceremony}
          prevAttrs={computeAttributes(s.ceremony - 1, s.route, s.skillLevel)}
          nextAttrs={attrs}
          onClose={s.dismissCeremony}
        />
      )}
      {s.offlineSettlement && (
        <OfflineSettlement
          result={s.offlineSettlement}
          observer={observerOpen}
          onClose={s.dismissOfflineSettlement}
        />
      )}
    </div>
  );
}

const CN = ['零', '一', '二', '三', '四', '五'];
function tabCls(cur: TabId, id: TabId) {
  return cur === id ? 'game-tab active' : 'game-tab';
}
