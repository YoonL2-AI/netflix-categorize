const TMDB_BASE = "https://api.themoviedb.org/3";
const IMG_BASE = "https://image.tmdb.org/t/p/w342";
const BACKDROP_BASE = "https://image.tmdb.org/t/p/w780";
const NETFLIX_PROVIDER_ID = 8;
const STORAGE_KEY = "tmdb_api_key";
const PAGE_SIZE_NOTICE = 20; // TMDB discover page size

// Netflix가 실제로 브라우징 화면에서 쓰는 대분류 장르를, TMDB가 제공하는
// 공식 장르 ID로 최대한 가깝게 매핑한 표. TMDB에는 "공포/로맨스" TV 장르가
// 없어 해당 카테고리는 영화만 나온다.
const CATEGORIES = [
  { id: "action", label: "액션 & 어드벤처", movieGenres: [28, 12], tvGenres: [10759] },
  { id: "comedy", label: "코미디", movieGenres: [35], tvGenres: [35] },
  { id: "drama", label: "드라마", movieGenres: [18], tvGenres: [18] },
  { id: "horror", label: "공포", movieGenres: [27], tvGenres: [], note: "영화만 제공" },
  { id: "romance", label: "로맨스", movieGenres: [10749], tvGenres: [], note: "영화만 제공" },
  { id: "scifi", label: "SF & 판타지", movieGenres: [878, 14], tvGenres: [10765] },
  { id: "thriller", label: "스릴러 & 미스터리", movieGenres: [53, 9648], tvGenres: [9648] },
  { id: "crime", label: "범죄", movieGenres: [80], tvGenres: [80] },
  { id: "documentary", label: "다큐멘터리", movieGenres: [99], tvGenres: [99] },
  { id: "animation", label: "애니메이션", movieGenres: [16], tvGenres: [16] },
  { id: "family", label: "키즈 & 가족", movieGenres: [10751], tvGenres: [10751, 10762] },
  { id: "war", label: "전쟁 & 정치", movieGenres: [10752], tvGenres: [10768] },
  { id: "music", label: "음악 & 뮤지컬", movieGenres: [10402], tvGenres: [], note: "영화만 제공" },
  { id: "reality", label: "예능 & 리얼리티", movieGenres: [], tvGenres: [10764], note: "시리즈만 제공" },
  { id: "kdrama", label: "한국 콘텐츠", special: "origin", originCountry: "KR" },
  { id: "mature", label: "19금", special: "certification", note: "영화만 · 국가별 등급 기준" },
];

// TMDB discover/movie의 certification 필터는 국가별 등급 표기를 그대로 써야 해서,
// 주요 국가의 "청소년 관람불가"에 해당하는 등급 문자열을 매핑해둔다.
const MATURE_CERT_BY_REGION = {
  KR: "19", US: "R", GB: "18", JP: "R18+", DE: "18", FR: "16",
  CA: "18A", AU: "R18+", IN: "A", BR: "18", MX: "C", ES: "18", IT: "VM18",
};

const state = {
  apiKey: localStorage.getItem(STORAGE_KEY) || "",
  region: "KR",
  regions: [],
  category: CATEGORIES[0],
  query: "",
  page: 1,
  hasMore: false,
  items: [],
  loading: false,
};

const els = {
  regionSelect: document.getElementById("regionSelect"),
  searchInput: document.getElementById("searchInput"),
  settingsBtn: document.getElementById("settingsBtn"),
  nav: document.getElementById("categoryNav"),
  grid: document.getElementById("grid"),
  resultCount: document.getElementById("resultCount"),
  statusMsg: document.getElementById("statusMsg"),
  emptyMsg: document.getElementById("emptyMsg"),
  loadMoreBtn: document.getElementById("loadMoreBtn"),
  modalOverlay: document.getElementById("modalOverlay"),
  modal: document.getElementById("modal"),
  apiKeyOverlay: document.getElementById("apiKeyOverlay"),
  apiKeyInput: document.getElementById("apiKeyInput"),
  apiKeyError: document.getElementById("apiKeyError"),
  apiKeySave: document.getElementById("apiKeySave"),
};

const regionDisplayNames = (() => {
  try {
    return new Intl.DisplayNames(["ko"], { type: "region" });
  } catch {
    return null;
  }
})();

function regionLabel(code, englishFallback) {
  const localized = regionDisplayNames ? regionDisplayNames.of(code) : null;
  return localized || englishFallback || code;
}

async function tmdbFetch(path, params = {}) {
  const url = new URL(TMDB_BASE + path);
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== "") url.searchParams.set(k, v);
  });
  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${state.apiKey}`,
      "Content-Type": "application/json;charset=utf-8",
    },
  });
  if (res.status === 401) {
    const err = new Error("TMDB API 키가 유효하지 않습니다.");
    err.code = "UNAUTHORIZED";
    throw err;
  }
  if (!res.ok) {
    const err = new Error(`TMDB 요청 실패 (${res.status})`);
    err.code = res.status;
    throw err;
  }
  return res.json();
}

function showStatus(msg) {
  els.statusMsg.textContent = msg;
  els.statusMsg.hidden = !msg;
}

// ---------- API 키 설정 ----------

function openApiKeyModal(errorMsg) {
  els.apiKeyInput.value = state.apiKey || "";
  els.apiKeyError.hidden = !errorMsg;
  if (errorMsg) els.apiKeyError.textContent = errorMsg;
  els.apiKeyOverlay.hidden = false;
}

function closeApiKeyModal() {
  els.apiKeyOverlay.hidden = true;
}

els.settingsBtn.addEventListener("click", () => openApiKeyModal());

els.apiKeySave.addEventListener("click", async () => {
  const value = els.apiKeyInput.value.trim();
  if (!value) {
    els.apiKeyError.textContent = "API 키를 입력해주세요.";
    els.apiKeyError.hidden = false;
    return;
  }
  state.apiKey = value;
  localStorage.setItem(STORAGE_KEY, value);
  els.apiKeySave.disabled = true;
  els.apiKeySave.textContent = "확인 중...";
  try {
    await tmdbFetch("/authentication");
    closeApiKeyModal();
    await bootstrap();
  } catch (e) {
    els.apiKeyError.textContent =
      e.code === "UNAUTHORIZED" ? "키가 올바르지 않습니다. 다시 확인해주세요." : e.message;
    els.apiKeyError.hidden = false;
  } finally {
    els.apiKeySave.disabled = false;
    els.apiKeySave.textContent = "저장하고 시작하기";
  }
});

// ---------- 국가 선택 ----------

async function loadRegions() {
  const data = await tmdbFetch("/watch/providers/regions");
  state.regions = (data.results || [])
    .map((r) => ({ code: r.iso_3166_1, label: regionLabel(r.iso_3166_1, r.english_name) }))
    .sort((a, b) => a.label.localeCompare(b.label, "ko"));

  els.regionSelect.innerHTML = "";
  state.regions.forEach((r) => {
    const opt = document.createElement("option");
    opt.value = r.code;
    opt.textContent = `${r.label} (${r.code})`;
    if (r.code === state.region) opt.selected = true;
    els.regionSelect.appendChild(opt);
  });
}

els.regionSelect.addEventListener("change", (e) => {
  state.region = e.target.value;
  state.page = 1;
  loadCategory();
});

// ---------- 카테고리 ----------

function renderCategoryChips() {
  els.nav.innerHTML = "";
  CATEGORIES.forEach((cat) => {
    const btn = document.createElement("button");
    btn.className = "chip" + (cat.id === state.category.id ? " active" : "") + (cat.id === "mature" ? " chip-mature" : "");
    btn.textContent = cat.label;
    btn.title = cat.note || "";
    btn.addEventListener("click", () => {
      state.category = cat;
      state.page = 1;
      renderCategoryChips();
      loadCategory();
    });
    els.nav.appendChild(btn);
  });
}

function buildDiscoverRequests(category, region, page) {
  const common = {
    watch_region: region,
    with_watch_providers: NETFLIX_PROVIDER_ID,
    with_watch_monetization_types: "flatrate",
    sort_by: "popularity.desc",
    page,
  };

  if (category.special === "origin") {
    return [
      { mediaType: "movie", params: { ...common, with_origin_country: category.originCountry } },
      { mediaType: "tv", params: { ...common, with_origin_country: category.originCountry } },
    ];
  }

  if (category.special === "certification") {
    const cert = MATURE_CERT_BY_REGION[region];
    if (!cert) return [];
    return [
      {
        mediaType: "movie",
        params: { ...common, certification_country: region, certification: cert },
      },
    ];
  }

  const requests = [];
  if (category.movieGenres.length) {
    requests.push({ mediaType: "movie", params: { ...common, with_genres: category.movieGenres.join("|") } });
  }
  if (category.tvGenres.length) {
    requests.push({ mediaType: "tv", params: { ...common, with_genres: category.tvGenres.join("|") } });
  }
  return requests;
}

async function loadCategory() {
  if (!state.apiKey) return;
  state.loading = true;
  showStatus("불러오는 중...");
  els.loadMoreBtn.hidden = true;

  const requests = buildDiscoverRequests(state.category, state.region, state.page);

  if (!requests.length) {
    state.items = state.page === 1 ? [] : state.items;
    state.hasMore = false;
    showStatus(`${regionLabel(state.region)}에서는 이 카테고리의 등급 필터를 지원하지 않아요.`);
    render();
    state.loading = false;
    return;
  }

  try {
    const results = await Promise.all(
      requests.map((r) =>
        tmdbFetch(`/discover/${r.mediaType}`, r.params).then((data) => ({
          mediaType: r.mediaType,
          data,
        }))
      )
    );

    const fetched = results.flatMap(({ mediaType, data }) =>
      (data.results || []).map((item) => ({ ...item, media_type: mediaType }))
    );
    fetched.sort((a, b) => (b.popularity || 0) - (a.popularity || 0));

    const maxTotalPages = Math.max(0, ...results.map((r) => r.data.total_pages || 0));
    state.hasMore = state.page < maxTotalPages;

    if (state.page === 1) {
      state.items = fetched;
    } else {
      const seen = new Set(state.items.map((i) => `${i.media_type}:${i.id}`));
      fetched.forEach((item) => {
        const key = `${item.media_type}:${item.id}`;
        if (!seen.has(key)) {
          seen.add(key);
          state.items.push(item);
        }
      });
    }
    showStatus("");
  } catch (e) {
    if (e.code === "UNAUTHORIZED") {
      openApiKeyModal("키가 만료되었거나 올바르지 않습니다. 다시 입력해주세요.");
    }
    showStatus(`불러오기 실패: ${e.message}`);
  }

  state.loading = false;
  render();
}

// ---------- 렌더링 ----------

function getFiltered() {
  if (!state.query) return state.items;
  const q = state.query.toLowerCase();
  return state.items.filter((item) => {
    const title = (item.title || item.name || "").toLowerCase();
    const overview = (item.overview || "").toLowerCase();
    return title.includes(q) || overview.includes(q);
  });
}

function posterBlock(item) {
  if (item.poster_path) {
    return `<img class="card-poster-img" src="${IMG_BASE}${item.poster_path}" alt="${escapeHtml(item.title || item.name)} 포스터" loading="lazy" />`;
  }
  return `<div class="card-poster-fallback"><span>${escapeHtml(item.title || item.name || "")}</span></div>`;
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str ?? "";
  return div.innerHTML;
}

function render() {
  const filtered = getFiltered();
  const countLabel = state.query ? `검색 결과 ${filtered.length}개` : `${filtered.length}개의 콘텐츠`;
  els.resultCount.textContent = state.items.length ? countLabel : "";
  els.grid.innerHTML = "";
  els.emptyMsg.hidden = state.loading || filtered.length !== 0;
  els.loadMoreBtn.hidden = state.query !== "" || !state.hasMore;

  filtered.forEach((item) => {
    const title = item.title || item.name || "";
    const year = (item.release_date || item.first_air_date || "").slice(0, 4);
    const rating = typeof item.vote_average === "number" ? item.vote_average.toFixed(1) : "-";
    const typeLabel = item.media_type === "tv" ? "시리즈" : "영화";

    const card = document.createElement("div");
    card.className = "card";
    card.tabIndex = 0;
    card.innerHTML = `
      <div class="card-poster">
        ${posterBlock(item)}
        <span class="badge badge-type">${typeLabel}</span>
      </div>
      <div class="card-info">
        <p class="card-title">${escapeHtml(title)}</p>
        <div class="card-meta">
          <span>${year || "-"}</span>
          <span>★ ${rating}</span>
        </div>
      </div>
    `;
    card.addEventListener("click", () => openModal(item));
    card.addEventListener("keydown", (e) => {
      if (e.key === "Enter") openModal(item);
    });
    els.grid.appendChild(card);
  });
}

// ---------- 상세 모달 ----------

async function openModal(item) {
  const typeLabel = item.media_type === "tv" ? "시리즈" : "영화";
  els.modal.innerHTML = `
    <div class="modal-hero" style="background-image:${item.backdrop_path ? `url(${BACKDROP_BASE}${item.backdrop_path})` : "none"}">
      <div class="modal-hero-scrim"></div>
      <span class="modal-hero-title">${escapeHtml(item.title || item.name)}</span>
      <button class="modal-close" id="modalClose" aria-label="닫기">&times;</button>
    </div>
    <div class="modal-body">
      <div class="meta-row"><span class="badge">${typeLabel}</span><span>불러오는 중...</span></div>
    </div>
  `;
  els.modalOverlay.hidden = false;
  document.getElementById("modalClose").addEventListener("click", closeModal);

  try {
    const [detail, providers] = await Promise.all([
      tmdbFetch(`/${item.media_type}/${item.id}`),
      tmdbFetch(`/${item.media_type}/${item.id}/watch/providers`),
    ]);

    const genres = (detail.genres || []).map((g) => g.name).join(", ") || "-";
    const year = (detail.release_date || detail.first_air_date || "").slice(0, 4) || "-";
    const runtime = detail.runtime
      ? `${detail.runtime}분`
      : detail.number_of_seasons
      ? `시즌 ${detail.number_of_seasons}개 · 총 ${detail.number_of_episodes}화`
      : "-";
    const rating = typeof detail.vote_average === "number" ? detail.vote_average.toFixed(1) : "-";

    const netflixCountries = Object.entries(providers.results || {})
      .filter(([, v]) => (v.flatrate || []).some((p) => p.provider_id === NETFLIX_PROVIDER_ID))
      .map(([code]) => code)
      .sort((a, b) => regionLabel(a).localeCompare(regionLabel(b), "ko"));

    els.modal.innerHTML = `
      <div class="modal-hero" style="background-image:${detail.backdrop_path ? `url(${BACKDROP_BASE}${detail.backdrop_path})` : "none"}">
        <div class="modal-hero-scrim"></div>
        <span class="modal-hero-title">${escapeHtml(detail.title || detail.name)}</span>
        <button class="modal-close" id="modalClose" aria-label="닫기">&times;</button>
      </div>
      <div class="modal-body">
        <div class="meta-row">
          <span class="badge">${typeLabel}</span>
          <span>${year}</span>
          <span>★ ${rating}</span>
          <span>${runtime}</span>
        </div>
        <p class="modal-genres">${escapeHtml(genres)}</p>
        <p class="desc">${escapeHtml(detail.overview) || "줄거리 정보가 없습니다."}</p>
        <div class="availability">
          <p class="availability-title">
            넷플릭스 제공 국가 ${netflixCountries.length ? `(${netflixCountries.length}개국)` : ""}
          </p>
          ${
            netflixCountries.length
              ? `<div class="country-chips">${netflixCountries
                  .map(
                    (c) =>
                      `<span class="country-chip${c === state.region ? " current" : ""}">${escapeHtml(regionLabel(c))}</span>`
                  )
                  .join("")}</div>`
              : `<p class="availability-empty">현재 TMDB 데이터 기준으로 넷플릭스 제공 국가 정보가 없습니다.</p>`
          }
        </div>
      </div>
    `;
    document.getElementById("modalClose").addEventListener("click", closeModal);
  } catch (e) {
    els.modal.querySelector(".modal-body").innerHTML = `<p class="desc">상세 정보를 불러오지 못했습니다: ${escapeHtml(e.message)}</p>`;
  }
}

function closeModal() {
  els.modalOverlay.hidden = true;
}

els.modalOverlay.addEventListener("click", (e) => {
  if (e.target === els.modalOverlay) closeModal();
});
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") {
    closeModal();
  }
});

els.searchInput.addEventListener("input", (e) => {
  state.query = e.target.value.trim();
  render();
});

els.loadMoreBtn.addEventListener("click", () => {
  state.page += 1;
  loadCategory();
});

// ---------- 부트스트랩 ----------

async function bootstrap() {
  if (!state.apiKey) {
    openApiKeyModal();
    return;
  }
  renderCategoryChips();
  try {
    await loadRegions();
  } catch (e) {
    if (e.code === "UNAUTHORIZED") {
      openApiKeyModal("키가 올바르지 않습니다. 다시 확인해주세요.");
      return;
    }
  }
  await loadCategory();
}

bootstrap();
