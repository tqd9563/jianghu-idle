#!/usr/bin/env python3
from __future__ import annotations
"""武学参数校准 v2（battle-loot/design.md 裁决 45 / 46）：倍率按品质与类型给定，反解触发几率。

取代 sim.py【一】的「倍率是阀门」。规则：
  - 类型（名录倾向推出）：倍率「高」+ 耗气「高」= 双强；倍率「高」其余 = 重击；倍率「中」「低」= 折中。
  - 第一式倍率 = 品质基准 × 类型系数；每式 ×MULT_GROWTH。耗气 = 品质基准 × 耗气倾向，每式 ×COST_GROWTH。
  - 特效数值 = 原四档插值 × 类型的特效系数（重击弱、双强强）；几率类封顶 1。
  - 触发几率是阀门：同品质的武学在「全部圆满、推图」语境下强度相同；强度锚取该品质各门在参考触发几率下的平均，
    所以同品质的平均触发几率 ≈ 参考值；装满 10 槽时各门触发几率之和约 75%（用户 2026-10-21 定）。
  - 推图真气每关回满、后期够用，校准不计真气；耗气是副本与长战里的代价（裁决 45 ④）。回气 / 回元因此在推图里不计价。
  - 独门三门（蓄势 / 反震 / 引爆）不校准：折中、参考触发几率。

实战修正：解析模型对会心类低估、对回元 / 附毒 / 透劲 / 破绽高估（castDoors.sim.test.ts 逐门实测）。
  触发几率 = 解析反解值 × 修正系数；系数存 p_correction.json，每轮按「同品质余量均值 ÷ 本门余量」累乘。
  第一批 66 门按各自实测修正；未上线的按同品质同特效的平均系数（没有则按同特效、再没有取 1）。

用法：python3 docs/systems/battle-loot/calib_cast.py [--batch N] [--update-mc] [--write]
  --batch N：本轮校准哪一批（默认名录里最大的批次）。已实装的批次数值冻结：后批加门、改名会动品质锚与成长曲线的
    名字哈希，整表重算会让上线的门漂移，所以 --update-mc 与 --write 都只动这一批，其它批保持 params 里的原值。
  --update-mc：读 docs/systems/sim/cast_doors_measured.json 更新本批的修正系数（均值按同品质已冻结批的门算）；
  --write：改写 wuxue-params.json 里本批的门（改名的门只换名字；再跑 export_wuxue.py 生成代码读的名录）。
"""
import importlib.util
import hashlib
import itertools
import json
import math
import os
import statistics as st
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
_argv, sys.argv = sys.argv, [sys.argv[0]]
_spec = importlib.util.spec_from_file_location("bl_sim", os.path.join(HERE, "sim.py"))
S = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(S)
sys.argv = _argv
WRITE = "--write" in sys.argv
UPDATE_MC = "--update-mc" in sys.argv
BATCH = int(sys.argv[sys.argv.index("--batch") + 1]) if "--batch" in sys.argv else max(r["batch"] for r in S.CATALOG)
CORR_PATH = os.path.join(HERE, "p_correction.json")
MC_PATH = os.path.join(HERE, "..", "sim", "cast_doors_measured.json")

QUAL = S.QUAL
NFORMS = S.NFORMS
# 改名（living-jianghu/design.md §2.6 改名表）：params / p_correction / 实测记录里的旧名换新名，数值不动
RENAMED = {"金刚降魔杵": "不周擎天棍", "莲花落地棍": "万岳镇川棍", "天河倒悬刀": "烈日熔金刀", "金顶佛光指": "阴云蔽月指",
           "风雷激荡刀": "风雷断岳刀", "大漠孤烟刀": "铁马冰河刀", "七进七出枪": "流星贯月枪", "横扫六合拳": "巨鳌负山拳",
           "醉里挑灯拳": "长鲸吸海拳", "毒蝎回钩指": "冷磷照骨指"}
renamed = lambda n: RENAMED.get(n, n)
BATCH_OF = {r["name"]: r["batch"] for r in S.CATALOG}
EFF = S.EFF
SIGNATURE = S.SIGNATURE
REF = S.REF

# ───────── 参数 ─────────
MULT_SCALE = 1.00                                       # 整体尺度：由真实战斗的前沿对拍定（castBalance.sim.test.ts）
MULT_BASE = {q: round(1.45 * k * MULT_SCALE, 2) for q, k in (("寻常", 1.14), ("上乘", 1.31), ("绝学", 1.63))}   # 折中、倍率「中」的第一式倍率
MULT_GROWTH = 1.12                                      # 每式倍率 ×1.12
COST_GROWTH = 1.15                                      # 每式基础耗气 ×1.15
P_REF = {"寻常": 0.130, "上乘": 0.063, "绝学": 0.045}   # 各品质的参考触发几率（同品质平均约等于它）
TYPE_MULT = {"重击": 1.20, "折中": 1.00, "双强": 1.20}
MULT_T_K = {"中": 1.00, "低": 0.90}                     # 折中里再按倍率倾向分
TYPE_EK = {"重击": 0.50, "折中": 1.00, "双强": 1.50}
LOW_MULT_EK = 1.25                                      # 折中且倍率「低」：特效略强
NO_EK_SCALE = {"必暴", "附毒"}                          # 这两种的主效果（必定会心 / 额外 1 层）不随系数变，只缩放附加值
PROB_KEYS = {("连击", "chance"), ("封穴", "p"), ("附毒", "extra")}
P_FLOOR = 0.0                                           # 触发几率下限：暂不设（用户 2026-10-21）
PRACTICAL = {"伏狮拳法": 1.2, "摧峰掌法": 1.2, "卷雪腿法": 1.2}   # 实用型寻常（用户要的低品质特例）：前辈传功的三门，单门时也够用；触发几率在拉平后再 ×1.2
P_CAP_K = 2.0                                           # 触发几率上限 = 同品质参考值 × 2：回元 / 回气在推图里本就不值钱，不靠高触发硬拉平，价值留给副本
TARGET_SUM = 0.75
QI_PRICE = 0.01                                         # 推图里回的真气的影子价：100 点 ≈ 一次普攻（回气 / 回元不至于零价值）


def type_of(r: dict) -> str:
    if r["effect"] in SIGNATURE:
        return "折中"
    if r["mult_t"] == "高":
        return "双强" if r["cost_t"] == "高" else "重击"
    return "折中"


def ek_of(r: dict) -> float:
    t = type_of(r)
    if r["effect"] in SIGNATURE:
        return 1.0
    if t == "折中" and r["mult_t"] == "低":
        return LOW_MULT_EK
    return TYPE_EK[t]


MULT_JITTER = 0.06                                      # 每步倍率在 ×MULT_GROWTH 上下浮动的幅度（对数），首式与末式不动
MIN_STEP = 1.04                                         # 每往后一式至少涨 4%


def step_curve(name: str, n: int) -> list[float]:
    """各式相对第一式的倍数：每步 = MULT_GROWTH × e^(d_k)，d_k 按武学名固定取值、和为 0（末式仍是 MULT_GROWTH^(n−1)）。
    让每门有自己的成长节奏（有的式跳得大、有的式跳得小），整门平均威力基本不变，校准不受影响。"""
    if n <= 1:
        return [1.0]
    h = int(hashlib.md5(name.encode("utf-8")).hexdigest(), 16)
    d = []
    for _ in range(n - 1):
        d.append(((h % 10007) / 10006 * 2 - 1) * MULT_JITTER)
        h //= 10007
    mean = sum(d) / len(d)
    d = [x - mean for x in d]
    lo = math.log(MIN_STEP / MULT_GROWTH)
    for _ in range(20):                                  # 夹住最小步长后重新配平，保证和为 0
        d = [max(lo, x) for x in d]
        mean = sum(d) / len(d)
        if abs(mean) < 1e-12:
            break
        free = [i for i, x in enumerate(d) if x > lo]
        for i in free:
            d[i] -= mean * len(d) / len(free)
    out, acc = [1.0], 1.0
    for x in d:
        acc *= MULT_GROWTH * math.exp(x)
        out.append(acc)
    return out


def form_mults(r: dict, m0: float | None = None) -> list[float]:
    """各式倍率（两位小数）：第一式 × 本门的成长曲线"""
    m0 = mult0_of(r) if m0 is None else m0
    return [round(m0 * c, 2) for c in step_curve(r["name"], NFORMS[r["quality"]])]


def mult0_of(r: dict) -> float:
    t = type_of(r)
    if r["effect"] in SIGNATURE:
        return MULT_BASE[r["quality"]]
    k = TYPE_MULT[t] if t != "折中" else MULT_T_K[r["mult_t"]]
    return round(MULT_BASE[r["quality"]] * k, 2)


COST_K = {"低": 0.75, "中": 1.00, "高": 1.30}            # 收窄（原 0.6 / 1.0 / 1.5），让品质之间的耗气差不被品质内部的离散盖过


def cost0_of(r: dict) -> int:
    return round(S.COST_BASE[r["quality"]] * COST_K[r["cost_t"]])


def cd_of(r: dict) -> int:
    return S.CD_BASE[r["quality"]] + S.CD_K[r["cd_t"]]


def form_weights(q: str) -> list[float]:
    """全部圆满、真气够用时各式的出场份额：按基础耗气加权（裁决 45 ②）"""
    n = NFORMS[q]
    w = [COST_GROWTH ** i for i in range(n)]
    s = sum(w)
    return [x / s for x in w]


def eff_form(effect: str, key: str, q: str, k: int, ek: float) -> float:
    v = S.eff_value(effect, key, q, k, NFORMS[q]) * ek
    return min(1.0, v) if (effect, key) in PROB_KEYS else v


def eff_w(effect: str, key: str, q: str, ek: float) -> float:
    return sum(w * eff_form(effect, key, q, k + 1, ek) for k, w in enumerate(form_weights(q)))


def strength(r: dict, p: float, mult0: float | None = None, ek: float | None = None) -> float:
    """推图语境（真气不计）：每回合期望输出（相对只普攻）÷ (1 − 受击减免)。结构同 sim.py strength，
    只改三处：出招比例 = 1 / (冷却 + 1 / 触发)、倍率按各式份额加权（每式 ×MULT_GROWTH）、特效数值 × 类型系数。"""
    q, eff = r["quality"], r["effect"]
    m0 = mult0_of(r) if mult0 is None else mult0
    e = ek_of(r) if ek is None else ek
    cd = cd_of(r)
    f = 1.0 / (cd + 1.0 / p)
    ws = form_weights(q)
    mult_avg = sum(w * m for w, m in zip(ws, form_mults(r, m0)))
    out = (1 - f) + f * mult_avg
    rr = 0.0
    e_hit0 = REF["e_hit"] / (REF["e_hit"] + REF["p_dodge"])
    mit0 = REF["def_k"] / (REF["def_k"] + REF["e_dfs"])
    av = lambda key: eff_w(eff, key, q, e)
    if eff == "必暴":
        base_c = 1 + REF["crit"] * (REF["cd"] - 1)
        out += f * mult_avg * (REF["cd"] * (1 + av("cdmg")) / base_c - 1)
    elif eff == "连击":
        out += f * av("chance")
    elif eff == "附毒":
        out += f * (1 + av("extra")) * REF["poison_coef"] * REF["rounds"] / 2 * S.POISON_CAP_K
    elif eff == "透劲":
        mit1 = REF["def_k"] / (REF["def_k"] + REF["e_dfs"] * (1 - av("pen")))
        out += f * mult_avg * (mit1 / mit0 - 1)
    elif eff == "破绽":
        u = 1 - (1 - f) ** EFF["破绽"]["n"]
        mit1 = REF["def_k"] / (REF["def_k"] + REF["e_dfs"] * (1 - av("dfs")))
        out *= 1 + u * (mit1 / mit0 - 1)
    elif eff == "运劲":
        u = 1 - (1 - f) ** EFF["运劲"]["n"]
        out *= 1 + u * av("atk")
    elif eff == "凝眸":
        u = 1 - (1 - f) ** EFF["凝眸"]["n"]
        base_c = 1 + REF["crit"] * (REF["cd"] - 1)
        out *= 1 + u * av("crit") * (REF["cd"] - 1) / base_c
    elif eff == "护体":
        rr = min(0.5, f * av("shield") * REF["rounds"])
    elif eff == "轻身":
        u = 1 - (1 - f) ** EFF["轻身"]["n"]
        e1 = REF["e_hit"] / (REF["e_hit"] + REF["p_dodge"] + av("dodge"))
        rr = u * (1 - e1 / e_hit0)
    elif eff == "卸力":
        rr = (1 - (1 - f) ** EFF["卸力"]["n"]) * av("atk")
    elif eff == "迷目":
        u = 1 - (1 - f) ** EFF["迷目"]["n"]
        h = REF["e_hit"] - av("hit")
        rr = u * (1 - (h / (h + REF["p_dodge"])) / e_hit0)
    elif eff == "封穴":
        rr = f * av("p")
    elif eff == "回元":
        out += f * av("qi") * QI_PRICE
    elif eff == "回气":
        cw = sum(w * cost0_of(r) * COST_GROWTH ** i for i, w in enumerate(ws))
        out += f * av("refund") * cw * QI_PRICE
    return out / (1 - rr)


def target(q: str) -> float:
    rows = [r for r in S.CATALOG if r["quality"] == q and r["effect"] not in SIGNATURE]
    return st.mean(strength(r, P_REF[q]) for r in rows)


def solve_p(r: dict, tgt: float) -> float:
    lo, hi = 0.005, 0.95
    if strength(r, hi) < tgt:
        return hi
    for _ in range(60):
        mid = (lo + hi) / 2
        if strength(r, mid) < tgt:
            lo = mid
        else:
            hi = mid
    return max(P_FLOOR, round((lo + hi) / 2, 3))


def load_corr() -> dict:
    return {renamed(k): v for k, v in json.load(open(CORR_PATH, encoding="utf-8")).items()} if os.path.exists(CORR_PATH) else {}


def corr_of(r: dict, corr: dict) -> float:
    if r["name"] in corr:
        return corr[r["name"]]
    measured = {x["name"]: x for x in S.CATALOG if x["name"] in corr}
    for same in (lambda x: x["quality"] == r["quality"] and x["effect"] == r["effect"], lambda x: x["effect"] == r["effect"]):
        v = [corr[n] for n, x in measured.items() if same(x)]
        if v:
            return round(st.mean(v), 4)
    return 1.0


def update_corr() -> dict:
    """按实测余量累乘修正系数：同品质均值 ÷ 本门余量。只改本批的门；均值按同品质已冻结批（上线的门）算，
    让新批向上线的门看齐（第一批自校时没有冻结批，均值就是全体）"""
    corr = load_corr()
    cat = {r["name"]: r for r in S.CATALOG}
    rows = [dict(r, name=renamed(r["name"])) for r in json.load(open(MC_PATH, encoding="utf-8"))]
    base = {r["name"]: corr_of(cat[r["name"]], corr) for r in rows}   # 实测那一轮实际用的系数（没有本门记录时是同类均值）
    for q in QUAL:
        g = [r for r in rows if r["quality"] == q and r["name"] not in PRACTICAL]   # 特例不参与拉平
        frozen = [r for r in g if BATCH_OF.get(r["name"]) != BATCH]
        mean = st.mean(r["margin"] for r in (frozen or g))
        for r in g:
            if BATCH_OF.get(r["name"]) == BATCH:
                corr[r["name"]] = round(base[r["name"]] * mean / r["margin"], 4)
    json.dump(corr, open(CORR_PATH, "w", encoding="utf-8"), ensure_ascii=False, indent=1, sort_keys=True)
    return corr


def calibrate() -> dict:
    tg = {q: target(q) for q in QUAL}
    corr = update_corr() if UPDATE_MC else load_corr()
    out = {}
    for r in S.CATALOG:
        q = r["quality"]
        p = P_REF[q] if r["effect"] in SIGNATURE else round(min(P_REF[q] * P_CAP_K, solve_p(r, tg[q]) * corr_of(r, corr)) * PRACTICAL.get(r["name"], 1.0), 3)
        out[r["name"]] = dict(quality=q, cat=r["cat"], route=r["route"], effect=r["effect"], batch=r["batch"],
                              mult0=mult0_of(r), mults=form_mults(r), cost=cost0_of(r), p=p, cd=cd_of(r), type=type_of(r), ek=ek_of(r))
    return out, tg


def forms_of(r: dict, prm: dict) -> list[tuple[int, float]]:
    n = NFORMS[r["quality"]]
    return [(round(prm["cost"] * COST_GROWTH ** i), m) for i, m in zip(range(n), prm["mults"])]


def report(params: dict, tg: dict) -> bool:
    ok = True
    print("=" * 96)
    print("武学参数校准 v2：倍率按品质与类型给定，反解触发几率")
    print("=" * 96)
    rows = lambda q, b=None: [r for r in S.CATALOG if r["quality"] == q and (b is None or r["batch"] == b)]
    print("\n【一】触发几率（反解结果）与类型分布")
    for q in QUAL:
        for b in (BATCH, None):
            g = [r for r in rows(q, b) if r["effect"] not in SIGNATURE]
            ps = [params[r["name"]]["p"] for r in g]
            ty = {t: sum(1 for r in g if type_of(r) == t) for t in ("重击", "折中", "双强")}
            pt = {t: (round(min(v), 3), round(st.median(v), 3), round(max(v), 3))
                  for t in ty if (v := [params[r["name"]]["p"] for r in g if type_of(r) == t])}
            if not g:
                continue
            print(f"  {q} {f'第{b}批' if b else '全 171'}：{len(g)} 门 · 触发 {min(ps):.3f}–{max(ps):.3f}（中位 {st.median(ps):.3f}）· 类型 {ty} · 各类型触发（最低 / 中位 / 最高）{pt}")
            if b == 1:                                       # 只有第一批要求三种类型齐全
                miss = [t for t, c in ty.items() if c == 0]
                if miss:
                    ok = False
                    print(f"    ✗ 第一批缺类型：{miss}")
    print("\n【二】装满 10 槽时的总触发几率（各品质按第一批中位触发几率）")
    med = {q: st.median(params[r["name"]]["p"] for r in rows(q, 1) if r["effect"] not in SIGNATURE) for q in QUAL}
    for combo in ((2, 4, 4), (2, 5, 3), (1, 4, 5), (0, 5, 5), (3, 4, 3)):
        s = sum(n * med[q] for n, q in zip(combo, QUAL))
        print(f"  寻常 {combo[0]} + 上乘 {combo[1]} + 绝学 {combo[2]}：{s:.2f}")
    print(f"  境界 2 装 6 门寻常：{6 * med['寻常']:.2f} · 境界 1 单门寻常：{med['寻常']:.3f}")
    print(f"\n【三】要求 1：同门各式差距（第{BATCH}批）")
    for q in QUAL:
        g = rows(q, BATCH)
        if not g:
            continue
        f = [forms_of(r, params[r["name"]]) for r in g]
        steps = [b[1] / a[1] - 1 for x in f for a, b in zip(x, x[1:])]
        print(f"  {q}：相邻式倍率差 {min(steps) * 100:.0f}%–{max(steps) * 100:.0f}%（中位 {st.median(steps) * 100:.0f}%）· 末 / 首 倍率 {st.median(x[-1][1] / x[0][1] for x in f):.2f} · 末 / 首 耗气 {st.median(x[-1][0] / x[0][0] for x in f):.2f}")
    print(f"\n【四】要求 2：同序号的式，高品质 > 低品质 的比例（第{BATCH}批两两比较；独门除外）")
    for a, b in (("寻常", "上乘"), ("上乘", "绝学"), ("寻常", "绝学")):
        A = [r for r in rows(a, BATCH) if r["effect"] not in SIGNATURE]
        B = [r for r in rows(b, BATCH) if r["effect"] not in SIGNATURE]
        if not A or not B:
            continue
        for key, idx in (("耗气", 0), ("倍率", 1)):
            tot = win = 0
            for k in range(NFORMS[a]):
                for x, y in itertools.product(A, B):
                    tot += 1
                    win += forms_of(y, params[y["name"]])[k][idx] > forms_of(x, params[x["name"]])[k][idx]
            print(f"  {b} > {a} 同式{key}：{win / tot * 100:.0f}%")
        # 整门：末式对末式、全圆满加权平均对加权平均
        wa = [sum(w * m for w, (_, m) in zip(form_weights(a), forms_of(r, params[r["name"]]))) for r in A]
        wb = [sum(w * m for w, (_, m) in zip(form_weights(b), forms_of(r, params[r["name"]]))) for r in B]
        print(f"  {b} > {a} 整门圆满后平均倍率：{sum(y > x for x, y in itertools.product(wa, wb)) / (len(wa) * len(wb)) * 100:.0f}%")
    print("\n【五】品质强度锚（推图、全部圆满）与单门每回合期望出招")
    for q in QUAL:
        f = 1 / (S.CD_BASE[q] + 1 / P_REF[q])
        print(f"  {q}：锚 {tg[q]:.3f}（相对只普攻）· 参考门出招比例 {f:.3f}")
    print(f"\n【六】各门（第{BATCH}批）")
    for q in QUAL:
        for r in sorted(rows(q, BATCH), key=lambda r: (type_of(r), params[r["name"]]["p"])):
            prm = params[r["name"]]
            fs = forms_of(r, prm)
            print(f"  {q} {type_of(r)} {r['name']:<8} {r['effect']} 特效×{prm['ek']:.2f} 倍率 {fs[0][1]:.2f}→{fs[-1][1]:.2f} "
                  f"耗气 {fs[0][0]}→{fs[-1][0]} 冷却 {prm['cd']} 触发 {prm['p']:.3f}")
    return ok


def main():
    params, tg = calibrate()
    ok = report(params, tg)
    if WRITE:
        path = os.path.join(HERE, "wuxue-params.json")
        data = json.load(open(path, encoding="utf-8"))
        for w in data["wuxue"]:
            w["name"] = renamed(w["name"])
        by = {w["name"]: w for w in data["wuxue"]}
        for r in S.CATALOG:
            if r["batch"] == BATCH:
                by[r["name"]].update(params[r["name"]])
        data["calib"] = dict(source="calib_cast.py", mult_growth=MULT_GROWTH, cost_growth=COST_GROWTH,
                             p_ref=P_REF, mult_base=MULT_BASE)
        json.dump(data, open(path, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
        open(path, "a").write("\n")
        print(f"\n已改写 {path}（第{BATCH}批 {sum(r['batch'] == BATCH for r in S.CATALOG)} 门）")
    print("\n判据：第一批每个品质三种类型都有 →", "通过" if ok else "未通过")


if __name__ == "__main__":
    main()
