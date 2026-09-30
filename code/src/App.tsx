/**
 * 实现基准：docs/design/prototype.html（获批原型）+ 根目录 DESIGN.md，1:1 还原。
 * 内功页与选内功：docs/design/sect-neigong-prototype.html §1–§2；侧边栏页签解锁前不显示（同原型「侧边栏」节）。
 */
import { useEffect, useState } from 'react';
import type { CSSProperties } from 'react';
import { computeAttributes } from './engine/attributes';
import { REALM_ACUPOINTS, isMeridianComplete, totalAcupointBonus } from './engine/acupoints';
import { REALMS } from './engine/content';
import { effIdleRate, huohouMultOf, nextStageOf, retireKind, useGameStore } from './store/gameStore';
import { fmtBig, fmtRate } from './fmt';
import { freshInjuries, isHurt, worstInjury, INJURY_DEFS, SEVERITY_NAME } from './engine/injury';
import { SettingsPanel } from './components/SettingsPanel';
import { TipLayer } from './components/TipLayer';
import { applyDebugHash } from './debug';
import { BattlePane } from './panes/BattlePane';
import { CultivatePane } from './panes/CultivatePane';
import { RepPane } from './panes/RepPane';
import { NeigongPane } from './panes/NeigongPane';
import { WuxuePane } from './panes/WuxuePane';
import { SectPane } from './panes/SectPane';
import { ShopPane } from './panes/ShopPane';
import { SECT_REALM } from './engine/sect';
import { NeigongSelect } from './overlays/NeigongSelect';
import { BreakthroughCeremony } from './overlays/BreakthroughCeremony';
import { ObserverPanel } from './overlays/ObserverPanel';
import { OfflineSettlement } from './overlays/OfflineSettlement';
import { RetireCeremony } from './overlays/RetireCeremony';
import { RetireFlow } from './overlays/RetireFlow';
import { DUSK_MARGIN, ERA_START, INIT_AGE, currentEra, isDusk, lifespanCap } from './engine/reincarnation';
import { NEIGONG } from './engine/neigong';

const NEIGONG_NAME = (id: keyof typeof NEIGONG) => NEIGONG[id].name;

type TabId = 'cultivate' | 'battle' | 'neigong' | 'wuxue' | 'sect' | 'shop' | 'rep';

/** 每页一幅底图（code/public/art/，莉刻生成） */
const PAGE_ART: Record<TabId, string> = {
  cultivate: 'cultivate.jpg', battle: 'battle-village.jpg', neigong: 'neigong.jpg', wuxue: 'wuxue.jpg',
  sect: 'sect.jpg', shop: 'battle-village.jpg', rep: 'rep.jpg',
};
const REALM_CN = ['', '第一境', '第二境', '第三境', '第四境', '第五境', '第六境', '第七境'];

export default function App() {
  const s = useGameStore();
  const [tab, setTabRaw] = useState<TabId>('cultivate');
  // 点开页签即记入「已见」，新开页签的金点随之消失
  const setTab = (t: TabId) => { setTabRaw(t); useGameStore.getState().seeTab(t); };
  const [observerOpen, setObserverOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);

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
    if ((tab === 'neigong' || tab === 'wuxue' || tab === 'shop') && s.started && s.neigong === null) setTabRaw('cultivate');
    if (tab === 'sect' && s.started && s.realm < SECT_REALM) setTabRaw('cultivate');
  }, [tab, s.started, s.neigong, s.realm]);

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
  // 窍穴 / 贯通加成与修炼页身手卡同一口径（CultivatePane），突破演出的前后对比才对得上页面
  const acuPct = (realm: number): number => {
    const opened = new Set(Object.entries(s.acupointProgress ?? {}).filter(([, a]) => a.opened).map(([id]) => id));
    const data = REALM_ACUPOINTS[realm];
    const through = data ? data.meridians.filter((m) => isMeridianComplete(m, opened)).length : 0;
    return totalAcupointBonus(realm, opened.size, through);
  };
  const attrs = computeAttributes(s.realm, s.route, s.zhong, 0, acuPct(s.realm), huohouMultOf(s));
  const neigongSelectOpen = s.realm >= 2 && s.neigong === null && s.retireCeremony === null;
  const retire = retireKind(s);
  const repUnlocked = s.repTotal > 0 || s.run > 1;

  const injuries = s.injuries ?? freshInjuries();
  const hurt = isHurt(injuries);
  const worst = worstInjury(injuries);
  const age = s.age ?? INIT_AGE;
  const eraStart = s.eraStart ?? ERA_START;
  const dusk = isDusk(age, s.realm, s.lifespanLost ?? 0);
  const seen = s.seenTabs ?? [];
  const shopUnlocked = s.neigong !== null;
  // 页签：未解锁的不显示，新开且没点开过的带金点（DESIGN.md The Dot Lives In The Rail Rule）
  const tabs: { id: TabId; name: string; short?: string; show: boolean; fresh: boolean }[] = [
    { id: 'cultivate', name: '修炼', show: true, fresh: false },
    { id: 'battle', name: '战斗', show: true, fresh: false },
    { id: 'neigong', name: '内功', show: !!s.neigong, fresh: !seen.includes('neigong') },
    { id: 'wuxue', name: '武学', show: !!s.neigong, fresh: !seen.includes('wuxue') },
    { id: 'sect', name: '门派', show: s.realm >= SECT_REALM, fresh: !seen.includes('sect') },
    { id: 'shop', name: '书肆', show: shopUnlocked, fresh: !seen.includes('shop') },
    { id: 'rep', name: '声望阁', short: '声望', show: repUnlocked, fresh: !seen.includes('rep') },
  ];
  const shown = tabs.filter((t) => t.show);
  const bodyLine = hurt && worst
    ? `${INJURY_DEFS[worst.id].name} · ${SEVERITY_NAME[worst.severity]}`
    : s.soulUnsettled ? '魂魄未稳' : '身无伤病';
  const rateDown = hurt || !!s.soulUnsettled;

  return (
    <div className="jh-app">
      <nav className="jh-rail" aria-label="人物卷">
        <div className="jh-brand">江湖无尽录</div>
        <div className="jh-who">
          <div className="realm">{realmDef.name}<small>{REALM_CN[s.realm]}</small></div>
          <div
            className="life"
            data-tip={`寿元 ${lifespanCap(s.realm, s.lifespanLost ?? 0)} 岁 · ${dusk ? '再受一次重伤即寿终' : `重伤一次折寿 ${DUSK_MARGIN} 年`}`}
          >
            第 <b>{s.run}</b> 世 · <b>{Math.floor(age)}</b> 岁{dusk && <span className="dusk">垂暮</span>} · 江湖历 <b>{Math.floor(currentEra(eraStart, age))}</b> 年
          </div>
        </div>
        <button
          type="button"
          className={`jh-body${hurt ? ' hurt' : s.soulUnsettled ? ' soul' : ''}`}
          onClick={hurt || s.soulUnsettled ? () => setTab('cultivate') : undefined}
          data-tip={s.soulUnsettled && !hurt ? '仓促离世，魂魄受创。转世十年后自复，期间修炼六成。' : undefined}
        >
          {bodyLine}
        </button>
        <div className="jh-res">
          <div>
            <div className="k">内力</div>
            <div className="v">{fmtBig(s.dantian)}<span className={`rate${rateDown ? ' down' : ''}`}>+{fmtRate(rate)}/秒</span></div>
          </div>
          <div className="jh-res-pair">
            <div><div className="k">银两</div><div className="v small">{fmtBig(s.silver)}</div></div>
            {repUnlocked && <div><div className="k">声望</div><div className="v small">{fmtBig(s.reputation)}</div></div>}
          </div>
        </div>
        <svg className="jh-brush" viewBox="0 0 200 8" preserveAspectRatio="none" aria-hidden="true">
          <path d="M2 5 C 40 2, 90 6, 140 3.5 S 190 4, 198 3" stroke="oklch(0.55 0.02 262)" strokeWidth="1.6" fill="none" strokeLinecap="round" />
        </svg>
        <div className="jh-nav">
          {shown.map((t) => (
            <button key={t.id} type="button" aria-current={tab === t.id ? 'page' : undefined} onClick={() => setTab(t.id)}>
              {t.name}{t.fresh && t.id !== 'cultivate' && t.id !== 'battle' && <span className="jh-fresh" aria-label="新开" />}
            </button>
          ))}
        </div>
        <div className="jh-rail-foot">
          {/* 转世入口：门槛前也露出，但置灰写明缘由（rules/copy/retire.md §1） */}
          <button
            type="button"
            className={`jh-ghost${retire ? ' ready' : ''}`}
            onClick={s.openRetire}
            disabled={!retire}
            data-tip={retire ? '本世已有所成，随时可转世。' : '未有所成，何以言转世——本世突破一次后可转世。'}
          >
            转世
          </button>
          <button
            type="button"
            className="jh-ghost icon js-settings-toggle"
            aria-label="设置"
            aria-expanded={settingsOpen}
            onClick={() => setSettingsOpen((v) => !v)}
          >
            ⚙
          </button>
          {settingsOpen && <SettingsPanel onClose={() => setSettingsOpen(false)} />}
        </div>
      </nav>

      <main className="jh-stage-wrap">
        <div className="jh-mob-top">
          <div className="realm">{realmDef.name}<small>第 {s.run} 世 · {Math.floor(age)} 岁 · {bodyLine}</small></div>
          <div className="mres">
            <div>内力<b>{fmtBig(s.dantian)}</b><span className="rate">+{fmtRate(rate)}/秒</span></div>
            <div>银两<b>{fmtBig(s.silver)}</b></div>
          </div>
        </div>
        <div className="jh-stage">
          {/* 底图：每页同位，固定铺满舞台背后（DESIGN.md Do：底图固定同位、上浓下淡） */}
          <div key={tab} className={`jh-art art-${tab}`} style={{ '--art': `url('/art/${PAGE_ART[tab]}')` } as CSSProperties} aria-hidden="true" />
          <div key={`p-${tab}`} className={`jh-page page-${tab}`}>
            {tab === 'cultivate' && <CultivatePane />}
            {tab === 'battle' && <BattlePane goCultivate={() => setTab('cultivate')} />}
            {tab === 'neigong' && s.neigong && <NeigongPane />}
            {tab === 'wuxue' && s.neigong && <WuxuePane />}
            {tab === 'sect' && s.realm >= SECT_REALM && <SectPane />}
            {tab === 'shop' && shopUnlocked && <ShopPane />}
            {tab === 'rep' && <RepPane />}
          </div>
        </div>
      </main>

      <nav className="jh-tabbar" aria-label="页签">
        {shown.map((t) => (
          <button key={t.id} type="button" aria-current={tab === t.id ? 'page' : undefined} onClick={() => setTab(t.id)}>
            {t.short ?? t.name}{t.fresh && t.id !== 'cultivate' && t.id !== 'battle' && <span className="jh-fresh" aria-label="新开" />}
          </button>
        ))}
      </nav>
      <TipLayer />

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
          prevAttrs={computeAttributes(s.ceremony - 1, s.route, s.zhong, 0, acuPct(s.ceremony - 1), huohouMultOf(s))}
          nextAttrs={attrs}
          onClose={s.dismissCeremony}
        />
      )}
      {s.offlineSettlement && (
        <OfflineSettlement
          result={s.offlineSettlement}
          sectDone={s.offlineSectDone}
          observer={observerOpen}
          onClose={s.dismissOfflineSettlement}
        />
      )}
    </div>
  );
}

