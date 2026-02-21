const authHost = window.location.hostname;
const AUTH_BACKEND = /^(localhost|127[.]0[.]0[.]1)$/i.test(authHost)
  ? "http://" + authHost + ":5000"
  : "https://ecommerce-api-production-c3a5.up.railway.app";
const API = AUTH_BACKEND + "/api";
const REQUEST_TIMEOUT_MS = 12000;

function withTimeoutFetch(url, options = {}, timeoutMs = REQUEST_TIMEOUT_MS) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  return fetch(url, { ...options, signal: controller.signal }).finally(() => clearTimeout(timer));
}

function setAuth(token, user) {
  localStorage.setItem("auth_token", token);
  localStorage.setItem("auth_user", JSON.stringify(user));
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

function setFieldSuccess(input, msg) {
  if (!input) return;
  let ok = input.nextElementSibling;
  if (!ok || !ok.classList || !ok.classList.contains("field-success")) {
    ok = document.createElement("p");
    ok.className = "field-success";
    input.insertAdjacentElement("afterend", ok);
  }
  ok.textContent = msg || "";
  setTimeout(() => {
    if (ok && ok.parentNode) ok.remove();
  }, 10000);
}

function setFormError(id, msg) {
  const el = document.getElementById(id);
  if (!el) return;
  el.textContent = msg || "";
  el.style.color = "#e74c3c";
  el.classList.remove("shake");
  void el.offsetWidth;
  el.classList.add("shake");
}

function setFormSuccess(id, msg) {
  const el = document.getElementById(id);
  if (!el) return;
  el.textContent = msg || "";
  el.style.color = "#16a34a";
  el.classList.remove("shake");
}

function clearFormError(id) {
  const el = document.getElementById(id);
  if (!el) return;
  el.textContent = "";
  el.style.color = "";
}

function clearFieldErrors(form) {
  if (!form) return;
  form.querySelectorAll(".field-error").forEach((e) => e.remove());
  form.querySelectorAll(".field-success").forEach((e) => e.remove());
}

async function readError(res, fallback) {
  let msg = fallback;
  try {
    const data = await res.json();
    if (data && data.error) msg = data.error;
  } catch {}
  return msg;
}

document.querySelectorAll(".google-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    location.href = `${API}/oauth/google`;
  });
});

document.querySelectorAll(".apple-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    location.href = `${API}/oauth/apple`;
  });
});

async function checkOAuthStatus() {
  try {
    const res = await withTimeoutFetch(`${API}/oauth/status`, {}, 8000);
    if (!res.ok) return;
    const data = await res.json();
    document.querySelectorAll(".google-btn").forEach((btn) => {
      btn.disabled = !data.google;
      btn.classList.toggle("is-disabled", !data.google);
      if (!data.google) btn.title = "Google غير متاح الآن";
    });
    document.querySelectorAll(".apple-btn").forEach((btn) => {
      btn.disabled = !data.apple;
      btn.classList.toggle("is-disabled", !data.apple);
      if (!data.apple) btn.title = "Apple غير متاح بدون نطاق و HTTPS";
    });
  } catch {}
}

const loginForm = document.getElementById("loginForm");
if (loginForm) {
  loginForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const form = e.target;
    clearFieldErrors(form);
    clearFormError("loginError");

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

    try {
      const res = await withTimeoutFetch(`${API}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password })
      });

      if (res.ok) {
        const data = await res.json();
        setAuth(data.token, data.user);
        location.href = "index.html";
        return;
      }

      const msg = await readError(res, "تعذر تسجيل الدخول");
      setFieldError(form.password, msg);
      setFormError("loginError", msg);
    } catch (err) {
      const msg = err?.name === "AbortError" ? "انتهت مهلة الاتصال، حاول مرة أخرى" : "تعذر الاتصال بالخادم";
      setFieldError(form.password, msg);
      setFormError("loginError", msg);
    }
  });
}

const registerForm = document.getElementById("registerForm");
if (registerForm) {
  registerForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const form = e.target;
    clearFieldErrors(form);
    clearFormError("registerError");

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

    try {
      const res = await withTimeoutFetch(`${API}/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password })
      }, 60000);

      if (res.ok) {
        const data = await res.json();
        setAuth(data.token, data.user);
        localStorage.setItem("pending_verify_email", email);
        localStorage.setItem("verify_notice", "تم إرسال رمز التفعيل إلى بريدك الإلكتروني");
        location.href = "verify.html";
        return;
      }

      const msg = await readError(res, "تعذر إنشاء الحساب");
      setFieldError(form.password, msg);
      setFormError("registerError", msg);
    } catch (err) {
      const msg = err?.name === "AbortError" ? "انتهت مهلة الاتصال، حاول مرة أخرى" : "تعذر الاتصال بالخادم";
      setFieldError(form.password, msg);
      setFormError("registerError", msg);
    }
  });
}

const verifyForm = document.getElementById("verifyForm");
if (verifyForm) {
  const pendingEmail = localStorage.getItem("pending_verify_email");
  if (pendingEmail && !verifyForm.email.value) verifyForm.email.value = pendingEmail;

  const verifyNotice = localStorage.getItem("verify_notice");
  if (verifyNotice) {
    setFormSuccess("verifyError", verifyNotice);
    localStorage.removeItem("verify_notice");
  }

  verifyForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    clearFieldErrors(verifyForm);
    clearFormError("verifyError");

    const email = verifyForm.email.value.trim();
    const code = verifyForm.code.value.trim();
    if (!/^\S+@\S+\.\S+$/.test(email)) {
      setFieldError(verifyForm.email, "البريد الإلكتروني غير صحيح");
      return;
    }
    if (!/^\d{6}$/.test(code)) {
      setFieldError(verifyForm.code, "الرمز يجب أن يكون 6 أرقام");
      return;
    }

    try {
      const res = await withTimeoutFetch(`${API}/auth/verify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, code })
      });
      if (res.ok) {
        setFieldSuccess(verifyForm.code, "تم تأكيد الحساب");
        setFormSuccess("verifyError", "تم تأكيد الحساب بنجاح، جاري التحويل...");
        localStorage.removeItem("pending_verify_email");
        setTimeout(() => (location.href = "login.html"), 1200);
        return;
      }
      const msg = await readError(res, "تعذر تأكيد الحساب");
      setFieldError(verifyForm.code, msg);
      setFormError("verifyError", msg);
    } catch (err) {
      const msg = err?.name === "AbortError" ? "انتهت مهلة الاتصال، حاول مرة أخرى" : "تعذر الاتصال بالخادم";
      setFieldError(verifyForm.code, msg);
      setFormError("verifyError", msg);
    }
  });
}

const resendBtn = document.getElementById("resendCodeBtn");
if (resendBtn) {
  resendBtn.addEventListener("click", async () => {
    const emailInput = document.querySelector("#verifyForm input[name='email']");
    const email = emailInput ? emailInput.value.trim() : "";
    if (!/^\S+@\S+\.\S+$/.test(email)) {
      setFieldError(emailInput, "اكتب البريد الإلكتروني أولاً");
      return;
    }

    resendBtn.disabled = true;
    const oldText = resendBtn.textContent;
    resendBtn.textContent = "جارٍ الإرسال...";
    setFormSuccess("verifyError", "جارٍ إرسال رمز التفعيل... (قد يستغرق حتى 60 ثانية)");

    const startTime = Date.now();
    console.log("FRONTEND_RESEND_START", { email, api: `${API}/auth/resend` });
    
    // First, test if server is reachable
    try {
      const healthCheck = await fetch(`${AUTH_BACKEND}/`, { method: "GET", signal: AbortSignal.timeout(5000) });
      console.log("HEALTH_CHECK", { status: healthCheck.status, ok: healthCheck.ok });
    } catch (healthErr) {
      console.error("HEALTH_CHECK_FAILED", { error: healthErr.message });
      setFormError("verifyError", "لا يمكن الوصول إلى السيرفر. تأكد من أن السيرفر يعمل.");
      resendBtn.disabled = false;
      resendBtn.textContent = oldText;
      return;
    }
    
    try {
      const res = await withTimeoutFetch(`${API}/auth/resend`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email })
      }, 60000);

      const elapsed = Math.round((Date.now() - startTime) / 1000);
      console.log("FRONTEND_RESEND_RESPONSE", { status: res.status, ok: res.ok, elapsed });
      
      if (res.ok) {
        setFieldSuccess(emailInput, "تم إرسال كود التفعيل");
        setFormSuccess("verifyError", `تم إرسال رمز جديد إلى بريدك الإلكتروني (استغرق ${elapsed} ثانية)`);
      } else {
        const msg = await readError(res, "تعذر إرسال الكود");
        console.error("FRONTEND_RESEND_ERROR", { status: res.status, msg });
        setFieldError(emailInput, msg);
        setFormError("verifyError", msg);
      }
    } catch (err) {
      const elapsed = Math.round((Date.now() - startTime) / 1000);
      console.error("FRONTEND_RESEND_EXCEPTION", { 
        name: err?.name, 
        message: err?.message, 
        elapsed,
        stack: err?.stack 
      });
      
      let msg;
      if (err?.name === "AbortError") {
        msg = `انتهت مهلة الإرسال بعد ${elapsed} ثانية. قد يكون السيرفر بطيئًا أو هناك مشكلة في الاتصال. حاول مرة أخرى.`;
      } else {
        msg = `تعذر الاتصال بالخادم بعد ${elapsed} ثانية. تأكد من اتصالك بالإنترنت وحاول مرة أخرى.`;
      }
      setFieldError(emailInput, msg);
      setFormError("verifyError", msg);
    } finally {
      resendBtn.disabled = false;
      resendBtn.textContent = oldText;
    }
  });
}

const forgotForm = document.getElementById("forgotForm");
if (forgotForm) {
  forgotForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    clearFieldErrors(forgotForm);
    clearFormError("forgotError");

    const email = forgotForm.email.value.trim();
    if (!/^\S+@\S+\.\S+$/.test(email)) {
      setFieldError(forgotForm.email, "البريد الإلكتروني غير صحيح");
      return;
    }

    try {
      const res = await withTimeoutFetch(`${API}/auth/forgot`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email })
      }, 60000);
      if (res.ok) {
        setFieldSuccess(forgotForm.email, "تم إرسال الكود");
        setFormSuccess("forgotError", "تم إرسال الرمز إلى بريدك الإلكتروني");
        return;
      }
      const msg = await readError(res, "تعذر إرسال الكود");
      setFieldError(forgotForm.email, msg);
      setFormError("forgotError", msg);
    } catch (err) {
      const msg = err?.name === "AbortError" ? "انتهت مهلة الاتصال، حاول مرة أخرى" : "تعذر الاتصال بالخادم";
      setFieldError(forgotForm.email, msg);
      setFormError("forgotError", msg);
    }
  });
}

const resetForm = document.getElementById("resetForm");
if (resetForm) {
  resetForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    clearFieldErrors(resetForm);
    clearFormError("resetError");

    const email = resetForm.email.value.trim();
    const code = resetForm.code.value.trim();
    const newPassword = resetForm.newPassword.value;
    if (!/^\S+@\S+\.\S+$/.test(email)) return setFieldError(resetForm.email, "البريد الإلكتروني غير صحيح");
    if (!/^\d{6}$/.test(code)) return setFieldError(resetForm.code, "الرمز يجب أن يكون 6 أرقام");
    if (!newPassword || newPassword.length < 6) return setFieldError(resetForm.newPassword, "كلمة المرور يجب ألا تقل عن 6 أحرف");

    try {
      const res = await withTimeoutFetch(`${API}/auth/reset`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, code, newPassword })
      });
      if (res.ok) {
        setFieldSuccess(resetForm.newPassword, "تم تحديث كلمة المرور");
        setTimeout(() => (location.href = "login.html"), 800);
        return;
      }
      const msg = await readError(res, "تعذر تغيير كلمة المرور");
      setFieldError(resetForm.code, msg);
      setFormError("resetError", msg);
    } catch (err) {
      const msg = err?.name === "AbortError" ? "انتهت مهلة الاتصال، حاول مرة أخرى" : "تعذر الاتصال بالخادم";
      setFieldError(resetForm.code, msg);
      setFormError("resetError", msg);
    }
  });
}

checkOAuthStatus();
