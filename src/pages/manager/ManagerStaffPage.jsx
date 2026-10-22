import React, { useState, useEffect } from 'react';
import {
  Users, UserPlus, ShieldAlert, CheckCircle2,
  XCircle, RefreshCw, Lock, Mail, Phone, User,
  Check, Send, Eye, EyeOff
} from 'lucide-react';
import { useManagerCinema } from '../../context/ManagerCinemaContext';
import { getStoredAuth, request } from '../../services/authService';
import { adminService } from '../../services/adminService';
import { useUiStore } from '../../stores/useUiStore';
import {
  PASSWORD_VALIDATION_MESSAGE,
  isStrongPassword,
  getPasswordValidationState,
  validateBirthYear18Plus,
  normalizeAuthErrorMessage
} from '../../utils/validation';

const PasswordRequirements = ({ password }) => {
  const state = getPasswordValidationState(password);
  if (!password) return null;
  const items = [
    { label: 'Tối thiểu 8 ký tự', ok: state.hasLength },
    { label: 'Chữ hoa (A-Z)', ok: state.hasUpper },
    { label: 'Chữ thường (a-z)', ok: state.hasLower },
    { label: 'Chữ số (0-9)', ok: state.hasDigit },
    { label: 'Ký tự đặc biệt (!@#$...)', ok: state.hasSpecial }
  ];
  return (
    <div className="mt-2 flex flex-wrap gap-1 text-[8.5px]">
      {items.map((item, idx) => (
        <span
          key={idx}
          className={`flex items-center gap-1 rounded px-1.5 py-0.5 font-medium transition-colors ${
            item.ok
              ? 'border border-emerald-500/40 bg-emerald-950/60 text-emerald-300'
              : 'border border-white/5 bg-neutral-900 text-neutral-400'
          }`}
        >
          <span>{item.ok ? '✓' : '•'}</span>
          {item.label}
        </span>
      ))}
    </div>
  );
};

export default function ManagerStaffPage() {
  const { selectedCinemaId, selectedCinema } = useManagerCinema();
  const showToast = useUiStore((state) => state.showToast);

  const [staffList, setStaffList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    phone: '',
    birthYear: '',
    password: ''
  });

  // OTP verification state
  const [emailVerified, setEmailVerified] = useState(false);
  const [verifiedEmail, setVerifiedEmail] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [otpInput, setOtpInput] = useState('');
  const [otpLoading, setOtpLoading] = useState(false);
  const [otpVerifying, setOtpVerifying] = useState(false);
  const [otpCountdown, setOtpCountdown] = useState(0);
  const [otpNotice, setOtpNotice] = useState('');

  useEffect(() => {
    if (otpCountdown <= 0) return undefined;
    const timer = setInterval(() => setOtpCountdown((prev) => prev - 1), 1000);
    return () => clearInterval(timer);
  }, [otpCountdown]);

  const token = () => getStoredAuth().accessToken;

  const handleSendOtp = async () => {
    const email = formData.email.trim();
    if (!email) {
      showToast('Vui lòng nhập email trước khi gửi mã OTP', 'error');
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      showToast('Email không đúng định dạng', 'error');
      return;
    }
    setOtpLoading(true);
    setOtpNotice('');
    try {
      const res = await adminService.requestProvisionOtp(token(), email);
      setOtpSent(true);
      setOtpCountdown(60);
      const msg = res?.message || `Mã OTP đã được gửi tới email ${email}.`;
      setOtpNotice(msg);
      showToast(msg, 'success');
    } catch (err) {
      const msg = normalizeAuthErrorMessage(err.message || 'Không thể gửi mã OTP. Vui lòng thử lại.');
      setOtpNotice(msg);
      showToast(msg, 'error');
    } finally {
      setOtpLoading(false);
    }
  };

  const handleVerifyOtp = async () => {
    const email = formData.email.trim();
    const otp = otpInput.trim();
    if (!otp) {
      setOtpNotice('Vui lòng nhập mã OTP 6 số');
      return;
    }
    setOtpVerifying(true);
    try {
      await adminService.verifyProvisionOtp(token(), email, otp);
      setEmailVerified(true);
      setVerifiedEmail(email);
      setOtpNotice('✓ Email đã được xác thực OTP thành công!');
      showToast('Xác thực email thành công!', 'success');
    } catch (err) {
      const msg = err.message || 'Mã OTP không chính xác hoặc đã hết hạn.';
      setOtpNotice(msg);
      showToast(msg, 'error');
    } finally {
      setOtpVerifying(false);
    }
  };

  const loadStaff = async () => {
    if (!selectedCinemaId) return;
    setLoading(true);
    try {
      const data = await request(`/api/v1/admin/users?role=STAFF`, { token: token() });
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
    const email = formData.email.trim();
    if (!email) {
      showToast('Vui lòng nhập email', 'error');
      return;
    }
    if (!emailVerified || verifiedEmail.toLowerCase() !== email.toLowerCase()) {
      showToast('Vui lòng gửi mã OTP và xác thực email trước khi cấp tài khoản.', 'error');
      return;
    }

    const birthValidation = validateBirthYear18Plus(formData.birthYear);
    if (!birthValidation.isValid) {
      showToast(birthValidation.message, 'error');
      return;
    }

    if (!isStrongPassword(formData.password)) {
      showToast(PASSWORD_VALIDATION_MESSAGE, 'error');
      return;
    }

    setSaving(true);
    try {
      await request(`/api/v1/admin/users/staff`, {
        method: 'POST',
        token: token(),
        body: {
          fullName: formData.fullName.trim(),
          email,
          phone: formData.phone.trim() || null,
          birthYear: Number(formData.birthYear),
          password: formData.password
        }
      });
      showToast('Đã tạo tài khoản nhân viên thành công', 'success');
      setCreateModalOpen(false);
      setFormData({ fullName: '', email: '', phone: '', birthYear: '', password: '' });
      setEmailVerified(false);
      setVerifiedEmail('');
      setOtpSent(false);
      setOtpInput('');
      setOtpNotice('');
      loadStaff();
    } catch (err) {
      showToast(normalizeAuthErrorMessage(err.message || 'Không thể tạo nhân viên'), 'error');
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
      await request(`/api/v1/admin/users/${staff.id}/status`, {
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
    <div className="workspace-container py-6 space-y-6">
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

              {/* Email đăng nhập & OTP */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-neutral-300 font-medium">
                    Địa chỉ Email đăng nhập *
                  </label>
                  {emailVerified && (
                    <span className="inline-flex items-center gap-1 rounded border border-emerald-500/40 bg-emerald-950/60 px-1.5 py-0.5 text-[8.5px] font-bold text-emerald-300">
                      <Check className="h-3 w-3 text-emerald-400" /> Đã xác thực
                    </span>
                  )}
                </div>
                <div className="flex gap-2">
                  <input
                    required
                    type="email"
                    placeholder="staff@cinema.vn"
                    value={formData.email}
                    onChange={(e) => {
                      const val = e.target.value;
                      setFormData({ ...formData, email: val });
                      if (val.trim().toLowerCase() !== verifiedEmail.toLowerCase()) {
                        setEmailVerified(false);
                        setOtpNotice('');
                      }
                    }}
                    className={`w-full flex-1 bg-neutral-900 border rounded-lg p-2.5 text-white outline-none focus:border-amber-400 ${emailVerified ? 'border-emerald-500/50' : 'border-white/[0.12]'}`}
                  />
                  <button
                    type="button"
                    onClick={handleSendOtp}
                    disabled={otpLoading || otpCountdown > 0}
                    className="px-3 py-2 bg-amber-500/10 hover:bg-amber-500 hover:text-black border border-amber-500/40 text-amber-300 rounded-lg text-xs font-semibold whitespace-nowrap transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1 shrink-0"
                  >
                    {otpLoading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                    {otpCountdown > 0 ? `${otpCountdown}s` : (emailVerified ? 'Gửi lại' : 'Gửi OTP')}
                  </button>
                </div>

                {/* Hộp xác thực OTP */}
                {otpSent && !emailVerified && (
                  <div className="mt-2 rounded-lg border border-amber-500/30 bg-amber-950/20 p-2.5 space-y-2">
                    <div className="flex items-center justify-between text-[10px] text-amber-300">
                      <span>Mã OTP đã gửi về email:</span>
                      {otpNotice && <span className="font-mono text-amber-200">{otpNotice}</span>}
                    </div>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        maxLength={6}
                        placeholder="Nhập 6 số OTP"
                        value={otpInput}
                        onChange={(e) => setOtpInput(e.target.value.replace(/\D/g, ''))}
                        className="w-full flex-1 bg-black border border-amber-500/40 rounded-lg px-2.5 py-1.5 text-center font-mono text-xs font-bold tracking-widest text-amber-300 outline-none"
                      />
                      <button
                        type="button"
                        onClick={handleVerifyOtp}
                        disabled={otpVerifying || !otpInput.trim()}
                        className="px-3 py-1.5 bg-amber-400 hover:bg-amber-300 text-black font-bold text-xs rounded-lg transition disabled:opacity-50 whitespace-nowrap"
                      >
                        {otpVerifying ? 'Đang kiểm tra...' : 'Xác thực'}
                      </button>
                    </div>
                  </div>
                )}
                {otpNotice && emailVerified && (
                  <span className="block mt-1 text-[10px] text-emerald-400 font-medium">{otpNotice}</span>
                )}
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

              {/* Năm sinh (>= 18 tuổi) */}
              <div>
                <label className="block text-neutral-300 font-medium mb-1">
                  Năm sinh (từ 18 tuổi trở lên) *
                </label>
                <input
                  required
                  type="number"
                  placeholder="VD: 2000"
                  min={new Date().getFullYear() - 100}
                  max={new Date().getFullYear() - 18}
                  value={formData.birthYear}
                  onChange={(e) => setFormData({ ...formData, birthYear: e.target.value })}
                  className="w-full bg-neutral-900 border border-white/[0.12] rounded-lg p-2.5 text-white outline-none focus:border-amber-400"
                />
                {formData.birthYear && (
                  <div className="mt-1">
                    {validateBirthYear18Plus(formData.birthYear).isValid ? (
                      <span className="text-[10px] text-emerald-400 font-medium">
                        ✓ {new Date().getFullYear() - Number(formData.birthYear)} tuổi (Hợp lệ)
                      </span>
                    ) : (
                      <span className="text-[10px] text-rose-400">
                        {validateBirthYear18Plus(formData.birthYear).message}
                      </span>
                    )}
                  </div>
                )}
              </div>

              {/* Mật khẩu khởi tạo */}
              <div>
                <label className="block text-neutral-300 font-medium mb-1">
                  Mật khẩu khởi tạo *
                </label>
                <div className="relative">
                  <input
                    required
                    type={showPassword ? 'text' : 'password'}
                    placeholder="Hoa, thường, số, đặc biệt (tối thiểu 8 ký tự)"
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    className="w-full bg-neutral-900 border border-white/[0.12] rounded-lg p-2.5 pr-10 text-white outline-none focus:border-amber-400 font-mono"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-2.5 text-neutral-400 hover:text-white"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                <PasswordRequirements password={formData.password} />
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

