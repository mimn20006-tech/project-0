const adminRolesHost = window.location.hostname;
const adminRolesBackend = /hand-aura-(front-production|production)\.up\.railway\.app$/i.test(adminRolesHost)
  ? "https://hand-aura-production.up.railway.app"
  : `http://${adminRolesHost}:5000`;
const adminRolesApi = `${adminRolesBackend}/api`;

function adminToken() {
  return localStorage.getItem("admin_token") || "";
}

function adminHeaders(json = false) {
  const token = adminToken();
  const headers = token ? { Authorization: `Bearer ${token}` } : {};
  if (json) headers["Content-Type"] = "application/json";
  return headers;
}

function ensureAdmin() {
  const token = adminToken();
  if (!token || token.split(".").length !== 3) {
    location.href = "admin-login.html";
  }
}

function bindMenu() {
  const menuBtn = document.querySelector(".menu-btn");
  const sideMenu = document.getElementById("sideMenu");
  const overlay = document.getElementById("menuOverlay");
  const logoutBtn = document.getElementById("adminLogoutBtn");
  const close = () => {
    sideMenu?.classList.remove("open");
    overlay?.classList.remove("open");
  };
  menuBtn?.addEventListener("click", () => {
    sideMenu?.classList.toggle("open");
    overlay?.classList.toggle("open");
  });
  overlay?.addEventListener("click", close);
  logoutBtn?.addEventListener("click", async () => {
    const token = adminToken();
    if (token) {
      try {
        await fetch(`${adminRolesApi}/auth/admin/logout`, { method: "POST", headers: adminHeaders() });
      } catch {}
    }
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
  btn.textContent = isDark ? "☀" : "🌙";
  btn.addEventListener("click", () => {
    const nowDark = !document.body.classList.contains("admin-dark");
    document.body.classList.toggle("admin-dark", nowDark);
    localStorage.setItem(key, nowDark ? "1" : "0");
    btn.textContent = nowDark ? "☀" : "🌙";
  });
  topbar.appendChild(btn);
}

async function loadRoles() {
  const wrap = document.getElementById("rolesTableWrap");
  if (!wrap) return;
  wrap.innerHTML = "<p style='color:var(--muted)'>جاري التحميل...</p>";
  const res = await fetch(`${adminRolesApi}/admin/users`, { headers: adminHeaders() });
  if (res.status === 401) {
    localStorage.removeItem("admin_token");
    location.href = "admin-login.html";
    return;
  }
  if (!res.ok) {
    wrap.innerHTML = "<p style='color:#e74c3c'>تعذر تحميل المستخدمين.</p>";
    return;
  }
  const users = await res.json();
  if (!users.length) {
    wrap.innerHTML = "<p style='color:var(--muted)'>لا يوجد مستخدمون.</p>";
    return;
  }
  wrap.innerHTML = `
    <table class="admin-table">
      <thead>
        <tr>
          <th>الاسم</th>
          <th>الإيميل</th>
          <th>الدور</th>
          <th>حفظ</th>
        </tr>
      </thead>
      <tbody>
        ${users.map((u) => `
          <tr>
            <td>${u.name || "-"}</td>
            <td>${u.email || "-"}</td>
            <td>
              <select data-role-id="${u._id}">
                <option value="admin" ${u.role === "admin" ? "selected" : ""}>admin</option>
                <option value="manager" ${u.role === "manager" ? "selected" : ""}>manager</option>
                <option value="editor" ${u.role === "editor" ? "selected" : ""}>editor</option>
                <option value="user" ${u.role === "user" ? "selected" : ""}>user</option>
              </select>
            </td>
            <td><button type="button" class="admin-btn admin-btn-edit" data-save-id="${u._id}">حفظ</button></td>
          </tr>
        `).join("")}
      </tbody>
    </table>
  `;
  wrap.querySelectorAll("[data-save-id]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const id = btn.dataset.saveId;
      const select = wrap.querySelector(`select[data-role-id="${id}"]`);
      if (!select) return;
      btn.disabled = true;
      const update = await fetch(`${adminRolesApi}/admin/users/${id}/role`, {
        method: "PUT",
        headers: adminHeaders(true),
        body: JSON.stringify({ role: select.value })
      });
      btn.disabled = false;
      if (!update.ok) {
        alert("تعذر حفظ الدور");
        return;
      }
      btn.textContent = "تم";
      setTimeout(() => (btn.textContent = "حفظ"), 1200);
    });
  });
}

ensureAdmin();
bindMenu();
setupDarkMode();
loadRoles();
