import React, { useMemo, useState } from 'react';
import { ArrowUpRight, BarChart3, Film, PackageCheck, Popcorn, ReceiptText, ShoppingBag, TrendingUp } from 'lucide-react';
import useAdminReport from './useAdminReport';
import { Card, COLORS, DataTable, DistributionBarChart, Metric, ReportBody, ReportFilters, ReportHeader, ReportNote, RevenueChart } from './ReportComponents';
import { downloadCsv, number, percent, ratio, SOURCE_LABELS, vnd } from './reportUtils';

export default function AdminFnbReportPanel({ ctx }) {
  const report = useAdminReport(ctx, 'getConcessionSales');
  const data = report.data;
  const navigate = ctx.changeAdminSection || ctx.onSectionChange || (() => {});
  const [tab, setTab] = useState('products');
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState('revenue');

  const products = useMemo(() => (data?.lines || [])
    .filter(p => p.name.toLocaleLowerCase('vi').includes(search.toLocaleLowerCase('vi')))
    .sort((a, b) => Number(b[sort]) - Number(a[sort])),
    [data, search, sort]
  );

  const exportReport = () => {
    const suffix = `${report.applied.from}-${report.applied.to}`;
    if (tab === 'daily') {
      downloadCsv(
        `fnb-theo-ngay-${suffix}`,
        ['Ngày', 'Số đơn', 'Số món/combo', 'Doanh thu (VND)'],
        data.daily.map(d => [d.date, d.orderCount, d.quantity, d.revenue])
      );
    } else {
      downloadCsv(
        `fnb-san-pham-${suffix}`,
        ['Món/combo', 'Số lượng', 'Doanh thu (VND)', 'Tỷ trọng (%)'],
        products.map(p => [p.name, p.quantity, p.revenue, ratio(p.revenue, data.totalRevenue).toFixed(2)])
      );
    }
  };

  return (
    <div className="admin-report">
      <ReportHeader
        eyebrow="CINEPREMIER / BẮP NƯỚC & COMBO"
        title="Báo cáo F&B"
        description="Theo dõi doanh thu quầy bắp nước, các combo bán chạy nhất và tỷ trọng đóng góp từ từng kênh bán hàng."
        icon={ShoppingBag}
        action="Quản lý kho bắp nước"
        onAction={() => navigate('foods')}
      />

      <ReportFilters report={report} onExport={exportReport} />

      <ReportBody report={report}>
        {data && (
          <div className="report-body-stack">
            {/* 4 Square KPIs */}
            <div className="report-kpis">
              <Metric
                label="Doanh thu F&B"
                value={vnd(data.totalRevenue)}
                icon={TrendingUp}
                tone="amber"
                note="Tổng tiền bắp nước thực nhận sau phân bổ giảm giá"
              />
              <Metric
                label="Đơn có bắp nước"
                value={number(data.totalOrders)}
                icon={ReceiptText}
                tone="teal"
                note="Bao gồm mua cùng vé, đặt thêm và mua riêng lẻ"
              />
              <Metric
                label="Món / Combo đã bán"
                value={number(data.totalItemsSold)}
                icon={PackageCheck}
                tone="blue"
                note="Mỗi combo trọn gói được tính là một sản phẩm xuất bán"
              />
              <Metric
                label="Giá trị đơn TB"
                value={vnd(Math.round(Number(data.averageOrderValue)))}
                icon={Popcorn}
                tone="purple"
                note="Doanh thu F&B / tổng số đơn hàng có bắp nước"
              />
            </div>

            {/* 2 Main Column Bar Charts */}
            <div className="report-grid-main">
              <Card
                title="Doanh thu &amp; số đơn theo ngày"
                description="Đối chiếu doanh thu (trái) và số đơn hàng (phải) dạng biểu đồ hình cột"
              >
                <RevenueChart data={data.daily} foodOnly />
              </Card>

              <Card
                title="Cơ cấu kênh bán"
                description="Tỷ trọng doanh thu theo từng hình thức mua hàng (biểu đồ hình cột)"
              >
                <DistributionBarChart
                  money
                  total={Number(data.totalRevenue)}
                  centerLabel="VND doanh thu"
                  data={data.sources.map((s, i) => ({
                    name: SOURCE_LABELS[s.source] || s.source,
                    value: Number(s.revenue),
                    color: COLORS[i % COLORS.length]
                  }))}
                />
              </Card>
            </div>

            {/* Source Performance Cards */}
            <div>
              <div className="report-section-label">
                <div>
                  <h2>Hiệu quả theo kênh bán hàng</h2>
                  <p>Mỗi giao dịch chỉ thuộc một kênh cố định, doanh thu không cộng trùng</p>
                </div>
              </div>
              <div className="report-source-cards">
                {data.sources.map((s, i) => (
                  <article className="report-source-card" key={s.source}>
                    <h3>
                      <i style={{ background: COLORS[i % COLORS.length] }} />
                      {SOURCE_LABELS[s.source] || s.source}
                    </h3>
                    <strong>{vnd(s.revenue)}</strong>
                    <p>
                      {number(s.orderCount)} đơn · {number(s.quantity)} món/combo · {percent(ratio(s.revenue, data.totalRevenue))} doanh thu
                    </p>
                  </article>
                ))}
              </div>
            </div>

            {/* Detailed F&B Sales Table */}
            <Card
              title="Chi tiết bán hàng F&B"
              description="Xếp hạng sản phẩm bắp nước và đối chiếu doanh thu theo ngày"
            >
              <div className="report-table-tabs" role="tablist" aria-label="Loại báo cáo F&B">
                {[
                  ['products', 'Món & combo'],
                  ['daily', 'Theo ngày bán']
                ].map(([key, label]) => (
                  <button
                    key={key}
                    type="button"
                    role="tab"
                    id={`fnb-tab-${key}`}
                    aria-controls={`fnb-panel-${key}`}
                    aria-selected={tab === key}
                    onClick={() => setTab(key)}
                  >
                    {label}
                  </button>
                ))}
              </div>

              <div role="tabpanel" id={`fnb-panel-${tab}`} aria-labelledby={`fnb-tab-${tab}`}>
                {tab === 'products' ? (
                  <>
                    <div className="report-table-controls">
                      <input
                        aria-label="Tìm món hoặc combo"
                        placeholder="Tìm kiếm tên món hoặc combo…"
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                      />
                      <select
                        aria-label="Sắp xếp sản phẩm"
                        value={sort}
                        onChange={e => setSort(e.target.value)}
                      >
                        <option value="revenue">Doanh thu cao nhất</option>
                        <option value="quantity">Số lượng bán nhiều nhất</option>
                      </select>
                    </div>
                    <DataTable
                      rows={products}
                      rowKey={p => p.name}
                      columns={[
                        {
                          key: 'name',
                          label: 'Món / combo',
                          render: (p, i) => (
                            <div className="flex items-center">
                              <span className={`report-rank ${i < 3 ? 'top' : ''}`}>{String(i + 1).padStart(2, '0')}</span>
                              <strong>{p.name}</strong>
                            </div>
                          )
                        },
                        { key: 'quantity', label: 'Số lượng đã bán', align: 'right', render: p => number(p.quantity) },
                        { key: 'revenue', label: 'Doanh thu', align: 'right', render: p => <strong className="report-inline-text">{vnd(p.revenue)}</strong> },
                        {
                          key: 'share',
                          label: 'Tỷ trọng',
                          align: 'right',
                          render: p => (
                            <span className="report-progress">
                              <span className="report-progress-track">
                                <i style={{ width: `${Math.min(100, ratio(p.revenue, data.totalRevenue))}%` }} />
                              </span>
                              {percent(ratio(p.revenue, data.totalRevenue))}
                            </span>
                          )
                        },
                      ]}
                    />
                  </>
                ) : (
                  <DataTable
                    rows={data.daily}
                    rowKey={d => d.date}
                    columns={[
                      { key: 'date', label: 'Ngày', render: d => <strong>{d.date.split('-').reverse().join('/')}</strong> },
                      { key: 'orderCount', label: 'Số đơn hàng', align: 'right', render: d => number(d.orderCount) },
                      { key: 'quantity', label: 'Món / combo', align: 'right', render: d => number(d.quantity) },
                      { key: 'revenue', label: 'Doanh thu F&B', align: 'right', render: d => <strong className="report-inline-text">{vnd(d.revenue)}</strong> },
                      { key: 'average', label: 'Giá trị đơn TB', align: 'right', render: d => vnd(d.orderCount ? Math.round(d.revenue / d.orderCount) : 0) },
                    ]}
                  />
                )}
              </div>
            </Card>

            {/* Synchronized Quick Navigation Links */}
            <div className="report-quick-links">
              {[
                ['overview', BarChart3, 'Tổng quan hệ thống', 'Bức tranh kinh doanh tổng thể và cụm rạp'],
                ['statistics', TrendingUp, 'Thống kê mua bán', 'Phân tích doanh thu vé và suất chiếu'],
                ['foods', ShoppingBag, 'Quản lý bắp nước', 'Cập nhật món ăn, bảng giá và combo rạp'],
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
              Chỉ ghi nhận booking PAID/USED và đơn F&B đã thanh toán hoặc đã giao. Đơn mua cùng vé được phân bổ giảm giá theo giá trị vé và món; đơn đặt thêm, mua riêng dùng số tiền thực trả. Sản phẩm cùng tên được gộp trong bảng. Chưa có dữ liệu giá vốn nên báo cáo không hiển thị lợi nhuận. CSV xuất bảng đang chọn.
            </ReportNote>
          </div>
        )}
      </ReportBody>
    </div>
  );
}
