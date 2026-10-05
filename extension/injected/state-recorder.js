/**
 * GoA_Rover - Layer 2: 30-Second Rolling Time-Travel Buffer
 * Records lightweight DOM diffs, user events, and network snapshots in a circular 30s window.
 */

(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.StateRecorder = factory();
    if (typeof window !== 'undefined' && !window.__GOA_ROVER_STATE_RECORDER__) {
      window.__GOA_ROVER_STATE_RECORDER__ = new root.StateRecorder();
    }
  }
})(typeof self !== 'undefined' ? self : this, function () {

  const DEFAULT_WINDOW_MS = 30000;

  class StateRecorder {
    constructor(options = {}) {
      this.options = Object.assign({
        autoInit: true,
        windowMs: DEFAULT_WINDOW_MS,
        maxBufferSize: 500,
        pruneIntervalMs: 2000
      }, options);

      this.buffer = [];
      this.pruneTimer = null;
      this.domObserver = null;
      this.interactionHandlers = [];

      if (this.options.autoInit) {
        this.initUserInteractionTracking();
        this.initDOMDiffTracking();
        this.startPruneLoop();
      }
    }

    record(type, payload) {
      if (!type) return;
      try {
        const now = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
        this.buffer.push({
          timestamp: now,
          wallTime: Date.now(),
          type,
          payload: payload || {}
        });

        if (this.buffer.length > this.options.maxBufferSize) {
          this.buffer.shift();
        }
      } catch (e) {}
    }

    getTimeline() {
      return [...this.buffer];
    }

    getTimelineSince(msAgo) {
      const now = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
      const cutoff = now - msAgo;
      return this.buffer.filter((item) => item.timestamp >= cutoff);
    }

    startPruneLoop() {
      if (this.pruneTimer) return;
      this.pruneTimer = setInterval(() => {
        this.pruneOldEntries();
      }, this.options.pruneIntervalMs);
    }

    pruneOldEntries() {
      try {
        const now = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
        const threshold = now - this.options.windowMs;
        while (this.buffer.length > 0 && this.buffer[0].timestamp < threshold) {
          this.buffer.shift();
        }
      } catch (e) {}
    }

    initUserInteractionTracking() {
      if (typeof window === 'undefined' || typeof window.addEventListener !== 'function') return;

      const eventTypes = ['click', 'input', 'keydown'];
      eventTypes.forEach((eventType) => {
        const handler = (e) => {
          try {
            const target = e.target;
            let selector = 'unknown';
            if (target && target.tagName) {
              const idStr = target.id ? '#' + target.id : '';
              let classStr = '';
              if (target.className) {
                classStr = '.' + (typeof target.className === 'string' ? target.className.split(' ').filter(Boolean).join('.') : '');
              }
              selector = target.tagName + idStr + classStr;
            }

            this.record('user_interaction', {
              event: eventType,
              target: selector,
              value: eventType === 'input' && target ? target.value : undefined,
              key: eventType === 'keydown' ? e.key : undefined
            });
          } catch (err) {}
        };

        window.addEventListener(eventType, handler, { capture: true, passive: true });
        this.interactionHandlers.push({ eventType, handler });
      });
    }

    initDOMDiffTracking() {
      if (typeof MutationObserver === 'undefined' || typeof document === 'undefined' || !document.documentElement) return;

      try {
        this.domObserver = new MutationObserver((mutations) => {
          try {
            const diffs = mutations.map((m) => ({
              type: m.type,
              targetTag: m.target ? m.target.nodeName : '',
              targetId: m.target && m.target.id ? m.target.id : '',
              addedNodesCount: m.addedNodes ? m.addedNodes.length : 0,
              removedNodesCount: m.removedNodes ? m.removedNodes.length : 0,
              attributeName: m.attributeName
            }));

            this.record('dom_mutation_batch', {
              count: mutations.length,
              diffs: diffs.slice(0, 10)
            });
          } catch (e) {}
        });

        this.domObserver.observe(document.documentElement, {
          childList: true,
          subtree: true,
          attributes: true
        });
      } catch (e) {}
    }

    destroy() {
      if (this.pruneTimer) {
        clearInterval(this.pruneTimer);
        this.pruneTimer = null;
      }
      if (this.domObserver) {
        try { this.domObserver.disconnect(); } catch (e) {}
        this.domObserver = null;
      }
      if (typeof window !== 'undefined') {
        this.interactionHandlers.forEach(({ eventType, handler }) => {
          try { window.removeEventListener(eventType, handler, { capture: true }); } catch (e) {}
        });
      }
      this.interactionHandlers = [];
      this.buffer = [];
    }
  }

  return StateRecorder;
});
