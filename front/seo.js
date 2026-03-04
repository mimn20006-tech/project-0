(function () {
  const host = window.location.hostname;
  const isCapacitorApp = !!(window.Capacitor && (window.Capacitor.isNativePlatform ? window.Capacitor.isNativePlatform() : true));
  const isLocal = /^(localhost|127[.]0[.]0[.]1)$/i.test(host);
  const DEPLOY_BACKEND = "https://ecommerce-api-production-c3a5.up.railway.app";
  const LOCAL_BACKEND = "http://" + host + ":5000";
  const BACKEND = isCapacitorApp ? DEPLOY_BACKEND : (isLocal
    ? LOCAL_BACKEND
    : DEPLOY_BACKEND);
  const API = BACKEND + "/api";
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
function ensureMetaByName(name, content) {
    if (!content) return;
    let node = document.querySelector('meta[name="' + name + '"]');
    if (!node) {
      node = document.createElement("meta");
      node.setAttribute("name", name);
      document.head.appendChild(node);
    }
    node.setAttribute("content", content);
  }

  function ensureMetaByProperty(property, content) {
    if (!content) return;
    let node = document.querySelector('meta[property="' + property + '"]');
    if (!node) {
      node = document.createElement("meta");
      node.setAttribute("property", property);
      document.head.appendChild(node);
    }
    node.setAttribute("content", content);
  }

  function ensureLink(rel, href) {
    if (!href) return;
    let node = document.querySelector('link[rel="' + rel + '"]');
    if (!node) {
      node = document.createElement("link");
      node.setAttribute("rel", rel);
      document.head.appendChild(node);
    }
    node.setAttribute("href", href);
    if (rel === "icon") node.setAttribute("type", "image/png");
  }

  function ensureLinkWithAttr(rel, href, attr, value) {
    if (!href) return;
    let selector = 'link[rel="' + rel + '"]';
    if (attr && value) selector += '[' + attr + '="' + value + '"]';
    let node = document.querySelector(selector);
    if (!node) {
      node = document.createElement("link");
      node.setAttribute("rel", rel);
      if (attr && value) node.setAttribute(attr, value);
      document.head.appendChild(node);
    }
    node.setAttribute("href", href);
  }

  function absoluteImageUrl(image) {
    if (!image) return "";
    const value = String(image).trim();
    if (!value) return "";
    if (/^https?:\/\//i.test(value)) return value;
    if (value.startsWith("/uploads/")) return BACKEND + value;
    return value;
  }

  function canonicalUrl() {
    const current = window.location.origin + window.location.pathname;
    return current;
  }

  function applyPwaDefaults(image) {
    ensureLinkWithAttr("manifest", "manifest.webmanifest");
    ensureMetaByName("theme-color", "#0f1218");
    ensureMetaByName("apple-mobile-web-app-capable", "yes");
    ensureMetaByName("apple-mobile-web-app-status-bar-style", "black-translucent");
    ensureMetaByName("apple-mobile-web-app-title", "Hand Aura");
    if (image) ensureLinkWithAttr("apple-touch-icon", image);
  }

  function registerServiceWorker() {
    if (!("serviceWorker" in navigator)) return;
    const protocol = String(location.protocol || "");
    if (protocol !== "https:" && location.hostname !== "localhost" && location.hostname !== "127.0.0.1") return;
    window.addEventListener("load", function () {
      navigator.serviceWorker.register("sw.js").catch(function () {});
    });
  }

  async function applySiteSeo() {
    try {
      const res = await fetch(API + "/settings/site");
      if (!res.ok) return;
      const data = await res.json();
      const site = (data && data.site) || {};
      const title = String(site.title || "").trim() || "Hand Aura";
      const description = String(site.description || "").trim() || "Ù…ØªØ¬Ø± Hand Aura Ù„Ù„Ù…Ù„Ø§Ø¨Ø³.";
      const image = absoluteImageUrl(site.image || site.heroImage || "site-logo.png");
      const canonical = canonicalUrl();

      if (!document.title || document.title === "Hand Aura") {
        document.title = title;
      }

      ensureMetaByName("description", description);
      ensureMetaByProperty("og:type", "website");
      ensureMetaByProperty("og:title", title);
      ensureMetaByProperty("og:description", description);
      ensureMetaByProperty("og:url", canonical);
      ensureMetaByProperty("og:image", image);
      ensureMetaByName("twitter:card", "summary_large_image");
      ensureMetaByName("twitter:title", title);
      ensureMetaByName("twitter:description", description);
      ensureMetaByName("twitter:image", image);
      ensureLink("icon", image);
      ensureLink("apple-touch-icon", image);
      ensureLink("canonical", canonical);
      applyPwaDefaults(image);
    } catch {}
  }

  applySiteSeo();
  registerServiceWorker();
})();


