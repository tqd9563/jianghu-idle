/**
 * 武功页 · 内功书页（磁青书两页）—— docs/design/gongfa-prototype.html。
 * 左页：竖写书名、品质 / 路数章、第几重与最高可至、「主修」朱印；内功提供的基础属性（气血 / 攻击 / 防御 / 命中 / 闪避）；
 *       主修那本底部「精进一重」（临关、缺卷册、内力不足时置灰，缘由写在按钮上方），其它的写转修 / 散功重修。
 * 右页：心法要诀，每条一行：名目 + 当前生效值，右侧挂会改它的关名（改了什么只放悬停）。
 * 非主修那本按转修后的样子显示：同路重数减 3、跨路从 0 重起，已过之关须重新顿悟（engine zhongAfterSwitch）。
 * 数值出自 sect-neigong/spec.md §1；要诀一律显示当前生效值（battle-copy §3.2）。
 */
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { assertNever } from '../../engine/exhaustive';
import type { Build } from '../../engine/combat';
import { REALMS, zhaoshiLevel, type RouteId } from '../../engine/content';
import {
  DUNWU_INTERVAL_SEC, NEIGONG, QI_COEF, TIERS, TIER_COUNT, dunwuChance, foldRealms, neigongBuild, qiMax,
  switchFee, zhongAfterSwitch, zhongCost, type NeigongId, type Quality,
} from '../../engine/neigong';
import { ROUTES } from '../../engine/routes';
import { SECTS } from '../../engine/sect';
import { effIdleRate, playerBuild, useGameStore, zhongGate } from '../../store/gameStore';
import { fmtBig } from '../../fmt';
import { Q_NO, ROUTE_TAG } from './shared';

const pct = (v: number) => `${Math.round(v * 100)}%`;
const pp = (v: number) => `${Math.round(v * 1000) / 10}pp`;

/** 关口对某部心法的状态：done 已过 / wait 到了重数等顿悟 / next 下一关 / later 更后 / na 本品质够不着 */
type TierState = 'done' | 'wait' | 'next' | 'later' | 'na';
function tierState(i: number, q: Quality, zhong: number, passed: number): TierState {
  if (i >= TIER_COUNT[q]) return 'na';
  if (i < passed) return 'done';
  if (i === passed) return zhong >= TIERS[i].at ? 'wait' : 'next';
  return 'later';
}

/** 数字上涨时从旧值一格格跳到新值（约 0.9 秒）；减少动态效果时直接换 */
function RollNum({ v, tip }: { v: number; tip: string }) {
  const [shown, setShown] = useState(v);
  const [up, setUp] = useState(false);
  const prev = useRef(v);
  useEffect(() => {
    const from = prev.current;
    prev.current = v;
    if (v <= from || matchMedia('(prefers-reduced-motion: reduce)').matches) { setShown(v); return; }
    const steps = Math.min(v - from, 18);
    const timers = Array.from({ length: steps }, (_, i) => setTimeout(() => setShown(Math.round(from + ((v - from) * (i + 1)) / steps)), (900 / steps) * (i + 1)));
    setUp(true);
    timers.push(setTimeout(() => setUp(false), 1300));
    return () => timers.forEach(clearTimeout);
  }, [v]);
  if (!v) return <b className="nil">—</b>;
  return <b className={up ? 'up' : undefined} data-tip={tip}>+{fmtBig(shown)}</b>;
}

export function NeigongBook({ id }: { id: NeigongId }) {
  const s = useGameStore();
  const d = NEIGONG[id];
  const main = id === s.neigong;
  const zhong = main ? s.zhong : zhongAfterSwitch(s.neigong!, id, s.zhong);
  const passed = main ? s.tiersPassed : 0;
  const peak = TIERS[TIER_COUNT[d.quality] - 1];
  const tag = ROUTE_TAG[d.route];
  const [switchTo, setSwitchTo] = useState<NeigongId | null>(null);

  // 内功提供的基础属性 = 此内功此重数下的构筑 − 境界底数（engine neigongBuild）
  const base = REALMS[s.realm - 1];
  const nb = neigongBuild(id, s.realm, zhong, passed);
  const M = Math.pow(1.7, foldRealms(zhong, d.quality));
  const L = zhaoshiLevel(zhong);
  const g = ROUTES[d.route].grant, per = ROUTES[d.route].perLevel;
  const routeTip = (x: number) => `火候 ×${M.toFixed(2)}${x ? ` · ${ROUTES[d.route].name}一路 +${pct(x)}` : ''}`;
  const attrs: [string, number, string][] = [
    ['气血', Math.round(nb.hp - base.hp), routeTip((per.hpPct ?? 0) * L)],
    ['攻击', Math.round(nb.atk - base.atk), routeTip((per.atkPct ?? 0) * L)],
    ['防御', Math.round(nb.def - base.def), routeTip((g.defPct ?? 0) + (per.defPct ?? 0) * L)],
    ['命中', Math.round(nb.hit - base.accuracy), '火候折合境界 × 12'],
    ['闪避', Math.round(nb.dodge - base.evasion), '火候折合境界 × 3'],
  ];

  let act: ReactNode;
  if (main) {
    const gate = zhongGate(s);
    const cost = zhongCost(s.zhong + 1);
    const short = cost - s.dantian;
    if (gate) {
      const p = dunwuChance(gate.tier, s.wuxing ?? 1);
      const hours = DUNWU_INTERVAL_SEC / p / 3600;
      const expect = hours < 1 ? `${Math.round(hours * 60)} 分钟` : `${hours.toFixed(1)} 小时`;
      act = gate.needScroll ? (
        <>
          <div className="wg-need">临「{gate.tier.name}」之关 · 须得《归真卷册》（{SECTS[d.route].name}贡献商店）</div>
          <button className="wg-btn" disabled>静候顿悟</button>
        </>
      ) : (
        <>
          <div className="wg-need">临「{gate.tier.name}」之关</div>
          <button className="wg-btn" disabled data-tip={`挂机修炼每 10 分钟一判，此刻概率 ${(p * 100).toFixed(1)}%，期望约 ${expect}；闭关照判。内力照常积累`}>静候顿悟</button>
        </>
      );
    } else if (short > 0) {
      const sec = short / Math.max(effIdleRate(s), 1e-9);
      const eta = sec < 3600 ? `约 ${Math.max(1, Math.ceil(sec / 60))} 分钟` : `约 ${(sec / 3600).toFixed(1)} 小时`;
      act = (
        <>
          <div className="wg-need">还差 {fmtBig(short)} 内力 · {eta}</div>
          <button className="wg-btn" disabled>精进一重　{fmtBig(cost)} 内力</button>
        </>
      );
    } else {
      act = (
        <>
          <div className="wg-need" />
          <button className="wg-btn" onClick={s.upgradeZhong} data-tip="价格每重 ×1.08；重数只在这一世有效，转世即散">精进一重　{fmtBig(cost)} 内力</button>
        </>
      );
    }
  } else {
    const same = d.route === NEIGONG[s.neigong!].route;
    act = (
      <>
        <div className="wg-need" />
        {same
          ? <button className="wg-btn" onClick={() => setSwitchTo(id)}>转修 · 保留八成功力</button>
          : <button className="wg-btn quiet" onClick={() => setSwitchTo(id)}>散功重修</button>}
      </>
    );
  }

  const build = main ? playerBuild(s) : nb;
  return (
    <>
      <div className="wg-pg l">
        <div className="wg-ttl">
          <span className="nm">{d.name}</span>
          <div className="side">
            <span className={`ptag q${Q_NO[d.quality]}`}>{d.quality}</span>
            <span className={`ptag rt t-${tag}`}>{ROUTES[d.route].name}</span>
            <div className="wg-zline" data-tip={`火候折合 ${foldRealms(zhong, d.quality).toFixed(2)} 个境界：每 20 重折合一个境界`}>第 {zhong}<small>重</small></div>
            <span className="wg-zcap">最高至{peak.name} · {peak.at} 重</span>
          </div>
        </div>
        {main && <span className="wg-zhu">主修</span>}
        <div className="wg-rows">
          {attrs.map(([k, v, tip]) => <span key={k}>{k}<RollNum v={v} tip={tip} /></span>)}
        </div>
        {act}
      </div>

      <div className="wg-pg r">
        <div className="wg-yjh">心法要诀</div>
        <Yaojue route={d.route} q={d.quality} zhong={zhong} passed={passed} build={build} realm={s.realm} />
        <div className="wg-foot">{d.quality}内功</div>
      </div>

      {switchTo && <SwitchDialog to={switchTo} onClose={() => setSwitchTo(null)} />}
    </>
  );
}

/** 一条要诀：名目、当前值、会改它的关（序号）；未得的一条压暗 */
interface Row { lb: string; v: ReactNode; tiers: number[]; lock?: boolean }

function rowsOf(route: RouteId, q: Quality, zhong: number, passed: number, build: Build, realm: number): Row[] {
  const g = ROUTES[route].grant;
  const p = ROUTES[route].perLevel;
  const L = zhaoshiLevel(zhong);
  const qi: Row = { lb: '气海', v: <>×<b>{QI_COEF[q].toFixed(1)}</b> · 真气上限 <b>{qiMax(realm, zhong, q)}</b></>, tiers: [] };
  switch (route) {
    case 'tangmen':
      return [
        { lb: '施毒', v: <>开战施毒 <b>{build.poison.init}</b> 层，每次命中 <b>+{build.poison.perHit}</b> 层</>, tiers: [0] },
        { lb: '毒伤', v: <>攻击 × <b>{Math.round(build.poison.coef * 1000) / 10}%</b> × 层数，<b>无视防御</b></>, tiers: [3, 4] },
        { lb: '毒层', v: <>上限 <b>{build.poison.cap}</b> 层</>, tiers: [1] },
        { lb: '毒爆', v: <>满层引爆 <b>{pct(build.poison.burst)}</b></>, tiers: [2] },
        { lb: '代价', v: <>普攻伤害 <b>×{build.plainMult.toFixed(2)}</b></>, tiers: [] },
        qi,
      ];
    case 'huashan':
      return [
        { lb: '会心', v: <>会心率 <b>+{pp(g.critRatePP! + (p.critRatePP ?? 0) * L)}</b>，会心伤害 <b>+{pp(g.critDmgPP! + (p.critDmgPP ?? 0) * L + (passed >= 5 ? 0.2 : 0))}</b></>, tiers: [4] },
        { lb: '先手', v: <>开战首击<b>必定会心</b></>, tiers: [] },
        { lb: '叠浪', v: <>每次会心叠 1 重，叠满 <b>{build.sqNeed}</b> 重</>, tiers: [0, 2] },
        { lb: '排山倒海', v: <>叠满时施展 <b>{Math.round(build.burstMult * 100)}%</b></>, tiers: [1, 3] },
        qi,
      ];
    case 'shaolin':
      return [
        { lb: '护盾', v: <>开战得 <b>{pct(build.shieldPct)}</b> 气血护盾</>, tiers: [0, 4] },
        { lb: '反伤', v: <>受击反伤 <b>{pct(build.thorns)}</b></>, tiers: [1, 3] },
        { lb: '防御', v: <>防御 <b>+{pct((g.defPct ?? 0) + (p.defPct ?? 0) * L)}</b></>, tiers: [] },
        { lb: '濒危', v: <>气血低于 30% 时受伤 <b>−30%</b></>, tiers: [2], lock: build.lowhpDr <= 0 },
        qi,
      ];
    default:
      return assertNever(route, 'rowsOf 未处理的路数');
  }
}

/** 心法要诀：悬停关名时，同一关影响的几条一起亮 */
function Yaojue({ route, q, zhong, passed, build, realm }: { route: RouteId; q: Quality; zhong: number; passed: number; build: Build; realm: number }) {
  const [hl, setHl] = useState<number | null>(null);
  return (
    <>
      {rowsOf(route, q, zhong, passed, build, realm).map((r) => (
        <div key={r.lb} className={`wg-yj${r.lock ? ' lock' : ''}${hl !== null && r.tiers.includes(hl) ? ' hl' : ''}`}>
          <div className="h">
            <span className="lb">{r.lb}</span>
            <span className="chips">
              {r.tiers.map((i) => {
                const t = TIERS[i];
                const st = tierState(i, q, zhong, passed);
                const note = st === 'na' ? ` · ${i === 3 ? '上乘' : '绝学'}内功可达` : st === 'done' ? ' · 已得' : st === 'wait' ? ' · 静候顿悟' : '';
                return (
                  <span key={i} className={`wg-ch ${st}${hl === i ? ' hl' : ''}`} data-tip={`${t.name}（第 ${t.at} 重）：${t.effect[route]}${note}`}
                    onMouseEnter={() => setHl(i)} onMouseLeave={() => setHl(null)}>{t.name}</span>
                );
              })}
            </span>
          </div>
          <div className="v">{r.v}</div>
        </div>
      ))}
    </>
  );
}

function SwitchDialog({ to, onClose }: { to: NeigongId; onClose: () => void }) {
  const s = useGameStore();
  const from = NEIGONG[s.neigong!];
  const target = NEIGONG[to];
  const same = from.route === target.route;
  const zhongTo = zhongAfterSwitch(from.id, to, s.zhong);
  const fee = switchFee(s.realm);
  const canPay = s.silver >= fee;
  const title = `${same ? '转修' : '散功重修'} · ${target.name}`;
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    addEventListener('keydown', onKey);
    return () => removeEventListener('keydown', onKey);
  }, [onClose]);
  // 挂到 body：舞台有 isolation，留在里面盖不住侧栏
  return createPortal(
    <div className="gf-veil" onClick={onClose}>
      <div className="gf-dlg" role="dialog" aria-modal="true" aria-label={title} onClick={(e) => e.stopPropagation()}>
        <h2>{title}</h2>
        <div className="sub">
          {same
            ? `同为${ROUTES[from.route].name}一路，功力可带过去大半。`
            : `跨路数须散功：${ROUTES[from.route].name}之法散去，改修${ROUTES[target.route].name}，重数从头练起。`}
        </div>
        <div className="gf-kv"><span className="k">起始重数</span><span className={`v${same ? '' : ' loss'}`}>第 {s.zhong} 重 → 第 {zhongTo} 重</span></div>
        <div className="gf-kv"><span className="k">已过的关</span><span className="v loss">需重新顿悟</span></div>
        <div className="gf-kv"><span className="k">手续费</span><span className="v">{fmtBig(fee)} 银两{canPay ? '' : <small>银两不足，还差 {fmtBig(fee - s.silver)}</small>}</span></div>
        <p className="note">
          {same ? '保留八成累计内力，约少三重。' : ''}下一世开头换功不收费、不折算{same ? '。' : '；若只是想试试这一路，不如等到那时。'}
        </p>
        <div className="acts">
          <button className="jh-btn quiet" onClick={onClose}>再想想</button>
          <button className="jh-btn" disabled={!canPay} onClick={() => { s.switchNeigong(to); onClose(); }}>
            {same ? '转修' : '散功重修'}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
