/**
 * 门派页 —— docs/design/sect-neigong-prototype.html §5 的实现：拜入 → 门派任务 + 贡献商店。
 * 数值出自 docs/systems/sect-neigong/spec.md §5（任务收益按 S12）。不称玩家为弟子：按钮写「拜入 华山」。
 */
import { useState } from 'react';
import { NEIGONG } from '../engine/neigong';
import { WUXUE } from '../engine/wuxue';
import { SECTS, SECT_IDS, SECT_TASKS, type SectId, type SectTaskKind } from '../engine/sect';
import { sectShelfOf, useGameStore } from '../store/gameStore';

const LU_NAME = { huashan: '惊雷', shaolin: '镇岳', tangmen: '蚀骨' } as const;
const TAG: Record<string, string> = { neigong: '绝学内功', wuxue: '绝学', scroll: '招式秘籍', juance: '' };

function fmtLeft(ms: number): string {
  const min = Math.max(0, Math.ceil(ms / 60000));
  const h = Math.floor(min / 60);
  return h > 0 ? `${h} 小时 ${min % 60} 分` : `${min} 分`;
}

export function SectPane() {
  const sect = useGameStore((s) => s.sect);
  return <div className="pane-wrap">{sect ? <SectHome id={sect} /> : <SectJoin />}</div>;
}

function SectJoin() {
  const join = useGameStore((s) => s.joinSect);
  const [pick, setPick] = useState<SectId>('huashan');
  return (
    <section className="panel">
      <div className="panel-head">择一派拜入 <span className="sub">本世有效；下一世重选</span></div>
      <div className="panel-body">
        <div className="sect-grid" role="radiogroup" aria-label="门派">
          {SECT_IDS.map((id) => {
            const d = SECTS[id];
            return (
              <button key={id} className="sect-card" role="radio" aria-checked={pick === id} onClick={() => setPick(id)}>
                <span className="nm serif">{d.name}</span>
                <span className="origin">{d.origin}</span>
                <span className="goods">
                  绝学内功：{NEIGONG[d.neigong].name}（{LU_NAME[id]}）<br />
                  绝学武学：{WUXUE[d.wuxue[0]].name} · {WUXUE[d.wuxue[1]].name}（独门：{d.signature}）
                </span>
              </button>
            );
          })}
        </div>
        <div className="sect-join-row">
          <span className="cap-note">本门绝学练得快两成（熟练阈值 ×0.8）。战力不因拜哪派而变，拜入不受所修路数限制。</span>
          <button className="btn small" onClick={() => join(pick)}>拜入 {SECTS[pick].name}</button>
        </div>
      </div>
    </section>
  );
}

function SectHome({ id }: { id: SectId }) {
  const s = useGameStore();
  const d = SECTS[id];
  const task = s.sectTask;
  const contrib = s.contrib ?? 0;
  const left = task ? task.endsAt - Date.now() : 0;
  const total = task ? SECT_TASKS[task.kind].hours * 3600 * 1000 : 1;

  return (
    <div className="pane-grid">
      <div>
      <section className="panel">
        <div className="panel-head">门派任务 <span className="sub">同时只跑一件，到时自动结算，离线照算</span></div>
        <div className="panel-body">
          <div className="contrib">本世贡献 <b>{contrib}</b></div>
          <div className="task-row">
            {(Object.keys(SECT_TASKS) as SectTaskKind[]).map((k, i) => {
              const t = SECT_TASKS[k];
              return (
                <div key={k} className="task">
                  <span className="tn serif">{t.name}</span>
                  <span className="td">{t.hours} 小时 · <b>+{t.contrib}</b> 贡献 · {t.hint}</span>
                  <button className="btn ghost small" disabled={task !== null} onClick={() => s.startSectTask(k)}>
                    {task ? '已有任务在跑' : `派 · ${d.errands[i]}`}
                  </button>
                </div>
              );
            })}
          </div>
          {task && (
            <div className="running">
              <div className="rl">
                <span><b>{SECT_TASKS[task.kind].name}</b> · {d.errands[task.kind === 'short' ? 0 : 1]}</span>
                <span>剩 {fmtLeft(left)}</span>
              </div>
              <div className="bar thin"><i style={{ width: `${Math.min(100, (1 - left / total) * 100)}%` }} /></div>
            </div>
          )}
        </div>
      </section>
      </div>

      <div>
      <section className="panel">
        <div className="panel-head">{d.name} · 贡献商店 <span className="right">贡献 <b>{contrib}</b></span></div>
        <div className="panel-body">
          <div className="wx-shop sect-shop">
            {sectShelfOf(s, id).map((it) => (
              <div key={it.id} className={`wx-good${it.owned ? ' owned' : ''}${it.lock ? ' locked' : ''}`}>
                <span className="gn serif">{it.label}</span>
                <span className="qtag q-peak">
                  {it.kind === 'juance' ? NEIGONG[d.neigong].name
                    : it.kind === 'wuxue' && WUXUE[it.wuxue!].signature ? '绝学 · 独门' : TAG[it.kind]}
                </span>
                <span className="gp">{it.owned ? '已有' : it.lock ? `${it.price} · ${it.lock}` : it.price}</span>
                {!it.owned && !it.lock && (
                  <button className="btn small" disabled={contrib < it.price} onClick={() => s.buySectItem(it.id)}>
                    {contrib < it.price ? `差 ${it.price - contrib}` : '兑换'}
                  </button>
                )}
              </div>
            ))}
          </div>
          <div className="cap-note">贡献每世清零，换得的秘籍永久保留。单件最贵 600，一世的贡献买得起。</div>
        </div>
      </section>
      </div>
    </div>
  );
}
