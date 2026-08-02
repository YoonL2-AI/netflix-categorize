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
    id: "browse-all", label: "전체 콘텐츠",
    mids: [
      { id: "browse-all-mid", label: "전체 콘텐츠", media: "both", movieGenres: [], tvGenres: [],
        leaves: [{ id: "all", label: "전체" }] },
    ],
  },
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
    id: "mature", label: "성인 등급",
    mids: [
      { id: "mature-all", label: "성인 등급", special: "certification", note: "영화만 · 국가별 청소년 관람불가 등급 기준",
        leaves: [{ id: "all", label: "전체" }] },
    ],
  },
];

// 모달 상세 설명(줄거리/제목/장르명)을 조회할 때 쓸 TMDB 언어 코드 목록.
// TMDB는 이 언어로 로컬라이즈된 title/overview/genre 이름을 응답에 그대로 담아준다.
const LANGUAGES = [
  { code: "ko-KR", label: "한국어" },
  { code: "en-US", label: "English" },
  { code: "ja-JP", label: "日本語" },
  { code: "zh-CN", label: "中文(简体)" },
  { code: "es-ES", label: "Español" },
  { code: "fr-FR", label: "Français" },
  { code: "de-DE", label: "Deutsch" },
  { code: "pt-BR", label: "Português" },
  { code: "vi-VN", label: "Tiếng Việt" },
  { code: "id-ID", label: "Bahasa Indonesia" },
];
const LANG_STORAGE_KEY = "tmdb_language";

// ---------- 카테고리 UI 라벨 다국어 사전 ----------
// TAXONOMY의 label(한국어)은 그대로 기본값으로 쓰고, 여기서는 다른 언어 번역만
// id 기준으로 보관한다. "-all" 중분류(예: action-all)와 대분류 라벨을 그대로
// 재사용하는 중분류(reality-all 등)는 아래에서 자동으로 만들어 붙인다.
const LANG_KEYS = ["en", "ja", "zh", "es", "fr", "de", "pt", "vi", "id"];

const ALL_WORD_I18N = {
  en: "All", ja: "すべて", zh: "全部", es: "Todos", fr: "Tous",
  de: "Alle", pt: "Todos", vi: "Tất cả", id: "Semua",
};

const MAJOR_I18N = {
  action: { en: "Action & Adventure", ja: "アクション&アドベンチャー", zh: "动作与冒险", es: "Acción y aventura", fr: "Action et aventure", de: "Action & Abenteuer", pt: "Ação e aventura", vi: "Hành động & Phiêu lưu", id: "Aksi & Petualangan" },
  comedy: { en: "Comedy", ja: "コメディ", zh: "喜剧", es: "Comedia", fr: "Comédie", de: "Komödie", pt: "Comédia", vi: "Hài kịch", id: "Komedi" },
  drama: { en: "Drama", ja: "ドラマ", zh: "剧情", es: "Drama", fr: "Drame", de: "Drama", pt: "Drama", vi: "Chính kịch", id: "Drama" },
  horror: { en: "Horror", ja: "ホラー", zh: "恐怖", es: "Terror", fr: "Horreur", de: "Horror", pt: "Terror", vi: "Kinh dị", id: "Horor" },
  romance: { en: "Romance", ja: "ロマンス", zh: "爱情", es: "Romance", fr: "Romance", de: "Romantik", pt: "Romance", vi: "Lãng mạn", id: "Romansa" },
  scifi: { en: "Sci-Fi & Fantasy", ja: "SF&ファンタジー", zh: "科幻与奇幻", es: "Ciencia ficción y fantasía", fr: "Science-fiction et fantastique", de: "Sci-Fi & Fantasy", pt: "Ficção científica e fantasia", vi: "Khoa học viễn tưởng & Giả tưởng", id: "Fiksi Ilmiah & Fantasi" },
  thriller: { en: "Thrillers & Mysteries", ja: "スリラー&ミステリー", zh: "惊悚与悬疑", es: "Suspense y misterio", fr: "Thrillers et mystères", de: "Thriller & Mystery", pt: "Suspense e mistério", vi: "Ly kỳ & Bí ẩn", id: "Thriller & Misteri" },
  crime: { en: "Crime", ja: "クライム", zh: "犯罪", es: "Crimen", fr: "Crime", de: "Krimi", pt: "Crime", vi: "Tội phạm", id: "Kriminal" },
  documentary: { en: "Documentaries", ja: "ドキュメンタリー", zh: "纪录片", es: "Documentales", fr: "Documentaires", de: "Dokumentationen", pt: "Documentários", vi: "Phim tài liệu", id: "Dokumenter" },
  animation: { en: "Animation", ja: "アニメーション", zh: "动画", es: "Animación", fr: "Animation", de: "Animation", pt: "Animação", vi: "Hoạt hình", id: "Animasi" },
  family: { en: "Kids & Family", ja: "キッズ&ファミリー", zh: "儿童与家庭", es: "Infantil y familiar", fr: "Enfants et famille", de: "Kinder & Familie", pt: "Infantil e família", vi: "Trẻ em & Gia đình", id: "Anak & Keluarga" },
  kdrama: { en: "Korean Content", ja: "韓国コンテンツ", zh: "韩国内容", es: "Contenido coreano", fr: "Contenu coréen", de: "Koreanische Inhalte", pt: "Conteúdo coreano", vi: "Nội dung Hàn Quốc", id: "Konten Korea" },
  reality: { en: "Reality TV", ja: "リアリティ番組", zh: "真人秀", es: "Telerrealidad", fr: "Télé-réalité", de: "Reality-TV", pt: "Reality shows", vi: "Truyền hình thực tế", id: "Acara Realitas" },
  music: { en: "Music & Musicals", ja: "音楽&ミュージカル", zh: "音乐与歌舞", es: "Música y musicales", fr: "Musique et comédies musicales", de: "Musik & Musicals", pt: "Música e musicais", vi: "Âm nhạc & Nhạc kịch", id: "Musik & Musikal" },
  mature: { en: "Mature Content", ja: "成人向けコンテンツ", zh: "成人内容", es: "Contenido para adultos", fr: "Contenu pour adultes", de: "Inhalte für Erwachsene", pt: "Conteúdo adulto", vi: "Nội dung dành cho người lớn", id: "Konten Dewasa" },
};

// "{major} 전체" 패턴 중분류: id → 어느 대분류에서 파생됐는지
const ALL_MID_DERIVED_FROM = {
  "action-all": "action", "comedy-all": "comedy", "drama-all": "drama", "horror-all": "horror",
  "romance-all": "romance", "scifi-all": "scifi", "thriller-all": "thriller", "crime-all": "crime",
  "doc-all": "documentary", "anim-all": "animation", "family-all": "family",
};
// 대분류 라벨을 그대로 재사용하는 중분류(중분류가 하나뿐이라 "전체" 접미사가 없는 경우)
const REUSE_MAJOR_LABEL_MID = { "reality-all": "reality", "music-all": "music", "mature-all": "mature" };

function allSuffixLabel(majorLabel, langKey) {
  switch (langKey) {
    case "en": return `All ${majorLabel}`;
    case "ja": return `${majorLabel} すべて`;
    case "zh": return `全部${majorLabel}`;
    case "es": return `Todo ${majorLabel}`;
    case "fr": return `Tout ${majorLabel}`;
    case "de": return `Alle ${majorLabel}`;
    case "pt": return `Todo(a) ${majorLabel}`;
    case "vi": return `Tất cả ${majorLabel}`;
    case "id": return `Semua ${majorLabel}`;
    default: return majorLabel;
  }
}

const DISTINCT_MID_I18N = {
  war: { en: "Military & War", ja: "ミリタリー&戦争", zh: "军事与战争", es: "Militar y guerra", fr: "Militaire et guerre", de: "Militär & Krieg", pt: "Militar e guerra", vi: "Quân sự & Chiến tranh", id: "Militer & Perang" },
  "stand-up": { en: "Stand-Up Comedy", ja: "スタンダップコメディ", zh: "单口喜剧", es: "Monólogos de comedia", fr: "One-man-show comique", de: "Stand-Up-Comedy", pt: "Stand-up comedy", vi: "Hài độc thoại", id: "Komedi Tunggal" },
  "psych-horror": { en: "Psychological Horror", ja: "サイコホラー", zh: "心理恐怖", es: "Terror psicológico", fr: "Horreur psychologique", de: "Psychohorror", pt: "Terror psicológico", vi: "Kinh dị tâm lý", id: "Horor Psikologis" },
  "time-travel": { en: "Time Travel & Alternate Realities", ja: "タイムトラベル&パラレルワールド", zh: "时间旅行与平行世界", es: "Viajes en el tiempo y realidades alternativas", fr: "Voyage dans le temps et réalités alternatives", de: "Zeitreise & Parallelwelten", pt: "Viagem no tempo e realidades alternativas", vi: "Du hành thời gian & Thế giới song song", id: "Perjalanan Waktu & Realitas Alternatif" },
  "family-drama": { en: "Family Drama", ja: "ファミリードラマ", zh: "家庭剧", es: "Drama familiar", fr: "Drame familial", de: "Familiendrama", pt: "Drama familiar", vi: "Chính kịch gia đình", id: "Drama Keluarga" },
  anime: { en: "Japanese Anime", ja: "日本のアニメ", zh: "日本动画", es: "Anime japonés", fr: "Anime japonais", de: "Japanischer Anime", pt: "Anime japonês", vi: "Anime Nhật Bản", id: "Anime Jepang" },
  "kr-drama": { en: "Korean Dramas", ja: "韓国ドラマ", zh: "韩剧", es: "Doramas coreanos", fr: "Séries coréennes", de: "Koreanische Dramen", pt: "Doramas coreanos", vi: "Phim truyền hình Hàn Quốc", id: "Drama Korea" },
  "kr-movie": { en: "Korean Movies", ja: "韓国映画", zh: "韩国电影", es: "Películas coreanas", fr: "Films coréens", de: "Koreanische Filme", pt: "Filmes coreanos", vi: "Phim điện ảnh Hàn Quốc", id: "Film Korea" },
  "kr-variety": { en: "Korean Variety Shows", ja: "韓国バラエティ番組", zh: "韩国综艺", es: "Programas de variedades coreanos", fr: "Émissions de variétés coréennes", de: "Koreanische Varietéshows", pt: "Programas de variedades coreanos", vi: "Chương trình giải trí Hàn Quốc", id: "Acara Variety Korea" },
};

const LEAF_I18N = {
  "2020s": { en: "2020s New Releases", ja: "2020年代の新作", zh: "2020年代新作", es: "Estrenos de la década de 2020", fr: "Nouveautés des années 2020", de: "Neuerscheinungen der 2020er", pt: "Lançamentos dos anos 2020", vi: "Phim mới thập niên 2020", id: "Rilisan Baru 2020-an" },
  "adult-anim": { en: "Adult Animation", ja: "大人向けアニメ", zh: "成人动画", es: "Animación para adultos", fr: "Animation pour adultes", de: "Animation für Erwachsene", pt: "Animação adulta", vi: "Hoạt hình người lớn", id: "Animasi Dewasa" },
  classic: { en: "Classics (Before 1999)", ja: "クラシック(1999年以前)", zh: "经典(1999年以前)", es: "Clásicos (antes de 1999)", fr: "Classiques (avant 1999)", de: "Klassiker (vor 1999)", pt: "Clássicos (antes de 1999)", vi: "Kinh điển (trước 1999)", id: "Klasik (Sebelum 1999)" },
  courtroom: { en: "Courtroom Drama", ja: "法廷ドラマ", zh: "法庭剧", es: "Drama judicial", fr: "Drame judiciaire", de: "Gerichtsdrama", pt: "Drama de tribunal", vi: "Phim pháp đình", id: "Drama Pengadilan" },
  "crime-thriller": { en: "Crime Thrillers", ja: "クライムスリラー", zh: "犯罪惊悚", es: "Thriller criminal", fr: "Thriller criminel", de: "Krimi-Thriller", pt: "Suspense criminal", vi: "Ly kỳ tội phạm", id: "Thriller Kriminal" },
  "dark-comedy": { en: "Dark Comedy", ja: "ブラックコメディ", zh: "黑色喜剧", es: "Comedia negra", fr: "Comédie noire", de: "Schwarze Komödie", pt: "Comédia sombria", vi: "Hài đen", id: "Komedi Gelap" },
  detective: { en: "Detective Stories", ja: "刑事ドラマ", zh: "侦探故事", es: "Historias de detectives", fr: "Histoires de détectives", de: "Detektivgeschichten", pt: "Histórias de detetive", vi: "Truyện trinh thám", id: "Cerita Detektif" },
  dystopia: { en: "Dystopian", ja: "ディストピア", zh: "反乌托邦", es: "Distopía", fr: "Dystopie", de: "Dystopie", pt: "Distopia", vi: "Dystopia", id: "Distopia" },
  "family-adventure": { en: "Family Adventure", ja: "ファミリーアドベンチャー", zh: "家庭冒险", es: "Aventura familiar", fr: "Aventure familiale", de: "Familienabenteuer", pt: "Aventura em família", vi: "Phiêu lưu gia đình", id: "Petualangan Keluarga" },
  "family-bond": { en: "Family Bonds", ja: "家族の絆", zh: "家庭羁绊", es: "Lazos familiares", fr: "Liens familiaux", de: "Familienbande", pt: "Laços familiares", vi: "Tình cảm gia đình", id: "Ikatan Keluarga" },
  gangster: { en: "Gangster", ja: "ギャング映画", zh: "黑帮", es: "Gánsteres", fr: "Gangsters", de: "Gangster", pt: "Gângsteres", vi: "Xã hội đen", id: "Gangster" },
  ghost: { en: "Ghosts & Hauntings", ja: "心霊・幽霊", zh: "灵异鬼怪", es: "Fantasmas y casas embrujadas", fr: "Fantômes et hantises", de: "Geister & Spuk", pt: "Fantasmas e assombrações", vi: "Ma quái", id: "Hantu" },
  heist: { en: "Heist", ja: "強盗もの", zh: "劫案", es: "Atracos", fr: "Braquage", de: "Heist", pt: "Assaltos", vi: "Cướp", id: "Perampokan" },
  "kids-anim": { en: "Kids Animation", ja: "キッズアニメ", zh: "儿童动画", es: "Animación infantil", fr: "Animation pour enfants", de: "Kinderanimation", pt: "Animação infantil", vi: "Hoạt hình thiếu nhi", id: "Animasi Anak" },
  "kr-drama-new": { en: "2020s Korean Dramas", ja: "2020年代の韓国ドラマ", zh: "2020年代韩剧", es: "Doramas coreanos de los 2020", fr: "Séries coréennes des années 2020", de: "Koreanische Dramen der 2020er", pt: "Doramas coreanos dos anos 2020", vi: "Phim Hàn thập niên 2020", id: "Drama Korea 2020-an" },
  magic: { en: "Magic & Fantasy", ja: "マジック&ファンタジー", zh: "魔法奇幻", es: "Magia y fantasía", fr: "Magie et fantastique", de: "Magie & Fantasy", pt: "Magia e fantasia", vi: "Phép thuật & Giả tưởng", id: "Sihir & Fantasi" },
  "martial-arts": { en: "Martial Arts", ja: "カンフー・武術", zh: "武侠功夫", es: "Artes marciales", fr: "Arts martiaux", de: "Kampfkunst", pt: "Artes marciais", vi: "Võ thuật", id: "Bela Diri" },
  "music-doc": { en: "Music Documentaries", ja: "音楽ドキュメンタリー", zh: "音乐纪录片", es: "Documentales musicales", fr: "Documentaires musicaux", de: "Musikdokumentationen", pt: "Documentários musicais", vi: "Phim tài liệu âm nhạc", id: "Dokumenter Musik" },
  nature: { en: "Nature Documentaries", ja: "自然ドキュメンタリー", zh: "自然纪录片", es: "Documentales de naturaleza", fr: "Documentaires animaliers", de: "Naturdokumentationen", pt: "Documentários de natureza", vi: "Phim tài liệu thiên nhiên", id: "Dokumenter Alam" },
  parody: { en: "Parody & Spoof", ja: "パロディ", zh: "恶搞喜剧", es: "Parodia", fr: "Parodie", de: "Parodie", pt: "Paródia", vi: "Nhại lại", id: "Parodi" },
  period: { en: "Period Drama", ja: "時代劇", zh: "年代剧", es: "Drama de época", fr: "Drame historique", de: "Historiendrama", pt: "Drama de época", vi: "Phim cổ trang", id: "Drama Periode" },
  "period-romance": { en: "Period Romance", ja: "時代物ロマンス", zh: "年代爱情", es: "Romance de época", fr: "Romance historique", de: "Historienromanze", pt: "Romance de época", vi: "Lãng mạn cổ trang", id: "Romansa Periode" },
  political: { en: "Political Drama", ja: "政治ドラマ", zh: "政治剧", es: "Drama político", fr: "Drame politique", de: "Politdrama", pt: "Drama político", vi: "Chính kịch chính trị", id: "Drama Politik" },
  preschool: { en: "Preschool", ja: "未就学児向け", zh: "学龄前", es: "Preescolar", fr: "Préscolaire", de: "Vorschule", pt: "Pré-escolar", vi: "Mầm non", id: "Prasekolah" },
  "psych-thriller": { en: "Psychological Thriller", ja: "サイコスリラー", zh: "心理惊悚", es: "Thriller psicológico", fr: "Thriller psychologique", de: "Psychothriller", pt: "Suspense psicológico", vi: "Ly kỳ tâm lý", id: "Thriller Psikologis" },
  "rom-com": { en: "Romantic Comedy", ja: "ロマンティックコメディ", zh: "爱情喜剧", es: "Comedia romántica", fr: "Comédie romantique", de: "Liebeskomödie", pt: "Comédia romântica", vi: "Hài lãng mạn", id: "Komedi Romantis" },
  "rom-com2": { en: "Romantic Comedy", ja: "ロマンティックコメディ", zh: "爱情喜剧", es: "Comedia romántica", fr: "Comédie romantique", de: "Liebeskomödie", pt: "Comédia romântica", vi: "Hài lãng mạn", id: "Komedi Romantis" },
  slasher: { en: "Slasher", ja: "スラッシャー", zh: "杀人狂魔", es: "Slasher", fr: "Slasher", de: "Slasher", pt: "Slasher", vi: "Kinh dị giết người", id: "Slasher" },
  space: { en: "Space Sci-Fi", ja: "宇宙SF", zh: "太空科幻", es: "Ciencia ficción espacial", fr: "Science-fiction spatiale", de: "Weltraum-Sci-Fi", pt: "Ficção científica espacial", vi: "Khoa học viễn tưởng không gian", id: "Fiksi Ilmiah Luar Angkasa" },
  "special-forces": { en: "Special Forces", ja: "特殊部隊", zh: "特种部队", es: "Fuerzas especiales", fr: "Forces spéciales", de: "Spezialeinheiten", pt: "Forças especiais", vi: "Lực lượng đặc biệt", id: "Pasukan Khusus" },
  spy: { en: "Spy & Espionage", ja: "スパイ・諜報", zh: "间谍", es: "Espionaje", fr: "Espionnage", de: "Spionage", pt: "Espionagem", vi: "Gián điệp", id: "Mata-mata" },
  superhero: { en: "Superhero", ja: "スーパーヒーロー", zh: "超级英雄", es: "Superhéroes", fr: "Super-héros", de: "Superhelden", pt: "Super-heróis", vi: "Siêu anh hùng", id: "Superhero" },
  "true-crime": { en: "True Crime", ja: "実録犯罪", zh: "真实犯罪", es: "Crímenes reales", fr: "Crimes réels", de: "True Crime", pt: "Crimes reais", vi: "Tội phạm có thật", id: "Kejahatan Nyata" },
  "true-crime-doc": { en: "True Crime Documentaries", ja: "実録犯罪ドキュメンタリー", zh: "真实犯罪纪录片", es: "Documentales de crímenes reales", fr: "Documentaires sur des crimes réels", de: "True-Crime-Dokumentationen", pt: "Documentários de crimes reais", vi: "Phim tài liệu tội phạm có thật", id: "Dokumenter Kejahatan Nyata" },
  "true-story": { en: "Based on a True Story", ja: "実話ベース", zh: "根据真实故事改编", es: "Basado en hechos reales", fr: "Basé sur une histoire vraie", de: "Nach einer wahren Geschichte", pt: "Baseado em fatos reais", vi: "Dựa trên câu chuyện có thật", id: "Berdasarkan Kisah Nyata" },
  zombie: { en: "Zombie", ja: "ゾンビ", zh: "僵尸", es: "Zombis", fr: "Zombies", de: "Zombie", pt: "Zumbis", vi: "Xác sống", id: "Zombie" },
};

const MEDIA_FILTER_I18N = {
  "media-all": { en: "All Content", ja: "すべてのコンテンツ", zh: "全部内容", es: "Todo el contenido", fr: "Tout le contenu", de: "Alle Inhalte", pt: "Todo o conteúdo", vi: "Tất cả nội dung", id: "Semua Konten" },
  "media-movie": { en: "Movies Only", ja: "映画のみ", zh: "仅电影", es: "Solo películas", fr: "Films uniquement", de: "Nur Filme", pt: "Somente filmes", vi: "Chỉ phim điện ảnh", id: "Hanya Film" },
  "media-tv": { en: "Series Only", ja: "シリーズのみ", zh: "仅剧集", es: "Solo series", fr: "Séries uniquement", de: "Nur Serien", pt: "Somente séries", vi: "Chỉ phim bộ", id: "Hanya Serial" },
};

// 최종 사전: id → { en, ja, zh, ... }. "-all"/재사용 중분류는 대분류에서 파생시켜 합친다.
const CATEGORY_I18N = { ...MAJOR_I18N, ...DISTINCT_MID_I18N, ...LEAF_I18N, ...MEDIA_FILTER_I18N };
Object.entries(ALL_MID_DERIVED_FROM).forEach(([midId, majorId]) => {
  CATEGORY_I18N[midId] = {};
  LANG_KEYS.forEach((lk) => {
    CATEGORY_I18N[midId][lk] = allSuffixLabel(MAJOR_I18N[majorId][lk], lk);
  });
});
Object.entries(REUSE_MAJOR_LABEL_MID).forEach(([midId, majorId]) => {
  CATEGORY_I18N[midId] = MAJOR_I18N[majorId];
});
// "전체 콘텐츠" 대분류/중분류는 콘텐츠 유형 필터의 "전체 콘텐츠" 번역을 그대로 재사용한다.
CATEGORY_I18N["browse-all"] = MEDIA_FILTER_I18N["media-all"];
CATEGORY_I18N["browse-all-mid"] = MEDIA_FILTER_I18N["media-all"];

function langKeyOf(languageCode) {
  return languageCode.split("-")[0];
}

// 카테고리 트리 노드(대/중/소분류)의 라벨을 현재 선택된 언어로 번역해 돌려준다.
// 번역이 없으면(한국어 선택 시 포함) 원래 한국어 label로 자연스럽게 폴백된다.
function catLabel(node) {
  const lk = langKeyOf(state.language);
  if (node.id === "all") return ALL_WORD_I18N[lk] || node.label;
  return CATEGORY_I18N[node.id]?.[lk] || node.label;
}

function mediaFilterLabel(id, koreanFallback) {
  const lk = langKeyOf(state.language);
  return MEDIA_FILTER_I18N[id]?.[lk] || koreanFallback;
}

// ---------- 화면 문구(칩/모달/상태 메시지 등) 다국어 사전 ----------
// 카테고리 이름과 별개로, 카드·모달·상태 메시지에 쓰이는 UI 문자열도 Languages를
// 따라가도록 여기 모아둔다. ko 값은 기존 한국어 문구를 그대로 기본값으로 쓴다.
const UI_I18N = {
  movie: { ko: "영화", en: "Movie", ja: "映画", zh: "电影", es: "Película", fr: "Film", de: "Film", pt: "Filme", vi: "Phim điện ảnh", id: "Film" },
  series: { ko: "시리즈", en: "Series", ja: "シリーズ", zh: "剧集", es: "Serie", fr: "Série", de: "Serie", pt: "Série", vi: "Phim bộ", id: "Serial" },
  close: { ko: "닫기", en: "Close", ja: "閉じる", zh: "关闭", es: "Cerrar", fr: "Fermer", de: "Schließen", pt: "Fechar", vi: "Đóng", id: "Tutup" },
  loading: { ko: "불러오는 중...", en: "Loading...", ja: "読み込み中...", zh: "加载中...", es: "Cargando...", fr: "Chargement...", de: "Wird geladen...", pt: "Carregando...", vi: "Đang tải...", id: "Memuat..." },
  searching: { ko: "전체 카테고리에서 검색 중...", en: "Searching across all categories...", ja: "全カテゴリーを検索中...", zh: "正在全部分类中搜索...", es: "Buscando en todas las categorías...", fr: "Recherche dans toutes les catégories...", de: "Suche in allen Kategorien...", pt: "Pesquisando em todas as categorias...", vi: "Đang tìm kiếm trên tất cả danh mục...", id: "Mencari di semua kategori..." },
  loadMore: { ko: "더 보기", en: "Load More", ja: "もっと見る", zh: "加载更多", es: "Cargar más", fr: "Charger plus", de: "Mehr laden", pt: "Carregar mais", vi: "Tải thêm", id: "Muat Lagi" },
  emptyResults: { ko: "조건에 맞는 콘텐츠가 없습니다.", en: "No content matches your filters.", ja: "条件に合うコンテンツがありません。", zh: "没有符合条件的内容。", es: "No hay contenido que coincida con los filtros.", fr: "Aucun contenu ne correspond aux filtres.", de: "Keine Inhalte gefunden, die den Filtern entsprechen.", pt: "Nenhum conteúdo corresponde aos filtros.", vi: "Không có nội dung phù hợp với bộ lọc.", id: "Tidak ada konten yang sesuai dengan filter." },
  searchPlaceholder: { ko: "불러온 목록 내에서 검색...", en: "Search within loaded list...", ja: "読み込み済みリスト内で検索...", zh: "在已加载列表中搜索...", es: "Buscar en la lista cargada...", fr: "Rechercher dans la liste chargée...", de: "In geladener Liste suchen...", pt: "Pesquisar na lista carregada...", vi: "Tìm trong danh sách đã tải...", id: "Cari dalam daftar yang dimuat..." },
  noOverview: { ko: "줄거리 정보가 없습니다.", en: "No synopsis available.", ja: "あらすじ情報がありません。", zh: "暂无简介。", es: "No hay sinopsis disponible.", fr: "Aucun synopsis disponible.", de: "Keine Beschreibung verfügbar.", pt: "Nenhuma sinopse disponível.", vi: "Không có tóm tắt.", id: "Sinopsis tidak tersedia." },
  overviewFallbackNote: { ko: "선택한 언어로 된 줄거리가 없어 영어 원문을 보여드려요.", en: "No synopsis in the selected language, showing the English version.", ja: "選択した言語のあらすじがないため、英語版を表示しています。", zh: "没有所选语言的简介,显示英文版本。", es: "No hay sinopsis en el idioma seleccionado; se muestra la versión en inglés.", fr: "Aucun synopsis dans la langue sélectionnée, affichage de la version anglaise.", de: "Keine Beschreibung in der gewählten Sprache, englische Version wird angezeigt.", pt: "Não há sinopse no idioma selecionado; exibindo a versão em inglês.", vi: "Không có tóm tắt bằng ngôn ngữ đã chọn, hiển thị bản tiếng Anh.", id: "Tidak ada sinopsis dalam bahasa yang dipilih, menampilkan versi bahasa Inggris." },
  noCountryData: { ko: "현재 TMDB 데이터 기준으로 넷플릭스 제공 국가 정보가 없습니다.", en: "No Netflix availability data for this title yet.", ja: "この作品のNetflix配信国データはまだありません。", zh: "暂无该作品的Netflix提供国数据。", es: "Aún no hay datos de disponibilidad en Netflix para este título.", fr: "Aucune donnée de disponibilité Netflix pour ce titre pour l'instant.", de: "Noch keine Netflix-Verfügbarkeitsdaten für diesen Titel.", pt: "Ainda não há dados de disponibilidade na Netflix para este título.", vi: "Chưa có dữ liệu về quốc gia phát hành trên Netflix cho tựa này.", id: "Belum ada data ketersediaan Netflix untuk judul ini." },
  detailLoadFailed: { ko: "상세 정보를 불러오지 못했습니다", en: "Failed to load details", ja: "詳細情報を読み込めませんでした", zh: "无法加载详情", es: "No se pudieron cargar los detalles", fr: "Échec du chargement des détails", de: "Details konnten nicht geladen werden", pt: "Falha ao carregar detalhes", vi: "Không tải được thông tin chi tiết", id: "Gagal memuat detail" },
  listLoadFailed: { ko: "불러오기 실패", en: "Failed to load", ja: "読み込みに失敗しました", zh: "加载失败", es: "Error al cargar", fr: "Échec du chargement", de: "Laden fehlgeschlagen", pt: "Falha ao carregar", vi: "Tải thất bại", id: "Gagal memuat" },
  netflixCountriesLabel: { ko: "넷플릭스 제공 국가", en: "Available on Netflix in", ja: "Netflix配信国", zh: "Netflix提供国", es: "Disponible en Netflix en", fr: "Disponible sur Netflix dans", de: "Auf Netflix verfügbar in", pt: "Disponível na Netflix em", vi: "Có trên Netflix tại", id: "Tersedia di Netflix di" },
};

function ui(key) {
  const lk = langKeyOf(state.language);
  return UI_I18N[key]?.[lk] || UI_I18N[key]?.ko || key;
}

function formatRuntime(minutes) {
  const lk = langKeyOf(state.language);
  switch (lk) {
    case "en": return `${minutes} min`;
    case "ja": return `${minutes}分`;
    case "zh": return `${minutes}分钟`;
    case "es": return `${minutes} min`;
    case "fr": return `${minutes} min`;
    case "de": return `${minutes} Min.`;
    case "pt": return `${minutes} min`;
    case "vi": return `${minutes} phút`;
    case "id": return `${minutes} menit`;
    default: return `${minutes}분`;
  }
}

function formatSeasonsEpisodes(seasons, episodes) {
  const lk = langKeyOf(state.language);
  switch (lk) {
    case "en": return `${seasons} season(s) · ${episodes} episodes`;
    case "ja": return `シーズン${seasons} · 全${episodes}話`;
    case "zh": return `${seasons}季 · 共${episodes}集`;
    case "es": return `${seasons} temporada(s) · ${episodes} episodios`;
    case "fr": return `${seasons} saison(s) · ${episodes} épisodes`;
    case "de": return `${seasons} Staffel(n) · ${episodes} Folgen`;
    case "pt": return `${seasons} temporada(s) · ${episodes} episódios`;
    case "vi": return `${seasons} mùa · ${episodes} tập`;
    case "id": return `${seasons} musim · ${episodes} episode`;
    default: return `시즌 ${seasons}개 · 총 ${episodes}화`;
  }
}

function formatNetflixCountriesTitle(count) {
  const lk = langKeyOf(state.language);
  if (!count) return ui("netflixCountriesLabel");
  switch (lk) {
    case "en": return `${ui("netflixCountriesLabel")} ${count} countries`;
    case "ja": return `${ui("netflixCountriesLabel")} (${count}か国)`;
    case "zh": return `${ui("netflixCountriesLabel")} (${count}个国家/地区)`;
    case "es": return `${ui("netflixCountriesLabel")} ${count} países`;
    case "fr": return `${ui("netflixCountriesLabel")} ${count} pays`;
    case "de": return `${ui("netflixCountriesLabel")} ${count} Ländern`;
    case "pt": return `${ui("netflixCountriesLabel")} ${count} países`;
    case "vi": return `${ui("netflixCountriesLabel")} ${count} quốc gia`;
    case "id": return `${ui("netflixCountriesLabel")} ${count} negara`;
    default: return `${ui("netflixCountriesLabel")} (${count}개국)`;
  }
}

function formatSearchResultCount(n) {
  const lk = langKeyOf(state.language);
  switch (lk) {
    case "en": return `${n} results across all categories`;
    case "ja": return `全カテゴリーから検索結果 ${n}件`;
    case "zh": return `全部分类中的搜索结果 ${n}个`;
    case "es": return `${n} resultados en todas las categorías`;
    case "fr": return `${n} résultats dans toutes les catégories`;
    case "de": return `${n} Ergebnisse in allen Kategorien`;
    case "pt": return `${n} resultados em todas as categorias`;
    case "vi": return `${n} kết quả trên tất cả danh mục`;
    case "id": return `${n} hasil di semua kategori`;
    default: return `전체 카테고리 검색 결과 ${n}개`;
  }
}

function formatTotalOnly(total) {
  const t = total.toLocaleString();
  const lk = langKeyOf(state.language);
  switch (lk) {
    case "en": return `${t} total`;
    case "ja": return `合計${t}件`;
    case "zh": return `共${t}个`;
    case "es": return `${t} en total`;
    case "fr": return `${t} au total`;
    case "de": return `${t} insgesamt`;
    case "pt": return `${t} no total`;
    case "vi": return `Tổng ${t}`;
    case "id": return `Total ${t}`;
    default: return `총 ${t}개`;
  }
}

function formatTotalPartial(total, loaded) {
  const t = total.toLocaleString();
  const l = loaded.toLocaleString();
  const lk = langKeyOf(state.language);
  switch (lk) {
    case "en": return `${t} total · ${l} loaded`;
    case "ja": return `合計${t}件中 ${l}件読み込み済み`;
    case "zh": return `共${t}个 · 已加载${l}个`;
    case "es": return `${t} en total · ${l} cargados`;
    case "fr": return `${t} au total · ${l} chargés`;
    case "de": return `${t} insgesamt · ${l} geladen`;
    case "pt": return `${t} no total · ${l} carregados`;
    case "vi": return `Tổng ${t} · Đã tải ${l}`;
    case "id": return `Total ${t} · Dimuat ${l}`;
    default: return `총 ${t}개 중 ${l}개 불러옴`;
  }
}

function formatMediaMismatch() {
  const lk = langKeyOf(state.language);
  switch (lk) {
    case "en": return "This category doesn't offer the content type you selected (movies/series).";
    case "ja": return "このカテゴリーでは選択したコンテンツタイプ(映画/シリーズ)を提供していません。";
    case "zh": return "该分类不提供您选择的内容类型(电影/剧集)。";
    case "es": return "Esta categoría no ofrece el tipo de contenido seleccionado (películas/series).";
    case "fr": return "Cette catégorie ne propose pas le type de contenu sélectionné (films/séries).";
    case "de": return "Diese Kategorie bietet den ausgewählten Inhaltstyp (Filme/Serien) nicht an.";
    case "pt": return "Esta categoria não oferece o tipo de conteúdo selecionado (filmes/séries).";
    case "vi": return "Danh mục này không cung cấp loại nội dung bạn chọn (phim điện ảnh/phim bộ).";
    case "id": return "Kategori ini tidak menyediakan jenis konten yang Anda pilih (film/serial).";
    default: return "이 카테고리는 선택하신 콘텐츠 유형(영화/시리즈)을 제공하지 않아요.";
  }
}

function formatCertUnsupported(region) {
  const lk = langKeyOf(state.language);
  switch (lk) {
    case "en": return `Rating filters aren't supported in ${region}.`;
    case "ja": return `${region}ではこのカテゴリーの年齢制限フィルターに対応していません。`;
    case "zh": return `${region}不支持该分类的分级筛选。`;
    case "es": return `Los filtros de clasificación no están disponibles en ${region}.`;
    case "fr": return `Les filtres de classification ne sont pas pris en charge en ${region}.`;
    case "de": return `Altersfreigabe-Filter werden in ${region} nicht unterstützt.`;
    case "pt": return `Os filtros de classificação não são compatíveis em ${region}.`;
    case "vi": return `Bộ lọc xếp hạng không được hỗ trợ tại ${region}.`;
    case "id": return `Filter rating tidak didukung di ${region}.`;
    default: return `${region}에서는 이 카테고리의 등급 필터를 지원하지 않아요.`;
  }
}

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
  language: localStorage.getItem(LANG_STORAGE_KEY) || "ko-KR",
  mediaFilter: "all", // "all" | "movie" | "tv"
  major: TAXONOMY[0],
  mid: TAXONOMY[0].mids[0],
  leaf: TAXONOMY[0].mids[0].leaves[0],
  query: "",
  page: 1,
  hasMore: false,
  items: [],
  totalResults: 0,
  loading: false,
  searchResults: [],
  searching: false,
};

const els = {
  regionSelect: document.getElementById("regionSelect"),
  languageSelect: document.getElementById("languageSelect"),
  searchInput: document.getElementById("searchInput"),
  settingsBtn: document.getElementById("settingsBtn"),
  mediaFilter: document.getElementById("mediaFilter"),
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
  apiKeyTransfer: document.getElementById("apiKeyTransfer"),
  apiKeyTransferBtn: document.getElementById("apiKeyTransferBtn"),
  apiKeyTransferStatus: document.getElementById("apiKeyTransferStatus"),
};

const regionDisplayNamesCache = new Map();

function getRegionDisplayNames(langKey) {
  if (regionDisplayNamesCache.has(langKey)) return regionDisplayNamesCache.get(langKey);
  let inst = null;
  try {
    inst = new Intl.DisplayNames([langKey], { type: "region" });
  } catch {
    inst = null;
  }
  regionDisplayNamesCache.set(langKey, inst);
  return inst;
}

// 국가 이름을 현재 선택된 화면 언어(Languages)로 표시한다.
function regionLabel(code, englishFallback) {
  const inst = getRegionDisplayNames(langKeyOf(state.language));
  const localized = inst ? inst.of(code) : null;
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
  els.apiKeyTransfer.hidden = !state.apiKey;
  els.apiKeyTransferStatus.hidden = true;
  els.apiKeyOverlay.hidden = false;
}

// 다른 기기로 키를 옮기기 위한 링크. URL 프래그먼트(#key=...)는 서버로 전송되지
// 않고 브라우저 안에만 남기 때문에, 쿼리스트링으로 넘기는 것보다 안전하다.
els.apiKeyTransferBtn.addEventListener("click", async () => {
  const link = `${location.origin}${location.pathname}#key=${encodeURIComponent(state.apiKey)}`;
  try {
    await navigator.clipboard.writeText(link);
    els.apiKeyTransferStatus.textContent = "링크를 복사했어요. 본인만 보는 곳에 붙여넣어 두세요.";
  } catch {
    window.prompt("아래 링크를 복사하세요:", link);
    els.apiKeyTransferStatus.textContent = "";
  }
  els.apiKeyTransferStatus.hidden = false;
});

// 링크의 #key=... 프래그먼트로 들어온 API 키를 저장하고, 주소창에서 즉시 지운다.
function consumeApiKeyFromUrlFragment() {
  const hash = location.hash;
  if (!hash.startsWith("#key=")) return;
  const key = decodeURIComponent(hash.slice("#key=".length));
  history.replaceState(null, "", location.pathname + location.search);
  if (!key) return;
  state.apiKey = key;
  localStorage.setItem(STORAGE_KEY, key);
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
  state.regions = (data.results || []).map((r) => ({ code: r.iso_3166_1, englishName: r.english_name }));
  renderRegionOptions();
}

// 국가 목록을 다시 조회하지 않고, 현재 Languages 설정에 맞춰 표시 이름만 새로 그린다.
function renderRegionOptions() {
  const lk = langKeyOf(state.language);
  const sorted = [...state.regions].sort((a, b) =>
    regionLabel(a.code, a.englishName).localeCompare(regionLabel(b.code, b.englishName), lk)
  );

  els.regionSelect.innerHTML = "";
  sorted.forEach((r) => {
    const opt = document.createElement("option");
    opt.value = r.code;
    opt.textContent = `${regionLabel(r.code, r.englishName)} (${r.code})`;
    if (r.code === state.region) opt.selected = true;
    els.regionSelect.appendChild(opt);
  });
}

// 검색어가 있으면(전체 카테고리 검색 모드) 검색을 다시 실행하고,
// 없으면 평소처럼 현재 카테고리를 다시 불러온다.
function refreshResults() {
  if (state.query) {
    runSearch(state.query);
  } else {
    state.page = 1;
    loadCategory();
  }
}

els.regionSelect.addEventListener("change", (e) => {
  state.region = e.target.value;
  refreshResults();
});

// ---------- 콘텐츠 유형 필터 (전체 / 영화만 / 시리즈만) ----------

els.mediaFilter.addEventListener("change", (e) => {
  if (e.target.name !== "mediaFilter") return;
  state.mediaFilter = e.target.value;
  refreshResults();
});

function renderMediaFilterLabels() {
  document.getElementById("mediaAllLabel").textContent = mediaFilterLabel("media-all", "전체 콘텐츠");
  document.getElementById("mediaMovieLabel").textContent = mediaFilterLabel("media-movie", "영화만");
  document.getElementById("mediaTvLabel").textContent = mediaFilterLabel("media-tv", "시리즈만");
}

// 정적 마크업에 박혀 있던 한국어 문구(검색창 placeholder, 빈 결과 안내, 더보기 버튼)도
// Languages 설정을 따라가도록 매번 다시 그려준다.
function renderStaticUiText() {
  els.searchInput.placeholder = ui("searchPlaceholder");
  els.emptyMsg.textContent = ui("emptyResults");
  els.loadMoreBtn.textContent = ui("loadMore");
}

// mid가 지원하는 미디어 타입과 사용자가 고른 필터를 합쳐서 실제 조회할 타입을 정한다.
// 둘이 겹치지 않으면(예: 공포 카테고리는 영화만 있는데 "시리즈만" 선택) null을 반환.
function resolveMedia(mid, filter) {
  const midMedia = mid.media || "both";
  if (filter === "all") return midMedia;
  if (midMedia === "both") return filter;
  if (midMedia === filter) return midMedia;
  return null;
}

// ---------- 언어 선택 (제목·상세 설명 번역) ----------

function renderLanguageOptions() {
  els.languageSelect.innerHTML = "";
  LANGUAGES.forEach((lang) => {
    const opt = document.createElement("option");
    opt.value = lang.code;
    opt.textContent = lang.label;
    if (lang.code === state.language) opt.selected = true;
    els.languageSelect.appendChild(opt);
  });
}

els.languageSelect.addEventListener("change", (e) => {
  state.language = e.target.value;
  localStorage.setItem(LANG_STORAGE_KEY, state.language);
  renderRegionOptions();
  renderMajorChips();
  renderMidChips();
  renderLeafChips();
  renderMediaFilterLabels();
  renderStaticUiText();
  render(); // 결과 개수 라벨(총 N개 등)도 즉시 새 언어로 다시 그린다
  refreshResults();
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
    btn.textContent = catLabel(major);
    btn.addEventListener("click", () => {
      clearSearch();
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
    btn.textContent = catLabel(mid);
    btn.title = mid.note || "";
    btn.addEventListener("click", () => {
      clearSearch();
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
    btn.textContent = catLabel(leaf);
    btn.addEventListener("click", () => {
      clearSearch();
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
    language: state.language,
    page,
  };

  if (mid.special === "certification") {
    if (resolveMedia({ media: "movie" }, state.mediaFilter) !== "movie") return [];
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
  const media = resolveMedia(mid, state.mediaFilter);
  if (!media) return [];
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
  showStatus(ui("loading"));
  els.loadMoreBtn.hidden = true;

  const requests = await buildDiscoverRequests(state.mid, state.leaf, state.region, state.page);

  if (!requests.length) {
    state.items = state.page === 1 ? [] : state.items;
    state.hasMore = false;
    state.totalResults = 0;
    const mediaMismatch = resolveMedia(state.mid, state.mediaFilter) === null;
    showStatus(mediaMismatch ? formatMediaMismatch() : formatCertUnsupported(regionLabel(state.region)));
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
    state.totalResults = results.reduce((sum, r) => sum + (r.data.total_results || 0), 0);

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
    showStatus(`${ui("listLoadFailed")}: ${e.message}`);
  }

  state.loading = false;
  render();
}

// ---------- 검색 (특정 카테고리가 아니라 전체 카테고리 대상) ----------
// 카테고리 화면은 장르로 좁힌 discover 결과만 다루지만, 검색창은 TMDB의 실제
// 검색 API(/search/movie, /search/tv)로 카탈로그 전체를 대상으로 찾은 뒤,
// 그중 현재 국가 넷플릭스에 정액제로 올라와 있는 항목만 걸러서 보여준다.
const SEARCH_CANDIDATE_LIMIT = 20; // 미디어 타입별로 확인할 최대 후보 수

let searchToken = 0;

async function runSearch(query) {
  const myToken = ++searchToken;
  state.searching = true;
  showStatus(ui("searching"));
  render();

  const media = resolveMedia({ media: "both" }, state.mediaFilter) || "both";
  const searchCalls = [];
  if (media !== "tv") searchCalls.push(tmdbFetch("/search/movie", { query, language: state.language, page: 1 }).then((d) => ({ mediaType: "movie", data: d })));
  if (media !== "movie") searchCalls.push(tmdbFetch("/search/tv", { query, language: state.language, page: 1 }).then((d) => ({ mediaType: "tv", data: d })));

  try {
    const searchResults = await Promise.all(searchCalls);
    const candidates = searchResults.flatMap(({ mediaType, data }) =>
      (data.results || []).slice(0, SEARCH_CANDIDATE_LIMIT).map((item) => ({ ...item, media_type: mediaType }))
    );

    // 각 후보가 이 국가 넷플릭스에 정액제로 올라와 있는지 병렬로 확인한다.
    const availability = await Promise.all(
      candidates.map((item) =>
        tmdbFetch(`/${item.media_type}/${item.id}/watch/providers`)
          .then((p) => (p.results?.[state.region]?.flatrate || []).some((pr) => pr.provider_id === NETFLIX_PROVIDER_ID))
          .catch(() => false)
      )
    );

    if (myToken !== searchToken) return; // 그 사이 검색어/조건이 또 바뀌었으면 이 결과는 버린다

    state.searchResults = candidates.filter((_, i) => availability[i]);
    showStatus("");
  } catch (e) {
    if (myToken !== searchToken) return;
    if (e.code === "UNAUTHORIZED") {
      openApiKeyModal("키가 만료되었거나 올바르지 않습니다. 다시 입력해주세요.");
    }
    showStatus(`${ui("listLoadFailed")}: ${e.message}`);
    state.searchResults = [];
  }

  if (myToken !== searchToken) return;
  state.searching = false;
  render();
}

let searchDebounceTimer = null;

function scheduleSearch(query) {
  if (searchDebounceTimer) clearTimeout(searchDebounceTimer);
  searchDebounceTimer = setTimeout(() => runSearch(query), 450);
}

// 검색 중이 아닐 때(검색창이 비었을 때) 카테고리 화면으로 되돌리기 위해 호출.
function clearSearch() {
  searchToken++; // 진행 중이던 검색 요청은 무시하도록
  if (searchDebounceTimer) clearTimeout(searchDebounceTimer);
  state.query = "";
  state.searching = false;
  state.searchResults = [];
  els.searchInput.value = "";
}

// ---------- 렌더링 ----------

function getFiltered() {
  return state.query ? state.searchResults : state.items;
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

function resultCountLabel(filteredCount) {
  if (state.query) return formatSearchResultCount(filteredCount);
  if (!state.totalResults) return "";
  if (state.items.length >= state.totalResults) return formatTotalOnly(state.totalResults);
  return formatTotalPartial(state.totalResults, state.items.length);
}

function render() {
  const filtered = getFiltered();
  const busy = state.loading || state.searching;
  els.resultCount.textContent =
    state.query || state.items.length ? (busy && state.query ? "" : resultCountLabel(filtered.length)) : "";
  els.grid.innerHTML = "";
  els.emptyMsg.hidden = busy || filtered.length !== 0;
  els.loadMoreBtn.hidden = state.query !== "" || !state.hasMore;

  filtered.forEach((item) => {
    const title = item.title || item.name || "";
    const year = (item.release_date || item.first_air_date || "").slice(0, 4);
    const rating = typeof item.vote_average === "number" ? item.vote_average.toFixed(1) : "-";
    const typeLabel = item.media_type === "tv" ? ui("series") : ui("movie");

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
  const typeLabel = item.media_type === "tv" ? ui("series") : ui("movie");
  els.modal.innerHTML = `
    <div class="modal-hero" style="background-image:${item.backdrop_path ? `url(${BACKDROP_BASE}${item.backdrop_path})` : "none"}">
      <div class="modal-hero-scrim"></div>
      <span class="modal-hero-title">${escapeHtml(item.title || item.name)}</span>
      <button class="modal-close" id="modalClose" aria-label="${ui("close")}">&times;</button>
    </div>
    <div class="modal-body">
      <div class="meta-row"><span class="badge">${typeLabel}</span><span>${ui("loading")}</span></div>
    </div>
  `;
  els.modalOverlay.hidden = false;
  document.getElementById("modalClose").addEventListener("click", closeModal);

  try {
    const [detail, providers] = await Promise.all([
      tmdbFetch(`/${item.media_type}/${item.id}`, { language: state.language }),
      tmdbFetch(`/${item.media_type}/${item.id}/watch/providers`),
    ]);

    let overview = detail.overview;
    let overviewIsFallback = false;
    if (!overview && state.language !== "en-US") {
      try {
        const fallback = await tmdbFetch(`/${item.media_type}/${item.id}`, { language: "en-US" });
        overview = fallback.overview;
        overviewIsFallback = true;
      } catch {
        // 폴백 실패 시 빈 설명으로 둔다.
      }
    }

    const genres = (detail.genres || []).map((g) => g.name).join(", ") || "-";
    const year = (detail.release_date || detail.first_air_date || "").slice(0, 4) || "-";
    const runtime = detail.runtime
      ? formatRuntime(detail.runtime)
      : detail.number_of_seasons
      ? formatSeasonsEpisodes(detail.number_of_seasons, detail.number_of_episodes)
      : "-";
    const rating = typeof detail.vote_average === "number" ? detail.vote_average.toFixed(1) : "-";

    const netflixCountries = Object.entries(providers.results || {})
      .filter(([, v]) => (v.flatrate || []).some((p) => p.provider_id === NETFLIX_PROVIDER_ID))
      .map(([code]) => code)
      .sort((a, b) => regionLabel(a).localeCompare(regionLabel(b), langKeyOf(state.language)));

    els.modal.innerHTML = `
      <div class="modal-hero" style="background-image:${detail.backdrop_path ? `url(${BACKDROP_BASE}${detail.backdrop_path})` : "none"}">
        <div class="modal-hero-scrim"></div>
        <span class="modal-hero-title">${escapeHtml(detail.title || detail.name)}</span>
        <button class="modal-close" id="modalClose" aria-label="${ui("close")}">&times;</button>
      </div>
      <div class="modal-body">
        <div class="meta-row">
          <span class="badge">${typeLabel}</span>
          <span>${year}</span>
          <span>★ ${rating}</span>
          <span>${runtime}</span>
        </div>
        <p class="modal-genres">${escapeHtml(genres)}</p>
        ${overviewIsFallback ? `<p class="overview-fallback-note">${escapeHtml(ui("overviewFallbackNote"))}</p>` : ""}
        <p class="desc">${escapeHtml(overview) || escapeHtml(ui("noOverview"))}</p>
        <div class="availability">
          <p class="availability-title">${escapeHtml(formatNetflixCountriesTitle(netflixCountries.length))}</p>
          ${
            netflixCountries.length
              ? `<div class="country-chips">${netflixCountries
                  .map(
                    (c) =>
                      `<span class="country-chip${c === state.region ? " current" : ""}">${escapeHtml(regionLabel(c))}</span>`
                  )
                  .join("")}</div>`
              : `<p class="availability-empty">${escapeHtml(ui("noCountryData"))}</p>`
          }
        </div>
      </div>
    `;
    document.getElementById("modalClose").addEventListener("click", closeModal);
  } catch (e) {
    els.modal.querySelector(".modal-body").innerHTML = `<p class="desc">${escapeHtml(ui("detailLoadFailed"))}: ${escapeHtml(e.message)}</p>`;
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
  const value = e.target.value.trim();
  state.query = value;
  searchToken++; // 아직 디바운스 중인 이전 검색이 있다면 결과를 무시하게 한다
  if (searchDebounceTimer) clearTimeout(searchDebounceTimer);
  if (!value) {
    state.searching = false;
    state.searchResults = [];
    showStatus("");
    render();
    return;
  }
  state.searching = true;
  render(); // 검색어가 있다는 것만 즉시 반영(카운트/그리드는 결과 도착 후 갱신)
  scheduleSearch(value);
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
  renderLanguageOptions();
  renderMediaFilterLabels();
  renderStaticUiText();
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

consumeApiKeyFromUrlFragment();
bootstrap();
