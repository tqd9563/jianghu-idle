/**
 * 穷尽性检查工具 —— 内容扩充防御。
 *
 * 用于路线 / 地图等「联合类型分支」的兜底分支：新增成员而忘记补分支时，
 * 编译期即报错（参数类型不再是 never），而不是静默走进 else 拿到错误行为。
 * 运行期兜底抛错，保证即使绕过类型检查也不会静默出错。
 */
export function assertNever(x: never, context = 'unhandled case'): never {
  throw new Error(`${context}: ${String(x)}`);
}
