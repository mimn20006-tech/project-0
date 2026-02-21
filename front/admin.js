const host = window.location.hostname;
const isLocal = /^(localhost|127[.]0[.]0[.]1)$/i.test(host);
const BACKEND = isLocal
  ? "http://" + host + ":5000"
  : "https://ecommerce-api-production-c3a5.up.railway.app";
const API = BACKEND + "/api";
const productForm = document.getElementById("productForm");
const submitProductBtn = document.getElementById("submitProductBtn");
const heroForm = document.getElementById("heroForm");
const heroPreview = document.getElementById("heroPreview");

function adminHeaders() {
  const token = localStorage.getItem("admin_token");
  if (!token || token === "undefined" || token === "null") return {};
  if (String(token).split(".").length !== 3) return {};
  return { Authorization: `Bearer ${token}` };
}

async function parseJsonSafe(res) {
  try {
    return await res.json();
  } catch {
    return null;
  }
}

async function handleAdminAuthFailure(res) {
  if (res.status !== 401) return false;
  localStorage.removeItem("admin_token");
  localStorage.removeItem("admin_user");
  alert("انتهت صلاحية جلسة الأدمن. سجل الدخول مرة أخرى.");
  location.href = "admin-login.html";
  return true;
}

const initialAdminToken = localStorage.getItem("admin_token");
if (!initialAdminToken || initialAdminToken === "undefined" || initialAdminToken === "null" || initialAdminToken.split(".").length !== 3) {
  location.href = "admin-login.html";
}

function loadProducts() {
  fetch(`${API}/products`, { headers: adminHeaders() })
    .then(res => {
      return res.json();
    })
    .then(products => {
      if (products.length === 0) {
        document.getElementById("productsTableWrap").innerHTML = "<p style='color:var(--muted)'>لا توجد منتجات.</p>";
        return;
      }
      let html = `
        <table class="admin-table">
          <thead>
            <tr>
              <th>صورة</th>
              <th>الاسم</th>
              <th>السعر</th>
              <th>الكمية</th>
              <th>النوع</th>
              <th>المقاسات</th>
              <th>الألوان</th>
              <th>التصنيف</th>
              <th>إجراءات</th>
            </tr>
          </thead>
          <tbody>
      `;
      const typeLabel = (value) => {
        if (value === "hoodie") return "هودي";
        if (value === "tshirt") return "تيشيرت";
        if (value === "pants") return "بنطلون";
        if (value === "jacket") return "جاكيت";
        if (value === "shirt") return "قميص";
        if (value === "dress") return "فستان";
        return value || "-";
      };
      const categoryLabel = (value) => {
        if (value === "Men") return "رجالي";
        if (value === "Women") return "نسائي";
        if (value === "Children") return "أطفال";
        return value || "-";
      };

      products.forEach(p => {
        let thumb = (p.images && p.images[0]) || p.image || 'https://via.placeholder.com/50';
        if (thumb && thumb.startsWith("/uploads")) {
          thumb = BACKEND + thumb;
        }
        html += `
          <tr>
            <td><img src="${thumb}" alt=""></td>
            <td>${p.name}</td>
            <td>${Number(p.price).toFixed(0)} جنيه</td>
            <td>${p.stock}</td>
            <td>${typeLabel(p.type)}</td>
            <td>${(p.sizes || []).join(", ") || "-"}</td>
            <td>${(p.colors || []).join(", ") || "-"}</td>
            <td>${categoryLabel(p.category)}</td>
            <td>
              <button type="button" class="admin-btn admin-btn-edit" data-edit="${p._id}">تعديل</button>
              <button type="button" class="admin-btn admin-btn-delete" data-delete="${p._id}">حذف</button>
            </td>
          </tr>
        `;
      });
      html += "</tbody></table>";
      document.getElementById("productsTableWrap").innerHTML = html;

      document.querySelectorAll("[data-edit]").forEach(btn => {
        btn.addEventListener("click", () => {
          const id = btn.dataset.edit;
          const p = products.find(x => x._id === id);
          if (p) {
            document.getElementById("productId").value = p._id;
            document.getElementById("name").value = p.name;
            document.getElementById("price").value = p.price;
            document.getElementById("stock").value = p.stock;
            document.getElementById("type").value = p.type || "hoodie";
            document.getElementById("sizes").value = (p.sizes || []).join(", ");
            if (document.getElementById("colors")) document.getElementById("colors").value = (p.colors || []).join(", ");
            if (document.getElementById("description")) document.getElementById("description").value = p.description || "";
            document.getElementById("category").value = p.category || "Men";
            submitProductBtn.textContent = "تحديث المنتج";
          }
        });
      });

      document.querySelectorAll("[data-delete]").forEach(btn => {
        btn.addEventListener("click", () => {
          if (!confirm("حذف هذا المنتج؟")) return;
          fetch(`${API}/products/${btn.dataset.delete}`, { method: "DELETE", headers: adminHeaders() })
            .then(() => loadProducts());
        });
      });
    })
    .catch(() => {
      document.getElementById("productsTableWrap").innerHTML = "<p style='color:var(--muted)'>تعذر تحميل المنتجات.</p>";
    });
}

function loadOrders() {
  fetch(`${API}/orders`, { headers: adminHeaders() })
    .then(res => {
      return res.json();
    })
    .then(orders => {
      if (orders.length === 0) {
        document.getElementById("ordersTableWrap").innerHTML = "<p style='color:var(--muted)'>لا توجد طلبات.</p>";
        return;
      }
      let html = `
        <table class="admin-table">
          <thead>
            <tr>
              <th>التاريخ</th>
              <th>العميل</th>
              <th>الهاتف</th>
              <th>المنتجات</th>
              <th>المبلغ</th>
              <th>الحالة</th>
              <th>تغيير الحالة</th>
            </tr>
          </thead>
          <tbody>
      `;
      orders.forEach(o => {
        const date = new Date(o.createdAt).toLocaleDateString("ar-EG");
        const items = (o.items || [])
          .map(i => `${i.name} × ${i.quantity}${i.size ? ` (المقاس: ${i.size})` : ""}`)
          .join("<br>");
        html += `
          <tr>
            <td>${date}</td>
            <td>${o.customerName}<br><small>${o.customerEmail}</small></td>
            <td>${o.customerPhone}</td>
            <td>${items || "-"}</td>
            <td>${Number(o.total).toFixed(0)} جنيه</td>
            <td><span class="order-status ${o.status}">${o.status === "pending" ? "قيد الانتظار" : o.status === "shipped" ? "تم الشحن" : "تم التوصيل"}</span></td>
            <td>
              <select class="order-status-select" data-id="${o._id}">
                <option value="pending" ${o.status === "pending" ? "selected" : ""}>قيد الانتظار</option>
                <option value="shipped" ${o.status === "shipped" ? "selected" : ""}>تم الشحن</option>
                <option value="delivered" ${o.status === "delivered" ? "selected" : ""}>تم التوصيل</option>
              </select>
            </td>
          </tr>
        `;
      });
      html += "</tbody></table>";
      document.getElementById("ordersTableWrap").innerHTML = html;

      document.querySelectorAll(".order-status-select").forEach(sel => {
        sel.addEventListener("change", () => {
          fetch(`${API}/orders/${sel.dataset.id}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json", ...adminHeaders() },
            body: JSON.stringify({ status: sel.value })
          }).then(() => loadOrders());
        });
      });
    })
    .catch(() => {
      document.getElementById("ordersTableWrap").innerHTML = "<p style='color:var(--muted)'>تعذر تحميل الطلبات.</p>";
    });
}

if (productForm) {
productForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  productForm.querySelectorAll(".field-error").forEach(e => e.remove());
  const name = document.getElementById("name").value.trim();
  const price = Number(document.getElementById("price").value);
  const stock = Number(document.getElementById("stock").value);
  const type = document.getElementById("type").value;
  const sizesRaw = (document.getElementById("sizes").value || "").trim();
  const colorsRaw = ((document.getElementById("colors") && document.getElementById("colors").value) || "").trim();
  const description = ((document.getElementById("description") && document.getElementById("description").value) || "").trim();
  const category = document.getElementById("category").value;
  if (name.length < 2) {
    const err = document.createElement("p");
    err.className = "field-error shake";
    document.getElementById("name").insertAdjacentElement("afterend", err);
    err.textContent = "اسم المنتج قصير";
    setTimeout(() => err.remove(), 10000);
    return;
  }
  if (!price || price <= 0) {
    const err = document.createElement("p");
    err.className = "field-error shake";
    document.getElementById("price").insertAdjacentElement("afterend", err);
    err.textContent = "السعر يجب أن يكون أكبر من 0";
    setTimeout(() => err.remove(), 10000);
    return;
  }
  if (stock < 0) {
    const err = document.createElement("p");
    err.className = "field-error shake";
    document.getElementById("stock").insertAdjacentElement("afterend", err);
    err.textContent = "الكمية غير صحيحة";
    setTimeout(() => err.remove(), 10000);
    return;
  }
  if (!type || !category) {
    const err = document.createElement("p");
    err.className = "field-error shake";
    document.getElementById("category").insertAdjacentElement("afterend", err);
    err.textContent = "اختر النوع والقسم";
    setTimeout(() => err.remove(), 10000);
    return;
  }
  if (sizesRaw) {
    const sizes = sizesRaw.split(",").map(s => s.trim()).filter(Boolean);
      if (sizes.length === 0) {
        const err = document.createElement("p");
        err.className = "field-error shake";
        document.getElementById("sizes").insertAdjacentElement("afterend", err);
        err.textContent = "صيغة المقاسات غير صحيحة";
        setTimeout(() => err.remove(), 10000);
        return;
      }
  }
  const id = document.getElementById("productId").value;
  const formData = new FormData();
  formData.append("name", name);
  formData.append("price", price);
  formData.append("stock", stock);
  formData.append("type", type);
  formData.append("sizes", sizesRaw);
  formData.append("colors", colorsRaw);
  formData.append("description", description);
  formData.append("category", category);

  const files = document.getElementById("images").files;
  for (let i = 0; i < files.length; i++) {
    formData.append("images", files[i]);
  }
  const videoFiles = document.getElementById("videos")?.files || [];
  for (let i = 0; i < videoFiles.length; i++) {
    formData.append("videos", videoFiles[i]);
  }

  const url = id ? `${API}/products/${id}` : `${API}/products`;
  const method = id ? "PUT" : "POST";
  const res = await fetch(url, { method, headers: adminHeaders(), body: formData });
  if (res.ok) {
    productForm.reset();
    document.getElementById("productId").value = "";
    submitProductBtn.textContent = "إضافة منتج";
    loadProducts();
  } else {
    let msg = "تعذر حفظ المنتج";
    try {
      const data = await res.json();
      if (data && data.error) msg = data.error;
    } catch {}
    alert(msg);
  }
});
}

if (document.getElementById("productsTableWrap")) loadProducts();
if (document.getElementById("ordersTableWrap")) loadOrders();
if (document.getElementById("commentsTableWrap")) {
  loadComments();
  document.getElementById("commentsStatusFilter")?.addEventListener("change", loadComments);
}

function loadComments() {
  const commentsWrap = document.getElementById("commentsTableWrap");
  if (!commentsWrap) return;
  const status = document.getElementById("commentsStatusFilter")?.value || "all";
  fetch(`${API}/comments`, { headers: adminHeaders() })
    .then(async (res) => {
      if (await handleAdminAuthFailure(res)) return [];
      if (!res.ok) return [];
      return res.json();
    })
    .then((comments) => {
      const list = (comments || []).filter((c) => {
        if (status === "pending") return !c.isApproved;
        if (status === "approved") return !!c.isApproved;
        return true;
      });
      if (!list.length) {
        commentsWrap.innerHTML = "<p style='color:var(--muted)'>لا توجد تعليقات.</p>";
        return;
      }
      commentsWrap.innerHTML = `
        <table class="admin-table">
          <thead>
            <tr>
              <th>المنتج</th>
              <th>العميل</th>
              <th>التعليق</th>
              <th>الحالة</th>
              <th>إجراءات</th>
            </tr>
          </thead>
          <tbody>
            ${list.map((c) => `
              <tr>
                <td>${c.productId || "-"}</td>
                <td>${c.userName || "-"}</td>
                <td>${c.text || ""}</td>
                <td>${c.isApproved ? "منشور" : "قيد المراجعة"}</td>
                <td>
                  ${c.isApproved ? "" : `<button type="button" class="admin-btn admin-btn-edit" data-approve="${c._id}">قبول</button>`}
                  <button type="button" class="admin-btn admin-btn-delete" data-reject="${c._id}">رفض</button>
                </td>
              </tr>
            `).join("")}
          </tbody>
        </table>
      `;
      commentsWrap.querySelectorAll("[data-approve]").forEach((btn) => {
        btn.addEventListener("click", async () => {
          const res = await fetch(`${API}/comments/${btn.dataset.approve}/approve`, { method: "PUT", headers: adminHeaders() });
          if (await handleAdminAuthFailure(res)) return;
          loadComments();
        });
      });
      commentsWrap.querySelectorAll("[data-reject]").forEach((btn) => {
        btn.addEventListener("click", async () => {
          const res = await fetch(`${API}/comments/${btn.dataset.reject}/reject`, { method: "PUT", headers: adminHeaders() });
          if (await handleAdminAuthFailure(res)) return;
          loadComments();
        });
      });
    })
    .catch(() => {
      commentsWrap.innerHTML = "<p style='color:var(--muted)'>تعذر تحميل التعليقات.</p>";
    });
}

function renderHero(images) {
  if (!heroPreview) return;
  if (!images || images.length === 0) {
    heroPreview.innerHTML = "<p style='color:var(--muted)'>لا توجد صور.</p>";
    return;
  }
  const html = images
    .map((img, idx) => {
      const src = img.startsWith("/uploads") ? BACKEND + img : img;
      return `
        <div class="hero-item" draggable="true" data-hero-index="${idx}" data-hero-src="${img}">
          <img src="${src}" alt="hero">
          <button type="button" class="hero-delete" data-img="${img}">حذف</button>
        </div>
      `;
    })
    .join("");
  heroPreview.innerHTML = html;
  heroPreview.querySelectorAll(".hero-delete").forEach(btn => {
    btn.addEventListener("click", async () => {
      const img = btn.dataset.img;
      const res = await fetch(`${API}/settings/hero?img=${encodeURIComponent(img)}`, { method: "DELETE", headers: adminHeaders() });
      if (await handleAdminAuthFailure(res)) return;
    if (res.ok) {
        const data = await res.json();
        renderHero(data.images || []);
      }
    });
  });
  let dragIndex = -1;
  heroPreview.querySelectorAll(".hero-item").forEach((item) => {
    item.addEventListener("dragstart", () => {
      dragIndex = Number(item.dataset.heroIndex);
      item.classList.add("dragging");
    });
    item.addEventListener("dragend", () => item.classList.remove("dragging"));
    item.addEventListener("dragover", (e) => e.preventDefault());
    item.addEventListener("drop", async () => {
      const target = Number(item.dataset.heroIndex);
      if (dragIndex < 0 || target < 0 || dragIndex === target) return;
      const next = [...images];
      const [moved] = next.splice(dragIndex, 1);
      next.splice(target, 0, moved);
      const saveRes = await fetch(`${API}/settings/hero`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", ...adminHeaders() },
        body: JSON.stringify({ images: next })
      });
      if (await handleAdminAuthFailure(saveRes)) return;
      if (saveRes.ok) {
        const data = await saveRes.json();
        renderHero(data.images || []);
      }
    });
  });
}

function loadHeroImages() {
  fetch(`${API}/settings/hero`, { headers: adminHeaders() })
    .then(res => res.json())
    .then(data => renderHero(data.images || []))
    .catch(() => {
      if (heroPreview) heroPreview.innerHTML = "<p style='color:var(--muted)'>تعذر تحميل الصور.</p>";
    });
}

if (heroForm) {
  heroForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const files = document.getElementById("heroImages").files;
    const formData = new FormData();
    for (let i = 0; i < files.length; i++) {
      formData.append("images", files[i]);
    }
    const res = await fetch(`${API}/settings/hero`, {
      method: "PUT",
      headers: adminHeaders(),
      body: formData
    });
    if (await handleAdminAuthFailure(res)) return;
    if (res.ok) {
      const data = await res.json();
      renderHero(data.images || []);
      heroForm.reset();
    } else {
      alert("تعذر تحديث صور السلايدر");
    }
  });
}

loadHeroImages();

const defaultCategories = [
  { key: "Men", labelAr: "رجالي", labelEn: "Men", enabled: true },
  { key: "Women", labelAr: "نسائي", labelEn: "Women", enabled: true },
  { key: "Children", labelAr: "أطفال", labelEn: "Children", enabled: true }
];

const defaultTypes = [
  { key: "hoodie", labelAr: "هودي", labelEn: "Hoodie", enabled: true },
  { key: "tshirt", labelAr: "تيشيرت", labelEn: "T-Shirt", enabled: true },
  { key: "pants", labelAr: "بنطلون", labelEn: "Pants", enabled: true },
  { key: "jacket", labelAr: "جاكيت", labelEn: "Jacket", enabled: true },
  { key: "shirt", labelAr: "قميص", labelEn: "Shirt", enabled: true },
  { key: "dress", labelAr: "فستان", labelEn: "Dress", enabled: true }
];

const categoriesWrap = document.getElementById("categoriesWrap");
const typesWrap = document.getElementById("typesWrap");
const saveFiltersBtn = document.getElementById("saveFiltersBtn");
const resetFiltersBtn = document.getElementById("resetFiltersBtn");
const addCategoryBtn = document.getElementById("addCategoryBtn");
const addTypeBtn = document.getElementById("addTypeBtn");
const newCategoryAr = document.getElementById("newCategoryAr");
const newCategoryEn = document.getElementById("newCategoryEn");
const newCategoryKey = document.getElementById("newCategoryKey");
const newTypeAr = document.getElementById("newTypeAr");
const newTypeEn = document.getElementById("newTypeEn");
const newTypeKey = document.getElementById("newTypeKey");
const productTypeSelect = document.getElementById("type");
const productCategorySelect = document.getElementById("category");

let filtersState = { categories: defaultCategories, types: defaultTypes };

function repairArabicText(value) {
  const text = String(value || "");
  if (!/(?:Ã.|Ø|Ù|Â)/.test(text)) return text;
  try {
    let fixed = text;
    for (let i = 0; i < 2; i += 1) {
      const bytes = Uint8Array.from(fixed.split("").map((ch) => ch.charCodeAt(0) & 0xff));
      const next = new TextDecoder("utf-8").decode(bytes);
      if (!next || next === fixed) break;
      fixed = next;
    }
    return fixed || text;
  } catch {
    return text;
  }
}

function normalizeArabicLabel(value, fallback) {
  const fixed = repairArabicText(value);
  return /[\u0600-\u06FF]/.test(fixed) ? fixed : fallback;
}

function normalizeFiltersLabels(state) {
  const categoryFallback = { Men: "رجالي", Women: "نسائي", Children: "أطفال" };
  const typeFallback = {
    hoodie: "هودي",
    tshirt: "تيشيرت",
    pants: "بنطلون",
    jacket: "جاكيت",
    shirt: "قميص",
    dress: "فستان"
  };
  const src = state || {};
  return {
    categories: (src.categories || []).map((c) => ({
      ...c,
      labelAr: normalizeArabicLabel(c.labelAr, categoryFallback[c.key] || c.labelAr || c.key)
    })),
    types: (src.types || []).map((t) => ({
      ...t,
      labelAr: normalizeArabicLabel(t.labelAr, typeFallback[t.key] || t.labelAr || t.key)
    }))
  };
}

function populateProductSelectors() {
  if (!productTypeSelect || !productCategorySelect) return;
  const enabledTypes = (filtersState.types || []).filter((t) => t.enabled);
  const enabledCategories = (filtersState.categories || []).filter((c) => c.enabled);

  productTypeSelect.innerHTML = enabledTypes
    .map((t) => `<option value="${t.key}">${repairArabicText(t.labelAr) || t.key}</option>`)
    .join("");
  productCategorySelect.innerHTML = enabledCategories
    .map((c) => `<option value="${c.key}">${repairArabicText(c.labelAr) || c.key}</option>`)
    .join("");

  if (!productTypeSelect.value && enabledTypes[0]) productTypeSelect.value = enabledTypes[0].key;
  if (!productCategorySelect.value && enabledCategories[0]) productCategorySelect.value = enabledCategories[0].key;
}

function renderFilterList(wrap, list) {
  if (!wrap) return;
  wrap.innerHTML = list
    .map(
      item => `
      <div class="filter-item">
        <label>
          <input type="checkbox" data-key="${item.key}" ${item.enabled ? "checked" : ""}>
          ${repairArabicText(item.labelAr)}
        </label>
        <button type="button" class="filter-delete" data-key="${item.key}">حذف</button>
      </div>
    `
    )
    .join("");
}

function loadFilters() {
  fetch(`${API}/settings/shop`)
    .then(res => res.json())
    .then(data => {
      if (data.filters && data.filters.categories && data.filters.types) {
        filtersState = normalizeFiltersLabels(data.filters);
      }
      filtersState = normalizeFiltersLabels(filtersState);
      renderFilterList(categoriesWrap, filtersState.categories);
      renderFilterList(typesWrap, filtersState.types);
      populateProductSelectors();
    });
}

function bindFilterEvents() {
  if (!categoriesWrap || !typesWrap) return;
  categoriesWrap.addEventListener("change", (e) => {
    const key = e.target.dataset.key;
    const item = filtersState.categories.find(x => x.key === key);
    if (item) item.enabled = e.target.checked;
  });
  typesWrap.addEventListener("change", (e) => {
    const key = e.target.dataset.key;
    const item = filtersState.types.find(x => x.key === key);
    if (item) item.enabled = e.target.checked;
  });
  categoriesWrap.addEventListener("click", (e) => {
    if (!e.target.classList.contains("filter-delete")) return;
    const key = e.target.dataset.key;
    filtersState.categories = filtersState.categories.filter(x => x.key !== key);
    renderFilterList(categoriesWrap, filtersState.categories);
  });
  typesWrap.addEventListener("click", (e) => {
    if (!e.target.classList.contains("filter-delete")) return;
    const key = e.target.dataset.key;
    filtersState.types = filtersState.types.filter(x => x.key !== key);
    renderFilterList(typesWrap, filtersState.types);
  });
}

if (saveFiltersBtn) {
  saveFiltersBtn.addEventListener("click", async () => {
    const res = await fetch(`${API}/settings/shop`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", ...adminHeaders() },
      body: JSON.stringify(filtersState)
    });
    if (await handleAdminAuthFailure(res)) return;
    if (res.ok) {
      alert("تم حفظ التغييرات");
    } else {
      const data = await parseJsonSafe(res);
      alert((data && data.error) ? data.error : "تعذر حفظ التغييرات");
    }
  });
}

if (resetFiltersBtn) {
  resetFiltersBtn.addEventListener("click", () => {
    filtersState = {
      categories: JSON.parse(JSON.stringify(defaultCategories)),
      types: JSON.parse(JSON.stringify(defaultTypes))
    };
    renderFilterList(categoriesWrap, filtersState.categories);
    renderFilterList(typesWrap, filtersState.types);
    populateProductSelectors();
  });
}

function normalizeKey(value) {
  return (value || "").trim();
}

function isValidKey(value) {
  return /^[A-Za-z0-9_-]+$/.test(value || "");
}

if (addCategoryBtn) {
  addCategoryBtn.addEventListener("click", () => {
    document.querySelectorAll(".field-error").forEach(e => e.remove());
    const key = normalizeKey(newCategoryKey.value);
    const labelAr = (newCategoryAr.value || "").trim();
    const labelEn = (newCategoryEn.value || "").trim();
    if (!key || !labelAr || !labelEn) {
      const err = document.createElement("p");
      err.className = "field-error shake";
      addCategoryBtn.insertAdjacentElement("beforebegin", err);
      err.textContent = "أدخل البيانات كاملة للقسم";
      setTimeout(() => err.remove(), 10000);
      return;
    }
    if (!isValidKey(key)) {
      const err = document.createElement("p");
      err.className = "field-error shake";
      addCategoryBtn.insertAdjacentElement("beforebegin", err);
      err.textContent = "الكود يجب أن يكون إنجليزي بدون مسافات أو حروف عربية";
      setTimeout(() => err.remove(), 10000);
      return;
    }
    if (filtersState.categories.find(c => c.key === key)) {
      alert("الكود مستخدم بالفعل");
      return;
    }
    filtersState.categories.push({ key, labelAr, labelEn, enabled: true });
    renderFilterList(categoriesWrap, filtersState.categories);
    populateProductSelectors();
    newCategoryKey.value = "";
    newCategoryAr.value = "";
    newCategoryEn.value = "";
  });
}

if (addTypeBtn) {
  addTypeBtn.addEventListener("click", () => {
    document.querySelectorAll(".field-error").forEach(e => e.remove());
    const key = normalizeKey(newTypeKey.value);
    const labelAr = (newTypeAr.value || "").trim();
    const labelEn = (newTypeEn.value || "").trim();
    if (!key || !labelAr || !labelEn) {
      const err = document.createElement("p");
      err.className = "field-error shake";
      addTypeBtn.insertAdjacentElement("beforebegin", err);
      err.textContent = "أدخل البيانات كاملة للنوع";
      setTimeout(() => err.remove(), 10000);
      return;
    }
    if (!isValidKey(key)) {
      const err = document.createElement("p");
      err.className = "field-error shake";
      addTypeBtn.insertAdjacentElement("beforebegin", err);
      err.textContent = "الكود يجب أن يكون إنجليزي بدون مسافات أو حروف عربية";
      setTimeout(() => err.remove(), 10000);
      return;
    }
    if (filtersState.types.find(t => t.key === key)) {
      alert("الكود مستخدم بالفعل");
      return;
    }
    filtersState.types.push({ key, labelAr, labelEn, enabled: true });
    renderFilterList(typesWrap, filtersState.types);
    populateProductSelectors();
    newTypeKey.value = "";
    newTypeAr.value = "";
    newTypeEn.value = "";
  });
}

loadFilters();
bindFilterEvents();

function bindAdminMenu() {
  const adminLogoutBtn = document.getElementById("adminLogoutBtn");
  if (adminLogoutBtn) {
  adminLogoutBtn.addEventListener("click", () => {
    const token = localStorage.getItem("admin_token");
    if (token) {
      fetch(`${BACKEND}/api/auth/admin/logout`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` }
      }).catch(() => {});
    }
    localStorage.removeItem("admin_token");
    localStorage.removeItem("admin_user");
    location.href = "admin-login.html";
  });
}

  const menuBtn = document.querySelector(".menu-btn");
  const sideMenu = document.getElementById("sideMenu");
  const overlay = document.getElementById("menuOverlay");
  if (menuBtn && sideMenu && overlay) {
    const close = () => {
      sideMenu.classList.remove("open");
      overlay.classList.remove("open");
    };
    menuBtn.addEventListener("click", () => {
      sideMenu.classList.toggle("open");
      overlay.classList.toggle("open");
    });
    overlay.addEventListener("click", close);
  }
}

document.addEventListener("DOMContentLoaded", bindAdminMenu);

function setupAdminDarkMode() {
  const key = "admin_dark_mode";
  const isDark = localStorage.getItem(key) === "1";
  document.body.classList.toggle("admin-dark", isDark);
  const topbar = document.querySelector(".admin-topbar-inner");
  if (!topbar || document.getElementById("adminDarkToggle")) return;
  const btn = document.createElement("button");
  btn.id = "adminDarkToggle";
  btn.type = "button";
  btn.className = "icon-btn";
  btn.textContent = isDark ? "☀" : "🌙";
  btn.title = "Dark mode";
  btn.addEventListener("click", () => {
    const nowDark = !document.body.classList.contains("admin-dark");
    document.body.classList.toggle("admin-dark", nowDark);
    localStorage.setItem(key, nowDark ? "1" : "0");
    btn.textContent = nowDark ? "☀" : "🌙";
  });
  topbar.appendChild(btn);
}

async function loadDashboardAlerts() {
  const quickStats = document.getElementById("adminQuickStats");
  if (!quickStats) return;
  try {
    const [overviewRes, stockRes] = await Promise.all([
      fetch(`${API}/admin/dashboard/overview`, { headers: adminHeaders() }),
      fetch(`${API}/admin/alerts/stock`, { headers: adminHeaders() })
    ]);
    if (!overviewRes.ok || !stockRes.ok) {
      quickStats.innerHTML = "<div class='admin-card'>تعذر تحميل الإحصائيات.</div>";
      return;
    }
    const overview = await overviewRes.json();
    const stock = await stockRes.json();
    quickStats.innerHTML = `
      <div class="admin-card">إجمالي النقاط الممنوحة<br><strong>${Number(overview.loyaltyPointsIssued || 0)}</strong></div>
      <div class="admin-card">عدد السلال المتروكة<br><strong>${Number(overview.activeAbandoned || 0)}</strong></div>
      <div class="admin-card">منتجات منخفضة المخزون<br><strong>${Number(stock.count || 0)}</strong></div>
    `;
    const thresholdTools = document.getElementById("adminThresholdTools");
    const thresholdInput = document.getElementById("adminLowStockThreshold");
    const thresholdBtn = document.getElementById("saveLowStockThresholdBtn");
    if (thresholdTools && thresholdInput && thresholdBtn) {
      thresholdTools.style.display = "";
      thresholdInput.value = Number(stock.threshold || 5);
      thresholdBtn.onclick = async () => {
        const threshold = Math.max(1, Number(thresholdInput.value || 5));
        thresholdBtn.disabled = true;
        const saveRes = await fetch(`${API}/admin/alerts/stock-threshold`, {
          method: "PUT",
          headers: { "Content-Type": "application/json", ...adminHeaders() },
          body: JSON.stringify({ threshold })
        });
        thresholdBtn.disabled = false;
        if (await handleAdminAuthFailure(saveRes)) return;
        if (!saveRes.ok) {
          alert("تعذر حفظ حد التنبيه");
          return;
        }
        alert("تم تحديث حد تنبيه المخزون");
        loadDashboardAlerts();
      };
    }
  } catch {
    quickStats.innerHTML = "<div class='admin-card'>تعذر تحميل الإحصائيات.</div>";
  }
}

const siteForm = document.getElementById("siteForm");
if (siteForm) {
  const preview = document.getElementById("sitePreview");
  const renderPreview = (site = {}) => {
    if (!preview) return;
    const title = site.title || "Hand Aura";
    const desc = site.description || "متجر Hand Aura";
    const image = site.image ? (site.image.startsWith("/uploads") ? BACKEND + site.image : site.image) : "";
    preview.innerHTML = `
      <div class="admin-note">
        <div style="color:#1a0dab;font-size:1rem">${title}</div>
        <div style="color:#006621;font-size:.8rem">${location.origin}</div>
        <div style="color:var(--muted)">${desc}</div>
        ${image ? `<img src="${image}" alt="site preview" style="margin-top:10px;max-width:220px;border-radius:10px">` : ""}
      </div>
    `;
  };

  fetch(`${API}/settings/site`, { headers: adminHeaders() })
    .then((res) => res.json())
    .then((data) => {
      const site = data.site || {};
      document.getElementById("siteTitle").value = site.title || "";
      document.getElementById("siteDescription").value = site.description || "";
      renderPreview(site);
    })
    .catch(() => {});

  siteForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const fd = new FormData();
    fd.append("title", document.getElementById("siteTitle").value.trim());
    fd.append("description", document.getElementById("siteDescription").value.trim());
    const file = document.getElementById("siteImage").files?.[0];
    if (file) fd.append("siteImage", file);
    const res = await fetch(`${API}/settings/site`, {
      method: "PUT",
      headers: adminHeaders(),
      body: fd
    });
    if (await handleAdminAuthFailure(res)) return;
    if (!res.ok) return alert("تعذر حفظ إعدادات الموقع");
    const data = await res.json();
    renderPreview(data.site || {});
    alert("تم حفظ إعدادات الموقع");
  });
}

document.addEventListener("DOMContentLoaded", () => {
  document.querySelectorAll("select").forEach((sel) => {
    sel.addEventListener("focus", () => sel.classList.add("select-open"));
    sel.addEventListener("blur", () => sel.classList.remove("select-open"));
    sel.addEventListener("change", () => sel.classList.remove("select-open"));
  });
});

const adminPasswordForm = document.getElementById("adminPasswordForm");
if (adminPasswordForm) {
  adminPasswordForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const msg = document.getElementById("adminPasswordMsg");
    msg.textContent = "";
    const currentPassword = document.getElementById("adminCurrentPassword").value;
    const newPassword = document.getElementById("adminNewPassword").value;
    if (!currentPassword || !newPassword || newPassword.length < 6) {
      msg.textContent = "كلمة المرور الجديدة يجب ألا تقل عن 6 أحرف";
      return;
    }
    const res = await fetch(`${API}/auth/admin/password`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", ...adminHeaders() },
      body: JSON.stringify({ currentPassword, newPassword })
    });
    if (await handleAdminAuthFailure(res)) return;
    if (res.ok) {
      msg.textContent = "تم تحديث كلمة المرور";
      adminPasswordForm.reset();
      setTimeout(() => (msg.textContent = ""), 10000);
    } else {
      let m = "تعذر تحديث كلمة المرور";
      try {
        const data = await res.json();
        if (data && data.error) m = data.error;
      } catch {}
      msg.textContent = m;
      setTimeout(() => (msg.textContent = ""), 10000);
    }
  });
}

document.addEventListener("DOMContentLoaded", () => {
  setupAdminDarkMode();
  loadDashboardAlerts();
});





