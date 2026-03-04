const host = window.location.hostname;
const isCapacitorApp = !!(window.Capacitor && (window.Capacitor.isNativePlatform ? window.Capacitor.isNativePlatform() : true));
const isLocal = /^(localhost|127[.]0[.]0[.]1)$/i.test(host);
const DEPLOY_BACKEND = "https://ecommerce-api-production-c3a5.up.railway.app";
const LOCAL_BACKEND = "http://" + host + ":5000";
let BACKEND = isCapacitorApp ? DEPLOY_BACKEND : (isLocal && localStorage.getItem("use_local_api") === "1" ? LOCAL_BACKEND : DEPLOY_BACKEND);
let API = BACKEND + "/api";let allProducts = [];
function installAutoBackendFallback(localBase, deployBase) {
  if (!localBase || !deployBase || localBase === deployBase || window.__haFetchFallbackInstalled) return;
  const nativeFetch = window.fetch.bind(window);
  window.fetch = async (input, init) => {
    if (typeof input !== "string") return nativeFetch(input, init);
    try {
      return await nativeFetch(input, init);
    } catch (err) {
      if (!input.startsWith(localBase)) throw err;
      const fallbackUrl = input.replace(localBase, deployBase);
      BACKEND = deployBase;
      API = `${deployBase}/api`;
      return nativeFetch(fallbackUrl, init);
    }
  };
  window.__haFetchFallbackInstalled = true;
}

if (isLocal && !isCapacitorApp && localStorage.getItem("use_local_api") === "1") {
  installAutoBackendFallback(LOCAL_BACKEND, DEPLOY_BACKEND);
}
let activeCategory = "";
let activeType = "";
let activeSearch = "";
let activePopular = false;
let popularityMap = {};
let currentLang = "ar";
let filtersState = null;
let currentModalProduct = null;
let modalImages = [];
let modalImageIndex = 0;
let lastFocusedBeforeModal = null;
let myRatings = {};
let pendingRatings = {};
let heroSliderTimer = null;
let lockedPageScrollY = 0;

function authHeaders() {
  const token = localStorage.getItem("auth_token");
  if (!token || token.split(".").length !== 3) return {};
  return { Authorization: `Bearer ${token}` };
}

function escapeHtml(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function resolveColorValue(rawColor) {
  const value = String(rawColor || "").trim();
  if (!value) return "#dddddd";
  const lower = value.toLowerCase();
  const named = {
    black: "#000000",
    white: "#ffffff",
    red: "#e11d48",
    blue: "#2563eb",
    green: "#16a34a",
    yellow: "#eab308",
    orange: "#f97316",
    purple: "#7c3aed",
    pink: "#ec4899",
    gray: "#6b7280",
    grey: "#6b7280",
    brown: "#92400e",
    beige: "#d6c6a6",
    navy: "#1e3a8a",
    gold: "#d4af37",
    silver: "#9ca3af",
    "اسود": "#000000",
    "أبيض": "#ffffff",
    "ابيض": "#ffffff",
    "احمر": "#e11d48",
    "أحمر": "#e11d48",
    "ازرق": "#2563eb",
    "أزرق": "#2563eb",
    "اخضر": "#16a34a",
    "أخضر": "#16a34a",
    "اصفر": "#eab308",
    "أصفر": "#eab308",
    "رمادي": "#6b7280",
    "بني": "#92400e"
  };
  if (named[lower]) return named[lower];
  if (/^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(value)) return value;
  if (/^(rgb|rgba|hsl|hsla)\(/i.test(value)) return value;
  return "#dddddd";
}

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

const DEFAULT_HERO_IMAGES = [];
let HERO_IMAGES = [...DEFAULT_HERO_IMAGES];

function normalize(value) {
  return (value || "").toString().toLowerCase();
}

function backendCandidates() {
  if (isLocal) return [LOCAL_BACKEND, DEPLOY_BACKEND];
  return [DEPLOY_BACKEND];
}

async function detectBackend() {
  const candidates = backendCandidates();
  for (const candidate of candidates) {
    try {
      const res = await fetch(`${candidate}/`, { method: "GET" });
      if (!res.ok) continue;
      BACKEND = candidate;
      API = `${candidate}/api`;
      return;
    } catch {}
  }
  BACKEND = candidates[0] || DEPLOY_BACKEND;
  API = `${BACKEND}/api`;
}

function getCart() {
  return JSON.parse(localStorage.getItem("cart") || "[]");
}

function setCart(cart) {
  localStorage.setItem("cart", JSON.stringify(cart));
  updateCartCount();
}

function updateCartCount() {
  const el = document.getElementById("cartCount");
  if (el) {
    const cart = getCart();
    const count = cart.reduce((sum, i) => sum + i.quantity, 0);
    el.textContent = count;
  }
}

function showCartNotice(message) {
  let notice = document.getElementById("cartNotice");
  if (!notice) {
    notice = document.createElement("div");
    notice.id = "cartNotice";
    notice.className = "cart-notice";
    document.body.appendChild(notice);
  }
  notice.textContent = message;
  notice.classList.add("show");
  setTimeout(() => notice.classList.remove("show"), 1600);
}

function addToCart(product, qty = 1, selected = {}) {
  const token = localStorage.getItem("auth_token");
  if (!token) {
    alert(t("login_first"));
    location.href = "login.html";
    return;
  }
  const sizeSelect = document.querySelector(`.size-select[data-id="${product._id}"]`);
  const selectedSizePill = document.querySelector(`.size-pills[data-id="${product._id}"] .size-pill.active`);
  const selectedColorPill = document.querySelector(`.color-pills[data-id="${product._id}"] .color-pill.active`);
  const selectedSize = selected.size || (selectedSizePill ? (selectedSizePill.dataset.size || "") : (sizeSelect ? sizeSelect.value : ""));
  const selectedColor = selected.color || (selectedColorPill ? (selectedColorPill.dataset.color || "") : "");
  if (product.sizes && product.sizes.length && !selectedSize) {
    alert(t("choose_size_alert"));
    return;
  }
  const cart = getCart();
  const existing = cart.find(i => i.productId === product._id && (i.size || "") === (selectedSize || "") && (i.color || "") === (selectedColor || ""));
  if (existing) {
    existing.quantity = Math.min((existing.quantity || 0) + qty, product.stock);
  } else {
    cart.push({
      productId: product._id,
      name: product.name,
      price: product.price,
      image: (product.images && product.images[0]) || product.image,
      size: selectedSize || "",
      color: selectedColor || "",
      quantity: Math.min(qty, product.stock)
    });
  }
  setCart(cart);
  showCartNotice(currentLang === "ar" ? "تمت إضافة المنتج للسلة" : "Added to cart");
  if (typeof window.trackAnalyticsEvent === "function") {
    window.trackAnalyticsEvent("add_to_cart", {
      productId: product._id,
      name: product.name,
      quantity: qty,
      size: selectedSize || "",
      color: selectedColor || ""
    });
  }
}

function selectedRatingFor(productId) {
  const id = String(productId || "");
  return Number(myRatings[id] || pendingRatings[id] || 0);
}

function hasRatedProduct(productId) {
  return Number(myRatings[String(productId || "")] || 0) > 0;
}

function buildInteractiveStars(productId, selected, locked) {
  const id = String(productId || "");
  let html = '<div class="rating-input-stars" data-id="' + id + '">';
  for (let i = 1; i <= 5; i += 1) {
    const active = i <= selected ? " is-active" : "";
    const disabled = locked ? " disabled" : "";
    html += `<button type="button" class="rating-star-btn${active}" data-id="${id}" data-value="${i}" aria-label="rate-${i}"${disabled}>★</button>`;
  }
  html += "</div>";
  return html;
}

async function submitRating(productId, rating, hooks = {}) {
  const id = String(productId || "");
  const {
    confirmBtn = null,
    msgEl = null,
    onDone = null
  } = hooks;
  if (!rating) {
    if (msgEl) msgEl.textContent = t("choose_rating");
    return;
  }
  if (hasRatedProduct(id)) {
    if (msgEl) msgEl.textContent = t("already_rated");
    return;
  }
  if (confirmBtn) confirmBtn.disabled = true;
  try {
    const res = await fetch(`${API}/products/${id}/rate`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeaders() },
      body: JSON.stringify({ rating })
    });
    if (!res.ok) {
      let msg = t("rating_error");
      try {
        const data = await res.json();
        if (res.status === 409) {
          const existing = Number(data?.rating || 0);
          if (existing) myRatings[id] = existing;
          delete pendingRatings[id];
          msg = t("already_rated");
        } else if (data?.error) {
          msg = data.error;
        }
      } catch {}
      if (msgEl) msgEl.textContent = msg;
      if (typeof onDone === "function") onDone(false);
      return;
    }
    const updated = await res.json();
    const idx = allProducts.findIndex((x) => x._id === updated._id);
    if (idx >= 0) allProducts[idx] = updated;
    myRatings[id] = Number(rating);
    delete pendingRatings[id];
    if (confirmBtn) {
      confirmBtn.classList.add("is-saved");
      setTimeout(() => {
        confirmBtn.classList.add("is-hidden");
      }, 450);
    }
    if (msgEl) msgEl.textContent = t("rating_sent");
    if (typeof onDone === "function") onDone(true, updated);
    updateView();
  } catch {
    if (msgEl) msgEl.textContent = t("rating_error");
    if (typeof onDone === "function") onDone(false);
  } finally {
    if (confirmBtn && !confirmBtn.classList.contains("is-hidden")) {
      confirmBtn.disabled = false;
    }
  }
}

async function loadMyRatings() {
  const token = localStorage.getItem("auth_token");
  if (!token || token.split(".").length !== 3) {
    myRatings = {};
    pendingRatings = {};
    return;
  }
  try {
    const res = await fetch(`${API}/products/ratings/mine`, { headers: authHeaders() });
    if (!res.ok) return;
    const data = await res.json();
    myRatings = (data && data.ratings) || {};
  } catch {}
}

function render(products) {
  const productsDiv = document.getElementById("products");
  if (!productsDiv) return;
  productsDiv.innerHTML = "";
  products.forEach(p => {
    const cart = getCart();
    const inCart = cart.find(i => i.productId === p._id);
    const qty = inCart ? inCart.quantity : 0;
    const left = Math.max(0, (p.stock || 0) - qty);
    let imgSrc = (p.images && p.images[0]) || p.image || "https://via.placeholder.com/300";
    if (imgSrc && imgSrc.startsWith("/uploads")) {
      imgSrc = BACKEND + imgSrc;
    }
    const card = document.createElement("div");
    card.className = "card";
    const typeLabel = (value) => {
      if (currentLang === "ar") {
        if (value === "hoodie") return "هودي";
        if (value === "tshirt") return "تيشيرت";
        if (value === "pants") return "بنطلون";
        if (value === "jacket") return "جاكيت";
        if (value === "shirt") return "قميص";
        if (value === "dress") return "فستان";
        return value || "-";
      }
      if (value === "hoodie") return "Hoodie";
      if (value === "tshirt") return "T-Shirt";
      if (value === "pants") return "Pants";
      if (value === "jacket") return "Jacket";
      if (value === "shirt") return "Shirt";
      if (value === "dress") return "Dress";
      return value || "-";
    };
    const sizes = (p.sizes && p.sizes.length)
      ? `<div class="meta variant-label">${currentLang === "ar" ? "المقاسات" : "Sizes"}</div>
         <div class="size-pills" data-id="${p._id}">
           ${p.sizes.map((s, idx) => `<button type="button" class="size-pill${idx === 0 ? " active" : ""}" data-size="${escapeHtml(s)}" aria-label="${escapeHtml(s)}">${escapeHtml(s)}</button>`).join("")}
         </div>`
      : "";
    const colors = (p.colors && p.colors.length)
      ? `<div class="meta variant-label">${currentLang === "ar" ? "الألوان" : "Colors"}</div>
        <div class="color-pills" data-id="${p._id}">
          ${p.colors.map((c, idx) => `<button type="button" class="color-pill${idx === 0 ? " active" : ""}" data-color="${escapeHtml(c)}" title="${escapeHtml(c)}" style="--swatch:${resolveColorValue(c)}" aria-label="${escapeHtml(c)}"></button>`).join("")}
        </div>`
      : "";
    const avg = Number(p.avgRating || 0);
    const stars = "★★★★★☆☆☆☆☆".slice(5 - Math.round(avg), 10 - Math.round(avg));
    const recentRatings = (p.ratings || []).slice(-6).map(r => Number(r).toFixed(0)).join(", ");
    const savedRating = Number(myRatings[p._id] || 0);
    const draftRating = Number(pendingRatings[p._id] || savedRating || 0);
    const ratingLocked = savedRating > 0;
    const ratingHtml = `
      <div class="rating-row">
        <span class="rating-stars">${stars}</span>
        <span class="rating-text">${avg.toFixed(1)} (${p.ratingsCount || 0})</span>
        ${buildInteractiveStars(p._id, draftRating, ratingLocked)}
        <button type="button" class="rating-confirm-btn${ratingLocked ? " is-hidden" : ""}" data-id="${p._id}" aria-label="${t("confirm_rating")}">&#10003;</button>
        <span class="rating-msg" data-id="${p._id}"></span>
      </div>
      ${savedRating ? `<div class="rating-users">${t("your_rating")}: ${savedRating} ★</div>` : ""}
      ${recentRatings ? `<div class="rating-users">${t("ratings_users")}: ${recentRatings}</div>` : ""}
    `;
    card.innerHTML = `
      <img class="card-image" src="${imgSrc}" alt="${p.name}" loading="lazy" decoding="async">
      <div class="card-body">
        <h3>${p.name}</h3>
        <p class="price">${Number(p.price).toFixed(0)} ${t("currency")}</p>
        <p class="stock">${t("available")}: ${left}</p>
        <p class="meta">${t("type_label")}: ${typeLabel(p.type)}</p>
        ${colors}
        ${sizes}
        ${ratingHtml}
        <button class="add-btn" data-id="${p._id}" ${left <= 0 ? "disabled" : ""}>${t("add_to_cart")}</button>
      </div>
    `;
    const btn = card.querySelector(".add-btn");
    btn.addEventListener("click", () => {
      addToCart(p);
      updateView();
    });
    card.querySelectorAll(".size-pill").forEach((pill) => {
      pill.addEventListener("click", (event) => {
        event.stopPropagation();
        const row = pill.closest(".size-pills");
        if (!row) return;
        row.querySelectorAll(".size-pill").forEach(x => x.classList.remove("active"));
        pill.classList.add("active");
      });
    });
    card.querySelectorAll(".color-pill").forEach((pill) => {
      pill.addEventListener("click", (event) => {
        event.stopPropagation();
        const row = pill.closest(".color-pills");
        if (!row) return;
        row.querySelectorAll(".color-pill").forEach(x => x.classList.remove("active"));
        pill.classList.add("active");
      });
    });
    card.addEventListener("click", (event) => {
      if (event.target.closest("button, select, textarea, input, a")) return;
      openProductModal(p);
    });
    productsDiv.appendChild(card);
  });

  productsDiv.querySelectorAll(".rating-star-btn").forEach(btn => {
    btn.addEventListener("click", async () => {
      const id = btn.dataset.id;
      if (hasRatedProduct(id)) return;
      const rating = Number(btn.dataset.value || 0);
      pendingRatings[id] = rating;
      const row = productsDiv.querySelector(`.rating-input-stars[data-id="${id}"]`);
      if (row) {
        row.querySelectorAll(".rating-star-btn").forEach((star) => {
          const value = Number(star.dataset.value || 0);
          star.classList.toggle("is-active", value <= rating);
        });
      }
      const msg = productsDiv.querySelector(`.rating-msg[data-id="${id}"]`);
      if (msg) msg.textContent = "";
    });
  });

  productsDiv.querySelectorAll(".rating-confirm-btn").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const id = btn.dataset.id;
      const rating = selectedRatingFor(id);
      const msg = productsDiv.querySelector(`.rating-msg[data-id="${id}"]`);
      await submitRating(id, rating, { confirmBtn: btn, msgEl: msg });
    });
  });
}

function normalizeMediaSource(src) {
  const value = String(src || "").trim();
  if (!value) return "";
  return value.startsWith("/uploads") ? BACKEND + value : value;
}

function isVideoSource(src) {
  const value = String(src || "").toLowerCase().split("?")[0];
  return value.endsWith(".mp4") || value.endsWith(".webm") || value.endsWith(".ogg") || value.endsWith(".mov");
}

function getProductMedia(product) {
  const images = (product.images && product.images.length ? product.images : [product.image])
    .map(normalizeMediaSource)
    .filter(Boolean)
    .map((src) => ({ type: "image", src }));
  const videos = (product.videos && product.videos.length ? product.videos : [product.video])
    .map(normalizeMediaSource)
    .filter(Boolean)
    .map((src) => ({ type: "video", src }));
  const list = [...images, ...videos];
  if (!list.length) {
    return [{ type: "image", src: "https://via.placeholder.com/800x1000?text=Product" }];
  }
  return list;
}

function renderModalImage() {
  const modalImage = document.getElementById("modalImage");
  const modalVideo = document.getElementById("modalVideo");
  if (!modalImage) return;
  const item = modalImages[modalImageIndex];
  if (!item) return;
  const media = typeof item === "string"
    ? { type: isVideoSource(item) ? "video" : "image", src: item }
    : item;

  if (media.type === "video") {
    if (modalVideo) {
      modalVideo.style.display = "";
      modalVideo.src = media.src || "";
      modalVideo.currentTime = 0;
      modalVideo.load();
    }
    modalImage.style.display = "none";
    modalImage.src = "";
  } else {
    if (modalVideo) {
      modalVideo.pause();
      modalVideo.style.display = "none";
      modalVideo.removeAttribute("src");
      modalVideo.load();
    }
    modalImage.style.display = "";
    modalImage.src = media.src || "";
  }
}

function closeProductModal() {
  const modal = document.getElementById("productModal");
  if (!modal) return;
  const modalVideo = document.getElementById("modalVideo");
  if (modalVideo) {
    modalVideo.pause();
    modalVideo.removeAttribute("src");
    modalVideo.load();
  }
  if (modal.contains(document.activeElement)) {
    document.activeElement.blur();
  }
  modal.classList.remove("open");
  modal.setAttribute("aria-hidden", "true");
  document.body.classList.remove("modal-open");
  if (Number.isFinite(lockedPageScrollY)) {
    requestAnimationFrame(() => window.scrollTo(0, lockedPageScrollY));
  }
  currentModalProduct = null;
  if (lastFocusedBeforeModal && typeof lastFocusedBeforeModal.focus === "function") {
    lastFocusedBeforeModal.focus();
  }
}

async function loadAndRenderComments(productId, wrap) {
  if (!wrap || !productId) return;
  let comments = [];
  try {
    const res = await fetch(`${API}/products/${productId}/comments`);
    comments = res.ok ? await res.json() : [];
  } catch {}

  wrap.innerHTML = `
    <div class="modal-label">${currentLang === "ar" ? "التعليقات" : "Comments"}</div>
    <div class="modal-comments-list">
      ${(comments || []).length
        ? comments.map((c) => `<div class="admin-note" style="margin-bottom:6px"><strong>${escapeHtml(c.userName || "User")}:</strong> ${escapeHtml(c.text || "")}</div>`).join("")
        : `<p style="color:var(--muted)">${currentLang === "ar" ? "لا توجد تعليقات منشورة بعد." : "No approved comments yet."}</p>`}
    </div>
    <div class="modal-comment-form" style="margin-top:8px;display:grid;gap:8px">
      <textarea id="modalCommentText" rows="3" placeholder="${currentLang === "ar" ? "اكتب تعليقك..." : "Write your comment..."}"></textarea>
      <button type="button" id="modalCommentSend" class="comment-send-pill">${currentLang === "ar" ? "إرسال التعليق" : "Send Comment"}</button>
      <span id="modalCommentMsg" style="color:var(--muted)"></span>
    </div>
  `;

  const sendBtn = document.getElementById("modalCommentSend");
  const txt = document.getElementById("modalCommentText");
  const msg = document.getElementById("modalCommentMsg");
  if (!sendBtn || !txt || !msg) return;
  sendBtn.addEventListener("click", async () => {
    const token = localStorage.getItem("auth_token");
    if (!token) {
      msg.textContent = currentLang === "ar" ? "سجل الدخول أولاً." : "Please login first.";
      return;
    }
    const text = String(txt.value || "").trim();
    if (text.length < 2) {
      msg.textContent = currentLang === "ar" ? "التعليق قصير." : "Comment is too short.";
      return;
    }
    sendBtn.disabled = true;
    msg.textContent = currentLang === "ar" ? "جارٍ الإرسال..." : "Sending...";
    try {
      const res = await fetch(`${API}/products/${productId}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({ text })
      });
      if (!res.ok) {
        let errorMsg = currentLang === "ar" ? "تعذر إرسال التعليق." : "Failed to send comment.";
        try {
          const d = await res.json();
          if (d && d.error) errorMsg = d.error;
        } catch {}
        msg.textContent = errorMsg;
      } else {
        txt.value = "";
        msg.textContent = currentLang === "ar" ? "تم إرسال تعليقك وبانتظار موافقة الأدمن." : "Comment submitted and waiting admin approval.";
      }
    } catch {
      msg.textContent = currentLang === "ar" ? "تعذر الاتصال بالخادم." : "Server connection failed.";
    } finally {
      sendBtn.disabled = false;
    }
  });
}

function openProductModal(product) {
  const modal = document.getElementById("productModal");
  if (!modal) return;
  currentModalProduct = product;
  if (typeof window.trackAnalyticsEvent === "function") {
    window.trackAnalyticsEvent("view_product", { productId: product._id, name: product.name });
  }
  lastFocusedBeforeModal = document.activeElement;
  modalImages = getProductMedia(product);
  modalImageIndex = 0;

  const modalTitle = document.getElementById("modalTitle");
  const modalPrice = document.getElementById("modalPrice");
  const modalDesc = document.getElementById("modalDesc");
  const modalStock = document.getElementById("modalStock");
  const modalType = document.getElementById("modalType");
  const modalSizes = document.getElementById("modalSizes");
  const modalColors = document.getElementById("modalColors");
  const modalRecommendations = document.getElementById("modalRecommendations");
  const modalRating = document.getElementById("modalRating");
  const modalAddBtn = document.getElementById("modalAddBtn");
  const modalComments = document.getElementById("modalComments");

  if (modalTitle) modalTitle.textContent = product.name || "";
  if (modalPrice) modalPrice.textContent = `${Number(product.price || 0).toFixed(0)} ${t("currency")}`;
  if (modalDesc) modalDesc.textContent = product.description || "";
  if (modalStock) modalStock.textContent = `${t("available")}: ${Math.max(0, Number(product.stock || 0))}`;
  if (modalType) modalType.textContent = `${t("type_label")}: ${product.type || "-"}`;

  if (modalSizes) {
    if (product.sizes && product.sizes.length) {
      modalSizes.innerHTML = `
        <div class="modal-label">${t("sizes_label")}</div>
        <div class="size-pills" data-modal="sizes">
          ${product.sizes.map((s, idx) => `<button type="button" class="size-pill${idx === 0 ? " active" : ""}" data-size="${escapeHtml(s)}">${escapeHtml(s)}</button>`).join("")}
        </div>
      `;
      modalSizes.querySelectorAll(".size-pill").forEach((pill) => {
        pill.addEventListener("click", () => {
          modalSizes.querySelectorAll(".size-pill").forEach(x => x.classList.remove("active"));
          pill.classList.add("active");
        });
      });
    } else {
      modalSizes.innerHTML = "";
    }
  }

  if (modalColors) {
    if (product.colors && product.colors.length) {
      modalColors.innerHTML = `
        <div class="modal-label">${currentLang === "ar" ? "الألوان" : "Colors"}</div>
        <div class="color-pills" data-modal="colors">
          ${product.colors.map((c, idx) => `<button type="button" class="color-pill${idx === 0 ? " active" : ""}" data-color="${escapeHtml(c)}" title="${escapeHtml(c)}" style="--swatch:${resolveColorValue(c)}"></button>`).join("")}
        </div>
      `;
      modalColors.querySelectorAll(".color-pill").forEach((pill) => {
        pill.addEventListener("click", () => {
          modalColors.querySelectorAll(".color-pill").forEach(x => x.classList.remove("active"));
          pill.classList.add("active");
        });
      });
    } else {
      modalColors.innerHTML = "";
    }
  }

  if (modalComments) {
    loadAndRenderComments(product._id, modalComments);
  }
  if (modalRating) {
    const avg = Number(product.avgRating || 0);
    const stars = "★★★★★☆☆☆☆☆".slice(5 - Math.round(avg), 10 - Math.round(avg));
    const savedRating = Number(myRatings[product._id] || 0);
    const draftRating = Number(pendingRatings[product._id] || savedRating || 0);
    const ratingLocked = savedRating > 0;
    modalRating.innerHTML = `
      <div class="modal-label">${currentLang === "ar" ? "التقييم" : "Rating"}</div>
      <div class="modal-rating-row">
        <span class="rating-stars">${stars}</span>
        <span class="rating-text">${avg.toFixed(1)} (${product.ratingsCount || 0})</span>
        ${buildInteractiveStars(product._id, draftRating, ratingLocked)}
        <button type="button" id="modalRateConfirm" class="rating-confirm-btn${ratingLocked ? " is-hidden" : ""}" aria-label="${t("confirm_rating")}">&#10003;</button>
        <span class="rating-msg" id="modalRateMsg"></span>
      </div>
      ${savedRating ? `<div class="rating-users">${t("your_rating")}: ${savedRating} ★</div>` : ""}
    `;
    const modalRateConfirm = document.getElementById("modalRateConfirm");
    const modalRateMsg = document.getElementById("modalRateMsg");
    modalRating.querySelectorAll(`.rating-star-btn[data-id="${product._id}"]`).forEach((star) => {
      star.addEventListener("click", () => {
        if (hasRatedProduct(product._id)) return;
        const rating = Number(star.dataset.value || 0);
        pendingRatings[product._id] = rating;
        modalRating.querySelectorAll(`.rating-star-btn[data-id="${product._id}"]`).forEach((item) => {
          const value = Number(item.dataset.value || 0);
          item.classList.toggle("is-active", value <= rating);
        });
        if (modalRateMsg) modalRateMsg.textContent = "";
      });
    });
    if (modalRateConfirm && modalRateMsg) {
      modalRateConfirm.addEventListener("click", async () => {
        const rating = selectedRatingFor(product._id);
        await submitRating(product._id, rating, {
          confirmBtn: modalRateConfirm,
          msgEl: modalRateMsg,
          onDone: (ok, updated) => {
            if (ok && updated) openProductModal(updated);
          }
        });
      });
    }
  }
  if (modalRecommendations) {
    modalRecommendations.innerHTML = "";
    fetch(`${API}/products/${product._id}/recommendations?limit=4`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!data) return;
        const list = [...(data.crossSell || []), ...(data.upsell || [])]
          .filter((p, idx, arr) => p && p._id && p._id !== product._id && arr.findIndex((x) => x._id === p._id) === idx)
          .slice(0, 4);
        if (!list.length) return;
        modalRecommendations.innerHTML = `
          <div class="modal-label">${currentLang === "ar" ? "منتجات مقترحة" : "Suggested products"}</div>
          <div class="modal-thumbs">
            ${list.map((item) => {
              const srcRaw = (item.images && item.images[0]) || item.image || "";
              const src = srcRaw.startsWith("/uploads") ? `${BACKEND}${srcRaw}` : srcRaw;
              return `<img class="modal-thumb" data-rec="${item._id}" src="${escapeHtml(src)}" alt="${escapeHtml(item.name || "")}" title="${escapeHtml(item.name || "")}">`;
            }).join("")}
          </div>
        `;
        modalRecommendations.querySelectorAll("[data-rec]").forEach((el) => {
          el.addEventListener("click", () => {
            const next = allProducts.find((p) => p._id === el.dataset.rec);
            if (next) openProductModal(next);
          });
        });
      })
      .catch(() => {});
  }

  if (modalAddBtn) {
    modalAddBtn.textContent = t("add_to_cart");
    modalAddBtn.disabled = Number(product.stock || 0) <= 0;
    modalAddBtn.onclick = () => {
      const activeSize = modal.querySelector('[data-modal="sizes"] .size-pill.active');
      const activeColor = modal.querySelector('[data-modal="colors"] .color-pill.active');
      addToCart(product, 1, {
        size: activeSize ? (activeSize.dataset.size || "") : "",
        color: activeColor ? (activeColor.dataset.color || "") : ""
      });
      updateView();
    };
  }

  renderModalImage();
  modal.classList.add("open");
  modal.setAttribute("aria-hidden", "false");
  document.body.classList.add("modal-open");
  lockedPageScrollY = window.scrollY || document.documentElement.scrollTop || 0;
  const modalCard = modal.querySelector(".product-modal-card");
  if (modalCard) modalCard.scrollTop = 0;
  const modalBody = modal.querySelector(".product-modal-body");
  if (modalBody) modalBody.scrollTop = 0;
  const closeBtn = modal.querySelector(".product-modal-close");
  if (closeBtn) closeBtn.focus();
}

function initProductModal() {
  const modal = document.getElementById("productModal");
  if (!modal) return;
  modal.querySelectorAll("[data-close]").forEach((el) => {
    el.addEventListener("click", closeProductModal);
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && modal.classList.contains("open")) {
      closeProductModal();
    }
  });
  const prevBtn = document.getElementById("modalPrevImage");
  const nextBtn = document.getElementById("modalNextImage");
  if (prevBtn) {
    prevBtn.addEventListener("click", () => {
      if (!modalImages.length) return;
      modalImageIndex = (modalImageIndex - 1 + modalImages.length) % modalImages.length;
      renderModalImage();
    });
  }
  if (nextBtn) {
    nextBtn.addEventListener("click", () => {
      if (!modalImages.length) return;
      modalImageIndex = (modalImageIndex + 1) % modalImages.length;
      renderModalImage();
    });
  }
}

function applyTheme(isDark) {
  document.body.classList.toggle("site-dark", !!isDark);
  const btn = document.getElementById("themeToggle");
  if (btn) btn.textContent = isDark ? "☀" : "🌙";
}

function initTheme() {
  const key = "site_dark_mode";
  const saved = localStorage.getItem(key);
  const isDark = saved === null ? true : saved === "1";
  if (saved === null) localStorage.setItem(key, "1");
  applyTheme(isDark);
  const btn = document.getElementById("themeToggle");
  if (btn && btn.dataset.themeBound !== "1") {
    btn.dataset.themeBound = "1";
    btn.addEventListener("click", () => {
      const nowDark = !document.body.classList.contains("site-dark");
      localStorage.setItem(key, nowDark ? "1" : "0");
      applyTheme(nowDark);
    });
  }
}

function initRevealFooterOnEnd() {
  const footer = document.querySelector(".footer");
  const main = document.querySelector("main.main");
  if (!footer || !main) return;

  document.body.classList.add("has-reveal-footer");
  let ticking = false;
  let revealZone = 320;

  const syncFooterHeight = () => {
    const h = Math.max(180, Math.ceil(footer.offsetHeight || 0));
    document.body.style.setProperty("--footer-reveal-height", `${h}px`);
    revealZone = Math.max(180, h + 40);
  };

  const syncRevealState = () => {
    const scrolled = window.scrollY || document.documentElement.scrollTop || 0;
    const viewport = window.innerHeight || document.documentElement.clientHeight || 0;
    const doc = document.documentElement.scrollHeight || 0;
    const distanceFromBottom = Math.max(0, doc - (scrolled + viewport));
    let progress = 1 - (distanceFromBottom / revealZone);
    if (!Number.isFinite(progress)) progress = 0;
    progress = Math.min(1, Math.max(0, progress));
    document.body.style.setProperty("--footer-progress", String(progress));
  };

  syncFooterHeight();
  syncRevealState();

  window.addEventListener("resize", () => {
    syncFooterHeight();
    syncRevealState();
  });
  window.addEventListener("scroll", () => {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(() => {
      syncRevealState();
      ticking = false;
    });
  }, { passive: true });
}

function buildFilters() {
  const headerTabs = document.querySelector(".header-tabs");
  const filtersRow = document.querySelector(".products-section .filters");
  if (!filtersState || !headerTabs || !filtersRow) return;

  const categories = (filtersState.categories || []).filter(c => c.enabled);
  const types = (filtersState.types || []).filter(t => t.enabled);
  const categoryFallback = { Men: "رجالي", Women: "نسائي", Children: "أطفال" };
  const typeFallback = { hoodie: "هودي", tshirt: "تيشيرت", pants: "بنطلون", jacket: "جاكيت", shirt: "قميص", dress: "فستان" };

  headerTabs.innerHTML = `
    <button class="tab-btn filter-btn active" data-cat="" data-i18n="all">الكل</button>
    ${categories.map(c => `<button class="tab-btn filter-btn" data-cat="${c.key}">${currentLang === "ar" ? normalizeArabicLabel(c.labelAr, categoryFallback[c.key] || c.key) : c.labelEn}</button>`).join("")}
    <button class="tab-btn" data-popular="true">${currentLang === "ar" ? "الأكثر طلباً" : "Popular"}</button>
  `;

  filtersRow.innerHTML = `
    <button class="filter-btn active" data-cat="">الكل</button>
    ${categories.map(c => `<button class="filter-btn" data-cat="${c.key}">${currentLang === "ar" ? normalizeArabicLabel(c.labelAr, categoryFallback[c.key] || c.key) : c.labelEn}</button>`).join("")}
  `;

  const typeSelect = document.getElementById("typeFilter");
  if (typeSelect) {
    typeSelect.innerHTML = `
      <option value="">كل الأنواع</option>
      ${types.map(ti => `<option value="${ti.key}">${currentLang === "ar" ? normalizeArabicLabel(ti.labelAr, typeFallback[ti.key] || ti.key) : ti.labelEn}</option>`).join("")}
    `;
  }

  document.querySelectorAll(".filter-btn[data-cat]").forEach(btn => {
    btn.addEventListener("click", () => setCategory(btn.dataset.cat || ""));
  });
  document.querySelectorAll("[data-popular]").forEach(btn => {
    btn.addEventListener("click", () => setPopular(!activePopular));
  });
}

function applyFilters() {
  const search = normalize(activeSearch);
  const typeKeywordsMap = {
    hoodie: ["hoodie", "هودي"],
    tshirt: ["t-shirt", "tshirt", "تيشيرت", "تي شيرت"],
    pants: ["pants", "بنطلون"],
    jacket: ["jacket", "جاكيت"],
    shirt: ["shirt", "قميص"],
    dress: ["dress", "فستان"]
  };
  let filtered = allProducts.filter(p => {
    if (filtersState && filtersState.categories && filtersState.categories.length) {
      const catItem = filtersState.categories.find(c => c.key === p.category);
      if (!catItem || !catItem.enabled) return false;
    }
    if (filtersState && filtersState.types && filtersState.types.length) {
      const typeItem = filtersState.types.find(ti => ti.key === p.type);
      if (p.type && (!typeItem || !typeItem.enabled)) return false;
    }
    if (activeCategory && p.category !== activeCategory) return false;
    const name = normalize(p.name);
    if (activeType) {
      if (p.type) {
        if (normalize(p.type) !== activeType) return false;
      } else {
        const keywords = typeKeywordsMap[activeType] || [];
        const matchesType = keywords.some(key => key && name.includes(key));
        if (!matchesType) return false;
      }
    }
    if (search && !name.includes(search)) return false;
    return true;
  });
  if (activePopular) {
    const withCounts = filtered.filter(p => (popularityMap[p._id] || 0) > 0);
    filtered = (withCounts.length ? withCounts : filtered).sort((a, b) => {
      return (popularityMap[b._id] || 0) - (popularityMap[a._id] || 0);
    });
  }
  return filtered;
}

function updateView() {
  render(applyFilters());
}

function setCategory(cat) {
  activeCategory = cat || "";
  document.querySelectorAll(".filter-btn[data-cat]").forEach(b => b.classList.remove("active"));
  document.querySelectorAll(`.filter-btn[data-cat="${activeCategory}"]`).forEach(b => b.classList.add("active"));
  if (!activeCategory) {
    document.querySelectorAll(`.filter-btn[data-cat=""]`).forEach(b => b.classList.add("active"));
  }
  updateView();
}

function setTypeFromSelect(selectEl) {
  if (!selectEl) return;
  activeType = normalize(selectEl.value);
  updateView();
}

function setSearch(value) {
  activeSearch = value || "";
  updateView();
}

function initHeroSlider() {
  const heroImg = document.querySelector(".hero-image");
  if (!heroImg) return;
  if (heroSliderTimer) {
    clearInterval(heroSliderTimer);
    heroSliderTimer = null;
  }
  if (HERO_IMAGES.length === 0) {
    heroImg.removeAttribute("src");
    return;
  }
  let index = 0;
  heroImg.src = HERO_IMAGES[0];

  heroSliderTimer = setInterval(() => {
    index = (index + 1) % HERO_IMAGES.length;
    heroImg.classList.add("is-fading");
    setTimeout(() => {
      heroImg.src = HERO_IMAGES[index];
      heroImg.classList.remove("is-fading");
    }, 280);
  }, 6200);
}

async function loadHeroImages() {
  try {
    const res = await fetch(`${API}/settings/hero`);
    if (!res.ok) return;
    const data = await res.json();
    if (data.images && data.images.length) {
      HERO_IMAGES = data.images.map(img => (img.startsWith("/uploads") ? BACKEND + img : img));
      initHeroSlider();
    }
  } catch {}
}

async function loadFilters() {
  try {
    const res = await fetch(`${API}/settings/shop`);
    if (!res.ok) return;
    const data = await res.json();
    filtersState = data.filters;
    buildFilters();
    updateView();
  } catch {}
}

async function loadPopularity() {
  popularityMap = {};
}

function setPopular(active) {
  activePopular = !!active;
  document.querySelectorAll("[data-popular]").forEach(btn => {
    btn.classList.toggle("is-active", activePopular);
  });
  updateView();
}

function applyLang(lang) {
  currentLang = lang;
  const isAr = lang === "ar";
  document.documentElement.lang = isAr ? "ar" : "en";
  document.documentElement.dir = isAr ? "rtl" : "ltr";
  const dict = {
    ar: {
      track: "تتبع الطلب",
      login: "تسجيل الدخول",
      signup: "إنشاء حساب",
      search_placeholder: "ابحث باسم المنتج...",
      all: "الكل",
      men: "رجالي",
      women: "نسائي",
      children: "أطفال",
      popular: "الأكثر طلباً",
      currency: "جنيه",
      available: "متوفر",
      add_to_cart: "أضف للسلة",
      rate: "قيم",
      send: "إرسال",
      sizes_label: "المقاسات:",
      colors_label: "الألوان:",
      type_label: "النوع",
      choose_size: "اختر المقاس",
      choose_size_alert: "من فضلك اختر المقاس",
      ratings_users: "تقييمات المستخدمين",
      rating_sent: "تم إرسال التقييم",
      rating_error: "تعذر إرسال التقييم",
      choose_rating: "اختر التقييم أولاً",
      confirm_rating: "تأكيد التقييم",
      your_rating: "تقييمك",
      already_rated: "تم تقييم هذا المنتج من قبل",
      login_first: "يرجى تسجيل الدخول أولاً",
      hero_tagline: "أفضل الهودييز موجود هنا فقط",
      brand: "Hand Aura",
      swipe: "اسحب",
      discover: "اكتشف الآن",
      explore: "استكشف التشكيلة",
      all_ar: "الكل",
      men_ar: "رجالي",
      women_ar: "نسائي",
      children_ar: "أطفال",
      types_all: "كل الأنواع",
      type_hoodie: "هودي",
      type_tshirt: "تيشيرت",
      type_pants: "بنطلون",
      type_jacket: "جاكيت",
      type_dress: "فستان",
      type_shirt: "قميص",
      footer: "© 2025 Hand Aura Store. جميع الحقوق محفوظة."
    },
    en: {
      track: "Track Order",
      login: "Login",
      signup: "Sign up",
      search_placeholder: "Search by product name...",
      all: "All",
      men: "Men",
      women: "Women",
      children: "Children",
      popular: "Popular",
      currency: "EGP",
      available: "In stock",
      add_to_cart: "Add to cart",
      rate: "Rate",
      send: "Send",
      sizes_label: "Sizes:",
      colors_label: "Colors:",
      type_label: "Type",
      choose_size: "Choose size",
      choose_size_alert: "Please choose a size",
      ratings_users: "User ratings",
      rating_sent: "Rating sent",
      rating_error: "Failed to send rating",
      choose_rating: "Please select a rating first",
      confirm_rating: "Confirm rating",
      your_rating: "Your rating",
      already_rated: "You already rated this product",
      login_first: "Please login first",
      hero_tagline: "THE BEST HAND AURA PIECES ARE ONLY HERE",
      brand: "Hand Aura",
      swipe: "SWIPE",
      discover: "DISCOVER NOW",
      explore: "Explore collection",
      all_ar: "All",
      men_ar: "Men",
      women_ar: "Women",
      children_ar: "Children",
      types_all: "All types",
      type_hoodie: "Hoodie",
      type_tshirt: "T-Shirt",
      type_pants: "Pants",
      type_jacket: "Jacket",
      type_dress: "Dress",
      type_shirt: "Shirt",
      footer: "© 2025 Hand Aura Store. All rights reserved."
    }
  };
  document.querySelectorAll("[data-i18n]").forEach(el => {
    const key = el.getAttribute("data-i18n");
    if (dict[lang][key]) el.textContent = dict[lang][key];
  });
  document.querySelectorAll("[data-i18n-placeholder]").forEach(el => {
    const key = el.getAttribute("data-i18n-placeholder");
    if (dict[lang][key]) el.setAttribute("placeholder", dict[lang][key]);
  });
  const langBtn = document.getElementById("langToggle");
  if (langBtn) langBtn.textContent = isAr ? "AR" : "EN";
  if (typeof window.applyGlobalLang === "function") {
    window.applyGlobalLang();
  }
  buildFilters();
  updateView();
}

function t(key) {
  const dict = {
    ar: {
      currency: "جنيه",
      available: "متوفر",
      add_to_cart: "أضف للسلة",
      rate: "قيم",
      send: "إرسال",
      sizes_label: "المقاسات:",
      colors_label: "الألوان:",
      type_label: "النوع",
      choose_size: "اختر المقاس",
      choose_size_alert: "من فضلك اختر المقاس",
      ratings_users: "تقييمات المستخدمين",
      rating_sent: "تم إرسال التقييم",
      rating_error: "تعذر إرسال التقييم",
      choose_rating: "اختر التقييم أولاً",
      confirm_rating: "تأكيد التقييم",
      your_rating: "تقييمك",
      already_rated: "تم تقييم هذا المنتج من قبل",
      login_first: "يرجى تسجيل الدخول أولاً"
    },
    en: {
      currency: "EGP",
      available: "In stock",
      add_to_cart: "Add to cart",
      rate: "Rate",
      send: "Send",
      sizes_label: "Sizes:",
      colors_label: "Colors:",
      type_label: "Type",
      choose_size: "Choose size",
      choose_size_alert: "Please choose a size",
      ratings_users: "User ratings",
      rating_sent: "Rating sent",
      rating_error: "Failed to send rating",
      choose_rating: "Please select a rating first",
      confirm_rating: "Confirm rating",
      your_rating: "Your rating",
      already_rated: "You already rated this product",
      login_first: "Please login first"
    }
  };
  return (dict[currentLang] && dict[currentLang][key]) || key;
}

async function bootstrapStore() {
  await detectBackend();
  fetch(`${API}/products`)
    .then(res => res.json())
    .then(async (data) => {
      allProducts = data;
      await loadMyRatings();
      updateView();
      updateCartCount();
    })
    .catch(() => {
      const productsDiv = document.getElementById("products");
      if (productsDiv) productsDiv.innerHTML = "<p style='text-align:center;color:var(--muted)'>تعذر تحميل المنتجات. تأكد من تشغيل السيرفر.</p>";
    });
  loadHeroImages();
  loadFilters();
  loadPopularity().then(updateView);
}

// ربط كل أزرار الفلترة (في الهيدر والقسم السفلي)
document.querySelectorAll(".filter-btn[data-cat]").forEach(btn => {
  btn.addEventListener("click", () => setCategory(btn.dataset.cat || ""));
});

document.querySelectorAll("[data-popular]").forEach(btn => {
  btn.addEventListener("click", () => setPopular(!activePopular));
});

const typeSelect = document.getElementById("typeFilter");
if (typeSelect) {
  typeSelect.addEventListener("change", () => setTypeFromSelect(typeSelect));
}

const searchInput = document.getElementById("searchInput");
if (searchInput) {
  searchInput.addEventListener("input", () => setSearch(searchInput.value));
}

const heroCta = document.getElementById("heroCta");
if (heroCta) {
  heroCta.addEventListener("click", () => {
    document.getElementById("explore")?.scrollIntoView({ behavior: "smooth" });
  });
}

const langToggle = document.getElementById("langToggle");
if (langToggle) {
  langToggle.addEventListener("click", () => {
    const next = (localStorage.getItem("lang") || "ar") === "ar" ? "en" : "ar";
    localStorage.setItem("lang", next);
    applyLang(next);
  });
}

const qrImage = document.getElementById("qrImage");
const qrLink = document.getElementById("qrLink");
if (qrImage && qrLink) {
  const storeUrl = `${location.origin}/index.html`;
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=260x260&data=${encodeURIComponent(storeUrl)}`;
  qrImage.src = qrUrl;
  qrLink.href = qrUrl;
}

updateCartCount();
bootstrapStore();
applyLang(localStorage.getItem("lang") || "ar");
initProductModal();
initTheme();
initRevealFooterOnEnd();


