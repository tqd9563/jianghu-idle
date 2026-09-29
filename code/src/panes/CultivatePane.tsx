/** 修炼页 —— 原型场景 1/3 修炼页签的 1:1 实现（资产负债表：权威源） */
import { WoundPanel } from '../components/WoundPanel';
import { freshInjuries } from '../engine/injury';
import { computeAttributes } from '../engine/attributes';
import { REALMS } from '../engine/content';
import { currentSegmentQuota } from '../engine/formulas';
import { ROUTES } from '../engine/routes';
import { effBreakCost, effIdleRate, retireKind, useGameStore, zhoutianN as zhoutianNOf } from '../store/gameStore';
import { fmtBig, fmtRate } from '../fmt';
import {
  REALM_ACUPOINTS, totalAcupointBonus, isMeridianComplete, openedInRealm,
  requiredMeridian, requiredMeridianOpened,
} from '../engine/acupoints';
import { CultivationScene } from '../components/CultivationScene';

const CN = ['零', '一', '二', '三', '四', '五', '六', '七', '八', '九'];
const pct = (v: number) => `${Math.round(v * 100)}%`;

export function CultivatePane() {
  const s = useGameStore();
  const breakCost = effBreakCost(s);
  // 本版终点 = 突破入境界 6（pacing/design.md §4）：境界 6 无周天，不再显示下一境界
  const nextRealm = breakCost !== null ? REALMS[s.realm] : null;
  const rate = effIdleRate(s);
  // 窍穴/贯通加成（spec §9：加法合并进临时乘区）
  const acupointData = REALM_ACUPOINTS[s.realm];
  const openedIds = new Set(
    Object.entries(s.acupointProgress ?? {})
      .filter(([, a]) => a.opened)
      .map(([id]) => id)
  );
  // 两套口径不可混用：加成按全局累计（窍穴加成保留至归隐，design.md §5 D1），
  // 账目与突破条件按本境界（design.md §4，sim.py 亦按境界建模）。
  const openedTotal = openedIds.size;
  const openedThisRealm = openedInRealm(s.realm, s.acupointProgress ?? {});
  const meridianCount = acupointData
    ? acupointData.meridians.filter(m => isMeridianComplete(m, openedIds)).length
    : 0;
  const acupointPct = totalAcupointBonus(s.realm, openedTotal, meridianCount);
  const zhoutianN = zhoutianNOf(s.realm);
  const attrs = computeAttributes(s.realm, s.route, s.skillLevel, 0, acupointPct);
  const nextAttrs = nextRealm ? computeAttributes(s.realm + 1, s.route, s.skillLevel, 0, acupointPct) : null;
  const routeDef = s.route ? ROUTES[s.route] : null;

  return (
    <div className="pane-wrap pane-grid cultivate-grid">
      <WoundPanel injuries={s.injuries ?? freshInjuries()} realm={s.realm} soulUnsettled={s.soulUnsettled ?? false} />
      <section className="panel cs-panel">
        {nextRealm ? (
          <>
            <div className="panel-head">
              运转周天 <span className="sub">境界 {s.realm} → {s.realm + 1} · {nextRealm.name}</span>
            </div>
            <div className="panel-body">
              <div className="kv">
                <span className="k">总消耗</span>
                <span className="v">
                  {fmtBig(breakCost!)} 内力（{zhoutianN} 段周天，逐段翻倍 · 本段 {fmtBig(currentSegmentQuota(breakCost!, zhoutianN, s.chargeHighWater))}）
                </span>
              </div>
              <CultivationScene />
              {acupointData && (
                <div className="acu-ledger">
                  <span>已冲开 <b>{openedThisRealm}/{REALMS[s.realm - 1].acupointPoolSize}</b> 穴</span>
                  <span>贯通 <b>{meridianCount}/{acupointData.meridians.length}</b> 脉</span>
                  <span>修炼加成 <b className="gold">+{pct(acupointPct)}</b></span>
                </div>
              )}
              <BreakthroughButton />
              <div className="cap-note">
                内力自归丹田，第{CN[zhoutianN]}周天圆满后需手动点击「突破」完成晋升；动用内力升级武学时，周天进度如实回落（气机回落）
              </div>
            </div>
          </>
        ) : (
          <>
            <div className="panel-head">运转周天 <span className="sub">小周天圆满</span></div>
            <div className="panel-body">
              <p className="cap-note" style={{ margin: '0 0 12px' }}>
                任督俱通，小周天至此圆满。大周天未开——这一版的修行到此为止。
              </p>
              {retireKind(s) !== null && (
                <button className="btn" onClick={s.openRetire}>挂剑归隐</button>
              )}
            </div>
          </>
        )}
      </section>


      <section className="panel attr-panel">
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
              <>突破另得：挂机产出 {fmtRate(rate)} → {fmtRate(effIdleRate({ ...s, realm: s.realm + 1 }))} / 秒
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

function BreakthroughButton() {
  const s = useGameStore();
  const nextRealm = REALMS[s.realm];
  const cost = effBreakCost(s);
  const dantianReady = cost !== null && s.dantian >= cost;
  // 双条件校验（design.md §4）：N 段缴清 且 本境界首条经脉贯通。
  // 与 gameStore.breakthrough 同口径：按境界计，不跨境界累计
  const progress = s.acupointProgress ?? {};
  const req = requiredMeridian(s.realm);
  const meridianOpened = requiredMeridianOpened(s.realm, progress);
  const meridianReady = req === null || meridianOpened >= req.acupointIds.length;
  const ready = dantianReady && meridianReady;
  const label = ready
    ? `突破 · ${nextRealm.name}`
    : dantianReady && !meridianReady
      ? `${req!.name} 未贯通（${meridianOpened}/${req!.acupointIds.length}）`   // 冻结文案 §5
      : '运转周天中…';
  return (
    <button className={ready ? 'btn pulse' : 'btn'} disabled={!ready} onClick={s.breakthrough}>
      {label}
    </button>
  );
}
