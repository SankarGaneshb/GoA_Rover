const PerceptionEngine = require('../../extension/injected/perception-engine');

describe('Layer 1: PerceptionEngine', () => {
  let engine;
  let registeredObservers = [];

  beforeEach(() => {
    registeredObservers = [];
    global.PerformanceObserver = jest.fn().mockImplementation((cb) => {
      const obs = {
        observe: jest.fn(),
        disconnect: jest.fn(),
        _cb: cb
      };
      registeredObservers.push(obs);
      return obs;
    });

    document.body.innerHTML = '<div id="root"></div>';
  });

  afterEach(() => {
    if (engine) engine.destroy();
    jest.clearAllMocks();
  });

  test('initializes and binds all core observers without throwing', () => {
    engine = new PerceptionEngine({ autoInit: true });
    expect(engine).toBeDefined();
    expect(global.PerformanceObserver).toHaveBeenCalled();
  });

  test('detects paint anomaly (empty shell / silent white screen)', (done) => {
    engine = new PerceptionEngine({ autoInit: true });

    engine.onPerception((event) => {
      if (event.type === 'paint_anomaly') {
        expect(event.severity).toBe('critical');
        expect(event.details.childElementCount).toBeLessThanOrEqual(1);
        expect(event.details.message).toContain('empty root shell');
        done();
      }
    });

    // Find paint observer and simulate entry
    const paintObs = registeredObservers.find((o) =>
      o.observe.mock.calls.some((c) => c[0] && c[0].type === 'paint')
    );
    expect(paintObs).toBeDefined();

    paintObs._cb({
      getEntries: () => [{ name: 'first-contentful-paint', startTime: 120 }]
    });
  });

  test('detects layout instability (CLS)', (done) => {
    engine = new PerceptionEngine({ autoInit: true, clsThreshold: 0.05 });

    engine.onPerception((event) => {
      if (event.type === 'layout_shift') {
        expect(event.details.shiftValue).toBe(0.28);
        expect(event.severity).toBe('critical');
        expect(event.details.culpritSources[0].node).toBe('DIV#shifted');
        done();
      }
    });

    const clsObs = registeredObservers.find((o) =>
      o.observe.mock.calls.some((c) => c[0] && c[0].type === 'layout-shift')
    );
    expect(clsObs).toBeDefined();

    clsObs._cb({
      getEntries: () => [
        {
          hadRecentInput: false,
          value: 0.28,
          startTime: 350,
          sources: [
            {
              node: { tagName: 'DIV', id: 'shifted' },
              previousRect: { top: 10 },
              currentRect: { top: 100 }
            }
          ]
        }
      ]
    });
  });

  test('detects Long Animation Frame (LoAF jank)', (done) => {
    engine = new PerceptionEngine({ autoInit: true });

    engine.onPerception((event) => {
      if (event.type === 'loaf_jank') {
        expect(event.severity).toBe('high');
        expect(event.details.frameDuration).toBe(180);
        expect(event.details.culpritScripts[0].sourceURL).toBe('app.js');
        done();
      }
    });

    const loafObs = registeredObservers.find((o) =>
      o.observe.mock.calls.some((c) => c[0] && c[0].type === 'long-animation-frame')
    );
    expect(loafObs).toBeDefined();

    loafObs._cb({
      getEntries: () => [
        {
          duration: 180,
          startTime: 1000,
          renderStart: 1100,
          styleAndLayoutStart: 1050,
          scripts: [
            {
              invoker: 'setTimeout',
              invokerType: 'timer',
              sourceURL: 'app.js',
              sourceCharPosition: 42,
              duration: 120,
              executionStart: 410
            }
          ]
        }
      ]
    });
  });

  test('detects font stall FOUT/FOIT delay', async () => {
    let capturedEvent = null;
    let resolveFonts;
    document.fonts = {
      ready: new Promise((res) => { resolveFonts = res; })
    };

    engine = new PerceptionEngine({ autoInit: true, fontThresholdMs: 50 });
    engine.onPerception((event) => {
      if (event.type === 'font_stall') {
        capturedEvent = event;
      }
    });

    await new Promise((r) => setTimeout(r, 60));
    resolveFonts();
    await document.fonts.ready;

    expect(capturedEvent).not.toBeNull();
    expect(capturedEvent.type).toBe('font_stall');
  });

  test('detects DOM churn runaway loop via MutationObserver', (done) => {
    engine = new PerceptionEngine({ autoInit: true, churnThreshold: 5 });

    engine.onPerception((event) => {
      if (event.type === 'dom_churn') {
        expect(event.severity).toBe('high');
        expect(event.details.mutationsPerSec).toBeGreaterThan(5);
        done();
      }
    });

    // Mutate DOM to trigger observer
    for (let i = 0; i < 10; i++) {
      const el = document.createElement('span');
      document.documentElement.appendChild(el);
    }
  });

  test('handles slow Event Timing (INP)', (done) => {
    engine = new PerceptionEngine({ autoInit: true, inpThreshold: 100 });

    engine.onPerception((event) => {
      if (event.type === 'inp_latency') {
        expect(event.severity).toBe('critical');
        expect(event.details.duration).toBe(550);
        done();
      }
    });

    const eventObs = registeredObservers.find((o) =>
      o.observe.mock.calls.some((c) => c[0] && c[0].type === 'event')
    );
    expect(eventObs).toBeDefined();

    eventObs._cb({
      getEntries: () => [
        {
          interactionId: 101,
          name: 'pointerdown',
          startTime: 1000,
          duration: 550,
          processingStart: 1020,
          processingEnd: 1500
        }
      ]
    });
  });

  test('traps global window.onerror script exceptions', (done) => {
    engine = new PerceptionEngine({ autoInit: true });

    engine.onPerception((event) => {
      if (event.type === 'script_error') {
        expect(event.severity).toBe('critical');
        expect(event.details.message).toContain('TypeError in legacy script');
        expect(event.details.lineno).toBe(15);
        done();
      }
    });

    const errorEvent = new Event('error');
    errorEvent.message = 'TypeError in legacy script';
    errorEvent.filename = 'legacy.js';
    errorEvent.lineno = 15;
    window.dispatchEvent(errorEvent);
  });

  test('traps unhandled promise rejections', (done) => {
    engine = new PerceptionEngine({ autoInit: true });

    engine.onPerception((event) => {
      if (event.type === 'unhandled_rejection') {
        expect(event.severity).toBe('critical');
        expect(event.details.message).toContain('API network failure');
        done();
      }
    });

    const rejEvent = new Event('unhandledrejection');
    rejEvent.reason = new Error('API network failure');
    window.dispatchEvent(rejEvent);
  });

  test('scans and detects CSS layout defects (flex collapse)', () => {
    engine = new PerceptionEngine({ autoInit: true });

    const flexParent = document.createElement('div');
    flexParent.style.display = 'flex';

    const child = document.createElement('span');
    child.textContent = 'Collapsed content';
    child.getBoundingClientRect = () => ({ width: 0, height: 0 });
    flexParent.appendChild(child);
    document.body.appendChild(flexParent);

    // Mock getComputedStyle
    const origGetComputedStyle = window.getComputedStyle;
    window.getComputedStyle = jest.fn((el) => {
      if (el === flexParent) return { display: 'flex', flexDirection: 'row' };
      return { display: 'inline', overflow: 'visible', textOverflow: 'clip' };
    });

    const defects = engine.scanDOMForCSSDefects(document.body);
    expect(defects.length).toBeGreaterThan(0);
    expect(defects[0].defectType).toBe('flex_collapse');

    window.getComputedStyle = origGetComputedStyle;
  });

  test('handles observer creation failure gracefully with fallback', () => {
    global.PerformanceObserver = jest.fn().mockImplementation(() => {
      throw new Error('PerformanceObserver not available');
    });

    expect(() => {
      engine = new PerceptionEngine({ autoInit: true });
    }).not.toThrow();
  });
});
