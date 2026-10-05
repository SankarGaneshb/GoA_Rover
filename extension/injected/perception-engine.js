/**
 * GoA_Rover - Layer 1: Perception Engine
 */

(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.PerceptionEngine = factory();
    if (typeof window !== 'undefined' && !window.__GOA_ROVER_PERCEPTION__) {
      window.__GOA_ROVER_PERCEPTION__ = new root.PerceptionEngine();
    }
  }
})(typeof self !== 'undefined' ? self : this, function () {

  class PerceptionEngine {
    constructor(options = {}) {
      this.listeners = [];
      this.mutationCount = 0;
      this.mutationTimer = null;
      this.options = Object.assign({
        autoInit: true,
        churnThreshold: 150,
        clsThreshold: 0.05,
        inpThreshold: 200,
        fontThresholdMs: 800
      }, options);

      this.observers = [];

      if (this.options.autoInit) {
        this.initAll();
      }
    }

    initAll() {
      this.initPaintObserver();
      this.initLayoutInstabilityObserver();
      this.initLoAFObserver();
      this.initFontReadiness();
      this.initDOMMutationObserver();
      this.initEventTimingObserver();
    }

    handleError(component, err) {
      if (typeof console !== 'undefined' && console.warn) {
        console.warn(`[GoA_Rover PerceptionEngine:${component}] Handled error:`, err ? err.message : err);
      }
    }

    onPerception(callback) {
      if (typeof callback === 'function') {
        this.listeners.push(callback);
      }
    }

    dispatch(event) {
      if (!event || typeof event !== 'object') return;
      try {
        this.listeners.forEach((cb) => {
          try { cb(event); } catch (e) { this.handleError('ListenerCallback', e); }
        });
        if (typeof window !== 'undefined' && typeof window.postMessage === 'function') {
          window.postMessage({ source: 'GOA_ROVER_PERCEPTION', payload: event }, '*');
        }
      } catch (err) {
        this.handleError('Dispatch', err);
      }
    }

    /** 1. Paint Timing + childElementCount */
    initPaintObserver() {
      if (typeof PerformanceObserver === 'undefined') return;
      try {
        const observer = new PerformanceObserver((list) => {
          try {
            for (const entry of list.getEntries()) {
              const domElements = (typeof document !== 'undefined' && document.body)
                ? document.body.childElementCount
                : 0;

              if (entry.name === 'first-contentful-paint' && domElements <= 1) {
                this.dispatch({
                  type: 'paint_anomaly',
                  timestamp: entry.startTime || 0,
                  severity: 'critical',
                  details: {
                    metric: entry.name,
                    startTime: entry.startTime || 0,
                    childElementCount: domElements,
                    message: 'FCP fired on an empty root shell (potential silent crash or blank screen)'
                  }
                });
              }
            }
          } catch (e) {
            this.handleError('PaintObserverCallback', e);
          }
        });
        observer.observe({ type: 'paint', buffered: true });
        this.observers.push(observer);
      } catch (e) {
        this.handleError('PaintObserverRegister', e);
      }
    }

    /** 2. ResizeObserver + Layout Instability (CLS) */
    initLayoutInstabilityObserver() {
      if (typeof PerformanceObserver === 'undefined') return;
      try {
        let cumulativeCLS = 0;
        const observer = new PerformanceObserver((list) => {
          try {
            for (const entry of list.getEntries()) {
              if (!entry.hadRecentInput && entry.value > this.options.clsThreshold) {
                cumulativeCLS += entry.value;
                const sources = Array.isArray(entry.sources)
                  ? entry.sources.map((s) => ({
                      node: s && s.node ? ((s.node.tagName || 'NODE') + (s.node.id ? '#' + s.node.id : '')) : 'unknown',
                      previousRect: s ? s.previousRect : null,
                      currentRect: s ? s.currentRect : null
                    }))
                  : [];

                this.dispatch({
                  type: 'layout_shift',
                  timestamp: entry.startTime || 0,
                  severity: entry.value > 0.25 ? 'critical' : 'medium',
                  details: {
                    shiftValue: entry.value,
                    totalCLS: cumulativeCLS,
                    culpritSources: sources,
                    message: `Unexpected Layout Shift detected (${entry.value.toFixed(3)})`
                  }
                });
              }
            }
          } catch (e) {
            this.handleError('LayoutInstabilityCallback', e);
          }
        });
        observer.observe({ type: 'layout-shift', buffered: true });
        this.observers.push(observer);
      } catch (e) {
        this.handleError('LayoutInstabilityRegister', e);
      }
    }

    /** 3. Long Animation Frames (LoAF - Chrome 123+) with Long Tasks Fallback */
    initLoAFObserver() {
      if (typeof PerformanceObserver === 'undefined') return;
      let loafSupported = false;
      try {
        const observer = new PerformanceObserver((list) => {
          try {
            for (const entry of list.getEntries()) {
              const culpritScripts = Array.isArray(entry.scripts)
                ? entry.scripts.map((s) => ({
                    invoker: s ? s.invoker : undefined,
                    invokerType: s ? s.invokerType : undefined,
                    sourceURL: s ? s.sourceURL : undefined,
                    sourceCharPosition: s ? s.sourceCharPosition : undefined,
                    duration: s ? s.duration : 0,
                    executionStart: s ? s.executionStart : 0
                  }))
                : [];

              this.dispatch({
                type: 'loaf_jank',
                timestamp: entry.startTime || 0,
                severity: (entry.duration || 0) > 150 ? 'high' : 'medium',
                details: {
                  frameDuration: entry.duration || 0,
                  renderStart: entry.renderStart || 0,
                  styleAndLayoutDuration: entry.styleAndLayoutStart ? (entry.renderStart - entry.styleAndLayoutStart) : 0,
                  culpritScripts,
                  message: `Main-thread freeze of ${(entry.duration || 0).toFixed(1)}ms detected`
                }
              });
            }
          } catch (e) {
            this.handleError('LoAFCallback', e);
          }
        });
        observer.observe({ type: 'long-animation-frame', buffered: true });
        this.observers.push(observer);
        loafSupported = true;
      } catch (e) {
        this.handleError('LoAFRegister', e);
      }

      if (!loafSupported) {
        this.initLongTasksFallback();
      }
    }

    initLongTasksFallback() {
      if (typeof PerformanceObserver === 'undefined') return;
      try {
        const observer = new PerformanceObserver((list) => {
          try {
            for (const entry of list.getEntries()) {
              if (entry.duration > 50) {
                this.dispatch({
                  type: 'loaf_jank',
                  timestamp: entry.startTime || 0,
                  severity: entry.duration > 150 ? 'high' : 'medium',
                  details: {
                    frameDuration: entry.duration,
                    culpritScripts: [],
                    message: `Long Task of ${entry.duration.toFixed(1)}ms detected`
                  }
                });
              }
            }
          } catch (e) {
            this.handleError('LongTaskCallback', e);
          }
        });
        observer.observe({ type: 'longtask', buffered: true });
        this.observers.push(observer);
      } catch (err) {
        this.handleError('LongTasksFallbackRegister', err);
      }
    }

    /** 4. Resource Timing + document.fonts.ready */
    initFontReadiness() {
      if (typeof document === 'undefined' || !document.fonts || !document.fonts.ready) return;
      try {
        const startTime = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
        document.fonts.ready.then(() => {
          try {
            const now = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
            const duration = now - startTime;
            if (duration > this.options.fontThresholdMs) {
              const fontEntries = (typeof performance !== 'undefined' && performance.getEntriesByType)
                ? performance.getEntriesByType('resource').filter((r) => r.initiatorType === 'css' || (r.name && r.name.match(/\.(woff2?|ttf|otf)/i)))
                : [];

              this.dispatch({
                type: 'font_stall',
                timestamp: now,
                severity: 'medium',
                details: {
                  loadDurationMs: duration,
                  fontCount: fontEntries.length,
                  fontResources: fontEntries.map((f) => ({ name: f.name, duration: f.duration })),
                  message: `Web fonts loaded late (${duration.toFixed(0)}ms), potential FOUT/FOIT`
                }
              });
            }
          } catch (e) {
            this.handleError('FontReadinessCallback', e);
          }
        }).catch((err) => {
          this.handleError('FontPromise', err);
        });
      } catch (e) {
        this.handleError('FontReadinessInit', e);
      }
    }

    /** 5. MutationObserver (DOM churn velocity) */
    initDOMMutationObserver() {
      if (typeof MutationObserver === 'undefined' || typeof document === 'undefined' || !document.documentElement) return;
      try {
        const observer = new MutationObserver((mutations) => {
          try {
            this.mutationCount += mutations.length;
            if (!this.mutationTimer) {
              this.mutationTimer = setTimeout(() => {
                if (this.mutationCount > this.options.churnThreshold) {
                  this.dispatch({
                    type: 'dom_churn',
                    timestamp: (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now(),
                    severity: 'high',
                    details: {
                      mutationsPerSec: this.mutationCount,
                      message: `High DOM churn velocity (${this.mutationCount} mutations/sec) - possible infinite render loop`
                    }
                  });
                }
                this.mutationCount = 0;
                this.mutationTimer = null;
              }, 1000);
            }
          } catch (e) {
            this.handleError('MutationObserverCallback', e);
          }
        });

        observer.observe(document.documentElement, {
          childList: true,
          subtree: true,
          attributes: true,
          characterData: true
        });
        this.observers.push(observer);
      } catch (e) {
        this.handleError('DOMMutationObserverRegister', e);
      }
    }

    /** 6. Event Timing API (INP) */
    initEventTimingObserver() {
      if (typeof PerformanceObserver === 'undefined') return;
      try {
        const observer = new PerformanceObserver((list) => {
          try {
            for (const entry of list.getEntries()) {
              if (entry.interactionId && entry.duration > this.options.inpThreshold) {
                this.dispatch({
                  type: 'inp_latency',
                  timestamp: entry.startTime || 0,
                  severity: entry.duration > 500 ? 'critical' : 'high',
                  details: {
                    interactionType: entry.name,
                    duration: entry.duration,
                    inputDelay: (entry.processingStart && entry.startTime) ? (entry.processingStart - entry.startTime) : 0,
                    processingDuration: (entry.processingEnd && entry.processingStart) ? (entry.processingEnd - entry.processingStart) : 0,
                    presentationDelay: (entry.startTime && entry.duration && entry.processingEnd) ? (entry.startTime + entry.duration - entry.processingEnd) : 0,
                    message: `Slow user interaction (${entry.name}): ${entry.duration.toFixed(0)}ms latency`
                  }
                });
              }
            }
          } catch (e) {
            this.handleError('EventTimingCallback', e);
          }
        });
        observer.observe({ type: 'event', durationThreshold: 100, buffered: true });
        this.observers.push(observer);
      } catch (e) {
        this.handleError('EventTimingRegister', e);
      }
    }

    destroy() {
      if (this.mutationTimer) {
        clearTimeout(this.mutationTimer);
        this.mutationTimer = null;
      }
      this.observers.forEach((obs) => {
        try { obs.disconnect(); } catch (e) {}
      });
      this.observers = [];
      this.listeners = [];
    }
  }

  return PerceptionEngine;
});
