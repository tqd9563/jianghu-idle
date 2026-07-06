/** 路线选择 —— 原型场景 2 的 1:1 实现（境界 2 突破后全屏，选择即得赠予） */
import { useState } from 'react';
import type { RouteId } from '../engine/content';
import { useGameStore } from '../store/gameStore';

export function RouteSelect() {
  const selectRoute = useGameStore((s) => s.selectRoute);
  const [picked, setPicked] = useState<RouteId>('huashan');

  const NAME: Record<RouteId, string> = { huashan: '华山', shaolin: '少林', tangmen: '唐门' };

  return (
    <div className="route-select-overlay">
      <div className="route-select-wrap">
        <h1 className="serif">择 路</h1>
        <p className="lede">初窥门径之后，你要走哪条路？</p>
        <p className="lede-sub">选择即获得路线赠予；日后可换路线——已投入阅历全额返还，仅收 200 银两盘缠</p>
        <div className="route-cards">
          <RouteCard id="huashan" picked={picked} onPick={setPicked}
            name="华山 · 剑" style_="快剑爆发 · 短战最强，看脸不稳"
            items={[<>暴击率 <b>+10pp</b>，暴击伤害 <b>+20pp</b></>, <><b>开战首击必定暴击</b>（并积 1 层剑意）</>, <>每次暴击积 <b>1 层剑意</b>；满 5 层自动施展<b>爆发剑招</b></>]}
            cost="短板：面对高闪敌人命中不稳" />
          <RouteCard id="shaolin" picked={picked} onPick={setPicked}
            name="少林 · 金钟" style_="铁壁反伤 · 打不死你，磨死对手"
            items={[<>开战自动获得 <b>30% 气血护盾</b></>, <>受击自动反伤 <b>25%</b></>, <>防御 <b>+20%</b></>]}
            cost="短板：金钟不防毒，输出最慢" />
          <RouteCard id="tangmen" picked={picked} onPick={setPicked}
            name="唐门 · 毒" style_="叠毒后期 · 越拖越强，开局最软"
            items={[<>开战自动<b>施毒 1 层</b>，命中 <b>+1 层</b>（上限 8）</>, <>毒伤系数 <b>12%</b>，无视防御、绕过护盾</>, <>满层触发<b>毒爆 50%</b></>]}
            cost="代价：普攻伤害 ×0.60，短战偏慢" />
        </div>
        <div className="route-confirm">
          <button className="btn pulse" onClick={() => selectRoute(picked)}>
            踏上{NAME[picked]}之路
          </button>
        </div>
      </div>
    </div>
  );
}

function RouteCard(props: {
  id: RouteId;
  picked: RouteId;
  onPick: (r: RouteId) => void;
  name: string;
  style_: string;
  items: React.ReactNode[];
  cost: string;
}) {
  const cls = { huashan: 'hs', shaolin: 'sl', tangmen: 'tm' }[props.id];
  return (
    <div
      className={`route-card ${cls}${props.picked === props.id ? ' selected' : ''}`}
      onClick={() => props.onPick(props.id)}
    >
      <div className="rc-name serif">{props.name}</div>
      <div className="rc-style">{props.style_}</div>
      <div className="rc-grant">选择即得</div>
      <ul>{props.items.map((it, i) => <li key={i}>{it}</li>)}</ul>
      <div className="rc-cost">{props.cost}</div>
    </div>
  );
}
