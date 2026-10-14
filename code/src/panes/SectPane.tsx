/**
 * 门派页 —— 定稿原型 docs/design/battle-loot-prototype.html「门派」`#p-sect`：
 * 未拜入是「拜山」九派按地图分组选一（未到的图压暗、不可选）；拜入后左「门派任务」、右「贡献商店」。
 * 数值出自 docs/systems/sect-neigong/spec.md §5（任务收益按 S12）与名录 §5；绝学只换残页（W2）。不称玩家为弟子：按钮写「拜入 华山」。
 */
import { useState } from 'react';
import { mapName } from '../engine/enemies';
import { NEIGONG, TIERS, TIER_COUNT } from '../engine/neigong';
import { EFFECT_TAG, WUXUE, formKey, formName } from '../engine/wuxue';
import { SECTS, SECT_MAPS, SECT_PAGES, SECT_TASKS, sectsOnMap, type SectId, type SectTaskKind } from '../engine/sect';
import { mapUnlocked, sectShelfOf, useGameStore, type SectShelfRow } from '../store/gameStore';
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

/** 各图的一句说明：开局那图直接可拜，后两图要先解锁 */
const MAP_NOTE: Record<number, string> = { 1: '开局 · 境界 3 起可拜', 2: '打通村外小径 · 初入 Boss 后，三派弟子行走江湖', 3: '打通洛阳近郊 · 初入 Boss 后' };

function SectJoin() {
  const s = useGameStore();
  const unlocked = (m: number) => mapUnlocked(m as 1 | 2 | 3, s.tiersUnlocked ?? ['1-0']);
  const [pick, setPick] = useState<SectId>('huashan');
  return (
    <>
      <header className="jh-head">
        <div>
          <h1>拜山</h1>
          <div className="sub">择一派拜入，本世有效，下一世重选</div>
        </div>
      </header>
      {SECT_MAPS.map((m) => {
        const far = !unlocked(m);
        return (
          <div key={m} className="jh-sect-map">
            <div className="mh"><span className="serif">{mapName(m)}</span><small>{far ? '未到此地 · ' : ''}{MAP_NOTE[m]}</small></div>
            <div className="jh-sect-pick" role="radiogroup" aria-label={`${mapName(m)}的门派`}>
              {sectsOnMap(m).map((id) => {
                const d = SECTS[id];
                return (
                  <button key={id} type="button" className={`jh-sect-opt${far ? ' far' : ''}`} role="radio" aria-checked={pick === id}
                    disabled={far} data-tip={far ? `到了${mapName(m)}才能遇上` : undefined} onClick={() => setPick(id)}>
                    <span className="n">{d.name}</span>
                    <span className="o">{d.origin}</span>
                    <span className="cat">{d.cats.map((c) => <span key={c} className="wtag">{c}</span>)}</span>
                    <span className="g">
                      所长 {d.signature}<br />
                      绝学 {d.wuxue.map((w) => WUXUE[w].name).join(' · ')}
                      {d.neigong && <><br />绝学内功 {NEIGONG[d.neigong].name}</>}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}
      <div className="jh-sect-foot">
        <span className="note">战力不因拜哪派而变，本门绝学练得快两成</span>
        <button type="button" className="jh-btn" disabled={!unlocked(SECTS[pick].map)} onClick={() => s.joinSect(pick)}>拜入 {SECTS[pick].name}</button>
      </div>
    </>
  );
}

/** 货架一行的标题、标签与说明（说明只写用途，不写开发用语） */
function shelfText(it: SectShelfRow, id: SectId, have: number): { title: string; tag: string | null; cat: string | null; desc: string } {
  const d = SECTS[id];
  switch (it.kind) {
    case 'neigong': {
      const ng = NEIGONG[d.neigong!];
      return { title: it.label, tag: '绝学内功', cat: null, desc: `最高可至${TIERS[TIER_COUNT[ng.quality] - 1].name}` };
    }
    case 'pages': {
      const w = WUXUE[it.wuxue!];
      if (it.form === 1) {
        return {
          title: w.name, tag: w.signature ? '绝学 · 独门' : '绝学', cat: w.cat,
          desc: `第一式残页 · 已集 ${Math.min(have, SECT_PAGES)} / ${SECT_PAGES} · ${EFFECT_TAG[w.effect]} · 本门练得快两成`,
        };
      }
      return {
        title: `${w.name} · ${formName(it.form!)}残页`, tag: null, cat: null,
        desc: `已集 ${Math.min(have, SECT_PAGES)} / ${SECT_PAGES} · 拼齐即可参悟${formName(it.form!)}`,
      };
    }
    case 'juance':
      return { title: it.label, tag: null, cat: null, desc: `${NEIGONG[d.neigong!].name}顿悟归真所需` };
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
            <small data-tip="贡献每世清零，换得的残页与内功永久保留">持有 <b className="gold">{fmtBig(contrib)}</b> 贡献</small>
          </div>
          <div className="jh-rows">
            {sectShelfOf(s, id).map((it) => {
              const have = it.kind === 'pages' ? (s.pages ?? {})[formKey(it.wuxue!, it.form!)] ?? 0 : 0;
              const { title, tag, cat, desc } = shelfText(it, id, have);
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
                    {it.owned ? <span className="price">{it.kind === 'pages' ? '已拼齐' : '已有'}</span>
                      : it.lock ? <span className="price">{it.lock}</span>
                        : (
                          <span className="jh-buy">
                            <button type="button" className="jh-btn2" disabled={short > 0} onClick={() => s.buySectItem(it.id)}>
                              {fmtBig(it.price)} 贡献{it.kind === 'pages' ? ' / 页' : ''}
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
