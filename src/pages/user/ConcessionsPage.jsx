import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  CircleAlert,
  Clock3,
  Coins,
  Loader2,
  Minus,
  Popcorn,
  Plus,
  ReceiptText,
  ShoppingBag,
  Store,
  Ticket,
  X,
  Search,
  SlidersHorizontal,
  Sparkles,
  Flame,
  Check,
  ArrowUpDown,
  Trash2,
  Tag,
  Utensils,
  Coffee,
  ChevronRight,
  RefreshCw,
  Layers,
  CheckCircle2
} from 'lucide-react';
import { getStoredAuth } from '../../services/authService';
import { bookingService } from '../../services/bookingService';
import { paymentService } from '../../services/paymentService';
import { loyaltyService } from '../../services/loyaltyService';
import { movieService } from '../../services/movieService';
import { useMovies } from '../../stores/useMovieStore';
import { useUiStore } from '../../stores/useUiStore';

const MAX_ITEM_QUANTITY = 5;

const formatVnd = (value) => `${Number(value || 0).toLocaleString('vi-VN')}đ`;

const formatDateTime = (value) => {
  if (!value) return 'Chưa xác định';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Chưa xác định';
  return date.toLocaleString('vi-VN', {
    hour: '2-digit',
    minute: '2-digit',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
};

const canAttachToBooking = (booking) => (
  booking?.status === 'PAID'
  && (!booking?.showtimeEnd || new Date(booking.showtimeEnd).getTime() > Date.now())
);

const orderStatusLabel = {
  PENDING_PAYMENT: 'Chờ thanh toán',
  PAID: 'Đã thanh toán',
  CANCELLED: 'Đã hủy',
  EXPIRED: 'Đã hết hạn',
};

const remainingSeconds = (expiresAt, now) => Math.max(
  0,
  Math.ceil((new Date(expiresAt).getTime() - now) / 1000)
);

const formatCountdown = (seconds) => `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;

// Helper: Determine category group for an item
const getItemCategoryGroup = (item) => {
  if (item.category === 'combo') return 'COMBO';
  const catName = (item.categoryName || '').toLowerCase();
  const name = (item.name || '').toLowerCase();
  if (catName.includes('bắp') || catName.includes('popcorn') || name.includes('bắp') || name.includes('popcorn')) {
    return 'POPCORN';
  }
  if (catName.includes('nước') || catName.includes('drink') || catName.includes('beverage') || name.includes('coca') || name.includes('pepsi') || name.includes('trà')) {
    return 'DRINK';
  }
  if (catName.includes('snack') || catName.includes('ăn vặt') || catName.includes('nóng') || name.includes('xúc xích') || name.includes('snack') || name.includes('khoai')) {
    return 'SNACK';
  }
  return 'OTHER';
};

export default function ConcessionsPage() {
  const [searchParams] = useSearchParams();
  const requestedBookingId = searchParams.get('bookingId');
  const showToast = useUiStore((state) => state.showToast);
  const { foodCatalog = [], fetchPublicFoodCatalog, publicCinema } = useMovies();

  // Booking & Context state
  const [linkedBooking, setLinkedBooking] = useState(null);
  const [isLoadingContext, setIsLoadingContext] = useState(Boolean(requestedBookingId));
  const [quantities, setQuantities] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [checkoutError, setCheckoutError] = useState('');
  const [loyaltyPoints, setLoyaltyPoints] = useState(0);
  const [earningRatePercent, setEarningRatePercent] = useState(1);
  const [foodOrders, setFoodOrders] = useState([]);
  const [ordersLoading, setOrdersLoading] = useState(true);
  const [orderActionId, setOrderActionId] = useState(null);
  const [now, setNow] = useState(Date.now());

  // ── Filters & Menu Navigation State ─────────────────────────────────────────
  const [selectedTab, setSelectedTab] = useState('ALL'); // ALL, COMBO, POPCORN, DRINK, SNACK, or categoryId
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState('popular'); // popular, price_asc, price_desc, savings, name_asc
  const [onlyInStock, setOnlyInStock] = useState(false);
  const [categories, setCategories] = useState([]);

  // ── Voucher & Promotion State ────────────────────────────────────────────────
  const [voucherCode, setVoucherCode] = useState('');
  const [appliedVoucher, setAppliedVoucher] = useState(null);
  const [voucherError, setVoucherError] = useState('');
  const [isValidatingVoucher, setIsValidatingVoucher] = useState(false);
  const [availablePromotions, setAvailablePromotions] = useState([]);

  // Load public categories & active promotions
  useEffect(() => {
    movieService.getFoodCategories?.()
      .then((data) => setCategories(Array.isArray(data) ? data : []))
      .catch(() => setCategories([]));

    movieService.getActivePromotions?.()
      .then((data) => {
        const active = Array.isArray(data) ? data.filter((p) => p.applicableTarget !== 'TICKET_ONLY') : [];
        setAvailablePromotions(active);
      })
      .catch(() => setAvailablePromotions([]));
  }, []);

  const refreshFoodOrders = useCallback(async () => {
    const { accessToken } = getStoredAuth();
    if (!accessToken) return;
    try {
      const orders = await bookingService.getMyFoodOrders(accessToken);
      setFoodOrders(Array.isArray(orders) ? orders : []);
    } catch {
      setFoodOrders([]);
    } finally {
      setOrdersLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPublicFoodCatalog({ force: true });
  }, [fetchPublicFoodCatalog]);

  useEffect(() => {
    refreshFoodOrders();
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [refreshFoodOrders]);

  useEffect(() => {
    const { accessToken } = getStoredAuth();
    if (!accessToken) return;
    Promise.all([
      loyaltyService.getMyLoyalty(accessToken).catch(() => null),
      loyaltyService.getConfiguration(accessToken).catch(() => null),
    ]).then(([loyalty, config]) => {
      setLoyaltyPoints(Number(loyalty?.points ?? 0));
      setEarningRatePercent(Math.max(0, Number(config?.earningRatePercent ?? 1) || 0));
    });
  }, []);

  useEffect(() => {
    if (!requestedBookingId) {
      setLinkedBooking(null);
      setIsLoadingContext(false);
      return undefined;
    }

    const { accessToken } = getStoredAuth();
    if (!accessToken) {
      setIsLoadingContext(false);
      return undefined;
    }

    let cancelled = false;
    setIsLoadingContext(true);
    bookingService.getMyBooking(accessToken, requestedBookingId)
      .then((booking) => {
        if (cancelled) return;
        if (canAttachToBooking(booking)) setLinkedBooking(booking);
        else showToast('Vé này không còn nhận thêm món. Đơn mới sẽ được tạo riêng tại quầy.');
      })
      .catch(() => {
        if (!cancelled) {
          setLinkedBooking(null);
          showToast('Không thể liên kết vé. Bạn vẫn có thể đặt bắp nước riêng.');
        }
      })
      .finally(() => {
        if (!cancelled) setIsLoadingContext(false);
      });

    return () => { cancelled = true; };
  }, [requestedBookingId, showToast]);

  // Only active products
  const activeFoods = useMemo(() => {
    return foodCatalog.filter((item) => {
      if (item.deletedAt) return false;
      const st = String(item.status || 'ACTIVE').toUpperCase();
      return st === 'ACTIVE' || st === 'LOW_STOCK';
    });
  }, [foodCatalog]);

  // Filtered & Sorted Foods List
  const processedFoods = useMemo(() => {
    let list = [...activeFoods];

    // Search
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter((item) => {
        const name = (item.name || '').toLowerCase();
        const desc = (item.description || '').toLowerCase();
        const cat = (item.categoryName || '').toLowerCase();
        const sku = (item.sku || '').toLowerCase();
        return name.includes(q) || desc.includes(q) || cat.includes(q) || sku.includes(q);
      });
    }

    // Category / Tab filter
    if (selectedTab !== 'ALL') {
      if (selectedTab === 'COMBO') {
        list = list.filter((item) => item.category === 'combo');
      } else if (selectedTab === 'POPCORN') {
        list = list.filter((item) => getItemCategoryGroup(item) === 'POPCORN');
      } else if (selectedTab === 'DRINK') {
        list = list.filter((item) => getItemCategoryGroup(item) === 'DRINK');
      } else if (selectedTab === 'SNACK') {
        list = list.filter((item) => getItemCategoryGroup(item) === 'SNACK');
      } else {
        // Specific category ID
        list = list.filter((item) => String(item.categoryId) === String(selectedTab));
      }
    }

    // Only in-stock
    if (onlyInStock) {
      list = list.filter((item) => {
        if (item.category === 'combo') {
          return item.maxAvailableCombos > 0 && item.stockStatus !== 'OUT_OF_STOCK';
        }
        return item.totalStock > 0 && item.stockStatus !== 'OUT_OF_STOCK';
      });
    }

    // Sort
    list.sort((a, b) => {
      if (sortBy === 'price_asc') return Number(a.price || 0) - Number(b.price || 0);
      if (sortBy === 'price_desc') return Number(b.price || 0) - Number(a.price || 0);
      if (sortBy === 'savings') return Number(b.savingsAmount || 0) - Number(a.savingsAmount || 0);
      if (sortBy === 'name_asc') return (a.name || '').localeCompare(b.name || '');
      // Popular (combos first, then by id)
      if (a.category === 'combo' && b.category !== 'combo') return -1;
      if (a.category !== 'combo' && b.category === 'combo') return 1;
      return Number(b.backendId || 0) - Number(a.backendId || 0);
    });

    return list;
  }, [activeFoods, searchQuery, selectedTab, onlyInStock, sortBy]);

  // Best-seller spotlight combo
  const spotlightCombo = useMemo(() => {
    const combos = activeFoods.filter((f) => f.category === 'combo');
    if (combos.length === 0) return null;
    return [...combos].sort((a, b) => Number(b.savingsAmount || 0) - Number(a.savingsAmount || 0))[0];
  }, [activeFoods]);

  // Counts per tab
  const tabCounts = useMemo(() => {
    const all = activeFoods.length;
    const combo = activeFoods.filter((i) => i.category === 'combo').length;
    const popcorn = activeFoods.filter((i) => getItemCategoryGroup(i) === 'POPCORN').length;
    const drink = activeFoods.filter((i) => getItemCategoryGroup(i) === 'DRINK').length;
    const snack = activeFoods.filter((i) => getItemCategoryGroup(i) === 'SNACK').length;
    return { all, combo, popcorn, drink, snack };
  }, [activeFoods]);

  // Grouped foods when "ALL" tab is selected without active search
  const isGroupedView = selectedTab === 'ALL' && !searchQuery.trim();

  const groupedSections = useMemo(() => {
    if (!isGroupedView) return [];
    const combos = processedFoods.filter((i) => i.category === 'combo');
    const popcorns = processedFoods.filter((i) => getItemCategoryGroup(i) === 'POPCORN');
    const drinks = processedFoods.filter((i) => getItemCategoryGroup(i) === 'DRINK');
    const snacks = processedFoods.filter((i) => getItemCategoryGroup(i) === 'SNACK');
    const others = processedFoods.filter(
      (i) => i.category !== 'combo' && !['POPCORN', 'DRINK', 'SNACK'].includes(getItemCategoryGroup(i))
    );

    const sections = [];
    if (combos.length > 0) {
      sections.push({
        id: 'combos',
        title: 'COMBO BẮP NƯỚC SIÊU TIẾT KIỆM',
        subtitle: 'Thưởng thức trọn vẹn combo bắp rang & nước giải khát với mức giá ưu đãi nhất',
        icon: Sparkles,
        accent: 'text-amber-400',
        badge: 'ƯU ĐÃI TỐT NHẤT',
        items: combos,
      });
    }
    if (popcorns.length > 0) {
      sections.push({
        id: 'popcorns',
        title: 'BẮP RANG BƠ THƠM LỪNG',
        subtitle: 'Bắp rang bơ nóng giòn hạt ngô Mỹ hảo hạng phủ Caramel, Phô mai đậm đà',
        icon: Popcorn,
        accent: 'text-amber-300',
        badge: 'GIÒN RỤM NÓNG HỔI',
        items: popcorns,
      });
    }
    if (drinks.length > 0) {
      sections.push({
        id: 'drinks',
        title: 'NƯỚC GIẢI KHÁT & ĐỒ UỐNG',
        subtitle: 'Thổi bùng sảng khoái với các dòng nước ngọt có gas và đồ uống ướp lạnh',
        icon: Coffee,
        accent: 'text-cyan-400',
        badge: 'MÁT LẠNH TƯƠI MỚI',
        items: drinks,
      });
    }
    if (snacks.length > 0) {
      sections.push({
        id: 'snacks',
        title: 'MÓN ĂN NHANH & ĐỒ ĂN VẶT',
        subtitle: 'Các món snack, xúc xích và đồ ăn kèm nạp năng lượng nhanh trước giờ chiếu',
        icon: Utensils,
        accent: 'text-rose-400',
        badge: 'TIỆN LỢI & HẤP DẪN',
        items: snacks,
      });
    }
    if (others.length > 0) {
      sections.push({
        id: 'others',
        title: 'CÁC MÓN KHÁC',
        subtitle: 'Đa dạng các món ăn vặt và sản phẩm phụ trợ tại quầy rạp',
        icon: Layers,
        accent: 'text-neutral-300',
        badge: 'THÊM LỰA CHỌN',
        items: others,
      });
    }
    return sections;
  }, [isGroupedView, processedFoods]);

  // Selected cart items
  const selectedRows = useMemo(() => {
    return Object.entries(quantities)
      .map(([id, quantity]) => {
        const item = activeFoods.find((candidate) => String(candidate.id) === String(id));
        if (!item || quantity <= 0) return null;
        return { ...item, quantity, lineTotal: Number(item.price || 0) * quantity };
      })
      .filter(Boolean);
  }, [activeFoods, quantities]);

  const totalItems = selectedRows.reduce((sum, row) => sum + row.quantity, 0);
  const totalAmount = selectedRows.reduce((sum, row) => sum + row.lineTotal, 0);
  const totalSavings = selectedRows.reduce((sum, row) => sum + (Number(row.savingsAmount || 0) * row.quantity), 0);
  const earnedPointsPreview = Math.floor(totalAmount * earningRatePercent / 100);

  const standaloneOrders = useMemo(
    () => foodOrders.filter((order) => !order.bookingId),
    [foodOrders]
  );
  const activeStandaloneOrder = standaloneOrders.find((order) => (
    order.status === 'PENDING_PAYMENT' && remainingSeconds(order.expiresAt, now) > 0
  ));

  const changeQuantity = (item, delta) => {
    const isOutOfStock = item.stockStatus === 'OUT_OF_STOCK' ||
      (item.category === 'combo' ? item.maxAvailableCombos <= 0 : item.totalStock <= 0);

    if (delta > 0 && isOutOfStock) {
      showToast(`Món "${item.name}" hiện đang tạm hết hàng.`);
      return;
    }

    setCheckoutError('');
    setQuantities((current) => {
      const key = String(item.id);
      const currentQty = current[key] || 0;
      const nextQuantity = Math.max(0, Math.min(MAX_ITEM_QUANTITY, currentQty + delta));
      const next = { ...current };
      if (nextQuantity === 0) delete next[key];
      else next[key] = nextQuantity;
      return next;
    });
  };

  const handleClearCart = () => {
    setQuantities({});
  };

  const retryFoodOrderPayment = async (order) => {
    const { accessToken } = getStoredAuth();
    if (!accessToken || orderActionId) return;
    setOrderActionId(order.id);
    try {
      const payment = await paymentService.createVnpayFoodOrderPayment(accessToken, order.id);
      const paymentUrl = payment?.paymentUrl ?? payment?.payment_url;
      if (!paymentUrl) throw new Error('Cổng VNPay không trả về đường dẫn thanh toán.');
      window.location.href = paymentUrl;
    } catch (error) {
      showToast(error?.message || 'Không thể tiếp tục thanh toán đơn này.');
      await refreshFoodOrders();
      setOrderActionId(null);
    }
  };

  const cancelFoodOrder = async (order) => {
    if (!window.confirm(`Hủy đơn ${order.orderCode}? Thao tác này không thể hoàn tác.`)) return;
    const { accessToken } = getStoredAuth();
    if (!accessToken || orderActionId) return;
    setOrderActionId(order.id);
    try {
      await bookingService.cancelFoodOrder(accessToken, order.id);
      showToast('Đã hủy đơn bắp nước.');
      await refreshFoodOrders();
    } catch (error) {
      showToast(error?.message || 'Không thể hủy đơn bắp nước.');
    } finally {
      setOrderActionId(null);
    }
  };

  const handleApplyVoucher = async (codeToUse) => {
    const code = (codeToUse || voucherCode).trim().toUpperCase();
    if (!code) {
      setVoucherError('Vui lòng nhập mã ưu đãi.');
      return;
    }
    const { accessToken } = getStoredAuth();
    setIsValidatingVoucher(true);
    setVoucherError('');
    try {
      const res = await movieService.validateVoucher({
        code,
        orderAmount: totalAmount,
        target: 'FOOD_ONLY'
      }, accessToken);

      if (res && res.valid) {
        setAppliedVoucher(res);
        setVoucherCode(code);
        showToast(res.message || `Đã áp dụng mã ưu đãi ${code}!`);
      } else {
        setAppliedVoucher(null);
        setVoucherError(res?.message || 'Mã ưu đãi không hợp lệ.');
        showToast(res?.message || 'Mã ưu đãi không hợp lệ.');
      }
    } catch (err) {
      setAppliedVoucher(null);
      setVoucherError(err.message || 'Không thể kiểm tra mã ưu đãi.');
      showToast(err.message || 'Mã ưu đãi không hợp lệ.');
    } finally {
      setIsValidatingVoucher(false);
    }
  };

  const handleRemoveVoucher = () => {
    setAppliedVoucher(null);
    setVoucherCode('');
    setVoucherError('');
    showToast('Đã hủy áp dụng voucher.');
  };

  const finalPayableAmount = appliedVoucher
    ? Math.max(0, totalAmount - Number(appliedVoucher.discountAmount || 0))
    : totalAmount;

  const handleCheckout = async () => {
    if (selectedRows.length === 0) {
      showToast('Vui lòng chọn ít nhất một món bắp nước.');
      return;
    }

    const { accessToken } = getStoredAuth();
    if (!accessToken || isSubmitting) return;

    const body = {
      foods: selectedRows.map((item) => ({
        foodItemId: item.foodItemId ?? null,
        foodComboId: item.foodComboId ?? null,
        quantity: item.quantity,
      })),
      promotionCode: appliedVoucher ? appliedVoucher.code : undefined
    };

    setCheckoutError('');
    setIsSubmitting(true);
    try {
      const order = linkedBooking
        ? await bookingService.createFoodOrder(accessToken, linkedBooking.id, body)
        : await bookingService.createStandaloneFoodOrder(accessToken, body);
      await refreshFoodOrders();
      const payment = await paymentService.createVnpayFoodOrderPayment(accessToken, order.id);
      const paymentUrl = payment?.paymentUrl ?? payment?.payment_url;
      if (!paymentUrl) throw new Error('Cổng VNPay không trả về đường dẫn thanh toán.');
      window.location.href = paymentUrl;
    } catch (error) {
      const backendMessage = String(error?.message || '');
      const message = !backendMessage || backendMessage.toLowerCase().includes('lỗi hệ thống')
        ? 'Chưa thể khởi tạo thanh toán. Vui lòng thử lại sau khi dịch vụ được kết nối lại.'
        : backendMessage;
      setCheckoutError(message);
      showToast(message);
      await refreshFoodOrders();
      setIsSubmitting(false);
    }
  };

  // Render a single Food Item / Combo card
  const renderFoodCard = (item) => {
    const isCombo = item.category === 'combo';
    const quantity = quantities[String(item.id)] || 0;
    const isOutOfStock = item.stockStatus === 'OUT_OF_STOCK' ||
      (isCombo ? item.maxAvailableCombos <= 0 : item.totalStock <= 0);
    const isLowStock = !isOutOfStock && item.stockStatus === 'LOW_STOCK';
    const fallbackImage = isCombo
      ? 'https://images.unsplash.com/photo-1578849278619-e73505e9610f?q=80&w=400&auto=format&fit=crop'
      : 'https://images.unsplash.com/photo-1585647347483-22b66260dffe?q=80&w=400&auto=format&fit=crop';

    return (
      <article
        key={item.id}
        className={`group relative flex flex-col justify-between border bg-[#0a0a0a] transition-all duration-300 ${
          isOutOfStock
            ? 'opacity-65 border-white/5'
            : quantity > 0
            ? 'border-amber-400/70 shadow-lg shadow-amber-500/10'
            : 'border-white/10 hover:border-amber-400/50 hover:shadow-xl hover:shadow-black/50'
        }`}
      >
        {/* Top Badges */}
        <div className="relative aspect-[16/10] w-full overflow-hidden bg-neutral-900">
          <img
            src={item.imageUrl || fallbackImage}
            alt={item.name}
            className={`h-full w-full object-cover transition-transform duration-500 ${
              !isOutOfStock && 'group-hover:scale-105'
            }`}
            referrerPolicy="no-referrer"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-black/30" />

          {/* Left Badge: Type / Category */}
          <div className="absolute left-2.5 top-2.5 flex flex-wrap gap-1.5">
            <span
              className={`px-2 py-0.5 text-[8px] font-black uppercase tracking-widest border backdrop-blur-md ${
                isCombo
                  ? 'border-amber-500/50 bg-amber-500/20 text-amber-300'
                  : 'border-white/20 bg-black/70 text-neutral-300'
              }`}
            >
              {isCombo ? 'Combo' : item.categoryName || 'Món lẻ'}
            </span>
            {item.sku && (
              <span className="px-1.5 py-0.5 text-[8px] font-mono font-bold bg-black/80 border border-white/10 text-neutral-400">
                {item.sku}
              </span>
            )}
          </div>

          {/* Right Badge: Savings or Stock */}
          <div className="absolute right-2.5 top-2.5 flex flex-col items-end gap-1">
            {isOutOfStock ? (
              <span className="px-2 py-0.5 text-[8px] font-black uppercase tracking-wider bg-rose-950/90 border border-rose-500/40 text-rose-300">
                Hết hàng
              </span>
            ) : isLowStock ? (
              <span className="px-2 py-0.5 text-[8px] font-black uppercase tracking-wider bg-amber-950/90 border border-amber-500/40 text-amber-300">
                Sắp hết
              </span>
            ) : isCombo && Number(item.savingsAmount) > 0 ? (
              <span className="px-2 py-0.5 text-[8px] font-black uppercase tracking-wider bg-emerald-950/90 border border-emerald-500/50 text-emerald-300 flex items-center gap-1">
                <Sparkles className="h-2.5 w-2.5" /> Tiết kiệm {formatVnd(item.savingsAmount)}
              </span>
            ) : null}
          </div>

          {/* Bottom Overlay Info on Image */}
          <div className="absolute bottom-2.5 left-2.5 right-2.5 flex items-center justify-between text-[9px] font-mono">
            <span className="text-neutral-300 truncate">
              {isCombo ? `${item.items?.length || 0} món đi kèm` : `Tồn kho: ${item.totalStock ?? 0}`}
            </span>
          </div>
        </div>

        {/* Content Section */}
        <div className="flex flex-1 flex-col justify-between p-4 space-y-3">
          <div>
            <h3
              className="text-sm font-black uppercase tracking-wide text-white group-hover:text-amber-300 transition-colors line-clamp-1"
              title={item.name}
            >
              {item.name}
            </h3>

            {/* Description */}
            <p className="mt-1 text-[11px] leading-4 text-neutral-400 line-clamp-2">
              {item.description || 'Món bắp nước chính hãng được chuẩn bị tươi mới tại rạp CinePremier.'}
            </p>

            {/* Combo recipe ingredients pills */}
            {isCombo && Array.isArray(item.items) && item.items.length > 0 && (
              <div className="mt-2.5 flex flex-wrap gap-1 border-t border-white/5 pt-2">
                {item.items.map((ci, idx) => (
                  <span
                    key={idx}
                    className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[8px] font-mono border border-white/10 bg-white/[0.03] text-neutral-300"
                  >
                    <span className="text-amber-400 font-bold">{ci.quantity}×</span> {ci.foodItemName}
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Pricing & Quantity Stepper */}
          <div className="border-t border-white/10 pt-3 flex items-center justify-between gap-2">
            <div>
              <div className="flex items-baseline gap-1.5">
                <span className="font-mono text-base font-black text-amber-400">
                  {formatVnd(item.price)}
                </span>
                {isCombo && Number(item.regularPriceSum) > Number(item.price) && (
                  <span className="font-mono text-[10px] text-neutral-500 line-through">
                    {formatVnd(item.regularPriceSum)}
                  </span>
                )}
              </div>
              {isCombo && Number(item.savingsAmount) > 0 && (
                <span className="text-[9px] font-bold text-emerald-400 block mt-0.5">
                  Giảm {formatVnd(item.savingsAmount)}
                </span>
              )}
            </div>

            {/* Action Stepper */}
            {isOutOfStock ? (
              <button
                type="button"
                disabled
                className="px-3 py-2 bg-neutral-900 border border-white/10 text-[9px] font-black uppercase tracking-wider text-neutral-600 cursor-not-allowed"
              >
                Tạm hết
              </button>
            ) : quantity === 0 ? (
              <button
                type="button"
                data-concession-add
                onClick={() => changeQuantity(item, 1)}
                className="flex items-center gap-1.5 px-3 py-2 bg-amber-500/15 hover:bg-amber-400 border border-amber-500/40 hover:border-amber-400 text-amber-300 hover:text-black text-[10px] font-black uppercase tracking-widest transition"
              >
                <Plus className="h-3 w-3" /> Thêm món
              </button>
            ) : (
              <div className="flex items-center border border-amber-400 bg-black">
                <button
                  type="button"
                  aria-label={`Giảm ${item.name}`}
                  onClick={() => changeQuantity(item, -1)}
                  className="flex h-8 w-8 items-center justify-center text-neutral-300 hover:text-white hover:bg-white/10 transition"
                >
                  <Minus className="h-3 w-3" />
                </button>
                <span className="w-7 text-center font-mono text-xs font-black text-amber-300">
                  {quantity}
                </span>
                <button
                  type="button"
                  aria-label={`Thêm ${item.name}`}
                  onClick={() => changeQuantity(item, 1)}
                  disabled={quantity >= MAX_ITEM_QUANTITY}
                  className="flex h-8 w-8 items-center justify-center text-neutral-300 hover:text-white hover:bg-white/10 transition disabled:opacity-30 disabled:hover:bg-transparent"
                >
                  <Plus className="h-3 w-3" />
                </button>
              </div>
            )}
          </div>
        </div>
      </article>
    );
  };

  return (
    <div className="min-h-screen bg-[#060606] text-white">
      {/* ── TOP HERO BANNER ─────────────────────────────────────────────────── */}
      <div className="relative border-b border-white/10 bg-gradient-to-b from-[#12100e] via-[#0a0a0a] to-[#060606] px-4 py-8 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-[1500px]">
          <div className="flex flex-col justify-between gap-6 lg:flex-row lg:items-end">
            <div className="space-y-2">
              <div className="inline-flex items-center gap-2 px-3 py-1 bg-amber-500/10 border border-amber-500/30 text-amber-400 text-[10px] font-black uppercase tracking-[0.2em]">
                <Popcorn className="h-3.5 w-3.5 text-amber-400" /> CinePremier Concessions Bar
              </div>
              <h1 className="text-3xl font-black uppercase tracking-tight text-white sm:text-5xl">
                Thực đơn Bắp Nước &amp; Combo
              </h1>
              <p className="max-w-2xl text-xs sm:text-sm text-neutral-400 leading-relaxed">
                Hương vị bắp rang bơ giòn rụm, đồ uống mát lạnh và các combo tiết kiệm tối đa. Đặt online trước, nhận ngay tại quầy CinePremier không cần xếp hàng!
              </p>
            </div>

            {/* Cinema location box */}
            <div className="flex items-center gap-3 border border-amber-500/20 bg-black/60 p-3.5 backdrop-blur-md">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center border border-amber-500/30 bg-amber-500/10 text-amber-400">
                <Store className="h-5 w-5" />
              </div>
              <div>
                <span className="text-[9px] font-mono uppercase tracking-widest text-neutral-400 block">
                  Điểm nhận bắp nước
                </span>
                <strong className="text-xs font-black uppercase tracking-wider text-white">
                  {publicCinema?.name || 'Quầy F&B CinePremier Cinema'}
                </strong>
                <span className="text-[9px] text-emerald-400 block mt-0.5">
                  ● Đang mở cửa phục vụ
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <main className="mx-auto max-w-[1500px] px-4 py-8 sm:px-6 lg:px-8 space-y-8">
        {/* ── ACTIVE STANDALONE ORDERS BAR ────────────────────────────────────── */}
        {(ordersLoading || activeStandaloneOrder) && (
          <section id="my-food-orders" className="border border-amber-500/30 bg-amber-500/[0.03] p-4 sm:p-5">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.16em] text-white">
                <ReceiptText className="h-4 w-4 text-amber-400" /> Đơn bắp nước đang chờ thanh toán
              </div>
              <span className="font-mono text-[10px] text-amber-300 font-bold">
                {activeStandaloneOrder ? 1 : 0} đơn đang mở
              </span>
            </div>

            {ordersLoading ? (
              <div className="flex min-h-16 items-center gap-2 border border-white/10 bg-black px-4 text-xs text-neutral-400 font-mono">
                <Loader2 className="h-4 w-4 animate-spin text-amber-400" /> Đang kiểm tra đơn hàng...
              </div>
            ) : activeStandaloneOrder ? (
              <div className="border border-amber-400/40 bg-black p-4 space-y-3">
                {(() => {
                  const seconds = remainingSeconds(activeStandaloneOrder.expiresAt, now);
                  const isPending = activeStandaloneOrder.status === 'PENDING_PAYMENT' && seconds > 0;
                  return (
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs font-black text-amber-400">
                            #{activeStandaloneOrder.orderCode}
                          </span>
                          <span className="px-2 py-0.5 text-[8px] font-black uppercase tracking-wider bg-amber-400/10 border border-amber-400/30 text-amber-300">
                            {orderStatusLabel[activeStandaloneOrder.status] || activeStandaloneOrder.status}
                          </span>
                        </div>
                        <p className="mt-1 text-[11px] text-neutral-300">
                          {(activeStandaloneOrder.items || []).map((item) => `${item.name} ×${item.quantity}`).join(' · ')}
                        </p>
                        <div className="mt-1 flex items-center gap-2 font-mono text-[10px] text-neutral-400">
                          <span>Tổng tiền: <strong className="text-white">{formatVnd(activeStandaloneOrder.totalAmount)}</strong></span>
                          {isPending && (
                            <span className="text-amber-300 flex items-center gap-1 font-bold">
                              <Clock3 className="h-3 w-3" /> Còn {formatCountdown(seconds)}
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          type="button"
                          onClick={() => cancelFoodOrder(activeStandaloneOrder)}
                          disabled={Boolean(orderActionId)}
                          className="px-3 py-2 border border-white/20 hover:border-rose-500 text-neutral-300 hover:text-rose-400 text-[10px] font-black uppercase tracking-wider transition disabled:opacity-40"
                        >
                          Hủy đơn
                        </button>
                        <button
                          type="button"
                          onClick={() => retryFoodOrderPayment(activeStandaloneOrder)}
                          disabled={Boolean(orderActionId)}
                          className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-black text-[10px] font-black uppercase tracking-wider transition flex items-center gap-1.5 disabled:opacity-40"
                        >
                          {orderActionId === activeStandaloneOrder.id ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <Clock3 className="h-3.5 w-3.5" />
                          )}
                          Thanh toán ngay
                        </button>
                      </div>
                    </div>
                  );
                })()}
              </div>
            ) : null}
          </section>
        )}

        {/* ── LINKED BOOKING ATTACHMENT NOTICE ──────────────────────────────── */}
        {isLoadingContext ? (
          <div className="flex items-center gap-2 border border-white/10 bg-black p-4 text-xs text-neutral-400 font-mono">
            <Loader2 className="h-4 w-4 animate-spin text-amber-400" /> Đang kiểm tra liên kết vé phim...
          </div>
        ) : linkedBooking ? (
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border border-amber-500/30 bg-amber-500/10 p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center border border-amber-400/40 bg-black text-amber-400">
                <Ticket className="h-5 w-5" />
              </div>
              <div>
                <span className="text-[9px] font-mono uppercase tracking-widest text-amber-400 font-bold block">
                  Đang gắn món vào vé xem phim
                </span>
                <p className="text-sm font-black text-white">
                  Mã vé: #{linkedBooking.bookingCode} · {linkedBooking.movieTitle}
                </p>
                <p className="text-[10px] text-neutral-400 font-mono mt-0.5">
                  Suất chiếu: {formatDateTime(linkedBooking.showtimeStart)}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setLinkedBooking(null)}
              className="px-3 py-1.5 border border-white/20 hover:border-white text-[9px] font-black uppercase tracking-wider text-neutral-300 hover:text-white transition whitespace-nowrap"
            >
              Tách thành đơn riêng tại quầy
            </button>
          </div>
        ) : null}

        {/* ── SPOTLIGHT COMBO BANNER (HOT DEAL) ─────────────────────────────── */}
        {spotlightCombo && !searchQuery.trim() && (
          <div className="relative overflow-hidden border border-amber-500/40 bg-gradient-to-r from-amber-500/10 via-[#0e0c08] to-black p-5 sm:p-7">
            <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-6">
              <div className="space-y-3 text-center md:text-left">
                <div className="inline-flex items-center gap-2 px-3 py-1 bg-amber-500 text-black text-[9px] font-black uppercase tracking-widest">
                  <Flame className="h-3 w-3 fill-black" /> Combo Hot Nhất Hôm Nay
                </div>
                <h2 className="text-2xl sm:text-3xl font-black uppercase tracking-wide text-white">
                  {spotlightCombo.name}
                </h2>
                <p className="text-xs text-neutral-300 max-w-xl">
                  {spotlightCombo.description || 'Trọn bộ bắp rang bơ thơm ngon kết hợp đồ uống giải khát mát lạnh với mức giá ưu đãi cực lớn cho mọt phim!'}
                </p>

                {/* Recipe badges */}
                {Array.isArray(spotlightCombo.items) && spotlightCombo.items.length > 0 && (
                  <div className="flex flex-wrap gap-2 justify-center md:justify-start pt-1">
                    {spotlightCombo.items.map((ci, idx) => (
                      <span
                        key={idx}
                        className="px-2.5 py-1 text-[10px] font-mono border border-amber-500/30 bg-black/60 text-amber-200"
                      >
                        <strong className="text-amber-400">{ci.quantity}×</strong> {ci.foodItemName}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* Price & Action */}
              <div className="flex flex-col items-center md:items-end gap-3 shrink-0">
                <div className="text-center md:text-right">
                  <span className="text-[10px] font-mono text-neutral-400 uppercase tracking-wider block">
                    Giá combo ưu đãi
                  </span>
                  <div className="flex items-baseline gap-2">
                    <span className="font-mono text-2xl sm:text-3xl font-black text-amber-400">
                      {formatVnd(spotlightCombo.price)}
                    </span>
                    {Number(spotlightCombo.regularPriceSum) > Number(spotlightCombo.price) && (
                      <span className="font-mono text-xs text-neutral-500 line-through">
                        {formatVnd(spotlightCombo.regularPriceSum)}
                      </span>
                    )}
                  </div>
                  {Number(spotlightCombo.savingsAmount) > 0 && (
                    <span className="text-[10px] font-bold text-emerald-400 font-mono">
                      Tiết kiệm {formatVnd(spotlightCombo.savingsAmount)} so với mua lẻ
                    </span>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => changeQuantity(spotlightCombo, 1)}
                  className="px-6 py-3 bg-amber-500 hover:bg-amber-400 text-black text-xs font-black uppercase tracking-widest transition flex items-center gap-2 shadow-lg shadow-amber-500/20"
                >
                  <Plus className="h-4 w-4" /> Thêm Combo Ngay
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── BỘ LỌC ĐẦY ĐỦ & THANH ĐIỀU HƯỚNG MENU ─────────────────────────── */}
        <section className="space-y-4">
          {/* Row 1: Search, Sort & In-Stock toggle */}
          <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 border border-white/10 bg-black p-3.5">
            {/* Search Box */}
            <div className="relative flex-1">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-500" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Tìm bắp rang, nước ngọt, combo yêu thích..."
                className="w-full bg-neutral-950 border border-white/10 pl-10 pr-9 py-2.5 text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-amber-400 transition"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-500 hover:text-white"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>

            {/* Filter controls */}
            <div className="flex flex-wrap items-center gap-2.5">
              {/* In stock toggle */}
              <label className="flex items-center gap-2 px-3 py-2 border border-white/10 bg-neutral-950 text-[10px] font-black uppercase tracking-wider text-neutral-300 cursor-pointer hover:border-white/25 transition">
                <input
                  type="checkbox"
                  checked={onlyInStock}
                  onChange={(e) => setOnlyInStock(e.target.checked)}
                  className="h-4 w-4 rounded-none border-white/20 text-amber-500 focus:ring-0 cursor-pointer"
                />
                Chỉ hiện món còn hàng
              </label>

              {/* Sort selector */}
              <div className="flex items-center border border-white/10 bg-neutral-950 px-2.5 py-1">
                <ArrowUpDown className="h-3.5 w-3.5 text-amber-400 mr-2" />
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value)}
                  className="bg-transparent text-[10px] font-black uppercase tracking-wider text-white focus:outline-none cursor-pointer py-1.5"
                >
                  <option value="popular" className="bg-black">Phổ biến nhất</option>
                  <option value="price_asc" className="bg-black">Giá: Thấp → Cao</option>
                  <option value="price_desc" className="bg-black">Giá: Cao → Thấp</option>
                  <option value="savings" className="bg-black">Tiết kiệm nhiều nhất</option>
                  <option value="name_asc" className="bg-black">Tên: A → Z</option>
                </select>
              </div>
            </div>
          </div>

          {/* Row 2: Category Menu Tabs (Visual Cinema Menu Navigation) */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
            {[
              { id: 'ALL', label: 'Tất cả thực đơn', count: tabCounts.all, icon: Utensils },
              { id: 'COMBO', label: 'Combo Tiết Kiệm', count: tabCounts.combo, icon: Sparkles, highlight: true },
              { id: 'POPCORN', label: 'Bắp Rang Bơ', count: tabCounts.popcorn, icon: Popcorn },
              { id: 'DRINK', label: 'Nước Giải Khát', count: tabCounts.drink, icon: Coffee },
              { id: 'SNACK', label: 'Đồ Ăn Vặt', count: tabCounts.snack, icon: Layers },
              // Dynamic categories from backend
              ...categories
                .filter((c) => !['POPCORN', 'DRINK', 'SNACK'].includes(c.code))
                .map((c) => ({
                  id: String(c.id),
                  label: c.name,
                  count: activeFoods.filter((f) => String(f.categoryId) === String(c.id)).length,
                  icon: Tag
                }))
            ].map((tab) => {
              const Icon = tab.icon;
              const isActive = selectedTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setSelectedTab(tab.id)}
                  className={`flex items-center gap-2 px-4 py-2.5 text-xs font-black uppercase tracking-wider whitespace-nowrap border transition ${
                    isActive
                      ? 'border-amber-400 bg-amber-400 text-black shadow-md shadow-amber-500/10'
                      : tab.highlight
                      ? 'border-amber-500/40 bg-amber-500/10 text-amber-300 hover:bg-amber-500/20'
                      : 'border-white/10 bg-black text-neutral-400 hover:text-white hover:border-white/30'
                  }`}
                >
                  <Icon className={`h-3.5 w-3.5 ${isActive ? 'text-black' : tab.highlight ? 'text-amber-400' : 'text-neutral-400'}`} />
                  <span>{tab.label}</span>
                  <span
                    className={`text-[9px] font-mono px-1.5 py-0.2 rounded-none font-bold ${
                      isActive ? 'bg-black/20 text-black' : 'bg-white/10 text-neutral-300'
                    }`}
                  >
                    {tab.count}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Active Filter Summary if filtered */}
          {(searchQuery || selectedTab !== 'ALL' || onlyInStock) && (
            <div className="flex items-center justify-between border-y border-white/5 py-2 text-[10px] text-neutral-400">
              <div className="flex items-center gap-2">
                <span>Đang hiển thị: <strong className="text-white">{processedFoods.length}</strong> món</span>
                {searchQuery && (
                  <span className="px-2 py-0.5 bg-white/10 border border-white/10 text-white font-mono">
                    Tìm kiếm: "{searchQuery}"
                  </span>
                )}
                {selectedTab !== 'ALL' && (
                  <span className="px-2 py-0.5 bg-amber-500/20 border border-amber-500/30 text-amber-300 font-mono">
                    Danh mục: {selectedTab}
                  </span>
                )}
              </div>
              <button
                type="button"
                onClick={() => {
                  setSearchQuery('');
                  setSelectedTab('ALL');
                  setOnlyInStock(false);
                }}
                className="text-amber-400 hover:underline uppercase tracking-wider font-bold"
              >
                Đặt lại bộ lọc
              </button>
            </div>
          )}
        </section>

        {/* ── MAIN CONTENT LAYOUT: MENU + STICKY RECEIPT ────────────────────── */}
        <div className="grid items-start gap-8 lg:grid-cols-[minmax(0,1fr)_400px]">
          {/* MENU COLUMN */}
          <section className="space-y-8">
            {processedFoods.length === 0 ? (
              <div className="flex flex-col items-center justify-center p-16 border border-dashed border-white/10 bg-black text-center space-y-3">
                <ShoppingBag className="h-10 w-10 text-neutral-600" />
                <h3 className="text-sm font-black uppercase tracking-wider text-white">
                  Không tìm thấy món bắp nước phù hợp
                </h3>
                <p className="text-xs text-neutral-500 max-w-sm">
                  Thử tìm kiếm với từ khóa khác hoặc bấm đặt lại bộ lọc để xem toàn bộ thực đơn.
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setSearchQuery('');
                    setSelectedTab('ALL');
                    setOnlyInStock(false);
                  }}
                  className="mt-2 px-4 py-2 border border-amber-500/40 text-amber-300 text-xs font-black uppercase tracking-wider hover:bg-amber-400 hover:text-black transition"
                >
                  Xem tất cả món
                </button>
              </div>
            ) : isGroupedView ? (
              // ── GROUPED PROFESSIONAL CINEMA MENU SECTIONS ──────────────────
              <div className="space-y-10">
                {groupedSections.map((sec) => {
                  const SecIcon = sec.icon;
                  return (
                    <div key={sec.id} className="space-y-4">
                      {/* Section Header */}
                      <div className="flex items-center justify-between border-b border-white/10 pb-3">
                        <div className="flex items-center gap-3">
                          <div className="flex h-9 w-9 items-center justify-center border border-white/15 bg-neutral-950 text-amber-400">
                            <SecIcon className="h-4 w-4" />
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <h2 className="text-base font-black uppercase tracking-wider text-white">
                                {sec.title}
                              </h2>
                              <span className="px-2 py-0.5 text-[8px] font-black uppercase tracking-widest bg-white/5 border border-white/10 text-neutral-400">
                                {sec.items.length} món
                              </span>
                            </div>
                            <p className="text-[11px] text-neutral-500 mt-0.5">
                              {sec.subtitle}
                            </p>
                          </div>
                        </div>
                      </div>

                      {/* Items Grid */}
                      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-2">
                        {sec.items.map(renderFoodCard)}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              // ── FILTERED / SEARCHED GRID ────────────────────────────────────
              <div className="space-y-4">
                <div className="flex items-center justify-between border-b border-white/10 pb-3">
                  <h2 className="text-sm font-black uppercase tracking-wider text-white">
                    Kết quả thực đơn ({processedFoods.length})
                  </h2>
                  <span className="font-mono text-[10px] text-neutral-400">
                    Sắp xếp: {sortBy === 'price_asc' ? 'Giá tăng dần' : sortBy === 'price_desc' ? 'Giá giảm dần' : 'Phổ biến'}
                  </span>
                </div>
                <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-2">
                  {processedFoods.map(renderFoodCard)}
                </div>
              </div>
            )}
          </section>

          {/* ── STICKY CHECKOUT & RECEIPT SIDEBAR ────────────────────────────── */}
          <aside className="border border-white/15 bg-[#0a0a0a] lg:sticky lg:top-24 shadow-2xl space-y-0 divide-y divide-white/10">
            {/* Header */}
            <div className="p-5 flex items-center justify-between bg-black">
              <div className="flex items-center gap-2.5">
                <div className="flex h-8 w-8 items-center justify-center border border-amber-500/30 bg-amber-500/10 text-amber-400">
                  <ReceiptText className="h-4 w-4" />
                </div>
                <div>
                  <h3 className="text-xs font-black uppercase tracking-[0.16em] text-white">
                    Hóa đơn bắp nước
                  </h3>
                  <span className="text-[9px] font-mono text-neutral-400">
                    {totalItems} món đang chọn
                  </span>
                </div>
              </div>

              {selectedRows.length > 0 && (
                <button
                  type="button"
                  onClick={handleClearCart}
                  className="flex items-center gap-1 text-[9px] font-mono text-neutral-400 hover:text-rose-400 transition uppercase tracking-wider"
                  title="Xóa toàn bộ giỏ hàng"
                >
                  <Trash2 className="h-3 w-3" /> Làm trống
                </button>
              )}
            </div>

            {/* Selected Items List */}
            <div className="p-5 max-h-[380px] overflow-y-auto space-y-3">
              {selectedRows.length === 0 ? (
                <div className="text-center py-8 space-y-3">
                  <div className="h-12 w-12 mx-auto flex items-center justify-center border border-dashed border-white/10 bg-neutral-950 text-neutral-600">
                    <ShoppingBag className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-xs font-black uppercase tracking-wider text-neutral-300">
                      Hóa đơn đang trống
                    </p>
                    <p className="text-[10px] text-neutral-500 mt-1 max-w-xs mx-auto">
                      Chọn các món bắp rang, nước ngọt hoặc combo ở thực đơn bên cạnh.
                    </p>
                  </div>
                </div>
              ) : (
                selectedRows.map((row) => (
                  <div
                    key={row.id}
                    className="flex items-center justify-between gap-3 border-b border-white/5 pb-3 last:border-b-0 last:pb-0"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <span className={`px-1.5 py-0.2 text-[7px] font-black uppercase tracking-wider border ${
                          row.category === 'combo'
                            ? 'border-amber-500/40 bg-amber-500/15 text-amber-300'
                            : 'border-white/10 bg-white/5 text-neutral-400'
                        }`}>
                          {row.category === 'combo' ? 'Combo' : 'Món'}
                        </span>
                        <p className="text-xs font-black uppercase text-white truncate" title={row.name}>
                          {row.name}
                        </p>
                      </div>
                      <p className="text-[10px] font-mono text-neutral-400 mt-0.5">
                        {formatVnd(row.price)} × {row.quantity}
                      </p>
                    </div>

                    {/* Stepper + Total */}
                    <div className="flex items-center gap-3 shrink-0">
                      <div className="flex items-center border border-white/10 bg-black">
                        <button
                          type="button"
                          onClick={() => changeQuantity(row, -1)}
                          className="flex h-6 w-6 items-center justify-center text-neutral-400 hover:text-white transition"
                        >
                          <Minus className="h-2.5 w-2.5" />
                        </button>
                        <span className="w-5 text-center font-mono text-[10px] font-bold text-white">
                          {row.quantity}
                        </span>
                        <button
                          type="button"
                          onClick={() => changeQuantity(row, 1)}
                          disabled={row.quantity >= MAX_ITEM_QUANTITY}
                          className="flex h-6 w-6 items-center justify-center text-neutral-400 hover:text-white transition disabled:opacity-30"
                        >
                          <Plus className="h-2.5 w-2.5" />
                        </button>
                      </div>
                      <span className="font-mono text-xs font-bold text-amber-400 w-16 text-right">
                        {formatVnd(row.lineTotal)}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Summary & Calculations */}
            <div className="p-5 space-y-4 bg-black">
              {/* CinePoints Banner */}
              <div className="flex items-center justify-between border border-emerald-500/20 bg-emerald-500/[0.05] p-3">
                <div className="flex items-center gap-2.5">
                  <Coins className="h-4 w-4 text-emerald-400" />
                  <div>
                    <span className="text-[9px] font-black uppercase tracking-widest text-emerald-300 block">
                      Tích lũy điểm CinePoints
                    </span>
                    <span className="text-[8px] text-neutral-400">
                      Đang có: {loyaltyPoints.toLocaleString('vi-VN')} điểm
                    </span>
                  </div>
                </div>
                <span className="font-mono text-xs font-black text-emerald-400">
                  +{earnedPointsPreview.toLocaleString('vi-VN')} pts
                </span>
              </div>

              {/* ── Voucher & Promotion Section ── */}
              <div className="pt-2 border-t border-white/10 space-y-2">
                <div className="flex items-center justify-between text-[11px] font-semibold text-neutral-300">
                  <span className="flex items-center gap-1.5 text-amber-400">
                    <Tag className="h-3.5 w-3.5" /> Mã ưu đãi / Voucher
                  </span>
                  {appliedVoucher && (
                    <span className="text-[10px] text-emerald-400 font-mono">Đã áp dụng</span>
                  )}
                </div>

                {appliedVoucher ? (
                  <div className="flex items-center justify-between p-2 rounded bg-emerald-500/10 border border-emerald-500/30">
                    <div className="min-w-0 pr-2">
                      <span className="font-mono font-bold text-xs text-emerald-400 tracking-wider">
                        {appliedVoucher.code}
                      </span>
                      <p className="text-[10px] text-neutral-300 truncate">
                        {appliedVoucher.message || 'Giảm giá thành công'}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={handleRemoveVoucher}
                      title="Gỡ mã"
                      className="p-1 text-neutral-400 hover:text-rose-400 hover:bg-rose-500/10 rounded transition-colors"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ) : (
                  <div className="space-y-1.5">
                    <div className="flex gap-1.5">
                      <input
                        type="text"
                        value={voucherCode}
                        onChange={(e) => setVoucherCode(e.target.value.toUpperCase())}
                        onKeyDown={(e) => e.key === 'Enter' && handleApplyVoucher()}
                        placeholder="Nhập mã ưu đãi (VD: POPFREE15K)..."
                        disabled={totalItems === 0 || isValidatingVoucher}
                        className="flex-1 bg-black/50 border border-white/10 focus:border-amber-500/50 rounded px-2.5 py-1.5 text-xs text-white placeholder-neutral-500 uppercase font-mono tracking-wider focus:outline-none disabled:opacity-50"
                      />
                      <button
                        type="button"
                        onClick={() => handleApplyVoucher()}
                        disabled={!voucherCode.trim() || totalItems === 0 || isValidatingVoucher}
                        className="px-3 py-1.5 bg-amber-500 hover:bg-amber-400 text-black text-xs font-bold uppercase transition disabled:opacity-40 rounded"
                      >
                        {isValidatingVoucher ? <RefreshCw className="h-3 w-3 animate-spin" /> : 'Áp dụng'}
                      </button>
                    </div>
                    {voucherError && (
                      <p className="text-[10px] text-rose-400 font-mono">{voucherError}</p>
                    )}

                    {/* Quick suggestion tags if available */}
                    {availablePromotions.length > 0 && totalItems > 0 && (
                      <div className="flex flex-wrap gap-1.5 pt-1">
                        <span className="text-[9px] text-neutral-500 self-center">Gợi ý:</span>
                        {availablePromotions.slice(0, 2).map((promo) => (
                          <button
                            key={promo.id}
                            type="button"
                            onClick={() => handleApplyVoucher(promo.code)}
                            className="px-2 py-0.5 rounded text-[10px] font-mono font-medium bg-amber-500/10 border border-dashed border-amber-500/40 text-amber-300 hover:bg-amber-500/20 transition-colors"
                          >
                            +{promo.code}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Price Breakdown */}
              <div className="space-y-1.5 text-xs font-mono pt-2 border-t border-white/10">
                <div className="flex justify-between text-neutral-400">
                  <span>Tạm tính ({totalItems} món):</span>
                  <span>{formatVnd(totalAmount + totalSavings)}</span>
                </div>
                {totalSavings > 0 && (
                  <div className="flex justify-between text-emerald-400">
                    <span>Ưu đãi Combo:</span>
                    <span>-{formatVnd(totalSavings)}</span>
                  </div>
                )}
                {appliedVoucher && (
                  <div className="flex justify-between text-emerald-400 font-bold">
                    <span>Mã ưu đãi ({appliedVoucher.code}):</span>
                    <span>-{formatVnd(appliedVoucher.discountAmount)}</span>
                  </div>
                )}
                <div className="flex items-baseline justify-between pt-2 border-t border-white/10">
                  <span className="text-xs font-black uppercase tracking-widest text-white">
                    Tổng thanh toán:
                  </span>
                  <span className="font-mono text-2xl font-black text-amber-400">
                    {formatVnd(finalPayableAmount)}
                  </span>
                </div>
              </div>

              {/* Warnings / Errors */}
              {!linkedBooking && activeStandaloneOrder && (
                <div className="flex items-start gap-2.5 border border-amber-500/40 bg-amber-500/10 p-3 text-amber-200 text-xs">
                  <Clock3 className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />
                  <p className="text-[10px] leading-relaxed">
                    Bạn đang có đơn <strong>#{activeStandaloneOrder.orderCode}</strong> chờ thanh toán. Vui lòng hoàn tất hoặc hủy trước khi đặt đơn mới.
                  </p>
                </div>
              )}

              {checkoutError && (
                <div className="flex items-start gap-2.5 border border-rose-500/40 bg-rose-500/10 p-3 text-rose-200 text-xs">
                  <CircleAlert className="h-4 w-4 text-rose-400 shrink-0 mt-0.5" />
                  <p className="text-[10px] leading-relaxed">{checkoutError}</p>
                </div>
              )}

              {/* Primary Checkout Button */}
              <button
                type="button"
                onClick={handleCheckout}
                disabled={totalItems === 0 || isSubmitting || (!linkedBooking && Boolean(activeStandaloneOrder))}
                className="w-full py-4 bg-amber-500 hover:bg-amber-400 text-black font-black text-xs uppercase tracking-[0.18em] transition disabled:opacity-30 disabled:hover:bg-amber-500 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-xl shadow-amber-500/10"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" /> Đang chuyển sang VNPay...
                  </>
                ) : (
                  <>
                    <ShoppingBag className="h-4 w-4" />
                    {totalItems === 0
                      ? 'Chọn món để thanh toán'
                      : !linkedBooking && activeStandaloneOrder
                      ? 'Hoàn tất đơn đang chờ'
                      : 'Thanh toán qua VNPay'}
                  </>
                )}
              </button>

              <div className="text-center space-y-1">
                <p className="text-[9px] text-neutral-500">
                  Thanh toán an toàn qua cổng VNPay (QR Pay / Thẻ ATM / Visa).
                </p>
                <p className="text-[9px] text-neutral-400 font-mono">
                  Sau khi thanh toán, xuất trình mã đơn tại quầy để nhận bắp nước.
                </p>
              </div>
            </div>
          </aside>
        </div>
      </main>

      {/* ── MOBILE STICKY FLOATING CART BAR ────────────────────────────────── */}
      {totalItems > 0 && (
        <div className="fixed bottom-0 left-0 right-0 z-40 lg:hidden border-t border-amber-500/30 bg-black/95 p-3 backdrop-blur-md">
          <div className="flex items-center justify-between gap-3">
            <div>
              <span className="text-[9px] font-mono uppercase text-neutral-400 block">
                {totalItems} món đã chọn {appliedVoucher ? `(Đã giảm ${formatVnd(appliedVoucher.discountAmount)})` : ''}
              </span>
              <span className="font-mono text-base font-black text-amber-400">
                {formatVnd(finalPayableAmount)}
              </span>
            </div>
            <button
              type="button"
              onClick={handleCheckout}
              disabled={isSubmitting}
              className="px-5 py-2.5 bg-amber-500 text-black text-xs font-black uppercase tracking-wider"
            >
              {isSubmitting ? 'Đang xử lý...' : 'Thanh toán ngay'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
