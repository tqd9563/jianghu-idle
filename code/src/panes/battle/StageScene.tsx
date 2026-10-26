/**
 * 据点场景：关卡点落在画里的路上（DESIGN.md「据点战斗页」；原型 `#scene` renderNodes / renderTrail）。
 * 没有场景图的据点退回一条墨线小路。
 */
import { cnNum, sceneOf } from './art';

export interface StageNode {
  stage: number;
  done: boolean;
  /** 守关岗位：副手 / 镇守 / 门主；普通关为 null */
  role: 'aide' | 'warden' | 'boss' | null;
  /** 守关人头像 */
  pt?: string;
  tip: string;
}

const SEAL_CH = { aide: '副', warden: '守', boss: '主' } as const;
/** 眼前几关画出人影，再远的只剩路上小点 */
const AHEAD = 5;

/** Catmull-Rom 平滑穿过各关的落脚点（viewBox 0–100 × 0–56.25） */
function curve(ps: readonly (readonly [number, number])[]): string {
  const Y = (q: number) => q * 0.5625;
  return ps.map((p, i) => {
    if (!i) return `M${p[0]} ${Y(p[1])}`;
    const a = ps[i - 2] ?? ps[i - 1], b = ps[i - 1], c = p, d = ps[i + 1] ?? p;
    return `C ${b[0] + (c[0] - a[0]) / 6} ${Y(b[1] + (c[1] - a[1]) / 6)}, ${c[0] - (d[0] - b[0]) / 6} ${Y(c[1] - (d[1] - b[1]) / 6)}, ${c[0]} ${Y(c[1])}`;
  }).join(' ');
}

export function StageScene({ map, nodes, next, selected, fighting, onSelect, children }: {
  map: number;
  nodes: StageNode[];
  next: number | null;
  selected: number;
  fighting: boolean;
  onSelect: (stage: number) => void;
  /** 叠在左上暗处的标题、归属与进度 */
  children: React.ReactNode;
}) {
  const total = nodes.length;
  const scene = sceneOf(map, total);
  const can = (n: StageNode) => !fighting && (n.done || n.stage === next);
  const cls = (n: StageNode, base: string) =>
    [base, n.done && 'done', n.stage === next && 'cur', n.stage === selected && 'sel', n.role === 'boss' && 'boss'].filter(Boolean).join(' ');

  if (!scene) {
    // 墨线小路：走过的实线、没走的虚线
    const Yp = (x: number) => 64 + 26 * Math.sin(x * Math.PI * 2.2 + 0.6) - 10 * x;
    const N = 120;
    const pts = Array.from({ length: N + 1 }, (_, i) => [i / N, Yp(i / N)] as const);
    const pos = (n: number) => ((n - 0.5) / total) * 0.94 + 0.03;
    const d = (upto: number) => pts.filter(([x]) => x <= upto).map(([x, y], i) => `${i ? 'L' : 'M'}${x * 1000} ${y}`).join(' ');
    const doneX = nodes.some((n) => n.done) ? pos(Math.min(next ?? total, total)) : 0;
    return (
      <div className="bt-scene flat">
        <div className="sc-head">{children}</div>
        <div className="trail">
          <svg viewBox="0 0 1000 128" preserveAspectRatio="none" aria-hidden="true">
            <path className="todo" d={d(1)} /><path className="walk" d={d(doneX)} />
          </svg>
          {nodes.map((n) => {
            const x = pos(n.stage);
            return (
              <button
                key={n.stage} type="button" className={cls(n, 'st')}
                style={{ left: `${x * 100}%`, top: `${(Yp(x) / 128) * 100}%` }}
                data-tip={n.tip} disabled={!can(n)} onClick={() => onSelect(n.stage)}
              >
                {n.role ? <span className={`seal ${n.role}${n.done ? ' got' : ''}`}>{SEAL_CH[n.role]}</span> : <i />}
              </button>
            );
          })}
          {next !== null && (
            <span className="lab" style={{ left: `${pos(next) * 100}%`, top: `${((Yp(pos(next)) + 16) / 128) * 100}%` }}>第{cnNum(next)}关</span>
          )}
        </div>
      </div>
    );
  }

  const far: number[] = [];
  const items = nodes.map((n) => {
    const [x, y] = scene.pts[n.stage - 1];
    const near = next !== null && n.stage >= next && n.stage < next + AHEAD;
    const s = (0.62 + (0.38 * y) / 100).toFixed(2);
    let inner: React.ReactNode;
    if (n.role) {
      inner = <><span className="md" style={{ ['--pt' as string]: `url('${n.pt}')` }}><span className="tg">{SEAL_CH[n.role]}</span></span><span className="bs" /><span className="lb">第{cnNum(n.stage)}关</span></>;
    } else if (n.done) {
      inner = <><span className="ck">✓</span><span className="lb">第{cnNum(n.stage)}关</span></>;
    } else if (near) {
      inner = <><span className="gd" /><span className="bs" /><span className="lb">第{cnNum(n.stage)}关</span></>;
    } else {
      inner = <span className="fd" />;
      far.push(n.stage);
    }
    return (
      <button
        key={n.stage} type="button" className={cls(n, 'nd')}
        style={{ left: `${x}%`, top: `${y}%`, ['--s' as string]: s }}
        data-tip={n.tip} disabled={!can(n)} onClick={() => onSelect(n.stage)}
      >{inner}</button>
    );
  });
  // 远处一段未到的关，收成一组标签
  const runs: number[][] = [];
  for (const n of far) {
    const r = runs[runs.length - 1];
    if (r && r[r.length - 1] === n - 1) r.push(n); else runs.push([n]);
  }
  const walkTo = next ?? total;
  return (
    <div className={`bt-scene${scene.headRight ? ' head-right' : ''}`} style={{ ['--scene-art' as string]: `url('${scene.art}')` }}>
      <div className="sc-head">{children}</div>
      <div className="nodes">
        <svg viewBox="0 0 100 56.25" preserveAspectRatio="none" aria-hidden="true">
          <path className="todo" d={curve(scene.pts)} />
          {walkTo > 1 && <path className="walk" d={curve(scene.pts.slice(0, walkTo))} />}
        </svg>
        {items}
        {runs.filter((r) => r.length > 1).map((r) => {
          const [x, y] = scene.pts[r[0] - 1];
          return <span key={r[0]} className="grp" style={{ left: `${x}%`, top: `${y + 2.5}%` }}>第{cnNum(r[0])}至{cnNum(r[r.length - 1])}关</span>;
        })}
      </div>
    </div>
  );
}
