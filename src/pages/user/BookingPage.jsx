import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { QRCodeSVG } from 'qrcode.react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import {
  ChevronRight, ChevronLeft, ArrowLeft, Ticket, ShoppingBag, Plus, Minus,
  CheckCircle, XCircle, Loader2, Check, ShieldCheck, CircleAlert, Calendar,
  Clock, ArrowRight, Tag, Sparkles, Layers, DollarSign, Wallet, RefreshCw, AlertTriangle,
  Film, MapPin, CheckCircle2, Tv, Armchair, Info, CalendarX
} from 'lucide-react';
import { expireAuthSession, getStoredAuth, hasBackendAdminAccess, hasBackendManagerAccess, hasBackendStaffAccess } from '../../services/authService';
import { bookingService } from '../../services/bookingService';
import { movieService } from '../../services/movieService';
import { adminService } from '../../services/adminService';
import { paymentService } from '../../services/paymentService';
import { loyaltyService } from '../../services/loyaltyService';
import { useMovies } from '../../stores/useMovieStore';
import { useUiStore } from '../../stores/useUiStore';
import { useAuthStore } from '../../stores/useAuthStore';

// Cấu hình thời gian giữ ghế chuẩn 10 phút (Rule 17)
const HOLD_DURATION_SECONDS = 10 * 60;
const CONCESSIONS_PAGE_SIZE = 6;

const DEFAULT_LOYALTY_CONFIG = {
  earningRatePercent: 1,
  redemptionPoints: 1000,
  redemptionValueVnd: 1000,
  expiryMonth: 12,
  expiryDay: 31,
  expiryTime: '23:59:59',
  lastExpiredAt: null,
  lastResetAt: null,
  lastResetSource: null
};

const moneyValue = (value) => {
  if (value === undefined || value === null || value === '') return null;
  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue : null;
};

const formatVnd = (value) => `${Number(value || 0).toLocaleString('vi-VN')}đ`;

const formatHoldSeconds = (totalSeconds) => {
  const safeSeconds = Math.max(0, Math.floor(totalSeconds || 0));
  const minutes = Math.floor(safeSeconds / 60);
  const seconds = safeSeconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
};

const normalizeSeatType = (seatType) => {
  const norm = String(seatType || 'SINGLE').toUpperCase();
  if (norm === 'COUPLE') return 'COUPLE';
  return 'SINGLE';
};

// Tìm cặp ghế đôi hoàn chỉnh (Rule 6 & 7)
const getCoupleSeatPair = (seat, allSeats) => {
  if (!seat || normalizeSeatType(seat.type) !== 'COUPLE') return seat ? [seat] : [];
  const rowSeats = allSeats
    .filter(candidate => candidate.row === seat.row && normalizeSeatType(candidate.type) === 'COUPLE')
    .sort((a, b) => (a.displayColumn - b.displayColumn) || (a.col - b.col));
  const seatIndex = rowSeats.findIndex(candidate => candidate.id === seat.id);
  if (seatIndex < 0) return [seat];
  const pairStart = seatIndex % 2 === 0 ? seatIndex : seatIndex - 1;
  return rowSeats.slice(pairStart, pairStart + 2);
};

const getShowtimeRoomKey = (showtime) => {
  const roomId = showtime?.roomId ?? showtime?.room?.id;
  if (roomId !== undefined && roomId !== null && roomId !== '') return `room-${roomId}`;
  return `name-${showtime?.roomName || 'unknown'}`;
};

const FOOD_STATUS_META = {
  ACTIVE: { label: 'Mở bán', className: 'text-emerald-400' },
  LOW_STOCK: { label: 'Sắp hết', className: 'text-amber-400' },
  OUT_OF_STOCK: { label: 'Hết', className: 'text-rose-400' },
  INACTIVE: { label: 'Hết', className: 'text-rose-400' },
};

const getFoodStatusMeta = (status) => FOOD_STATUS_META[status] || FOOD_STATUS_META.OUT_OF_STOCK;
const isFoodSelectable = (item) => {
  if (!item) return false;
  const status = String(item.status || 'ACTIVE').toUpperCase();
  return status === 'ACTIVE' || status === 'LOW_STOCK';
};

const sortShowtimes = (showtimes) => [...showtimes].sort((a, b) => {
  const timeDiff = new Date(a.startTime || 0) - new Date(b.startTime || 0);
  if (timeDiff !== 0) return timeDiff;
  return String(a.roomName || '').localeCompare(String(b.roomName || ''), 'vi');
});

const getLocalDateString = (d = new Date()) => {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
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
    const days = ['CHỦ NHẬT', 'THỨ HAI', 'THỨ BA', 'THỨ TƯ', 'THỨ NĂM', 'THỨ SÁU', 'THỨ BẢY'];
    return days[d.getDay()] || 'HÔM NAY';
  } catch {
    return 'HÔM NAY';
  }
};

const formatVietnameseShortWeekday = (dateStr) => {
  try {
    const d = parseLocalDate(dateStr);
    const days = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];
    return days[d.getDay()] || 'HN';
  } catch {
    return 'HN';
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

const formatVietnameseFullDate = (dateStr) => {
  if (!dateStr) return '—';
  try {
    const d = parseLocalDate(dateStr);
    const days = ['Chủ Nhật', 'Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy'];
    const weekday = days[d.getDay()] || '';
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    return `${weekday}, ${day}/${month}/${year}`;
  } catch {
    return dateStr;
  }
};

const getAgeRatingBadgeMeta = (rating) => {
  switch (rating) {
    case 'P':
      return { label: 'P', full: 'P - Phổ biến cho mọi đối tượng', bg: 'bg-emerald-950/80 border-emerald-500/40 text-emerald-400' };
    case 'K':
      return { label: 'K', full: 'K - Dưới 13 tuổi có phụ huynh đi kèm', bg: 'bg-blue-950/80 border-blue-500/40 text-blue-400' };
    case 'T13':
      return { label: 'T13', full: 'T13 - Khán giả từ 13 tuổi trở lên', bg: 'bg-amber-950/80 border-amber-500/40 text-amber-400' };
    case 'T16':
      return { label: 'T16', full: 'T16 - Khán giả từ 16 tuổi trở lên', bg: 'bg-orange-950/80 border-orange-500/40 text-orange-400' };
    case 'T18':
      return { label: 'T18', full: 'T18 - Khán giả từ 18 tuổi trở lên', bg: 'bg-rose-950/80 border-rose-500/40 text-rose-400' };
    default:
      return { label: rating || 'P', full: `${rating || 'P'} - Phổ biến`, bg: 'bg-neutral-800 border-white/20 text-neutral-300' };
  }
};

const getShowtimeEndTimeStr = (showtime, movieDurationMinutes = 120) => {
  if (!showtime?.startTime) return '--:--';
  if (showtime.endTime) {
    return new Date(showtime.endTime).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
  }
  const startMs = new Date(showtime.startTime).getTime();
  const endMs = startMs + (movieDurationMinutes || 120) * 60000;
  return new Date(endMs).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
};

const isShowtimeBookable = (showtime) => {
  if (!showtime?.startTime) return false;
  const startMs = new Date(showtime.startTime).getTime();
  // Khóa đặt vé trước 10 phút
  return startMs - Date.now() >= 10 * 60 * 1000;
};

const isToday = (dateStr) => {
  if (!dateStr) return false;
  return dateStr === getLocalDateString(new Date());
};

// Validate không để trống 1 ghế đơn lẻ ở giữa (Orphan Seat Rule XIV, XV, XVI)
export const validateOrphanSeats = (tentativeSelectedSeats, allSeats) => {
  const selectedSingles = tentativeSelectedSeats.filter(s => normalizeSeatType(s.type) === 'SINGLE');
  if (selectedSingles.length === 0) return { valid: true };

  const selectedSeatIds = new Set(tentativeSelectedSeats.map(s => s.id));
  const touchedRows = new Set(selectedSingles.map(s => s.row));

  for (const rowLetter of touchedRows) {
    const rowSeats = allSeats
      .filter(s => s.row === rowLetter && normalizeSeatType(s.type) === 'SINGLE')
      .sort((a, b) => (a.displayColumn - b.displayColumn) || (a.col - b.col));

    if (rowSeats.length === 0) continue;

    const sections = [];
    let currentSection = [];
    for (let i = 0; i < rowSeats.length; i++) {
      const seat = rowSeats[i];
      if (currentSection.length === 0) {
        currentSection.push(seat);
      } else {
        const prev = currentSection[currentSection.length - 1];
        if (seat.displayColumn - prev.displayColumn === 1) {
          currentSection.push(seat);
        } else {
          sections.push(currentSection);
          currentSection = [seat];
        }
      }
    }
    if (currentSection.length > 0) sections.push(currentSection);

    for (const section of sections) {
      const isTouched = section.some(s => selectedSeatIds.has(s.id));
      if (!isTouched) continue;

      let availableRunLength = 0;
      for (const seat of section) {
        const isOccupied = seat.isBooked || selectedSeatIds.has(seat.id);
        if (isOccupied) {
          if (availableRunLength === 1) {
            return {
              valid: false,
              message: 'Không thể để trống một ghế đơn lẻ giữa các ghế. Vui lòng chọn vị trí khác.'
            };
          }
          availableRunLength = 0;
        } else {
          availableRunLength++;
        }
      }
      if (availableRunLength === 1) {
        return {
          valid: false,
          message: 'Không thể để trống một ghế đơn lẻ giữa các ghế. Vui lòng chọn vị trí khác.'
        };
      }
    }
  }

  return { valid: true };
};

export default function BookingPage() {
  const navigate = useNavigate();
  const shouldReduceMotion = useReducedMotion();
  const { id } = useParams();
  const [searchParams] = useSearchParams();

  const { moviesList, setMoviesList, foodCatalog, fetchPublicFoodCatalog } = useMovies();
  const showToast = useUiStore((state) => state.showToast);
  const currentRole = useAuthStore((state) => state.currentRole);

  const [localMovie, setLocalMovie] = useState(null);
  const [isLoadingMovie, setIsLoadingMovie] = useState(!moviesList.some(m => String(m.id) === String(id) || String(m.backendId) === String(id)));
  const movie = localMovie || moviesList.find(m => String(m.id) === String(id) || String(m.backendId) === String(id));

  const isMovieBookable = movie?.status === 'NOW_SHOWING' || (!movie?.status && !movie?.isUpcoming);
  const onBack = () => navigate(-1);
  const onConfirmBooking = (booking) => {
    navigate('/tickets');
    showToast(`Đặt vé thành công! Mã đơn: ${booking.bookingCode || ''}`.trim());
  };

  const seatScrollRef = useRef(null);
  const scrollSeats = (direction) => {
    seatScrollRef.current?.scrollBy({ left: direction === 'left' ? -180 : 180, behavior: 'smooth' });
  };

  const concessions = foodCatalog;

  useEffect(() => {
    fetchPublicFoodCatalog();
  }, []);

  // Fetch movie data if not already available in moviesList (handles direct URL navigation)
  useEffect(() => {
    if (!id) return;
    let cancelled = false;

    const existing = moviesList.find(m => String(m.id) === String(id) || String(m.backendId) === String(id));
    if (existing) {
      setLocalMovie(existing);
      setIsLoadingMovie(false);
      return;
    }

    setIsLoadingMovie(true);
    const fetchMovieData = async () => {
      try {
        const { accessToken, user } = getStoredAuth();
        const isPrivileged = Boolean(
          accessToken && (
            currentRole === 'admin' ||
            currentRole === 'manager' ||
            currentRole === 'staff' ||
            hasBackendAdminAccess(accessToken, user) ||
            hasBackendManagerAccess(accessToken, user) ||
            hasBackendStaffAccess(accessToken, user)
          )
        );

        let data = null;
        if (isPrivileged) {
          try {
            data = await adminService.getAdminMovieDetail(accessToken, id);
          } catch (adminErr) {
            try {
              data = await movieService.getMovieDetail(id);
            } catch (pubErr) {
              console.warn('BookingPage: both admin and public fetch failed', adminErr, pubErr);
            }
          }
        } else {
          try {
            data = await movieService.getMovieDetail(id);
          } catch (pubErr) {
            if (accessToken) {
              try {
                data = await adminService.getAdminMovieDetail(accessToken, id);
              } catch (adminErr) {
                console.warn('BookingPage admin fallback failed', adminErr);
              }
            }
          }
        }

        if (cancelled) return;
        if (data && (data.id || data.title)) {
          setLocalMovie(data);
          if (typeof setMoviesList === 'function') {
            setMoviesList(prev => {
              const exists = prev.some(m => String(m.id) === String(data.id) || String(m.backendId) === String(data.id));
              return exists ? prev : [data, ...prev];
            });
          }
        }
      } catch (err) {
        console.error('Failed to load movie for booking:', err);
      } finally {
        if (!cancelled) setIsLoadingMovie(false);
      }
    };

    fetchMovieData();
    return () => { cancelled = true; };
  }, [id, currentRole]);

  useEffect(() => {
    if (!movie || isMovieBookable) return;
    if (movie.isUpcoming && movie.status !== 'SCHEDULED' && movie.status !== 'NOW_SHOWING') {
      showToast('Phim sắp chiếu chưa mở bán vé.');
      navigate(`/movies/${movie.id}`, { replace: true });
    }
  }, [movie?.id, movie?.status, movie?.isUpcoming, isMovieBookable]);

  // Showtime & seat map
  const [showtimesList, setShowtimesList] = useState([]);
  const [isLoadingShowtimes, setIsLoadingShowtimes] = useState(false);
  const [selectedShowtime, setSelectedShowtime] = useState(null);
  const [seatMapData, setSeatMapData] = useState(null);
  const [isLoadingSeatMap, setIsLoadingSeatMap] = useState(false);
  const [selectedDate, setSelectedDate] = useState('');
  const [selectedRoomKey, setSelectedRoomKey] = useState('ALL');

  // Selected seats (no demographic types, pure SINGLE or COUPLE)
  const [selectedSeats, setSelectedSeats] = useState([]);

  // Food Concessions
  const [selectedCombos, setSelectedCombos] = useState({});
  const [concessionsPage, setConcessionsPage] = useState(1);
  const concessionsTotalPages = Math.max(1, Math.ceil(concessions.length / CONCESSIONS_PAGE_SIZE));
  const safeConcessionsPage = Math.min(concessionsPage, concessionsTotalPages);
  const concessionsStartIndex = (safeConcessionsPage - 1) * CONCESSIONS_PAGE_SIZE;
  const paginatedConcessions = concessions.slice(concessionsStartIndex, concessionsStartIndex + CONCESSIONS_PAGE_SIZE);
  const concessionsDisplayStart = concessions.length === 0 ? 0 : concessionsStartIndex + 1;
  const concessionsDisplayEnd = Math.min(concessionsStartIndex + CONCESSIONS_PAGE_SIZE, concessions.length);

  // Voucher
  const [voucherInput, setVoucherInput] = useState('');
  const [appliedVoucher, setAppliedVoucher] = useState(null);
  const [voucherError, setVoucherError] = useState(null);

  // CinePoints (Loyalty)
  const [loyaltyPoints, setLoyaltyPoints] = useState(0);
  const [loyaltyPointsInput, setLoyaltyPointsInput] = useState('');
  const [loyaltyConfig, setLoyaltyConfig] = useState(DEFAULT_LOYALTY_CONFIG);

  // Booking & Hold states
  const [bookingStep, setBookingStep] = useState('schedule'); // 'schedule' | 'seats' | 'combos'
  const [holdBookingId, setHoldBookingId] = useState(null);
  const [holdExpiresAt, setHoldExpiresAt] = useState(null);
  const [holdSecondsLeft, setHoldSecondsLeft] = useState(null);
  const [seatClockTick, setSeatClockTick] = useState(Date.now());
  const [isHolding, setIsHolding] = useState(false);
  const [paymentState, setPaymentState] = useState('booking'); // 'booking' | 'payment_method' | 'payment_processing' | 'payment_failed' | 'payment_success'
  const [checkoutQuote, setCheckoutQuote] = useState(null);
  const [isLoadingQuote, setIsLoadingQuote] = useState(false);
  const [paidBooking, setPaidBooking] = useState(null);
  const resumeBookingId = searchParams.get('resumeBookingId');
  const [isLoadingResume, setIsLoadingResume] = useState(Boolean(resumeBookingId));
  const [resumedFoodsMap, setResumedFoodsMap] = useState({});

  const heldSeatIdsRef = useRef(null);

  // Cuộn lên đầu trang khi vào trang hoặc chuyển bước (Rule UX)
  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
  }, [bookingStep]);

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
  }, []);

  const genresDisplay = useMemo(() => {
    if (!movie) return '';
    if (Array.isArray(movie.genres)) {
      return movie.genres.map(g => (typeof g === 'object' ? g.name : g)).filter(Boolean).join(', ');
    }
    return movie.genre || '';
  }, [movie]);

  const ageBadgeMeta = useMemo(() => {
    return getAgeRatingBadgeMeta(movie?.ageRating);
  }, [movie?.ageRating]);

  // Load Loyalty Points & Config
  useEffect(() => {
    const { accessToken } = getStoredAuth();
    if (!accessToken) {
      setLoyaltyPoints(0);
      setLoyaltyConfig(DEFAULT_LOYALTY_CONFIG);
      return;
    }
    let cancelled = false;
    Promise.all([
      loyaltyService.getMyLoyalty(accessToken),
      loyaltyService.getConfiguration(accessToken)
    ])
      .then(([loyalty, config]) => {
        if (cancelled) return;
        setLoyaltyPoints(Number(loyalty?.points ?? 0));
        setLoyaltyConfig({ ...DEFAULT_LOYALTY_CONFIG, ...(config || {}) });
      })
      .catch(() => {
        if (!cancelled) {
          setLoyaltyPoints(0);
          setLoyaltyConfig(DEFAULT_LOYALTY_CONFIG);
        }
      });
    return () => { cancelled = true; };
  }, []);

  // Load Showtimes for Movie (loads immediately using id without waiting for movie store)
  useEffect(() => {
    const targetMovieId = Number(movie?.backendId || movie?.id || id);
    if (!targetMovieId || isNaN(targetMovieId)) return;

    let cancelled = false;
    setIsLoadingShowtimes(true);
    bookingService.getShowtimes({ movieId: targetMovieId })
      .then(data => {
        if (cancelled) return;
        const rawList = Array.isArray(data) ? data : (data?.items ?? data?.content ?? []);
        const upcoming = rawList.filter(st => new Date(st.startTime) > new Date());
        const list = sortShowtimes(upcoming);
        setShowtimesList(list);
        if (list.length > 0) {
          const preferId = searchParams.get('showtimeId');
          const isResuming = Boolean(searchParams.get('resumeBookingId'));
          const preferred = preferId ? list.find(st => String(st.id) === String(preferId)) : null;
          const first = preferred || list[0];
          const date = first.startTime?.split('T')[0] || '';
          
          if (!isResuming) {
            setSelectedDate(date);
            setSelectedRoomKey('ALL');
            setSelectedShowtime(first);
            if (preferId && preferred) {
              setBookingStep('seats');
            } else {
              setBookingStep('schedule');
            }
          }
        } else {
          if (!searchParams.get('resumeBookingId')) {
            setSelectedDate('');
            setSelectedRoomKey('ALL');
            setSelectedShowtime(null);
            setBookingStep('schedule');
          }
        }
      })
      .catch((err) => {
        if (cancelled) return;
        console.warn('BookingPage: failed to load showtimes:', err);
        setShowtimesList([]);
        if (!searchParams.get('resumeBookingId')) {
          setSelectedDate('');
          setSelectedRoomKey('ALL');
          setSelectedShowtime(null);
          setBookingStep('schedule');
        }
      })
      .finally(() => {
        if (!cancelled) setIsLoadingShowtimes(false);
      });

    return () => { cancelled = true; };
  }, [id, movie?.backendId, movie?.id]);

  // Load Resumed Booking (khi bấm "Tiếp tục thanh toán" từ trang /tickets)
  useEffect(() => {
    if (!resumeBookingId) {
      setIsLoadingResume(false);
      return;
    }

    const { accessToken } = getStoredAuth();
    if (!accessToken) {
      showToast('Vui lòng đăng nhập để tiếp tục thanh toán.');
      navigate('/tickets', { replace: true });
      return;
    }

    let cancelled = false;
    setIsLoadingResume(true);

    const loadResume = async () => {
      try {
        const booking = await bookingService.getMyBooking(accessToken, Number(resumeBookingId));
        if (cancelled || !booking?.id) return;

        // Kiểm tra xem đơn giữ chỗ có còn hiệu lực không
        const isExpired = booking.status === 'EXPIRED'
          || booking.status === 'CANCELLED'
          || (booking.holdExpiresAt && new Date(booking.holdExpiresAt).getTime() <= Date.now());

        if (isExpired) {
          showToast('Đơn giữ chỗ này đã hết hạn. Ghế đã được giải phóng.');
          navigate('/tickets', { replace: true });
          return;
        }

        // 1. Lưu Hold Booking ID & Ref các ghế đang được giữ
        setHoldBookingId(booking.id);
        const seatIds = (booking.seats || []).map(s => s.seatId);
        heldSeatIdsRef.current = seatIds;

        // 2. Lưu thời gian giữ ghế & đếm ngược
        if (booking.holdExpiresAt) {
          setHoldExpiresAt(booking.holdExpiresAt);
          const sec = Math.max(0, Math.ceil((new Date(booking.holdExpiresAt).getTime() - Date.now()) / 1000));
          setHoldSecondsLeft(sec);
        }

        // 3. Khôi phục ngày chiếu
        const dateStr = booking.showtimeStart ? booking.showtimeStart.split('T')[0] : getLocalDateString(new Date());
        setSelectedDate(dateStr);

        // 4. Khôi phục thông tin suất chiếu
        let st = showtimesList.find(s => String(s.id) === String(booking.showtimeId));
        if (!st && booking.showtimeId) {
          try {
            st = await bookingService.getShowtimeDetail(booking.showtimeId);
          } catch {
            st = {
              id: booking.showtimeId,
              movieId: booking.movieId,
              movieTitle: booking.movieTitle,
              roomName: booking.roomName,
              startTime: booking.showtimeStart,
              endTime: booking.showtimeEnd,
              posterUrl: booking.posterUrl
            };
          }
        }
        if (st) {
          setSelectedShowtime(st);
          bookingService.getSeatMap(st.id)
            .then(mapData => { if (!cancelled) setSeatMapData(mapData); })
            .catch(() => {});
        }

        // 5. Khôi phục toàn bộ danh sách Ghế khách đã chọn
        if (Array.isArray(booking.seats) && booking.seats.length > 0) {
          const restoredSeats = booking.seats.map(s => ({
            id: `${s.rowLabel}${s.seatNumber}`,
            seatId: s.seatId,
            row: s.rowLabel,
            col: s.seatNumber,
            type: normalizeSeatType(s.ticketType || s.seatType),
            price: moneyValue(s.unitPrice) || 0,
            isBooked: false
          }));
          setSelectedSeats(restoredSeats);
        }

        // 6. Khôi phục toàn bộ danh sách Bắp nước (Foods/Combos)
        if (Array.isArray(booking.foods) && booking.foods.length > 0) {
          const restoredCombos = {};
          const fallbackMap = {};
          booking.foods.forEach(f => {
            const isCombo = Boolean(f.foodComboId);
            const matched = concessions.find(c => {
              if (isCombo) {
                return (c.isCombo || c.foodComboId || String(c.id).startsWith('combo-'))
                  && (String(c.foodComboId) === String(f.foodComboId) || String(c.backendId) === String(f.foodComboId));
              }
              return (!c.isCombo && !c.foodComboId)
                && (String(c.foodItemId) === String(f.foodItemId) || String(c.backendId) === String(f.foodItemId));
            }) || concessions.find(c => f.name && c.name?.toLowerCase() === f.name?.toLowerCase());

            const key = matched ? matched.id : (isCombo ? `combo-${f.foodComboId}` : `item-${f.foodItemId || f.name}`);
            restoredCombos[key] = (restoredCombos[key] || 0) + (Number(f.quantity) || 1);
            fallbackMap[key] = {
              id: key,
              name: f.name || 'Bắp nước',
              price: moneyValue(f.unitPrice) || 0,
              isCombo,
              foodItemId: isCombo ? null : f.foodItemId,
              foodComboId: isCombo ? f.foodComboId : null
            };
          });
          setSelectedCombos(restoredCombos);
          setResumedFoodsMap(fallbackMap);
        }

        // 7. Khôi phục điểm thưởng đã áp dụng
        if (booking.loyaltyPointsRedeemed > 0) {
          setLoyaltyPointsInput(String(booking.loyaltyPointsRedeemed));
        }

        // 8. Chuyển thẳng sang bước thanh toán với toàn bộ thông tin được bảo toàn
        setPaymentState('payment_method');
        showToast(`Đã khôi phục toàn bộ thông tin đơn giữ vé #${booking.bookingCode || booking.id}.`);
      } catch (err) {
        if (!cancelled) {
          console.error('Error resuming booking:', err);
          showToast(err?.message || 'Không thể khôi phục đơn giữ vé.');
        }
      } finally {
        if (!cancelled) setIsLoadingResume(false);
      }
    };

    void loadResume();

    return () => {
      cancelled = true;
    };
  }, [resumeBookingId, concessions]);

  // Load Seat Map when Showtime Changes
  const refreshSeatMap = async () => {
    if (!selectedShowtime?.id) return;
    try {
      const data = await bookingService.getSeatMap(selectedShowtime.id);
      setSeatMapData(data);
    } catch {
      setSeatMapData(null);
    }
  };

  useEffect(() => {
    if (!selectedShowtime?.id) { setSeatMapData(null); return; }
    setIsLoadingSeatMap(true);
    if (!resumeBookingId || !heldSeatIdsRef.current || heldSeatIdsRef.current.length === 0) {
      setSelectedSeats([]);
    }
    bookingService.getSeatMap(selectedShowtime.id)
      .then(data => setSeatMapData(data))
      .catch(() => setSeatMapData(null))
      .finally(() => setIsLoadingSeatMap(false));
  }, [selectedShowtime?.id]);

  // Derived: Hiển thị 7 ngày liên tiếp tính từ hôm nay và các ngày có suất chiếu khả dụng
  const dateOptions = useMemo(() => {
    const today = new Date();
    const datesSet = new Set();
    for (let i = 0; i < 7; i++) {
      const d = new Date(today);
      d.setDate(today.getDate() + i);
      datesSet.add(getLocalDateString(d));
    }
    showtimesList.forEach(st => {
      const dateStr = st.startTime?.split('T')[0];
      if (dateStr && new Date(dateStr) >= new Date(getLocalDateString(today))) {
        datesSet.add(dateStr);
      }
    });
    return Array.from(datesSet).sort();
  }, [showtimesList]);

  const showtimesForDate = useMemo(() => {
    return showtimesList.filter(st => st.startTime?.split('T')[0] === selectedDate);
  }, [showtimesList, selectedDate]);

  const roomOptionsForDate = useMemo(() => {
    return showtimesForDate.reduce((rooms, st) => {
      const key = getShowtimeRoomKey(st);
      if (!rooms.some(room => room.key === key)) {
        rooms.push({
          key,
          name: st.roomName || st.room?.name || 'Chưa rõ phòng',
          roomType: st.roomType || st.room?.roomType || ''
        });
      }
      return rooms;
    }, []);
  }, [showtimesForDate]);

  const showtimesForSelectedRoom = useMemo(() => {
    if (!selectedRoomKey || selectedRoomKey === 'ALL') {
      return showtimesForDate;
    }
    return showtimesForDate.filter(st => getShowtimeRoomKey(st) === selectedRoomKey);
  }, [showtimesForDate, selectedRoomKey]);

  // Đổi suất chiếu / đổi ngày: giải phóng hold cũ nếu có (Rule XXVII)
  const handleReleaseOldHoldIfAny = async () => {
    if (!holdBookingId) return;
    const { accessToken } = getStoredAuth();
    if (accessToken) {
      try {
        await bookingService.releaseHold(accessToken, holdBookingId);
      } catch (e) {
        console.warn('Failed to release hold on showtime switch:', e);
      }
    }
    setHoldBookingId(null);
    setHoldExpiresAt(null);
    setHoldSecondsLeft(null);
  };

  const handleSelectDate = async (date) => {
    await handleReleaseOldHoldIfAny();
    setSelectedDate(date);
    const candidate = showtimesList.filter(st => st.startTime?.split('T')[0] === date);
    if (candidate.length > 0) {
      if (!selectedShowtime || selectedShowtime.startTime?.split('T')[0] !== date) {
        setSelectedShowtime(candidate[0]);
      }
    } else {
      setSelectedShowtime(null);
    }
    setSelectedSeats([]);
    setSelectedCombos({});
  };

  const handleSelectRoom = async (roomKey) => {
    await handleReleaseOldHoldIfAny();
    setSelectedRoomKey(roomKey);
    const filtered = roomKey === 'ALL'
      ? showtimesForDate
      : showtimesForDate.filter(st => getShowtimeRoomKey(st) === roomKey);
    if (filtered.length > 0 && (!selectedShowtime || !filtered.some(st => st.id === selectedShowtime.id))) {
      setSelectedShowtime(filtered[0]);
    }
    setSelectedSeats([]);
    setSelectedCombos({});
  };

  const handleSelectShowtime = async (st) => {
    if (selectedShowtime?.id === st.id) return;
    await handleReleaseOldHoldIfAny();
    setSelectedShowtime(st);
    setSelectedSeats([]);
    setSelectedCombos({});
  };

  const handleProceedToSeats = () => {
    if (!selectedShowtime) {
      showToast('Vui lòng chọn một suất chiếu trước.');
      return;
    }
    if (!isShowtimeBookable(selectedShowtime)) {
      showToast('Suất chiếu này đã bắt đầu hoặc quá thời gian đặt vé online.');
      return;
    }
    setBookingStep('seats');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleBackToSchedule = async () => {
    await handleReleaseOldHoldIfAny();
    setSelectedSeats([]);
    setBookingStep('schedule');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Map seats from seatMapData
  const seats = useMemo(() => {
    if (!seatMapData?.seats) return [];
    return seatMapData.seats.map(s => {
      const seatTypeNorm = normalizeSeatType(s.seatType);
      const isMyHeldSeat = (heldSeatIdsRef.current && heldSeatIdsRef.current.includes(s.seatId))
        || selectedSeats.some(sel => sel.seatId === s.seatId);
      const isBooked = !isMyHeldSeat && (
        s.runtimeStatus === 'HOLDING'
        || s.runtimeStatus === 'BOOKED'
        || s.runtimeStatus === 'CHECKED_IN'
        || s.seatStatus !== 'AVAILABLE'
      );
      return {
        id: `${s.rowLabel}${s.seatNumber}`,
        seatId: s.seatId,
        row: s.rowLabel,
        col: s.seatNumber,
        displayOrder: s.displayOrder ?? 0,
        displayColumn: s.displayColumn ?? s.seatNumber,
        startColumn: s.startColumn ?? 1,
        type: seatTypeNorm, // 'SINGLE' or 'COUPLE'
        price: moneyValue(s.unitPrice) ?? 0,
        runtimeStatus: s.runtimeStatus,
        holdExpiresAt: s.holdExpiresAt || null,
        isBooked
      };
    }).sort((a, b) => (a.displayOrder - b.displayOrder) || (a.displayColumn - b.displayColumn) || (a.col - b.col));
  }, [seatMapData, selectedSeats]);

  // Dynamic Prices from Showtime (Rule 4, 5, 14)
  const defaultSinglePrice = selectedShowtime?.basePrice || 90000;
  const defaultCouplePrice = selectedShowtime?.couplePrice || (defaultSinglePrice * 2);

  // Seat selection: click trực tiếp, không cần chọn quantity trước (Rule 2, 3, 6, 7, 15, XIV, XV, XVI)
  const handleSelectSeat = (seat) => {
    if (seat.isBooked) return;

    const isCoupleSeat = normalizeSeatType(seat.type) === 'COUPLE';
    const seatGroup = isCoupleSeat ? getCoupleSeatPair(seat, seats) : [seat];

    if (isCoupleSeat && (seatGroup.length !== 2 || seatGroup.some(groupSeat => groupSeat.isBooked))) {
      showToast('Ghế đôi phải chọn nguyên cặp, hiện có ghế trong cặp đã được đặt hoặc không khả dụng.');
      return;
    }

    const selectedSeatIds = new Set(selectedSeats.map(s => s.id));
    const alreadySelected = seatGroup.some(groupSeat => selectedSeatIds.has(groupSeat.id));

    if (alreadySelected) {
      // Deselect whole pair or single seat
      setSelectedSeats(prev => prev.filter(s => !seatGroup.some(groupSeat => groupSeat.id === s.id)));
    } else {
      // Limit total seats per booking to 8
      if (selectedSeats.length + seatGroup.length > 8) {
        showToast('Mỗi đơn đặt vé tối đa 8 ghế.');
        return;
      }
      const tentative = [...selectedSeats, ...seatGroup];
      const gapCheck = validateOrphanSeats(tentative, seats);
      if (!gapCheck.valid) {
        showToast(gapCheck.message);
        return;
      }
      setSelectedSeats(tentative);
    }
  };

  // Build food requests for quote/hold
  const buildFoodRequests = () => Object.entries(selectedCombos)
    .map(([rawId, quantity]) => {
      const q = Number(quantity);
      if (!q || q <= 0) return null;

      const item = concessions.find(i => String(i.id) === String(rawId) || String(i.backendId) === String(rawId));

      const isCombo = Boolean(
        String(rawId).startsWith('combo-')
        || item?.isCombo
        || item?.category === 'combo'
        || item?.foodComboId
        || String(item?.id).startsWith('combo-')
      );

      const numericId = Number(
        (isCombo ? (item?.foodComboId ?? item?.backendId) : (item?.foodItemId ?? item?.backendId))
        ?? String(rawId).replace(/^(combo|item)-/, '')
      );

      if (!numericId || isNaN(numericId)) return null;

      return {
        foodItemId: isCombo ? null : numericId,
        foodComboId: isCombo ? numericId : null,
        quantity: q
      };
    })
    .filter(Boolean);

  // Checkout Quote Fetching (Rule 32, 33, 34)
  const pointsToUseNumber = Math.max(0, Number(String(loyaltyPointsInput || '').replace(/\D/g, '')) || 0);

  useEffect(() => {
    if (!selectedShowtime?.id || selectedSeats.length === 0) {
      setCheckoutQuote(null);
      return;
    }

    const { accessToken } = getStoredAuth();
    let cancelled = false;
    setIsLoadingQuote(true);

    bookingService.getCheckoutQuote(accessToken, {
      showtimeId: selectedShowtime.id,
      seatIds: selectedSeats.map(s => s.seatId),
      foods: buildFoodRequests(),
      voucherCode: appliedVoucher ? appliedVoucher.code : (voucherInput.trim() || null),
      cinePointsToUse: pointsToUseNumber > 0 ? pointsToUseNumber : null
    })
      .then((quote) => {
        if (cancelled) return;
        setCheckoutQuote(quote);
        if (appliedVoucher && quote.discount <= 0 && quote.voucherMessage) {
          setVoucherError(quote.voucherMessage);
        } else {
          setVoucherError(null);
        }
      })
      .catch((err) => {
        if (cancelled) return;
        setCheckoutQuote(null);
        console.warn('Checkout quote error:', err);
      })
      .finally(() => {
        if (!cancelled) setIsLoadingQuote(false);
      });

    return () => { cancelled = true; };
  }, [selectedShowtime?.id, selectedSeats, selectedCombos, appliedVoucher, pointsToUseNumber]);

  // Hold Timer countdown (Rule 19 & 20)
  useEffect(() => {
    if (!holdExpiresAt || !holdBookingId || paymentState === 'payment_success') return;

    const tick = () => {
      const expiresAtMs = new Date(holdExpiresAt).getTime();
      if (Number.isNaN(expiresAtMs)) {
        setHoldSecondsLeft(null);
        return;
      }
      const secondsLeft = Math.max(0, Math.ceil((expiresAtMs - Date.now()) / 1000));
      setHoldSecondsLeft(secondsLeft);

      if (secondsLeft === 0) {
        showToast('Thời gian giữ ghế đã hết. Vui lòng chọn lại ghế.');
        setPaymentState('booking');
        setBookingStep('seats');
        setSelectedSeats([]);
        setHoldBookingId(null);
        setHoldExpiresAt(null);
        refreshSeatMap();
      }
    };

    tick();
    const intervalId = window.setInterval(tick, 1000);
    return () => window.clearInterval(intervalId);
  }, [holdExpiresAt, holdBookingId, paymentState]);

  // Concessions modification
  const handleModifyCombo = (id, operator) => {
    const product = concessions.find((item) => item.id === id);
    const maxQuantity = isFoodSelectable(product) ? 3 : 0;
    setSelectedCombos(prev => {
      const qty = prev[id] || 0;
      let next = operator === '+' ? Math.min(maxQuantity, qty + 1) : Math.max(0, qty - 1);
      if (operator === '+' && qty >= 3) showToast('Tối đa 3 phần mỗi sản phẩm.');
      if (operator === '+' && maxQuantity === 0) showToast('Món này hiện đang hết.');
      const updated = { ...prev };
      if (next === 0) delete updated[id]; else updated[id] = next;
      return updated;
    });
  };

  // Voucher apply handler
  const handleApplyVoucher = () => {
    if (!voucherInput.trim()) {
      showToast('Vui lòng nhập mã ưu đãi.');
      return;
    }
    setAppliedVoucher({ code: voucherInput.trim().toUpperCase() });
    showToast(`Đang kiểm tra mã ${voucherInput.trim().toUpperCase()}...`);
  };

  const handleRemoveVoucher = () => {
    setAppliedVoucher(null);
    setVoucherInput('');
    setVoucherError(null);
    showToast('Đã bỏ áp dụng mã ưu đãi.');
  };

  // Group selected seats for summary (Rule 16)
  const selectedSeatsSummary = useMemo(() => {
    const items = [];
    const processedIds = new Set();

    for (const seat of selectedSeats) {
      if (processedIds.has(seat.id)) continue;
      const isCouple = normalizeSeatType(seat.type) === 'COUPLE';
      if (isCouple) {
        const pair = getCoupleSeatPair(seat, seats);
        pair.forEach(p => processedIds.add(p.id));
        const pairCode = pair.map(p => `${p.row}${p.col}`).join('-');
        items.push({
          code: pairCode || `${seat.row}${seat.col}`,
          label: 'Ghế đôi',
          seatType: 'COUPLE',
          capacity: 2,
          price: defaultCouplePrice
        });
      } else {
        processedIds.add(seat.id);
        items.push({
          code: `${seat.row}${seat.col}`,
          label: 'Ghế đơn',
          seatType: 'SINGLE',
          capacity: 1,
          price: defaultSinglePrice
        });
      }
    }

    const singleCount = items.filter(i => i.seatType === 'SINGLE').length;
    const coupleCount = items.filter(i => i.seatType === 'COUPLE').length;
    const totalCapacity = singleCount * 1 + coupleCount * 2;

    return {
      items,
      singleCount,
      coupleCount,
      totalCapacity
    };
  }, [selectedSeats, seats, defaultSinglePrice, defaultCouplePrice]);

  // Hold Seats on Backend
  const handleProceedToCombos = () => {
    if (selectedSeats.length === 0) {
      showToast('Vui lòng chọn ít nhất một ghế.');
      return;
    }
    const gapCheck = validateOrphanSeats(selectedSeats, seats);
    if (!gapCheck.valid) {
      showToast(gapCheck.message);
      return;
    }
    setBookingStep('combos');
  };

  const handleProceedToPayment = async () => {
    if (selectedSeats.length === 0) {
      showToast('Vui lòng chọn ghế.');
      return;
    }
    const gapCheck = validateOrphanSeats(selectedSeats, seats);
    if (!gapCheck.valid) {
      showToast(gapCheck.message);
      return;
    }
    const { accessToken } = getStoredAuth();
    if (!accessToken) {
      showToast('Vui lòng đăng nhập để tiếp tục thanh toán.');
      navigate('/login');
      return;
    }

    setIsHolding(true);
    try {
      if (holdBookingId) {
        // Cập nhật bắp nước và điểm thưởng vào hold hiện tại mà KHÔNG hủy giữ ghế
        try {
          const updated = await bookingService.updateHoldingBooking(accessToken, holdBookingId, {
            foods: buildFoodRequests(),
            loyaltyPointsToRedeem: pointsToUseNumber > 0 ? pointsToUseNumber : null
          });
          if (updated?.holdExpiresAt) {
            setHoldExpiresAt(updated.holdExpiresAt);
          }
          setPaymentState('payment_method');
          return;
        } catch (updateErr) {
          console.warn('Could not update holding booking items, fallback to re-hold:', updateErr);
        }
      }

      const holdResult = await bookingService.holdSeats(accessToken, {
        showtimeId: selectedShowtime.id,
        seatIds: selectedSeats.map(s => s.seatId),
        foods: buildFoodRequests(),
        loyaltyPointsToRedeem: pointsToUseNumber > 0 ? pointsToUseNumber : null
      });

      setHoldBookingId(holdResult.id);
      heldSeatIdsRef.current = selectedSeats.map(s => s.seatId);
      setHoldExpiresAt(holdResult.holdExpiresAt || holdResult.expiresAt || null);
      setPaymentState('payment_method');
    } catch (err) {
      showToast(err?.message || 'Không thể giữ ghế. Vui lòng thử lại.');
      refreshSeatMap();
    } finally {
      setIsHolding(false);
    }
  };

  // VNPay payment flow
  const handleVnpayPayment = async () => {
    if (!holdBookingId) {
      showToast('Không tìm thấy thông tin đặt chỗ. Vui lòng thao tác lại.');
      return;
    }
    const { accessToken } = getStoredAuth();
    if (!accessToken) {
      showToast('Vui lòng đăng nhập lại.');
      return;
    }

    setPaymentState('payment_processing');
    try {
      // Tạo URL thanh toán VNPay
      const res = await paymentService.createVnpayPaymentUrl(accessToken, {
        bookingId: holdBookingId
      });
      if (res?.paymentUrl) {
        window.location.href = res.paymentUrl;
      } else {
        throw new Error('Không nhận được URL thanh toán từ VNPay.');
      }
    } catch (err) {
      showToast(err?.message || 'Không thể kết nối cổng VNPay.');
      setPaymentState('payment_failed');
    }
  };

  // Showtimes calculations
  const selectedShowtimeEnd = useMemo(() => {
    if (!selectedShowtime?.startTime) return null;
    const start = new Date(selectedShowtime.startTime);
    const duration = movie?.durationMinutes || 120;
    return new Date(start.getTime() + duration * 60000);
  }, [selectedShowtime, movie]);

  // Totals from Checkout Quote (Source of Truth) or Fallback
  const displayTicketSubtotal = checkoutQuote?.ticketSubtotal ?? (selectedSeatsSummary.items.reduce((s, i) => s + i.price, 0));
  const displayFoodSubtotal = checkoutQuote?.foodSubtotal ?? 0;
  const displaySubtotal = checkoutQuote?.subtotal ?? (displayTicketSubtotal + displayFoodSubtotal);
  const displayDiscount = checkoutQuote?.discount ?? 0;
  const displayPointsDiscount = checkoutQuote?.cinePointsDiscount ?? 0;
  const displayTotal = checkoutQuote?.total ?? Math.max(0, displaySubtotal - displayDiscount - displayPointsDiscount);

  if (isLoadingResume) {
    return (
      <div className="min-h-screen bg-black flex flex-col items-center justify-center text-white space-y-3">
        <Loader2 className="h-8 w-8 text-amber-500 animate-spin" />
        <p className="text-xs font-bold uppercase tracking-wider text-neutral-300">
          Đang khôi phục thông tin đặt vé...
        </p>
      </div>
    );
  }

  if (!movie) {
    return <div className="min-h-screen bg-black flex items-center justify-center text-white">Đang tải phim...</div>;
  }

  // SUB-VIEW: PAYMENT METHOD / PROCESSING / FAILED / SUCCESS
  if (paymentState !== 'booking') {
    return (
      <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6 lg:px-8 space-y-8 pb-24 text-white">
        {/* Security Header */}
        <div className="flex items-center justify-between border-b border-white/10 pb-5">
          <div className="flex items-center space-x-3">
            <div className="h-2.5 w-2.5 rounded-full bg-emerald-500 animate-pulse"></div>
            <div>
              <h1 className="text-lg font-mono text-neutral-200 uppercase tracking-widest font-black flex items-center gap-2">
                CỔNG THANH TOÁN BẢO MẬT • CINEPREMIER
              </h1>
              <p className="text-[10px] text-neutral-400 uppercase tracking-wider">Chứng thực giao dịch mã hóa an toàn 256-bit</p>
            </div>
          </div>

          {paymentState === 'payment_method' && (
            <button
              onClick={() => { setPaymentState('booking'); setBookingStep('combos'); }}
              className="text-xs text-neutral-300 hover:text-white border border-white/20 hover:border-white px-3 py-1.5 uppercase font-mono tracking-wider transition bg-neutral-900 rounded"
            >
              ← Quay lại chọn thêm bắp nước
            </button>
          )}
        </div>

        {/* Processing Loader */}
        {paymentState === 'payment_processing' && (
          <div className="border border-white/10 bg-neutral-950 p-12 text-center my-12 space-y-6 max-w-xl mx-auto flex flex-col items-center justify-center rounded-2xl">
            <Loader2 className="h-12 w-12 text-amber-500 animate-spin" />
            <div className="space-y-2">
              <h3 className="text-base font-bold text-white uppercase tracking-wider">Đang kết nối cổng VNPay...</h3>
              <p className="text-xs text-neutral-400">Vui lòng không tắt hoặc tải lại trình duyệt.</p>
            </div>
          </div>
        )}

        {/* Payment Failed */}
        {paymentState === 'payment_failed' && (
          <div className="border border-rose-500/30 bg-neutral-950 p-8 my-8 max-w-xl mx-auto text-center space-y-6 rounded-2xl">
            <XCircle className="h-14 w-14 text-rose-500 mx-auto" />
            <div className="space-y-2">
              <h3 className="text-lg font-bold text-rose-400 uppercase">Thanh Toán Chưa Hoàn Tất</h3>
              <p className="text-xs text-neutral-300">Giao dịch bị gián đoạn hoặc bị hủy. Ghế vẫn được giữ trong thời gian đếm ngược.</p>
            </div>
            <div className="flex justify-center gap-3">
              <button
                onClick={() => setPaymentState('payment_method')}
                className="px-5 py-2.5 bg-amber-500 hover:bg-amber-400 text-black font-bold text-xs uppercase tracking-wider rounded-xl transition"
              >
                Thử thanh toán lại
              </button>
              <button
                onClick={() => { setPaymentState('booking'); setBookingStep('seats'); }}
                className="px-5 py-2.5 bg-neutral-800 hover:bg-neutral-700 text-white font-bold text-xs uppercase tracking-wider rounded-xl transition"
              >
                Quay lại chọn ghế
              </button>
            </div>
          </div>
        )}

        {/* Select Payment Method */}
        {paymentState === 'payment_method' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            {/* Left: Summary */}
            <div className="lg:col-span-5 border border-white/10 bg-neutral-950 p-6 space-y-5 rounded-2xl shadow-xl">
              <span className="text-xs font-bold tracking-wider text-amber-500 uppercase block">CHI TIẾT HÓA ĐƠN</span>

              <div className="flex items-start gap-4 border-b border-white/10 pb-4">
                <img src={movie.posterUrl} alt={movie.title} className="h-20 w-14 object-cover rounded-lg border border-white/10 shrink-0" />
                <div>
                  <h4 className="text-sm font-bold text-white uppercase">{movie.title}</h4>
                  <p className="text-xs text-neutral-400">{selectedShowtime?.roomName} • {selectedShowtime?.startTime?.slice(11, 16)}</p>
                  <p className="text-xs text-amber-400 font-semibold">{selectedDate}</p>
                </div>
              </div>

              {/* Items */}
              <div className="space-y-2 text-xs border-b border-white/10 pb-4">
                <div className="font-semibold text-neutral-300 uppercase tracking-wider">Danh sách vé ({selectedSeatsSummary.totalCapacity} người):</div>
                {selectedSeatsSummary.items.map((item, idx) => (
                  <div key={idx} className="flex justify-between text-neutral-400">
                    <span>{item.code} ({item.label})</span>
                    <span className="text-white font-mono">{formatVnd(item.price)}</span>
                  </div>
                ))}

                {/* Foods */}
                {Object.entries(selectedCombos).map(([id, q]) => {
                  const it = concessions.find(i => i.id === id) || resumedFoodsMap[id];
                  if (!it || q <= 0) return null;
                  return (
                    <div key={id} className="flex justify-between text-neutral-400 pt-1">
                      <span>{it.name} ×{q}</span>
                      <span className="text-white font-mono">{formatVnd((it.price || it.unitPrice || 0) * q)}</span>
                    </div>
                  );
                })}
              </div>

              {/* Totals */}
              <div className="space-y-2 text-xs">
                <div className="flex justify-between text-neutral-400">
                  <span>Tạm tính:</span>
                  <span className="font-mono text-white">{formatVnd(displaySubtotal)}</span>
                </div>
                {displayDiscount > 0 && (
                  <div className="flex justify-between text-emerald-400">
                    <span>Ưu đãi voucher:</span>
                    <span className="font-mono">-{formatVnd(displayDiscount)}</span>
                  </div>
                )}
                {displayPointsDiscount > 0 && (
                  <div className="flex justify-between text-amber-400">
                    <span>CinePoints:</span>
                    <span className="font-mono">-{formatVnd(displayPointsDiscount)}</span>
                  </div>
                )}
                <div className="flex justify-between text-base font-bold text-white border-t border-white/10 pt-3">
                  <span>TỔNG THANH TOÁN:</span>
                  <span className="font-mono text-amber-400 text-lg">{formatVnd(displayTotal)}</span>
                </div>
              </div>
            </div>

            {/* Right: VNPay Gateway */}
            <div className="lg:col-span-7 border border-white/10 bg-neutral-950 p-6 space-y-6 rounded-2xl flex flex-col justify-between">
              <div className="space-y-4">
                <div>
                  <h3 className="text-base font-bold text-white uppercase tracking-wider">Cổng Thanh Toán Trực Tuyến</h3>
                  <p className="text-xs text-neutral-400 mt-1">Chọn phương thức thanh toán an toàn và tiện lợi qua VNPay (Hỗ trợ Thẻ ATM / QR Ngân hàng / Visa / Master).</p>
                </div>

                {/* Hold Timer Banner (Rule 19) */}
                <div className="border border-amber-500/30 bg-amber-950/20 p-4 rounded-xl flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Clock className="w-5 h-5 text-amber-400 animate-pulse" />
                    <div>
                      <div className="text-xs font-bold text-white uppercase">Thời Gian Giữ Ghế</div>
                      <div className="text-[11px] text-neutral-400">Ghế được bảo đảm giữ trong thời gian này</div>
                    </div>
                  </div>
                  <div className="font-mono font-bold text-lg text-amber-400">
                    {holdSecondsLeft !== null ? formatHoldSeconds(holdSecondsLeft) : '10:00'}
                  </div>
                </div>

                <div className="border border-emerald-500/20 bg-emerald-950/10 p-5 rounded-xl space-y-3">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 bg-emerald-950/30 border border-emerald-500/30 rounded-lg flex items-center justify-center text-emerald-400 shrink-0">
                      <CheckCircle className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-white uppercase">VNPay Sandbox / Realtime Gateway</p>
                      <p className="text-[10px] text-neutral-400">Thanh toán bảo mật chuẩn quốc tế PCI-DSS</p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="space-y-3 pt-4">
                <button
                  onClick={handleVnpayPayment}
                  className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-amber-500 to-amber-400 hover:from-amber-400 hover:to-amber-300 text-black font-extrabold uppercase tracking-wider text-sm py-4 rounded-xl shadow-lg shadow-amber-500/20 transition"
                >
                  <CheckCircle className="h-5 w-5" />
                  <span>Xác nhận & Thanh toán {formatVnd(displayTotal)}</span>
                </button>
                <p className="text-[10px] text-neutral-500 text-center uppercase tracking-wider">
                  Sau khi thanh toán thành công, vé điện tử và mã QR sẽ hiển thị ngay lập tức
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // Loading movie state
  if (isLoadingMovie && !movie) {
    return (
      <div className="min-h-[70vh] bg-[#0a0c10] flex flex-col items-center justify-center space-y-4 px-4 text-center">
        <div className="relative">
          <div className="w-14 h-14 rounded-full border-2 border-amber-500/20 border-t-amber-400 animate-spin" />
          <Film className="w-6 h-6 text-amber-400 absolute inset-0 m-auto animate-pulse" />
        </div>
        <p className="text-xs font-sans uppercase tracking-[0.2em] text-neutral-400 animate-pulse">
          Đang tải thông tin phim & lịch chiếu...
        </p>
      </div>
    );
  }

  // Movie not found state
  if (!movie && !isLoadingMovie) {
    return (
      <div className="min-h-[70vh] bg-[#0a0c10] flex flex-col items-center justify-center space-y-6 px-4 text-center">
        <div className="w-16 h-16 rounded-2xl bg-neutral-900 border border-white/10 flex items-center justify-center text-neutral-500 shadow-xl">
          <Film className="w-8 h-8 text-neutral-600" />
        </div>
        <div className="space-y-2 max-w-md">
          <h2 className="text-xl font-bold text-white uppercase tracking-wider">Không tìm thấy thông tin phim</h2>
          <p className="text-xs text-neutral-400 font-sans leading-relaxed">
            Phim này có thể chưa được xuất bản hoặc đường dẫn đặt vé không chính xác.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate(-1)}
            className="px-5 py-2.5 bg-neutral-900 hover:bg-neutral-800 text-white border border-white/15 text-xs font-bold uppercase tracking-wider rounded transition flex items-center gap-1.5"
          >
            <ArrowLeft className="w-3.5 h-3.5" /> Quay lại
          </button>
          <button
            onClick={() => navigate('/')}
            className="px-5 py-2.5 bg-amber-500 hover:bg-amber-400 text-black text-xs font-bold uppercase tracking-wider rounded transition"
          >
            Về trang chủ
          </button>
        </div>
      </div>
    );
  }

  // MAIN BOOKING VIEW
  return (
    <div className="mx-auto max-w-6xl px-3.5 sm:px-6 pt-3 sm:pt-4 pb-20 space-y-4 text-white">
      {/* Top Header & Navigation - Compact & Clean */}
      <div className="flex flex-wrap items-center justify-between gap-2.5 border-b border-white/10 pb-2.5">
        <div className="flex items-center space-x-2">
          <button
            onClick={onBack}
            className="border border-white/20 hover:border-white bg-black hover:bg-neutral-900 text-white p-1.5 rounded-lg transition"
            title="Quay lại"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
          </button>
          <div>
            <h1 className="text-sm sm:text-base font-bold text-white uppercase tracking-wide flex items-center gap-1.5">
              <Ticket className="h-3.5 w-3.5 text-amber-500" />
              Đặt Vé Xem Phim
            </h1>
            <p className="text-[10px] sm:text-[11px] text-neutral-400 uppercase tracking-wider">
              {movie.title} • {movie.ageRating || 'P'} • {movie.durationMinutes || 120} Phút
            </p>
          </div>
        </div>

        {/* Progress Indicator (Rule LIII) */}
        <div className="flex items-center space-x-1 sm:space-x-1.5 text-[11px] font-semibold uppercase tracking-wider overflow-x-auto py-0.5">
          <button
            onClick={() => {
              if (paymentState === 'booking') handleBackToSchedule();
            }}
            className={`flex items-center gap-1.5 transition ${
              bookingStep === 'schedule'
                ? 'text-amber-400 font-bold'
                : selectedShowtime
                  ? 'text-emerald-400'
                  : 'text-neutral-500'
            }`}
          >
            <span className={`w-4 h-4 rounded-full flex items-center justify-center font-bold text-[9px] ${
              bookingStep === 'schedule'
                ? 'bg-amber-500 text-black ring-1.5 ring-amber-400/50'
                : selectedShowtime
                  ? 'bg-emerald-500 text-black'
                  : 'bg-neutral-800 text-neutral-400'
            }`}>
              {selectedShowtime && bookingStep !== 'schedule' ? '✓' : '1'}
            </span>
            <span>Lịch chiếu</span>
          </button>
          <ChevronRight className="h-2.5 w-2.5 text-neutral-600 shrink-0" />

          <button
            disabled={!selectedShowtime}
            onClick={() => {
              if (paymentState === 'booking' && selectedShowtime) handleProceedToSeats();
              else if (paymentState === 'payment_method') {
                setPaymentState('booking');
                setBookingStep('seats');
              }
            }}
            className={`flex items-center gap-1.5 transition ${
              selectedSeats.length > 0 && bookingStep !== 'seats' && bookingStep !== 'schedule'
                ? 'text-emerald-400'
                : bookingStep === 'seats'
                  ? 'text-amber-400 font-bold'
                  : 'text-neutral-500 disabled:opacity-30'
            }`}
          >
            <span className={`w-4 h-4 rounded-full flex items-center justify-center font-bold text-[9px] ${
              selectedSeats.length > 0 && bookingStep !== 'seats' && bookingStep !== 'schedule'
                ? 'bg-emerald-500 text-black'
                : bookingStep === 'seats'
                  ? 'bg-amber-500 text-black ring-1.5 ring-amber-400/50'
                  : 'bg-neutral-800 text-neutral-400'
            }`}>
              {selectedSeats.length > 0 && bookingStep !== 'seats' && bookingStep !== 'schedule' ? '✓' : '2'}
            </span>
            <span>Chọn ghế</span>
          </button>
          <ChevronRight className="h-2.5 w-2.5 text-neutral-600 shrink-0" />

          <button
            disabled={selectedSeats.length === 0}
            onClick={() => {
              if (paymentState === 'booking') setBookingStep('combos');
              else if (paymentState === 'payment_method') {
                setPaymentState('booking');
                setBookingStep('combos');
              }
            }}
            className={`flex items-center gap-1.5 transition ${
              paymentState === 'payment_method' || paymentState === 'payment_success'
                ? 'text-emerald-400'
                : bookingStep === 'combos'
                  ? 'text-amber-400'
                  : 'text-neutral-500 disabled:opacity-30'
            }`}
          >
            <span className={`w-4 h-4 rounded-full flex items-center justify-center font-bold text-[9px] ${
              paymentState === 'payment_method' || paymentState === 'payment_success'
                ? 'bg-emerald-500 text-black'
                : bookingStep === 'combos'
                  ? 'bg-amber-500 text-black'
                  : 'bg-neutral-800 text-neutral-400'
            }`}>
              {paymentState === 'payment_method' || paymentState === 'payment_success' ? '✓' : '3'}
            </span>
            <span>Bắp nước</span>
          </button>
          <ChevronRight className="h-2.5 w-2.5 text-neutral-600 shrink-0" />

          <button
            disabled={selectedSeats.length === 0 || !holdBookingId}
            onClick={() => {
              if (holdBookingId) setPaymentState('payment_method');
            }}
            className={`flex items-center gap-1.5 transition ${
              paymentState === 'payment_success'
                ? 'text-emerald-400'
                : paymentState === 'payment_method'
                  ? 'text-amber-400'
                  : 'text-neutral-500 disabled:opacity-30'
            }`}
          >
            <span className={`w-4 h-4 rounded-full flex items-center justify-center font-bold text-[9px] ${
              paymentState === 'payment_success'
                ? 'bg-emerald-500 text-black'
                : paymentState === 'payment_method'
                  ? 'bg-amber-500 text-black'
                  : 'bg-neutral-800 text-neutral-400'
            }`}>
              {paymentState === 'payment_success' ? '✓' : '4'}
            </span>
            <span>Thanh toán</span>
          </button>
          <ChevronRight className="h-2.5 w-2.5 text-neutral-600 shrink-0" />

          <span className={`flex items-center gap-1.5 ${paymentState === 'payment_success' ? 'text-amber-400 font-bold' : 'text-neutral-500'}`}>
            <span className={`w-4 h-4 rounded-full flex items-center justify-center font-bold text-[9px] ${paymentState === 'payment_success' ? 'bg-amber-500 text-black' : 'bg-neutral-800 text-neutral-400'}`}>
              5
            </span>
            <span>Hoàn tất</span>
          </span>
        </div>
      </div>

      {/* Main Grid: Left Workspace (8 cols) & Right Order Summary (4 cols) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        <div className="lg:col-span-8 space-y-4">

          {/* =========================================================================
              VIEW 1: LỊCH CHIẾU (SCHEDULE VIEW)
              ========================================================================= */}
          {bookingStep === 'schedule' && (
            <div className="space-y-3.5">
              {!isLoadingShowtimes && showtimesList.length === 0 ? (
                <div className="rounded-2xl border border-white/10 bg-neutral-950 p-8 sm:p-12 text-center space-y-5 shadow-xl">
                  <div className="w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 mx-auto shadow-inner">
                    <CalendarX className="w-8 h-8" />
                  </div>
                  <div className="space-y-2 max-w-md mx-auto">
                    <h3 className="text-lg font-serif font-black text-white uppercase tracking-wider">
                      Hiện Không Có Suất Chiếu
                    </h3>
                    <p className="text-xs text-neutral-400 font-sans leading-relaxed">
                      Phim <span className="text-amber-300 font-semibold">"{movie?.title || 'này'}"</span> hiện chưa có lịch chiếu hoặc các suất chiếu đã kết thúc. Quý khách vui lòng chọn phim khác đang chiếu hoặc quay lại sau.
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center justify-center gap-3 pt-3">
                    <button
                      type="button"
                      onClick={() => navigate('/explore')}
                      className="px-6 py-3 bg-gradient-to-r from-amber-500 to-amber-400 hover:from-amber-400 hover:to-amber-300 text-black text-xs font-bold font-sans uppercase tracking-widest rounded-lg shadow-lg shadow-amber-500/20 transition flex items-center gap-2"
                    >
                      <Film className="w-4 h-4" /> Khám phá phim khác
                    </button>
                    <button
                      type="button"
                      onClick={() => navigate(`/movies/${movie?.backendId || movie?.id || id}`)}
                      className="px-5 py-3 bg-neutral-900 hover:bg-neutral-800 text-white border border-white/15 text-xs font-bold font-sans uppercase tracking-wider rounded-lg transition"
                    >
                      Xem chi tiết phim
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  {/* 1. CHỌN NGÀY CHIẾU (ĐƯA LÊN ĐẦU TRANG - KHÔNG CUỘN NGANG) */}
              <div id="schedule-section" className="rounded-xl border border-white/10 bg-neutral-950 p-3 sm:p-3.5 space-y-2.5 shadow-md scroll-mt-24 sm:scroll-mt-28">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/10 pt-0.5 pb-2">
                  <div className="flex items-center gap-2">
                    <div className="h-6 w-6 rounded-lg bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 shrink-0">
                      <Calendar className="w-3.5 h-3.5" />
                    </div>
                    <div>
                      <h3 className="text-xs font-bold text-white uppercase tracking-wider">1. Chọn Ngày Chiếu</h3>
                      <p className="text-[10px] text-neutral-400">Xem lịch các ngày sắp chiếu (không hiển thị ngày quá khứ)</p>
                    </div>
                  </div>

                  <span className="text-[10px] text-amber-400/90 font-mono font-semibold bg-amber-950/30 border border-amber-500/20 px-2 py-0.5 rounded-full">
                    {dateOptions.length} ngày khả dụng
                  </span>
                </div>

                {isLoadingShowtimes ? (
                  <div className="flex items-center justify-center gap-2 text-neutral-400 text-xs py-4">
                    <Loader2 className="h-3.5 w-3.5 animate-spin text-amber-500" /> Đang tải lịch chiếu...
                  </div>
                ) : dateOptions.length === 0 ? (
                  <p className="text-xs text-neutral-500 py-3 text-center">Hiện chưa có lịch chiếu cho phim này.</p>
                ) : (
                  <div className="grid grid-cols-7 gap-1 sm:gap-1.5 w-full pt-1.5">
                    {dateOptions.map(date => {
                      const isSelected = selectedDate === date;
                      const isCurrentDay = isToday(date);
                      const weekday = formatVietnameseWeekday(date);
                      const shortWeekday = formatVietnameseShortWeekday(date);
                      const dayMonth = formatVietnameseDayMonth(date);
                      const showtimeCount = showtimesList.filter(st => st.startTime?.split('T')[0] === date).length;

                      return (
                        <button
                          key={date}
                          type="button"
                          onClick={() => handleSelectDate(date)}
                          className={`w-full py-2 px-0.5 sm:px-1 rounded-xl border flex flex-col items-center justify-between transition-all duration-150 group relative select-none ${
                            isSelected
                              ? 'bg-gradient-to-b from-amber-400 to-amber-500 text-black border-amber-300 shadow-md shadow-amber-500/25 scale-[1.02] font-black ring-1.5 ring-amber-400/50'
                              : 'bg-neutral-900/90 text-neutral-300 border-white/10 hover:border-amber-500/40 hover:bg-neutral-850'
                          }`}
                        >
                          {isCurrentDay && (
                            <span className={`absolute -top-2 px-1 sm:px-1.5 py-0.2 rounded-full text-[7px] sm:text-[8px] font-black uppercase tracking-wider z-10 ${
                              isSelected ? 'bg-black text-amber-400 border border-amber-400/30' : 'bg-amber-500 text-black shadow'
                            }`}>
                              Hôm nay
                            </span>
                          )}
                          <span className={`text-[9px] sm:text-[10px] uppercase font-bold tracking-tight text-center leading-tight ${
                            isSelected ? 'text-black' : 'text-neutral-400 group-hover:text-amber-400'
                          }`}>
                            <span className="hidden md:inline">{weekday}</span>
                            <span className="md:hidden">{shortWeekday}</span>
                          </span>
                          <span className="text-xs sm:text-sm font-black font-mono my-0.5 tracking-tight">
                            {dayMonth}
                          </span>
                          <span className={`text-[8px] sm:text-[9px] font-medium tracking-tight ${
                            isSelected
                              ? 'text-black/80 font-bold'
                              : showtimeCount > 0
                                ? 'text-amber-400/90'
                                : 'text-neutral-500'
                          }`}>
                            {showtimeCount > 0 ? `${showtimeCount} suất` : '0 suất'}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Compact Movie Spotlight Mini-Banner */}
              <div className="relative overflow-hidden rounded-xl border border-white/10 bg-gradient-to-r from-neutral-900 via-neutral-950 to-neutral-900 p-2.5 sm:p-3 shadow-md flex items-center gap-3">
                <img
                  src={movie.posterUrl}
                  alt={movie.title}
                  className="h-14 w-10 sm:h-16 sm:w-11 object-cover rounded-lg border border-amber-500/30 shadow shrink-0"
                />
                <div className="flex-1 min-w-0 space-y-0.5">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="px-1.5 py-0.2 rounded bg-red-950/90 border border-red-500/40 text-red-400 text-[9px] font-bold uppercase">
                      {movie.ageRating || 'P'}
                    </span>
                    <span className="px-1.5 py-0.2 rounded bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-[9px] font-bold uppercase">
                      Đang chiếu
                    </span>
                    <span className="px-1.5 py-0.2 rounded bg-amber-500/10 border border-amber-500/30 text-amber-400 text-[9px] font-bold uppercase">
                      2D Phụ Đề
                    </span>
                    <span className="text-neutral-400 text-[10px] font-mono">
                      {movie.durationMinutes || 120} phút
                    </span>
                  </div>
                  <h2 className="text-xs sm:text-sm font-bold text-white uppercase truncate">
                    {movie.title}
                  </h2>
                  {movie.englishTitle && (
                    <p className="text-[10px] text-neutral-400 truncate">
                      {movie.englishTitle}
                    </p>
                  )}
                </div>
              </div>

              {/* Room & Cinema Format Filter Pills */}
              {roomOptionsForDate.length > 0 && (
                <div className="rounded-xl border border-white/10 bg-neutral-950 p-2 sm:p-2.5 flex flex-wrap items-center justify-between gap-2 shadow-sm">
                  <div className="flex items-center gap-1.5 text-[10px] sm:text-[11px] text-neutral-400 font-semibold uppercase tracking-wider">
                    <Tv className="w-3.5 h-3.5 text-amber-500" />
                    <span>Phòng chiếu:</span>
                  </div>

                  <div className="flex flex-wrap items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => handleSelectRoom('ALL')}
                      className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition ${
                        selectedRoomKey === 'ALL'
                          ? 'bg-amber-500 text-black shadow-sm'
                          : 'bg-neutral-900 text-neutral-400 hover:text-white border border-white/10'
                      }`}
                    >
                      Tất cả phòng ({showtimesForDate.length})
                    </button>

                    {roomOptionsForDate.map(room => (
                      <button
                        key={room.key}
                        type="button"
                        onClick={() => handleSelectRoom(room.key)}
                        className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition ${
                          selectedRoomKey === room.key
                            ? 'bg-amber-500 text-black shadow-sm'
                            : 'bg-neutral-900 text-neutral-400 hover:text-white border border-white/10'
                        }`}
                      >
                        {room.name}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* 2. CHỌN SUẤT CHIẾU (Showtimes Grid) */}
              <div className="rounded-xl border border-white/10 bg-neutral-950 p-3 sm:p-3.5 space-y-2.5 shadow-md">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/10 pb-2">
                  <div className="flex items-center gap-2">
                    <div className="h-6 w-6 rounded-lg bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
                      <Clock className="w-3.5 h-3.5" />
                    </div>
                    <div>
                      <h3 className="text-xs font-bold text-white uppercase tracking-wider">2. Khung Giờ Chiếu</h3>
                      <p className="text-[10px] text-neutral-400">Giờ bắt đầu → Giờ kết thúc (tính theo thời lượng phim)</p>
                    </div>
                  </div>

                  <span className="text-[10px] text-neutral-400">
                    Đóng đặt vé trước 10 phút
                  </span>
                </div>

                {showtimesForSelectedRoom.length === 0 ? (
                  <div className="text-center py-6 space-y-1">
                    <Clock className="w-5 h-5 text-neutral-600 mx-auto" />
                    <p className="text-xs text-neutral-400">Không có suất chiếu khả dụng cho lựa chọn này.</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                    {showtimesForSelectedRoom.map(st => {
                      const isSelected = selectedShowtime?.id === st.id;
                      const startStr = new Date(st.startTime).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
                      const endStr = getShowtimeEndTimeStr(st, movie?.durationMinutes);
                      const isBookable = isShowtimeBookable(st);
                      const roomName = st.roomName || st.room?.name || 'Phòng Standard';

                      return (
                        <div
                          key={st.id}
                          onClick={() => { if (isBookable) handleSelectShowtime(st); }}
                          className={`relative rounded-xl border p-2.5 transition-all duration-150 cursor-pointer group flex flex-col justify-between ${
                            !isBookable
                              ? 'border-neutral-800 bg-neutral-900/30 text-neutral-600 cursor-not-allowed opacity-50'
                              : isSelected
                                ? 'border-amber-400 bg-gradient-to-b from-amber-950/40 to-neutral-900/90 text-white shadow-md shadow-amber-500/20 ring-1.5 ring-amber-400/60 scale-[1.01]'
                                : 'border-white/10 bg-neutral-900/70 hover:border-amber-500/40 hover:bg-neutral-850 hover:-translate-y-0.5'
                          }`}
                        >
                          <div className="flex items-center justify-between border-b border-white/5 pb-1.5 mb-1.5">
                            <div className="flex items-center gap-1 text-[10px] sm:text-[11px] text-neutral-300 font-semibold truncate">
                              <Tv className="w-3 h-3 text-amber-500 shrink-0" />
                              <span className="truncate">{roomName}</span>
                            </div>
                            <span className="text-[8px] px-1.5 py-0.2 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/30 font-bold uppercase shrink-0">
                              2D Phụ Đề
                            </span>
                          </div>

                          <div className="flex items-center justify-between py-0.5">
                            <div className="flex items-baseline gap-1 font-mono">
                              <span className={`text-base sm:text-lg font-black ${isSelected ? 'text-amber-400' : 'text-white'}`}>
                                {startStr}
                              </span>
                              <span className="text-neutral-500 text-xs font-normal">→</span>
                              <span className="text-neutral-400 text-xs font-semibold">
                                {endStr}
                              </span>
                            </div>

                            {isSelected && (
                              <CheckCircle2 className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                            )}
                          </div>

                          <div className="flex items-center justify-between pt-1.5 mt-1.5 border-t border-white/5 text-[10px]">
                            <span className="font-mono text-neutral-400">
                              Từ <strong className="text-amber-400">{formatVnd(st.basePrice || 90000)}</strong>
                            </span>
                            <span className={`text-[9px] font-bold uppercase tracking-wider ${
                              !isBookable
                                ? 'text-rose-400'
                                : isSelected
                                  ? 'text-amber-300 font-black'
                                  : 'text-emerald-400'
                            }`}>
                              {!isBookable ? 'Đã đóng vé' : isSelected ? 'Đã chọn' : 'Còn vé'}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      )}

          {/* =========================================================================
              VIEW 2: CHỌN GHẾ (SEAT MAP SCREEN)
              ========================================================================= */}
          {bookingStep === 'seats' && (
            <div className="space-y-4">
              {/* Selected Showtime Breadcrumb / Mini-Header */}
              <div className="border border-white/10 bg-neutral-900/90 p-3 sm:p-3.5 rounded-xl flex flex-wrap items-center justify-between gap-3 shadow-md backdrop-blur-md">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 shrink-0">
                    <Calendar className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-[10px] text-neutral-400 uppercase font-semibold">
                      Suất chiếu đang chọn:
                    </div>
                    <div className="text-xs sm:text-sm font-bold text-white flex flex-wrap items-center gap-1.5 sm:gap-2">
                      <span className="text-amber-400 font-mono font-black">
                        {selectedShowtime ? new Date(selectedShowtime.startTime).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }) : '--:--'}
                        {' → '}
                        {getShowtimeEndTimeStr(selectedShowtime, movie?.durationMinutes)}
                      </span>
                      <span className="text-neutral-600">•</span>
                      <span>{formatVietnameseWeekday(selectedDate)}, {formatVietnameseDayMonth(selectedDate)}</span>
                      <span className="text-neutral-600">•</span>
                      <span className="text-neutral-300">{selectedShowtime?.roomName || 'Room A'}</span>
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleBackToSchedule}
                  className="px-3 py-1.5 rounded-lg border border-white/20 hover:border-amber-400 bg-neutral-950 hover:bg-neutral-800 text-neutral-300 hover:text-amber-400 text-[11px] font-bold uppercase tracking-wider transition flex items-center gap-1.5 shadow"
                >
                  <RefreshCw className="w-3 h-3" />
                  <span>Đổi suất chiếu</span>
                </button>
              </div>

              {/* Seat Map Screen */}
              <div className="border border-white/10 bg-neutral-950 p-4 sm:p-5 rounded-xl space-y-5 relative overflow-hidden">
                {/* Screen Glow */}
                <div className="relative text-center mx-auto max-w-md pt-1">
                  <div className="relative h-3 w-full rounded-[50%] border-t-[3px] border-amber-400/80 shadow-[0_10px_25px_rgba(245,158,11,0.35)] bg-gradient-to-b from-amber-500/10 to-transparent"></div>
                  <span className="text-[10px] font-sans font-bold uppercase tracking-[0.35em] block mt-3 text-neutral-400">
                    MÀN HÌNH CHÍNH (SCREEN)
                  </span>
                </div>

                {/* Seat Map Loading / Error states (Rule 50, 51, 52) */}
                {isLoadingSeatMap ? (
                  <div className="flex flex-col items-center justify-center gap-2 py-14 text-neutral-400 text-xs">
                    <Loader2 className="h-6 w-6 animate-spin text-amber-500" />
                    <span>Đang tải sơ đồ ghế phòng chiếu...</span>
                  </div>
                ) : !selectedShowtime ? (
                  <p className="text-center text-neutral-500 text-xs py-12">Vui lòng chọn suất chiếu để tải sơ đồ ghế.</p>
                ) : seats.length === 0 ? (
                  <div className="text-center py-12 space-y-2">
                    <p className="text-neutral-400 text-xs">Phòng chiếu chưa được cấu hình sơ đồ ghế.</p>
                    <button onClick={refreshSeatMap} className="px-3 py-1.5 text-xs bg-neutral-800 text-white rounded hover:bg-neutral-700">
                      Thử lại
                    </button>
                  </div>
                ) : (
                  <>
                    {/* Seat Scroll Area */}
                    <div className="relative group/seats select-none">
                      <button
                        type="button"
                        onClick={() => scrollSeats('left')}
                        className="absolute -left-2 top-1/2 -translate-y-1/2 z-30 bg-black/80 hover:bg-amber-500 hover:text-black text-white border border-white/20 rounded-full p-1.5 shadow-lg transition"
                        title="Cuộn sang trái"
                      >
                        <ChevronLeft className="h-4 w-4" />
                      </button>

                      <div ref={seatScrollRef} className="overflow-x-auto pb-3 max-w-full scrollbar-thin scroll-smooth">
                        <div className="w-max mx-auto flex flex-col items-start space-y-2.5 px-4 pb-1">
                          {[...new Map(seats.map(s => [s.row, s])).values()]
                            .sort((a, b) => (a.displayOrder - b.displayOrder) || String(a.row).localeCompare(String(b.row)))
                            .map((rowSeed) => {
                              const rowLetter = rowSeed.row;
                              const rowSeats = seats
                                .filter(s => s.row === rowLetter)
                                .sort((a, b) => (a.displayColumn - b.displayColumn) || (a.col - b.col));
                              const isCoupleRow = rowSeats.some(s => s.type === 'COUPLE');

                              return (
                                <div key={rowLetter} className="flex items-center space-x-3">
                                  {/* Left Row Label */}
                                  <div className="flex flex-col items-center shrink-0 w-7">
                                    <span className="w-6 h-6 flex items-center justify-center rounded bg-neutral-900 border border-white/10 text-[10px] font-bold text-neutral-300">
                                      {rowLetter}
                                    </span>
                                  </div>

                                  {isCoupleRow ? (
                                    /* Couple Seats (Rule 3, 6, 7): Booked as Whole Pairs, emerald for available, rose for selected */
                                    <div className="flex items-center gap-2">
                                      {Array.from({ length: Math.ceil(rowSeats.length / 2) }).map((_, pairIdx) => {
                                        const seat1 = rowSeats[pairIdx * 2];
                                        const seat2 = rowSeats[pairIdx * 2 + 1];
                                        if (!seat1 || !seat2) return null;

                                        const s1Selected = !!selectedSeats.find(s => s.id === seat1.id);
                                        const s2Selected = !!selectedSeats.find(s => s.id === seat2.id);
                                        const isPairSelected = s1Selected || s2Selected;
                                        const isPairBooked = seat1.isBooked || seat2.isBooked;

                                        return (
                                          <button
                                            key={pairIdx}
                                            type="button"
                                            disabled={isPairBooked}
                                            aria-label={`Ghế đôi ${seat1.row}${seat1.col}-${seat2.row}${seat2.col} - ${isPairBooked ? 'đã có người đặt' : isPairSelected ? 'đang chọn' : 'còn trống'}`}
                                            onClick={() => handleSelectSeat(seat1)}
                                            className={`relative w-18 sm:w-22 h-7 sm:h-7.5 rounded-lg border flex items-center justify-center gap-1 font-mono text-[11px] font-bold transition-all duration-150 ${
                                              isPairBooked
                                                ? 'border-neutral-800 bg-neutral-900/90 text-neutral-600 line-through cursor-not-allowed'
                                                : isPairSelected
                                                  ? 'border-rose-500 bg-rose-600 text-white font-black shadow-[0_0_12px_rgba(244,63,94,0.65)] scale-105'
                                                  : 'border-emerald-500/80 bg-emerald-950/40 text-emerald-300 hover:bg-emerald-500 hover:text-black shadow-[0_0_6px_rgba(16,185,129,0.2)]'
                                            }`}
                                            title={`Ghế đôi ${seat1.col}-${seat2.col} • ${formatVnd(defaultCouplePrice)} / cặp • ${isPairBooked ? 'Đã bán/giữ' : isPairSelected ? 'Bạn chọn' : 'Còn trống'}`}
                                          >
                                            <span>{seat1.col}</span>
                                            <span className="opacity-40">♥</span>
                                            <span>{seat2.col}</span>
                                          </button>
                                        );
                                      })}
                                    </div>
                                  ) : (
                                    /* Single Seats (Rule 3): Capacity 1, emerald for available, rose for selected */
                                    <div className="flex items-center space-x-1.5">
                                      {rowSeats.map((seat) => {
                                        const isSelected = !!selectedSeats.find(s => s.id === seat.id);
                                        return (
                                          <button
                                            key={seat.id}
                                            type="button"
                                            disabled={seat.isBooked}
                                            aria-label={`${seat.row}${seat.col} - Ghế đơn - ${seat.isBooked ? 'đã có người đặt' : isSelected ? 'đang chọn' : 'còn trống'}`}
                                            onClick={() => handleSelectSeat(seat)}
                                            className={`w-7 h-7 sm:w-7.5 sm:h-7.5 rounded-md border flex items-center justify-center font-mono text-[11px] font-bold transition-all duration-150 ${
                                              seat.isBooked
                                                ? 'border-neutral-800 bg-neutral-900/90 text-neutral-600 line-through cursor-not-allowed'
                                                : isSelected
                                                  ? 'border-rose-500 bg-rose-600 text-white font-black shadow-[0_0_12px_rgba(244,63,94,0.65)] scale-110'
                                                  : 'border-emerald-500/80 bg-emerald-950/40 text-emerald-300 hover:bg-emerald-500 hover:text-black shadow-[0_0_6px_rgba(16,185,129,0.2)]'
                                            }`}
                                            title={`Ghế đơn ${seat.id} • ${formatVnd(defaultSinglePrice)} • ${seat.isBooked ? 'Đã bán/giữ' : isSelected ? 'Bạn chọn' : 'Còn trống'}`}
                                          >
                                            {seat.col}
                                          </button>
                                        );
                                      })}
                                    </div>
                                  )}

                                  {/* Right Row Label */}
                                  <div className="flex flex-col items-center shrink-0 w-7">
                                    <span className="w-6 h-6 flex items-center justify-center rounded bg-neutral-900 border border-white/10 text-[10px] font-bold text-neutral-300">
                                      {rowLetter}
                                    </span>
                                  </div>
                                </div>
                              );
                            })}
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => scrollSeats('right')}
                        className="absolute -right-2 top-1/2 -translate-y-1/2 z-30 bg-black/80 hover:bg-amber-500 hover:text-black text-white border border-white/20 rounded-full p-1.5 shadow-lg transition"
                        title="Cuộn sang phải"
                      >
                        <ChevronRight className="h-4 w-4" />
                      </button>
                    </div>

                    {/* Seat Legend (Rule XI & LXVII) */}
                    <div className="flex flex-wrap items-center justify-center gap-4 pt-3 border-t border-white/10 text-[11px] text-neutral-300">
                      <div className="flex items-center gap-1.5">
                        <div className="w-3.5 h-3.5 rounded border border-emerald-500/80 bg-emerald-950/40 text-emerald-400 flex items-center justify-center text-[8px]">🟢</div>
                        <span>Ghế trống</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <div className="w-3.5 h-3.5 rounded border border-rose-500 bg-rose-600 flex items-center justify-center text-[8px] text-white">🔴</div>
                        <span className="text-white font-semibold">Ghế bạn chọn</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <div className="w-3.5 h-3.5 rounded border border-neutral-800 bg-neutral-900/90 text-neutral-600 flex items-center justify-center text-[8px]">⚫</div>
                        <span className="text-neutral-500">Đã có người đặt</span>
                      </div>
                      <div className="flex items-center gap-1.5 border-l border-white/10 pl-3 text-neutral-400">
                        <span className="w-6 h-3.5 rounded border border-emerald-500/50 bg-emerald-950/20 text-[8px] flex items-center justify-center font-mono">1♥2</span>
                        <span>Ghế đôi (Nguyên cặp)</span>
                      </div>
                    </div>

                    {/* Bottom Ticket Price Table (Rule 14) */}
                    <div className="border border-white/10 bg-neutral-900/60 p-3 rounded-xl">
                      <div className="text-[11px] font-bold uppercase tracking-wider text-amber-400 mb-2 flex items-center gap-1.5">
                        <DollarSign className="w-3.5 h-3.5" /> BẢNG GIÁ VÉ ÁP DỤNG
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="p-2.5 rounded-lg border border-white/10 bg-neutral-950 flex items-center justify-between">
                          <div>
                            <div className="text-[11px] font-bold text-white uppercase">GHẾ ĐƠN</div>
                            <div className="text-[9px] text-neutral-400">Sức chứa 1 người</div>
                          </div>
                          <div className="text-xs font-bold text-amber-400 font-mono">
                            {formatVnd(defaultSinglePrice)} / vé
                          </div>
                        </div>

                        <div className="p-2.5 rounded-lg border border-pink-500/30 bg-pink-950/10 flex items-center justify-between">
                          <div>
                            <div className="text-[11px] font-bold text-pink-300 uppercase">GHẾ ĐÔI</div>
                            <div className="text-[9px] text-neutral-400">Nguyên cặp (2 người)</div>
                          </div>
                          <div className="text-xs font-bold text-pink-400 font-mono">
                            {formatVnd(defaultCouplePrice)} / cặp
                          </div>
                        </div>
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>
          )}

          {/* =========================================================================
              VIEW 3: CONCESSIONS (BẮP NƯỚC) (Rule 29)
              ========================================================================= */}
          {bookingStep === 'combos' && (
            <div className="border border-white/10 bg-neutral-950 p-6 rounded-2xl space-y-6">
              <div className="flex items-center justify-between border-b border-white/10 pb-4">
                <div>
                  <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                    <ShoppingBag className="w-4 h-4 text-amber-500" /> THỰC ĐƠN BẮP NƯỚC & COMBO
                  </h3>
                  <p className="text-xs text-neutral-400 mt-0.5">Đặt trước trực tuyến nhận ngay tại quầy nhanh chóng.</p>
                </div>
                <button
                  onClick={() => setBookingStep('seats')}
                  className="px-3 py-1.5 text-xs text-neutral-300 hover:text-white border border-white/20 rounded-lg hover:border-white transition"
                >
                  ← Sơ đồ ghế
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {paginatedConcessions.map((item) => {
                  const qty = selectedCombos[item.id] || 0;
                  const statusMeta = getFoodStatusMeta(item.status);
                  const isSelectable = isFoodSelectable(item);

                  return (
                    <div key={item.id} className="flex gap-3.5 border border-white/10 bg-neutral-900/60 p-3.5 rounded-xl hover:border-white/20 transition">
                      <img src={item.imageUrl} alt={item.name} className="h-16 w-16 object-cover rounded-lg bg-neutral-950 shrink-0" />
                      <div className="flex-1 flex flex-col justify-between">
                        <div>
                          <h4 className="text-xs font-bold text-white leading-tight">{item.name}</h4>
                          <p className="text-[10px] text-neutral-400 line-clamp-1 mt-0.5">{item.description}</p>
                          <span className={`text-[9px] font-bold uppercase tracking-wider ${statusMeta.className}`}>
                            {statusMeta.label}
                          </span>
                        </div>
                        <div className="flex items-center justify-between pt-1">
                          <span className="text-xs font-bold text-amber-400 font-mono">{formatVnd(item.price)}</span>
                          <div className="flex items-center gap-2 bg-neutral-950 px-2 py-1 rounded border border-white/10">
                            <button
                              disabled={qty === 0}
                              onClick={() => handleModifyCombo(item.id, '-')}
                              className="text-neutral-400 hover:text-white disabled:opacity-30"
                            >
                              <Minus className="h-3 w-3" />
                            </button>
                            <span className="text-xs font-mono font-bold w-4 text-center">{qty}</span>
                            <button
                              disabled={!isSelectable || qty >= 3}
                              onClick={() => handleModifyCombo(item.id, '+')}
                              className="text-neutral-400 hover:text-white disabled:opacity-30"
                            >
                              <Plus className="h-3 w-3" />
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Pagination */}
              {concessionsTotalPages > 1 && (
                <div className="flex items-center justify-between border-t border-white/10 pt-4 text-xs text-neutral-400 font-mono">
                  <span>Trang {safeConcessionsPage} / {concessionsTotalPages}</span>
                  <div className="flex gap-2">
                    <button
                      disabled={safeConcessionsPage <= 1}
                      onClick={() => setConcessionsPage(p => Math.max(1, p - 1))}
                      className="px-2.5 py-1 rounded border border-white/10 hover:border-white text-white disabled:opacity-30"
                    >
                      Trước
                    </button>
                    <button
                      disabled={safeConcessionsPage >= concessionsTotalPages}
                      onClick={() => setConcessionsPage(p => Math.min(concessionsTotalPages, p + 1))}
                      className="px-2.5 py-1 rounded border border-white/10 hover:border-white text-white disabled:opacity-30"
                    >
                      Sau
                    </button>
                  </div>
                </div>
              )}

            </div>
          )}

        </div>

        {/* RIGHT SIDEBAR: ORDER SUMMARY (Rule 16 & 28) */}
        <div className="lg:col-span-4 border border-white/10 bg-neutral-950 p-4 sm:p-5 rounded-2xl space-y-4 shadow-xl sticky top-20">
          {/* Movie Overview Header */}
          <div className="flex items-start gap-3 border-b border-white/10 pb-3.5">
            <img
              src={movie.posterUrl}
              alt={movie.title}
              className="h-20 w-14 object-cover rounded-lg border border-white/10 shrink-0 shadow"
            />
            <div className="min-w-0 flex-1 space-y-1">
              <div className="flex flex-wrap items-center gap-1.5">
                <span className={`text-[9px] font-bold px-1.5 py-0.2 rounded border uppercase ${ageBadgeMeta.bg}`}>
                  {ageBadgeMeta.label}
                </span>
                <span className="text-[10px] text-neutral-400 font-mono">
                  {movie.durationMinutes || 120} phút
                </span>
                <span className="text-[9px] px-1.5 py-0.2 rounded bg-amber-500/10 border border-amber-500/30 text-amber-400 font-bold uppercase">
                  2D Phụ Đề
                </span>
              </div>
              <h3 className="text-xs sm:text-sm font-bold text-white uppercase leading-snug line-clamp-2">
                {movie.title}
              </h3>
              {movie.englishTitle && (
                <p className="text-[11px] text-neutral-400 truncate">
                  {movie.englishTitle}
                </p>
              )}
              {genresDisplay && (
                <p className="text-[10px] text-neutral-400 truncate">
                  <span className="text-neutral-500">Thể loại:</span> {genresDisplay}
                </p>
              )}
            </div>
          </div>

          {/* Full Detailed Booking Specs Box (Hiện đủ thông tin đặt vé không sót thông tin nào) */}
          <div className="rounded-xl bg-neutral-900/80 border border-white/10 p-3 space-y-2 text-xs">
            <div className="flex items-center justify-between text-[11px] font-bold uppercase tracking-wider text-amber-500 border-b border-white/5 pb-1.5">
              <span className="flex items-center gap-1.5">
                <Film className="w-3.5 h-3.5" /> Thông tin đặt vé
              </span>
              <span className="text-[10px] font-semibold text-neutral-400">
                {selectedShowtime ? (selectedShowtime.roomType || 'Standard 2D') : '2D Phụ Đề'}
              </span>
            </div>

            <div className="space-y-1.5 text-neutral-400 text-xs pt-0.5">
              <div className="flex justify-between items-center">
                <span>Rạp chiếu:</span>
                <span className="text-white font-semibold">CineAI Central</span>
              </div>
              <div className="flex justify-between items-center">
                <span>Phòng chiếu:</span>
                <span className="text-white font-semibold">
                  {selectedShowtime?.roomName || selectedShowtime?.room?.name || (bookingStep === 'schedule' ? 'Chưa chọn phòng' : 'Room A')}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span>Ngày chiếu:</span>
                <span className="text-white font-semibold">
                  {selectedDate ? formatVietnameseFullDate(selectedDate) : 'Chưa chọn ngày'}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span>Suất chiếu:</span>
                {selectedShowtime ? (
                  <div className="text-right font-mono">
                    <span className="text-amber-400 font-bold text-xs sm:text-sm">
                      {new Date(selectedShowtime.startTime).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
                      {' → '}
                      {getShowtimeEndTimeStr(selectedShowtime, movie?.durationMinutes)}
                    </span>
                  </div>
                ) : (
                  <span className="text-neutral-500 italic">Vui lòng chọn khung giờ</span>
                )}
              </div>
              {selectedShowtime && (
                <div className="flex justify-between items-center pt-1 border-t border-white/5 text-[11px]">
                  <span>Trạng thái:</span>
                  <span className={`font-semibold ${isShowtimeBookable(selectedShowtime) ? 'text-emerald-400' : 'text-rose-400'}`}>
                    {isShowtimeBookable(selectedShowtime) ? '🟢 Đang mở bán vé' : '🔴 Đã đóng vé online'}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* If bookingStep === 'schedule' */}
          {bookingStep === 'schedule' ? (
            <div className="space-y-3.5 pt-0.5">
              {/* Price Table Preview */}
              <div className="border border-white/10 bg-neutral-900/60 p-3 rounded-xl space-y-2">
                <div className="text-[10px] font-bold uppercase tracking-wider text-neutral-400 flex items-center justify-between">
                  <span>BẢNG GIÁ VÉ RẠP</span>
                  <span className="text-amber-500 font-normal">Niêm yết</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-neutral-300">Ghế đơn (Single):</span>
                  <span className="font-mono font-bold text-amber-400">{formatVnd(defaultSinglePrice)} / vé</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-neutral-300">Ghế đôi (Couple):</span>
                  <span className="font-mono font-bold text-pink-400">{formatVnd(defaultCouplePrice)} / cặp</span>
                </div>
              </div>

              {/* Highlights & Policy */}
              <div className="space-y-1.5 text-[11px] text-neutral-400 border-t border-white/10 pt-2.5">
                <div className="flex items-center gap-2">
                  <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                  <span>Ghế đôi bán nguyên cặp, dành cho 2 người</span>
                </div>
                <div className="flex items-center gap-2">
                  <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                  <span>Giữ ghế 3 phút sau khi chọn vị trí</span>
                </div>
                <div className="flex items-center gap-2">
                  <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                  <span>Nhận vé điện tử QR ngay sau thanh toán</span>
                </div>
              </div>

              {/* Primary Action CTA Button */}
              <div className="pt-1">
                <button
                  type="button"
                  disabled={!selectedShowtime || !isShowtimeBookable(selectedShowtime)}
                  onClick={handleProceedToSeats}
                  className="w-full py-3 bg-gradient-to-r from-amber-500 to-amber-400 hover:from-amber-400 hover:to-amber-300 text-black font-extrabold uppercase tracking-wider text-xs rounded-xl shadow-lg shadow-amber-500/20 transition disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  <span>TIẾP TỤC CHỌN GHẾ</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
                {!selectedShowtime && (
                  <p className="text-[10px] text-neutral-500 text-center mt-1.5">
                    {showtimesList.length === 0
                      ? '* Phim hiện chưa có suất chiếu khả dụng'
                      : '* Vui lòng chọn ngày và khung giờ chiếu ở bên trái'}
                  </p>
                )}
              </div>
            </div>
          ) : (
            <>
              {/* Selected Seats Summary (Rule 16) */}
              <div className="space-y-3 border-b border-white/10 pb-4">
                <div className="flex items-center justify-between text-xs font-bold uppercase tracking-wider text-amber-500">
                  <span>GHẾ ĐÃ CHỌN ({selectedSeatsSummary.items.length} mục)</span>
                  <span className="text-neutral-400 text-[11px] font-normal">{selectedSeatsSummary.totalCapacity} người</span>
                </div>

                {selectedSeatsSummary.items.length === 0 ? (
                  <p className="text-xs text-neutral-500 italic">Chưa chọn ghế nào.</p>
                ) : (
                  <div className="space-y-1.5 text-xs">
                    {selectedSeatsSummary.items.map((item, idx) => (
                      <div key={idx} className="flex items-center justify-between bg-neutral-900/60 p-2 rounded-lg border border-white/5">
                        <div>
                          <span className="font-mono font-bold text-white text-sm mr-2">{item.code}</span>
                          <span className={`text-[10px] px-1.5 py-0.5 rounded font-semibold ${item.seatType === 'COUPLE' ? 'bg-pink-500/20 text-pink-400' : 'bg-amber-500/20 text-amber-400'}`}>
                            {item.label}
                          </span>
                        </div>
                        <span className="font-mono font-bold text-neutral-300">{formatVnd(item.price)}</span>
                      </div>
                    ))}

                    <div className="flex justify-between text-xs text-neutral-400 pt-1">
                      <span>Sức chứa:</span>
                      <span className="text-white font-bold">
                        {[
                          selectedSeatsSummary.singleCount > 0 && `${selectedSeatsSummary.singleCount} ghế đơn`,
                          selectedSeatsSummary.coupleCount > 0 && `${selectedSeatsSummary.coupleCount} ghế đôi`
                        ].filter(Boolean).join(', ') || '0 ghế'} ({selectedSeatsSummary.totalCapacity} người)
                      </span>
                    </div>
                  </div>
                )}
              </div>

              {/* Selected Foods Summary */}
              {Object.values(selectedCombos).some(q => q > 0) && (
                <div className="space-y-2 border-b border-white/10 pb-4 text-xs">
                  <span className="font-bold uppercase tracking-wider text-rose-400 block">BẮP NƯỚC KÈM THEO</span>
                  {Object.entries(selectedCombos).map(([id, q]) => {
                    const it = concessions.find(i => i.id === id) || resumedFoodsMap[id];
                    if (!it || q <= 0) return null;
                    return (
                      <div key={id} className="flex justify-between text-neutral-400">
                        <span>{it.name} ×{q}</span>
                        <span className="font-mono text-white">{formatVnd((it.price || it.unitPrice || 0) * q)}</span>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Voucher Input (Rule 30) */}
              <div className="space-y-2 border-b border-white/10 pb-4">
                <span className="text-xs font-bold uppercase tracking-wider text-amber-500 flex items-center gap-1.5">
                  <Tag className="w-3.5 h-3.5" /> MÃ ƯU ĐÃI (VOUCHER)
                </span>
                {appliedVoucher ? (
                  <div className="flex items-center justify-between p-2.5 rounded-lg bg-emerald-950/30 border border-emerald-500/30 text-xs">
                    <div>
                      <span className="font-bold text-emerald-400">{appliedVoucher.code}</span>
                      {displayDiscount > 0 && <span className="ml-2 text-white">(-{formatVnd(displayDiscount)})</span>}
                    </div>
                    <button onClick={handleRemoveVoucher} className="text-neutral-400 hover:text-white text-xs font-semibold">
                      Hủy
                    </button>
                  </div>
                ) : (
                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="Nhập mã voucher"
                      value={voucherInput}
                      onChange={(e) => setVoucherInput(e.target.value.toUpperCase())}
                      className="flex-1 px-3 py-1.5 bg-neutral-900 border border-white/10 rounded-lg text-xs text-white focus:border-amber-500 focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={handleApplyVoucher}
                      className="px-3 py-1.5 text-xs font-bold bg-amber-500 hover:bg-amber-400 text-black rounded-lg transition"
                    >
                      ÁP DỤNG
                    </button>
                  </div>
                )}
                {voucherError && <p className="text-[11px] text-rose-400">{voucherError}</p>}
              </div>

              {/* CinePoints Panel (Rule 31) */}
              {loyaltyPoints > 0 && (
                <div className="space-y-2 border-b border-white/10 pb-4 text-xs">
                  <div className="flex justify-between text-neutral-300">
                    <span className="font-bold text-amber-400 flex items-center gap-1">
                      <Wallet className="w-3.5 h-3.5" /> CinePoints khả dụng:
                    </span>
                    <span className="font-mono font-bold text-white">{loyaltyPoints.toLocaleString()} điểm</span>
                  </div>
                  <div className="flex gap-2">
                    <input
                      type="number"
                      placeholder="Điểm muốn dùng"
                      max={loyaltyPoints}
                      min="0"
                      value={loyaltyPointsInput}
                      onChange={(e) => setLoyaltyPointsInput(e.target.value)}
                      className="flex-1 px-3 py-1.5 bg-neutral-900 border border-white/10 rounded-lg text-xs text-white focus:border-amber-500 focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => setLoyaltyPointsInput(String(loyaltyPoints))}
                      className="px-2.5 py-1.5 text-[10px] font-semibold bg-neutral-800 hover:bg-neutral-700 text-neutral-300 rounded-lg"
                    >
                      Dùng hết
                    </button>
                  </div>
                  {displayPointsDiscount > 0 && (
                    <p className="text-[11px] text-emerald-400">Quy đổi: -{formatVnd(displayPointsDiscount)}</p>
                  )}
                </div>
              )}

              {/* Order Details & Total Calculation (Rule 28 & 34) */}
              <div className="space-y-2 text-xs pt-1">
                <div className="flex justify-between text-neutral-400">
                  <span>Tạm tính vé:</span>
                  <span className="font-mono text-white">{formatVnd(displayTicketSubtotal)}</span>
                </div>
                {displayFoodSubtotal > 0 && (
                  <div className="flex justify-between text-neutral-400">
                    <span>Tạm tính bắp nước:</span>
                    <span className="font-mono text-white">{formatVnd(displayFoodSubtotal)}</span>
                  </div>
                )}
                {displayDiscount > 0 && (
                  <div className="flex justify-between text-emerald-400">
                    <span>Voucher giảm giá:</span>
                    <span className="font-mono">-{formatVnd(displayDiscount)}</span>
                  </div>
                )}
                {displayPointsDiscount > 0 && (
                  <div className="flex justify-between text-amber-400">
                    <span>CinePoints:</span>
                    <span className="font-mono">-{formatVnd(displayPointsDiscount)}</span>
                  </div>
                )}

                <div className="flex justify-between text-base font-bold text-white border-t border-white/10 pt-3">
                  <span>TỔNG THANH TOÁN:</span>
                  <span className="font-mono text-amber-400 text-lg font-black">{formatVnd(displayTotal)}</span>
                </div>
              </div>

              {/* Action Button (Rule 65) */}
              {bookingStep === 'seats' ? (
                <button
                  disabled={selectedSeats.length === 0 || isHolding}
                  onClick={handleProceedToCombos}
                  className="w-full py-3.5 bg-gradient-to-r from-amber-500 to-amber-400 hover:from-amber-400 hover:to-amber-300 text-black font-extrabold uppercase tracking-wider text-xs rounded-xl shadow-lg shadow-amber-500/20 transition disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  <span>TIẾP TỤC CHỌN BẮP NƯỚC</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              ) : (
                <button
                  disabled={selectedSeats.length === 0 || isHolding}
                  onClick={handleProceedToPayment}
                  className="w-full py-3.5 bg-gradient-to-r from-amber-500 to-amber-400 hover:from-amber-400 hover:to-amber-300 text-black font-extrabold uppercase tracking-wider text-xs rounded-xl shadow-lg shadow-amber-500/20 transition disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {isHolding ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
                  <span>{isHolding ? 'ĐANG GIỮ GHẾ...' : 'TIẾP TỤC THANH TOÁN'}</span>
                </button>
              )}

              {bookingStep === 'combos' && (
                <button
                  onClick={handleProceedToPayment}
                  className="w-full py-2 text-xs text-neutral-400 hover:text-white text-center transition"
                >
                  Bỏ qua bắp nước & Thanh toán ngay →
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
