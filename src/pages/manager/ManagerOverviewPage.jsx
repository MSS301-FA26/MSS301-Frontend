import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  DollarSign, Ticket, Users, AlertTriangle, Calendar,
  Layers, ArrowUpRight, TrendingUp, RefreshCw, Armchair,
  ShoppingBag, ShieldCheck, Clock
} from 'lucide-react';
import { useManagerCinema } from '../../context/ManagerCinemaContext';
import { getStoredAuth, request } from '../../services/authService';

export default function ManagerOverviewPage() {
  const { selectedCinemaId, selectedCinema } = useManagerCinema();
  const [overview, setOverview] = useState(null);
  const [showtimes, setShowtimes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const token = () => getStoredAuth().accessToken;

  const loadData = async () => {
    if (!selectedCinemaId) return;
    setLoading(true);
    setError('');
    try {
      const [overviewData, showtimesData] = await Promise.all([
        request(`/api/v1/manager/cinemas/${selectedCinemaId}/reports/overview`, { token: token() }),
        request(`/api/v1/manager/cinemas/${selectedCinemaId}/showtimes?size=6`, { token: token() }).catch(() => ({ items: [] }))
      ]);
      setOverview(overviewData);
      setShowtimes(showtimesData?.items || []);
    } catch (err) {
      setError(err.message || 'Không tải được báo cáo tổng quan rạp.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [selectedCinemaId]);

  const formatVND = (num) => {
    return (num || 0).toLocaleString('vi-VN') + ' đ';
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/[0.08] pb-5">
        <div>
          <span className="text-[10px] font-mono uppercase tracking-[0.2em] text-amber-400 font-bold">
            Bảng điều khiển quản lý rạp
          </span>
          <h1 className="text-2xl font-bold tracking-tight text-white mt-1">
            {selectedCinema?.name || 'Chi nhánh rạp'}
          </h1>
          <p className="text-xs text-neutral-400 mt-0.5">
            Dữ liệu tổng quan theo thời gian thực và vận hành thường nhật.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={loadData}
            disabled={loading}
            className="flex items-center gap-2 px-3 py-2 bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.1] rounded-lg text-xs font-medium text-neutral-200 transition-colors"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-amber-400' : ''}`} />
            Làm mới
          </button>
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Doanh thu hôm nay */}
        <div className="p-4 rounded-xl bg-gradient-to-br from-[#161616] to-[#121212] border border-white/[0.08] space-y-2">
          <div className="flex items-center justify-between text-neutral-400">
            <span className="text-xs font-medium">Doanh thu hôm nay</span>
            <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400">
              <DollarSign className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-white tracking-tight">
            {loading ? '...' : formatVND(overview?.revenueToday)}
          </div>
          <div className="text-[11px] text-neutral-500 flex items-center gap-1">
            <TrendingUp className="w-3 h-3 text-emerald-400" />
            <span>Phạm vi chi nhánh hiện tại</span>
          </div>
        </div>

        {/* Vé bán ra hôm nay */}
        <div className="p-4 rounded-xl bg-gradient-to-br from-[#161616] to-[#121212] border border-white/[0.08] space-y-2">
          <div className="flex items-center justify-between text-neutral-400">
            <span className="text-xs font-medium">Vé đã bán hôm nay</span>
            <div className="p-2 rounded-lg bg-amber-500/10 text-amber-400">
              <Ticket className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-white tracking-tight">
            {loading ? '...' : `${(overview?.ticketsSoldToday || 0).toLocaleString()} vé`}
          </div>
          <div className="text-[11px] text-neutral-500">
            Tổng số vé đã xuất tại cụm rạp
          </div>
        </div>

        {/* Tỷ lệ lấp đầy phòng */}
        <div className="p-4 rounded-xl bg-gradient-to-br from-[#161616] to-[#121212] border border-white/[0.08] space-y-2">
          <div className="flex items-center justify-between text-neutral-400">
            <span className="text-xs font-medium">Tỷ lệ lấp đầy TB</span>
            <div className="p-2 rounded-lg bg-blue-500/10 text-blue-400">
              <Armchair className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-white tracking-tight">
            {loading ? '...' : `${overview?.averageOccupancyRate || 0}%`}
          </div>
          <div className="w-full bg-neutral-800 rounded-full h-1.5 overflow-hidden">
            <div
              className="bg-blue-500 h-1.5 rounded-full transition-all duration-500"
              style={{ width: `${Math.min(overview?.averageOccupancyRate || 0, 100)}%` }}
            />
          </div>
        </div>

        {/* Cảnh báo kho F&B */}
        <div className="p-4 rounded-xl bg-gradient-to-br from-[#161616] to-[#121212] border border-white/[0.08] space-y-2">
          <div className="flex items-center justify-between text-neutral-400">
            <span className="text-xs font-medium">Cảnh báo kho F&B</span>
            <div className={`p-2 rounded-lg ${overview?.lowStockItemsCount > 0 ? 'bg-rose-500/10 text-rose-400 animate-pulse' : 'bg-neutral-800 text-neutral-400'}`}>
              <AlertTriangle className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-white tracking-tight">
            {loading ? '...' : `${overview?.lowStockItemsCount || 0} món`}
          </div>
          <div className="text-[11px] text-neutral-500">
            {overview?.lowStockItemsCount > 0 ? (
              <span className="text-rose-400 font-medium">Cần bổ sung hàng vào kho</span>
            ) : (
              <span>Tồn kho đạt mức an toàn</span>
            )}
          </div>
        </div>
      </div>

      {/* Quick Action Shortcuts */}
      <div className="border border-white/[0.08] rounded-xl bg-[#121212] p-5 space-y-3">
        <h2 className="text-xs font-mono uppercase tracking-wider text-neutral-400 font-semibold">
          Thao tác vận hành nhanh
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Link
            to="/manager/showtimes"
            className="flex items-center gap-2.5 p-3 rounded-lg bg-white/[0.03] hover:bg-amber-500/10 border border-white/[0.06] hover:border-amber-500/30 text-xs font-medium text-neutral-200 hover:text-amber-400 transition-all group"
          >
            <Calendar className="w-4 h-4 text-amber-400 group-hover:scale-110 transition-transform" />
            <span>Xếp suất chiếu</span>
          </Link>

          <Link
            to="/manager/rooms"
            className="flex items-center gap-2.5 p-3 rounded-lg bg-white/[0.03] hover:bg-blue-500/10 border border-white/[0.06] hover:border-blue-500/30 text-xs font-medium text-neutral-200 hover:text-blue-400 transition-all group"
          >
            <Layers className="w-4 h-4 text-blue-400 group-hover:scale-110 transition-transform" />
            <span>Khóa / mở ghế hỏng</span>
          </Link>

          <Link
            to="/manager/inventory"
            className="flex items-center gap-2.5 p-3 rounded-lg bg-white/[0.03] hover:bg-emerald-500/10 border border-white/[0.06] hover:border-emerald-500/30 text-xs font-medium text-neutral-200 hover:text-emerald-400 transition-all group"
          >
            <ShoppingBag className="w-4 h-4 text-emerald-400 group-hover:scale-110 transition-transform" />
            <span>Điều chỉnh kho F&B</span>
          </Link>

          <Link
            to="/manager/bookings"
            className="flex items-center gap-2.5 p-3 rounded-lg bg-white/[0.03] hover:bg-purple-500/10 border border-white/[0.06] hover:border-purple-500/30 text-xs font-medium text-neutral-200 hover:text-purple-400 transition-all group"
          >
            <Ticket className="w-4 h-4 text-purple-400 group-hover:scale-110 transition-transform" />
            <span>Tra cứu & Check-in vé</span>
          </Link>
        </div>
      </div>

      {/* Showtimes & Operational Status */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: Today Showtimes */}
        <div className="lg:col-span-2 border border-white/[0.08] rounded-xl bg-[#121212] p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-bold text-white flex items-center gap-2">
                <Calendar className="w-4 h-4 text-amber-400" />
                Lịch chiếu gần nhất tại rạp
              </h2>
              <p className="text-xs text-neutral-400 mt-0.5">Các suất chiếu đang mở bán hoặc chuẩn bị chiếu</p>
            </div>
            <Link
              to="/manager/showtimes"
              className="text-xs text-amber-400 hover:text-amber-300 font-medium flex items-center gap-1"
            >
              Xem tất cả <ArrowUpRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          {loading ? (
            <p className="text-xs text-neutral-500 py-6 text-center">Đang tải suất chiếu...</p>
          ) : showtimes.length === 0 ? (
            <div className="py-8 text-center border border-dashed border-white/[0.06] rounded-lg">
              <Calendar className="w-8 h-8 text-neutral-600 mx-auto mb-2" />
              <p className="text-xs text-neutral-400">Hôm nay chưa có suất chiếu nào được xếp.</p>
              <Link to="/manager/showtimes" className="text-xs text-amber-400 font-medium underline mt-1 inline-block">
                Thêm suất chiếu ngay
              </Link>
            </div>
          ) : (
            <div className="divide-y divide-white/[0.06]">
              {showtimes.map((st) => (
                <div key={st.id} className="py-3 flex items-center justify-between gap-3 text-xs">
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-white truncate">{st.movieTitle || `Phim #${st.movieId}`}</p>
                    <p className="text-[11px] text-neutral-400 mt-0.5">
                      Phòng: <span className="text-neutral-200">{st.roomName || `Phòng ${st.roomId}`}</span> · Bắt đầu: <span className="text-amber-300 font-mono">{st.startTime}</span>
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-white/[0.04] text-neutral-300 border border-white/[0.08]">
                      {st.status || 'SCHEDULED'}
                    </span>
                    <p className="text-[10px] text-neutral-500 mt-1 font-mono">
                      {formatVND(st.price)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Right 1 Col: Cinema Info & Staff Snapshot */}
        <div className="space-y-4">
          <div className="border border-white/[0.08] rounded-xl bg-[#121212] p-5 space-y-3">
            <h3 className="text-xs font-mono uppercase tracking-wider text-neutral-400 font-semibold">
              Thông tin chi nhánh
            </h3>
            <div className="space-y-2 text-xs">
              <div className="flex justify-between py-1 border-b border-white/[0.04]">
                <span className="text-neutral-400">Tên rạp</span>
                <span className="text-white font-medium">{selectedCinema?.name || '—'}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-white/[0.04]">
                <span className="text-neutral-400">Địa chỉ</span>
                <span className="text-neutral-300 font-medium truncate max-w-[180px]" title={selectedCinema?.address}>
                  {selectedCinema?.address || '—'}
                </span>
              </div>
              <div className="flex justify-between py-1 border-b border-white/[0.04]">
                <span className="text-neutral-400">Số phòng chiếu</span>
                <span className="text-amber-400 font-bold">{overview?.totalRoomsCount || 0} phòng</span>
              </div>
              <div className="flex justify-between py-1">
                <span className="text-neutral-400">Suất chiếu hoạt động</span>
                <span className="text-emerald-400 font-bold">{overview?.activeShowtimesCount || 0} suất</span>
              </div>
            </div>
          </div>

          <div className="border border-white/[0.08] rounded-xl bg-[#121212] p-5 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-mono uppercase tracking-wider text-neutral-400 font-semibold">
                Đội ngũ nhân viên
              </h3>
              <Link to="/manager/staff" className="text-xs text-amber-400 hover:text-amber-300">
                Quản lý →
              </Link>
            </div>
            <p className="text-xs text-neutral-400">
              Quản lý danh sách nhân viên phục vụ, soát vé và vận hành tại cụm rạp của bạn.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
