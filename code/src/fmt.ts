/**
 * 大数字缩写（长线原型 docs/design/longline-prototype.html §5，issue #22 第 3 步获批）：
 *   < 10 万：全数、千分位           86,420
 *   10 万 – 1 亿：「万」一位小数     1,286.3万
 *   ≥ 1 亿：「亿」三位小数           3.462亿
 * 小数一律截断不四舍五入，免得「差 1 点」时显示成「够了」；保留小数让挂机时数字仍在跳。
 */
const trunc = (x: number, d: number) => Math.floor(x * 10 ** d) / 10 ** d;
const group = (s: string) => s.replace(/\B(?=(\d{3})+(?!\d))/g, ',');

export function fmtBig(n: number): string {
  const v = Math.floor(n);
  if (v < 0) return `-${fmtBig(-v)}`;
  if (v < 1e5) return group(String(v));
  if (v < 1e8) {
    const [i, f] = trunc(v / 1e4, 1).toFixed(1).split('.');
    return `${group(i)}.${f}万`;
  }
  return `${trunc(v / 1e8, 3).toFixed(3)}亿`;
}

/** 每秒产出：千以下留一位小数，之上走 fmtBig */
export function fmtRate(perSec: number): string {
  return perSec < 1000 ? perSec.toFixed(1) : fmtBig(perSec);
}
