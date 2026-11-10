import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { QRCodeSVG } from 'qrcode.react';
import {
  Printer,
  X,
  CheckSquare,
  Square,
  Scissors,
} from 'lucide-react';

const TICKET_TYPE_MAP = {
  ADULT: 'NGƯỜI LỚN',
  STUDENT: 'HỌC SINH / SINH VIÊN',
  CHILD: 'TRẺ EM',
  VIP: 'VÉ VIP',
};

const formatVnd = (value) => {
  const num = Number(value || 0);
  return `${num.toLocaleString('vi-VN')} đ`;
};

const formatDateTime = (val) => {
  if (!val) return '—';
  const d = new Date(val);
  if (isNaN(d.getTime())) return String(val);
  return d.toLocaleString('vi-VN', {
    hour: '2-digit',
    minute: '2-digit',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
};

const formatDateOnly = (val) => {
  if (!val) return '—';
  const d = new Date(val);
  if (isNaN(d.getTime())) return String(val);
  return d.toLocaleDateString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
};

const formatTimeOnly = (val) => {
  if (!val) return '—';
  const d = new Date(val);
  if (isNaN(d.getTime())) return String(val);
  return d.toLocaleTimeString('vi-VN', {
    hour: '2-digit',
    minute: '2-digit',
  });
};

// Generates a decorative SVG Barcode
function BarcodeGraphic({ value, height = 20 }) {
  const bars = useMemo(() => {
    const str = String(value || '1234567890');
    const result = [];
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = (hash << 5) - hash + str.charCodeAt(i);
      hash |= 0;
    }
    const seed = Math.abs(hash) || 98765;
    const count = 44;
    for (let i = 0; i < count; i++) {
      const w = ((seed + i * 37) % 3) + 1;
      const isSpace = (i % 2 === 1) && ((seed + i * 17) % 5 !== 0);
      result.push({ width: w, isSpace });
    }
    return result;
  }, [value]);

  return (
    <div className="flex flex-col items-center justify-center my-0.5">
      <svg height={height} className="w-full max-w-[170px]" preserveAspectRatio="none" viewBox="0 0 100 24">
        {bars.map((bar, idx) => {
          const x = (idx / bars.length) * 100;
          const barWidth = (bar.width / bars.length) * 100 * 0.7;
          return bar.isSpace ? null : (
            <rect key={idx} x={x} y="0" width={barWidth} height="24" fill="#000" />
          );
        })}
      </svg>
      <span className="font-mono text-[7.5px] tracking-[0.16em] text-neutral-700 uppercase">
        *{value}*
      </span>
    </div>
  );
}

export default function TicketPrintModal({
  isOpen,
  onClose,
  booking,
  activeCinema,
  currentUser,
}) {
  const [printTimestamp] = useState(() => new Date());

  // Extract seats safely
  const rawSeats = useMemo(() => {
    if (!booking) return [];
    if (Array.isArray(booking.seats) && booking.seats.length > 0) {
      return booking.seats.map((s, idx) => {
        const row = s.rowLabel || '';
        const num = s.seatNumber != null ? s.seatNumber : '';
        const name = s.seatName || (row || num ? `${row}${num}` : `Ghế ${idx + 1}`);
        const code = s.ticketCode || `${booking.bookingCode}-${name}`;
        const price = s.unitPrice ?? s.price ?? Math.round(Number(booking.totalAmount || 0) / (booking.seats.length || 1));
        return {
          id: s.seatId || idx,
          rowLabel: row,
          seatNumber: num,
          name,
          ticketCode: code,
          ticketType: s.ticketType || 'ADULT',
          price,
          status: s.status || 'CHECKED_IN',
        };
      });
    }
    if (typeof booking.seatNames === 'string' && booking.seatNames.trim()) {
      const names = booking.seatNames.split(',').map((n) => n.trim()).filter(Boolean);
      return names.map((name, idx) => ({
        id: idx,
        rowLabel: name.charAt(0) || '',
        seatNumber: name.slice(1) || '',
        name,
        ticketCode: `${booking.bookingCode}-${name}`,
        ticketType: 'ADULT',
        price: Math.round(Number(booking.totalAmount || 0) / (names.length || 1)),
        status: 'CHECKED_IN',
      }));
    }
    return [
      {
        id: 0,
        rowLabel: '',
        seatNumber: '01',
        name: 'VÉ VÀO CỬA',
        ticketCode: booking.bookingCode,
        ticketType: 'ADULT',
        price: Number(booking.totalAmount || 0),
        status: 'CHECKED_IN',
      },
    ];
  }, [booking]);

  const [selectedSeatCodes, setSelectedSeatCodes] = useState([]);
  const [includeFoodReceipt, setIncludeFoodReceipt] = useState(true);
  const [isPrinting, setIsPrinting] = useState(false);

  useEffect(() => {
    if (isOpen && rawSeats.length > 0) {
      setSelectedSeatCodes(rawSeats.map((s) => s.ticketCode));
      setIncludeFoodReceipt(Array.isArray(booking?.foods) && booking.foods.length > 0);
    }
  }, [isOpen, rawSeats, booking]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        onClose();
      } else if (e.key === 'Enter' && (e.ctrlKey || e.metaKey || e.target.tagName !== 'BUTTON')) {
        handleTriggerPrint();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, selectedSeatCodes, includeFoodReceipt]);

  const toggleSeat = (code) => {
    setSelectedSeatCodes((prev) =>
      prev.includes(code) ? prev.filter((c) => c !== code) : [...prev, code]
    );
  };

  const toggleSelectAll = () => {
    if (selectedSeatCodes.length === rawSeats.length) {
      setSelectedSeatCodes([]);
    } else {
      setSelectedSeatCodes(rawSeats.map((s) => s.ticketCode));
    }
  };

  const seatsToPrint = useMemo(() => {
    return rawSeats.filter((s) => selectedSeatCodes.includes(s.ticketCode));
  }, [rawSeats, selectedSeatCodes]);

  const movieTitle = booking?.movieTitle
    || booking?.movie?.title
    || booking?.movieName
    || booking?.showtime?.movieTitle
    || booking?.showtime?.movie?.title
    || booking?.title
    || 'PHIM CHIẾU RẠP';
  const cinemaName = booking?.cinemaName || activeCinema?.name || 'CINEPREMIER CINEMAS';
  const cinemaAddress = activeCinema?.address || booking?.cinemaAddress || 'Trung tâm chiếu phim CinePremier';
  const showDate = formatDateOnly(booking?.showtimeStart);
  const showTime = formatTimeOnly(booking?.showtimeStart);
  const roomName = booking?.roomName || 'Phòng 01';
  const customerName = booking?.customerName
    || booking?.userFullName
    || booking?.userName
    || booking?.user?.fullName
    || (booking?.userId ? (Number(booking.userId) === 2 ? 'Nguyen Hieu Tuan' : `Khách #${booking.userId}`) : 'Khách xem phim');
  const staffName = currentUser?.fullName || currentUser?.name || 'STAFF';

  const isShowtimeOver = useMemo(() => {
    const effectiveEnd = booking?.showtimeEnd || (booking?.showtimeStart ? new Date(new Date(booking.showtimeStart).getTime() + 135 * 60000).toISOString() : null);
    if (!effectiveEnd) return false;
    const endTime = new Date(effectiveEnd);
    return !Number.isNaN(endTime.getTime()) && Date.now() > endTime.getTime();
  }, [booking]);

  const handleTriggerPrint = () => {
    if (isShowtimeOver) {
      alert('Suất chiếu đã kết thúc. Không thể in vé.');
      return;
    }
    if (seatsToPrint.length === 0 && !includeFoodReceipt) return;
    setIsPrinting(true);
    setTimeout(() => {
      window.print();
      setIsPrinting(false);
    }, 150);
  };

  if (!isOpen || !booking) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[300] flex items-center justify-center bg-black/85 p-2 sm:p-4 backdrop-blur-md">
        <motion.div
          initial={{ opacity: 0, scale: 0.96, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.96, y: 10 }}
          className="relative flex flex-col max-h-[86vh] w-full max-w-2xl sm:max-w-3xl overflow-hidden rounded-xl border border-emerald-500/30 bg-[#0d0f14] shadow-[0_20px_60px_rgba(0,0,0,0.85)] text-white text-xs"
        >
          {/* Top Bar Header (Compact) */}
          <div className="relative flex items-center justify-between border-b border-white/10 bg-gradient-to-r from-emerald-950/40 via-neutral-900/60 to-black px-4 py-2.5">
            <div className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-emerald-400/40 bg-emerald-500/15 text-emerald-400 shadow-[0_0_12px_rgba(16,185,129,0.2)]">
                <Printer className="h-4 w-4" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="rounded border border-emerald-500/40 bg-emerald-500/15 px-1.5 py-0.2 text-[7.5px] font-black uppercase tracking-wider text-emerald-300">
                    POS PRINTER
                  </span>
                  <span className="font-mono text-[8.5px] text-neutral-400">#{booking.bookingCode}</span>
                </div>
                <h2 className="text-xs sm:text-sm font-black uppercase tracking-wide text-white leading-tight mt-0.5">
                  In vé vào cửa phòng chiếu
                </h2>
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="rounded-lg p-1.5 text-neutral-400 transition hover:bg-white/10 hover:text-white"
              title="Đóng (Esc)"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Modal Body: Split into Left controls and Right Print Preview */}
          <div className="grid flex-1 overflow-hidden sm:grid-cols-[230px_1fr]">
            {/* Left Controls & Seat Selector (Compact) */}
            <div className="flex flex-col border-r border-white/10 bg-black/40 p-3 space-y-3 overflow-y-auto text-[11px]">
              {isShowtimeOver && (
                <div className="rounded-lg border border-rose-500/40 bg-rose-500/15 p-2.5 text-[10px] font-black uppercase tracking-wider text-rose-300">
                  ⚠️ Suất chiếu đã kết thúc · Không thể in vé
                </div>
              )}

              {/* Quick Info Box */}
              <div className="rounded-lg border border-white/10 bg-black/60 p-2.5 space-y-1">
                <p className="text-[9px] font-black uppercase tracking-wider text-emerald-400">
                  Suất chiếu
                </p>
                <p className="font-black text-white text-xs truncate">{movieTitle}</p>
                <div className="text-[10px] text-neutral-400 space-y-0.5 font-mono">
                  <p className="truncate">📍 {cinemaName}</p>
                  <p>🎬 {roomName} · {showTime} ({showDate})</p>
                  <p className="truncate">👤 {customerName}</p>
                </div>
              </div>

              {/* Seat Selection Checklist */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[9px] font-black uppercase tracking-wider text-neutral-300">
                    Ghế cần in ({selectedSeatCodes.length}/{rawSeats.length})
                  </span>
                  <button
                    type="button"
                    onClick={toggleSelectAll}
                    className="text-[8.5px] font-bold text-emerald-400 hover:text-emerald-300 uppercase underline"
                  >
                    {selectedSeatCodes.length === rawSeats.length ? 'Bỏ chọn' : 'Tất cả'}
                  </button>
                </div>

                <div className="space-y-1 max-h-[140px] overflow-y-auto pr-1">
                  {rawSeats.map((seat) => {
                    const isSelected = selectedSeatCodes.includes(seat.ticketCode);
                    return (
                      <label
                        key={seat.ticketCode}
                        onClick={() => toggleSeat(seat.ticketCode)}
                        className={`flex items-center justify-between rounded border px-2 py-1.5 cursor-pointer transition select-none ${
                          isSelected
                            ? 'border-emerald-500/50 bg-emerald-500/15 text-white font-bold'
                            : 'border-white/10 bg-black/30 text-neutral-400 hover:border-white/20'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          {isSelected ? (
                            <CheckSquare className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
                          ) : (
                            <Square className="h-3.5 w-3.5 text-neutral-600 shrink-0" />
                          )}
                          <span className="font-mono font-black text-white">{seat.name}</span>
                          <span className="text-[8px] uppercase px-1 py-0.2 rounded bg-black/50 text-neutral-400">
                            {TICKET_TYPE_MAP[seat.ticketType] || 'Lớn'}
                          </span>
                        </div>
                        <span className="font-mono text-[9px] text-emerald-300">
                          {formatVnd(seat.price)}
                        </span>
                      </label>
                    );
                  })}
                </div>
              </div>

              {/* Food voucher option if available */}
              {Array.isArray(booking?.foods) && booking.foods.length > 0 && (
                <div className="rounded-lg border border-amber-500/25 bg-amber-500/10 p-2">
                  <label className="flex items-center gap-2 cursor-pointer font-bold text-amber-200">
                    <input
                      type="checkbox"
                      checked={includeFoodReceipt}
                      onChange={(e) => setIncludeFoodReceipt(e.target.checked)}
                      className="h-3.5 w-3.5 accent-amber-400"
                    />
                    <span className="text-[10px]">Kèm phiếu bắp nước ({booking.foods.length} món)</span>
                  </label>
                </div>
              )}

              {/* Keyboard shortcuts */}
              <div className="mt-auto border-t border-white/5 pt-2 text-[9px] text-neutral-500 font-mono">
                ⌨ <kbd className="px-1 py-0.2 rounded bg-neutral-800 text-neutral-300">Enter</kbd>: In vé · <kbd className="px-1 py-0.2 rounded bg-neutral-800 text-neutral-300">Esc</kbd>: Đóng
              </div>
            </div>

            {/* Right: Interactive Ticket Slip Preview (Scaled down & Compact) */}
            <div className="flex flex-col bg-[#050608] p-3 sm:p-4 overflow-y-auto">
              <div className="flex items-center justify-between mb-2 text-[9.5px]">
                <span className="font-black uppercase tracking-wider text-neutral-400">
                  Bản in thực tế (Chuẩn 80mm POS)
                </span>
                <span className="font-mono text-emerald-400 font-bold">
                  {seatsToPrint.length} vé{includeFoodReceipt && booking.foods?.length > 0 ? ' + 1 bắp nước' : ''}
                </span>
              </div>

              {/* Scrollable Container with the exact printable slips */}
              <div className="flex-1 overflow-y-auto pr-1 flex flex-col items-center gap-4 py-1">
                {seatsToPrint.length === 0 && !includeFoodReceipt ? (
                  <div className="my-auto text-center py-8 text-neutral-500 text-xs">
                    <Printer className="h-6 w-6 mx-auto mb-1.5 text-neutral-600 opacity-60" />
                    Chưa chọn vé nào để in. Vui lòng tick chọn ít nhất 01 ghế.
                  </div>
                ) : (
                  <>
                    {/* Render each seat ticket slip (Compact dimensions) */}
                    {seatsToPrint.map((seat) => (
                      <div
                        key={seat.ticketCode}
                        className="w-full max-w-[275px] rounded-lg bg-white text-neutral-900 shadow-xl p-3.5 font-sans relative border border-neutral-300 select-none text-left"
                      >
                        {/* Top Accent Strip */}
                        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-neutral-800 via-neutral-400 to-neutral-800 rounded-t-lg" />

                        {/* Cinema Header */}
                        <div className="text-center border-b border-dashed border-neutral-300 pb-2">
                          <p className="font-black text-xs tracking-widest uppercase font-serif text-black">
                            CINEPREMIER CINEMAS
                          </p>
                          <p className="text-[9.5px] font-bold text-neutral-800 mt-0.5">{cinemaName}</p>
                          <p className="text-[7.5px] text-neutral-600 mt-0.5 line-clamp-1">{cinemaAddress}</p>
                          <p className="text-[7px] text-neutral-500 font-mono mt-0.2">Hotline: 1900 6017</p>
                        </div>

                        {/* Ticket Badge */}
                        <div className="py-1 text-center border-b border-neutral-200">
                          <span className="inline-block rounded border border-neutral-800 bg-neutral-900 text-white px-2 py-0.2 text-[7.5px] font-black uppercase tracking-[0.16em]">
                            VÉ VÀO CỬA · ADMISSION TICKET
                          </span>
                        </div>

                        {/* Movie Details */}
                        <div className="py-2 space-y-1 border-b border-dashed border-neutral-300">
                          <h4 className="text-xs font-black text-black uppercase leading-tight font-sans">
                            {movieTitle}
                          </h4>
                          <div className="flex justify-between text-[8.5px] text-neutral-700">
                            <span>Định dạng: <strong>2D Digital Phụ đề</strong></span>
                            <span>Phòng: <strong className="text-black">{roomName}</strong></span>
                          </div>
                          <div className="flex justify-between text-[8.5px] text-neutral-700">
                            <span>Suất: <strong className="font-mono text-black">{showTime}</strong></span>
                            <span>Ngày: <strong className="font-mono text-black">{showDate}</strong></span>
                          </div>
                        </div>

                        {/* Seat Highlight Box (HERO) */}
                        <div className="my-2 rounded border border-black bg-neutral-100 p-2 text-center">
                          <div className="grid grid-cols-2 gap-1 text-left border-b border-neutral-300 pb-1 text-[7.5px]">
                            <div>
                              <span className="uppercase font-bold text-neutral-600 block">Phòng</span>
                              <span className="font-black uppercase text-black">{roomName}</span>
                            </div>
                            <div className="text-right">
                              <span className="uppercase font-bold text-neutral-600 block">Loại vé</span>
                              <span className="font-black uppercase text-black">
                                {TICKET_TYPE_MAP[seat.ticketType] || 'Người lớn'}
                              </span>
                            </div>
                          </div>
                          
                          <div className="pt-1">
                            <span className="text-[7.5px] uppercase font-bold tracking-wider text-neutral-500 block">
                              SỐ GHẾ / SEAT
                            </span>
                            <span className="text-2xl font-black font-mono text-black tracking-wider block leading-none my-0.5">
                              {seat.name}
                            </span>
                            <span className="text-[9.5px] font-mono font-bold text-neutral-800 block">
                              Giá: {formatVnd(seat.price)}
                            </span>
                          </div>
                        </div>

                        {/* QR Code & Ticket Code */}
                        <div className="flex flex-col items-center justify-center my-2 text-center">
                          <div className="p-1.5 border border-neutral-300 bg-white rounded shadow-xs">
                            <QRCodeSVG
                              value={seat.ticketCode || booking.bookingCode}
                              size={72}
                              level="M"
                              includeMargin={false}
                            />
                          </div>
                          <p className="font-mono text-[7.5px] font-black text-black tracking-wider mt-1">
                            {seat.ticketCode}
                          </p>
                          <BarcodeGraphic value={seat.ticketCode} height={18} />
                        </div>

                        {/* Transaction & Audit Info */}
                        <div className="border-t border-dashed border-neutral-300 pt-1.5 text-[7.5px] text-neutral-600 space-y-0.2 font-mono">
                          <div className="flex justify-between">
                            <span>Mã đơn:</span>
                            <strong className="text-black">{booking.bookingCode}</strong>
                          </div>
                          <div className="flex justify-between">
                            <span>Khách hàng:</span>
                            <span className="text-neutral-800 truncate max-w-[130px]">{customerName}</span>
                          </div>
                          <div className="flex justify-between">
                            <span>Thu ngân:</span>
                            <span>{staffName}</span>
                          </div>
                          <div className="flex justify-between">
                            <span>Thời gian:</span>
                            <span>{formatDateTime(printTimestamp)}</span>
                          </div>
                        </div>

                        {/* Perforated Tear Line */}
                        <div className="relative my-2.5 flex items-center justify-center">
                          <div className="w-full border-b border-dashed border-neutral-400" />
                          <span className="absolute bg-white px-1.5 text-[6.5px] font-mono text-neutral-500 uppercase flex items-center gap-0.5">
                            <Scissors className="h-2.5 w-2.5" /> CUỐNG VÉ KIỂM SOÁT
                          </span>
                        </div>

                        {/* Tear-off Stub */}
                        <div className="bg-neutral-50 border border-neutral-200 p-1.5 rounded text-[7.5px] font-mono space-y-0.5">
                          <p className="font-black text-black truncate uppercase">{movieTitle}</p>
                          <div className="flex justify-between">
                            <span>{roomName} · {showTime}</span>
                            <span className="font-black text-black">GHẾ: {seat.name}</span>
                          </div>
                        </div>
                      </div>
                    ))}

                    {/* Food voucher slip (Compact) */}
                    {includeFoodReceipt && Array.isArray(booking.foods) && booking.foods.length > 0 && (
                      <div className="w-full max-w-[275px] rounded-lg bg-white text-neutral-900 shadow-xl p-3.5 font-sans relative border border-neutral-300 select-none text-left">
                        <div className="text-center border-b border-dashed border-neutral-300 pb-2">
                          <p className="font-black text-xs tracking-widest uppercase font-serif text-black">
                            CINEPREMIER CONCESSIONS
                          </p>
                          <p className="text-[8.5px] font-black uppercase text-amber-800 mt-0.5">
                            🍿 PHIẾU XUẤT QUẦY BẮP NƯỚC
                          </p>
                        </div>

                        <div className="py-1.5 space-y-0.5 text-[8px] border-b border-neutral-200 font-mono">
                          <div className="flex justify-between">
                            <span className="text-neutral-500">Mã đơn:</span>
                            <strong className="text-black">{booking.bookingCode}</strong>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-neutral-500">Khách hàng:</span>
                            <span className="text-black font-bold truncate max-w-[130px]">{customerName}</span>
                          </div>
                        </div>

                        {/* Foods List */}
                        <div className="py-2 divide-y divide-neutral-200 text-[8.5px]">
                          {booking.foods.map((food, idx) => (
                            <div key={idx} className="py-1 flex justify-between items-start">
                              <div>
                                <p className="font-black text-black">{food.name}</p>
                                <p className="text-[7.5px] text-neutral-500 font-mono">
                                  {food.quantity} × {formatVnd(food.unitPrice || 0)}
                                </p>
                              </div>
                              <span className="font-mono font-bold text-black">
                                {formatVnd(food.totalPrice || (food.quantity * (food.unitPrice || 0)))}
                              </span>
                            </div>
                          ))}
                        </div>

                        <div className="border-t border-black pt-1.5 flex justify-between text-[9px] font-black font-mono">
                          <span>TỔNG TIỀN:</span>
                          <span>
                            {formatVnd(
                              booking.foods.reduce(
                                (acc, f) => acc + (f.totalPrice || f.quantity * (f.unitPrice || 0)),
                                0
                              )
                            )}
                          </span>
                        </div>

                        <div className="flex flex-col items-center justify-center my-2 text-center">
                          <div className="p-1.5 border border-neutral-300 bg-white rounded shadow-xs">
                            <QRCodeSVG
                              value={`FO:${booking.bookingCode}`}
                              size={64}
                              level="M"
                              includeMargin={false}
                            />
                          </div>
                          <BarcodeGraphic value={`FO-${booking.bookingCode}`} height={16} />
                        </div>

                        <div className="text-center border-t border-dashed border-neutral-300 pt-1.5 text-[7px] text-neutral-500">
                          Đưa phiếu này tại quầy Bắp Nước để nhận món. Chúc bạn xem phim vui vẻ!
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Modal Footer Actions (Compact) */}
          <div className="flex items-center justify-between border-t border-white/10 bg-neutral-950 px-4 py-2.5">
            <div className="text-[10px] text-neutral-400 font-mono">
              Tổng bản in: <strong className="text-emerald-300">{seatsToPrint.length + (includeFoodReceipt && booking.foods?.length > 0 ? 1 : 0)}</strong> liên
            </div>

            <div className="flex items-center gap-2.5">
              <button
                type="button"
                onClick={onClose}
                className="rounded-lg border border-white/15 bg-white/5 px-3.5 py-1.5 text-xs font-bold uppercase tracking-wider text-neutral-300 transition hover:bg-white/10 hover:text-white"
              >
                Đóng
              </button>
              <button
                type="button"
                onClick={handleTriggerPrint}
                disabled={isShowtimeOver || (seatsToPrint.length === 0 && !includeFoodReceipt)}
                className="flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-emerald-500 to-emerald-400 px-5 py-1.5 text-xs font-black uppercase tracking-wider text-black shadow-[0_0_20px_rgba(16,185,129,0.35)] transition hover:from-emerald-400 hover:to-emerald-300 active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
              >
                <Printer className="h-3.5 w-3.5" />
                {isPrinting ? 'Đang gửi...' : isShowtimeOver ? 'Suất chiếu đã kết thúc' : `In vé ngay (${seatsToPrint.length} vé)`}
              </button>
            </div>
          </div>
        </motion.div>
      </div>

      {/* ====================================================================
          HIDDEN PRINT CONTAINER FOR WINDOW.PRINT() TARGETED BY @MEDIA PRINT
          (Standard 80mm thermal receipt dimensions on actual paper)
         ==================================================================== */}
      <div id="cinema-ticket-print-area" className="hidden print:block">
        {seatsToPrint.map((seat) => (
          <div key={`print-${seat.ticketCode}`} className="cinema-ticket-slip">
            {/* Cinema Header */}
            <div style={{ textAlign: 'center', borderBottom: '1px dashed #444', paddingBottom: '3mm' }}>
              <p style={{ fontWeight: 900, fontSize: '12pt', textTransform: 'uppercase', margin: 0 }}>
                CINEPREMIER CINEMAS
              </p>
              <p style={{ fontWeight: 700, fontSize: '8.5pt', margin: '2px 0 0 0' }}>{cinemaName}</p>
              <p style={{ fontSize: '7pt', color: '#444', margin: '2px 0 0 0' }}>{cinemaAddress}</p>
              <p style={{ fontSize: '6.5pt', color: '#666', margin: '2px 0 0 0' }}>Hotline: 1900 6017 · www.cinepremier.vn</p>
            </div>

            {/* Title */}
            <div style={{ textAlign: 'center', padding: '2.5mm 0', borderBottom: '1px solid #ddd' }}>
              <span style={{ fontSize: '7.5pt', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.15em', border: '1px solid #000', padding: '1px 6px' }}>
                VÉ VÀO CỬA · ADMISSION TICKET
              </span>
            </div>

            {/* Movie Info */}
            <div style={{ padding: '2.5mm 0', borderBottom: '1px dashed #444' }}>
              <p style={{ fontSize: '7pt', textTransform: 'uppercase', color: '#555', margin: 0 }}>Phim:</p>
              <p style={{ fontSize: '10.5pt', fontWeight: 900, textTransform: 'uppercase', margin: '1mm 0', lineHeight: 1.2 }}>
                {movieTitle}
              </p>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '7.5pt' }}>
                <span>Định dạng: <strong>2D Digital Phụ đề</strong></span>
                <span>Phòng: <strong style={{ fontSize: '8.5pt' }}>{roomName}</strong></span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '7.5pt', marginTop: '1mm' }}>
                <span>Suất: <strong>{showTime}</strong></span>
                <span>Ngày: <strong>{showDate}</strong></span>
              </div>
            </div>

            {/* Seat Box */}
            <div style={{ border: '2px solid #000', padding: '2.5mm', margin: '2.5mm 0', textAlign: 'center' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '7pt', borderBottom: '1px solid #ccc', paddingBottom: '1mm' }}>
                <span>PHÒNG: <strong>{roomName}</strong></span>
                <span>LOẠI: <strong>{TICKET_TYPE_MAP[seat.ticketType] || 'NGƯỜI LỚN'}</strong></span>
              </div>
              <div style={{ paddingTop: '1.5mm' }}>
                <span style={{ fontSize: '6.5pt', textTransform: 'uppercase', color: '#555', display: 'block' }}>SỐ GHẾ / SEAT</span>
                <span style={{ fontSize: '22pt', fontWeight: 900, fontFamily: 'monospace', letterSpacing: '2px', display: 'block', lineHeight: 1.1 }}>
                  {seat.name}
                </span>
                <span style={{ fontSize: '8pt', fontWeight: 700, display: 'block', marginTop: '1mm' }}>
                  Giá: {formatVnd(seat.price)}
                </span>
              </div>
            </div>

            {/* QR Code */}
            <div style={{ textAlign: 'center', margin: '2.5mm 0' }}>
              <QRCodeSVG
                value={seat.ticketCode || booking.bookingCode}
                size={82}
                level="M"
                includeMargin={false}
              />
              <p style={{ fontFamily: 'monospace', fontSize: '7pt', fontWeight: 700, margin: '1.5mm 0 0 0', letterSpacing: '1px' }}>
                {seat.ticketCode}
              </p>
            </div>

            {/* Footer details */}
            <div style={{ borderTop: '1px dashed #444', paddingTop: '1.5mm', fontSize: '7pt', lineHeight: 1.35 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Mã booking:</span>
                <strong>{booking.bookingCode}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Khách hàng:</span>
                <span>{customerName}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Thu ngân:</span>
                <span>{staffName}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Thời gian:</span>
                <span>{formatDateTime(printTimestamp)}</span>
              </div>
            </div>

            <p style={{ fontSize: '6pt', color: '#555', textAlign: 'center', margin: '2mm 0 1.5mm 0' }}>
              * Đã gồm 5% thuế GTGT. Vé có giá trị cho 01 người / 01 suất chiếu. Vui lòng giữ cuống vé.
            </p>

            {/* Tear Stub */}
            <div style={{ borderTop: '1px dashed #555', paddingTop: '1.5mm', marginTop: '1.5mm' }}>
              <p style={{ fontSize: '6pt', textAlign: 'center', margin: '0 0 1mm 0', letterSpacing: '1px' }}>
                - - - ✂ CUỐNG VÉ KIỂM SOÁT ✂ - - -
              </p>
              <div style={{ fontSize: '7pt' }}>
                <p style={{ fontWeight: 900, margin: 0, textTransform: 'uppercase' }}>{movieTitle}</p>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '0.5mm' }}>
                  <span>{roomName} · {showTime}</span>
                  <span style={{ fontWeight: 900, fontSize: '8.5pt' }}>GHẾ: {seat.name}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '6pt', color: '#555', marginTop: '0.5mm' }}>
                  <span>#{booking.bookingCode}</span>
                  <span>{showDate}</span>
                </div>
              </div>
            </div>
          </div>
        ))}

        {/* Food receipt in print */}
        {includeFoodReceipt && Array.isArray(booking.foods) && booking.foods.length > 0 && (
          <div className="cinema-ticket-slip">
            <div style={{ textAlign: 'center', borderBottom: '1px dashed #444', paddingBottom: '2.5mm' }}>
              <p style={{ fontWeight: 900, fontSize: '11pt', textTransform: 'uppercase', margin: 0 }}>
                CINEPREMIER CONCESSIONS
              </p>
              <p style={{ fontWeight: 700, fontSize: '8pt', margin: '1mm 0 0 0' }}>{cinemaName}</p>
              <p style={{ fontSize: '8pt', fontWeight: 900, margin: '1.5mm 0 0 0', textTransform: 'uppercase' }}>
                🍿 PHIẾU XUẤT QUẦY BẮP NƯỚC
              </p>
            </div>

            <div style={{ padding: '1.5mm 0', fontSize: '7.5pt', borderBottom: '1px solid #ddd', lineHeight: 1.35 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Booking:</span>
                <strong>{booking.bookingCode}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Khách hàng:</span>
                <span>{customerName}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>In lúc:</span>
                <span>{formatDateTime(printTimestamp)}</span>
              </div>
            </div>

            <div style={{ padding: '1.5mm 0' }}>
              {booking.foods.map((food, idx) => (
                <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '8pt', padding: '0.8mm 0' }}>
                  <div>
                    <strong>{food.name}</strong>
                    <div style={{ fontSize: '7pt', color: '#555' }}>{food.quantity} × {formatVnd(food.unitPrice || 0)}</div>
                  </div>
                  <strong>{formatVnd(food.totalPrice || food.quantity * (food.unitPrice || 0))}</strong>
                </div>
              ))}
            </div>

            <div style={{ borderTop: '2px solid #000', paddingTop: '1.5mm', display: 'flex', justifyContent: 'space-between', fontSize: '8.5pt', fontWeight: 900 }}>
              <span>TỔNG CỘNG:</span>
              <span>{formatVnd(booking.foods.reduce((acc, f) => acc + (f.totalPrice || f.quantity * (f.unitPrice || 0)), 0))}</span>
            </div>

            <div style={{ textAlign: 'center', margin: '2.5mm 0' }}>
              <QRCodeSVG value={`FO:${booking.bookingCode}`} size={75} level="M" includeMargin={false} />
            </div>

            <p style={{ fontSize: '6.5pt', textAlign: 'center', color: '#666', margin: '1.5mm 0 0 0' }}>
              Đưa phiếu này tại quầy Bắp Nước để nhận combo. Chúc bạn xem phim vui vẻ!
            </p>
          </div>
        )}
      </div>
    </AnimatePresence>
  );
}
