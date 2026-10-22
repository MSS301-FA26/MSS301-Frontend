import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search,
  X,
  ChevronDown,
  Film,
  RotateCcw,
  User,
  Clapperboard,
  CalendarDays,
  MapPin,
  SlidersHorizontal,
} from 'lucide-react';
import MovieCard from '@/components/common/MovieCard';
import { movieService } from '@/services/movieService';
import { bookingService } from '@/services/bookingService';
import { useMovies } from '../../stores/useMovieStore';
import {
  defaultExploreStatus,
  deduplicateSearchMovies,
  matchesMovieSearch,
  enrichMoviesWithShowtimes,
  getMovieMatchReasons,
  getLocalDateString
} from '../../utils/movieSearch';

const STATUS_TABS = [
  { id: 'now-showing', label: 'ĐANG CHIẾU' },
  { id: 'upcoming', label: 'SẮP CHIẾU' },
  { id: 'all', label: 'TẤT CẢ' },
];

export default function ExplorePage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  // Store bindings
  const {
    moviesList = [],
    isMoviesLoading: isStoreLoading = false,
    searchQuery: storeSearchQuery = '',
    setSearchQuery,
    watchlist = [],
    handleToggleWatchlist,
  } = useMovies();

  // URL query params
  const rawParamStatus = searchParams.get('status');
  const paramSearch = searchParams.get('q') || '';
  const paramDirector = searchParams.get('director') || '';
  const paramActor = searchParams.get('actor') || '';
  const paramDate = searchParams.get('date') || '';
  const paramCinemaId = searchParams.get('cinemaId') || '';
  const paramStatus = defaultExploreStatus(paramSearch || paramDirector || paramActor || paramDate, rawParamStatus);

  // State
  const [activeTab, setActiveTab] = useState(paramStatus);
  const [searchInput, setSearchInput] = useState(paramSearch);
  const [debouncedSearch, setDebouncedSearch] = useState(paramSearch);

  // Dedicated inputs for Actor & Director ("Phần đạo diễn diễn viên tôi cần nhập")
  const [actorInput, setActorInput] = useState(paramActor);
  const [debouncedActor, setDebouncedActor] = useState(paramActor);

  const [directorInput, setDirectorInput] = useState(paramDirector);
  const [debouncedDirector, setDebouncedDirector] = useState(paramDirector);

  // Dedicated selection for Date ("và ngày tôi cần chọn, ngày") & Cinema
  const [dateFilter, setDateFilter] = useState(paramDate);
  const [cinemaFilter, setCinemaFilter] = useState(paramCinemaId);

  // Advanced filter drawer open state
  const hasAdvancedParams = Boolean(paramDirector || paramActor || paramDate || paramCinemaId);
  const [filtersOpen, setFiltersOpen] = useState(hasAdvancedParams);

  // Dedicated catalog, showtimes, and cinemas states
  const [catalog, setCatalog] = useState([]);
  const [showtimes, setShowtimes] = useState([]);
  const [cinemas, setCinemas] = useState([]);
  const [isCatalogLoading, setIsCatalogLoading] = useState(false);

  // Pagination / Visible count (15 movies = 3 rows on 5-col desktop)
  const PAGE_CHUNK = 15;
  const [visibleCount, setVisibleCount] = useState(PAGE_CHUNK);

  // Available dates for quick chip selection
  const availableDates = useMemo(() => {
    const today = new Date();
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(today);
      d.setDate(today.getDate() + i);
      const key = getLocalDateString(d);
      const day = String(d.getDate()).padStart(2, '0');
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const label = i === 0 ? 'Hôm nay' : i === 1 ? 'Ngày mai' : `${day}/${month}`;
      return { key, label, display: `${day}/${month}` };
    });
  }, []);

  // 1. Fetch full catalog (size 100), showtimes, and cinemas in parallel
  useEffect(() => {
    let cancelled = false;
    setIsCatalogLoading(true);
    Promise.all([
      movieService.getAllMovies({ size: 100 }),
      bookingService.getShowtimes({ size: 250 }).catch(() => []),
      movieService.getPublicCinemas().catch(() => [])
    ])
      .then(([movieRes, showtimesRes, cinemasRes]) => {
        if (cancelled) return;
        const rawMovies = Array.isArray(movieRes) ? movieRes : (movieRes?.data?.items ?? movieRes?.items ?? movieRes?.content ?? []);
        if (rawMovies.length > 0) setCatalog(rawMovies);

        const rawShowtimes = Array.isArray(showtimesRes) ? showtimesRes : (showtimesRes?.data?.items ?? showtimesRes?.items ?? showtimesRes?.content ?? showtimesRes?.data ?? []);
        setShowtimes(rawShowtimes);

        const rawCinemas = Array.isArray(cinemasRes) ? cinemasRes : (cinemasRes?.data || []);
        setCinemas(rawCinemas);
      })
      .catch((err) => {
        console.warn('Lỗi tải danh mục phim ExplorePage:', err);
      })
      .finally(() => {
        if (!cancelled) setIsCatalogLoading(false);
      });
    return () => { cancelled = true; };
  }, []);

  // 2. Reactively synchronize from EXTERNAL URL changes (e.g. Header search, browser back/forward)
  useEffect(() => {
    const urlQ = paramSearch;
    if (urlQ !== searchInput) {
      setSearchInput(urlQ);
      setDebouncedSearch(urlQ.trim());
    }
    if (urlQ !== storeSearchQuery) setSearchQuery(urlQ);

    if (paramActor !== actorInput) {
      setActorInput(paramActor);
      setDebouncedActor(paramActor.trim());
    }
    if (paramDirector !== directorInput) {
      setDirectorInput(paramDirector);
      setDebouncedDirector(paramDirector.trim());
    }
    if (paramDate !== dateFilter) {
      setDateFilter(paramDate);
    }
    if (paramCinemaId !== cinemaFilter) {
      setCinemaFilter(paramCinemaId);
    }
    if (paramDirector || paramActor || paramDate || paramCinemaId) {
      setFiltersOpen(true);
    }

    const validStatus = paramStatus;
    if (validStatus !== activeTab) {
      setActiveTab(validStatus);
    }
  }, [paramSearch, paramDirector, paramActor, paramDate, paramCinemaId, paramStatus]);

  // 3. Debounce search inputs and update URL while strictly keeping current tab
  useEffect(() => {
    const handler = setTimeout(() => {
      const trimmedQ = searchInput.trim();
      const trimmedDir = directorInput.trim();
      const trimmedAct = actorInput.trim();

      setDebouncedSearch(trimmedQ);
      setDebouncedDirector(trimmedDir);
      setDebouncedActor(trimmedAct);

      setSearchParams((prev) => {
        const next = new URLSearchParams(prev);
        if (trimmedQ) next.set('q', trimmedQ); else next.delete('q');
        if (trimmedDir) next.set('director', trimmedDir); else next.delete('director');
        if (trimmedAct) next.set('actor', trimmedAct); else next.delete('actor');
        if (dateFilter) next.set('date', dateFilter); else next.delete('date');
        if (cinemaFilter && cinemaFilter !== 'ALL') next.set('cinemaId', cinemaFilter); else next.delete('cinemaId');
        if (activeTab) next.set('status', activeTab);
        return next.toString() === prev.toString() ? prev : next;
      }, { replace: true });
    }, 200);

    return () => clearTimeout(handler);
  }, [searchInput, directorInput, actorInput, dateFilter, cinemaFilter, activeTab, setSearchParams]);

  // Tab change handler: preserves search keyword and updates activeTab
  const handleTabChange = (tabId) => {
    setActiveTab(tabId);
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.set('status', tabId);
      return next;
    }, { replace: true });
  };

  // ========================================================
  // 4. DATA AUDIT & DEDUPLICATION (Ensures zero duplicate movies)
  // ========================================================
  const deduplicatedCatalog = useMemo(() => {
    // Prefer full catalog if available, fallback to moviesList from store
    const source = catalog.length > 0 ? catalog : (Array.isArray(moviesList) ? moviesList : []);
    const deduplicated = deduplicateSearchMovies(source);
    return enrichMoviesWithShowtimes(deduplicated, showtimes, cinemas);
  }, [catalog, moviesList, showtimes, cinemas]);

  // ========================================================
  // 5. MULTI-FIELD MATCHING LOGIC (Actor, Director, Date, Cinema, Title)
  // ========================================================
  const hasAnySearchOrFilter = Boolean(
    debouncedSearch.trim() ||
    debouncedDirector.trim() ||
    debouncedActor.trim() ||
    dateFilter ||
    (cinemaFilter && cinemaFilter !== 'ALL')
  );

  const activeFilterCount = [
    Boolean(debouncedSearch.trim()),
    Boolean(debouncedDirector.trim()),
    Boolean(debouncedActor.trim()),
    Boolean(dateFilter),
    Boolean(cinemaFilter && cinemaFilter !== 'ALL')
  ].filter(Boolean).length;

  const filteredMovies = useMemo(() => {
    let result = [...deduplicatedCatalog];

    if (hasAnySearchOrFilter) {
      result = result
        .map((movie) => {
          const matchData = getMovieMatchReasons(movie, debouncedSearch.trim(), {
            directorQuery: debouncedDirector.trim(),
            actorQuery: debouncedActor.trim(),
            selectedDate: dateFilter,
            selectedCinemaId: cinemaFilter,
          });
          return matchData.matched ? { ...movie, matchReasons: matchData.reasons } : null;
        })
        .filter(Boolean);
    }

    // Status Tab Filter
    // When activeTab is 'all', show all matches.
    // If activeTab is specific ('now-showing', 'upcoming'), filter strictly by that tab:
    if (activeTab === 'now-showing') {
      result = result.filter((m) => m.status === 'NOW_SHOWING' || (!m.isUpcoming && m.status !== 'UPCOMING'));
    } else if (activeTab === 'upcoming') {
      result = result.filter((m) => m.status === 'UPCOMING' || m.isUpcoming || m.status === 'COMING_SOON');
    }

    // Default Sorting: Highest rating first, then newest
    result.sort((a, b) => {
      const rA = Number(a.ratings?.overall ?? a.rating ?? a.voteAverage ?? 0);
      const rB = Number(b.ratings?.overall ?? b.rating ?? b.voteAverage ?? 0);
      if (rB !== rA) return rB - rA;
      const idA = Number(a.backendId || a.id) || 0;
      const idB = Number(b.backendId || b.id) || 0;
      return idB - idA;
    });

    return result;
  }, [deduplicatedCatalog, activeTab, debouncedSearch, debouncedDirector, debouncedActor, dateFilter, cinemaFilter, hasAnySearchOrFilter]);

  // Reset pagination count on tab / search change
  useEffect(() => {
    setVisibleCount(PAGE_CHUNK);
  }, [activeTab, debouncedSearch, debouncedDirector, debouncedActor, dateFilter, cinemaFilter]);

  // Paginated visible slice
  const displayedMovies = useMemo(() => {
    return filteredMovies.slice(0, visibleCount);
  }, [filteredMovies, visibleCount]);

  // Actions
  const onSelectMovie = (id) => navigate(`/movies/${id}`);
  const onBookMovie = (movie) => navigate(`/movies/${movie?.backendId || movie?.movieId || movie?.id}`, { state: { scrollToShowtimes: true } });
  const isMovieWatchlisted = (movie) =>
    watchlist.some(
      (item) => String(item.backendId || item.movieId || item.id) === String(movie.backendId || movie.movieId || movie.id)
    );

  const handleClearAllFilters = () => {
    setActiveTab('now-showing');
    setSearchInput('');
    setDebouncedSearch('');
    setSearchQuery('');
    setActorInput('');
    setDebouncedActor('');
    setDirectorInput('');
    setDebouncedDirector('');
    setDateFilter('');
    setCinemaFilter('');
    setVisibleCount(PAGE_CHUNK);
    setSearchParams({}, { replace: true });
  };

  const handleLoadMore = () => {
    setVisibleCount((prev) => Math.min(prev + PAGE_CHUNK, filteredMovies.length));
  };

  return (
    <div className="min-h-screen bg-[#050507] text-white selection:bg-[#F7C600]/30 selection:text-white relative overflow-hidden">
      
      {/* Subtle Ambient Purple Glow */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-[280px] pointer-events-none z-0">
        <div className="w-full h-full bg-[radial-gradient(circle_at_50%_0%,rgba(138,0,245,0.07)_0%,transparent_70%)]" />
      </div>

      {/* Main Container */}
      <main className="relative z-10 site-container pt-5 sm:pt-6 pb-20 space-y-4">

        {/* Eyebrow */}
        <div className="flex items-center gap-2">
          <span className="h-1.5 w-1.5 rounded-full bg-[#F7C600] animate-pulse" />
          <span className="text-[10px] sm:text-[10.5px] font-mono font-bold tracking-[0.25em] text-[#F7C600] uppercase">
            KHÁM PHÁ
          </span>
        </div>

        {/* ========================================================
            PREMIUM BALANCED NAVIGATION BAR
            LEFT: Tabs [ĐANG CHIẾU] [SẮP CHIẾU] [TẤT CẢ] (Pixel-perfect baseline)
            RIGHT: Sleek Luxury Search Bar [🔍 Tìm phim...]
        ======================================================== */}
        <section className="flex flex-col sm:flex-row sm:items-end justify-between gap-3 sm:gap-6 border-b border-white/[0.08]">
          
          {/* LEFT: TABS (Anchored to bottom border line) */}
          <div className="flex items-center gap-6 sm:gap-8 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden -mb-px">
            {STATUS_TABS.map((tab) => {
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => handleTabChange(tab.id)}
                  className={`relative pb-3 text-xs sm:text-[13.5px] font-bold uppercase tracking-wider transition-all cursor-pointer whitespace-nowrap ${
                    isActive
                      ? 'text-[#F7C600] font-black'
                      : 'text-neutral-400 hover:text-white'
                  }`}
                >
                  <span>{tab.label}</span>
                  {isActive && (
                    <motion.div
                      layoutId="activeMovieTabUnderline"
                      className="absolute bottom-0 left-0 right-0 h-[2.5px] bg-[#F7C600] rounded-none shadow-[0_0_10px_rgba(247,198,0,0.6)]"
                      transition={{ type: 'spring', stiffness: 500, damping: 35 }}
                    />
                  )}
                </button>
              );
            })}
          </div>

          {/* RIGHT: LUXURY COMPACT SEARCH BOX + FILTER BUTTON */}
          <div className="pb-2.5 sm:pb-2.5 w-full sm:w-auto flex items-center gap-2">
            <div className="relative flex-1 sm:w-[260px] md:w-[300px] lg:w-[320px] group">
              <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-neutral-400 group-focus-within:text-[#F7C600] transition-colors" />
              <input
                type="text"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder="Tìm phim (VD: Avengers...)"
                className="h-[34px] w-full rounded-none border border-white/10 bg-[#0C0C12]/90 pl-8.5 pr-8 text-xs text-white placeholder-neutral-500 focus:border-[#F7C600]/80 focus:bg-black focus:outline-none focus:shadow-[0_0_12px_rgba(247,198,0,0.18)] transition-all duration-200"
              />
              {searchInput && (
                <button
                  type="button"
                  onClick={() => {
                    setSearchInput('');
                    setDebouncedSearch('');
                  }}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 text-neutral-400 hover:text-white cursor-pointer"
                  title="Xóa tìm kiếm"
                >
                  <X className="h-3 w-3" />
                </button>
              )}
            </div>

            {/* Toggle Filters Button */}
            <button
              type="button"
              onClick={() => setFiltersOpen((prev) => !prev)}
              className={`h-[34px] flex items-center gap-1.5 px-3 rounded-none border text-xs font-bold transition-all cursor-pointer shrink-0 ${
                filtersOpen || activeFilterCount > 0
                  ? 'border-[#F7C600] bg-[#F7C600]/10 text-[#F7C600]'
                  : 'border-white/10 bg-[#0C0C12]/90 text-neutral-300 hover:border-white/30 hover:text-white'
              }`}
              title="Mở bộ lọc chi tiết (Diễn viên, Đạo diễn, Ngày chiếu, Rạp)"
            >
              <SlidersHorizontal className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Bộ lọc</span>
              {activeFilterCount > 0 && (
                <span className="bg-[#F7C600] text-black font-extrabold text-[10px] px-1.5 py-0.2 leading-none">
                  {activeFilterCount}
                </span>
              )}
              <ChevronDown className={`h-3 w-3 transition-transform duration-200 ${filtersOpen ? 'rotate-180' : ''}`} />
            </button>
          </div>

        </section>

        {/* ========================================================
            EXPANDABLE ADVANCED FILTER PANEL (Actor, Director, Date, Cinema)
        ======================================================== */}
        <AnimatePresence>
          {filtersOpen && (
            <motion.section
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden border border-white/10 bg-[#09090E]/95 shadow-[0_10px_30px_rgba(0,0,0,0.6)]"
            >
              <div className="p-3 sm:p-4 space-y-3">
                {/* 4-Column Inputs Bar */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
                  
                  {/* 1. Diễn viên (Nhập tên) */}
                  <div className="flex items-center gap-2 rounded-none border border-white/10 bg-black/60 px-3 py-1.5 focus-within:border-purple-400 focus-within:bg-black/90 transition-all">
                    <User className="h-4 w-4 text-purple-400 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <span className="block text-[9px] font-mono font-bold tracking-wider uppercase text-purple-300/90">
                        Diễn viên (nhập)
                      </span>
                      <input
                        type="text"
                        value={actorInput}
                        onChange={(e) => setActorInput(e.target.value)}
                        placeholder="VD: Doãn Quốc Đam..."
                        className="w-full bg-transparent text-xs text-white placeholder-neutral-500 outline-none font-medium"
                      />
                    </div>
                    {actorInput && (
                      <button
                        type="button"
                        onClick={() => setActorInput('')}
                        className="p-1 text-neutral-400 hover:text-white"
                        title="Xóa diễn viên"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    )}
                  </div>

                  {/* 2. Đạo diễn (Nhập tên) */}
                  <div className="flex items-center gap-2 rounded-none border border-white/10 bg-black/60 px-3 py-1.5 focus-within:border-amber-400 focus-within:bg-black/90 transition-all">
                    <Clapperboard className="h-4 w-4 text-amber-400 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <span className="block text-[9px] font-mono font-bold tracking-wider uppercase text-amber-300/90">
                        Đạo diễn (nhập)
                      </span>
                      <input
                        type="text"
                        value={directorInput}
                        onChange={(e) => setDirectorInput(e.target.value)}
                        placeholder="VD: Russo Brothers..."
                        className="w-full bg-transparent text-xs text-white placeholder-neutral-500 outline-none font-medium"
                      />
                    </div>
                    {directorInput && (
                      <button
                        type="button"
                        onClick={() => setDirectorInput('')}
                        className="p-1 text-neutral-400 hover:text-white"
                        title="Xóa đạo diễn"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    )}
                  </div>

                  {/* 3. Chọn ngày chiếu (Date Picker & Quick Select) */}
                  <div className="flex items-center gap-2 rounded-none border border-sky-500/30 bg-black/60 px-3 py-1.5 focus-within:border-sky-400 transition-all">
                    <CalendarDays className="h-4 w-4 text-sky-400 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <span className="block text-[9px] font-mono font-bold tracking-wider uppercase text-sky-300/90">
                        Chọn ngày chiếu
                      </span>
                      <input
                        type="date"
                        value={dateFilter}
                        onChange={(e) => setDateFilter(e.target.value)}
                        className="w-full bg-transparent text-xs text-sky-200 outline-none font-semibold [color-scheme:dark] cursor-pointer"
                        title="Bấm để chọn ngày trên lịch"
                      />
                    </div>
                    {dateFilter && (
                      <button
                        type="button"
                        onClick={() => setDateFilter('')}
                        className="p-1 text-neutral-400 hover:text-white"
                        title="Bỏ chọn ngày"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    )}
                  </div>

                  {/* 4. Chọn rạp chiếu */}
                  <div className="flex items-center gap-2 rounded-none border border-emerald-500/30 bg-black/60 px-3 py-1.5 focus-within:border-emerald-400 transition-all">
                    <MapPin className="h-4 w-4 text-emerald-400 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <span className="block text-[9px] font-mono font-bold tracking-wider uppercase text-emerald-300/90">
                        Chọn cụm rạp
                      </span>
                      <select
                        value={cinemaFilter}
                        onChange={(e) => setCinemaFilter(e.target.value)}
                        className="w-full bg-transparent text-xs text-emerald-200 outline-none font-semibold [color-scheme:dark] cursor-pointer"
                      >
                        <option value="" className="bg-neutral-900 text-white">Tất cả cụm rạp</option>
                        {cinemas.map((c) => (
                          <option key={c.id} value={String(c.id)} className="bg-neutral-900 text-white">
                            {c.name.replace('CinePremier ', '')} {c.city ? `(${c.city})` : ''}
                          </option>
                        ))}
                      </select>
                    </div>
                    {cinemaFilter && cinemaFilter !== 'ALL' && (
                      <button
                        type="button"
                        onClick={() => setCinemaFilter('')}
                        className="p-1 text-neutral-400 hover:text-white"
                        title="Bỏ chọn rạp"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    )}
                  </div>

                </div>

                {/* Quick Date Chips Bar */}
                <div className="flex items-center gap-2 overflow-x-auto [scrollbar-width:none] pt-1 border-t border-white/5">
                  <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-neutral-400 shrink-0">
                    Phím tắt ngày:
                  </span>
                  <button
                    type="button"
                    onClick={() => setDateFilter('')}
                    className={`px-2 py-0.5 text-[10.5px] font-semibold rounded-none shrink-0 transition-colors ${
                      !dateFilter
                        ? 'bg-sky-500/20 text-sky-300 border border-sky-500/40'
                        : 'text-neutral-400 hover:text-white border border-transparent'
                    }`}
                  >
                    Tất cả
                  </button>
                  {availableDates.map((d) => (
                    <button
                      key={d.key}
                      type="button"
                      onClick={() => setDateFilter(prev => prev === d.key ? '' : d.key)}
                      className={`px-2.5 py-0.5 text-[10.5px] font-semibold rounded-none shrink-0 transition-all ${
                        dateFilter === d.key
                          ? 'bg-sky-500 text-black font-bold shadow-[0_0_10px_rgba(56,189,248,0.4)]'
                          : 'border border-white/10 bg-white/5 text-neutral-300 hover:border-sky-400/50 hover:text-sky-300'
                      }`}
                    >
                      {d.label}
                    </button>
                  ))}
                </div>

                {/* Active Filters Summary & Reset */}
                {hasAnySearchOrFilter && (
                  <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-white/10 text-xs">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="text-[10px] font-mono uppercase tracking-wider text-neutral-400">Đang lọc:</span>
                      {debouncedSearch && (
                        <span className="inline-flex items-center gap-1 bg-[#F7C600]/15 border border-[#F7C600]/40 text-[#F7C600] px-2 py-0.5 text-[10.5px] font-semibold">
                          <span>Phim: "{debouncedSearch}"</span>
                          <button type="button" onClick={() => setSearchInput('')} className="hover:text-white"><X className="h-2.5 w-2.5" /></button>
                        </span>
                      )}
                      {debouncedActor && (
                        <span className="inline-flex items-center gap-1 bg-purple-500/15 border border-purple-500/40 text-purple-300 px-2 py-0.5 text-[10.5px] font-semibold">
                          <span>Diễn viên: "{debouncedActor}"</span>
                          <button type="button" onClick={() => setActorInput('')} className="hover:text-white"><X className="h-2.5 w-2.5" /></button>
                        </span>
                      )}
                      {debouncedDirector && (
                        <span className="inline-flex items-center gap-1 bg-amber-500/15 border border-amber-500/40 text-amber-300 px-2 py-0.5 text-[10.5px] font-semibold">
                          <span>Đạo diễn: "{debouncedDirector}"</span>
                          <button type="button" onClick={() => setDirectorInput('')} className="hover:text-white"><X className="h-2.5 w-2.5" /></button>
                        </span>
                      )}
                      {dateFilter && (
                        <span className="inline-flex items-center gap-1 bg-sky-500/15 border border-sky-500/40 text-sky-300 px-2 py-0.5 text-[10.5px] font-semibold">
                          <span>Ngày: {dateFilter}</span>
                          <button type="button" onClick={() => setDateFilter('')} className="hover:text-white"><X className="h-2.5 w-2.5" /></button>
                        </span>
                      )}
                      {cinemaFilter && cinemaFilter !== 'ALL' && (
                        <span className="inline-flex items-center gap-1 bg-emerald-500/15 border border-emerald-500/40 text-emerald-300 px-2 py-0.5 text-[10.5px] font-semibold">
                          <span>Rạp: {cinemas.find(c => String(c.id) === String(cinemaFilter))?.name.replace('CinePremier ', '') || cinemaFilter}</span>
                          <button type="button" onClick={() => setCinemaFilter('')} className="hover:text-white"><X className="h-2.5 w-2.5" /></button>
                        </span>
                      )}
                    </div>

                    <button
                      type="button"
                      onClick={handleClearAllFilters}
                      className="flex items-center gap-1 text-[11px] font-bold text-red-400 hover:text-red-300 transition-colors ml-auto"
                    >
                      <RotateCcw className="h-3 w-3" />
                      <span>Xóa tất cả bộ lọc</span>
                    </button>
                  </div>
                )}
              </div>
            </motion.section>
          )}
        </AnimatePresence>

        {/* ========================================================
            RESULT COUNT HEADER
        ======================================================== */}
        <div className="flex items-center justify-between pt-1">
          <div className="flex items-center gap-2">
            <span className="text-xs sm:text-[13px] font-bold text-neutral-300">
              {hasAnySearchOrFilter ? (
                <>
                  Kết quả phù hợp {debouncedSearch && <>cho <span className="text-[#F7C600]">"{debouncedSearch}"</span></>}
                  {activeTab !== 'all' && (
                    <span className="text-neutral-400 font-normal">
                      {' '}trong mục{' '}
                      <strong className="text-white font-bold">
                        {STATUS_TABS.find(t => t.id === activeTab)?.label || ''}
                      </strong>
                    </span>
                  )}
                </>
              ) : (
                <>
                  Phim{' '}
                  <strong className="text-white">
                    {STATUS_TABS.find(t => t.id === activeTab)?.label || 'TẤT CẢ'}
                  </strong>
                </>
              )}{' '}
              <span className="text-neutral-500 font-normal">({filteredMovies.length})</span>
            </span>
          </div>

          {filteredMovies.length > 0 && (
            <span className="text-[11px] font-mono text-neutral-400">
              Hiển thị {Math.min(visibleCount, filteredMovies.length)} / {filteredMovies.length}
            </span>
          )}
        </div>

        {/* ========================================================
            MOVIE GRID (4 COLS DESKTOP, 5 COLS LARGE DESKTOP, 3 COLS TABLET, 2 COLS MOBILE)
        ======================================================== */}
        {isStoreLoading || isCatalogLoading ? (
          /* Skeleton Loading */
          <div className="catalog-grid gap-4 sm:gap-5">
            {Array.from({ length: 10 }).map((_, i) => (
              <div key={i} className="flex flex-col space-y-2 animate-pulse">
                <div className="aspect-[2/3] w-full rounded-none bg-white/[0.04]" />
                <div className="h-3.5 w-3/4 rounded-none bg-white/[0.05]" />
                <div className="h-2.5 w-1/2 rounded-none bg-white/[0.03]" />
              </div>
            ))}
          </div>
        ) : displayedMovies.length > 0 ? (
          /* Actual Movie Cards Grid */
          <div className="catalog-grid gap-4 sm:gap-5" id="explore-movies-grid">
            {displayedMovies.map((movie) => (
              <MovieCard
                key={movie.backendId || movie.id}
                movie={movie}
                onSelect={onSelectMovie}
                onBook={onBookMovie}
                isWatchlisted={isMovieWatchlisted(movie)}
                onToggleWatchlist={handleToggleWatchlist}
              />
            ))}
          </div>
        ) : (
          /* Empty Search State (Strict 90-degree Square Frame) */
          <div className="rounded-none border border-white/10 bg-[#0B0B0E] p-12 text-center my-6">
            <Film className="mx-auto h-10 w-10 text-neutral-600 mb-3" />
            <h3 className="text-base font-bold text-white mb-1">
              Không tìm thấy bộ phim nào phù hợp trong danh mục {STATUS_TABS.find(t => t.id === activeTab)?.label}
            </h3>
            <p className="text-xs text-neutral-400 max-w-sm mx-auto mb-5">
              Thử tìm kiếm với từ khóa khác hoặc chuyển sang xem ở mục Tất Cả.
            </p>
            <div className="flex items-center justify-center gap-3 flex-wrap">
              {activeTab !== 'all' && (
                <button
                  type="button"
                  onClick={() => handleTabChange('all')}
                  className="inline-flex items-center gap-1.5 rounded-none bg-[#F7C600] px-4 py-2 text-xs font-black text-black uppercase tracking-wider hover:bg-[#ffd633] transition-colors cursor-pointer"
                >
                  <Search className="h-3.5 w-3.5" />
                  <span>Tìm trong TẤT CẢ phim</span>
                </button>
              )}
              <button
                type="button"
                onClick={handleClearAllFilters}
                className="inline-flex items-center gap-1.5 rounded-none border border-white/20 bg-white/5 px-4 py-2 text-xs font-bold text-white uppercase tracking-wider hover:bg-white/10 transition-colors cursor-pointer"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                <span>Xóa bộ lọc</span>
              </button>
            </div>
          </div>
        )}

        {/* ========================================================
            LOAD MORE BUTTON (Strict 90-degree Square Frame)
        ======================================================== */}
        {filteredMovies.length > visibleCount && (
          <div className="pt-6 text-center">
            <button
              type="button"
              onClick={handleLoadMore}
              className="inline-flex items-center gap-2 px-6 py-2.5 rounded-none border border-white/20 bg-[#0E0E14] text-xs font-extrabold uppercase tracking-wider text-white hover:border-[#F7C600] hover:text-[#F7C600] hover:bg-[#F7C600]/10 transition-all cursor-pointer shadow-lg active:scale-95"
            >
              <span>XEM THÊM ({filteredMovies.length - visibleCount} PHIM)</span>
              <ChevronDown className="h-3.5 w-3.5" />
            </button>
          </div>
        )}

      </main>

    </div>
  );
}
