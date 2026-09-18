import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Tag,
  Plus,
  Search,
  Filter,
  RefreshCw,
  Edit3,
  Trash2,
  CheckCircle2,
  XCircle,
  Clock,
  Calendar,
  DollarSign,
  Users,
  Copy,
  Check,
  AlertTriangle,
  ChevronRight,
  TrendingUp,
  Percent,
  Sparkles,
  Layers,
  ShoppingBag,
  Ticket,
  X
} from 'lucide-react';
import { adminService } from '../../../services/adminService';

const formatVnd = (value) => {
  if (value === null || value === undefined || value === '') return '0đ';
  return `${Number(value).toLocaleString('vi-VN')}đ`;
};

const formatDateTime = (isoString) => {
  if (!isoString) return 'Vô thời hạn';
  try {
    const d = new Date(isoString);
    if (isNaN(d.getTime())) return isoString;
    return d.toLocaleString('vi-VN', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  } catch {
    return isoString;
  }
};

const toInputDateTime = (isoString) => {
  if (!isoString) return '';
  try {
    const d = new Date(isoString);
    if (isNaN(d.getTime())) return '';
    const pad = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  } catch {
    return '';
  }
};

const TARGET_META = {
  ALL: { label: 'Toàn bộ', icon: Layers, color: 'text-amber-400 bg-amber-500/10 border-amber-500/30' },
  TICKET_ONLY: { label: 'Chỉ vé phim', icon: Ticket, color: 'text-cyan-400 bg-cyan-500/10 border-cyan-500/30' },
  FOOD_ONLY: { label: 'Chỉ F&B / Bắp nước', icon: ShoppingBag, color: 'text-orange-400 bg-orange-500/10 border-orange-500/30' }
};

const STATUS_META = {
  ACTIVE: { label: 'Đang áp dụng', color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30' },
  INACTIVE: { label: 'Tạm ngừng', color: 'text-neutral-400 bg-neutral-800 border-neutral-700' },
  EXPIRED: { label: 'Hết hạn', color: 'text-rose-400 bg-rose-500/10 border-rose-500/30' }
};

const INITIAL_FORM = {
  code: '',
  name: '',
  description: '',
  discountType: 'PERCENTAGE',
  discountValue: '',
  minOrderValue: 0,
  maxDiscountAmount: '',
  usageLimit: 100,
  userUsageLimit: 1,
  applicableTarget: 'ALL',
  startDate: '',
  endDate: '',
  status: 'ACTIVE'
};

export default function AdminPromotionsPanel({ ctx }) {
  const { getAdminToken, showToast } = ctx || {};
  const token = getAdminToken ? getAdminToken() : null;

  // Data states
  const [promotions, setPromotions] = useState([]);
  const [stats, setStats] = useState({
    totalPromotions: 0,
    activePromotions: 0,
    totalUsages: 0,
    totalDiscountGiven: 0
  });
  const [isLoading, setIsLoading] = useState(false);
  const [isStatsLoading, setIsStatsLoading] = useState(false);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [targetFilter, setTargetFilter] = useState('ALL');
  const [typeFilter, setTypeFilter] = useState('ALL');

  // Modal states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingPromotion, setEditingPromotion] = useState(null);
  const [formData, setFormData] = useState(INITIAL_FORM);
  const [formErrors, setFormErrors] = useState({});
  const [isSaving, setIsSaving] = useState(false);

  // Copied code feedback
  const [copiedCode, setCopiedCode] = useState(null);

  // Fetch Promotions
  const fetchPromotions = useCallback(async () => {
    if (!token) return;
    setIsLoading(true);
    try {
      const data = await adminService.getAdminPromotions(token);
      setPromotions(Array.isArray(data) ? data : []);
    } catch (err) {
      if (showToast) showToast(err.message || 'Không thể tải danh sách khuyến mãi.');
    } finally {
      setIsLoading(false);
    }
  }, [token, showToast]);

  // Fetch Stats
  const fetchStats = useCallback(async () => {
    if (!token) return;
    setIsStatsLoading(true);
    try {
      const res = await adminService.getAdminPromotionStats(token);
      if (res) {
        setStats(res);
      }
    } catch (err) {
      console.error('Error fetching promotion stats:', err);
    } finally {
      setIsStatsLoading(false);
    }
  }, [token]);

  useEffect(() => {
    fetchPromotions();
    fetchStats();
  }, [fetchPromotions, fetchStats]);

  // Handle Copy Code
  const handleCopy = (code) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    if (showToast) showToast(`Đã sao chép mã: ${code}`);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  // Generate Random Code
  const handleGenerateCode = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let code = 'PROMO';
    for (let i = 0; i < 5; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setFormData((prev) => ({ ...prev, code }));
  };

  // Open Create Modal
  const handleOpenCreate = () => {
    setEditingPromotion(null);
    const now = new Date();
    const future = new Date();
    future.setDate(future.getDate() + 30);

    setFormData({
      ...INITIAL_FORM,
      startDate: toInputDateTime(now.toISOString()),
      endDate: toInputDateTime(future.toISOString())
    });
    setFormErrors({});
    setIsModalOpen(true);
  };

  // Open Edit Modal
  const handleOpenEdit = (item) => {
    setEditingPromotion(item);
    setFormData({
      code: item.code || '',
      name: item.name || '',
      description: item.description || '',
      discountType: item.discountType || 'PERCENTAGE',
      discountValue: item.discountValue !== null && item.discountValue !== undefined ? String(item.discountValue) : '',
      minOrderValue: item.minOrderValue !== null && item.minOrderValue !== undefined ? String(item.minOrderValue) : '0',
      maxDiscountAmount: item.maxDiscountAmount !== null && item.maxDiscountAmount !== undefined ? String(item.maxDiscountAmount) : '',
      usageLimit: item.usageLimit !== null && item.usageLimit !== undefined ? String(item.usageLimit) : '',
      userUsageLimit: item.userUsageLimit !== null && item.userUsageLimit !== undefined ? String(item.userUsageLimit) : '1',
      applicableTarget: item.applicableTarget || 'ALL',
      startDate: toInputDateTime(item.startDate),
      endDate: toInputDateTime(item.endDate),
      status: item.status || 'ACTIVE'
    });
    setFormErrors({});
    setIsModalOpen(true);
  };

  // Toggle Status
  const handleToggleStatus = async (item) => {
    if (!token) return;
    try {
      const updated = await adminService.toggleAdminPromotionStatus(token, item.id);
      setPromotions((prev) => prev.map((p) => (p.id === item.id ? updated : p)));
      if (showToast) {
        showToast(`Đã chuyển trạng thái [${item.code}] sang: ${updated.status === 'ACTIVE' ? 'Kích hoạt' : 'Tạm dừng'}`);
      }
      fetchStats();
    } catch (err) {
      if (showToast) showToast(err.message || 'Không thể thay đổi trạng thái.');
    }
  };

  // Delete Promotion
  const handleDelete = async (item) => {
    if (!token) return;
    const confirmed = window.confirm(`Bạn có chắc chắn muốn xóa mã ưu đãi [${item.code}]?`);
    if (!confirmed) return;

    try {
      await adminService.deleteAdminPromotion(token, item.id);
      setPromotions((prev) => prev.filter((p) => p.id !== item.id));
      if (showToast) showToast(`Đã xóa thành công mã: ${item.code}`);
      fetchStats();
    } catch (err) {
      if (showToast) showToast(err.message || 'Không thể xóa mã ưu đãi.');
    }
  };

  // Validate Form
  const validateForm = () => {
    const errors = {};
    if (!formData.code.trim()) errors.code = 'Mã ưu đãi không được để trống.';
    else if (!/^[A-Z0-9_-]{3,20}$/i.test(formData.code.trim())) {
      errors.code = 'Mã chỉ gồm 3-20 chữ cái, số, gạch nối hoặc gạch dưới.';
    }

    if (!formData.name.trim()) errors.name = 'Tên chương trình không được để trống.';

    const discountVal = Number(formData.discountValue);
    if (isNaN(discountVal) || discountVal <= 0) {
      errors.discountValue = 'Mức giảm phải là số lớn hơn 0.';
    } else if (formData.discountType === 'PERCENTAGE' && discountVal > 100) {
      errors.discountValue = 'Phần trăm giảm không được vượt quá 100%.';
    }

    if (formData.minOrderValue && Number(formData.minOrderValue) < 0) {
      errors.minOrderValue = 'Giá trị đơn tối thiểu không được âm.';
    }

    if (formData.maxDiscountAmount && Number(formData.maxDiscountAmount) <= 0) {
      errors.maxDiscountAmount = 'Mức trần giảm giá phải lớn hơn 0.';
    }

    if (formData.usageLimit && Number(formData.usageLimit) <= 0) {
      errors.usageLimit = 'Giới hạn số lượt dùng phải lớn hơn 0.';
    }

    if (formData.userUsageLimit && Number(formData.userUsageLimit) <= 0) {
      errors.userUsageLimit = 'Số lượt / khách phải lớn hơn 0.';
    }

    if (formData.startDate && formData.endDate) {
      const start = new Date(formData.startDate);
      const end = new Date(formData.endDate);
      if (end <= start) {
        errors.endDate = 'Thời gian kết thúc phải sau thời gian bắt đầu.';
      }
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // Submit Form
  const handleSubmitForm = async (e) => {
    e.preventDefault();
    if (!validateForm()) return;
    if (!token) return;

    setIsSaving(true);
    try {
      const payload = {
        code: formData.code.trim().toUpperCase(),
        name: formData.name.trim(),
        description: formData.description.trim(),
        discountType: formData.discountType,
        discountValue: Number(formData.discountValue),
        minOrderValue: formData.minOrderValue ? Number(formData.minOrderValue) : 0,
        maxDiscountAmount: formData.maxDiscountAmount ? Number(formData.maxDiscountAmount) : null,
        usageLimit: formData.usageLimit ? Number(formData.usageLimit) : null,
        userUsageLimit: formData.userUsageLimit ? Number(formData.userUsageLimit) : 1,
        applicableTarget: formData.applicableTarget,
        startDate: formData.startDate ? new Date(formData.startDate).toISOString() : null,
        endDate: formData.endDate ? new Date(formData.endDate).toISOString() : null,
        status: formData.status
      };

      if (editingPromotion) {
        const updated = await adminService.updateAdminPromotion(token, editingPromotion.id, payload);
        setPromotions((prev) => prev.map((p) => (p.id === editingPromotion.id ? updated : p)));
        if (showToast) showToast(`Đã cập nhật mã ưu đãi: ${updated.code}`);
      } else {
        const created = await adminService.createAdminPromotion(token, payload);
        setPromotions((prev) => [created, ...prev]);
        if (showToast) showToast(`Đã tạo mới mã ưu đãi: ${created.code}`);
      }

      setIsModalOpen(false);
      fetchStats();
    } catch (err) {
      if (showToast) showToast(err.message || 'Không thể lưu thông tin khuyến mãi.');
    } finally {
      setIsSaving(false);
    }
  };

  // Filtered List
  const filteredPromotions = useMemo(() => {
    return promotions.filter((item) => {
      const matchesSearch =
        !searchQuery ||
        item.code?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.description?.toLowerCase().includes(searchQuery.toLowerCase());

      const matchesStatus = statusFilter === 'ALL' || item.status === statusFilter;
      const matchesTarget = targetFilter === 'ALL' || item.applicableTarget === targetFilter;
      const matchesType = typeFilter === 'ALL' || item.discountType === typeFilter;

      return matchesSearch && matchesStatus && matchesTarget && matchesType;
    });
  }, [promotions, searchQuery, statusFilter, targetFilter, typeFilter]);

  // Close modal on Escape key
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isModalOpen) {
        setIsModalOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isModalOpen]);

  return (
    <div className="flex-1 overflow-y-auto bg-[#080808] p-6 text-neutral-200">
      <div className="max-w-[1400px] mx-auto space-y-6">

        {/* TOP HEADER */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-white/[0.08] pb-6">
          <div>
            <div className="flex items-center gap-2.5">
              <div className="h-9 w-9 rounded-lg bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
                <Tag className="h-5 w-5" />
              </div>
              <h1 className="text-xl font-bold tracking-wide text-white">Quản lý Mã Khuyến Mãi & Ưu Đãi</h1>
            </div>
            <p className="text-xs text-neutral-400 mt-1 pl-11">
              Thiết lập các mã voucher giảm giá, ưu đãi vé phim & bắp nước, định mức sử dụng và thời hạn hiệu lực.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => {
                fetchPromotions();
                fetchStats();
              }}
              disabled={isLoading || isStatsLoading}
              className="px-3.5 py-2 text-xs font-medium text-neutral-300 hover:text-white bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.1] rounded-lg transition-colors flex items-center gap-2"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? 'animate-spin' : ''}`} />
              Làm mới
            </button>
            <button
              type="button"
              onClick={handleOpenCreate}
              className="px-4 py-2 text-xs font-semibold text-black bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 rounded-lg shadow-lg shadow-amber-500/20 transition-all flex items-center gap-2 active:scale-95"
            >
              <Plus className="h-4 w-4" />
              Tạo mã ưu đãi
            </button>
          </div>
        </div>

        {/* 4 KPI CARDS */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Card 1: Total Programs */}
          <div className="bg-[#111111] border border-white/[0.07] rounded-xl p-4 flex items-center justify-between">
            <div>
              <p className="text-[11px] font-medium text-neutral-400 uppercase tracking-wider">Tổng chương trình</p>
              <p className="text-2xl font-bold text-white mt-1">{stats.totalPromotions || promotions.length}</p>
              <p className="text-[10px] text-neutral-400 mt-0.5">Bao gồm tất cả mã hệ thống</p>
            </div>
            <div className="h-10 w-10 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
              <Tag className="h-5 w-5" />
            </div>
          </div>

          {/* Card 2: Active Programs */}
          <div className="bg-[#111111] border border-white/[0.07] rounded-xl p-4 flex items-center justify-between">
            <div>
              <p className="text-[11px] font-medium text-neutral-400 uppercase tracking-wider">Đang hoạt động</p>
              <p className="text-2xl font-bold text-emerald-400 mt-1">{stats.activePromotions || 0}</p>
              <p className="text-[10px] text-emerald-500/80 mt-0.5">Sẵn sàng cho khách áp dụng</p>
            </div>
            <div className="h-10 w-10 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
              <CheckCircle2 className="h-5 w-5" />
            </div>
          </div>

          {/* Card 3: Total Usages */}
          <div className="bg-[#111111] border border-white/[0.07] rounded-xl p-4 flex items-center justify-between">
            <div>
              <p className="text-[11px] font-medium text-neutral-400 uppercase tracking-wider">Lượt đã sử dụng</p>
              <p className="text-2xl font-bold text-cyan-400 mt-1">{stats.totalUsages || 0}</p>
              <p className="text-[10px] text-cyan-500/80 mt-0.5">Tổng số giao dịch đã hưởng ưu đãi</p>
            </div>
            <div className="h-10 w-10 rounded-lg bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400">
              <Users className="h-5 w-5" />
            </div>
          </div>

          {/* Card 4: Total Discount Given */}
          <div className="bg-[#111111] border border-white/[0.07] rounded-xl p-4 flex items-center justify-between">
            <div>
              <p className="text-[11px] font-medium text-neutral-400 uppercase tracking-wider">Tổng tiền đã giảm</p>
              <p className="text-2xl font-bold text-amber-400 mt-1">{formatVnd(stats.totalDiscountGiven)}</p>
              <p className="text-[10px] text-amber-500/80 mt-0.5">Giá trị kích cầu thành công</p>
            </div>
            <div className="h-10 w-10 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
              <TrendingUp className="h-5 w-5" />
            </div>
          </div>
        </div>

        {/* FILTER BAR */}
        <div className="bg-[#111111] border border-white/[0.07] rounded-xl p-4 flex flex-col md:flex-row gap-3 items-center justify-between">
          <div className="relative w-full md:w-80">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-neutral-500" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Tìm theo mã voucher hoặc tên..."
              className="w-full bg-black/40 border border-white/[0.08] focus:border-amber-500/50 rounded-lg pl-9 pr-8 py-1.5 text-xs text-white placeholder-neutral-500 focus:outline-none transition-colors"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-neutral-500 hover:text-white"
              >
                <X className="h-3 w-3" />
              </button>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2.5 w-full md:w-auto">
            {/* Status Filter */}
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="bg-black/40 border border-white/[0.08] focus:border-amber-500/50 rounded-lg px-3 py-1.5 text-xs text-neutral-300 focus:outline-none"
            >
              <option value="ALL">Tất cả trạng thái</option>
              <option value="ACTIVE">Đang áp dụng</option>
              <option value="INACTIVE">Tạm ngừng</option>
              <option value="EXPIRED">Hết hạn</option>
            </select>

            {/* Target Filter */}
            <select
              value={targetFilter}
              onChange={(e) => setTargetFilter(e.target.value)}
              className="bg-black/40 border border-white/[0.08] focus:border-amber-500/50 rounded-lg px-3 py-1.5 text-xs text-neutral-300 focus:outline-none"
            >
              <option value="ALL">Tất cả đối tượng</option>
              <option value="ALL_TARGET">Toàn bộ giỏ hàng</option>
              <option value="TICKET_ONLY">Chỉ vé xem phim</option>
              <option value="FOOD_ONLY">Chỉ bắp nước F&B</option>
            </select>

            {/* Type Filter */}
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="bg-black/40 border border-white/[0.08] focus:border-amber-500/50 rounded-lg px-3 py-1.5 text-xs text-neutral-300 focus:outline-none"
            >
              <option value="ALL">Tất cả kiểu giảm</option>
              <option value="PERCENTAGE">Phần trăm (%)</option>
              <option value="FIXED_AMOUNT">Tiền cố định (đ)</option>
            </select>
          </div>
        </div>

        {/* DATA TABLE */}
        <div className="bg-[#111111] border border-white/[0.07] rounded-xl overflow-hidden shadow-2xl">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-neutral-300">
              <thead className="bg-[#161616] text-neutral-400 uppercase text-[10px] tracking-wider border-b border-white/[0.06]">
                <tr>
                  <th className="py-3 px-4">Mã Voucher</th>
                  <th className="py-3 px-4">Tên chương trình</th>
                  <th className="py-3 px-4">Mức giảm</th>
                  <th className="py-3 px-4">Áp dụng cho</th>
                  <th className="py-3 px-4">Đơn tối thiểu</th>
                  <th className="py-3 px-4">Lượt đã dùng</th>
                  <th className="py-3 px-4">Thời gian hiệu lực</th>
                  <th className="py-3 px-4 text-center">Trạng thái</th>
                  <th className="py-3 px-4 text-right">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.04]">
                {isLoading ? (
                  <tr>
                    <td colSpan={9} className="py-12 text-center text-neutral-500">
                      <div className="flex flex-col items-center justify-center gap-2">
                        <RefreshCw className="h-5 w-5 animate-spin text-amber-500" />
                        <span>Đang tải danh sách mã khuyến mãi...</span>
                      </div>
                    </td>
                  </tr>
                ) : filteredPromotions.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="py-12 text-center text-neutral-500">
                      <div className="flex flex-col items-center justify-center gap-2">
                        <Tag className="h-8 w-8 text-neutral-600 stroke-[1.5]" />
                        <span className="text-sm font-medium text-neutral-400">Không tìm thấy mã ưu đãi nào</span>
                        <span className="text-xs text-neutral-500">Thử tìm kiếm với từ khóa khác hoặc tạo mới mã ưu đãi</span>
                      </div>
                    </td>
                  </tr>
                ) : (
                  filteredPromotions.map((item) => {
                    const targetMeta = TARGET_META[item.applicableTarget] || TARGET_META.ALL;
                    const statusMeta = STATUS_META[item.status] || STATUS_META.INACTIVE;
                    const TargetIcon = targetMeta.icon;
                    const isPercentage = item.discountType === 'PERCENTAGE';
                    const used = item.usedCount || 0;
                    const limit = item.usageLimit;
                    const percentUsed = limit ? Math.min(100, Math.round((used / limit) * 100)) : null;

                    return (
                      <tr key={item.id} className="hover:bg-white/[0.02] transition-colors group">
                        {/* Column: Code */}
                        <td className="py-3 px-4 font-mono font-bold text-white">
                          <div className="flex items-center gap-2">
                            <span className="px-2.5 py-1 bg-amber-500/[0.08] border border-dashed border-amber-500/40 rounded text-amber-400 tracking-wider">
                              {item.code}
                            </span>
                            <button
                              type="button"
                              onClick={() => handleCopy(item.code)}
                              title="Sao chép mã"
                              className="text-neutral-500 hover:text-amber-400 transition-colors p-1"
                            >
                              {copiedCode === item.code ? (
                                <Check className="h-3.5 w-3.5 text-emerald-400" />
                              ) : (
                                <Copy className="h-3.5 w-3.5" />
                              )}
                            </button>
                          </div>
                        </td>

                        {/* Column: Name & Description */}
                        <td className="py-3 px-4">
                          <div className="max-w-[220px]">
                            <p className="font-semibold text-white truncate">{item.name}</p>
                            {item.description && (
                              <p className="text-[11px] text-neutral-400 truncate mt-0.5">{item.description}</p>
                            )}
                          </div>
                        </td>

                        {/* Column: Discount Value */}
                        <td className="py-3 px-4 font-semibold text-white">
                          {isPercentage ? (
                            <div>
                              <span className="text-emerald-400 font-bold">{item.discountValue}%</span>
                              {item.maxDiscountAmount ? (
                                <span className="text-[10px] text-neutral-400 block">
                                  Tối đa {formatVnd(item.maxDiscountAmount)}
                                </span>
                              ) : (
                                <span className="text-[10px] text-neutral-500 block">Không giới hạn trần</span>
                              )}
                            </div>
                          ) : (
                            <span className="text-emerald-400 font-bold">{formatVnd(item.discountValue)}</span>
                          )}
                        </td>

                        {/* Column: Applicable Target */}
                        <td className="py-3 px-4">
                          <span
                            className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-medium border ${targetMeta.color}`}
                          >
                            <TargetIcon className="h-3 w-3" />
                            {targetMeta.label}
                          </span>
                        </td>

                        {/* Column: Min Order Value */}
                        <td className="py-3 px-4">
                          {item.minOrderValue > 0 ? (
                            <span>{formatVnd(item.minOrderValue)}</span>
                          ) : (
                            <span className="text-neutral-500">Mọi đơn hàng</span>
                          )}
                        </td>

                        {/* Column: Usage progress */}
                        <td className="py-3 px-4">
                          <div>
                            <div className="flex items-center justify-between text-[11px] mb-1">
                              <span className="font-medium text-white">{used}</span>
                              <span className="text-neutral-500">/ {limit ? limit : '∞'}</span>
                            </div>
                            {limit && (
                              <div className="w-20 h-1.5 bg-neutral-800 rounded-full overflow-hidden">
                                <div
                                  className={`h-full ${percentUsed > 85 ? 'bg-rose-500' : 'bg-amber-500'}`}
                                  style={{ width: `${percentUsed}%` }}
                                />
                              </div>
                            )}
                          </div>
                        </td>

                        {/* Column: Date Range */}
                        <td className="py-3 px-4 text-[11px] text-neutral-400">
                          <div>
                            <p className="text-neutral-300">{formatDateTime(item.startDate)}</p>
                            <p className="text-neutral-500 flex items-center gap-1 mt-0.5">
                              <span>đến</span>
                              <span className={item.endDate && new Date(item.endDate) < new Date() ? 'text-rose-400' : ''}>
                                {formatDateTime(item.endDate)}
                              </span>
                            </p>
                          </div>
                        </td>

                        {/* Column: Status Button Toggle */}
                        <td className="py-3 px-4 text-center">
                          <button
                            type="button"
                            onClick={() => handleToggleStatus(item)}
                            title="Bấm để bật / tắt trạng thái"
                            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10.5px] font-medium border transition-all active:scale-95 ${statusMeta.color}`}
                          >
                            <span
                              className={`h-1.5 w-1.5 rounded-full ${
                                item.status === 'ACTIVE'
                                  ? 'bg-emerald-400 animate-pulse'
                                  : item.status === 'EXPIRED'
                                  ? 'bg-rose-400'
                                  : 'bg-neutral-400'
                              }`}
                            />
                            {statusMeta.label}
                          </button>
                        </td>

                        {/* Column: Actions */}
                        <td className="py-3 px-4 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              type="button"
                              onClick={() => handleOpenEdit(item)}
                              title="Chỉnh sửa mã ưu đãi"
                              className="p-1.5 text-neutral-400 hover:text-white bg-white/[0.03] hover:bg-white/[0.08] border border-white/[0.05] rounded-md transition-colors"
                            >
                              <Edit3 className="h-3.5 w-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDelete(item)}
                              title="Xóa mã ưu đãi"
                              className="p-1.5 text-neutral-400 hover:text-rose-400 bg-white/[0.03] hover:bg-rose-500/10 border border-white/[0.05] hover:border-rose-500/20 rounded-md transition-colors"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
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

        {/* CREATE / EDIT MODAL */}
        <AnimatePresence>
          {isModalOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 10 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 10 }}
                className="w-full max-w-2xl bg-[#141414] border border-white/[0.12] rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
              >
                {/* Modal Header */}
                <div className="px-6 py-4 border-b border-white/[0.08] flex items-center justify-between bg-[#191919]">
                  <div className="flex items-center gap-2.5">
                    <div className="h-8 w-8 rounded-lg bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
                      <Tag className="h-4 w-4" />
                    </div>
                    <div>
                      <h2 className="text-base font-bold text-white">
                        {editingPromotion ? 'Chỉnh sửa mã ưu đãi' : 'Tạo mới mã khuyến mãi'}
                      </h2>
                      <p className="text-[11px] text-neutral-400">
                        {editingPromotion ? `Mã: ${editingPromotion.code}` : 'Điền đầy đủ thông tin để phát hành voucher'}
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="h-8 w-8 rounded-lg flex items-center justify-center text-neutral-400 hover:text-white hover:bg-white/[0.08] transition-colors"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>

                {/* Modal Body */}
                <form onSubmit={handleSubmitForm} className="flex-1 overflow-y-auto p-6 space-y-4">
                  {/* Code & Random button */}
                  <div>
                    <label className="block text-xs font-semibold text-neutral-300 mb-1.5">
                      Mã Voucher <span className="text-rose-400">*</span>
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={formData.code}
                        onChange={(e) =>
                          setFormData((prev) => ({ ...prev, code: e.target.value.toUpperCase().replace(/\s+/g, '') }))
                        }
                        placeholder="VD: CINE20, POPFREE, VIP50K..."
                        className={`flex-1 bg-black/50 border font-mono font-bold tracking-wider ${
                          formErrors.code ? 'border-rose-500' : 'border-white/[0.1] focus:border-amber-500'
                        } rounded-lg px-3.5 py-2 text-sm text-amber-400 uppercase placeholder-neutral-600 focus:outline-none`}
                      />
                      <button
                        type="button"
                        onClick={handleGenerateCode}
                        className="px-3.5 py-2 text-xs font-medium text-neutral-300 hover:text-white bg-white/[0.05] hover:bg-white/[0.1] border border-white/[0.1] rounded-lg transition-colors flex items-center gap-1.5 shrink-0"
                      >
                        <Sparkles className="h-3.5 w-3.5 text-amber-400" />
                        Tạo ngẫu nhiên
                      </button>
                    </div>
                    {formErrors.code && <p className="text-[11px] text-rose-400 mt-1">{formErrors.code}</p>}
                  </div>

                  {/* Name */}
                  <div>
                    <label className="block text-xs font-semibold text-neutral-300 mb-1.5">
                      Tên chương trình ưu đãi <span className="text-rose-400">*</span>
                    </label>
                    <input
                      type="text"
                      value={formData.name}
                      onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
                      placeholder="VD: Ưu Đãi Mùa Hè - Giảm 20% Toàn Rạp"
                      className={`w-full bg-black/50 border ${
                        formErrors.name ? 'border-rose-500' : 'border-white/[0.1] focus:border-amber-500'
                      } rounded-lg px-3.5 py-2 text-sm text-white placeholder-neutral-600 focus:outline-none`}
                    />
                    {formErrors.name && <p className="text-[11px] text-rose-400 mt-1">{formErrors.name}</p>}
                  </div>

                  {/* Description */}
                  <div>
                    <label className="block text-xs font-semibold text-neutral-300 mb-1.5">Mô tả ngắn</label>
                    <textarea
                      rows={2}
                      value={formData.description}
                      onChange={(e) => setFormData((prev) => ({ ...prev, description: e.target.value }))}
                      placeholder="Mô tả quyền lợi chi tiết cho khách hàng xem trước khi áp dụng..."
                      className="w-full bg-black/50 border border-white/[0.1] focus:border-amber-500 rounded-lg px-3.5 py-2 text-xs text-white placeholder-neutral-600 focus:outline-none resize-none"
                    />
                  </div>

                  {/* Discount Type Selector */}
                  <div>
                    <label className="block text-xs font-semibold text-neutral-300 mb-1.5">
                      Loại giảm giá <span className="text-rose-400">*</span>
                    </label>
                    <div className="grid grid-cols-2 gap-3">
                      <button
                        type="button"
                        onClick={() => setFormData((prev) => ({ ...prev, discountType: 'PERCENTAGE' }))}
                        className={`p-3 rounded-xl border text-left flex items-center gap-3 transition-all ${
                          formData.discountType === 'PERCENTAGE'
                            ? 'bg-amber-500/10 border-amber-500/50 text-white'
                            : 'bg-black/30 border-white/[0.08] text-neutral-400 hover:border-white/[0.2]'
                        }`}
                      >
                        <div
                          className={`h-8 w-8 rounded-lg flex items-center justify-center ${
                            formData.discountType === 'PERCENTAGE'
                              ? 'bg-amber-500 text-black'
                              : 'bg-white/[0.05] text-neutral-400'
                          }`}
                        >
                          <Percent className="h-4 w-4" />
                        </div>
                        <div>
                          <p className="text-xs font-semibold">Theo Phần Trăm (%)</p>
                          <p className="text-[10px] text-neutral-400">Giảm theo tỷ lệ đơn hàng</p>
                        </div>
                      </button>

                      <button
                        type="button"
                        onClick={() => setFormData((prev) => ({ ...prev, discountType: 'FIXED_AMOUNT' }))}
                        className={`p-3 rounded-xl border text-left flex items-center gap-3 transition-all ${
                          formData.discountType === 'FIXED_AMOUNT'
                            ? 'bg-amber-500/10 border-amber-500/50 text-white'
                            : 'bg-black/30 border-white/[0.08] text-neutral-400 hover:border-white/[0.2]'
                        }`}
                      >
                        <div
                          className={`h-8 w-8 rounded-lg flex items-center justify-center ${
                            formData.discountType === 'FIXED_AMOUNT'
                              ? 'bg-amber-500 text-black'
                              : 'bg-white/[0.05] text-neutral-400'
                          }`}
                        >
                          <DollarSign className="h-4 w-4" />
                        </div>
                        <div>
                          <p className="text-xs font-semibold">Số tiền cố định (VNĐ)</p>
                          <p className="text-[10px] text-neutral-400">Trừ trực tiếp số tiền</p>
                        </div>
                      </button>
                    </div>
                  </div>

                  {/* Value & Max Discount */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-neutral-300 mb-1.5">
                        Mức giảm {formData.discountType === 'PERCENTAGE' ? '(%)' : '(VNĐ)'}{' '}
                        <span className="text-rose-400">*</span>
                      </label>
                      <input
                        type="number"
                        value={formData.discountValue}
                        onChange={(e) => setFormData((prev) => ({ ...prev, discountValue: e.target.value }))}
                        placeholder={formData.discountType === 'PERCENTAGE' ? 'VD: 20' : 'VD: 50000'}
                        className={`w-full bg-black/50 border ${
                          formErrors.discountValue ? 'border-rose-500' : 'border-white/[0.1] focus:border-amber-500'
                        } rounded-lg px-3.5 py-2 text-sm text-white placeholder-neutral-600 focus:outline-none`}
                      />
                      {formErrors.discountValue && (
                        <p className="text-[11px] text-rose-400 mt-1">{formErrors.discountValue}</p>
                      )}
                    </div>

                    {formData.discountType === 'PERCENTAGE' && (
                      <div>
                        <label className="block text-xs font-semibold text-neutral-300 mb-1.5">
                          Mức giảm tối đa (Trần VNĐ)
                        </label>
                        <input
                          type="number"
                          value={formData.maxDiscountAmount}
                          onChange={(e) => setFormData((prev) => ({ ...prev, maxDiscountAmount: e.target.value }))}
                          placeholder="VD: 50000 (Để trống nếu không giới hạn)"
                          className="w-full bg-black/50 border border-white/[0.1] focus:border-amber-500 rounded-lg px-3.5 py-2 text-sm text-white placeholder-neutral-600 focus:outline-none"
                        />
                      </div>
                    )}
                  </div>

                  {/* Min Order & Target */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-neutral-300 mb-1.5">
                        Đơn hàng tối thiểu (VNĐ)
                      </label>
                      <input
                        type="number"
                        value={formData.minOrderValue}
                        onChange={(e) => setFormData((prev) => ({ ...prev, minOrderValue: e.target.value }))}
                        placeholder="0 nếu áp dụng mọi đơn"
                        className="w-full bg-black/50 border border-white/[0.1] focus:border-amber-500 rounded-lg px-3.5 py-2 text-sm text-white placeholder-neutral-600 focus:outline-none"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-neutral-300 mb-1.5">
                        Phạm vi áp dụng <span className="text-rose-400">*</span>
                      </label>
                      <select
                        value={formData.applicableTarget}
                        onChange={(e) => setFormData((prev) => ({ ...prev, applicableTarget: e.target.value }))}
                        className="w-full bg-black/50 border border-white/[0.1] focus:border-amber-500 rounded-lg px-3.5 py-2 text-sm text-white focus:outline-none"
                      >
                        <option value="ALL">Toàn bộ giỏ hàng (Vé & Bắp nước)</option>
                        <option value="TICKET_ONLY">Chỉ áp dụng cho Vé xem phim</option>
                        <option value="FOOD_ONLY">Chỉ áp dụng cho Bắp nước (F&B)</option>
                      </select>
                    </div>
                  </div>

                  {/* Limits */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-neutral-300 mb-1.5">
                        Tổng lượt sử dụng tối đa
                      </label>
                      <input
                        type="number"
                        value={formData.usageLimit}
                        onChange={(e) => setFormData((prev) => ({ ...prev, usageLimit: e.target.value }))}
                        placeholder="Để trống nếu không giới hạn"
                        className="w-full bg-black/50 border border-white/[0.1] focus:border-amber-500 rounded-lg px-3.5 py-2 text-sm text-white placeholder-neutral-600 focus:outline-none"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-neutral-300 mb-1.5">
                        Số lượt dùng / Mỗi khách hàng
                      </label>
                      <input
                        type="number"
                        value={formData.userUsageLimit}
                        onChange={(e) => setFormData((prev) => ({ ...prev, userUsageLimit: e.target.value }))}
                        placeholder="Mặc định: 1"
                        className="w-full bg-black/50 border border-white/[0.1] focus:border-amber-500 rounded-lg px-3.5 py-2 text-sm text-white placeholder-neutral-600 focus:outline-none"
                      />
                    </div>
                  </div>

                  {/* Dates */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-neutral-300 mb-1.5">
                        Thời gian bắt đầu
                      </label>
                      <input
                        type="datetime-local"
                        value={formData.startDate}
                        onChange={(e) => setFormData((prev) => ({ ...prev, startDate: e.target.value }))}
                        className="w-full bg-black/50 border border-white/[0.1] focus:border-amber-500 rounded-lg px-3 py-2 text-xs text-white focus:outline-none"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-neutral-300 mb-1.5">
                        Thời gian kết thúc
                      </label>
                      <input
                        type="datetime-local"
                        value={formData.endDate}
                        onChange={(e) => setFormData((prev) => ({ ...prev, endDate: e.target.value }))}
                        className={`w-full bg-black/50 border ${
                          formErrors.endDate ? 'border-rose-500' : 'border-white/[0.1] focus:border-amber-500'
                        } rounded-lg px-3 py-2 text-xs text-white focus:outline-none`}
                      />
                      {formErrors.endDate && (
                        <p className="text-[11px] text-rose-400 mt-1">{formErrors.endDate}</p>
                      )}
                    </div>
                  </div>

                  {/* Status */}
                  <div>
                    <label className="block text-xs font-semibold text-neutral-300 mb-1.5">Trạng thái phát hành</label>
                    <select
                      value={formData.status}
                      onChange={(e) => setFormData((prev) => ({ ...prev, status: e.target.value }))}
                      className="w-full bg-black/50 border border-white/[0.1] focus:border-amber-500 rounded-lg px-3.5 py-2 text-sm text-white focus:outline-none"
                    >
                      <option value="ACTIVE">Kích hoạt ngay (ACTIVE)</option>
                      <option value="INACTIVE">Tạm dừng (INACTIVE)</option>
                    </select>
                  </div>

                  {/* Modal Footer */}
                  <div className="pt-4 border-t border-white/[0.08] flex items-center justify-end gap-3">
                    <button
                      type="button"
                      onClick={() => setIsModalOpen(false)}
                      className="px-4 py-2 text-xs font-medium text-neutral-300 hover:text-white bg-white/[0.05] hover:bg-white/[0.08] border border-white/[0.1] rounded-lg transition-colors"
                    >
                      Hủy bỏ
                    </button>
                    <button
                      type="submit"
                      disabled={isSaving}
                      className="px-5 py-2 text-xs font-semibold text-black bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 rounded-lg shadow-lg shadow-amber-500/20 transition-all flex items-center gap-2 active:scale-95 disabled:opacity-50"
                    >
                      {isSaving && <RefreshCw className="h-3.5 w-3.5 animate-spin" />}
                      {editingPromotion ? 'Cập nhật mã ưu đãi' : 'Phát hành mã ưu đãi'}
                    </button>
                  </div>
                </form>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

      </div>
    </div>
  );
}
