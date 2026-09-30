/**
 * 武学招式名 —— 冻结文案：docs/rules/copy/battle-narration.md §2。
 * wuxue.ts 的 formName(k) 仍是「第 N 式」占位；玩家可见处一律用这里的式名。
 * 式数跟品质走（寻常 3 / 上乘 5 / 绝学 7，见 wuxue.ts QUALITY_PARAMS），测试校验长度一致。
 */
import type { WuxueId } from './wuxue';

export const FORM_NAMES: Record<WuxueId, readonly string[]> = {
  // 寻常
  liuyunjian: ['流云出岫', '回风拂柳', '云断秋江'],
  kaishanzhang: ['推山式', '裂石式', '开山式'],
  xiulizhen: ['暗香', '疏影', '落梅'],
  xingzhegun: ['拨草寻蛇', '横担山河', '行者问路'],
  // 上乘
  jinghongjian: ['惊鸿一瞥', '翩若游龙', '鸿飞冥冥', '孤鸿掠影', '惊鸿照影'],
  fuhuquan: ['猛虎出林', '黑虎掏心', '卧虎回头', '虎啸山岗', '降龙伏虎'],
  feihuangshi: ['弹石惊雀', '流星赶月', '飞蝗过野', '乱石穿空', '满天星雨'],
  duanshuidao: ['抽刀', '断流', '逝水', '回澜', '东去'],
  // 绝学
  cangyajianjue: ['苍松迎客', '崖前观云', '白虹贯日', '苍龙出海', '危崖独立', '万壑松风', '苍崖一剑'],
  luoxingjian: ['星垂平野', '北斗横斜', '流星追月', '银河倒挂', '天璇落照', '七星连珠', '落星沉海'],
  luohanfumogun: ['罗汉礼佛', '金刚扫地', '横江断流', '伏魔问心', '撞钟醒世', '千斤压顶', '万佛朝宗'],
  xiangmochufa: ['韦陀献杵', '金刚捣臼', '宝杵开山', '怒目金刚', '降魔镇狱', '力镇三界', '大日降魔'],
  luoyingfeizhen: ['落英缤纷', '桃花流水', '柳絮随风', '梨花带雨', '飞红万点', '残红点翠', '葬花无声'],
  qianjibiao: ['牵丝引线', '机关暗藏', '一线牵魂', '回旋夺命', '暗渡陈仓', '千机百变', '牵机断肠'],
};

/** 第 k 式（从 1 起）的式名；越界时退回「第 N 式」 */
export function formTitle(id: WuxueId, k: number): string {
  return FORM_NAMES[id]?.[k - 1] ?? `第${k}式`;
}
