const FeedbackLearner = require('../../extension/lib/feedback-learner');

describe('Layer 5: FeedbackLearner', () => {
  let learner;
  let mockFS;

  beforeEach(() => {
    mockFS = {
      connected: true,
      store: {},
      isConnected() { return this.connected; },
      readFile(path) {
        return Promise.resolve({
          success: true,
          content: this.store[path] || '[]'
        });
      },
      writeFile(path, content) {
        this.store[path] = content;
        return Promise.resolve({ success: true, path });
      }
    };

    learner = new FeedbackLearner(mockFS);
  });

  test('records feedback and calculates accuracy rate', async () => {
    const r1 = await learner.recordFeedback({
      issueType: 'SILENT_CRASH',
      helpful: true,
      diffSummary: 'Added optional chaining user?.name'
    });
    expect(r1.success).toBe(true);
    expect(r1.persisted).toBe(true);

    const r2 = await learner.recordFeedback({
      issueType: 'LAYOUT_SHIFT',
      helpful: false,
      note: 'Need min-height instead of height'
    });
    expect(r2.success).toBe(true);

    expect(learner.getRecords().length).toBe(2);
    expect(learner.getAccuracyRate()).toBe(0.5);
  });

  test('handles disconnected FS gracefully without crashing', async () => {
    mockFS.connected = false;
    const res = await learner.recordFeedback({
      issueType: 'LOAF_FREEZE',
      helpful: true
    });

    expect(res.success).toBe(true);
    expect(res.persisted).toBe(false);
    expect(learner.getRecords().length).toBe(1);
  });

  test('handles invalid feedback payloads gracefully', async () => {
    const res = await learner.recordFeedback(null);
    expect(res.success).toBe(false);
    expect(res.error).toBe('Invalid feedback object');
  });

  test('returns 1.0 default accuracy rate when no records exist', () => {
    const emptyLearner = new FeedbackLearner();
    expect(emptyLearner.getAccuracyRate()).toBe(1.0);
  });
});
