/**
 * 挂机小结（收功）—— docs/design/idle-ux-prototype.html ①，battle-loot/design.md 裁决 44。
 * 点「停止」时弹出：时长、场次与胜场、银两、获得（装备 / 武学全本 / 武学残页，为 0 的不列）。
 */
import { Fragment } from 'react';
import { fmtBig, minText, shichenText } from '../fmt';
import type { IdleSummary as Summary } from '../store/gameStore';

export function IdleSummary({ sum, onClose }: { sum: Summary; onClose: () => void }) {
  const sec = Math.max(0, (sum.until - sum.since) / 1000);
  const got = [
    ['装备', sum.gear],
    ['武学全本', sum.books],
    ['武学残页', sum.pages],
  ].filter(([, n]) => (n as number) > 0) as [string, number][];
  return (
    <div className="jh-ceremony calm" role="dialog" aria-label="收功">
      <div>
        <div className="kick">收 功</div>
        <h2 className="mid">{shichenText(sec / 60, '挂机')}</h2>
        <div className="d">第 {sum.stage} 关 · {sum.enemyName} · {minText(sec)}</div>
        <div className="gains">
          <span>场次</span><span><b>{sum.fights}</b> 场 · 胜 {sum.wins}</span>
          <span>银两</span><span><b>+{fmtBig(sum.silver)}</b></span>
          {got.length > 0 && (
            <><span>获得</span><span>{got.map(([k, n], i) => <Fragment key={k}>{i > 0 && '，'}{k} ×<b>{n}</b></Fragment>)}</span></>
          )}
        </div>
        <div className="acts">
          <button type="button" className="jh-btn" style={{ minWidth: 240 }} onClick={onClose}>好</button>
        </div>
      </div>
    </div>
  );
}
