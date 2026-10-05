const NetworkInterceptor = require('../../extension/injected/network-interceptor');

describe('Layer 2: NetworkInterceptor', () => {
  let interceptor;
  let originalFetch;
  let originalXHROpen;
  let originalXHRSend;

  beforeEach(() => {
    originalFetch = global.window.fetch;
    originalXHROpen = XMLHttpRequest.prototype.open;
    originalXHRSend = XMLHttpRequest.prototype.send;

    // Standard Mock Response
    global.Response = jest.fn().mockImplementation((body, init = {}) => ({
      status: init.status !== undefined ? init.status : 200,
      statusText: init.statusText || 'OK',
      headers: init.headers,
      clone: () => ({
        text: () => Promise.resolve(body)
      }),
      text: () => Promise.resolve(body)
    }));

    global.Headers = jest.fn().mockImplementation((h) => h || {});

    global.window.fetch = jest.fn().mockImplementation((url) => {
      return Promise.resolve(new global.Response(JSON.stringify({ data: 'real-backend' }), { status: 200 }));
    });

    interceptor = new NetworkInterceptor({ autoInit: true });
  });

  afterEach(() => {
    if (interceptor) interceptor.destroy();
    global.window.fetch = originalFetch;
    XMLHttpRequest.prototype.open = originalXHROpen;
    XMLHttpRequest.prototype.send = originalXHRSend;
    jest.clearAllMocks();
  });

  test('intercepts normal fetch requests and logs them', async () => {
    let capturedRecord = null;
    interceptor.onNetworkEvent((rec) => {
      capturedRecord = rec;
    });

    const res = await window.fetch('https://api.example.com/items');
    expect(res.status).toBe(200);

    // Give microtask tick to resolve clone.text()
    await new Promise((r) => setTimeout(r, 10));

    expect(capturedRecord).not.toBeNull();
    expect(capturedRecord.url).toBe('https://api.example.com/items');
    expect(capturedRecord.tampered).toBe(false);
  });

  test('applies tamper mock rule and short-circuits network request in-situ', async () => {
    interceptor.setTamperRule('/broken-cart', {
      status: 200,
      body: { items: [], message: 'mocked in-situ' }
    });

    let capturedRecord = null;
    interceptor.onNetworkEvent((rec) => {
      capturedRecord = rec;
    });

    const res = await window.fetch('https://api.example.com/broken-cart');
    const data = JSON.parse(await res.text());

    expect(data.message).toBe('mocked in-situ');
    expect(capturedRecord).not.toBeNull();
    expect(capturedRecord.tampered).toBe(true);
    expect(capturedRecord.status).toBe(200);
  });

  test('clears and deletes tamper rules correctly', async () => {
    expect(interceptor.setTamperRule(null, null)).toBe(false);
    interceptor.setTamperRule('/rule-1', { status: 200, body: {} });
    expect(interceptor.removeTamperRule('/rule-1')).toBe(true);
    expect(interceptor.removeTamperRule('/nonexistent')).toBe(false);

    interceptor.setTamperRule('/rule-2', { status: 200, body: {} });
    interceptor.clearTamperRules();
    expect(interceptor.tamperRules.size).toBe(0);
  });

  test('handles network fetch errors gracefully and records error state', async () => {
    interceptor.destroy();

    const mockFailingFetch = jest.fn().mockRejectedValue(new Error('Failed to fetch'));
    global.window.fetch = mockFailingFetch;

    interceptor = new NetworkInterceptor({ autoInit: true });

    let capturedRecord = null;
    interceptor.onNetworkEvent((rec) => {
      capturedRecord = rec;
    });

    await expect(window.fetch('https://failing.api/test')).rejects.toThrow('Failed to fetch');

    expect(capturedRecord).not.toBeNull();
    expect(capturedRecord.status).toBe(0);
    expect(capturedRecord.error).toBe('Failed to fetch');
  });

  test('intercepts XMLHttpRequest lifecycle and extracts exchange data', () => {
    let capturedRecord = null;
    interceptor.onNetworkEvent((rec) => {
      capturedRecord = rec;
    });

    const xhr = new XMLHttpRequest();
    xhr.open('GET', 'http://localhost/xhr-test');
    xhr.send();

    // Trigger synthetic load event
    xhr.dispatchEvent(new Event('load'));

    expect(capturedRecord).not.toBeNull();
    expect(capturedRecord.method).toBe('GET');
    expect(capturedRecord.url).toBe('http://localhost/xhr-test');
  });
});
