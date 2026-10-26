import os
import json
D=os.path.dirname(os.path.abspath(__file__))
STYLE = ("Keep the same dark night painterly ink-and-wash style as the reference photo-painting of the canal town: cool grey-blue palette, "
         "only a few warm lantern or torch glows, soft fade to near-black at the bottom of the frame. No people, no text, no moon. ")
PATH = {
 'gz': "Use the reference image only for composition and camera. Keep the walkable path in exactly the same place and shape: a walkway entering at the bottom-left, running across the middle ground, over an arched bridge on the right, then up a long staircase to a gate at the upper right. ",
 'gzm': "Use the reference image only for composition and camera. Keep the walkable path in exactly the same place and shape: a walkway entering at the bottom-right, running across the middle ground, over an arched bridge on the left, then up a long staircase to a gate at the upper left. ",
 'tc': "The reference is a rough layout sketch. Follow the pale winding band exactly: it is the walkable path, entering at the bottom center, curving left, then right across the middle, then left again and up to a gate structure near the top center-right. Keep the path's position and curves exactly; paint everything else freely as a finished scene. ",
}
SCENES = [
 ('taian-gudao','gz',"an ancient post road in the foothills of Mount Tai in Shandong: a rutted earth and flagstone road, a roadside tea stall with a lantern, old cypress trees, a simple stone bridge over a dry stream, and stone steps up to a small roadside shrine gate on the hill; Mount Tai's dark ridgeline far behind. Late autumn."),
 ('luanshi-ai','tc',"a bandit-held rocky pass in the hills of Shandong: a narrow trail winding through jumbled boulders and scree, crude wooden barricades and stakes beside the path, torches, and at the top a rough timber gatehouse built into the rock cleft with tattered banners. Wind, dry grass."),
 ('huaiyang-yilu','gzm',"the post road between Huai'an and Yangzhou on a flat watery plain: a raised causeway road lined with willows, a relay-station inn with lanterns and a horse post, a stone bridge over a canal, and stairs up to a city gate tower in the distance. Light spring mist."),
 ('cangya-jianfang','gzm',"a sword-forging workshop of an orthodox sword sect at the foot of green hills in Huainan: stone-paved path between forge sheds with glowing furnaces and racks of drying blades, a quench pool, a stone bridge over a mountain brook, and steps up to a hillside hall. Smoke drifting."),
 ('yunhe-caodu','gz',"a Grand Canal grain ferry crossing held by a canal-boatmen's guild: a stone quay walkway with stacked grain sacks and rope coils, moored grain barges with lanterns, a humped stone bridge, and stairs up to the guild's warehouse gate. Calm water reflections."),
 ('qianfan-shuizhai','gzm',"a fortified lake stockade of a canal guild: a long timber pier walkway over the water, many moored junks with tall masts and furled sails, a wooden arched bridge between pontoons, and stairs up to a fortified water-gate tower with flags. Big lake, mist."),
 ('ludang-sheji','tc',"a sinister market hidden in a vast reed marsh: a winding boardwalk path on stilts through tall reeds, stilt huts with bamboo cages of snakes and dim green lanterns, jars and drying herbs, and at the end a crude gate of lashed bamboo with snake-skull ornaments. Fog over black water."),
 ('xingfeng-gu','tc',"a dark, misty gorge lair of a snake-venom sect: a narrow stone path winding between sheer wet cliffs and dead trees, carved serpent statues beside the path, faint greenish fog, and at the top a cave mouth gate carved with a coiled serpent. Ominous."),
 ('gusu-yidao','gzm',"the post road into Suzhou in Jiangnan: a flagstone road along a canal lined with weeping willows and white-walled black-tiled houses, a relay inn with lanterns, a graceful stone arch bridge, and steps up to the Suzhou city gate. Spring drizzle."),
 ('yunzhan-xiangshi','gz',"a temple-fair incense market below a great Buddhist monastery in Jiangnan hills: a stone path between incense and candle stalls with red lanterns, a large bronze incense burner with smoke, a stone bridge over a lotus pond, and long stairs up to the monastery's outer gate. Incense haze."),
 ('qianyan-shanmen','tc',"the mountain gate of a great Buddhist monastery among rocky peaks: stone steps winding up the mountainside past rock-carved Buddhas and ancient pines, stone lanterns, and at the top a grand temple gate hall with a plaque and bell tower. Clouds below the peaks."),
 ('jinghu-bieye','gzm',"the lakeside villa of an old aristocratic clan in Shaoxing: a stone causeway path across a mirror-calm lake, elegant pavilions and covered corridors, a moon-shaped stone bridge, and steps up to the villa's grand vermilion gate with stone lions. Reflections, refined."),
 ('qinhuai-huafang','gz',"the Qinhuai river pleasure quarter in Nanjing at night, controlled by a seductive sect of women: a riverside stone walkway with silk lanterns, painted pleasure boats moored along the bank, a humped bridge, and steps up to an ornate pavilion gate draped with silk. Romantic yet dangerous."),
 ('shili-huazhen','tc',"a maze of blossoming peach trees and pink petals forming a deadly formation: a narrow path winding through dense flowering trees and stone formation pillars, hanging lanterns and silk ribbons, drifting petals, and at the top a moon-gate pavilion. Beautiful but eerie."),
]
jobs=[{'key':f's-{k}','ref':t,'prompt':PATH[t]+STYLE+'Replace the setting: '+desc} for k,t,desc in SCENES]
jobs.append({'key':'r-qilu','ref':['jn'],'prompt':"Same bird's-eye ink-and-wash night map style, camera angle, detail density and palette as the reference image. Paint a different region: Qilu (Shandong) in ancient China, the foothills of Mount Tai with rolling hills, terraced fields, the broad Yellow River in the upper part. Paint these three places directly into the land as clear landmarks, well separated: on the left, an ancient post road winding toward Mount Tai with a roadside tea stall and inn; in the center-right by the river, a desolate ferry crossing with a bandit stockade and reeds; on the lower right, a rocky mountain pass with a crude timber gatehouse. The rest is quiet countryside, villages with a few lights. No text, no labels, no moon."})
PT="Same painting style, lighting, framing and dark background as the reference portrait, a bust portrait of a different person of ancient China: "
heads = {
 'p-mang-b':"a lean scheming bandit lieutenant with a missing eye under an eyepatch, shaved temples, tattered vest, a short axe.",
 'p-mang-f':"a fierce bandit queen in her thirties, hair tied up with a red cloth, leather bracers, a pair of daggers, confident smirk.",
 'p-zheng-a':"a calm upright swordsman of an orthodox sect in his thirties, hair in a topknot, plain blue-grey robe, a sword on his back.",
 'p-zheng-b':"a stern grey-bearded elder of an orthodox martial sect, dignified, dark robe, hands folded over a staff.",
 'p-zheng-f':"a composed swordswoman of an orthodox sect, hair half up with a jade pin, light grey robe, holding a sheathed sword.",
 'p-xie-a':"a sinister cold-eyed man of a dark sect, pale face, black robe with dark green trim, long nails, faint cruel smile.",
 'p-xie-b':"a hulking brutal enforcer of an evil sect, shaved head with tattoos, bare scarred arms, iron claws on one hand.",
 'p-xie-f':"a beautiful but dangerous woman of a poison sect, heavy dark makeup, black and purple robe, a small venomous snake coiled on her wrist.",
 'p-fo-b':"a young solemn Buddhist warrior monk, shaved head, ochre robe, prayer beads, in a fighting stance with bare hands.",
 'p-ni-a':"a serene middle-aged Buddhist nun, shaved head under a grey hood, plain grey robe, prayer beads, gentle but firm gaze.",
 'p-dao-a':"a Taoist priest with a long black beard, hair in a topknot with a wooden hairpin, dark Taoist robe with a trigram pattern, holding a horsetail whisk.",
 'p-clan-a':"an elegant aristocratic clan elder, refined scholar's robe of dark silk, neat grey beard, a folding fan, haughty composure.",
 'p-clan-b':"a young aristocratic clan heir, fine embroidered robe, jade belt, a sword at his side, proud cold eyes.",
 'p-jun-a':"a hardened imperial frontier officer in lamellar armor with a red-plumed helmet, weathered face, a spear.",
 'p-nv-a':"an alluring woman of a seductive sect, elaborate hairdo with flower ornaments, red and pink silk robes, a fan hiding flying needles, sly smile.",
 'p-nv-b':"a cold beautiful woman of a hidden bamboo-forest sect, hair loose, dark green robes, a bamboo flute, icy gaze.",
 'p-yelan-a':"an assassin from a secret killer organization, face half hidden by a black mask and hood, rain-soaked dark clothes, a thin blade.",
}
for k,v in heads.items(): jobs.append({'key':k,'ref':'pt','ar':'1:1','size':'1K','prompt':PT+v+" No text, no moon."})
IK="Same ink-wash brush style, composition and dark background as the reference: the figure on the right half lit by a pale grey ink halo, the left half almost black. A different figure: "
inks = {
 'ink-mang-a':"a burly bandit chief with a broad saber on his shoulder, fur coat, wild beard.",
 'ink-zheng-a':"an upright swordsman in a plain robe, sword held low, calm stance.",
 'ink-xie-a':"a sinister man of a dark sect in a black robe, iron claws, cold smile.",
 'ink-ni-a':"a serene Buddhist nun with a grey hood holding prayer beads.",
 'ink-dao-a':"a Taoist priest with a long beard and a horsetail whisk, robe fluttering.",
 'ink-clan-a':"an aristocratic clan elder in a silk robe holding a folding fan.",
 'ink-jun-a':"an imperial frontier officer in lamellar armor with a plumed helmet and a spear.",
 'ink-nv-a':"an alluring woman with flower ornaments in her hair, silk sleeves, a fan.",
 'ink-yelan-a':"a masked assassin in a hood, a thin blade held behind his back, rain.",
}
for k,v in inks.items(): jobs.append({'key':k,'ref':'ink','ar':'4:3','size':'1K','prompt':IK+v+" No text, no moon."})
json.dump(jobs,open(f'{D}/jobs-full.json','w'),ensure_ascii=False,indent=1)
print(len(jobs))
