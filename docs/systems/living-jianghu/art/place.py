"""把 out/ 里的图压缩放进 public/art/：场景 scene/<名>.jpg、分图 region/<名>.jpg、头像 pt/<套>.jpg、长卷像 pt/ink-<套>.jpg"""
import os, glob
from PIL import Image
D=os.path.dirname(os.path.abspath(__file__))
A=os.path.join(os.path.dirname(os.path.abspath(__file__)), '../../../../code/public/art')
for d in ('scene','region','pt'): os.makedirs(f'{A}/{d}', exist_ok=True)
n=0
for f in sorted(glob.glob(f'{D}/out/*.png')):
    k=os.path.basename(f)[:-4]
    if k.endswith('-2'): continue
    im=Image.open(f).convert('RGB')
    if k.startswith('s-'): dst=f'{A}/scene/{k[2:]}.jpg'; im=im.resize((2048,1152)) if im.size!=(2048,1152) else im; q=80
    elif k.startswith('r-'): dst=f'{A}/region/{k[2:]}.jpg'; im=im.resize((2048,1152)) if im.size!=(2048,1152) else im; q=82
    elif k.startswith('p-'): dst=f'{A}/pt/{k[2:]}.jpg'; im.thumbnail((256,256)); q=85
    elif k.startswith('ink-'): dst=f'{A}/pt/ink-{k[4:].rsplit("-",1)[0]}.jpg'; im.thumbnail((900,675)); q=82
    else: continue
    im.save(dst, quality=q, optimize=True, progressive=True); n+=1
print(n)
