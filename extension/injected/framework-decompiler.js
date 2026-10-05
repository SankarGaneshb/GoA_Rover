/**
 * GoA_Rover - Layer 3: Universal Framework Component Decompiler
 * Introspects DOM elements to extract component hierarchy, props, and state
 * for React (Fiber), Vue (2 & 3), and Angular without requiring external devtools.
 */

(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.FrameworkDecompiler = factory();
    if (typeof window !== 'undefined' && !window.__GOA_ROVER_DECOMPILER__) {
      window.__GOA_ROVER_DECOMPILER__ = new root.FrameworkDecompiler();
    }
  }
})(typeof self !== 'undefined' ? self : this, function () {

  class FrameworkDecompiler {
    constructor() {
      console.log('[GoA_Rover] 🌲 Layer 3: Framework Decompiler ready');
    }

    /**
     * Inspect any DOM node and return normalized framework metadata
     * @param {Element} domNode
     * @returns {Object} { framework, componentName, breadcrumbs, props, state }
     */
    decompile(domNode) {
      if (!domNode || typeof domNode !== 'object' || !domNode.nodeType) {
        return {
          framework: 'vanilla',
          componentName: 'HTMLNode',
          breadcrumbs: ['DOM'],
          props: {},
          state: {}
        };
      }

      try {
        // 1. Try React Fiber
        const reactInfo = this.inspectReact(domNode);
        if (reactInfo) return reactInfo;

        // 2. Try Vue (2 or 3)
        const vueInfo = this.inspectVue(domNode);
        if (vueInfo) return vueInfo;

        // 3. Try Angular
        const ngInfo = this.inspectAngular(domNode);
        if (ngInfo) return ngInfo;

        // 4. Fallback to native DOM
        return {
          framework: 'vanilla',
          componentName: domNode.tagName || 'UNKNOWN',
          breadcrumbs: [domNode.tagName || 'UNKNOWN'],
          props: this.extractDOMAttributes(domNode),
          state: {}
        };
      } catch (err) {
        return {
          framework: 'unknown',
          componentName: domNode.tagName || 'ERROR',
          breadcrumbs: ['ERROR'],
          props: {},
          state: {},
          error: err ? err.message : 'Decompile error'
        };
      }
    }

    /** React Fiber Introspection */
    inspectReact(domNode) {
      const fiberKey = Object.keys(domNode).find(
        (key) => key.startsWith('__reactFiber$') || key.startsWith('__reactInternalInstance$')
      );

      if (!fiberKey) return null;

      let fiber = domNode[fiberKey];
      if (!fiber) return null;

      const breadcrumbs = [];
      let current = fiber;
      let targetComponent = null;

      while (current) {
        const name = this.resolveReactComponentName(current);
        if (name && name !== 'Fragment' && !name.startsWith('styled.')) {
          breadcrumbs.unshift(name);
          if (!targetComponent) {
            targetComponent = current;
          }
        }
        current = current.return;
      }

      const componentName = targetComponent ? this.resolveReactComponentName(targetComponent) : (domNode.tagName || 'ReactComponent');

      return {
        framework: 'react',
        componentName: componentName || 'ReactComponent',
        breadcrumbs: breadcrumbs.length > 0 ? breadcrumbs : [componentName],
        props: targetComponent && targetComponent.memoizedProps ? this.safeSerialize(targetComponent.memoizedProps) : {},
        state: targetComponent && targetComponent.memoizedState ? this.safeSerialize(targetComponent.memoizedState) : {}
      };
    }

    resolveReactComponentName(fiber) {
      if (!fiber || !fiber.type) return null;
      if (typeof fiber.type === 'string') return fiber.type; // host tag like 'div'
      if (fiber.type.displayName) return fiber.type.displayName;
      if (fiber.type.name) return fiber.type.name;
      if (fiber.elementType && fiber.elementType.name) return fiber.elementType.name;
      return null;
    }

    /** Vue 2 & 3 Introspection */
    inspectVue(domNode) {
      // Vue 3 instance
      if (domNode.__vueParentComponent) {
        const vm = domNode.__vueParentComponent;
        const name = (vm.type && (vm.type.name || vm.type.__name)) || 'VueComponent';
        const breadcrumbs = [name];

        let parent = vm.parent;
        while (parent) {
          const pName = (parent.type && (parent.type.name || parent.type.__name)) || 'VueComponent';
          breadcrumbs.unshift(pName);
          parent = parent.parent;
        }

        return {
          framework: 'vue3',
          componentName: name,
          breadcrumbs,
          props: vm.props ? this.safeSerialize(vm.props) : {},
          state: vm.data ? this.safeSerialize(vm.data) : {}
        };
      }

      // Vue 2 instance
      if (domNode.__vue__) {
        const vm = domNode.__vue__;
        const name = (vm.$options && (vm.$options.name || vm.$options._componentTag)) || 'Vue2Component';
        const breadcrumbs = [name];

        let parent = vm.$parent;
        while (parent) {
          const pName = (parent.$options && (parent.$options.name || parent.$options._componentTag)) || 'Vue2Component';
          breadcrumbs.unshift(pName);
          parent = parent.$parent;
        }

        return {
          framework: 'vue2',
          componentName: name,
          breadcrumbs,
          props: vm.$props ? this.safeSerialize(vm.$props) : {},
          state: vm.$data ? this.safeSerialize(vm.$data) : {}
        };
      }

      return null;
    }

    /** Angular Introspection */
    inspectAngular(domNode) {
      if (typeof window !== 'undefined' && window.ng && typeof window.ng.getComponent === 'function') {
        const comp = window.ng.getComponent(domNode);
        if (comp) {
          const name = comp.constructor ? comp.constructor.name : 'NgComponent';
          return {
            framework: 'angular',
            componentName: name,
            breadcrumbs: [name],
            props: this.safeSerialize(comp),
            state: {}
          };
        }
      }
      return null;
    }

    extractDOMAttributes(domNode) {
      const attrs = {};
      if (domNode.attributes) {
        for (let i = 0; i < domNode.attributes.length; i++) {
          const a = domNode.attributes[i];
          attrs[a.name] = a.value;
        }
      }
      return attrs;
    }

    safeSerialize(obj, depth = 0, seen = new WeakSet()) {
      if (depth > 2) return '[Deep Object]';
      if (obj === null || obj === undefined) return obj;
      if (typeof obj !== 'object') return obj;

      if (seen.has(obj)) return '[Circular]';
      seen.add(obj);

      const copy = Array.isArray(obj) ? [] : {};
      for (const key of Object.keys(obj)) {
        if (key.startsWith('_') || key.startsWith('$')) continue; // Skip internal props
        try {
          const val = obj[key];
          if (typeof val === 'function') {
            copy[key] = '[Function]';
          } else if (typeof val === 'object' && val !== null) {
            copy[key] = this.safeSerialize(val, depth + 1, seen);
          } else {
            copy[key] = val;
          }
        } catch (e) {
          copy[key] = '[Unreadable]';
        }
      }
      return copy;
    }
  }

  return FrameworkDecompiler;
});
