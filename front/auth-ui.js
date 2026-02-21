const authUiHost = window.location.hostname;
const authUiRailwayFront = /hand-aura-front-production\.up\.railway\.app$/i.test(authUiHost);
const authUiRailwayBack = /hand-aura-production\.up\.railway\.app$/i.test(authUiHost);
const AUTH_UI_BACKEND = (authUiRailwayFront || authUiRailwayBack)
  ? "https://hand-aura-production.up.railway.app"
  : `http://${authUiHost}:5000`;

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
      home: "الرئيسية",
      track: "تتبع الطلب",
      cart: "السلة",
      login: "تسجيل الدخول",
      signup: "إنشاء حساب",
      logout: "تسجيل الخروج",
      account: "الحساب"
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
  if (btn) btn.textContent = isDark ? "☀" : "🌙";
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
  btn.setAttribute("aria-label", "الوضع الداكن");
  btn.textContent = "🌙";
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

document.addEventListener("DOMContentLoaded", () => {
  initSiteTheme();
  applyGlobalLang();
  updateAuthUI();
  bindMenu();
  bindLogout();
  bindSelectAnim();
});
