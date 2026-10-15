/**
 * 提报中间件（仅 dev server）：
 *   POST   /__report/shot        截框选区域（macOS screencapture）落到 reports/<id>/shot.png，并立刻在后台把截图与存档推到 report-assets 分支
 *   GET    /__report/<id>/shot.png
 *   POST   /__report             等后台上传完成（通常在你打字时已传完），gh 建 issue 打标签，回 { number, url }
 *   DELETE /__report/<id>        取消提报，删目录
 * reports/ 在仓库根目录、不入库；截图与存档推到 report-assets 孤儿分支 reports/<单号>/，issue 正文内嵌截图、写单号。
 */
import { execFile, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
import type { IncomingMessage, ServerResponse } from 'node:http';
import type { Plugin } from 'vite';

const execFileP = promisify(execFile);

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const REPORTS = path.join(ROOT, 'reports');
/** 附件推到仓库的孤儿分支，issue 里用 blob?raw=true 链接内嵌显示 */
const ASSET_BRANCH = 'report-assets';

interface Mark { rect: { x: number; y: number; w: number; h: number }; els: { tag: string; text: string; sel: string }[] }
interface ReportBody {
  id: string; title: string; desc: string; type: 'bug' | 'polish'; judge: boolean;
  tab: string; hash: string; marks: Mark[]; errors: string[]; pasted?: string;
}

/* ---------- gh ---------- */
const gh = async (args: string[]): Promise<string> => {
  const { stdout } = await execFileP('gh', args, { cwd: ROOT, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  return stdout;
};

let repoCache: string | null = null;
async function repoName(): Promise<string> {
  if (!repoCache) repoCache = (await gh(['repo', 'view', '--json', 'nameWithOwner', '-q', '.nameWithOwner'])).trim();
  return repoCache;
}

/** 分支不存在就从空树建一个孤儿分支，不带任何代码；进程内只查一次 */
let branchReady: Promise<void> | null = null;
function ensureAssetBranch(repo: string): Promise<void> {
  branchReady ??= (async () => {
    try { await gh(['api', `repos/${repo}/git/ref/heads/${ASSET_BRANCH}`]); return; } catch { /* 不存在，建 */ }
    const git = (a: string[]) => spawnSync('git', a, { cwd: ROOT, encoding: 'utf8' });
    const tree = git(['hash-object', '-t', 'tree', '/dev/null']).stdout.trim();
    const commit = git(['commit-tree', tree, '-m', 'report assets（提报截图与存档，由提报面板自动推送）']).stdout.trim();
    const r = git(['push', 'origin', `${commit}:refs/heads/${ASSET_BRANCH}`]);
    if (r.status !== 0) throw new Error(`建 ${ASSET_BRANCH} 分支失败：${r.stderr}`);
  })().catch((e) => { branchReady = null; throw e; });
  return branchReady;
}

/** 同一分支的提交必须串行（并发 PUT 会 409），所有上传排一条队 */
let uploadQueue: Promise<unknown> = Promise.resolve();
const enqueue = <T>(fn: () => Promise<T>): Promise<T> => {
  const next = uploadQueue.then(fn, fn);
  uploadQueue = next.catch(() => {});
  return next;
};

/** Contents API 上传一个文件；base64 走 --input 文件避免 argv 超长；已有文件要带 sha 才能覆盖。返回新 sha */
const uploadAsset = (repo: string, rel: string, file: string, message: string, sha?: string): Promise<string> =>
  enqueue(() => uploadAssetNow(repo, rel, file, message, sha));

async function uploadAssetNow(repo: string, rel: string, file: string, message: string, sha?: string): Promise<string> {
  await ensureAssetBranch(repo);
  const bodyFile = file + '.upload.json';
  fs.writeFileSync(bodyFile, JSON.stringify({ message, branch: ASSET_BRANCH, content: fs.readFileSync(file).toString('base64'), ...(sha ? { sha } : {}) }));
  try {
    const out = await gh(['api', '-X', 'PUT', `repos/${repo}/contents/${rel}`, '--input', bodyFile, '-q', '.content.sha']);
    return out.trim();
  } finally {
    fs.rmSync(bodyFile, { force: true });
  }
}
const assetUrl = (repo: string, rel: string) => `https://github.com/${repo}/blob/${ASSET_BRANCH}/${rel}?raw=true`;

/* ---------- 后台上传：每单一份进度，重截图时带上旧 sha 覆盖 ---------- */
interface Pending { shot: Promise<string>; save: Promise<string | null> }
const pending = new Map<string, Pending>();

function startUploads(id: string, dir: string, save: string | null): void {
  const prev = pending.get(id);
  const shot = (async () => {
    const repo = await repoName();
    const oldSha = prev ? await prev.shot.catch(() => undefined) : undefined;
    return uploadAsset(repo, `reports/${id}/shot.png`, path.join(dir, 'shot.png'), `report ${id}: 截图`, oldSha);
  })();
  const saveP = prev?.save ?? (async () => {
    if (!save) return null;
    return uploadAsset(await repoName(), `reports/${id}/save.json`, path.join(dir, 'save.json'), `report ${id}: 存档`);
  })();
  // 失败先吞掉，提报时再 await 一次暴露出来，避免 unhandled rejection
  shot.catch(() => {}); saveP.catch(() => {});
  pending.set(id, { shot, save: saveP });
}

/* ---------- http ---------- */
const readJson = <T>(req: IncomingMessage): Promise<T> =>
  new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on('data', (c: Buffer) => chunks.push(c));
    req.on('end', () => { try { resolve(JSON.parse(Buffer.concat(chunks).toString('utf8')) as T); } catch (e) { reject(e); } });
    req.on('error', reject);
  });

const send = (res: ServerResponse, code: number, body: unknown) => {
  res.statusCode = code;
  res.setHeader('content-type', 'application/json');
  res.end(JSON.stringify(body));
};

const newId = () => {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
};
const safeId = (id: string) => /^[0-9]{8}-[0-9]{6}$/.test(id);

const CIRCLED = '①②③④⑤⑥⑦⑧⑨';

function issueBody(b: ReportBody, shotUrl: string): string {
  const lines: string[] = [b.desc.trim(), '', `![截图](${shotUrl})`, ''];
  lines.push(`**类型**：${b.type === 'bug' ? '缺陷' : '优化'}　**需裁决**：${b.judge ? '是' : '否'}　**页签**：${b.tab}　**hash**：\`${b.hash || '无'}\`　**单号**：\`${b.id}\``, '');
  if (b.marks.some((m) => m.els.length)) {
    lines.push('## 框中元素', '');
    b.marks.forEach((m, i) => m.els.forEach((e) => lines.push(`- ${CIRCLED[i] ?? i + 1} \`${e.text}\` — \`${e.sel}\``)));
    lines.push('');
  }
  if (b.errors.length) lines.push('## 控制台错误', '', '```', ...b.errors, '```', '');
  return lines.join('\n') + '\n';
}

export function reportPlugin(): Plugin {
  return {
    name: 'jh-report',
    apply: 'serve',
    configureServer(server) {
      // 起服就把仓库名与分支查好，第一单也不用等
      repoName().then(ensureAssetBranch).catch(() => {});

      server.middlewares.use('/__report', async (req, res) => {
        const url = req.url ?? '/';
        try {
          // 截框选区域：客户端给出区域在屏幕上的位置（CSS 像素，与 screencapture 的点一致），顺手带上存档
          if (req.method === 'POST' && url === '/shot') {
            const { id: given, x, y, w, h, save } = await readJson<{ id?: string; x: number; y: number; w: number; h: number; save: string | null }>(req);
            const id = given && safeId(given) ? given : newId();
            const dir = path.join(REPORTS, id);
            fs.mkdirSync(dir, { recursive: true });
            const out = path.join(dir, 'shot.png');
            const r = spawnSync('/usr/sbin/screencapture', ['-x', '-R', `${x},${y},${w},${h}`, out]);
            if (r.status !== 0 || !fs.existsSync(out)) return send(res, 500, { error: `screencapture 失败：${r.error?.message || r.stderr?.toString() || `exit ${r.status}`}` });
            if (save && !fs.existsSync(path.join(dir, 'save.json'))) fs.writeFileSync(path.join(dir, 'save.json'), save);
            startUploads(id, dir, save);
            return send(res, 200, { id });
          }
          const m = url.match(/^\/([0-9]{8}-[0-9]{6})\/shot\.png/);
          if (req.method === 'GET' && m) {
            const f = path.join(REPORTS, m[1], 'shot.png');
            if (!fs.existsSync(f)) { res.statusCode = 404; return res.end(); }
            res.setHeader('content-type', 'image/png');
            res.setHeader('cache-control', 'no-store');
            return fs.createReadStream(f).pipe(res);
          }
          const d = url.match(/^\/([0-9]{8}-[0-9]{6})$/);
          if (req.method === 'DELETE' && d) {
            pending.delete(d[1]);
            fs.rmSync(path.join(REPORTS, d[1]), { recursive: true, force: true });
            return send(res, 200, { ok: true });
          }
          if (req.method === 'POST' && (url === '/' || url === '')) {
            const b = await readJson<ReportBody>(req);
            if (!safeId(b.id)) return send(res, 400, { error: 'bad id' });
            const dir = path.join(REPORTS, b.id);
            fs.mkdirSync(dir, { recursive: true });
            const repo = await repoName();
            const p = pending.get(b.id);
            // 贴了自己的图：覆盖本地文件，并带旧 sha 重传
            if (b.pasted) {
              fs.writeFileSync(path.join(dir, 'shot.png'), Buffer.from(b.pasted.replace(/^data:image\/\w+;base64,/, ''), 'base64'));
              const oldSha = p ? await p.shot.catch(() => undefined) : undefined;
              await uploadAsset(repo, `reports/${b.id}/shot.png`, path.join(dir, 'shot.png'), `report ${b.id}: 截图（手贴）`, oldSha);
            } else if (p) {
              await p.shot;   // 通常早已传完；失败在这里抛出
            } else {
              return send(res, 400, { error: '还没有截图' });
            }
            await p?.save;
            const { pasted: _pasted, ...meta } = b;
            fs.writeFileSync(path.join(dir, 'report.json'), JSON.stringify({ ...meta, createdAt: new Date().toISOString() }, null, 2));
            const body = issueBody(b, assetUrl(repo, `reports/${b.id}/shot.png`));
            fs.writeFileSync(path.join(dir, 'issue.md'), body);
            const labels = ['report', 'status::todo', b.type === 'bug' ? 'type::bug' : 'type::enhancement'];
            if (b.judge) labels.push('needs-decision');
            // 直接调 API 建 issue：比 gh issue create 快一半（省掉它自己解析仓库那一步）
            const reqFile = path.join(dir, 'issue.request.json');
            fs.writeFileSync(reqFile, JSON.stringify({ title: b.title, body, labels }));
            const created = JSON.parse(await gh(['api', '-X', 'POST', `repos/${repo}/issues`, '--input', reqFile])) as { number: number; html_url: string };
            fs.rmSync(reqFile, { force: true });
            const issueUrl = created.html_url;
            const number = created.number;
            fs.writeFileSync(path.join(dir, 'issue.json'), JSON.stringify({ number, url: issueUrl }));
            pending.delete(b.id);
            return send(res, 200, { number, url: issueUrl });
          }
          res.statusCode = 404; res.end();
        } catch (e) {
          send(res, 500, { error: e instanceof Error ? e.message : String(e) });
        }
      });
    },
  };
}
