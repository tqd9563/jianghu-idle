/**
 * 武学页 —— docs/design/ui-overhaul-prototype.html `#p-wuxue` 的实现（issue #26 视觉大改）。
 * 装配槽 → 藏书（类别筛选 + 线装书脊陈列）→ 选中武学详情（参数、每一式的熟练与领悟条件）。
 * 书肆已拆成独立页签。数值出自 docs/systems/sect-neigong/spec.md §2。
 */
import { useState, type CSSProperties } from 'react';
import { NEIGONG, QUALITY_ORDER, type Quality } from '../engine/neigong';
import { formTitle } from '../engine/formNames';
import {
  FORM_GATES, MULT_STEP, QUALITY_PARAMS, RESONANCE_MULT, SHULIAN_STEP, TRIGGER_RATE, WUXUE, checkFormGate,
  formDunwuChance, formHasEffect, formKey, formMult, shulianThresholds, shulianTier, slotCount,
  type FormEffect, type WuxueId,
} from '../engine/wuxue';
import { hasNode } from '../engine/prestige';
import { isBenmen } from '../engine/sect';
import { ROUTES } from '../engine/routes';
import { learnedFormsOf, qiMaxOf, useGameStore } from '../store/gameStore';

const Q_NO: Record<Quality, 1 | 2 | 3> = { 寻常: 1, 上乘: 2, 绝学: 3 };
/** 熟练四档的玩家叫法（引擎里末档叫「圆熟」，界面统一写「圆满」） */
const TIER4 = ['生疏', '熟练', '精通', '圆满'] as const;
const CN = ['', '一', '二', '三', '四', '五', '六', '七'];
/** 类别简笔图标（public/art/icon-*.png 作遮罩）；杵法暂无图标 */
const CAT_ICON: Record<string, string> = { 剑法: 'jian', 刀法: 'dao', 拳掌: 'quan', 暗器: 'anqi', 棍法: 'gun' };
/** 招式附加效果的说明（与 combat.ts 的结算一致） */
const EFFECT_TEXT: Record<FormEffect, string> = {
  必暴: '本招必定暴击',
  附毒: '命中时为对方多附 2 层毒',
  护体: '为自己添一层护体，吸收 8% 气血',
  回气: '本招不耗真气',
  蓄势: '本场每多出一招，招式伤害再 +10%',
  反震: '伤害按攻击加防御计',
  引爆: '引爆对方全部毒层，按三倍毒伤结算',
};

function CatIcon({ cat }: { cat: string }) {
  const k = CAT_ICON[cat];
  return k ? <i className="cat-ico" style={{ '--ico': `url(/art/icon-${k}.png)` } as CSSProperties} aria-hidden="true" /> : null;
}

export function WuxuePane() {
  const s = useGameStore();
  const owned = [...(s.ownedWuxue ?? [])].sort((a, b) =>
    QUALITY_ORDER.indexOf(WUXUE[b].quality) - QUALITY_ORDER.indexOf(WUXUE[a].quality));
  const equipped = s.equipped ?? [];
  const [cur, setCur] = useState<WuxueId | null>(equipped[0] ?? owned[0] ?? null);
  const [cat, setCat] = useState('全部');
  const current = cur && owned.includes(cur) ? cur : owned[0] ?? null;
  const slots = slotCount(s.realm);
  const cats = [...new Set(owned.map((id) => WUXUE[id].category))];
  const shown = owned.filter((id) => cat === '全部' || WUXUE[id].category === cat);

  return (
    <>
      <header className="jh-head"><div><h1>武学</h1></div></header>

      <div className="wx-seats">
        {Array.from({ length: 5 }, (_, i) => {
          const id = equipped[i];
          if (i >= slots) return <div key={i} className="wx-seat locked">境界 {i + 1} 开</div>;
          if (!id) return <div key={i} className="wx-seat empty">空槽</div>;
          const d = WUXUE[id];
          const p = QUALITY_PARAMS[d.quality];
          return (
            <button key={i} className="wx-seat" aria-pressed={id === current} onClick={() => setCur(id)}>
              <span className="n">{d.name}</span>
              <span className="m">真气消耗 {p.cost} · 冷却 {p.cd}</span>
              <span className="x">已装</span>
            </button>
          );
        })}
      </div>

      {owned.length === 0 ? (
        <div className="wx-empty">
          <p>尚无武学。书肆有寻常秘籍可买；各图 Boss 首次击杀必掉上乘秘籍。</p>
          <button className="jh-btn2" onClick={() => useGameStore.setState({ pendingTab: 'shop' })}>去书肆</button>
        </div>
      ) : (
        <>
          <div className="gf-shelf-head">
            <h2 className="jh-sec">藏书</h2>
            {cats.length > 1 && (
              <div className="jh-seg" role="group" aria-label="按类别筛选">
                <button aria-pressed={cat === '全部'} onClick={() => setCat('全部')}>全部<small>{owned.length}</small></button>
                {cats.map((c) => (
                  <button key={c} aria-pressed={cat === c} onClick={() => setCat(c)}>
                    <CatIcon cat={c} />{c}<small>{owned.filter((id) => WUXUE[id].category === c).length}</small>
                  </button>
                ))}
              </div>
            )}
          </div>
          <div className="wx-shelf">
            {shown.map((id) => {
              const d = WUXUE[id];
              return (
                <button key={id} className={`wx-book q${Q_NO[d.quality]}`} aria-current={id === current}
                  title={`${d.name} · ${d.quality}${d.category}`} onClick={() => setCur(id)}>
                  {equipped.includes(id) && <span className="eq">装</span>}
                  <span className="bt">{d.name}</span>
                  <span className="bi"><CatIcon cat={d.category} /></span>
                </button>
              );
            })}
          </div>
          {current && <WuxueDetail id={current} />}
        </>
      )}
    </>
  );
}

function WuxueDetail({ id }: { id: WuxueId }) {
  const s = useGameStore();
  const d = WUXUE[id];
  const p = QUALITY_PARAMS[d.quality];
  const equipped = s.equipped ?? [];
  const on = equipped.includes(id);
  const full = equipped.length >= slotCount(s.realm);
  const res = d.route !== null && s.neigong !== null && NEIGONG[s.neigong].route === d.route;
  const benmen = isBenmen(s.sect ?? null, id);
  const learned = learnedFormsOf(s, id);
  const qi = qiMaxOf(s);
  const casts = (k: number) => (s.formCasts ?? {})[formKey(id, k)] ?? 0;
  const nextK = learned.length + 1;
  const th = shulianThresholds(d.quality, benmen);
  const trig = Math.round(TRIGGER_RATE * 100);

  return (
    <div className="jh-card wx-card">
      <div className="head">
        <span className="ttl">
          <span className="serif big">{d.name}</span>
          <span className={`jh-tag q${Q_NO[d.quality]}`}>{d.quality}</span>
          {res && <span className="jh-tag res" data-tip={`与所修内功同为${ROUTES[d.route!].name}一路，招式伤害 ×${RESONANCE_MULT}`}>共鸣</span>}
          {benmen && <span className="jh-tag res" data-tip="本门武学：每一式练到熟练、精通、圆满所需的出招数少两成">本门</span>}
        </span>
        <button
          className={on ? 'jh-btn2 quiet' : 'jh-btn2'}
          disabled={!on && full}
          onClick={() => (on ? s.unequipWuxue(id) : s.equipWuxue(id))}
        >
          {on ? '卸下' : full ? '装配槽已满' : '装配'}
        </button>
      </div>
      <div className="params">
        <span><CatIcon cat={d.category} /> {d.category}</span>
        <span>真气消耗 <b>{p.cost}</b></span>
        <span>冷却 <b>{p.cd}</b> 回合</span>
        <span className="jh-dotted" data-tip={`冷却已好、真气够用时，每回合有${trig}%的机会出招（与其它就绪的武学随机取一门），替下普攻`}>
          触发几率 <b>{trig}%</b>
        </span>
        <span data-tip={d.signature ? '门派独门：每一式都带' : '第一式与末式带'}>特效 <b>{d.effect}</b></span>
      </div>

      {Array.from({ length: p.forms }, (_, i) => i + 1).map((k) => {
        const fx = formHasEffect(d, k) ? <span className="fx">{EFFECT_TEXT[d.effect]}</span> : null;
        const nm = (
          <div className="nm">
            <span className="k">第{CN[k]}式</span>
            <span className="serif">{formTitle(id, k)}</span>
            {fx}
          </div>
        );
        const c = casts(k);
        const tier = shulianTier(d.quality, c, benmen);
        const mult = Math.round(formMult(d.quality, k, c, res, benmen) * 100);
        const base = Math.round((p.mult0 + MULT_STEP * (k - 1)) * 100);
        const multTip = [`第${CN[k]}式本式 ${base}%`, tier > 0 ? `${TIER4[tier]} ×${(1 + SHULIAN_STEP * tier).toFixed(2)}` : '',
          res ? `共鸣 ×${RESONANCE_MULT}` : ''].filter(Boolean).join(' · ');

        if (learned.includes(k)) {
          // 熟练四档画成一条线上的四个节点：实线已走、虚线未走
          const at = [0, ...th];
          const pos = tier >= 3 ? 100 : ((tier + (c - at[tier]) / (at[tier + 1] - at[tier])) / 3) * 100;
          const tip = tier >= 3 ? `已出 ${c} 招，已至圆满` : `已出 ${c} 招 · ${at[tier + 1]} 招时入「${TIER4[tier + 1]}」`;
          return (
            <div key={k} className="wx-shi">
              {nm}
              <div className="prof" data-tip={tip}>
                <div className="prof-line"><i style={{ width: `${Math.max(0, Math.min(100, pos))}%` }} /></div>
                {TIER4.map((t, i) => (
                  <span key={t} className={`pn${i < tier ? ' p' : i === tier ? ' c' : ''}`} style={{ left: `${(i / 3) * 100}%` }}>
                    <b /><em>{t}</em>
                  </span>
                ))}
              </div>
              <span className="mul" data-tip={multTip}>×{mult}%</span>
            </div>
          );
        }

        const g = checkFormGate(d, k, s.realm, qi, (s.ownedScrolls ?? []).includes(formKey(id, k)), casts(k - 1), benmen);
        const need = FORM_GATES[d.quality][k];
        const chance = formDunwuChance(d.quality, s.wuxing ?? 1, (s.pastLearned ?? []).includes(formKey(id, k)),
          hasNode(s.ownedRepNodes, 'shimen_zhiyin'));
        return (
          <div key={k} className="wx-shi locked">
            {nm}
            <div className="jh-checks">
              <span className={g.realm ? 'y' : 'n'}>境界 {need.realm}</span>
              <span className={g.qi ? 'y' : 'n'} data-tip={`你此刻真气上限 ${qi}`}>真气 ≥ {need.qi}</span>
              {need.scroll && (
                <span className={g.scroll ? 'y' : 'n'} data-tip={d.quality === '绝学' ? `${d.source}贡献商店可换` : '书肆可买'}>招式秘籍</span>
              )}
              <span className={g.prev ? 'y' : 'n'}>前式熟练</span>
              {k === nextK && g.ready && (
                <span className="dunwu" data-tip={`每出一招判一次顿悟：基础 ${Math.round(p.dunwuP * 100)}% × 悟性 ${(s.wuxing ?? 1).toFixed(2)}${(s.pastLearned ?? []).includes(formKey(id, k)) ? ' · 前世悟过 ×3' : ''}${hasNode(s.ownedRepNodes, 'shimen_zhiyin') ? ' · 师门指引 ×2' : ''}`}>
                  顿悟中 · 每出一招 {(chance * 100).toFixed(0)}%
                </span>
              )}
            </div>
            <span className="mul" data-tip={multTip}>×{mult}%</span>
          </div>
        );
      })}
    </div>
  );
}
