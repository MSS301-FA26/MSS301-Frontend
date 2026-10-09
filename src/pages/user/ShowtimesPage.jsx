import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Film, Clock, Building2, MapPin, Search,
  ChevronDown, ChevronLeft, ChevronRight, Check,
  Sparkles, Ticket, AlertCircle, RefreshCw,
  Star, X
} from 'lucide-react';
import { bookingService } from '../../services/bookingService';
import { movieService } from '../../services/movieService';
import { useMovies, useMovieStore } from '../../stores/useMovieStore';
import { useUiStore } from '../../stores/useUiStore';

// Hook xác định số cột responsive: mobile 2, tablet nhỏ 3, tablet 4, desktop 6
const useColumnCount = () => {
  const [cols, setCols] = useState(() => {
    if (typeof window === 'undefined') return 6;
    const w = window.innerWidth;
    if (w >= 1024) return 6;
    if (w >= 768) return 4;
    if (w >= 640) return 3;
    return 2;
  });

  useEffect(() => {
    const handleResize = () => {
      const w = window.innerWidth;
      if (w >= 1024) setCols(6);
      else if (w >= 768) setCols(4);
      else if (w >= 640) setCols(3);
      else setCols(2);
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return cols;
};

// Tiện ích format ngày địa phương chuẩn YYYY-MM-DD
const toDateKey = (date) => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
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

const formatTimeOnly = (isoString) => {
  if (!isoString) return '';
  try {
    const d = new Date(isoString);
    if (isNaN(d.getTime())) {
      const parts = isoString.split('T')[1]?.split(':');
      if (parts && parts.length >= 2) return `${parts[0]}:${parts[1]}`;
      return '';
    }
    const h = String(d.getHours()).padStart(2, '0');
    const m = String(d.getMinutes()).padStart(2, '0');
    return `${h}:${m}`;
  } catch {
    return '';
  }
};

const formatVnd = (value) => {
  const num = Number(value || 0);
  return `${num.toLocaleString('vi-VN')}đ`;
};

// Phân giải định dạng phòng chiếu chuẩn rạp Việt Nam
const resolveShowtimeFormat = (showtime) => {
  const room = (showtime?.roomName || '').toLowerCase();
  const rawFormat = (showtime?.format || '').toUpperCase();
  if (room.includes('imax') || rawFormat.includes('IMAX')) return 'IMAX LASER 2D Phụ Đề';
  if (room.includes('vip') || room.includes('gold') || rawFormat.includes('VIP')) return 'VIP LOUNGE 2D Phụ Đề';
  if (room.includes('3d') || rawFormat.includes('3D')) return '3D Phụ Đề';
  if (room.includes('4dx') || rawFormat.includes('4DX')) return '4DX 2D Phụ Đề';
  if (rawFormat && rawFormat !== '2D') return `${rawFormat} 2D Phụ Đề`;
  return '2D Phụ Đề';
};

const getAgeBadgeStyle = (ageRating) => {
  const r = String(ageRating || 'P').toUpperCase();
  if (r === 'T18' || r === '18+' || r === 'C') return 'bg-[#E02424] text-white';
  if (r === 'T16' || r === '16+') return 'bg-[#EA580C] text-white';
  if (r === 'T13' || r === '13+') return 'bg-[#EAB308] text-black font-extrabold';
  if (r === 'K') return 'bg-[#0284C7] text-white';
  return 'bg-[#10B981] text-white';
};

export default function ShowtimesPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const cols = useColumnCount();

  // Zustand Store sync
  const storeSelectedCinema = useMovieStore((state) => state.selectedCinema);
  const setStoreSelectedCinema = useMovieStore((state) => state.setSelectedCinema);
  const { moviesList = [] } = useMovies();

  // 1. Data States (100% Real API)
  const [cinemas, setCinemas] = useState([]);
  const [moviesCatalog, setMoviesCatalog] = useState([]);
  const [allShowtimes, setAllShowtimes] = useState([]);
  const [isLoadingCinemas, setIsLoadingCinemas] = useState(true);
  const [isLoadingShowtimes, setIsLoadingShowtimes] = useState(false);
  const [fetchError, setFetchError] = useState(null);

  // 2. Selection States (Synced with URL)
  const todayKey = toDateKey(new Date());
  const initialDate = searchParams.get('date') || todayKey;
  const initialCinemaId = searchParams.get('cinemaId') || 'ALL';
  const initialMovieId = searchParams.get('movieId') || '';

  const [selectedDate, setSelectedDate] = useState(initialDate);
  const [selectedCinemaId, setSelectedCinemaId] = useState(initialCinemaId);
  const [selectedCity, setSelectedCity] = useState('ALL');
  const [selectedMovieId, setSelectedMovieId] = useState(initialMovieId);
  const [movieSearch, setMovieSearch] = useState('');

  const dateStripRef = useRef(null);
  const movieCardRefs = useRef({});
  const panelRef = useRef(null);
  const [caretLeftPx, setCaretLeftPx] = useState(null);

  // Sinh 7 ngày tới cho horizontal date strip
  const upcomingDates = useMemo(() => {
    const list = [];
    const base = new Date();
    for (let i = 0; i < 7; i++) {
      const d = new Date(base);
      d.setDate(base.getDate() + i);
      list.push(toDateKey(d));
    }
    return list;
  }, []);

  // Cập nhật URLSearchParams
  const updateUrlParams = (newParams) => {
    setSearchParams((prev) => {
      const updated = new URLSearchParams(prev);
      Object.entries(newParams).forEach(([k, v]) => {
        if (v === '' || v === null || v === undefined) {
          updated.delete(k);
        } else {
          updated.set(k, v);
        }
      });
      return updated;
    }, { replace: true });
  };

  // 1. Tải danh sách rạp từ API backend thật (/api/v1/cinemas)
  useEffect(() => {
    let cancelled = false;
    setIsLoadingCinemas(true);
    movieService.getPublicCinemas()
      .then((res) => {
        if (cancelled) return;
        const raw = Array.isArray(res) ? res : (res?.data || []);
        const active = raw.filter((c) => !c.status || c.status === 'ACTIVE');
        setCinemas(active);

        if (selectedCinemaId && selectedCinemaId !== 'ALL') {
          const found = active.find(c => String(c.id) === String(selectedCinemaId));
          if (found && found.city) setSelectedCity(found.city.trim());
        }
      })
      .catch((err) => {
        console.warn('Lỗi tải danh sách rạp:', err);
      })
      .finally(() => {
        if (!cancelled) setIsLoadingCinemas(false);
      });

    return () => { cancelled = true; };
  }, []);

  // 2. Tải toàn bộ phim thật từ API backend (/api/v1/movies?size=100) để lấy poster TMDB và metadata chuẩn
  useEffect(() => {
    let cancelled = false;
    movieService.getMovies({ size: 100 })
      .then((res) => {
        if (cancelled) return;
        const raw = Array.isArray(res) ? res : (res?.data?.items ?? res?.items ?? res?.content ?? []);
        setMoviesCatalog(raw);
      })
      .catch((err) => {
        console.warn('Lỗi tải danh mục phim thật:', err);
      });

    return () => { cancelled = true; };
  }, []);

  // 3. Đồng bộ cinema khi Header hoặc URL query thay đổi
  useEffect(() => {
    const paramCinema = searchParams.get('cinemaId');
    if (paramCinema && paramCinema !== selectedCinemaId) {
      setSelectedCinemaId(paramCinema);
      if (cinemas.length > 0) {
        const found = cinemas.find(c => String(c.id) === String(paramCinema));
        if (found) {
          if (found.city) setSelectedCity(found.city.trim());
          if (setStoreSelectedCinema) setStoreSelectedCinema(found);
        }
      }
    }
  }, [searchParams, cinemas]);

  // 4. Tải danh sách suất chiếu thật từ Backend (/api/v1/showtimes)
  const fetchShowtimes = async () => {
    setIsLoadingShowtimes(true);
    setFetchError(null);
    try {
      const query = { size: 250 };
      if (selectedCinemaId && selectedCinemaId !== 'ALL') {
        query.cinemaId = selectedCinemaId;
      }
      const res = await bookingService.getShowtimes(query);
      const raw = Array.isArray(res) ? res : (res?.data?.items ?? res?.items ?? res?.content ?? []);

      // Lọc suất chiếu: chỉ lấy suất OPEN / SCHEDULED
      const valid = raw.filter((st) => {
        if (!st.startTime) return false;
        return st.status === 'OPEN' || st.status === 'SCHEDULED';
      });

      // Sắp xếp theo giờ chiếu tăng dần
      valid.sort((a, b) => new Date(a.startTime) - new Date(b.startTime));
      setAllShowtimes(valid);

      // Tự động kiểm tra: nếu ngày hiện tại không có suất, tự động nhảy sang ngày sớm nhất có suất
      if (!searchParams.get('date')) {
        const dateCounts = {};
        valid.forEach((st) => {
          const dKey = st.startTime.split('T')[0];
          dateCounts[dKey] = (dateCounts[dKey] || 0) + 1;
        });

        if (!dateCounts[selectedDate] || dateCounts[selectedDate] === 0) {
          const availableDate = upcomingDates.find(d => (dateCounts[d] || 0) > 0);
          if (availableDate) {
            setSelectedDate(availableDate);
            updateUrlParams({ date: availableDate });
          }
        }
      }
    } catch (err) {
      console.error('Lỗi khi tải suất chiếu thật:', err);
      setFetchError('Không thể tải lịch chiếu từ máy chủ. Vui lòng thử lại.');
      setAllShowtimes([]);
    } finally {
      setIsLoadingShowtimes(false);
    }
  };

  useEffect(() => {
    fetchShowtimes();
  }, [selectedCinemaId]);

  // Đếm số suất chiếu thực tế cho từng ngày trong 7 ngày
  const dateCountsMap = useMemo(() => {
    const map = {};
    allShowtimes.forEach((st) => {
      if (st.startTime) {
        const dKey = st.startTime.split('T')[0];
        map[dKey] = (map[dKey] || 0) + 1;
      }
    });
    return map;
  }, [allShowtimes]);

  // Lọc suất chiếu theo ngày đang chọn
  const filteredShowtimes = useMemo(() => {
    return allShowtimes.filter((st) => {
      const dKey = st.startTime ? st.startTime.split('T')[0] : '';
      return dKey === selectedDate;
    });
  }, [allShowtimes, selectedDate]);

  // Danh sách các thành phố / khu vực duy nhất
  const cities = useMemo(() => {
    const set = new Set();
    cinemas.forEach((c) => {
      if (c.city && c.city.trim()) set.add(c.city.trim());
    });
    return Array.from(set);
  }, [cinemas]);

  // Danh sách rạp hiển thị trong dropdown (lọc theo khu vực)
  const filteredCinemas = useMemo(() => {
    if (selectedCity === 'ALL') return cinemas;
    return cinemas.filter((c) => (c.city || '').trim() === selectedCity);
  }, [cinemas, selectedCity]);

  // Khi user đổi khu vực
  const handleCityChange = (newCity) => {
    setSelectedCity(newCity);
    if (newCity === 'ALL') {
      setSelectedCinemaId('ALL');
      updateUrlParams({ cinemaId: 'ALL' });
    } else {
      const firstInCity = cinemas.find((c) => (c.city || '').trim() === newCity);
      if (firstInCity) {
        setSelectedCinemaId(String(firstInCity.id));
        if (setStoreSelectedCinema) setStoreSelectedCinema(firstInCity);
        updateUrlParams({ cinemaId: String(firstInCity.id) });
      }
    }
  };

  // Khi user đổi rạp
  const handleCinemaChange = (newCinemaId) => {
    setSelectedCinemaId(newCinemaId);
    updateUrlParams({ cinemaId: newCinemaId });
    if (newCinemaId !== 'ALL') {
      const found = cinemas.find((c) => String(c.id) === String(newCinemaId));
      if (found) {
        if (found.city) setSelectedCity(found.city.trim());
        if (setStoreSelectedCinema) setStoreSelectedCinema(found);
      }
    }
  };

  // Khi user đổi ngày
  const handleDateSelect = (dateKey) => {
    setSelectedDate(dateKey);
    updateUrlParams({ date: dateKey });
  };

  // Danh sách các phim có suất chiếu trong ngày & rạp đang chọn (Ghép 100% API thật)
  const moviesWithShowtimes = useMemo(() => {
    const movieShowtimesMap = new Map();
    filteredShowtimes.forEach((st) => {
      const mId = String(st.movieId);
      if (!movieShowtimesMap.has(mId)) {
        movieShowtimesMap.set(mId, []);
      }
      movieShowtimesMap.get(mId).push(st);
    });

    const result = [];
    movieShowtimesMap.forEach((stList, mId) => {
      const catalogMovie = moviesCatalog.find(
        (m) => String(m.id || m.backendId || m.movieId) === String(mId)
      ) || moviesList.find(
        (m) => String(m.id || m.backendId || m.movieId) === String(mId)
      );

      const firstSt = stList[0];

      let genreText = 'Điện ảnh';
      if (catalogMovie?.genres && Array.isArray(catalogMovie.genres)) {
        genreText = catalogMovie.genres.map(g => (typeof g === 'object' ? g.name : g)).filter(Boolean).join(', ');
      } else if (catalogMovie?.genre) {
        genreText = catalogMovie.genre;
      } else if (firstSt?.movieGenreNames) {
        genreText = typeof firstSt.movieGenreNames === 'string' ? firstSt.movieGenreNames : firstSt.movieGenreNames.join(', ');
      }

      const poster = catalogMovie?.posterUrl || catalogMovie?.avatarUrl || catalogMovie?.poster;

      // Rating thực tế từ catalog
      let calculatedRating = null;
      if (catalogMovie?.voteAverage) {
        calculatedRating = Number(catalogMovie.voteAverage).toFixed(1);
      } else if (catalogMovie?.rating) {
        calculatedRating = Number(catalogMovie.rating).toFixed(1);
      }

      // Age rating normalization
      const rawAge = catalogMovie?.ageRating || firstSt?.movieAgeRating || 'P';
      const ageRating = rawAge === '18+' ? 'T18' : rawAge === '16+' ? 'T16' : rawAge === '13+' ? 'T13' : rawAge;

      result.push({
        id: mId,
        backendId: Number(mId),
        title: catalogMovie?.title || firstSt?.movieTitle || `Phim #${mId}`,
        posterUrl: poster || 'https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?auto=format&fit=crop&w=400&q=80',
        ageRating,
        rating: calculatedRating,
        durationMinutes: catalogMovie?.durationMinutes || catalogMovie?.duration || 120,
        genre: genreText,
        description: catalogMovie?.description || 'Trải nghiệm điện ảnh đỉnh cao tại phòng chiếu CinePremier Studios.',
        language: catalogMovie?.language ? `${catalogMovie.language} • Phụ đề ${catalogMovie?.subtitleLanguage || 'Tiếng Việt'}` : 'Phụ đề Tiếng Việt',
        showtimes: stList,
        showtimesCount: stList.length
      });
    });

    // Lọc theo search input
    if (movieSearch.trim()) {
      const q = movieSearch.toLowerCase().trim();
      return result.filter((m) => m.title.toLowerCase().includes(q) || m.genre.toLowerCase().includes(q));
    }

    return result;
  }, [filteredShowtimes, moviesCatalog, moviesList, movieSearch]);

  // Đồng bộ phim từ URL hoặc bỏ chọn nếu phim không còn suất chiếu
  useEffect(() => {
    if (moviesWithShowtimes.length === 0) {
      if (selectedMovieId) {
        setSelectedMovieId('');
        updateUrlParams({ movieId: '' });
      }
      return;
    }

    const paramMovieId = searchParams.get('movieId');
    if (paramMovieId) {
      const exists = moviesWithShowtimes.some((m) => String(m.id) === String(paramMovieId));
      if (exists) {
        if (selectedMovieId !== paramMovieId) {
          setSelectedMovieId(paramMovieId);
        }
      } else {
        // Phim trên URL không có suất chiếu ở rạp/ngày đang chọn -> Bỏ chọn
        setSelectedMovieId('');
        updateUrlParams({ movieId: '' });
      }
    } else if (selectedMovieId) {
      // Nếu URL không có movieId, kiểm tra xem selectedMovieId hiện tại có hợp lệ không
      const exists = moviesWithShowtimes.some((m) => String(m.id) === String(selectedMovieId));
      if (!exists) {
        setSelectedMovieId('');
      }
    }
  }, [moviesWithShowtimes, searchParams]);

  // Chia danh sách phim thành các hàng (rows) theo số cột cols
  const movieRows = useMemo(() => {
    const rows = [];
    for (let i = 0; i < moviesWithShowtimes.length; i += cols) {
      rows.push(moviesWithShowtimes.slice(i, i + cols));
    }
    return rows;
  }, [moviesWithShowtimes, cols]);

  // Xác định hàng nào đang chứa thẻ phim được chọn
  const selectedRowIndex = useMemo(() => {
    if (!selectedMovieId) return -1;
    return movieRows.findIndex(row => row.some(m => String(m.id) === String(selectedMovieId)));
  }, [movieRows, selectedMovieId]);

  // Cập nhật vị trí caret mũi tên tam giác chính xác theo thẻ phim đang chọn
  useEffect(() => {
    if (!selectedMovieId) {
      setCaretLeftPx(null);
      return;
    }
    const updateCaret = () => {
      const cardEl = movieCardRefs.current[selectedMovieId];
      if (cardEl) {
        setCaretLeftPx(cardEl.offsetLeft + cardEl.offsetWidth / 2);
      }
    };
    const timer = setTimeout(updateCaret, 30);
    window.addEventListener('resize', updateCaret);
    return () => {
      clearTimeout(timer);
      window.removeEventListener('resize', updateCaret);
    };
  }, [selectedMovieId, cols, moviesWithShowtimes]);

  // Khi click chọn thẻ phim
  const handleSelectMovieCard = (movieId) => {
    const nextId = String(movieId);

    // Nếu bấm lại vào phim đang chọn -> Bỏ chọn và đóng bảng giờ chiếu
    if (String(selectedMovieId) === nextId) {
      setSelectedMovieId('');
      updateUrlParams({ movieId: '' });
      return;
    }

    setSelectedMovieId(nextId);
    updateUrlParams({ movieId: nextId });

    // Cuộn mượt xuống phần giờ chiếu của phim đó (không giật lên đầu trang)
    setTimeout(() => {
      if (panelRef.current) {
        panelRef.current.scrollIntoView({
          behavior: 'smooth',
          block: 'nearest'
        });
      }
    }, 60);
  };

  // Click suất chiếu -> Đi thẳng vào chọn ghế (BookingPage)
  const handleSelectShowtime = (st, movie) => {
    const movieId = movie?.backendId || movie?.id || st.movieId;
    const cId = st.cinemaId || selectedCinemaId;
    const dateParam = selectedDate || (st.startTime ? st.startTime.split('T')[0] : '');
    navigate(`/movies/${movieId}/book?showtimeId=${st.id}&cinemaId=${cId}&date=${dateParam}`);
  };

  // Scroll Date Strip
  const handleScrollDate = (direction) => {
    if (dateStripRef.current) {
      const offset = direction === 'left' ? -240 : 240;
      dateStripRef.current.scrollBy({ left: offset, behavior: 'smooth' });
    }
  };

  return (
    <div className="min-h-screen bg-[#050507] text-white selection:bg-[#F7C600] selection:text-black">
      {/* Background Ambient Glow */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
        <div className="absolute -top-32 left-1/2 -translate-x-1/2 w-[700px] h-[350px] bg-gradient-to-b from-[#8A00F5]/10 via-[#F7C600]/5 to-transparent blur-[120px]" />
      </div>

      <div className="relative z-10 mx-auto max-w-[1240px] px-4 sm:px-6 pt-7 sm:pt-9 pb-16">
        
        {/* ========================================================
            1. PAGE HEADER & CINEMA SELECTOR (KHU VỰC & RẠP)
        ======================================================== */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-white/[0.07] pb-5">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="flex items-center gap-1 rounded-none bg-[#F7C600]/10 border border-[#F7C600]/25 px-2 py-0.5 text-[9px] font-extrabold uppercase tracking-widest text-[#F7C600]">
                <Sparkles className="h-2.5 w-2.5" />
                CinePremier Booking
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl md:text-[34px] font-black uppercase tracking-tight leading-none">
              <span className="text-white">LỊCH CHIẾU </span>
              <span className="text-[#F7C600]">& MUA VÉ</span>
            </h1>
            <p className="text-xs sm:text-[13px] text-neutral-400 mt-1.5 font-medium">
              Suất chiếu thời gian thực từ hệ thống rạp CinePremier Studios.
            </p>
          </div>

          {/* Controls: [KHU VỰC ▼] [RẠP ▼] */}
          <div className="flex flex-wrap sm:flex-nowrap items-center gap-2.5">
            {/* Dropdown Khu Vực */}
            <div className="relative min-w-[140px] sm:min-w-[160px] flex-1 sm:flex-initial">
              <div className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-neutral-400">
                <MapPin className="h-3.5 w-3.5 text-[#F7C600]" />
              </div>
              <select
                aria-label="Chọn khu vực"
                value={selectedCity}
                onChange={(e) => handleCityChange(e.target.value)}
                className="h-[42px] w-full appearance-none rounded-none border border-white/10 bg-[#09090D] pl-8.5 pr-8 text-xs font-semibold text-white transition-colors hover:border-white/20 focus:border-[#F7C600] focus:outline-none focus:ring-1 focus:ring-[#F7C600]"
              >
                <option value="ALL">Tất cả khu vực</option>
                {cities.map((city) => (
                  <option key={city} value={city} className="bg-[#0e0e14] text-white">
                    {city}
                  </option>
                ))}
              </select>
              <div className="pointer-events-none absolute inset-y-0 right-2.5 flex items-center text-neutral-400">
                <ChevronDown className="h-3.5 w-3.5" />
              </div>
            </div>

            {/* Dropdown Rạp */}
            <div className="relative min-w-[190px] sm:min-w-[240px] flex-1 sm:flex-initial">
              <div className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-neutral-400">
                <Building2 className="h-3.5 w-3.5 text-[#F7C600]" />
              </div>
              <select
                aria-label="Chọn rạp"
                value={selectedCinemaId}
                onChange={(e) => handleCinemaChange(e.target.value)}
                className="h-[42px] w-full appearance-none rounded-none border border-white/10 bg-[#09090D] pl-8.5 pr-8 text-xs font-bold text-white transition-colors hover:border-white/20 focus:border-[#F7C600] focus:outline-none focus:ring-1 focus:ring-[#F7C600]"
              >
                <option value="ALL">TẤT CẢ RẠP ({filteredCinemas.length})</option>
                {filteredCinemas.map((c) => (
                  <option key={c.id} value={String(c.id)} className="bg-[#0e0e14] text-white">
                    {c.name}
                  </option>
                ))}
              </select>
              <div className="pointer-events-none absolute inset-y-0 right-2.5 flex items-center text-neutral-400">
                <ChevronDown className="h-3.5 w-3.5" />
              </div>
            </div>
          </div>
        </div>

        {/* ========================================================
            2. HORIZONTAL DATE SELECTOR (7 NGÀY KÈM SỐ SUẤT CHIẾU THẬT)
        ======================================================== */}
        <div className="mt-5 relative">
          <div className="flex items-center gap-1.5">
            {/* Scroll Left Button */}
            <button
              onClick={() => handleScrollDate('left')}
              className="hidden sm:flex h-[56px] w-8 items-center justify-center rounded-none border border-white/10 bg-[#09090D] text-neutral-400 hover:text-white hover:border-white/20 shrink-0 transition-colors cursor-pointer"
              aria-label="Ngày trước"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>

            {/* Date Tabs Container */}
            <div
              ref={dateStripRef}
              className="flex items-center gap-2 overflow-x-auto pb-1 flex-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
            >
              {upcomingDates.map((dateKey) => {
                const isSelected = selectedDate === dateKey;
                const weekdayText = formatVietnameseWeekday(dateKey);
                const dayMonthText = formatVietnameseDayMonth(dateKey);
                const count = dateCountsMap[dateKey] || 0;

                return (
                  <button
                    key={dateKey}
                    onClick={() => handleDateSelect(dateKey)}
                    className={`flex flex-col items-center justify-center min-w-[82px] sm:flex-1 h-[56px] rounded-none px-2 text-center transition-all select-none border cursor-pointer ${
                      isSelected
                        ? 'bg-[#F7C600] text-black border-[#F7C600] font-black shadow-[0_0_15px_rgba(247,198,0,0.35)]'
                        : count > 0
                        ? 'bg-[#09090D] text-neutral-200 border-white/10 hover:border-[#F7C600]/50 hover:text-white'
                        : 'bg-[#09090D]/50 text-neutral-500 border-white/5 opacity-70 hover:opacity-100'
                    }`}
                  >
                    <span className={`text-[10px] sm:text-[10.5px] uppercase tracking-wider font-extrabold ${
                      isSelected ? 'text-black' : count > 0 ? 'text-neutral-400' : 'text-neutral-600'
                    }`}>
                      {weekdayText}
                    </span>
                    <span className={`text-xs sm:text-[13px] font-bold ${
                      isSelected ? 'text-black' : 'text-white'
                    }`}>
                      {dayMonthText}
                    </span>
                    {count > 0 ? (
                      <span className={`text-[9px] font-bold px-1 rounded-none mt-0.5 leading-none ${
                        isSelected ? 'bg-black/20 text-black' : 'text-[#F7C600]'
                      }`}>
                        {count} suất
                      </span>
                    ) : (
                      <span className="text-[8.5px] text-neutral-600 mt-0.5 leading-none">
                        Chưa có suất
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Scroll Right Button */}
            <button
              onClick={() => handleScrollDate('right')}
              className="hidden sm:flex h-[56px] w-8 items-center justify-center rounded-none border border-white/10 bg-[#09090D] text-neutral-400 hover:text-white hover:border-white/20 shrink-0 transition-colors cursor-pointer"
              aria-label="Ngày kế tiếp"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* ========================================================
            3. SEARCH & INFO HEADER
        ======================================================== */}
        <div className="mt-7 flex items-center justify-between gap-4 border-t border-white/[0.06] pt-5 mb-5">
          <div className="flex items-center gap-2">
            <Film className="h-4 w-4 text-[#F7C600]" />
            <h2 className="text-xs sm:text-sm font-extrabold uppercase tracking-wider text-neutral-300">
              CHỌN PHIM ĐỂ XEM SUẤT CHIẾU ({moviesWithShowtimes.length} PHIM)
            </h2>
          </div>

          {/* Search Filter */}
          <div className="relative w-[180px] sm:w-[240px]">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-neutral-400" />
            <input
              type="text"
              value={movieSearch}
              onChange={(e) => setMovieSearch(e.target.value)}
              placeholder="Tìm tên phim..."
              className="h-8.5 w-full rounded-none border border-white/10 bg-[#09090D] pl-8 pr-7 text-xs text-white placeholder-neutral-500 focus:border-[#F7C600] focus:outline-none"
            />
            {movieSearch && (
              <button
                onClick={() => setMovieSearch('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-white cursor-pointer"
              >
                <X className="h-3 w-3" />
              </button>
            )}
          </div>
        </div>

        {/* ========================================================
            4. LOADING SKELETON
        ======================================================== */}
        {isLoadingShowtimes && (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3.5 sm:gap-4.5">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="animate-pulse space-y-2">
                <div className="aspect-[2/3] rounded-none bg-white/5" />
                <div className="h-3 w-3/4 bg-white/5 rounded-none mx-auto" />
              </div>
            ))}
          </div>
        )}

        {/* ========================================================
            5. ERROR STATE
        ======================================================== */}
        {!isLoadingShowtimes && fetchError && (
          <div className="rounded-none border border-rose-500/20 bg-rose-500/5 p-8 text-center my-6">
            <AlertCircle className="mx-auto h-8 w-8 text-rose-400 mb-2" />
            <p className="text-sm font-semibold text-rose-200">{fetchError}</p>
            <button
              onClick={fetchShowtimes}
              className="mt-3 inline-flex items-center gap-1.5 rounded-none border border-rose-400/40 bg-rose-500/20 px-3.5 py-1.5 text-xs font-bold text-rose-300 hover:bg-rose-500/30 cursor-pointer"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Tải lại
            </button>
          </div>
        )}

        {/* ========================================================
            6. EMPTY STATE (KHÔNG CÓ SUẤT CHIẾU NGÀY NÀY)
        ======================================================== */}
        {!isLoadingShowtimes && !fetchError && moviesWithShowtimes.length === 0 && (
          <div className="rounded-none border border-white/10 bg-[#09090D] p-10 sm:p-14 text-center my-6">
            <Film className="mx-auto h-10 w-10 text-neutral-600 mb-3" />
            <h3 className="text-base font-bold text-white mb-1">
              Chưa có suất chiếu vào ngày {formatVietnameseDayMonth(selectedDate)}
            </h3>
            <p className="text-xs text-neutral-400 max-w-md mx-auto mb-6">
              {selectedCinemaId !== 'ALL'
                ? `Rạp hiện chưa có lịch chiếu cho ngày này. Bạn có thể chọn ngày tiếp theo hoặc xem tất cả rạp.`
                : `Hiện chưa có suất chiếu nào mở bán cho ngày ${formatVietnameseDayMonth(selectedDate)}.`}
            </p>
            <div className="flex flex-wrap items-center justify-center gap-2.5">
              {upcomingDates.find(d => (dateCountsMap[d] || 0) > 0) && (
                <button
                  onClick={() => {
                    const firstAvailable = upcomingDates.find(d => (dateCountsMap[d] || 0) > 0);
                    if (firstAvailable) handleDateSelect(firstAvailable);
                  }}
                  className="rounded-none bg-[#F7C600] px-4 py-2 text-xs font-extrabold text-black uppercase tracking-wider hover:bg-[#ffd633] transition-colors cursor-pointer"
                >
                  Xem ngày có suất ({formatVietnameseDayMonth(upcomingDates.find(d => (dateCountsMap[d] || 0) > 0))})
                </button>
              )}
              {selectedCinemaId !== 'ALL' && (
                <button
                  onClick={() => handleCinemaChange('ALL')}
                  className="rounded-none border border-white/20 bg-white/5 px-4 py-2 text-xs font-bold text-white uppercase tracking-wider hover:bg-white/10 transition-colors cursor-pointer"
                >
                  Xem tất cả rạp
                </button>
              )}
            </div>
          </div>
        )}

        {/* =========================================================================================
            7. POSTER GRID WITH INLINE SHOWTIMES PANEL UNDER THE SELECTED MOVIE ROW
            (Đúng 100% giao diện yêu cầu: Lưới thẻ phim 6 cột, icon vuông checkmark giữa thẻ được chọn,
             và bảng "Suất chiếu" mở ra ngay dưới chân hàng phim có mũi tên chỉ lên thẻ đang chọn)
        ========================================================================================= */}
        {!isLoadingShowtimes && !fetchError && moviesWithShowtimes.length > 0 && (
          <div className="space-y-6">
            {movieRows.map((row, rIdx) => {
              const isSelectedRow = rIdx === selectedRowIndex;
              const selectedIndexInRow = isSelectedRow
                ? row.findIndex((m) => String(m.id) === String(selectedMovieId))
                : -1;
              const selectedMovie = isSelectedRow ? row[selectedIndexInRow] : null;

              return (
                <div key={`row-${rIdx}`} className="relative">
                  {/* Lưới các thẻ phim trong hàng này */}
                  <div
                    className="grid gap-3.5 sm:gap-4.5"
                    style={{
                      gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`
                    }}
                  >
                    {row.map((movie) => {
                      const isSelected = String(movie.id) === String(selectedMovieId);

                      return (
                        <div
                          key={movie.id}
                          ref={(el) => { movieCardRefs.current[movie.id] = el; }}
                          onClick={() => handleSelectMovieCard(movie.id)}
                          className="group cursor-pointer flex flex-col items-center select-none"
                        >
                          {/* Thẻ Poster tỷ lệ 2:3 - Strict 90-degree Square Frame */}
                          <div
                            className={`relative w-full aspect-[2/3] rounded-none overflow-hidden bg-neutral-900 border transition-all duration-200 ${
                              isSelected
                                ? 'border-[#EA580C] ring-2 ring-[#EA580C] shadow-[0_6px_20px_rgba(234,88,12,0.35)] scale-[1.01]'
                                : 'border-white/10 hover:border-white/30 hover:scale-[1.02]'
                            }`}
                          >
                            <img
                              src={movie.posterUrl}
                              alt={movie.title}
                              loading="lazy"
                              className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                            />

                            {/* Icon vuông góc checkmark màu cam ở chính giữa thẻ khi được chọn (Strict 90-degree square) */}
                            {isSelected && (
                              <div className="absolute inset-0 bg-black/35 flex items-center justify-center">
                                <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-none bg-[#EA580C] flex items-center justify-center shadow-md shadow-[#EA580C]/40 animate-in fade-in zoom-in-75 duration-150">
                                  <Check className="w-4.5 h-4.5 sm:w-5 sm:h-5 text-white stroke-[3.5]" />
                                </div>
                              </div>
                            )}

                            {/* Điểm đánh giá (Star) và Độ tuổi (Age Rating) ở góc dưới bên phải */}
                            <div className="absolute bottom-1.5 right-1.5 flex flex-col items-end gap-1 pointer-events-none">
                              {movie.rating && (
                                <div className="flex items-center gap-0.5 bg-black/75 backdrop-blur-md px-1.5 py-0.5 rounded-none text-[10px] font-black text-white shadow">
                                  <Star className="w-2.5 h-2.5 text-[#F7C600] fill-[#F7C600]" />
                                  <span>{movie.rating}</span>
                                </div>
                              )}
                              <span className={`px-1.5 py-0.5 rounded-none text-[9px] font-black tracking-wider shadow ${getAgeBadgeStyle(movie.ageRating)}`}>
                                {movie.ageRating}
                              </span>
                            </div>
                          </div>

                          {/* Tên phim căn giữa dưới chân poster gọn gàng */}
                          <h3
                            className={`mt-1.5 text-center text-xs font-bold line-clamp-2 px-0.5 transition-colors leading-snug ${
                              isSelected ? 'text-[#EA580C]' : 'text-neutral-300 group-hover:text-white'
                            }`}
                          >
                            {movie.title}
                          </h3>
                        </div>
                      );
                    })}
                  </div>

                  {/* Bảng Suất Chiếu hiển thị ngay dưới chân hàng phim - Thiết kế gọn nhỏ, dễ thương */}
                  {isSelectedRow && selectedMovie && (
                    <div ref={panelRef} className="relative mt-3 mb-2 scroll-mt-24 sm:scroll-mt-28">
                      {/* Mũi tên tam giác nhỏ xinh chỉ lên thẻ phim đang chọn */}
                      <div
                        className="absolute -top-1.5 w-3.5 h-3.5 -translate-x-1/2 rotate-45 border-t border-l border-white/20 bg-[#0C0C14] z-20 pointer-events-none transition-all duration-200"
                        style={{
                          left: caretLeftPx !== null
                            ? `${caretLeftPx}px`
                            : `${((selectedIndexInRow + 0.5) / cols) * 100}%`
                        }}
                      />

                      {/* Khung Bảng Suất Chiếu nhỏ gọn - Strict 90-degree Square Frame */}
                      <div className="rounded-none border border-white/12 bg-[#0C0C14]/95 backdrop-blur-md shadow-xl p-3.5 sm:p-4.5 relative z-10 animate-in fade-in slide-in-from-top-1 duration-150">
                        {/* Header: Suất chiếu thanh thoát */}
                        <div className="flex items-center justify-between pb-2 mb-2.5 border-b border-white/[0.08]">
                          <div className="flex items-center gap-1.5">
                            <span className="h-2 w-2 rounded-none bg-[#F7C600] animate-pulse" />
                            <h4 className="text-xs sm:text-[13px] font-black uppercase tracking-wider text-white">
                              Suất chiếu
                            </h4>
                          </div>
                          <div className="flex items-center gap-1.5 text-[11px] text-neutral-400">
                            <span className="font-bold text-neutral-200 truncate max-w-[180px] sm:max-w-none">{selectedMovie.title}</span>
                            <span>•</span>
                            <span className="text-[#F7C600] font-bold">
                              {selectedMovie.showtimes.length} suất khả dụng
                            </span>
                          </div>
                        </div>

                        {/* Danh sách suất chiếu theo định dạng */}
                        {selectedMovie.showtimes.length === 0 ? (
                          <p className="text-neutral-400 text-xs py-2 text-center">
                            Chưa có lịch chiếu cho phim này trong ngày đã chọn.
                          </p>
                        ) : selectedCinemaId === 'ALL' ? (
                          /* Khi xem tất cả rạp: hiển thị chữ đơn giản như hình 2 */
                          <div className="space-y-4">
                            {(() => {
                              const cinemaMap = new Map();
                              selectedMovie.showtimes.forEach((st) => {
                                const cId = String(st.cinemaId || 'unknown');
                                if (!cinemaMap.has(cId)) {
                                  cinemaMap.set(cId, {
                                    cinemaId: cId,
                                    cinemaName: st.cinemaName || `CinePremier Rạp #${cId}`,
                                    formats: {}
                                  });
                                }
                                const fmt = resolveShowtimeFormat(st);
                                const cObj = cinemaMap.get(cId);
                                if (!cObj.formats[fmt]) cObj.formats[fmt] = [];
                                cObj.formats[fmt].push(st);
                              });

                              return Array.from(cinemaMap.values()).map((cBlock) => (
                                <div key={cBlock.cinemaId} className="space-y-2 pb-3 border-b border-white/5 last:border-0 last:pb-0">
                                  <div className="flex items-center gap-1.5 text-[11px] font-bold text-[#F7C600] uppercase tracking-wider">
                                    <MapPin className="h-3 w-3" />
                                    <span>{cBlock.cinemaName}</span>
                                  </div>
                                  <div className="space-y-3 pl-1 sm:pl-3">
                                    {Object.entries(cBlock.formats).map(([fmtName, slots]) => (
                                      <div key={fmtName} className="flex flex-col sm:flex-row sm:items-start gap-2 sm:gap-6">
                                        {/* Tên suất: chữ đơn giản không viền như hình 2 */}
                                        <div className="w-36 sm:w-44 shrink-0 text-xs sm:text-[13px] font-medium text-neutral-300 pt-1 leading-snug">
                                          {fmtName}
                                        </div>
                                        {/* Giờ chiếu */}
                                        <div className="flex flex-wrap items-center gap-2 flex-1">
                                          {slots.map((st) => {
                                            const startTime = formatTimeOnly(st.startTime);
                                            return (
                                              <button
                                                key={st.id}
                                                onClick={() => handleSelectShowtime(st, selectedMovie)}
                                                className="h-8 px-3.5 rounded-none border border-white/15 bg-white/[0.04] text-xs sm:text-[13px] font-bold text-white hover:border-[#F7C600] hover:bg-[#F7C600] hover:text-black hover:scale-105 active:scale-95 transition-all select-none flex items-center justify-center cursor-pointer shadow-sm"
                                                title={`Suất chiếu ${startTime} - Phòng: ${st.roomName || 'Tiêu chuẩn'} - Giá từ: ${formatVnd(st.basePrice || st.adultStandardPrice)}`}
                                              >
                                                {startTime}
                                              </button>
                                            );
                                          })}
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              ));
                            })()}
                          </div>
                        ) : (
                          /* Khi xem 1 rạp cụ thể: chữ đơn giản căn lề thẳng hàng như hình 2 */
                          <div className="space-y-3.5">
                            {(() => {
                              const formatGroups = {};
                              selectedMovie.showtimes.forEach((st) => {
                                const fmt = resolveShowtimeFormat(st);
                                if (!formatGroups[fmt]) formatGroups[fmt] = [];
                                formatGroups[fmt].push(st);
                              });

                              return Object.entries(formatGroups).map(([fmtName, slots]) => (
                                <div key={fmtName} className="flex flex-col sm:flex-row sm:items-start gap-2 sm:gap-6">
                                  {/* Tên suất: chữ đơn giản không khung như hình 2 */}
                                  <div className="w-36 sm:w-44 shrink-0 text-xs sm:text-[13px] font-medium text-neutral-300 pt-1 leading-snug">
                                    {fmtName}
                                  </div>

                                  {/* Giờ chiếu: các nút time thẳng hàng - Strict 90-degree square */}
                                  <div className="flex flex-wrap items-center gap-2 sm:gap-2.5 flex-1">
                                    {slots.map((st) => {
                                      const startTime = formatTimeOnly(st.startTime);
                                      return (
                                        <button
                                          key={st.id}
                                          onClick={() => handleSelectShowtime(st, selectedMovie)}
                                          className="h-8 px-3.5 rounded-none border border-white/15 bg-white/[0.04] text-xs sm:text-[13px] font-bold text-white hover:border-[#F7C600] hover:bg-[#F7C600] hover:text-black hover:scale-105 active:scale-95 transition-all select-none flex items-center justify-center cursor-pointer shadow-sm"
                                          title={`Suất chiếu ${startTime} - Phòng: ${st.roomName || 'Tiêu chuẩn'} - Giá từ: ${formatVnd(st.basePrice || st.adultStandardPrice)}`}
                                        >
                                          {startTime}
                                        </button>
                                      );
                                    })}
                                  </div>
                                </div>
                              ));
                            })()}
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
