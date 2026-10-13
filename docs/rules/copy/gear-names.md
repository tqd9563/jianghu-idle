# 装备名表 v0.1（草案）

> **范围**：四部位的物件名，按「型 × 品阶」配。物件名不带词条前缀，前缀规则见 `../../systems/battle-loot/design.md` §3.1a。
> **读法**：每格一个名，掉落时按部位（兵器再按类别）、型、品阶查表。型的属性侧重见 design.md §3.1。
> **状态**：草案，实装前可改字；每格只配一个名，同型同品阶的装备靠词条前缀区分。
> **图**：一名一图，文件在 `code/public/art/gear/`，文件名见下表括号内的 key。

## 兵器（基础属性：攻击；轻型另带少量命中）

| 类别 · 型 | 凡品 | 精良 | 上乘 | 珍品 | 极品 |
|---|---|---|---|---|---|
| 剑 · 重型 | 铁剑（jian-tie） | 青锋剑（jian-qingfeng） | 玄铁剑（jian-xuantie） | 龙泉剑（jian-longquan） | 太阿剑（jian-taie） |
| 剑 · 轻型 | 柳叶剑（jian-liuye） | 青萍剑（jian-qingping） | 游龙剑（jian-youlong） | 幽兰剑（jian-youlan） | 湛卢剑（jian-zhanlu） |
| 刀 · 重型 | 柴刀（dao-chai） | 朴刀（dao-pu） | 鬼头刀（dao-guitou） | 斩马刀（dao-zhanma） | 龙雀刀（dao-longque） |
| 刀 · 轻型 | 柳叶刀（dao-liuye） | 雁翎刀（dao-yanling） | 苗刀（dao-miao） | 绣春刀（dao-xiuchun） | 冷月刀（dao-lengyue） |
| 枪 · 重型 | 白蜡枪（qiang-bailayan） | 铁枪（qiang-tie） | 点钢枪（qiang-diangang） | 虎头枪（qiang-hutou） | 霸王枪（qiang-bawang） |
| 枪 · 轻型 | 竹枪（qiang-zhu） | 梨花枪（qiang-lihua） | 银枪（qiang-yin） | 亮银枪（qiang-liangyin） | 龙胆枪（qiang-longdan） |
| 棍 · 重型 | 齐眉棍（gun-qimei） | 铁棍（gun-tie） | 熟铜棍（gun-shutong） | 镔铁棍（gun-bintie） | 镇岳棍（gun-zhenyue） |
| 棍 · 轻型 | 竹棍（gun-zhu） | 白蜡棍（gun-baila） | 藤棍（gun-teng） | 乌木棍（gun-wumu） | 紫檀棍（gun-zitan） |

## 暗器（基础属性：攻击、命中）

| 型 | 凡品 | 精良 | 上乘 | 珍品 | 极品 |
|---|---|---|---|---|---|
| 锐型（偏攻击） | 铁蒺藜（anqi-jili） | 柳叶镖囊（anqi-liuye） | 透骨钉匣（anqi-tougu） | 飞蝗石囊（anqi-feihuang） | 暴雨梨花针（anqi-liha） |
| 准型（偏命中） | 石囊（anqi-shi） | 梅花针筒（anqi-meihua） | 袖箭（anqi-xiujian） | 子母镖囊（anqi-zimu） | 满天花雨囊（anqi-mantian） |

## 衣甲（基础属性：气血、防御）

| 型 | 凡品 | 精良 | 上乘 | 珍品 | 极品 |
|---|---|---|---|---|---|
| 厚型（偏气血） | 粗布短打（jia-cubu） | 皮甲（jia-pi） | 棉甲（jia-mian） | 虎皮甲（jia-hupi） | 乌金甲（jia-wujin） |
| 坚型（偏防御） | 麻衣（jia-mayi） | 锁子甲（jia-suozi） | 鳞甲（jia-lin） | 蝮蛇甲（jia-fushe） | 金丝软甲（jia-jinsi） |

## 佩饰（基础属性：命中或闪避）

| 型 | 凡品 | 精良 | 上乘 | 珍品 | 极品 |
|---|---|---|---|---|---|
| 命中型 | 铜钱串（pei-tongqian） | 香囊（pei-xiangnang） | 青玉佩（pei-qingyu） | 翡翠扳指（pei-feicui） | 鹰眼坠（pei-yingyan） |
| 闪避型 | 平安符（pei-pingan） | 红绳（pei-hongsheng） | 白玉环（pei-baiyu） | 燕尾佩（pei-yanwei） | 踏雪铃（pei-taxue） |

## 变更日志

| 版本 | 日期 | 变更内容 |
|---|---|---|
| v0.1 | 2026-10-13 | 首版：四部位按型 × 品阶各一名，兵器按四类别分列，共 70 个名。 |
