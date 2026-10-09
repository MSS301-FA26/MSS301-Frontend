/*
 * Hallmark · component: food-order history cards · genre: editorial · theme: CinePremier dark
 * States: default · hover · focus · active · disabled · loading · error · success
 * Pre-emit critique: P5 · H5 · E5 · S5 · R5 · V5
 */
import React, { useEffect, useMemo, useState } from 'react';
import { Clock3, Loader2, Popcorn, ReceiptText, ShoppingBag, X, AlertTriangle, MapPin, Store } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { useNavigate } from 'react-router-dom';
import { getStoredAuth } from '../../services/authService';
import { bookingService } from '../../services/bookingService';
import { paymentService } from '../../services/paymentService';
import { movieService } from '../../services/movieService';
import { useMovies } from '../../stores/useMovieStore';
import { useUiStore } from '../../stores/useUiStore';

const formatVnd = (value) => `${Number(value || 0).toLocaleString('vi-VN')}đ`;
const labels = {
  PENDING_PAYMENT: 'Chờ thanh toán',
  PAID: 'Đã thanh toán',
  PICKED_UP: 'Đã nhận món',
  CANCELLED: 'Đã hủy',
  EXPIRED: 'Đã hết hạn',
};

const countdown = (expiresAt, now) => Math.max(0, Math.ceil((new Date(expiresAt).getTime() - now) / 1000));
const countdownLabel = (seconds) => `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
const formatDateTime = (value) => (value ? new Date(value).toLocaleString('vi-VN', {
  hour: '2-digit',
  minute: '2-digit',
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
}) : '');

export default function FoodOrdersHistoryPage() {
  const navigate = useNavigate();
  const showToast = useUiStore((state) => state.showToast);
  const { publicCinema, selectedCinema } = useMovies();
  const [cinemas, setCinemas] = useState([]);
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionId, setActionId] = useState(null);
  const [cancelConfirmOrder, setCancelConfirmOrder] = useState(null);
  const [now, setNow] = useState(Date.now());

  // Tải danh sách rạp để hiển thị thông tin rạp nhận bắp nước
  useEffect(() => {
    movieService.getPublicCinemas?.()
      .then((res) => {
        const list = Array.isArray(res) ? res : (res?.data || []);
        setCinemas(list.filter((c) => !c.status || c.status === 'ACTIVE'));
      })
      .catch((err) => {
        console.warn('Lỗi tải danh sách rạp:', err);
      });
  }, []);

  // Xác định rạp nhận bắp nước cho từng đơn hàng
  const getOrderCinema = (order) => {
    // 1. Dữ liệu rạp từ backend nếu có
    if (order.cinemaName) {
      return {
        id: order.cinemaId,
        name: order.cinemaName,
        address: order.cinemaAddress || '',
      };
    }

    // 2. Tìm trong localStorage lưu lúc khách đặt món lẻ
    try {
      const rawMap = localStorage.getItem('food_orders_cinema_map');
      if (rawMap) {
        const map = JSON.parse(rawMap);
        const mapped = map[String(order.id)] || map[String(order.orderCode)] || map[String(order.foodOrderCode)];
        if (mapped && mapped.name) {
          return mapped;
        }
      }
    } catch {}

    // 3. Khớp cinemaId từ đơn hàng với danh sách rạp
    if (order.cinemaId && Array.isArray(cinemas) && cinemas.length > 0) {
      const matched = cinemas.find((c) => String(c.id) === String(order.cinemaId));
      if (matched) {
        return {
          id: matched.id,
          name: matched.name,
          address: matched.address || '',
        };
      }
    }

    // 4. Khớp rạp đã chọn gần nhất lúc vào quầy bắp nước
    try {
      const savedPickupId = localStorage.getItem('concessions_pickup_cinema_id');
      if (savedPickupId && Array.isArray(cinemas) && cinemas.length > 0) {
        const matched = cinemas.find((c) => String(c.id) === String(savedPickupId));
        if (matched) {
          return {
            id: matched.id,
            name: matched.name,
            address: matched.address || '',
          };
        }
      }
    } catch {}

    // 5. Fallback từ store hoặc rạp mặc định hệ thống
    const fallback = selectedCinema || publicCinema || (cinemas.length > 0 ? (cinemas.find((c) => c.id === 5) || cinemas[0]) : null);
    if (fallback) {
      return {
        id: fallback.id,
        name: fallback.name,
        address: fallback.address || '',
      };
    }

    return {
      id: 5,
      name: 'CinemaAI Dragon City',
      address: 'Tầng 5, Vincom Plaza Ngô Quyền, 910A Ngô Quyền, Q. Sơn Trà, Đà Nẵng',
    };
  };

  const loadOrders = async () => {
    const { accessToken } = getStoredAuth();
    if (!accessToken) return;
    try {
      const result = await bookingService.getMyFoodOrders(accessToken);
      const list = (Array.isArray(result) ? result : []).filter((order) => !order.bookingId);
      setOrders(list);

      // Tự động kiểm tra và đồng bộ trạng thái thanh toán cho các đơn đang CHỜ THANH TOÁN
      const pendingList = list.filter((o) => o.status === 'PENDING_PAYMENT');
      if (pendingList.length > 0) {
        Promise.allSettled(
          pendingList.map((o) => bookingService.syncFoodOrderPayment(accessToken, o.id))
        ).then((syncResults) => {
          const hasPaid = syncResults.some((r) => r.status === 'fulfilled' && r.value?.status === 'PAID');
          if (hasPaid) {
            bookingService.getMyFoodOrders(accessToken).then((latest) => {
              setOrders((Array.isArray(latest) ? latest : []).filter((order) => !order.bookingId));
            });
          }
        });
      }
    } catch {
      setOrders([]);
      showToast('Không thể tải lịch sử bắp nước.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadOrders();
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  const sortedOrders = useMemo(() => [...orders].sort((a, b) => (
    new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()
  )), [orders]);

  const groupedOrders = useMemo(() => sortedOrders.reduce((groups, order) => {
    const seconds = countdown(order.expiresAt, now);
    const status = order.status === 'PENDING_PAYMENT' && seconds === 0 ? 'EXPIRED' : order.status;
    if (status === 'PENDING_PAYMENT') groups.pending.push(order);
    else if (status === 'PAID') groups.ready.push(order);
    else groups.history.push(order);
    return groups;
  }, { pending: [], ready: [], history: [] }), [sortedOrders, now]);

  const retryPayment = async (order) => {
    const { accessToken } = getStoredAuth();
    if (!accessToken || actionId) return;
    setActionId(order.id);
    try {
      const payment = await paymentService.createVnpayFoodOrderPayment(accessToken, order.id);
      const url = payment?.paymentUrl ?? payment?.payment_url;
      if (!url) throw new Error('Cổng VNPay không trả về đường dẫn thanh toán.');
      window.location.href = url;
    } catch (error) {
      showToast(error?.message || 'Không thể tiếp tục thanh toán.');
      await loadOrders();
      setActionId(null);
    }
  };

  const cancelOrder = (order) => {
    setCancelConfirmOrder(order);
  };

  const executeCancelOrder = async () => {
    if (!cancelConfirmOrder) return;
    const order = cancelConfirmOrder;
    const { accessToken } = getStoredAuth();
    if (!accessToken || actionId) return;
    setActionId(order.id);
    try {
      await bookingService.cancelFoodOrder(accessToken, order.id);
      setCancelConfirmOrder(null);
      showToast('Đã hủy đơn bắp nước.');
      await loadOrders();
    } catch (error) {
      showToast(error?.message || 'Không thể hủy đơn.');
    } finally {
      setActionId(null);
    }
  };

  const checkPaymentStatus = async (order) => {
    const { accessToken } = getStoredAuth();
    if (!accessToken || actionId) return;
    setActionId(order.id);
    try {
      let synced = null;
      try {
        synced = await bookingService.syncFoodOrderPayment(accessToken, order.id);
      } catch (err) {
        console.warn('Sync payment endpoint not yet reloaded on backend:', err);
      }
      await loadOrders();
      if (synced?.status === 'PAID') {
        showToast('Đã xác nhận thanh toán thành công!');
      } else {
        showToast('Đã cập nhật lại thông tin đơn bắp nước.');
      }
    } catch {
      showToast('Không thể kiểm tra trạng thái thanh toán.');
    } finally {
      setActionId(null);
    }
  };

  const renderOrderCard = (order) => {
    const seconds = countdown(order.expiresAt, now);
    const status = order.status === 'PENDING_PAYMENT' && seconds === 0 ? 'EXPIRED' : order.status;
    const pending = status === 'PENDING_PAYMENT';
    const paid = status === 'PAID';
    const pickedUp = status === 'PICKED_UP';
    const items = order.items || [];
    const cinema = getOrderCinema(order);
    const inactiveMessage = status === 'EXPIRED'
      ? 'Đã quá thời hạn thanh toán 15 phút.'
      : status === 'CANCELLED'
        ? 'Đơn đã hủy.'
        : '';

    return (
      <article
        key={order.id}
        className={`flex flex-col justify-between rounded-xl border p-3.5 sm:p-4 transition-all duration-200 ${
          pending
            ? 'border-amber-400/35 bg-gradient-to-b from-amber-500/[0.04] to-neutral-950/90 shadow-[0_4px_20px_rgba(245,158,11,0.04)]'
            : paid
              ? 'border-emerald-400/30 bg-gradient-to-b from-emerald-500/[0.04] to-neutral-950/90 shadow-[0_4px_20px_rgba(16,185,129,0.04)]'
              : 'border-white/10 bg-neutral-950/60 opacity-80 hover:opacity-100'
        }`}
      >
        <div className="space-y-3">
          {/* Header: Mã đơn + Thời gian & Badge trạng thái */}
          <div className="flex items-start justify-between gap-2 border-b border-white/5 pb-2.5">
            <div className="min-w-0 flex-1">
              <span className="font-mono text-xs font-bold text-white tracking-wide truncate block">
                {order.orderCode || order.foodOrderCode}
              </span>
              <span className="text-[10px] text-neutral-400 font-mono block mt-0.5">
                {order.createdAt ? formatDateTime(order.createdAt) : ''}
              </span>
            </div>
            <span
              className={`shrink-0 inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[9px] font-bold uppercase tracking-wider ${
                pending
                  ? 'bg-amber-400/15 text-amber-300 border border-amber-400/30'
                  : paid
                    ? 'bg-emerald-400/15 text-emerald-300 border border-emerald-400/30'
                    : 'bg-white/5 text-neutral-400 border border-white/10'
              }`}
            >
              <span className={`h-1.5 w-1.5 rounded-full ${pending ? 'bg-amber-400 animate-pulse' : paid ? 'bg-emerald-400' : 'bg-neutral-500'}`} />
              {labels[status] || status}
            </span>
          </div>

          {/* Thông tin Rạp nhận bắp nước - HIỆN RÕ RÀNG */}
          <div className="flex items-start gap-2.5 rounded-lg border border-amber-500/25 bg-amber-500/[0.05] p-2.5 text-xs transition-colors hover:border-amber-500/40">
            <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-amber-500/15 text-amber-400 mt-0.5">
              <MapPin className="h-3.5 w-3.5" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-[9px] font-black uppercase tracking-wider text-amber-400">
                  Rạp nhận món:
                </span>
                <span className="font-bold text-white text-xs truncate">
                  {cinema.name}
                </span>
              </div>
              {cinema.address && (
                <p className="mt-0.5 text-[10px] text-neutral-400 line-clamp-1 leading-tight" title={cinema.address}>
                  {cinema.address}
                </p>
              )}
            </div>
          </div>

          {/* Chi tiết các sản phẩm trong đơn - HIỆN RÕ RÀNG */}
          <div>
            <div className="mb-1.5 flex items-center justify-between text-[9px] font-black uppercase tracking-wider text-neutral-400">
              <span className="flex items-center gap-1">
                <Popcorn className="h-3 w-3 text-purple-400" />
                Món đã chọn ({items.length})
              </span>
              <span>Thành tiền</span>
            </div>

            <div className="divide-y divide-white/5 rounded-lg border border-white/5 bg-white/[0.02] px-2.5 py-1">
              {items.length > 0 ? (
                items.map((item, idx) => {
                  const itemName = item.name || item.productName || `Món bắp nước #${item.foodItemId || item.productId || idx + 1}`;
                  const itemTotal = item.lineTotal != null ? item.lineTotal : (item.unitPrice ? item.unitPrice * item.quantity : 0);
                  return (
                    <div key={idx} className="flex items-center justify-between py-1.5 text-xs gap-2">
                      <div className="flex items-center gap-2 min-w-0 flex-1">
                        <span
                          className={`shrink-0 rounded px-1.5 py-0.2 text-[8px] font-bold uppercase ${
                            item.isCombo
                              ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30'
                              : 'bg-amber-500/15 text-amber-300 border border-amber-500/25'
                          }`}
                        >
                          {item.isCombo ? 'Combo' : 'Lẻ'}
                        </span>
                        <span className="truncate text-xs font-semibold text-neutral-200" title={itemName}>
                          {itemName}
                        </span>
                        <span className="shrink-0 font-mono text-[10px] font-bold text-amber-400">
                          ×{item.quantity}
                        </span>
                      </div>
                      <span className="shrink-0 font-mono text-[11px] font-semibold text-neutral-300">
                        {formatVnd(itemTotal)}
                      </span>
                    </div>
                  );
                })
              ) : (
                <div className="py-1 text-[11px] text-neutral-400 italic">
                  Thông tin món bắp nước
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Card Footer: Tổng tiền, QR Code hoặc nút thao tác */}
        <div className="mt-3 pt-2.5 border-t border-white/5">
          {/* Tổng tiền & Đếm ngược */}
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-400">
              Tổng thanh toán:
            </span>
            <span className="font-mono text-base font-black text-amber-300">
              {formatVnd(order.totalAmount)}
            </span>
          </div>

          {/* Đếm ngược cho đơn chờ thanh toán */}
          {pending && (
            <div className="mt-1 flex items-center justify-between text-[10px]">
              <span className="flex items-center gap-1 font-mono font-bold text-amber-400">
                <Clock3 className="h-3 w-3" /> Còn {countdownLabel(seconds)}
              </span>
              <span className="text-[9px] text-neutral-400 font-mono">Hạn giữ đơn 15p</span>
            </div>
          )}

          {/* Nút hành động cho đơn chờ thanh toán - Gọn gàng */}
          {pending && (
            <div className="mt-2.5 flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => checkPaymentStatus(order)}
                disabled={Boolean(actionId)}
                aria-busy={actionId === order.id}
                className="flex-1 rounded-md border border-amber-400/30 bg-amber-400/10 py-1.5 text-[9px] font-bold uppercase tracking-wider text-amber-300 hover:bg-amber-400/20 transition cursor-pointer disabled:opacity-40"
              >
                {actionId === order.id ? 'Đang ktra...' : 'Kiểm tra'}
              </button>
              <button
                type="button"
                onClick={() => cancelOrder(order)}
                disabled={Boolean(actionId)}
                className="rounded-md border border-white/10 px-2.5 py-1.5 text-[9px] font-bold text-neutral-400 hover:text-red-400 hover:border-red-400/30 transition cursor-pointer disabled:opacity-40"
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={() => retryPayment(order)}
                disabled={Boolean(actionId)}
                aria-busy={actionId === order.id}
                className="flex-1 rounded-md bg-amber-400 py-1.5 text-[9px] font-black uppercase tracking-wider text-black hover:bg-amber-300 transition cursor-pointer disabled:opacity-40"
              >
                {actionId === order.id ? 'Đang chuyển...' : 'Thanh toán'}
              </button>
            </div>
          )}

          {/* QR nhận món - Nhỏ gọn, sắc nét */}
          {paid && (order.qrCode || order.foodOrderCode || order.orderCode) && (
            <div className="mt-2.5 flex items-center gap-3 rounded-lg border border-emerald-500/25 bg-emerald-950/25 p-2">
              <div className="shrink-0 rounded bg-white p-1 shadow-sm">
                <QRCodeSVG
                  value={order.qrCode || `FOOD:${order.orderCode || order.foodOrderCode}:${order.id}`}
                  size={64}
                  level="M"
                  title={`Mã nhận món ${order.orderCode || order.foodOrderCode}`}
                />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1 text-[9px] font-black uppercase tracking-wider text-emerald-400">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  Mã nhận món tại quầy
                </div>
                <p className="font-mono text-[10px] font-bold text-white truncate mt-0.5">
                  {order.orderCode || order.foodOrderCode}
                </p>
                <p className="text-[10px] text-neutral-300 leading-tight mt-0.5">
                  Đưa mã QR cho nhân viên tại quầy bắp nước <span className="font-bold text-amber-300">{cinema.name}</span>
                </p>
              </div>
            </div>
          )}

          {/* Trạng thái hết hạn hoặc đã hủy */}
          {!pending && !paid && inactiveMessage && (
            <p className="mt-1.5 text-[10px] text-neutral-500 italic">
              {inactiveMessage}
            </p>
          )}

          {pickedUp && (
            <p className="mt-1.5 text-[10px] text-neutral-500 font-medium">
              Đã nhận món{order.pickedUpAt ? ` lúc ${formatDateTime(order.pickedUpAt)}` : ''}
            </p>
          )}
        </div>
      </article>
    );
  };

  if (loading) {
    return <div className="flex min-h-64 items-center justify-center gap-2 border border-white/10 bg-neutral-950 text-xs text-neutral-500"><Loader2 className="h-4 w-4 animate-spin" /> Đang tải đơn bắp nước...</div>;
  }

  if (sortedOrders.length === 0) {
    return (
      <div className="flex min-h-72 flex-col items-center justify-center border border-dashed border-white/15 bg-neutral-950/60 px-6 text-center">
        <span className="flex h-14 w-14 items-center justify-center border border-purple-500/25 bg-purple-500/10 text-purple-300"><ShoppingBag className="h-6 w-6" /></span>
        <h2 className="mt-5 text-sm font-black uppercase tracking-[0.16em] text-white">Chưa có đơn bắp nước</h2>
        <p className="mt-2 max-w-md text-xs leading-5 text-neutral-500">Các đơn mua riêng, trạng thái thanh toán và mã nhận món sẽ xuất hiện tại đây.</p>
        <button type="button" onClick={() => navigate('/concessions')} className="mt-6 min-h-11 whitespace-nowrap bg-purple-600 px-6 text-[10px] font-black uppercase tracking-widest text-white transition-colors hover:bg-purple-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white active:bg-purple-700">Đặt bắp nước</button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 pb-3">
        <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-neutral-400"><ReceiptText className="h-4 w-4 text-purple-400" /> {sortedOrders.length} đơn mua riêng</div>
        <button type="button" onClick={() => navigate('/concessions')} className="flex min-h-11 items-center gap-2 whitespace-nowrap border border-purple-400/30 px-4 text-[9px] font-black uppercase tracking-widest text-purple-300 transition-colors hover:bg-purple-500 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-purple-300 active:bg-purple-700"><Popcorn className="h-4 w-4" /> Đặt thêm bắp nước</button>
      </div>

      <div className="space-y-6">
        {groupedOrders.pending.length > 0 && (
          <section aria-labelledby="food-orders-pending">
            <div className="mb-2.5 flex items-center justify-between border-b border-amber-400/20 pb-2">
              <h2 id="food-orders-pending" className="text-[10px] font-black uppercase tracking-[0.16em] text-amber-300">Cần hoàn tất</h2>
              <span className="font-mono text-[9px] text-neutral-500">{groupedOrders.pending.length} đơn</span>
            </div>
            <div className="grid items-stretch gap-3.5 sm:grid-cols-2 lg:grid-cols-3">{groupedOrders.pending.map(renderOrderCard)}</div>
          </section>
        )}

        {groupedOrders.ready.length > 0 && (
          <section aria-labelledby="food-orders-ready">
            <div className="mb-2.5 flex items-center justify-between border-b border-emerald-400/20 pb-2">
              <h2 id="food-orders-ready" className="text-[10px] font-black uppercase tracking-[0.16em] text-emerald-300">Sẵn sàng nhận món</h2>
              <span className="font-mono text-[9px] text-neutral-500">{groupedOrders.ready.length} đơn</span>
            </div>
            <div className="grid items-stretch gap-3.5 sm:grid-cols-2 lg:grid-cols-3">{groupedOrders.ready.map(renderOrderCard)}</div>
          </section>
        )}

        {groupedOrders.history.length > 0 && (
          <section aria-labelledby="food-orders-history">
            <div className="mb-2.5 flex items-center justify-between border-b border-white/10 pb-2">
              <h2 id="food-orders-history" className="text-[10px] font-black uppercase tracking-[0.16em] text-neutral-400">Lịch sử</h2>
              <span className="font-mono text-[9px] text-neutral-500">{groupedOrders.history.length} đơn</span>
            </div>
            <div className="grid items-stretch gap-3.5 sm:grid-cols-2 lg:grid-cols-3">{groupedOrders.history.map(renderOrderCard)}</div>
          </section>
        )}
      </div>

      {cancelConfirmOrder && (
        <div
          className="fixed inset-0 z-[120] flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm animate-in fade-in duration-150"
          onClick={() => !actionId && setCancelConfirmOrder(null)}
        >
          <div
            className="relative w-full max-w-md border border-rose-500/30 bg-[#0d0d0d] p-6 shadow-[0_25px_60px_rgba(0,0,0,0.95)]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-amber-500 via-rose-500 to-amber-500" />
            <div className="flex items-start justify-between gap-3 pt-1">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center border border-rose-500/30 bg-rose-500/10 text-rose-400">
                  <AlertTriangle className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-[9px] font-mono font-black uppercase tracking-[0.25em] text-rose-400">
                    Xác nhận hủy đơn
                  </p>
                  <h3 className="mt-0.5 text-base font-black uppercase tracking-wide text-white">
                    Hủy đơn bắp nước?
                  </h3>
                </div>
              </div>
              <button
                type="button"
                onClick={() => !actionId && setCancelConfirmOrder(null)}
                disabled={Boolean(actionId)}
                className="text-neutral-400 hover:text-white p-1 hover:bg-white/10 transition disabled:opacity-30"
                title="Đóng"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <p className="mt-4 text-xs leading-relaxed text-neutral-300">
              Hủy đơn <span className="font-mono font-bold text-amber-400">{cancelConfirmOrder.orderCode}</span>? Thao tác này không thể hoàn tác.
            </p>

            <div className="mt-6 flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setCancelConfirmOrder(null)}
                disabled={Boolean(actionId)}
                className="border border-white/15 bg-black px-4 py-2 text-[10px] font-black uppercase tracking-widest text-neutral-300 hover:border-white/30 hover:text-white transition disabled:opacity-40"
              >
                Giữ đơn
              </button>
              <button
                type="button"
                onClick={executeCancelOrder}
                disabled={Boolean(actionId)}
                className="flex items-center gap-2 border border-rose-500 bg-rose-600 px-5 py-2 text-[10px] font-black uppercase tracking-widest text-white hover:bg-rose-500 transition shadow-[0_0_20px_rgba(244,63,94,0.3)] disabled:opacity-50"
              >
                {actionId ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    Đang hủy...
                  </>
                ) : (
                  'Xác nhận hủy đơn'
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
