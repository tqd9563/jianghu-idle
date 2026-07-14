import { beforeEach, describe, expect, it, vi } from 'vitest';
import { endLiveTestWindow, loadLiveTestWindow, resetLiveTestWindowForTests, startLiveTestWindow } from './storage';

describe('live-test window storage', () => {
  beforeEach(() => resetLiveTestWindowForTests());

  it('starts once, freezes version, and is idempotent while active', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.25);
    const first = startLiveTestWindow('tables-a', 1000);
    const second = startLiveTestWindow('tables-b', 2000);
    expect(second).toEqual(first);
    expect(loadLiveTestWindow()).toEqual(first);
    expect(first.tablesVersionStarted).toBe('tables-a');
    vi.restoreAllMocks();
  });

  it('returns and clears the active record on end', () => {
    const record = startLiveTestWindow('tables-a', 1000);
    expect(endLiveTestWindow()).toEqual(record);
    expect(loadLiveTestWindow()).toBeNull();
    expect(endLiveTestWindow()).toBeNull();
  });
});
