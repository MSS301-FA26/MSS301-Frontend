import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  AlertTriangle,
  ArrowRight,
  Camera,
  CameraOff,
  Check,
  CheckCircle2,
  ChevronRight,
  Clock3,
  Copy,
  Filter,
  MapPin,
  PackageCheck,
  Phone,
  Popcorn,
  Printer,
  QrCode,
  RefreshCw,
  Search,
  ShieldCheck,
  ShoppingBag,
  Sparkles,
  User,
  XCircle,
} from 'lucide-react';
import jsQR from 'jsqr';
import { motion } from 'motion/react';
import { staffService } from '../../services/staffService';

const FOOD_PAGE_SIZE = 10;

const FOOD_STATUS_META = {
  ACTIVE: { label: 'Mở bán', className: 'bg-emerald-400/10 text-emerald-300 border-emerald-500/30' },
  LOW_STOCK: { label: 'Sắp hết', className: 'bg-purple-500/10 text-purple-300 border-purple-500/30' },
  OUT_OF_STOCK: { label: 'Hết món', className: 'bg-rose-500/10 text-rose-300 border-rose-500/30' },
  INACTIVE: { label: 'Ngừng bán', className: 'bg-rose-500/10 text-rose-300 border-rose-500/30' },
};

const getFoodStatusMeta = (status) => FOOD_STATUS_META[status] || FOOD_STATUS_META.OUT_OF_STOCK;

const formatCurrency = (value) => `${Number(value || 0).toLocaleString('vi-VN')}đ`;

const formatDateTime = (value) => {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleString('vi-VN', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
};

const formatTimeAgo = (value) => {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const diffSec = Math.floor((Date.now() - date.getTime()) / 1000);
  if (diffSec < 60) return `${diffSec} giây trước`;
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin} phút trước`;
  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) return `${diffHours} giờ trước`;
  return date.toLocaleDateString('vi-VN');
};

const normalizeSearch = (value) => String(value || '')
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .replace(/đ/g, 'd')
  .replace(/Đ/g, 'D')
  .toLowerCase()
  .trim();

export default function StaffFoodCheckInPanel({
  token,
  assignedCinemaId,
  activeCinema,
  currentUser,
  showToast,
  onPendingFnbCountChange,
  staffFoodItems = [],
  staffFoodCombos = [],
  onUpdateFoodStatus,
  savingStaffFoodKey = '',
  onReloadFoods,
}) {
  // ── States ────────────────────────────────────────────────────────────────
  const [fnbOrders, setFnbOrders] = useState([]);
  const [isLoadingOrders, setIsLoadingOrders] = useState(false);
  const [ordersError, setOrdersError] = useState('');
  const [ordersFilter, setOrdersFilter] = useState('ALL'); // 'ALL' | 'PAID' | 'PICKED_UP'
  const [ordersSearch, setOrdersSearch] = useState('');

  // Lookup & Active Order State
  const [lookupInput, setLookupInput] = useState('');
  const [isLookingUp, setIsLookingUp] = useState(false);
  const [lookupError, setLookupError] = useState('');
  const [activeOrder, setActiveOrder] = useState(null);
  const [preparedItems, setPreparedItems] = useState({}); // { [itemIndex]: boolean }
  const [isPickingUp, setIsPickingUp] = useState(false);

  // Camera QR Scanner State
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [scannerError, setScannerError] = useState('');
  const [scannerMessage, setScannerMessage] = useState('');
  const qrVideoRef = useRef(null);
  const qrCanvasRef = useRef(null);
  const qrStreamRef = useRef(null);
  const qrScanTimerRef = useRef(null);
  const lastScannedQrRef = useRef('');

  // Print Slip Modal State
  const [printSlipOrder, setPrintSlipOrder] = useState(null);

  // Stock Management Sub-tab / Expand
  const [showStockManager, setShowStockManager] = useState(false);
  const [stockSearch, setStockSearch] = useState('');
  const [stockStatusFilter, setStockStatusFilter] = useState('ALL');
  const [stockPage, setStockPage] = useState(1);

  // ── Fetch Recent Food Orders ──────────────────────────────────────────────
  const loadRecentFoodOrders = useCallback(async (silent = false) => {
    if (!token) return;
    if (!silent) setIsLoadingOrders(true);
    setOrdersError('');
    try {
      const res = await staffService.getRecentFoodOrders(token, 50);
      const list = res?.data || (Array.isArray(res) ? res : []);
      // Filter orders belonging to assigned cinema
      const filtered = list.filter((order) => {
        if (!order.cinemaId) return true;
        return Number(order.cinemaId) === Number(assignedCinemaId);
      });
      setFnbOrders(filtered);

      const pendingCount = filtered.filter((o) => o.status === 'PAID').length;
      onPendingFnbCountChange?.(pendingCount);
    } catch (err) {
      console.warn('Lỗi tải danh sách F&B gần đây:', err);
      setOrdersError(err.message || 'Không thể tải danh sách đơn bắp nước từ máy chủ.');
    } finally {
      if (!silent) setIsLoadingOrders(false);
    }
  }, [token, assignedCinemaId, onPendingFnbCountChange]);

  useEffect(() => {
    loadRecentFoodOrders();
    const timer = setInterval(() => {
      loadRecentFoodOrders(true);
    }, 12000);
    return () => clearInterval(timer);
  }, [loadRecentFoodOrders]);

  // ── Lookup Order ──────────────────────────────────────────────────────────
  const handleLookup = async (codeToLookup) => {
    const raw = String(codeToLookup || lookupInput).trim();
    if (!raw) {
      setLookupError('Vui lòng nhập hoặc dán mã đơn bắp nước (FO...) hoặc mã booking (BK...).');
      return;
    }
    setLookupError('');
    setIsLookingUp(true);
    try {
      const res = await staffService.lookupFoodOrder(token, raw);
      const order = res?.data || res;
      if (!order || (!order.orderCode && !order.foodOrderCode && !order.id)) {
        throw new Error('Không tìm thấy thông tin đơn bắp nước với mã này.');
      }
      setActiveOrder(order);
      setLookupInput(order.orderCode || order.foodOrderCode || raw);

      // Reset preparation checklist
      const initialChecked = {};
      (order.items || []).forEach((_, idx) => {
        initialChecked[idx] = order.status === 'PICKED_UP';
      });
      setPreparedItems(initialChecked);

      // Warning if cinema mismatch
      if (order.cinemaId && assignedCinemaId && Number(order.cinemaId) !== Number(assignedCinemaId)) {
        showToast?.(`⚠️ Đơn này thuộc rạp ${order.cinemaName || `#${order.cinemaId}`}, không thuộc rạp bạn đang trực!`, 'warning');
      }
    } catch (err) {
      setLookupError(err.message || 'Không tìm thấy đơn bắp nước với mã này.');
    } finally {
      setIsLookingUp(false);
    }
  };

  // ── Confirm Pick Up ───────────────────────────────────────────────────────
  const handleConfirmPickup = async (orderToPickup = activeOrder) => {
    const targetCode = orderToPickup?.orderCode || orderToPickup?.foodOrderCode;
    if (!targetCode || isPickingUp) return;

    // Check cinema security
    if (orderToPickup?.cinemaId && assignedCinemaId && Number(orderToPickup.cinemaId) !== Number(assignedCinemaId)) {
      showToast?.(`Không thể giao món! Đơn này thuộc rạp ${orderToPickup.cinemaName || `#${orderToPickup.cinemaId}`}.`, 'error');
      return;
    }

    setIsPickingUp(true);
    try {
      const res = await staffService.pickUpFoodOrder(token, targetCode);
      const updated = res?.data || res;

      // Update active order state
      const nextOrder = {
        ...orderToPickup,
        status: 'PICKED_UP',
        pickedUpAt: updated?.pickedUpAt || new Date().toISOString(),
      };
      setActiveOrder(nextOrder);

      // Mark all items prepared
      const allChecked = {};
      (nextOrder.items || []).forEach((_, idx) => {
        allChecked[idx] = true;
      });
      setPreparedItems(allChecked);

      showToast?.(`✅ Đã giao món thành công cho đơn ${targetCode}!`);
      await loadRecentFoodOrders(true);
    } catch (err) {
      showToast?.(`Lỗi giao món: ${err.message || 'Không thể xác nhận giao món'}`, 'error');
    } finally {
      setIsPickingUp(false);
    }
  };

  // ── Camera QR Scanner ─────────────────────────────────────────────────────
  const stopQrScanner = useCallback(() => {
    if (qrScanTimerRef.current) {
      clearInterval(qrScanTimerRef.current);
      qrScanTimerRef.current = null;
    }
    if (qrStreamRef.current) {
      qrStreamRef.current.getTracks().forEach((track) => track.stop());
      qrStreamRef.current = null;
    }
    if (qrVideoRef.current) {
      qrVideoRef.current.srcObject = null;
    }
    setIsCameraOpen(false);
  }, []);

  const startQrScanner = async () => {
    setScannerError('');
    setScannerMessage('');
    lastScannedQrRef.current = '';

    if (!navigator.mediaDevices?.getUserMedia) {
      setScannerError('Trình duyệt không hỗ trợ mở camera. Hãy nhập mã đơn thủ công.');
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: {
          facingMode: { ideal: 'environment' },
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
      });
      qrStreamRef.current = stream;
      setIsCameraOpen(true);
      setScannerMessage('Đưa mã QR trên ứng dụng khách hàng vào khung để tự động tra cứu...');

      window.requestAnimationFrame(async () => {
        const video = qrVideoRef.current;
        if (!video || qrStreamRef.current !== stream) return;
        video.srcObject = stream;
        await video.play();

        qrScanTimerRef.current = window.setInterval(() => {
          if (video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) return;
          try {
            const canvas = qrCanvasRef.current;
            const width = video.videoWidth;
            const height = video.videoHeight;
            if (!canvas || !width || !height) return;

            canvas.width = width;
            canvas.height = height;
            const context = canvas.getContext('2d', { willReadFrequently: true });
            if (!context) return;

            context.drawImage(video, 0, 0, width, height);
            const imageData = context.getImageData(0, 0, width, height);
            const detected = jsQR(imageData.data, width, height, {
              inversionAttempts: 'attemptBoth',
            });
            const rawValue = detected?.data?.trim();
            if (!rawValue || rawValue === lastScannedQrRef.current) return;

            lastScannedQrRef.current = rawValue;
            stopQrScanner();
            setLookupInput(rawValue);
            void handleLookup(rawValue);
          } catch (e) {
            // ignore scan frame errors
          }
        }, 300);
      });
    } catch (err) {
      stopQrScanner();
      setScannerError(
        err.name === 'NotAllowedError'
          ? 'Cần cấp quyền truy cập camera để quét mã QR.'
          : err.message || 'Không thể khởi động camera.'
      );
    }
  };

  useEffect(() => () => stopQrScanner(), [stopQrScanner]);

  // ── Checklist Helpers ─────────────────────────────────────────────────────
  const toggleItemCheck = (idx) => {
    setPreparedItems((prev) => ({
      ...prev,
      [idx]: !prev[idx],
    }));
  };

  const handleToggleAllItems = () => {
    if (!activeOrder?.items) return;
    const allChecked = activeOrder.items.every((_, idx) => preparedItems[idx]);
    const next = {};
    activeOrder.items.forEach((_, idx) => {
      next[idx] = !allChecked;
    });
    setPreparedItems(next);
  };

  const allItemsPrepared = useMemo(() => {
    if (!activeOrder?.items || activeOrder.items.length === 0) return false;
    return activeOrder.items.every((_, idx) => preparedItems[idx]);
  }, [activeOrder, preparedItems]);

  // ── Filtered Orders Queue ─────────────────────────────────────────────────
  const filteredOrders = useMemo(() => {
    return fnbOrders.filter((order) => {
      // Status filter
      if (ordersFilter === 'PAID' && order.status !== 'PAID') return false;
      if (ordersFilter === 'PICKED_UP' && order.status !== 'PICKED_UP') return false;

      // Text search
      if (ordersSearch) {
        const query = normalizeSearch(ordersSearch);
        const matchCode = normalizeSearch(order.orderCode || order.foodOrderCode).includes(query);
        const matchBooking = normalizeSearch(order.bookingCode).includes(query);
        const matchCustomer = normalizeSearch(order.customerName).includes(query);
        const matchPhone = normalizeSearch(order.customerPhone).includes(query);
        const matchItems = (order.items || []).some((item) => normalizeSearch(item.name).includes(query));
        if (!matchCode && !matchBooking && !matchCustomer && !matchPhone && !matchItems) {
          return false;
        }
      }
      return true;
    });
  }, [fnbOrders, ordersFilter, ordersSearch]);

  const fnbStats = useMemo(() => {
    const pending = fnbOrders.filter((o) => o.status === 'PAID').length;
    const pickedUp = fnbOrders.filter((o) => o.status === 'PICKED_UP').length;
    const total = fnbOrders.length;
    return { pending, pickedUp, total };
  }, [fnbOrders]);

  // ── Stock Management Items ────────────────────────────────────────────────
  const allStockFoods = useMemo(() => [
    ...staffFoodCombos.map((c) => ({ ...c, kind: 'combo' })),
    ...staffFoodItems.map((i) => ({ ...i, kind: 'item' })),
  ], [staffFoodCombos, staffFoodItems]);

  const filteredStockFoods = useMemo(() => {
    return allStockFoods.filter((f) => {
      if (stockStatusFilter !== 'ALL' && f.status !== stockStatusFilter) return false;
      if (stockSearch) {
        const q = normalizeSearch(stockSearch);
        if (!normalizeSearch(f.name).includes(q)) return false;
      }
      return true;
    });
  }, [allStockFoods, stockStatusFilter, stockSearch]);

  const stockTotalPages = Math.max(1, Math.ceil(filteredStockFoods.length / FOOD_PAGE_SIZE));
  const safeStockPage = Math.min(stockPage, stockTotalPages);
  const stockStartIndex = (safeStockPage - 1) * FOOD_PAGE_SIZE;
  const paginatedStockFoods = filteredStockFoods.slice(stockStartIndex, stockStartIndex + FOOD_PAGE_SIZE);

  const stockStats = useMemo(() => {
    const active = allStockFoods.filter((f) => f.status === 'ACTIVE').length;
    const low = allStockFoods.filter((f) => f.status === 'LOW_STOCK').length;
    const out = allStockFoods.filter((f) => f.status === 'OUT_OF_STOCK' || f.status === 'INACTIVE').length;
    return { active, low, out, total: allStockFoods.length };
  }, [allStockFoods]);

  const isCinemaMismatch = Boolean(
    activeOrder?.cinemaId && assignedCinemaId && Number(activeOrder.cinemaId) !== Number(assignedCinemaId)
  );

  return (
    <div className="space-y-6">
      {/* ── Top Hero Banner ──────────────────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-r from-[#0e0c15] via-[#090b0e] to-[#050608] p-5 shadow-[0_20px_60px_rgba(0,0,0,0.5)] sm:p-6"
      >
        <div className="absolute right-0 top-0 h-full w-1/2 bg-[radial-gradient(circle_at_top_right,rgba(168,85,247,0.18),transparent_65%)] pointer-events-none" />
        <div className="relative flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <span className="flex items-center gap-1.5 rounded-full border border-purple-500/40 bg-purple-500/15 px-3 py-1 text-[9px] font-black uppercase tracking-widest text-purple-300">
                <Popcorn className="h-3.5 w-3.5 text-purple-400" />
                CONCESSIONS & F&B CHECK-IN
              </span>
              <span className="flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-[9px] font-black uppercase tracking-wider text-emerald-400">
                <MapPin className="h-3 w-3" />
                {activeCinema?.name || 'CinemaAI'}
              </span>
            </div>
            <h2 className="text-2xl font-black uppercase tracking-tight text-white sm:text-3xl">
              Quầy bắp nước & Tra cứu đơn F&B
            </h2>
            <p className="max-w-2xl text-xs leading-6 text-neutral-400">
              Quét mã QR bắp nước của khách hàng hoặc tra cứu theo mã đơn <span className="font-mono text-purple-300 font-bold">FO...</span> / mã vé <span className="font-mono text-emerald-300 font-bold">BK...</span> để đối chiếu món trên khay và xác nhận giao nhanh chóng.
            </p>
          </div>

          {/* Quick Metrics */}
          <div className="flex flex-wrap items-center gap-2.5 sm:gap-3">
            <div className="flex items-center gap-3 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 shadow-[0_0_20px_rgba(245,158,11,0.12)]">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-500/20 text-amber-400">
                <Clock3 className="h-5 w-5 animate-pulse" />
              </div>
              <div>
                <p className="text-[9px] font-black uppercase tracking-widest text-amber-300/80">Chờ giao món</p>
                <p className="text-xl font-black text-amber-300">{fnbStats.pending}</p>
              </div>
            </div>

            <div className="flex items-center gap-3 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 shadow-[0_0_20px_rgba(16,185,129,0.12)]">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-500/20 text-emerald-400">
                <CheckCircle2 className="h-5 w-5" />
              </div>
              <div>
                <p className="text-[9px] font-black uppercase tracking-widest text-emerald-300/80">Đã giao trong ca</p>
                <p className="text-xl font-black text-emerald-300">{fnbStats.pickedUp}</p>
              </div>
            </div>

            <div className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-white/10 text-white">
                <ShoppingBag className="h-5 w-5" />
              </div>
              <div>
                <p className="text-[9px] font-black uppercase tracking-widest text-neutral-400">Tổng đơn quầy</p>
                <p className="text-xl font-black text-white">{fnbStats.total}</p>
              </div>
            </div>
          </div>
        </div>
      </motion.div>

      {/* ── Main Two-Column Layout ────────────────────────────────────────── */}
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.15fr)_minmax(420px,1fr)]">
        {/* ── Left Column: Scanner, Search & Active Order Checklist ───────── */}
        <div className="space-y-6">
          {/* Card 1: Lookup & Scanner */}
          <div className="rounded-2xl border border-white/10 bg-gradient-to-b from-[#0c0e12] to-[#050608] p-5 shadow-2xl sm:p-6">
            <div className="flex items-center justify-between border-b border-white/10 pb-4">
              <div className="flex items-center gap-2.5">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-purple-500/30 bg-purple-500/15 text-purple-400">
                  <QrCode className="h-4 w-4" />
                </div>
                <div>
                  <h3 className="text-sm font-black uppercase tracking-wider text-white">Tra cứu & Quét mã F&B</h3>
                  <p className="text-[10px] text-neutral-400">Quét QR hoặc nhập mã nhận món từ vé/đơn hàng</p>
                </div>
              </div>
              <button
                type="button"
                onClick={isCameraOpen ? stopQrScanner : startQrScanner}
                className={`flex items-center gap-2 rounded-xl border px-3.5 py-2 text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer ${
                  isCameraOpen
                    ? 'border-rose-500/40 bg-rose-500/15 text-rose-300 hover:bg-rose-500/25'
                    : 'border-purple-500/40 bg-purple-500/15 text-purple-300 hover:bg-purple-500/25'
                }`}
              >
                {isCameraOpen ? <CameraOff className="h-3.5 w-3.5" /> : <Camera className="h-3.5 w-3.5" />}
                <span>{isCameraOpen ? 'Tắt camera' : 'Mở camera quét QR'}</span>
              </button>
            </div>

            {/* Camera Viewport */}
            {isCameraOpen && (
              <div className="mt-4 overflow-hidden rounded-2xl border border-purple-500/40 bg-black p-2 shadow-inner">
                <div className="relative aspect-video w-full overflow-hidden rounded-xl bg-neutral-950">
                  <video ref={qrVideoRef} className="h-full w-full object-cover" muted playsInline />
                  <canvas ref={qrCanvasRef} className="hidden" />
                  <div className="pointer-events-none absolute inset-0 grid place-items-center">
                    <div className="relative h-44 w-44 rounded-2xl border-2 border-purple-400 shadow-[0_0_0_999px_rgba(0,0,0,0.55)]">
                      <div className="absolute -inset-1 rounded-2xl border border-purple-300/40 animate-pulse" />
                      <div className="absolute top-1/2 left-0 right-0 h-0.5 bg-gradient-to-r from-transparent via-purple-400 to-transparent animate-bounce" />
                    </div>
                  </div>
                </div>
                {scannerMessage && (
                  <p className="mt-2 text-center text-[11px] font-medium text-purple-300">{scannerMessage}</p>
                )}
                {scannerError && (
                  <p className="mt-2 text-center text-[11px] font-bold text-rose-400">{scannerError}</p>
                )}
              </div>
            )}

            {/* Input Bar */}
            <div className="mt-5 space-y-3">
              <div className="relative">
                <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-500" />
                <input
                  type="text"
                  value={lookupInput}
                  onChange={(e) => setLookupInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleLookup()}
                  placeholder="Dán mã QR, mã bắp nước (FO...) hoặc mã đặt vé (BK...)"
                  className="w-full rounded-xl border border-white/10 bg-black/70 py-3.5 pl-11 pr-24 text-sm font-bold text-white placeholder-neutral-500 outline-none transition focus:border-purple-400/80 focus:ring-2 focus:ring-purple-400/20"
                />
                {lookupInput && (
                  <button
                    type="button"
                    onClick={() => {
                      setLookupInput('');
                      setLookupError('');
                    }}
                    className="absolute right-20 top-1/2 -translate-y-1/2 text-neutral-500 hover:text-white"
                  >
                    <XCircle className="h-4 w-4" />
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => handleLookup()}
                  disabled={isLookingUp || !lookupInput.trim()}
                  className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1.5 rounded-lg bg-purple-500 px-3.5 py-2 text-[10px] font-black uppercase tracking-wider text-white transition hover:bg-purple-400 disabled:opacity-40 cursor-pointer"
                >
                  {isLookingUp ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <ArrowRight className="h-3.5 w-3.5" />}
                  <span>Kiểm tra</span>
                </button>
              </div>

              {lookupError && (
                <div className="flex items-center gap-2 rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-rose-300">
                  <AlertCircle className="h-4 w-4 shrink-0 text-rose-400" />
                  <p className="text-xs font-semibold">{lookupError}</p>
                </div>
              )}
            </div>
          </div>

          {/* Card 2: Active Order Details & Prep Checklist */}
          {activeOrder ? (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="rounded-2xl border border-purple-500/30 bg-gradient-to-b from-[#0f0c16] via-[#090b0e] to-[#050608] p-5 shadow-2xl sm:p-6"
            >
              {/* Order Header */}
              <div className="flex flex-wrap items-start justify-between gap-3 border-b border-white/10 pb-4">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-black uppercase tracking-[0.2em] text-purple-400">
                      Đơn bắp nước chi tiết
                    </span>
                    {activeOrder.bookingCode && (
                      <span className="rounded bg-white/10 px-2 py-0.5 font-mono text-[9px] font-black text-neutral-300">
                        Vé: {activeOrder.bookingCode}
                      </span>
                    )}
                  </div>
                  <h3 className="mt-1 font-mono text-xl font-black text-white">
                    {activeOrder.orderCode || activeOrder.foodOrderCode}
                  </h3>
                  <p className="mt-1 text-xs text-neutral-400">
                    Đặt lúc: {formatDateTime(activeOrder.createdAt || activeOrder.paidAt)}
                  </p>
                </div>

                {/* Status Badge */}
                <div>
                  {activeOrder.status === 'PICKED_UP' ? (
                    <span className="inline-flex items-center gap-1.5 rounded-full border border-neutral-700 bg-neutral-900 px-3 py-1 text-xs font-black uppercase text-neutral-300">
                      <Check className="h-3.5 w-3.5 text-neutral-400" />
                      ĐÃ GIAO MÓN
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-500/40 bg-amber-500/15 px-3 py-1 text-xs font-black uppercase text-amber-300 shadow-[0_0_15px_rgba(245,158,11,0.25)]">
                      <span className="h-2 w-2 rounded-full bg-amber-400 animate-ping" />
                      CHỜ GIAO MÓN
                    </span>
                  )}
                </div>
              </div>

              {/* Customer Info & Cinema Badge */}
              <div className="mt-4 grid gap-3 rounded-xl border border-white/10 bg-black/60 p-4 text-xs sm:grid-cols-2">
                <div className="flex items-center gap-2 text-neutral-300">
                  <User className="h-4 w-4 text-purple-400" />
                  <span>Khách: <strong className="text-white">{activeOrder.customerName || 'Khách vãng lai'}</strong></span>
                </div>
                <div className="flex items-center gap-2 text-neutral-300">
                  <Phone className="h-4 w-4 text-purple-400" />
                  <span>SĐT: <strong className="text-white">{activeOrder.customerPhone || '—'}</strong></span>
                </div>
                <div className="flex items-center gap-2 text-neutral-300 sm:col-span-2">
                  <MapPin className="h-4 w-4 text-emerald-400" />
                  <span>Rạp đặt đơn: <strong className={isCinemaMismatch ? 'text-rose-400' : 'text-emerald-300'}>{activeOrder.cinemaName || `#${activeOrder.cinemaId}`}</strong></span>
                </div>
              </div>

              {/* Cinema Mismatch Alert */}
              {isCinemaMismatch && (
                <div className="mt-4 rounded-xl border border-rose-500/40 bg-rose-500/15 p-4 text-rose-300">
                  <div className="flex items-start gap-3">
                    <AlertTriangle className="h-5 w-5 shrink-0 text-rose-400 mt-0.5" />
                    <div>
                      <p className="text-xs font-black uppercase tracking-wider text-rose-300">
                        CẢNH BÁO: ĐƠN THUỘC RẠP KHÁC
                      </p>
                      <p className="mt-1 text-xs text-rose-200 leading-5">
                        Đơn bắp nước này được đặt tại <strong>{activeOrder.cinemaName || `#${activeOrder.cinemaId}`}</strong>. Ca trực của bạn tại <strong>{activeCinema?.name}</strong>. Nhân viên không được phép giao món của rạp khác để bảo đảm kiểm kê kho chính xác.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Prep Checklist Section */}
              <div className="mt-5 space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-[10px] font-black uppercase tracking-[0.2em] text-neutral-400">
                    Danh sách món cần soạn ({activeOrder.items?.length || 0} món)
                  </p>
                  {activeOrder.status === 'PAID' && (
                    <button
                      type="button"
                      onClick={handleToggleAllItems}
                      className="text-[10px] font-bold text-purple-300 hover:text-purple-200 underline cursor-pointer"
                    >
                      {allItemsPrepared ? 'Bỏ chọn tất cả' : 'Đánh dấu đã soạn đủ'}
                    </button>
                  )}
                </div>

                <div className="divide-y divide-white/5 rounded-xl border border-white/10 bg-black/40">
                  {(activeOrder.items || []).map((item, idx) => {
                    const isChecked = Boolean(preparedItems[idx]);
                    return (
                      <div
                        key={`${item.name}-${idx}`}
                        onClick={() => activeOrder.status === 'PAID' && toggleItemCheck(idx)}
                        className={`flex items-center justify-between p-3.5 transition cursor-pointer select-none ${
                          isChecked ? 'bg-emerald-500/[0.07]' : 'hover:bg-white/[0.02]'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => toggleItemCheck(idx)}
                            disabled={activeOrder.status !== 'PAID'}
                            className="h-4 w-4 rounded border-neutral-700 bg-neutral-900 text-emerald-400 focus:ring-0 cursor-pointer"
                          />
                          <div>
                            <div className="flex items-center gap-2">
                              <span className={`text-sm font-black ${isChecked ? 'text-emerald-300 line-through' : 'text-white'}`}>
                                {item.name}
                              </span>
                              <span
                                className={`rounded px-1.5 py-0.5 text-[8px] font-black uppercase tracking-wider ${
                                  item.isCombo ? 'bg-purple-500/20 text-purple-300' : 'bg-teal-500/20 text-teal-300'
                                }`}
                              >
                                {item.isCombo ? 'Combo' : 'Món lẻ'}
                              </span>
                            </div>
                            <p className="font-mono text-xs text-neutral-500">
                              Đơn giá: {formatCurrency(item.unitPrice)}
                            </p>
                          </div>
                        </div>

                        <div className="text-right">
                          <span className="inline-block rounded-lg bg-white/10 px-2.5 py-1 font-mono text-sm font-black text-amber-300">
                            × {item.quantity}
                          </span>
                          <p className="mt-1 font-mono text-xs font-black text-neutral-300">
                            {formatCurrency(item.totalPrice)}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {allItemsPrepared && activeOrder.status === 'PAID' && (
                  <div className="flex items-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-emerald-300">
                    <PackageCheck className="h-4 w-4 text-emerald-400 shrink-0" />
                    <p className="text-xs font-bold">Tất cả các món đã được soạn đủ trên khay. Sẵn sàng giao cho khách!</p>
                  </div>
                )}
              </div>

              {/* Total Summary */}
              <div className="mt-5 flex items-center justify-between border-t border-white/10 pt-4">
                <div>
                  <span className="text-[10px] font-black uppercase tracking-widest text-neutral-400">
                    Tổng Tiền
                  </span>
                  {activeOrder.paidAt && (
                    <p className="text-[10px] text-neutral-500">
                      Đã thanh toán lúc: {formatDateTime(activeOrder.paidAt)}
                    </p>
                  )}
                </div>
                <strong className="font-mono text-2xl font-black text-white">
                  {formatCurrency(activeOrder.totalAmount || activeOrder.subtotal)}
                </strong>
              </div>

              {/* Pick-up Delivery Action Button */}
              <div className="mt-6 flex flex-col gap-3 sm:flex-row">
                {activeOrder.status === 'PAID' ? (
                  <button
                    type="button"
                    onClick={() => handleConfirmPickup(activeOrder)}
                    disabled={isPickingUp || isCinemaMismatch}
                    className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 px-6 py-4 text-xs font-black uppercase tracking-wider text-black shadow-[0_4px_25px_rgba(16,185,129,0.35)] transition hover:from-emerald-400 hover:to-teal-400 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                  >
                    {isPickingUp ? (
                      <RefreshCw className="h-4 w-4 animate-spin" />
                    ) : (
                      <CheckCircle2 className="h-5 w-5" />
                    )}
                    <span>{isPickingUp ? 'Đang xác nhận...' : 'Xác nhận đã giao món cho khách'}</span>
                  </button>
                ) : (
                  <div className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-neutral-800 bg-neutral-900/60 px-4 py-3.5 text-xs font-bold text-neutral-400">
                    <Check className="h-4 w-4 text-emerald-400" />
                    <span>Đã giao món {activeOrder.pickedUpAt ? `lúc ${formatDateTime(activeOrder.pickedUpAt)}` : ''}</span>
                  </div>
                )}

                <button
                  type="button"
                  onClick={() => setPrintSlipOrder(activeOrder)}
                  className="flex items-center justify-center gap-2 rounded-xl border border-white/15 bg-white/[0.04] px-4 py-3.5 text-xs font-black uppercase tracking-wider text-neutral-200 transition hover:bg-white/10 hover:text-white cursor-pointer"
                >
                  <Printer className="h-4 w-4" />
                  <span>In phiếu</span>
                </button>
              </div>
            </motion.div>
          ) : (
            <div className="flex min-h-[300px] flex-col items-center justify-center rounded-2xl border border-dashed border-white/15 bg-gradient-to-b from-[#0c0e12] to-[#050608] p-6 text-center shadow-xl">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-purple-500/30 bg-purple-500/10 text-purple-400 shadow-[0_0_25px_rgba(168,85,247,0.15)]">
                <Popcorn className="h-8 w-8" />
              </div>
              <p className="mt-4 text-xs font-black uppercase tracking-widest text-neutral-300">
                Chưa chọn đơn bắp nước
              </p>
              <p className="mt-2 max-w-sm text-xs leading-6 text-neutral-500">
                Nhập mã đơn, quét mã QR của khách hoặc click vào một đơn trong danh sách chờ bên cạnh để tiến hành soạn và giao món.
              </p>
            </div>
          )}
        </div>

        {/* ── Right Column: Live Concessions Queue ─────────────────────────── */}
        <div className="space-y-6">
          <div className="rounded-2xl border border-white/10 bg-gradient-to-b from-[#0c0e12] to-[#050608] p-5 shadow-2xl sm:p-6">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 pb-4">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-black uppercase tracking-wider text-white">
                    Hàng đợi đơn F&B tại rạp
                  </h3>
                  <span className="rounded-full bg-purple-500/20 px-2 py-0.5 text-[10px] font-black text-purple-300">
                    {filteredOrders.length} đơn
                  </span>
                </div>
                <p className="text-[10px] text-neutral-400">
                  Cập nhật thời gian thực các đơn bắp nước tại {activeCinema?.name}
                </p>
              </div>

              <button
                type="button"
                onClick={() => loadRecentFoodOrders()}
                disabled={isLoadingOrders}
                className="flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-1.5 text-[10px] font-bold text-neutral-300 transition hover:bg-white/10 hover:text-white cursor-pointer"
              >
                <RefreshCw className={`h-3 w-3 ${isLoadingOrders ? 'animate-spin' : ''}`} />
                <span>Làm mới</span>
              </button>
            </div>

            {/* Filter Tabs & Search */}
            <div className="mt-4 space-y-3">
              <div className="flex items-center gap-1 rounded-xl border border-white/10 bg-black/60 p-1">
                <button
                  type="button"
                  onClick={() => setOrdersFilter('ALL')}
                  className={`flex-1 rounded-lg py-1.5 text-center text-[10px] font-black uppercase tracking-wider transition cursor-pointer ${
                    ordersFilter === 'ALL'
                      ? 'bg-white/15 text-white font-extrabold shadow-sm'
                      : 'text-neutral-400 hover:text-white'
                  }`}
                >
                  Tất cả ({fnbStats.total})
                </button>
                <button
                  type="button"
                  onClick={() => setOrdersFilter('PAID')}
                  className={`flex-1 flex items-center justify-center gap-1.5 rounded-lg py-1.5 text-center text-[10px] font-black uppercase tracking-wider transition cursor-pointer ${
                    ordersFilter === 'PAID'
                      ? 'bg-amber-500/20 text-amber-300 font-extrabold border border-amber-500/30'
                      : 'text-neutral-400 hover:text-white'
                  }`}
                >
                  <Clock3 className="h-3 w-3 text-amber-400" />
                  <span>Chờ giao ({fnbStats.pending})</span>
                </button>
                <button
                  type="button"
                  onClick={() => setOrdersFilter('PICKED_UP')}
                  className={`flex-1 flex items-center justify-center gap-1.5 rounded-lg py-1.5 text-center text-[10px] font-black uppercase tracking-wider transition cursor-pointer ${
                    ordersFilter === 'PICKED_UP'
                      ? 'bg-emerald-500/20 text-emerald-300 font-extrabold border border-emerald-500/30'
                      : 'text-neutral-400 hover:text-white'
                  }`}
                >
                  <Check className="h-3 w-3 text-emerald-400" />
                  <span>Đã giao ({fnbStats.pickedUp})</span>
                </button>
              </div>

              <div className="relative">
                <Search className="absolute left-3.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-neutral-500" />
                <input
                  type="text"
                  value={ordersSearch}
                  onChange={(e) => setOrdersSearch(e.target.value)}
                  placeholder="Lọc theo mã đơn, khách hàng, số điện thoại..."
                  className="w-full rounded-xl border border-white/10 bg-black/60 py-2.5 pl-9 pr-4 text-xs font-medium text-white placeholder-neutral-500 outline-none focus:border-purple-400/50"
                />
              </div>
            </div>

            {/* Orders List */}
            <div className="mt-4 max-h-[580px] overflow-y-auto space-y-2.5 pr-1">
              {isLoadingOrders && fnbOrders.length === 0 ? (
                <div className="flex items-center justify-center py-12 text-neutral-400">
                  <RefreshCw className="h-5 w-5 animate-spin mr-2" />
                  <span className="text-xs font-bold">Đang tải danh sách đơn...</span>
                </div>
              ) : filteredOrders.length > 0 ? (
                filteredOrders.map((order) => {
                  const isSelected = (activeOrder?.orderCode || activeOrder?.foodOrderCode) === (order.orderCode || order.foodOrderCode);
                  const isPaid = order.status === 'PAID';

                  return (
                    <motion.div
                      key={order.orderCode || order.foodOrderCode || order.id}
                      layout
                      onClick={() => handleLookup(order.orderCode || order.foodOrderCode)}
                      className={`relative rounded-xl border p-3.5 transition cursor-pointer ${
                        isSelected
                          ? 'border-purple-500/60 bg-purple-500/10 shadow-[0_0_20px_rgba(168,85,247,0.15)]'
                          : 'border-white/10 bg-black/50 hover:border-white/20 hover:bg-white/[0.02]'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-xs font-black text-white">
                              {order.orderCode || order.foodOrderCode}
                            </span>
                            {order.bookingCode && (
                              <span className="rounded bg-white/10 px-1.5 py-0.5 font-mono text-[9px] font-bold text-neutral-300">
                                {order.bookingCode}
                              </span>
                            )}
                          </div>
                          <p className="mt-1 text-xs font-bold text-neutral-300">
                            {order.customerName || 'Khách vãng lai'}
                            {order.customerPhone ? ` · ${order.customerPhone}` : ''}
                          </p>
                        </div>

                        <span
                          className={`rounded-full px-2 py-0.5 text-[9px] font-black uppercase tracking-wider ${
                            isPaid
                              ? 'border border-amber-500/40 bg-amber-500/15 text-amber-300'
                              : 'border border-neutral-700 bg-neutral-900 text-neutral-400'
                          }`}
                        >
                          {isPaid ? 'Chờ giao' : 'Đã giao'}
                        </span>
                      </div>

                      {/* Items Summary */}
                      <div className="mt-2.5 flex flex-wrap gap-1.5">
                        {(order.items || []).map((item, idx) => (
                          <span
                            key={idx}
                            className="rounded-md border border-white/10 bg-white/[0.03] px-2 py-0.5 text-[10px] text-neutral-300"
                          >
                            <strong>{item.name}</strong> <span className="font-mono text-purple-300">×{item.quantity}</span>
                          </span>
                        ))}
                      </div>

                      <div className="mt-3 flex items-center justify-between border-t border-white/5 pt-2 text-[10px] text-neutral-500">
                        <span>{formatTimeAgo(order.createdAt || order.paidAt)}</span>
                        <strong className="font-mono text-xs font-black text-white">
                          {formatCurrency(order.totalAmount || order.subtotal)}
                        </strong>
                      </div>
                    </motion.div>
                  );
                })
              ) : (
                <div className="rounded-xl border border-white/5 bg-black/30 py-10 text-center">
                  <Popcorn className="mx-auto h-8 w-8 text-neutral-600 mb-2" />
                  <p className="text-xs font-bold text-neutral-400">Không có đơn nào phù hợp với bộ lọc.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── Section 3: Quản lý trạng thái món/combo tại quầy (Stock Control) ─ */}
      <div className="rounded-2xl border border-white/10 bg-gradient-to-b from-[#0c0e12] to-[#050608] p-5 shadow-2xl sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 pb-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-purple-500/30 bg-purple-500/15 text-purple-400">
              <Sparkles className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-black uppercase tracking-wider text-white">
                  Trạng thái món/combo tại quầy {activeCinema?.name}
                </h3>
                <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[9px] font-black text-emerald-400 border border-emerald-500/30">
                  {stockStats.active} đang mở bán
                </span>
              </div>
              <p className="text-[10px] text-neutral-400">
                Cập nhật nhanh tình trạng còn/hết hàng để hệ thống đồng bộ tới ứng dụng đặt món của khách.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => onReloadFoods?.()}
              className="flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/[0.04] px-3.5 py-2 text-[10px] font-bold text-neutral-300 transition hover:bg-white/10 hover:text-white cursor-pointer"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              <span>Tải lại thực đơn</span>
            </button>
            <button
              type="button"
              onClick={() => setShowStockManager((prev) => !prev)}
              className="rounded-xl border border-purple-500/30 bg-purple-500/15 px-3.5 py-2 text-[10px] font-black uppercase tracking-wider text-purple-300 transition hover:bg-purple-500/25 cursor-pointer"
            >
              {showStockManager ? 'Thu gọn' : 'Mở bảng quản lý kho'}
            </button>
          </div>
        </div>

        {showStockManager && (
          <div className="mt-5 space-y-4">
            {/* Filter toolbar */}
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-1.5">
                {[
                  { id: 'ALL', label: `Tất cả (${stockStats.total})` },
                  { id: 'ACTIVE', label: `Mở bán (${stockStats.active})` },
                  { id: 'LOW_STOCK', label: `Sắp hết (${stockStats.low})` },
                  { id: 'OUT_OF_STOCK', label: `Hết hàng (${stockStats.out})` },
                ].map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => {
                      setStockStatusFilter(tab.id);
                      setStockPage(1);
                    }}
                    className={`rounded-lg px-3 py-1.5 text-[10px] font-black uppercase tracking-wider transition cursor-pointer ${
                      stockStatusFilter === tab.id
                        ? 'bg-purple-500 text-white shadow-sm'
                        : 'border border-white/10 bg-black/40 text-neutral-400 hover:text-white'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              <div className="relative min-w-[240px]">
                <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-neutral-500" />
                <input
                  type="text"
                  value={stockSearch}
                  onChange={(e) => {
                    setStockSearch(e.target.value);
                    setStockPage(1);
                  }}
                  placeholder="Tìm tên món / combo..."
                  className="w-full rounded-xl border border-white/10 bg-black/60 py-2 pl-8 pr-3 text-xs text-white placeholder-neutral-500 outline-none focus:border-purple-400"
                />
              </div>
            </div>

            {/* Foods Grid / Table */}
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {paginatedStockFoods.map((food) => {
                const foodKey = `${food.kind}-${food.id}`;
                const isSaving = savingStaffFoodKey === foodKey;
                const meta = getFoodStatusMeta(food.status);

                return (
                  <div
                    key={foodKey}
                    className="flex flex-col justify-between rounded-xl border border-white/10 bg-black/50 p-4 transition hover:border-white/20"
                  >
                    <div>
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <span
                            className={`rounded px-1.5 py-0.5 text-[8px] font-black uppercase tracking-wider ${
                              food.kind === 'combo' ? 'bg-purple-500/20 text-purple-300' : 'bg-teal-500/20 text-teal-300'
                            }`}
                          >
                            {food.kind === 'combo' ? 'Combo' : 'Món lẻ'}
                          </span>
                          <h4 className="mt-1 text-sm font-black text-white">{food.name}</h4>
                        </div>
                        <span className={`rounded-full border px-2 py-0.5 text-[9px] font-black uppercase ${meta.className}`}>
                          {meta.label}
                        </span>
                      </div>
                      <p className="mt-2 font-mono text-xs font-black text-amber-300">
                        {formatCurrency(food.price)}
                      </p>
                    </div>

                    <div className="mt-4 pt-3 border-t border-white/5">
                      <p className="text-[9px] font-black uppercase tracking-wider text-neutral-500 mb-2">
                        Đổi trạng thái tại rạp:
                      </p>
                      <div className="grid grid-cols-3 gap-1.5">
                        <button
                          type="button"
                          disabled={isSaving || food.status === 'ACTIVE'}
                          onClick={() => onUpdateFoodStatus?.(food, 'ACTIVE')}
                          className={`rounded-lg py-1 text-[9px] font-black uppercase transition cursor-pointer ${
                            food.status === 'ACTIVE'
                              ? 'bg-emerald-500/30 text-emerald-300 font-extrabold border border-emerald-500/40'
                              : 'border border-white/10 bg-white/[0.02] text-neutral-400 hover:text-white hover:bg-white/10'
                          }`}
                        >
                          Mở bán
                        </button>
                        <button
                          type="button"
                          disabled={isSaving || food.status === 'LOW_STOCK'}
                          onClick={() => onUpdateFoodStatus?.(food, 'LOW_STOCK')}
                          className={`rounded-lg py-1 text-[9px] font-black uppercase transition cursor-pointer ${
                            food.status === 'LOW_STOCK'
                              ? 'bg-purple-500/30 text-purple-300 font-extrabold border border-purple-500/40'
                              : 'border border-white/10 bg-white/[0.02] text-neutral-400 hover:text-white hover:bg-white/10'
                          }`}
                        >
                          Sắp hết
                        </button>
                        <button
                          type="button"
                          disabled={isSaving || food.status === 'OUT_OF_STOCK'}
                          onClick={() => onUpdateFoodStatus?.(food, 'OUT_OF_STOCK')}
                          className={`rounded-lg py-1 text-[9px] font-black uppercase transition cursor-pointer ${
                            food.status === 'OUT_OF_STOCK'
                              ? 'bg-rose-500/30 text-rose-300 font-extrabold border border-rose-500/40'
                              : 'border border-white/10 bg-white/[0.02] text-neutral-400 hover:text-white hover:bg-white/10'
                          }`}
                        >
                          Hết hàng
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Pagination */}
            {stockTotalPages > 1 && (
              <div className="flex items-center justify-between border-t border-white/10 pt-3">
                <span className="text-xs text-neutral-400">
                  Trang {safeStockPage} / {stockTotalPages}
                </span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    disabled={safeStockPage <= 1}
                    onClick={() => setStockPage((p) => Math.max(1, p - 1))}
                    className="rounded-lg border border-white/10 px-3 py-1 text-xs text-neutral-300 disabled:opacity-40"
                  >
                    Trước
                  </button>
                  <button
                    type="button"
                    disabled={safeStockPage >= stockTotalPages}
                    onClick={() => setStockPage((p) => Math.min(stockTotalPages, p + 1))}
                    className="rounded-lg border border-white/10 px-3 py-1 text-xs text-neutral-300 disabled:opacity-40"
                  >
                    Sau
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Print Receipt / Kitchen Slip Modal ───────────────────────────── */}
      {printSlipOrder && (
        <div className="fixed inset-0 z-[280] flex items-center justify-center bg-black/85 p-4 backdrop-blur-sm">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="w-full max-w-sm rounded-2xl border border-white/20 bg-neutral-950 p-6 shadow-2xl text-neutral-900"
          >
            {/* Thermal Print Slip Preview */}
            <div className="rounded-xl border border-neutral-300 bg-white p-5 font-mono text-xs shadow-inner">
              <div className="text-center border-b border-dashed border-neutral-300 pb-3">
                <p className="font-sans font-black text-sm tracking-wider uppercase">CINEMAAI CONCESSIONS</p>
                <p className="text-[10px] text-neutral-600 mt-0.5">{activeCinema?.name}</p>
                <p className="text-[9px] text-neutral-500 mt-1">PHIẾU XUẤT QUẦY BẮP NƯỚC</p>
              </div>

              <div className="py-2.5 space-y-1 text-[11px] border-b border-dashed border-neutral-300">
                <div className="flex justify-between">
                  <span className="text-neutral-500">Mã đơn:</span>
                  <strong className="text-neutral-900">{printSlipOrder.orderCode || printSlipOrder.foodOrderCode}</strong>
                </div>
                {printSlipOrder.bookingCode && (
                  <div className="flex justify-between">
                    <span className="text-neutral-500">Mã booking:</span>
                    <span>{printSlipOrder.bookingCode}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-neutral-500">Khách hàng:</span>
                  <span>{printSlipOrder.customerName || 'Khách vãng lai'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-neutral-500">Thời gian:</span>
                  <span>{formatDateTime(printSlipOrder.paidAt || printSlipOrder.createdAt)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-neutral-500">Thu ngân:</span>
                  <span>{currentUser?.fullName || 'STAFF'}</span>
                </div>
              </div>

              {/* Items List */}
              <div className="py-2.5 divide-y divide-neutral-100">
                {(printSlipOrder.items || []).map((item, idx) => (
                  <div key={idx} className="py-1.5 flex justify-between items-start text-[11px]">
                    <div>
                      <p className="font-bold">{item.name}</p>
                      <p className="text-[10px] text-neutral-500">
                        {item.quantity} × {formatCurrency(item.unitPrice)}
                      </p>
                    </div>
                    <span className="font-bold">{formatCurrency(item.totalPrice)}</span>
                  </div>
                ))}
              </div>

              <div className="border-t-2 border-neutral-800 pt-2 flex justify-between text-xs font-black">
                <span>TỔNG CỘNG:</span>
                <span>{formatCurrency(printSlipOrder.totalAmount || printSlipOrder.subtotal)}</span>
              </div>

              <div className="mt-4 text-center border-t border-dashed border-neutral-300 pt-3">
                <p className="text-[9px] text-neutral-500">Chúc quý khách xem phim vui vẻ!</p>
                <p className="font-mono text-[8px] text-neutral-400 mt-1">*** {printSlipOrder.orderCode} ***</p>
              </div>
            </div>

            {/* Modal Actions */}
            <div className="mt-4 grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setPrintSlipOrder(null)}
                className="rounded-xl border border-white/20 bg-white/5 py-2.5 text-xs font-black uppercase text-neutral-300 hover:bg-white/10"
              >
                Đóng
              </button>
              <button
                type="button"
                onClick={() => {
                  window.print();
                }}
                className="rounded-xl bg-purple-500 py-2.5 text-xs font-black uppercase text-white hover:bg-purple-400"
              >
                In phiếu
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}
