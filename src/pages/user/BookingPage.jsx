import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { QRCodeSVG } from 'qrcode.react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import {
  ChevronRight, ArrowLeft, Ticket, ShoppingBag, Plus, Minus,
  CheckCircle, XCircle, Loader2, Check, ShieldCheck, CircleAlert, Calendar,
  Clock, ArrowRight, Tag, Sparkles, Layers, Wallet, RefreshCw, AlertTriangle,
  Film, MapPin, CheckCircle2, Tv, Armchair, Info, CalendarX,
  ZoomIn, ZoomOut, User, GraduationCap, Baby, Users, X, Move, RotateCcw
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
import { validateNoSingleSeatGap, validateOrphanSeats } from '../../utils/seatValidation';
export { validateNoSingleSeatGap, validateOrphanSeats };

// Cấu hình thời gian giữ ghế chuẩn 10 phút (Rule 17)
const HOLD_DURATION_SECONDS = 10 * 60;
const CONCESSIONS_PAGE_SIZE = 6;
const TICKET_TYPES = [
  { type: 'ADULT', label: 'Người lớn', age: 30, priceKey: 'adultStandardPrice', helper: 'Vé tiêu chuẩn dành cho người lớn' },
  { type: 'STUDENT', label: 'Sinh viên', age: 20, priceKey: 'studentStandardPrice', helper: 'Vui lòng mang theo thẻ học sinh/sinh viên hợp lệ khi đến rạp.' },
  { type: 'CHILD', label: 'Trẻ em', age: 10, priceKey: 'childStandardPrice', helper: 'Áp dụng theo chính sách vé trẻ em (dưới 12 tuổi).' }
];
const EMPTY_TICKET_QUANTITIES = { ADULT: 0, STUDENT: 0, CHILD: 0 };

const TICKET_TYPE_THEMES = {
  ADULT: {
    type: 'ADULT',
    label: 'Người lớn',
    shortLabel: 'NL',
    color: '#f5b800',
    bg: '#f5b800',
    border: '#ffe082',
    text: '#090909',
    ring: '#f5b800',
    shadow: '0 0 14px rgba(245,184,0,0.7)',
    badgeBg: 'bg-amber-500/20',
    badgeBorder: 'border-amber-400',
    badgeText: 'text-amber-400',
    dot: '🟡'
  },
  STUDENT: {
    type: 'STUDENT',
    label: 'Sinh viên',
    shortLabel: 'SV',
    color: '#0284c7',
    bg: '#0284c7',
    border: '#38bdf8',
    text: '#ffffff',
    ring: '#38bdf8',
    shadow: '0 0 14px rgba(56,189,248,0.7)',
    badgeBg: 'bg-sky-500/20',
    badgeBorder: 'border-sky-400',
    badgeText: 'text-sky-300',
    dot: '🔵'
  },
  CHILD: {
    type: 'CHILD',
    label: 'Trẻ em',
    shortLabel: 'TE',
    color: '#059669',
    bg: '#059669',
    border: '#34d399',
    text: '#ffffff',
    ring: '#34d399',
    shadow: '0 0 14px rgba(16,185,129,0.7)',
    badgeBg: 'bg-emerald-500/20',
    badgeBorder: 'border-emerald-400',
    badgeText: 'text-emerald-300',
    dot: '🟢'
  }
};

const getSeatTicketPrice = (showtime, seatType, ticketType) => {
  if (!showtime) return 0;
  const isVip = seatType === 'VIP';
  const isCouple = seatType === 'COUPLE';

  if (isCouple) {
    if (ticketType === 'STUDENT' && showtime.studentCouplePrice) return Number(showtime.studentCouplePrice);
    if (ticketType === 'CHILD' && showtime.childCouplePrice) return Number(showtime.childCouplePrice);
    return Number(showtime.adultCouplePrice || showtime.couplePrice || ((showtime.adultStandardPrice || showtime.basePrice || 90000) * 2));
  }

  if (isVip) {
    if (ticketType === 'STUDENT' && showtime.studentVipPrice) return Number(showtime.studentVipPrice);
    if (ticketType === 'CHILD' && showtime.childVipPrice) return Number(showtime.childVipPrice);
    return Number(showtime.adultVipPrice || showtime.vipPrice || Math.round((showtime.adultStandardPrice || showtime.basePrice || 90000) * 1.25));
  }

  // STANDARD / SINGLE
  if (ticketType === 'STUDENT' && showtime.studentStandardPrice) return Number(showtime.studentStandardPrice);
  if (ticketType === 'CHILD' && showtime.childStandardPrice) return Number(showtime.childStandardPrice);
  return Number(showtime.adultStandardPrice || showtime.basePrice || 90000);
};

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
  if (norm === 'VIP') return 'VIP';
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
  const [shakingSeatId, setShakingSeatId] = useState(null);
  const triggerSeatShake = (seatId) => {
    setShakingSeatId(seatId);
    setTimeout(() => {
      setShakingSeatId((curr) => (curr === seatId ? null : curr));
    }, 150);
  };
  const onBack = () => navigate(-1);
  const onConfirmBooking = (booking) => {
    navigate('/tickets');
    showToast(`Đặt vé thành công! Mã đơn: ${booking.bookingCode || ''}`.trim());
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

  // Selected seats (with inline ticketType selection)
  const [selectedSeats, setSelectedSeats] = useState([]);
  const [ticketQuantities, setTicketQuantities] = useState(EMPTY_TICKET_QUANTITIES);
  const [seatZoom, setSeatZoom] = useState(1);
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 });
  const [isDraggingSeatMap, setIsDraggingSeatMap] = useState(false);
  const seatMapViewportRef = useRef(null);
  const dragStartRef = useRef({ mouseX: 0, mouseY: 0, startPanX: 0, startPanY: 0 });
  const hasDraggedSeatMapRef = useRef(false);
  const [ticketModalData, setTicketModalData] = useState(null);

  // Food Concessions
  const [selectedCombos, setSelectedCombos] = useState({});
  const [concessionsPage, setConcessionsPage] = useState(1);
  const concessionsTotalPages = Math.max(1, Math.ceil(concessions.length / CONCESSIONS_PAGE_SIZE));
  const safeConcessionsPage = Math.min(concessionsPage, concessionsTotalPages);
  const concessionsStartIndex = (safeConcessionsPage - 1) * CONCESSIONS_PAGE_SIZE;
  const paginatedConcessions = concessions.slice(concessionsStartIndex, concessionsStartIndex + CONCESSIONS_PAGE_SIZE);
  const concessionsDisplayStart = concessions.length === 0 ? 0 : concessionsStartIndex + 1;
  const concessionsDisplayEnd = Math.min(concessionsStartIndex + CONCESSIONS_PAGE_SIZE, concessions.length);

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

  // Mouse drag pan & wheel zoom for seat map
  useEffect(() => {
    const container = seatMapViewportRef.current;
    if (!container) return;

    const handleWheel = (e) => {
      e.preventDefault();
      const zoomDelta = e.deltaY < 0 ? 0.08 : -0.08;
      setSeatZoom((prev) => {
        const next = Math.max(0.5, Math.min(2.0, Number((prev + zoomDelta).toFixed(2))));
        return next;
      });
    };

    container.addEventListener('wheel', handleWheel, { passive: false });
    return () => container.removeEventListener('wheel', handleWheel);
  }, [bookingStep, selectedShowtime?.id]);

  // Global window listeners for seamless dragging across the screen
  useEffect(() => {
    if (!isDraggingSeatMap) return;

    const onWindowMouseMove = (e) => {
      const dx = e.clientX - dragStartRef.current.mouseX;
      const dy = e.clientY - dragStartRef.current.mouseY;
      if (Math.hypot(dx, dy) > 4) {
        hasDraggedSeatMapRef.current = true;
      }
      setPanOffset({
        x: Math.round(dragStartRef.current.startPanX + dx),
        y: Math.round(dragStartRef.current.startPanY + dy)
      });
    };

    const onWindowMouseUp = () => {
      setIsDraggingSeatMap(false);
      setTimeout(() => {
        hasDraggedSeatMapRef.current = false;
      }, 60);
    };

    window.addEventListener('mousemove', onWindowMouseMove);
    window.addEventListener('mouseup', onWindowMouseUp);
    return () => {
      window.removeEventListener('mousemove', onWindowMouseMove);
      window.removeEventListener('mouseup', onWindowMouseUp);
    };
  }, [isDraggingSeatMap]);

  const handleSeatMapMouseDown = (e) => {
    // Only left-click initiates pan
    if (e.button !== 0) return;
    setIsDraggingSeatMap(true);
    hasDraggedSeatMapRef.current = false;
    dragStartRef.current = {
      mouseX: e.clientX,
      mouseY: e.clientY,
      startPanX: panOffset.x,
      startPanY: panOffset.y
    };
  };

  const handleResetSeatMapView = () => {
    setSeatZoom(1);
    setPanOffset({ x: 0, y: 0 });
  };

  // Reset zoom & pan when switching showtime
  useEffect(() => {
    handleResetSeatMapView();
  }, [selectedShowtime?.id]);

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

  // Load Showtimes for Movie (aggregates available slots without room filter)
  const fetchShowtimes = async (targetMovieId) => {
    try {
      setIsLoadingShowtimes(true);
      let list = [];
      try {
        const res = await bookingService.getCustomerSchedule({ movieId: targetMovieId });
        const rawList = Array.isArray(res) ? res : (res?.data ?? res?.items ?? res?.content ?? []);
        list = rawList.map(item => ({
          ...item,
          id: item.showtimeId || item.id,
          showtimeId: item.showtimeId || item.id,
          basePrice: item.startingPrice || item.basePrice || 90000,
          format: item.format || ''
        }));
      } catch (scheduleErr) {
        console.warn('Customer schedule API fallback:', scheduleErr);
        const data = await bookingService.getShowtimes({ movieId: targetMovieId, size: 100 });
        const rawList = Array.isArray(data) ? data : (data?.items ?? data?.content ?? []);
        const upcoming = rawList.filter(st => isShowtimeBookable(st));
        list = sortShowtimes(upcoming).map(st => ({
          ...st,
          id: st.id,
          showtimeId: st.id,
          format: ''
        }));
      }

      setShowtimesList(list);
      return list;
    } catch (err) {
      console.warn('BookingPage: failed to load showtimes:', err);
      setShowtimesList([]);
      return [];
    } finally {
      setIsLoadingShowtimes(false);
    }
  };

  useEffect(() => {
    const targetMovieId = Number(movie?.backendId || movie?.id || id);
    if (!targetMovieId || isNaN(targetMovieId)) return;

    let cancelled = false;
    fetchShowtimes(targetMovieId).then(list => {
      if (cancelled) return;
      if (list && list.length > 0) {
        const preferId = searchParams.get('showtimeId');
        const isResuming = Boolean(searchParams.get('resumeBookingId'));
        const preferred = preferId ? list.find(st => String(st.id) === String(preferId) || String(st.showtimeId) === String(preferId)) : null;
        const first = preferred || list[0];
        const date = first.startTime?.split('T')[0] || '';
        
        if (!isResuming) {
          setSelectedDate(date);
          setSelectedShowtime(null);
          setBookingStep('schedule');
        }
      } else {
        if (!searchParams.get('resumeBookingId')) {
          setSelectedDate('');
          setSelectedShowtime(null);
          setBookingStep('schedule');
        }
      }
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

  const showtimesForSelectedDate = useMemo(() => {
    return [...showtimesForDate].sort((a, b) => new Date(a.startTime) - new Date(b.startTime));
  }, [showtimesForDate]);

  // Group showtimes for selected date by format (e.g. '2D', '3D', 'IMAX', 'VIP')
  const FORMAT_META = {
    '2D': {
      label: '2D Digital',
      sublabel: 'Chuẩn âm thanh sống động & Màn hình sắc nét',
      badgeBg: 'bg-sky-500/10 border-sky-500/30 text-sky-400'
    },
    '3D': {
      label: '3D Kỹ thuật số',
      sublabel: 'Trải nghiệm không gian 3 chiều sống động',
      badgeBg: 'bg-purple-500/10 border-purple-500/30 text-purple-400'
    },
    'IMAX': {
      label: 'IMAX Laser',
      sublabel: 'Màn hình khổng lồ, công nghệ chiếu Laser đỉnh cao',
      badgeBg: 'bg-cyan-500/10 border-cyan-500/30 text-cyan-400'
    },
    'VIP': {
      label: 'VIP Lounge',
      sublabel: 'Ghế sofa da cao cấp, dịch vụ tiêu chuẩn thương gia',
      badgeBg: 'bg-[#f5b800]/15 border-[#f5b800]/40 text-[#f5b800]'
    }
  };

  const getFormatMeta = (fmt) => {
    const key = String(fmt || '2D').toUpperCase().trim();
    return FORMAT_META[key] || {
      label: `${key} Format`,
      sublabel: 'Định dạng phòng chiếu tiêu chuẩn',
      badgeBg: 'bg-white/10 border-white/20 text-neutral-300'
    };
  };

  const groupedShowtimesByFormat = useMemo(() => {
    if (!showtimesForSelectedDate || showtimesForSelectedDate.length === 0) return [];
    const groups = {};
    showtimesForSelectedDate.forEach(st => {
      const fmt = String(st.format || '2D').toUpperCase().trim() || '2D';
      if (!groups[fmt]) groups[fmt] = [];
      groups[fmt].push(st);
    });

    const priorityOrder = ['2D', '3D', 'IMAX', 'VIP'];
    const sortedKeys = Object.keys(groups).sort((a, b) => {
      const iA = priorityOrder.indexOf(a);
      const iB = priorityOrder.indexOf(b);
      if (iA !== -1 && iB !== -1) return iA - iB;
      if (iA !== -1) return -1;
      if (iB !== -1) return 1;
      return a.localeCompare(b);
    });

    return sortedKeys.map(key => ({
      formatKey: key,
      meta: getFormatMeta(key),
      showtimes: groups[key].sort((a, b) => new Date(a.startTime) - new Date(b.startTime))
    }));
  }, [showtimesForSelectedDate]);

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
    setSelectedShowtime(null);
    setSelectedSeats([]);
    setSelectedCombos({});
  };

  const handleSelectShowtime = async (st) => {
    if (selectedShowtime?.id === st.id) return;
    await handleReleaseOldHoldIfAny();

    try {
      // Recheck & resolve on backend (Rule 10)
      const res = await bookingService.resolveCustomerShowtime(st.id || st.showtimeId);
      const resolved = res?.data || res;
      setSelectedShowtime({
        ...st,
        ...resolved,
        id: resolved.showtimeId || st.id,
        showtimeId: resolved.showtimeId || st.id,
        roomId: resolved.roomId || st.roomId,
        basePrice: resolved.startingPrice || st.basePrice,
        format: resolved.format || st.format || ''
      });
      setSelectedSeats([]);
      setSelectedCombos({});
    } catch (err) {
      console.warn('BookingPage: resolve showtime failed:', err);
      const errMsg = err?.message || 'Khung giờ này vừa hết chỗ. Vui lòng chọn khung giờ khác.';
      showToast(errMsg);
      const targetMovieId = Number(movie?.backendId || movie?.id || id);
      if (targetMovieId) fetchShowtimes(targetMovieId);
    }
  };

  const handleProceedToSeats = async () => {
    if (!selectedShowtime) {
      showToast('Vui lòng chọn một suất chiếu trước.');
      return;
    }
    if (!isShowtimeBookable(selectedShowtime)) {
      showToast('Suất chiếu này đã bắt đầu hoặc quá thời gian đặt vé online.');
      return;
    }
    try {
      // Re-verify on backend before proceeding to seats (Rule 10)
      const res = await bookingService.resolveCustomerShowtime(selectedShowtime.id || selectedShowtime.showtimeId);
      const resolved = res?.data || res;
      setSelectedShowtime(prev => ({
        ...prev,
        ...resolved,
        id: resolved.showtimeId || prev?.id,
        showtimeId: resolved.showtimeId || prev?.showtimeId,
        roomId: resolved.roomId || prev?.roomId,
        basePrice: resolved.startingPrice || prev?.basePrice,
        format: resolved.format || prev?.format || ''
      }));
      setBookingStep('seats');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err) {
      console.warn('Proceed to seats recheck failed:', err);
      const errMsg = err?.message || 'Khung giờ này vừa hết chỗ. Vui lòng chọn khung giờ khác.';
      showToast(errMsg);
      const targetMovieId = Number(movie?.backendId || movie?.id || id);
      if (targetMovieId) fetchShowtimes(targetMovieId);
      setSelectedShowtime(null);
    }
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
      const isMyHeldSeat = s.runtimeStatus === 'HOLDING' && (
        (heldSeatIdsRef.current && heldSeatIdsRef.current.includes(s.seatId))
        || selectedSeats.some(sel => sel.seatId === s.seatId)
      );
      const isBooked = (
        s.runtimeStatus === 'BOOKED'
        || s.runtimeStatus === 'CHECKED_IN'
        || s.seatStatus !== 'AVAILABLE'
        || (s.runtimeStatus === 'HOLDING' && !isMyHeldSeat)
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
  const defaultVipPrice = selectedShowtime?.vipPrice || Math.round(defaultSinglePrice * 1.25);
  const defaultCouplePrice = selectedShowtime?.couplePrice || (defaultSinglePrice * 2);

  const roomMaxColumns = useMemo(() => {
    if (!seats.length) return 8;
    return Math.max(
      seatMapData?.columnCount || 8,
      ...seats.map(s => s.displayColumn || s.col || 1)
    );
  }, [seats, seatMapData]);

  // Seat selection: Click seat to trigger inline ticket type modal (Người lớn, Sinh viên, Trẻ em)
  const handleSelectSeat = (seat) => {
    if (hasDraggedSeatMapRef.current) return;
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
      // Before deselecting, check the resulting selection wouldn't leave a single seat gap
      const afterDeselect = selectedSeats.filter(s => !seatGroup.some(groupSeat => groupSeat.id === s.id));
      const deselCheck = validateNoSingleSeatGap(afterDeselect, seats, seat.row);
      if (!deselCheck.valid) {
        showToast('Không thể bỏ ghế này vì sẽ tạo ra 1 ghế trống đơn lẻ.');
        triggerSeatShake(seat.id);
        return;
      }
      setSelectedSeats(afterDeselect);
      return;
    }

    // Limit total seats per booking to 8
    if (selectedSeats.length + seatGroup.length > 8) {
      showToast('Mỗi đơn đặt vé tối đa 8 ghế.');
      return;
    }

    const tentative = [...selectedSeats, ...seatGroup];
    const gapCheck = validateNoSingleSeatGap(tentative, seats, seat.row);
    if (!gapCheck.valid) {
      showToast('Không thể chọn ghế này vì sẽ để lại 1 ghế trống đơn lẻ.');
      triggerSeatShake(seat.id);
      return;
    }

    // Couple seat → mặc định 2 Người lớn, không cần modal
    const sType = normalizeSeatType(seat.type);
    if (isCoupleSeat) {
      const adultMeta = TICKET_TYPES.find(t => t.type === 'ADULT') || { label: 'Nguoi lon' };
      const unitPrice = getSeatTicketPrice(selectedShowtime, sType, 'ADULT');
      const newSeats = seatGroup.map(s => ({
        ...s,
        ticketType: 'ADULT',
        ticketTypeLabel: adultMeta.label,
        price: Math.round(unitPrice / 2),
        couplePrice: unitPrice
      }));
      setSelectedSeats(prev => [...prev, ...newSeats]);
      return;
    }

    // Single / VIP → mở modal chọn loại vé
    setTicketModalData({
      seat,
      seatGroup,
      isCouple: false,
      isVip: sType === 'VIP',
      seatType: sType,
      seatName: `Ghe ${seat.row}${seat.col}`
    });
  };

  const handleConfirmTicketType = (chosenType) => {
    if (!ticketModalData) return;
    const { seatGroup, seatType } = ticketModalData;
    const unitPrice = getSeatTicketPrice(selectedShowtime, seatType, chosenType);
    const typeMeta = TICKET_TYPES.find(t => t.type === chosenType) || { label: 'Nguoi lon' };
    const newSeats = seatGroup.map(s => ({
      ...s,
      ticketType: chosenType,
      ticketTypeLabel: typeMeta.label,
      price: unitPrice
    }));
    setSelectedSeats(prev => [...prev, ...newSeats]);
    setTicketModalData(null);
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

  const totalTickets = Object.values(ticketQuantities).reduce((sum, quantity) => sum + quantity, 0);
  const ticketsMatchSeats = selectedSeats.length > 0 && totalTickets === selectedSeats.length;
  const buildTicketRequests = () => TICKET_TYPES
    .filter(({ type }) => ticketQuantities[type] > 0)
    .map(({ type, age }) => ({ ticketType: type, viewerAge: age, quantity: ticketQuantities[type] }));

  const handleModifyTicket = (type, delta) => {
    setTicketQuantities((current) => {
      const currentTotal = Object.values(current).reduce((sum, quantity) => sum + quantity, 0);
      if (delta > 0 && currentTotal >= selectedSeats.length) return current;
      return { ...current, [type]: Math.max(0, current[type] + delta) };
    });
  };

  // Sync ticket quantities directly from selected seats
  useEffect(() => {
    if (selectedSeats.length > 0) {
      const counts = { ADULT: 0, STUDENT: 0, CHILD: 0 };
      selectedSeats.forEach(s => {
        const t = s.ticketType || 'ADULT';
        if (counts[t] !== undefined) counts[t]++;
        else counts.ADULT++;
      });
      setTicketQuantities(counts);
    } else {
      setTicketQuantities(EMPTY_TICKET_QUANTITIES);
    }
  }, [selectedSeats, selectedShowtime?.id]);

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
      tickets: ticketsMatchSeats ? buildTicketRequests() : undefined,
      foods: buildFoodRequests(),
      cinePointsToUse: pointsToUseNumber > 0 ? pointsToUseNumber : null
    })
      .then((quote) => {
        if (cancelled) return;
        setCheckoutQuote(quote);
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
  }, [selectedShowtime?.id, selectedSeats, selectedCombos, pointsToUseNumber, ticketQuantities]);

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

  // Group selected seats for summary (Rule 16)
  const selectedSeatsSummary = useMemo(() => {
    const items = [];
    const processedIds = new Set();

    for (const seat of selectedSeats) {
      if (processedIds.has(seat.id)) continue;
      const isCouple = normalizeSeatType(seat.type) === 'COUPLE';
      const isVip = normalizeSeatType(seat.type) === 'VIP';
      const ticketTypeLabel = seat.ticketTypeLabel || (seat.ticketType === 'STUDENT' ? 'Sinh viên' : seat.ticketType === 'CHILD' ? 'Trẻ em' : 'Người lớn');

      if (isCouple) {
        const pair = getCoupleSeatPair(seat, seats);
        pair.forEach(p => processedIds.add(p.id));
        const pairCode = pair.map(p => `${p.row}${p.col}`).join('-');
        const couplePrice = seat.couplePrice || (seat.price ? seat.price * 2 : defaultCouplePrice);
        items.push({
          code: pairCode || `${seat.row}${seat.col}`,
          label: 'Ghế đôi',
          ticketType: seat.ticketType || 'ADULT',
          ticketTypeLabel,
          seatType: 'COUPLE',
          capacity: 2,
          price: couplePrice
        });
      } else if (isVip) {
        processedIds.add(seat.id);
        items.push({
          code: `${seat.row}${seat.col}`,
          label: 'Ghế VIP',
          ticketType: seat.ticketType || 'ADULT',
          ticketTypeLabel,
          seatType: 'VIP',
          capacity: 1,
          price: seat.price || defaultVipPrice
        });
      } else {
        processedIds.add(seat.id);
        items.push({
          code: `${seat.row}${seat.col}`,
          label: 'Ghế thường',
          ticketType: seat.ticketType || 'ADULT',
          ticketTypeLabel,
          seatType: 'SINGLE',
          capacity: 1,
          price: seat.price || defaultSinglePrice
        });
      }
    }

    const singleCount = items.filter(i => i.seatType === 'SINGLE' || i.seatType === 'VIP').length;
    const coupleCount = items.filter(i => i.seatType === 'COUPLE').length;
    const totalCapacity = singleCount * 1 + coupleCount * 2;

    return {
      items,
      singleCount,
      coupleCount,
      totalCapacity
    };
  }, [selectedSeats, seats, defaultSinglePrice, defaultVipPrice, defaultCouplePrice]);

  // Hold Seats on Backend
  const handleProceedToCombos = () => {
    if (selectedSeats.length === 0) {
      showToast('Vui lòng chọn ít nhất một ghế.');
      return;
    }
    const gapCheck = validateNoSingleSeatGap(selectedSeats, seats);
    if (!gapCheck.valid) {
      showToast('Không thể chọn ghế này vì sẽ để lại 1 ghế trống đơn lẻ.');
      return;
    }
    if (!ticketsMatchSeats) {
      showToast(`Vui lòng chọn đủ ${selectedSeats.length} vé tương ứng với ${selectedSeats.length} ghế đã chọn.`);
      return;
    }
    setBookingStep('combos');
  };

  const handleProceedToPayment = async () => {
    if (selectedSeats.length === 0) {
      showToast('Vui lòng chọn ghế.');
      return;
    }
    const gapCheck = validateNoSingleSeatGap(selectedSeats, seats);
    if (!gapCheck.valid) {
      showToast('Không thể chọn ghế này vì sẽ để lại 1 ghế trống đơn lẻ.');
      return;
    }
    if (!ticketsMatchSeats) {
      showToast(`Vui lòng chọn đủ ${selectedSeats.length} vé tương ứng với ${selectedSeats.length} ghế đã chọn.`);
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
            tickets: buildTicketRequests(),
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
        tickets: buildTicketRequests(),
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

  const ticketTypeSelector = null;

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
      <div className="square-ui mx-auto max-w-5xl px-4 py-12 sm:px-6 lg:px-8 space-y-8 pb-24 text-white">
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
                  <p className="text-xs text-neutral-400">{[selectedShowtime?.format, selectedShowtime?.startTime?.slice(11, 16)].filter(Boolean).join(' • ')}</p>
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
    <div className="square-ui mx-auto max-w-6xl px-3.5 sm:px-6 pt-3 sm:pt-4 pb-20 space-y-4 text-white">
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

      {/* Booking workspace: ticket types | seats | order information */}
      <div className={`grid grid-cols-1 lg:grid-cols-12 ${bookingStep !== 'combos' ? 'gap-4' : 'gap-6'} items-start`}>
        <div className={`${bookingStep !== 'combos' ? 'lg:col-span-9' : 'lg:col-span-8'} space-y-4`}>

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
                <div className="grid grid-cols-1 xl:grid-cols-[220px_minmax(0,1fr)] gap-4 items-start">
                  {/* 1. CHỌN NGÀY CHIẾU (ĐƯA LÊN ĐẦU TRANG - KHÔNG CUỘN NGANG) */}
              <div id="schedule-section" className="xl:row-span-2 rounded-none border border-white/10 bg-neutral-950 p-3 space-y-2.5 shadow-md scroll-mt-24 sm:scroll-mt-28">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/10 pt-0.5 pb-2">
                  <div className="flex items-center gap-2">
                    <div className="h-6 w-6 rounded-none bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 shrink-0">
                      <Calendar className="w-3.5 h-3.5" />
                    </div>
                    <div>
                      <h3 className="text-xs font-bold text-white uppercase tracking-wider">1. Chọn Ngày Chiếu</h3>
                      <p className="text-[10px] text-neutral-400">Xem lịch các ngày sắp chiếu (không hiển thị ngày quá khứ)</p>
                    </div>
                  </div>

                  <span className="text-[10px] text-amber-400/90 font-mono font-semibold bg-amber-950/30 border border-amber-500/20 px-2 py-0.5 rounded-none">
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
                  <div className="grid grid-cols-2 sm:grid-cols-4 xl:grid-cols-1 gap-1.5 w-full pt-1.5">
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
                          className={`w-full py-2 px-0.5 sm:px-1 rounded-none border flex flex-col items-center justify-between transition-all duration-150 group relative select-none ${
                            isSelected
                              ? 'bg-gradient-to-b from-amber-400 to-amber-500 text-black border-amber-300 shadow-md shadow-amber-500/25 scale-[1.02] font-black ring-1.5 ring-amber-400/50'
                              : 'bg-neutral-900/90 text-neutral-300 border-white/10 hover:border-amber-500/40 hover:bg-neutral-850'
                          }`}
                        >
                          {isCurrentDay && (
                            <span className={`absolute -top-2 px-1 sm:px-1.5 py-0.2 rounded-none text-[7px] sm:text-[8px] font-black uppercase tracking-wider z-10 ${
                              isSelected ? 'bg-black text-amber-400 border border-amber-400/30' : 'bg-amber-500 text-black shadow'
                            }`}>
                              Hôm nay
                            </span>
                          )}
                          <span className={`w-full grid grid-cols-[1fr_auto] items-center gap-x-2 text-[9px] sm:text-[10px] uppercase font-bold tracking-tight leading-tight ${
                            isSelected ? 'text-black' : 'text-neutral-400 group-hover:text-amber-400'
                          }`}>
                            <span className="text-left hidden md:inline">{weekday}</span>
                            <span className="text-left md:hidden">{shortWeekday}</span>
                            <span className={`text-[10px] leading-none font-black font-mono scale-[1.8] origin-right ${isSelected ? 'text-black/80' : showtimeCount > 0 ? 'text-amber-400' : 'text-neutral-500'}`}>
                              {showtimeCount}
                            </span>
                          </span>
                          <span className="w-full grid grid-cols-[1fr_auto] items-end gap-x-2 mt-1">
                            <span className="text-left text-base font-black font-mono tracking-tight">{dayMonth}</span>
                            <span className={`text-[9px] font-medium uppercase ${isSelected ? 'text-black/80 font-bold' : 'text-neutral-500'}`}>
                              suất
                            </span>
                          </span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* 2. CHỌN SUẤT CHIẾU (Showtimes Grid) */}
              <div className="rounded-none border border-white/10 bg-neutral-950 p-4 sm:p-5 space-y-4 shadow-md">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/10 pb-3">
                  <div className="flex items-center gap-2.5">
                    <div className="h-7 w-7 rounded-none bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
                      <Clock className="w-4 h-4" />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-white uppercase tracking-wider">2. Khung Giờ Chiếu</h3>
                      <p className="text-[11px] text-neutral-400">Giờ bắt đầu — Giờ kết thúc (tính theo thời lượng phim)</p>
                    </div>
                  </div>

                  <span className="text-[10.5px] font-mono text-neutral-400 bg-neutral-900 border border-white/10 px-2.5 py-1 rounded-none">
                    Đóng đặt vé trước 10 phút
                  </span>
                </div>

                {groupedShowtimesByFormat.length === 0 ? (
                  <div className="text-center py-12 space-y-2.5 rounded-none border border-white/5 bg-neutral-900/30 p-6">
                    <CalendarX className="w-8 h-8 text-neutral-500 mx-auto" />
                    <p className="text-sm font-semibold text-neutral-300">
                      Hiện không còn suất chiếu khả dụng trong ngày này.
                    </p>
                    <p className="text-xs text-neutral-500">
                      Vui lòng chọn ngày khác ở danh sách bên cạnh.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {groupedShowtimesByFormat.map(({ formatKey, meta, showtimes }) => (
                      <div
                        key={formatKey}
                        className="rounded-none border border-[#252a32] bg-[#0c0f14] p-3.5 sm:p-4 space-y-3 shadow-sm"
                      >
                        {/* Format Category Header */}
                        <div className="flex items-center justify-between border-b border-[#22272f] pb-2">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className={`text-[10px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded-none border ${meta.badgeBg}`}>
                              {formatKey}
                            </span>
                            <span className="text-xs font-bold text-white uppercase tracking-wide">
                              {meta.label}
                            </span>
                            {meta.sublabel && (
                              <span className="text-[10px] text-neutral-500 hidden sm:inline">
                                • {meta.sublabel}
                              </span>
                            )}
                          </div>
                          <span className="text-[10px] font-mono text-amber-400/80 font-semibold">
                            {showtimes.length} suất
                          </span>
                        </div>

                        {/* Showtimes: Compact time-only chips, centered text, breathing room on sides */}
                        <div className="flex flex-wrap gap-2">
                          {showtimes.map(st => {
                            const isSelected = selectedShowtime?.id === st.id;
                            const startStr = new Date(st.startTime).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
                            const isBookable = isShowtimeBookable(st);

                            return (
                              <button
                                key={st.id}
                                type="button"
                                disabled={!isBookable}
                                onClick={() => { if (isBookable) handleSelectShowtime(st); }}
                                className={`group relative rounded-none border transition-all duration-150 cursor-pointer flex items-center justify-center ${
                                  !isBookable
                                    ? 'border-[#22262d] bg-[#0f1216]/60 text-neutral-600 cursor-not-allowed opacity-40'
                                    : isSelected
                                      ? 'border-[#f5b800] bg-[#f5b800]/15 text-[#f5b800] ring-1 ring-[#f5b800]/60 shadow-[0_0_12px_rgba(245,184,0,0.2)]'
                                      : 'border-[#282d35] bg-[#11151b] hover:border-[#f5b800]/60 hover:bg-[#181d26] text-neutral-200 hover:text-white hover:-translate-y-0.5 hover:shadow-[0_4px_12px_rgba(245,184,0,0.1)]'
                                }`}
                                style={{ height: '38px', paddingLeft: '14px', paddingRight: '14px' }}
                              >
                                <span className={`font-mono font-black tracking-tight text-sm leading-none ${
                                  !isBookable ? 'line-through' : ''
                                }`}>
                                  {startStr}
                                </span>
                                {isSelected && (
                                  <span className="ml-1.5 text-[10px] font-black text-[#f5b800]">✓</span>
                                )}
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
          )}
        </div>
      )}

          {/* =========================================================================
              VIEW 2: CHỌN GHẾ (SEAT MAP SCREEN)
              ========================================================================= */}
          {bookingStep === 'seats' && (
            <div className="space-y-4">
              {/* Selected Showtime Breadcrumb / Mini-Header */}
              <div className="border border-white/10 bg-neutral-900/90 p-3 sm:p-3.5 rounded-none flex flex-wrap items-center justify-between gap-3 shadow-md backdrop-blur-md">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-none bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 shrink-0">
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
                      {selectedShowtime?.format && (
                        <>
                          <span className="text-neutral-600">•</span>
                          <span className="text-neutral-300">{selectedShowtime.format}</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleBackToSchedule}
                  className="px-3 py-1.5 rounded-none border border-white/20 hover:border-amber-400 bg-neutral-950 hover:bg-neutral-800 text-neutral-300 hover:text-amber-400 text-[11px] font-bold uppercase tracking-wider transition flex items-center gap-1.5 shadow"
                >
                  <RefreshCw className="w-3 h-3" />
                  <span>Đổi suất chiếu</span>
                </button>
              </div>

              <div className="w-full">
              {/* Seat Map Screen - MATCHING ADMIN ROOMS UI */}
              <div className="border border-[#292e35] rounded-none bg-[#080a0d] shadow-xl overflow-hidden flex flex-col select-none">
                {/* Seat Map Loading / Error states */}
                {isLoadingSeatMap ? (
                  <div className="flex flex-col items-center justify-center gap-2 py-20 text-neutral-400 text-xs">
                    <Loader2 className="h-6 w-6 animate-spin text-amber-500" />
                    <span>Đang tải sơ đồ ghế phòng chiếu...</span>
                  </div>
                ) : !selectedShowtime ? (
                  <p className="text-center text-neutral-500 text-xs py-20">Vui lòng chọn suất chiếu để tải sơ đồ ghế.</p>
                ) : seats.length === 0 ? (
                  <div className="text-center py-20 space-y-2">
                    <p className="text-neutral-400 text-xs">Phòng chiếu chưa được cấu hình sơ đồ ghế.</p>
                    <button onClick={refreshSeatMap} className="px-3 py-1.5 text-xs bg-neutral-800 text-white rounded hover:bg-neutral-700">
                      Thử lại
                    </button>
                  </div>
                ) : (
                  <>
                    {/* Interactive Seat Viewport with Pan and Wheel Zoom */}
                    <div
                      ref={seatMapViewportRef}
                      onMouseDown={handleSeatMapMouseDown}
                      className={`relative w-full h-[520px] sm:h-[600px] overflow-hidden select-none flex items-center justify-center p-4 ${
                        isDraggingSeatMap ? 'cursor-grabbing' : 'cursor-grab'
                      }`}
                      style={{
                        background: 'radial-gradient(ellipse at 50% 0%, rgba(245,184,0,0.06), transparent 50%), #080a0d',
                        backgroundImage: 'radial-gradient(ellipse at 50% 0%, rgba(245,184,0,0.06), transparent 50%), repeating-linear-gradient(0deg, transparent 0 23px, rgba(255,255,255,0.012) 23px 24px), repeating-linear-gradient(90deg, transparent 0 23px, rgba(255,255,255,0.012) 23px 24px)'
                      }}
                    >
                      {/* Floating Pan & Zoom Hint Top-Left */}
                      <div className="absolute top-3 left-3 z-20 pointer-events-none flex items-center gap-1.5 px-2.5 py-1 bg-black/75 border border-white/10 text-[10px] text-neutral-300 font-mono shadow-md backdrop-blur-sm">
                        <Move className="w-3 h-3 text-[#f5b800]" />
                        <span>Đè chuột trái để kéo • Cuộn chuột để zoom</span>
                      </div>

                      {/* Reset Button Top-Right (when panned or zoomed) */}
                      {(panOffset.x !== 0 || panOffset.y !== 0 || seatZoom !== 1) && (
                        <button
                          type="button"
                          onClick={handleResetSeatMapView}
                          className="absolute top-3 right-3 z-20 flex items-center gap-1 px-2.5 py-1 bg-neutral-900/90 hover:bg-neutral-800 border border-white/20 text-[10.5px] text-[#f5b800] font-mono shadow-md transition"
                          title="Đưa sơ đồ về giữa 100%"
                        >
                          <RotateCcw className="w-3 h-3" />
                          <span>Về giữa</span>
                        </button>
                      )}

                      {/* Scalable & Movable World: Screen + Seat Grid */}
                      <div
                        className="w-max mx-auto flex flex-col items-center shrink-0 origin-center"
                        style={{
                          transform: `translate3d(${panOffset.x}px, ${panOffset.y}px, 0) scale(${seatZoom})`,
                          transformOrigin: 'center center',
                          transition: isDraggingSeatMap ? 'none' : 'transform 100ms cubic-bezier(0.2, 0, 0, 1)'
                        }}
                      >
                        {/* Cinema Screen matching AdminRoomsPanel */}
                        <div className="w-[min(76%,540px)] mb-3 flex flex-col items-center shrink-0">
                          <div
                            className="w-full h-2 rounded-none shadow-[0_8px_30px_rgba(245,184,0,0.22)]"
                            style={{
                              background: 'linear-gradient(90deg, transparent, #c69100, #f5b800, #ffe082, #f5b800, #c69100, transparent)'
                            }}
                          />
                          <span className="text-[11px] font-sans font-bold text-[#c9a94e] tracking-[0.25em] uppercase mt-2.5 mb-5 text-center whitespace-nowrap">
                            MÀN HÌNH CHIẾU
                          </span>
                        </div>

                        {/* Seat Track Grid */}
                        <div className="w-max min-w-[360px] mx-auto grid gap-y-2 px-3 sm:px-8 pb-4">
                          {[...new Map(seats.map(s => [s.row, s])).values()]
                            .sort((a, b) => (a.displayOrder - b.displayOrder) || String(a.row).localeCompare(String(b.row)))
                            .map((rowSeed) => {
                              const rowLetter = rowSeed.row;
                              const rowSeats = seats
                                .filter(s => s.row === rowLetter)
                                .sort((a, b) => (a.displayColumn - b.displayColumn) || (a.col - b.col));

                              // Group seats in this row into renderable units
                              const rowItems = [];
                              let idx = 0;
                              while (idx < rowSeats.length) {
                                const curSeat = rowSeats[idx];
                                if (curSeat.type === 'COUPLE') {
                                  const nextSeat = rowSeats[idx + 1];
                                  if (nextSeat && nextSeat.type === 'COUPLE') {
                                    rowItems.push({
                                      kind: 'COUPLE_PAIR',
                                      seat1: curSeat,
                                      seat2: nextSeat,
                                      displayColumn: curSeat.displayColumn || curSeat.col || (idx + 1)
                                    });
                                    idx += 2;
                                  } else {
                                    rowItems.push({
                                      kind: 'SINGLE',
                                      seat: curSeat,
                                      displayColumn: curSeat.displayColumn || curSeat.col || (idx + 1)
                                    });
                                    idx++;
                                  }
                                } else {
                                  rowItems.push({
                                    kind: curSeat.type === 'VIP' ? 'VIP' : 'SINGLE',
                                    seat: curSeat,
                                    displayColumn: curSeat.displayColumn || curSeat.col || (idx + 1)
                                  });
                                  idx++;
                                }
                              }

                              return (
                                <div key={rowLetter} className="flex items-center justify-center gap-x-2.5">
                                  {/* Left Row Label */}
                                  <div className="w-8 flex items-center justify-center shrink-0">
                                    <span className="w-8 h-7 flex items-center justify-center rounded-none bg-[#101318] border border-[#30353d] text-[11px] font-mono font-bold text-[#d5d8dc]">
                                      {rowLetter}
                                    </span>
                                  </div>

                                  {/* Center Seat Track (CSS Grid matching AdminRoomsPanel) */}
                                  <div
                                    className="grid gap-1.5 justify-center items-center"
                                    style={{
                                      gridTemplateColumns: `repeat(${roomMaxColumns}, 32px)`,
                                      gridAutoRows: '28px'
                                    }}
                                  >
                                    {rowItems.map((item) => {
                                      if (item.kind === 'COUPLE_PAIR') {
                                        const { seat1, seat2, displayColumn } = item;
                                        const selectedCoupleObj = selectedSeats.find(s => s.id === seat1.id || s.id === seat2.id);
                                        const isPairSelected = !!selectedCoupleObj;
                                        const coupleTheme = isPairSelected
                                          ? (TICKET_TYPE_THEMES[selectedCoupleObj?.ticketType] || TICKET_TYPE_THEMES.ADULT)
                                          : null;
                                        const isPairBooked = seat1.isBooked || seat2.isBooked;
                                        const isPairShaking = shakingSeatId === seat1.id || shakingSeatId === seat2.id;

                                        return (
                                          <button
                                            key={`couple-${seat1.id}-${seat2.id}`}
                                            type="button"
                                            disabled={isPairBooked}
                                            style={{
                                              gridColumn: `${displayColumn} / span 2`,
                                              width: '70px',
                                              height: '28px',
                                              backgroundColor: isPairBooked
                                                ? '#1e232a'
                                                : isPairSelected
                                                  ? coupleTheme.bg
                                                  : '#831843',
                                              border: isPairBooked
                                                ? '1.5px solid #2d333b'
                                                : isPairSelected
                                                  ? `1.5px solid ${coupleTheme.border}`
                                                  : '1.5px solid #ec4899',
                                              color: isPairBooked
                                                ? '#4f5660'
                                                : isPairSelected
                                                  ? coupleTheme.text
                                                  : '#f9a8d4',
                                              boxShadow: isPairSelected ? coupleTheme.shadow : undefined
                                            }}
                                            aria-label={`Ghế đôi ${seat1.row}${seat1.col}-${seat2.row}${seat2.col} - ${isPairBooked ? 'đã có người đặt' : isPairSelected ? `đang chọn (${coupleTheme.label})` : 'còn trống'}`}
                                            onClick={() => handleSelectSeat(seat1)}
                                            className={`${isPairShaking ? 'animate-seat-shake ' : ''}rounded-none flex items-center justify-center gap-1 font-mono text-[10.5px] font-bold transition-all duration-150 cursor-pointer ${
                                              isPairBooked
                                                ? 'line-through cursor-not-allowed opacity-50'
                                                : isPairSelected
                                                  ? 'font-black ring-2 scale-105 z-10'
                                                  : 'hover:-translate-y-0.5 hover:shadow-[0_0_8px_rgba(236,72,153,0.3)]'
                                            }`}
                                            title={`Ghế đôi ${seat1.col}-${seat2.col} • ${isPairBooked ? 'Đã bán/giữ' : isPairSelected ? `Bạn chọn (${coupleTheme.label})` : 'Còn trống'}`}
                                          >
                                            <span>{seat1.col}</span>
                                            <span className="opacity-40">♥</span>
                                            <span>{seat2.col}</span>
                                            {isPairSelected && (
                                              <span
                                                className="ml-0.5 text-[7.5px] font-black uppercase px-1 py-0.2 rounded-none bg-black/40 text-white"
                                              >
                                                {coupleTheme.shortLabel}
                                              </span>
                                            )}
                                          </button>
                                        );
                                      }

                                      const { seat, displayColumn } = item;
                                      const selectedSeatObj = selectedSeats.find(s => s.id === seat.id);
                                      const isSelected = !!selectedSeatObj;
                                      const seatTheme = isSelected
                                        ? (TICKET_TYPE_THEMES[selectedSeatObj?.ticketType] || TICKET_TYPE_THEMES.ADULT)
                                        : null;
                                      const isVip = item.kind === 'VIP';
                                      const isSeatShaking = shakingSeatId === seat.id;

                                      return (
                                        <button
                                          key={seat.id}
                                          type="button"
                                          disabled={seat.isBooked}
                                          style={{
                                            gridColumn: displayColumn,
                                            width: '32px',
                                            height: '28px',
                                            backgroundColor: seat.isBooked
                                              ? '#1e232a'
                                              : isSelected
                                                ? seatTheme.bg
                                                : isVip
                                                  ? 'rgba(245,184,0,0.14)'
                                                  : '#161b20',
                                            border: seat.isBooked
                                              ? '1.5px solid #2d333b'
                                              : isSelected
                                                ? `1.5px solid ${seatTheme.border}`
                                                : isVip
                                                  ? '1.5px solid #f5b800'
                                                  : '1.5px solid #697078',
                                            color: seat.isBooked
                                              ? '#4f5660'
                                              : isSelected
                                                ? seatTheme.text
                                                : isVip
                                                  ? '#ffc400'
                                                  : '#e5e7eb',
                                            boxShadow: isSelected ? seatTheme.shadow : undefined
                                          }}
                                          aria-label={`${seat.row}${seat.col} - ${isVip ? 'Ghế VIP' : 'Ghế đơn'} - ${seat.isBooked ? 'đã có người đặt' : isSelected ? `đang chọn (${seatTheme.label})` : 'còn trống'}`}
                                          onClick={() => handleSelectSeat(seat)}
                                          className={`${isSeatShaking ? 'animate-seat-shake ' : ''}rounded-none flex items-center justify-center font-mono text-[10.5px] font-bold transition-all duration-150 cursor-pointer ${
                                            seat.isBooked
                                              ? 'line-through cursor-not-allowed opacity-50'
                                              : isSelected
                                                ? 'font-black ring-2 scale-105 z-10'
                                                : isVip
                                                  ? 'hover:-translate-y-0.5 hover:shadow-[0_0_8px_rgba(245,184,0,0.35)]'
                                                  : 'hover:-translate-y-0.5 hover:border-neutral-400'
                                          }`}
                                          title={`${isVip ? 'Ghế VIP' : 'Ghế đơn'} ${seat.id} • ${seat.isBooked ? 'Đã bán/giữ' : isSelected ? `Bạn chọn (${seatTheme.label})` : 'Còn trống'}`}
                                        >
                                          {isSelected ? (
                                            <div className="flex flex-col items-center justify-center leading-none">
                                              <span className="text-[10px] font-black">{seat.col}</span>
                                              <span className="text-[7px] font-black uppercase tracking-tighter opacity-95">
                                                {seatTheme.shortLabel}
                                              </span>
                                            </div>
                                          ) : (
                                            seat.col
                                          )}
                                        </button>
                                      );
                                    })}
                                  </div>

                                  {/* Right Row Label */}
                                  <div className="w-8 flex items-center justify-center shrink-0">
                                    <span className="w-8 h-7 flex items-center justify-center rounded-none bg-[#101318] border border-[#30353d] text-[11px] font-mono font-bold text-[#d5d8dc]">
                                      {rowLetter}
                                    </span>
                                  </div>
                                </div>
                              );
                            })}
                        </div>
                      </div>
                    </div>

                    {/* Unified Bottom Control & Legend Bar */}
                    <div className="border-t border-[#24282f] bg-[#0c0f13] w-full px-4 py-3 flex flex-col lg:flex-row items-center justify-between gap-3 shrink-0 z-20">
                      {/* Legend Items */}
                      <div className="flex items-center gap-2.5 sm:gap-3 flex-wrap text-xs text-[#9ca3af] justify-center lg:justify-start">
                        {/* Physical Seats */}
                        <div className="flex items-center gap-2 sm:gap-2.5 flex-wrap">
                          <span className="flex items-center gap-1.5">
                            <span className="w-3.5 h-3 rounded-none bg-[#161b20] border border-[#697078]" />
                            Ghế thường
                          </span>
                          <span className="flex items-center gap-1.5 text-amber-300 font-medium">
                            <span className="w-3.5 h-3 rounded-none bg-amber-500/15 border border-[#f5b800]" />
                            VIP
                          </span>
                          <span className="flex items-center gap-1.5 text-pink-300 font-medium">
                            <span className="w-6 h-3 rounded-none bg-[#831843] border border-[#ec4899]" />
                            Ghế đôi
                          </span>
                          <span className="flex items-center gap-1.5 text-neutral-500">
                            <span className="w-3.5 h-3 rounded-none bg-[#1e232a] border border-[#2d333b]" />
                            Đã đặt
                          </span>
                        </div>

                        {/* Divider */}
                        <span className="w-[1px] h-3.5 bg-white/15 hidden sm:inline-block" />

                        {/* Ticket Demographic Colors */}
                        <div className="flex items-center gap-2 sm:gap-2.5 flex-wrap">
                          <span className="flex items-center gap-1.5 text-amber-400 font-semibold">
                            <span className="w-3.5 h-3 rounded-none bg-[#f5b800] border border-[#ffe082]" />
                            Người lớn (NL)
                          </span>
                          <span className="flex items-center gap-1.5 text-sky-400 font-semibold">
                            <span className="w-3.5 h-3 rounded-none bg-[#0284c7] border border-[#38bdf8]" />
                            Sinh viên (SV)
                          </span>
                          <span className="flex items-center gap-1.5 text-emerald-400 font-semibold">
                            <span className="w-3.5 h-3 rounded-none bg-[#059669] border border-[#34d399]" />
                            Trẻ em (TE)
                          </span>
                        </div>
                      </div>

                      {/* Zoom Controls in toolbar (NO OVERLAPPING!) */}
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="hidden xl:inline-flex items-center gap-1 text-[11px] text-neutral-400 font-sans mr-1">
                          <Move className="w-3 h-3 text-[#f5b800]" />
                          <span>Kéo chuột • Cuộn zoom</span>
                        </span>

                        <div className="flex items-center bg-[#101318] border border-[#2a2f36] rounded-none divide-x divide-[#2a2f36] shadow-md">
                          <button
                            type="button"
                            onClick={() => setSeatZoom(z => Math.max(0.5, Number((z - 0.1).toFixed(2))))}
                            title="Thu nhỏ (-) hoặc lăn chuột xuống"
                            disabled={seatZoom <= 0.5}
                            className="w-8 h-8 flex items-center justify-center text-neutral-300 hover:text-white hover:bg-neutral-800 disabled:opacity-30 disabled:cursor-not-allowed transition"
                          >
                            <ZoomOut className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={handleResetSeatMapView}
                            title="Đặt lại tỉ lệ 100% và đưa về giữa"
                            className="px-2.5 h-8 flex items-center justify-center font-mono text-[11px] font-bold text-[#f5b800] hover:bg-neutral-800 transition"
                          >
                            {Math.round(seatZoom * 100)}%
                          </button>
                          <button
                            type="button"
                            onClick={() => setSeatZoom(z => Math.min(2.0, Number((z + 0.1).toFixed(2))))}
                            title="Phóng to (+) hoặc lăn chuột lên"
                            disabled={seatZoom >= 2.0}
                            className="w-8 h-8 flex items-center justify-center text-neutral-300 hover:text-white hover:bg-neutral-800 disabled:opacity-30 disabled:cursor-not-allowed transition"
                          >
                            <ZoomIn className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={handleResetSeatMapView}
                            title="Đưa sơ đồ về vị trí ban đầu"
                            className="w-8 h-8 flex items-center justify-center text-neutral-400 hover:text-[#f5b800] hover:bg-neutral-800 transition"
                          >
                            <RotateCcw className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  </>
                )}
              </div>
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
        <div className={`${bookingStep !== 'combos' ? 'lg:col-span-3' : 'lg:col-span-4'} border border-white/10 bg-neutral-950 p-4 sm:p-5 rounded-2xl space-y-4 shadow-xl sticky top-20`}>
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
              {selectedShowtime?.format && (
                <span className="text-[10px] font-semibold text-neutral-400">
                  {selectedShowtime.format}
                </span>
              )}
            </div>

            <div className="space-y-1.5 text-neutral-400 text-xs pt-0.5">
              <div className="flex justify-between items-center">
                <span>Rạp chiếu:</span>
                <span className="text-white font-semibold">CineAI Central</span>
              </div>
              {selectedShowtime?.format && (
                <div className="flex justify-between items-center">
                  <span>Định dạng:</span>
                  <span className="text-white font-semibold">
                    {selectedShowtime.format}
                  </span>
                </div>
              )}
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
                  <Armchair className="w-4 h-4" />
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
                    {selectedSeatsSummary.items.map((item, idx) => {
                      const tTheme = TICKET_TYPE_THEMES[item.ticketType] || TICKET_TYPE_THEMES.ADULT;
                      return (
                        <div key={idx} className="flex items-center justify-between bg-neutral-900/70 p-2 rounded-none border border-white/5">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="font-mono font-bold text-white text-sm mr-1">{item.code}</span>
                            <span className={`text-[10px] px-1.5 py-0.2 rounded-none border font-semibold ${item.seatType === 'COUPLE' ? 'bg-pink-500/15 border-pink-500/40 text-pink-300' : 'bg-neutral-800 border-white/10 text-neutral-300'}`}>
                              {item.label}
                            </span>
                            <span
                              className="text-[10px] px-1.5 py-0.2 rounded-none border font-bold uppercase tracking-wider flex items-center gap-1"
                              style={{
                                backgroundColor: `${tTheme.color}20`,
                                borderColor: `${tTheme.color}55`,
                                color: tTheme.color
                              }}
                            >
                              <span className="text-[9px]">{tTheme.dot}</span>
                              <span>{item.ticketTypeLabel}</span>
                            </span>
                          </div>
                          <span className="font-mono font-bold text-neutral-200">{formatVnd(item.price)}</span>
                        </div>
                      );
                    })}

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

              {totalTickets > 0 && (
                <div className="space-y-2 border-b border-white/10 pb-4 text-xs">
                  <span className="font-bold uppercase tracking-wider text-amber-400 block">Phân loại vé</span>
                  {TICKET_TYPES.filter(({ type }) => ticketQuantities[type] > 0).map((ticketType) => {
                    const theme = TICKET_TYPE_THEMES[ticketType.type] || TICKET_TYPE_THEMES.ADULT;
                    return (
                      <div key={ticketType.type} className="flex justify-between items-center text-neutral-300">
                        <div className="flex items-center gap-1.5">
                          <span className="w-2.5 h-2.5 rounded-none" style={{ backgroundColor: theme.color }} />
                          <span className="font-medium text-white">{ticketType.label} ({theme.shortLabel})</span>
                        </div>
                        <span className="font-mono font-bold" style={{ color: theme.color }}>
                          {ticketQuantities[ticketType.type]} vé
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}

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
                  disabled={!ticketsMatchSeats || isHolding}
                  onClick={handleProceedToCombos}
                  className="w-full py-3.5 bg-gradient-to-r from-amber-500 to-amber-400 hover:from-amber-400 hover:to-amber-300 text-black font-extrabold uppercase tracking-wider text-xs rounded-none shadow-lg shadow-amber-500/20 transition disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  <span>TIẾP TỤC CHỌN BẮP NƯỚC</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              ) : (
                <button
                  disabled={!ticketsMatchSeats || isHolding}
                  onClick={handleProceedToPayment}
                  className="w-full py-3.5 bg-gradient-to-r from-amber-500 to-amber-400 hover:from-amber-400 hover:to-amber-300 text-black font-extrabold uppercase tracking-wider text-xs rounded-none shadow-lg shadow-amber-500/20 transition disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {isHolding ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
                  <span>{isHolding ? 'ĐANG GIỮ GHẾ...' : 'TIẾP TỤC THANH TOÁN'}</span>
                </button>
              )}

              {bookingStep === 'combos' && (
                <button
                  disabled={!ticketsMatchSeats || isHolding}
                  onClick={handleProceedToPayment}
                  className="w-full py-2 text-xs text-neutral-400 hover:text-white text-center transition disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  Bỏ qua bắp nước & Thanh toán ngay →
                </button>
              )}
            </>
          )}
        </div>
      </div>

      {/* =========================================================================
          INLINE TICKET TYPE SELECTION MODAL ON SEAT CLICK
          ========================================================================= */}
      {ticketModalData && (
        <div
          className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-150"
          onClick={() => setTicketModalData(null)}
        >
          <div
            className="bg-[#101318] border border-[#292e35] rounded-none w-full max-w-md p-5 space-y-4 shadow-2xl animate-in zoom-in-95 duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-start justify-between border-b border-[#24282f] pb-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <Ticket className="w-4 h-4 text-[#f5b800] shrink-0" />
                  <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                    {ticketModalData.isCouple
                      ? `Nguoi thu ${ticketModalData.coupleStep + 1} — Chon loai ve`
                      : 'Chon loai ve'}
                  </h3>
                  <span
                    className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-none border ${
                      ticketModalData.isCouple
                        ? 'border-[#ec4899] bg-[#831843]/60 text-[#f9a8d4]'
                        : ticketModalData.isVip
                          ? 'border-[#f5b800] bg-[#f5b800]/15 text-[#f5b800]'
                          : 'border-[#697078] bg-[#161b20] text-[#e5e7eb]'
                    }`}
                  >
                    {ticketModalData.isCouple ? 'Ghe doi' : ticketModalData.isVip ? 'Ghe VIP' : 'Ghe thuong'}
                  </span>
                </div>

                {/* Seat name + couple step progress pills */}
                <div className="flex items-center gap-2 mt-2 flex-wrap">
                  <span className="text-xs font-mono font-bold text-neutral-200">
                    {ticketModalData.isCouple
                      ? (() => {
                          const s = ticketModalData.seatGroup[ticketModalData.coupleStep];
                          return s ? `Ghe ${s.row}${s.col}` : ticketModalData.seatName;
                        })()
                      : ticketModalData.seatName}
                  </span>
                  {ticketModalData.isCouple && (
                    <div className="flex items-center gap-1">
                      {[0, 1].map(i => {
                        const isDone = i < ticketModalData.coupleStep;
                        const isCurrent = i === ticketModalData.coupleStep;
                        const chosenLabel = isDone
                          ? (TICKET_TYPES.find(t => t.type === ticketModalData.coupleChoices[i])?.label || '')
                          : null;
                        return (
                          <span
                            key={i}
                            className={`text-[10px] font-bold px-2 py-0.5 rounded-none border ${
                              isDone
                                ? 'border-emerald-500/50 bg-emerald-500/10 text-emerald-400'
                                : isCurrent
                                  ? 'border-[#ec4899]/70 bg-[#831843]/40 text-[#f9a8d4]'
                                  : 'border-white/10 bg-white/5 text-neutral-500'
                            }`}
                          >
                            {isDone ? `Nguoi ${i + 1}: ${chosenLabel}` : `Nguoi ${i + 1}`}
                          </span>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
              <button
                type="button"
                onClick={() => setTicketModalData(null)}
                className="text-[#8b9098] hover:text-white transition p-1 ml-2 shrink-0"
                aria-label="Dong"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Options List */}
            <div className="space-y-2.5">
              {TICKET_TYPES.map((tType) => {
                const theme = TICKET_TYPE_THEMES[tType.type] || TICKET_TYPE_THEMES.ADULT;
                const price = getSeatTicketPrice(selectedShowtime, ticketModalData.seatType, tType.type);
                const IconComponent = tType.type === 'STUDENT' ? GraduationCap : tType.type === 'CHILD' ? Baby : User;

                return (
                  <button
                    key={tType.type}
                    type="button"
                    onClick={() => handleConfirmTicketType(tType.type)}
                    className="w-full text-left p-3 rounded-none border border-[#272c33] bg-[#0c0f13] hover:bg-[#151921] transition-all duration-150 group flex items-center justify-between gap-3 cursor-pointer relative"
                    style={{
                      borderLeft: `4px solid ${theme.color}`
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.borderColor = theme.border;
                      e.currentTarget.style.borderLeftColor = theme.color;
                      e.currentTarget.style.boxShadow = `0 0 16px ${theme.color}35`;
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.borderColor = '#272c33';
                      e.currentTarget.style.borderLeftColor = theme.color;
                      e.currentTarget.style.boxShadow = 'none';
                    }}
                  >
                    <div className="flex items-start gap-3">
                      <div
                        className="w-9 h-9 rounded-none flex items-center justify-center shrink-0 transition"
                        style={{
                          backgroundColor: `${theme.color}18`,
                          border: `1.5px solid ${theme.color}55`,
                          color: theme.color
                        }}
                      >
                        <IconComponent className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs font-bold text-white group-hover:text-white transition">
                            {tType.label}
                          </span>
                          <span
                            className="text-[9px] font-mono font-black px-1.5 py-0.2 rounded-none uppercase tracking-wider flex items-center gap-1"
                            style={{
                              backgroundColor: `${theme.color}25`,
                              border: `1px solid ${theme.color}80`,
                              color: theme.color
                            }}
                          >
                            <span>{theme.dot}</span>
                            <span>{theme.shortLabel}</span>
                          </span>
                          {tType.type === 'STUDENT' && (
                            <span className="text-[9px] font-mono px-1 py-0.2 bg-sky-500/10 border border-sky-500/30 text-sky-400">
                              Ưu đãi HSSV
                            </span>
                          )}
                          {tType.type === 'CHILD' && (
                            <span className="text-[9px] font-mono px-1 py-0.2 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400">
                              Dưới 12 tuổi
                            </span>
                          )}
                          {tType.type === 'ADULT' && (
                            <span className="text-[9px] font-mono px-1 py-0.2 bg-amber-500/10 border border-amber-500/30 text-amber-400">
                              Tiêu chuẩn
                            </span>
                          )}
                        </div>
                        <p className="text-[10px] text-neutral-400 mt-0.5 line-clamp-1">
                          {tType.helper}
                        </p>
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <span className="font-mono font-black text-sm" style={{ color: theme.color }}>
                        {formatVnd(ticketModalData.isCouple ? Math.round(price / 2) : price)}
                      </span>
                      {ticketModalData.isCouple && (
                        <div className="text-[9px] text-neutral-500 font-mono mt-0.5">/ nguoi</div>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Modal Footer with Color Guide */}
            <div className="flex items-center justify-between pt-3 border-t border-[#24282f] text-[10px] text-neutral-400">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-neutral-500 font-semibold">Màu:</span>
                <span className="inline-flex items-center gap-1 text-amber-400">
                  <span className="w-2 h-2 rounded-none bg-[#f5b800]" /> NL
                </span>
                <span className="inline-flex items-center gap-1 text-sky-400">
                  <span className="w-2 h-2 rounded-none bg-[#0284c7]" /> SV
                </span>
                <span className="inline-flex items-center gap-1 text-emerald-400">
                  <span className="w-2 h-2 rounded-none bg-[#059669]" /> TE
                </span>
              </div>
              <button
                type="button"
                onClick={() => setTicketModalData(null)}
                className="px-3.5 py-1.5 rounded-none border border-[#2a2f36] bg-[#11151a] hover:bg-[#161a20] text-neutral-300 hover:text-white text-xs font-semibold transition"
              >
                Hủy bỏ
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
