import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Plus, Trash2, Edit3, ShieldAlert, FileText, Database,
  Calendar, Users, DollarSign, Activity, AlertCircle, CheckCircle2,
  Search, Sliders, ChevronDown, Check, RefreshCw, Layers, ShoppingBag,
  BarChart2, Clock, MapPin, Film, Play, Eye, EyeOff, Sparkles, TrendingUp,
  Info, Globe, Tags, ImagePlus, ChevronLeft, ChevronRight, X, Copy,
  History, Package, Folder, AlertTriangle, RotateCcw, ArrowUpDown
} from 'lucide-react';
import { adminService } from '../../../services/adminService';
import FoodStockAdjustmentModal from './food/FoodStockAdjustmentModal';
import FoodPriceHistoryModal from './food/FoodPriceHistoryModal';
import FoodCategoryModal from './food/FoodCategoryModal';
import FoodComboBuilder from './food/FoodComboBuilder';

const FOOD_PAGE_SIZE = 10;

const formatVnd = (value) => `${Number(value || 0).toLocaleString('vi-VN')}đ`;

const toLocalDateValue = (date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export default function AdminFoodsPanel({ ctx }) {
  const {
    activeTab,
    foodItems,
    setFoodItems,
    foodCombos,
    setFoodCombos,
    isFoodLoading,
    setIsFoodLoading,
    getAdminToken,
    changeAdminSection,
    showToast,
    onFoodCatalogChanged,
    fetchFoods
  } = ctx;

  // ── Filters & Search ──────────────────────────────────────────────────────────
  const [filterKind, setFilterKind] = React.useState('ALL'); // ALL, SINGLE, COMBO, TRASH
  const [searchTerm, setSearchTerm] = React.useState('');
  const [selectedCategory, setSelectedCategory] = React.useState('ALL');
  const [selectedStatus, setSelectedStatus] = React.useState('ALL');
  const [selectedStockStatus, setSelectedStockStatus] = React.useState('ALL');
  const [sortBy, setSortBy] = React.useState('name_asc');
  const [foodPage, setFoodPage] = React.useState(1);

  // ── Categories & Cinemas Data ───────────────────────────────────────────────
  const [categories, setCategories] = React.useState([]);
  const [cinemas, setCinemas] = React.useState([]);

  // ── Dashboard Metrics ───────────────────────────────────────────────────────
  const [period, setPeriod] = React.useState('thisMonth'); // today, 7days, 30days, thisMonth
  const [salesSummary, setSalesSummary] = React.useState(null);
  const [isSalesSummaryLoading, setIsSalesSummaryLoading] = React.useState(true);
  const [salesSummaryError, setSalesSummaryError] = React.useState('');

  // ── Modals State ───────────────────────────────────────────────────────────
  const [isFoodModalOpen, setIsFoodModalOpen] = React.useState(false);
  const [editingItem, setEditingItem] = React.useState(null);
  const [formKind, setFormKind] = React.useState('item'); // 'item' or 'combo'
  const [activeFormTab, setActiveFormTab] = React.useState('general'); // general, pricing, combo, inventory, media
  const [isFormDirty, setIsFormDirty] = React.useState(false);

  // Form Fields
  const [formFields, setFormFields] = React.useState({
    name: '',
    sku: '',
    categoryId: '',
    costPrice: '',
    price: '',
    description: '',
    imageUrl: '',
    status: 'ACTIVE',
    stockTracking: true,
    lowStockThreshold: 10,
    initialStock: ''
  });
  const [comboRecipeItems, setComboRecipeItems] = React.useState([]);
  const [formErrors, setFormErrors] = React.useState({});
  const [isSaving, setIsSaving] = React.useState(false);
  const [isUploadingImage, setIsUploadingImage] = React.useState(false);

  // Sub-modals
  const [isCategoryModalOpen, setIsCategoryModalOpen] = React.useState(false);
  const [stockModalItem, setStockModalItem] = React.useState(null);
  const [priceHistoryModalItem, setPriceHistoryModalItem] = React.useState(null);
  const [confirmModalData, setConfirmModalData] = React.useState(null);

  // Bulk Selection
  const [selectedIds, setSelectedIds] = React.useState([]);

  // ── Initial Load ────────────────────────────────────────────────────────────
  const token = getAdminToken();

  const loadCategories = React.useCallback(async () => {
    if (!token) return;
    try {
      const data = await adminService.getAdminFoodCategories(token);
      setCategories(Array.isArray(data) ? data : []);
    } catch {
      setCategories([]);
    }
  }, [token]);

  React.useEffect(() => {
    loadCategories();
  }, [loadCategories]);

  // Load Sales Summary
  const loadSalesSummary = React.useCallback(async () => {
    if (!token) return;
    setIsSalesSummaryLoading(true);
    setSalesSummaryError('');

    try {
      const today = new Date();
      let from = new Date();

      if (period === 'today') {
        from = new Date(today.getFullYear(), today.getMonth(), today.getDate());
      } else if (period === '7days') {
        from = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
      } else if (period === '30days') {
        from = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);
      } else {
        // thisMonth
        from = new Date(today.getFullYear(), today.getMonth(), 1);
      }

      const response = await adminService.getConcessionSales(token, {
        from: toLocalDateValue(from),
        to: toLocalDateValue(today),
      });
      setSalesSummary(response || null);
    } catch (error) {
      setSalesSummary(null);
      setSalesSummaryError(error?.message || 'Không thể tải hiệu suất bán hàng.');
    } finally {
      setIsSalesSummaryLoading(false);
    }
  }, [token, period]);

  React.useEffect(() => {
    loadSalesSummary();
  }, [loadSalesSummary]);

  // ── Unified Products List ───────────────────────────────────────────────────
  const allUnifiedFoods = React.useMemo(() => {
    const items = (foodItems || []).map((i) => ({ ...i, kind: 'item' }));
    const combos = (foodCombos || []).map((c) => ({ ...c, kind: 'combo' }));
    return [...items, ...combos];
  }, [foodItems, foodCombos]);

  // ── Filtered & Sorted Foods ─────────────────────────────────────────────────
  const filteredFoods = React.useMemo(() => {
    return allUnifiedFoods.filter((item) => {
      // Trash filter
      if (filterKind === 'TRASH') {
        if (!item.deletedAt && item.status !== 'ARCHIVED') return false;
      } else {
        if (item.deletedAt) return false;
        if (filterKind === 'SINGLE' && item.kind !== 'item') return false;
        if (filterKind === 'COMBO' && item.kind !== 'combo') return false;
      }

      // Search (Name or SKU)
      if (searchTerm.trim()) {
        const query = searchTerm.toLowerCase().trim();
        const matchName = item.name?.toLowerCase().includes(query);
        const matchSku = item.sku?.toLowerCase().includes(query);
        if (!matchName && !matchSku) return false;
      }

      // Category
      if (selectedCategory !== 'ALL') {
        if (String(item.categoryId) !== String(selectedCategory)) return false;
      }

      // Selling Status
      if (selectedStatus !== 'ALL') {
        if (item.status !== selectedStatus) return false;
      }

      // Stock Status
      if (selectedStockStatus !== 'ALL') {
        if (item.stockStatus !== selectedStockStatus) return false;
      }

      return true;
    }).sort((a, b) => {
      if (sortBy === 'name_asc') return (a.name || '').localeCompare(b.name || '');
      if (sortBy === 'name_desc') return (b.name || '').localeCompare(a.name || '');
      if (sortBy === 'price_asc') return (a.price || 0) - (b.price || 0);
      if (sortBy === 'price_desc') return (b.price || 0) - (a.price || 0);
      if (sortBy === 'newest') return (b.id || 0) - (a.id || 0);
      if (sortBy === 'oldest') return (a.id || 0) - (b.id || 0);
      return 0;
    });
  }, [allUnifiedFoods, filterKind, searchTerm, selectedCategory, selectedStatus, selectedStockStatus, sortBy]);

  // Pagination
  const totalFoodPages = Math.max(1, Math.ceil(filteredFoods.length / FOOD_PAGE_SIZE));
  const safeFoodPage = Math.min(foodPage, totalFoodPages);
  const foodStartIndex = (safeFoodPage - 1) * FOOD_PAGE_SIZE;
  const paginatedFoods = filteredFoods.slice(foodStartIndex, foodStartIndex + FOOD_PAGE_SIZE);

  React.useEffect(() => {
    setFoodPage(1);
  }, [filterKind, searchTerm, selectedCategory, selectedStatus, selectedStockStatus, sortBy]);

  const handleResetFilters = () => {
    setFilterKind('ALL');
    setSearchTerm('');
    setSelectedCategory('ALL');
    setSelectedStatus('ALL');
    setSelectedStockStatus('ALL');
    setSortBy('name_asc');
  };

  // ── Selection for Bulk Actions ──────────────────────────────────────────────
  const isAllVisibleSelected = paginatedFoods.length > 0 && paginatedFoods.every((f) => selectedIds.includes(`${f.kind}-${f.id}`));

  const handleToggleSelectAll = () => {
    if (isAllVisibleSelected) {
      const pageKeys = paginatedFoods.map((f) => `${f.kind}-${f.id}`);
      setSelectedIds((prev) => prev.filter((k) => !pageKeys.includes(k)));
    } else {
      const pageKeys = paginatedFoods.map((f) => `${f.kind}-${f.id}`);
      setSelectedIds((prev) => Array.from(new Set([...prev, ...pageKeys])));
    }
  };

  const handleToggleRowSelect = (key) => {
    setSelectedIds((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
    );
  };

  // Bulk Operations
  const handleBulkStatusChange = async (newStatus) => {
    if (selectedIds.length === 0) return;
    try {
      const itemIds = [];
      const comboIds = [];
      selectedIds.forEach((key) => {
        const [kind, id] = key.split('-');
        if (kind === 'combo') comboIds.push(Number(id));
        else itemIds.push(Number(id));
      });

      if (itemIds.length > 0) {
        await adminService.bulkUpdateFoodStatus(token, { ids: itemIds, kind: 'item', status: newStatus });
      }
      if (comboIds.length > 0) {
        await adminService.bulkUpdateFoodStatus(token, { ids: comboIds, kind: 'combo', status: newStatus });
      }

      showToast(`Đã chuyển ${selectedIds.length} sản phẩm sang trạng thái ${newStatus}`);
      setSelectedIds([]);
      if (fetchFoods) fetchFoods();
      if (onFoodCatalogChanged) onFoodCatalogChanged();
    } catch (err) {
      showToast(err.message || 'Lỗi thao tác hàng loạt.');
    }
  };

  const handleBulkDelete = async () => {
    if (selectedIds.length === 0) return;
    setConfirmModalData({
      title: 'Xác nhận xóa hàng loạt',
      message: `Bạn có chắc chắn muốn chuyển ${selectedIds.length} sản phẩm đã chọn vào thùng rác?`,
      confirmLabel: 'Xóa hàng loạt',
      onConfirm: async () => {
        try {
          const itemIds = [];
          const comboIds = [];
          selectedIds.forEach((key) => {
            const [kind, id] = key.split('-');
            if (kind === 'combo') comboIds.push(Number(id));
            else itemIds.push(Number(id));
          });

          if (itemIds.length > 0) {
            await adminService.bulkDeleteFoods(token, { ids: itemIds, kind: 'item' });
          }
          if (comboIds.length > 0) {
            await adminService.bulkDeleteFoods(token, { ids: comboIds, kind: 'combo' });
          }

          showToast(`Đã chuyển ${selectedIds.length} món vào thùng rác.`);
          setSelectedIds([]);
          if (fetchFoods) fetchFoods();
          if (onFoodCatalogChanged) onFoodCatalogChanged();
        } catch (err) {
          showToast(err.message || 'Không thể xóa hàng loạt.');
        }
      }
    });
  };

  // ── Open Create / Edit Modal ────────────────────────────────────────────────
  const handleOpenCreateModal = (presetKind = 'item') => {
    setEditingItem(null);
    setFormKind(presetKind);
    setActiveFormTab('general');
    setIsFormDirty(false);
    setFormFields({
      name: '',
      sku: '',
      categoryId: categories[0]?.id ? String(categories[0].id) : '',
      costPrice: '',
      price: '',
      description: '',
      imageUrl: '',
      status: 'ACTIVE',
      stockTracking: true,
      lowStockThreshold: 10,
      initialStock: '50'
    });
    setComboRecipeItems([]);
    setFormErrors({});
    setIsFoodModalOpen(true);
  };

  const handleOpenEditModal = (food) => {
    setEditingItem(food);
    setFormKind(food.kind || 'item');
    setActiveFormTab('general');
    setIsFormDirty(false);
    setFormFields({
      name: food.name || '',
      sku: food.sku || '',
      categoryId: food.categoryId ? String(food.categoryId) : '',
      costPrice: food.costPrice ? String(food.costPrice) : '',
      price: food.price ? String(food.price) : '',
      description: food.description || '',
      imageUrl: food.imageUrl || '',
      status: food.status || 'ACTIVE',
      stockTracking: food.stockTracking ?? true,
      lowStockThreshold: food.lowStockThreshold || 10,
      initialStock: ''
    });
    setComboRecipeItems(food.items || []);
    setFormErrors({});
    setIsFoodModalOpen(true);
  };

  const handleCloseFormModal = () => {
    setIsFoodModalOpen(false);
    setEditingItem(null);
    setIsFormDirty(false);
    setFormErrors({});
  };

  React.useEffect(() => {
    if (!isFoodModalOpen) return;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        handleCloseFormModal();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isFoodModalOpen]);

  // Form Field Validation
  const validateForm = () => {
    const errors = {};
    if (!formFields.name.trim()) errors.name = 'Tên món/combo không được để trống';
    const priceNum = Number(formFields.price);
    if (isNaN(priceNum) || priceNum <= 0) errors.price = 'Giá bán phải là số dương lớn hơn 0';
    if (formFields.costPrice && Number(formFields.costPrice) < 0) errors.costPrice = 'Giá vốn không được âm';

    if (formKind === 'combo') {
      if (comboRecipeItems.length === 0) {
        errors.comboItems = 'Combo phải có ít nhất 1 món thành phần';
      }
    }
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // Image Upload handler
  const handleUploadImage = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      showToast('Kích thước ảnh tối đa là 5 MB.');
      return;
    }

    setIsUploadingImage(true);
    try {
      const res = await adminService.uploadAdminImage(token, file, 'foods');
      const url = res?.url || res?.secureUrl || res?.path;
      if (url) {
        setFormFields((prev) => ({ ...prev, imageUrl: url }));
        setIsFormDirty(true);
        showToast('Tải ảnh lên thành công!');
      }
    } catch (err) {
      showToast(err.message || 'Không thể tải ảnh lên.');
    } finally {
      setIsUploadingImage(false);
    }
  };

  // Save Food / Combo
  const handleSaveFood = async (e) => {
    e.preventDefault();
    if (!validateForm()) {
      showToast('Vui lòng kiểm tra lại các trường bị lỗi.');
      return;
    }

    setIsSaving(true);
    try {
      const isCombo = formKind === 'combo';
      const payload = {
        name: formFields.name.trim(),
        sku: formFields.sku.trim() || undefined,
        categoryId: formFields.categoryId ? Number(formFields.categoryId) : undefined,
        costPrice: formFields.costPrice ? Number(formFields.costPrice) : 0,
        price: Number(formFields.price),
        description: formFields.description.trim(),
        imageUrl: formFields.imageUrl.trim(),
        status: formFields.status,
        ...(isCombo
          ? {
              items: comboRecipeItems.map((ci) => ({
                foodItemId: ci.foodItemId || ci.id,
                quantity: ci.quantity || 1
              }))
            }
          : {
              stockTracking: formFields.stockTracking,
              lowStockThreshold: Number(formFields.lowStockThreshold) || 10,
              initialStock: formFields.initialStock ? Number(formFields.initialStock) : undefined
            })
      };

      if (editingItem) {
        if (isCombo) {
          await adminService.updateAdminFoodCombo(token, editingItem.id, payload);
        } else {
          await adminService.updateAdminFoodItem(token, editingItem.id, payload);
        }
        showToast(`Đã cập nhật: ${payload.name}`);
      } else {
        if (isCombo) {
          await adminService.createAdminFoodCombo(token, payload);
        } else {
          await adminService.createAdminFoodItem(token, payload);
        }
        showToast(`Đã tạo món mới: ${payload.name}`);
      }

      setIsFoodModalOpen(false);
      setIsFormDirty(false);
      setEditingItem(null);
      if (fetchFoods) fetchFoods();
      if (onFoodCatalogChanged) onFoodCatalogChanged();
    } catch (err) {
      showToast(err.message || 'Không thể lưu món.');
    } finally {
      setIsSaving(false);
    }
  };

  // Single Actions
  const handleDuplicate = async (food) => {
    try {
      if (food.kind === 'combo') {
        await adminService.duplicateAdminFoodCombo(token, food.id);
      } else {
        await adminService.duplicateAdminFoodItem(token, food.id);
      }
      showToast(`Đã nhân bản: ${food.name}`);
      if (fetchFoods) fetchFoods();
      if (onFoodCatalogChanged) onFoodCatalogChanged();
    } catch (err) {
      showToast(err.message || 'Không thể nhân bản.');
    }
  };

  const handleToggleStatus = async (food) => {
    try {
      const nextStatus = food.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
      const payload = {
        name: food.name,
        price: food.price,
        imageUrl: food.imageUrl,
        description: food.description,
        status: nextStatus
      };
      if (food.kind === 'combo') {
        await adminService.updateAdminFoodCombo(token, food.id, payload);
      } else {
        await adminService.updateAdminFoodItem(token, food.id, payload);
      }
      showToast(`Đã chuyển trạng thái ${food.name} sang ${nextStatus}`);
      if (fetchFoods) fetchFoods();
      if (onFoodCatalogChanged) onFoodCatalogChanged();
    } catch (err) {
      showToast(err.message || 'Lỗi cập nhật trạng thái.');
    }
  };

  const handleDeleteSingle = (food) => {
    setConfirmModalData({
      title: `Xác nhận xóa "${food.name}"`,
      message: 'Món này sẽ được chuyển vào thùng rác (soft delete). Bạn có thể khôi phục lại bất kỳ lúc nào từ tab Thùng rác.',
      confirmLabel: 'Chuyển vào thùng rác',
      onConfirm: async () => {
        try {
          if (food.kind === 'combo') {
            await adminService.deleteAdminFoodCombo(token, food.id);
          } else {
            await adminService.deleteAdminFoodItem(token, food.id);
          }
          showToast(`Đã chuyển "${food.name}" vào thùng rác.`);
          if (fetchFoods) fetchFoods();
          if (onFoodCatalogChanged) onFoodCatalogChanged();
        } catch (err) {
          showToast(err.message || 'Không thể xóa món.');
        }
      }
    });
  };

  const handleRestoreSingle = async (food) => {
    try {
      if (food.kind === 'combo') {
        await adminService.restoreAdminFoodCombo(token, food.id);
      } else {
        await adminService.restoreAdminFoodItem(token, food.id);
      }
      showToast(`Đã khôi phục món: ${food.name}`);
      if (fetchFoods) fetchFoods();
      if (onFoodCatalogChanged) onFoodCatalogChanged();
    } catch (err) {
      showToast(err.message || 'Không thể khôi phục.');
    }
  };

  const topSellingItem = salesSummary?.lines?.[0] || null;

  // Margin calculation for Form
  const formSellingPrice = Number(formFields.price) || 0;
  const formCostPrice = Number(formFields.costPrice) || 0;
  const formGrossProfit = formSellingPrice - formCostPrice;
  const formMarginPercent = formSellingPrice > 0 ? Math.round((formGrossProfit / formSellingPrice) * 100) : 0;

  return (
    <>
      {activeTab === 'foods' && (
        <motion.div
          key="panel-foods"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.2 }}
          className="space-y-6"
        >
          {/* Header Panel */}
          <div className="border border-white/[0.05] bg-gradient-to-r from-[#090909] to-[#050505] p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <span className="text-[9px] font-mono tracking-[0.24em] text-neutral-400 uppercase font-black block">
                CONCESSION &amp; INVENTORY CONTROL
              </span>
              <h2 className="text-sm font-black uppercase tracking-[0.18em] text-white mt-1">
                Quản lý Bắp Nước, Combo &amp; Kho Hàng
              </h2>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setIsCategoryModalOpen(true)}
                className="inline-flex min-h-10 items-center gap-2 border border-white/10 bg-white/5 hover:border-amber-400/40 hover:text-white px-3.5 text-xs font-black uppercase tracking-wider text-neutral-300 transition"
              >
                <Folder className="h-4 w-4 text-amber-400" />
                Quản lý danh mục
              </button>
              <button
                type="button"
                onClick={() => handleOpenCreateModal('item')}
                className="inline-flex min-h-10 items-center gap-2 bg-amber-500 hover:bg-amber-400 text-black px-4 text-xs font-black uppercase tracking-wider transition shadow-lg shadow-amber-500/10"
              >
                <Plus className="h-4 w-4" />
                Thêm món mới
              </button>
            </div>
          </div>

          {/* KPI Dashboard Section */}
          <section className="border border-white/10 bg-[#070707]" aria-labelledby="food-sales-summary-title">
            <div className="flex flex-col gap-4 border-b border-white/10 px-5 py-3.5 md:flex-row md:items-center md:justify-between">
              <div className="flex items-center gap-2">
                <BarChart2 className="h-4 w-4 text-amber-400" />
                <h3 id="food-sales-summary-title" className="text-xs font-black uppercase tracking-[0.18em] text-white">
                  Hiệu suất F&amp;B &amp; Tồn kho
                </h3>
              </div>

              {/* Period Selector */}
              <div className="flex flex-wrap items-center gap-2">
                <div className="flex border border-white/10 p-0.5 bg-black">
                  {[
                    { id: 'today', label: 'Hôm nay' },
                    { id: '7days', label: '7 ngày qua' },
                    { id: '30days', label: '30 ngày' },
                    { id: 'thisMonth', label: 'Tháng này' }
                  ].map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => setPeriod(p.id)}
                      className={`px-3 py-1.5 text-[10px] font-black uppercase tracking-wider transition ${
                        period === p.id
                          ? 'bg-amber-500 text-black'
                          : 'text-neutral-400 hover:text-white'
                      }`}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>

                <button
                  type="button"
                  onClick={loadSalesSummary}
                  disabled={isSalesSummaryLoading}
                  className="inline-flex items-center gap-1.5 border border-white/10 px-3 py-1.5 text-[10px] font-black uppercase tracking-wider text-neutral-300 transition hover:border-amber-400/50 hover:text-white disabled:opacity-50"
                  title="Làm mới số liệu"
                >
                  <RefreshCw className={`h-3 w-3 ${isSalesSummaryLoading ? 'animate-spin' : ''}`} />
                  Làm mới
                </button>

                <button
                  type="button"
                  onClick={() => changeAdminSection('fnb-report')}
                  className="inline-flex items-center gap-1.5 border border-amber-500/40 bg-amber-500/10 px-3 py-1.5 text-[10px] font-black uppercase tracking-wider text-amber-300 transition hover:bg-amber-500 hover:text-black"
                >
                  Báo cáo chi tiết
                  <TrendingUp className="h-3 w-3" />
                </button>
              </div>
            </div>

            {salesSummaryError ? (
              <div className="flex min-h-20 items-center justify-between gap-4 px-5 py-3" role="alert">
                <p className="text-xs font-bold text-rose-300">{salesSummaryError}</p>
                <button
                  type="button"
                  onClick={loadSalesSummary}
                  className="border border-rose-400/40 px-3 py-1.5 text-[10px] font-black uppercase text-rose-200"
                >
                  Thử lại
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 divide-y sm:divide-y-0 sm:divide-x divide-white/10">
                {/* Doanh thu */}
                <div className="px-4 py-3.5">
                  <p className="text-[9px] font-black uppercase tracking-wider text-neutral-400">Doanh thu F&amp;B</p>
                  <p className="mt-1 font-mono text-lg font-black text-emerald-400 truncate">
                    {isSalesSummaryLoading ? '—' : formatVnd(salesSummary?.totalRevenue)}
                  </p>
                  <p className="text-[9px] text-neutral-400 mt-0.5">Đã thanh toán</p>
                </div>

                {/* Đã bán */}
                <div className="px-4 py-3.5">
                  <p className="text-[9px] font-black uppercase tracking-wider text-neutral-400">Số món đã bán</p>
                  <p className="mt-1 font-mono text-lg font-black text-white">
                    {isSalesSummaryLoading ? '—' : Number(salesSummary?.totalItemsSold || 0).toLocaleString('vi-VN')}
                  </p>
                  <p className="text-[9px] text-neutral-400 mt-0.5">{salesSummary?.totalOrders || 0} đơn giao dịch</p>
                </div>

                {/* Bán chạy nhất */}
                <div className="px-4 py-3.5">
                  <p className="text-[9px] font-black uppercase tracking-wider text-neutral-400">Món bán chạy nhất</p>
                  <p className="mt-1 truncate text-xs font-black uppercase text-amber-300" title={topSellingItem?.name || ''}>
                    {isSalesSummaryLoading ? '...' : topSellingItem?.name || 'Chưa có'}
                  </p>
                  <p className="text-[9px] text-neutral-400 mt-0.5 font-mono">
                    {topSellingItem ? `${topSellingItem.quantity} lượt bán` : 'Chưa phát sinh'}
                  </p>
                </div>

                {/* Low Stock */}
                <div className="px-4 py-3.5">
                  <p className="text-[9px] font-black uppercase tracking-wider text-amber-400 flex items-center gap-1">
                    <AlertTriangle className="h-3 w-3" />
                    Sắp hết hàng
                  </p>
                  <p className="mt-1 font-mono text-lg font-black text-amber-300">
                    {isSalesSummaryLoading ? '—' : salesSummary?.lowStockCount ?? 0}
                  </p>
                  <p className="text-[9px] text-neutral-400 mt-0.5">≤ ngưỡng an toàn</p>
                </div>

                {/* Out of Stock */}
                <div className="px-4 py-3.5">
                  <p className="text-[9px] font-black uppercase tracking-wider text-rose-400 flex items-center gap-1">
                    <ShieldAlert className="h-3 w-3" />
                    Hết hàng
                  </p>
                  <p className="mt-1 font-mono text-lg font-black text-rose-400">
                    {isSalesSummaryLoading ? '—' : salesSummary?.outOfStockCount ?? 0}
                  </p>
                  <p className="text-[9px] text-neutral-400 mt-0.5">Cần nhập kho ngay</p>
                </div>

                {/* Gross Profit */}
                <div className="px-4 py-3.5">
                  <p className="text-[9px] font-black uppercase tracking-wider text-neutral-400">Lợi nhuận gộp ước tính</p>
                  <p className="mt-1 font-mono text-lg font-black text-cyan-400 truncate">
                    {isSalesSummaryLoading ? '—' : formatVnd(salesSummary?.grossProfit)}
                  </p>
                  <p className="text-[9px] text-neutral-400 mt-0.5">
                    Biên lợi nhuận ~{salesSummary?.profitMargin || 55}%
                  </p>
                </div>
              </div>
            )}
          </section>

          {/* FILTERS & SEARCH TOOLBAR */}
          <div className="border border-white/10 bg-[#0c0c0c] p-4 space-y-3">
            {/* Top row: Tab Switcher (ALL, SINGLE, COMBO, TRASH) */}
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/[0.06] pb-3">
              <div className="flex items-center gap-1 border border-white/10 p-0.5 bg-black">
                {[
                  { id: 'ALL', label: 'Tất cả món', count: allUnifiedFoods.filter((f) => !f.deletedAt).length },
                  { id: 'SINGLE', label: 'Món lẻ (Single)', count: foodItems.filter((f) => !f.deletedAt).length },
                  { id: 'COMBO', label: 'Combo bắp nước', count: foodCombos.filter((f) => !f.deletedAt).length },
                  { id: 'TRASH', label: 'Thùng rác', count: allUnifiedFoods.filter((f) => f.deletedAt || f.status === 'ARCHIVED').length }
                ].map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setFilterKind(t.id)}
                    className={`px-3 py-1.5 text-xs font-black uppercase tracking-wider transition flex items-center gap-1.5 ${
                      filterKind === t.id
                        ? 'bg-amber-400 text-black'
                        : 'text-neutral-400 hover:text-white'
                    }`}
                  >
                    {t.label}
                    <span className={`px-1.5 py-0.2 font-mono text-[10px] ${filterKind === t.id ? 'bg-black/20 text-black' : 'bg-white/10 text-neutral-300'}`}>
                      {t.count}
                    </span>
                  </button>
                ))}
              </div>

              {/* Reset filter button */}
              <button
                type="button"
                onClick={handleResetFilters}
                className="text-[10px] uppercase font-black tracking-wider text-neutral-400 hover:text-white flex items-center gap-1 transition"
              >
                <RotateCcw className="h-3 w-3" />
                Đặt lại bộ lọc
              </button>
            </div>

            {/* Filter controls row */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-3">
              {/* Search */}
              <div className="relative md:col-span-2">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-neutral-500" />
                <input
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Tìm theo tên món hoặc mã SKU..."
                  className="w-full bg-black border border-white/10 py-2 pl-9 pr-3 text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-amber-400 font-medium"
                />
                {searchTerm && (
                  <button
                    type="button"
                    onClick={() => setSearchTerm('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-neutral-500 hover:text-white"
                  >
                    <X className="h-3 w-3" />
                  </button>
                )}
              </div>

              {/* Category Filter */}
              <div>
                <select
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value)}
                  className="w-full bg-black border border-white/10 p-2 text-xs text-white focus:outline-none focus:border-amber-400 font-medium"
                >
                  <option value="ALL">-- Tất cả danh mục --</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>{c.name} ({c.code})</option>
                  ))}
                </select>
              </div>

              {/* Stock Status Filter */}
              <div>
                <select
                  value={selectedStockStatus}
                  onChange={(e) => setSelectedStockStatus(e.target.value)}
                  className="w-full bg-black border border-white/10 p-2 text-xs text-white focus:outline-none focus:border-amber-400 font-medium"
                >
                  <option value="ALL">-- Tồn kho (Tất cả) --</option>
                  <option value="IN_STOCK">Còn hàng (IN STOCK)</option>
                  <option value="LOW_STOCK">Sắp hết (LOW STOCK)</option>
                  <option value="OUT_OF_STOCK">Hết hàng (OUT OF STOCK)</option>
                </select>
              </div>

              {/* Sort By */}
              <div>
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value)}
                  className="w-full bg-black border border-white/10 p-2 text-xs text-white focus:outline-none focus:border-amber-400 font-medium"
                >
                  <option value="name_asc">Tên: A → Z</option>
                  <option value="name_desc">Tên: Z → A</option>
                  <option value="price_asc">Giá: Thấp → Cao</option>
                  <option value="price_desc">Giá: Cao → Thấp</option>
                  <option value="newest">Mới nhất</option>
                  <option value="oldest">Cũ nhất</option>
                </select>
              </div>
            </div>
          </div>

          {/* BULK ACTIONS BAR */}
          <AnimatePresence>
            {selectedIds.length > 0 && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="border border-amber-500/40 bg-amber-500/10 p-3 flex flex-wrap items-center justify-between gap-3"
              >
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-amber-400" />
                  <span className="text-xs font-black uppercase tracking-wider text-white">
                    Đã chọn <b className="text-amber-300 font-mono">{selectedIds.length}</b> món
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleBulkStatusChange('ACTIVE')}
                    className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-[10px] font-black uppercase tracking-wider transition"
                  >
                    Mở bán hàng loạt
                  </button>
                  <button
                    type="button"
                    onClick={() => handleBulkStatusChange('INACTIVE')}
                    className="px-3 py-1.5 bg-neutral-700 hover:bg-neutral-600 text-white text-[10px] font-black uppercase tracking-wider transition"
                  >
                    Ngừng bán hàng loạt
                  </button>
                  <button
                    type="button"
                    onClick={handleBulkDelete}
                    className="px-3 py-1.5 bg-rose-600 hover:bg-rose-500 text-white text-[10px] font-black uppercase tracking-wider transition"
                  >
                    Xóa vào thùng rác
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedIds([])}
                    className="px-2.5 py-1.5 border border-white/20 text-neutral-300 hover:text-white text-[10px] font-black uppercase tracking-wider transition"
                  >
                    Bỏ chọn
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* MAIN PRODUCT TABLE (100% FULL WIDTH) */}
          <div className="border border-white/10 bg-[#070707] overflow-hidden w-full">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse min-w-[900px]">
                <thead>
                  <tr className="bg-black border-b border-white/10 text-[9px] uppercase tracking-widest text-neutral-400 font-mono">
                    <th className="py-3 px-3 w-10 text-center">
                      <input
                        type="checkbox"
                        checked={isAllVisibleSelected}
                        onChange={handleToggleSelectAll}
                        className="rounded-none border-white/30 text-amber-500 focus:ring-0 focus:outline-none cursor-pointer"
                        title="Chọn tất cả trên trang này"
                      />
                    </th>
                    <th className="py-3 px-3 w-[32%]">Sản phẩm &amp; SKU</th>
                    <th className="py-3 px-3 w-[12%]">Loại / Danh mục</th>
                    <th className="py-3 px-3 w-[16%]">Giá bán / Giá vốn</th>
                    <th className="py-3 px-3 w-[14%]">Tồn kho / Trạng thái</th>
                    <th className="py-3 px-3 w-[12%]">Bán hàng</th>
                    <th className="py-3 px-3 w-[14%] text-right">Thao tác</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.04]">
                  {isFoodLoading ? (
                    <tr>
                      <td colSpan={7} className="py-14 text-center text-neutral-400 font-mono uppercase tracking-wider">
                        <RefreshCw className="h-5 w-5 animate-spin mx-auto mb-2 text-amber-400" />
                        Đang tải danh sách bắp nước...
                      </td>
                    </tr>
                  ) : paginatedFoods.length > 0 ? (
                    paginatedFoods.map((item) => {
                      const rowKey = `${item.kind}-${item.id}`;
                      const isSelected = selectedIds.includes(rowKey);
                      const isCombo = item.kind === 'combo';
                      const stockVal = isCombo ? item.maxAvailableCombos : item.totalStock;
                      const stockStatus = item.stockStatus || 'IN_STOCK';

                      return (
                        <tr
                          key={rowKey}
                          className={`transition hover:bg-white/[0.02] ${
                            isSelected ? 'bg-amber-500/[0.06]' : ''
                          }`}
                        >
                          {/* Checkbox */}
                          <td className="py-3.5 px-3 text-center">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => handleToggleRowSelect(rowKey)}
                              className="rounded-none border-white/30 text-amber-500 focus:ring-0 focus:outline-none cursor-pointer"
                            />
                          </td>

                          {/* Product & SKU */}
                          <td className="py-3.5 px-3 min-w-0">
                            <div className="flex items-center gap-3">
                              <img
                                src={item.imageUrl || 'https://images.unsplash.com/photo-1578849278619-e73505e9610f?q=80&w=300&auto=format&fit=crop'}
                                alt={item.name}
                                className="h-12 w-12 object-cover border border-white/10 bg-black shrink-0"
                                referrerPolicy="no-referrer"
                              />
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-2">
                                  <span className="font-black text-white text-xs uppercase tracking-wide truncate">
                                    {item.name}
                                  </span>
                                </div>
                                <div className="flex items-center gap-2 mt-0.5">
                                  <span className="font-mono text-[9px] px-1.5 py-0.2 bg-white/5 border border-white/10 text-amber-300 font-bold">
                                    {item.sku || `ID #${item.id}`}
                                  </span>
                                  {isCombo && (
                                    <span className="text-[9px] text-neutral-400 font-medium">
                                      ({item.items?.length || 0} món thành phần)
                                    </span>
                                  )}
                                </div>
                                <div className="text-[10px] text-neutral-400 line-clamp-1 mt-0.5">
                                  {item.description || 'Chưa có mô tả'}
                                </div>
                              </div>
                            </div>
                          </td>

                          {/* Type / Category */}
                          <td className="py-3.5 px-3">
                            <div>
                              <span className={`inline-block px-2 py-0.5 text-[9px] font-black tracking-wider uppercase border ${
                                isCombo
                                  ? 'border-amber-500/40 bg-amber-500/10 text-amber-300'
                                  : 'border-white/10 bg-white/5 text-neutral-300'
                              }`}>
                                {isCombo ? 'Combo' : 'Món lẻ'}
                              </span>
                              <div className="text-[10px] text-neutral-400 font-medium mt-1">
                                {item.categoryName || 'Mặc định'}
                              </div>
                            </div>
                          </td>

                          {/* Price & Cost */}
                          <td className="py-3.5 px-3">
                            <div className="font-mono">
                              <span className="text-xs font-bold text-white block">
                                {formatVnd(item.price)}
                              </span>
                              {item.costPrice > 0 && (
                                <div className="flex items-center gap-1 text-[9px] text-neutral-400 mt-0.5">
                                  <span>Vốn: {formatVnd(item.costPrice)}</span>
                                  <span className="text-emerald-400 font-bold">
                                    ({Math.round(item.marginPercentage || 0)}%)
                                  </span>
                                </div>
                              )}
                            </div>
                          </td>

                          {/* Stock & Status */}
                          <td className="py-3.5 px-3">
                            <div>
                              <div className="flex items-center gap-1.5">
                                <span className={`h-2 w-2 rounded-full ${
                                  stockStatus === 'IN_STOCK' ? 'bg-emerald-400' : stockStatus === 'LOW_STOCK' ? 'bg-amber-400' : 'bg-rose-400'
                                }`} />
                                <span className="font-mono text-xs font-black text-white">
                                  {stockVal ?? 0}
                                </span>
                                <span className="text-[9px] text-neutral-400">
                                  {isCombo ? 'combo' : 'đv'}
                                </span>
                              </div>
                              <span className={`inline-block text-[9px] font-bold uppercase tracking-wider mt-0.5 ${
                                stockStatus === 'IN_STOCK' ? 'text-emerald-400' : stockStatus === 'LOW_STOCK' ? 'text-amber-400' : 'text-rose-400'
                              }`}>
                                {stockStatus === 'IN_STOCK' ? 'Còn hàng' : stockStatus === 'LOW_STOCK' ? 'Sắp hết' : 'Hết hàng'}
                              </span>
                            </div>
                          </td>

                          {/* Selling Status: Click directly to toggle status */}
                          <td className="py-3.5 px-3">
                            {filterKind === 'TRASH' || item.deletedAt ? (
                              <span className="inline-block px-2.5 py-1 text-[9px] font-black uppercase tracking-wider border border-neutral-700 bg-neutral-800 text-neutral-400">
                                {item.status === 'ACTIVE' ? 'Mở bán' : item.status === 'DRAFT' ? 'Bản nháp' : 'Ngừng bán'}
                              </span>
                            ) : (
                              <button
                                type="button"
                                onClick={() => handleToggleStatus(item)}
                                title={`Bấm để chuyển sang ${item.status === 'ACTIVE' ? 'NGỪNG BÁN' : 'MỞ BÁN'}`}
                                className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-[9px] font-black uppercase tracking-wider border transition cursor-pointer group ${
                                  item.status === 'ACTIVE'
                                    ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 hover:border-emerald-400'
                                    : item.status === 'DRAFT'
                                    ? 'border-amber-500/40 bg-amber-500/10 text-amber-300 hover:bg-amber-500/20 hover:border-amber-400'
                                    : 'border-white/10 bg-white/5 text-neutral-400 hover:border-white/30 hover:text-white'
                                }`}
                              >
                                <span className={`h-1.5 w-1.5 rounded-full ${
                                  item.status === 'ACTIVE' ? 'bg-emerald-400 group-hover:scale-125 transition' : 'bg-neutral-500'
                                }`} />
                                {item.status === 'ACTIVE' ? 'Mở bán' : item.status === 'DRAFT' ? 'Bản nháp' : 'Ngừng bán'}
                              </button>
                            )}
                          </td>

                          {/* Actions */}
                          <td className="py-3.5 px-3 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              {filterKind === 'TRASH' || item.deletedAt ? (
                                <button
                                  type="button"
                                  onClick={() => handleRestoreSingle(item)}
                                  className="p-1.5 text-emerald-400 border border-emerald-500/30 bg-emerald-500/10 hover:bg-emerald-400 hover:text-black transition"
                                  title="Khôi phục món này"
                                >
                                  <RotateCcw className="h-3.5 w-3.5" />
                                </button>
                              ) : (
                                <>
                                  {/* Edit */}
                                  <button
                                    type="button"
                                    onClick={() => handleOpenEditModal(item)}
                                    className="p-1.5 text-amber-300 border border-amber-500/30 bg-amber-500/10 hover:bg-amber-400 hover:text-black transition"
                                    title="Chỉnh sửa món / combo"
                                  >
                                    <Edit3 className="h-3.5 w-3.5" />
                                  </button>

                                  {/* Stock Adjust (single items only) */}
                                  {!isCombo && (
                                    <button
                                      type="button"
                                      onClick={() => setStockModalItem(item)}
                                      className="p-1.5 text-cyan-300 border border-cyan-500/30 bg-cyan-500/10 hover:bg-cyan-400 hover:text-black transition"
                                      title="Điều chỉnh tồn kho"
                                    >
                                      <Package className="h-3.5 w-3.5" />
                                    </button>
                                  )}

                                  {/* Price History */}
                                  <button
                                    type="button"
                                    onClick={() => setPriceHistoryModalItem(item)}
                                    className="p-1.5 text-neutral-300 border border-white/10 bg-white/5 hover:border-white/30 hover:text-white transition"
                                    title="Lịch sử thay đổi giá"
                                  >
                                    <History className="h-3.5 w-3.5" />
                                  </button>

                                  {/* Soft Delete */}
                                  <button
                                    type="button"
                                    onClick={() => handleDeleteSingle(item)}
                                    className="p-1.5 text-rose-400 border border-rose-500/20 bg-rose-500/10 hover:bg-rose-500 hover:text-black transition"
                                    title="Xóa món (chuyển vào thùng rác)"
                                  >
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </button>
                                </>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan={7} className="py-12 text-center text-neutral-400 font-mono uppercase tracking-wider">
                        {searchTerm ? 'Không tìm thấy món ăn nào phù hợp với từ khóa.' : 'Danh mục hiện tại chưa có món nào.'}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            <div className="flex flex-col sm:flex-row items-center justify-between border-t border-white/10 bg-black/80 px-4 py-3 text-[10px] font-black uppercase tracking-[0.16em] text-neutral-400 gap-3">
              <span>
                Hiển thị {filteredFoods.length === 0 ? 0 : foodStartIndex + 1}-{Math.min(foodStartIndex + FOOD_PAGE_SIZE, filteredFoods.length)} / {filteredFoods.length} món · Trang {safeFoodPage}/{totalFoodPages}
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={safeFoodPage <= 1}
                  onClick={() => setFoodPage((p) => Math.max(1, p - 1))}
                  className="inline-flex items-center gap-1 border border-white/10 px-3 py-1.5 text-white transition hover:border-white disabled:opacity-30"
                >
                  <ChevronLeft className="h-3.5 w-3.5" /> Trước
                </button>
                <button
                  type="button"
                  disabled={safeFoodPage >= totalFoodPages}
                  onClick={() => setFoodPage((p) => Math.min(totalFoodPages, p + 1))}
                  className="inline-flex items-center gap-1 border border-white/10 px-3 py-1.5 text-white transition hover:border-white disabled:opacity-30"
                >
                  Sau <ChevronRight className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          </div>

          {/* CREATE / EDIT POPUP MODAL */}
          <AnimatePresence>
            {isFoodModalOpen && (
              <div
                className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm overflow-y-auto"
                onClick={handleCloseFormModal}
              >
                <motion.div
                  initial={{ opacity: 0, scale: 0.95, y: 15 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95, y: 15 }}
                  className="relative w-full max-w-2xl border border-amber-500/30 bg-[#0c0c0c] shadow-2xl p-6 space-y-5 my-8"
                  onClick={(e) => e.stopPropagation()}
                >
                  {/* Header */}
                  <div className="flex items-center justify-between border-b border-white/10 pb-4">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center border border-amber-500/30 bg-amber-500/10 text-amber-400">
                        {editingItem ? <Edit3 className="h-5 w-5" /> : <Plus className="h-5 w-5" />}
                      </div>
                      <div>
                        <span className="text-[9px] font-mono uppercase tracking-[0.2em] text-neutral-400 font-black">
                          {editingItem ? 'CHỈNH SỬA SẢN PHẨM' : 'TẠO MÓN MỚI'}
                        </span>
                        <h3 className="text-sm font-black uppercase tracking-[0.16em] text-white mt-0.5 truncate max-w-md">
                          {editingItem ? editingItem.name : formKind === 'combo' ? 'Combo Bắp Nước' : 'Món Lẻ (Bắp / Nước / Đồ ăn)'}
                        </h3>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={handleCloseFormModal}
                      className="p-1.5 text-neutral-400 hover:text-white border border-white/10 hover:border-white/30 transition"
                      title="Đóng cửa sổ"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>

                  <form onSubmit={handleSaveFood} className="space-y-4">
                    {/* Kind Switcher (item vs combo) */}
                    <div className="grid grid-cols-2 gap-2">
                      {[
                        { id: 'item', label: 'Món lẻ (Single)' },
                        { id: 'combo', label: 'Combo Bắp Nước (Combo)' }
                      ].map((k) => (
                        <button
                          key={k.id}
                          type="button"
                          disabled={Boolean(editingItem)}
                          onClick={() => {
                            setFormKind(k.id);
                            setIsFormDirty(true);
                          }}
                          className={`py-2 text-xs font-black uppercase tracking-wider border transition ${
                            formKind === k.id
                              ? 'border-amber-400 bg-amber-400 text-black'
                              : 'border-white/10 text-neutral-400 hover:text-white'
                          } ${editingItem ? 'cursor-not-allowed opacity-70' : ''}`}
                        >
                          {k.label}
                        </button>
                      ))}
                    </div>

                    {/* Navigation Tabs inside Form */}
                    <div className="flex border-b border-white/10 text-xs">
                      {[
                        { id: 'general', label: '1. Thông tin chung' },
                        { id: 'pricing', label: '2. Giá & Lợi nhuận' },
                        ...(formKind === 'combo' ? [{ id: 'combo', label: '3. Thành phần Combo' }] : [{ id: 'inventory', label: '3. Tồn kho' }]),
                        { id: 'media', label: '4. Hình ảnh & Trạng thái' }
                      ].map((tab) => (
                        <button
                          key={tab.id}
                          type="button"
                          onClick={() => setActiveFormTab(tab.id)}
                          className={`px-3 py-2 text-[10px] font-black uppercase tracking-wider border-b-2 transition ${
                            activeFormTab === tab.id
                              ? 'border-amber-400 text-amber-300 bg-white/[0.02]'
                              : 'border-transparent text-neutral-400 hover:text-white'
                          }`}
                        >
                          {tab.label}
                        </button>
                      ))}
                    </div>

                    {/* TAB 1: GENERAL INFO */}
                    {activeFormTab === 'general' && (
                      <div className="space-y-3">
                        <div className="space-y-1">
                          <label className="text-[10px] uppercase tracking-wider font-bold text-neutral-200">
                            Tên món / combo <span className="text-rose-400">*</span>
                          </label>
                          <input
                            value={formFields.name}
                            onChange={(e) => {
                              setFormFields((prev) => ({ ...prev, name: e.target.value }));
                              setIsFormDirty(true);
                              if (formErrors.name) setFormErrors((prev) => ({ ...prev, name: undefined }));
                            }}
                            placeholder="VD: Bắp phô mai lớn, Combo Couple..."
                            className={`w-full bg-black border p-2.5 text-xs text-white focus:outline-none font-bold ${
                              formErrors.name ? 'border-rose-500' : 'border-white/10 focus:border-amber-400'
                            }`}
                            required
                          />
                          {formErrors.name && <p className="text-[10px] text-rose-400 font-bold">{formErrors.name}</p>}
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div className="space-y-1">
                            <label className="text-[10px] uppercase tracking-wider font-bold text-neutral-200 flex items-center justify-between">
                              <span>Mã SKU <span className="text-neutral-500 font-normal">(Unique)</span></span>
                              <span className="text-[9px] text-neutral-500">Để trống tự sinh</span>
                            </label>
                            <input
                              value={formFields.sku}
                              onChange={(e) => {
                                setFormFields((prev) => ({ ...prev, sku: e.target.value.toUpperCase() }));
                                setIsFormDirty(true);
                              }}
                              placeholder="VD: POP-CHEESE-L, CMB-COUPLE"
                              className="w-full bg-black border border-white/10 p-2.5 text-xs text-white font-mono font-bold focus:outline-none focus:border-amber-400"
                            />
                          </div>

                          <div className="space-y-1">
                            <label className="text-[10px] uppercase tracking-wider font-bold text-neutral-200">
                              Danh mục sản phẩm
                            </label>
                            <select
                              value={formFields.categoryId}
                              onChange={(e) => {
                                setFormFields((prev) => ({ ...prev, categoryId: e.target.value }));
                                setIsFormDirty(true);
                              }}
                              className="w-full bg-black border border-white/10 p-2.5 text-xs text-white focus:outline-none focus:border-amber-400 font-medium"
                            >
                              <option value="">-- Chọn danh mục --</option>
                              {categories.map((c) => (
                                <option key={c.id} value={c.id}>{c.name} ({c.code})</option>
                              ))}
                            </select>
                          </div>
                        </div>

                        <div className="space-y-1">
                          <label className="text-[10px] uppercase tracking-wider font-bold text-neutral-200">
                            Mô tả chi tiết
                          </label>
                          <textarea
                            rows={3}
                            value={formFields.description}
                            onChange={(e) => {
                              setFormFields((prev) => ({ ...prev, description: e.target.value }));
                              setIsFormDirty(true);
                            }}
                            placeholder="Mô tả thành phần, hương vị..."
                            className="w-full bg-black border border-white/10 p-2.5 text-xs text-white focus:outline-none focus:border-amber-400 resize-none"
                          />
                        </div>
                      </div>
                    )}

                    {/* TAB 2: PRICING & PROFIT */}
                    {activeFormTab === 'pricing' && (
                      <div className="space-y-4">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div className="space-y-1">
                            <label className="text-[10px] uppercase tracking-wider font-bold text-neutral-200">
                              Giá vốn định mức (VNĐ)
                            </label>
                            <input
                              type="number"
                              min="0"
                              value={formFields.costPrice}
                              onChange={(e) => {
                                setFormFields((prev) => ({ ...prev, costPrice: e.target.value }));
                                setIsFormDirty(true);
                              }}
                              placeholder="VD: 25000"
                              className="w-full bg-black border border-white/10 p-2.5 text-xs text-white font-mono font-bold focus:outline-none focus:border-amber-400"
                            />
                            <p className="text-[9px] text-neutral-500">Giá vốn nguyên phụ liệu cấu thành</p>
                          </div>

                          <div className="space-y-1">
                            <label className="text-[10px] uppercase tracking-wider font-bold text-neutral-200">
                              Giá bán niêm yết (VNĐ) <span className="text-rose-400">*</span>
                            </label>
                            <input
                              type="number"
                              min="1"
                              value={formFields.price}
                              onChange={(e) => {
                                setFormFields((prev) => ({ ...prev, price: e.target.value }));
                                setIsFormDirty(true);
                                if (formErrors.price) setFormErrors((prev) => ({ ...prev, price: undefined }));
                              }}
                              placeholder="VD: 69000"
                              className={`w-full bg-black border p-2.5 text-xs text-white font-mono font-bold focus:outline-none ${
                                formErrors.price ? 'border-rose-500' : 'border-white/10 focus:border-amber-400'
                              }`}
                              required
                            />
                            {formErrors.price && <p className="text-[10px] text-rose-400 font-bold">{formErrors.price}</p>}
                          </div>
                        </div>

                        {/* Real-time Profit Calculation Card */}
                        <div className="border border-white/10 bg-white/[0.02] p-3.5 space-y-2">
                          <div className="text-[10px] font-black uppercase tracking-wider text-amber-300">
                            Phân tích lợi nhuận tức thời
                          </div>
                          <div className="grid grid-cols-3 gap-3 text-center">
                            <div>
                              <span className="text-[9px] text-neutral-400 block">Doanh thu bán</span>
                              <span className="font-mono text-xs font-bold text-white">{formatVnd(formSellingPrice)}</span>
                            </div>
                            <div>
                              <span className="text-[9px] text-neutral-400 block">Lợi nhuận gộp (Gross)</span>
                              <span className={`font-mono text-xs font-bold ${formGrossProfit >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                                {formatVnd(formGrossProfit)}
                              </span>
                            </div>
                            <div>
                              <span className="text-[9px] text-neutral-400 block">Biên lợi nhuận (Margin)</span>
                              <span className={`font-mono text-xs font-bold ${formMarginPercent >= 30 ? 'text-emerald-400' : 'text-amber-400'}`}>
                                {formMarginPercent}%
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* TAB 3: COMBO BUILDER (If Combo) */}
                    {activeFormTab === 'combo' && formKind === 'combo' && (
                      <div className="space-y-3">
                        <FoodComboBuilder
                          availableItems={foodItems}
                          comboItems={comboRecipeItems}
                          onChangeComboItems={(items) => {
                            setComboRecipeItems(items);
                            setIsFormDirty(true);
                            if (formErrors.comboItems) setFormErrors((prev) => ({ ...prev, comboItems: undefined }));
                          }}
                          comboPrice={formFields.price}
                        />
                        {formErrors.comboItems && (
                          <p className="text-[10px] text-rose-400 font-bold">{formErrors.comboItems}</p>
                        )}
                      </div>
                    )}

                    {/* TAB 3: INVENTORY (If Single Item) */}
                    {activeFormTab === 'inventory' && formKind === 'item' && (
                      <div className="space-y-4">
                        <div className="flex items-center justify-between border border-white/10 p-3 bg-black">
                          <div>
                            <span className="text-xs font-black uppercase tracking-wider text-white block">
                              Quản lý tồn kho tự động
                            </span>
                            <span className="text-[10px] text-neutral-400">
                              Hệ thống tự động trừ kho khi bán và cảnh báo khi sắp hết
                            </span>
                          </div>
                          <input
                            type="checkbox"
                            checked={formFields.stockTracking}
                            onChange={(e) => {
                              setFormFields((prev) => ({ ...prev, stockTracking: e.target.checked }));
                              setIsFormDirty(true);
                            }}
                            className="h-5 w-5 rounded-none border-white/20 text-amber-500 focus:ring-0 cursor-pointer"
                          />
                        </div>

                        {formFields.stockTracking && (
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div className="space-y-1">
                              <label className="text-[10px] uppercase tracking-wider font-bold text-neutral-200">
                                Ngưỡng cảnh báo sắp hết (Low Stock)
                              </label>
                              <input
                                type="number"
                                min="0"
                                value={formFields.lowStockThreshold}
                                onChange={(e) => {
                                  setFormFields((prev) => ({ ...prev, lowStockThreshold: e.target.value }));
                                  setIsFormDirty(true);
                                }}
                                className="w-full bg-black border border-white/10 p-2.5 text-xs text-white font-mono font-bold focus:outline-none focus:border-amber-400"
                              />
                              <p className="text-[9px] text-neutral-500">Dưới mức này sẽ hiển thị cảnh báo LOW STOCK</p>
                            </div>

                            {!editingItem && (
                              <div className="space-y-1">
                                <label className="text-[10px] uppercase tracking-wider font-bold text-neutral-200">
                                  Tồn kho nhập ban đầu (Toàn rạp)
                                </label>
                                <input
                                  type="number"
                                  min="0"
                                  value={formFields.initialStock}
                                  onChange={(e) => {
                                    setFormFields((prev) => ({ ...prev, initialStock: e.target.value }));
                                    setIsFormDirty(true);
                                  }}
                                  placeholder="VD: 50"
                                  className="w-full bg-black border border-white/10 p-2.5 text-xs text-white font-mono font-bold focus:outline-none focus:border-amber-400"
                                />
                                <p className="text-[9px] text-neutral-500">Tự động khởi tạo tồn cho từng chi nhánh rạp</p>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )}

                    {/* TAB 4: MEDIA & SELLING STATUS */}
                    {activeFormTab === 'media' && (
                      <div className="space-y-4">
                        {/* Status selection */}
                        <div className="space-y-1">
                          <label className="text-[10px] uppercase tracking-wider font-bold text-neutral-200">
                            Trạng thái bán
                          </label>
                          <select
                            value={formFields.status}
                            onChange={(e) => {
                              setFormFields((prev) => ({ ...prev, status: e.target.value }));
                              setIsFormDirty(true);
                            }}
                            className="w-full bg-black border border-white/10 p-2.5 text-xs text-white focus:outline-none focus:border-amber-400 font-bold"
                          >
                            <option value="ACTIVE">Mở bán (ACTIVE)</option>
                            <option value="DRAFT">Bản nháp (DRAFT)</option>
                            <option value="INACTIVE">Tạm ngừng bán (INACTIVE)</option>
                          </select>
                        </div>

                        {/* Image upload */}
                        <div className="space-y-2">
                          <label className="text-[10px] uppercase tracking-wider font-bold text-neutral-200">
                            Hình ảnh sản phẩm
                          </label>
                          {formFields.imageUrl && (
                            <div className="border border-white/10 bg-black p-2 flex items-center gap-3">
                              <img
                                src={formFields.imageUrl}
                                alt="Preview"
                                className="h-16 w-16 object-cover border border-white/10 bg-neutral-900"
                                referrerPolicy="no-referrer"
                              />
                              <div className="min-w-0 flex-1">
                                <p className="text-[10px] text-white font-mono truncate">{formFields.imageUrl}</p>
                                <button
                                  type="button"
                                  onClick={() => setFormFields((prev) => ({ ...prev, imageUrl: '' }))}
                                  className="text-[9px] text-rose-400 hover:underline mt-1"
                                >
                                  Gỡ ảnh này
                                </button>
                              </div>
                            </div>
                          )}

                          <label className="flex items-center justify-center gap-2 border border-amber-500/40 bg-amber-500/10 hover:bg-amber-400 hover:text-black text-amber-300 py-3 text-xs font-black uppercase tracking-wider transition cursor-pointer">
                            <input
                              type="file"
                              accept="image/*"
                              onChange={handleUploadImage}
                              disabled={isUploadingImage}
                              className="hidden"
                            />
                            {isUploadingImage ? <RefreshCw className="h-4 w-4 animate-spin" /> : <ImagePlus className="h-4 w-4" />}
                            {isUploadingImage ? 'Đang tải ảnh lên Cloudinary...' : 'Chọn ảnh từ máy tính (Cloudinary)'}
                          </label>
                          <p className="text-[9px] text-neutral-500">Hỗ trợ JPG, PNG, WEBP, tối đa 5 MB.</p>
                        </div>
                      </div>
                    )}

                    {/* Submit Actions */}
                    <div className="flex items-center justify-end gap-3 pt-3 border-t border-white/10">
                      <button
                        type="button"
                        onClick={handleCloseFormModal}
                        className="px-4 py-2.5 border border-white/20 text-neutral-300 hover:text-white text-xs font-black uppercase tracking-widest transition"
                      >
                        Hủy bỏ
                      </button>
                      <button
                        type="submit"
                        disabled={isSaving || isUploadingImage}
                        className="px-6 py-2.5 bg-amber-500 hover:bg-amber-400 text-black font-black text-xs uppercase tracking-widest transition disabled:opacity-60 flex items-center gap-2"
                      >
                        {isSaving ? (
                          <>
                            <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                            Đang lưu...
                          </>
                        ) : (
                          <>
                            <Check className="h-4 w-4" />
                            {editingItem ? 'Lưu thay đổi' : 'Tạo sản phẩm'}
                          </>
                        )}
                      </button>
                    </div>
                  </form>
                </motion.div>
              </div>
            )}
          </AnimatePresence>

          {/* STOCK ADJUSTMENT MODAL */}
          {stockModalItem && (
            <FoodStockAdjustmentModal
              isOpen={Boolean(stockModalItem)}
              onClose={() => setStockModalItem(null)}
              food={stockModalItem}
              token={token}
              cinemas={cinemas}
              showToast={showToast}
              onAdjustSuccess={() => {
                if (fetchFoods) fetchFoods();
                loadSalesSummary();
              }}
            />
          )}

          {/* PRICE HISTORY MODAL */}
          {priceHistoryModalItem && (
            <FoodPriceHistoryModal
              isOpen={Boolean(priceHistoryModalItem)}
              onClose={() => setPriceHistoryModalItem(null)}
              food={priceHistoryModalItem}
              kind={priceHistoryModalItem.kind}
              token={token}
            />
          )}

          {/* CATEGORIES MODAL */}
          <FoodCategoryModal
            isOpen={isCategoryModalOpen}
            onClose={() => setIsCategoryModalOpen(false)}
            token={token}
            showToast={showToast}
            onCategoriesChanged={() => {
              loadCategories();
              if (fetchFoods) fetchFoods();
            }}
          />

          {/* CONFIRMATION MODAL */}
          {confirmModalData && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm">
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="w-full max-w-md border border-rose-500/40 bg-[#0c0c0c] p-6 space-y-4 shadow-2xl"
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 border border-rose-500/30 bg-rose-500/10 text-rose-400">
                    <AlertTriangle className="h-5 w-5" />
                  </div>
                  <h4 className="text-sm font-black uppercase tracking-wider text-white">
                    {confirmModalData.title}
                  </h4>
                </div>
                <p className="text-xs text-neutral-300 leading-relaxed">
                  {confirmModalData.message}
                </p>
                <div className="flex items-center justify-end gap-3 pt-3 border-t border-white/10">
                  <button
                    type="button"
                    onClick={() => setConfirmModalData(null)}
                    className="px-4 py-2 border border-white/20 text-xs font-black uppercase tracking-wider text-neutral-300 hover:text-white"
                  >
                    Hủy
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const fn = confirmModalData.onConfirm;
                      setConfirmModalData(null);
                      if (fn) fn();
                    }}
                    className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white text-xs font-black uppercase tracking-wider"
                  >
                    {confirmModalData.confirmLabel || 'Xác nhận'}
                  </button>
                </div>
              </motion.div>
            </div>
          )}
        </motion.div>
      )}
    </>
  );
}
