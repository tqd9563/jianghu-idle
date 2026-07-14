/**
 * 观察员面板（非玩家界面）—— 埋点规格 §1.1 会话事件 + §3 导出。
 * 开启方式：URL hash `observer=1` 或 Ctrl+Shift+O；测试者不应看到本面板。
 */
import { useEffect, useState } from 'react';
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
  const [reason, setReason] = useState<Reason>('completed');
  // 会话开关以 store 持久化状态为准：面板关开/页面刷新不得回到「未开始」假象
  const sessionOn = s.sessionActive;

  const start = () => {
    const id = testerId.trim();
    if (!id) return;
    localStorage.setItem(TESTER_KEY, id);
    s.startSession(id);
  };

  const end = () => s.endSession(reason);

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

  const [naturalOpen, setNaturalOpen] = useState<'yes' | 'no' | ''>('');
  const [openReason, setOpenReason] = useState('');
  const [settlementUnderstood, setSettlementUnderstood] = useState<'yes' | 'no' | 'not observed' | ''>('');
  const [decision, setDecision] = useState('');
  const [nextGoal, setNextGoal] = useState('');
  const [feeling, setFeeling] = useState('');
  const [submitStatus, setSubmitStatus] = useState('');

  useEffect(() => {
    if (!submitStatus) return;
    const timer = window.setTimeout(() => setSubmitStatus(''), 3000);
    return () => window.clearTimeout(timer);
  }, [submitStatus]);

  const submitNote = () => {
    if (naturalOpen === '' || settlementUnderstood === '') return;
    s.recordNaturalWindowNote({
      natural_open: naturalOpen === 'yes',
      open_reason: openReason,
      settlement_understood: settlementUnderstood === 'not observed' ? null : settlementUnderstood === 'yes',
      decision,
      next_goal: nextGoal,
      feeling,
    });
    setNaturalOpen('');
    setOpenReason('');
    setSettlementUnderstood('');
    setDecision('');
    setNextGoal('');
    setFeeling('');
    setSubmitStatus('记录成功');
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

      <div className="op-section-divider">
        <div className="op-row op-row-first">
          <span className="op-label">窗口</span>
          <span className={`op-val ${s.liveTestWindow ? 'op-window-active' : ''}`}>
            {s.liveTestWindow ? '自然窗口进行中' : '未开启'}
          </span>
          {s.liveTestWindow && (
            <span className="op-note op-window-id">
              {new Date(s.liveTestWindow.startedAt).toLocaleTimeString()} ({s.liveTestWindow.windowId.split('-')[2]})
            </span>
          )}
        </div>

        {s.liveTestWindow && s.liveTestWindow.tablesVersionStarted !== TABLES_VERSION && (
          <div className="op-row op-row-tight">
            <span className="op-note op-window-warning">
              警告：数值表发生漂移 ({s.liveTestWindow.tablesVersionStarted} → {TABLES_VERSION})
            </span>
          </div>
        )}

        <div className="op-row">
          {!s.liveTestWindow ? (
            <button className="op-btn" onClick={() => s.startLiveTestWindow()}>开始自然窗口</button>
          ) : (
            <button className="op-btn warn" onClick={() => { if (window.confirm('结束当前自然窗口？此操作不可逆')) s.endLiveTestWindow(); }}>结束自然窗口</button>
          )}
        </div>

        <div className="op-row">
          <label className="op-label" htmlFor="op-nw-open">打开</label>
          <select id="op-nw-open" className="op-input" style={{ width: 60 }} value={naturalOpen} onChange={e => setNaturalOpen(e.target.value as 'yes' | 'no' | '')} disabled={!s.liveTestWindow} aria-label="自然打开">
            <option value="" disabled>-</option>
            <option value="yes">yes</option>
            <option value="no">no</option>
          </select>
          <label className="op-label" htmlFor="op-nw-understood" style={{ marginLeft: 8 }}>理解</label>
          <select id="op-nw-understood" className="op-input" style={{ width: 104 }} value={settlementUnderstood} onChange={e => setSettlementUnderstood(e.target.value as 'yes' | 'no' | 'not observed' | '')} disabled={!s.liveTestWindow} aria-label="结算理解">
            <option value="" disabled>-</option>
            <option value="yes">yes</option>
            <option value="no">no</option>
            <option value="not observed">not observed</option>
          </select>
        </div>
        
        <div className="op-row op-row-top">
          <label className="op-label" htmlFor="op-nw-reason">原因</label>
          <textarea id="op-nw-reason" className="op-input op-textarea" placeholder="open_reason" value={openReason} onChange={e => setOpenReason(e.target.value)} disabled={!s.liveTestWindow} aria-label="打开原因" />
        </div>
        <div className="op-row op-row-top">
          <label className="op-label" htmlFor="op-nw-decision">决策</label>
          <textarea id="op-nw-decision" className="op-input op-textarea" placeholder="decision" value={decision} onChange={e => setDecision(e.target.value)} disabled={!s.liveTestWindow} aria-label="决策" />
        </div>
        <div className="op-row op-row-top">
          <label className="op-label" htmlFor="op-nw-goal">目标</label>
          <textarea id="op-nw-goal" className="op-input op-textarea" placeholder="next_goal" value={nextGoal} onChange={e => setNextGoal(e.target.value)} disabled={!s.liveTestWindow} aria-label="下一步目标" />
        </div>
        <div className="op-row op-row-top">
          <label className="op-label" htmlFor="op-nw-feeling">情感</label>
          <textarea id="op-nw-feeling" className="op-input op-textarea" placeholder="feeling" value={feeling} onChange={e => setFeeling(e.target.value)} disabled={!s.liveTestWindow} aria-label="情感" />
        </div>
        
        <div className="op-row">
          <button className="op-btn" disabled={!s.liveTestWindow || naturalOpen === '' || settlementUnderstood === ''} onClick={submitNote}>提交笔记</button>
          {submitStatus && <span className="op-note op-submit-status" role="status">{submitStatus}</span>}
        </div>
      </div>
    </div>
  );
}
