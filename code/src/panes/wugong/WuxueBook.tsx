/**
 * 武功页 · 武学详情（题跋右侧）—— docs/design/bag-wugong-prototype.html。旧版磁青书页见 gongfa-prototype.html。
 * 「招式」每式一枚圆形墨像（大小固定，超过四式折两行；外圈细弧为熟练，悬停给式名、倍率、效果、熟练与解锁条件）→
 * 「属性」伤害 / 触发 / 耗气 / 冷却四条墨刷条（以名录最大值为满格）+ 特效行（共鸣、本门随后）→ 右下装配 / 卸下（装不了的缘由写在按钮左侧）。
 * 数值出自 docs/systems/battle-loot/spec.md §3；解锁规则见 battle-loot/design.md §4。
 */
import { NEIGONG } from '../../engine/neigong';
import { formTitle } from '../../engine/formNames';
import {
  BIG_OF, EFFECT_TAG, QUALITY_PARAMS, RESONANCE_MULT, TRIGGER_CAP, WUXUE, WUXUE_IDS,
  effectText, formCd, formCost, formKey, formMult, shulianThresholds, shulianTier, usableWith, type WuxueId,
} from '../../engine/wuxue';
import { isBenmen } from '../../engine/sect';
import { ROUTES } from '../../engine/routes';
import { handsOf, hasFormOf, learnedFormsOf, slotCountOf, useGameStore } from '../../store/gameStore';
import { CN, figOf } from './shared';

/** 熟练四档的玩家叫法（引擎里末档叫「圆熟」，界面统一写「圆满」） */
const TIER4 = ['生疏', '熟练', '精通', '圆满'] as const;
const SHU_TEXT = ['', '耗气 ×0.92', '耗气 ×0.84', '耗气 ×0.75'];
const FX_FILE: Record<string, string> = {
  必暴: 'bibao', 透劲: 'toujin', 连击: 'lianji', 蓄势: 'xushi', 反震: 'fanzhen', 运劲: 'yunjin', 凝眸: 'ningmou', 轻身: 'qingshen',
  回气: 'huiqi', 回元: 'huiyuan', 护体: 'huti', 封穴: 'fengxue', 卸力: 'xieli', 迷目: 'mimu', 破绽: 'pozhan', 附毒: 'fudu', 引爆: 'yinbao',
};
/** 属性条满格：名录里各项的最大值 */
const MAXV = {
  mult: Math.max(...WUXUE_IDS.map((i) => WUXUE[i].mult0)), p: Math.max(...WUXUE_IDS.map((i) => WUXUE[i].p)),
  cost: Math.max(...WUXUE_IDS.map((i) => WUXUE[i].cost)), cd: Math.max(...WUXUE_IDS.map((i) => WUXUE[i].cd)),
};

export function WuxueBook({ id, pw }: { id: WuxueId; pw: number }) {
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

  // 兵器搭配（design.md §3.7）：肉身不挑；暗器要暗器槽；器械要同类兵器。能装时不写缘由
  const need = !owned ? '缺第一式残页'
    : on ? ''
      : full ? '装配已满 · 先卸下一门'
        : big === '肉身' ? ''
          : big === '暗器' ? (hands.anqi ? '' : '暗器槽空置 · 须备暗器')
            : usableWith(d, hands) ? '' : `须持${d.cat}方可装配${hands.weapon ? ` · 现持${hands.weapon}` : ' · 现在赤手'}`;

  // 版面：圆的直径固定，超过四式折两行，「招式」段上提、「属性」段随之下移（单位：画高 %）
  const ph = (pw * 9) / 16, dia = pw * 0.046, rows = p.forms > 4 ? 2 : 1, rowH = ((dia + pw * 0.01) / ph) * 100;
  const y0 = rows > 1 ? 34 : 41, ya = y0 + 5.5 + rows * rowH + 2;
  const C = 2 * Math.PI * 46;

  const bars: [string, number, string, string?][] = [
    ['伤害', d.mult0 / MAXV.mult, `×${Math.round(d.mult0 * 100)}%`, '第一式倍率；每门武学各不相同，同品质总强度相当'],
    ['触发', d.p / MAXV.p, `${Math.round(d.p * 100)}%`, `已装各门的触发几率相加就是每回合出招的机会，最多 ${Math.round(TRIGGER_CAP * 100)}%；出招时再按各门几率挑一门`],
    ['耗气', d.cost / MAXV.cost, String(d.cost)],
    ['冷却', d.cd / MAXV.cd, `${d.cd} 回合`],
  ];
  return (
    <>
      <div className="wsec" style={{ top: `${y0}%` }}>招式</div>
      <div className="forms5" style={{ top: `${y0 + 5.5}%` }}>
        {Array.from({ length: p.forms }, (_, i) => i + 1).map((k) => {
          const ok = owned && learned.includes(k);
          const c = casts(k);
          const tier = ok ? shulianTier(d.quality, c, benmen) : 0;
          const at = [0, ...th];
          const frac = !ok ? 0 : tier >= 3 ? 1 : (tier + (c - at[tier]) / (at[tier + 1] - at[tier])) / 3;
          const mult = Math.round(formMult(d, k, res) * 100);
          const fx = effectText(d, k);
          const got = hasFormOf(s, id, k);
          const lockTxt = !got ? '缺少残页' : learned.includes(k - 1) ? `待第${CN[k - 1]}式圆满 · ${casts(k - 1)} / ${th[2]}` : `待第${CN[k - 1]}式圆满`;
          const state = ok
            ? (tier >= 3 ? `已出 ${c} 招，已至圆满` : `${TIER4[tier]} · 已出 ${c} 招 · ${at[tier + 1]} 招时入「${TIER4[tier + 1]}」`)
              + (SHU_TEXT[tier] ? ` · ${SHU_TEXT[tier]}` : '') + ` · 本式耗气 ${formCost(d, k, tier)} · 冷却 ${formCd(d)}`
            : lockTxt;
          const tip = `第${CN[k]}式 · ${formTitle(id, k)}<br>×${mult}%${res ? `（含共鸣 ×${RESONANCE_MULT}）` : ''}${fx ? ` · ${fx}` : ''}<br>${state}`;
          return (
            <div key={k} className={`fmd${ok ? '' : ' lock'}`} style={{ '--d': `${dia}px` } as React.CSSProperties} data-tip={tip}>
              <img src={figOf(d.cat, `${id}${k}`)} alt="" />
              <svg viewBox="0 0 100 100" aria-hidden="true">
                <circle className="bgc" cx="50" cy="50" r="46" />
                <circle className="fg" cx="50" cy="50" r="46" strokeDasharray={`${C * frac} ${C}`} />
              </svg>
            </div>
          );
        })}
      </div>
      <div className="wsec" style={{ top: `${ya}%` }}>属性</div>
      <div className="attrs5" style={{ top: `${ya + 4.5}%` }}>
        {bars.map(([k, v, t, tip]) => (
          <div key={k} className="r" data-tip={tip}>
            <span className="k">{k}</span><span className="bar"><i style={{ width: `${Math.round(v * 100)}%` }} /></span><span className="v">{t}</span>
          </div>
        ))}
        <div className="fxr">
          <img src={`/art/wugong/fx-${FX_FILE[d.effect]}.png`} alt="" />{d.effect} · {tag}
          {res && <span data-tip={`与所修内功同为${ROUTES[d.route!].name}一路，招式伤害 ×${RESONANCE_MULT}`}> · 共鸣</span>}
          {benmen && <span data-tip="本门武学：每一式练到熟练、精通、圆满所需的出招数少两成"> · 本门</span>}
        </div>
      </div>
      <div className="wact">
        {need && <span className="need">{need}</span>}
        {on
          ? <button type="button" className="quiet" onClick={() => s.unequipWuxue(id)}>卸下</button>
          : <button type="button" disabled={!!need} onClick={() => s.equipWuxue(id)}>装配</button>}
      </div>
    </>
  );
}
