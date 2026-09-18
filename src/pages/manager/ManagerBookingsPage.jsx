import React, { useState, useEffect } from 'react';
import {
  Ticket, Search, CheckCircle2, XCircle, Clock, Eye,
  RefreshCw, User, Calendar, MapPin, DollarSign
} from 'lucide-react';
import { useManagerCinema } from '../../context/ManagerCinemaContext';
import { getStoredAuth, request } from '../../services/authService';
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
      showToast(err.message || 'Không thể tải danh sách đơn đặt vé', 'error');
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

  const formatVND = (num) => (num || 0).toLocaleString('vi-VN') + ' đ';

  const getStatusBadge = (status) => {
    switch (status) {
      case 'PAID':
      case 'CONFIRMED':
        return <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"><CheckCircle2 className="w-3 h-3" /> Đã thanh toán</span>;
      case 'PENDING':
        return <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20"><Clock className="w-3 h-3" /> Chờ xử lý</span>;
      case 'CANCELLED':
      case 'REFUNDED':
        return <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-rose-500/10 text-rose-400 border border-rose-500/20"><XCircle className="w-3 h-3" /> {status === 'REFUNDED' ? 'Đã hoàn tiền' : 'Đã hủy'}</span>;
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
            Quản lý vé & Check-in
          </span>
          <h1 className="text-2xl font-bold tracking-tight text-white mt-1">
            Tra cứu Đơn đặt vé ({selectedCinema?.name})
          </h1>
          <p className="text-xs text-neutral-400 mt-0.5">
            Tìm kiếm mã đặt vé, thông tin khách hàng và kiểm tra tính hợp lệ của vé vào rạp.
          </p>
        </div>

        <button
          onClick={loadBookings}
          className="flex items-center gap-2 px-3 py-2 bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.1] rounded-lg text-xs font-medium text-neutral-200 transition-colors self-start sm:self-center"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-amber-400' : ''}`} />
          Làm mới
        </button>
      </div>

      {/* Search and Filters */}
      <div className="flex flex-col sm:flex-row items-center gap-3 bg-[#141414] border border-white/[0.08] p-3 rounded-xl text-xs">
        <form onSubmit={handleSearch} className="flex-1 flex items-center gap-2 w-full">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-neutral-500 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Tìm mã đơn (BOOK-...), số điện thoại, email hoặc tên khách..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-neutral-900 border border-white/[0.12] focus:border-amber-400 rounded-lg pl-9 pr-3 py-2 text-white text-xs outline-none placeholder-neutral-500"
            />
          </div>
          <button
            type="submit"
            className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-black font-semibold rounded-lg transition-colors shrink-0"
          >
            Tìm kiếm
          </button>
        </form>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="bg-neutral-900 border border-white/[0.12] focus:border-amber-400 rounded-lg px-3 py-2 text-white text-xs outline-none"
          >
            <option value="">Tất cả trạng thái</option>
            <option value="PAID">Đã thanh toán (PAID)</option>
            <option value="CONFIRMED">Đã xác nhận</option>
            <option value="REFUNDED">Đã hoàn tiền</option>
            <option value="CANCELLED">Đã hủy</option>
          </select>
        </div>
      </div>

      {/* Bookings Table */}
      {loading ? (
        <div className="py-16 text-center text-neutral-400 flex flex-col items-center gap-2">
          <RefreshCw className="w-5 h-5 animate-spin text-amber-400" />
          <p className="text-xs">Đang tìm kiếm đơn đặt vé...</p>
        </div>
      ) : bookings.length === 0 ? (
        <div className="py-16 text-center border border-dashed border-white/[0.08] rounded-xl bg-white/[0.01]">
          <Ticket className="w-10 h-10 text-neutral-600 mx-auto mb-3" />
          <p className="text-sm font-medium text-neutral-300">Không tìm thấy đơn đặt vé nào</p>
          <p className="text-xs text-neutral-500 mt-1">Hãy thử tìm theo từ khóa khác hoặc xóa bộ lọc.</p>
        </div>
      ) : (
        <div className="border border-white/[0.08] rounded-xl overflow-hidden bg-[#121212]">
          <table className="w-full text-left text-xs text-neutral-300">
            <thead className="bg-[#181818] border-b border-white/[0.08] text-[11px] uppercase tracking-wider text-neutral-400">
              <tr>
                <th className="p-3.5">Mã đơn đặt</th>
                <th className="p-3.5">Khách hàng</th>
                <th className="p-3.5">Suất chiếu / Phim</th>
                <th className="p-3.5">Ghế ngồi</th>
                <th className="p-3.5">Tổng thanh toán</th>
                <th className="p-3.5">Trạng thái</th>
                <th className="p-3.5 text-right">Chi tiết</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.06]">
              {bookings.map((b) => (
                <tr key={b.id} className="hover:bg-white/[0.02] transition-colors">
                  <td className="p-3.5 font-mono font-bold text-amber-400">
                    {b.bookingCode || `#${b.id}`}
                  </td>
                  <td className="p-3.5">
                    <p className="font-semibold text-white">{b.customerName || b.userFullName || 'Khách vãng lai'}</p>
                    <p className="text-[10px] text-neutral-500 mt-0.5">{b.customerPhone || b.userEmail || '—'}</p>
                  </td>
                  <td className="p-3.5">
                    <p className="font-semibold text-white">{b.movieTitle || 'Vé xem phim'}</p>
                    <p className="text-[10px] text-neutral-400 mt-0.5">
                      {b.startTime ? new Date(b.startTime).toLocaleString('vi-VN') : '—'}
                    </p>
                  </td>
                  <td className="p-3.5 font-mono font-medium text-neutral-200">
                    {b.seatCodes || b.seats || `${b.ticketCount || 1} vé`}
                  </td>
                  <td className="p-3.5 font-mono font-bold text-emerald-400">
                    {formatVND(b.totalAmount || b.finalAmount)}
                  </td>
                  <td className="p-3.5">
                    {getStatusBadge(b.status)}
                  </td>
                  <td className="p-3.5 text-right">
                    <button
                      onClick={() => viewBookingDetail(b)}
                      className="p-1.5 text-neutral-400 hover:text-white bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] rounded transition-colors inline-flex items-center gap-1 text-[11px]"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      Xem vé
                    </button>
                  </td>
                </tr>
              ))}
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
                  Mã vé: {selectedBooking.bookingCode || `#${selectedBooking.id}`}
                </span>
                <h3 className="font-bold text-white text-base mt-0.5">
                  Chi tiết Vé & Đơn hàng
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setDetailModalOpen(false)}
                className="text-neutral-400 hover:text-white text-base"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="bg-black/30 border border-white/[0.06] p-3 rounded-lg space-y-2">
                <div className="flex justify-between">
                  <span className="text-neutral-400">Phim:</span>
                  <span className="text-white font-bold">{selectedBooking.movieTitle || '—'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-neutral-400">Phòng chiếu:</span>
                  <span className="text-neutral-200">{selectedBooking.roomName || 'Phòng chiếu'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-neutral-400">Thời gian chiếu:</span>
                  <span className="text-amber-300 font-mono">
                    {selectedBooking.startTime ? new Date(selectedBooking.startTime).toLocaleString('vi-VN') : '—'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-neutral-400">Ghế đã chọn:</span>
                  <span className="text-white font-mono font-bold">
                    {selectedBooking.seatCodes || selectedBooking.seats || '—'}
                  </span>
                </div>
              </div>

              <div className="bg-black/30 border border-white/[0.06] p-3 rounded-lg space-y-2">
                <div className="flex justify-between">
                  <span className="text-neutral-400">Khách hàng:</span>
                  <span className="text-white font-medium">{selectedBooking.customerName || selectedBooking.userFullName || 'Khách vãng lai'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-neutral-400">Số điện thoại / Email:</span>
                  <span className="text-neutral-300">{selectedBooking.customerPhone || selectedBooking.userEmail || '—'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-neutral-400">Trạng thái thanh toán:</span>
                  {getStatusBadge(selectedBooking.status)}
                </div>
                <div className="flex justify-between pt-1 border-t border-white/[0.04]">
                  <span className="text-neutral-400 font-bold">Tổng tiền thanh toán:</span>
                  <span className="text-emerald-400 font-mono font-black text-sm">
                    {formatVND(selectedBooking.totalAmount || selectedBooking.finalAmount)}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex justify-end pt-2 border-t border-white/[0.08]">
              <button
                type="button"
                onClick={() => setDetailModalOpen(false)}
                className="px-4 py-2 bg-neutral-800 hover:bg-neutral-700 text-white font-medium rounded-lg text-xs transition-colors"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
