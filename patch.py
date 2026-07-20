import re

with open(r"D:\Projects\jianghu-idle\wiki\design\prototype.html", "r", encoding="utf-8") as f:
    content = f.read()

# 1. Update the CSS for the rail modes
css_old_pattern = re.compile(r"/\* ===== 场景 3 Shell壳层比对方案 \(原型专用\) ===== \*/.*?#s3\[data-shell-mode=\"contextual\"\] \.res \{ align-items: flex-start; \}\n  \}", re.DOTALL)

css_new = """/* ===== 场景 3: 岛屿与左侧导航比对 (原型专用) ===== */
  .shell-switcher { display: flex; gap: 8px; overflow-x: auto; scrollbar-width: none; }
  .shell-switcher::-webkit-scrollbar { display: none; }
  .shell-switcher button {
    flex: 1; min-width: 140px; text-align: left;
    background: var(--surface); border: 1px solid var(--line); border-radius: 6px;
    padding: 8px 12px; color: var(--muted); font-family: inherit; cursor: pointer;
    transition: background-color 0.2s, border-color 0.2s, color 0.2s;
  }
  .shell-switcher button:hover { border-color: var(--line-strong); color: var(--ink); }
  .shell-switcher button.active { background: var(--primary); color: var(--primary-ink); border-color: var(--primary); }
  .shell-switcher button:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
  .shell-switcher button small { display: block; font-size: 11.5px; opacity: 0.8; margin-top: 4px; font-weight: normal; line-height: 1.4; }

  /* 基础内容排版 (恒定为 Mix A+B 混合)：无框内容 + 有框交互 */
  #s3[data-design-mode="mix"] .panel { background: transparent; border: none; box-shadow: none; margin-bottom: 32px; }
  #s3[data-design-mode="mix"] .panel-head { padding: 0 0 12px 4px; border-bottom: none; font-size: 16px; }
  #s3[data-design-mode="mix"] .panel-head::before { content: ""; display: inline-block; width: 6px; height: 6px; background: var(--primary); border-radius: 50%; margin-right: 10px; vertical-align: 2px; }
  #s3[data-design-mode="mix"] .panel-body { padding: 0 4px; }
  #s3[data-design-mode="mix"] .zone-box { background: var(--surface); border: 1px solid var(--line); box-shadow: var(--shadow); }
  #s3[data-design-mode="mix"] .fighter { background: var(--surface); border: 1px solid var(--line); box-shadow: 0 4px 16px oklch(0 0 0 / 0.25); }
  #s3[data-design-mode="mix"] .log { background: oklch(0.15 0.01 262); border: 1px solid var(--line); border-radius: 8px; margin-top: 20px; box-shadow: inset 0 2px 8px oklch(0 0 0 / 0.1); }
  #s3[data-design-mode="mix"] .skill-row { background: var(--surface); border: 1px solid var(--line); margin-bottom: 8px; padding: 12px 16px; border-radius: 8px; box-shadow: var(--shadow); }
  #s3[data-design-mode="mix"] .map-tabs { border-bottom: none; margin-bottom: 16px; gap: 8px; }
  #s3[data-design-mode="mix"] .map-tab { background: var(--surface); border: 1px solid var(--line); border-radius: 6px; border-bottom: 1px solid var(--line) !important; transition: background-color 0.2s, border-color 0.2s, box-shadow 0.2s; }
  #s3[data-design-mode="mix"] .map-tab.active { background: var(--surface-2); border-color: var(--primary) !important; box-shadow: 0 0 0 1px var(--primary); }

  #s3 { background: oklch(0.14 0.01 262); }
  #s3 .topbar { background: transparent; border: none; padding-bottom: 0; }
  #s3 .res-group { background: var(--surface); border: none; border-radius: 20px; padding: 0 12px; box-shadow: var(--shadow); }
  #s3 .res + .res { border-left: none; }
  #s3 .s3-main { background: var(--surface); border-radius: 16px 0 0 0; box-shadow: -4px -4px 16px oklch(0 0 0 / 0.2); }
  #s3 .pulse-bar { background: transparent; border-bottom: none; padding-top: 20px; }
  #s3 .strip-item { background: var(--surface-2); border: none; border-radius: 16px; padding: 4px 14px; box-shadow: 0 2px 4px oklch(0 0 0 / 0.1); }

  /* 隐藏原 topbar 标题，只留资源（各 mode 将由 rail-identity 替代） */
  #s3 .topbar .game-title, #s3 .topbar .realm-chip { display: none; }
  #s3 .rail-identity { padding: 0 24px 20px; }
  #s3 .rail-identity .game-title { font-size: 19px; letter-spacing: 0.06em; font-weight: 700; }
  #s3 .rail-identity .realm-chip { margin-top: 4px; }
  #s3 .rail-identity .realm-chip .name { font-size: 15px; }

  /* Default .game-rail restyling */
  #s3 .game-rail { width: 180px; background: transparent; border: none; padding-top: 0; }
  #s3 .game-rail .game-tab { text-align: left; justify-content: flex-start; margin-right: 0; border-right: none; }

  /* I 岛屿基座一体化 */
  #s3[data-rail-mode="base"] .game-rail { background: var(--surface-2); border-radius: 0 16px 0 0; }
  #s3[data-rail-mode="base"] .rail-identity { padding: 20px 24px; border-bottom: 1px solid var(--line); margin-bottom: 12px; }
  #s3[data-rail-mode="base"] .game-rail .game-tab { padding: 10px 24px; color: var(--muted); }
  #s3[data-rail-mode="base"] .game-rail .game-tab.active { background: oklch(0.28 0.018 262); color: var(--ink); font-weight: 600; }
  #s3[data-rail-mode="base"] .game-rail .game-tab.active::before { content: ""; display: inline-block; width: 6px; height: 6px; background: var(--gold); border-radius: 50%; margin-right: 8px; vertical-align: 2px; }

  /* II 题签式导航 */
  #s3[data-rail-mode="tabs"] .game-rail { padding: 20px 16px; width: 160px; }
  #s3[data-rail-mode="tabs"] .rail-identity { padding: 0 8px 32px; }
  #s3[data-rail-mode="tabs"] .game-rail .game-tab { padding: 12px 8px; margin: 4px 0; border-radius: 4px; }
  #s3[data-rail-mode="tabs"] .game-rail .game-tab.active { color: var(--ink); font-weight: 600; }
  #s3[data-rail-mode="tabs"] .game-rail .game-tab.active::after { content: ""; display: inline-block; width: 4px; height: 4px; background: var(--hp); border-radius: 50%; margin-left: 6px; vertical-align: middle; }

  /* III 墨阶导航 */
  #s3[data-rail-mode="ink"] .game-rail { padding: 24px 20px; width: 160px; }
  #s3[data-rail-mode="ink"] .rail-identity { padding: 0 0 40px 0; }
  #s3[data-rail-mode="ink"] .rail-identity .game-title { color: var(--ink); font-weight: 700; }
  #s3[data-rail-mode="ink"] .rail-identity .realm-chip .name { color: var(--muted); }
  #s3[data-rail-mode="ink"] .game-rail .game-tab { color: var(--faint); padding: 14px 0; font-size: 15px; transition: padding 0.2s, color 0.2s; }
  #s3[data-rail-mode="ink"] .game-rail .game-tab:hover { color: var(--muted); }
  #s3[data-rail-mode="ink"] .game-rail .game-tab.active { color: var(--ink); padding-left: 8px; font-weight: 600; }
  #s3[data-rail-mode="ink"] .game-rail .game-tab.active::before { content: ""; display: inline-block; width: 4px; height: 4px; background: var(--gold); border-radius: 50%; margin-right: 8px; vertical-align: middle; }

  /* IV 双岛桥接 */
  #s3[data-rail-mode="dual"] .game-rail { padding: 0 16px; width: 200px; gap: 16px; }
  #s3[data-rail-mode="dual"] .rail-identity { background: var(--surface); border-radius: 16px; padding: 16px; box-shadow: var(--shadow); }
  #s3[data-rail-mode="dual"] .nav-group { background: var(--surface); border-radius: 16px; padding: 8px; box-shadow: var(--shadow); display: flex; flex-direction: column; gap: 4px; }
  #s3[data-rail-mode="dual"] .game-rail .game-tab { padding: 10px 12px; border-radius: 8px; }
  #s3[data-rail-mode="dual"] .game-rail .game-tab.active { background: var(--surface-2); color: var(--ink); font-weight: 600; }

  /* V 门派身份栏 */
  #s3[data-rail-mode="identity"] .game-rail { padding: 20px; width: 180px; }
  #s3[data-rail-mode="identity"] .rail-identity { padding: 0 0 24px; border-bottom: 1px solid var(--line); margin-bottom: 12px; }
  #s3[data-rail-mode="identity"] .rail-identity .name { font-size: 17px; color: var(--primary); }
  #s3[data-rail-mode="identity"] .game-rail .game-tab { padding: 12px 0; color: var(--muted); }
  #s3[data-rail-mode="identity"] .game-rail .game-tab.active { color: var(--ink); font-weight: 600; }
  #s3[data-rail-mode="identity"] .game-rail .game-tab.active::before { content: ""; display: inline-block; width: 3px; height: 14px; background: var(--primary); margin-right: 8px; vertical-align: -2px; }

  /* I+V 混合 (Hybrid) */
  #s3[data-rail-mode="hybrid"] .game-rail { width: 190px; background: var(--surface); border-radius: 16px 0 0 0; padding: 0; overflow: hidden; box-shadow: -4px -4px 16px oklch(0 0 0 / 0.2); z-index: 1; }
  #s3[data-rail-mode="hybrid"] .s3-main { border-radius: 0; box-shadow: none; border-left: 1px solid var(--line); }
  #s3[data-rail-mode="hybrid"] .rail-identity { padding: 24px 20px; background: oklch(0.18 0.015 262); border-bottom: 1px solid var(--line); }
  #s3[data-rail-mode="hybrid"] .rail-identity .name { font-size: 16px; color: var(--primary); }
  #s3[data-rail-mode="hybrid"] .nav-group { padding: 12px 8px; display: flex; flex-direction: column; gap: 4px; }
  #s3[data-rail-mode="hybrid"] .game-rail .game-tab { padding: 10px 16px; border-radius: 8px; color: var(--muted); transition: all 0.2s; }
  #s3[data-rail-mode="hybrid"] .game-rail .game-tab.active { background: var(--surface-2); color: var(--ink); font-weight: 600; }
  #s3[data-rail-mode="hybrid"] .game-rail .game-tab.active::before { content: ""; display: inline-block; width: 6px; height: 6px; background: var(--gold); border-radius: 50%; margin-right: 8px; vertical-align: 2px; }

  @media (max-width: 900px) {
    #s3 .topbar { flex-wrap: wrap; gap: 8px 16px; }
    #s3 .res-group { width: 100%; margin-left: 0; display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); }
    #s3 .res { min-width: 0; padding: 6px 8px; }
    #s3 .res + .res { border-left: none; }
    #s3 .game-rail { width: 100% !important; flex-direction: column; padding: 0 !important; border-radius: 0 !important; background: transparent !important; }
    #s3 .rail-identity { display: flex; align-items: baseline; gap: 12px; padding: 12px 16px !important; border-bottom: 1px solid var(--line) !important; background: transparent !important; margin: 0 !important; border-radius: 0 !important; box-shadow: none !important; }
    #s3 .rail-identity .realm-chip { margin-top: 0; }
    #s3 .nav-group { display: flex; flex-direction: row; overflow-x: auto; padding: 0 16px !important; border-bottom: 1px solid var(--line); gap: 0 !important; border-radius: 0 !important; background: transparent !important; box-shadow: none !important; }
    #s3 .game-rail .game-tab { padding: 12px 16px !important; justify-content: center; }
    #s3 .s3-workspace { flex-direction: column; }
    #s3[data-rail-mode] .game-rail .game-tab.active::before, #s3[data-rail-mode] .game-rail .game-tab.active::after { display: none !important; }
    #s3[data-rail-mode] .game-rail .game-tab.active { border-bottom: 2px solid var(--primary); background: transparent !important; border-radius: 0 !important; }
    #s3[data-rail-mode="hybrid"] .s3-main { border-left: none; }
  }"""

if not css_old_pattern.search(content):
    print("Could not find CSS pattern")

content = css_old_pattern.sub(css_new, content)

# 2. Update Scene 3 markup
html_old_pattern = re.compile(r'<section class="scene" id="s3" data-design-mode="mix" data-shell-mode="float">.*?<nav class="game-rail">.*?<button class="game-tab" data-pane="s3-rep" onclick="switchPane\(this\)">声望阁</button>\n    </nav>', re.DOTALL)

html_new = """<section class="scene" id="s3" data-design-mode="mix" data-rail-mode="hybrid">
  <div class="scene-note" style="flex-direction:column; align-items:stretch; gap:12px; padding-bottom:12px;">
    <div><b>场景 3 / 左侧导航与门派身份比对</b>本场景用于对比 6 种左侧导航（Rail）版式方案。探索减轻系统线框与视觉疲劳。内容区恒定使用 Mix 方案（无框内容+有框交互）。</div>
    <div class="shell-switcher">
      <button type="button" aria-pressed="false" onclick="setRailMode('base', this)">I 岛屿基座一体化<br><small>同色基座，低对比选中</small></button>
      <button type="button" aria-pressed="false" onclick="setRailMode('tabs', this)">II 题签式导航<br><small>无框文本，印泥角标</small></button>
      <button type="button" aria-pressed="false" onclick="setRailMode('ink', this)">III 墨阶导航<br><small>层级字重，大行距缩进</small></button>
      <button type="button" aria-pressed="false" onclick="setRailMode('dual', this)">IV 双岛桥接<br><small>独立身份岛，分离导航</small></button>
      <button type="button" aria-pressed="false" onclick="setRailMode('identity', this)">V 门派身份栏<br><small>剥离顶栏，独立身份区</small></button>
      <button type="button" class="active" aria-pressed="true" onclick="setRailMode('hybrid', this)">I+V 混合（推荐）<br><small>一体基座，独立身份头</small></button>
    </div>
  </div>
  <header class="topbar">
    <div class="game-title serif">江湖无尽录<span class="round">第 2 轮</span></div>
    <div class="realm-chip"><span class="name serif">小有所成</span><span class="lv">境界 3 / 5</span></div>
    <div class="res-group">
      <div class="res"><div class="label">内力</div><div class="value">6,900</div><div class="rate">+16.9 / 秒</div></div>
      <div class="res"><div class="label">银两</div><div class="value">530</div></div>
      <div class="res"><div class="label">阅历</div><div class="value">189</div></div>
      <div class="res rep"><div class="label">声望</div><div class="value">40</div><div class="rate" style="color:var(--faint)">累计 130</div></div>
    </div>
  </header>
  <div class="s3-workspace">
    <nav class="game-rail">
      <div class="rail-identity">
        <div class="game-title serif">江湖无尽录<span class="round">第 2 轮</span></div>
        <div class="realm-chip"><span class="name serif">小有所成</span><span class="lv">境界 3 / 5</span></div>
      </div>
      <div class="nav-group">
        <button class="game-tab" data-pane="s3-cultivate" onclick="switchPane(this)">修炼</button>
        <button class="game-tab active" data-pane="s3-battle" onclick="switchPane(this)">战斗</button>
        <button class="game-tab" data-pane="s3-skill" onclick="switchPane(this)">武学<span class="tab-dot" title="可升级"></span></button>
        <button class="game-tab" data-pane="s3-rep" onclick="switchPane(this)">声望阁</button>
      </div>
    </nav>"""

if not html_old_pattern.search(content):
    print("Could not find HTML pattern")

content = html_old_pattern.sub(html_new, content)

# 3. Update the script
script_old_pattern = re.compile(r"/\* ===== 壳层模式切换 \(场景 3\) ===== \*/.*?function setShellMode.*?\}", re.DOTALL)
script_new = """/* ===== 导航壳层模式切换 (场景 3) ===== */
  function setRailMode(mode, btn) {
    document.getElementById('s3').dataset.railMode = mode;
    document.querySelectorAll('#s3 .shell-switcher button').forEach(b => {
      b.classList.remove('active');
      b.setAttribute('aria-pressed', 'false');
    });
    btn.classList.add('active');
    btn.setAttribute('aria-pressed', 'true');
  }"""

if not script_old_pattern.search(content):
    print("Could not find JS pattern")

content = script_old_pattern.sub(script_new, content)

with open(r"D:\Projects\jianghu-idle\wiki\design\prototype.html", "w", encoding="utf-8") as f:
    f.write(content)

print("Patch applied successfully")
