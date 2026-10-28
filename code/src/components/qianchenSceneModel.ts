/**
 * 前尘页三幅画上的落点与版面（基准 docs/design/qianchen-xiang-prototype.html + DESIGN.md「前尘页」）。
 * 坐标一律为画幅百分比，按 public/art/qianchen/ 下各图里 AI 画出的地物量取。
 */
import type { AchvId } from '../engine/achievements';
import type { DiyunId } from '../engine/prestige';

/** 底蕴 · 往世八相：前世身份、身影椭圆（中心与半径）、竹签顶的位置 */
export interface XiangDef { id: DiyunId; who: string; fig: [number, number, number, number]; slip: [number, number] }
export const XIANG: XiangDef[] = [
  { id: 'qixue', who: '力士', fig: [17, 34, 9, 15], slip: [26, 22] },
  { id: 'gongji', who: '刀客', fig: [33, 23, 9, 15], slip: [41, 10] },
  { id: 'fangyu', who: '持杖僧', fig: [61, 25, 9, 16], slip: [70, 9] },
  { id: 'mingzhong', who: '弓手', fig: [15, 55, 9, 12], slip: [8, 50] },
  { id: 'shanbi', who: '轻身女侠', fig: [43, 49, 10, 12], slip: [51, 37] },
  { id: 'huixin', who: '刺客', fig: [61, 58, 8, 11], slip: [69, 46] },
  { id: 'huixin_shanghai', who: '剑客', fig: [26, 74, 12, 15], slip: [37, 60] },
  { id: 'zhenqi', who: '坐忘道人', fig: [72, 81, 10, 13], slip: [80, 60] },
];

/** 身影显影程度：0 级只剩极淡残影，其后开方曲线渐实（前几级变化最明显） */
export const reveal = (level: number): number => (level <= 0 ? 0.12 : Math.min(1, 0.32 + Math.sqrt(level) * 0.15));

/** 机缘 · 江边挂签：两根绳（jiyuan.jpg 中 AI 画的）拟合成抛物线，返回绳在 x 处的高度 */
const ROPE = [(x: number) => 22.6 - 47.6 * (x / 100 - 0.58) ** 2, (x: number) => 48 - 46 * (x / 100 - 0.6) ** 2];
/** 第 i 支签（共 14 支，七七两排、下排错开半格）的签顶位置 */
export function jiyuanSlipAt(i: number): [number, number] {
  const row = i < 7 ? 0 : 1, x = 25 + (i % 7) * 9.8 + row * 4.9;
  return [x, ROPE[row](x) - 0.6];
}

/** 侠名录 · 江湖百景：四处地界，徽记按串连顺序排，label 为地界名的位置 */
export interface ZoneDef { name: string; ids: AchvId[]; at: [number, number][]; label: [number, number] }
export const ZONES: ZoneDef[] = [
  { name: '武道', ids: ['jian', 'dao', 'qiang', 'gun', 'quan', 'zhang', 'zhi', 'tui', 'anqi'],
    at: [[9, 30], [19, 25], [29, 28], [35, 40], [27, 50], [17, 47], [8, 55], [16, 67], [28, 69]], label: [22, 37] },
  { name: '修行', ids: ['jingmai', 'chongxue', 'zhaoshi', 'canye', 'yangshang'],
    at: [[43, 24], [49, 36], [58, 41], [65, 32], [66, 19]], label: [41, 40] },
  { name: '江湖', ids: ['boss', 'elite', 'zhuanshi', 'menpai'], at: [[79, 18], [91, 15], [93, 39], [81, 37]], label: [86, 27] },
  { name: '世情', ids: ['yinliang', 'yueli', 'heishi', 'zhanbai'], at: [[70, 62], [80, 55], [92, 57], [86, 77]], label: [65, 77] },
];

/** 画在舞台上的摆放：按宽铺满（左右最多裁 1.5%），舞台偏高时放大；画比舞台矮时上下要羽化 */
export interface PicLayout { pw: number; pl: number; pt: number; short: boolean }
export function picLayout(W: number, H: number): PicLayout {
  const pw = Math.min(Math.max(W, (H * 16) / 9), W / 0.985), ph = (pw * 9) / 16;
  return { pw, pl: (W - pw) / 2, pt: ph >= H ? (H - ph) / 2 : Math.max(0, (H - ph) * 0.45), short: ph < H - 4 };
}

/** 点选手卷的位置（舞台坐标）：默认在徽记下方，下面放不下改到上方，左右不出舞台、上不压页头 */
export function cardAt(node: { left: number; top: number; bottom: number; cx: number }, card: { w: number; h: number }, stage: { w: number; h: number }): { x: number; y: number } {
  let y = node.bottom + 6;
  if (y + card.h > stage.h - 20) y = node.top - card.h - 6;
  return { x: Math.max(12, Math.min(stage.w - card.w - 12, node.cx - card.w / 2)), y: Math.max(150, y) };
}
