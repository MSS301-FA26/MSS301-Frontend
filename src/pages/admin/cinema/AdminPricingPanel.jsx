import React, { useState, useEffect, useMemo } from 'react';
import {
  DollarSign,
  Plus,
  Search,
  RefreshCw,
  Edit3,
  Trash2,
  CheckCircle2,
  XCircle,
  Clock,
  Calendar,
  Layers,
  AlertTriangle,
  Building2,
  Sparkles,
  Check,
  X
} from 'lucide-react';
import { adminService } from '../../../services/adminService';

const formatVnd = (value) => {
  if (value === null || value === undefined || value === '') return '0đ';
  return `${Number(value).toLocaleString('vi-VN')}đ`;
};

const formatDate = (isoString) => {
  if (!isoString) return 'Vô thời hạn';
  try {
    const d = new Date(isoString);
    if (isNaN(d.getTime())) return isoString;
    return d.toLocaleDateString('vi-VN', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  } catch {
    return isoString;
  }
};

export default function AdminPricingPanel({ ctx }) {
  const { getAdminToken, showToast } = ctx;
  const [rules, setRules] = useState([]);
  const [cinemas, setCinemas] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [seatTypeFilter, setSeatTypeFilter] = useState('ALL');
  const [cinemaFilter, setCinemaFilter] = useState('ALL');

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingRule, setEditingRule] = useState(null);
  const [formData, setFormData] = useState({
    cinemaId: '',
    seatType: 'SINGLE',
    price: 90000,
    active: true,
    effectiveFrom: '',
    effectiveTo: ''
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState(null);

  const loadData = async () => {
    const token = getAdminToken();
    if (!token) return;
    setIsLoading(true);
    try {
      const [rulesData, cinemasData] = await Promise.all([
        adminService.getAdminPricingRules(token, { size: 100 }),
        adminService.getAdminCinemas(token).catch(() => ({ items: [] }))
      ]);
      setRules(rulesData.items || []);
      setCinemas(cinemasData.items || (Array.isArray(cinemasData) ? cinemasData : []));
    } catch (err) {
      showToast(err?.message || 'Không thể tải danh sách giá vé.');
      setRules([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const filteredRules = useMemo(() => {
    return rules.filter((r) => {
      if (seatTypeFilter !== 'ALL' && r.seatType !== seatTypeFilter) return false;
      if (cinemaFilter !== 'ALL' && String(r.cinemaId) !== cinemaFilter) return false;
      return true;
    });
  }, [rules, seatTypeFilter, cinemaFilter]);

  const stats = useMemo(() => {
    const singleRule = rules.find((r) => r.seatType === 'SINGLE' && r.active);
    const coupleRule = rules.find((r) => r.seatType === 'COUPLE' && r.active);
    return {
      total: rules.length,
      activeCount: rules.filter((r) => r.active).length,
      singlePrice: singleRule ? singleRule.price : 90000,
      couplePrice: coupleRule ? coupleRule.price : 180000
    };
  }, [rules]);

  const handleOpenCreate = () => {
    setEditingRule(null);
    setFormData({
      cinemaId: cinemas.length > 0 ? String(cinemas[0].id) : '1',
      seatType: 'SINGLE',
      price: 90000,
      active: true,
      effectiveFrom: '',
      effectiveTo: ''
    });
    setIsModalOpen(true);
  };

  const handleOpenEdit = (rule) => {
    setEditingRule(rule);
    setFormData({
      cinemaId: rule.cinemaId ? String(rule.cinemaId) : (cinemas.length > 0 ? String(cinemas[0].id) : '1'),
      seatType: rule.seatType || 'SINGLE',
      price: rule.price || 0,
      active: rule.active ?? true,
      effectiveFrom: rule.effectiveFrom ? rule.effectiveFrom.slice(0, 10) : '',
      effectiveTo: rule.effectiveTo ? rule.effectiveTo.slice(0, 10) : ''
    });
    setIsModalOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const token = getAdminToken();
    if (!token) return;

    if (!formData.price || Number(formData.price) < 0) {
      showToast('Vui lòng nhập giá vé hợp lệ (>= 0đ)');
      return;
    }

    setIsSubmitting(true);
    try {
      const payload = {
        cinemaId: formData.cinemaId ? Number(formData.cinemaId) : null,
        seatType: formData.seatType,
        price: Number(formData.price),
        active: formData.active,
        effectiveFrom: formData.effectiveFrom ? `${formData.effectiveFrom}T00:00:00` : null,
        effectiveTo: formData.effectiveTo ? `${formData.effectiveTo}T23:59:59` : null
      };

      if (editingRule) {
        await adminService.updateAdminPricingRule(token, editingRule.id, payload);
        showToast('Đã cập nhật bảng giá vé thành công.');
      } else {
        await adminService.createAdminPricingRule(token, payload);
        showToast('Đã thêm quy tắc giá vé mới thành công.');
      }
      setIsModalOpen(false);
      loadData();
    } catch (err) {
      showToast(err?.message || 'Thao tác không thành công.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id) => {
    const token = getAdminToken();
    if (!token) return;
    try {
      await adminService.deleteAdminPricingRule(token, id);
      showToast('Đã xóa quy tắc giá vé.');
      setDeleteConfirmId(null);
      loadData();
    } catch (err) {
      showToast(err?.message || 'Không thể xóa quy tắc giá.');
    }
  };

  return (
    <div className="space-y-6">
      {/* Header & Stats */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <DollarSign className="w-6 h-6 text-amber-500" />
            Quản Lý Bảng Giá Vé
          </h1>
          <p className="text-sm text-neutral-400">
            Cấu hình giá vé Ghế Đơn (SINGLE) và Ghế Đôi (COUPLE) theo rạp. Giá là nguồn chân lý duy nhất (Source of Truth) cho Booking.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={loadData}
            disabled={isLoading}
            className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-neutral-300 bg-neutral-800 hover:bg-neutral-700 rounded-lg border border-neutral-700 transition"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            Làm mới
          </button>
          <button
            onClick={handleOpenCreate}
            className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-black bg-amber-500 hover:bg-amber-400 rounded-lg shadow-lg shadow-amber-500/20 transition"
          >
            <Plus className="w-4 h-4" />
            Thêm Bảng Giá
          </button>
        </div>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="p-4 rounded-xl bg-neutral-900/80 border border-neutral-800 backdrop-blur-sm">
          <div className="flex items-center justify-between text-neutral-400 mb-1">
            <span className="text-xs font-medium uppercase tracking-wider">Ghế Đơn (SINGLE)</span>
            <span className="p-1.5 rounded-lg bg-amber-500/10 text-amber-400">
              <Layers className="w-4 h-4" />
            </span>
          </div>
          <div className="text-2xl font-bold text-white">{formatVnd(stats.singlePrice)}</div>
          <span className="text-xs text-neutral-400">Áp dụng mặc định</span>
        </div>

        <div className="p-4 rounded-xl bg-neutral-900/80 border border-neutral-800 backdrop-blur-sm">
          <div className="flex items-center justify-between text-neutral-400 mb-1">
            <span className="text-xs font-medium uppercase tracking-wider">Ghế Đôi (COUPLE)</span>
            <span className="p-1.5 rounded-lg bg-pink-500/10 text-pink-400">
              <Sparkles className="w-4 h-4" />
            </span>
          </div>
          <div className="text-2xl font-bold text-white">{formatVnd(stats.couplePrice)}</div>
          <span className="text-xs text-neutral-400">Bán nguyên cặp (2 người)</span>
        </div>

        <div className="p-4 rounded-xl bg-neutral-900/80 border border-neutral-800 backdrop-blur-sm">
          <div className="flex items-center justify-between text-neutral-400 mb-1">
            <span className="text-xs font-medium uppercase tracking-wider">Quy Tắc Đang Áp Dụng</span>
            <span className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-400">
              <CheckCircle2 className="w-4 h-4" />
            </span>
          </div>
          <div className="text-2xl font-bold text-emerald-400">{stats.activeCount} / {stats.total}</div>
          <span className="text-xs text-neutral-400">Trạng thái Active</span>
        </div>

        <div className="p-4 rounded-xl bg-neutral-900/80 border border-neutral-800 backdrop-blur-sm">
          <div className="flex items-center justify-between text-neutral-400 mb-1">
            <span className="text-xs font-medium uppercase tracking-wider">Rạp Hoạt Động</span>
            <span className="p-1.5 rounded-lg bg-blue-500/10 text-blue-400">
              <Building2 className="w-4 h-4" />
            </span>
          </div>
          <div className="text-2xl font-bold text-blue-400">{cinemas.length || 1} Rạp</div>
          <span className="text-xs text-neutral-400">CineAI Network</span>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3 p-3 rounded-xl bg-neutral-900/60 border border-neutral-800">
        <span className="text-xs font-medium text-neutral-400 uppercase tracking-wider">Bộ lọc:</span>
        <div className="flex items-center gap-1.5">
          {['ALL', 'SINGLE', 'COUPLE'].map((type) => (
            <button
              key={type}
              onClick={() => setSeatTypeFilter(type)}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition ${
                seatTypeFilter === type
                  ? 'bg-amber-500 text-black'
                  : 'bg-neutral-800 text-neutral-300 hover:bg-neutral-700'
              }`}
            >
              {type === 'ALL' ? 'Tất cả loại ghế' : type === 'SINGLE' ? 'Ghế Đơn (SINGLE)' : 'Ghế Đôi (COUPLE)'}
            </button>
          ))}
        </div>
        {cinemas.length > 1 && (
          <select
            value={cinemaFilter}
            onChange={(e) => setCinemaFilter(e.target.value)}
            className="px-3 py-1.5 text-xs bg-neutral-800 text-neutral-300 border border-neutral-700 rounded-lg focus:outline-none"
          >
            <option value="ALL">Tất cả rạp</option>
            {cinemas.map((c) => (
              <option key={c.id} value={String(c.id)}>{c.name}</option>
            ))}
          </select>
        )}
      </div>

      {/* Pricing Table */}
      <div className="overflow-hidden rounded-xl border border-neutral-800 bg-neutral-900/70 shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-neutral-300">
            <thead className="border-b border-neutral-800 bg-neutral-950/80 text-xs font-semibold uppercase tracking-wider text-neutral-400">
              <tr>
                <th className="px-5 py-4">Rạp Áp Dụng</th>
                <th className="px-5 py-4">Loại Ghế</th>
                <th className="px-5 py-4">Giá Vé (VND)</th>
                <th className="px-5 py-4">Sức Chứa</th>
                <th className="px-5 py-4">Thời Hạn Hiệu Lực</th>
                <th className="px-5 py-4">Trạng Thái</th>
                <th className="px-5 py-4 text-right">Thao Tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-800/60">
              {isLoading ? (
                <tr>
                  <td colSpan={7} className="px-5 py-12 text-center text-neutral-400">
                    <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-amber-500" />
                    Đang tải dữ liệu bảng giá...
                  </td>
                </tr>
              ) : filteredRules.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-5 py-12 text-center text-neutral-400">
                    Chưa có cấu hình giá vé phù hợp. Nhấp "Thêm Bảng Giá" để cấu hình.
                  </td>
                </tr>
              ) : (
                filteredRules.map((rule) => {
                  const isCouple = rule.seatType === 'COUPLE';
                  return (
                    <tr key={rule.id} className="hover:bg-neutral-800/40 transition">
                      <td className="px-5 py-4 font-medium text-white flex items-center gap-2">
                        <Building2 className="w-4 h-4 text-neutral-400" />
                        {rule.cinemaName || 'Tất cả rạp / Mặc định'}
                      </td>
                      <td className="px-5 py-4">
                        <span
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold ${
                            isCouple
                              ? 'bg-pink-500/10 text-pink-400 border border-pink-500/20'
                              : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                          }`}
                        >
                          {isCouple ? 'Ghế Đôi (COUPLE)' : 'Ghế Đơn (SINGLE)'}
                        </span>
                      </td>
                      <td className="px-5 py-4 font-bold text-amber-400 text-base">
                        {formatVnd(rule.price)}
                      </td>
                      <td className="px-5 py-4 text-neutral-400">
                        {isCouple ? '2 người / cặp' : '1 người / ghế'}
                      </td>
                      <td className="px-5 py-4 text-xs text-neutral-400">
                        {rule.effectiveFrom || rule.effectiveTo ? (
                          <div className="space-y-0.5">
                            <div>Từ: {formatDate(rule.effectiveFrom)}</div>
                            <div>Đến: {formatDate(rule.effectiveTo)}</div>
                          </div>
                        ) : (
                          <span className="text-neutral-400">Không giới hạn</span>
                        )}
                      </td>
                      <td className="px-5 py-4">
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold ${
                            rule.active
                              ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                              : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                          }`}
                        >
                          {rule.active ? <Check className="w-3 h-3" /> : <X className="w-3 h-3" />}
                          {rule.active ? 'Đang áp dụng' : 'Ngừng áp dụng'}
                        </span>
                      </td>
                      <td className="px-5 py-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => handleOpenEdit(rule)}
                            className="p-1.5 rounded-lg text-neutral-400 hover:text-white hover:bg-neutral-800 transition"
                            title="Sửa giá vé"
                          >
                            <Edit3 className="w-4 h-4" />
                          </button>
                          {deleteConfirmId === rule.id ? (
                            <div className="flex items-center gap-1">
                              <button
                                onClick={() => handleDelete(rule.id)}
                                className="px-2 py-1 text-xs font-semibold text-rose-300 bg-rose-900/60 hover:bg-rose-900 rounded border border-rose-700 transition"
                              >
                                Xác nhận
                              </button>
                              <button
                                onClick={() => setDeleteConfirmId(null)}
                                className="px-2 py-1 text-xs text-neutral-400 hover:text-white"
                              >
                                Hủy
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={() => setDeleteConfirmId(rule.id)}
                              className="p-1.5 rounded-lg text-neutral-400 hover:text-rose-400 hover:bg-rose-950/30 transition"
                              title="Xóa quy tắc"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create / Edit Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="relative w-full max-w-lg rounded-2xl bg-neutral-900 border border-neutral-800 p-6 shadow-2xl">
            <button
              onClick={() => setIsModalOpen(false)}
              className="absolute top-4 right-4 text-neutral-400 hover:text-white"
            >
              <X className="w-5 h-5" />
            </button>

            <h2 className="text-xl font-bold text-white mb-1 flex items-center gap-2">
              <DollarSign className="w-5 h-5 text-amber-500" />
              {editingRule ? 'Chỉnh Sửa Giá Vé' : 'Thêm Quy Tắc Giá Vé'}
            </h2>
            <p className="text-xs text-neutral-400 mb-6">
              Giá vé cấu hình tại đây sẽ được snapshot trực tiếp vào Booking và không bị thay đổi trong quá khứ.
            </p>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-neutral-300 mb-1.5">
                  Rạp áp dụng
                </label>
                <select
                  value={formData.cinemaId}
                  onChange={(e) => setFormData({ ...formData, cinemaId: e.target.value })}
                  className="w-full px-3.5 py-2.5 bg-neutral-950 border border-neutral-800 rounded-xl text-sm text-white focus:border-amber-500 focus:outline-none"
                >
                  <option value="">Tất cả rạp / Chung</option>
                  {cinemas.map((c) => (
                    <option key={c.id} value={String(c.id)}>{c.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-neutral-300 mb-1.5">
                  Loại ghế
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, seatType: 'SINGLE', price: formData.price || 90000 })}
                    className={`p-3 rounded-xl border text-left transition ${
                      formData.seatType === 'SINGLE'
                        ? 'border-amber-500 bg-amber-500/10 text-amber-400 font-semibold'
                        : 'border-neutral-800 bg-neutral-950 text-neutral-400 hover:border-neutral-700'
                    }`}
                  >
                    <div className="text-sm font-bold">Ghế Đơn (SINGLE)</div>
                    <div className="text-xs opacity-70">Sức chứa 1 người</div>
                  </button>
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, seatType: 'COUPLE', price: formData.price || 180000 })}
                    className={`p-3 rounded-xl border text-left transition ${
                      formData.seatType === 'COUPLE'
                        ? 'border-pink-500 bg-pink-500/10 text-pink-400 font-semibold'
                        : 'border-neutral-800 bg-neutral-950 text-neutral-400 hover:border-neutral-700'
                    }`}
                  >
                    <div className="text-sm font-bold">Ghế Đôi (COUPLE)</div>
                    <div className="text-xs opacity-70">Sức chứa 2 người / cặp</div>
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-neutral-300 mb-1.5">
                  Giá vé (VND) *
                </label>
                <div className="relative">
                  <input
                    type="number"
                    step="1000"
                    min="0"
                    value={formData.price}
                    onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-neutral-950 border border-neutral-800 rounded-xl text-base font-bold text-amber-400 focus:border-amber-500 focus:outline-none"
                    placeholder="90000"
                    required
                  />
                  <span className="absolute right-3.5 top-2.5 text-xs text-neutral-400 font-semibold">
                    {formatVnd(formData.price)}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-neutral-300 mb-1.5">
                    Hiệu lực từ ngày
                  </label>
                  <input
                    type="date"
                    value={formData.effectiveFrom}
                    onChange={(e) => setFormData({ ...formData, effectiveFrom: e.target.value })}
                    className="w-full px-3 py-2 bg-neutral-950 border border-neutral-800 rounded-xl text-xs text-white focus:border-amber-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-neutral-300 mb-1.5">
                    Đến ngày
                  </label>
                  <input
                    type="date"
                    value={formData.effectiveTo}
                    onChange={(e) => setFormData({ ...formData, effectiveTo: e.target.value })}
                    className="w-full px-3 py-2 bg-neutral-950 border border-neutral-800 rounded-xl text-xs text-white focus:border-amber-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="flex items-center gap-2 pt-2">
                <input
                  type="checkbox"
                  id="activeRuleCheck"
                  checked={formData.active}
                  onChange={(e) => setFormData({ ...formData, active: e.target.checked })}
                  className="w-4 h-4 rounded text-amber-500 bg-neutral-950 border-neutral-800 focus:ring-0 cursor-pointer"
                />
                <label htmlFor="activeRuleCheck" className="text-xs text-neutral-300 cursor-pointer">
                  Kích hoạt bảng giá này ngay lập tức
                </label>
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-neutral-800">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-sm text-neutral-400 hover:text-white transition"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2 text-sm font-semibold text-black bg-amber-500 hover:bg-amber-400 rounded-xl shadow-lg shadow-amber-500/20 transition disabled:opacity-50"
                >
                  {isSubmitting ? 'Đang lưu...' : editingRule ? 'Cập Nhật Giá' : 'Lưu Bảng Giá'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
