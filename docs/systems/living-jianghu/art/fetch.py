"""轮询 tasks.txt 里未下载的任务，完成即下载到 out/<key>.png（多张加 -2）"""
import os
import json, subprocess, re, os, time, urllib.request
D = os.path.dirname(os.path.abspath(__file__))
os.makedirs(f'{D}/out', exist_ok=True)
tasks = [l.split() for l in open(f'{D}/tasks.txt') if l.strip()]
pending = {k: t for k, t in tasks if not os.path.exists(f'{D}/out/{k}.png')}
deadline = time.time() + 1500
while pending and time.time() < deadline:
    for k, t in list(pending.items()):
        out = subprocess.run(["atlas-skillhub", "gateway", "call-tool", "--service", "liclick", "--tool", "get_task_status", f"task_id={t}", "task_type=image"], capture_output=True, text=True).stdout
        if '"Failed"' in out or '失败' in out:
            print(k, 'FAILED'); pending.pop(k); continue
        if '完成' in out:
            urls = re.findall(r'https://[^\s"\\]+', out.replace('\\u0026', '&'))
            urls = list(dict.fromkeys(urls))
            for i, u in enumerate(urls):
                urllib.request.urlretrieve(u, f'{D}/out/{k}{"" if i == 0 else "-" + str(i + 1)}.png')
            print(k, 'ok', len(urls)); pending.pop(k)
    if pending: time.sleep(20)
print('pending', list(pending))
