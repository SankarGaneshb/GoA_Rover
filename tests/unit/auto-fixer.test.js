const AutoFixer = require('../../extension/lib/auto-fixer');

describe('Layer 3: AutoFixer Engine', () => {
  let fixer;

  beforeEach(() => {
    fixer = new AutoFixer();
  });

  describe('Script Error Diagnosis', () => {
    test('diagnoses undefined property access reading map with array guard', () => {
      const errorInfo = {
        message: "Cannot read properties of undefined (reading 'map')",
        filename: 'src/components/UserList.js',
        lineno: 42
      };

      const result = fixer.diagnoseScriptError(errorInfo);
      expect(result.pattern).toBe('NULL_POINTER_EXCEPTION');
      expect(result.suggestedCode).toContain('(data || []).map(...)');
      expect(result.diffSnippet).toContain('(data || []).map');
      expect(result.targetFile).toBe('src/components/UserList.js');
      expect(result.targetLine).toBe(42);
    });

    test('diagnoses generic undefined property with optional chaining', () => {
      const errorInfo = {
        message: "Cannot read properties of undefined (reading 'username')",
        filename: 'src/legacy.js'
      };

      const result = fixer.diagnoseScriptError(errorInfo);
      expect(result.pattern).toBe('NULL_POINTER_EXCEPTION');
      expect(result.suggestedCode).toBe('data?.username');
    });

    test('diagnoses x is not a function with typeof check', () => {
      const errorInfo = {
        message: 'calculateTotal is not a function',
        filename: 'src/checkout.js'
      };

      const result = fixer.diagnoseScriptError(errorInfo);
      expect(result.pattern).toBe('NOT_A_FUNCTION');
      expect(result.suggestedCode).toContain("typeof calculateTotal === 'function'");
    });

    test('handles empty or generic runtime errors gracefully', () => {
      const result = fixer.diagnoseScriptError({});
      expect(result.pattern).toBe('GENERIC_RUNTIME_ERROR');
      expect(result.diffSnippet).toContain('try');
    });
  });

  describe('Live In-Situ CSS Remediation', () => {
    test('applies live flex_collapse hot-patch directly to DOM element', () => {
      const div = document.createElement('div');
      div.style.flexShrink = '1';

      const res = fixer.applyLiveCSSFix(div, 'flex_collapse');
      expect(res.success).toBe(true);
      expect(div.style.flexShrink).toBe('0');
      expect(div.style.minWidth).toBe('fit-content');
      expect(fixer.remediationHistory.length).toBe(1);
    });

    test('applies live overflow_clipping hot-patch with ellipsis and nowrap', () => {
      const span = document.createElement('span');

      const res = fixer.applyLiveCSSFix(span, 'overflow_clipping');
      expect(res.success).toBe(true);
      expect(span.style.textOverflow).toBe('ellipsis');
      expect(span.style.whiteSpace).toBe('nowrap');
    });

    test('applies live zindex_buried elevation', () => {
      const modal = document.createElement('div');

      const res = fixer.applyLiveCSSFix(modal, 'zindex_buried');
      expect(res.success).toBe(true);
      expect(modal.style.zIndex).toBe('9999');
    });

    test('handles invalid DOM target safely without throwing', () => {
      const res = fixer.applyLiveCSSFix(null, 'flex_collapse');
      expect(res.success).toBe(false);
      expect(res.error).toBe('Invalid DOM node target');
    });
  });

  describe('Permanent CSS Diff Generation', () => {
    test('generates clean diffs for flex_collapse and overflow_clipping', () => {
      const flexDiff = fixer.generateCSSDiff('.legacy-btn', 'flex_collapse');
      expect(flexDiff).toContain('.legacy-btn {');
      expect(flexDiff).toContain('+  flex-shrink: 0;');

      const overflowDiff = fixer.generateCSSDiff('.user-title', 'overflow_clipping');
      expect(overflowDiff).toContain('+  text-overflow: ellipsis;');

      const zIndexDiff = fixer.generateCSSDiff('#popup-modal', 'zindex_buried');
      expect(zIndexDiff).toContain('+  z-index: 9999;');
    });
  });
});
