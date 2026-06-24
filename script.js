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

// --- GitHub connection settings ---
// Token lives in sessionStorage by default (cleared when the tab closes).
// Only moves to localStorage if the user explicitly checks "이 기기에서 유지".
const settingsOverlay = document.getElementById("settingsOverlay");
const settingsToggle = document.getElementById("settingsToggle");
const settingsCancel = document.getElementById("settingsCancel");
const settingsSave = document.getElementById("settingsSave");
const settingsClear = document.getElementById("settingsClear");
const ghOwnerInput = document.getElementById("ghOwner");
const ghRepoInput = document.getElementById("ghRepo");
const ghBranchInput = document.getElementById("ghBranch");
const ghTokenInput = document.getElementById("ghToken");
const persistTokenInput = document.getElementById("persistToken");

function getSettings() {
  return {
    owner: localStorage.getItem("gh_owner") || "Juun971209",
    repo: localStorage.getItem("gh_repo") || "second-brain",
    branch: localStorage.getItem("gh_branch") || "main",
    token: sessionStorage.getItem("gh_token") || localStorage.getItem("gh_token") || "",
    persisted: Boolean(localStorage.getItem("gh_token")),
  };
}

function openSettings() {
  const s = getSettings();
  ghOwnerInput.value = s.owner;
  ghRepoInput.value = s.repo;
  ghBranchInput.value = s.branch;
  ghTokenInput.value = s.token;
  persistTokenInput.checked = s.persisted;
  settingsOverlay.hidden = false;
}

function closeSettings() {
  settingsOverlay.hidden = true;
}

settingsToggle.addEventListener("click", openSettings);
settingsCancel.addEventListener("click", closeSettings);
settingsOverlay.addEventListener("click", (e) => {
  if (e.target === settingsOverlay) closeSettings();
});

settingsSave.addEventListener("click", () => {
  localStorage.setItem("gh_owner", ghOwnerInput.value.trim() || "Juun971209");
  localStorage.setItem("gh_repo", ghRepoInput.value.trim() || "second-brain");
  localStorage.setItem("gh_branch", ghBranchInput.value.trim() || "main");

  const token = ghTokenInput.value.trim();
  if (persistTokenInput.checked) {
    localStorage.setItem("gh_token", token);
    sessionStorage.removeItem("gh_token");
  } else {
    sessionStorage.setItem("gh_token", token);
    localStorage.removeItem("gh_token");
  }

  closeSettings();
  setStatus("GitHub 연결 정보가 저장되었어요.", "success");
});

settingsClear.addEventListener("click", () => {
  sessionStorage.removeItem("gh_token");
  localStorage.removeItem("gh_token");
  ghTokenInput.value = "";
  persistTokenInput.checked = false;
  setStatus("토큰을 삭제했어요.", "success");
});

// First visit (or no token in either storage): prompt right away.
if (!getSettings().token) {
  openSettings();
}

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

function buildPath() {
  const category = categorySelect.value;
  const slug = slugify(titleInput.value || "untitled");
  return `${category}/${todayISO()}-${slug}.md`;
}

function updatePathPreview() {
  pathPreview.textContent = `저장 위치: ${buildPath()}`;
}

categorySelect.addEventListener("input", updatePathPreview);
titleInput.addEventListener("input", updatePathPreview);
updatePathPreview();

function setStatus(message, kind) {
  statusMsg.textContent = message;
  statusMsg.className = "status-msg" + (kind ? ` ${kind}` : "");
}

function utf8ToBase64(str) {
  return btoa(unescape(encodeURIComponent(str)));
}

async function getExistingFileSha(owner, repo, path, token, branch) {
  const res = await fetch(
    `https://api.github.com/repos/${owner}/${repo}/contents/${path}?ref=${branch}`,
    { headers: { Authorization: `token ${token}`, Accept: "application/vnd.github+json" } }
  );
  if (res.status === 200) {
    const data = await res.json();
    return data.sha;
  }
  return null;
}

async function saveNote({ owner, repo, branch, token, path, title, category, body }) {
  const date = todayISO();
  const markdown = `---\ntitle: ${title}\ndate: ${date}\ncategory: ${category}\n---\n\n${body}\n`;

  const sha = await getExistingFileSha(owner, repo, path, token, branch);

  const res = await fetch(`https://api.github.com/repos/${owner}/${repo}/contents/${path}`, {
    method: "PUT",
    headers: {
      Authorization: `token ${token}`,
      Accept: "application/vnd.github+json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      message: `Add note: ${title}`,
      content: utf8ToBase64(markdown),
      branch,
      ...(sha ? { sha } : {}),
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`GitHub API ${res.status}: ${errText}`);
  }

  return res.json();
}

form.addEventListener("submit", async (e) => {
  e.preventDefault();

  const { owner, repo, branch, token } = getSettings();
  if (!token) {
    setStatus("먼저 ⚙️ 설정에서 GitHub 토큰을 등록해주세요.", "error");
    openSettings();
    return;
  }

  const title = titleInput.value.trim();
  const category = categorySelect.value;
  const body = contentInput.value.trim();
  const path = buildPath();

  saveBtn.disabled = true;
  setStatus("저장 중...", "");

  try {
    await saveNote({ owner, repo, branch, token, path, title, category, body });
    setStatus(`저장 완료: ${path}`, "success");
    form.reset();
    categorySelect.value = category;
    updatePathPreview();
  } catch (err) {
    console.error(err);
    setStatus("저장 실패: 토큰 권한 또는 저장소 설정을 확인해주세요.", "error");
  } finally {
    saveBtn.disabled = false;
  }
});
