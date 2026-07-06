/**
 * 观察员面板（非玩家界面）—— 埋点规格 §1.1 会话事件 + §3 导出。
 * 开启方式：URL hash `observer=1` 或 Ctrl+Shift+O；测试者不应看到本面板。
 */
import { useState } from 'react';
import { BUILD, TABLES_VERSION, TELEMETRY_SPEC } from '../meta';
import { loadGame } from '../save/storage';
import { exportTelemetryJSON } from '../telemetry/telemetry';
import { useGameStore } from '../store/gameStore';

const TESTER_KEY = 'jianghu-idle:tester';

function download(filename: string, content: string) {
  const url = URL.createObjectURL(new Blob([content], { type: 'application/json' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

const ymd = () => {
  const d = new Date();
  return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
};

type Reason = 'completed' | 'external_dropout' | 'design_dropout';

export function ObserverPanel({ onClose }: { onClose: () => void }) {
  const s = useGameStore();
  const [testerId, setTesterId] = useState(() => localStorage.getItem(TESTER_KEY) ?? '');
  const [sessionOn, setSessionOn] = useState(false);
  const [reason, setReason] = useState<Reason>('completed');

  const start = () => {
    const id = testerId.trim();
    if (!id) return;
    localStorage.setItem(TESTER_KEY, id);
    s.startSession(id);
    setSessionOn(true);
  };

  const end = () => {
    s.endSession(reason);
    setSessionOn(false);
  };

  const exportTelemetry = () => {
    const id = testerId.trim() || 'T00';
    download(`mvp0_${id}_${ymd()}.json`, exportTelemetryJSON({
      tester_id: id, build: BUILD, tables_version: TABLES_VERSION, telemetry_spec: TELEMETRY_SPEC,
    }));
  };

  const exportSave = () => {
    const id = testerId.trim() || 'T00';
    download(`mvp0_save_${id}_${ymd()}.json`, JSON.stringify(loadGame() ?? {}, null, 2));
  };

  return (
    <div className="observer-panel">
      <div className="op-head">
        观察员面板 <span className="op-meta">{BUILD} · 埋点 v{TELEMETRY_SPEC}</span>
        <button className="toast-close" onClick={onClose} aria-label="关闭">×</button>
      </div>

      <div className="op-row">
        <span className="op-label">状态</span>
        <span className="op-val">
          第 {s.run} 轮 · 境界 {s.realm} · 活跃 {Math.floor(s.runPlaySec / 60)} 分
          {s.paused && <b className="op-paused"> · 已暂停</b>}
        </span>
      </div>

      <div className="op-row">
        <span className="op-label">编号</span>
        <input
          className="op-input"
          value={testerId}
          placeholder="T03"
          onChange={(e) => setTesterId(e.target.value)}
          disabled={sessionOn}
        />
        {!sessionOn ? (
          <button className="op-btn" disabled={!testerId.trim()} onClick={start}>开始会话</button>
        ) : (
          <>
            <select className="op-input" value={reason} onChange={(e) => setReason(e.target.value as Reason)}>
              <option value="completed">completed · 完成预算</option>
              <option value="external_dropout">external_dropout · 外部中断</option>
              <option value="design_dropout">design_dropout · 设计脱落</option>
            </select>
            <button className="op-btn" onClick={end}>结束会话</button>
          </>
        )}
      </div>

      <div className="op-row">
        <span className="op-label">暂停</span>
        {!s.paused ? (
          <button className="op-btn" onClick={s.pauseSession}>暂停（离席/被打断）</button>
        ) : (
          <button className="op-btn warn" onClick={s.resumeSession}>恢复计时</button>
        )}
        <span className="op-note">暂停期间产出/时长/战斗回放全部冻结，净时间自动扣除</span>
      </div>

      <div className="op-row">
        <span className="op-label">导出</span>
        <button className="op-btn" onClick={exportTelemetry}>导出测试数据</button>
        <button className="op-btn" onClick={exportSave}>导出存档</button>
        <button
          className="op-btn danger"
          onClick={() => { if (window.confirm('清空存档与埋点，重开新档？')) s.hardReset(); }}
        >
          重置存档
        </button>
      </div>

      <div className="op-note">数值表 {TABLES_VERSION}；导出文件为纯本地 JSON，tester_id 为匿名编号</div>
    </div>
  );
}
