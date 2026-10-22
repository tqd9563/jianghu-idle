#!/usr/bin/env python3
"""把 wuxue-params.json（sim 生成的 171 门参数）、rules/copy/wuxue-forms.md（第一批式名与战报句）
与 rules/copy/wuxue-epigraphs.md（批注）合成代码读的名录表 code/src/engine/data/wuxue-catalog.json。只导出第一批（batch 1，66 门）。
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
EPIGRAPHS = ROOT / 'docs/rules/copy/wuxue-epigraphs.md'
OUT = ROOT / 'code/src/engine/data/wuxue-catalog.json'

# 现有 14 门：新名 → 旧 id（名录 §7.2 改名对照）
EXISTING = {
    '流云剑法': 'liuyunjian', '摧峰掌法': 'kaishanzhang', '暗香飞针': 'xiulizhen', '渡江棍法': 'xingzhegun',
    '惊鸿照影剑': 'jinghongjian', '风生虎啸拳': 'fuhuquan', '飞蝗蔽日石': 'feihuangshi', '大江断流刀': 'duanshuidao',
    '苍崖九叠剑': 'cangyajianjue', '落星沉海剑': 'luoxingjian', '罗汉伏魔棍': 'luohanfumogun', '金刚降魔杵': 'xiangmochufa',
    '落英缤纷针': 'luoyingfeizhen', '牵机引魂镖': 'qianjibiao',
}
NEW_IDS = {
    '青萍剑法': 'qingpingjian', '松涛剑法': 'songtaojian', '疾雨剑法': 'jiyujian', '飞瀑断崖剑': 'feipuduanyajian',
    '破风刀法': 'pofengdao', '开碑刀法': 'kaibeidao', '霜锋刀法': 'shuangfengdao', '截江刀法': 'jiejiangdao',
    '怒涛裂岸刀': 'nutaolieandao', '天河倒悬刀': 'tianhedaoxuandao',
    '雁门枪法': 'yanmenqiang', '惊弦枪法': 'bailaqiang', '破晓枪法': 'zhongpingqiang', '惊蛇枪法': 'jingsheqiang',
    '穿云破月枪': 'chuanyunpoyueqiang', '千树梨花枪': 'lihuadaiyuqiang', '霸王卸甲枪': 'bawangxiejiaqiang',
    '断云棍法': 'qimeigun', '落木棍法': 'saotanggun', '崩云棍法': 'bengyungun', '蟠龙九转棍': 'panlongraozhugun',
    '怒海擒蛟棍': 'fanjiangjiaohaigun', '莲花落地棍': 'lianhualuodigun',
    '啸猿拳法': 'tongbiquan', '伏狮拳法': 'luohanquan', '撼山拳法': 'bengshanquan', '震雷拳法': 'bajiquan',
    '金钟震殿拳': 'jinzhongzhendianquan', '真武荡魔拳': 'zhenwudangmoquan',
    '落霞掌法': 'zhushazhang', '拂柳掌法': 'mianrouzhang', '穿宫掌法': 'baguazhang', '开碑裂石掌': 'kaibeilieshizhang',
    '阴风鬼哭掌': 'yinfengguikuzhang', '千蛇噬心掌': 'qianshesixinzhang', '寒蝉凄切掌': 'hanchanqiqiezhang',
    '点睛指法': 'cunjinzhi', '溯泉指法': 'chuomaizhi', '钩月指法': 'tiegouzhi', '穿石指法': 'jingangzhi',
    '幽篁蛇影指': 'qingshetuxinzhi', '断金碎玉指': 'duanjinsuiyuzhi',
    '穿花腿法': 'lianhuantui', '烟雨腿法': 'chuanlintui', '邀月腿法': 'gouguatui', '卷雪腿法': 'xuanfengtui',
    '醉踏流霞腿': 'yuhuanyuanyangtui', '逐电流星腿': 'zhudianliuxingtui',
    '折柳飞镖': 'liuyebiao', '疏星飞钉': 'jiliding', '惊鸦飞石': 'liuxingshi', '双燕穿帘镖': 'zimuchuanxinbiao',
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


def parse_epigraphs(md: str) -> dict:
    """第一批一节的表格行「| 武学 | 批注 |」"""
    sec = md[md.index('## 1. 第一批'):md.index('## 2. 第二批')]
    return dict(re.findall(r'^\| (\S+) \| (\S+，\S+) \|$', sec, re.M))


def main() -> None:
    params = json.loads(PARAMS.read_text())
    forms = parse_forms(FORMS.read_text())
    eps = parse_epigraphs(EPIGRAPHS.read_text())
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
            'mult0': w['mult0'], 'mults': w['mults'], 'cost': w['cost'], 'p': w['p'], 'cd': w['cd'],
            'type': w['type'], 'ek': w['ek'], 'epigraph': eps[name],
        })
        if wid in SIGNATURE:
            row['signature'] = True
        rows.append(row)
    ids = [r['id'] for r in rows]
    assert len(ids) == len(set(ids)) == 66, len(ids)
    assert len(eps) == 66, len(eps)
    out = {
        'source': 'docs/systems/battle-loot/export_wuxue.py（wuxue-params.json + rules/copy/wuxue-forms.md + wuxue-epigraphs.md）',
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
