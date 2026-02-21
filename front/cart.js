const host = window.location.hostname;
const isRailwayFront = /hand-aura-front-production\.up\.railway\.app$/i.test(host);
const isRailwayBack = /hand-aura-production\.up\.railway\.app$/i.test(host);
const BACKEND = (isRailwayFront || isRailwayBack)
  ? "https://hand-aura-production.up.railway.app"
  : `http://${host}:5000`;
const API = BACKEND + "/api";
let currentLang = "ar";
let appliedCouponCode = "";
let appliedCouponDiscount = 0;
let appliedCouponFinalTotal = 0;

function t(key) {
  const dict = {
    ar: {
      empty: "السلة فارغة.",
      shop_now: "تسوق الآن",
      currency: "جنيه",
      total: "المجموع",
      checkout: "إتمام الطلب",
      remove: "حذف",
      size: "المقاس",
      color: "اللون",
      success: "تم استلام طلبك بنجاح.",
      track_link: "تتبع الطلب",
      login: "تسجيل الدخول",
      login_required: "يجب تسجيل الدخول لإتمام الطلب.",
      save_address_confirm: "لا يوجد عنوان محفوظ. هل تريد حفظ العنوان في حسابك؟",
      order_number: "رقم الطلب",
      track_from: "يمكنك تتبع الطلب من صفحة",
      coupon_required_apply: "اضغط تطبيق الكوبون قبل تأكيد الطلب.",
      coupon_applied: "تم تطبيق الكوبون",
      coupon_failed: "الكوبون غير صالح أو غير متاح.",
      payment_unavailable: "طريقة الدفع دي مش شغالة دلوقتي. المتاح حاليًا: الدفع عند الاستلام فقط."
    },
    en: {
      empty: "Your cart is empty.",
      shop_now: "Shop now",
      currency: "EGP",
      total: "Total",
      checkout: "Checkout",
      remove: "Remove",
      size: "Size",
      color: "Color",
      success: "Your order was placed successfully.",
      track_link: "Track order",
      login: "Login",
      login_required: "Please login to checkout.",
      save_address_confirm: "No saved address. Save this address to your account?",
      order_number: "Order ID",
      track_from: "You can track your order on",
      coupon_required_apply: "Please apply the coupon before confirming the order.",
      coupon_applied: "Coupon applied",
      coupon_failed: "Coupon is invalid or unavailable.",
      payment_unavailable: "This payment method is currently unavailable. Only Cash on Delivery is available now."
    }
  };
  return (dict[currentLang] && dict[currentLang][key]) || key;
}

function applyLang(lang) {
  currentLang = lang;
  const isAr = lang === "ar";
  document.documentElement.lang = isAr ? "ar" : "en";
  document.documentElement.dir = isAr ? "rtl" : "ltr";
  const langBtn = document.getElementById("langToggle");
  if (langBtn) langBtn.textContent = isAr ? "AR" : "EN";
  if (typeof window.applyGlobalLang === "function") {
    window.applyGlobalLang();
  }
  renderCart();
}

function getCart() {
  return JSON.parse(localStorage.getItem("cart") || "[]");
}

function getCartSubtotal() {
  return getCart().reduce((sum, i) => sum + Number(i.price || 0) * Number(i.quantity || 0), 0);
}

function showPaymentMsg(text) {
  const el = document.getElementById("paymentMsg");
  if (!el) return;
  el.textContent = text || "";
  el.style.display = text ? "block" : "none";
}

function showCouponMsg(text, ok = false) {
  const el = document.getElementById("couponMsg");
  if (!el) return;
  el.textContent = text || "";
  el.style.display = text ? "block" : "none";
  el.style.color = ok ? "#2ecc71" : "#e74c3c";
}

function resetCouponState() {
  appliedCouponCode = "";
  appliedCouponDiscount = 0;
  appliedCouponFinalTotal = 0;
  showCouponMsg("");
}

function setCart(cart) {
  localStorage.setItem("cart", JSON.stringify(cart));
  resetCouponState();
  updateCartCount();
  renderCart();
  syncAbandonedCart(cart);
}

function updateCartCount() {
  const el = document.getElementById("cartCount");
  if (!el) return;
  el.textContent = getCart().reduce((sum, i) => sum + Number(i.quantity || 0), 0);
}

function bindPaymentGuard() {
  const form = document.getElementById("orderForm");
  if (!form || form.dataset.paymentGuardBound === "1") return;
  form.dataset.paymentGuardBound = "1";
  form.querySelectorAll("input[name='paymentMethod']").forEach((radio) => {
    radio.addEventListener("change", () => {
      if (radio.value !== "cash_on_delivery" && radio.checked) {
        showPaymentMsg(t("payment_unavailable"));
      } else if (radio.checked) {
        showPaymentMsg("");
      }
    });
  });
}

async function applyCoupon() {
  const input = document.getElementById("couponCodeInput");
  const code = String(input?.value || "").trim();
  if (!code) {
    showCouponMsg(currentLang === "ar" ? "اكتب كود الخصم أولاً." : "Enter coupon code first.");
    return;
  }
  const token = localStorage.getItem("auth_token");
  const res = await fetch(`${API}/coupons/validate`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    },
    body: JSON.stringify({ code, subtotal: getCartSubtotal() })
  });
  if (!res.ok) {
    let msg = t("coupon_failed");
    try {
      const data = await res.json();
      if (data?.error) msg = data.error;
    } catch {}
    resetCouponState();
    showCouponMsg(msg, false);
    return;
  }
  const data = await res.json();
  appliedCouponCode = data.code || code;
  appliedCouponDiscount = Number(data.discount || 0);
  appliedCouponFinalTotal = Number(data.finalTotal || 0);
  showCouponMsg(`${t("coupon_applied")}: ${appliedCouponCode} (-${appliedCouponDiscount.toFixed(0)} ${t("currency")})`, true);
}

function bindCouponButton() {
  const btn = document.getElementById("applyCouponBtn");
  if (!btn || btn.dataset.bound === "1") return;
  btn.dataset.bound = "1";
  btn.addEventListener("click", applyCoupon);
}

function renderCart() {
  const cart = getCart();
  const container = document.getElementById("cartContent");
  const checkoutForm = document.getElementById("checkoutForm");
  const successMsg = document.getElementById("successMsg");
  const token = localStorage.getItem("auth_token");
  syncAbandonedCart(cart);

  if (!token) {
    container.innerHTML = `<p class="cart-empty">${t("login_required")} <a href="login.html" style="color:var(--accent)">${t("login")}</a></p>`;
    checkoutForm.style.display = "none";
    successMsg.style.display = "none";
    return;
  }

  if (cart.length === 0) {
    container.innerHTML = `<p class="cart-empty">${t("empty")} <a href="index.html" style="color:var(--accent)">${t("shop_now")}</a></p>`;
    checkoutForm.style.display = "none";
    successMsg.style.display = "none";
    return;
  }

  let total = 0;
  let html = '<div class="cart-container">';
  cart.forEach((item, index) => {
    total += Number(item.price || 0) * Number(item.quantity || 0);
    let img = item.image || "https://via.placeholder.com/80";
    if (img && img.startsWith("/uploads")) img = BACKEND + img;
    html += `
      <div class="cart-item" data-index="${index}">
        <img src="${img}" alt="${item.name}">
        <div class="cart-item-info">
          <div class="cart-item-name">${item.name}</div>
          <div class="cart-item-price">${Number(item.price).toFixed(0)} ${t("currency")} × ${item.quantity}</div>
          ${item.size ? `<div class="cart-item-size">${t("size")}: ${item.size}</div>` : ""}
          ${item.color ? `<div class="cart-item-size">${t("color")}: ${item.color}</div>` : ""}
        </div>
        <div class="cart-item-qty">
          <button type="button" data-action="minus" data-index="${index}">−</button>
          <span>${item.quantity}</span>
          <button type="button" data-action="plus" data-index="${index}">+</button>
        </div>
        <button type="button" class="cart-item-remove" data-index="${index}">${t("remove")}</button>
      </div>
    `;
  });
  html += `
    <div class="cart-summary">
      <div class="cart-total">${t("total")}: ${Number(total).toFixed(0)} ${t("currency")}</div>
      <button type="button" class="checkout-btn" id="checkoutBtn">${t("checkout")}</button>
    </div>
  </div>
  `;
  container.innerHTML = html;
  checkoutForm.style.display = "none";
  successMsg.style.display = "none";

  container.querySelectorAll("[data-action=minus]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const idx = Number(btn.dataset.index);
      const c = getCart();
      if (c[idx].quantity <= 1) c.splice(idx, 1);
      else c[idx].quantity -= 1;
      setCart(c);
    });
  });
  container.querySelectorAll("[data-action=plus]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const idx = Number(btn.dataset.index);
      const c = getCart();
      c[idx].quantity += 1;
      setCart(c);
    });
  });
  container.querySelectorAll(".cart-item-remove").forEach((btn) => {
    btn.addEventListener("click", () => {
      const idx = Number(btn.dataset.index);
      const c = getCart();
      c.splice(idx, 1);
      setCart(c);
    });
  });
  document.getElementById("checkoutBtn").addEventListener("click", () => {
    document.querySelector(".cart-container .cart-summary").style.display = "none";
    checkoutForm.style.display = "block";
    bindPaymentGuard();
    bindCouponButton();
  });
}

async function syncAbandonedCart(cartOverride) {
  try {
    const token = localStorage.getItem("auth_token");
    if (!token) return;
    const cart = Array.isArray(cartOverride) ? cartOverride : getCart();
    const profile = JSON.parse(localStorage.getItem("auth_user") || "{}");
    await fetch(`${API}/marketing/abandoned-cart`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({
        email: profile.email || "",
        name: profile.name || "",
        items: cart
      })
    });
  } catch {}
}

document.getElementById("orderForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const cart = getCart();
  const form = e.target;
  const subtotal = getCartSubtotal();
  const paymentMethod = form.querySelector("input[name='paymentMethod']:checked")?.value || "cash_on_delivery";
  const couponInput = String(document.getElementById("couponCodeInput")?.value || "").trim();

  if (paymentMethod !== "cash_on_delivery") {
    showPaymentMsg(t("payment_unavailable"));
    alert(t("payment_unavailable"));
    return;
  }
  if (couponInput && (!appliedCouponCode || appliedCouponCode.toLowerCase() !== couponInput.toLowerCase())) {
    alert(t("coupon_required_apply"));
    return;
  }

  const total = appliedCouponCode ? appliedCouponFinalTotal : subtotal;
  if (form.customerName.value.trim().length < 2) return;
  if (!/^\S+@\S+\.\S+$/.test(form.customerEmail.value.trim())) return;
  if (!/^[0-9+\-\s]{7,20}$/.test(form.customerPhone.value.trim())) return;
  if (form.address.value.trim().length < 5) return;

  await saveAddressIfMissing(form.address.value);
  const order = {
    customerName: form.customerName.value,
    customerEmail: form.customerEmail.value,
    customerPhone: form.customerPhone.value,
    address: form.address.value,
    paymentMethod,
    couponCode: appliedCouponCode || undefined,
    items: cart.map((i) => ({
      productId: i.productId,
      name: i.name,
      price: i.price,
      quantity: i.quantity,
      image: i.image,
      size: i.size || "",
      color: i.color || ""
    })),
    total
  };

  try {
    const token = localStorage.getItem("auth_token");
    const res = await fetch(`${API}/orders`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {})
      },
      body: JSON.stringify(order)
    });
    if (!res.ok) {
      let msg = currentLang === "ar" ? "حدث خطأ. حاول مرة أخرى." : "An error occurred. Please try again.";
      try {
        const data = await res.json();
        if (data?.error) msg = data.error;
      } catch {}
      alert(msg);
      return;
    }
    const saved = await res.json();
    if (token) {
      fetch(`${API}/marketing/abandoned-cart/recovered`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({})
      }).catch(() => {});
    }
    localStorage.setItem("cart", "[]");
    resetCouponState();
    updateCartCount();
    document.getElementById("checkoutForm").style.display = "none";
    document.getElementById("cartContent").innerHTML = "";
    const success = document.getElementById("successMsg");
    success.innerHTML = `
      ${t("success")}<br>
      ${t("order_number")}: <code>${saved._id}</code><br>
      ${t("track_from")} <a href="track.html" style="color:var(--accent)">${t("track_link")}</a>.
    `;
    success.style.display = "block";
    setTimeout(() => { if (success) success.style.display = "none"; }, 10000);
  } catch {
    alert(currentLang === "ar" ? "تعذر الاتصال بالسيرفر." : "Server connection failed.");
  }
});

async function prefillProfile() {
  const token = localStorage.getItem("auth_token");
  if (!token) return;
  const res = await fetch(`${API}/auth/me`, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) return;
  const user = (await res.json()).user || {};
  const form = document.getElementById("orderForm");
  if (!form) return;
  if (user.name && !form.customerName.value) form.customerName.value = user.name;
  if (user.email && !form.customerEmail.value) form.customerEmail.value = user.email;
  if (user.phone && !form.customerPhone.value) form.customerPhone.value = user.phone;
  if (user.address && !form.address.value) form.address.value = user.address;
}

async function saveAddressIfMissing(address) {
  const token = localStorage.getItem("auth_token");
  if (!token || !address) return;
  const res = await fetch(`${API}/auth/me`, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) return;
  const user = (await res.json()).user || {};
  if (user.address && user.address.trim()) return;
  const ok = confirm(t("save_address_confirm"));
  if (!ok) return;
  await fetch(`${API}/auth/profile`, {
    method: "PUT",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ address })
  });
}

renderCart();
updateCartCount();
applyLang(localStorage.getItem("lang") || "ar");
bindPaymentGuard();
bindCouponButton();
prefillProfile();

const langToggle = document.getElementById("langToggle");
if (langToggle) {
  langToggle.addEventListener("click", () => {
    const next = (localStorage.getItem("lang") || "ar") === "ar" ? "en" : "ar";
    localStorage.setItem("lang", next);
    applyLang(next);
  });
}
