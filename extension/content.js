// Injected on demand by popup.js (chrome.scripting.executeScript).
// Extracts a best-effort "main content" excerpt from the current page and
// sends it back to the popup via runtime messaging.
(() => {
  const SKIP_TAGS = new Set([
    "SCRIPT",
    "STYLE",
    "NOSCRIPT",
    "NAV",
    "HEADER",
    "FOOTER",
    "ASIDE",
    "FORM",
    "IFRAME",
    "SVG",
    "BUTTON",
  ]);

  function findMainNode() {
    const candidates = [
      "article",
      "main",
      '[role="main"]',
      "#content",
      ".content",
      ".post",
      ".article",
    ];
    for (const sel of candidates) {
      const el = document.querySelector(sel);
      if (el && el.innerText && el.innerText.trim().length > 200) return el;
    }
    return document.body;
  }

  function extractText(root) {
    const clone = root.cloneNode(true);
    clone.querySelectorAll(Array.from(SKIP_TAGS).join(",")).forEach((el) => el.remove());
    const text = clone.innerText || clone.textContent || "";
    return text
      .replace(/\r/g, "")
      .replace(/[ \t]+/g, " ")
      .replace(/\n{3,}/g, "\n\n")
      .trim();
  }

  const MAX_LENGTH = 4000;
  const root = findMainNode();
  let excerpt = extractText(root);
  if (excerpt.length > MAX_LENGTH) {
    excerpt = excerpt.slice(0, MAX_LENGTH).trim() + "\n\n…(이하 생략)";
  }

  chrome.runtime.sendMessage({
    type: "SB_EXTRACTED_CONTENT",
    excerpt,
    url: location.href,
    title: document.title,
  });
})();
