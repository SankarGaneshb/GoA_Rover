const ROIEngine = require('../../extension/lib/roi-engine');

describe('Layer 4: ROIEngine', () => {
  let roi;

  beforeEach(() => {
    roi = new ROIEngine({ hourlyRate: 90 });
  });

  test('initializes with custom hourly rate', () => {
    const stats = roi.getTotalSavings();
    expect(stats.hourlyRate).toBe(90);
    expect(stats.minutes).toBe(0);
    expect(stats.dollars).toBe(0);
  });

  test('records resolution using benchmark matrices', () => {
    // SILENT_CRASH: 45m manual - 3m rover = 42m saved
    const entry = roi.recordResolution('SILENT_CRASH');
    expect(entry.netMinutes).toBe(42);
    // 42 mins @ $90/hr = (42 / 60) * 90 = $63.00
    expect(entry.dollarsSaved).toBe(63);

    const stats = roi.getTotalSavings();
    expect(stats.minutes).toBe(42);
    expect(stats.dollars).toBe(63);
    expect(stats.resolutionsCount).toBe(1);
  });

  test('supports custom minutes resolution override', () => {
    const entry = roi.recordResolution('CUSTOM_REPAIR', 60);
    expect(entry.netMinutes).toBe(60);
    expect(entry.dollarsSaved).toBe(90);
  });

  test('updates hourly rate dynamically', () => {
    roi.setHourlyRate(120);
    const dollars = roi.calculateDollars(60);
    expect(dollars).toBe(120);
  });

  test('generates markdown standup report with recent logs', () => {
    roi.recordResolution('SILENT_CRASH');
    roi.recordResolution('PAYLOAD_ANOMALY');

    const report = roi.generateStandupReport();
    expect(report).toContain('# 🚀 GoA_Rover Developer RoI Report');
    expect(report).toContain('Total Development Time Saved');
    expect(report).toContain('SILENT_CRASH');
    expect(report).toContain('PAYLOAD_ANOMALY');
  });
});
