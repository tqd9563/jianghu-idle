/**
 * 应用壳（工程骨架阶段）—— 实现基准：wiki/design/prototype.html + 根目录 DESIGN.md
 * 每个前端任务：先读原型对应区块与 DESIGN.md，1:1 还原布局/间距/配色。
 */
import { REALMS } from './engine/content';
import { idleNeiliPerSec, zhoutianProgress } from './engine/formulas';

const TABS = ['修炼', '战斗', '武学', '声望阁'] as const;

export default function App() {
  // 骨架自检数据：境界 1 开局态（后续由状态 store 接管）
  const realm = REALMS[0];
  const dantian = 896;
  const cost = REALMS[1].breakthroughCost!;
  const progress = zhoutianProgress(dantian, cost);

  return (
    <div className="app">
      <header className="topbar">
        <span className="game-title">江湖无尽录</span>
        <span className="realm-name">{realm.name}</span>
        <span className="scaffold-note">
          工程骨架 · 丹田 {dantian.toLocaleString()}（+{idleNeiliPerSec(realm.realm).toFixed(1)}/秒）· 周天{' '}
          {progress.segmentsFull}/5
        </span>
      </header>
      <nav className="game-tabs">
        {TABS.map((t, i) => (
          <button key={t} className={i === 0 ? 'game-tab active' : 'game-tab'} disabled={i > 1}>
            {t}
          </button>
        ))}
      </nav>
      <main className="stage">
        <p>骨架已就绪：engine（公式/内容表）· save（存档）· telemetry（埋点）。</p>
        <p>下一步按原型场景逐一实现：主界面四页签 → 战斗循环 → 归隐流程 → 声望阁。</p>
      </main>
    </div>
  );
}
