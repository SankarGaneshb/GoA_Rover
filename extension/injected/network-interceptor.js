/**
 * GoA_Rover - Layer 2: Network Proxy & Tamper Interceptor
 * Injected in the Main World to intercept window.fetch and XMLHttpRequest.
 */

(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.NetworkInterceptor = factory();
    if (typeof window !== 'undefined' && !window.__GOA_ROVER_INTERCEPTOR__) {
      window.__GOA_ROVER_INTERCEPTOR__ = new root.NetworkInterceptor();
    }
  }
})(typeof self !== 'undefined' ? self : this, function () {

  class NetworkInterceptor {
    constructor(options = {}) {
      this.records = [];
      this.tamperRules = new Map();
      this.listeners = [];
      this.options = Object.assign({
        autoInit: true,
        maxRecords: 100
      }, options);

      this.origFetch = null;
      this.origXHROpen = null;
      this.origXHRSend = null;

      this.messageHandler = null;

      if (this.options.autoInit) {
        this.initFetchProxy();
        this.initXHRProxy();
        this.initMessageListener();
      }
    }

    initMessageListener() {
      if (typeof window === 'undefined' || typeof window.addEventListener !== 'function') return;
      this.messageHandler = (event) => {
        if (event.data && event.data.source === 'GOA_ROVER_APPLY_TAMPER') {
          const { pattern, mock } = event.data.payload || {};
          if (mock) {
            this.setTamperRule(pattern || '', mock);
          }
        }
      };
      window.addEventListener('message', this.messageHandler);
    }

    onNetworkEvent(cb) {
      if (typeof cb === 'function') this.listeners.push(cb);
    }

    setTamperRule(urlPattern, mockResponse) {
      if (!urlPattern || typeof mockResponse !== 'object') return false;
      this.tamperRules.set(urlPattern, mockResponse);
      return true;
    }

    removeTamperRule(urlPattern) {
      return this.tamperRules.delete(urlPattern);
    }

    clearTamperRules() {
      this.tamperRules.clear();
    }

    recordExchange(record) {
      if (!record || typeof record !== 'object') return;
      this.records.push(record);
      if (this.records.length > this.options.maxRecords) {
        this.records.shift();
      }

      this.listeners.forEach((cb) => {
        try { cb(record); } catch (e) {}
      });

      if (typeof window !== 'undefined' && typeof window.postMessage === 'function') {
        try {
          window.postMessage({ source: 'GOA_ROVER_NETWORK', payload: record }, '*');
        } catch (e) {}
      }
    }

    initFetchProxy() {
      if (typeof window === 'undefined' || typeof window.fetch !== 'function') return;
      if (this.origFetch) return; // already proxied

      this.origFetch = window.fetch;
      const self = this;

      window.fetch = async function (...args) {
        let url = '';
        try {
          url = typeof args[0] === 'string' ? args[0] : (args[0] && args[0].url) || String(args[0]);
        } catch (e) {
          url = 'unknown-url';
        }

        const method = (args[1] && args[1].method) ? args[1].method.toUpperCase() : 'GET';
        const startTime = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();

        // Check tamper rules
        for (const [pattern, mockData] of self.tamperRules.entries()) {
          if (url.includes(pattern)) {
            const bodyStr = typeof mockData.body === 'string' ? mockData.body : JSON.stringify(mockData.body || {});
            const status = mockData.status || 200;
            const statusText = mockData.statusText || 'OK';

            let headers;
            try {
              headers = new Headers(mockData.headers || { 'Content-Type': 'application/json' });
            } catch (e) {
              headers = mockData.headers || {};
            }

            const mockedResponse = new Response(bodyStr, { status, statusText, headers });

            const duration = ((typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now()) - startTime;
            self.recordExchange({
              id: Math.random().toString(36).substring(7),
              url,
              method,
              status,
              duration,
              timestamp: Date.now(),
              tampered: true,
              responseBody: bodyStr
            });

            return mockedResponse;
          }
        }

        try {
          const response = await self.origFetch.apply(this, args);
          const duration = ((typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now()) - startTime;

          try {
            const clone = response.clone();
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
            }).catch(() => {
              self.recordExchange({
                id: Math.random().toString(36).substring(7),
                url,
                method,
                status: response.status,
                duration,
                timestamp: Date.now(),
                tampered: false,
                responseBody: ''
              });
            });
          } catch (e) {
            // response clone failed (e.g. streaming already locked)
          }

          return response;
        } catch (error) {
          const duration = ((typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now()) - startTime;
          self.recordExchange({
            id: Math.random().toString(36).substring(7),
            url,
            method,
            status: 0,
            duration,
            timestamp: Date.now(),
            tampered: false,
            error: error ? error.message : 'Network error'
          });
          throw error;
        }
      };
    }

    initXHRProxy() {
      if (typeof XMLHttpRequest === 'undefined') return;
      if (this.origXHROpen) return; // already proxied

      this.origXHROpen = XMLHttpRequest.prototype.open;
      this.origXHRSend = XMLHttpRequest.prototype.send;
      const self = this;

      XMLHttpRequest.prototype.open = function (method, url, ...rest) {
        try {
          this._goaUrl = String(url);
          this._goaMethod = String(method).toUpperCase();
          this._goaStartTime = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
        } catch (e) {}
        return self.origXHROpen.apply(this, [method, url, ...rest]);
      };

      XMLHttpRequest.prototype.send = function (body) {
        try {
          this.addEventListener('load', () => {
            try {
              const now = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
              self.recordExchange({
                id: Math.random().toString(36).substring(7),
                url: this._goaUrl || '',
                method: this._goaMethod || 'GET',
                status: this.status,
                duration: now - (this._goaStartTime || now),
                timestamp: Date.now(),
                tampered: false,
                responseBody: this.responseText || ''
              });
            } catch (e) {}
          });
        } catch (e) {}
        return self.origXHRSend.apply(this, [body]);
      };
    }

    destroy() {
      if (this.origFetch && typeof window !== 'undefined') {
        window.fetch = this.origFetch;
        this.origFetch = null;
      }
      if (this.origXHROpen && typeof XMLHttpRequest !== 'undefined') {
        XMLHttpRequest.prototype.open = this.origXHROpen;
        XMLHttpRequest.prototype.send = this.origXHRSend;
        this.origXHROpen = null;
        this.origXHRSend = null;
      }
      if (this.messageHandler && typeof window !== 'undefined') {
        window.removeEventListener('message', this.messageHandler);
        this.messageHandler = null;
      }
      this.tamperRules.clear();
      this.records = [];
      this.listeners = [];
    }
  }

  return NetworkInterceptor;
});
