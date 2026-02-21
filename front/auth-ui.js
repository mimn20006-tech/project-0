const authUiHost = window.location.hostname;
const authUiIsLocal = /^(localhost|127[.]0[.]0[.]1)$/i.test(authUiHost);
const AUTH_UI_BACKEND = authUiIsLocal
  ? "http://" + authUiHost + ":5000"
  : "https://ecommerce-api-production-c3a5.up.railway.app";
function getAuthUser() {
  try {
    return JSON.parse(localStorage.getItem("auth_user") || "null");
  } catch {
    return null;
  }
}

function applyGlobalLang() {
  const lang = localStorage.getItem("lang") || "ar";
  const dict = {
    ar: {
      home: "Ø§Ù„Ø±Ø¦ÙŠØ³ÙŠØ©",
      track: "ØªØªØ¨Ø¹ Ø§Ù„Ø·Ù„Ø¨",
      cart: "Ø§Ù„Ø³Ù„Ø©",
      login: "ØªØ³Ø¬ÙŠÙ„ Ø§Ù„Ø¯Ø®ÙˆÙ„",
      signup: "Ø¥Ù†Ø´Ø§Ø¡ Ø­Ø³Ø§Ø¨",
      logout: "ØªØ³Ø¬ÙŠÙ„ Ø§Ù„Ø®Ø±ÙˆØ¬",
      account: "Ø§Ù„Ø­Ø³Ø§Ø¨"
    },
    en: {
      home: "Home",
      track: "Track Order",
      cart: "Cart",
      login: "Login",
      signup: "Sign up",
      logout: "Logout",
      account: "Account"
    }
  };
  document.querySelectorAll("[data-i18n-global]").forEach((el) => {
    const key = el.getAttribute("data-i18n-global");
    if (dict[lang] && dict[lang][key]) el.textContent = dict[lang][key];
  });
}

function updateAuthUI() {
  const token = localStorage.getItem("auth_token");
  const user = getAuthUser();
  document.querySelectorAll("[data-auth='guest']").forEach((el) => {
    el.style.display = token ? "none" : "";
  });
  document.querySelectorAll("[data-auth='user']").forEach((el) => {
    el.style.display = token ? "" : "none";
  });
  const badge = document.querySelector(".user-badge");
  if (badge) {
    badge.textContent = user ? user.name : "";
    badge.style.display = token ? "" : "none";
  }
}

function bindMenu() {
  const menuBtns = document.querySelectorAll(".menu-btn");
  const sideMenu = document.getElementById("sideMenu");
  const overlay = document.getElementById("menuOverlay");
  if (!menuBtns.length || !sideMenu || !overlay) return;
  const close = () => {
    sideMenu.classList.remove("open");
    overlay.classList.remove("open");
  };
  menuBtns.forEach((btn) => {
    btn.addEventListener("click", () => {
      sideMenu.classList.toggle("open");
      overlay.classList.toggle("open");
    });
  });
  overlay.addEventListener("click", close);
}

function bindLogout() {
  const btn = document.getElementById("logoutBtn");
  if (!btn) return;
  btn.addEventListener("click", () => {
    const token = localStorage.getItem("auth_token");
    if (token) {
      fetch(`${AUTH_UI_BACKEND}/api/auth/logout`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` }
      }).catch(() => {});
    }
    localStorage.removeItem("auth_token");
    localStorage.removeItem("auth_user");
    updateAuthUI();
    location.href = "index.html";
  });
}

function bindSelectAnim() {
  document.querySelectorAll("select").forEach((sel) => {
    sel.addEventListener("focus", () => sel.classList.add("select-open"));
    sel.addEventListener("blur", () => sel.classList.remove("select-open"));
    sel.addEventListener("change", () => sel.classList.remove("select-open"));
  });
}

function applySiteTheme(isDark) {
  document.body.classList.toggle("site-dark", !!isDark);
  const btn = document.getElementById("themeToggle");
  if (btn) btn.textContent = isDark ? "â˜€" : "ðŸŒ™";
}

function ensureThemeToggle() {
  if (document.getElementById("themeToggle")) return;
  const actions = document.querySelector(".header-actions");
  if (!actions) return;
  const langBtn = document.getElementById("langToggle");
  const btn = document.createElement("button");
  btn.className = "icon-btn theme-btn";
  btn.id = "themeToggle";
  btn.type = "button";
  btn.setAttribute("aria-label", "Ø§Ù„ÙˆØ¶Ø¹ Ø§Ù„Ø¯Ø§ÙƒÙ†");
  btn.textContent = "ðŸŒ™";
  if (langBtn && langBtn.parentElement === actions) {
    actions.insertBefore(btn, langBtn);
  } else {
    actions.appendChild(btn);
  }
}

function initSiteTheme() {
  const key = "site_dark_mode";
  ensureThemeToggle();
  const isDark = localStorage.getItem(key) === "1";
  applySiteTheme(isDark);
  const btn = document.getElementById("themeToggle");
  if (!btn || btn.dataset.themeBound === "1") return;
  btn.dataset.themeBound = "1";
  btn.addEventListener("click", () => {
    const nowDark = !document.body.classList.contains("site-dark");
    localStorage.setItem(key, nowDark ? "1" : "0");
    applySiteTheme(nowDark);
  });
}

function upsertMetaByName(name, content) {
  if (!name) return;
  let el = document.querySelector(`meta[name="${name}"]`);
  if (!el) {
    el = document.createElement("meta");
    el.setAttribute("name", name);
    document.head.appendChild(el);
  }
  el.setAttribute("content", content || "");
}

function upsertMetaByProperty(property, content) {
  if (!property) return;
  let el = document.querySelector(`meta[property="${property}"]`);
  if (!el) {
    el = document.createElement("meta");
    el.setAttribute("property", property);
    document.head.appendChild(el);
  }
  el.setAttribute("content", content || "");
}

function upsertCanonical(url) {
  let el = document.querySelector('link[rel="canonical"]');
  if (!el) {
    el = document.createElement("link");
    el.setAttribute("rel", "canonical");
    document.head.appendChild(el);
  }
  el.setAttribute("href", url);
}

async function applySeoSettings() {
  try {
    const res = await fetch(`${AUTH_UI_BACKEND}/api/settings/site`);
    if (!res.ok) return;
    const data = await res.json();
    const site = (data && data.site) || {};
    const title = String(site.title || "Hand Aura").trim();
    const description = String(site.description || "متجر Hand Aura للملابس.").trim();
    const imageRaw = String(site.image || site.heroImage || "").trim();
    const image = imageRaw
      ? (imageRaw.startsWith("/uploads") ? `${AUTH_UI_BACKEND}${imageRaw}` : imageRaw)
      : "";
    const canonical = `${window.location.origin}${window.location.pathname}`;

    document.title = title;
    upsertMetaByName("description", description);
    upsertMetaByProperty("og:type", "website");
    upsertMetaByProperty("og:title", title);
    upsertMetaByProperty("og:description", description);
    upsertMetaByProperty("og:url", canonical);
    upsertMetaByName("twitter:card", "summary_large_image");
    upsertMetaByName("twitter:title", title);
    upsertMetaByName("twitter:description", description);
    if (image) {
      upsertMetaByProperty("og:image", image);
      upsertMetaByName("twitter:image", image);
    }
    upsertCanonical(canonical);
  } catch {}
}

document.addEventListener("DOMContentLoaded", () => {
  applySeoSettings();
  initSiteTheme();
  applyGlobalLang();
  updateAuthUI();
  bindMenu();
  bindLogout();
  bindSelectAnim();
});





