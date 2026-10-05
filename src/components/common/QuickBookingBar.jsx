<<<<<<< HEAD
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Film, Building2, Calendar, ChevronDown,
  Sparkles, Check, Search, RotateCcw, AlertTriangle
} from 'lucide-react';
import { bookingService } from '../../services/bookingService';
import { movieService } from '../../services/movieService';
import { useMovies } from '../../stores/useMovieStore';
import { useUiStore } from '../../stores/useUiStore';
import { getShowtimeDates } from '../../utils/showtimeDates';
=======
import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Ticket, Film, Building2, Calendar, Clock, ChevronDown, Sparkles, User, ArrowRight, Check } from 'lucide-react';
import { bookingService } from '../../services/bookingService';
import { movieService } from '../../services/movieService';
import { useMovies } from '../../stores/useMovieStore';
import { useAuthStore } from '../../stores/useAuthStore';
import { useUiStore } from '../../stores/useUiStore';
>>>>>>> 994357b939ca99abf48e6008d0d9cb6c51892055

const toDateKey = (date) => {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
};

const formatVietnameseWeekday = (dateStr) => {
  try {
    const parts = String(dateStr).split('-');
    const d = parts.length === 3 ? new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2])) : new Date(dateStr);
    const today = new Date();
    if (toDateKey(d) === toDateKey(today)) return 'Hôm nay';
    const tomorrow = new Date();
    tomorrow.setDate(today.getDate() + 1);
    if (toDateKey(d) === toDateKey(tomorrow)) return 'Ngày mai';
    const days = ['Chủ Nhật', 'Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy'];
    return days[d.getDay()] || 'Hôm nay';
  } catch {
    return 'Hôm nay';
  }
};

<<<<<<< HEAD
const formatShortDate = (dateStr) => {
  try {
    const parts = String(dateStr).split('-');
    if (parts.length === 3) {
      return `${parts[2]}/${parts[1]}`;
    }
    return dateStr;
  } catch {
    return dateStr;
  }
};

const getAgeRatingBadge = (ageRating) => {
  const norm = String(ageRating || '').toUpperCase().trim();
  if (norm.includes('18') || norm === 'C18' || norm === 'T18') {
    return { label: norm || '18+', bg: 'bg-rose-50 text-rose-600 border-rose-200' };
  }
  if (norm.includes('16') || norm === 'C16' || norm === 'T16') {
    return { label: norm || '16+', bg: 'bg-amber-50 text-amber-700 border-amber-200' };
  }
  if (norm.includes('13') || norm === 'C13' || norm === 'T13') {
    return { label: norm || '13+', bg: 'bg-yellow-50 text-yellow-700 border-yellow-200' };
  }
  if (norm.includes('P') || norm.includes('ALL')) {
    return { label: norm || 'P', bg: 'bg-emerald-50 text-emerald-600 border-emerald-200' };
  }
  return { label: norm || 'K', bg: 'bg-blue-50 text-blue-600 border-blue-200' };
};

export default function QuickBookingBar({ className = '', movies }) {
  const navigate = useNavigate();
  const { moviesList = [] } = useMovies();
  const showToast = useUiStore((state) => state.showToast);

  // Real backend cinemas and showtimes
  const [cinemas, setCinemas] = useState([]);
  const [allShowtimes, setAllShowtimes] = useState([]);

  // Selected values strictly sequential: Step 1 -> Step 2 -> Step 3 -> Step 4
  const [selectedMovieId, setSelectedMovieId] = useState('');
  const [selectedCinemaId, setSelectedCinemaId] = useState(''); // 'ALL' hoặc ID rạp
  const [selectedDate, setSelectedDate] = useState('');
  const [selectedShowtimeId, setSelectedShowtimeId] = useState('');

  // Dropdown open states ('movie' | 'cinema' | 'date' | 'showtime' | null)
  const [activeDropdown, setActiveDropdown] = useState(null);
  const [movieSearchQuery, setMovieSearchQuery] = useState('');

  // Thông báo chọn theo thứ tự
  const [orderNotice, setOrderNotice] = useState(null);
  const [highlightedStep, setHighlightedStep] = useState(null);
  const noticeTimeoutRef = useRef(null);

  const containerRef = useRef(null);

  // Dọn dẹp timer khi component unmount
  useEffect(() => {
    return () => {
      if (noticeTimeoutRef.current) clearTimeout(noticeTimeoutRef.current);
    };
  }, []);

  // Close dropdown on outside click or Escape key
  useEffect(() => {
    const handleOutsideClick = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setActiveDropdown(null);
      }
    };

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        setActiveDropdown(null);
      }
    };

    document.addEventListener('mousedown', handleOutsideClick);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  // 1. Tải danh sách rạp chiếu từ backend API
=======
export default function QuickBookingBar({ className = '' }) {
  const navigate = useNavigate();
  const { moviesList = [] } = useMovies();
  const isLoggedIn = useAuthStore((state) => state.isLoggedIn);
  const currentUser = useAuthStore((state) => state.currentUser);
  const setShowOTP = useUiStore((state) => state.setShowOTP);
  const setAuthMode = useUiStore((state) => state.setAuthMode);

  // Danh sách rạp & suất chiếu
  const [cinemas, setCinemas] = useState([]);
  const [showtimes, setShowtimes] = useState([]);
  const [isLoadingShowtimes, setIsLoadingShowtimes] = useState(false);

  // Lựa chọn hiện tại
  const [selectedMovieId, setSelectedMovieId] = useState('');
  const [selectedCinemaId, setSelectedCinemaId] = useState('');
  const [selectedDate, setSelectedDate] = useState(() => toDateKey(new Date()));
  const [selectedShowtimeId, setSelectedShowtimeId] = useState('');

  // Tải danh sách rạp
>>>>>>> 994357b939ca99abf48e6008d0d9cb6c51892055
  useEffect(() => {
    let cancelled = false;
    movieService.getPublicCinemas()
      .then((res) => {
        if (cancelled) return;
        const raw = Array.isArray(res) ? res : (res?.data || []);
<<<<<<< HEAD
        const valid = raw.filter((c) => c.status === 'ACTIVE' || !c.status);
        setCinemas(valid);
      })
      .catch(() => {
        if (!cancelled) setCinemas([]);
      });
    return () => { cancelled = true; };
  }, []);

  // 2. Tải danh sách suất chiếu
  useEffect(() => {
    let cancelled = false;
    bookingService.getShowtimes({ size: 250 })
      .then((res) => {
        if (cancelled) return;
        const raw = Array.isArray(res) ? res : (res?.data?.items ?? res?.items ?? res?.content ?? res?.data ?? []);
        const now = new Date();
        const valid = raw.filter((st) => {
          if (!st.startTime) return false;
          const stTime = new Date(st.startTime);
          return stTime > now && (st.status === 'OPEN' || st.status === 'SCHEDULED' || !st.status);
        });
        valid.sort((a, b) => new Date(a.startTime) - new Date(b.startTime));
        setAllShowtimes(valid);
      })
      .catch((err) => {
        console.error('Lỗi tải lịch chiếu QuickBookingBar:', err);
        if (!cancelled) setAllShowtimes([]);
      });
    return () => { cancelled = true; };
  }, []);

  // Khi chọn phim cụ thể: tải thêm showtimes theo phim nếu có
  useEffect(() => {
    if (!selectedMovieId) return;
    let cancelled = false;
    bookingService.getShowtimes({ movieId: selectedMovieId, size: 100 })
      .then((res) => {
        if (cancelled) return;
        const raw = Array.isArray(res) ? res : (res?.data?.items ?? res?.items ?? res?.content ?? res?.data ?? []);
        if (raw && raw.length > 0) {
          const now = new Date();
          const valid = raw.filter((st) => {
            if (!st.startTime) return false;
            return new Date(st.startTime) > now && (st.status === 'OPEN' || st.status === 'SCHEDULED' || !st.status);
          });
          setAllShowtimes((prev) => {
            const existingIds = new Set(prev.map((s) => String(s.id)));
            const newShowtimes = valid.filter((s) => !existingIds.has(String(s.id)));
            return [...prev, ...newShowtimes].sort((a, b) => new Date(a.startTime) - new Date(b.startTime));
          });
        }
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [selectedMovieId]);

  // Helper lấy tên rạp
  const getCinemaName = (cId, fallbackName) => {
    if (fallbackName) return fallbackName;
    const found = cinemas.find((c) => String(c.id) === String(cId));
    return found?.name || 'Cụm rạp CineGalaxy';
  };

  // Map số lượng suất chiếu cho từng phim
  const movieShowtimesCountMap = useMemo(() => {
    const map = {};
    allShowtimes.forEach((st) => {
      const mId = String(st.movieId);
      map[mId] = (map[mId] || 0) + 1;
    });
    return map;
  }, [allShowtimes]);

  // Danh sách phim khả dụng
  const availableMovies = useMemo(() => {
    const rawList = movies && movies.length > 0 ? movies : moviesList;
    if (!rawList || rawList.length === 0) return [];

    return [...rawList].sort((a, b) => {
      const aId = String(a.backendId || a.id);
      const bId = String(b.backendId || b.id);
      const aCount = movieShowtimesCountMap[aId] || 0;
      const bCount = movieShowtimesCountMap[bId] || 0;
      if (bCount !== aCount) return bCount - aCount;
      if (a.isNowShowing && !b.isNowShowing) return -1;
      if (!a.isNowShowing && b.isNowShowing) return 1;
      return 0;
    });
  }, [movies, moviesList, movieShowtimesCountMap]);

  // Phim được lọc qua ô tìm kiếm
  const filteredSearchMovies = useMemo(() => {
    if (!movieSearchQuery.trim()) return availableMovies;
    const query = movieSearchQuery.toLowerCase().trim();
    return availableMovies.filter((m) => m.title && m.title.toLowerCase().includes(query));
  }, [availableMovies, movieSearchQuery]);

  // Phim đang được chọn
  const selectedMovie = useMemo(() => {
    if (!selectedMovieId) return null;
    return availableMovies.find((m) => String(m.backendId || m.id) === String(selectedMovieId)) || null;
  }, [availableMovies, selectedMovieId]);

  // Danh sách rạp có suất chiếu của phim đang chọn
  const availableCinemas = useMemo(() => {
    if (!selectedMovieId) return [];

    const cinemaCounts = {};
    allShowtimes.forEach((st) => {
      if (String(st.movieId) === String(selectedMovieId)) {
        const cId = String(st.cinemaId);
        cinemaCounts[cId] = (cinemaCounts[cId] || 0) + 1;
      }
    });

    return cinemas
      .map((c) => ({
        ...c,
        showtimesCount: cinemaCounts[String(c.id)] || 0
      }))
      .sort((a, b) => b.showtimesCount - a.showtimesCount);
  }, [cinemas, allShowtimes, selectedMovieId]);

  // Rạp đang được chọn
  const selectedCinema = useMemo(() => {
    if (!selectedCinemaId || selectedCinemaId === 'ALL') return null;
    return cinemas.find((c) => String(c.id) === String(selectedCinemaId)) || null;
  }, [cinemas, selectedCinemaId]);

  // Danh sách các ngày chiếu khả dụng
  const availableDates = useMemo(() => {
    if (!selectedMovieId || !selectedCinemaId) return [];

    const matching = allShowtimes.filter(st =>
      String(st.movieId) === String(selectedMovieId) &&
      (selectedCinemaId === 'ALL' || String(st.cinemaId) === String(selectedCinemaId))
    );
    return getShowtimeDates(matching).map(({ dateKey, count }) => ({
      dateStr: dateKey, count, totalCount: count
    }));
  }, [allShowtimes, selectedMovieId, selectedCinemaId]);

  // Suất chiếu tại rạp đã chọn (hoặc toàn bộ nếu là 'ALL')
  const currentCinemaShowtimes = useMemo(() => {
    if (!selectedMovieId || !selectedDate) return [];

    return allShowtimes.filter((st) => {
      if (String(st.movieId) !== String(selectedMovieId)) return false;
      if (selectedCinemaId !== 'ALL' && String(st.cinemaId) !== String(selectedCinemaId)) return false;
      if (st.startTime.split('T')[0] !== selectedDate) return false;
      return true;
    }).sort((a, b) => new Date(a.startTime) - new Date(b.startTime));
  }, [allShowtimes, selectedMovieId, selectedCinemaId, selectedDate]);

  // Suất chiếu tại các rạp khác (tự động gợi ý nếu rạp đã chọn không có suất)
  const otherCinemasShowtimes = useMemo(() => {
    if (!selectedMovieId || !selectedDate || selectedCinemaId === 'ALL') return [];

    return allShowtimes.filter((st) => {
      if (String(st.movieId) !== String(selectedMovieId)) return false;
      if (String(st.cinemaId) === String(selectedCinemaId)) return false;
      if (st.startTime.split('T')[0] !== selectedDate) return false;
      return true;
    }).sort((a, b) => new Date(a.startTime) - new Date(b.startTime));
  }, [allShowtimes, selectedMovieId, selectedCinemaId, selectedDate]);

  // Suất chiếu đang chọn
  const selectedShowtime = useMemo(() => {
    if (!selectedShowtimeId) return null;
    return allShowtimes.find((st) => String(st.id) === String(selectedShowtimeId)) || null;
  }, [allShowtimes, selectedShowtimeId]);

  // Helper cảnh báo và nhắc nhở chọn theo đúng thứ tự (Toast + Banner nổi + Tự mở bước cần chọn)
  const notifyOrderRequirement = (targetStep, message) => {
    showToast(message, 3500, null, 'warning');
    if (noticeTimeoutRef.current) clearTimeout(noticeTimeoutRef.current);
    setOrderNotice(message);
    setHighlightedStep(targetStep);

    // Mở đúng dropdown của bước cần chọn trước để người dùng thao tác ngay
    if (targetStep === 1) setActiveDropdown('movie');
    else if (targetStep === 2) setActiveDropdown('cinema');
    else if (targetStep === 3) setActiveDropdown('date');
    else if (targetStep === 4) setActiveDropdown('showtime');

    noticeTimeoutRef.current = setTimeout(() => {
      setOrderNotice(null);
      setHighlightedStep(null);
    }, 3500);
  };

  // Step-by-step Selection Handlers (Đã chọn hợp lệ -> tắt cảnh báo)
  const handleSelectMovie = (movie) => {
    setOrderNotice(null);
    setHighlightedStep(null);
    const movieId = String(movie.backendId || movie.id);
    setSelectedMovieId(movieId);
    setSelectedCinemaId('');
    setSelectedDate('');
    setSelectedShowtimeId('');
    setActiveDropdown('cinema');
  };

  const handleSelectCinema = (cinemaItem) => {
    setOrderNotice(null);
    setHighlightedStep(null);
    const cId = String(cinemaItem.id);
    setSelectedCinemaId(cId);
    setSelectedDate('');
    setSelectedShowtimeId('');
    setActiveDropdown('date');
  };

  const handleSelectDate = (dateStr) => {
    setOrderNotice(null);
    setHighlightedStep(null);
    setSelectedDate(dateStr);
    setSelectedShowtimeId('');
    setActiveDropdown('showtime');
  };

  const handleSelectShowtime = (showtime) => {
    setOrderNotice(null);
    setHighlightedStep(null);
    setSelectedShowtimeId(String(showtime.id));
    if (showtime.cinemaId && (selectedCinemaId === 'ALL' || String(showtime.cinemaId) !== String(selectedCinemaId))) {
      setSelectedCinemaId(String(showtime.cinemaId));
    }
    setActiveDropdown(null);
  };

  const handleResetAll = () => {
    setOrderNotice(null);
    setHighlightedStep(null);
    setSelectedMovieId('');
    setSelectedCinemaId('');
    setSelectedDate('');
    setSelectedShowtimeId('');
    setActiveDropdown(null);
    setMovieSearchQuery('');
  };

  // Step click handlers: Bắt buộc theo đúng thứ tự 1 -> 2 -> 3 -> 4
  const handleStep1Click = () => {
    setOrderNotice(null);
    setHighlightedStep(null);
    setActiveDropdown((curr) => (curr === 'movie' ? null : 'movie'));
  };

  const handleStep2Click = () => {
    if (!selectedMovieId) {
      notifyOrderRequirement(1, 'Vui lòng chọn phim trước (Bước 1) theo thứ tự!');
      return;
    }
    setOrderNotice(null);
    setHighlightedStep(null);
    setActiveDropdown((curr) => (curr === 'cinema' ? null : 'cinema'));
  };

  const handleStep3Click = () => {
    if (!selectedMovieId) {
      notifyOrderRequirement(1, 'Vui lòng chọn phim trước (Bước 1) theo thứ tự!');
      return;
    }
    if (!selectedCinemaId) {
      notifyOrderRequirement(2, 'Vui lòng chọn rạp chiếu trước (Bước 2) theo thứ tự!');
      return;
    }
    setOrderNotice(null);
    setHighlightedStep(null);
    setActiveDropdown((curr) => (curr === 'date' ? null : 'date'));
  };

  const handleStep4Click = () => {
    if (!selectedMovieId) {
      notifyOrderRequirement(1, 'Vui lòng chọn phim trước (Bước 1) theo thứ tự!');
      return;
    }
    if (!selectedCinemaId) {
      notifyOrderRequirement(2, 'Vui lòng chọn rạp chiếu trước (Bước 2) theo thứ tự!');
      return;
    }
    if (!selectedDate) {
      notifyOrderRequirement(3, 'Vui lòng chọn ngày chiếu trước (Bước 3) theo thứ tự!');
      return;
    }
    setOrderNotice(null);
    setHighlightedStep(null);
    setActiveDropdown((curr) => (curr === 'showtime' ? null : 'showtime'));
  };

  // Submit action: Mua vé nhanh (Kiểm tra theo thứ tự và báo lỗi nếu bấm khi chưa chọn đủ)
  const handleQuickBuy = () => {
    if (!selectedMovieId) {
      notifyOrderRequirement(1, 'Vui lòng chọn phim (Bước 1) theo thứ tự để tiếp tục!');
      return;
    }
    if (!selectedCinemaId) {
      notifyOrderRequirement(2, 'Vui lòng chọn rạp chiếu (Bước 2) theo thứ tự để tiếp tục!');
      return;
    }
    if (!selectedDate) {
      notifyOrderRequirement(3, 'Vui lòng chọn ngày chiếu (Bước 3) theo thứ tự để tiếp tục!');
      return;
    }
    if (!selectedShowtimeId) {
      notifyOrderRequirement(4, 'Vui lòng chọn suất chiếu (Bước 4) để hoàn tất mua vé nhanh!');
      return;
    }
    setOrderNotice(null);
    navigate(`/movies/${selectedMovieId}/book?showtimeId=${selectedShowtimeId}&cinemaId=${selectedCinemaId}&date=${selectedDate}`);
  };

  return (
    <div
      ref={containerRef}
      className={`w-full bg-white rounded-md shadow-[0_10px_35px_rgba(0,0,0,0.3)] flex flex-col md:flex-row items-stretch relative z-40 ${className}`}
      id="quick-booking-panel"
    >
      {/* Thông báo nổi bật khi bấm không đúng thứ tự (Tự động biến mất sau 3.5s) */}
      {orderNotice && (
        <div
          role="alert"
          className="absolute -top-12 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 px-4 py-2 bg-[#1c160c]/95 border border-[#F7C600] text-amber-200 text-xs sm:text-sm font-semibold rounded-full shadow-[0_8px_25px_rgba(247,198,0,0.35)] backdrop-blur-md animate-in fade-in zoom-in-95 duration-200 pointer-events-none whitespace-nowrap max-w-[94vw]"
        >
          <AlertTriangle className="h-4 w-4 text-[#F7C600] shrink-0 animate-bounce" />
          <span className="truncate">{orderNotice}</span>
        </div>
      )}

      {/* 4 Cột bước chọn (1 -> 4) chia vạch ngăn cách rõ ràng, không lem viền */}
      <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 divide-y sm:divide-y-0 sm:divide-x divide-neutral-200">

        {/* ========================================================
            BƯỚC 1: CHỌN PHIM
        ======================================================== */}
        <div className="relative">
          <div
            onClick={handleStep1Click}
            className={`h-12 sm:h-13 px-3.5 flex items-center justify-between gap-2 cursor-pointer select-none transition-all rounded-tl-md sm:rounded-tl-none md:rounded-l-md ${
              highlightedStep === 1
                ? 'bg-amber-100/90 ring-2 ring-amber-400 ring-inset animate-pulse'
                : activeDropdown === 'movie'
                ? 'bg-amber-50/70'
                : 'hover:bg-neutral-50 bg-white'
            }`}
          >
            <div className="flex items-center gap-2 min-w-0">
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#F7C600] text-black text-[11px] font-black shrink-0 shadow-[0_1px_4px_rgba(247,198,0,0.4)]">
                1
              </span>
              <span className={`text-xs sm:text-[13px] truncate ${
                selectedMovie ? 'font-bold text-neutral-900' : 'font-medium text-neutral-600'
              }`}>
                {selectedMovie ? selectedMovie.title : 'Chọn phim'}
              </span>
            </div>

            <ChevronDown
              className={`h-3.5 w-3.5 shrink-0 text-neutral-400 transition-transform duration-200 ${
                activeDropdown === 'movie' ? 'rotate-180 text-[#E5A800]' : ''
              }`}
            />
          </div>

          {/* Dropdown Menu Phim */}
          {activeDropdown === 'movie' && (
            <div className="absolute left-0 top-[calc(100%+6px)] w-full min-w-[290px] sm:min-w-[340px] max-w-[calc(100vw-32px)] bg-white border border-neutral-200 shadow-[0_18px_45px_rgba(0,0,0,0.18)] rounded-lg z-50 py-2">
              {/* Search box */}
              {availableMovies.length > 5 && (
                <div className="px-2.5 pb-2 mb-1 border-b border-neutral-100">
                  <div className="relative flex items-center">
                    <Search className="absolute left-2.5 h-3.5 w-3.5 text-neutral-400" />
                    <input
                      type="text"
                      value={movieSearchQuery}
                      onChange={(e) => setMovieSearchQuery(e.target.value)}
                      placeholder="Tìm kiếm phim..."
                      autoFocus
                      className="w-full h-8 pl-8 pr-2.5 bg-neutral-50 border border-neutral-200 rounded text-xs text-neutral-800 placeholder-neutral-400 focus:bg-white focus:outline-none focus:border-[#F7C600] focus:ring-1 focus:ring-[#F7C600]"
                    />
                  </div>
                </div>
              )}

              {/* Danh sách phim */}
              <div className="max-h-[260px] overflow-y-auto custom-scrollbar divide-y divide-neutral-100">
                {filteredSearchMovies.length === 0 ? (
                  <div className="px-3 py-4 text-center text-xs text-neutral-400">
                    Không tìm thấy phim phù hợp
                  </div>
                ) : (
                  filteredSearchMovies.map((m) => {
                    const mId = String(m.backendId || m.id);
                    const isSelected = selectedMovieId === mId;
                    const count = movieShowtimesCountMap[mId] || 0;
                    const ageBadge = getAgeRatingBadge(m.ageRating);
                    const poster = m.posterUrl || m.imageUrl || m.poster;

                    return (
                      <div
                        key={mId}
                        onClick={() => handleSelectMovie(m)}
                        className={`px-3 py-2 flex items-center justify-between gap-2.5 transition-colors cursor-pointer group ${
                          isSelected
                            ? 'bg-amber-50 text-amber-950 border-l-3 border-[#F7C600] font-bold'
                            : 'hover:bg-neutral-50 text-neutral-800'
                        }`}
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          {poster ? (
                            <img
                              src={poster}
                              alt={m.title}
                              className="h-10 w-7 object-cover shrink-0 rounded border border-neutral-200 bg-neutral-100"
                            />
                          ) : (
                            <div className="h-10 w-7 flex items-center justify-center shrink-0 rounded border border-neutral-200 bg-neutral-100 text-neutral-400">
                              <Film className="h-3.5 w-3.5" />
                            </div>
                          )}
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5">
                              <span className={`text-xs truncate ${
                                isSelected ? 'font-bold text-amber-900' : 'font-medium group-hover:text-amber-800'
                              }`}>
                                {m.title}
                              </span>
                              {m.ageRating && (
                                <span className={`px-1 py-0.2 text-[9px] font-bold border rounded shrink-0 ${ageBadge.bg}`}>
                                  {ageBadge.label}
                                </span>
                              )}
                            </div>
                            <span className="text-[10px] text-neutral-400 block truncate">
                              {count > 0 ? (
                                <span className="text-amber-700 font-semibold">{count} suất chiếu khả dụng</span>
                              ) : (
                                <span>Chưa có lịch hôm nay</span>
                              )}
                            </span>
                          </div>
                        </div>

                        {isSelected && <Check className="h-3.5 w-3.5 text-[#E5A800] shrink-0" />}
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}
        </div>

        {/* ========================================================
            BƯỚC 2: CHỌN RẠP (Số 2 tròn màu Vàng Hoàng Kim đồng bộ)
        ======================================================== */}
        <div className="relative">
          <div
            onClick={handleStep2Click}
            title={!selectedMovieId ? 'Vui lòng chọn phim trước (Bước 1)' : 'Chọn cụm rạp'}
            className={`h-12 sm:h-13 px-3.5 flex items-center justify-between gap-2 cursor-pointer select-none transition-all ${
              highlightedStep === 2
                ? 'bg-amber-100/90 ring-2 ring-amber-400 ring-inset animate-pulse'
                : activeDropdown === 'cinema'
                ? 'bg-amber-50/70'
                : 'hover:bg-neutral-50 bg-white'
            }`}
          >
            <div className="flex items-center gap-2 min-w-0">
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#F7C600] text-black text-[11px] font-black shrink-0 shadow-[0_1px_4px_rgba(247,198,0,0.4)]">
                2
              </span>
              <span className={`text-xs sm:text-[13px] truncate ${
                selectedCinemaId === 'ALL'
                  ? 'text-amber-700 font-bold'
                  : selectedCinema
                    ? 'text-neutral-900 font-bold'
                    : 'text-neutral-600 font-medium'
              }`}>
                {selectedCinemaId === 'ALL'
                  ? 'Toàn bộ cụm rạp'
                  : selectedCinema
                    ? selectedCinema.name
                    : 'Chọn rạp'}
              </span>
            </div>

            <ChevronDown
              className={`h-3.5 w-3.5 shrink-0 text-neutral-400 transition-transform duration-200 ${
                activeDropdown === 'cinema' ? 'rotate-180 text-[#E5A800]' : ''
              }`}
            />
          </div>

          {/* Dropdown Menu Rạp */}
          {activeDropdown === 'cinema' && selectedMovieId && (
            <div className="absolute left-0 top-[calc(100%+6px)] w-full min-w-[280px] sm:min-w-[320px] max-w-[calc(100vw-32px)] bg-white border border-neutral-200 shadow-[0_18px_45px_rgba(0,0,0,0.18)] rounded-lg z-50 py-2">
              <div className="px-3 pb-1.5 mb-1 border-b border-neutral-100 flex items-center justify-between text-[11px] text-neutral-400 font-medium">
                <span>Chọn cụm rạp chiếu</span>
                <span className="text-[10px] text-amber-700 font-bold">BƯỚC 2</span>
              </div>

              {/* Tùy chọn: TOÀN BỘ CỤM RẠP */}
              <div
                onClick={() => handleSelectCinema({ id: 'ALL', name: 'Toàn bộ cụm rạp' })}
                className={`px-3 py-2.5 flex items-center justify-between gap-2.5 transition-colors cursor-pointer group border-b border-neutral-100 ${
                  selectedCinemaId === 'ALL'
                    ? 'bg-amber-50 text-amber-950 font-bold border-l-3 border-[#F7C600]'
                    : 'hover:bg-amber-50/60 text-neutral-800'
                }`}
              >
                <div className="flex items-center gap-2 min-w-0">
                  <div className="flex h-6 w-6 items-center justify-center rounded-full bg-[#F7C600]/25 text-black shrink-0">
                    <Sparkles className="h-3 w-3 text-amber-700" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-bold text-amber-900">Toàn bộ cụm rạp</span>
                      <span className="px-1 py-0.2 text-[8px] font-black uppercase rounded bg-[#F7C600] text-black">
                        Tất cả
                      </span>
                    </div>
                    <span className="text-[10px] text-neutral-400 block truncate">
                      Xem lịch chiếu của phim trên toàn hệ thống
                    </span>
                  </div>
                </div>
                {selectedCinemaId === 'ALL' && <Check className="h-3.5 w-3.5 text-[#E5A800] shrink-0" />}
              </div>

              {/* Danh sách từng rạp */}
              <div className="max-h-[240px] overflow-y-auto custom-scrollbar divide-y divide-neutral-100">
                {availableCinemas.length === 0 ? (
                  <div className="px-3 py-3 text-center text-xs text-neutral-400">
                    Chưa có rạp nào lên lịch cho phim này
                  </div>
                ) : (
                  availableCinemas.map((c) => {
                    const cId = String(c.id);
                    const isSelected = selectedCinemaId === cId;

                    return (
                      <div
                        key={cId}
                        onClick={() => handleSelectCinema(c)}
                        className={`px-3 py-2 flex items-center justify-between gap-2 transition-colors cursor-pointer group ${
                          isSelected
                            ? 'bg-amber-50 text-amber-950 font-bold border-l-3 border-[#F7C600]'
                            : 'hover:bg-neutral-50 text-neutral-800'
                        }`}
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <Building2 className={`h-3.5 w-3.5 shrink-0 ${isSelected ? 'text-amber-600' : 'text-neutral-400 group-hover:text-amber-600'}`} />
                          <div className="min-w-0">
                            <span className={`text-xs truncate block ${isSelected ? 'font-bold text-amber-900' : 'font-medium group-hover:text-amber-900'}`}>
                              {c.name}
                            </span>
                            <span className="text-[10px] text-neutral-400 block truncate">
                              {c.showtimesCount > 0 ? (
                                <span className="text-amber-700 font-semibold">{c.showtimesCount} suất</span>
                              ) : (
                                <span>Chưa có suất</span>
                              )}
                            </span>
                          </div>
                        </div>

                        {isSelected && <Check className="h-3.5 w-3.5 text-[#E5A800] shrink-0" />}
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}
        </div>

        {/* ========================================================
            BƯỚC 3: CHỌN NGÀY (Số 3 tròn màu Vàng Hoàng Kim đồng bộ)
        ======================================================== */}
        <div className="relative">
          <div
            onClick={handleStep3Click}
            title={!selectedMovieId ? 'Vui lòng chọn phim trước (Bước 1)' : !selectedCinemaId ? 'Vui lòng chọn rạp trước (Bước 2)' : 'Chọn ngày chiếu'}
            className={`h-12 sm:h-13 px-3.5 flex items-center justify-between gap-2 cursor-pointer select-none transition-all ${
              highlightedStep === 3
                ? 'bg-amber-100/90 ring-2 ring-amber-400 ring-inset animate-pulse'
                : activeDropdown === 'date'
                ? 'bg-amber-50/70'
                : 'hover:bg-neutral-50 bg-white'
            }`}
          >
            <div className="flex items-center gap-2 min-w-0">
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#F7C600] text-black text-[11px] font-black shrink-0 shadow-[0_1px_4px_rgba(247,198,0,0.4)]">
                3
              </span>
              <span className={`text-xs sm:text-[13px] truncate ${
                selectedDate ? 'text-neutral-900 font-bold' : 'text-neutral-600 font-medium'
              }`}>
                {selectedDate
                  ? `${formatVietnameseWeekday(selectedDate)}, ${formatShortDate(selectedDate)}`
                  : 'Chọn ngày'}
              </span>
            </div>

            <ChevronDown
              className={`h-3.5 w-3.5 shrink-0 text-neutral-400 transition-transform duration-200 ${
                activeDropdown === 'date' ? 'rotate-180 text-[#E5A800]' : ''
              }`}
            />
          </div>

          {/* Dropdown Menu Ngày */}
          {activeDropdown === 'date' && selectedCinemaId && (
            <div className="absolute left-0 top-[calc(100%+6px)] w-full min-w-[260px] sm:min-w-[290px] max-w-[calc(100vw-32px)] bg-white border border-neutral-200 shadow-[0_18px_45px_rgba(0,0,0,0.18)] rounded-lg z-50 py-2">
              <div className="px-3 pb-1.5 mb-1 border-b border-neutral-100 flex items-center justify-between text-[11px] text-neutral-400 font-medium">
                <span>Chọn ngày chiếu</span>
                <span className="text-[10px] text-amber-700 font-bold">BƯỚC 3</span>
              </div>

              <div className="max-h-[240px] overflow-y-auto custom-scrollbar divide-y divide-neutral-100">
                {availableDates.map((item) => {
                  const isSelected = selectedDate === item.dateStr;
                  const weekday = formatVietnameseWeekday(item.dateStr);
                  const isToday = weekday === 'Hôm nay';
                  const dateParts = item.dateStr.split('-');
                  const displayDate = `${dateParts[2]}/${dateParts[1]}/${dateParts[0]}`;

                  return (
                    <div
                      key={item.dateStr}
                      onClick={() => handleSelectDate(item.dateStr)}
                      className={`px-3 py-2 flex items-center justify-between gap-2 transition-colors cursor-pointer group ${
                        isSelected
                          ? 'bg-amber-50 text-amber-950 font-bold border-l-3 border-[#F7C600]'
                          : 'hover:bg-neutral-50 text-neutral-800'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <Calendar className={`h-3.5 w-3.5 shrink-0 ${isSelected ? 'text-amber-600' : 'text-neutral-400 group-hover:text-amber-600'}`} />
                        <div>
                          <div className="flex items-center gap-1.5">
                            <span className={`text-xs ${isSelected ? 'font-bold text-amber-950' : 'font-medium group-hover:text-amber-900'}`}>
                              {weekday}
                            </span>
                            {isToday && (
                              <span className="px-1 py-0.2 text-[8px] font-black uppercase rounded bg-[#F7C600] text-black">
                                Hôm nay
                              </span>
                            )}
                          </div>
                          <span className="text-[10px] text-neutral-400 block">{displayDate}</span>
                        </div>
                      </div>

                      <div className="text-right">
                        {item.totalCount > 0 ? (
                          <span className="text-[10px] text-amber-700 font-semibold">{item.totalCount} suất</span>
                        ) : (
                          <span className="text-[10px] text-neutral-300">0 suất</span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* ========================================================
            BƯỚC 4: CHỌN SUẤT CHIẾU (Số 4 tròn màu Vàng Hoàng Kim đồng bộ)
        ======================================================== */}
        <div className="relative">
          <div
            onClick={handleStep4Click}
            title={!selectedMovieId ? 'Vui lòng chọn phim trước (Bước 1)' : !selectedCinemaId ? 'Vui lòng chọn rạp trước (Bước 2)' : !selectedDate ? 'Vui lòng chọn ngày trước (Bước 3)' : 'Chọn suất chiếu'}
            className={`h-12 sm:h-13 px-3.5 flex items-center justify-between gap-2 cursor-pointer select-none transition-all ${
              highlightedStep === 4
                ? 'bg-amber-100/90 ring-2 ring-amber-400 ring-inset animate-pulse'
                : activeDropdown === 'showtime'
                ? 'bg-amber-50/70'
                : 'hover:bg-neutral-50 bg-white'
            }`}
          >
            <div className="flex items-center gap-2 min-w-0">
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#F7C600] text-black text-[11px] font-black shrink-0 shadow-[0_1px_4px_rgba(247,198,0,0.4)]">
                4
              </span>
              <span className={`text-xs sm:text-[13px] truncate ${
                selectedShowtime ? 'text-neutral-900 font-bold' : 'text-neutral-600 font-medium'
              }`}>
                {selectedShowtime
                  ? new Date(selectedShowtime.startTime).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })
                  : 'Chọn suất'}
              </span>
            </div>

            <ChevronDown
              className={`h-3.5 w-3.5 shrink-0 text-neutral-400 transition-transform duration-200 ${
                activeDropdown === 'showtime' ? 'rotate-180 text-[#E5A800]' : ''
              }`}
            />
          </div>

          {/* Dropdown Menu Suất (Chỉ hiện giờ chiếu, KHÔNG hiện giá vé, KHÔNG hiện room) */}
          {activeDropdown === 'showtime' && selectedDate && (
            <div className="absolute right-0 top-[calc(100%+6px)] w-full min-w-[280px] sm:min-w-[320px] max-w-[calc(100vw-32px)] bg-white border border-neutral-200 shadow-[0_18px_45px_rgba(0,0,0,0.18)] rounded-lg z-50 py-2.5 px-3">
              <div className="pb-2 mb-2 border-b border-neutral-100 flex items-center justify-between text-[11px] text-neutral-400 font-medium">
                <span>Chọn khung giờ chiếu</span>
                <span className="text-[10px] text-amber-700 font-bold">BƯỚC 4</span>
              </div>

              {/* Suất chiếu tại rạp đã chọn */}
              {currentCinemaShowtimes.length > 0 ? (
                <div>
                  <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 max-h-[180px] overflow-y-auto custom-scrollbar pr-1">
                    {currentCinemaShowtimes.map((st) => {
                      const stId = String(st.id);
                      const isSelected = selectedShowtimeId === stId;
                      const timeStr = new Date(st.startTime).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });

                      return (
                        <button
                          key={stId}
                          type="button"
                          onClick={() => handleSelectShowtime(st)}
                          className={`h-9 rounded border text-xs font-black transition-all cursor-pointer flex items-center justify-center ${
                            isSelected
                              ? 'bg-[#F7C600] text-black border-[#F7C600] shadow-[0_2px_8px_rgba(247,198,0,0.4)]'
                              : 'bg-neutral-50 hover:bg-amber-50 hover:border-[#F7C600] hover:text-black border-neutral-200 text-neutral-800'
                          }`}
                        >
                          {timeStr}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ) : (
                <div className="py-2 text-center text-xs text-neutral-500">
                  Rạp chưa có suất vào ngày này.
                </div>
              )}

              {/* Suất chiếu tại các rạp khác (Tự động hiển thị để tránh cụt đường) */}
              {otherCinemasShowtimes.length > 0 && (
                <div className="mt-3 pt-2.5 border-t border-neutral-100">
                  <span className="text-[11px] font-bold text-amber-800 block mb-1.5 flex items-center gap-1">
                    <Sparkles className="h-3 w-3 text-amber-600" />
                    <span>Có suất tại các rạp khác cùng ngày:</span>
                  </span>
                  <div className="space-y-1.5 max-h-[140px] overflow-y-auto custom-scrollbar pr-1">
                    {otherCinemasShowtimes.map((st) => {
                      const stId = String(st.id);
                      const isSelected = selectedShowtimeId === stId;
                      const timeStr = new Date(st.startTime).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
                      const cName = getCinemaName(st.cinemaId, st.cinemaName);

                      return (
                        <button
                          key={stId}
                          type="button"
                          onClick={() => handleSelectShowtime(st)}
                          className={`w-full px-2.5 py-1.5 rounded border text-xs flex items-center justify-between transition-all cursor-pointer ${
                            isSelected
                              ? 'bg-[#F7C600] text-black border-[#F7C600] font-black shadow-sm'
                              : 'bg-neutral-50 hover:bg-amber-50 hover:border-[#F7C600] border-neutral-200 text-neutral-700'
                          }`}
                        >
                          <span className="font-bold">{timeStr}</span>
                          <span className="text-[10px] text-neutral-500 font-medium truncate max-w-[170px]">
                            {cName}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

      </div>

      {/* ========================================================
          BƯỚC 5: NÚT MUA VÉ NHANH (Màu Vàng Hoàng Kim Gold Gradient chuẩn theo Web)
      ======================================================== */}
      <button
        type="button"
        onClick={handleQuickBuy}
        className="w-full md:w-auto h-12 sm:h-13 px-6 sm:px-8 bg-gradient-to-r from-[#FFDE43] via-[#F7C600] to-[#E5A800] hover:from-[#ffe35c] hover:to-[#d99b00] active:scale-[0.99] text-[#101010] font-black text-xs sm:text-sm tracking-wider flex items-center justify-center shrink-0 rounded-b-md md:rounded-b-none md:rounded-r-md transition-all shadow-[0_2px_12px_rgba(247,198,0,0.35)] cursor-pointer select-none"
      >
        Mua vé nhanh
      </button>

      {/* Nút đặt lại nhỏ khi đã chọn bất kỳ bước nào */}
      {(selectedMovieId || selectedCinemaId || selectedDate || selectedShowtimeId) && (
        <button
          type="button"
          onClick={handleResetAll}
          className="absolute -top-6 right-1 text-[10px] text-neutral-400 hover:text-[#F7C600] flex items-center gap-1 transition-colors cursor-pointer"
          title="Đặt lại các bước chọn"
        >
          <RotateCcw className="h-2.5 w-2.5" />
          <span>Đặt lại</span>
        </button>
      )}
=======
        setCinemas(raw.filter((c) => c.status === 'ACTIVE' || !c.status));
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

  // Tải suất chiếu theo ngày
  useEffect(() => {
    let cancelled = false;
    setIsLoadingShowtimes(true);
    bookingService.getShowtimes({ date: selectedDate, size: 100 })
      .then((res) => {
        if (cancelled) return;
        const raw = Array.isArray(res) ? res : (res?.data?.items ?? res?.items ?? res?.content ?? []);
        const now = new Date();
        const valid = raw.filter((st) => {
          const stTime = new Date(st.startTime);
          return stTime > now && (st.status === 'OPEN' || st.status === 'SCHEDULED');
        });
        setShowtimes(valid);
      })
      .catch(() => { if (!cancelled) setShowtimes([]); })
      .finally(() => { if (!cancelled) setIsLoadingShowtimes(false); });
    return () => { cancelled = true; };
  }, [selectedDate]);

  // Danh sách phim đang chiếu
  const availableMovies = useMemo(() => {
    return moviesList.filter((m) => m.status === 'NOW_SHOWING' || (!m.status && !m.isUpcoming));
  }, [moviesList]);

  // Danh sách 14 ngày tới
  const dateOptions = useMemo(() => {
    const dates = [];
    const base = new Date();
    for (let i = 0; i < 14; i++) {
      const d = new Date(base);
      d.setDate(base.getDate() + i);
      dates.push(toDateKey(d));
    }
    return dates;
  }, []);

  // Suất chiếu phù hợp với Phim, Rạp, Ngày đã chọn
  const filteredShowtimes = useMemo(() => {
    if (!selectedMovieId) return [];
    return showtimes.filter((st) => {
      const matchMovie = String(st.movieId) === String(selectedMovieId);
      if (!matchMovie) return false;
      if (selectedCinemaId && String(st.cinemaId || st.cinema?.id) !== String(selectedCinemaId)) {
        return false;
      }
      return true;
    }).sort((a, b) => new Date(a.startTime) - new Date(b.startTime));
  }, [showtimes, selectedMovieId, selectedCinemaId]);

  // Tự động reset showtime nếu không còn trong danh sách
  useEffect(() => {
    if (selectedShowtimeId && !filteredShowtimes.some((st) => String(st.id) === String(selectedShowtimeId))) {
      setSelectedShowtimeId('');
    }
  }, [filteredShowtimes, selectedShowtimeId]);

  const handleQuickBuy = () => {
    if (!selectedShowtimeId || !selectedMovieId) return;
    const targetMovie = moviesList.find((m) => String(m.backendId || m.id) === String(selectedMovieId));
    const movieId = targetMovie?.id || selectedMovieId;
    navigate(`/movies/${movieId}/book?showtimeId=${selectedShowtimeId}`);
  };

  return (
    <div className={`w-full bg-[#0b1120]/95 backdrop-blur-md border border-slate-700/80 rounded-2xl p-4 sm:p-5 shadow-2xl shadow-orange-950/20 text-white ${className}`}>
      {/* Top Header: Galaxy Orange Badge & Membership Perk Tip */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pb-3.5 mb-3.5 border-b border-slate-800">
        <div className="flex items-center gap-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-orange-500 text-black shadow-md shadow-orange-500/30">
            <Ticket className="h-4 w-4 stroke-[2.5]" />
          </span>
          <span className="text-sm font-black uppercase tracking-wider text-orange-400 font-sans">
            MUA VÉ NHANH
          </span>
          <span className="hidden md:inline-block text-[11px] text-slate-400 font-medium">
            | Chọn phim, rạp và giờ chiếu để đặt vé tức thì
          </span>
        </div>

        {/* Member Perk Tip (Bước 2: Tích điểm thành viên) */}
        <div className="flex items-center gap-2 text-xs">
          {isLoggedIn ? (
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 rounded-full font-medium text-[11px]">
              <Sparkles className="h-3.5 w-3.5 text-emerald-400" />
              <span>Đang tích điểm: <strong>{currentUser?.fullName || currentUser?.email}</strong></span>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => { setAuthMode('login'); setShowOTP(true); }}
              className="inline-flex items-center gap-1.5 px-3 py-1 bg-orange-500/10 hover:bg-orange-500/20 border border-orange-500/30 text-orange-300 rounded-full font-medium text-[11px] transition"
            >
              <User className="h-3 w-3 text-orange-400" />
              <span>Đăng nhập thành viên để tích điểm [S2]</span>
            </button>
          )}
        </div>
      </div>

      {/* 4 Linked Selectors & Action Button */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 items-center">
        {/* 1. Chọn Phim */}
        <div className="relative">
          <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1 flex items-center gap-1">
            <Film className="h-3 w-3 text-orange-400" /> 1. Chọn Phim
          </label>
          <div className="relative">
            <select
              value={selectedMovieId}
              onChange={(e) => {
                setSelectedMovieId(e.target.value);
                setSelectedShowtimeId('');
              }}
              className="w-full h-11 bg-slate-900/90 border border-slate-700 hover:border-orange-500/60 focus:border-orange-500 rounded-xl px-3 pr-8 text-xs font-semibold text-white focus:outline-none appearance-none transition cursor-pointer"
            >
              <option value="">-- Chọn bộ phim --</option>
              {availableMovies.map((m) => (
                <option key={m.id} value={m.backendId || m.id}>
                  {m.title} {m.ageRating ? `[${m.ageRating}]` : ''}
                </option>
              ))}
            </select>
            <ChevronDown className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          </div>
        </div>

        {/* 2. Chọn Rạp */}
        <div className="relative">
          <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1 flex items-center gap-1">
            <Building2 className="h-3 w-3 text-orange-400" /> 2. Chọn Rạp
          </label>
          <div className="relative">
            <select
              value={selectedCinemaId}
              onChange={(e) => {
                setSelectedCinemaId(e.target.value);
                setSelectedShowtimeId('');
              }}
              className="w-full h-11 bg-slate-900/90 border border-slate-700 hover:border-orange-500/60 focus:border-orange-500 rounded-xl px-3 pr-8 text-xs font-semibold text-white focus:outline-none appearance-none transition cursor-pointer"
            >
              <option value="">-- Tất cả rạp chiếu --</option>
              {cinemas.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} {c.city ? `(${c.city})` : ''}
                </option>
              ))}
            </select>
            <ChevronDown className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          </div>
        </div>

        {/* 3. Chọn Ngày */}
        <div className="relative">
          <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1 flex items-center gap-1">
            <Calendar className="h-3 w-3 text-orange-400" /> 3. Chọn Ngày
          </label>
          <div className="relative">
            <select
              value={selectedDate}
              onChange={(e) => {
                setSelectedDate(e.target.value);
                setSelectedShowtimeId('');
              }}
              className="w-full h-11 bg-slate-900/90 border border-slate-700 hover:border-orange-500/60 focus:border-orange-500 rounded-xl px-3 pr-8 text-xs font-semibold text-white focus:outline-none appearance-none transition cursor-pointer"
            >
              {dateOptions.map((date) => {
                const weekday = formatVietnameseWeekday(date);
                const parts = date.split('-');
                const display = `${weekday}, ${parts[2]}/${parts[1]}`;
                return (
                  <option key={date} value={date}>
                    {display}
                  </option>
                );
              })}
            </select>
            <ChevronDown className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          </div>
        </div>

        {/* 4. Chọn Suất Chiếu */}
        <div className="relative">
          <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1 flex items-center gap-1">
            <Clock className="h-3 w-3 text-orange-400" /> 4. Chọn Suất
          </label>
          <div className="relative">
            <select
              value={selectedShowtimeId}
              onChange={(e) => setSelectedShowtimeId(e.target.value)}
              disabled={!selectedMovieId || isLoadingShowtimes}
              className="w-full h-11 bg-slate-900/90 border border-slate-700 hover:border-orange-500/60 focus:border-orange-500 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl px-3 pr-8 text-xs font-semibold text-white focus:outline-none appearance-none transition cursor-pointer"
            >
              <option value="">
                {!selectedMovieId
                  ? 'Vui lòng chọn phim'
                  : isLoadingShowtimes
                  ? 'Đang tải suất chiếu...'
                  : filteredShowtimes.length === 0
                  ? 'Không có suất chiếu'
                  : '-- Chọn giờ chiếu --'}
              </option>
              {filteredShowtimes.map((st) => {
                const timeStr = new Date(st.startTime).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
                const roomStr = st.roomName || (st.roomId ? `P.${st.roomId}` : '');
                const cinemaStr = st.cinemaName || '';
                return (
                  <option key={st.id} value={st.id}>
                    {timeStr} - {roomStr} {cinemaStr ? `(${cinemaStr})` : ''}
                  </option>
                );
              })}
            </select>
            <ChevronDown className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          </div>
        </div>

        {/* 5. Nút Mua Vé Nhanh */}
        <div className="sm:col-span-2 lg:col-span-1 pt-1 sm:pt-4 lg:pt-3">
          <button
            type="button"
            onClick={handleQuickBuy}
            disabled={!selectedShowtimeId}
            className={`w-full h-11 rounded-xl font-extrabold text-xs uppercase tracking-wider transition-all duration-200 flex items-center justify-center gap-2 shadow-lg ${
              selectedShowtimeId
                ? 'bg-gradient-to-r from-orange-500 via-orange-600 to-amber-500 hover:from-orange-400 hover:to-amber-400 text-white shadow-orange-500/30 hover:scale-[1.02] cursor-pointer'
                : 'bg-slate-800 text-slate-500 border border-slate-700/60 cursor-not-allowed'
            }`}
          >
            <span>MUA VÉ NHANH</span>
            <ArrowRight className="h-4 w-4 stroke-[2.5]" />
          </button>
        </div>
      </div>
>>>>>>> 994357b939ca99abf48e6008d0d9cb6c51892055
    </div>
  );
}
