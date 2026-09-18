import React, { useState, useEffect } from 'react';
import {
  BarChart3, DollarSign, Ticket, Armchair, TrendingUp,
  RefreshCw, Calendar, FileText, ArrowUpRight
} from 'lucide-react';
import { useManagerCinema } from '../../context/ManagerCinemaContext';
import { getStoredAuth, request } from '../../services/authService';
import { useUiStore } from '../../stores/useUiStore';

export default function ManagerReportsPage() {
  const { selectedCinemaId, selectedCinema } = useManagerCinema();
  const showToast = useUiStore((state) => state.showToast);

  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);

  const token = () => getStoredAuth().accessToken;

  const loadReport = async () => {
    if (!selectedCinemaId) return;
    setLoading(true);
    try {
      const data = await request(`/api/v1/manager/cinemas/${selectedCinemaId}/reports/overview`, {
        token: token()
      });
      setReport(data);
    } catch (err) {
      showToast(err.message || 'Không thể tải báo cáo doanh thu rạp', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadReport();
  }, [selectedCinemaId]);

  const formatVND = (num) => (num || 0).toLocaleString('vi-VN') + ' đ';

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/[0.08] pb-5">
        <div>
          <span className="text-[10px] font-mono uppercase tracking-[0.2em] text-amber-400 font-bold">
            Báo cáo & Phân tích vận hành
          </span>
          <h1 className="text-2xl font-bold tracking-tight text-white mt-1">
            Báo cáo Doanh thu & Hiệu suất ({selectedCinema?.name})
          </h1>
          <p className="text-xs text-neutral-400 mt-0.5">
            Theo dõi dòng doanh thu từ vé xem phim, tỷ lệ lấp đầy phòng và các chỉ số hoạt động.
          </p>
        </div>

        <button
          onClick={loadReport}
          className="flex items-center gap-2 px-3 py-2 bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.1] rounded-lg text-xs font-medium text-neutral-200 transition-colors self-start sm:self-center"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-amber-400' : ''}`} />
          Làm mới báo cáo
        </button>
      </div>

      {/* KPI Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-5 rounded-xl bg-gradient-to-br from-[#161616] to-[#121212] border border-white/[0.08] space-y-2">
          <span className="text-xs text-neutral-400 font-medium">Doanh thu bán vé trong ngày</span>
          <p className="text-3xl font-extrabold text-white font-mono tracking-tight">
            {loading ? '...' : formatVND(report?.revenueToday)}
          </p>
          <div className="text-[11px] text-emerald-400 flex items-center gap-1 font-medium">
            <TrendingUp className="w-3.5 h-3.5" />
            <span>Doanh thu ghi nhận thực tế từ các đơn thành công</span>
          </div>
        </div>

        <div className="p-5 rounded-xl bg-gradient-to-br from-[#161616] to-[#121212] border border-white/[0.08] space-y-2">
          <span className="text-xs text-neutral-400 font-medium">Lượng vé phát hành hôm nay</span>
          <p className="text-3xl font-extrabold text-amber-400 font-mono tracking-tight">
            {loading ? '...' : `${(report?.ticketsSoldToday || 0).toLocaleString()} vé`}
          </p>
          <div className="text-[11px] text-neutral-400">
            Số vé khách đã mua qua quầy & trực tuyến
          </div>
        </div>

        <div className="p-5 rounded-xl bg-gradient-to-br from-[#161616] to-[#121212] border border-white/[0.08] space-y-2">
          <span className="text-xs text-neutral-400 font-medium">Tỷ lệ lấp đầy ghế bình quân</span>
          <p className="text-3xl font-extrabold text-blue-400 font-mono tracking-tight">
            {loading ? '...' : `${report?.averageOccupancyRate || 0}%`}
          </p>
          <div className="w-full bg-neutral-800 rounded-full h-2 overflow-hidden mt-1">
            <div
              className="bg-blue-500 h-2 rounded-full transition-all duration-500"
              style={{ width: `${Math.min(report?.averageOccupancyRate || 0, 100)}%` }}
            />
          </div>
        </div>
      </div>

      {/* Breakdown Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="border border-white/[0.08] rounded-xl bg-[#121212] p-5 space-y-4">
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <Calendar className="w-4 h-4 text-amber-400" />
            Tình trạng vận hành suất chiếu
          </h3>
          <div className="space-y-3 text-xs">
            <div className="flex justify-between py-2 border-b border-white/[0.04]">
              <span className="text-neutral-400">Số phòng chiếu đang mở</span>
              <span className="text-white font-bold">{report?.totalRoomsCount || 0} phòng</span>
            </div>
            <div className="flex justify-between py-2 border-b border-white/[0.04]">
              <span className="text-neutral-400">Suất chiếu hoạt động trong ngày</span>
              <span className="text-emerald-400 font-bold">{report?.activeShowtimesCount || 0} suất</span>
            </div>
            <div className="flex justify-between py-2">
              <span className="text-neutral-400">Cảnh báo tồn kho bắp nước</span>
              <span className="text-amber-400 font-bold">{report?.lowStockItemsCount || 0} mặt hàng</span>
            </div>
          </div>
        </div>

        <div className="border border-white/[0.08] rounded-xl bg-[#121212] p-5 space-y-4">
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <Armchair className="w-4 h-4 text-amber-400" />
            Khuyến nghị tối ưu hóa doanh thu
          </h3>
          <ul className="space-y-2 text-xs text-neutral-300 list-disc list-inside">
            <li>Tăng cường số suất chiếu vào các khung giờ cao điểm (18:00 - 21:30) cho các phim ăn khách.</li>
            <li>Kiểm tra và sửa chữa ngay các ghế đang ở trạng thái bảo trì để tối ưu hóa công suất phòng.</li>
            <li>Theo dõi các mặt hàng F&B sắp hết hàng để nhập kho kịp thời, tránh gián đoạn dịch vụ.</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
