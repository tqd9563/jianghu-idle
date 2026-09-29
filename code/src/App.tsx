/**
 * 实现基准：docs/design/prototype.html（获批原型）+ 根目录 DESIGN.md，1:1 还原。
 * 内功页与选内功：docs/design/sect-neigong-prototype.html §1–§2；侧边栏页签解锁前不显示（同原型「侧边栏」节）。
 */
import { useEffect, useState } from 'react';
import { computeAttributes } from './engine/attributes';
import { REALMS } from './engine/content';
import { mapName, stageKey, TIER_NAMES, trackLength } from './engine/enemies';
import { zhoutianProgress } from './engine/formulas';
import { effBreakCost, effIdleRate, huohouMultOf, nextStageOf, retireKind, useGameStore, zhoutianN } from './store/gameStore';
import { fmtBig, fmtRate } from './fmt';
import { WoundChip } from './components/WoundChip';
import { freshInjuries, isHurt } from './engine/injury';
import { SkinPicker } from './components/SkinPicker';
import { applyDebugHash } from './debug';
import { BattlePane } from './panes/BattlePane';
import { CultivatePane } from './panes/CultivatePane';
import { RepPane } from './panes/RepPane';
import { NeigongPane } from './panes/NeigongPane';
import { WuxuePane } from './panes/WuxuePane';
import { NeigongSelect } from './overlays/NeigongSelect';
import { BreakthroughCeremony } from './overlays/BreakthroughCeremony';
import { ObserverPanel } from './overlays/ObserverPanel';
import { OfflineSettlement } from './overlays/OfflineSettlement';
import { RetireCeremony } from './overlays/RetireCeremony';
import { RetireFlow } from './overlays/RetireFlow';
import { AgeLine } from './components/AgeLine';
import { SoulChip } from './components/SoulChip';
import { ERA_START, INIT_AGE } from './engine/reincarnation';
import { NEIGONG } from './engine/neigong';

const NEIGONG_NAME = (id: keyof typeof NEIGONG) => NEIGONG[id].name;

type TabId = 'cultivate' | 'battle' | 'neigong' | 'wuxue' | 'rep';

export default function App() {
  const s = useGameStore();
  const [tab, setTabRaw] = useState<TabId>('cultivate');
  // 点开页签即记入「已见」，新开页签的金点随之消失
  const setTab = (t: TabId) => { setTabRaw(t); useGameStore.getState().seeTab(t); };
  const [observerOpen, setObserverOpen] = useState(false);

  useEffect(() => {
    const { tab: debugTab, fight: autoFight, retire: debugRetire, observer, livetest } = applyDebugHash();
    if (debugTab) setTabRaw(debugTab as TabId);   // init 之前不记「已见」
    if (observer) setObserverOpen(true);
    s.init();
    useGameStore.getState().applyLiveTestSwitch(livetest);
    if (autoFight) {
      const st = useGameStore.getState();
      const next = nextStageOf(st.selectedMap, st.selectedTier, st.clearedStages);
      if (next !== null) st.challengeStage(st.selectedMap, st.selectedTier, next);
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

  // 新一世内功页签随之隐藏：停在内功页的玩家退回修炼页
  useEffect(() => {
    if ((tab === 'neigong' || tab === 'wuxue') && s.started && s.neigong === null) setTabRaw('cultivate');
  }, [tab, s.started, s.neigong]);

  // 顿悟轻提示：几秒后自动收起
  useEffect(() => {
    if (!s.dunwuNotice) return;
    const t = setTimeout(() => useGameStore.getState().dismissDunwu(), 3200);
    return () => clearTimeout(t);
  }, [s.dunwuNotice]);

  useEffect(() => {
    if (s.pendingTab) {
      setTab(s.pendingTab as TabId);
      useGameStore.setState({ pendingTab: null });
    }
  }, [s.pendingTab]);

  if (!s.started) return null;

  const realmDef = REALMS[s.realm - 1];
  const rate = effIdleRate(s);
  const breakCost = effBreakCost(s);
  const N = zhoutianN(s.realm);
  const progress = breakCost !== null ? zhoutianProgress(s.dantian, breakCost, N) : null;
  const attrs = computeAttributes(s.realm, s.route, s.zhong, 0, 0, huohouMultOf(s));
  const neigongSelectOpen = s.realm >= 2 && s.neigong === null && s.retireCeremony === null;
  const retire = retireKind(s);
  const repUnlocked = s.repTotal > 0 || s.run > 1;

  return (
    <div className="app">
      <nav className="game-rail">
        <div className="rail-identity">
          <div className="game-title serif">
            江湖无尽录<span className="round">第 {s.run} 世</span>
          </div>
          <div className="realm-chip">
            <span className="name serif">{realmDef.name}</span>
          </div>
          <AgeLine age={s.age ?? INIT_AGE} eraStart={s.eraStart ?? ERA_START} realm={s.realm} lifespanLost={s.lifespanLost ?? 0} />
        </div>
        <div className="nav-group">
          {/* 未解锁的页签一律不显示；新开且没点开过的带金点（门派原型「侧边栏」节） */}
          <button className={tabCls(tab, 'cultivate')} onClick={() => setTab('cultivate')}>修炼</button>
          <button className={tabCls(tab, 'battle')} onClick={() => setTab('battle')}>战斗</button>
          {s.neigong && (
            <button className={tabCls(tab, 'neigong')} onClick={() => setTab('neigong')}>
              内功{!(s.seenTabs ?? []).includes('neigong') && <span className="fresh-dot" aria-label="新开" />}
            </button>
          )}
          {s.neigong && (
            <button className={tabCls(tab, 'wuxue')} onClick={() => setTab('wuxue')}>
              武学{!(s.seenTabs ?? []).includes('wuxue') && <span className="fresh-dot" aria-label="新开" />}
            </button>
          )}
          {repUnlocked && (
            <button className={tabCls(tab, 'rep')} onClick={() => setTab('rep')}>
              声望阁{!(s.seenTabs ?? []).includes('rep') && <span className="fresh-dot" aria-label="新开" />}
            </button>
          )}
        </div>
        <SkinPicker />
      </nav>

      <header className="topbar">
        {/* 归隐入口：门槛前也露出、但置灰写明缘由（长线原型 §4 A/B，economy.md §1.4） */}
        <button
          className={`retire-btn${retire ? ' ready' : ''}`}
          onClick={s.openRetire}
          disabled={!retire}
          title={retire ? '本世已有所成，随时可挂剑归隐。' : '未有所成，何以言归隐——本世突破一次后可归隐。'}
        >
          归隐{retire && <span className="retire-dot standard" />}
        </button>
        {s.soulUnsettled && <SoulChip onClick={() => setTab('cultivate')} />}
        <WoundChip injuries={s.injuries ?? freshInjuries()} onClick={() => setTab('cultivate')} />
        <div className="res-group">
          <div className="res">
            <span className="label">内力</span>
            <span className="value">{fmtBig(s.dantian)}</span>
            {/* 带伤或魂魄未稳时速率转血褐——修炼变慢是第一眼就能看见的代价（受伤原型 §1） */}
            <span className={`rate${isHurt(s.injuries ?? freshInjuries()) || s.soulUnsettled ? ' down' : ''}`}>
              +{fmtRate(rate)} / 秒
            </span>
          </div>
          <div className="res"><span className="label">银两</span><span className="value">{fmtBig(s.silver)}</span></div>
          <div className="res rep">
            <span className="label">声望</span>
            <span className="value">{fmtBig(s.reputation)}</span>
            {s.repTotal > 0 && <span className="rate faint">累计 {fmtBig(s.repTotal)}</span>}
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
              <b>{progress.segmentsFull}/{N}</b>
              {!progress.ready && <> · 第{CN[progress.segmentsFull + 1]}周天 {Math.floor(progress.currentSegmentPct * 100)}%</>}
              {progress.ready && <> · 圆满</>}
            </button>
          )}
          {(() => {
            const m = s.selectedMap;
            const t = s.selectedTier;
            const total = trackLength(m, t);
            const clearedCount = Array.from({ length: total }, (_, i) => i + 1)
              .filter((i) => s.clearedStages.includes(stageKey(m, t, i))).length;
            const lastTurn = s.battle?.result.turns[s.battle.revealed - 1];
            return (
              <button className="strip-item" onClick={() => setTab('battle')}>
                {mapName(m)} · {TIER_NAMES[t]} <b>{clearedCount}/{total}</b>
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
        {tab === 'neigong' && s.neigong && <NeigongPane />}
        {tab === 'wuxue' && s.neigong && <WuxuePane />}
        {tab === 'rep' && <RepPane />}
      </main>

      {neigongSelectOpen && <NeigongSelect />}
      {s.dunwuNotice && <div className="dunwu-toast serif" role="status">顿悟 · {s.dunwuNotice.includes('·') ? s.dunwuNotice : `${s.neigong ? NEIGONG_NAME(s.neigong) : ''} · ${s.dunwuNotice}`}</div>}
      <RetireFlow />
      {s.retireCeremony && (
        <RetireCeremony onDone={() => { s.closeRetireCeremony(); setTab('rep'); }} />
      )}
      {s.paused && <div className="paused-chip">测试暂停中 · 计时与产出已冻结</div>}
      {observerOpen && <ObserverPanel onClose={() => setObserverOpen(false)} />}
      {s.ceremony !== null && (
        <BreakthroughCeremony
          realmTo={s.ceremony}
          prevAttrs={computeAttributes(s.ceremony - 1, s.route, s.zhong, 0, 0, huohouMultOf(s))}
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

const CN = ['零', '一', '二', '三', '四', '五', '六', '七', '八', '九'];
function tabCls(cur: TabId, id: TabId) {
  return cur === id ? 'game-tab active' : 'game-tab';
}
