/**
 * 提报中间件（仅 dev server）：
 *   POST   /__report/shot        截当前浏览器窗口（macOS screencapture），落到 reports/<id>/shot.png
 *   GET    /__report/<id>/shot.png
 *   POST   /__report             写 report.json / save.json，gh 建 issue 并打标签，回 { number, url }
 *   DELETE /__report/<id>        取消提报，删目录
 * reports/ 在仓库根目录、不入库；issue 正文里写绝对路径，fix-todo 在本机按路径读。
 */
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { IncomingMessage, ServerResponse } from 'node:http';
import type { Plugin } from 'vite';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const REPORTS = path.join(ROOT, 'reports');

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

function issueBody(b: ReportBody, dir: string): string {
  const lines: string[] = [b.desc.trim(), ''];
  lines.push(`**类型**：${b.type === 'bug' ? '缺陷' : '优化'}　**需裁决**：${b.judge ? '是' : '否'}　**页签**：${b.tab}　**hash**：\`${b.hash || '无'}\``, '');
  if (b.marks.some((m) => m.els.length)) {
    lines.push('## 框中元素', '');
    b.marks.forEach((m, i) => m.els.forEach((e) => lines.push(`- ${CIRCLED[i] ?? i + 1} \`${e.text}\` — \`${e.sel}\``)));
    lines.push('');
  }
  lines.push('## 附件（本机）', '');
  lines.push(`- 截图：\`${path.join(dir, 'shot.png')}\``);
  if (b.save) lines.push(`- 存档：\`${path.join(dir, 'save.json')}\``);
  lines.push(`- 控制台错误：${b.errors.length} 条${b.errors.length ? '，见 report.json' : ''}`);
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
          // 截窗口：客户端给出窗口在屏幕上的位置（CSS 像素，与 screencapture 的点一致）
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
            const bodyFile = path.join(dir, 'issue.md');
            fs.writeFileSync(bodyFile, issueBody(b, dir));
            const labels = ['report', 'status::todo', b.type === 'bug' ? 'type::bug' : 'type::enhancement'];
            if (b.judge) labels.push('needs-decision');
            const args = ['issue', 'create', '--title', b.title, '--body-file', bodyFile];
            labels.forEach((l) => args.push('--label', l));
            const r = spawnSync('gh', args, { cwd: ROOT, encoding: 'utf8' });
            if (r.status !== 0) return send(res, 500, { error: `gh 失败：${r.stderr || r.stdout}` });
            const issueUrl = r.stdout.trim().split('\n').pop() ?? '';
            const number = Number(issueUrl.split('/').pop());
            fs.appendFileSync(path.join(dir, 'report.json'), '');
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
