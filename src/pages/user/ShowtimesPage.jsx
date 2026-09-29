import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Film, Calendar, CalendarDays, Clock, Building2, MapPin, Phone, ExternalLink,
  Search, Tag, Users, CheckCircle2, ArrowRight, ChevronRight, Sparkles,
  Ticket, Check, ChevronDown, X, ShieldCheck, Loader2, Armchair, Info,
  CalendarX, Compass, AlertCircle, RefreshCw, Star, Layers, Map as MapIcon
} from 'lucide-react';
import { bookingService } from '../../services/bookingService';
import { movieService } from '../../services/movieService';
import { useMovies } from '../../stores/useMovieStore';
import { useAuthStore } from '../../stores/useAuthStore';
import { useUiStore } from '../../stores/useUiStore';
import QuickBookingBar from '../../components/common/QuickBookingBar';

// Tiện ích format ngày chuẩn địa phương (YYYY-MM-DD)
const toDateKey = (date) => {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
};

const parseLocalDate = (dateStr) => {
  if (!dateStr) return new Date();
  const parts = String(dateStr).split('-');
  if (parts.length === 3) {
    const [y, m, d] = parts.map(Number);
    return new Date(y, m - 1, d);
  }
  return new Date(dateStr);
};

const formatVietnameseWeekday = (dateStr) => {
  try {
    const d = parseLocalDate(dateStr);
    const today = new Date();
    if (toDateKey(d) === toDateKey(today)) return 'HÔM NAY';
    const tomorrow = new Date();
    tomorrow.setDate(today.getDate() + 1);
    if (toDateKey(d) === toDateKey(tomorrow)) return 'NGÀY MAI';
    const days = ['CHỦ NHẬT', 'THỨ HAI', 'THỨ BA', 'THỨ TƯ', 'THỨ NĂM', 'THỨ SÁU', 'THỨ BẢY'];
    return days[d.getDay()] || 'HÔM NAY';
  } catch {
    return 'HÔM NAY';
  }
};

const formatVietnameseDayMonth = (dateStr) => {
  try {
    const d = parseLocalDate(dateStr);
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    return `${day}/${month}`;
  } catch {
    return dateStr;
  }
};

const formatFullDateVi = (dateStr) => {
  if (!dateStr) return '';
  try {
    const d = parseLocalDate(dateStr);
    const days = ['Chủ Nhật', 'Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy'];
    const weekday = days[d.getDay()] || '';
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    return `${weekday}, ngày ${day}/${month}/${year}`;
  } catch {
    return dateStr;
  }
};

const formatVnd = (value) => {
  const num = Number(value || 0);
  return `${num.toLocaleString('vi-VN')}đ`;
};

const AGE_RATING_BADGE = {
  P: { bg: 'bg-emerald-500/15 border-emerald-500/40 text-emerald-400', label: 'P - Mọi độ tuổi' },
  K: { bg: 'bg-sky-500/15 border-sky-500/40 text-sky-400', label: 'K - Dưới 13 có phụ huynh' },
  T13: { bg: 'bg-amber-500/15 border-amber-500/40 text-amber-400', label: 'T13 - Khán giả từ 13 tuổi' },
  T16: { bg: 'bg-orange-500/15 border-orange-500/40 text-orange-400', label: 'T16 - Khán giả từ 16 tuổi' },
  T18: { bg: 'bg-rose-500/15 border-rose-500/40 text-rose-400', label: 'T18 - Khán giả từ 18 tuổi' },
  C: { bg: 'bg-red-500/15 border-red-500/40 text-red-400', label: 'C - Phim cấm phổ biến' },
};

export default function ShowtimesPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { moviesList = [] } = useMovies();
  const isLoggedIn = useAuthStore((state) => state.isLoggedIn);
  const currentUser = useAuthStore((state) => state.currentUser);
  const setShowOTP = useUiStore((state) => state.setShowOTP);
  const setAuthMode = useUiStore((state) => state.setAuthMode);

  // Chế độ xem: 'movie' (Theo phim - Mặc định), 'cinema' (Theo rạp), 'date' (Theo ngày)
  const initialMode = searchParams.get('mode') || (searchParams.get('cinemaId') ? 'cinema' : 'movie');
  const [viewMode, setViewMode] = useState(initialMode);

  // Ngày được chọn
  const todayKey = toDateKey(new Date());
  const initialDate = searchParams.get('date') || todayKey;
  const [selectedDate, setSelectedDate] = useState(initialDate);

  // Phim được chọn (Bước 1 của luồng Theo Phim)
  const [selectedMovieId, setSelectedMovieId] = useState(() => {
    return searchParams.get('movieId') || '';
  });

  // Rạp được chọn (Bước 3 hoặc Tab Theo Rạp)
  const [selectedCinemaId, setSelectedCinemaId] = useState(() => {
    return searchParams.get('cinemaId') || '';
  });

  // Bộ lọc khu vực / thành phố
  const [selectedCity, setSelectedCity] = useState('ALL');

  // Khung giờ lọc: 'ALL', 'MORNING' (<12:00), 'AFTERNOON' (12:00-18:00), 'EVENING' (>18:00)
  const [timeFilter, setTimeFilter] = useState('ALL');

  // Dữ liệu rạp và suất chiếu
  const [cinemas, setCinemas] = useState([]);
  const [showtimes, setShowtimes] = useState([]);
  const [isLoadingShowtimes, setIsLoadingShowtimes] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [movieSearchQuery, setMovieSearchQuery] = useState('');

  // Tải danh sách rạp
  useEffect(() => {
    let cancelled = false;
    movieService.getPublicCinemas()
      .then((res) => {
        if (cancelled) return;
        const raw = Array.isArray(res) ? res : (res?.data || []);
        const active = raw.filter((c) => c.status === 'ACTIVE' || !c.status);
        setCinemas(active);
        // Pre-select first cinema if in cinema mode and none selected
        if (active.length > 0 && !selectedCinemaId && viewMode === 'cinema') {
          setSelectedCinemaId(String(active[0].id));
        }
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [viewMode, selectedCinemaId]);

  // Tải danh sách suất chiếu khi ngày đổi
  const fetchShowtimes = async (silent = false) => {
    if (!silent) setIsLoadingShowtimes(true);
    else setIsRefreshing(true);
    try {
      const res = await bookingService.getShowtimes({ date: selectedDate, size: 200 });
      const raw = Array.isArray(res) ? res : (res?.data?.items ?? res?.items ?? res?.content ?? []);
      const now = new Date();
      // Lọc các suất chiếu hợp lệ (chưa qua giờ hoặc trong ngày)
      const valid = raw.filter((st) => {
        if (!st.startTime) return false;
        const stTime = new Date(st.startTime);
        return stTime > now && (st.status === 'OPEN' || st.status === 'SCHEDULED');
      });
      setShowtimes(valid);
    } catch (err) {
      console.error('Failed to load showtimes:', err);
      setShowtimes([]);
    } finally {
      setIsLoadingShowtimes(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    fetchShowtimes();
  }, [selectedDate]);

  // Danh sách các ngày trong 14 ngày tới
  const upcomingDates = useMemo(() => {
    const dates = [];
    const base = new Date();
    for (let i = 0; i < 14; i++) {
      const d = new Date(base);
      d.setDate(base.getDate() + i);
      dates.push(toDateKey(d));
    }
    return dates;
  }, []);

  // Danh sách các thành phố khả dụng
  const cities = useMemo(() => {
    const set = new Set();
    cinemas.forEach((c) => {
      if (c.city) set.add(c.city.trim());
    });
    return Array.from(set);
  }, [cinemas]);

  // Danh sách phim đang chiếu
  const availableMovies = useMemo(() => {
    return moviesList.filter((m) => m.status === 'NOW_SHOWING' || (!m.status && !m.isUpcoming));
  }, [moviesList]);

  // Phim được chọn tự động nếu chưa có
  useEffect(() => {
    if (!selectedMovieId && availableMovies.length > 0) {
      setSelectedMovieId(String(availableMovies[0].backendId || availableMovies[0].id));
    }
  }, [availableMovies, selectedMovieId]);

  // Chi tiết bộ phim đang chọn
  const currentSelectedMovie = useMemo(() => {
    if (!selectedMovieId) return availableMovies[0] || null;
    return availableMovies.find((m) => String(m.backendId || m.id) === String(selectedMovieId)) || availableMovies[0] || null;
  }, [availableMovies, selectedMovieId]);

  // Lọc phim theo tìm kiếm
  const searchedMovies = useMemo(() => {
    if (!movieSearchQuery.trim()) return availableMovies;
    const q = movieSearchQuery.trim().toLowerCase();
    return availableMovies.filter((m) =>
      (m.title || '').toLowerCase().includes(q) ||
      (m.englishTitle || '').toLowerCase().includes(q) ||
      (m.director || '').toLowerCase().includes(q)
    );
  }, [availableMovies, movieSearchQuery]);

  // Lọc suất chiếu theo khung giờ (Sáng / Chiều / Tối)
  const isTimeInFilter = (st) => {
    if (timeFilter === 'ALL') return true;
    try {
      const hours = new Date(st.startTime).getHours();
      if (timeFilter === 'MORNING') return hours < 12;
      if (timeFilter === 'AFTERNOON') return hours >= 12 && hours < 18;
      if (timeFilter === 'EVENING') return hours >= 18;
    } catch {
      return true;
    }
    return true;
  };

  // Gom nhóm suất chiếu cho BƯỚC 3 & 4 (Theo phim đã chọn)
  // Kết quả: Danh sách rạp có chiếu phim này, mỗi rạp chứa các định dạng phòng (2D, 3D, IMAX) và danh sách suất chiếu
  const cinemasWithShowtimesForSelectedMovie = useMemo(() => {
    if (!currentSelectedMovie) return [];
    const targetMovieId = String(currentSelectedMovie.backendId || currentSelectedMovie.id);

    // Suất chiếu của phim này
    const movieShowtimes = showtimes.filter((st) => {
      const matchMovie = String(st.movieId) === targetMovieId;
      if (!matchMovie) return false;
      return isTimeInFilter(st);
    });

    // Lọc theo cụm rạp và thành phố
    let targetCinemas = cinemas;
    if (selectedCity !== 'ALL') {
      targetCinemas = targetCinemas.filter((c) => c.city === selectedCity);
    }
    if (selectedCinemaId) {
      targetCinemas = targetCinemas.filter((c) => String(c.id) === String(selectedCinemaId));
    }

    return targetCinemas.map((cinema) => {
      const cinemaShowtimes = movieShowtimes.filter((st) => {
        const cId = String(st.cinemaId || st.cinema?.id || '');
        return cId === String(cinema.id);
      }).sort((a, b) => new Date(a.startTime) - new Date(b.startTime));

      // Phân nhóm theo định dạng phòng chiếu (Format/RoomType)
      const formatGroups = {};
      cinemaShowtimes.forEach((st) => {
        let fmt = st.format || '2D';
        const roomNameLower = (st.roomName || '').toLowerCase();
        if (roomNameLower.includes('imax')) fmt = 'IMAX Laser 2D';
        else if (roomNameLower.includes('vip')) fmt = '2D VIP Lounge';
        else if (roomNameLower.includes('3d')) fmt = '3D Kỹ Thuật Số';
        else if (fmt === '2D') fmt = '2D Phụ Đề';

        if (!formatGroups[fmt]) {
          formatGroups[fmt] = [];
        }
        formatGroups[fmt].push(st);
      });

      return {
        cinema,
        showtimes: cinemaShowtimes,
        formatGroups,
        hasShowtimes: cinemaShowtimes.length > 0,
      };
    });
  }, [currentSelectedMovie, showtimes, cinemas, selectedCity, selectedCinemaId, timeFilter]);

  // Gom nhóm suất chiếu cho TAB "THEO RẠP"
  // Kết quả: Rạp đã chọn -> Các phim đang chiếu tại rạp này -> Các suất chiếu của từng phim
  const selectedCinemaData = useMemo(() => {
    if (!selectedCinemaId) return cinemas[0] || null;
    return cinemas.find((c) => String(c.id) === String(selectedCinemaId)) || cinemas[0] || null;
  }, [cinemas, selectedCinemaId]);

  const moviesForSelectedCinema = useMemo(() => {
    if (!selectedCinemaData) return [];
    const cinemaShowtimes = showtimes.filter((st) => {
      const cId = String(st.cinemaId || st.cinema?.id || '');
      const matchCinema = cId === String(selectedCinemaData.id);
      if (!matchCinema) return false;
      return isTimeInFilter(st);
    });

    // Gom theo phim
    const movieMap = new Map();
    cinemaShowtimes.forEach((st) => {
      const mId = String(st.movieId);
      if (!movieMap.has(mId)) {
        const fullMovie = moviesList.find((m) => String(m.backendId || m.id) === mId) || {
          id: st.movieId,
          title: st.movieTitle || 'Phim đang cập nhật',
          ageRating: st.movieAgeRating || 'P',
          durationMinutes: 120,
        };
        movieMap.set(mId, {
          movie: fullMovie,
          showtimes: [],
        });
      }
      movieMap.get(mId).showtimes.push(st);
    });

    return Array.from(movieMap.values()).map((item) => {
      item.showtimes.sort((a, b) => new Date(a.startTime) - new Date(b.startTime));
      return item;
    });
  }, [selectedCinemaData, showtimes, moviesList, timeFilter]);

  // Điều hướng đặt vé
  const handleSelectShowtime = (st, movie) => {
    const movieId = movie?.id || st.movieId || (currentSelectedMovie ? currentSelectedMovie.id : '');
    navigate(`/movies/${movieId}/book?showtimeId=${st.id}`);
  };

  return (
    <div className="min-h-screen bg-[#070b14] text-white selection:bg-orange-500 selection:text-white pb-28">
      {/* 1. TOP HEADER & GALAXY HERO BANNER */}
      <div className="relative border-b border-slate-800 bg-gradient-to-b from-[#0b1120] to-[#070b14] pt-8 pb-10">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          {/* Header Title */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-orange-500/10 border border-orange-500/30 text-orange-400 text-xs font-bold uppercase tracking-wider mb-2">
                <Sparkles className="h-3.5 w-3.5" />
                <span>Hệ Thống Rạp Chiếu Phim Hiện Đại Chuẩn Galaxy</span>
              </div>
              <h1 className="text-2xl sm:text-4xl font-black uppercase tracking-tight text-white flex items-center gap-3">
                <span>LỊCH CHIẾU PHIM</span>
                <span className="text-orange-500 font-mono text-xl sm:text-2xl">&bull;</span>
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-orange-400 to-amber-300">
                  CINEPREMIER
                </span>
              </h1>
              <p className="mt-1.5 text-xs sm:text-sm text-slate-400">
                Trải nghiệm rạp chiếu đẳng cấp: IMAX Laser, âm thanh Dolby Atmos, ghế đôi Sweetbox và bắp nước hảo hạng.
              </p>
            </div>

            {/* Loyalty point badge / Member perk */}
            <div className="shrink-0 flex items-center gap-3">
              {isLoggedIn ? (
                <div className="px-4 py-2 rounded-xl bg-slate-900/90 border border-slate-700 flex items-center gap-2 text-xs">
                  <div className="w-7 h-7 rounded-lg bg-orange-500/20 text-orange-400 flex items-center justify-center font-bold">
                    ★
                  </div>
                  <div>
                    <div className="text-[10px] text-slate-400 uppercase font-semibold">Thành viên CineClub</div>
                    <div className="font-bold text-orange-300">{currentUser?.fullName || currentUser?.email}</div>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => { setAuthMode('login'); setShowOTP(true); }}
                  className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-400 hover:to-amber-400 text-black font-extrabold text-xs uppercase tracking-wider shadow-lg shadow-orange-500/20 transition flex items-center gap-2"
                >
                  <Users className="h-4 w-4" />
                  <span>Đăng nhập tích điểm [S2]</span>
                </button>
              )}
            </div>
          </div>

          {/* QUICK BOOKING BAR (Galaxy Cinema Signature Feature) */}
          <div className="mt-4">
            <QuickBookingBar />
          </div>
        </div>
      </div>

      {/* 2. MAIN WORKSPACE CONTAINER */}
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 pt-8 space-y-8">
        
        {/* STEPPER NAVIGATOR: 4 BƯỚC MUA VÉ CHUẨN KHÁCH HÀNG */}
        <div className="bg-[#0f172a]/70 border border-slate-800 rounded-2xl p-4 sm:p-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800/80 pb-3 mb-4">
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-orange-500 animate-ping" />
              <span className="text-xs font-black uppercase tracking-wider text-slate-300">
                QUY TRÌNH MUA VÉ KHÁCH HÀNG (CUSTOMER JOURNEY)
              </span>
            </div>

            {/* 3 Main View Tabs (Theo Phim | Theo Rạp | Theo Ngày) */}
            <div className="inline-flex rounded-xl bg-slate-900 p-1 border border-slate-800">
              <button
                type="button"
                onClick={() => setViewMode('movie')}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-all ${
                  viewMode === 'movie'
                    ? 'bg-gradient-to-r from-orange-500 to-amber-500 text-black shadow-md shadow-orange-500/30'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                🎬 Theo Phim
              </button>
              <button
                type="button"
                onClick={() => setViewMode('cinema')}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-all ${
                  viewMode === 'cinema'
                    ? 'bg-gradient-to-r from-orange-500 to-amber-500 text-black shadow-md shadow-orange-500/30'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                🏛️ Theo Rạp
              </button>
              <button
                type="button"
                onClick={() => setViewMode('date')}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-all ${
                  viewMode === 'date'
                    ? 'bg-gradient-to-r from-orange-500 to-amber-500 text-black shadow-md shadow-orange-500/30'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                📅 Theo Ngày
              </button>
            </div>
          </div>

          {/* Sequential 4 Steps Indicator */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5 text-xs font-semibold">
            <div className={`flex items-center gap-2.5 p-2.5 rounded-xl border transition ${
              viewMode === 'movie' ? 'bg-orange-500/10 border-orange-500/40 text-orange-300' : 'bg-slate-900/60 border-slate-800 text-slate-400'
            }`}>
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-orange-500 text-black font-black text-xs">1</span>
              <div>
                <div className="text-[10px] text-slate-400 uppercase font-medium">Bước 1</div>
                <div className="font-bold">Chọn Phim</div>
              </div>
            </div>

            <div className={`flex items-center gap-2.5 p-2.5 rounded-xl border transition ${
              selectedDate ? 'bg-orange-500/10 border-orange-500/40 text-orange-300' : 'bg-slate-900/60 border-slate-800 text-slate-400'
            }`}>
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-orange-500 text-black font-black text-xs">2</span>
              <div>
                <div className="text-[10px] text-slate-400 uppercase font-medium">Bước 2</div>
                <div className="font-bold">Chọn Thời Gian</div>
              </div>
            </div>

            <div className={`flex items-center gap-2.5 p-2.5 rounded-xl border transition ${
              selectedCinemaId || viewMode === 'cinema' ? 'bg-orange-500/10 border-orange-500/40 text-orange-300' : 'bg-slate-900/60 border-slate-800 text-slate-400'
            }`}>
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-orange-500 text-black font-black text-xs">3</span>
              <div>
                <div className="text-[10px] text-slate-400 uppercase font-medium">Bước 3</div>
                <div className="font-bold">Chọn Cụm Rạp</div>
              </div>
            </div>

            <div className="flex items-center gap-2.5 p-2.5 rounded-xl border bg-slate-900/60 border-slate-800 text-slate-400">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-slate-800 text-slate-300 font-black text-xs">4</span>
              <div>
                <div className="text-[10px] text-slate-400 uppercase font-medium">Bước 4</div>
                <div className="font-bold">Mua Vé & Ghế</div>
              </div>
            </div>
          </div>
        </div>

        {/* =========================================================================
            CHẾ ĐỘ 1: THEO PHIM (MẶC ĐỊNH - LUỒNG TUẦN TỰ ĐẦY ĐỦ 4 BƯỚC)
           ========================================================================= */}
        {viewMode === 'movie' && (
          <div className="space-y-8">
            {/* BƯỚC 1: CHỌN PHIM */}
            <section className="bg-[#0f172a]/60 border border-slate-800 rounded-2xl p-5 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-orange-500 text-black font-black text-xs">
                    1
                  </span>
                  <div>
                    <h2 className="text-base font-black uppercase tracking-wide text-white flex items-center gap-2">
                      <span>BƯỚC 1: CHỌN PHIM ĐANG CHIẾU</span>
                      <span className="text-xs text-orange-400 font-normal">({availableMovies.length} phim)</span>
                    </h2>
                    <p className="text-xs text-slate-400">Chọn bộ phim bạn muốn xem để hiển thị lịch chiếu chi tiết</p>
                  </div>
                </div>

                {/* Movie search input */}
                <div className="relative w-full sm:w-64">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                  <input
                    type="text"
                    value={movieSearchQuery}
                    onChange={(e) => setMovieSearchQuery(e.target.value)}
                    placeholder="Tìm tên phim, diễn viên..."
                    className="w-full h-9 bg-slate-900 border border-slate-700 hover:border-slate-600 focus:border-orange-500 rounded-xl pl-9 pr-3 text-xs text-white placeholder-slate-500 focus:outline-none transition"
                  />
                  {movieSearchQuery && (
                    <button
                      type="button"
                      onClick={() => setMovieSearchQuery('')}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              </div>

              {/* Movie Cards Carousel / Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3.5 pt-2">
                {searchedMovies.map((movie) => {
                  const mId = String(movie.backendId || movie.id);
                  const isSelected = String(selectedMovieId) === mId;
                  const ageBadge = AGE_RATING_BADGE[movie.ageRating] || AGE_RATING_BADGE.P;

                  return (
                    <div
                      key={movie.id}
                      onClick={() => setSelectedMovieId(mId)}
                      className={`group relative cursor-pointer rounded-xl overflow-hidden border transition-all duration-300 flex flex-col ${
                        isSelected
                          ? 'border-orange-500 bg-orange-950/20 shadow-xl shadow-orange-500/20 ring-2 ring-orange-500 scale-[1.02]'
                          : 'border-slate-800 bg-slate-900/80 hover:border-slate-700 hover:bg-slate-900'
                      }`}
                    >
                      {/* Poster Image */}
                      <div className="relative aspect-[2/3] w-full overflow-hidden bg-slate-950">
                        {movie.posterUrl ? (
                          <img
                            src={movie.posterUrl}
                            alt={movie.title}
                            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                            loading="lazy"
                          />
                        ) : (
                          <div className="h-full w-full flex items-center justify-center text-slate-600">
                            <Film className="h-10 w-10" />
                          </div>
                        )}

                        {/* Top Badges */}
                        <div className="absolute top-2 left-2 flex flex-col gap-1 z-10">
                          {movie.ageRating && (
                            <span className={`text-[9px] font-extrabold px-1.5 py-0.5 rounded border backdrop-blur-md ${ageBadge.bg}`}>
                              {movie.ageRating}
                            </span>
                          )}
                        </div>

                        {/* Selected Indicator */}
                        {isSelected && (
                          <div className="absolute inset-0 bg-orange-500/20 flex items-center justify-center">
                            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-orange-500 text-black shadow-lg">
                              <Check className="h-6 w-6 stroke-[3]" />
                            </span>
                          </div>
                        )}
                      </div>

                      {/* Movie Info */}
                      <div className="p-2.5 flex-1 flex flex-col justify-between">
                        <div>
                          <h3 className={`text-xs font-extrabold line-clamp-1 group-hover:text-orange-400 transition ${
                            isSelected ? 'text-orange-400' : 'text-white'
                          }`}>
                            {movie.title}
                          </h3>
                          <p className="text-[10px] text-slate-400 line-clamp-1 mt-0.5">
                            {Array.isArray(movie.genre) ? movie.genre.join(', ') : (movie.genre || 'Hành động')}
                          </p>
                        </div>
                        <div className="flex items-center justify-between text-[10px] text-slate-500 mt-2 pt-1 border-t border-slate-800">
                          <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3 text-slate-400" />
                            {movie.durationMinutes || 120}p
                          </span>
                          {isSelected && (
                            <span className="text-orange-400 font-bold uppercase text-[9px]">Đang chọn</span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Selected Movie Banner Detail (Hiện sau khi chọn phim) */}
              {currentSelectedMovie && (
                <div className="mt-4 p-4 rounded-xl bg-slate-900/90 border border-slate-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                  <div className="flex items-center gap-3.5">
                    {currentSelectedMovie.posterUrl && (
                      <img
                        src={currentSelectedMovie.posterUrl}
                        alt=""
                        className="h-14 w-10 object-cover rounded-lg border border-slate-700 shrink-0"
                      />
                    )}
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-black text-white uppercase">{currentSelectedMovie.title}</span>
                        {currentSelectedMovie.ageRating && (
                          <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-orange-500/20 text-orange-400 border border-orange-500/40">
                            {currentSelectedMovie.ageRating}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-400 mt-0.5 line-clamp-1">
                        {currentSelectedMovie.description || 'Trải nghiệm đỉnh cao công nghệ rạp chiếu cùng dàn âm thanh sống động.'}
                      </p>
                      <div className="flex items-center gap-3 text-[11px] text-slate-400 mt-1">
                        <span>Đạo diễn: <strong className="text-slate-300">{currentSelectedMovie.director || 'Đang cập nhật'}</strong></span>
                        <span>•</span>
                        <span>Thời lượng: <strong className="text-slate-300">{currentSelectedMovie.durationMinutes || 120} phút</strong></span>
                      </div>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => navigate(`/movies/${currentSelectedMovie.id}`)}
                    className="shrink-0 text-xs font-bold text-orange-400 hover:text-orange-300 flex items-center gap-1 border border-orange-500/30 hover:border-orange-500/60 bg-orange-500/10 px-3 py-1.5 rounded-lg transition"
                  >
                    <span>Xem Trailer & Chi tiết phim</span>
                    <ChevronRight className="h-3.5 w-3.5" />
                  </button>
                </div>
              )}
            </section>

            {/* BƯỚC 2: CHỌN THỜI GIAN (NGÀY & KHUNG GIỜ) */}
            <section className="bg-[#0f172a]/60 border border-slate-800 rounded-2xl p-5 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-orange-500 text-black font-black text-xs">
                    2
                  </span>
                  <div>
                    <h2 className="text-base font-black uppercase tracking-wide text-white flex items-center gap-2">
                      <span>BƯỚC 2: CHỌN NGÀY & KHUNG GIỜ XEM</span>
                      <span className="text-xs text-orange-400 font-normal">({formatFullDateVi(selectedDate)})</span>
                    </h2>
                    <p className="text-xs text-slate-400">Chọn ngày bạn muốn thưởng thức phim</p>
                  </div>
                </div>

                {/* Filter Time of Day (Sáng / Chiều / Tối) */}
                <div className="flex items-center gap-1.5 bg-slate-900 p-1 rounded-xl border border-slate-800 text-xs">
                  <button
                    type="button"
                    onClick={() => setTimeFilter('ALL')}
                    className={`px-2.5 py-1 rounded-lg font-bold transition ${timeFilter === 'ALL' ? 'bg-orange-500 text-black' : 'text-slate-400 hover:text-white'}`}
                  >
                    Tất cả
                  </button>
                  <button
                    type="button"
                    onClick={() => setTimeFilter('MORNING')}
                    className={`px-2.5 py-1 rounded-lg font-bold transition ${timeFilter === 'MORNING' ? 'bg-orange-500 text-black' : 'text-slate-400 hover:text-white'}`}
                  >
                    Sáng (&lt;12h)
                  </button>
                  <button
                    type="button"
                    onClick={() => setTimeFilter('AFTERNOON')}
                    className={`px-2.5 py-1 rounded-lg font-bold transition ${timeFilter === 'AFTERNOON' ? 'bg-orange-500 text-black' : 'text-slate-400 hover:text-white'}`}
                  >
                    Chiều (12-18h)
                  </button>
                  <button
                    type="button"
                    onClick={() => setTimeFilter('EVENING')}
                    className={`px-2.5 py-1 rounded-lg font-bold transition ${timeFilter === 'EVENING' ? 'bg-orange-500 text-black' : 'text-slate-400 hover:text-white'}`}
                  >
                    Tối (&gt;18h)
                  </button>
                </div>
              </div>

              {/* Horizontal Scrolling Date Pills (Galaxy Cinema style) */}
              <div className="flex gap-2.5 overflow-x-auto pb-2 pt-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                {upcomingDates.map((dateStr) => {
                  const isSelected = selectedDate === dateStr;
                  const weekday = formatVietnameseWeekday(dateStr);
                  const dayMonth = formatVietnameseDayMonth(dateStr);

                  return (
                    <button
                      key={dateStr}
                      type="button"
                      onClick={() => setSelectedDate(dateStr)}
                      className={`shrink-0 flex flex-col items-center justify-center min-w-[92px] py-2.5 px-3 rounded-xl border transition-all duration-200 cursor-pointer ${
                        isSelected
                          ? 'bg-gradient-to-b from-orange-500 to-orange-600 border-orange-400 text-white shadow-lg shadow-orange-500/30 scale-105'
                          : 'bg-slate-900 border-slate-800 text-slate-300 hover:border-slate-700 hover:bg-slate-850'
                      }`}
                    >
                      <span className={`text-[10px] font-extrabold uppercase tracking-wider ${
                        isSelected ? 'text-black/80' : 'text-slate-400'
                      }`}>
                        {weekday}
                      </span>
                      <span className="text-base font-black tracking-tight mt-0.5">
                        {dayMonth}
                      </span>
                    </button>
                  );
                })}
              </div>
            </section>

            {/* BƯỚC 3 & 4: CHỌN RẠP CHIẾU (SETUP MỚI ĐẶC BIỆT) & CHỌN SUẤT MUA VÉ */}
            <section className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-[#0f172a]/60 border border-slate-800 rounded-2xl p-5">
                <div className="flex items-center gap-2">
                  <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-orange-500 text-black font-black text-xs">
                    3
                  </span>
                  <div>
                    <h2 className="text-base font-black uppercase tracking-wide text-white flex items-center gap-2">
                      <span>BƯỚC 3 & 4: CHỌN CỤM RẠP & SUẤT CHIẾU</span>
                    </h2>
                    <p className="text-xs text-slate-400">
                      Chọn rạp gần bạn nhất và nhấp vào khung giờ phù hợp để tiến hành chọn ghế & mua vé
                    </p>
                  </div>
                </div>

                {/* City Filter & Cinema Filter */}
                <div className="flex flex-wrap items-center gap-2">
                  {/* City Dropdown */}
                  <div className="relative">
                    <select
                      value={selectedCity}
                      onChange={(e) => setSelectedCity(e.target.value)}
                      className="h-9 bg-slate-900 border border-slate-700 hover:border-orange-500/60 focus:border-orange-500 rounded-xl px-3 pr-8 text-xs font-semibold text-white focus:outline-none appearance-none transition cursor-pointer"
                    >
                      <option value="ALL">Toàn Quốc (Tất cả khu vực)</option>
                      {cities.map((city) => (
                        <option key={city} value={city}>{city}</option>
                      ))}
                    </select>
                    <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                  </div>

                  {/* Cinema Dropdown */}
                  <div className="relative">
                    <select
                      value={selectedCinemaId}
                      onChange={(e) => setSelectedCinemaId(e.target.value)}
                      className="h-9 bg-slate-900 border border-slate-700 hover:border-orange-500/60 focus:border-orange-500 rounded-xl px-3 pr-8 text-xs font-semibold text-white focus:outline-none appearance-none transition cursor-pointer"
                    >
                      <option value="">Tất cả cụm rạp</option>
                      {cinemas
                        .filter((c) => selectedCity === 'ALL' || c.city === selectedCity)
                        .map((c) => (
                          <option key={c.id} value={c.id}>{c.name}</option>
                        ))}
                    </select>
                    <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                  </div>

                  {/* Refresh Button */}
                  <button
                    type="button"
                    onClick={() => fetchShowtimes(true)}
                    disabled={isRefreshing}
                    className="h-9 w-9 flex items-center justify-center rounded-xl bg-slate-900 border border-slate-700 text-slate-400 hover:text-white transition disabled:opacity-50"
                    title="Làm mới suất chiếu"
                  >
                    <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin text-orange-400' : ''}`} />
                  </button>
                </div>
              </div>

              {/* LIST OF CINEMAS (SETUP MỚI THEO YÊU CẦU: Trực quan, đầy đủ thông tin rạp và suất chiếu) */}
              {isLoadingShowtimes ? (
                <div className="py-16 text-center space-y-3 bg-[#0f172a]/30 border border-slate-800 rounded-2xl">
                  <Loader2 className="h-8 w-8 text-orange-500 animate-spin mx-auto" />
                  <p className="text-xs text-slate-400 font-semibold uppercase tracking-wider">Đang cập nhật lịch chiếu từ hệ thống...</p>
                </div>
              ) : cinemasWithShowtimesForSelectedMovie.length === 0 ? (
                <div className="py-16 text-center space-y-3 bg-[#0f172a]/30 border border-slate-800 rounded-2xl">
                  <CalendarX className="h-10 w-10 text-slate-600 mx-auto" />
                  <h3 className="text-sm font-bold text-white uppercase">Chưa có lịch chiếu trong ngày này</h3>
                  <p className="text-xs text-slate-400 max-w-md mx-auto">
                    Vui lòng chọn ngày chiếu khác hoặc chuyển sang cụm rạp khác để tìm suất chiếu phù hợp.
                  </p>
                </div>
              ) : (
                <div className="space-y-5">
                  {cinemasWithShowtimesForSelectedMovie.map(({ cinema, showtimes: cinemaShowtimes, formatGroups, hasShowtimes }) => {
                    const googleMapsUrl = cinema.address
                      ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${cinema.name} ${cinema.address}`)}`
                      : 'https://www.google.com/maps';

                    return (
                      <div
                        key={cinema.id}
                        className={`rounded-2xl border transition-all duration-300 overflow-hidden ${
                          hasShowtimes
                            ? 'bg-[#0f172a]/80 border-slate-700/80 shadow-xl shadow-black/40'
                            : 'bg-[#0f172a]/40 border-slate-800/60 opacity-60'
                        }`}
                      >
                        {/* KHỐI THÔNG TIN RẠP CHIẾU (SETUP MỚI: Thiết kế thẻ rạp sang trọng, rõ ràng) */}
                        <div className="p-5 border-b border-slate-800/80 bg-gradient-to-r from-slate-900/90 via-slate-900/50 to-transparent">
                          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                            <div className="space-y-1.5">
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-orange-500/20 text-orange-400">
                                  <Building2 className="h-3.5 w-3.5" />
                                </span>
                                <h3 className="text-base font-black text-white uppercase tracking-wide">
                                  {cinema.name}
                                </h3>
                                {cinema.city && (
                                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-800 border border-slate-700 text-slate-300">
                                    {cinema.city}
                                  </span>
                                )}
                                {hasShowtimes ? (
                                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 flex items-center gap-1">
                                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                                    {cinemaShowtimes.length} suất chiếu
                                  </span>
                                ) : (
                                  <span className="text-[10px] font-semibold text-slate-500">Chưa có suất</span>
                                )}
                              </div>

                              {/* Cinema Address & Hotline */}
                              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-400">
                                <div className="flex items-center gap-1.5">
                                  <MapPin className="h-3.5 w-3.5 text-orange-400 shrink-0" />
                                  <span>{cinema.address || 'Đang cập nhật địa chỉ'}</span>
                                </div>
                                {cinema.phone && (
                                  <div className="flex items-center gap-1.5">
                                    <Phone className="h-3 w-3 text-slate-500 shrink-0" />
                                    <span>Hotline: <strong className="text-slate-300">{cinema.phone}</strong></span>
                                  </div>
                                )}
                              </div>

                              {/* Cinema Amenities Badges */}
                              <div className="flex flex-wrap items-center gap-1.5 pt-1">
                                <span className="text-[10px] font-medium px-2 py-0.5 rounded bg-slate-800/80 text-slate-400 border border-slate-700/60">
                                  Dolby Atmos Sound
                                </span>
                                <span className="text-[10px] font-medium px-2 py-0.5 rounded bg-slate-800/80 text-slate-400 border border-slate-700/60">
                                  Ghế Sweetbox Đôi
                                </span>
                                <span className="text-[10px] font-medium px-2 py-0.5 rounded bg-slate-800/80 text-slate-400 border border-slate-700/60">
                                  Phòng Chiếu Tiêu Chuẩn 4K
                                </span>
                                <span className="text-[10px] font-medium px-2 py-0.5 rounded bg-slate-800/80 text-slate-400 border border-slate-700/60">
                                  Bắp Rang Bơ Độc Quyền
                                </span>
                              </div>
                            </div>

                            {/* Action: Google Map */}
                            <div className="shrink-0 flex items-center gap-2">
                              <a
                                href={googleMapsUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800/80 hover:bg-slate-750 border border-slate-700 text-xs font-semibold text-slate-300 hover:text-white transition"
                              >
                                <MapIcon className="h-3.5 w-3.5 text-orange-400" />
                                <span>Chỉ đường</span>
                                <ExternalLink className="h-3 w-3 text-slate-500" />
                              </a>
                            </div>
                          </div>
                        </div>

                        {/* DANH SÁCH SUẤT CHIẾU THEO ĐỊNH DẠNG (BƯỚC 4: MUA VÉ) */}
                        <div className="p-5">
                          {!hasShowtimes ? (
                            <p className="text-xs text-slate-500 italic">
                              Hôm nay không có suất chiếu của phim này tại {cinema.name}. Vui lòng chọn ngày hoặc rạp khác.
                            </p>
                          ) : (
                            <div className="space-y-4">
                              {Object.entries(formatGroups).map(([formatName, groupShowtimes]) => (
                                <div key={formatName} className="space-y-2.5">
                                  {/* Format Label */}
                                  <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-orange-400">
                                    <Layers className="h-3.5 w-3.5 text-orange-500" />
                                    <span>{formatName}</span>
                                    <span className="text-[10px] font-normal text-slate-500">
                                      ({groupShowtimes.length} khung giờ)
                                    </span>
                                  </div>

                                  {/* Showtime Chips Buttons (Click để sang trang chọn ghế/vé) */}
                                  <div className="flex flex-wrap gap-2.5">
                                    {groupShowtimes.map((st) => {
                                      const startTimeStr = new Date(st.startTime).toLocaleTimeString('vi-VN', {
                                        hour: '2-digit',
                                        minute: '2-digit'
                                      });
                                      const endTimeStr = st.endTime ? new Date(st.endTime).toLocaleTimeString('vi-VN', {
                                        hour: '2-digit',
                                        minute: '2-digit'
                                      }) : '';
                                      const minPrice = st.basePrice || st.adultStandardPrice || 60000;

                                      return (
                                        <button
                                          key={st.id}
                                          type="button"
                                          onClick={() => handleSelectShowtime(st, currentSelectedMovie)}
                                          className="group/chip relative flex flex-col items-center justify-center px-4 py-2.5 rounded-xl border border-slate-700 bg-slate-900/90 hover:border-orange-500 hover:bg-orange-500/15 hover:shadow-lg hover:shadow-orange-500/20 transition-all duration-200 cursor-pointer min-w-[105px]"
                                        >
                                          {/* Start Time */}
                                          <span className="text-sm font-black text-white group-hover/chip:text-orange-400 transition">
                                            {startTimeStr}
                                          </span>

                                          {/* End Time & Room */}
                                          <div className="flex items-center gap-1 text-[10px] text-slate-400 group-hover/chip:text-slate-300 mt-0.5">
                                            {endTimeStr && <span>~ {endTimeStr}</span>}
                                            {st.roomName && <span>• {st.roomName}</span>}
                                          </div>

                                          {/* Price Tag Hint */}
                                          <span className="text-[9px] font-semibold text-orange-400/90 mt-1">
                                            {formatVnd(minPrice)}
                                          </span>
                                        </button>
                                      );
                                    })}
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>
          </div>
        )}

        {/* =========================================================================
            CHẾ ĐỘ 2: THEO RẠP (TAB THEO RẠP CHUẨN GALAXY CINE)
           ========================================================================= */}
        {viewMode === 'cinema' && (
          <div className="space-y-6">
            {/* Chọn Cụm Rạp */}
            <div className="bg-[#0f172a]/60 border border-slate-800 rounded-2xl p-5 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-orange-500 text-black font-black text-xs">
                    🏛️
                  </span>
                  <div>
                    <h2 className="text-base font-black uppercase tracking-wide text-white">
                      CHỌN CỤM RẠP GALAXY / CINEPREMIER
                    </h2>
                    <p className="text-xs text-slate-400">Chọn rạp chiếu để xem toàn bộ phim và lịch chiếu hôm nay</p>
                  </div>
                </div>

                {/* City selection buttons */}
                <div className="flex flex-wrap items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setSelectedCity('ALL')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                      selectedCity === 'ALL' ? 'bg-orange-500 text-black' : 'bg-slate-900 border border-slate-700 text-slate-400 hover:text-white'
                    }`}
                  >
                    Tất cả
                  </button>
                  {cities.map((city) => (
                    <button
                      key={city}
                      type="button"
                      onClick={() => setSelectedCity(city)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                        selectedCity === city ? 'bg-orange-500 text-black' : 'bg-slate-900 border border-slate-700 text-slate-400 hover:text-white'
                      }`}
                    >
                      {city}
                    </button>
                  ))}
                </div>
              </div>

              {/* Cinema Grid Selector */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 pt-2">
                {cinemas
                  .filter((c) => selectedCity === 'ALL' || c.city === selectedCity)
                  .map((cinema) => {
                    const isSelected = String(selectedCinemaId) === String(cinema.id);

                    return (
                      <div
                        key={cinema.id}
                        onClick={() => setSelectedCinemaId(String(cinema.id))}
                        className={`p-4 rounded-xl border cursor-pointer transition-all duration-200 flex flex-col justify-between ${
                          isSelected
                            ? 'bg-orange-950/20 border-orange-500 shadow-lg shadow-orange-500/10 ring-2 ring-orange-500'
                            : 'bg-slate-900/80 border-slate-800 hover:border-slate-700 hover:bg-slate-900'
                        }`}
                      >
                        <div className="space-y-1">
                          <div className="flex items-center justify-between">
                            <h3 className={`text-sm font-extrabold uppercase line-clamp-1 ${
                              isSelected ? 'text-orange-400' : 'text-white'
                            }`}>
                              {cinema.name}
                            </h3>
                            {isSelected && (
                              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-orange-500 text-black">
                                <Check className="h-3.5 w-3.5 stroke-[3]" />
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-slate-400 line-clamp-2">
                            {cinema.address}
                          </p>
                        </div>

                        <div className="flex items-center justify-between text-[11px] text-slate-500 mt-3 pt-2 border-t border-slate-800/80">
                          <span>{cinema.city}</span>
                          <span>Hotline: {cinema.phone || '1900 2224'}</span>
                        </div>
                      </div>
                    );
                  })}
              </div>
            </div>

            {/* Dải chọn ngày cho Tab Theo Rạp */}
            <div className="bg-[#0f172a]/60 border border-slate-800 rounded-2xl p-5 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                  Chọn ngày xem tại {selectedCinemaData?.name}:
                </h3>
                <span className="text-xs text-orange-400 font-bold">{formatFullDateVi(selectedDate)}</span>
              </div>
              <div className="flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                {upcomingDates.map((dateStr) => {
                  const isSelected = selectedDate === dateStr;
                  const weekday = formatVietnameseWeekday(dateStr);
                  const dayMonth = formatVietnameseDayMonth(dateStr);

                  return (
                    <button
                      key={dateStr}
                      type="button"
                      onClick={() => setSelectedDate(dateStr)}
                      className={`shrink-0 flex flex-col items-center justify-center min-w-[85px] py-2 px-2.5 rounded-xl border transition ${
                        isSelected
                          ? 'bg-orange-500 border-orange-400 text-white shadow-md'
                          : 'bg-slate-900 border-slate-800 text-slate-300 hover:border-slate-700'
                      }`}
                    >
                      <span className={`text-[9px] font-bold uppercase ${isSelected ? 'text-black/80' : 'text-slate-400'}`}>
                        {weekday}
                      </span>
                      <span className="text-sm font-extrabold mt-0.5">{dayMonth}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Danh sách phim và suất chiếu tại rạp này */}
            {isLoadingShowtimes ? (
              <div className="py-16 text-center space-y-3 bg-[#0f172a]/30 border border-slate-800 rounded-2xl">
                <Loader2 className="h-8 w-8 text-orange-500 animate-spin mx-auto" />
                <p className="text-xs text-slate-400 font-semibold uppercase tracking-wider">Đang tải lịch chiếu...</p>
              </div>
            ) : moviesForSelectedCinema.length === 0 ? (
              <div className="py-16 text-center space-y-3 bg-[#0f172a]/30 border border-slate-800 rounded-2xl">
                <CalendarX className="h-10 w-10 text-slate-600 mx-auto" />
                <h3 className="text-sm font-bold text-white uppercase">Chưa có suất chiếu tại rạp này hôm nay</h3>
                <p className="text-xs text-slate-400">Vui lòng chọn ngày chiếu khác để kiểm tra</p>
              </div>
            ) : (
              <div className="space-y-4">
                {moviesForSelectedCinema.map(({ movie, showtimes: movieShowtimes }) => (
                  <div
                    key={movie.id}
                    className="p-5 rounded-2xl border border-slate-800 bg-[#0f172a]/80 shadow-lg flex flex-col md:flex-row gap-5 items-start"
                  >
                    {/* Poster */}
                    <img
                      src={movie.posterUrl || 'https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?auto=format&fit=crop&w=780&q=80'}
                      alt={movie.title}
                      className="w-20 h-28 object-cover rounded-xl border border-slate-700 shrink-0"
                    />

                    {/* Movie Info & Showtimes */}
                    <div className="flex-1 space-y-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="text-base font-black text-white uppercase">{movie.title}</h3>
                          {movie.ageRating && (
                            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-orange-500/20 text-orange-400 border border-orange-500/40">
                              {movie.ageRating}
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-slate-400 mt-0.5">
                          {Array.isArray(movie.genre) ? movie.genre.join(', ') : (movie.genre || 'Hành động')} • {movie.durationMinutes || 120} phút
                        </p>
                      </div>

                      {/* Showtime Chips */}
                      <div className="flex flex-wrap gap-2 pt-1">
                        {movieShowtimes.map((st) => {
                          const timeStr = new Date(st.startTime).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
                          return (
                            <button
                              key={st.id}
                              type="button"
                              onClick={() => handleSelectShowtime(st, movie)}
                              className="px-3.5 py-2 rounded-xl bg-slate-900 border border-slate-700 hover:border-orange-500 hover:bg-orange-500/20 text-xs font-bold text-white hover:text-orange-400 transition cursor-pointer flex flex-col items-center"
                            >
                              <span>{timeStr}</span>
                              <span className="text-[9px] text-slate-400 font-normal">{st.roomName || '2D'}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* =========================================================================
            CHẾ ĐỘ 3: THEO NGÀY (TAB THEO NGÀY)
           ========================================================================= */}
        {viewMode === 'date' && (
          <div className="space-y-6">
            {/* Dải chọn ngày lớn */}
            <div className="bg-[#0f172a]/60 border border-slate-800 rounded-2xl p-5 space-y-3">
              <h2 className="text-base font-black uppercase tracking-wide text-white">
                CHỌN NGÀY CHIẾU PHIM
              </h2>
              <div className="flex gap-2.5 overflow-x-auto pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                {upcomingDates.map((dateStr) => {
                  const isSelected = selectedDate === dateStr;
                  const weekday = formatVietnameseWeekday(dateStr);
                  const dayMonth = formatVietnameseDayMonth(dateStr);

                  return (
                    <button
                      key={dateStr}
                      type="button"
                      onClick={() => setSelectedDate(dateStr)}
                      className={`shrink-0 flex flex-col items-center justify-center min-w-[95px] py-2.5 px-3 rounded-xl border transition ${
                        isSelected
                          ? 'bg-orange-500 border-orange-400 text-white shadow-lg'
                          : 'bg-slate-900 border-slate-800 text-slate-300 hover:border-slate-700'
                      }`}
                    >
                      <span className={`text-[10px] font-bold uppercase ${isSelected ? 'text-black/80' : 'text-slate-400'}`}>
                        {weekday}
                      </span>
                      <span className="text-base font-black mt-0.5">{dayMonth}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Suất chiếu theo từng phim trong ngày */}
            {isLoadingShowtimes ? (
              <div className="py-16 text-center space-y-3 bg-[#0f172a]/30 border border-slate-800 rounded-2xl">
                <Loader2 className="h-8 w-8 text-orange-500 animate-spin mx-auto" />
                <p className="text-xs text-slate-400 font-semibold uppercase tracking-wider">Đang tải lịch chiếu...</p>
              </div>
            ) : showtimes.length === 0 ? (
              <div className="py-16 text-center space-y-3 bg-[#0f172a]/30 border border-slate-800 rounded-2xl">
                <CalendarX className="h-10 w-10 text-slate-600 mx-auto" />
                <h3 className="text-sm font-bold text-white uppercase">Chưa có suất chiếu trong ngày này</h3>
              </div>
            ) : (
              <div className="space-y-4">
                {availableMovies.map((movie) => {
                  const mId = String(movie.backendId || movie.id);
                  const movieShowtimes = showtimes.filter((st) => String(st.movieId) === mId);
                  if (movieShowtimes.length === 0) return null;

                  return (
                    <div
                      key={movie.id}
                      className="p-5 rounded-2xl border border-slate-800 bg-[#0f172a]/80 shadow-lg flex flex-col sm:flex-row gap-5"
                    >
                      <img
                        src={movie.posterUrl || 'https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?auto=format&fit=crop&w=780&q=80'}
                        alt={movie.title}
                        className="w-20 h-28 object-cover rounded-xl border border-slate-700 shrink-0"
                      />
                      <div className="flex-1 space-y-3">
                        <div className="flex items-center gap-2">
                          <h3 className="text-base font-black text-white uppercase">{movie.title}</h3>
                          {movie.ageRating && (
                            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-orange-500/20 text-orange-400 border border-orange-500/40">
                              {movie.ageRating}
                            </span>
                          )}
                        </div>

                        <div className="flex flex-wrap gap-2">
                          {movieShowtimes.map((st) => {
                            const timeStr = new Date(st.startTime).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
                            return (
                              <button
                                key={st.id}
                                type="button"
                                onClick={() => handleSelectShowtime(st, movie)}
                                className="px-3.5 py-2 rounded-xl bg-slate-900 border border-slate-700 hover:border-orange-500 hover:bg-orange-500/20 text-xs font-bold text-white hover:text-orange-400 transition cursor-pointer flex flex-col items-center"
                              >
                                <span>{timeStr}</span>
                                <span className="text-[9px] text-slate-400 font-normal">{st.cinemaName}</span>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
