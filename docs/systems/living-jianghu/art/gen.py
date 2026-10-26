"""提交 liclick 生图任务：读 jobs JSON（[{key, prompt, ref, ar|w/h, size}]），任务 id 追加到 tasks.txt"""
import os
import json, subprocess, sys, re
D = os.path.dirname(os.path.abspath(__file__))
assets = dict(l.split() for l in open(f'{D}/assets.txt'))
jobs = json.load(open(sys.argv[1]))
for j in jobs:
    ep = {"quality": "high", "image_size": j.get("size", "2K"), "name": j["key"]}
    if "w" in j: ep.update(aspect_ratio_w=j["w"], aspect_ratio_h=j["h"])
    else: ep["aspect_ratio"] = j.get("ar", "16:9")
    refs = j["ref"] if isinstance(j.get("ref"), list) else ([j["ref"]] if j.get("ref") else [])
    if refs: ep["reference_images"] = [{"asset_id": assets[r], "type": "image"} for r in refs]
    if j.get("bg"): ep["background"] = j["bg"]
    args = {"prompt": j["prompt"], "model": "gpt-image-2.5-sunburst", "name": j["key"], "extra_params": ep}
    out = subprocess.run(["atlas-skillhub", "gateway", "call-tool", "--service", "liclick", "--tool", "generate_image", "--args", json.dumps(args, ensure_ascii=False)], capture_output=True, text=True).stdout
    m = re.search(r'task_id[\"\\: ]+([0-9a-zA-Z_-]{8,})', out)
    print(j["key"], m.group(1) if m else 'FAIL ' + out[:300])
    if m: open(f'{D}/tasks.txt', 'a').write(f'{j["key"]} {m.group(1)}\n')
