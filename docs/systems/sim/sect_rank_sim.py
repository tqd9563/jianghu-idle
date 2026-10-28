"""门派改造数值推演：六级地位门槛、六档差事收益、货架价格（sect-overhaul/spec.md）。

输入 sect_life_measured.json（真实 simBot 跑出的各世门派天数），在上面叠一个确定性的差事模型：
  标准玩家一天 = 在线 4 小时派两件 2 小时差事 + 下线前派一件 8 小时差事（simBot 的既定打法），
  每档每时贡献 r = [20, 32, 50, 80, 130, 200]，8 小时档按七五折，于是第 k 档一天进账 = 2·2·r + 8·0.75·r = 10·r。
  玩家总派已解锁的最高一档；地位按本世累计贡献升，花掉的不降级；贡献与地位每世清零。
输出：按游戏进程分段，一世能爬到几级、各级在第几天到达、一世攒多少；认祖归宗（从二级起）同列。

用法：python3 sect_rank_sim.py            # 对比几个 T（每升一级的天数）
      python3 sect_rank_sim.py --T 1.25   # 只看一个
"""
from __future__ import annotations
import argparse, json, statistics
from pathlib import Path

HERE = Path(__file__).parent
RATE = [20, 32, 50, 80, 130, 200]          # 每档每时贡献（2 小时档）
DAILY = [10 * r for r in RATE]             # 一天进账（2 短 + 1 长）
N = '一二三四五六'
BANDS = [('第 6–18 天', 6, 18), ('第 19–35 天', 19, 35), ('第 36–85 天', 36, 85), ('第 86–200 天', 86, 200)]


def thresholds(T: float) -> list[int]:
    """累计贡献门槛：到第 k 级需要 Σ_{i<k} DAILY[i]·T，升一级固定 T 天；取整到五十。"""
    c, out = 0.0, [0]
    for d in DAILY[:-1]:
        c += d * T
        out.append(int(round(c / 50) * 50))
    return out


def simulate_life(sect_days: int, T: float, start_rank: int = 1):
    th = thresholds(T)
    cum, rank, reach = 0.0, start_rank, {}
    for day in range(1, sect_days + 1):
        cum += DAILY[rank - 1]
        while rank < 6 and cum >= th[rank]:
            rank += 1
            reach[rank] = day
    return rank, int(cum), reach


def load(path: Path):
    d = json.loads(path.read_text())
    lives = [L for s in d['samples'] for L in s['lives'] if L['sectDays'] > 0]
    return d, lives


def report(lives, T: float):
    print(f'\n### 每级 {T} 天 → 门槛 {dict(zip(N, thresholds(T)))}')
    print('| 时段 | 门派天数（中位） | 到达地位 | 各级到达于本世第几天 | 一世攒 | 认祖归宗（从二级起）到达 / 攒 |')
    print('|---|---|---|---|---|---|')
    for name, lo, hi in BANDS:
        sel = [L for L in lives if lo <= L['startDay'] <= hi]
        if not sel:
            continue
        sd = int(statistics.median(L['sectDays'] for L in sel))
        r, c, reach = simulate_life(sd, T)
        r2, c2, _ = simulate_life(sd, T, 2)
        steps = ' '.join(f'{N[k-1]}→d{v}' for k, v in reach.items())
        print(f'| {name} | {sd} | {N[r-1]}级 | {steps or "—"} | {c} | {N[r2-1]}级 / {c2} |')


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--T', type=float, default=None)
    ap.add_argument('--data', default=str(HERE / 'sect_life_measured.json'))
    a = ap.parse_args()
    d, lives = load(Path(a.data))
    print(f'实测：{d["days"]} 天，{d["routes"]} × 种子 {d["seeds"]}；入过门派的世 {len(lives)} 个')
    print('每日进账：', dict(zip(N, DAILY)))
    for T in ([a.T] if a.T else [1.0, 1.25, 1.5]):
        report(lives, T)


if __name__ == '__main__':
    main()
