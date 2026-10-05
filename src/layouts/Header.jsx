import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Search, MapPin, Ticket, User, Heart, Compass, Home,
  Building2, ChevronDown, Phone, Settings2, X, ExternalLink, LogOut, Popcorn,
  CalendarDays, Coins, ShieldCheck, Menu, Star, Clock, Check, ArrowRight,
  Wallet, Sparkles, Film
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { createPortal } from 'react-dom';
import { movieService } from '../services/movieService';
import { loyaltyService } from '../services/loyaltyService';
import { getStoredAuth } from '../services/authService';
import { useMovieStore } from '../stores/useMovieStore';

const CINEMA_IMAGES_MAP = {
  1: 'https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?auto=format&fit=crop&w=800&q=80',
  2: 'https://images.unsplash.com/photo-1517604931442-7e0c8ed2963c?auto=format&fit=crop&w=800&q=80',
  3: 'https://images.unsplash.com/photo-1595769816263-9b910be24d5f?auto=format&fit=crop&w=800&q=80',
  4: 'https://images.unsplash.com/photo-1585647347483-22b66260dfff?auto=format&fit=crop&w=800&q=80',
  5: 'https://images.unsplash.com/photo-1478720568477-152d9b164e26?auto=format&fit=crop&w=800&q=80'
};

export default function Header({
  activeTab = 'home',
  onTabChange = () => { },
  searchQuery = '',
  onSearchCommit = () => { },
  moviesList = [],
  cinema = null,
  onManageCinema = () => { },
  onOpenWatchlist = () => { },
  onOpenOTP = () => { },
  isLoggedIn = false,
  currentUser = null,
  currentRole = 'user',
  loyaltyRefreshKey = '',
  showToast = () => { },
  handleLogout = () => { },
  navigate = () => { }
}) {
  const [isScrolled, setIsScrolled] = useState(false);
  const [cinemaModalOpen, setCinemaModalOpen] = useState(false);
  const [searchOverlayOpen, setSearchOverlayOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [loyaltyPoints, setLoyaltyPoints] = useState(null);

  const storeSelectedCinema = useMovieStore((state) => state.selectedCinema);
  const setStoreSelectedCinema = useMovieStore((state) => state.setSelectedCinema);

  // Cinema selector state with real cinemas from backend
  const [cinemasList, setCinemasList] = useState([]);
  const [selectedCinema, setSelectedCinema] = useState(() => {
    return storeSelectedCinema || cinema || null;
  });
  const [cinemaSearch, setCinemaSearch] = useState('');
  const [favoriteCinemas, setFavoriteCinemas] = useState(['cinema-1']);

  // Sync with storeSelectedCinema
  useEffect(() => {
    if (storeSelectedCinema && storeSelectedCinema.id) {
      setSelectedCinema(prev => (prev?.id === storeSelectedCinema.id ? prev : storeSelectedCinema));
    }
  }, [storeSelectedCinema]);

  // Fetch real cinemas from API
  useEffect(() => {
    let cancelled = false;
    movieService.getPublicCinemas()
      .then((data) => {
        if (cancelled) return;
        const list = Array.isArray(data) ? data : (data?.data || []);
        if (list.length > 0) {
          const enriched = list.filter(c => !c.status || c.status === 'ACTIVE').map((c) => ({
            id: c.id,
            name: c.name,
            address: c.address || 'Trung tâm thành phố',
            city: c.city || 'TP. Hồ Chí Minh',
            district: c.city || '',
            phone: c.phone || '0901234567',
            image: CINEMA_IMAGES_MAP[c.id] || 'https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?auto=format&fit=crop&w=800&q=80',
            facilities: c.name.includes('Landmark') ? ['IMAX Laser 70mm', 'Dolby Atmos', 'Gold Class'] : ['IMAX Laser', 'Dolby Atmos', 'VIP Lounge']
          }));
          setCinemasList(enriched);
          if (!cinema) setSelectedCinema(enriched[0]);
        }
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [cinema]);

  // Sync cinema prop if provided
  useEffect(() => {
    if (cinema?.name) {
      setSelectedCinema(cinema);
    }
  }, [cinema]);

  // Track window scroll for sticky visual adaptation
  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20);
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Search local state
  const [headerQuery, setHeaderQuery] = useState(searchQuery || '');
  const userMenuRef = useRef(null);

  useEffect(() => {
    setHeaderQuery(searchQuery || '');
  }, [searchQuery]);

  // Close user dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target)) {
        setUserMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Catalog for search suggestions
  const [suggestionCatalog, setSuggestionCatalog] = useState(null);
  useEffect(() => {
    if (!searchOverlayOpen || suggestionCatalog !== null) return;
    let cancelled = false;
    movieService.searchMovies({ size: 100 })
      .then((list) => {
        if (!cancelled) setSuggestionCatalog(Array.isArray(list) ? list : []);
      })
      .catch(() => {
        if (!cancelled) setSuggestionCatalog([]);
      });
    return () => { cancelled = true; };
  }, [searchOverlayOpen, suggestionCatalog]);

  // Combined movie suggestions
  const filteredMovies = useMemo(() => {
    const q = headerQuery.trim().toLowerCase();
    const source = suggestionCatalog?.length ? suggestionCatalog : (moviesList || []);
    if (!q) return source.slice(0, 4);
    return source
      .filter((m) => m && m.status !== 'INACTIVE' && !m.isInactive)
      .filter((m) => (
        (m.title || '').toLowerCase().includes(q)
        || (m.englishTitle || '').toLowerCase().includes(q)
        || (m.director || '').toLowerCase().includes(q)
        || (m.genre || []).some((g) => String(g || '').toLowerCase().includes(q))
      ))
      .slice(0, 5);
  }, [headerQuery, moviesList, suggestionCatalog]);

  const filteredCinemas = useMemo(() => {
    const q = headerQuery.trim().toLowerCase();
    if (!q) return cinemasList.slice(0, 3);
    return cinemasList.filter(c =>
      (c.name || '').toLowerCase().includes(q) ||
      (c.district || '').toLowerCase().includes(q) ||
      (c.city || '').toLowerCase().includes(q)
    );
  }, [headerQuery, cinemasList]);

  const recentSearches = ['Dune 2', 'Mai', 'Oppenheimer', 'IMAX Laser', 'Suất chiếu tối'];

  const handleSelectCinema = (c) => {
    setSelectedCinema(c);
    if (setStoreSelectedCinema) {
      setStoreSelectedCinema(c);
    }
    setCinemaModalOpen(false);
    if (showToast) {
      showToast(`Đã chọn rạp: ${c.name}`, 'success');
    }
    navigate(`/showtimes?cinemaId=${c.id}`);
  };

  const toggleFavoriteCinema = (id, e) => {
    e.stopPropagation();
    setFavoriteCinemas(prev =>
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
    );
  };

  const commitSearch = (queryToUse) => {
    const q = (queryToUse !== undefined ? queryToUse : headerQuery).trim();
    if (!q) return;
    setSearchOverlayOpen(false);
    onSearchCommit(q);
  };

  const handleSuggestionClick = (movie) => {
    setSearchOverlayOpen(false);
    setHeaderQuery('');
    navigate(`/movies/${movie.backendId || movie.id}`);
  };

  // Roles & permissions
  const isAdminRole = currentRole === 'admin' || currentUser?.role === 'admin';
  const isManagerRole = currentRole === 'manager' || currentUser?.role === 'manager';
  const isStaffRole = currentRole === 'staff' || currentUser?.role === 'staff';
  const canUseWishlist = !isAdminRole && !isManagerRole && !isStaffRole;
  const canShowLoyalty = isLoggedIn && !isAdminRole && !isManagerRole && !isStaffRole;

  useEffect(() => {
    if (!canShowLoyalty) {
      setLoyaltyPoints(null);
      return;
    }
    let cancelled = false;
    const loadLoyalty = async () => {
      const { accessToken } = getStoredAuth();
      if (!accessToken) return;
      try {
        const loyalty = await loyaltyService.getMyLoyalty(accessToken);
        if (!cancelled) setLoyaltyPoints(Number(loyalty?.points ?? 2450));
      } catch {
        if (!cancelled) setLoyaltyPoints(2450);
      }
    };
    loadLoyalty();
  }, [canShowLoyalty, currentUser?.id, loyaltyRefreshKey]);

  return (
    <header
      className={`sticky top-0 z-[100] w-full transition-all duration-200 ${
        isScrolled
          ? 'bg-[#050507]/95 shadow-[0_8px_25px_rgba(0,0,0,0.85)] backdrop-blur-md'
          : 'bg-[#050506]'
      }`}
    >
      {/* ========================================================
          HEADER TẦNG 1 (Compact Desktop: 66px, Target 64–68px)
          Brand DNA: Logo trái, Nút Đặt vé Vàng, Nút Bắp Nước Tím,
          Search input sang trọng gọn gàng, Cinema Selector, Login
      ======================================================== */}
      <div className="relative border-b border-white/[0.06]">
        <div className="mx-auto flex h-[66px] w-full max-w-[1400px] items-center justify-between gap-3 px-4 sm:px-6 lg:px-8">

          {/* LEFT: LOGO CINEPREMIER STUDIOS + COMPACT ACTION BUTTONS */}
          <div className="flex items-center gap-4 lg:gap-5 min-w-0">
            {/* Logo: Giảm 10% kích thước */}
            <div
              onClick={() => onTabChange(isStaffRole ? 'staff' : isManagerRole ? 'manager' : 'home')}
              className="flex cursor-pointer items-center space-x-2.5 group select-none shrink-0"
              id="header-logo"
            >
              {/* Icon C compact 36x36px */}
              <div className="relative h-9 w-9 flex items-center justify-center bg-zinc-950 border border-white/20 rounded-none overflow-hidden shadow-[inset_0_0_10px_rgba(247,198,0,0.08)] group-hover:border-[#F7C600]/70 group-hover:shadow-[0_0_16px_rgba(247,198,0,0.25)] transition-all duration-200">
                <span className="absolute top-0.5 left-0.5 h-1 w-1 border-t border-l border-white/40 group-hover:border-[#F7C600] transition-colors" />
                <span className="absolute top-0.5 right-0.5 h-1 w-1 border-t border-r border-white/40 group-hover:border-[#F7C600] transition-colors" />
                <span className="absolute bottom-0.5 left-0.5 h-1 w-1 border-b border-l border-white/40 group-hover:border-[#F7C600] transition-colors" />
                <span className="absolute bottom-0.5 right-0.5 h-1 w-1 border-b border-r border-white/40 group-hover:border-[#F7C600] transition-colors" />

                <span className="relative font-serif text-lg italic font-black text-transparent bg-clip-text bg-gradient-to-b from-white via-amber-200 to-[#F7C600]">
                  C
                </span>
              </div>

              {/* Brand Typography gọn hơn */}
              <div className="flex flex-col justify-center">
                <span className="font-sans font-black tracking-[0.22em] text-xs sm:text-[13px] text-white uppercase leading-none">
                  CINE<span className="text-[#F7C600]">PREMIER</span>
                </span>
                <span className="text-[7px] font-mono tracking-[0.4em] text-neutral-400 uppercase mt-0.5 leading-none">
                  STUDIOS
                </span>
              </div>
            </div>

            {/* Staff / Manager Mode Indicator */}
            {isStaffRole && (
              <div className="flex items-center gap-1.5 border border-emerald-500/40 bg-emerald-500/10 px-2.5 py-1 rounded-none text-emerald-300 text-[9px] font-sans font-bold uppercase tracking-wider">
                <span className="h-1.5 w-1.5 rounded-none bg-emerald-400 animate-pulse" />
                <ShieldCheck className="h-3 w-3" />
                <span>STAFF</span>
              </div>
            )}

            {/* TICKET SHAPED BUTTON (MUA VÉ) - Chuẩn hình ticket khuyết 2 đầu tròn, đường nét đứt, không khung */}
            {!isStaffRole && !isManagerRole && (
              <button
<<<<<<< HEAD
                onClick={() => { window.scrollTo({ top: 0, behavior: 'instant' }); navigate('/showtimes'); }}
                className="group relative hidden lg:inline-flex items-center justify-center p-0 bg-transparent border-0 outline-none cursor-pointer transition-transform duration-200 hover:scale-105 active:scale-95 select-none"
=======
                onClick={() => onTabChange('showtimes')}
                className="hidden lg:flex h-9 items-center gap-1.5 bg-yellow-500 hover:bg-yellow-600 px-3.5 text-[10px] font-sans font-extrabold uppercase tracking-[0.12em] text-black transition whitespace-nowrap rounded"
>>>>>>> 994357b939ca99abf48e6008d0d9cb6c51892055
                id="btn-book-now"
                title="Mua vé xem phim"
              >
                <svg
                  width="118"
                  height="34"
                  viewBox="0 0 118 34"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                  className="transition-all duration-200 filter drop-shadow-[0_2px_8px_rgba(247,198,0,0.3)] group-hover:drop-shadow-[0_4px_16px_rgba(247,198,0,0.65)]"
                >
                  <defs>
                    <linearGradient id="ticketGoldGrad" x1="0" y1="0" x2="118" y2="34" gradientUnits="userSpaceOnUse">
                      <stop offset="0%" stopColor="#FFDE43" />
                      <stop offset="50%" stopColor="#F7C600" />
                      <stop offset="100%" stopColor="#E5A800" />
                    </linearGradient>
                  </defs>

                  {/* Thân vé chuẩn khuyết 2 đầu tròn bán nguyệt */}
                  <path
                    d="M 4 0 H 114 A 4 4 0 0 1 118 4 V 12 A 5 5 0 0 0 118 22 V 30 A 4 4 0 0 1 114 34 H 4 A 4 4 0 0 1 0 30 V 22 A 5 5 0 0 0 0 12 V 4 A 4 4 0 0 1 4 0 Z"
                    fill="url(#ticketGoldGrad)"
                  />

                  {/* Đường xé vé rãnh nét đứt bên phải */}
                  <line
                    x1="96"
                    y1="3"
                    x2="96"
                    y2="31"
                    stroke="#101010"
                    strokeWidth="1.2"
                    strokeDasharray="2.5 2"
                    strokeOpacity="0.4"
                  />

                  {/* Ngôi sao đặc trưng */}
                  <path
                    d="M 21 11.5 L 22.4 15.6 L 26.8 15.6 L 23.3 18.2 L 24.6 22.4 L 21 19.8 L 17.4 22.4 L 18.7 18.2 L 15.2 15.6 L 19.6 15.6 Z"
                    fill="#101010"
                  />

                  {/* Chữ Mua Vé */}
                  <text
                    x="31"
                    y="21.5"
                    fontFamily="system-ui, -apple-system, sans-serif"
                    fontSize="12"
                    fontWeight="900"
                    fill="#101010"
                    letterSpacing="0.4"
                  >
                    MUA VÉ
                  </text>
                </svg>
              </button>
            )}

            {/* POPCORN SHAPED BUTTON (BẮP NƯỚC) - Chuẩn hình hộp bắp nổ Cinema, không khung */}
            {!isStaffRole && !isManagerRole && (
              <button
                onClick={() => onTabChange('concessions')}
                className="group relative hidden lg:inline-flex items-center justify-center p-0 bg-transparent border-0 outline-none cursor-pointer transition-transform duration-200 hover:scale-105 active:scale-95 select-none"
                id="btn-order-food"
                title="Đặt bắp rang bơ & nước uống"
              >
                <svg
                  width="118"
                  height="34"
                  viewBox="0 0 118 34"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                  className="transition-all duration-200 filter drop-shadow-[0_2px_8px_rgba(138,0,245,0.3)] group-hover:drop-shadow-[0_4px_16px_rgba(138,0,245,0.65)]"
                >
                  <defs>
                    <linearGradient id="popcornTubGrad" x1="0" y1="8" x2="118" y2="34" gradientUnits="userSpaceOnUse">
                      <stop offset="0%" stopColor="#A42EFF" />
                      <stop offset="50%" stopColor="#8A00F5" />
                      <stop offset="100%" stopColor="#6E00C8" />
                    </linearGradient>
                    <linearGradient id="popcornKernelGrad" x1="0" y1="0" x2="118" y2="10" gradientUnits="userSpaceOnUse">
                      <stop offset="0%" stopColor="#FFF2A3" />
                      <stop offset="50%" stopColor="#FFDE43" />
                      <stop offset="100%" stopColor="#F7C600" />
                    </linearGradient>
                  </defs>

                  {/* Hạt bắp vàng bồng bềnh nổ tràn miệng hộp */}
                  <path
                    d="M 8 9 C 8 4, 15 1, 20 4 C 25 0, 34 0, 39 4 C 44 0, 54 0, 59 4 C 64 0, 74 0, 79 4 C 84 0, 93 0, 98 4 C 103 1, 110 4, 110 9 Z"
                    fill="url(#popcornKernelGrad)"
                  />
                  <circle cx="20" cy="5" r="3.5" fill="#FFE566" opacity="0.85" />
                  <circle cx="39" cy="4" r="4" fill="#FFF099" opacity="0.95" />
                  <circle cx="59" cy="3.5" r="4.2" fill="#FFE566" opacity="0.85" />
                  <circle cx="79" cy="4" r="4" fill="#FFF099" opacity="0.95" />
                  <circle cx="98" cy="5" r="3.5" fill="#FFE566" opacity="0.85" />

                  {/* Viền miệng hộp bắp vàng Gold */}
                  <rect x="5" y="8" width="108" height="2.5" rx="1.2" fill="#F7C600" />

                  {/* Thân hộp bắp màu Tím Cinema */}
                  <path
                    d="M 6 10.5 H 112 L 104 31 A 4 4 0 0 1 100 34 H 18 A 4 4 0 0 1 14 31 L 6 10.5 Z"
                    fill="url(#popcornTubGrad)"
                  />

                  {/* Sọc trang trí hộp bắp mờ */}
                  <path d="M 32 10.5 L 36 34 M 50 10.5 L 51 34 M 68 10.5 L 67 34 M 86 10.5 L 82 34" stroke="white" strokeWidth="1" strokeOpacity="0.1" />

                  {/* Ngôi sao vàng trên thân hộp */}
                  <path
                    d="M 23 18 L 24.2 21.2 L 27.6 21.2 L 24.8 23.2 L 25.9 26.5 L 23 24.5 L 20.1 26.5 L 21.2 23.2 L 18.4 21.2 L 21.8 21.2 Z"
                    fill="#F7C600"
                  />

                  {/* Chữ BẮP NƯỚC */}
                  <text
                    x="33"
                    y="24.5"
                    fontFamily="system-ui, -apple-system, sans-serif"
                    fontSize="11.5"
                    fontWeight="900"
                    fill="#FFFFFF"
                    letterSpacing="0.4"
                  >
                    BẮP NƯỚC
                  </text>
                </svg>
              </button>
            )}
          </div>

          {/* CENTER / RIGHT: SEARCH, CINEMA SELECTOR, LOGIN */}
          <div className="flex items-center gap-2 sm:gap-2.5 min-w-0">

            {/* SEARCH INPUT BAR: Height 44px, Width 220–250px */}
            {!isStaffRole && !isManagerRole && (
              <div
                onClick={() => setSearchOverlayOpen(true)}
                className="hidden md:flex h-[44px] w-[210px] xl:w-[245px] items-center gap-2 rounded-none border border-white/10 bg-[#09090C] px-3 text-neutral-400 cursor-pointer transition-all duration-150 hover:border-white/20 hover:text-white"
                id="search-box-trigger"
                title="Bấm để tìm phim, diễn viên..."
              >
                <Search className="h-3.5 w-3.5 text-neutral-400 shrink-0" />
                <span className="text-[12.5px] text-neutral-400 font-medium truncate select-none">
                  {headerQuery ? headerQuery : 'Tìm phim, diễn viên...'}
                </span>
              </div>
            )}

            {/* Mobile Search Icon button */}
            {!isStaffRole && !isManagerRole && (
              <button
                onClick={() => setSearchOverlayOpen(true)}
                className="flex md:hidden h-[42px] w-[42px] items-center justify-center rounded-none border border-white/10 bg-[#09090C] text-neutral-300 hover:text-white"
                aria-label="Tìm kiếm"
              >
                <Search className="h-4 w-4" />
              </button>
            )}

            {/* LOGIN BUTTON: Height 44px, Padding 16-18px */}
            {!isStaffRole && (
              <div className="relative" ref={userMenuRef}>
                {!isLoggedIn ? (
                  <button
                    onClick={onOpenOTP}
                    className="flex h-[44px] items-center gap-1.5 rounded-none border border-white/20 bg-transparent px-3.5 sm:px-4 text-[12.5px] font-bold uppercase tracking-[0.1em] text-white transition-all duration-150 hover:border-white/40 hover:bg-white/5 active:scale-98 whitespace-nowrap shadow-sm"
                    id="signin-button"
                  >
                    <User className="h-4 w-4 text-neutral-300 stroke-[2]" />
                    <span>ĐĂNG NHẬP</span>
                  </button>
                ) : (
                  <button
                    onClick={() => setUserMenuOpen(!userMenuOpen)}
                    className="flex h-[44px] items-center gap-2 rounded-none border border-amber-500/30 bg-amber-500/10 px-3 text-xs font-bold text-amber-300 transition-all duration-150 hover:border-amber-400 hover:bg-amber-500/20"
                    id="user-profile-button"
                  >
                    <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-none bg-gradient-to-br from-[#F7C600] to-amber-600 text-black font-black text-[11px]">
                      {(currentUser?.name || 'U').charAt(0).toUpperCase()}
                    </div>
                    <div className="text-left hidden sm:block min-w-0">
                      <span className="block max-w-[90px] truncate text-[11.5px] font-bold text-white leading-tight">
                        {currentUser?.name || 'Khách hàng'}
                      </span>
                      <span className="flex items-center gap-1 text-[8px] font-bold text-[#F7C600] tracking-wider leading-none mt-0.5">
                        <Coins className="h-2 w-2" />
                        {loyaltyPoints !== null ? `${loyaltyPoints.toLocaleString('vi-VN')} P` : 'POINTS'}
                      </span>
                    </div>
                    <ChevronDown className={`h-3 w-3 text-amber-300 transition-transform ${userMenuOpen ? 'rotate-180' : ''}`} />
                  </button>
                )}

                {/* Dropdown Menu */}
                <AnimatePresence>
                  {isLoggedIn && userMenuOpen && (
                    <motion.div
                      initial={{ opacity: 0, y: 8, scale: 0.96 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 6, scale: 0.96 }}
                      transition={{ duration: 0.15 }}
                      className="absolute right-0 top-full mt-1.5 w-60 rounded-none border border-white/15 bg-[#0b0b0f] p-2 shadow-[0_16px_50px_rgba(0,0,0,0.85)] z-[250]"
                    >
                      <div className="border-b border-white/10 px-3 py-2 mb-1">
                        <span className="text-[9px] font-extrabold uppercase tracking-widest text-[#F7C600] bg-[#F7C600]/10 border border-[#F7C600]/25 px-1.5 py-0.5 rounded-none">
                          VIP DIAMOND
                        </span>
                        <p className="mt-1 text-xs font-bold text-white truncate">{currentUser?.name}</p>
                        <p className="text-[10px] text-neutral-400 truncate">{currentUser?.email || currentUser?.phone || 'Thành viên CinePremier'}</p>
                      </div>

                      <div className="space-y-0.5 text-xs font-medium">
                        <button
                          onClick={() => { setUserMenuOpen(false); onTabChange('profile'); }}
                          className="flex w-full items-center gap-2 rounded-none px-2.5 py-1.5 text-neutral-300 hover:bg-white/10 hover:text-white"
                        >
                          <User className="h-3.5 w-3.5 text-[#F7C600]" />
                          <span>Tài khoản cá nhân</span>
                        </button>
                        <button
                          onClick={() => { setUserMenuOpen(false); onTabChange('my-tickets'); }}
                          className="flex w-full items-center gap-2 rounded-none px-2.5 py-1.5 text-neutral-300 hover:bg-white/10 hover:text-white"
                        >
                          <Ticket className="h-3.5 w-3.5 text-[#F7C600]" />
                          <span>Vé của tôi</span>
                        </button>
                        <button
                          onClick={() => { setUserMenuOpen(false); onTabChange('wishlist'); }}
                          className="flex w-full items-center gap-2 rounded-none px-2.5 py-1.5 text-neutral-300 hover:bg-white/10 hover:text-white"
                        >
                          <Heart className="h-3.5 w-3.5 text-rose-400" />
                          <span>Watchlist yêu thích</span>
                        </button>
                        <button
                          onClick={() => { setUserMenuOpen(false); onTabChange('profile'); }}
                          className="flex w-full items-center gap-2 rounded-none px-2.5 py-1.5 text-neutral-300 hover:bg-white/10 hover:text-white"
                        >
                          <Coins className="h-3.5 w-3.5 text-amber-400" />
                          <span>Điểm thưởng</span>
                        </button>
                      </div>

                      <div className="border-t border-white/10 mt-1 pt-1">
                        <button
                          onClick={() => {
                            setUserMenuOpen(false);
                            handleLogout({ navigate, showToast });
                          }}
                          className="flex w-full items-center gap-2 rounded-none px-2.5 py-1.5 text-rose-400 hover:bg-rose-500/10 text-xs font-bold"
                        >
                          <LogOut className="h-3.5 w-3.5" />
                          <span>Đăng xuất</span>
                        </button>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            )}

            {/* Mobile Hamburger Menu button */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="flex lg:hidden h-[42px] w-[42px] items-center justify-center rounded-none border border-white/10 bg-[#09090C] text-neutral-300 hover:text-white ml-0.5"
              aria-label="Menu"
            >
              <Menu className="h-4.5 w-4.5" />
            </button>
          </div>
        </div>
      </div>

      {/* ========================================================
          HEADER TẦNG 2 (Compact Desktop: 46px, Target 44–48px)
          Tổng 2 tầng = 66px + 46px = 112px (Chuẩn 108–116px!)
          Font: 12.5px SemiBold, Gap: 32–36px, Icon: 15px.
      ======================================================== */}
      {!isStaffRole && (
        <div className="relative border-b border-white/[0.06] bg-[#050506]">
          <div className="mx-auto flex h-[46px] w-full max-w-[1400px] items-center justify-center px-4 sm:px-6 lg:px-8">
            <nav
              className="flex min-w-0 max-w-full items-center justify-center gap-6 sm:gap-8 md:gap-9 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
              id="main-nav-bar"
            >
              {/* TRANG CHỦ */}
              <button
                onClick={() => onTabChange('home')}
                className={`group relative flex h-[46px] items-center gap-1.5 text-[12.5px] font-sans font-semibold uppercase tracking-[0.12em] transition-colors whitespace-nowrap ${
                  activeTab === 'home'
                    ? 'text-white font-bold'
                    : 'text-[#A4A4AC] hover:text-white'
                }`}
                id="nav-home"
              >
                <Home className={`h-3.5 w-3.5 transition-colors ${
                  activeTab === 'home' ? 'text-[#F7C600]' : 'text-neutral-400 group-hover:text-[#F7C600]'
                }`} />
                <span>TRANG CHỦ</span>
                {activeTab === 'home' && (
                  <motion.div
                    layoutId="activeNavUnderline"
                    className="absolute bottom-0 left-0 right-0 h-[2px] bg-[#F7C600] shadow-[0_0_10px_rgba(247,198,0,0.8)]"
                    transition={{ type: "spring", stiffness: 380, damping: 30 }}
                  />
                )}
              </button>

              {/* KHÁM PHÁ */}
              <button
                onClick={() => onTabChange('explore')}
                className={`group relative flex h-[46px] items-center gap-1.5 text-[12.5px] font-sans font-semibold uppercase tracking-[0.12em] transition-colors whitespace-nowrap ${
                  activeTab === 'explore'
                    ? 'text-white font-bold'
                    : 'text-[#A4A4AC] hover:text-white'
                }`}
                id="nav-explore"
              >
                <Compass className={`h-3.5 w-3.5 transition-colors ${
                  activeTab === 'explore' ? 'text-[#F7C600]' : 'text-neutral-400 group-hover:text-[#F7C600]'
                }`} />
                <span>KHÁM PHÁ</span>
                {activeTab === 'explore' && (
                  <motion.div
                    layoutId="activeNavUnderline"
                    className="absolute bottom-0 left-0 right-0 h-[2px] bg-[#F7C600] shadow-[0_0_10px_rgba(247,198,0,0.8)]"
                    transition={{ type: "spring", stiffness: 380, damping: 30 }}
                  />
                )}
              </button>

              {/* LỊCH CHIẾU & MUA VÉ */}
              <button
                onClick={() => onTabChange('showtimes')}
                className={`group relative flex h-[46px] items-center gap-1.5 text-[12.5px] font-sans font-semibold uppercase tracking-[0.12em] transition-colors whitespace-nowrap ${
                  activeTab === 'showtimes'
                    ? 'text-white font-bold'
                    : 'text-[#A4A4AC] hover:text-white'
                }`}
                id="nav-showtimes"
              >
<<<<<<< HEAD
                <CalendarDays className={`h-3.5 w-3.5 transition-colors ${
                  activeTab === 'showtimes' ? 'text-[#F7C600]' : 'text-neutral-400 group-hover:text-[#F7C600]'
                }`} />
                <span>LỊCH CHIẾU & MUA VÉ</span>
                {activeTab === 'showtimes' && (
                  <motion.div
                    layoutId="activeNavUnderline"
                    className="absolute bottom-0 left-0 right-0 h-[2px] bg-[#F7C600] shadow-[0_0_10px_rgba(247,198,0,0.8)]"
                    transition={{ type: "spring", stiffness: 380, damping: 30 }}
                  />
                )}
=======
                <CalendarDays className="h-3.5 w-3.5 text-amber-400" />
                <span>LỊCH CHIẾU & MUA VÉ</span>
>>>>>>> 994357b939ca99abf48e6008d0d9cb6c51892055
              </button>

              {/* ĐƠN CỦA TÔI */}
              {!isAdminRole && (
                <button
                  onClick={() => onTabChange('my-tickets')}
                  className={`group relative flex h-[46px] items-center gap-1.5 text-[12.5px] font-sans font-semibold uppercase tracking-[0.12em] transition-colors whitespace-nowrap ${
                    activeTab === 'my-tickets'
                      ? 'text-white font-bold'
                      : 'text-[#A4A4AC] hover:text-white'
                  }`}
                  id="nav-my-bookings"
                >
                  <Ticket className={`h-3.5 w-3.5 transition-colors ${
                    activeTab === 'my-tickets' ? 'text-[#F7C600]' : 'text-neutral-400 group-hover:text-[#F7C600]'
                  }`} />
                  <span>ĐƠN CỦA TÔI</span>
                  {activeTab === 'my-tickets' && (
                    <motion.div
                      layoutId="activeNavUnderline"
                      className="absolute bottom-0 left-0 right-0 h-[2px] bg-[#F7C600] shadow-[0_0_10px_rgba(247,198,0,0.8)]"
                      transition={{ type: "spring", stiffness: 380, damping: 30 }}
                    />
                  )}
                </button>
              )}

              {/* WATCHLIST */}
              {canUseWishlist && (
                <button
                  onClick={() => onTabChange('wishlist')}
                  className={`group relative flex h-[46px] items-center gap-1.5 text-[12.5px] font-sans font-semibold uppercase tracking-[0.12em] transition-colors whitespace-nowrap ${
                    activeTab === 'wishlist'
                      ? 'text-white font-bold'
                      : 'text-[#A4A4AC] hover:text-white'
                  }`}
                  id="nav-wishlist"
                >
                  <Heart className={`h-3.5 w-3.5 transition-colors ${
                    activeTab === 'wishlist' ? 'text-[#F7C600]' : 'text-neutral-400 group-hover:text-[#F7C600]'
                  }`} />
                  <span>WATCHLIST</span>
                  {activeTab === 'wishlist' && (
                    <motion.div
                      layoutId="activeNavUnderline"
                      className="absolute bottom-0 left-0 right-0 h-[2px] bg-[#F7C600] shadow-[0_0_10px_rgba(247,198,0,0.8)]"
                      transition={{ type: "spring", stiffness: 380, damping: 30 }}
                    />
                  )}
                </button>
              )}
            </nav>
          </div>
        </div>
      )}

      {/* ========================================================
          SEARCH OVERLAY MODAL
      ======================================================== */}
      {typeof document !== 'undefined' && createPortal(
        <AnimatePresence>
          {searchOverlayOpen && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSearchOverlayOpen(false)}
              className="fixed inset-0 z-[300] flex items-start justify-center bg-black/85 p-4 sm:p-6 pt-14 sm:pt-16 backdrop-blur-xl"
            >
              <motion.div
                initial={{ opacity: 0, y: -16, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -12, scale: 0.98 }}
                onClick={(e) => e.stopPropagation()}
                className="w-full max-w-2xl overflow-hidden rounded-none border border-white/15 bg-[#09090D] shadow-[0_25px_80px_rgba(0,0,0,0.9)]"
              >
                <div className="flex items-center gap-3 border-b border-white/10 px-5 py-3.5">
                  <Search className="h-4.5 w-4.5 text-[#F7C600] shrink-0" />
                  <input
                    type="text"
                    autoFocus
                    placeholder="Tìm phim, diễn viên, đạo diễn, rạp chiếu..."
                    value={headerQuery}
                    onChange={(e) => setHeaderQuery(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') commitSearch();
                      if (e.key === 'Escape') setSearchOverlayOpen(false);
                    }}
                    className="w-full bg-transparent text-sm sm:text-base font-medium text-white placeholder-neutral-500 outline-none"
                  />
                  {headerQuery && (
                    <button onClick={() => setHeaderQuery('')} className="p-1 text-neutral-400 hover:text-white">
                      <X className="h-4 w-4" />
                    </button>
                  )}
                  <button onClick={() => setSearchOverlayOpen(false)} className="rounded-none border border-white/10 px-2 py-0.5 text-[9px] font-mono text-neutral-400 hover:text-white">
                    ESC
                  </button>
                </div>

                <div className="border-b border-white/5 bg-black/40 px-5 py-2.5">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-500">Gợi ý:</span>
                    {recentSearches.map((tag) => (
                      <button
                        key={tag}
                        onClick={() => { setHeaderQuery(tag); commitSearch(tag); }}
                        className="rounded-none border border-white/10 bg-white/5 px-2.5 py-0.5 text-[11px] text-neutral-300 hover:border-[#F7C600]/40 hover:text-[#F7C600]"
                      >
                        {tag}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="max-h-[55vh] overflow-y-auto p-5 space-y-5 [scrollbar-width:thin]">
                  <div>
                    <div className="flex items-center justify-between mb-2.5">
                      <h4 className="flex items-center gap-1.5 text-[11px] font-extrabold uppercase tracking-widest text-[#F7C600]">
                        <Film className="h-3 w-3" />
                        <span>PHIM ({filteredMovies.length})</span>
                      </h4>
                      <button onClick={() => commitSearch()} className="text-[11px] text-neutral-400 hover:text-[#F7C600]">
                        Xem tất cả →
                      </button>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {filteredMovies.map((movie) => (
                        <div
                          key={movie.backendId || movie.id}
                          onClick={() => handleSuggestionClick(movie)}
                          className="flex items-center gap-2.5 rounded-none border border-white/5 bg-white/[0.02] p-2 hover:border-[#F7C600]/40 hover:bg-white/[0.06] cursor-pointer transition-all"
                        >
                          <img
                            src={movie.posterUrl || 'https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?auto=format&fit=crop&w=200&q=80'}
                            alt=""
                            className="h-12 w-9 rounded-none object-cover border border-white/10 shrink-0"
                          />
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-xs font-bold text-white leading-tight">{movie.title}</p>
                            <p className="text-[9.5px] text-neutral-400 truncate mt-0.5">
                              {[movie.duration ? `${movie.duration}'` : '', (movie.genre || [])[0]].filter(Boolean).join(' · ')}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div>
                    <h4 className="flex items-center gap-1.5 text-[11px] font-extrabold uppercase tracking-widest text-purple-400 mb-2.5">
                      <Building2 className="h-3 w-3" />
                      <span>RẠP CINEPREMIER</span>
                    </h4>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {filteredCinemas.map((c) => (
                        <div
                          key={c.id}
                          onClick={() => { handleSelectCinema(c); setSearchOverlayOpen(false); }}
                          className="flex items-center justify-between rounded-none border border-white/5 bg-white/[0.02] p-2.5 hover:border-purple-400/40 hover:bg-white/[0.06] cursor-pointer"
                        >
                          <div className="min-w-0">
                            <p className="text-xs font-bold text-white truncate">{c.name}</p>
                            <p className="text-[9.5px] text-neutral-400 truncate">{c.address}</p>
                          </div>
                          <span className="text-[9px] font-bold text-emerald-400 shrink-0 ml-2">Mở cửa</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="border-t border-white/10 bg-black/60 px-5 py-2.5 flex items-center justify-between text-[11px] text-neutral-400">
                  <span>Nhấn <span className="font-mono text-white">Enter ↵</span> để tìm kiếm</span>
                  <button onClick={() => commitSearch()} className="font-bold text-[#F7C600] hover:underline flex items-center gap-1">
                    <span>Xem toàn bộ kết quả</span>
                    <ArrowRight className="h-3 w-3" />
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>,
        document.body
      )}

      {/* ========================================================
          CINEMA SELECTOR MODAL
      ======================================================== */}
      {typeof document !== 'undefined' && createPortal(
        <AnimatePresence>
          {cinemaModalOpen && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setCinemaModalOpen(false)}
              className="fixed inset-0 z-[300] flex items-center justify-center bg-black/85 p-4 sm:p-6 backdrop-blur-xl"
            >
              <motion.div
                initial={{ opacity: 0, scale: 0.96, y: 12 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.96, y: 12 }}
                onClick={(e) => e.stopPropagation()}
                className="w-full max-w-2xl overflow-hidden rounded-none border border-white/15 bg-[#09090D] shadow-[0_25px_80px_rgba(0,0,0,0.9)]"
                id="location-dropdown-modal"
              >
                <div className="flex items-center justify-between border-b border-white/10 px-5 py-4 bg-gradient-to-r from-amber-950/20 to-transparent">
                  <div className="flex items-center gap-2.5">
                    <div className="flex h-9 w-9 items-center justify-center rounded-none border border-[#F7C600]/40 bg-[#F7C600]/10 text-[#F7C600]">
                      <Building2 className="h-4.5 w-4.5" />
                    </div>
                    <div>
                      <p className="text-[9px] font-extrabold uppercase tracking-widest text-[#F7C600]">HỆ THỐNG RẠP CINEPREMIER</p>
                      <h3 className="text-base font-black text-white uppercase tracking-wide">CHỌN RẠP XEM PHIM</h3>
                    </div>
                  </div>
                  <button onClick={() => setCinemaModalOpen(false)} className="rounded-none p-1.5 text-neutral-400 hover:text-white">
                    <X className="h-4.5 w-4.5" />
                  </button>
                </div>

                <div className="border-b border-white/10 bg-black/40 px-5 py-2.5">
                  <div className="flex items-center gap-2 rounded-none border border-white/10 bg-neutral-900/60 px-3 py-1.5 text-xs">
                    <Search className="h-3.5 w-3.5 text-neutral-400" />
                    <input
                      type="text"
                      placeholder="Tìm rạp hoặc khu vực..."
                      value={cinemaSearch}
                      onChange={(e) => setCinemaSearch(e.target.value)}
                      className="w-full bg-transparent text-white placeholder-neutral-500 outline-none text-xs"
                    />
                  </div>
                </div>

                <div className="max-h-[55vh] overflow-y-auto p-4 space-y-3 [scrollbar-width:thin]">
                  {cinemasList
                    .filter(c =>
                      c.name.toLowerCase().includes(cinemaSearch.toLowerCase()) ||
                      (c.district && c.district.toLowerCase().includes(cinemaSearch.toLowerCase())) ||
                      (c.city && c.city.toLowerCase().includes(cinemaSearch.toLowerCase())) ||
                      (c.address && c.address.toLowerCase().includes(cinemaSearch.toLowerCase()))
                    )
                    .map((branch) => {
                      const isSelected = selectedCinema?.id === branch.id || selectedCinema?.name === branch.name;
                      const isFav = favoriteCinemas.includes(branch.id);

                      return (
                        <div
                          key={branch.id}
                          onClick={() => handleSelectCinema(branch)}
                          className={`flex items-center justify-between gap-3 rounded-none border p-3 cursor-pointer transition-all duration-150 ${
                            isSelected
                              ? 'border-[#F7C600] bg-[#F7C600]/10'
                              : 'border-white/10 bg-white/[0.02] hover:border-white/20'
                          }`}
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <img src={branch.image} alt={branch.name} className="h-12 w-16 rounded-none object-cover border border-white/10 shrink-0 hidden sm:block" />
                            <div className="min-w-0">
                              <div className="flex items-center gap-1.5">
                                <h4 className="text-xs font-bold text-white truncate">{branch.name}</h4>
                                {isSelected && (
                                  <span className="flex items-center gap-0.5 rounded-none bg-[#F7C600] px-1.5 py-0.2 text-[8px] font-black text-black uppercase">
                                    <Check className="h-2.5 w-2.5 stroke-[3]" />
                                    Đang Chọn
                                  </span>
                                )}
                              </div>
                              <p className="text-[10px] text-neutral-400 truncate mt-0.5">{branch.address}</p>
                              <div className="flex gap-1 mt-1">
                                {branch.facilities.slice(0, 2).map((fac) => (
                                  <span key={fac} className="rounded-none border border-white/10 bg-white/5 px-1.5 py-0.2 text-[8px] text-neutral-300">
                                    {fac}
                                  </span>
                                ))}
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-2 shrink-0">
                            <button
                              type="button"
                              onClick={(e) => toggleFavoriteCinema(branch.id, e)}
                              className={`rounded-none p-1.5 border ${isFav ? 'border-amber-400 bg-amber-400/20 text-amber-300' : 'border-white/10 text-neutral-400'}`}
                            >
                              <Star className={`h-3.5 w-3.5 ${isFav ? 'fill-amber-400' : ''}`} />
                            </button>
                            <button
                              type="button"
                              className={`rounded-none px-2.5 py-1.5 text-[10.5px] font-bold uppercase ${isSelected ? 'bg-[#F7C600] text-black font-extrabold' : 'border border-white/20 text-white'}`}
                            >
                              {isSelected ? 'ĐÃ CHỌN' : 'CHỌN'}
                            </button>
                          </div>
                        </div>
                      );
                    })}
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>,
        document.body
      )}

      {/* ========================================================
          MOBILE NAVIGATION DRAWER
      ======================================================== */}
      {typeof document !== 'undefined' && createPortal(
        <AnimatePresence>
          {mobileMenuOpen && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setMobileMenuOpen(false)}
              className="fixed inset-0 z-[350] bg-black/80 backdrop-blur-md lg:hidden"
            >
              <motion.div
                initial={{ x: '100%' }}
                animate={{ x: 0 }}
                exit={{ x: '100%' }}
                transition={{ type: 'spring', damping: 25, stiffness: 250 }}
                onClick={(e) => e.stopPropagation()}
                className="absolute right-0 top-0 bottom-0 w-[290px] sm:w-[320px] bg-[#07070a] border-l border-white/10 p-5 flex flex-col justify-between overflow-y-auto"
              >
                <div>
                  <div className="flex items-center justify-between pb-3.5 border-b border-white/10 mb-4">
                    <div className="flex items-center space-x-2">
                      <div className="h-8 w-8 flex items-center justify-center bg-zinc-950 border border-[#F7C600]/40 rounded-none">
                        <span className="font-serif text-base font-black text-[#F7C600]">C</span>
                      </div>
                      <span className="font-sans font-black tracking-widest text-xs text-white">
                        CINE<span className="text-[#F7C600]">PREMIER</span>
                      </span>
                    </div>
                    <button onClick={() => setMobileMenuOpen(false)} className="p-1 rounded-none border border-white/10 text-neutral-400 hover:text-white">
                      <X className="h-4.5 w-4.5" />
                    </button>
                  </div>

                  <div className="space-y-2.5 mb-5">
                    <button
                      onClick={() => { setMobileMenuOpen(false); window.scrollTo({ top: 0, behavior: 'instant' }); navigate('/showtimes'); }}
                      className="group flex h-[42px] w-full items-center gap-2.5 rounded-none bg-gradient-to-r from-[#FFDE43] via-[#F7C600] to-[#E5A800] pl-2 pr-4 text-xs font-black uppercase text-[#0A0A0A] shadow-[inset_0_1px_1px_rgba(255,255,255,0.7),0_3px_12px_rgba(247,198,0,0.3)] border border-[#FFE875]/50 active:scale-98"
                    >
                      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-none bg-black/15 text-black">
                        <Ticket className="h-3.5 w-3.5 stroke-[2.4]" />
                      </div>
                      <span className="flex-1 text-center font-black tracking-wider">ĐẶT VÉ NGAY</span>
                    </button>
                    <button
                      onClick={() => { setMobileMenuOpen(false); onTabChange('concessions'); }}
                      className="group flex h-[42px] w-full items-center gap-2.5 rounded-none bg-gradient-to-r from-[#A42EFF] via-[#8A00F5] to-[#6E00C8] pl-2 pr-4 text-xs font-extrabold uppercase text-white shadow-[inset_0_1px_1px_rgba(255,255,255,0.45),0_3px_12px_rgba(138,0,245,0.3)] border border-purple-300/30 active:scale-98"
                    >
                      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-none bg-white/20 text-white">
                        <Popcorn className="h-3.5 w-3.5 stroke-[2.4]" />
                      </div>
                      <span className="flex-1 text-center font-bold tracking-wider">ĐẶT BẮP NƯỚC</span>
                    </button>
                  </div>

                  <div className="space-y-1">
                    <button
                      onClick={() => { setMobileMenuOpen(false); onTabChange('home'); }}
                      className={`flex w-full items-center gap-2.5 rounded-none px-3 py-2 text-xs font-bold uppercase tracking-wider ${
                        activeTab === 'home' ? 'bg-[#F7C600]/15 text-[#F7C600]' : 'text-neutral-300 hover:bg-white/5'
                      }`}
                    >
                      <Home className="h-3.5 w-3.5" />
                      <span>Trang Chủ</span>
                    </button>
                    <button
                      onClick={() => { setMobileMenuOpen(false); onTabChange('explore'); }}
                      className={`flex w-full items-center gap-2.5 rounded-none px-3 py-2 text-xs font-bold uppercase tracking-wider ${
                        activeTab === 'explore' ? 'bg-[#F7C600]/15 text-[#F7C600]' : 'text-neutral-300 hover:bg-white/5'
                      }`}
                    >
                      <Compass className="h-3.5 w-3.5" />
                      <span>Khám Phá Phim</span>
                    </button>
                    <button
                      onClick={() => { setMobileMenuOpen(false); onTabChange('showtimes'); }}
                      className={`flex w-full items-center gap-2.5 rounded-none px-3 py-2 text-xs font-bold uppercase tracking-wider ${
                        activeTab === 'showtimes' ? 'bg-[#F7C600]/15 text-[#F7C600]' : 'text-neutral-300 hover:bg-white/5'
                      }`}
                    >
                      <CalendarDays className="h-3.5 w-3.5 text-[#F7C600]" />
                      <span>Lịch Chiếu & Mua Vé</span>
                    </button>
                    <button
                      onClick={() => { setMobileMenuOpen(false); onTabChange('my-tickets'); }}
                      className={`flex w-full items-center gap-2.5 rounded-none px-3 py-2 text-xs font-bold uppercase tracking-wider ${
                        activeTab === 'my-tickets' ? 'bg-[#F7C600]/15 text-[#F7C600]' : 'text-neutral-300 hover:bg-white/5'
                      }`}
                    >
                      <Ticket className="h-3.5 w-3.5" />
                      <span>Đơn Của Tôi</span>
                    </button>
                    <button
                      onClick={() => { setMobileMenuOpen(false); onTabChange('wishlist'); }}
                      className={`flex w-full items-center gap-2.5 rounded-none px-3 py-2 text-xs font-bold uppercase tracking-wider ${
                        activeTab === 'wishlist' ? 'bg-[#F7C600]/15 text-[#F7C600]' : 'text-neutral-300 hover:bg-white/5'
                      }`}
                    >
                      <Heart className="h-3.5 w-3.5 text-rose-400" />
                      <span>Watchlist</span>
                    </button>
                  </div>
                </div>

                <div className="pt-3 border-t border-white/10">
                  {isLoggedIn ? (
                    <button
                      onClick={() => { setMobileMenuOpen(false); handleLogout({ navigate, showToast }); }}
                      className="flex w-full items-center justify-center gap-1.5 rounded-none border border-rose-500/30 bg-rose-500/10 py-2 text-xs font-bold text-rose-400"
                    >
                      <LogOut className="h-3.5 w-3.5" />
                      <span>Đăng xuất</span>
                    </button>
                  ) : (
                    <button
                      onClick={() => { setMobileMenuOpen(false); onOpenOTP(); }}
                      className="flex h-10 w-full items-center justify-center gap-1.5 rounded-none border border-white/20 font-bold text-xs uppercase text-white hover:bg-white hover:text-black"
                    >
                      <User className="h-3.5 w-3.5" />
                      <span>ĐĂNG NHẬP / ĐĂNG KÝ</span>
                    </button>
                  )}
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>,
        document.body
      )}
    </header>
  );
}
