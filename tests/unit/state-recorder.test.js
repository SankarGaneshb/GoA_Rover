const StateRecorder = require('../../extension/injected/state-recorder');

describe('Layer 2: StateRecorder (30s Rolling Buffer)', () => {
  let recorder;

  beforeEach(() => {
    document.body.innerHTML = '<button id="submit-btn" class="primary btn">Submit</button><input id="email" value="" />';
    recorder = new StateRecorder({ autoInit: true, windowMs: 1000, pruneIntervalMs: 50 });
  });

  afterEach(() => {
    if (recorder) recorder.destroy();
    jest.clearAllMocks();
  });

  test('records user click interactions with element selector', () => {
    const btn = document.getElementById('submit-btn');
    btn.click();

    const timeline = recorder.getTimeline();
    const clickEvent = timeline.find((t) => t.type === 'user_interaction' && t.payload.event === 'click');

    expect(clickEvent).toBeDefined();
    expect(clickEvent.payload.target).toContain('BUTTON#submit-btn');
  });

  test('records user input events with value', () => {
    const input = document.getElementById('email');
    input.value = 'dev@rover.test';
    input.dispatchEvent(new Event('input', { bubbles: true }));

    const timeline = recorder.getTimeline();
    const inputEvent = timeline.find((t) => t.type === 'user_interaction' && t.payload.event === 'input');

    expect(inputEvent).toBeDefined();
    expect(inputEvent.payload.value).toBe('dev@rover.test');
  });

  test('records DOM mutations with added/removed node counts', async () => {
    const div = document.createElement('div');
    div.id = 'dynamic-box';
    document.body.appendChild(div);

    await new Promise((r) => setTimeout(r, 20));

    const timeline = recorder.getTimeline();
    const mutationEvent = timeline.find((t) => t.type === 'dom_mutation_batch');

    expect(mutationEvent).toBeDefined();
    expect(mutationEvent.payload.diffs.length).toBeGreaterThan(0);
  });

  test('prunes events older than rolling buffer window', async () => {
    recorder.record('custom_old_event', { key: 'old' });

    // Manually backdate the entry
    recorder.buffer[0].timestamp = performance.now() - 5000;

    recorder.pruneOldEntries();

    const timeline = recorder.getTimeline();
    const oldEntry = timeline.find((t) => t.type === 'custom_old_event');
    expect(oldEntry).toBeUndefined();
  });

  test('retrieves timeline slice via getTimelineSince', () => {
    recorder.record('event_1', { step: 1 });
    recorder.record('event_2', { step: 2 });

    const recent = recorder.getTimelineSince(500);
    expect(recent.length).toBeGreaterThanOrEqual(2);
  });
});
