const host = window.location.hostname;
const isRailwayFront = /hand-aura-front-production\.up\.railway\.app$/i.test(host);
const isRailwayBack = /hand-aura-production\.up\.railway\.app$/i.test(host);
const BACKEND = (isRailwayFront || isRailwayBack)
  ? "https://hand-aura-production.up.railway.app"
  : `http://${host}:5000`;
const API = BACKEND + "/api";

function authHeaders() {
  const token = localStorage.getItem("auth_token");
  return token ? { Authorization: `Bearer ${token}` } : {};
}

function setAuth(token, user) {
  localStorage.setItem("auth_token", token);
  localStorage.setItem("auth_user", JSON.stringify(user));
}

async function loadProfile() {
  const res = await fetch(`${API}/auth/me`, { headers: authHeaders() });
  if (res.status === 401 || res.status === 403) {
    location.href = "login.html";
    return;
  }
  const data = await res.json();
  const u = data.user || {};
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
      err.textContent = "حجم الصورة يجب ألا يزيد عن 2MB";
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
    msg.textContent = "تم حفظ البيانات";
    setTimeout(() => (msg.textContent = ""), 10000);
  } else {
    let m = "تعذر حفظ البيانات";
    try {
      const d = await res.json();
      if (d && d.error) m = d.error;
    } catch {}
    msg.textContent = m;
    setTimeout(() => (msg.textContent = ""), 10000);
  }
});

loadProfile();
