/**
 * GoA_Rover - Layer 1: Perception Engine
 * Injected into the Main World context to capture:
 * - Paint Timing + childElementCount (Empty shell / white screen)
 * - ResizeObserver + Layout Instability (CLS root-cause)
 * - Long Animation Frames (LoAF script attribution)
 * - Resource Timing + document.fonts.ready (FOIT/FOUT diagnosis)
 * - MutationObserver (DOM churn velocity / runaway loops)
 * - Event Timing (INP interaction responsiveness)
 */

(function () {
  if (window.__GOA_ROVER_PERCEPTION__) return;

  class PerceptionEngine {
    constructor() {
      this.listeners = [];
      this.mutationCount = 0;
      this.mutationTimer = null;

      this.initPaintObserver();
      this.initLayoutInstabilityObserver();
      this.initLoAFObserver();
      this.initFontReadiness();
      this.initDOMMutationObserver();
      this.initEventTimingObserver();
      console.log('[GoA_Rover] 👁️ Layer 1: Perception Engine active');
    }

    onPerception(callback) {
      this.listeners.push(callback);
    }

    dispatch(event) {
      this.listeners.forEach((cb) => cb(event));
      window.postMessage({ source: 'GOA_ROVER_PERCEPTION', payload: event }, '*');
    }

    /** 1. Paint Timing + childElementCount */
    initPaintObserver() {
      try {
        const observer = new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            const domElements = document.body ? document.body.childElementCount : 0;
            if (entry.name === 'first-contentful-paint' && domElements <= 1) {
              this.dispatch({
                type: 'paint_anomaly',
                timestamp: entry.startTime,
                severity: 'critical',
                details: {
                  metric: entry.name,
                  startTime: entry.startTime,
                  childElementCount: domElements,
                  message: 'FCP fired on an empty root shell (potential silent crash or blank screen)'
                }
              });
            }
          }
        });
        observer.observe({ type: 'paint', buffered: true });
      } catch (e) {
        console.warn('[GoA_Rover] Paint Timing not supported', e);
      }
    }

    /** 2. ResizeObserver + Layout Instability (CLS) */
    initLayoutInstabilityObserver() {
      try {
        let cumulativeCLS = 0;
        const observer = new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            if (!entry.hadRecentInput && entry.value > 0.05) {
              cumulativeCLS += entry.value;
              const sources = entry.sources ? entry.sources.map((s) => ({
                node: s.node ? (s.node.tagName || 'NODE') + (s.node.id ? '#' + s.node.id : '') : 'unknown',
                previousRect: s.previousRect,
                currentRect: s.currentRect
              })) : [];

              this.dispatch({
                type: 'layout_shift',
                timestamp: entry.startTime,
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
        });
        observer.observe({ type: 'layout-shift', buffered: true });
      } catch (e) {
        console.warn('[GoA_Rover] Layout Instability not supported', e);
      }
    }

    /** 3. Long Animation Frames (LoAF - Chrome 123+) */
    initLoAFObserver() {
      try {
        const observer = new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            const culpritScripts = entry.scripts ? entry.scripts.map((s) => ({
              invoker: s.invoker,
              invokerType: s.invokerType,
              sourceURL: s.sourceURL,
              sourceCharPosition: s.sourceCharPosition,
              duration: s.duration,
              executionStart: s.executionStart
            })) : [];

            this.dispatch({
              type: 'loaf_jank',
              timestamp: entry.startTime,
              severity: entry.duration > 150 ? 'high' : 'medium',
              details: {
                frameDuration: entry.duration,
                renderStart: entry.renderStart,
                styleAndLayoutDuration: entry.styleAndLayoutStart ? (entry.renderStart - entry.styleAndLayoutStart) : 0,
                culpritScripts: culpritScripts,
                message: `Main-thread freeze of ${entry.duration.toFixed(1)}ms detected`
              }
            });
          }
        });
        observer.observe({ type: 'long-animation-frame', buffered: true });
      } catch (e) {
        // Fallback for browsers without LoAF
        this.initLongTasksFallback();
      }
    }

    initLongTasksFallback() {
      try {
        const observer = new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            if (entry.duration > 50) {
              this.dispatch({
                type: 'loaf_jank',
                timestamp: entry.startTime,
                severity: entry.duration > 150 ? 'high' : 'medium',
                details: {
                  frameDuration: entry.duration,
                  culpritScripts: [],
                  message: `Long Task of ${entry.duration.toFixed(1)}ms detected`
                }
              });
            }
          }
        });
        observer.observe({ type: 'longtask', buffered: true });
      } catch (e) {}
    }

    /** 4. Resource Timing + document.fonts.ready */
    initFontReadiness() {
      if (document.fonts && document.fonts.ready) {
        const startTime = performance.now();
        document.fonts.ready.then(() => {
          const duration = performance.now() - startTime;
          if (duration > 800) {
            const fontEntries = performance.getEntriesByType('resource')
              .filter((r) => r.initiatorType === 'css' || (r.name && r.name.match(/\.(woff2?|ttf|otf)/i)));

            this.dispatch({
              type: 'font_stall',
              timestamp: performance.now(),
              severity: 'medium',
              details: {
                loadDurationMs: duration,
                fontCount: fontEntries.length,
                fontResources: fontEntries.map((f) => ({ name: f.name, duration: f.duration })),
                message: `Web fonts loaded late (${duration.toFixed(0)}ms), potential FOUT/FOIT`
              }
            });
          }
        });
      }
    }

    /** 5. MutationObserver (DOM churn velocity) */
    initDOMMutationObserver() {
      const observer = new MutationObserver((mutations) => {
        this.mutationCount += mutations.length;
        if (!this.mutationTimer) {
          this.mutationTimer = setTimeout(() => {
            if (this.mutationCount > 150) {
              this.dispatch({
                type: 'dom_churn',
                timestamp: performance.now(),
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
      });

      observer.observe(document.documentElement, {
        childList: true,
        subtree: true,
        attributes: true,
        characterData: true
      });
    }

    /** 6. Event Timing API (INP) */
    initEventTimingObserver() {
      try {
        const observer = new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            if (entry.interactionId && entry.duration > 200) {
              this.dispatch({
                type: 'inp_latency',
                timestamp: entry.startTime,
                severity: entry.duration > 500 ? 'critical' : 'high',
                details: {
                  interactionType: entry.name,
                  duration: entry.duration,
                  inputDelay: entry.processingStart - entry.startTime,
                  processingDuration: entry.processingEnd - entry.processingStart,
                  presentationDelay: entry.startTime + entry.duration - entry.processingEnd,
                  message: `Slow user interaction (${entry.name}): ${entry.duration.toFixed(0)}ms latency`
                }
              });
            }
          }
        });
        observer.observe({ type: 'event', durationThreshold: 100, buffered: true });
      } catch (e) {
        console.warn('[GoA_Rover] Event Timing API not supported', e);
      }
    }
  }

  window.__GOA_ROVER_PERCEPTION__ = new PerceptionEngine();
})();
