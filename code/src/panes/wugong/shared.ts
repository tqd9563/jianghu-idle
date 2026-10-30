/** 武功页公用：品质序号、中文数字、石印图路径、内功路数对应的路数色 */
import type { CSSProperties } from 'react';
import type { RouteId } from '../../engine/content';
import { NEIGONG, type NeigongId, type Quality } from '../../engine/neigong';
import type { WuxueCat } from '../../engine/wuxue';

export const Q_NO: Record<Quality, 1 | 2 | 3> = { 寻常: 1, 上乘: 2, 绝学: 3 };
export const CN = ['', '一', '二', '三', '四', '五', '六', '七'];

/** 武学类目石印（public/art/cat/，AI 生图，沿用战斗石印模板） */
const CAT_FILE: Record<WuxueCat, string> = { 剑: 'jian', 刀: 'dao', 枪: 'qiang', 棍: 'gun', 拳: 'quan', 掌: 'zhang', 指: 'zhi', 腿: 'tui', 暗器: 'anqi' };
export const catIcon = (cat: WuxueCat): CSSProperties => ({ backgroundImage: `url('/art/cat/${CAT_FILE[cat]}.png')` });
/** 内功心法石印（public/art/neigong/<icon>.png）：原九部各一枚、按心法名取象，新内功暂借同源流的（NEIGONG.icon） */
export const ngIcon = (id: NeigongId): CSSProperties => ({ backgroundImage: `url('/art/neigong/${NEIGONG[id].icon ?? id}.png')` });

/** 内功三路借用武学路数色：归海刚猛朱、镇岳守御石青、蚀骨阴毒黛绿（石印换色、路数章同色） */
export const ROUTE_TAG: Record<RouteId, '刚猛' | '守御' | '阴毒' | '绵长' | '诡谲'> = {
  huashan: '刚猛', shaolin: '守御', tangmen: '阴毒', taixu: '绵长', xuanji: '诡谲', jinghong: '刚猛', fenxue: '刚猛',
};

/** 武功页（崖边舞剑）素材键：类别图标 art/wugong/icset/a-<键>.png、招式墨像 art/wugong/st-<键>-<0–3>.png */
export const WG_CAT_FILE: Record<WuxueCat | '内功', string> = {
  内功: 'neigong', 剑: 'jian', 刀: 'dao', 枪: 'qiang', 棍: 'gun', 拳: 'quan', 掌: 'zhang', 指: 'zhi', 腿: 'tui', 暗器: 'anqi',
};
export const wgIcon = (cat: WuxueCat | '内功') => `/art/wugong/icset/a-${WG_CAT_FILE[cat]}.png`;
export const wgHash = (t: string) => [...t].reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 7);
/** 招式墨像：每类四张，按武学与式序散列取一张 */
export const figOf = (cat: WuxueCat | '内功', key: string) => `/art/wugong/st-${WG_CAT_FILE[cat]}-${wgHash(key) % 4}.png`;
