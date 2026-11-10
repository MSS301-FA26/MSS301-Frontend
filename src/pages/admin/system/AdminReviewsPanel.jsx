import React, { useEffect, useMemo, useState, useRef } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'motion/react';
import {
  MessageSquare, RefreshCw, Star, EyeOff, CheckCircle2, AlertTriangle,
  Search, Filter, ChevronDown, Check, X, ShieldAlert, Film, User,
  Calendar, RotateCcw, Ban, AlertCircle, ArrowUpRight, HelpCircle, ExternalLink
} from 'lucide-react';
import { adminService } from '../../../services/adminService';

const HIDE_REASONS = [
  'Spam / Quảng cáo',
  'Nội dung không phù hợp / Thô tục',
  'Tiết lộ nội dung phim quá mức (Spoiler nặng)',
  'Không liên quan đến phim',
  'Quấy rối / Công kích cá nhân',
  'Khác'
];

const formatDateTime = (value) => {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
};

const getStatusBadge = (status) => {
  switch (status) {
    case 'PUBLISHED':
    case 'VISIBLE':
      return {
        label: 'PUBLISHED',
        text: 'Đang hiển thị',
        className: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400'
      };
    case 'FLAGGED':
      return {
        label: 'FLAGGED',
        text: 'Bị báo cáo',
        className: 'border-amber-500/40 bg-amber-500/10 text-amber-400 font-bold animate-pulse'
      };
    case 'HIDDEN':
      return {
        label: 'HIDDEN',
        text: 'Đã ẩn',
        className: 'border-rose-500/30 bg-rose-500/10 text-rose-400'
      };
    case 'REJECTED':
      return {
        label: 'REJECTED',
        text: 'Bị từ chối',
        className: 'border-red-600/40 bg-red-950/20 text-red-400'
      };
    default:
      return {
        label: status || 'UNKNOWN',
        text: status || 'Không rõ',
        className: 'border-white/10 bg-white/5 text-neutral-300'
      };
  }
};

export default function AdminReviewsPanel({ ctx }) {
  const {
    activeTab,
    getAdminToken,
    showToast,
    moviesList = [],
    changeAdminSection
  } = ctx || {};

  // URL search params sync
  const queryParams = new URLSearchParams(window.location.search);
  const initialMovieId = queryParams.get('movieId') || '';

  // States
  const [reviews, setReviews] = useState({ items: [], page: 0, totalPages: 1, totalItems: 0 });
  const [stats, setStats] = useState({
    totalReviews: 0,
    averageRating: 0.0,
    flaggedCount: 0,
    hiddenCount: 0,
    verifiedCount: 0,
    verifiedRatio: 0
  });

  const [activeSubTab, setActiveSubTab] = useState('ALL'); // 'ALL' | 'PUBLISHED' | 'FLAGGED' | 'HIDDEN' | 'REJECTED'
  const [movieId, setMovieId] = useState(initialMovieId);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [ratingFilter, setRatingFilter] = useState('');
  const [verifiedFilter, setVerifiedFilter] = useState('');
  const [sort, setSort] = useState('NEWEST');
  const [page, setPage] = useState(0);

  const [loading, setLoading] = useState(false);
  const [statsLoading, setStatsLoading] = useState(false);

  // Modals
  const [selectedReview, setSelectedReview] = useState(null);
  const [reviewReports, setReviewReports] = useState([]);
  const [loadingReports, setLoadingReports] = useState(false);

  const [hideConfirmModal, setHideConfirmModal] = useState(null); // review obj
  const [hideReasonCategory, setHideReasonCategory] = useState(HIDE_REASONS[0]);
  const [hideReasonCustom, setHideReasonCustom] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  const [restoreConfirmModal, setRestoreConfirmModal] = useState(null);
  const [rejectConfirmModal, setRejectConfirmModal] = useState(null);
  const [rejectReason, setRejectReason] = useState('');

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search.trim());
      setPage(0);
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  // Load KPI Stats
  const loadStats = async () => {
    const token = getAdminToken?.();
    if (!token) return;
    setStatsLoading(true);
    try {
      const data = await adminService.getAdminReviewStats(token);
      if (data) {
        setStats({
          totalReviews: Number(data.totalReviews || 0),
          averageRating: Number(data.averageRating || 0),
          flaggedCount: Number(data.flaggedCount || 0),
          hiddenCount: Number(data.hiddenCount || 0),
          verifiedCount: Number(data.verifiedCount || 0),
          verifiedRatio: Number(data.verifiedRatio || 0)
        });
      }
    } catch (err) {
      console.error('Failed to load review stats:', err);
    } finally {
      setStatsLoading(false);
    }
  };

  // Load Review List
  const loadReviews = async (targetPage = page) => {
    const token = getAdminToken?.();
    if (!token) return;
    setLoading(true);
    try {
      const statusParam = activeSubTab === 'ALL' ? undefined : activeSubTab;
      const verifiedParam = verifiedFilter === '' ? undefined : verifiedFilter === 'true';

      const data = await adminService.getAdminReviews(token, {
        movieId: movieId || undefined,
        status: statusParam,
        rating: ratingFilter ? Number(ratingFilter) : undefined,
        verified: verifiedParam,
        search: debouncedSearch || undefined,
        sort: sort || undefined,
        page: targetPage,
        size: 20
      });

      setReviews({
        items: Array.isArray(data?.items) ? data.items : [],
        page: Number(data?.page || 0),
        totalPages: Math.max(1, Number(data?.totalPages || 1)),
        totalItems: Number(data?.totalItems || 0)
      });
      setPage(Number(data?.page || 0));
    } catch (error) {
      showToast?.(error.message || 'Không thể tải danh sách đánh giá.', 4500, null, 'sad');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'reviews') {
      loadStats();
    }
  }, [activeTab]);

  useEffect(() => {
    if (activeTab === 'reviews') {
      loadReviews(page);
    }
  }, [activeTab, activeSubTab, movieId, debouncedSearch, ratingFilter, verifiedFilter, sort, page]);

  // Open Detail Modal
  const handleOpenDetail = async (review) => {
    setSelectedReview(review);
    setReviewReports([]);
    if (review?.id && (review.reportCount > 0 || review.status === 'FLAGGED')) {
      const token = getAdminToken?.();
      if (token) {
        setLoadingReports(true);
        try {
          const reps = await adminService.getAdminReviewReports(token, review.id);
          setReviewReports(Array.isArray(reps) ? reps : []);
        } catch (e) {
          console.error('Failed to load review reports:', e);
        } finally {
          setLoadingReports(false);
        }
      }
    }
  };

  // Execute Hide Review
  const executeHideReview = async () => {
    if (!hideConfirmModal) return;
    const token = getAdminToken?.();
    if (!token) return;

    const finalReason = hideReasonCategory === 'Khác'
      ? (hideReasonCustom.trim() || 'Nội dung vi phạm tiêu chuẩn cộng đồng')
      : hideReasonCategory;

    setActionLoading(true);
    try {
      const updated = await adminService.hideAdminReview(token, hideConfirmModal.id, finalReason);
      showToast?.(`Đã ẩn đánh giá #${hideConfirmModal.id} thành công.`);
      setHideConfirmModal(null);
      if (selectedReview?.id === hideConfirmModal.id) {
        setSelectedReview(updated || { ...selectedReview, status: 'HIDDEN', moderationReason: finalReason });
      }
      await Promise.all([loadReviews(page), loadStats()]);
    } catch (err) {
      showToast?.(err.message || 'Không thể ẩn đánh giá.', 4500, null, 'sad');
    } finally {
      setActionLoading(false);
    }
  };

  // Execute Restore Review
  const executeRestoreReview = async () => {
    if (!restoreConfirmModal) return;
    const token = getAdminToken?.();
    if (!token) return;

    setActionLoading(true);
    try {
      const updated = await adminService.restoreAdminReview(token, restoreConfirmModal.id);
      showToast?.(`Đã khôi phục hiển thị đánh giá #${restoreConfirmModal.id}.`);
      setRestoreConfirmModal(null);
      if (selectedReview?.id === restoreConfirmModal.id) {
        setSelectedReview(updated || { ...selectedReview, status: 'PUBLISHED', reportCount: 0 });
      }
      await Promise.all([loadReviews(page), loadStats()]);
    } catch (err) {
      showToast?.(err.message || 'Không thể khôi phục đánh giá.', 4500, null, 'sad');
    } finally {
      setActionLoading(false);
    }
  };

  // Execute Reject Review
  const executeRejectReview = async () => {
    if (!rejectConfirmModal) return;
    const token = getAdminToken?.();
    if (!token) return;

    const reason = rejectReason.trim() || 'Đánh giá bị từ chối do vi phạm quy chế bình luận';
    setActionLoading(true);
    try {
      const updated = await adminService.rejectAdminReview(token, rejectConfirmModal.id, reason);
      showToast?.(`Đã từ chối đánh giá #${rejectConfirmModal.id}.`);
      setRejectConfirmModal(null);
      if (selectedReview?.id === rejectConfirmModal.id) {
        setSelectedReview(updated || { ...selectedReview, status: 'REJECTED', moderationReason: reason });
      }
      await Promise.all([loadReviews(page), loadStats()]);
    } catch (err) {
      showToast?.(err.message || 'Không thể từ chối đánh giá.', 4500, null, 'sad');
    } finally {
      setActionLoading(false);
    }
  };

  const handleResetFilters = () => {
    setSearch('');
    setDebouncedSearch('');
    setMovieId('');
    setRatingFilter('');
    setVerifiedFilter('');
    setSort('NEWEST');
    setActiveSubTab('ALL');
    setPage(0);
  };

  if (activeTab !== 'reviews') return null;

  return (
    <motion.div
      key="panel-reviews"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.2 }}
      className="space-y-6"
    >
      {/* 1. PAGE HEADER */}
      <div className="flex flex-col gap-3 border border-white/[0.08] bg-[#0c0d12] p-5 lg:flex-row lg:items-center lg:justify-between shadow-xl">
        <div className="space-y-1">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center bg-amber-500/15 border border-amber-500/30 text-amber-400">
              <MessageSquare className="h-4 w-4" />
            </div>
            <h2 className="text-xl font-black uppercase tracking-wider text-white">
              ĐÁNH GIÁ PHIM
            </h2>
          </div>
          <p className="text-xs text-neutral-300">
            Theo dõi, kiểm duyệt và xử lý đánh giá từ khách hàng CinePremier.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => {
              loadStats();
              loadReviews(page);
            }}
            disabled={loading || statsLoading}
            className="inline-flex items-center justify-center gap-2 border border-amber-500/40 bg-amber-500/10 px-4 py-2 text-xs font-bold uppercase tracking-wider text-amber-300 transition hover:bg-amber-500 hover:text-black disabled:opacity-50"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading || statsLoading ? 'animate-spin' : ''}`} />
            Làm mới
          </button>
        </div>
      </div>

      {/* 2. COMPACT KPI TOP */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {/* KPI 1: Tổng đánh giá */}
        <div className="border border-white/[0.08] bg-[#0c0d12] p-4 space-y-1">
          <span className="text-[10px] font-mono uppercase tracking-wider text-neutral-400 font-bold block">
            TỔNG ĐÁNH GIÁ
          </span>
          <div className="text-2xl font-black font-mono text-white">
            {stats.totalReviews.toLocaleString('vi-VN')}
          </div>
          <span className="text-[10px] text-neutral-400">Tất cả đánh giá trên hệ thống</span>
        </div>

        {/* KPI 2: Điểm trung bình */}
        <div className="border border-white/[0.08] bg-[#0c0d12] p-4 space-y-1">
          <span className="text-[10px] font-mono uppercase tracking-wider text-neutral-400 font-bold block">
            ĐIỂM TRUNG BÌNH
          </span>
          <div className="text-2xl font-black font-mono text-amber-400 flex items-center gap-1.5">
            <Star className="h-5 w-5 fill-amber-400 text-amber-400 shrink-0" />
            <span>{stats.averageRating > 0 ? stats.averageRating.toFixed(1) : '0.0'}</span>
            <span className="text-xs text-neutral-500 font-normal">/ 10</span>
          </div>
          <span className="text-[10px] text-neutral-400">Từ đánh giá đang hiển thị</span>
        </div>

        {/* KPI 3: Bị báo cáo */}
        <div className="border border-white/[0.08] bg-[#0c0d12] p-4 space-y-1">
          <span className="text-[10px] font-mono uppercase tracking-wider text-neutral-400 font-bold block">
            BỊ BÁO CÁO
          </span>
          <div className="text-2xl font-black font-mono text-amber-300 flex items-center gap-1.5">
            <AlertTriangle className="h-5 w-5 text-amber-400 shrink-0" />
            <span>{stats.flaggedCount}</span>
          </div>
          <span className="text-[10px] text-amber-400/80">Cần Admin kiểm duyệt</span>
        </div>

        {/* KPI 4: Đã ẩn */}
        <div className="border border-white/[0.08] bg-[#0c0d12] p-4 space-y-1">
          <span className="text-[10px] font-mono uppercase tracking-wider text-neutral-400 font-bold block">
            ĐÃ ẨN
          </span>
          <div className="text-2xl font-black font-mono text-rose-400 flex items-center gap-1.5">
            <EyeOff className="h-5 w-5 text-rose-400 shrink-0" />
            <span>{stats.hiddenCount}</span>
          </div>
          <span className="text-[10px] text-neutral-400">Do vi phạm chính sách</span>
        </div>

        {/* KPI 5: Tỷ lệ đã xác minh vé */}
        <div className="border border-white/[0.08] bg-[#0c0d12] p-4 space-y-1 col-span-2 sm:col-span-1">
          <span className="text-[10px] font-mono uppercase tracking-wider text-neutral-400 font-bold block">
            TỶ LỆ XÁC MINH VÉ
          </span>
          <div className="text-2xl font-black font-mono text-emerald-400 flex items-center gap-1.5">
            <CheckCircle2 className="h-5 w-5 text-emerald-400 shrink-0" />
            <span>{stats.verifiedRatio}%</span>
          </div>
          <span className="text-[10px] text-neutral-400">{stats.verifiedCount} vé đã xem phim</span>
        </div>
      </div>

      {/* 3. TABS HEADER WITH COUNTS */}
      <div className="flex border-b border-white/10 gap-1 overflow-x-auto [scrollbar-width:none]">
        <button
          type="button"
          onClick={() => { setActiveSubTab('ALL'); setPage(0); }}
          className={`px-4 py-3 text-xs font-black uppercase tracking-wider transition border-b-2 whitespace-nowrap ${
            activeSubTab === 'ALL'
              ? 'border-amber-400 text-amber-300 bg-amber-500/10'
              : 'border-transparent text-neutral-400 hover:text-white'
          }`}
        >
          Tất cả {stats.totalReviews > 0 && `(${stats.totalReviews})`}
        </button>

        <button
          type="button"
          onClick={() => { setActiveSubTab('PUBLISHED'); setPage(0); }}
          className={`px-4 py-3 text-xs font-black uppercase tracking-wider transition border-b-2 whitespace-nowrap ${
            activeSubTab === 'PUBLISHED'
              ? 'border-emerald-500 text-emerald-300 bg-emerald-950/20'
              : 'border-transparent text-neutral-400 hover:text-white'
          }`}
        >
          Đang hiển thị
        </button>

        <button
          type="button"
          onClick={() => { setActiveSubTab('FLAGGED'); setPage(0); }}
          className={`px-4 py-3 text-xs font-black uppercase tracking-wider transition border-b-2 whitespace-nowrap flex items-center gap-1.5 ${
            activeSubTab === 'FLAGGED'
              ? 'border-amber-400 text-amber-300 bg-amber-500/15'
              : 'border-transparent text-neutral-400 hover:text-white'
          }`}
        >
          <AlertTriangle className="h-3.5 w-3.5 text-amber-400" />
          Bị báo cáo {stats.flaggedCount > 0 && `(${stats.flaggedCount})`}
        </button>

        <button
          type="button"
          onClick={() => { setActiveSubTab('HIDDEN'); setPage(0); }}
          className={`px-4 py-3 text-xs font-black uppercase tracking-wider transition border-b-2 whitespace-nowrap flex items-center gap-1.5 ${
            activeSubTab === 'HIDDEN'
              ? 'border-rose-500 text-rose-300 bg-rose-950/20'
              : 'border-transparent text-neutral-400 hover:text-white'
          }`}
        >
          <EyeOff className="h-3.5 w-3.5 text-rose-400" />
          Đã ẩn {stats.hiddenCount > 0 && `(${stats.hiddenCount})`}
        </button>

        <button
          type="button"
          onClick={() => { setActiveSubTab('REJECTED'); setPage(0); }}
          className={`px-4 py-3 text-xs font-black uppercase tracking-wider transition border-b-2 whitespace-nowrap flex items-center gap-1.5 ${
            activeSubTab === 'REJECTED'
              ? 'border-red-600 text-red-300 bg-red-950/20'
              : 'border-transparent text-neutral-400 hover:text-white'
          }`}
        >
          <Ban className="h-3.5 w-3.5 text-red-400" />
          Bị từ chối
        </button>
      </div>

      {/* 4. FILTERS & SEARCH */}
      <div className="grid gap-3 border border-white/[0.08] bg-[#0c0d12] p-4 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1.2fr)_130px_140px_150px_auto] items-end">
        {/* Search */}
        <label className="space-y-1.5">
          <span className="block text-[10px] font-black uppercase tracking-wider text-neutral-300">
            Tìm kiếm
          </span>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-neutral-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Khách hàng, phim, nội dung..."
              className="w-full border border-white/10 bg-black pl-9 pr-3 py-2 text-xs text-white placeholder-neutral-500 outline-none transition focus:border-amber-400"
            />
          </div>
        </label>

        {/* Movie Filter */}
        <label className="space-y-1.5">
          <span className="block text-[10px] font-black uppercase tracking-wider text-neutral-300">
            Phim
          </span>
          <select
            value={movieId}
            onChange={(e) => { setMovieId(e.target.value); setPage(0); }}
            className="w-full border border-white/10 bg-black px-3 py-2 text-xs text-white outline-none transition focus:border-amber-400"
          >
            <option value="">Tất cả phim</option>
            {moviesList.map((m) => (
              <option key={m.backendId || m.id} value={m.backendId || m.id}>
                {m.title}
              </option>
            ))}
          </select>
        </label>

        {/* Rating Filter */}
        <label className="space-y-1.5">
          <span className="block text-[10px] font-black uppercase tracking-wider text-neutral-300">
            Điểm số
          </span>
          <select
            value={ratingFilter}
            onChange={(e) => { setRatingFilter(e.target.value); setPage(0); }}
            className="w-full border border-white/10 bg-black px-3 py-2 text-xs text-white outline-none transition focus:border-amber-400"
          >
            <option value="">Tất cả điểm</option>
            <option value="10">★ 10 / 10</option>
            <option value="9">★ 9 / 10</option>
            <option value="8">★ 8 / 10</option>
            <option value="7">★ 7 / 10</option>
            <option value="6">★ 6 / 10</option>
            <option value="5">★ 5 / 10</option>
            <option value="4">★ 4 / 10</option>
            <option value="3">★ 3 / 10</option>
            <option value="2">★ 2 / 10</option>
            <option value="1">★ 1 / 10</option>
          </select>
        </label>

        {/* Verified Filter */}
        <label className="space-y-1.5">
          <span className="block text-[10px] font-black uppercase tracking-wider text-neutral-300">
            Xác minh vé
          </span>
          <select
            value={verifiedFilter}
            onChange={(e) => { setVerifiedFilter(e.target.value); setPage(0); }}
            className="w-full border border-white/10 bg-black px-3 py-2 text-xs text-white outline-none transition focus:border-amber-400"
          >
            <option value="">Tất cả</option>
            <option value="true">✓ Đã xác minh</option>
            <option value="false">Chưa xác minh</option>
          </select>
        </label>

        {/* Sort Filter */}
        <label className="space-y-1.5">
          <span className="block text-[10px] font-black uppercase tracking-wider text-neutral-300">
            Sắp xếp
          </span>
          <select
            value={sort}
            onChange={(e) => { setSort(e.target.value); setPage(0); }}
            className="w-full border border-white/10 bg-black px-3 py-2 text-xs text-white outline-none transition focus:border-amber-400"
          >
            <option value="NEWEST">Mới nhất</option>
            <option value="OLDEST">Cũ nhất</option>
            <option value="RATING_HIGH">Điểm cao nhất</option>
            <option value="RATING_LOW">Điểm thấp nhất</option>
            <option value="MOST_REPORTED">Nhiều báo cáo</option>
          </select>
        </label>

        {/* Reset button */}
        {(search || movieId || ratingFilter || verifiedFilter || sort !== 'NEWEST' || activeSubTab !== 'ALL') && (
          <button
            type="button"
            onClick={handleResetFilters}
            className="border border-white/10 bg-white/5 hover:bg-white/10 px-3 py-2 text-xs text-neutral-300 hover:text-white transition whitespace-nowrap"
            title="Đặt lại bộ lọc"
          >
            Đặt lại
          </button>
        )}
      </div>

      {/* 5. REVIEWS TABLE */}
      <div className="overflow-hidden border border-white/[0.08] bg-[#0c0d12]">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[960px] border-collapse text-left">
            <thead>
              <tr className="border-b border-white/[0.08] bg-black text-[10px] font-black uppercase tracking-wider text-neutral-300">
                <th className="px-4 py-3.5 w-48">Khách hàng</th>
                <th className="px-4 py-3.5 w-44">Phim</th>
                <th className="px-4 py-3.5 w-24">Điểm</th>
                <th className="px-4 py-3.5">Nội dung</th>
                <th className="px-4 py-3.5 w-36">Xác minh vé</th>
                <th className="px-4 py-3.5 w-32">Trạng thái</th>
                <th className="px-4 py-3.5 w-32">Ngày</th>
                <th className="px-4 py-3.5 w-20 text-right">Hành động</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.04] text-xs">
              {loading ? (
                Array.from({ length: 6 }).map((_, i) => (
                  <tr key={i} className="animate-pulse">
                    <td colSpan={8} className="px-4 py-4">
                      <div className="h-4 bg-white/5 rounded w-full"></div>
                    </td>
                  </tr>
                ))
              ) : reviews.items.length > 0 ? (
                reviews.items.map((rev) => {
                  const statusMeta = getStatusBadge(rev.status);
                  return (
                    <tr key={rev.id} className="hover:bg-white/[0.02] transition">
                      {/* Customer */}
                      <td className="px-4 py-3.5">
                        <div className="font-bold text-white truncate max-w-[170px]">
                          {rev.userName || rev.userFullName || 'Khách hàng'}
                        </div>
                        <div className="text-[10px] text-neutral-400 truncate max-w-[170px]">
                          {rev.userEmail || `ID: #${rev.userId}`}
                        </div>
                      </td>

                      {/* Movie */}
                      <td className="px-4 py-3.5">
                        <div className="font-bold text-amber-300 truncate max-w-[160px]" title={rev.movieTitle}>
                          {rev.movieTitle || `#${rev.movieId}`}
                        </div>
                        {rev.bookingCode && (
                          <div className="font-mono text-[9.5px] text-neutral-400">
                            Mã vé: {rev.bookingCode}
                          </div>
                        )}
                      </td>

                      {/* Rating */}
                      <td className="px-4 py-3.5 whitespace-nowrap">
                        <span className="inline-flex items-center gap-1 font-mono font-bold text-amber-400 text-xs">
                          <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
                          {rev.rating}/10
                        </span>
                      </td>

                      {/* Content Preview (1 line ellipsis!) */}
                      <td className="px-4 py-3.5 max-w-xs">
                        <div className="flex items-center gap-2">
                          {rev.containsSpoiler && (
                            <span className="px-1.5 py-0.5 rounded-none border border-rose-500/40 bg-rose-500/10 text-[9px] font-mono text-rose-300 shrink-0">
                              Spoiler
                            </span>
                          )}
                          <p className="truncate text-neutral-200 text-xs" title={rev.content}>
                            "{rev.content}"
                          </p>
                        </div>
                        {rev.reportCount > 0 && (
                          <span className="text-[9.5px] text-amber-400 flex items-center gap-1 mt-0.5 font-bold">
                            <AlertTriangle className="h-3 w-3" /> {rev.reportCount} báo cáo vi phạm
                          </span>
                        )}
                      </td>

                      {/* Verified Badge */}
                      <td className="px-4 py-3.5 whitespace-nowrap">
                        {rev.verifiedBooking ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 border border-emerald-500/30 bg-emerald-500/10 text-emerald-400 text-[10px] font-bold">
                            <Check className="h-3 w-3" /> ĐÃ XÁC MINH VÉ
                          </span>
                        ) : (
                          <span className="text-neutral-500 text-[10.5px]">
                            Chưa xác minh
                          </span>
                        )}
                      </td>

                      {/* Status */}
                      <td className="px-4 py-3.5 whitespace-nowrap">
                        <span className={`inline-flex items-center px-2 py-0.5 border text-[9.5px] uppercase font-bold tracking-wider ${statusMeta.className}`}>
                          {statusMeta.text}
                        </span>
                      </td>

                      {/* Date */}
                      <td className="px-4 py-3.5 whitespace-nowrap font-mono text-[10.5px] text-neutral-400">
                        {formatDateTime(rev.createdAt)}
                      </td>

                      {/* Action */}
                      <td className="px-4 py-3.5 text-right whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => handleOpenDetail(rev)}
                          className="px-3 py-1.5 border border-amber-500/40 bg-amber-500/10 hover:bg-amber-500 hover:text-black text-amber-300 text-[10px] font-bold uppercase tracking-wider transition"
                        >
                          XEM
                        </button>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-xs text-neutral-400">
                    <MessageSquare className="h-8 w-8 mx-auto mb-2 opacity-30 text-neutral-400" />
                    <p className="font-bold text-neutral-300">
                      {search || movieId || ratingFilter || verifiedFilter
                        ? 'Không tìm thấy đánh giá phù hợp.'
                        : 'Chưa có đánh giá nào.'}
                    </p>
                    {(search || movieId || ratingFilter || verifiedFilter) && (
                      <button
                        type="button"
                        onClick={handleResetFilters}
                        className="mt-3 px-4 py-1.5 border border-amber-500/40 bg-amber-500/10 text-amber-300 text-xs font-bold uppercase tracking-wider hover:bg-amber-500 hover:text-black transition"
                      >
                        ĐẶT LẠI BỘ LỌC
                      </button>
                    )}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Footer Pagination */}
        <div className="flex items-center justify-between border-t border-white/[0.08] px-4 py-3 text-[11px] text-neutral-400 bg-black">
          <span>
            Hiển thị <strong>{reviews.items.length}</strong> / <strong>{reviews.totalItems}</strong> đánh giá
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={reviews.page <= 0 || loading}
              onClick={() => loadReviews(reviews.page - 1)}
              className="border border-white/10 px-3 py-1.5 font-bold uppercase text-white hover:border-amber-400 disabled:opacity-30 disabled:hover:border-white/10 transition"
            >
              Trước
            </button>
            <span className="font-mono text-neutral-300">
              Trang {reviews.page + 1} / {reviews.totalPages}
            </span>
            <button
              type="button"
              disabled={reviews.page + 1 >= reviews.totalPages || loading}
              onClick={() => loadReviews(reviews.page + 1)}
              className="border border-white/10 px-3 py-1.5 font-bold uppercase text-white hover:border-amber-400 disabled:opacity-30 disabled:hover:border-white/10 transition"
            >
              Sau
            </button>
          </div>
        </div>
      </div>

      {/* ═══════════ 6. REVIEW DETAIL MODAL ═══════════ */}
      <AnimatePresence>
        {selectedReview && (
          <div
            className="fixed inset-0 z-[160] flex items-center justify-center p-3 sm:p-6 bg-black/85 backdrop-blur-md"
            onClick={() => setSelectedReview(null)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              transition={{ duration: 0.2 }}
              className="relative w-full max-w-2xl bg-[#0d0f14] border border-amber-500/30 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Modal Header */}
              <div className="flex items-center justify-between px-6 py-4 bg-neutral-900/90 border-b border-white/10 shrink-0">
                <div className="flex items-center gap-2.5">
                  <div className="h-8 w-8 bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
                    <MessageSquare className="h-4 w-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-black uppercase tracking-wider text-white">
                      CHI TIẾT ĐÁNH GIÁ #{selectedReview.id}
                    </h3>
                    <p className="text-[10px] text-neutral-400 font-mono">
                      Ngày tạo: {formatDateTime(selectedReview.createdAt)}
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setSelectedReview(null)}
                  className="p-1.5 text-neutral-400 hover:text-white border border-white/10 hover:border-white/30 transition"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Modal Body */}
              <div className="p-6 overflow-y-auto space-y-5">
                {/* Movie & Rating Header */}
                <div className="flex items-start gap-4 p-4 border border-white/[0.08] bg-black/60">
                  {selectedReview.moviePosterUrl ? (
                    <img
                      src={selectedReview.moviePosterUrl}
                      alt={selectedReview.movieTitle}
                      className="w-14 h-20 object-cover border border-white/10 shrink-0"
                    />
                  ) : (
                    <div className="w-14 h-20 bg-neutral-900 border border-white/10 flex items-center justify-center text-neutral-600 shrink-0">
                      <Film className="w-6 h-6" />
                    </div>
                  )}

                  <div className="flex-1 min-w-0 space-y-1.5">
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <h4 className="text-base font-bold text-white truncate">
                        {selectedReview.movieTitle || `Phim #${selectedReview.movieId}`}
                      </h4>
                      <div className="flex items-center gap-1 bg-amber-500/15 border border-amber-500/30 px-2 py-0.5 text-amber-300 font-mono font-bold text-sm">
                        <Star className="h-4 w-4 fill-amber-400 text-amber-400" />
                        {selectedReview.rating} / 10
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 text-xs">
                      {selectedReview.verifiedBooking ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 border border-emerald-500/30 bg-emerald-500/10 text-emerald-400 text-[10px] font-bold">
                          <Check className="h-3 w-3" /> ĐÃ XÁC MINH VÉ
                        </span>
                      ) : (
                        <span className="text-neutral-500 text-[10px]">
                          Chưa gắn vé xem phim
                        </span>
                      )}

                      {(() => {
                        const sm = getStatusBadge(selectedReview.status);
                        return (
                          <span className={`inline-flex items-center px-2 py-0.5 border text-[10px] uppercase font-bold tracking-wider ${sm.className}`}>
                            {sm.text}
                          </span>
                        );
                      })()}
                    </div>

                    {selectedReview.bookingCode && (
                      <p className="text-[11px] text-neutral-400 font-mono">
                        Mã đơn vé: <strong className="text-white">{selectedReview.bookingCode}</strong>
                      </p>
                    )}
                  </div>
                </div>

                {/* Customer Information */}
                <div className="border border-white/[0.08] bg-black/40 p-4 space-y-1 text-xs">
                  <div className="text-[10px] font-mono uppercase tracking-wider text-neutral-400 font-bold">
                    THÔNG TIN KHÁCH HÀNG
                  </div>
                  <div className="flex items-center justify-between pt-1">
                    <span className="text-white font-bold">{selectedReview.userName || selectedReview.userFullName || 'Khách hàng'}</span>
                    <span className="text-neutral-400 font-mono">{selectedReview.userEmail || `User ID: #${selectedReview.userId}`}</span>
                  </div>
                </div>

                {/* Review Content */}
                <div className="border border-white/[0.08] bg-black/40 p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-mono uppercase tracking-wider text-neutral-400 font-bold">
                      NỘI DUNG ĐÁNH GIÁ TỪ KHÁCH HÀNG
                    </span>
                    {selectedReview.containsSpoiler && (
                      <span className="px-2 py-0.5 bg-rose-500/20 text-rose-300 border border-rose-500/40 text-[9px] font-mono uppercase font-bold">
                        Cảnh báo Spoiler
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-neutral-100 whitespace-pre-wrap leading-relaxed">
                    {selectedReview.content}
                  </p>
                </div>

                {/* Moderation History if hidden or rejected */}
                {(selectedReview.status === 'HIDDEN' || selectedReview.status === 'REJECTED' || selectedReview.moderationReason) && (
                  <div className="border border-rose-500/30 bg-rose-950/20 p-4 space-y-1 text-xs">
                    <div className="flex items-center gap-1.5 text-rose-400 font-bold uppercase tracking-wider text-[10px]">
                      <AlertCircle className="h-3.5 w-3.5" />
                      LỊCH SỬ KIỂM DUYỆT
                    </div>
                    {selectedReview.moderationReason && (
                      <p className="text-neutral-200">
                        Lý do: <strong>{selectedReview.moderationReason}</strong>
                      </p>
                    )}
                    <div className="flex items-center gap-4 text-[10px] text-neutral-400 pt-1 font-mono">
                      {selectedReview.hiddenBy && <span>Bởi: {selectedReview.hiddenBy}</span>}
                      {selectedReview.hiddenAt && <span>Thời gian: {formatDateTime(selectedReview.hiddenAt)}</span>}
                    </div>
                  </div>
                )}

                {/* Reports Section (if any reports) */}
                {selectedReview.reportCount > 0 && (
                  <div className="border border-amber-500/30 bg-amber-950/20 p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 text-amber-300 font-bold text-xs uppercase tracking-wider">
                        <AlertTriangle className="h-4 w-4 text-amber-400" />
                        DANH SÁCH BÁO CÁO VI PHẠM ({selectedReview.reportCount})
                      </div>
                      {loadingReports && <RefreshCw className="h-3.5 w-3.5 animate-spin text-amber-400" />}
                    </div>

                    {reviewReports.length > 0 ? (
                      <div className="space-y-2 max-h-44 overflow-y-auto">
                        {reviewReports.map((rep, idx) => (
                          <div key={rep.id || idx} className="border border-white/10 bg-black/60 p-2.5 space-y-1 text-xs">
                            <div className="flex items-center justify-between text-[10px]">
                              <span className="font-bold text-amber-400 uppercase">{rep.reason}</span>
                              <span className="text-neutral-400 font-mono">{formatDateTime(rep.createdAt)}</span>
                            </div>
                            {rep.description && (
                              <p className="text-neutral-300 text-xs italic">"{rep.description}"</p>
                            )}
                            <div className="text-[10px] text-neutral-500 font-mono">
                              Người báo cáo: {rep.reporterEmail || `User #${rep.reporterUserId}`}
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-neutral-400 italic">
                        Đánh giá bị người dùng đánh dấu báo cáo vi phạm tiêu chuẩn.
                      </p>
                    )}
                  </div>
                )}
              </div>

              {/* Modal Footer Actions (Per status) */}
              <div className="flex items-center justify-between px-6 py-4 bg-neutral-900 border-t border-white/10 shrink-0">
                <button
                  type="button"
                  onClick={() => setSelectedReview(null)}
                  className="px-4 py-2 border border-white/15 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 font-bold text-xs uppercase tracking-wider transition"
                >
                  ĐÓNG
                </button>

                <div className="flex items-center gap-2">
                  {/* Status: PUBLISHED */}
                  {(selectedReview.status === 'PUBLISHED' || selectedReview.status === 'VISIBLE') && (
                    <button
                      type="button"
                      onClick={() => setHideConfirmModal(selectedReview)}
                      className="px-4 py-2 border border-rose-500/40 bg-rose-500/10 hover:bg-rose-600 hover:text-white text-rose-300 font-bold text-xs uppercase tracking-wider transition flex items-center gap-1.5"
                    >
                      <EyeOff className="h-3.5 w-3.5" />
                      ẨN ĐÁNH GIÁ
                    </button>
                  )}

                  {/* Status: FLAGGED */}
                  {selectedReview.status === 'FLAGGED' && (
                    <>
                      <button
                        type="button"
                        onClick={() => setRestoreConfirmModal(selectedReview)}
                        className="px-4 py-2 border border-emerald-500/40 bg-emerald-500/10 hover:bg-emerald-600 hover:text-white text-emerald-300 font-bold text-xs uppercase tracking-wider transition flex items-center gap-1.5"
                      >
                        <Check className="h-3.5 w-3.5" />
                        GIỮ HIỂN THỊ
                      </button>
                      <button
                        type="button"
                        onClick={() => setHideConfirmModal(selectedReview)}
                        className="px-4 py-2 border border-amber-500/40 bg-amber-500/10 hover:bg-amber-500 hover:text-black text-amber-300 font-bold text-xs uppercase tracking-wider transition flex items-center gap-1.5"
                      >
                        <EyeOff className="h-3.5 w-3.5" />
                        ẨN
                      </button>
                      <button
                        type="button"
                        onClick={() => setRejectConfirmModal(selectedReview)}
                        className="px-4 py-2 border border-rose-500/40 bg-rose-500/10 hover:bg-rose-600 hover:text-white text-rose-300 font-bold text-xs uppercase tracking-wider transition flex items-center gap-1.5"
                      >
                        <Ban className="h-3.5 w-3.5" />
                        TỪ CHỐI (REJECT)
                      </button>
                    </>
                  )}

                  {/* Status: HIDDEN */}
                  {selectedReview.status === 'HIDDEN' && (
                    <button
                      type="button"
                      onClick={() => setRestoreConfirmModal(selectedReview)}
                      className="px-4 py-2 border border-emerald-500/40 bg-emerald-500/10 hover:bg-emerald-600 hover:text-white text-emerald-300 font-bold text-xs uppercase tracking-wider transition flex items-center gap-1.5"
                    >
                      <RotateCcw className="h-3.5 w-3.5" />
                      KHÔI PHỤC HIỂN THỊ
                    </button>
                  )}

                  {/* Status: REJECTED */}
                  {selectedReview.status === 'REJECTED' && (
                    <button
                      type="button"
                      onClick={() => setRestoreConfirmModal(selectedReview)}
                      className="px-4 py-2 border border-emerald-500/40 bg-emerald-500/10 hover:bg-emerald-600 hover:text-white text-emerald-300 font-bold text-xs uppercase tracking-wider transition flex items-center gap-1.5"
                    >
                      <RotateCcw className="h-3.5 w-3.5" />
                      KHÔI PHỤC
                    </button>
                  )}
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ═══════════ 7. HIDE REVIEW CONFIRMATION DIALOG ═══════════ */}
      <AnimatePresence>
        {hideConfirmModal && (
          <div
            className="fixed inset-0 z-[170] flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm"
            onClick={() => setHideConfirmModal(null)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.2 }}
              className="relative w-full max-w-lg bg-[#0d0f14] border border-rose-500/40 p-6 space-y-4 shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center gap-3 border-b border-white/10 pb-3">
                <div className="flex h-10 w-10 items-center justify-center border border-rose-500/30 bg-rose-500/10 text-rose-400 shrink-0">
                  <EyeOff className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-sm font-black uppercase tracking-wider text-white">
                    ẨN ĐÁNH GIÁ KHÁCH HÀNG
                  </h3>
                  <p className="text-[10px] text-neutral-400">
                    Đánh giá #{hideConfirmModal.id} của {hideConfirmModal.userName || hideConfirmModal.userFullName || 'khách hàng'}
                  </p>
                </div>
              </div>

              <div className="space-y-3">
                <label className="block text-xs font-bold uppercase tracking-wider text-neutral-300">
                  Lý do ẩn đánh giá <span className="text-rose-400">*</span>
                </label>
                <select
                  value={hideReasonCategory}
                  onChange={(e) => setHideReasonCategory(e.target.value)}
                  className="w-full bg-black border border-white/10 p-2.5 text-xs text-white outline-none focus:border-rose-400"
                >
                  {HIDE_REASONS.map((r) => (
                    <option key={r} value={r}>{r}</option>
                  ))}
                </select>

                {hideReasonCategory === 'Khác' && (
                  <textarea
                    value={hideReasonCustom}
                    onChange={(e) => setHideReasonCustom(e.target.value)}
                    placeholder="Nhập lý do chi tiết..."
                    rows={3}
                    className="w-full bg-black border border-white/10 p-2.5 text-xs text-white placeholder-neutral-500 outline-none focus:border-rose-400 resize-none"
                    autoFocus
                  />
                )}

                <p className="text-[10px] text-neutral-400 leading-relaxed font-mono">
                  • Đánh giá sẽ không còn hiển thị công khai trên trang chi tiết phim.<br />
                  • Điểm số đánh giá này sẽ bị loại trừ khỏi điểm trung bình công khai của phim.<br />
                  • Thao tác này sẽ được ghi lại đầy đủ vào hệ thống Audit Log.
                </p>
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-white/10">
                <button
                  type="button"
                  disabled={actionLoading}
                  onClick={() => setHideConfirmModal(null)}
                  className="px-4 py-2 border border-white/15 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 font-bold text-xs uppercase tracking-wider transition"
                >
                  HỦY
                </button>
                <button
                  type="button"
                  disabled={actionLoading}
                  onClick={executeHideReview}
                  className="px-5 py-2 bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs uppercase tracking-wider transition flex items-center gap-2"
                >
                  {actionLoading ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <EyeOff className="h-3.5 w-3.5" />}
                  XÁC NHẬN ẨN
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ═══════════ 8. RESTORE REVIEW CONFIRMATION DIALOG ═══════════ */}
      <AnimatePresence>
        {restoreConfirmModal && (
          <div
            className="fixed inset-0 z-[170] flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm"
            onClick={() => setRestoreConfirmModal(null)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.2 }}
              className="relative w-full max-w-md bg-[#0d0f14] border border-emerald-500/40 p-6 space-y-4 shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center gap-3 border-b border-white/10 pb-3">
                <div className="flex h-10 w-10 items-center justify-center border border-emerald-500/30 bg-emerald-500/10 text-emerald-400 shrink-0">
                  <RotateCcw className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-sm font-black uppercase tracking-wider text-white">
                    KHÔI PHỤC HIỂN THỊ ĐÁNH GIÁ
                  </h3>
                  <p className="text-[10px] text-neutral-400">
                    Đánh giá #{restoreConfirmModal.id} của {restoreConfirmModal.userName || restoreConfirmModal.userFullName || 'khách hàng'}
                  </p>
                </div>
              </div>

              <p className="text-xs text-neutral-300 leading-relaxed">
                Bạn có chắc chắn muốn khôi phục hiển thị đánh giá này? Đánh giá sẽ xuất hiện trở lại trên trang chi tiết phim và điểm số sẽ được tính lại vào điểm trung bình của phim.
              </p>

              <div className="flex justify-end gap-3 pt-3 border-t border-white/10">
                <button
                  type="button"
                  disabled={actionLoading}
                  onClick={() => setRestoreConfirmModal(null)}
                  className="px-4 py-2 border border-white/15 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 font-bold text-xs uppercase tracking-wider transition"
                >
                  HỦY
                </button>
                <button
                  type="button"
                  disabled={actionLoading}
                  onClick={executeRestoreReview}
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs uppercase tracking-wider transition flex items-center gap-2"
                >
                  {actionLoading ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                  XÁC NHẬN KHÔI PHỤC
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ═══════════ 9. REJECT REVIEW CONFIRMATION DIALOG ═══════════ */}
      <AnimatePresence>
        {rejectConfirmModal && (
          <div
            className="fixed inset-0 z-[170] flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm"
            onClick={() => setRejectConfirmModal(null)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.2 }}
              className="relative w-full max-w-lg bg-[#0d0f14] border border-red-600/40 p-6 space-y-4 shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center gap-3 border-b border-white/10 pb-3">
                <div className="flex h-10 w-10 items-center justify-center border border-red-500/30 bg-red-500/10 text-red-400 shrink-0">
                  <Ban className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-sm font-black uppercase tracking-wider text-white">
                    TỪ CHỐI ĐÁNH GIÁ (REJECT)
                  </h3>
                  <p className="text-[10px] text-neutral-400">
                    Đánh giá #{rejectConfirmModal.id} của {rejectConfirmModal.userName || rejectConfirmModal.userFullName || 'khách hàng'}
                  </p>
                </div>
              </div>

              <div className="space-y-2">
                <label className="block text-xs font-bold uppercase tracking-wider text-neutral-300">
                  Lý do từ chối:
                </label>
                <textarea
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  placeholder="Nhập lý do từ chối đánh giá..."
                  rows={3}
                  className="w-full bg-black border border-white/10 p-2.5 text-xs text-white placeholder-neutral-500 outline-none focus:border-red-400 resize-none"
                  autoFocus
                />
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-white/10">
                <button
                  type="button"
                  disabled={actionLoading}
                  onClick={() => setRejectConfirmModal(null)}
                  className="px-4 py-2 border border-white/15 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 font-bold text-xs uppercase tracking-wider transition"
                >
                  HỦY
                </button>
                <button
                  type="button"
                  disabled={actionLoading}
                  onClick={executeRejectReview}
                  className="px-5 py-2 bg-red-600 hover:bg-red-500 text-white font-bold text-xs uppercase tracking-wider transition flex items-center gap-2"
                >
                  {actionLoading ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Ban className="h-3.5 w-3.5" />}
                  XÁC NHẬN TỪ CHỐI
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
