/** 修炼页 —— 原型场景 1/3 修炼页签的 1:1 实现（资产负债表：权威源） */
import { computeAttributes } from '../engine/attributes';
import { REALMS } from '../engine/content';
import { CHARGE_SEGMENTS, idleNeiliPerSec, zhoutianProgress } from '../engine/formulas';
import { ROUTES } from '../engine/routes';
import { useGameStore } from '../store/gameStore';

const fmt = (n: number) => Math.floor(n).toLocaleString('en-US');
const CN = ['零', '一', '二', '三', '四', '五'];
const pct = (v: number) => `${Math.round(v * 100)}%`;

export function CultivatePane() {
  const s = useGameStore();
  const nextRealm = s.realm < REALMS.length ? REALMS[s.realm] : null;
  const rate = idleNeiliPerSec(s.realm);
  const attrs = computeAttributes(s.realm, s.route, s.skillLevel);
  const nextAttrs = nextRealm ? computeAttributes(s.realm + 1, s.route, s.skillLevel) : null;
  const routeDef = s.route ? ROUTES[s.route] : null;

  return (
    <div className="pane-wrap">
      <div className="pane-grid">
        <section className="panel">
          {nextRealm ? (
            <>
              <div className="panel-head">
                运转周天 <span className="sub">境界 {s.realm} → {s.realm + 1} · {nextRealm.name}</span>
              </div>
              <div className="panel-body">
                <ChargeTrack dantian={s.dantian} cost={nextRealm.breakthroughCost!} />
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
                <p className="cap-note" style={{ margin: 0 }}>
                  一流高手已是本轮武学之极——江湖路尽处，便是归隐之时（归隐流程随战斗模块交付）
                </p>
              </div>
            </>
          )}
        </section>

        <div>
          <section className="panel">
            <div className="panel-head">挂机产出</div>
            <div className="panel-body">
              <div className="zone-box">
                <div className="zt">内力 / 秒 · 资源产出域</div>
                <div className="zone-line">
                  <span className="base">9.0 × 1.25<sup>{s.realm - 1}</sup> = {rate.toFixed(1)}</span>
                  {' '}× <span className="perm">(1 + 0%)</span> = <span className="result">{rate.toFixed(1)}</span>
                </div>
                <div className="zone-legend">
                  <span className="perm">永久（无）</span>
                  <span className="temp">本轮（无）</span>
                </div>
              </div>
              {s.repTotal === 0 && (
                <div className="cap-note">归隐后可用声望购买永久加成，下一轮产出更快</div>
              )}
            </div>
          </section>

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
                  <>突破另得：挂机产出 {rate.toFixed(1)} → {idleNeiliPerSec(s.realm + 1).toFixed(1)} / 秒 · 武学上限 {REALMS[s.realm - 1].skillCap} → {nextRealm.skillCap}
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
      </div>
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

function ChargeTrack({ dantian, cost }: { dantian: number; cost: number }) {
  const p = zhoutianProgress(dantian, cost);
  return (
    <>
      <div className="kv">
        <span className="k">总消耗</span>
        <span className="v">{fmt(cost)} 内力（每周天 {fmt(cost / CHARGE_SEGMENTS)} × {CHARGE_SEGMENTS}）</span>
      </div>
      <div className="charge-track" aria-label={`周天进度 ${p.segmentsFull} / ${CHARGE_SEGMENTS}`}>
        {Array.from({ length: CHARGE_SEGMENTS }, (_, i) => {
          if (i < p.segmentsFull) return <div key={i} className="charge-seg full" />;
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
          <span className="gold">五周天圆满</span>
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
  const ready = s.dantian >= nextRealm.breakthroughCost!;
  return (
    <button className={ready ? 'btn pulse' : 'btn'} disabled={!ready} onClick={s.breakthrough}>
      {ready ? `突破 · ${nextRealm.name}` : '运转周天中…'}
    </button>
  );
}
