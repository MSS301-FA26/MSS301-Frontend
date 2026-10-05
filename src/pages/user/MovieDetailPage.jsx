import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate, useParams, useSearchParams, useLocation } from 'react-router-dom';
import {
  ArrowLeft, Play, Star, Clock, Heart, Loader2, ChevronLeft, ChevronRight,
  Calendar, Globe, Film, Shield, MessageSquare, Sparkles, CheckCircle2,
  AlertCircle, Share2, Eye, User, Users, Layers, Tag, ExternalLink, Ticket,
  Award, Volume2, Languages, Check, Info, ArrowUpRight, MapPin, Compass,
  Filter, ChevronDown, ThumbsUp, Send, X, Clapperboard, Edit3, ShieldAlert, AlertTriangle, RotateCcw
} from 'lucide-react';
import { useMovies } from '../../stores/useMovieStore';
import { useUiStore } from '../../stores/useUiStore';
import { useAuthStore } from '../../stores/useAuthStore';
import { getStoredAuth, hasBackendAdminAccess, hasBackendManagerAccess, hasBackendStaffAccess } from '../../services/authService';
import { adminService } from '../../services/adminService';
import { movieService, normalizeMovie } from '../../services/movieService';
import { bookingService } from '../../services/bookingService';
import { reviewService } from '../../services/reviewService';
import { recommendationService } from '../../services/recommendationService';
import { chatService } from '../../services/chatService';
import MovieCard from '../../components/common/MovieCard';
import { toLocalDateKey, getShowtimeDates } from '../../utils/showtimeDates';

const popcornBot = new URL('../../assets/banners/—Pngtree—barrel popcorn pattern_4538379.png', import.meta.url).href;

const extractYoutubeId = (url = '') => {
  const trimmed = url.trim();
  if (/^[a-zA-Z0-9_-]{11}$/.test(trimmed)) return trimmed;

  try {
    const parsed = new URL(trimmed);
    const host = parsed.hostname.replace(/^www\./, '');
    const parts = parsed.pathname.split('/').filter(Boolean);

    if (host === 'youtu.be') return parts[0] || '';
    if (host.endsWith('youtube.com')) {
      const videoId = parsed.searchParams.get('v');
      if (videoId) return videoId;
      if (['embed', 'shorts', 'live'].includes(parts[0])) return parts[1] || '';
    }
  } catch {
    // Fall back to regex parsing
  }

  const patterns = [
    /youtube\.com\/watch\?v=([a-zA-Z0-9_-]{11})/,
    /youtu\.be\/([a-zA-Z0-9_-]{11})/,
    /youtube\.com\/embed\/([a-zA-Z0-9_-]{11})/,
    /youtube\.com\/shorts\/([a-zA-Z0-9_-]{11})/,
    /youtube\.com\/live\/([a-zA-Z0-9_-]{11})/,
    /[?&]v=([a-zA-Z0-9_-]{11})/
  ];

  return patterns.map((pattern) => trimmed.match(pattern)?.[1]).find(Boolean) || '';
};

const isDirectVideoUrl = (url = '') => {
  const value = url.trim().toLowerCase();
  return /\.(mp4|webm|mov)(\?|#|$)/.test(value) || value.includes('/video/upload/');
};

const splitDirectorNames = (value) => String(value || '')
  .split(/[,\n;/]+/)
  .map((item) => item.trim())
  .filter(Boolean);

const getTrailerEmbedSrc = (url = '') => {
  const youtubeId = extractYoutubeId(url);
  if (youtubeId) {
    return `https://www.youtube.com/embed/${youtubeId}?autoplay=1&mute=1&controls=1&rel=0&modestbranding=1&playsinline=1`;
  }
  return url;
};

const formatDateVi = (dateStr) => {
  if (!dateStr || dateStr === 'Dang cap nhat') return '';
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });
  } catch {
    return dateStr;
  }
};


const AGE_RATING_DETAILS = {
  P: {
    label: 'P',
    title: 'Phim Phổ Biến (P)',
    badgeClass: 'bg-emerald-600 text-white'
  },
  K: {
    label: 'K',
    title: 'Khán giả dưới 13 tuổi (K)',
    badgeClass: 'bg-rose-600 text-white'
  },
  T13: {
    label: 'T13',
    title: 'Cấm khán giả dưới 13 tuổi (13+)',
    badgeClass: 'bg-[#FF7A00] text-white'
  },
  '13+': {
    label: '13+',
    title: 'Cấm khán giả dưới 13 tuổi (13+)',
    badgeClass: 'bg-[#FF7A00] text-white'
  },
  C13: {
    label: '13+',
    title: 'Cấm khán giả dưới 13 tuổi (13+)',
    badgeClass: 'bg-[#FF7A00] text-white'
  },
  T16: {
    label: 'T16',
    title: 'Cấm khán giả dưới 16 tuổi (16+)',
    badgeClass: 'bg-orange-600 text-white'
  },
  '16+': {
    label: '16+',
    title: 'Cấm khán giả dưới 16 tuổi (16+)',
    badgeClass: 'bg-orange-600 text-white'
  },
  C16: {
    label: '16+',
    title: 'Cấm khán giả dưới 16 tuổi (16+)',
    badgeClass: 'bg-orange-600 text-white'
  },
  T18: {
    label: 'T18',
    title: 'Cấm khán giả dưới 18 tuổi (18+)',
    badgeClass: 'bg-red-700 text-white'
  },
  '18+': {
    label: '18+',
    title: 'Cấm khán giả dưới 18 tuổi (18+)',
    badgeClass: 'bg-red-700 text-white'
  },
  C18: {
    label: '18+',
    title: 'Cấm khán giả dưới 18 tuổi (18+)',
    badgeClass: 'bg-red-700 text-white'
  },
  C: {
    label: 'C',
    title: 'Cấm phổ biến (C)',
    badgeClass: 'bg-red-950 text-red-500'
  }
};

export default function MovieDetailPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { id } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();

  const {
    moviesList,
    setMoviesList,
    watchlist = [],
    handleToggleWatchlist,
    publicCinema
  } = useMovies();
  const showToast = useUiStore((state) => state.showToast);
  const currentRole = useAuthStore((state) => state.currentRole);
  const currentUser = useAuthStore((state) => state.currentUser);

  // Movie state
  const [localMovie, setLocalMovie] = useState(null);
  const [isLoadingDetail, setIsLoadingDetail] = useState(true);
  const [detailError, setDetailError] = useState(null);
  const [copiedLink, setCopiedLink] = useState(false);
  const [isSynopsisExpanded, setIsSynopsisExpanded] = useState(false);

  // Derived movie
  const movieFromList = useMemo(() => {
    return moviesList.find(m => String(m.id) === String(id) || String(m.backendId) === String(id) || String(m.movieId) === String(id));
  }, [moviesList, id]);

  const movie = (localMovie && (String(localMovie.id) === String(id) || String(localMovie.backendId) === String(id) || String(localMovie.movieId) === String(id)))
    ? localMovie
    : movieFromList;

  const detailMovieId = movie?.backendId || movie?.movieId || movie?.id || id;

  // Trailer Modal State
  const [showTrailer, setShowTrailerState] = useState(searchParams.get('trailer') === '1');
  const setShowTrailer = (value) => {
    setShowTrailerState(value);
    if (!value && searchParams.get('trailer')) {
      const next = new URLSearchParams(searchParams);
      next.delete('trailer');
      setSearchParams(next, { replace: true });
    }
  };

  // Reviews State & Real Backend Eligibility
  const [reviews, setReviews] = useState([]);
  const [isLoadingReviews, setIsLoadingReviews] = useState(false);
  const [likedReviews, setLikedReviews] = useState({});
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [reviewRating, setReviewRating] = useState(10);
  const [reviewComment, setReviewComment] = useState('');
  const [reviewContainsSpoiler, setReviewContainsSpoiler] = useState(false);
  const [isSubmittingReview, setIsSubmittingReview] = useState(false);
  const [reviewEligibility, setReviewEligibility] = useState({
    eligible: false,
    hasReviewed: false,
    reason: null,
    message: null,
    bookingId: null,
    bookingCode: null,
    existingReviewId: null,
    existingRating: null,
    existingContent: null
  });
  const [reviewSummary, setReviewSummary] = useState(null);
  const [revealedSpoilers, setRevealedSpoilers] = useState({});
  const [reportingReview, setReportingReview] = useState(null);
  const [reportReason, setReportReason] = useState('SPAM');
  const [reportDescription, setReportDescription] = useState('');
  const [isSubmittingReport, setIsSubmittingReport] = useState(false);

  // Review score distribution from real review summary or loaded reviews
  const reviewDistribution = useMemo(() => {
    const counts = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    const percentages = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };

    // 1. Phân bổ từ backend reviewSummary (chính xác cho toàn bộ đánh giá trong database)
    const totalCount = Number(reviewSummary?.totalReviews ?? reviews.length ?? 0);
    if (totalCount === 0) {
      return { counts, percentages };
    }

    if (reviewSummary?.distribution) {
      const dist = reviewSummary.distribution;
      [1, 2, 3, 4, 5].forEach(star => {
        const item = dist[String(star)]
          || (star === 5 ? dist['9_10'] : star === 4 ? dist['7_8'] : star === 3 ? dist['5_6'] : star === 2 ? (dist['3_4'] || dist['1_4']) : (dist['1_2'] || dist['1_4']));
        if (item) {
          counts[star] = Number(item.count || 0);
          percentages[star] = Math.round(Number(item.percentage || 0));
        }
      });
      return { counts, percentages };
    }

    // 2. Tính toán từ danh sách reviews thực tế nếu chưa có summary distribution
    if (reviews && reviews.length > 0) {
      reviews.forEach(r => {
        const raw = Number(r.rating || r.score || 0);
        if (raw > 0) {
          const star = Math.max(1, Math.min(5, raw > 5 ? Math.round(raw / 2) : Math.round(raw)));
          counts[star] = (counts[star] || 0) + 1;
        }
      });
      const total = reviews.length;
      if (total > 0) {
        [1, 2, 3, 4, 5].forEach(star => {
          percentages[star] = Math.round(((counts[star] || 0) / total) * 100);
        });
      }
    }

    return { counts, percentages };
  }, [reviews, reviewSummary]);

  // Similar Movies State
  const [similarMovies, setSimilarMovies] = useState([]);
  const similarMoviesRef = useRef(null);
  const scrollSimilar = (dir) => {
    const el = similarMoviesRef.current;
    if (el) el.scrollBy({ left: dir * (el.clientWidth * 0.75), behavior: 'smooth' });
  };

  // Date strip scroll ref
  const dateStripRef = useRef(null);
  const scrollDates = (dir) => {
    if (dateStripRef.current) {
      dateStripRef.current.scrollBy({ left: dir * 240, behavior: 'smooth' });
    }
  };

  // ─────────────────────────────────────────────────────────────
  // SHOWTIMES & BOOKING STATE (Conversion Center)
  // ─────────────────────────────────────────────────────────────
  const [allShowtimes, setAllShowtimes] = useState([]);
  const [isLoadingShowtimes, setIsLoadingShowtimes] = useState(true);
  const [showtimesError, setShowtimesError] = useState(null);
  const [showtimesRetry, setShowtimesRetry] = useState(0);
  const [cinemas, setCinemas] = useState([]);
  const [selectedDate, setSelectedDate] = useState(() => toLocalDateKey(new Date()));
  const [selectedCity, setSelectedCity] = useState('ALL');
  const [selectedCinemaId, setSelectedCinemaId] = useState('ALL');

  // Sync cinema from publicCinema store (Header context) if available
  useEffect(() => {
    if (publicCinema?.id && selectedCinemaId === 'ALL') {
      setSelectedCinemaId(String(publicCinema.id));
      if (publicCinema.city) {
        setSelectedCity(publicCinema.city.trim());
      }
    }
  }, [publicCinema]);

  // Load Cinemas list
  useEffect(() => {
    let cancelled = false;
    movieService.getPublicCinemas()
      .then((res) => {
        if (cancelled) return;
        const raw = Array.isArray(res) ? res : (res?.data || []);
        const active = raw.filter(c => !c.status || c.status === 'ACTIVE');
        setCinemas(active);
      })
      .catch((err) => {
        console.warn('Lỗi tải danh sách rạp:', err);
      });
    return () => { cancelled = true; };
  }, []);

  // Load Showtimes for this movie
  useEffect(() => {
    const targetMovieId = Number(detailMovieId);
    if (!targetMovieId || isNaN(targetMovieId)) return;
    let cancelled = false;
    setIsLoadingShowtimes(true);

    setAllShowtimes([]);
    setShowtimesError(null);
    const loadData = async () => {
      let list = [];
      try {
        // The public list includes cinemaId; customer-schedule only includes roomId.
        let page = 0;
        let hasMore = true;
        while (hasMore) {
          const response = await bookingService.getShowtimes({ movieId: targetMovieId, page, size: 100 });
          if (cancelled) return;
          const payload = response?.data ?? response;
          const raw = Array.isArray(payload) ? payload : (payload?.items ?? payload?.content ?? []);
          if (!Array.isArray(raw)) throw new Error('Invalid showtime response');
          list.push(...raw.map(st => ({ ...st, id: st.id || st.showtimeId, showtimeId: st.showtimeId || st.id, format: st.format || '2D' })));
          hasMore = !Array.isArray(payload) && (payload?.totalPages != null ? page + 1 < payload.totalPages : raw.length === 100);
          page += 1;
        }
      } catch (error) {
        if (cancelled) return;
        console.warn('Showtimes fetch failed:', error);
        setShowtimesError(true);
        setIsLoadingShowtimes(false);
        return;
      }

      if (cancelled) return;

      const now = new Date();
      const valid = list.filter(st => {
        if (!st.startTime) return false;
        if (st.status && !['OPEN', 'SCHEDULED'].includes(st.status)) return false;
        return new Date(st.startTime) > now;
      });

      valid.sort((a, b) => new Date(a.startTime) - new Date(b.startTime));
      setAllShowtimes(valid);
      setIsLoadingShowtimes(false);

    };

    loadData();
    return () => { cancelled = true; };
  }, [detailMovieId, showtimesRetry]);

  // Cities list from cinemas
  const cities = useMemo(() => {
    const set = new Set();
    cinemas.forEach(c => {
      if (c.city && c.city.trim()) set.add(c.city.trim());
    });
    return Array.from(set);
  }, [cinemas]);

  // Calendar follows the same movie/cinema/city filters as the showtime list.
  const upcomingDates = useMemo(() => {
    const matching = allShowtimes.filter(st => {
      const cinemaId = String(st.cinemaId || st.cinema?.id);
      if (selectedCinemaId !== 'ALL' && cinemaId !== String(selectedCinemaId)) return false;
      const cinema = cinemas.find(c => String(c.id) === cinemaId);
      const city = cinema?.city || st.cinemaCity || st.cinema?.city;
      return selectedCity === 'ALL' || city?.trim() === selectedCity;
    });
    const todayKey = toLocalDateKey(new Date());
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowKey = toLocalDateKey(tomorrow);
    const dayNames = ['Chủ Nhật', 'Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy'];
    return getShowtimeDates(matching).map(({ dateKey, count }) => {
      const [year, month, day] = dateKey.split('-').map(Number);
      const date = new Date(year, month - 1, day);
      return { dateKey, count, label: dateKey === todayKey ? 'Hôm Nay' : dateKey === tomorrowKey ? 'Ngày Mai' : dayNames[date.getDay()], dateFormatted: `${String(day).padStart(2, '0')}/${String(month).padStart(2, '0')}` };
    });
  }, [allShowtimes, selectedCinemaId, selectedCity, cinemas]);

  useEffect(() => {
    if (!isLoadingShowtimes && !upcomingDates.some(date => date.dateKey === selectedDate)) {
      setSelectedDate(upcomingDates[0].dateKey);
    }
  }, [upcomingDates, selectedDate, isLoadingShowtimes]);

  useEffect(() => {
    dateStripRef.current?.querySelector('[aria-pressed="true"]')?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }, [selectedDate]);

  // Filtered Showtimes by selected date, cinema, city
  const filteredShowtimes = useMemo(() => {
    return allShowtimes.filter(st => {
      const dKey = st.startTime ? st.startTime.split('T')[0] : '';
      if (dKey !== selectedDate) return false;

      if (selectedCinemaId !== 'ALL') {
        const matchCinema = String(st.cinemaId || st.cinema?.id) === String(selectedCinemaId);
        if (!matchCinema) return false;
      }

      if (selectedCity !== 'ALL') {
        const cinemaObj = cinemas.find(c => String(c.id) === String(st.cinemaId || st.cinema?.id));
        const city = cinemaObj?.city || st.cinemaCity || st.cinema?.city;
        if (city?.trim() !== selectedCity) return false;
      }

      return true;
    });
  }, [allShowtimes, selectedDate, selectedCinemaId, selectedCity, cinemas]);

  // Group filtered showtimes by Cinema and then by Experience/Format
  const groupedShowtimes = useMemo(() => {
    const map = new Map();
    filteredShowtimes.forEach(st => {
      const cId = String(st.cinemaId || st.cinema?.id || 'unknown');
      let cinemaData = cinemas.find(c => String(c.id) === cId);
      if (!cinemaData) {
        cinemaData = {
          id: cId,
          name: st.cinemaName || st.cinema?.name || 'CinePremier Cinema',
          address: st.cinemaAddress || st.cinema?.address || 'Hệ thống rạp CinePremier',
          city: st.cinemaCity || ''
        };
      }

      if (!map.has(cId)) {
        map.set(cId, {
          cinema: cinemaData,
          formats: new Map()
        });
      }

      const cinemaEntry = map.get(cId);
      const fmtKey = String(st.format || '2D').toUpperCase();
      const roomStr = String(st.roomName || st.room?.name || st.roomType || '').toUpperCase();
      const prefix = roomStr.includes('VIP') ? 'VIP - ' : (roomStr.includes('IMAX') ? 'IMAX - ' : '');
      const experienceLabel = prefix + (fmtKey.includes('IMAX')
        ? 'IMAX LASER 2D Phụ Đề'
        : fmtKey.includes('3D')
          ? '3D Digital Phụ Đề'
          : '2D Phụ Đề');

      if (!cinemaEntry.formats.has(experienceLabel)) {
        cinemaEntry.formats.set(experienceLabel, []);
      }
      cinemaEntry.formats.get(experienceLabel).push(st);
    });

    return Array.from(map.values()).map(entry => ({
      cinema: entry.cinema,
      formatGroups: Array.from(entry.formats.entries()).map(([label, slots]) => ({
        label,
        slots: slots.sort((a, b) => new Date(a.startTime) - new Date(b.startTime))
      }))
    }));
  }, [filteredShowtimes, cinemas]);

  // 1-Click Navigate directly to Seat Selection
  const handleSelectShowtime = (st, cinemaObj) => {
    const cId = st.cinemaId || cinemaObj?.id;
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
<<<<<<< HEAD
    navigate(`/movies/${detailMovieId}/book?showtimeId=${st.id}&cinemaId=${cId}&date=${selectedDate}`);
=======
    navigate(`/showtimes?movieId=${mv.backendId || mv.id}`);
>>>>>>> 994357b939ca99abf48e6008d0d9cb6c51892055
  };

  // Scroll to Showtime Section
  const handleScrollToShowtimes = () => {
    const el = document.getElementById('showtimes-section') || document.getElementById('showtimes');
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  // Auto scroll to showtimes if requested via navigation state, hash, or query param
  useEffect(() => {
    const shouldScroll = Boolean(
      location.state?.scrollToShowtimes ||
      location.hash === '#showtimes' ||
      location.hash === '#showtimes-section' ||
      searchParams.get('tab') === 'showtimes' ||
      searchParams.get('booking') === '1' ||
      searchParams.get('scrollTo') === 'showtimes'
    );

    if (!shouldScroll) return;

    let attempts = 0;
    const maxAttempts = 30; // 30 * 80ms = 2.4s max wait for DOM & showtimes
    const checkAndScroll = () => {
      const el = document.getElementById('showtimes-section') || document.getElementById('showtimes');
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      } else if (attempts < maxAttempts) {
        attempts++;
        setTimeout(checkAndScroll, 80);
      }
    };

    const initialTimer = setTimeout(checkAndScroll, 100);
    return () => clearTimeout(initialTimer);
  }, [id, location.state, location.hash, searchParams, isLoadingDetail]);

  // ─────────────────────────────────────────────────────────────
  // MOVIE DETAIL FETCHING & AUTH CHECKS
  // ─────────────────────────────────────────────────────────────
  const isBookable = movie?.status === 'NOW_SHOWING' || (!movie?.status && !movie?.isUpcoming);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    setLocalMovie(null);
    setIsLoadingDetail(true);
    setDetailError(null);
    setIsSynopsisExpanded(false);
    setReviews([]);
    setReviewSummary(null);
    setSimilarMovies([]);
    setAllShowtimes([]);

    if (!location.state?.scrollToShowtimes && !location.hash) {
      window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
    }

    const fetchDetail = async () => {
      if (String(id).startsWith('draft_')) {
        try {
          const raw = localStorage.getItem('cinema_admin_movie_drafts');
          if (raw) {
            const drafts = JSON.parse(raw);
            const foundDraft = drafts.find(d => String(d.id) === String(id));
            if (foundDraft && foundDraft.formData) {
              const normalized = normalizeMovie({
                id: foundDraft.id,
                ...foundDraft.formData,
                status: 'DRAFT',
                approvalStatus: 'DRAFT',
                publicationStatus: 'UNPUBLISHED',
                genres: foundDraft.formData.genreIds || [],
                isUpcoming: true
              });
              if (!cancelled) {
                setLocalMovie(normalized);
                setIsLoadingDetail(false);
                return;
              }
            }
          }
        } catch (e) {
          console.warn('Error reading local draft:', e);
        }
      }

      try {
        const { accessToken, user } = getStoredAuth();
        const targetId = movieFromList?.backendId || id;
        let detail = null;

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

        if (isPrivileged) {
          try {
            detail = await adminService.getAdminMovieDetail(accessToken, targetId);
          } catch {
            try {
              detail = await movieService.getMovieDetail(targetId);
            } catch (pubErr) {
              console.warn('Admin & public detail fetch failed:', pubErr);
            }
          }
        } else {
          try {
            detail = await movieService.getMovieDetail(targetId);
          } catch {
            if (accessToken) {
              try {
                detail = await adminService.getAdminMovieDetail(accessToken, targetId);
              } catch (adminErr) {
                console.warn('Admin fallback failed:', adminErr);
              }
            }
          }
        }

        if (cancelled) return;

        if (detail && (detail.id || detail.title)) {
          setLocalMovie(detail);
          setMoviesList(prev => {
            const exists = prev.some(m => (
              String(m.id) === String(id)
              || String(m.id) === String(detail.id)
              || String(m.backendId) === String(detail.id)
            ));
            if (!exists) return [{ ...detail }, ...prev];
            return prev.map(m => (
              String(m.id) === String(id)
              || String(m.id) === String(detail.id)
              || String(m.backendId) === String(detail.id)
            ) ? { ...m, ...detail } : m);
          });
        } else if (!movie) {
          setDetailError('Không tìm thấy thông tin phim hoặc phim chưa được xuất bản công khai.');
        }
      } catch (err) {
        console.error('Failed to load movie detail:', err);
        if (!cancelled && !movie) {
          setDetailError('Không thể tải chi tiết phim. Vui lòng kiểm tra lại kết nối hoặc quyền truy cập.');
        }
      } finally {
        if (!cancelled) {
          setIsLoadingDetail(false);
        }
      }
    };

    fetchDetail();
    return () => { cancelled = true; };
  }, [id, currentRole]);

  const handleBack = () => {
    if (window.history.length > 1) {
      navigate(-1);
    } else {
      navigate('/');
    }
  };

  const handleShare = () => {
    try {
      navigator.clipboard.writeText(window.location.href);
      setCopiedLink(true);
      showToast('Đã sao chép liên kết phim vào bộ nhớ tạm.');
      setTimeout(() => setCopiedLink(false), 2200);
    } catch {
      showToast('Không thể sao chép liên kết.');
    }
  };

  const isWatchlisted = movie && watchlist.some(item => (
    String(item.backendId || item.movieId || item.id) === String(movie.backendId || movie.movieId || movie.id)
  ));

  const trailerUrl = movie?.trailerUrl?.trim() || '';
  const trailerEmbedSrc = getTrailerEmbedSrc(trailerUrl);
  const hasDirectTrailerVideo = isDirectVideoUrl(trailerUrl);

  // Trailer AI Chat
  const [trailerChatInput, setTrailerChatInput] = useState('');
  const [trailerChatMessages, setTrailerChatMessages] = useState([]);
  const [trailerChatSending, setTrailerChatSending] = useState(false);
  const trailerChatEndRef = useRef(null);

  useEffect(() => {
    trailerChatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [trailerChatMessages]);

  const handleSendTrailerChat = async () => {
    const userMsg = trailerChatInput.trim();
    if (!userMsg || trailerChatSending) return;

    setTrailerChatMessages((prev) => [
      ...prev,
      { role: 'user', text: userMsg },
      { role: 'bot', text: '🤖 Đang phân tích trailer và kịch bản...' }
    ]);
    setTrailerChatInput('');
    setTrailerChatSending(true);

    try {
      const { accessToken } = getStoredAuth();
      const res = await chatService.sendMessage({
        message: userMsg,
        movieId: detailMovieId,
        userId: currentUser?.id,
        token: accessToken,
        scope: 'trailer'
      });
      setTrailerChatMessages((prev) => {
        const next = [...prev];
        next[next.length - 1] = { role: 'bot', text: res?.message || 'Xin lỗi, tôi chưa có câu trả lời phù hợp.' };
        return next;
      });
    } catch {
      setTrailerChatMessages((prev) => {
        const next = [...prev];
        next[next.length - 1] = { role: 'bot', text: '⚠️ Có lỗi xảy ra khi kết nối trợ lý AI, bạn thử lại sau nhé!' };
        return next;
      });
    } finally {
      setTrailerChatSending(false);
    }
  };

  // Load reviews, summary, and eligibility from real backend APIs
  const loadAllReviewData = useCallback(async () => {
    if (!detailMovieId) return;
    setIsLoadingReviews(true);
    const { accessToken } = getStoredAuth();
    try {
      const [revPage, sum] = await Promise.all([
        reviewService.getMovieReviews(detailMovieId, 0, 10).catch(() => ({ items: [] })),
        reviewService.getReviewSummary(detailMovieId).catch(() => null)
      ]);
      const fetchedItems = Array.isArray(revPage) ? revPage : (revPage?.items || []);
      setReviews(fetchedItems);
      if (sum) setReviewSummary(sum);

      if (accessToken) {
        try {
          const elig = await reviewService.checkEligibility(accessToken, detailMovieId);
          if (elig) setReviewEligibility(elig);
        } catch (e) {
          console.warn('Eligibility check failed:', e);
        }
      }
    } catch (err) {
      console.error('Failed to load review data:', err);
    } finally {
      setIsLoadingReviews(false);
    }
  }, [detailMovieId]);

  useEffect(() => {
    loadAllReviewData();
  }, [loadAllReviewData]);

  const handleOpenWriteReview = () => {
    const { accessToken } = getStoredAuth();
    if (!accessToken) {
      showToast('Vui lòng đăng nhập để viết nhận xét về phim.');
      return;
    }
    if (reviewEligibility.hasReviewed) {
      setReviewRating(reviewEligibility.existingRating || 10);
      setReviewComment(reviewEligibility.existingContent || '');
      setReviewContainsSpoiler(false);
      setShowReviewModal(true);
    } else if (reviewEligibility.eligible) {
      setReviewRating(10);
      setReviewComment('');
      setReviewContainsSpoiler(false);
      setShowReviewModal(true);
    } else {
      showToast(reviewEligibility.message || 'Chỉ khán giả đã mua vé và xem xong phim mới có thể đánh giá.');
    }
  };

  const handleLikeReview = (revId) => {
    setLikedReviews(prev => {
      const isAlreadyLiked = !!prev[revId];
      setReviews(current => current.map(r => {
        if (r.id === revId) {
          const currentLikes = Number(r.likes || 0);
          return { ...r, likes: isAlreadyLiked ? Math.max(0, currentLikes - 1) : currentLikes + 1 };
        }
        return r;
      }));
      return { ...prev, [revId]: !isAlreadyLiked };
    });
  };

  const handleSubmitReview = async (e) => {
    e.preventDefault();
    const { accessToken } = getStoredAuth();
    if (!accessToken) {
      showToast('Vui lòng đăng nhập để viết đánh giá cho phim.', 4000, null, 'sad');
      return;
    }
    const trimmed = reviewComment.trim();
    if (trimmed.length < 5) {
      showToast('Nội dung đánh giá phải có ít nhất 5 ký tự.');
      return;
    }

    setIsSubmittingReview(true);
    try {
      if (reviewEligibility.hasReviewed && reviewEligibility.existingReviewId) {
        await reviewService.updateReview(accessToken, reviewEligibility.existingReviewId, {
          rating: Number(reviewRating),
          content: trimmed,
          containsSpoiler: Boolean(reviewContainsSpoiler)
        });
        showToast('Cập nhật đánh giá của bạn thành công!');
      } else {
        await reviewService.createReview(accessToken, detailMovieId, {
          rating: Number(reviewRating),
          content: trimmed,
          containsSpoiler: Boolean(reviewContainsSpoiler)
        });
        showToast('Đánh giá của bạn đã được xuất bản thành công!');
      }
      setShowReviewModal(false);
      setReviewComment('');
      await loadAllReviewData();
    } catch (err) {
      showToast(err?.message || 'Không thể gửi đánh giá. Vui lòng kiểm tra lại điều kiện đặt vé.');
    } finally {
      setIsSubmittingReview(false);
    }
  };

  const handleSubmitReport = async (e) => {
    e.preventDefault();
    if (!reportingReview) return;
    const { accessToken } = getStoredAuth();
    if (!accessToken) {
      showToast('Vui lòng đăng nhập để gửi báo cáo.');
      return;
    }

    setIsSubmittingReport(true);
    try {
      await reviewService.reportReview(accessToken, reportingReview.id, {
        reason: reportReason,
        description: reportDescription.trim() || undefined
      });
      showToast('Cảm ơn bạn đã báo cáo. Chúng tôi sẽ kiểm duyệt nội dung này.');
      setReportingReview(null);
      setReportDescription('');
    } catch (err) {
      showToast(err?.message || 'Không thể gửi báo cáo.');
    } finally {
      setIsSubmittingReport(false);
    }
  };

  // Recommendations
  useEffect(() => {
    if (!detailMovieId) return;
    let cancelled = false;
    recommendationService.getContentRecommendations(detailMovieId)
      .then(async (items) => {
        if (cancelled) return;
        const list = Array.isArray(items) ? items : [];
        const enriched = await Promise.all(list.map(async (rec) => {
          const recId = rec.backendId || rec.movieId || rec.id;
          if (!recId) return rec;

          const matchMovie = moviesList.find((m) => (
            String(m.backendId || m.movieId || m.id) === String(recId)
          ));

          if (matchMovie?.posterUrl) {
            return { ...rec, ...matchMovie, similarity: rec.similarity };
          }

          try {
            const detail = await movieService.getMovieDetail(recId);
            return detail?.id ? { ...rec, ...detail, similarity: rec.similarity } : rec;
          } catch {
            return rec;
          }
        }));

        if (!cancelled) {
          if (enriched.length > 0) {
            setSimilarMovies(enriched);
          } else {
            const fallback = moviesList
              .filter(m => String(m.backendId || m.id) !== String(detailMovieId))
              .slice(0, 8);
            setSimilarMovies(fallback);
          }
        }
      })
      .catch(() => {
        if (!cancelled) {
          const fallback = moviesList
            .filter(m => String(m.backendId || m.id) !== String(detailMovieId))
            .slice(0, 8);
          setSimilarMovies(fallback);
        }
      });
    return () => { cancelled = true; };
  }, [detailMovieId, moviesList]);

  // Trailer ESC key lock
  useEffect(() => {
    if (!showTrailer) return undefined;
    const onKeyDown = (e) => { if (e.key === 'Escape') setShowTrailer(false); };
    const scrollY = window.scrollY;
    const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;
    document.body.style.position = 'fixed';
    document.body.style.top = `-${scrollY}px`;
    document.body.style.width = '100%';
    document.body.style.paddingRight = `${scrollbarWidth}px`;

    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      document.body.style.position = '';
      document.body.style.top = '';
      document.body.style.width = '';
      document.body.style.paddingRight = '';
      window.scrollTo(0, scrollY);
    };
  }, [showTrailer]);

  // Loading Skeleton
  // Rating info (from real review summary / real reviews / API score)
  const displayRating = useMemo(() => {
    if (!movie) return null;

    // 1. Dữ liệu thật từ reviewSummary (toàn bộ database của phim)
    if (reviewSummary && Number(reviewSummary.totalReviews) > 0) {
      return {
        score: Number(reviewSummary.averageRating || 0).toFixed(1),
        votes: Number(reviewSummary.totalReviews)
      };
    }

    // 2. Dữ liệu thật từ danh sách reviews đã load
    if (reviews && reviews.length > 0) {
      const avg = reviews.reduce((acc, r) => {
        const val = Number(r.rating || r.score || 0);
        return acc + val;
      }, 0) / reviews.length;
      return {
        score: avg.toFixed(1),
        votes: reviews.length
      };
    }

    // 3. Nếu phim có thông tin rating chính thức từ catalog
    if (movie.voteAverage && Number(movie.voteCount || movie.totalVotes || 0) > 0) {
      return {
        score: Number(movie.voteAverage).toFixed(1),
        votes: Number(movie.voteCount || movie.totalVotes)
      };
    }

    // 4. Nếu chưa có đánh giá nào -> Trả về dữ liệu thực 0.0 và 0 votes (đồng bộ với mục Đánh Giá Khán Giả)
    return {
      score: '0.0',
      votes: 0
    };
  }, [reviews, reviewSummary, movie?.voteAverage, movie?.rating, movie?.voteCount, movie?.totalVotes]);

  if (isLoadingDetail && !movie) {
    return (
      <div className="min-h-screen bg-[#050507] text-[#B5B5BE] pt-8 pb-20">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8 animate-pulse">
          <div className="h-4 w-48 bg-white/5 rounded" />
          <div className="h-[460px] rounded-2xl bg-white/[0.03] border border-white/[0.05] p-8 flex flex-col md:flex-row gap-8 items-center">
            <div className="w-60 aspect-[2/3] bg-white/5 rounded-xl flex-shrink-0" />
            <div className="flex-1 space-y-4 w-full">
              <div className="h-8 w-2/3 bg-white/10 rounded-lg" />
              <div className="h-4 w-1/3 bg-white/5 rounded" />
              <div className="h-4 w-1/4 bg-white/5 rounded" />
              <div className="h-24 w-full bg-white/5 rounded-lg" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Error State
  if (!movie) {
    return (
      <div className="min-h-[75vh] bg-[#050507] flex flex-col items-center justify-center space-y-6 px-4 text-center">
        <div className="w-20 h-20 rounded-2xl bg-[#0D0D11] border border-white/10 flex items-center justify-center text-neutral-500 shadow-2xl">
          <Clapperboard className="w-10 h-10 text-[#F7C600]/80" />
        </div>
        <div className="space-y-2 max-w-md">
          <h2 className="text-2xl font-bold text-white uppercase tracking-wider">
            Không tìm thấy thông tin phim
          </h2>
          <p className="text-sm text-[#7F7F89] leading-relaxed">
            {detailError || 'Phim này có thể chưa được mở bán công khai hoặc đường dẫn không còn hiệu lực.'}
          </p>
        </div>
        <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
          <button
            onClick={handleBack}
            className="flex items-center gap-2 px-5 py-2.5 bg-[#F7C600] hover:bg-[#ffd836] text-black text-xs font-bold uppercase tracking-wider transition rounded-lg shadow-lg cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" /> Quay lại
          </button>
          <button
            onClick={() => navigate('/')}
            className="px-5 py-2.5 bg-[#111116] hover:bg-[#15151B] text-white border border-white/10 text-xs font-bold uppercase tracking-wider transition rounded-lg cursor-pointer"
          >
            Về trang chủ
          </button>
        </div>
      </div>
    );
  }

  // Data processing
  const mainActorIdSet = new Set((movie.mainActorIds || []).map((actorId) => Number(actorId)));
  const hasExplicitMain = mainActorIdSet.size > 0;
  const currentCasts = Array.isArray(movie.actors)
    ? movie.actors.map((actor) => ({
      id: Number.isFinite(Number(actor.id ?? actor.actorId)) ? Number(actor.id ?? actor.actorId) : actor.name,
      name: actor.name || actor.fullName || actor.actorName || '',
      role: actor.role || actor.characterName || actor.description || 'Diễn viên',
      avatarUrl: actor.avatarUrl || actor.imageUrl || actor.photoUrl || '',
      isMain: hasExplicitMain ? mainActorIdSet.has(Number(actor.id ?? actor.actorId)) : true
    })).filter(c => Boolean(c.name))
    : [];

  const isInvalidData = (val) => !val || ['dang cap nhat', 'đang cập nhật', 'null', 'undefined'].includes(String(val).trim().toLowerCase());

  const directorNames = splitDirectorNames(movie.director).filter(d => !isInvalidData(d));
  const rawAgeRating = String(movie.ageRating || '').trim();
  const ageInfo = rawAgeRating ? (AGE_RATING_DETAILS[rawAgeRating] || AGE_RATING_DETAILS[rawAgeRating.toUpperCase()] || {
    label: rawAgeRating,
    title: `Phân loại ${rawAgeRating}`,
    badgeClass: 'bg-[#FF7A00] text-white'
  }) : null;

  const isPrivilegedUser = currentRole === 'admin' || currentRole === 'manager' || currentRole === 'staff';
  const approval = String(movie.approvalStatus || 'APPROVED').toUpperCase();
  const publication = String(movie.publicationStatus || 'PUBLISHED').toUpperCase();
  const isNonPublic = approval !== 'APPROVED' || publication !== 'PUBLISHED';
  const fullSynopsis = (movie.synopsis || movie.description || movie.overview || movie.raw?.synopsis || movie.raw?.description || '').trim();
  const isLongSynopsis = fullSynopsis.length > 220;

  // Formats and genres list (from real admin registration data)
  const genresList = (Array.isArray(movie.genre) ? movie.genre : (movie.genre ? [movie.genre] : []))
    .filter(g => !isInvalidData(g));

  const actorNamesList = (currentCasts.length > 0
    ? currentCasts.map(c => c.name)
    : (movie.mainActors ? String(movie.mainActors).split(/[,;]+/).map(s => s.trim()) : [])
  ).filter(a => !isInvalidData(a));


  return (
    <div className="min-h-screen bg-[#050507] text-[#FFFFFF] selection:bg-[#F7C600] selection:text-black">
      {/* Background Subtle Gradient Lighting */}
      <div className="pointer-events-none fixed inset-0 -z-50 overflow-hidden">
        <div className="absolute left-1/3 top-0 h-[600px] w-[600px] -translate-x-1/2 rounded-full bg-[#F7C600]/[0.025] blur-[180px]" />
        <div className="absolute right-0 top-1/3 h-[500px] w-[500px] rounded-full bg-[#8B5CF6]/[0.02] blur-[160px]" />
      </div>

      {/* ADMIN PREVIEW NOTIFICATION BANNER */}
      {isNonPublic && (
        <aside
          aria-label="Chế độ xem trước nội bộ"
          className="bg-amber-950/70 border-b border-amber-500/30 px-4 py-2.5 sticky top-0 z-40 backdrop-blur-md"
        >
          <div className="max-w-6xl mx-auto flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2">
              <span className="p-1 rounded bg-amber-500/20 text-amber-400 border border-amber-500/30">
                <Shield className="w-3.5 h-3.5" />
              </span>
              <span className="font-bold text-amber-300 uppercase tracking-wider">
                Xem trước nội bộ (Preview)
              </span>
              <span className="text-[#7F7F89] hidden sm:inline">•</span>
              <span className="text-[#B5B5BE] hidden sm:inline">
                Phim chưa xuất bản công khai trên website.
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded bg-black/60 border border-white/10 text-[10px] font-mono text-neutral-300">
                Duyệt: <strong className="text-amber-400">{approval}</strong>
              </span>
              <span className="px-2 py-0.5 rounded bg-black/60 border border-white/10 text-[10px] font-mono text-neutral-300">
                Xuất bản: <strong className={publication === 'PUBLISHED' ? 'text-emerald-400' : 'text-neutral-400'}>{publication}</strong>
              </span>
              {isPrivilegedUser && (
                <button
                  onClick={() => navigate('/admin')}
                  className="px-2.5 py-1 bg-amber-500 hover:bg-amber-400 text-black font-bold text-[10px] uppercase rounded transition flex items-center gap-1 cursor-pointer"
                >
                  <Eye className="w-3 h-3" /> Quản lý Admin
                </button>
              )}
            </div>
          </div>
        </aside>
      )}

      {/* BREADCRUMB & CONTROLS BAR */}
      <nav aria-label="Điều hướng trang chi tiết" className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pt-5 pb-3">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-2 text-xs text-[#7F7F89]">
            <button
              onClick={handleBack}
              className="flex items-center gap-1.5 text-[#B5B5BE] hover:text-[#F7C600] transition cursor-pointer font-medium"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Quay lại</span>
            </button>
            <span>/</span>
            <button onClick={() => navigate('/movies')} className="hover:text-white transition cursor-pointer">
              Phim
            </button>
            <span>/</span>
            <span className="text-[#FFFFFF] font-medium truncate max-w-[200px] sm:max-w-md">
              {movie.title}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleShare}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-[#0D0D11] hover:bg-[#15151B] border border-white/[0.08] hover:border-white/20 text-xs text-[#B5B5BE] hover:text-white rounded-lg transition cursor-pointer"
              title="Sao chép liên kết chia sẻ phim"
            >
              {copiedLink ? (
                <>
                  <Check className="h-3.5 w-3.5 text-emerald-400" />
                  <span className="text-emerald-400 font-bold">Đã sao chép</span>
                </>
              ) : (
                <>
                  <Share2 className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">Chia sẻ</span>
                </>
              )}
            </button>

            <button
              type="button"
              onClick={() => handleToggleWatchlist(movie)}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold uppercase tracking-wider rounded-lg transition border cursor-pointer ${isWatchlisted
                ? 'border-rose-500/70 bg-rose-500/20 text-rose-300'
                : 'border-white/[0.08] bg-[#0D0D11] hover:bg-[#15151B] text-[#B5B5BE] hover:text-white hover:border-white/20'
              }`}
              title={isWatchlisted ? 'Bỏ lưu khỏi danh sách xem' : 'Lưu vào danh sách muốn xem'}
            >
              <Heart className={`h-3.5 w-3.5 ${isWatchlisted ? 'fill-current text-rose-500' : ''}`} />
              <span className="hidden sm:inline">{isWatchlisted ? 'Đã lưu' : 'Lưu phim'}</span>
            </button>
          </div>
        </div>
      </nav>

      {/* ─────────────────────────────────────────────────────────────
          SECTION 1: MOVIE HEADER / POSTER & DETAILS (Reference Layout)
         ───────────────────────────────────────────────────────────── */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pt-4 pb-8">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-8 lg:gap-10 items-stretch">
          {/* Left Column: Poster Card */}
          <div className="md:col-span-4 lg:col-span-4 flex justify-center md:justify-start">
            <div className="relative w-64 sm:w-72 aspect-[2/3] rounded-2xl overflow-hidden border border-white/15 bg-[#0D0D11] shadow-[0_20px_50px_rgba(0,0,0,0.85)] group flex-shrink-0 transition-transform duration-300 hover:scale-[1.01]">
              <img
                src={movie.posterUrl || 'https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?auto=format&fit=crop&w=780&q=80'}
                alt={movie.title}
                className="w-full h-full object-cover"
                referrerPolicy="no-referrer"
                onError={(e) => { e.currentTarget.src = 'https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?auto=format&fit=crop&w=780&q=80'; }}
              />

<<<<<<< HEAD
              {/* Hover Play Trailer Overlay */}
              {trailerUrl && (
                <button
                  onClick={() => setShowTrailer(true)}
                  className="absolute inset-0 bg-black/55 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex flex-col items-center justify-center gap-2 cursor-pointer text-white"
                  title="Bấm để xem trailer"
=======
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-8 items-start">
            {/* Left Column: Poster & Rating */}
            <div className="md:col-span-4 lg:col-span-4 flex flex-col items-center md:items-start space-y-4">
              <div className="relative w-64 sm:w-72 aspect-[2/3] overflow-hidden rounded-xl border border-white/15 shadow-2xl shadow-black/80 bg-neutral-950 group">
                <img
                  src={movie.posterUrl || 'https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?auto=format&fit=crop&w=780&q=80'}
                  alt={movie.title}
                  className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                  referrerPolicy="no-referrer"
                  onError={(e) => { e.currentTarget.src = 'https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?auto=format&fit=crop&w=780&q=80'; }}
                />

                {/* Age Rating Badge */}
                <div
                  className={`absolute top-3 left-3 px-2 py-0.5 text-[11px] font-black tracking-wider border rounded-md uppercase backdrop-blur-md ${ageInfo.badgeClass}`}
                  title={ageInfo.desc}
>>>>>>> 994357b939ca99abf48e6008d0d9cb6c51892055
                >
                  <div className="w-14 h-14 rounded-full bg-[#F7C600] text-black flex items-center justify-center shadow-2xl transform scale-90 group-hover:scale-100 transition-transform">
                    <Play className="w-6 h-6 fill-black translate-x-0.5" />
                  </div>
                  <span className="text-xs font-bold uppercase tracking-widest text-[#F7C600]">Xem Trailer</span>
                </button>
              )}
            </div>
          </div>

          {/* Right Column: Title + Badge, Quick Specs, Pills Info (stretches to bottom) */}
          <div className="md:col-span-8 lg:col-span-8 flex flex-col justify-between h-full">
            <div className="space-y-4">
            {/* 1. Title + Age Rating Badge (like reference: "Quyết Cua Anh Này [T13]") */}
            <div>
              <div className="flex flex-wrap items-center gap-2.5">
                <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-white tracking-tight">
                  {movie.title}
                </h1>
                {ageInfo && (
                  <span className={`px-2.5 py-0.5 text-xs font-black rounded uppercase tracking-wider ${ageInfo.badgeClass}`}>
                    {ageInfo.label}
                  </span>
                )}
              </div>
              {movie.englishTitle && movie.englishTitle !== movie.title && (
                <p className="text-sm font-sans font-medium text-[#7F7F89] tracking-wider uppercase mt-1">
                  {movie.englishTitle}
                </p>
              )}
            </div>

            {/* 2. Sub-info row (Duration & Release date) */}
            <div className="flex items-center gap-4 text-xs sm:text-sm text-[#B5B5BE] pt-0.5">
              {movie.duration && (
                <div className="flex items-center gap-1.5 font-medium">
                  <Clock className="w-4 h-4 text-[#F7C600]" />
                  <span>{movie.duration} Phút</span>
                </div>
              )}
              {formatDateVi(movie.releaseDate) && !isInvalidData(movie.releaseDate) && (
                <div className="flex items-center gap-1.5 font-medium">
                  <Calendar className="w-4 h-4 text-[#F7C600]" />
                  <span>{formatDateVi(movie.releaseDate)}</span>
                </div>
              )}
            </div>

            {/* 3. Rating row (Star + Score + Votes) */}
            {displayRating && (
              <div className="flex items-center gap-1.5 text-xs sm:text-sm pt-0.5">
                <Star className="w-4 h-4 text-[#F7C600] fill-[#F7C600]" />
                <span className="text-base font-bold text-white font-mono">{displayRating.score}</span>
                <span className="text-[#7F7F89]">({displayRating.votes} votes)</span>
              </div>
            )}

            {/* 4. Tabular Metadata Specs with Pill Tags (matching Galaxy reference!) */}
            <div className="space-y-3 pt-2 text-xs sm:text-sm">

              {/* Thể loại (Pill Tags) */}
              {genresList.length > 0 && (
                <div className="flex items-start gap-4">
                  <span className="text-[#7F7F89] w-28 flex-shrink-0 pt-1">Thể loại:</span>
                  <div className="flex flex-wrap gap-2">
                    {genresList.map((g, idx) => (
                      <span
                        key={idx}
                        className="px-3.5 py-1 rounded-lg border border-white/15 bg-white/[0.04] text-xs font-medium text-white hover:border-[#F7C600]/40 transition"
                      >
                        {g}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Đạo diễn (Pill Tags) */}
              {directorNames.length > 0 && (
                <div className="flex items-start gap-4">
                  <span className="text-[#7F7F89] w-28 flex-shrink-0 pt-1">Đạo diễn:</span>
                  <div className="flex flex-wrap gap-2">
                    {directorNames.map((d, idx) => (
                      <span
                        key={idx}
                        className="px-3.5 py-1 rounded-lg border border-white/15 bg-white/[0.04] text-xs font-medium text-white hover:border-[#F7C600]/40 transition"
                      >
                        {d}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Diễn viên (Pill Tags) */}
              {actorNamesList.length > 0 && (
                <div className="flex items-start gap-4">
                  <span className="text-[#7F7F89] w-28 flex-shrink-0 pt-1">Diễn viên:</span>
                  <div className="flex flex-wrap gap-2">
                    {actorNamesList.slice(0, 8).map((a, idx) => (
                      <span
                        key={idx}
                        className="px-3.5 py-1 rounded-lg border border-white/15 bg-white/[0.04] text-xs font-medium text-white hover:border-[#F7C600]/40 transition"
                      >
                        {a}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
            </div>

            {/* 5. CTA Buttons (anchored to bottom, level with bottom edge of poster) */}
            <div className="flex flex-wrap items-center gap-3 pt-6 mt-auto">
              {isBookable ? (
                <button
                  onClick={handleScrollToShowtimes}
                  className="h-11 px-7 bg-[#F7C600] hover:bg-[#ffd836] text-black font-sans font-bold text-xs uppercase tracking-wider rounded-xl shadow-md transition flex items-center gap-2 cursor-pointer"
                  id="hero-book-now-button"
                >
                  <Ticket className="w-4 h-4 fill-current" />
                  <span>ĐẶT VÉ NGAY</span>
                </button>
              ) : (
                <button
                  onClick={() => showToast('Chúng tôi sẽ thông báo cho bạn khi phim chính thức mở bán vé!')}
                  className="h-11 px-6 bg-[#111116] hover:bg-[#15151B] border border-[#F7C600]/40 text-[#F7C600] text-xs font-bold uppercase tracking-wider rounded-xl transition flex items-center gap-2 cursor-pointer"
                >
                  <Clock className="w-4 h-4 text-[#F7C600]" />
                  <span>NHẮC TÔI KHI MỞ BÁN</span>
                </button>
              )}

              {trailerUrl && (
                <button
                  onClick={() => setShowTrailer(true)}
                  className="h-11 px-6 bg-white/5 hover:bg-white/10 border border-white/15 hover:border-[#F7C600] text-white text-xs font-bold uppercase tracking-wider rounded-xl transition flex items-center gap-2 cursor-pointer"
                  id="hero-trailer-button"
                >
                  <Play className="h-4 w-4 fill-current text-[#F7C600]" />
                  <span>XEM TRAILER</span>
                </button>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* ─────────────────────────────────────────────────────────────
          SECTION 2: NỘI DUNG PHIM (With Vertical Gold Bar)
         ───────────────────────────────────────────────────────────── */}
      {fullSynopsis && (
        <section className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="space-y-3">
            {/* Header with vertical primary accent bar */}
            <div className="flex items-center gap-2.5 border-l-4 border-[#F7C600] pl-3 py-0.5">
              <h2 className="text-lg sm:text-xl font-bold text-white tracking-tight">
                Nội Dung Phim
              </h2>
            </div>

            {/* Paragraph body */}
            <div className="space-y-2 text-xs sm:text-sm text-[#D4D4D8] leading-relaxed">
              <p className={`whitespace-pre-line ${isLongSynopsis && !isSynopsisExpanded ? 'line-clamp-4' : ''}`}>
                {fullSynopsis}
              </p>
              {isLongSynopsis && (
                <button
                  type="button"
                  onClick={() => setIsSynopsisExpanded(!isSynopsisExpanded)}
                  className="text-xs font-semibold text-[#F7C600] hover:text-[#ffd836] transition cursor-pointer inline-flex items-center gap-1"
                >
                  <span>{isSynopsisExpanded ? 'Thu gọn' : 'Xem thêm'}</span>
                  <ChevronDown className={`w-3.5 h-3.5 transition-transform ${isSynopsisExpanded ? 'rotate-180' : ''}`} />
                </button>
              )}
            </div>
          </div>
        </section>
      )}

      {/* ─────────────────────────────────────────────────────────────
          SECTION 3: LỊCH CHIẾU
         ───────────────────────────────────────────────────────────── */}
      <section id="showtimes-section" className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-5 scroll-mt-20 sm:scroll-mt-24 text-white">
        <div className="space-y-4">
          {/* Header with vertical primary accent bar */}
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
            <div className="flex items-center gap-2 border-l-4 border-[#F7C600] pl-3">
            <h2 className="text-base sm:text-lg font-extrabold uppercase text-white tracking-tight">
              Lịch Chiếu
            </h2>
            </div>
            {/* Right: Dropdown Filters (Toàn quốc, Tất cả rạp) */}
            <div className="grid grid-cols-1 min-[400px]:grid-cols-2 gap-2 w-full md:w-[380px] md:shrink-0 text-xs">
              <label className="min-w-0">
                <span className="sr-only">Khu vực</span>
              <select
                value={selectedCity}
                onChange={(e) => {
                  setSelectedCity(e.target.value);
                  setSelectedCinemaId('ALL');
                }}
                className="w-full min-w-0 h-[42px] bg-[#09090D] text-white font-semibold border border-white/10 rounded-none px-3 outline-none focus:border-[#F7C600] cursor-pointer"
              >
                <option value="ALL">Toàn quốc</option>
                {cities.map(city => (
                  <option key={city} value={city}>{city}</option>
                ))}
              </select>
              </label>
              <label className="min-w-0">
                <span className="sr-only">Rạp chiếu</span>
              <select
                value={selectedCinemaId}
                onChange={(e) => setSelectedCinemaId(e.target.value)}
                className="w-full min-w-0 h-[42px] bg-[#09090D] text-white font-semibold border border-white/10 rounded-none px-3 outline-none focus:border-[#F7C600] cursor-pointer"
              >
                <option value="ALL">Tất cả rạp</option>
                {cinemas
                  .filter(c => selectedCity === 'ALL' || c.city?.trim() === selectedCity)
                  .map(c => (
                    <option key={c.id} value={String(c.id)}>{c.name}</option>
                  ))
                }
              </select>
              </label>
            </div>
          </div>

          {/* Toolbar: Horizontal Date Tabs with Chevrons on the left + City/Cinema Selectors on the right */}
          <div className="border-y border-white/[0.06] py-4">
            {/* Left: Date Carousel with < and > */}
            <div className="flex min-w-0 flex-1 items-center gap-2">
              <button
                type="button"
                onClick={() => scrollDates(-1)}
                className="w-8 h-14 rounded-none border border-white/10 bg-[#09090D] hover:bg-white/10 text-[#B5B5BE] hover:text-[#F7C600] transition flex items-center justify-center cursor-pointer flex-shrink-0 focus-visible:outline-2 focus-visible:outline-[#F7C600]"
                aria-label="Ngày trước"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>

              <div
                ref={dateStripRef}
                className="flex min-w-0 flex-1 items-center gap-1.5 overflow-x-auto scroll-smooth snap-x snap-mandatory py-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
              >
                {upcomingDates.map((item) => {
                  const isSelected = item.dateKey === selectedDate;

                  return (
                    <button
                      key={item.dateKey}
                      type="button"
                      onClick={() => setSelectedDate(item.dateKey)}
                      aria-pressed={isSelected}
                      className={`snap-start flex-shrink-0 flex flex-col items-center justify-center min-w-[82px] sm:flex-1 h-14 rounded-none border px-2 transition-colors cursor-pointer select-none text-center focus-visible:outline-2 focus-visible:outline-[#F7C600] ${
                        isSelected
                          ? 'bg-[#F7C600] border-[#F7C600] text-black font-semibold'
                          : item.count > 0
                            ? 'bg-[#09090D] border-white/10 hover:border-[#F7C600]/50 text-[#B5B5BE]'
                            : 'bg-[#09090D]/50 border-white/5 text-neutral-500 opacity-70 hover:opacity-100'
                      }`}
                    >
                      <span className={`text-[10px] font-extrabold uppercase leading-tight ${isSelected ? 'text-black' : 'text-[#B5B5BE]'}`}>
                        {item.label}
                      </span>
                      <span className={`text-sm font-extrabold leading-tight mt-0.5 ${isSelected ? 'text-black' : 'text-[#B5B5BE]'}`}>
                        {item.dateFormatted}
                      </span>
                      <span className={`text-[9px] mt-0.5 leading-tight ${isSelected ? 'text-black font-bold' : item.count > 0 ? 'text-[#F7C600] font-bold' : 'text-neutral-600'}`}>
                        {item.count > 0 ? `${item.count} suất` : 'Ch\u01b0a c\u00f3 su\u1ea5t'}
                      </span>
                    </button>
                  );
                })}
              </div>

              <button
                type="button"
                onClick={() => scrollDates(1)}
                className="w-8 h-14 rounded-none border border-white/10 bg-[#09090D] hover:bg-white/10 text-[#B5B5BE] hover:text-[#F7C600] transition flex items-center justify-center cursor-pointer flex-shrink-0 focus-visible:outline-2 focus-visible:outline-[#F7C600]"
                aria-label="Ngày sau"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>


          </div>

          {/* Showtimes Listings Grouped by Cinema */}
          <div className="space-y-4 pt-1">
            {isLoadingShowtimes && (
              <div className="py-6 text-center text-xs text-[#7F7F89] space-y-2">
                <Loader2 className="w-5 h-5 animate-spin text-[#F7C600] mx-auto" />
                <p>Đang tải lịch chiếu từ hệ thống rạp...</p>
              </div>
            )}

            {!isLoadingShowtimes && showtimesError && (
              <div role="alert" className="rounded-none border border-white/10 bg-[#0C0C14] p-4 text-center space-y-2">
                <p className="text-sm text-[#B5B5BE]">Không tải được lịch chiếu. Vui lòng thử lại.</p>
                <button type="button" onClick={() => setShowtimesRetry(value => value + 1)} className="text-xs font-semibold text-[#F7C600] hover:text-[#ffd836] cursor-pointer">Tải lại lịch chiếu</button>
              </div>
            )}

            {!isLoadingShowtimes && !showtimesError && groupedShowtimes.length === 0 && (
              <div role="status" className="bg-[#0C0C14] border border-white/[0.07] rounded-none px-4 py-4 text-center space-y-2">
                <div className="mx-auto flex h-9 w-9 items-center justify-center rounded-full bg-[#F7C600]/10 text-[#F7C600]">
                  <Calendar className="h-5 w-5" />
                </div>
                <p className="text-sm font-semibold text-white">
                  Không có suất chiếu phù hợp trong ngày này
                </p>
                <p className="text-xs text-[#B5B5BE] leading-relaxed">
                  Vui lòng chọn ngày chiếu khác hoặc chuyển sang cụm rạp khác.
                </p>
                {selectedCinemaId !== 'ALL' && (
                  <button
                    type="button"
                    onClick={() => setSelectedCinemaId('ALL')}
                    className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-[#F7C600] hover:bg-[#ffd836] text-black text-xs font-bold uppercase rounded-none transition cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#F7C600]"
                  >
                    Xem tất cả rạp
                  </button>
                )}
              </div>
            )}

            {!isLoadingShowtimes && groupedShowtimes.map(({ cinema, formatGroups }) => (
              <div key={cinema.id} className="space-y-3 p-4 border border-white/10 bg-[#0C0C14]">
                {/* Cinema Name Header */}
                <div>
                  <h3 className="text-base font-bold text-white">
                    {cinema.name}
                  </h3>
                  <p className="text-xs text-[#7F7F89] mt-0.5">
                    {cinema.address || 'Hệ thống rạp CinePremier'}
                  </p>
                </div>

                {/* Format Rows */}
                <div className="space-y-3">
                  {formatGroups.map(group => (
                    <div
                      key={group.label}
                      className="flex flex-col sm:flex-row sm:items-center gap-3 pt-3 border-t border-white/[0.07]"
                    >
                      {/* Left: Experience / Format Label */}
                      <span className="text-xs text-[#B5B5BE] font-medium sm:min-w-[160px]">
                        {group.label}
                      </span>

                      {/* Right: Time Chips (Click to direct book) */}
                      <div className="flex flex-wrap gap-2">
                        {group.slots.map(st => {
                          const dateObj = new Date(st.startTime);
                          const timeStr = dateObj.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });

                          return (
                            <button
                              key={st.id}
                              onClick={() => handleSelectShowtime(st, cinema)}
                              className="h-8 px-3.5 bg-white/[0.04] hover:bg-[#F7C600] text-white hover:text-black border border-white/[0.07] hover:border-[#F7C600] rounded-none text-xs font-bold transition shadow-sm cursor-pointer"
                              title={`Chọn suất ${timeStr} tại ${cinema.name}`}
                            >
                              {timeStr}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>



      {/* ─────────────────────────────────────────────────────────────
          SECTION 5: ĐÁNH GIÁ TỪ KHÁN GIẢ (Reviews)
         ───────────────────────────────────────────────────────────── */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 border-t border-white/[0.06]">
        <div className="space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2.5 border-l-4 border-[#F7C600] pl-3 py-0.5">
              <h2 className="text-lg sm:text-xl font-bold text-white tracking-tight">
                Đánh Giá Từ Khán GiẢ
              </h2>
            </div>

            <button
              onClick={handleOpenWriteReview}
              className="px-4 py-2 bg-[#111116] hover:bg-[#F7C600] text-white hover:text-black border border-white/15 hover:border-[#F7C600] text-xs font-bold uppercase rounded-lg transition cursor-pointer self-start sm:self-auto flex items-center gap-1.5"
            >
              {reviewEligibility.hasReviewed ? (
                <>
                  <Edit3 className="w-3.5 h-3.5" />
                  <span>Sửa đánh giá của bạn</span>
                </>
              ) : (
                <>
                  <MessageSquare className="w-3.5 h-3.5" />
                  <span>Viết đánh giá</span>
                </>
              )}
            </button>
          </div>

          {/* Rating Summary Card */}
          <div className="bg-[#0D0D11] border border-white/[0.07] rounded-xl p-5 grid grid-cols-1 md:grid-cols-12 gap-5 items-center">
            <div className="md:col-span-4 flex flex-col items-center justify-center border-b md:border-b-0 md:border-r border-white/[0.07] pb-3 md:pb-0 md:pr-4 text-center">
              <div className="flex items-center gap-2">
                <Star className="w-7 h-7 text-[#F7C600] fill-[#F7C600]" />
                <span className="text-3xl font-black text-white">
                  {reviewSummary?.averageRating != null
                    ? Number(reviewSummary.averageRating).toFixed(1)
                    : (displayRating?.score || '0.0')}
                </span>
                <span className="text-xs text-[#7F7F89]">/ 10</span>
              </div>
              <p className="text-xs text-[#B5B5BE] mt-1 font-sans">
                {reviewSummary?.totalReviews ?? reviews.length} lượt đánh giá
                {Number(reviewSummary?.totalReviews ?? reviews.length) > 0 && reviewSummary?.verifiedRatio != null && (
                  <span className="text-emerald-400 font-bold block mt-0.5">
                    ✓ {reviewSummary.verifiedRatio}% đã xác minh vé
                  </span>
                )}
              </p>
            </div>

            <div className="md:col-span-8 space-y-1 text-xs">
              {[5, 4, 3, 2, 1].map(stars => (
                <div key={stars} className="flex items-center gap-3">
                  <span className="w-8 font-mono text-[#7F7F89] flex items-center gap-0.5">
                    {stars * 2} <Star className="w-3 h-3 text-[#F7C600] fill-[#F7C600]" />
                  </span>
                  <div className="flex-1 h-2 bg-white/5 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-[#F7C600] rounded-full transition-all"
                      style={{ width: `${reviewDistribution?.percentages?.[stars] ?? 0}%` }}
                    />
                  </div>
                  <span className="w-10 text-right font-mono text-[#7F7F89]">
                    {reviewDistribution?.percentages?.[stars] ?? 0}%
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Reviews List */}
          <div className="space-y-3 pt-1">
            {isLoadingReviews && (
              <div className="p-6 text-center text-xs text-[#7F7F89]">
                <Loader2 className="w-4 h-4 animate-spin text-[#F7C600] mx-auto mb-2" />
                Đang tải nhận xét...
              </div>
            )}

            {!isLoadingReviews && reviews.length === 0 && (
              <div className="bg-[#0D0D11] border border-white/[0.07] rounded-xl p-6 text-center space-y-2">
                <p className="text-xs text-[#B5B5BE]">
                  Chưa có đánh giá nào cho phim này.
                </p>
                {reviewEligibility.eligible && (
                  <button
                    onClick={handleOpenWriteReview}
                    className="px-4 py-2 bg-[#F7C600] hover:bg-[#ffd836] text-black text-xs font-bold uppercase rounded-lg transition cursor-pointer"
                  >
                    Viết đánh giá đầu tiên
                  </button>
                )}
              </div>
            )}

            {!isLoadingReviews && reviews.map((rev) => (
              <div
                key={rev.id}
                className="bg-[#0D0D11] hover:bg-[#111116] border border-white/[0.06] rounded-xl p-4 space-y-2 transition"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="w-7 h-7 rounded-full bg-[#F7C600]/20 border border-[#F7C600]/30 text-xs font-bold text-[#F7C600] flex items-center justify-center">
                      {(rev.userName || rev.userFullName || rev.userEmail || 'C').slice(0, 1).toUpperCase()}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="text-xs font-bold text-white">
                          {rev.userName || rev.userFullName || 'Khán giả CinePremier'}
                        </h4>
                        {rev.verifiedBooking && (
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded border border-emerald-500/30 bg-emerald-500/10 text-emerald-400 text-[9px] font-bold">
                            <Check className="w-2.5 h-2.5" /> ĐÃ XÁC MINH VÉ
                          </span>
                        )}
                      </div>
                      <span className="text-[10px] text-[#7F7F89]">
                        {rev.createdAt ? new Date(rev.createdAt).toLocaleDateString('vi-VN') : 'Gần đây'}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-1 bg-amber-500/10 border border-amber-500/25 px-2 py-0.5 rounded text-amber-300 font-mono font-bold text-xs">
                    <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
                    <span>{rev.rating} / 10</span>
                  </div>
                </div>

                {rev.containsSpoiler && !revealedSpoilers[rev.id] ? (
                  <div className="bg-black/60 border border-rose-500/30 rounded p-2.5 my-1 text-xs flex items-center justify-between gap-2">
                    <span className="text-rose-300 font-bold text-[11px] flex items-center gap-1">
                      <AlertTriangle className="w-3.5 h-3.5" /> Đánh giá có chứa nội dung tiết lộ phim (Spoiler)
                    </span>
                    <button
                      type="button"
                      onClick={() => setRevealedSpoilers(prev => ({ ...prev, [rev.id]: true }))}
                      className="text-[10px] uppercase font-bold text-amber-400 hover:underline shrink-0"
                    >
                      Xem nội dung
                    </button>
                  </div>
                ) : (
                  <p className="text-xs text-[#D4D4D8] leading-relaxed pl-9 whitespace-pre-wrap">
                    "{rev.content || rev.comment || 'Phim rất tuyệt vời!'}"
                  </p>
                )}

                <div className="pl-9 pt-1.5 border-t border-white/[0.05] flex items-center justify-between text-[10px] text-[#7F7F89]">
                  <button
                    onClick={() => handleLikeReview(rev.id)}
                    className={`flex items-center gap-1.5 transition cursor-pointer ${
                      likedReviews[rev.id] ? 'text-rose-400 font-bold' : 'hover:text-white'
                    }`}
                  >
                    <Heart className={`h-3 w-3 ${likedReviews[rev.id] ? 'fill-current' : ''}`} />
                    <span>Hữu ích ({rev.likes || 0})</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setReportingReview(rev)}
                    className="hover:text-amber-400 transition cursor-pointer flex items-center gap-1 text-[#7F7F89]"
                    title="Báo cáo đánh giá này nếu vi phạm quy định"
                  >
                    <ShieldAlert className="h-3 w-3" />
                    <span>Báo cáo</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─────────────────────────────────────────────────────────────
          SECTION 6: PHIM BẠN CÓ THỂ THÍCH (Recommendations)
         ───────────────────────────────────────────────────────────── */}
      {similarMovies.length > 0 && (
        <section className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 border-t border-white/[0.06]">
          <div className="space-y-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5 border-l-4 border-[#F7C600] pl-3 py-0.5">
                <h2 className="text-lg sm:text-xl font-bold text-white tracking-tight">
                  Phim Bạn Có Thể Thích
                </h2>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => scrollSimilar(-1)}
                  aria-label="Phim trước"
                  className="w-8 h-8 rounded-full bg-[#0D0D11] hover:bg-[#F7C600] text-white hover:text-black border border-white/10 transition flex items-center justify-center cursor-pointer shadow"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => scrollSimilar(1)}
                  aria-label="Phim sau"
                  className="w-8 h-8 rounded-full bg-[#0D0D11] hover:bg-[#F7C600] text-white hover:text-black border border-white/10 transition flex items-center justify-center cursor-pointer shadow"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div
              ref={similarMoviesRef}
              className="flex gap-4 overflow-x-auto scroll-smooth snap-x snap-mandatory pb-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
            >
              {similarMovies.map((rec) => {
                const recTargetId = rec.backendId || rec.movieId || rec.id;
                return (
                  <div key={recTargetId} className="snap-start shrink-0 w-44 sm:w-50">
                    <MovieCard
                      movie={rec}
                      onSelect={(selectedId) => {
                        const targetId = selectedId || recTargetId;
                        window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
                        navigate(`/movies/${targetId}`);
                      }}
                      onBook={(mv) => {
                        const targetId = mv?.backendId || mv?.movieId || mv?.id || recTargetId;
                        navigate(`/movies/${targetId}`, { state: { scrollToShowtimes: true } });
                      }}
                      isWatchlisted={watchlist.some(w => String(w.id || w.backendId || w.movieId) === String(recTargetId))}
                      onToggleWatchlist={handleToggleWatchlist}
                    />
                  </div>
                );
              })}
            </div>
          </div>
        </section>
      )}

      {/* ─────────────────────────────────────────────────────────────
          WRITE / EDIT REVIEW MODAL (10-POINT SCALE & SPOILER CHECKBOX)
         ───────────────────────────────────────────────────────────── */}
      {showReviewModal && createPortal(
        <div
          className="fixed inset-0 z-[125] flex items-center justify-center bg-black/85 p-4 backdrop-blur-sm"
          onClick={() => setShowReviewModal(false)}
        >
          <div
            className="w-full max-w-lg bg-[#0D0D11] border border-amber-500/30 rounded-2xl p-6 space-y-4 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-3 border-b border-white/10">
              <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                <Star className="w-4 h-4 text-[#F7C600] fill-[#F7C600]" />
                {reviewEligibility.hasReviewed ? 'Chỉnh sửa đánh giá của bạn' : `Đánh giá phim: ${movie.title}`}
              </h3>
              <button
                onClick={() => setShowReviewModal(false)}
                className="text-[#7F7F89] hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSubmitReview} className="space-y-4 text-xs">
              {/* 10-point Rating Selector */}
              <div className="space-y-2 text-center bg-black/50 p-4 border border-white/5 rounded-xl">
                <label className="text-xs text-[#B5B5BE] font-bold block">
                  CHỌN ĐIỂM SỐ CỦA BẠN (1 — 10):
                </label>
                <div className="flex flex-wrap justify-center gap-1.5 py-1">
                  {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((num) => (
                    <button
                      key={num}
                      type="button"
                      onClick={() => setReviewRating(num)}
                      className={`w-8 h-8 rounded-lg font-mono font-bold text-xs transition cursor-pointer flex items-center justify-center ${
                        num <= reviewRating
                          ? 'bg-[#F7C600] text-black shadow-md shadow-[#F7C600]/20'
                          : 'bg-white/5 text-neutral-400 hover:bg-white/10 hover:text-white'
                      }`}
                    >
                      {num}
                    </button>
                  ))}
                </div>
                <div className="text-sm font-mono font-bold text-[#F7C600] flex items-center justify-center gap-1">
                  <Star className="w-4 h-4 fill-[#F7C600]" />
                  <span>{reviewRating} / 10 Điểm</span>
                </div>
              </div>

              {/* Review Content */}
              <div className="space-y-1.5">
                <label className="text-xs text-[#B5B5BE] font-bold block">
                  Cảm nghĩ của bạn về phim: <span className="text-amber-400">*</span>
                </label>
                <textarea
                  rows={4}
                  value={reviewComment}
                  onChange={(e) => setReviewComment(e.target.value)}
                  placeholder="Chia sẻ cảm xúc chân thực của bạn về kịch bản, diễn xuất, âm nhạc, kỹ xảo... (tối thiểu 5 ký tự)"
                  className="w-full bg-[#15151B] border border-white/10 rounded-xl p-3 text-white placeholder-[#7F7F89] outline-none focus:border-[#F7C600] resize-none"
                  required
                />
                <span className="text-[10px] text-neutral-500 font-mono">
                  {reviewComment.trim().length} ký tự (tối thiểu 5)
                </span>
              </div>

              {/* Spoiler Checkbox */}
              <label className="flex items-center gap-2.5 cursor-pointer bg-white/[0.02] p-2.5 rounded-lg border border-white/5">
                <input
                  type="checkbox"
                  checked={reviewContainsSpoiler}
                  onChange={(e) => setReviewContainsSpoiler(e.target.checked)}
                  className="h-4 w-4 accent-[#F7C600] cursor-pointer"
                />
                <span className="text-xs text-neutral-300">
                  Nội dung có tiết lộ tình tiết quan trọng của phim (Spoiler)
                </span>
              </label>

              <div className="flex justify-end gap-2 pt-2 border-t border-white/10">
                <button
                  type="button"
                  onClick={() => setShowReviewModal(false)}
                  className="px-4 py-2 bg-neutral-800 hover:bg-neutral-700 text-white rounded-lg cursor-pointer"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingReview || reviewComment.trim().length < 5}
                  className="px-5 py-2 bg-[#F7C600] hover:bg-[#ffd836] text-black font-bold uppercase rounded-lg transition disabled:opacity-50 cursor-pointer shadow"
                >
                  {isSubmittingReview ? 'Đang gửi...' : (reviewEligibility.hasReviewed ? 'Lưu thay đổi' : 'Gửi đánh giá')}
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}

      {/* ─────────────────────────────────────────────────────────────
          REPORT REVIEW DIALOG MODAL
         ───────────────────────────────────────────────────────────── */}
      {reportingReview && createPortal(
        <div
          className="fixed inset-0 z-[130] flex items-center justify-center bg-black/85 p-4 backdrop-blur-sm"
          onClick={() => setReportingReview(null)}
        >
          <div
            className="w-full max-w-md bg-[#0D0D11] border border-amber-500/30 rounded-2xl p-6 space-y-4 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-3 border-b border-white/10">
              <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2 text-amber-400">
                <ShieldAlert className="w-4 h-4" /> Báo cáo vi phạm đánh giá
              </h3>
              <button
                onClick={() => setReportingReview(null)}
                className="text-[#7F7F89] hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

<<<<<<< HEAD
            <form onSubmit={handleSubmitReport} className="space-y-4 text-xs">
              <div className="space-y-1.5">
                <label className="text-xs text-[#B5B5BE] font-bold block">
                  Lý do báo cáo: <span className="text-amber-400">*</span>
                </label>
                <select
                  value={reportReason}
                  onChange={(e) => setReportReason(e.target.value)}
                  className="w-full bg-[#15151B] border border-white/10 rounded-xl p-2.5 text-white outline-none focus:border-[#F7C600]"
                >
                  <option value="SPAM">Spam / Quảng cáo</option>
                  <option value="INAPPROPRIATE">Nội dung thô tục / Không phù hợp</option>
                  <option value="SPOILER">Tiết lộ nội dung phim (Spoiler)</option>
                  <option value="HARASSMENT">Quấy rối / Công kích cá nhân</option>
                  <option value="OFF_TOPIC">Lạc đề / Không liên quan đến phim</option>
                  <option value="OTHER">Lý do khác</option>
                </select>
=======
            <div className="relative">
              <button
                type="button"
                onClick={() => scrollSimilar(-1)}
                aria-label="Phim trước"
                className="absolute -left-3 top-1/2 z-20 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full bg-black/80 border border-white/20 text-white/80 hover:text-white transition shadow-lg"
              >
                <ChevronLeft className="h-5 w-5" />
              </button>

              <div
                ref={similarMoviesRef}
                className="flex gap-4 overflow-x-auto scroll-smooth snap-x snap-mandatory pb-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
              >
                {similarMovies.map((rec) => (
                  <button
                    key={rec.id ?? rec.movieId}
                    type="button"
                    onClick={() => {
                      window.scrollTo({ top: 0, behavior: 'smooth' });
                      navigate(`/movies/${rec.backendId || rec.id}`);
                    }}
                    className="snap-start shrink-0 w-36 sm:w-44 group relative text-left bg-neutral-900/60 rounded-xl border border-white/10 hover:border-amber-400/50 transition overflow-hidden cursor-pointer flex flex-col"
                  >
                    <div className="aspect-[2/3] w-full overflow-hidden bg-black relative">
                      {rec.posterUrl ? (
                        <img
                          src={rec.posterUrl || 'https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?auto=format&fit=crop&w=780&q=80'}
                          alt={rec.title}
                          loading="lazy"
                          className="h-full w-full object-cover opacity-85 group-hover:opacity-100 group-hover:scale-105 transition duration-500"
                          onError={(e) => { e.currentTarget.src = 'https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?auto=format&fit=crop&w=780&q=80'; }}
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center text-[10px] uppercase tracking-widest text-neutral-600">
                          Không có poster
                        </div>
                      )}
                      {typeof rec.similarity === 'number' && (
                        <span className="absolute top-2 right-2 bg-black/85 border border-amber-500/30 px-1.5 py-0.5 text-[9px] font-mono font-bold text-amber-300 rounded">
                          {Math.round(rec.similarity * 100)}%
                        </span>
                      )}
                    </div>
                    <div className="p-3 flex-1 flex flex-col justify-between">
                      <p className="text-xs font-serif font-bold text-white group-hover:text-amber-300 transition line-clamp-2">
                        {rec.title}
                      </p>
                      {rec.reason && (
                        <p className="mt-1 text-[10px] text-neutral-400 line-clamp-1" title={rec.reason}>
                          {rec.reason}
                        </p>
                      )}
                    </div>
                  </button>
                ))}
>>>>>>> 994357b939ca99abf48e6008d0d9cb6c51892055
              </div>

              <div className="space-y-1.5">
                <label className="text-xs text-[#B5B5BE] font-bold block">
                  Mô tả chi tiết (tùy chọn):
                </label>
                <textarea
                  rows={3}
                  value={reportDescription}
                  onChange={(e) => setReportDescription(e.target.value)}
                  placeholder="Giải thích thêm về lý do bạn báo cáo nội dung này..."
                  className="w-full bg-[#15151B] border border-white/10 rounded-xl p-3 text-white placeholder-[#7F7F89] outline-none focus:border-[#F7C600] resize-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-white/10">
                <button
                  type="button"
                  onClick={() => setReportingReview(null)}
                  className="px-4 py-2 bg-neutral-800 hover:bg-neutral-700 text-white rounded-lg cursor-pointer"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingReport}
                  className="px-5 py-2 bg-amber-500 hover:bg-amber-400 text-black font-bold uppercase rounded-lg transition disabled:opacity-50 cursor-pointer shadow"
                >
                  {isSubmittingReport ? 'Đang gửi...' : 'Gửi báo cáo'}
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}

      {/* ─────────────────────────────────────────────────────────────
          TRAILER DIALOG MODAL WITH AI ASSISTANT
         ───────────────────────────────────────────────────────────── */}
      {showTrailer && trailerUrl && createPortal(
        <div
          className="fixed inset-0 z-[120] flex items-center justify-center bg-black/95 p-4 transition duration-300 backdrop-blur-md"
          id="trailer-modal"
          onClick={() => setShowTrailer(false)}
        >
          <div
            id="trailer-modal-inner"
            className="relative w-full max-w-4xl border border-white/20 rounded-2xl bg-[#070709] shadow-2xl overflow-hidden max-h-[95vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-5 py-3 bg-[#0D0D11] border-b border-white/10">
              <span className="text-xs text-neutral-300 font-sans font-bold uppercase tracking-wider flex items-center gap-2">
                <Play className="w-3.5 h-3.5 fill-[#F7C600] text-[#F7C600]" />
                Trailer chính thức: {movie.title}
              </span>
              <button
                onClick={() => setShowTrailer(false)}
                className="flex items-center gap-1.5 text-neutral-400 hover:text-white transition text-xs font-sans cursor-pointer px-2 py-1 rounded bg-white/5 hover:bg-white/10"
                id="close-trailer-modal"
              >
                <span>✕</span>
                <span className="tracking-wider uppercase text-[10px]">Đóng</span>
              </button>
            </div>

            <div className="aspect-video w-full bg-black">
              {hasDirectTrailerVideo ? (
                <video src={trailerUrl} className="h-full w-full" controls autoPlay playsInline />
              ) : (
                <iframe
                  title={`${movie.title} Trailer`}
                  src={trailerEmbedSrc}
                  className="h-full w-full border-none"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                />
              )}
            </div>

            <div className="flex flex-col border-t border-[#F7C600]/20 bg-[#0A0A0D]">
              <div className="flex items-center gap-3 px-5 py-3 border-b border-white/8 bg-[#F7C600]/[0.03]">
                <img
                  src={popcornBot}
                  alt="AI Assistant"
                  className="w-6 h-6 object-cover flex-shrink-0 rounded-full border border-[#F7C600]/40"
                />
                <span className="text-xs font-sans font-bold text-white uppercase tracking-wider">
                  Trợ lý CinePremier AI
                </span>
                <div className="ml-auto flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  <span className="text-[10px] text-emerald-400 font-mono uppercase">Online</span>
                </div>
              </div>

              <div className="px-5 py-3 space-y-3 max-h-48 overflow-y-auto">
                <div className="flex items-start gap-2.5">
                  <img
                    src={popcornBot}
                    alt="AI Assistant"
                    className="w-6 h-6 object-cover flex-shrink-0 mt-0.5 rounded-full border border-[#F7C600]/40"
                  />
                  <div className="bg-[#15151B] border border-white/10 px-4 py-2.5 max-w-md rounded-2xl rounded-tl-sm text-xs font-sans text-neutral-200 leading-relaxed">
                    Xin chào! Bạn có thắc mắc gì về diễn biến trailer hay thông tin phim <strong className="text-[#F7C600]">{movie.title}</strong> không?
                  </div>
                </div>
                {trailerChatMessages.map((msg, i) => (
                  <div key={i} className={`flex items-start gap-2.5 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
                    {msg.role === 'bot' && (
                      <img
                        src={popcornBot}
                        alt="AI Assistant"
                        className="w-6 h-6 object-cover flex-shrink-0 mt-0.5 rounded-full border border-[#F7C600]/40"
                      />
                    )}
                    <div className={`px-4 py-2.5 max-w-md text-xs font-sans leading-relaxed rounded-2xl ${
                      msg.role === 'user'
                        ? 'bg-[#F7C600] text-black font-medium rounded-tr-sm'
                        : 'bg-[#15151B] border border-white/10 text-neutral-200 rounded-tl-sm'
                    }`}>
                      {msg.text}
                    </div>
                  </div>
                ))}
                <div ref={trailerChatEndRef} />
              </div>

              <div className="flex items-center gap-3 px-5 py-3 border-t border-white/8 bg-[#0D0D11]">
                <input
                  type="text"
                  value={trailerChatInput}
                  onChange={(e) => setTrailerChatInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') handleSendTrailerChat(); }}
                  disabled={trailerChatSending}
                  placeholder={`Đặt câu hỏi về ${movie.title}...`}
                  className="flex-1 bg-[#15151B] border border-white/10 px-4 py-2 text-xs font-sans text-white placeholder-neutral-500 outline-none focus:border-[#F7C600] rounded-lg disabled:opacity-60"
                />
                <button
                  onClick={handleSendTrailerChat}
                  disabled={trailerChatSending || !trailerChatInput.trim()}
                  className="bg-[#F7C600] hover:bg-[#ffd836] text-black px-4 py-2 text-xs font-sans font-bold uppercase tracking-wider rounded-lg flex-shrink-0 disabled:opacity-50 transition shadow cursor-pointer"
                >
                  Gửi
                </button>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
