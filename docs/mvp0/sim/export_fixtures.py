#!/usr/bin/env python3
"""导出战斗 EV golden fixture，供前端 TS 战斗引擎做逐数对照（规格书 §12 实现路线图前置）。

用法：python3 export_fixtures.py > ../../../code/src/engine/golden/ev-fixtures.json
数据源：mvp0_sim.py（唯一权威）。前端实现变更结算规则时，必须先改 sim 并重导出。
"""
import json
import mvp0_sim as sim

# 代表性对局：覆盖三路线 × 关键敌人（Boss/全部精英/普通关）× 不同武学/节点档位
CASES = [
    # (route, realm, lv, nodes, map_key, stage)
    ("huashan", 3, 5, 0, "map1", 8),   # Boss 1
    ("shaolin", 3, 5, 0, "map1", 8),
    ("tangmen", 3, 5, 0, "map1", 8),
    ("huashan", 3, 6, 1, "map2", 4),   # 高闪精英（华山教学位）
    ("shaolin", 3, 6, 1, "map2", 7),   # 破甲精英（少林教学位）
    ("tangmen", 3, 6, 1, "map2", 4),
    ("huashan", 4, 7, 1, "map2", 10),  # Boss 2 硬瓶颈
    ("shaolin", 4, 7, 1, "map2", 10),
    ("tangmen", 4, 7, 1, "map2", 10),
    ("huashan", 4, 8, 2, "map3", 3),   # 反伤精英
    ("shaolin", 4, 8, 2, "map3", 5),   # 毒精英（金钟不防毒）
    ("tangmen", 4, 8, 2, "map3", 7),   # 净化精英（唐门教学位）
    ("huashan", 5, 8, 2, "map3", 10),  # Boss 3（狂暴）
    ("shaolin", 5, 8, 2, "map3", 10),
    ("tangmen", 5, 10, 3, "map3", 10),
    ("tangmen", 2, 4, 0, "map1", 5),   # 短战普通关
    ("huashan", 2, 4, 0, "map1", 5),
    ("shaolin", 3, 4, 1, "map2", 2),
]

stages = {(m, i): (e, r) for m, i, e, r in sim.build_stages()}
out = []
for route, realm, lv, nodes, mkey, stg in CASES:
    build = sim.make_build(route, realm, lv, nodes)
    enemy, _reward = stages[(mkey, stg)]
    win, rounds, hp_pct = sim.fight(build, enemy)
    out.append({
        "route": route, "realm": realm, "lv": lv, "nodes": nodes,
        "map": mkey, "stage": stg,
        "enemy": {k: enemy[k] for k in ("hp", "atk", "dfs", "hit", "dodge", "tags")},
        "expect": {"win": win, "rounds": rounds, "hpPct": round(hp_pct, 8)},
    })

print(json.dumps({"source": "mvp0_sim.py", "cases": out}, ensure_ascii=False, indent=2))
