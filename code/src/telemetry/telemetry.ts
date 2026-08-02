/**
 * 埋点 —— 权威来源：docs/rules/telemetry.md v2.0
 * 公共信封 { e, ts, run, realm, route, ...专有字段 }；事件名以规格 §1.1–1.4 为准，实现不得自创。
 * 纯本地持久化（与存档同级），JSON 一键导出。
 */
import type { RouteId } from '../engine/content';

export interface EventBase {
  e: string;
  ts: number;
  run: number;
  realm: number;
  route: RouteId | null;
}
export type TelemetryEvent = EventBase & Record<string, unknown>;

const TELEMETRY_KEY = 'jianghu-idle:telemetry:v1';

/** node 测试环境无 localStorage 时退化为内存实现 */
const mem = new Map<string, string>();
const store: Pick<Storage, 'getItem' | 'setItem' | 'removeItem'> =
  typeof localStorage !== 'undefined'
    ? localStorage
    : {
        getItem: (k) => mem.get(k) ?? null,
        setItem: (k, v) => void mem.set(k, v),
        removeItem: (k) => void mem.delete(k),
      };
let buffer: TelemetryEvent[] = loadPersisted();

function loadPersisted(): TelemetryEvent[] {
  try {
    return JSON.parse(store.getItem(TELEMETRY_KEY) ?? '[]');
  } catch {
    return [];
  }
}

/** 上下文由调用方（store）注入，保证信封字段与游戏状态一致 */
export function track(
  e: string,
  ctx: { run: number; realm: number; route: RouteId | null },
  fields: Record<string, unknown> = {},
): void {
  buffer.push({ e, ts: Date.now(), run: ctx.run, realm: ctx.realm, route: ctx.route, ...fields });
  store.setItem(TELEMETRY_KEY, JSON.stringify(buffer));
}

/** 一键导出（埋点规格 §3 最低格式）：meta + 全部事件流 */
export function exportTelemetryJSON(meta: {
  tester_id: string;
  build: string;
  tables_version: string;
  telemetry_spec: number;
}): string {
  return JSON.stringify({ meta: { ...meta, exported_at: Date.now() }, events: buffer }, null, 2);
}

export function getEvents(): readonly TelemetryEvent[] {
  return buffer;
}

export function resetTelemetry(): void {
  buffer = [];
  store.removeItem(TELEMETRY_KEY);
}
