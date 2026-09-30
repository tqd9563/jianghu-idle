/**
 * 门派页 —— 定稿原型 docs/design/ui-overhaul-prototype.html「门派」`#p-sect`：
 * 未拜入是「拜山」三派选一；拜入后左「门派任务」、右「贡献商店」。
 * 数值出自 docs/systems/sect-neigong/spec.md §5（任务收益按 S12）。不称玩家为弟子：按钮写「拜入 华山」。
 */
import { useState } from 'react';
import { NEIGONG, TIERS, TIER_COUNT } from '../engine/neigong';
import { WUXUE, formName } from '../engine/wuxue';
import { SECTS, SECT_IDS, SECT_TASKS, type SectId, type SectTaskKind } from '../engine/sect';
import { sectShelfOf, useGameStore, type SectShelfRow } from '../store/gameStore';
import { fmtBig } from '../fmt';

const TASK_KINDS: SectTaskKind[] = ['short', 'long'];

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
  const join = useGameStore((s) => s.joinSect);
  const [pick, setPick] = useState<SectId>('huashan');
  return (
    <>
      <header className="jh-head">
        <div>
          <h1>拜山</h1>
          <div className="sub">择一派拜入，本世有效，下一世重选</div>
        </div>
      </header>
      <div className="jh-sect-pick" role="radiogroup" aria-label="门派">
        {SECT_IDS.map((id) => {
          const d = SECTS[id];
          return (
            <button key={id} type="button" className="jh-sect-opt" role="radio" aria-checked={pick === id} onClick={() => setPick(id)}>
              <span className="n">{d.name}</span>
              <span className="o">{d.origin}</span>
              <span className="g">
                绝学内功 {NEIGONG[d.neigong].name}<br />
                绝学武学 {WUXUE[d.wuxue[0]].name} · {WUXUE[d.wuxue[1]].name}<br />
                独门：{d.signature}
              </span>
            </button>
          );
        })}
      </div>
      <div className="jh-sect-foot">
        <span className="note">战力不因拜哪派而变，本门绝学练得快两成</span>
        <button type="button" className="jh-btn" onClick={() => join(pick)}>拜入 {SECTS[pick].name}</button>
      </div>
    </>
  );
}

/** 货架一行的标题、品质标签与说明（说明只写用途，不写开发用语） */
function shelfText(it: SectShelfRow, id: SectId): { title: string; tag: string | null; desc: string } {
  const d = SECTS[id];
  const ng = NEIGONG[d.neigong];
  switch (it.kind) {
    case 'neigong':
      return { title: it.label, tag: '绝学内功', desc: `最高可至${TIERS[TIER_COUNT[ng.quality] - 1].name}` };
    case 'wuxue': {
      const w = WUXUE[it.wuxue!];
      return w.signature
        ? { title: it.label, tag: '绝学 · 独门', desc: d.signature }
        : { title: it.label, tag: '绝学', desc: `${w.category} · 本门练得快两成` };
    }
    case 'scroll':
      return { title: `招式秘籍 · ${WUXUE[it.wuxue!].name}${formName(it.form!)}`, tag: null, desc: `领悟${formName(it.form!)}所需` };
    case 'juance':
      return { title: it.label, tag: null, desc: `${ng.name}顿悟归真所需` };
  }
}

function SectHome({ id }: { id: SectId }) {
  const s = useGameStore();
  const d = SECTS[id];
  const task = s.sectTask;
  const contrib = s.contrib ?? 0;
  const left = task ? task.endsAt - Date.now() : 0;
  const total = task ? SECT_TASKS[task.kind].hours * 3600 * 1000 : 1;
  const errand = (k: SectTaskKind) => d.errands[k === 'short' ? 0 : 1];

  return (
    <>
      <header className="jh-head"><div><h1>{d.name}</h1></div></header>
      <div className="jh-grid2">
        <section className="jh-card">
          <div className="head"><span className="serif">门派任务</span></div>
          <div className="jh-rows">
            {TASK_KINDS.map((k) => {
              const t = SECT_TASKS[k];
              const running = task?.kind === k;
              return (
                <div key={k} className="jh-row">
                  <div className="t"><span className="serif">{errand(k)}</span></div>
                  <div className="d">{t.hours} 小时 · +{t.contrib} 贡献</div>
                  <div className="a">
                    <button type="button" className="jh-btn2" disabled={task !== null} onClick={() => s.startSectTask(k)}>
                      {running ? '进行中' : '派出'}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
          {task && (
            <div className="jh-task-run">
              <div className="top"><span>{errand(task.kind)}</span><span className="left">还剩 {fmtLeft(left)}</span></div>
              <div className="jh-pline"><i style={{ width: `${Math.max(0, Math.min(100, (1 - left / total) * 100))}%` }} /></div>
            </div>
          )}
        </section>

        <section className="jh-card">
          <div className="head">
            <span className="serif">贡献商店</span>
            <small data-tip="贡献每世清零，换得的秘籍永久保留">持有 <b className="gold">{fmtBig(contrib)}</b> 贡献</small>
          </div>
          <div className="jh-rows">
            {sectShelfOf(s, id).map((it) => {
              const { title, tag, desc } = shelfText(it, id);
              const short = it.price - contrib;
              return (
                <div key={it.id} className={`jh-row${it.owned ? ' done' : it.lock ? ' lock' : ''}`}>
                  <div className="t">
                    <span className="serif">{title}</span>
                    {tag && <span className="jh-tag q3">{tag}</span>}
                  </div>
                  <div className="d">{desc}</div>
                  <div className="a">
                    {it.owned ? <span className="price">已有</span>
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
