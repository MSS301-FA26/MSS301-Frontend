export const number = (value) => Number(value ?? 0).toLocaleString('vi-VN');
export const vnd = (value) => `${number(value)} ₫`;
export const compact = (value) => new Intl.NumberFormat('vi-VN', { notation: 'compact', maximumFractionDigits: 1 }).format(Number(value ?? 0));
export const dateInput = (date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
export const shortDate = (value) => value ? value.slice(0, 10).split('-').reverse().slice(0, 2).join('/') : '—';
export const percent = (value) => `${Number(value ?? 0).toLocaleString('vi-VN', { maximumFractionDigits: 1 })}%`;
export const ratio = (value, total) => total > 0 ? Number(value) * 100 / Number(total) : 0;
export const SOURCE_LABELS = { WITH_TICKET: 'Mua cùng vé', ADD_ON: 'Đặt thêm cho vé', STANDALONE: 'Mua riêng' };
export const STATUS_LABELS = { HOLDING: 'Đang giữ chỗ', PENDING_PAYMENT: 'Chờ thanh toán', PAID: 'Đã thanh toán', USED: 'Đã sử dụng', CANCELLED: 'Đã hủy', EXPIRED: 'Hết hạn', REFUNDED: 'Đã hoàn tiền' };

export function presetRange(preset, now = new Date()) {
  const start = new Date(now);
  if (preset === 'month') start.setDate(1);
  else start.setDate(start.getDate() - (Number(preset) - 1));
  return { from: dateInput(start), to: dateInput(now) };
}

export function validateRange({ from, to }) {
  const parse = (value) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value || '')) return null;
    const date = new Date(`${value}T00:00:00Z`);
    return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value ? date : null;
  };
  const start = parse(from), end = parse(to);
  if (!start || !end) return 'Vui lòng chọn đầy đủ ngày bắt đầu và ngày kết thúc hợp lệ.';
  if (start > end) return 'Ngày bắt đầu không được sau ngày kết thúc.';
  if ((end - start) / 86400000 >= 366) return 'Khoảng báo cáo tối đa là 366 ngày.';
  return '';
}

export function csvContent(headers, rows) {
  const cell = (value) => {
    let text = String(value ?? '');
    if (/^[\s]*[=+\-@\t\r]/.test(text)) text = `'${text}`;
    return `"${text.replace(/"/g, '""')}"`;
  };
  return '\uFEFF' + [headers, ...rows].map(row => row.map(cell).join(';')).join('\r\n');
}

export function downloadCsv(name, headers, rows) {
  const url = URL.createObjectURL(new Blob([csvContent(headers, rows)], { type: 'text/csv;charset=utf-8;' }));
  const link = document.createElement('a');
  link.href = url; link.download = `${name}.csv`; link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
