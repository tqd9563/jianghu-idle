/**
 * 门派 —— 权威来源：docs/systems/sect-overhaul/design.md（§3 二十一家总表与兼修、§3.2 内功、§4 地位与兑换 / 装备表、
 * §5 差事六档与差事名、§6 旧九派迁移）、spec.md（§2 差事收益、§3 地位门槛、§4 货架价格、§5 门派装备）、
 * copy-draft.md §2（差事交代）。旧版拜入 / 本门小甜头仍见 sect-neigong/spec.md §5。
 * 地位按本世累计贡献升、兑换不降级；贡献每世清零，换得的武学 / 内功 / 残页永久保留。数值只从 spec 来，禁止在此调参。
 */
import { NEIGONG, type NeigongId } from './neigong';
import { QUALITY_PARAMS, WUXUE, WUXUE_IDS, type WuxueCat, type WuxueId } from './wuxue';
import type { AffixKey, GearSlot, WeaponCat } from './gear';
import type { RouteId } from './content';
import { VOLUMES } from './enemies';

export type SectId =
  | 'cangya' | 'qianfan' | 'qianshe'
  | 'qianyan' | 'huaying'
  | 'lingfeng' | 'shenhai'
  | 'qingtian' | 'huxiao' | 'beimang'
  | 'qianyuan' | 'hengjiang'
  | 'shuiyue' | 'tiangong' | 'youhuang'
  | 'zhangyue' | 'cangwu' | 'bilin'
  | 'fenglei' | 'yinshan' | 'mingsha';

export type SectSize = '大' | '中' | '小';
export type SectCamp = '正' | '邪';
/** 门派性质，决定措辞：帮、会写「入伙」，其余「拜入」 */
export type SectKind = '派' | '帮' | '会' | '教' | '寺' | '庵' | '观' | '庄' | '堡' | '坊' | '宫' | '窟' | '门' | '洞';
export const joinWord = (kind: SectKind) => (kind === '帮' || kind === '会' ? '入伙' : '拜入');

export interface SectErrand { name: string; text: string }
export interface SectGear {
  id: string;
  name: string;
  slot: GearSlot;
  cat?: WeaponCat;
  tier: 'low' | 'high';
  /** 固定一条本门特色词条（spec §5） */
  affix: AffixKey;
  /** 暂借现有名表的图键，等美术补 */
  img: string;
}

export interface SectDef {
  id: SectId;
  name: string;
  /** 拜入所在卷：该卷赶路图解锁后可拜 */
  vol: number;
  camp: SectCamp;
  size: SectSize;
  kind: SectKind;
  /** 格局档，如「七绝 · 剑」「九流」 */
  tierName: string;
  /** 核心源流 */
  route: RouteId;
  /** 擅长类目，主修在前 */
  cats: WuxueCat[];
  /** 六级地位称谓 */
  ranks: [string, string, string, string, string, string];
  /** 入门 / 进阶 / 镇派；兼修按其档位（入门 rank 1、进阶 rank 3）解锁 */
  neigong: { entry: NeigongId; adv?: NeigongId; peak?: NeigongId; extra?: { id: NeigongId; rank: 1 | 3 } };
  /** 已实装的本门绝学 */
  juexue: WuxueId[];
  /** 本门装备：低档、高档 */
  gear: [SectGear, SectGear];
  /** 六档差事，第 k 档地位 k 解锁 */
  errands: [SectErrand, SectErrand, SectErrand, SectErrand, SectErrand, SectErrand];
  /** 拜山卡上的一句气质 */
  signature: string;
}

type Six<T> = [T, T, T, T, T, T];
const errands = (names: string, texts: string[]): Six<SectErrand> =>
  names.split(' ').map((name, i) => ({ name, text: texts[i] })) as Six<SectErrand>;
const ranks = (s: string) => s.split(' ') as Six<string>;
const gear = (id: SectId, slot: GearSlot, affix: AffixKey, low: [string, string], high: [string, string], cat?: WeaponCat): [SectGear, SectGear] => [
  { id: `${id}-low`, name: low[0], slot, ...(cat ? { cat } : {}), tier: 'low', affix, img: low[1] },
  { id: `${id}-high`, name: high[0], slot, ...(cat ? { cat } : {}), tier: 'high', affix, img: high[1] },
];

export const SECTS: Record<SectId, SectDef> = {
  cangya: {
    id: 'cangya', name: '苍崖派', vol: 2, camp: '正', size: '大', kind: '派', tierName: '七绝 · 剑', route: 'huashan', cats: ['剑'],
    ranks: ranks('记名弟子 外门弟子 内门弟子 亲传弟子 护法 长老'),
    neigong: { entry: 'jingleijue', adv: 'leimingjianjing', peak: 'yuntaixinfa', extra: { id: 'feiquanjue', rank: 3 } },
    juexue: ['cangyajianjue', 'luoxingjian'],
    gear: gear('cangya', '兵器', 'crit', ['松纹剑', 'jian-qingfeng'], ['听涛剑', 'jian-longquan'], '剑'),
    errands: errands('洒扫剑冢 夜守剑阁 递送剑帖 护剑出山 把守栈道 赴论剑会', [
      '剑冢埋着历代先辈的佩剑，落叶积苔，须日日拂拭，不可惊扰。',
      '剑阁藏着本门名剑，入夜须持灯巡守，防宵小觊觎。',
      '掌门将开坛论剑，遣弟子携剑帖往江南诸派投递。',
      '一口新铸长剑要送往山下世交，沿途多有觊觎之辈。',
      '苍崖栈道是上山唯一要路，近来屡有生人窥探，须坐镇把守。',
      '江湖诸派齐聚论剑，代本门登台，胜负关乎苍崖声名。',
    ]),
    signature: '剑走刚猛，一气九叠，越斗越疾。',
  },
  qianfan: {
    id: 'qianfan', name: '千帆帮', vol: 2, camp: '正', size: '小', kind: '帮', tierName: '九流', route: 'fenxue', cats: ['棍', '拳'],
    ranks: ranks('帮众 头目 香主 舵主 堂主 长老'),
    neigong: { entry: 'chidangong', adv: 'nujiaojue' },
    juexue: [],
    gear: gear('qianfan', '兵器', 'boss', ['分水篙', 'gun-zhu'], ['镇浪铁篙', 'gun-tie'], '棍'),
    errands: errands('码头扛包 夜守漕仓 沿河收例 押船过闸 坐镇分舵 调停水路', [
      '漕船到岸，货要在天黑前卸尽，帮里人手不够，新入伙的都去扛。',
      '仓里囤着官粮，夜里老鼠和贼都多，提灯守到天明。',
      '沿河各码头按月交例钱，带上账本挨家去收，遇赖账的别动手。',
      '一船私盐要过三道闸，闸吏认钱不认人，船上的事你拿主意。',
      '下游分舵舵主病了，你去坐镇半月，帮众有事找你拿主意。',
      '两家船帮为争航道械斗，帮主遣你去说和，划下各走各的水路。',
    ]),
    signature: '水上讨生活的狠角色，棍拳泼辣，拼的是一口血气。',
  },
  qianshe: {
    id: 'qianshe', name: '千蛇窟', vol: 2, camp: '邪', size: '大', kind: '窟', tierName: '七绝 · 掌', route: 'tangmen', cats: ['掌', '指'],
    ranks: ranks('窟下弟子 执事 堂主 护法 长老 太上长老'),
    neigong: { entry: 'zheshegong', adv: 'xuanyinhuagujue', peak: 'tengshezhendian' },
    juexue: ['qianshesixinzhang', 'hanchanqiqiezhang'],
    gear: gear('qianshe', '佩饰', 'dodge', ['蛇皮手套', 'pei-yanwei'], ['乌蟒掌套', 'pei-yingyan']),
    errands: errands('投喂蛇窟 看守蛇房 入山捕蛇 押送蛇毒 驭蛇守窟 赴约斗毒', [
      '窟中养蛇千条，每日活鼠活鸡定时投喂，少一顿便躁。',
      '蛇房昼夜要人看着，温湿稍差，一屋子毒蛇便蜕不了皮。',
      '深山里有五步蛇出没，窟里要活的，带竹筒和药去捉。',
      '三瓶新炼的蛇毒要送到邻省药商手里，路上别让人碰。',
      '窟口近来有外人探头，你带群蛇守在洞前，来一个吓退一个。',
      '邻派毒师下帖斗毒，窟主点你去，输了丢的是千蛇窟的脸。',
    ]),
    signature: '毒门之首，掌指带毒，入骨难拔。',
  },
  qianyan: {
    id: 'qianyan', name: '千岩寺', vol: 3, camp: '正', size: '大', kind: '寺', tierName: '二宗', route: 'shaolin', cats: ['棍', '腿', '拳'],
    ranks: ranks('俗家弟子 沙弥 比丘 执事僧 首座 长老'),
    neigong: { entry: 'zhenyuegong', adv: 'panshigong', peak: 'putixingong', extra: { id: 'wuzhuxinfa', rank: 1 } },
    juexue: ['luohanfumogun'],
    gear: gear('qianyan', '兵器', 'boss', ['枣木禅棍', 'gun-wumu'], ['九环锡杖', 'gun-shutong'], '棍'),
    errands: errands('后山担水 经阁值夜 下山化缘 护送经卷 坐镇禅堂 主持法会', [
      '寺里百余口人吃水，全靠后山那眼泉，一天要担三十趟。',
      '藏经阁不许见火，夜里只许提一盏罩灯，巡到五更。',
      '托钵下山，走遍山下十八村，化来的米粮都是寺里冬粮。',
      '一部孤本要送往京城名刹抄录，路上风雨刀兵都得挡在经外。',
      '方丈闭关，你代坐禅堂，门下僧众的大小争执都来问你。',
      '岁末水陆法会，四方香客云集，你代寺中出面主持七日。',
    ]),
    signature: '禅武合一，守中带攻，刚柔并济。',
  },
  huaying: {
    id: 'huaying', name: '花影坊', vol: 3, camp: '邪', size: '中', kind: '坊', tierName: '五秀', route: 'xuanji', cats: ['暗器', '掌'],
    ranks: ranks('侍儿 坊中弟子 执事 花使 护法 长老'),
    neigong: { entry: 'jinghuajue', adv: 'hanxianggong' },
    juexue: ['luoyingfeizhen', 'qianjibiao'],
    gear: gear('huaying', '暗器', 'hit', ['蝶影镖', 'anqi-liuye'], ['海棠针匣', 'anqi-meihua']),
    errands: errands('调制迷香 守夜花楼 入城打探 运送胭脂 主理分坊 结交权贵', [
      '坊中迷香用罢，照方子配一炉新的，分量错一钱便伤人。',
      '花楼夜里客多，总有人借酒撒泼，你守在楼下，别惊了客人。',
      '城里新来一位巡按，坊主要知道他的来历脾性，你去听一听。',
      '一车胭脂香粉运往邻城，货里夹着什么，你不必问。',
      '邻城分坊的花使告病，你去主理一季，账目和人都归你管。',
      '知府寿宴，坊主遣你带礼去赴，席间要把话递到他耳边。',
    ]),
    signature: '迷香惑人，暗器无声，先手制敌。',
  },
  lingfeng: {
    id: 'lingfeng', name: '凌风山庄', vol: 4, camp: '正', size: '中', kind: '庄', tierName: '八奇', route: 'jinghong', cats: ['腿', '剑'],
    ranks: ranks('庄客 门客 管事 总管 供奉 客卿'),
    neigong: { entry: 'lingxugong', adv: 'fuyaojue' },
    juexue: [],
    gear: gear('lingfeng', '佩饰', 'dodge', ['踏云靴', 'pei-taxue'], ['鹤羽战靴', 'pei-baiyu']),
    errands: errands('庄前迎客 夜巡庄院 递送拜帖 迎送贵客 坐镇别院 广宴群雄', [
      '庄主好客，门前来客不问贵贱，一律由你迎进厅中奉茶。',
      '庄院占地百亩，夜里提灯巡一圈要一个时辰，角门都得看过。',
      '庄主要拜访邻近几家名宿，拜帖由你亲手送到，不可托人。',
      '一位旧友携眷来庄，你去山下接，走时再送过前面那道险坡。',
      '庄主外出，城中别院交你坐镇，来客一应由你接待。',
      '庄主设英雄宴，宴请各路豪杰，你代庄中出面周旋席间。',
    ]),
    signature: '轻功卓绝，腿剑来去如风。',
  },
  shenhai: {
    id: 'shenhai', name: '蜃海教', vol: 4, camp: '邪', size: '大', kind: '教', tierName: '三教', route: 'taixu', cats: ['掌', '暗器'],
    ranks: ranks('教众 香主 坛主 堂主 护法 长老'),
    neigong: { entry: 'tingchaojue', adv: 'shenqihuaxugong', peak: 'guixudafa' },
    juexue: [],
    gear: gear('shenhai', '佩饰', 'dodge', ['鲨皮手套', 'pei-hongsheng'], ['鲛绡手套', 'pei-baiyu']),
    errands: errands('海边采珠 守夜灯塔 出海寻蜃 押送珠贡 镇守海岛 海上会盟', [
      '教中以珠换粮，退潮时下海采珠，潮涨前必须上岸。',
      '礁上灯塔一夜不能灭，教中船只全靠它认路回港。',
      '海上有蜃气出没之处，教主要人去寻，寻到了记下方位。',
      '一箱珍珠要渡海送到岸上官府，海盗和官差都盯着这箱。',
      '外岛分坛坛主殁了，你去镇守，岛上教众听你号令。',
      '几家海上势力约在孤岛会盟，教主遣你代教中赴会。',
    ]),
    signature: '海上幻术，虚实难辨，借力化劲。',
  },
  qingtian: {
    id: 'qingtian', name: '擎天门', vol: 5, camp: '正', size: '大', kind: '门', tierName: '七绝 · 棍', route: 'shaolin', cats: ['棍'],
    ranks: ranks('记名弟子 外门弟子 内门弟子 亲传弟子 护法 长老'),
    neigong: { entry: 'yuezhigong', adv: 'budongmingwangjue', peak: 'jiudingzhenjing' },
    juexue: ['xiangmochufa', 'lianhualuodigun'],
    gear: gear('qingtian', '兵器', 'boss', ['镇山棍', 'gun-bintie'], ['天柱铁棍', 'gun-zhenyue'], '棍'),
    errands: errands('搬运山石 山门守夜 采买粮米 押送铁料 下山剿匪 调停纷争', [
      '门中要修新练武场，后山的石料全靠弟子一块块扛下来。',
      '擎天门山门高峻，夜里风大，守夜的弟子一班两个时辰。',
      '门中百人吃用，每月下山采买一次，粮米油盐都要你去讲价。',
      '打造铁棍的精铁从山下铁坊运来，一路山道，货不能落地。',
      '山下有股悍匪劫道，门主点你带几个师弟去剿。',
      '两家小门派为一处矿脉闹翻，都请擎天门主持公道，你代门出面。',
    ]),
    signature: '铁棍如柱，守中带攻，势如山岳。',
  },
  huxiao: {
    id: 'huxiao', name: '虎啸山庄', vol: 5, camp: '正', size: '大', kind: '庄', tierName: '七绝 · 拳', route: 'huashan', cats: ['拳'],
    ranks: ranks('庄客 门客 管事 总管 供奉 客卿'),
    neigong: { entry: 'fenghuxinfa', adv: 'hupogong', peak: 'baihuxiaofengjing' },
    juexue: [],
    gear: gear('huxiao', '佩饰', 'dodge', ['铜环护腕', 'pei-tongqian'], ['白额拳套', 'pei-yingyan']),
    errands: errands('后山劈柴 看守兵房 进城采办 押运药材 驱除虎患 登台守擂', [
      '庄里灶多，柴火一日不够烧，新来的先去后山劈一冬的柴。',
      '兵房里的拳套铁砂袋都是前辈用过的，夜里要人守着。',
      '庄里的药酒要买城里一家老铺的，你去采办，顺便听听市面。',
      '一车虎骨药材运往药行，路上有人惦记，别让货少了。',
      '山下村里来报，有猛虎伤人，庄主遣你去除了这患。',
      '庄主在城中设擂三日，你代庄守擂，来者不论门派都接。',
    ]),
    signature: '拳势刚猛，虎啸风生。',
  },
  beimang: {
    id: 'beimang', name: '北邙门', vol: 5, camp: '邪', size: '小', kind: '门', tierName: '八奇', route: 'shaolin', cats: ['掌'],
    ranks: ranks('门下弟子 执事 堂主 护法 长老 太上长老'),
    neigong: { entry: 'dishagong', adv: 'zhenmingxinjing' },
    juexue: [],
    gear: gear('beimang', '佩饰', 'dodge', ['鹿皮手套', 'pei-xiangnang'], ['金缕手套', 'pei-feicui']),
    errands: errands('清理墓道 夜巡乱坟 收买墓图 押运冥器 坐镇义庄 打点官府', [
      '新开的墓道塌了半截，土石要一筐筐运出去，别惊了里头的东西。',
      '北邙乱坟岗夜里不太平，巡一圈，看有没有别家来盗。',
      '有个落魄道士手里有张古墓图，门主要你去把它买下来。',
      '一批出土冥器要运去出手，路上官差盘查，东西不能见光。',
      '城外义庄是门里的暗桩，你去坐镇一月，来往的人和货都经你手。',
      '新任县令盯上了北邙，门主遣你带礼去打点，话要说得圆。',
    ]),
    signature: '掘墓镇阴，功夫厚重阴沉。',
  },
  qianyuan: {
    id: 'qianyuan', name: '乾元观', vol: 6, camp: '正', size: '大', kind: '观', tierName: '二宗', route: 'taixu', cats: ['拳', '腿'],
    ranks: ranks('记名弟子 道童 道人 真传弟子 监院 长老'),
    neigong: { entry: 'shouyigong', adv: 'qingjingzuowangjue', peak: 'qianyuanyiqijing', extra: { id: 'zifuxinfa', rank: 3 } },
    juexue: ['zhenwudangmoquan'],
    gear: gear('qianyuan', '佩饰', 'dodge', ['青布护腕', 'pei-pingan'], ['紫绶护腕', 'pei-hongsheng']),
    errands: errands('洒扫丹房 夜守丹炉 云游采药 送经下山 坐镇下院 主持斋醮', [
      '丹房一尘不染才能开炉，每日卯时洒扫，不许用湿布。',
      '炉火不能断，夜里添炭添水，守到天明才能换人。',
      '观中炼丹的几味药只长在远山，背上药篓去走一趟。',
      '一部道经要送往山下道院，经书不能沾水，更不能落在外人手里。',
      '山下道院的监院告假，你去坐镇一季，香火和道众都归你管。',
      '城中大户请观里做一场斋醮，观主遣你代为主持。',
    ]),
    signature: '道家柔功，清静坐忘，以柔克刚。',
  },
  hengjiang: {
    id: 'hengjiang', name: '横江会', vol: 6, camp: '邪', size: '小', kind: '会', tierName: '九流', route: 'fenxue', cats: ['刀'],
    ranks: ranks('会众 头目 香主 舵主 堂主 长老'),
    neigong: { entry: 'chilangjue', adv: 'xueshagong' },
    juexue: [],
    gear: gear('hengjiang', '兵器', 'atk', ['分浪刀', 'dao-liuye'], ['覆舟刀', 'dao-zhanma'], '刀'),
    errands: errands('刷洗船板 江口放哨 收过路钱 夜劫盐船 坐守水寨 周旋官军', [
      '会里的快船刚回来，船板上的血和鱼腥得趁天亮刷干净。',
      '江口礁上有个哨位，看见官船就点狼烟，看见肥船也点。',
      '过横江的商船按货抽成，你带两条小船去收，不给的扣船。',
      '一队盐船今夜过江，会主要你带人截下来，货到手人放走。',
      '江心水寨是会里根本，你去坐守，寨中大小事都由你定。',
      '官军要来清江，会主遣你去和带兵的谈，谈出个各不相犯。',
    ]),
    signature: '江上劫船的狠角色，刀快血热。',
  },
  shuiyue: {
    id: 'shuiyue', name: '水月庵', vol: 8, camp: '正', size: '中', kind: '庵', tierName: '五秀', route: 'xuanji', cats: ['指', '掌'],
    ranks: ranks('俗家弟子 沙弥尼 比丘尼 知客 首座 长老'),
    neigong: { entry: 'zhishuixinfa', adv: 'shuiyueguanxinjing' },
    juexue: [],
    gear: gear('shuiyue', '佩饰', 'dodge', ['羊脂指环', 'pei-baiyu'], ['玉莲扳指', 'pei-feicui']),
    errands: errands('抄写经卷 佛前守灯 山下施药 接引香客 坐镇佛堂 法会讲经', [
      '庵中经卷旧了，要抄一部新的，一日抄三页，错一字重来。',
      '佛前长明灯不能灭，夜里添油剔芯，守到晨钟。',
      '山下村里时疫，庵里熬了药，你挑下去挨户施。',
      '香期将至，上山的香客多是老弱，你在半山接引，一路照应。',
      '庵主闭关，你代坐佛堂，来求签问事的香客由你应答。',
      '邻寺办法会，请庵中去讲一部经，庵主遣你去讲。',
    ]),
    signature: '清修封脉，指法点穴，冷而准。',
  },
  tiangong: {
    id: 'tiangong', name: '天工坊', vol: 8, camp: '正', size: '小', kind: '坊', tierName: '八奇', route: 'jinghong', cats: ['暗器'],
    ranks: ranks('学徒 匠人 大匠 掌墨 总管 供奉'),
    neigong: { entry: 'linglongxinfa', adv: 'tianshujue' },
    juexue: [],
    gear: gear('tiangong', '暗器', 'hit', ['机簧袖弩', 'anqi-xiujian'], ['九星弩匣', 'anqi-tougu']),
    errands: errands('打磨机件 看守料库 进城修弩 押送机弩 督造城防 进京献器', [
      '新铸的机括毛刺多，一件件磨到严丝合缝，手不能抖。',
      '料库里有精铁和火药，夜里不许见明火，守着别让人靠近。',
      '城里武馆的几架弩坏了，带上工具去修，修不好别收钱。',
      '十架新制机弩要送到买家手里，路上图纸和弩都不能丢。',
      '州城要修城防机关，坊主遣你去督造，工期三月。',
      '坊里造了件新器，要进京献给工部，由你带着去。',
    ]),
    signature: '机关暗器，手快心细。',
  },
  youhuang: {
    id: 'youhuang', name: '幽篁宫', vol: 8, camp: '邪', size: '中', kind: '宫', tierName: '五秀', route: 'taixu', cats: ['指', '剑'],
    ranks: ranks('侍儿 宫中弟子 执事 宫使 护法 长老'),
    neigong: { entry: 'konghuanggong', adv: 'wanhuangguixujue' },
    juexue: [],
    gear: gear('youhuang', '佩饰', 'dodge', ['竹节指套', 'pei-yanwei'], ['湘妃竹指套', 'pei-qingyu']),
    errands: errands('清扫竹径 竹林巡夜 入山采竹 随使出山 竹海布阵 赴约比剑', [
      '宫前竹径落叶日积，每日清扫，不许惊动林中蛇虫。',
      '竹海夜里雾大，巡夜的提灯走一圈，看竹阵有没有被人动过。',
      '宫中竹剑竹箫要用深山的老竹，你去寻合适的砍回来。',
      '宫使要出山办事，你随行护卫，一路上她的话就是宫主的话。',
      '竹海外围的阵法要重新布过，你带人按图挪竹移石。',
      '邻派下帖比剑，宫主点你去，比的是剑，不许伤人。',
    ]),
    signature: '竹影无定，指剑飘忽，来去难测。',
  },
  zhangyue: {
    id: 'zhangyue', name: '瘴月教', vol: 9, camp: '邪', size: '大', kind: '教', tierName: '三教', route: 'tangmen', cats: ['掌', '指'],
    ranks: ranks('教众 香主 坛主 堂主 护法 长老'),
    neigong: { entry: 'shiguxinfa', adv: 'xuanyinjue', peak: 'qianguxinjue', extra: { id: 'xueguranyuangong', rank: 3 } },
    juexue: [],
    gear: gear('zhangyue', '佩饰', 'dodge', ['银丝手套', 'pei-hongsheng'], ['苗银掌套', 'pei-yingyan']),
    errands: errands('喂养蛊虫 看守蛊坛 瘴林采毒 押送蛊种 执掌分坛 召集各寨', [
      '教中蛊虫以血喂养，每日定时放血入盅，一滴不能多。',
      '蛊坛里养着教中根本，守坛的不许睡，也不许靠近坛口。',
      '瘴林深处有几味毒草，雾散前进去，雾起前出来。',
      '一盅蛊种要送到外寨，路上颠不得、晒不得，更见不得生人。',
      '外寨分坛坛主出缺，你去执掌，寨中教众都听你的。',
      '教主要议大事，你持教主令箭走遍各寨，召各寨主来聚。',
    ]),
    signature: '以蛊养血，以血饲蛊，毒入经脉。',
  },
  cangwu: {
    id: 'cangwu', name: '苍梧派', vol: 9, camp: '正', size: '大', kind: '派', tierName: '七绝 · 枪', route: 'jinghong', cats: ['枪'],
    ranks: ranks('记名弟子 外门弟子 内门弟子 亲传弟子 护法 长老'),
    neigong: { entry: 'qiwujue', adv: 'fengmingxinjing', peak: 'fengzhuqingminggong' },
    juexue: ['bawangxiejiaqiang'],
    gear: gear('cangwu', '兵器', 'hit', ['青梧枪', 'qiang-bailayan'], ['凤喙枪', 'qiang-longdan'], '枪'),
    errands: errands('擦拭枪架 校场值守 采办枪杆 押粮南下 戍守岭南 出使南诏', [
      '校场枪架上百杆长枪，每日擦净上油，锈一杆罚一月。',
      '校场夜里要人守，枪械不能少一件，也不许外人进来练。',
      '枪杆要用岭南的白蜡木，你去木场挑，弯的虫蛀的都不要。',
      '一队粮车要送往南边驻军，派里接了这趟镖，由你押。',
      '岭南分舵近来不太平，掌门遣你去戍守，有事可自行决断。',
      '南诏王请中原枪派去交流，掌门遣你代派出使。',
    ]),
    signature: '枪出连环，百鸟朝凤，一往无前。',
  },
  bilin: {
    id: 'bilin', name: '碧磷洞', vol: 9, camp: '邪', size: '中', kind: '洞', tierName: '六隐', route: 'tangmen', cats: ['指', '暗器'],
    ranks: ranks('洞下弟子 执事 堂主 护法 长老 太上长老'),
    neigong: { entry: 'guilinjue', adv: 'jiuyouhuadujing' },
    juexue: [],
    gear: gear('bilin', '佩饰', 'dodge', ['枯骨指环', 'pei-tongqian'], ['碧磷扳指', 'pei-feicui']),
    errands: errands('添灯守洞 看守毒池 入沼采磷 押送毒药 封守洞口 受托解毒', [
      '洞中长年无光，壁灯一灭就辨不得路，每隔一个时辰添一回油。',
      '毒池的气熏人，守池的要带药，也要防着有人来偷池水。',
      '沼泽里有磷火处必有磷石，夜里去采，天亮前回。',
      '一箱毒药要送到买家手里，路上封得再严也别让人闻见。',
      '近来有外人寻到洞口，洞主要你带人把洞口封住、守住。',
      '一位大人物中了奇毒，重金来求，洞主遣你去解，解得了再谈价。',
    ]),
    signature: '隐世毒门，鬼磷照骨，凭因缘才拜得。',
  },
  fenglei: {
    id: 'fenglei', name: '风雷堡', vol: 10, camp: '正', size: '大', kind: '堡', tierName: '七绝 · 刀', route: 'huashan', cats: ['刀'],
    ranks: ranks('堡丁 刀客 教头 统领 总教头 客卿'),
    neigong: { entry: 'yinleijue', adv: 'bentinggong', peak: 'leigangzhenjing' },
    juexue: [],
    gear: gear('fenglei', '兵器', 'atk', ['惊霆刀', 'dao-guitou'], ['奔雷刀', 'dao-longque'], '刀'),
    errands: errands('喂马刷马 堡墙值哨 采买刀铁 押镖西行 塞外巡边 护送使节', [
      '堡里战马百匹，草料一日三顿，马鬃马蹄都要刷到。',
      '堡墙上风沙大，值哨的裹好头脸，看见马队就敲梆。',
      '堡中打刀的铁要去关内铁坊买，你带银子去，货要验过再付。',
      '一趟镖要出关西行，沙匪多，堡主点你押。',
      '堡主与边军有约，每月派人出关巡边一趟，这回轮到你。',
      '朝廷使节要出关，边军请风雷堡派人护送，堡主遣你去。',
    ]),
    signature: '塞上刀客，刀势如雷，大开大合。',
  },
  yinshan: {
    id: 'yinshan', name: '阴山派', vol: 10, camp: '邪', size: '大', kind: '派', tierName: '七绝 · 指', route: 'xuanji', cats: ['指'],
    ranks: ranks('记名弟子 外门弟子 内门弟子 亲传弟子 护法 长老'),
    neigong: { entry: 'shuanghuajue', adv: 'hanposuomaigong', peak: 'guijizhenjing' },
    juexue: [],
    gear: gear('yinshan', '佩饰', 'dodge', ['寒铁指套', 'pei-qingyu'], ['寒玉扳指', 'pei-baiyu']),
    errands: errands('凿冰取水 守夜冰窟 雪原采药 押送寒铁 扼守关口 递送战书', [
      '阴山冬天泉眼都冻住了，每日凿冰取水，手冻裂了也得凿。',
      '冰窟里藏着本门的东西，夜里守着，冷也得守。',
      '雪莲只长在雪线以上，带上绳索和干粮去采，三日内回。',
      '一箱寒铁要从北边运回山，路上风雪和劫道的都要防。',
      '阴山关口是北上要道，掌门遣你带人扼守，来往的都盘问。',
      '一家仇门欺到山门，掌门写了战书，由你亲自送到对方手里。',
    ]),
    signature: '指绝天下，寒魄锁脉，一指封喉。',
  },
  mingsha: {
    id: 'mingsha', name: '鸣沙教', vol: 10, camp: '邪', size: '大', kind: '教', tierName: '三教', route: 'fenxue', cats: ['刀', '拳'],
    ranks: ranks('教众 香主 坛主 堂主 护法 长老'),
    neigong: { entry: 'xueshajue', adv: 'yanyanggong', peak: 'darixiuluoxuedian' },
    juexue: ['tianhedaoxuandao'],
    gear: gear('mingsha', '兵器', 'atk', ['赤沙弯刀', 'dao-yanling'], ['大食弯刀', 'dao-miao'], '刀'),
    errands: errands('添油护火 夜守火坛 沙海寻水 护送驼队 镇守绿洲 出使西域', [
      '教中圣火不灭，每隔一个时辰添一次油，风大时还要遮挡。',
      '火坛夜里要人守，风沙一起火就要灭，守坛的不能离开半步。',
      '教中要在沙海里开一条新路，你先去找水，找到了做记号。',
      '一支驼队要穿沙海，教里接了护送的活，由你带人走一趟。',
      '沙海深处的绿洲分坛坛主殁了，你去镇守，水和粮都归你管。',
      '西域诸国有请，教主遣你代教出使，带上教中的礼和话。',
    ]),
    signature: '烈日熔金，血沙炎阳，愈战愈狂。',
  },
};

export const SECT_IDS = Object.keys(SECTS) as SectId[];
/** 有门派可拜的卷（卷一、卷七没有） */
export const SECT_VOLS: readonly number[] = [2, 3, 4, 5, 6, 8, 9, 10];
export const sectsInVol = (vol: number): SectId[] => SECT_IDS.filter((id) => SECTS[id].vol === vol);

/** 拜入所需境界 */
export const SECT_REALM = 3;

/** 拜山传闻（sect-neigong/spec.md §5.1）：突破入境界 2 时说卷二三家；首次解锁某卷赶路图时说这一卷的 */
export function rumorOf(vol: number): string {
  const names = sectsInVol(vol).map((id) => SECTS[id].name).join('、');
  if (vol === 2) return `${names}广开山门，修为至小有所成者，可往拜山。`;
  return `${VOLUMES[vol - 1].region}一带近来热闹：${names}的弟子都在此行走，有心拜师的，不妨去碰一碰。`;
}
export const RUMOR = rumorOf(2);

// ---------------------------------------------------------------- 地位与差事（spec §2 / §3）

/** 累计贡献到第 k 级的门槛（下标 k − 1）：每级约 1.25 天 */
export const RANK_THRESHOLDS = [0, 250, 650, 1300, 2300, 3900] as const;
export const RANK_MAX = RANK_THRESHOLDS.length;
/** 本世累计贡献对应的地位（1–6） */
export const rankOf = (contribTotal: number) => RANK_THRESHOLDS.filter((t) => contribTotal >= t).length;

/** 六档差事每时贡献（2 小时档）；8 小时档七五折 */
export const SECT_TIER_RATE = [20, 32, 50, 80, 130, 200] as const;
export type SectTier = 1 | 2 | 3 | 4 | 5 | 6;
export type SectHours = 2 | 8;
export const SECT_HOURS: readonly SectHours[] = [2, 8];
export const sectTaskGain = (tier: SectTier, hours: SectHours) =>
  Math.round(SECT_TIER_RATE[tier - 1] * hours * (hours === 8 ? 0.75 : 1));

/** 同时只跑一件；到时自动结算，离线照常计时 */
export interface SectTask {
  tier: SectTier;
  hours: SectHours;
  /** 结束时刻（墙钟毫秒） */
  endsAt: number;
}

// ---------------------------------------------------------------- 货架（design §4，spec §4；W2 绝学只换残页）

export type SectItemKind = 'wuxue' | 'pages' | 'neigong' | 'gear' | 'juance';

export interface SectItem {
  id: string;
  kind: SectItemKind;
  label: string;
  /** 每页 / 每件贡献 */
  price: number;
  /** 解锁地位 */
  rank: number;
  wuxue?: WuxueId;
  /** 残页对应的式 */
  form?: number;
  neigong?: NeigongId;
  gear?: SectGear;
}

/** 上乘残页：第一式 160、第 2–5 式 80；绝学残页：第一式 800、第 2–4 式 400、第 5–7 式 600 */
export const SECT_PAGE_PRICE = (quality: '上乘' | '绝学', k: number) =>
  quality === '上乘' ? (k === 1 ? 160 : 80) : k === 1 ? 800 : k <= 4 ? 400 : 600;
export const SECT_PRICE = { wuxue: 100, entry: 200, lowGear: 480, adv: 1000, peak: 1950, highGear: 1300, juance: 1300 } as const;

/** 归真卷册的秘籍键（存 ownedScrolls） */
export const juanceKey = (ng: NeigongId) => `juance:${ng}`;

/** 主修类目下挂机来路的武学，按名录顺序取前 n 门 */
const idleWuxueOf = (cat: WuxueCat, quality: '寻常' | '上乘', n: number): WuxueId[] =>
  WUXUE_IDS.filter((id) => WUXUE[id].cat === cat && WUXUE[id].quality === quality && WUXUE[id].source === '挂机').slice(0, n);

/** 本派货架，按解锁地位陈列：寻常整门与入门内功；上乘残页与低档装备；进阶内功；绝学残页；镇派内功、高档装备、归真卷册 */
export function sectShelf(id: SectId): SectItem[] {
  const d = SECTS[id];
  const ng = (n: NeigongId, price: number, rank: number): SectItem => ({ id: `sect:${n}`, kind: 'neigong', label: NEIGONG[n].name, price, rank, neigong: n });
  const pages = (w: WuxueId, quality: '上乘' | '绝学', rank: number): SectItem[] =>
    Array.from({ length: QUALITY_PARAMS[quality].forms }, (_, i) => ({
      id: `sect:${w}:${i + 1}`, kind: 'pages' as const, label: WUXUE[w].name, price: SECT_PAGE_PRICE(quality, i + 1), rank, wuxue: w, form: i + 1,
    }));
  const gearRow = (g: SectGear, price: number, rank: number): SectItem => ({ id: `sect:gear:${g.id}`, kind: 'gear', label: g.name, price, rank, gear: g });
  const extra = d.neigong.extra;
  return [
    ...idleWuxueOf(d.cats[0], '寻常', 2).map((w): SectItem => ({ id: `sect:${w}:book`, kind: 'wuxue', label: WUXUE[w].name, price: SECT_PRICE.wuxue, rank: 1, wuxue: w })),
    ng(d.neigong.entry, SECT_PRICE.entry, 1),
    ...(extra?.rank === 1 ? [ng(extra.id, SECT_PRICE.entry, 1)] : []),
    ...idleWuxueOf(d.cats[0], '上乘', 2).flatMap((w) => pages(w, '上乘', 2)),
    gearRow(d.gear[0], SECT_PRICE.lowGear, 2),
    ...(d.neigong.adv ? [ng(d.neigong.adv, SECT_PRICE.adv, 3)] : []),
    ...(extra?.rank === 3 ? [ng(extra.id, SECT_PRICE.adv, 3)] : []),
    ...d.juexue.flatMap((w) => pages(w, '绝学', 4)),
    ...(d.neigong.peak ? [ng(d.neigong.peak, SECT_PRICE.peak, 5)] : []),
    gearRow(d.gear[1], SECT_PRICE.highGear, 5),
    ...(d.neigong.peak ? [{ id: `sect:${juanceKey(d.neigong.peak)}`, kind: 'juance' as const, label: '归真卷册', price: SECT_PRICE.juance, rank: 5, neigong: d.neigong.peak }] : []),
  ];
}

/** 这门武学是不是所拜门派的本门绝学 */
export function isBenmen(sect: SectId | null, id: WuxueId): boolean {
  return sect !== null && SECTS[sect].juexue.includes(id);
}
