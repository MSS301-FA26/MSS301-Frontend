import React, { useEffect, useState, useRef, useMemo, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'motion/react';
import {
  Plus, Trash2, Edit3, ShieldAlert, FileText, Database,
  Calendar, Users, DollarSign, Activity, AlertCircle, CheckCircle2,
  Search, Sliders, ChevronDown, Check, RefreshCw, Layers, ShoppingBag,
  BarChart2, Clock, MapPin, Film, Play, Eye, EyeOff, Sparkles, TrendingUp, Info, Globe, Tags, ImageUp, Video, X,
  Send, XCircle, History, Archive, ThumbsUp, ThumbsDown, BookOpen, Undo2, Globe2, Shield,
  ArrowLeft, ArrowRight
} from 'lucide-react';
import { adminService } from '../../../services/adminService';

const extractYoutubeId = (url = '') => {
  const trimmed = String(url || '').trim();
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
  } catch {}
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
  const value = String(url || '').trim().toLowerCase();
  return /\.(mp4|webm|mov)(\?|#|$)/.test(value) || value.includes('/video/upload/');
};

const getTrailerEmbedSrc = (url = '') => {
  const youtubeId = extractYoutubeId(url);
  if (youtubeId) {
    return `https://www.youtube.com/embed/${youtubeId}?autoplay=0&controls=1&rel=0`;
  }
  return url;
};

const AGE_RATING_EXPLAIN = {
  P: { label: 'P', name: 'Phổ thông (P)', desc: 'Phim được phép phổ biến đến người xem ở mọi độ tuổi.', color: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' },
  K: { label: 'K', name: 'Có giám hộ (K)', desc: 'Dưới 13 tuổi cần có người giám hộ đi kèm.', color: 'bg-blue-500/20 text-blue-400 border-blue-500/30' },
  T13: { label: 'T13', name: 'Cấm dưới 13 tuổi (13+)', desc: 'Phim được phép phổ biến đến khán giả từ đủ 13 tuổi trở lên.', color: 'bg-amber-500/20 text-amber-400 border-amber-500/30' },
  C13: { label: '13+', name: 'Cấm dưới 13 tuổi (13+)', desc: 'Phim được phép phổ biến đến khán giả từ đủ 13 tuổi trở lên.', color: 'bg-amber-500/20 text-amber-400 border-amber-500/30' },
  T16: { label: 'T16', name: 'Cấm dưới 16 tuổi (16+)', desc: 'Phim được phép phổ biến đến khán giả từ đủ 16 tuổi trở lên.', color: 'bg-orange-500/20 text-orange-400 border-orange-500/30' },
  C16: { label: '16+', name: 'Cấm dưới 16 tuổi (16+)', desc: 'Phim được phép phổ biến đến khán giả từ đủ 16 tuổi trở lên.', color: 'bg-orange-500/20 text-orange-400 border-orange-500/30' },
  T18: { label: 'T18', name: 'Cấm dưới 18 tuổi (18+)', desc: 'Phim được phép phổ biến đến khán giả từ đủ 18 tuổi trở lên.', color: 'bg-rose-500/20 text-rose-400 border-rose-500/30' },
  C18: { label: '18+', name: 'Từ đủ 18 tuổi (18+)', desc: 'Phim được phép phổ biến đến khán giả từ đủ 18 tuổi trở lên.', color: 'bg-rose-500/20 text-rose-400 border-rose-500/30' },
  C: { label: 'C', name: 'Cấm phổ biến (C)', desc: 'Phim không được phép phổ biến đến khán giả.', color: 'bg-red-950/40 text-red-500 border-red-500/50' }
};

const AGE_RATING_OPTIONS = [
  { value: 'P', label: 'P (Mọi lứa tuổi)' },
  { value: 'T13', label: 'T13 (Dưới 13 hạn chế)' },
  { value: 'T16', label: 'T16 (Dưới 16 hạn chế)' },
  { value: 'T18', label: 'T18 (Chỉ người lớn)' }
];

const formatDurationVi = (minutes) => {
  const mins = Number(minutes);
  if (!mins || isNaN(mins)) return 'Đang cập nhật';
  const hours = Math.floor(mins / 60);
  const remMins = mins % 60;
  if (hours === 0) return `${mins} phút`;
  if (remMins === 0) return `${hours} giờ (${mins} phút)`;
  return `${hours}h ${remMins}m (${mins} phút)`;
};

// Module-level helper: hooks near the top of the component use this function,
// so it must be initialized before React begins rendering the component.
const normalizeSearchText = (value) => String(value || '')
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLowerCase()
  .replace(/đ/g, 'd')
  .replace(/\s+/g, ' ')
  .trim();

const toLocalIsoDate = (date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const parseLocalIsoDate = (value) => {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value || ''));
  if (!match) return null;
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  return date.getFullYear() === Number(match[1])
    && date.getMonth() === Number(match[2]) - 1
    && date.getDate() === Number(match[3]) ? date : null;
};

const formatLocalDateVi = (value) => {
  const date = parseLocalIsoDate(value);
  if (!date) return '';
  return `${String(date.getDate()).padStart(2, '0')}/${String(date.getMonth() + 1).padStart(2, '0')}/${date.getFullYear()}`;
};

function MovieDatePicker({ value, onChange, minDate, label, hasError = false }) {
  const [isOpen, setIsOpen] = useState(false);
  const initialDate = parseLocalIsoDate(value) || parseLocalIsoDate(minDate) || new Date();
  const [visibleMonth, setVisibleMonth] = useState(() => new Date(initialDate.getFullYear(), initialDate.getMonth(), 1));
  const [position, setPosition] = useState(null);
  const triggerRef = useRef(null);
  const popoverRef = useRef(null);

  useEffect(() => {
    if (!isOpen) {
      setPosition(null);
      return undefined;
    }
    const selected = parseLocalIsoDate(value) || parseLocalIsoDate(minDate) || new Date();
    setVisibleMonth(new Date(selected.getFullYear(), selected.getMonth(), 1));

    const updatePosition = () => {
      const rect = triggerRef.current?.getBoundingClientRect();
      if (!rect) return;
      const gap = 6;
      const edge = 12;
      const width = Math.min(320, window.innerWidth - edge * 2);
      const height = 354;
      const spaceBelow = window.innerHeight - rect.bottom - edge;
      const openUp = spaceBelow < height && rect.top > spaceBelow;
      setPosition({
        width,
        left: Math.min(Math.max(edge, rect.left), window.innerWidth - width - edge),
        ...(openUp ? { bottom: window.innerHeight - rect.top + gap } : { top: rect.bottom + gap })
      });
    };
    const handlePointerDown = (event) => {
      if (triggerRef.current?.contains(event.target) || popoverRef.current?.contains(event.target)) return;
      setIsOpen(false);
    };
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        event.stopImmediatePropagation();
        setIsOpen(false);
      }
    };
    updatePosition();
    document.addEventListener('pointerdown', handlePointerDown, true);
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', updatePosition, true);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown, true);
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition, true);
    };
  }, [isOpen, value, minDate]);

  const year = visibleMonth.getFullYear();
  const month = visibleMonth.getMonth();
  const mondayOffset = (new Date(year, month, 1).getDay() + 6) % 7;
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells = [
    ...Array(mondayOffset).fill(null),
    ...Array.from({ length: daysInMonth }, (_, index) => index + 1)
  ];
  while (cells.length % 7) cells.push(null);
  const todayIso = toLocalIsoDate(new Date());

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        aria-label={label}
        aria-haspopup="dialog"
        aria-expanded={isOpen}
        onClick={() => setIsOpen((open) => !open)}
        className={`flex min-h-[36px] w-full items-center justify-between border bg-black/80 px-3 py-2 text-left font-mono text-xs transition focus:outline-none ${hasError ? 'border-rose-500 bg-rose-950/20 text-rose-200' : 'border-white/10 text-white hover:border-amber-500/60 focus:border-amber-400'}`}
      >
        <span className={value ? 'text-white' : 'text-neutral-500'}>{formatLocalDateVi(value) || 'dd/mm/yyyy'}</span>
        <Calendar className="h-4 w-4 shrink-0 text-amber-400" />
      </button>
      {isOpen && position && createPortal(
        <div ref={popoverRef} role="dialog" aria-label={`Lịch ${label}`} style={position} className="fixed z-[180] border border-amber-500/40 bg-[#0c0d12] p-3 text-white shadow-2xl shadow-black/90">
          <div className="mb-3 flex items-center justify-between">
            <button type="button" aria-label="Tháng trước" onClick={() => setVisibleMonth(new Date(year, month - 1, 1))} className="h-8 w-8 border border-white/10 text-lg text-neutral-300 hover:border-amber-400 hover:text-amber-300">‹</button>
            <strong className="text-xs uppercase tracking-wider text-amber-300">Tháng {month + 1}, {year}</strong>
            <button type="button" aria-label="Tháng sau" onClick={() => setVisibleMonth(new Date(year, month + 1, 1))} className="h-8 w-8 border border-white/10 text-lg text-neutral-300 hover:border-amber-400 hover:text-amber-300">›</button>
          </div>
          <div className="grid grid-cols-7 gap-1 text-center text-[10px] font-bold text-neutral-400">
            {['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'].map((day) => <span key={day} className="py-1">{day}</span>)}
            {cells.map((day, index) => {
              if (!day) return <span key={`empty-${index}`} className="h-8" />;
              const iso = toLocalIsoDate(new Date(year, month, day));
              const disabled = Boolean(minDate && iso < minDate);
              const selected = iso === value;
              const today = iso === todayIso;
              return (
                <button key={iso} type="button" disabled={disabled} aria-label={`${String(day).padStart(2, '0')}/${String(month + 1).padStart(2, '0')}/${year}`} onClick={() => { onChange(iso); setIsOpen(false); }} className={`h-8 border text-xs transition ${selected ? 'border-amber-400 bg-amber-400 font-black text-black' : today ? 'border-amber-500/50 text-amber-300' : 'border-transparent text-neutral-200 hover:border-white/20 hover:bg-white/10'} disabled:cursor-not-allowed disabled:text-neutral-700 disabled:hover:border-transparent disabled:hover:bg-transparent`}>
                  {day}
                </button>
              );
            })}
          </div>
          <div className="mt-3 flex items-center justify-between border-t border-white/10 pt-2">
            <button type="button" onClick={() => { onChange(''); setIsOpen(false); }} className="px-2 py-1 text-[10px] font-bold uppercase text-neutral-400 hover:text-rose-300">Xóa</button>
            <button type="button" disabled={Boolean(minDate && todayIso < minDate)} onClick={() => { onChange(todayIso); setIsOpen(false); }} className="px-2 py-1 text-[10px] font-bold uppercase text-amber-300 hover:text-amber-200 disabled:cursor-not-allowed disabled:text-neutral-700">Hôm nay</button>
          </div>
        </div>,
        document.body
      )}
    </>
  );
}

export default function AdminMoviesPanel({ ctx }) {
  const {
    activeTab,
    setActiveTab,
    activeChartPoint,
    setActiveChartPoint,
    searchQuery,
    setSearchQuery,
    filmFilter,
    setFilmFilter,
    adminGenreFilter,
    setAdminGenreFilter,
    adminMoviePagination,
    setAdminMoviePagination,
    editingMovie,
    setEditingMovie,
    showMovieForm,
    setShowMovieForm,
    isMovieSaving,
    formData,
    setFormData,
    resetMovieForm,
    newShowtime,
    setNewShowtime,
    isAddingShowtime,
    setIsAddingShowtime,
    showtimeSuccessMessage,
    setShowtimeSuccessMessage,
    genres,
    setGenres,
    actors,
    setActors,
    genreSearch,
    setGenreSearch,
    genreForm,
    setGenreForm,
    genreErrors,
    setGenreErrors,
    editingGenreId,
    setEditingGenreId,
    isGenreLoading,
    setIsGenreLoading,
    isGenreSaving,
    setIsGenreSaving,
    foodItems,
    setFoodItems,
    foodCombos,
    setFoodCombos,
    foodSearch,
    setFoodSearch,
    foodKind,
    setFoodKind,
    editingFood,
    setEditingFood,
    foodForm,
    setFoodForm,
    foodErrors,
    setFoodErrors,
    isFoodLoading,
    setIsFoodLoading,
    isFoodSaving,
    setIsFoodSaving,
    visibleFoods,
    HALL_OPTIONS,
    TIME_OPTIONS,
    playPulseSound,
    auditLogs,
    setAuditLogs,
    addAuditLog,
    resetFoodForm,
    validateFoodForm,
    fetchFoods,
    handleFoodSubmit,
    handleEditFood,
    handleToggleFoodStatus,
    getAdminToken,
    changeAdminSection,
    validateGenreForm,
    fetchGenres,
    fetchActors,
    resetGenreForm,
    handleGenreSubmit,
    handleEditGenre,
    performDeleteGenre,
    handleDeleteGenre,
    totalBookingsCount,
    calculatedRevenue,
    averageFillRate,
    handleEditMovie,
    handleCreateMovieSubmit,
    handleUpdateMovieStatus,
    handleDeleteMovie,
    handleSubmitMovieForApproval,
    handleWithdrawMovieApproval,
    handleApproveMovie,
    handleRejectMovie,
    handlePublishMovie,
    handleUnpublishMovie,
    handleArchiveMovie,
    handleUnarchiveMovie,
    handleFetchApprovalHistory,
    handleAddShowtimeSubmit,
    handleRefundTicket,
    filteredMovies,
    filteredGenres,
    moviesList,
    setMoviesList,
    bookedTickets,
    setBookedTickets,
    onSelectMovie,
    showToast,
    initialSection,
    onSectionChange,
    onFoodCatalogChanged,
    isAdmin,
    currentUser
  } = ctx;

  const [actorForm, setActorForm] = useState({ name: '', biography: '', avatarUrl: '' });
  const [isActorSaving, setIsActorSaving] = useState(false);
  const [isActorImageUploading, setIsActorImageUploading] = useState(false);
  const [isPosterUploading, setIsPosterUploading] = useState(false);
  const [isBannerUploading, setIsBannerUploading] = useState(false);
  const [isTrailerUploading, setIsTrailerUploading] = useState(false);
  const [createdActors, setCreatedActors] = useState([]);
  const [isDirectorDropdownOpen, setIsDirectorDropdownOpen] = useState(false);
  const [directorPickerSearch, setDirectorPickerSearch] = useState('');
  const directorTriggerRef = useRef(null);
  const directorDropdownRef = useRef(null);
  const [directorDropdownPosition, setDirectorDropdownPosition] = useState(null);
  const [isGenreDropdownOpen, setIsGenreDropdownOpen] = useState(false);
  const [genrePickerSearch, setGenrePickerSearch] = useState('');
  const genreTriggerRef = useRef(null);
  const genreDropdownRef = useRef(null);
  const [genreDropdownPosition, setGenreDropdownPosition] = useState(null);
  const [isActorDropdownOpen, setIsActorDropdownOpen] = useState(false);
  const [actorPickerSearch, setActorPickerSearch] = useState('');
  const actorTriggerRef = useRef(null);
  const actorDropdownRef = useRef(null);
  const [actorDropdownPosition, setActorDropdownPosition] = useState(null);
  const [isAgeRatingDropdownOpen, setIsAgeRatingDropdownOpen] = useState(false);
  const ageRatingTriggerRef = useRef(null);
  const ageRatingDropdownRef = useRef(null);
  const [ageRatingDropdownPosition, setAgeRatingDropdownPosition] = useState(null);
  const [hasAttemptedNextStep, setHasAttemptedNextStep] = useState(false);
  const isMovieMediaUploading = isPosterUploading || isBannerUploading || isTrailerUploading;
  const [mediaReviewModal, setMediaReviewModal] = useState(null);
  const [rejectModal, setRejectModal] = useState(null); // { movie, reason }
  const [approvalHistoryModal, setApprovalHistoryModal] = useState(null); // { movie, history: [] }
  const [isHistoryLoading, setIsHistoryLoading] = useState(false);
  const [movieDetailModal, setMovieDetailModal] = useState(null);
  const [isDetailModalLoading, setIsDetailModalLoading] = useState(false);
  const [movieFormStep, setMovieFormStep] = useState(1);

  const movieFormSteps = [
    { id: 1, label: 'Thông tin phim', description: 'Nội dung và lịch chiếu' },
    { id: 2, label: 'Diễn viên & media', description: 'Dàn cast và hình ảnh' },
    { id: 3, label: 'Kiểm tra & đăng', description: 'Rà soát lần cuối' }
  ];

  const handleOpenMovieDetailModal = async (mv) => {
    if (!mv) return;
    const movieId = mv.backendId ?? mv.id;
    setMovieDetailModal({ ...mv });
    setIsDetailModalLoading(true);
    try {
      const token = getAdminToken?.();
      if (token && typeof movieId === 'number') {
        const freshDetail = await adminService.getAdminMovieDetail(token, movieId);
        if (freshDetail) {
          setMovieDetailModal((prev) => (prev && (prev.id === mv.id || prev.backendId === mv.backendId) ? { ...prev, ...freshDetail } : prev));
        }
      }
    } catch (err) {
      console.warn('Could not fetch fresh detail for admin modal:', err);
    } finally {
      setIsDetailModalLoading(false);
    }
  };

  const DRAFTS_STORAGE_KEY = 'cinema_admin_movie_drafts';

  const hasDraftContent = (data) => {
    if (!data) return false;
    return Boolean(
      String(data.title || '').trim() ||
      String(data.englishTitle || '').trim() ||
      String(data.synopsis || '').trim() ||
      String(data.director || '').trim() ||
      data.posterUrl ||
      data.bannerUrl ||
      data.trailerUrl ||
      (data.genreIds && data.genreIds.length > 0) ||
      (data.actorIds && data.actorIds.length > 0)
    );
  };

  const getStoredDrafts = () => {
    try {
      const raw = localStorage.getItem(DRAFTS_STORAGE_KEY);
      let drafts = [];
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) drafts = parsed;
      }
      // Backward compatibility: migrate legacy single draft if found
      const legacyRaw = localStorage.getItem('cinema_admin_movie_draft');
      if (legacyRaw) {
        const legacy = JSON.parse(legacyRaw);
        if (legacy && legacy.formData && hasDraftContent(legacy.formData)) {
          drafts = [
            {
              id: 'draft_' + Date.now(),
              formData: legacy.formData,
              editingMovie: null,
              savedAt: legacy.savedAt || new Date().toISOString()
            },
            ...drafts
          ];
        }
        localStorage.removeItem('cinema_admin_movie_draft');
      }

      // Ensure each draft has an ID and deduplicate identical drafts by title/id
      const seenTitles = new Set();
      const seenIds = new Set();
      const cleanDrafts = [];
      for (let i = 0; i < drafts.length; i++) {
        const d = drafts[i];
        if (!d || !d.formData || !hasDraftContent(d.formData)) continue;
        const id = d.id || `draft_${Date.now()}_${i}`;
        const item = { ...d, id };
        const normTitle = String(item.formData?.title || '').trim().toLowerCase();

        if (seenIds.has(item.id)) continue;
        if (normTitle && seenTitles.has(normTitle)) continue;

        if (item.id) seenIds.add(item.id);
        if (normTitle) seenTitles.add(normTitle);
        cleanDrafts.push(item);
      }

      if (cleanDrafts.length !== drafts.length) {
        localStorage.setItem(DRAFTS_STORAGE_KEY, JSON.stringify(cleanDrafts));
      }
      return cleanDrafts;
    } catch {
      return [];
    }
  };

  const formatDraftTime = (isoString) => {
    if (!isoString) return '';
    try {
      const d = new Date(isoString);
      return (
        d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }) +
        ' ' +
        d.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' })
      );
    } catch {
      return '';
    }
  };

  const [draftList, setDraftList] = useState(() => getStoredDrafts());
  const [activeDraftId, setActiveDraftId] = useState(null);
  const activeDraftIdRef = useRef(null);

  // Sync drafts whenever showMovieForm closes or changes
  useEffect(() => {
    setDraftList(getStoredDrafts());
  }, [showMovieForm]);

  // Auto-save draft when editing in form (only for new movies, not editing existing published movies)
  useEffect(() => {
    if (!showMovieForm || editingMovie) return undefined;
    if (!hasDraftContent(formData)) return undefined;

    const timer = window.setTimeout(() => {
      const currentDrafts = getStoredDrafts();
      const currentDraftId = activeDraftIdRef.current;
      
      let existingIndex = currentDraftId ? currentDrafts.findIndex((d) => d.id === currentDraftId) : -1;
      const normTitle = String(formData.title || '').trim().toLowerCase();
      if (existingIndex < 0 && normTitle) {
        existingIndex = currentDrafts.findIndex((d) => String(d.formData?.title || '').trim().toLowerCase() === normTitle);
      }

      const targetId = existingIndex >= 0 ? currentDrafts[existingIndex].id : (currentDraftId || ('draft_' + Date.now()));
      if (!currentDraftId) {
        activeDraftIdRef.current = targetId;
        setActiveDraftId(targetId);
      }

      const targetMovieId = editingMovie ? getMovieId(editingMovie) : (formData?.backendId || formData?.id || null);
      const draftObj = {
        id: targetId,
        formData,
        targetMovieId,
        editingMovie: editingMovie || null,
        savedAt: new Date().toISOString()
      };

      let updatedDrafts;
      if (existingIndex >= 0) {
        updatedDrafts = [...currentDrafts];
        updatedDrafts[existingIndex] = draftObj;
      } else {
        updatedDrafts = [draftObj, ...currentDrafts];
      }

      // Deduplicate
      const seenTitles = new Set();
      const seenIds = new Set();
      const dedupedDrafts = [];
      for (const d of updatedDrafts) {
        const t = String(d.formData?.title || '').trim().toLowerCase();
        if (d.id && seenIds.has(d.id)) continue;
        if (t && seenTitles.has(t)) continue;
        if (d.id) seenIds.add(d.id);
        if (t) seenTitles.add(t);
        dedupedDrafts.push(d);
      }

      try {
        localStorage.setItem(DRAFTS_STORAGE_KEY, JSON.stringify(dedupedDrafts));
        setDraftList(dedupedDrafts);
      } catch (err) {
        console.error('Failed to save drafts:', err);
      }
    }, 500);

    return () => window.clearTimeout(timer);
  }, [formData, editingMovie, showMovieForm]);

  const handleCloseMovieForm = () => {
    playPulseSound?.(300, 'sine', 0.05);
    
    // Only save as draft if we are adding a new movie, not editing an already published catalog movie
    if (!editingMovie && hasDraftContent(formData)) {
      const currentDrafts = getStoredDrafts();
      const currentDraftId = activeDraftIdRef.current;
      
      let existingIndex = currentDraftId ? currentDrafts.findIndex((d) => d.id === currentDraftId) : -1;
      const normTitle = String(formData.title || '').trim().toLowerCase();
      if (existingIndex < 0 && normTitle) {
        existingIndex = currentDrafts.findIndex((d) => String(d.formData?.title || '').trim().toLowerCase() === normTitle);
      }

      const targetId = existingIndex >= 0 ? currentDrafts[existingIndex].id : (currentDraftId || ('draft_' + Date.now()));
      const targetMovieId = editingMovie ? getMovieId(editingMovie) : (formData?.backendId || formData?.id || null);
      const draftObj = {
        id: targetId,
        formData,
        targetMovieId,
        editingMovie: editingMovie || null,
        savedAt: new Date().toISOString()
      };

      let updatedDrafts;
      if (existingIndex >= 0) {
        updatedDrafts = [...currentDrafts];
        updatedDrafts[existingIndex] = draftObj;
      } else {
        updatedDrafts = [draftObj, ...currentDrafts];
      }

      // Deduplicate
      const seenTitles = new Set();
      const seenIds = new Set();
      const dedupedDrafts = [];
      for (const d of updatedDrafts) {
        const t = String(d.formData?.title || '').trim().toLowerCase();
        if (d.id && seenIds.has(d.id)) continue;
        if (t && seenTitles.has(t)) continue;
        if (d.id) seenIds.add(d.id);
        if (t) seenTitles.add(t);
        dedupedDrafts.push(d);
      }

      try {
        localStorage.setItem(DRAFTS_STORAGE_KEY, JSON.stringify(dedupedDrafts));
        setDraftList(dedupedDrafts);
        showToast?.('Đã lưu vào danh mục Bản nháp.');
      } catch (err) {
        console.error('Failed to save drafts:', err);
      }
    }

    activeDraftIdRef.current = null;
    setActiveDraftId(null);
    setMovieFormStep(1);
    resetMovieForm();
    setShowMovieForm(false);
  };

  const handleResumeDraft = (draft) => {
    playPulseSound?.(600, 'sine', 0.1);
    if (draft?.formData) {
      setFormData(draft.formData);
      const existingId = draft.targetMovieId || draft.editingMovie?.id || draft.formData?.id || draft.formData?.backendId;
      const matchedMovie = existingId ? (moviesList || []).find(m => String(getMovieId(m)) === String(existingId)) : null;
      if (typeof setEditingMovie === 'function') {
        setEditingMovie(matchedMovie || draft.editingMovie || null);
      }
      activeDraftIdRef.current = draft.id;
      setActiveDraftId(draft.id);
    }
    setMovieFormStep(1);
    setShowMovieForm(true);
  };

  const handleDeleteDraft = (draftId) => {
    playPulseSound?.(300, 'sine', 0.05);
    const updated = draftList.filter((d) => d.id !== draftId);
    try {
      localStorage.setItem(DRAFTS_STORAGE_KEY, JSON.stringify(updated));
    } catch {}
    setDraftList(updated);
    if (activeDraftIdRef.current === draftId) {
      activeDraftIdRef.current = null;
      setActiveDraftId(null);
    }
    showToast?.('Đã xóa bản nháp thành công.');
  };

  const handleStartCreateMovie = () => {
    playPulseSound?.(600, 'sine', 0.1);
    resetMovieForm();
    if (typeof setEditingMovie === 'function') {
      setEditingMovie(null);
    }
    activeDraftIdRef.current = null;
    setActiveDraftId(null);
    setMovieFormStep(1);
    setShowMovieForm(true);
  };

  const toggleDirectorDropdown = () => {
    setIsGenreDropdownOpen(false);
    setIsActorDropdownOpen(false);
    setIsAgeRatingDropdownOpen(false);
    setIsDirectorDropdownOpen((prev) => !prev);
  };

  const toggleGenreDropdown = () => {
    setIsDirectorDropdownOpen(false);
    setIsActorDropdownOpen(false);
    setIsAgeRatingDropdownOpen(false);
    setIsGenreDropdownOpen((prev) => !prev);
  };

  const toggleActorDropdown = () => {
    setIsDirectorDropdownOpen(false);
    setIsGenreDropdownOpen(false);
    setIsAgeRatingDropdownOpen(false);
    setIsActorDropdownOpen((prev) => !prev);
  };

  const toggleAgeRatingDropdown = () => {
    setIsDirectorDropdownOpen(false);
    setIsGenreDropdownOpen(false);
    setIsActorDropdownOpen(false);
    setIsAgeRatingDropdownOpen((prev) => !prev);
  };

  const goToMovieFormStep = (step) => {
    setIsDirectorDropdownOpen(false);
    setIsActorDropdownOpen(false);
    setIsGenreDropdownOpen(false);
    setIsAgeRatingDropdownOpen(false);
    setMovieFormStep(Math.min(3, Math.max(1, step)));
  };

  const filteredGenreOptions = useMemo(() => {
    const q = normalizeSearchText(genrePickerSearch);
    if (!q) return genres;
    return genres.filter((g) => normalizeSearchText(g.name || '').includes(q));
  }, [genres, genrePickerSearch]);

  const selectedGenreObjects = useMemo(() => {
    const ids = (formData.genreIds || []).map(Number);
    return genres.filter((g) => ids.includes(Number(g.id)));
  }, [genres, formData.genreIds]);

  const clearAllGenres = () => {
    setFormData((prev) => ({
      ...prev,
      genreIds: [],
      genre: ''
    }));
  };

  // Helper resolving movie id
  const getMovieId = (movie) => movie?.backendId ?? movie?.id ?? movie?.raw?.id ?? movie?.raw?.movieId;

  // Title duplicate detection
  const normalizedInputTitle = String(formData.title || '').trim().toLowerCase();
  const currentEditingMovieId = editingMovie ? getMovieId(editingMovie) : null;
  const currentActiveDraftId = activeDraftIdRef.current || activeDraftId;

  const duplicateMovieInSystem = Boolean(
    normalizedInputTitle &&
    (moviesList || []).some((m) => {
      const mId = getMovieId(m);
      if (currentEditingMovieId && String(mId) === String(currentEditingMovieId)) return false;
      return String(m.title || '').trim().toLowerCase() === normalizedInputTitle;
    })
  );

  const duplicateMovieInDrafts = Boolean(
    normalizedInputTitle &&
    draftList.some((d) => {
      if (currentActiveDraftId && String(d.id) === String(currentActiveDraftId)) return false;
      return String(d.formData?.title || '').trim().toLowerCase() === normalizedInputTitle;
    })
  );

  const isDuplicateTitle = duplicateMovieInSystem || duplicateMovieInDrafts;

  const validateStep1 = (showError = true) => {
    const title = String(formData.title || '').trim();
    if (!title) {
      if (showError) showToast?.('Vui lòng nhập tên tác phẩm (tiếng Việt).');
      return false;
    }
    if (isDuplicateTitle) {
      if (showError) showToast?.('Tên phim đã tồn tại trong hệ thống hoặc danh mục bản nháp. Vui lòng đổi tên khác!');
      return false;
    }
    const englishTitle = String(formData.englishTitle || '').trim();
    if (!englishTitle) {
      if (showError) showToast?.('Vui lòng nhập tên tiếng Anh hoặc tiêu đề gốc.');
      return false;
    }
    const director = String(formData.director || '').trim();
    if (!director) {
      if (showError) showToast?.('Vui lòng chọn hoặc nhập ít nhất một đạo diễn.');
      return false;
    }
    const duration = Number(formData.duration);
    if (!duration || duration < 60 || duration > 180) {
      if (showError) showToast?.('Thời lượng phim phải từ 60 đến 180 phút.');
      return false;
    }
    const genreIds = formData.genreIds || [];
    if (genreIds.length === 0) {
      if (showError) showToast?.('Vui lòng chọn ít nhất một thể loại phim.');
      return false;
    }
    if (!formData.releaseDate) {
      if (showError) showToast?.('Vui lòng chọn ngày bắt đầu chiếu.');
      return false;
    }
    if (!editingMovie && formData.releaseDate < toLocalIsoDate(new Date())) {
      if (showError) showToast?.('Ngày bắt đầu chiếu không được là ngày trong quá khứ.');
      return false;
    }
    if (!formData.endDate) {
      if (showError) showToast?.('Vui lòng chọn ngày kết thúc chiếu.');
      return false;
    }
    if (formData.endDate < formData.releaseDate) {
      if (showError) showToast?.('Ngày kết thúc chiếu phải bằng hoặc sau ngày bắt đầu chiếu.');
      return false;
    }
    const language = String(formData.language || '').trim();
    if (!language) {
      if (showError) showToast?.('Vui lòng nhập ngôn ngữ phim.');
      return false;
    }
    const subtitleLanguage = String(formData.subtitleLanguage || '').trim();
    if (!subtitleLanguage) {
      if (showError) showToast?.('Vui lòng nhập phụ đề phim.');
      return false;
    }
    return true;
  };

  const validateStep2 = (showError = true) => {
    const actorIds = formData.actorIds || [];
    if (actorIds.length === 0) {
      if (showError) showToast?.('Vui lòng chọn ít nhất một diễn viên cho phim.');
      return false;
    }
    if (!String(formData.trailerUrl || '').trim()) {
      if (showError) showToast?.('Vui lòng tải lên Trailer (Video) của phim.');
      return false;
    }
    if (!String(formData.posterUrl || '').trim()) {
      if (showError) showToast?.('Vui lòng tải lên Poster đứng (tỷ lệ 2:3) của phim.');
      return false;
    }
    if (!String(formData.bannerUrl || '').trim()) {
      if (showError) showToast?.('Vui lòng tải lên Banner ngang (tỷ lệ 16:9) của phim.');
      return false;
    }
    return true;
  };

  const validateStep3 = (showError = true) => {
    if (!String(formData.synopsis || '').trim()) {
      if (showError) showToast?.('Vui lòng nhập nội dung tóm tắt phim trước khi xuất bản.');
      return false;
    }
    return true;
  };

  const handleNextStep = () => {
    setHasAttemptedNextStep(true);
    if (movieFormStep === 1) {
      if (!validateStep1(true)) {
        playPulseSound?.(200, 'sine', 0.1);
        return;
      }
      setHasAttemptedNextStep(false);
      goToMovieFormStep(2);
    } else if (movieFormStep === 2) {
      if (!validateStep2(true)) {
        playPulseSound?.(200, 'sine', 0.1);
        return;
      }
      setHasAttemptedNextStep(false);
      goToMovieFormStep(3);
    }
  };

  const onMovieSubmit = async (e) => {
    e.preventDefault();
    if (!validateStep1(true)) {
      goToMovieFormStep(1);
      setHasAttemptedNextStep(true);
      playPulseSound?.(200, 'sine', 0.1);
      return;
    }
    if (!validateStep2(true)) {
      goToMovieFormStep(2);
      setHasAttemptedNextStep(true);
      playPulseSound?.(200, 'sine', 0.1);
      return;
    }
    if (!validateStep3(true)) {
      setHasAttemptedNextStep(true);
      playPulseSound?.(200, 'sine', 0.1);
      return;
    }
    const currentId = activeDraftIdRef.current || activeDraftId;
    const currentTitle = String(formData.title || '').trim().toLowerCase();
    await handleCreateMovieSubmit(e);
    
    // Clean up draft by id and by title
    const remaining = getStoredDrafts().filter((d) => {
      if (currentId && d.id === currentId) return false;
      if (currentTitle && String(d.formData?.title || '').trim().toLowerCase() === currentTitle) return false;
      return true;
    });
    try {
      localStorage.setItem(DRAFTS_STORAGE_KEY, JSON.stringify(remaining));
    } catch {}
    setDraftList(remaining);
    activeDraftIdRef.current = null;
    setActiveDraftId(null);
  };

  const displayedDrafts = draftList.filter((d) => {
    const f = d.formData || {};
    const q = (searchQuery || '').trim().toLowerCase();
    if (!q) return true;
    return (
      (f.title || '').toLowerCase().includes(q) ||
      (f.englishTitle || '').toLowerCase().includes(q) ||
      (f.director || '').toLowerCase().includes(q)
    );
  });

  useEffect(() => {
    if (!isDirectorDropdownOpen || typeof fetchActors !== 'function') return undefined;
    const timeoutId = window.setTimeout(() => {
      fetchActors(directorPickerSearch.trim());
    }, 300);
    return () => window.clearTimeout(timeoutId);
  }, [isDirectorDropdownOpen, directorPickerSearch, fetchActors]);

  useEffect(() => {
    if (!isDirectorDropdownOpen) {
      setDirectorDropdownPosition(null);
      return undefined;
    }

    const updatePosition = () => {
      const trigger = directorTriggerRef.current;
      if (!trigger) return;
      const rect = trigger.getBoundingClientRect();
      const viewportGap = 12;
      const dropdownGap = 6;
      const estimatedDropdownHeight = 258;
      const spaceBelow = window.innerHeight - rect.bottom - viewportGap;
      const shouldOpenUp = spaceBelow < estimatedDropdownHeight && rect.top > spaceBelow;

      setDirectorDropdownPosition({
        left: Math.max(viewportGap, rect.left),
        width: Math.min(rect.width, window.innerWidth - (viewportGap * 2)),
        ...(shouldOpenUp
          ? { bottom: window.innerHeight - rect.top + dropdownGap }
          : { top: rect.bottom + dropdownGap })
      });
    };

    const handlePointerDown = (event) => {
      if (directorTriggerRef.current?.contains(event.target)) return;
      if (directorDropdownRef.current?.contains(event.target)) return;
      setIsDirectorDropdownOpen(false);
    };

    updatePosition();
    document.addEventListener('pointerdown', handlePointerDown, true);
    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', updatePosition, true);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown, true);
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition, true);
    };
  }, [isDirectorDropdownOpen]);

  useEffect(() => {
    if (!isGenreDropdownOpen) {
      setGenreDropdownPosition(null);
      return undefined;
    }

    const updatePosition = () => {
      const trigger = genreTriggerRef.current;
      if (!trigger) return;
      const rect = trigger.getBoundingClientRect();
      const viewportGap = 12;
      const dropdownGap = 6;
      const estimatedDropdownHeight = 218;
      const spaceBelow = window.innerHeight - rect.bottom - viewportGap;
      const shouldOpenUp = spaceBelow < estimatedDropdownHeight && rect.top > spaceBelow;

      setGenreDropdownPosition({
        left: Math.max(viewportGap, rect.left),
        width: Math.min(rect.width, window.innerWidth - (viewportGap * 2)),
        ...(shouldOpenUp
          ? { bottom: window.innerHeight - rect.top + dropdownGap }
          : { top: rect.bottom + dropdownGap })
      });
    };

    const handlePointerDown = (event) => {
      if (genreTriggerRef.current?.contains(event.target)) return;
      if (genreDropdownRef.current?.contains(event.target)) return;
      setIsGenreDropdownOpen(false);
    };

    updatePosition();
    document.addEventListener('pointerdown', handlePointerDown, true);
    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', updatePosition, true);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown, true);
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition, true);
    };
  }, [isGenreDropdownOpen]);

  useEffect(() => {
    if (!isActorDropdownOpen) {
      setActorDropdownPosition(null);
      return undefined;
    }

    const updatePosition = () => {
      const trigger = actorTriggerRef.current;
      if (!trigger) return;
      const rect = trigger.getBoundingClientRect();
      const viewportGap = 12;
      const dropdownGap = 6;
      const estimatedDropdownHeight = 240;
      const spaceBelow = window.innerHeight - rect.bottom - viewportGap;
      const shouldOpenUp = spaceBelow < estimatedDropdownHeight && rect.top > spaceBelow;

      setActorDropdownPosition({
        left: Math.max(viewportGap, rect.left),
        width: Math.min(rect.width, window.innerWidth - (viewportGap * 2)),
        ...(shouldOpenUp
          ? { bottom: window.innerHeight - rect.top + dropdownGap }
          : { top: rect.bottom + dropdownGap })
      });
    };

    const handlePointerDown = (event) => {
      if (actorTriggerRef.current?.contains(event.target)) return;
      if (actorDropdownRef.current?.contains(event.target)) return;
      setIsActorDropdownOpen(false);
    };

    updatePosition();
    document.addEventListener('pointerdown', handlePointerDown, true);
    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', updatePosition, true);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown, true);
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition, true);
    };
  }, [isActorDropdownOpen]);

  useEffect(() => {
    if (!isAgeRatingDropdownOpen) {
      setAgeRatingDropdownPosition(null);
      return undefined;
    }

    const updatePosition = () => {
      const trigger = ageRatingTriggerRef.current;
      if (!trigger) return;
      const rect = trigger.getBoundingClientRect();
      const viewportGap = 12;
      const dropdownGap = 6;
      const estimatedDropdownHeight = 152;
      const spaceBelow = window.innerHeight - rect.bottom - viewportGap;
      const shouldOpenUp = spaceBelow < estimatedDropdownHeight && rect.top > spaceBelow;
      setAgeRatingDropdownPosition({
        left: Math.max(viewportGap, rect.left),
        width: Math.min(rect.width, window.innerWidth - (viewportGap * 2)),
        ...(shouldOpenUp
          ? { bottom: window.innerHeight - rect.top + dropdownGap }
          : { top: rect.bottom + dropdownGap })
      });
    };

    const handlePointerDown = (event) => {
      if (ageRatingTriggerRef.current?.contains(event.target)) return;
      if (ageRatingDropdownRef.current?.contains(event.target)) return;
      setIsAgeRatingDropdownOpen(false);
    };

    updatePosition();
    document.addEventListener('pointerdown', handlePointerDown, true);
    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', updatePosition, true);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown, true);
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition, true);
    };
  }, [isAgeRatingDropdownOpen]);

  // Đóng modal khi nhấn phím Escape
  useEffect(() => {
    if (!showMovieForm && !mediaReviewModal) return undefined;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        if (isAgeRatingDropdownOpen) {
          setIsAgeRatingDropdownOpen(false);
          return;
        }
        if (isActorDropdownOpen) {
          setIsActorDropdownOpen(false);
          return;
        }
        if (isDirectorDropdownOpen) {
          setIsDirectorDropdownOpen(false);
          return;
        }
        if (isGenreDropdownOpen) {
          setIsGenreDropdownOpen(false);
          return;
        }
        if (mediaReviewModal) {
          setMediaReviewModal(null);
          return;
        }
        handleCloseMovieForm();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showMovieForm, mediaReviewModal, isAgeRatingDropdownOpen, isActorDropdownOpen, isDirectorDropdownOpen, isGenreDropdownOpen, handleCloseMovieForm]);

  const hasReleaseDatePassed = (value) => {
    if (!value) return false;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const releaseDate = new Date(value);
    releaseDate.setHours(0, 0, 0, 0);
    return !Number.isNaN(releaseDate.getTime()) && releaseDate < today;
  };

  const todayInputValue = (() => {
    return toLocalIsoDate(new Date());
  })();

  const resolveMovieStatusFromDates = (releaseDateValue, endDateValue) => {
    if (!parseLocalIsoDate(releaseDateValue) || !parseLocalIsoDate(endDateValue)) return 'UPCOMING';
    const today = toLocalIsoDate(new Date());
    if (today < releaseDateValue) return 'UPCOMING';
    if (today > endDateValue) return 'ENDED';
    return 'NOW_SHOWING';
  };

  const statusRank = (status) => ({ UPCOMING: 0, NOW_SHOWING: 1, ENDED: 2 }[String(status || '').toUpperCase()] ?? -1);

  const isBackwardStatus = (currentStatus, requestedStatus) => {
    const currentRank = statusRank(currentStatus);
    const requestedRank = statusRank(requestedStatus);
    return currentRank >= 0 && requestedRank >= 0 && requestedRank < currentRank;
  };

  const isMovieStatusOptionDisabled = (movie, requestedStatus) => {
    if (requestedStatus === 'INACTIVE') return false;
    if (!hasReleaseDatePassed(movie?.releaseDate)) return false;
    return requestedStatus === 'UPCOMING' || isBackwardStatus(movie?.status, requestedStatus);
  };

  const toggleMovieGenre = (genreId) => {
    const normalizedId = Number(genreId);
    const currentIds = formData.genreIds || [];
    const nextGenreIds = currentIds.includes(normalizedId)
      ? currentIds.filter((id) => id !== normalizedId)
      : [...currentIds, normalizedId];
    const nextGenreNames = genres
      .filter((genre) => nextGenreIds.includes(Number(genre.id)))
      .map((genre) => genre.name)
      .join(', ');

    setFormData({
      ...formData,
      genreIds: nextGenreIds,
      genre: nextGenreNames
    });
  };

  const toggleMovieActor = (actorId) => {
    const id = Number(actorId);
    const actorIds = (formData.actorIds || []).map(Number);
    const selected = actorIds.includes(id);
    setFormData({
      ...formData,
      actorIds: selected ? actorIds.filter((item) => item !== id) : [...actorIds, id],
      mainActorIds: selected
        ? (formData.mainActorIds || []).map(Number).filter((item) => item !== id)
        : formData.mainActorIds || []
    });
  };

  const toggleMovieMainActor = (actorId) => {
    const id = Number(actorId);
    const actorIds = (formData.actorIds || []).map(Number);
    const mainActorIds = (formData.mainActorIds || []).map(Number);
    setFormData({
      ...formData,
      actorIds: actorIds.includes(id) ? actorIds : [...actorIds, id],
      mainActorIds: mainActorIds.includes(id)
        ? mainActorIds.filter((item) => item !== id)
        : [...mainActorIds, id]
    });
  };

  const fuzzyIncludes = (source, query) => {
    const normalizedSource = normalizeSearchText(source);
    const normalizedQuery = normalizeSearchText(query);
    if (!normalizedQuery) return true;
    if (normalizedSource.includes(normalizedQuery)) return true;
    let cursor = 0;
    for (const char of normalizedQuery) {
      cursor = normalizedSource.indexOf(char, cursor);
      if (cursor === -1) return false;
      cursor += 1;
    }
    return true;
  };

  const splitDirectorNames = (value) => String(value || '')
    .split(/[,\n;/]+/)
    .map((item) => item.trim())
    .filter(Boolean);

  const uppercaseMovieTitle = (value) => String(value || '').toLocaleUpperCase('vi-VN');

  const uniqueByName = (names) => {
    const seen = new Set();
    return names.filter((name) => {
      const key = normalizeSearchText(name);
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  };

  const selectedDirectorNames = uniqueByName(splitDirectorNames(formData.director));
  const getActorDisplayName = (actor) => actor?.name || actor?.fullName || actor?.actorName || actor?.raw?.name || '';
  const directorOptions = uniqueByName([
    ...selectedDirectorNames,
    ...(actors || []).map(getActorDisplayName).filter(Boolean)
  ])
    .filter((name) => fuzzyIncludes(name, directorPickerSearch))
    .sort((left, right) => {
      const leftSelected = selectedDirectorNames.some((name) => normalizeSearchText(name) === normalizeSearchText(left)) ? 0 : 1;
      const rightSelected = selectedDirectorNames.some((name) => normalizeSearchText(name) === normalizeSearchText(right)) ? 0 : 1;
      if (leftSelected !== rightSelected) return leftSelected - rightSelected;
      return left.localeCompare(right, 'vi');
    });

  const setDirectorNames = (names) => {
    const nextNames = uniqueByName(names);
    const nextValue = nextNames.join(', ');
    if (nextValue.length > 255) {
      showToast?.('Danh sách đạo diễn tối đa 255 ký tự.');
      return;
    }
    setFormData({ ...formData, director: nextValue });
  };

  const addDirectorName = (name) => {
    const cleanName = String(name || '').trim();
    if (!cleanName) return;
    setDirectorNames([...selectedDirectorNames, cleanName]);
    setDirectorPickerSearch('');
    setIsDirectorDropdownOpen(true);
  };

  const removeDirectorName = (name) => {
    const removeKey = normalizeSearchText(name);
    setDirectorNames(selectedDirectorNames.filter((directorName) => normalizeSearchText(directorName) !== removeKey));
  };

  const typedDirectorExists = selectedDirectorNames.some((name) => normalizeSearchText(name) === normalizeSearchText(directorPickerSearch))
    || directorOptions.some((name) => normalizeSearchText(name) === normalizeSearchText(directorPickerSearch));

  const selectedActorIds = (formData.actorIds || []).map(Number);
  const selectedMainActorIds = (formData.mainActorIds || []).map(Number);
  const selectedActors = (actors || []).filter((actor) => selectedActorIds.includes(Number(actor.id)));
  const actorPickerOptions = (actors || [])
    .filter((actor) => {
      const query = actorPickerSearch.trim();
      if (!query) return true;
      return fuzzyIncludes(`${actor.name || ''} ${actor.biography || ''} ${actor.id || ''}`, query);
    })
    .sort((left, right) => {
      const leftSelected = selectedActorIds.includes(Number(left.id)) ? 0 : 1;
      const rightSelected = selectedActorIds.includes(Number(right.id)) ? 0 : 1;
      if (leftSelected !== rightSelected) return leftSelected - rightSelected;
      return String(left.name || '').localeCompare(String(right.name || ''), 'vi');
    });

  const handleQuickCreateActor = async (event) => {
    event.preventDefault();
    const token = getAdminToken();
    if (!token) return;
    if (!actorForm.name.trim()) {
      showToast('Vui lòng nhập tên actor.');
      return;
    }

    setIsActorSaving(true);
    try {
      const actor = await adminService.createAdminActor(token, {
        name: actorForm.name.trim(),
        biography: actorForm.biography.trim(),
        avatarUrl: actorForm.avatarUrl.trim()
      });
      const actorId = Number(actor.id);
      if (Number.isFinite(actorId)) {
        setFormData((prev) => ({
          ...prev,
          actorIds: Array.from(new Set([...(prev.actorIds || []), actorId]))
        }));
      }
      setCreatedActors((prev) => [actor, ...prev]);
      setActors((prev) => [actor, ...prev.filter((item) => String(item.id) !== String(actor.id))]);
      setActorForm({ name: '', biography: '', avatarUrl: '' });
      showToast(`Đã tạo actor: ${actor.name}`);
    } catch (error) {
      showToast(error.message || 'Không thể tạo actor.');
    } finally {
      setIsActorSaving(false);
    }
  };

  const handleQuickActorImageUpload = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    const token = getAdminToken();
    if (!token) return;

    setIsActorImageUploading(true);
    try {
      const uploaded = await adminService.uploadAdminImage(token, file, 'actors');
      setActorForm((prev) => ({ ...prev, avatarUrl: uploaded.url }));
      showToast('Đã tải ảnh diễn viên lên Cloudinary.');
    } catch (error) {
      showToast(error.message || 'Không thể tải ảnh lên Cloudinary.');
    } finally {
      setIsActorImageUploading(false);
    }
  };

  const handleMovieImageUpload = async (field, folder, event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    const token = getAdminToken();
    if (!token) return;

    const setUploading = field === 'posterUrl' ? setIsPosterUploading : setIsBannerUploading;
    setUploading(true);
    try {
      const uploaded = await adminService.uploadAdminImage(token, file, folder);
      setFormData((prev) => ({ ...prev, [field]: uploaded.url }));
      showToast(field === 'posterUrl' ? 'Đã tải poster lên Cloudinary.' : 'Đã tải banner lên Cloudinary.');
    } catch (error) {
      showToast(error.message || 'Không thể tải ảnh lên Cloudinary.');
    } finally {
      setUploading(false);
    }
  };

  const handleTrailerVideoUpload = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    const token = getAdminToken();
    if (!token) return;

    setIsTrailerUploading(true);
    try {
      const uploaded = await adminService.uploadAdminVideo(token, file, 'movies/trailers');
      setFormData((prev) => ({ ...prev, trailerUrl: uploaded.url }));
      showToast('Đã tải trailer lên Cloudinary.');
    } catch (error) {
      showToast(error.message || 'Không thể tải trailer lên Cloudinary.');
    } finally {
      setIsTrailerUploading(false);
    }
  };

  const getPublicationBadge = (publicationStatus) => {
    const publication = String(publicationStatus || 'UNPUBLISHED').toUpperCase();
    const map = {
      UNPUBLISHED: { label: 'CHƯA XUẤT BẢN', color: 'bg-neutral-900 text-neutral-400 border-white/10', dot: 'bg-neutral-500' },
      PUBLISHED: { label: 'ĐÃ XUẤT BẢN', color: 'bg-emerald-950/30 text-emerald-300 border-emerald-500/25', dot: 'bg-emerald-400 animate-pulse' },
      ARCHIVED: { label: 'LƯU TRỮ', color: 'bg-neutral-800 text-neutral-400 border-neutral-600/30', dot: 'bg-neutral-500' }
    };
    return map[publication] || { label: publication, color: 'bg-neutral-900 text-neutral-300 border-white/10', dot: 'bg-neutral-400' };
  };

  const getScreeningBadge = (movie) => {
    if (!movie) return null;
    const publication = String(movie.publicationStatus || '').toUpperCase();
    // Chỉ hiển thị trạng thái chiếu rạp cho phim đã xuất bản.
    if (publication !== 'PUBLISHED') {
      return null;
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const releaseDate = movie.releaseDate ? new Date(movie.releaseDate) : null;
    const endDate = movie.endDate ? new Date(movie.endDate) : null;

    if (releaseDate && today < releaseDate) {
      return { label: 'SẮP CHIẾU', color: 'bg-sky-950/30 text-sky-300 border-sky-500/25', dot: 'bg-sky-400' };
    }
    if (endDate && today > endDate) {
      return { label: 'ĐÃ KẾT THÚC', color: 'bg-neutral-900 text-neutral-400 border-white/10', dot: 'bg-neutral-500' };
    }
    return { label: 'ĐANG CHIẾU', color: 'bg-emerald-950/30 text-emerald-300 border-emerald-500/25', dot: 'bg-emerald-400 animate-pulse' };
  };

  const renderImagePreview = (src, label, className = 'h-14 w-14') => (
    <div className={`shrink-0 overflow-hidden border border-white/[0.06] bg-neutral-950 ${className}`}>
      {src ? (
        <img
          src={src}
          alt={label}
          className="h-full w-full object-cover"
          referrerPolicy="no-referrer"
        />
      ) : (
        <div className="grid h-full w-full place-items-center text-neutral-300">
          <ImageUp className="h-4 w-4" />
        </div>
      )}
    </div>
  );

  const renderVideoPreview = (src) => (
    <div className="h-11 w-20 shrink-0 overflow-hidden border border-white/[0.06] bg-neutral-950">
      {src ? (
        <video
          src={src}
          className="h-full w-full object-cover"
          muted
          playsInline
          preload="metadata"
        />
      ) : (
        <div className="grid h-full w-full place-items-center text-neutral-300">
          <Video className="h-4 w-4" />
        </div>
      )}
    </div>
  );

  return (
    <>
      {/* TAB 2: MOVIES */}
      {activeTab === 'movies' && (
        <motion.div
          key="panel-movies"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.2 }}
          className="space-y-6"
        >

          {/* Bộ lọc và công cụ quản lý phim - Đã sắp xếp gọn gàng theo 2 tầng */}
          <div className="bg-[#0a0c10] border border-white/[0.07] rounded-none p-3.5 sm:p-4 space-y-3 shadow-xl">
            {/* Hàng 1: Tìm kiếm + Lọc thể loại + Nút Tạo Phim */}
            <div className="flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
              <div className="flex flex-1 flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
                {/* Ô tìm kiếm */}
                <div className="relative flex-1">
                  <Search className="absolute left-3.5 top-3 h-3.5 w-3.5 text-neutral-400" />
                  <input
                    type="text"
                    placeholder="Tìm kiếm phim theo tiêu đề hoặc đạo diễn..."
                    value={searchQuery}
                    onChange={(e) => {
                      setSearchQuery(e.target.value);
                      setAdminMoviePagination((prev) => ({ ...prev, page: 0 }));
                    }}
                    className="w-full bg-black/80 border border-white/10 focus:border-amber-400 p-2.5 pl-10 text-xs text-white focus:outline-none placeholder:text-neutral-500 rounded-none transition"
                    id="search-all-movies-input"
                  />
                </div>

                {/* Dropdown Thể loại */}
                <select
                  value={adminGenreFilter}
                  onChange={(event) => {
                    setAdminGenreFilter(event.target.value);
                    setAdminMoviePagination((prev) => ({ ...prev, page: 0 }));
                  }}
                  className="border border-white/10 bg-black/80 px-3 py-2.5 text-xs font-semibold text-neutral-300 focus:border-amber-400 focus:outline-none rounded-none shrink-0 cursor-pointer hover:border-white/20 transition"
                  aria-label="Lọc phim theo thể loại"
                >
                  <option value="">TẤT CẢ THỂ LOẠI</option>
                  {genres.map((genre) => (
                    <option key={genre.id} value={genre.id}>{genre.name}</option>
                  ))}
                </select>
              </div>

              {/* Nút Tạo Phim */}
              <button
                type="button"
                onClick={handleStartCreateMovie}
                className="px-4 py-2.5 bg-amber-400 hover:bg-amber-300 text-black font-sans uppercase text-xs font-black tracking-wider rounded-none transition-all flex items-center justify-center gap-2 shrink-0 shadow-md shadow-amber-500/10 active:scale-95"
              >
                <Plus className="h-4 w-4 stroke-[2.5]" /> TẠO PHIM
              </button>
            </div>

            {/* Hàng 2: Bộ lọc trạng thái xuất bản */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 pt-2.5 border-t border-white/[0.06] custom-scrollbar" id="film-filter-container">
              {[
                { id: 'ALL', name: 'TẤT CẢ' },
                { id: 'PUBLISHED', name: 'ĐÃ XUẤT BẢN', icon: Globe2, color: 'emerald' },
                { id: 'ARCHIVED', name: 'LƯU TRỮ', icon: Archive, color: 'gray' }
              ].map((filter) => {
                const isActive = filmFilter === filter.id;
                return (
                  <button
                    key={filter.id}
                    onClick={() => {
                      playPulseSound(420, 'sine', 0.05);
                      setFilmFilter(filter.id);
                      setAdminMoviePagination((prev) => ({ ...prev, page: 0 }));
                    }}
                    className={`px-3 py-1.5 text-[10.5px] uppercase font-bold transition-all rounded-none flex items-center gap-1.5 whitespace-nowrap shrink-0 ${
                      isActive
                        ? 'bg-amber-500 text-black font-extrabold shadow-sm'
                        : 'bg-black/50 text-neutral-300 border border-white/[0.07] hover:border-white/20 hover:text-white'
                    }`}
                  >
                    {filter.icon && <filter.icon className="h-3 w-3" />}
                    <span>{filter.name}</span>
                    {typeof filter.count === 'number' && filter.count > 0 && (
                      <span className={`text-[9.5px] px-1.5 py-0.2 rounded-none font-mono font-bold ${
                        isActive ? 'bg-black/25 text-black' : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                      }`}>
                        {filter.count}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* MOVIE FORM POPUP MODAL (TẠO HOẶC CHỈNH SỬA PHIM) */}
          <AnimatePresence>
            {showMovieForm && (
              <div
                className="fixed inset-0 z-[150] flex items-center justify-center p-2.5 sm:p-4 bg-black/85 backdrop-blur-sm overflow-hidden"
                onClick={handleCloseMovieForm}
              >
                <motion.div
                  initial={{ opacity: 0, scale: 0.96, y: 15 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.96, y: 15 }}
                  transition={{ duration: 0.2, ease: 'easeOut' }}
                  className="relative w-full max-w-4xl lg:max-w-5xl max-h-[90vh] flex flex-col overflow-hidden border border-white/10 bg-[#0d0f14] shadow-2xl shadow-black/95 my-auto rounded-none"
                  onClick={(e) => e.stopPropagation()}
                >
                  {/* MODAL HEADER */}
                  <div className="flex justify-between items-center border-b border-white/10 px-5 py-3 sm:px-6 shrink-0 bg-[#0d0f14]">
                    <div className="flex items-center gap-3">
                      <div className="flex h-9 w-9 items-center justify-center border border-amber-500/30 bg-amber-500/10 text-amber-400 rounded-none shrink-0">
                        <Film className="h-4.5 w-4.5" />
                      </div>
                      <div>
                        <span className="text-[9px] uppercase font-mono font-bold tracking-[0.2em] text-amber-400 block">
                          {editingMovie ? 'CẬP NHẬT HỒ SƠ PHIM' : (activeDraftIdRef.current || activeDraftId) ? 'ĐANG CHỈNH SỬA BẢN NHÁP' : 'THIẾT LẬP HỒ SƠ PHÁT HÀNH'}
                        </span>
                        <h3 className="text-sm sm:text-base font-black uppercase tracking-wider text-white mt-0.5">
                          {editingMovie ? (
                            <span>Đang chỉnh sửa: <span className="text-amber-300 font-mono">{editingMovie.title}</span></span>
                          ) : (
                            'Thêm phim mới vào thư viện'
                          )}
                        </h3>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={handleCloseMovieForm}
                      className="p-1.5 text-neutral-400 hover:text-white border border-white/10 hover:border-white/30 rounded-none transition"
                      title="Đóng cửa sổ (Tự động lưu vào Bản nháp)"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>

                  {/* DRAFT ALERT */}
                  {(activeDraftIdRef.current || activeDraftId) && (
                    <div className="mx-5 sm:mx-6 mt-2.5 shrink-0 flex flex-wrap items-center justify-between gap-2 rounded-none border border-amber-500/30 bg-amber-500/10 px-3 py-1.5 text-amber-200">
                      <div className="flex items-center gap-2 text-xs">
                        <FileText className="h-3.5 w-3.5 text-amber-400 shrink-0" />
                        <span className="text-[11px]">
                          Đang chỉnh sửa bản nháp (Tự động lưu vào danh mục Bản nháp)
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          const idToDelete = activeDraftIdRef.current || activeDraftId;
                          if (idToDelete) handleDeleteDraft(idToDelete);
                          activeDraftIdRef.current = null;
                          setActiveDraftId(null);
                          resetMovieForm();
                          setShowMovieForm(false);
                        }}
                        className="text-[11px] font-bold text-rose-400 hover:text-rose-300 underline transition"
                      >
                        Xóa bản nháp này
                      </button>
                    </div>
                  )}

                  {/* FORM WITH FIXED STEPPER, SCROLLABLE BODY, FIXED FOOTER */}
                  <form onSubmit={onMovieSubmit} className="flex flex-1 min-h-0 flex-col text-xs font-sans overflow-hidden">
                    {/* Stepper bar */}
                    <div className="border-b border-white/[0.08] bg-black/25 px-5 py-2 sm:px-6 shrink-0">
                      <div className="grid grid-cols-3 gap-2">
                        {movieFormSteps.map((step, index) => {
                          const isActive = movieFormStep === step.id;
                          const isStep1Done = validateStep1(false);
                          const isStep2Done = isStep1Done && validateStep2(false);
                          const isDone = (step.id === 1 && isStep1Done && movieFormStep > 1) || (step.id === 2 && isStep2Done && movieFormStep > 2);
                          return (
                            <button
                              key={step.id}
                              type="button"
                              onClick={() => {
                                if (step.id === movieFormStep) return;
                                if (step.id === 1) {
                                  goToMovieFormStep(1);
                                } else if (step.id === 2) {
                                  if (validateStep1(true)) {
                                    setHasAttemptedNextStep(false);
                                    goToMovieFormStep(2);
                                  } else {
                                    setHasAttemptedNextStep(true);
                                    playPulseSound?.(200, 'sine', 0.1);
                                  }
                                } else if (step.id === 3) {
                                  if (!validateStep1(true)) {
                                    goToMovieFormStep(1);
                                    setHasAttemptedNextStep(true);
                                    playPulseSound?.(200, 'sine', 0.1);
                                    return;
                                  }
                                  if (!validateStep2(true)) {
                                    goToMovieFormStep(2);
                                    setHasAttemptedNextStep(true);
                                    playPulseSound?.(200, 'sine', 0.1);
                                    return;
                                  }
                                  setHasAttemptedNextStep(false);
                                  goToMovieFormStep(3);
                                }
                              }}
                              className={`group relative flex min-w-0 items-center gap-2 rounded-none border px-2.5 py-1.5 text-left transition sm:px-3 ${
                                isActive
                                  ? 'border-amber-400/60 bg-amber-400/10'
                                  : isDone
                                    ? 'cursor-pointer border-emerald-500/25 bg-emerald-500/[0.06] hover:border-emerald-400/50'
                                    : 'cursor-pointer border-white/[0.06] bg-black/20 hover:border-white/20'
                              }`}
                            >
                              <span className={`grid h-5 w-5 shrink-0 place-items-center rounded-none border text-[10px] font-black ${
                                isActive
                                  ? 'border-amber-400 bg-amber-400 text-black'
                                  : isDone
                                    ? 'border-emerald-400 bg-emerald-400 text-black'
                                    : 'border-white/15 text-neutral-500'
                              }`}>
                                {isDone ? <Check className="h-3 w-3 stroke-[3]" /> : step.id}
                              </span>
                              <span className="min-w-0">
                                <span className={`block truncate text-[10px] font-black uppercase tracking-wider ${isActive ? 'text-amber-300' : isDone ? 'text-emerald-300' : 'text-neutral-500'}`}>
                                  {step.label}
                                </span>
                                <span className="truncate text-[9px] text-neutral-400 hidden sm:block">{step.description}</span>
                              </span>
                              {index < movieFormSteps.length - 1 && (
                                <span className={`absolute -right-2 top-1/2 z-10 h-px w-2 ${isDone ? 'bg-emerald-400/60' : 'bg-white/10'}`} />
                              )}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Scrollable Content Body */}
                    <div className="min-h-0 flex-1 overflow-y-auto custom-scrollbar px-5 py-3.5 sm:px-6">
                      {/* STEP 1: THÔNG TIN PHIM */}
                      {movieFormStep === 1 && (
                        <motion.div initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.15 }} className="space-y-3">
                          {/* Row 1: Tên tiếng Việt & Tiếng Anh */}
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            <div className="space-y-1">
                              <div className="flex items-center justify-between">
                                <label className="text-[10px] uppercase tracking-wider text-neutral-300 font-bold block">
                                  Tên tác phẩm (Tiếng Việt viết Hoa) <span className="text-amber-400">*</span>
                                </label>
                                {isDuplicateTitle && (
                                  <span className="text-[10px] text-rose-400 font-bold uppercase tracking-wider flex items-center gap-1">
                                    <AlertCircle className="h-3 w-3 shrink-0" /> Trùng tên phim
                                  </span>
                                )}
                              </div>
                              <input
                                type="text"
                                placeholder="VD: CHIẾN BINH ÁNH SÁNG (tối đa 50 ký tự)"
                                maxLength={50}
                                value={formData.title}
                                onChange={(e) => setFormData({ ...formData, title: uppercaseMovieTitle(e.target.value) })}
                                className={`w-full bg-black/80 border p-2 text-xs font-bold rounded-none focus:outline-none transition ${
                                  isDuplicateTitle || (hasAttemptedNextStep && !formData.title?.trim())
                                    ? 'border-rose-500 text-rose-200 bg-rose-950/20 focus:border-rose-400'
                                    : 'border-white/10 text-white focus:border-amber-400'
                                }`}
                              />
                              {hasAttemptedNextStep && !formData.title?.trim() && !isDuplicateTitle && (
                                <p className="text-[10px] text-rose-400 font-medium">Bắt buộc nhập tên tác phẩm</p>
                              )}
                              {isDuplicateTitle && (
                                <div className="flex items-start gap-1.5 p-1.5 rounded-none bg-rose-950/50 border border-rose-500/40 text-rose-300 text-[10px] leading-snug animate-pulse">
                                  <AlertCircle className="w-3 h-3 text-rose-400 shrink-0 mt-0.5" />
                                  <div>
                                    <span className="font-bold">Cảnh báo: </span>
                                    {duplicateMovieInSystem
                                      ? 'Tên phim đã tồn tại trong hệ thống. Vui lòng đặt tên khác!'
                                      : 'Tên phim đã tồn tại trong danh mục Bản nháp khác!'}
                                  </div>
                                </div>
                              )}
                            </div>

                            <div className="space-y-1">
                              <label className="text-[10px] uppercase tracking-wider text-neutral-300 font-bold block">
                                Tên tiếng Anh hoặc tiêu đề gốc <span className="text-amber-400">*</span>
                              </label>
                              <input
                                type="text"
                                placeholder="VD: Dawn of Light (tối đa 30 ký tự)"
                                maxLength={30}
                                value={formData.englishTitle}
                                onChange={(e) => setFormData({ ...formData, englishTitle: e.target.value })}
                                className={`w-full bg-black/80 border p-2 text-xs text-white rounded-none focus:outline-none transition ${
                                  hasAttemptedNextStep && !formData.englishTitle?.trim()
                                    ? 'border-rose-500 bg-rose-950/20 text-rose-200 focus:border-rose-400'
                                    : 'border-white/10 focus:border-amber-400'
                                }`}
                              />
                              {hasAttemptedNextStep && !formData.englishTitle?.trim() && (
                                <p className="text-[10px] text-rose-400 font-medium">Bắt buộc nhập tên tiếng Anh hoặc tiêu đề gốc</p>
                              )}
                            </div>
                          </div>

                          {/* Row 2: Đạo diễn, Thể loại, Thời lượng, Độ tuổi */}
                          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 items-start">
                            <div className="space-y-1">
                              <label className="text-[10px] uppercase tracking-wider text-neutral-300 font-bold block">
                                Đạo diễn <span className="text-amber-400">*</span>
                              </label>
                              <div className="relative">
                                <button
                                  ref={directorTriggerRef}
                                  type="button"
                                  onClick={toggleDirectorDropdown}
                                  className={`flex min-h-[36px] w-full items-center justify-between gap-2 rounded-none border bg-black/80 px-3 py-1.5 text-left text-xs transition focus:outline-none ${
                                    hasAttemptedNextStep && !formData.director?.trim()
                                      ? 'border-rose-500 bg-rose-950/20 text-rose-200 focus:border-rose-400'
                                      : 'border-white/10 text-white hover:border-amber-500/60 focus:border-amber-400'
                                  }`}
                                >
                                  <span className="min-w-0 flex-1 truncate">
                                    {selectedDirectorNames.length ? (
                                      <span className="flex flex-wrap gap-1">
                                        {selectedDirectorNames.slice(0, 3).map((directorName) => (
                                          <span key={directorName} className="inline-flex max-w-full items-center gap-1 rounded-none bg-amber-500/15 border border-amber-500/40 px-1.5 py-0.5 text-[10px] font-bold text-amber-200">
                                            <span className="truncate">{directorName}</span>
                                          </span>
                                        ))}
                                        {selectedDirectorNames.length > 3 && (
                                          <span className="rounded-none bg-black border border-white/10 px-1.5 py-0.5 text-[10px] font-bold text-neutral-200">
                                            +{selectedDirectorNames.length - 3}
                                          </span>
                                        )}
                                      </span>
                                    ) : (
                                      <span className="text-neutral-400">Chọn hoặc nhập đạo diễn</span>
                                    )}
                                  </span>
                                  <ChevronDown className={`h-3.5 w-3.5 shrink-0 text-amber-400 transition ${isDirectorDropdownOpen ? 'rotate-180' : ''}`} />
                                </button>

                                {isDirectorDropdownOpen && directorDropdownPosition && createPortal(
                                  <div
                                    ref={directorDropdownRef}
                                    style={directorDropdownPosition}
                                    className="fixed z-[170] rounded-none border border-amber-500/40 bg-[#0c0d12] shadow-2xl shadow-black/90 overflow-hidden"
                                  >
                                    <div className="border-b border-white/[0.08] p-2 bg-black/40">
                                      <div className="flex items-center gap-2 rounded-none border border-white/10 bg-black px-2">
                                        <Search className="h-3.5 w-3.5 text-neutral-400" />
                                        <input
                                          type="text"
                                          value={directorPickerSearch}
                                          onChange={(event) => setDirectorPickerSearch(event.target.value)}
                                          onKeyDown={(event) => {
                                            if (event.key !== 'Enter') return;
                                            event.preventDefault();
                                            addDirectorName(directorPickerSearch);
                                          }}
                                          placeholder="Tìm gần đúng hoặc nhập tên rồi Enter..."
                                          className="h-8 min-w-0 flex-1 bg-transparent text-xs text-white placeholder:text-neutral-500 focus:outline-none"
                                          autoFocus
                                        />
                                      </div>
                                      {directorPickerSearch.trim() && !typedDirectorExists && (
                                        <button
                                          type="button"
                                          onClick={() => addDirectorName(directorPickerSearch)}
                                          className="mt-1.5 w-full rounded-none border border-amber-500/30 bg-amber-500/10 px-2 py-1.5 text-left text-[10px] font-bold uppercase tracking-wider text-amber-300 hover:bg-amber-500 hover:text-black transition"
                                        >
                                          + Thêm đạo diễn: {directorPickerSearch.trim()}
                                        </button>
                                      )}
                                    </div>

                                    <div className="max-h-[152px] overflow-y-auto overscroll-contain custom-scrollbar p-1.5 space-y-1 touch-pan-y">
                                      {directorOptions.length ? directorOptions.map((directorName) => {
                                        const isSelected = selectedDirectorNames.some((name) => normalizeSearchText(name) === normalizeSearchText(directorName));
                                        return (
                                          <div
                                            key={directorName}
                                            className={`grid h-8 grid-cols-[1fr_auto] items-center gap-2 rounded-none px-2 transition ${isSelected ? 'border border-amber-500/40 bg-amber-500/10' : 'border border-transparent bg-neutral-900/60 hover:bg-neutral-800'}`}
                                          >
                                            <button type="button" onClick={() => isSelected ? removeDirectorName(directorName) : addDirectorName(directorName)} className="min-w-0 text-left">
                                              <span className="flex items-center gap-2">
                                                <span className={`grid h-3.5 w-3.5 shrink-0 place-items-center rounded-none border text-[9px] ${isSelected ? 'border-amber-400 bg-amber-400 text-black' : 'border-white/20 text-transparent'}`}>
                                                  <Check className="h-2.5 w-2.5 stroke-[3]" />
                                                </span>
                                                <span className="block truncate text-xs font-semibold text-white">{directorName}</span>
                                              </span>
                                            </button>
                                            {isSelected && (
                                              <button
                                                type="button"
                                                onClick={() => removeDirectorName(directorName)}
                                                className="h-6 rounded-none border border-rose-500/30 px-1.5 text-[9px] font-bold text-rose-300 transition hover:bg-rose-500 hover:text-white"
                                              >
                                                Xóa
                                              </button>
                                            )}
                                          </div>
                                        );
                                      }) : (
                                        <p className="px-2 py-4 text-center text-[10px] text-neutral-400">Không tìm thấy đạo diễn phù hợp.</p>
                                      )}
                                    </div>
                                  </div>,
                                  document.body
                                )}
                              </div>
                              {hasAttemptedNextStep && !formData.director?.trim() && (
                                <p className="text-[10px] text-rose-400 font-medium">Bắt buộc chọn hoặc nhập ít nhất 1 đạo diễn</p>
                              )}
                            </div>

                            <div className="space-y-1">
                              <div className="flex items-center justify-between gap-2">
                                <label className="text-[10px] uppercase tracking-wider text-neutral-300 font-bold block">
                                  Thể loại phim <span className="text-amber-400">*</span>
                                </label>
                                <span className="shrink-0 text-[9px] font-mono text-neutral-400">
                                  {(formData.genreIds || []).length} đã chọn
                                </span>
                              </div>
                              <div className="relative">
                                <button
                                  ref={genreTriggerRef}
                                  type="button"
                                  onClick={toggleGenreDropdown}
                                  className={`flex min-h-[36px] w-full items-center justify-between gap-2 rounded-none border bg-black/80 px-3 py-1.5 text-left text-xs transition focus:outline-none ${
                                    hasAttemptedNextStep && (!formData.genreIds || formData.genreIds.length === 0)
                                      ? 'border-rose-500 bg-rose-950/20 text-rose-200'
                                      : 'border-white/10 text-white hover:border-amber-500/60 focus:border-amber-400'
                                  }`}
                                >
                                  <span className="min-w-0 flex-1 truncate text-neutral-400">
                                    {selectedGenreObjects.length
                                      ? selectedGenreObjects.map((genre) => genre.name).join(', ')
                                      : 'Chọn thể loại phim'}
                                  </span>
                                  <ChevronDown className={`h-3.5 w-3.5 shrink-0 text-amber-400 transition ${isGenreDropdownOpen ? 'rotate-180' : ''}`} />
                                </button>

                                {isGenreDropdownOpen && genreDropdownPosition && createPortal(
                                  <div
                                    ref={genreDropdownRef}
                                    style={genreDropdownPosition}
                                    className="fixed z-[170] rounded-none border border-amber-500/40 bg-[#0c0d12] shadow-2xl shadow-black/90 overflow-hidden"
                                  >
                                    <div className="border-b border-white/[0.08] p-2 bg-black/60">
                                      <div className="flex items-center gap-2 border border-white/10 bg-black px-2">
                                        <Search className="h-3.5 w-3.5 shrink-0 text-neutral-400" />
                                        <input
                                          type="text"
                                          value={genrePickerSearch}
                                          onChange={(event) => setGenrePickerSearch(event.target.value)}
                                          placeholder="Tìm thể loại..."
                                          className="h-8 min-w-0 flex-1 bg-transparent text-xs text-white placeholder:text-neutral-500 focus:outline-none"
                                          autoFocus
                                        />
                                      </div>
                                    </div>
                                    <div className="max-h-[152px] overflow-y-auto overscroll-contain custom-scrollbar p-1.5 space-y-1 touch-pan-y">
                                      {isGenreLoading ? (
                                        <p className="px-2 py-4 text-center text-[10px] text-neutral-400">Đang tải thể loại...</p>
                                      ) : filteredGenreOptions.length ? filteredGenreOptions.map((genre) => {
                                        const isSelected = (formData.genreIds || []).includes(Number(genre.id));
                                        return (
                                          <button
                                            key={genre.id}
                                            type="button"
                                            onClick={() => toggleMovieGenre(genre.id)}
                                            className={`flex h-8 w-full items-center gap-2 border px-2 text-left text-xs transition ${isSelected ? 'border-amber-500/50 bg-amber-500/15 text-amber-200' : 'border-white/[0.06] bg-neutral-900/60 text-neutral-300 hover:bg-neutral-800'}`}
                                          >
                                            <span className={`grid h-3.5 w-3.5 shrink-0 place-items-center border ${isSelected ? 'border-amber-400 bg-amber-400 text-black' : 'border-white/20 text-transparent'}`}>
                                              <Check className="h-2.5 w-2.5 stroke-[3]" />
                                            </span>
                                            <span className="truncate font-semibold">{genre.name}</span>
                                          </button>
                                        );
                                      }) : (
                                        <p className="px-2 py-4 text-center text-[10px] text-neutral-400">Không tìm thấy thể loại.</p>
                                      )}
                                    </div>
                                  </div>,
                                  document.body
                                )}
                              </div>
                              {hasAttemptedNextStep && (!formData.genreIds || formData.genreIds.length === 0) && (
                                <p className="text-[10px] text-rose-400 font-medium">Bắt buộc chọn ít nhất 1 thể loại phim</p>
                              )}
                            </div>

                            <div className="space-y-1">
                              <label className="text-[10px] uppercase tracking-wider text-neutral-300 font-bold block">
                                Thời lượng (Số phút) <span className="text-amber-400">*</span>
                              </label>
                              <input
                                type="number"
                                placeholder="60 - 180 phút"
                                min={60}
                                max={180}
                                value={formData.duration}
                                onChange={(e) => setFormData({ ...formData, duration: Number(e.target.value) })}
                                className={`w-full bg-black/80 border p-2 text-xs text-white rounded-none focus:outline-none font-mono transition ${
                                  hasAttemptedNextStep && (!formData.duration || formData.duration < 60 || formData.duration > 180)
                                    ? 'border-rose-500 bg-rose-950/20 text-rose-200 focus:border-rose-400'
                                    : 'border-white/10 focus:border-amber-400'
                                }`}
                              />
                              {hasAttemptedNextStep && (!formData.duration || formData.duration < 60 || formData.duration > 180) && (
                                <p className="text-[10px] text-rose-400 font-medium">Thời lượng 60 - 180 phút</p>
                              )}
                            </div>

                            <div className="space-y-1">
                              <label className="text-[10px] uppercase tracking-wider text-neutral-300 font-bold block">
                                Độ tuổi phân loại <span className="text-amber-400">*</span>
                              </label>
                              <button
                                ref={ageRatingTriggerRef}
                                type="button"
                                onClick={toggleAgeRatingDropdown}
                                className="flex min-h-[36px] w-full items-center justify-between gap-2 border border-white/10 bg-black/80 px-3 py-1.5 text-left text-xs font-bold text-white transition hover:border-amber-500/60 focus:border-amber-400 focus:outline-none"
                              >
                                <span className="truncate">
                                  {AGE_RATING_OPTIONS.find((option) => option.value === formData.ageRating)?.label || 'Chọn độ tuổi'}
                                </span>
                                <ChevronDown className={`h-3.5 w-3.5 shrink-0 text-amber-400 transition ${isAgeRatingDropdownOpen ? 'rotate-180' : ''}`} />
                              </button>
                              {isAgeRatingDropdownOpen && ageRatingDropdownPosition && createPortal(
                                <div
                                  ref={ageRatingDropdownRef}
                                  style={ageRatingDropdownPosition}
                                  className="fixed z-[170] overflow-hidden border border-amber-500/40 bg-[#0c0d12] p-1.5 shadow-2xl shadow-black/90"
                                >
                                  {AGE_RATING_OPTIONS.map((option) => {
                                    const isSelected = option.value === formData.ageRating;
                                    return (
                                      <button
                                        key={option.value}
                                        type="button"
                                        onClick={() => {
                                          setFormData({ ...formData, ageRating: option.value });
                                          setIsAgeRatingDropdownOpen(false);
                                        }}
                                        className={`mb-1 flex h-8 w-full last:mb-0 items-center justify-between border px-2 text-left text-xs font-bold transition ${isSelected ? 'border-amber-500/50 bg-amber-500/15 text-amber-200' : 'border-white/[0.06] bg-neutral-900/60 text-neutral-300 hover:bg-neutral-800 hover:text-white'}`}
                                      >
                                        <span className="truncate">{option.label}</span>
                                        {isSelected && <Check className="h-3.5 w-3.5 shrink-0 text-amber-400" />}
                                      </button>
                                    );
                                  })}
                                </div>,
                                document.body
                              )}
                            </div>
                          </div>

                          {/* Row 3: THỂ LOẠI PHIM (DROPDOWN SCROLL XUỐNG GỌN GÀNG, KHÔNG DÀI XUỐNG) */}
                          <div className="hidden">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <label className="text-[10px] uppercase tracking-wider text-neutral-300 font-bold block">
                                  Thể loại phim <span className="text-amber-400">*</span>
                                </label>
                                <span className={`text-[9px] font-mono px-2 py-0.5 rounded-none border ${
                                  (formData.genreIds || []).length > 0
                                    ? 'text-amber-300 bg-amber-500/10 border-amber-500/30'
                                    : 'text-neutral-400 bg-white/[0.03] border-white/10'
                                }`}>
                                  {(formData.genreIds || []).length} thể loại đã chọn
                                </span>
                              </div>
                              {(formData.genreIds || []).length > 0 && (
                                <button
                                  type="button"
                                  onClick={clearAllGenres}
                                  className="text-[10px] text-neutral-400 hover:text-rose-400 transition"
                                >
                                  Bỏ chọn tất cả
                                </button>
                              )}
                            </div>

                            <div className="relative">
                              <button
                                type="button"
                                onClick={toggleGenreDropdown}
                                className={`flex min-h-[36px] w-full items-center justify-between gap-2 rounded-none border bg-black/80 px-3 py-1.5 text-left text-xs transition focus:outline-none ${
                                  hasAttemptedNextStep && (!formData.genreIds || formData.genreIds.length === 0)
                                    ? 'border-rose-500 bg-rose-950/20 text-rose-200 focus:border-rose-400'
                                    : 'border-white/10 text-white hover:border-amber-500/60 focus:border-amber-400'
                                }`}
                              >
                                <span className="min-w-0 flex-1 truncate">
                                  {selectedGenreObjects.length > 0 ? (
                                    <span className="flex flex-wrap gap-1">
                                      {selectedGenreObjects.slice(0, 4).map((genre) => (
                                        <span
                                          key={genre.id}
                                          className="inline-flex max-w-full items-center gap-1 rounded-none bg-amber-500/15 border border-amber-500/40 px-1.5 py-0.5 text-[10px] font-bold text-amber-200"
                                        >
                                          <span className="truncate">{genre.name}</span>
                                        </span>
                                      ))}
                                      {selectedGenreObjects.length > 4 && (
                                        <span className="rounded-none bg-black border border-white/10 px-1.5 py-0.5 text-[10px] font-bold text-neutral-200">
                                          +{selectedGenreObjects.length - 4}
                                        </span>
                                      )}
                                    </span>
                                  ) : (
                                    <span className="text-neutral-400">Chọn thể loại phim (bấm để cuộn xuống danh sách)...</span>
                                  )}
                                </span>
                                <ChevronDown className={`h-3.5 w-3.5 shrink-0 text-amber-400 transition ${isGenreDropdownOpen ? 'rotate-180' : ''}`} />
                              </button>

                              {isGenreDropdownOpen && (
                                <div className="absolute left-0 right-0 z-40 mt-1.5 rounded-none border border-amber-500/40 bg-[#0c0d12] shadow-2xl shadow-black/90 overflow-hidden">
                                  <div className="border-b border-white/[0.08] p-2 bg-black/60 flex items-center justify-between gap-2">
                                    <div className="flex flex-1 items-center gap-2 rounded-none border border-white/10 bg-black px-2">
                                      <Search className="h-3.5 w-3.5 text-neutral-400 shrink-0" />
                                      <input
                                        type="text"
                                        value={genrePickerSearch}
                                        onChange={(e) => setGenrePickerSearch(e.target.value)}
                                        placeholder="Tìm kiếm thể loại phim..."
                                        className="h-7 min-w-0 flex-1 bg-transparent text-xs text-white placeholder:text-neutral-500 focus:outline-none"
                                        autoFocus
                                      />
                                      {genrePickerSearch && (
                                        <button
                                          type="button"
                                          onClick={() => setGenrePickerSearch('')}
                                          className="text-[11px] text-neutral-400 hover:text-white"
                                        >
                                          ×
                                        </button>
                                      )}
                                    </div>
                                    <button
                                      type="button"
                                      onClick={() => setIsGenreDropdownOpen(false)}
                                      className="h-7 px-2.5 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 text-[10px] font-bold uppercase rounded-none transition shrink-0"
                                    >
                                      Đóng
                                    </button>
                                  </div>

                                  <div className="max-h-48 overflow-y-auto custom-scrollbar p-1.5 space-y-1">
                                    {isGenreLoading ? (
                                      <div className="flex items-center justify-center py-4 text-neutral-400 text-xs gap-2">
                                        <RefreshCw className="h-3.5 w-3.5 animate-spin text-amber-400" />
                                        <span>Đang tải danh sách thể loại...</span>
                                      </div>
                                    ) : filteredGenreOptions.length > 0 ? (
                                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-1">
                                        {filteredGenreOptions.map((genre) => {
                                          const isSelected = (formData.genreIds || []).includes(Number(genre.id));
                                          return (
                                            <button
                                              key={genre.id}
                                              type="button"
                                              onClick={() => toggleMovieGenre(genre.id)}
                                              className={`flex items-center gap-2 px-2 py-1.5 rounded-none border text-left transition select-none ${
                                                isSelected
                                                  ? 'border-amber-500/50 bg-amber-500/15 text-amber-200'
                                                  : 'border-white/[0.06] bg-neutral-900/60 text-neutral-300 hover:bg-neutral-800 hover:text-white'
                                              }`}
                                            >
                                              <span
                                                className={`grid h-3.5 w-3.5 shrink-0 place-items-center rounded-none border text-[9px] ${
                                                  isSelected
                                                    ? 'border-amber-400 bg-amber-400 text-black'
                                                    : 'border-white/20 text-transparent'
                                                }`}
                                              >
                                                <Check className="h-2.5 w-2.5 stroke-[3]" />
                                              </span>
                                              <span className="truncate text-xs font-semibold">{genre.name}</span>
                                            </button>
                                          );
                                        })}
                                      </div>
                                    ) : (
                                      <p className="px-2 py-4 text-center text-[10px] text-neutral-400">
                                        Không tìm thấy thể loại nào phù hợp.
                                      </p>
                                    )}
                                  </div>
                                </div>
                              )}
                            </div>

                            {selectedGenreObjects.length > 0 && (
                              <div className="flex flex-wrap gap-1 max-h-14 overflow-y-auto custom-scrollbar pt-1">
                                {selectedGenreObjects.map((genre) => (
                                  <span
                                    key={genre.id}
                                    className="inline-flex items-center gap-1 rounded-none bg-neutral-900 border border-white/10 px-2 py-0.5 text-[10px] font-medium text-neutral-200"
                                  >
                                    {genre.name}
                                    <button
                                      type="button"
                                      onClick={() => toggleMovieGenre(genre.id)}
                                      className="text-neutral-400 hover:text-rose-300 transition font-bold"
                                    >
                                      ×
                                    </button>
                                  </span>
                                ))}
                              </div>
                            )}
                            {hasAttemptedNextStep && (!formData.genreIds || formData.genreIds.length === 0) && (
                              <p className="text-[10px] text-rose-400 font-medium">Bắt buộc chọn ít nhất 1 thể loại phim</p>
                            )}
                          </div>

                          {/* Row 4: Ngày bắt đầu, Kết thúc, Ngôn ngữ, Phụ đề */}
                          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
                            <div className="space-y-1">
                              <label className="text-[10px] uppercase tracking-wider text-neutral-300 font-bold block">
                                Ngày bắt đầu chiếu <span className="text-amber-400">*</span>
                              </label>
                              <MovieDatePicker
                                label="Chọn ngày bắt đầu chiếu"
                                value={formData.releaseDate}
                                minDate={editingMovie ? undefined : todayInputValue}
                                hasError={hasAttemptedNextStep && !formData.releaseDate}
                                onChange={(nextReleaseDate) => setFormData({
                                  ...formData,
                                  releaseDate: nextReleaseDate,
                                  endDate: formData.endDate && nextReleaseDate && formData.endDate < nextReleaseDate ? '' : formData.endDate
                                })}
                              />
                              {hasAttemptedNextStep && !formData.releaseDate ? (
                                <p className="text-[10px] text-rose-400 font-medium">Bắt buộc chọn ngày bắt đầu</p>
                              ) : (
                                <p className="text-[9px] text-neutral-400 truncate">dd/mm/yyyy, không chọn ngày quá khứ</p>
                              )}
                            </div>

                            <div className="space-y-1">
                              <label className="text-[10px] uppercase tracking-wider text-neutral-300 font-bold block">
                                Ngày kết thúc chiếu <span className="text-amber-400">*</span>
                              </label>
                              <MovieDatePicker
                                label="Chọn ngày kết thúc chiếu"
                                value={formData.endDate}
                                minDate={formData.releaseDate || (editingMovie ? undefined : todayInputValue)}
                                hasError={hasAttemptedNextStep && (!formData.endDate || Boolean(formData.releaseDate && formData.endDate < formData.releaseDate))}
                                onChange={(nextEndDate) => setFormData({ ...formData, endDate: nextEndDate })}
                              />
                              {formData.releaseDate && formData.endDate && formData.endDate < formData.releaseDate ? (
                                <p className="text-[9px] text-rose-400 truncate">Ngày kết thúc phải sau ngày bắt đầu</p>
                              ) : hasAttemptedNextStep && !formData.endDate ? (
                                <p className="text-[10px] text-rose-400 font-medium">Bắt buộc chọn ngày kết thúc</p>
                              ) : (
                                <p className="text-[9px] text-amber-300/90 truncate">
                                  Trạng thái: <span className="font-semibold">{{ NOW_SHOWING: 'ĐANG CHIẾU', UPCOMING: 'SẮP CHIẾU', ENDED: 'ĐÃ KẾT THÚC' }[resolveMovieStatusFromDates(formData.releaseDate, formData.endDate)]}</span>
                                </p>
                              )}
                            </div>

                            <div className="space-y-1">
                              <label className="text-[10px] uppercase tracking-wider text-neutral-300 font-bold block">
                                Ngôn ngữ <span className="text-amber-400">*</span>
                              </label>
                              <input
                                type="text"
                                placeholder="VD: Tiếng Việt"
                                maxLength={30}
                                value={formData.language}
                                onChange={(e) => setFormData({ ...formData, language: e.target.value })}
                                className={`w-full bg-black/80 border p-2 text-xs text-white rounded-none focus:outline-none transition ${
                                  hasAttemptedNextStep && !formData.language?.trim()
                                    ? 'border-rose-500 bg-rose-950/20 text-rose-200 focus:border-rose-400'
                                    : 'border-white/10 focus:border-amber-400'
                                }`}
                              />
                              {hasAttemptedNextStep && !formData.language?.trim() && (
                                <p className="text-[10px] text-rose-400 font-medium">Bắt buộc nhập ngôn ngữ</p>
                              )}
                            </div>

                            <div className="space-y-1">
                              <label className="text-[10px] uppercase tracking-wider text-neutral-300 font-bold block">
                                Phụ đề <span className="text-amber-400">*</span>
                              </label>
                              <input
                                type="text"
                                placeholder="VD: EN Sub"
                                maxLength={30}
                                value={formData.subtitleLanguage}
                                onChange={(e) => setFormData({ ...formData, subtitleLanguage: e.target.value })}
                                className={`w-full bg-black/80 border p-2 text-xs text-white rounded-none focus:outline-none transition ${
                                  hasAttemptedNextStep && !formData.subtitleLanguage?.trim()
                                    ? 'border-rose-500 bg-rose-950/20 text-rose-200 focus:border-rose-400'
                                    : 'border-white/10 focus:border-amber-400'
                                }`}
                              />
                              {hasAttemptedNextStep && !formData.subtitleLanguage?.trim() && (
                                <p className="text-[10px] text-rose-400 font-medium">Bắt buộc nhập phụ đề</p>
                              )}
                            </div>
                          </div>
                        </motion.div>
                      )}

                      {/* STEP 2: DIỄN VIÊN & MEDIA */}
                      {movieFormStep === 2 && (
                        <motion.div initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.15 }} className="space-y-3">
                          {/* Diễn viên */}
                          <div className="space-y-1.5 rounded-none border border-white/10 bg-black/40 p-2.5 sm:p-3">
                            <div className="flex items-center justify-between gap-3">
                              <label className="text-[10px] uppercase tracking-wider text-neutral-300 font-bold block">
                                Chọn diễn viên và vai chính <span className="text-amber-400">*</span>
                              </label>
                              <span className="text-[9px] text-amber-300/80 font-mono">
                                {selectedActorIds.length} diễn viên · {selectedMainActorIds.length} vai chính
                              </span>
                            </div>

                            <div className="relative">
                              <button
                                ref={actorTriggerRef}
                                type="button"
                                onClick={toggleActorDropdown}
                                className={`flex min-h-[36px] w-full items-center justify-between gap-2 rounded-none border bg-black/80 px-3 py-1.5 text-left text-xs transition focus:outline-none ${
                                  hasAttemptedNextStep && (!formData.actorIds || formData.actorIds.length === 0)
                                    ? 'border-rose-500 bg-rose-950/20 text-rose-200 focus:border-rose-400'
                                    : 'border-white/10 text-white hover:border-amber-500/60 focus:border-amber-400'
                                }`}
                              >
                                <span className="min-w-0 flex-1 truncate">
                                  {selectedActors.length ? (
                                    <span className="flex flex-wrap gap-1">
                                      {selectedActors.slice(0, 4).map((actor) => {
                                        const actorId = Number(actor.id);
                                        const isMain = selectedMainActorIds.includes(actorId);
                                        return (
                                          <span key={actor.id} className={`inline-flex max-w-full items-center gap-1 rounded-none px-1.5 py-0.5 text-[10px] font-bold ${isMain ? 'border border-amber-400 bg-amber-400 text-black' : 'border border-white/10 bg-neutral-900 text-neutral-300'}`}>
                                            <span className="truncate">{actor.name}</span>
                                            {isMain && <span className="text-[8px] uppercase">Main</span>}
                                          </span>
                                        );
                                      })}
                                      {selectedActors.length > 4 && (
                                        <span className="rounded-none bg-black border border-white/10 px-1.5 py-0.5 text-[10px] font-bold text-neutral-200">
                                          +{selectedActors.length - 4}
                                        </span>
                                      )}
                                    </span>
                                  ) : (
                                    <span className="text-neutral-400">Chọn diễn viên cho phim</span>
                                  )}
                                </span>
                                <ChevronDown className={`h-3.5 w-3.5 shrink-0 text-amber-400 transition ${isActorDropdownOpen ? 'rotate-180' : ''}`} />
                              </button>

                              {isActorDropdownOpen && actorDropdownPosition && createPortal(
                                <div
                                  ref={actorDropdownRef}
                                  style={actorDropdownPosition}
                                  className="fixed z-[170] rounded-none border border-amber-500/40 bg-[#0c0d12] shadow-2xl shadow-black/90 overflow-hidden"
                                >
                                  <div className="border-b border-white/[0.08] p-2 bg-black/40">
                                    <div className="flex items-center gap-2 rounded-none border border-white/10 bg-black px-2">
                                      <Search className="h-3.5 w-3.5 text-neutral-400" />
                                      <input
                                        type="text"
                                        value={actorPickerSearch}
                                        onChange={(event) => setActorPickerSearch(event.target.value)}
                                        placeholder="Tìm tên diễn viên, tiểu sử hoặc ID..."
                                        className="h-8 min-w-0 flex-1 bg-transparent text-xs text-white placeholder:text-neutral-500 focus:outline-none"
                                        autoFocus
                                      />
                                    </div>
                                  </div>

                                  <div className="max-h-[184px] overflow-y-auto overscroll-contain custom-scrollbar p-1.5 space-y-1 touch-pan-y">
                                    {actorPickerOptions.length ? actorPickerOptions.map((actor) => {
                                      const actorId = Number(actor.id);
                                      const isSelected = selectedActorIds.includes(actorId);
                                      const isMain = selectedMainActorIds.includes(actorId);
                                      return (
                                        <div
                                          key={actor.id}
                                          className={`grid h-10 grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-2 rounded-none px-2 transition ${isSelected ? 'border border-amber-500/40 bg-amber-500/10' : 'border border-transparent bg-neutral-900/60 hover:bg-neutral-800'}`}
                                        >
                                          <button type="button" onClick={() => toggleMovieActor(actorId)} className="min-w-0 text-left">
                                            <span className="flex items-center gap-2">
                                              <span className={`grid h-3.5 w-3.5 shrink-0 place-items-center rounded-none border text-[9px] ${isSelected ? 'border-amber-400 bg-amber-400 text-black' : 'border-white/20 text-transparent'}`}>
                                                <Check className="h-2.5 w-2.5 stroke-[3]" />
                                              </span>
                                              <span className="min-w-0">
                                                <span className="block truncate text-xs font-semibold text-white">{actor.name}</span>
                                                <span className="block truncate text-[9px] text-neutral-400">#{actor.id} · {actor.movieCount || 0} phim</span>
                                              </span>
                                            </span>
                                          </button>
                                          <button
                                            type="button"
                                            onClick={() => toggleMovieMainActor(actorId)}
                                            className={`h-6 px-1.5 text-[9px] font-bold uppercase rounded-none border transition ${isMain ? 'border-amber-400 bg-amber-400 text-black' : 'border-white/10 text-neutral-300 hover:border-amber-400 hover:text-amber-300'}`}
                                          >
                                            Vai chính
                                          </button>
                                          {isSelected && (
                                            <button
                                              type="button"
                                              onClick={() => toggleMovieActor(actorId)}
                                              className="h-6 rounded-none border border-rose-500/30 px-1.5 text-[9px] font-bold text-rose-300 transition hover:bg-rose-500 hover:text-white"
                                              title="Bỏ chọn"
                                            >
                                              Xóa
                                            </button>
                                          )}
                                        </div>
                                      );
                                    }) : (
                                      <p className="px-2 py-4 text-center text-[10px] text-neutral-400">Không tìm thấy diễn viên phù hợp.</p>
                                    )}
                                  </div>
                                </div>,
                                document.body
                              )}
                            </div>

                            {hasAttemptedNextStep && (!formData.actorIds || formData.actorIds.length === 0) && (
                              <p className="text-[10px] text-rose-400 font-medium pt-0.5">Bắt buộc chọn ít nhất 1 diễn viên cho phim</p>
                            )}
                          </div>

                          {/* Media: Trailer, Poster, Banner */}
                          <div className="space-y-2 rounded-none border border-white/10 bg-black/40 p-2.5 sm:p-3">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <label className="text-[10px] uppercase tracking-wider text-neutral-300 font-bold block">
                                  Hình ảnh & Video giới thiệu <span className="text-amber-400">*</span>
                                </label>
                                <span className="text-[9px] text-amber-400 font-mono bg-amber-500/10 px-1.5 py-0.5 rounded-none border border-amber-500/20">
                                  Bắt buộc 3 mục
                                </span>
                              </div>
                              <span className="text-[9px] text-neutral-400 hidden sm:inline">
                                Xem trước trực tiếp hoặc click Review để phóng to
                              </span>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-0.5">
                              {/* 1. TRAILER */}
                              <div className="space-y-1">
                                <div className="flex items-center justify-between">
                                  <span className="text-[9px] uppercase tracking-wider text-neutral-300 font-bold block">
                                    Trailer (Video) <span className="text-amber-400">*</span>
                                  </span>
                                  {formData.trailerUrl && (
                                    <span className="text-[8px] font-mono text-emerald-400 bg-emerald-500/10 px-1 py-0.2 rounded-none border border-emerald-500/20">
                                      Đã có
                                    </span>
                                  )}
                                </div>

                                {!formData.trailerUrl ? (
                                  <div>
                                    <label className={`relative h-44 sm:h-48 flex flex-col items-center justify-center border border-dashed hover:border-amber-400/70 bg-black/50 hover:bg-neutral-900/60 rounded-none transition cursor-pointer p-3 text-center group ${
                                      hasAttemptedNextStep && !formData.trailerUrl
                                        ? 'border-rose-500/80 bg-rose-950/20'
                                        : 'border-white/15'
                                    } ${isTrailerUploading ? 'pointer-events-none' : ''}`}>
                                      {isTrailerUploading ? (
                                        <div className="flex flex-col items-center gap-1.5 text-amber-400">
                                          <RefreshCw className="h-6 w-6 animate-spin" />
                                          <span className="text-[10px] font-bold tracking-wider">ĐANG TẢI LÊN...</span>
                                        </div>
                                      ) : (
                                        <div className="flex flex-col items-center gap-1.5">
                                          <div className="w-9 h-9 rounded-none bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 group-hover:scale-105 group-hover:bg-amber-500 group-hover:text-black transition duration-200">
                                            <Video className="w-4 h-4" />
                                          </div>
                                          <span className="text-[11px] font-bold text-white group-hover:text-amber-300 transition">
                                            Tải lên Trailer video
                                          </span>
                                          <span className="text-[9px] text-neutral-500 font-mono">
                                            MP4, WEBM
                                          </span>
                                        </div>
                                      )}
                                      <input
                                        type="file"
                                        accept="video/mp4,video/webm,video/quicktime"
                                        onChange={handleTrailerVideoUpload}
                                        className="hidden"
                                      />
                                    </label>
                                    {hasAttemptedNextStep && !formData.trailerUrl && (
                                      <p className="text-[10px] text-rose-400 font-medium pt-1">Bắt buộc tải lên Trailer video</p>
                                    )}
                                  </div>
                                ) : (
                                  <div className="relative h-44 sm:h-48 rounded-none border border-amber-500/30 bg-black overflow-hidden group shadow-md">
                                    {isTrailerUploading && (
                                      <div className="absolute inset-0 z-30 bg-black/85 backdrop-blur-sm flex flex-col items-center justify-center gap-1.5">
                                        <RefreshCw className="h-6 w-6 animate-spin text-amber-400" />
                                        <span className="text-[10px] font-bold text-amber-300">Đang tải video mới...</span>
                                      </div>
                                    )}
                                    <video
                                      src={formData.trailerUrl}
                                      controls
                                      playsInline
                                      preload="metadata"
                                      className="w-full h-full object-contain bg-black"
                                    />
                                    <div className="absolute top-1.5 right-1.5 z-20 flex items-center gap-1 opacity-90 group-hover:opacity-100 transition bg-black/80 backdrop-blur-md p-1 rounded-none border border-white/10">
                                      <button
                                        type="button"
                                        onClick={() => setMediaReviewModal({ type: 'video', url: formData.trailerUrl, title: `Trailer: ${formData.title || 'Phim'}` })}
                                        className="flex items-center gap-0.5 px-1.5 py-0.5 bg-amber-500/20 hover:bg-amber-500 text-amber-300 hover:text-black rounded-none text-[9px] font-bold transition"
                                        title="Xem toàn màn hình"
                                      >
                                        <Eye className="w-3 h-3" /> Review
                                      </button>
                                      <label className="flex items-center gap-0.5 px-1.5 py-0.5 bg-white/10 hover:bg-white/20 text-white rounded-none text-[9px] font-bold cursor-pointer transition" title="Đổi video">
                                        <RefreshCw className="w-2.5 h-2.5" />
                                        <input
                                          type="file"
                                          accept="video/mp4,video/webm,video/quicktime"
                                          onChange={handleTrailerVideoUpload}
                                          className="hidden"
                                        />
                                      </label>
                                      <button
                                        type="button"
                                        onClick={() => setFormData((prev) => ({ ...prev, trailerUrl: '' }))}
                                        className="p-1 hover:bg-rose-500/30 text-neutral-400 hover:text-rose-300 rounded-none transition"
                                        title="Xóa video"
                                      >
                                        <Trash2 className="w-3 h-3" />
                                      </button>
                                    </div>
                                  </div>
                                )}
                              </div>

                              {/* 2. POSTER ĐỨNG */}
                              <div className="space-y-1">
                                <div className="flex items-center justify-between">
                                  <span className="text-[9px] uppercase tracking-wider text-neutral-300 font-bold block">
                                    Poster đứng <span className="text-amber-400">*</span>
                                  </span>
                                  {formData.posterUrl && (
                                    <span className="text-[8px] font-mono text-emerald-400 bg-emerald-500/10 px-1 py-0.2 rounded-none border border-emerald-500/20">
                                      Đã có
                                    </span>
                                  )}
                                </div>

                                {!formData.posterUrl ? (
                                  <div>
                                    <label className={`relative h-44 sm:h-48 flex flex-col items-center justify-center border border-dashed hover:border-amber-400/70 bg-black/50 hover:bg-neutral-900/60 rounded-none transition cursor-pointer p-3 text-center group ${
                                      hasAttemptedNextStep && !formData.posterUrl
                                        ? 'border-rose-500/80 bg-rose-950/20'
                                        : 'border-white/15'
                                    } ${isPosterUploading ? 'pointer-events-none' : ''}`}>
                                      {isPosterUploading ? (
                                        <div className="flex flex-col items-center gap-1.5 text-amber-400">
                                          <RefreshCw className="h-6 w-6 animate-spin" />
                                          <span className="text-[10px] font-bold tracking-wider">ĐANG TẢI LÊN...</span>
                                        </div>
                                      ) : (
                                        <div className="flex flex-col items-center gap-1.5">
                                          <div className="w-9 h-9 rounded-none bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 group-hover:scale-105 group-hover:bg-amber-500 group-hover:text-black transition duration-200">
                                            <ImageUp className="w-4 h-4" />
                                          </div>
                                          <span className="text-[11px] font-bold text-white group-hover:text-amber-300 transition">
                                            Tải lên Poster đứng
                                          </span>
                                          <span className="text-[9px] text-neutral-500 font-mono">
                                            Tỷ lệ 2:3
                                          </span>
                                        </div>
                                      )}
                                      <input
                                        type="file"
                                        accept="image/jpeg,image/png,image/webp"
                                        onChange={(event) => handleMovieImageUpload('posterUrl', 'movies/posters', event)}
                                        className="hidden"
                                      />
                                    </label>
                                    {hasAttemptedNextStep && !formData.posterUrl && (
                                      <p className="text-[10px] text-rose-400 font-medium pt-1">Bắt buộc tải lên Poster đứng</p>
                                    )}
                                  </div>
                                ) : (
                                  <div className="relative h-44 sm:h-48 rounded-none border border-amber-500/30 bg-black overflow-hidden group shadow-md flex items-center justify-center">
                                    {isPosterUploading && (
                                      <div className="absolute inset-0 z-30 bg-black/85 backdrop-blur-sm flex flex-col items-center justify-center gap-1.5">
                                        <RefreshCw className="h-6 w-6 animate-spin text-amber-400" />
                                        <span className="text-[10px] font-bold text-amber-300">Đang tải poster mới...</span>
                                      </div>
                                    )}
                                    <img
                                      src={formData.posterUrl}
                                      alt="Poster ambient"
                                      aria-hidden="true"
                                      className="absolute inset-0 w-full h-full object-cover blur-lg opacity-35 scale-125 pointer-events-none"
                                      referrerPolicy="no-referrer"
                                    />
                                    <img
                                      src={formData.posterUrl}
                                      alt="Poster phim"
                                      className="relative z-10 h-full w-auto max-w-full object-contain cursor-pointer transition duration-200 group-hover:scale-[1.02]"
                                      referrerPolicy="no-referrer"
                                      onClick={() => setMediaReviewModal({ type: 'image', url: formData.posterUrl, title: `Poster: ${formData.title || 'Phim'}` })}
                                      title="Click xem phóng to"
                                    />
                                    <div className="absolute top-1.5 right-1.5 z-20 flex items-center gap-1 opacity-90 group-hover:opacity-100 transition bg-black/80 backdrop-blur-md p-1 rounded-none border border-white/10">
                                      <button
                                        type="button"
                                        onClick={() => setMediaReviewModal({ type: 'image', url: formData.posterUrl, title: `Poster: ${formData.title || 'Phim'}` })}
                                        className="flex items-center gap-0.5 px-1.5 py-0.5 bg-amber-500/20 hover:bg-amber-500 text-amber-300 hover:text-black rounded-none text-[9px] font-bold transition"
                                        title="Xem phóng to"
                                      >
                                        <Eye className="w-3 h-3" /> Review
                                      </button>
                                      <label className="flex items-center gap-0.5 px-1.5 py-0.5 bg-white/10 hover:bg-white/20 text-white rounded-none text-[9px] font-bold cursor-pointer transition" title="Đổi poster">
                                        <RefreshCw className="w-2.5 h-2.5" />
                                        <input
                                          type="file"
                                          accept="image/jpeg,image/png,image/webp"
                                          onChange={(event) => handleMovieImageUpload('posterUrl', 'movies/posters', event)}
                                          className="hidden"
                                        />
                                      </label>
                                      <button
                                        type="button"
                                        onClick={() => setFormData((prev) => ({ ...prev, posterUrl: '' }))}
                                        className="p-1 hover:bg-rose-500/30 text-neutral-400 hover:text-rose-300 rounded-none transition"
                                        title="Xóa poster"
                                      >
                                        <Trash2 className="w-3 h-3" />
                                      </button>
                                    </div>
                                  </div>
                                )}
                              </div>

                              {/* 3. BANNER NGANG */}
                              <div className="space-y-1">
                                <div className="flex items-center justify-between">
                                  <span className="text-[9px] uppercase tracking-wider text-neutral-300 font-bold block">
                                    Banner ngang <span className="text-amber-400">*</span>
                                  </span>
                                  {formData.bannerUrl && (
                                    <span className="text-[8px] font-mono text-emerald-400 bg-emerald-500/10 px-1 py-0.2 rounded-none border border-emerald-500/20">
                                      Đã có
                                    </span>
                                  )}
                                </div>

                                {!formData.bannerUrl ? (
                                  <div>
                                    <label className={`relative h-44 sm:h-48 flex flex-col items-center justify-center border border-dashed hover:border-amber-400/70 bg-black/50 hover:bg-neutral-900/60 rounded-none transition cursor-pointer p-3 text-center group ${
                                      hasAttemptedNextStep && !formData.bannerUrl
                                        ? 'border-rose-500/80 bg-rose-950/20'
                                        : 'border-white/15'
                                    } ${isBannerUploading ? 'pointer-events-none' : ''}`}>
                                      {isBannerUploading ? (
                                        <div className="flex flex-col items-center gap-1.5 text-amber-400">
                                          <RefreshCw className="h-6 w-6 animate-spin" />
                                          <span className="text-[10px] font-bold tracking-wider">ĐANG TẢI LÊN...</span>
                                        </div>
                                      ) : (
                                        <div className="flex flex-col items-center gap-1.5">
                                          <div className="w-9 h-9 rounded-none bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 group-hover:scale-105 group-hover:bg-amber-500 group-hover:text-black transition duration-200">
                                            <ImageUp className="w-4 h-4" />
                                          </div>
                                          <span className="text-[11px] font-bold text-white group-hover:text-amber-300 transition">
                                            Tải lên Banner ngang
                                          </span>
                                          <span className="text-[9px] text-neutral-500 font-mono">
                                            Tỷ lệ 16:9
                                          </span>
                                        </div>
                                      )}
                                      <input
                                        type="file"
                                        accept="image/jpeg,image/png,image/webp"
                                        onChange={(event) => handleMovieImageUpload('bannerUrl', 'movies/banners', event)}
                                        className="hidden"
                                      />
                                    </label>
                                    {hasAttemptedNextStep && !formData.bannerUrl && (
                                      <p className="text-[10px] text-rose-400 font-medium pt-1">Bắt buộc tải lên Banner ngang</p>
                                    )}
                                  </div>
                                ) : (
                                  <div className="relative h-44 sm:h-48 rounded-none border border-amber-500/30 bg-black overflow-hidden group shadow-md flex items-center justify-center">
                                    {isBannerUploading && (
                                      <div className="absolute inset-0 z-30 bg-black/85 backdrop-blur-sm flex flex-col items-center justify-center gap-1.5">
                                        <RefreshCw className="h-6 w-6 animate-spin text-amber-400" />
                                        <span className="text-[10px] font-bold text-amber-300">Đang tải banner mới...</span>
                                      </div>
                                    )}
                                    <img
                                      src={formData.bannerUrl}
                                      alt="Banner ambient"
                                      aria-hidden="true"
                                      className="absolute inset-0 w-full h-full object-cover blur-lg opacity-35 scale-125 pointer-events-none"
                                      referrerPolicy="no-referrer"
                                    />
                                    <img
                                      src={formData.bannerUrl}
                                      alt="Banner phim"
                                      className="relative z-10 w-full h-full object-cover cursor-pointer transition duration-200 group-hover:scale-[1.02]"
                                      referrerPolicy="no-referrer"
                                      onClick={() => setMediaReviewModal({ type: 'image', url: formData.bannerUrl, title: `Banner: ${formData.title || 'Phim'}` })}
                                      title="Click xem phóng to"
                                    />
                                    <div className="absolute top-1.5 right-1.5 z-20 flex items-center gap-1 opacity-90 group-hover:opacity-100 transition bg-black/80 backdrop-blur-md p-1 rounded-none border border-white/10">
                                      <button
                                        type="button"
                                        onClick={() => setMediaReviewModal({ type: 'image', url: formData.bannerUrl, title: `Banner: ${formData.title || 'Phim'}` })}
                                        className="flex items-center gap-0.5 px-1.5 py-0.5 bg-amber-500/20 hover:bg-amber-500 text-amber-300 hover:text-black rounded-none text-[9px] font-bold transition"
                                        title="Xem phóng to"
                                      >
                                        <Eye className="w-3 h-3" /> Review
                                      </button>
                                      <label className="flex items-center gap-0.5 px-1.5 py-0.5 bg-white/10 hover:bg-white/20 text-white rounded-none text-[9px] font-bold cursor-pointer transition" title="Đổi banner">
                                        <RefreshCw className="w-2.5 h-2.5" />
                                        <input
                                          type="file"
                                          accept="image/jpeg,image/png,image/webp"
                                          onChange={(event) => handleMovieImageUpload('bannerUrl', 'movies/banners', event)}
                                          className="hidden"
                                        />
                                      </label>
                                      <button
                                        type="button"
                                        onClick={() => setFormData((prev) => ({ ...prev, bannerUrl: '' }))}
                                        className="p-1 hover:bg-rose-500/30 text-neutral-400 hover:text-rose-300 rounded-none transition"
                                        title="Xóa banner"
                                      >
                                        <Trash2 className="w-3 h-3" />
                                      </button>
                                    </div>
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        </motion.div>
                      )}

                      {/* STEP 3: KIỂM TRA & ĐĂNG */}
                      {movieFormStep === 3 && (
                        <motion.div initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.15 }} className="space-y-3">
                          <div className="grid gap-3 rounded-none border border-white/10 bg-black/40 p-3 sm:grid-cols-[72px_1fr]">
                            <div className="aspect-[2/3] overflow-hidden rounded-none border border-white/10 bg-neutral-950">
                              {formData.posterUrl ? (
                                <img src={formData.posterUrl} alt="Poster xem trước" className="h-full w-full object-cover" referrerPolicy="no-referrer" />
                              ) : (
                                <div className="grid h-full place-items-center text-neutral-600"><Film className="h-6 w-6" /></div>
                              )}
                            </div>
                            <div className="min-w-0">
                              <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-amber-400">Xem lại hồ sơ phim</p>
                              <h4 className="mt-0.5 truncate text-base font-black text-white">{formData.title || 'Chưa nhập tên phim'}</h4>
                              <p className="text-[11px] text-neutral-400">{formData.englishTitle || 'Chưa có tên gốc'}</p>
                              <div className="mt-2 flex flex-wrap gap-1.5 text-[10px] font-medium text-neutral-300">
                                <span className="rounded-none border border-white/10 bg-white/[0.04] px-2 py-0.5">{formData.duration || 0} phút</span>
                                <span className="rounded-none border border-white/10 bg-white/[0.04] px-2 py-0.5">{formData.ageRating || 'P'}</span>
                                <span className="rounded-none border border-white/10 bg-white/[0.04] px-2 py-0.5">{(formData.genreIds || []).length} thể loại</span>
                                <span className="rounded-none border border-white/10 bg-white/[0.04] px-2 py-0.5">{selectedActorIds.length} diễn viên</span>
                              </div>
                              <p className="mt-2 text-[10px] leading-relaxed text-neutral-400">
                                Kiểm tra thông tin trước khi xuất bản. Bạn có thể quay lại bước trước để chỉnh sửa.
                              </p>
                            </div>
                          </div>

                          <div className="space-y-1">
                            <div className="flex items-center justify-between">
                              <label className="text-[10px] uppercase tracking-wider text-neutral-300 font-bold block">
                                Nội dung phim <span className="text-amber-400">*</span>
                              </label>
                              <span className="text-[9px] text-neutral-500 font-mono">
                                {(formData.synopsis || '').length}/1000 ký tự
                              </span>
                            </div>
                            <textarea
                              rows={3}
                              maxLength={1000}
                              value={formData.synopsis}
                              onChange={(e) => setFormData({ ...formData, synopsis: e.target.value })}
                              placeholder="Nội dung tóm tắt phim, tối đa 1000 ký tự (bắt buộc)"
                              className={`w-full bg-black/80 border p-2.5 text-xs text-white rounded-none focus:outline-none focus:border-amber-400 leading-relaxed max-h-28 overflow-y-auto custom-scrollbar transition ${
                                hasAttemptedNextStep && !formData.synopsis?.trim()
                                  ? 'border-rose-500 bg-rose-950/20'
                                  : 'border-white/10'
                              }`}
                            />
                            {hasAttemptedNextStep && !formData.synopsis?.trim() && (
                              <p className="text-[10px] text-rose-400 font-medium">Bắt buộc nhập nội dung tóm tắt phim trước khi đăng</p>
                            )}
                          </div>
                        </motion.div>
                      )}
                    </div>

                    {/* FIXED MODAL FOOTER */}
                    <div className="flex flex-col-reverse items-stretch justify-between gap-3 border-t border-white/10 bg-black/40 px-5 py-2.5 sm:flex-row sm:items-center sm:px-6 shrink-0">
                      <button
                        type="button"
                        onClick={handleCloseMovieForm}
                        className="px-3 py-2 text-neutral-400 hover:text-white font-sans font-bold text-[10px] uppercase tracking-wider transition rounded-none"
                      >
                        Hủy thao tác
                      </button>
                      <div className="flex items-center gap-2">
                        {movieFormStep > 1 && (
                          <button
                            type="button"
                            onClick={() => goToMovieFormStep(movieFormStep - 1)}
                            className="flex flex-1 items-center justify-center gap-1.5 rounded-none border border-white/15 bg-neutral-900 px-4 py-2 text-xs font-bold uppercase tracking-wider text-neutral-200 transition hover:bg-neutral-800 sm:flex-none"
                          >
                            <ArrowLeft className="h-3.5 w-3.5" /> Quay lại
                          </button>
                        )}
                        {movieFormStep < 3 ? (
                          <button
                            type="button"
                            onClick={handleNextStep}
                            className="flex flex-1 items-center justify-center gap-1.5 rounded-none bg-amber-400 px-5 py-2 text-xs font-black uppercase tracking-wider text-black transition hover:bg-amber-300 sm:flex-none shadow-md shadow-amber-500/20 cursor-pointer active:scale-95"
                          >
                            Tiếp tục <ArrowRight className="h-3.5 w-3.5" />
                          </button>
                        ) : (
                          <button
                            type="submit"
                            disabled={isMovieSaving || isMovieMediaUploading || isDuplicateTitle}
                            className="flex-1 rounded-none bg-amber-400 px-5 py-2 text-xs font-black uppercase tracking-widest text-black shadow-lg shadow-amber-500/20 transition hover:bg-amber-300 disabled:cursor-not-allowed disabled:opacity-50 sm:flex-none"
                            title={isDuplicateTitle ? 'Không thể lưu khi tên phim bị trùng' : ''}
                          >
                            {isMovieMediaUploading
                              ? 'Đang tải file...'
                              : isMovieSaving
                                ? (editingMovie ? 'Đang cập nhật...' : 'Đang lưu...')
                                : isDuplicateTitle
                                  ? 'Trùng tên phim'
                                  : (editingMovie ? 'Cập nhật phim' : 'Đăng phim')}
                          </button>
                        )}
                      </div>
                    </div>
                  </form>
                </motion.div>
              </div>
            )}
          </AnimatePresence>

          {/* Modal Review Phóng To Media (Video / Poster / Banner) */}
          <AnimatePresence>
            {mediaReviewModal && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-[200] flex items-center justify-center bg-black/90 backdrop-blur-md p-4"
                onClick={() => setMediaReviewModal(null)}
              >
                <motion.div
                  initial={{ scale: 0.95, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0.95, opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className="relative max-w-5xl w-full max-h-[92vh] bg-[#0d0f14] border border-amber-500/40 rounded-none shadow-2xl p-4 sm:p-6 flex flex-col gap-3"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="flex items-center justify-between pb-3 border-b border-white/10">
                    <div className="flex items-center gap-2.5">
                      <span className="h-2.5 w-2.5 rounded-full bg-amber-400 animate-pulse" />
                      <h4 className="text-sm sm:text-base font-bold uppercase tracking-wider text-white">
                        {mediaReviewModal.title}
                      </h4>
                    </div>
                    <div className="flex items-center gap-3">
                      <a
                        href={mediaReviewModal.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-1.5 text-neutral-400 hover:text-white border border-white/10 hover:border-white/30 rounded-none transition"
                        title="Mở tab mới"
                      >
                        <Globe2 className="h-4 w-4" />
                      </a>
                      <button
                        type="button"
                        onClick={() => setMediaReviewModal(null)}
                        className="p-1.5 text-neutral-400 hover:text-white border border-white/10 hover:border-white/30 rounded-none transition"
                        title="Đóng cửa sổ"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  </div>

                  <div className="flex-1 min-h-[300px] max-h-[70vh] bg-black border border-white/10 flex items-center justify-center overflow-hidden">
                    {mediaReviewModal.type === 'video' ? (
                      <video
                        src={mediaReviewModal.url}
                        controls
                        autoPlay
                        playsInline
                        className="max-h-[72vh] w-auto max-w-full rounded-none shadow-2xl"
                      />
                    ) : (
                      <img
                        src={mediaReviewModal.url}
                        alt={mediaReviewModal.title}
                        className="max-h-[72vh] w-auto max-w-full object-contain rounded-none shadow-2xl"
                      />
                    )}
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-white/10 text-xs text-neutral-400">
                    <span className="font-mono text-[11px] truncate max-w-md">{mediaReviewModal.url}</span>
                    <button
                      type="button"
                      onClick={() => setMediaReviewModal(null)}
                      className="px-4 py-1.5 bg-neutral-800 hover:bg-neutral-700 text-white font-bold rounded-none text-xs transition"
                    >
                      Đóng
                    </button>
                  </div>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* LIST OF MOVIES IN DATABASE - Workflow-aware table layout */}
          {(() => {
            const renderMovieRow = (mv) => {
              const movieId = mv.backendId ?? mv.id;
              const publication = String(mv.publicationStatus || 'UNPUBLISHED').toUpperCase();

              const pubBadge = getPublicationBadge(mv.publicationStatus);

              return (
                <tr key={mv.id} className="hover:bg-white/[0.02] transition-all">
                  <td
                    className="py-3.5 px-4 shrink-0 cursor-pointer"
                    onClick={() => handleOpenMovieDetailModal(mv)}
                    title="Bấm để xem chi tiết phim"
                  >
                    {mv.posterUrl && mv.posterUrl !== 'https://res.cloudinary.com/dmcodhbcc/image/upload/v1784275470/cinemams/posters/placeholder.jpg' ? (
                      <img
                        src={mv.posterUrl}
                        alt={mv.title}
                        className="w-10 h-14 object-cover border border-white/[0.08] rounded-none hover:border-amber-400 transition"
                        referrerPolicy="no-referrer"
                      />
                    ) : (
                      <div className="w-10 h-14 bg-neutral-900 border border-white/10 flex items-center justify-center text-neutral-500 rounded-none hover:border-amber-400 transition">
                        <Film className="w-5 h-5" />
                      </div>
                    )}
                  </td>
                  <td className="py-3.5 px-4 font-sans">
                    <div
                      onClick={() => handleOpenMovieDetailModal(mv)}
                      className="font-sans text-sm text-white font-bold truncate max-w-xs cursor-pointer hover:text-amber-400 transition"
                      title="Bấm để xem chi tiết phim"
                    >
                      {mv.title}
                    </div>
                    <div className="text-[10px] text-neutral-300 truncate max-w-xs">{mv.englishTitle}</div>
                    <div className="flex gap-2 items-center mt-1">
                      <span className="text-[9.5px] border border-white/[0.05] bg-[#060606] px-1.5 py-0.5 text-neutral-200 font-mono rounded-none">{mv.duration} phút</span>
                      <span className={`text-[9.5px] px-1.5 py-0.5 font-bold rounded-none ${mv.ageRating === 'T18' ? 'bg-red-950/20 text-red-400 border border-red-500/20' : 'bg-neutral-900 text-neutral-200'}`}>{mv.ageRating}</span>
                      {mv.director && <span className="text-[9px] text-neutral-500 truncate max-w-[120px]">🎬 {mv.director}</span>}
                    </div>
                  </td>
                  <td className="py-3.5 px-4">
                    <span className="text-[10.5px] text-neutral-200 font-medium">{Array.isArray(mv.genre) ? mv.genre.join(' • ') : mv.genre}</span>
                  </td>
                  <td className="py-3.5 px-4 whitespace-nowrap">
                    <span className={`inline-flex items-center px-2 py-1 ${pubBadge.color} border text-[9px] uppercase font-bold tracking-wider rounded-none select-none shrink-0 h-6`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${pubBadge.dot} mr-1.5`}></span>
                      {pubBadge.label}
                    </span>
                  </td>
                  <td className="py-3.5 px-4 text-right">
                    <div className="flex flex-wrap justify-end gap-1.5">
                      {publication !== 'ARCHIVED' && (
                        <>
                          <button
                            type="button"
                            onClick={() => handleOpenMovieDetailModal(mv)}
                            className="p-1.5 text-neutral-300 border border-white/10 bg-white/5 hover:border-amber-400 hover:bg-amber-500/10 hover:text-amber-300 transition rounded-none"
                            title="Xem chi tiết"
                          >
                            <Eye className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleEditMovie(mv)}
                            className="p-1.5 text-amber-300 border border-amber-500/30 bg-amber-500/10 hover:bg-amber-400 hover:text-black transition rounded-none"
                            title="Chỉnh sửa thông tin phim"
                          >
                            <Edit3 className="h-3.5 w-3.5" />
                          </button>
                          {publication === 'PUBLISHED' && (
                            <button
                              type="button"
                              onClick={() => handleUnpublishMovie(mv)}
                              className="p-1.5 text-neutral-300 border border-white/10 bg-neutral-800 hover:border-amber-400/50 hover:bg-neutral-700 hover:text-white transition rounded-none"
                              title="Gỡ xuất bản khỏi website"
                            >
                              <EyeOff className="h-3.5 w-3.5" />
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => changeAdminSection?.('showtimes')}
                            className="p-1.5 text-indigo-300 border border-indigo-500/30 bg-indigo-500/10 hover:bg-indigo-500 hover:text-white transition rounded-none"
                            title="Tạo suất chiếu cho phim này"
                          >
                            <Calendar className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleArchiveMovie(mv)}
                            className="p-1.5 text-neutral-400 border border-white/10 bg-white/5 hover:border-red-500/30 hover:bg-red-500/10 hover:text-red-400 transition rounded-none"
                            title="Lưu trữ phim"
                          >
                            <Archive className="h-3.5 w-3.5" />
                          </button>
                        </>
                      )}

                      {/* ARCHIVED actions */}
                      {publication === 'ARCHIVED' && (
                        <>
                          <button
                            type="button"
                            onClick={() => handleOpenMovieDetailModal(mv)}
                            className="p-1.5 text-neutral-300 border border-white/10 bg-white/5 hover:border-amber-400 hover:bg-amber-500/10 hover:text-amber-300 transition rounded-none"
                            title="Xem chi tiết"
                          >
                            <Eye className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleEditMovie(mv)}
                            className="p-1.5 text-amber-300 border border-amber-500/30 bg-amber-500/10 hover:bg-amber-400 hover:text-black transition rounded-none"
                            title="Chỉnh sửa thông tin phim đã lưu trữ"
                          >
                            <Edit3 className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleUnarchiveMovie(mv)}
                            className="p-1.5 text-emerald-400 border border-emerald-500/30 bg-emerald-500/10 hover:bg-emerald-500 hover:text-white transition rounded-none"
                            title="Lấy ra lại (Khôi phục khỏi lưu trữ)"
                          >
                            <Undo2 className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteMovie(mv)}
                            className="p-1.5 text-rose-400 border border-rose-500/30 bg-rose-500/10 hover:bg-rose-500 hover:text-white transition rounded-none"
                            title="Xóa vĩnh viễn"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </>
                      )}

                    </div>
                  </td>
                </tr>
              );
            };

            const isDraftTab = filmFilter === 'DRAFT';
            const hasAnyDraft = displayedDrafts.length > 0 || filteredMovies.length > 0;

            return (
              <div className="border border-white/[0.05] bg-neutral-950 overflow-x-auto shadow-md">
                <table className="w-full text-left border-collapse min-w-[800px]">
                  <thead>
                    <tr className="border-b border-white/[0.05] bg-black text-neutral-300 text-[9.5px] uppercase font-bold tracking-wider">
                      <th className="py-3 px-4">Hình ảnh</th>
                      <th className="py-3 px-4">Tên phim & Thời lượng</th>
                      <th className="py-3 px-4">Thể loại</th>
                      <th className="py-3 px-4">Xuất bản</th>
                      <th className="py-3 px-4 text-right">Thao tác</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/[0.03] text-xs">
                    {isDraftTab ? (
                      hasAnyDraft ? (
                        <>
                          {/* 1. Bản nháp tự động / cục bộ lưu trên máy */}
                          {displayedDrafts.map((draft) => {
                            const form = draft.formData || {};
                            const draftTitle = form.title || '(Chưa đặt tên phim)';
                            const draftGenres = form.genre || (form.genreIds?.length ? `${form.genreIds.length} thể loại` : 'Chưa chọn thể loại');
                            return (
                              <tr key={draft.id} className="hover:bg-white/[0.02] transition-all bg-amber-500/[0.02]">
                                <td className="py-3.5 px-4 shrink-0">
                                  {form.posterUrl ? (
                                    <img
                                      src={form.posterUrl}
                                      alt={draftTitle}
                                      className="w-10 h-14 object-cover border border-amber-500/40 rounded-none"
                                      referrerPolicy="no-referrer"
                                    />
                                  ) : (
                                    <div className="w-10 h-14 bg-neutral-900 border border-white/10 flex items-center justify-center text-neutral-500 rounded-none">
                                      <Film className="w-5 h-5" />
                                    </div>
                                  )}
                                </td>
                                <td className="py-3.5 px-4 font-sans">
                                  <div className="font-sans text-sm text-white font-bold truncate max-w-xs flex items-center gap-2">
                                    <span>{draftTitle}</span>
                                    <span className="text-[9px] font-mono px-1.5 py-0.5 rounded-none bg-amber-500/20 text-amber-300 border border-amber-500/40 uppercase font-bold shrink-0">
                                      Bản nháp tự động
                                    </span>
                                  </div>
                                  <div className="text-[10px] text-neutral-400 truncate max-w-xs">
                                    {form.englishTitle || 'Bản ghi dở dang (lưu trên máy)'}
                                  </div>
                                  <div className="flex gap-2 items-center mt-1">
                                    {form.duration ? (
                                      <span className="text-[9.5px] border border-white/[0.05] bg-[#060606] px-1.5 py-0.5 text-neutral-200 font-mono rounded-none">
                                        {form.duration} phút
                                      </span>
                                    ) : null}
                                    {form.ageRating ? (
                                      <span className="text-[9.5px] px-1.5 py-0.5 font-bold bg-neutral-900 text-neutral-200 rounded-none">
                                        {form.ageRating}
                                      </span>
                                    ) : null}
                                  </div>
                                </td>
                                <td className="py-3.5 px-4">
                                  <span className="text-[10.5px] text-neutral-200 font-medium truncate block max-w-xs">
                                    {draftGenres}
                                  </span>
                                </td>
                                <td className="py-3.5 px-4 whitespace-nowrap">
                                  <div className="flex flex-col items-start gap-1">
                                    <span className="inline-flex items-center px-2 py-1 bg-yellow-950/30 text-yellow-300 border border-yellow-500/30 text-[9px] uppercase font-bold tracking-wider rounded-none select-none">
                                      <span className="w-1.5 h-1.5 rounded-full bg-yellow-400 mr-1.5 animate-pulse" />
                                      BẢN NHÁP CỤC BỘ
                                    </span>
                                    <span className="text-[9.5px] text-neutral-400 font-mono">
                                      Lưu: {formatDraftTime(draft.savedAt || draft.updatedAt)}
                                    </span>
                                  </div>
                                </td>
                                <td className="py-3.5 px-4 whitespace-nowrap">
                                  <span className="text-[10px] text-neutral-500 italic">Chưa đăng</span>
                                </td>
                                <td className="py-3.5 px-4 text-right whitespace-nowrap">
                                  <div className="flex items-center justify-end gap-1.5">
                                    <button
                                      type="button"
                                      onClick={() => handleResumeDraft(draft)}
                                      className="p-1.5 bg-amber-500 hover:bg-amber-400 text-black border border-amber-500 transition rounded-none"
                                      title="Mở lại bản nháp này để tiếp tục chỉnh sửa"
                                    >
                                      <Edit3 className="h-3.5 w-3.5" />
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => handleDeleteDraft(draft.id)}
                                      className="p-1.5 text-rose-400 border border-rose-500/30 bg-rose-500/10 hover:bg-rose-500 hover:text-white transition rounded-none"
                                      title="Xóa bản nháp này"
                                    >
                                      <Trash2 className="h-3.5 w-3.5" />
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            );
                          })}

                          {/* 2. Các phim bản nháp đã lưu trên hệ thống backend */}
                          {filteredMovies.map(renderMovieRow)}
                        </>
                      ) : (
                        <tr>
                          <td colSpan={5} className="py-16 text-center">
                            <div className="flex flex-col items-center justify-center gap-3 text-neutral-400">
                              <div className="w-12 h-12 rounded-none bg-white/5 border border-white/10 flex items-center justify-center text-neutral-500">
                                <FileText className="w-6 h-6" />
                              </div>
                              <p className="text-sm font-bold text-neutral-300">Không có bản nháp phim nào</p>
                              <p className="text-xs text-neutral-500 max-w-sm">
                                Khi bạn đang thêm phim vào thư viện mà đóng ngang hoặc chọn "Lưu bản nháp", bản nháp sẽ tự động xuất hiện tại đây để tiếp tục chỉnh sửa.
                              </p>
                              <button
                                type="button"
                                onClick={handleStartCreateMovie}
                                className="mt-2 px-4 py-2 bg-amber-500 hover:bg-amber-400 text-black font-bold text-xs uppercase tracking-wider rounded-none transition"
                              >
                                + Tạo phim mới
                              </button>
                            </div>
                          </td>
                        </tr>
                      )
                    ) : (
                      /* KHI Ở CÁC TAB KHÁC */
                      filteredMovies.length > 0 ? (
                        filteredMovies.map(renderMovieRow)
                      ) : (
                        <tr>
                          <td colSpan={5} className="py-16 text-center">
                            <div className="flex flex-col items-center justify-center gap-3 text-neutral-400">
                              <div className="w-12 h-12 rounded-none bg-white/5 border border-white/10 flex items-center justify-center text-neutral-500">
                                <Film className="w-6 h-6" />
                              </div>
                              <p className="text-sm font-bold text-neutral-300">
                                {filmFilter === 'PUBLISHED' ? 'Không có phim nào đã xuất bản' :
                                 filmFilter === 'ARCHIVED' ? 'Không có phim nào được lưu trữ' :
                                 'Không tìm thấy phim phù hợp'}
                              </p>
                              <button
                                type="button"
                                onClick={handleStartCreateMovie}
                                className="mt-2 px-4 py-2 bg-amber-500 hover:bg-amber-400 text-black font-bold text-xs uppercase tracking-wider rounded-none transition"
                              >
                                + Tạo phim mới
                              </button>
                            </div>
                          </td>
                        </tr>
                      )
                    )}
                  </tbody>
                </table>
              </div>
            );
          })()}

          {/* Footer Pagination */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border border-white/[0.05] bg-black p-3 text-[10px] uppercase tracking-[0.16em] text-neutral-200">
            <span>
              {filmFilter === 'DRAFT'
                ? `Tổng ${displayedDrafts.length + filteredMovies.length} bản nháp phim trong hệ thống`
                : `Tổng ${adminMoviePagination.totalElements} phim - Trang ${adminMoviePagination.page + 1}/${adminMoviePagination.totalPages}`}
            </span>
            {filmFilter !== 'DRAFT' && (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={adminMoviePagination.page <= 0}
                  onClick={() => setAdminMoviePagination((prev) => ({ ...prev, page: Math.max(0, prev.page - 1) }))}
                  className="border border-white/[0.06] px-3 py-2 text-white disabled:opacity-30 hover:border-white transition"
                >
                  Trước
                </button>
                <button
                  type="button"
                  disabled={adminMoviePagination.page + 1 >= adminMoviePagination.totalPages}
                  onClick={() => setAdminMoviePagination((prev) => ({ ...prev, page: Math.min(prev.totalPages - 1, prev.page + 1) }))}
                  className="border border-white/[0.06] px-3 py-2 text-white disabled:opacity-30 hover:border-white transition"
                >
                  Sau
                </button>
              </div>
            )}
          </div>

          {/* ═══════════ REJECT MODAL ═══════════ */}
          <AnimatePresence>
            {rejectModal && (
              <div
                className="fixed inset-0 z-[160] flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm"
                onClick={() => setRejectModal(null)}
              >
                <motion.div
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ duration: 0.2 }}
                  className="relative w-full max-w-lg bg-[#0d0f14] border border-red-500/30 rounded-none shadow-2xl p-6 space-y-4"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="flex items-center gap-3 border-b border-white/10 pb-3">
                    <div className="flex h-10 w-10 items-center justify-center border border-red-500/30 bg-red-500/10 text-red-400 rounded-none shrink-0">
                      <ThumbsDown className="h-5 w-5" />
                    </div>
                    <div>
                      <h3 className="text-sm font-black uppercase tracking-wider text-white">Từ chối duyệt phim</h3>
                      <p className="text-[10px] text-neutral-400 truncate max-w-sm">{rejectModal.movie?.title}</p>
                    </div>
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-wider text-neutral-300 mb-2">
                      Lý do từ chối <span className="text-red-400">*</span> (bắt buộc)
                    </label>
                    <textarea
                      value={rejectModal.reason || ''}
                      onChange={(e) => setRejectModal((prev) => ({ ...prev, reason: e.target.value }))}
                      placeholder="Nhập lý do cụ thể tại sao phim bị từ chối (ví dụ: poster chất lượng kém, thông tin chưa đầy đủ, nội dung vi phạm...)..."
                      rows={4}
                      className="w-full bg-black border border-white/[0.06] focus:border-red-400 p-3 text-xs text-white focus:outline-none focus:ring-0 placeholder:text-neutral-500 resize-none rounded-none"
                      autoFocus
                    />
                    {rejectModal.reason !== undefined && !rejectModal.reason?.trim() && (
                      <p className="text-[10px] text-red-400 mt-1">⚠ Bắt buộc nhập lý do từ chối!</p>
                    )}
                  </div>

                  <div className="flex justify-end gap-3 pt-2 border-t border-white/10">
                    <button
                      type="button"
                      onClick={() => setRejectModal(null)}
                      className="px-4 py-2.5 border border-white/15 bg-neutral-900 hover:bg-neutral-800 text-neutral-300 hover:text-white font-bold text-xs uppercase tracking-wider transition rounded-none"
                    >
                      HỦY BỎ
                    </button>
                    <button
                      type="button"
                      disabled={!rejectModal.reason?.trim()}
                      onClick={async () => {
                        await handleRejectMovie(rejectModal.movie, rejectModal.reason.trim());
                        setRejectModal(null);
                      }}
                      className="px-5 py-2.5 bg-red-600 hover:bg-red-500 text-white font-black text-xs uppercase tracking-widest transition shadow-lg disabled:cursor-not-allowed disabled:opacity-50 rounded-none flex items-center gap-2"
                    >
                      <ThumbsDown className="h-3.5 w-3.5" /> XÁC NHẬN TỪ CHỐI
                    </button>
                  </div>
                </motion.div>
              </div>
            )}
          </AnimatePresence>

          {/* ═══════════ APPROVAL HISTORY MODAL ═══════════ */}
          <AnimatePresence>
            {approvalHistoryModal && (
              <div
                className="fixed inset-0 z-[160] flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm"
                onClick={() => setApprovalHistoryModal(null)}
              >
                <motion.div
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ duration: 0.2 }}
                  className="relative w-full max-w-2xl max-h-[80vh] bg-[#0d0f14] border border-amber-500/30 rounded-none shadow-2xl p-6 space-y-4 overflow-y-auto custom-scrollbar"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="flex items-center gap-3 border-b border-white/10 pb-3">
                    <div className="flex h-10 w-10 items-center justify-center border border-amber-500/30 bg-amber-500/10 text-amber-400 rounded-none shrink-0">
                      <History className="h-5 w-5" />
                    </div>
                    <div>
                      <h3 className="text-sm font-black uppercase tracking-wider text-white">Lịch sử duyệt phim</h3>
                      <p className="text-[10px] text-neutral-400 truncate max-w-sm">{approvalHistoryModal.movie?.title}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setApprovalHistoryModal(null)}
                      className="ml-auto p-1.5 text-neutral-400 hover:text-white border border-white/10 hover:border-white/30 rounded-none transition"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>

                  {approvalHistoryModal.history?.length > 0 ? (
                    <div className="space-y-3">
                      {approvalHistoryModal.history.map((entry, idx) => {
                        const actionColors = {
                          SUBMITTED: 'border-blue-500/30 bg-blue-500/10 text-blue-300',
                          WITHDRAWN: 'border-neutral-500/30 bg-neutral-500/10 text-neutral-300',
                          APPROVED: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300',
                          REJECTED: 'border-red-500/30 bg-red-500/10 text-red-300',
                          RESUBMITTED: 'border-amber-500/30 bg-amber-500/10 text-amber-300',
                          PUBLISHED: 'border-green-500/30 bg-green-500/10 text-green-300',
                          ARCHIVED: 'border-neutral-500/30 bg-neutral-500/10 text-neutral-400',
                          UNARCHIVED: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300'
                        };
                        const actionLabels = {
                          SUBMITTED: 'Gửi duyệt', WITHDRAWN: 'Rút duyệt', APPROVED: 'Phê duyệt',
                          REJECTED: 'Từ chối', RESUBMITTED: 'Gửi duyệt lại', PUBLISHED: 'Xuất bản', ARCHIVED: 'Lưu trữ',
                          UNARCHIVED: 'Khôi phục lưu trữ'
                        };
                        const colorClass = actionColors[entry.action] || 'border-white/10 bg-white/5 text-neutral-300';
                        return (
                          <div key={entry.id || idx} className={`border ${colorClass} rounded-none p-3 flex gap-3`}>
                            <div className="shrink-0 w-6 h-6 rounded-none bg-white/10 flex items-center justify-center text-[10px] font-bold text-white">
                              {approvalHistoryModal.history.length - idx}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-[10px] font-bold uppercase tracking-wider">
                                  {actionLabels[entry.action] || entry.action}
                                </span>
                                <span className="text-[9px] text-neutral-500 font-mono">
                                  {entry.fromStatus && `${entry.fromStatus} → ${entry.toStatus}`}
                                </span>
                              </div>
                              {entry.comment && (
                                <p className="text-[10px] text-neutral-300 mt-1">💬 {entry.comment}</p>
                              )}
                              <div className="flex items-center gap-3 mt-1.5 text-[9px] text-neutral-500">
                                {entry.actorUserName && <span>👤 {entry.actorUserName}</span>}
                                {entry.createdAt && (
                                  <span>🕐 {new Date(entry.createdAt).toLocaleString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="py-8 text-center text-neutral-500">
                      <History className="w-8 h-8 mx-auto mb-2 opacity-30" />
                      <p className="text-xs">Chưa có lịch sử duyệt nào.</p>
                    </div>
                  )}

                  <div className="flex justify-end pt-2 border-t border-white/10">
                    <button
                      type="button"
                      onClick={() => setApprovalHistoryModal(null)}
                      className="px-4 py-2 bg-neutral-800 hover:bg-neutral-700 text-white font-bold text-xs rounded-none transition"
                    >
                      ĐÓNG
                    </button>
                  </div>
                </motion.div>
              </div>
            )}
          </AnimatePresence>

          {/* ═══════════ MOVIE LIBRARY DETAIL POPUP (MODAL) ═══════════ */}
          <AnimatePresence>
            {movieDetailModal && (
              <div
                className="fixed inset-0 z-[160] flex items-center justify-center p-3 sm:p-6 bg-black/85 backdrop-blur-md"
                onClick={() => setMovieDetailModal(null)}
              >
                <motion.div
                  initial={{ opacity: 0, scale: 0.95, y: 15 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95, y: 15 }}
                  transition={{ duration: 0.2 }}
                  className="relative w-full max-w-4xl max-h-[92vh] bg-[#0d0f14] border border-amber-500/30 rounded-none shadow-2xl overflow-hidden flex flex-col"
                  onClick={(e) => e.stopPropagation()}
                >
                  {/* Modal Header */}
                  <div className="flex items-center justify-between px-6 py-4 bg-neutral-900/90 border-b border-white/10 shrink-0">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-none bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 shrink-0">
                        <Film className="w-5 h-5" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="text-sm font-black uppercase tracking-wider text-white">
                            Chi tiết phim thư viện
                          </h3>
                          <span className="text-[10px] font-mono px-2 py-0.5 rounded-none bg-white/5 border border-white/10 text-amber-300">
                            #{movieDetailModal.backendId ?? movieDetailModal.id}
                          </span>
                        </div>
                        <p className="text-[11px] text-neutral-400 truncate max-w-sm sm:max-w-md">
                          {movieDetailModal.title} {movieDetailModal.englishTitle ? `• ${movieDetailModal.englishTitle}` : ''}
                        </p>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => setMovieDetailModal(null)}
                      className="p-1.5 text-neutral-400 hover:text-white border border-white/10 hover:border-white/30 rounded-none transition"
                      title="Đóng popup"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>

                  {/* Modal Body */}
                  <div className="p-5 sm:p-7 overflow-y-auto space-y-6 [scrollbar-width:thin] [scrollbar-color:rgba(245,158,11,0.3)_transparent]">
                    {/* Top Hero Card */}
                    <div className="relative rounded-none border border-white/10 overflow-hidden bg-neutral-950 p-5">
                      {movieDetailModal.bannerUrl && (
                        <>
                          <div
                            className="absolute inset-0 bg-cover bg-center opacity-20 filter blur-xs"
                            style={{ backgroundImage: `url(${movieDetailModal.bannerUrl})` }}
                          />
                          <div className="absolute inset-0 bg-gradient-to-r from-black via-black/85 to-black/60" />
                        </>
                      )}

                      <div className="relative z-10 flex flex-col sm:flex-row gap-5 items-start">
                        {/* Poster */}
                        <div className="w-32 sm:w-36 aspect-[2/3] rounded-none overflow-hidden border border-white/20 bg-black shrink-0 shadow-xl relative">
                          {movieDetailModal.posterUrl ? (
                            <img
                              src={movieDetailModal.posterUrl}
                              alt={movieDetailModal.title}
                              className="w-full h-full object-cover"
                              referrerPolicy="no-referrer"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-neutral-500">
                              <Film className="w-8 h-8" />
                            </div>
                          )}
                          {movieDetailModal.ageRating && (
                            <span className="absolute top-2 left-2 px-1.5 py-0.5 text-[9px] font-black uppercase rounded-none bg-black/80 text-white border border-white/20">
                              {movieDetailModal.ageRating}
                            </span>
                          )}
                        </div>

                        {/* Summary info & Statuses */}
                        <div className="space-y-2.5 flex-1 min-w-0">
                          {(() => {
                            const detailPubBadge = getPublicationBadge(movieDetailModal.publicationStatus);
                            const detailScreeningBadge = getScreeningBadge(movieDetailModal);
                            return (
                              <div className="flex flex-wrap items-center gap-2">
                                {/* Publication Badge */}
                                <span className={`inline-flex items-center px-2 py-0.5 ${detailPubBadge.color} border text-[9.5px] uppercase font-bold tracking-wider rounded-none select-none h-6`}>
                                  <span className={`w-1.5 h-1.5 rounded-full ${detailPubBadge.dot} mr-1.5`}></span>
                                  {detailPubBadge.label}
                                </span>

                                {/* Screening Status Badge */}
                                {detailScreeningBadge && (
                                  <span className={`inline-flex items-center px-2 py-0.5 ${detailScreeningBadge.color} border text-[9.5px] uppercase font-bold tracking-wider rounded-none select-none h-6`}>
                                    <span className={`w-1.5 h-1.5 rounded-full ${detailScreeningBadge.dot} mr-1.5`}></span>
                                    {detailScreeningBadge.label}
                                  </span>
                                )}
                              </div>
                            );
                          })()}

                          <div>
                            <h4 className="text-xl sm:text-2xl font-serif font-black text-white uppercase leading-snug">
                              {movieDetailModal.title}
                            </h4>
                            {movieDetailModal.englishTitle && (
                              <p className="text-xs text-amber-400/90 uppercase tracking-wider font-mono">
                                {movieDetailModal.englishTitle}
                              </p>
                            )}
                          </div>

                          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-neutral-300">
                            <span className="flex items-center gap-1">
                              <Clock className="w-3.5 h-3.5 text-amber-400" />
                              <strong>{formatDurationVi(movieDetailModal.duration)}</strong>
                            </span>
                            <span className="flex items-center gap-1">
                              <Calendar className="w-3.5 h-3.5 text-amber-400" />
                              Khởi chiếu: <strong>{movieDetailModal.releaseDate || 'Đang cập nhật'}</strong>
                            </span>
                            {movieDetailModal.endDate && (
                              <span className="flex items-center gap-1 text-neutral-400">
                                Kết thúc: <strong>{movieDetailModal.endDate}</strong>
                              </span>
                            )}
                          </div>

                        </div>
                      </div>
                    </div>

                    {/* Full Specifications Grid */}
                    <div className="bg-neutral-900/60 border border-white/10 rounded-none p-5 space-y-4">
                      <h5 className="text-xs font-black uppercase tracking-wider text-amber-400 flex items-center gap-2 border-b border-white/8 pb-2.5">
                        <Info className="w-4 h-4" /> Thông số kỹ thuật & Bản quyền phim
                      </h5>

                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 text-xs">
                        <div>
                          <span className="text-[10px] uppercase tracking-wider text-neutral-400 block mb-0.5">Đạo diễn</span>
                          <p className="font-semibold text-white">{movieDetailModal.director || 'Đang cập nhật'}</p>
                        </div>

                        <div>
                          <span className="text-[10px] uppercase tracking-wider text-neutral-400 block mb-0.5">Diễn viên chính</span>
                          <p className="font-semibold text-white">{movieDetailModal.mainActors || movieDetailModal.castList || 'Đang cập nhật'}</p>
                        </div>

                        <div>
                          <span className="text-[10px] uppercase tracking-wider text-neutral-400 block mb-0.5">Thể loại</span>
                          <p className="font-semibold text-white">
                            {Array.isArray(movieDetailModal.genre)
                              ? movieDetailModal.genre.join(', ')
                              : (movieDetailModal.genre || 'Đang cập nhật')}
                          </p>
                        </div>

                        <div>
                          <span className="text-[10px] uppercase tracking-wider text-neutral-400 block mb-0.5">Thời lượng</span>
                          <p className="font-semibold text-white">{formatDurationVi(movieDetailModal.duration)}</p>
                        </div>

                        <div>
                          <span className="text-[10px] uppercase tracking-wider text-neutral-400 block mb-0.5">Ngôn ngữ bản quyền</span>
                          <p className="font-semibold text-white">{movieDetailModal.language || 'Bản ngữ / Quốc tế'}</p>
                        </div>

                        <div>
                          <span className="text-[10px] uppercase tracking-wider text-neutral-400 block mb-0.5">Phụ đề & Thuyết minh</span>
                          <p className="font-semibold text-white">{movieDetailModal.subtitleLanguage || 'Phụ đề Tiếng Việt'}</p>
                        </div>

                        <div>
                          <span className="text-[10px] uppercase tracking-wider text-neutral-400 block mb-0.5">Phân loại độ tuổi rạp</span>
                          <div className="flex items-center gap-1.5">
                            <span className="px-1.5 py-0.5 rounded-none text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                              {movieDetailModal.ageRating || 'P'}
                            </span>
                            <span className="text-neutral-300 font-semibold">
                              {AGE_RATING_EXPLAIN[movieDetailModal.ageRating]?.name || 'Tiêu chuẩn rạp'}
                            </span>
                          </div>
                          <p className="text-[9.5px] text-neutral-400 mt-0.5">
                            {AGE_RATING_EXPLAIN[movieDetailModal.ageRating]?.desc || ''}
                          </p>
                        </div>


                        {movieDetailModal.publishedAt && (
                          <div>
                            <span className="text-[10px] uppercase tracking-wider text-neutral-400 block mb-0.5">Ngày xuất bản</span>
                            <p className="font-semibold text-white">
                              {new Date(movieDetailModal.publishedAt).toLocaleDateString('vi-VN')}
                            </p>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Synopsis */}
                    <div className="bg-neutral-900/40 border border-white/8 rounded-none p-5 space-y-2">
                      <h5 className="text-xs font-black uppercase tracking-wider text-neutral-300 flex items-center gap-2">
                        <FileText className="w-3.5 h-3.5 text-amber-400" /> Tóm tắt nội dung phim
                      </h5>
                      <p className="text-xs text-neutral-300 leading-relaxed font-sans whitespace-pre-line">
                        {movieDetailModal.synopsis || 'Chưa có tóm tắt nội dung cho phim này.'}
                      </p>
                    </div>

                    {/* Cast members with avatars */}
                    {Array.isArray(movieDetailModal.actors) && movieDetailModal.actors.length > 0 && (
                      <div className="space-y-2.5">
                        <h5 className="text-xs font-black uppercase tracking-wider text-neutral-300 flex items-center gap-2">
                          <Users className="w-3.5 h-3.5 text-amber-400" /> Diễn viên tham gia ({movieDetailModal.actors.length})
                        </h5>
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2.5">
                          {movieDetailModal.actors.map((actor, idx) => (
                            <div key={actor.id ?? idx} className="flex items-center gap-2.5 p-2 rounded-none bg-neutral-900/60 border border-white/8">
                              <div className="w-8 h-8 rounded-none overflow-hidden bg-neutral-800 border border-white/10 shrink-0">
                                {actor.avatarUrl ? (
                                  <img src={actor.avatarUrl} alt={actor.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" onError={(e) => { e.currentTarget.onerror = null; e.currentTarget.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(actor.name || "A")}&background=1a1a1a&color=f59e0b&size=64&bold=true`; }} />
                                ) : (
                                  <div className="w-full h-full flex items-center justify-center text-[10px] font-bold text-amber-400">
                                    {(actor.name || 'A').slice(0, 1)}
                                  </div>
                                )}
                              </div>
                              <div className="min-w-0">
                                <p className="text-xs font-bold text-white truncate">{actor.name || actor.fullName || 'Diễn viên'}</p>
                                <p className="text-[9px] text-neutral-400 truncate">{actor.role || actor.characterName || 'Vai diễn'}</p>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Trailer Video Preview */}
                    {movieDetailModal.trailerUrl && (
                      <div className="space-y-2">
                        <h5 className="text-xs font-black uppercase tracking-wider text-neutral-300 flex items-center gap-2">
                          <Play className="w-3.5 h-3.5 text-amber-400" /> Trailer giới thiệu
                        </h5>
                        <div className="aspect-video w-full rounded-none overflow-hidden border border-white/10 bg-black">
                          {isDirectVideoUrl(movieDetailModal.trailerUrl) ? (
                            <video src={movieDetailModal.trailerUrl} className="w-full h-full" controls playsInline />
                          ) : (
                            <iframe
                              title="Movie Trailer"
                              src={getTrailerEmbedSrc(movieDetailModal.trailerUrl)}
                              className="w-full h-full border-none"
                              allowFullScreen
                            />
                          )}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Modal Footer Action Bar */}
                  <div className="flex flex-wrap items-center justify-between gap-3 px-6 py-4 bg-neutral-900/90 border-t border-white/10 shrink-0">
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          const target = movieDetailModal;
                          setMovieDetailModal(null);
                          handleEditMovie(target);
                        }}
                        className="px-4 py-2 bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/30 font-bold text-xs uppercase tracking-wider rounded-none transition flex items-center gap-1.5"
                      >
                        <Edit3 className="w-3.5 h-3.5" /> Chỉnh sửa phim
                      </button>

                    </div>

                    <div className="flex items-center gap-2">

                      <button
                        type="button"
                        onClick={() => setMovieDetailModal(null)}
                        className="px-5 py-2 bg-neutral-800 hover:bg-neutral-700 text-white font-bold text-xs uppercase tracking-wider rounded-none transition"
                      >
                        Đóng
                      </button>
                    </div>
                  </div>
                </motion.div>
              </div>
            )}
          </AnimatePresence>

        </motion.div>
      )}
    </>
  );
}
