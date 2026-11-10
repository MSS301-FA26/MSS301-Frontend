import React, { useEffect, useMemo, useState } from 'react';
import { ArrowUpRight, BarChart3, Film, Popcorn, ReceiptText, Ticket, TrendingUp } from 'lucide-react';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import useAdminReport from './useAdminReport';
import { Card, ChartTip, COLORS, DataTable, DistributionBarChart, Empty, Metric, ReportBody, ReportFilters, ReportHeader, ReportNote, RevenueChart } from './ReportComponents';
import { downloadCsv, number, percent, shortDate, STATUS_LABELS, vnd } from './reportUtils';

export default function AdminStatsPanel({ ctx }) {
  const report = useAdminReport(ctx);
  const data = report.data;
  const summary = data?.summary;
  const navigate = ctx.changeAdminSection || ctx.onSectionChange || (() => {});
  const [tab, setTab] = useState('movies');
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState('revenue');
  const [showDate, setShowDate] = useState('');

  useEffect(() => {
    setShowDate('');
  }, [report.applied]);

  const movies = useMemo(() => (data?.topMovies || [])
    .filter(m => m.movieTitle.toLocaleLowerCase('vi').includes(search.toLocaleLowerCase('vi')))
    .sort((a, b) => Number(b[sort]) - Number(a[sort])),
    [data, search, sort]
  );

  const showtimes = useMemo(() => (data?.showtimes || [])
    .filter(s => !showDate || s.startTime.startsWith(showDate)),
    [data, showDate]
  );

  const exportReport = () => {
    const suffix = `${report.applied.from}-${report.applied.to}`;
    if (tab === 'movies') {
      downloadCsv(
        `thong-ke-phim-${suffix}`,
        ['Phim', 'Vé bán', 'Doanh thu vé (VND)'],
        movies.map(m => [m.movieTitle, m.ticketsSold, m.revenue])
      );
    } else if (tab === 'rooms') {
      downloadCsv(
        `cong-suat-phong-${suffix}`,
        ['Phòng', 'Suất chiếu', 'Vé bán', 'Lượt ghế khả dụng', 'Lấp đầy (%)'],
        data.rooms.map(r => [r.roomName, r.totalShowtimes, r.ticketsSold, r.roomCapacity, r.occupancyRate])
      );
    } else if (tab === 'showtimes') {
      downloadCsv(
        `suat-chieu-${suffix}`,
        ['Phim', 'Phòng', 'Giờ chiếu', 'Sức chứa', 'Đã bán', 'Còn lại'],
        showtimes.map(s => [s.movieTitle, s.roomName, s.startTime, s.capacity, s.sold, s.remaining])
      );
    } else {
      downloadCsv(
        `doanh-thu-ngay-${suffix}`,
        ['Ngày', 'Doanh thu vé (VND)', 'Doanh thu F&B (VND)', 'Tổng (VND)', 'Vé bán', 'Giao dịch'],
        data.daily.map(d => [d.date, d.ticketRevenue, d.foodRevenue, d.totalRevenue, d.ticketsSold, d.transactions])
      );
    }
  };

  return (
    <div className="admin-report">
      <ReportHeader
        eyebrow="CINEPREMIER / PHÂN TÍCH KINH DOANH"
        title="Thống kê mua bán"
        description="Phân tích chuyên sâu về doanh thu, hiệu quả phòng vé và hành vi đặt chỗ theo thời gian và từng cụm rạp."
        icon={Popcorn}
        action="Báo cáo F&B"
        onAction={() => navigate('fnb-report')}
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
                note={`Vé: ${vnd(summary.ticketRevenue)} · F&B: ${vnd(summary.foodRevenue)}`}
              />
              <Metric
                label="Vé đã bán"
                value={number(summary.ticketsSold)}
                icon={Ticket}
                tone="teal"
                note="Tổng ghế thuộc các đơn booking đã thanh toán"
              />
              <Metric
                label="Giao dịch thành công"
                value={number(summary.totalTransactions)}
                icon={ReceiptText}
                tone="blue"
                note="Mỗi booking hoặc đơn bắp nước riêng lẻ tính một giao dịch"
              />
              <Metric
                label="Giá trị giao dịch TB"
                value={vnd(summary.totalTransactions ? Math.round(Number(summary.totalRevenue) / summary.totalTransactions) : 0)}
                icon={BarChart3}
                tone="purple"
                note="Tổng doanh thu / số giao dịch thành công trong kỳ"
              />
            </div>

            {/* 2 Main Column Bar Charts */}
            <div className="report-grid-main">
              <Card
                title="Doanh thu theo thời gian"
                description="Đối chiếu tiền vé và doanh thu bắp nước theo ngày (biểu đồ hình cột)"
              >
                <RevenueChart data={data.daily} />
              </Card>

              <Card
                title="Trạng thái đặt vé"
                description="Phân bổ trạng thái của các booking được tạo trong kỳ (biểu đồ hình cột)"
              >
                <DistributionBarChart
                  total={data.bookingStatuses.reduce((sum, s) => sum + s.count, 0)}
                  centerLabel="booking"
                  data={data.bookingStatuses.map((s, i) => ({
                    name: STATUS_LABELS[s.status] || s.status,
                    value: s.count,
                    color: COLORS[i % COLORS.length]
                  }))}
                />
              </Card>
            </div>

            {/* Secondary Column Chart & Booking Insights */}
            <div className="report-grid-halves">
              <Card
                title="Giờ chiếu được ưa chuộng"
                description="Số vé đã bán theo giờ bắt đầu suất chiếu (biểu đồ hình cột)"
              >
                {data.peakHours.some(h => h.ticketsSold > 0) ? (
                  <div className="report-chart" role="img" aria-label="Số vé bán theo giờ chiếu">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={data.peakHours} margin={{ top: 12, right: 18, left: -6, bottom: 8 }}>
                        <CartesianGrid stroke="#ffffff0a" vertical={false} />
                        <XAxis
                          dataKey="hour"
                          tickFormatter={h => `${h}h`}
                          axisLine={false}
                          tickLine={false}
                          interval={2}
                        />
                        <YAxis
                          allowDecimals={false}
                          axisLine={false}
                          tickLine={false}
                          width={45}
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
                  <Empty text="Chưa có vé bán cho các suất chiếu trong kỳ." />
                )}
              </Card>

              <Card
                title="Chất lượng đặt chỗ"
                description="Theo dõi đơn hết hạn, khách không đến và xử lý hoàn tiền"
              >
                <div className="report-insight-list">
                  <div>
                    <ReceiptText size={19} />
                    <span>
                      Tỷ lệ hết hạn thanh toán
                      <small>
                        {number(data.abandoned.expiredBookings)} đơn hết hạn / {number(data.abandoned.expiredBookings + data.abandoned.cancelledBookings + data.abandoned.paidBookings)} đơn đã có kết quả
                      </small>
                    </span>
                    <strong>{percent(data.abandoned.abandonedRatePercent)}</strong>
                  </div>
                  <div>
                    <Ticket size={19} />
                    <span>
                      Tỷ lệ khách không đến
                      <small>
                        {number(data.noShows.noShowBookings)} / {number(data.noShows.finishedPaidBookings)} booking (chỉ tính suất đã kết thúc)
                      </small>
                    </span>
                    <strong>{percent(data.noShows.noShowRatePercent)}</strong>
                  </div>
                  <div>
                    <TrendingUp size={19} />
                    <span>
                      Hoàn tiền trong kỳ
                      <small>{number(summary.refundedBookings)} booking đã hoàn tiền</small>
                    </span>
                    <strong>{vnd(summary.refundAmount)}</strong>
                  </div>
                </div>

                <div className="report-status-counts">
                  {data.bookingStatuses
                    .filter(s => ['HOLDING', 'PENDING_PAYMENT', 'CANCELLED'].includes(s.status))
                    .map(s => (
                      <div key={s.status}>
                        <strong>{number(s.count)}</strong>
                        <span>{STATUS_LABELS[s.status]}</span>
                      </div>
                    ))}
                </div>
              </Card>
            </div>

            {/* Detailed Analytics Tables */}
            <Card
              title="Chi tiết thống kê"
              description="Chọn bảng dữ liệu để xem và xuất file CSV tương ứng"
            >
              <div className="report-table-tabs" role="tablist" aria-label="Loại thống kê">
                {[
                  ['movies', 'Theo phim'],
                  ['daily', 'Theo ngày'],
                  ['rooms', 'Theo phòng'],
                  ['showtimes', 'Theo suất chiếu']
                ].map(([key, label]) => (
                  <button
                    key={key}
                    type="button"
                    role="tab"
                    aria-selected={tab === key}
                    id={`stats-tab-${key}`}
                    aria-controls={`stats-panel-${key}`}
                    onClick={() => setTab(key)}
                  >
                    {label}
                  </button>
                ))}
              </div>

              <div role="tabpanel" id={`stats-panel-${tab}`} aria-labelledby={`stats-tab-${tab}`}>
                {tab === 'movies' && (
                  <>
                    <div className="report-table-controls">
                      <input
                        aria-label="Tìm phim trong báo cáo"
                        placeholder="Tìm tên phim…"
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                      />
                      <select
                        aria-label="Sắp xếp phim"
                        value={sort}
                        onChange={e => setSort(e.target.value)}
                      >
                        <option value="revenue">Doanh thu cao nhất</option>
                        <option value="ticketsSold">Bán nhiều vé nhất</option>
                      </select>
                    </div>
                    <DataTable
                      rows={movies}
                      rowKey={m => m.movieId}
                      columns={[
                        {
                          key: 'movieTitle',
                          label: 'Phim',
                          render: (m, i) => (
                            <div className="flex items-center">
                              <span className={`report-rank ${i < 3 ? 'top' : ''}`}>{i + 1}</span>
                              <strong>{m.movieTitle}</strong>
                            </div>
                          )
                        },
                        { key: 'ticketsSold', label: 'Vé đã bán', align: 'right', render: m => number(m.ticketsSold) },
                        { key: 'revenue', label: 'Doanh thu vé', align: 'right', render: m => <strong className="report-inline-text">{vnd(m.revenue)}</strong> },
                        { key: 'average', label: 'Doanh thu / vé', align: 'right', render: m => vnd(m.ticketsSold ? Math.round(m.revenue / m.ticketsSold) : 0) },
                      ]}
                    />
                  </>
                )}

                {tab === 'daily' && (
                  <DataTable
                    rows={data.daily}
                    rowKey={d => d.date}
                    columns={[
                      { key: 'date', label: 'Ngày', render: d => <strong>{d.date.split('-').reverse().join('/')}</strong> },
                      { key: 'ticketRevenue', label: 'Doanh thu vé', align: 'right', render: d => vnd(d.ticketRevenue) },
                      { key: 'foodRevenue', label: 'Doanh thu F&B', align: 'right', render: d => vnd(d.foodRevenue) },
                      { key: 'totalRevenue', label: 'Tổng doanh thu', align: 'right', render: d => <strong className="report-inline-text">{vnd(d.totalRevenue)}</strong> },
                      { key: 'ticketsSold', label: 'Vé bán', align: 'right', render: d => number(d.ticketsSold) },
                      { key: 'transactions', label: 'Giao dịch', align: 'right', render: d => number(d.transactions) },
                    ]}
                  />
                )}

                {tab === 'rooms' && (
                  <DataTable
                    rows={data.rooms}
                    rowKey={r => r.roomId}
                    columns={[
                      {
                        key: 'roomName',
                        label: 'Phòng chiếu',
                        render: r => (
                          <div>
                            <strong>{r.roomName}</strong>
                            <small className="report-cell-sub">Phòng #{r.roomId}</small>
                          </div>
                        )
                      },
                      { key: 'totalShowtimes', label: 'Suất chiếu', align: 'right', render: r => number(r.totalShowtimes) },
                      { key: 'ticketsSold', label: 'Vé bán', align: 'right', render: r => number(r.ticketsSold) },
                      { key: 'roomCapacity', label: 'Lượt ghế khả dụng', align: 'right', render: r => number(r.roomCapacity) },
                      { key: 'occupancyRate', label: 'Tỷ lệ lấp đầy', align: 'right', render: r => percent(r.occupancyRate) },
                    ]}
                  />
                )}

                {tab === 'showtimes' && (
                  <>
                    <div className="report-table-controls">
                      <select
                        aria-label="Lọc ngày chiếu"
                        value={showDate}
                        onChange={e => setShowDate(e.target.value)}
                      >
                        <option value="">Tất cả ngày chiếu</option>
                        {[...new Set(data.showtimes.map(s => s.startTime.slice(0, 10)))].map(date => (
                          <option key={date} value={date}>
                            {shortDate(date)}/{date.slice(0, 4)}
                          </option>
                        ))}
                      </select>
                    </div>
                    <DataTable
                      rows={showtimes}
                      rowKey={s => s.showtimeId}
                      columns={[
                        {
                          key: 'movieTitle',
                          label: 'Suất chiếu',
                          render: s => (
                            <div>
                              <strong>{s.movieTitle}</strong>
                              <small className="report-cell-sub">#{s.showtimeId} · {s.roomName}</small>
                            </div>
                          )
                        },
                        { key: 'startTime', label: 'Bắt đầu', render: s => `${shortDate(s.startTime)} · ${s.startTime.slice(11, 16)}` },
                        { key: 'capacity', label: 'Sức chứa', align: 'right', render: s => number(s.capacity) },
                        { key: 'sold', label: 'Đã bán', align: 'right', render: s => number(s.sold) },
                        { key: 'remaining', label: 'Còn lại', align: 'right', render: s => number(s.remaining) },
                        { key: 'fill', label: 'Lấp đầy', align: 'right', render: s => percent(s.capacity ? (s.sold * 100) / s.capacity : 0) },
                      ]}
                    />
                  </>
                )}
              </div>
            </Card>

            {/* Synchronized Quick Navigation Links */}
            <div className="report-quick-links">
              {[
                ['overview', BarChart3, 'Tổng quan hệ thống', 'Bức tranh kinh doanh tổng thể và cụm rạp'],
                ['fnb-report', Popcorn, 'Báo cáo F&B', 'Món bán chạy và phân bổ doanh thu bắp nước'],
                ['showtimes', Film, 'Điều phối lịch chiếu', 'Theo dõi và điều chỉnh suất chiếu phòng vé'],
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
              Doanh thu và vé bán tính theo ngày thanh toán; doanh thu phim chỉ gồm phần tiền vé sau phân bổ giảm giá. Công suất phòng, giờ cao điểm và no-show tính theo ngày chiếu. Đơn đang giữ chỗ hoặc chờ thanh toán không nằm trong mẫu số tỷ lệ hết hạn. CSV xuất bảng chi tiết đang chọn.
            </ReportNote>
          </div>
        )}
      </ReportBody>
    </div>
  );
}
