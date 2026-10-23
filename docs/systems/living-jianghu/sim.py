"""活江湖结构 sim：卷 · 章 · 图 · 关单线结构的台阶高度、停留天数与首杀体量

用法：python3 docs/systems/living-jianghu/sim.py

口径（design.md §2.2 / §2.6）：
- 战力曲线取 longline_sim.solve() 的 x_min（三路线最慢者，与现行关卡表同一口径）；
  段内装备余量按现行「段末上抬」0.5 当量线性摊入（export_stage_table.END_LIFT）。
- 主线必走：每卷 1 张赶路图 + 一章 2 张据点图；同卷并排的其余章与主线同高，不占天数。
- 普通关匀速；赶路图坡度减半；副手与台阶同高；镇守 +2.5 关、非末卷章末 Boss +5.5 关的量，
  不占台阶高度；每个境界最后一卷的 Boss 为境界门槛（下一境界首日）。
- 首杀声望按成就层单价折算（精英 6.4、Boss 24 × 当前乘区，economy.md §1.3），只比体量。
"""
import os
import sys
from pathlib import Path

SIM = Path(__file__).resolve().parents[1] / "sim"
sys.path.insert(0, str(SIM))
import longline_sim as L  # noqa: E402

END_LIFT = 0.5
STEP_FLOOR = 1.012                      # 台阶下限：属性 +1.2%（design.md §2.2）
WARDEN_BUMP, WALL_BUMP = 2.5, 5.5       # 镇守、矮墙比台阶高出几关的量

# 每个境界段：卷数、每卷并排章数、每图关数（design.md §2.2 / §2.6）
BANDS = {
    2: dict(vols=[3, 3, 3], per_map=20),          # 卷 2–4
    3: dict(vols=[3, 3], per_map=15),             # 卷 5–6
    4: dict(vols=[3, 3], per_map=15),             # 卷 7–8
    5: dict(vols=[3, 3], per_map=int(os.environ.get("BAND5_PER_MAP", 12))),  # 卷 9–10
}
VOL1 = dict(road=11, ju=15, x0=2.0)               # 卷 1：入门关 + 传功（赶路）后接一章两图，铺到境界 2 段起点

# 现行关卡表（export_stage_table）体量，用于对照
OLD = dict(stages=318, elites=35, bosses=9)
# 标准玩家 100 天的成就层构成（economy.md §1.3：约 26 精英、9 Boss、10 条经脉，合计约占累计声望 5%）
STD = dict(elites=26, bosses=9, meridians=10, share=5.0)
PRICE = dict(elite=6.4, boss=24, meridian=80)


def pct(dx: float) -> float:
    return (1.7 ** dx - 1) * 100


def main() -> None:
    S = L.solve()
    x_min, plateaus, tracks = S["x_min"], S["plateaus"], S["tracks"]

    def eff(d: int, ds: list[int]) -> float:
        """第 d 天能打到的当量（x_min + 段内线性摊入的装备余量）"""
        f = (d - ds[0]) / max(1, ds[-1] - ds[0])
        return x_min[d] + END_LIFT * f

    print("【一】各境界段台阶（主线必走）")
    print(" 段   天数     战力跨度  主线图  主线关  台阶     下限")
    rows = []
    vol_no = 1
    for b, cfg in BANDS.items():
        ds = plateaus[b]
        x0, top, xb = next(v for (mp, t, bb), v in tracks.items() if bb == b and (mp, t) in L.TRACKS[b][:1])
        top += END_LIFT
        H = top - x0
        s = cfg["per_map"]
        n_vol = len(cfg["vols"])
        eff_maps = n_vol * (2 + 0.5)               # 每卷 2 张据点图 + 1 张坡度减半的赶路图
        dx = H / (s * eff_maps)
        ok = "✓" if 1.7 ** dx >= STEP_FLOOR else "✗"
        print(f"  {b}  第{ds[0]:>2}–{ds[-1]:>3}天  {H:5.2f}    {n_vol * 3:>3}    {n_vol * 3 * s:>4}   {pct(dx):4.2f}%   {ok}")
        rows.append((b, ds, x0, dx, s, cfg, xb))

    print("\n【二】主线逐图停留（首关可打 → 末关可打，按天）")
    print(" 卷  图      关  起当量  首日  末日  停留")
    summary = {}
    for b, ds, x0, dx, s, cfg, xb in rows:
        x = x0
        n_vol = len(cfg["vols"])
        stays = []
        unlock = []
        for v in range(n_vol):
            vol_no += 1
            for kind in ("赶路", "据点一", "据点二"):
                slope = dx * (0.5 if kind == "赶路" else 1.0)
                xs = [x + i * slope for i in range(s)]
                x = xs[-1] + slope
                last = xs[-1]
                if kind == "据点二":                 # 章末 Boss
                    gate = (v == n_vol - 1)
                    last = xb if gate else xs[-1] + WALL_BUMP * dx
                elif kind != "赶路":                  # 图末镇守
                    last = xs[-1] + WARDEN_BUMP * dx
                d_first = next((d for d in ds if eff(d, ds) >= xs[0]), ds[-1])
                if kind == "据点二" and v == n_vol - 1:
                    d_last = ds[-1] + 1                # 境界门槛：下一境界首日
                else:
                    d_last = next((d for d in ds if eff(d, ds) >= last), ds[-1])
                stays.append(d_last - d_first + 1)
                unlock += [next((d for d in ds if eff(d, ds) >= xi), ds[-1]) for xi in xs]
                print(f" {vol_no:>2}  {kind:<4} {s:>3}  {xs[0]:6.2f}  {d_first:>4}  {d_last:>4}  {d_last - d_first + 1:>3} 天")
        days = ds[-1] - ds[0] + 1
        gaps = [b2 - a2 for a2, b2 in zip(sorted(unlock), sorted(unlock)[1:])]
        summary[b] = (days, n_vol * 3, n_vol * 3 * s, sum(stays) / len(stays), max(gaps))

    print("\n【三】节奏：每天推几关、每张图约几天（应越往后越慢）")
    print(" 段  天数  主线关  每天关数  每图平均天数  最长几天无新关")
    for b, (days, maps, st, stay, gap) in summary.items():
        print(f"  {b}  {days:>3}   {st:>4}    {st / days:5.2f}     {stay:5.1f}        {gap}")

    print("\n【四】全江湖体量与首杀声望（含并排章；卷 1 一章）")
    chapters = 1 + sum(sum(cfg["vols"]) for cfg in BANDS.values())
    ju_maps = chapters * 2
    road_maps = 1 + sum(len(cfg["vols"]) for cfg in BANDS.values())
    stages = VOL1["road"] + 2 * VOL1["ju"] + sum(
        (len(cfg["vols"]) + 2 * sum(cfg["vols"])) * cfg["per_map"] for cfg in BANDS.values())
    elites = ju_maps * 2 - chapters                   # 每张据点图副手 + 镇守，门户图末关换成 Boss
    bosses = chapters
    def weight(e: float, bo: float, k: float = 1.0) -> float:
        return (e * PRICE["elite"] + bo * PRICE["boss"]) * k + STD["meridians"] * PRICE["meridian"]
    base = weight(STD["elites"], STD["bosses"])
    print(f"  图 {road_maps + ju_maps}（赶路 {road_maps} · 据点 {ju_maps}）  关 {stages}（现行 {OLD['stages']}）")
    print(f"  精英 {elites}（现行 {OLD['elites']}，标准玩家 100 天打 {STD['elites']}）  Boss {bosses}（现行 {OLD['bosses']}）")
    print("  成就层占累计声望（全部打完、单价按倍数缩放；经脉 10 条不变；不含侠名录加成）：")
    for k in (1.0, 0.7, 1 / 3.17):
        print(f"    精英 / Boss 单价 ×{k:.2f}：约 {STD['share'] * weight(elites, bosses, k) / base:.1f}%（上限 10%）")

if __name__ == "__main__":
    main()
