const host = window.location.hostname;
const isLocal = /^(localhost|127[.]0[.]0[.]1)$/i.test(host);
const BACKEND = isLocal
  ? "http://" + host + ":5000"
  : "https://ecommerce-api-production-c3a5.up.railway.app";
const API = BACKEND + "/api";
let currentLang = "ar";

function t(key) {
  const dict = {
    ar: {
      track: "ØªØªØ¨Ø¹ Ø§Ù„Ø·Ù„Ø¨",
      track_title: "ØªØªØ¨Ø¹ Ø­Ø§Ù„Ø© Ø§Ù„Ø·Ù„Ø¨",
      track_hint: "Ø£Ø¯Ø®Ù„ Ø±Ù‚Ù… Ø§Ù„Ø·Ù„Ø¨ Ø§Ù„Ø°ÙŠ Ø¸Ù‡Ø± Ù„Ùƒ Ø¨Ø¹Ø¯ Ø¥ØªÙ…Ø§Ù… Ø§Ù„Ø´Ø±Ø§Ø¡ØŒ Ù…Ø¹ Ø§Ù„Ø¨Ø±ÙŠØ¯ Ø§Ù„Ø¥Ù„ÙƒØªØ±ÙˆÙ†ÙŠ Ø§Ù„Ù…Ø³ØªØ®Ø¯Ù… ÙÙŠ Ø§Ù„Ø·Ù„Ø¨.",
      order_id: "Ø±Ù‚Ù… Ø§Ù„Ø·Ù„Ø¨",
      email: "Ø§Ù„Ø¨Ø±ÙŠØ¯ Ø§Ù„Ø¥Ù„ÙƒØªØ±ÙˆÙ†ÙŠ",
      show_status: "Ø¹Ø±Ø¶ Ø­Ø§Ù„Ø© Ø§Ù„Ø·Ù„Ø¨",
      loading: "Ø¬Ø§Ø±ÙŠ Ø¬Ù„Ø¨ Ø¨ÙŠØ§Ù†Ø§Øª Ø§Ù„Ø·Ù„Ø¨...",
      not_found: "Ù„Ù… ÙŠØªÙ… Ø§Ù„Ø¹Ø«ÙˆØ± Ø¹Ù„Ù‰ Ø·Ù„Ø¨ Ø¨Ù‡Ø°Ø§ Ø§Ù„Ø±Ù‚Ù….",
      email_mismatch: "Ø§Ù„Ø¨Ø±ÙŠØ¯ Ø§Ù„Ø¥Ù„ÙƒØªØ±ÙˆÙ†ÙŠ Ù„Ø§ ÙŠØ·Ø§Ø¨Ù‚ Ù‡Ø°Ø§ Ø§Ù„Ø·Ù„Ø¨.",
      error_fetch: "Ø­Ø¯Ø« Ø®Ø·Ø£ Ø£Ø«Ù†Ø§Ø¡ Ø¬Ù„Ø¨ Ø§Ù„Ø·Ù„Ø¨.",
      status: "Ø­Ø§Ù„Ø© Ø§Ù„Ø·Ù„Ø¨",
      order_number: "Ø±Ù‚Ù… Ø§Ù„Ø·Ù„Ø¨",
      order_date: "ØªØ§Ø±ÙŠØ® Ø§Ù„Ø·Ù„Ø¨",
      total: "Ø§Ù„Ø¥Ø¬Ù…Ø§Ù„ÙŠ",
      products: "Ø§Ù„Ù…Ù†ØªØ¬Ø§Øª",
      contact_phone: "Ù„Ù„ØªÙˆØ§ØµÙ„: 01025457419",
      pending: "Ù‚ÙŠØ¯ Ø§Ù„Ø§Ù†ØªØ¸Ø§Ø±",
      shipped: "ØªÙ… Ø§Ù„Ø´Ø­Ù†",
      delivered: "ØªÙ… Ø§Ù„ØªÙˆØµÙŠÙ„",
      server_error: "ØªØ¹Ø°Ø± Ø§Ù„Ø§ØªØµØ§Ù„ Ø¨Ø§Ù„Ø³ÙŠØ±ÙØ±. ØªØ£ÙƒØ¯ Ù…Ù† ØªØ´ØºÙŠÙ„ Ø§Ù„Ø¨Ø§ÙƒÙ†Ø¯."
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
          `<li>${i.name} Ã— ${i.quantity} â€” ${Number(i.price).toFixed(0)} ${currentLang === "ar" ? "Ø¬Ù†ÙŠÙ‡" : "EGP"}${i.size ? ` (${currentLang === "ar" ? "Ø§Ù„Ù…Ù‚Ø§Ø³" : "Size"}: ${i.size})` : ""}</li>`
      )
      .join("");

    result.innerHTML = `
      <div class="cart-total">${t("status")}: ${statusLabel}</div>
      <p style="margin-bottom:0.5rem;font-size:0.9rem;color:var(--muted)">${t("order_number")}: <code>${order._id}</code></p>
      <p style="margin-bottom:0.5rem;font-size:0.9rem;color:var(--muted)">${t("order_date")}: ${created}</p>
      <p style="margin-bottom:0.5rem;">${t("total")}: <strong>${Number(order.total).toFixed(0)} ${currentLang === "ar" ? "Ø¬Ù†ÙŠÙ‡" : "EGP"}</strong></p>
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





