import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { toast } from 'sonner';
import {
  AlertTriangle,
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

const Field = ({ label, subtitle, children }) => (
  <label className="space-y-1.5 block">
    <div className="flex items-baseline justify-between">
      <span className="block text-[10.5px] font-black uppercase tracking-[0.14em] text-neutral-200">{label}</span>
      {subtitle && <span className="text-[9.5px] text-neutral-400 font-normal">{subtitle}</span>}
    </div>
    {children}
  </label>
);

const inputClass = 'w-full border border-white/[0.08] bg-black px-3 py-2.5 text-xs text-white font-mono outline-none transition focus:border-amber-500/80 focus:ring-1 focus:ring-amber-500/40';

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

  const updateConfig = (field, value) => {
    setConfig((prev) => ({ ...prev, [field]: value }));
  };

  const updateExpiryDate = (value) => {
    const date = new Date(`${value}T${normalizeExpiryTime(config.expiryTime)}`);
    setConfig((prev) => ({
      ...prev,
      expiryDate: value,
      expiryMonth: Number.isNaN(date.getTime()) ? prev.expiryMonth : date.getMonth() + 1,
      expiryDay: Number.isNaN(date.getTime()) ? prev.expiryDay : date.getDate()
    }));
  };

  const saveConfig = async (event) => {
    event.preventDefault();
    const token = getAdminToken?.();
    if (!token) return;

    const earningRatePercent = Number(config.earningRatePercent);
    if (!Number.isFinite(earningRatePercent) || earningRatePercent < 0 || earningRatePercent > 100) {
      showToast?.('Tỷ lệ tích điểm phải nằm trong khoảng 0% đến 100%.', 'error');
      return;
    }

    const redemptionRatePercent = Number(config.redemptionRatePercent ?? 100);
    if (!Number.isFinite(redemptionRatePercent) || redemptionRatePercent < 0 || redemptionRatePercent > 500) {
      showToast?.('Tỷ lệ quy đổi điểm phải nằm trong khoảng 0% đến 500%.', 'error');
      return;
    }

    const maxRedemptionPercent = Number(config.maxRedemptionPercent ?? 100);
    if (!Number.isFinite(maxRedemptionPercent) || maxRedemptionPercent <= 0 || maxRedemptionPercent > 100) {
      showToast?.('Giảm giá tối đa bằng điểm phải từ 1% đến 100%.', 'error');
      return;
    }

    const redemptionPoints = Number(config.redemptionPoints);
    if (!Number.isInteger(redemptionPoints) || redemptionPoints < 1) {
      showToast?.('Số điểm quy đổi phải là số nguyên lớn hơn hoặc bằng 1.', 'error');
      return;
    }

    const redemptionValueVnd = Number(config.redemptionValueVnd);
    if (!Number.isFinite(redemptionValueVnd) || redemptionValueVnd <= 0) {
      showToast?.('Giá trị giảm phải lớn hơn 0 VND.', 'error');
      return;
    }

    const expiryDate = getExpiryDateValue(config);
    const expiryTime = normalizeExpiryTime(config.expiryTime);

    if (isExpiryDateTimeTooSoon(expiryDate, expiryTime)) {
      showToast?.('Ngày và giờ reset điểm phải sau thời điểm hiện tại ít nhất 15 phút.', 'error');
      return;
    }

    setSavingConfig(true);
    try {
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

      const targetLabel = targetCinemaId
        ? (currentCinema?.name || `Chi nhánh #${targetCinemaId}`)
        : 'Toàn hệ thống';
      showToast?.(`✓ Đã lưu cấu hình điểm cho [${targetLabel}] thành công!`, 'success');
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
              {cinemas.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} {c.city ? `(${c.city})` : ''}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* 3. Main Configuration & Audit Grid */}
      <div className="grid gap-4 xl:grid-cols-[360px_minmax(0,1fr)]">
        <form onSubmit={saveConfig} noValidate className="border border-white/[0.05] bg-neutral-950 p-4 space-y-4">
          <div className="flex items-center justify-between border-b border-white/[0.05] pb-3">
            <div>
              <h4 className="text-[11px] font-black uppercase tracking-[0.16em] text-white">
                Cấu hình tỷ lệ điểm
              </h4>
              <p className="text-[9.5px] text-neutral-400 mt-0.5">
                Áp dụng cho: <strong className="text-amber-400 font-mono">{currentCinema ? currentCinema.name : 'Toàn hệ thống'}</strong>
              </p>
            </div>
            <CalendarClock className="h-4 w-4 text-amber-400 shrink-0" />
          </div>

          <div className="space-y-3.5">
            {/* Tỷ lệ tích điểm % */}
            <Field label="Tỷ lệ tích điểm (%)" subtitle="Tích điểm khi mua vé/bắp nước">
              <div className="relative">
                <input
                  className={`${inputClass} pr-8`}
                  type="number"
                  min="0"
                  max="100"
                  step="0.01"
                  value={config.earningRatePercent}
                  onChange={(e) => updateConfig('earningRatePercent', e.target.value)}
                />
                <Percent className="pointer-events-none absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-neutral-400" />
              </div>
              <p className="text-[9.5px] text-neutral-400 mt-1">
                Ví dụ: 1% nghĩa là đơn hàng 100.000đ tích được 1.000 CinePoints.
              </p>
            </Field>

            {/* Tỷ lệ % quy đổi điểm */}
            <Field label="Tỷ lệ % quy đổi điểm (%)" subtitle="Quy đổi điểm thành tiền giảm giá">
              <div className="relative">
                <input
                  className={`${inputClass} pr-8 font-black text-amber-300`}
                  type="number"
                  min="0"
                  max="500"
                  step="0.01"
                  value={config.redemptionRatePercent ?? 100}
                  onChange={(e) => updateConfig('redemptionRatePercent', e.target.value)}
                />
                <Percent className="pointer-events-none absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-amber-400" />
              </div>
              {/* Preview trực quan công thức quy đổi */}
              <div className="p-2.5 rounded bg-black/60 border border-amber-500/20 text-[10px] space-y-1">
                <div className="flex items-center justify-between text-neutral-300">
                  <span>Ví dụ dùng: <strong className="font-mono text-white">{previewPointsExample.toLocaleString()} điểm</strong></span>
                  <span className="text-emerald-400 font-mono font-bold">-{previewVndReduced.toLocaleString()}đ giảm giá</span>
                </div>
                <p className="text-[9px] text-neutral-500">
                  {previewRedemptionRate === 100
                    ? '✓ Tỷ lệ chuẩn: 1 CinePoint = 1 VNĐ (100% giá trị).'
                    : `Hệ số quy đổi: ${previewRedemptionRate}%. (1 điểm = ${(previewRedemptionRate / 100).toFixed(2)}đ).`}
                </p>
              </div>
            </Field>

            {/* Giảm giá tối đa bằng điểm % */}
            <Field label="% Giảm giá tối đa bằng điểm (%)" subtitle="Khống chế trần giảm trên đơn">
              <div className="relative">
                <input
                  className={`${inputClass} pr-8`}
                  type="number"
                  min="1"
                  max="100"
                  step="1"
                  value={config.maxRedemptionPercent ?? 100}
                  onChange={(e) => updateConfig('maxRedemptionPercent', e.target.value)}
                />
                <Percent className="pointer-events-none absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-neutral-400" />
              </div>
              <p className="text-[9.5px] text-neutral-400 mt-1">
                Mặc định 100% = cho phép trừ tối đa toàn bộ hóa đơn. 50% = tối đa nửa tiền đơn.
              </p>
            </Field>

            {/* Quy đổi mốc chuẩn */}
            <div className="grid gap-2 grid-cols-2">
              <Field label="Điểm quy đổi mốc" subtitle="Mốc chuẩn">
                <input
                  className={inputClass}
                  type="number"
                  min="1"
                  step="1"
                  value={config.redemptionPoints}
                  onChange={(e) => updateConfig('redemptionPoints', e.target.value)}
                />
              </Field>
              <Field label="Giá trị giảm (VND)" subtitle="Tương ứng mốc">
                <input
                  className={inputClass}
                  type="number"
                  min="1"
                  step="1"
                  value={config.redemptionValueVnd}
                  onChange={(e) => updateConfig('redemptionValueVnd', e.target.value)}
                />
              </Field>
            </div>

            {/* Reset điểm định kỳ */}
            <div className="border-t border-white/[0.05] pt-3">
              <span className="block text-[10px] font-bold uppercase tracking-wider text-neutral-400 mb-2">
                Chính sách hết hạn điểm định kỳ
              </span>
              <div className="grid gap-2 grid-cols-2">
                <Field label="Ngày reset">
                  <div className="relative">
                    <Calendar className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-amber-400" />
                    <input
                      className={`${inputClass} pl-8`}
                      type="date"
                      min={getTodayDateInputValue()}
                      value={getExpiryDateValue(config)}
                      onChange={(e) => updateExpiryDate(e.target.value)}
                    />
                  </div>
                </Field>
                <Field label="Giờ reset">
                  <div className="relative">
                    <Clock className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-amber-400" />
                    <input
                      className={`${inputClass} pl-8`}
                      type="time"
                      step="1"
                      value={normalizeExpiryTime(config.expiryTime)}
                      onChange={(e) => updateConfig('expiryTime', normalizeExpiryTime(e.target.value))}
                    />
                  </div>
                </Field>
              </div>
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

        {/* 4. Audit Trail Table */}
        <div className="space-y-4">
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
                    transactions.items.map((tx) => {
                      const meta = transactionMeta[tx.type] || {
                        label: tx.type,
                        className: 'border-neutral-500/30 bg-neutral-900 text-neutral-300'
                      };
                      return (
                        <tr key={tx.id} className="hover:bg-white/[0.02] transition">
                          <td className="p-3 font-mono text-[11px] text-neutral-400 whitespace-nowrap">
                            {formatDateTime(tx.occurredAt || tx.createdAt)}
                          </td>
                          <td className="p-3">
                            <div className="font-bold text-white text-[11px]">
                              {tx.customerName || `User #${tx.userId}`}
                            </div>
                            <div className="text-[10px] text-neutral-400 font-mono">
                              {tx.customerEmail || tx.customerPhone || ''}
                            </div>
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
                  <span className="text-neutral-400">Tổng tiền:</span>
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
