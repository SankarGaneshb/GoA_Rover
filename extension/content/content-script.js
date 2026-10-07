/**
 * GoA_Rover - Content Script & Shadow DOM Interactive HUD Overlay
 * Features:
 * - Floating status badge with RoI ticker
 * - Expandable Bug Card modal with micro-timeline scrubber
 * - On-the-Spot Network Tamper & Replay Sandbox
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
  injectScript('lib/auto-fixer.js');
  injectScript('lib/fs-workspace.js');

  // 2. State Store inside Content Script
  const store = {
    events: [],
    networkLogs: [],
    pendingFixes: [],
    tabMinutesSaved: 0,
    tabBugsCaught: 0,
    lifetimeMinutesSaved: 0,
    lifetimeBugsCaught: 0,
    totalXP: 0,
    level: 'Lvl 1 Scout',
    isCardOpen: false,
    selectedEvent: null
  };

  // Sync stored statistics
  function calculateRank(xp) {
    if (xp >= 3000) return 'Lvl 5 Guardian';
    if (xp >= 1500) return 'Lvl 4 Slayer';
    if (xp >= 750) return 'Lvl 3 Whisperer';
    if (xp >= 300) return 'Lvl 2 Detective';
    return 'Lvl 1 Scout';
  }

  let updateBadgeUI = function () {};

  if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.id && chrome.storage && chrome.storage.local) {
    try {
      chrome.storage.local.get(['lifetimeMinutesSaved', 'lifetimeBugsCaught', 'minutesSaved', 'totalXP', 'level'], (data) => {
        if (chrome.runtime.lastError) return;
        if (typeof data?.lifetimeMinutesSaved === 'number') {
          store.lifetimeMinutesSaved = data.lifetimeMinutesSaved;
        } else if (typeof data?.minutesSaved === 'number') {
          // Backward compatibility
          store.lifetimeMinutesSaved = data.minutesSaved;
        }
        if (typeof data?.lifetimeBugsCaught === 'number') store.lifetimeBugsCaught = data.lifetimeBugsCaught;
        if (typeof data?.totalXP === 'number') {
          store.totalXP = data.totalXP;
          store.level = calculateRank(store.totalXP);
        }
        updateBadgeUI();
      });
    } catch (e) {
      // Extension context invalidated during dev reload
    }
  }

  // 3. Mount Isolated Shadow DOM Container safely when DOM is ready
  function mountHUD() {
    if (document.getElementById('goa-rover-root')) return;
    const host = document.createElement('div');
    host.id = 'goa-rover-root';
    (document.body || document.documentElement).appendChild(host);

    const shadow = host.attachShadow({ mode: 'open' });
    initShadowUI(shadow);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', mountHUD);
  } else {
    mountHUD();
  }

  function initShadowUI(shadow) {

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
        <!-- Dual Scorecard Banner -->
        <div style="display:flex; gap:8px; margin-bottom:10px;">
          <div style="flex:1; background:#0f172a; padding:8px 10px; border-radius:6px; border:1px solid #38bdf8;">
            <div style="font-size:10px; color:#94a3b8; text-transform:uppercase; font-weight:600;">This Tab Session</div>
            <div style="font-size:15px; font-weight:700; color:#38bdf8;" id="tab-score">⚡ 0m saved</div>
            <div style="font-size:10px; color:#64748b;" id="tab-bug-count">0 bugs caught</div>
          </div>
          <div style="flex:1; background:#0f172a; padding:8px 10px; border-radius:6px; border:1px solid #334155;">
            <div style="font-size:10px; color:#94a3b8; text-transform:uppercase; font-weight:600;">Lifetime RoI</div>
            <div style="font-size:15px; font-weight:700; color:#4ade80;" id="lifetime-score">🏆 0m saved</div>
            <div style="font-size:10px; color:#64748b;" id="lifetime-bug-count">Cumulative across tabs</div>
          </div>
        </div>
        <button class="btn-action" id="btn-reset-tab" style="background:#334155; font-size:11px; padding:3px 8px; margin-bottom:12px; margin-top:0;">🔄 Reset This Tab to 0m</button>

        <div class="section-title">Component Breadcrumbs (Decompiled)</div>
        <div class="breadcrumbs-box" id="comp-breadcrumbs">Root > Scanning DOM...</div>

        <div class="section-title">On-the-Spot 30s Time-Travel Scrubber</div>
        <div class="timeline-container">
          <span class="timeline-label">-30s</span>
          <input type="range" min="0" max="30" value="30" class="timeline-slider" id="scrubber-slider" />
          <span class="timeline-label" id="scrubber-time">Now</span>
        </div>

        <div class="section-title">Network Tamper Sandbox (Zero-Postman)</div>
        <textarea class="tamper-area" id="tamper-json" placeholder='{"status": 200, "data": []}'></textarea>
        <button class="btn-action" id="btn-apply-tamper">Re-inject & Replay Payload</button>

        <div class="section-title">On-the-Spot Auto-Remediation (Human-in-the-Loop Approval Required)</div>
        <div id="remediation-box" style="background:#1e293b; padding:8px; border-radius:6px; font-family:monospace; font-size:11px; margin-bottom:6px; color:#fde047; max-height:160px; overflow-y:auto;">
          No active repair needed.
        </div>

        <!-- HIL Confirmation & Review Box (Explicit Human Approval) -->
        <div id="hil-approval-card" style="display:none; background:#0f172a; border:1px solid #eab308; border-radius:6px; padding:10px; margin-top:8px;">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px;">
            <strong style="color:#fde047; font-size:12px;">🛡️ HIL Verification & Decision</strong>
            <span id="hil-mode-tag" style="background:#eab308; color:#0f172a; font-weight:700; font-size:9px; padding:2px 6px; border-radius:4px; text-transform:uppercase;">Approval Needed</span>
          </div>
          <div id="hil-summary-text" style="font-size:11px; color:#cbd5e1; margin-bottom:8px; font-family:monospace; line-height:1.4;">
            Review planned mutations before executing.
          </div>
          <div style="display:flex; gap:6px;">
            <button class="btn-action" id="btn-hil-approve" style="background:#16a34a; font-size:11px; padding:5px 10px; margin-top:0;">✅ Approve & Apply</button>
            <button class="btn-action" id="btn-hil-reject" style="background:#475569; font-size:11px; padding:5px 10px; margin-top:0;">❌ Reject / Cancel</button>
          </div>
        </div>

        <div style="display:flex; gap:6px; flex-wrap:wrap; margin-top:8px;">
          <button class="btn-action" id="btn-fix-both" style="background:#0284c7; display:none;">⚡ Apply Both (Live DOM + Disk Patch)</button>
          <button class="btn-action" id="btn-fix-all-live" style="background:#16a34a; display:none;">✨ Live DOM Only</button>
          <button class="btn-action" id="btn-patch-all-disk" style="background:#8b5cf6; display:none;">💾 Disk Patch Only</button>
          <button class="btn-action" id="btn-copy-diff" style="background:#475569; display:none;">📋 Copy Unified Diff</button>
        </div>
        <div id="workspace-status" style="font-size:10px; color:#94a3b8; margin-top:6px; font-family:monospace;">
          📁 Workspace: <span id="workspace-name" style="color:#fde047;">Not connected</span> 
          <a href="#" id="link-connect-ws" style="color:#38bdf8; text-decoration:underline; margin-left:6px;">[Connect Project Folder]</a>
        </div>

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
  const remediationBox = shadow.getElementById('remediation-box');
  const eventList = shadow.getElementById('event-list');
  const hilApprovalCard = shadow.getElementById('hil-approval-card');
  const hilModeTag = shadow.getElementById('hil-mode-tag');
  const hilSummaryText = shadow.getElementById('hil-summary-text');
  const btnHilApprove = shadow.getElementById('btn-hil-approve');
  const btnHilReject = shadow.getElementById('btn-hil-reject');
  const btnFixBoth = shadow.getElementById('btn-fix-both');
  const btnFixAllLive = shadow.getElementById('btn-fix-all-live');
  const btnPatchAllDisk = shadow.getElementById('btn-patch-all-disk');
  const btnCopyDiff = shadow.getElementById('btn-copy-diff');
  const tabScoreEl = shadow.getElementById('tab-score');
  const tabBugEl = shadow.getElementById('tab-bug-count');
  const lifetimeScoreEl = shadow.getElementById('lifetime-score');
  const lifetimeBugEl = shadow.getElementById('lifetime-bug-count');
  const btnResetTab = shadow.getElementById('btn-reset-tab');
  const workspaceNameEl = shadow.getElementById('workspace-name');
  const linkConnectWs = shadow.getElementById('link-connect-ws');

  let workspaceDirHandle = null;
  let pendingHilAction = null; // Holds callback to execute once developer explicitly approves

  function renderFixQueue() {
    if (store.pendingFixes.length === 0) {
      remediationBox.innerHTML = 'No active repair needed.';
      if (hilApprovalCard) hilApprovalCard.style.display = 'none';
      if (btnFixBoth) btnFixBoth.style.display = 'none';
      if (btnFixAllLive) btnFixAllLive.style.display = 'none';
      if (btnPatchAllDisk) btnPatchAllDisk.style.display = 'none';
      if (btnCopyDiff) btnCopyDiff.style.display = 'none';
      return;
    }

    const cssCount = store.pendingFixes.filter(f => f.type === 'css').length;
    const scriptCount = store.pendingFixes.filter(f => f.type === 'script').length;

    let html = `<strong>⚠️ ${store.pendingFixes.length} Issue(s) Detected on Page:</strong><br/>`;
    store.pendingFixes.forEach((fix, idx) => {
      const isChecked = fix.selected !== false ? 'checked' : '';
      if (fix.type === 'css') {
        html += `<div style="display:flex; align-items:flex-start; gap:6px; margin-top:4px; padding:4px 6px; background:#0f172a; border-radius:4px; border-left:3px solid #38bdf8;">` +
                `<input type="checkbox" class="fix-check" data-idx="${idx}" ${isChecked} style="margin-top:2px;" />` +
                `<div><strong>#${idx + 1} CSS Collapse:</strong> ${fix.selector}<br/><code style="color:#67e8f9;">flex-shrink: 0; min-width: fit-content;</code></div></div>`;
      } else {
        html += `<div style="display:flex; align-items:flex-start; gap:6px; margin-top:4px; padding:4px 6px; background:#0f172a; border-radius:4px; border-left:3px solid #ef4444;">` +
                `<input type="checkbox" class="fix-check" data-idx="${idx}" ${isChecked} style="margin-top:2px;" />` +
                `<div><strong>#${idx + 1} Script Crash:</strong> ${fix.filename || 'script'}:${fix.lineno || 1}<br/><code style="color:#f87171;">${fix.message || 'TypeError'}</code></div></div>`;
      }
    });

    remediationBox.innerHTML = html;

    // Attach checkbox toggle listeners
    remediationBox.querySelectorAll('.fix-check').forEach(cb => {
      cb.addEventListener('change', (e) => {
        const idx = parseInt(e.target.getAttribute('data-idx'), 10);
        if (store.pendingFixes[idx]) {
          store.pendingFixes[idx].selected = e.target.checked;
        }
      });
    });

    const activeSelected = store.pendingFixes.filter(f => f.selected !== false);
    btnFixBoth.style.display = 'inline-block';
    btnFixBoth.textContent = `⚡ Apply Both (Live DOM + Disk Patch)`;
    btnFixAllLive.style.display = cssCount > 0 ? 'inline-block' : 'none';
    btnFixAllLive.textContent = `✨ Live DOM Only (${cssCount} CSS)`;
    btnPatchAllDisk.style.display = 'inline-block';
    btnPatchAllDisk.textContent = `💾 Disk Patch Only (${store.pendingFixes.length})`;
    btnCopyDiff.style.display = 'inline-block';
    btnCopyDiff.textContent = `📋 Copy Diff (${store.pendingFixes.length})`;
  }

  if (linkConnectWs) {
    linkConnectWs.addEventListener('click', async (e) => {
      e.preventDefault();
      try {
        if (typeof window.showDirectoryPicker === 'function') {
          workspaceDirHandle = await window.showDirectoryPicker({ mode: 'readwrite' });
          workspaceNameEl.textContent = workspaceDirHandle.name;
          workspaceNameEl.style.color = '#4ade80';
          linkConnectWs.textContent = '[Change]';
        } else {
          alert('File System Access API is not supported in this browser tab.');
        }
      } catch (err) {
        // User cancelled picker
      }
    });
  }

  updateBadgeUI = function () {
    if (roiCounter) {
      roiCounter.textContent = store.tabMinutesSaved > 0 
        ? `⚡ +${store.tabMinutesSaved}m this tab` 
        : `⚡ 0m this tab`;
    }
    if (levelPill) levelPill.textContent = store.level;

    if (tabScoreEl) tabScoreEl.textContent = `⚡ +${store.tabMinutesSaved}m saved`;
    if (tabBugEl) tabBugEl.textContent = `${store.tabBugsCaught} bugs caught`;
    if (lifetimeScoreEl) lifetimeScoreEl.textContent = `🏆 ${store.lifetimeMinutesSaved}m saved`;
    if (lifetimeBugEl) lifetimeBugEl.textContent = `~${(store.lifetimeMinutesSaved / 60).toFixed(1)} hrs across tabs`;

    if (badge) {
      badge.title = `⚡ This Tab: +${store.tabMinutesSaved}m saved (${store.tabBugsCaught} bugs)\n🏆 Lifetime: ${store.lifetimeMinutesSaved}m (~${(store.lifetimeMinutesSaved / 60).toFixed(1)} hrs)\n🎖️ Rank: ${store.level} (${store.totalXP} XP)\n\nClick to open Triage Card`;
    }
  };
  updateBadgeUI();

  if (btnResetTab) {
    btnResetTab.addEventListener('click', (e) => {
      e.stopPropagation();
      store.tabMinutesSaved = 0;
      store.tabBugsCaught = 0;
      updateBadgeUI();
    });
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

    function awardRoI(minutes, xp) {
      store.tabMinutesSaved += minutes;
      store.tabBugsCaught += 1;
      store.lifetimeMinutesSaved += minutes;
      store.lifetimeBugsCaught += 1;
      store.totalXP += xp;
      store.level = calculateRank(store.totalXP);
      updateBadgeUI();

      if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.id && chrome.storage && chrome.storage.local) {
        try {
          chrome.storage.local.set({
            lifetimeMinutesSaved: store.lifetimeMinutesSaved,
            lifetimeBugsCaught: store.lifetimeBugsCaught,
            totalXP: store.totalXP,
            level: store.level
          });
        } catch (e) {
          // Extension context invalidated during dev reload
        }
      }
    }

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

      // Award RoI on perception events according to Layer 4 benchmarks
      if (p.type === 'paint_anomaly') {
        awardRoI(42, 75); // SILENT_CRASH benchmark (45m - 3m = 42m)
      } else if (p.type === 'layout_shift') {
        awardRoI(23, 30); // LAYOUT_SHIFT benchmark (25m - 2m = 23m)
      } else if (p.type === 'loaf_jank') {
        awardRoI(36, 50); // LOAF_FREEZE benchmark (40m - 4m = 36m)
      } else if (p.type === 'dom_churn') {
        awardRoI(20, 35); // Runaway loop benchmark
      } else if (p.type === 'font_stall') {
        awardRoI(18, 25); // FONT_STALL benchmark (20m - 2m = 18m)
      }

      // Check if event is remediable (CSS defect or Script error)
      if (p.type === 'css_layout_defect') {
        const defect = p.details;
        // Avoid duplicate entries for the same target selector
        if (!store.pendingFixes.some(f => f.type === 'css' && f.selector === defect.targetSelector)) {
          store.pendingFixes.push({
            type: 'css',
            selector: defect.targetSelector,
            message: defect.message,
            diff: `/* CSS Hot-Patch for ${defect.targetSelector} */\n${defect.targetSelector} {\n+  flex-shrink: 0;\n+  min-width: fit-content;\n}\n`
          });
          renderFixQueue();
        }
      } else if (p.type === 'script_error' || p.type === 'unhandled_rejection') {
        const details = p.details;
        const key = `${details.filename || 'script'}:${details.lineno || 1}`;
        if (!store.pendingFixes.some(f => f.type === 'script' && f.key === key)) {
          store.pendingFixes.push({
            type: 'script',
            key: key,
            filename: details.filename,
            lineno: details.lineno,
            message: details.message,
            diff: `// Guard at ${details.filename || 'script'}:${details.lineno || 1}\n- data.items.map(...)\n+ (data?.items || []).map(...)\n`
          });
          renderFixQueue();
        }
        // Award RoI on critical script crash detection
        awardRoI(42, 75);
      }

      // Function to prompt Human-in-the-Loop decision
      function promptHilDecision(mode, description, actionCallback) {
        pendingHilAction = actionCallback;
        hilModeTag.textContent = mode;
        hilSummaryText.innerHTML = description;
        hilApprovalCard.style.display = 'block';
      }

      // HIL Approve button
      btnHilApprove.onclick = async () => {
        if (typeof pendingHilAction === 'function') {
          const action = pendingHilAction;
          pendingHilAction = null;
          hilApprovalCard.style.display = 'none';
          await action();
        }
      };

      // HIL Reject button
      btnHilReject.onclick = () => {
        pendingHilAction = null;
        hilApprovalCard.style.display = 'none';
        remediationBox.innerHTML += `<div style="color:#94a3b8; margin-top:4px;">❌ Remediation cancelled by developer. No changes were made.</div>`;
      };

      // Wire Option 1: Live DOM Only with HIL Gate
      btnFixAllLive.onclick = () => {
        const selectedCss = store.pendingFixes.filter(f => f.type === 'css' && f.selected !== false);
        if (selectedCss.length === 0) {
          alert('No CSS fixes selected. Please check at least one CSS issue above.');
          return;
        }

        promptHilDecision(
          'Live DOM Hot-Patch',
          `⚠️ <strong>Confirm Live DOM Modification:</strong><br/>` +
          `You are about to modify ${selectedCss.length} element(s) directly in the active DOM session.<br/>` +
          `Selectors: <code style="color:#38bdf8;">${selectedCss.map(f => f.selector).join(', ')}</code>`,
          () => {
            let appliedCount = 0;
            selectedCss.forEach(fix => {
              const targetEl = document.querySelector(fix.selector);
              if (targetEl) {
                targetEl.style.flexShrink = '0';
                targetEl.style.minWidth = 'fit-content';
                appliedCount++;
              }
            });

            // Remove applied CSS fixes from queue
            store.pendingFixes = store.pendingFixes.filter(f => !selectedCss.includes(f));
            renderFixQueue();

            if (appliedCount > 0) {
              remediationBox.innerHTML += `<div style="color:#4ade80; margin-top:6px;">✅ Approved & Applied Live DOM Fix to ${appliedCount} element(s)!</div>`;
              awardRoI(25 * appliedCount, 50 * appliedCount);
            }
          }
        );
      };

      // Wire Option 2: Disk Patch Only with HIL Gate
      btnPatchAllDisk.onclick = () => {
        if (!workspaceDirHandle) {
          alert('Please connect your project folder first using "[Connect Project Folder]" above!');
          return;
        }
        const selectedFixes = store.pendingFixes.filter(f => f.selected !== false);
        if (selectedFixes.length === 0) {
          alert('No fixes selected. Please check at least one issue above.');
          return;
        }

        promptHilDecision(
          'Disk File Write',
          `⚠️ <strong>Confirm File Write to Disk:</strong><br/>` +
          `GoA_Rover will write <code style="color:#a78bfa;">goa-rover-fix.patch</code> (${selectedFixes.length} fixes) to: <br/>` +
          `📁 <strong>${workspaceDirHandle.name}/goa-rover-fix.patch</strong>`,
          async () => {
            try {
              const patchCount = selectedFixes.length;
              const unifiedDiff = selectedFixes.map(f => f.diff).join('\n');
              const patchFileHandle = await workspaceDirHandle.getFileHandle('goa-rover-fix.patch', { create: true });
              const writable = await patchFileHandle.createWritable();
              await writable.write(unifiedDiff);
              await writable.close();

              remediationBox.innerHTML = `<span style="color:#a78bfa;">💾 Approved & Written 'goa-rover-fix.patch' (${patchCount} fixes) to project root!</span>`;
              store.pendingFixes = store.pendingFixes.filter(f => !selectedFixes.includes(f));
              renderFixQueue();
              awardRoI(30 * patchCount, 60 * patchCount);
            } catch (err) {
              alert('File write failed: ' + (err ? err.message : err));
            }
          }
        );
      };

      // Wire Option 3: Apply Both (Live DOM + Disk Patch) with HIL Gate
      btnFixBoth.onclick = () => {
        if (!workspaceDirHandle) {
          alert('Please connect your project folder first using "[Connect Project Folder]" above to write the disk patch!');
          return;
        }
        const selectedFixes = store.pendingFixes.filter(f => f.selected !== false);
        const selectedCss = selectedFixes.filter(f => f.type === 'css');
        if (selectedFixes.length === 0) {
          alert('No fixes selected. Please check at least one issue above.');
          return;
        }

        promptHilDecision(
          'Dual Remediation (Live DOM + Disk)',
          `⚠️ <strong>Confirm Dual Remediation:</strong><br/>` +
          `1. Hot-patch <strong>${selectedCss.length} element(s)</strong> live in the current DOM session.<br/>` +
          `2. Write unified patch (${selectedFixes.length} issues) to 📁 <strong>${workspaceDirHandle.name}/goa-rover-fix.patch</strong>.`,
          async () => {
            let appliedLiveCount = 0;
            selectedCss.forEach(fix => {
              const targetEl = document.querySelector(fix.selector);
              if (targetEl) {
                targetEl.style.flexShrink = '0';
                targetEl.style.minWidth = 'fit-content';
                appliedLiveCount++;
              }
            });

            try {
              const unifiedDiff = selectedFixes.map(f => f.diff).join('\n');
              const patchFileHandle = await workspaceDirHandle.getFileHandle('goa-rover-fix.patch', { create: true });
              const writable = await patchFileHandle.createWritable();
              await writable.write(unifiedDiff);
              await writable.close();

              remediationBox.innerHTML = `<span style="color:#4ade80;">✅ Approved: Applied ${appliedLiveCount} live DOM fix(es) AND generated 'goa-rover-fix.patch' on disk!</span>`;
              store.pendingFixes = store.pendingFixes.filter(f => !selectedFixes.includes(f));
              renderFixQueue();
              awardRoI((25 * appliedLiveCount) + (30 * selectedFixes.length), (50 * appliedLiveCount) + (60 * selectedFixes.length));
            } catch (err) {
              alert('File write failed: ' + (err ? err.message : err));
            }
          }
        );
      };

      // Wire Unified Diff Copy button
      btnCopyDiff.onclick = () => {
        const selectedFixes = store.pendingFixes.filter(f => f.selected !== false);
        if (selectedFixes.length === 0) return;
        const unifiedDiff = selectedFixes.map(f => f.diff).join('\n');
        navigator.clipboard.writeText(unifiedDiff).then(() => {
          alert(`Unified diff (${selectedFixes.length} selected fixes) copied to clipboard!\n\n` + unifiedDiff);
        });
      };
    } else if (event.data.source === 'GOA_ROVER_NETWORK') {
      const net = event.data.payload;
      store.networkLogs.unshift(net);
      if (store.networkLogs.length > 20) store.networkLogs.pop();

      // Award RoI if payload anomaly / tamper mock applied
      if (net && net.tampered) {
        awardRoI(28, 60); // PAYLOAD_ANOMALY benchmark (30m - 2m = 28m)
      }
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
  }
})();
