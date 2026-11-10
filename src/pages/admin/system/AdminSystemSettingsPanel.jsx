import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Sliders, Plus, Edit3, Trash2, Search, RefreshCw, X, Save, ShieldAlert } from 'lucide-react';
import { adminService } from '../../../services/adminService';

export default function AdminSystemSettingsPanel({ ctx }) {
  const { getAdminToken, showToast } = ctx || {};
  const [settings, setSettings] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');

  // Form State
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingSetting, setEditingSetting] = useState(null);
  const [formData, setFormData] = useState({ configKey: '', configValue: '', description: '' });
  const [formErrors, setFormErrors] = useState({});

  const token = () => (typeof getAdminToken === 'function' ? getAdminToken() : null);

  const fetchSettings = useCallback(async () => {
    const t = token();
    if (!t) return;
    setLoading(true);
    try {
      const data = await adminService.getAdminSystemSettings(t);
      setSettings(Array.isArray(data) ? data : []);
    } catch (err) {
      if (showToast) showToast(err.message || 'Không thể tải cấu hình hệ thống.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  const handleOpenAdd = () => {
    setEditingSetting(null);
    setFormData({ configKey: '', configValue: '', description: '' });
    setFormErrors({});
    setIsFormOpen(true);
  };

  const handleOpenEdit = (setting) => {
    setEditingSetting(setting);
    setFormData({
      configKey: setting.configKey || '',
      configValue: setting.configValue || '',
      description: setting.description || ''
    });
    setFormErrors({});
    setIsFormOpen(true);
  };

  const validate = () => {
    const errs = {};
    if (!formData.configKey.trim()) errs.configKey = 'Mã cấu hình (Config Key) là bắt buộc.';
    if (!formData.configValue.trim()) errs.configValue = 'Giá trị cấu hình (Config Value) là bắt buộc.';
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
        configKey: formData.configKey.trim(),
        configValue: formData.configValue.trim(),
        description: formData.description.trim()
      };
      if (editingSetting) {
        await adminService.updateAdminSystemSetting(t, editingSetting.id, payload);
        if (showToast) showToast('Đã cập nhật cấu hình hệ thống.');
      } else {
        await adminService.createAdminSystemSetting(t, payload);
        if (showToast) showToast('Đã thêm cấu hình hệ thống mới thành công.');
      }
      setIsFormOpen(false);
      fetchSettings();
    } catch (err) {
      if (showToast) showToast(err.message || 'Không thể lưu cấu hình.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (setting) => {
    if (!window.confirm(`Xác nhận xóa cấu hình "${setting.configKey}"?`)) return;
    const t = token();
    if (!t) return;
    try {
      await adminService.deleteAdminSystemSetting(t, setting.id);
      if (showToast) showToast('Đã xóa cấu hình thành công.');
      fetchSettings();
    } catch (err) {
      if (showToast) showToast(err.message || 'Không thể xóa cấu hình.');
    }
  };

  const filtered = settings.filter((s) =>
    !search ||
    (s.configKey || '').toLowerCase().includes(search.toLowerCase()) ||
    (s.description || '').toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-white/[0.08]">
        <div>
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <Sliders className="w-5 h-5 text-amber-400" />
            Cấu hình Hệ thống (System Settings)
          </h2>
          <p className="text-xs text-neutral-400 mt-0.5">Quản lý tham số vận hành toàn cục hệ thống (ADMIN Only)</p>
        </div>
        <div className="flex items-center gap-2.5 w-full sm:w-auto">
          <div className="relative flex-1 sm:w-64">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400 pointer-events-none" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Tìm theo mã hoặc mô tả..."
              className="w-full bg-[#121212] border border-white/[0.1] rounded-lg pl-8 pr-3 py-1.5 text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-amber-400 transition"
            />
          </div>
          <button
            type="button"
            onClick={fetchSettings}
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
            Thêm cấu hình
          </button>
        </div>
      </div>

      {/* Table */}
      {loading ? (
        <div className="py-20 text-center text-xs text-neutral-400">
          <RefreshCw className="w-6 h-6 animate-spin mx-auto text-amber-400 mb-2" />
          Đang tải cấu hình hệ thống...
        </div>
      ) : filtered.length === 0 ? (
        <div className="py-20 text-center text-neutral-500 text-xs border border-white/[0.05] rounded-xl bg-black/30">
          Chưa có tham số cấu hình nào.
        </div>
      ) : (
        <div className="border border-white/[0.08] rounded-xl overflow-hidden bg-[#101010]">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#181818] border-b border-white/[0.08] text-[10px] font-mono uppercase tracking-wider text-neutral-400">
              <tr>
                <th className="px-4 py-3">Config Key</th>
                <th className="px-4 py-3">Config Value</th>
                <th className="px-4 py-3">Mô tả</th>
                <th className="px-4 py-3">Người cập nhật</th>
                <th className="px-4 py-3 text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.04]">
              {filtered.map((setting) => (
                <tr key={setting.id} className="hover:bg-white/[0.02] transition">
                  <td className="px-4 py-3 font-mono font-bold text-amber-400">
                    {setting.configKey}
                  </td>
                  <td className="px-4 py-3 font-mono text-neutral-200 max-w-xs truncate">
                    {setting.configValue}
                  </td>
                  <td className="px-4 py-3 text-neutral-400">
                    {setting.description || '—'}
                  </td>
                  <td className="px-4 py-3 text-[11px] text-neutral-400">
                    {setting.updatedBy || 'ADMIN'}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-1.5">
                      <button
                        type="button"
                        onClick={() => handleOpenEdit(setting)}
                        className="p-1 rounded bg-white/[0.06] hover:bg-amber-400/20 text-neutral-300 hover:text-amber-300 transition"
                        title="Chỉnh sửa"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(setting)}
                        className="p-1 rounded bg-white/[0.06] hover:bg-rose-500/20 text-neutral-300 hover:text-rose-400 transition"
                        title="Xóa"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
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
                  <Sliders className="w-4 h-4 text-amber-400" />
                  {editingSetting ? 'Cập nhật Cấu hình' : 'Thêm Cấu hình mới'}
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
                    Config Key <span className="text-rose-400">*</span>
                  </label>
                  <input
                    type="text"
                    disabled={!!editingSetting}
                    value={formData.configKey}
                    onChange={(e) => setFormData({ ...formData, configKey: e.target.value })}
                    placeholder="Ví dụ: BOOKING_HOLD_TIMEOUT_MINUTES..."
                    className={`w-full bg-[#0d0d0d] border ${formErrors.configKey ? 'border-rose-500' : 'border-white/[0.1]'} rounded-lg px-3 py-2 text-white font-mono focus:outline-none focus:border-amber-400 disabled:opacity-50`}
                  />
                  {formErrors.configKey && <p className="text-[10px] text-rose-400 mt-1">{formErrors.configKey}</p>}
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-neutral-300 mb-1">
                    Config Value <span className="text-rose-400">*</span>
                  </label>
                  <textarea
                    rows={3}
                    value={formData.configValue}
                    onChange={(e) => setFormData({ ...formData, configValue: e.target.value })}
                    placeholder="Giá trị chuỗi, số hoặc JSON..."
                    className={`w-full bg-[#0d0d0d] border ${formErrors.configValue ? 'border-rose-500' : 'border-white/[0.1]'} rounded-lg px-3 py-2 text-white font-mono focus:outline-none focus:border-amber-400 resize-none`}
                  />
                  {formErrors.configValue && <p className="text-[10px] text-rose-400 mt-1">{formErrors.configValue}</p>}
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-neutral-300 mb-1">
                    Mô tả
                  </label>
                  <input
                    type="text"
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    placeholder="Mô tả ý nghĩa của tham số cấu hình này..."
                    className="w-full bg-[#0d0d0d] border border-white/[0.1] rounded-lg px-3 py-2 text-white focus:outline-none focus:border-amber-400"
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
                    {saving ? 'Đang lưu...' : editingSetting ? 'Cập nhật' : 'Tạo mới'}
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
