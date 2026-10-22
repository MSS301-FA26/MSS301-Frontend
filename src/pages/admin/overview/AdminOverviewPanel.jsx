import React from 'react';
import { Activity, ArrowUpRight, BarChart3, Building2, Film, Popcorn, ReceiptText, Ticket, TrendingUp, Undo2 } from 'lucide-react';
import useAdminReport from './useAdminReport';
import { Card, COLORS, DataTable, DistributionBarChart, Metric, ReportBody, ReportFilters, ReportHeader, ReportNote, RevenueChart } from './ReportComponents';
import { downloadCsv, number, percent, ratio, vnd } from './reportUtils';

export default function AdminOverviewPanel({ ctx }) {
  const report = useAdminReport(ctx);
  const data = report.data;
  const summary = data?.summary;
  const navigate = ctx.changeAdminSection || ctx.onSectionChange || (() => {});

  const exportReport = () => downloadCsv(
    `tong-quan-${report.applied.from}-${report.applied.to}`,
    ['Rạp', 'Doanh thu vé (VND)', 'Doanh thu F&B (VND)', 'Tổng doanh thu (VND)', 'Vé đã bán', 'Giao dịch', 'Suất chiếu', 'Lấp đầy (%)'],
    data.cinemas.map(c => [c.cinemaName, c.ticketRevenue, c.foodRevenue, c.totalRevenue, c.ticketsSold, c.transactions, c.showtimes, c.occupancyRate])
  );

  return (
    <div className="admin-report">
      <ReportHeader
        eyebrow="CINEPREMIER / ĐIỀU HÀNH TỔNG QUAN"
        title="Tổng quan hệ thống"
        description="Bức tranh toàn diện về doanh thu vé, quầy bắp nước và hiệu suất phòng vé của toàn bộ các cụm rạp."
        icon={BarChart3}
        action="Xem thống kê chi tiết"
        onAction={() => navigate('statistics')}
      />

      <ReportFilters report={report} onExport={exportReport} />

      <ReportBody report={report}>
        {data && (
          <div className="report-body-stack">
            {/* 4 Square KPIs */}
            <div className="report-kpis">
              <Metric
                label="Tổng doanh thu"
                value={vnd(summary.totalRevenue)}
                icon={TrendingUp}
                tone="amber"
                note="Tiền vé và F&B từ các đơn đã thanh toán thành công"
              />
              <Metric
                label="Vé đã bán"
                value={number(summary.ticketsSold)}
                icon={Ticket}
                tone="teal"
                note={`${number(summary.totalTransactions)} giao dịch vé & F&B trong kỳ báo cáo`}
              />
              <Metric
                label="Doanh thu F&B"
                value={vnd(summary.foodRevenue)}
                icon={Popcorn}
                tone="blue"
                note={`${percent(ratio(summary.foodRevenue, summary.totalRevenue))} tổng doanh thu · ${number(summary.foodOrders)} đơn có bắp nước`}
              />
              <Metric
                label="Tỷ lệ lấp đầy"
                value={percent(summary.occupancyRate)}
                icon={Activity}
                tone="purple"
                note={`${number(summary.showtimeCount)} suất chiếu · ${number(summary.totalCapacity)} lượt ghế khả dụng`}
              />
            </div>

            {/* 2 Main Column Bar Charts */}
            <div className="report-grid-main">
              <Card
                title="Xu hướng doanh thu"
                description="Doanh thu thực nhận theo ngày thanh toán (biểu đồ hình cột)"
                action={<span className="report-badge">Vé &amp; F&amp;B</span>}
              >
                <RevenueChart data={data.daily} />
              </Card>

              <Card
                title="Cơ cấu doanh thu"
                description="Tỷ trọng đóng góp của từng mảng kinh doanh (biểu đồ hình cột)"
              >
                <DistributionBarChart
                  money
                  total={Number(summary.totalRevenue)}
                  centerLabel="VND doanh thu"
                  data={[
                    { name: 'Vé xem phim', value: Number(summary.ticketRevenue), color: COLORS[0] },
                    { name: 'Bắp nước & combo', value: Number(summary.foodRevenue), color: COLORS[1] },
                  ]}
                />
              </Card>
            </div>

            {/* Performance by Cinema */}
            <Card
              title="Hiệu quả theo cụm rạp"
              description="Doanh thu và lượt vé trong kỳ, đối chiếu công suất các suất chiếu"
              action={<Building2 size={18} color={COLORS[0]} />}
            >
              <DataTable
                rows={data.cinemas}
                rowKey={c => c.cinemaId}
                columns={[
                  {
                    key: 'cinemaName',
                    label: 'Cụm rạp',
                    render: (c, i) => (
                      <div className="flex items-center">
                        <span className={`report-rank ${i < 3 ? 'top' : ''}`}>{String(i + 1).padStart(2, '0')}</span>
                        <strong>{c.cinemaName}</strong>
                      </div>
                    )
                  },
                  { key: 'ticketRevenue', label: 'Doanh thu vé', align: 'right', render: c => vnd(c.ticketRevenue) },
                  { key: 'foodRevenue', label: 'Doanh thu F&B', align: 'right', render: c => vnd(c.foodRevenue) },
                  { key: 'totalRevenue', label: 'Tổng doanh thu', align: 'right', render: c => <strong className="report-inline-text">{vnd(c.totalRevenue)}</strong> },
                  { key: 'ticketsSold', label: 'Vé đã bán', align: 'right', render: c => number(c.ticketsSold) },
                  {
                    key: 'occupancyRate',
                    label: 'Lấp đầy',
                    align: 'right',
                    render: c => (
                      <span className="report-progress">
                        <span className="report-progress-track">
                          <i style={{ width: `${Math.min(100, c.occupancyRate)}%` }} />
                        </span>
                        {percent(c.occupancyRate)}
                      </span>
                    )
                  },
                ]}
              />
            </Card>

            {/* Top Movies & Health Indicators */}
            <div className="report-grid-halves">
              <Card
                title="Phim dẫn đầu phòng vé"
                description="Xếp theo doanh thu vé, không bao gồm bắp nước"
                action={
                  <button
                    type="button"
                    className="report-button icon-only"
                    aria-label="Xem thống kê phim"
                    title="Xem toàn bộ thống kê phim"
                    onClick={() => navigate('statistics')}
                  >
                    <ArrowUpRight size={16} />
                  </button>
                }
              >
                <DataTable
                  rows={data.topMovies.slice(0, 5)}
                  pageSize={5}
                  rowKey={m => m.movieId}
                  columns={[
                    {
                      key: 'movieTitle',
                      label: 'Phim',
                      render: (m, i) => (
                        <div className="flex items-center">
                          <span className={`report-rank ${i === 0 ? 'top' : ''}`}>{i + 1}</span>
                          <strong>{m.movieTitle}</strong>
                        </div>
                      )
                    },
                    { key: 'ticketsSold', label: 'Vé bán', align: 'right', render: m => number(m.ticketsSold) },
                    { key: 'revenue', label: 'Doanh thu vé', align: 'right', render: m => <strong className="report-inline-text">{vnd(m.revenue)}</strong> },
                  ]}
                />
              </Card>

              <Card
                title="Chỉ số vận hành &amp; rủi ro"
                description="Tình trạng đơn giữ chỗ, khách không đến và xử lý hoàn tiền"
              >
                <div className="report-insight-list">
                  <div>
                    <ReceiptText size={19} />
                    <span>
                      Đơn giữ chỗ hết hạn
                      <small>Chưa hoàn tất thanh toán trong thời gian giữ ghế</small>
                    </span>
                    <strong>{number(data.abandoned.expiredBookings)}</strong>
                  </div>
                  <div>
                    <Ticket size={19} />
                    <span>
                      Khách không đến (No-show)
                      <small>Đơn đã thanh toán nhưng không check-in, suất chiếu đã kết thúc</small>
                    </span>
                    <strong>{number(data.noShows.noShowBookings)}</strong>
                  </div>
                  <div>
                    <Undo2 size={19} />
                    <span>
                      Đã xử lý hoàn tiền
                      <small>{number(summary.refundedBookings)} booking được hoàn trong kỳ</small>
                    </span>
                    <strong>{vnd(summary.refundAmount)}</strong>
                  </div>
                </div>
              </Card>
            </div>

            {/* Unified Quick Navigation Links */}
            <div className="report-quick-links">
              {[
                ['statistics', BarChart3, 'Thống kê mua bán', 'Phân tích doanh thu, tỷ lệ lấp đầy phòng và vé'],
                ['fnb-report', Popcorn, 'Báo cáo F&B', 'Món bán chạy, phân tích combo và kênh bán hàng'],
                ['showtimes', Film, 'Điều phối lịch chiếu', 'Theo dõi phòng chiếu, lịch chiếu và ghế trống'],
              ].map(([key, Icon, label, sub]) => (
                <button
                  key={key}
                  type="button"
                  className="report-quick-link"
                  onClick={() => navigate(key)}
                >
                  <Icon size={20} />
                  <span>
                    {label}
                    <small>{sub}</small>
                  </span>
                  <ArrowUpRight size={16} />
                </button>
              ))}
            </div>

            <ReportNote>
              Doanh thu được ghi nhận theo ngày thanh toán của đơn PAID/USED và F&B đã thanh toán hoặc đã giao; đơn đã hoàn tiền không nằm trong doanh thu hiện tại. Khoản hoàn tiền hiển thị riêng theo ngày hoàn, không trừ thêm lần nữa. Lấp đầy tính theo ngày chiếu và sức chứa ghế khả dụng trong phòng.
            </ReportNote>
          </div>
        )}
      </ReportBody>
    </div>
  );
}
