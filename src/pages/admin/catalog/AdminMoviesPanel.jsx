import React, { useEffect, useState, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Plus, Trash2, Edit3, ShieldAlert, FileText, Database,
  Calendar, Users, DollarSign, Activity, AlertCircle, CheckCircle2,
  Search, Sliders, ChevronDown, Check, RefreshCw, Layers, ShoppingBag,
  BarChart2, Clock, MapPin, Film, Play, Eye, EyeOff, Sparkles, TrendingUp, Info, Globe, Tags, ImageUp, Video, X,
  Send, XCircle, History, Archive, ThumbsUp, ThumbsDown, BookOpen, Undo2, Globe2, Shield
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

const formatDurationVi = (minutes) => {
  const mins = Number(minutes);
  if (!mins || isNaN(mins)) return 'Đang cập nhật';
  const hours = Math.floor(mins / 60);
  const remMins = mins % 60;
  if (hours === 0) return `${mins} phút`;
  if (remMins === 0) return `${hours} giờ (${mins} phút)`;
  return `${hours}h ${remMins}m (${mins} phút)`;
};

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
  const [focusedDateField, setFocusedDateField] = useState(null);
  const [isDirectorDropdownOpen, setIsDirectorDropdownOpen] = useState(false);
  const [directorPickerSearch, setDirectorPickerSearch] = useState('');
  const [isActorDropdownOpen, setIsActorDropdownOpen] = useState(false);
  const [actorPickerSearch, setActorPickerSearch] = useState('');
  const isMovieMediaUploading = isPosterUploading || isBannerUploading || isTrailerUploading;
  const [mediaReviewModal, setMediaReviewModal] = useState(null);
  const [rejectModal, setRejectModal] = useState(null); // { movie, reason }
  const [approvalHistoryModal, setApprovalHistoryModal] = useState(null); // { movie, history: [] }
  const [isHistoryLoading, setIsHistoryLoading] = useState(false);
  const [movieDetailModal, setMovieDetailModal] = useState(null);
  const [isDetailModalLoading, setIsDetailModalLoading] = useState(false);

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
    setShowMovieForm(true);
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

  const onMovieSubmit = async (e) => {
    e.preventDefault();
    if (isDuplicateTitle) {
      playPulseSound?.(200, 'sine', 0.1);
      showToast?.('Tên phim đã tồn tại trong hệ thống. Vui lòng chọn tên khác trước khi tiếp tục!');
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

  // Đóng modal khi nhấn phím Escape
  useEffect(() => {
    if (!showMovieForm && !mediaReviewModal) return undefined;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        if (mediaReviewModal) {
          setMediaReviewModal(null);
          return;
        }
        handleCloseMovieForm();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showMovieForm, mediaReviewModal, handleCloseMovieForm]);

  const hasReleaseDatePassed = (value) => {
    if (!value) return false;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const releaseDate = new Date(value);
    releaseDate.setHours(0, 0, 0, 0);
    return !Number.isNaN(releaseDate.getTime()) && releaseDate < today;
  };

  const todayInputValue = (() => {
    const today = new Date();
    today.setMinutes(today.getMinutes() - today.getTimezoneOffset());
    return today.toISOString().slice(0, 10);
  })();

  const formatDateForDisplay = (value) => {
    if (!value) return '';
    const parts = String(value).split('-');
    if (parts.length !== 3) return value;
    const [year, month, day] = parts;
    return `${day}/${month}/${year}`;
  };

  const resolveMovieStatusFromDates = (releaseDateValue, endDateValue) => {
    const releaseDate = new Date(releaseDateValue);
    const endDate = new Date(endDateValue);
    const today = new Date();
    releaseDate.setHours(0, 0, 0, 0);
    endDate.setHours(0, 0, 0, 0);
    today.setHours(0, 0, 0, 0);
    if (Number.isNaN(releaseDate.getTime()) || Number.isNaN(endDate.getTime())) return 'UPCOMING';
    if (today < releaseDate) return 'UPCOMING';
    if (today > endDate) return 'ENDED';
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

  const normalizeSearchText = (value) => String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/đ/g, 'd')
    .replace(/\s+/g, ' ')
    .trim();

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

  const getApprovalBadge = (approvalStatus) => {
    const approval = String(approvalStatus || 'APPROVED').toUpperCase();
    const map = {
      DRAFT: { label: 'BẢN NHÁP', color: 'bg-yellow-950/30 text-yellow-300 border-yellow-500/30', dot: 'bg-yellow-400' },
      PENDING_APPROVAL: { label: 'CHỜ DUYỆT', color: 'bg-amber-950/30 text-amber-300 border-amber-500/30', dot: 'bg-amber-400 animate-pulse' },
      APPROVED: { label: 'ĐÃ DUYỆT', color: 'bg-blue-950/30 text-blue-300 border-blue-500/30', dot: 'bg-blue-400' },
      REJECTED: { label: 'TỪ CHỐI', color: 'bg-red-950/30 text-red-300 border-red-500/30', dot: 'bg-red-400' }
    };
    return map[approval] || { label: approval, color: 'bg-neutral-900 text-neutral-300 border-white/10', dot: 'bg-neutral-400' };
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
    const approval = String(movie.approvalStatus || '').toUpperCase();
    const publication = String(movie.publicationStatus || '').toUpperCase();
    // Phim CHỈ có trạng thái chiếu rạp (Đang chiếu / Sắp chiếu / Đã kết thúc) khi đã ĐƯỢC DUYỆT và ĐÃ XUẤT BẢN
    if (approval !== 'APPROVED' || publication !== 'PUBLISHED') {
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

            {/* Hàng 2: Thanh Tab Trạng Thái Quy Trình (Bản nháp, Chờ duyệt, Đã duyệt, Từ chối, Xuất bản, Lưu trữ) */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 pt-2.5 border-t border-white/[0.06] custom-scrollbar" id="film-filter-container">
              {[
                { id: 'ALL', name: 'TẤT CẢ' },
                {
                  id: 'DRAFT',
                  name: 'BẢN NHÁP',
                  icon: FileText,
                  color: 'yellow',
                  count: displayedDrafts.length + (filteredMovies?.filter(m => (m.approvalStatus || '').toUpperCase() === 'DRAFT').length || 0)
                },
                { id: 'PENDING_APPROVAL', name: 'CHỜ DUYỆT', icon: Clock, color: 'amber' },
                { id: 'APPROVED', name: 'ĐÃ DUYỆT', icon: CheckCircle2, color: 'blue' },
                { id: 'REJECTED', name: 'TỪ CHỐI', icon: XCircle, color: 'red' },
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
                className="fixed inset-0 z-[150] flex items-center justify-center p-3 sm:p-5 bg-black/85 backdrop-blur-sm overflow-y-auto"
                onClick={handleCloseMovieForm}
              >
                <motion.div
                  initial={{ opacity: 0, scale: 0.95, y: 20 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95, y: 20 }}
                  transition={{ duration: 0.2, ease: 'easeOut' }}
                  className="relative w-full max-w-4xl max-h-[92vh] overflow-y-auto custom-scrollbar border border-amber-500/30 bg-[#0d0f14] shadow-2xl shadow-black/95 p-5 sm:p-6 space-y-4 my-auto rounded-none"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="flex justify-between items-center border-b border-white/10 pb-3">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center border border-amber-500/30 bg-amber-500/10 text-amber-400 rounded-none shrink-0">
                        <Film className="h-5 w-5" />
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
                      <X className="h-4.5 w-4.5" />
                    </button>
                  </div>

                  {(activeDraftIdRef.current || activeDraftId) && (
                    <div className="flex flex-wrap items-center justify-between gap-2 bg-amber-500/10 border border-amber-500/30 px-3.5 py-2 rounded-none text-amber-200">
                      <div className="flex items-center gap-2 text-xs">
                        <FileText className="h-4 w-4 text-amber-400 shrink-0" />
                        <span>
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

                <form onSubmit={onMovieSubmit} className="space-y-4 text-xs font-sans">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <label className="text-[10px] uppercase tracking-[0.18em] text-neutral-200 font-black block">Tên tác phẩm (Tiếng Việt viết Hoa)</label>
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
                        className={`w-full bg-black border p-2.5 text-xs font-bold focus:outline-none transition ${
                          isDuplicateTitle
                            ? 'border-rose-500 text-rose-200 bg-rose-950/20 focus:border-rose-400'
                            : 'border-white/[0.06] text-white focus:border-amber-400'
                        }`}
                      />
                      {isDuplicateTitle && (
                        <div className="flex items-start gap-2 p-2 rounded-none bg-rose-950/50 border border-rose-500/40 text-rose-300 text-[11px] leading-snug animate-pulse">
                          <AlertCircle className="w-3.5 h-3.5 text-rose-400 shrink-0 mt-0.5" />
                          <div>
                            <span className="font-bold">Cảnh báo: </span>
                            {duplicateMovieInSystem
                              ? 'Tên phim này đã tồn tại trong hệ thống. Vui lòng đặt tên khác, không thể lưu trùng tên!'
                              : 'Tên phim này đã tồn tại trong danh mục Bản nháp khác. Vui lòng đổi tên khác!'}
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-[10px] uppercase tracking-[0.18em] text-neutral-200 font-black block">Tên tiếng Anh hoặc tiêu đề gốc</label>
                      <input
                        type="text"
                        placeholder="VD: Dawn of Light (tối đa 30 ký tự)"
                        maxLength={30}
                        value={formData.englishTitle}
                        onChange={(e) => setFormData({ ...formData, englishTitle: e.target.value })}
                        className="w-full bg-black border border-white/[0.06] p-2.5 text-xs text-white focus:outline-none focus:border-amber-400"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="space-y-1.5 md:col-span-2">
                      <label className="text-[10px] uppercase tracking-[0.18em] text-neutral-200 block">Đạo diễn</label>
                      <div className="relative">
                        <button
                          type="button"
                          onClick={() => setIsDirectorDropdownOpen((open) => !open)}
                          className="flex min-h-11 w-full items-center justify-between gap-3 border border-white/[0.06] bg-black px-3 py-2 text-left text-xs text-white transition hover:border-amber-500/60 focus:outline-none focus:border-amber-400"
                        >
                          <span className="min-w-0 flex-1">
                            {selectedDirectorNames.length ? (
                              <span className="flex flex-wrap gap-1.5">
                                {selectedDirectorNames.slice(0, 4).map((directorName) => (
                                  <span key={directorName} className="inline-flex max-w-full items-center gap-1 border border-amber-500/40 bg-amber-500/10 px-2 py-1 text-[10px] font-bold text-amber-200">
                                    <span className="truncate">{directorName}</span>
                                  </span>
                                ))}
                                {selectedDirectorNames.length > 4 && (
                                  <span className="border border-white/[0.08] bg-black px-2 py-1 text-[10px] font-bold text-neutral-200">
                                    +{selectedDirectorNames.length - 4}
                                  </span>
                                )}
                              </span>
                            ) : (
                              <span className="text-neutral-300">Chọn hoặc nhập đạo diễn</span>
                            )}
                          </span>
                          <ChevronDown className={`h-4 w-4 shrink-0 text-amber-400 transition ${isDirectorDropdownOpen ? 'rotate-180' : ''}`} />
                        </button>

                        {isDirectorDropdownOpen && (
                          <div className="absolute left-0 right-0 z-40 mt-2 border border-amber-500/40 bg-[#050505] shadow-2xl shadow-black/60">
                            <div className="border-b border-white/[0.05] p-2">
                              <div className="flex items-center gap-2 border border-white/[0.06] bg-black px-2">
                                <Search className="h-3.5 w-3.5 text-neutral-300" />
                                <input
                                  type="text"
                                  value={directorPickerSearch}
                                  onChange={(event) => setDirectorPickerSearch(event.target.value)}
                                  onKeyDown={(event) => {
                                    if (event.key !== 'Enter') return;
                                    event.preventDefault();
                                    addDirectorName(directorPickerSearch);
                                  }}
                                  placeholder="Tìm gần đúng hoặc nhập tên đạo diễn rồi Enter..."
                                  className="h-9 min-w-0 flex-1 bg-transparent text-xs text-white placeholder:text-neutral-200 focus:outline-none"
                                  autoFocus
                                />
                              </div>
                              {directorPickerSearch.trim() && !typedDirectorExists && (
                                <button
                                  type="button"
                                  onClick={() => addDirectorName(directorPickerSearch)}
                                  className="mt-2 w-full border border-amber-500/30 bg-amber-500/10 px-2 py-2 text-left text-[10px] font-black uppercase tracking-wider text-amber-300 hover:bg-amber-500 hover:text-black"
                                >
                                  Thêm đạo diễn: {directorPickerSearch.trim()}
                                </button>
                              )}
                            </div>

                            <div className="max-h-56 overflow-y-auto custom-scrollbar p-2">
                              {directorOptions.length ? directorOptions.map((directorName) => {
                                const isSelected = selectedDirectorNames.some((name) => normalizeSearchText(name) === normalizeSearchText(directorName));
                                return (
                                  <div
                                    key={directorName}
                                    className={`mb-1 grid grid-cols-[1fr_auto] items-center gap-2 border px-2 py-2 last:mb-0 ${isSelected ? 'border-amber-500/50 bg-amber-500/10' : 'border-white/[0.05] bg-neutral-950'}`}
                                  >
                                    <button type="button" onClick={() => isSelected ? removeDirectorName(directorName) : addDirectorName(directorName)} className="min-w-0 text-left">
                                      <span className="flex items-center gap-2">
                                        <span className={`grid h-4 w-4 shrink-0 place-items-center border ${isSelected ? 'border-amber-400 bg-amber-400 text-black' : 'border-white/[0.08] text-transparent'}`}>
                                          <Check className="h-3 w-3" />
                                        </span>
                                        <span className="block truncate text-xs font-bold text-white">{directorName}</span>
                                      </span>
                                    </button>
                                    {isSelected && (
                                      <button
                                        type="button"
                                        onClick={() => removeDirectorName(directorName)}
                                        className="h-7 border border-rose-500/30 px-2 text-[9px] font-black uppercase text-rose-300 transition hover:bg-rose-500 hover:text-white"
                                      >
                                        Xóa
                                      </button>
                                    )}
                                  </div>
                                );
                              }) : (
                                <p className="px-2 py-6 text-center text-[10px] text-neutral-300">Không tìm thấy đạo diễn phù hợp.</p>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                      {selectedDirectorNames.length > 0 && (
                        <div className="flex flex-wrap gap-1.5">
                          {selectedDirectorNames.map((directorName) => (
                            <span key={directorName} className="inline-flex items-center gap-1.5 border border-white/[0.08] bg-neutral-950 px-2 py-1 text-[10px] font-bold text-neutral-200">
                              {directorName}
                              <button type="button" onClick={() => removeDirectorName(directorName)} className="text-neutral-300 hover:text-rose-300">×</button>
                            </span>
                          ))}
                        </div>
                      )}
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-[10px] uppercase tracking-[0.18em] text-neutral-200 block">Thời lượng (Số phút)</label>
                      <input
                        type="number"
                        placeholder="60 - 180 phút"
                        min={60}
                        max={180}
                        value={formData.duration}
                        onChange={(e) => setFormData({ ...formData, duration: Number(e.target.value) })}
                        className="w-full bg-black border border-white/[0.06] p-2.5 text-xs text-white focus:outline-none focus:border-amber-400 font-mono"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-[10px] uppercase tracking-[0.18em] text-neutral-200 block">Độ tuổi phân loại</label>
                      <select
                        value={formData.ageRating}
                        onChange={(e) => setFormData({ ...formData, ageRating: e.target.value })}
                        className="w-full bg-black border border-white/[0.06] p-2.5 text-xs text-white focus:outline-none focus:border-amber-400 font-bold"
                      >
                        <option value="P">P (Mọi lứa tuổi)</option>
                        <option value="T13">T13 (Dưới 13 hạn chế)</option>
                        <option value="T16">T16 (Dưới 16 hạn chế)</option>
                        <option value="T18">T18 (Chỉ dành cho người trưởng thành)</option>
                      </select>
                    </div>
                  </div>

                  {/* THỂ LOẠI PHIM - VÙNG SCROLL VỚI TICK CHỌN */}
                  <div className="space-y-2 border border-white/[0.06] bg-black/60 p-3.5 rounded-none">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <label className="text-[10px] uppercase tracking-[0.18em] text-neutral-200 font-bold block">
                          Thể loại phim
                        </label>
                        <span className="text-[9px] text-amber-400 font-mono bg-amber-500/10 px-2 py-0.5 rounded-none border border-amber-500/20">
                          {(formData.genreIds || []).length} thể loại đã chọn
                        </span>
                      </div>
                      {(formData.genreIds || []).length > 0 && (
                        <button
                          type="button"
                          onClick={() => setFormData({ ...formData, genreIds: [], genre: '' })}
                          className="text-[10px] text-neutral-400 hover:text-rose-400 transition underline underline-offset-2"
                        >
                          Bỏ chọn tất cả
                        </button>
                      )}
                    </div>

                    {/* Hiển thị tóm tắt các thể loại đã tick chọn */}
                    {(formData.genreIds || []).length > 0 ? (
                      <div className="flex flex-wrap gap-1.5 p-2 bg-neutral-950/80 border border-white/[0.06] rounded-none max-h-20 overflow-y-auto custom-scrollbar">
                        {genres
                          .filter((g) => (formData.genreIds || []).includes(Number(g.id)))
                          .map((g) => (
                            <span
                              key={g.id}
                              className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-none bg-amber-500/15 border border-amber-500/40 text-amber-300 text-[10px] font-bold"
                            >
                              <span>{g.name}</span>
                              <button
                                type="button"
                                onClick={() => toggleMovieGenre(g.id)}
                                className="text-amber-300 hover:text-rose-300 transition"
                                title={`Bỏ chọn ${g.name}`}
                              >
                                <X className="h-3 w-3" />
                              </button>
                            </span>
                          ))}
                      </div>
                    ) : (
                      <div className="text-[11px] text-neutral-400 bg-neutral-950/40 border border-dashed border-white/10 px-3 py-1.5 rounded-none">
                        Chưa chọn thể loại nào. Vui lòng tick chọn ít nhất 1 thể loại ở danh sách cuộn bên dưới.
                      </div>
                    )}

                    {/* Danh sách thể loại cuộn (scroll) có tick box */}
                    <div className="max-h-40 overflow-y-auto custom-scrollbar bg-neutral-950 border border-white/[0.08] p-2 rounded-none">
                      {isGenreLoading ? (
                        <div className="flex items-center justify-center py-6 text-neutral-400 text-xs gap-2">
                          <RefreshCw className="h-3.5 w-3.5 animate-spin text-amber-400" />
                          <span>Đang tải danh sách thể loại...</span>
                        </div>
                      ) : genres.length > 0 ? (
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                          {genres.map((genre) => {
                            const isChecked = (formData.genreIds || []).includes(Number(genre.id));
                            return (
                              <label
                                key={genre.id}
                                className={`flex items-center gap-2.5 px-2.5 py-2 rounded-none cursor-pointer select-none transition border group ${
                                  isChecked
                                    ? 'bg-amber-500/15 border-amber-500/60 text-amber-200'
                                    : 'bg-black/70 border-white/[0.06] text-neutral-300 hover:bg-neutral-900 hover:border-white/20 hover:text-white'
                                }`}
                              >
                                <input
                                  type="checkbox"
                                  checked={isChecked}
                                  onChange={() => toggleMovieGenre(genre.id)}
                                  className="sr-only"
                                />
                                <span
                                  className={`h-4 w-4 rounded-none flex items-center justify-center shrink-0 border transition-all ${
                                    isChecked
                                      ? 'bg-amber-400 border-amber-400 text-black shadow-sm'
                                      : 'border-white/20 bg-neutral-900 group-hover:border-amber-400/50'
                                  }`}
                                >
                                  {isChecked && <Check className="h-3 w-3 stroke-[3]" />}
                                </span>
                                <span className="truncate text-xs font-semibold tracking-wide">
                                  {genre.name}
                                </span>
                              </label>
                            );
                          })}
                        </div>
                      ) : (
                        <p className="text-center py-4 text-xs text-neutral-400 font-mono">
                          Chưa có thể loại nào từ hệ thống
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-sans font-bold uppercase tracking-[0.18em] text-neutral-200 block">Ngày bắt đầu chiếu</label>
                      <input
                        type={focusedDateField === 'release' ? 'date' : 'text'}
                        lang="en-GB"
                        title="Bắt buộc chọn ngày phát hành"
                        min={todayInputValue}
                        value={focusedDateField === 'release' ? formData.releaseDate : formatDateForDisplay(formData.releaseDate)}
                        readOnly={focusedDateField !== 'release'}
                        onFocus={() => setFocusedDateField('release')}
                        onBlur={() => setFocusedDateField(null)}
                        onChange={(e) => {
                          const nextReleaseDate = e.target.value && e.target.value < todayInputValue ? todayInputValue : e.target.value;
                          const shouldMoveEndDate = formData.endDate && new Date(formData.endDate) < new Date(nextReleaseDate);
                          setFormData({
                            ...formData,
                            releaseDate: nextReleaseDate,
                            endDate: shouldMoveEndDate ? nextReleaseDate : formData.endDate
                          });
                        }}
                        placeholder="dd/mm/yyyy"
                        className="w-full bg-black border border-white/[0.06] p-2.5 text-xs text-white focus:outline-none focus:border-amber-400 font-mono [color-scheme:dark]"
                      />
                      <p className="text-[10px] font-sans font-bold text-neutral-300">Ngày phim bắt đầu được xếp suất chiếu. Định dạng dd/mm/yyyy, không chọn ngày quá khứ.</p>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-[10px] font-sans font-bold uppercase tracking-[0.18em] text-neutral-200 block">Ngày kết thúc chiếu</label>
                      <input
                        type={focusedDateField === 'end' ? 'date' : 'text'}
                        lang="en-GB"
                        title="Bắt buộc chọn ngày kết thúc"
                        min={formData.releaseDate || todayInputValue}
                        value={focusedDateField === 'end' ? (formData.endDate || '') : formatDateForDisplay(formData.endDate)}
                        readOnly={focusedDateField !== 'end'}
                        onFocus={() => setFocusedDateField('end')}
                        onBlur={() => setFocusedDateField(null)}
                        onChange={(e) => {
                          const minEndDate = formData.releaseDate || todayInputValue;
                          const nextEndDate = e.target.value && e.target.value < minEndDate ? minEndDate : e.target.value;
                          setFormData({ ...formData, endDate: nextEndDate });
                        }}
                        placeholder="dd/mm/yyyy"
                        className="w-full bg-black border border-white/[0.06] p-2.5 text-xs text-white focus:outline-none focus:border-amber-400 font-mono [color-scheme:dark]"
                      />
                      {formData.releaseDate && formData.endDate && new Date(formData.endDate) < new Date(formData.releaseDate) ? (
                        <p className="text-[9px] font-sans font-bold text-rose-300">Ngày kết thúc chiếu phải bằng hoặc sau ngày bắt đầu chiếu.</p>
                      ) : (
                        <p className="text-[9px] font-sans font-bold text-amber-300">
                          Suất chiếu chỉ xếp được trong khoảng này · Trạng thái tự tính: {resolveMovieStatusFromDates(formData.releaseDate, formData.endDate)}
                        </p>
                      )}
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-[10px] uppercase tracking-[0.18em] text-neutral-200 block">Ngôn ngữ</label>
                      <input
                        type="text"
                        placeholder="VD: Tiếng Việt (tối đa 30 ký tự)"
                        maxLength={30}
                        value={formData.language}
                        onChange={(e) => setFormData({ ...formData, language: e.target.value })}
                        className="w-full bg-black border border-white/[0.06] p-2.5 text-xs text-white focus:outline-none focus:border-amber-400"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-[10px] uppercase tracking-[0.18em] text-neutral-200 block">Phụ đề</label>
                      <input
                        type="text"
                        placeholder="VD: EN Sub (tối đa 30 ký tự)"
                        maxLength={30}
                        value={formData.subtitleLanguage}
                        onChange={(e) => setFormData({ ...formData, subtitleLanguage: e.target.value })}
                        className="w-full bg-black border border-white/[0.06] p-2.5 text-xs text-white focus:outline-none focus:border-amber-400"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="md:col-span-2 space-y-2 border border-white/[0.06] bg-black p-3">
                      <div className="flex items-center justify-between gap-3">
                        <label className="text-[10px] uppercase tracking-[0.18em] text-neutral-200 block">Chọn diễn viên và vai chính</label>
                        <span className="text-[9px] text-neutral-300">
                          {selectedActorIds.length} diễn viên, {selectedMainActorIds.length} vai chính
                        </span>
                      </div>

                      <div className="relative">
                        <button
                          type="button"
                          onClick={() => setIsActorDropdownOpen((open) => !open)}
                          className="flex min-h-11 w-full items-center justify-between gap-3 border border-white/[0.06] bg-neutral-950 px-3 py-2 text-left text-xs text-white transition hover:border-amber-500/60 focus:outline-none focus:border-amber-400"
                        >
                          <span className="min-w-0 flex-1">
                            {selectedActors.length ? (
                              <span className="flex flex-wrap gap-1.5">
                                {selectedActors.slice(0, 5).map((actor) => {
                                  const actorId = Number(actor.id);
                                  const isMain = selectedMainActorIds.includes(actorId);
                                  return (
                                    <span key={actor.id} className={`inline-flex max-w-full items-center gap-1 border px-2 py-1 text-[10px] font-bold ${isMain ? 'border-amber-400 bg-amber-400 text-black' : 'border-white/[0.08] bg-black text-neutral-300'}`}>
                                      <span className="truncate">{actor.name}</span>
                                      {isMain && <span className="text-[8px] uppercase">Main</span>}
                                    </span>
                                  );
                                })}
                                {selectedActors.length > 5 && (
                                  <span className="border border-white/[0.08] bg-black px-2 py-1 text-[10px] font-bold text-neutral-200">
                                    +{selectedActors.length - 5}
                                  </span>
                                )}
                              </span>
                            ) : (
                              <span className="text-neutral-300">Chọn diễn viên cho phim</span>
                            )}
                          </span>
                          <ChevronDown className={`h-4 w-4 shrink-0 text-amber-400 transition ${isActorDropdownOpen ? 'rotate-180' : ''}`} />
                        </button>

                        {isActorDropdownOpen && (
                          <div className="absolute left-0 right-0 z-30 mt-2 border border-amber-500/40 bg-[#050505] shadow-2xl shadow-black/60">
                            <div className="border-b border-white/[0.05] p-2">
                              <div className="flex items-center gap-2 border border-white/[0.06] bg-black px-2">
                                <Search className="h-3.5 w-3.5 text-neutral-300" />
                                <input
                                  type="text"
                                  value={actorPickerSearch}
                                  onChange={(event) => setActorPickerSearch(event.target.value)}
                                  placeholder="Tìm gần đúng tên diễn viên, tiểu sử hoặc ID..."
                                  className="h-9 min-w-0 flex-1 bg-transparent text-xs text-white placeholder:text-neutral-200 focus:outline-none"
                                  autoFocus
                                />
                              </div>
                            </div>

                            <div className="max-h-64 overflow-y-auto custom-scrollbar p-2">
                              {actorPickerOptions.length ? actorPickerOptions.map((actor) => {
                                const actorId = Number(actor.id);
                                const isSelected = selectedActorIds.includes(actorId);
                                const isMain = selectedMainActorIds.includes(actorId);
                                return (
                                  <div
                                    key={actor.id}
                                    className={`mb-1 grid grid-cols-[1fr_auto_auto] items-center gap-2 border px-2 py-2 last:mb-0 ${isSelected ? 'border-amber-500/50 bg-amber-500/10' : 'border-white/[0.05] bg-neutral-950'}`}
                                  >
                                    <button type="button" onClick={() => toggleMovieActor(actorId)} className="min-w-0 text-left">
                                      <span className="flex items-center gap-2">
                                        <span className={`grid h-4 w-4 shrink-0 place-items-center border ${isSelected ? 'border-amber-400 bg-amber-400 text-black' : 'border-white/[0.08] text-transparent'}`}>
                                          <Check className="h-3 w-3" />
                                        </span>
                                        <span className="min-w-0">
                                          <span className="block truncate text-xs font-bold text-white">{actor.name}</span>
                                          <span className="block truncate text-[9px] text-neutral-300">#{actor.id} · {actor.movieCount || 0} phim</span>
                                        </span>
                                      </span>
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => toggleMovieMainActor(actorId)}
                                      className={`h-7 px-2 text-[9px] font-black uppercase border ${isMain ? 'border-amber-400 bg-amber-400 text-black' : 'border-white/[0.08] text-neutral-200 hover:border-amber-400 hover:text-amber-300'}`}
                                    >
                                      Vai chính
                                    </button>
                                    {isSelected && (
                                      <button
                                        type="button"
                                        onClick={() => toggleMovieActor(actorId)}
                                        className="h-7 border border-rose-500/30 px-2 text-[9px] font-black uppercase text-rose-300 transition hover:bg-rose-500 hover:text-white"
                                        title="Bỏ chọn diễn viên khỏi phim"
                                      >
                                        Xóa
                                      </button>
                                    )}
                                  </div>
                                );
                              }) : (
                                <p className="px-2 py-6 text-center text-[10px] text-neutral-300">Không tìm thấy diễn viên phù hợp.</p>
                              )}
                            </div>
                          </div>
                        )}
                      </div>

                      {selectedActors.length > 0 && (
                        <div className="flex flex-wrap gap-1.5">
                          {selectedActors.map((actor) => {
                            const actorId = Number(actor.id);
                            const isMain = selectedMainActorIds.includes(actorId);
                            return (
                              <span key={actor.id} className={`inline-flex items-center gap-1.5 border px-2 py-1 text-[10px] font-bold ${isMain ? 'border-amber-400 bg-amber-400 text-black' : 'border-white/[0.08] bg-neutral-950 text-neutral-200'}`}>
                                {actor.name}
                                <button type="button" onClick={() => toggleMovieActor(actorId)} className={isMain ? 'text-black/70 hover:text-black' : 'text-neutral-300 hover:text-rose-300'}>×</button>
                              </span>
                            );
                          })}
                        </div>
                      )}
                    </div>

                    {/* <div className="space-y-2 border border-white/[0.06] bg-black p-3">
                      <div className="grid grid-cols-1 sm:grid-cols-[1fr_1fr_1fr_auto] gap-2">
                        <input
                          type="text"
                          placeholder="Tên actor"
                          value={actorForm.name}
                          onChange={(e) => setActorForm({ ...actorForm, name: e.target.value })}
                          className="bg-neutral-950 border border-white/[0.06] p-2 text-xs text-white focus:outline-none focus:border-amber-400"
                        />
                        <input
                          type="text"
                          placeholder="Tiểu sử"
                          value={actorForm.biography}
                          onChange={(e) => setActorForm({ ...actorForm, biography: e.target.value })}
                          className="bg-neutral-950 border border-white/[0.06] p-2 text-xs text-white focus:outline-none focus:border-amber-400"
                        />
                        <label className={`flex cursor-pointer items-center justify-center gap-2 border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-[10px] font-black uppercase tracking-widest text-amber-300 transition hover:bg-amber-500 hover:text-black ${isActorImageUploading ? 'pointer-events-none opacity-60' : ''}`}>
                          {isActorImageUploading ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <ImageUp className="h-3.5 w-3.5" />}
                          {isActorImageUploading ? 'Đang tải ảnh...' : actorForm.avatarUrl ? 'Đã chọn ảnh local' : 'Chọn ảnh local'}
                          <input type="file" accept="image/jpeg,image/png,image/webp" onChange={handleQuickActorImageUpload} className="hidden" />
                        </label>
                        {renderImagePreview(actorForm.avatarUrl, 'Ảnh actor', 'h-10 w-10')}
                      </div>
                      <button
                        type="button"
                        onClick={handleQuickCreateActor}
                        disabled={isActorSaving || isActorImageUploading}
                        className="w-full border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-[10px] font-black uppercase tracking-widest text-amber-300 hover:bg-amber-500 hover:text-black disabled:opacity-50"
                      >
                        {isActorImageUploading ? 'Đang tải ảnh actor...' : isActorSaving ? 'Đang tạo actor...' : 'Tạo actor và gán ID vào phim'}
                      </button>
                      {createdActors.length > 0 && (
                        <div className="text-[9px] text-neutral-200 font-mono">
                          Actor vừa tạo: {createdActors.slice(0, 3).map((actor) => `${actor.name}#${actor.id}`).join(', ')}
                        </div>
                      )}
                    </div> */}

                    <div className="md:col-span-2 space-y-2 border border-white/[0.08] bg-black/60 p-4 rounded-none">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <label className="text-[11px] uppercase tracking-[0.18em] text-neutral-200 font-bold block">
                            Hình ảnh & Video giới thiệu phim
                          </label>
                          <span className="text-[9px] text-amber-400 font-mono bg-amber-500/10 px-2 py-0.5 rounded-none border border-amber-500/20">
                            Bắt buộc 3 mục
                          </span>
                        </div>
                        <span className="text-[10px] text-neutral-400">
                          Xem trước trực tiếp hoặc click nút Review để phóng to
                        </span>
                      </div>

                      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 pt-1">
                        {/* 1. TRAILER VIDEO */}
                        <div className="space-y-1.5">
                          <div className="flex items-center justify-between">
                            <label className="text-[10px] uppercase tracking-[0.18em] text-neutral-200 font-bold block">
                              Trailer (Video) <span className="text-amber-400">*</span>
                            </label>
                            {formData.trailerUrl ? (
                              <span className="text-[9px] font-mono text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded-none border border-emerald-500/20">
                                Đã có video
                              </span>
                            ) : (
                              <span className="text-[9px] font-mono text-amber-400/80">MP4, WEBM</span>
                            )}
                          </div>

                          {!formData.trailerUrl ? (
                            <label className={`relative h-64 flex flex-col items-center justify-center border-2 border-dashed border-white/15 hover:border-amber-400/70 bg-black/50 hover:bg-neutral-900/60 rounded-none transition cursor-pointer p-4 text-center group ${isTrailerUploading ? 'pointer-events-none' : ''}`}>
                              {isTrailerUploading ? (
                                <div className="flex flex-col items-center gap-2 text-amber-400">
                                  <RefreshCw className="h-8 w-8 animate-spin" />
                                  <span className="text-xs font-bold tracking-wider">ĐANG TẢI TRAILER LÊN...</span>
                                  <span className="text-[10px] text-neutral-400 font-mono">Vui lòng đợi xử lý</span>
                                </div>
                              ) : (
                                <div className="flex flex-col items-center gap-2.5">
                                  <div className="w-12 h-12 rounded-full bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 group-hover:scale-110 group-hover:bg-amber-500 group-hover:text-black transition duration-200 shadow-lg">
                                    <Video className="w-6 h-6" />
                                  </div>
                                  <div>
                                    <span className="text-xs font-bold text-white group-hover:text-amber-300 transition block">
                                      Tải lên Trailer video
                                    </span>
                                    <span className="text-[10px] text-neutral-400 mt-0.5 block">
                                      Click để chọn video từ máy tính
                                    </span>
                                  </div>
                                  <span className="text-[9px] text-neutral-500 font-mono bg-white/[0.04] px-2 py-0.5 rounded-none">
                                    MP4, WEBM, MOV
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
                          ) : (
                            <div className="relative h-64 rounded-none border border-amber-500/30 bg-black overflow-hidden group shadow-lg">
                              {isTrailerUploading && (
                                <div className="absolute inset-0 z-30 bg-black/85 backdrop-blur-sm flex flex-col items-center justify-center gap-2">
                                  <RefreshCw className="h-7 w-7 animate-spin text-amber-400" />
                                  <span className="text-xs font-bold text-amber-300">ĐANG TẢI TRAILER MỚI...</span>
                                </div>
                              )}

                              {/* Direct video player with controls for immediate review */}
                              <video
                                src={formData.trailerUrl}
                                controls
                                playsInline
                                preload="metadata"
                                className="w-full h-full object-contain bg-black"
                              />

                              {/* Top control bar overlay */}
                              <div className="absolute top-2 right-2 z-20 flex items-center gap-1.5 opacity-90 group-hover:opacity-100 transition bg-black/80 backdrop-blur-md p-1 rounded-none border border-white/10 shadow-lg">
                                <button
                                  type="button"
                                  onClick={() => setMediaReviewModal({ type: 'video', url: formData.trailerUrl, title: `Trailer: ${formData.title || 'Phim'}` })}
                                  className="flex items-center gap-1 px-2 py-1 bg-amber-500/20 hover:bg-amber-500 text-amber-300 hover:text-black rounded-none text-[10px] font-bold transition"
                                  title="Xem review toàn màn hình"
                                >
                                  <Eye className="w-3.5 h-3.5" />
                                  <span>Review</span>
                                </button>
                                <label className="flex items-center gap-1 px-2 py-1 bg-white/10 hover:bg-white/20 text-white rounded-none text-[10px] font-bold cursor-pointer transition" title="Chọn video khác">
                                  <RefreshCw className="w-3 h-3" />
                                  <span>Đổi</span>
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
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>
                          )}
                        </div>

                        {/* 2. POSTER ĐỨNG */}
                        <div className="space-y-1.5">
                          <div className="flex items-center justify-between">
                            <label className="text-[10px] uppercase tracking-[0.18em] text-neutral-200 font-bold block">
                              Poster đứng <span className="text-amber-400">*</span>
                            </label>
                            {formData.posterUrl ? (
                              <span className="text-[9px] font-mono text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded-none border border-emerald-500/20">
                                Đã có poster
                              </span>
                            ) : (
                              <span className="text-[9px] font-mono text-amber-400/80">Tỷ lệ 2:3</span>
                            )}
                          </div>

                          {!formData.posterUrl ? (
                            <label className={`relative h-64 flex flex-col items-center justify-center border-2 border-dashed border-white/15 hover:border-amber-400/70 bg-black/50 hover:bg-neutral-900/60 rounded-none transition cursor-pointer p-4 text-center group ${isPosterUploading ? 'pointer-events-none' : ''}`}>
                              {isPosterUploading ? (
                                <div className="flex flex-col items-center gap-2 text-amber-400">
                                  <RefreshCw className="h-8 w-8 animate-spin" />
                                  <span className="text-xs font-bold tracking-wider">ĐANG TẢI POSTER LÊN...</span>
                                  <span className="text-[10px] text-neutral-400 font-mono">Vui lòng đợi xử lý</span>
                                </div>
                              ) : (
                                <div className="flex flex-col items-center gap-2.5">
                                  <div className="w-12 h-12 rounded-full bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 group-hover:scale-110 group-hover:bg-amber-500 group-hover:text-black transition duration-200 shadow-lg">
                                    <ImageUp className="w-6 h-6" />
                                  </div>
                                  <div>
                                    <span className="text-xs font-bold text-white group-hover:text-amber-300 transition block">
                                      Tải lên Poster đứng
                                    </span>
                                    <span className="text-[10px] text-neutral-400 mt-0.5 block">
                                      Click để chọn ảnh từ máy tính
                                    </span>
                                  </div>
                                  <span className="text-[9px] text-neutral-500 font-mono bg-white/[0.04] px-2 py-0.5 rounded-none">
                                    Khuyên dùng tỷ lệ 2:3 (Dọc)
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
                          ) : (
                            <div className="relative h-64 rounded-none border border-amber-500/30 bg-black overflow-hidden group shadow-lg flex items-center justify-center">
                              {isPosterUploading && (
                                <div className="absolute inset-0 z-30 bg-black/85 backdrop-blur-sm flex flex-col items-center justify-center gap-2">
                                  <RefreshCw className="h-7 w-7 animate-spin text-amber-400" />
                                  <span className="text-xs font-bold text-amber-300">ĐANG TẢI POSTER MỚI...</span>
                                </div>
                              )}

                              {/* Blurred ambient background */}
                              <img
                                src={formData.posterUrl}
                                alt="Poster ambient"
                                aria-hidden="true"
                                className="absolute inset-0 w-full h-full object-cover blur-xl opacity-35 scale-125 pointer-events-none"
                                referrerPolicy="no-referrer"
                              />

                              {/* Sharp centered poster */}
                              <img
                                src={formData.posterUrl}
                                alt="Poster phim"
                                className="relative z-10 h-full w-auto max-w-full object-contain cursor-pointer transition duration-300 group-hover:scale-[1.02]"
                                referrerPolicy="no-referrer"
                                onClick={() => setMediaReviewModal({ type: 'image', url: formData.posterUrl, title: `Poster: ${formData.title || 'Phim'}` })}
                                title="Click để xem review phóng to"
                              />

                              {/* Top control bar overlay */}
                              <div className="absolute top-2 right-2 z-20 flex items-center gap-1.5 opacity-90 group-hover:opacity-100 transition bg-black/80 backdrop-blur-md p-1 rounded-none border border-white/10 shadow-lg">
                                <button
                                  type="button"
                                  onClick={() => setMediaReviewModal({ type: 'image', url: formData.posterUrl, title: `Poster: ${formData.title || 'Phim'}` })}
                                  className="flex items-center gap-1 px-2 py-1 bg-amber-500/20 hover:bg-amber-500 text-amber-300 hover:text-black rounded-none text-[10px] font-bold transition"
                                  title="Xem review phóng to"
                                >
                                  <Eye className="w-3.5 h-3.5" />
                                  <span>Review</span>
                                </button>
                                <label className="flex items-center gap-1 px-2 py-1 bg-white/10 hover:bg-white/20 text-white rounded-none text-[10px] font-bold cursor-pointer transition" title="Chọn poster khác">
                                  <RefreshCw className="w-3 h-3" />
                                  <span>Đổi</span>
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
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>
                          )}
                        </div>

                        {/* 3. BANNER NGANG */}
                        <div className="space-y-1.5">
                          <div className="flex items-center justify-between">
                            <label className="text-[10px] uppercase tracking-[0.18em] text-neutral-200 font-bold block">
                              Banner ngang <span className="text-amber-400">*</span>
                            </label>
                            {formData.bannerUrl ? (
                              <span className="text-[9px] font-mono text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded-none border border-emerald-500/20">
                                Đã có banner
                              </span>
                            ) : (
                              <span className="text-[9px] font-mono text-amber-400/80">Tỷ lệ 16:9</span>
                            )}
                          </div>

                          {!formData.bannerUrl ? (
                            <label className={`relative h-64 flex flex-col items-center justify-center border-2 border-dashed border-white/15 hover:border-amber-400/70 bg-black/50 hover:bg-neutral-900/60 rounded-none transition cursor-pointer p-4 text-center group ${isBannerUploading ? 'pointer-events-none' : ''}`}>
                              {isBannerUploading ? (
                                <div className="flex flex-col items-center gap-2 text-amber-400">
                                  <RefreshCw className="h-8 w-8 animate-spin" />
                                  <span className="text-xs font-bold tracking-wider">ĐANG TẢI BANNER LÊN...</span>
                                  <span className="text-[10px] text-neutral-400 font-mono">Vui lòng đợi xử lý</span>
                                </div>
                              ) : (
                                <div className="flex flex-col items-center gap-2.5">
                                  <div className="w-12 h-12 rounded-full bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 group-hover:scale-110 group-hover:bg-amber-500 group-hover:text-black transition duration-200 shadow-lg">
                                    <ImageUp className="w-6 h-6" />
                                  </div>
                                  <div>
                                    <span className="text-xs font-bold text-white group-hover:text-amber-300 transition block">
                                      Tải lên Banner ngang
                                    </span>
                                    <span className="text-[10px] text-neutral-400 mt-0.5 block">
                                      Click để chọn ảnh từ máy tính
                                    </span>
                                  </div>
                                  <span className="text-[9px] text-neutral-500 font-mono bg-white/[0.04] px-2 py-0.5 rounded-none">
                                    Khuyên dùng tỷ lệ 16:9 (Ngang)
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
                          ) : (
                            <div className="relative h-64 rounded-none border border-amber-500/30 bg-black overflow-hidden group shadow-lg flex items-center justify-center">
                              {isBannerUploading && (
                                <div className="absolute inset-0 z-30 bg-black/85 backdrop-blur-sm flex flex-col items-center justify-center gap-2">
                                  <RefreshCw className="h-7 w-7 animate-spin text-amber-400" />
                                  <span className="text-xs font-bold text-amber-300">ĐANG TẢI BANNER MỚI...</span>
                                </div>
                              )}

                              {/* Blurred ambient background */}
                              <img
                                src={formData.bannerUrl}
                                alt="Banner ambient"
                                aria-hidden="true"
                                className="absolute inset-0 w-full h-full object-cover blur-xl opacity-35 scale-125 pointer-events-none"
                                referrerPolicy="no-referrer"
                              />

                              {/* Sharp banner */}
                              <img
                                src={formData.bannerUrl}
                                alt="Banner phim"
                                className="relative z-10 w-full h-full object-cover cursor-pointer transition duration-300 group-hover:scale-[1.02]"
                                referrerPolicy="no-referrer"
                                onClick={() => setMediaReviewModal({ type: 'image', url: formData.bannerUrl, title: `Banner: ${formData.title || 'Phim'}` })}
                                title="Click để xem review phóng to"
                              />

                              {/* Top control bar overlay */}
                              <div className="absolute top-2 right-2 z-20 flex items-center gap-1.5 opacity-90 group-hover:opacity-100 transition bg-black/80 backdrop-blur-md p-1 rounded-none border border-white/10 shadow-lg">
                                <button
                                  type="button"
                                  onClick={() => setMediaReviewModal({ type: 'image', url: formData.bannerUrl, title: `Banner: ${formData.title || 'Phim'}` })}
                                  className="flex items-center gap-1 px-2 py-1 bg-amber-500/20 hover:bg-amber-500 text-amber-300 hover:text-black rounded-none text-[10px] font-bold transition"
                                  title="Xem review phóng to"
                                >
                                  <Eye className="w-3.5 h-3.5" />
                                  <span>Review</span>
                                </button>
                                <label className="flex items-center gap-1 px-2 py-1 bg-white/10 hover:bg-white/20 text-white rounded-none text-[10px] font-bold cursor-pointer transition" title="Chọn banner khác">
                                  <RefreshCw className="w-3 h-3" />
                                  <span>Đổi</span>
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
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[10px] uppercase tracking-wider text-neutral-200 block">Nội dung phim</label>
                    <textarea
                      rows={3}
                      maxLength={1000}
                      value={formData.synopsis}
                      onChange={(e) => setFormData({ ...formData, synopsis: e.target.value })}
                      placeholder="Nội dung phim, tối đa 1000 ký tự"
                      className="w-full bg-black border border-white/[0.06] p-2.5 text-xs text-white focus:outline-none focus:border-amber-400 leading-relaxed"
                    />
                  </div>

                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-end gap-3 pt-3 border-t border-white/10">
                      <button
                        type="button"
                        onClick={handleCloseMovieForm}
                        className="px-5 py-3 border border-white/15 bg-neutral-900 hover:bg-neutral-800 text-neutral-300 hover:text-white font-sans font-bold text-xs uppercase tracking-wider transition rounded-none"
                      >
                        HỦY THAO TÁC
                      </button>
                      <button
                        type="submit"
                        disabled={isMovieSaving || isMovieMediaUploading || isDuplicateTitle}
                        className="px-5 py-3 bg-amber-500 hover:bg-amber-400 text-black font-sans font-black text-xs uppercase tracking-widest transition shadow-lg disabled:cursor-not-allowed disabled:opacity-50 rounded-none"
                        title={isDuplicateTitle ? 'Không thể lưu khi tên phim bị trùng' : ''}
                      >
                        {isMovieMediaUploading
                          ? 'ĐANG TẢI FILE LOCAL...'
                          : isMovieSaving
                            ? (editingMovie ? 'ĐANG CẬP NHẬT...' : 'ĐANG LƯU...')
                            : isDuplicateTitle
                              ? 'TRÙNG TÊN PHIM'
                              : (editingMovie ? 'CẬP NHẬT PHIM' : 'LƯU BẢN NHÁP')}
                      </button>
                      <button
                        type="button"
                        disabled={isMovieSaving || isMovieMediaUploading || isDuplicateTitle}
                        onClick={async (e) => {
                          e.preventDefault();
                          if (isDuplicateTitle) {
                            playPulseSound?.(200, 'sine', 0.1);
                            showToast?.('Tên phim đã tồn tại. Vui lòng chọn tên khác!');
                            return;
                          }
                          const fakeEvent = { preventDefault: () => {} };
                          await handleCreateMovieSubmit(fakeEvent, { submitForApproval: true });
                          // Clean up local draft if any
                          const currentId = activeDraftIdRef.current || activeDraftId;
                          const currentTitle = String(formData.title || '').trim().toLowerCase();
                          const remaining = getStoredDrafts().filter((d) => {
                            if (currentId && d.id === currentId) return false;
                            if (currentTitle && String(d.formData?.title || '').trim().toLowerCase() === currentTitle) return false;
                            return true;
                          });
                          try { localStorage.setItem(DRAFTS_STORAGE_KEY, JSON.stringify(remaining)); } catch {}
                          setDraftList(remaining);
                          activeDraftIdRef.current = null;
                          setActiveDraftId(null);
                        }}
                        className="px-5 py-3 bg-blue-600 hover:bg-blue-500 text-white font-sans font-black text-xs uppercase tracking-widest transition shadow-lg disabled:cursor-not-allowed disabled:opacity-50 rounded-none flex items-center gap-2"
                        title={editingMovie ? 'Cập nhật thông tin và gửi chờ duyệt' : 'Lưu phim và gửi lên hệ thống để chờ duyệt'}
                      >
                        <Send className="h-3.5 w-3.5" /> {editingMovie ? 'CẬP NHẬT & GỬI DUYỆT' : 'LƯU & GỬI DUYỆT'}
                      </button>
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
              const approval = String(mv.approvalStatus || 'APPROVED').toUpperCase();
              const publication = String(mv.publicationStatus || 'UNPUBLISHED').toUpperCase();

              const approvalBadge = getApprovalBadge(mv.approvalStatus);
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
                    <div className="flex flex-col gap-1.5">
                      <span className={`inline-flex items-center px-2 py-1 ${approvalBadge.color} border text-[9px] uppercase font-bold tracking-wider rounded-none select-none shrink-0 h-6 w-fit`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${approvalBadge.dot} mr-1.5`}></span>
                        {approvalBadge.label}
                      </span>
                      {approval === 'REJECTED' && mv.rejectionReason && (
                        <span className="text-[9px] text-red-400/80 truncate max-w-[180px]" title={mv.rejectionReason}>
                          💬 {mv.rejectionReason}
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="py-3.5 px-4 whitespace-nowrap">
                    <span className={`inline-flex items-center px-2 py-1 ${pubBadge.color} border text-[9px] uppercase font-bold tracking-wider rounded-none select-none shrink-0 h-6`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${pubBadge.dot} mr-1.5`}></span>
                      {pubBadge.label}
                    </span>
                  </td>
                  <td className="py-3.5 px-4 text-right">
                    <div className="flex flex-wrap justify-end gap-1.5">
                      {/* DRAFT actions */}
                      {approval === 'DRAFT' && (
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
                            title="Chỉnh sửa bản nháp"
                          >
                            <Edit3 className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleSubmitMovieForApproval(mv)}
                            className="p-1.5 text-blue-300 border border-blue-500/30 bg-blue-500/10 hover:bg-blue-500 hover:text-white transition rounded-none"
                            title="Gửi phim chờ duyệt"
                          >
                            <Send className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleArchiveMovie(mv)}
                            className="p-1.5 text-neutral-400 border border-white/10 bg-white/5 hover:border-amber-500/30 hover:bg-amber-500/10 hover:text-amber-400 transition rounded-none"
                            title="Đưa vào lưu trữ"
                          >
                            <Archive className="h-3.5 w-3.5" />
                          </button>
                        </>
                      )}

                      {/* PENDING_APPROVAL actions */}
                      {approval === 'PENDING_APPROVAL' && (
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
                            title="Chỉnh sửa phim đang chờ duyệt"
                          >
                            <Edit3 className="h-3.5 w-3.5" />
                          </button>
                          {isAdmin && (
                            <>
                              <button
                                type="button"
                                onClick={() => handleApproveMovie(mv)}
                                className="p-1.5 text-emerald-300 border border-emerald-500/30 bg-emerald-500/10 hover:bg-emerald-500 hover:text-white transition rounded-none"
                                title="Duyệt phim"
                              >
                                <ThumbsUp className="h-3.5 w-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => setRejectModal({ movie: mv, reason: '' })}
                                className="p-1.5 text-red-300 border border-red-500/30 bg-red-500/10 hover:bg-red-500 hover:text-white transition rounded-none"
                                title="Từ chối duyệt"
                              >
                                <ThumbsDown className="h-3.5 w-3.5" />
                              </button>
                            </>
                          )}
                          <button
                            type="button"
                            onClick={() => handleArchiveMovie(mv)}
                            className="p-1.5 text-neutral-400 border border-white/10 bg-white/5 hover:border-amber-500/30 hover:bg-amber-500/10 hover:text-amber-400 transition rounded-none"
                            title="Đưa vào lưu trữ"
                          >
                            <Archive className="h-3.5 w-3.5" />
                          </button>
                        </>
                      )}

                      {/* REJECTED actions */}
                      {approval === 'REJECTED' && (
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
                            title="Chỉnh sửa phim bị từ chối"
                          >
                            <Edit3 className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleSubmitMovieForApproval(mv)}
                            className="p-1.5 text-blue-300 border border-blue-500/30 bg-blue-500/10 hover:bg-blue-500 hover:text-white transition rounded-none"
                            title="Gửi phim chờ duyệt lại"
                          >
                            <Send className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleArchiveMovie(mv)}
                            className="p-1.5 text-neutral-400 border border-white/10 bg-white/5 hover:border-amber-500/30 hover:bg-amber-500/10 hover:text-amber-400 transition rounded-none"
                            title="Đưa vào lưu trữ"
                          >
                            <Archive className="h-3.5 w-3.5" />
                          </button>
                        </>
                      )}

                      {/* APPROVED actions */}
                      {approval === 'APPROVED' && publication !== 'ARCHIVED' && (
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
                          {publication !== 'PUBLISHED' && (
                            <button
                              type="button"
                              onClick={() => handlePublishMovie(mv)}
                              className="p-1.5 text-emerald-300 border border-emerald-500/30 bg-emerald-500/10 hover:bg-emerald-500 hover:text-white transition rounded-none"
                              title="Xuất bản phim lên website công khai"
                            >
                              <Globe2 className="h-3.5 w-3.5" />
                            </button>
                          )}
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

                      {/* History button - available for all non-DRAFT */}
                      {approval !== 'DRAFT' && (
                        <button
                          type="button"
                          onClick={async () => {
                            setIsHistoryLoading(true);
                            const history = await handleFetchApprovalHistory(movieId);
                            setApprovalHistoryModal({ movie: mv, history: history || [] });
                            setIsHistoryLoading(false);
                          }}
                          className="p-1.5 text-neutral-400 border border-white/10 bg-white/5 hover:border-amber-500/30 hover:bg-amber-500/10 hover:text-amber-300 transition rounded-none"
                          title="Xem lịch sử duyệt phim"
                        >
                          <History className="h-3.5 w-3.5" />
                        </button>
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
                      <th className="py-3 px-4">Trạng thái duyệt</th>
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
                                  <span className="text-[10px] text-neutral-500 italic">Chưa gửi duyệt</span>
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
                          <td colSpan={6} className="py-16 text-center">
                            <div className="flex flex-col items-center justify-center gap-3 text-neutral-400">
                              <div className="w-12 h-12 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-neutral-500">
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
                          <td colSpan={6} className="py-16 text-center">
                            <div className="flex flex-col items-center justify-center gap-3 text-neutral-400">
                              <div className="w-12 h-12 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-neutral-500">
                                <Film className="w-6 h-6" />
                              </div>
                              <p className="text-sm font-bold text-neutral-300">
                                {filmFilter === 'PENDING_APPROVAL' ? 'Không có phim nào đang chờ duyệt' :
                                 filmFilter === 'APPROVED' ? 'Không có phim nào đã duyệt' :
                                 filmFilter === 'REJECTED' ? 'Không có phim nào bị từ chối' :
                                 filmFilter === 'PUBLISHED' ? 'Không có phim nào đã xuất bản' :
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
                            const detailApprovalBadge = getApprovalBadge(movieDetailModal.approvalStatus);
                            const detailPubBadge = getPublicationBadge(movieDetailModal.publicationStatus);
                            const detailScreeningBadge = getScreeningBadge(movieDetailModal);
                            return (
                              <div className="flex flex-wrap items-center gap-2">
                                {/* Approval Badge */}
                                <span className={`inline-flex items-center px-2 py-0.5 ${detailApprovalBadge.color} border text-[9.5px] uppercase font-bold tracking-wider rounded-none select-none h-6`}>
                                  <span className={`w-1.5 h-1.5 rounded-full ${detailApprovalBadge.dot} mr-1.5`}></span>
                                  {detailApprovalBadge.label}
                                </span>

                                {/* Publication Badge */}
                                <span className={`inline-flex items-center px-2 py-0.5 ${detailPubBadge.color} border text-[9.5px] uppercase font-bold tracking-wider rounded-none select-none h-6`}>
                                  <span className={`w-1.5 h-1.5 rounded-full ${detailPubBadge.dot} mr-1.5`}></span>
                                  {detailPubBadge.label}
                                </span>

                                {/* Screening Status Badge - Chỉ hiển thị khi phim ĐÃ DUYỆT & ĐÃ XUẤT BẢN */}
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

                          {/* Rejection Alert */}
                          {movieDetailModal.approvalStatus === 'REJECTED' && movieDetailModal.rejectionReason && (
                            <div className="p-2.5 rounded-none bg-rose-950/40 border border-rose-500/30 text-rose-300 text-xs">
                              <strong className="text-rose-400 block mb-0.5">💬 Lý do từ chối duyệt:</strong>
                              <span>{movieDetailModal.rejectionReason}</span>
                            </div>
                          )}
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

                        {movieDetailModal.submittedByName && (
                          <div>
                            <span className="text-[10px] uppercase tracking-wider text-neutral-400 block mb-0.5">Người gửi duyệt</span>
                            <p className="font-semibold text-white">
                              {movieDetailModal.submittedByName}
                              {movieDetailModal.submittedAt && (
                                <span className="text-[10px] text-neutral-400 block font-normal">
                                  {new Date(movieDetailModal.submittedAt).toLocaleDateString('vi-VN')}
                                </span>
                              )}
                            </p>
                          </div>
                        )}

                        {movieDetailModal.approvedByName && (
                          <div>
                            <span className="text-[10px] uppercase tracking-wider text-neutral-400 block mb-0.5">Người phê duyệt</span>
                            <p className="font-semibold text-white">
                              {movieDetailModal.approvedByName}
                              {movieDetailModal.approvedAt && (
                                <span className="text-[10px] text-neutral-400 block font-normal">
                                  {new Date(movieDetailModal.approvedAt).toLocaleDateString('vi-VN')}
                                </span>
                              )}
                            </p>
                          </div>
                        )}

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
                              <div className="w-8 h-8 rounded-full overflow-hidden bg-neutral-800 border border-white/10 shrink-0">
                                {actor.avatarUrl ? (
                                  <img src={actor.avatarUrl} alt={actor.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
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

                      {movieDetailModal.approvalStatus !== 'DRAFT' && (
                        <button
                          type="button"
                          onClick={async () => {
                            const target = movieDetailModal;
                            const targetId = target.backendId ?? target.id;
                            setMovieDetailModal(null);
                            setIsHistoryLoading(true);
                            const history = await handleFetchApprovalHistory(targetId);
                            setApprovalHistoryModal({ movie: target, history: history || [] });
                            setIsHistoryLoading(false);
                          }}
                          className="px-3 py-2 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 hover:text-white border border-white/10 font-bold text-xs uppercase tracking-wider rounded-none transition flex items-center gap-1.5"
                        >
                          <History className="w-3.5 h-3.5" /> Lịch sử duyệt
                        </button>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      {movieDetailModal.approvalStatus === 'REJECTED' && (
                        <button
                          type="button"
                          onClick={async () => {
                            const target = movieDetailModal;
                            setMovieDetailModal(null);
                            await handleSubmitMovieForApproval(target);
                          }}
                          className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs uppercase tracking-wider rounded-none transition flex items-center gap-1.5"
                        >
                          <Send className="w-3.5 h-3.5" /> Gửi duyệt lại
                        </button>
                      )}

                      {isAdmin && movieDetailModal.approvalStatus === 'PENDING_APPROVAL' && (
                        <>
                          <button
                            type="button"
                            onClick={async () => {
                              const target = movieDetailModal;
                              setMovieDetailModal(null);
                              await handleApproveMovie(target);
                            }}
                            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs uppercase tracking-wider rounded-none transition flex items-center gap-1.5"
                          >
                            <ThumbsUp className="w-3.5 h-3.5" /> Duyệt phim
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              const target = movieDetailModal;
                              setMovieDetailModal(null);
                              setRejectModal({ movie: target, reason: '' });
                            }}
                            className="px-4 py-2 bg-red-600 hover:bg-red-500 text-white font-bold text-xs uppercase tracking-wider rounded-none transition flex items-center gap-1.5"
                          >
                            <ThumbsDown className="w-3.5 h-3.5" /> Từ chối
                          </button>
                        </>
                      )}

                      {movieDetailModal.approvalStatus === 'APPROVED' && movieDetailModal.publicationStatus !== 'PUBLISHED' && (
                        <button
                          type="button"
                          onClick={async () => {
                            const target = movieDetailModal;
                            setMovieDetailModal(null);
                            await handlePublishMovie(target);
                          }}
                          className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs uppercase tracking-wider rounded-none transition flex items-center gap-1.5"
                        >
                          <Globe2 className="w-3.5 h-3.5" /> Xuất bản
                        </button>
                      )}

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
