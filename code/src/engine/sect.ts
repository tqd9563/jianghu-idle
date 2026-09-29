/**
 * 门派 —— 权威来源：docs/systems/sect-neigong/spec.md §5（拜入 / 任务 / 贡献商店 / 本门小甜头）。
 * 门派 id 沿用路数 id：华山 = huashan，少林 = shaolin，唐门 = tangmen（华山是惊雷的源流，依此类推）。
 * 贡献每世清零，换得的秘籍永久保留。价格与任务收益标 [待测试]，禁止在此之外调参。
 */
import type { RouteId } from './content';
import { NEIGONG, neigongOf, type NeigongId } from './neigong';
import { WUXUE, formKey, formName, type WuxueId } from './wuxue';

export type SectId = RouteId;

export interface SectDef {
  id: SectId;
  name: '华山' | '少林' | '唐门';
  /** 拜入卡片上的源流一句（worldview.md §8 的揭示） */
  origin: string;
  /** 独门特效一句说明 */
  signature: string;
  neigong: NeigongId;
  wuxue: [WuxueId, WuxueId];
  /** 任务的差事名：短差、长差 */
  errands: [string, string];
}

export const SECTS: Record<SectId, SectDef> = {
  huashan: {
    id: 'huashan', name: '华山', origin: '惊雷剑意，相传源出华山。', signature: '蓄势，越打越快',
    neigong: neigongOf('huashan', '绝学'), wuxue: ['cangyajianjue', 'luoxingjian'],
    errands: ['巡守玉女峰', '护送药材下山'],
  },
  shaolin: {
    id: 'shaolin', name: '少林', origin: '镇岳护体，相传源出少林。', signature: '反震，攻防同算',
    neigong: neigongOf('shaolin', '绝学'), wuxue: ['luohanfumogun', 'xiangmochufa'],
    errands: ['后山担水', '护送经卷出寺'],
  },
  tangmen: {
    id: 'tangmen', name: '唐门', origin: '蚀骨毒功，相传源出唐门。', signature: '引爆，毒层一并结算',
    neigong: neigongOf('tangmen', '绝学'), wuxue: ['luoyingfeizhen', 'qianjibiao'],
    errands: ['采药试毒', '押送暗器出蜀'],
  },
};

export const SECT_IDS: SectId[] = ['huashan', 'shaolin', 'tangmen'];

/** 拜入所需境界 */
export const SECT_REALM = 3;

/** 拜山传闻（spec §5.1）：突破入境界 2 时，突破仪式与下一场战斗记录各说一次 */
export const RUMOR = '华山、少林、唐门广开山门，修为至小有所成者，可往拜山。';

// ---------------------------------------------------------------- 任务（spec §5.2 + S12）

export type SectTaskKind = 'short' | 'long';

/** 同时只跑一件；到时自动结算，离线照常计时。收益按 S12 翻倍：标准玩家约 200 / 天 [待测试] */
export const SECT_TASKS: Record<SectTaskKind, { name: string; hours: number; contrib: number; hint: string }> = {
  short: { name: '短差', hours: 2, contrib: 40, hint: '在线时顺手派' },
  long: { name: '长差', hours: 8, contrib: 120, hint: '下线前派' },
};

export interface SectTask {
  kind: SectTaskKind;
  /** 结束时刻（墙钟毫秒） */
  endsAt: number;
}

// ---------------------------------------------------------------- 贡献商店（spec §5.3）

export type SectItemKind = 'neigong' | 'wuxue' | 'scroll' | 'juance';

export interface SectItem {
  id: string;
  kind: SectItemKind;
  label: string;
  price: number;
  wuxue?: WuxueId;
  form?: number;
}

/** 绝学招式秘籍：第 5 / 6 / 7 式 */
export const SECT_SCROLL_PRICE: Record<number, number> = { 5: 250, 6: 350, 7: 450 };

/** 归真卷册的秘籍键（与招式秘籍同存 ownedScrolls） */
export const juanceKey = (ng: NeigongId) => `juance:${ng}`;

/** 本派货架，按陈列顺序：绝学内功、两门绝学武学、各自的招式秘籍、归真卷册 */
export function sectShelf(id: SectId): SectItem[] {
  const d = SECTS[id];
  return [
    { id: `sect:${d.neigong}`, kind: 'neigong', label: NEIGONG[d.neigong].name, price: 600 },
    ...d.wuxue.map((w) => ({ id: `sect:${w}`, kind: 'wuxue' as const, label: WUXUE[w].name, price: 400, wuxue: w })),
    ...d.wuxue.flatMap((w) => [5, 6, 7].map((k) => ({
      id: `sect:${formKey(w, k)}`, kind: 'scroll' as const, label: `${WUXUE[w].name} · ${formName(k)}`,
      price: SECT_SCROLL_PRICE[k], wuxue: w, form: k,
    }))),
    { id: `sect:${juanceKey(d.neigong)}`, kind: 'juance', label: '归真卷册', price: 500 },
  ];
}

/** 这门武学是不是所拜门派的本门绝学 */
export function isBenmen(sect: SectId | null, id: WuxueId): boolean {
  return sect !== null && WUXUE[id].source === SECTS[sect].name;
}
