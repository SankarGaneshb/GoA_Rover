/**
 * GoA_Rover - Layer 3: On-the-Spot Auto-Fixer & Remediation Engine
 * Diagnoses and automatically generates live DOM repairs and unified Git diffs
 * for legacy CSS layout breaks and unhandled JavaScript runtime exceptions.
 */

(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.AutoFixer = factory();
    if (typeof window !== 'undefined' && !window.__GOA_ROVER_AUTO_FIXER__) {
      window.__GOA_ROVER_AUTO_FIXER__ = new root.AutoFixer();
    }
  }
})(typeof self !== 'undefined' ? self : this, function () {

  class AutoFixer {
    constructor() {
      this.remediationHistory = [];
    }

    /**
     * Diagnoses a JavaScript runtime error and generates proposed code fixes
     * @param {Object} errorInfo { message, stack, filename, lineno }
     * @returns {Object} { diagnostic, suggestedCode, diffSnippet, pattern }
     */
    diagnoseScriptError(errorInfo = {}) {
      const msg = (errorInfo.message || '').toLowerCase();
      const filename = errorInfo.filename || 'unknown.js';
      const lineno = errorInfo.lineno || 1;

      // 1. Cannot read properties of undefined / null reading 'map' / 'length' / 'forEach'
      if (msg.includes('cannot read properties of undefined') || msg.includes('cannot read property') || msg.includes('is not defined') || msg.includes('null is not an object')) {
        let member = 'prop';
        const match = errorInfo.message.match(/reading ['"]?([^'"]+)['"]?/i) || errorInfo.message.match(/cannot read property ['"]?([^'"]+)['"]?/i);
        if (match && match[1]) {
          member = match[1];
        }

        const isArrayCall = ['map', 'foreach', 'filter', 'reduce', 'length', 'slice'].includes(member.toLowerCase());
        const suggestedFix = isArrayCall
          ? `(data || []).${member}(...)`
          : `data?.${member}`;

        return {
          pattern: 'NULL_POINTER_EXCEPTION',
          diagnostic: `Accessing '${member}' on undefined/null target. Common in legacy apps before API payload resolves.`,
          suggestedCode: suggestedFix,
          diffSnippet: `- return data.${member};\n+ return (data || []).${member}; // or data?.${member}`,
          targetFile: filename,
          targetLine: lineno
        };
      }

      // 2. Uncaught TypeError: x is not a function
      if (msg.includes('is not a function')) {
        const fnMatch = errorInfo.message.match(/([a-zA-Z0-9_$]+) is not a function/i);
        const fnName = fnMatch ? fnMatch[1] : 'fn';

        return {
          pattern: 'NOT_A_FUNCTION',
          diagnostic: `'${fnName}' was invoked as a function but evaluated to undefined or non-function.`,
          suggestedCode: `typeof ${fnName} === 'function' ? ${fnName}() : undefined`,
          diffSnippet: `- ${fnName}();\n+ if (typeof ${fnName} === 'function') ${fnName}();`,
          targetFile: filename,
          targetLine: lineno
        };
      }

      // Generic fallback
      return {
        pattern: 'GENERIC_RUNTIME_ERROR',
        diagnostic: `Unhandled runtime error: ${errorInfo.message || 'Script failure'}`,
        suggestedCode: `try { /* code */ } catch (err) { console.warn(err); }`,
        diffSnippet: `+ try {\n    // protected legacy call\n+ } catch (err) { console.warn('GoA_Rover protected:', err); }`,
        targetFile: filename,
        targetLine: lineno
      };
    }

    /**
     * Applies a live on-the-spot CSS fix directly to an affected DOM element
     * @param {Element} domNode
     * @param {String} defectType 'flex_collapse' | 'overflow_clipping' | 'zindex_buried'
     * @returns {Object} { success, appliedStyles, message }
     */
    applyLiveCSSFix(domNode, defectType) {
      if (!domNode || typeof domNode !== 'object' || !domNode.style) {
        return { success: false, error: 'Invalid DOM node target' };
      }

      try {
        const appliedStyles = {};

        if (defectType === 'flex_collapse') {
          domNode.style.flexShrink = '0';
          domNode.style.minWidth = 'fit-content';
          appliedStyles.flexShrink = '0';
          appliedStyles.minWidth = 'fit-content';
        } else if (defectType === 'overflow_clipping') {
          domNode.style.textOverflow = 'ellipsis';
          domNode.style.whiteSpace = 'nowrap';
          appliedStyles.textOverflow = 'ellipsis';
          appliedStyles.whiteSpace = 'nowrap';
        } else if (defectType === 'zindex_buried') {
          domNode.style.zIndex = '9999';
          domNode.style.position = domNode.style.position || 'relative';
          appliedStyles.zIndex = '9999';
        } else {
          // Generic responsive rescue
          domNode.style.maxWidth = '100%';
          domNode.style.boxSizing = 'border-box';
          appliedStyles.maxWidth = '100%';
        }

        const logEntry = {
          timestamp: Date.now(),
          defectType,
          appliedStyles,
          tagName: domNode.tagName
        };
        this.remediationHistory.push(logEntry);

        return {
          success: true,
          appliedStyles,
          message: `On-the-spot live hot-patch applied successfully: ${JSON.stringify(appliedStyles)}`
        };
      } catch (err) {
        return {
          success: false,
          error: err ? err.message : 'Failed to apply inline style'
        };
      }
    }

    /**
     * Generates a permanent CSS diff for copy-pasting or direct workspace saving
     */
    generateCSSDiff(selector, defectType) {
      const cleanSelector = selector || '.legacy-target';
      if (defectType === 'flex_collapse') {
        return `${cleanSelector} {\n+  flex-shrink: 0;\n+  min-width: 0;\n}`;
      } else if (defectType === 'overflow_clipping') {
        return `${cleanSelector} {\n+  text-overflow: ellipsis;\n+  white-space: nowrap;\n}`;
      } else if (defectType === 'zindex_buried') {
        return `${cleanSelector} {\n+  position: relative;\n+  z-index: 9999;\n}`;
      }
      return `${cleanSelector} {\n+  box-sizing: border-box;\n}`;
    }

    /**
     * Diagnoses a performance anomaly (LoAF freeze or DOM churn) and generates
     * framework-specific optimization recommendations and diffs.
     * @param {Object} event { type, severity, details }
     * @param {Object} context { framework, isStreamlit, port, url }
     * @returns {Object} { pattern, diagnostic, recommendations, diffSnippet, suggestedCode }
     */
    diagnosePerformanceAnomaly(event = {}, context = {}) {
      const type = event.type || 'loaf_jank';
      const details = event.details || {};
      const duration = details.duration ? details.duration.toFixed(1) : (details.blockingDuration ? details.blockingDuration.toFixed(1) : '50+');
      const isStreamlit = context.isStreamlit || context.port === '8501' || context.framework === 'streamlit' || (typeof location !== 'undefined' && location.port === '8501');
      const isReact = context.framework === 'react' || (!isStreamlit && context.framework === 'react');

      // 1. DOM Churn
      if (type === 'dom_churn') {
        const count = details.mutationsCount || 150;
        return {
          pattern: 'DOM_CHURN_THRASHING',
          title: `DOM Churn Optimization (${count} mutations/sec)`,
          diagnostic: `High DOM churn velocity detected. Mutating the DOM repeatedly causes excessive layout thrashing and high CPU usage.`,
          recommendations: [
            'Batch element insertions using DocumentFragment instead of appending nodes one-by-one.',
            'Wrap rapid DOM writes inside requestAnimationFrame() or throttle mutation frequencies.',
            'Avoid reading layout properties (offsetWidth, clientHeight) immediately after writing styles.'
          ],
          suggestedCode: `const fragment = document.createDocumentFragment();\n// Append to fragment first, then append fragment once to DOM`,
          diffSnippet: `/* DOM Mutation Batching Optimization */\n- items.forEach(item => container.appendChild(createNode(item)));\n+ const fragment = document.createDocumentFragment();\n+ items.forEach(item => fragment.appendChild(createNode(item)));\n+ container.appendChild(fragment);`
        };
      }

      // 2. LoAF Jank in Streamlit
      if (isStreamlit) {
        return {
          pattern: 'STREAMLIT_LOAF_FREEZE',
          title: `Streamlit Main-Thread Freeze (${duration}ms)`,
          diagnostic: `Streamlit payload processing blocked the browser thread for ${duration}ms. Common causes: rendering large unpaginated DataFrames, uncached function reruns, or dense charts.`,
          recommendations: [
            'Limit or paginate large tables: use st.dataframe(df.head(100)) or st.data_editor with pagination.',
            'Cache expensive data queries or computations using @st.cache_data or @st.cache_resource.',
            'Downsample heavy time-series or scatter plot datasets before passing to Altair/Plotly.'
          ],
          suggestedCode: `@st.cache_data\ndef load_data():\n    return fetch_expensive_dataset()`,
          diffSnippet: `### Streamlit Performance Optimization Patch\n+ @st.cache_data\n+ def load_data():\n+     return fetch_expensive_dataset()\n\n- st.dataframe(large_df) # Freezes DOM with massive row count\n+ st.dataframe(large_df.head(100)) # Paginate/slice to unblock main thread`
        };
      }

      // 3. LoAF Jank in React
      if (isReact) {
        return {
          pattern: 'REACT_LOAF_FREEZE',
          title: `React Component Re-render Freeze (${duration}ms)`,
          diagnostic: `Synchronous component reconciliation or hook execution blocked the browser thread for ${duration}ms.`,
          recommendations: [
            'Wrap expensive computations inside useMemo(() => compute(data), [data]).',
            'Virtualize large rendered lists using react-window or @tanstack/react-virtual.',
            'Wrap non-urgent state updates with React.useTransition() or startTransition.'
          ],
          suggestedCode: `const memoized = useMemo(() => heavyComputation(data), [data]);`,
          diffSnippet: `// React Optimization Patch\n- const result = expensiveComputation(items);\n+ const result = useMemo(() => expensiveComputation(items), [items]);`
        };
      }

      // 4. LoAF Jank in Generic/Vanilla JS
      return {
        pattern: 'SYNCHRONOUS_LOOP_FREEZE',
        title: `Main-Thread Task Freeze (${duration}ms)`,
        diagnostic: `A synchronous JavaScript task or loop blocked the browser main thread for ${duration}ms, degrading UI responsiveness.`,
        recommendations: [
          'Chunk long computations across animation frames using scheduler.yield() or setTimeout(..., 0).',
          'Offload heavy computations or data parsing to a dedicated Web Worker.',
          'Debounce or throttle frequent user input handlers.'
        ],
        suggestedCode: `if (performance.now() - start > 16) await scheduler.yield();`,
        diffSnippet: `// Main-Thread Chunking Optimization\n- for (const item of dataset) { process(item); }\n+ for (const item of dataset) {\n+   process(item);\n+   if (performance.now() - lastYield > 16) await new Promise(r => setTimeout(r, 0));\n+ }`
      };
    }
  }

  return AutoFixer;
});
