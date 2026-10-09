import React, { useEffect, useMemo, useState } from 'react';
import { motion } from 'motion/react';
import { getStoredAuth } from '../../../services/authService';
import { adminService } from '../../../services/adminService';
import {
  AlertCircle,
  BadgeCheck,
  Building2,
  CheckCircle2,
  Clock,
  Crown,
  Eye,
  EyeOff,
  Plus,
  RefreshCw,
  Search,
  Shield,
  Ticket,
  User,
  UserCheck,
  UserPlus,
  Users,
  UserX,
  X
} from 'lucide-react';
import { PASSWORD_VALIDATION_MESSAGE, isStrongPassword } from '../../../utils/validation';

const USER_STATUS_OPTIONS = ['ACTIVE', 'DISABLED', 'PENDING_VERIFICATION'];
const STAFF_PROFILE_STATUS_OPTIONS = ['ACTIVE', 'INACTIVE', 'SUSPENDED'];

const EMPTY_STAFF_FORM = {
  email: '',
  password: '',
  fullName: '',
  phone: '',
  birthYear: '',
  cinemaId: ''
};

const EMPTY_MANAGER_FORM = {
  email: '',
  password: '',
  fullName: '',
  phone: '',
  birthYear: '',
  cinemaId: ''
};

const formatDateTime = (isoString) => {
  if (!isoString) return '—';
  try {
    const date = new Date(isoString);
    if (Number.isNaN(date.getTime())) return isoString;
    return new Intl.DateTimeFormat('vi-VN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    }).format(date);
  } catch {
    return isoString;
  }
};

const getStatusMeta = (status) => {
  switch (status) {
    case 'ACTIVE':
      return {
        label: 'HOẠT ĐỘNG',
        className: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300',
        icon: CheckCircle2
      };
    case 'DISABLED':
      return {
        label: 'ĐÃ KHÓA',
        className: 'border-rose-500/40 bg-rose-500/10 text-rose-300',
        icon: UserX
      };
    case 'PENDING_VERIFICATION':
      return {
        label: 'CHỜ XÁC MINH',
        className: 'border-amber-500/40 bg-amber-500/10 text-amber-300',
        icon: Clock
      };
    default:
      return {
        label: status || 'CHƯA RÕ',
        className: 'border-neutral-700 bg-neutral-900 text-neutral-300',
        icon: UserCheck
      };
  }
};

const getRoleBadge = (roles = []) => {
  const roleList = Array.isArray(roles) ? roles.map((r) => String(r).toUpperCase()) : [String(roles).toUpperCase()];
  if (roleList.includes('ADMIN') || roleList.includes('ROLE_ADMIN')) {
    return { label: 'ADMIN', color: 'border-rose-500/40 bg-rose-500/10 text-rose-300' };
  }
  if (roleList.includes('MANAGER') || roleList.includes('ROLE_MANAGER')) {
    return { label: 'MANAGER', color: 'border-sky-500/40 bg-sky-500/10 text-sky-300' };
  }
  if (roleList.includes('STAFF') || roleList.includes('ROLE_STAFF')) {
    return { label: 'STAFF RẠP', color: 'border-amber-500/40 bg-amber-500/10 text-amber-300' };
  }
  return { label: 'KHÁCH HÀNG', color: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300' };
};

const isStaffMember = (user) => {
  const roleList = Array.isArray(user?.roles)
    ? user.roles.map((r) => String(r).toUpperCase())
    : [String(user?.roles || '').toUpperCase()];
  return roleList.some((r) => r.includes('STAFF') || r.includes('MANAGER') || r.includes('ADMIN'));
};

const isCustomerMember = (user) => !isStaffMember(user);

const getStaffCategory = (user) => {
  const roleList = Array.isArray(user?.roles)
    ? user.roles.map((r) => String(r).toUpperCase())
    : [String(user?.roles || '').toUpperCase()];
  if (roleList.some((r) => r.includes('ADMIN'))) return 'ADMIN';
  if (roleList.some((r) => r.includes('MANAGER'))) return 'MANAGER';
  if (roleList.some((r) => r.includes('STAFF'))) return 'STAFF';
  return 'OTHER';
};

export default function AdminUsersPanel({ ctx }) {
  const {
    activeTab,
    adminUsers = [],
    selectedAdminUser,
    userSearch = '',
    setUserSearch = () => {},
    isUsersLoading,
    isUserDetailLoading,
    isUserStatusSaving,
    isStaffCreating,
    fetchAdminUsers = () => {},
    handleSelectAdminUser = () => {},
    handleCreateStaff = () => {},
    handleUpdateAdminUserStatus = () => {},
    currentUser = null,
    isAdmin = false,
    isManager = false,
    showToast = () => {}
  } = ctx;

  const isEffectiveAdmin = Boolean(
    isAdmin ||
    currentUser?.role === 'admin' ||
    (currentUser?.roles || []).some((r) => String(r).toUpperCase() === 'ADMIN' || String(r).toUpperCase() === 'ROLE_ADMIN')
  );
  const isEffectiveManager = !isEffectiveAdmin && Boolean(
    isManager ||
    currentUser?.role === 'manager' ||
    (currentUser?.roles || []).some((r) => String(r).toUpperCase() === 'MANAGER' || String(r).toUpperCase() === 'ROLE_MANAGER')
  );

  // View Category: 'users' (Khách hàng) vs 'staff' (Nhân sự)
  const [viewCategory, setViewCategory] = useState(activeTab === 'staff' ? 'staff' : 'users');
  const [staffFilter, setStaffFilter] = useState('ALL'); // 'ALL' | 'STAFF' | 'MANAGER' | 'ADMIN'
  const [customerFilter, setCustomerFilter] = useState('ALL'); // 'ALL' | 'ACTIVE' | 'DISABLED'

  useEffect(() => {
    if (activeTab === 'staff') {
      setViewCategory('staff');
    } else if (activeTab === 'users') {
      setViewCategory('users');
    }
    if (activeTab === 'users' || activeTab === 'staff') {
      fetchAdminUsers();
    }
  }, [activeTab]);

  // Modal / Form states
  const [isStaffFormOpen, setIsStaffFormOpen] = useState(false);
  const [showStaffPassword, setShowStaffPassword] = useState(false);
  const [staffForm, setStaffForm] = useState(EMPTY_STAFF_FORM);
  const [staffFormErrors, setStaffFormErrors] = useState({});

  const [isManagerFormOpen, setIsManagerFormOpen] = useState(false);
  const [showManagerPassword, setShowManagerPassword] = useState(false);
  const [managerForm, setManagerForm] = useState(EMPTY_MANAGER_FORM);
  const [managerFormErrors, setManagerFormErrors] = useState({});
  const [isManagerCreating, setIsManagerCreating] = useState(false);
  const [managerFormNotice, setManagerFormNotice] = useState('');

  // Cinema list & lookup
  const [cinemas, setCinemas] = useState([]);
  const [isCinemasLoading, setIsCinemasLoading] = useState(false);

  // Reassign cinema state (Admin only)
  const [reassignCinemaId, setReassignCinemaId] = useState('');
  const [isReassigning, setIsReassigning] = useState(false);
  const [reassignNotice, setReassignNotice] = useState('');
  const [reassignError, setReassignError] = useState('');

  // Staff profiles
  const [staffProfiles, setStaffProfiles] = useState([]);
  const [isProfileLoading, setIsProfileLoading] = useState(false);
  const [isProfileSaving, setIsProfileSaving] = useState(false);
  const [profileError, setProfileError] = useState('');
  const [profileForm, setProfileForm] = useState({ employeeCode: '', position: '', status: 'ACTIVE' });

  // Load cinema list
  useEffect(() => {
    if (activeTab !== 'users' && activeTab !== 'staff') return undefined;
    let cancelled = false;
    const loadCinemas = async () => {
      const { accessToken } = getStoredAuth();
      if (!accessToken) return;
      setIsCinemasLoading(true);
      try {
        let cinemaList = [];
        try {
          const res = await adminService.getAdminCinemas(accessToken);
          cinemaList = Array.isArray(res) ? res : (res?.items || res?.content || []);
        } catch {
          const single = await adminService.getAdminCinema(accessToken);
          if (single) cinemaList = [single];
        }
        if (!cancelled) setCinemas(cinemaList);
      } catch (err) {
        console.warn('Lỗi tải danh sách rạp:', err);
      } finally {
        if (!cancelled) setIsCinemasLoading(false);
      }
    };
    loadCinemas();
    return () => { cancelled = true; };
  }, [activeTab]);

  const cinemaMap = useMemo(() => {
    const map = {};
    (cinemas || []).forEach((c) => {
      if (c?.id) map[c.id] = c.name || `Rạp #${c.id}`;
    });
    return map;
  }, [cinemas]);

  // Load staff profiles
  useEffect(() => {
    if (activeTab !== 'users' && activeTab !== 'staff') return undefined;
    let cancelled = false;
    const loadProfiles = async () => {
      const { accessToken } = getStoredAuth();
      if (!accessToken) return;
      setIsProfileLoading(true);
      try {
        const profiles = await adminService.getAdminStaffProfiles(accessToken);
        if (!cancelled) setStaffProfiles(Array.isArray(profiles) ? profiles : []);
      } catch (error) {
        if (!cancelled) setProfileError(error.message || 'Không thể tải staff profile.');
      } finally {
        if (!cancelled) setIsProfileLoading(false);
      }
    };
    loadProfiles();
    return () => { cancelled = true; };
  }, [activeTab]);

  const selectedStaffProfile = useMemo(() => {
    if (!selectedAdminUser?.id) return null;
    return staffProfiles.find((profile) => String(profile.userId) === String(selectedAdminUser.id)) || null;
  }, [staffProfiles, selectedAdminUser?.id]);

  const isSelectedStaff = useMemo(() => {
    const roles = selectedAdminUser?.roles || [];
    return roles.some((role) => String(role).toUpperCase().includes('STAFF'));
  }, [selectedAdminUser?.roles]);

  const isSelectedManager = useMemo(() => {
    const roles = selectedAdminUser?.roles || [];
    return roles.some((role) => String(role).toUpperCase().includes('MANAGER'));
  }, [selectedAdminUser?.roles]);

  const isSelectedAdmin = useMemo(() => {
    const roles = selectedAdminUser?.roles || [];
    return roles.some((role) => String(role).toUpperCase().includes('ADMIN'));
  }, [selectedAdminUser?.roles]);

  useEffect(() => {
    if (selectedStaffProfile) {
      setProfileForm({
        employeeCode: selectedStaffProfile.employeeCode || '',
        position: selectedStaffProfile.position || '',
        status: selectedStaffProfile.status || 'ACTIVE'
      });
    } else {
      setProfileForm({ employeeCode: '', position: '', status: 'ACTIVE' });
    }
    setProfileError('');
  }, [selectedStaffProfile?.id, selectedAdminUser?.id]);

  useEffect(() => {
    if (selectedAdminUser?.cinemaId) {
      setReassignCinemaId(String(selectedAdminUser.cinemaId));
    } else {
      setReassignCinemaId('');
    }
    setReassignNotice('');
    setReassignError('');
  }, [selectedAdminUser?.id, selectedAdminUser?.cinemaId]);

  if (activeTab !== 'users' && activeTab !== 'staff') return null;

  const updateStaffForm = (field, value) => {
    setStaffForm((prev) => ({ ...prev, [field]: value }));
    setStaffFormErrors((prev) => ({ ...prev, [field]: '' }));
  };

  const updateManagerForm = (field, value) => {
    setManagerForm((prev) => ({ ...prev, [field]: value }));
    setManagerFormErrors((prev) => ({ ...prev, [field]: '' }));
    setManagerFormNotice('');
  };

  const submitStaffForm = async (event) => {
    event.preventDefault();
    const errors = {};
    const email = staffForm.email.trim();
    const fullName = staffForm.fullName.trim();
    const phone = staffForm.phone.trim();
    const birthYear = staffForm.birthYear ? Number(staffForm.birthYear) : null;

    if (!email) errors.email = 'Email là bắt buộc.';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errors.email = 'Email không hợp lệ.';
    if (!fullName) errors.fullName = 'Họ tên là bắt buộc.';
    if (!isStrongPassword(staffForm.password)) errors.password = PASSWORD_VALIDATION_MESSAGE;
    if (phone && !/^\+?[0-9]{10,15}$/.test(phone)) errors.phone = 'Số điện thoại gồm 10-15 chữ số.';
    if (birthYear && (birthYear < 1900 || birthYear > 2100)) errors.birthYear = 'Năm sinh không hợp lệ.';

    if (isEffectiveAdmin && !staffForm.cinemaId) {
      errors.cinemaId = 'Vui lòng chọn rạp phân công cho nhân viên.';
    }

    if (Object.keys(errors).length > 0) {
      setStaffFormErrors(errors);
      return;
    }

    try {
      const payload = {
        email,
        password: staffForm.password,
        fullName,
        phone: phone || null,
        birthYear: birthYear || null,
        cinemaId: isEffectiveAdmin ? Number(staffForm.cinemaId) : Number(currentUser?.cinemaId || null)
      };

      await handleCreateStaff(payload);
      setStaffForm(EMPTY_STAFF_FORM);
      setIsStaffFormOpen(false);
      fetchAdminUsers();
    } catch (error) {
      const msg = error.message || 'Không thể tạo tài khoản STAFF.';
      const newErrors = { submit: msg };
      const lower = msg.toLowerCase();
      if (lower.includes('email')) {
        newErrors.email = msg;
      }
      if (lower.includes('điện thoại') || lower.includes('phone') || lower.includes('số điện thoại')) {
        newErrors.phone = msg;
      }
      setStaffFormErrors(newErrors);
      showToast?.(msg);
    }
  };

  const submitManagerForm = async (event) => {
    event.preventDefault();
    const errors = {};
    const email = managerForm.email.trim();
    const fullName = managerForm.fullName.trim();
    const phone = managerForm.phone.trim();
    const birthYear = managerForm.birthYear ? Number(managerForm.birthYear) : null;
    const cinemaId = managerForm.cinemaId ? Number(managerForm.cinemaId) : null;

    if (!email) errors.email = 'Email là bắt buộc.';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errors.email = 'Email không hợp lệ.';
    if (!fullName) errors.fullName = 'Họ tên là bắt buộc.';
    if (!isStrongPassword(managerForm.password)) errors.password = PASSWORD_VALIDATION_MESSAGE;
    if (phone && !/^\+?[0-9]{10,15}$/.test(phone)) errors.phone = 'Số điện thoại gồm 10-15 chữ số.';
    if (birthYear && (birthYear < 1900 || birthYear > 2100)) errors.birthYear = 'Năm sinh không hợp lệ.';
    if (!cinemaId) errors.cinemaId = 'Vui lòng chọn cụm rạp phân công quản lý (Manager chỉ quản lý 1 rạp).';

    if (Object.keys(errors).length > 0) {
      setManagerFormErrors(errors);
      return;
    }

    const { accessToken } = getStoredAuth();
    if (!accessToken) return;

    setIsManagerCreating(true);
    setManagerFormNotice('');
    try {
      const payload = {
        email,
        password: managerForm.password,
        fullName,
        phone: phone || null,
        birthYear: birthYear || null,
        cinemaId
      };

      const created = await adminService.createAdminManager(accessToken, payload);
      setManagerForm(EMPTY_MANAGER_FORM);
      setIsManagerFormOpen(false);
      fetchAdminUsers();
      if (created) {
        handleSelectAdminUser(created);
      }
      showToast?.(`Đã cấp tài khoản MANAGER thành công cho ${email}.`);
    } catch (error) {
      const msg = error.message || 'Không thể tạo tài khoản MANAGER.';
      const newErrors = { submit: msg };
      const lower = msg.toLowerCase();
      if (lower.includes('email')) {
        newErrors.email = msg;
      }
      if (lower.includes('điện thoại') || lower.includes('phone') || lower.includes('số điện thoại')) {
        newErrors.phone = msg;
      }
      setManagerFormErrors(newErrors);
      showToast?.(msg);
    } finally {
      setIsManagerCreating(false);
    }
  };

  const handleReassignCinema = async (e) => {
    e.preventDefault();
    if (!selectedAdminUser?.id || !reassignCinemaId) return;

    const { accessToken } = getStoredAuth();
    if (!accessToken) return;

    setIsReassigning(true);
    setReassignNotice('');
    setReassignError('');
    try {
      const updated = await adminService.assignAdminUserCinema(accessToken, selectedAdminUser.id, Number(reassignCinemaId));
      setReassignNotice(`Đã đổi rạp phân công thành công sang: ${cinemaMap[reassignCinemaId] || ('Rạp #' + reassignCinemaId)}`);
      fetchAdminUsers();
      if (updated && selectedAdminUser) {
        handleSelectAdminUser({ ...selectedAdminUser, cinemaId: Number(reassignCinemaId) });
      }
    } catch (err) {
      setReassignError(err.message || 'Không thể đổi rạp cho người dùng.');
    } finally {
      setIsReassigning(false);
    }
  };

  const updateProfileForm = (field, value) => {
    setProfileForm((prev) => ({ ...prev, [field]: value }));
  };

  const saveStaffProfile = async (event) => {
    event.preventDefault();
    if (!selectedAdminUser?.id || !isSelectedStaff) return;

    const employeeCode = profileForm.employeeCode.trim();
    const position = profileForm.position.trim();
    if (!employeeCode || !position) {
      setProfileError('Nhập mã nhân viên và vị trí trước khi lưu.');
      return;
    }

    const { accessToken } = getStoredAuth();
    if (!accessToken) {
      setProfileError('Phiên đăng nhập admin không hợp lệ.');
      return;
    }

    setIsProfileSaving(true);
    try {
      const payload = {
        userId: Number(selectedAdminUser.id),
        employeeCode,
        position,
        status: profileForm.status || 'ACTIVE'
      };
      const savedProfile = selectedStaffProfile
        ? await adminService.updateAdminStaffProfile(accessToken, selectedStaffProfile.id, {
          employeeCode,
          position,
          status: payload.status
        })
        : await adminService.createAdminStaffProfile(accessToken, payload);
      setStaffProfiles((prev) => [
        savedProfile,
        ...prev.filter((profile) => String(profile.id) !== String(savedProfile.id))
      ]);
      setProfileError('');
    } catch (error) {
      setProfileError(error.message || 'Không thể lưu staff profile.');
    } finally {
      setIsProfileSaving(false);
    }
  };

  // Merge adminUsers with staffProfiles so staff profiles are never missed
  const effectiveUsers = useMemo(() => {
    const list = [...adminUsers];
    const userMap = new Map();
    list.forEach((u) => {
      userMap.set(String(u.id ?? u.userId), u);
    });

    (staffProfiles || []).forEach((sp) => {
      const spId = String(sp.userId || sp.id);
      const existing = userMap.get(spId);
      if (!existing) {
        const synthesized = {
          id: sp.userId || sp.id,
          userId: sp.userId || sp.id,
          email: sp.email || '',
          fullName: sp.fullName || (sp.employeeCode ? ('Nhân viên ' + sp.employeeCode) : ('Nhân viên #' + spId)),
          phone: sp.phone || '',
          roles: ['STAFF'],
          cinemaId: sp.cinemaId,
          status: sp.status || 'ACTIVE',
          employeeCode: sp.employeeCode,
          position: sp.position
        };
        list.push(synthesized);
        userMap.set(spId, synthesized);
      } else {
        if (sp.cinemaId && !existing.cinemaId) existing.cinemaId = sp.cinemaId;
        if (sp.employeeCode && !existing.employeeCode) existing.employeeCode = sp.employeeCode;
        if (sp.position && !existing.position) existing.position = sp.position;
      }
    });

    if (isEffectiveManager && currentUser?.cinemaId) {
      return list.filter((u) => {
        if (!isStaffMember(u)) return true;
        return !u.cinemaId || String(u.cinemaId) === String(currentUser.cinemaId);
      });
    }

    return list;
  }, [adminUsers, staffProfiles, isEffectiveManager, currentUser?.cinemaId]);

  // Metrics
  const customerCount = useMemo(() => effectiveUsers.filter(isCustomerMember).length, [effectiveUsers]);
  const staffCount = useMemo(() => effectiveUsers.filter(isStaffMember).length, [effectiveUsers]);
  const staffCinemaCount = useMemo(() => effectiveUsers.filter((u) => getStaffCategory(u) === 'STAFF').length, [effectiveUsers]);
  const managerCount = useMemo(() => effectiveUsers.filter((u) => getStaffCategory(u) === 'MANAGER').length, [effectiveUsers]);
  const adminCount = useMemo(() => effectiveUsers.filter((u) => getStaffCategory(u) === 'ADMIN').length, [effectiveUsers]);

  const activeCustomerCount = useMemo(() => effectiveUsers.filter((u) => isCustomerMember(u) && u.status === 'ACTIVE').length, [effectiveUsers]);
  const disabledCustomerCount = useMemo(() => effectiveUsers.filter((u) => isCustomerMember(u) && u.status === 'DISABLED').length, [effectiveUsers]);

  // Filtered Users List
  const filteredUsers = useMemo(() => {
    let list = effectiveUsers.filter((user) => {
      if (viewCategory === 'staff') {
        if (!isStaffMember(user)) return false;
        if (staffFilter === 'STAFF') return getStaffCategory(user) === 'STAFF';
        if (staffFilter === 'MANAGER') return getStaffCategory(user) === 'MANAGER';
        if (staffFilter === 'ADMIN') return getStaffCategory(user) === 'ADMIN';
        return true;
      } else {
        if (!isCustomerMember(user)) return false;
        if (customerFilter === 'ACTIVE') return user.status === 'ACTIVE';
        if (customerFilter === 'DISABLED') return user.status === 'DISABLED';
        return true;
      }
    });

    const query = userSearch.trim().toLowerCase();
    if (!query) return list;

    return list.filter((user) => {
      const cinemaName = user.cinemaId ? (cinemaMap[user.cinemaId] || '').toLowerCase() : '';
      return (
        user.email?.toLowerCase().includes(query) ||
        user.fullName?.toLowerCase().includes(query) ||
        user.phone?.toLowerCase().includes(query) ||
        String(user.id || '').includes(query) ||
        cinemaName.includes(query)
      );
    });
  }, [effectiveUsers, viewCategory, staffFilter, customerFilter, userSearch, cinemaMap]);

  // Auto-switch selected user if current selection does not belong to active category
  useEffect(() => {
    if (selectedAdminUser) {
      const isStaffSelected = isStaffMember(selectedAdminUser);
      if (viewCategory === 'staff' && !isStaffSelected && filteredUsers.length > 0) {
        handleSelectAdminUser(filteredUsers[0]);
      } else if (viewCategory === 'users' && isStaffSelected && filteredUsers.length > 0) {
        handleSelectAdminUser(filteredUsers[0]);
      }
    } else if (filteredUsers.length > 0) {
      handleSelectAdminUser(filteredUsers[0]);
    }
  }, [viewCategory, filteredUsers.length]);

  const selectedStatus = getStatusMeta(selectedAdminUser?.status);
  const SelectedStatusIcon = selectedStatus.icon;
  const isViewingSelf =
    String(currentUser?.id || '') === String(selectedAdminUser?.id || '') ||
    (currentUser?.email && selectedAdminUser?.email && currentUser.email === selectedAdminUser.email);

  // Permission check for Manager: Manager cannot edit or disable Admin or other Managers
  const isTargetPrivileged = isSelectedAdmin || isSelectedManager;
  const canManagerModifyUser = isEffectiveAdmin || (!isTargetPrivileged && isSelectedStaff);

  return (
    <motion.div
      key="panel-users"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      transition={{ duration: 0.2 }}
      className="space-y-6"
    >
      {/* 1. TOP SEGMENT SWITCHER: KHÁCH HÀNG vs NHÂN SỰ (STAFF) */}
      <div className="flex flex-wrap items-center justify-between gap-4 border border-white/[0.08] bg-[#070707] p-3">
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => {
              setViewCategory('users');
              setStaffFilter('ALL');
            }}
            className={`flex items-center gap-2.5 px-5 py-2.5 text-xs font-black uppercase tracking-wider transition border ${
              viewCategory === 'users'
                ? 'border-emerald-500 bg-emerald-500/15 text-emerald-300 shadow-[0_0_15px_rgba(16,185,129,0.15)]'
                : 'border-white/[0.06] bg-black/40 text-neutral-400 hover:text-white hover:border-white/20'
            }`}
          >
            <User className="h-4 w-4 text-emerald-400" />
            <span>Người dùng (Khách hàng)</span>
            <span className="rounded-full border border-emerald-500/40 bg-emerald-950/70 px-2 py-0.5 font-mono text-[10px] text-emerald-300">
              {customerCount}
            </span>
          </button>

          <button
            type="button"
            onClick={() => {
              setViewCategory('staff');
              setCustomerFilter('ALL');
            }}
            className={`flex items-center gap-2.5 px-5 py-2.5 text-xs font-black uppercase tracking-wider transition border ${
              viewCategory === 'staff'
                ? 'border-amber-500 bg-amber-500/15 text-amber-300 shadow-[0_0_15px_rgba(245,158,11,0.15)]'
                : 'border-white/[0.06] bg-black/40 text-neutral-400 hover:text-white hover:border-white/20'
            }`}
          >
            <Shield className="h-4 w-4 text-amber-400" />
            <span>Nhân sự (Staff / Quản lý / Admin)</span>
            <span className="rounded-full border border-amber-500/40 bg-amber-950/70 px-2 py-0.5 font-mono text-[10px] text-amber-300">
              {staffCount}
            </span>
          </button>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={fetchAdminUsers}
            disabled={isUsersLoading}
            className="flex items-center justify-center gap-2 border border-white/[0.08] bg-black px-4 py-2.5 text-[10px] font-mono uppercase tracking-widest text-neutral-300 transition hover:border-amber-400 hover:text-amber-300 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isUsersLoading ? 'animate-spin' : ''}`} />
            Làm mới dữ liệu
          </button>
        </div>
      </div>

      {/* 2. STATS OVERVIEW CARDS */}
      {viewCategory === 'staff' ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="border border-white/[0.06] bg-[#050505] p-3.5">
            <span className="text-[9px] font-mono uppercase tracking-wider text-neutral-400">Tổng nhân sự</span>
            <div className="mt-1 flex items-center justify-between">
              <span className="text-xl font-black font-mono text-white">{staffCount}</span>
              <Shield className="h-4 w-4 text-neutral-500" />
            </div>
          </div>
          <div className="border border-amber-500/20 bg-amber-500/5 p-3.5">
            <span className="text-[9px] font-mono uppercase tracking-wider text-amber-400">Staff rạp</span>
            <div className="mt-1 flex items-center justify-between">
              <span className="text-xl font-black font-mono text-amber-300">{staffCinemaCount}</span>
              <Ticket className="h-4 w-4 text-amber-400" />
            </div>
          </div>
          <div className="border border-sky-500/20 bg-sky-500/5 p-3.5">
            <span className="text-[9px] font-mono uppercase tracking-wider text-sky-400">Quản lý (Manager)</span>
            <div className="mt-1 flex items-center justify-between">
              <span className="text-xl font-black font-mono text-sky-300">{managerCount}</span>
              <Building2 className="h-4 w-4 text-sky-400" />
            </div>
          </div>
          <div className="border border-rose-500/20 bg-rose-500/5 p-3.5">
            <span className="text-[9px] font-mono uppercase tracking-wider text-rose-400">Quản trị viên (Admin)</span>
            <div className="mt-1 flex items-center justify-between">
              <span className="text-xl font-black font-mono text-rose-300">{adminCount}</span>
              <Crown className="h-4 w-4 text-rose-400" />
            </div>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <div className="border border-white/[0.06] bg-[#050505] p-3.5">
            <span className="text-[9px] font-mono uppercase tracking-wider text-neutral-400">Tổng khách hàng</span>
            <div className="mt-1 flex items-center justify-between">
              <span className="text-xl font-black font-mono text-white">{customerCount}</span>
              <User className="h-4 w-4 text-neutral-500" />
            </div>
          </div>
          <div className="border border-emerald-500/20 bg-emerald-500/5 p-3.5">
            <span className="text-[9px] font-mono uppercase tracking-wider text-emerald-400">Đang hoạt động</span>
            <div className="mt-1 flex items-center justify-between">
              <span className="text-xl font-black font-mono text-emerald-300">{activeCustomerCount}</span>
              <CheckCircle2 className="h-4 w-4 text-emerald-400" />
            </div>
          </div>
          <div className="border border-rose-500/20 bg-rose-500/5 p-3.5">
            <span className="text-[9px] font-mono uppercase tracking-wider text-rose-400">Tài khoản bị khóa</span>
            <div className="mt-1 flex items-center justify-between">
              <span className="text-xl font-black font-mono text-rose-300">{disabledCustomerCount}</span>
              <UserX className="h-4 w-4 text-rose-400" />
            </div>
          </div>
        </div>
      )}

      {/* 3. SECTION HEADER & ACTION BUTTONS */}
      <div className="flex flex-col gap-4 border border-white/[0.05] bg-[#070707] p-4 md:flex-row md:items-center md:justify-between">
        <div>
          <span className="text-[8px] font-mono font-black uppercase tracking-widest text-neutral-300">
            {viewCategory === 'staff'
              ? (isEffectiveAdmin ? 'CENTRAL STAFF CONTROL' : 'BRANCH STAFF CONTROL')
              : 'CUSTOMER ACCOUNTS DIRECTORY'}
          </span>
          <h2 className="text-xs font-black uppercase tracking-[0.18em] text-neutral-200">
            {viewCategory === 'staff' ? 'Quản lý nhân sự & phân quyền (Staff)' : 'Quản lý người dùng (Khách hàng)'}
          </h2>
          {isEffectiveManager && currentUser?.cinemaId && (
            <p className="mt-0.5 text-[10px] text-sky-400 font-mono">
              Phạm vi quản trị: {cinemaMap[currentUser.cinemaId] || `Rạp #${currentUser.cinemaId}`}
            </p>
          )}
        </div>

        {viewCategory === 'staff' && (
          <div className="flex flex-wrap items-center gap-2">
            {/* Cấp tài khoản MANAGER (Admin Only) */}
            {isEffectiveAdmin && (
              <button
                type="button"
                onClick={() => {
                  setIsManagerFormOpen((prev) => !prev);
                  setIsStaffFormOpen(false);
                }}
                className="flex items-center justify-center gap-2 border border-sky-500/60 bg-sky-500/10 px-4 py-2 text-[10px] font-mono font-black uppercase tracking-widest text-sky-300 transition hover:bg-sky-500 hover:text-black"
              >
                {isManagerFormOpen ? <X className="h-3.5 w-3.5" /> : <Shield className="h-3.5 w-3.5" />}
                {isManagerFormOpen ? 'Đóng Manager' : 'Cấp tài khoản MANAGER'}
              </button>
            )}

            {/* Cấp tài khoản STAFF (Admin & Manager) */}
            <button
              type="button"
              onClick={() => {
                setIsStaffFormOpen((prev) => !prev);
                setIsManagerFormOpen(false);
              }}
              className="flex items-center justify-center gap-2 border border-amber-500/60 bg-amber-500/10 px-4 py-2 text-[10px] font-mono font-black uppercase tracking-widest text-amber-300 transition hover:bg-amber-500 hover:text-black"
            >
              {isStaffFormOpen ? <X className="h-3.5 w-3.5" /> : <UserPlus className="h-3.5 w-3.5" />}
              {isStaffFormOpen ? 'Đóng Staff' : 'Cấp tài khoản STAFF'}
            </button>
          </div>
        )}
      </div>

      {/* Form Cấp STAFF */}
      {isStaffFormOpen && viewCategory === 'staff' && (
        <motion.form
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          onSubmit={submitStaffForm}
          className="border border-amber-500/30 bg-[#080704] p-5"
        >
          <div className="mb-4 flex items-start justify-between gap-4 border-b border-amber-500/15 pb-4">
            <div>
              <div className="flex items-center gap-2 text-xs font-black uppercase tracking-wider text-amber-300">
                <Plus className="h-4 w-4" />
                Cấp tài khoản STAFF (Soát vé rạp)
              </div>
              <p className="mt-1 text-[10px] text-neutral-300">
                {isEffectiveManager
                  ? `Tài khoản nhân viên soát vé sẽ được phân công trực tiếp vào rạp: ${cinemaMap[currentUser?.cinemaId] || ('Rạp #' + currentUser?.cinemaId)}.`
                  : 'Tài khoản nhân viên soát vé. Chọn cụm rạp để phân công làm việc.'}
              </p>
            </div>
            {isEffectiveManager && currentUser?.cinemaId && (
              <span className="border border-sky-500/40 bg-sky-950/40 px-2 py-1 text-[9px] font-bold text-sky-300">
                Rạp: {cinemaMap[currentUser.cinemaId] || `#${currentUser.cinemaId}`}
              </span>
            )}
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-5">
            {[
              { field: 'fullName', label: 'Họ và tên *', placeholder: 'Nguyễn Văn A', type: 'text' },
              { field: 'email', label: 'Email đăng nhập *', placeholder: 'staff@cinepremier.vn', type: 'email' },
              { field: 'phone', label: 'Số điện thoại', placeholder: '0901234567', type: 'tel' },
              { field: 'birthYear', label: 'Năm sinh', placeholder: '2000', type: 'number' }
            ].map(({ field, label, placeholder, type }) => (
              <label key={field} className="space-y-1.5">
                <span className="text-[9px] font-black uppercase tracking-widest text-neutral-200">{label}</span>
                <input
                  type={type}
                  value={staffForm[field]}
                  onChange={(event) => updateStaffForm(field, event.target.value)}
                  placeholder={placeholder}
                  min={field === 'birthYear' ? 1900 : undefined}
                  max={field === 'birthYear' ? 2100 : undefined}
                  className={`w-full border bg-black px-3 py-2.5 text-xs text-white outline-none transition placeholder:text-neutral-500 focus:border-amber-400 ${staffFormErrors[field] ? 'border-rose-500' : 'border-white/[0.06]'}`}
                />
                {staffFormErrors[field] && <span className="block text-[9px] text-rose-300">{staffFormErrors[field]}</span>}
              </label>
            ))}

            <label className="space-y-1.5">
              <span className="text-[9px] font-black uppercase tracking-widest text-neutral-200">Mật khẩu cấp ban đầu *</span>
              <div className="relative">
                <input
                  type={showStaffPassword ? 'text' : 'password'}
                  value={staffForm.password}
                  onChange={(event) => updateStaffForm('password', event.target.value)}
                  placeholder="Tối thiểu 8 ký tự"
                  className={`w-full border bg-black px-3 py-2.5 pr-10 text-xs text-white outline-none transition placeholder:text-neutral-500 focus:border-amber-400 ${staffFormErrors.password ? 'border-rose-500' : 'border-white/[0.06]'}`}
                />
                <button
                  type="button"
                  onClick={() => setShowStaffPassword((prev) => !prev)}
                  className="absolute right-2.5 top-2.5 text-neutral-300 transition hover:text-white"
                >
                  {showStaffPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {staffFormErrors.password && <span className="block text-[9px] text-rose-300">{staffFormErrors.password}</span>}
            </label>
          </div>

          {/* Phân công rạp cho Staff (Admin chọn, Manager hiển thị cố định) */}
          {isEffectiveAdmin ? (
            <div className="mt-4 border border-white/[0.06] bg-black/60 p-4">
              <label className="block space-y-1.5">
                <span className="text-[9px] font-black uppercase tracking-widest text-neutral-200">
                  Phân công cụm rạp cho STAFF *
                </span>
                <select
                  value={staffForm.cinemaId}
                  onChange={(e) => updateStaffForm('cinemaId', e.target.value)}
                  className={`w-full max-w-md border bg-black px-3 py-2 text-xs text-white outline-none focus:border-amber-400 ${staffFormErrors.cinemaId ? 'border-rose-500' : 'border-white/[0.06]'}`}
                >
                  <option value="">-- Chọn cụm rạp phân công --</option>
                  {cinemas.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name || `Rạp #${c.id}`}
                    </option>
                  ))}
                </select>
                {staffFormErrors.cinemaId && <span className="block text-[9px] text-rose-300">{staffFormErrors.cinemaId}</span>}
              </label>
            </div>
          ) : (
            <div className="mt-4 border border-sky-500/20 bg-sky-950/20 p-3 text-[10px] text-sky-200">
              Cụm rạp phân công mặc định: <strong>{cinemaMap[currentUser?.cinemaId] || `Rạp #${currentUser?.cinemaId}`}</strong>
            </div>
          )}

          {staffFormErrors.submit && (
            <div className="mt-4 flex items-center gap-2 border border-rose-500/40 bg-rose-950/40 p-3 text-xs font-semibold text-rose-300">
              <AlertCircle className="h-4 w-4 shrink-0 text-rose-400" />
              <span>{staffFormErrors.submit}</span>
            </div>
          )}

          <div className="mt-5 flex justify-end">
            <button
              type="submit"
              disabled={isStaffCreating}
              className="flex items-center gap-2 border border-amber-300 bg-amber-400 px-5 py-2.5 text-[10px] font-black uppercase tracking-widest text-black transition hover:bg-amber-300 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isStaffCreating ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <UserPlus className="h-3.5 w-3.5" />}
              {isStaffCreating ? 'Đang cấp tài khoản...' : 'Tạo tài khoản STAFF'}
            </button>
          </div>
        </motion.form>
      )}

      {/* Form Cấp MANAGER (Chỉ ADMIN) */}
      {isManagerFormOpen && isEffectiveAdmin && viewCategory === 'staff' && (
        <motion.form
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          onSubmit={submitManagerForm}
          className="border border-sky-500/30 bg-[#040609] p-5"
        >
          <div className="mb-4 flex items-start justify-between gap-4 border-b border-sky-500/15 pb-4">
            <div>
              <div className="flex items-center gap-2 text-xs font-black uppercase tracking-wider text-sky-300">
                <Shield className="h-4 w-4" />
                Cấp tài khoản MANAGER (Quản lý cụm rạp)
              </div>
              <p className="mt-1 text-[10px] text-neutral-300">
                Tài khoản Quản lý chỉ được phân công đúng <strong>1 cụm rạp</strong> và chỉ có quyền quản lý dữ liệu thuộc cụm rạp đó.
              </p>
            </div>
            {managerFormNotice && <span className="text-[10px] text-emerald-300">{managerFormNotice}</span>}
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-5">
            {[
              { field: 'fullName', label: 'Họ và tên *', placeholder: 'Trần Quản Lý', type: 'text' },
              { field: 'email', label: 'Email đăng nhập *', placeholder: 'manager@cinepremier.vn', type: 'email' },
              { field: 'phone', label: 'Số điện thoại', placeholder: '0912345678', type: 'tel' },
              { field: 'birthYear', label: 'Năm sinh', placeholder: '1990', type: 'number' }
            ].map(({ field, label, placeholder, type }) => (
              <label key={field} className="space-y-1.5">
                <span className="text-[9px] font-black uppercase tracking-widest text-neutral-200">{label}</span>
                <input
                  type={type}
                  value={managerForm[field]}
                  onChange={(event) => updateManagerForm(field, event.target.value)}
                  placeholder={placeholder}
                  className={`w-full border bg-black px-3 py-2.5 text-xs text-white outline-none transition placeholder:text-neutral-500 focus:border-sky-400 ${managerFormErrors[field] ? 'border-rose-500' : 'border-white/[0.06]'}`}
                />
                {managerFormErrors[field] && <span className="block text-[9px] text-rose-300">{managerFormErrors[field]}</span>}
              </label>
            ))}

            <label className="space-y-1.5">
              <span className="text-[9px] font-black uppercase tracking-widest text-neutral-200">Mật khẩu cấp ban đầu *</span>
              <div className="relative">
                <input
                  type={showManagerPassword ? 'text' : 'password'}
                  value={managerForm.password}
                  onChange={(event) => updateManagerForm('password', event.target.value)}
                  placeholder="Tối thiểu 8 ký tự"
                  className={`w-full border bg-black px-3 py-2.5 pr-10 text-xs text-white outline-none transition placeholder:text-neutral-500 focus:border-sky-400 ${managerFormErrors.password ? 'border-rose-500' : 'border-white/[0.06]'}`}
                />
                <button type="button" onClick={() => setShowManagerPassword((prev) => !prev)} className="absolute right-2.5 top-2.5 text-neutral-300 transition hover:text-white">
                  {showManagerPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {managerFormErrors.password && <span className="block text-[9px] text-rose-300">{managerFormErrors.password}</span>}
            </label>
          </div>

          <fieldset className="mt-5 border border-white/[0.06] bg-black/50 p-4">
            <legend className="px-1 text-[9px] font-black uppercase tracking-widest text-neutral-200">Rạp được phân công quản lý (Chỉ 1 rạp) *</legend>
            {isCinemasLoading ? (
              <p className="text-[10px] text-neutral-300">Đang tải danh sách rạp...</p>
            ) : cinemas.length ? (
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {cinemas.map((cinema) => (
                  <label
                    key={cinema.id}
                    className={`flex cursor-pointer items-center gap-2 border px-3 py-2 text-xs transition ${
                      String(managerForm.cinemaId) === String(cinema.id)
                        ? 'border-sky-400 bg-sky-950/30 text-white'
                        : 'border-white/[0.07] text-neutral-300 hover:border-sky-400/60'
                    }`}
                  >
                    <input
                      type="radio"
                      name="managerCinema"
                      value={cinema.id}
                      checked={String(managerForm.cinemaId) === String(cinema.id)}
                      onChange={(e) => updateManagerForm('cinemaId', e.target.value)}
                      className="accent-sky-400"
                    />
                    <span>{cinema.name || `Rạp #${cinema.id}`}</span>
                  </label>
                ))}
              </div>
            ) : (
              <p className="text-[10px] text-neutral-300">Chưa có rạp để phân công. Hãy tạo rạp trước.</p>
            )}
            {managerFormErrors.cinemaId && <span className="mt-2 block text-[9px] text-rose-300">{managerFormErrors.cinemaId}</span>}
          </fieldset>

          {managerFormErrors.submit && (
            <div className="mt-4 flex items-center gap-2 border border-rose-500/40 bg-rose-950/40 p-3 text-xs font-semibold text-rose-300">
              <AlertCircle className="h-4 w-4 shrink-0 text-rose-400" />
              <span>{managerFormErrors.submit}</span>
            </div>
          )}

          <div className="mt-5 flex justify-end">
            <button
              type="submit"
              disabled={isManagerCreating || isCinemasLoading || !cinemas.length}
              className="flex items-center gap-2 border border-sky-300 bg-sky-400 px-5 py-2.5 text-[10px] font-black uppercase tracking-widest text-black transition hover:bg-sky-300 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isManagerCreating ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <UserPlus className="h-3.5 w-3.5" />}
              {isManagerCreating ? 'Đang cấp tài khoản...' : 'Tạo tài khoản MANAGER'}
            </button>
          </div>
        </motion.form>
      )}

      {/* 4. SUB-FILTERS & SEARCH BAR */}
      <div className="flex flex-col gap-3 border border-white/[0.05] bg-black p-4 lg:flex-row lg:items-center lg:justify-between">
        {/* Category-specific quick filters */}
        {viewCategory === 'staff' ? (
          <div className="flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              onClick={() => setStaffFilter('ALL')}
              className={`px-3 py-1.5 text-[10px] font-mono font-black uppercase tracking-wider transition border ${
                staffFilter === 'ALL'
                  ? 'border-amber-400 bg-amber-500 text-black'
                  : 'border-white/[0.08] bg-black/60 text-neutral-300 hover:border-amber-400/60'
              }`}
            >
              Tất cả nhân sự ({staffCount})
            </button>
            <button
              type="button"
              onClick={() => setStaffFilter('STAFF')}
              className={`px-3 py-1.5 text-[10px] font-mono font-black uppercase tracking-wider transition border ${
                staffFilter === 'STAFF'
                  ? 'border-amber-400 bg-amber-500/20 text-amber-300'
                  : 'border-white/[0.08] bg-black/60 text-neutral-300 hover:border-amber-400/60'
              }`}
            >
              🎫 Staff rạp ({staffCinemaCount})
            </button>
            {isEffectiveAdmin && (
              <>
                <button
                  type="button"
                  onClick={() => setStaffFilter('MANAGER')}
                  className={`px-3 py-1.5 text-[10px] font-mono font-black uppercase tracking-wider transition border ${
                    staffFilter === 'MANAGER'
                      ? 'border-sky-400 bg-sky-500/20 text-sky-300'
                      : 'border-white/[0.08] bg-black/60 text-neutral-300 hover:border-sky-400/60'
                  }`}
                >
                  🏢 Quản lý ({managerCount})
                </button>
                <button
                  type="button"
                  onClick={() => setStaffFilter('ADMIN')}
                  className={`px-3 py-1.5 text-[10px] font-mono font-black uppercase tracking-wider transition border ${
                    staffFilter === 'ADMIN'
                      ? 'border-rose-400 bg-rose-500/20 text-rose-300'
                      : 'border-white/[0.08] bg-black/60 text-neutral-300 hover:border-rose-400/60'
                  }`}
                >
                  👑 Admin ({adminCount})
                </button>
              </>
            )}
          </div>
        ) : (
          <div className="flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              onClick={() => setCustomerFilter('ALL')}
              className={`px-3 py-1.5 text-[10px] font-mono font-black uppercase tracking-wider transition border ${
                customerFilter === 'ALL'
                  ? 'border-emerald-400 bg-emerald-500 text-black'
                  : 'border-white/[0.08] bg-black/60 text-neutral-300 hover:border-emerald-400/60'
              }`}
            >
              Tất cả khách hàng ({customerCount})
            </button>
            <button
              type="button"
              onClick={() => setCustomerFilter('ACTIVE')}
              className={`px-3 py-1.5 text-[10px] font-mono font-black uppercase tracking-wider transition border ${
                customerFilter === 'ACTIVE'
                  ? 'border-emerald-400 bg-emerald-500/20 text-emerald-300'
                  : 'border-white/[0.08] bg-black/60 text-neutral-300 hover:border-emerald-400/60'
              }`}
            >
              🟢 Hoạt động ({activeCustomerCount})
            </button>
            <button
              type="button"
              onClick={() => setCustomerFilter('DISABLED')}
              className={`px-3 py-1.5 text-[10px] font-mono font-black uppercase tracking-wider transition border ${
                customerFilter === 'DISABLED'
                  ? 'border-rose-400 bg-rose-500/20 text-rose-300'
                  : 'border-white/[0.08] bg-black/60 text-neutral-300 hover:border-rose-400/60'
              }`}
            >
              🔒 Đã khóa ({disabledCustomerCount})
            </button>
          </div>
        )}

        <div className="relative w-full lg:max-w-xs">
          <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-neutral-400" />
          <input
            value={userSearch}
            onChange={(e) => setUserSearch(e.target.value)}
            placeholder={viewCategory === 'staff' ? 'Tìm tên, email, rạp, vai trò...' : 'Tìm tên khách, email, SĐT...'}
            className="w-full border border-white/[0.06] bg-[#050505] py-2 pl-9 pr-3 text-xs text-white outline-none transition placeholder:text-neutral-500 focus:border-amber-400"
          />
        </div>
      </div>

      {/* 5. MAIN GRID: TABLE & DETAIL PANEL */}
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-12">
        {/* Left Column: Users / Staff Table */}
        <div className="xl:col-span-7 border border-white/[0.05] bg-neutral-950 overflow-hidden">
          <div className="flex items-center justify-between border-b border-white/[0.05] bg-black px-4 py-3">
            <div className="flex items-center gap-2 text-xs font-black uppercase tracking-wider text-white">
              {viewCategory === 'staff' ? (
                <>
                  <Shield className="h-4 w-4 text-amber-400" />
                  <span>Danh sách nhân sự ({filteredUsers.length})</span>
                </>
              ) : (
                <>
                  <Users className="h-4 w-4 text-emerald-400" />
                  <span>Danh sách người dùng / khách hàng ({filteredUsers.length})</span>
                </>
              )}
            </div>
            <span className="font-mono text-[10px] text-neutral-400">
              {filteredUsers.length} tài khoản
            </span>
          </div>

          <div className="divide-y divide-white/[0.03]">
            {viewCategory === 'staff' ? (
              <div className="hidden grid-cols-[36px_minmax(0,1.5fr)_minmax(80px,0.8fr)_minmax(85px,0.9fr)_minmax(80px,0.8fr)_minmax(80px,0.8fr)_36px] gap-2 bg-[#050505] px-3 py-3 text-[8px] uppercase tracking-widest text-neutral-400 lg:grid">
                <span>ID</span>
                <span>Nhân sự</span>
                <span>Vai trò</span>
                <span>Rạp phân công</span>
                <span>Liên hệ</span>
                <span>Trạng thái</span>
                <span className="text-right">Xem</span>
              </div>
            ) : (
              <div className="hidden grid-cols-[36px_minmax(0,1.8fr)_minmax(90px,0.9fr)_minmax(60px,0.6fr)_minmax(85px,0.8fr)_minmax(80px,0.8fr)_36px] gap-2 bg-[#050505] px-3 py-3 text-[8px] uppercase tracking-widest text-neutral-400 lg:grid">
                <span>ID</span>
                <span>Khách hàng</span>
                <span>Điện thoại</span>
                <span>Năm sinh</span>
                <span>Xác minh</span>
                <span>Trạng thái</span>
                <span className="text-right">Xem</span>
              </div>
            )}

            {isUsersLoading ? (
              <div className="px-4 py-12 text-center font-mono text-[10px] uppercase tracking-widest text-neutral-400">
                Đang tải dữ liệu tài khoản...
              </div>
            ) : filteredUsers.length > 0 ? (
              filteredUsers.map((user) => {
                const statusMeta = getStatusMeta(user.status);
                const StatusIcon = statusMeta.icon;
                const roleBadge = getRoleBadge(user.roles);
                const isSelected = String(selectedAdminUser?.id) === String(user.id);
                const assignedCinemaName = user.cinemaId ? (cinemaMap[user.cinemaId] || `Rạp #${user.cinemaId}`) : (
                  user.roles?.includes('ADMIN') ? 'Toàn hệ thống' : '—'
                );

                if (viewCategory === 'staff') {
                  return (
                    <div
                      key={user.id}
                      onClick={() => handleSelectAdminUser(user)}
                      className={`grid cursor-pointer grid-cols-1 gap-2 px-3 py-3 transition hover:bg-white/[0.02] lg:grid-cols-[36px_minmax(0,1.5fr)_minmax(80px,0.8fr)_minmax(85px,0.9fr)_minmax(80px,0.8fr)_minmax(80px,0.8fr)_36px] lg:items-center ${
                        isSelected ? 'border-l-2 border-amber-400 bg-white/[0.03]' : ''
                      }`}
                    >
                      <div className="font-mono text-[10px] text-neutral-400">#{user.id}</div>
                      <div className="min-w-0">
                        <div className="truncate text-xs font-bold text-white">{user.fullName || 'Chưa đặt tên'}</div>
                        <div className="truncate text-[10px] text-neutral-400">{user.email}</div>
                      </div>
                      <div>
                        <span className={`inline-block border px-2 py-0.5 text-[8px] font-black uppercase tracking-wider ${roleBadge.color}`}>
                          {roleBadge.label}
                        </span>
                      </div>
                      <div className="truncate text-[10px] text-sky-300 font-mono">
                        {assignedCinemaName}
                      </div>
                      <div className="truncate text-[10px] text-neutral-400">
                        {user.phone || '—'}
                      </div>
                      <div>
                        <span className={`inline-flex items-center gap-1 border px-2 py-0.5 text-[8px] font-bold uppercase tracking-wider ${statusMeta.className}`}>
                          <StatusIcon className="h-3 w-3" />
                          {user.status || 'ACTIVE'}
                        </span>
                      </div>
                      <div className="text-right">
                        <span className="text-[10px] text-amber-400 font-mono">→</span>
                      </div>
                    </div>
                  );
                }

                // Render for Customer (Khách hàng)
                return (
                  <div
                    key={user.id}
                    onClick={() => handleSelectAdminUser(user)}
                    className={`grid cursor-pointer grid-cols-1 gap-2 px-3 py-3 transition hover:bg-white/[0.02] lg:grid-cols-[36px_minmax(0,1.8fr)_minmax(90px,0.9fr)_minmax(60px,0.6fr)_minmax(85px,0.8fr)_minmax(80px,0.8fr)_36px] lg:items-center ${
                      isSelected ? 'border-l-2 border-emerald-400 bg-white/[0.03]' : ''
                    }`}
                  >
                    <div className="font-mono text-[10px] text-neutral-400">#{user.id}</div>
                    <div className="min-w-0">
                      <div className="truncate text-xs font-bold text-white">{user.fullName || 'Khách hàng'}</div>
                      <div className="truncate text-[10px] text-neutral-400">{user.email}</div>
                    </div>
                    <div className="truncate text-[10px] text-neutral-300 font-mono">
                      {user.phone || '—'}
                    </div>
                    <div className="text-[10px] text-neutral-400 font-mono">
                      {user.birthYear || '—'}
                    </div>
                    <div>
                      <span className={`inline-block border px-1.5 py-0.5 text-[8px] font-mono uppercase tracking-wider ${
                        user.emailVerified ? 'border-emerald-500/40 text-emerald-300 bg-emerald-500/10' : 'border-neutral-700 text-neutral-500'
                      }`}>
                        {user.emailVerified ? '✓ Email' : 'Chưa xác thực'}
                      </span>
                    </div>
                    <div>
                      <span className={`inline-flex items-center gap-1 border px-2 py-0.5 text-[8px] font-bold uppercase tracking-wider ${statusMeta.className}`}>
                        <StatusIcon className="h-3 w-3" />
                        {user.status || 'ACTIVE'}
                      </span>
                    </div>
                    <div className="text-right">
                      <span className="text-[10px] text-emerald-400 font-mono">→</span>
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="px-4 py-12 text-center font-mono text-[10px] uppercase tracking-widest text-neutral-400">
                {viewCategory === 'staff' ? 'Không tìm thấy nhân sự nào phù hợp.' : 'Không tìm thấy khách hàng nào phù hợp.'}
              </div>
            )}
          </div>
        </div>

        {/* Right Column: User Detail & Actions */}
        <div className="xl:col-span-5 border border-white/[0.05] bg-neutral-950 p-5">
          {selectedAdminUser ? (
            <div className="space-y-5">
              <div className="border-b border-white/[0.05] pb-4">
                <span className="text-[8px] font-mono font-black uppercase tracking-widest text-neutral-400">
                  {viewCategory === 'staff' || isStaffMember(selectedAdminUser) ? 'CHI TIẾT NHÂN SỰ #' : 'CHI TIẾT KHÁCH HÀNG #'}{selectedAdminUser.id}
                </span>
                <h3 className="mt-1 text-sm font-black uppercase tracking-wider text-white">
                  {selectedAdminUser.fullName || (isStaffMember(selectedAdminUser) ? 'Chưa đặt tên' : 'Khách hàng')}
                </h3>
                <p className="text-xs text-neutral-400">{selectedAdminUser.email}</p>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <span className={`border px-2 py-0.5 text-[9px] font-black uppercase tracking-wider ${getRoleBadge(selectedAdminUser.roles).color}`}>
                    {getRoleBadge(selectedAdminUser.roles).label}
                  </span>
                  <span className={`inline-flex items-center gap-1 border px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider ${selectedStatus.className}`}>
                    <SelectedStatusIcon className="h-3 w-3" />
                    {selectedAdminUser.status}
                  </span>
                </div>
              </div>

              {/* Thông tin Rạp phân công & Đổi rạp (Dành cho Staff / Manager) */}
              {isStaffMember(selectedAdminUser) && (
                <div className="border border-white/[0.05] bg-black p-4 space-y-3">
                  <div className="flex items-center gap-2 text-[9px] font-black uppercase tracking-widest text-neutral-300">
                    <Building2 className="h-3.5 w-3.5 text-sky-400" />
                    Cụm rạp phân công
                  </div>

                  <div className="text-xs font-bold text-white">
                    {selectedAdminUser.cinemaId ? (
                      <span className="text-sky-300">
                        {cinemaMap[selectedAdminUser.cinemaId] || `Rạp #${selectedAdminUser.cinemaId}`}
                      </span>
                    ) : isSelectedAdmin ? (
                      <span className="text-rose-300">Toàn bộ hệ thống (Admin)</span>
                    ) : (
                      <span className="text-neutral-500 italic">Chưa phân công cụm rạp nào</span>
                    )}
                  </div>

                  {/* Đổi rạp: Chỉ ADMIN có quyền đổi rạp cho Manager hoặc Staff */}
                  {isEffectiveAdmin && (isSelectedManager || isSelectedStaff) && (
                    <form onSubmit={handleReassignCinema} className="mt-3 border-t border-white/[0.06] pt-3 space-y-2">
                      <span className="block text-[8px] font-black uppercase tracking-widest text-neutral-400">
                        Chuyển phân công sang rạp khác
                      </span>
                      <div className="flex gap-2">
                        <select
                          value={reassignCinemaId}
                          onChange={(e) => setReassignCinemaId(e.target.value)}
                          className="flex-1 border border-white/[0.1] bg-[#0a0a0a] px-2.5 py-1.5 text-xs text-white outline-none focus:border-sky-400"
                        >
                          <option value="">-- Chọn rạp mới --</option>
                          {cinemas.map((c) => (
                            <option key={c.id} value={c.id}>
                              {c.name || `Rạp #${c.id}`}
                            </option>
                          ))}
                        </select>
                        <button
                          type="submit"
                          disabled={isReassigning || !reassignCinemaId || String(reassignCinemaId) === String(selectedAdminUser.cinemaId)}
                          className="border border-sky-400 bg-sky-500 px-3 py-1.5 text-[9px] font-black uppercase tracking-wider text-black transition hover:bg-sky-400 disabled:opacity-40"
                        >
                          {isReassigning ? <RefreshCw className="h-3 w-3 animate-spin" /> : 'Lưu rạp'}
                        </button>
                      </div>
                      {reassignNotice && <p className="text-[9px] text-emerald-300 font-bold">{reassignNotice}</p>}
                      {reassignError && <p className="text-[9px] text-rose-300">{reassignError}</p>}
                    </form>
                  )}
                </div>
              )}

              {/* Thông tin xác minh & ngày tạo */}
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                <div className="border border-white/[0.05] bg-black p-3">
                  <div className="flex items-center gap-2 text-[9px] uppercase text-neutral-400">
                    <BadgeCheck className="h-3.5 w-3.5" /> Xác minh
                  </div>
                  <div className="mt-1 text-xs font-bold text-white">
                    Email: {selectedAdminUser.emailVerified ? 'Đã xác minh' : 'Chưa'}
                  </div>
                  <div className="text-[10px] text-neutral-400">
                    SĐT: {selectedAdminUser.phone || 'Chưa cung cấp'}
                  </div>
                </div>
                <div className="border border-white/[0.05] bg-black p-3">
                  <div className="flex items-center gap-2 text-[9px] uppercase text-neutral-400">
                    <Clock className="h-3.5 w-3.5" /> Cập nhật
                  </div>
                  <div className="mt-1 text-xs font-bold text-white">
                    {formatDateTime(selectedAdminUser.updatedAt)}
                  </div>
                  <div className="text-[10px] text-neutral-400">
                    Tạo: {formatDateTime(selectedAdminUser.createdAt)}
                  </div>
                </div>
              </div>

              {/* Staff Profile Form (Nếu là STAFF) */}
              {isSelectedStaff && (
                <form onSubmit={saveStaffProfile} className="border border-amber-500/20 bg-black p-4 space-y-3">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="text-[10px] font-black uppercase tracking-widest text-amber-300">
                        Hồ sơ nhân viên soát vé (Staff profile)
                      </div>
                      <p className="mt-1 text-[10px] text-neutral-400">
                        Mã nhân viên, vị trí và trạng thái nội bộ.
                      </p>
                    </div>
                    {isProfileLoading && <RefreshCw className="h-4 w-4 animate-spin text-amber-300" />}
                  </div>

                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <label className="space-y-1.5">
                      <span className="text-[9px] font-black uppercase tracking-widest text-neutral-200">Mã nhân viên *</span>
                      <input
                        value={profileForm.employeeCode}
                        onChange={(event) => updateProfileForm('employeeCode', event.target.value)}
                        placeholder="EMP001"
                        className="w-full border border-white/[0.06] bg-neutral-950 px-3 py-2 text-xs text-white outline-none focus:border-amber-400"
                      />
                    </label>
                    <label className="space-y-1.5">
                      <span className="text-[9px] font-black uppercase tracking-widest text-neutral-200">Vị trí *</span>
                      <input
                        value={profileForm.position}
                        onChange={(event) => updateProfileForm('position', event.target.value)}
                        placeholder="Gate Staff"
                        className="w-full border border-white/[0.06] bg-neutral-950 px-3 py-2 text-xs text-white outline-none focus:border-amber-400"
                      />
                    </label>
                  </div>

                  <div className="grid grid-cols-3 gap-2">
                    {STAFF_PROFILE_STATUS_OPTIONS.map((status) => (
                      <button
                        key={status}
                        type="button"
                        onClick={() => updateProfileForm('status', status)}
                        className={`border px-2 py-1.5 text-[8px] font-black uppercase tracking-wider transition ${
                          profileForm.status === status
                            ? 'border-amber-400 bg-amber-500 text-black'
                            : 'border-white/[0.06] bg-neutral-950 text-neutral-300 hover:border-amber-400 hover:text-amber-300'
                        }`}
                      >
                        {status}
                      </button>
                    ))}
                  </div>

                  {profileError && <div className="text-[10px] font-bold text-rose-300">{profileError}</div>}
                  <button
                    type="submit"
                    disabled={isProfileSaving}
                    className="flex items-center justify-center gap-2 border border-amber-400 bg-amber-500 px-4 py-2 text-[10px] font-black uppercase tracking-widest text-black transition hover:bg-amber-300 disabled:opacity-50"
                  >
                    {isProfileSaving ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <BadgeCheck className="h-3.5 w-3.5" />}
                    {selectedStaffProfile ? 'Cập nhật profile' : 'Tạo profile'}
                  </button>
                </form>
              )}

              {/* Đổi trạng thái tài khoản (Khóa / Kích hoạt) */}
              <div className="border border-white/[0.05] bg-black p-4 space-y-3">
                <div className="text-[10px] font-black uppercase tracking-widest text-neutral-200">
                  {isStaffMember(selectedAdminUser) ? 'Trạng thái tài khoản nhân sự' : 'Trạng thái tài khoản khách hàng'}
                </div>

                {isViewingSelf ? (
                  <div className="border border-amber-500/20 bg-amber-500/10 px-3 py-2 text-[10px] font-bold text-amber-200">
                    Không thể đổi trạng thái của chính tài khoản đang đăng nhập.
                  </div>
                ) : !canManagerModifyUser ? (
                  <div className="border border-rose-500/20 bg-rose-500/10 px-3 py-2 text-[10px] font-bold text-rose-200">
                    Manager không có quyền khóa hoặc đổi trạng thái của tài khoản Admin / Manager khác.
                  </div>
                ) : null}

                <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                  {USER_STATUS_OPTIONS.map((status) => (
                    <button
                      key={status}
                      type="button"
                      disabled={isViewingSelf || !canManagerModifyUser || isUserStatusSaving || selectedAdminUser.status === status}
                      onClick={() => handleUpdateAdminUserStatus(selectedAdminUser.id, status)}
                      className={`min-w-0 border px-2 py-2 text-[8px] font-black uppercase tracking-wider transition disabled:cursor-not-allowed disabled:opacity-40 ${
                        selectedAdminUser.status === status
                          ? (viewCategory === 'users' ? 'border-emerald-400 bg-emerald-500 text-black' : 'border-amber-400 bg-amber-500 text-black')
                          : 'border-white/[0.06] bg-neutral-950 text-neutral-300 hover:border-amber-400 hover:text-amber-300'
                      }`}
                    >
                      <span className="block truncate">{status}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="py-20 text-center text-neutral-400">
              <Users className="mx-auto h-8 w-8 text-neutral-400" />
              <p className="mt-3 text-xs font-mono uppercase tracking-widest">
                {viewCategory === 'staff' ? 'Chưa chọn nhân sự' : 'Chưa chọn khách hàng'}
              </p>
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}
