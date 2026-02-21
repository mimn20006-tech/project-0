(function () {
  const dict = {
    ar: {
      title: "السياسات | Hand Aura",
      ship_title: "سياسة الشحن",
      ship_body: "يتم تجهيز الطلب خلال 24-72 ساعة عمل، ومدة التوصيل حسب المحافظة وشركة الشحن.",
      return_title: "سياسة الاسترجاع والاستبدال",
      return_body: "الاسترجاع أو الاستبدال خلال 14 يومًا من الاستلام بشرط سلامة المنتج وحالته الأصلية.",
      pay_title: "سياسة الدفع",
      pay_body: "نوفر الدفع عند الاستلام ووسائل الدفع الإلكتروني المتاحة. يتم تأكيد الطلب بعد نجاح عملية الدفع.",
      privacy_title: "سياسة الخصوصية",
      privacy_body: "نستخدم بيانات العميل لإتمام الطلب وتحسين الخدمة فقط، ولا تتم مشاركة البيانات مع طرف ثالث دون سبب تشغيلي.",
      back: "الرجوع للمتجر"
    },
    en: {
      title: "Policies | Hand Aura",
      ship_title: "Shipping Policy",
      ship_body: "Orders are prepared within 24-72 business hours, and delivery time depends on location and carrier.",
      return_title: "Return & Exchange Policy",
      return_body: "Return or exchange is available within 14 days of delivery if the product remains in original condition.",
      pay_title: "Payment Policy",
      pay_body: "We offer cash on delivery and available online payment methods. Orders are confirmed after successful payment.",
      privacy_title: "Privacy Policy",
      privacy_body: "Customer data is used only to process orders and improve service, and is not shared with third parties without operational need.",
      back: "Back to store"
    }
  };

  function applyPoliciesLang(lang) {
    const use = dict[lang] || dict.ar;
    document.title = use.title;
    document.documentElement.lang = lang === "ar" ? "ar" : "en";
    document.documentElement.dir = lang === "ar" ? "rtl" : "ltr";
    document.querySelectorAll("[data-k]").forEach((el) => {
      const k = el.getAttribute("data-k");
      if (use[k]) el.textContent = use[k];
    });
  }

  const langToggle = document.getElementById("langToggle");
  if (langToggle) {
    langToggle.textContent = ((window.getGlobalLang && window.getGlobalLang()) || "ar") === "ar" ? "AR" : "EN";
    langToggle.addEventListener("click", () => {
      const next = (localStorage.getItem("lang") || "ar") === "ar" ? "en" : "ar";
      localStorage.setItem("lang", next);
      langToggle.textContent = next === "ar" ? "AR" : "EN";
      if (typeof window.applyGlobalLang === "function") window.applyGlobalLang();
      applyPoliciesLang(next);
      window.dispatchEvent(new CustomEvent("app:langchange", { detail: { lang: next } }));
    });
  }

  const initial = (window.getGlobalLang && window.getGlobalLang()) || localStorage.getItem("lang") || "ar";
  applyPoliciesLang(initial);
  window.addEventListener("app:langchange", (e) => applyPoliciesLang(e?.detail?.lang || "ar"));
})();
