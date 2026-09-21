/**
 * 修炼面板（外视/内视星图式）—— 实现基准：docs/design/zhoutian-composite-v3.html（获批原型）
 * 呈现规格：docs/systems/zhoutian/spec.md §4；文案：docs/rules/copy/zhoutian.md（冻结）
 *
 * 取代 ZhoutianMandala 的内圈进度环与外圈冲穴交互。几何与状态一律出自
 * cultivationSceneModel，本组件只画不算。
 */
import { useEffect, useRef, useState } from 'react';
import type { CSSProperties, JSX } from 'react';
import { effBreakCost, effIdleRate, useGameStore } from '../store/gameStore';
import {
  buildSceneModel, polar, R_V, VIEW_H, VIEW_W,
  type SceneMeridian, type SceneStar,
} from './cultivationSceneModel';

const ASSET = '/zhoutian';
/** 视频转速上限：playbackRate 过高会失真，且超过 4 已无可感知差异 */
const PBR_MAX = 4;

function prefersReducedMotion(): boolean {
  return typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;
}

export function CultivationScene(): JSX.Element | null {
  const s = useGameStore();
  const [inner, setInner] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const vidRef = useRef<HTMLVideoElement>(null);
  const reduced = useRef(prefersReducedMotion());

  const model = buildSceneModel({
    realm: s.realm,
    dantian: s.dantian,
    breakCost: effBreakCost(s),
    chargeHighWater: s.chargeHighWater,
    chongxueChances: s.chongxueChances ?? 0,
    qishi: s.qishi ?? 0,
    acupointProgress: s.acupointProgress ?? {},
  });

  // 挂机速率 → 视频转速。reduced-motion 下暂停并回落到 poster 静帧
  // （index.css 的全局降级只作用于 animation/transition，对 <video> 无效）
  const rate = effIdleRate(s);
  useEffect(() => {
    const v = vidRef.current;
    if (!v) return;
    if (reduced.current) { v.pause(); return; }
    v.playbackRate = Math.min(PBR_MAX, 0.75 + Math.log2(rate / 8 + 1) * 0.9);
    void v.play().catch(() => { /* 自动播放被拦截时保持 poster，不影响可玩性 */ });
  }, [rate, inner]);

  if (model === null) return null;

  const onAttempt = (m: SceneMeridian, star: SceneStar): void => {
    if (star.state !== 'actionable') {
      // 文案按周天是否圆满分流：已圆满时再运转无用，须突破（冻结文案 §1 v1.1）
      if (star.state === 'dim') {
        setFeedback(model.segmentsFull >= model.zhoutianCount
          ? '冲穴机会已尽 · 突破后再来'
          : '冲穴机会不足 · 运转周天获取');
      }
      return;
    }
    const before = useGameStore.getState().acupointProgress?.[star.id] ?? { failCount: 0, opened: false };
    s.attemptAcupoint(star.id);
    const now = useGameStore.getState().acupointProgress?.[star.id] ?? before;
    if (!now.opened) {
      setFeedback('窍穴松动几分');                                          // 冻结文案 §1
      return;
    }
    // 第 3 次必成（design.md §3.3）：措辞与普通成功区分
    const line = before.failCount >= 2
      ? `气血已通 · ${star.name}`                                           // 冻结文案 §1
      : `行气冲穴 · ${star.name} 已通`;                                      // 冻结文案 §1
    const justThrough = m.stars.filter(v => v.state === 'opened').length + 1 === m.stars.length;
    setFeedback(justThrough ? `${line} · 经脉贯通 · ${m.name}` : line);      // 冻结文案 §4
  };

  const cssVars = {
    '--empty': `${model.emptyPct}%`,
    '--qi-speed': `${model.qiSpeedSec}s`,
    '--qi-op': model.qiOpacity,
    '--vessel-glow': model.vesselGlow,
    '--aura': model.auraOpacity,
    '--bd-bright': model.backdropBrightness,
  } as CSSProperties;

  const pct = Math.round(model.currentSegmentPct * 100);

  return (
    <div className="cs-wrap">
      <div className={`cs-scene${inner ? ' inner' : ''}`} style={cssVars}>
        <div className="cs-backdrop" />
        <div className="cs-inkbg" />

        {/* 外视：丹田处一团透出衣袍的气光（暗晕 multiply + 气光 screen + 遮罩羽化） */}
        <div className="cs-shade" />
        <div className="cs-bloom" />

        <button
          type="button"
          className="cs-vessel"
          onClick={() => !inner && setInner(true)}
          aria-label={inner ? '丹田内景' : '内视丹田 · 查看周天与窍穴'}
          disabled={inner}
        >
          <div className="cs-void-qi"><i /><i /><i /></div>
          <div className="cs-liquid">
            <div className="cs-liquid-anchor">
              <video
                ref={vidRef}
                src={`${ASSET}/dantian.mp4`}
                poster={`${ASSET}/dantian-poster.jpg`}
                muted loop playsInline preload="metadata"
              />
            </div>
          </div>
        </button>

        <div className="cs-read" aria-hidden={!inner}>
          {/* 全数圆满时不能再读作「第 N 转 0%」——那会被误读成刚起步，
              与顶栏「N/N · 圆满」自相矛盾。圆满态走冻结文案 §2。 */}
          {model.segmentsFull >= model.zhoutianCount ? (
            <>
              <div className="n done">圆满</div>
              <div className="d">丹田已满 · 可突破</div>
            </>
          ) : (
            <>
              <div className="n">{pct}%</div>
              <div className="d">第 {model.segmentsFull + 1} / {model.zhoutianCount} 转</div>
            </>
          )}
        </div>

        <svg className="cs-ring" viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}>
          <defs>
            <clipPath id="cs-half-moon" clipPathUnits="objectBoundingBox">
              <rect x="0.5" y="0" width="0.5" height="1" />
            </clipPath>
          </defs>

          {/* 周天：月相串 */}
          {model.moons.map((mo, i) => (
            <g key={i} data-phase={mo.phase}>
              <circle className="cs-moon-base" cx={mo.x} cy={mo.y} r={mo.r} />
              {mo.phase !== 'new' && (
                <image
                  className={`cs-moon ${mo.phase}`} href={`${ASSET}/moon.png`}
                  x={mo.x - mo.sprite / 2} y={mo.y - mo.sprite / 2}
                  width={mo.sprite} height={mo.sprite}
                  clipPath={mo.phase === 'waxing' ? 'url(#cs-half-moon)' : undefined}
                />
              )}
            </g>
          ))}
          <text className="cs-m-label" x={polar(R_V + 44, 0)[0]} y={polar(R_V + 44, 0)[1]} textAnchor="middle">周 天</text>

          {/* 窍穴：星曜 + 星官连线 */}
          {model.meridians.map(m => (
            <g key={m.id} className={`cs-m${m.through ? ' through' : ''}`}>
              <ellipse className="cs-m-glow" cx={m.glowCx} cy={m.glowCy} rx={54} ry={32} />
              <path className="cs-const" d={m.line} />
              {m.stars.map(st => (
                <g key={st.id}>
                  <image
                    className={`cs-star ${st.state}`} href={`${ASSET}/star.png`}
                    x={st.x - st.size / 2} y={st.y - st.size / 2}
                    width={st.size} height={st.size}
                    role="button" tabIndex={0}
                    aria-label={`${st.name}${st.state === 'opened' ? ' 已通' : ` · 成功率 ${Math.round(st.rate * 100)}%`}`}
                    onClick={() => onAttempt(m, st)}
                    onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onAttempt(m, st); } }}
                  />
                  <text className={`cs-acu-name ${st.state}`} x={st.labelX} y={st.labelY}
                        textAnchor="middle" dominantBaseline="middle">{st.name}</text>
                </g>
              ))}
              <text className="cs-m-label" x={m.labelX} y={m.labelY} textAnchor="middle">{m.name}</text>
            </g>
          ))}
        </svg>

        <button type="button" className="cs-back" onClick={() => setInner(false)}>收 功</button>
        <div className="cs-hint">点<b>丹田</b>内视 · 冲穴与周天详情</div>
      </div>

      <div className="cs-feedback" role="status">{feedback ?? ' '}</div>
    </div>
  );
}
