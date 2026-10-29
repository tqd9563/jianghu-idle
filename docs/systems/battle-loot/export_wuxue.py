#!/usr/bin/env python3
"""把 wuxue-params.json（sim 生成的 171 门参数）、rules/copy/wuxue-forms.md（第一批式名与战报句）、
sect-overhaul/copy-draft.md（第三批式名 §1、战报句 §3、批注 §4）与 rules/copy/wuxue-epigraphs.md（批注）
合成代码读的名录表 code/src/engine/data/wuxue-catalog.json。导出第一批（66 门）与第三批（门派前置 18 门）。
现有 14 门的 id 沿用 wuxue.ts，式名与句子仍在 formNames.ts / narration.ts；其余的式名与句子从草案并入。
改名的三门（不周擎天棍 / 万岳镇川棍 / 烈日熔金刀）id 不变，式名、句子与批注改走 copy-draft。

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
COPY = ROOT / 'docs/systems/sect-overhaul/copy-draft.md'
OUT = ROOT / 'code/src/engine/data/wuxue-catalog.json'
BATCHES = (1, 3)

# 现有 14 门：新名 → 旧 id（名录 §7.2 改名对照）
EXISTING = {
    '流云剑法': 'liuyunjian', '摧峰掌法': 'kaishanzhang', '暗香飞针': 'xiulizhen', '渡江棍法': 'xingzhegun',
    '惊鸿照影剑': 'jinghongjian', '风生虎啸拳': 'fuhuquan', '飞蝗蔽日石': 'feihuangshi', '大江断流刀': 'duanshuidao',
    '苍崖九叠剑': 'cangyajianjue', '落星沉海剑': 'luoxingjian', '罗汉伏魔棍': 'luohanfumogun', '不周擎天棍': 'xiangmochufa',
    '落英缤纷针': 'luoyingfeizhen', '牵机引魂镖': 'qianjibiao',
}
NEW_IDS = {
    '青萍剑法': 'qingpingjian', '松涛剑法': 'songtaojian', '疾雨剑法': 'jiyujian', '飞瀑断崖剑': 'feipuduanyajian',
    '破风刀法': 'pofengdao', '开碑刀法': 'kaibeidao', '霜锋刀法': 'shuangfengdao', '截江刀法': 'jiejiangdao',
    '怒涛裂岸刀': 'nutaolieandao', '烈日熔金刀': 'tianhedaoxuandao',
    '雁门枪法': 'yanmenqiang', '惊弦枪法': 'bailaqiang', '破晓枪法': 'zhongpingqiang', '惊蛇枪法': 'jingsheqiang',
    '穿云破月枪': 'chuanyunpoyueqiang', '千树梨花枪': 'lihuadaiyuqiang', '霸王卸甲枪': 'bawangxiejiaqiang',
    '断云棍法': 'qimeigun', '落木棍法': 'saotanggun', '崩云棍法': 'bengyungun', '蟠龙九转棍': 'panlongraozhugun',
    '怒海擒蛟棍': 'fanjiangjiaohaigun', '万岳镇川棍': 'lianhualuodigun',
    '啸猿拳法': 'tongbiquan', '伏狮拳法': 'luohanquan', '撼山拳法': 'bengshanquan', '震雷拳法': 'bajiquan',
    '金钟震殿拳': 'jinzhongzhendianquan', '真武荡魔拳': 'zhenwudangmoquan',
    '落霞掌法': 'zhushazhang', '拂柳掌法': 'mianrouzhang', '穿宫掌法': 'baguazhang', '开碑裂石掌': 'kaibeilieshizhang',
    '阴风鬼哭掌': 'yinfengguikuzhang', '千蛇噬心掌': 'qianshesixinzhang', '寒蝉凄切掌': 'hanchanqiqiezhang',
    '点睛指法': 'cunjinzhi', '溯泉指法': 'chuomaizhi', '钩月指法': 'tiegouzhi', '穿石指法': 'jingangzhi',
    '幽篁蛇影指': 'qingshetuxinzhi', '断金碎玉指': 'duanjinsuiyuzhi',
    '穿花腿法': 'lianhuantui', '烟雨腿法': 'chuanlintui', '邀月腿法': 'gouguatui', '卷雪腿法': 'xuanfengtui',
    '醉踏流霞腿': 'yuhuanyuanyangtui', '逐电流星腿': 'zhudianliuxingtui',
    '折柳飞镖': 'liuyebiao', '疏星飞钉': 'jiliding', '惊鸦飞石': 'liuxingshi', '双燕穿帘镖': 'zimuchuanxinbiao',
    # 第三批（门派前置）：按名字拼音
    '罗汉十八腿': 'luohanshibatui', '千丝万缕针': 'qiansiwanlvzhen', '鹤翔紫霄腿': 'hexiangzixiaotui',
    '踏罡步斗腿': 'tagangbudoutui', '九曲封脉指': 'jiuqufengmaizhi', '万毒归宗掌': 'wanduguizongzhang',
    '百鸟朝凤枪': 'bainiaochaofengqiang', '流星贯月枪': 'liuxingguanyueqiang', '七虫断魂指': 'qichongduanhunzhi',
    '阴云蔽月指': 'yinyunbiyuezhi', '风雷断岳刀': 'fengleiduanyuedao', '铁马冰河刀': 'tiemabinghedao',
    '巨鳌负山拳': 'juaofushanquan', '长鲸吸海拳': 'changjingxihaiquan', '海潮吞月掌': 'haichaotunyuezhang',
    '五毒攒心掌': 'wuducuanxinzhang', '满天星斗镖': 'mantianxingdoubiao', '冷磷照骨指': 'lenglinzhaoguzhi',
}
# 来路：现有 14 门照旧（书肆 / Boss / 三派）；新增寻常、上乘走挂机；绝学与镇宗上乘按门派（sect-overhaul/design.md §3 总表）
EXISTING_SOURCE = {
    'liuyunjian': '书肆', 'kaishanzhang': '书肆', 'xiulizhen': '书肆', 'xingzhegun': '书肆',
    'jinghongjian': 'Boss', 'fuhuquan': 'Boss', 'feihuangshi': 'Boss', 'duanshuidao': 'Boss',
    'cangyajianjue': '苍崖派', 'luoxingjian': '苍崖派', 'luohanfumogun': '千岩寺', 'xiangmochufa': '擎天门',
    'luoyingfeizhen': '花影坊', 'qianjibiao': '花影坊',
}
SECT_OF = {
    '烈日熔金刀': '鸣沙教', '霸王卸甲枪': '苍梧派', '万岳镇川棍': '擎天门', '真武荡魔拳': '乾元观',
    '千蛇噬心掌': '千蛇窟', '寒蝉凄切掌': '千蛇窟',
    '罗汉十八腿': '千岩寺', '千丝万缕针': '花影坊', '鹤翔紫霄腿': '凌风山庄', '踏罡步斗腿': '乾元观', '九曲封脉指': '水月庵',
    '万毒归宗掌': '瘴月教', '百鸟朝凤枪': '苍梧派', '流星贯月枪': '苍梧派', '七虫断魂指': '阴山派', '阴云蔽月指': '阴山派',
    '风雷断岳刀': '风雷堡', '铁马冰河刀': '风雷堡', '巨鳌负山拳': '虎啸山庄', '长鲸吸海拳': '虎啸山庄', '海潮吞月掌': '蜃海教',
    '五毒攒心掌': '北邙门', '满天星斗镖': '天工坊', '冷磷照骨指': '碧磷洞',
}
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


def section(md: str, head: str) -> str:
    start = md.index(f'\n## {head}')
    end = md.find('\n## ', start + 1)
    return md[start:end if end > 0 else None]


def parse_batch3(md: str) -> tuple[dict, dict]:
    """copy-draft：§1 表「| 武学 · 门派 | 一 | 二 … |」给式名，§3 每式一句（格式同 battle-narration.md §5.1），§4 表给批注"""
    names = {m.group(1): m.group(2).split(' | ') for m in re.finditer(r'^\| (?!武学)(\S+) · \S+ \| (.+) \|$', section(md, '§1'), re.M)}
    forms = {}
    for block in re.split(r'\n(?=\*\*)', section(md, '§3')):
        m = re.match(r'\*\*(.+?)\*\*（', block)
        if not m or m.group(1) not in names:
            continue
        fl = re.findall(r'^\d+\. (.+?)：(.+)$', block, re.M)
        assert [f[0] for f in fl] == names[m.group(1)], m.group(1)
        forms[m.group(1)] = (names[m.group(1)], [f[1] for f in fl])
    assert set(forms) == set(names), set(names) - set(forms)
    eps = dict(re.findall(r'^\| (\S+) \| (\S+，\S+) \| ', section(md, '§4'), re.M))
    assert set(eps) == set(names), set(names) ^ set(eps)
    return forms, eps


def main() -> None:
    params = json.loads(PARAMS.read_text())
    forms3, eps3 = parse_batch3(COPY.read_text())
    forms = {**parse_forms(FORMS.read_text()), **forms3}
    eps = {**parse_epigraphs(EPIGRAPHS.read_text()), **eps3}
    rows = []
    for w in params['wuxue']:
        if w['batch'] not in BATCHES:
            continue
        name = w['name']
        if name in EXISTING:
            wid = EXISTING[name]
            row = {'id': wid, 'source': EXISTING_SOURCE[wid]}
            if name in forms3:
                row['forms'], row['lines'] = forms3[name]
        else:
            wid = NEW_IDS[name]
            names, lines = forms[name]
            row = {'id': wid, 'source': SECT_OF.get(name, '挂机'), 'forms': names, 'lines': lines}
        row.update({
            'name': name, 'quality': w['quality'], 'cat': w['cat'], 'route': w['route'], 'effect': w['effect'],
            'mult0': w['mult0'], 'mults': w['mults'], 'cost': w['cost'], 'p': w['p'], 'cd': w['cd'],
            'type': w['type'], 'ek': w['ek'], 'epigraph': eps[name],
        })
        if wid in SIGNATURE:
            row['signature'] = True
        rows.append(row)
    ids = [r['id'] for r in rows]
    assert len(ids) == len(set(ids)) == 84, len(ids)
    assert len(eps) == 84, len(eps)
    out = {
        'source': 'docs/systems/battle-loot/export_wuxue.py（wuxue-params.json + archive/copy/wuxue-forms.md + sect-overhaul/copy-draft.md + wuxue-epigraphs.md）',
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
