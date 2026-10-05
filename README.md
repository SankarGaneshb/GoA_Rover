# GoA Rover (Green-on-Arrival) 🚀

> **Autonomous Web Perception, Runtime Triage & Self-Healing Browser Agent**

GoA Rover monitors web application runtime health in real-time using modern living browser standards (Paint Timing, Long Animation Frames, Layout Stability, Mutation Observers, and Error Interception). It moves beyond passive status codes (`200 OK`) to verify whether pages are genuinely **Green on Arrival**, diagnosing and auto-remediating runtime failures with AI.

---

## 🌟 Key Capabilities

1. **Perception Engine (Beyond HTTP 200)**:
   - **Paint Timing**: Validates First Contentful Paint (FCP) and Largest Contentful Paint (LCP).
   - **White Screen Watchdog**: Detects blank DOM mount roots (`#root`, `#app`, `#__next`) with zero painted child nodes.
   - **Main Thread Health**: Flags frozen threads using Long Animation Frames (`LoAF`) and Long Tasks.
   - **Hydration & Mutation Health**: Catches React/Vue/SSR hydration wipes and infinite re-render loops.
   - **Asset Completeness**: Verifies critical CSS, WebAssembly, and font loading (`document.fonts.ready`).

2. **Cause $\rightarrow$ Effect Causality Stitching**:
   - Links network failures (`/api/...`) $\rightarrow$ uncaught JavaScript exceptions $\rightarrow$ visual DOM collapse in a single timeline.

3. **AI Autonomous Remediation**:
   - Generates unified diffs and plain-English remediation advice for instant 1-click bug resolution.

---

## 📁 Repository Structure

```
GoA_Rover/
├── src/               # Chrome Extension / Browser Agent source
│   ├── background/    # Manifest V3 service worker
│   ├── content/       # Perception engine & browser metric observers
│   ├── popup/         # HUD triage popup UI
│   └── solver/        # AI causality & diff remediation engine
├── package.json       # Project configuration
└── README.md
```

---

## 🛠️ Getting Started

```bash
# Clone the repository
git clone https://github.com/SankarGaneshb/GoA_Rover.git

# Navigate to project
cd GoA_Rover
```

---

## 📄 License
MIT License
