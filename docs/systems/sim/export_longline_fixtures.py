#!/usr/bin/env python3
"""导出长线战斗 golden fixture：招式 + 火候构筑、关卡当量换算的敌人、随当量放大的防御常数。

用法：python3 export_longline_fixtures.py > ../../../code/src/engine/golden/longline-fixtures.json
数据源：longline_sim.py（build / enemy_at / def_k）+ mvp0_sim.fight（唯一战斗权威）。
前端改结算规则时，必须先改 sim 并重导出（formulas.md §1.3 / §3.4 v1.6，content.md §2.0）。
"""
import json
import longline_sim as L
import mvp0_sim as m

# (route, realm, 武学等级, 关卡当量, 标签)：覆盖十成前后、火候深浅、K = 100 与放大段、机制标签
CASES = [
    ("huashan", 1, 6, 2.6, ()),
    ("tangmen", 2, 10, 4.9, ()),
    ("shaolin", 2, 26, 5.5, ()),
    ("huashan", 3, 39, 6.4, ("高闪",)),
    ("tangmen", 3, 55, 7.2, ("净化",)),
    ("shaolin", 3, 50, 7.0, ("破甲",)),
    ("huashan", 4, 57, 8.3, ("反伤",)),
    ("tangmen", 4, 64, 8.7, ("毒",)),
    ("shaolin", 4, 69, 8.9, ("高血", "狂暴")),
    ("huashan", 5, 69, 9.9, ()),
    ("tangmen", 5, 80, 10.5, ("高防", "高攻")),
    ("shaolin", 5, 80, 10.4, ()),
]

out = []
for route, realm, lv, x, tags in CASES:
    b = L.build(route, realm, lv)
    e = L.enemy_at(x, tags)
    k = L.def_k(x)
    win, rounds, hp_pct = m.fight(b, e, def_k=k)
    out.append({
        "route": route, "realm": realm, "lv": lv, "x": x, "tags": list(tags),
        "build": {key: b[key] for key in ("hp", "atk", "dfs", "hit", "dodge")},
        "enemy": {key: e[key] for key in ("hp", "atk", "dfs", "hit", "dodge")},
        "defK": k,
        "expect": {"win": win, "rounds": rounds, "hpPct": round(hp_pct, 8)},
    })

print(json.dumps({"source": "longline_sim.py + mvp0_sim.fight", "cases": out}, ensure_ascii=False, indent=2))
