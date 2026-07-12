const fs = require('fs');
let html = fs.readFileSync('wiki/design/prototype.html', 'utf8');

// 1. CSS
const cssStart = html.indexOf('  /* ===== 场景 3: 岛屿与左侧导航比对 (原型专用) ===== */');
const cssEndPattern = '    #s3[data-rail-mode="hybrid"] .s3-main { border-left: none; }\r\n  }';
let cssEnd = html.indexOf(cssEndPattern);
if (cssEnd === -1) {
  cssEnd = html.indexOf('    #s3[data-rail-mode="hybrid"] .s3-main { border-left: none; }\n  }');
}

const newCss = `  /* ===== 场景 3: 主界面 (Island + I+V Hybrid 最终版) ===== */
  /* 基础内容排版 (恒定为 Mix A+B 混合)：无框内容 + 有框交互 */
  #s3 .panel { background: transparent; border: none; box-shadow: none; margin-bottom: 32px; }
  #s3 .panel-head { padding: 0 0 12px 4px; border-bottom: none; font-size: 16px; }
  #s3 .panel-head::before { content: ""; display: inline-block; width: 6px; height: 6px; background: var(--primary); border-radius: 50%; margin-right: 10px; vertical-align: 2px; }
  #s3 .panel-body { padding: 0 4px; }
  #s3 .zone-box { background: var(--surface); border: 1px solid var(--line); box-shadow: var(--shadow); }
  #s3 .fighter { background: var(--surface); border: 1px solid var(--line); box-shadow: 0 4px 16px oklch(0 0 0 / 0.25); }
  #s3 .log { background: oklch(0.15 0.01 262); border: 1px solid var(--line); border-radius: 8px; margin-top: 20px; box-shadow: inset 0 2px 8px oklch(0 0 0 / 0.1); }
  #s3 .skill-row { background: var(--surface); border: 1px solid var(--line); margin-bottom: 8px; padding: 12px 16px; border-radius: 8px; box-shadow: var(--shadow); }
  #s3 .map-tabs { border-bottom: none; margin-bottom: 16px; gap: 8px; }
  #s3 .map-tab { background: var(--surface); border: 1px solid var(--line); border-radius: 6px; border-bottom: 1px solid var(--line) !important; transition: background-color 0.2s, border-color 0.2s, box-shadow 0.2s; }
  #s3 .map-tab.active { background: var(--surface-2); border-color: var(--primary) !important; box-shadow: 0 0 0 1px var(--primary); }

  /* 统一外壳：Grid 布局，深色 Gutter 区隔 */
  #s3 { 
    display: grid; 
    grid-template-columns: 216px 1fr; 
    grid-template-rows: auto auto 1fr; 
    gap: 8px; 
    background: oklch(0.13 0.012 262); 
    min-height: 100vh;
  }
  #s3 .scene-note { grid-column: 1 / -1; grid-row: 1; margin-bottom: 0; }
  #s3 .s3-workspace { display: contents; }

  /* 顶栏：位于右侧顶端 */
  #s3 .topbar { 
    grid-column: 2; grid-row: 2; 
    background: var(--surface); 
    border: none; 
    padding: 12px 24px; 
    margin: 0;
    justify-content: flex-end; 
  }
  #s3 .topbar .game-title, #s3 .topbar .realm-chip { display: none; }

  /* 资源区融入背景，无胶囊感 */
  #s3 .res-group { 
    background: transparent; 
    border: none; 
    border-radius: 0; 
    padding: 0; 
    box-shadow: none; 
  }
  #s3 .res { padding: 0 16px; }
  #s3 .res + .res { border-left: none; }

  /* 左侧导航栏：全高贯通 */
  #s3 .game-rail { 
    grid-column: 1; grid-row: 2 / 4; 
    background: var(--surface); 
    border: none; 
    padding: 0; 
    width: 100%; 
    display: flex; 
    flex-direction: column; 
  }

  #s3 .rail-identity { 
    padding: 20px 20px 16px; 
    white-space: nowrap; 
  }
  #s3 .rail-identity .game-title { 
    font-size: 19px; 
    letter-spacing: 0.04em; 
    font-weight: 700; 
  }
  #s3 .rail-identity .realm-chip { margin-top: 6px; }
  #s3 .rail-identity .realm-chip .name { font-size: 15px; color: var(--primary); }

  #s3 .nav-group { 
    padding: 12px 10px; 
    display: flex; 
    flex-direction: column; 
    gap: 4px; 
  }
  #s3 .game-rail .game-tab { 
    padding: 10px 16px; 
    border-radius: 8px; 
    color: var(--muted); 
    transition: background-color 0.2s, color 0.2s; 
    text-align: left; 
    justify-content: flex-start; 
    border: none; 
    margin: 0; 
  }
  #s3 .game-rail .game-tab.active { 
    background: var(--surface-2); 
    color: var(--ink); 
    font-weight: 600; 
  }
  #s3 .game-rail .game-tab.active::before { 
    content: ""; 
    display: inline-block; 
    width: 6px; height: 6px; 
    background: var(--gold); 
    border-radius: 50%; 
    margin-right: 8px; 
    vertical-align: 2px; 
  }

  /* 主工作区 */
  #s3 .s3-main { 
    grid-column: 2; grid-row: 3; 
    background: var(--surface); 
    display: flex; 
    flex-direction: column; 
    min-width: 0; 
  }

  #s3 .pulse-bar { 
    background: transparent; 
    border-bottom: 1px solid oklch(0.15 0.012 262); 
    padding: 12px 24px; 
  }
  #s3 .strip-item { background: var(--surface-2); border-color: transparent; }

  @media (max-width: 900px) {
    #s3 { 
      display: flex; 
      flex-direction: column; 
      gap: 8px; 
      min-height: auto;
    }
    #s3 .topbar { padding: 12px 16px; justify-content: flex-start; }
    #s3 .res-group { 
      width: 100%; 
      display: grid; 
      grid-template-columns: repeat(2, minmax(0, 1fr)); 
      gap: 6px 0;
    }
    #s3 .res { padding: 6px 8px; }
    #s3 .game-rail { 
      width: 100%; 
      flex-direction: column; 
      gap: 8px; 
      background: transparent;
    }
    #s3 .rail-identity { 
      display: flex; 
      align-items: baseline; 
      gap: 12px; 
      padding: 12px 16px; 
      background: var(--surface); 
      white-space: normal;
    }
    #s3 .rail-identity .realm-chip { margin-top: 0; }
    #s3 .nav-group { 
      flex-direction: row; 
      overflow-x: auto; 
      padding: 8px 16px; 
      gap: 6px; 
      background: var(--surface); 
      scrollbar-width: none;
    }
    #s3 .nav-group::-webkit-scrollbar { display: none; }
    #s3 .game-rail .game-tab { padding: 8px 14px; flex-shrink: 0; text-align: center; justify-content: center; }
  }`;

if (cssStart !== -1 && cssEnd !== -1) {
  html = html.substring(0, cssStart) + newCss + html.substring(cssEnd + cssEndPattern.length);
} else {
  console.log('CSS chunk not found:', cssStart, cssEnd);
}

// 2. HTML
const htmlStart = html.indexOf('<section class="scene" id="s3" data-design-mode="mix" data-rail-mode="hybrid">');
const htmlEndStr = '  </header>';
const htmlEnd = html.indexOf(htmlEndStr, htmlStart);

const newHtml = `<section class="scene" id="s3">
  <div class="scene-note"><b>场景 3 / 主界面</b>统一的背景材质与深色低对比暗缝（gutter）区隔。左侧固定门派身份与导航，全高贯通；右侧为资源顶栏与核心工作区。</div>
  <header class="topbar">
    <div class="game-title serif">江湖无尽录<span class="round">第 2 轮</span></div>
    <div class="realm-chip"><span class="name serif">小有所成</span><span class="lv">境界 3 / 5</span></div>
    <div class="res-group">
      <div class="res"><div class="label">内力</div><div class="value">6,900</div><div class="rate">+16.9 / 秒</div></div>
      <div class="res"><div class="label">银两</div><div class="value">530</div></div>
      <div class="res"><div class="label">阅历</div><div class="value">189</div></div>
      <div class="res rep"><div class="label">声望</div><div class="value">40</div><div class="rate" style="color:var(--faint)">累计 130</div></div>
    </div>
  </header>`;

if (htmlStart !== -1 && htmlEnd !== -1) {
  html = html.substring(0, htmlStart) + newHtml + html.substring(htmlEnd + htmlEndStr.length);
} else {
  console.log('HTML chunk not found:', htmlStart, htmlEnd);
}

// 3. Remove setRailMode JS
const jsStartStr = '  /* ===== 导航壳层模式切换 (场景 3) ===== */';
const jsEndStr = '  }\n</script>';
const jsStart = html.indexOf(jsStartStr);
let jsEnd = html.indexOf(jsEndStr, jsStart);
if (jsEnd === -1) {
  jsEnd = html.indexOf('  }\r\n</script>', jsStart);
}

if (jsStart !== -1 && jsEnd !== -1) {
  html = html.substring(0, jsStart) + '</script>' + html.substring(jsEnd + jsEndStr.length);
} else {
  console.log('JS block not found:', jsStart, jsEnd);
}

fs.writeFileSync('wiki/design/prototype.html', html);
console.log('Successfully patched prototype.html');
