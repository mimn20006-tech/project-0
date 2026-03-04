(function () {
  const host = window.location.hostname;
  const isCapacitorApp = !!(window.Capacitor && (window.Capacitor.isNativePlatform ? window.Capacitor.isNativePlatform() : true));
  const isLocal = /^(localhost|127[.]0[.]0[.]1)$/i.test(host);
  const DEPLOY_BACKEND = "https://ecommerce-api-production-c3a5.up.railway.app";
  const LOCAL_BACKEND = "http://" + host + ":5000";
  const BACKEND = isCapacitorApp ? DEPLOY_BACKEND : (isLocal ? LOCAL_BACKEND : DEPLOY_BACKEND);
  const API = BACKEND + "/api";let currentLang = (window.getGlobalLang && window.getGlobalLang()) || localStorage.getItem("lang") || "ar";
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
  const orderId = new URLSearchParams(location.search).get("orderId");
  const body = document.getElementById("invoiceBody");

  function t(ar, en) {
    return currentLang === "ar" ? ar : en;
  }

  function applyInvoicePageLang() {
    document.title = t("فاتورة الطلب | Hand Aura", "Order Invoice | Hand Aura");
    document.documentElement.lang = currentLang === "ar" ? "ar" : "en";
    document.documentElement.dir = currentLang === "ar" ? "rtl" : "ltr";
    document.getElementById("invoiceTitle").textContent = t("فاتورة الطلب", "Order Invoice");
    document.getElementById("invoiceHint").innerHTML = t(
      "استخدم الرابط: <code>invoice.html?orderId=...</code> ثم اضغط طباعة/حفظ PDF.",
      "Use this URL: <code>invoice.html?orderId=...</code> then click Print/Save PDF."
    );
    document.getElementById("printBtn").textContent = t("طباعة / حفظ PDF", "Print / Save PDF");
  }

  async function loadInvoice() {
    applyInvoicePageLang();
    if (!orderId) {
      body.innerHTML = `<p>${t("لا يوجد رقم طلب.", "No order ID provided.")}</p>`;
      return;
    }
    const res = await fetch(`${API}/orders/${encodeURIComponent(orderId)}`);
    if (!res.ok) {
      body.innerHTML = `<p>${t("تعذر تحميل الفاتورة.", "Failed to load invoice.")}</p>`;
      return;
    }

    const o = await res.json();
    const rows = (o.items || []).map((i) => `
      <tr>
        <td>${i.name || ""}</td>
        <td>${Number(i.price || 0).toFixed(0)}</td>
        <td>${Number(i.quantity || 0)}</td>
        <td>${(Number(i.price || 0) * Number(i.quantity || 0)).toFixed(0)}</td>
      </tr>
    `).join("");

    body.innerHTML = `
      <p>${t("رقم الطلب", "Order ID")}: <code>${o._id}</code></p>
      <p>${t("العميل", "Customer")}: ${o.customerName || "-"}</p>
      <p>${t("الإيميل", "Email")}: ${o.customerEmail || "-"}</p>
      <p>${t("التاريخ", "Date")}: ${new Date(o.createdAt).toLocaleString(currentLang === "ar" ? "ar-EG" : "en-US")}</p>
      <table class="admin-table" style="margin-top:1rem">
        <thead><tr><th>${t("المنتج", "Product")}</th><th>${t("السعر", "Price")}</th><th>${t("الكمية", "Qty")}</th><th>${t("الإجمالي", "Total")}</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
      <p style="margin-top:1rem">${t("المجموع", "Subtotal")}: <strong>${Number(o.subtotal || o.total || 0).toFixed(0)} ${t("جنيه", "EGP")}</strong></p>
      <p>${t("الخصم", "Discount")}: <strong>${Number(o.discountTotal || 0).toFixed(0)} ${t("جنيه", "EGP")}</strong></p>
      <p>${t("الصافي", "Grand total")}: <strong>${Number(o.total || 0).toFixed(0)} ${t("جنيه", "EGP")}</strong></p>
    `;
  }

  const langToggle = document.getElementById("langToggle");
  if (langToggle) {
    langToggle.textContent = currentLang === "ar" ? "AR" : "EN";
    langToggle.addEventListener("click", () => {
      const next = (localStorage.getItem("lang") || "ar") === "ar" ? "en" : "ar";
      localStorage.setItem("lang", next);
      currentLang = next;
      langToggle.textContent = next === "ar" ? "AR" : "EN";
      if (typeof window.applyGlobalLang === "function") window.applyGlobalLang();
      loadInvoice().catch(() => {});
      window.dispatchEvent(new CustomEvent("app:langchange", { detail: { lang: next } }));
    });
  }

  document.getElementById("printBtn")?.addEventListener("click", () => window.print());
  window.addEventListener("app:langchange", (e) => {
    currentLang = e?.detail?.lang || "ar";
    loadInvoice().catch(() => {});
  });

  loadInvoice().catch(() => {
    body.innerHTML = `<p>${t("تعذر تحميل الفاتورة.", "Failed to load invoice.")}</p>`;
  });
})();



