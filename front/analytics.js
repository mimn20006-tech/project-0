(function () {
  const host = window.location.hostname;
  const isLocal = /^(localhost|127[.]0[.]0[.]1)$/i.test(host);
  const BACKEND = isLocal
    ? "http://" + host + ":5000"
    : "https://ecommerce-api-production-c3a5.up.railway.app";
  const API = BACKEND + "/api";
const key = "analytics_session_id";
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





