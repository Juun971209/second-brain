const DEFAULTS = { owner: "Juun971209", repo: "second-brain", branch: "main" };

// --- chrome.storage.local helpers ---
function storageGet(keys) {
  return new Promise((resolve) => chrome.storage.local.get(keys, resolve));
}

function storageSet(items) {
  return new Promise((resolve) => chrome.storage.local.set(items, resolve));
}

function storageRemove(keys) {
  return new Promise((resolve) => chrome.storage.local.remove(keys, resolve));
}

async function getSettings() {
  const s = await storageGet(["gh_owner", "gh_repo", "gh_branch", "gh_token", "claude_key"]);
  return {
    owner: s.gh_owner || DEFAULTS.owner,
    repo: s.gh_repo || DEFAULTS.repo,
    branch: s.gh_branch || DEFAULTS.branch,
    token: s.gh_token || "",
    claudeKey: s.claude_key || "",
  };
}

// --- Settings modal ---
const settingsOverlay = document.getElementById("settingsOverlay");
const settingsToggle = document.getElementById("settingsToggle");
const settingsCancel = document.getElementById("settingsCancel");
const settingsSave = document.getElementById("settingsSave");
const settingsClear = document.getElementById("settingsClear");
const ghOwnerInput = document.getElementById("ghOwner");
const ghRepoInput = document.getElementById("ghRepo");
const ghBranchInput = document.getElementById("ghBranch");
const ghTokenInput = document.getElementById("ghToken");
const claudeKeyInput = document.getElementById("claudeKey");

async function openSettings() {
  const s = await getSettings();
  ghOwnerInput.value = s.owner;
  ghRepoInput.value = s.repo;
  ghBranchInput.value = s.branch;
  ghTokenInput.value = s.token;
  claudeKeyInput.value = s.claudeKey;
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

settingsSave.addEventListener("click", async () => {
  await storageSet({
    gh_owner: ghOwnerInput.value.trim() || DEFAULTS.owner,
    gh_repo: ghRepoInput.value.trim() || DEFAULTS.repo,
    gh_branch: ghBranchInput.value.trim() || DEFAULTS.branch,
    gh_token: ghTokenInput.value.trim(),
    claude_key: claudeKeyInput.value.trim(),
  });
  closeSettings();
  setStatus("GitHub 연결 정보가 저장되었어요.", "success");
});

settingsClear.addEventListener("click", async () => {
  await storageRemove(["gh_token", "claude_key"]);
  ghTokenInput.value = "";
  claudeKeyInput.value = "";
  setStatus("토큰을 삭제했어요.", "success");
});

// --- Note form ---
const form = document.getElementById("noteForm");
const categorySelect = document.getElementById("category");
const titleInput = document.getElementById("title");
const urlInput = document.getElementById("url");
const memoInput = document.getElementById("memo");
const excerptInput = document.getElementById("excerpt");
const pathPreview = document.getElementById("pathPreview");
const statusMsg = document.getElementById("statusMsg");
const saveBtn = document.getElementById("saveBtn");
const reextractBtn = document.getElementById("reextractBtn");

function setStatus(message, kind) {
  statusMsg.textContent = message;
  statusMsg.className = "status-msg" + (kind ? ` ${kind}` : "");
}

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

function utf8ToBase64(str) {
  return btoa(unescape(encodeURIComponent(str)));
}

function base64ToUtf8(b64) {
  return decodeURIComponent(escape(atob(b64.replace(/\n/g, ""))));
}

// --- Category sync (reads categories.json managed by the web app) ---
const DEFAULT_CATEGORIES = ["insights", "clients", "templates", "study", "prompts", "logs"];

function renderCategoryOptions(categories) {
  const previous = categorySelect.value;
  categorySelect.innerHTML = "";
  for (const c of categories) {
    const opt = document.createElement("option");
    opt.value = c;
    opt.textContent = c;
    categorySelect.appendChild(opt);
  }
  if (categories.includes(previous)) categorySelect.value = previous;
  updatePathPreview();
}

async function fetchCategories(owner, repo, branch, token) {
  const headers = { Accept: "application/vnd.github+json" };
  if (token) headers.Authorization = `token ${token}`;
  const res = await fetch(
    `https://api.github.com/repos/${owner}/${repo}/contents/categories.json?ref=${branch}`,
    { headers }
  );
  if (!res.ok) throw new Error(`GitHub API ${res.status}`);
  const data = await res.json();
  const list = JSON.parse(base64ToUtf8(data.content));
  if (!Array.isArray(list) || !list.length) throw new Error("invalid categories.json");
  return list;
}

async function loadCategories() {
  const { owner, repo, branch, token } = await getSettings();
  try {
    const list = await fetchCategories(owner, repo, branch, token);
    renderCategoryOptions(list);
  } catch (err) {
    console.warn("카테고리 목록을 불러오지 못했어요:", err);
  }
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

async function summarizeWithClaude({ apiKey, title, url, memo, excerpt }) {
  const systemPrompt = `너는 웹페이지 내용을 세컨드 브레인 노트로 정리하는 도우미야. 아래 형식의 마크다운만 출력하고, 다른 설명이나 코드블록 표시는 절대 추가하지 마.

## 요약
(3줄 이내로 핵심 내용 요약)

## 핵심 포인트
- (불릿 3~5개)

## 원문 발췌
(본문에서 가장 중요한 문장 1~2개를 그대로 인용)

## 내 메모
(아래 [사용자 메모]를 그대로 적어. 메모가 없으면 "없음"이라고 적어)

## 출처
${url}`;

  const userContent = `제목: ${title}\nURL: ${url}\n\n[추출된 본문]\n${excerpt || "(본문 추출 실패 또는 없음)"}\n\n[사용자 메모]\n${memo || "(없음)"}`;

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "anthropic-dangerous-direct-browser-access": "true",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-6",
      max_tokens: 1024,
      system: systemPrompt,
      messages: [{ role: "user", content: userContent }],
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Claude API ${res.status}: ${errText}`);
  }

  const data = await res.json();
  const text = (data.content || []).map((b) => b.text || "").join("\n").trim();
  if (!text) throw new Error("Claude API: empty response");
  return text;
}

async function saveNote({ owner, repo, branch, token, path, title, category, url, body }) {
  const date = todayISO();
  const markdown = `---\ntitle: ${title}\ndate: ${date}\ncategory: ${category}\nsource: ${url}\n---\n\n${body}\n`;

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

  const { owner, repo, branch, token, claudeKey } = await getSettings();
  if (!token) {
    setStatus("먼저 ⚙️ 설정에서 GitHub 토큰을 등록해주세요.", "error");
    openSettings();
    return;
  }

  const title = titleInput.value.trim();
  const category = categorySelect.value;
  const url = urlInput.value.trim();
  const memo = memoInput.value.trim();
  const excerpt = excerptInput.value.trim();
  const path = buildPath();

  saveBtn.disabled = true;

  let body;
  if (claudeKey) {
    setStatus("Claude로 요약 정리 중...", "");
    try {
      body = await summarizeWithClaude({ apiKey: claudeKey, title, url, memo, excerpt });
    } catch (err) {
      console.error(err);
      setStatus("Claude 요약 실패: API 키를 확인해주세요.", "error");
      saveBtn.disabled = false;
      return;
    }
  } else {
    const sections = [];
    if (memo) sections.push(`## 메모`, ``, memo, ``);
    if (excerpt) sections.push(`## 추출 내용`, ``, excerpt, ``);
    body = sections.join("\n");
  }

  setStatus("GitHub에 저장 중...", "");
  try {
    await saveNote({ owner, repo, branch, token, path, title, category, url, body });
    setStatus(`저장 완료: ${path}`, "success");
  } catch (err) {
    console.error(err);
    setStatus("저장 실패: 토큰 권한 또는 저장소 설정을 확인해주세요.", "error");
  } finally {
    saveBtn.disabled = false;
  }
});

// --- Active tab info + content extraction ---
function getActiveTab() {
  return new Promise((resolve) => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => resolve(tabs[0]));
  });
}

function isInjectableUrl(url) {
  return /^https?:\/\//.test(url || "");
}

async function extractFromTab(tab) {
  if (!tab || !isInjectableUrl(tab.url)) {
    setStatus("이 페이지에서는 본문을 추출할 수 없어요. 직접 입력해주세요.", "");
    return;
  }

  excerptInput.placeholder = "본문 추출 중...";

  const onMessage = (message) => {
    if (message?.type !== "SB_EXTRACTED_CONTENT") return;
    excerptInput.value = message.excerpt || "";
    excerptInput.placeholder = "페이지 본문에서 핵심 내용을 추출합니다...";
    chrome.runtime.onMessage.removeListener(onMessage);
  };
  chrome.runtime.onMessage.addListener(onMessage);

  try {
    await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ["content.js"] });
  } catch (err) {
    console.error(err);
    chrome.runtime.onMessage.removeListener(onMessage);
    excerptInput.placeholder = "본문 추출에 실패했어요. 직접 입력해주세요.";
  }
}

async function init() {
  renderCategoryOptions(DEFAULT_CATEGORIES);
  loadCategories();

  const tab = await getActiveTab();
  if (tab) {
    titleInput.value = tab.title || "";
    urlInput.value = tab.url || "";
  }
  updatePathPreview();

  reextractBtn.addEventListener("click", () => extractFromTab(tab));
  await extractFromTab(tab);

  const settings = await getSettings();
  if (!settings.token) openSettings();
}

init();
