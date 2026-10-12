#!/usr/bin/env python3
"""
战斗挂机：掉落与装备 sim —— issue #45 第 3 步（设定 `design.md` v1.0、名录 `../wuxue-catalog/design.md` v1.0）。

它回答的问题：
    1. 装备把前沿往前推多远？标准装备 +0.3 境界当量、满配 ≤ 0.6、装备 + 武学合计 ≤ 1.2（用户 2026-10-12 定）
    2. 171 门武学的五项具体数值：按名录的高 / 中 / 低倾向取档，倍率由「同品质同强度」反解
    3. 触发求和（W6）加上限 75% 后，出招率与原 55% 规则对得上吗？
    4. 掉落概率怎么定：标准玩家一世里各品阶拿到几件、上乘残页能拼齐几式
    5. 境界 1：1-7 裸属性必败；选内功 + 一门武学 + 白绿装后能推到第几关、多久推一关、书肆在第几关开张
    6. 节奏：内力里程碑不动（装备不产内力）；首通 Boss、名号声望提前几天

依赖方向：pacing_sim → longline_sim → sect-neigong/sim（fight_x）→ 本脚本（fight_y：装备 / 新特效 / 触发求和）。
golden 红线：不改上游任何函数；fight_y 在「EV 模式 + 不装武学 + 不穿装备」时与 mvp0_sim.fight 逐项一致（判据【零】）。

用法：python3 docs/systems/battle-loot/sim.py [--quick]
"""
from __future__ import annotations

import json
import math
import os
import random
import re
import sys
from multiprocessing import Pool

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, "..", "sim"))
import mvp0_sim as m                  # noqa: E402
import longline_sim as L              # noqa: E402
import pacing_sim as ps               # noqa: E402
import export_stage_table as E        # noqa: E402
import importlib.util                 # noqa: E402

_spec = importlib.util.spec_from_file_location("sect_neigong_sim", os.path.join(HERE, "..", "sect-neigong", "sim.py"))
W = importlib.util.module_from_spec(_spec)   # sect-neigong/sim.py（fight_x、内功构筑、检查点）
sys.modules["sect_neigong_sim"] = W
_spec.loader.exec_module(W)

QUICK = "--quick" in sys.argv
ROUTES = L.ROUTES
ROUTE_NAME = {"huashan": "惊雷", "shaolin": "镇岳", "tangmen": "蚀骨"}
ROUTE_OF = {"惊雷": "huashan", "镇岳": "shaolin", "蚀骨": "tangmen", "—": None}
QUAL = ["寻常", "上乘", "绝学"]
QI = {"寻常": 0, "上乘": 1, "绝学": 2}

# ═══════════════════════════════════════════════════════════
# 名录（../wuxue-catalog/design.md §7.2 是唯一来源，本脚本只读不写）
# ═══════════════════════════════════════════════════════════

def load_catalog() -> list[dict]:
    path = os.path.join(HERE, "..", "wuxue-catalog", "design.md")
    rows, cat = [], None
    for line in open(path, encoding="utf-8"):
        mh = re.match(r"### (\S+)（(器械|肉身|暗器)", line)
        if mh:
            cat = mh.group(1)
            continue
        mr = re.match(r"\| (\S+?)(（现有[^）]*）)? \| (寻常|上乘|绝学) \| (\S+) \| (高|中|低) \| (高|中|低) \| (高|中|低) \| (短|中|长) \| (\S+) \| ([^|]+) \| ([12]) \|",
                      line)
        if mr and cat:
            name, exist, q, route, mult, cost, trig, cd, eff, src, batch = mr.groups()
            rows.append(dict(name=name, exist=bool(exist), quality=q, route=ROUTE_OF[route], cat=cat,
                             mult_t=mult, cost_t=cost, trig_t=trig, cd_t=cd, effect=eff,
                             source=src.strip(), batch=int(batch)))
    assert len(rows) == 171, f"名录应有 171 行，读到 {len(rows)}"
    return rows


CATALOG = load_catalog()
SIGNATURE = set(W.SIGNATURE)                     # 蓄势 / 反震 / 引爆：门派独门，不进校准

# ═══════════════════════════════════════════════════════════
# 武学五项参数：档位（名录 §1.1 倾向 → 具体值）
# ═══════════════════════════════════════════════════════════

TRIGGER_P = {"低": 0.17, "中": 0.25, "高": 0.33}   # 单门触发几率；原 55% ≈ 2–3 门同时可用时「中」之和（扣掉冷却与真气不够的）
TRIGGER_CAP = 0.75                                 # 总触发率上限（用户 2026-10-12 定）
COST_BASE = {"寻常": 25, "上乘": 40, "绝学": 55}      # 现行（spec §2.1）= 「中」档
COST_K = {"低": 0.60, "中": 1.00, "高": 1.50}
CD_BASE = {"寻常": 2, "上乘": 3, "绝学": 4}
CD_K = {"短": -1, "中": 0, "长": +1}
MULT_BASE = {"寻常": 1.30, "上乘": 1.50, "绝学": 1.45}
MULT_K = {"低": 0.85, "中": 1.00, "高": 1.15}       # 只是校准前的起点，最终倍率由「同品质同强度」反解
MULT_STEP = W.MULT_STEP
NFORMS = {q: W.WX[q]["n"] for q in QUAL}
REGEN = W.REGEN

# 特效每一式都带（裁决 W17，2026-10-12）：数值分四档 Ⅰ–Ⅳ，第 1 式到末式按品质跨档（TIER_SPAN）线性插值，
# 式之间的差别 = 倍率 +0.04 与特效数值；熟练度不再加倍率（SHU）。现有四种也分档（必暴加会心伤害、回气改返还比例）。
EFF = {
    "运劲": dict(atk=(0.12, 0.16, 0.20, 0.25), n=3),
    "凝眸": dict(crit=(0.12, 0.16, 0.20, 0.25), n=3),
    "轻身": dict(dodge=(16, 24, 32, 40), n=3),
    "回元": dict(qi=(16, 24, 32, 40)),
    "连击": dict(chance=(0.35, 0.50, 0.65, 0.80)),   # 追加一次普攻的几率
    "透劲": dict(pen=(0.25, 0.35, 0.45, 0.55)),
    "封穴": dict(p=(0.20, 0.30, 0.40, 0.50)),
    "卸力": dict(atk=(0.12, 0.16, 0.20, 0.25), n=3),
    "迷目": dict(hit=(16, 24, 32, 40), n=3),
    "破绽": dict(dfs=(0.16, 0.24, 0.32, 0.40), n=3),
    "必暴": dict(cdmg=(0.00, 0.05, 0.10, 0.15)),      # 必定会心，会心伤害再 +x
    "回气": dict(refund=(0.50, 0.75, 1.00, 1.25)),    # 返还本式耗气的比例（Ⅳ 档倒赚）
    "护体": dict(shield=(0.03, 0.04, 0.05, 0.06)),    # 护盾 = 气血 × x
    "附毒": dict(extra=(0.00, 0.25, 0.50, 0.75)),    # 额外叠毒 +1 层，另有 x 几率再 +1
}
TIER_SPAN = {"寻常": (0, 1), "上乘": (0, 2), "绝学": (1, 3)}   # 第 1 式 → 末式 的档位下标
INT_KEYS = set()
# 熟练度四档（生疏 / 熟练 / 精通 / 圆熟）：耗气系数、触发几率加成（相对）、冷却缩短（回合，最低 1）
SHU = {0: (1.00, 0.00, 0), 1: (0.92, 0.04, 0), 2: (0.84, 0.08, 0), 3: (0.75, 0.12, 1)}
POISON_CAP_K = 0.8   # 解析里毒层的折扣：8 层上限与强者速胜让后几层打不满（v1.2 MC 复核附毒偏弱 10–20%）


def eff_value(effect: str, key: str, q: str, k: int, n: int):
    """第 k 式（1 起）的特效数值：按品质跨档线性插值；整数型四舍五入"""
    v = EFF[effect][key]
    lo, hi = TIER_SPAN[q]
    t = lo + (hi - lo) * (k - 1) / (n - 1) if n > 1 else lo
    i = min(int(math.floor(t)), 3)
    val = v[i] + (v[min(i + 1, 3)] - v[i]) * (t - i)
    return int(math.floor(val + 0.5)) if key in INT_KEYS else val


def eff_avg(effect: str, key: str, q: str) -> float:
    n = NFORMS[q]
    return sum(eff_value(effect, key, q, k, n) for k in range(1, n + 1)) / n


def eff_vals(effect: str, q: str, k: int, n: int) -> dict:
    if effect not in EFF:
        return {}
    return {key: eff_value(effect, key, q, k, n) for key in EFF[effect] if key != "n"}


def base_params(row: dict) -> dict:
    q = row["quality"]
    return dict(mult0=MULT_BASE[q] * MULT_K[row["mult_t"]],
                cost=round(COST_BASE[q] * COST_K[row["cost_t"]]),
                p=TRIGGER_P[row["trig_t"]],
                cd=CD_BASE[q] + CD_K[row["cd_t"]])


# ═══════════════════════════════════════════════════════════
# 解析强度：同品质的武学必须同强度（名录 §1.2，区间 ±5%）；倍率是校准阀门
#   参考环境：境界 4 平台末、上乘内功、前沿附近的敌人。所有武学用同一参考，比的是相对值。
# ═══════════════════════════════════════════════════════════

BAND = 0.05                                   # 解析强度区间 ±5%
REF = dict(crit=0.30, cd=1.9, rounds=15.0, e_hit=148.0, p_dodge=19.0, e_dfs=29.2, def_k=289.0, poison_coef=0.12)


K_CTX = 3   # 强度按「3 门同款同装」的语境算：真气由 3 门分摊，耗气才会见底（单门时真气永远够用，耗气成了死参数）


def cast_fraction(cost: float, p: float, cd: int, s: float, effect: str | None, q: str) -> float:
    """每门每回合出招的比例：冷却 + 触发决定上限 1/(cd + 1/p)；真气决定另一上限 20/(K_CTX × 有效耗气 + 20)"""
    f_cd = 1.0 / (cd + 1.0 / p)
    eff_cost = cost
    if effect == "回气":
        eff_cost = cost * (1 - s * eff_avg("回气", "refund", q))
    elif effect == "回元":
        eff_cost = cost - s * eff_avg("回元", "qi", q)
    f_qi = 1.0 if eff_cost <= 0 else REGEN / (K_CTX * eff_cost + REGEN)
    return min(f_cd, f_qi)


def strength(params: dict, effect: str | None, q: str) -> float:
    """强度 = 每回合期望输出（相对只普攻）÷ (1 − 受击减免)。防御类特效折成受击减免。"""
    n = NFORMS[q]
    s = 1.0                                       # 每一式都带特效（W17）；数值取各式平均
    f = cast_fraction(params["cost"], params["p"], params["cd"], s, effect, q)
    mult_avg = params["mult0"] + MULT_STEP * (n - 1) / 2
    out = (1 - f) + f * mult_avg
    r = 0.0
    e_hit0 = REF["e_hit"] / (REF["e_hit"] + REF["p_dodge"])
    mit0 = REF["def_k"] / (REF["def_k"] + REF["e_dfs"])
    if effect == "必暴":
        base_c = 1 + REF["crit"] * (REF["cd"] - 1)
        out += f * s * mult_avg * (REF["cd"] * (1 + eff_avg("必暴", "cdmg", q)) / base_c - 1)
    elif effect == "连击":
        out += f * s * eff_avg("连击", "chance", q)
    elif effect == "附毒":
        out += f * s * (1 + eff_avg("附毒", "extra", q)) * REF["poison_coef"] * REF["rounds"] / 2 * POISON_CAP_K
    elif effect == "透劲":
        mit1 = REF["def_k"] / (REF["def_k"] + REF["e_dfs"] * (1 - eff_avg("透劲", "pen", q)))
        out += f * s * mult_avg * (mit1 / mit0 - 1)
    elif effect == "破绽":
        u = 1 - (1 - f * s) ** EFF["破绽"]["n"]
        mit1 = REF["def_k"] / (REF["def_k"] + REF["e_dfs"] * (1 - eff_avg("破绽", "dfs", q)))
        out *= 1 + u * (mit1 / mit0 - 1)
    elif effect == "运劲":
        u = 1 - (1 - f * s) ** EFF["运劲"]["n"]
        out *= 1 + u * eff_avg("运劲", "atk", q)
    elif effect == "凝眸":
        u = 1 - (1 - f * s) ** EFF["凝眸"]["n"]
        base_c = 1 + REF["crit"] * (REF["cd"] - 1)
        out *= 1 + u * eff_avg("凝眸", "crit", q) * (REF["cd"] - 1) / base_c
    elif effect == "护体":
        r = min(0.5, f * s * eff_avg("护体", "shield", q) * REF["rounds"])
    elif effect == "轻身":
        u = 1 - (1 - f * s) ** EFF["轻身"]["n"]
        e1 = REF["e_hit"] / (REF["e_hit"] + REF["p_dodge"] + eff_avg("轻身", "dodge", q))
        r = u * (1 - e1 / e_hit0)
    elif effect == "卸力":
        r = (1 - (1 - f * s) ** EFF["卸力"]["n"]) * eff_avg("卸力", "atk", q)
    elif effect == "迷目":
        u = 1 - (1 - f * s) ** EFF["迷目"]["n"]
        h = REF["e_hit"] - eff_avg("迷目", "hit", q)
        r = u * (1 - (h / (h + REF["p_dodge"])) / e_hit0)
    elif effect == "封穴":
        r = f * s * eff_avg("封穴", "p", q)
    return out / (1 - r)


ANCHOR = {"寻常": 1.166, "上乘": 1.140, "绝学": 1.094}   # v1.2 的品质锚（中/中/中/中 配四种旧特效、特效只挂首末式时的平均强度）


def quality_target(q: str) -> float:
    """品质锚固定为 v1.2 的数值：特效改为每式都带后，总强度不变，由倍率吸收（否则武学整体变强、装+武满配破 1.2）"""
    return ANCHOR[q]


def calibrate(row: dict) -> dict:
    """反解倍率，使强度 = 品质锚。倍率不低于 1.0（招式不弱于普攻）；到底仍超锚时改降触发几率（另一个阀门）。
    独门武学（蓄势 / 反震 / 引爆）不校准，沿用现行参数。"""
    p = base_params(row)
    q, eff = row["quality"], row["effect"]
    if eff in SIGNATURE:
        p["mult0"] = MULT_BASE[q]
        return p
    target = quality_target(q)
    p["p_cut"] = 0
    while strength(dict(p, mult0=1.0), eff, q) > target and p["p"] > 0.08:
        p["p"] = round(p["p"] - 0.02, 2)
        p["p_cut"] += 1
    lo, hi = 1.0, 4.0
    for _ in range(50):
        mid = (lo + hi) / 2
        if strength(dict(p, mult0=mid), eff, q) < target:
            lo = mid
        else:
            hi = mid
    p["mult0"] = round((lo + hi) / 2, 2)
    return p


def style_mult(row: dict) -> float:
    """只看风格（不带特效）的校准倍率：用来核对名录里的倍率倾向是否保住"""
    p = base_params(row)
    target = quality_target(row["quality"])
    lo, hi = 0.5, 4.0
    for _ in range(40):
        mid = (lo + hi) / 2
        if strength(dict(p, mult0=mid), None, row["quality"]) < target:
            lo = mid
        else:
            hi = mid
    return (lo + hi) / 2


def make_skill(row: dict, params: dict, unlocked: int | None = None, shulian: int = 3) -> dict:
    """已领悟 unlocked 式（缺省全部），每式熟练 shulian 档。每一式都带特效，数值随式递增（eff_value）；
    熟练改作用于耗气 / 触发 / 冷却（SHU），不再加倍率。sim 里各式熟练同档，故耗气与冷却挂在武学上。"""
    q = row["quality"]
    n_all = NFORMS[q]
    n = n_all if unlocked is None else unlocked
    cost_k, p_bonus, cd_cut = SHU[shulian]
    forms = [dict(mult=params["mult0"] + MULT_STEP * (k - 1), effect=row["effect"],
                  val=eff_vals(row["effect"], q, k, n_all)) for k in range(1, n + 1)]
    return dict(name=row["name"], quality=q, tag=row["route"] or "_", cost=round(params["cost"] * cost_k),
                cd=max(1, params["cd"] - cd_cut), p=params["p"] * (1 + p_bonus), forms=forms)


def equip(route: str, skills) -> list:
    """装配：同路数吃共鸣 ×1.10（现行）"""
    out = []
    for s in skills:
        k = W.RESONANCE_MULT if s["tag"] == route else 1.0
        out.append(dict(s, forms=[dict(f, mult=f["mult"] * k) for f in s["forms"]]))
    return out


# ═══════════════════════════════════════════════════════════
# 装备（design.md §3）：四部位 × 五品阶 × 词条；装备等级 = 掉落关卡当量
# ═══════════════════════════════════════════════════════════

SLOTS = ["兵器", "暗器", "衣甲", "佩饰"]
GRADES = ["白", "绿", "蓝", "紫", "橙"]
GI = {g: i for i, g in enumerate(GRADES)}
GRADE_K = {"白": 1.00, "绿": 1.10, "蓝": 1.20, "紫": 1.30, "橙": 1.40}   # 基础属性的品阶系数
AFFIX_K = {"白": 1.0, "绿": 1.2, "蓝": 1.4, "紫": 1.6, "橙": 1.8}         # 词条取值的品阶系数
AFFIX_N = {"白": (0, 1), "绿": (1, 2), "蓝": (2, 3), "紫": (3, 4), "橙": (4, 4)}
# 基础属性占「同当量玩家属性」的比例（曲线 1.7^(等级−1) 与敌我同形）
BASE_FRAC = dict(weapon_atk=0.034, dart_atk=0.017, dart_hit=0.85, armor_hp=0.034, armor_dfs=0.034, trinket=1.35)
ROLL = (0.90, 1.10)
# 词条池按部位（design.md §3.2），取值区间按品阶（下限, 上限）
AFFIX_BASE = {                          # 白装区间；其它品阶 × AFFIX_K
    "atk_pct": (0.017, 0.027), "crit_pp": (0.007, 0.011), "cd_pp": (0.017, 0.030), "hit": (1.7, 2.7),
    "boss_pct": (0.020, 0.034), "hp_pct": (0.017, 0.027), "dfs_pct": (0.017, 0.027), "dodge": (1.0, 1.7),
    "qi": (3.4, 5.1), "wx_pct": (0.017, 0.027),
}   # hit / dodge 再乘 (1 + 等级/5)


def affix_range(a: str, grade: str) -> tuple[float, float]:
    r0, r1 = AFFIX_BASE[a]
    return r0 * AFFIX_K[grade], r1 * AFFIX_K[grade]


AFFIX_POOL = {
    "兵器": ["atk_pct", "crit_pp", "cd_pp", "hit", "boss_pct"],
    "暗器": ["crit_pp", "cd_pp", "hit", "boss_pct", "wx_pct"],
    "衣甲": ["hp_pct", "dfs_pct", "dodge", "qi"],
    "佩饰": ["crit_pp", "hit", "dodge", "qi", "wx_pct"],
}


def curve(level: float) -> float:
    return 1.7 ** (level - 1)


def make_item(slot: str, grade: str, level: float, rng: random.Random | None = None,
              roll: float | None = None, affix_roll: float | None = None, n_affix: int | None = None) -> dict:
    """rng=None 时用 roll / affix_roll（0–1）定随机位置，便于造「标准」「满配」样本"""
    g = GRADE_K[grade]
    rl = (ROLL[0] + (ROLL[1] - ROLL[0]) * (roll if rng is None else rng.random()))
    it = dict(slot=slot, grade=grade, level=level, stats={}, affixes={})
    c = curve(level) * g * rl
    if slot == "兵器":
        it["stats"]["atk"] = BASE_FRAC["weapon_atk"] * 10 * c
    elif slot == "暗器":
        it["stats"]["atk"] = BASE_FRAC["dart_atk"] * 10 * c
        it["stats"]["hit"] = BASE_FRAC["dart_hit"] * g * rl * (1 + level / 5)
    elif slot == "衣甲":
        it["stats"]["hp"] = BASE_FRAC["armor_hp"] * 100 * c
        it["stats"]["dfs"] = BASE_FRAC["armor_dfs"] * 5 * c
    else:
        key = "hit" if (rng.random() < 0.5 if rng else True) else "dodge"
        it["stats"][key] = BASE_FRAC["trinket"] * g * rl * (1 + level / 5)
    lo, hi = AFFIX_N[grade]
    k = n_affix if n_affix is not None else (rng.randint(lo, hi) if rng else hi)
    pool = list(AFFIX_POOL[slot])
    if rng:
        rng.shuffle(pool)
    for a in pool[:k]:
        r0, r1 = affix_range(a, grade)
        v = r0 + (r1 - r0) * (affix_roll if rng is None else rng.random())
        if a in ("hit", "dodge"):
            v *= (1 + level / 5)
        it["affixes"][a] = v
    return it


def gear_set(grade: str, level: float, roll: float, affix_roll: float, n_affix: int | None = None) -> list:
    return [make_item(s, grade, level, roll=roll, affix_roll=affix_roll, n_affix=n_affix) for s in SLOTS]


def apply_gear(build: dict, items: list) -> dict:
    """开战前把装备叠进构筑（与伤势同一条安全通道，fight 内部不认识装备）"""
    b = dict(build)
    add = dict(atk=0.0, hp=0.0, dfs=0.0, hit=0.0, dodge=0.0)
    pct = dict(atk_pct=0.0, hp_pct=0.0, dfs_pct=0.0, crit_pp=0.0, cd_pp=0.0, qi=0.0, wx_pct=0.0, boss_pct=0.0)
    for it in items:
        for k, v in it["stats"].items():
            add[k] += v
        for k, v in it["affixes"].items():
            if k not in ("hit", "dodge"):
                pct[k] += v
    b["atk"] = (b["atk"] + add["atk"]) * (1 + pct["atk_pct"])
    b["hp"] = (b["hp"] + add["hp"]) * (1 + pct["hp_pct"])
    b["dfs"] = (b["dfs"] + add["dfs"]) * (1 + pct["dfs_pct"])
    b["hit"] += add["hit"] + sum(it["affixes"].get("hit", 0) for it in items)
    b["dodge"] += add["dodge"] + sum(it["affixes"].get("dodge", 0) for it in items)
    b["crit"] = min(0.80, b["crit"] + pct["crit_pp"])
    b["cd"] += pct["cd_pp"]
    b["qi_max"] = b.get("qi_max", 0) + pct["qi"]
    b["wx_pct"] = pct["wx_pct"]
    b["boss_pct"] = pct["boss_pct"]
    return b


# ═══════════════════════════════════════════════════════════
# 扩展战斗 fight_y：fight_x + 装备字段 + 触发求和 + 新特效（增益 / 减益持续回合）
# ═══════════════════════════════════════════════════════════

def fight_y(build: dict, enemy: dict, loadout=(), def_k=None, rng: random.Random | None = None,
            stats: dict | None = None):
    ev = rng is None
    assert not (ev and loadout), "EV 模式不支持武学"
    roll = (lambda p: p) if ev else (lambda p: 1.0 if rng.random() < p else 0.0)
    spread = (lambda: 1.0) if ev else (lambda: 1 + W.DMG_SPREAD * (2 * rng.random() - 1))
    php = build["hp"]
    pshield = build["hp"] * build["shield_pct"]
    ehp = enemy["hp"]
    tags = enemy["tags"]
    is_boss = ("高血" in tags) or ("高防" in tags and "高攻" in tags)
    dmg_mult = 1.0 + (build.get("boss_pct", 0.0) if is_boss else 0.0)
    wx_mult = 1.0 + build.get("wx_pct", 0.0)
    sq = 0.0
    elayers = players_poison = ab_stacks = 0.0
    qmax = build.get("qi_max", 0)
    qi = qmax
    cds = [0] * len(loadout)
    pz = build["poison"]
    cap = pz["cap"] or 8
    coef = pz["coef"] or 0.12
    st = stats if stats is not None else {}
    for key in ("rounds", "bursts", "pbursts", "thorns", "casts", "sq_gain", "layer_gain", "cast_rounds"):
        st.setdefault(key, 0.0)
    # 持续状态：名字 → [剩余回合, 数值]
    pb = {}      # 己方：运劲 / 凝眸 / 轻身
    eb = {}      # 敌方：卸力 / 迷目 / 破绽
    skip = False

    def done(win, rd):
        st["rounds"] += rd
        return win, rd, max(php, 0) / build["hp"]

    for rd in range(1, m.ROUND_CAP + 1):
        if rd == 1 and pz["init"]:
            elayers = min(cap, pz["init"])
        p_crit = min(0.80, build["crit"] + (pb["凝眸"][1] if "凝眸" in pb else 0.0))
        p_atk = build["atk"] * (1 + (pb["运劲"][1] if "运劲" in pb else 0.0))
        p_dodge = build["dodge"] + (pb["轻身"][1] if "轻身" in pb else 0.0)
        e_atk_k = 1 - (eb["卸力"][1] if "卸力" in eb else 0.0)
        e_hit_v = enemy["hit"] - (eb["迷目"][1] if "迷目" in eb else 0.0)
        e_dfs = enemy["dfs"] * (1 - (eb["破绽"][1] if "破绽" in eb else 0.0))
        p_hit = m.hit_chance(build["hit"], enemy["dodge"])
        e_hit = m.hit_chance(e_hit_v, p_dodge)
        # ---- 玩家行动 ----
        forced = rd == 1 and build.get("first_crit")
        cand = [i for i, s in enumerate(loadout) if cds[i] == 0 and qi >= s["cost"]]
        form = None
        s = None
        if cand:
            total = min(TRIGGER_CAP, sum(loadout[i]["p"] for i in cand))
            if roll(total):
                r = rng.random() * sum(loadout[i]["p"] for i in cand)
                acc = 0.0
                i = cand[-1]
                for j in cand:
                    acc += loadout[j]["p"]
                    if r < acc:
                        i = j
                        break
                s = loadout[i]
                form = rng.choice(s["forms"])
                qi -= s["cost"] * (1 - form["val"]["refund"] if form["effect"] == "回气" else 1)
                qi = min(qmax, qi)
                cds[i] = s["cd"] + 1
                st["casts"] += 1
        for j in range(len(cds)):
            cds[j] = max(0, cds[j] - 1)
        mult = form["mult"] * wx_mult if form else 1.0
        eff = form["effect"] if form else None
        q = s["quality"] if s else "寻常"
        if eff == "蓄势":
            mult *= 1 + 0.10 * st.get("_fight_casts", 0)
        if form:
            st["_fight_casts"] = st.get("_fight_casts", 0) + 1
        hit = roll(p_hit)
        if ev:
            crit_ev = build["cd"] if forced else (1 - build["crit"]) + build["crit"] * build["cd"]
            crit = 1.0 if forced else build["crit"]
        else:
            crit = 1.0 if (forced or eff == "必暴") else roll(p_crit)
            crit_ev = build["cd"] * (1 + form["val"]["cdmg"] if eff == "必暴" else 1.0) if crit else 1.0
        plain = 1.0 if form else build.get("plain_mult", 1.0)
        base_atk = p_atk + (build["dfs"] if eff == "反震" else 0.0)
        dfs_eff = e_dfs * (1 - form["val"]["pen"]) if eff == "透劲" else e_dfs
        dealt = base_atk * mult * crit_ev * m.mitig(dfs_eff, def_k) * hit * dmg_mult * plain * spread()
        if eff == "引爆" and elayers > 0:
            dealt += elayers * build["atk"] * coef * 3 * dmg_mult
            elayers = 0
        if eff == "连击" and roll(form["val"]["chance"]):
            h2 = roll(p_hit)
            c2 = build["cd"] if roll(p_crit) else 1.0
            dealt += p_atk * c2 * m.mitig(e_dfs, def_k) * h2 * dmg_mult * build.get("plain_mult", 1.0) * spread()
            # 连击的普攻不攒剑意 / 不叠毒（简化）
        if not form:
            qi = min(qmax, qi + REGEN)
        if eff == "回元":
            qi = min(qmax, qi + form["val"]["qi"])
        if build["sq_need"] < 99:
            st["sq_gain"] += (p_hit * crit) if ev else (hit * crit)
            sq += (p_hit * crit) if ev else (hit * crit)
            if sq >= build["sq_need"]:
                sq -= build["sq_need"]
                dealt += p_atk * build["burst_mult"] * m.mitig(e_dfs, def_k) * dmg_mult * spread()
                st["bursts"] += 1
        per_hit = pz["per_hit"] + ((1 + roll(form["val"]["extra"])) if eff == "附毒" else 0)
        if per_hit:
            st["layer_gain"] += (p_hit if ev else hit) * per_hit
            elayers = min(cap, elayers + (p_hit if ev else hit) * per_hit)
        if eff == "护体":
            pshield += form["val"]["shield"] * build["hp"]
        if eff in ("运劲", "凝眸", "轻身") and hit:
            key = {"运劲": "atk", "凝眸": "crit", "轻身": "dodge"}[eff]
            pb[eff] = [EFF[eff]["n"], form["val"][key]]
        if eff in ("卸力", "迷目", "破绽") and hit:
            key = {"卸力": "atk", "迷目": "hit", "破绽": "dfs"}[eff]
            eb[eff] = [EFF[eff]["n"], form["val"][key]]
        if eff == "封穴" and hit and roll(form["val"]["p"]):
            skip = True
        ehp -= dealt
        if "反伤" in tags and dealt > 0:
            refl = dealt * m.THORNS_ENEMY
            absorb = min(pshield, refl); pshield -= absorb
            php -= (refl - absorb)
        if ehp <= 0:
            return done(True, rd)
        # ---- 敌人行动 ----
        if skip:
            skip = False
        else:
            eatk = enemy["atk"] * e_atk_k
            if "狂暴" in tags and rd >= m.ENRAGE_START:
                eatk *= (1 + m.ENRAGE_STEP * (rd - m.ENRAGE_START + 1))
            ehit = roll(e_hit)
            pdfs = build["dfs"] * (1 - min(ab_stacks, 3) * m.ARMOR_BREAK_PP)
            edmg = eatk * ehit * m.mitig(pdfs, def_k) * spread()
            if build["lowhp_dr"] and php < 0.30 * build["hp"]:
                edmg *= (1 - build["lowhp_dr"])
            absorb = min(pshield, edmg); pshield -= absorb
            php -= (edmg - absorb)
            if build["thorns"] and edmg > 0:
                ehp -= edmg * build["thorns"]
                st["thorns"] += edmg * build["thorns"]
            if "破甲" in tags:
                ab_stacks = min(3, ab_stacks + ehit)
            if "毒" in tags:
                players_poison = min(5, players_poison + ehit)
            if ehp <= 0:
                return done(True, rd)
        # ---- 回合结束 ----
        if elayers > 0:
            ehp -= elayers * build["atk"] * coef * dmg_mult
            if pz["burst"] and elayers >= cap - 1e-9:
                ehp -= cap * build["atk"] * pz["burst"] * dmg_mult
                elayers = 0
                st["pbursts"] += 1
            if ehp <= 0:
                return done(True, rd)
        if players_poison > 0:
            php -= players_poison * enemy["atk"] * m.ENEMY_POISON_COEF
        if "净化" in tags and rd % m.PURIFY_EVERY == 0:
            elayers = 0
        for d in (pb, eb):
            for k in list(d):
                d[k][0] -= 1
                if d[k][0] <= 0:
                    del d[k]
        if php <= 0:
            return done(False, rd)
    return done(False, m.ROUND_CAP)


N_TRIALS = 60 if QUICK else 200
GRID = 0.05
SPAN = (-1.0, 2.0)


def winrate(build, x, loadout, tags=(), n=N_TRIALS, stats=None) -> float:
    e = L.enemy_at(x, tags)
    k = L.def_k(x)
    w = 0
    for i in range(n):
        w += fight_y(build, e, loadout, def_k=k, rng=random.Random(7919 * i + 13), stats=stats)[0]
    return w / n


def frontier_mc(build, loadout=(), tags=(), x_ev=None) -> float:
    """期望前沿：胜率曲线下的面积（同 sect-neigong/sim.py，指标口径不变）"""
    if x_ev is None:
        x_ev = L.frontier_x(build, tags)
    x = x_ev + SPAN[0]
    area = x
    while x < x_ev + SPAN[1]:
        area += winrate(build, x + GRID / 2, loadout, tags) * GRID
        x += GRID
    return area


def _task(args):
    """多进程任务：(构筑, 装备, 武学装配, 标签, EV 前沿锚) → 期望前沿"""
    build, items, loadout, tags, x_ev = args
    b = apply_gear(build, items) if items else build
    return frontier_mc(b, loadout, tags, x_ev)


def run_tasks(tasks: list) -> list:
    if QUICK or len(tasks) < 4:
        return [_task(t) for t in tasks]
    with Pool() as pool:
        return pool.map(_task, tasks)


# ═══════════════════════════════════════════════════════════
# 检查点与构筑
# ═══════════════════════════════════════════════════════════

def checkpoints():
    return W.checkpoints()          # [(天, 境界, 重数)] 各境界平台末


def build_at(route: str, realm: int, lv: int, q: str = "寻常") -> dict:
    return W.neigong_build(route, realm, lv, q)


def catalog_by(q: str, batch: int | None = None, route: str | None = None) -> list[dict]:
    return [r for r in CATALOG if r["quality"] == q and (batch is None or r["batch"] <= batch)
            and (route is None or r["route"] == route)]


def loadout_std(route: str, realm: int, params: dict) -> list:
    """标准武学：同 sect-neigong/sim.py loadout_std（低一档品质、领悟一半、熟练档、无共鸣），取第一批里的武学"""
    q = {"寻常": "寻常", "上乘": "寻常", "绝学": "上乘"}[W.best_quality(realm)]
    n = W.SLOTS[realm]
    other = {"huashan": "shaolin", "shaolin": "tangmen", "tangmen": "huashan"}[route]
    rows = [r for r in catalog_by(q, 1) if r["route"] == other and r["effect"] not in SIGNATURE][:n]
    rows += [r for r in catalog_by(q, 1) if r["route"] is None and r["effect"] not in SIGNATURE][:n - len(rows)]
    k = max(1, NFORMS[q] // 2 + 1)
    return equip(route, [make_skill(r, params[r["name"]], unlocked=k, shulian=1) for r in rows[:n]])


def loadout_max(route: str, realm: int, params: dict) -> list:
    """满配：最高可得品质、全部领悟、圆熟、全同路数（吃共鸣）"""
    q = W.best_quality(realm)
    n = W.SLOTS[realm]
    rows = [r for r in catalog_by(q, 1) if r["route"] == route and r["effect"] not in SIGNATURE]
    rows = (rows * 3)[:n]
    return equip(route, [make_skill(r, params[r["name"]]) for r in rows])


# ═══════════════════════════════════════════════════════════
# 掉落（design.md §3.4 / §4）：概率是设计参数；战斗时长只用于折算「一世拿到几件」
# ═══════════════════════════════════════════════════════════

DROP_P = {"normal": 0.06, "elite": 0.20, "boss": 1.00}            # 每场胜利掉一件装备的概率
WX_P = {"normal": 0.03, "elite": 0.10, "boss": 0.50}              # 每场胜利掉一次武学（整式 / 残页）的概率
GRADE_W = lambda pos: {"白": 55 - 40 * pos, "绿": 35, "蓝": 8 + 14 * pos, "紫": 0.06 + 0.18 * pos, "橙": 0.01 + 0.03 * pos}
ELITE_SHIFT_P = 0.3                                                # 精英：三成概率品阶 +1；Boss 必 +1
PAGES = {"上乘": 5, "绝学": 7}                                      # 每式残页数（本 sim 【五】按拼齐节奏定）
SEC_PER_ROUND = 2.7                                                # 战报节拍（BattlePane：约 2.7 秒一回合）
SEC_OVERHEAD = 2.5                                                 # 开场 / 收尾 / 连战间隔
OFFLINE_H, OFFLINE_EFF, OFFLINE_CAP_H = 24 - ps.ONLINE_H, ps.OFFLINE_EFF, 24
INTRO_DROP_AFTER_TEACH = True                                      # 裁决 19（2026-10-12 改）：传功前不掉，传功后入门关掉白绿；False 为旧规则对照


def grade_dist(pos: float, kind: str) -> dict:
    w = GRADE_W(max(0.0, min(1.0, pos)))
    tot = sum(w.values())
    d = {g: w[g] / tot for g in GRADES}
    shift = 1.0 if kind == "boss" else (ELITE_SHIFT_P if kind == "elite" else 0.0)
    if shift:
        out = {g: 0.0 for g in GRADES}
        for g, pg in d.items():
            up = GRADES[min(4, GI[g] + 1)]
            out[g] += pg * (1 - shift)
            out[up] += pg * shift
        d = out
    return d


def battle_seconds(rounds: float) -> float:
    return SEC_PER_ROUND * rounds + SEC_OVERHEAD


# ═══════════════════════════════════════════════════════════
# 境界 1：从入门关到首次卡关（design.md §5）
# ═══════════════════════════════════════════════════════════

STAGES_JSON = os.path.join(HERE, "..", "..", "..", "code", "src", "engine", "data", "longline-stages.json")
R1_HOURS = 2.7 * (1 + ps.CHONGXUE_OVERHEAD[1])     # 境界 1 修炼 2.7h（pacing_sim 附表）+ 冲穴附加


def track_stages(mp: int, tier: int) -> list[dict]:
    d = json.load(open(STAGES_JSON, encoding="utf-8"))
    return [t for t in d["tracks"] if t["map"] == mp and t["tier"] == tier][0]["stages"]


def zhong_at(hours: float) -> int:
    """境界 1 内：内力产出的 SKILL_SHARE 份额进内功重数（第 n 重 3,490 × 1.08^(n−1)）"""
    wallet = ps.rate(1) * hours * 3600 * ps.SKILL_SHARE
    z = 0
    while wallet >= 3490 * 1.08 ** z:
        wallet -= 3490 * 1.08 ** z
        z += 1
    return z


def realm1_build(route: str | None, zhong: int) -> dict:
    if route is None:
        b = E.bare_build(1)
    else:
        b = W.neigong_build(route, 1, zhong, "寻常")
    b["qi_max"] = W.qi_max(1, zhong, "寻常") if route else 0
    return b


def item_score(it: dict) -> float:
    s = sum(it["stats"].values()) / (curve(it["level"]) + 1) + 100 * GI[it["grade"]] + 10 * len(it["affixes"])
    return s


def realm1_session(route: str, params: dict, seed: int = 1, hours: float = R1_HOURS, intro_drop: bool = False) -> dict:
    """一个全新玩家的境界 1：裸属性推入门关 → 1-7 必败 → 选内功 → 推关 / 挂机交替，捡装备与武学。
    行为：每次优先试打下一关；输了就退回上一关挂机 5 场再试。返回时间线与首次卡关的关号。"""
    rng = random.Random(seed)
    stages = track_stages(1, 0)
    cat_of = {r["name"]: r for r in CATALOG}
    pool_ordinary = [r for r in CATALOG if r["quality"] == "寻常" and r["batch"] == 1]
    t = 0.0
    cleared = 0
    route_chosen = False
    gear: dict[str, dict | None] = {s: None for s in SLOTS}
    forms_owned: dict[str, set] = {}
    learned: dict[str, int] = {}          # 武学 → 已学会到第几式（寻常：全本自动学会，按顺序）
    timeline = []
    first_loss = None
    taught_at = None
    farm_left = 0
    events = []

    def usable(r: dict) -> bool:
        if r["cat"] in ("拳", "掌", "指", "腿"):
            return True
        if r["cat"] == "暗器":
            return gear["暗器"] is not None
        w = gear["兵器"]
        return w is not None and w.get("cat") == r["cat"]

    def current_loadout():
        best, best_v = None, -1
        for name, k in learned.items():
            r = cat_of[name]
            if k >= 1 and usable(r):
                v = k + (0.5 if r["route"] == route else 0)
                if v > best_v:
                    best, best_v = r, v
        if best is None:
            return []
        return equip(route, [make_skill(best, params[best["name"]], unlocked=learned[best["name"]], shulian=0)])

    while t < hours:
        z = zhong_at(t) if route_chosen else 0
        b = realm1_build(route if route_chosen else None, z)
        b = apply_gear(b, [g for g in gear.values() if g]) if route_chosen else b
        lo = current_loadout() if route_chosen else []
        target = cleared + 1 if farm_left == 0 else cleared
        if target > len(stages):
            break
        sdef = stages[target - 1]
        e = L.enemy_at(sdef["x"], tuple(sdef["tags"]))
        st = {}
        win, rd, _ = fight_y(b, e, lo, def_k=L.def_k(sdef["x"]), rng=rng, stats=st)
        t += battle_seconds(rd) / 3600
        if win:
            if target > cleared:
                cleared = target
                timeline.append((round(t, 2), cleared))
            else:
                farm_left -= 1
            if route_chosen and (target > 6 or intro_drop):            # 入门关不掉落（裁决 19），除非对照开关打开
                if rng.random() < DROP_P[sdef["kind"]]:
                    slot = rng.choice(SLOTS)
                    gd = grade_dist(0.0, sdef["kind"])
                    grade = rng.choices(GRADES, weights=[gd[g] for g in GRADES])[0]
                    if target <= 6:
                        grade = GRADES[min(GI[grade], 1)]          # 入门关只出白绿
                    it = make_item(slot, grade, sdef["x"], rng)
                    if slot == "兵器":
                        it["cat"] = rng.choice(["刀", "枪", "剑", "棍"])
                    if gear[slot] is None or item_score(it) > item_score(gear[slot]):
                        gear[slot] = it
                        events.append((round(t, 2), f"穿上{grade}{slot}" + (f"（{it['cat']}）" if slot == "兵器" else "")))
                if rng.random() < WX_P[sdef["kind"]]:
                    r = rng.choice(pool_ordinary)
                    k = rng.randint(1, NFORMS["寻常"])
                    forms_owned.setdefault(r["name"], set()).add(k)
                    got = learned.get(r["name"], 0)
                    while got + 1 in forms_owned[r["name"]]:
                        got += 1
                    if got > learned.get(r["name"], 0):
                        learned[r["name"]] = got
                        events.append((round(t, 2), f"学会{r['name']}第{got}式" + ("" if usable(r) else "（无合用兵器）")))
        else:
            if not route_chosen and target == 7:
                route_chosen = True
                taught_at = t
                events.append((round(t, 2), f"1-7 战败 → 传功，修{ROUTE_NAME[route]}"))
            elif first_loss is None and route_chosen and target > 7:
                first_loss = target
                events.append((round(t, 2), f"首次卡在第 {target} 关 → 书肆开张"))
            farm_left = 5 if cleared >= 1 else 0
    return dict(cleared=cleared, timeline=timeline, events=events, first_loss=first_loss, route=route)


# ═══════════════════════════════════════════════════════════
# 主流程
# ═══════════════════════════════════════════════════════════

GEAR_STD_TARGET = (0.20, 0.40)      # 标准装备余量 +0.3 ±0.1
GEAR_MAX_CAP = 0.60                 # 满配装备 ≤ 0.6
TOTAL_CAP = 1.20                    # 装备 + 武学满配 ≤ 1.2
MC_NOISE = 0.02                     # 期望前沿的 MC 噪声（200 次 × 0.05 格）
STYLE_SPREAD_CAP = 0.15             # MC 复核：同品质各风格 / 各特效的余量相差 ≤ 0.15


def main():
    print("=" * 100)
    print("战斗挂机：掉落与装备 sim —— issue #45 第 3 步" + ("（quick）" if QUICK else ""))
    print("=" * 100)
    crit = []

    # ───────── 【零】金标准对照 ─────────
    ok0 = True
    for r in ROUTES:
        for realm, z in ((2, 6), (3, 41), (4, 70), (5, 95)):
            b = L.build(r, realm, z)
            for x in (realm + 1.0, realm + 3.0):
                e = L.enemy_at(x, ("狂暴",))
                ok0 &= fight_y(b, e, def_k=L.def_k(x))[:2] == m.fight(b, e, def_k=L.def_k(x))[:2]
    print(f"\n【零】金标准对照（不穿装备、不装武学的 EV 战斗 = mvp0 fight）：{'一致' if ok0 else '不一致'}")
    crit.append(("fight_y 不穿装备不装武学时与金标准逐项一致", ok0, ""))

    # ───────── 【一】武学参数：解析校准 ─────────
    params = {r["name"]: calibrate(r) for r in CATALOG}
    print("\n【一】武学五项参数（倍率由「同品质同强度」反解；强度 = 期望输出 ÷ (1 − 受击减免)，参考境界 4）")
    ok1 = True
    band_fail = []
    for q in QUAL:
        tgt = quality_target(q)
        rows = [r for r in CATALOG if r["quality"] == q and r["effect"] not in SIGNATURE]
        ss = [strength(params[r["name"]], r["effect"], q) for r in rows]
        bad = [r["name"] for r, s in zip(rows, ss) if abs(s / tgt - 1) > BAND]
        band_fail += bad
        mults = [params[r["name"]]["mult0"] for r in rows]
        print(f"  {q}：锚 {tgt:.3f} · {len(rows)} 门强度 {min(ss) / tgt:.3f}–{max(ss) / tgt:.3f} 倍锚 · "
              f"倍率 {min(mults):.2f}–{max(mults):.2f}（现行 {MULT_BASE[q]:.2f}）")
    ok1 = not band_fail
    crit.append((f"171 门（独门除外）解析强度落在品质锚 ±{BAND:.0%}", ok1, "；".join(band_fail[:5])))
    # 倾向是否保住：只看风格（不带特效）的校准倍率，重 / 猛 / 险 > 稳 > 快 / 绵；巧（倍率中、耗气低、触发高）落在稳与快之间
    ok1b = True
    for q in QUAL:
        by = {}
        for r in CATALOG:
            if r["quality"] == q and r["effect"] not in SIGNATURE:
                by.setdefault((r["mult_t"], r["cost_t"], r["trig_t"], r["cd_t"]), []).append(style_mult(r))
        med = {k: sorted(v)[len(v) // 2] for k, v in by.items()}
        hi_ = min(v for k, v in med.items() if k[0] == "高")
        mid_ = med.get(("中", "中", "中", "中"), float("nan"))
        lo_ = max(v for k, v in med.items() if k[0] == "低")
        ok1b &= hi_ >= mid_ >= lo_ and hi_ > lo_
        print(f"  {q} 风格倍率（不带特效）：" + " · ".join(f"{'/'.join(k)} {v:.2f}" for k, v in sorted(med.items(), key=lambda kv: -kv[1])))
    crit.append(("校准后倍率的倾向次序保住（高 ≥ 中 ≥ 低，只看风格）", ok1b, ""))
    cut = [(r["name"], params[r["name"]]["p_cut"]) for r in CATALOG if params[r["name"]].get("p_cut")]
    if cut:
        print(f"  倍率到底 1.0 仍超锚、改降触发几率的武学 {len(cut)} 门：" + "、".join(f"{n}（−{c * 2}pp）" for n, c in cut))
    # 现有 14 门改动幅度
    moved = [(r["name"], MULT_BASE[r["quality"]], params[r["name"]]["mult0"]) for r in CATALOG
             if r["exist"] and r["effect"] not in SIGNATURE]
    print("  现有武学倍率变动：" + " · ".join(f"{n} {a:.2f}→{b:.2f}" for n, a, b in moved))
    # 特效按品质分档
    print("  特效四档 Ⅰ–Ⅳ（第 1 式 → 末式：寻常 Ⅰ→Ⅱ、上乘 Ⅰ→Ⅲ、绝学 Ⅱ→Ⅳ，中间式插值）：" + " · ".join(
        f"{e} {'/'.join(str(v) for v in next(iter(x for k, x in d.items() if k != 'n')))}" + (f"（{d['n']} 回合）" if 'n' in d else "")
        for e, d in EFF.items()))
    print("  熟练四档（耗气系数 / 触发系数 / 冷却缩短）：" + " · ".join(f"{['生疏', '熟练', '精通', '圆熟'][k]} {v[0]}/{1 + v[1]:.2f}/−{v[2]}" for k, v in SHU.items()))

    cps = checkpoints()
    print("\n检查点：" + " · ".join(f"第{d}天 境界{r} {lv}重" for d, r, lv in cps))

    # ───────── 【二】装备余量 ─────────
    print("\n【二】余量（前沿较「寻常内功、不装武学、不穿装备」高出的境界当量）")
    print(f"  {'检查点':<12}{'路数':<5}{'标准装备':>8}{'一世末':>7}{'满配装备':>8}{'标准武学':>8}{'装+武标准':>9}{'装+武满配':>9}{'自举前沿':>8}")
    print("  标准装备 = 四件蓝、2 词条、中位掷、等级前沿 − 0.3；一世末 = 2 蓝 + 2 紫（3 词条）；满配 = 四件橙、4 词条、顶掷、等级 = 前沿")
    tasks, keys = [], []
    for d, realm, lv in cps:
        for r in ROUTES:
            base = build_at(r, realm, lv)
            x0 = L.frontier_x(base)
            bq = build_at(r, realm, lv, W.best_quality(realm))
            g_std = gear_set("蓝", x0 - 0.3, 0.5, 0.5, n_affix=2)
            g_end = [make_item(sl, "紫" if i % 2 else "蓝", x0 - 0.3, roll=0.5, affix_roll=0.5, n_affix=3 if i % 2 else 2)
                     for i, sl in enumerate(SLOTS)]
            g_max = gear_set("橙", x0, 1.0, 1.0)
            cfgs = {
                "base": (base, [], []),
                "g_std": (base, g_std, []),
                "g_max": (base, g_max, []),
                "g_end": (base, g_end, []),
                "w_std": (base, [], loadout_std(r, realm, params)),
                "gw_std": (base, g_std, loadout_std(r, realm, params)),
                "gw_max": (bq, g_max, loadout_max(r, realm, params)),
            }
            for k, (b, g, lo) in cfgs.items():
                tasks.append((b, g, lo, (), x0))
                keys.append((d, realm, r, k))
    res = dict(zip(keys, run_tasks(tasks)))
    ok_std = ok_max = ok_tot = True
    env = {}
    for d, realm, lv in cps:
        for r in ROUTES:
            x0 = res[(d, realm, r, "base")]
            dg = res[(d, realm, r, "g_std")] - x0
            dgm = res[(d, realm, r, "g_max")] - x0
            dge = res[(d, realm, r, "g_end")] - x0
            dw = res[(d, realm, r, "w_std")] - x0
            dgw = res[(d, realm, r, "gw_std")] - x0
            dgwm = res[(d, realm, r, "gw_max")] - x0
            # 自举：装备等级随前沿涨（1.7^Δ），穿着自己前沿掉的装备再推、再掉……不动点 Δ∞ ≈ Δ0 / (1 − Δ0·ln1.7)
            xb = x0 + dg / (1 - dg * math.log(1.7))
            env[(realm, r)] = (dg, dgm, dgwm)
            ok_std &= GEAR_STD_TARGET[0] <= dg <= GEAR_STD_TARGET[1]
            ok_max &= dgm <= GEAR_MAX_CAP
            ok_tot &= dgwm <= TOTAL_CAP + MC_NOISE
            print(f"  第{d:>3}天境界{realm} {ROUTE_NAME[r]:<4}{dg:>+8.2f}{dge:>+7.2f}{dgm:>+8.2f}{dw:>+8.2f}{dgw:>+9.2f}{dgwm:>+9.2f}{xb - x0:>+8.2f}")
    crit.append((f"标准装备余量在 {GEAR_STD_TARGET[0]}–{GEAR_STD_TARGET[1]}（目标 +0.3）", ok_std, ""))
    crit.append((f"满配装备余量 ≤ {GEAR_MAX_CAP}", ok_max, ""))
    crit.append((f"装备 + 武学满配余量 ≤ {TOTAL_CAP}（含 MC 噪声 ±{MC_NOISE}；一档难度差约 1.7）", ok_tot, ""))
    spread_ok = all(max(env[(rl, r)][1] for r in ROUTES) - min(env[(rl, r)][1] for r in ROUTES) <= 0.20
                    for rl in {k[0] for k in env})
    crit.append(("同一检查点三路数的满配装备余量相差 ≤ 0.20", spread_ok, ""))

    # ───────── 【三】武学 MC 复核：风格与特效的余量 ─────────
    d4, realm4, lv4 = cps[2]
    print(f"\n【三】MC 复核（第{d4}天境界{realm4}，3 门同款上乘武学、同路数）：各风格 / 各特效的余量")
    styles = {"快": ("低", "低", "高", "短"), "重": ("高", "高", "低", "长"), "稳": ("中", "中", "中", "中"),
              "巧": ("中", "低", "高", "中"), "猛": ("高", "中", "中", "长"), "绵": ("低", "低", "中", "短"),
              "险": ("高", "高", "中", "中")}
    tasks, keys = [], []
    probes = [(f"风格·{k}", dict(name=f"风格{k}", quality="上乘", route=None, cat="拳", mult_t=v[0], cost_t=v[1],
                                 trig_t=v[2], cd_t=v[3], effect="连击", exist=False, source="", batch=1))
              for k, v in styles.items()]
    probes += [(f"特效·{e}", dict(name=f"特效{e}", quality="上乘", route=None, cat="拳", mult_t="中", cost_t="中",
                                  trig_t="中", cd_t="中", effect=e, exist=False, source="", batch=1))
               for e in list(EFF) + ["必暴", "回气", "护体", "附毒"]]
    for r in ROUTES:
        base = build_at(r, realm4, lv4, "上乘")
        x0 = L.frontier_x(base)
        tasks.append((base, [], [], (), x0)); keys.append((r, "base"))
        for label, row in probes:
            row = dict(row, route=r)
            lo = equip(r, [make_skill(row, calibrate(row)) for _ in range(3)])
            tasks.append((base, [], lo, (), x0)); keys.append((r, label))
    res3 = dict(zip(keys, run_tasks(tasks)))
    ok3s = ok3e = True
    for group, labels in (("风格", [p[0] for p in probes if p[0].startswith("风格")]),
                          ("特效", [p[0] for p in probes if p[0].startswith("特效")])):
        vals = {lab: sum(res3[(r, lab)] - res3[(r, "base")] for r in ROUTES) / 3 for lab in labels}
        lo_, hi_ = min(vals.values()), max(vals.values())
        print(f"  {group}（三路数平均）：" + " · ".join(f"{k.split('·')[1]} {v:+.2f}" for k, v in vals.items())
              + f"  → 相差 {hi_ - lo_:.2f}")
        if group == "风格":
            ok3s = hi_ - lo_ <= STYLE_SPREAD_CAP
        else:
            ok3e = hi_ - lo_ <= STYLE_SPREAD_CAP
    crit.append((f"七种风格的 MC 余量相差 ≤ {STYLE_SPREAD_CAP}（解析强度模型可信）", ok3s, ""))
    crit.append((f"十四种特效的 MC 余量相差 ≤ {STYLE_SPREAD_CAP}（特效折算可信）", ok3e, ""))

    # ───────── 【四】触发求和与上限 ─────────
    print(f"\n【四】触发求和（上限 {TRIGGER_CAP:.0%}）：每回合出招率")
    ok4 = True
    base = build_at("huashan", realm4, lv4, "上乘")
    x = L.frontier_x(base) - 0.3
    for label, trig in (("5 门全「高」", "高"), ("5 门全「中」", "中"), ("5 门全「低」", "低")):
        rows = [dict(name=f"p{trig}", quality="上乘", route="huashan", cat="拳", mult_t="中", cost_t="中",
                     trig_t=trig, cd_t="中", effect="连击", exist=False, source="", batch=1)] * 5
        lo = equip("huashan", [make_skill(r, calibrate(r)) for r in rows])
        st = {}
        winrate(base, x, lo, n=300, stats=st)
        rate = st["casts"] / st["rounds"]
        ok4 &= rate <= TRIGGER_CAP + 0.02
        print(f"  {label}：出招 {rate:.2f}/回合")
    rows = [r for r in catalog_by("上乘", 1) if r["route"] == "huashan" and r["effect"] not in SIGNATURE][:3]
    lo = equip("huashan", [make_skill(r, params[r["name"]]) for r in rows])
    st = {}
    winrate(base, x, lo, n=300, stats=st)
    print(f"  3 门第一批惊雷上乘（{'、'.join(r['name'] for r in rows)}）：出招 {st['casts'] / st['rounds']:.2f}/回合（原规则约 0.55）")
    crit.append((f"任意装配的出招率 ≤ {TRIGGER_CAP:.0%}", ok4, ""))

    # ───────── 【五】掉落：一世拿到几件 ─────────
    print("\n【五】掉落（标准玩家：每天在线 4 小时 + 离线 20 小时 × 60%；挂在前沿 − 0.3 处）")
    print(f"  每场掉装备 {DROP_P}；掉武学 {WX_P}；残页 {PAGES}")
    print(f"  {'检查点':<12}{'一世天数':>6}{'场/天':>7}{'件/世':>7}{'白':>5}{'绿':>5}{'蓝':>5}{'紫':>5}{'橙':>5}{'四槽最佳':>8}{'武学/世':>7}{'上乘式拼齐/世':>12}")
    ok5 = True
    drop_rows = []
    for d, realm, lv in cps:
        r = "huashan"
        base = build_at(r, realm, lv)
        x0 = L.frontier_x(base)
        st = {}
        wr = winrate(base, x0 - 0.3, (), n=200, stats=st)
        rounds = st["rounds"] / 200
        sec = battle_seconds(rounds)
        per_day = ps.ONLINE_H * 3600 / sec + min(OFFLINE_H, OFFLINE_CAP_H) * 3600 * OFFLINE_EFF / sec * wr
        life = ps.LIFE_DAYS.get(realm, 5)
        battles = per_day * life
        # 关卡位置：一世从段首推到段末，平均 pos 0.5；精英每 4 关 1 个，Boss 1 个
        items = battles * (DROP_P["normal"] * 0.75 + DROP_P["elite"] * 0.25)
        gd = {g: 0.0 for g in GRADES}
        for pos in (0.25, 0.5, 0.75):
            for kind, w in (("normal", 0.75), ("elite", 0.25)):
                for g, pg in grade_dist(pos, kind).items():
                    gd[g] += pg * w / 3
        n_by = {g: items * gd[g] for g in GRADES}
        # 四槽各自的最佳品阶期望：某槽拿到 ≥ 紫的概率 = 1 − exp(−n_紫以上/4)
        best = []
        for g in reversed(GRADES):
            n_ge = sum(n_by[h] for h in GRADES if GI[h] >= GI[g]) / 4
            best.append((g, 1 - math.exp(-n_ge)))
        best_label = next(g for g, p in best if p >= 0.5)
        wx = battles * (WX_P["normal"] * 0.75 + WX_P["elite"] * 0.25)
        share_sc = {2: 0.0, 3: 0.3, 4: 0.5, 5: 0.5}[realm]
        pairs = len(catalog_by("上乘", 1)) * NFORMS["上乘"]
        lam = wx * share_sc / pairs                                   # 每个（武学, 式）的期望残页数
        def done_with(n):
            return pairs * (1 - sum(math.exp(-lam) * lam ** k / math.factorial(k) for k in range(n)))
        done_forms = done_with(PAGES["上乘"])
        alt = " · ".join(f"N={n}:{done_with(n):.1f}" for n in (3, 4, 5, 6, 8))
        ok5 &= (best_label in ("蓝", "紫", "橙")) and (realm <= 3 or done_forms >= 1.0)
        drop_rows.append((realm, life, per_day, items, n_by, best_label, wx, done_forms))
        print(f"  第{d:>3}天境界{realm} {life:>6}{per_day:>7.0f}{items:>7.0f}" + "".join(f"{n_by[g]:>5.1f}" for g in GRADES)
              + f"{best_label:>8}{wx:>7.0f}{done_forms:>12.1f}   （{alt}）")
    crit.append(("每世四槽都能穿到蓝或更高；境界 4 起每世至少拼齐 1 式上乘", ok5, ""))

    # ───────── 【六】境界 1 ─────────
    print(f"\n【六】境界 1（{R1_HOURS:.1f} 小时）：入门关 → 1-7 必败 → 传功 → 推关")
    bare = E.bare_build(1)
    x7 = track_stages(1, 0)[6]["x"]
    wr_bare = winrate(bare, x7, (), n=500)
    print(f"  裸属性打 1-7（当量 {x7}）：胜率 {wr_bare:.1%}")
    ok6a = wr_bare <= 0.02
    crit.append(("1-7 裸属性必败（胜率 ≤ 2%）", ok6a, ""))
    for r in ROUTES:
        b0 = realm1_build(r, 0)
        print(f"  刚选{ROUTE_NAME[r]}（0 重、无装备、无武学）打 1-7：胜率 {winrate(b0, x7, (), n=300):.1%}")
    ok6b = ok6c = True
    firsts = []
    for intro_drop in (INTRO_DROP_AFTER_TEACH, not INTRO_DROP_AFTER_TEACH):
        print(f"  —— {'裁决 19：传功后入门关掉白绿' if intro_drop else '对照：入门关不掉落（旧规则）'} ——")
        for r in ROUTES:
            outs = [realm1_session(r, params, seed=s_, intro_drop=intro_drop) for s_ in range(1, 4 if QUICK else 7)]
            cleared = [o["cleared"] for o in outs]
            fl = [o["first_loss"] for o in outs if o["first_loss"]]
            avg_c = sum(cleared) / len(cleared)
            gaps = []
            for o in outs:
                ts = [t for t, c in o["timeline"] if c >= 7]
                gaps += [b - a for a, b in zip(ts, ts[1:])]
            gap = sum(gaps) / len(gaps) if gaps else float("nan")
            t7 = [t for o in outs for t, c in o["timeline"] if c == 7]
            if intro_drop == INTRO_DROP_AFTER_TEACH:
                ok6b &= 7 + 6 <= avg_c
                if r == "huashan":            # 节奏只约束惊雷：镇岳 / 蚀骨开局稳是路数性格（2026-10-12 裁决）
                    ok6c &= 0.25 <= gap <= 0.6
                firsts += fl
            print(f"  {ROUTE_NAME[r]}：{len(outs)} 个种子 境界 1 末推到第 {min(cleared)}–{max(cleared)} 关（平均 {avg_c:.1f}）· "
                  f"过 1-7 在 {min(t7) * 60 if t7 else float('nan'):.0f}–{max(t7) * 60 if t7 else float('nan'):.0f} 分钟 · "
                  f"之后平均每 {gap * 60:.0f} 分钟推一关 · 首次卡关在第 {min(fl) if fl else '—'}–{max(fl) if fl else '—'} 关")
            o = outs[0]
            print("    样本时间线：" + " → ".join(f"{t:.1f}h 第{c}关" for t, c in o["timeline"][6::2][:8]))
            print("    样本事件：" + "；".join(f"{t:.1f}h {e}" for t, e in o["events"][:7]))
    crit.append(("境界 1 末至少推到 1-7 之后 6 关（第 13 关）", ok6b, ""))
    crit.append(("惊雷 1-7 之后平均每 15–36 分钟推进一关（镇岳 / 蚀骨更快已接受）", ok6c, ""))
    x_book = sorted(firsts)[len(firsts) // 2] if firsts else None
    print(f"  书肆开张关 X（首次卡关的中位数）：第 {x_book} 关")

    # ───────── 【七】节奏 ─────────
    print("\n【七】节奏：内力里程碑不受影响（装备与掉落不产内力）；前沿提前对首通 Boss 的影响")
    S = L.solve()
    x_min, tracks = S["x_min"], S["tracks"]
    delta = sum(v[0] for v in env.values()) / len(env)        # 标准装备平均余量
    delta_w = delta + 0.2                                      # 再加标准武学（现行约 +0.2）
    print(f"  标准装备余量平均 {delta:+.2f}，加标准武学约 {delta_w:+.2f}")
    days = sorted(x_min)
    for (mp, tier, b), (x0_, top, xb) in sorted(tracks.items(), key=lambda kv: kv[0][2]):
        d0 = next((d for d in days if x_min[d] >= xb), None)
        d1 = next((d for d in days if x_min[d] + delta_w >= xb), None)
        print(f"  图{mp}{tier}（境界 {b} 段）Boss 门槛 {xb:.2f}：原第 {d0} 天 → 第 {d1} 天打得过"
              + ("" if d0 is None or d1 is None else f"（提前 {d0 - d1} 天）"))
    print("  段内：到达本段末关（最后一个精英）的日子")
    for (mp, tier, b), (x0_, top, xb) in sorted(tracks.items(), key=lambda kv: kv[0][2]):
        d0 = next((d for d in days if x_min[d] >= top - 1e-9), None)
        d1 = next((d for d in days if x_min[d] + delta_w >= top - 1e-9), None)
        print(f"  图{mp}{tier}（境界 {b} 段）段末 {top:.2f}：原第 {d0} 天 → 第 {d1} 天"
              + ("" if d0 is None or d1 is None else f"（提前 {d0 - d1} 天）"))
    print("  真实代码的节奏守卫（pace.sim.test.ts）待实装后回归；这里只能说明装备不进内力线。")

    print("\n----- 判据 -----")
    for label, ok, note in crit:
        print(f"  [{'PASS' if ok else 'FAIL'}] {label}  {note}")

    # 导出：校准后的 171 门参数（供 spec.md 与实装读取）
    out = [dict(name=r["name"], quality=r["quality"], cat=r["cat"], route=r["route"], effect=r["effect"],
                batch=r["batch"], **params[r["name"]]) for r in CATALOG]
    with open(os.path.join(HERE, "wuxue-params.json"), "w", encoding="utf-8") as f:
        json.dump(dict(source="battle-loot/sim.py", trigger_cap=TRIGGER_CAP, effects=EFF, tier_span=TIER_SPAN,
                       shulian=SHU, pages=PAGES,
                       drop_p=DROP_P, wx_p=WX_P, wuxue=out), f, ensure_ascii=False, indent=1)
    print(f"\n已写出 {len(out)} 门武学参数 → battle-loot/wuxue-params.json")
    return crit


if __name__ == "__main__":
    main()
