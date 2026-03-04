const trHost = window.location.hostname;
const trBackend = /^(localhost|127[.]0[.]0[.]1)$/i.test(trHost)
  ? "http://" + trHost + ":5000"
  : "https://ecommerce-api-production-c3a5.up.railway.app";
const trApi = trBackend + "/api";
function trHeaders(json = false) {
  const token = localStorage.getItem("admin_token");
  const headers = token ? { Authorization: `Bearer ${token}` } : {};
  if (json) headers["Content-Type"] = "application/json";
  return headers;
}

function bindTranslationsMenu() {
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

async function loadI18n() {
  const res = await fetch(`${trApi}/settings/i18n`, { headers: trHeaders() });
  if (res.status === 401) return (location.href = "admin-login.html");
  if (!res.ok) return;
  const data = await res.json();
  document.getElementById("languagesInput").value = (data.languages || ["ar", "en"]).join(",");
  document.getElementById("defaultLangInput").value = data.defaultLang || "ar";
  document.getElementById("dictInput").value = JSON.stringify(data.dict || {}, null, 2);
}

document.getElementById("i18nForm")?.addEventListener("submit", async (e) => {
  e.preventDefault();
  let dict;
  try {
    dict = JSON.parse(document.getElementById("dictInput").value || "{}");
  } catch (e) {
    alert("صورة JSON غير صحيحة");
    return;
  }
  const languages = (document.getElementById("languagesInput").value || "")
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean);
  const payload = {
    defaultLang: document.getElementById("defaultLangInput").value.trim() || "ar",
    languages: languages.length ? languages : ["ar", "en"],
    dict
  };
  const res = await fetch(`${trApi}/settings/i18n`, {
    method: "PUT",
    headers: trHeaders(true),
    body: JSON.stringify(payload)
  });
  if (!res.ok) {
    let msg = "حدث خطأ أثناء حفظ الترجمة";
    try {
      const d = await res.json();
      if (d?.error) msg = d.error;
    } catch {}
    alert(msg);
    return;
  }
  alert("تم حفظ الترجمة الديناميكية بنجاح");
});

if (!localStorage.getItem("admin_token")) location.href = "admin-login.html";
bindTranslationsMenu();
setupDarkMode();
loadI18n();




