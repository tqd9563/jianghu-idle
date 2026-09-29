#!/usr/bin/env python3
"""
长线关卡表导出 —— issue #22 第 5b 步（content.md §2.0）。

每一关只记「关卡当量」，敌人属性由代码按同一公式换算（enemies.ts enemyStatsAt ↔ longline_sim.enemy_at）。
本脚本决定每条前沿（图 × 难度）有几关、每关当量多少、精英与 Boss 放在哪、带什么标签、叫什么名字。

摆放规则：
  · 普通关：从本段首日最慢路线刚好打得过的当量起，每关 +STAGE_GAP，铺到本段末日前沿。
  · 精英：每 ELITE_EVERY 关一个（同段各前沿错开）。标签只增加代价不挡路（用户 2026-09-29 裁决「甲」）：
          精英当天（最慢路线首次够到该格的那天），三条路线每一条都要打得过——
          当量 = 格位当量 − 该天各路线因标签损失的最大当量。
  · Boss（段末）：三条路线在下一境界首日都打得过（含破关心得），带双标签。
    （图 1 初入中段的头目只在「境界 1 段」存在时出现；多天一世后首日在线即入境界 2，该段已不存在。）

用法：python3 export_stage_table.py > ../../../code/src/engine/data/longline-stages.json
"""
from __future__ import annotations
import json
import math

import longline_sim as L

TIER_NAMES = ["初入", "历练", "绝境"]
TIER_OF = {"普通": 0, "困难": 1, "噩梦": 2}

# 名单（content.md §2.0）。普通敌人循环取用；精英名号按出场次序取，不重复。
NORMALS = {
    1: ["拦路泼皮", "山野猎户", "山贼喽啰", "剪径毛贼"],
    2: ["城郊恶棍", "镖局逃卒", "游侠儿", "恶寺武僧"],
    3: ["古道剑客", "荆棘武者", "落魄镖师", "黑风寨卒"],
    4: ["蜀道游匪", "飞檐夜盗", "落草刀客", "铁壁甲士"],
}
ELITES = {
    1: ["「独眼」胡三", "「快刀」刘七", "「铁尺」孙五", "「夜猫」钱六", "「黑鹞」马九", "「白眉」赵老",
        "「钻山豹」侯四", "「草上飞」燕八", "「疤脸」屠二", "「笑弥勒」钱大肚", "「断指」吴老六", "「独脚」鲁十三",
        "「血手」阎奎", "「过山风」庞彪",
        # 多天一世后图 1 初入 59 关，补 11 个（2026-09-29 第 6 步）
        "「黑狗」丁全", "「瘸腿」邓八", "「独臂」崔九", "「赤发」罗鬼", "「铁牛」包大", "「癞头」田七",
        "「钻天鼠」耿六", "「山魈」殷老三", "「泥鳅」鲍小乙", "「青面」焦猛", "「一撮毛」郝十二"],
    2: ["「铁臂」法空", "「追魂」柳三娘", "「笑面」吴通", "「断魂刀」彭虎", "「金算盘」贾仁", "「过江龙」韩霸",
        "「催命判官」薛冷", "「一掌开碑」石敢", "「玉面狐」苏媚", "「铁头」陀罗僧",
        "「夺命书生」温如玉", "「神拳」武烈", "「千手观音」梅三姑", "「黑煞」屠千山", "「醉拳」刘伶儿"],
    3: ["「清风」道人", "「青锋」秦朗", "「寒梅」卓小婉", "「落雁」宁远", "「孤鸿」叶千山", "「冷面」严霜",
        "「松风」何清远", "「断剑」萧离", "「回雁」卫青衣"],
    4: ["「毒蛊」婆婆", "「锁喉」孟七", "「飞檐」燕无痕", "「断崖」石青松"],
}
ELITE_TAGS = {
    1: [("高闪",), ("破甲",), ("高血",)],
    2: [("高闪",), ("破甲",), ("反伤",)],
    3: [("反伤",), ("毒",), ("净化",)],
    4: [("毒",), ("净化",), ("高攻",)],
}
BOSSES = {
    1: ("山贼头目", ("高血",)),
    2: ("铁掌恶僧", ("高防", "高攻")),
    3: ("黑风寨主", ("高血", "狂暴")),
    4: ("镇关都督", ("高防", "高攻")),
}
HEADMAN = ("山贼小头目", ("高血",))   # 图 1 初入中段：承接第 1 世到第 2 世的那一跳

# 奖励（content.md §2.0，暂定）：关卡不掉内力；银两随当量涨，阅历按类别给
def silver_of(x: float, kind: str) -> int:
    base = 6 * 1.3 ** (x - 1)
    return round(base * {"normal": 1, "elite": 3, "boss": 8}[kind])

XP_OF = {"normal": 1, "elite": 5, "boss": 15}


def main():
    S = L.solve()
    combat, x_min, plateaus, X = S["combat"], S["x_min"], S["plateaus"], S["X"]
    days = S["days"]

    def first_day_reaching(x: float, ds: list[int]) -> int:
        for d in ds:
            if x_min[d] >= x - 1e-9:
                return d
        return ds[-1]

    def tag_loss(d: int, tags: tuple[str, ...]) -> float:
        """第 d 天各路线因标签损失的最大当量"""
        return max(X[r][d] - L.frontier_x(L.build(r, *combat[d]), tags) for r in L.ROUTES)

    def boss_x(nxt: int, tags: tuple[str, ...]) -> float:
        realm, lv = combat[nxt] if nxt <= 100 else (6, combat[100][1])
        k = 1 + L.POGUAN_BONUS if nxt >= L.POGUAN_DAY else 1.0
        xs = []
        for r in L.ROUTES:
            bd = L.build(r, realm, lv)
            bd["atk"] *= k
            xs.append(L.frontier_x(bd, tags))
        return min(xs)

    out: dict[tuple[int, int], list[dict]] = {}
    elite_seq = {m: 0 for m in ELITES}
    for (mp, tier_name, b), (x0, top, _xb) in sorted(S["tracks"].items(), key=lambda kv: (kv[0][2], kv[0][0])):
        tier = TIER_OF[tier_name]
        ds = plateaus[b]
        stages = out.setdefault((mp, tier), [])
        stagger = L.TRACKS[b].index((mp, tier_name)) * L.ELITE_EVERY // len(L.TRACKS[b])
        n = max(0, math.floor((top - x0) / L.STAGE_GAP))
        for i in range(n):
            slot = x0 + i * L.STAGE_GAP
            no = len(stages) + 1
            if (no + stagger) % L.ELITE_EVERY == 0:
                tags = ELITE_TAGS[mp][(elite_seq[mp]) % len(ELITE_TAGS[mp])]
                name = ELITES[mp][elite_seq[mp] % len(ELITES[mp])]
                elite_seq[mp] += 1
                d = first_day_reaching(slot, ds)
                x = slot - max(0.0, tag_loss(d, tags))
                kind = "elite"
            else:
                tags, kind = (), "normal"
                name = NORMALS[mp][(no - 1) % len(NORMALS[mp])]
                x = slot
            # 推荐境界 = 本段境界（普通关与精英在本段内就打得过）
            stages.append(dict(stage=no, kind=kind, name=name, x=round(x, 4), tags=list(tags),
                               recommendedRealm=b))
        # 段末：Boss（或图 1 初入第 1 段的头目）
        nxt = ds[-1] + 1
        if mp == 1 and tier == 0 and b == 1:
            name, tags = HEADMAN
        else:
            name, tags = BOSSES[mp]
        # Boss 推荐境界 = 下一境界（首日刚好打得过）；境界 5 段的 Boss 需境界 6，本版收官
        stages.append(dict(stage=len(stages) + 1, kind="boss", name=name,
                           x=round(boss_x(nxt, tags), 4), tags=list(tags),
                           recommendedRealm=b + 1, final=(b >= 5)))

    tracks = []
    for (mp, tier), stages in sorted(out.items()):
        for s in stages:
            s["silver"] = silver_of(s["x"], s["kind"])
            s["xp"] = XP_OF[s["kind"]]
        tracks.append(dict(map=mp, tier=tier, tierName=TIER_NAMES[tier], stages=stages))

    print(json.dumps({
        "source": "export_stage_table.py（longline_sim.solve）",
        "stageGap": L.STAGE_GAP,
        "eliteEvery": L.ELITE_EVERY,
        "tagMods": L.TAG_MODS,
        "tracks": tracks,
    }, ensure_ascii=False, indent=1))


if __name__ == "__main__":
    main()
