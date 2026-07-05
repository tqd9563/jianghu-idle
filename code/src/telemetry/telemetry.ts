/**
 * 埋点 —— 权威来源：docs/core-loop/mvp-0-telemetry-spec.md v1.0
 * 事件名/字段/口径以规格为准，实现不得自创事件。纯本地，JSON 一键导出。
 */

/** 公共信封（埋点规格 §1.0） */
export interface EventEnvelope {
  /** epoch 毫秒 */
  ts: number;
  /** 轮次编号，从 1 起 */
  run: number;
  realm: number;
  route: 'huashan' | 'shaolin' | 'tangmen' | null;
  name: string;
  payload: Record<string, unknown>;
}

const TELEMETRY_KEY = 'jianghu-idle:telemetry:v1';
let buffer: EventEnvelope[] = loadPersisted();

function loadPersisted(): EventEnvelope[] {
  try {
    return JSON.parse(localStorage.getItem(TELEMETRY_KEY) ?? '[]');
  } catch {
    return [];
  }
}

export function track(event: Omit<EventEnvelope, 'ts'>): void {
  buffer.push({ ts: Date.now(), ...event });
  localStorage.setItem(TELEMETRY_KEY, JSON.stringify(buffer));
}

/** 一键导出（埋点规格 §3）：单文件 JSON，含全部事件流 */
export function exportTelemetryJSON(): string {
  return JSON.stringify({ exportedAt: Date.now(), events: buffer }, null, 2);
}

export function resetTelemetry(): void {
  buffer = [];
  localStorage.removeItem(TELEMETRY_KEY);
}

// TODO(埋点规格 §1.1–1.4)：18 个事件的类型化封装（breakthrough / route_selected /
// charge_segment_full / key_battle_end / seclusion_* / node_bought / test_session_* …）
