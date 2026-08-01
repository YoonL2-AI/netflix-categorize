const TMDB_BASE = "https://api.themoviedb.org/3";
const IMG_BASE = "https://image.tmdb.org/t/p/w342";
const BACKDROP_BASE = "https://image.tmdb.org/t/p/w780";
const NETFLIX_PROVIDER_ID = 8;
const STORAGE_KEY = "tmdb_api_key";
const PAGE_SIZE_NOTICE = 20; // TMDB discover page size

// 넷플릭스 실제 화면의 "대분류 > 중분류 > 소분류" 장르 구조를 최대한 가깝게
// 재현한 표. 넷플릭스의 내부 시크릿 코드(browse/genre/1365 같은 숫자)는 공개
// API가 아니라서, 대신 TMDB의 실제 필터(장르 ID / 키워드 검색 / 제작 국가 /
// 개봉·방영 연도)를 조합해 각 소분류를 구성한다. 소분류의 keyword 값은 TMDB
// 키워드 검색(/search/keyword)으로 실시간 조회해 실제 존재하는 키워드에만
// 매칭된다.
//
// mid(중분류)의 media: "movie" | "tv" | "both" — 어느 미디어 타입으로 조회할지.
// leaf(소분류)는 mid의 장르에 extraMovieGenres/extraTvGenres로 장르를 더하거나,
// keyword/originCountry/dateFrom/dateTo로 범위를 좁힌다. "전체"는 추가 필터 없음.
const TAXONOMY = [
  {
    id: "action", label: "액션 & 모험",
    mids: [
      { id: "action-all", label: "액션 & 모험 전체", media: "both", movieGenres: [28, 12], tvGenres: [10759],
        leaves: [
          { id: "all", label: "전체" },
          { id: "superhero", label: "슈퍼히어로", keyword: "superhero" },
          { id: "martial-arts", label: "무술 영화", keyword: "martial arts" },
          { id: "spy", label: "스파이 & 첩보", keyword: "spy" },
          { id: "2020s", label: "2020년대 신작", dateFrom: "2020-01-01" },
        ] },
      { id: "war", label: "밀리터리 & 전쟁", media: "both", movieGenres: [10752], tvGenres: [10768],
        leaves: [
          { id: "all", label: "전체" },
          { id: "special-forces", label: "특수부대", keyword: "special forces" },
          { id: "true-story", label: "실화 기반", keyword: "based on true story" },
        ] },
    ],
  },
  {
    id: "comedy", label: "코미디",
    mids: [
      { id: "comedy-all", label: "코미디 전체", media: "both", movieGenres: [35], tvGenres: [35],
        leaves: [
          { id: "all", label: "전체" },
          { id: "rom-com", label: "로맨틱 코미디", extraMovieGenres: [10749] },
          { id: "dark-comedy", label: "블랙 코미디", keyword: "dark comedy" },
          { id: "parody", label: "패러디 & 스푸프", keyword: "parody" },
        ] },
      { id: "stand-up", label: "스탠드업 코미디", media: "movie", movieGenres: [35],
        leaves: [{ id: "all", label: "전체", keyword: "stand-up comedy" }] },
    ],
  },
  {
    id: "drama", label: "드라마",
    mids: [
      { id: "drama-all", label: "드라마 전체", media: "both", movieGenres: [18], tvGenres: [18],
        leaves: [
          { id: "all", label: "전체" },
          { id: "period", label: "시대극", keyword: "period drama" },
          { id: "courtroom", label: "법정 드라마", keyword: "court" },
          { id: "political", label: "정치 드라마", keyword: "politics" },
        ] },
      { id: "family-drama", label: "가족 드라마", media: "both", movieGenres: [18, 10751], tvGenres: [18, 10751],
        leaves: [
          { id: "all", label: "전체" },
          { id: "family-bond", label: "가족의 유대", keyword: "family relationships" },
        ] },
    ],
  },
  {
    id: "horror", label: "공포",
    mids: [
      { id: "horror-all", label: "공포 전체", media: "movie", movieGenres: [27], note: "영화만 제공",
        leaves: [
          { id: "all", label: "전체" },
          { id: "slasher", label: "슬래셔", keyword: "slasher" },
          { id: "ghost", label: "심령 & 유령", keyword: "ghost" },
          { id: "zombie", label: "좀비", keyword: "zombie" },
        ] },
      { id: "psych-horror", label: "심리 공포", media: "movie", movieGenres: [27, 53], note: "영화만 제공",
        leaves: [{ id: "all", label: "전체", keyword: "psychological horror" }] },
    ],
  },
  {
    id: "romance", label: "로맨스",
    mids: [
      { id: "romance-all", label: "로맨스 전체", media: "movie", movieGenres: [10749], note: "영화만 제공",
        leaves: [
          { id: "all", label: "전체" },
          { id: "rom-com2", label: "로맨틱 코미디", extraMovieGenres: [35] },
          { id: "period-romance", label: "시대극 로맨스", keyword: "period romance" },
          { id: "classic", label: "클래식 (1999년 이전)", dateTo: "1999-12-31" },
        ] },
    ],
  },
  {
    id: "scifi", label: "SF & 판타지",
    mids: [
      { id: "scifi-all", label: "SF & 판타지 전체", media: "both", movieGenres: [878, 14], tvGenres: [10765],
        leaves: [
          { id: "all", label: "전체" },
          { id: "space", label: "우주 SF", keyword: "space" },
          { id: "dystopia", label: "디스토피아", keyword: "dystopia" },
          { id: "magic", label: "마법 판타지", keyword: "magic" },
        ] },
      { id: "time-travel", label: "시간여행 & 평행세계", media: "both", movieGenres: [878, 14], tvGenres: [10765],
        leaves: [{ id: "all", label: "전체", keyword: "time travel" }] },
    ],
  },
  {
    id: "thriller", label: "스릴러 & 미스터리",
    mids: [
      { id: "thriller-all", label: "스릴러 & 미스터리 전체", media: "both", movieGenres: [53, 9648], tvGenres: [9648],
        leaves: [
          { id: "all", label: "전체" },
          { id: "crime-thriller", label: "범죄 스릴러", extraMovieGenres: [80], extraTvGenres: [80] },
          { id: "psych-thriller", label: "심리 스릴러", keyword: "psychological thriller" },
          { id: "detective", label: "수사물", keyword: "detective" },
        ] },
    ],
  },
  {
    id: "crime", label: "범죄",
    mids: [
      { id: "crime-all", label: "범죄 전체", media: "both", movieGenres: [80], tvGenres: [80],
        leaves: [
          { id: "all", label: "전체" },
          { id: "gangster", label: "갱스터", keyword: "gangster" },
          { id: "heist", label: "하이스트", keyword: "heist" },
          { id: "true-crime", label: "실화 범죄", keyword: "true crime" },
        ] },
    ],
  },
  {
    id: "documentary", label: "다큐멘터리",
    mids: [
      { id: "doc-all", label: "다큐멘터리 전체", media: "both", movieGenres: [99], tvGenres: [99],
        leaves: [
          { id: "all", label: "전체" },
          { id: "true-crime-doc", label: "실화 범죄 다큐", keyword: "true crime" },
          { id: "nature", label: "자연 다큐", keyword: "nature" },
          { id: "music-doc", label: "음악 다큐", keyword: "music documentary" },
        ] },
    ],
  },
  {
    id: "animation", label: "애니메이션",
    mids: [
      { id: "anim-all", label: "애니메이션 전체", media: "both", movieGenres: [16], tvGenres: [16],
        leaves: [
          { id: "all", label: "전체" },
          { id: "kids-anim", label: "키즈 애니메이션", extraMovieGenres: [10751], extraTvGenres: [10751] },
          { id: "adult-anim", label: "성인 애니메이션", keyword: "adult animation" },
        ] },
      { id: "anime", label: "일본 애니메이션", media: "both", movieGenres: [16], tvGenres: [16],
        leaves: [{ id: "all", label: "전체", originCountry: "JP" }] },
    ],
  },
  {
    id: "family", label: "키즈 & 가족",
    mids: [
      { id: "family-all", label: "키즈 & 가족 전체", media: "both", movieGenres: [10751], tvGenres: [10751, 10762],
        leaves: [
          { id: "all", label: "전체" },
          { id: "preschool", label: "유아용", keyword: "preschool" },
          { id: "family-adventure", label: "온가족 어드벤처", extraMovieGenres: [12] },
        ] },
    ],
  },
  {
    id: "kdrama", label: "한국 콘텐츠",
    mids: [
      { id: "kr-drama", label: "한국 드라마", media: "tv", originCountry: "KR",
        leaves: [
          { id: "all", label: "전체" },
          { id: "kr-drama-new", label: "2020년대", dateFrom: "2020-01-01" },
        ] },
      { id: "kr-movie", label: "한국 영화", media: "movie", originCountry: "KR",
        leaves: [{ id: "all", label: "전체" }] },
      { id: "kr-variety", label: "한국 예능", media: "tv", originCountry: "KR", tvGenres: [10764],
        leaves: [{ id: "all", label: "전체" }] },
    ],
  },
  {
    id: "reality", label: "예능 & 리얼리티",
    mids: [
      { id: "reality-all", label: "예능 & 리얼리티", media: "tv", tvGenres: [10764], note: "시리즈만 제공",
        leaves: [{ id: "all", label: "전체" }] },
    ],
  },
  {
    id: "music", label: "음악 & 뮤지컬",
    mids: [
      { id: "music-all", label: "음악 & 뮤지컬", media: "movie", movieGenres: [10402], note: "영화만 제공",
        leaves: [{ id: "all", label: "전체" }] },
    ],
  },
  {
    id: "mature", label: "19금",
    mids: [
      { id: "mature-all", label: "19금", special: "certification", note: "영화만 · 국가별 등급 기준",
        leaves: [{ id: "all", label: "전체" }] },
    ],
  },
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
  major: TAXONOMY[0],
  mid: TAXONOMY[0].mids[0],
  leaf: TAXONOMY[0].mids[0].leaves[0],
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
  majorNav: document.getElementById("majorNav"),
  midNav: document.getElementById("midNav"),
  leafNav: document.getElementById("leafNav"),
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

// ---------- 카테고리 (대분류 > 중분류 > 소분류) ----------

const keywordCache = new Map();

async function resolveKeywordId(text) {
  if (keywordCache.has(text)) return keywordCache.get(text);
  try {
    const data = await tmdbFetch("/search/keyword", { query: text });
    const id = (data.results || [])[0]?.id || null;
    keywordCache.set(text, id);
    return id;
  } catch {
    return null;
  }
}

function renderMajorChips() {
  els.majorNav.innerHTML = "";
  TAXONOMY.forEach((major) => {
    const btn = document.createElement("button");
    btn.className = "chip" + (major.id === state.major.id ? " active" : "") + (major.id === "mature" ? " chip-mature" : "");
    btn.textContent = major.label;
    btn.addEventListener("click", () => {
      state.major = major;
      state.mid = major.mids[0];
      state.leaf = state.mid.leaves[0];
      state.page = 1;
      renderMajorChips();
      renderMidChips();
      renderLeafChips();
      loadCategory();
    });
    els.majorNav.appendChild(btn);
  });
}

function renderMidChips() {
  els.midNav.innerHTML = "";
  state.major.mids.forEach((mid) => {
    const btn = document.createElement("button");
    btn.className = "chip" + (mid.id === state.mid.id ? " active" : "");
    btn.textContent = mid.label;
    btn.title = mid.note || "";
    btn.addEventListener("click", () => {
      state.mid = mid;
      state.leaf = mid.leaves[0];
      state.page = 1;
      renderMidChips();
      renderLeafChips();
      loadCategory();
    });
    els.midNav.appendChild(btn);
  });
}

function renderLeafChips() {
  els.leafNav.innerHTML = "";
  if (state.mid.leaves.length <= 1) return; // "전체" 하나뿐이면 3단계 행은 생략
  state.mid.leaves.forEach((leaf) => {
    const btn = document.createElement("button");
    btn.className = "chip" + (leaf.id === state.leaf.id ? " active" : "");
    btn.textContent = leaf.label;
    btn.addEventListener("click", () => {
      state.leaf = leaf;
      state.page = 1;
      renderLeafChips();
      loadCategory();
    });
    els.leafNav.appendChild(btn);
  });
}

async function buildDiscoverRequests(mid, leaf, region, page) {
  const common = {
    watch_region: region,
    with_watch_providers: NETFLIX_PROVIDER_ID,
    with_watch_monetization_types: "flatrate",
    sort_by: "popularity.desc",
    page,
  };

  if (mid.special === "certification") {
    const cert = MATURE_CERT_BY_REGION[region];
    if (!cert) return [];
    return [
      {
        mediaType: "movie",
        params: { ...common, certification_country: region, certification: cert },
      },
    ];
  }

  let keywordId = null;
  if (leaf.keyword) keywordId = await resolveKeywordId(leaf.keyword);

  const originCountry = leaf.originCountry || mid.originCountry;
  const media = mid.media || "both";
  const requests = [];

  if (media !== "tv") {
    const genres = [...(mid.movieGenres || []), ...(leaf.extraMovieGenres || [])];
    const params = { ...common };
    if (genres.length) params.with_genres = genres.join("|");
    if (originCountry) params.with_origin_country = originCountry;
    if (leaf.dateFrom) params["primary_release_date.gte"] = leaf.dateFrom;
    if (leaf.dateTo) params["primary_release_date.lte"] = leaf.dateTo;
    if (keywordId) params.with_keywords = keywordId;
    requests.push({ mediaType: "movie", params });
  }
  if (media !== "movie") {
    const genres = [...(mid.tvGenres || []), ...(leaf.extraTvGenres || [])];
    const params = { ...common };
    if (genres.length) params.with_genres = genres.join("|");
    if (originCountry) params.with_origin_country = originCountry;
    if (leaf.dateFrom) params["first_air_date.gte"] = leaf.dateFrom;
    if (leaf.dateTo) params["first_air_date.lte"] = leaf.dateTo;
    if (keywordId) params.with_keywords = keywordId;
    requests.push({ mediaType: "tv", params });
  }
  return requests;
}

async function loadCategory() {
  if (!state.apiKey) return;
  state.loading = true;
  showStatus("불러오는 중...");
  els.loadMoreBtn.hidden = true;

  const requests = await buildDiscoverRequests(state.mid, state.leaf, state.region, state.page);

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
  renderMajorChips();
  renderMidChips();
  renderLeafChips();
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
