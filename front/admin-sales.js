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
  return `${Number(value || 0).toFixed(0)} Ø¬Ù†ÙŠÙ‡`;
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
  const isDark = localStorage.getItem(key) === "1";
  document.body.classList.toggle("admin-dark", isDark);
  const topbar = document.querySelector(".admin-topbar-inner");
  if (!topbar || document.getElementById("adminDarkToggle")) return;
  const btn = document.createElement("button");
  btn.id = "adminDarkToggle";
  btn.type = "button";
  btn.className = "icon-btn";
  btn.textContent = isDark ? "â˜€" : "ðŸŒ™";
  btn.addEventListener("click", () => {
    const nowDark = !document.body.classList.contains("admin-dark");
    document.body.classList.toggle("admin-dark", nowDark);
    localStorage.setItem(key, nowDark ? "1" : "0");
    btn.textContent = nowDark ? "â˜€" : "ðŸŒ™";
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
    box.innerHTML = "<p style='color:var(--muted)'>ØªØ¹Ø°Ø± ØªØ­Ù…ÙŠÙ„ ØªÙ†Ø¨ÙŠÙ‡Ø§Øª Ø§Ù„Ù…Ø®Ø²ÙˆÙ†.</p>";
    return;
  }
  const data = await res.json();
  const list = data.lowStock || [];
  box.innerHTML = `
    <p style="margin:.4rem 0">Ø¹Ø¯Ø¯ Ø§Ù„Ù…Ù†ØªØ¬Ø§Øª Ù…Ù†Ø®ÙØ¶Ø© Ø§Ù„Ù…Ø®Ø²ÙˆÙ†: <strong>${data.lowStockCount || 0}</strong></p>
    ${list.length ? `<ul style="margin:0;padding:0 1rem">${list.map((p) => `<li>${p.name} - ${p.stock} Ù‚Ø·Ø¹Ø©</li>`).join("")}</ul>` : "<p style='color:var(--muted)'>Ù„Ø§ ÙŠÙˆØ¬Ø¯ Ù…Ù†ØªØ¬Ø§Øª Ù…Ù†Ø®ÙØ¶Ø© Ø­Ø§Ù„ÙŠÙ‹Ø§.</p>"}
  `;
}

async function loadAbandoned() {
  const box = document.getElementById("abandonedWrap");
  if (!box) return;
  const res = await fetch(`${salesApi}/marketing/abandoned-carts`, { headers: salesHeaders() });
  if (!res.ok) {
    box.innerHTML = "<p style='color:var(--muted)'>ØªØ¹Ø°Ø± ØªØ­Ù…ÙŠÙ„ Ø§Ù„Ø³Ù„Ø§Ù„ Ø§Ù„Ù…ØªØ±ÙˆÙƒØ©.</p>";
    return;
  }
  const carts = await res.json();
  box.innerHTML = carts.length
    ? `<table class="admin-table"><thead><tr><th>Ø§Ù„Ø¹Ù…ÙŠÙ„</th><th>Ø§Ù„Ø¥ÙŠÙ…ÙŠÙ„</th><th>Ø§Ù„Ù‚ÙŠÙ…Ø©</th><th>Ø¢Ø®Ø± Ù†Ø´Ø§Ø·</th></tr></thead><tbody>${carts.map((c) => `
      <tr>
        <td>${c.name || "-"}</td>
        <td>${c.email || "-"}</td>
        <td>${money(c.total)}</td>
        <td>${new Date(c.lastActiveAt).toLocaleString("ar-EG")}</td>
      </tr>
    `).join("")}</tbody></table>`
    : "<p style='color:var(--muted)'>Ù„Ø§ ØªÙˆØ¬Ø¯ Ø³Ù„Ø§Ù„ Ù…ØªØ±ÙˆÙƒØ© Ù†Ø´Ø·Ø©.</p>";
}

async function loadCartIntent() {
  const wrap = document.getElementById("cartIntentWrap");
  if (!wrap) return;
  const res = await fetch(`${salesApi}/analytics/dashboard`, { headers: salesHeaders() });
  if (!res.ok) {
    wrap.innerHTML = "<p style='color:var(--muted)'>ØªØ¹Ø°Ø± ØªØ­Ù…ÙŠÙ„ Ø§Ù„ØªØ­Ù„ÙŠÙ„ Ø§Ù„Ø³Ù„ÙˆÙƒÙŠ.</p>";
    return;
  }
  const data = await res.json();
  const rows = data.cartNotPurchased || [];
  wrap.innerHTML = rows.length
    ? `<table class="admin-table"><thead><tr><th>Product ID</th><th>Ù…Ø±Ø§Øª Ø§Ù„Ø¥Ø¶Ø§ÙØ© Ù„Ù„Ø³Ù„Ø©</th></tr></thead><tbody>${rows.map((r) => `<tr><td>${r.productId}</td><td>${r.adds}</td></tr>`).join("")}</tbody></table>`
    : "<p style='color:var(--muted)'>Ù„Ø§ ØªÙˆØ¬Ø¯ ÙØ¬ÙˆØ§Øª Ø´Ø±Ø§Ø¡ Ø¸Ø§Ù‡Ø±Ø© Ø­Ø§Ù„ÙŠÙ‹Ø§.</p>";
}

document.getElementById("sendRemindersBtn")?.addEventListener("click", async () => {
  const delayMinutes = Number(document.getElementById("delayMinutes")?.value || 60);
  const res = await fetch(`${salesApi}/marketing/abandoned-carts/send-reminders`, {
    method: "POST",
    headers: salesHeaders(true),
    body: JSON.stringify({ delayMinutes })
  });
  if (!res.ok) return alert("ØªØ¹Ø°Ø± Ø¥Ø±Ø³Ø§Ù„ Ø§Ù„ØªØ°ÙƒÙŠØ±Ø§Øª");
  const data = await res.json();
  alert(`ØªÙ… Ø¥Ø±Ø³Ø§Ù„ ${data.sent} ØªØ°ÙƒÙŠØ± Ù…Ù† ${data.checked}`);
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
    document.getElementById("salesSummary").innerHTML = "<p style='color:#e74c3c'>ØªØ¹Ø°Ø± ØªØ­Ù…ÙŠÙ„ Ø§Ù„ØªÙ‚Ø§Ø±ÙŠØ±.</p>";
    return;
  }
  const data = await res.json();
  document.getElementById("salesSummary").innerHTML = `
    <div class="admin-grid" style="margin-bottom:10px">
      <div class="admin-card">Ø¥Ø¬Ù…Ø§Ù„ÙŠ Ø§Ù„Ø·Ù„Ø¨Ø§Øª<br><strong>${data.totals.totalOrders}</strong></div>
      <div class="admin-card">Ø§Ù„Ø¥ÙŠØ±Ø§Ø¯<br><strong>${money(data.totals.totalRevenue)}</strong></div>
      <div class="admin-card">Ø·Ù„Ø¨Ø§Øª Ù…Ø¯ÙÙˆØ¹Ø©<br><strong>${data.totals.paidOrders}</strong></div>
      <div class="admin-card">Ù…ØªÙˆØ³Ø· Ø§Ù„Ø·Ù„Ø¨<br><strong>${money(data.totals.avgOrderValue)}</strong></div>
    </div>
  `;
  document.getElementById("revenueChart").innerHTML = data.daily.length
    ? `<table class="admin-table"><thead><tr><th>Ø§Ù„ÙŠÙˆÙ…</th><th>Ø·Ù„Ø¨Ø§Øª</th><th>Ø¥ÙŠØ±Ø§Ø¯</th></tr></thead><tbody>${data.daily.map((d) => `<tr><td>${d.date}</td><td>${d.orders}</td><td>${money(d.revenue)}</td></tr>`).join("")}</tbody></table>`
    : "<p style='color:var(--muted)'>Ù„Ø§ ÙŠÙˆØ¬Ø¯ Ø¨ÙŠØ§Ù†Ø§Øª Ù„Ù„ÙØªØ±Ø©.</p>";
  document.getElementById("topProductsWrap").innerHTML = data.topProducts.length
    ? `<table class="admin-table"><thead><tr><th>Ø§Ù„Ù…Ù†ØªØ¬</th><th>Ø§Ù„ÙƒÙ…ÙŠØ©</th><th>Ø§Ù„Ø¥ÙŠØ±Ø§Ø¯</th></tr></thead><tbody>${data.topProducts.map((p) => `<tr><td>${p.name}</td><td>${p.qty}</td><td>${money(p.revenue)}</td></tr>`).join("")}</tbody></table>`
    : "<p style='color:var(--muted)'>Ù„Ø§ ØªÙˆØ¬Ø¯ Ø¨ÙŠØ§Ù†Ø§Øª.</p>";
  document.getElementById("dailyWrap").innerHTML = `<p style="color:var(--muted)">Ø·Ø±Ù‚ Ø§Ù„Ø¯ÙØ¹: ${Object.entries(data.byPaymentMethod || {}).map(([k, v]) => `${k}: ${money(v)}`).join(" | ") || "-"}</p>`;
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

