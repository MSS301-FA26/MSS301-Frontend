import React, { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { CheckCircle, XCircle, Loader2, Clock } from 'lucide-react';
import { getStoredAuth } from '../../services/authService';
import { bookingService } from '../../services/bookingService';

export default function PaymentCallbackPage() {
  const navigate = useNavigate();
  const [status, setStatus] = useState('loading');
  const [info, setInfo] = useState({});
  const [failReason, setFailReason] = useState('');
  const [loadingText, setLoadingText] = useState('Đang xác minh giao dịch…');
  const isCancelledRef = useRef(false);

  const onContinue = () => {
    if (info.linkedBookingId) {
      navigate(`/tickets?highlightBookingId=${info.linkedBookingId}`);
    } else {
      navigate('/tickets');
    }
  };

  useEffect(() => {
    isCancelledRef.current = false;
    const params = new URLSearchParams(window.location.search);
    const responseCode = params.get('vnp_ResponseCode');
    const amount = params.get('vnp_Amount');
    const txnRef = params.get('vnp_TxnRef');
    const orderInfo = params.get('vnp_OrderInfo');
    const transactionNo = params.get('vnp_TransactionNo');

    // txnRef format: "{paymentId}-{code}" — code là bookingCode ("BK...") cho vé,
    // hoặc orderCode ("FO...") cho đơn bắp nước (food order add-on).
    const code = txnRef ? txnRef.split('-').slice(1).join('-') : null;
    const isFoodOrder = !!code && code.startsWith('FO');
    const bookingCode = isFoodOrder ? null : code;

    setInfo({
      amount: amount ? (Number.parseInt(amount, 10) / 100).toLocaleString('vi-VN') + 'đ' : '',
      txnRef,
      orderInfo,
      transactionNo,
      bookingCode,
      isFoodOrder,
      foodOrderCode: isFoodOrder ? code : null,
    });

    if (responseCode !== '00') {
      setStatus(responseCode ? 'failed' : 'unknown');
      setFailReason('Giao dịch bị huỷ hoặc không thành công tại cổng VNPay.');
      return;
    }

    const { accessToken } = getStoredAuth();

    // Không thể xác minh từ backend — tin theo VNPay để tránh false negative
    if (!accessToken || (!bookingCode && !code)) {
      setStatus('success');
      return;
    }

    const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

    // Polling xác minh đơn bắp nước (food order)
    const verifyFoodOrder = async () => {
      const maxRetries = 6;
      for (let attempt = 1; attempt <= maxRetries; attempt++) {
        if (isCancelledRef.current) return;
        try {
          if (attempt > 1) {
            setLoadingText(`Đang đồng bộ trạng thái đơn bắp nước (${attempt}/${maxRetries})…`);
          }
          const orders = await bookingService.getMyFoodOrders(accessToken);
          const order = Array.isArray(orders)
            ? orders.find((candidate) => candidate.orderCode === code)
            : null;

          if (order?.status === 'PAID') {
            setStatus('success');
            const linkedId = order.bookingId || order.booking?.id || order.bookingCode || null;
            setInfo((prev) => ({
              ...prev,
              linkedBookingId: linkedId,
            }));
            return;
          }

          if (order?.status === 'EXPIRED') {
            setStatus('failed');
            setFailReason('Đơn bắp nước đã hết thời hạn thanh toán 15 phút và không được ghi nhận thanh toán.');
            return;
          }

          if (attempt < maxRetries) {
            await sleep(1200);
            continue;
          }

          // Hết số lần thử nhưng VNPay 00 -> tin tưởng kết quả VNPay
          setStatus('success');
          return;
        } catch {
          if (attempt < maxRetries) {
            await sleep(1200);
            continue;
          }
          setStatus('success');
          return;
        }
      }
    };

    // Polling xác minh đơn vé xem phim (booking)
    const verifyBooking = async () => {
      const maxRetries = 6;
      for (let attempt = 1; attempt <= maxRetries; attempt++) {
        if (isCancelledRef.current) return;
        try {
          if (attempt > 1) {
            setLoadingText(`Đang đồng bộ kết quả vé từ hệ thống rạp (${attempt}/${maxRetries})…`);
          }
          const bookings = await bookingService.getMyBookings(accessToken);
          const booking = Array.isArray(bookings)
            ? bookings.find((b) => b.bookingCode === bookingCode)
            : null;

          if (!booking) {
            // Không tìm thấy booking -> tin theo VNPay
            setStatus('success');
            return;
          }

          if (booking.status === 'PAID' || booking.status === 'USED' || booking.status === 'CHECKED_IN') {
            setStatus('success');
            return;
          }

          if (booking.status === 'CANCELLED' || booking.status === 'HOLD_EXPIRED') {
            setStatus('hold_expired');
            setFailReason('Thời gian giữ ghế đã hết hạn trước khi hoàn tất thanh toán. Ghế đã được giải phóng – vui lòng đặt lại.');
            return;
          }

          // Booking đang HOLDING hoặc PENDING_PAYMENT -> backend đang xử lý RabbitMQ event
          if (attempt < maxRetries) {
            await sleep(1200);
            continue;
          }

          // Hết số lần thử nhưng VNPay 00 -> coi như thanh toán thành công
          setStatus('success');
          return;
        } catch {
          if (attempt < maxRetries) {
            await sleep(1200);
            continue;
          }
          setStatus('success');
          return;
        }
      }
    };

    if (isFoodOrder) {
      verifyFoodOrder();
    } else {
      verifyBooking();
    }

    return () => {
      isCancelledRef.current = true;
    };
  }, []);

  return (
    <div className="min-h-screen bg-black flex items-center justify-center px-4">
      <div className="max-w-md w-full border border-white/10 bg-neutral-950 p-8 space-y-6 text-center">

        {status === 'loading' && (
          <>
            <Loader2 className="h-12 w-12 text-amber-500 animate-spin mx-auto" />
            <p className="text-xs text-zinc-400 uppercase tracking-widest">{loadingText}</p>
          </>
        )}

        {status === 'success' && (
          <>
            <div className="flex justify-center">
              <div className="h-16 w-16 rounded-full bg-emerald-950/40 border border-emerald-500/40 flex items-center justify-center text-emerald-400">
                <CheckCircle className="h-10 w-10" />
              </div>
            </div>
            <div>
              <h2 className="text-lg font-serif italic text-white uppercase tracking-wider font-bold">Thanh Toán Thành Công</h2>
              <p className="text-[11px] text-zinc-400 mt-1">
                {info.isFoodOrder
                  ? 'Đã thanh toán bắp nước. Nhận tại quầy khi tới rạp!'
                  : 'Giao dịch của bạn đã được xử lý. Vé đã được ghi nhận.'}
              </p>
            </div>
            {info.amount && (
              <div className="border border-white/10 bg-black p-4 text-left space-y-2 text-[10px] font-mono text-neutral-400">
                <div className="flex justify-between"><span>Số tiền:</span><span className="text-emerald-400 font-bold">{info.amount}</span></div>
                {info.isFoodOrder && info.foodOrderCode && <div className="flex justify-between"><span>Mã đơn bắp nước:</span><span className="text-white">{info.foodOrderCode}</span></div>}
                {!info.isFoodOrder && info.bookingCode && <div className="flex justify-between"><span>Mã đặt vé:</span><span className="text-white">{info.bookingCode}</span></div>}
                {info.transactionNo && <div className="flex justify-between"><span>VNPAY Ref:</span><span className="text-white">{info.transactionNo}</span></div>}
              </div>
            )}
          </>
        )}

        {status === 'hold_expired' && (
          <>
            <div className="flex justify-center">
              <div className="h-16 w-16 rounded-full bg-amber-950/40 border border-amber-500/40 flex items-center justify-center text-amber-400">
                <Clock className="h-10 w-10" />
              </div>
            </div>
            <div>
              <h2 className="text-lg font-bold text-amber-400 uppercase tracking-wider">Mua Vé Không Thành Công</h2>
              <p className="text-[11px] text-zinc-400 mt-2 leading-relaxed">{failReason}</p>
            </div>
            <div className="border border-amber-500/20 bg-amber-950/10 p-3 text-[10px] text-amber-300/70 leading-relaxed">
              Số tiền giao dịch qua VNPay (nếu có) sẽ được hoàn lại theo chính sách của ngân hàng.
            </div>
          </>
        )}

        {(status === 'failed' || status === 'unknown') && (
          <>
            <div className="flex justify-center">
              <div className="h-16 w-16 rounded-full bg-red-950/40 border border-red-500/40 flex items-center justify-center text-red-500">
                <XCircle className="h-10 w-10" />
              </div>
            </div>
            <div>
              <h2 className="text-lg font-bold text-red-400 uppercase tracking-wider">Thanh Toán Thất Bại</h2>
              <p className="text-[11px] text-zinc-400 mt-1">{failReason || 'Giao dịch bị huỷ hoặc không thành công.'}</p>
              {!info.isFoodOrder && (
                <p className="mt-2 text-[10px] leading-relaxed text-amber-300/80">
                  Đơn vé vẫn nằm trong “Vé của tôi” và có thể thanh toán lại cho đến khi hết thời gian giữ ghế.
                </p>
              )}
              {info.isFoodOrder && (
                <p className="mt-2 text-[10px] leading-relaxed text-amber-300/80">
                  Đơn bắp nước vẫn được giữ trong 15 phút. Bạn có thể thanh toán lại hoặc huỷ đơn trong mục “Đơn bắp nước của tôi”.
                </p>
              )}
            </div>
          </>
        )}

        <button
          onClick={onContinue}
          className="w-full bg-white text-black hover:bg-neutral-200 py-3 text-xs font-bold uppercase tracking-widest transition cursor-pointer"
        >
          {info.isFoodOrder && info.linkedBookingId ? 'Về vé đã đặt' : 'Về vé của tôi'}
        </button>

      </div>
    </div>
  );
}
