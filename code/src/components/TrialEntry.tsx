import { useState } from 'react';
import { useGameStore } from '../store/gameStore';
import type { TrialDef } from '../engine/fragments';
import { BattleVictoryRow } from './BattleVictoryRow';

export function TrialEntry({ trial }: { trial: TrialDef }) {
  const s = useGameStore();
  const [winResult, setWinResult] = useState<string | null>(null);

  const trialWins = s.trialWinsThisRun?.[trial.trial_id] ?? 0;
  const isCompleted = trialWins > 0;
  
  const handleChallenge = () => {
    const res = s.challengeTrial(trial.trial_id);
    if (res && res.win) {
      setWinResult(res.grantedPage ?? null);
    } else if (res && !res.win) {
      alert('挑战失败！请提升境界后再来尝试。');
    }
  };

  return (
    <>
      <div style={{
        background: 'var(--night-surface-raised)', padding: '10px 12px', borderRadius: '6px', 
        marginBottom: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center'
      }}>
        <div>
          <div className="serif" style={{ fontSize: '14.5px', fontWeight: 600, color: 'var(--ink-warm)', marginBottom: '2px' }}>
            {trial.enemy_ref.name}试炼
          </div>
          <div style={{ fontSize: '11.5px', color: 'var(--blood-red)', fontWeight: 600 }}>
            推荐境界 {trial.enemy_ref.recommendedRealm}
          </div>
        </div>
        <button 
          className="btn" 
          style={{ width: 'auto', marginTop: 0, padding: '7px 16px' }}
          disabled={isCompleted || s.realm < 5} 
          onClick={handleChallenge}
        >
          {isCompleted ? '已击败' : '挑战隐士'}
        </button>
      </div>

      {winResult !== null && (
        <div className="modal-backdrop open">
          <div className="modal" style={{ maxWidth: '480px' }} role="dialog">
            <div className="modal-head"><span className="serif" style={{ color: 'var(--candle-gold)' }}>试炼通过 · {trial.enemy_ref.name}</span></div>
            <div className="modal-body">
              <BattleVictoryRow pageId={winResult} />
              <div className="cap-note" style={{ marginTop: '12px' }}>隐士已离去，未留下任何金银财身。</div>
              <div className="modal-actions">
                <button className="btn" onClick={() => setWinResult(null)}>离开</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
