# 📘 GoA_Rover: Step-by-Step Interactive Tutorial & User Guide

> **Welcome to GoA_Rover!**  
> This guide walks you through every single feature of the **GoA_Rover** Chrome Extension using the included interactive **Tutorial Playground** (`testbed.html`). Follow along step-by-step to see how GoA_Rover detects, diagnoses, and hot-patches issues directly inside your browser without needing DevTools, Postman, or Charles Proxy.

---

## 📑 Table of Contents
1. [0-to-Running in 60 Seconds](#1-0-to-running-in-60-seconds)
2. [Anatomy of the Interface](#2-anatomy-of-the-interface)
3. [Tutorial 1: Catching Main-Thread Freezes (LoAF Jank)](#tutorial-1-catching-main-thread-freezes-loaf-jank)
4. [Tutorial 2: Detecting & Attributing Layout Shifts (CLS)](#tutorial-2-detecting--attributing-layout-shifts-cls)
5. [Tutorial 3: Catching Silent JavaScript Crashes (TypeError)](#tutorial-3-catching-silent-javascript-crashes-typeerror)
6. [Tutorial 4: In-Situ Auto-Fixing Collapsed CSS (Live Hot-Patch)](#tutorial-4-in-situ-auto-fixing-collapsed-css-live-hot-patch)
7. [Tutorial 5: Network Tamper & Mocking (Zero-Postman)](#tutorial-5-network-tamper--mocking-zero-postman)
8. [Tutorial 6: In-Situ 30s Time-Travel Scrubber](#tutorial-6-in-situ-30s-time-travel-scrubber)
9. [Tutorial 7: Exporting Your Quantified RoI Standup Report](#tutorial-7-exporting-your-quantified-roi-standup-report)
10. [Quick Reference Cheatsheet](#quick-reference-cheatsheet)

---

## 1. 0-to-Running in 60 Seconds

### Step 1: Start the Local Test Server
Open your terminal in `C:\Users\bsank\GoA_Rover` and run:
```bash
npm run serve
```
You will see:
```text
[GoA_Rover] 🚀 Test server running at http://localhost:3000/tests/testbed.html
```

### Step 2: Load the Extension into Google Chrome
1. In Chrome, open a tab and navigate to: `chrome://extensions/`
2. In the top-right corner, toggle **Developer mode** to **ON**.
3. Click the **Load unpacked** button in the top-left corner.
4. Select the directory:
   ```text
   C:\Users\bsank\GoA_Rover\extension
   ```
5. *(If you already loaded it earlier, simply click the circular **⟳ Reload** button on the GoA_Rover card).*

### Step 3: Open the Tutorial Playground
Navigate to:
```text
http://localhost:3000/tests/testbed.html
```

Look at the **bottom-right corner** of the page—you will see the floating **GoA_Rover badge**!

---

## 2. Anatomy of the Interface

### The Floating In-Situ Badge (Bottom-Right)

```text
┌────────────────────────────────────────────────────────┐
│  🟢  |  ⚡ 0m this tab  |  Lvl 1 Scout                 │
└────────────────────────────────────────────────────────┘
```

| Element | Meaning |
| :--- | :--- |
| **Status Dot (🟢 / 🟡 / 🔴)** | **🟢 Green**: Clean page, all 6 perception observers active.<br/>**🟡 Yellow**: High latency, layout shift, or CSS defect detected.<br/>**🔴 Red**: Critical runtime crash, unhandled rejection, or blank shell. |
| **This Tab RoI (`⚡ 0m this tab`)** | Quantified net engineering minutes saved **on this active page/tab session**. Automatically ticks up (`+23m`, `+59m`, `+101m`) whenever an anomaly is caught or fixed in this tab. |
| **Hunter Rank (`Lvl 1 Scout`)** | Your gamified developer level. Levels up as you catch bugs and apply fixes! |
| **Hover Tooltip** | Hover your mouse over the pill at any time to see the full dual breakdown:<br/>• **⚡ This Tab**: +Xm saved (Y bugs)<br/>• **🏆 Lifetime**: Total cumulative minutes & hours saved across all tabs & days<br/>• **🎖️ Rank & XP**: Current hunter title and progression points. |

---

### The GoA_Rover Triage Card (Expanded Modal)

Clicking on the floating badge opens the **Bug Card / Triage Modal**:

```text
┌────────────────────────────────────────────────────────┐
│ 🛡️ GoA_Rover Triage Card                             ✕ │
├────────────────────────────────────────────────────────┤
│ ┌──────────────────────────┬─────────────────────────┐ │
│ │ THIS TAB SESSION         │ LIFETIME ROI            │ │
│ │ ⚡ 0m saved              │ 🏆 8,478m saved         │ │
│ │ 0 bugs caught            │ Cumulative across tabs  │ │
│ └──────────────────────────┴─────────────────────────┘ │
│ [ 🔄 Reset This Tab to 0m ]                            │
│                                                        │
│ COMPONENT BREADCRUMBS (DECOMPILED)                     │
│ [ BODY (Vanilla)                                     ] │
│                                                        │
│ IN-SITU 30S TIME-TRAVEL SCRUBBER                       │
│ -30s [═══════════════════════════════════════════●] Now│
│                                                        │
│ NETWORK TAMPER SANDBOX (ZERO-POSTMAN)                  │
│ ┌────────────────────────────────────────────────────┐ │
│ │ {"status": 200, "data": []}                        │ │
│ └────────────────────────────────────────────────────┘ │
│ [ Re-inject & Replay Payload ]                         │
│                                                        │
│ IN-SITU AUTO-REMEDIATION (CSS & SCRIPT FIXES)          │
│ ┌────────────────────────────────────────────────────┐ │
│ │ Diagnosis and proposed inline fix appears here...  │ │
│ └────────────────────────────────────────────────────┘ │
│ [ 🛠️ Auto-Fix in Live DOM ]                            │
│                                                        │
│ ACTIVE PERCEPTION STREAM                               │
│ ┌────────────────────────────────────────────────────┐ │
│ │ LOAF_JANK: Main-thread freeze of 120ms detected    │ │
│ │ CSS_LAYOUT_DEFECT: Flex child collapsed to 0px     │ │
│ └────────────────────────────────────────────────────┘ │
└────────────────────────────────────────────────────────┘
```

---

## 3. Tutorial 1: Catching Main-Thread Freezes (LoAF Jank)

### The Problem
Heavy computation or unoptimized loops freeze the browser UI, causing button clicks to feel unresponsive.

### How to Try It:
1. On the testbed page, find **"1. Perception Anomalies (M1)"**.
2. Click the red button: **"Trigger Long Animation Frame (120ms freeze)"**.
3. **What happens**:
   * The page synchronously freezes for 120ms.
   * GoA_Rover's Long Animation Frames (LoAF) observer catches the delay.
   * The floating badge indicator turns **🟡 Warn**.
   * Click the badge to open the Triage Card $\rightarrow$ look at **ACTIVE PERCEPTION STREAM**:
     ```text
     LOAF_JANK: Main-thread freeze of 120.0ms detected
     ```
   * Notice your RoI ticker incremented: **`⚡ 25m saved`**!

---

## 4. Tutorial 2: Detecting & Attributing Layout Shifts (CLS)

### The Problem
Images or dynamic banners load late without reserved dimensions, causing text and buttons to jump abruptly while the user is reading or clicking.

### How to Try It:
1. On the testbed page, click **"Trigger Layout Shift (CLS)"**.
2. **What happens**:
   * A yellow warning block suddenly injects above the existing elements, shifting the page downward.
   * The Layout Instability observer records the exact shift score ($>0.05$).
   * Open the Triage Card $\rightarrow$ the stream shows:
     ```text
     LAYOUT_SHIFT: Unexpected Layout Shift detected (0.280)
     ```
   * GoA_Rover isolates the exact element that moved.

---

## 5. Tutorial 3: Catching Silent JavaScript Crashes (TypeError)

### The Problem
An API returns `data: null` instead of an array. In legacy code: `data.items.map(...)` throws `TypeError: Cannot read properties of undefined (reading 'map')`. The script completely crashes silently, leaving a dead UI.

### How to Try It:
1. Scroll down to **"3. Legacy CSS & Script Errors"**.
2. Click the red button: **"💥 Trigger Uncaught TypeError (undefined.map)"**.
3. **What happens**:
   * The floating badge instantly turns **🔴 Red (Error)**.
   * Your RoI ticker increments by **+42m saved** (catching a critical crash).
   * Open the Triage Card $\rightarrow$ look at **IN-SITU AUTO-REMEDIATION**:
     ```text
     Script Error Trapped:
     Cannot read properties of undefined (reading 'map')
     Suggested Guard: (data || []).map(...) or data?.prop
     ```
   * GoA_Rover automatically caught the unhandled crash and gave you the exact code fix!

---

## 6. Tutorial 4: In-Situ Auto-Remediation & 1-Shot Multi-Issue Fix

### The Problem
A legacy page has **multiple bugs at once**—for example, two collapsed navigation buttons with `flex-shrink: 1` squishing down to 0px, and an uncaught script `TypeError` in legacy event handlers. Fixing them one-by-one by hand takes considerable time.

### How to Try It (Batch 1-Shot Auto-Fix):
1. Under **"3. Legacy CSS & Script Errors"**, click the red button:
   * **`[ 💥💥 Trigger Multiple Issues at Once (Batch Demo) ]`**
2. **What happens**:
   * Two legacy buttons collapse to 0px width simultaneously.
   * A script `TypeError` fires in the background.
   * The GoA_Rover badge turns **🔴 Red (Error)**.
3. Open the **GoA_Rover Triage Card**:
   * Look at **IN-SITU AUTO-REMEDIATION**:
     ```text
     ⚠️ 3 Issue(s) Detected on Page:
     #1 CSS Collapse: #flex-child-collapsed → flex-shrink: 0; min-width: fit-content;
     #2 CSS Collapse: #flex-child-collapsed-2 → flex-shrink: 0; min-width: fit-content;
     #3 Script Crash: testbed.html:206 → TypeError: Cannot read properties of undefined
     ```
   * Notice the three batch remediation buttons light up:
     * **`[ ✨ Auto-Fix 2 CSS Issue(s) in Live DOM (1-Shot) ]`**
     * **`[ 💾 1-Click Patch All (3) to Disk ]`**
     * **`[ 📋 Copy Unified Diff (3) ]`**

### Two Ways to Resolve All Issues in One Shot:

#### Way 1: 1-Shot Live DOM Hot-Patch (Instant Visual Repair)
* Click **`[ ✨ Auto-Fix 2 CSS Issue(s) in Live DOM (1-Shot) ]`**.
* Both collapsed elements instantly expand to full width in real time without refreshing!
* Cumulative RoI and XP are awarded in one go.

#### Way 2: 1-Click Patch All to Disk (Permanent Source Code Patch)
1. Click **`[Connect Project Folder]`** in the card and select your local repo root directory using Chrome's native File System Access API.
2. Click **`[ 💾 1-Click Patch All (3) to Disk ]`**.
3. GoA_Rover compiles a unified patch covering all CSS fixes and script error defensive guards, then directly writes `goa-rover-fix.patch` into your repo root!
4. Apply it in terminal whenever you want via:
   ```bash
   git apply goa-rover-fix.patch
   ```
5. Or click **`[ 📋 Copy Unified Diff (3) ]`** to copy the full combined patch straight to your clipboard.

---

## 7. Tutorial 5: Network Tamper & Mocking (Zero-Postman)

### The Problem
Your frontend is broken because a backend endpoint is returning bad data or a 404/500 error. Traditionally, you'd have to stop and set up Mockoon, Charles Proxy, or Postman to test if a mock response fixes the UI.

### How to Try It:
1. Under **"2. Network Proxy & Tamper Sandbox"**, click **"Fetch Broken API"**.
   * The event stream shows a network error from `https://jsonplaceholder.typicode.com/broken-endpoint`.
2. Open the **GoA_Rover Triage Card**.
3. In the **NETWORK TAMPER SANDBOX** textarea, paste this mock response:
   ```json
   {
     "status": 200,
     "body": {
       "id": 999,
       "title": "🎉 Fixed in-situ by GoA_Rover Tamper Sandbox!",
       "completed": true
     }
   }
   ```
4. Click the blue button: **"Re-inject & Replay Payload"**.
   * An alert confirms: *"Mock response injected into page interceptor!"*
5. Now, on the testbed page, click **"Fetch Broken API"** again!
   * **Result**: Instead of failing, the network interceptor intercepts the call and serves your mocked JSON immediately!

---

## 8. Tutorial 6: In-Situ 30s Time-Travel Scrubber

### The Problem
A user clicked through 3 forms, triggered a crash, and the form reset. You lost all the state and have to re-type everything to reproduce it.

### How to Try It:
1. Perform a few actions on the testbed page (click buttons, type text).
2. Open the **GoA_Rover Triage Card**.
3. Look at the slider:
   ```text
   -30s [═══════════════════════════════════════════●] Now
   ```
4. Drag the slider to the left (e.g. to **`-15s`** or **`-25s`**).
   * The label changes from `Now` to `-15s`.
   * GoA_Rover's 30-second rolling buffer holds the record of user clicks, inputs, and DOM changes over that time window, allowing inspection of state right before the anomaly occurred.

---

## 9. Tutorial 7: Exporting Your Quantified RoI Standup Report

### The Problem
You spent hours fixing bugs, but engineering managers don't see the quantified value of inner-loop debugging.

### How to Try It:
1. Look at your Chrome browser toolbar in the **top-right corner**.
2. Click the **GoA_Rover extension icon** (or click the puzzle piece and select GoA_Rover).
3. The popup opens showing your **Scorecard**:
   * **Real-Time RoI Unlocked**: `⚡ 92m saved ($122.67)`
   * **Hunter Rank & XP**: `Lvl 1 Scout (150 XP)`
4. Click the blue button: **"Export Standup Report"**.
   * A confirmation appears: *"Report copied to clipboard!"*
5. Paste (`Ctrl + V`) into any text editor or Slack:
   ```markdown
   # GoA_Rover Daily Standup Report
   - **Minutes Saved**: 92 mins
   - **Value Unlocked**: $122.67
   - **Total XP Earned**: 150 XP
   - Generated on: 10/7/2026, 11:15:00 PM
   ```

---

## 10. Quick Reference Cheatsheet

| If you see... | What it means | What to do in GoA_Rover |
| :--- | :--- | :--- |
| **🟢 Green Dot** | Page is clean and observers active | Everything is working normally |
| **🟡 Yellow Dot** | Layout shift, slow LoAF, or CSS defect | Open card to view culprit element or frame freeze |
| **🔴 Red Dot** | JavaScript TypeError or blank shell | Open card to view stack trace and suggested guard |
| **Collapsed 0px Element** | Flex child squished by flex-shrink | Open card $\rightarrow$ Click **"🛠️ Auto-Fix in Live DOM"** |
| **Broken API Endpoint** | Backend returns unexpected payload | Open card $\rightarrow$ Paste mock JSON $\rightarrow$ Click **"Re-inject & Replay Payload"** |
| **Reset Demo Tab to 0** | Testing or demonstrating to teammates | Open card $\rightarrow$ Click **"🔄 Reset This Tab to 0m"** (wipes tab count to 0 without losing Lifetime Rank) |
| **Check Overall Score** | See cumulative hours across all tabs | Open card $\rightarrow$ Check **"LIFETIME ROI"** in the top scorecard banner |
| **Need to report value** | Standup or sprint review | Click extension icon $\rightarrow$ Click **"Export Standup Report"** |
