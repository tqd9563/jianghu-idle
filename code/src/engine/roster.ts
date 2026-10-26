/**
 * 江湖名册 —— 活江湖第一期（docs/systems/living-jianghu/design.md §2.1 D2 / D3 / D7）。
 *
 * 三层：势力 → 岗位 → 人物。关卡里的精英与 Boss 就是岗位；坐在岗位上的人物由
 * 「世界种子 + 岗位 + 第几任」确定性地推出（姓名、绰号、上任年岁、寿元、任期），存档不存人物。
 * 存档只存世界种子与玩家的干预：哪一年击败了哪个岗位上的人，下一世开局前此人必换（D7）。
 * 每世只在开局（本世出生年）取一次各岗位的在任者，世内不换人。
 *
 * 本批只换人不换数：人物不改关卡当量与路数标签（个体偏差另做，配 sim）。
 * 本模块纯函数，禁止引入 UI / 存储依赖。
 */
import lineData from './data/stage-line.json';
import lib from './data/roster-names.json';
import { ERA_START } from './reincarnation';

type Camp = '正' | '邪';
type Style = 'mang' | 'zheng' | 'xie' | 'fo' | 'ni' | 'dao' | 'clan' | 'nv' | 'jun' | 'yelan';
type WeaponCat = '剑' | '刀' | '枪' | '棍' | '拳' | '掌' | '指' | '腿' | '暗器';
interface FactionCfg { style: Style; camp: Camp; titles: string[]; head: string; weapons: WeaponCat[] }
interface ClanCfg { surname: string; generations: string[]; second: string[] }

const FACTIONS = lib.factions as Record<string, FactionCfg>;
const CLANS = lib.clans as Record<string, ClanCfg>;
const BLACKLIST: ReadonlySet<string> = new Set(lib.blacklist);

/** 岗位序：外围副手、外围镇守、门户副手、门户 Boss；'head' 为不出战的首领（掌门、方丈……） */
export type PostSlot = 0 | 1 | 2 | 3 | 'head';
export interface PostDef {
  id: string;
  faction: string;
  slot: PostSlot;
  /** 岗位称谓（管事、监寺、长老……；夜阑风雨楼为代号） */
  title: string;
  /** 出战岗位所在的关卡键；首领为 null */
  stageKey: string | null;
}

/** 关卡键 → 岗位（由关卡表推出：据点图里的精英按关序是副手、镇守，门户末关是 Boss） */
const POSTS: PostDef[] = [];
const POST_OF_STAGE = new Map<string, PostDef>();
for (const m of lineData.maps as { id: number; layer: string; faction: string | null; stages: { stage: number; kind: string }[] }[]) {
  const faction = m.faction;
  if (!faction || !FACTIONS[faction]) continue;
  const fighters = m.stages.filter((s) => s.kind !== 'normal');
  fighters.forEach((s, i) => {
    const slot = ((m.layer === 'gate' ? 2 : 0) + i) as 0 | 1 | 2 | 3;
    const key = `m${m.id}s${s.stage}`;
    const post: PostDef = { id: `${faction}#${slot}`, faction, slot, title: FACTIONS[faction].titles[slot], stageKey: key };
    POSTS.push(post);
    POST_OF_STAGE.set(key, post);
  });
}
for (const [name, f] of Object.entries(FACTIONS)) POSTS.push({ id: `${name}#head`, faction: name, slot: 'head', title: f.head, stageKey: null });
export const ALL_POSTS: readonly PostDef[] = POSTS;
export const postOfStage = (key: string): PostDef | null => POST_OF_STAGE.get(key) ?? null;

// ─────────────────────────────────────────────────────────────
// 确定性随机：同一组键永远给同一串数
// ─────────────────────────────────────────────────────────────

function hashStr(s: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619) >>> 0;
  return h;
}
function rngOf(...keys: (string | number)[]): () => number {
  let a = hashStr(keys.join('|'));
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const pickOf = (r: () => number) => <T,>(xs: readonly T[]): T => xs[Math.floor(r() * xs.length)];

// ─────────────────────────────────────────────────────────────
// 起名（词库见 data/roster-names.json；规则见 design.md §2.1 起名）
// ─────────────────────────────────────────────────────────────

export interface Person {
  /** 显示名：绰号 + 姓名，或法名 / 道号 / 代号 */
  name: string;
  /** 本名（夜阑风雨楼代号之下的真名；其余同姓名部分） */
  realName: string;
  female: boolean;
}

const G = lib.given;
const NP = lib.nickParts;
type Pool = Record<string, Record<string, WeaponCat[]>>;
const fits = (tbl: Record<string, WeaponCat[]>, cat: WeaponCat) => Object.keys(tbl).filter((k) => tbl[k].includes(cat));
const clean = (n: string) => !BLACKLIST.has(n) && new Set(n).size === n.length;

function makePerson(seed: number, post: PostDef, term: number): Person {
  const f = FACTIONS[post.faction];
  // 每一任至多试几次避开黑名单与叠字；试不出就用最后一次（词库足够大，实际不会走到）
  for (let attempt = 0; ; attempt++) {
    const r = rngOf(seed, post.id, term, attempt);
    const p = pickOf(r);
    const sur = () => (r() < 0.06 ? p(lib.compoundSurnames) : p(lib.surnames));
    const ya = () => (r() < 0.2 ? p(G.ya.single) : p(G.ya.first) + p(G.ya.second));
    const su = () => (r() < 0.55 ? p(G.su.rank) : p(G.su.single));
    const suMix = () => { const x = r(); return x < 0.45 ? p(G.su.rank) : x < 0.9 ? p(G.su.single) : p(G.su.double); };
    const nv = () => p(G.nv.first) + p(G.nv.second);
    const lead = post.slot !== 0 && post.slot !== 'head';
    // 同一家里各岗位的法名 / 族名第二字按岗位错开（同字辈时不撞名）
    const slotNo = post.slot === 'head' ? 4 : post.slot;
    const bySlot = (xs: readonly string[]) => xs[(Math.floor(r() * Math.floor(xs.length / 5)) * 5 + slotNo) % xs.length];

    const nick = (female: boolean): string => {
      const F = female ? 'F' : '';
      const camp = f.camp;
      const cat = p(f.weapons);
      const w = p((NP.weapon as Record<WeaponCat, string[]>)[cat]);
      const P = NP.persona as Record<string, string[]>;
      const L = NP.look as Record<string, string[]>;
      const p2 = fits((NP.prefix2 as Pool)[camp + F], cat);
      const p1 = fits((NP.prefix1 as Pool)[camp + F], cat);
      const persona = camp === '邪' || female ? P[camp + F] : P['正武'];
      const x = r();
      if (x < 0.40 && p2.length) return p(p2) + w;
      if (x < 0.55 && p1.length) return p(p1) + w;
      if (x < 0.70 && p1.length) return p(p1) + w + p(persona);
      if (x < 0.88) {
        if (camp === '正' && !female) { const k = p(['正武', '正文']); return p(L[k]) + p(P[k]); }
        return p(L[camp + F]) + p(P[camp + F]);
      }
      return p((NP.item as Record<string, string[]>)[camp + F]) + p(camp === '邪' || female ? P[camp + F] : P['正文']);
    };
    const quote = (n: string) => `「${n}」`;

    let person: Person;
    switch (f.style) {
      case 'mang': {
        if (r() < 0.1) { const n = sur() + p(G.nv.rank); person = { name: quote(p(lib.nicknames.mangF)) + n, realName: n, female: true }; break; }
        const n = sur() + su();
        person = { name: quote(bySlot(lib.nicknames.mang)) + n, realName: n, female: false };
        break;
      }
      case 'zheng':
      case 'xie': {
        const female = r() < (f.style === 'zheng' ? 0.15 : 0.2);
        const n = sur() + (female ? nv() : f.style === 'zheng' ? ya() : r() < 0.6 ? suMix() : ya());
        person = { name: (lead ? quote(nick(female)) : '') + n, realName: n, female };
        break;
      }
      case 'nv': {
        const n = sur() + nv();
        person = { name: (lead ? quote(nick(true)) : '') + n, realName: n, female: true };
        break;
      }
      case 'fo':
      case 'ni':
      case 'dao': {
        const d = (lib.dharma as Record<string, { generations: string[]; second: string[]; suffix?: string }>)[f.style];
        const n = d.generations[term % d.generations.length] + bySlot(d.second) + (d.suffix ?? '');
        person = { name: n, realName: n, female: f.style === 'ni' };
        break;
      }
      case 'clan': {
        const c = CLANS[post.faction];
        let n: string;
        if (post.slot === 3 || post.slot === 'head') n = c.surname + c.generations[term % c.generations.length] + bySlot(c.second);
        else n = sur() + (post.slot === 0 ? su() : ya());
        const withNick = post.slot === 2 && post.faction !== '雁门秦氏';
        person = { name: (withNick ? quote(nick(false)) : '') + n, realName: n, female: false };
        break;
      }
      case 'jun': {
        const n = sur() + p(lib.given.jun.first) + p(lib.given.jun.second);
        person = { name: n, realName: n, female: false };
        break;
      }
      case 'yelan': {
        const n = sur() + (r() < 0.5 ? ya() : su());
        person = { name: quote(post.title), realName: n, female: false };
        break;
      }
    }
    if (attempt >= 8 || (clean(person.realName) && !BLACKLIST.has(person.name))) return person;
  }
}

// ─────────────────────────────────────────────────────────────
// 任期推演（D7）
// ─────────────────────────────────────────────────────────────

/**
 * 玩家的一次干预：某一世击败了某岗位上的人，到 end 年（下一世出生年）此人离任。
 * year 取那一世的出生年（世内不换人，与本世开局取在任者同一口径）；at 是击败那年，供编年。
 */
export interface RosterKill { post: string; year: number; end: number; at?: number }

export type TermEnd = 'died' | 'retired' | 'defeated';
export interface Term {
  post: PostDef;
  /** 第几任（从 0 起） */
  term: number;
  person: Person;
  start: number;
  /** 离任年份（未到则为推演的自然离任年） */
  end: number;
  endCause: TermEnd;
}

/** 一任的自然轨迹：上任年岁、寿元、在任多久（不受玩家干预） */
function naturalTerm(seed: number, post: PostDef, term: number, start: number): { end: number; cause: TermEnd } {
  const r = rngOf(seed, post.id, term, 'life');
  const head = post.slot === 'head';
  const ageAtStart = head ? 40 + r() * 20 : 25 + r() * 20;
  const lifespan = 70 + r() * 50;
  const maxTenure = head ? 25 + r() * 30 : 15 + r() * 25;
  const toDeath = lifespan - ageAtStart;
  return toDeath <= maxTenure
    ? { end: start + Math.max(3, toDeath), cause: 'died' }
    : { end: start + maxTenure, cause: 'retired' };
}

/**
 * 某岗位在 year 年的在任者。从江湖历起点前开始逐任推演；某一任在任期间被玩家击败，
 * 就在那次干预的 end 年离任（若早于自然离任）。
 */
export function holderAt(seed: number, kills: readonly RosterKill[], post: PostDef, year: number): Term {
  const mine = kills.filter((k) => k.post === post.id).sort((a, b) => a.year - b.year);
  // 开局在任者已上任若干年，各岗位错开
  let start = ERA_START - Math.floor(rngOf(seed, post.id, 'origin')() * 20);
  for (let term = 0; ; term++) {
    const nat = naturalTerm(seed, post, term, start);
    let end = nat.end;
    let cause = nat.cause;
    const hit = mine.find((k) => k.year >= start && k.year < end && k.end < end);
    if (hit) { end = hit.end; cause = 'defeated'; }
    if (end > year || term > 10_000) return { post, term, person: makePerson(seed, post, term), start, end, endCause: cause };
    start = end;
  }
}

/** 本世各出战岗位的在任者：关卡键 → 显示名（世内不换人，取本世出生年） */
export function stageNamesAt(seed: number, kills: readonly RosterKill[], lifeStartYear: number): Map<string, string> {
  const out = new Map<string, string>();
  for (const post of POSTS) {
    if (!post.stageKey) continue;
    out.set(post.stageKey, holderAt(seed, kills, post, lifeStartYear).person.name);
  }
  return out;
}

/** 某关的在任者（世内取本世出生年）；不是岗位关为 null */
export function holderOfStage(seed: number, kills: readonly RosterKill[], lifeStartYear: number, key: string): Term | null {
  const post = POST_OF_STAGE.get(key);
  return post && seed ? holderAt(seed, kills, post, lifeStartYear) : null;
}

/** 势力的起名套路（战斗页按它取通用人像）与正邪 */
export const factionStyle = (faction: string): { style: Style; camp: Camp } | null => {
  const f = FACTIONS[faction];
  return f ? { style: f.style, camp: f.camp } : null;
};

/** 新世界的种子 */
export const newWorldSeed = (rng: () => number = Math.random) => Math.floor(rng() * 2 ** 31);
