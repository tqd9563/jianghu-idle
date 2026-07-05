/**
 * 实现基准：wiki/design/prototype.html（获批原型）+ 根目录 DESIGN.md，1:1 还原。
 * 当前覆盖：修炼页 / 武学页 / 路线选择 / 突破演出；战斗与声望阁下一步。
 */
import { useEffect, useState } from 'react';
import { computeAttributes } from './engine/attributes';
import { REALMS } from './engine/content';
import { idleNeiliPerSec, zhoutianProgress } from './engine/formulas';
import { useGameStore } from './store/gameStore';
import { applyDebugHash } from './debug';
import { CultivatePane } from './panes/CultivatePane';
import { SkillPane } from './panes/SkillPane';
import { RouteSelect } from './overlays/RouteSelect';
import { BreakthroughCeremony } from './overlays/BreakthroughCeremony';

type TabId = 'cultivate' | 'battle' | 'skill' | 'rep';

const fmt = (n: number) => Math.floor(n).toLocaleString('en-US');

export default function App() {
  const s = useGameStore();
  const [tab, setTab] = useState<TabId>('cultivate');

  useEffect(() => {
    const { tab: debugTab } = applyDebugHash();
    if (debugTab) setTab(debugTab as TabId);
    s.init();
    const t = setInterval(() => useGameStore.getState().tick(Date.now()), 250);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!s.started) return null;

  const realmDef = REALMS[s.realm - 1];
  const nextRealm = s.realm < REALMS.length ? REALMS[s.realm] : null;
  const rate = idleNeiliPerSec(s.realm);
  const progress = nextRealm ? zhoutianProgress(s.dantian, nextRealm.breakthroughCost!) : null;
  const attrs = computeAttributes(s.realm, s.route, s.skillLevel);
  const routeSelectOpen = s.realm >= 2 && s.route === null;

  return (
    <div className="app">
      <header className="topbar">
        <div className="game-title serif">
          江湖无尽录<span className="round">第 {s.run} 轮</span>
        </div>
        <div className="realm-chip">
          <span className="name serif">{realmDef.name}</span>
          <span className="lv">境界 {s.realm} / {REALMS.length}</span>
        </div>
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

      <nav className="game-tabs">
        <button className={tabCls(tab, 'cultivate')} onClick={() => setTab('cultivate')}>修炼</button>
        <button className={tabCls(tab, 'battle')} onClick={() => setTab('battle')}>战斗</button>
        {s.route ? (
          <button className={tabCls(tab, 'skill')} onClick={() => setTab('skill')}>武学</button>
        ) : (
          <button className="game-tab" disabled title="突破至境界 2 后解锁">武学 · 境界 2 解锁</button>
        )}
        <button className="game-tab" disabled title="首次归隐后解锁">声望阁 · 归隐后解锁</button>
        <div className="tab-pulse">
          {progress && (
            <span className="strip-item" onClick={() => setTab('cultivate')}>
              运转周天{' '}
              <span className="mini-bar">
                <i style={{ width: `${Math.min(100, (s.dantian / nextRealm!.breakthroughCost!) * 100)}%` }} />
              </span>{' '}
              <b>{progress.segmentsFull}/5</b>
              {!progress.ready && <> · 第{CN[progress.segmentsFull + 1]}周天 {Math.floor(progress.currentSegmentPct * 100)}%</>}
              {progress.ready && <> · 圆满</>}
            </span>
          )}
        </div>
      </nav>

      <main>
        {tab === 'cultivate' && <CultivatePane />}
        {tab === 'battle' && (
          <div className="pane-wrap">
            <section className="panel">
              <div className="panel-head">战斗</div>
              <div className="panel-body">
                <p className="cap-note" style={{ margin: 0, fontSize: 13, textAlign: 'center', padding: '16px 0' }}>
                  战斗模块实现中（下一实现步：三地图 28 关 + 自动结算 + 失败诊断）
                </p>
              </div>
            </section>
          </div>
        )}
        {tab === 'skill' && s.route && <SkillPane />}
      </main>

      {routeSelectOpen && <RouteSelect />}
      {s.ceremony !== null && (
        <BreakthroughCeremony
          realmTo={s.ceremony}
          prevAttrs={computeAttributes(s.ceremony - 1, s.route, s.skillLevel)}
          nextAttrs={attrs}
          onClose={s.dismissCeremony}
        />
      )}
    </div>
  );
}

const CN = ['零', '一', '二', '三', '四', '五'];
function tabCls(cur: TabId, id: TabId) {
  return cur === id ? 'game-tab active' : 'game-tab';
}
