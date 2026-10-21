#!/usr/bin/env python3
"""把 wuxue-params.json（sim 生成的 171 门参数）与 rules/copy/wuxue-forms.md（第一批式名与战报句）
合成代码读的名录表 code/src/engine/data/wuxue-catalog.json。只导出第一批（batch 1，66 门）。
现有 14 门的 id 沿用 wuxue.ts，式名与句子仍在 formNames.ts / narration.ts；新增 52 门的式名与句子从草案并入。

五项参数与类型（重击 / 折中 / 双强）、特效系数由 calib_cast.py --write 写入 wuxue-params.json（裁决 46）。

用法：python3 docs/systems/battle-loot/export_wuxue.py
"""
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
PARAMS = ROOT / 'docs/systems/battle-loot/wuxue-params.json'
FORMS = ROOT / 'docs/archive/copy/wuxue-forms.md'
OUT = ROOT / 'code/src/engine/data/wuxue-catalog.json'

# 现有 14 门：新名 → 旧 id（名录 §7.2 改名对照）
EXISTING = {
    '流云剑法': 'liuyunjian', '开山掌': 'kaishanzhang', '袖里针': 'xiulizhen', '行者棍': 'xingzhegun',
    '惊鸿照影剑': 'jinghongjian', '黑风伏虎拳': 'fuhuquan', '飞蝗蔽日石': 'feihuangshi', '大江断流刀': 'duanshuidao',
    '苍崖九叠剑': 'cangyajianjue', '落星沉海剑': 'luoxingjian', '罗汉伏魔棍': 'luohanfumogun', '金刚降魔杵': 'xiangmochufa',
    '落英缤纷针': 'luoyingfeizhen', '牵机引魂镖': 'qianjibiao',
}
NEW_IDS = {
    '青萍剑法': 'qingpingjian', '松涛剑法': 'songtaojian', '疾雨剑法': 'jiyujian', '飞瀑断崖剑': 'feipuduanyajian',
    '破风刀法': 'pofengdao', '开碑刀法': 'kaibeidao', '霜锋刀法': 'shuangfengdao', '截江刀法': 'jiejiangdao',
    '怒涛裂岸刀': 'nutaolieandao', '天河倒悬刀': 'tianhedaoxuandao',
    '雁门枪': 'yanmenqiang', '白蜡枪': 'bailaqiang', '中平枪': 'zhongpingqiang', '惊蛇枪': 'jingsheqiang',
    '穿云破月枪': 'chuanyunpoyueqiang', '梨花带雨枪': 'lihuadaiyuqiang', '霸王卸甲枪': 'bawangxiejiaqiang',
    '齐眉棍': 'qimeigun', '扫堂棍': 'saotanggun', '崩云棍': 'bengyungun', '盘龙绕柱棍': 'panlongraozhugun',
    '翻江搅海棍': 'fanjiangjiaohaigun', '莲花落地棍': 'lianhualuodigun',
    '通臂拳': 'tongbiquan', '罗汉拳': 'luohanquan', '崩山拳': 'bengshanquan', '八极拳': 'bajiquan',
    '金钟震殿拳': 'jinzhongzhendianquan', '真武荡魔拳': 'zhenwudangmoquan',
    '朱砂掌': 'zhushazhang', '绵柔掌': 'mianrouzhang', '八卦掌': 'baguazhang', '开碑裂石掌': 'kaibeilieshizhang',
    '阴风鬼哭掌': 'yinfengguikuzhang', '千蛇噬心掌': 'qianshesixinzhang', '寒蝉凄切掌': 'hanchanqiqiezhang',
    '寸劲指': 'cunjinzhi', '戳脉指': 'chuomaizhi', '铁钩指': 'tiegouzhi', '金刚指': 'jingangzhi',
    '青蛇吐信指': 'qingshetuxinzhi', '断金碎玉指': 'duanjinsuiyuzhi',
    '连环腿': 'lianhuantui', '穿林腿': 'chuanlintui', '勾挂腿': 'gouguatui', '旋风腿': 'xuanfengtui',
    '玉环鸳鸯腿': 'yuhuanyuanyangtui', '逐电流星腿': 'zhudianliuxingtui',
    '柳叶镖': 'liuyebiao', '蒺藜钉': 'jiliding', '流星石': 'liuxingshi', '子母穿心镖': 'zimuchuanxinbiao',
}
# 来路：现有 14 门照旧（书肆 / Boss / 三派）；新增寻常、上乘走挂机；绝学按门派（名录 §5.1）
EXISTING_SOURCE = {
    'liuyunjian': '书肆', 'kaishanzhang': '书肆', 'xiulizhen': '书肆', 'xingzhegun': '书肆',
    'jinghongjian': 'Boss', 'fuhuquan': 'Boss', 'feihuangshi': 'Boss', 'duanshuidao': 'Boss',
    'cangyajianjue': '华山', 'luoxingjian': '华山', 'luohanfumogun': '少林', 'xiangmochufa': '少林',
    'luoyingfeizhen': '唐门', 'qianjibiao': '唐门',
}
JUEXUE_SECT = {'天河倒悬刀': '崆峒', '霸王卸甲枪': '雁门世家', '莲花落地棍': '丐帮', '真武荡魔拳': '武当',
               '千蛇噬心掌': '百蛊门', '寒蝉凄切掌': '峨眉'}
SIGNATURE = {'luoxingjian', 'xiangmochufa', 'qianjibiao'}


def parse_forms(md: str) -> dict:
    sec = md[md.index('## 2. 各门武学'):md.index('## 变更日志')]
    out = {}
    for block in re.split(r'\n(?=\*\*)', sec):
        m = re.match(r'\*\*(.+?)\*\*（(寻常|上乘|绝学) · .+? · 特效.+?）——', block)
        if not m:
            continue
        forms = re.findall(r'^\d+\. (.+?)：(.+)$', block, re.M)
        out[m.group(1)] = ([f[0] for f in forms], [f[1] for f in forms])
    return out


def main() -> None:
    params = json.loads(PARAMS.read_text())
    forms = parse_forms(FORMS.read_text())
    rows = []
    for w in params['wuxue']:
        if w['batch'] != 1:
            continue
        name = w['name']
        if name in EXISTING:
            wid = EXISTING[name]
            row = {'id': wid, 'source': EXISTING_SOURCE[wid]}
        else:
            wid = NEW_IDS[name]
            names, lines = forms[name]
            row = {'id': wid, 'source': JUEXUE_SECT.get(name, '挂机'), 'forms': names, 'lines': lines}
        row.update({
            'name': name, 'quality': w['quality'], 'cat': w['cat'], 'route': w['route'], 'effect': w['effect'],
            'mult0': w['mult0'], 'cost': w['cost'], 'p': w['p'], 'cd': w['cd'],
            'type': w['type'], 'ek': w['ek'],
        })
        if wid in SIGNATURE:
            row['signature'] = True
        rows.append(row)
    ids = [r['id'] for r in rows]
    assert len(ids) == len(set(ids)) == 66, len(ids)
    out = {
        'source': 'docs/systems/battle-loot/export_wuxue.py（wuxue-params.json + rules/copy/wuxue-forms.md）',
        'trigger_cap': params['trigger_cap'],
        'effects': params['effects'],
        'tier_span': params['tier_span'],
        'shulian': params['shulian'],
        'pages': params['pages'],
        'wx_p': params['wx_p'],
        'calib': params['calib'],
        'wuxue': rows,
    }
    OUT.write_text(json.dumps(out, ensure_ascii=False, indent=1) + '\n')
    print(f'wrote {OUT.relative_to(ROOT)}: {len(rows)} 门')


if __name__ == '__main__':
    main()
