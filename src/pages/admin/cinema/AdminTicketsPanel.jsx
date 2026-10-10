import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  Building2,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Clock,
  Filter,
  History,
  Info,
  RefreshCw,
  Search,
  Ticket,
  User,
  Wallet,
  X
} from 'lucide-react';
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

const formatVnd = (value) => `${Number(value || 0).toLocaleString('vi-VN')}đ`;

const formatDateTime = (value) => {
  if (!value) return 'Chưa có dữ liệu';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleString('vi-VN');
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

  // Action Modals: Cancel & Refund separated
  const [cancelTarget, setCancelTarget] = useState(null);
  const [cancelReason, setCancelReason] = useState('');
  const [isCancelling, setIsCancelling] = useState(false);


  // Audit Logs state
  const [auditLogs, setAuditLogs] = useState([]);
  const [isAuditLoading, setIsAuditLoading] = useState(false);
  const [auditActionFilter, setAuditActionFilter] = useState('ALL');

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
  }, [getAdminToken]);

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
      const params = { page: nextPage, size: 15 };
      if (status !== 'ALL') params.status = status;
      if (isEffectiveManager && currentUser?.cinemaId) {
        params.cinemaId = currentUser.cinemaId;
      } else if (cinema !== 'ALL') {
        params.cinemaId = Number(cinema);
      }
      if (ticketSearch.trim()) {
        params.bookingCode = ticketSearch.trim();
      }

      const data = await adminService.getAdminBookings(token, params);
      setBookings(data.items || []);
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
      const params = {};
      if (isEffectiveManager && currentUser?.cinemaId) {
        params.cinemaId = currentUser.cinemaId;
      } else if (cinema !== 'ALL') {
        params.cinemaId = Number(cinema);
      }
      const data = await adminService.getTicketAuditLogs(token, params);
      setAuditLogs(Array.isArray(data) ? data : (data?.items || []));
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

  const filteredAuditLogs = useMemo(() => {
    if (auditActionFilter === 'ALL') return auditLogs;
    return auditLogs.filter((log) => String(log.action).toUpperCase() === auditActionFilter);
  }, [auditLogs, auditActionFilter]);

  return (
    <div className="space-y-5">
      {/* Top Header & Sub-Tabs */}
      <div className="flex flex-col gap-4 border border-white/[0.05] bg-[#070707] p-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-[8px] font-mono font-black uppercase tracking-[0.25em] text-neutral-400">
            {isEffectiveAdmin ? 'SYSTEM TICKETING CONTROL' : 'CINEMA TICKETING CONTROL'}
          </p>
          <h2 className="mt-1 flex items-center gap-2 text-sm font-sans font-black uppercase tracking-wide text-neutral-100">
            <Ticket className="h-5 w-5 text-amber-500" /> Quản Lý Đặt Vé &amp; Hoàn Hủy
          </h2>
          <p className="mt-1 text-xs text-neutral-400">
            {isEffectiveManager
              ? `Phạm vi quản lý: ${cinemaMap[currentUser?.cinemaId] || ('Rạp #' + currentUser?.cinemaId)}`
              : 'Quản lý toàn bộ vé bán ra, thực hiện hủy vé, hoàn tiền độc lập và kiểm tra audit log.'}
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
                  <th className="px-4 py-3.5">Mã đơn</th>
                  <th className="px-4 py-3.5">Phim &amp; Rạp</th>
                  <th className="px-4 py-3.5">Ghế ngồi</th>
                  <th className="px-4 py-3.5">Người mua</th>
                  <th className="px-4 py-3.5">Tổng tiền</th>
                  <th className="px-4 py-3.5">Trạng thái</th>
                  <th className="px-4 py-3.5 text-right">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5 text-neutral-300">
                {isLoading ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-12 text-center text-neutral-400 font-mono text-xs">
                      Đang tải danh sách vé…
                    </td>
                  </tr>
                ) : bookings.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-12 text-center text-neutral-400 font-mono text-xs">
                      Không có đơn đặt vé nào khớp với bộ lọc hiện tại.
                    </td>
                  </tr>
                ) : (
                  bookings.map((b) => {
                    const statusMeta = STATUS_META[b.status] || {
                      label: b.status,
                      className: 'border-white/10 bg-neutral-900 text-neutral-300'
                    };
                    const isExpanded = expandedId === b.id;
                    const cinemaName = b.cinemaName || cinemaMap[b.cinemaId] || `Rạp #${b.cinemaId || '—'}`;

                    // Can cancel: HOLDING, PENDING_PAYMENT, PAID
                    const canCancel = ['HOLDING', 'PENDING_PAYMENT', 'PAID'].includes(b.status);
                    // Can refund: PAID or CANCELLED (if paid and not already refunded)
                    const canRefund = (b.status === 'PAID' || (b.status === 'CANCELLED' && Number(b.totalAmount || 0) > 0));

                    return (
                      <React.Fragment key={b.id}>
                        <tr
                          className="cursor-pointer transition hover:bg-white/[0.02]"
                          onClick={() => setExpandedId(isExpanded ? null : b.id)}
                        >
                          <td className="whitespace-nowrap px-4 py-3.5 font-mono text-[11px] font-bold text-white">
                            {b.bookingCode}
                          </td>
                          <td className="px-4 py-3.5">
                            <p className="max-w-[200px] truncate font-bold text-white">{b.movieTitle || 'Vé xem phim'}</p>
                            <p className="text-[10px] text-sky-400 font-mono">{cinemaName}</p>
                          </td>
                          <td className="px-4 py-3.5">
                            <span className="font-mono text-amber-300 font-bold">
                              {(b.seats || []).map((s) => s.seatCode || s.code).join(', ') || 'Chưa gán ghế'}
                            </span>
                          </td>
                          <td className="px-4 py-3.5">
                            <p className="truncate text-xs font-bold text-white">{b.customerName || 'Khách vãng lai'}</p>
                            <p className="text-[10px] text-neutral-400">{b.customerPhone || b.customerEmail || '—'}</p>
                          </td>
                          <td className="whitespace-nowrap px-4 py-3.5 font-mono font-bold text-emerald-400">
                            {formatVnd(b.totalAmount)}
                          </td>
                          <td className="px-4 py-3.5">
                            <span className={`inline-block border px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider ${statusMeta.className}`}>
                              {statusMeta.label}
                            </span>
                          </td>
                          <td className="px-4 py-3.5 text-right">
                            <div className="flex items-center justify-end gap-1.5" onClick={(e) => e.stopPropagation()}>
                              {/* Hủy vé */}
                              {canCancel && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setCancelTarget(b);
                                    setCancelReason('');
                                  }}
                                  className="border border-rose-500/40 bg-rose-950/20 px-2 py-1 text-[9px] font-bold text-rose-300 transition hover:bg-rose-500 hover:text-black"
                                >
                                  Hủy vé
                                </button>
                              )}

                              {b.status === 'REFUNDED' && (
                                <span className="text-[9px] font-mono text-purple-400">Đã hoàn tất</span>
                              )}
                            </div>
                          </td>
                        </tr>

                        {/* Expanded Detail Row */}
                        {isExpanded && (
                          <tr className="bg-[#080808]">
                            <td colSpan={7} className="px-6 py-4 border-t border-white/[0.04]">
                              <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                                <div>
                                  <p className="text-[9px] font-black uppercase tracking-widest text-neutral-400">Chi tiết thanh toán</p>
                                  <p className="mt-1 text-xs text-neutral-300">
                                    Phương thức: <span className="font-bold text-white">{b.paymentMethod || 'CineWallet'}</span>
                                  </p>
                                  <p className="text-xs text-neutral-300">
                                    Thời gian: <span className="font-mono text-neutral-400">{formatDateTime(b.createdAt)}</span>
                                  </p>
                                  {b.checkedInAt && (
                                    <p className="text-xs text-sky-400">
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
                                          {f.foodName || f.name} x {f.quantity} ({formatVnd(f.price)})
                                        </div>
                                      ))}
                                    </div>
                                  ) : (
                                    <p className="mt-1 text-xs text-neutral-500 italic">Không có bắp nước</p>
                                  )}
                                </div>

                                <div>
                                  <p className="text-[9px] font-black uppercase tracking-widest text-neutral-400">Chính sách bảo vệ</p>
                                  <p className="mt-1 text-[11px] text-neutral-400 leading-relaxed">
                                    • Vé đã hủy sẽ giải phóng ghế ngay lập tức.<br />
                                    • Hoàn tiền chỉ áp dụng 1 lần duy nhất, ngăn chặn hoàn tiền kép.
                                  </p>
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
                  <th className="px-4 py-3.5">Lý do ghi nhận</th>
                  <th className="px-4 py-3.5">Người thực hiện</th>
                  <th className="px-4 py-3.5">Cụm rạp</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5 text-neutral-300">
                {isAuditLoading ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-12 text-center text-neutral-400 font-mono text-xs">
                      Đang tải lịch sử kiểm toán vé…
                    </td>
                  </tr>
                ) : filteredAuditLogs.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-12 text-center text-neutral-400 font-mono text-xs">
                      Chưa có sự kiện hủy hoặc hoàn tiền nào được ghi lại.
                    </td>
                  </tr>
                ) : (
                  filteredAuditLogs.map((log) => {
                    const actionMeta = ACTION_META[log.action] || {
                      label: log.action,
                      color: 'border-white/10 bg-white/5 text-white'
                    };
                    return (
                      <tr key={log.id} className="transition hover:bg-white/[0.02]">
                        <td className="whitespace-nowrap px-4 py-3 font-mono text-[10px] text-neutral-400">
                          {formatDateTime(log.createdAt)}
                        </td>
                        <td className="px-4 py-3 font-mono font-bold text-white">
                          #{log.bookingId} {log.bookingCode ? `(${log.bookingCode})` : ''}
                        </td>
                        <td className="px-4 py-3">
                          <span className={`inline-block border px-2 py-0.5 text-[8px] font-black uppercase tracking-wider ${actionMeta.color}`}>
                            {actionMeta.label}
                          </span>
                        </td>
                        <td className="px-4 py-3 font-mono text-[10px]">
                          <span className="text-neutral-400">{log.oldStatus || '—'}</span>
                          <span className="mx-1 text-amber-400">→</span>
                          <span className="font-bold text-white">{log.newStatus || '—'}</span>
                        </td>
                        <td className="px-4 py-3 max-w-[200px] truncate text-neutral-300">
                          {log.reason || 'Không ghi chú'}
                        </td>
                        <td className="px-4 py-3 text-[10px] text-neutral-400 font-mono">
                          {log.actorEmail || 'Hệ thống'}
                        </td>
                        <td className="px-4 py-3 text-[10px] text-sky-400 font-mono">
                          {cinemaMap[log.cinemaId] || `Rạp #${log.cinemaId || '—'}`}
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

      {/* Modal Hủy vé */}
      {cancelTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4" onClick={() => setCancelTarget(null)}>
          <div className="w-full max-w-md border border-white/[0.12] bg-[#0d0d0d] p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between">
              <div>
                <p className="text-[9px] font-black uppercase tracking-[0.25em] text-rose-400">Nghiệp vụ rạp</p>
                <h3 className="mt-1 text-base font-black uppercase tracking-wide text-white">
                  Xác nhận Hủy Vé {cancelTarget.bookingCode}
                </h3>
              </div>
              <button onClick={() => setCancelTarget(null)} disabled={isCancelling} className="text-neutral-400 hover:text-white">
                <X className="h-5 w-5" />
              </button>
            </div>

            <p className="mt-3 text-xs text-neutral-300">
              Đơn hàng: <span className="font-bold text-white">{cancelTarget.movieTitle}</span> ({formatVnd(cancelTarget.totalAmount)})
            </p>
            <div className="mt-2 border border-rose-500/20 bg-rose-950/20 p-3 text-[11px] text-rose-200">
              Ghế sẽ được giải phóng lập tức và trạng thái vé chuyển sang <strong>CANCELLED</strong>. (Lưu ý: Nếu muốn hoàn lại tiền vé, hãy thực hiện Hoàn tiền).
            </div>

            <label className="mt-4 block text-[9px] font-black uppercase tracking-widest text-neutral-300">
              Lý do hủy vé *
            </label>
            <textarea
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
              rows={3}
              placeholder="Nhập lý do hủy vé..."
              className="mt-1.5 w-full resize-none border border-white/10 bg-black px-3 py-2 text-xs text-white outline-none focus:border-rose-400"
            />

            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setCancelTarget(null)}
                disabled={isCancelling}
                className="border border-white/10 bg-black px-4 py-2 text-[10px] font-black uppercase tracking-widest text-neutral-300 hover:text-white"
              >
                Đóng
              </button>
              <button
                type="button"
                onClick={handleConfirmCancel}
                disabled={isCancelling || !cancelReason.trim()}
                className="flex items-center gap-2 border border-rose-500 bg-rose-500/20 px-4 py-2 text-[10px] font-black uppercase tracking-widest text-rose-200 transition hover:bg-rose-500 hover:text-black disabled:opacity-40"
              >
                {isCancelling ? 'Đang xử lý...' : 'Xác nhận hủy vé'}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
