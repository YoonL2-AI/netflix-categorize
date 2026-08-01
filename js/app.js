const state = {
  items: [],
  category: "전체",
  query: "",
};

const els = {
  nav: document.getElementById("categoryNav"),
  grid: document.getElementById("grid"),
  resultCount: document.getElementById("resultCount"),
  emptyMsg: document.getElementById("emptyMsg"),
  searchInput: document.getElementById("searchInput"),
  modalOverlay: document.getElementById("modalOverlay"),
  modal: document.getElementById("modal"),
};

async function init() {
  const res = await fetch("data/contents.json");
  state.items = await res.json();
  renderCategories();
  render();

  els.searchInput.addEventListener("input", (e) => {
    state.query = e.target.value.trim().toLowerCase();
    render();
  });

  els.modalOverlay.addEventListener("click", (e) => {
    if (e.target === els.modalOverlay) closeModal();
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeModal();
  });
}

function renderCategories() {
  const categories = ["전체", ...new Set(state.items.map((i) => i.category)), "19금"];
  els.nav.innerHTML = "";
  categories.forEach((cat) => {
    const btn = document.createElement("button");
    btn.className = "chip" + (cat === state.category ? " active" : "") + (cat === "19금" ? " chip-mature" : "");
    btn.textContent = cat;
    btn.addEventListener("click", () => {
      state.category = cat;
      renderCategories();
      render();
    });
    els.nav.appendChild(btn);
  });
}

function getFiltered() {
  return state.items.filter((item) => {
    const matchesCategory =
      state.category === "전체" ||
      (state.category === "19금" ? item.mature === true : item.category === state.category);
    const matchesQuery =
      !state.query ||
      item.title.toLowerCase().includes(state.query) ||
      item.desc.toLowerCase().includes(state.query);
    return matchesCategory && matchesQuery;
  });
}

function render() {
  const filtered = getFiltered();
  els.resultCount.textContent = `${filtered.length}개의 콘텐츠`;
  els.grid.innerHTML = "";
  els.emptyMsg.hidden = filtered.length !== 0;

  filtered.forEach((item) => {
    const card = document.createElement("div");
    card.className = "card";
    card.innerHTML = `
      <div class="card-poster" style="background:${item.color}">
        ${item.mature ? '<span class="badge badge-mature">19</span>' : ""}
        ${item.title}
      </div>
      <div class="card-info">
        <p class="card-title">${item.title}</p>
        <div class="card-meta">
          <span class="badge">${item.category}</span>
          <span>★ ${item.rating.toFixed(1)}</span>
        </div>
      </div>
    `;
    card.addEventListener("click", () => openModal(item));
    els.grid.appendChild(card);
  });
}

function openModal(item) {
  els.modal.innerHTML = `
    <div class="modal-hero" style="background:${item.color}">
      ${item.title}
      <button class="modal-close" id="modalClose">&times;</button>
    </div>
    <div class="modal-body">
      <div class="meta-row">
        ${item.mature ? '<span class="badge badge-mature">19</span>' : ""}
        <span class="badge">${item.category}</span>
        <span>${item.year}</span>
        <span>★ ${item.rating.toFixed(1)}</span>
      </div>
      <p class="desc">${item.desc}</p>
    </div>
  `;
  els.modalOverlay.hidden = false;
  document.getElementById("modalClose").addEventListener("click", closeModal);
}

function closeModal() {
  els.modalOverlay.hidden = true;
}

init();
