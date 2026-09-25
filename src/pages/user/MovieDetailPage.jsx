import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import {
  ArrowLeft, Play, Star, Clock, Heart, Loader2, ChevronLeft, ChevronRight,
  Calendar, Globe, Film, Shield, MessageSquare, Sparkles, CheckCircle2,
  AlertCircle, Share2, Eye, User, Users, Layers, Tag, ExternalLink, Ticket,
  Award, Volume2, Languages, Check, Info, ArrowUpRight
} from 'lucide-react';
import { useMovies } from '../../stores/useMovieStore';
import { getStoredAuth, hasBackendAdminAccess, hasBackendManagerAccess, hasBackendStaffAccess } from '../../services/authService';
import { adminService } from '../../services/adminService';
import { movieService, normalizeMovie } from '../../services/movieService';
import { bookingService } from '../../services/bookingService';
import { reviewService } from '../../services/reviewService';
import { recommendationService } from '../../services/recommendationService';
import { chatService } from '../../services/chatService';
import { useAuthStore } from '../../stores/useAuthStore';

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

const hasSourcePoster = (movie = {}) => Boolean(
  movie.raw?.posterUrl
  || movie.raw?.poster
  || movie.raw?.posterImageUrl
  || movie.raw?.imageUrl
  || movie.raw?.thumbnailUrl
);

const formatDateVi = (dateStr) => {
  if (!dateStr || dateStr === 'Dang cap nhat') return 'Đang cập nhật';
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });
  } catch {
    return dateStr;
  }
};

const formatDurationVi = (minutes) => {
  const mins = Number(minutes);
  if (!mins || isNaN(mins)) return 'Đang cập nhật';
  const hours = Math.floor(mins / 60);
  const remMins = mins % 60;
  if (hours === 0) return `${mins} phút`;
  if (remMins === 0) return `${hours} giờ (${mins} phút)`;
  return `${hours}h ${remMins}m (${mins} phút)`;
};

const AGE_RATING_DETAILS = {
  P: {
    label: 'P',
    title: 'Phim Phổ Biến (P)',
    shortDesc: 'Mọi lứa tuổi',
    desc: 'Phim được phép phổ biến rộng rãi đến người xem ở mọi độ tuổi.',
    badgeClass: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
  },
  K: {
    label: 'K',
    title: 'Khán giả dưới 13 tuổi (K)',
    shortDesc: 'Cần người giám hộ',
    desc: 'Phim được phổ biến đến người xem dưới 13 tuổi với điều kiện xem cùng cha, mẹ hoặc người giám hộ.',
    badgeClass: 'bg-blue-500/20 text-blue-400 border-blue-500/30'
  },
  T13: {
    label: 'T13',
    title: 'Cấm khán giả dưới 13 tuổi (13+)',
    shortDesc: 'Từ đủ 13 tuổi',
    desc: 'Phim được phép phổ biến đến khán giả từ đủ 13 tuổi trở lên.',
    badgeClass: 'bg-amber-500/20 text-amber-400 border-amber-500/30'
  },
  '13+': {
    label: '13+',
    title: 'Cấm khán giả dưới 13 tuổi (13+)',
    shortDesc: 'Từ đủ 13 tuổi',
    desc: 'Phim được phép phổ biến đến khán giả từ đủ 13 tuổi trở lên.',
    badgeClass: 'bg-amber-500/20 text-amber-400 border-amber-500/30'
  },
  C13: {
    label: '13+',
    title: 'Cấm khán giả dưới 13 tuổi (13+)',
    shortDesc: 'Từ đủ 13 tuổi',
    desc: 'Phim được phép phổ biến đến khán giả từ đủ 13 tuổi trở lên.',
    badgeClass: 'bg-amber-500/20 text-amber-400 border-amber-500/30'
  },
  T16: {
    label: 'T16',
    title: 'Cấm khán giả dưới 16 tuổi (16+)',
    shortDesc: 'Từ đủ 16 tuổi',
    desc: 'Phim được phép phổ biến đến khán giả từ đủ 16 tuổi trở lên.',
    badgeClass: 'bg-orange-500/20 text-orange-400 border-orange-500/30'
  },
  '16+': {
    label: '16+',
    title: 'Cấm khán giả dưới 16 tuổi (16+)',
    shortDesc: 'Từ đủ 16 tuổi',
    desc: 'Phim được phép phổ biến đến khán giả từ đủ 16 tuổi trở lên.',
    badgeClass: 'bg-orange-500/20 text-orange-400 border-orange-500/30'
  },
  C16: {
    label: '16+',
    title: 'Cấm khán giả dưới 16 tuổi (16+)',
    shortDesc: 'Từ đủ 16 tuổi',
    desc: 'Phim được phép phổ biến đến khán giả từ đủ 16 tuổi trở lên.',
    badgeClass: 'bg-orange-500/20 text-orange-400 border-orange-500/30'
  },
  T18: {
    label: 'T18',
    title: 'Cấm khán giả dưới 18 tuổi (18+)',
    shortDesc: 'Từ đủ 18 tuổi',
    desc: 'Phim được phép phổ biến đến khán giả từ đủ 18 tuổi trở lên.',
    badgeClass: 'bg-rose-500/20 text-rose-400 border-rose-500/30'
  },
  '18+': {
    label: '18+',
    title: 'Cấm khán giả dưới 18 tuổi (18+)',
    shortDesc: 'Từ đủ 18 tuổi',
    desc: 'Phim được phép phổ biến đến khán giả từ đủ 18 tuổi trở lên.',
    badgeClass: 'bg-rose-500/20 text-rose-400 border-rose-500/30'
  },
  C18: {
    label: '18+',
    title: 'Cấm khán giả dưới 18 tuổi (18+)',
    shortDesc: 'Từ đủ 18 tuổi',
    desc: 'Phim được phép phổ biến đến khán giả từ đủ 18 tuổi trở lên.',
    badgeClass: 'bg-rose-500/20 text-rose-400 border-rose-500/30'
  },
  C: {
    label: 'C',
    title: 'Cấm phổ biến (C)',
    shortDesc: 'Không phổ biến',
    desc: 'Phim không được phép phổ biến đến khán giả.',
    badgeClass: 'bg-red-950/40 text-red-500 border-red-500/50'
  }
};

export default function DetailView() {
  const navigate = useNavigate();
  const { id } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();

  const similarMoviesRef = useRef(null);
  const scrollSimilar = (dir) => {
    const el = similarMoviesRef.current;
    if (el) el.scrollBy({ left: dir * el.clientWidth * 0.8, behavior: 'smooth' });
  };

  const { moviesList, setMoviesList, watchlist = [], handleToggleWatchlist } = useMovies();
  const currentRole = useAuthStore((state) => state.currentRole);
  const currentUser = useAuthStore((state) => state.currentUser);

  // Local movie state to ensure immediate rendering without relying solely on global store
  const [localMovie, setLocalMovie] = useState(null);
  const [isLoadingDetail, setIsLoadingDetail] = useState(true);
  const [detailError, setDetailError] = useState(null);
  const [copiedLink, setCopiedLink] = useState(false);

  // Derived movie: check localMovie first, then moviesList
  const movie = localMovie || moviesList.find(m => String(m.id) === String(id) || String(m.backendId) === String(id));
  const detailMovieId = movie?.backendId || movie?.movieId || movie?.id || id;

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
      setTimeout(() => setCopiedLink(false), 2200);
    } catch {
      // Fallback
    }
  };

  const onBook = (mv) => {
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
    navigate(`/movies/${mv.backendId || mv.id}/book`);
  };

  // Robust detail fetching for all movie states (published, draft, pending, approved)
  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    setIsLoadingDetail(true);
    setDetailError(null);

    const fetchDetail = async () => {
      // 1. Check local browser drafts if id is a local draft
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

      // 2. Fetch from backend API
      try {
        const { accessToken, user } = getStoredAuth();
        const targetId = movie?.backendId || id;
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
          // Privileged user: try admin endpoint first to view drafts/pending/unpublished movies
          try {
            detail = await adminService.getAdminMovieDetail(accessToken, targetId);
          } catch (adminErr) {
            try {
              detail = await movieService.getMovieDetail(targetId);
            } catch (pubErr) {
              console.warn('Both admin and public detail fetch failed:', adminErr, pubErr);
            }
          }
        } else {
          // Public viewer: try public endpoint first
          try {
            detail = await movieService.getMovieDetail(targetId);
          } catch (pubErr) {
            // If public 404s (e.g. newly created movie) but user is authenticated, try admin endpoint as fallback
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

  // Trailer modal state
  const [showTrailer, setShowTrailerState] = useState(searchParams.get('trailer') === '1');
  const setShowTrailer = (value) => {
    setShowTrailerState(value);
    if (!value && searchParams.get('trailer')) {
      const next = new URLSearchParams(searchParams);
      next.delete('trailer');
      setSearchParams(next, { replace: true });
    }
  };

  // Reviews state
  const [reviews, setReviews] = useState([]);
  const [isLoadingReviews, setIsLoadingReviews] = useState(false);
  const [likedReviews, setLikedReviews] = useState({});
  const [similarMovies, setSimilarMovies] = useState([]);

  const isBookable = movie?.status === 'NOW_SHOWING' || (!movie?.status && !movie?.isUpcoming);
  const [showtimesCount, setShowtimesCount] = useState(null);

  useEffect(() => {
    const targetMovieId = Number(detailMovieId);
    if (!targetMovieId || isNaN(targetMovieId)) return;
    let cancelled = false;
    bookingService.getShowtimes({ movieId: targetMovieId })
      .then(data => {
        if (cancelled) return;
        const rawList = Array.isArray(data) ? data : (data?.items ?? data?.content ?? []);
        const upcoming = rawList.filter(st => new Date(st.startTime) > new Date());
        setShowtimesCount(upcoming.length);
      })
      .catch(() => {
        if (!cancelled) setShowtimesCount(0);
      });
    return () => { cancelled = true; };
  }, [detailMovieId]);

  const isWatchlisted = movie && watchlist.some((item) => (
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

  // Fetch reviews
  useEffect(() => {
    if (!detailMovieId) return;
    let cancelled = false;
    setIsLoadingReviews(true);
    reviewService.getMovieReviews(detailMovieId)
      .then((payload) => {
        if (cancelled) return;
        setReviews(Array.isArray(payload) ? payload : payload?.items || []);
      })
      .catch(() => {
        if (!cancelled) setReviews([]);
      })
      .finally(() => {
        if (!cancelled) setIsLoadingReviews(false);
      });
    return () => {
      cancelled = true;
    };
  }, [detailMovieId]);

  // Handle trailer modal scroll lock & ESC
  useEffect(() => {
    if (!showTrailer) return undefined;
    const onKeyDown = (e) => { if (e.key === 'Escape') setShowTrailer(false); };
    const scrollY = window.scrollY;
    const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;
    document.body.style.position = 'fixed';
    document.body.style.top = `-${scrollY}px`;
    document.body.style.width = '100%';
    document.body.style.paddingRight = `${scrollbarWidth}px`;

    const redirectScroll = (e) => {
      const inner = document.getElementById('trailer-modal-inner');
      if (!inner) return;
      e.preventDefault();
      inner.scrollBy({ top: e.deltaY, behavior: 'auto' });
    };
    document.addEventListener('wheel', redirectScroll, { passive: false });
    document.addEventListener('touchmove', redirectScroll, { passive: false });

    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      document.removeEventListener('wheel', redirectScroll);
      document.removeEventListener('touchmove', redirectScroll);
      document.body.style.position = '';
      document.body.style.top = '';
      document.body.style.width = '';
      document.body.style.paddingRight = '';
      window.scrollTo(0, scrollY);
    };
  }, [showTrailer]);

  // Fetch similar movies (SBERT recommendations)
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

          if (hasSourcePoster(rec)) return rec;

          try {
            const detail = await movieService.getMovieDetail(recId);
            return detail?.id ? { ...rec, ...detail, similarity: rec.similarity } : rec;
          } catch {
            return rec;
          }
        }));
        if (!cancelled) setSimilarMovies(enriched);
      })
      .catch(() => {
        if (!cancelled) setSimilarMovies([]);
      });
    return () => {
      cancelled = true;
    };
  }, [detailMovieId, moviesList]);

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

  // 1. Loading State
  if (isLoadingDetail && !movie) {
    return (
      <div className="min-h-[80vh] bg-[#0a0c10] flex flex-col items-center justify-center space-y-4 px-4 text-center">
        <div className="relative">
          <div className="w-16 h-16 rounded-full border-2 border-amber-500/20 border-t-amber-400 animate-spin" />
          <Film className="w-6 h-6 text-amber-400 absolute inset-0 m-auto animate-pulse" />
        </div>
        <p className="text-xs font-sans uppercase tracking-[0.2em] text-neutral-400 animate-pulse">
          Đang tải thông tin phim...
        </p>
      </div>
    );
  }

  // 2. Error / Not Found State
  if (!movie) {
    return (
      <div className="min-h-[75vh] bg-[#0a0c10] flex flex-col items-center justify-center space-y-6 px-4 text-center">
        <div className="w-20 h-20 rounded-2xl bg-neutral-900 border border-white/10 flex items-center justify-center text-neutral-500 shadow-xl">
          <Film className="w-10 h-10 text-neutral-600" />
        </div>
        <div className="space-y-2 max-w-md">
          <h2 className="text-2xl font-serif font-bold text-white uppercase tracking-wider">Không tìm thấy thông tin phim</h2>
          <p className="text-xs text-neutral-400 font-sans leading-relaxed">
            {detailError || 'Phim này có thể chưa được duyệt xuất bản hoặc đường dẫn không chính xác.'}
          </p>
        </div>
        <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
          <button
            onClick={handleBack}
            className="flex items-center gap-2 px-5 py-2.5 bg-amber-500 hover:bg-amber-400 text-black text-xs font-bold font-sans uppercase tracking-wider transition rounded shadow-lg"
          >
            <ArrowLeft className="w-4 h-4" /> Quay lại
          </button>
          <button
            onClick={() => navigate('/')}
            className="px-5 py-2.5 bg-neutral-900 hover:bg-neutral-800 text-white border border-white/15 text-xs font-bold font-sans uppercase tracking-wider transition rounded"
          >
            Về trang chủ
          </button>
          {(currentRole === 'admin' || currentRole === 'manager' || currentRole === 'staff') && (
            <button
              onClick={() => navigate('/admin')}
              className="px-5 py-2.5 bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/30 text-xs font-bold font-sans uppercase tracking-wider transition rounded"
            >
              Vào quản lý phim
            </button>
          )}
        </div>
      </div>
    );
  }

  // Cast processing
  const mainActorIdSet = new Set((movie.mainActorIds || []).map((actorId) => Number(actorId)));
  const hasExplicitMain = mainActorIdSet.size > 0;
  const currentCasts = Array.isArray(movie.actors)
    ? movie.actors.map((actor) => ({
      id: Number.isFinite(Number(actor.id ?? actor.actorId)) ? Number(actor.id ?? actor.actorId) : actor.name,
      name: actor.name || actor.fullName || actor.actorName || 'Diễn viên',
      role: actor.role || actor.characterName || actor.description || 'Diễn viên',
      avatarUrl: actor.avatarUrl || actor.imageUrl || actor.photoUrl || '',
      isMain: hasExplicitMain ? mainActorIdSet.has(Number(actor.id ?? actor.actorId)) : true
    }))
    : [];
  const mainCasts = currentCasts.filter((cast) => cast.isMain);
  const supportingCasts = currentCasts.filter((cast) => !cast.isMain);
  const directorNames = splitDirectorNames(movie.director);
  const rawAgeRating = String(movie.ageRating || 'P').trim();
  const ageInfo = AGE_RATING_DETAILS[rawAgeRating] || AGE_RATING_DETAILS[rawAgeRating.toUpperCase()] || {
    label: movie.ageRating || 'P',
    title: `Phân loại ${movie.ageRating || 'P'}`,
    shortDesc: 'Tiêu chuẩn rạp',
    desc: 'Theo quy định kiểm duyệt của Bộ Văn hóa, Thể thao & Du lịch.',
    badgeClass: 'bg-neutral-800 text-neutral-300 border-white/10'
  };

  const isPrivilegedUser = currentRole === 'admin' || currentRole === 'manager' || currentRole === 'staff';
  const approval = String(movie.approvalStatus || 'APPROVED').toUpperCase();
  const publication = String(movie.publicationStatus || 'PUBLISHED').toUpperCase();
  const isNonPublic = approval !== 'APPROVED' || publication !== 'PUBLISHED';
  const sourceRating = movie.raw?.rating ?? movie.raw?.averageRating ?? movie.raw?.ratings?.overall;
  const hasRating = Number.isFinite(Number(sourceRating)) && Number(sourceRating) > 0;
  const rating = hasRating ? Number(sourceRating) : null;

  return (
    <div className="square-ui min-h-screen bg-[#0a0c10] text-neutral-200 pb-24 relative selection:bg-amber-500 selection:text-black">
      {/* Background ambient lighting */}
      <div className="pointer-events-none fixed inset-0 -z-50 overflow-hidden">
        <div className="absolute left-1/2 top-1/4 h-[700px] w-[700px] -translate-x-1/2 rounded-full bg-amber-500/[0.04] blur-[160px]" />
        <div className="absolute right-10 top-1/2 h-[500px] w-[500px] rounded-full bg-blue-500/[0.03] blur-[150px]" />
      </div>

      {/* ADMIN PREVIEW NOTIFICATION BANNER */}
      {isNonPublic && (
        <aside
          aria-label="Chế độ xem trước nội bộ"
          className="bg-amber-950/50 border-b border-amber-500/30 px-4 py-3 sticky top-0 z-40 backdrop-blur-md"
        >
          <div className="max-w-6xl mx-auto flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2">
              <span className="p-1 rounded bg-amber-500/20 text-amber-400 border border-amber-500/30">
                <Shield className="w-3.5 h-3.5" />
              </span>
              <span className="font-bold text-amber-300 uppercase tracking-wider">
                Chế độ xem trước nội bộ (Preview)
              </span>
              <span className="text-neutral-400 hidden sm:inline">•</span>
              <span className="text-neutral-300 hidden sm:inline">
                Phim này chưa được xuất bản công khai trên website.
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
                  className="px-2.5 py-1 bg-amber-500 hover:bg-amber-400 text-black font-bold text-[10px] uppercase rounded transition flex items-center gap-1"
                >
                  <Eye className="w-3 h-3" /> Quản lý Admin
                </button>
              )}
            </div>
          </div>
        </aside>
      )}

      {/* TOP NAVIGATION BAR */}
      <nav aria-label="Điều hướng trang chi tiết" className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 pb-2">
        <div className="flex items-center justify-between gap-4">
          <button
            onClick={handleBack}
            className="flex items-center gap-2 px-3.5 py-2 bg-neutral-900/90 hover:bg-amber-500 hover:text-black border border-white/10 hover:border-amber-400 text-xs font-bold uppercase tracking-wider text-neutral-300 transition-all rounded shadow-md group"
            id="detail-back-button"
          >
            <ArrowLeft className="h-3.5 w-3.5 transition-transform group-hover:-translate-x-1" />
            <span>QUAY LẠI</span>
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleShare}
              className="flex items-center gap-1.5 px-3 py-2 bg-neutral-900/80 hover:bg-neutral-800 border border-white/10 text-xs font-sans text-neutral-300 hover:text-white rounded transition"
              title="Sao chép link chia sẻ phim"
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
              className={`flex items-center gap-1.5 px-3.5 py-2 text-xs font-sans font-bold uppercase tracking-wider rounded transition border ${isWatchlisted
                ? 'border-rose-500/70 bg-rose-500 text-white shadow-lg shadow-rose-950/30'
                : 'border-white/10 bg-neutral-900/80 text-neutral-300 hover:text-white hover:border-white/20'
                }`}
              id="detail-watchlist-button"
            >
              <Heart className={`h-3.5 w-3.5 ${isWatchlisted ? 'fill-current' : ''}`} />
              <span className="hidden sm:inline">{isWatchlisted ? 'Đã lưu' : 'Lưu phim'}</span>
            </button>
          </div>
        </div>
      </nav>

      {/* 1. HERO BANNER & POSTER SECTION */}
      <section className="relative overflow-hidden pt-4 pb-10">
        {/* Backdrop Banner Background */}
        <div
          className="absolute inset-0 bg-cover bg-center -z-10 filter blur-sm scale-105 opacity-35"
          style={{ backgroundImage: `url(${movie.bannerUrl || movie.posterUrl})` }}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[#0a0c10] via-[#0a0c10]/80 to-[#0a0c10]/40 -z-10" />

        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-8 items-start">
            {/* Left Column: Poster & Rating */}
            <div className="md:col-span-4 lg:col-span-4 flex flex-col items-center md:items-start space-y-4">
              <div className="relative w-64 sm:w-72 aspect-[2/3] overflow-hidden rounded-xl border border-white/15 shadow-2xl shadow-black/80 bg-neutral-950 group">
                <img
                  src={movie.posterUrl}
                  alt={movie.title}
                  className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                  referrerPolicy="no-referrer"
                />

                {/* Age Rating Badge */}
                <div
                  className={`absolute top-3 left-3 px-2 py-0.5 text-[11px] font-black tracking-wider border rounded-md uppercase backdrop-blur-md ${ageInfo.badgeClass}`}
                  title={ageInfo.desc}
                >
                  {ageInfo.label}
                </div>

                {/* Play Trailer Overlay Button */}
                {trailerUrl && (
                  <button
                    onClick={() => setShowTrailer(true)}
                    className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex flex-col items-center justify-center gap-2 text-white"
                    title="Bấm để xem trailer"
                  >
                    <div className="w-14 h-14 rounded-full bg-amber-500/90 text-black flex items-center justify-center shadow-xl transform scale-90 group-hover:scale-100 transition-transform">
                      <Play className="w-6 h-6 fill-black translate-x-0.5" />
                    </div>
                    <span className="text-xs font-bold uppercase tracking-widest text-amber-300">Xem Trailer</span>
                  </button>
                )}
              </div>

              {/* Rating Card */}
              <div className="w-64 sm:w-72 bg-neutral-900/90 border border-white/10 rounded-xl p-4 space-y-3 backdrop-blur-md shadow-lg">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <Star className="w-5 h-5 text-amber-400 fill-amber-400" />
                    <span className="text-xl font-serif font-black text-white">
                      {rating ? rating.toFixed(1) : '—'}
                    </span>
                    <span className="text-xs text-neutral-500 font-mono">{rating ? '/ 10' : 'chưa có điểm'}</span>
                  </div>
                  <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded bg-white/5 text-neutral-400 border border-white/5">
                    {reviews.length} đánh giá
                  </span>
                </div>

                {rating && (
                  <div className="grid grid-cols-2 gap-2 text-[10px] text-neutral-400 pt-1 border-t border-white/5">
                    <div className="flex justify-between">
                      <span>Kịch bản:</span>
                      <strong className="text-neutral-200">{Number(movie.ratings?.story ?? rating).toFixed(1)}</strong>
                    </div>
                    <div className="flex justify-between">
                      <span>Diễn xuất:</span>
                      <strong className="text-neutral-200">{Number(movie.ratings?.acting ?? rating).toFixed(1)}</strong>
                    </div>
                    <div className="flex justify-between">
                      <span>Kỹ xảo:</span>
                      <strong className="text-neutral-200">{Number(movie.ratings?.visual ?? rating).toFixed(1)}</strong>
                    </div>
                    <div className="flex justify-between">
                      <span>Âm thanh:</span>
                      <strong className="text-neutral-200">{Number(movie.ratings?.audio ?? rating).toFixed(1)}</strong>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Right Column: Title, Metadata, Actions */}
            <div className="md:col-span-8 lg:col-span-8 space-y-5 text-center md:text-left">
              {/* Status and Formats Row */}
              <div className="flex flex-wrap items-center justify-center md:justify-start gap-2">
                <span className={`px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider rounded-md border flex items-center gap-1.5 ${
                  movie.status === 'NOW_SHOWING'
                    ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                    : movie.status === 'UPCOMING'
                      ? 'bg-amber-500/20 text-amber-300 border-amber-500/30'
                      : 'bg-neutral-800 text-neutral-400 border-white/10'
                }`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${movie.status === 'NOW_SHOWING' ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'}`} />
                  {movie.status === 'NOW_SHOWING' ? 'ĐANG CHIẾU' : movie.status === 'UPCOMING' ? 'SẮP KHỞI CHIẾU' : 'PHIM ĐIỆN ẢNH'}
                </span>

                <span className="px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider rounded-md border bg-white/5 border-white/10 text-neutral-300">
                  2D DIGITAL
                </span>

                {movie.language && (
                  <span className="px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider rounded-md border bg-white/5 border-white/10 text-neutral-300">
                    {movie.language}
                  </span>
                )}
              </div>

              {/* Movie Main Title */}
              <div className="space-y-1">
                <h1 className="text-3xl sm:text-4xl lg:text-5xl font-serif font-black text-white tracking-wide uppercase leading-tight">
                  {movie.title}
                </h1>
                {movie.englishTitle && movie.englishTitle !== movie.title && (
                  <p className="text-sm sm:text-base font-sans font-medium text-amber-400/90 tracking-wider uppercase">
                    {movie.englishTitle}
                  </p>
                )}
              </div>

              {/* Quick Specs Badges */}
              <div className="flex flex-wrap items-center justify-center md:justify-start gap-2 pt-1 text-xs">
                {/* Genres */}
                {Array.isArray(movie.genre) && movie.genre.map((gen) => (
                  <span
                    key={gen}
                    className="px-3 py-1 rounded-full bg-white/5 border border-white/10 text-neutral-200 text-[11px] font-sans hover:border-amber-400/40 transition"
                  >
                    {gen}
                  </span>
                ))}

                {/* Duration */}
                <span className="px-3 py-1 rounded-full bg-white/5 border border-white/10 text-neutral-200 text-[11px] font-mono flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-amber-400" />
                  {formatDurationVi(movie.duration)}
                </span>

                {/* Release Date */}
                <span className="px-3 py-1 rounded-full bg-white/5 border border-white/10 text-neutral-200 text-[11px] font-mono flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-amber-400" />
                  {formatDateVi(movie.releaseDate)}
                </span>
              </div>

              {/* Short synopsis excerpt */}
              {movie.synopsis && (
                <p className="text-sm text-neutral-300 font-sans leading-relaxed line-clamp-3 md:line-clamp-4 pt-1">
                  {movie.synopsis}
                </p>
              )}

              {/* Action Buttons */}
              <div className="flex flex-wrap items-center justify-center md:justify-start gap-3 pt-4">
                {isBookable ? (
                  <button
                    onClick={() => onBook(movie)}
                    className="px-8 py-3.5 bg-gradient-to-r from-amber-500 to-amber-400 hover:from-amber-400 hover:to-amber-300 text-black font-sans font-black text-xs uppercase tracking-widest rounded-lg shadow-lg shadow-amber-500/20 hover:shadow-amber-500/35 transition duration-300 flex items-center gap-2 transform hover:-translate-y-0.5"
                    id="detail-book-now"
                  >
                    <Ticket className="w-4 h-4" />
                    <span>{showtimesCount === 0 ? 'XEM LỊCH CHIẾU (CHƯA CÓ SUẤT)' : 'ĐẶT VÉ NGAY'}</span>
                  </button>
                ) : (
                  <div className="px-6 py-3.5 bg-neutral-900 border border-white/15 text-neutral-400 uppercase text-xs tracking-wider font-bold rounded-lg flex items-center gap-2">
                    <Clock className="w-4 h-4 text-amber-400" />
                    <span>Dự kiến khởi chiếu: {formatDateVi(movie.releaseDate)}</span>
                  </div>
                )}

                {trailerUrl && (
                  <button
                    onClick={() => setShowTrailer(true)}
                    className="px-6 py-3.5 bg-neutral-900/90 hover:bg-neutral-800 border border-amber-500/40 hover:border-amber-400 text-amber-300 hover:text-white text-xs font-sans font-bold uppercase tracking-wider rounded-lg transition duration-300 flex items-center gap-2 shadow-md"
                    id="detail-trailer-button"
                  >
                    <Play className="h-4 w-4 fill-current" />
                    XEM TRAILER
                  </button>
                )}
              </div>

              {/* Rejection Alert if REJECTED */}
              {approval === 'REJECTED' && movie.rejectionReason && (
                <div className="p-3.5 bg-rose-950/30 border border-rose-500/30 rounded-lg text-rose-300 text-xs space-y-1 mt-3">
                  <div className="font-bold flex items-center gap-1.5 text-rose-400">
                    <AlertCircle className="w-4 h-4" /> Lý do từ chối phê duyệt:
                  </div>
                  <p className="font-sans leading-relaxed text-neutral-300 pl-5">{movie.rejectionReason}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* 2. COMPREHENSIVE MOVIE SPECS & DETAILS */}
      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12 mt-6">
        {/* SPECIFICATIONS GRID CARD */}
        <div className="bg-neutral-950/80 border border-white/10 rounded-2xl p-6 sm:p-8 space-y-6 shadow-xl backdrop-blur-sm">
          <div className="border-b border-white/10 pb-3 flex items-center justify-between">
            <h2 className="text-sm font-sans font-black uppercase tracking-[0.2em] text-amber-400 flex items-center gap-2">
              <Film className="w-4 h-4" /> THÔNG TIN CHI TIẾT
            </h2>
            <span className="text-[11px] font-mono text-neutral-500">Mã phim: #{detailMovieId}</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 text-xs">
            {/* Đạo diễn */}
            <div className="space-y-1.5">
              <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-400 block">Đạo diễn</span>
              <p className="font-semibold text-white text-sm">
                {directorNames.length > 0 ? directorNames.join(', ') : (movie.director || 'Đang cập nhật')}
              </p>
            </div>

            {/* Diễn viên chính */}
            <div className="space-y-1.5">
              <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-400 block">Diễn viên chính</span>
              <p className="font-semibold text-white text-sm">
                {mainCasts.length > 0
                  ? mainCasts.map(c => c.name).join(', ')
                  : (movie.mainActors || movie.castList || 'Đang cập nhật')}
              </p>
            </div>

            {/* Thể loại */}
            <div className="space-y-1.5">
              <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-400 block">Thể loại</span>
              <p className="font-semibold text-white text-sm">
                {Array.isArray(movie.genre) ? movie.genre.join(', ') : (movie.genre || 'Đang cập nhật')}
              </p>
            </div>

            {/* Thời lượng */}
            <div className="space-y-1.5">
              <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-400 block">Thời lượng</span>
              <p className="font-semibold text-white text-sm">
                {formatDurationVi(movie.duration)}
              </p>
            </div>

            {/* Ngày khởi chiếu */}
            <div className="space-y-1.5">
              <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-400 block">Ngày khởi chiếu</span>
              <p className="font-semibold text-white text-sm">
                {formatDateVi(movie.releaseDate)}
              </p>
            </div>

            {/* Ngày kết thúc dự kiến */}
            <div className="space-y-1.5">
              <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-400 block">Dự kiến kết thúc</span>
              <p className="font-semibold text-white text-sm">
                {formatDateVi(movie.endDate) || 'Theo lịch chiếu của cụm rạp'}
              </p>
            </div>

            {/* Ngôn ngữ */}
            <div className="space-y-1.5">
              <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-400 block">Ngôn ngữ gốc</span>
              <p className="font-semibold text-white text-sm">
                {movie.language || 'Gốc / Quốc tế'}
              </p>
            </div>

            {/* Phụ đề / Lồng tiếng */}
            <div className="space-y-1.5">
              <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-400 block">Phụ đề & Lồng tiếng</span>
              <p className="font-semibold text-white text-sm">
                {movie.subtitleLanguage || 'Phụ đề Tiếng Việt'}
              </p>
            </div>

            {/* Phân loại độ tuổi */}
            <div className="space-y-1.5">
              <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-400 block">Phân loại độ tuổi</span>
              <div className="flex items-center gap-2">
                <span className={`px-2 py-0.5 text-[10px] font-bold rounded border uppercase ${ageInfo.badgeClass}`}>
                  {ageInfo.label}
                </span>
                <span className="font-semibold text-white text-sm">{ageInfo.shortDesc}</span>
              </div>
              <p className="text-[10px] text-neutral-400 leading-normal pt-0.5">{ageInfo.desc}</p>
            </div>
          </div>
        </div>

        {/* 3. SYNOPSIS SECTION */}
        <div className="space-y-3">
          <h2 className="text-xs font-black uppercase tracking-[0.22em] text-amber-400 pb-2 border-b border-white/10 flex items-center gap-2">
            <Film className="w-4 h-4" /> TÓM TẮT NỘI DUNG PHIM
          </h2>
          <div className="bg-neutral-950/60 border border-white/8 rounded-xl p-6 sm:p-8">
            <p className="text-sm text-neutral-200 leading-relaxed font-sans whitespace-pre-line">
              {movie.synopsis || 'Nội dung chi tiết của bộ phim đang được ban biên tập cập nhật.'}
            </p>
          </div>
        </div>

        {/* 4. CAST SECTION */}
        <div className="space-y-6">
          {/* Main Cast */}
          <div className="space-y-3">
            <h3 className="text-xs font-black uppercase tracking-[0.22em] text-amber-400 pb-2 border-b border-white/10 flex items-center gap-2">
              <User className="w-4 h-4" /> DIỄN VIÊN CHÍNH
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3.5" id="cast-list">
              {mainCasts.length === 0 ? (
                <div className="col-span-full border border-dashed border-white/10 rounded-lg p-6 text-center text-xs text-neutral-500">
                  {movie.mainActors ? `Diễn viên chính: ${movie.mainActors}` : 'Chưa có thông tin danh sách diễn viên chính.'}
                </div>
              ) : (
                mainCasts.map((cast) => (
                  <div
                    key={cast.id || cast.name}
                    className="flex items-center gap-3 bg-neutral-900/70 hover:bg-neutral-800/80 transition p-3 rounded-xl border border-white/10 hover:border-amber-500/30 group"
                  >
                    <div className="h-11 w-11 overflow-hidden rounded-full border border-amber-500/30 bg-neutral-800 flex-shrink-0">
                      {cast.avatarUrl ? (
                        <img src={cast.avatarUrl} alt={cast.name} className="h-full w-full object-cover group-hover:scale-105 transition" referrerPolicy="no-referrer" />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center text-xs font-black text-amber-400 bg-amber-950/40">
                          {cast.name.slice(0, 1)}
                        </div>
                      )}
                    </div>
                    <div className="min-w-0">
                      <h4 className="text-xs font-sans text-white truncate font-bold group-hover:text-amber-300 transition">{cast.name}</h4>
                      <p className="text-[10px] text-amber-400/80 uppercase tracking-wider truncate mt-0.5">{cast.role || 'Diễn viên chính'}</p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Supporting Cast */}
          {supportingCasts.length > 0 && (
            <div className="space-y-3 pt-2">
              <h3 className="text-xs font-black uppercase tracking-[0.22em] text-neutral-400 pb-2 border-b border-white/10 flex items-center gap-2">
                <Users className="w-4 h-4" /> CÁC DIỄN VIÊN KHÁC TRONG PHIM
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3.5" id="supporting-cast-list">
                {supportingCasts.map((cast) => (
                  <div
                    key={cast.id || cast.name}
                    className="flex items-center gap-3 bg-neutral-900/50 hover:bg-neutral-800/60 transition p-3 rounded-xl border border-white/8 group"
                  >
                    <div className="h-10 w-10 overflow-hidden rounded-full border border-white/10 bg-neutral-800 flex-shrink-0">
                      {cast.avatarUrl ? (
                        <img src={cast.avatarUrl} alt={cast.name} className="h-full w-full object-cover" referrerPolicy="no-referrer" />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center text-xs font-black text-neutral-400">
                          {cast.name.slice(0, 1)}
                        </div>
                      )}
                    </div>
                    <div className="min-w-0">
                      <h4 className="text-xs font-sans text-white truncate font-semibold">{cast.name}</h4>
                      <p className="text-[10px] text-neutral-500 uppercase tracking-wider truncate mt-0.5">{cast.role || 'Diễn viên'}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* 5. REVIEWS SECTION */}
        <div className="space-y-5 pt-2">
          <div className="border-b border-white/10 pb-2 flex items-center justify-between">
            <h3 className="text-xs font-black uppercase tracking-[0.22em] text-amber-400 flex items-center gap-2">
              <MessageSquare className="w-4 h-4" /> ĐÁNH GIÁ TỪ KHÁN GIẢ ({reviews.length})
            </h3>
            <span className="text-[11px] text-neutral-500 font-sans">100% đánh giá thực tế</span>
          </div>

          <div className="space-y-3 max-h-[420px] overflow-y-auto pr-1 [scrollbar-width:thin] [scrollbar-color:rgba(245,158,11,0.3)_transparent]">
            {isLoadingReviews && (
              <div className="flex items-center justify-center gap-2 p-8 text-xs text-neutral-500">
                <Loader2 className="h-4 w-4 animate-spin text-amber-400" /> Đang tải nhận xét khán giả...
              </div>
            )}
            {!isLoadingReviews && reviews.filter((r) => !r.status || r.status === 'VISIBLE').length === 0 && (
              <div className="border border-dashed border-white/10 rounded-xl p-8 text-center text-xs text-neutral-500 uppercase tracking-wider">
                Chưa có đánh giá công khai cho phim này. Hãy là người đầu tiên xem và đánh giá nhé!
              </div>
            )}
            {!isLoadingReviews && reviews.filter((r) => !r.status || r.status === 'VISIBLE').map((rev) => (
              <div
                key={rev.id}
                className="bg-neutral-900/60 hover:bg-neutral-900 transition p-4 rounded-xl border border-white/8 space-y-2.5"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-amber-500/20 border border-amber-500/30 text-xs font-black text-amber-300">
                      {(rev.userFullName || rev.userEmail || 'C').slice(0, 1).toUpperCase()}
                    </div>
                    <div>
                      <h4 className="text-xs text-white font-bold">{rev.userFullName || rev.userEmail || 'Khán giả CinePremier'}</h4>
                      <span className="text-[10px] text-neutral-500">
                        {rev.createdAt ? new Date(rev.createdAt).toLocaleDateString('vi-VN') : ''}
                      </span>
                    </div>
                  </div>
                  <div className="flex gap-0.5">
                    {Array.from({ length: 5 }, (_, idx) => (
                      <Star
                        key={idx}
                        className={`h-3 w-3 ${idx < rev.rating ? 'text-amber-400 fill-amber-400' : 'text-neutral-700'}`}
                      />
                    ))}
                  </div>
                </div>
                <p className="text-neutral-300 text-xs leading-relaxed font-sans pl-11">
                  "{rev.comment || ''}"
                </p>
                <div className="pl-11 pt-2 border-t border-white/5 flex items-center gap-4">
                  <button
                    onClick={() => handleLikeReview(rev.id)}
                    className={`flex items-center gap-1.5 text-[10px] transition uppercase tracking-wider ${
                      likedReviews[rev.id] ? 'text-rose-400 font-bold' : 'text-neutral-500 hover:text-white'
                    }`}
                  >
                    <Heart className={`h-3 w-3 ${likedReviews[rev.id] ? 'fill-current' : ''}`} />
                    Hữu ích ({rev.likes || 0})
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* 6. SIMILAR MOVIES (SBERT AI Recommendation) */}
        {similarMovies.length > 0 && (
          <section className="space-y-4 pt-4" id="similar-movies-section">
            <div className="border-b border-white/10 pb-2 flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-xs font-black uppercase tracking-[0.2em] text-white flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-amber-400" /> PHIM CÓ THỂ BẠN THÍCH
                </h3>
                <span className="inline-flex items-center gap-1 border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-[9px] font-mono font-bold text-amber-300 rounded">
                  AI SBERT RECOMMENDER
                </span>
              </div>
              <span className="text-[11px] text-neutral-500 hidden sm:inline">Tự động gợi ý theo nội dung, thể loại và đạo diễn</span>
            </div>

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
                          src={rec.posterUrl}
                          alt={rec.title}
                          loading="lazy"
                          className="h-full w-full object-cover opacity-85 group-hover:opacity-100 group-hover:scale-105 transition duration-500"
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
              </div>

              <button
                type="button"
                onClick={() => scrollSimilar(1)}
                aria-label="Phim sau"
                className="absolute -right-3 top-1/2 z-20 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full bg-black/80 border border-white/20 text-white/80 hover:text-white transition shadow-lg"
              >
                <ChevronRight className="h-5 w-5" />
              </button>
            </div>
          </section>
        )}
      </main>

      {/* 7. VIDEO TRAILER DIALOG MODAL WITH AI ASSISTANT */}
      {showTrailer && trailerUrl && createPortal(
        <div
          className="fixed inset-0 z-[120] flex items-center justify-center bg-black/95 p-4 transition duration-300 backdrop-blur-md"
          id="trailer-modal"
          onClick={() => setShowTrailer(false)}
        >
          <div
            id="trailer-modal-inner"
            className="relative w-full max-w-4xl border border-white/20 rounded-2xl bg-neutral-950 shadow-2xl overflow-hidden max-h-[95vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header Bar */}
            <div className="flex items-center justify-between px-5 py-3 bg-neutral-900 border-b border-white/10">
              <span className="text-xs text-neutral-300 font-sans font-bold uppercase tracking-wider flex items-center gap-2">
                <Play className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
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

            {/* Video Player */}
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

            {/* AI Assistant Chat inside Modal */}
            <div className="flex flex-col border-t border-amber-500/20 bg-neutral-950">
              {/* Header */}
              <div className="flex items-center gap-3 px-5 py-3 border-b border-white/8 bg-amber-500/[0.04]">
                <img
                  src={popcornBot}
                  alt="AI Assistant"
                  className="w-6 h-6 object-cover flex-shrink-0 rounded-full border border-amber-400/40"
                />
                <span className="text-xs font-sans font-bold text-white uppercase tracking-wider">
                  Trợ lý CinePremier AI
                </span>
                <div className="ml-auto flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  <span className="text-[10px] text-emerald-400 font-mono uppercase">Online</span>
                </div>
              </div>

              {/* Messages List */}
              <div className="px-5 py-3 space-y-3 max-h-52 overflow-y-auto">
                <div className="flex items-start gap-2.5">
                  <img
                    src={popcornBot}
                    alt="AI Assistant"
                    className="w-6 h-6 object-cover flex-shrink-0 mt-0.5 rounded-full border border-amber-400/40"
                  />
                  <div className="bg-neutral-900 border border-white/10 px-4 py-2.5 max-w-md rounded-2xl rounded-tl-sm text-xs font-sans text-neutral-200 leading-relaxed">
                    Xin chào! Bạn có thắc mắc gì về diễn biến trailer hay thông tin phim <strong className="text-amber-400">{movie.title}</strong> không?
                  </div>
                </div>
                {trailerChatMessages.map((msg, i) => (
                  <div key={i} className={`flex items-start gap-2.5 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
                    {msg.role === 'bot' && (
                      <img
                        src={popcornBot}
                        alt="AI Assistant"
                        className="w-6 h-6 object-cover flex-shrink-0 mt-0.5 rounded-full border border-amber-400/40"
                      />
                    )}
                    <div className={`px-4 py-2.5 max-w-md text-xs font-sans leading-relaxed rounded-2xl ${
                      msg.role === 'user'
                        ? 'bg-amber-500 text-black font-medium rounded-tr-sm'
                        : 'bg-neutral-900 border border-white/10 text-neutral-200 rounded-tl-sm'
                    }`}>
                      {msg.text}
                    </div>
                  </div>
                ))}
                <div ref={trailerChatEndRef} />
              </div>

              {/* Chat Input */}
              <div className="flex items-center gap-3 px-5 py-3 border-t border-white/8 bg-neutral-900/40">
                <input
                  type="text"
                  value={trailerChatInput}
                  onChange={(e) => setTrailerChatInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') handleSendTrailerChat(); }}
                  disabled={trailerChatSending}
                  placeholder={`Đặt câu hỏi về ${movie.title}...`}
                  className="flex-1 bg-neutral-800 border border-white/10 px-4 py-2 text-xs font-sans text-white placeholder-neutral-500 outline-none focus:border-amber-400 rounded-lg disabled:opacity-60"
                />
                <button
                  onClick={handleSendTrailerChat}
                  disabled={trailerChatSending || !trailerChatInput.trim()}
                  className="bg-amber-500 hover:bg-amber-400 text-black px-4 py-2 text-xs font-sans font-bold uppercase tracking-wider rounded-lg flex-shrink-0 disabled:opacity-50 transition shadow"
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
