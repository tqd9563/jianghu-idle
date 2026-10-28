/**
 * 江湖编年 —— 活江湖第一期批四（docs/systems/living-jianghu/design.md §2.4 D13）。
 *
 * 两类条目：
 *   玩家的事 —— 存档里按世存结构化记录（LifeRec.events：何年、何事、对手是谁），句子在显示时套模板生成；
 *   江湖的事 —— 不存，由名册推演（roster.ts termsUntil）：首领卒 / 退隐、被玩家击败的人换人。
 * 结构化而非存句子，是为了以后「江湖变局」能直接拿这些事实当触发条件（BACKLOG）。
 *
 * 口吻：编年体、半文半白、第三人称，用字即立场（正派「过」「让位」，邪派「破」「伏诛」）。
 * 本模块纯函数，禁止引入 UI / 存储依赖。
 */
import lib from './data/roster-names.json';
import data from './data/chronicle.json';
import lineData from './data/stage-line.json';
import { ALL_POSTS, factionStyle, pickOf, postById, rngOf, termsUntil, type PostDef, type RosterKill, type Term } from './roster';

// ─────────────────────────────────────────────────────────────
// 每世的姓名、籍贯与名号
// ─────────────────────────────────────────────────────────────

type WeaponCat = '剑' | '刀' | '枪' | '棍' | '拳' | '掌' | '指' | '腿' | '暗器';
export type DeathKind = 'old' | 'battle' | 'retire';

/** 玩家这一世做下的一件事（只存事实，不存句子） */
export type ChronEv =
  /** 击败岗位上的人：who 记下当时在任者的显示名；hao 为此战得的名号 */
  | { k: 'beat'; y: number; post: string; map: number; who: string; hao?: string }
  | { k: 'sect'; y: number; sect: string }
  | { k: 'realm'; y: number; realm: number };

export interface LifeRec {
  run: number;
  name: string;
  female: boolean;
  origin: string;
  /** 出生年（本世 eraStart，整数） */
  born: number;
  hao?: string;
  /** 本世到过的卷（据此只记这些地方的首领更替） */
  vols: number[];
  events: ChronEv[];
  end?: { year: number; age: number; cause: DeathKind; place: string };
}

const PLACES = data.places as Record<string, string[]>;
const ALL_PLACES = Object.values(PLACES).flat();
const VOLUMES = lineData.volumes as { no: number; region: string }[];
const MAPS = lineData.maps as { id: number; vol: number; layer: string; name: string; faction: string | null }[];
export const regionOfVol = (vol: number): string => VOLUMES[Math.min(Math.max(vol, 1), VOLUMES.length) - 1].region;
/** 某卷的代表州县（卒于何地） */
export const placeOfVol = (vol: number): string => PLACES[regionOfVol(vol)][0];
const regionOfPlace = (place: string): string => Object.keys(PLACES).find((r) => PLACES[r].includes(place)) ?? '江湖';

/** 第 run 世的姓名、籍贯：由世界种子推出，约四分之一的世是女子；第一世固定泰安人 */
export function lifeIdentity(seed: number, run: number): { name: string; female: boolean; origin: string } {
  const r = rngOf(seed, 'life', run);
  const p = pickOf(r);
  const female = run > 1 && r() < 0.25;
  const sur = r() < 0.06 ? p(lib.compoundSurnames) : p(lib.surnames);
  const G = lib.given;
  const given = female ? p(G.nv.first) + p(G.nv.second) : r() < 0.2 ? p(G.ya.single) : p(G.ya.first) + p(G.ya.second);
  const name = sur + given;
  return { name, female, origin: run === 1 ? '泰安' : p(ALL_PLACES) };
}

export function newLife(seed: number, run: number, born: number): LifeRec {
  return { run, ...lifeIdentity(seed, run), born: Math.floor(born), vols: [1], events: [] };
}

const NP = lib.nickParts;
type Pool = Record<string, Record<string, WeaponCat[]>>;
const fits = (tbl: Record<string, WeaponCat[]>, cat: WeaponCat) => Object.keys(tbl).filter((k) => tbl[k].includes(cat));

/**
 * 名号（正派绰号骨架，按这一世胜场最多的那类兵器）：
 * 打穿门户得「流云剑」式（意象 + 兵器），以弱胜强得「快剑浪子」式（单字 + 兵器 + 身份）。
 */
export function makeHao(seed: number, run: number, cat: WeaponCat, female: boolean, how: 'gate' | 'upset'): string {
  const r = rngOf(seed, 'hao', run);
  const p = pickOf(r);
  const F = female ? 'F' : '';
  const w = p((NP.weapon as Record<WeaponCat, string[]>)[cat]);
  const p2 = fits((NP.prefix2 as Pool)['正' + F], cat);
  const p1 = fits((NP.prefix1 as Pool)['正' + F], cat);
  const one = p1.length ? p(p1) : '铁';
  if (how === 'gate') return (p2.length ? p(p2) : one) + w;
  const persona = female ? (NP.persona as Record<string, string[]>)['正F'] : ['浪子', '狂客', '行者'];
  return one + w + p(persona);
}

// ─────────────────────────────────────────────────────────────
// 句子
// ─────────────────────────────────────────────────────────────

/** 编年条目的类别（DESIGN.md「势力与编年类别」）：me 玩家、big 江湖大事 */
export type ChronCat = 'me' | 'zheng' | 'xie' | 'court' | 'jh' | 'big';
export interface ChronLine {
  /** 江湖历年份（带小数，折季节） */
  y: number;
  cat: ChronCat;
  text: string;
  /** 醒来演出里用墨金标出的名字（被玩家击败过的人） */
  mark?: string;
}

const D = '〇一二三四五六七八九';
/** 中文数字（1–999） */
export function cnNum(n: number): string {
  const h = Math.floor(n / 100), t = Math.floor((n % 100) / 10), o = n % 10;
  return (h ? D[h] + '百' : '') + (t ? (t === 1 && !h ? '' : D[t]) + '十' : h && o ? '零' : '') + (o ? D[o] : '');
}
export const seasonOf = (y: number): string => (Number.isInteger(y) ? '' : '春夏秋冬'[Math.min(3, Math.floor((y % 1) * 4))]);

/** 势力在编年里的类别：世家、帮会归「江湖」，官军归「朝廷」 */
export function campCat(faction: string): ChronCat {
  const fs = factionStyle(faction);
  if (!fs) return 'jh';
  if (fs.style === 'jun') return 'court';
  if (fs.style === 'clan' || faction.endsWith('帮') || faction.endsWith('会')) return 'jh';
  return fs.camp === '正' ? 'zheng' : 'xie';
}

const label = (rec: Pick<LifeRec, 'name' | 'hao'>) => (rec.hao ?? '') + rec.name;
const REALM_LINE: Record<number, string> = {
  5: '跻身一流高手之列，名动一方',
  6: '开宗立说，江湖尊为一代宗师',
  7: '武功登峰造极，天下罕有敌手',
};

function beatText(n: string, post: PostDef, mapName: string, who: string): string {
  const fs = factionStyle(post.faction)!;
  const f = post.faction;
  const gate = post.slot === 2 || post.slot === 3;
  if (fs.style === 'jun') return gate ? `${n}破${mapName}，镇关军${post.title}${who}去职。` : `${n}闯${mapName}，镇关军${post.title}${who}不敌。`;
  if (fs.camp === '邪') return `${n}破${f}${mapName}，${post.title}${who}${post.slot === 3 ? '伏诛' : '败走'}。`;
  return gate ? `${n}破${f}门户，${post.title}${who}让位。` : `${n}过${f}外客试炼，${mapName}${post.title}${who}让位闭关。`;
}

/** 这一世玩家自己的事（入世、击败镇守与门户、拜入、高境界、一世终了），按年先后 */
export function lifeLines(rec: LifeRec): ChronLine[] {
  const out: ChronLine[] = [{ y: rec.born + 0.05, cat: 'me', text: `${rec.origin}${rec.female ? '女子' : '少年'}${rec.name}，年十八，始入江湖。` }];
  let hao: string | undefined;
  for (const e of rec.events) {
    const n = (hao ?? '') + rec.name;
    if (e.k === 'beat') {
      const post = postById(e.post);
      const m = MAPS.find((x) => x.id === e.map);
      if (!post || !m) continue;
      let text = beatText(n, post, m.name, e.who);
      if (e.hao) { hao = e.hao; text += `江湖始称「${e.hao}${rec.name}」。`; }
      out.push({ y: e.y, cat: 'me', text });
    } else if (e.k === 'sect') {
      // 帮、会写「入」，其余「投……门下」
      out.push({ y: e.y, cat: 'me', text: /[帮会]$/.test(e.sect) ? `${n}入${e.sect}。` : `${n}投${e.sect}门下。` });
    } else if (REALM_LINE[e.realm]) {
      out.push({ y: e.y, cat: 'me', text: `${n}${REALM_LINE[e.realm]}。` });
    }
  }
  if (rec.end) {
    const l = label(rec), { place, age, cause } = rec.end;
    const text = cause === 'battle' ? `${l}殁于${place}，年${cnNum(age)}。`
      : cause === 'old' ? `${l}卒于${place}，年${cnNum(age)}。`
      : `${l}归隐${place}，不知所终。`;
    out.push({ y: rec.end.year - 0.01, cat: 'me', text });
  }
  return out;
}

/** 首领卒的字：佛门圆寂、道门羽化 */
const deathWord = (faction: string) => {
  const st = factionStyle(faction)?.style;
  return st === 'fo' || st === 'ni' ? '圆寂' : st === 'dao' ? '羽化' : '卒';
};
const inside = (faction: string) => (factionStyle(faction)?.style === 'clan' ? '族' : faction.slice(-1)) + '中';

/** 一次换人的句子：prev 离任、next 接任（年份 = next.start） */
function changeLine(prev: Term, next: Term, beaten: boolean): ChronLine {
  const { post } = prev;
  const f = post.faction;
  const fs = factionStyle(f)!;
  const p = prev.person.name, n = next.person.name;
  const y = next.start;
  const cat: ChronCat = post.slot === 'head' ? 'big' : campCat(f);
  // 被玩家击败过、却先到了自然离任的人：照样记下场，名字墨金
  if (beaten) {
    const how = prev.endCause === 'died' ? (fs.camp === '邪' ? '伤重不治' : '郁郁而终') : fs.camp === '邪' ? '败后远走' : '败后归隐';
    return { y, cat: campCat(f), text: `${f}${post.title}${p}${how}，${n}接任。`, mark: p };
  }
  if (prev.endCause === 'defeated') {
    const text = fs.style === 'jun' ? `${f}${post.title}${p}兵败去职，朝廷改派${n}。`
      : fs.camp === '邪' ? `${f}${post.title}${p}败后为${inside(f)}所弃，${n}夺了${post.title}之位。`
      : `${f}${post.title}${p}败于后生，闭关不出，${n}接任。`;
    return { y, cat: campCat(f), text, mark: p };
  }
  if (fs.style === 'jun') {
    return { y, cat, text: prev.endCause === 'died' ? `${f}${post.title}${p}卒于任上，朝廷改派${n}。` : `${f}${post.title}${p}告老，朝廷改派${n}。` };
  }
  return {
    y, cat,
    text: prev.endCause === 'died' ? `${f}${post.title}${p}${deathWord(f)}，${n}继立。` : `${f}${post.title}${p}退隐，${n}接掌门户。`,
  };
}

/** 一世里江湖的事最多记几条（design.md §2.4：一世约十条） */
export const JIANGHU_PER_LIFE = 8;

/**
 * [from, to) 年间江湖的事：只记到过的卷里各家首领的更替，以及被玩家击败的人换人。
 * 被击败的人优先，其次按年份由近及远，最多 limit 条。
 */
export function jianghuLines(
  seed: number, kills: readonly RosterKill[], from: number, to: number, vols: readonly number[], limit = JIANGHU_PER_LIFE,
): ChronLine[] {
  if (!seed) return [];
  const factions = new Set(MAPS.filter((m) => m.faction && vols.includes(m.vol)).map((m) => m.faction!));
  const out: ChronLine[] = [];
  // 首领：到过的卷里各家首领的自然更替
  for (const post of ALL_POSTS) {
    if (post.slot !== 'head' || !factions.has(post.faction)) continue;
    const ts = termsUntil(seed, kills, post, to);
    for (let i = 1; i < ts.length; i++) {
      if (ts[i].start >= from && ts[i].start < to) out.push(changeLine(ts[i - 1], ts[i], false));
    }
  }
  // 被玩家击败的人：世内不换人，下场一律记在下一世开局那年（kill.end）
  for (const k of kills) {
    if (k.end < from || k.end >= to) continue;
    const post = postById(k.post);
    if (!post) continue;
    const prev = termsUntil(seed, kills, post, k.year).at(-1)!;
    const next = termsUntil(seed, kills, post, k.end).at(-1)!;
    if (prev.term === next.term) continue;
    out.push({ ...changeLine(prev, next, prev.endCause !== 'defeated'), y: k.end });
  }
  return out
    .sort((a, b) => Number(!!b.mark) - Number(!!a.mark) || b.y - a.y)
    .slice(0, limit)
    .sort((a, b) => a.y - b.y);
}

/** 一世的编年：玩家的事与江湖的事按年混排（新的在前）。当前这一世 to = 当下年份 + 1 */
export function lifeChronicle(seed: number, kills: readonly RosterKill[], rec: LifeRec, to: number): ChronLine[] {
  return [...lifeLines(rec), ...jianghuLines(seed, kills, rec.born, to, rec.vols)].sort((a, b) => b.y - a.y);
}

// ─────────────────────────────────────────────────────────────
// 转世醒来、进章因由、前世留痕
// ─────────────────────────────────────────────────────────────

/**
 * 醒来演出的「此后江湖」：第一行写上一世的人，其后至多三行江湖的事
 * （被上一世击败的人在新一世开局换人，其次是上一世里的首领更替，由近及远）。
 */
export function wakeLines(seed: number, kills: readonly RosterKill[], prev: LifeRec, born: number): ChronLine[] {
  const end = prev.end;
  const place = end?.place ?? placeOfVol(1);
  const died = end?.cause === 'battle' ? '殁于' : end?.cause === 'retire' ? '归隐' : '卒于';
  const first: ChronLine = prev.hao
    ? { y: born, cat: 'me', text: `「${prev.hao}」${prev.name}${died}${place}，其名已入${regionOfPlace(place)}说书人的旧话。` }
    : { y: born, cat: 'me', text: `${prev.name}${died}${place}，江湖上已少有人提起。` };
  const vols = [...new Set([...prev.vols, 1])];
  const fates = jianghuLines(seed, kills, born, born + 1, vols, 3).filter((l) => l.mark);
  const heads = jianghuLines(seed, kills, prev.born, born, vols, 12).filter((l) => !l.mark).reverse();
  return [first, ...[...fates, ...heads].slice(0, 3)];
}

/** 进章因由：赶路图按图名、据点外围按势力名；{head} 填当世首领 */
export function causeLine(seed: number, kills: readonly RosterKill[], mapId: number, year: number): string | null {
  const m = MAPS.find((x) => x.id === mapId);
  if (!m || m.layer === 'gate') return null;
  const tpl = (data.causes as Record<string, string>)[m.faction ?? m.name];
  if (!tpl) return null;
  let text = tpl;
  if (m.faction && tpl.includes('{head}')) {
    const post = postById(`${m.faction}#head`);
    text = tpl.replace('{head}', post && seed ? termsUntil(seed, kills, post, year).at(-1)!.person.name : '');
  }
  // 前世留痕：前几世打穿过这家门户
  if (m.faction && kills.some((k) => k.post === `${m.faction}#3`)) {
    text += factionStyle(m.faction)?.camp === '邪' ? `${inside(m.faction)}至今忌惮当年那人。` : '门中至今记得当年那位外客。';
  }
  return text;
}

/**
 * 守关人悬停的前世留痕：上一世在这关见到的人被玩家击败过、这一世已换了人 →「前任胡三，败于陆青之手」。
 * 世内不换人，「前任」取上一世出生年的在任者（玩家当时看到的那个人），不取推演里夹在中间的人。
 */
export function predecessorNote(seed: number, kills: readonly RosterKill[], lives: readonly LifeRec[], post: PostDef, year: number): string | null {
  const kill = kills.find((k) => k.post === post.id && k.end === year);
  if (!kill) return null;
  const prev = termsUntil(seed, kills, post, kill.year).at(-1)!;
  if (prev.term === termsUntil(seed, kills, post, year).at(-1)!.term) return null;
  const life = lives.find((l) => l.born === kill.year);
  return `前任${prev.person.realName}，败于${life ? label(life) : '前人'}之手`;
}
