const couponsHost = window.location.hostname;
const couponsBackend = /^(localhost|127[.]0[.]0[.]1)$/i.test(couponsHost)
  ? "http://" + couponsHost + ":5000"
  : "https://ecommerce-api-production-c3a5.up.railway.app";
const couponsApi = couponsBackend + "/api";
function couponsToken() {
  return localStorage.getItem("admin_token") || "";
}

function couponsHeaders(json = false) {
  const headers = couponsToken() ? { Authorization: `Bearer ${couponsToken()}` } : {};
  if (json) headers["Content-Type"] = "application/json";
  return headers;
}

function bindCouponsMenu() {
  const menuBtn = document.querySelector(".menu-btn");
  const sideMenu = document.getElementById("sideMenu");
  const overlay = document.getElementById("menuOverlay");
  menuBtn?.addEventListener("click", () => {
    sideMenu?.classList.toggle("open");
    overlay?.classList.toggle("open");
  });
  overlay?.addEventListener("click", () => {
    sideMenu?.classList.remove("open");
    overlay?.classList.remove("open");
  });
  document.getElementById("adminLogoutBtn")?.addEventListener("click", () => {
    localStorage.removeItem("admin_token");
    localStorage.removeItem("admin_user");
    location.href = "admin-login.html";
  });
}

function setupDarkMode() {
  const key = "admin_dark_mode";
  const saved = localStorage.getItem(key);
  const isDark = saved === null ? true : saved === "1";
  if (saved === null) localStorage.setItem(key, "1");
  document.body.classList.toggle("admin-dark", isDark);
  const topbar = document.querySelector(".admin-topbar-inner");
  if (!topbar || document.getElementById("adminDarkToggle")) return;
  const btn = document.createElement("button");
  btn.id = "adminDarkToggle";
  btn.type = "button";
  btn.className = "icon-btn";
  btn.textContent = isDark ? "☀️" : "🌙";
  btn.addEventListener("click", () => {
    const nowDark = !document.body.classList.contains("admin-dark");
    document.body.classList.toggle("admin-dark", nowDark);
    localStorage.setItem(key, nowDark ? "1" : "0");
    btn.textContent = nowDark ? "☀️" : "🌙";
  });
  topbar.appendChild(btn);
}

function getCouponPayload() {
  return {
    code: document.getElementById("couponCode").value.trim(),
    title: document.getElementById("couponTitle").value.trim(),
    type: document.getElementById("couponType").value,
    value: Number(document.getElementById("couponValue").value || 0),
    minOrderTotal: Number(document.getElementById("couponMinOrder").value || 0),
    maxDiscount: Number(document.getElementById("couponMaxDiscount").value || 0),
    usageLimit: Number(document.getElementById("couponUsageLimit").value || 0),
    perUserLimit: Number(document.getElementById("couponPerUserLimit").value || 1),
    pointsCost: Number(document.getElementById("couponPointsCost").value || 0),
    firstOrderOnly: document.getElementById("couponFirstOrderOnly").checked,
    enabled: document.getElementById("couponEnabled").checked,
    visibleInStore: document.getElementById("couponVisibleInStore").checked
  };
}

function fillForm(coupon = null) {
  document.getElementById("couponId").value = coupon?._id || "";
  document.getElementById("couponCode").value = coupon?.code || "";
  document.getElementById("couponTitle").value = coupon?.title || "";
  document.getElementById("couponType").value = coupon?.type || "percent";
  document.getElementById("couponValue").value = coupon?.value ?? "";
  document.getElementById("couponMinOrder").value = coupon?.minOrderTotal ?? "";
  document.getElementById("couponMaxDiscount").value = coupon?.maxDiscount ?? "";
  document.getElementById("couponUsageLimit").value = coupon?.usageLimit ?? "";
  document.getElementById("couponPerUserLimit").value = coupon?.perUserLimit ?? 1;
  document.getElementById("couponPointsCost").value = coupon?.pointsCost ?? 0;
  document.getElementById("couponFirstOrderOnly").checked = !!coupon?.firstOrderOnly;
  document.getElementById("couponEnabled").checked = coupon ? !!coupon.enabled : true;
  document.getElementById("couponVisibleInStore").checked = coupon ? !!coupon.visibleInStore : true;
  document.getElementById("couponSubmitBtn").textContent = coupon ? "تحديث الكوبون" : "حفظ الكوبون";
}

async function loadCoupons() {
  const wrap = document.getElementById("couponsTableWrap");
  if (!wrap) return;
  const res = await fetch(`${couponsApi}/coupons`, { headers: couponsHeaders() });
  if (res.status === 401) {
    localStorage.removeItem("admin_token");
    location.href = "admin-login.html";
    return;
  }
  if (!res.ok) {
    wrap.innerHTML = "<p style='color:#e74c3c'>تعذر تحميل الكوبونات.</p>";
    return;
  }
  const data = await res.json();
  if (!data.length) {
    wrap.innerHTML = "<p style='color:var(--muted)'>لا توجد كوبونات.</p>";
    return;
  }
  wrap.innerHTML = `
    <table class="admin-table">
      <thead>
        <tr>
          <th>الكود</th>
          <th>النوع</th>
          <th>القيمة</th>
          <th>النقاط</th>
          <th>الاستخدام</th>
          <th>الحالة</th>
          <th>المتجر</th>
          <th>إجراءات</th>
        </tr>
      </thead>
      <tbody>
        ${data.map((c) => `
          <tr>
            <td>${c.code}</td>
            <td>${c.type}</td>
            <td>${c.value}</td>
            <td>${Number(c.pointsCost || 0)}</td>
            <td>${c.usageCount || 0}/${c.usageLimit || "∞"}</td>
            <td>${c.enabled ? "مفعل" : "متوقف"}</td>
            <td>${c.visibleInStore ? "يظهر" : "مخفي"}</td>
            <td>
              <button type="button" class="admin-btn admin-btn-edit" data-edit="${c._id}">تعديل</button>
              <button type="button" class="admin-btn admin-btn-delete" data-del="${c._id}">حذف</button>
            </td>
          </tr>
        `).join("")}
      </tbody>
    </table>
  `;
  wrap.querySelectorAll("[data-edit]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const item = data.find((c) => c._id === btn.dataset.edit);
      if (item) fillForm(item);
    });
  });
  wrap.querySelectorAll("[data-del]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      if (!confirm("حذف الكوبون؟")) return;
      const del = await fetch(`${couponsApi}/coupons/${btn.dataset.del}`, { method: "DELETE", headers: couponsHeaders() });
      if (!del.ok) return alert("تعذر حذف الكوبون");
      await loadCoupons();
    });
  });
}

document.getElementById("couponForm")?.addEventListener("submit", async (e) => {
  e.preventDefault();
  const id = document.getElementById("couponId").value;
  const method = id ? "PUT" : "POST";
  const url = id ? `${couponsApi}/coupons/${id}` : `${couponsApi}/coupons`;
  const res = await fetch(url, {
    method,
    headers: couponsHeaders(true),
    body: JSON.stringify(getCouponPayload())
  });
  if (res.status === 401) {
    localStorage.removeItem("admin_token");
    localStorage.removeItem("admin_user");
    location.href = "admin-login.html";
    return;
  }
  if (!res.ok) {
    let msg = "تعذر حفظ الكوبون";
    try {
      const d = await res.json();
      if (d?.error) msg = d.error;
    } catch {}
    alert(msg);
    return;
  }
  fillForm(null);
  await loadCoupons();
});

if (!couponsToken()) location.href = "admin-login.html";
bindCouponsMenu();
setupDarkMode();
fillForm(null);
loadCoupons();




