import React, { useState, useEffect } from 'react';
import {
  Users, UserPlus, ShieldAlert, CheckCircle2,
  XCircle, RefreshCw, Lock, Mail, Phone, User
} from 'lucide-react';
import { useManagerCinema } from '../../context/ManagerCinemaContext';
import { getStoredAuth, request } from '../../services/authService';
import { useUiStore } from '../../stores/useUiStore';

export default function ManagerStaffPage() {
  const { selectedCinemaId, selectedCinema } = useManagerCinema();
  const showToast = useUiStore((state) => state.showToast);

  const [staffList, setStaffList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    phone: '',
    password: ''
  });

  const token = () => getStoredAuth().accessToken;

  const loadStaff = async () => {
    if (!selectedCinemaId) return;
    setLoading(true);
    try {
      const data = await request(`/api/v1/manager/cinemas/${selectedCinemaId}/staff`, { token: token() });
      setStaffList(Array.isArray(data) ? data : []);
    } catch (err) {
      showToast(err.message || 'Không thể tải danh sách nhân viên rạp', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadStaff();
  }, [selectedCinemaId]);

  const handleCreateStaff = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await request(`/api/v1/manager/cinemas/${selectedCinemaId}/staff`, {
        method: 'POST',
        token: token(),
        body: {
          fullName: formData.fullName.trim(),
          email: formData.email.trim(),
          phone: formData.phone.trim(),
          password: formData.password
        }
      });
      showToast('Đã tạo tài khoản nhân viên thành công', 'success');
      setCreateModalOpen(false);
      setFormData({ fullName: '', email: '', phone: '', password: '' });
      loadStaff();
    } catch (err) {
      showToast(err.message || 'Không thể tạo nhân viên', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleToggleStatus = async (staff) => {
    const nextStatus = staff.status === 'ACTIVE' ? 'DISABLED' : 'ACTIVE';
    const actionText = nextStatus === 'ACTIVE' ? 'KÍCH HOẠT LẠI' : 'VÔ HIỆU HÓA';
    if (!window.confirm(`Bạn có chắc muốn ${actionText} nhân viên "${staff.fullName || staff.email}"?`)) {
      return;
    }

    try {
      await request(`/api/v1/manager/cinemas/${selectedCinemaId}/staff/${staff.id}/status`, {
        method: 'PATCH',
        token: token(),
        body: { status: nextStatus }
      });
      showToast(`Đã ${actionText.toLowerCase()} nhân viên thành công`, 'success');
      loadStaff();
    } catch (err) {
      showToast(err.message || 'Lỗi khi thay đổi trạng thái nhân viên', 'error');
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/[0.08] pb-5">
        <div>
          <span className="text-[10px] font-mono uppercase tracking-[0.2em] text-amber-400 font-bold">
            Quản trị nhân sự chi nhánh
          </span>
          <h1 className="text-2xl font-bold tracking-tight text-white mt-1">
            Đội ngũ Nhân viên Rạp ({selectedCinema?.name})
          </h1>
          <p className="text-xs text-neutral-400 mt-0.5">
            Quản lý nhân viên soát vé, bán hàng và vận hành trong phạm vi rạp được phân công.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setCreateModalOpen(true)}
            className="flex items-center gap-2 px-3.5 py-2 bg-amber-500 hover:bg-amber-400 text-black font-semibold rounded-lg text-xs transition-all shadow-lg shadow-amber-500/10"
          >
            <UserPlus className="w-4 h-4" />
            Thêm nhân viên mới
          </button>
        </div>
      </div>

      {/* Privilege Scope Banner */}
      <div className="bg-amber-500/[0.06] border border-amber-500/20 rounded-xl p-4 flex items-center gap-3 text-xs text-amber-200">
        <ShieldAlert className="w-5 h-5 text-amber-400 shrink-0" />
        <div>
          <strong className="text-amber-300">Quy tắc phân quyền (RBAC Policy):</strong>
          <span className="text-neutral-300 ml-1">
            Manager chỉ có quyền tạo và quản lý tài khoản nhân viên (Role: STAFF) thuộc chi nhánh này. Manager không được nâng quyền lên Admin hoặc Manager khác.
          </span>
        </div>
      </div>

      {/* Staff List Table */}
      {loading ? (
        <div className="py-16 text-center text-neutral-400 flex flex-col items-center gap-2">
          <RefreshCw className="w-5 h-5 animate-spin text-amber-400" />
          <p className="text-xs">Đang tải danh sách nhân viên...</p>
        </div>
      ) : staffList.length === 0 ? (
        <div className="py-16 text-center border border-dashed border-white/[0.08] rounded-xl bg-white/[0.01]">
          <Users className="w-10 h-10 text-neutral-600 mx-auto mb-3" />
          <p className="text-sm font-medium text-neutral-300">Chưa có nhân viên nào được phân công tại rạp này</p>
          <p className="text-xs text-neutral-500 mt-1">Bấm "Thêm nhân viên mới" để tạo tài khoản vận hành.</p>
        </div>
      ) : (
        <div className="border border-white/[0.08] rounded-xl overflow-hidden bg-[#121212]">
          <table className="w-full text-left text-xs text-neutral-300">
            <thead className="bg-[#181818] border-b border-white/[0.08] text-[11px] uppercase tracking-wider text-neutral-400">
              <tr>
                <th className="p-3.5">Họ và tên</th>
                <th className="p-3.5">Email liên hệ</th>
                <th className="p-3.5">Số điện thoại</th>
                <th className="p-3.5">Vai trò</th>
                <th className="p-3.5">Trạng thái</th>
                <th className="p-3.5 text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.06]">
              {staffList.map((st) => (
                <tr key={st.id} className="hover:bg-white/[0.02] transition-colors">
                  <td className="p-3.5 font-semibold text-white">
                    {st.fullName || st.name || `Staff #${st.id}`}
                  </td>
                  <td className="p-3.5 font-mono text-neutral-300">
                    {st.email}
                  </td>
                  <td className="p-3.5 font-mono text-neutral-400">
                    {st.phone || '—'}
                  </td>
                  <td className="p-3.5">
                    <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-blue-500/10 text-blue-400 border border-blue-500/20">
                      STAFF
                    </span>
                  </td>
                  <td className="p-3.5">
                    {st.status === 'ACTIVE' ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                        <CheckCircle2 className="w-3 h-3" /> Đang hoạt động
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold bg-rose-500/10 text-rose-400 border border-rose-500/20">
                        <XCircle className="w-3 h-3" /> Đã vô hiệu hóa
                      </span>
                    )}
                  </td>
                  <td className="p-3.5 text-right">
                    <button
                      onClick={() => handleToggleStatus(st)}
                      className={`px-2.5 py-1 text-xs font-medium rounded border transition-colors ${
                        st.status === 'ACTIVE'
                          ? 'border-rose-500/30 text-rose-400 hover:bg-rose-500/10'
                          : 'border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10'
                      }`}
                    >
                      {st.status === 'ACTIVE' ? 'Vô hiệu hóa' : 'Kích hoạt lại'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Create Staff Modal */}
      {createModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="bg-[#181818] border border-white/[0.12] rounded-xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-white/[0.08] pb-3">
              <h3 className="font-semibold text-white flex items-center gap-2 text-sm">
                <UserPlus className="w-4 h-4 text-amber-400" />
                Thêm nhân viên cho rạp {selectedCinema?.name}
              </h3>
              <button
                type="button"
                onClick={() => setCreateModalOpen(false)}
                className="text-neutral-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateStaff} className="space-y-4 text-xs">
              <div>
                <label className="block text-neutral-300 font-medium mb-1">
                  Họ và tên nhân viên *
                </label>
                <input
                  required
                  type="text"
                  placeholder="Ví dụ: Nguyễn Văn A"
                  value={formData.fullName}
                  onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                  className="w-full bg-neutral-900 border border-white/[0.12] rounded-lg p-2.5 text-white outline-none focus:border-amber-400"
                />
              </div>

              <div>
                <label className="block text-neutral-300 font-medium mb-1">
                  Địa chỉ Email đăng nhập *
                </label>
                <input
                  required
                  type="email"
                  placeholder="staff@cinema.vn"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="w-full bg-neutral-900 border border-white/[0.12] rounded-lg p-2.5 text-white outline-none focus:border-amber-400"
                />
              </div>

              <div>
                <label className="block text-neutral-300 font-medium mb-1">
                  Số điện thoại liên hệ
                </label>
                <input
                  type="tel"
                  placeholder="0912345678"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  className="w-full bg-neutral-900 border border-white/[0.12] rounded-lg p-2.5 text-white outline-none focus:border-amber-400"
                />
              </div>

              <div>
                <label className="block text-neutral-300 font-medium mb-1">
                  Mật khẩu khởi tạo *
                </label>
                <input
                  required
                  type="password"
                  minLength={6}
                  placeholder="Tối thiểu 6 ký tự"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  className="w-full bg-neutral-900 border border-white/[0.12] rounded-lg p-2.5 text-white outline-none focus:border-amber-400 font-mono"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-white/[0.08]">
                <button
                  type="button"
                  onClick={() => setCreateModalOpen(false)}
                  className="px-4 py-2 text-neutral-400 hover:text-white transition-colors"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-black font-semibold rounded-lg transition-colors disabled:opacity-50"
                >
                  {saving ? 'Đang tạo...' : 'Tạo tài khoản'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
