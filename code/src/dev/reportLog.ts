/** 开发期记录最近的控制台错误，提报时一并带走（仅 dev 构建安装） */
const MAX = 20;
const errors: string[] = [];

const push = (s: string) => {
  errors.push(`${new Date().toISOString().slice(11, 19)} ${s}`.slice(0, 500));
  if (errors.length > MAX) errors.shift();
};

export function installReportLog(): void {
  const orig = console.error;
  console.error = (...args: unknown[]) => {
    push(args.map((a) => (a instanceof Error ? a.stack ?? a.message : typeof a === 'string' ? a : JSON.stringify(a))).join(' '));
    orig(...args);
  };
  window.addEventListener('error', (e) => push(e.message));
  window.addEventListener('unhandledrejection', (e) => push(`unhandledrejection ${String(e.reason)}`));
}

export const recentErrors = (): string[] => [...errors];
