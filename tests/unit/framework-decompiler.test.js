const FrameworkDecompiler = require('../../extension/injected/framework-decompiler');

describe('Layer 3: FrameworkDecompiler', () => {
  let decompiler;

  beforeEach(() => {
    decompiler = new FrameworkDecompiler();
  });

  test('decompiles native vanilla DOM element safely', () => {
    const div = document.createElement('div');
    div.id = 'container';
    div.className = 'main-layout';
    div.setAttribute('data-role', 'admin');

    const result = decompiler.decompile(div);
    expect(result.framework).toBe('vanilla');
    expect(result.componentName).toBe('DIV');
    expect(result.breadcrumbs).toEqual(['DIV']);
    expect(result.props.id).toBe('container');
    expect(result.props['data-role']).toBe('admin');
  });

  test('handles null, undefined or non-node objects gracefully without throwing', () => {
    expect(decompiler.decompile(null).framework).toBe('vanilla');
    expect(decompiler.decompile(undefined).framework).toBe('vanilla');
    expect(decompiler.decompile({}).framework).toBe('vanilla');
  });

  test('decompiles React Fiber element with hierarchy and props', () => {
    const div = document.createElement('div');

    // Simulate Fiber tree: RootApp -> Dashboard -> UserCard
    const userCardFiber = {
      type: { name: 'UserCard', displayName: 'UserCard' },
      memoizedProps: { userId: 42, role: 'developer' },
      memoizedState: { activeTab: 'overview' },
      return: {
        type: { name: 'Dashboard' },
        return: {
          type: { name: 'RootApp' },
          return: null
        }
      }
    };

    div['__reactFiber$abc123'] = userCardFiber;

    const result = decompiler.decompile(div);
    expect(result.framework).toBe('react');
    expect(result.componentName).toBe('UserCard');
    expect(result.breadcrumbs).toEqual(['RootApp', 'Dashboard', 'UserCard']);
    expect(result.props.userId).toBe(42);
    expect(result.props.role).toBe('developer');
    expect(result.state.activeTab).toBe('overview');
  });

  test('decompiles Vue 3 component tree via __vueParentComponent', () => {
    const div = document.createElement('div');

    div.__vueParentComponent = {
      type: { name: 'OrderSummary' },
      props: { total: 120.5 },
      data: { isPaid: false },
      parent: {
        type: { name: 'CheckoutView' },
        parent: null
      }
    };

    const result = decompiler.decompile(div);
    expect(result.framework).toBe('vue3');
    expect(result.componentName).toBe('OrderSummary');
    expect(result.breadcrumbs).toEqual(['CheckoutView', 'OrderSummary']);
    expect(result.props.total).toBe(120.5);
    expect(result.state.isPaid).toBe(false);
  });

  test('decompiles Vue 2 component tree via __vue__', () => {
    const div = document.createElement('div');

    div.__vue__ = {
      $options: { name: 'LegacyCart' },
      $props: { count: 3 },
      $data: { expanded: true },
      $parent: null
    };

    const result = decompiler.decompile(div);
    expect(result.framework).toBe('vue2');
    expect(result.componentName).toBe('LegacyCart');
    expect(result.breadcrumbs).toEqual(['LegacyCart']);
    expect(result.props.count).toBe(3);
    expect(result.state.expanded).toBe(true);
  });

  test('decompiles Angular component via window.ng.getComponent', () => {
    const div = document.createElement('div');

    class AnalyticsPanel {
      constructor() {
        this.chartType = 'line';
      }
    }

    global.window.ng = {
      getComponent: jest.fn().mockReturnValue(new AnalyticsPanel())
    };

    const result = decompiler.decompile(div);
    expect(result.framework).toBe('angular');
    expect(result.componentName).toBe('AnalyticsPanel');
    expect(result.props.chartType).toBe('line');

    delete global.window.ng;
  });

  test('safely serializes circular references and deep objects without crashing', () => {
    const div = document.createElement('div');

    const circularObj = { a: 1 };
    circularObj.self = circularObj;

    div['__reactFiber$test'] = {
      type: { name: 'CircularComponent' },
      memoizedProps: circularObj,
      return: null
    };

    const result = decompiler.decompile(div);
    expect(result.componentName).toBe('CircularComponent');
    expect(result.props.self).toBe('[Circular]');
  });
});
