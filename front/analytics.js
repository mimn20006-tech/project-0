(function () {
  const host = window.location.hostname;
  const isCapacitorApp = !!(window.Capacitor && (window.Capacitor.isNativePlatform ? window.Capacitor.isNativePlatform() : true));
  const isLocal = /^(localhost|127[.]0[.]0[.]1)$/i.test(host);
  const DEPLOY_BACKEND = "https://ecommerce-api-production-c3a5.up.railway.app";
  const LOCAL_BACKEND = "http://" + host + ":5000";
  const BACKEND = isCapacitorApp ? DEPLOY_BACKEND : (isLocal
    ? LOCAL_BACKEND
    : DEPLOY_BACKEND);
  const API = BACKEND + "/api";const key = "analytics_session_id";
  if (isLocal && !isCapacitorApp && localStorage.getItem("use_local_api") !== "0" && !window.__haFetchFallbackInstalled) {
    const nativeFetch = window.fetch.bind(window);
    window.fetch = async (input, init) => {
      if (typeof input !== "string") return nativeFetch(input, init);
      try {
        return await nativeFetch(input, init);
      } catch (err) {
        if (!input.startsWith(LOCAL_BACKEND)) throw err;
        return nativeFetch(input.replace(LOCAL_BACKEND, DEPLOY_BACKEND), init);
      }
    };
    window.__haFetchFallbackInstalled = true;
  }
  let sessionId = localStorage.getItem(key);
  if (!sessionId) {
    sessionId = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
    localStorage.setItem(key, sessionId);
  }

  function sendEvent(payload) {
    fetch(`${API}/analytics/events`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    }).catch(() => {});
  }

  window.trackAnalyticsEvent = function trackAnalyticsEvent(name, metadata) {
    sendEvent({
      name: String(name || "event"),
      sessionId,
      path: location.pathname,
      metadata: metadata || {}
    });
  };

  sendEvent({
      name: "page_view",
      sessionId,
      path: location.pathname
    });
})();







