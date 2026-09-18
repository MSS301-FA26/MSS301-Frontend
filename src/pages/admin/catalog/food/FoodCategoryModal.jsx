import React from 'react';
import { motion } from 'motion/react';
import { X, Plus, Edit3, Trash2, Check, RefreshCw, Folder, RotateCcw } from 'lucide-react';
import { adminService } from '../../../../services/adminService';

export default function FoodCategoryModal({
  isOpen,
  onClose,
  token,
  onCategoriesChanged,
  showToast
}) {
  const [categories, setCategories] = React.useState([]);
  const [isLoading, setIsLoading] = React.useState(false);
  const [isSaving, setIsSaving] = React.useState(false);
  const [editingCategory, setEditingCategory] = React.useState(null);
  const [form, setForm] = React.useState({ code: '', name: '', description: '', sortOrder: 0 });

  React.useEffect(() => {
    if (isOpen && token) {
      loadCategories();
      resetForm();
    }
    if (!isOpen) return;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, token]);

  const loadCategories = async () => {
    setIsLoading(true);
    try {
      const data = await adminService.getAdminFoodCategories(token);
      setCategories(Array.isArray(data) ? data : []);
    } catch {
      setCategories([]);
    } finally {
      setIsLoading(false);
    }
  };

  const resetForm = () => {
    setEditingCategory(null);
    setForm({ code: '', name: '', description: '', sortOrder: (categories.length + 1) });
  };

  const handleEdit = (cat) => {
    setEditingCategory(cat);
    setForm({
      code: cat.code || '',
      name: cat.name || '',
      description: cat.description || '',
      sortOrder: cat.sortOrder || 0
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.code.trim() || !form.name.trim()) {
      showToast('Mã danh mục và tên danh mục là bắt buộc.');
      return;
    }

    setIsSaving(true);
    try {
      const payload = {
        code: form.code.trim().toUpperCase(),
        name: form.name.trim(),
        description: form.description.trim(),
        sortOrder: Number(form.sortOrder) || 0
      };

      if (editingCategory) {
        await adminService.updateAdminFoodCategory(token, editingCategory.id, payload);
        showToast(`Đã cập nhật danh mục: ${payload.name}`);
      } else {
        await adminService.createAdminFoodCategory(token, payload);
        showToast(`Đã tạo danh mục mới: ${payload.name}`);
      }

      resetForm();
      await loadCategories();
      if (onCategoriesChanged) onCategoriesChanged();
    } catch (err) {
      showToast(err.message || 'Không thể lưu danh mục.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (cat) => {
    if (!window.confirm(`Xóa danh mục "${cat.name}"? Danh mục chỉ được xóa nếu không có món ăn nào đang sử dụng.`)) return;
    try {
      await adminService.deleteAdminFoodCategory(token, cat.id);
      showToast(`Đã xóa danh mục: ${cat.name}`);
      await loadCategories();
      if (onCategoriesChanged) onCategoriesChanged();
    } catch (err) {
      showToast(err.message || 'Không thể xóa danh mục.');
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm overflow-y-auto"
      onClick={onClose}
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
              <Folder className="h-5 w-5" />
            </div>
            <div>
              <span className="text-[9px] font-mono uppercase tracking-[0.2em] text-neutral-400 font-black">
                F&amp;B CATEGORIES
              </span>
              <h3 className="text-sm font-black uppercase tracking-[0.16em] text-white mt-0.5">
                Quản lý danh mục bắp nước &amp; combo
              </h3>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-neutral-400 hover:text-white border border-white/10 hover:border-white/30 transition"
            title="Đóng cửa sổ"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Layout: Form + List */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-5">
          {/* Create / Edit Form */}
          <div className="md:col-span-2 space-y-3 border-b md:border-b-0 md:border-r border-white/10 pb-4 md:pb-0 md:pr-5">
            <h4 className="text-xs font-black uppercase tracking-wider text-amber-300">
              {editingCategory ? 'Sửa danh mục' : 'Thêm danh mục mới'}
            </h4>
            <form onSubmit={handleSubmit} className="space-y-3">
              <div className="space-y-1">
                <label className="text-[9px] font-bold uppercase tracking-wider text-neutral-300">
                  Mã danh mục (CODE) <span className="text-rose-400">*</span>
                </label>
                <input
                  value={form.code}
                  onChange={(e) => setForm((prev) => ({ ...prev, code: e.target.value.toUpperCase() }))}
                  placeholder="VD: POPCORN, DRINK..."
                  className="w-full bg-black border border-white/10 p-2 text-xs text-white font-mono font-bold focus:outline-none focus:border-amber-400"
                  required
                />
              </div>

              <div className="space-y-1">
                <label className="text-[9px] font-bold uppercase tracking-wider text-neutral-300">
                  Tên danh mục <span className="text-rose-400">*</span>
                </label>
                <input
                  value={form.name}
                  onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
                  placeholder="VD: Bắp rang bơ, Nước ngọt..."
                  className="w-full bg-black border border-white/10 p-2 text-xs text-white font-bold focus:outline-none focus:border-amber-400"
                  required
                />
              </div>

              <div className="space-y-1">
                <label className="text-[9px] font-bold uppercase tracking-wider text-neutral-300">
                  Thứ tự hiển thị
                </label>
                <input
                  type="number"
                  min="0"
                  value={form.sortOrder}
                  onChange={(e) => setForm((prev) => ({ ...prev, sortOrder: e.target.value }))}
                  className="w-full bg-black border border-white/10 p-2 text-xs text-white font-mono focus:outline-none focus:border-amber-400"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[9px] font-bold uppercase tracking-wider text-neutral-300">
                  Mô tả
                </label>
                <textarea
                  rows={2}
                  value={form.description}
                  onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))}
                  placeholder="Mô tả danh mục..."
                  className="w-full bg-black border border-white/10 p-2 text-xs text-white focus:outline-none focus:border-amber-400 resize-none"
                />
              </div>

              <div className="flex items-center gap-2 pt-2">
                {editingCategory && (
                  <button
                    type="button"
                    onClick={resetForm}
                    className="flex-1 py-2 border border-white/20 text-neutral-400 hover:text-white text-[10px] font-black uppercase tracking-wider transition"
                  >
                    Hủy sửa
                  </button>
                )}
                <button
                  type="submit"
                  disabled={isSaving}
                  className="flex-1 py-2 bg-amber-500 hover:bg-amber-400 text-black font-black text-[10px] uppercase tracking-wider transition flex items-center justify-center gap-1.5 disabled:opacity-60"
                >
                  {isSaving ? <RefreshCw className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
                  {editingCategory ? 'Lưu' : 'Tạo mới'}
                </button>
              </div>
            </form>
          </div>

          {/* Categories List */}
          <div className="md:col-span-3 space-y-3">
            <h4 className="text-xs font-black uppercase tracking-wider text-neutral-300">
              Danh sách hiện có ({categories.length})
            </h4>

            {isLoading ? (
              <p className="text-xs text-neutral-400 py-6 text-center">Đang tải danh mục...</p>
            ) : categories.length > 0 ? (
              <div className="max-h-72 overflow-y-auto border border-white/10 divide-y divide-white/[0.05]">
                {categories.map((cat) => (
                  <div key={cat.id} className="p-3 flex items-center justify-between hover:bg-white/[0.02] transition">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-black text-white">{cat.name}</span>
                        <span className="font-mono text-[9px] px-1.5 py-0.5 bg-white/10 text-amber-300 font-bold border border-white/10">
                          {cat.code}
                        </span>
                        <span className="text-[10px] text-neutral-500 font-mono">
                          ({cat.productCount || 0} món)
                        </span>
                      </div>
                      <p className="text-[10px] text-neutral-400 mt-0.5">{cat.description || 'Chưa có mô tả'}</p>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        type="button"
                        onClick={() => handleEdit(cat)}
                        className="p-1.5 text-amber-300 border border-amber-500/30 bg-amber-500/10 hover:bg-amber-400 hover:text-black transition"
                        title="Sửa danh mục"
                      >
                        <Edit3 className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(cat)}
                        className="p-1.5 text-rose-400 border border-rose-500/20 bg-rose-500/10 hover:bg-rose-500 hover:text-black transition"
                        title="Xóa danh mục"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-neutral-500 py-6 text-center">Chưa có danh mục nào.</p>
            )}
          </div>
        </div>

        <div className="pt-3 border-t border-white/10 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2.5 border border-white/20 text-neutral-300 hover:text-white text-xs font-black uppercase tracking-widest transition"
          >
            Hoàn tất
          </button>
        </div>
      </motion.div>
    </div>
  );
}
