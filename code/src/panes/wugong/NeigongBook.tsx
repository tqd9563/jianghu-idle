/**
 * 武功页 · 内功详情（题跋右侧）—— docs/design/bag-wugong-prototype.html。旧版磁青书页见 gongfa-prototype.html。
 * 重数行 → 心法要诀（每条名目 + 当前生效值）→ 五项属性条（以练到最高重为满格）→ 右下精进一重 / 转修 / 散功重修（不能做时缘由写在按钮左侧）。
 * 非主修那本按转修后的样子显示：同路重数减 3、跨路从 0 重起，已过之关须重新顿悟（engine zhongAfterSwitch）。
 * 数值出自 sect-neigong/spec.md §1；要诀一律显示当前生效值（battle-copy §3.2）。
 */
import { useEffect, useState, type ReactNode } from 'react';
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

const pct = (v: number) => `${Math.round(v * 100)}%`;
const pp = (v: number) => `${Math.round(v * 1000) / 10}pp`;


export function NeigongBook({ id }: { id: NeigongId }) {
  const s = useGameStore();
  const d = NEIGONG[id];
  const main = id === s.neigong;
  const zhong = main ? s.zhong : zhongAfterSwitch(s.neigong!, id, s.zhong);
  const passed = main ? s.tiersPassed : 0;
  const peak = TIERS[TIER_COUNT[d.quality] - 1];
  const [switchTo, setSwitchTo] = useState<NeigongId | null>(null);

  // 内功提供的基础属性 = 此内功此重数下的构筑 − 境界底数（engine neigongBuild）；属性条以此内功练到最高重的值为满格
  const base = REALMS[s.realm - 1];
  const nb = neigongBuild(id, s.realm, zhong, passed);
  const nbPeak = neigongBuild(id, s.realm, peak.at, TIER_COUNT[d.quality]);
  const M = Math.pow(1.7, foldRealms(zhong, d.quality));
  const L = zhaoshiLevel(zhong);
  const g = ROUTES[d.route].grant, per = ROUTES[d.route].perLevel;
  const routeTip = (x: number) => `火候 ×${M.toFixed(2)}${x ? ` · ${ROUTES[d.route].name}一路 +${pct(x)}` : ''}`;
  const attrs: [string, number, number, string][] = [
    ['气血', nb.hp - base.hp, nbPeak.hp - base.hp, routeTip((per.hpPct ?? 0) * L)],
    ['攻击', nb.atk - base.atk, nbPeak.atk - base.atk, routeTip((per.atkPct ?? 0) * L)],
    ['防御', nb.def - base.def, nbPeak.def - base.def, routeTip((g.defPct ?? 0) + (per.defPct ?? 0) * L)],
    ['命中', nb.hit - base.accuracy, nbPeak.hit - base.accuracy, '火候折合境界 × 12'],
    ['闪避', nb.dodge - base.evasion, nbPeak.dodge - base.evasion, '火候折合境界 × 3'],
  ];

  let need: ReactNode = null, btn: ReactNode;
  if (main) {
    const gate = zhongGate(s);
    const cost = zhongCost(s.zhong + 1);
    const short = cost - s.dantian;
    if (gate) {
      const p = dunwuChance(gate.tier, s.wuxing ?? 1);
      const hours = DUNWU_INTERVAL_SEC / p / 3600;
      const expect = hours < 1 ? `${Math.round(hours * 60)} 分钟` : `${hours.toFixed(1)} 小时`;
      need = gate.needScroll ? `临「${gate.tier.name}」之关 · 须得《归真卷册》（${SECTS[d.sect].name}贡献商店）` : `临「${gate.tier.name}」之关`;
      btn = <button type="button" disabled data-tip={gate.needScroll ? undefined : `挂机修炼每 10 分钟一判，此刻概率 ${(p * 100).toFixed(1)}%，期望约 ${expect}；闭关照判。内力照常积累`}>静候顿悟</button>;
    } else if (short > 0) {
      const sec = short / Math.max(effIdleRate(s), 1e-9);
      need = `还差 ${fmtBig(short)} 内力 · ${sec < 3600 ? `约 ${Math.max(1, Math.ceil(sec / 60))} 分钟` : `约 ${(sec / 3600).toFixed(1)} 小时`}`;
      btn = <button type="button" disabled>精进一重　{fmtBig(cost)}</button>;
    } else {
      btn = <button type="button" onClick={s.upgradeZhong} data-tip="价格每重 ×1.08；重数只在这一世有效，转世即散">精进一重　{fmtBig(cost)}</button>;
    }
  } else {
    const same = d.route === NEIGONG[s.neigong!].route;
    btn = same
      ? <button type="button" onClick={() => setSwitchTo(id)}>转修</button>
      : <button type="button" className="quiet" onClick={() => setSwitchTo(id)}>散功重修</button>;
  }

  const build = main ? playerBuild(s) : nb;
  return (
    <>
      <div className="zh5" style={{ top: '33.5%' }} data-tip={`火候折合 ${foldRealms(zhong, d.quality).toFixed(2)} 个境界：每 20 重折合一个境界`}>
        第 <b>{zhong}</b> 重<span>{main ? '主修 · ' : '转修后 · '}最高至{peak.name} · {peak.at} 重</span>
      </div>
      <div className="wsec" style={{ top: '41%' }}>心法</div>
      <div className="attrs5" style={{ top: '45%', gap: 0 }}>
        {rowsOf(d.route, d.quality, zhong, passed, build, s.realm).map((r) => (
          <div key={r.lb} className={`yj${r.lock ? ' lock' : ''}`}>{r.lb}　{r.v}</div>
        ))}
      </div>
      <div className="wsec" style={{ top: '62%' }}>属性</div>
      <div className="attrs5" style={{ top: '66%', gap: 'calc(var(--pw) * .003)' }}>
        {attrs.map(([k, v, peakV, tip]) => (
          <div key={k} className="r" data-tip={tip}>
            <span className="k">{k}</span>
            <span className="bar"><i style={{ width: `${Math.min(100, (v / Math.max(1, peakV)) * 100)}%` }} /></span>
            <span className="v">{v > 0 ? `+${fmtBig(Math.round(v))}` : '—'}</span>
          </div>
        ))}
      </div>
      <div className="wact">{need && <span className="need">{need}</span>}{btn}</div>
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
    // 新四路（wudao-yuanliu/design.md §2）：门派改造前无来路，要诀先按构筑如实列出
    case 'taixu':
      return [
        { lb: '身法', v: <>闪避 <b>+{pct((g.dodgePct ?? 0) + (p.dodgePct ?? 0) * L)}</b></>, tiers: [4] },
        { lb: '借力', v: <>闪过一击后，下一次出手 <b>+{pct(build.jieli)}</b></>, tiers: [0, 3] },
        { lb: '反手', v: <>闪过即反手一击 <b>{pct(build.counter)}</b></>, tiers: [1], lock: build.counter <= 0 },
        { lb: '卸力', v: <>敌方攻击 <b>−{pct(build.xieli)}</b></>, tiers: [2] },
        qi,
      ];
    case 'xuanji':
      return [
        { lb: '寂印', v: <>每次命中积一印，积满 <b>{build.markNeed}</b> 印封穴</>, tiers: [0, 2] },
        { lb: '点穴', v: <>封穴时一击 <b>{pct(build.markDmg)}</b> 攻击，<b>无视防御</b></>, tiers: [1, 3] },
        qi,
      ];
    case 'jinghong':
      return [
        { lb: '追加', v: <>每次出手后 <b>{pct(build.comboRate)}</b> 几率追加一击，至多 <b>{build.comboChain}</b> 击</>, tiers: [0, 1, 4] },
        { lb: '倍率', v: <>追加一击 <b>{pct(build.comboMult)}</b></>, tiers: [2, 3] },
        { lb: '先手', v: <>开战首回合<b>必定追加</b></>, tiers: [] },
        qi,
      ];
    case 'fenxue':
      return [
        { lb: '焚血', v: <>每损一成气血，攻击 <b>+{pct(build.rage)}</b></>, tiers: [0, 3] },
        { lb: '饮血', v: <>伤害的 <b>{pct(build.leech)}</b> 回补气血</>, tiers: [2, 4] },
        { lb: '不灭', v: <>濒死保住 <b>{pct(build.undying)}</b> 气血，每战一次</>, tiers: [1], lock: build.undying <= 0 },
        qi,
      ];
    default:
      return assertNever(route, 'rowsOf 未处理的路数');
  }
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
            : `跨源流须散功：${ROUTES[from.route].name}之法散去，改修${ROUTES[target.route].name}，重数从头练起。`}
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
