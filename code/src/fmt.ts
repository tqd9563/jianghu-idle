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

const CN_NUM = ['零', '一', '两', '三', '四', '五', '六', '七', '八', '九', '十', '十一', '十二'];

/** 时长的武侠写法：一个时辰 = 2 小时，一刻 = 15 分钟；满十二个时辰写「一昼夜」 */
export function shichenText(min: number, verb = '闭关'): string {
  if (min < 15) return `${verb}片刻`;
  if (min < 120) return `${verb}${CN_NUM[Math.min(7, Math.round(min / 15))]}刻`;
  const sc = Math.round(min / 120);
  return sc >= 12 ? `${verb}一昼夜` : `${verb}${CN_NUM[sc]}个时辰`;
}

/** 时长的玩家侧措辞：47 分钟 / 2 小时 5 分 */
export function minText(rawSec: number): string {
  const min = Math.floor(rawSec / 60);
  if (min < 1) return '不到 1 分钟';
  if (min < 60) return `${min} 分钟`;
  return `${Math.floor(min / 60)} 小时 ${min % 60} 分`;
}
