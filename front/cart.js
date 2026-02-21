const host = window.location.hostname;
const isRailwayFront = /hand-aura-front-production\.up\.railway\.app$/i.test(host);
const isRailwayBack = /hand-aura-production\.up\.railway\.app$/i.test(host);
const BACKEND = (isRailwayFront || isRailwayBack)
  ? "https://hand-aura-production.up.railway.app"
  : `http://${host}:5000`;
const API = BACKEND + "/api";
let currentLang = "ar";

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
      track: "تتبع الطلب",
      home: "الرئيسية",
      cart: "السلة",
      cart_title: "سلة التسوق",
      name: "الاسم",
      email: "البريد الإلكتروني",
      phone: "رقم الهاتف",
      address: "العنوان",
      confirm: "تأكيد الطلب",
      login: "تسجيل الدخول",
      login_required: "يجب تسجيل الدخول لإتمام الطلب.",
      save_address_confirm: "لا يوجد عنوان محفوظ. هل تريد حفظ العنوان في حسابك؟",
      order_number: "رقم الطلب",
      track_from: "يمكنك تتبع الطلب من صفحة"
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
      track: "Track order",
      home: "Home",
      cart: "Cart",
      cart_title: "Shopping Cart",
      name: "Name",
      email: "Email",
      phone: "Phone",
      address: "Address",
      confirm: "Confirm order",
      login: "Login",
      login_required: "Please login to checkout.",
      save_address_confirm: "No saved address. Save this address to your account?",
      order_number: "Order ID",
      track_from: "You can track your order on"
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
  renderCart();
}

function getCart() {
  return JSON.parse(localStorage.getItem("cart") || "[]");
}

function setCart(cart) {
  localStorage.setItem("cart", JSON.stringify(cart));
  updateCartCount();
  renderCart();
  syncAbandonedCart(cart);
}

function updateCartCount() {
  const el = document.getElementById("cartCount");
  if (el) {
    const cart = getCart();
    el.textContent = cart.reduce((sum, i) => sum + i.quantity, 0);
  }
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
    const subtotal = item.price * item.quantity;
    total += subtotal;
    let img = item.image || 'https://via.placeholder.com/80';
    if (img && img.startsWith("/uploads")) {
      img = BACKEND + img;
    }
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

  container.querySelectorAll("[data-action=minus]").forEach(btn => {
    btn.addEventListener("click", () => {
      const idx = parseInt(btn.dataset.index, 10);
      const c = getCart();
      if (c[idx].quantity <= 1) {
        c.splice(idx, 1);
      } else {
        c[idx].quantity--;
      }
      setCart(c);
    });
  });

  container.querySelectorAll("[data-action=plus]").forEach(btn => {
    btn.addEventListener("click", () => {
      const idx = parseInt(btn.dataset.index, 10);
      const c = getCart();
      c[idx].quantity++;
      setCart(c);
    });
  });

  container.querySelectorAll(".cart-item-remove").forEach(btn => {
    btn.addEventListener("click", () => {
      const idx = parseInt(btn.dataset.index, 10);
      const c = getCart();
      c.splice(idx, 1);
      setCart(c);
    });
  });

  document.getElementById("checkoutBtn").addEventListener("click", () => {
    document.querySelector(".cart-container .cart-summary").style.display = "none";
    checkoutForm.style.display = "block";
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
  const total = cart.reduce((sum, i) => sum + i.price * i.quantity, 0);
  form.querySelectorAll(".field-error").forEach(e => e.remove());
  if (form.customerName.value.trim().length < 2) {
    const err = document.createElement("p");
    err.className = "field-error shake";
    form.customerName.insertAdjacentElement("afterend", err);
    err.textContent = "الاسم قصير";
    setTimeout(() => err.remove(), 10000);
    return;
  }
  if (!/^\S+@\S+\.\S+$/.test(form.customerEmail.value.trim())) {
    const err = document.createElement("p");
    err.className = "field-error shake";
    form.customerEmail.insertAdjacentElement("afterend", err);
    err.textContent = "البريد الإلكتروني غير صحيح";
    setTimeout(() => err.remove(), 10000);
    return;
  }
  if (!/^[0-9+\\-\\s]{7,20}$/.test(form.customerPhone.value.trim())) {
    const err = document.createElement("p");
    err.className = "field-error shake";
    form.customerPhone.insertAdjacentElement("afterend", err);
    err.textContent = "رقم الهاتف غير صحيح";
    setTimeout(() => err.remove(), 10000);
    return;
  }
  if (form.address.value.trim().length < 5) {
    const err = document.createElement("p");
    err.className = "field-error shake";
    form.address.insertAdjacentElement("afterend", err);
    err.textContent = "العنوان غير صحيح";
    setTimeout(() => err.remove(), 10000);
    return;
  }
  await saveAddressIfMissing(form.address.value);
  const order = {
    customerName: form.customerName.value,
    customerEmail: form.customerEmail.value,
    customerPhone: form.customerPhone.value,
      address: form.address.value,
    items: cart.map(i => ({
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
    if (res.ok) {
      const saved = await res.json();
      if (token) {
        fetch(`${API}/marketing/abandoned-cart/recovered`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`
          },
          body: JSON.stringify({})
        }).catch(() => {});
      }
      localStorage.setItem("cart", "[]");
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
      setTimeout(() => {
        if (success) success.style.display = "none";
      }, 10000);
    } else {
      alert("حدث خطأ. حاول مرة أخرى.");
    }
  } catch (err) {
    alert("تعذر الاتصال بالسيرفر. تأكد من تشغيل الباكند.");
  }
});

renderCart();
updateCartCount();
applyLang(localStorage.getItem("lang") || "ar");

const langToggle = document.getElementById("langToggle");
if (langToggle) {
  langToggle.addEventListener("click", () => {
    const next = (localStorage.getItem("lang") || "ar") === "ar" ? "en" : "ar";
    localStorage.setItem("lang", next);
    applyLang(next);
  });
}

async function prefillProfile() {
  const token = localStorage.getItem("auth_token");
  if (!token) return;
  const res = await fetch(`${API}/auth/me`, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) return;
  const data = await res.json();
  const u = data.user || {};
  const form = document.getElementById("orderForm");
  if (!form) return;
  if (u.name && !form.customerName.value) form.customerName.value = u.name;
  if (u.email && !form.customerEmail.value) form.customerEmail.value = u.email;
  if (u.phone && !form.customerPhone.value) form.customerPhone.value = u.phone;
  if (u.address && !form.address.value) form.address.value = u.address;
}

async function saveAddressIfMissing(address) {
  const token = localStorage.getItem("auth_token");
  if (!token || !address) return;
  const res = await fetch(`${API}/auth/me`, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) return;
  const data = await res.json();
  const u = data.user || {};
  if (u.address && u.address.trim()) return;
  const ok = confirm(t("save_address_confirm"));
  if (!ok) return;
  await fetch(`${API}/auth/profile`, {
    method: "PUT",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ address })
  });
}

prefillProfile();
