// Tiny JSON-RPC bridge between the page and Snappy's C# side (WebView2 postMessage).
// Outside the app (design preview in a normal browser) it falls back to window.SnappyMock.
(() => {
  const native = window.chrome && window.chrome.webview;
  const listeners = new Map();
  const pending = new Map();
  let nextId = 1;

  function emit(event, data) {
    const set = listeners.get(event);
    if (!set) return;
    for (const fn of set) {
      try { fn(data); } catch (err) { console.error(`[snappy] ${event} handler failed`, err); }
    }
  }

  if (native) {
    native.addEventListener('message', (e) => {
      const msg = e.data;
      if (!msg) return;
      if (msg.event) { emit(msg.event, msg.data); return; }
      const waiter = pending.get(msg.id);
      if (!waiter) return;
      pending.delete(msg.id);
      if (msg.error) waiter.reject(new Error(msg.error));
      else waiter.resolve(msg.result);
    });
  }

  function call(method, params = {}) {
    if (!native) {
      if (!window.SnappyMock) return Promise.reject(new Error('Not running inside Snappy'));
      return window.SnappyMock.call(method, params, emit);
    }
    return new Promise((resolve, reject) => {
      const id = nextId++;
      pending.set(id, { resolve, reject });
      native.postMessage({ id, method, params });
    });
  }

  function on(event, fn) {
    if (!listeners.has(event)) listeners.set(event, new Set());
    listeners.get(event).add(fn);
    return () => listeners.get(event).delete(fn);
  }

  window.snappy = { call, on, isNative: !!native };
})();
