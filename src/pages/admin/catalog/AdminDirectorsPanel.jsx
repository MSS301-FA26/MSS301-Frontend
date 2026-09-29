import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Check, ChevronLeft, ChevronRight, Edit3, ImageUp, Plus, Search, Trash2, Clapperboard, X, RefreshCw } from 'lucide-react';
import { adminService } from '../../../services/adminService';

export default function AdminDirectorsPanel({ ctx }) {
  const { getAdminToken, showToast } = ctx || {};
  const [directors, setDirectors] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(0);
  const pageSize = 12;

  // Form State
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingDirector, setEditingDirector] = useState(null);
  const [formData, setFormData] = useState({ name: '', biography: '', avatarUrl: '' });
  const [formErrors, setFormErrors] = useState({});

  const token = () => (typeof getAdminToken === 'function' ? getAdminToken() : null);

  const fetchDirectors = useCallback(async () => {
    const t = token();
    if (!t) return;
    setLoading(true);
    try {
      const data = await adminService.getAdminDirectors(t, { keyword: search || undefined });
      setDirectors(Array.isArray(data) ? data : []);
    } catch (err) {
      if (showToast) showToast(err.message || 'Không thể tải danh sách đạo diễn.');
    } finally {
      setLoading(false);
    }
  }, [search]);

  useEffect(() => {
    fetchDirectors();
  }, [fetchDirectors]);

  const handleOpenAdd = () => {
    setEditingDirector(null);
    setFormData({ name: '', biography: '', avatarUrl: '' });
    setFormErrors({});
    setIsFormOpen(true);
  };

  const handleOpenEdit = (director) => {
    setEditingDirector(director);
    setFormData({
      name: director.name || '',
      biography: director.biography || '',
      avatarUrl: director.avatarUrl || ''
    });
    setFormErrors({});
    setIsFormOpen(true);
  };

  const validate = () => {
    const errs = {};
    if (!formData.name.trim()) errs.name = 'Tên đạo diễn là bắt buộc.';
    if (formData.name.length > 255) errs.name = 'Tên tối đa 255 ký tự.';
    setFormErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;
    const t = token();
    if (!t) return;
    setSaving(true);
    try {
      const payload = {
        name: formData.name.trim(),
        biography: formData.biography.trim(),
        avatarUrl: formData.avatarUrl.trim()
      };
      if (editingDirector) {
        await adminService.updateAdminDirector(t, editingDirector.id, payload);
        if (showToast) showToast('Đã cập nhật thông tin đạo diễn.');
      } else {
        await adminService.createAdminDirector(t, payload);
        if (showToast) showToast('Đã thêm đạo diễn mới thành công.');
      }
      setIsFormOpen(false);
      fetchDirectors();
    } catch (err) {
      if (showToast) showToast(err.message || 'Không thể lưu thông tin đạo diễn.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (director) => {
    if (!window.confirm(`Xác nhận xóa đạo diễn "${director.name}"?`)) return;
    const t = token();
    if (!t) return;
    try {
      await adminService.deleteAdminDirector(t, director.id);
      if (showToast) showToast('Đã xóa đạo diễn thành công.');
      fetchDirectors();
    } catch (err) {
      if (showToast) showToast(err.message || 'Không thể xóa đạo diễn.');
    }
  };

  const filtered = directors.filter((d) =>
    !search || (d.name || '').toLowerCase().includes(search.toLowerCase())
  );

  const paginated = filtered.slice(page * pageSize, (page + 1) * pageSize);
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));

  return (
    <div className="space-y-6">
      {/* Top Header & Actions */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-white/[0.08]">
        <div>
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <Clapperboard className="w-5 h-5 text-amber-400" />
            Quản lý Đạo diễn (Directors Master Data)
          </h2>
          <p className="text-xs text-neutral-400 mt-0.5">Danh mục đạo diễn chuẩn hóa toàn hệ thống cho phim</p>
        </div>
        <div className="flex items-center gap-2.5 w-full sm:w-auto">
          <div className="relative flex-1 sm:w-64">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400 pointer-events-none" />
            <input
              type="text"
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(0); }}
              placeholder="Tìm kiếm đạo diễn..."
              className="w-full bg-[#121212] border border-white/[0.1] rounded-lg pl-8 pr-3 py-1.5 text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-amber-400 transition"
            />
          </div>
          <button
            type="button"
            onClick={fetchDirectors}
            className="p-1.5 rounded-lg border border-white/[0.1] hover:bg-white/[0.05] text-neutral-400 hover:text-white transition"
            title="Làm mới"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-amber-400' : ''}`} />
          </button>
          <button
            type="button"
            onClick={handleOpenAdd}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-400 hover:bg-amber-300 text-black font-semibold text-xs rounded-lg transition"
          >
            <Plus className="w-4 h-4" />
            Thêm đạo diễn
          </button>
        </div>
      </div>

      {/* Grid of Directors */}
      {loading ? (
        <div className="py-20 text-center text-xs text-neutral-400">
          <RefreshCw className="w-6 h-6 animate-spin mx-auto text-amber-400 mb-2" />
          Đang tải danh sách đạo diễn...
        </div>
      ) : paginated.length === 0 ? (
        <div className="py-20 text-center text-neutral-500 text-xs border border-white/[0.05] rounded-xl bg-black/30">
          Không tìm thấy đạo diễn nào phù hợp.
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
          {paginated.map((director) => (
            <div
              key={director.id}
              className="group relative bg-[#121212] border border-white/[0.08] hover:border-amber-400/40 rounded-xl p-3 flex flex-col items-center text-center transition duration-200"
            >
              <div className="w-20 h-20 rounded-full overflow-hidden bg-neutral-800 border border-white/[0.1] mb-2.5 relative shrink-0">
                {director.avatarUrl ? (
                  <img src={director.avatarUrl} alt={director.name} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center font-bold text-amber-400 text-base">
                    {director.name?.charAt(0)?.toUpperCase() || 'D'}
                  </div>
                )}
              </div>
              <h3 className="text-xs font-semibold text-white truncate max-w-full leading-tight">
                {director.name}
              </h3>
              <p className="text-[10px] text-neutral-400 line-clamp-2 mt-1 leading-normal">
                {director.biography || 'Chưa có tiểu sử.'}
              </p>
              <div className="mt-3 flex items-center gap-1.5 opacity-90 sm:opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                  type="button"
                  onClick={() => handleOpenEdit(director)}
                  className="p-1 rounded bg-white/[0.06] hover:bg-amber-400/20 text-neutral-300 hover:text-amber-300 transition"
                  title="Chỉnh sửa"
                >
                  <Edit3 className="w-3 h-3" />
                </button>
                <button
                  type="button"
                  onClick={() => handleDelete(director)}
                  className="p-1 rounded bg-white/[0.06] hover:bg-rose-500/20 text-neutral-300 hover:text-rose-400 transition"
                  title="Xóa"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between pt-4 border-t border-white/[0.08] text-xs text-neutral-400">
          <span>Tổng {filtered.length} đạo diễn • Trang {page + 1}/{totalPages}</span>
          <div className="flex items-center gap-1">
            <button
              type="button"
              disabled={page === 0}
              onClick={() => setPage((p) => p - 1)}
              className="p-1.5 rounded border border-white/[0.08] disabled:opacity-40 hover:bg-white/[0.05]"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              type="button"
              disabled={page >= totalPages - 1}
              onClick={() => setPage((p) => p + 1)}
              className="p-1.5 rounded border border-white/[0.08] disabled:opacity-40 hover:bg-white/[0.05]"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Modal Add / Edit */}
      <AnimatePresence>
        {isFormOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="w-full max-w-md bg-[#161616] border border-white/[0.12] rounded-2xl p-5 shadow-2xl space-y-4"
            >
              <div className="flex items-center justify-between border-b border-white/[0.08] pb-3">
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <Clapperboard className="w-4 h-4 text-amber-400" />
                  {editingDirector ? 'Chỉnh sửa Đạo diễn' : 'Thêm Đạo diễn mới'}
                </h3>
                <button
                  type="button"
                  onClick={() => setIsFormOpen(false)}
                  className="p-1 text-neutral-400 hover:text-white rounded"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="space-y-3.5 text-xs">
                <div>
                  <label className="block text-[11px] font-semibold text-neutral-300 mb-1">
                    Tên đạo diễn <span className="text-rose-400">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="Ví dụ: Christopher Nolan, Victor Vũ..."
                    className={`w-full bg-[#0d0d0d] border ${formErrors.name ? 'border-rose-500' : 'border-white/[0.1]'} rounded-lg px-3 py-2 text-white focus:outline-none focus:border-amber-400`}
                  />
                  {formErrors.name && <p className="text-[10px] text-rose-400 mt-1">{formErrors.name}</p>}
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-neutral-300 mb-1">
                    URL Ảnh đại diện
                  </label>
                  <input
                    type="text"
                    value={formData.avatarUrl}
                    onChange={(e) => setFormData({ ...formData, avatarUrl: e.target.value })}
                    placeholder="https://..."
                    className="w-full bg-[#0d0d0d] border border-white/[0.1] rounded-lg px-3 py-2 text-white focus:outline-none focus:border-amber-400"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-neutral-300 mb-1">
                    Tiểu sử tóm tắt
                  </label>
                  <textarea
                    rows={3}
                    value={formData.biography}
                    onChange={(e) => setFormData({ ...formData, biography: e.target.value })}
                    placeholder="Giới thiệu vắn tắt về phong cách đạo diễn, các tác phẩm tiêu biểu..."
                    className="w-full bg-[#0d0d0d] border border-white/[0.1] rounded-lg px-3 py-2 text-white focus:outline-none focus:border-amber-400 resize-none"
                  />
                </div>

                <div className="flex items-center justify-end gap-2 pt-3 border-t border-white/[0.08]">
                  <button
                    type="button"
                    onClick={() => setIsFormOpen(false)}
                    className="px-3 py-2 rounded-lg border border-white/[0.1] hover:bg-white/[0.05] text-neutral-300 transition"
                  >
                    Hủy
                  </button>
                  <button
                    type="submit"
                    disabled={saving}
                    className="px-4 py-2 bg-amber-400 hover:bg-amber-300 disabled:opacity-50 text-black font-semibold rounded-lg transition"
                  >
                    {saving ? 'Đang lưu...' : editingDirector ? 'Cập nhật' : 'Tạo mới'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
