/**
 * GoA_Rover - Content Script & Shadow DOM HUD
 */

(function () {
  console.log('[GoA_Rover] Content script injected');

  // 1. Inject Main World perception and interceptor scripts
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

  // 2. Mount Shadow DOM HUD container to isolate styles
  const host = document.createElement('div');
  host.id = 'goa-rover-root';
  (document.body || document.documentElement).appendChild(host);

  const shadow = host.attachShadow({ mode: 'open' });

  shadow.innerHTML = `
    <style>
      :host {
        all: initial;
        position: fixed;
        bottom: 24px;
        right: 24px;
        z-index: 2147483647;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      }
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
      .status-dot.warn {
        background: #f59e0b;
        box-shadow: 0 0 8px #f59e0b;
      }
      .status-dot.error {
        background: #ef4444;
        box-shadow: 0 0 10px #ef4444;
      }
      .roi-text {
        font-size: 13px;
        font-weight: 600;
        color: #38bdf8;
      }
      .level-pill {
        font-size: 11px;
        font-weight: 500;
        background: #1e293b;
        color: #94a3b8;
        padding: 2px 8px;
        border-radius: 12px;
      }
    </style>
    <div class="goa-badge" id="hud-badge" title="GoA_Rover HUD">
      <div class="status-dot" id="status-indicator"></div>
      <span class="roi-text" id="roi-counter">⚡ 0m saved</span>
      <span class="level-pill" id="level-pill">Lvl 1 Scout</span>
    </div>
  `;

  // 3. Listen to Perception & State messages
  window.addEventListener('message', (event) => {
    if (event.data?.source === 'GOA_ROVER_PERCEPTION') {
      const payload = event.data.payload;
      const dot = shadow.getElementById('status-indicator');
      if (payload.severity === 'critical') {
        dot.className = 'status-dot error';
      } else if (payload.severity === 'high' || payload.severity === 'medium') {
        if (!dot.classList.contains('error')) {
          dot.className = 'status-dot warn';
        }
      }
    }
  });
})();
