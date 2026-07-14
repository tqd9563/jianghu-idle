import { describe, expect, it } from 'vitest';
import { fight, makeBuild } from './combat';
import {
  MVP2_BOSS_REWARDS,
  MVP2_BOSS_VALUES,
  MVP2_ELITE_CHALLENGE_REWARDS,
  MVP2_MAP_REWARD_PLANS,
  MVP2_REALM_VALUES,
  MVP2_STAGE_ENEMIES,
  MVP2_TRIAL_ENEMIES,
  buildMvp2StageEnemies,
  calculatePreBossTotal,
} from './mvp2Content';

describe('MVP-2 finalized non-playable constants', () => {
  it('matches Realm 6/7 values and keeps names unresolved', () => {
    expect(MVP2_REALM_VALUES).toEqual([
      { realm: 6, name: '[待命名]', hp: 1680, atk: 168, def: 88, accuracy: 160, evasion: 25, breakthroughCost: 48000, skillCap: 10 },
      { realm: 7, name: '[待命名]', hp: 3360, atk: 336, def: 176, accuracy: 172, evasion: 28, breakthroughCost: 108000, skillCap: 10 },
    ]);
  });

  it('matches Boss 4/5 combat values and existing Chinese tags', () => {
    expect(MVP2_BOSS_VALUES).toEqual([
      { boss: 4, name: '[待命名]', hp: 3024, atk: 470, def: 422, hit: 160, dodge: 25, tags: ['高防', '高攻'] },
      { boss: 5, name: '[待命名]', hp: 5376, atk: 504, def: 722, hit: 172, dodge: 28, tags: ['高攻', '净化', '高防'] },
    ]);
  });

  it('matches trial values and preserves both insight and grind solutions', () => {
    expect(MVP2_TRIAL_ENEMIES).toEqual([
      { id: 'trial_jinglei', name: '惊雷试炼', route: 'huashan', hp: 2352, atk: 4, def: 211, hit: 148, dodge: 50, tags: ['高闪', '反伤'], recommendedRealm: 5 },
      { id: 'trial_zhenyue', name: '镇岳试炼', route: 'shaolin', hp: 1596, atk: 34, def: 216, hit: 148, dodge: 22, tags: ['毒', '破甲'], recommendedRealm: 5 },
      { id: 'trial_shigu', name: '蚀骨试炼', route: 'tangmen', hp: 840, atk: 101, def: 167, hit: 148, dodge: 22, tags: ['净化', '高攻'], recommendedRealm: 5 },
    ]);

    for (const trial of MVP2_TRIAL_ENEMIES) {
      const enemy = {
        map: 3 as const,
        stage: 1,
        name: trial.name,
        hp: trial.hp,
        atk: trial.atk,
        def: trial.def,
        hit: trial.hit,
        dodge: trial.dodge,
        tags: [...trial.tags],
        kind: 'elite' as const,
        recommendedRealm: trial.recommendedRealm,
        reward: { neili: 0, silver: 0, xp: 0 },
      };
      expect(fight(makeBuild(trial.route, 5, 7, 0), enemy, { mode: 'ev' }).win).toBe(false);
      expect(fight(makeBuild(trial.route, 5, 7, 3), enemy, { mode: 'ev' }).win).toBe(true);
      expect(fight(makeBuild(trial.route, 5, 8, 0), enemy, { mode: 'ev' }).win).toBe(true);
    }
  });

  it('matches map layouts, exact reward plans, ratios, and calculated totals', () => {
    expect(MVP2_MAP_REWARD_PLANS).toEqual([
      {
        map: 4, name: '[待命名]', stageCount: 10, bossStage: 10, eliteStages: [3, 6, 8],
        normal: { neili: 594, silver: 17, xp: 3 }, elite: { neili: 1190, silver: 33, xp: 8 },
        preBossTotal: { neili: 7134, silver: 201, xp: 42 }, preparationRatio: 0.14,
      },
      {
        map: 5, name: '[待命名]', stageCount: 10, bossStage: 10, eliteStages: [2, 5, 7, 9],
        normal: { neili: 1206, silver: 16, xp: 4 }, elite: { neili: 2417, silver: 30, xp: 5 },
        preBossTotal: { neili: 15698, silver: 200, xp: 40 }, preparationRatio: 0.14,
      },
    ]);
    for (const plan of MVP2_MAP_REWARD_PLANS) expect(calculatePreBossTotal(plan)).toEqual(plan.preBossTotal);
  });

  it('matches elite challenge 4/5 rewards via 30% derivation from pre-challenge totals', () => {
    expect(MVP2_ELITE_CHALLENGE_REWARDS).toEqual([
      { challenge: 4, neili: 1529, silver: 150, xp: 60 },
      { challenge: 5, neili: 4139, silver: 200, xp: 84 },
    ]);
  });

  describe('MVP2_BOSS_REWARDS (§9.3)', () => {
    it('boss 4 and 5 kill rewards match 30% derivation formula', () => {
      expect(MVP2_BOSS_REWARDS).toEqual([
        { boss: 4, neili: 3057, silver: 300, xp: 120 },
        { boss: 5, neili: 6728, silver: 400, xp: 168 },
      ]);
    });
  });

  describe('MVP2_STAGE_ENEMIES (§9.2)', () => {
    it('has 18 enemies (9 per map)', () => {
      expect(MVP2_STAGE_ENEMIES).toHaveLength(18);
      const map4 = MVP2_STAGE_ENEMIES.filter(e => e.map === 4);
      const map5 = MVP2_STAGE_ENEMIES.filter(e => e.map === 5);
      expect(map4).toHaveLength(9);
      expect(map5).toHaveLength(9);
    });

    it('all enemies have recommendedRealm 5 for map 4 and 6 for map 5', () => {
      for (const e of MVP2_STAGE_ENEMIES) {
        if (e.map === 4) expect(e.recommendedRealm).toBe(5);
        if (e.map === 5) expect(e.recommendedRealm).toBe(6);
      }
    });

    it('elite stages match layout: map 4 = [3,6,8], map 5 = [2,5,7,9]', () => {
      const elite4 = MVP2_STAGE_ENEMIES.filter(e => e.map === 4 && e.kind === 'elite').map(e => e.stage);
      const elite5 = MVP2_STAGE_ENEMIES.filter(e => e.map === 5 && e.kind === 'elite').map(e => e.stage);
      expect(elite4).toEqual([3, 6, 8]);
      expect(elite5).toEqual([2, 5, 7, 9]);
    });

    it('map 4 stage enemies match exponential curve with pyRound', () => {
      const map4Enemies = MVP2_STAGE_ENEMIES.filter(e => e.map === 4);
      expect(map4Enemies).toEqual([
        { map: 4, stage: 1, name: '[待命名]', hp: 300, atk: 50.0, def: 40.0, hit: 152, dodge: 20, tags: [], kind: 'normal', recommendedRealm: 5 },
        { map: 4, stage: 2, name: '[待命名]', hp: 348, atk: 52.5, def: 43.2, hit: 154, dodge: 50, tags: ['高闪'], kind: 'normal', recommendedRealm: 5 },
        { map: 4, stage: 3, name: '[待命名]', hp: 525, atk: 55.1, def: 46.7, hit: 156, dodge: 20, tags: ['毒'], kind: 'elite', recommendedRealm: 5 },
        { map: 4, stage: 4, name: '[待命名]', hp: 468, atk: 57.9, def: 50.4, hit: 158, dodge: 20, tags: [], kind: 'normal', recommendedRealm: 5 },
        { map: 4, stage: 5, name: '[待命名]', hp: 543, atk: 60.8, def: 82, hit: 160, dodge: 20, tags: ['高防'], kind: 'normal', recommendedRealm: 5 },
        { map: 4, stage: 6, name: '[待命名]', hp: 819, atk: 63.8, def: 58.8, hit: 162, dodge: 20, tags: ['毒'], kind: 'elite', recommendedRealm: 5 },
        { map: 4, stage: 7, name: '[待命名]', hp: 731, atk: 67.0, def: 63.5, hit: 164, dodge: 20, tags: [], kind: 'normal', recommendedRealm: 5 },
        { map: 4, stage: 8, name: '[待命名]', hp: 1102, atk: 70.4, def: 68.6, hit: 166, dodge: 20, tags: ['毒'], kind: 'elite', recommendedRealm: 5 },
        { map: 4, stage: 9, name: '[待命名]', hp: 984, atk: 73.9, def: 111, hit: 168, dodge: 20, tags: ['高防'], kind: 'normal', recommendedRealm: 5 },
      ]);
    });

    it('map 5 stage enemies match exponential curve with pyRound', () => {
      const map5Enemies = MVP2_STAGE_ENEMIES.filter(e => e.map === 5);
      expect(map5Enemies).toEqual([
        { map: 5, stage: 1, name: '[待命名]', hp: 800, atk: 100.0, def: 80.0, hit: 167, dodge: 25, tags: [], kind: 'normal', recommendedRealm: 6 },
        { map: 5, stage: 2, name: '[待命名]', hp: 1277, atk: 104.0, def: 84.8, hit: 169, dodge: 25, tags: ['反伤'], kind: 'elite', recommendedRealm: 6 },
        { map: 5, stage: 3, name: '[待命名]', hp: 1040, atk: 108.2, def: 89.9, hit: 171, dodge: 25, tags: ['净化'], kind: 'normal', recommendedRealm: 6 },
        { map: 5, stage: 4, name: '[待命名]', hp: 1185, atk: 146.2, def: 95.3, hit: 173, dodge: 25, tags: ['高攻'], kind: 'normal', recommendedRealm: 6 },
        { map: 5, stage: 5, name: '[待命名]', hp: 1891, atk: 117.0, def: 101.0, hit: 175, dodge: 25, tags: ['反伤'], kind: 'elite', recommendedRealm: 6 },
        { map: 5, stage: 6, name: '[待命名]', hp: 1540, atk: 121.7, def: 107.1, hit: 177, dodge: 25, tags: [], kind: 'normal', recommendedRealm: 6 },
        { map: 5, stage: 7, name: '[待命名]', hp: 2458, atk: 126.5, def: 113.5, hit: 179, dodge: 25, tags: ['反伤'], kind: 'elite', recommendedRealm: 6 },
        { map: 5, stage: 8, name: '[待命名]', hp: 2002, atk: 171.1, def: 120.3, hit: 181, dodge: 25, tags: ['高攻'], kind: 'normal', recommendedRealm: 6 },
        { map: 5, stage: 9, name: '[待命名]', hp: 3195, atk: 136.9, def: 127.5, hit: 183, dodge: 25, tags: ['反伤'], kind: 'elite', recommendedRealm: 6 },
      ]);
    });
  });

  describe('buildMvp2StageEnemies()', () => {
    it('returns same array as MVP2_STAGE_ENEMIES', () => {
      expect(buildMvp2StageEnemies()).toEqual(MVP2_STAGE_ENEMIES);
    });
  });
});
