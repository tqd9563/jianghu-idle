/**
 * vitest node 环境自带 node:fs / node:path；工程刻意不装 @types/node
 * （node_modules 有 rolldown 原生绑定的已知坑，见 code/README），
 * 此处为测试代码用到的最小 API 做 ambient 声明，只为过 tsc。
 */
declare module 'node:fs' {
  export function mkdirSync(path: string, opts?: { recursive?: boolean }): void;
  export function writeFileSync(path: string, data: string): void;
}
declare module 'node:path' {
  export function resolve(...paths: string[]): string;
}
declare const process: { cwd(): string };
