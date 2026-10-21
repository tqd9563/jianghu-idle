/**
 * 武功页 · 武学书页（磁青书两页）—— docs/design/gongfa-prototype.html。
 * 左页：竖写书名、品质 / 路数章（共鸣、本门）、类目石印（按路数着色）、五项参数、兵器搭配一行、装配 / 卸下。
 * 右页：每一式一行（式名、特效、倍率），能出的画熟练四节点，锁定的写缺页或「待前式圆满」。
 * 数值出自 docs/systems/battle-loot/spec.md §3；解锁规则见 battle-loot/design.md §4。
 */
import { NEIGONG } from '../../engine/neigong';
import { formTitle } from '../../engine/formNames';
import {
  BIG_OF, EFFECT_TAG, QUALITY_PARAMS, RESONANCE_MULT, TRIGGER_CAP, WUXUE,
  effectText, formCd, formCost, formKey, formMult, shulianThresholds, shulianTier, usableWith, type WuxueId,
} from '../../engine/wuxue';
import { isBenmen } from '../../engine/sect';
import { ROUTES } from '../../engine/routes';
import { handsOf, hasFormOf, learnedFormsOf, slotCountOf, useGameStore } from '../../store/gameStore';
import { CN, Q_NO, catIcon } from './shared';

/** 熟练四档的玩家叫法（引擎里末档叫「圆熟」，界面统一写「圆满」） */
const TIER4 = ['生疏', '熟练', '精通', '圆满'] as const;
const SHU_TEXT = ['', '耗气 ×0.92', '耗气 ×0.84', '耗气 ×0.75'];

export function WuxueBook({ id }: { id: WuxueId }) {
  const s = useGameStore();
  const d = WUXUE[id];
  const p = QUALITY_PARAMS[d.quality];
  const tag = EFFECT_TAG[d.effect];
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
  const big = BIG_OF[d.cat];

  // 兵器搭配一行（design.md §3.7）：肉身不挑；暗器要暗器槽；器械要同类兵器。缘由写在按钮上方，按钮只写「装配」
  const need = !owned ? { ok: false, text: '缺第一式残页' }
    : full && !on ? { ok: false, text: '装配已满 · 先卸下一门' }
      : big === '肉身' ? { ok: true, text: '肉身功夫 · 不拘兵器' }
        : big === '暗器' ? { ok: hands.anqi, text: hands.anqi ? `暗器槽已备${s.worn?.暗器?.name ?? '暗器'}` : '暗器槽空置 · 须备暗器' }
          : usableWith(d, hands) ? { ok: true, text: `现持${d.cat}` }
            : { ok: false, text: `须持${d.cat}方可装配${hands.weapon ? ` · 现持${hands.weapon}` : ' · 现在赤手'}` };

  return (
    <>
      <div className="wg-pg l">
        <div className="wg-ttl">
          <span className="nm">{d.name}</span>
          <div className="side">
            <span className={`ptag q${Q_NO[d.quality]}`}>{d.quality}</span>
            <span className={`ptag rt t-${tag}`}>{tag}</span>
            {res && <span className="ptag res" data-tip={`与所修内功同为${ROUTES[d.route!].name}一路，招式伤害 ×${RESONANCE_MULT}`}>共鸣</span>}
            {benmen && <span className="ptag res" data-tip="本门武学：每一式练到熟练、精通、圆满所需的出招数少两成">本门</span>}
          </div>
        </div>
        <i className={`wg-bigico wg-ico rf t-${tag}`} style={catIcon(d.cat)} data-tip={`${big} · ${d.cat}`} />
        <div className="wg-rows">
          <span data-tip="第一式倍率；每门武学各不相同，同品质总强度相当">伤害倍率<b>×{Math.round(d.mult0 * 100)}%</b></span>
          <span>真气消耗<b>{d.cost}</b></span>
          <span>冷却回合<b>{d.cd}</b></span>
          <span>
            <span className="wg-dotted" data-tip={`已装各门的触发几率相加就是每回合出招的机会，最多 ${Math.round(TRIGGER_CAP * 100)}%；出招时再按各门几率挑一门`}>触发几率</span>
            <b>{Math.round(d.p * 100)}%</b>
          </span>
          <span>附加特效<b>{d.effect}</b></span>
        </div>
        <div className={`wg-need${need.ok ? ' ok' : ''}`}>{need.text}</div>
        {on
          ? <button className="wg-btn quiet" onClick={() => s.unequipWuxue(id)}>卸下</button>
          : <button className="wg-btn" disabled={!need.ok} onClick={() => s.equipWuxue(id)}>装配</button>}
      </div>

      <div className="wg-pg r">
        <div className="wg-forms">
        {Array.from({ length: p.forms }, (_, i) => i + 1).map((k) => {
          const c = casts(k);
          const tier = shulianTier(d.quality, c, benmen);
          const mult = Math.round(formMult(d, k, res) * 100);
          const multTip = [`第${CN[k]}式本式 ${Math.round(formMult(d, k, false) * 100)}%`, res ? `共鸣 ×${RESONANCE_MULT}` : ''].filter(Boolean).join(' · ');
          const fx = effectText(d, k);
          const head = (
            <>
              <div className="h">
                <span className="k">第{CN[k]}式</span>
                <span className="t">{formTitle(id, k)}</span>
                <span className="mul" data-tip={multTip}>×{mult}%</span>
              </div>
              {fx && <div className="fx">{fx}</div>}
            </>
          );
          if (owned && learned.includes(k)) {
            // 熟练四档画成一条线上的四个节点：实线已走、虚线未走
            const at = [0, ...th];
            const pos = tier >= 3 ? 100 : ((tier + (c - at[tier]) / (at[tier + 1] - at[tier])) / 3) * 100;
            const tip = (tier >= 3 ? `已出 ${c} 招，已至圆满` : `已出 ${c} 招 · ${at[tier + 1]} 招时入「${TIER4[tier + 1]}」`)
              + (SHU_TEXT[tier] ? ` · ${SHU_TEXT[tier]}` : '')
              + ` · 本式耗气 ${formCost(d, k, tier)} · 冷却 ${formCd(d)}`;
            return (
              <div key={k} className="wg-shi">
                {head}
                <div className="wg-prof" data-tip={tip}>
                  <div className="line"><i style={{ width: `${Math.max(0, Math.min(100, pos))}%` }} /></div>
                  {TIER4.map((t, i) => (
                    <span key={t} className={`pn${i < tier ? ' p' : i === tier ? ' c' : ''}`} style={{ left: `${(i / 3) * 100}%` }}><b /><em>{t}</em></span>
                  ))}
                </div>
              </div>
            );
          }
          // 锁定：缺这一页 → 缺少残页；有页但前式没圆满 → 待第 k − 1 式圆满（前式已能出时带进度）
          const got = hasFormOf(s, id, k);
          const prevOn = learned.includes(k - 1);
          return (
            <div key={k} className="wg-shi locked">
              {head}
              <div className="lk">
                {d.quality !== '寻常' && <i className={`leaf${got ? ' got' : ''}`} data-tip={`第${CN[k]}式残页 · ${got ? '已得' : '未得'}`} />}
                {!got ? <span>缺少残页</span>
                  : prevOn ? (
                    <>
                      <span data-tip={`第${CN[k - 1]}式再出 ${th[2] - casts(k - 1)} 招入圆满`}>待第{CN[k - 1]}式圆满</span>
                      <span className="cnt">{casts(k - 1)} <small>/ {th[2]}</small></span>
                    </>
                  ) : <span>待第{CN[k - 1]}式圆满</span>}
              </div>
            </div>
          );
        })}
        </div>
        <div className="wg-foot">{d.quality}{big === '暗器' ? '暗器' : `${d.cat}法`} · 共{CN[p.forms]}式</div>
      </div>
    </>
  );
}
