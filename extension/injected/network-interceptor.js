/**
 * GoA_Rover - Layer 2: Network Proxy & Tamper Interceptor
 * Injected in the Main World to intercept window.fetch and XMLHttpRequest.
 */

(function () {
  if (window.__GOA_ROVER_INTERCEPTOR__) return;

  class NetworkInterceptor {
    constructor() {
      this.records = [];
      this.tamperRules = new Map(); // url -> mockResponse
      this.initFetchProxy();
      this.initXHRProxy();
      console.log('[GoA_Rover] 🌐 Layer 2: Network Interceptor active');
    }

    setTamperRule(urlPattern, mockResponse) {
      this.tamperRules.set(urlPattern, mockResponse);
      console.log(`[GoA_Rover] 🎛️ Mock rule added for ${urlPattern}`);
    }

    clearTamperRules() {
      this.tamperRules.clear();
    }

    recordExchange(record) {
      this.records.push(record);
      if (this.records.length > 100) this.records.shift();
      window.postMessage({ source: 'GOA_ROVER_NETWORK', payload: record }, '*');
    }

    initFetchProxy() {
      const originalFetch = window.fetch;
      const self = this;

      window.fetch = async function (...args) {
        const url = typeof args[0] === 'string' ? args[0] : (args[0] && args[0].url) || '';
        const method = (args[1] && args[1].method) || 'GET';
        const startTime = performance.now();

        // Check if there is an active tamper/mock rule for this URL
        for (const [pattern, mockData] of self.tamperRules.entries()) {
          if (url.includes(pattern)) {
            console.log(`[GoA_Rover] 🎭 Tampering response for ${url}`);
            const bodyStr = typeof mockData.body === 'string' ? mockData.body : JSON.stringify(mockData.body);
            const mockedResponse = new Response(bodyStr, {
              status: mockData.status || 200,
              statusText: mockData.statusText || 'OK',
              headers: new Headers(mockData.headers || { 'Content-Type': 'application/json' })
            });

            self.recordExchange({
              id: Math.random().toString(36).substring(7),
              url,
              method,
              status: mockData.status || 200,
              duration: performance.now() - startTime,
              timestamp: Date.now(),
              tampered: true,
              responseBody: bodyStr
            });

            return mockedResponse;
          }
        }

        try {
          const response = await originalFetch.apply(this, args);
          const clone = response.clone();
          const duration = performance.now() - startTime;

          clone.text().then((text) => {
            self.recordExchange({
              id: Math.random().toString(36).substring(7),
              url,
              method,
              status: response.status,
              duration,
              timestamp: Date.now(),
              tampered: false,
              responseBody: text
            });
          }).catch(() => {});

          return response;
        } catch (error) {
          self.recordExchange({
            id: Math.random().toString(36).substring(7),
            url,
            method,
            status: 0,
            duration: performance.now() - startTime,
            timestamp: Date.now(),
            tampered: false,
            error: error.message
          });
          throw error;
        }
      };
    }

    initXHRProxy() {
      const self = this;
      const originalOpen = XMLHttpRequest.prototype.open;
      const originalSend = XMLHttpRequest.prototype.send;

      XMLHttpRequest.prototype.open = function (method, url, ...rest) {
        this._goaUrl = url;
        this._goaMethod = method;
        this._goaStartTime = performance.now();
        return originalOpen.apply(this, [method, url, ...rest]);
      };

      XMLHttpRequest.prototype.send = function (body) {
        this.addEventListener('load', () => {
          self.recordExchange({
            id: Math.random().toString(36).substring(7),
            url: this._goaUrl,
            method: this._goaMethod,
            status: this.status,
            duration: performance.now() - (this._goaStartTime || performance.now()),
            timestamp: Date.now(),
            tampered: false,
            responseBody: this.responseText
          });
        });
        return originalSend.apply(this, [body]);
      };
    }
  }

  window.__GOA_ROVER_INTERCEPTOR__ = new NetworkInterceptor();
})();
