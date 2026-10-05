/**
 * GoA_Rover - Layer 4: Real-Time RoI Engine
 * Calculates net developer hours and dollar value saved with customizable benchmark rates.
 */

(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.ROIEngine = factory();
    if (typeof window !== 'undefined' && !window.__GOA_ROVER_ROI__) {
      window.__GOA_ROVER_ROI__ = new root.ROIEngine();
    }
  }
})(typeof self !== 'undefined' ? self : this, function () {

  const DEFAULT_BENCHMARKS = {
    // issueType: { manualMinutes: X, roverMinutes: Y }
    SILENT_CRASH: { manualMinutes: 45, roverMinutes: 3 },
    PAYLOAD_ANOMALY: { manualMinutes: 30, roverMinutes: 2 },
    LAYOUT_SHIFT: { manualMinutes: 25, roverMinutes: 2 },
    LOAF_FREEZE: { manualMinutes: 40, roverMinutes: 4 },
    FONT_STALL: { manualMinutes: 20, roverMinutes: 2 }
  };

  class ROIEngine {
    constructor(config = {}) {
      this.hourlyRate = typeof config.hourlyRate === 'number' ? config.hourlyRate : 80;
      this.benchmarks = Object.assign({}, DEFAULT_BENCHMARKS, config.benchmarks);
      this.totalMinutesSaved = typeof config.totalMinutesSaved === 'number' ? config.totalMinutesSaved : 0;
      this.resolutionLog = Array.isArray(config.resolutionLog) ? [...config.resolutionLog] : [];
    }

    setHourlyRate(rate) {
      if (typeof rate === 'number' && rate > 0) {
        this.hourlyRate = rate;
      }
    }

    recordResolution(issueType, customMinutes = null) {
      let netMinutes = 0;
      if (customMinutes !== null && typeof customMinutes === 'number') {
        netMinutes = customMinutes;
      } else {
        const benchmark = this.benchmarks[issueType] || { manualMinutes: 30, roverMinutes: 3 };
        netMinutes = Math.max(0, benchmark.manualMinutes - benchmark.roverMinutes);
      }

      this.totalMinutesSaved += netMinutes;
      const dollarsSaved = this.calculateDollars(netMinutes);

      const entry = {
        id: Math.random().toString(36).substring(7),
        timestamp: Date.now(),
        issueType,
        netMinutes,
        dollarsSaved
      };

      this.resolutionLog.push(entry);
      return entry;
    }

    calculateDollars(minutes) {
      return parseFloat(((minutes / 60) * this.hourlyRate).toFixed(2));
    }

    getTotalSavings() {
      const hours = parseFloat((this.totalMinutesSaved / 60).toFixed(1));
      const dollars = this.calculateDollars(this.totalMinutesSaved);
      return {
        minutes: this.totalMinutesSaved,
        hours,
        dollars,
        hourlyRate: this.hourlyRate,
        resolutionsCount: this.resolutionLog.length
      };
    }

    generateStandupReport() {
      const stats = this.getTotalSavings();
      return [
        '# 🚀 GoA_Rover Developer RoI Report',
        `- **Total Development Time Saved**: ${stats.minutes} mins (~${stats.hours} hrs)`,
        `- **Direct Value Unlocked**: $${stats.dollars} (at $${this.hourlyRate}/hr rate)`,
        `- **Total Edge Cases Tamed**: ${stats.resolutionsCount}`,
        `- **Generated On**: ${new Date().toLocaleString()}`,
        '',
        '### Recent Resolved Anomalies:',
        ...this.resolutionLog.slice(-5).reverse().map((r, i) =>
          `${i + 1}. [${r.issueType}] - Saved ${r.netMinutes}m ($${r.dollarsSaved})`
        )
      ].join('\n');
    }
  }

  return ROIEngine;
});
