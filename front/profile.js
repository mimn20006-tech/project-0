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
  return token ? { Authorization: `Bearer ${token}` } : {};
}

function setAuth(token, user) {
  localStorage.setItem("auth_token", token);
  localStorage.setItem("auth_user", JSON.stringify(user));
}

function pt(key) {
  const dict = {
    ar: {
      profileTitle: "بيانات الحساب",
      saveBtn: "حفظ البيانات",
      namePh: "الاسم",
      phonePh: "رقم الهاتف",
      countryPh: "البلد",
      addressPh: "العنوان",
      points: "النقاط الحالية",
      couponStore: "متجر البونات",
      couponStoreHint: "اشترِ البون بالنقاط ثم استخدم الكود عند الدفع.",
      myCoupons: "البونات المملوكة"
    },
    en: {
      profileTitle: "Profile",
      saveBtn: "Save",
      namePh: "Name",
      phonePh: "Phone",
      countryPh: "Country",
      addressPh: "Address",
      points: "Current points",
      couponStore: "Coupon Store",
      couponStoreHint: "Buy coupons using points then use the code at checkout.",
      myCoupons: "My Coupons"
    }
  };
  return (dict[currentLang] && dict[currentLang][key]) || key;
}

function applyProfileLang() {
  currentLang = localStorage.getItem("lang") || "ar";
  document.documentElement.lang = currentLang === "ar" ? "ar" : "en";
  document.documentElement.dir = currentLang === "ar" ? "rtl" : "ltr";
  const langBtn = document.getElementById("langToggle");
  if (langBtn) langBtn.textContent = currentLang === "ar" ? "AR" : "EN";
  const title = document.querySelector(".auth-card h2");
  if (title) title.textContent = pt("profileTitle");
  const form = document.getElementById("profileForm");
  if (form) {
    if (form.name) form.name.placeholder = pt("namePh");
    if (form.phone) form.phone.placeholder = pt("phonePh");
    if (form.country) form.country.placeholder = pt("countryPh");
    if (form.address) form.address.placeholder = pt("addressPh");
    const submit = form.querySelector("button[type='submit']");
    if (submit) submit.textContent = pt("saveBtn");
  }
  const cards = document.querySelectorAll(".auth-card h2");
  if (cards[1]) cards[1].textContent = pt("couponStore");
  if (cards[2]) cards[2].textContent = pt("myCoupons");
  const hint = document.querySelectorAll(".auth-card .auth-hint")[1];
  if (hint) hint.textContent = pt("couponStoreHint");
}

function setPointsText(points) {
  const pointsInfo = document.getElementById("loyaltyPointsInfo");
  if (pointsInfo) {
    pointsInfo.textContent = `${pt("points")}: ${Number(points || 0)} ${currentLang === "ar" ? "نقطة" : "pts"}`;
  }
}

function renderMyCoupons(items = []) {
  const wrap = document.getElementById("myCouponsWrap");
  if (!wrap) return;
  if (!items.length) {
    wrap.innerHTML = "<p class='auth-hint'>لا توجد بونات مشتراة بعد.</p>";
    return;
  }
  wrap.innerHTML = items.map((c) => `
    <div class="admin-note" style="margin-bottom:8px">
      <strong>${c.title || "البون"}</strong><br>
      الكود: <code>${c.code || "-"}</code><br>
      التكلفة: ${Number(c.pointsCost || 0)} نقطة
    </div>
  `).join("");
}

function renderCouponStore(items = []) {
  const wrap = document.getElementById("couponStoreWrap");
  if (!wrap) return;
  if (!items.length) {
    wrap.innerHTML = "<p class='auth-hint'>لا توجد بونات متاحة حالياً.</p>";
    return;
  }
  wrap.innerHTML = items.map((c) => `
    <div class="admin-note" style="margin-bottom:8px">
      <strong>${c.title || "البون"}</strong><br>
      ${c.type === "percent" ? `خصم ${Number(c.value || 0)}%` : `خصم ${Number(c.value || 0)} جنيه`}<br>
      عدد الاستخدامات: ${Number(c.usageLimit || 0) > 0 ? `${Number(c.usageCount || 0)} / ${Number(c.usageLimit || 0)}` : "غير محدود"}<br>
      السعر: ${Number(c.pointsCost || 0)} نقطة<br>
      <button type="button" class="admin-btn" data-buy-coupon="${c.id}">شراء</button>
    </div>
  `).join("");
  wrap.querySelectorAll("[data-buy-coupon]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const id = btn.dataset.buyCoupon;
      btn.disabled = true;
      const res = await fetch(`${API}/coupons/store/${id}/redeem`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: "{}"
      });
      btn.disabled = false;
      if (!res.ok) {
        let msg = "تعذر شراء البون";
        try {
          const d = await res.json();
          if (d && d.error) msg = d.error;
        } catch {}
        alert(msg);
        return;
      }
      const data = await res.json();
      setPointsText(data.loyaltyPoints || 0);
      alert(`تم شراء البون: ${data?.coupon?.title || "البون"}\nالكود: ${data?.coupon?.code || "-"}`);
      loadCouponsData();
    });
  });
}

async function loadCouponsData() {
  try {
    const [storeRes, myRes] = await Promise.all([
      fetch(`${API}/coupons/store`, { headers: authHeaders() }),
      fetch(`${API}/coupons/my`, { headers: authHeaders() })
    ]);
    const store = storeRes.ok ? await storeRes.json() : [];
    const minePayload = myRes.ok ? await myRes.json() : { loyaltyPoints: 0, ownedCoupons: [] };
    renderCouponStore(Array.isArray(store) ? store : []);
    renderMyCoupons(Array.isArray(minePayload.ownedCoupons) ? minePayload.ownedCoupons : []);
    setPointsText(Number(minePayload.loyaltyPoints || 0));
  } catch {
    renderCouponStore([]);
    renderMyCoupons([]);
  }
}

async function loadProfile() {
  const res = await fetch(`${API}/auth/me`, { headers: authHeaders() });
  if (res.status === 404) {
    localStorage.removeItem("auth_token");
    localStorage.removeItem("auth_user");
    localStorage.setItem(
      "account_deleted_notice",
      "تم حذف حسابك بواسطة الإدارة. تواصل مع خدمة العملاء، ويمكنك إنشاء حساب جديد بنفس البريد."
    );
    location.href = "login.html";
    return;
  }
  if (res.status === 401 || res.status === 403) {
    location.href = "login.html";
    return;
  }
  const data = await res.json();
  const u = data.user || {};
  setPointsText(Number(u.loyaltyPoints || 0));
  const form = document.getElementById("profileForm");
  form.name.value = u.name || "";
  form.phone.value = u.phone || "";
  form.country.value = u.country || "";
  form.address.value = u.address || "";
  form.avatar.value = u.avatar || "";
}

document.getElementById("profileForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const form = e.target;
  const msg = document.getElementById("profileMsg");
  msg.textContent = "";
  form.querySelectorAll(".field-error").forEach(e => e.remove());
  const name = form.name.value.trim();
  const phone = form.phone.value.trim();
  if (name.length < 2) {
    const err = document.createElement("p");
    err.className = "field-error shake";
    form.name.insertAdjacentElement("afterend", err);
    err.textContent = "الاسم قصير";
    setTimeout(() => err.remove(), 10000);
    return;
  }
  if (phone && !/^[0-9+\\-\\s]{7,20}$/.test(phone)) {
    const err = document.createElement("p");
    err.className = "field-error shake";
    form.phone.insertAdjacentElement("afterend", err);
    err.textContent = "رقم الهاتف غير صحيح";
    setTimeout(() => err.remove(), 10000);
    return;
  }
  const formData = new FormData();
  formData.append("name", name);
  formData.append("phone", phone);
  formData.append("country", form.country.value.trim());
  formData.append("address", form.address.value.trim());
  if (form.avatar.files && form.avatar.files[0]) {
    if (form.avatar.files[0].size > 2 * 1024 * 1024) {
      const err = document.createElement("p");
      err.className = "field-error shake";
      form.avatar.insertAdjacentElement("afterend", err);
      err.textContent = "حجم الصورة يجب أن يكون أقل من 2MB";
      setTimeout(() => err.remove(), 10000);
      return;
    }
    formData.append("avatar", form.avatar.files[0]);
  }
  const res = await fetch(`${API}/auth/profile`, {
    method: "PUT",
    headers: { ...authHeaders() },
    body: formData
  });
  if (res.ok) {
    const data = await res.json();
    setAuth(data.token, data.user);
    setPointsText(Number(data?.user?.loyaltyPoints || 0));
    msg.textContent = "تم حفظ البيانات بنجاح";
    setTimeout(() => (msg.textContent = ""), 10000);
  } else {
    let m = "حدث خطأ أثناء حفظ البيانات";
    try {
      const d = await res.json();
      if (d && d.error) m = d.error;
    } catch {}
    msg.textContent = m;
    setTimeout(() => (msg.textContent = ""), 10000);
  }
});

loadProfile();
loadCouponsData();

document.addEventListener("DOMContentLoaded", () => {
  applyProfileLang();
  const langToggle = document.getElementById("langToggle");
  if (langToggle) {
    langToggle.addEventListener("click", () => {
      const next = (localStorage.getItem("lang") || "ar") === "ar" ? "en" : "ar";
      localStorage.setItem("lang", next);
      applyProfileLang();
      loadCouponsData();
    });
  }
});







