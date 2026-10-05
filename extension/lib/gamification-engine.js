/**
 * GoA_Rover - Layer 4: Gamification Engine (Rover RPG)
 * Manages XP awards, Hunter Levels, Streak tracking, and Achievement Badges.
 */

(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.GamificationEngine = factory();
    if (typeof window !== 'undefined' && !window.__GOA_ROVER_GAMIFICATION__) {
      window.__GOA_ROVER_GAMIFICATION__ = new root.GamificationEngine();
    }
  }
})(typeof self !== 'undefined' ? self : this, function () {

  const RANKS = [
    { level: 1, name: 'Bug Scout', minXP: 0 },
    { level: 2, name: 'DOM Detective', minXP: 300 },
    { level: 3, name: 'Fiber Whisperer', minXP: 750 },
    { level: 4, name: 'Bug Slayer', minXP: 1500 },
    { level: 5, name: 'Guardian of Apps', minXP: 3000 }
  ];

  const BADGE_DEFINITIONS = {
    BLANK_SCREEN_GUARDIAN: {
      id: 'blank_screen_guardian',
      title: 'Zero-Blank Screen Guardian',
      icon: '🛡️',
      description: 'Caught 5 silent render crashes / white screens'
    },
    SPEED_DEMON: {
      id: 'speed_demon',
      title: 'Speed Demon',
      icon: '⚡',
      description: 'Diagnosed and fixed an issue in under 60 seconds'
    },
    POSTMAN_SLAYER: {
      id: 'postman_slayer',
      title: 'Postman Slayer',
      icon: '🕵️',
      description: 'Tampered & replayed 5 network payloads in-situ'
    },
    FIBER_MASTER: {
      id: 'fiber_master',
      title: 'Fiber Master',
      icon: '🌲',
      description: 'Resolved 5 component tree state anomalies'
    }
  };

  class GamificationEngine {
    constructor(state = {}) {
      this.totalXP = typeof state.totalXP === 'number' ? state.totalXP : 0;
      this.streakDays = typeof state.streakDays === 'number' ? state.streakDays : 1;
      this.lastActiveDate = state.lastActiveDate || new Date().toDateString();
      this.badges = Array.isArray(state.badges) ? [...state.badges] : [];
      this.counters = Object.assign({
        crashesCaught: 0,
        tamperedPayloads: 0,
        fiberBugsResolved: 0
      }, state.counters);
      this.listeners = [];
    }

    onUpdate(cb) {
      if (typeof cb === 'function') this.listeners.push(cb);
    }

    notify() {
      const currentRank = this.getCurrentRank();
      const payload = {
        totalXP: this.totalXP,
        level: currentRank.level,
        rankName: currentRank.name,
        streakDays: this.streakDays,
        badges: this.badges,
        counters: this.counters
      };
      this.listeners.forEach((cb) => {
        try { cb(payload); } catch (e) {}
      });
      return payload;
    }

    addXP(amount, reason = '') {
      const prevRank = this.getCurrentRank();
      this.totalXP += Math.max(0, amount);
      const nextRank = this.getCurrentRank();

      const leveledUp = nextRank.level > prevRank.level;
      this.notify();

      return {
        amount,
        totalXP: this.totalXP,
        leveledUp,
        newRank: nextRank.name
      };
    }

    awardBadge(badgeId) {
      const badge = BADGE_DEFINITIONS[badgeId] || Object.values(BADGE_DEFINITIONS).find(b => b.id === badgeId);
      if (!badge) return null;

      if (!this.badges.includes(badge.id)) {
        this.badges.push(badge.id);
        this.addXP(100, `Badge unlocked: ${badge.title}`);
        this.notify();
        return badge;
      }
      return null;
    }

    hasBadge(badgeId) {
      return this.badges.includes(badgeId);
    }

    getCurrentRank() {
      let current = RANKS[0];
      for (let i = 0; i < RANKS.length; i++) {
        if (this.totalXP >= RANKS[i].minXP) {
          current = RANKS[i];
        }
      }
      return current;
    }

    getNextRank() {
      const current = this.getCurrentRank();
      const next = RANKS.find(r => r.level === current.level + 1);
      return next || null;
    }

    recordCrashCaught() {
      this.counters.crashesCaught++;
      this.addXP(50, 'Silent crash caught');
      if (this.counters.crashesCaught >= 5) {
        this.awardBadge(BADGE_DEFINITIONS.BLANK_SCREEN_GUARDIAN.id);
      }
      return this.notify();
    }

    recordTamperedPayload() {
      this.counters.tamperedPayloads++;
      this.addXP(30, 'Network payload tampered');
      if (this.counters.tamperedPayloads >= 5) {
        this.awardBadge(BADGE_DEFINITIONS.POSTMAN_SLAYER.id);
      }
      return this.notify();
    }

    recordFiberBugResolved() {
      this.counters.fiberBugsResolved++;
      this.addXP(75, 'Component state bug resolved');
      if (this.counters.fiberBugsResolved >= 5) {
        this.awardBadge(BADGE_DEFINITIONS.FIBER_MASTER.id);
      }
      return this.notify();
    }

    updateStreak() {
      const today = new Date().toDateString();
      if (this.lastActiveDate !== today) {
        const yesterday = new Date(Date.now() - 86400000).toDateString();
        if (this.lastActiveDate === yesterday) {
          this.streakDays++;
        } else {
          this.streakDays = 1;
        }
        this.lastActiveDate = today;
        this.addXP(20, 'Daily debugging streak maintained');
      }
      return this.streakDays;
    }
  }

  return GamificationEngine;
});
