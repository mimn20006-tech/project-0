const host = window.location.hostname;
const isCapacitorApp = !!(window.Capacitor && (window.Capacitor.isNativePlatform ? window.Capacitor.isNativePlatform() : true));
const isLocal = /^(localhost|127[.]0[.]0[.]1)$/i.test(host);
const DEPLOY_BACKEND = "https://ecommerce-api-production-c3a5.up.railway.app";
const LOCAL_BACKEND = "http://" + host + ":5000";
const BACKEND = isCapacitorApp ? DEPLOY_BACKEND : (isLocal
  ? LOCAL_BACKEND
  : DEPLOY_BACKEND);
const API = BACKEND + "/api";let currentLang = "ar";
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

function t(key) {
  const dict = {
    ar: {
      track: "تتبع الطلب",
      track_title: "تتبع حالة الطلب",
      track_hint: "أدخل رقم الطلب الذي ظهر بعد إتمام الشراء والبريد الإلكتروني المستخدم في الطلب.",
      order_id: "رقم الطلب",
      email: "البريد الإلكتروني",
      show_status: "عرض حالة الطلب",
      loading: "جاري جلب بيانات الطلب...",
      not_found: "لم يُعثر على طلب بهذا الرقم.",
      email_mismatch: "البريد الإلكتروني لا يتطابق مع هذا الطلب.",
      error_fetch: "حدث خطأ أثناء جلب بيانات الطلب.",
      status: "حالة الطلب",
      order_number: "رقم الطلب",
      order_date: "تاريخ الطلب",
      total: "الإجمالي",
      products: "المنتجات",
      contact_phone: "للتوصل: 01025457419",
      pending: "قيد الانتظار",
      shipped: "تم الشحن",
      delivered: "تم التوصيل",
      server_error: "تعذر الوصول إلى الخادم. تأكد من تشغيل الخلفية."
    },
    en: {
      track: "Track Order",
      track_title: "Track Order Status",
      track_hint: "Enter the order number shown after checkout and the email used in the order.",
      order_id: "Order ID",
      email: "Email",
      show_status: "Show status",
      loading: "Loading order data...",
      not_found: "No order found with this ID.",
      email_mismatch: "Email does not match this order.",
      error_fetch: "Error while fetching the order.",
      status: "Order status",
      order_number: "Order ID",
      order_date: "Order date",
      total: "Total",
      products: "Products",
      contact_phone: "Contact: 01025457419",
      pending: "Pending",
      shipped: "Shipped",
      delivered: "Delivered",
      server_error: "Failed to reach the server. Make sure the backend is running."
    }
  };
  return (dict[currentLang] && dict[currentLang][key]) || key;
}

function applyLang(lang) {
  currentLang = lang;
  const isAr = lang === "ar";
  document.documentElement.lang = isAr ? "ar" : "en";
  document.documentElement.dir = isAr ? "rtl" : "ltr";
  document.querySelectorAll("[data-i18n]").forEach(el => {
    const key = el.getAttribute("data-i18n");
    el.textContent = t(key);
  });
  const langBtn = document.getElementById("langToggle");
  if (langBtn) langBtn.textContent = isAr ? "AR" : "EN";
  if (typeof window.applyGlobalLang === "function") {
    window.applyGlobalLang();
  }
}

function updateCartCount() {
  const el = document.getElementById("cartCount");
  if (!el) return;
  const cart = JSON.parse(localStorage.getItem("cart") || "[]");
  el.textContent = cart.reduce((sum, i) => sum + i.quantity, 0);
}

updateCartCount();

document.getElementById("trackForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const form = e.target;
  const id = form.orderId.value.trim();
  const email = form.email.value.trim();
  const result = document.getElementById("trackResult");

  if (!id || !email) return;

  result.style.display = "block";
  result.innerHTML = `<p>${t("loading")}</p>`;

  try {
    const res = await fetch(`${API}/orders/${encodeURIComponent(id)}?email=${encodeURIComponent(email)}`);
    if (!res.ok) {
      if (res.status === 404) {
        result.innerHTML = `<p>${t("not_found")}</p>`;
      } else if (res.status === 403) {
        result.innerHTML = `<p>${t("email_mismatch")}</p>`;
      } else {
        result.innerHTML = `<p>${t("error_fetch")}</p>`;
      }
      return;
    }
    const order = await res.json();
    const created = new Date(order.createdAt).toLocaleString(currentLang === "ar" ? "ar-EG" : "en-US");
    const statusLabel =
      order.status === "pending"
        ? t("pending")
        : order.status === "shipped"
          ? t("shipped")
          : t("delivered");

    const itemsHtml = (order.items || [])
      .map(
        (i) =>
          `<li>${i.name} × ${i.quantity} — ${Number(i.price).toFixed(0)} ${currentLang === "ar" ? "جنيه" : "EGP"
          }${i.size ? ` (${currentLang === "ar" ? "المقاس" : "Size"}: ${i.size})` : ""}</li>`
      )
      .join("");

    result.innerHTML = `
  <div class="cart-total">${t("status")}: ${statusLabel}</div>
  <p style="margin-bottom:0.5rem;font-size:0.9rem;color:var(--muted)">${t("order_number")}: <code>${order._id}</code></p>
  <p style="margin-bottom:0.5rem;font-size:0.9rem;color:var(--muted)">${t("order_date")}: ${created}</p>
  <p style="margin-bottom:0.5rem;">${t("total")}: <strong>${Number(order.total).toFixed(0)} ${currentLang === "ar" ? "جنيه" : "EGP"}</strong></p>
  <p style="margin-top:0.75rem;margin-bottom:0.25rem;font-size:0.9rem;">${t("products")}:</p>
  <ul style="padding-right:1.2rem;font-size:0.85rem;">${itemsHtml}</ul>
`;
  } catch (err) {
    result.innerHTML = `<p>${t("server_error")}</p>`;
  }
});

applyLang(localStorage.getItem("lang") || "ar");

const langToggle = document.getElementById("langToggle");
if (langToggle) {
  langToggle.addEventListener("click", () => {
    const next = (localStorage.getItem("lang") || "ar") === "ar" ? "en" : "ar";
    localStorage.setItem("lang", next);
    applyLang(next);
  });
}







