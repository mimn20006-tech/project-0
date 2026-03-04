const host = window.location.hostname;
const isCapacitorApp = !!(window.Capacitor && (window.Capacitor.isNativePlatform ? window.Capacitor.isNativePlatform() : true));
const isLocal = /^(localhost|127[.]0[.]0[.]1)$/i.test(host);
const DEPLOY_BACKEND = "https://ecommerce-api-production-c3a5.up.railway.app";
const LOCAL_BACKEND = "http://" + host + ":5000";
const BACKEND = isCapacitorApp ? DEPLOY_BACKEND : (isLocal
  ? LOCAL_BACKEND
  : DEPLOY_BACKEND);
const API = BACKEND + "/api";let currentLang = localStorage.getItem("lang") || "ar";
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

function authHeaders() {
  const token = localStorage.getItem("auth_token");
  if (!token || token.split(".").length !== 3) return {};
  return { Authorization: `Bearer ${token}` };
}

function t(key) {
  const dict = {
    ar: {
      title: "سجل الطلبات",
      loginRequired: "يجب تسجيل الدخول لعرض طلباتك.",
      empty: "لا توجد طلبات حتى الآن.",
      total: "الإجمالي",
      items: "العناصر",
      status: "الحالة",
      payment: "الدفع",
      date: "التاريخ",
      pending: "قيد الانتظار",
      shipped: "تم الشحن",
      delivered: "تم التوصيل",
      paid: "مدفوع",
      awaiting_payment: "بانتظار الدفع",
      cash_on_delivery: "الدفع عند الاستلام"
    },
    en: {
      title: "Order History",
      loginRequired: "Please login to view your orders.",
      empty: "No orders yet.",
      total: "Total",
      items: "Items",
      status: "Status",
      payment: "Payment",
      date: "Date",
      pending: "Pending",
      shipped: "Shipped",
      delivered: "Delivered",
      paid: "Paid",
      awaiting_payment: "Awaiting payment",
      cash_on_delivery: "Cash on delivery"
    }
  };
  return (dict[currentLang] && dict[currentLang][key]) || key;
}

function mapStatus(v) {
  return t(String(v || "").toLowerCase()) || String(v || "-");
}

function mapPayment(v) {
  const key = String(v || "").toLowerCase();
  if (key === "cash_on_delivery") return t("cash_on_delivery");
  return key || "-";
}

function mapMoney(v) {
  const unit = currentLang === "ar" ? "جنيه" : "EGP";
  return `${Number(v || 0).toFixed(0)} ${unit}`;
}

function applyLang(lang) {
  currentLang = lang === "en" ? "en" : "ar";
  document.documentElement.lang = currentLang;
  document.documentElement.dir = currentLang === "ar" ? "rtl" : "ltr";
  const title = document.querySelector(".title");
  if (title) title.textContent = t("title");
  const btn = document.getElementById("langToggle");
  if (btn) btn.textContent = currentLang === "ar" ? "AR" : "EN";
  if (typeof window.applyGlobalLang === "function") window.applyGlobalLang();
}

function renderOrders(orders) {
  const wrap = document.getElementById("ordersWrap");
  if (!wrap) return;
  if (!orders.length) {
    wrap.innerHTML = `<p class="auth-hint">${t("empty")}</p>`;
    return;
  }
  wrap.innerHTML = orders.map((o) => {
    const items = Array.isArray(o.items) ? o.items : [];
    const date = o.createdAt ? new Date(o.createdAt).toLocaleString(currentLang === "ar" ? "ar-EG" : "en-US") : "-";
    return `
      <article class="card" style="margin-bottom:12px">
        <div class="card-body">
          <h3>#${String(o._id || "").slice(-8)}</h3>
          <p><strong>${t("date")}:</strong> ${date}</p>
          <p><strong>${t("status")}:</strong> ${mapStatus(o.status)}</p>
          <p><strong>${t("payment")}:</strong> ${mapStatus(o.paymentStatus)} - ${mapPayment(o.paymentMethod)}</p>
          <p><strong>${t("total")}:</strong> ${mapMoney(o.total)}</p>
          <p><strong>${t("items")}:</strong></p>
          <ul>
            ${items.map((i) => `<li>${i.name || "-"} x ${Number(i.quantity || 0)}</li>`).join("")}
          </ul>
        </div>
      </article>
    `;
  }).join("");
}

async function loadOrders() {
  const wrap = document.getElementById("ordersWrap");
  if (!wrap) return;
  const token = localStorage.getItem("auth_token");
  if (!token) {
    wrap.innerHTML = `<p class="auth-hint">${t("loginRequired")} <a href="login.html">Login</a></p>`;
    return;
  }
  wrap.innerHTML = `<p class="auth-hint">${currentLang === "ar" ? "جارٍ تحميل الطلبات..." : "Loading orders..."}</p>`;
  try {
    const res = await fetch(`${API}/orders/my`, { headers: authHeaders() });
    if (res.status === 401 || res.status === 403) {
      localStorage.removeItem("auth_token");
      localStorage.removeItem("auth_user");
      location.href = "login.html";
      return;
    }
    const data = res.ok ? await res.json() : [];
    renderOrders(Array.isArray(data) ? data : []);
  } catch (err) {
    wrap.innerHTML = `<p class="auth-error">${currentLang === "ar" ? "تعذر تحميل الطلبات." : "Failed to load orders."}</p>`;
  }
}

document.addEventListener("DOMContentLoaded", () => {
  applyLang(currentLang);
  loadOrders();
  const langToggle = document.getElementById("langToggle");
  if (langToggle) {
    langToggle.addEventListener("click", () => {
      const next = currentLang === "ar" ? "en" : "ar";
      localStorage.setItem("lang", next);
      applyLang(next);
      loadOrders();
    });
  }
});

