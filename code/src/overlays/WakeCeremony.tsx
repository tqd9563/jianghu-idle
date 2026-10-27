/**
 * 转世醒来（活江湖第一期批四）：原型 docs/design/living-jianghu-prototype.html「转世醒来」。
 * 冷青整屏：题眼「江湖历 N 年 · 第几世」→ 新名 → 籍贯年岁 → 至多四行「此后江湖」，被前世击败过的人墨金标出。
 */
import { useMemo } from 'react';
import { cnNum, wakeLines, type ChronLine } from '../engine/chronicle';
import { useGameStore } from '../store/gameStore';

function Line({ l }: { l: ChronLine }) {
  if (!l.mark) return <p>{l.text}</p>;
  const i = l.text.indexOf(l.mark);
  return <p>{l.text.slice(0, i)}<span className="mine">{l.mark}</span>{l.text.slice(i + l.mark.length)}</p>;
}

export function WakeCeremony({ onDone }: { onDone: () => void }) {
  const seed = useGameStore((s) => s.worldSeed);
  const kills = useGameStore((s) => s.rosterKills);
  const lives = useGameStore((s) => s.lives);
  const cur = lives?.at(-1);
  const prev = lives && lives.length >= 2 ? lives[lives.length - 2] : undefined;
  const lines = useMemo(() => (cur && prev ? wakeLines(seed, kills ?? [], prev, cur.born) : []), [seed, kills, cur, prev]);
  if (!cur) return null;
  return (
    <div className="jh-ceremony wake" role="dialog" aria-label="转世醒来">
      <div>
        <div className="kick">江湖历 {cur.born} 年 · 第{cnNum(cur.run)}世</div>
        <h2>{cur.name}</h2>
        <div className="d">{cur.origin}人氏 · 年十八</div>
        {lines.length > 0 && <div className="since">{lines.map((l, i) => <Line key={i} l={l} />)}</div>}
        <div className="acts"><button type="button" className="jh-btn" style={{ minWidth: 240 }} onClick={onDone}>入江湖</button></div>
      </div>
    </div>
  );
}
