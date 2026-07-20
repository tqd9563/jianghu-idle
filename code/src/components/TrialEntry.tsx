import { useGameStore } from '../store/gameStore';
import type { TrialDef } from '../engine/fragments';

export function TrialEntry({ trial }: { trial: TrialDef }) {
  const s = useGameStore();

  const trialWins = s.trialWinsThisRun?.[trial.trial_id] ?? 0;
  const isCompleted = trialWins > 0;
  const bossLocked = !s.clearedStages.includes('m2s10');
  const routeLocked = s.route !== trial.route;
  const realmLocked = s.realm < 5;
  const disabled = isCompleted || realmLocked || routeLocked || bossLocked;
  const disabledReason = bossLocked
    ? '需击败 Boss 2 后开放'
    : routeLocked
      ? '需对应门径'
      : realmLocked
        ? '需达到境界 5'
        : null;
  
  const handleChallenge = () => {
    s.challengeTrial(trial.trial_id);
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
        <div style={{ textAlign: 'right' }}>
          <button
            className="btn"
            style={{ width: 'auto', marginTop: 0, padding: '7px 16px' }}
            disabled={disabled}
            onClick={handleChallenge}
          >
            {isCompleted ? '已击败' : '挑战隐士'}
          </button>
          {!isCompleted && disabledReason && (
            <div className="cap-note" style={{ marginTop: '5px' }}>{disabledReason}</div>
          )}
        </div>
      </div>
    </>
  );
}
