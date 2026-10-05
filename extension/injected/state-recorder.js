/**
 * GoA_Rover - Layer 2: 30-Second Rolling Time-Travel Buffer
 * Records lightweight DOM diffs, user events, and network snapshots in a circular 30s window.
 */

(function () {
  if (window.__GOA_ROVER_STATE_RECORDER__) return;

  const WINDOW_MS = 30000; // 30 seconds rolling buffer

  class StateRecorder {
    constructor() {
      this.buffer = []; // { timestamp, type, payload }
      this.initUserInteractionTracking();
      this.initDOMDiffTracking();
      this.startPruneLoop();
      console.log('[GoA_Rover] ⏱️ Layer 2: 30s State Buffer active');
    }

    record(type, payload) {
      const now = performance.now();
      this.buffer.push({
        timestamp: now,
        wallTime: Date.now(),
        type,
        payload
      });
    }

    getTimeline() {
      return [...this.buffer];
    }

    startPruneLoop() {
      setInterval(() => {
        const threshold = performance.now() - WINDOW_MS;
        while (this.buffer.length > 0 && this.buffer[0].timestamp < threshold) {
          this.buffer.shift();
        }
      }, 2000);
    }

    initUserInteractionTracking() {
      ['click', 'input', 'keydown'].forEach((eventType) => {
        window.addEventListener(eventType, (e) => {
          const target = e.target;
          const selector = target ? (target.tagName + (target.id ? '#' + target.id : target.className ? '.' + target.className.split(' ').join('.') : '')) : 'unknown';

          this.record('user_interaction', {
            event: eventType,
            target: selector,
            value: eventType === 'input' ? target.value : undefined,
            key: eventType === 'keydown' ? e.key : undefined
          });
        }, { capture: true, passive: true });
      });
    }

    initDOMDiffTracking() {
      const observer = new MutationObserver((mutations) => {
        const diffs = mutations.map((m) => ({
          type: m.type,
          targetTag: m.target ? m.target.nodeName : '',
          targetId: m.target && m.target.id ? m.target.id : '',
          addedNodesCount: m.addedNodes.length,
          removedNodesCount: m.removedNodes.length,
          attributeName: m.attributeName
        }));

        this.record('dom_mutation_batch', {
          count: mutations.length,
          diffs: diffs.slice(0, 10) // store up to 10 representative deltas per batch
        });
      });

      observer.observe(document.documentElement, {
        childList: true,
        subtree: true,
        attributes: true
      });
    }
  }

  window.__GOA_ROVER_STATE_RECORDER__ = new StateRecorder();
})();
