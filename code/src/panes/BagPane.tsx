/**
 * 行囊页 —— 定稿原型 docs/design/battle-loot-prototype.html `#p-bag`（battle-loot/design.md §3.5，DESIGN.md「行囊」）。
 * 左：四个部位的穿戴 + 合计；右：形态格背包（10 列 × 8 行，按部位占格、自动紧凑摆放）+ 比较面板。
 * 品阶靠描边 / 底晕 / 角标说，名字连前缀一起着品阶色；不写说明小字。
 */
import { useEffect, useState } from 'react';
import {
  BAG_CELLS, GEAR_SHAPE, GEAR_SLOTS, GRADE_NAMES, affixText, bagUsed, betterThanWorn, gearFullName, gearPrefix,
  type BaseKey, type GearItem, type GearSlot,
} from '../engine/gear';
import { useGameStore } from '../store/gameStore';

type Sort = 'new' | 'grade' | 'slot';
const SORTS: readonly [Sort, string][] = [['new', '新得'], ['grade', '品阶'], ['slot', '部位']];
const BASE_KEYS: readonly BaseKey[] = ['攻击', '气血', '防御', '命中', '闪避'];
const SLOT_ORDER: Record<GearSlot, number> = { 兵器: 0, 暗器: 1, 衣甲: 2, 佩饰: 3 };

const Img = ({ it, className }: { it: GearItem; className?: string }) => (
  <img className={className ?? 'ink'} src={`/art/gear/${it.img}.png`} alt="" />
);

/** 名字 + 品阶章 + 类别 */
function Name({ it }: { it: GearItem }) {
  return (
    <span className="nm">
      <span className={`g${it.grade}`}>{gearPrefix(it) && <span className="pre">{gearPrefix(it)}</span>}{it.name}</span>
      <span className={`gtag g${it.grade}`}>{GRADE_NAMES[it.grade]}</span>
      {it.cat && <span className="wtag">{it.cat}</span>}
    </span>
  );
}

export function BagPane() {
  const s = useGameStore();
  const bag = s.bag ?? [];
  const worn = s.worn ?? {};
  const [sel, setSel] = useState<string | null>(null);
  const [sort, setSort] = useState<Sort>('new');

  const pick = (it: GearItem) => setSel(it.id);
  // 离开这一页，这趟看过的就不再算新得（金点清掉）；页内不动，免得「新得」排序跳位
  useEffect(() => () => useGameStore.getState().markBagSeen(), []);
  const selected = bag.find((g) => g.id === sel) ?? Object.values(worn).find((g) => g?.id === sel) ?? null;
  const selWorn = !!selected && worn[selected.slot]?.id === selected.id;

  const list = [...bag].sort(
    sort === 'new' ? (a, b) => (b.fresh ? 1 : 0) - (a.fresh ? 1 : 0) || b.grade - a.grade
      : sort === 'grade' ? (a, b) => b.grade - a.grade
        : (a, b) => SLOT_ORDER[a.slot] - SLOT_ORDER[b.slot] || b.grade - a.grade,
  );
  const used = bagUsed(bag);
  const lowCount = bag.filter((g) => g.grade < 3).length;

  const sum: Partial<Record<BaseKey, number>> = {};
  for (const it of Object.values(worn)) {
    if (!it) continue;
    for (const k of BASE_KEYS) if (it.base[k]) sum[k] = (sum[k] ?? 0) + it.base[k]!;
  }

  return (
    <>
      <header className="jh-head"><div><h1>行囊</h1></div></header>
      <div className="bag">
        <div>
          <h2 className="jh-sec">穿戴</h2>
          <div className="worn">
            {GEAR_SLOTS.map((slot) => {
              const it = worn[slot];
              if (!it) return <div key={slot} className="worn-i empty"><span className="slot-k">{slot}</span></div>;
              return (
                <div key={slot} className="worn-i" role="button" tabIndex={0} aria-pressed={sel === it.id}
                  onClick={() => pick(it)} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); pick(it); } }}>
                  <span className="slot-k">{slot}<Img it={it} /></span>
                  <Name it={it} />
                  <span className="base">{BASE_KEYS.filter((k) => it.base[k]).map((k, i) => <span key={k}>{i > 0 && ' · '}{k} <b>+{it.base[k]}</b></span>)}</span>
                  {it.afx.length > 0 && <span className="afx">{it.afx.map((a) => <span key={a[0]}>{affixText(a)}</span>)}</span>}
                </div>
              );
            })}
          </div>
          {Object.keys(sum).length > 0 && (
            <div className="worn-sum">
              <div>合计：{BASE_KEYS.filter((k) => sum[k]).map((k, i) => <span key={k}>{i > 0 && ' · '}{k} <b>+{sum[k]}</b></span>)}</div>
            </div>
          )}
        </div>

        <div>
          <div className="bag-head">
            <h2 className="jh-sec" style={{ margin: 0 }}>背包 <small className="faint">{used} / {BAG_CELLS} 格</small></h2>
            <div className="tools">
              <div className="jh-cats">
                {SORTS.map(([k, name]) => (
                  <button key={k} type="button" aria-pressed={sort === k} onClick={() => setSort(k)}>{name}</button>
                ))}
              </div>
              <button type="button" className="jh-btn2 quiet" disabled={lowCount === 0}
                data-tip="卖掉背包里上乘以下的装备" onClick={() => s.sellGearBelow(3)}>
                一键出售 上乘以下
              </button>
            </div>
          </div>
          <div className="bag-grid">
            {list.map((it) => {
              const better = betterThanWorn(it, worn) && !!worn[it.slot];
              const [c, r] = GEAR_SHAPE[it.slot];
              return (
                <button key={it.id} type="button"
                  className={`item g${it.grade}${it.grade <= 2 && !better ? ' dim' : ''}`}
                  style={{ gridColumn: `span ${c}`, gridRow: `span ${r}` }}
                  aria-pressed={sel === it.id}
                  data-tip={`${gearFullName(it)} · ${GRADE_NAMES[it.grade]} · ${it.slot}${it.cat ? ' · ' + it.cat : ''}`}
                  onClick={() => pick(it)}>
                  {better && <span className="up">▲</span>}
                  {it.fresh && <span className="fresh" />}
                  <Img it={it} />
                </button>
              );
            })}
            {Array.from({ length: Math.max(0, BAG_CELLS - used) }, (_, i) => <i key={i} className="cell" />)}
          </div>

          <div className={`jh-card cmp${selected ? '' : ' none'}`}>
            {!selected ? null : (
              <Compare it={selected} cur={selWorn ? null : worn[selected.slot] ?? null} isWorn={selWorn}
                onWear={() => { s.wearGear(selected.id); }}
                onSell={() => { s.sellGear(selected.id); setSel(null); }}
                onUnwear={() => { s.unwearGear(selected.slot); }} />
            )}
          </div>
        </div>
      </div>
    </>
  );
}

function Compare(props: {
  it: GearItem; cur: GearItem | null; isWorn: boolean;
  onWear: () => void; onSell: () => void; onUnwear: () => void;
}) {
  const { it, cur, isWorn } = props;
  const keys = BASE_KEYS.filter((k) => it.base[k] || cur?.base[k]);
  const bagFull = useGameStore((s) => bagUsed(s.bag ?? []) + GEAR_SHAPE[it.slot][0] * GEAR_SHAPE[it.slot][1] > BAG_CELLS);
  return (
    <>
      <div className={`cmp-art g${it.grade}`}><Img it={it} /></div>
      <div className="cmp-body">
        <div className="cmp-h"><Name it={it} /></div>
        <div className="diff">
          {keys.map((k) => {
            const a = it.base[k] ?? 0, c = cur?.base[k] ?? 0, d = a - c;
            return (
              <span key={k} className="r">
                <span className="k">{k}</span>
                <span className="v">+{a}</span>
                <span className={`d${d > 0 ? ' up' : d < 0 ? ' dn' : ''}`}>{isWorn ? '' : d > 0 ? `▲ ${d}` : d < 0 ? `▼ ${-d}` : '—'}</span>
              </span>
            );
          })}
          {it.afx.map((a) => (
            <span key={a[0]} className="r">
              <span className="k">{gearPrefix({ afx: [a] }).replace(/的$/, '')}</span>
              <span className="v">{affixText(a)}</span>
              <span className="d" />
            </span>
          ))}
        </div>
        <div className="acts">
          {isWorn
            ? <button type="button" className="jh-btn2 quiet" disabled={bagFull} onClick={props.onUnwear}>卸下</button>
            : (
              <>
                <button type="button" className="jh-btn2" onClick={props.onWear}>穿戴</button>
                <button type="button" className="jh-btn2 quiet" onClick={props.onSell}>卖出（{it.sell} 两）</button>
              </>
            )}
        </div>
      </div>
    </>
  );
}
