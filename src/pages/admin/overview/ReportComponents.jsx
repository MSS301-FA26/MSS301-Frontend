import React, { useEffect, useState } from 'react';
import { AlertCircle, ArrowDownToLine, ArrowUpRight, Building2, CalendarDays, Check, ChevronLeft, ChevronRight, Globe, Inbox, Lock, RefreshCw } from 'lucide-react';
import { Bar, BarChart, CartesianGrid, Cell, ComposedChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { compact, dateInput, number, percent, presetRange, shortDate, vnd } from './reportUtils';
import './reports.css';

export const COLORS = ['#f59e0b', '#14b8a6', '#38bdf8', '#a855f7', '#f43f5e', '#94a3b8', '#fb923c'];

export function ReportHeader({ eyebrow, title, description, icon: Icon, action, onAction }) {
  return (
    <header className="report-header">
      <div className="report-header-main">
        <div className="report-eyebrow">
          <span className="report-eyebrow-box" />
          {eyebrow}
        </div>
        <h1 className="report-title">{title}</h1>
        {description && <p className="report-description">{description}</p>}
      </div>
      {action && (
        <button type="button" className="report-button action-btn" onClick={onAction}>
          <Icon size={15} />
          <span>{action}</span>
          <ArrowUpRight size={14} />
        </button>
      )}
    </header>
  );
}

export function ReportFilters({ report, onExport }) {
  const { draft, setDraft, apply, loading, cinemas, managerCinema, validation, dirty, applied, data } = report;
  const [preset, setPreset] = useState('month');
  const change = (key, value) => {
    setPreset('custom');
    setDraft(previous => ({ ...previous, [key]: value }));
  };
  const selectPreset = (value) => {
    setPreset(value);
    apply({ ...draft, ...presetRange(value) });
  };
  const cinemaName = applied.cinemaId
    ? cinemas.find(c => String(c.id) === String(applied.cinemaId))?.name || `Rạp #${applied.cinemaId}`
    : 'Tất cả rạp';

  return (
    <div className="report-filter-wrap">
      <form className="report-filters" onSubmit={e => { e.preventDefault(); apply(); }} aria-label="Bộ lọc báo cáo">
        <div className="report-presets" aria-label="Khoảng thời gian nhanh">
          {[
            ['1', 'Hôm nay'],
            ['7', '7 ngày'],
            ['30', '30 ngày'],
            ['month', 'Tháng này'],
            ['90', '90 ngày']
          ].map(([key, label]) => (
            <button
              type="button"
              key={key}
              aria-pressed={preset === key}
              disabled={loading}
              onClick={() => selectPreset(key)}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="report-filter-fields">
          {managerCinema ? (
            <div className="report-locked-cinema" title="Tài khoản Quản lý chỉ được phép xem số liệu thuộc chi nhánh được phân công">
              <span className="report-locked-label">Cụm rạp phụ trách</span>
              <div className="report-locked-pill">
                <Lock size={12} className="text-amber-400 shrink-0" />
                <span className="report-locked-name">{cinemas.find(c => String(c.id) === String(managerCinema))?.name || `Rạp #${managerCinema}`}</span>
                <span className="report-locked-badge">Cố định</span>
              </div>
            </div>
          ) : (
            <label>
              <span>Cụm rạp</span>
              <select
                aria-label="Cụm rạp"
                value={draft.cinemaId}
                disabled={loading}
                onChange={e => change('cinemaId', e.target.value)}
              >
                <option value="">Toàn bộ hệ thống (Tất cả rạp)</option>
                {cinemas.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </label>
          )}

          <label>
            <span>Từ ngày</span>
            <input
              aria-label="Từ ngày"
              type="date"
              required
              value={draft.from}
              max={dateInput(new Date())}
              onChange={e => change('from', e.target.value)}
            />
          </label>
          <span className="report-date-separator">—</span>
          <label>
            <span>Đến ngày</span>
            <input
              aria-label="Đến ngày"
              type="date"
              required
              value={draft.to}
              max={dateInput(new Date())}
              onChange={e => change('to', e.target.value)}
            />
          </label>

          <button type="submit" className="report-button primary" disabled={loading}>
            <Check size={15} />
            Áp dụng
          </button>
          <button
            type="button"
            className="report-button icon-only"
            aria-label="Làm mới báo cáo"
            title="Làm mới báo cáo"
            disabled={loading}
            onClick={report.refresh}
          >
            <RefreshCw size={16} className={loading ? 'report-spin' : ''} />
          </button>
          <button
            type="button"
            className="report-button"
            disabled={loading || !data}
            onClick={onExport}
          >
            <ArrowDownToLine size={15} />
            Xuất CSV
          </button>
        </div>
      </form>

      <div className="report-data-status" role="status">
        <div className="report-status-left">
          <CalendarDays size={14} />
          <span>{shortDate(applied.from)}/{applied.from.slice(0, 4)} – {shortDate(applied.to)}/{applied.to.slice(0, 4)}</span>
          <span className="report-status-divider">/</span>
          {managerCinema ? (
            <span className="report-status-cinema manager flex items-center gap-1.5 text-amber-400">
              <Lock size={12} />
              <span>Chi nhánh: {cinemas.find(c => String(c.id) === String(managerCinema))?.name || `Rạp #${managerCinema}`}</span>
            </span>
          ) : applied.cinemaId ? (
            <span className="report-status-cinema filtered flex items-center gap-1.5 text-amber-300">
              <Building2 size={12} />
              <span>Lọc chi nhánh: {cinemaName}</span>
            </span>
          ) : (
            <span className="report-status-cinema all flex items-center gap-1.5 text-emerald-400">
              <Globe size={12} />
              <span>Toàn bộ hệ thống ({cinemas.length || 'Tất cả'} cụm rạp)</span>
            </span>
          )}
        </div>
        <div className="report-status-right">
          {dirty ? (
            <span className="report-status-dirty">Bộ lọc chưa áp dụng</span>
          ) : loading ? (
            <span className="report-status-loading">Đang tải dữ liệu…</span>
          ) : report.error ? (
            <span className="report-status-error">Chưa tải được dữ liệu</span>
          ) : report.updatedAt ? (
            <span className="report-status-updated">
              <span className="report-live-dot" />
              Cập nhật {report.updatedAt.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
            </span>
          ) : null}
        </div>
      </div>

      {validation && (
        <div className="report-alert" role="alert">
          <AlertCircle size={16} />
          <span>{validation}</span>
        </div>
      )}
      {report.cinemaError && (
        <div className="report-alert" role="alert">
          <AlertCircle size={16} />
          <span>{report.cinemaError}</span>
        </div>
      )}
    </div>
  );
}

export function ReportBody({ report, children }) {
  if (report.loading) {
    return (
      <div className="report-loading" aria-busy="true" aria-label="Đang tải báo cáo">
        <div className="report-kpis">
          {[0, 1, 2, 3].map(i => <div key={i} />)}
        </div>
        <div className="report-loading-chart" />
      </div>
    );
  }
  if (report.error) {
    return (
      <div className="report-error" role="alert">
        <AlertCircle size={30} />
        <h2>Chưa tải được báo cáo</h2>
        <p>{report.error}</p>
        <button type="button" className="report-button primary" onClick={report.refresh}>
          <RefreshCw size={15} />
          Thử lại
        </button>
      </div>
    );
  }
  return report.data ? children : null;
}

export function Metric({ label, value, note, icon: Icon, tone = 'amber' }) {
  return (
    <article className={`report-metric ${tone}`}>
      <div className="report-metric-header">
        <span className="report-metric-label">{label}</span>
        <div className="report-metric-icon">
          <Icon size={16} />
        </div>
      </div>
      <strong className="report-metric-val" title={String(value)}>{value}</strong>
      {note && <p className="report-metric-note">{note}</p>}
    </article>
  );
}

export function Card({ title, description, children, action, className = '' }) {
  return (
    <section className={`report-card ${className}`}>
      <div className="report-card-heading">
        <div className="report-card-title-group">
          <h2>{title}</h2>
          {description && <p>{description}</p>}
        </div>
        {action && <div className="report-card-action">{action}</div>}
      </div>
      <div className="report-card-content">
        {children}
      </div>
    </section>
  );
}

export function Empty({ text = 'Chưa có dữ liệu trong khoảng thời gian đã chọn.' }) {
  return (
    <div className="report-empty">
      <Inbox size={26} />
      <p>{text}</p>
      <span>Thử chọn một khoảng thời gian hoặc cụm rạp khác.</span>
    </div>
  );
}

export function ChartTip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  const formattedLabel = label && /^\d{4}-\d{2}-\d{2}$/.test(String(label))
    ? String(label).split('-').reverse().join('/')
    : label;

  return (
    <div className="report-tooltip">
      {formattedLabel && <div className="report-tooltip-title">{formattedLabel}</div>}
      <div className="report-tooltip-list">
        {payload.map((p, i) => (
          <div key={i} className="report-tooltip-row">
            <span className="report-tooltip-chip" style={{ background: p.color }} />
            <span className="report-tooltip-name">{p.name}:</span>
            <strong className="report-tooltip-val">
              {/revenue|doanh thu|tiền|giá/i.test(String(p.name || p.dataKey))
                ? vnd(p.value)
                : /rate|tỷ lệ|lấp đầy/i.test(String(p.name || p.dataKey))
                ? percent(p.value)
                : number(p.value)}
            </strong>
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * Biểu đồ hình cột doanh thu theo thời gian (100% Column Bar Chart)
 * - foodOnly: Cột Doanh thu F&B + Cột Số đơn hàng (không dùng Line)
 * - non-foodOnly: Cột Doanh thu vé + Cột Doanh thu F&B (hỗ trợ Xếp chồng hoặc Cột đôi)
 */
export function RevenueChart({ data = [], foodOnly = false }) {
  const [mode, setMode] = useState('stacked'); // 'stacked' | 'grouped'
  const hasData = (data || []).some(d =>
    Number(d.totalRevenue ?? d.revenue) > 0 ||
    Number(d.orderCount) > 0 ||
    Number(d.transactions) > 0 ||
    Number(d.ticketRevenue) > 0 ||
    Number(d.foodRevenue) > 0
  );

  if (!hasData) {
    return <Empty text="Chưa có giao dịch đã thanh toán trong kỳ này." />;
  }

  if (foodOnly) {
    return (
      <div className="report-chart-box">
        <div className="report-chart" role="img" aria-label="Biểu đồ hình cột doanh thu và số đơn F&B theo ngày">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={data} margin={{ top: 14, right: 10, left: -6, bottom: 4 }}>
              <CartesianGrid stroke="#ffffff0a" vertical={false} />
              <XAxis dataKey="date" tickFormatter={shortDate} tickLine={false} axisLine={false} minTickGap={28} />
              <YAxis yAxisId="money" tickFormatter={compact} tickLine={false} axisLine={false} width={62} />
              <YAxis yAxisId="orders" orientation="right" allowDecimals={false} tickLine={false} axisLine={false} width={34} />
              <Tooltip content={<ChartTip />} />
              <Bar yAxisId="money" dataKey="revenue" name="Doanh thu F&B" fill={COLORS[0]} radius={[0, 0, 0, 0]} maxBarSize={28} />
              <Bar yAxisId="orders" dataKey="orderCount" name="Số đơn hàng" fill={COLORS[1]} radius={[0, 0, 0, 0]} maxBarSize={28} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
        <div className="report-legend">
          <span><i style={{ background: COLORS[0] }} />Doanh thu F&B (Cột trái)</span>
          <span><i style={{ background: COLORS[1] }} />Số đơn hàng (Cột phải)</span>
        </div>
      </div>
    );
  }

  return (
    <div className="report-chart-box">
      <div className="report-chart-toolbar">
        <div className="report-chart-mode-group" role="group" aria-label="Kiểu biểu đồ hình cột">
          <button
            type="button"
            className={mode === 'stacked' ? 'active' : ''}
            onClick={() => setMode('stacked')}
          >
            Xếp chồng
          </button>
          <button
            type="button"
            className={mode === 'grouped' ? 'active' : ''}
            onClick={() => setMode('grouped')}
          >
            Cột đôi
          </button>
        </div>
      </div>
      <div className="report-chart" role="img" aria-label="Biểu đồ hình cột doanh thu vé và F&B theo ngày">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 12, right: 10, left: -6, bottom: 4 }}>
            <CartesianGrid stroke="#ffffff0a" vertical={false} />
            <XAxis dataKey="date" tickFormatter={shortDate} tickLine={false} axisLine={false} minTickGap={28} />
            <YAxis tickFormatter={compact} tickLine={false} axisLine={false} width={62} />
            <Tooltip content={<ChartTip />} />
            <Bar
              dataKey="ticketRevenue"
              name="Doanh thu vé"
              fill={COLORS[0]}
              stackId={mode === 'stacked' ? 'rev' : undefined}
              radius={[0, 0, 0, 0]}
              maxBarSize={mode === 'stacked' ? 32 : 18}
            />
            <Bar
              dataKey="foodRevenue"
              name="Doanh thu F&B"
              fill={COLORS[1]}
              stackId={mode === 'stacked' ? 'rev' : undefined}
              radius={[0, 0, 0, 0]}
              maxBarSize={mode === 'stacked' ? 32 : 18}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <div className="report-legend">
        <span><i style={{ background: COLORS[0] }} />Doanh thu vé xem phim</span>
        <span><i style={{ background: COLORS[1] }} />Doanh thu bắp nước & combo</span>
      </div>
    </div>
  );
}

/**
 * Biểu đồ hình cột phân bổ cơ cấu (thay thế biểu đồ tròn Donut)
 * 100% hình cột vuông góc sắc nét, có bảng thống kê tỷ trọng chi tiết bên dưới.
 */
export function DistributionBarChart({ data = [], total, centerLabel = 'mục', money = false }) {
  const positive = (data || []).filter(d => Number(d.value) > 0);
  if (!positive.length) {
    return <Empty text={money ? 'Chưa có doanh thu để phân bổ trong kỳ này.' : 'Chưa có dữ liệu phân bổ trong kỳ này.'} />;
  }

  const effectiveTotal = Number(total) > 0
    ? Number(total)
    : positive.reduce((sum, item) => sum + Number(item.value), 0);

  const chartData = positive.map((item, index) => ({
    name: item.name,
    value: Number(item.value),
    color: item.color || COLORS[index % COLORS.length],
    percentage: effectiveTotal > 0 ? ((Number(item.value) * 100) / effectiveTotal).toFixed(1) : 0,
  }));

  // Smart label abbreviation for X-axis when there are multiple categories
  const formatXAxisTick = (name) => {
    if (chartData.length <= 3) {
      return name.length > 15 ? `${name.slice(0, 13)}…` : name;
    }
    const SHORT_LABELS = {
      'Đã thanh toán': 'T.Toán',
      'Đã sử dụng': 'Đã xem',
      'Đang giữ chỗ': 'Giữ chỗ',
      'Chờ thanh toán': 'Chờ trả',
      'Đã hủy': 'Hủy',
      'Đã hoàn tiền': 'Hoàn',
      'Hết hạn': 'Hết hạn',
      'Vé xem phim': 'Vé xem',
      'Bắp nước & combo': 'F&B',
      'Mua cùng vé': 'Cùng vé',
      'Đặt thêm cho vé': 'Đặt thêm',
      'Mua riêng': 'Mua riêng',
    };
    if (SHORT_LABELS[name]) return SHORT_LABELS[name];
    return name.length > 8 ? `${name.slice(0, 7)}…` : name;
  };

  return (
    <div className="report-dist-wrap">
      <div className="report-dist-header">
        <span className="report-dist-header-label">TỔNG CỘNG</span>
        <strong className="report-dist-header-val">
          {money ? vnd(effectiveTotal) : `${number(effectiveTotal)} ${centerLabel}`}
        </strong>
      </div>

      <div className="report-dist-chart" role="img" aria-label={`Biểu đồ hình cột ${centerLabel}`}>
        <ResponsiveContainer width="100%" height={175}>
          <BarChart data={chartData} margin={{ top: 12, right: 12, left: 0, bottom: 4 }}>
            <CartesianGrid stroke="#ffffff0a" vertical={false} />
            <XAxis
              dataKey="name"
              tickLine={false}
              axisLine={false}
              interval={0}
              tickFormatter={formatXAxisTick}
              tick={{ fill: '#8590a1', fontSize: 10 }}
            />
            <YAxis
              tickFormatter={money ? compact : number}
              tickLine={false}
              axisLine={false}
              width={60}
              tick={{ fill: '#8590a1', fontSize: 10 }}
            />
            <Tooltip content={<ChartTip />} />
            <Bar dataKey="value" name={centerLabel} radius={[0, 0, 0, 0]} maxBarSize={44}>
              {chartData.map((entry, idx) => (
                <Cell key={`cell-${idx}`} fill={entry.color} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="report-dist-legend">
        {chartData.map((item, idx) => (
          <div key={`item-${idx}`} className="report-dist-item">
            <div className="report-dist-item-top">
              <span className="report-dist-item-name">
                <i style={{ background: item.color }} />
                {item.name}
              </span>
              <span className="report-dist-item-val">
                {money ? vnd(item.value) : `${number(item.value)} ${centerLabel}`}
                <b className="report-dist-item-pct">{item.percentage}%</b>
              </span>
            </div>
            <div className="report-progress-track">
              <i style={{ width: `${Math.min(100, item.percentage)}%`, background: item.color }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// Giữ alias Donut trỏ vào DistributionBarChart để tương thích hoàn toàn
export const Donut = DistributionBarChart;

export function DataTable({ columns, rows = [], rowKey, emptyText, pageSize = 8 }) {
  const [page, setPage] = useState(1);
  useEffect(() => { setPage(1); }, [rows]);
  const pages = Math.max(1, Math.ceil(rows.length / pageSize));
  const current = Math.min(page, pages);

  return (
    <div className="report-table-wrapper">
      <div className="report-table-scroll">
        <table className="report-table">
          <thead>
            <tr>
              {columns.map(c => (
                <th key={c.key} className={c.align === 'right' ? 'numeric' : ''} scope="col">
                  {c.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.slice((current - 1) * pageSize, current * pageSize).map((row, i) => (
              <tr key={rowKey ? rowKey(row) : i}>
                {columns.map(c => (
                  <td key={c.key} className={c.align === 'right' ? 'numeric' : ''}>
                    {c.render ? c.render(row, (current - 1) * pageSize + i) : row[c.key]}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
        {!rows.length && <Empty text={emptyText} />}
      </div>
      {rows.length > 0 && (
        <div className="report-pagination">
          <span>
            {(current - 1) * pageSize + 1}–{Math.min(current * pageSize, rows.length)} / {number(rows.length)} dòng
          </span>
          <div className="report-pagination-nav">
            <button
              type="button"
              className="report-button icon-only"
              aria-label="Trang trước"
              disabled={current <= 1}
              onClick={() => setPage(current - 1)}
            >
              <ChevronLeft size={16} />
            </button>
            <span className="report-page-count">{current} / {pages}</span>
            <button
              type="button"
              className="report-button icon-only"
              aria-label="Trang tiếp theo"
              disabled={current >= pages}
              onClick={() => setPage(current + 1)}
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export function ReportNote({ children }) {
  return (
    <div className="report-note">
      <AlertCircle size={15} />
      <p>{children}</p>
    </div>
  );
}
