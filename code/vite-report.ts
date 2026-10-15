/**
 * 提报中间件（仅 dev server）：
 *   POST   /__report/shot        截当前浏览器窗口（macOS screencapture），落到 reports/<id>/shot.png
 *   GET    /__report/<id>/shot.png
 *   POST   /__report             写 report.json / save.json，gh 建 issue 并打标签，回 { number, url }
 *   DELETE /__report/<id>        取消提报，删目录
 * reports/ 在仓库根目录、不入库；截图与存档再推到 report-assets 孤儿分支 reports/<单号>/，issue 正文内嵌截图、写单号。
 */
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { IncomingMessage, ServerResponse } from 'node:http';
import type { Plugin } from 'vite';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const REPORTS = path.join(ROOT, 'reports');
/** 附件推到仓库的孤儿分支，issue 里用 blob?raw=true 链接内嵌显示 */
const ASSET_BRANCH = 'report-assets';

const gh = (args: string[], input?: string) => spawnSync('gh', args, { cwd: ROOT, encoding: 'utf8', input });

let repoCache: string | null = null;
function repoName(): string {
  if (!repoCache) repoCache = gh(['repo', 'view', '--json', 'nameWithOwner', '-q', '.nameWithOwner']).stdout.trim();
  return repoCache;
}

/** 分支不存在就从空树建一个孤儿分支，不带任何代码 */
function ensureAssetBranch(repo: string): void {
  if (gh(['api', `repos/${repo}/git/ref/heads/${ASSET_BRANCH}`]).status === 0) return;
  const git = (a: string[]) => spawnSync('git', a, { cwd: ROOT, encoding: 'utf8' });
  const tree = git(['hash-object', '-t', 'tree', '/dev/null']).stdout.trim();
  const commit = git(['commit-tree', tree, '-m', 'report assets（提报截图与存档，由提报面板自动推送）']).stdout.trim();
  const r = git(['push', 'origin', `${commit}:refs/heads/${ASSET_BRANCH}`]);
  if (r.status !== 0) throw new Error(`建 ${ASSET_BRANCH} 分支失败：${r.stderr}`);
}

/** Contents API 上传一个文件；base64 走 --input 文件，避免 argv 超长 */
function uploadAsset(repo: string, rel: string, file: string, message: string): string {
  const bodyFile = file + '.upload.json';
  fs.writeFileSync(bodyFile, JSON.stringify({ message, branch: ASSET_BRANCH, content: fs.readFileSync(file).toString('base64') }));
  const r = gh(['api', '-X', 'PUT', `repos/${repo}/contents/${rel}`, '--input', bodyFile]);
  fs.rmSync(bodyFile, { force: true });
  if (r.status !== 0) throw new Error(`上传 ${rel} 失败：${r.stderr || r.stdout}`);
  return `https://github.com/${repo}/blob/${ASSET_BRANCH}/${rel}?raw=true`;
}

interface Mark { rect: { x: number; y: number; w: number; h: number }; els: { tag: string; text: string; sel: string }[] }
interface ReportBody {
  id: string; title: string; desc: string; type: 'bug' | 'polish'; judge: boolean;
  tab: string; hash: string; marks: Mark[]; save: string | null; errors: string[]; pasted?: string;
}

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
      server.middlewares.use('/__report', async (req, res) => {
        const url = req.url ?? '/';
        try {
          // 截框选区域：客户端给出区域在屏幕上的位置（CSS 像素，与 screencapture 的点一致）
          if (req.method === 'POST' && url === '/shot') {
            const { id: given, x, y, w, h } = await readJson<{ id?: string; x: number; y: number; w: number; h: number }>(req);
            const id = given && safeId(given) ? given : newId();
            const dir = path.join(REPORTS, id);
            fs.mkdirSync(dir, { recursive: true });
            const out = path.join(dir, 'shot.png');
            const r = spawnSync('/usr/sbin/screencapture', ['-x', '-R', `${x},${y},${w},${h}`, out]);
            if (r.status !== 0 || !fs.existsSync(out)) return send(res, 500, { error: `screencapture 失败：${r.error?.message || r.stderr?.toString() || `exit ${r.status}`}` });
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
            fs.rmSync(path.join(REPORTS, d[1]), { recursive: true, force: true });
            return send(res, 200, { ok: true });
          }
          if (req.method === 'POST' && (url === '/' || url === '')) {
            const b = await readJson<ReportBody>(req);
            if (!safeId(b.id)) return send(res, 400, { error: 'bad id' });
            const dir = path.join(REPORTS, b.id);
            fs.mkdirSync(dir, { recursive: true });
            if (b.pasted) {
              const base64 = b.pasted.replace(/^data:image\/\w+;base64,/, '');
              fs.writeFileSync(path.join(dir, 'shot.png'), Buffer.from(base64, 'base64'));
            }
            if (b.save) fs.writeFileSync(path.join(dir, 'save.json'), b.save);
            const { pasted: _pasted, save: _save, ...meta } = b;
            fs.writeFileSync(path.join(dir, 'report.json'), JSON.stringify({ ...meta, createdAt: new Date().toISOString() }, null, 2));
            // 附件先推到 report-assets 分支，正文里内嵌显示
            const repo = repoName();
            ensureAssetBranch(repo);
            const shotUrl = uploadAsset(repo, `reports/${b.id}/shot.png`, path.join(dir, 'shot.png'), `report ${b.id}: 截图`);
            if (b.save) uploadAsset(repo, `reports/${b.id}/save.json`, path.join(dir, 'save.json'), `report ${b.id}: 存档`);
            const bodyFile = path.join(dir, 'issue.md');
            fs.writeFileSync(bodyFile, issueBody(b, shotUrl));
            const labels = ['report', 'status::todo', b.type === 'bug' ? 'type::bug' : 'type::enhancement'];
            if (b.judge) labels.push('needs-decision');
            const args = ['issue', 'create', '--title', b.title, '--body-file', bodyFile];
            labels.forEach((l) => args.push('--label', l));
            const r = gh(args);
            if (r.status !== 0) return send(res, 500, { error: `gh 失败：${r.stderr || r.stdout}` });
            const issueUrl = r.stdout.trim().split('\n').pop() ?? '';
            const number = Number(issueUrl.split('/').pop());
            fs.writeFileSync(path.join(dir, 'issue.json'), JSON.stringify({ number, url: issueUrl }));
            return send(res, 200, { number, url: issueUrl });
          }
          res.statusCode = 404; res.end();
        } catch (e) {
          send(res, 500, { error: String(e) });
        }
      });
    },
  };
}
