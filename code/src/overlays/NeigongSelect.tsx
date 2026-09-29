/**
 * 选内功 —— docs/design/sect-neigong-prototype.html §1 的实现（取代原「择路」）。
 * 境界 2 突破后全屏：首世只有三部寻常内功；之后每一世开头从已拥有的内功里选，按路数分组。
 * 每世开头选内功不收费、不折算（sect-neigong/spec.md S8）。
 */
import { useState } from 'react';
import type { RouteId } from '../engine/content';
import { NEIGONG, QUALITY_ORDER, type NeigongId } from '../engine/neigong';
import { useGameStore } from '../store/gameStore';

const ROUTE_ORDER: RouteId[] = ['huashan', 'shaolin', 'tangmen'];
const CARD: Record<RouteId, { cls: string; lu: string; motif: string; items: React.ReactNode[]; cost: string }> = {
  huashan: {
    cls: 'hs', lu: '惊雷 · 爆发', motif: '快剑爆发 · 短战最强，看脸不稳',
    items: [<>暴击率 <b>+10pp</b>，暴击伤害 <b>+20pp</b></>, <><b>开战首击必定暴击</b>（并积 1 层剑意）</>, <>每次暴击积 <b>1 层剑意</b>；满 5 层自动施展<b>爆发剑招</b></>],
    cost: '短板：面对高闪敌人命中不稳',
  },
  shaolin: {
    cls: 'sl', lu: '镇岳 · 护体', motif: '铁壁反震 · 打不死你，磨死对手',
    items: [<>开战自动获得 <b>30% 气血护盾</b></>, <>受击自动反伤 <b>25%</b></>, <>防御 <b>+20%</b></>],
    cost: '短板：护盾不防毒，输出最慢',
  },
  tangmen: {
    cls: 'tm', lu: '蚀骨 · 阴毒', motif: '叠毒后发 · 越拖越强，开局最软',
    items: [<>开战自动<b>施毒 1 层</b>，命中 <b>+1 层</b>（上限 8）</>, <>毒伤系数 <b>12%</b>，无视防御、绕过护盾</>, <>满层触发<b>毒爆 50%</b></>],
    cost: '代价：普攻伤害 ×0.60，短战偏慢',
  },
};
const Q_CLS = { 寻常: 'q-common', 上乘: 'q-fine', 绝学: 'q-peak' } as const;

export function NeigongSelect() {
  const owned = useGameStore((s) => s.ownedNeigong);
  const selectNeigong = useGameStore((s) => s.selectNeigong);
  const byRoute = (r: RouteId) =>
    owned.filter((id) => NEIGONG[id].route === r)
      .sort((a, b) => QUALITY_ORDER.indexOf(NEIGONG[b].quality) - QUALITY_ORDER.indexOf(NEIGONG[a].quality));
  const [picked, setPicked] = useState<NeigongId>(byRoute('huashan')[0] ?? 'jingleijue');
  const multi = owned.some((id) => NEIGONG[id].quality !== '寻常');

  return (
    <div className="route-select-overlay">
      <div className="route-select-wrap">
        <h1 className="serif">择 一 部 内 功</h1>
        <p className="lede">隐世前辈各传一脉心法——习其艺，不列门墙。</p>
        <p className="lede-sub">选定后本世主修此功；一世之内也能转修，但要付代价。下一世开头重选，不收费。</p>
        <div className="route-cards">
          {ROUTE_ORDER.map((r) => {
            const list = byRoute(r);
            const c = CARD[r];
            const selected = NEIGONG[picked].route === r;
            return (
              <div
                key={r}
                className={`route-card ${c.cls}${selected ? ' selected' : ''}`}
                onClick={() => { if (!selected && list[0]) setPicked(list[0]); }}
              >
                <div className="rc-name serif">{NEIGONG[selected ? picked : list[0]].name}</div>
                <div className="rc-style">{c.lu} · {c.motif}</div>
                {multi && (
                  <div className="ng-owned" role="radiogroup" aria-label={`${c.lu}一路已有内功`}>
                    {list.map((id) => (
                      <button
                        key={id}
                        className={`ng-chip${picked === id ? ' on' : ''}`}
                        aria-pressed={picked === id}
                        onClick={(e) => { e.stopPropagation(); setPicked(id); }}
                      >
                        <span className={`qtag ${Q_CLS[NEIGONG[id].quality]}`}>{NEIGONG[id].quality}</span>
                        {NEIGONG[id].name}
                      </button>
                    ))}
                  </div>
                )}
                <div className="rc-grant">修习即得</div>
                <ul>{c.items.map((it, i) => <li key={i}>{it}</li>)}</ul>
                <div className="rc-cost">{c.cost}</div>
              </div>
            );
          })}
        </div>
        <div className="route-confirm">
          <button className="btn pulse" onClick={() => selectNeigong(picked)}>
            主修 {NEIGONG[picked].name}
          </button>
        </div>
      </div>
    </div>
  );
}
