import { describe, expect, it } from 'vitest';
import { parseDebugHash } from './debug';

describe('debug hash live-test command', () => {
  it('parses only explicit 1/0 and preserves existing fields', () => {
    expect(parseDebugHash('#tab=battle&fight=1&livetest=1')).toMatchObject({ tab: 'battle', fight: true, livetest: 1 });
    expect(parseDebugHash('#livetest=0').livetest).toBe(0);
    expect(parseDebugHash('#livetest=yes').livetest).toBeNull();
  });
});
