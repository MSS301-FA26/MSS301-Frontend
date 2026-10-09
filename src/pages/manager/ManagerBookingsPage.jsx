import React, { useState, useEffect } from 'react';
import {
  Ticket, Search, CheckCircle2, XCircle, Clock, Eye,
  RefreshCw, User, Calendar, MapPin, DollarSign, RotateCcw,
  AlertTriangle, Wallet
} from 'lucide-react';
import { useManagerCinema } from '../../context/ManagerCinemaContext';
import { getStoredAuth, request } from '../../services/authService';
import { adminService } from '../../services/adminService';
import { useUiStore } from '../../stores/useUiStore';

export default function ManagerBookingsPage() {
  const { selectedCinemaId, selectedCinema } = useManagerCinema();
  const showToast = useUiStore((state) => state.showToast);

  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [selectedBooking, setSelectedBooking] = useState(null);
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [loadingDetail, setLoadingDetail] = useState(false);

  // Refund Modal State
  const [refundModalOpen, setRefundModalOpen] = useState(false);
  const [refundTarget, setRefundTarget] = useState(null);
  const [refundReason, setRefundReason] = useState('Kh?ch h?ng y?u c?u ho?n v?');
  const [isRefunding, setIsRefunding] = useState(false);

  const token = () => getStoredAuth().accessToken;

  const loadBookings = async () => {
    if (!selectedCinemaId) return;
    setLoading(true);
    try {
      let url = `/api/v1/manager/cinemas/${selectedCinemaId}/bookings?size=50`;
      if (searchQuery.trim()) url += `&query=${encodeURIComponent(searchQuery.trim())}`;
      if (statusFilter) url += `&status=${encodeURIComponent(statusFilter)}`;

      const data = await request(url, { token: token() });
      setBookings(data?.items || (Array.isArray(data) ? data : []));
    } catch (err) {
      showToast(err.message || 'Kh?ng th? t?i danh s?ch ??n ??t v?', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadBookings();
  }, [selectedCinemaId, statusFilter]);

  const handleSearch = (e) => {
    e.preventDefault();
    loadBookings();
  };

  const viewBookingDetail = async (item) => {
    setSelectedBooking(item);
    setDetailModalOpen(true);
    setLoadingDetail(true);
    try {
      const fullDetail = await request(
        `/api/v1/manager/cinemas/${selectedCinemaId}/bookings/${item.id}`,
        { token: token() }
      );
      setSelectedBooking(fullDetail);
    } catch {
      // keep basic info
    } finally {
      setLoadingDetail(false);
    }
  };

  const openRefundModal = (booking) => {
    setRefundTarget(booking);
    setRefundReason('Kh?ch h?ng y?u c?u ho?n v?');
    setRefundModalOpen(true);
  };

  const handleConfirmRefund = async () => {
    if (!refundTarget) return;
    setIsRefunding(true);
    try {
      await adminService.refundBookingAdmin(token(), refundTarget.id, refundReason.trim());
      showToast(`?? ho?n ti?n ${formatVND(refundTarget.totalAmount || refundTarget.finalAmount)} v?o CineWallet c?a kh?ch h?ng th?nh c?ng!`, 'success');
      setRefundModalOpen(false);
      setRefundTarget(null);
      if (detailModalOpen) setDetailModalOpen(false);
      loadBookings();
    } catch (err) {
      showToast(err.message || 'Kh?ng th? ho?n ti?n v?. Vui l?ng ki?m tra l?i.', 'error');
    } finally {
      setIsRefunding(false);
    }
  };

  const formatVND = (num) => (num || 0).toLocaleString('vi-VN') + ' ?';

  const getStatusBadge = (status) => {
    switch (status) {
      case 'PAID':
      case 'CONFIRMED':
        return <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"><CheckCircle2 className="w-3 h-3" /> ?? thanh to?n</span>;
      case 'PENDING':
      case 'PENDING_PAYMENT':
      case 'HOLDING':
        return <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20"><Clock className="w-3 h-3" /> Ch? x? l?</span>;
      case 'REFUNDED':
        return <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-purple-500/10 text-purple-400 border border-purple-500/20"><RotateCcw className="w-3 h-3" /> ?? ho?n ti?n CineWallet</span>;
      case 'CANCELLED':
        return <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-rose-500/10 text-rose-400 border border-rose-500/20"><XCircle className="w-3 h-3" /> ?? h?y</span>;
      case 'USED':
        return <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-sky-500/10 text-sky-400 border border-sky-500/20"><CheckCircle2 className="w-3 h-3" /> ?? check-in</span>;
      default:
        return <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] bg-neutral-800 text-neutral-300">{status}</span>;
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/[0.08] pb-5">
        <div>
          <span className="text-[10px] font-mono uppercase tracking-[0.2em] text-amber-400 font-bold">
            Qu?n l? v? & Ho?n ti?n
          </span>
          <h1 className="text-2xl font-bold tracking-tight text-white mt-1">
            Tra c?u & X? l? V? ({selectedCinema?.name})
          </h1>
          <p className="text-xs text-neutral-400 mt-0.5">
            T?m ki?m m? ??t v?, ki?m tra tr?ng th?i v? v? th?c hi?n ho?n ti?n v?o CineWallet c?a kh?ch h?ng khi c? y?u c?u.
          </p>
        </div>

        <button
          onClick={loadBookings}
          className="flex items-center gap-2 px-3 py-2 bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.1] rounded-lg text-xs font-medium text-neutral-200 transition-colors self-start sm:self-center"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-amber-400' : ''}`} />
          L?m m?i
        </button>
      </div>

      {/* Search and Filters */}
      <div className="flex flex-col sm:flex-row items-center gap-3 bg-[#141414] border border-white/[0.08] p-3 rounded-xl text-xs">
        <form onSubmit={handleSearch} className="flex-1 flex items-center gap-2 w-full">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-neutral-500 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="T?m m? ??n (BOOK-...), s? ?i?n tho?i, email ho?c t?n kh?ch..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-neutral-900 border border-white/[0.12] focus:border-amber-400 rounded-lg pl-9 pr-3 py-2 text-white text-xs outline-none placeholder-neutral-500"
            />
          </div>
          <button
            type="submit"
            className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-black font-semibold rounded-lg transition-colors shrink-0"
          >
            T?m ki?m
          </button>
        </form>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="bg-neutral-900 border border-white/[0.12] focus:border-amber-400 rounded-lg px-3 py-2 text-white text-xs outline-none"
          >
            <option value="">T?t c? tr?ng th?i</option>
            <option value="PAID">?? thanh to?n (PAID)</option>
            <option value="USED">?? check-in (USED)</option>
            <option value="REFUNDED">?? ho?n ti?n (REFUNDED)</option>
            <option value="CANCELLED">?? h?y (CANCELLED)</option>
          </select>
        </div>
      </div>

      {/* Bookings Table */}
      {loading ? (
        <div className="py-16 text-center text-neutral-400 flex flex-col items-center gap-2">
          <RefreshCw className="w-5 h-5 animate-spin text-amber-400" />
          <p className="text-xs">?ang t?m ki?m ??n ??t v?...</p>
        </div>
      ) : bookings.length === 0 ? (
        <div className="py-16 text-center border border-dashed border-white/[0.08] rounded-xl bg-white/[0.01]">
          <Ticket className="w-10 h-10 text-neutral-600 mx-auto mb-3" />
          <p className="text-sm font-medium text-neutral-300">Kh?ng t?m th?y ??n ??t v? n?o</p>
          <p className="text-xs text-neutral-500 mt-1">H?y th? t?m theo t? kh?a kh?c ho?c x?a b? l?c.</p>
        </div>
      ) : (
        <div className="border border-white/[0.08] rounded-xl overflow-hidden bg-[#121212]">
          <table className="w-full text-left text-xs text-neutral-300">
            <thead className="bg-[#181818] border-b border-white/[0.08] text-[11px] uppercase tracking-wider text-neutral-400">
              <tr>
                <th className="p-3.5">M? ??n ??t</th>
                <th className="p-3.5">Kh?ch h?ng</th>
                <th className="p-3.5">Su?t chi?u / Phim</th>
                <th className="p-3.5">Gh? ng?i</th>
                <th className="p-3.5">T?ng thanh to?n</th>
                <th className="p-3.5">Tr?ng th?i</th>
                <th className="p-3.5 text-right">Thao t?c</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.06]">
              {bookings.map((b) => {
                const canRefund = (b.status === 'PAID' || b.status === 'CONFIRMED');
                return (
                  <tr key={b.id} className="hover:bg-white/[0.02] transition-colors">
                    <td className="p-3.5 font-mono font-bold text-amber-400">
                      {b.bookingCode || `#${b.id}`}
                    </td>
                    <td className="p-3.5">
                      <p className="font-semibold text-white">{b.customerName || b.userFullName || 'Kh?ch v?ng lai'}</p>
                      <p className="text-[10px] text-neutral-500 mt-0.5">{b.customerPhone || b.userEmail || '-'}</p>
                    </td>
                    <td className="p-3.5">
                      <p className="font-semibold text-white">{b.movieTitle || b.movieTitleSnapshot || 'V? xem phim'}</p>
                      <p className="text-[10px] text-neutral-400 mt-0.5">
                        {b.startTime || b.showtimeStartSnapshot ? new Date(b.startTime || b.showtimeStartSnapshot).toLocaleString('vi-VN') : '-'}
                      </p>
                    </td>
                    <td className="p-3.5 font-mono font-medium text-neutral-200">
                      {b.seatCodes || b.seats || `${b.ticketCount || 1} v?`}
                    </td>
                    <td className="p-3.5 font-mono font-bold text-emerald-400">
                      {formatVND(b.totalAmount || b.finalAmount)}
                    </td>
                    <td className="p-3.5">
                      {getStatusBadge(b.status)}
                    </td>
                    <td className="p-3.5 text-right space-x-1.5">
                      <button
                        onClick={() => viewBookingDetail(b)}
                        className="p-1.5 text-neutral-400 hover:text-white bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] rounded transition-colors inline-flex items-center gap-1 text-[11px]"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        Chi ti?t
                      </button>
                      {canRefund && (
                        <button
                          onClick={() => openRefundModal(b)}
                          className="p-1.5 text-purple-300 hover:text-purple-100 bg-purple-950/40 hover:bg-purple-900/60 border border-purple-500/30 rounded transition-colors inline-flex items-center gap-1 text-[11px]"
                          title="Ho?n ti?n v? v?o CineWallet c?a kh?ch"
                        >
                          <RotateCcw className="w-3.5 h-3.5" />
                          Ho?n v?
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Booking Detail Modal */}
      {detailModalOpen && selectedBooking && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="bg-[#181818] border border-white/[0.12] rounded-xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-white/[0.08] pb-3">
              <div>
                <span className="text-[10px] font-mono text-amber-400 uppercase tracking-wider block">
                  M? v?: {selectedBooking.bookingCode || `#${selectedBooking.id}`}
                </span>
                <h3 className="font-bold text-white text-base mt-0.5">
                  Chi ti?t V? & ??n h?ng
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setDetailModalOpen(false)}
                className="text-neutral-400 hover:text-white text-base"
              >
                ?
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="bg-black/30 border border-white/[0.06] p-3 rounded-lg space-y-2">
                <div className="flex justify-between">
                  <span className="text-neutral-400">Phim:</span>
                  <span className="text-white font-bold">{selectedBooking.movieTitle || selectedBooking.movieTitleSnapshot || '-'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-neutral-400">Ph?ng chi?u:</span>
                  <span className="text-neutral-200">{selectedBooking.roomName || selectedBooking.roomNameSnapshot || 'Ph?ng chi?u'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-neutral-400">Th?i gian chi?u:</span>
                  <span className="text-amber-300 font-mono">
                    {selectedBooking.startTime || selectedBooking.showtimeStartSnapshot ? new Date(selectedBooking.startTime || selectedBooking.showtimeStartSnapshot).toLocaleString('vi-VN') : '-'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-neutral-400">Gh? ?? ch?n:</span>
                  <span className="text-white font-mono font-bold">
                    {selectedBooking.seatCodes || selectedBooking.seats || '-'}
                  </span>
                </div>
              </div>

              <div className="bg-black/30 border border-white/[0.06] p-3 rounded-lg space-y-2">
                <div className="flex justify-between">
                  <span className="text-neutral-400">Kh?ch h?ng:</span>
                  <span className="text-white font-medium">{selectedBooking.customerName || selectedBooking.userFullName || 'Kh?ch v?ng lai'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-neutral-400">S? ?i?n tho?i / Email:</span>
                  <span className="text-neutral-300">{selectedBooking.customerPhone || selectedBooking.userEmail || '-'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-neutral-400">Tr?ng th?i thanh to?n:</span>
                  {getStatusBadge(selectedBooking.status)}
                </div>
                {selectedBooking.status === 'REFUNDED' && (
                  <div className="p-2.5 bg-purple-950/30 border border-purple-500/20 rounded-lg text-purple-300 text-[11px] space-y-1">
                    <p className="font-semibold flex items-center gap-1.5">
                      <Wallet className="w-3.5 h-3.5 text-purple-400" /> ?? ho?n ti?n v?o CineWallet
                    </p>
                    <p className="text-neutral-400">L? do: {selectedBooking.refundReason || 'Ho?n v? theo y?u c?u'}</p>
                    {selectedBooking.refundedAt && (
                      <p className="text-neutral-500 text-[10px]">Th?i gian ho?n: {new Date(selectedBooking.refundedAt).toLocaleString('vi-VN')}</p>
                    )}
                  </div>
                )}
                <div className="flex justify-between pt-1 border-t border-white/[0.04]">
                  <span className="text-neutral-400 font-bold">T?ng ti?n thanh to?n:</span>
                  <span className="text-emerald-400 font-mono font-black text-sm">
                    {formatVND(selectedBooking.totalAmount || selectedBooking.finalAmount)}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-white/[0.08]">
              {(selectedBooking.status === 'PAID' || selectedBooking.status === 'CONFIRMED') && (
                <button
                  type="button"
                  onClick={() => openRefundModal(selectedBooking)}
                  className="px-3 py-2 bg-purple-600 hover:bg-purple-500 text-white font-medium rounded-lg text-xs transition-colors flex items-center gap-1.5"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  Ho?n v? v?o CineWallet
                </button>
              )}
              <button
                type="button"
                onClick={() => setDetailModalOpen(false)}
                className="px-4 py-2 bg-neutral-800 hover:bg-neutral-700 text-white font-medium rounded-lg text-xs transition-colors"
              >
                ??ng
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Refund Confirmation Modal */}
      {refundModalOpen && refundTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-[#181818] border border-purple-500/30 rounded-xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center gap-3 border-b border-white/[0.08] pb-3">
              <div className="w-9 h-9 rounded-lg bg-purple-500/15 border border-purple-500/30 flex items-center justify-center text-purple-400">
                <RotateCcw className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-white text-base">
                  X?c nh?n ho?n ti?n v?
                </h3>
                <p className="text-xs text-neutral-400">
                  ??n v? #{refundTarget.bookingCode || refundTarget.id}
                </p>
              </div>
            </div>

            <div className="space-y-3 text-xs">
              <div className="bg-purple-950/20 border border-purple-500/20 p-3 rounded-lg space-y-1.5 text-purple-200">
                <div className="flex justify-between">
                  <span className="text-neutral-400">Kh?ch h?ng:</span>
                  <span className="font-semibold text-white">{refundTarget.customerName || refundTarget.userFullName || 'Kh?ch h?ng'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-neutral-400">Phim:</span>
                  <span className="text-white">{refundTarget.movieTitle || refundTarget.movieTitleSnapshot || '-'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-neutral-400">Gh?:</span>
                  <span className="font-mono text-white">{refundTarget.seatCodes || refundTarget.seats || '-'}</span>
                </div>
                <div className="flex justify-between pt-1 border-t border-purple-500/20">
                  <span className="font-semibold">S? ti?n ho?n v?o CineWallet:</span>
                  <span className="font-mono font-black text-amber-400 text-sm">
                    {formatVND(refundTarget.totalAmount || refundTarget.finalAmount)}
                  </span>
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-medium text-neutral-300 mb-1">
                  L? do ho?n ti?n:
                </label>
                <textarea
                  value={refundReason}
                  onChange={(e) => setRefundReason(e.target.value)}
                  placeholder="Nh?p l? do ho?n v?..."
                  rows={3}
                  className="w-full bg-neutral-900 border border-white/[0.12] focus:border-purple-400 rounded-lg p-2.5 text-white text-xs outline-none resize-none"
                />
              </div>

              <div className="flex items-start gap-2 p-2.5 bg-amber-500/10 border border-amber-500/20 rounded-lg text-amber-300 text-[11px]">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-amber-400" />
                <p>
                  Ti?n v? s? ???c c?ng tr?c ti?p v?o <strong>CineWallet</strong> c?a kh?ch h?ng ngay l?p t?c v? c?c gh? ?? ch?n s? ???c gi?i ph?ng tr? l?i ph?ng chi?u.
                </p>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-white/[0.08]">
              <button
                type="button"
                onClick={() => setRefundModalOpen(false)}
                disabled={isRefunding}
                className="px-4 py-2 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 font-medium rounded-lg text-xs transition-colors"
              >
                H?y b?
              </button>
              <button
                type="button"
                onClick={handleConfirmRefund}
                disabled={isRefunding}
                className="px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white font-semibold rounded-lg text-xs transition-colors flex items-center gap-1.5 disabled:opacity-50"
              >
                {isRefunding ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    ?ang x? l?...
                  </>
                ) : (
                  <>
                    <RotateCcw className="w-3.5 h-3.5" />
                    X?c nh?n ho?n ti?n
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
