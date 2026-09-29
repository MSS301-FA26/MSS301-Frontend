import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Ticket, Film, Building2, Calendar, Clock, ChevronDown, Sparkles, User, ArrowRight, Check } from 'lucide-react';
import { bookingService } from '../../services/bookingService';
import { movieService } from '../../services/movieService';
import { useMovies } from '../../stores/useMovieStore';
import { useAuthStore } from '../../stores/useAuthStore';
import { useUiStore } from '../../stores/useUiStore';

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
  useEffect(() => {
    let cancelled = false;
    movieService.getPublicCinemas()
      .then((res) => {
        if (cancelled) return;
        const raw = Array.isArray(res) ? res : (res?.data || []);
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
    </div>
  );
}
