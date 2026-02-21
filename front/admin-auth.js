const host = window.location.hostname;
const isRailwayFront = /hand-aura-front-production\.up\.railway\.app$/i.test(host);
const isRailwayBack = /hand-aura-production\.up\.railway\.app$/i.test(host);
const BACKEND = (isRailwayFront || isRailwayBack)
  ? "https://hand-aura-production.up.railway.app"
  : `http://${host}:5000`;
const API = BACKEND + "/api";
if (localStorage.getItem("admin_dark_mode") === "1") {
  document.body.classList.add("admin-dark");
}

function setAdminAuth(token, user) {
  localStorage.setItem("admin_token", token);
  localStorage.setItem("admin_user", JSON.stringify(user));
}

function setFieldError(input, msg) {
  if (!input) return;
  let err = input.nextElementSibling;
  if (!err || !err.classList || !err.classList.contains("field-error")) {
    err = document.createElement("p");
    err.className = "field-error";
    input.insertAdjacentElement("afterend", err);
  }
  err.textContent = msg || "";
  err.classList.remove("shake");
  void err.offsetWidth;
  err.classList.add("shake");
  setTimeout(() => {
    if (err && err.parentNode) err.remove();
  }, 10000);
}

function setFormError(id, msg) {
  const el = document.getElementById(id);
  if (!el) return;
  el.textContent = msg || "";
  el.classList.remove("shake");
  void el.offsetWidth;
  el.classList.add("shake");
}

function clearFormError(id) {
  const el = document.getElementById(id);
  if (el) el.textContent = "";
}

function clearFieldErrors(form) {
  if (!form) return;
  form.querySelectorAll(".field-error").forEach(e => e.remove());
}

async function checkAdminExists() {
  try {
    const res = await fetch(`${API}/auth/admin/exists`);
    if (!res.ok) return;
    const data = await res.json();
    const card = document.getElementById("adminRegisterCard");
    if (card) card.style.display = data.exists ? "none" : "";
  } catch {}
}

const adminLoginForm = document.getElementById("adminLoginForm");
if (adminLoginForm) {
  adminLoginForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const form = e.target;
    clearFieldErrors(form);
    clearFormError("adminLoginError");
    const email = form.email.value.trim();
    const password = form.password.value;
    if (!/^\S+@\S+\.\S+$/.test(email)) {
      setFieldError(form.email, "البريد الإلكتروني غير صحيح");
      return;
    }
    if (!password || password.length < 6) {
      setFieldError(form.password, "كلمة المرور يجب ألا تقل عن 6 أحرف");
      return;
    }
    const res = await fetch(`${API}/auth/admin/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password })
    });
    if (res.ok) {
      const data = await res.json();
      setAdminAuth(data.token, data.user);
      location.href = "admin.html";
    } else {
      let msg = "تعذر تسجيل الدخول";
      try {
        const data = await res.json();
        if (data && data.error) msg = data.error;
      } catch {}
      setFieldError(form.password, msg);
      setFormError("adminLoginError", msg);
    }
  });
}

const adminRegisterForm = document.getElementById("adminRegisterForm");
if (adminRegisterForm) {
  adminRegisterForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const form = e.target;
    clearFieldErrors(form);
    clearFormError("adminRegisterError");
    const name = form.name.value.trim();
    const email = form.email.value.trim();
    const password = form.password.value;
    if (name.length < 2) {
      setFieldError(form.name, "الاسم قصير");
      return;
    }
    if (!/^\S+@\S+\.\S+$/.test(email)) {
      setFieldError(form.email, "البريد الإلكتروني غير صحيح");
      return;
    }
    if (!password || password.length < 6) {
      setFieldError(form.password, "كلمة المرور يجب ألا تقل عن 6 أحرف");
      return;
    }
    const res = await fetch(`${API}/auth/admin/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, email, password })
    });
    if (res.ok) {
      const data = await res.json();
      setAdminAuth(data.token, data.user);
      location.href = "admin-success.html";
    } else {
      let msg = "تعذر إنشاء الأدمن";
      try {
        const data = await res.json();
        if (data && data.error) msg = data.error;
      } catch {}
      setFieldError(form.password, msg);
      setFormError("adminRegisterError", msg);
    }
  });
}

checkAdminExists();
