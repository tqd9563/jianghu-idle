/** 修炼页 —— 原型场景 1/3 修炼页签的 1:1 实现（资产负债表：权威源） */
import { computeAttributes } from '../engine/attributes';
import { REALMS } from '../engine/content';
import { CHARGE_SEGMENTS, zhoutianProgress } from '../engine/formulas';
import { ROUTES } from '../engine/routes';
import { effBreakCost, effIdleRate, retireKind, useGameStore } from '../store/gameStore';
import {
  REALM_ACUPOINTS, totalAcupointBonus, isMeridianComplete,
} from '../engine/acupoints';
import { AcupointPanel } from './AcupointPanel';

const fmt = (n: number) => Math.floor(n).toLocaleString('en-US');
const CN = ['零', '一', '二', '三', '四', '五', '六', '七', '八', '九'];
const pct = (v: number) => `${Math.round(v * 100)}%`;

export function CultivatePane() {
  const s = useGameStore();
  const nextRealm = s.realm < REALMS.length ? REALMS[s.realm] : null;
  const breakCost = effBreakCost(s);
  const rate = effIdleRate(s);
  // 窍穴/贯通加成（spec §9：加法合并进临时乘区）
  const acupointData = REALM_ACUPOINTS[s.realm];
  const openedIds = new Set(
    Object.entries(s.acupointProgress ?? {})
      .filter(([, a]) => a.opened)
      .map(([id]) => id)
  );
  const openedCount = openedIds.size;
  const meridianCount = acupointData
    ? acupointData.meridians.filter(m => isMeridianComplete(m, openedIds)).length
    : 0;
  const acupointPct = totalAcupointBonus(s.realm, openedCount, meridianCount);
  const attrs = computeAttributes(s.realm, s.route, s.skillLevel, 0, acupointPct);
  const nextAttrs = nextRealm ? computeAttributes(s.realm + 1, s.route, s.skillLevel, 0, acupointPct) : null;
  const routeDef = s.route ? ROUTES[s.route] : null;

  return (
    <div className="pane-wrap">
      <section className="panel">
        {nextRealm ? (
          <>
            <div className="panel-head">
              运转周天 <span className="sub">境界 {s.realm} → {s.realm + 1} · {nextRealm.name}</span>
            </div>
            <div className="panel-body">
              <ChargeTrack
                dantian={s.dantian}
                cost={breakCost!}
                discounted={breakCost! < nextRealm.breakthroughCost!}
                segments={REALMS[s.realm - 1].zhoutianCount ?? CHARGE_SEGMENTS}
                chargeHighWater={s.chargeHighWater}
              />
              <BreakthroughButton />
              <div className="cap-note">
                内力自归丹田，第五周天圆满后需手动点击「突破」完成晋升；动用内力升级武学时，周天进度如实回落（气机回落）
              </div>
            </div>
          </>
        ) : (
          <>
            <div className="panel-head">运转周天 <span className="sub">境界圆满</span></div>
            <div className="panel-body">
              {retireKind(s) !== null ? (
                <>
                  <button className={retireKind(s) === 'standard' ? 'btn pulse' : 'btn'} onClick={s.openRetire}>
                    挂剑归隐
                    <span className="btn-sub">
                      {retireKind(s) === 'standard' ? '本轮圆满 · 声望全额' : '未竟之轮 · 声望六成'}
                    </span>
                  </button>
                  {retireKind(s) === 'fallback' && (
                    <div className="cap-note">
                      黑风寨主仍未被击败。现在归隐，声望按六成结算；击败黑风寨主可获得全额声望。
                    </div>
                  )}
                </>
              ) : (
                <p className="cap-note" style={{ margin: 0 }}>
                  一流高手已是本轮武学之极——击败黑风寨主可获得全额声望
                </p>
              )}
            </div>
          </>
        )}
      </section>

      <AcupointPanel />

      <section className="panel">
        <div className="panel-head">人物属性 <span className="sub">当前{nextRealm ? ' → 突破后' : ''}</span></div>
        <div className="panel-body attr-table">
          <div className="attr-head">
            <span>属性（共 7 项）</span>
            <span>当前</span>
            {nextRealm && <span>{nextRealm.name}</span>}
          </div>
          <AttrRow name="气血" cur={String(attrs.hp)} next={nextAttrs ? String(nextAttrs.hp) : null} />
          <AttrRow name="攻击" cur={String(attrs.atk)} next={nextAttrs ? String(nextAttrs.atk) : null} />
          {(attrs.zones.atkTempPct > 0 || attrs.basicAtkMult !== 1) && (
            <div className="attr-sub">
              {attrs.zones.atkTempPct > 0 && (
                <>基础 {attrs.zones.atkBase} × 本轮 +{pct(attrs.zones.atkTempPct)}（{routeDef!.skillName} Lv{s.skillLevel}）</>
              )}
              {attrs.basicAtkMult !== 1 && <>{attrs.zones.atkTempPct > 0 && ' · '}普攻系数 ×{attrs.basicAtkMult.toFixed(2)}（轻手暗器）</>}
            </div>
          )}
          <AttrRow name="防御" cur={String(attrs.def)} next={nextAttrs ? String(nextAttrs.def) : null} />
          {attrs.zones.defTempPct > 0 && (
            <div className="attr-sub">基础 {REALMS[s.realm - 1].def} × 本轮 +{pct(attrs.zones.defTempPct)}（路线赠予{s.skillLevel > 0 ? ` + ${routeDef!.skillName}` : ''}）</div>
          )}
          <AttrRow name="命中" cur={String(attrs.accuracy)} next={nextAttrs ? String(nextAttrs.accuracy) : null} />
          <AttrRow name="闪避" cur={String(attrs.evasion)} next={nextAttrs ? String(nextAttrs.evasion) : null} />
          <AttrRow name="暴击率" cur={pct(attrs.critRate)} next={nextAttrs ? pct(nextAttrs.critRate) : null} />
          <AttrRow name="暴击伤害" cur={pct(attrs.critDmg)} next={nextAttrs ? pct(nextAttrs.critDmg) : null} />
          <div className="attr-note">
            {nextRealm && (
              <>突破另得：挂机产出 {rate.toFixed(1)} → {effIdleRate({ realm: s.realm + 1, ownedRepNodes: s.ownedRepNodes }).toFixed(1)} / 秒 · 武学上限 {REALMS[s.realm - 1].skillCap} → {nextRealm.skillCap}
                {s.realm === 1 && ' · 解锁三大路线'}
              </>
            )}
            {s.route && (
              <><br />路线机制参数（{routeDef!.name.slice(0, 2)}）见武学页</>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}

function AttrRow({ name, cur, next }: { name: string; cur: string; next: string | null }) {
  return (
    <div className="attr-row">
      <span className="aname">{name}</span>
      <span className="cur">{cur}</span>
      {next !== null && <span className="next">{next}</span>}
    </div>
  );
}

function ChargeTrack({
  dantian, cost, discounted, segments, chargeHighWater,
}: {
  dantian: number; cost: number; discounted: boolean;
  segments: number; chargeHighWater: number;
}) {
  const N = segments;
  const p = zhoutianProgress(dantian, cost, N);
  return (
    <>
      <div className="kv">
        <span className="k">总消耗</span>
        <span className="v">
          {fmt(cost)} 内力（每周天 {fmt(cost / N)} × {N}）
          {discounted && <span className="perm"> · 快速入门 −30%</span>}
        </span>
      </div>
      <div className="charge-track" aria-label={`周天进度 ${p.segmentsFull} / ${N}`}>
        {Array.from({ length: N }, (_, i) => {
          // 已圆满的周天显示常亮珠点（印记呈现，锁定点 2：新高水位）
          const isPearl = i < chargeHighWater;
          if (i < p.segmentsFull)
            return <div key={i} className={`charge-seg full${isPearl ? ' pearl' : ''}`} />;
          if (i === p.segmentsFull && p.currentSegmentPct > 0)
            return (
              <div key={i} className="charge-seg part">
                <i style={{ width: `${p.currentSegmentPct * 100}%` }} />
              </div>
            );
          return <div key={i} className="charge-seg" />;
        })}
      </div>
      <div className="charge-label">
        <span>丹田内力 {fmt(Math.min(dantian, cost))} / {fmt(cost)}</span>
        {p.ready ? (
          <span className="gold">{CN[N]}周天圆满</span>
        ) : (
          <span>第{CN[p.segmentsFull + 1]}周天 {Math.floor(p.currentSegmentPct * 100)}%</span>
        )}
      </div>
    </>
  );
}

function BreakthroughButton() {
  const s = useGameStore();
  const nextRealm = REALMS[s.realm];
  const cost = effBreakCost(s);
  const dantianReady = cost !== null && s.dantian >= cost;
  // 双条件校验（spec §6）：丹田充满 且 已通窍穴数 ≥ M
  const requiredAcupoints = REALMS[s.realm - 1].requiredAcupoints;
  const openedCount = Object.values(s.acupointProgress ?? {}).filter(a => a.opened).length;
  const acupointReady = requiredAcupoints === null || openedCount >= requiredAcupoints;
  const ready = dantianReady && acupointReady;
  const label = ready
    ? `突破 · ${nextRealm.name}`
    : dantianReady && !acupointReady
      ? `窍穴未通齐（${openedCount}/${requiredAcupoints}）`
      : '运转周天中…';
  return (
    <button className={ready ? 'btn pulse' : 'btn'} disabled={!ready} onClick={s.breakthrough}>
      {label}
    </button>
  );
}
