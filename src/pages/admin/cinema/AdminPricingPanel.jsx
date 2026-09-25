import React, { useState, useEffect, useMemo } from 'react';
import {
  DollarSign,
  Plus,
  RefreshCw,
  Edit3,
  Trash2,
  CheckCircle2,
  Calendar,
  Layers,
  Sparkles,
  Crown,
  Check,
  X,
  Building2,
  Clock,
  ShieldAlert
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

const SEAT_TYPE_CONFIG = {
  STANDARD: {
    label: 'Ghế Thường (STANDARD)',
    badgeBg: 'bg-neutral-800 text-neutral-300 border-neutral-700',
    capacity: '1 người / ghế',
    color: '#697078'
  },
  SINGLE: {
    label: 'Ghế Đơn (SINGLE)',
    badgeBg: 'bg-neutral-800 text-neutral-300 border-neutral-700',
    capacity: '1 người / ghế',
    color: '#697078'
  },
  VIP: {
    label: 'Ghế VIP',
    badgeBg: 'bg-amber-500/10 text-amber-400 border-amber-500/30',
    capacity: '1 người / ghế',
    color: '#f5b800'
  },
  COUPLE: {
    label: 'Ghế Đôi (COUPLE)',
    badgeBg: 'bg-pink-500/10 text-pink-400 border-pink-500/30',
    capacity: '2 người / cặp',
    color: '#ec4899'
  }
};

export default function AdminPricingPanel({ ctx }) {
  const { getAdminToken, showToast, publicCinema } = ctx;
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
    seatType: 'STANDARD',
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
      const [rulesData, cinemaData] = await Promise.all([
        adminService.getAdminPricingRules(token, { size: 100 }),
        adminService.getAdminCinema(token).catch(() => null)
      ]);

      const list = Array.isArray(rulesData) ? rulesData : (rulesData?.items || rulesData?.content || []);
      setRules(list);

      const loadedCinemas = [];
      if (cinemaData && cinemaData.id) {
        loadedCinemas.push(cinemaData);
      } else if (publicCinema && publicCinema.id) {
        loadedCinemas.push(publicCinema);
      } else {
        loadedCinemas.push({ id: 1, name: 'CineAI Cinema' });
      }
      setCinemas(loadedCinemas);
    } catch (err) {
      showToast(err?.message || 'Không thể tải danh sách bảng giá vé.');
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
      if (seatTypeFilter !== 'ALL') {
        if (seatTypeFilter === 'STANDARD' && r.seatType !== 'STANDARD' && r.seatType !== 'SINGLE') return false;
        if (seatTypeFilter === 'VIP' && r.seatType !== 'VIP') return false;
        if (seatTypeFilter === 'COUPLE' && r.seatType !== 'COUPLE') return false;
      }
      if (cinemaFilter !== 'ALL' && String(r.cinemaId) !== cinemaFilter) return false;
      return true;
    });
  }, [rules, seatTypeFilter, cinemaFilter]);

  const stats = useMemo(() => {
    const standardRule = rules.find((r) => (r.seatType === 'STANDARD' || r.seatType === 'SINGLE') && r.active);
    const vipRule = rules.find((r) => r.seatType === 'VIP' && r.active);
    const coupleRule = rules.find((r) => r.seatType === 'COUPLE' && r.active);
    return {
      total: rules.length,
      activeCount: rules.filter((r) => r.active).length,
      standardPrice: standardRule ? standardRule.price : 90000,
      vipPrice: vipRule ? vipRule.price : 110000,
      couplePrice: coupleRule ? coupleRule.price : 160000
    };
  }, [rules]);

  const handleOpenCreate = () => {
    setEditingRule(null);
    setFormData({
      cinemaId: cinemas.length > 0 ? String(cinemas[0].id) : '',
      seatType: 'STANDARD',
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
      cinemaId: rule.cinemaId ? String(rule.cinemaId) : (cinemas.length > 0 ? String(cinemas[0].id) : ''),
      seatType: rule.seatType || 'STANDARD',
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

    if (formData.price === '' || Number(formData.price) < 0) {
      showToast('Vui lòng nhập giá vé hợp lệ (>= 0đ)');
      return;
    }

    setIsSubmitting(true);
    try {
      const payload = {
        cinemaId: formData.cinemaId ? Number(formData.cinemaId) : null,
        seatType: formData.seatType,
        weekend: false,
        holiday: false,
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
    <div className="space-y-6 text-white select-none">
      {/* Header & Stats */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-white/10 pb-5">
        <div>
          <h1 className="text-2xl font-black text-white flex items-center gap-2.5 uppercase tracking-wide">
            <DollarSign className="w-6 h-6 text-amber-400 shrink-0" />
            <span>Quản Lý Bảng Giá Vé</span>
          </h1>
          <p className="text-xs text-neutral-400 mt-1">
            Cấu hình giá vé Ghế Thường (STANDARD), Ghế VIP và Ghế Đôi (COUPLE). Đây là nguồn chuẩn giá duy nhất (Source of Truth) cho Booking.
          </p>
        </div>
        <div className="flex items-center gap-2.5">
          <button
            onClick={loadData}
            disabled={isLoading}
            className="flex items-center gap-2 px-3.5 py-2 text-xs font-bold text-neutral-300 bg-[#161b22] hover:bg-[#21262d] border border-white/15 rounded-none transition uppercase tracking-wider disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            Làm mới
          </button>
          <button
            onClick={handleOpenCreate}
            className="flex items-center gap-2 px-4 py-2 text-xs font-black text-black bg-amber-400 hover:bg-amber-300 border border-amber-400 rounded-none transition uppercase tracking-wider shadow-lg shadow-amber-500/10"
          >
            <Plus className="w-4 h-4" />
            Thêm Bảng Giá
          </button>
        </div>
      </div>

      {/* Metric Cards - Strictly Square Corners (rounded-none) */}
      <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 lg:grid-cols-4">
        <div className="p-4 rounded-none bg-[#12161c] border border-white/10">
          <div className="flex items-center justify-between text-neutral-400 mb-2">
            <span className="text-[11px] font-bold uppercase tracking-wider">Ghế Thường</span>
            <span className="p-1.5 rounded-none bg-neutral-800 text-neutral-300 border border-white/10">
              <Layers className="w-4 h-4" />
            </span>
          </div>
          <div className="text-2xl font-black text-white">{formatVnd(stats.standardPrice)}</div>
          <span className="text-[11px] text-neutral-400 mt-0.5 block">Áp dụng cho ghế Standard</span>
        </div>

        <div className="p-4 rounded-none bg-[#12161c] border border-white/10">
          <div className="flex items-center justify-between text-neutral-400 mb-2">
            <span className="text-[11px] font-bold uppercase tracking-wider">Ghế VIP</span>
            <span className="p-1.5 rounded-none bg-amber-500/10 text-amber-400 border border-amber-500/20">
              <Crown className="w-4 h-4" />
            </span>
          </div>
          <div className="text-2xl font-black text-amber-400">{formatVnd(stats.vipPrice)}</div>
          <span className="text-[11px] text-neutral-400 mt-0.5 block">Khu vực trung tâm phòng</span>
        </div>

        <div className="p-4 rounded-none bg-[#12161c] border border-white/10">
          <div className="flex items-center justify-between text-neutral-400 mb-2">
            <span className="text-[11px] font-bold uppercase tracking-wider">Ghế Đôi (COUPLE)</span>
            <span className="p-1.5 rounded-none bg-pink-500/10 text-pink-400 border border-pink-500/20">
              <Sparkles className="w-4 h-4" />
            </span>
          </div>
          <div className="text-2xl font-black text-pink-400">{formatVnd(stats.couplePrice)}</div>
          <span className="text-[11px] text-neutral-400 mt-0.5 block">Bán nguyên cặp (2 người)</span>
        </div>

        <div className="p-4 rounded-none bg-[#12161c] border border-white/10">
          <div className="flex items-center justify-between text-neutral-400 mb-2">
            <span className="text-[11px] font-bold uppercase tracking-wider">Trạng Thái Áp Dụng</span>
            <span className="p-1.5 rounded-none bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <CheckCircle2 className="w-4 h-4" />
            </span>
          </div>
          <div className="text-2xl font-black text-emerald-400">{stats.activeCount} / {stats.total}</div>
          <span className="text-[11px] text-neutral-400 mt-0.5 block">Quy tắc đang có hiệu lực</span>
        </div>
      </div>

      {/* Filters - Strictly Square Corners (rounded-none) */}
      <div className="flex flex-wrap items-center gap-3 p-3 bg-[#12161c] border border-white/10 rounded-none">
        <span className="text-[11px] font-black text-neutral-400 uppercase tracking-wider">Lọc theo:</span>
        <div className="flex items-center gap-1.5">
          {[
            { id: 'ALL', label: 'Tất cả loại ghế' },
            { id: 'STANDARD', label: 'Ghế Thường' },
            { id: 'VIP', label: 'Ghế VIP' },
            { id: 'COUPLE', label: 'Ghế Đôi' }
          ].map((item) => (
            <button
              key={item.id}
              onClick={() => setSeatTypeFilter(item.id)}
              className={`px-3 py-1.5 text-xs font-bold rounded-none transition uppercase tracking-wider border ${
                seatTypeFilter === item.id
                  ? 'bg-amber-400 text-black border-amber-400'
                  : 'bg-black/60 text-neutral-300 border-white/10 hover:border-white/20'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>

        {cinemas.length > 1 && (
          <select
            value={cinemaFilter}
            onChange={(e) => setCinemaFilter(e.target.value)}
            className="ml-auto px-3 py-1.5 text-xs bg-black/80 text-neutral-300 border border-white/15 rounded-none focus:outline-none focus:border-amber-400 uppercase font-semibold"
          >
            <option value="ALL">TẤT CẢ CÁC RẠP</option>
            {cinemas.map((c) => (
              <option key={c.id} value={String(c.id)}>{c.name?.toUpperCase()}</option>
            ))}
          </select>
        )}
      </div>

      {/* Pricing Table - Strictly Square Corners (rounded-none) */}
      <div className="border border-white/10 bg-[#12161c] rounded-none overflow-hidden shadow-2xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-neutral-300">
            <thead className="border-b border-white/10 bg-black/60 text-[10.5px] font-black uppercase tracking-wider text-neutral-400">
              <tr>
                <th className="px-5 py-3.5">Rạp Áp Dụng</th>
                <th className="px-5 py-3.5">Loại Ghế</th>
                <th className="px-5 py-3.5">Giá Vé Chuẩn</th>
                <th className="px-5 py-3.5">Sức Chứa</th>
                <th className="px-5 py-3.5">Hiệu Lực</th>
                <th className="px-5 py-3.5">Trạng Thái</th>
                <th className="px-5 py-3.5 text-right">Thao Tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {isLoading ? (
                <tr>
                  <td colSpan={7} className="px-5 py-12 text-center text-neutral-400 font-medium">
                    <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-amber-400" />
                    Đang tải dữ liệu bảng giá vé...
                  </td>
                </tr>
              ) : filteredRules.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-5 py-12 text-center text-neutral-400">
                    <DollarSign className="w-8 h-8 mx-auto mb-2 text-neutral-600 opacity-60" />
                    <p className="text-sm font-semibold text-neutral-300">Chưa có cấu hình giá vé phù hợp</p>
                    <p className="text-xs text-neutral-500 mt-1">Bấm nút "Thêm Bảng Giá" để thiết lập giá vé cho hệ thống.</p>
                  </td>
                </tr>
              ) : (
                filteredRules.map((rule) => {
                  const isCouple = rule.seatType === 'COUPLE';
                  const isVip = rule.seatType === 'VIP';
                  const typeMeta = SEAT_TYPE_CONFIG[rule.seatType] || SEAT_TYPE_CONFIG.STANDARD;

                  return (
                    <tr key={rule.id} className="hover:bg-white/[0.02] transition">
                      <td className="px-5 py-4 font-semibold text-white">
                        <div className="flex items-center gap-2">
                          <Building2 className="w-4 h-4 text-neutral-400 shrink-0" />
                          <span>{rule.cinemaName || 'Tất cả rạp / Mặc định'}</span>
                        </div>
                      </td>
                      <td className="px-5 py-4">
                        <span
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-bold uppercase rounded-none border ${typeMeta.badgeBg}`}
                        >
                          {typeMeta.label}
                        </span>
                      </td>
                      <td className="px-5 py-4 font-black text-amber-400 text-sm">
                        {formatVnd(rule.price)}
                      </td>
                      <td className="px-5 py-4 text-neutral-400 font-medium">
                        {isCouple ? '2 người / cặp' : '1 người / ghế'}
                      </td>
                      <td className="px-5 py-4 text-xs text-neutral-400">
                        {rule.effectiveFrom || rule.effectiveTo ? (
                          <div className="space-y-0.5">
                            <div>Từ: <span className="text-neutral-200">{formatDate(rule.effectiveFrom)}</span></div>
                            <div>Đến: <span className="text-neutral-200">{formatDate(rule.effectiveTo)}</span></div>
                          </div>
                        ) : (
                          <span className="text-neutral-500">Vô thời hạn</span>
                        )}
                      </td>
                      <td className="px-5 py-4">
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-0.5 text-[10.5px] font-black uppercase rounded-none border ${
                            rule.active
                              ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                              : 'bg-rose-500/10 text-rose-400 border-rose-500/30'
                          }`}
                        >
                          {rule.active ? <Check className="w-3 h-3" /> : <X className="w-3 h-3" />}
                          {rule.active ? 'Đang áp dụng' : 'Tạm ngưng'}
                        </span>
                      </td>
                      <td className="px-5 py-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => handleOpenEdit(rule)}
                            className="p-1.5 text-neutral-400 hover:text-white hover:bg-neutral-800 border border-transparent hover:border-white/10 rounded-none transition"
                            title="Sửa giá vé"
                          >
                            <Edit3 className="w-4 h-4" />
                          </button>
                          {deleteConfirmId === rule.id ? (
                            <div className="flex items-center gap-1.5">
                              <button
                                onClick={() => handleDelete(rule.id)}
                                className="px-2.5 py-1 text-xs font-black text-rose-300 bg-rose-950/80 hover:bg-rose-900 border border-rose-700 rounded-none transition uppercase"
                              >
                                Xóa
                              </button>
                              <button
                                onClick={() => setDeleteConfirmId(null)}
                                className="px-2 py-1 text-xs text-neutral-400 hover:text-white rounded-none"
                              >
                                Hủy
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={() => setDeleteConfirmId(rule.id)}
                              className="p-1.5 text-neutral-400 hover:text-rose-400 hover:bg-rose-950/30 border border-transparent hover:border-rose-900/40 rounded-none transition"
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

      {/* Create / Edit Modal - Strictly Square Corners (rounded-none) */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="relative w-full max-w-lg rounded-none bg-[#12161c] border border-white/20 p-6 shadow-2xl">
            <button
              onClick={() => setIsModalOpen(false)}
              className="absolute top-4 right-4 text-neutral-400 hover:text-white p-1 hover:bg-white/10 rounded-none transition"
            >
              <X className="w-5 h-5" />
            </button>

            <h2 className="text-lg font-black text-white mb-1 flex items-center gap-2 uppercase tracking-wide">
              <DollarSign className="w-5 h-5 text-amber-400" />
              <span>{editingRule ? 'Chỉnh Sửa Giá Vé' : 'Thêm Quy Tắc Giá Vé'}</span>
            </h2>
            <p className="text-xs text-neutral-400 mb-5">
              Giá vé cấu hình tại đây sẽ được snapshot trực tiếp vào Booking và không ảnh hưởng đến các giao dịch trong quá khứ.
            </p>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-[11px] font-bold text-neutral-300 uppercase tracking-wider mb-1.5">
                  Rạp áp dụng
                </label>
                <select
                  value={formData.cinemaId}
                  onChange={(e) => setFormData({ ...formData, cinemaId: e.target.value })}
                  className="w-full px-3 py-2 bg-black/80 border border-white/15 rounded-none text-xs text-white focus:border-amber-400 focus:outline-none"
                >
                  <option value="">Tất cả rạp / Chung</option>
                  {cinemas.map((c) => (
                    <option key={c.id} value={String(c.id)}>{c.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-neutral-300 uppercase tracking-wider mb-1.5">
                  Loại ghế <span className="text-amber-400">*</span>
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { id: 'STANDARD', label: 'Ghế Thường', desc: '1 người' },
                    { id: 'VIP', label: 'Ghế VIP', desc: '1 người' },
                    { id: 'COUPLE', label: 'Ghế Đôi', desc: '2 người' }
                  ].map((st) => (
                    <button
                      key={st.id}
                      type="button"
                      onClick={() => setFormData({
                        ...formData,
                        seatType: st.id,
                        price: formData.price || (st.id === 'COUPLE' ? 160000 : st.id === 'VIP' ? 110000 : 90000)
                      })}
                      className={`p-2.5 rounded-none border text-left transition ${
                        formData.seatType === st.id
                          ? 'border-amber-400 bg-amber-400/10 text-amber-300 font-bold'
                          : 'border-white/10 bg-black/60 text-neutral-400 hover:border-white/20'
                      }`}
                    >
                      <div className="text-xs font-bold uppercase">{st.label}</div>
                      <div className="text-[10px] opacity-70 mt-0.5">{st.desc}</div>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-neutral-300 uppercase tracking-wider mb-1.5">
                  Giá vé (VND) <span className="text-amber-400">*</span>
                </label>
                <div className="relative">
                  <input
                    type="number"
                    step="1000"
                    min="0"
                    value={formData.price}
                    onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                    className="w-full px-3 py-2.5 bg-black/80 border border-white/15 rounded-none text-sm font-black text-amber-400 focus:border-amber-400 focus:outline-none"
                    placeholder="90000"
                    required
                  />
                  <span className="absolute right-3.5 top-2.5 text-xs text-neutral-400 font-bold">
                    {formatVnd(formData.price)}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-neutral-300 uppercase tracking-wider mb-1.5">
                    Hiệu lực từ ngày
                  </label>
                  <input
                    type="date"
                    value={formData.effectiveFrom}
                    onChange={(e) => setFormData({ ...formData, effectiveFrom: e.target.value })}
                    className="w-full px-3 py-2 bg-black/80 border border-white/15 rounded-none text-xs text-white focus:border-amber-400 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-neutral-300 uppercase tracking-wider mb-1.5">
                    Đến ngày
                  </label>
                  <input
                    type="date"
                    value={formData.effectiveTo}
                    onChange={(e) => setFormData({ ...formData, effectiveTo: e.target.value })}
                    className="w-full px-3 py-2 bg-black/80 border border-white/15 rounded-none text-xs text-white focus:border-amber-400 focus:outline-none"
                  />
                </div>
              </div>

              <div className="flex items-center gap-2.5 pt-2">
                <input
                  type="checkbox"
                  id="activeRuleCheck"
                  checked={formData.active}
                  onChange={(e) => setFormData({ ...formData, active: e.target.checked })}
                  className="w-4 h-4 rounded-none text-amber-400 bg-black/80 border-white/20 focus:ring-0 cursor-pointer"
                />
                <label htmlFor="activeRuleCheck" className="text-xs text-neutral-300 cursor-pointer select-none">
                  Kích hoạt bảng giá này ngay lập tức cho booking
                </label>
              </div>

              <div className="flex items-center justify-end gap-3 pt-5 border-t border-white/10">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-xs font-bold text-neutral-400 hover:text-white uppercase transition rounded-none"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2 text-xs font-black text-black bg-amber-400 hover:bg-amber-300 border border-amber-400 uppercase tracking-wider transition rounded-none disabled:opacity-50"
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
