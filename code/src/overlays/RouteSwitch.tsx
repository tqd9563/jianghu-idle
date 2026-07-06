/**
 * 换路线弹窗 —— 获批原型场景 10 的 1:1 实现。
 * 规则（规格书 §6.4）：已投入阅历 100% 返还、200 银两摩擦费（轻装上路每轮首次免）、武学清零重练。
 */
import { ROUTE_SWITCH_SILVER, skillUpgradeCost, type RouteId } from '../engine/content';
import { hasNode } from '../engine/prestige';
import { ROUTES } from '../engine/routes';
import { useGameStore } from '../store/gameStore';

const fmt = (n: number) => Math.floor(n).toLocaleString('en-US');

export function RouteSwitch({ to, onPick, onClose }: {
  to: RouteId;
  onPick: (r: RouteId) => void;
  onClose: () => void;
}) {
  const s = useGameStore();
  const from = ROUTES[s.route!];
  const target = ROUTES[to];
  const others = (Object.keys(ROUTES) as RouteId[]).filter((r) => r !== s.route);
  const free = hasNode(s.ownedRepNodes, 'qingzhuang_shanglu') && s.switchCount === 0;
  const fee = free ? 0 : ROUTE_SWITCH_SILVER;
  const affordable = s.silver >= fee;
  const skillSpent = Array.from({ length: s.skillLevel }, (_, i) => skillUpgradeCost(i + 1))
    .reduce((a, b) => a + b, 0);

  return (
    <div className="modal-backdrop open">
      <div className="modal" role="dialog" aria-label="换路线确认">
        <div className="modal-head">换路线 · {from.name.slice(0, 2)} → {target.name.slice(0, 2)}</div>
        <div className="modal-body">
          {others.length > 1 && (
            <div className="switch-picker">
              {others.map((r) => (
                <button
                  key={r}
                  className={`switch-target route-${r}${r === to ? ' active' : ''}`}
                  onClick={() => onPick(r)}
                >
                  {ROUTES[r].name}
                </button>
              ))}
            </div>
          )}
          <div className="retire-cols" style={{ gridTemplateColumns: '1fr 1fr' }}>
            <div className="rcol keep">
              <div className="rcol-head">你将取回</div>
              <div className="rline">
                <span>已投入阅历</span>
                <span className="v">{fmt(s.mechXpInvested)}（100% 返还）</span>
              </div>
              <div className="rline">
                <span>武学已耗内力</span>
                <span className="v">{fmt(skillSpent)} 不返还</span>
              </div>
              <div className="rline-note plain">内力可再生，挂机即可挣回</div>
            </div>
            <div className="rcol lose">
              <div className="rcol-head">你将支付</div>
              <div className="rline">
                <span>盘缠</span>
                <span className="v">
                  {free ? '免（轻装上路 · 每轮首次）' : `${ROUTE_SWITCH_SILVER} 银两（余 ${fmt(s.silver)}）`}
                </span>
              </div>
              <div className="rline">
                <span>武学</span>
                <span className="v">{from.skillName} Lv {s.skillLevel} 清零，{target.skillName}从 Lv 0 重练</span>
              </div>
            </div>
          </div>
          <div className="cap-note">已购「轻装上路」节点时，每轮第一次换路线免收盘缠</div>
          <div className="modal-actions">
            <button
              className="btn"
              disabled={!affordable}
              onClick={() => { s.switchRoute(to); onClose(); }}
            >
              {affordable ? `改投${target.name.slice(0, 2)}` : '银两不足'}
            </button>
            <button className="btn ghost" onClick={onClose}>再想想</button>
          </div>
        </div>
      </div>
    </div>
  );
}
