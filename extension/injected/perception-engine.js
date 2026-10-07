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
      this.initScriptErrorTrapper();
      this.initCSSDefectScanner();
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
              // Ignore initial bootstrap script compilation during first 800ms unless severe freeze (>300ms)
              if ((entry.startTime || 0) < 800 && (entry.duration || 0) < 300) {
                continue;
              }

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
              // Ignore initial bootstrap script compilation during first 800ms unless severe freeze (>300ms)
              if ((entry.startTime || 0) < 800 && (entry.duration || 0) < 300) {
                continue;
              }

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

    /** 7. Global Script Error Trapper (window.onerror & unhandledrejection) */
    initScriptErrorTrapper() {
      if (typeof window === 'undefined') return;
      try {
        this._errorHandler = (event) => {
          try {
            const message = event.message || (event.error && event.error.message) || 'Unknown Script Error';
            const filename = event.filename || '';
            const lineno = event.lineno || 0;
            const colno = event.colno || 0;
            const stack = (event.error && event.error.stack) || '';

            this.dispatch({
              type: 'script_error',
              timestamp: (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now(),
              severity: 'critical',
              details: {
                message,
                filename,
                lineno,
                colno,
                stack,
                errorType: (event.error && event.error.name) || 'RuntimeError'
              }
            });
          } catch (e) {
            this.handleError('ErrorHandlerCallback', e);
          }
        };

        this._rejectionHandler = (event) => {
          try {
            const reason = event.reason;
            const message = (reason && reason.message) ? reason.message : String(reason);
            const stack = (reason && reason.stack) ? reason.stack : '';

            this.dispatch({
              type: 'unhandled_rejection',
              timestamp: (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now(),
              severity: 'critical',
              details: {
                message: `Unhandled Promise Rejection: ${message}`,
                stack,
                errorType: (reason && reason.name) || 'UnhandledPromiseRejection'
              }
            });
          } catch (e) {
            this.handleError('RejectionHandlerCallback', e);
          }
        };

        window.addEventListener('error', this._errorHandler);
        window.addEventListener('unhandledrejection', this._rejectionHandler);
      } catch (err) {
        this.handleError('ScriptErrorTrapperRegister', err);
      }
    }

    /** 8. CSS Layout Defect Scanner (Flex collapse, Text overflow clipping) */
    initCSSDefectScanner() {
      if (typeof window === 'undefined' || typeof document === 'undefined') return;
      try {
        // Run scan on initial idle and expose manual scanner
        if (typeof window.requestIdleCallback === 'function') {
          window.requestIdleCallback(() => this.scanDOMForCSSDefects());
        } else {
          setTimeout(() => this.scanDOMForCSSDefects(), 500);
        }
      } catch (err) {
        this.handleError('CSSDefectScannerInit', err);
      }
    }

    scanDOMForCSSDefects(rootElement = null) {
      if (typeof document === 'undefined') return [];
      const root = rootElement || document.body;
      if (!root) return [];

      const defects = [];
      try {
        const elements = root.querySelectorAll('*');
        for (let i = 0; i < elements.length; i++) {
          const el = elements[i];
          if (!el || el.id === 'goa-rover-root') continue;

          try {
            const style = (typeof window !== 'undefined' && window.getComputedStyle) ? window.getComputedStyle(el) : null;
            if (!style || style.display === 'none' || style.visibility === 'hidden') continue;

            // 1. Flex collapse detection
            const parent = el.parentElement;
            if (parent && typeof window !== 'undefined' && window.getComputedStyle) {
              const parentStyle = window.getComputedStyle(parent);
              if ((parentStyle.display === 'flex' || parentStyle.display === 'inline-flex') &&
                  parentStyle.flexDirection !== 'column') {
                const rect = el.getBoundingClientRect ? el.getBoundingClientRect() : { width: el.offsetWidth || 0 };
                if (rect.width === 0 && (el.textContent || '').trim().length > 0) {
                  if (!el.id) {
                    el.dataset.goaTarget = 'target-' + Math.random().toString(36).substring(7);
                  }
                  const selector = el.id ? '#' + el.id : `[data-goa-target="${el.dataset.goaTarget}"]`;
                  const defect = {
                    defectType: 'flex_collapse',
                    targetSelector: selector,
                    targetTag: el.tagName,
                    message: `Flex child collapsed to 0px width (${el.tagName})`
                  };
                  defects.push(defect);
                  this.dispatch({
                    type: 'css_layout_defect',
                    timestamp: (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now(),
                    severity: 'high',
                    details: defect
                  });
                }
              }
            }

            // 2. Text overflow cutoff without ellipsis or wrapping
            if (style.overflow === 'hidden' || style.overflowX === 'hidden') {
              if (el.scrollWidth > el.clientWidth && el.clientWidth > 0) {
                if (style.textOverflow !== 'ellipsis') {
                  if (!el.id) {
                    el.dataset.goaTarget = 'target-' + Math.random().toString(36).substring(7);
                  }
                  const selector = el.id ? '#' + el.id : `[data-goa-target="${el.dataset.goaTarget}"]`;
                  const defect = {
                    defectType: 'overflow_clipping',
                    targetSelector: selector,
                    targetTag: el.tagName,
                    message: `Text clipped by overflow:hidden without text-overflow:ellipsis (${el.scrollWidth}px content in ${el.clientWidth}px container)`
                  };
                  defects.push(defect);
                  this.dispatch({
                    type: 'css_layout_defect',
                    timestamp: (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now(),
                    severity: 'medium',
                    details: defect
                  });
                }
              }
            }
          } catch (nodeErr) {
            // Safe traversal guard
          }
        }
      } catch (err) {
        this.handleError('ScanDOMForCSSDefects', err);
      }
      return defects;
    }

    destroy() {
      if (this.mutationTimer) {
        clearTimeout(this.mutationTimer);
        this.mutationTimer = null;
      }
      if (this._errorHandler && typeof window !== 'undefined') {
        window.removeEventListener('error', this._errorHandler);
        this._errorHandler = null;
      }
      if (this._rejectionHandler && typeof window !== 'undefined') {
        window.removeEventListener('unhandledrejection', this._rejectionHandler);
        this._rejectionHandler = null;
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
