#!/usr/bin/env python3
"""
单线关卡表导出 —— 活江湖第一期（living-jianghu/design.md §2.2 卷 · 章 · 图 · 关，D10）。

取代原 export_stage_table.py（图 × 初入 / 历练 / 绝境三档）。推图只有一条线：
  卷（地域）→ 一张赶路图 + 2–3 章并排（一章一家势力：外围 → 门户两张据点图）→ 关。
每一关只记「关卡当量」，敌人属性由代码按同一公式换算（enemies.ts enemyStatsAt ↔ longline_sim.enemy_at）。

摆放规则（design.md §2.2「难度阶梯」，口径与 living-jianghu/sim.py 一致）：
  · 战力曲线取 longline_sim.solve() 的 x_min（三路线最慢者），段末上抬 END_LIFT 当量。
  · 每个境界段的主线 = 段内每卷 1 张赶路图（坡度减半）+ 一章 2 张据点图；台阶 = 战力跨度 ÷ 主线关数。
    并排的章与主线同高（同一卷里各家的关卡当量完全相同）。
  · 卷 1 是教学卷：赶路图 = 入门关（裸属性）+ 第 7 关传功教学战 + 传功缓坡；其后蒿里寨一章两图
    算进境界 2 段的主线，从境界 2 段起点铺起。
  · 副手（据点图中段）与台阶同高；镇守（外围末关）高出 WARDEN_BUMP 关；门户末关 Boss：
    境界段最后一卷为境界门槛（下一境界首日三路线都打得过，须突破），其余卷为矮墙，高出 WALL_BUMP 关。
  · 标签只增加代价不挡路：精英 / Boss 当量扣回当天各路线因标签损失的最大当量（同原关卡表）。

用法：python3 export_stage_line.py > ../../../code/src/engine/data/stage-line.json
"""
from __future__ import annotations
import json
import math

import longline_sim as L

# 入门关（卷 1 赶路图最前面）：境界 1 未择路的裸属性构筑能稳赢的几关
INTRO_NAMES = ["村口恶犬", "醉酒闲汉", "偷鸡毛贼", "街头地痞", "泼皮帮闲", "泼皮头子"]
INTRO_X0, INTRO_GAP = 1.0, 0.15
INTRO_MARGIN = 0.25   # EV 前沿 2.04 − 0.25 ≈ 1.79，实战（RNG）胜率约 95% 以上
# 传功缓坡：百川诀 0 重 + 伏狮拳法在 2.0 胜率约 92%、裸属性约 46%（battle-loot/spec.md §4）
TEACH_X0, TEACH_GAP = 2.0, 0.15


def bare_build(realm: int) -> dict:
    """未择路的裸属性构筑（与 gameStore.playerBuild 的未择路分支一致）"""
    b = L.m.make_build("huashan", realm, 0, 0)
    r = L.m.REALMS[realm]
    b.update(hp=r["hp"], atk=r["atk"], dfs=r["dfs"], hit=r["hit"], dodge=r["dodge"],
             crit=L.m.BASE_CRIT, cd=L.m.BASE_CD, first_crit=False, sq_need=99, burst_mult=0.0)
    return b

END_LIFT = 0.5
WARDEN_BUMP, WALL_BUMP = 2.5, 5.5

# ── 十卷（design.md §2.6 起名批次结果、2026-10-23 图名定稿）
# 势力：(名号, 正邪, 普通敌人称谓, 战报口吻) —— 口吻 master 走高手句式，bandit 走草莽句式
F = {
    "蒿里寨": ("邪", "喽啰", "bandit"),
    "苍崖派": ("正", "弟子", "master"), "千帆帮": ("正", "帮众", "bandit"), "千蛇窟": ("邪", "门人", "master"),
    "千岩寺": ("正", "武僧", "master"), "会稽顾氏": ("正", "家丁", "master"), "花影坊": ("邪", "弟子", "master"),
    "建安岑氏": ("邪", "家丁", "master"), "凌风山庄": ("正", "庄丁", "master"), "蜃海教": ("邪", "教众", "master"),
    "擎天门": ("正", "弟子", "master"), "虎啸山庄": ("正", "庄丁", "master"), "北邙门": ("邪", "门人", "master"),
    "乾元观": ("正", "道人", "master"), "江陵裴氏": ("正", "家丁", "master"), "横江会": ("邪", "会众", "bandit"),
    "镇关军": ("正", "军卒", "master"), "雁门秦氏": ("正", "家将", "master"), "夜阑风雨楼": ("邪", "刺客", "master"),
    "水月庵": ("正", "女尼", "master"), "天工坊": ("正", "匠人", "master"), "幽篁宫": ("邪", "弟子", "master"),
    "瘴月教": ("邪", "教众", "master"), "苍梧派": ("正", "弟子", "master"), "碧磷洞": ("邪", "门人", "master"),
    "风雷堡": ("正", "刀客", "master"), "阴山派": ("邪", "弟子", "master"), "鸣沙教": ("邪", "教众", "master"),
}
# 卷：(地域, 卷题, 境界段, 赶路图名, [(势力, 外围图名, 门户图名), …])
VOLS = [
    ("齐鲁", "岱宗初晓", 1, "泰安古道", [("蒿里寨", "野狐渡", "乱石隘")]),
    ("两淮", "烟花三月", 2, "淮扬驿路", [("苍崖派", "苍崖剑坊", "迎客峰"), ("千帆帮", "运河漕渡", "千帆水寨"), ("千蛇窟", "芦荡蛇集", "腥风谷")]),
    ("江南", "杏花春雨", 2, "姑苏驿道", [("千岩寺", "云栈香市", "千岩山门"), ("会稽顾氏", "顾家绸庄", "镜湖别业"), ("花影坊", "秦淮画舫", "十里花阵")]),
    ("闽浙", "东海潮生", 2, "瓯江驿道", [("建安岑氏", "岑家药庄", "建安岑府"), ("凌风山庄", "凌风马场", "绝壁隘"), ("蜃海教", "蜃楼渔坞", "雾锁滩")]),
    ("中州", "中原逐鹿", 3, "洛阳官道", [("擎天门", "铁木场", "擎天关"), ("虎啸山庄", "伏牛山集", "啸风岗"), ("北邙门", "北邙古窑", "千冢障")]),
    ("荆襄", "楚天千里", 3, "襄樊古道", [("乾元观", "乾元茶场", "乾元试炼谷"), ("江陵裴氏", "裴家米行", "孤峰剑冢"), ("横江会", "横江渡", "断流寨")]),
    ("关中", "西风残照", 4, "潼关古道", [("镇关军", "灞桥驿", "镇西关"), ("雁门秦氏", "秦家马场", "秦家校场"), ("夜阑风雨楼", "西市暗巷", "风雨长廊")]),
    ("巴蜀", "剑门细雨", 4, "剑阁栈道", [("水月庵", "竹林斋堂", "水月禅院"), ("天工坊", "千锤铁场", "千机阵"), ("幽篁宫", "竹海纸坊", "幽篁竹阵")]),
    ("滇黔", "月照南疆", 5, "茶马古道", [("瘴月教", "瘴林药集", "瘴月毒障"), ("苍梧派", "苍梧木场", "梧桐岭"), ("碧磷洞", "毒泉坳", "冷磷障")]),
    ("河西", "千里黄云", 5, "玉门古道", [("风雷堡", "风雷铁坊", "风雷关"), ("阴山派", "阴山牧场", "阴山雪隘"), ("鸣沙教", "月泉驼集", "鸣沙山口")]),
]
PER_MAP = {2: 20, 3: 15, 4: 15, 5: 12}   # 每张图关数（§2.7）；卷 1 的据点图另取 VOL1_JU
VOL1_JU = 15

# 赶路图的普通敌人（不属于任何势力，按境界段轮换）
ROAD_FOES = {
    2: ["剪径毛贼", "城郊恶棍", "镖局逃卒", "游侠儿"],
    3: ["古道剑客", "荆棘武者", "落魄镖师", "拦路刀客"],
    4: ["山道游匪", "飞檐夜盗", "落草刀客", "边关逃卒"],
    5: ["亡命客", "独行剑客", "瘴林毒客", "大漠马贼"],
}
ROAD1_FOES = ["拦路泼皮", "山野猎户", "山贼喽啰", "剪径毛贼"]
# 精英与 Boss 的标签（按境界段轮换，沿用原各图的配置）
ELITE_TAGS = {
    2: [("高闪",), ("破甲",), ("高血",), ("反伤",)],
    3: [("反伤",), ("毒",), ("净化",), ("高闪",)],
    4: [("毒",), ("净化",), ("高攻",), ("反伤",)],
    5: [("毒",), ("净化",), ("高攻",), ("破甲",)],
}
BOSS_TAGS = {2: ("高血",), 3: ("高防", "高攻"), 4: ("高血", "狂暴"), 5: ("高防", "高攻")}


def posts(faction: str, layer: str, map_name: str) -> tuple[str, str]:
    """（副手, 镇守 / Boss）的岗位称呼。第一期名册（人物推演）落地前，精英先以岗位相称"""
    if faction == "镇关军":
        return (f"{map_name}校尉", f"{map_name}管事") if layer == "outer" else (f"{map_name}校尉", f"{map_name}守将")
    if layer == "outer":
        return f"{map_name}护院", f"{map_name}管事"
    return f"{faction}护法", f"{faction}门户守将"


def silver_of(x: float, kind: str) -> int:
    base = 6 * 1.3 ** (x - 1)
    return round(base * {"normal": 1, "elite": 3, "boss": 8}[kind])


XP_OF = {"normal": 1, "elite": 5, "boss": 15}


def main() -> None:
    S = L.solve()
    combat, x_min, plateaus, X = S["combat"], S["x_min"], S["plateaus"], S["X"]

    def first_day_reaching(x: float, ds: list[int]) -> int:
        return next((d for d in ds if x_min[d] >= x - 1e-9), ds[-1])

    def tag_loss(d: int, tags: tuple[str, ...]) -> float:
        return max(X[r][d] - L.frontier_x(L.build(r, *combat[d]), tags) for r in L.ROUTES)

    def boss_x(nxt: int, tags: tuple[str, ...]) -> float:
        realm, lv, st = combat[nxt] if nxt <= 100 else (6, *combat[100][1:])
        k = 1 + L.POGUAN_BONUS if nxt >= L.POGUAN_DAY else 1.0
        xs = []
        for r in L.ROUTES:
            bd = L.build(r, realm, lv, st)
            bd["atk"] *= k
            xs.append(L.frontier_x(bd, tags))
        return min(xs)

    # 各境界段：起点、段末（上抬后）、主线等效关数 → 台阶
    band_x0 = {}
    for b, ds in sorted(plateaus.items()):
        x0, top, _ = next(v for (mp, t, bb), v in S["tracks"].items() if bb == b and (mp, t) == L.TRACKS[b][0])
        band_x0[b] = (x0, top + END_LIFT, ds)
    vols_in = {b: [v for v in VOLS if v[2] == b] for b in (2, 3, 4, 5)}

    def step(b: int) -> float:
        x0, top, _ = band_x0[b]
        s = PER_MAP[b]
        eff = len(vols_in[b]) * s * 2.5                         # 每卷：赶路坡度减半（0.5）+ 两张据点图
        if b == 2:
            eff += 2 * VOL1_JU                                  # 卷 1 蒿里寨一章算进境界 2 段主线
        return (top - x0) / eff

    maps, out_vols = [], []
    elite_no = {b: 0 for b in ELITE_TAGS}
    map_id = 0

    def stage_row(no: int, kind: str, name: str, x: float, tags, realm: int, foe: str, final: bool = False) -> dict:
        r = dict(stage=no, kind=kind, name=name, x=round(x, 4), tags=list(tags), recommendedRealm=realm,
                 silver=silver_of(x, kind), xp=XP_OF[kind], foe=foe)
        if final:
            r["final"] = True
        return r

    def ju_map(b: int, xs: list[float], dx: float, faction: str, layer: str, name: str, gate_boss: str | None) -> list[dict]:
        """一张据点图：xs 为普通关台阶；中段副手、末关镇守（外围）或 Boss（门户）"""
        _, ds = band_x0[b][0], band_x0[b][2]
        camp, foe_word, tone = F[faction]
        aide, last = posts(faction, layer, name)
        s = len(xs)
        mid = (s + 1) // 2
        rows = []
        for i, slot in enumerate(xs, start=1):
            if i == mid:
                tags = ELITE_TAGS[b][elite_no[b] % len(ELITE_TAGS[b])]
                elite_no[b] += 1
                x = slot - max(0.0, tag_loss(first_day_reaching(slot, ds), tags))
                rows.append(stage_row(i, "elite", aide, x, tags, b, "master"))
            elif i == s and layer == "outer":
                tags = ELITE_TAGS[b][elite_no[b] % len(ELITE_TAGS[b])]
                elite_no[b] += 1
                bump = slot + WARDEN_BUMP * dx
                x = bump - max(0.0, tag_loss(first_day_reaching(bump, ds), tags))
                rows.append(stage_row(i, "elite", last, x, tags, b, "master"))
            elif i == s:
                tags = BOSS_TAGS[b]
                if gate_boss == "gate":
                    x = boss_x(ds[-1] + 1, tags)
                    rows.append(stage_row(i, "boss", last, x, tags, b + 1, "master", final=(b >= 5)))
                else:
                    bump = slot + WALL_BUMP * dx
                    x = bump - max(0.0, tag_loss(first_day_reaching(bump, ds), tags))
                    rows.append(stage_row(i, "boss", last, x, tags, b, "master"))
            else:
                rows.append(stage_row(i, "normal", f"{faction}{foe_word}", slot, (), b, tone))
        return rows

    # ── 卷 1：赶路图（入门关 + 传功）
    top_intro = L.frontier_x(bare_build(1)) - INTRO_MARGIN
    n_intro = math.floor((top_intro - INTRO_X0) / INTRO_GAP + 1e-9) + 1
    teach_x = band_x0[2][0]
    n_teach = max(0, math.ceil((teach_x - TEACH_X0) / TEACH_GAP - 1e-9))
    road1 = [stage_row(i + 1, "normal", INTRO_NAMES[i % len(INTRO_NAMES)], INTRO_X0 + i * INTRO_GAP, (), 1, "")
             for i in range(n_intro)]
    road1 += [stage_row(n_intro + i + 1, "normal", ROAD1_FOES[i % len(ROAD1_FOES)], TEACH_X0 + i * TEACH_GAP, (), 1, "bandit")
              for i in range(n_teach)]

    x = band_x0[2][0]
    for v_no, (region, title, b, road_name, chapters) in enumerate(VOLS, start=1):
        bb = 2 if b == 1 else b
        dx = step(bb)
        if b >= 3 and VOLS[v_no - 2][2] != b:
            x = band_x0[b][0]                                   # 新境界段：从该段首日最慢路线刚好打得过的当量起铺
        s = VOL1_JU if b == 1 else PER_MAP[b]
        vol_maps = []
        # 赶路图
        map_id += 1
        if b == 1:
            road = road1
        else:
            foes = ROAD_FOES[b]
            road = [stage_row(i + 1, "normal", foes[i % len(foes)], x + i * dx * 0.5, (), b, "") for i in range(s)]
            x = x + s * dx * 0.5
        maps.append(dict(id=map_id, vol=v_no, chapter=0, layer="road", name=road_name, faction=None, stages=road))
        vol_maps.append(map_id)
        # 并排各章：同高
        xs_outer = [x + i * dx for i in range(s)]
        xs_gate = [x + (s + i) * dx for i in range(s)]
        is_band_end = (v_no == max(i for i, v in enumerate(VOLS, start=1) if v[2] == b)) and b >= 2
        for c_no, (fac, outer_name, gate_name) in enumerate(chapters, start=1):
            save = dict(elite_no)
            for layer, nm, xs in (("outer", outer_name, xs_outer), ("gate", gate_name, xs_gate)):
                map_id += 1
                rows = ju_map(bb, xs, dx, fac, layer, nm, "gate" if is_band_end else "wall")
                maps.append(dict(id=map_id, vol=v_no, chapter=c_no, layer=layer, name=nm, faction=fac, stages=rows))
                vol_maps.append(map_id)
            if c_no < len(chapters):
                elite_no.update(save)                           # 并排各章标签同序，难度一致
        x = x + 2 * s * dx
        out_vols.append(dict(no=v_no, region=region, title=title, band=b, maps=vol_maps,
                             factions=[dict(name=f, camp=F[f][0]) for f, _, _ in chapters]))

    print(json.dumps({
        "source": "export_stage_line.py（longline_sim.solve）",
        "teachX": round(teach_x, 4),
        "tagMods": L.TAG_MODS,
        "volumes": out_vols,
        "maps": maps,
    }, ensure_ascii=False, indent=1))


if __name__ == "__main__":
    main()
