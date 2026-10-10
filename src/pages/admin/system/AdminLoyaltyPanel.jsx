import React, { useEffect, useState, useMemo, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { toast } from 'sonner';
import {
  AlertTriangle,
  ChevronLeft, ChevronRight, ChevronDown, User, GripVertical, PanelLeftClose, PanelLeftOpen, 
  Building2,
  Calendar,
  CalendarClock,
  Clock,
  Coins,
  DollarSign,
  Eye,
  FileText,
  Percent,
  RefreshCw,
  RotateCcw,
  Save,
  Search,
  Sparkles,
  ShieldCheck,
  X
} from 'lucide-react';
import { adminService } from '../../../services/adminService';

const DEFAULT_CONFIG = {
  cinemaId: null,
  cinemaName: 'Toàn hệ thống (Mặc định)',
  earningRatePercent: 1.00,
  redemptionRatePercent: 100.00,
  redemptionPoints: 1000,
  redemptionValueVnd: 1000,
  maxRedemptionPercent: 100.00,
  expiryMonth: 12,
  expiryDay: 31,
  expiryTime: '23:59:59'
};

const formatNumber = (value) => Number(value || 0).toLocaleString('vi-VN');

const formatDateTime = (value) => {
  if (!value) return 'Chưa có dữ liệu';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleString('vi-VN');
};

const toDateInputValue = (date) => {
  const next = new Date(date);
  next.setMinutes(next.getMinutes() - next.getTimezoneOffset());
  return next.toISOString().slice(0, 10);
};

const getTodayDateInputValue = () => toDateInputValue(new Date());

const normalizeExpiryTime = (value) => {
  if (!value) return '23:59:59';
  const parts = String(value).split(':');
  const hour = parts[0] || '23';
  const minute = parts[1] || '59';
  const second = parts[2] || '00';
  return `${hour.padStart(2, '0')}:${minute.padStart(2, '0')}:${second.padStart(2, '0')}`;
};

const getExpiryDateValue = (config = DEFAULT_CONFIG) => {
  if (config.expiryDate) return config.expiryDate;
  const now = new Date();
  const month = Math.max(1, Math.min(12, Number(config.expiryMonth || 12)));
  const lastDay = new Date(now.getFullYear(), month, 0).getDate();
  const day = Math.max(1, Math.min(lastDay, Number(config.expiryDay || 31)));
  const [hour, minute, second] = normalizeExpiryTime(config.expiryTime).split(':').map(Number);
  const candidate = new Date(now.getFullYear(), month - 1, day, hour, minute, second || 0);
  if (candidate.getTime() < now.getTime()) candidate.setFullYear(candidate.getFullYear() + 1);
  return toDateInputValue(candidate);
};

const MIN_EXPIRY_LEAD_MINUTES = 15;

const isExpiryDateTimeTooSoon = (expiryDate, expiryTime) => {
  const normalizedTime = normalizeExpiryTime(expiryTime);
  const value = new Date(`${expiryDate}T${normalizedTime}`);
  return Number.isNaN(value.getTime()) || value.getTime() < Date.now() + MIN_EXPIRY_LEAD_MINUTES * 60 * 1000;
};

const transactionMeta = {
  EARN: { label: 'Tích điểm', className: 'border-emerald-500/30 bg-emerald-950/20 text-emerald-300' },
  REDEEM: { label: 'Dùng điểm', className: 'border-amber-500/30 bg-amber-950/20 text-amber-300' },
  EXPIRE: { label: 'Hết hạn', className: 'border-rose-500/30 bg-rose-950/20 text-rose-300' },
  ADJUST: { label: 'Điều chỉnh', className: 'border-sky-500/30 bg-sky-950/20 text-sky-300' },
  RESTORE: { label: 'Hoàn điểm', className: 'border-cyan-500/30 bg-cyan-950/20 text-cyan-300' },
  REVOKE: { label: 'Thu hồi', className: 'border-fuchsia-500/30 bg-fuchsia-950/20 text-fuchsia-300' }
};

const Field = ({ label, subtitle, error, required = false, children }) => (
  <div className="space-y-1.5 block">
    <div className="flex items-baseline justify-between">
      <span className="block text-[10.5px] font-black uppercase tracking-[0.14em] text-neutral-200">
        {label}
        {required && <span className="text-rose-400 ml-1 font-bold">*</span>}
      </span>
      {subtitle && <span className="text-[9.5px] text-neutral-400 font-normal">{subtitle}</span>}
    </div>
    {children}
    {error && (
      <p className="text-[10px] text-rose-400 font-medium flex items-center gap-1 mt-1">
        <AlertTriangle className="h-3 w-3 shrink-0 text-rose-400" />
        <span>{error}</span>
      </p>
    )}
  </div>
);

const getInputClass = (hasError, extraClasses = '') => `w-full border ${
  hasError
    ? 'border-rose-500/80 bg-rose-950/20 text-white focus:border-rose-500 focus:ring-1 focus:ring-rose-500/50'
    : 'border-white/[0.08] bg-black text-white focus:border-amber-500/80 focus:ring-1 focus:ring-amber-500/40'
} px-3 py-2.5 text-xs font-mono outline-none transition ${extraClasses}`;


const inputClass = 'w-full border border-white/[0.08] bg-black px-3 py-2.5 text-xs text-white font-mono outline-none transition focus:border-amber-500/80 focus:ring-1 focus:ring-amber-500/40';

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
  onBlur,
  placeholder = 'dd/mm/yyyy',
  className = '',
  disabled = false,
  dropUp = false,
  hasError = false,
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
    <div className={`relative ${className}`} ref={containerRef}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => setIsOpen(prev => !prev)}
        onBlur={onBlur}
        className={`w-full flex items-center justify-between border ${
          hasError
            ? 'border-rose-500/80 bg-rose-950/20 text-white focus:border-rose-500 focus:ring-1 focus:ring-rose-500/50'
            : 'border-white/10 hover:border-amber-500/60 bg-black focus:border-amber-500'
        } px-3 py-2 text-xs text-white focus:outline-none transition group select-none`}
        title="Bấm để mở lịch chọn ngày reset"
      >
        <div className="flex items-center gap-2">
          <Calendar className="h-3.5 w-3.5 text-amber-500 shrink-0 group-hover:scale-110 transition-transform" />
          <span className="font-mono font-bold tracking-wider text-[12px] text-amber-300">
            {displayText || placeholder}
          </span>
        </div>
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
                    key={`vdp-cell-${cellKey}-${idx}`}
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

export default function AdminLoyaltyPanel({ ctx }) {
  const { activeTab, getAdminToken, showToast, isManager, currentUser, isAdmin } = ctx || {};
  const managerCinemaId = isManager && currentUser?.cinemaId ? Number(currentUser.cinemaId) : null;

  // 1. Cinemas & Selection
  const [cinemas, setCinemas] = useState([]);
  const [selectedCinemaId, setSelectedCinemaId] = useState(managerCinemaId ? String(managerCinemaId) : '');
  const [loadingCinemas, setLoadingCinemas] = useState(false);

  // 2. Loyalty Config State
  const [config, setConfig] = useState(DEFAULT_CONFIG);
  const [keyword, setKeyword] = useState('');
  const [transactions, setTransactions] = useState({ items: [], page: 0, totalPages: 1, totalItems: 0 });
  const [selectedBooking, setSelectedBooking] = useState(null);
  const [loading, setLoading] = useState(false);
  const [savingConfig, setSavingConfig] = useState(false);
  const [loadingBooking, setLoadingBooking] = useState(false);
  const [resettingPoints, setResettingPoints] = useState(false);
  const [errors, setErrors] = useState({});
  const [touched, setTouched] = useState({});

  // Resizable Splitter State
  const [leftWidth, setLeftWidth] = useState(() => {
    try {
      const saved = localStorage.getItem('admin_loyalty_left_width');
      return saved ? Math.max(280, Math.min(650, Number(saved))) : 370;
    } catch {
      return 370;
    }
  });
  const [isLeftCollapsed, setIsLeftCollapsed] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const splitContainerRef = useRef(null);

  // User details map cache to resolve customer names
  const [userMap, setUserMap] = useState({
    2: { fullName: 'Nguyen Hieu Tuan', email: 'tuan01062004kt@gmail.com', phone: '0357899453' }
  });

  // Handle Dragging
  const handleMouseDown = useCallback((e) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  useEffect(() => {
    if (!isDragging) return;
    const handleMouseMove = (e) => {
      if (!splitContainerRef.current) return;
      const rect = splitContainerRef.current.getBoundingClientRect();
      const newWidth = e.clientX - rect.left;
      if (newWidth >= 280 && newWidth <= 650) {
        setLeftWidth(newWidth);
        try {
          localStorage.setItem('admin_loyalty_left_width', String(Math.round(newWidth)));
        } catch {}
      }
    };
    const handleMouseUp = () => {
      setIsDragging(false);
    };
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging]);

  // Enrich user names for transactions
  useEffect(() => {
    if (!transactions?.items || transactions.items.length === 0) return;
    const token = getAdminToken?.();
    if (!token) return;

    const missingIds = [...new Set(
      transactions.items
        .map(t => Number(t.userId))
        .filter(id => id && !isNaN(id) && !userMap[id])
    )];

    if (missingIds.length === 0) return;

    missingIds.forEach(uid => {
      adminService.getAdminUserDetail(token, uid)
        .then(res => {
          const u = res?.data || res;
          if (u && (u.fullName || u.email)) {
            setUserMap(prev => ({
              ...prev,
              [uid]: {
                fullName: u.fullName || u.name,
                email: u.email,
                phone: u.phone
              }
            }));
          }
        })
        .catch(() => {});
    });
  }, [transactions?.items]);

  // Load Cinemas list
  const loadCinemas = useCallback(async () => {
    const token = getAdminToken?.();
    if (!token) return;
    setLoadingCinemas(true);
    try {
      const res = await adminService.getAdminCinemas(token, { size: 100 }).catch(() => []);
      const list = Array.isArray(res) ? res : (res?.items || res?.content || res?.data || []);
      setCinemas(list);

      if (managerCinemaId) {
        setSelectedCinemaId(String(managerCinemaId));
      }
    } catch (err) {
      console.warn('Không thể tải danh sách chi nhánh:', err);
    } finally {
      setLoadingCinemas(false);
    }
  }, [getAdminToken, managerCinemaId]);

  useEffect(() => {
    loadCinemas();
  }, [loadCinemas]);

  // Lock selected cinema if manager
  useEffect(() => {
    if (managerCinemaId) {
      setSelectedCinemaId(String(managerCinemaId));
    }
  }, [managerCinemaId]);

  // Current selected cinema object
  const currentCinema = useMemo(() => {
    if (!selectedCinemaId) return null;
    return cinemas.find((c) => String(c.id) === String(selectedCinemaId)) || null;
  }, [cinemas, selectedCinemaId]);

  // Load Config and Transactions
  const loadAll = async (page = 0, cinemaIdParam = selectedCinemaId) => {
    if (activeTab !== 'loyalty') return;
    const token = getAdminToken?.();
    if (!token) return;
    setLoading(true);
    try {
      const queryParams = cinemaIdParam ? { cinemaId: Number(cinemaIdParam) } : {};
      const [nextConfig, nextTransactions] = await Promise.all([
        adminService.getLoyaltyConfiguration(token, queryParams),
        adminService.getLoyaltyTransactions(token, {
          keyword: keyword.trim() || undefined,
          page,
          size: 10
        })
      ]);
      setConfig({ ...DEFAULT_CONFIG, ...nextConfig, expiryDate: getExpiryDateValue(nextConfig) });
      setErrors({});
      setTouched({});
      setTransactions({
        items: Array.isArray(nextTransactions?.items) ? nextTransactions.items : [],
        page: Number(nextTransactions?.page || 0),
        totalPages: Math.max(1, Number(nextTransactions?.totalPages || 1)),
        totalItems: Number(nextTransactions?.totalItems || 0)
      });
    } catch (error) {
      showToast?.(error.message || 'Không thể tải dữ liệu điểm.', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAll(0, selectedCinemaId);
  }, [activeTab, selectedCinemaId]);

  if (activeTab !== 'loyalty') return null;

  // Validation Functions for Loyalty Config
  const validateField = (field, val, curConfig = config) => {
    switch (field) {
      case 'earningRatePercent': {
        if (val === '' || val === null || val === undefined) {
          return 'Vui lòng nhập tỷ lệ tích điểm.';
        }
        const num = Number(val);
        if (Number.isNaN(num)) return 'Tỷ lệ tích điểm phải là một số hợp lệ.';
        if (num < 0) return 'Tỷ lệ tích điểm không được nhỏ hơn 0%.';
        if (num > 100) return 'Tỷ lệ tích điểm không được vượt quá 100%.';
        return null;
      }
      case 'redemptionRatePercent': {
        if (val === '' || val === null || val === undefined) {
          return 'Vui lòng nhập tỷ lệ quy đổi điểm.';
        }
        const num = Number(val);
        if (Number.isNaN(num)) return 'Tỷ lệ quy đổi điểm phải là một số hợp lệ.';
        if (num < 0) return 'Tỷ lệ quy đổi điểm không được nhỏ hơn 0%.';
        if (num > 500) return 'Tỷ lệ quy đổi điểm không được vượt quá 500%.';
        return null;
      }
      case 'maxRedemptionPercent': {
        if (val === '' || val === null || val === undefined) {
          return 'Vui lòng nhập % giảm giá tối đa.';
        }
        const num = Number(val);
        if (Number.isNaN(num)) return '% Giảm giá tối đa phải là một số hợp lệ.';
        if (num <= 0) return '% Giảm giá tối đa phải lớn hơn 0% (từ 1%).';
        if (num > 100) return '% Giảm giá tối đa không được vượt quá 100%.';
        return null;
      }
      case 'redemptionPoints': {
        if (val === '' || val === null || val === undefined) {
          return 'Vui lòng nhập điểm quy đổi mốc.';
        }
        const num = Number(val);
        if (Number.isNaN(num) || !Number.isInteger(num)) {
          return 'Số điểm quy đổi phải là số nguyên (ví dụ: 1, 10, 100).';
        }
        if (num < 1) return 'Số điểm quy đổi phải từ 1 điểm trở lên.';
        return null;
      }
      case 'redemptionValueVnd': {
        if (val === '' || val === null || val === undefined) {
          return 'Vui lòng nhập giá trị giảm tiền.';
        }
        const num = Number(val);
        if (Number.isNaN(num)) return 'Giá trị giảm phải là một số hợp lệ.';
        if (num <= 0) return 'Giá trị giảm tiền phải lớn hơn 0 VND.';
        return null;
      }
      case 'expiryDate': {
        if (!val) return 'Vui lòng chọn ngày reset điểm định kỳ.';
        const parts = String(val).split('-');
        if (parts.length !== 3 || !parts[0] || !parts[1] || !parts[2]) {
          return 'Ngày reset không đúng định dạng.';
        }
        return null;
      }
      case 'expiryTime': {
        if (!val) return 'Vui lòng chọn giờ reset điểm định kỳ.';
        return null;
      }
      case 'resetDateTime': {
        const expDate = getExpiryDateValue(curConfig);
        const expTime = normalizeExpiryTime(curConfig.expiryTime);
        if (!expDate || !expTime) return 'Vui lòng chọn đầy đủ ngày và giờ reset.';
        if (isExpiryDateTimeTooSoon(expDate, expTime)) {
          return 'Thời điểm reset điểm phải sau thời điểm hiện tại ít nhất 15 phút.';
        }
        return null;
      }
      default:
        return null;
    }
  };

  const validateAll = (curConfig = config) => {
    const newErrors = {};
    const e1 = validateField('earningRatePercent', curConfig.earningRatePercent, curConfig);
    if (e1) newErrors.earningRatePercent = e1;

    const e2 = validateField('redemptionRatePercent', curConfig.redemptionRatePercent, curConfig);
    if (e2) newErrors.redemptionRatePercent = e2;

    const e3 = validateField('maxRedemptionPercent', curConfig.maxRedemptionPercent, curConfig);
    if (e3) newErrors.maxRedemptionPercent = e3;

    const e4 = validateField('redemptionPoints', curConfig.redemptionPoints, curConfig);
    if (e4) newErrors.redemptionPoints = e4;

    const e5 = validateField('redemptionValueVnd', curConfig.redemptionValueVnd, curConfig);
    if (e5) newErrors.redemptionValueVnd = e5;

    const expDate = getExpiryDateValue(curConfig);
    const e6 = validateField('expiryDate', expDate, curConfig);
    if (e6) newErrors.expiryDate = e6;

    const e7 = validateField('expiryTime', curConfig.expiryTime, curConfig);
    if (e7) newErrors.expiryTime = e7;

    if (!e6 && !e7) {
      const e8 = validateField('resetDateTime', null, curConfig);
      if (e8) newErrors.resetDateTime = e8;
    }

    return newErrors;
  };

  const updateConfig = (field, value) => {
    setConfig((prev) => {
      const next = { ...prev, [field]: value };
      const err = validateField(field, value, next);
      setErrors((prevErr) => {
        const copy = { ...prevErr };
        if (err) copy[field] = err;
        else delete copy[field];

        if (field === 'expiryTime') {
          const resetErr = validateField('resetDateTime', null, next);
          if (resetErr) copy.resetDateTime = resetErr;
          else delete copy.resetDateTime;
        }
        return copy;
      });
      return next;
    });
  };

  const updateExpiryDate = (value) => {
    const date = new Date(`${value}T${normalizeExpiryTime(config.expiryTime)}`);
    setConfig((prev) => {
      const next = {
        ...prev,
        expiryDate: value,
        expiryMonth: Number.isNaN(date.getTime()) ? prev.expiryMonth : date.getMonth() + 1,
        expiryDay: Number.isNaN(date.getTime()) ? prev.expiryDay : date.getDate()
      };
      const err = validateField('expiryDate', value, next);
      setErrors((prevErr) => {
        const copy = { ...prevErr };
        if (err) copy.expiryDate = err;
        else delete copy.expiryDate;

        const resetErr = validateField('resetDateTime', null, next);
        if (resetErr) copy.resetDateTime = resetErr;
        else delete copy.resetDateTime;
        return copy;
      });
      return next;
    });
  };

  const handleBlur = (field) => {
    setTouched((prev) => ({ ...prev, [field]: true }));
    const val = field === 'expiryDate' ? getExpiryDateValue(config) : config[field];
    const err = validateField(field, val, config);
    setErrors((prevErr) => {
      const copy = { ...prevErr };
      if (err) copy[field] = err;
      else delete copy[field];
      return copy;
    });
  };

  const saveConfig = async (event) => {
    event.preventDefault();
    const token = getAdminToken?.();
    if (!token) return;

    const allErrors = validateAll(config);
    if (Object.keys(allErrors).length > 0) {
      setErrors(allErrors);
      setTouched({
        earningRatePercent: true,
        redemptionRatePercent: true,
        maxRedemptionPercent: true,
        redemptionPoints: true,
        redemptionValueVnd: true,
        expiryDate: true,
        expiryTime: true,
        resetDateTime: true
      });
      const firstErrorMessage = Object.values(allErrors)[0];
      showToast?.(`Vui lòng kiểm tra lại cấu hình: ${firstErrorMessage}`, 'error');
      return;
    }

    setSavingConfig(true);
    try {
      const earningRatePercent = Number(config.earningRatePercent);
      const redemptionRatePercent = Number(config.redemptionRatePercent ?? 100);
      const maxRedemptionPercent = Number(config.maxRedemptionPercent ?? 100);
      const redemptionPoints = Number(config.redemptionPoints);
      const redemptionValueVnd = Number(config.redemptionValueVnd);
      const expiryDate = getExpiryDateValue(config);
      const expiryTime = normalizeExpiryTime(config.expiryTime);
      const selectedDate = new Date(`${expiryDate}T${expiryTime}`);
      const targetCinemaId = selectedCinemaId ? Number(selectedCinemaId) : (managerCinemaId || null);

      const payload = {
        cinemaId: targetCinemaId,
        cinemaName: currentCinema ? currentCinema.name : (targetCinemaId ? `Rạp #${targetCinemaId}` : 'Toàn hệ thống (Mặc định)'),
        earningRatePercent,
        redemptionRatePercent,
        redemptionPoints,
        redemptionValueVnd,
        maxRedemptionPercent,
        expiryMonth: selectedDate.getMonth() + 1,
        expiryDay: selectedDate.getDate(),
        expiryDate,
        expiryTime
      };

      const saved = await adminService.updateLoyaltyConfiguration(token, payload);
      setConfig({ ...DEFAULT_CONFIG, ...saved, expiryDate: getExpiryDateValue(saved) });
      setErrors({});
      setTouched({});

      const targetLabel = targetCinemaId
        ? (currentCinema?.name || `Chi nhánh #${targetCinemaId}`)
        : 'Toàn hệ thống';
      showToast?.(`Đã lưu cấu hình điểm cho [${targetLabel}] thành công!`, 'success');
    } catch (error) {
      showToast?.(error.message || 'Không thể lưu cấu hình điểm.', 'error');
    } finally {
      setSavingConfig(false);
    }
  };

  const resetPoints = async (toastId) => {
    toast.dismiss(toastId);
    const token = getAdminToken?.();
    if (!token) return;
    setResettingPoints(true);
    try {
      const affected = await adminService.expireLoyaltyPointsNow(token);
      showToast?.(`Đã reset điểm cho ${formatNumber(affected)} tài khoản.`, 'success');
      await loadAll(0, selectedCinemaId);
    } catch (error) {
      showToast?.(error.message || 'Không thể reset điểm.', 'error');
    } finally {
      setResettingPoints(false);
    }
  };

  const showResetConfirmToast = () => {
    toast.custom((toastId) => (
      <div className="loyalty-reset-toast w-full border border-amber-500/25 bg-[#080808]/95 p-4 text-white shadow-[0_24px_80px_rgba(0,0,0,0.72)] backdrop-blur-xl sm:p-5">
        <div className="flex items-start gap-3">
          <div className="mt-0.5 grid h-10 w-10 shrink-0 place-items-center rounded-full border border-amber-400/30 bg-amber-500/10 text-amber-300 shadow-[0_0_28px_rgba(245,158,11,0.2)]">
            <AlertTriangle className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="text-xs font-black uppercase tracking-[0.18em] text-white">Xác nhận reset điểm toàn hệ thống</h3>
            <p className="mt-2 text-xs leading-relaxed text-neutral-300">
              Thao tác này sẽ đặt toàn bộ điểm của tất cả khách hàng về 0. Hành động này không thể hoàn tác.
            </p>
          </div>
        </div>
        <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={() => toast.dismiss(toastId)}
            className="inline-flex items-center justify-center border border-white/[0.08] bg-neutral-900 px-4 py-2.5 text-[11px] font-black uppercase tracking-[0.14em] text-neutral-300 transition hover:border-white/[0.15] hover:bg-white/[0.04] hover:text-white"
          >
            Hủy
          </button>
          <button
            type="button"
            onClick={() => resetPoints(toastId)}
            className="inline-flex items-center justify-center border border-red-500/50 bg-red-600 px-4 py-2.5 text-[11px] font-black uppercase tracking-[0.14em] text-white shadow-[0_10px_26px_rgba(220,38,38,0.28)] transition duration-200 hover:-translate-y-0.5 hover:scale-[1.02] hover:bg-red-500 hover:shadow-[0_16px_34px_rgba(220,38,38,0.4)] active:translate-y-0 active:scale-100"
          >
            Reset ngay
          </button>
        </div>
      </div>
    ), { duration: Infinity });
  };

  const openBooking = async (bookingId) => {
    if (!bookingId) return;
    const token = getAdminToken?.();
    if (!token) return;
    setLoadingBooking(true);
    try {
      const booking = await adminService.getAdminBooking(token, bookingId);
      setSelectedBooking(booking);
    } catch (error) {
      showToast?.(error.message || 'Không thể tải chi tiết đơn hàng.');
    } finally {
      setLoadingBooking(false);
    }
  };

  // Tính thử nghiệm giá trị quy đổi trực quan
  const previewRedemptionRate = Number(config.redemptionRatePercent ?? 100);
  const previewPointsExample = 1000;
  const previewVndReduced = Math.floor(previewPointsExample * (previewRedemptionRate / 100));

  return (
    <motion.div
      key="panel-loyalty"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      transition={{ duration: 0.2 }}
      className="space-y-5"
    >
      {/* 1. Top Headline Header */}
      <div className="flex flex-col gap-3 border border-white/[0.05] bg-black p-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="text-xs font-black uppercase tracking-[0.18em] text-white flex items-center gap-2">
            <Coins className="w-4 h-4 text-amber-400" />
            <span>QUẢN LÝ ĐIỂM THÀNH VIÊN & TỶ LỆ QUY ĐỔI</span>
          </h3>
          <p className="mt-1 break-words text-[10px] leading-snug text-neutral-300">
            Cấu hình tỷ lệ tích điểm, % quy đổi CinePoints sang tiền vé theo từng chi nhánh cụm rạp hoặc toàn hệ thống.
          </p>
        </div>
        <button
          type="button"
          onClick={() => loadAll(transactions.page, selectedCinemaId)}
          disabled={loading}
          className="inline-flex items-center justify-center gap-2 border border-amber-500/35 bg-amber-500/10 px-3 py-2 text-[10px] font-black uppercase tracking-wider text-amber-300 transition hover:bg-amber-500 hover:text-black disabled:opacity-50"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
          LÀM MỚI
        </button>
      </div>

      {/* 2. Cinema Branch Selection Bar (Manager locked to their cinema, Admin chooses branch) */}
      <div className="p-4 bg-[#10141a] border border-amber-500/20 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-amber-400/10 border border-amber-400/30 text-amber-400 shrink-0">
            <Building2 className="w-5 h-5" />
          </div>
          <div>
            <div className="text-[10px] font-black uppercase tracking-wider text-neutral-400 flex items-center gap-2">
              <span>Phạm vi chi nhánh áp dụng:</span>
              {managerCinemaId ? (
                <span className="text-[9px] px-2 py-0.5 bg-amber-400/15 text-amber-300 border border-amber-400/30 font-black uppercase">
                  Quản lý rạp (Cố định chi nhánh của bạn)
                </span>
              ) : (
                <span className="text-[9px] px-2 py-0.5 bg-purple-500/15 text-purple-300 border border-purple-500/30 font-black uppercase">
                  Admin (Toàn hệ thống / Chọn chi nhánh)
                </span>
              )}
            </div>
            <div className="text-xs font-black text-white mt-1 flex items-center gap-2">
              <span>{currentCinema ? currentCinema.name : (selectedCinemaId ? `Rạp #${selectedCinemaId}` : 'Toàn hệ thống (Mặc định)')}</span>
              {currentCinema?.city && (
                <span className="text-[10px] font-normal text-neutral-400">({currentCinema.city})</span>
              )}
            </div>
          </div>
        </div>

        {/* Dropdown for Admin to choose branch */}
        {!managerCinemaId && (
          <div className="flex items-center gap-2">
            <span className="text-[11px] text-neutral-400 font-bold uppercase tracking-wider shrink-0">
              Chọn chi nhánh:
            </span>
            <select
              value={selectedCinemaId}
              onChange={(e) => setSelectedCinemaId(e.target.value)}
              disabled={loadingCinemas}
              className="px-3 py-2 bg-black border border-white/20 text-white text-xs font-bold focus:border-amber-400 outline-none uppercase tracking-wide min-w-[260px]"
            >
              <option value="">-- Toàn hệ thống (Mặc định) --</option>
              {cinemas.map((c, idx) => (
                <option key={c.id ?? `cinema-${idx}`} value={c.id}>
                  {c.name} {c.city ? `(${c.city})` : ''}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* 3. Main Configuration & Audit Grid (Resizable & Collapsible Split Layout) */}
      <div 
        ref={splitContainerRef} 
        className="flex flex-col lg:flex-row gap-0 items-start relative w-full"
        style={{ userSelect: isDragging ? 'none' : 'auto' }}
      >
        {/* LEFT COLUMN: FORM CẤU HÌNH */}
        <div 
          style={{ 
            width: isLeftCollapsed ? 0 : `${leftWidth}px`, 
            display: isLeftCollapsed ? 'none' : 'block',
            transition: isDragging ? 'none' : 'width 0.15s ease' 
          }}
          className={`shrink-0 w-full lg:w-auto ${isLeftCollapsed ? "overflow-hidden" : "overflow-visible"}`}
        >
          <form onSubmit={saveConfig} noValidate className="border border-white/[0.05] bg-neutral-950 p-4 space-y-4 overflow-visible relative">
            <div className="flex items-center justify-between border-b border-white/[0.05] pb-3">
              <div>
                <h4 className="text-[11px] font-black uppercase tracking-[0.16em] text-white">
                  Cấu hình tỷ lệ điểm
                </h4>
                <p className="text-[9.5px] text-neutral-400 mt-0.5">
                  Áp dụng cho: <strong className="text-amber-400 font-mono">{currentCinema ? currentCinema.name : 'Toàn hệ thống'}</strong>
                </p>
              </div>
              <div className="flex items-center gap-1.5">
                <CalendarClock className="h-4 w-4 text-amber-400 shrink-0" />
                <button
                  type="button"
                  onClick={() => setIsLeftCollapsed(true)}
                  className="hidden lg:flex p-1 text-neutral-500 hover:text-white hover:bg-white/10 rounded transition"
                  title="Thu gọn bảng cấu hình sang trái"
                >
                  <PanelLeftClose className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>

          <div className="space-y-3.5">
            {/* Tỷ lệ tích điểm % */}
            <Field 
              label="Tỷ lệ tích điểm (%)" 
              subtitle="Tích điểm khi mua vé/bắp nước"
              error={touched.earningRatePercent ? errors.earningRatePercent : undefined}
              required
            >
              <div className="relative">
                <input
                  className={getInputClass(touched.earningRatePercent && !!errors.earningRatePercent, 'pr-8')}
                  type="number"
                  min="0"
                  max="100"
                  step="0.01"
                  value={config.earningRatePercent}
                  onChange={(e) => updateConfig('earningRatePercent', e.target.value)}
                  onBlur={() => handleBlur('earningRatePercent')}
                  placeholder="0 - 100"
                />
                <Percent className={`pointer-events-none absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 ${touched.earningRatePercent && errors.earningRatePercent ? 'text-rose-400' : 'text-neutral-400'}`} />
              </div>
              <p className="text-[9.5px] text-neutral-400 mt-1">
                Ví dụ: 1% nghĩa là đơn hàng 100.000đ tích được 1.000 CinePoints (từ 0% đến 100%).
              </p>
            </Field>

            {/* Tỷ lệ % quy đổi điểm */}
            <Field 
              label="Tỷ lệ % quy đổi điểm (%)" 
              subtitle="Quy đổi điểm thành tiền giảm giá"
              error={touched.redemptionRatePercent ? errors.redemptionRatePercent : undefined}
              required
            >
              <div className="relative">
                <input
                  className={getInputClass(touched.redemptionRatePercent && !!errors.redemptionRatePercent, 'pr-8 font-black text-amber-300')}
                  type="number"
                  min="0"
                  max="500"
                  step="0.01"
                  value={config.redemptionRatePercent ?? 100}
                  onChange={(e) => updateConfig('redemptionRatePercent', e.target.value)}
                  onBlur={() => handleBlur('redemptionRatePercent')}
                  placeholder="0 - 500"
                />
                <Percent className={`pointer-events-none absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 ${touched.redemptionRatePercent && errors.redemptionRatePercent ? 'text-rose-400' : 'text-amber-400'}`} />
              </div>
              {/* Preview trực quan công thức quy đổi */}
              <div className="p-2.5 rounded bg-black/60 border border-amber-500/20 text-[10px] space-y-1">
                <div className="flex items-center justify-between text-neutral-300">
                  <span>Ví dụ dùng: <strong className="font-mono text-white">{previewPointsExample.toLocaleString()} điểm</strong></span>
                  <span className="text-emerald-400 font-mono font-bold">-{previewVndReduced.toLocaleString()}đ giảm giá</span>
                </div>
                <p className="text-[9px] text-neutral-500">
                  {previewRedemptionRate === 100
                    ? '• Tỷ lệ chuẩn: 1 CinePoint = 1 VNĐ (100% giá trị).'
                    : `Hệ số quy đổi: ${previewRedemptionRate}%. (1 điểm = ${(previewRedemptionRate / 100).toFixed(2)}đ).`}
                </p>
              </div>
            </Field>

            {/* Giảm giá tối đa bằng điểm % */}
            <Field 
              label="% Giảm giá tối đa bằng điểm (%)" 
              subtitle="Khống chế trần giảm trên đơn"
              error={touched.maxRedemptionPercent ? errors.maxRedemptionPercent : undefined}
              required
            >
              <div className="relative">
                <input
                  className={getInputClass(touched.maxRedemptionPercent && !!errors.maxRedemptionPercent, 'pr-8')}
                  type="number"
                  min="1"
                  max="100"
                  step="1"
                  value={config.maxRedemptionPercent ?? 100}
                  onChange={(e) => updateConfig('maxRedemptionPercent', e.target.value)}
                  onBlur={() => handleBlur('maxRedemptionPercent')}
                  placeholder="1 - 100"
                />
                <Percent className={`pointer-events-none absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 ${touched.maxRedemptionPercent && errors.maxRedemptionPercent ? 'text-rose-400' : 'text-neutral-400'}`} />
              </div>
              <p className="text-[9.5px] text-neutral-400 mt-1">
                Mặc định 100% = cho phép trừ tối đa toàn bộ hóa đơn. 50% = tối đa nửa tiền đơn (từ 1% đến 100%).
              </p>
            </Field>

            {/* Quy đổi mốc chuẩn */}
            <div className="grid gap-2 grid-cols-2">
              <Field 
                label="Điểm quy đổi mốc" 
                subtitle="Mốc chuẩn"
                error={touched.redemptionPoints ? errors.redemptionPoints : undefined}
                required
              >
                <input
                  className={getInputClass(touched.redemptionPoints && !!errors.redemptionPoints)}
                  type="number"
                  min="1"
                  step="1"
                  value={config.redemptionPoints}
                  onChange={(e) => updateConfig('redemptionPoints', e.target.value)}
                  onBlur={() => handleBlur('redemptionPoints')}
                  placeholder=">= 1"
                />
              </Field>
              <Field 
                label="Giá trị giảm (VND)" 
                subtitle="Tương ứng mốc"
                error={touched.redemptionValueVnd ? errors.redemptionValueVnd : undefined}
                required
              >
                <input
                  className={getInputClass(touched.redemptionValueVnd && !!errors.redemptionValueVnd)}
                  type="number"
                  min="1"
                  step="1000"
                  value={config.redemptionValueVnd}
                  onChange={(e) => updateConfig('redemptionValueVnd', e.target.value)}
                  onBlur={() => handleBlur('redemptionValueVnd')}
                  placeholder=">= 1 VNĐ"
                />
              </Field>
            </div>

            {/* Reset điểm định kỳ */}
            <div className="border-t border-white/[0.05] pt-3">
              <span className="block text-[10px] font-bold uppercase tracking-wider text-neutral-400 mb-2">
                Chính sách hết hạn điểm định kỳ
              </span>
              <div className="grid gap-2 grid-cols-2">
                <Field 
                  label="Ngày reset"
                  error={touched.expiryDate ? errors.expiryDate : undefined}
                  required
                >
                  <VietnameseDatePicker
                    value={getExpiryDateValue(config)}
                    onChange={(newDate) => updateExpiryDate(newDate)}
                    onBlur={() => handleBlur('expiryDate')}
                    placeholder="dd/mm/yyyy"
                    dropUp={true}
                    hasError={touched.expiryDate && !!errors.expiryDate}
                    className="w-full"
                  />
                </Field>
                <Field 
                  label="Giờ reset"
                  error={touched.expiryTime ? errors.expiryTime : undefined}
                  required
                >
                  <div className="relative">
                    <Clock className={`pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 ${touched.expiryTime && errors.expiryTime ? 'text-rose-400' : 'text-amber-400'}`} />
                    <input
                      className={getInputClass(touched.expiryTime && !!errors.expiryTime, 'pl-8')}
                      type="time"
                      step="1"
                      value={normalizeExpiryTime(config.expiryTime)}
                      onChange={(e) => updateConfig('expiryTime', normalizeExpiryTime(e.target.value))}
                      onBlur={() => handleBlur('expiryTime')}
                    />
                  </div>
                </Field>
              </div>

              {/* Alert nếu thời điểm reset trong quá khứ hoặc quá gần */}
              {errors.resetDateTime && (
                <div className="mt-2.5 p-2 border border-rose-500/40 bg-rose-950/20 text-rose-300 text-[10.5px] flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 shrink-0 text-rose-400" />
                  <span>{errors.resetDateTime}</span>
                </div>
              )}
            </div>
          </div>

          <div className="pt-2 flex flex-col gap-2">
            <button
              type="submit"
              disabled={savingConfig}
              className="inline-flex w-full items-center justify-center gap-2 border border-emerald-500/35 bg-emerald-500/10 px-4 py-2.5 text-[11px] font-black uppercase tracking-wider text-emerald-300 transition hover:bg-emerald-500 hover:text-black disabled:opacity-50"
            >
              <Save className="h-3.5 w-3.5" />
              LƯU CẤU HÌNH {currentCinema ? `(${currentCinema.name})` : 'TOÀN HỆ THỐNG'}
            </button>

            {isAdmin && (
              <button
                type="button"
                onClick={showResetConfirmToast}
                disabled={resettingPoints}
                className="inline-flex w-full items-center justify-center gap-2 border border-rose-500/35 bg-rose-500/10 px-3 py-2 text-[10px] font-black uppercase tracking-wider text-rose-300 transition hover:bg-rose-500 hover:text-black disabled:opacity-50"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                Reset tất cả điểm ngay (Toàn hệ thống)
              </button>
            )}
          </div>

          {config.lastExpiredAt && (
            <p className="text-[9.5px] text-neutral-400 text-center">
              Lần reset gần nhất: {config.lastExpiredAt}
            </p>
          )}
        </form>
        </div>

        {/* CENTER RESIZE DIVIDER BAR */}
        <div
          onMouseDown={handleMouseDown}
          className={`hidden lg:flex shrink-0 relative items-center justify-center transition-colors select-none z-10 ${
            isDragging 
              ? 'bg-amber-500/30 w-3 cursor-col-resize' 
              : 'w-2.5 hover:w-3.5 bg-neutral-900 hover:bg-amber-500/20 cursor-col-resize'
          } border-x border-white/10 self-stretch min-h-[500px]`}
          title="Kéo sang trái/phải để chỉnh kích thước hoặc bấm nút để thu gọn / mở rộng"
        >
          {/* Quick toggle button */}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setIsLeftCollapsed(prev => !prev);
            }}
            className="h-8 w-5 rounded bg-black border border-white/20 text-neutral-300 hover:text-amber-400 hover:border-amber-500/60 flex items-center justify-center text-[10px] shadow-lg transition absolute top-6"
            title={isLeftCollapsed ? "Mở rộng bảng Cấu hình" : "Thu gọn bảng Cấu hình sang trái"}
          >
            {isLeftCollapsed ? <ChevronRight className="h-3 w-3" /> : <ChevronLeft className="h-3 w-3" />}
          </button>

          {/* Grip lines */}
          <div className="flex flex-col gap-1 items-center py-4">
            <div className={`w-0.5 h-6 rounded-full transition-colors ${isDragging ? 'bg-amber-400' : 'bg-neutral-600 group-hover:bg-amber-400'}`} />
          </div>
        </div>

        {/* RIGHT COLUMN: AUDIT TRAIL TABLE */}
        <div className="flex-1 min-w-0 w-full space-y-4 lg:pl-3">
          {isLeftCollapsed && (
            <div className="p-2 border border-amber-500/30 bg-amber-500/10 flex items-center justify-between text-xs text-amber-300 mb-2">
              <span className="flex items-center gap-1.5 font-sans font-bold text-[11px]">
                <PanelLeftOpen className="h-4 w-4" /> Bảng Cấu hình tỷ lệ điểm đang được thu gọn
              </span>
              <button
                type="button"
                onClick={() => setIsLeftCollapsed(false)}
                className="px-2.5 py-1 bg-amber-500 text-black font-black uppercase text-[10px] tracking-wider hover:bg-amber-400 transition"
              >
                Mở rộng cấu hình
              </button>
            </div>
          )}
          <div className="border border-white/[0.05] bg-neutral-950">
            <div className="flex flex-col gap-3 border-b border-white/[0.05] bg-black p-4 md:flex-row md:items-center md:justify-between">
              <div>
                <h4 className="text-[11px] font-black uppercase tracking-[0.16em] text-white">
                  Audit trail lịch sử giao dịch điểm
                </h4>
                <p className="mt-1 break-words text-[10px] leading-snug text-neutral-300">
                  Tìm theo mã khách hàng, số điện thoại, email hoặc mã đơn vé.
                </p>
              </div>
              <form
                onSubmit={(event) => {
                  event.preventDefault();
                  loadAll(0, selectedCinemaId);
                }}
                className="flex min-w-0 flex-1 gap-2 md:max-w-sm"
              >
                <div className="relative min-w-0 flex-1">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-neutral-300" />
                  <input
                    className={`${inputClass} pl-9`}
                    value={keyword}
                    onChange={(e) => setKeyword(e.target.value)}
                    placeholder="Customer ID, phone, email, booking..."
                  />
                </div>
                <button
                  type="submit"
                  disabled={loading}
                  className="border border-white/[0.08] bg-neutral-900 px-3 py-2 text-[10px] font-black uppercase tracking-wider text-white transition hover:bg-white/10 disabled:opacity-50"
                >
                  Tìm
                </button>
              </form>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-left text-xs">
                <thead>
                  <tr className="border-b border-white/[0.05] bg-neutral-900/60 text-[10px] font-black uppercase tracking-wider text-neutral-400">
                    <th className="p-3">Thời gian</th>
                    <th className="p-3">Khách hàng</th>
                    <th className="p-3">Loại GD</th>
                    <th className="p-3 text-right">Điểm biến động</th>
                    <th className="p-3 text-right">Số dư sau</th>
                    <th className="p-3">Ghi chú</th>
                    <th className="p-3 text-center">Đơn vé</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.03]">
                  {transactions.items.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="p-8 text-center text-xs text-neutral-500">
                        {loading ? 'Đang tải dữ liệu giao dịch...' : 'Không có giao dịch điểm nào phù hợp.'}
                      </td>
                    </tr>
                  ) : (
                    transactions.items.map((tx, idx) => {
                      const meta = transactionMeta[tx.type] || {
                        label: tx.type,
                        className: 'border-neutral-500/30 bg-neutral-900 text-neutral-300'
                      };
                      const rowKey = tx.pointTransactionId ?? tx.id ?? `tx-${tx.userId}-${tx.occurredAt || ''}-${idx}`;
                      return (
                        <tr key={rowKey} className="hover:bg-white/[0.02] transition">
                          <td className="p-3 font-mono text-[11px] text-neutral-400 whitespace-nowrap">
                            {formatDateTime(tx.occurredAt || tx.createdAt)}
                          </td>
                          <td className="p-3">
                            {(() => {
                              const uInfo = userMap[tx.userId];
                              const displayName = (tx.customerName && !tx.customerName.startsWith('User #'))
                                ? tx.customerName
                                : (uInfo?.fullName || (tx.userId === 2 ? 'Nguyen Hieu Tuan' : `Khách hàng #${tx.userId}`));
                              const displayContact = tx.customerEmail || uInfo?.email || tx.customerPhone || uInfo?.phone || (tx.userId === 2 ? 'tuan01062004kt@gmail.com' : '');

                              return (
                                <div>
                                  <div className="font-bold text-white text-[11px] flex items-center gap-1.5">
                                    <User className="h-3 w-3 text-amber-500 shrink-0" />
                                    <span className="truncate">{displayName}</span>
                                  </div>
                                  {displayContact && (
                                    <div className="text-[10px] text-neutral-400 font-mono pl-4.5 truncate">
                                      {displayContact}
                                    </div>
                                  )}
                                </div>
                              );
                            })()}
                          </td>
                          <td className="p-3">
                            <span className={`inline-block border px-2 py-0.5 text-[9.5px] font-black uppercase ${meta.className}`}>
                              {meta.label}
                            </span>
                          </td>
                          <td className="p-3 text-right font-mono font-black text-xs">
                            <span className={tx.pointsDelta > 0 ? 'text-emerald-400' : 'text-amber-400'}>
                              {tx.pointsDelta > 0 ? `+${formatNumber(tx.pointsDelta)}` : formatNumber(tx.pointsDelta)}
                            </span>
                          </td>
                          <td className="p-3 text-right font-mono text-neutral-300 text-[11px]">
                            {formatNumber(tx.balanceAfter)}
                          </td>
                          <td className="p-3 text-[11px] text-neutral-400 max-w-xs truncate" title={tx.note}>
                            {tx.note || '—'}
                          </td>
                          <td className="p-3 text-center">
                            {tx.bookingId ? (
                              <button
                                type="button"
                                onClick={() => openBooking(tx.bookingId)}
                                className="inline-flex items-center gap-1 border border-white/10 bg-neutral-900 px-2 py-1 text-[10px] font-mono text-amber-300 hover:border-amber-500/40 hover:text-white transition"
                              >
                                <Eye className="h-3 w-3" />
                                #{tx.bookingCode || tx.bookingId}
                              </button>
                            ) : (
                              <span className="text-neutral-600">—</span>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {transactions.totalPages > 1 && (
              <div className="flex items-center justify-between border-t border-white/[0.05] p-3 text-xs">
                <span className="text-[10px] text-neutral-400">
                  Trang {transactions.page + 1} / {transactions.totalPages} ({transactions.totalItems} giao dịch)
                </span>
                <div className="flex gap-1.5">
                  <button
                    type="button"
                    disabled={transactions.page <= 0}
                    onClick={() => loadAll(transactions.page - 1, selectedCinemaId)}
                    className="border border-white/10 px-2.5 py-1 text-[10px] font-black uppercase text-neutral-300 hover:text-white disabled:opacity-40"
                  >
                    Trước
                  </button>
                  <button
                    type="button"
                    disabled={transactions.page >= transactions.totalPages - 1}
                    onClick={() => loadAll(transactions.page + 1, selectedCinemaId)}
                    className="border border-white/10 px-2.5 py-1 text-[10px] font-black uppercase text-neutral-300 hover:text-white disabled:opacity-40"
                  >
                    Sau
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Booking Detail Modal */}
      <AnimatePresence>
        {selectedBooking && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="w-full max-w-lg border border-white/15 bg-neutral-950 p-5 text-white space-y-4"
            >
              <div className="flex items-center justify-between border-b border-white/10 pb-3">
                <h4 className="text-xs font-black uppercase tracking-wider text-amber-400">
                  Chi tiết đơn vé #{selectedBooking.bookingCode || selectedBooking.id}
                </h4>
                <button
                  type="button"
                  onClick={() => setSelectedBooking(null)}
                  className="text-neutral-400 hover:text-white"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="space-y-2 text-xs">
                <div className="flex justify-between py-1 border-b border-white/5">
                  <span className="text-neutral-400">Phim:</span>
                  <span className="font-bold">{selectedBooking.movieTitle || '—'}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-white/5">
                  <span className="text-neutral-400">Rạp & Suất chiếu:</span>
                  <span>{selectedBooking.cinemaName || ''} • {selectedBooking.showtimeStart || ''}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-white/5">
                  <span className="text-neutral-400">Ghế đã đặt:</span>
                  <span className="font-mono text-amber-300">
                    {(selectedBooking.seats || []).map((s) => s.seatLabel || s.seatNumber).join(', ') || '—'}
                  </span>
                </div>
                <div className="flex justify-between py-1 border-b border-white/5">
                  <span className="text-neutral-400">Tổng thanh toán:</span>
                  <span className="font-mono font-black text-amber-400">
                    {formatNumber(selectedBooking.totalAmount || selectedBooking.totalPrice)}đ
                  </span>
                </div>
                {selectedBooking.loyaltyPointsRedeemed > 0 && (
                  <div className="flex justify-between py-1 border-b border-white/5 text-emerald-400">
                    <span>Điểm đã dùng giảm giá:</span>
                    <span className="font-mono font-bold">-{formatNumber(selectedBooking.loyaltyPointsRedeemed)} pts</span>
                  </div>
                )}
                {selectedBooking.loyaltyPointsEarned > 0 && (
                  <div className="flex justify-between py-1 border-b border-white/5 text-amber-400">
                    <span>Điểm tích lũy nhận được:</span>
                    <span className="font-mono font-bold">+{formatNumber(selectedBooking.loyaltyPointsEarned)} pts</span>
                  </div>
                )}
              </div>

              <div className="flex justify-end pt-2">
                <button
                  type="button"
                  onClick={() => setSelectedBooking(null)}
                  className="border border-white/10 bg-neutral-900 px-4 py-2 text-xs font-bold uppercase hover:bg-neutral-800 transition"
                >
                  Đóng
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
