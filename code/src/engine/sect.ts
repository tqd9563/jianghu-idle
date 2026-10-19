/**
 * 门派 —— 权威来源：docs/systems/sect-neigong/spec.md §5（拜入 / 任务 / 贡献商店 / 本门小甜头）、
 * docs/systems/wuxue-catalog/design.md §5（九派与绝学分配、W11 / W13 / W15 新增六派按地图出现、W2 绝学只换残页）。
 * 原三派 id 沿用路数 id（华山 = huashan …）；新增六派不出绝学内功（W15）。
 * 贡献每世清零，换得的残页 / 内功永久保留。价格与任务收益标 [待 sim]，禁止在此之外调参。
 */
import type { MapId } from './enemies';
import { NEIGONG, neigongOf, type NeigongId } from './neigong';
import { QUALITY_PARAMS, WUXUE, type WuxueCat, type WuxueId } from './wuxue';

export type SectId = 'huashan' | 'shaolin' | 'tangmen' | 'gaibang' | 'wudang' | 'emei' | 'kongtong' | 'yanmen' | 'baigu';
export type SectName = '华山' | '少林' | '唐门' | '丐帮' | '武当' | '峨眉' | '崆峒' | '雁门世家' | '百蛊门';

export interface SectDef {
  id: SectId;
  name: SectName;
  /** 这一派在哪张图上行走江湖（解锁该图初入即可拜，W13） */
  map: MapId;
  /** 拜入卡片上的一句气质 */
  origin: string;
  /** 所长：功夫路子一句 */
  signature: string;
  /** 擅长的类目 */
  cats: WuxueCat[];
  /** 本派绝学内功；新增六派为 null（W15） */
  neigong: NeigongId | null;
  /** 本派绝学武学（名录第一批里已有的；第二批补齐到 3 门） */
  wuxue: WuxueId[];
  /** 任务的差事名：短差、长差 */
  errands: [string, string];
}

export const SECTS: Record<SectId, SectDef> = {
  huashan: {
    id: 'huashan', name: '华山', map: 1, origin: '剑气凌霄，君子风骨。', signature: '剑走轻灵，蓄势连斩，越打越快', cats: ['剑'],
    neigong: neigongOf('huashan', '绝学'), wuxue: ['cangyajianjue', 'luoxingjian'], errands: ['巡守玉女峰', '护送药材下山'],
  },
  shaolin: {
    id: 'shaolin', name: '少林', map: 1, origin: '禅武合一，刚猛正大。', signature: '棍腿刚猛，护体反震，攻守一体', cats: ['棍', '腿'],
    neigong: neigongOf('shaolin', '绝学'), wuxue: ['luohanfumogun', 'xiangmochufa'], errands: ['后山担水', '护送经卷出寺'],
  },
  tangmen: {
    id: 'tangmen', name: '唐门', map: 1, origin: '蜀中暗器，淬毒无声。', signature: '暗器淬毒，叠毒引爆，远攻为先', cats: ['暗器'],
    neigong: neigongOf('tangmen', '绝学'), wuxue: ['luoyingfeizhen', 'qianjibiao'], errands: ['采药试毒', '押送暗器出蜀'],
  },
  gaibang: {
    id: 'gaibang', name: '丐帮', map: 2, origin: '草莽豪侠，醉里狂歌。', signature: '棍拳泼辣，招式质朴，耐打耐缠', cats: ['棍', '拳'],
    neigong: null, wuxue: ['lianhualuodigun'], errands: ['城门口打探消息', '护送粮车过境'],
  },
  wudang: {
    id: 'wudang', name: '武当', map: 2, origin: '道家功夫，以柔克刚。', signature: '拳腿绵柔，以静制动，借力卸力', cats: ['拳', '腿'],
    neigong: null, wuxue: ['zhenwudangmoquan'], errands: ['洒扫紫霄宫', '下山送符'],
  },
  emei: {
    id: 'emei', name: '峨眉', map: 2, origin: '佛门清修，清冷点穴。', signature: '掌指清冷，点穴封脉，先手制敌', cats: ['掌', '指'],
    neigong: null, wuxue: ['hanchanqiqiezhang'], errands: ['金顶添灯油', '护送香客上山'],
  },
  kongtong: {
    id: 'kongtong', name: '崆峒', map: 3, origin: '西陲刀客，大漠风沙。', signature: '刀法狂放，大开大合，势大力沉', cats: ['刀'],
    neigong: null, wuxue: ['tianhedaoxuandao'], errands: ['巡哨烽燧', '押镖穿沙碛'],
  },
  yanmen: {
    id: 'yanmen', name: '雁门世家', map: 3, origin: '边关将门，枪马世家。', signature: '枪出如龙，长攻远刺，一往无前', cats: ['枪'],
    neigong: null, wuxue: ['bawangxiejiaqiang'], errands: ['操演枪阵', '巡边三日'],
  },
  baigu: {
    id: 'baigu', name: '百蛊门', map: 3, origin: '苗疆蛊毒。', signature: '掌指带蛊，毒入经脉，缠绵不绝', cats: ['掌', '指'],
    neigong: null, wuxue: ['qianshesixinzhang'], errands: ['采蛊入山', '送蛊出寨'],
  },
};

export const SECT_IDS: SectId[] = ['huashan', 'shaolin', 'tangmen', 'gaibang', 'wudang', 'emei', 'kongtong', 'yanmen', 'baigu'];
/** 按地图分组（名录 §5.3） */
export const SECT_MAPS: readonly MapId[] = [1, 2, 3];
export const sectsOnMap = (map: MapId): SectId[] => SECT_IDS.filter((id) => SECTS[id].map === map);

/** 拜入所需境界 */
export const SECT_REALM = 3;

/** 拜山传闻（spec §5.1，名录 §5.3）：突破入境界 2 时说图 1 三派；解锁图 2 / 图 3 初入时各说一次新派 */
export const RUMORS: Record<1 | 2 | 3, string> = {
  1: '华山、少林、唐门广开山门，修为至小有所成者，可往拜山。',
  2: '洛阳近郊近来热闹：丐帮、武当、峨眉的弟子都在此行走，有心拜师的，不妨去碰一碰。',
  3: '华山古道上多了几路生面孔：崆峒的刀客、雁门世家的枪手，还有自苗疆来的百蛊门人。',
};
export const RUMOR = RUMORS[1];

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

// ---------------------------------------------------------------- 贡献商店（spec §5.3，W2 绝学只换残页）

export type SectItemKind = 'neigong' | 'pages' | 'juance';

export interface SectItem {
  id: string;
  kind: SectItemKind;
  label: string;
  /** 每页 / 每件贡献 */
  price: number;
  wuxue?: WuxueId;
  /** 残页对应的式 */
  form?: number;
}

/**
 * 绝学一式一页（battle-loot/design.md §4.1）：第一式即这门武学 420，第 2–4 式每页 200，第 5–7 式每页 360；
 * 一门换齐 2,100，与旧版 7 页一式时的总价相同 [待 sim]
 */
export const SECT_PAGE_PRICE = (k: number) => (k === 1 ? 420 : k <= 4 ? 200 : 360);

/** 归真卷册的秘籍键（存 ownedScrolls） */
export const juanceKey = (ng: NeigongId) => `juance:${ng}`;

/** 本派货架，按陈列顺序：绝学内功（原三派）、各门绝学的第一式残页、各门后几式残页、归真卷册 */
export function sectShelf(id: SectId): SectItem[] {
  const d = SECTS[id];
  const page = (w: WuxueId, k: number) => ({
    id: `sect:${w}:${k}`, kind: 'pages' as const, label: WUXUE[w].name, price: SECT_PAGE_PRICE(k), wuxue: w, form: k,
  });
  return [
    ...(d.neigong ? [{ id: `sect:${d.neigong}`, kind: 'neigong' as const, label: NEIGONG[d.neigong].name, price: 600 }] : []),
    ...d.wuxue.map((w) => page(w, 1)),
    ...d.wuxue.flatMap((w) => Array.from({ length: QUALITY_PARAMS.绝学.forms - 1 }, (_, i) => page(w, i + 2))),
    ...(d.neigong ? [{ id: `sect:${juanceKey(d.neigong)}`, kind: 'juance' as const, label: '归真卷册', price: 500 }] : []),
  ];
}

/** 这门武学是不是所拜门派的本门绝学 */
export function isBenmen(sect: SectId | null, id: WuxueId): boolean {
  return sect !== null && WUXUE[id].source === SECTS[sect].name;
}
