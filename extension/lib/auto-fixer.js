/**
 * GoA_Rover - Layer 3: In-Situ Auto-Fixer & Remediation Engine
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
     * Applies a live in-situ CSS fix directly to an affected DOM element
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
          message: `In-situ live hot-patch applied successfully: ${JSON.stringify(appliedStyles)}`
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
  }

  return AutoFixer;
});
