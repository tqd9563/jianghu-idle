import { describe, expect, it } from 'vitest';
import { fmtBig, fmtRate } from './fmt';

describe('大数字缩写（长线原型 §5）', () => {
  it('十万以下写全数', () => {
    expect(fmtBig(0)).toBe('0');
    expect(fmtBig(86420)).toBe('86,420');
    expect(fmtBig(99999.9)).toBe('99,999');
  });
  it('十万到一亿用「万」一位小数，截断', () => {
    expect(fmtBig(100000)).toBe('10.0万');
    expect(fmtBig(480561)).toBe('48.0万');
    expect(fmtBig(12863420)).toBe('1,286.3万');
    expect(fmtBig(99_999_999)).toBe('9,999.9万');
  });
  it('一亿起用「亿」三位小数，截断', () => {
    expect(fmtBig(346215880)).toBe('3.462亿');
    expect(fmtBig(1e8)).toBe('1.000亿');
  });
  it('每秒产出千以下留一位小数', () => {
    expect(fmtRate(22)).toBe('22.0');
    expect(fmtRate(669.4)).toBe('669.4');
    expect(fmtRate(150000)).toBe('15.0万');
  });
});
