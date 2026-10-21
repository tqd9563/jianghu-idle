/**
 * 武学页 —— 定稿原型 docs/design/battle-loot-prototype.html `#p-wuxue`（DESIGN.md「陈列」「Tags（装备品阶与路数）」）。
 * 装配槽 → 藏书（器械 / 肉身 / 暗器三组类目筛选 + 书封陈列，未拼齐的压暗）→ 选中武学详情
 * （五项参数、兵器搭配、每一式的特效数值 / 残页 / 熟练与解锁）；锁定行照 docs/design/wuxue-form-unlock-prototype.html。
 * 数值出自 docs/systems/battle-loot/spec.md §3；解锁规则见 battle-loot/design.md §4。
 */
import { useState, type CSSProperties } from 'react';
import { NEIGONG, QUALITY_ORDER, type Quality } from '../engine/neigong';
import { formTitle } from '../engine/formNames';
import {
  BIG_OF, CAT_GROUPS, EFFECT_TAG, QUALITY_PARAMS, RESONANCE_MULT, TRIGGER_CAP, WUXUE, WUXUE_IDS,
  effectText, formCd, formCost, formKey, formMult, shulianThresholds, shulianTier, usableWith, type WuxueCat, type WuxueId,
} from '../engine/wuxue';
import { isBenmen } from '../engine/sect';
import { ROUTES } from '../engine/routes';
import { handsOf, hasFormOf, learnedFormsOf, useGameStore, slotCountOf } from '../store/gameStore';

const Q_NO: Record<Quality, 1 | 2 | 3> = { 寻常: 1, 上乘: 2, 绝学: 3 };
/** 熟练四档的玩家叫法（引擎里末档叫「圆熟」，界面统一写「圆满」） */
const TIER4 = ['生疏', '熟练', '精通', '圆满'] as const;
const CN = ['', '一', '二', '三', '四', '五', '六', '七'];
/** 类目简笔图标（public/art/icon-*.png 作遮罩）；枪、指、腿暂无图标 */
const CAT_ICON: Partial<Record<WuxueCat, string>> = { 剑: 'jian', 刀: 'dao', 拳: 'quan', 掌: 'quan', 暗器: 'anqi', 棍: 'gun' };
/** 书封上的类目印：暗器盖「镖」 */
const SEAL: Partial<Record<WuxueCat, string>> = { 暗器: '镖' };
const SHU_TEXT = ['', '耗气 ×0.92', '耗气 ×0.84', '耗气 ×0.75'];

function CatIcon({ cat }: { cat: WuxueCat }) {
  const k = CAT_ICON[cat];
  return k ? <i className="cat-ico" style={{ '--ico': `url(/art/icon-${k}.png)` } as CSSProperties} aria-hidden="true" /> : null;
}

/** 路数章：描边 + 前置亮点，不用填充 */
const TagSeal = ({ id }: { id: WuxueId }) => {
  const tag = EFFECT_TAG[WUXUE[id].effect];
  return <span className={`jh-tag tag t-${tag}`}>{tag}</span>;
};

export function WuxuePane() {
  const s = useGameStore();
  const owned = s.ownedWuxue ?? [];
  const pages = s.pages ?? [];
  const pagesOf = (id: WuxueId) => pages.filter((k) => k.startsWith(`${id}:`)).length;
  // 书架上陈列：已拥有的，加上虽未拥有但已得它别的式残页的（压暗）
  const ghost = (id: WuxueId) => !owned.includes(id) && pagesOf(id) > 0;
  const shelf = WUXUE_IDS.filter((id) => owned.includes(id) || ghost(id))
    .sort((a, b) => QUALITY_ORDER.indexOf(WUXUE[b].quality) - QUALITY_ORDER.indexOf(WUXUE[a].quality));
  const equipped = s.equipped ?? [];
  const [cur, setCur] = useState<WuxueId | null>(equipped[0] ?? shelf[0] ?? null);
  const [cat, setCat] = useState<'全部' | WuxueCat>('全部');
  const current = cur && shelf.includes(cur) ? cur : shelf[0] ?? null;
  const slots = slotCountOf(s);
  const count = (c: '全部' | WuxueCat) => shelf.filter((id) => c === '全部' || WUXUE[id].cat === c).length;
  const shown = shelf.filter((id) => cat === '全部' || WUXUE[id].cat === cat);

  return (
    <>
      <header className="jh-head"><div><h1>武学</h1></div></header>

      <div className="wx-seats">
        {Array.from({ length: slots }, (_, i) => {
          const id = equipped[i];
          if (!id) return <div key={i} className="wx-seat empty">空槽</div>;
          const d = WUXUE[id];
          return (
            <button key={i} className="wx-seat" aria-pressed={id === current} onClick={() => setCur(id)}>
              <span className="n">{d.name}</span>
              <span className="m"><CatIcon cat={d.cat} /> {d.cat} · 触发 {Math.round(d.p * 100)}% · 冷却 {d.cd}</span>
              <span className="x">已装</span>
            </button>
          );
        })}
      </div>

      {shelf.length === 0 ? (
        <div className="wx-empty">
          <p>尚无武学。书肆有寻常秘籍可买；对手身上也能搜出整式与残页。</p>
          <button className="jh-btn2" onClick={() => useGameStore.setState({ pendingTab: 'shop' })}>去书肆</button>
        </div>
      ) : (
        <>
          <div className="gf-shelf-head">
            <h2 className="jh-sec">藏书</h2>
            <div className="jh-seg" role="group" aria-label="按类目筛选">
              <button aria-pressed={cat === '全部'} onClick={() => setCat('全部')}>全部<small>{shelf.length}</small></button>
              {(Object.keys(CAT_GROUPS) as (keyof typeof CAT_GROUPS)[]).map((g) => (
                <span key={g} className="grp-wrap">
                  <span className="grp">{g}</span>
                  {CAT_GROUPS[g].map((c) => (
                    <button key={c} aria-pressed={cat === c} disabled={count(c) === 0} onClick={() => setCat(c)}>
                      <CatIcon cat={c} />{c}<small>{count(c)}</small>
                    </button>
                  ))}
                </span>
              ))}
            </div>
          </div>
          <div className="wx-shelf covers">
            {shown.map((id) => {
              const d = WUXUE[id];
              const p = QUALITY_PARAMS[d.quality];
              const isGhost = ghost(id);
              const sub = isGhost ? <span className="pgc">残页 {pagesOf(id)} / {p.forms}</span> : null;
              return (
                <button key={id} className={`wx-cover q${Q_NO[d.quality]}${isGhost ? ' ghost' : ''}`} aria-current={id === current}
                  data-tip={`${d.name} · ${d.quality}${d.cat}`} onClick={() => setCur(id)}>
                  <i className="cv" />
                  {isGhost ? <span className="need">缺第一式</span>
                    : equipped.includes(id) && <span className="eq">装</span>}
                  <span className="t">{d.name}</span>
                  <span className="seal">{SEAL[d.cat] ?? d.cat}</span>
                  <small>{sub ?? <>{d.quality} · <span className={`tagc-${EFFECT_TAG[d.effect]}`}>{EFFECT_TAG[d.effect]}</span></>}</small>
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
  const owned = (s.ownedWuxue ?? []).includes(id);
  const equipped = s.equipped ?? [];
  const on = equipped.includes(id);
  const full = equipped.length >= slotCountOf(s);
  const res = d.route !== null && s.neigong !== null && NEIGONG[s.neigong].route === d.route;
  const benmen = isBenmen(s.sect ?? null, id);
  const learned = learnedFormsOf(s, id);
  // 侠名录·招式线加速后熟练可带小数，界面只显示整招
  const casts = (k: number) => Math.floor((s.formCasts ?? {})[formKey(id, k)] ?? 0);
  const th = shulianThresholds(d.quality, benmen);
  const hands = handsOf(s);
  const usable = usableWith(d, hands);
  const big = BIG_OF[d.cat];
  const ok = owned && usable;

  // 兵器搭配一行（design.md §3.7）：肉身不挑；暗器要暗器槽；器械要同类兵器。未拥有的先说差什么
  const need = !owned
    ? { ok: false, text: '缺第一式残页' }
    : big === '肉身' ? { ok: true, text: '肉身功夫 · 不拘兵器' }
      : big === '暗器' ? { ok: hands.anqi, text: hands.anqi ? `暗器槽已备${s.worn?.暗器?.name} · 可装配` : '暗器槽空置 · 须备暗器方可装配' }
        : { ok: usable, text: usable ? `现持${d.cat} · 可装配` : `须持${d.cat}方可装配${hands.weapon ? ` · 现持${hands.weapon}` : ' · 现在赤手'}` };

  return (
    <div className="jh-card wx-card">
      <div className="head">
        <span className="ttl">
          <span className="serif big">{d.name}</span>
          <span className={`jh-tag q${Q_NO[d.quality]}`}>{d.quality}</span>
          <TagSeal id={id} />
          <span className="wtag">{big} · {d.cat}</span>
          {res && <span className="jh-tag res" data-tip={`与所修内功同为${ROUTES[d.route!].name}一路，招式伤害 ×${RESONANCE_MULT}`}>共鸣</span>}
          {benmen && <span className="jh-tag res" data-tip="本门武学：每一式练到熟练、精通、圆满所需的出招数少两成">本门</span>}
        </span>
        <button
          className={on ? 'jh-btn2 quiet' : 'jh-btn2'}
          disabled={!on && (full || !ok)}
          onClick={() => (on ? s.unequipWuxue(id) : s.equipWuxue(id))}
        >
          {on ? '卸下' : full ? '装配槽已满' : ok ? '装配' : '不能装'}
        </button>
      </div>
      <div className={`wx-need${need.ok ? ' ok' : ''}`}>{need.text}</div>
      <div className="params">
        <span data-tip="第一式倍率；每门武学各不相同，同品质总强度相当">倍率 <b>×{Math.round(d.mult0 * 100)}%</b></span>
        <span>耗气 <b>{d.cost}</b></span>
        <span>冷却 <b>{d.cd}</b> 回合</span>
        <span className="jh-dotted" data-tip={`已装各门的触发几率相加就是每回合出招的机会，最多 ${Math.round(TRIGGER_CAP * 100)}%；出招时再按各门几率挑一门`}>
          触发 <b>{Math.round(d.p * 100)}%</b>
        </span>
        <span>特效 <b>{d.effect}</b></span>
      </div>

      {Array.from({ length: p.forms }, (_, i) => i + 1).map((k) => {
        const nm = (
          <div className="nm">
            <span className="k">第{CN[k]}式</span>
            <span className="serif">{formTitle(id, k)}</span>
            <span className="fx">{effectText(d, k)}</span>
          </div>
        );
        const c = casts(k);
        const tier = shulianTier(d.quality, c, benmen);
        const mult = Math.round(formMult(d, k, res) * 100);
        const multTip = [`第${CN[k]}式本式 ${Math.round(formMult(d, k, false) * 100)}%`, res ? `共鸣 ×${RESONANCE_MULT}` : ''].filter(Boolean).join(' · ');
        if (owned && learned.includes(k)) {
          // 熟练四档画成一条线上的四个节点：实线已走、虚线未走；练熟了更顺手（耗气 / 触发 / 冷却）
          const at = [0, ...th];
          const pos = tier >= 3 ? 100 : ((tier + (c - at[tier]) / (at[tier + 1] - at[tier])) / 3) * 100;
          const tip = (tier >= 3 ? `已出 ${c} 招，已至圆满` : `已出 ${c} 招 · ${at[tier + 1]} 招时入「${TIER4[tier + 1]}」`)
            + (SHU_TEXT[tier] ? ` · ${SHU_TEXT[tier]}` : '')
            + ` · 本式耗气 ${formCost(d, k, tier)} · 冷却 ${formCd(d)}`;
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

        // 锁定：缺这一页 → 缺少残页；有页但前式没圆满 → 待第 k − 1 式圆满（前式已能出时带进度）
        const got = hasFormOf(s, id, k);
        const prevOn = learned.includes(k - 1);
        return (
          <div key={k} className="wx-shi locked">
            {nm}
            <div className="lk">
              {d.quality !== '寻常' && <i className={`leaf${got ? ' got' : ''}`} data-tip={`第${CN[k]}式残页 · ${got ? '已得' : '未得'}`} />}
              {!got ? <span className="why">缺少残页</span>
                : prevOn ? (
                  <>
                    <span className="why near" data-tip={`第${CN[k - 1]}式再出 ${th[2] - casts(k - 1)} 招入圆满`}>待第{CN[k - 1]}式圆满</span>
                    <span className="cnt">{casts(k - 1)} <small>/ {th[2]}</small></span>
                  </>
                ) : <span className="why">待第{CN[k - 1]}式圆满</span>}
            </div>
            <span className="mul" data-tip={multTip}>×{mult}%</span>
          </div>
        );
      })}
    </div>
  );
}
