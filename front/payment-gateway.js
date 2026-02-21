function updateCartCount() {
  const el = document.getElementById("cartCount");
  if (!el) return;
  const cart = JSON.parse(localStorage.getItem("cart") || "[]");
  el.textContent = cart.reduce((sum, i) => sum + Number(i.quantity || 0), 0);
}

function methodLabel(method) {
  const map = {
    fawry: "فوري",
    vodafone_cash: "فودافون كاش",
    visa: "Visa / MasterCard",
    paypal: "PayPal",
    paymob: "Paymob"
  };
  return map[method] || method;
}

function buildInstructions(method, tx, total) {
  if (method === "fawry") {
    return `
      <p>توجّه إلى أقرب منفذ فوري واطلب خدمة <strong>788</strong>.</p>
      <p>أعطِ الكاشير كود العملية: <code>${tx}</code> والمبلغ: <strong>${total} جنيه</strong>.</p>
    `;
  }
  if (method === "vodafone_cash") {
    return `
      <p>افتح محفظة فودافون كاش واختر "دفع" ثم "أدخل كود التاجر".</p>
      <p>استخدم كود العملية: <code>${tx}</code> بقيمة <strong>${total} جنيه</strong>.</p>
    `;
  }
  if (method === "visa") {
    return `
      <p>سيتم التحويل إلى صفحة إدخال البطاقة.</p>
      <p>رقم مرجع العملية: <code>${tx}</code>.</p>
    `;
  }
  if (method === "paypal") {
    return `
      <p>سجّل دخول PayPal وأكّد الدفع.</p>
      <p>رقم مرجع العملية: <code>${tx}</code>.</p>
    `;
  }
  return `
    <p>أكمل الدفع عبر ${methodLabel(method)}.</p>
    <p>رقم مرجع العملية: <code>${tx}</code>.</p>
  `;
}

function goBack(orderId, tx, status) {
  const params = new URLSearchParams({
    orderId,
    tx: tx || "",
    gatewayStatus: status
  });
  location.href = `payment.html?${params.toString()}`;
}

function initGateway() {
  updateCartCount();

  const params = new URLSearchParams(location.search);
  const orderId = params.get("orderId");
  const method = params.get("method");
  const tx = params.get("tx");
  const total = Number(params.get("total") || 0).toFixed(0);

  const title = document.getElementById("gatewayTitle");
  const info = document.getElementById("gatewayInfo");
  const instructions = document.getElementById("gatewayInstructions");
  const successBtn = document.getElementById("gatewaySuccessBtn");
  const failBtn = document.getElementById("gatewayFailBtn");

  if (!orderId || !method) {
    info.textContent = "بيانات الدفع غير مكتملة.";
    successBtn.disabled = true;
    failBtn.disabled = true;
    return;
  }

  title.textContent = `بوابة ${methodLabel(method)}`;
  info.innerHTML = `رقم الطلب: <code>${orderId}</code><br>كود العملية: <code>${tx || "-"}</code>`;
  instructions.innerHTML = buildInstructions(method, tx || "-", total);

  successBtn.addEventListener("click", () => goBack(orderId, tx, "return"));
  failBtn.addEventListener("click", () => goBack(orderId, tx, "failed"));
}

initGateway();

