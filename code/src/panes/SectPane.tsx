/**
 * 门派页 —— 批一最小适配（页面结构仍是列表式；场景型驻地图页见 docs/design/sect-overhaul-prototype.html，留批二）。
 * 未拜入是「拜山」二十一家按卷分组选一（未到的卷压暗、不可选）；拜入后左「差事」六档（地位不够的档不显示）、右「货架」（只列已解锁地位的行）。
 * 数值出自 docs/systems/sect-overhaul/spec.md §2–§5；绝学只换残页（W2）。帮、会写「入伙」，其余「拜入」。
 */
import { useState } from 'react';
import { volName, VOLUMES } from '../engine/enemies';
import { NEIGONG, TIERS, TIER_COUNT } from '../engine/neigong';
import { GRADE_NAMES } from '../engine/gear';
import { ROUTES } from '../engine/routes';
import { EFFECT_TAG, WUXUE, effectText, formName } from '../engine/wuxue';
import { SECTS, SECT_HOURS, SECT_VOLS, joinWord, sectTaskGain, sectsInVol, type SectHours, type SectId, type SectTier } from '../engine/sect';
import { volUnlocked, sectShelfOf, useGameStore, type SectShelfRow } from '../store/gameStore';
import { fmtBig } from '../fmt';

/** 时长按时辰写：2 小时一个时辰 */
const HOURS_TEXT: Record<SectHours, string> = { 2: '一个时辰', 8: '四个时辰' };

function fmtLeft(ms: number): string {
  const min = Math.max(0, Math.ceil(ms / 60000));
  const h = Math.floor(min / 60);
  return h > 0 ? `${h} 小时 ${min % 60} 分` : `${min} 分`;
}

export function SectPane() {
  const sect = useGameStore((s) => s.sect);
  return sect ? <SectHome id={sect} /> : <SectJoin />;
}

function SectJoin() {
  const s = useGameStore();
  const unlocked = (v: number) => volUnlocked(v, s.mapsUnlocked ?? [1]);
  const [pick, setPick] = useState<SectId>('cangya');
  const picked = SECTS[pick];
  return (
    <>
      <header className="jh-head"><div><h1>拜山</h1></div></header>
      {SECT_VOLS.map((m) => {
        const far = !unlocked(m);
        return (
          <div key={m} className="jh-sect-map">
            <div className="mh"><span className="serif">{volName(m)} · {VOLUMES[m - 1].region}</span>{far && <small>未到此地</small>}</div>
            <div className="jh-sect-pick" role="radiogroup" aria-label={`${VOLUMES[m - 1].region}的门派`}>
              {sectsInVol(m).map((id) => {
                const d = SECTS[id];
                return (
                  <button key={id} type="button" className={`jh-sect-opt${far ? ' far' : ''}`} role="radio" aria-checked={pick === id}
                    disabled={far} data-tip={far ? `到了${VOLUMES[m - 1].region}才能遇上` : undefined} onClick={() => setPick(id)}>
                    <span className="n">{d.name}</span>
                    <span className="o">{d.tierName} · {ROUTES[d.route].name}</span>
                    <span className="cat">{d.cats.map((c) => <span key={c} className="wtag">{c}</span>)}</span>
                    <span className="g">
                      {d.signature}
                      {d.juexue.length > 0 && <><br />绝学 {d.juexue.map((w) => WUXUE[w].name).join(' · ')}</>}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}
      <div className="jh-sect-foot">
        <button type="button" className="jh-btn" disabled={!unlocked(picked.vol)} onClick={() => s.joinSect(pick)}>{joinWord(picked.kind)} {picked.name}</button>
      </div>
    </>
  );
}

/** 货架一行的标题、标签与说明 */
function shelfText(it: SectShelfRow): { title: string; tag: string | null; cat: string | null; desc: string } {
  switch (it.kind) {
    case 'neigong': {
      const ng = NEIGONG[it.neigong!];
      return { title: it.label, tag: `${ng.quality}内功`, cat: null, desc: `最高可至${TIERS[TIER_COUNT[ng.quality] - 1].name}` };
    }
    case 'wuxue': {
      const w = WUXUE[it.wuxue!];
      return { title: w.name, tag: w.quality, cat: w.cat, desc: `整门 · ${EFFECT_TAG[w.effect]}` };
    }
    case 'pages': {
      const w = WUXUE[it.wuxue!];
      if (it.form === 1) return { title: w.name, tag: w.signature ? `${w.quality} · 独门` : w.quality, cat: w.cat, desc: `第一式残页 · ${EFFECT_TAG[w.effect]}` };
      return { title: `${w.name} · ${formName(it.form!)}残页`, tag: null, cat: null, desc: effectText(w, it.form!) };
    }
    case 'gear': {
      const g = it.gear!;
      return { title: g.name, tag: GRADE_NAMES[5], cat: g.cat ?? g.slot, desc: '本门装备' };
    }
    case 'juance':
      return { title: it.label, tag: null, cat: null, desc: `${NEIGONG[it.neigong!].name}顿悟归真所需` };
  }
}

function SectHome({ id }: { id: SectId }) {
  const s = useGameStore();
  const d = SECTS[id];
  const task = s.sectTask;
  const rank = s.sectRank ?? 1;
  const contrib = s.contrib ?? 0;
  const left = task ? task.endsAt - Date.now() : 0;
  const total = task ? task.hours * 3600 * 1000 : 1;
  const tiers = Array.from({ length: rank }, (_, i) => (i + 1) as SectTier);

  return (
    <>
      <header className="jh-head">
        <div>
          <h1>{d.name}</h1>
          <div className="sub">{d.ranks[rank - 1]} · 贡献 {fmtBig(contrib)} · 累计 {fmtBig(s.contribTotal ?? 0)}</div>
        </div>
      </header>
      <div className="jh-grid2">
        <section className="jh-card">
          <div className="head"><span className="serif">差事</span></div>
          <div className="jh-rows">
            {tiers.map((tier) => {
              const e = d.errands[tier - 1];
              const running = task?.tier === tier;
              return (
                <div key={tier} className="jh-row">
                  <div className="t"><span className="serif">{e.name}</span></div>
                  <div className="d">{e.text}</div>
                  <div className="a">
                    {running ? <span className="price">进行中</span> : SECT_HOURS.map((h) => (
                      <button key={h} type="button" className="jh-btn2" disabled={task !== null} onClick={() => s.startSectTask(tier, h)}>
                        {HOURS_TEXT[h]} +{sectTaskGain(tier, h)}
                      </button>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
          {task && (
            <div className="jh-task-run">
              <div className="top"><span>{d.errands[task.tier - 1].name}</span><span className="left">还剩 {fmtLeft(left)}</span></div>
              <div className="jh-pline"><i style={{ width: `${Math.max(0, Math.min(100, (1 - left / total) * 100))}%` }} /></div>
            </div>
          )}
        </section>

        <section className="jh-card">
          <div className="head"><span className="serif">货架</span></div>
          <div className="jh-rows">
            {sectShelfOf(s, id).filter((it) => it.rank <= rank).map((it) => {
              const { title, tag, cat, desc } = shelfText(it);
              const short = it.price - contrib;
              return (
                <div key={it.id} className={`jh-row${it.owned ? ' done' : it.lock ? ' lock' : ''}`}>
                  <div className="t">
                    <span className="serif">{title}</span>
                    {tag && <span className="jh-tag q3">{tag}</span>}
                    {cat && <span className="wtag">{cat}</span>}
                  </div>
                  <div className="d">{desc}</div>
                  <div className="a">
                    {it.owned ? <span className="price">已得</span>
                      : it.lock ? <span className="price">{it.lock}</span>
                        : (
                          <span className="jh-buy">
                            <button type="button" className="jh-btn2" disabled={short > 0} onClick={() => s.buySectItem(it.id)}>
                              {fmtBig(it.price)} 贡献
                            </button>
                            {short > 0 && <small>还差 {fmtBig(short)}</small>}
                          </span>
                        )}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      </div>
    </>
  );
}
