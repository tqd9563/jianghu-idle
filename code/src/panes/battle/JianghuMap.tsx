/**
 * 战斗页第一、二层：江湖舆图 → 点卷放大到那片地域、据点浮出（DESIGN.md「江湖舆图与地域分图」；
 * 原型 docs/design/living-jianghu-prototype.html `#v-map`）。
 */
import { useEffect } from 'react';
import { mapDef, mapName, trackLength, volName, VOLUMES, stageKey } from '../../engine/enemies';
import { mapUnlocked, volUnlocked, type MapNo } from '../../store/gameStore';
import { factionStyle } from '../../engine/roster';
import { regionOf, VOL_PINS, WORLD_MAP, ZOOM_K } from './art';

/** 未开的据点：先破哪一处 */
function lockedBy(map: MapNo): string {
  const m = mapDef(map);
  const vol = VOLUMES[m.vol - 1];
  if (m.layer === 'road') return m.vol > 1 ? `打穿${VOLUMES[m.vol - 2].region}任一家门户后开启` : '';
  if (m.layer === 'outer') return `先通关${mapName(vol.maps[0])}`;
  const outer = vol.maps.find((id) => { const o = mapDef(id); return o.layer === 'outer' && o.chapter === m.chapter; })!;
  return `先通关${mapName(outer)}`;
}

export function JianghuMap({ unlocked, cleared, hereVol, zoomVol, onZoom, onOpen }: {
  unlocked: readonly number[];
  cleared: readonly string[];
  /** 这一世所在的卷（推得最深的一卷） */
  hereVol: number;
  /** 当前放大到哪一卷；null = 整张舆图 */
  zoomVol: number | null;
  onZoom: (vol: number | null) => void;
  onOpen: (map: MapNo) => void;
}) {
  const vol = zoomVol ? VOLUMES[zoomVol - 1] : null;
  const region = vol ? regionOf(vol.no, vol.maps) : null;
  // 放大动画走完后再淡入分图（CSS 延时），退回时先淡出
  const [k, cx, cy] = vol ? [ZOOM_K, ...VOL_PINS[vol.no - 1]] : [1, 0, 0];
  const tf = vol ? `translate(${50 - cx * k}%, ${50 - cy * k}%) scale(${k})` : 'none';
  const done = (m: number) => cleared.filter((key) => key.startsWith(`m${m}s`)).length;
  const brokenChapters = vol ? vol.maps.filter((m) => mapDef(m).layer === 'gate' && done(m) >= trackLength(m)).length : 0;

  // Esc 退回舆图
  useEffect(() => {
    if (!vol) return;
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onZoom(null); };
    addEventListener('keydown', h);
    return () => removeEventListener('keydown', h);
  }, [vol, onZoom]);

  return (
    <>
      <header className="jh-head bt-map-head">
        <div>
          <div className="vol">{vol ? `${volName(vol.no)} · ${vol.title}` : ''}</div>
          <h1>{vol ? vol.region : '江湖'}</h1>
        </div>
        <div className="sub">
          {vol
            ? <>已破 <b>{brokenChapters}</b> / {vol.factions.length} 家</>
            : <>此世行至 <b>{volName(hereVol)} · {VOLUMES[hereVol - 1].region}</b></>}
        </div>
      </header>
      {vol && <button type="button" className="bt-back" onClick={() => onZoom(null)}>← 江湖舆图</button>}
      <div className={`bt-map${vol ? ' zoomed' : ''}${vol && !region?.art ? ' no-region' : ''}`}>
        <div className="map-in" style={{ transform: tf, ['--k' as string]: k }}>
          <div className="art" style={{ backgroundImage: `url('${WORLD_MAP}')` }} />
          {VOLUMES.map((v, i) => {
            const open = volUnlocked(v.no, unlocked);
            const [x, y] = VOL_PINS[i];
            return (
              <button
                key={v.no} type="button"
                className={`vlab${open ? ' open' : ''}${v.no === hereVol ? ' here' : ''}`}
                style={{ left: `${x}%`, top: `${y}%` }}
                aria-disabled={!open}
                data-tip={open ? undefined : `打穿${VOLUMES[Math.max(0, i - 1)].region}任一家的门户后开启`}
                onClick={open ? () => onZoom(v.no) : undefined}
              >
                <span className="dot" /><span className="nm">{v.region}</span><span className="tt">{volName(v.no)} · {v.title}</span>
              </button>
            );
          })}
        </div>
        <div className="reg" style={region?.art ? { backgroundImage: `url('${region.art}')` } : undefined}>
          {vol && region && vol.maps.map((m) => {
            const d = mapDef(m);
            const open = mapUnlocked(m, unlocked);
            const total = trackLength(m);
            const n = done(m);
            const broken = n >= total;
            const [x, y] = region.spot(m);
            const camp = d.faction ? factionStyle(d.faction)?.camp ?? '正' : null;
            const prog = broken ? null : n ? `${n} / ${total}` : `${total} 关`;
            const cur = open && !broken && cleared.includes(stageKey(m, 1));
            return (
              <button
                key={m} type="button"
                className={`spot${broken ? ' done' : ''}${cur ? ' cur' : ''}${open ? '' : ' locked'}`}
                style={{ left: `${x}%`, top: `${y}%` }}
                data-tip={open ? undefined : lockedBy(m)}
                onClick={open ? () => onOpen(m) : undefined}
              >
                <span className="glow" />
                <span className="mist"><i /><i /><i /></span>
                <span className="lab">
                  <span className="nm">{mapName(m)}</span>
                  {(camp || prog) && (
                    <span className="sm">
                      {camp && <><span className={`al ${camp === '正' ? 'z' : 'x'}`}>{camp}</span>{d.faction}</>}
                      {prog && <>{camp ? ' · ' : '赶路 · '}{prog}</>}
                    </span>
                  )}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </>
  );
}
