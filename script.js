// 노트를 추가하려면 아래 배열에 { title, tag, date, summary } 객체를 추가하세요.
const NOTES = [
  {
    title: "환영합니다 👋",
    tag: "메모",
    date: "2026-06-24",
    summary: "이 노트들은 예시예요. 이 파일(script.js)의 NOTES 배열을 열어서 title, tag, date, summary를 바꾸거나 새 항목을 추가하면 바로 페이지에 반영됩니다.",
  },
  {
    title: "읽고 싶은 책 목록",
    tag: "독서",
    date: "2026-06-20",
    summary: "관심 있는 책들을 여기에 정리해보세요. 다 읽으면 한 줄 후기를 추가해도 좋아요.",
  },
  {
    title: "프로젝트 아이디어",
    tag: "아이디어",
    date: "2026-06-18",
    summary: "떠오르는 아이디어를 가볍게 적어두는 칸. 나중에 다시 볼 때 새로운 영감이 될 수 있어요.",
  },
  {
    title: "오늘 배운 것",
    tag: "학습",
    date: "2026-06-15",
    summary: "매일 배운 것 한 가지씩 짧게 기록해보세요. 작은 기록이 쌓이면 큰 자산이 됩니다.",
  },
];

const grid = document.getElementById("notesGrid");
const emptyState = document.getElementById("emptyState");
const searchInput = document.getElementById("searchInput");
const filterTagsEl = document.getElementById("filterTags");

let activeTag = "전체";
let query = "";

function renderTags() {
  const tags = ["전체", ...new Set(NOTES.map((n) => n.tag))];
  filterTagsEl.innerHTML = "";
  tags.forEach((tag) => {
    const btn = document.createElement("button");
    btn.className = "tag-btn" + (tag === activeTag ? " active" : "");
    btn.textContent = tag;
    btn.addEventListener("click", () => {
      activeTag = tag;
      renderTags();
      renderNotes();
    });
    filterTagsEl.appendChild(btn);
  });
}

function renderNotes() {
  const filtered = NOTES.filter((n) => {
    const matchesTag = activeTag === "전체" || n.tag === activeTag;
    const matchesQuery =
      !query ||
      n.title.toLowerCase().includes(query) ||
      n.summary.toLowerCase().includes(query);
    return matchesTag && matchesQuery;
  });

  grid.innerHTML = "";
  emptyState.hidden = filtered.length !== 0;

  filtered.forEach((n) => {
    const card = document.createElement("article");
    card.className = "note-card";
    card.innerHTML = `
      <h3>${n.title}</h3>
      <p>${n.summary}</p>
      <div class="note-meta">
        <span class="note-tag">${n.tag}</span>
        <span>${n.date}</span>
      </div>
    `;
    grid.appendChild(card);
  });
}

searchInput.addEventListener("input", (e) => {
  query = e.target.value.trim().toLowerCase();
  renderNotes();
});

renderTags();
renderNotes();

// Theme toggle
const themeToggle = document.getElementById("themeToggle");
const root = document.documentElement;

function applyTheme(theme) {
  root.setAttribute("data-theme", theme);
  localStorage.setItem("theme", theme);
}

const savedTheme =
  localStorage.getItem("theme") ||
  (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
applyTheme(savedTheme);

themeToggle.addEventListener("click", () => {
  const current = root.getAttribute("data-theme");
  applyTheme(current === "dark" ? "light" : "dark");
});
