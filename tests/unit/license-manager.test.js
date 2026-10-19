const LicenseManager = require('../../extension/lib/license-manager');

describe('Layer 6: LicenseManager (Subscription & Gating)', () => {
  let mockStorage;
  let storedData;

  beforeEach(() => {
    storedData = {};
    mockStorage = {
      get: jest.fn((keys, cb) => {
        const res = {};
        keys.forEach(k => {
          if (storedData[k] !== undefined) res[k] = storedData[k];
        });
        cb(res);
      }),
      set: jest.fn((data, cb) => {
        Object.assign(storedData, data);
        if (cb) cb();
      })
    };
  });

  test('initializes with default free tier when storage is empty', async () => {
    const mgr = new LicenseManager(mockStorage);
    const status = await mgr.init();

    expect(status.tier).toBe('free');
    expect(status.isPro).toBe(false);
    expect(status.remainingTrialDays).toBe(0);
    expect(status.badgeLabel).toBe('Free');
    expect(mgr.isPremiumActive()).toBe(false);
  });

  test('restores active pro status from storage', async () => {
    storedData.goa_user_tier = 'pro';
    storedData.goa_license_key = 'ROVER-PRO-VALID-123';

    const mgr = new LicenseManager(mockStorage);
    const status = await mgr.init();

    expect(status.tier).toBe('pro');
    expect(status.isPro).toBe(true);
    expect(status.badgeLabel).toBe('💎 Pro');
    expect(mgr.isPremiumActive()).toBe(true);
  });

  test('starts 5-day pro trial and computes remaining days accurately', async () => {
    const mgr = new LicenseManager(mockStorage);
    await mgr.init();

    const trialStatus = await mgr.startTrial();
    expect(trialStatus.tier).toBe('trial');
    expect(trialStatus.isPro).toBe(true);
    expect(trialStatus.remainingTrialDays).toBe(5);
    expect(trialStatus.badgeLabel).toBe('⭐ Trial (5d)');

    expect(mockStorage.set).toHaveBeenCalledWith(
      expect.objectContaining({
        goa_user_tier: 'trial',
        goa_trial_start: expect.any(Number)
      }),
      expect.any(Function)
    );
  });

  test('expires trial automatically after 5 days have elapsed', async () => {
    const sixDaysAgo = Date.now() - (6 * 24 * 60 * 60 * 1000);
    storedData.goa_user_tier = 'trial';
    storedData.goa_trial_start = sixDaysAgo;

    const mgr = new LicenseManager(mockStorage);
    const status = await mgr.init();

    expect(status.tier).toBe('free');
    expect(status.isPro).toBe(false);
    expect(status.remainingTrialDays).toBe(0);
    expect(mgr.isPremiumActive()).toBe(false);
  });

  test('activates valid license key and rejects invalid short keys', async () => {
    const mgr = new LicenseManager(mockStorage);
    await mgr.init();

    const badResult = await mgr.activateLicenseKey('abc');
    expect(badResult.success).toBe(false);
    expect(mgr.isPremiumActive()).toBe(false);

    const goodResult = await mgr.activateLicenseKey('ROVER-PRO-ENTERPRISE-2026');
    expect(goodResult.success).toBe(true);
    expect(mgr.isPremiumActive()).toBe(true);
    expect(mgr.getStatus().badgeLabel).toBe('💎 Pro');
  });

  test('resets to free tier when requested', async () => {
    storedData.goa_user_tier = 'pro';
    storedData.goa_license_key = 'PRO-KEY';

    const mgr = new LicenseManager(mockStorage);
    await mgr.init();
    expect(mgr.isPremiumActive()).toBe(true);

    const resetStatus = await mgr.resetToFree();
    expect(resetStatus.tier).toBe('free');
    expect(resetStatus.isPro).toBe(false);
    expect(mgr.isPremiumActive()).toBe(false);
  });

  test('notifies subscribers on status update', async () => {
    const mgr = new LicenseManager(mockStorage);
    await mgr.init();

    const listener = jest.fn();
    mgr.onChange(listener);

    await mgr.startTrial();
    expect(listener).toHaveBeenCalledWith(expect.objectContaining({
      tier: 'trial',
      isPro: true
    }));
  });
});
