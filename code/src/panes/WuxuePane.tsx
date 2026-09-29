/**
 * 武学页 —— docs/design/sect-neigong-prototype.html §3 的实现：装配、招式熟练与领悟条件、共鸣、书肆。
 * 数值出自 docs/systems/sect-neigong/spec.md §2 / §4。
 */
import { useState } from 'react';
import { NEIGONG, QUALITY_ORDER, type Quality } from '../engine/neigong';
import {
  FORM_GATES, QUALITY_PARAMS, SHULIAN_NAMES, TRIGGER_RATE, WUXUE, checkFormGate, formDunwuChance, formHasEffect, formKey,
  formMult, formName, shulianTier, slotCount, type WuxueId,
} from '../engine/wuxue';
import { hasNode } from '../engine/prestige';
import { learnedFormsOf, qiMaxOf, shopItemsOf, shopPriceOf, useGameStore } from '../store/gameStore';
import { fmtBig } from '../fmt';

const Q_CLS: Record<Quality, string> = { 寻常: 'q-common', 上乘: 'q-fine', 绝学: 'q-peak' };
const LU_NAME = { huashan: '惊雷', shaolin: '镇岳', tangmen: '蚀骨' } as const;

export function WuxuePane() {
  const s = useGameStore();
  const owned = [...(s.ownedWuxue ?? [])].sort((a, b) =>
    QUALITY_ORDER.indexOf(WUXUE[b].quality) - QUALITY_ORDER.indexOf(WUXUE[a].quality));
  const [cur, setCur] = useState<WuxueId | null>(owned[0] ?? null);
  const current = cur && owned.includes(cur) ? cur : owned[0] ?? null;
  const slots = slotCount(s.realm);
  const equipped = s.equipped ?? [];

  return (
    <div className="pane-wrap">
      <section className="panel">
        <div className="panel-head">
          装配 <span className="sub">冷却好了、真气够了，每回合有 {Math.round(TRIGGER_RATE * 100)}% 的机会随机出一门，替下普攻</span>
          <span className="right">悟性 <b>{(s.wuxing ?? 1).toFixed(2)}</b></span>
        </div>
        <div className="panel-body">
          <div className="wx-slots">
            {Array.from({ length: 5 }, (_, i) => {
              const id = equipped[i];
              if (i >= slots) return <div key={i} className="wx-slot locked">境界 {i + 1} 开</div>;
              if (!id) return <div key={i} className="wx-slot empty">空槽</div>;
              const d = WUXUE[id];
              const p = QUALITY_PARAMS[d.quality];
              return (
                <button key={i} className="wx-slot" aria-pressed={id === current} onClick={() => setCur(id)}>
                  <span className="sn serif">{d.name}</span>
                  <span className="ss">耗气 {p.cost} · 冷却 {p.cd}</span>
                  <span><span className={`qtag ${Q_CLS[d.quality]}`}>{d.quality}</span></span>
                </button>
              );
            })}
          </div>

          {owned.length === 0 ? (
            <p className="cap-note">
              尚无武学。书肆可买寻常秘籍；各图 Boss 首次击杀必掉上乘秘籍（图 1 初入 Boss 掉《惊鸿剑》）。
            </p>
          ) : (
            <div className="wx-layout">
              <div className="wx-list" aria-label="已有武学">
                {owned.map((id) => {
                  const d = WUXUE[id];
                  const res = d.route !== null && s.neigong !== null && NEIGONG[s.neigong].route === d.route;
                  return (
                    <button key={id} className="wx-item" aria-current={id === current} onClick={() => setCur(id)}>
                      <span className="nm serif">{d.name}</span>
                      <span className={`qtag ${Q_CLS[d.quality]}`}>{d.quality}</span>
                      {res && <span className="qtag res-tag">共鸣</span>}
                      <span className="pg">{learnedFormsOf(s, id).length}/{QUALITY_PARAMS[d.quality].forms} 式</span>
                      {equipped.includes(id) && <span className="eq">已装</span>}
                    </button>
                  );
                })}
              </div>
              {current && <WuxueDetail id={current} />}
            </div>
          )}
        </div>
      </section>

      <section className="panel" style={{ marginTop: 16 }}>
        <div className="panel-head">
          书肆 <span className="sub">银两买秘籍；秘籍永久保留，银两每世清零{hasNode(s.ownedRepNodes, 'qingzhuang_shanglu') ? ' · 轻装上路八折' : ''}</span>
          <span className="right">银两 <b>{fmtBig(s.silver)}</b></span>
        </div>
        <div className="panel-body">
          <div className="wx-shop">
            {shopItemsOf(s).map((it) => {
              const have = it.kind === 'wuxue' ? (s.ownedWuxue ?? []).includes(it.wuxue!)
                : it.kind === 'scroll' ? (s.ownedScrolls ?? []).includes(formKey(it.wuxue!, it.form!)) : false;
              const locked = s.realm < it.realm;
              const price = shopPriceOf(s, it.price);
              const tag = it.kind === 'wuxue' ? '寻常' : it.kind === 'scroll' ? '招式秘籍' : '上乘内功';
              return (
                <div key={it.id} className={`wx-good${have ? ' owned' : ''}${locked ? ' locked' : ''}`}>
                  <span className="gn serif">{it.label}</span>
                  <span className={`qtag ${it.kind === 'wuxue' ? 'q-common' : 'q-fine'}`}>{tag}</span>
                  <span className="gp">{have ? '已有' : locked ? `境界 ${it.realm} 上架` : fmtBig(price)}</span>
                  {!have && !locked && (
                    <button className="btn small" disabled={s.silver < price} onClick={() => s.buyShopItem(it.id)}>
                      {s.silver < price ? '银两不足' : '购入'}
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </section>
    </div>
  );
}

function WuxueDetail({ id }: { id: WuxueId }) {
  const s = useGameStore();
  const d = WUXUE[id];
  const p = QUALITY_PARAMS[d.quality];
  const on = (s.equipped ?? []).includes(id);
  const full = (s.equipped ?? []).length >= slotCount(s.realm);
  const res = d.route !== null && s.neigong !== null && NEIGONG[s.neigong].route === d.route;
  const learned = learnedFormsOf(s, id);
  const qi = qiMaxOf(s);
  const casts = (k: number) => (s.formCasts ?? {})[formKey(id, k)] ?? 0;
  const nextK = learned.length + 1;

  return (
    <div className="wx-detail">
      <div className="dh">
        <span className="nm serif">{d.name}</span>
        <span className={`qtag ${Q_CLS[d.quality]}`}>{d.quality}</span>
        {d.route && <span className={`tag route-tag-${d.route}`}>{LU_NAME[d.route]}</span>}
        {res && <span className="qtag res-tag">共鸣 · 招式 ×1.1</span>}
        <button
          className={`btn small${on ? ' ghost' : ''}`}
          disabled={!on && full}
          onClick={() => (on ? s.unequipWuxue(id) : s.equipWuxue(id))}
        >
          {on ? '卸下' : full ? '槽已满' : '装上'}
        </button>
      </div>
      <div className="params">
        <span>{d.category}</span>
        <span>耗气 <b>{p.cost}</b></span>
        <span>冷却 <b>{p.cd}</b> 回合</span>
        <span>特效 <b>{d.effect}</b>{d.signature ? '（独门，每式都带）' : '（第一式与末式）'}</span>
      </div>
      {Array.from({ length: p.forms }, (_, i) => i + 1).map((k) => {
        const eff = formHasEffect(d, k) ? <span className="qtag eff">{d.effect}</span> : null;
        const mult = Math.round(formMult(d.quality, k, casts(k), res) * 100);
        if (learned.includes(k)) {
          const tier = shulianTier(d.quality, casts(k));
          const nextAt = tier < 3 ? p.shulian[tier] : p.shulian[2];
          const prevAt = tier === 0 ? 0 : p.shulian[tier - 1];
          const pct = tier < 3 ? ((casts(k) - prevAt) / (nextAt - prevAt)) * 100 : 100;
          return (
            <div key={k} className="wx-form">
              <span className="fi">{formName(k)}</span>
              <span className="fn">{eff}</span>
              <span className="fm">×{mult}%</span>
              <div className="fx">
                <div className="bar thin"><i style={{ width: `${Math.max(0, Math.min(100, pct))}%` }} /></div>
                <div className="lvl">
                  <span><b>{SHULIAN_NAMES[tier]}</b>{tier < 3 ? ` · 下一档 ${SHULIAN_NAMES[tier + 1]}` : ' · 已至顶'}</span>
                  <span>{casts(k)}{tier < 3 ? ` / ${nextAt}` : ''} 次</span>
                </div>
              </div>
            </div>
          );
        }
        const g = checkFormGate(d, k, s.realm, qi, (s.ownedScrolls ?? []).includes(formKey(id, k)), casts(k - 1));
        const isNext = k === nextK;
        const gate = (id2: string, ok: boolean, text: string) => <span key={id2} className={ok ? 'ok' : 'no'}>{text}</span>;
        const need = FORM_GATES[d.quality][k];
        const chance = formDunwuChance(d.quality, s.wuxing ?? 1, (s.pastLearned ?? []).includes(formKey(id, k)),
          hasNode(s.ownedRepNodes, 'shimen_zhiyin'));
        return (
          <div key={k} className="wx-form locked">
            <span className="fi">{formName(k)}</span>
            <span className="fn">{eff}</span>
            <span className="fm">×{mult}%</span>
            <div className="fx">
              <div className="cond">
                {gate('r', g.realm, `境界 ${need.realm}`)}
                {gate('q', g.qi, `真气 ≥ ${need.qi}`)}
                {need.scroll && gate('s', g.scroll, '招式秘籍')}
                {gate('p', g.prev, '前式熟练')}
                {isNext && g.ready && <span className="wait">顿悟中 · 每出一招 {(chance * 100).toFixed(0)}%</span>}
                {!isNext && <span className="no">先悟前一式</span>}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
