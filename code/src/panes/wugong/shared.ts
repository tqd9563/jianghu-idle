/** 武功页公用：品质序号、中文数字、石印图路径、内功路数对应的路数色 */
import type { CSSProperties } from 'react';
import type { RouteId } from '../../engine/content';
import type { NeigongId, Quality } from '../../engine/neigong';
import type { WuxueCat } from '../../engine/wuxue';

export const Q_NO: Record<Quality, 1 | 2 | 3> = { 寻常: 1, 上乘: 2, 绝学: 3 };
export const CN = ['', '一', '二', '三', '四', '五', '六', '七'];

/** 武学类目石印（public/art/cat/，AI 生图，沿用战斗石印模板） */
const CAT_FILE: Record<WuxueCat, string> = { 剑: 'jian', 刀: 'dao', 枪: 'qiang', 棍: 'gun', 拳: 'quan', 掌: 'zhang', 指: 'zhi', 腿: 'tui', 暗器: 'anqi' };
export const catIcon = (cat: WuxueCat): CSSProperties => ({ backgroundImage: `url('/art/cat/${CAT_FILE[cat]}.png')` });
/** 内功心法石印（public/art/neigong/<id>.png），九部各一枚、按心法名取象 */
export const ngIcon = (id: NeigongId): CSSProperties => ({ backgroundImage: `url('/art/neigong/${id}.png')` });

/** 内功三路借用武学路数色：归海刚猛朱、镇岳守御石青、蚀骨阴毒黛绿（石印换色、路数章同色） */
export const ROUTE_TAG: Record<RouteId, '刚猛' | '守御' | '阴毒'> = { huashan: '刚猛', shaolin: '守御', tangmen: '阴毒' };
