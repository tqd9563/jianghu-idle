/**
 * 暗门演出 —— 定稿原型 docs/design/battle-loot-prototype.html `#d-black`（DESIGN.md「整屏演出 · 暗门」）。
 * 市集累计消费满额的那一笔买下时出现（battle-loot/design.md 裁决 32）；看完之后市集摊位条末尾多出「黑市」。
 */
import { createPortal } from 'react-dom';

export function BlackIntro({ onDone }: { onDone: () => void }) {
  return createPortal(
    <div className="jh-ceremony cold black-in" role="dialog" aria-label="暗门">
      <div>
        <div className="kick">暗 门</div>
        <h2 className="mid">黑市</h2>
        <div className="story">
          摊后那人也不答话，只掀起一角灰帘。帘后是条窄巷，巷底一盏灯，灯下三张蒙着黑布的桌子。
          <br /><br /><em>「货在布下，银子放桌上。买定离手，概不退换。」</em>
        </div>
        <div className="acts">
          <button type="button" className="jh-btn" onClick={onDone}>掀帘而入</button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
