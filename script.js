// Storage access can throw (Safari private mode, some in-app webviews with
// storage disabled, etc). A single uncaught throw here would stop the whole
// script and silently disable every button below it, so all storage access
// goes through these safe wrappers.
function safeGet(storage, key) {
  try {
    return storage.getItem(key);
  } catch (err) {
    console.warn("storage read failed:", key, err);
    return null;
  }
}

function safeSet(storage, key, value) {
  try {
    storage.setItem(key, value);
  } catch (err) {
    console.warn("storage write failed:", key, err);
  }
}

function safeRemove(storage, key) {
  try {
    storage.removeItem(key);
  } catch (err) {
    console.warn("storage remove failed:", key, err);
  }
}

function prefersDark() {
  try {
    return window.matchMedia("(prefers-color-scheme: dark)").matches;
  } catch (err) {
    return false;
  }
}

// --- Theme toggle ---
const root = document.documentElement;
const themeToggle = document.getElementById("themeToggle");

function applyTheme(theme) {
  root.setAttribute("data-theme", theme);
  safeSet(localStorage, "theme", theme);
}

applyTheme(safeGet(localStorage, "theme") || (prefersDark() ? "dark" : "light"));

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
    owner: safeGet(localStorage, "gh_owner") || "Juun971209",
    repo: safeGet(localStorage, "gh_repo") || "second-brain",
    branch: safeGet(localStorage, "gh_branch") || "main",
    token: safeGet(sessionStorage, "gh_token") || safeGet(localStorage, "gh_token") || "",
    persisted: Boolean(safeGet(localStorage, "gh_token")),
  };
}

function openSettings() {
  const s = getSettings();
  ghOwnerInput.value = s.owner;
  ghRepoInput.value = s.repo;
  ghBranchInput.value = s.branch;
  ghTokenInput.value = s.token;
  persistTokenInput.checked = s.persisted;
  renderCategoryManagerList();
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
  safeSet(localStorage, "gh_owner", ghOwnerInput.value.trim() || "Juun971209");
  safeSet(localStorage, "gh_repo", ghRepoInput.value.trim() || "second-brain");
  safeSet(localStorage, "gh_branch", ghBranchInput.value.trim() || "main");

  const token = ghTokenInput.value.trim();
  if (persistTokenInput.checked) {
    safeSet(localStorage, "gh_token", token);
    safeRemove(sessionStorage, "gh_token");
  } else {
    safeSet(sessionStorage, "gh_token", token);
    safeRemove(localStorage, "gh_token");
  }

  closeSettings();
  setStatus("GitHub 연결 정보가 저장되었어요.", "success");
  notesLoaded = false;
  loadCategories();
});

settingsClear.addEventListener("click", () => {
  safeRemove(sessionStorage, "gh_token");
  safeRemove(localStorage, "gh_token");
  ghTokenInput.value = "";
  persistTokenInput.checked = false;
  setStatus("토큰을 삭제했어요.", "success");
});

// --- Shared GitHub helpers ---
function utf8ToBase64(str) {
  return btoa(unescape(encodeURIComponent(str)));
}

function base64ToUtf8(b64) {
  return decodeURIComponent(escape(atob(b64.replace(/\n/g, ""))));
}

async function githubPut(owner, repo, branch, token, path, { message, content, sha }) {
  const res = await fetch(`https://api.github.com/repos/${owner}/${repo}/contents/${path}`, {
    method: "PUT",
    headers: {
      Authorization: `token ${token}`,
      Accept: "application/vnd.github+json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ message, content, branch, ...(sha ? { sha } : {}) }),
  });
  if (!res.ok) throw new Error(`GitHub API ${res.status}: ${await res.text()}`);
  return res.json();
}

async function githubDelete(owner, repo, branch, token, path, sha, message) {
  const res = await fetch(`https://api.github.com/repos/${owner}/${repo}/contents/${path}`, {
    method: "DELETE",
    headers: {
      Authorization: `token ${token}`,
      Accept: "application/vnd.github+json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ message, sha, branch }),
  });
  if (!res.ok) throw new Error(`GitHub API ${res.status}: ${await res.text()}`);
}

async function githubListDir(owner, repo, branch, token, path) {
  const headers = { Accept: "application/vnd.github+json" };
  if (token) headers.Authorization = `token ${token}`;
  const res = await fetch(`https://api.github.com/repos/${owner}/${repo}/contents/${path}?ref=${branch}`, { headers });
  if (res.status === 404) return [];
  if (!res.ok) throw new Error(`GitHub API ${res.status}`);
  return res.json();
}

// --- Generic confirm modal (note delete, category delete) ---
const confirmOverlay = document.getElementById("confirmOverlay");
const confirmTitleEl = document.getElementById("confirmTitle");
const confirmMessageEl = document.getElementById("confirmMessage");
const confirmCancelBtn = document.getElementById("confirmCancelBtn");
const confirmOkBtn = document.getElementById("confirmOkBtn");

let pendingConfirmAction = null;

function openConfirm({ title, message, confirmLabel, onConfirm }) {
  confirmTitleEl.textContent = title;
  confirmMessageEl.textContent = message;
  confirmOkBtn.textContent = confirmLabel || "삭제";
  pendingConfirmAction = onConfirm;
  confirmOverlay.hidden = false;
}

function closeConfirm() {
  confirmOverlay.hidden = true;
  pendingConfirmAction = null;
}

confirmCancelBtn.addEventListener("click", closeConfirm);
confirmOverlay.addEventListener("click", (e) => {
  if (e.target === confirmOverlay) closeConfirm();
});
confirmOkBtn.addEventListener("click", async () => {
  const action = pendingConfirmAction;
  closeConfirm();
  if (action) await action();
});

// --- Category management ---
const DEFAULT_CATEGORIES = ["clients", "insights", "templates", "study", "prompts", "logs"];
let CATEGORIES = [...DEFAULT_CATEGORIES];
let categoriesSha = null;

const categorySelect = document.getElementById("category");
const categoryTabsEl = document.getElementById("categoryTabs");
const categoryManagerListEl = document.getElementById("categoryManagerList");
const categoryManagerStatusEl = document.getElementById("categoryManagerStatus");
const newCategoryInput = document.getElementById("newCategoryInput");
const addCategoryBtn = document.getElementById("addCategoryBtn");

function setCategoryManagerStatus(message, kind) {
  categoryManagerStatusEl.textContent = message;
  categoryManagerStatusEl.className = "status-msg" + (kind ? ` ${kind}` : "");
}

function normalizeCategoryName(str) {
  return (str || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9가-힣-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

async function fetchCategoriesFile(owner, repo, branch, token) {
  const headers = { Accept: "application/vnd.github+json" };
  if (token) headers.Authorization = `token ${token}`;
  const res = await fetch(`https://api.github.com/repos/${owner}/${repo}/contents/categories.json?ref=${branch}`, {
    headers,
  });
  if (res.status === 404) return { list: null, sha: null };
  if (!res.ok) throw new Error(`GitHub API ${res.status}`);
  const data = await res.json();
  const list = JSON.parse(base64ToUtf8(data.content));
  return { list, sha: data.sha };
}

async function saveCategoriesFile(owner, repo, branch, token, list) {
  const data = await githubPut(owner, repo, branch, token, "categories.json", {
    message: "Update categories",
    content: utf8ToBase64(JSON.stringify(list, null, 2) + "\n"),
    sha: categoriesSha,
  });
  categoriesSha = data.content.sha;
}

async function createCategoryFolder(owner, repo, branch, token, category) {
  await githubPut(owner, repo, branch, token, `${category}/README.md`, {
    message: `Add category: ${category}`,
    content: utf8ToBase64(`# ${category}\n`),
  });
}

async function deleteCategoryFolder(owner, repo, branch, token, category) {
  const files = (await githubListDir(owner, repo, branch, token, category)).filter((f) => f.type === "file");
  for (const f of files) {
    await githubDelete(owner, repo, branch, token, f.path, f.sha, `Remove category: ${category}`);
  }
}

async function renameCategoryFolder(owner, repo, branch, token, oldName, newName) {
  const files = (await githubListDir(owner, repo, branch, token, oldName)).filter((f) => f.type === "file");
  for (const f of files) {
    const headers = { Accept: "application/vnd.github+json" };
    if (token) headers.Authorization = `token ${token}`;
    const fileRes = await fetch(`https://api.github.com/repos/${owner}/${repo}/contents/${f.path}?ref=${branch}`, {
      headers,
    });
    if (!fileRes.ok) throw new Error(`GitHub API ${fileRes.status}`);
    const fileData = await fileRes.json();
    await githubPut(owner, repo, branch, token, `${newName}/${f.name}`, {
      message: `Rename category: ${oldName} -> ${newName}`,
      content: fileData.content,
    });
    await githubDelete(owner, repo, branch, token, f.path, f.sha, `Rename category: ${oldName} -> ${newName}`);
  }
}

function renderCategorySelectOptions() {
  const previous = categorySelect.value;
  categorySelect.innerHTML = "";
  for (const c of CATEGORIES) {
    const opt = document.createElement("option");
    opt.value = c;
    opt.textContent = c;
    categorySelect.appendChild(opt);
  }
  if (CATEGORIES.includes(previous)) categorySelect.value = previous;
  updatePathPreview();
}

function renderCategoryTabs() {
  categoryTabsEl.innerHTML = "";

  const allBtn = document.createElement("button");
  allBtn.type = "button";
  allBtn.className = "cat-tab" + (activeCategory === "all" ? " active" : "");
  allBtn.dataset.category = "all";
  allBtn.textContent = "전체";
  categoryTabsEl.appendChild(allBtn);

  for (const c of CATEGORIES) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "cat-tab" + (activeCategory === c ? " active" : "");
    btn.dataset.category = c;
    btn.textContent = c;
    categoryTabsEl.appendChild(btn);
  }

  if (!CATEGORIES.includes(activeCategory) && activeCategory !== "all") {
    activeCategory = "all";
  }
}

function renderCategoryManagerList() {
  categoryManagerListEl.innerHTML = "";
  for (const cat of CATEGORIES) {
    const li = document.createElement("li");
    li.className = "category-manager-item";

    const input = document.createElement("input");
    input.type = "text";
    input.value = cat;

    const renameBtn = document.createElement("button");
    renameBtn.type = "button";
    renameBtn.className = "btn btn-ghost btn-sm";
    renameBtn.textContent = "변경";
    renameBtn.addEventListener("click", () => handleRenameCategory(cat, input.value));

    const deleteBtn = document.createElement("button");
    deleteBtn.type = "button";
    deleteBtn.className = "btn btn-ghost btn-sm btn-danger";
    deleteBtn.textContent = "삭제";
    deleteBtn.addEventListener("click", () => handleDeleteCategory(cat));

    li.appendChild(input);
    li.appendChild(renameBtn);
    li.appendChild(deleteBtn);
    categoryManagerListEl.appendChild(li);
  }
}

async function handleRenameCategory(oldName, newNameRaw) {
  const newName = normalizeCategoryName(newNameRaw);
  if (!newName || newName === oldName) return;
  if (CATEGORIES.includes(newName)) {
    setCategoryManagerStatus("이미 존재하는 카테고리예요.", "error");
    return;
  }
  const { owner, repo, branch, token } = getSettings();
  if (!token) {
    setCategoryManagerStatus("먼저 GitHub 토큰을 등록해주세요.", "error");
    return;
  }

  setCategoryManagerStatus("카테고리 이름 변경 중...", "");
  try {
    await renameCategoryFolder(owner, repo, branch, token, oldName, newName);
    const updated = CATEGORIES.map((c) => (c === oldName ? newName : c));
    await saveCategoriesFile(owner, repo, branch, token, updated);
    CATEGORIES = updated;
    if (activeCategory === oldName) activeCategory = newName;
    renderCategorySelectOptions();
    renderCategoryTabs();
    renderCategoryManagerList();
    notesLoaded = false;
    setCategoryManagerStatus(`'${oldName}' → '${newName}'로 변경했어요.`, "success");
  } catch (err) {
    console.error(err);
    setCategoryManagerStatus("카테고리 변경에 실패했어요.", "error");
  }
}

function handleDeleteCategory(name) {
  openConfirm({
    title: "카테고리를 삭제할까요?",
    message: `'${name}' 카테고리와 그 안의 모든 노트가 삭제됩니다. 되돌릴 수 없어요.`,
    confirmLabel: "삭제",
    onConfirm: async () => {
      const { owner, repo, branch, token } = getSettings();
      if (!token) {
        setCategoryManagerStatus("먼저 GitHub 토큰을 등록해주세요.", "error");
        return;
      }
      setCategoryManagerStatus("카테고리 삭제 중...", "");
      try {
        await deleteCategoryFolder(owner, repo, branch, token, name);
        const updated = CATEGORIES.filter((c) => c !== name);
        await saveCategoriesFile(owner, repo, branch, token, updated);
        CATEGORIES = updated;
        if (activeCategory === name) activeCategory = "all";
        renderCategorySelectOptions();
        renderCategoryTabs();
        renderCategoryManagerList();
        notesLoaded = false;
        setCategoryManagerStatus(`'${name}' 카테고리를 삭제했어요.`, "success");
      } catch (err) {
        console.error(err);
        setCategoryManagerStatus("카테고리 삭제에 실패했어요.", "error");
      }
    },
  });
}

addCategoryBtn.addEventListener("click", async () => {
  const name = normalizeCategoryName(newCategoryInput.value);
  if (!name) return;
  if (CATEGORIES.includes(name)) {
    setCategoryManagerStatus("이미 존재하는 카테고리예요.", "error");
    return;
  }
  const { owner, repo, branch, token } = getSettings();
  if (!token) {
    setCategoryManagerStatus("먼저 GitHub 토큰을 등록해주세요.", "error");
    return;
  }

  setCategoryManagerStatus("카테고리 추가 중...", "");
  try {
    await createCategoryFolder(owner, repo, branch, token, name);
    const updated = [...CATEGORIES, name];
    await saveCategoriesFile(owner, repo, branch, token, updated);
    CATEGORIES = updated;
    renderCategorySelectOptions();
    renderCategoryTabs();
    renderCategoryManagerList();
    newCategoryInput.value = "";
    setCategoryManagerStatus(`'${name}' 카테고리를 추가했어요.`, "success");
  } catch (err) {
    console.error(err);
    setCategoryManagerStatus("카테고리 추가에 실패했어요.", "error");
  }
});

async function loadCategories() {
  const { owner, repo, branch, token } = getSettings();
  try {
    const { list, sha } = await fetchCategoriesFile(owner, repo, branch, token);
    if (list && Array.isArray(list) && list.length) {
      CATEGORIES = list;
      categoriesSha = sha;
    }
  } catch (err) {
    console.warn("카테고리 목록을 불러오지 못했어요:", err);
  }
  renderCategorySelectOptions();
  renderCategoryTabs();
  renderCategoryManagerList();
}

// --- Note form ---
const form = document.getElementById("noteForm");
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

function setStatus(message, kind) {
  statusMsg.textContent = message;
  statusMsg.className = "status-msg" + (kind ? ` ${kind}` : "");
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
  return githubPut(owner, repo, branch, token, path, { message: `Add note: ${title}`, content: utf8ToBase64(markdown), sha });
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
    notesLoaded = false;
  } catch (err) {
    console.error(err);
    setStatus("저장 실패: 토큰 권한 또는 저장소 설정을 확인해주세요.", "error");
  } finally {
    saveBtn.disabled = false;
  }
});

// --- View switching (write / browse / detail) ---
const tabWrite = document.getElementById("tabWrite");
const tabBrowse = document.getElementById("tabBrowse");
const writeView = document.getElementById("writeView");
const browseView = document.getElementById("browseView");
const detailView = document.getElementById("detailView");

function showView(view) {
  writeView.hidden = view !== "write";
  browseView.hidden = view !== "browse";
  detailView.hidden = view !== "detail";
  tabWrite.classList.toggle("active", view === "write");
  tabWrite.setAttribute("aria-selected", view === "write");
  tabBrowse.classList.toggle("active", view !== "write");
  tabBrowse.setAttribute("aria-selected", view !== "write");
}

tabWrite.addEventListener("click", () => showView("write"));
tabBrowse.addEventListener("click", () => {
  showView("browse");
  if (!notesLoaded) loadAllNotes();
});

// --- Note browsing ---
const searchInput = document.getElementById("searchInput");
const noteListEl = document.getElementById("noteList");
const browseStatusEl = document.getElementById("browseStatus");

let allNotes = [];
let notesLoaded = false;
let activeCategory = "all";

function setBrowseStatus(message, kind) {
  browseStatusEl.textContent = message;
  browseStatusEl.className = "status-msg" + (kind ? ` ${kind}` : "");
}

function parseNoteFilename(category, name) {
  const match = name.match(/^(\d{4}-\d{2}-\d{2})-(.+)\.md$/);
  if (!match) return null;
  return { category, name, date: match[1], title: match[2].replace(/-/g, " ") };
}

async function fetchCategoryNotes(owner, repo, branch, token, category) {
  const files = await githubListDir(owner, repo, branch, token, category);
  return files
    .filter((f) => f.type === "file")
    .map((f) => {
      const parsed = parseNoteFilename(category, f.name);
      return parsed && { ...parsed, path: f.path, sha: f.sha, download_url: f.download_url };
    })
    .filter(Boolean);
}

async function loadAllNotes() {
  const { owner, repo, branch, token } = getSettings();
  if (!token) {
    setBrowseStatus("먼저 ⚙️ 설정에서 GitHub 토큰을 등록해주세요.", "error");
    return;
  }

  setBrowseStatus("노트를 불러오는 중...", "");
  try {
    const results = await Promise.all(
      CATEGORIES.map((c) => fetchCategoryNotes(owner, repo, branch, token, c))
    );
    allNotes = results.flat().sort((a, b) => b.date.localeCompare(a.date));
    notesLoaded = true;
    setBrowseStatus("", "");
    renderNoteList();
  } catch (err) {
    console.error(err);
    setBrowseStatus("노트를 불러오지 못했어요. 토큰 권한을 확인해주세요.", "error");
  }
}

function renderNoteList() {
  const query = searchInput.value.trim().toLowerCase();
  const filtered = allNotes.filter((n) => {
    const matchesCategory = activeCategory === "all" || n.category === activeCategory;
    const matchesQuery = !query || n.title.toLowerCase().includes(query);
    return matchesCategory && matchesQuery;
  });

  noteListEl.innerHTML = "";

  if (filtered.length === 0) {
    setBrowseStatus(notesLoaded ? "조건에 맞는 노트가 없어요." : "", "");
    return;
  }
  setBrowseStatus("", "");

  for (const note of filtered) {
    const li = document.createElement("li");
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "note-item";

    const titleEl = document.createElement("div");
    titleEl.className = "note-item-title";
    titleEl.textContent = note.title;

    const metaEl = document.createElement("div");
    metaEl.className = "note-item-meta";
    metaEl.textContent = `${note.category} · ${note.date}`;

    btn.appendChild(titleEl);
    btn.appendChild(metaEl);
    btn.addEventListener("click", () => openNoteDetail(note));
    li.appendChild(btn);
    noteListEl.appendChild(li);
  }
}

categoryTabsEl.addEventListener("click", (e) => {
  const btn = e.target.closest(".cat-tab");
  if (!btn) return;
  activeCategory = btn.dataset.category;
  categoryTabsEl
    .querySelectorAll(".cat-tab")
    .forEach((b) => b.classList.toggle("active", b === btn));
  renderNoteList();
});

searchInput.addEventListener("input", renderNoteList);

function parseFrontmatter(raw) {
  const match = raw.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (!match) return { meta: {}, body: raw };
  const meta = {};
  for (const line of match[1].split("\n")) {
    const i = line.indexOf(":");
    if (i === -1) continue;
    meta[line.slice(0, i).trim()] = line.slice(i + 1).trim();
  }
  return { meta, body: match[2] };
}

// --- Note detail (view / edit / delete) ---
const backBtn = document.getElementById("backBtn");
const editBtn = document.getElementById("editBtn");
const deleteBtn = document.getElementById("deleteBtn");
const detailViewModeEl = document.getElementById("detailViewMode");
const detailEditModeEl = document.getElementById("detailEditMode");
const noteDetailMeta = document.getElementById("noteDetailMeta");
const noteDetailContent = document.getElementById("noteDetailContent");
const editTitleInput = document.getElementById("editTitle");
const editContentInput = document.getElementById("editContent");
const editCancelBtn = document.getElementById("editCancelBtn");
const editSaveBtn = document.getElementById("editSaveBtn");
const detailStatusEl = document.getElementById("detailStatus");

let currentDetailNote = null;

function setDetailStatus(message, kind) {
  detailStatusEl.textContent = message;
  detailStatusEl.className = "status-msg" + (kind ? ` ${kind}` : "");
}

function renderDetailContent(title, body) {
  const html = marked.parse(body);
  noteDetailContent.innerHTML = DOMPurify.sanitize(html);
  const heading = document.createElement("h2");
  heading.textContent = title;
  noteDetailContent.prepend(heading);
}

async function openNoteDetail(note) {
  showView("detail");
  detailEditModeEl.hidden = true;
  detailViewModeEl.hidden = false;
  setDetailStatus("", "");
  noteDetailMeta.textContent = "";
  noteDetailContent.textContent = "불러오는 중...";
  currentDetailNote = null;

  try {
    const { token } = getSettings();
    const headers = {};
    if (token) headers.Authorization = `token ${token}`;

    const res = await fetch(note.download_url, { headers });
    if (!res.ok) throw new Error(`GitHub ${res.status}`);
    const raw = await res.text();
    const { meta, body } = parseFrontmatter(raw);

    const title = meta.title || note.title;
    const date = meta.date || note.date;
    const category = meta.category || note.category;
    noteDetailMeta.textContent = `${category} · ${date}`;

    currentDetailNote = { path: note.path, sha: note.sha, title, date, category, rawBody: body.trim() };

    renderDetailContent(title, body);
  } catch (err) {
    console.error(err);
    noteDetailContent.textContent = "노트를 불러오지 못했어요.";
  }
}

backBtn.addEventListener("click", () => {
  detailEditModeEl.hidden = true;
  detailViewModeEl.hidden = false;
  showView("browse");
});

editBtn.addEventListener("click", () => {
  if (!currentDetailNote) return;
  editTitleInput.value = currentDetailNote.title;
  editContentInput.value = currentDetailNote.rawBody;
  setDetailStatus("", "");
  detailViewModeEl.hidden = true;
  detailEditModeEl.hidden = false;
});

editCancelBtn.addEventListener("click", () => {
  detailEditModeEl.hidden = true;
  detailViewModeEl.hidden = false;
});

editSaveBtn.addEventListener("click", async () => {
  if (!currentDetailNote) return;
  const { owner, repo, branch, token } = getSettings();
  if (!token) {
    setDetailStatus("먼저 ⚙️ 설정에서 GitHub 토큰을 등록해주세요.", "error");
    return;
  }

  const newTitle = editTitleInput.value.trim();
  const newBody = editContentInput.value.trim();

  editSaveBtn.disabled = true;
  setDetailStatus("저장 중...", "");
  try {
    const markdown = `---\ntitle: ${newTitle}\ndate: ${currentDetailNote.date}\ncategory: ${currentDetailNote.category}\n---\n\n${newBody}\n`;
    const data = await githubPut(owner, repo, branch, token, currentDetailNote.path, {
      message: `Update note: ${newTitle}`,
      content: utf8ToBase64(markdown),
      sha: currentDetailNote.sha,
    });

    currentDetailNote.sha = data.content.sha;
    currentDetailNote.title = newTitle;
    currentDetailNote.rawBody = newBody;

    noteDetailMeta.textContent = `${currentDetailNote.category} · ${currentDetailNote.date}`;
    renderDetailContent(newTitle, newBody);

    const idx = allNotes.findIndex((n) => n.path === currentDetailNote.path);
    if (idx !== -1) allNotes[idx] = { ...allNotes[idx], title: newTitle };

    detailEditModeEl.hidden = true;
    detailViewModeEl.hidden = false;
    setDetailStatus("저장했어요.", "success");
  } catch (err) {
    console.error(err);
    setDetailStatus("저장에 실패했어요.", "error");
  } finally {
    editSaveBtn.disabled = false;
  }
});

deleteBtn.addEventListener("click", () => {
  if (!currentDetailNote) return;
  openConfirm({
    title: "정말 삭제할까요?",
    message: `'${currentDetailNote.title}' 노트를 삭제합니다. 되돌릴 수 없어요.`,
    confirmLabel: "삭제",
    onConfirm: async () => {
      const { owner, repo, branch, token } = getSettings();
      if (!token) {
        setDetailStatus("먼저 ⚙️ 설정에서 GitHub 토큰을 등록해주세요.", "error");
        return;
      }
      setDetailStatus("삭제 중...", "");
      try {
        await githubDelete(owner, repo, branch, token, currentDetailNote.path, currentDetailNote.sha, `Delete note: ${currentDetailNote.title}`);
        allNotes = allNotes.filter((n) => n.path !== currentDetailNote.path);
        renderNoteList();
        showView("browse");
        setBrowseStatus("노트를 삭제했어요.", "success");
      } catch (err) {
        console.error(err);
        setDetailStatus("삭제에 실패했어요.", "error");
      }
    },
  });
});

// --- Init ---
updatePathPreview();
loadCategories();

// First visit (or no token in either storage): prompt right away.
if (!getSettings().token) {
  openSettings();
}
