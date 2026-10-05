/**
 * GoA_Rover - Content Script & Shadow DOM Interactive HUD Overlay
 * Features:
 * - Floating status badge with RoI ticker
 * - Expandable Bug Card modal with micro-timeline scrubber
 * - In-situ Network Tamper & Replay Sandbox
 * - Framework Component Breadcrumbs view
 */

(function () {
  console.log('[GoA_Rover] 🚀 Content Script initializing HUD Overlay');

  // 1. Inject Main World Scripts
  function injectScript(relPath) {
    const s = document.createElement('script');
    s.src = chrome.runtime.getURL(relPath);
    s.type = 'text/javascript';
    (document.head || document.documentElement).appendChild(s);
    s.onload = () => s.remove();
  }

  injectScript('injected/perception-engine.js');
  injectScript('injected/network-interceptor.js');
  injectScript('injected/state-recorder.js');
  injectScript('injected/framework-decompiler.js');

  // 2. State Store inside Content Script
  const store = {
    events: [],
    networkLogs: [],
    minutesSaved: 0,
    totalXP: 0,
    level: 'Lvl 1 Scout',
    isCardOpen: false,
    selectedEvent: null
  };

  // Sync stored statistics
  if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
    chrome.storage.local.get(['minutesSaved', 'totalXP', 'level'], (data) => {
      if (data.minutesSaved) store.minutesSaved = data.minutesSaved;
      if (data.totalXP) store.totalXP = data.totalXP;
      if (data.level) store.level = data.level;
      updateBadgeUI();
    });
  }

  // 3. Mount Isolated Shadow DOM Container
  const host = document.createElement('div');
  host.id = 'goa-rover-root';
  (document.body || document.documentElement).appendChild(host);

  const shadow = host.attachShadow({ mode: 'open' });

  // 4. Styles & Template
  shadow.innerHTML = `
    <style>
      :host {
        all: initial;
        position: fixed;
        bottom: 24px;
        right: 24px;
        z-index: 2147483647;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      }
      * { box-sizing: border-box; }
      .goa-badge {
        display: flex;
        align-items: center;
        gap: 12px;
        padding: 8px 16px;
        background: #0f172a;
        color: #f8fafc;
        border: 1px solid #334155;
        border-radius: 9999px;
        box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.5);
        cursor: pointer;
        user-select: none;
        transition: transform 0.2s cubic-bezier(0.4, 0, 0.2, 1);
      }
      .goa-badge:hover {
        transform: translateY(-2px);
        border-color: #38bdf8;
      }
      .status-dot {
        width: 10px;
        height: 10px;
        border-radius: 50%;
        background: #10b981;
        box-shadow: 0 0 8px #10b981;
        transition: background 0.3s;
      }
      .status-dot.warn { background: #f59e0b; box-shadow: 0 0 8px #f59e0b; }
      .status-dot.error { background: #ef4444; box-shadow: 0 0 10px #ef4444; }
      .roi-text { font-size: 13px; font-weight: 600; color: #38bdf8; }
      .level-pill {
        font-size: 11px;
        font-weight: 500;
        background: #1e293b;
        color: #94a3b8;
        padding: 2px 8px;
        border-radius: 12px;
      }

      /* Bug Card Modal */
      .bug-card-modal {
        display: none;
        position: absolute;
        bottom: 54px;
        right: 0;
        width: 440px;
        max-height: 580px;
        background: #0f172a;
        border: 1px solid #334155;
        border-radius: 12px;
        box-shadow: 0 20px 25px -5px rgba(0,0,0,0.5), 0 8px 10px -6px rgba(0,0,0,0.5);
        color: #f8fafc;
        flex-direction: column;
        overflow: hidden;
      }
      .bug-card-modal.open { display: flex; }
      .card-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 12px 16px;
        border-bottom: 1px solid #1e293b;
        background: #1e293b;
      }
      .card-header h3 { margin: 0; font-size: 14px; color: #38bdf8; }
      .btn-close {
        background: transparent;
        border: none;
        color: #94a3b8;
        font-size: 18px;
        cursor: pointer;
      }
      .card-body {
        padding: 16px;
        overflow-y: auto;
        flex: 1;
        font-size: 13px;
      }
      .section-title {
        font-size: 11px;
        text-transform: uppercase;
        letter-spacing: 0.05em;
        color: #94a3b8;
        margin-bottom: 6px;
        margin-top: 12px;
      }
      .section-title:first-child { margin-top: 0; }
      .breadcrumbs-box {
        background: #1e293b;
        padding: 8px 12px;
        border-radius: 6px;
        font-family: monospace;
        color: #a5f3fc;
        font-size: 12px;
        border: 1px solid #334155;
      }
      .timeline-container {
        display: flex;
        align-items: center;
        gap: 8px;
        margin-top: 6px;
      }
      .timeline-slider {
        flex: 1;
        accent-color: #38bdf8;
      }
      .timeline-label { font-size: 11px; color: #94a3b8; font-family: monospace; }
      .tamper-area {
        width: 100%;
        height: 70px;
        background: #1e293b;
        border: 1px solid #334155;
        border-radius: 6px;
        color: #f8fafc;
        font-family: monospace;
        font-size: 11px;
        padding: 8px;
        resize: vertical;
      }
      .btn-action {
        background: #0284c7;
        color: white;
        border: none;
        padding: 6px 12px;
        border-radius: 6px;
        font-size: 12px;
        font-weight: 600;
        cursor: pointer;
        margin-top: 6px;
      }
      .btn-action:hover { background: #0369a1; }
      .event-item {
        background: #1e293b;
        border-radius: 6px;
        padding: 8px 12px;
        margin-bottom: 8px;
        border-left: 3px solid #38bdf8;
      }
      .event-item.critical { border-left-color: #ef4444; }
      .event-item.high { border-left-color: #f59e0b; }
    </style>

    <div class="bug-card-modal" id="bug-modal">
      <div class="card-header">
        <h3 id="modal-title">🛡️ GoA_Rover Triage Card</h3>
        <button class="btn-close" id="btn-close">&times;</button>
      </div>
      <div class="card-body">
        <div class="section-title">Component Breadcrumbs (Decompiled)</div>
        <div class="breadcrumbs-box" id="comp-breadcrumbs">Root > Scanning DOM...</div>

        <div class="section-title">In-Situ 30s Time-Travel Scrubber</div>
        <div class="timeline-container">
          <span class="timeline-label">-30s</span>
          <input type="range" min="0" max="30" value="30" class="timeline-slider" id="scrubber-slider" />
          <span class="timeline-label" id="scrubber-time">Now</span>
        </div>

        <div class="section-title">Network Tamper Sandbox (Zero-Postman)</div>
        <textarea class="tamper-area" id="tamper-json" placeholder='{"status": 200, "data": []}'></textarea>
        <button class="btn-action" id="btn-apply-tamper">Re-inject & Replay Payload</button>

        <div class="section-title">Active Perception Stream</div>
        <div id="event-list">No anomalies detected yet.</div>
      </div>
    </div>

    <div class="goa-badge" id="hud-badge" title="Click to open GoA_Rover Bug Card">
      <div class="status-dot" id="status-indicator"></div>
      <span class="roi-text" id="roi-counter">⚡ 0m saved</span>
      <span class="level-pill" id="level-pill">Lvl 1 Scout</span>
    </div>
  `;

  // UI Element References
  const badge = shadow.getElementById('hud-badge');
  const modal = shadow.getElementById('bug-modal');
  const btnClose = shadow.getElementById('btn-close');
  const statusDot = shadow.getElementById('status-indicator');
  const roiCounter = shadow.getElementById('roi-counter');
  const levelPill = shadow.getElementById('level-pill');
  const breadcrumbsEl = shadow.getElementById('comp-breadcrumbs');
  const slider = shadow.getElementById('scrubber-slider');
  const scrubberTime = shadow.getElementById('scrubber-time');
  const tamperJson = shadow.getElementById('tamper-json');
  const btnTamper = shadow.getElementById('btn-apply-tamper');
  const eventList = shadow.getElementById('event-list');

  function updateBadgeUI() {
    roiCounter.textContent = `⚡ ${store.minutesSaved}m saved`;
    levelPill.textContent = store.level;
  }

  // Toggle Modal
  badge.addEventListener('click', () => {
    store.isCardOpen = !store.isCardOpen;
    if (store.isCardOpen) {
      modal.classList.add('open');
      renderDecompiledTarget(document.activeElement || document.body);
    } else {
      modal.classList.remove('open');
    }
  });

  btnClose.addEventListener('click', (e) => {
    e.stopPropagation();
    store.isCardOpen = false;
    modal.classList.remove('open');
  });

  // Time-Travel Scrubber event
  slider.addEventListener('input', (e) => {
    const val = 30 - parseInt(e.target.value, 10);
    scrubberTime.textContent = val === 0 ? 'Now' : `-${val}s`;
  });

  // Tamper Sandbox action
  btnTamper.addEventListener('click', () => {
    try {
      const parsed = JSON.parse(tamperJson.value || '{}');
      window.postMessage({
        source: 'GOA_ROVER_APPLY_TAMPER',
        payload: { pattern: '', mock: parsed }
      }, '*');
      alert('Mock response injected into page interceptor!');
    } catch (err) {
      alert('Invalid JSON in tamper sandbox');
    }
  });

  // Render Component Breadcrumbs
  function renderDecompiledTarget(node) {
    if (window.__GOA_ROVER_DECOMPILER__) {
      const meta = window.__GOA_ROVER_DECOMPILER__.decompile(node);
      breadcrumbsEl.textContent = meta.breadcrumbs.join(' > ');
    } else {
      breadcrumbsEl.textContent = (node ? node.tagName : 'DOM') + ' (Vanilla)';
    }
  }

  // Listen for messages from injected perception & network scripts
  window.addEventListener('message', (event) => {
    if (!event.data) return;

    if (event.data.source === 'GOA_ROVER_PERCEPTION') {
      const p = event.data.payload;
      store.events.unshift(p);
      if (store.events.length > 20) store.events.pop();

      if (p.severity === 'critical') {
        statusDot.className = 'status-dot error';
      } else if (p.severity === 'high' || p.severity === 'medium') {
        if (!statusDot.classList.contains('error')) statusDot.className = 'status-dot warn';
      }

      renderEventList();
    } else if (event.data.source === 'GOA_ROVER_NETWORK') {
      store.networkLogs.unshift(event.data.payload);
      if (store.networkLogs.length > 20) store.networkLogs.pop();
    }
  });

  function renderEventList() {
    if (store.events.length === 0) {
      eventList.textContent = 'No anomalies detected yet.';
      return;
    }

    eventList.innerHTML = store.events.slice(0, 5).map(e => `
      <div class="event-item ${e.severity}">
        <strong>${e.type.toUpperCase()}</strong>: ${e.details.message || ''}
      </div>
    `).join('');
  }
})();
