// --- Theme toggle ---
const root = document.documentElement;
const themeToggle = document.getElementById("themeToggle");

function applyTheme(theme) {
  root.setAttribute("data-theme", theme);
  localStorage.setItem("theme", theme);
}

applyTheme(
  localStorage.getItem("theme") ||
    (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light")
);

themeToggle.addEventListener("click", () => {
  const current = root.getAttribute("data-theme");
  applyTheme(current === "dark" ? "light" : "dark");
});

// --- Note form ---
const form = document.getElementById("noteForm");
const categorySelect = document.getElementById("category");
const titleInput = document.getElementById("title");
const contentInput = document.getElementById("content");
const pathPreview = document.getElementById("pathPreview");
const statusMsg = document.getElementById("statusMsg");
const saveBtn = document.getElementById("saveBtn");

function slugify(str) {
  return (
    str
      .trim()
      .replace(/[<>:"/\\|?*]+/g, "")
      .replace(/\s+/g, "-")
      .slice(0, 60) || "untitled"
  );
}

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function buildPathPreview() {
  const category = categorySelect.value;
  const slug = slugify(titleInput.value || "untitled");
  return `${category}/${todayISO()}-${slug}.md`;
}

function updatePathPreview() {
  pathPreview.textContent = `저장 위치: ${buildPathPreview()}`;
}

categorySelect.addEventListener("input", updatePathPreview);
titleInput.addEventListener("input", updatePathPreview);
updatePathPreview();

function setStatus(message, kind) {
  statusMsg.textContent = message;
  statusMsg.className = "status-msg" + (kind ? ` ${kind}` : "");
}

form.addEventListener("submit", async (e) => {
  e.preventDefault();

  const category = categorySelect.value;
  const title = titleInput.value.trim();
  const content = contentInput.value.trim();

  saveBtn.disabled = true;
  setStatus("저장 중...", "");

  try {
    const res = await fetch("/api/save", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ category, title, content }),
    });
    const data = await res.json();

    if (data.ok) {
      setStatus(`저장 완료: ${data.path}`, "success");
      form.reset();
      categorySelect.value = category;
      updatePathPreview();
    } else {
      setStatus(`저장 실패: ${data.error || "알 수 없는 오류"}`, "error");
    }
  } catch (err) {
    setStatus('로컬 저장 서버에 연결할 수 없어요. 터미널에서 "node server.js"를 실행한 뒤 http://localhost:5500 으로 접속해주세요.', "error");
  } finally {
    saveBtn.disabled = false;
  }
});
