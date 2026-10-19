/**
 * 选内功 —— docs/design/sect-neigong-prototype.html §1 的实现（取代原「择路」）。
 * 境界 2 突破后全屏：首世只有三部寻常内功；之后每一世开头从已拥有的内功里选，按路数分组。
 * 每世开头选内功不收费、不折算（sect-neigong/spec.md S8）。
 */
import { useState } from 'react';
import type { RouteId } from '../engine/content';
import { NEIGONG, QUALITY_ORDER, type NeigongId } from '../engine/neigong';
import { EFFECT_TAG, GIFT_WUXUE_OPTIONS, WUXUE, effectText, type WuxueId } from '../engine/wuxue';
import { useGameStore } from '../store/gameStore';

const ROUTE_ORDER: RouteId[] = ['huashan', 'shaolin', 'tangmen'];
const CARD: Record<RouteId, { cls: string; lu: string; items: React.ReactNode[] }> = {
  huashan: {
    cls: 'hs', lu: '归海 · 爆发',
    items: [<>会心率 <b>+10pp</b>，会心伤害 <b>+20pp</b></>, <><b>开战首击必定会心</b>（并叠 1 重浪）</>, <>每次会心叠 <b>1 重浪</b>；叠满 5 重自动施展<b>排山倒海</b></>],
  },
  shaolin: {
    cls: 'sl', lu: '镇岳 · 护体',
    items: [<>开战自动获得 <b>30% 气血护盾</b></>, <>受击自动反伤 <b>25%</b></>, <>防御 <b>+20%</b></>],
  },
  tangmen: {
    cls: 'tm', lu: '蚀骨 · 阴毒',
    items: [<>开战自动<b>施毒 1 层</b>，命中 <b>+1 层</b>（上限 8）</>, <>毒伤系数 <b>12%</b>，无视防御、绕过护盾</>, <>满层触发<b>毒爆 50%</b></>],
  },
};
const Q_CLS = { 寻常: 'q1', 上乘: 'q2', 绝学: 'q3' } as const;

export function NeigongSelect() {
  const owned = useGameStore((s) => s.ownedNeigong);
  const firstTime = useGameStore((s) => s.run === 1);
  const selectNeigong = useGameStore((s) => s.selectNeigong);
  const byRoute = (r: RouteId) =>
    owned.filter((id) => NEIGONG[id].route === r)
      .sort((a, b) => QUALITY_ORDER.indexOf(NEIGONG[b].quality) - QUALITY_ORDER.indexOf(NEIGONG[a].quality));
  const [picked, setPicked] = useState<NeigongId>(byRoute('huashan')[0] ?? 'jingleijue');
  const multi = owned.some((id) => NEIGONG[id].quality !== '寻常');

  return (
    <div className="jh-ceremony calm ngs" role="dialog" aria-label="择一部内功">
      <div>
        <div className="kick">{firstTime ? '传 功' : '择 一 部 内 功'}</div>
        <h2 className="mid">{firstTime ? '择一门心法' : '隐世前辈 · 各传一脉'}</h2>
        <div className="ngs-cards" role="radiogroup" aria-label="内功">
          {ROUTE_ORDER.map((r) => {
            const list = byRoute(r);
            const c = CARD[r];
            const selected = NEIGONG[picked].route === r;
            const shownId = selected ? picked : list[0];
            return (
              <div
                key={r}
                role="radio"
                aria-checked={selected}
                tabIndex={0}
                className={`jh-card ngs-card${selected ? ' on' : ''}`}
                onClick={() => { if (!selected && list[0]) setPicked(list[0]); }}
                onKeyDown={(e) => { if ((e.key === 'Enter' || e.key === ' ') && !selected && list[0]) { e.preventDefault(); setPicked(list[0]); } }}
              >
                <div className="ngs-name">{NEIGONG[shownId].name}</div>
                <div className="ngs-lu">{c.lu}</div>
                {multi && (
                  <div className="ngs-owned" role="radiogroup" aria-label={`${c.lu}一路已有内功`}>
                    {list.map((id) => (
                      <button
                        key={id}
                        type="button"
                        className={`ngs-chip${picked === id ? ' on' : ''}`}
                        aria-pressed={picked === id}
                        onClick={(e) => { e.stopPropagation(); setPicked(id); }}
                      >
                        <span className={`jh-tag ${Q_CLS[NEIGONG[id].quality]}`}>{NEIGONG[id].quality}</span>
                        {NEIGONG[id].name}
                      </button>
                    ))}
                  </div>
                )}
                <ul className="ngs-items">{c.items.map((it, i) => <li key={i}>{it}</li>)}</ul>
              </div>
            );
          })}
        </div>
        <div className="acts">
          <button type="button" className="jh-btn breathe" onClick={() => selectNeigong(picked)}>
            主修 {NEIGONG[picked].name}
          </button>
        </div>
      </div>
    </div>
  );
}

/** 传功第二屏：选完内功后前辈再授一门武学，拳 / 掌 / 腿三选一（docs/design/idle-ux-prototype.html ③） */
export function GiftWuxueSelect() {
  const pick = useGameStore((s) => s.pickGiftWuxue);
  const [picked, setPicked] = useState<WuxueId>(GIFT_WUXUE_OPTIONS[0]);
  return (
    <div className="jh-ceremony calm ngs" role="dialog" aria-label="择一门武学">
      <div>
        <div className="kick">传 功</div>
        <h2 className="mid">择一门武学</h2>
        <div className="ngs-cards" role="radiogroup" aria-label="武学">
          {GIFT_WUXUE_OPTIONS.map((id) => {
            const d = WUXUE[id];
            const on = picked === id;
            return (
              <div
                key={id}
                role="radio"
                aria-checked={on}
                tabIndex={0}
                className={`jh-card ngs-card${on ? ' on' : ''}`}
                onClick={() => setPicked(id)}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setPicked(id); } }}
              >
                <div className="ngs-name">{d.name}</div>
                <div className="ngs-lu">{d.cat} · {d.quality} · {EFFECT_TAG[d.effect]}</div>
                <ul className="ngs-items">
                  <li>触发 <b>{Math.round(d.p * 100)}%</b>，冷却 <b>{d.cd}</b> 回合</li>
                  <li>第一式 <b>{effectText(d, 1)}</b></li>
                </ul>
              </div>
            );
          })}
        </div>
        <div className="acts">
          <button type="button" className="jh-btn breathe" onClick={() => pick(picked)}>习 {WUXUE[picked].name}</button>
        </div>
      </div>
    </div>
  );
}
