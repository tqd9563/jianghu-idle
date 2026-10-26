/**
 * 长卷对阵区（DESIGN.md「长卷对阵区」；原型 `.duel.band`）：通栏水墨底带，两端人物长卷像向中间化开，
 * 中段双方姓名、出身与刷痕气血 / 真气条，正中「VS」。受击人像一震，伤害数字飘在人像上方。
 */
import { useEffect, useRef, useState } from 'react';
import type { TurnEvent } from '../../engine/combat';
import { fmtBig } from '../../fmt';

export interface DuelSide {
  name: string;
  desc: React.ReactNode;
  hp: number;
  hpMax: number;
  qi?: number;
  qiMax?: number;
  /** 护体余量（少林），叠在气血条上 */
  shield?: number;
  /** 头像（圆形）与长卷像；缺长卷像时用头像去色 */
  pt: string;
  cap: string | null;
  boss?: boolean;
  ko?: boolean;
  /** 姓名下方的石印行等 */
  extra?: React.ReactNode;
}

/** 这一拍谁掉血：玩家出手与毒、反伤打在敌人身上，敌人出手与反震打在玩家身上 */
function hitOf(t: TurnEvent): 'me' | 'foe' | null {
  if (!t.dmg || t.dmg <= 0) return null;
  if (t.kind === 'thorns_to_player' || t.kind === 'enemy_poison_tick') return 'me';
  if (t.kind === 'thorns_to_enemy' || t.kind === 'poison_tick' || t.kind === 'poison_burst') return 'foe';
  return t.side === 'player' ? 'foe' : t.side === 'enemy' ? 'me' : null;
}

interface Pop { id: number; who: 'me' | 'foe'; text: string; cls: string; dx: number }

function Bar({ kind, cur, max, shield, mirror }: { kind: 'hp' | 'qi'; cur: number; max: number; shield?: number; mirror?: boolean }) {
  const pct = max > 0 ? Math.max(0, Math.min(1, cur / max)) * 100 : 0;
  return (
    <div className={`mt${kind === 'qi' ? ' qi' : ''}`}>
      <div className="ml">
        <span>{kind === 'hp' ? '气血' : '真气'}</span>
        <span>{shield ? <em className="shield-n">护体 {fmtBig(Math.round(shield))}　</em> : null}<b>{fmtBig(Math.round(Math.max(0, cur)))}</b> / <span>{fmtBig(Math.round(max))}</span></span>
      </div>
      <div className={`bb ${kind}${mirror ? ' mirror' : ''}`}>
        <i className="gh" style={{ transform: `scaleX(${pct / 100})` }} />
        <i className="v" style={{ transform: `scaleX(${pct / 100})` }} />
        {!!shield && <i className="sh" style={{ transform: `scaleX(${Math.min(1, shield / max)})` }} />}
      </div>
    </div>
  );
}

export function DuelBand({ me, foe, turns }: { me: DuelSide; foe: DuelSide; turns: TurnEvent[] }) {
  const [pops, setPops] = useState<Pop[]>([]);
  const [hit, setHit] = useState<{ me: number; foe: number }>({ me: 0, foe: 0 });
  const seen = useRef(turns.length);
  const seq = useRef(0);
  useEffect(() => {
    // 换场（回合从头开始）时只重置计数，不补飘字
    if (turns.length < seen.current) { seen.current = turns.length; return; }
    const fresh = turns.slice(seen.current);
    seen.current = turns.length;
    if (!fresh.length) return;
    const add: Pop[] = [];
    for (const t of fresh) {
      const who = hitOf(t);
      if (!who) continue;
      add.push({ id: ++seq.current, who, text: fmtBig(Math.round(t.dmg!)), cls: t.crit || t.kind === 'crit' || t.kind === 'burst' ? 'crit' : '', dx: Math.random() * 40 - 20 });
    }
    if (!add.length) return;
    setPops((p) => [...p, ...add]);
    setHit((h) => ({ me: h.me + Number(add.some((a) => a.who === 'me')), foe: h.foe + Number(add.some((a) => a.who === 'foe')) }));
    const ids = new Set(add.map((a) => a.id));
    setTimeout(() => setPops((p) => p.filter((x) => !ids.has(x.id))), 1200);
    // turns 每次渲染都是新切片，只按长度变化触发
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [turns.length]);

  const bust = (s: DuelSide, who: 'me' | 'foe') => (
    <div
      key={`${who}-${hit[who]}`}
      className={`bust ${who}${s.cap ? '' : ' pt'}${s.boss ? ' boss' : ''}${hit[who] ? ' hit' : ''}`}
      style={{ ['--cap' as string]: `url('${s.cap ?? s.pt}')` }}
    />
  );
  const side = (s: DuelSide, enemy: boolean) => {
    const m = s.name.match(/^(「.+」)(.+)$/);
    return (
      <div className={`side${enemy ? ' enemy' : ''}`}>
        <div className={`name${s.ko ? ' ko' : ''}`}>{m ? <><span className="hao">{m[1]}</span>{m[2]}</> : s.name}</div>
        <div className="desc">{s.desc}</div>
        <Bar kind="hp" cur={s.hp} max={s.hpMax} shield={s.shield} mirror={enemy} />
        {s.qiMax ? <Bar kind="qi" cur={s.qi ?? 0} max={s.qiMax} mirror={enemy} /> : null}
        {s.extra}
      </div>
    );
  };
  // 飘字层在底带之外：底带有毛边遮罩，飘字放进去会被裁掉
  return (
    <div className="bt-duel">
      <div className="bt-band">
        {bust(me, 'me')}
        {side(me, false)}
        <div className="vs">VS</div>
        {side(foe, true)}
        {bust(foe, 'foe')}
      </div>
      <div className="bt-pops" aria-hidden="true">
        {pops.map((p) => (
          <span key={p.id} className={`dmg ${p.cls}`} style={{ left: `calc(${p.who === 'me' ? 12 : 88}% + ${p.dx}px)` }}>{p.text}</span>
        ))}
      </div>
    </div>
  );
}
