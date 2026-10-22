import React, { useState, useEffect, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  AlertTriangle, RefreshCw, Search, Calendar, User, Ticket,
  DollarSign, FileText, CheckCircle2, ChevronDown, ChevronUp, ChevronLeft, ChevronRight,
  Printer, ShieldAlert, Clock, Download, Building2, ShieldCheck,
  Layers, Film, XCircle, AlertCircle, ArrowRight, CornerDownRight,
  Info, Check, HelpCircle
} from 'lucide-react';
import { getStoredAuth } from '../../../services/authService';
import { adminService } from '../../../services/adminService';

const fmtVND = (v) => `${Number(v || 0).toLocaleString('vi-VN')}đ`;

const fmtDateTime = (d) => {
  if (!d) return '—';
  const date = new Date(d);
  if (Number.isNaN(date.getTime())) return String(d);
  return date.toLocaleString('vi-VN', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
};

const fmtDateInput = (d) => {
  if (!d) return '';
  const date = new Date(d);
  if (Number.isNaN(date.getTime())) return '';
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
};

const COMMON_INCIDENT_REASONS = [
  'Lỗi máy chiếu / Hỏng bóng đèn máy chiếu',
  'Mất điện toàn cụm rạp đột xuất',
  'Lỗi hệ thống âm thanh vòm Dolby Atmos',
  'Sự cố máy lạnh / Môi trường phòng chiếu không đảm bảo',
  'Sự cố an toàn phòng cháy chữa cháy / Di tản khẩn cấp',
  'Lỗi kỹ thuật bản phim (DCP/KDM key hết hạn)',
  'Khác (Nhập lý do chi tiết bên dưới)',
];


const fmtDateDisplay = (d) => {
  if (!d) return '';
  const parts = String(d).split('-');
  if (parts.length === 3) {
    const [yyyy, mm, dd] = parts;
    return `${dd}/${mm}/${yyyy}`;
  }
  const date = new Date(d);
  if (Number.isNaN(date.getTime())) return String(d);
  const dd = String(date.getDate()).padStart(2, '0');
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const yyyy = date.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
};

/**
 * VietnameseDatePicker:
 * - Always displays strictly in dd/mm/yyyy
 * - Interactive calendar popover with Vietnamese localized headers (T2..CN)
 * - Quick jump to today, month navigation
 */
function VietnameseDatePicker({
  value,
  onChange,
  placeholder = 'dd/mm/yyyy',
  className = '',
  disabled = false,
  dropUp = false,
}) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef(null);
  const [shouldDropUp, setShouldDropUp] = useState(dropUp);

  useEffect(() => {
    if (!isOpen) return;
    if (dropUp) {
      setShouldDropUp(true);
      return;
    }
    if (containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      const spaceBelow = window.innerHeight - rect.bottom;
      const spaceAbove = rect.top;
      if (spaceBelow < 310 && spaceAbove > 260) {
        setShouldDropUp(true);
      } else {
        setShouldDropUp(false);
      }
    }
  }, [isOpen, dropUp]);

  const parsedDate = useMemo(() => {
    if (!value) return new Date();
    const parts = value.split('-').map(Number);
    if (parts.length === 3 && parts[0] && parts[1] && parts[2]) {
      return new Date(parts[0], parts[1] - 1, parts[2]);
    }
    return new Date();
  }, [value]);

  const [viewYear, setViewYear] = useState(() => parsedDate.getFullYear());
  const [viewMonth, setViewMonth] = useState(() => parsedDate.getMonth() + 1);

  useEffect(() => {
    if (value) {
      const parts = value.split('-').map(Number);
      if (parts.length === 3 && parts[0] && parts[1]) {
        setViewYear(parts[0]);
        setViewMonth(parts[1]);
      }
    }
  }, [value]);

  useEffect(() => {
    if (!isOpen) return;
    const handleClickOutside = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  const displayText = useMemo(() => {
    return fmtDateDisplay(value);
  }, [value]);

  const handlePrevMonth = (e) => {
    e.stopPropagation();
    if (viewMonth === 1) {
      setViewYear(prev => prev - 1);
      setViewMonth(12);
    } else {
      setViewMonth(prev => prev - 1);
    }
  };

  const handleNextMonth = (e) => {
    e.stopPropagation();
    if (viewMonth === 12) {
      setViewYear(prev => prev + 1);
      setViewMonth(1);
    } else {
      setViewMonth(prev => prev + 1);
    }
  };

  const handleSelectDay = (dayNum, monthOffset = 0) => {
    let targetY = viewYear;
    let targetM = viewMonth + monthOffset;
    if (targetM < 1) {
      targetY -= 1;
      targetM = 12;
    } else if (targetM > 12) {
      targetY += 1;
      targetM = 1;
    }
    const yStr = String(targetY);
    const mStr = String(targetM).padStart(2, '0');
    const dStr = String(dayNum).padStart(2, '0');
    onChange(`${yStr}-${mStr}-${dStr}`);
    setIsOpen(false);
  };

  const handleSelectToday = (e) => {
    e.stopPropagation();
    const today = new Date();
    const yStr = String(today.getFullYear());
    const mStr = String(today.getMonth() + 1).padStart(2, '0');
    const dStr = String(today.getDate()).padStart(2, '0');
    onChange(`${yStr}-${mStr}-${dStr}`);
    setViewYear(today.getFullYear());
    setViewMonth(today.getMonth() + 1);
    setIsOpen(false);
  };

  const cells = useMemo(() => {
    const f = new Date(viewYear, viewMonth - 1, 1);
    const daysInMonth = new Date(viewYear, viewMonth, 0).getDate();
    const prevMonthDays = new Date(viewYear, viewMonth - 1, 0).getDate();
    const startOffset = (f.getDay() + 6) % 7; // Monday = 0

    const list = [];
    for (let d = prevMonthDays - startOffset + 1; d <= prevMonthDays; d++) {
      list.push({ day: d, offset: -1, isCurrent: false });
    }
    for (let d = 1; d <= daysInMonth; d++) {
      list.push({ day: d, offset: 0, isCurrent: true });
    }
    const remaining = (7 - (list.length % 7)) % 7;
    for (let d = 1; d <= remaining; d++) {
      list.push({ day: d, offset: 1, isCurrent: false });
    }
    return list;
  }, [viewYear, viewMonth]);

  const todayStr = useMemo(() => {
    const t = new Date();
    return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`;
  }, []);

  return (
    <div className={`relative inline-block ${className}`} ref={containerRef}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => setIsOpen(prev => !prev)}
        className="flex items-center gap-2 border border-white/10 hover:border-amber-500/60 bg-black px-3 py-1.5 text-xs text-white focus:border-amber-500 focus:outline-none transition group select-none"
        title="Bấm để mở lịch chọn ngày"
      >
        <Calendar className="h-3.5 w-3.5 text-amber-500 shrink-0 group-hover:scale-110 transition-transform" />
        <span className="font-mono font-bold tracking-wider text-[12px] text-amber-300">
          {displayText || placeholder}
        </span>
        <ChevronDown className={`h-3 w-3 text-neutral-400 shrink-0 transition-transform ${isOpen ? 'rotate-180 text-amber-400' : ''}`} />
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: shouldDropUp ? -6 : 6, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: shouldDropUp ? -6 : 6, scale: 0.98 }}
            transition={{ duration: 0.15 }}
            className={`absolute left-0 ${shouldDropUp ? 'bottom-full mb-1.5' : 'top-full mt-1.5'} z-[100] w-[265px] border border-amber-500/50 bg-[#111] p-3 shadow-2xl shadow-black/95 font-sans`}
          >
            <div className="flex items-center justify-between pb-2 mb-2 border-b border-white/10">
              <button
                type="button"
                onClick={handlePrevMonth}
                className="p-1 text-neutral-400 hover:text-white hover:bg-white/10 transition"
                title="Tháng trước"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <div className="text-xs font-bold text-white font-mono flex items-center gap-1.5">
                <span className="text-amber-400">Tháng {String(viewMonth).padStart(2, '0')}</span>
                <span className="text-neutral-500">/</span>
                <span>{viewYear}</span>
              </div>
              <button
                type="button"
                onClick={handleNextMonth}
                className="p-1 text-neutral-400 hover:text-white hover:bg-white/10 transition"
                title="Tháng sau"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>

            <div className="grid grid-cols-7 gap-1 text-center text-[10px] font-mono font-bold uppercase text-neutral-400 mb-1.5">
              <span>T2</span>
              <span>T3</span>
              <span>T4</span>
              <span>T5</span>
              <span>T6</span>
              <span>T7</span>
              <span className="text-red-400">CN</span>
            </div>

            <div className="grid grid-cols-7 gap-1 text-center text-xs font-mono">
              {cells.map((cell, idx) => {
                const cellY = cell.offset === -1 ? (viewMonth === 1 ? viewYear - 1 : viewYear)
                            : cell.offset === 1 ? (viewMonth === 12 ? viewYear + 1 : viewYear)
                            : viewYear;
                const cellM = cell.offset === -1 ? (viewMonth === 1 ? 12 : viewMonth - 1)
                            : cell.offset === 1 ? (viewMonth === 12 ? 1 : viewMonth + 1)
                            : viewMonth;
                const cellKey = `${cellY}-${String(cellM).padStart(2, '0')}-${String(cell.day).padStart(2, '0')}`;
                const isSelected = cellKey === value;
                const isToday = cellKey === todayStr;

                return (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => handleSelectDay(cell.day, cell.offset)}
                    className={`h-7 w-7 mx-auto flex items-center justify-center text-[11px] font-mono transition
                      ${!cell.isCurrent ? 'text-neutral-600 hover:text-neutral-400' : 'text-neutral-200'}
                      ${isSelected ? 'bg-amber-500 font-black text-black shadow-md shadow-amber-500/30' : 'hover:bg-white/10 hover:text-white'}
                      ${isToday && !isSelected ? 'border border-amber-500/60 text-amber-400 font-bold' : ''}
                    `}
                  >
                    {cell.day}
                  </button>
                );
              })}
            </div>

            <div className="mt-2.5 pt-2 border-t border-white/10 flex items-center justify-between text-[10.5px]">
              <button
                type="button"
                onClick={handleSelectToday}
                className="text-amber-400 hover:text-amber-300 font-mono font-bold uppercase tracking-wider text-[10px] flex items-center gap-1 hover:underline"
              >
                • Chọn hôm nay
              </button>
              <span className="text-neutral-400 font-mono text-[10px]">
                {displayText}
              </span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default function AdminShowtimeIncidentsPanel({ ctx }) {
  // Navigation tab inside this panel
  const [activeTab, setActiveTab] = useState('refund-report'); // 'incident-showtime' | 'refund-report'

  // Cinema scoping for manager
  const managerCinemaId = ctx?.selectedCinemaId || ctx?.assignedCinema?.id || ctx?.currentUser?.cinemaId
    || (ctx?.isManager && ctx?.currentUser?.cinemaId ? Number(ctx.currentUser.cinemaId) : null);
  const cinemaName = ctx?.assignedCinema?.name || ctx?.publicCinema?.name || ctx?.currentUser?.cinemaName || 'Chi nhánh rạp được phân công';

  // -------------------------------------------------------------------------
  // TAB 1: XỬ LÝ SỰ CỐ SUẤT CHIẾU
  // -------------------------------------------------------------------------
  const [showtimesList, setShowtimesList] = useState([]);
  const [showtimesLoading, setShowtimesLoading] = useState(false);
  const [filterDate, setFilterDate] = useState(() => fmtDateInput(new Date()));
  // Shift filter date helper
  const shiftFilterDate = (days) => {
    const parts = (filterDate || fmtDateInput(new Date())).split('-').map(Number);
    const d = new Date(parts[0], parts[1] - 1, parts[2]);
    d.setDate(d.getDate() + days);
    setFilterDate(fmtDateInput(d));
  };

  const [selectedShowtimeId, setSelectedShowtimeId] = useState('');
  const [showtimeSummary, setShowtimeSummary] = useState(null);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [selectedPresetReason, setSelectedPresetReason] = useState(COMMON_INCIDENT_REASONS[0]);
  const [customReason, setCustomReason] = useState('');
  const [cancellingShowtime, setCancellingShowtime] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [incidentActionSuccess, setIncidentActionSuccess] = useState(null);

  // -------------------------------------------------------------------------
  // TAB 3: BÁO CÁO HOÀN TIỀN
  // -------------------------------------------------------------------------
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [expandedShowtimeId, setExpandedShowtimeId] = useState(null);

  const getAdminToken = () => {
    const { accessToken } = getStoredAuth();
    return accessToken || ctx?.token;
  };

  // ── Fetch Report (Tab 3) ───────────────────────────────────────────────────
  const fetchReport = async () => {
    const token = getAdminToken();
    if (!token) return;
    setLoading(true);
    setError('');
    try {
      const params = {};
      if (fromDate) params.from = fromDate;
      if (toDate) params.to = toDate;
      if (managerCinemaId) params.cinemaId = managerCinemaId;
      const res = await adminService.getShowtimeIncidentsReport(token, params);
      const data = res?.data || res || null;
      setReport(data);
    } catch (err) {
      console.error('Lỗi khi tải báo cáo sự cố & hoàn tiền:', err);
      setError(err?.message || 'Không thể tải báo cáo hoàn tiền.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReport();
  }, [fromDate, toDate, managerCinemaId]);

  // ── Fetch Showtimes for Selected Date (Tab 1) ──────────────────────────────
  const fetchShowtimesForDate = async (dateStr) => {
    const token = getAdminToken();
    if (!token) return;
    setShowtimesLoading(true);
    try {
      const params = { date: dateStr || fmtDateInput(new Date()) };
      if (managerCinemaId) params.cinemaId = managerCinemaId;
      const res = await adminService.getAdminShowtimes(token, params);
      const list = Array.isArray(res) ? res : (res?.data || res?.items || res?.content || []);
      setShowtimesList(list);

      // Batch lấy số lượng vé đã bán thực tế
      const validIds = list.map(x => Number(x.id)).filter(id => !isNaN(id) && id > 0);
      if (validIds.length > 0 && typeof adminService?.getShowtimesTicketCounts === 'function') {
        adminService.getShowtimesTicketCounts(token, validIds)
          .then(countsMap => {
            if (countsMap && typeof countsMap === 'object') {
              setShowtimesList(prev => prev.map(item => {
                const cnt = countsMap[item.id] ?? countsMap[Number(item.id)];
                return cnt !== undefined ? { ...item, sold: Number(cnt) } : item;
              }));
            }
          })
          .catch(() => {});
      }
    } catch (err) {
      console.error('Lỗi khi lấy danh sách suất chiếu:', err);
      setShowtimesList([]);
    } finally {
      setShowtimesLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'incident-showtime') {
      fetchShowtimesForDate(filterDate);
    }
  }, [activeTab, filterDate, managerCinemaId]);

  // ── Fetch Showtime Summary when selected (Tab 1) ───────────────────────────
  useEffect(() => {
    if (!selectedShowtimeId) {
      setShowtimeSummary(null);
      return;
    }
    const token = getAdminToken();
    if (!token) return;
    setSummaryLoading(true);
    adminService.getShowtimeBookingSummary(token, selectedShowtimeId)
      .then((res) => {
        const data = res?.data || res || null;
        if (data) {
          const soldCount = Number(data.soldTicketsCount ?? data.totalTickets ?? data.paidTicketsCount ?? 0);
          const paidBookings = Number(data.paidBookingsCount ?? data.paidOrdersCount ?? 0);
          const refundAmount = soldCount > 0 ? Number(data.totalRefundAmount ?? 0) : 0;
          setShowtimeSummary({
            ...data,
            soldTicketsCount: soldCount,
            totalTickets: soldCount,
            paidBookingsCount: paidBookings,
            totalRefundAmount: refundAmount,
          });
        } else {
          setShowtimeSummary(null);
        }
      })
      .catch((err) => {
        console.error('Lỗi lấy thông tin đơn hàng suất chiếu:', err);
        setShowtimeSummary(null);
      })
      .finally(() => setSummaryLoading(false));
  }, [selectedShowtimeId]);

  // ── Handle Cancel Showtime & Refund (Tab 1) ────────────────────────────────
  const handleExecuteCancelShowtime = async () => {
    if (!selectedShowtimeId) return;
    const finalReason = selectedPresetReason === 'Khác (Nhập lý do chi tiết bên dưới)'
      ? (customReason.trim() || 'Sự cố vận hành phòng chiếu')
      : (customReason.trim() ? `${selectedPresetReason} - ${customReason.trim()}` : selectedPresetReason);

    const token = getAdminToken();
    if (!token) return;
    setCancellingShowtime(true);
    try {
      await adminService.cancelShowtimeAndRefund(token, selectedShowtimeId, finalReason);
      setShowCancelModal(false);
      setIncidentActionSuccess({
        message: `Đã hủy suất chiếu #${selectedShowtimeId} và hoàn tiền tự động 100% về CineWallet thành công!`,
        totalTickets: showtimeSummary?.totalTickets || 0,
        totalRefundAmount: showtimeSummary?.totalRefundAmount || 0,
      });
      // Refresh report & showtimes list
      fetchReport();
      fetchShowtimesForDate(filterDate);
      setSelectedShowtimeId('');
      setShowtimeSummary(null);
    } catch (err) {
      alert('Không thể thực hiện hủy và hoàn tiền: ' + (err?.message || 'Lỗi không xác định'));
    } finally {
      setCancellingShowtime(false);
    }
  };

  // ── Filtered Incidents List (Tab 3) ─────────────────────────────────────────
  const incidents = report?.incidents || [];
  const filteredIncidents = useMemo(() => {
    if (!searchQuery.trim()) return incidents;
    const q = searchQuery.toLowerCase().trim();
    return incidents.filter((inc) => {
      const matchMovie = inc.movieTitle?.toLowerCase().includes(q);
      const matchRoom = inc.roomName?.toLowerCase().includes(q);
      const matchCinema = inc.cinemaName?.toLowerCase().includes(q);
      const matchReason = inc.cancellationReason?.toLowerCase().includes(q);
      const matchUsers = inc.refundedUsers?.some(
        (u) =>
          u.userName?.toLowerCase().includes(q) ||
          u.bookingCode?.toLowerCase().includes(q) ||
          u.userEmail?.toLowerCase().includes(q) ||
          u.userPhone?.toLowerCase().includes(q) ||
          u.seatLabels?.toLowerCase().includes(q)
      );
      return matchMovie || matchRoom || matchCinema || matchReason || matchUsers;
    });
  }, [incidents, searchQuery]);

  // ── Export CSV Function ────────────────────────────────────────────────────
  const handleExportCSV = () => {
    if (!incidents || incidents.length === 0) {
      alert('Chưa có dữ liệu sự cố hoàn tiền để xuất file.');
      return;
    }
    const headers = [
      'STT',
      'Mã suất chiếu',
      'Tên phim',
      'Rạp',
      'Phòng chiếu',
      'Giờ chiếu',
      'Thời điểm hủy',
      'Lý do hủy/sự cố',
      'Mã vé/Booking',
      'Tên khách hàng',
      'Số điện thoại',
      'Email',
      'Ghế ngồi',
      'Số tiền hoàn (VND)',
      'Phương thức hoàn',
      'Thời gian hoàn tiền',
    ];

    const rows = [];
    let count = 1;
    incidents.forEach((inc) => {
      if (!inc.refundedUsers || inc.refundedUsers.length === 0) {
        rows.push([
          count++,
          inc.showtimeId,
          `"${(inc.movieTitle || '').replace(/"/g, '""')}"`,
          `"${(inc.cinemaName || '').replace(/"/g, '""')}"`,
          `"${(inc.roomName || '').replace(/"/g, '""')}"`,
          fmtDateTime(inc.showtimeStart),
          fmtDateTime(inc.cancelledAt),
          `"${(inc.cancellationReason || '').replace(/"/g, '""')}"`,
          '—',
          '—',
          '—',
          '—',
          '—',
          0,
          'CINEWALLET',
          fmtDateTime(inc.cancelledAt),
        ]);
      } else {
        inc.refundedUsers.forEach((u) => {
          rows.push([
            count++,
            inc.showtimeId,
            `"${(inc.movieTitle || '').replace(/"/g, '""')}"`,
            `"${(inc.cinemaName || '').replace(/"/g, '""')}"`,
            `"${(inc.roomName || '').replace(/"/g, '""')}"`,
            fmtDateTime(inc.showtimeStart),
            fmtDateTime(inc.cancelledAt),
            `"${(inc.cancellationReason || '').replace(/"/g, '""')}"`,
            u.bookingCode || `BK-${u.bookingId}`,
            `"${(u.userName || '').replace(/"/g, '""')}"`,
            u.userPhone || '',
            u.userEmail || '',
            `"${(u.seatLabels || '').replace(/"/g, '""')}"`,
            u.amount || 0,
            u.refundMethod || 'CINEWALLET',
            fmtDateTime(u.refundedAt),
          ]);
        });
      }
    });

    const csvContent = '\uFEFF' + [headers.join(','), ...rows.map(r => r.join(','))].join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `Bao_Cao_Hoan_Tien_CineWallet_${fmtDateInput(new Date())}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const selectedShowtimeObj = showtimesList.find(st => String(st.id) === String(selectedShowtimeId));

  return (
    <div className="space-y-6 pb-20">
      {/* HEADER SECTION */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-white/[0.08] pb-6">
        <div>
          <div className="flex flex-wrap items-center gap-2 mb-2">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 text-[10px] font-mono font-bold uppercase tracking-wider bg-amber-500/10 text-amber-400 border border-amber-500/30">
              <ShieldAlert className="h-3 w-3" /> Quyền Quản Lý Rạp (Manager)
            </span>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 text-[10px] font-mono font-bold uppercase tracking-wider bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
              <Building2 className="h-3 w-3" /> {cinemaName}
            </span>
          </div>
          <h1 className="text-xl md:text-2xl font-sans font-black uppercase tracking-tight text-white flex items-center gap-2">
            <AlertTriangle className="h-6 w-6 text-amber-500 shrink-0" />
            Xử Lý Hoàn Tiền & Báo Cáo Sự Cố Suất Chiếu
          </h1>
          <p className="text-xs text-neutral-300 font-sans mt-1">
            Theo dõi suất chiếu bị sự cố kỹ thuật, thực hiện hoàn tiền tự động 100% về CineWallet và tra cứu báo cáo tài chính hoàn tiền.
          </p>
        </div>

        {/* TAB BUTTONS */}
        <div className="flex items-center gap-1 bg-[#121212] p-1 border border-white/10 self-start md:self-auto shrink-0">
          <button
            onClick={() => setActiveTab('refund-report')}
            className={`flex items-center gap-2 px-3.5 py-2 text-[10.5px] font-sans font-black uppercase tracking-wider transition ${
              activeTab === 'refund-report'
                ? 'bg-amber-500 text-black shadow-lg shadow-amber-500/20'
                : 'text-neutral-400 hover:text-white hover:bg-white/[0.04]'
            }`}
          >
            <FileText className="h-3.5 w-3.5" /> Báo cáo hoàn tiền
          </button>
          <button
            onClick={() => setActiveTab('incident-showtime')}
            className={`flex items-center gap-2 px-3.5 py-2 text-[10.5px] font-sans font-black uppercase tracking-wider transition ${
              activeTab === 'incident-showtime'
                ? 'bg-amber-500 text-black shadow-lg shadow-amber-500/20'
                : 'text-neutral-400 hover:text-white hover:bg-white/[0.04]'
            }`}
          >
            <AlertTriangle className="h-3.5 w-3.5" /> Xử lý sự cố suất chiếu
          </button>
        </div>
      </div>

      {/* ===================================================================== */}
      {/* TAB 1: XỬ LÝ SỰ CỐ SUẤT CHIẾU (BULK REFUND) */}
      {/* ===================================================================== */}
      {activeTab === 'incident-showtime' && (
        <div className="space-y-6 animate-fade-in">
          {/* Action Success Alert */}
          {incidentActionSuccess && (
            <div className="p-4 border border-emerald-500/40 bg-emerald-950/20 flex items-start justify-between gap-3 text-emerald-200">
              <div className="flex items-center gap-3">
                <CheckCircle2 className="h-5 w-5 text-emerald-400 shrink-0" />
                <div>
                  <p className="text-xs font-sans font-black uppercase tracking-wide text-white">
                    {incidentActionSuccess.message}
                  </p>
                  <p className="text-[11px] font-mono text-emerald-300/90 mt-0.5">
                    Tổng số vé hủy: <strong className="text-white">{incidentActionSuccess.totalTickets} vé</strong> | 
                    Tổng tiền đã hoàn ví: <strong className="text-emerald-400">{fmtVND(incidentActionSuccess.totalRefundAmount)}</strong>
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIncidentActionSuccess(null)}
                className="text-neutral-400 hover:text-white p-1"
              >
                ✕
              </button>
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* LEFT 2 COLS: CHỌN SUẤT CHIẾU */}
            <div className="lg:col-span-2 border border-white/[0.08] bg-[#0E0E0E] p-5 space-y-5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-white/[0.06] pb-4">
                <div>
                  <h2 className="text-sm font-sans font-black uppercase tracking-wide text-white flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-amber-500" /> Bước 1: Chọn suất chiếu cần xử lý sự cố
                  </h2>
                  <p className="text-[11px] text-neutral-300 font-sans mt-0.5">
                    Chỉ hiển thị các suất chiếu tại {cinemaName}
                  </p>
                </div>

                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] font-mono uppercase text-neutral-400 mr-1">Ngày:</span>

                  <button
                    type="button"
                    onClick={() => shiftFilterDate(-1)}
                    className="p-1.5 border border-white/10 hover:border-amber-500/50 bg-black text-neutral-300 hover:text-white transition"
                    title="Xem ngày trước đó"
                  >
                    <ChevronLeft className="h-3.5 w-3.5" />
                  </button>

                  <VietnameseDatePicker
                    value={filterDate}
                    onChange={(newDate) => setFilterDate(newDate)}
                  />

                  <button
                    type="button"
                    onClick={() => shiftFilterDate(1)}
                    className="p-1.5 border border-white/10 hover:border-amber-500/50 bg-black text-neutral-300 hover:text-white transition"
                    title="Xem ngày kế tiếp"
                  >
                    <ChevronRight className="h-3.5 w-3.5" />
                  </button>

                  {filterDate !== fmtDateInput(new Date()) && (
                    <button
                      type="button"
                      onClick={() => setFilterDate(fmtDateInput(new Date()))}
                      className="px-2 py-1.5 border border-amber-500/30 bg-amber-500/10 text-amber-300 hover:bg-amber-500/20 text-[10px] font-mono font-bold uppercase tracking-wider transition"
                      title="Quay về ngày hôm nay"
                    >
                      Hôm nay
                    </button>
                  )}

                  <button
                    onClick={() => fetchShowtimesForDate(filterDate)}
                    disabled={showtimesLoading}
                    className="p-2 border border-white/10 hover:border-amber-500/50 bg-black text-neutral-300 hover:text-white transition ml-0.5"
                    title="Làm mới danh sách suất"
                  >
                    <RefreshCw className={`h-3.5 w-3.5 ${showtimesLoading ? 'animate-spin' : ''}`} />
                  </button>
                </div>
              </div>

              {/* SHOWTIMES SELECTOR */}
              {showtimesLoading ? (
                <div className="p-8 text-center text-xs text-neutral-400 flex items-center justify-center gap-2 font-mono">
                  <RefreshCw className="h-4 w-4 animate-spin text-amber-500" /> Đang tải danh sách suất chiếu...
                </div>
              ) : showtimesList.length === 0 ? (
                <div className="p-8 text-center border border-dashed border-white/10 text-xs text-neutral-300 font-mono">
                  Không tìm thấy suất chiếu nào vào ngày {fmtDateDisplay(filterDate)} tại chi nhánh này.
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-[380px] overflow-y-auto pr-1">
                  {showtimesList.map((st) => {
                    const isSelected = String(st.id) === String(selectedShowtimeId);
                    const isCancelled = st.status === 'CANCELLED';
                    return (
                      <div
                        key={st.id}
                        onClick={() => !isCancelled && setSelectedShowtimeId(String(st.id))}
                        className={`p-3.5 border transition cursor-pointer relative ${
                          isCancelled
                            ? 'border-red-900/30 bg-red-950/10 opacity-60 cursor-not-allowed'
                            : isSelected
                            ? 'border-amber-500 bg-amber-500/[0.08] shadow-md shadow-amber-500/10'
                            : 'border-white/[0.06] bg-[#141414] hover:border-white/20'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <span className="text-[9px] font-mono px-2 py-0.5 uppercase font-bold border border-white/10 bg-black text-neutral-300">
                              #{st.id} • {st.room?.name || st.roomName || 'Phòng chiếu'}
                            </span>
                            <h3 className="text-xs font-sans font-black uppercase text-white mt-1.5 line-clamp-1">
                              {st.movie?.title || st.movieTitle || 'Phim chưa xác định'}
                            </h3>
                          </div>
                          <span className={`text-[9px] font-mono font-bold px-2 py-0.5 uppercase ${
                            isCancelled
                              ? 'bg-red-950/60 text-red-400 border border-red-500/30'
                              : 'bg-emerald-950/40 text-emerald-400 border border-emerald-500/30'
                          }`}>
                            {isCancelled ? 'ĐÃ HỦY' : (st.status || 'ACTIVE')}
                          </span>
                        </div>

                        <div className="flex items-center gap-3 text-[10.5px] font-mono text-neutral-300 mt-2">
                          <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3 text-amber-500" /> {fmtDateTime(st.startTime)}
                          </span>
                          <span>-</span>
                          <span>{st.format || '2D Phụ đề'}</span>
                          {st.sold !== undefined && (
                            <>
                              <span>-</span>
                              <span className={st.sold > 0 ? "text-amber-400 font-bold" : "text-neutral-500"}>
                                🎟️ {st.sold} vé đã bán
                              </span>
                            </>
                          )}
                        </div>

                        {isSelected && (
                          <div className="absolute top-2 right-2 flex h-4 w-4 items-center justify-center rounded-full bg-amber-500 text-black">
                            <Check className="h-2.5 w-2.5 stroke-[3]" />
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* RIGHT COL: FORM XÁC NHẬN SỰ CỐ & HOÀN TIỀN */}
            <div className="border border-white/[0.08] bg-[#0E0E0E] p-5 space-y-4 flex flex-col justify-between">
              <div>
                <h2 className="text-sm font-sans font-black uppercase tracking-wide text-white flex items-center gap-2 border-b border-white/[0.06] pb-3">
                  <ShieldAlert className="h-4 w-4 text-amber-500" /> Bước 2: Thông tin xử lý sự cố
                </h2>

                {!selectedShowtimeObj ? (
                  <div className="p-8 text-center text-xs text-neutral-300 font-mono mt-4">
                    Vui lòng chọn 1 suất chiếu ở danh sách bên trái để kiểm tra dữ liệu và thao tác hoàn tiền.
                  </div>
                ) : summaryLoading ? (
                  <div className="p-8 text-center text-xs text-neutral-400 font-mono flex items-center justify-center gap-2">
                    <RefreshCw className="h-4 w-4 animate-spin text-amber-500" /> Đang kiểm tra đơn hàng...
                  </div>
                ) : (
                  <div className="space-y-4 mt-4">
                    {/* TÓM TẮT ĐƠN HÀNG CẦN HOÀN */}
                    <div className="p-3.5 border border-amber-500/30 bg-amber-500/[0.06] space-y-2">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-neutral-300 font-mono text-[11px]">Suất chiếu đã chọn:</span>
                        <strong className="text-amber-400 font-mono font-black">#{selectedShowtimeObj.id}</strong>
                      </div>
                      <p className="text-xs font-black text-white uppercase line-clamp-1">
                        {selectedShowtimeObj.movie?.title || selectedShowtimeObj.movieTitle}
                      </p>
                      <div className="grid grid-cols-2 gap-2 pt-2 border-t border-amber-500/20 text-[11px] font-mono">
                        <div>
                          <div className="text-neutral-400 text-[10px]">Số vé đã bán:</div>
                          <div className="text-sm font-bold text-white">
                            {showtimeSummary?.soldTicketsCount ?? 0} vé
                            {(showtimeSummary?.paidBookingsCount || 0) > 0 && (
                              <span className="text-[10px] text-neutral-400 font-normal ml-1">
                                ({showtimeSummary.paidBookingsCount} đơn)
                              </span>
                            )}
                          </div>
                        </div>
                        <div>
                          <div className="text-neutral-400 text-[10px]">Số tiền cần hoàn ví:</div>
                          <div className={`text-sm font-bold font-mono ${
                            (showtimeSummary?.soldTicketsCount || 0) > 0 ? "text-emerald-400" : "text-neutral-400"
                          }`}>
                            {fmtVND((showtimeSummary?.soldTicketsCount || 0) > 0 ? (showtimeSummary?.totalRefundAmount ?? 0) : 0)}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* SELECT LÝ DO SỰ CỐ */}
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-mono font-bold uppercase tracking-wider text-neutral-300">
                        Lý do sự cố kỹ thuật / Hủy suất:
                      </label>
                      <select
                        value={selectedPresetReason}
                        onChange={(e) => setSelectedPresetReason(e.target.value)}
                        className="w-full border border-white/10 bg-black px-3 py-2 text-xs text-white focus:border-amber-500 focus:outline-none font-sans"
                      >
                        {COMMON_INCIDENT_REASONS.map((r, i) => (
                          <option key={i} value={r}>{r}</option>
                        ))}
                      </select>
                    </div>

                    {/* CUSTOM REASON TEXTAREA */}
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-mono font-bold uppercase tracking-wider text-neutral-300">
                        Chi tiết bổ sung (ghi vào nhật ký hoàn tiền):
                      </label>
                      <textarea
                        rows={2}
                        value={customReason}
                        onChange={(e) => setCustomReason(e.target.value)}
                        placeholder="Nhập ghi chú chi tiết hoặc mã biên bản sự cố..."
                        className="w-full border border-white/10 bg-black p-2.5 text-xs text-white focus:border-amber-500 focus:outline-none font-sans placeholder:text-neutral-600 resize-none"
                      />
                    </div>

                    <div className="p-3 border border-red-500/20 bg-red-950/10 text-[11px] text-red-300 space-y-1">
                      <p className="font-bold flex items-center gap-1.5 text-red-200">
                        <AlertTriangle className="h-3.5 w-3.5 text-red-400" /> Lưu ý quan trọng:
                      </p>
                      <p className="text-[10px] text-neutral-300 leading-relaxed">
                        {(showtimeSummary?.soldTicketsCount || 0) > 0 ? (
                          <>
                            Hệ thống sẽ hủy suất chiếu ngay lập tức và tự động hoàn trả 100% tiền vé (<strong>{fmtVND(showtimeSummary?.totalRefundAmount ?? 0)}</strong>) vào ví CineWallet của <strong>{showtimeSummary?.paidBookingsCount || 0} khách hàng</strong> đã mua ({showtimeSummary?.soldTicketsCount} vé).
                          </>
                        ) : (
                          <>
                            Suất chiếu này hiện <strong>chưa có vé nào được bán (0 vé)</strong>. Khi hủy sẽ giải phóng phòng chiếu và không phát sinh giao dịch hoàn tiền.
                          </>
                        )}
                      </p>
                    </div>
                  </div>
                )}
              </div>

              {selectedShowtimeObj && (
                <button
                  type="button"
                  onClick={() => setShowCancelModal(true)}
                  disabled={cancellingShowtime}
                  className="w-full mt-4 py-3.5 px-4 bg-red-600 hover:bg-red-500 active:scale-[0.99] text-white transition-all duration-150 flex flex-col items-center justify-center gap-1 shadow-lg shadow-red-600/30 border border-red-500/50 group cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed select-none"
                >
                  <div className="flex items-center justify-center gap-2">
                    <AlertTriangle className="h-4 w-4 shrink-0 text-white group-hover:scale-110 transition-transform" />
                    <span className="font-sans font-black uppercase text-xs tracking-wider text-white">
                      {(showtimeSummary?.soldTicketsCount || 0) > 0
                        ? 'Xác nhận hủy suất & hoàn tiền'
                        : 'Xác nhận hủy suất chiếu'}
                    </span>
                  </div>
                  {(showtimeSummary?.soldTicketsCount || 0) > 0 ? (
                    <div className="flex items-center justify-center gap-1.5 text-[11px] font-mono text-red-100">
                      <span>Cần hoàn trả:</span>
                      <strong className="font-bold text-white bg-black/30 px-1.5 py-0.5 rounded border border-white/10">
                        {fmtVND(showtimeSummary?.totalRefundAmount ?? 0)}
                      </strong>
                      <span className="text-red-200">({showtimeSummary?.soldTicketsCount} vé)</span>
                    </div>
                  ) : (
                    <div className="text-[10px] font-mono text-red-200/80">
                      (0 vé đã bán • Không phát sinh hoàn tiền)
                    </div>
                  )}
                </button>
              )}
            </div>
          </div>

          {/* CONFIRMATION MODAL */}
          <AnimatePresence>
            {showCancelModal && (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
                <motion.div
                  initial={{ scale: 0.95, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0.95, opacity: 0 }}
                  className="w-full max-w-md border border-red-500/50 bg-[#111] p-6 space-y-5 text-white"
                >
                  <div className="flex items-center gap-3 border-b border-white/10 pb-4">
                    <div className="p-3 bg-red-500/10 border border-red-500/30 text-red-400 rounded-none">
                      <AlertTriangle className="h-6 w-6" />
                    </div>
                    <div>
                      <h3 className="text-sm font-sans font-black uppercase tracking-wide text-white">
                        {(showtimeSummary?.soldTicketsCount || 0) > 0 ? 'Xác nhận Hủy Suất & Hoàn Tiền CineWallet' : 'Xác nhận Hủy Suất Chiếu'}
                      </h3>
                      <p className="text-[10px] font-mono text-neutral-300">
                        {(showtimeSummary?.soldTicketsCount || 0) > 0
                          ? 'Thao tác này không thể hoàn tác! Tiền sẽ được hoàn 100% về CineWallet.'
                          : 'Thao tác này không thể hoàn tác! Suất chiếu 0 vé sẽ được hủy ngay lập tức.'}
                      </p>
                    </div>
                  </div>

                  <div className="space-y-2 text-xs font-sans text-neutral-200 bg-black/40 p-3.5 border border-white/[0.06]">
                    <div>Suất chiếu: <strong className="text-white">#{selectedShowtimeObj?.id} • {selectedShowtimeObj?.movie?.title}</strong></div>
                    <div>Phòng chiếu: <strong className="text-white">{selectedShowtimeObj?.room?.name}</strong></div>
                    <div>Giờ chiếu: <strong className="text-amber-400 font-mono">{fmtDateTime(selectedShowtimeObj?.startTime)}</strong></div>
                    <div>
                      Số vé bị ảnh hưởng: <strong className="text-white">{showtimeSummary?.soldTicketsCount ?? 0} vé</strong>
                      {(showtimeSummary?.paidBookingsCount || 0) > 0 && (
                        <span className="text-neutral-400 font-normal ml-1">({showtimeSummary.paidBookingsCount} đơn)</span>
                      )}
                    </div>
                    <div>
                      Tổng tiền hoàn về: <strong className={`font-mono text-sm ${(showtimeSummary?.soldTicketsCount || 0) > 0 ? 'text-emerald-400' : 'text-neutral-400'}`}>
                        {fmtVND((showtimeSummary?.soldTicketsCount || 0) > 0 ? (showtimeSummary?.totalRefundAmount ?? 0) : 0)}
                      </strong>
                    </div>
                    <div>Lý do: <span className="text-amber-300 italic">{selectedPresetReason}</span></div>
                  </div>

                  <div className="flex items-center justify-end gap-3 pt-2">
                    <button
                      onClick={() => setShowCancelModal(false)}
                      disabled={cancellingShowtime}
                      className="px-4 py-2 text-xs font-sans font-bold uppercase tracking-wider text-neutral-400 hover:text-white border border-white/10 hover:border-white/30"
                    >
                      Hủy bỏ
                    </button>
                    <button
                      onClick={handleExecuteCancelShowtime}
                      disabled={cancellingShowtime}
                      className="px-5 py-2 text-xs font-sans font-black uppercase tracking-wider bg-red-600 hover:bg-red-500 text-white flex items-center gap-2 disabled:opacity-50"
                    >
                      {cancellingShowtime ? (
                        <>
                          <RefreshCw className="h-3.5 w-3.5 animate-spin" /> {(showtimeSummary?.soldTicketsCount || 0) > 0 ? 'Đang hoàn tiền...' : 'Đang hủy suất...'}
                        </>
                      ) : (
                        <>
                          <CheckCircle2 className="h-3.5 w-3.5" /> {(showtimeSummary?.soldTicketsCount || 0) > 0 ? 'Đồng ý Hủy & Hoàn Tiền' : 'Đồng ý Hủy Suất Chiếu'}
                        </>
                      )}
                    </button>
                  </div>
                                </motion.div>
              </div>
            )}
          </AnimatePresence>
        </div>
      )}

      {/* ===================================================================== */}
      {/* TAB 3: BÁO CÁO HOÀN TIỀN (REFUND REPORT & AUDIT) */}
      {/* ===================================================================== */}
      {activeTab === 'refund-report' && (
        <div className="space-y-6 animate-fade-in">
          {/* TOOLBAR */}
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-[#0E0E0E] p-4 border border-white/[0.08]">
            <div className="flex flex-wrap items-center gap-3">
              {/* DATE PICKERS */}
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-mono text-neutral-400 uppercase">Từ ngày:</span>
                <VietnameseDatePicker
                  value={fromDate}
                  onChange={setFromDate}
                  placeholder="Từ ngày"
                />
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-mono text-neutral-400 uppercase">Đến ngày:</span>
                <VietnameseDatePicker
                  value={toDate}
                  onChange={setToDate}
                  placeholder="Đến ngày"
                />
              </div>

              {/* SEARCH INPUT */}
              <div className="relative min-w-[200px]">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-neutral-500" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Tìm mã vé, khách, phim..."
                  className="w-full pl-8 pr-3 py-1.5 border border-white/10 bg-black text-xs text-white focus:border-amber-500 focus:outline-none font-mono placeholder:text-neutral-600"
                />
              </div>
            </div>

            {/* ACTION BUTTONS */}
            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={fetchReport}
                disabled={loading}
                className="flex items-center gap-2 border border-white/10 bg-black px-3.5 py-2 text-[10px] font-sans font-black uppercase tracking-wider text-neutral-300 transition hover:border-amber-500 hover:text-white disabled:opacity-50"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} /> Làm mới
              </button>
              <button
                onClick={handleExportCSV}
                className="flex items-center gap-2 border border-emerald-500/40 bg-emerald-950/20 px-3.5 py-2 text-[10px] font-sans font-black uppercase tracking-wider text-emerald-300 transition hover:bg-emerald-500 hover:text-black"
              >
                <Download className="h-3.5 w-3.5" /> Xuất Excel / CSV
              </button>
              <button
                onClick={() => window.print()}
                className="flex items-center gap-2 border border-amber-500/50 bg-amber-500/10 px-3.5 py-2 text-[10px] font-sans font-black uppercase tracking-wider text-amber-300 transition hover:bg-amber-500 hover:text-black"
              >
                <Printer className="h-3.5 w-3.5" /> In báo cáo
              </button>
            </div>
          </div>

          {/* KPI METRICS CARDS */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              {
                label: 'Tổng tiền đã hoàn trả',
                value: fmtVND(report?.totalRefundedAmount ?? 0),
                desc: '100% hoàn ví CineWallet',
                icon: DollarSign,
                color: 'text-emerald-400',
                border: 'border-emerald-500/20',
              },
              {
                label: 'Suất chiếu sự cố đã xử lý',
                value: report?.totalCancelledShowtimes ?? 0,
                desc: 'Suất chiếu bị hủy tại rạp',
                icon: AlertTriangle,
                color: 'text-amber-400',
                border: 'border-amber-500/20',
              },
              {
                label: 'Số đơn vé đã hoàn tiền',
                value: report?.totalRefundedBookings ?? 0,
                desc: 'Tổng số đơn hàng hủy',
                icon: Ticket,
                color: 'text-cyan-400',
                border: 'border-cyan-500/20',
              },
              {
                label: 'Khách hàng nhận hoàn tiền',
                value: report?.totalRefundedUsers ?? 0,
                desc: 'Khách hàng được đền bù',
                icon: User,
                color: 'text-purple-400',
                border: 'border-purple-500/20',
              },
            ].map((kpi, idx) => (
              <div key={idx} className={`p-4 border ${kpi.border} bg-[#0E0E0E] flex items-start justify-between gap-3`}>
                <div>
                  <div className="text-[10px] font-mono uppercase tracking-wider text-neutral-400">{kpi.label}</div>
                  <div className={`text-xl md:text-2xl font-mono font-black mt-1 ${kpi.color}`}>{kpi.value}</div>
                  <div className="text-[10px] text-neutral-500 font-sans mt-0.5">{kpi.desc}</div>
                </div>
                <div className="p-2 border border-white/10 bg-black text-neutral-400">
                  <kpi.icon className="h-4 w-4" />
                </div>
              </div>
            ))}
          </div>

          {/* REPORT CONTENT LIST */}
          {error && (
            <div className="p-4 border border-red-500/30 bg-red-950/20 text-xs font-mono text-red-300">
              ⚠️ {error}
            </div>
          )}

          <div className="space-y-4">
            <div className="flex items-center justify-between text-xs font-mono uppercase text-neutral-400 border-b border-white/[0.06] pb-2">
              <span>Danh sách sự cố & chi tiết hoàn tiền ({filteredIncidents.length}):</span>
              <span className="text-neutral-500">Bấm vào suất chiếu để xem danh sách khách nhận tiền</span>
            </div>

            {loading ? (
              <div className="p-12 text-center text-xs text-neutral-400 font-mono flex items-center justify-center gap-2">
                <RefreshCw className="h-4 w-4 animate-spin text-amber-500" /> Đang cập nhật báo cáo hoàn tiền...
              </div>
            ) : filteredIncidents.length === 0 ? (
              <div className="p-12 text-center border border-dashed border-white/10 text-xs text-neutral-400 font-mono">
                Không tìm thấy dữ liệu hoàn tiền nào phù hợp với bộ lọc tìm kiếm.
              </div>
            ) : (
              filteredIncidents.map((incident) => {
                const isExpanded = expandedShowtimeId === incident.showtimeId;
                return (
                  <div
                    key={incident.showtimeId}
                    className="border border-white/[0.08] bg-[#0E0E0E] transition hover:border-white/20"
                  >
                    {/* ACCORDION HEADER */}
                    <div
                      onClick={() => setExpandedShowtimeId(isExpanded ? null : incident.showtimeId)}
                      className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 cursor-pointer select-none"
                    >
                      <div className="space-y-1.5">
                        <div className="flex items-center gap-2">
                          <span className="border border-red-500/40 bg-red-950/30 text-red-400 text-[9px] font-mono font-black px-2 py-0.5 uppercase tracking-wider flex items-center gap-1">
                            <AlertTriangle className="h-2.5 w-2.5" /> Đã hủy do sự cố
                          </span>
                          <span className="text-[10px] text-neutral-400 font-mono">
                            | {incident.cinemaName || cinemaName} — {incident.roomName || 'Phòng chiếu'}
                          </span>
                        </div>

                        <h3 className="text-sm font-sans font-black uppercase tracking-wide text-neutral-200">
                          {incident.movieTitle || 'Phim chưa xác định'}
                        </h3>

                        <div className="flex flex-wrap items-center gap-4 text-[11px] text-neutral-400 font-mono">
                          <span className="flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            Giờ chiếu: <strong className="text-neutral-200">{fmtDateTime(incident.showtimeStart)}</strong>
                          </span>
                          <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            Hủy lúc: <strong className="text-neutral-200">{fmtDateTime(incident.cancelledAt)}</strong>
                          </span>
                        </div>

                        <div className="text-[10px] text-amber-300 font-sans border border-amber-500/20 bg-amber-950/20 px-2.5 py-1 inline-block">
                          Lý do: {incident.cancellationReason || 'Sự cố vận hành rạp'}
                        </div>
                      </div>

                      <div className="flex items-center gap-5">
                        <div className="text-right">
                          <div className="text-[9px] font-mono uppercase text-neutral-400 tracking-wider">Tổng hoàn trả</div>
                          <div className="text-base font-mono font-black text-emerald-400">
                            {fmtVND(incident.totalRefundedAmount)}
                          </div>
                          <div className="text-[10px] text-neutral-400 font-mono">
                            {incident.refundedBookingsCount} đơn ({incident.refundedUsers?.length ?? 0} vé)
                          </div>
                        </div>
                        <button className="p-2 border border-white/10 text-neutral-400 hover:text-white hover:border-white/30 transition">
                          {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                        </button>
                      </div>
                    </div>

                    {/* EXPANDED TABLE */}
                    <AnimatePresence>
                      {isExpanded && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.2 }}
                          className="border-t border-white/[0.06]"
                        >
                          <div className="px-4 py-3 flex items-center justify-between bg-[#060606]">
                            <span className="text-[9px] font-mono uppercase font-black tracking-widest text-neutral-300 flex items-center gap-2">
                              <User className="h-3 w-3" /> Danh sách khách hàng nhận hoàn tiền ({incident.refundedUsers?.length ?? 0})
                            </span>
                            <span className="text-[9px] text-neutral-400 font-mono">
                              Tự động chuyển vào Ví CineWallet
                            </span>
                          </div>

                          {(!incident.refundedUsers || incident.refundedUsers.length === 0) ? (
                            <div className="p-6 text-center text-xs text-neutral-400 italic">
                              Chưa có đơn hàng nào bị ảnh hưởng trong suất chiếu này.
                            </div>
                          ) : (
                            <div className="overflow-x-auto">
                              <table className="min-w-full divide-y divide-white/[0.05] text-left text-xs font-sans">
                                <thead className="bg-[#0B0B0B] text-[9px] uppercase tracking-[0.15em] text-neutral-400 font-bold">
                                  <tr>
                                    <th className="px-4 py-3">#</th>
                                    <th className="px-4 py-3">Mã vé / Booking</th>
                                    <th className="px-4 py-3">Khách hàng</th>
                                    <th className="px-4 py-3">Liên hệ</th>
                                    <th className="px-4 py-3">Ghế</th>
                                    <th className="px-4 py-3">Số tiền hoàn</th>
                                    <th className="px-4 py-3">Phương thức</th>
                                    <th className="px-4 py-3">Thời gian hoàn</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-white/[0.03] text-neutral-300">
                                  {incident.refundedUsers.map((u, uIdx) => (
                                    <tr key={u.bookingId || uIdx} className="transition hover:bg-white/[0.02]">
                                      <td className="px-4 py-3 font-mono text-neutral-400">{uIdx + 1}</td>
                                      <td className="px-4 py-3">
                                        <span className="font-mono font-black text-amber-400 border border-amber-500/30 bg-amber-950/20 px-2 py-0.5 text-[10px]">
                                          {u.bookingCode || `BK-${u.bookingId}`}
                                        </span>
                                      </td>
                                      <td className="px-4 py-3">
                                        <p className="font-bold text-white">{u.userName || 'Khách hàng'}</p>
                                        <p className="text-[10px] font-mono text-neutral-400">ID: USER-{u.userId}</p>
                                      </td>
                                      <td className="px-4 py-3 font-mono text-[11px]">
                                        <div>{u.userEmail || '—'}</div>
                                        <div className="text-neutral-400">{u.userPhone || '—'}</div>
                                      </td>
                                      <td className="px-4 py-3 font-mono text-[11px] text-amber-300">{u.seatLabels || '—'}</td>
                                      <td className="px-4 py-3 font-mono font-black text-emerald-400">{fmtVND(u.amount)}</td>
                                      <td className="px-4 py-3">
                                        <span className="border border-emerald-500/30 bg-emerald-950/20 text-emerald-300 text-[9px] font-mono font-black px-2 py-0.5 uppercase tracking-wider">
                                          {u.refundMethod === 'CINEWALLET' ? 'VÍ CINEWALLET' : (u.refundMethod || 'CINEWALLET')}
                                        </span>
                                      </td>
                                      <td className="px-4 py-3 font-mono text-[11px] text-neutral-400">{fmtDateTime(u.refundedAt)}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          )}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
