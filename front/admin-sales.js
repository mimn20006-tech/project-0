const salesHost = window.location.hostname;
const salesBackend = /^(localhost|127[.]0[.]0[.]1)$/i.test(salesHost)
  ? "http://" + salesHost + ":5000"
  : "https://ecommerce-api-production-c3a5.up.railway.app";
const salesApi = salesBackend + "/api";
function salesHeaders(json = false) {
  const token = localStorage.getItem("admin_token") || "";
  const headers = token ? { Authorization: `Bearer ${token}` } : {};
  if (json) headers["Content-Type"] = "application/json";
  return headers;
}

function money(value) {
  return `${Number(value || 0).toFixed(0)} جنية`;
}

function bindSalesMenu() {
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

function downloadCsv(filename, rows) {
  const csv = rows.map((row) => row.map((v) => `"${String(v ?? "").replaceAll('"', '""')}"`).join(",")).join("\n");
  const blob = new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8;" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);
}

async function loadLowStock() {
  const box = document.getElementById("lowStockWrap");
  if (!box) return;
  const res = await fetch(`${salesApi}/reports/inventory`, { headers: salesHeaders() });
  if (!res.ok) {
    box.innerHTML = "<p style='color:var(--muted)'>حدث خطأ أثناء تحميل تنبيهات المخزون.</p>";
    return;
  }
  const data = await res.json();
  const list = data.lowStock || [];
  box.innerHTML = `
    <p style="margin:.4rem 0">عدد التنبيهات المخزونية: <strong>${data.lowStockCount || 0}</strong></p>
    ${list.length ? `<ul style="margin:0;padding:0 1rem">${list.map((p) => `<li>${p.name} - ${p.stock} قطعة</li>`).join("")}</ul>` : "<p style='color:var(--muted)'>لا توجد تنبيهات مخزونية.</p>"}
  `;
}

async function loadAbandoned() {
  const box = document.getElementById("abandonedWrap");
  if (!box) return;
  const res = await fetch(`${salesApi}/marketing/abandoned-carts`, { headers: salesHeaders() });
  if (!res.ok) {
    box.innerHTML = "<p style='color:var(--muted)'>حدث خطأ أثناء تحميل السلاسل المتروكة.</p>";
    return;
  }
  const carts = await res.json();
  box.innerHTML = carts.length
    ? `<table class="admin-table"><thead><tr><th>الاسم</th><th>البريد الإلكتروني</th><th>القيمة</th><th>آخر نشاط</th></tr></thead><tbody>${carts.map((c) => `
      <tr>
        <td>${c.name || "-"}</td>
        <td>${c.email || "-"}</td>
        <td>${money(c.total)}</td>
        <td>${new Date(c.lastActiveAt).toLocaleString("ar-EG")}</td>
      </tr>
    `).join("")}</tbody></table>`
    : "<p style='color:var(--muted)'>لا توجد سلاسل متروكة.</p>";
}

async function loadCartIntent() {
  const wrap = document.getElementById("cartIntentWrap");
  if (!wrap) return;
  const res = await fetch(`${salesApi}/analytics/dashboard`, { headers: salesHeaders() });
  if (!res.ok) {
    wrap.innerHTML = "<p style='color:var(--muted)'>حدث خطأ أثناء تحميل التحليلات.</p>";
    return;
  }
  const data = await res.json();
  const rows = data.cartNotPurchased || [];
  wrap.innerHTML = rows.length
    ? `<table class="admin-table"><thead><tr><th>Product ID</th><th>عدد الإضافات للسلة</th></tr></thead><tbody>${rows.map((r) => `<tr><td>${r.productId}</td><td>${r.adds}</td></tr>`).join("")}</tbody></table>`
    : "<p style='color:var(--muted)'>لا توجد فجوات شراء مسجلة.</p>";
}

document.getElementById("sendRemindersBtn")?.addEventListener("click", async () => {
  const delayMinutes = Number(document.getElementById("delayMinutes")?.value || 60);
  const res = await fetch(`${salesApi}/marketing/abandoned-carts/send-reminders`, {
    method: "POST",
    headers: salesHeaders(true),
    body: JSON.stringify({ delayMinutes })
  });
  if (!res.ok) return alert("حدث خطأ أثناء إرسال التذكيرات");
  const data = await res.json();
  alert(`تم إرسال ${data.sent} تذكير من ${data.checked}`);
  loadAbandoned();
});

async function loadSales() {
  const from = document.getElementById("reportFrom")?.value;
  const to = document.getElementById("reportTo")?.value;
  const qs = new URLSearchParams();
  if (from) qs.set("from", from);
  if (to) qs.set("to", to);
  const res = await fetch(`${salesApi}/reports/sales?${qs.toString()}`, { headers: salesHeaders() });
  if (res.status === 401) return (location.href = "admin-login.html");
  if (!res.ok) {
    document.getElementById("salesSummary").innerHTML = "<p style='color:#e74c3c'>حدث خطأ أثناء تحميل التقارير.</p>";
    return;
  }
  const data = await res.json();
  document.getElementById("salesSummary").innerHTML = `
    <div class="admin-grid" style="margin-bottom:10px">
      <div class="admin-card">عدد الطلبات<br><strong>${data.totals.totalOrders}</strong></div>
      <div class="admin-card">الإيراد<br><strong>${money(data.totals.totalRevenue)}</strong></div>
      <div class="admin-card">طلبات مدفوعة<br><strong>${data.totals.paidOrders}</strong></div>
      <div class="admin-card">متوسط قيمة الطلب<br><strong>${money(data.totals.avgOrderValue)}</strong></div>
    </div>
  `;
  document.getElementById("revenueChart").innerHTML = data.daily.length
    ? `<table class="admin-table"><thead><tr><th>اليوم</th><th>طلبات</th><th>إيراد</th></tr></thead><tbody>${data.daily.map((d) => `<tr><td>${d.date}</td><td>${d.orders}</td><td>${money(d.revenue)}</td></tr>`).join("")}</tbody></table>`
    : "<p style='color:var(--muted)'>لا توجد بيانات للفترة.</p>";
  document.getElementById("topProductsWrap").innerHTML = data.topProducts.length
    ? `<table class="admin-table"><thead><tr><th>المنتج</th><th>الكمية</th><th>الإيراد</th></tr></thead><tbody>${data.topProducts.map((p) => `<tr><td>${p.name}</td><td>${p.qty}</td><td>${money(p.revenue)}</td></tr>`).join("")}</tbody></table>`
    : "<p style='color:var(--muted)'>لا توجد بيانات.</p>";
  document.getElementById("dailyWrap").innerHTML = `<p style="color:var(--muted)">طريق الدفع: ${Object.entries(data.byPaymentMethod || {}).map(([k, v]) => `${k}: ${money(v)}`).join(" | ") || "-"}</p>`;
  const exportExcelBtn = document.getElementById("exportExcelBtn");
  if (exportExcelBtn) exportExcelBtn.onclick = () => {
    const rows = [["Date", "Orders", "Revenue"], ...(data.daily || []).map((d) => [d.date, d.orders, d.revenue])];
    downloadCsv("sales-report.csv", rows);
  };
}

document.getElementById("exportPdfBtn")?.addEventListener("click", () => window.print());
document.getElementById("reportFilterForm")?.addEventListener("submit", (e) => {
  e.preventDefault();
  loadSales();
});

if (!localStorage.getItem("admin_token")) location.href = "admin-login.html";
bindSalesMenu();
setupDarkMode();
loadSales();
loadLowStock();
loadAbandoned();
loadCartIntent();

