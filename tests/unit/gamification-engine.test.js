const GamificationEngine = require('../../extension/lib/gamification-engine');

describe('Layer 4: GamificationEngine', () => {
  let game;

  beforeEach(() => {
    game = new GamificationEngine();
  });

  test('initializes at Level 1 Scout with 0 XP', () => {
    const rank = game.getCurrentRank();
    expect(rank.level).toBe(1);
    expect(rank.name).toBe('Bug Scout');
    expect(game.totalXP).toBe(0);
  });

  test('awards XP and levels up across tiers', () => {
    let updatePayload = null;
    game.onUpdate((p) => {
      updatePayload = p;
    });

    const res1 = game.addXP(350);
    expect(res1.leveledUp).toBe(true);
    expect(res1.newRank).toBe('DOM Detective');
    expect(game.getCurrentRank().level).toBe(2);
    expect(updatePayload.totalXP).toBe(350);

    const res2 = game.addXP(450); // Total 800 XP -> Fiber Whisperer
    expect(res2.newRank).toBe('Fiber Whisperer');
    expect(game.getCurrentRank().level).toBe(3);
  });

  test('tracks crashes and unlocks Zero-Blank Screen Guardian badge', () => {
    for (let i = 0; i < 4; i++) {
      game.recordCrashCaught();
      expect(game.hasBadge('blank_screen_guardian')).toBe(false);
    }

    game.recordCrashCaught(); // 5th crash
    expect(game.hasBadge('blank_screen_guardian')).toBe(true);
    expect(game.badges).toContain('blank_screen_guardian');
  });

  test('tracks network tampering and unlocks Postman Slayer badge', () => {
    for (let i = 0; i < 5; i++) {
      game.recordTamperedPayload();
    }
    expect(game.hasBadge('postman_slayer')).toBe(true);
  });

  test('tracks component tree fixes and unlocks Fiber Master badge', () => {
    for (let i = 0; i < 5; i++) {
      game.recordFiberBugResolved();
    }
    expect(game.hasBadge('fiber_master')).toBe(true);
  });

  test('handles streak tracking across days correctly', () => {
    // Current day
    const initialStreak = game.streakDays;
    expect(initialStreak).toBe(1);

    // Simulate same day call
    expect(game.updateStreak()).toBe(1);

    // Simulate yesterday active date
    game.lastActiveDate = new Date(Date.now() - 86400000).toDateString();
    expect(game.updateStreak()).toBe(2);

    // Simulate skipped 3 days
    game.lastActiveDate = new Date(Date.now() - (86400000 * 3)).toDateString();
    expect(game.updateStreak()).toBe(1);
  });
});
