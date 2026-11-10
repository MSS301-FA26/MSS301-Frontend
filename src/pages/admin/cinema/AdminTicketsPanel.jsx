import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  Building2,
  Calendar,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Clock,
  CreditCard,
  Eye,
  Film,
  Filter,
  History,
  Info,
  MapPin,
  QrCode,
  RefreshCw,
  Search,
  Ticket,
  User,
  UtensilsCrossed,
  Wallet,
  X
} from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { adminService } from '../../../services/adminService';

const STATUS_FILTERS = ['ALL', 'PAID', 'USED', 'HOLDING', 'PENDING_PAYMENT', 'EXPIRED', 'CANCELLED', 'REFUNDED'];

const STATUS_META = {
  PAID: { label: 'Đã thanh toán', className: 'border-emerald-500/30 bg-emerald-950/30 text-emerald-300' },
  USED: { label: 'Đã check-in', className: 'border-sky-500/30 bg-sky-950/30 text-sky-300' },
  HOLDING: { label: 'Đang giữ', className: 'border-amber-500/30 bg-amber-950/30 text-amber-300' },
  PENDING_PAYMENT: { label: 'Chờ thanh toán', className: 'border-amber-500/30 bg-amber-950/30 text-amber-300' },
  EXPIRED: { label: 'Hết hạn', className: 'border-neutral-600 bg-neutral-900 text-neutral-400' },
  CANCELLED: { label: 'Đã hủy', className: 'border-rose-500/30 bg-rose-950/30 text-rose-300' },
  REFUNDED: { label: 'Đã hoàn tiền', className: 'border-purple-500/30 bg-purple-950/30 text-purple-300' },
};

const ACTION_META = {
  CANCEL: { label: 'HỦY VÉ', color: 'border-rose-500/40 bg-rose-950/40 text-rose-300' },
  REFUND: { label: 'HOÀN TIỀN', color: 'border-purple-500/40 bg-purple-950/40 text-purple-300' },
  CHECK_IN: { label: 'SOÁT VÉ', color: 'border-sky-500/40 bg-sky-950/40 text-sky-300' },
  STATUS_CHANGE: { label: 'ĐỔI TRẠNG THÁI', color: 'border-amber-500/40 bg-amber-950/40 text-amber-300' },
};

const SEAT_TYPE_LABELS = {
  VIP: 'VIP',
  NORMAL: 'Thường',
  STANDARD: 'Thường',
  COUPLE: 'Ghế đôi',
  SWEETBOX: 'Ghế đôi'
};

const formatVnd = (value) => `${Number(value || 0).toLocaleString('vi-VN')}đ`;

const formatDateTime = (value) => {
  if (!value) return 'Chưa có dữ liệu';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleString('vi-VN');
};

const getBookingSeatLabels = (booking) => {
  if (!booking) return [];
  const seats = booking.seats || [];
  return seats
    .map((s) => s.seatLabel || (s.rowLabel && s.seatNumber ? `${s.rowLabel}${s.seatNumber}` : '') || s.seatCode || s.code || s.seatName || '')
    .filter(Boolean);
};

const getSortTime = (item) => {
  if (!item) return 0;
  // Use actual transaction timestamps (payment, refund, cancel, or creation)
  // NEVER use showtimeStart because showtime is in the future
  const raw =
    item.paidAt ||
    item.refundedAt ||
    item.cancelledAt ||
    item.createdAt ||
    item.createdDate ||
    item.bookingTime ||
    item.timestamp;
  if (raw) {
    if (Array.isArray(raw)) {
      return new Date(raw[0], (raw[1] || 1) - 1, raw[2] || 1, raw[3] || 0, raw[4] || 0, raw[5] || 0).getTime();
    }
    const t = new Date(raw).getTime();
    if (!Number.isNaN(t)) return t;
  }
  return 0;
};

const sortNewestFirst = (list) => {
  if (!Array.isArray(list)) return [];
  return [...list].sort((a, b) => {
    const timeA = getSortTime(a);
    const timeB = getSortTime(b);

    // If there is a distinct time difference (>= 1 second), newest time comes first
    if (timeA && timeB && Math.abs(timeB - timeA) >= 1000) {
      return timeB - timeA;
    }

    // If times are identical or one is missing, higher ID is strictly newer
    const idA = Number(a?.id || 0);
    const idB = Number(b?.id || 0);
    if (idB !== idA && idA > 0 && idB > 0) {
      return idB - idA;
    }

    if (timeB !== timeA) {
      return timeB - timeA;
    }
    return 0;
  });
};

export default function AdminTicketsPanel({ ctx }) {
  const {
    getAdminToken = () => null,
    showToast = () => {},
    isAdmin = false,
    isManager = false,
    currentUser = null
  } = ctx;

  const isEffectiveAdmin = Boolean(
    isAdmin ||
    currentUser?.role === 'admin' ||
    (currentUser?.roles || []).some((r) => String(r).toUpperCase() === 'ADMIN' || String(r).toUpperCase() === 'ROLE_ADMIN')
  );
  const isEffectiveManager = !isEffectiveAdmin && Boolean(
    isManager ||
    currentUser?.role === 'manager' ||
    (currentUser?.roles || []).some((r) => String(r).toUpperCase() === 'MANAGER' || String(r).toUpperCase() === 'ROLE_MANAGER')
  );

  // Active view tab: 'TICKETS' or 'AUDIT_LOGS'
  const [activeSubTab, setActiveSubTab] = useState('TICKETS');

  // Multi-cinema filter
  const [cinemas, setCinemas] = useState([]);
  const [selectedCinemaId, setSelectedCinemaId] = useState(
    isEffectiveManager && (currentUser?.cinemaId || ctx?.assignedCinema?.id)
      ? String(currentUser?.cinemaId || ctx?.assignedCinema?.id)
      : 'ALL'
  );

  // Tickets state
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [ticketSearch, setTicketSearch] = useState('');
  const [bookings, setBookings] = useState([]);
  const [page, setPage] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [expandedId, setExpandedId] = useState(null);

  // Detail Modal state
  const [detailTarget, setDetailTarget] = useState(null);
  const [isDetailLoading, setIsDetailLoading] = useState(false);

  // Audit Detail Modal state
  const [auditDetailTarget, setAuditDetailTarget] = useState(null);
  const [isAuditDetailLoading, setIsAuditDetailLoading] = useState(false);

  // Action Modals: Cancel Target
  const [cancelTarget, setCancelTarget] = useState(null);
  const [cancelReason, setCancelReason] = useState('');
  const [isCancelling, setIsCancelling] = useState(false);

  // Audit Logs state
  const [auditLogs, setAuditLogs] = useState([]);
  const [isAuditLoading, setIsAuditLoading] = useState(false);
  const [auditActionFilter, setAuditActionFilter] = useState('ALL');

  // Build initial userMap from ctx.adminUsers if present
  const userMap = useMemo(() => {
    const map = {};
    (ctx?.adminUsers || []).forEach((u) => {
      if (u?.id) {
        map[u.id] = {
          fullName: u.fullName || u.name,
          email: u.email,
          phone: u.phone || u.phoneNumber
        };
      }
    });
    return map;
  }, [ctx?.adminUsers]);

  const [enrichedUserMap, setEnrichedUserMap] = useState({});

  // Enrich user info for any bookings with missing userMap entry
  useEffect(() => {
    if (!bookings || bookings.length === 0) return;
    const token = getAdminToken();
    if (!token) return;

    const missingIds = [...new Set(
      bookings
        .map((b) => Number(b?.userId))
        .filter((id) => id && !isNaN(id) && !userMap[id] && !enrichedUserMap[id])
    )];

    if (missingIds.length === 0) return;

    let cancelled = false;
    missingIds.forEach((uid) => {
      adminService.getAdminUserDetail(token, uid)
        .then((res) => {
          if (cancelled) return;
          const u = res?.data || res;
          if (u && (u.fullName || u.name || u.email || u.phone)) {
            setEnrichedUserMap((prev) => ({
              ...prev,
              [uid]: {
                fullName: u.fullName || u.name,
                email: u.email,
                phone: u.phone || u.phoneNumber
              }
            }));
          }
        })
        .catch(() => {});
    });
    return () => { cancelled = true; };
  }, [bookings, getAdminToken, userMap, enrichedUserMap]);

  // Load Cinemas for dropdown filter
  useEffect(() => {
    const token = getAdminToken();
    if (!token) return;
    adminService.getAdminCinemas(token)
      .then((res) => {
        const list = Array.isArray(res) ? res : (res?.items || res?.content || []);
        setCinemas(list);
        if (isEffectiveManager && list.length > 0) {
          setSelectedCinemaId(String(list[0].id));
        }
      })
      .catch(() => {});
  }, [getAdminToken, isEffectiveManager]);

  const cinemaMap = useMemo(() => {
    const map = {};
    (cinemas || []).forEach((c) => {
      if (c?.id) map[c.id] = c.name || `Rạp #${c.id}`;
    });
    return map;
  }, [cinemas]);

  // Load Bookings
  const loadBookings = async (nextPage = 0, status = statusFilter, cinema = selectedCinemaId) => {
    const token = getAdminToken();
    if (!token) return;
    setIsLoading(true);
    try {
      const params = { page: nextPage, size: 15, sort: 'id,desc' };
      if (status !== 'ALL') params.status = status;
      const effectiveCinemaId = isEffectiveManager
        ? (currentUser?.cinemaId || ctx?.assignedCinema?.id)
        : (cinema !== 'ALL' ? Number(cinema) : undefined);

      if (effectiveCinemaId) {
        params.cinemaId = Number(effectiveCinemaId);
      }
      if (ticketSearch.trim()) {
        params.search = ticketSearch.trim();
        params.bookingCode = ticketSearch.trim();
      }

      const data = await adminService.getAdminBookings(token, params);
      const rawBookings = data.items || [];
      const sortedBookingsList = sortNewestFirst(rawBookings);
      setBookings(sortedBookingsList);
      setPage(data.page || 0);
      setTotalPages(data.totalPages || 1);
      setTotalItems(data.totalItems || 0);
      setExpandedId(null);
    } catch (err) {
      showToast(err?.message || 'Không thể tải danh sách vé.', 'error');
      setBookings([]);
    } finally {
      setIsLoading(false);
    }
  };

  // Load Audit Logs
  const loadAuditLogs = async (cinema = selectedCinemaId) => {
    const token = getAdminToken();
    if (!token) return;
    setIsAuditLoading(true);
    try {
      const params = { page: 0, size: 50, sort: 'id,desc' };
      const effectiveCinemaId = isEffectiveManager
        ? (currentUser?.cinemaId || ctx?.assignedCinema?.id)
        : (cinema !== 'ALL' ? Number(cinema) : undefined);

      if (effectiveCinemaId) {
        params.cinemaId = Number(effectiveCinemaId);
      }
      const data = await adminService.getTicketAuditLogs(token, params);
      const rawList = Array.isArray(data) ? data : (data?.content || data?.items || []);
      const sortedList = sortNewestFirst(rawList);
      setAuditLogs(sortedList);
    } catch (err) {
      showToast(err?.message || 'Không thể tải lịch sử kiểm toán vé.', 'error');
      setAuditLogs([]);
    } finally {
      setIsAuditLoading(false);
    }
  };

  useEffect(() => {
    if (activeSubTab === 'TICKETS') {
      loadBookings(0, statusFilter, selectedCinemaId);
    } else {
      loadAuditLogs(selectedCinemaId);
    }
  }, [activeSubTab, statusFilter, selectedCinemaId]);

  // Open Audit Log Details Modal
  const handleOpenAuditDetail = async (log) => {
    if (!log) return;
    const existing = (bookings || []).find(
      (b) => b.id === log.bookingId || (log.ticketCode && b.bookingCode === log.ticketCode) || (log.bookingCode && b.bookingCode === log.bookingCode)
    ) || null;

    setAuditDetailTarget({
      log,
      booking: existing
    });

    const token = getAdminToken();
    if (!token || !log.bookingId) return;

    setIsAuditDetailLoading(true);
    try {
      const fresh = await adminService.getAdminBookingDetail(token, log.bookingId);
      if (fresh) {
        setAuditDetailTarget((prev) => (prev ? { ...prev, booking: fresh } : prev));
      }
    } catch (err) {
      console.warn('Could not load booking detail for audit log:', err);
    } finally {
      setIsAuditDetailLoading(false);
    }
  };

  // Open Ticket Details Modal
  const handleOpenDetail = async (booking) => {
    if (!booking) return;
    setDetailTarget(booking);
    const token = getAdminToken();
    if (!token || !booking.id) return;

    setIsDetailLoading(true);
    try {
      const fresh = await adminService.getAdminBookingDetail(token, booking.id);
      if (fresh) {
        setDetailTarget((prev) => ({ ...prev, ...fresh }));
      }
    } catch {
      // Keep existing data
    } finally {
      setIsDetailLoading(false);
    }
  };

  // Handle Cancel Ticket
  const handleConfirmCancel = async () => {
    if (!cancelTarget) return;
    const token = getAdminToken();
    if (!token) return;
    setIsCancelling(true);
    try {
      await adminService.cancelBookingAdmin(token, cancelTarget.id, cancelReason.trim());
      showToast(`Đã hủy vé ${cancelTarget.bookingCode} thành công. Ghế đã được giải phóng.`, 'success');
      setCancelTarget(null);
      setCancelReason('');
      loadBookings(page);
    } catch (err) {
      showToast(err?.message || 'Không thể hủy vé.', 'error');
    } finally {
      setIsCancelling(false);
    }
  };

  const pageStats = useMemo(() => {
    const seats = bookings.reduce((sum, b) => sum + (b.seats?.length || 0), 0);
    const foods = bookings.reduce((sum, b) => sum + (b.foods || []).reduce((s, f) => s + (f.quantity || 0), 0), 0);
    const paidRevenue = bookings
      .filter((b) => ['PAID', 'USED'].includes(b.status))
      .reduce((sum, b) => sum + Number(b.totalAmount || 0), 0);
    const refundedAmount = bookings
      .filter((b) => b.status === 'REFUNDED')
      .reduce((sum, b) => sum + Number(b.totalAmount || 0), 0);
    return { seats, foods, paidRevenue, refundedAmount };
  }, [bookings]);

  const sortedBookings = useMemo(() => {
    return sortNewestFirst(bookings);
  }, [bookings]);

  const filteredAuditLogs = useMemo(() => {
    let list = auditLogs;
    if (auditActionFilter !== 'ALL') {
      list = list.filter((log) => String(log.action).toUpperCase() === auditActionFilter);
    }
    return sortNewestFirst(list);
  }, [auditLogs, auditActionFilter]);

  const getCustomerInfo = (b) => {
    const uid = b?.userId ? Number(b.userId) : null;
    const mapped = (uid && (enrichedUserMap[uid] || userMap[uid])) || null;

    const fullName =
      b?.customerName ||
      b?.customerNameSnapshot ||
      b?.userFullName ||
      b?.userName ||
      b?.user?.fullName ||
      b?.user?.name ||
      mapped?.fullName ||
      (uid ? `Khách #${uid}` : 'Khách vãng lai');

    const contact =
      b?.customerPhone ||
      b?.customerPhoneSnapshot ||
      b?.customerEmail ||
      b?.userEmail ||
      b?.customerEmailSnapshot ||
      b?.user?.phone ||
      b?.user?.email ||
      mapped?.phone ||
      mapped?.email ||
      '—';

    const email =
      b?.userEmail ||
      b?.customerEmail ||
      b?.customerEmailSnapshot ||
      b?.user?.email ||
      mapped?.email ||
      '—';

    const phone =
      b?.customerPhone ||
      b?.customerPhoneSnapshot ||
      b?.user?.phone ||
      mapped?.phone ||
      '—';

    return { fullName, contact, email, phone };
  };

  return (
    <div className="space-y-5">
      {/* Top Header & Sub-Tabs */}
      <div className="flex flex-col gap-4 border border-white/[0.05] bg-[#070707] p-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-[8px] font-mono font-black uppercase tracking-[0.25em] text-neutral-400">
            {isEffectiveAdmin ? 'SYSTEM TICKETING CONTROL' : 'CINEMA TICKETING CONTROL'}
          </p>
          <h2 className="mt-1 flex items-center gap-2 text-sm font-sans font-black uppercase tracking-wide text-neutral-100">
            <Ticket className="h-5 w-5 text-amber-500" /> Quản Lý Đặt Vé
          </h2>
          <p className="mt-1 text-xs text-neutral-400">
            {isEffectiveManager
              ? `Phạm vi quản lý: ${cinemaMap[currentUser?.cinemaId] || ('Rạp #' + currentUser?.cinemaId)}`
              : 'Quản lý toàn bộ vé bán ra trên toàn hệ thống và theo dõi nhật ký kiểm toán vé.'}
          </p>
        </div>

        {/* Action Controls & Sub-tabs */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Sub-tab switcher */}
          <div className="flex border border-white/[0.1] bg-black p-0.5">
            <button
              onClick={() => setActiveSubTab('TICKETS')}
              className={`px-3 py-1.5 text-[9px] font-black uppercase tracking-wider transition ${
                activeSubTab === 'TICKETS' ? 'bg-amber-500 text-black' : 'text-neutral-400 hover:text-white'
              }`}
            >
              Danh sách vé
            </button>
            <button
              onClick={() => setActiveSubTab('AUDIT_LOGS')}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-[9px] font-black uppercase tracking-wider transition ${
                activeSubTab === 'AUDIT_LOGS' ? 'bg-amber-500 text-black' : 'text-neutral-400 hover:text-white'
              }`}
            >
              <History className="h-3 w-3" />
              Lịch sử hoàn hủy
            </button>
          </div>

          {/* Cinema Filter (Admin chooses; Manager locked) */}
          {isEffectiveAdmin ? (
            <div className="flex items-center gap-1 border border-white/[0.1] bg-black px-2.5 py-1">
              <Building2 className="h-3.5 w-3.5 text-amber-400" />
              <select
                value={selectedCinemaId}
                onChange={(e) => {
                  setSelectedCinemaId(e.target.value);
                  setPage(0);
                }}
                className="bg-transparent text-[10px] font-bold text-white outline-none"
              >
                <option value="ALL">Tất cả các rạp</option>
                {cinemas.map((c) => (
                  <option key={c.id} value={c.id} className="bg-black text-white">
                    {c.name || `Rạp #${c.id}`}
                  </option>
                ))}
              </select>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 border border-sky-500/30 bg-sky-950/20 px-3 py-1 text-[10px] font-mono text-sky-300">
              <Building2 className="h-3 w-3" />
              <span>{cinemaMap[currentUser?.cinemaId] || (cinemas.length === 1 ? cinemas[0].name : null) || ctx?.assignedCinema?.name || `Rạp #${currentUser?.cinemaId || '—'}`}</span>
            </div>
          )}

          <button
            onClick={() => (activeSubTab === 'TICKETS' ? loadBookings(page) : loadAuditLogs())}
            disabled={isLoading || isAuditLoading}
            className="flex items-center gap-1.5 border border-white/10 bg-black px-3 py-1.5 text-[10px] font-mono uppercase tracking-widest text-neutral-300 transition hover:border-amber-500/50 hover:text-white disabled:opacity-50"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isLoading || isAuditLoading ? 'animate-spin' : ''}`} />
            Làm mới
          </button>
        </div>
      </div>

      {activeSubTab === 'TICKETS' ? (
        <>
          {/* Stat tiles */}
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <div className="border border-white/[0.08] bg-white/[0.02] p-4">
              <p className="text-[9px] font-black uppercase tracking-widest text-neutral-400">Vé bán (trang này)</p>
              <p className="mt-1 text-xl font-black font-mono text-white">{pageStats.seats}</p>
            </div>
            <div className="border border-white/[0.08] bg-white/[0.02] p-4">
              <p className="text-[9px] font-black uppercase tracking-widest text-neutral-400">Bắp nước kèm</p>
              <p className="mt-1 text-xl font-black font-mono text-amber-400">{pageStats.foods}</p>
            </div>
            <div className="border border-white/[0.08] bg-white/[0.02] p-4">
              <p className="text-[9px] font-black uppercase tracking-widest text-neutral-400">Thực thu (Đã trả)</p>
              <p className="mt-1 text-xl font-black font-mono text-emerald-400">{formatVnd(pageStats.paidRevenue)}</p>
            </div>
            <div className="border border-white/[0.08] bg-white/[0.02] p-4">
              <p className="text-[9px] font-black uppercase tracking-widest text-neutral-400">Tiền đã hoàn</p>
              <p className="mt-1 text-xl font-black font-mono text-purple-400">{formatVnd(pageStats.refundedAmount)}</p>
            </div>
          </div>

          {/* Filter Bar */}
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-wrap gap-1.5">
              {STATUS_FILTERS.map((status) => (
                <button
                  key={status}
                  onClick={() => {
                    setStatusFilter(status);
                    loadBookings(0, status);
                  }}
                  className={`border px-2.5 py-1 text-[9px] font-mono font-black uppercase tracking-wider transition ${
                    statusFilter === status
                      ? 'border-amber-500/60 bg-amber-500/15 text-amber-300'
                      : 'border-white/10 bg-black text-neutral-300 hover:border-white/30 hover:text-white'
                  }`}
                >
                  {status === 'ALL' ? 'Tất cả trạng thái' : (STATUS_META[status]?.label || status)}
                </button>
              ))}
            </div>

            <div className="relative w-full sm:max-w-xs">
              <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-neutral-500" />
              <input
                value={ticketSearch}
                onChange={(e) => setTicketSearch(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && loadBookings(0)}
                placeholder="Mã đơn (ấn Enter để tìm)..."
                className="w-full border border-white/[0.08] bg-black py-1.5 pl-8 pr-3 text-xs text-white outline-none focus:border-amber-400 placeholder:text-neutral-600"
              />
            </div>
          </div>

          {/* Table */}
          <div className="overflow-x-auto border border-white/10 bg-[#050505]">
            <table className="min-w-full divide-y divide-white/10 text-left text-xs font-sans">
              <thead className="bg-[#0B0B0B] text-[9px] uppercase tracking-[0.15em] text-neutral-400 font-bold">
                <tr>
                  <th className="px-4 py-3.5">Mã đơn &amp; Thời gian GD</th>
                  <th className="px-4 py-3.5">Phim &amp; Rạp</th>
                  <th className="px-4 py-3.5">Ghế ngồi</th>
                  <th className="px-4 py-3.5">Người mua</th>
                  <th className="px-4 py-3.5">Tổng tiền</th>
                  <th className="px-4 py-3.5">Trạng thái</th>
                  <th className="whitespace-nowrap px-4 py-3.5 text-right">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5 text-neutral-300">
                {isLoading ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-12 text-center text-neutral-400 font-mono text-xs">
                      Đang tải danh sách vé…
                    </td>
                  </tr>
                ) : sortedBookings.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-12 text-center text-neutral-400 font-mono text-xs">
                      Không có đơn đặt vé nào khớp với bộ lọc hiện tại.
                    </td>
                  </tr>
                ) : (
                  sortedBookings.map((b) => {
                    const statusMeta = STATUS_META[b.status] || {
                      label: b.status,
                      className: 'border-white/10 bg-neutral-900 text-neutral-300'
                    };
                    const isExpanded = expandedId === b.id;
                    const cinemaName = b.cinemaName || cinemaMap[b.cinemaId] || `Rạp #${b.cinemaId || '—'}`;
                    const seatLabels = getBookingSeatLabels(b);
                    const cust = getCustomerInfo(b);

                    return (
                      <React.Fragment key={b.id}>
                        <tr
                          className="cursor-pointer transition hover:bg-white/[0.02]"
                          onClick={() => handleOpenDetail(b)}
                        >
                          <td className="whitespace-nowrap px-4 py-3.5">
                            <div className="flex items-center gap-1.5 font-mono text-[11px] font-bold text-white">
                              <span className="text-amber-400">#{b.id}</span>
                              <span>{b.bookingCode}</span>
                            </div>
                            <p className="mt-0.5 text-[10px] text-neutral-400 font-mono">
                              {formatDateTime(b.paidAt || b.createdAt)}
                            </p>
                          </td>
                          <td className="px-4 py-3.5">
                            <p className="max-w-[200px] truncate font-bold text-white">{b.movieTitle || 'Vé xem phim'}</p>
                            <p className="text-[10px] text-sky-400 font-mono">{cinemaName}</p>
                          </td>
                          <td className="px-4 py-3.5">
                            <span className="font-mono text-amber-300 font-bold">
                              {seatLabels.length > 0 ? seatLabels.join(', ') : 'Chưa gán ghế'}
                            </span>
                          </td>
                          <td className="px-4 py-3.5">
                            <p className="truncate text-xs font-bold text-white">
                              {cust.fullName}
                            </p>
                            <p className="text-[10px] text-neutral-400 font-mono">
                              {cust.contact}
                            </p>
                          </td>
                          <td className="whitespace-nowrap px-4 py-3.5 font-mono font-bold text-emerald-400">
                            {formatVnd(b.totalAmount)}
                          </td>
                          <td className="px-4 py-3.5">
                            <span className={`inline-block border px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider ${statusMeta.className}`}>
                              {statusMeta.label}
                            </span>
                          </td>
                          <td className="whitespace-nowrap px-4 py-3.5 text-right">
                            <div className="flex items-center justify-end" onClick={(e) => e.stopPropagation()}>
                              {/* Xem chi tiết */}
                              <button
                                type="button"
                                onClick={() => handleOpenDetail(b)}
                                className="inline-flex items-center justify-center gap-1.5 border border-white/10 bg-white/[0.04] px-3 py-1 text-[9.5px] font-mono font-bold uppercase tracking-wider text-neutral-200 transition hover:border-amber-400 hover:text-amber-300 hover:bg-amber-500/10"
                              >
                                <Eye className="h-3 w-3 text-amber-400" />
                                <span>Chi tiết</span>
                              </button>
                            </div>
                          </td>
                        </tr>

                        {/* Quick inline expanded info */}
                        {isExpanded && (
                          <tr className="bg-[#080808]">
                            <td colSpan={7} className="px-6 py-4 border-t border-white/[0.04]">
                              <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                                <div>
                                  <p className="text-[9px] font-black uppercase tracking-widest text-neutral-400">Chi tiết thanh toán</p>
                                  <p className="mt-1 text-xs text-neutral-300">
                                    Phương thức: <span className="font-bold text-white">{b.paymentMethod || 'CineWallet / Trực tuyến'}</span>
                                  </p>
                                  <p className="text-xs text-neutral-300">
                                    Thời gian: <span className="font-mono text-neutral-400">{formatDateTime(b.createdAt)}</span>
                                  </p>
                                  {b.checkedInAt && (
                                    <p className="text-xs text-sky-400 font-mono">
                                      Soát vé lúc: {formatDateTime(b.checkedInAt)}
                                    </p>
                                  )}
                                </div>

                                <div>
                                  <p className="text-[9px] font-black uppercase tracking-widest text-neutral-400">Bắp nước đính kèm</p>
                                  {(b.foods || []).length > 0 ? (
                                    <div className="mt-1 space-y-1">
                                      {b.foods.map((f, idx) => (
                                        <div key={idx} className="text-xs text-neutral-300">
                                          {f.foodName || f.name} x {f.quantity} ({formatVnd(f.price || f.unitPrice)})
                                        </div>
                                      ))}
                                    </div>
                                  ) : (
                                    <p className="mt-1 text-xs text-neutral-500 italic">Không có bắp nước</p>
                                  )}
                                </div>

                                <div className="flex flex-col justify-between items-start md:items-end">
                                  <div>
                                    <p className="text-[9px] font-black uppercase tracking-widest text-neutral-400">Thao tác nâng cao</p>
                                    <p className="mt-1 text-[11px] text-neutral-400">
                                      Xem đầy đủ sơ đồ ghế, QR code và chứng từ đơn hàng.
                                    </p>
                                  </div>
                                  <button
                                    type="button"
                                    onClick={() => handleOpenDetail(b)}
                                    className="mt-2 flex items-center gap-1.5 border border-amber-500/50 bg-amber-500/10 px-3 py-1.5 text-xs font-mono font-bold uppercase tracking-wider text-amber-300 hover:bg-amber-500 hover:text-black transition"
                                  >
                                    <Eye className="h-3.5 w-3.5" /> Mở chi tiết vé
                                  </button>
                                </div>
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="flex items-center justify-between text-[10px] font-mono uppercase tracking-widest text-neutral-400">
            <span>{totalItems} đơn đặt vé · Trang {page + 1}/{totalPages}</span>
            <div className="flex gap-2">
              <button
                disabled={page <= 0 || isLoading}
                onClick={() => loadBookings(page - 1)}
                className="flex items-center gap-1 border border-white/10 px-3 py-1.5 text-white transition hover:border-amber-500/50 disabled:opacity-30"
              >
                <ChevronLeft className="h-3.5 w-3.5" /> Trước
              </button>
              <button
                disabled={page >= totalPages - 1 || isLoading}
                onClick={() => loadBookings(page + 1)}
                className="flex items-center gap-1 border border-white/10 px-3 py-1.5 text-white transition hover:border-amber-500/50 disabled:opacity-30"
              >
                Sau <ChevronRight className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        </>
      ) : (
        /* Sub-tab: Lịch sử Audit Logs (Hủy & Hoàn tiền) */
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 border border-white/[0.05] bg-black p-3">
            <div className="flex items-center gap-2">
              <span className="text-[9px] font-black uppercase tracking-widest text-neutral-400">Lọc hành động:</span>
              {['ALL', 'CANCEL', 'REFUND', 'CHECK_IN'].map((action) => (
                <button
                  key={action}
                  onClick={() => setAuditActionFilter(action)}
                  className={`border px-2.5 py-1 text-[8px] font-black uppercase tracking-wider transition ${
                    auditActionFilter === action
                      ? 'border-amber-400 bg-amber-500 text-black'
                      : 'border-white/[0.08] text-neutral-400 hover:text-white'
                  }`}
                >
                  {action === 'ALL' ? 'Tất cả' : (ACTION_META[action]?.label || action)}
                </button>
              ))}
            </div>
            <span className="text-[10px] font-mono text-neutral-400">
              Tổng ghi nhận: {filteredAuditLogs.length} sự kiện
            </span>
          </div>

          <div className="overflow-x-auto border border-white/10 bg-[#050505]">
            <table className="min-w-full divide-y divide-white/10 text-left text-xs font-sans">
              <thead className="bg-[#0B0B0B] text-[9px] uppercase tracking-[0.15em] text-neutral-400 font-bold">
                <tr>
                  <th className="px-4 py-3.5">Thời gian</th>
                  <th className="px-4 py-3.5">Mã đơn</th>
                  <th className="px-4 py-3.5">Hành động</th>
                  <th className="px-4 py-3.5">Trạng thái đổi</th>
                  <th className="px-4 py-3.5">Số tiền hoàn</th>
                  <th className="px-4 py-3.5">Lý do ghi nhận</th>
                  <th className="px-4 py-3.5">Người thực hiện</th>
                  <th className="px-4 py-3.5">Cụm rạp</th>
                  <th className="px-4 py-3.5 text-right">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5 text-neutral-300">
                {isAuditLoading ? (
                  <tr>
                    <td colSpan={9} className="px-4 py-12 text-center text-neutral-400 font-mono text-xs">
                      Đang tải lịch sử kiểm toán vé…
                    </td>
                  </tr>
                ) : filteredAuditLogs.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="px-4 py-12 text-center text-neutral-400 font-mono text-xs">
                      Chưa có sự kiện hủy hoặc hoàn tiền nào được ghi lại.
                    </td>
                  </tr>
                ) : (
                  filteredAuditLogs.map((log) => {
                    const actionMeta = ACTION_META[log.action] || {
                      label: log.action,
                      color: 'border-white/10 bg-white/5 text-white'
                    };
                    const bCode = log.ticketCode || log.bookingCode || '';
                    return (
                      <tr key={log.id} className="transition hover:bg-white/[0.02]">
                        <td className="whitespace-nowrap px-4 py-3 font-mono text-[10px] text-neutral-400">
                          {formatDateTime(log.createdAt)}
                        </td>
                        <td className="px-4 py-3 font-mono font-bold text-white">
                          #{log.bookingId} {bCode ? `(${bCode})` : ''}
                        </td>
                        <td className="px-4 py-3">
                          <span className={`inline-block border px-2 py-0.5 text-[8px] font-black uppercase tracking-wider ${actionMeta.color}`}>
                            {actionMeta.label}
                          </span>
                        </td>
                        <td className="px-4 py-3 font-mono text-[10px]">
                          <span className="text-neutral-400">{log.oldStatus || '—'}</span>
                          <span className="mx-1 text-amber-400">→</span>
                          <span className="font-bold text-white">{log.newStatus || log.status || '—'}</span>
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 font-mono font-bold text-emerald-400">
                          {Number(log.amount || 0) > 0 ? formatVnd(log.amount) : '0đ'}
                        </td>
                        <td className="px-4 py-3 max-w-[200px] truncate text-neutral-300" title={log.reason || 'Không ghi chú'}>
                          {log.reason || 'Không ghi chú'}
                        </td>
                        <td className="px-4 py-3 text-[10px] text-neutral-400 font-mono">
                          {log.actorEmail || 'Hệ thống'}
                        </td>
                        <td className="px-4 py-3 text-[10px] text-sky-400 font-mono">
                          {cinemaMap[log.cinemaId] || `Rạp #${log.cinemaId || '—'}`}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-right">
                          <button
                            type="button"
                            onClick={() => handleOpenAuditDetail(log)}
                            className="inline-flex items-center justify-center gap-1.5 border border-white/10 bg-white/[0.04] px-3 py-1 text-[9.5px] font-mono font-bold uppercase tracking-wider text-neutral-200 transition hover:border-amber-400 hover:text-amber-300 hover:bg-amber-500/10"
                          >
                            <Eye className="h-3 w-3 text-amber-400" />
                            <span>Chi tiết</span>
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal Xem chi tiết vé */}
      {detailTarget && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-sm p-4 overflow-y-auto"
          onClick={() => setDetailTarget(null)}
        >
          <div
            className="w-full max-w-2xl border border-white/[0.15] bg-[#0c0c0c] shadow-2xl shadow-black p-6 space-y-5 my-8 text-neutral-200"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-start justify-between border-b border-white/[0.08] pb-4">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-[9px] font-mono font-black uppercase tracking-[0.25em] text-amber-400">
                    CINEPREMIER TICKET DETAILS
                  </span>
                  {isDetailLoading && (
                    <RefreshCw className="h-3 w-3 animate-spin text-neutral-500" />
                  )}
                </div>
                <h3 className="mt-1 flex items-center gap-2 text-lg font-black uppercase tracking-wide text-white">
                  <Ticket className="h-5 w-5 text-amber-400" />
                  Đơn đặt vé #{detailTarget.bookingCode}
                </h3>
              </div>
              <div className="flex items-center gap-3">
                <span className={`inline-block border px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider ${(STATUS_META[detailTarget.status] || {}).className}`}>
                  {(STATUS_META[detailTarget.status] || {}).label || detailTarget.status}
                </span>
                <button
                  type="button"
                  onClick={() => setDetailTarget(null)}
                  className="rounded-lg p-1 text-neutral-400 hover:text-white hover:bg-white/[0.06] transition"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>

            {/* Quick Overview Strip */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 border border-white/[0.06] bg-black/60 p-3.5">
              <div className="flex items-center gap-2.5">
                <Film className="h-4 w-4 text-amber-400 shrink-0" />
                <div className="min-w-0">
                  <p className="text-[9px] uppercase tracking-wider text-neutral-400">Phim</p>
                  <p className="text-xs font-bold text-white truncate">{detailTarget.movieTitle || 'Vé xem phim'}</p>
                </div>
              </div>
              <div className="flex items-center gap-2.5 border-t sm:border-t-0 sm:border-l border-white/[0.06] pt-2 sm:pt-0 sm:pl-3">
                <Building2 className="h-4 w-4 text-sky-400 shrink-0" />
                <div className="min-w-0">
                  <p className="text-[9px] uppercase tracking-wider text-neutral-400">Cụm rạp &amp; Phòng</p>
                  <p className="text-xs font-bold text-sky-300 truncate">
                    {detailTarget.cinemaName || cinemaMap[detailTarget.cinemaId] || `Rạp #${detailTarget.cinemaId || '—'}`} • {detailTarget.roomName || 'Phòng chiếu'}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2.5 border-t sm:border-t-0 sm:border-l border-white/[0.06] pt-2 sm:pt-0 sm:pl-3">
                <Clock className="h-4 w-4 text-emerald-400 shrink-0" />
                <div className="min-w-0">
                  <p className="text-[9px] uppercase tracking-wider text-neutral-400">Suất chiếu</p>
                  <p className="text-xs font-bold text-emerald-300 truncate">
                    {formatDateTime(detailTarget.showtimeStart)}
                  </p>
                </div>
              </div>
            </div>

            {/* Main Content 2-Column Grid */}
            <div className="grid grid-cols-1 md:grid-cols-12 gap-5">
              {/* Left Column (7 cols): Seats & F&B */}
              <div className="md:col-span-7 space-y-4">
                {/* Danh sách ghế */}
                <div className="border border-white/[0.08] bg-black/40 p-4">
                  <div className="flex items-center justify-between border-b border-white/[0.06] pb-2">
                    <span className="text-[9px] font-black uppercase tracking-widest text-amber-400 flex items-center gap-1.5">
                      <Ticket className="h-3.5 w-3.5" /> Ghế đã đặt ({(detailTarget.seats || []).length})
                    </span>
                    <span className="font-mono text-[10px] text-amber-300 font-bold">
                      {getBookingSeatLabels(detailTarget).join(', ') || 'Chưa gán ghế'}
                    </span>
                  </div>

                  <div className="mt-3 space-y-2 max-h-48 overflow-y-auto pr-1">
                    {(detailTarget.seats || []).length > 0 ? (
                      detailTarget.seats.map((s, idx) => {
                        const sLabel = s.seatLabel || (s.rowLabel && s.seatNumber ? `${s.rowLabel}${s.seatNumber}` : '') || `Ghế #${idx + 1}`;
                        const typeName = SEAT_TYPE_LABELS[String(s.seatType).toUpperCase()] || s.seatType || 'Thường';
                        return (
                          <div
                            key={s.id || idx}
                            className="flex items-center justify-between border border-white/[0.05] bg-white/[0.02] px-3 py-2 text-xs"
                          >
                            <div className="flex items-center gap-2">
                              <span className="font-mono font-black text-amber-300 text-sm">{sLabel}</span>
                              <span className="border border-white/10 bg-black px-1.5 py-0.5 text-[8px] font-mono uppercase text-neutral-300">
                                {typeName}
                              </span>
                            </div>
                            <div className="text-right">
                              <span className="font-mono font-bold text-white text-xs">{formatVnd(s.unitPrice)}</span>
                              {s.ticketCode && (
                                <p className="font-mono text-[9px] text-neutral-400">Mã vé: {s.ticketCode}</p>
                              )}
                            </div>
                          </div>
                        );
                      })
                    ) : (
                      <p className="text-xs text-neutral-500 italic py-2 text-center">Chưa có thông tin chi tiết từng ghế</p>
                    )}
                  </div>
                </div>

                {/* Bắp nước F&B */}
                <div className="border border-white/[0.08] bg-black/40 p-4">
                  <div className="flex items-center justify-between border-b border-white/[0.06] pb-2">
                    <span className="text-[9px] font-black uppercase tracking-widest text-neutral-300 flex items-center gap-1.5">
                      <UtensilsCrossed className="h-3.5 w-3.5 text-amber-400" /> Bắp nước &amp; Combo ({(detailTarget.foods || []).length})
                    </span>
                  </div>

                  <div className="mt-3 space-y-1.5 max-h-36 overflow-y-auto pr-1">
                    {(detailTarget.foods || []).length > 0 ? (
                      detailTarget.foods.map((f, idx) => (
                        <div
                          key={f.id || idx}
                          className="flex items-center justify-between border border-white/[0.04] bg-white/[0.01] px-3 py-1.5 text-xs"
                        >
                          <span className="text-neutral-200">
                            {f.foodName || f.name} <span className="font-mono text-amber-400 font-bold">x{f.quantity}</span>
                          </span>
                          <span className="font-mono font-bold text-neutral-300">
                            {formatVnd(f.lineTotal || (f.price * f.quantity) || f.unitPrice)}
                          </span>
                        </div>
                      ))
                    ) : (
                      <p className="text-xs text-neutral-500 italic py-1 text-center">Không kèm bắp nước</p>
                    )}
                  </div>
                </div>
              </div>

              {/* Right Column (5 cols): Customer Info, Payment & QR */}
              <div className="md:col-span-5 space-y-4">
                {/* Thông tin khách hàng */}
                {(() => {
                  const cInfo = getCustomerInfo(detailTarget);
                  return (
                    <div className="border border-white/[0.08] bg-black/40 p-4 space-y-2.5">
                      <span className="text-[9px] font-black uppercase tracking-widest text-neutral-300 flex items-center gap-1.5">
                        <User className="h-3.5 w-3.5 text-sky-400" /> Khách hàng mua vé
                      </span>
                      <div className="space-y-1 text-xs">
                        <p className="font-bold text-white text-sm">{cInfo.fullName}</p>
                        <p className="text-neutral-400 font-mono text-[11px]">{cInfo.email}</p>
                        <p className="text-neutral-400 font-mono text-[11px]">SĐT: {cInfo.phone}</p>
                        {detailTarget.userId && (
                          <p className="text-[9px] font-mono text-neutral-400">
                            User ID: <span className="text-sky-300 font-bold">#{detailTarget.userId}</span>
                          </p>
                        )}
                      </div>
                    </div>
                  );
                })()}

                {/* Chi tiết thanh toán */}
                <div className="border border-white/[0.08] bg-black/40 p-4 space-y-2">
                  <span className="text-[9px] font-black uppercase tracking-widest text-neutral-300 flex items-center gap-1.5">
                    <CreditCard className="h-3.5 w-3.5 text-emerald-400" /> Thanh toán
                  </span>

                  <div className="space-y-1.5 text-xs border-b border-white/[0.06] pb-2 pt-1 font-mono">
                    <div className="flex justify-between text-neutral-400">
                      <span>Tạm tính</span>
                      <span>{formatVnd(detailTarget.subtotal || detailTarget.totalAmount)}</span>
                    </div>
                    {Number(detailTarget.discountAmount || 0) > 0 && (
                      <div className="flex justify-between text-amber-300">
                        <span>Giảm giá</span>
                        <span>-{formatVnd(detailTarget.discountAmount)}</span>
                      </div>
                    )}
                    {Number(detailTarget.loyaltyPointsRedeemed || 0) > 0 && (
                      <div className="flex justify-between text-amber-300">
                        <span>Điểm đã dùng</span>
                        <span>{detailTarget.loyaltyPointsRedeemed} pts</span>
                      </div>
                    )}
                    <div className="flex justify-between text-neutral-400 text-[10px]">
                      <span>Phương thức</span>
                      <span className="font-sans text-neutral-300">{detailTarget.paymentMethod || 'CineWallet / Trực tuyến'}</span>
                    </div>
                    <div className="flex justify-between text-neutral-400 text-[10px]">
                      <span>Ngày tạo đơn</span>
                      <span>{formatDateTime(detailTarget.createdAt)}</span>
                    </div>
                    {detailTarget.checkedInAt && (
                      <div className="flex justify-between text-sky-400 text-[10px]">
                        <span>Đã check-in lúc</span>
                        <span>{formatDateTime(detailTarget.checkedInAt)}</span>
                      </div>
                    )}
                  </div>

                  <div className="flex justify-between items-center pt-1 font-mono">
                    <span className="text-[10px] font-black uppercase tracking-wider text-neutral-300">Tổng thanh toán:</span>
                    <span className="text-base font-black text-emerald-400">{formatVnd(detailTarget.totalAmount)}</span>
                  </div>
                </div>

                {/* QR Code */}
                <div className="border border-white/[0.08] bg-black/40 p-3.5 flex flex-col items-center justify-center text-center">
                  <div className="bg-white p-2 rounded">
                    <QRCodeSVG
                      value={detailTarget.qrCode || detailTarget.bookingCode || 'CINEPREMIER'}
                      size={100}
                      bgColor="#ffffff"
                      fgColor="#000000"
                      level="H"
                    />
                  </div>
                  <p className="mt-2 font-mono text-[10px] text-neutral-400 uppercase tracking-widest">
                    Mã đơn: <span className="text-white font-bold">{detailTarget.bookingCode}</span>
                  </p>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="flex items-center justify-end border-t border-white/[0.08] pt-4">
              <button
                type="button"
                onClick={() => setDetailTarget(null)}
                className="border border-white/10 bg-black px-5 py-2 text-xs font-black uppercase tracking-wider text-white hover:bg-white/10 transition"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Chi tiết từng lần hủy / hoàn tiền */}
      {auditDetailTarget && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-sm p-4 overflow-y-auto"
          onClick={() => setAuditDetailTarget(null)}
        >
          <div
            className="w-full max-w-2xl border border-white/[0.15] bg-[#0c0c0c] shadow-2xl shadow-black p-6 space-y-5 my-8 text-neutral-200"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-start justify-between border-b border-white/[0.08] pb-4">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-[9px] font-mono font-black uppercase tracking-[0.25em] text-amber-400">
                    CINEPREMIER AUDIT LOG DETAIL
                  </span>
                  {isAuditDetailLoading && (
                    <RefreshCw className="h-3 w-3 animate-spin text-neutral-500" />
                  )}
                </div>
                <h3 className="mt-1 flex items-center gap-2 text-lg font-black uppercase tracking-wide text-white">
                  <History className="h-5 w-5 text-amber-400" />
                  Chi tiết lần hủy / hoàn vé #{auditDetailTarget.log.id}
                </h3>
                <p className="mt-1 text-xs text-neutral-400 font-mono">
                  Đơn đặt vé liên quan: <span className="text-white font-bold">#{auditDetailTarget.log.bookingId}</span>
                  {auditDetailTarget.log.ticketCode ? ` • Mã vé/đơn: ${auditDetailTarget.log.ticketCode}` : ''}
                  {auditDetailTarget.booking?.bookingCode && auditDetailTarget.booking.bookingCode !== auditDetailTarget.log.ticketCode ? ` • Mã đơn: ${auditDetailTarget.booking.bookingCode}` : ''}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span className={`inline-block border px-2.5 py-1 text-[10px] font-black uppercase tracking-wider ${(ACTION_META[auditDetailTarget.log.action] || {}).color || 'border-white/20 text-white'}`}>
                  {(ACTION_META[auditDetailTarget.log.action] || {}).label || auditDetailTarget.log.action}
                </span>
                <button
                  type="button"
                  onClick={() => setAuditDetailTarget(null)}
                  className="rounded-lg p-1 text-neutral-400 hover:text-white hover:bg-white/[0.06] transition"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>

            {/* Thông tin sự kiện hủy/hoàn (Audit Info Card) */}
            <div className="border border-rose-500/20 bg-rose-950/15 p-4 space-y-3">
              <div className="flex items-start justify-between gap-4">
                <div className="space-y-1">
                  <p className="text-[9px] font-black uppercase tracking-widest text-rose-400 flex items-center gap-1.5">
                    <AlertCircle className="h-3.5 w-3.5 text-rose-400" /> Lý do hủy / hoàn tiền
                  </p>
                  <p className="text-sm font-semibold text-rose-200">
                    {auditDetailTarget.log.reason || 'Hủy vé theo yêu cầu hoặc xử lý sự cố rạp'}
                  </p>
                </div>
                {auditDetailTarget.log.amount !== undefined && auditDetailTarget.log.amount !== null && (
                  <div className="text-right shrink-0">
                    <p className="text-[9px] font-black uppercase tracking-widest text-neutral-400">Số tiền hoàn trả</p>
                    <p className="text-base font-mono font-black text-emerald-400">
                      {formatVnd(auditDetailTarget.log.amount)}
                    </p>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 border-t border-rose-500/20 pt-2 text-[11px] font-mono">
                <div>
                  <span className="text-neutral-400 block text-[9px] uppercase">Thời gian thực hiện</span>
                  <span className="text-white">{formatDateTime(auditDetailTarget.log.createdAt)}</span>
                </div>
                <div>
                  <span className="text-neutral-400 block text-[9px] uppercase">Người thực hiện</span>
                  <span className="text-sky-300 font-bold truncate block">{auditDetailTarget.log.actorEmail || 'Hệ thống'}</span>
                  {auditDetailTarget.log.actorRole && (
                    <span className="text-[9px] text-neutral-400">({auditDetailTarget.log.actorRole})</span>
                  )}
                </div>
                <div>
                  <span className="text-neutral-400 block text-[9px] uppercase">Trạng thái đổi</span>
                  <span className="text-neutral-300">{auditDetailTarget.log.oldStatus || '—'}</span>
                  <span className="mx-1 text-amber-400">➔</span>
                  <span className="text-white font-bold">{auditDetailTarget.log.newStatus || auditDetailTarget.log.status || '—'}</span>
                </div>
                <div>
                  <span className="text-neutral-400 block text-[9px] uppercase">Cụm rạp</span>
                  <span className="text-amber-300 truncate block">
                    {cinemaMap[auditDetailTarget.log.cinemaId] || `Rạp #${auditDetailTarget.log.cinemaId || '—'}`}
                  </span>
                </div>
              </div>
            </div>

            {/* Thông tin đơn vé gốc liên kết */}
            {auditDetailTarget.booking ? (
              <div className="space-y-4">
                {/* Movie & Showtime bar */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 border border-white/[0.06] bg-black/60 p-3.5">
                  <div className="flex items-center gap-2.5">
                    <Film className="h-4 w-4 text-amber-400 shrink-0" />
                    <div className="min-w-0">
                      <p className="text-[9px] uppercase tracking-wider text-neutral-400">Phim</p>
                      <p className="text-xs font-bold text-white truncate">{auditDetailTarget.booking.movieTitle || 'Vé xem phim'}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2.5 border-t sm:border-t-0 sm:border-l border-white/[0.06] pt-2 sm:pt-0 sm:pl-3">
                    <Building2 className="h-4 w-4 text-sky-400 shrink-0" />
                    <div className="min-w-0">
                      <p className="text-[9px] uppercase tracking-wider text-neutral-400">Cụm rạp &amp; Phòng</p>
                      <p className="text-xs font-bold text-sky-300 truncate">
                        {auditDetailTarget.booking.cinemaName || cinemaMap[auditDetailTarget.booking.cinemaId] || `Rạp #${auditDetailTarget.booking.cinemaId || '—'}`} • {auditDetailTarget.booking.roomName || 'Phòng chiếu'}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2.5 border-t sm:border-t-0 sm:border-l border-white/[0.06] pt-2 sm:pt-0 sm:pl-3">
                    <Clock className="h-4 w-4 text-emerald-400 shrink-0" />
                    <div className="min-w-0">
                      <p className="text-[9px] uppercase tracking-wider text-neutral-400">Suất chiếu</p>
                      <p className="text-xs font-bold text-emerald-300 truncate">
                        {formatDateTime(auditDetailTarget.booking.showtimeStart)}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
                  {/* Ghế & Khách hàng */}
                  <div className="md:col-span-7 space-y-3">
                    {/* Ghế đã đặt / đã hủy */}
                    <div className="border border-white/[0.08] bg-black/40 p-3.5">
                      <div className="flex items-center justify-between border-b border-white/[0.06] pb-2">
                        <span className="text-[9px] font-black uppercase tracking-widest text-amber-400 flex items-center gap-1.5">
                          <Ticket className="h-3.5 w-3.5" /> Ghế liên quan ({(auditDetailTarget.booking.seats || []).length})
                        </span>
                        <span className="font-mono text-[10px] text-amber-300 font-bold">
                          {getBookingSeatLabels(auditDetailTarget.booking).join(', ') || 'Chưa gán ghế'}
                        </span>
                      </div>

                      <div className="mt-2.5 space-y-1.5 max-h-36 overflow-y-auto pr-1">
                        {(auditDetailTarget.booking.seats || []).length > 0 ? (
                          auditDetailTarget.booking.seats.map((s, idx) => {
                            const sLabel = s.seatLabel || (s.rowLabel && s.seatNumber ? `${s.rowLabel}${s.seatNumber}` : '') || `Ghế #${idx + 1}`;
                            const typeName = SEAT_TYPE_LABELS[String(s.seatType).toUpperCase()] || s.seatType || 'Thường';
                            return (
                              <div
                                key={s.id || idx}
                                className="flex items-center justify-between border border-white/[0.05] bg-white/[0.02] px-2.5 py-1.5 text-xs"
                              >
                                <div className="flex items-center gap-2">
                                  <span className="font-mono font-black text-amber-300">{sLabel}</span>
                                  <span className="border border-white/10 bg-black px-1.5 py-0.5 text-[8px] font-mono uppercase text-neutral-300">
                                    {typeName}
                                  </span>
                                </div>
                                <span className="font-mono font-bold text-white text-xs">{formatVnd(s.unitPrice)}</span>
                              </div>
                            );
                          })
                        ) : (
                          <p className="text-xs text-neutral-500 italic py-1 text-center">Không có danh sách ghế</p>
                        )}
                      </div>
                    </div>

                    {/* Bắp nước (nếu có) */}
                    {(auditDetailTarget.booking.foods || []).length > 0 && (
                      <div className="border border-white/[0.08] bg-black/40 p-3.5">
                        <div className="flex items-center justify-between border-b border-white/[0.06] pb-2">
                          <span className="text-[9px] font-black uppercase tracking-widest text-neutral-300 flex items-center gap-1.5">
                            <UtensilsCrossed className="h-3.5 w-3.5 text-amber-400" /> Bắp nước &amp; Combo
                          </span>
                        </div>
                        <div className="mt-2 space-y-1 max-h-24 overflow-y-auto pr-1">
                          {auditDetailTarget.booking.foods.map((f, idx) => (
                            <div key={idx} className="flex justify-between text-xs text-neutral-300">
                              <span>{f.foodName || f.name} x {f.quantity}</span>
                              <span className="font-mono">{formatVnd(f.lineTotal || (f.price * f.quantity) || f.unitPrice)}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Khách hàng & Thanh toán gốc */}
                  <div className="md:col-span-5 space-y-3">
                    {/* Khách hàng */}
                    {(() => {
                      const cInfo = getCustomerInfo(auditDetailTarget.booking);
                      return (
                        <div className="border border-white/[0.08] bg-black/40 p-3.5 space-y-2">
                          <span className="text-[9px] font-black uppercase tracking-widest text-neutral-300 flex items-center gap-1.5">
                            <User className="h-3.5 w-3.5 text-sky-400" /> Khách hàng
                          </span>
                          <div className="space-y-1 text-xs">
                            <p className="font-bold text-white text-sm">{cInfo.fullName}</p>
                            <p className="text-neutral-400 font-mono text-[11px]">{cInfo.email}</p>
                            <p className="text-neutral-400 font-mono text-[11px]">SĐT: {cInfo.phone}</p>
                          </div>
                        </div>
                      );
                    })()}

                    {/* Thanh toán đơn gốc */}
                    <div className="border border-white/[0.08] bg-black/40 p-3.5 space-y-2">
                      <span className="text-[9px] font-black uppercase tracking-widest text-neutral-300 flex items-center gap-1.5">
                        <CreditCard className="h-3.5 w-3.5 text-emerald-400" /> Đơn thanh toán gốc
                      </span>
                      <div className="space-y-1 text-xs font-mono">
                        <div className="flex justify-between text-neutral-400">
                          <span>Phương thức</span>
                          <span className="text-neutral-200">{auditDetailTarget.booking.paymentMethod || 'CineWallet / Trực tuyến'}</span>
                        </div>
                        <div className="flex justify-between text-neutral-400">
                          <span>Tổng giá trị đơn</span>
                          <span className="text-emerald-400 font-bold">{formatVnd(auditDetailTarget.booking.totalAmount)}</span>
                        </div>
                        <div className="flex justify-between text-neutral-400">
                          <span>Trạng thái đơn</span>
                          <span className="text-amber-300 font-bold">{auditDetailTarget.booking.status}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="border border-white/[0.06] bg-black/30 p-4 text-center">
                {isAuditDetailLoading ? (
                  <p className="text-xs text-neutral-400 font-mono">Đang tải thông tin chi tiết đơn vé #{auditDetailTarget.log.bookingId}…</p>
                ) : (
                  <p className="text-xs text-neutral-500 italic">Không có dữ liệu mở rộng cho đơn đặt vé #{auditDetailTarget.log.bookingId}. Toàn bộ thông tin nhật ký hủy/hoàn đã hiển thị ở trên.</p>
                )}
              </div>
            )}

            {/* Modal Footer */}
            <div className="flex items-center justify-between border-t border-white/[0.08] pt-4">
              {auditDetailTarget.booking && (
                <button
                  type="button"
                  onClick={() => {
                    const b = auditDetailTarget.booking;
                    setAuditDetailTarget(null);
                    handleOpenDetail(b);
                  }}
                  className="inline-flex items-center gap-1.5 border border-amber-500/30 bg-amber-500/10 px-3 py-1.5 text-xs font-bold text-amber-300 hover:bg-amber-500/20 transition"
                >
                  <Eye className="h-3.5 w-3.5" />
                  <span>Mở đơn vé đầy đủ</span>
                </button>
              )}
              <div className="ml-auto">
                <button
                  type="button"
                  onClick={() => setAuditDetailTarget(null)}
                  className="border border-white/10 bg-black px-5 py-2 text-xs font-black uppercase tracking-wider text-white hover:bg-white/10 transition"
                >
                  Đóng
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      

    </div>
  );
}
