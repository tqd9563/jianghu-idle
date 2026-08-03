/** 冲穴面板 + 气势条 + 经脉图 —— 权威来源：docs/systems/zhoutian/design.md（原 spec §5/§11，映射见该文口径守恒表） */
import {
  REALM_ACUPOINTS, QISHI_FULL, currentSuccessRate, qishiToBonus,
  isMeridianComplete,
} from '../engine/acupoints';
import { useGameStore } from '../store/gameStore';

/** 气势条（spec §11-6 第三层语义：丹田充满后溢出可见，与进度回落/印记常亮可区分） */
export function QishiBar() {
  const qishi = useGameStore(s => s.qishi ?? 0);
  const bonus = qishiToBonus(qishi);
  const pct = Math.min(100, (qishi / QISHI_FULL) * 100);
  return (
    <div className="qishi-bar" aria-label={`气势 ${Math.floor(qishi)} / ${QISHI_FULL}`}>
      <span className="k">气势</span>
      <span className="mini-bar">
        <i style={{ width: `${pct}%` }} />
      </span>
      <span className="v">{Math.floor(qishi)} / {QISHI_FULL} · +{Math.round(bonus * 100)}pp</span>
    </div>
  );
}

/** 经脉图（spec §4.4：窍穴分组容器，全部冲开有贯通奖励） */
export function MeridianMap() {
  const s = useGameStore();
  const realm = s.realm;
  const acupointData = REALM_ACUPOINTS[realm];
  if (!acupointData) return null;
  const openedIds = new Set(
    Object.entries(s.acupointProgress ?? {})
      .filter(([, a]) => a.opened)
      .map(([id]) => id)
  );
  return (
    <div className="meridian-map">
      {acupointData.meridians.map(m => {
        const complete = isMeridianComplete(m, openedIds);
        const openedInMeridian = m.acupointIds.filter(id => openedIds.has(id)).length;
        return (
          <div key={m.id} className={`meridian${complete ? ' complete' : ''}`}>
            <span className="mname">{m.name}</span>
            <span className="mstatus">{complete ? '贯通' : `${openedInMeridian}/${m.acupointIds.length}`}</span>
          </div>
        );
      })}
    </div>
  );
}

/** 冲穴面板（spec §5.2：消耗 1 机会，概率判定，保底累积） */
export function AcupointPanel() {
  const s = useGameStore();
  const realm = s.realm;
  const acupointData = REALM_ACUPOINTS[realm];
  if (!acupointData) return null;  // 本版境界 1/6/7 不接入
  const chances = s.chongxueChances ?? 0;
  const qishiBonus = qishiToBonus(s.qishi ?? 0);

  return (
    <div className="acupoint-panel panel">
      <div className="panel-head">
        行气冲穴 <span className="sub">机会 {chances}</span>
      </div>
      <div className="panel-body">
        <QishiBar />
        <div className="acupoint-grid">
          {acupointData.acupoints.map(a => {
            const state = s.acupointProgress?.[a.id] ?? { failCount: 0, opened: false };
            const p = currentSuccessRate(state, qishiBonus);
            return (
              <button
                key={a.id}
                className={`acupoint${state.opened ? ' opened' : ''}`}
                disabled={state.opened || chances <= 0}
                onClick={() => s.attemptAcupoint(a.id)}
              >
                <span className="aname">{a.name}</span>
                {state.opened ? (
                  <span className="astatus">已通</span>
                ) : (
                  <span className="astatus">
                    {Math.round(p * 100)}%
                    {state.failCount > 0 ? ` · 松动${state.failCount}` : ''}
                  </span>
                )}
              </button>
            );
          })}
        </div>
        <MeridianMap />
      </div>
    </div>
  );
}
