import React, { useMemo, useState } from 'react';
import {
  Activity,
  AlertCircle,
  ArrowUpRight,
  BarChart3,
  Building2,
  Calendar,
  CheckCircle2,
  Clock,
  Compass,
  DollarSign,
  Film,
  Globe,
  Layers,
  Lock,
  MapPin,
  Popcorn,
  ReceiptText,
  RefreshCw,
  Search,
  Shield,
  ShieldAlert,
  ShoppingBag,
  Sliders,
  Sparkles,
  Ticket,
  TrendingDown,
  TrendingUp,
  Undo2,
  Users
} from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from 'recharts';
import useAdminReport from './useAdminReport';
import {
  Card,
  ChartTip,
  COLORS,
  DataTable,
  DistributionBarChart,
  Empty,
  Metric,
  ReportBody,
  ReportFilters,
  ReportHeader,
  ReportNote,
  RevenueChart
} from './ReportComponents';
import {
  compact,
  downloadCsv,
  number,
  percent,
  ratio,
  shortDate,
  STATUS_LABELS,
  vnd
} from './reportUtils';
import './reports.css';

// ============================================================================
// 1. ADMIN SYSTEM OVERVIEW (TOÀN HỆ THỐNG)
// ============================================================================
function AdminSystemOverviewView({ ctx }) {
  const report = useAdminReport(ctx);
  const { data, applied, cinemas, setCinemaFilter } = report;
  const summary = data?.summary;
  const navigate = ctx.changeAdminSection || ctx.onSectionChange || (() => {});

  const [cinemaSearch, setCinemaSearch] = useState('');
  const [cinemaSort, setCinemaSort] = useState('totalRevenue');

  const isFilteredSingleCinema = Boolean(applied.cinemaId);
  const filteredCinemaName = isFilteredSingleCinema
    ? cinemas.find(c => String(c.id) === String(applied.cinemaId))?.name || `Rạp #${applied.cinemaId}`
    : null;

  // Filter & sort cinemas list
  const filteredCinemas = useMemo(() => {
    return (data?.cinemas || [])
      .filter(c => c.cinemaName.toLocaleLowerCase('vi').includes(cinemaSearch.toLocaleLowerCase('vi')))
      .sort((a, b) => Number(b[cinemaSort] ?? 0) - Number(a[cinemaSort] ?? 0));
  }, [data?.cinemas, cinemaSearch, cinemaSort]);

  const topMovies = useMemo(() => {
    return (data?.topMovies || []).slice(0, 5);
  }, [data?.topMovies]);

  const peakHours = useMemo(() => {
    return data?.peakHours || [];
  }, [data?.peakHours]);

  const exportReport = () => {
    const suffix = `${applied.from}-${applied.to}`;
    const filename = isFilteredSingleCinema
      ? `tong-quan-${(filteredCinemaName || 'rap').toLowerCase().replace(/\s+/g, '-')}-${suffix}`
      : `tong-quan-toan-he-thong-${suffix}`;

    downloadCsv(
      filename,
      [
        'Cụm rạp',
        'Doanh thu vé (VND)',
        'Doanh thu F&B (VND)',
        'Tổng doanh thu (VND)',
        'Vé đã bán',
        'Giao dịch',
        'Suất chiếu',
        'Lấp đầy (%)'
      ],
      data.cinemas.map(c => [
        c.cinemaName,
        c.ticketRevenue,
        c.foodRevenue,
        c.totalRevenue,
        c.ticketsSold,
        c.transactions,
        c.showtimes,
        c.occupancyRate
      ])
    );
  };

  const totalCinemasCount = cinemas.length || data?.cinemas?.length || 0;

  return (
    <div className="admin-report">
      {/* Header */}
      <ReportHeader
        eyebrow="CINEPREMIER / ĐIỀU HÀNH TỔNG QUAN HỆ THỐNG"
        title={isFilteredSingleCinema ? `Tổng quan hệ thống • ${filteredCinemaName}` : 'Tổng quan toàn hệ thống'}
        description={
          isFilteredSingleCinema
            ? `Đang xem số liệu trích xuất của cụm rạp ${filteredCinemaName}. Chọn lại "Toàn bộ hệ thống" trong bộ lọc để xem tổng quan đa chi nhánh.`
            : 'Trung tâm giám sát toàn diện chuỗi rạp: phân tích doanh thu đa kênh, tỷ lệ lấp đầy phòng vé, công suất vận hành từng chi nhánh và chất lượng dịch vụ.'
        }
        icon={BarChart3}
        action="Phân tích mua bán chuyên sâu"
        onAction={() => navigate('statistics')}
      />

      {/* Executive Scope Ribbon */}
      <div className="report-ribbon" role="region" aria-label="Thông tin mạng lưới">
        <div className="report-ribbon-item">
          <Globe size={15} className="text-emerald-400 shrink-0" />
          <span>Phạm vi:</span>
          {isFilteredSingleCinema ? (
            <span className="report-scope-tag cinema flex items-center gap-1">
              <Building2 size={12} />
              {filteredCinemaName}
              <button
                type="button"
                className="ml-1 text-[9px] underline hover:text-white"
                onClick={() => setCinemaFilter('')}
                title="Quay lại toàn hệ thống"
              >
                (Xem tất cả rạp)
              </button>
            </span>
          ) : (
            <span className="report-scope-tag all flex items-center gap-1">
              <Globe size={12} />
              Toàn bộ chuỗi rạp ({totalCinemasCount} chi nhánh)
            </span>
          )}
        </div>
        {summary && (
          <>
            <div className="report-ribbon-item">
              <Film size={14} className="text-amber-400 shrink-0" />
              <span>Quy mô:</span>
              <strong>{number(summary.showtimeCount)} suất chiếu</strong>
            </div>
            <div className="report-ribbon-item">
              <Layers size={14} className="text-blue-400 shrink-0" />
              <span>Sức chứa ghế:</span>
              <strong>{compact(summary.totalCapacity)} lượt ghế</strong>
            </div>
            <div className="report-ribbon-item">
              <ReceiptText size={14} className="text-teal-400 shrink-0" />
              <span>Giao dịch thành công:</span>
              <strong>{number(summary.totalTransactions)} đơn</strong>
            </div>
            <div className="report-ribbon-item">
              <Undo2 size={14} className="text-rose-400 shrink-0" />
              <span>Đã hoàn tiền:</span>
              <strong>{number(summary.refundedBookings)} đơn ({vnd(summary.refundAmount)})</strong>
            </div>
          </>
        )}
      </div>

      {/* Report Filters */}
      <ReportFilters report={report} onExport={exportReport} />

      {/* Report Body */}
      <ReportBody report={report}>
        {data && summary && (
          <div className="report-body-stack">
            {/* 8 Executive KPIs in 2 Rows of 4 */}
            <div className="report-kpis">
              {/* Metric 1 */}
              <Metric
                label="Tổng doanh thu hệ thống"
                value={vnd(summary.totalRevenue)}
                icon={TrendingUp}
                tone="amber"
                note={`Vé: ${vnd(summary.ticketRevenue)} (${percent(ratio(summary.ticketRevenue, summary.totalRevenue))}) · F&B: ${vnd(summary.foodRevenue)}`}
              />

              {/* Metric 2 */}
              <Metric
                label="Doanh thu vé xem phim"
                value={vnd(summary.ticketRevenue)}
                icon={Ticket}
                tone="teal"
                note={`${number(summary.ticketsSold)} vé xuất bán thành công trên toàn hệ thống`}
              />

              {/* Metric 3 */}
              <Metric
                label="Doanh thu quầy F&B"
                value={vnd(summary.foodRevenue)}
                icon={Popcorn}
                tone="blue"
                note={`${percent(ratio(summary.foodRevenue, summary.totalRevenue))} tổng doanh thu · ${number(summary.foodOrders)} đơn có bắp nước`}
              />

              {/* Metric 4 */}
              <Metric
                label="Tỷ lệ lấp đầy toàn hệ thống"
                value={percent(summary.occupancyRate)}
                icon={Activity}
                tone="purple"
                note={`${number(summary.ticketsSold)} ghế / ${number(summary.totalCapacity)} lượt ghế khả dụng`}
              />

              {/* Metric 5 */}
              <Metric
                label="Giao dịch & Giá trị TB (AOV)"
                value={vnd(summary.totalTransactions ? Math.round(Number(summary.totalRevenue) / summary.totalTransactions) : 0)}
                icon={ReceiptText}
                tone="amber"
                note={`Tính trên ${number(summary.totalTransactions)} đơn hàng thanh toán thành công`}
              />

              {/* Metric 6 */}
              <Metric
                label="Suất chiếu điều phối"
                value={`${number(summary.showtimeCount)} suất`}
                icon={Film}
                tone="teal"
                note={`Bình quân ${(summary.ticketsSold / Math.max(1, summary.showtimeCount)).toFixed(1)} vé / suất chiếu`}
              />

              {/* Metric 7 */}
              <Metric
                label="Tỷ lệ khách không đến (No-show)"
                value={percent(data.noShows.noShowRatePercent)}
                icon={Users}
                tone="rose"
                note={`${number(data.noShows.noShowBookings)} đơn không check-in / ${number(data.noShows.finishedPaidBookings)} đơn đã xong`}
              />

              {/* Metric 8 */}
              <Metric
                label="Xử lý hoàn tiền vé"
                value={vnd(summary.refundAmount)}
                icon={Undo2}
                tone="rose"
                note={`${number(summary.refundedBookings)} booking được hoàn tiền trong kỳ`}
              />
            </div>

            {/* 2 Main Visual Column Bar Charts */}
            <div className="report-grid-main">
              <Card
                title="Xu hướng doanh thu theo ngày"
                description="Doanh thu vé xem phim và bắp nước theo ngày thực nhận (chuyển đổi xếp chồng / cột đôi)"
                action={<span className="report-badge">Vé &amp; F&amp;B</span>}
              >
                <RevenueChart data={data.daily} />
              </Card>

              <Card
                title="Cơ cấu doanh thu &amp; Dòng tiền"
                description="Tỷ trọng đóng góp các mảng kinh doanh và dòng tiền hoàn trả"
              >
                <DistributionBarChart
                  money
                  total={Number(summary.totalRevenue)}
                  centerLabel="VND doanh thu"
                  data={[
                    { name: 'Vé xem phim', value: Number(summary.ticketRevenue), color: COLORS[0] },
                    { name: 'Bắp nước & combo', value: Number(summary.foodRevenue), color: COLORS[1] },
                    ...(Number(summary.refundAmount) > 0 ? [{ name: 'Khoản đã hoàn', value: Number(summary.refundAmount), color: '#f43f5e' }] : [])
                  ]}
                />
              </Card>
            </div>

            {/* Benchmark & Ranking By Cinema (Admin Only) */}
            <Card
              title={isFilteredSingleCinema ? `Hiệu quả chi nhánh: ${filteredCinemaName}` : 'Xếp hạng & Hiệu quả từng cụm rạp'}
              description={
                isFilteredSingleCinema
                  ? 'Bảng đối soát chi tiết chỉ số của cụm rạp đang được lọc. Bấm "Xem toàn bộ rạp" để so sánh tất cả chi nhánh.'
                  : 'Bảng đối sánh doanh thu, lượng vé xuất bán và tỷ lệ lấp đầy giữa các cụm rạp trên toàn hệ thống.'
              }
              action={
                <div className="flex items-center gap-2">
                  <div className="relative">
                    <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-neutral-400" />
                    <input
                      type="text"
                      placeholder="Tìm cụm rạp..."
                      value={cinemaSearch}
                      onChange={e => setCinemaSearch(e.target.value)}
                      className="pl-8 pr-3 py-1.5 bg-[#0a0d14] border border-white/10 text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-amber-500 w-36 sm:w-48"
                    />
                  </div>
                  <div className="hidden sm:flex items-center gap-1 border border-white/10 p-0.5 bg-[#0a0d14] text-[11px]">
                    <span className="text-neutral-400 px-1 font-mono">Xếp:</span>
                    {[
                      ['totalRevenue', 'Doanh thu'],
                      ['ticketsSold', 'Vé bán'],
                      ['foodRevenue', 'F&B'],
                      ['occupancyRate', 'Lấp đầy']
                    ].map(([sortKey, sortLabel]) => (
                      <button
                        key={sortKey}
                        type="button"
                        onClick={() => setCinemaSort(sortKey)}
                        className={`px-2 py-1 uppercase font-mono font-semibold text-[10px] ${
                          cinemaSort === sortKey ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30' : 'text-neutral-400 hover:text-white'
                        }`}
                      >
                        {sortLabel}
                      </button>
                    ))}
                  </div>
                </div>
              }
            >
              <DataTable
                rows={filteredCinemas}
                rowKey={c => c.cinemaId}
                pageSize={6}
                emptyText="Không tìm thấy cụm rạp phù hợp."
                columns={[
                  {
                    key: 'cinemaName',
                    label: 'Cụm rạp',
                    render: (c, i) => (
                      <div className="flex items-center gap-2">
                        <span className={`report-rank ${i < 3 ? 'top' : ''}`}>
                          {String(i + 1).padStart(2, '0')}
                        </span>
                        <div>
                          <strong className="text-white block">{c.cinemaName}</strong>
                          <span className="text-[10px] text-neutral-400 font-mono">ID: #{c.cinemaId}</span>
                        </div>
                      </div>
                    )
                  },
                  {
                    key: 'ticketRevenue',
                    label: 'Doanh thu vé',
                    align: 'right',
                    render: c => vnd(c.ticketRevenue)
                  },
                  {
                    key: 'foodRevenue',
                    label: 'Doanh thu F&B',
                    align: 'right',
                    render: c => vnd(c.foodRevenue)
                  },
                  {
                    key: 'totalRevenue',
                    label: 'Tổng doanh thu',
                    align: 'right',
                    render: c => (
                      <div>
                        <strong className="report-inline-text">{vnd(c.totalRevenue)}</strong>
                        <span className="block text-[10px] text-neutral-400 font-mono">
                          {percent(ratio(c.totalRevenue, summary.totalRevenue))} hệ thống
                        </span>
                      </div>
                    )
                  },
                  {
                    key: 'ticketsSold',
                    label: 'Vé đã bán',
                    align: 'right',
                    render: c => number(c.ticketsSold)
                  },
                  {
                    key: 'showtimes',
                    label: 'Suất chiếu',
                    align: 'right',
                    render: c => number(c.showtimes)
                  },
                  {
                    key: 'occupancyRate',
                    label: 'Lấp đầy',
                    align: 'right',
                    render: c => {
                      const occ = Number(c.occupancyRate || 0);
                      const tone = occ >= 65 ? 'high' : occ >= 35 ? 'medium' : 'low';
                      return (
                        <div className="flex flex-col items-end gap-1">
                          <span className="report-progress">
                            <span className="report-progress-track">
                              <i style={{ width: `${Math.min(100, occ)}%` }} />
                            </span>
                            <span className="font-mono text-xs">{percent(occ)}</span>
                          </span>
                          <span className={`report-occupancy-pill ${tone}`}>
                            {occ >= 65 ? 'Xuất sắc' : occ >= 35 ? 'Ổn định' : 'Cần tối ưu'}
                          </span>
                        </div>
                      );
                    }
                  },
                  {
                    key: 'actions',
                    label: 'Thao tác',
                    align: 'right',
                    render: c => (
                      <button
                        type="button"
                        onClick={() => setCinemaFilter(String(c.cinemaId))}
                        className="report-cinema-drilldown-btn"
                        title={`Lọc báo cáo cho ${c.cinemaName}`}
                      >
                        <span>Lọc rạp này</span>
                        <ArrowUpRight size={12} />
                      </button>
                    )
                  }
                ]}
              />
            </Card>

            {/* Top Movies & Peak Hours Analysis */}
            <div className="report-grid-halves">
              {/* Top Movies */}
              <Card
                title="Phim dẫn đầu phòng vé toàn hệ thống"
                description="Top 5 tác phẩm đóng góp doanh thu vé cao nhất trong kỳ báo cáo"
                action={
                  <button
                    type="button"
                    className="report-button icon-only"
                    aria-label="Xem thống kê phim chuyên sâu"
                    title="Xem toàn bộ thống kê phim"
                    onClick={() => navigate('statistics')}
                  >
                    <ArrowUpRight size={16} />
                  </button>
                }
              >
                <DataTable
                  rows={topMovies}
                  pageSize={5}
                  rowKey={m => m.movieId}
                  emptyText="Chưa có dữ liệu phim trong kỳ."
                  columns={[
                    {
                      key: 'movieTitle',
                      label: 'Phim',
                      render: (m, i) => (
                        <div className="flex items-center gap-2">
                          <span className={`report-rank ${i === 0 ? 'top' : ''}`}>{i + 1}</span>
                          <div className="min-w-0">
                            <strong className="block truncate text-white max-w-[200px]" title={m.movieTitle}>
                              {m.movieTitle}
                            </strong>
                            <span className="text-[10px] text-neutral-400 font-mono">ID: #{m.movieId}</span>
                          </div>
                        </div>
                      )
                    },
                    {
                      key: 'ticketsSold',
                      label: 'Vé bán',
                      align: 'right',
                      render: m => number(m.ticketsSold)
                    },
                    {
                      key: 'revenue',
                      label: 'Doanh thu phòng vé',
                      align: 'right',
                      render: m => (
                        <div>
                          <strong className="report-inline-text">{vnd(m.revenue)}</strong>
                          <span className="block text-[10px] text-neutral-400 font-mono">
                            {percent(ratio(m.revenue, summary.ticketRevenue))} phòng vé
                          </span>
                        </div>
                      )
                    }
                  ]}
                />
              </Card>

              {/* Peak Hours Chart */}
              <Card
                title="Khung giờ cao điểm bán vé (Peak Hours)"
                description="Phân bổ lượng vé xuất bán theo khung giờ chiếu (08:00 – 23:00)"
              >
                {peakHours.some(h => h.ticketsSold > 0) ? (
                  <div className="report-chart" role="img" aria-label="Biểu đồ lượng vé bán theo khung giờ">
                    <ResponsiveContainer width="100%" height={230}>
                      <BarChart data={peakHours} margin={{ top: 12, right: 12, left: -10, bottom: 4 }}>
                        <CartesianGrid stroke="#ffffff0a" vertical={false} />
                        <XAxis
                          dataKey="hour"
                          tickFormatter={h => `${h}h`}
                          axisLine={false}
                          tickLine={false}
                          interval={2}
                          tick={{ fill: '#8590a1', fontSize: 10 }}
                        />
                        <YAxis
                          allowDecimals={false}
                          axisLine={false}
                          tickLine={false}
                          width={40}
                          tick={{ fill: '#8590a1', fontSize: 10 }}
                        />
                        <Tooltip content={<ChartTip />} />
                        <Bar
                          dataKey="ticketsSold"
                          name="Vé đã bán"
                          fill={COLORS[0]}
                          radius={[0, 0, 0, 0]}
                          maxBarSize={22}
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                ) : (
                  <Empty text="Chưa ghi nhận vé bán trong các khung giờ của kỳ này." />
                )}
              </Card>
            </div>

            {/* Operational Health, Risk & Quality Monitor */}
            <Card
              title="Chỉ số vận hành, chất lượng &amp; rủi ro hệ thống"
              description="Theo dõi sát sao đơn giữ chỗ hết hạn, tỷ lệ khách không đến (No-show), hoàn tiền vé và gắn kèm F&B"
            >
              <div className="report-insight-list">
                <div>
                  <ReceiptText size={19} className="text-amber-400" />
                  <span>
                    Đơn giữ chỗ hết hạn thanh toán (Abandoned)
                    <small>Khách chọn ghế nhưng không thanh toán kịp thời gian giữ chỗ</small>
                  </span>
                  <div>
                    <strong className="block text-right">{number(data.abandoned.expiredBookings)} đơn</strong>
                    <span className="text-[10px] text-neutral-400 font-mono">
                      Tỷ lệ hủy: {percent(data.abandoned.abandonedRatePercent)}
                    </span>
                  </div>
                </div>

                <div>
                  <Users size={19} className="text-teal-400" />
                  <span>
                    Khách không đến xem (No-show)
                    <small>Đơn đã thanh toán thành công nhưng không check-in, suất chiếu đã kết thúc</small>
                  </span>
                  <div>
                    <strong className="block text-right">{number(data.noShows.noShowBookings)} vé</strong>
                    <span className="text-[10px] text-neutral-400 font-mono">
                      Tỷ lệ no-show: {percent(data.noShows.noShowRatePercent)}
                    </span>
                  </div>
                </div>

                <div>
                  <Undo2 size={19} className="text-rose-400" />
                  <span>
                    Xử lý hoàn tiền vé &amp; sự cố
                    <small>{number(summary.refundedBookings)} booking được phê duyệt hoàn tiền</small>
                  </span>
                  <div>
                    <strong className="block text-right text-rose-300">{vnd(summary.refundAmount)}</strong>
                    <span className="text-[10px] text-neutral-400 font-mono">Không tính vào doanh thu thực nhận</span>
                  </div>
                </div>

                <div>
                  <Popcorn size={19} className="text-blue-400" />
                  <span>
                    Tỷ lệ đính kèm bắp nước (Attach Rate)
                    <small>Tỷ lệ các đơn mua vé có chọn mua kèm ít nhất 1 món hoặc combo F&B</small>
                  </span>
                  <div>
                    <strong className="block text-right">
                      {percent(ratio(summary.foodOrders, summary.totalTransactions))}
                    </strong>
                    <span className="text-[10px] text-neutral-400 font-mono">
                      {number(summary.foodOrders)} / {number(summary.totalTransactions)} đơn
                    </span>
                  </div>
                </div>
              </div>

              {/* Status pills breakdown */}
              {Array.isArray(data.bookingStatuses) && data.bookingStatuses.length > 0 && (
                <div className="mt-4 pt-4 border-t border-white/[0.06]">
                  <span className="block text-[10px] uppercase font-mono font-bold text-neutral-400 mb-2 tracking-wider">
                    Phân bổ trạng thái toàn bộ Booking trong kỳ
                  </span>
                  <div className="report-status-counts">
                    {data.bookingStatuses.map(s => (
                      <div key={s.status} className="border border-white/5 p-2 bg-[#0c0f16]">
                        <strong className="text-sm font-mono text-white">{number(s.count)}</strong>
                        <span className="text-[10px] text-neutral-400 block mt-0.5">
                          {STATUS_LABELS[s.status] || s.status}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </Card>

            {/* Quick Management Shortcuts */}
            <div className="report-quick-links">
              {[
                ['statistics', BarChart3, 'Thống kê mua bán', 'Phân tích đa chiều doanh thu, tỷ lệ lấp đầy phòng và ghế'],
                ['fnb-report', Popcorn, 'Báo cáo F&B chuỗi rạp', 'Sản phẩm bán chạy, cơ cấu combo và đóng góp kênh bán'],
                ['cinema', Building2, 'Hệ thống cụm rạp', 'Quản lý thông tin rạp, địa chỉ và mở rộng chi nhánh'],
                ['showtimes', Film, 'Điều phối lịch chiếu', 'Kiểm soát lịch chiếu, phòng chiếu và công suất ghế trống'],
                ['transactions', ReceiptText, 'Quản lý giao dịch', 'Tra cứu hóa đơn thanh toán, đối soát và trạng thái cổng']
              ].map(([key, Icon, label, sub]) => (
                <button
                  key={key}
                  type="button"
                  className="report-quick-link"
                  onClick={() => navigate(key)}
                >
                  <Icon size={20} className="text-amber-400" />
                  <span>
                    {label}
                    <small>{sub}</small>
                  </span>
                  <ArrowUpRight size={16} />
                </button>
              ))}
            </div>

            {/* Accounting Footnote */}
            <ReportNote>
              Doanh thu hệ thống được ghi nhận theo ngày thanh toán thực tế của đơn PAID/USED và F&B đã thanh toán. Đơn hoàn tiền không tính trong doanh thu ròng và được thống kê độc lập theo ngày xử lý. Tỷ lệ lấp đầy tính dựa trên số ghế đã bán so với tổng số ghế mở bán của các suất chiếu trong khoảng thời gian đã lọc.
            </ReportNote>
          </div>
        )}
      </ReportBody>
    </div>
  );
}

// ============================================================================
// 2. MANAGER THEATER OVERVIEW (CHỈ CHO RẠP ĐƯỢC PHÂN CÔNG)
// ============================================================================
function ManagerCinemaOverviewView({ ctx }) {
  const report = useAdminReport(ctx);
  const { data, applied, cinemas, managerCinema } = report;
  const summary = data?.summary;
  const navigate = ctx.changeAdminSection || ctx.onSectionChange || (() => {});

  const assignedCinema = ctx.assignedCinema || cinemas.find(c => String(c.id) === String(managerCinema)) || {
    id: managerCinema,
    name: `Rạp #${managerCinema}`
  };
  const cinemaName = assignedCinema?.name || `Rạp #${managerCinema}`;
  const cinemaAddress = assignedCinema?.address || assignedCinema?.city || 'Khu vực quản lý';

  const rooms = useMemo(() => {
    return (data?.rooms || []).sort((a, b) => Number(b.occupancyRate ?? 0) - Number(a.occupancyRate ?? 0));
  }, [data?.rooms]);

  const topMovies = useMemo(() => {
    return (data?.topMovies || []).slice(0, 5);
  }, [data?.topMovies]);

  const peakHours = useMemo(() => {
    return data?.peakHours || [];
  }, [data?.peakHours]);

  const exportReport = () => {
    const suffix = `${applied.from}-${applied.to}`;
    const safeName = cinemaName.toLowerCase().replace(/[^a-z0-9]/g, '-');
    downloadCsv(
      `tong-quan-rap-${safeName}-${suffix}`,
      ['Phòng chiếu', 'Suất chiếu', 'Vé đã bán', 'Lượt ghế khả dụng', 'Lấp đầy (%)'],
      rooms.map(r => [r.roomName, r.totalShowtimes, r.ticketsSold, r.roomCapacity, r.occupancyRate])
    );
  };

  return (
    <div className="admin-report">
      {/* Header */}
      <ReportHeader
        eyebrow="CINEPREMIER / ĐIỀU HÀNH CỤM RẠP NỘI BỘ"
        title={`Tổng quan cụm rạp: ${cinemaName}`}
        description={`Báo cáo vận hành nội bộ, tỷ lệ lấp đầy phòng vé và doanh thu độc quyền thuộc cụm rạp ${cinemaName}. Không hiển thị dữ liệu của rạp khác.`}
        icon={Building2}
        action="Báo cáo F&B rạp"
        onAction={() => navigate('fnb-report')}
      />

      {/* Manager Scope & Security Ribbon */}
      <div className="report-ribbon manager" role="region" aria-label="Phạm vi rạp phân công">
        <div className="report-ribbon-item">
          <MapPin size={15} className="text-amber-400 shrink-0" />
          <span>Địa chỉ rạp:</span>
          <strong>{cinemaAddress}</strong>
        </div>
        <div className="report-ribbon-item">
          <Layers size={14} className="text-blue-400 shrink-0" />
          <span>Quy mô rạp:</span>
          <strong>{rooms.length || assignedCinema?.totalRooms || '—'} phòng chiếu</strong>
        </div>
        <div className="report-ribbon-item">
          <Users size={14} className="text-teal-400 shrink-0" />
          <span>Quản lý phụ trách:</span>
          <strong>{ctx.currentUser?.fullName || ctx.currentUser?.name || 'Quản lý rạp'}</strong>
        </div>
        <div className="report-ribbon-item ml-auto">
          <span className="report-scope-tag cinema flex items-center gap-1.5">
            <Lock size={11} className="text-amber-400" />
            Phân quyền: Chỉ cho rạp này
          </span>
        </div>
      </div>

      {/* Report Filters with Locked Cinema */}
      <ReportFilters report={report} onExport={exportReport} />

      {/* Report Body */}
      <ReportBody report={report}>
        {data && summary && (
          <div className="report-body-stack">
            {/* 8 Cinema KPIs in 2 Rows of 4 */}
            <div className="report-kpis">
              {/* Metric 1 */}
              <Metric
                label="Tổng doanh thu tại rạp"
                value={vnd(summary.totalRevenue)}
                icon={TrendingUp}
                tone="amber"
                note={`Vé: ${vnd(summary.ticketRevenue)} · Bắp nước: ${vnd(summary.foodRevenue)}`}
              />

              {/* Metric 2 */}
              <Metric
                label="Vé đã bán tại rạp"
                value={number(summary.ticketsSold)}
                icon={Ticket}
                tone="teal"
                note={`Xuất bán tại quầy & trực tuyến cho ${cinemaName}`}
              />

              {/* Metric 3 */}
              <Metric
                label="Doanh thu F&B chi nhánh"
                value={vnd(summary.foodRevenue)}
                icon={Popcorn}
                tone="blue"
                note={`${percent(ratio(summary.foodRevenue, summary.totalRevenue))} doanh thu rạp · ${number(summary.foodOrders)} đơn bắp nước`}
              />

              {/* Metric 4 */}
              <Metric
                label="Lấp đầy phòng bình quân"
                value={percent(summary.occupancyRate)}
                icon={Activity}
                tone="purple"
                note={`${number(summary.ticketsSold)} ghế / ${number(summary.totalCapacity)} lượt ghế của rạp`}
              />

              {/* Metric 5 */}
              <Metric
                label="Giá trị đơn TB tại rạp"
                value={vnd(summary.totalTransactions ? Math.round(Number(summary.totalRevenue) / summary.totalTransactions) : 0)}
                icon={ReceiptText}
                tone="amber"
                note={`Bình quân trên ${number(summary.totalTransactions)} đơn thanh toán tại rạp`}
              />

              {/* Metric 6 */}
              <Metric
                label="Suất chiếu vận hành"
                value={`${number(summary.showtimeCount)} suất`}
                icon={Film}
                tone="teal"
                note={`Khai thác trên ${rooms.length} phòng chiếu của cụm rạp`}
              />

              {/* Metric 7 */}
              <Metric
                label="Khách không đến (No-show tại rạp)"
                value={percent(data.noShows.noShowRatePercent)}
                icon={Users}
                tone="rose"
                note={`${number(data.noShows.noShowBookings)} vé không check-in / ${number(data.noShows.finishedPaidBookings)} vé bán`}
              />

              {/* Metric 8 */}
              <Metric
                label="Xử lý hoàn tiền vé tại rạp"
                value={vnd(summary.refundAmount)}
                icon={Undo2}
                tone="rose"
                note={`${number(summary.refundedBookings)} lượt hoàn vé phát sinh tại chi nhánh`}
              />
            </div>

            {/* 2 Main Visual Charts */}
            <div className="report-grid-main">
              <Card
                title="Doanh thu chi nhánh theo ngày"
                description={`Biểu đồ hình cột thể hiện doanh thu vé và F&B mỗi ngày tại ${cinemaName}`}
                action={<span className="report-badge">Dữ liệu rạp</span>}
              >
                <RevenueChart data={data.daily} />
              </Card>

              <Card
                title="Cơ cấu doanh thu chi nhánh"
                description="Tỷ trọng đóng góp từ vé và quầy bắp nước tại cụm rạp này"
              >
                <DistributionBarChart
                  money
                  total={Number(summary.totalRevenue)}
                  centerLabel="VND doanh thu"
                  data={[
                    { name: 'Vé xem phim', value: Number(summary.ticketRevenue), color: COLORS[0] },
                    { name: 'Bắp nước & combo', value: Number(summary.foodRevenue), color: COLORS[1] },
                    ...(Number(summary.refundAmount) > 0 ? [{ name: 'Đã hoàn tiền', value: Number(summary.refundAmount), color: '#f43f5e' }] : [])
                  ]}
                />
              </Card>
            </div>

            {/* Room Efficiency Breakdown Table (Replaces cinema table for Manager) */}
            <Card
              title="Hiệu suất từng phòng chiếu tại rạp"
              description={`Báo cáo chi tiết công suất khai thác, số suất chiếu và tỷ lệ lấp đầy các phòng tại ${cinemaName}`}
              action={
                <button
                  type="button"
                  className="report-button"
                  onClick={() => navigate('rooms')}
                >
                  <Layers size={14} />
                  <span>Quản lý phòng chiếu &amp; ghế</span>
                </button>
              }
            >
              <DataTable
                rows={rooms}
                rowKey={r => r.roomName}
                emptyText="Chưa có dữ liệu phòng chiếu cho khoảng thời gian này."
                pageSize={6}
                columns={[
                  {
                    key: 'roomName',
                    label: 'Phòng chiếu',
                    render: (r, i) => (
                      <div className="flex items-center gap-2">
                        <span className="report-rank">{String(i + 1).padStart(2, '0')}</span>
                        <div>
                          <strong className="text-white block">{r.roomName}</strong>
                          <span className="text-[10px] text-neutral-400 font-mono">
                            Sức chứa: {number(r.roomCapacity)} lượt ghế
                          </span>
                        </div>
                      </div>
                    )
                  },
                  {
                    key: 'totalShowtimes',
                    label: 'Suất chiếu đã chạy',
                    align: 'right',
                    render: r => `${number(r.totalShowtimes)} suất`
                  },
                  {
                    key: 'ticketsSold',
                    label: 'Vé đã bán',
                    align: 'right',
                    render: r => `${number(r.ticketsSold)} vé`
                  },
                  {
                    key: 'occupancyRate',
                    label: 'Tỷ lệ lấp đầy',
                    align: 'right',
                    render: r => {
                      const occ = Number(r.occupancyRate || 0);
                      const tone = occ >= 65 ? 'high' : occ >= 35 ? 'medium' : 'low';
                      return (
                        <div className="flex flex-col items-end gap-1">
                          <span className="report-progress">
                            <span className="report-progress-track">
                              <i style={{ width: `${Math.min(100, occ)}%` }} />
                            </span>
                            <span className="font-mono text-xs">{percent(occ)}</span>
                          </span>
                          <span className={`report-occupancy-pill ${tone}`}>
                            {occ >= 65 ? 'Xuất sắc' : occ >= 35 ? 'Ổn định' : 'Cần tối ưu'}
                          </span>
                        </div>
                      );
                    }
                  },
                  {
                    key: 'actions',
                    label: 'Thao tác',
                    align: 'right',
                    render: () => (
                      <button
                        type="button"
                        onClick={() => navigate('rooms')}
                        className="report-cinema-drilldown-btn"
                        title="Xem chi tiết phòng & ghế"
                      >
                        <span>Sơ đồ phòng</span>
                        <ArrowUpRight size={12} />
                      </button>
                    )
                  }
                ]}
              />
            </Card>

            {/* Peak Hours & Top Movies at this Cinema */}
            <div className="report-grid-halves">
              {/* Peak Hours at This Cinema */}
              <Card
                title="Khung giờ cao điểm tại rạp (Peak Hours)"
                description="Biểu đồ lượng vé xuất bán theo khung giờ để bố trí nhân viên soát vé và quầy bắp nước"
              >
                {peakHours.some(h => h.ticketsSold > 0) ? (
                  <div className="report-chart" role="img" aria-label="Biểu đồ lượng vé bán theo khung giờ tại rạp">
                    <ResponsiveContainer width="100%" height={230}>
                      <BarChart data={peakHours} margin={{ top: 12, right: 12, left: -10, bottom: 4 }}>
                        <CartesianGrid stroke="#ffffff0a" vertical={false} />
                        <XAxis
                          dataKey="hour"
                          tickFormatter={h => `${h}h`}
                          axisLine={false}
                          tickLine={false}
                          interval={2}
                          tick={{ fill: '#8590a1', fontSize: 10 }}
                        />
                        <YAxis
                          allowDecimals={false}
                          axisLine={false}
                          tickLine={false}
                          width={40}
                          tick={{ fill: '#8590a1', fontSize: 10 }}
                        />
                        <Tooltip content={<ChartTip />} />
                        <Bar
                          dataKey="ticketsSold"
                          name="Vé bán tại rạp"
                          fill={COLORS[0]}
                          radius={[0, 0, 0, 0]}
                          maxBarSize={22}
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                ) : (
                  <Empty text="Chưa ghi nhận vé bán trong các khung giờ tại rạp này." />
                )}
              </Card>

              {/* Top Movies at This Cinema */}
              <Card
                title={`Phim ăn khách nhất tại ${cinemaName}`}
                description="Top phim dẫn đầu doanh thu và vé bán ra tại chi nhánh này"
              >
                <DataTable
                  rows={topMovies}
                  pageSize={5}
                  rowKey={m => m.movieId}
                  emptyText="Chưa có dữ liệu phim tại rạp."
                  columns={[
                    {
                      key: 'movieTitle',
                      label: 'Phim',
                      render: (m, i) => (
                        <div className="flex items-center gap-2">
                          <span className={`report-rank ${i === 0 ? 'top' : ''}`}>{i + 1}</span>
                          <strong className="truncate max-w-[190px] text-white block" title={m.movieTitle}>
                            {m.movieTitle}
                          </strong>
                        </div>
                      )
                    },
                    {
                      key: 'ticketsSold',
                      label: 'Vé đã bán',
                      align: 'right',
                      render: m => number(m.ticketsSold)
                    },
                    {
                      key: 'revenue',
                      label: 'Doanh thu vé',
                      align: 'right',
                      render: m => <strong className="report-inline-text">{vnd(m.revenue)}</strong>
                    }
                  ]}
                />
              </Card>
            </div>

            {/* Operational Quality & Check-in Control */}
            <Card
              title="Kiểm soát vận hành &amp; Trạng thái vé tại rạp"
              description="Theo dõi sát khách không đến (No-show), đơn hết hạn giữ ghế và hoàn tiền tại chi nhánh"
            >
              <div className="report-insight-list">
                <div>
                  <Users size={19} className="text-teal-400" />
                  <span>
                    Khách không đến (No-show tại rạp)
                    <small>Số vé khách đã mua nhưng không check-in trước khi suất chiếu kết thúc</small>
                  </span>
                  <div>
                    <strong className="block text-right">{number(data.noShows.noShowBookings)} vé</strong>
                    <span className="text-[10px] text-neutral-400 font-mono">
                      Tỷ lệ no-show: {percent(data.noShows.noShowRatePercent)}
                    </span>
                  </div>
                </div>

                <div>
                  <ReceiptText size={19} className="text-amber-400" />
                  <span>
                    Đơn giữ chỗ hết hạn thanh toán
                    <small>Số lượt khách giữ ghế nhưng không hoàn tất trả tiền tại chi nhánh</small>
                  </span>
                  <div>
                    <strong className="block text-right">{number(data.abandoned.expiredBookings)} đơn</strong>
                    <span className="text-[10px] text-neutral-400 font-mono">
                      Tỷ lệ hủy: {percent(data.abandoned.abandonedRatePercent)}
                    </span>
                  </div>
                </div>

                <div>
                  <Undo2 size={19} className="text-rose-400" />
                  <span>
                    Hoàn tiền &amp; Sự cố tại chi nhánh
                    <small>{number(summary.refundedBookings)} booking được xử lý hoàn trả tiền</small>
                  </span>
                  <div>
                    <strong className="block text-right text-rose-300">{vnd(summary.refundAmount)}</strong>
                    <span className="text-[10px] text-neutral-400 font-mono">Đã xử lý cho khách hàng</span>
                  </div>
                </div>
              </div>

              {/* Status pills breakdown */}
              {Array.isArray(data.bookingStatuses) && data.bookingStatuses.length > 0 && (
                <div className="mt-4 pt-4 border-t border-white/[0.06]">
                  <span className="block text-[10px] uppercase font-mono font-bold text-neutral-400 mb-2 tracking-wider">
                    Phân bổ trạng thái vé đặt tại cụm rạp
                  </span>
                  <div className="report-status-counts">
                    {data.bookingStatuses.map(s => (
                      <div key={s.status} className="border border-white/5 p-2 bg-[#0c0f16]">
                        <strong className="text-sm font-mono text-white">{number(s.count)}</strong>
                        <span className="text-[10px] text-neutral-400 block mt-0.5">
                          {STATUS_LABELS[s.status] || s.status}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </Card>

            {/* Manager Operational Shortcuts */}
            <div className="report-quick-links">
              {[
                ['showtimes', Film, 'Điều phối lịch chiếu rạp', 'Sắp xếp ca chiếu, mở bán vé và kiểm soát phòng'],
                ['rooms', Layers, 'Quản lý phòng chiếu & ghế', 'Xem sơ đồ ghế, khóa / mở ghế hỏng cho khách'],
                ['showtime-incidents', ShieldAlert, 'Sự cố & Hoàn tiền', 'Xử lý hoàn tiền cho khách khi phòng gặp sự cố kỹ thuật'],
                ['staff', Users, 'Nhân viên rạp mình', 'Quản lý ca làm, phân công nhân viên soát vé & phục vụ'],
                ['fnb-report', Popcorn, 'Báo cáo F&B chi nhánh', 'Doanh thu quầy bắp nước và mặt hàng bán chạy tại rạp'],
                ['tickets', Ticket, 'Tra cứu vé khách hàng', 'Kiểm tra trạng thái vé, check-in và hỗ trợ khách']
              ].map(([key, Icon, label, sub]) => (
                <button
                  key={key}
                  type="button"
                  className="report-quick-link"
                  onClick={() => navigate(key)}
                >
                  <Icon size={20} className="text-amber-400" />
                  <span>
                    {label}
                    <small>{sub}</small>
                  </span>
                  <ArrowUpRight size={16} />
                </button>
              ))}
            </div>

            {/* Compliance Note */}
            <ReportNote>
              Báo cáo này được cấu hình tự động giới hạn phạm vi trong rạp được chỉ định theo chính sách phân quyền bảo mật RBAC. Manager chỉ có quyền xem và điều hành dữ liệu thuộc chi nhánh của mình. Mọi hành động xuất dữ liệu đều được ghi lại vào nhật ký kiểm toán hệ thống.
            </ReportNote>
          </div>
        )}
      </ReportBody>
    </div>
  );
}

// ============================================================================
// MAIN EXPORT: ADMIN OVERVIEW PANEL
// Automatically switches between System Overview (Admin) and Cinema Overview (Manager)
// ============================================================================
export default function AdminOverviewPanel({ ctx }) {
  const isManagerRole = Boolean(ctx.isEffectiveManager || (ctx.isManager && !ctx.isAdmin));

  if (isManagerRole) {
    return <ManagerCinemaOverviewView ctx={ctx} />;
  }

  return <AdminSystemOverviewView ctx={ctx} />;
}
