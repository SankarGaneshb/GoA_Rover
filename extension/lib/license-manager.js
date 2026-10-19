/**
 * GoA_Rover - Layer 6: License & Subscription Manager
 * Handles user tier verification (Free, 5-Day Pro Trial, Paid Pro),
 * trial countdown calculation, license key activation, and admin contact workflows.
 */

(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.LicenseManager = factory();
    if (typeof window !== 'undefined' && !window.__GOA_ROVER_LICENSE__) {
      window.__GOA_ROVER_LICENSE__ = new root.LicenseManager();
    }
  }
})(typeof self !== 'undefined' ? self : this, function () {

  const TRIAL_DURATION_MS = 5 * 24 * 60 * 60 * 1000; // 5 days in milliseconds

  class LicenseManager {
    constructor(storageBackend = null) {
      this.storage = storageBackend || (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local ? chrome.storage.local : null);
      this.state = {
        tier: 'free', // 'free' | 'trial' | 'pro'
        trialStartDate: null,
        licenseKey: null
      };
      this.listeners = [];
    }

    /**
     * Initializes state from Chrome local storage or fallback memory
     */
    async init() {
      if (this.storage && typeof this.storage.get === 'function') {
        return new Promise((resolve) => {
          this.storage.get(['goa_user_tier', 'goa_trial_start', 'goa_license_key'], (data) => {
            if (data) {
              this.state.tier = data.goa_user_tier || 'free';
              this.state.trialStartDate = data.goa_trial_start || null;
              this.state.licenseKey = data.goa_license_key || null;
            }
            this.checkTrialExpiry();
            resolve(this.getStatus());
          });
        });
      }
      this.checkTrialExpiry();
      return this.getStatus();
    }

    onChange(cb) {
      if (typeof cb === 'function') this.listeners.push(cb);
    }

    notify() {
      const status = this.getStatus();
      this.listeners.forEach((cb) => {
        try { cb(status); } catch (e) {}
      });
      return status;
    }

    /**
     * Checks if current trial has elapsed, reverting to free if expired
     */
    checkTrialExpiry() {
      if (this.state.tier === 'trial' && this.state.trialStartDate) {
        const elapsed = Date.now() - this.state.trialStartDate;
        if (elapsed > TRIAL_DURATION_MS) {
          this.state.tier = 'free';
          this.saveState();
        }
      }
    }

    /**
     * Returns true if user has active Pro subscription or valid 5-day trial
     */
    isPremiumActive() {
      this.checkTrialExpiry();
      if (this.state.tier === 'pro') return true;
      if (this.state.tier === 'trial' && this.state.trialStartDate) {
        return (Date.now() - this.state.trialStartDate) <= TRIAL_DURATION_MS;
      }
      return false;
    }

    /**
     * Returns remaining days in 5-day trial (e.g. 5, 4, 3...)
     */
    getRemainingTrialDays() {
      if (this.state.tier !== 'trial' || !this.state.trialStartDate) return 0;
      const elapsed = Date.now() - this.state.trialStartDate;
      const remainingMs = Math.max(0, TRIAL_DURATION_MS - elapsed);
      return Math.ceil(remainingMs / (24 * 60 * 60 * 1000));
    }

    /**
     * Instantly starts the 5-day free Pro trial
     */
    async startTrial() {
      this.state.tier = 'trial';
      this.state.trialStartDate = Date.now();
      await this.saveState();
      this.notify();
      return this.getStatus();
    }

    /**
     * Activates a paid license key
     */
    async activateLicenseKey(key) {
      const trimmed = (key || '').trim();
      if (!trimmed || trimmed.length < 6) {
        return { success: false, error: 'Invalid license key format' };
      }
      this.state.tier = 'pro';
      this.state.licenseKey = trimmed;
      await this.saveState();
      this.notify();
      return { success: true, tier: 'pro' };
    }

    /**
     * Resets tier to free (for demo/testing)
     */
    async resetToFree() {
      this.state.tier = 'free';
      this.state.trialStartDate = null;
      this.state.licenseKey = null;
      await this.saveState();
      this.notify();
      return this.getStatus();
    }

    /**
     * Persists current state to Chrome local storage
     */
    async saveState() {
      if (this.storage && typeof this.storage.set === 'function') {
        return new Promise((resolve) => {
          this.storage.set({
            goa_user_tier: this.state.tier,
            goa_trial_start: this.state.trialStartDate,
            goa_license_key: this.state.licenseKey
          }, () => resolve());
        });
      }
    }

    /**
     * Formats normalized status object
     */
    getStatus() {
      this.checkTrialExpiry();
      const isPro = this.isPremiumActive();
      return {
        tier: this.state.tier,
        isPro: isPro,
        remainingTrialDays: this.getRemainingTrialDays(),
        badgeLabel: this.state.tier === 'pro'
          ? '💎 Pro'
          : (this.state.tier === 'trial' ? `⭐ Trial (${this.getRemainingTrialDays()}d)` : 'Free')
      };
    }
  }

  return LicenseManager;
});
