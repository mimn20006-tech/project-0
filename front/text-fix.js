// Fix mojibake Arabic text in DOM nodes/attributes at runtime.
(function () {
  const mojibakeRe = /[ÃØÙÂâ]/;
  const arabicRe = /[\u0600-\u06FF]/;
  const attrNames = ["title", "placeholder", "aria-label", "alt", "value"];

  function decodeOnce(text) {
    if (!text || !mojibakeRe.test(text)) return text;
    try {
      const bytes = Uint8Array.from(String(text).split("").map((ch) => ch.charCodeAt(0) & 0xff));
      const decoded = new TextDecoder("utf-8").decode(bytes);
      return decoded || text;
    } catch {
      return text;
    }
  }

  function repairText(text) {
    const once = decodeOnce(text);
    // If we got Arabic after one pass, keep it. Otherwise return best effort.
    if (arabicRe.test(once)) return once;
    return once;
  }

  function fixTextNode(node) {
    if (!node || node.nodeType !== Node.TEXT_NODE) return;
    const src = node.nodeValue || "";
    if (!mojibakeRe.test(src)) return;
    const fixed = repairText(src);
    if (fixed !== src) node.nodeValue = fixed;
  }

  function fixElementAttrs(el) {
    if (!el || el.nodeType !== Node.ELEMENT_NODE) return;
    for (const name of attrNames) {
      const src = el.getAttribute(name);
      if (!src || !mojibakeRe.test(src)) continue;
      const fixed = repairText(src);
      if (fixed !== src) el.setAttribute(name, fixed);
    }
  }

  function scan(root) {
    if (!root) return;
    if (root.nodeType === Node.TEXT_NODE) {
      fixTextNode(root);
      return;
    }
    if (root.nodeType === Node.ELEMENT_NODE) {
      fixElementAttrs(root);
    }
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT);
    let current = walker.currentNode;
    while (current) {
      if (current.nodeType === Node.TEXT_NODE) fixTextNode(current);
      if (current.nodeType === Node.ELEMENT_NODE) fixElementAttrs(current);
      current = walker.nextNode();
    }
  }

  function observe() {
    const observer = new MutationObserver((mutations) => {
      for (const m of mutations) {
        if (m.type === "characterData") {
          fixTextNode(m.target);
          continue;
        }
        for (const node of m.addedNodes) scan(node);
        if (m.target && m.target.nodeType === Node.ELEMENT_NODE) fixElementAttrs(m.target);
      }
    });
    observer.observe(document.documentElement || document.body, {
      subtree: true,
      childList: true,
      characterData: true
    });
  }

  document.addEventListener("DOMContentLoaded", () => {
    scan(document.body);
    observe();
  });
})();

