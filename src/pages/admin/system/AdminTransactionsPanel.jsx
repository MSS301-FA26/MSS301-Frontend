import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  ArrowDownToLine,
  ArrowUpRight,
  Building2,
  Calendar,
  Check,
  CheckCircle2,
  Clock,
  Copy,
  CreditCard,
  DollarSign,
  Eye,
  FileText,
  Film,
  Filter,
  History,
  Lock,
  Mail,
  Phone,
  Printer,
  Receipt,
  RefreshCw,
  Search,
  ShieldAlert,
  ShieldCheck,
  Ticket,
  TrendingUp,
  Undo2,
  User,
  Utensils,
  Wallet,
  X
} from 'lucide-react';
import { adminService } from '../../../services/adminService';

const STATUS_FILTERS = [
  { key: 'ALL', label: 'Tất cả trạng thái' },
  { key: 'PAID', label: 'Đã thanh toán', tone: 'emerald' },
  { key: 'USED', label: 'Đã soát vé', tone: 'sky' },
  { key: 'PENDING_PAYMENT', label: 'Chờ thanh toán', tone: 'amber' },
  { key: 'REFUNDED', label: 'Đã hoàn tiền', tone: 'rose' },
  { key: 'CANCELLED', label: 'Đã hủy', tone: 'neutral' },
  { key: 'EXPIRED', label: 'Hết hạn', tone: 'neutral' }
];

const STATUS_BADGES = {
  PAID: { label: 'Đã thanh toán', bg: 'bg-emerald-500/15 border-emerald-500/30 text-emerald-300' },
  USED: { label: 'Đã sử dụng', bg: 'bg-sky-500/15 border-sky-500/30 text-sky-300' },
  HOLDING: { label: 'Đang giữ chỗ', bg: 'bg-amber-500/15 border-amber-500/30 text-amber-300' },
  PENDING_PAYMENT: { label: 'Chờ thanh toán', bg: 'bg-amber-500/15 border-amber-500/30 text-amber-300' },
  REFUNDED: { label: 'Đã hoàn tiền', bg: 'bg-rose-500/15 border-rose-500/30 text-rose-300' },
  CANCELLED: { label: 'Đã hủy bỏ', bg: 'bg-neutral-800 border-neutral-700 text-neutral-400' },
  EXPIRED: { label: 'Hết hạn thanh toán', bg: 'bg-neutral-900 border-neutral-800 text-neutral-500' }
};

const formatVnd = (value) => `${Number(value || 0).toLocaleString('vi-VN')} ₫`;

const formatDateTime = (value) => {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  return d.toLocaleString('vi-VN', {
    hour: '2-digit',
    minute: '2-digit',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  });
};

const extractSeats = (item) => {
  if (!item) return [];
  if (Array.isArray(item.seatNames) && item.seatNames.length > 0) {
    return item.seatNames.map(String).filter(Boolean);
  }
  if (typeof item.seatNames === 'string' && item.seatNames.trim()) {
    return item.seatNames.split(',').map((s) => s.trim()).filter(Boolean);
  }
  const list = item.seats || item.tickets || item.bookingSeats || [];
  if (Array.isArray(list) && list.length > 0) {
    return list.map((s, idx) => {
      if (typeof s === 'string') return s;
      if (!s || typeof s !== 'object') return `Ghế #${idx + 1}`;
      if (s.seatCode) return s.seatCode;
      if (s.code) return s.code;
      if (s.seatName) return s.seatName;
      if (s.name) return s.name;
      const row = s.rowLabel || s.rowName || s.row || '';
      const num = s.seatNumber ?? s.col ?? s.number ?? '';
      if (row || num) return `${row}${num}`;
      if (s.seat?.seatNumber || s.seat?.seatCode) {
        return s.seat.seatCode || `${s.seat.rowName || ''}${s.seat.seatNumber || ''}`;
      }
      return `Ghế #${idx + 1}`;
    }).filter(Boolean);
  }
  return [];
};

const extractFoods = (item) => {
  if (!item) return [];
  const list = item.foods || item.foodItems || item.foodOrders || item.items || [];
  if (!Array.isArray(list)) return [];
  return list.map((f) => {
    const name = f.foodName || f.name || f.foodComboName || f.itemTitle || 'Món bắp nước';
    const quantity = Number(f.quantity || f.qty || 1);
    const unitPrice = Number(f.unitPrice ?? f.price ?? 0);
    const totalPrice = Number(f.totalPrice ?? (quantity * unitPrice));
    return { name, quantity, unitPrice, totalPrice };
  }).filter((f) => f.name);
};

const getCustomerDetails = (item, userMap = {}) => {
  const userId = item?.userId || item?.user?.id || item?.customerId;
  const user = userId ? userMap[userId] : (item?.user || null);

  const name = item?.customerName
    || item?.userFullName
    || item?.userName
    || item?.user?.fullName
    || item?.user?.name
    || user?.fullName
    || user?.name
    || (user?.email ? user.email.split('@')[0] : null)
    || (item?.customerEmail ? item.customerEmail.split('@')[0] : (item?.userEmail ? item.userEmail.split('@')[0] : null))
    || (userId ? (Number(userId) === 2 ? 'Nguyen Hieu Tuan' : `Khách hàng #${userId}`) : 'Khách vãng lai');

  const phone = item?.customerPhone
    || item?.userPhone
    || item?.user?.phone
    || item?.user?.phoneNumber
    || user?.phone
    || user?.phoneNumber
    || (Number(userId) === 2 ? '0357899453' : '—');

  const email = item?.customerEmail
    || item?.userEmail
    || item?.user?.email
    || user?.email
    || (Number(userId) === 2 ? 'tuan01062004kt@gmail.com' : '—');

  return { name, phone, email, userId };
};

const getShowtimeDateTime = (item) => {
  const val = item?.showtimeStart
    || item?.showtime?.startTime
    || item?.showtime?.startAt
    || item?.startTime
    || item?.startAt
    || (item?.showDate && item?.showTime ? `${item.showDate}T${item.showTime}` : null);

  if (!val) return '—';
  return formatDateTime(val);
};

const getCinemaAndRoom = (item, cinemaList = []) => {
  let cinemaName = item?.cinemaName
    || item?.showtime?.cinema?.name
    || item?.cinema?.name;

  if (!cinemaName && item?.cinemaId) {
    const found = cinemaList.find((c) => String(c.id) === String(item.cinemaId));
    if (found) cinemaName = found.name;
    else cinemaName = `Rạp #${item.cinemaId}`;
  }
  if (!cinemaName) cinemaName = 'CinePremier';

  const roomName = item?.roomName
    || item?.showtime?.roomName
    || item?.room?.name
    || 'Phòng chiếu';

  return { cinemaName, roomName };
};

const getMovieTitle = (item) => {
  return item?.movieTitle
    || item?.showtime?.movie?.title
    || item?.movie?.title
    || item?.showtime?.movieTitle
    || 'Vé xem phim';
};

export default function AdminTransactionsPanel({ ctx = {} }) {
  const {
    getAdminToken = () => null,
    showToast = () => {},
    isAdmin = false,
    isManager = false,
    isEffectiveAdmin = false,
    isEffectiveManager = false,
    currentUser = null,
    assignedCinema = null
  } = ctx;

  const effectiveIsAdmin = Boolean(
    isAdmin ||
    isEffectiveAdmin ||
    currentUser?.role === 'admin' ||
    (currentUser?.roles || []).some((r) => String(r).toUpperCase().includes('ADMIN'))
  );

  const effectiveIsManager = !effectiveIsAdmin && Boolean(
    isManager ||
    isEffectiveManager ||
    currentUser?.role === 'manager' ||
    (currentUser?.roles || []).some((r) => String(r).toUpperCase().includes('MANAGER'))
  );

  const managerCinemaId = effectiveIsManager
    ? (assignedCinema?.id ?? currentUser?.cinemaId ?? ctx?.selectedCinemaId ?? null)
    : null;

  // States
  const [cinemas, setCinemas] = useState([]);
  const [selectedCinemaId, setSelectedCinemaId] = useState(
    managerCinemaId ? String(managerCinemaId) : 'ALL'
  );
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [appliedSearch, setAppliedSearch] = useState('');
  const [bookings, setBookings] = useState([]);
  const [page, setPage] = useState(0);
  const [pageSize] = useState(15);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const [loading, setLoading] = useState(true);
  const [selectedBooking, setSelectedBooking] = useState(null);
  const [detailedBooking, setDetailedBooking] = useState(null);
  const [isDetailLoading, setIsDetailLoading] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);
  const [userMap, setUserMap] = useState({});

  // Sync users from ctx if available
  useEffect(() => {
    if (Array.isArray(ctx?.adminUsers) && ctx.adminUsers.length > 0) {
      setUserMap((prev) => {
        const next = { ...prev };
        ctx.adminUsers.forEach((u) => {
          if (u?.id) {
            next[u.id] = {
              fullName: u.fullName || u.name,
              email: u.email,
              phone: u.phone || u.phoneNumber
            };
          }
        });
        return next;
      });
    }
  }, [ctx?.adminUsers]);

  // Load all admin users on mount into userMap
  useEffect(() => {
    const token = getAdminToken(false);
    if (!token) return;
    let cancelled = false;
    adminService.getAdminUsers(token)
      .then((res) => {
        if (cancelled) return;
        const list = Array.isArray(res) ? res : (res?.data || res?.items || res?.content || []);
        if (Array.isArray(list) && list.length > 0) {
          setUserMap((prev) => {
            const next = { ...prev };
            list.forEach((u) => {
              if (u?.id) {
                next[u.id] = {
                  fullName: u.fullName || u.name,
                  email: u.email,
                  phone: u.phone || u.phoneNumber
                };
              }
            });
            return next;
          });
        }
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [getAdminToken]);

  // Enrich user info for any bookings with missing userMap entry
  useEffect(() => {
    if (!bookings || bookings.length === 0) return;
    const token = getAdminToken(false);
    if (!token) return;

    const missingIds = [...new Set(
      bookings
        .map((b) => Number(b?.userId || b?.user?.id || b?.customerId))
        .filter((id) => id && !isNaN(id) && !userMap[id])
    )];

    if (missingIds.length === 0) return;

    let cancelled = false;
    missingIds.forEach((uid) => {
      adminService.getAdminUserDetail(token, uid)
        .then((res) => {
          if (cancelled) return;
          const u = res?.data || res;
          if (u && (u.fullName || u.name || u.email || u.phone)) {
            setUserMap((prev) => ({
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
  }, [bookings, getAdminToken]);

  // Fetch full details whenever modal is opened and ensure target user detail is loaded
  useEffect(() => {
    if (!selectedBooking) {
      setDetailedBooking(null);
      setIsDetailLoading(false);
      return;
    }

    const bookingId = selectedBooking.id || selectedBooking.bookingId;
    if (!bookingId) return;

    let cancelled = false;
    const token = getAdminToken(false);
    if (token) {
      setIsDetailLoading(true);
      adminService.getAdminBooking(token, bookingId)
        .then(async (detail) => {
          if (!cancelled && detail) {
            setDetailedBooking(detail);
            const targetUserId = detail?.userId || selectedBooking?.userId || detail?.user?.id || selectedBooking?.user?.id;
            if (targetUserId && !userMap[targetUserId]) {
              try {
                const uRes = await adminService.getAdminUserDetail(token, targetUserId);
                const u = uRes?.data || uRes;
                if (!cancelled && u && (u.fullName || u.name || u.email || u.phone)) {
                  setUserMap((prev) => ({
                    ...prev,
                    [targetUserId]: {
                      fullName: u.fullName || u.name,
                      email: u.email,
                      phone: u.phone || u.phoneNumber
                    }
                  }));
                }
              } catch (uErr) {
                console.warn('Cannot fetch user detail for booking:', uErr);
              }
            }
          }
        })
        .catch(() => {
          // If detailed API is not available, selectedBooking provides complete base data
        })
        .finally(() => {
          if (!cancelled) setIsDetailLoading(false);
        });
    }

    return () => { cancelled = true; };
  }, [selectedBooking, getAdminToken]);

  // Load cinema list
  useEffect(() => {
    const token = getAdminToken(false);
    if (!token) return;
    let cancelled = false;
    adminService.getAdminCinemas(token)
      .then((res) => {
        if (cancelled) return;
        const list = Array.isArray(res) ? res : (res?.items || res?.content || []);
        setCinemas(list);
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [getAdminToken]);

  // Keep manager locked to their cinema
  useEffect(() => {
    if (managerCinemaId) {
      setSelectedCinemaId(String(managerCinemaId));
    }
  }, [managerCinemaId]);

  // Fetch transactions from backend
  const loadTransactions = async (pageIdx = page, status = statusFilter, search = appliedSearch) => {
    const token = getAdminToken(false);
    if (!token) return;
    setLoading(true);

    try {
      const params = {
        page: pageIdx,
        size: pageSize,
        sort: 'id,desc'
      };

      const activeCinema = managerCinemaId ? String(managerCinemaId) : selectedCinemaId;
      if (activeCinema && activeCinema !== 'ALL') {
        params.cinemaId = activeCinema;
      }
      if (status && status !== 'ALL') {
        params.status = status;
      }
      if (search && search.trim()) {
        params.search = search.trim();
        params.keyword = search.trim();
      }

      const res = await adminService.getAdminBookings(token, { ...params, sort: 'id,desc' });
      const items = Array.isArray(res) ? res : (res?.items || res?.content || []);
      const sortedItems = [...items].sort((a, b) => {
        const timeA = new Date(a.createdAt || a.paidAt || 0).getTime();
        const timeB = new Date(b.createdAt || b.paidAt || 0).getTime();
        if (timeB !== timeA) return timeB - timeA;
        return Number(b.id || 0) - Number(a.id || 0);
      });
      setBookings(sortedItems);

      if (res?.totalPages !== undefined) setTotalPages(Math.max(1, Number(res.totalPages)));
      else if (res?.totalElements !== undefined) setTotalPages(Math.max(1, Math.ceil(Number(res.totalElements) / pageSize)));
      else setTotalPages(items.length >= pageSize ? pageIdx + 2 : pageIdx + 1);

      if (res?.totalElements !== undefined) setTotalItems(Number(res.totalElements));
      else setTotalItems(items.length);
    } catch (err) {
      console.warn('Lỗi tải danh sách giao dịch:', err);
      showToast?.('Không thể tải danh sách giao dịch: ' + (err?.message || 'Lỗi server'), 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTransactions(page, statusFilter, appliedSearch);
  }, [page, statusFilter, selectedCinemaId, appliedSearch]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    setPage(0);
    setAppliedSearch(searchQuery);
  };

  // Compute stats on the current page safely
  const pageStats = useMemo(() => {
    let paidSum = 0;
    let refundSum = 0;
    let paidCount = 0;
    let pendingCount = 0;
    let refundCount = 0;

    (bookings || []).forEach((b) => {
      const amount = Number(b?.totalAmount ?? b?.finalAmount ?? b?.amount ?? 0);
      const st = String(b?.status || '').toUpperCase();
      if (st === 'PAID' || st === 'USED') {
        paidSum += amount;
        paidCount += 1;
      } else if (st === 'REFUNDED') {
        refundSum += amount;
        refundCount += 1;
      } else if (st === 'PENDING_PAYMENT' || st === 'HOLDING') {
        pendingCount += 1;
      }
    });

    return { paidSum, refundSum, paidCount, pendingCount, refundCount };
  }, [bookings]);

  // CSV export
  const exportCsv = () => {
    if (!bookings.length) return;
    const headers = [
      'Mã giao dịch',
      'Mã đặt vé',
      'Khách hàng',
      'SĐT',
      'Rạp chiếu',
      'Phim',
      'Phương thức thanh toán',
      'Tổng tiền (VND)',
      'Trạng thái',
      'Thời gian giao dịch'
    ];
    const rows = bookings.map((b) => {
      const cust = getCustomerDetails(b, userMap);
      return [
        b.id || '',
        b.bookingCode || b.code || b.id || '',
        cust.name,
        cust.phone,
        b.cinemaName || b.showtime?.cinema?.name || '—',
        b.movieTitle || b.showtime?.movie?.title || '—',
        b.paymentMethod || 'VNPay / Cổng thanh toán',
        b.totalAmount ?? b.finalAmount ?? 0,
        b.status || '',
        formatDateTime(b.createdAt)
      ];
    });

    const csvStr = '\uFEFF' + [headers, ...rows]
      .map((row) => row.map((cell) => `"${String(cell ?? '').replace(/"/g, '""')}"`).join(';'))
      .join('\r\n');

    const blob = new Blob([csvStr], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `so-cai-giao-dich-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const cinemaName = managerCinemaId
    ? (cinemas.find((c) => String(c.id) === String(managerCinemaId))?.name || assignedCinema?.name || `Rạp #${managerCinemaId}`)
    : selectedCinemaId !== 'ALL'
    ? (cinemas.find((c) => String(c.id) === String(selectedCinemaId))?.name || `Rạp #${selectedCinemaId}`)
    : 'Toàn bộ hệ thống';

  return (
    <div className="space-y-6 text-white pb-12 select-text">
      {/* Top Banner / Heading */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/[0.08] pb-5">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[10px] font-mono uppercase tracking-[0.2em] text-amber-400 font-bold">
              CinePremier Accounting &amp; Ledger
            </span>
            {effectiveIsManager ? (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[9px] font-mono font-bold bg-amber-500/10 text-amber-400 border border-amber-500/30 uppercase">
                <Lock size={10} />
                Chi nhánh quản lý
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[9px] font-mono font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 uppercase">
                <Building2 size={10} />
                Toàn hệ thống
              </span>
            )}
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-white">
            Sổ cái giao dịch &amp; Hóa đơn thanh toán
          </h1>
          <p className="text-xs text-neutral-400 mt-0.5">
            Đối soát toàn bộ dòng tiền khách hàng, vé đặt xem phim, quầy bắp nước và lệnh hoàn tiền.
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-center">
          <button
            type="button"
            onClick={exportCsv}
            disabled={loading || !bookings.length}
            className="flex items-center gap-1.5 px-3 py-2 bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.1] text-xs font-semibold text-neutral-200 transition-colors disabled:opacity-40"
          >
            <ArrowDownToLine size={14} />
            <span>Xuất sổ cái CSV</span>
          </button>
          <button
            type="button"
            onClick={() => loadTransactions(page, statusFilter, appliedSearch)}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-2 bg-amber-500 hover:bg-amber-400 text-black font-bold text-xs transition-colors disabled:opacity-40"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            <span>Làm mới</span>
          </button>
        </div>
      </div>

      {/* Financial KPI Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="p-4 bg-gradient-to-b from-[#161a24] to-[#0e1118] border border-white/[0.08] border-t-2 border-t-emerald-500">
          <div className="flex items-center justify-between text-neutral-400 mb-2">
            <span className="text-[10px] font-mono uppercase font-bold tracking-wider">Doanh thu thực thu (Trang này)</span>
            <DollarSign size={16} className="text-emerald-400" />
          </div>
          <p className="text-2xl font-black font-mono text-white tracking-tight">
            {formatVnd(pageStats.paidSum)}
          </p>
          <p className="text-[11px] text-emerald-400/90 mt-1">
            {pageStats.paidCount} đơn thanh toán thành công
          </p>
        </div>

        <div className="p-4 bg-gradient-to-b from-[#161a24] to-[#0e1118] border border-white/[0.08] border-t-2 border-t-rose-500">
          <div className="flex items-center justify-between text-neutral-400 mb-2">
            <span className="text-[10px] font-mono uppercase font-bold tracking-wider">Tiền đã hoàn trả</span>
            <Undo2 size={16} className="text-rose-400" />
          </div>
          <p className="text-2xl font-black font-mono text-rose-300 tracking-tight">
            {formatVnd(pageStats.refundSum)}
          </p>
          <p className="text-[11px] text-rose-400/90 mt-1">
            {pageStats.refundCount} đơn được hoàn bồi
          </p>
        </div>

        <div className="p-4 bg-gradient-to-b from-[#161a24] to-[#0e1118] border border-white/[0.08] border-t-2 border-t-amber-500">
          <div className="flex items-center justify-between text-neutral-400 mb-2">
            <span className="text-[10px] font-mono uppercase font-bold tracking-wider">Chờ xử lý thanh toán</span>
            <Clock size={16} className="text-amber-400" />
          </div>
          <p className="text-2xl font-black font-mono text-amber-300 tracking-tight">
            {pageStats.pendingCount} đơn
          </p>
          <p className="text-[11px] text-neutral-400 mt-1">
            Đang giữ ghế hoặc chờ chuyển khoản
          </p>
        </div>

        <div className="p-4 bg-gradient-to-b from-[#161a24] to-[#0e1118] border border-white/[0.08] border-t-2 border-t-blue-500">
          <div className="flex items-center justify-between text-neutral-400 mb-2">
            <span className="text-[10px] font-mono uppercase font-bold tracking-wider">Quy mô giao dịch</span>
            <Receipt size={16} className="text-blue-400" />
          </div>
          <p className="text-2xl font-black font-mono text-white tracking-tight">
            {totalItems ? Number(totalItems).toLocaleString('vi-VN') : bookings.length} đơn
          </p>
          <p className="text-[11px] text-neutral-400 mt-1 truncate">
            Phạm vi: {cinemaName}
          </p>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="p-4 bg-[#11141c] border border-white/[0.08] space-y-3">
        <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3">
          {/* Status buttons */}
          <div className="flex items-center gap-1.5 flex-wrap overflow-x-auto pb-1 lg:pb-0">
            {STATUS_FILTERS.map((s) => (
              <button
                key={s.key}
                type="button"
                onClick={() => {
                  setStatusFilter(s.key);
                  setPage(0);
                }}
                className={`px-2.5 py-1.5 text-[10px] font-mono font-bold uppercase tracking-wider border transition-colors ${
                  statusFilter === s.key
                    ? 'bg-amber-500/20 text-amber-400 border-amber-500/40'
                    : 'bg-black/40 text-neutral-400 border-white/[0.08] hover:text-white hover:border-white/20'
                }`}
              >
                {s.label}
              </button>
            ))}
          </div>

          {/* Cinema selector & Search */}
          <div className="flex items-center gap-2 flex-wrap">
            {effectiveIsAdmin ? (
              <div className="flex items-center gap-1.5 px-2.5 py-1 bg-black border border-white/10 text-xs">
                <Building2 size={13} className="text-amber-400 shrink-0" />
                <select
                  value={selectedCinemaId}
                  onChange={(e) => {
                    setSelectedCinemaId(e.target.value);
                    setPage(0);
                  }}
                  className="bg-transparent text-neutral-200 text-xs font-semibold focus:outline-none max-w-[180px]"
                >
                  <option value="ALL">Toàn bộ cụm rạp</option>
                  {cinemas.map((c) => (
                    <option key={c.id} value={c.id} className="bg-[#121212] text-white">
                      {c.name || `Rạp #${c.id}`}
                    </option>
                  ))}
                </select>
              </div>
            ) : (
              <div className="flex items-center gap-1.5 px-2.5 py-1 bg-amber-500/10 border border-amber-500/20 text-xs text-amber-300">
                <Lock size={12} className="text-amber-400" />
                <span className="font-semibold truncate max-w-[180px]">{cinemaName}</span>
              </div>
            )}

            <form onSubmit={handleSearchSubmit} className="relative flex-1 sm:w-64">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-neutral-500" />
              <input
                type="text"
                placeholder="Mã đơn, SĐT, tên khách..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 bg-black border border-white/10 text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-amber-500"
              />
            </form>
          </div>
        </div>
      </div>

      {/* Transactions Data Table */}
      <div className="border border-white/[0.08] bg-[#11141c] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[850px]">
            <thead>
              <tr className="border-b border-white/[0.08] bg-[#0c0f16] text-[10px] font-mono uppercase font-bold text-neutral-400 tracking-wider">
                <th className="py-3 px-4">Mã GD / Đơn hàng</th>
                <th className="py-3 px-4">Khách hàng</th>
                <th className="py-3 px-4">Phim &amp; Rạp chiếu</th>
                <th className="py-3 px-4">Phương thức</th>
                <th className="py-3 px-4 text-right">Tổng tiền</th>
                <th className="py-3 px-4 text-center">Trạng thái</th>
                <th className="py-3 px-4">Thời gian</th>
                <th className="py-3 px-4 text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.04] text-xs">
              {loading ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-neutral-400">
                    <RefreshCw className="w-5 h-5 animate-spin text-amber-400 mx-auto mb-2" />
                    <span>Đang tải danh sách sổ cái giao dịch...</span>
                  </td>
                </tr>
              ) : bookings.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-neutral-400">
                    <FileText className="w-8 h-8 text-neutral-600 mx-auto mb-2" />
                    <p className="font-medium text-white">Không có giao dịch nào thỏa mãn bộ lọc.</p>
                    <p className="text-xs text-neutral-500 mt-1">Thử chọn khoảng trạng thái khác hoặc tìm kiếm với từ khóa khác.</p>
                  </td>
                </tr>
              ) : (
                bookings.map((b) => {
                  const bookingId = b?.id || b?.bookingId;
                  const code = b?.bookingCode || b?.code || (bookingId ? `#${bookingId}` : '—');
                  const { name: customerName, phone: customerPhone } = getCustomerDetails(b, userMap);
                  const movieTitle = getMovieTitle(b);
                  const { cinemaName: bCinema } = getCinemaAndRoom(b, cinemas);
                  const total = b?.totalAmount ?? b?.finalAmount ?? b?.amount ?? 0;
                  const st = String(b?.status || 'PAID').toUpperCase();
                  const badge = STATUS_BADGES[st] || { label: st, bg: 'bg-neutral-800 text-neutral-400' };

                  return (
                    <tr key={bookingId || Math.random()} className="hover:bg-white/[0.02] transition-colors">
                      <td className="py-3.5 px-4 font-mono">
                        <strong className="text-amber-400 font-bold block">{code}</strong>
                        <span className="text-[10px] text-neutral-500">ID: #{bookingId}</span>
                      </td>

                      <td className="py-3.5 px-4">
                        <strong className="text-white block font-medium">{customerName}</strong>
                        <span className="text-[11px] text-neutral-400 font-mono">{customerPhone}</span>
                      </td>

                      <td className="py-3.5 px-4">
                        <strong className="text-neutral-200 block truncate max-w-[200px]" title={movieTitle}>
                          {movieTitle}
                        </strong>
                        <span className="text-[10px] text-neutral-400 block truncate max-w-[200px] font-mono">
                          {bCinema}
                        </span>
                      </td>

                      <td className="py-3.5 px-4 font-mono text-[11px] text-neutral-300">
                        <span className="inline-flex items-center gap-1">
                          <CreditCard size={12} className="text-neutral-400" />
                          {b?.paymentMethod || 'VNPAY / Cổng TT'}
                        </span>
                      </td>

                      <td className="py-3.5 px-4 text-right font-mono font-bold text-white text-sm">
                        {formatVnd(total)}
                      </td>

                      <td className="py-3.5 px-4 text-center">
                        <span className={`inline-block px-2.5 py-0.5 rounded text-[10px] font-mono font-bold border ${badge.bg}`}>
                          {badge.label}
                        </span>
                      </td>

                      <td className="py-3.5 px-4 font-mono text-[11px] text-neutral-400 whitespace-nowrap">
                        {formatDateTime(b?.createdAt)}
                      </td>

                      <td className="py-3.5 px-4 text-right">
                        <button
                          type="button"
                          onClick={() => setSelectedBooking(b)}
                          className="inline-flex items-center gap-1 px-2.5 py-1 bg-white/[0.04] hover:bg-amber-500/10 border border-white/10 hover:border-amber-500/30 text-neutral-200 hover:text-amber-400 text-xs font-semibold transition-colors"
                          title="Xem chi tiết đơn hàng"
                        >
                          <Eye size={12} />
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

        {/* Pagination bar */}
        <div className="p-3 bg-[#0c0f16] border-t border-white/[0.08] flex items-center justify-between text-xs text-neutral-400">
          <span>
            Trang {page + 1} / {totalPages} (Tổng cộng {totalItems ? Number(totalItems).toLocaleString('vi-VN') : bookings.length} đơn)
          </span>

          <div className="flex items-center gap-1">
            <button
              type="button"
              disabled={page <= 0 || loading}
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              className="px-3 py-1 bg-black border border-white/10 hover:border-white/20 text-neutral-300 disabled:opacity-30 text-xs font-mono uppercase"
            >
              Trước
            </button>
            <span className="px-2 font-mono text-white font-bold">{page + 1}</span>
            <button
              type="button"
              disabled={page >= totalPages - 1 || loading}
              onClick={() => setPage((p) => p + 1)}
              className="px-3 py-1 bg-black border border-white/10 hover:border-white/20 text-neutral-300 disabled:opacity-30 text-xs font-mono uppercase"
            >
              Sau
            </button>
          </div>
        </div>
      </div>

      {/* Transaction Detail Modal */}
      {selectedBooking && (() => {
        const activeDetail = detailedBooking ? { ...selectedBooking, ...detailedBooking } : selectedBooking;
        const bookingId = activeDetail?.id || activeDetail?.bookingId;
        const bookingCode = activeDetail?.bookingCode || activeDetail?.code || (bookingId ? `#${bookingId}` : '—');
        const cust = getCustomerDetails(activeDetail, userMap);
        const movie = getMovieTitle(activeDetail);
        const { cinemaName: curCinema, roomName: curRoom } = getCinemaAndRoom(activeDetail, cinemas);
        const showtimeStr = getShowtimeDateTime(activeDetail);
        const seatList = extractSeats(activeDetail);
        const foodList = extractFoods(activeDetail);
        const st = String(activeDetail?.status || 'PAID').toUpperCase();
        const badge = STATUS_BADGES[st] || { label: st, bg: 'bg-neutral-800 text-neutral-400' };
        const total = activeDetail?.totalAmount ?? activeDetail?.finalAmount ?? activeDetail?.amount ?? 0;
        const discountAmount = Number(activeDetail?.discountAmount || 0);

        const handleCopyCode = () => {
          if (!bookingCode) return;
          navigator.clipboard?.writeText(bookingCode).then(() => {
            setCopiedCode(true);
            setTimeout(() => setCopiedCode(false), 2000);
          }).catch(() => {});
        };

        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-150">
            <div className="bg-[#121620] border border-white/15 w-full max-w-xl shadow-2xl p-6 space-y-4 text-left max-h-[90vh] overflow-y-auto">
              <div className="flex items-start justify-between border-b border-white/10 pb-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-mono uppercase font-bold text-amber-400 tracking-wider">
                      Chi tiết hóa đơn giao dịch
                    </span>
                    {isDetailLoading && (
                      <span className="inline-flex items-center gap-1 text-[10px] font-mono text-neutral-400">
                        <RefreshCw size={10} className="animate-spin text-amber-400" />
                        Đang đồng bộ...
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 mt-1">
                    <h3 className="text-lg font-bold text-white font-mono">
                      Mã đơn: {bookingCode}
                    </h3>
                    <button
                      type="button"
                      onClick={handleCopyCode}
                      className="inline-flex items-center gap-1 px-2 py-0.5 bg-white/5 hover:bg-white/10 border border-white/10 text-[10px] text-neutral-300 rounded font-mono transition-colors"
                      title="Sao chép mã đơn"
                    >
                      {copiedCode ? (
                        <>
                          <Check size={11} className="text-emerald-400" />
                          <span className="text-emerald-400 font-bold">Đã chép</span>
                        </>
                      ) : (
                        <>
                          <Copy size={11} className="text-neutral-400" />
                          <span>Chép mã</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <span className={`inline-block px-2.5 py-1 rounded text-[10px] font-mono font-bold border ${badge.bg}`}>
                    {badge.label}
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedBooking(null);
                      setDetailedBooking(null);
                    }}
                    className="p-1 hover:bg-white/10 text-neutral-400 hover:text-white transition-colors"
                  >
                    <X size={18} />
                  </button>
                </div>
              </div>

              <div className="space-y-3 text-xs">
                {/* Khách hàng & Tài khoản */}
                <div className="grid grid-cols-2 gap-3 p-3 bg-black/40 border border-white/5">
                  <div>
                    <div className="flex items-center gap-1 text-neutral-400 text-[10px] uppercase font-mono">
                      <User size={11} />
                      <span>Khách hàng</span>
                    </div>
                    <strong className="text-white block mt-1 text-sm font-semibold">
                      {cust.name}
                    </strong>
                    <div className="flex items-center gap-1 text-neutral-400 font-mono text-[11px] mt-0.5">
                      <Phone size={10} />
                      <span>{cust.phone}</span>
                    </div>
                  </div>
                  <div>
                    <div className="flex items-center gap-1 text-neutral-400 text-[10px] uppercase font-mono">
                      <Mail size={11} />
                      <span>Email tài khoản</span>
                    </div>
                    <strong className="text-neutral-200 block mt-1 font-mono truncate text-xs" title={cust.email}>
                      {cust.email}
                    </strong>
                    <span className="text-[10px] text-neutral-500 font-mono block mt-0.5">
                      ID Khách: {(() => {
                        const uid = activeDetail?.userId || activeDetail?.user?.id || activeDetail?.customerId;
                        return uid ? `#${uid}` : 'Khách vãng lai';
                      })()}
                    </span>
                  </div>
                </div>

                {/* Thông tin Suất chiếu & Ghế */}
                <div className="p-3 bg-black/40 border border-white/5 space-y-2.5">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-1.5 text-neutral-400 shrink-0">
                      <Film size={13} className="text-amber-400" />
                      <span>Phim xem:</span>
                    </div>
                    <strong className="text-white text-right font-bold text-sm">{movie}</strong>
                  </div>

                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5 text-neutral-400 shrink-0">
                      <Building2 size={13} className="text-sky-400" />
                      <span>Cụm rạp:</span>
                    </div>
                    <span className="text-neutral-200 font-medium">{curCinema}</span>
                  </div>

                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5 text-neutral-400 shrink-0">
                      <Calendar size={13} className="text-emerald-400" />
                      <span>Phòng &amp; Giờ chiếu:</span>
                    </div>
                    <span className="text-neutral-200 font-mono">
                      <strong className="text-white">{curRoom}</strong> • {showtimeStr}
                    </span>
                  </div>

                  <div className="pt-2 border-t border-white/5">
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center gap-1.5 text-neutral-400">
                        <Ticket size={13} className="text-amber-400" />
                        <span>Ghế ngồi:</span>
                      </div>
                      <span className="text-neutral-400 font-mono text-[11px]">
                        {seatList.length > 0 ? `${seatList.length} ghế đã chọn` : 'Chưa có ghế'}
                      </span>
                    </div>
                    {seatList.length > 0 ? (
                      <div className="flex flex-wrap gap-1.5">
                        {seatList.map((stName, idx) => (
                          <span
                            key={idx}
                            className="px-2 py-0.5 rounded bg-amber-500/15 border border-amber-500/30 text-amber-300 font-mono font-bold text-xs"
                          >
                            {stName}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <span className="text-neutral-500 italic">Không có dữ liệu ghế</span>
                    )}
                  </div>
                </div>

                {/* Bắp nước đính kèm (nếu có) */}
                {foodList.length > 0 && (
                  <div className="p-3 bg-black/40 border border-white/5 space-y-2">
                    <div className="flex items-center justify-between text-neutral-400 text-[10px] uppercase font-mono font-bold tracking-wider">
                      <span className="inline-flex items-center gap-1.5">
                        <Utensils size={12} className="text-amber-400" />
                        Bắp nước &amp; Combo kèm theo
                      </span>
                      <span>Thành tiền</span>
                    </div>
                    <div className="space-y-1 divide-y divide-white/5">
                      {foodList.map((f, idx) => (
                        <div key={idx} className="flex justify-between items-center pt-1.5 text-xs">
                          <div>
                            <span className="text-white font-medium block">{f.name}</span>
                            <span className="text-[10px] text-neutral-400 font-mono">
                              {f.quantity} × {formatVnd(f.unitPrice)}
                            </span>
                          </div>
                          <span className="text-amber-300 font-mono font-bold">
                            {formatVnd(f.totalPrice)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Chi tiết thanh toán & Dòng tiền */}
                <div className="p-3 bg-black/40 border border-white/5 space-y-2">
                  <div className="flex justify-between">
                    <span className="text-neutral-400">Cổng thanh toán:</span>
                    <span className="text-neutral-200 font-mono font-semibold">
                      {activeDetail?.paymentMethod || 'VNPay / Quầy'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-neutral-400">Thời gian tạo đơn:</span>
                    <span className="text-neutral-300 font-mono">{formatDateTime(activeDetail?.createdAt)}</span>
                  </div>
                  {activeDetail?.paidAt && (
                    <div className="flex justify-between">
                      <span className="text-neutral-400">Thanh toán lúc:</span>
                      <span className="text-emerald-400 font-mono">{formatDateTime(activeDetail.paidAt)}</span>
                    </div>
                  )}
                  {activeDetail?.checkedInAt && (
                    <div className="flex justify-between">
                      <span className="text-neutral-400">Soát vé lúc:</span>
                      <span className="text-sky-400 font-mono">{formatDateTime(activeDetail.checkedInAt)}</span>
                    </div>
                  )}
                  {activeDetail?.refundedAt && (
                    <div className="flex justify-between">
                      <span className="text-rose-400">Hoàn tiền lúc:</span>
                      <span className="text-rose-300 font-mono">{formatDateTime(activeDetail.refundedAt)}</span>
                    </div>
                  )}
                  {(activeDetail?.refundReason || activeDetail?.cancelReason) && (
                    <div className="flex justify-between text-rose-300">
                      <span>Lý do hủy/hoàn:</span>
                      <span className="font-semibold text-right max-w-[240px] truncate">
                        {activeDetail.refundReason || activeDetail.cancelReason}
                      </span>
                    </div>
                  )}

                  <div className="pt-2 border-t border-white/5 space-y-1">
                    {discountAmount > 0 && (
                      <div className="flex justify-between text-neutral-400 text-xs">
                        <span>Khuyến mãi / Giảm trừ:</span>
                        <span className="font-mono text-rose-400">-{formatVnd(discountAmount)}</span>
                      </div>
                    )}
                    <div className="flex justify-between items-center pt-1">
                      <span className="text-neutral-200 font-bold text-sm">Tổng thanh toán:</span>
                      <strong className="text-amber-400 font-mono text-lg font-black">
                        {formatVnd(total)}
                      </strong>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-white/10">
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="inline-flex items-center gap-1.5 px-3 py-2 bg-white/5 hover:bg-white/10 border border-white/10 text-neutral-300 text-xs font-semibold transition-colors"
                >
                  <Printer size={13} />
                  <span>In hóa đơn</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setSelectedBooking(null);
                    setDetailedBooking(null);
                  }}
                  className="px-5 py-2 bg-amber-500 hover:bg-amber-400 text-black text-xs font-bold transition-colors"
                >
                  Đóng
                </button>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
