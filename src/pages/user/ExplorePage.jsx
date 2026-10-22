import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  Search,
  X,
  ChevronDown,
  Film,
  RotateCcw,
} from 'lucide-react';
import MovieCard from '@/components/common/MovieCard';
import { movieService } from '@/services/movieService';
import { useMovies } from '../../stores/useMovieStore';
import { defaultExploreStatus, deduplicateSearchMovies, matchesMovieSearch } from '../../utils/movieSearch';

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
  const paramStatus = defaultExploreStatus(paramSearch, rawParamStatus);

  // State
  const [activeTab, setActiveTab] = useState(paramStatus);
  const [searchInput, setSearchInput] = useState(paramSearch);
  const [debouncedSearch, setDebouncedSearch] = useState(paramSearch);

  // Dedicated catalog state to guarantee all 17+ movies are always present
  const [catalog, setCatalog] = useState([]);
  const [isCatalogLoading, setIsCatalogLoading] = useState(false);

  // Pagination / Visible count (15 movies = 3 rows on 5-col desktop)
  const PAGE_CHUNK = 15;
  const [visibleCount, setVisibleCount] = useState(PAGE_CHUNK);

  // 1. Fetch full catalog (size 100) to ensure zero missing movies from pagination
  useEffect(() => {
    let cancelled = false;
    setIsCatalogLoading(true);
    movieService.getAllMovies({ size: 100 })
      .then((res) => {
        if (cancelled) return;
        const raw = Array.isArray(res) ? res : (res?.data?.items ?? res?.items ?? res?.content ?? []);
        if (raw.length > 0) setCatalog(raw);
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

    const validStatus = paramStatus;
    if (validStatus !== activeTab) {
      setActiveTab(validStatus);
    }
  }, [paramSearch, paramStatus]);

  // 3. Debounce search input and update URL while strictly keeping current tab
  useEffect(() => {
    const handler = setTimeout(() => {
      const trimmed = searchInput.trim();
      setDebouncedSearch(trimmed);
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev);
        if (trimmed) {
          next.set('q', trimmed);
        } else {
          next.delete('q');
        }
        if (activeTab) {
          next.set('status', activeTab);
        }
        return next.toString() === prev.toString() ? prev : next;
      }, { replace: true });
    }, 200);

    return () => clearTimeout(handler);
  }, [searchInput, activeTab, setSearchParams]);

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
    return deduplicateSearchMovies(source);
  }, [catalog, moviesList]);

  // ========================================================
  // 5. ACCENT-FREE FUZZY FILTERING LOGIC
  // ========================================================
  const filteredMovies = useMemo(() => {
    let result = [...deduplicatedCatalog];

    // Search Query Filter
    const qRaw = debouncedSearch.trim();
    if (qRaw) {
      result = result.filter((movie) => matchesMovieSearch(movie, qRaw));
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
  }, [deduplicatedCatalog, activeTab, debouncedSearch]);

  // Reset pagination count on tab / search change
  useEffect(() => {
    setVisibleCount(PAGE_CHUNK);
  }, [activeTab, debouncedSearch]);

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
    setVisibleCount(PAGE_CHUNK);
    setSearchParams({}, { replace: true });
  };

  const handleLoadMore = () => {
    setVisibleCount((prev) => Math.min(prev + PAGE_CHUNK, filteredMovies.length));
  };

  return (
    <div className="min-h-screen bg-[#050507] text-white selection:bg-[#F7C600]/30 selection:text-white relative overflow-hidden">
      
      {/* Subtle Ambient Purple Glow */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-[1360px] h-[280px] pointer-events-none z-0">
        <div className="w-full h-full bg-[radial-gradient(circle_at_50%_0%,rgba(138,0,245,0.07)_0%,transparent_70%)]" />
      </div>

      {/* Main Container */}
      <main className="relative z-10 mx-auto max-w-[1360px] px-4 sm:px-6 lg:px-8 pt-5 sm:pt-6 pb-20 space-y-4">

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

          {/* RIGHT: LUXURY COMPACT SEARCH BOX (Strict 90-degree Square Frame) */}
          <div className="pb-2.5 sm:pb-2.5 w-full sm:w-auto">
            <div className="relative w-full sm:w-[220px] md:w-[250px] lg:w-[270px] group">
              <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-neutral-400 group-focus-within:text-[#F7C600] transition-colors" />
              <input
                type="text"
                value={searchInput}
                onChange={(e) => {
                  setSearchInput(e.target.value);
                }}
                placeholder="Tìm phim..."
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
          </div>

        </section>

        {/* ========================================================
            RESULT COUNT HEADER
        ======================================================== */}
        <div className="flex items-center justify-between pt-1">
          <div className="flex items-center gap-2">
            <span className="text-xs sm:text-[13px] font-bold text-neutral-300">
              {debouncedSearch ? (
                <>
                  Kết quả cho <span className="text-[#F7C600]">"{debouncedSearch}"</span>
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
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 sm:gap-5 lg:grid-cols-4 xl:grid-cols-5">
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
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 sm:gap-5 lg:grid-cols-4 xl:grid-cols-5" id="explore-movies-grid">
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
