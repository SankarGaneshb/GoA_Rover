/**
 * GoA_Rover - Layer 5: In-Card Feedback & Learning Engine
 * Captures thumbs up/down developer feedback and persists learned heuristics
 * locally into the project's .goa/learnings.json file.
 */

(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.FeedbackLearner = factory();
    if (typeof window !== 'undefined' && !window.__GOA_ROVER_LEARNER__) {
      window.__GOA_ROVER_LEARNER__ = new root.FeedbackLearner();
    }
  }
})(typeof self !== 'undefined' ? self : this, function () {

  const DEFAULT_MEMORY_PATH = '.goa/learnings.json';

  class FeedbackLearner {
    constructor(fsBridge = null) {
      this.fsBridge = fsBridge;
      this.inMemoryRecords = [];
    }

    setFSBridge(fsBridge) {
      this.fsBridge = fsBridge;
    }

    /**
     * Record feedback on a proposed AI diff or diagnosis
     * @param {Object} feedback { issueType, diffSummary, helpful: boolean, note: string }
     */
    async recordFeedback(feedback) {
      if (!feedback || typeof feedback !== 'object') {
        return { success: false, error: 'Invalid feedback object' };
      }

      const record = {
        id: Math.random().toString(36).substring(7),
        timestamp: Date.now(),
        issueType: feedback.issueType || 'UNKNOWN',
        helpful: Boolean(feedback.helpful),
        diffSummary: feedback.diffSummary || '',
        note: feedback.note || ''
      };

      this.inMemoryRecords.push(record);

      // Persist to workspace .goa/learnings.json if connected
      let persisted = false;
      if (this.fsBridge && this.fsBridge.isConnected()) {
        try {
          const currentContentRes = await this.fsBridge.readFile(DEFAULT_MEMORY_PATH);
          let currentList = [];
          if (currentContentRes.success && currentContentRes.content) {
            try { currentList = JSON.parse(currentContentRes.content); } catch (e) {}
          }
          currentList.push(record);
          const writeRes = await this.fsBridge.writeFile(DEFAULT_MEMORY_PATH, JSON.stringify(currentList, null, 2));
          persisted = writeRes.success;
        } catch (err) {
          persisted = false;
        }
      }

      return {
        success: true,
        record,
        persisted
      };
    }

    getRecords() {
      return [...this.inMemoryRecords];
    }

    getAccuracyRate() {
      if (this.inMemoryRecords.length === 0) return 1.0;
      const helpfulCount = this.inMemoryRecords.filter(r => r.helpful).length;
      return parseFloat((helpfulCount / this.inMemoryRecords.length).toFixed(2));
    }
  }

  return FeedbackLearner;
});
