import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import {
  Camera, CreditCard, Landmark, Lock, LogOut, Settings, User,
  ChevronRight, Award, Flame, Eye, Film, Sparkles,
  ChevronDown, Check, Shield, Volume2, VolumeX, EyeOff,
  Save, Trash2, Sliders, Smartphone, Mail, Phone, Cake, BadgeCheck, Loader2, Ticket, ScanLine, Wallet, ArrowUpRight, RefreshCw,
  Plus, ArrowDownLeft, X, CheckCircle2, FileText, Filter, AlertCircle, Copy, Clock, XCircle
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { expireAuthSession, getStoredAuth, normalizeUser } from '../../services/authService';
import { userService } from '../../services/userService';
import { bookingService } from '../../services/bookingService';
import { loyaltyService } from '../../services/loyaltyService';
import { walletService } from '../../services/walletService';
import { recommendationService } from '../../services/recommendationService';
import {
  MAX_NAME_LENGTH,
  NAME_VALIDATION_MESSAGE,
  PASSWORD_VALIDATION_MESSAGE,
  PHONE_VALIDATION_MESSAGE,
  isStrongPassword,
  isValidVietnamPhone,
  normalizeNameInput,
  normalizePhoneInput
} from '../../utils/validation';
import { useMovies } from '../../stores/useMovieStore';
import { useAuthStore } from '../../stores/useAuthStore';
import { useUiStore } from '../../stores/useUiStore';

const DEFAULT_LOYALTY_CONFIG = {
  expiryMonth: 12,
  expiryDay: 31,
  expiryTime: '23:59:59',
  lastExpiredAt: null,
  lastResetAt: null,
  lastResetSource: null
};

const formatDateTimeVi = (value) => {
  if (!value) return '';
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleString('vi-VN', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  });
};

const buildLoyaltyExpiryDateTime = (config = DEFAULT_LOYALTY_CONFIG) => {
  const month = Math.max(1, Math.min(12, Number(config.expiryMonth || 12)));
  const maxDay = new Date(new Date().getFullYear(), month, 0).getDate();
  const day = Math.max(1, Math.min(maxDay, Number(config.expiryDay || 31)));
  const [hour = 23, minute = 59, second = 59] = String(config.expiryTime || '23:59:59').split(':').map(Number);
  const now = new Date();
  const candidate = new Date(now.getFullYear(), month - 1, day, hour || 0, minute || 0, second || 0);
  if (candidate.getTime() < now.getTime()) candidate.setFullYear(candidate.getFullYear() + 1);
  return candidate;
};

export default function ProfileView() {
  const navigate = useNavigate();
  const isLoggedIn = useAuthStore((state) => state.isLoggedIn);
  const currentUser = useAuthStore((state) => state.currentUser);
  const currentRole = useAuthStore((state) => state.currentRole);
  const setCurrentUser = useAuthStore((state) => state.setCurrentUser);
  const setCurrentRole = useAuthStore((state) => state.setCurrentRole);
  const handleLogout = useAuthStore((state) => state.handleLogout);
  const showToast = useUiStore((state) => state.showToast);
  const { moviesList } = useMovies();
  const onLogout = () => handleLogout({ navigate, showToast });
  const onSelectMovie = (id) => navigate(`/movies/${id}`);
  const onTabChange = (tab) => { const paths = { home: '/', explore: '/movies', 'my-tickets': '/tickets' }; navigate(paths[tab] || '/'); };
  const onProfileUpdated = (user) => { setCurrentUser(user); setCurrentRole(user.role || 'user'); };
  const [profileImg, setProfileImg] = useState('https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcRb30EroFOo6S_-d49SOIyTINg8t7Vpmm_lpcJ1zZ2xNA&s=10');
  const [name, setName] = useState(currentUser?.name || 'MINH HỒNG (VIP)');
  const [isEditingName, setIsEditingName] = useState(false);
  const [isSavingName, setIsSavingName] = useState(false);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const avatarInputRef = React.useRef(null);

  // Advanced Interactive Settings States
  const [activePanel, setActivePanel] = useState(null); // null | 'profile' | 'payment' | 'security' | 'vibe'
  const [soundOn, setSoundOn] = useState(true);
  const [glowColor, setGlowColor] = useState('gold'); // 'gold' | 'neon' | 'ruby' | 'emerald'

  // Settings - Profile Form states
  const [profileNameInput, setProfileNameInput] = useState('Minh Hong');
  const [profileBioInput, setProfileBioInput] = useState('Chuyên gia phê bình Điện ảnh VIP Gold của CinePremier.');
  const [profileEmailInput, setProfileEmailInput] = useState('minhhong.vip@cinepremier.vn');
  const [profilePhoneInput, setProfilePhoneInput] = useState('');
  const [profileDateOfBirth, setProfileDateOfBirth] = useState('');
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [recentBookings, setRecentBookings] = useState([]);
  const [loyaltyPoints, setLoyaltyPoints] = useState(0);
  const [loyaltyConfig, setLoyaltyConfig] = useState(DEFAULT_LOYALTY_CONFIG);
  const [wallet, setWallet] = useState(null);
  const [walletTxs, setWalletTxs] = useState([]);
  const [withdrawals, setWithdrawals] = useState([]);
  const [showWithdrawals, setShowWithdrawals] = useState(false);
  const [showWithdrawForm, setShowWithdrawForm] = useState(false);
  const [withdrawForm, setWithdrawForm] = useState({ amount: '', bankName: '', accountNumber: '', accountHolder: '', walletPhone: '' });
  const [withdrawLoading, setWithdrawLoading] = useState(false);
  const [withdrawErrors, setWithdrawErrors] = useState({});
  const [bankList, setBankList] = useState([]);
  const [bankSearch, setBankSearch] = useState('');
  const [showBankDropdown, setShowBankDropdown] = useState(false);
  const [isProfileLoading, setIsProfileLoading] = useState(false);

  // CineWallet Linked Bank States
  const [linkedBank, setLinkedBank] = useState(null);
  const [bankForm, setBankForm] = useState({ bankName: '', accountNumber: '', accountHolder: '' });
  const [bankErrors, setBankErrors] = useState({});
  const [isLinkingBank, setIsLinkingBank] = useState(false);
  const [bankDropdownOpen, setBankDropdownOpen] = useState(false);

  // Tự động tải danh sách ngân hàng VietQR & tài khoản đã liên kết
  React.useEffect(() => {
    fetch('https://api.vietqr.io/v2/banks')
      .then(r => r.json())
      .then(d => {
        if (d && Array.isArray(d.data)) setBankList(d.data);
      })
      .catch(() => { });
  }, []);

  React.useEffect(() => {
    const uid = currentUser?.id || currentUser?.sub || currentUser?.email || 'default';
    const storageKey = `cinewallet_linked_bank_${uid}`;
    const saved = localStorage.getItem(storageKey);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed && parsed.bankName && parsed.accountNumber) {
          setLinkedBank(parsed);
          setBankForm({
            bankName: parsed.bankName || '',
            accountNumber: parsed.accountNumber || '',
            accountHolder: parsed.accountHolder || '',
          });
          return;
        }
      } catch (e) { }
    }

    // Tự động nhận diện từ lịch sử rút tiền trước đó nếu có
    if (withdrawals && withdrawals.length > 0) {
      const lastWd = withdrawals[0];
      if (lastWd && lastWd.bankName && lastWd.accountNumber) {
        const detected = {
          bankName: lastWd.bankName,
          accountNumber: lastWd.accountNumber,
          accountHolder: lastWd.accountHolder || (currentUser?.name || currentUser?.fullName || ''),
        };
        setLinkedBank(detected);
        setBankForm(detected);
        localStorage.setItem(storageKey, JSON.stringify(detected));
      }
    }
  }, [currentUser, withdrawals]);

  // Xử lý liên kết tài khoản ngân hàng mới
  const handleLinkBank = () => {
    const errs = {};
    if (!bankForm.bankName) errs.bankName = 'Vui lòng chọn ngân hàng';
    if (!bankForm.accountNumber || bankForm.accountNumber.length < 8) {
      errs.accountNumber = 'Số tài khoản phải từ 8 đến 15 chữ số';
    } else if (bankForm.accountNumber.length > 15) {
      errs.accountNumber = 'Số tài khoản không được vượt quá 15 chữ số';
    }
    const cleanHolder = (bankForm.accountHolder || '').trim().toUpperCase();
    if (!cleanHolder || cleanHolder.length < 2) {
      errs.accountHolder = 'Vui lòng nhập họ tên chủ tài khoản hợp lệ';
    }
    if (Object.keys(errs).length > 0) {
      setBankErrors(errs);
      return;
    }

    setIsLinkingBank(true);
    setBankErrors({});
    try {
      const selectedBankMeta = bankList.find(b => (b.short_name || b.shortName) === bankForm.bankName);
      const dataToSave = {
        bankName: bankForm.bankName,
        accountNumber: bankForm.accountNumber,
        accountHolder: cleanHolder,
        bankLogo: selectedBankMeta?.logo || null,
        bankFullName: selectedBankMeta?.name || bankForm.bankName,
        updatedAt: new Date().toISOString()
      };
      const uid = currentUser?.id || currentUser?.sub || currentUser?.email || 'default';
      localStorage.setItem(`cinewallet_linked_bank_${uid}`, JSON.stringify(dataToSave));
      setLinkedBank(dataToSave);
      setBankForm(dataToSave);
      playPing(987.77, 'sine', 0.25);
      showToast('✓ Đã xác thực & liên kết tài khoản ngân hàng thành công!', 'success');
    } catch (e) {
      setBankErrors({ general: 'Không thể lưu liên kết tài khoản. Vui lòng thử lại.' });
    } finally {
      setIsLinkingBank(false);
    }
  };

  const handleUnlinkBank = () => {
    const uid = currentUser?.id || currentUser?.sub || currentUser?.email || 'default';
    localStorage.removeItem(`cinewallet_linked_bank_${uid}`);
    setLinkedBank(null);
    setBankForm({ bankName: '', accountNumber: '', accountHolder: '' });
    showToast('Đã gỡ liên kết tài khoản ngân hàng.');
  };

  const handleCreateWithdrawal = async () => {
    const errs = {};
    const amountNum = Number(withdrawForm.amount);
    const balanceNum = Number(wallet?.balance || 0);

    if (!withdrawForm.amount || isNaN(amountNum) || amountNum < 10000) {
      errs.amount = 'Số tiền rút tối thiểu là 10.000đ';
    } else if (amountNum > balanceNum) {
      errs.amount = `Số dư khả dụng không đủ (tối đa ${balanceNum.toLocaleString('vi-VN')}đ)`;
    }

    if (!linkedBank || !linkedBank.bankName || !linkedBank.accountNumber) {
      errs.general = 'Chưa có tài khoản ngân hàng liên kết. Vui lòng liên kết tài khoản tại mục Phương thức thanh toán.';
    }

    if (Object.keys(errs).length > 0) {
      setWithdrawErrors(errs);
      return;
    }

    const { accessToken } = getStoredAuth();
    if (!accessToken) {
      setWithdrawErrors({ general: 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.' });
      return;
    }

    setWithdrawLoading(true);
    setWithdrawErrors({});
    try {
      await walletService.createWithdrawal(accessToken, {
        amount: amountNum,
        bankName: linkedBank.bankName,
        accountNumber: linkedBank.accountNumber,
        accountHolder: linkedBank.accountHolder,
        walletPhone: withdrawForm.walletPhone || null,
      });

      const [w, txData, wdData] = await Promise.all([
        walletService.getWallet(accessToken),
        walletService.getTransactions(accessToken, { page: 0, size: 30 }),
        walletService.getMyWithdrawals(accessToken, { page: 0, size: 30 }),
      ]);
      setWallet(w);
      setWalletTxs(txData?.content ?? txData?.items ?? []);
      setWithdrawals(wdData?.content ?? wdData?.items ?? []);
      setShowWithdrawForm(false);
      setShowWithdrawals(true);
      setWalletSubTab('WITHDRAWALS');
      setWithdrawForm(f => ({ ...f, amount: '' }));
      showToast('✓ Yêu cầu rút tiền đã được gửi thành công!', 'success');
    } catch (e) {
      setWithdrawErrors({ general: e.message || 'Không thể tạo yêu cầu rút tiền. Vui lòng thử lại.' });
    } finally {
      setWithdrawLoading(false);
    }
  };

  // CineWallet - Lọc & Chi tiết giao dịch hoàn tiền & Rút tiền
  const [walletSubTab, setWalletSubTab] = useState('WITHDRAWALS'); // 'WITHDRAWALS' | 'TRANSACTIONS'
  const [txFilter, setTxFilter] = useState('ALL'); // 'ALL' | 'REFUND' | 'WITHDRAW'
  const [selectedTxDetail, setSelectedTxDetail] = useState(null);
  const [selectedWdDetail, setSelectedWdDetail] = useState(null);

  // Khóa cuộn trang khi modal đang mở để footer không bao giờ bị cuộn lên đè vào modal
  React.useEffect(() => {
    if (selectedWdDetail || selectedTxDetail) {
      const originalOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = originalOverflow;
      };
    }
  }, [selectedWdDetail, selectedTxDetail]);

  // Settings - Password & Security states
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showOldPass, setShowOldPass] = useState(false);
  const [showNewPass, setShowNewPass] = useState(false);
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [twoFactorAuth, setTwoFactorAuth] = useState(true);
  const [passwordNotification, setPasswordNotification] = useState(null); // { type, text }
  const [isPurgingAiData, setIsPurgingAiData] = useState(false);

  const handlePurgeAiData = async () => {
    if (!currentUser?.id) {
      showToast('Không tìm thấy thông tin tài khoản.');
      return;
    }
    const confirmed = window.confirm('Bạn có chắc chắn muốn xóa toàn bộ lịch sử đề xuất và sở thích AI của mình? (Tuân thủ quyền riêng tư GDPR). Sau khi xóa, các đề xuất sẽ trở về trạng thái mặc định.');
    if (!confirmed) return;

    setIsPurgingAiData(true);
    try {
      await recommendationService.purgeUserData(currentUser.id);
      showToast('Đã xóa thành công toàn bộ dữ liệu đề xuất AI của bạn.', 'success');
    } catch (err) {
      showToast(err?.message || 'Không thể xóa dữ liệu đề xuất AI lúc này.');
    } finally {
      setIsPurgingAiData(false);
    }
  };

  React.useEffect(() => {
    if (currentUser) {
      const displayName = currentUser.name || currentUser.fullName || currentUser.email;
      setName(displayName);
      setProfileNameInput(displayName);
      if (currentUser.email) {
        setProfileEmailInput(currentUser.email);
      }
      setProfilePhoneInput(normalizePhoneInput(currentUser.phone || ''));
      setProfileDateOfBirth(currentUser.birthYear ? String(currentUser.birthYear) : '');
      if (currentUser.avatarUrl) setProfileImg(currentUser.avatarUrl);
    }
  }, [currentUser]);
  React.useEffect(() => {
    if (!isLoggedIn) return;
    const { accessToken } = getStoredAuth();
    if (!accessToken) return;

    let cancelled = false;
    setIsProfileLoading(true);
    Promise.all([
      userService.getMyProfile(accessToken),
      bookingService.getMyBookings(accessToken),
      loyaltyService.getMyLoyalty(accessToken).catch(() => null),
      loyaltyService.getConfiguration(accessToken).catch(() => null)
    ])
      .then(([profile, bookings, loyalty, loyaltyConfiguration]) => {
        if (cancelled) return;
        const nextUser = normalizeUser(profile, profile.roles || currentUser?.roles || []);
        localStorage.setItem('cinepremier_auth_user', JSON.stringify(nextUser));
        onProfileUpdated(nextUser);
        const bookingList = Array.isArray(bookings) ? bookings : (bookings?.items ?? bookings?.content ?? []);
        setRecentBookings(bookingList);
        setLoyaltyPoints(Number(loyalty?.points ?? 0));
        setLoyaltyConfig({ ...DEFAULT_LOYALTY_CONFIG, ...(loyaltyConfiguration || {}) });
        // Fetch wallet + giao dịch + lịch sử rút tiền
        Promise.all([
          walletService.getWallet(accessToken),
          walletService.getTransactions(accessToken, { page: 0, size: 30 }),
          walletService.getMyWithdrawals(accessToken, { page: 0, size: 30 }),
        ]).then(([w, txData, wdData]) => {
          setWallet(w);
          setWalletTxs(txData?.content ?? txData?.items ?? []);
          setWithdrawals(wdData?.content ?? wdData?.items ?? []);
        }).catch(() => { });
      })
      .catch((error) => {
        if (!cancelled) showToast(error.message || 'Không thể tải dữ liệu hồ sơ từ hệ thống.');
      })
      .finally(() => {
        if (!cancelled) setIsProfileLoading(false);
      });

    return () => { cancelled = true; };
  }, [isLoggedIn]);

  const handleSaveProfile = async () => {
    const cleanName = profileNameInput.trim();
    const cleanPhone = profilePhoneInput.trim();

    if (!cleanName) {
      showToast("Vui lòng nhập tên hồ sơ.");
      return;
    }
    if (cleanName.length > MAX_NAME_LENGTH) {
      showToast(NAME_VALIDATION_MESSAGE);
      return;
    }
    if (!isValidVietnamPhone(cleanPhone)) {
      showToast(PHONE_VALIDATION_MESSAGE);
      return;
    }

    const { accessToken } = getStoredAuth();
    if (!accessToken) {
      showToast("Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.");
      expireAuthSession();
      return;
    }

    setIsSavingProfile(true);
    try {
      const updatedProfile = await userService.updateMyProfile(accessToken, {
        fullName: cleanName,
        phone: cleanPhone,
        birthYear: profileDateOfBirth ? parseInt(profileDateOfBirth) : null
      });
      const nextUser = normalizeUser(updatedProfile, updatedProfile.roles || currentUser?.roles || []);
      localStorage.setItem('cinepremier_auth_user', JSON.stringify(nextUser));
      setName(nextUser.name);
      onProfileUpdated(nextUser);
      playPing(880, 'sine', 0.25);
      setIsEditingName(false);
      showToast("Thông tin hồ sơ được cập nhật thành công!");

      setActivePanel(null);
    } catch (error) {
      showToast(error.message || "Không thể cập nhật hồ sơ.");
    } finally {
      setIsSavingProfile(false);
    }
  };

  const handleChangePassword = async () => {
    if (!oldPassword || !newPassword || !confirmPassword) {
      showToast("Vui lòng nhập đầy đủ mật khẩu hiện tại, mật khẩu mới và xác nhận mật khẩu.");
      return;
    }
    if (!isStrongPassword(newPassword)) {
      showToast(PASSWORD_VALIDATION_MESSAGE);
      return;
    }
    if (newPassword !== confirmPassword) {
      showToast("Mật khẩu xác nhận không khớp.");
      return;
    }

    const { accessToken } = getStoredAuth();
    if (!accessToken) {
      showToast("Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.");
      expireAuthSession();
      return;
    }

    setIsChangingPassword(true);
    try {
      await userService.changeMyPassword(accessToken, {
        oldPassword,
        newPassword,
        confirmPassword
      });
      playPing(880, 'sine', 0.25);
      showToast("Đổi mật khẩu thành công.");
      setPasswordNotification({ type: 'success', text: 'Mật khẩu đã được cập nhật an toàn.' });
      setOldPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setActivePanel(null);
    } catch (error) {
      showToast(error.message || "Không thể đổi mật khẩu. Vui lòng kiểm tra mật khẩu hiện tại.");
      setPasswordNotification({ type: 'error', text: error.message || 'Không thể đổi mật khẩu.' });
    } finally {
      setIsChangingPassword(false);
    }
  };

  const playPing = (freq = 440, type = 'sine', duration = 0.1) => {
    if (!soundOn) return;
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, ctx.currentTime);
      gain.gain.setValueAtTime(0.04, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + duration);
    } catch (e) { }
  };

  const recentApiBookings = [...recentBookings]
    .sort((a, b) => new Date(b.paidAt || b.showtimeStart || 0) - new Date(a.paidAt || a.showtimeStart || 0))
    .slice(0, 3);
  const watchedCount = recentBookings.filter((booking) => booking.status === 'USED').length;
  const loyaltyResetScheduleLabel = formatDateTimeVi(buildLoyaltyExpiryDateTime(loyaltyConfig));
  const loyaltyAdminResetAt = loyaltyConfig.lastResetSource === 'ADMIN'
    ? formatDateTimeVi(loyaltyConfig.lastResetAt || loyaltyConfig.lastExpiredAt)
    : '';
  const memberSince = currentUser?.createdAt
    ? new Date(currentUser.createdAt).toLocaleDateString('vi-VN', { month: '2-digit', year: 'numeric' })
    : 'Đang cập nhật';
  const getBookingPoster = (booking) => (
    moviesList.find((movie) => movie.title === booking.movieTitle)?.posterUrl
    || 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcRb30EroFOo6S_-d49SOIyTINg8t7Vpmm_lpcJ1zZ2xNA&s=10'
  );
  const bookingStatusMeta = {
    PAID: { label: 'Đã thanh toán', className: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300' },
    USED: { label: 'Đã sử dụng', className: 'border-neutral-600 bg-neutral-900 text-neutral-400' },
    HOLDING: { label: 'Đang giữ', className: 'border-amber-500/30 bg-amber-500/10 text-amber-300' },
    CANCELLED: { label: 'Đã hủy', className: 'border-rose-500/30 bg-rose-500/10 text-rose-300' },
    EXPIRED: { label: 'Hết hạn', className: 'border-rose-500/20 bg-rose-950/20 text-rose-400' },
    REFUND_REQUESTED: { label: 'Chờ hoàn tiền', className: 'border-sky-500/30 bg-sky-500/10 text-sky-300' },
    REFUNDED: { label: 'Đã hoàn tiền', className: 'border-purple-500/30 bg-purple-500/10 text-purple-300' }
  };

  // Radar Chart Calculations for 5-axis polygon:
  // Center is (100, 100), Radius is 60
  // Categories: SCI-FI (0 deg -> dynamic coordinates: point index 0), NOIR (72 deg), THRILLER (144 deg), DRAMA (216 deg), ACTION (288 deg)
  const categories = ['SCI-FI', 'NOIR', 'THRILLER', 'DRAMA', 'ACTION'];
  // Relative percentages representing personal metrics matching the screenshots
  const values = [0.85, 0.45, 0.65, 0.55, 0.80];

  const getCoordinates = (index, value) => {
    const angle = (Math.PI * 2 / 5) * index - Math.PI / 2; // Subtracting PI/2 to align the first axis strictly to top
    const radius = 60 * value;
    const x = 100 + radius * Math.cos(angle);
    const y = 100 + radius * Math.sin(angle);
    return `${x},${y}`;
  };

  const polyPoints = categories.map((_, i) => getCoordinates(i, values[i])).join(' ');
  const outerWebPoints = categories.map((_, i) => getCoordinates(i, 1.0)).join(' ');
  const innerWebPoints1 = categories.map((_, i) => getCoordinates(i, 0.75)).join(' ');
  const innerWebPoints2 = categories.map((_, i) => getCoordinates(i, 0.5)).join(' ');
  const innerWebPoints3 = categories.map((_, i) => getCoordinates(i, 0.25)).join(' ');

  // Get labels locations outside the radar
  const labelPositions = [
    { name: 'SCI-FI', x: 100, y: 22, textAnchor: 'middle' },
    { name: 'NOIR', x: 168, y: 76, textAnchor: 'start' },
    { name: 'THRILLER', x: 146, y: 154, textAnchor: 'start' },
    { name: 'DRAMA', x: 50, y: 154, textAnchor: 'end' },
    { name: 'ACTION', x: 28, y: 76, textAnchor: 'end' }
  ];

  const handleTriggerEditName = async () => {
    if (!isEditingName) {
      setName(currentUser?.name || currentUser?.fullName || '');
      setIsEditingName(true);
      return;
    }

    const cleanName = name.trim();
    if (!cleanName || cleanName.length > MAX_NAME_LENGTH) {
      showToast(!cleanName ? 'Vui lòng nhập tên hồ sơ.' : NAME_VALIDATION_MESSAGE);
      return;
    }

    const { accessToken } = getStoredAuth();
    if (!accessToken) {
      expireAuthSession();
      return;
    }

    setIsSavingName(true);
    try {
      const updatedProfile = await userService.updateMyProfile(accessToken, {
        fullName: cleanName,
        phone: currentUser?.phone || profilePhoneInput || null,
        birthYear: currentUser?.birthYear || (profileDateOfBirth ? Number(profileDateOfBirth) : null)
      });
      const nextUser = normalizeUser(updatedProfile, updatedProfile.roles || currentUser?.roles || []);
      localStorage.setItem('cinepremier_auth_user', JSON.stringify(nextUser));
      onProfileUpdated(nextUser);
      setProfileNameInput(nextUser.name);
      setName(nextUser.name);
      setIsEditingName(false);
      showToast('Đã cập nhật tên hồ sơ.');
    } catch (error) {
      showToast(error.message || 'Không thể cập nhật tên hồ sơ.');
    } finally {
      setIsSavingName(false);
    }
  };

  const handleProfileImageChange = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    const { accessToken } = getStoredAuth();
    if (!accessToken) {
      expireAuthSession();
      return;
    }

    setIsUploadingAvatar(true);
    try {
      const updatedProfile = await userService.uploadMyAvatar(accessToken, file);
      const nextUser = normalizeUser(updatedProfile, updatedProfile.roles || currentUser?.roles || []);
      localStorage.setItem('cinepremier_auth_user', JSON.stringify(nextUser));
      onProfileUpdated(nextUser);
      setProfileImg(nextUser.avatarUrl);
      showToast('Đã cập nhật ảnh đại diện.');
    } catch (error) {
      showToast(error.message || 'Không thể tải ảnh đại diện.');
    } finally {
      setIsUploadingAvatar(false);
    }
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 space-y-12">

      {!isLoggedIn && (
        <div className="border border-white/10 bg-[#0E0E0E] p-6 text-center space-y-4 max-w-md mx-auto">
          <Award className="h-10 w-10 text-white mx-auto animate-pulse" />
          <h3 className="text-base font-serif font-light italic text-white uppercase tracking-wider">CinePremier VIP Club</h3>
          <p className="text-xs text-neutral-400 font-sans leading-relaxed">
            Vui lòng đăng nhập tài khoản Cinephile VIP của quý khách để tích lũy CinePoints, thăng hạng thành viên và kiểm tra toàn bộ lịch sử lịch rạp cá nhân.
          </p>
          <button
            onClick={onOpenOTP}
            className="border border-white bg-white hover:bg-black hover:text-white text-black px-6 py-2.5 text-xs font-sans font-bold tracking-widest uppercase transition-all"
          >
            Đăng nhập ngay
          </button>
        </div>
      )}

      {isLoggedIn && (
        <>
          {currentRole === 'admin' && (
            <div className="border border-amber-500/25 bg-[#090806] p-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-[9px] font-black uppercase tracking-[0.25em] text-amber-500">Tài khoản quản trị viên</p>
                  <h2 className="mt-1 text-sm font-black uppercase tracking-[0.18em] text-white">Chọn khu vực làm việc</h2>
                </div>
                <div className="flex flex-col gap-2 sm:flex-row">
                  <button
                    type="button"
                    className="flex items-center justify-center gap-2 border border-white bg-white px-5 py-3 text-[10px] font-black uppercase tracking-widest text-black"
                  >
                    <User className="h-4 w-4" />
                    Thông tin cá nhân
                  </button>
                  <button
                    type="button"
                    onClick={() => navigate('/admin/overview')}
                    className="flex items-center justify-center gap-2 border border-amber-500/50 bg-amber-500/10 px-5 py-3 text-[10px] font-black uppercase tracking-widest text-amber-300 transition hover:bg-amber-500 hover:text-black"
                  >
                    <Shield className="h-4 w-4" />
                    Quản trị viên
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* {currentRole === 'staff' && (
            <div className="border border-emerald-400/25 bg-[#050b08] p-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-[9px] font-black uppercase tracking-[0.25em] text-emerald-400">Tài khoản nhân viên</p>
                  <h2 className="mt-1 text-sm font-black uppercase tracking-[0.18em] text-white">Khu vực làm việc tại quầy</h2>
                  <p className="mt-1 text-xs text-neutral-500">Check-in vé bằng QR và đổi trạng thái bắp nước khi hết hàng đột ngột.</p>
                </div>
                <div className="flex flex-col gap-2 sm:flex-row">
                  <button
                    type="button"
                    className="flex items-center justify-center gap-2 border border-white bg-white px-5 py-3 text-[10px] font-black uppercase tracking-widest text-black"
                  >
                    <User className="h-4 w-4" />
                    Thông tin cá nhân
                  </button>
                  <button
                    type="button"
                    onClick={() => navigate('/staff')}
                    className="flex items-center justify-center gap-2 border border-emerald-400/50 bg-emerald-400/10 px-5 py-3 text-[10px] font-black uppercase tracking-widest text-emerald-300 transition hover:bg-emerald-400 hover:text-black"
                  >
                    <ScanLine className="h-4 w-4" />
                    Check-in vé
                  </button>
                </div>
              </div>
            </div>
          )} */}

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">

            {/* LEFT SECTION: MAIN PROFILE SUMMARY INFO & BOOKINGS */}
            <div className="lg:col-span-8 space-y-8">

              {/* HERO PROFILE BOX BACKGROUND */}
              <div className="relative border border-white/10 bg-[#070707] p-6 md:p-8 overflow-hidden">

                <div className="absolute right-0 top-0 text-[100px] font-bold text-neutral-900/10 italic select-none font-serif leading-none -mr-10 -mt-8 pointer-events-none uppercase">
                  VIP
                </div>

                <div className="flex flex-col md:flex-row md:items-start items-center gap-6 relative z-10">

                  {/* Profile circular avatar with editor button */}
                  <div className="relative group md:translate-y-[65px]">
                    <input
                      ref={avatarInputRef}
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      onChange={handleProfileImageChange}
                      className="hidden"
                    />
                    <div className="h-24 w-24 overflow-hidden rounded-md border border-white/15 bg-neutral-950 flex-shrink-0 shadow-2xl">
                      <img
                        src={profileImg}
                        alt={name}
                        className="h-full w-full object-cover group-hover:scale-105 transition duration-500"
                        referrerPolicy="no-referrer"
                      />
                    </div>
                    <button
                      onClick={() => avatarInputRef.current?.click()}
                      disabled={isUploadingAvatar}
                      className="absolute -bottom-2 -right-2 bg-black border border-white/20 hover:border-white p-2 text-white shadow-xl hover:scale-110 transition shrink-0"
                      title="Tải ảnh đại diện từ máy tính"
                    >
                      {isUploadingAvatar ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Camera className="h-3.5 w-3.5" />}
                    </button>
                  </div>

                  {/* Name and metrics progress */}
                  <div className="flex-1 space-y-4 text-center md:text-left min-w-0">
                    <div className="space-y-1">
                      <div className="flex flex-col sm:flex-row sm:items-center gap-2 justify-center md:justify-start">
                        {isEditingName ? (
                          <input
                            type="text"
                            maxLength={MAX_NAME_LENGTH}
                            value={name}
                            onChange={(e) => setName(normalizeNameInput(e.target.value))}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') handleTriggerEditName();
                              if (e.key === 'Escape') {
                                setName(currentUser?.name || currentUser?.fullName || '');
                                setIsEditingName(false);
                              }
                            }}
                            className="bg-black border border-amber-400/50 text-white text-2xl px-2 py-0.5 focus:outline-none focus:border-amber-300 font-sans max-w-[320px]"
                            autoFocus
                          />
                        ) : (
                          <h2 className="text-3xl font-sans font-bold text-white truncate max-w-[380px]">
                            {name}
                          </h2>
                        )}


                      </div>
                      <p className="text-xs text-neutral-500 uppercase tracking-widest font-sans flex items-center justify-center md:justify-start gap-1">
                        Thành viên từ {memberSince} • {currentUser?.status === 'ACTIVE' ? 'Tài khoản đang hoạt động' : currentUser?.status || 'Đang cập nhật'}
                      </p>
                    </div>

                    {/* Live personal information from /api/v1/users/me */}
                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                      {[
                        { icon: Mail, label: 'Email tài khoản', value: currentUser?.email || 'Đang cập nhật' },
                        { icon: Phone, label: 'Số điện thoại', value: currentUser?.phone || 'Chưa cập nhật' },
                        { icon: Cake, label: 'Năm sinh', value: currentUser?.birthYear || 'Chưa cập nhật' },
                        { icon: BadgeCheck, label: 'Xác thực', value: currentUser?.emailVerified ? 'Email đã xác thực' : 'Chưa xác thực email' }
                      ].map(({ icon: InfoIcon, label, value }) => (
                        <div key={label} className="flex min-w-0 items-center gap-3 border border-white/5 bg-black/50 px-4 py-3 text-left">
                          <span className="flex h-9 w-9 shrink-0 items-center justify-center border border-amber-500/20 bg-amber-500/5 text-amber-400">
                            <InfoIcon className="h-4 w-4" />
                          </span>
                          <span className="min-w-0">
                            <span className="block text-[9px] font-black uppercase tracking-[0.16em] text-neutral-600">{label}</span>
                            <span className="mt-1 block truncate text-xs font-bold text-neutral-300">{value}</span>
                          </span>
                        </div>
                      ))}
                    </div>



                    {/* Cinepoints & Watched points metrics cards mockup */}
                    <div className="grid grid-cols-2 gap-3 max-w-sm mx-auto md:mx-0 pointer-events-none">

                      <div className="border border-white/5 bg-black/60 p-4 flex flex-col justify-center items-start">
                        <span className="text-[10px] uppercase tracking-widest font-black flex items-center gap-1 bg-[linear-gradient(90deg,#ff3b7f,#ffb703,#38ef7d,#00c2ff,#8b5cf6)] bg-clip-text text-transparent">
                          <Flame className="h-3.5 w-3.5 text-pink-400 drop-shadow-[0_0_8px_rgba(244,114,182,0.75)]" /> CinePoints
                        </span>
                        <span className="text-2xl font-mono font-bold text-white mt-1">{loyaltyPoints.toLocaleString()}</span>
                      </div>

                      <div className="border border-white/5 bg-black/60 p-4 flex flex-col justify-center items-start">
                        <span className="text-[10px] text-neutral-500 uppercase tracking-widest font-bold flex items-center gap-1">
                          <Film className="h-3.5 w-3.5 text-neutral-500" /> Phim đã xem
                        </span>
                        <span className="text-2xl font-mono font-bold text-white mt-1">
                          {watchedCount}
                        </span>
                      </div>

                    </div>

                    {(loyaltyResetScheduleLabel || (loyaltyAdminResetAt && Number(loyaltyPoints || 0) === 0)) && (
                      <div className="max-w-sm mx-auto md:mx-0 border border-emerald-500/15 bg-emerald-950/10 px-4 py-3 text-left">
                        {loyaltyResetScheduleLabel && (
                          <p className="text-[12px] font-mono text-white/70">
                            Điểm sẽ được reset vào thời gian: {loyaltyResetScheduleLabel}
                          </p>
                        )}
                        {loyaltyAdminResetAt && Number(loyaltyPoints || 0) === 0 && (
                          <p className="mt-2 border-l border-amber-400/40 pl-2 text-[10px] font-bold leading-snug text-amber-300">
                            Quản trị viên đã reset điểm lúc {loyaltyAdminResetAt}.
                          </p>
                        )}
                      </div>
                    )}

                  </div>

                  {/* Edit Button right-aligned for PC size */}
                  <div className="hidden md:block">
                    <button
                      onClick={handleTriggerEditName}
                      disabled={isSavingName}
                      className="border border-white/10 hover:border-white/50 bg-black text-[10px] uppercase tracking-widest px-5 py-2.5 text-white font-sans transition disabled:opacity-50"
                    >
                      {isSavingName ? 'ĐANG LƯU...' : isEditingName ? 'LƯU TÊN' : 'SỬA TÊN'}
                    </button>
                    {isEditingName && (
                      <button
                        onClick={() => {
                          setName(currentUser?.name || currentUser?.fullName || '');
                          setIsEditingName(false);
                        }}
                        className="ml-2 border border-white/5 px-4 py-2.5 text-[10px] font-bold uppercase tracking-widest text-neutral-500 transition hover:text-white"
                      >
                        Hủy
                      </button>
                    )}
                  </div>

                </div>

              </div>

              {/* RECENT BOOKINGS WIDGET */}
              <div className="space-y-4">
                <div className="flex items-center justify-between border-b border-white/10 pb-2">
                  <span className="text-[10px] uppercase font-sans font-black tracking-widest text-neutral-400">
                    ĐẶT VÉ GẦN ĐÂY
                  </span>
                  <button
                    onClick={() => onTabChange('my-tickets')}
                    className="text-[10px] uppercase font-sans tracking-widest text-neutral-500 hover:text-white font-semibold transition"
                  >
                    TẤT CẢ
                  </button>
                </div>

                <div className="space-y-4">
                  {isProfileLoading && (
                    <div className="flex items-center justify-center gap-2 border border-white/10 bg-[#080808] py-10 text-[10px] font-bold uppercase tracking-widest text-neutral-500">
                      <Loader2 className="h-4 w-4 animate-spin text-amber-400" />
                      Đang tải đặt vé từ hệ thống
                    </div>
                  )}

                  {!isProfileLoading && recentApiBookings.map((booking) => {
                    const statusMeta = bookingStatusMeta[booking.status] || {
                      label: booking.status || 'Đang cập nhật',
                      className: 'border-white/10 bg-neutral-900 text-neutral-400'
                    };
                    const showtimeLabel = booking.showtimeStart
                      ? new Date(booking.showtimeStart).toLocaleString('vi-VN', {
                        hour: '2-digit',
                        minute: '2-digit',
                        day: '2-digit',
                        month: '2-digit',
                        year: 'numeric'
                      })
                      : 'Chưa có lịch chiếu';
                    const seats = booking.seats?.map((seat) => `${seat.rowLabel}${seat.seatNumber}`).join(', ') || 'Chưa chọn ghế';

                    return (
                      <div
                        key={booking.id}
                        className="border border-white/10 hover:border-white/20 bg-[#0A0A0A] p-4 flex gap-4 transition items-center"
                      >
                        <div className="h-16 w-12 overflow-hidden flex-shrink-0 bg-neutral-950 border border-white/5">
                          <img
                            src={getBookingPoster(booking)}
                            alt={booking.movieTitle}
                            className="h-full w-full object-cover"
                            referrerPolicy="no-referrer"
                          />
                        </div>

                        <div className="flex-1 min-w-0">
                          <h4 className="text-xs font-sans font-bold text-white truncate">
                            {booking.movieTitle}
                          </h4>
                          <p className="text-[10px] text-neutral-400 font-sans mt-0.5 truncate uppercase">
                            {showtimeLabel} • {booking.roomName} • {booking.cinemaName}
                          </p>

                          <div className="flex items-center gap-1.5 mt-1">
                            <span className={`border px-1.5 text-[8px] font-bold uppercase ${statusMeta.className}`}>
                              {statusMeta.label}
                            </span>
                            <span className="text-[9px] font-mono text-neutral-500 uppercase">
                              GHẾ: {seats}
                            </span>
                            <span className="hidden text-[9px] font-mono text-amber-500 sm:inline">
                              {Number(booking.totalAmount || 0).toLocaleString('vi-VN')}đ
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center gap-3">
                          {/* Barcode line mock matching screen */}
                          <div className="hidden sm:flex gap-0.5 items-center px-1 py-1 bg-white/5 h-8">
                            <div className="w-[1.5px] bg-neutral-500 h-6"></div>
                            <div className="w-[2.5px] bg-neutral-200 h-6"></div>
                            <div className="w-[1px] bg-neutral-500 h-6"></div>
                            <div className="w-[4px] bg-white h-6"></div>
                            <div className="w-[1.5px] bg-neutral-400 h-6"></div>
                            <div className="w-[2px] bg-neutral-500 h-6"></div>
                          </div>

                          <button
                            onClick={() => onTabChange('my-tickets')}
                            className="bg-white hover:bg-neutral-200 text-black px-4 py-2 text-[9px] font-sans tracking-widest font-bold uppercase transition"
                          >
                            Chi Tiết
                          </button>
                        </div>
                      </div>
                    );
                  })}

                  {!isProfileLoading && recentApiBookings.length === 0 && (
                    <div className="border border-dashed border-white/10 bg-[#080808] py-10 text-center">
                      <Ticket className="mx-auto h-6 w-6 text-neutral-700" />
                      <p className="mt-3 text-[10px] font-bold uppercase tracking-widest text-neutral-500">Bạn chưa có đặt vé nào</p>
                      <button onClick={() => onTabChange('explore')} className="mt-4 border border-white/15 px-4 py-2 text-[9px] font-black uppercase tracking-widest text-white transition hover:bg-white hover:text-black">
                        Khám phá phim
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* ── CINEWALLET CARD ─────────────────────────────────────────────── */}
              <div className="border border-amber-500/20 bg-gradient-to-br from-[#0d0d00] to-[#050500] p-3 sm:p-3.5 space-y-2.5 mt-2 rounded-xl">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-amber-500/15 border border-amber-500/30 flex items-center justify-center shrink-0">
                      <Wallet className="h-4 w-4 text-amber-400" />
                    </div>
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-[0.14em] text-amber-500">CineWallet</p>
                      <p className="text-lg sm:text-xl font-mono font-black text-white leading-tight">
                        {wallet ? `${Number(wallet.balance).toLocaleString('vi-VN')}đ` : '0đ'}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => {
                        const next = !showWithdrawForm;
                        setShowWithdrawForm(next);
                        setShowBankDropdown(false);
                        if (next && bankList.length === 0) {
                          fetch('https://api.vietqr.io/v2/banks')
                            .then(r => r.json())
                            .then(d => setBankList(d.data || []))
                            .catch(() => { });
                        }
                      }}
                      className={`flex items-center gap-1.5 border px-2.5 py-1 text-[10.5px] font-bold uppercase tracking-wider transition rounded-lg ${
                        showWithdrawForm
                          ? 'border-amber-500 bg-amber-500 text-black shadow-md shadow-amber-500/20'
                          : 'border-amber-500/30 bg-amber-500/10 text-amber-400 hover:bg-amber-500/20'
                      }`}
                    >
                      {showWithdrawForm ? <X className="h-3 w-3" /> : <ArrowUpRight className="h-3 w-3" />}
                      {showWithdrawForm ? 'Đóng' : 'Rút tiền'}
                    </button>
                  </div>
                </div>

                {/* ── FORM RÚT TIỀN (HIỆN NGAY BÊN DƯỚI KHI BẤM NÚT RÚT TIỀN) ── */}
                <AnimatePresence>
                  {showWithdrawForm && (
                    <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                      <div className="pt-2.5 pb-1 border-t border-amber-500/20 space-y-2.5 bg-black/40 p-3 sm:p-3.5 rounded-xl border border-amber-500/30 mt-1.5">
                        <div className="flex items-center justify-between pb-1.5 border-b border-white/5">
                          <p className="text-xs font-black uppercase tracking-[0.12em] text-amber-400 flex items-center gap-1.5">
                            <ArrowUpRight className="h-3.5 w-3.5" /> Tạo yêu cầu rút tiền về ngân hàng
                          </p>
                          <span className="text-[11px] text-neutral-300">Số dư khả dụng: <strong className="text-amber-400 font-mono text-xs">{Number(wallet?.balance || 0).toLocaleString('vi-VN')}đ</strong></span>
                        </div>

                        {/* Tài khoản nhận tiền rút */}
                        {linkedBank ? (
                          <div className="bg-neutral-900/90 border border-amber-500/30 p-2.5 sm:p-3 relative group rounded-lg">
                            <div className="flex items-center justify-between pb-1.5 border-b border-white/5">
                              <span className="text-[11px] font-black uppercase tracking-[0.1em] text-amber-400/90 flex items-center gap-1.5">
                                <CheckCircle2 className="h-3 w-3 text-emerald-400" /> Tài khoản nhận tiền (Đã liên kết)
                              </span>
                              <button
                                type="button"
                                onClick={() => {
                                  setActivePanel('payment');
                                  setTimeout(() => {
                                    document.getElementById('payment-method-section')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                                  }, 100);
                                }}
                                className="text-[11px] font-bold text-amber-400 hover:text-amber-300 flex items-center gap-1 transition"
                              >
                                Thay đổi trong Phương thức thanh toán ↗
                              </button>
                            </div>
                            <div className="flex items-center gap-2.5 pt-2">
                              {(() => {
                                const logo = bankList.find(b => (b.short_name || b.shortName) === linkedBank.bankName)?.logo || linkedBank.bankLogo;
                                return logo ? (
                                  <img src={logo} alt={linkedBank.bankName} className="h-7 w-11 object-contain bg-white rounded p-0.5 shrink-0" />
                                ) : (
                                  <div className="h-7 w-11 bg-amber-500/20 border border-amber-500/30 rounded flex items-center justify-center text-[10px] font-black text-amber-400 shrink-0">
                                    BANK
                                  </div>
                                );
                              })()}
                              <div className="min-w-0">
                                <p className="text-xs font-black text-white flex items-center gap-1.5">
                                  <span>{linkedBank.bankName}</span>
                                  <span className="text-amber-300/90 font-mono text-[11px]">•••• {String(linkedBank.accountNumber).slice(-4)}</span>
                                </p>
                                <p className="text-[10.5px] text-neutral-300 font-mono tracking-wider uppercase truncate mt-0.5">
                                  Chủ TK: {linkedBank.accountHolder}
                                </p>
                              </div>
                            </div>
                          </div>
                        ) : (
                          <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-lg space-y-1.5">
                            <div className="flex items-center gap-1.5">
                              <AlertCircle className="h-3.5 w-3.5 text-amber-400 shrink-0" />
                              <p className="text-[11px] font-black text-amber-300">Chưa liên kết tài khoản ngân hàng</p>
                            </div>
                            <p className="text-[11px] text-neutral-300 leading-relaxed">
                              Quý khách vui lòng liên kết tài khoản ngân hàng trước tại mục <strong>Phương thức thanh toán</strong> để nhận tiền rút từ CineWallet.
                            </p>
                            <button
                              type="button"
                              onClick={() => {
                                setActivePanel('payment');
                                setTimeout(() => {
                                  document.getElementById('payment-method-section')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                                }, 100);
                              }}
                              className="w-full py-1.5 bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 text-amber-300 text-[11px] font-bold uppercase tracking-wider transition flex items-center justify-center gap-1.5 rounded-md"
                            >
                              <Plus className="h-3 w-3" /> Liên kết tài khoản ngay ↗
                            </button>
                          </div>
                        )}

                        {/* Số tiền */}
                        <div>
                          <label className="block text-[11px] font-black text-neutral-300 uppercase tracking-wider mb-1">
                            Số tiền muốn rút (VND)
                          </label>
                          <div className="relative">
                            <input
                              type="number"
                              min="10000"
                              step="10000"
                              placeholder="Tối thiểu 10.000đ"
                              value={withdrawForm.amount}
                              onChange={e => {
                                setWithdrawForm(f => ({ ...f, amount: e.target.value }));
                                setWithdrawErrors(err => ({ ...err, amount: '', general: '' }));
                              }}
                              className={`w-full bg-black/60 border px-3 py-2 text-xs text-white outline-none transition font-mono rounded-lg ${withdrawErrors.amount ? 'border-rose-500/70' : 'border-white/10 focus:border-amber-500/50'
                                }`}
                            />
                            <span className="absolute right-3 top-2 text-[11px] text-neutral-400 font-mono font-bold">VND</span>
                          </div>
                          {/* Quick amount shortcuts */}
                          <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                            {[50000, 100000, 200000, 500000].map(amt => (
                              <button
                                key={amt}
                                type="button"
                                disabled={Number(wallet?.balance || 0) < amt}
                                onClick={() => {
                                  setWithdrawForm(f => ({ ...f, amount: String(amt) }));
                                  setWithdrawErrors(err => ({ ...err, amount: '', general: '' }));
                                }}
                                className="px-2 py-1 bg-white/5 hover:bg-white/10 disabled:opacity-30 border border-white/10 rounded text-[11px] font-mono font-bold text-neutral-300 hover:text-white transition shrink-0"
                              >
                                {amt.toLocaleString('vi-VN')}đ
                              </button>
                            ))}
                            {Number(wallet?.balance || 0) >= 10000 && (
                              <button
                                type="button"
                                onClick={() => {
                                  setWithdrawForm(f => ({ ...f, amount: String(Math.floor(Number(wallet?.balance || 0))) }));
                                  setWithdrawErrors(err => ({ ...err, amount: '', general: '' }));
                                }}
                                className="px-2 py-1 bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/30 rounded text-[11px] font-mono text-amber-300 transition shrink-0 font-bold"
                              >
                                Tất cả số dư
                              </button>
                            )}
                          </div>
                          {withdrawErrors.amount && <p className="mt-1 text-[11px] text-rose-400 font-medium">{withdrawErrors.amount}</p>}
                        </div>

                        {withdrawErrors.general && (
                          <p className="text-[11px] text-rose-400 bg-rose-500/10 border border-rose-500/20 px-3 py-2 rounded-lg">
                            {withdrawErrors.general}
                          </p>
                        )}

                        <button
                          disabled={withdrawLoading || !linkedBank}
                          onClick={handleCreateWithdrawal}
                          className="w-full bg-amber-500 text-black text-xs font-black uppercase tracking-wider py-2 hover:bg-amber-400 transition disabled:opacity-50 flex items-center justify-center gap-2 shadow-lg rounded-lg font-bold"
                        >
                          {withdrawLoading ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <ArrowUpRight className="h-3.5 w-3.5" />}
                          Gửi yêu cầu rút tiền
                        </button>
                        <p className="text-[11px] text-neutral-400 leading-relaxed">
                          Quản trị viên (Admin) sẽ xem xét và chuyển khoản thủ công trong vòng 1-3 ngày làm việc.
                        </p>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* ── TABS CHUYỂN ĐỔI: LỊCH SỬ RÚT TIỀN vs BIẾN ĐỘNG SỐ DƯ ── */}
                <div className="pt-2 border-t border-white/10 space-y-2">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5">
                    <div className="flex items-center gap-1 p-0.5 bg-black/60 border border-white/10 rounded-lg">
                      <button
                        type="button"
                        onClick={() => setWalletSubTab('WITHDRAWALS')}
                        className={`flex items-center gap-1.5 px-2.5 py-1 text-[10.5px] font-bold uppercase tracking-wider rounded transition ${
                          walletSubTab === 'WITHDRAWALS'
                            ? 'bg-amber-500 text-black shadow-md shadow-amber-500/20'
                            : 'text-neutral-400 hover:text-white hover:bg-white/5'
                        }`}
                      >
                        <CreditCard className="h-3 w-3" />
                        <span>Lịch sử rút tiền ({withdrawals.length})</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setWalletSubTab('TRANSACTIONS')}
                        className={`flex items-center gap-1.5 px-2.5 py-1 text-[10.5px] font-bold uppercase tracking-wider rounded transition ${
                          walletSubTab === 'TRANSACTIONS'
                            ? 'bg-amber-500 text-black shadow-md shadow-amber-500/20'
                            : 'text-neutral-400 hover:text-white hover:bg-white/5'
                        }`}
                      >
                        <Filter className="h-3 w-3" />
                        <span>Biến động số dư ({walletTxs.length})</span>
                      </button>
                    </div>
                    <span className="text-[10px] text-neutral-400 hidden sm:inline-flex items-center gap-1">
                      <Eye className="h-3 w-3 text-amber-500" /> Bấm dòng để xem biên nhận chi tiết
                    </span>
                  </div>

                  {/* TAB 1: LỊCH SỬ RÚT TIỀN GỌN GÀNG, TINH TẾ */}
                  {walletSubTab === 'WITHDRAWALS' && (
                    <div className="space-y-2">
                      {withdrawals.length === 0 ? (
                        <div className="py-5 text-center border border-dashed border-white/10 rounded-lg bg-black/30">
                          <CreditCard className="h-6 w-6 text-neutral-600 mx-auto mb-1" />
                          <p className="text-xs text-neutral-300 font-medium">Quý khách chưa có yêu cầu rút tiền nào.</p>
                          <p className="text-[10.5px] text-neutral-500 mt-0.5">Khi bạn thực hiện lệnh rút, tiến trình và kết quả xử lý của Admin sẽ hiển thị tại đây.</p>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          {withdrawals.map((w, i) => {
                            const isPaid = w.status === 'PAID';
                            const isRejected = w.status === 'REJECTED';
                            const isPending = !isPaid && !isRejected;
                            const bankMeta = bankList.find(b => (b.short_name || b.shortName) === w.bankName);
                            const bankLogo = bankMeta?.logo;

                            return (
                              <div
                                key={w.id || i}
                                onClick={() => setSelectedWdDetail(w)}
                                className={`p-2.5 sm:p-3 rounded-lg border transition cursor-pointer relative overflow-hidden group ${
                                  isPaid
                                    ? 'bg-gradient-to-r from-emerald-950/20 to-black/60 border-emerald-500/30 hover:border-emerald-500/60 shadow-md shadow-emerald-950/10'
                                    : isRejected
                                      ? 'bg-gradient-to-r from-rose-950/20 to-black/60 border-rose-500/30 hover:border-rose-500/60 shadow-md shadow-rose-950/10'
                                      : 'bg-gradient-to-r from-amber-950/20 to-black/60 border-amber-500/30 hover:border-amber-500/60 shadow-md shadow-amber-950/10'
                                }`}
                              >
                                {/* Dòng 1: Ngân hàng + Số tiền + Trạng thái */}
                                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5">
                                  <div className="flex items-center gap-2">
                                    {bankLogo ? (
                                      <img src={bankLogo} alt={w.bankName} className="h-6 w-9 sm:h-6.5 sm:w-10 object-contain bg-white rounded p-0.5 shrink-0 shadow-sm" />
                                    ) : (
                                      <div className="h-6 w-9 sm:h-6.5 sm:w-10 rounded bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-[9px] font-black text-amber-400 shrink-0">
                                        {w.bankName || 'BANK'}
                                      </div>
                                    )}
                                    <div>
                                      <div className="flex items-center gap-1.5">
                                        <span className="text-xs sm:text-[13px] font-bold text-white">{w.bankName}</span>
                                        <span className="text-[10px] font-mono text-neutral-300 bg-white/5 px-1.5 py-0.2 rounded border border-white/10">STK: {w.accountNumber}</span>
                                      </div>
                                      <p className="text-[10px] text-neutral-400 uppercase font-medium mt-0.5">{w.accountHolder}</p>
                                    </div>
                                  </div>

                                  <div className="flex sm:flex-col items-center sm:items-end justify-between sm:justify-center gap-0.5">
                                    <span className={`text-sm sm:text-[15px] font-mono font-black ${
                                      isRejected
                                        ? 'text-emerald-400'
                                        : isPaid
                                          ? 'text-white'
                                          : 'text-amber-400'
                                    }`}>
                                      {isRejected ? '+' : '-'}{Number(w.amount).toLocaleString('vi-VN')}đ
                                    </span>
                                    {isPending && (
                                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9.5px] font-bold uppercase tracking-wider bg-amber-500/15 border border-amber-500/40 text-amber-300">
                                        <Clock className="h-2.5 w-2.5 animate-pulse" /> Đang chờ duyệt
                                      </span>
                                    )}
                                    {isPaid && (
                                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9.5px] font-bold uppercase tracking-wider bg-emerald-500/15 border border-emerald-500/40 text-emerald-300">
                                        <CheckCircle2 className="h-2.5 w-2.5" /> Đã chuyển tiền thành công
                                      </span>
                                    )}
                                    {isRejected && (
                                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9.5px] font-bold uppercase tracking-wider bg-emerald-500/15 border border-emerald-500/40 text-emerald-300">
                                        <CheckCircle2 className="h-2.5 w-2.5 text-emerald-400" /> Từ chối · Đã cộng tiền vào ví
                                      </span>
                                    )}
                                  </div>
                                </div>

                                {/* Dòng 2: Hộp thông báo trạng thái chi tiết */}
                                {isPending && (
                                  <div className="mt-1.5 p-1.5 px-2 rounded-md bg-amber-500/10 border border-amber-500/20 text-[11px] text-amber-200 flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                                    <span className="flex items-center gap-1.5">
                                      <Clock className="h-3 w-3 text-amber-400 shrink-0" />
                                      Yêu cầu rút tiền đang chờ Quản trị viên duyệt và thực hiện chuyển khoản.
                                    </span>
                                    <span className="text-neutral-400 font-mono text-[10px]">
                                      Gửi lúc: {formatDateTimeVi(w.createdAt)}
                                    </span>
                                  </div>
                                )}

                                {isPaid && (
                                  <div className="mt-1.5 p-1.5 px-2 rounded-md bg-emerald-500/10 border border-emerald-500/20 text-[11px] text-emerald-200 flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                                    <span className="flex items-center gap-1.5 font-medium text-emerald-300">
                                      <CheckCircle2 className="h-3 w-3 text-emerald-400 shrink-0" />
                                      Admin đã hoàn tất chuyển khoản {Number(w.amount).toLocaleString('vi-VN')}đ {w.processedMethod ? `qua ${w.processedMethod}` : ''}.
                                    </span>
                                    <span className="text-emerald-400 font-mono font-bold text-[10px]">
                                      Thời gian chuyển: {w.processedAt ? formatDateTimeVi(w.processedAt) : formatDateTimeVi(w.createdAt)}
                                    </span>
                                  </div>
                                )}

                                {isRejected && (
                                  <div className="mt-1.5 p-1.5 sm:p-2 rounded-md bg-rose-500/10 border border-rose-500/25 text-[11px] text-rose-200 space-y-1">
                                    <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-1">
                                      <div className="flex items-start sm:items-center gap-1.5 min-w-0">
                                        <AlertCircle className="h-3 w-3 text-rose-400 shrink-0 mt-0.5 sm:mt-0" />
                                        <span className="shrink-0 font-semibold text-rose-300 text-[11px]">Lý do từ chối:</span>
                                        <span className="font-normal italic text-white/90 text-[11px] truncate sm:whitespace-normal">"{w.processedNote || 'Admin từ chối yêu cầu rút tiền do thông tin không phù hợp'}"</span>
                                      </div>
                                      {w.processedAt && (
                                        <span className="text-neutral-400 font-mono text-[10px] shrink-0">Xử lý: {formatDateTimeVi(w.processedAt)}</span>
                                      )}
                                    </div>
                                    <div className="pt-1 border-t border-rose-500/15 flex items-center gap-1.5 text-emerald-400 font-medium text-[10.5px]">
                                      <CheckCircle2 className="h-3 w-3 shrink-0 text-emerald-400" />
                                      <span>✓ Số tiền +{Number(w.amount).toLocaleString('vi-VN')}đ đã được tự động CỘNG VÀO VÍ 100% vào số dư ví CineWallet của bạn.</span>
                                    </div>
                                  </div>
                                )}

                                {/* Dòng 3: Metadata chân trang */}
                                <div className="mt-1.5 pt-1.2 border-t border-white/5 flex items-center justify-between text-[10px] text-neutral-400">
                                  <span>Mã yêu cầu: <strong className="text-neutral-300 font-mono">#WD-{w.id}</strong> · Gửi: {formatDateTimeVi(w.createdAt)}</span>
                                  <span className="text-amber-400 font-bold group-hover:translate-x-0.5 transition-transform inline-flex items-center gap-1">
                                    Xem biên nhận chi tiết →
                                  </span>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}

                  {/* TAB 2: TẤT CẢ BIẾN ĐỘNG SỐ DƯ */}
                  {walletSubTab === 'TRANSACTIONS' && (
                    <div className="space-y-2">
                      {/* Sub filter buttons */}
                      <div className="flex gap-1.5 overflow-x-auto pb-1 text-xs">
                        {[
                          { key: 'ALL', label: 'Tất cả' },
                          { key: 'REFUND', label: 'Hoàn tiền vé (+)' },
                          { key: 'WITHDRAW', label: 'Rút tiền (-)' }
                        ].map(tab => (
                          <button
                            key={tab.key}
                            type="button"
                            onClick={() => setTxFilter(tab.key)}
                            className={`px-2.5 py-1 text-[10.5px] font-bold uppercase tracking-wider rounded-md transition shrink-0 ${
                              txFilter === tab.key
                                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/50'
                                : 'text-neutral-400 hover:text-white border border-white/5 bg-black/40'
                            }`}
                          >
                            {tab.label}
                          </button>
                        ))}
                      </div>

                      {/* Danh sách giao dịch */}
                      {(() => {
                        const filtered = walletTxs.filter((tx) => {
                          if (tx.type === 'WITHDRAWAL_PAID' || Math.abs(Number(tx.amount || 0)) <= 0) return false;
                          const isRefundType = tx.type === 'REFUND_CREDIT' || tx.type === 'WITHDRAWAL_REFUND' || tx.type === 'WITHDRAWAL_REJECTED' || String(tx.type).includes('REFUND');
                          if (txFilter === 'REFUND') return isRefundType;
                          if (txFilter === 'WITHDRAW') return tx.type === 'WITHDRAWAL_HOLD' || (String(tx.type).includes('WITHDRAW') && !isRefundType);
                          return true;
                        });

                        if (filtered.length === 0) {
                          return (
                            <div className="py-6 text-center border border-dashed border-white/10 rounded-xl bg-black/30 text-xs text-neutral-400 italic">
                              Không có giao dịch nào trong mục này.
                            </div>
                          );
                        }

                        return (
                          <div className="space-y-1.5">
                            {filtered.map((tx, i) => {
                              const isTicketRefund = tx.type === 'REFUND_CREDIT';
                              const isWithdrawRefund = tx.type === 'WITHDRAWAL_REFUND' || tx.type === 'WITHDRAWAL_REJECTED';
                              const isCredit = isTicketRefund || isWithdrawRefund || String(tx.type).includes('REFUND') || Number(tx.amount) > 0;
                              const matchedWd = withdrawals.find(w => (tx.referenceCode && String(tx.referenceCode).includes(String(w.id))) || (Math.abs(Number(w.amount)) === Math.abs(Number(tx.amount)) && Math.abs(new Date(w.createdAt || 0) - new Date(tx.createdAt || 0)) < 60000));

                              return (
                                <button
                                  key={tx.id || i}
                                  type="button"
                                  onClick={() => setSelectedTxDetail(tx)}
                                  className="w-full p-2 sm:p-2.5 rounded-lg border border-white/10 bg-black/40 hover:border-amber-500/40 hover:bg-black/70 text-left transition group flex items-center justify-between gap-2.5"
                                >
                                  <div>
                                    <div className="flex flex-wrap items-center gap-1.5">
                                      <p className="text-xs font-bold text-white group-hover:text-amber-300 transition">
                                        {isTicketRefund
                                          ? '+ Hoàn tiền vé'
                                          : isWithdrawRefund
                                            ? '+ Cộng tiền vào ví'
                                            : tx.type === 'WITHDRAWAL_HOLD'
                                              ? '- Yêu cầu rút tiền'
                                              : tx.type}
                                      </p>
                                      {isTicketRefund && (
                                        <span className="text-[9.5px] font-bold px-1.5 py-0.2 bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 rounded-full uppercase">
                                          100% Hoàn tiền
                                        </span>
                                      )}
                                      {isWithdrawRefund && (
                                        <span className="text-[9.5px] font-bold px-1.5 py-0.2 bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 rounded-full uppercase flex items-center gap-1">
                                          <CheckCircle2 className="h-2.5 w-2.5 text-emerald-400" /> Lệnh rút bị từ chối · Đã cộng ví
                                        </span>
                                      )}
                                      {tx.type === 'WITHDRAWAL_HOLD' && matchedWd && (
                                        matchedWd.status === 'PAID' ? (
                                          <span className="text-[9.5px] font-bold px-1.5 py-0.2 bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 rounded-full uppercase flex items-center gap-1">
                                            <CheckCircle2 className="h-2.5 w-2.5" /> Đã chuyển tiền {matchedWd.processedAt ? `· ${formatDateTimeVi(matchedWd.processedAt)}` : ''}
                                          </span>
                                        ) : matchedWd.status === 'REJECTED' ? (
                                          <span className="text-[9.5px] font-bold px-1.5 py-0.2 bg-rose-500/15 text-rose-300 border border-rose-500/30 rounded-full uppercase flex items-center gap-1">
                                            <XCircle className="h-2.5 w-2.5" /> Từ chối · Đã hoàn ví
                                          </span>
                                        ) : (
                                          <span className="text-[9.5px] font-bold px-1.5 py-0.2 bg-amber-500/15 text-amber-300 border border-amber-500/30 rounded-full uppercase flex items-center gap-1">
                                            <Clock className="h-2.5 w-2.5" /> Đang chờ duyệt
                                          </span>
                                        )
                                      )}
                                    </div>
                                    <div className="flex items-center gap-2 mt-0.5 text-[10px] text-neutral-400">
                                      <span className="font-mono text-neutral-300">{tx.referenceCode || 'Mã GD: #--'}</span>
                                      {tx.createdAt && (
                                        <span>· {formatDateTimeVi(tx.createdAt)}</span>
                                      )}
                                    </div>
                                  </div>

                                  <div className="text-right shrink-0">
                                    <span className={`text-xs sm:text-sm font-black font-mono block ${isCredit ? 'text-emerald-400' : 'text-amber-400'}`}>
                                      {isCredit ? '+' : '-'}
                                      {Math.abs(Number(tx.amount)).toLocaleString('vi-VN')}đ
                                    </span>
                                    <span className="text-[9.5px] text-amber-500/80 font-semibold opacity-0 group-hover:opacity-100 transition inline-block mt-0.5">
                                      Xem biên nhận →
                                    </span>
                                  </div>
                                </button>
                              );
                            })}
                          </div>
                        );
                      })()}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* RIGHT SECTION: PERSONALIZED PREFERENCES & SETTINGS */}
            <div className="lg:col-span-4 space-y-6">



              {/* SETTINGS OPTIONS WIDGETS SECTION */}
              <div className={`border bg-gradient-to-b from-[#0a0a0a] to-[#040404] p-5.5 space-y-5 font-sans transition-all duration-300 relative overflow-hidden rounded-none ${glowColor === 'gold' ? 'border-amber-500/20 shadow-[0_0_25px_rgba(245,158,11,0.08)]' :
                glowColor === 'neon' ? 'border-cyan-500/20 shadow-[0_0_25px_rgba(6,182,212,0.08)]' :
                  glowColor === 'ruby' ? 'border-rose-500/20 shadow-[0_0_25px_rgba(244,63,94,0.08)]' :
                    'border-emerald-500/20 shadow-[0_0_25px_rgba(16,185,129,0.08)]'
                }`} id="settings-interactive-box">

                {/* Audio controller and Glow selector Header */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-white/5 pb-3">
                  <div className="flex items-center space-x-2 text-neutral-400">
                    <Settings className={`h-4.5 w-4.5 animate-spin-slow ${glowColor === 'gold' ? 'text-amber-400' :
                      glowColor === 'neon' ? 'text-cyan-400' :
                        glowColor === 'ruby' ? 'text-rose-400' : 'text-emerald-400'
                      }`} />
                    <span className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-300">TRUNG TÂM KIỂM SOÁT VIP</span>
                  </div>

                  {/* Micro Controllers */}
                  <div className="flex items-center space-x-3 self-end sm:self-auto">
                    {/* Sound Toggle */}
                    <button
                      onClick={() => {
                        const ns = !soundOn;
                        setSoundOn(ns);
                        if (ns) {
                          // test ping
                          try {
                            const AudioCtx = window.AudioContext || window.webkitAudioContext;
                            const ctx = new AudioCtx();
                            const osc = ctx.createOscillator();
                            const gain = ctx.createGain();
                            osc.frequency.value = 600;
                            gain.gain.setValueAtTime(0.03, ctx.currentTime);
                            gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.15);
                            osc.connect(gain);
                            gain.connect(ctx.destination);
                            osc.start();
                            osc.stop(ctx.currentTime + 0.15);
                          } catch (e) { }
                        }
                      }}
                      className="p-1.5 border border-neutral-900 bg-black text-neutral-400 hover:text-white hover:border-neutral-800 transition"
                      title={soundOn ? "Tắt âm phản hồi" : "Bật âm phản hồi"}
                    >
                      {soundOn ? <Volume2 className="h-3.5 w-3.5 text-amber-500 animate-pulse" /> : <VolumeX className="h-3.5 w-3.5 text-neutral-600" />}
                    </button>

                    {/* Vibe Theme Selector with dynamic frequencies on hover/click */}
                    <div className="flex items-center space-x-1 border border-neutral-900 bg-black p-0.5" id="theme-accent-dots">
                      {[
                        { id: 'gold', class: 'bg-amber-400', freq: 554.37 },
                        { id: 'neon', class: 'bg-cyan-400', freq: 659.25 },
                        { id: 'ruby', class: 'bg-rose-500', freq: 783.99 },
                        { id: 'emerald', class: 'bg-emerald-400', freq: 880.00 }
                      ].map((dot) => (
                        <button
                          key={dot.id}
                          onClick={() => {
                            setGlowColor(dot.id);
                            playPing(dot.freq, 'sine', 0.2);
                          }}
                          className={`h-3 w-3 rounded-full transition-all duration-300 ${dot.class} ${glowColor === dot.id ? 'scale-125 ring-2 ring-white/60' : 'opacity-40 hover:opacity-100'
                            }`}
                          title={`Chủ đề ${dot.id.toUpperCase()}`}
                        />
                      ))}
                    </div>

                  </div>
                </div>

                {/* Options Accumulators */}
                <div className="space-y-2">

                  {/* 1. CHỈNH SỬA HỒ SƠ */}
                  <div className="border border-white/5 bg-black/40 overflow-hidden text-neutral-400">
                    <button
                      onClick={() => {
                        playPing(activePanel === 'profile' ? 380 : 450, 'sine', 0.1);
                        setActivePanel(activePanel === 'profile' ? null : 'profile');
                      }}
                      className={`w-full flex items-center justify-between p-3.5 text-xs text-neutral-400 hover:text-white transition duration-200 text-left ${activePanel === 'profile' ? 'bg-neutral-950/60 pb-2 text-white border-b border-white/5' : ''
                        }`}
                    >
                      <span className="flex items-center gap-2.5 font-bold uppercase tracking-wider">
                        <User className={`h-4 w-4 ${activePanel === 'profile' ? 'text-amber-400' : 'text-neutral-500'}`} />
                        Chỉnh sửa hồ sơ VIP
                      </span>
                      <ChevronDown className={`h-3.5 w-3.5 text-neutral-500 transition-transform duration-300 ${activePanel === 'profile' ? 'rotate-180 text-white' : ''
                        }`} />
                    </button>

                    <AnimatePresence initial={false}>
                      {activePanel === 'profile' && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          className="overflow-hidden"
                        >
                          <div className="p-4 space-y-4 text-xs">
                            {/* Profile settings fields form */}
                            <div className="space-y-3.5">
                              <div className="space-y-1">
                                <label className="text-[10px] uppercase tracking-[0.18em] font-black text-neutral-400">Tên Thượng Khách</label>
                                <input
                                  type="text"
                                  maxLength={MAX_NAME_LENGTH}
                                  value={profileNameInput}
                                  onChange={(e) => setProfileNameInput(normalizeNameInput(e.target.value))}
                                  className="w-full bg-black border border-neutral-850 focus:border-amber-400 text-white p-2 text-xs focus:outline-none focus:ring-0 rounded-none font-bold"
                                />
                                <p className="text-[9px] text-neutral-600 font-mono text-right">{profileNameInput.length}/{MAX_NAME_LENGTH}</p>
                              </div>

                              <div className="space-y-1">
                                <label className="text-[10px] uppercase tracking-[0.18em] font-black text-neutral-400">Tiểu sử Điện ảnh</label>
                                <textarea
                                  value={profileBioInput}
                                  onChange={(e) => setProfileBioInput(e.target.value)}
                                  rows={2}
                                  className="w-full bg-black border border-neutral-850 focus:border-amber-400 text-white p-2 text-xs focus:outline-none focus:ring-0 rounded-none leading-relaxed"
                                />
                              </div>

                              <div className="space-y-1">
                                <label className="text-[10px] uppercase tracking-[0.18em] font-black text-neutral-400">Địa chỉ Email Liên hệ</label>
                                <input
                                  type="email"
                                  value={profileEmailInput}
                                  disabled
                                  className="w-full bg-black border border-neutral-850 text-neutral-500 p-2 text-xs focus:outline-none focus:ring-0 rounded-none font-mono cursor-not-allowed"
                                />
                              </div>

                              <div className="space-y-1">
                                <label className="text-[10px] uppercase tracking-[0.18em] font-black text-neutral-400">Số điện thoại</label>
                                <input
                                  type="tel"
                                  inputMode="numeric"
                                  pattern="(03|05|08|09)[0-9]{8}"
                                  maxLength={10}
                                  placeholder="0912345678"
                                  value={profilePhoneInput}
                                  onChange={(e) => setProfilePhoneInput(normalizePhoneInput(e.target.value))}
                                  className="w-full bg-black border border-neutral-850 focus:border-amber-400 text-white p-2 text-xs focus:outline-none focus:ring-0 rounded-none font-mono"
                                />
                                <p className="text-[9px] text-neutral-600 font-mono">10 số, bắt đầu 03/05/08/09</p>
                              </div>

                              <div className="space-y-1">
                                <label className="text-[10px] uppercase tracking-[0.18em] font-black text-neutral-400">Năm sinh</label>
                                <input
                                  type="number"
                                  min={1900}
                                  max={new Date().getFullYear() - 5}
                                  placeholder="VD: 2000"
                                  value={profileDateOfBirth}
                                  onChange={(e) => setProfileDateOfBirth(e.target.value)}
                                  className="w-full bg-black border border-neutral-850 focus:border-amber-400 text-white p-2 text-xs focus:outline-none focus:ring-0 rounded-none font-mono"
                                />
                                <p className="text-[9px] text-neutral-600 font-mono">Dùng để xác minh độ tuổi xem phim</p>
                              </div>
                            </div>

                            <button
                              onClick={handleSaveProfile}
                              disabled={isSavingProfile}
                              className="w-full py-2.5 bg-white text-black font-sans font-black tracking-widest uppercase text-[10px] hover:bg-neutral-250 transition flex items-center justify-center gap-1.5"
                            >
                              {isSavingProfile ? (
                                <span className="h-3.5 w-3.5 border-2 border-black border-t-transparent animate-spin rounded-full inline-block"></span>
                              ) : (
                                <><Save className="h-3.5 w-3.5" /> LƯU THAY ĐỔI HỒ SƠ</>
                              )}
                            </button>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>

                  {/* 2. PHƯƠNG THỨC THANH TOÁN (Tài khoản ngân hàng VietQR rút ví & nhận tiền) */}
                  <div id="payment-method-section" className="border border-white/5 bg-black/40 overflow-hidden text-neutral-400">
                    <button
                      onClick={() => {
                        playPing(activePanel === 'payment' ? 380 : 450, 'sine', 0.1);
                        setActivePanel(activePanel === 'payment' ? null : 'payment');
                      }}
                      className={`w-full flex items-center justify-between p-3.5 text-xs text-neutral-400 hover:text-white transition duration-200 text-left ${activePanel === 'payment' ? 'bg-neutral-950/60 pb-2 text-white border-b border-white/5' : ''
                        }`}
                    >
                      <span className="flex items-center gap-2.5 font-bold uppercase tracking-wider">
                        <Landmark className={`h-4 w-4 ${activePanel === 'payment' ? 'text-amber-400' : 'text-neutral-500'}`} />
                        Tài khoản ngân hàng (Rút ví)
                      </span>
                      <ChevronDown className={`h-3.5 w-3.5 text-neutral-500 transition-transform duration-300 ${activePanel === 'payment' ? 'rotate-180 text-white' : ''
                        }`} />
                    </button>

                    <AnimatePresence initial={false}>
                      {activePanel === 'payment' && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          className="overflow-hidden"
                        >
                          <div className="p-4 space-y-4 text-xs">
                            {/* Visual Bank Card Representation */}
                            <div
                              className="relative w-full aspect-[1.58/1] rounded-xl p-5 overflow-hidden text-white flex flex-col justify-between border shadow-2xl transition-all duration-300"
                              style={{
                                background: 'linear-gradient(135deg, #12100e 0%, #1c150b 45%, #0d0a06 100%)',
                                borderColor: 'rgba(245, 158, 11, 0.45)',
                                boxShadow: '0 15px 35px -10px rgba(245, 158, 11, 0.2), inset 0 1px 0 rgba(255, 255, 255, 0.12)'
                              }}
                            >
                              {/* Ambient golden glow */}
                              <div className="absolute top-0 right-0 w-44 h-44 bg-amber-500/10 rounded-full blur-2xl pointer-events-none" />
                              <div className="absolute bottom-0 left-0 w-36 h-36 bg-amber-600/5 rounded-full blur-xl pointer-events-none" />

                              {/* Card Top: Bank Logo / Name & NAPAS badge */}
                              <div className="flex justify-between items-start z-10">
                                <div className="flex items-center gap-2.5">
                                  {(() => {
                                    const found = bankList.find(b => (b.short_name || b.shortName) === bankForm.bankName);
                                    if (found?.logo) {
                                      return (
                                        <div className="bg-white/95 rounded px-2 py-0.5 shadow-md flex items-center justify-center">
                                          <img src={found.logo} alt={found.short_name} className="h-4.5 max-w-[75px] object-contain" />
                                        </div>
                                      );
                                    }
                                    return (
                                      <div className="flex items-center gap-1.5 bg-amber-500/20 border border-amber-500/40 px-2 py-0.5 rounded text-[10px] font-black text-amber-400">
                                        <Landmark className="h-3 w-3" />
                                        <span>{bankForm.bankName || 'NGÂN HÀNG'}</span>
                                      </div>
                                    );
                                  })()}
                                  <span className="text-[8px] tracking-[0.2em] font-mono text-neutral-400 uppercase">
                                    CINEWALLET LINKED
                                  </span>
                                </div>

                                <div className="text-right">

                                </div>
                              </div>

                              {/* Card Middle: EMV Chip & Account Number */}
                              <div className="space-y-2 z-10 my-auto">
                                <div className="flex items-center gap-3">
                                  {/* Golden Chip */}
                                  <div className="h-5 w-7 bg-gradient-to-br from-amber-300 via-amber-500 to-amber-700 rounded-[3px] p-0.5 shadow border border-amber-200/50 flex flex-col justify-between">
                                    <div className="w-full h-[1px] bg-amber-900/40 my-auto" />
                                    <div className="w-full h-[1px] bg-amber-900/40" />
                                  </div>
                                  <span className="text-amber-400/60 text-[10px] font-mono">))))</span>
                                </div>

                                <div className="text-center">
                                  <p className="text-base sm:text-xl font-mono tracking-[0.2em] font-black text-white select-all drop-shadow">
                                    {bankForm.accountNumber
                                      ? bankForm.accountNumber.replace(/(\d{4})/g, '$1 ').trim()
                                      : '•••• •••• •••• ••••'}
                                  </p>
                                </div>
                              </div>

                              {/* Card Bottom: Holder Name & Status */}
                              <div className="flex justify-between items-end text-[9px] font-mono z-10 border-t border-white/10 pt-2">
                                <div>
                                  <span className="block text-[7px] text-neutral-400 font-extrabold uppercase tracking-wider">CHỦ TÀI KHOẢN</span>
                                  <span className="uppercase text-amber-300 font-black tracking-wider text-[11px] truncate max-w-[200px] block">
                                    {bankForm.accountHolder || (currentUser?.name || currentUser?.fullName || 'NGUYỄN VĂN A')}
                                  </span>
                                </div>
                                <div className="text-right">
                                  <span className="block text-[7px] text-neutral-400 font-extrabold uppercase tracking-wider">TRẠNG THÁI</span>
                                  {linkedBank && linkedBank.accountNumber === bankForm.accountNumber ? (
                                    <span className="text-emerald-400 font-black flex items-center justify-end gap-1">
                                      <CheckCircle2 className="h-3 w-3" /> ĐÃ LIÊN KẾT
                                    </span>
                                  ) : (
                                    <span className="text-amber-400/80 font-bold">CHƯA LƯU</span>
                                  )}
                                </div>
                              </div>
                            </div>

                            {/* Form liên kết tài khoản ngân hàng */}
                            <div className="space-y-3 pt-1">
                              {/* Ngân hàng dropdown */}
                              <div className="relative">
                                <label className="block text-[10px] font-black text-neutral-400 uppercase tracking-[0.18em] mb-1">
                                  Ngân hàng thụ hưởng
                                </label>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setBankDropdownOpen(v => !v);
                                    if (bankList.length === 0) {
                                      fetch('https://api.vietqr.io/v2/banks')
                                        .then(r => r.json())
                                        .then(d => setBankList(d.data || []))
                                        .catch(() => { });
                                    }
                                  }}
                                  className={`w-full flex items-center gap-2.5 bg-black/60 border px-3 py-2 text-[11px] text-left outline-none transition ${bankErrors.bankName ? 'border-rose-500/70' : 'border-neutral-800 hover:border-amber-500/50'
                                    }`}
                                >
                                  {bankForm.bankName ? (
                                    <>
                                      {bankList.find(b => (b.short_name || b.shortName) === bankForm.bankName)?.logo && (
                                        <img
                                          src={bankList.find(b => (b.short_name || b.shortName) === bankForm.bankName)?.logo}
                                          alt=""
                                          className="h-5 w-8 object-contain bg-white/10 rounded p-0.5"
                                        />
                                      )}
                                      <span className="text-white font-bold flex-1">{bankForm.bankName}</span>
                                    </>
                                  ) : (
                                    <span className="text-neutral-500 flex-1">-- Chọn ngân hàng trong hệ thống VietQR / NAPAS --</span>
                                  )}
                                  <ChevronDown className={`h-3.5 w-3.5 text-neutral-500 transition-transform ${bankDropdownOpen ? 'rotate-180' : ''}`} />
                                </button>

                                {bankDropdownOpen && (
                                  <div className="absolute z-50 left-0 right-0 mt-1 bg-[#0f0f0f] border border-white/15 shadow-2xl max-h-60 flex flex-col rounded">
                                    <div className="p-2 border-b border-white/10">
                                      <input
                                        autoFocus
                                        type="text"
                                        placeholder="Tìm theo tên ngân hàng, mã viết tắt..."
                                        value={bankSearch}
                                        onChange={e => setBankSearch(e.target.value)}
                                        className="w-full bg-black/70 border border-white/10 px-2.5 py-1.5 text-[11px] text-white outline-none focus:border-amber-500 placeholder:text-neutral-600 font-sans"
                                      />
                                    </div>
                                    <div className="overflow-y-auto flex-1 max-h-48 divide-y divide-white/5">
                                      {bankList
                                        .filter(b => {
                                          const q = bankSearch.toLowerCase();
                                          return !q || (b.short_name || b.shortName || '').toLowerCase().includes(q) || (b.name || '').toLowerCase().includes(q);
                                        })
                                        .map(b => {
                                          const sn = b.short_name || b.shortName;
                                          const selected = bankForm.bankName === sn;
                                          return (
                                            <button
                                              key={b.bin || b.id || sn}
                                              type="button"
                                              onClick={() => {
                                                setBankForm(f => ({ ...f, bankName: sn }));
                                                setBankErrors(err => ({ ...err, bankName: '' }));
                                                setBankDropdownOpen(false);
                                                setBankSearch('');
                                              }}
                                              className={`w-full flex items-center gap-2.5 px-3 py-2 text-left text-[11px] transition hover:bg-white/10 ${selected ? 'bg-amber-500/15' : ''
                                                }`}
                                            >
                                              {b.logo ? (
                                                <img src={b.logo} alt={sn} className="h-5 w-8 object-contain bg-white/10 rounded flex-shrink-0 p-0.5" />
                                              ) : (
                                                <div className="h-5 w-8 bg-white/10 rounded flex-shrink-0" />
                                              )}
                                              <span className={`font-bold flex-shrink-0 ${selected ? 'text-amber-400' : 'text-white'}`}>{sn}</span>
                                              <span className="text-neutral-400 truncate text-[10px]">{b.name}</span>
                                            </button>
                                          );
                                        })}
                                    </div>
                                  </div>
                                )}
                                {bankErrors.bankName && <p className="mt-1 text-[9px] text-rose-400">{bankErrors.bankName}</p>}
                              </div>

                              {/* Số tài khoản & Tên chủ tài khoản */}
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                                <div>
                                  <label className="block text-[10px] font-black text-neutral-400 uppercase tracking-[0.18em] mb-1">
                                    Số tài khoản ngân hàng
                                  </label>
                                  <input
                                    type="text"
                                    inputMode="numeric"
                                    maxLength={15}
                                    value={bankForm.accountNumber}
                                    onChange={e => {
                                      const digits = e.target.value.replace(/\D/g, '').slice(0, 15);
                                      setBankForm(f => ({ ...f, accountNumber: digits }));
                                      setBankErrors(err => ({ ...err, accountNumber: '' }));
                                    }}
                                    placeholder="8 - 15 chữ số"
                                    className={`w-full bg-black/60 border px-3 py-2 text-[11px] text-white outline-none transition font-mono tracking-wider ${bankErrors.accountNumber ? 'border-rose-500/70' : 'border-neutral-800 focus:border-amber-500'
                                      }`}
                                  />
                                  {bankErrors.accountNumber && <p className="mt-1 text-[9px] text-rose-400">{bankErrors.accountNumber}</p>}
                                </div>

                                <div>
                                  <label className="block text-[10px] font-black text-neutral-400 uppercase tracking-[0.18em] mb-1">
                                    Tên chủ tài khoản (in hoa)
                                  </label>
                                  <input
                                    type="text"
                                    value={bankForm.accountHolder}
                                    onChange={e => {
                                      const cleaned = e.target.value.replace(/[^a-zA-Z\s\u00C0-\u024F\u1E00-\u1EFF]/g, '').toUpperCase();
                                      setBankForm(f => ({ ...f, accountHolder: cleaned }));
                                      setBankErrors(err => ({ ...err, accountHolder: '' }));
                                    }}
                                    placeholder="VD: NGUYEN VAN A"
                                    className={`w-full bg-black/60 border px-3 py-2 text-[11px] text-white outline-none transition uppercase tracking-wider font-bold ${bankErrors.accountHolder ? 'border-rose-500/70' : 'border-neutral-800 focus:border-amber-500'
                                      }`}
                                  />
                                  {bankErrors.accountHolder && <p className="mt-1 text-[9px] text-rose-400">{bankErrors.accountHolder}</p>}
                                </div>
                              </div>

                              {bankErrors.general && (
                                <p className="text-[9px] text-rose-400 bg-rose-500/10 border border-rose-500/20 px-3 py-2">{bankErrors.general}</p>
                              )}

                              {/* Action Buttons */}
                              <div className="flex gap-2 pt-1">
                                <button
                                  type="button"
                                  disabled={isLinkingBank}
                                  onClick={handleLinkBank}
                                  className="flex-1 py-2.5 bg-amber-500 hover:bg-amber-400 text-black font-sans uppercase text-[10px] font-black tracking-widest transition flex items-center justify-center gap-2 shadow-lg"
                                >
                                  {isLinkingBank ? (
                                    <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                                  ) : (
                                    <Check className="h-3.5 w-3.5" />
                                  )}
                                  XÁC THỰC & LIÊN KẾT TÀI KHOẢN NGÂN HÀNG
                                </button>
                                {linkedBank && (
                                  <button
                                    type="button"
                                    onClick={handleUnlinkBank}
                                    className="px-3 py-2.5 bg-neutral-900 border border-white/10 hover:border-rose-500/50 hover:bg-rose-950/20 text-neutral-400 hover:text-rose-400 text-[10px] font-mono transition"
                                    title="Hủy liên kết tài khoản"
                                  >
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </button>
                                )}
                              </div>
                              <p className="text-[9px] text-neutral-500 leading-relaxed italic">
                                * Thông tin tài khoản ngân hàng sẽ được lưu trữ an toàn và dùng để nhận tiền khi thực hiện lệnh rút từ ví CineWallet.
                              </p>
                            </div>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>

                  {/* 3. MẬT KHẨU & BẢO MẬT */}
                  <div className="border border-white/5 bg-black/40 overflow-hidden text-neutral-400">
                    <button
                      onClick={() => {
                        playPing(activePanel === 'security' ? 380 : 450, 'sine', 0.1);
                        setActivePanel(activePanel === 'security' ? null : 'security');
                      }}
                      className={`w-full flex items-center justify-between p-3.5 text-xs text-neutral-400 hover:text-white transition duration-200 text-left ${activePanel === 'security' ? 'bg-neutral-950/60 pb-2 text-white border-b border-white/5' : ''
                        }`}
                    >
                      <span className="flex items-center gap-2.5 font-bold uppercase tracking-wider">
                        <Lock className={`h-4 w-4 ${activePanel === 'security' ? 'text-amber-400' : 'text-neutral-500'}`} />
                        Mật khẩu & Bảo an
                      </span>
                      <ChevronDown className={`h-3.5 w-3.5 text-neutral-500 transition-transform duration-300 ${activePanel === 'security' ? 'rotate-180 text-white' : ''
                        }`} />
                    </button>

                    <AnimatePresence initial={false}>
                      {activePanel === 'security' && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          className="overflow-hidden"
                        >
                          <div className="p-4 space-y-4 text-xs">

                            <p className="text-[10px] text-neutral-400 leading-relaxed">
                              Cập nhật khóa bảo vệ cá nhân định kì để giữ vững hạng tài khoản Thẻ VIP và chống thâm nhập mật trái phép.
                            </p>

                            <div className="space-y-3">
                              <div className="space-y-1">
                                <label className="text-[10px] uppercase tracking-[0.18em] text-neutral-400 font-black block">Mật khẩu cũ</label>
                                <div className="relative">
                                  <input
                                    type={showOldPass ? "text" : "password"}
                                    value={oldPassword}
                                    onChange={(e) => setOldPassword(e.target.value)}
                                    placeholder="Nhập mật khẩu hiện tại..."
                                    className="w-full bg-black border border-neutral-850 p-2 text-xs text-white focus:outline-none focus:border-white tracking-widest placeholder-neutral-805"
                                  />
                                  <button
                                    type="button"
                                    onClick={() => { playPing(350, 'sine', 0.05); setShowOldPass(!showOldPass); }}
                                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-neutral-550 hover:text-white"
                                  >
                                    {showOldPass ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                                  </button>
                                </div>
                              </div>

                              <div className="space-y-1">
                                <label className="text-[10px] uppercase tracking-[0.18em] text-neutral-400 font-black block">Mật khẩu mới</label>
                                <div className="relative">
                                  <input
                                    type={showNewPass ? "text" : "password"}
                                    value={newPassword}
                                    onChange={(e) => setNewPassword(e.target.value)}
                                    placeholder="Tối thiểu 8 ký tự, có chữ hoa, chữ thường, số và ký tự đặc biệt..."
                                    className="w-full bg-black border border-neutral-850 p-2 text-xs text-white focus:outline-none focus:border-white tracking-widest placeholder-neutral-805"
                                  />
                                  <button
                                    type="button"
                                    onClick={() => { playPing(350, 'sine', 0.05); setShowNewPass(!showNewPass); }}
                                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-neutral-550 hover:text-white"
                                  >
                                    {showNewPass ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                                  </button>
                                </div>
                              </div>
                            </div>



                            <div className="space-y-3">
                              <div className="space-y-1">
                                <label className="text-[10px] uppercase tracking-[0.18em] text-neutral-400 font-black block">Xác nhận mật khẩu mới</label>
                                <div className="relative">
                                  <input
                                    type={showNewPass ? "text" : "password"}
                                    value={confirmPassword}
                                    onChange={(e) => setConfirmPassword(e.target.value)}
                                    placeholder="Nhập lại mật khẩu mới..."
                                    className="w-full bg-black border border-neutral-850 p-2 text-xs text-white focus:outline-none focus:border-white tracking-widest placeholder-neutral-805"
                                  />
                                  <button
                                    type="button"
                                    onClick={() => { playPing(350, 'sine', 0.05); setShowNewPass(!showNewPass); }}
                                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-neutral-550 hover:text-white"
                                  >
                                    {showNewPass ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                                  </button>
                                </div>
                              </div>
                            </div>

                            {passwordNotification && (
                              <div className={`border p-2 text-[10px] font-semibold leading-relaxed ${passwordNotification.type === 'success'
                                ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300'
                                : 'border-rose-500/30 bg-rose-500/10 text-rose-300'
                                }`}>
                                {passwordNotification.text}
                              </div>
                            )}

                            <button
                              onClick={handleChangePassword}
                              disabled={isChangingPassword}
                              className="w-full py-2.5 bg-[#121212] border border-white/10 text-white font-sans uppercase text-[10px] hover:border-white transition tracking-widest font-black disabled:opacity-60"
                            >
                              {isChangingPassword ? 'ĐANG ĐỔI MẬT KHẨU...' : 'XÁC NHẬN ĐỔI MẬT KHẨU'}
                            </button>

                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>

                  {/* CINEAI PRIVACY & GDPR ACCORDION ITEM */}
                  <div className="border border-white/5 bg-neutral-900/30">
                    <button
                      onClick={() => {
                        playPing(activePanel === 'ai-privacy' ? 380 : 450, 'sine', 0.1);
                        setActivePanel(activePanel === 'ai-privacy' ? null : 'ai-privacy');
                      }}
                      className={`w-full flex items-center justify-between p-3.5 text-xs text-neutral-400 hover:text-white transition duration-200 text-left ${activePanel === 'ai-privacy' ? 'bg-neutral-950/60 pb-2 text-white border-b border-white/5' : ''
                        }`}
                    >
                      <span className="flex items-center gap-2.5 font-bold uppercase tracking-wider">
                        <Sparkles className={`h-4 w-4 ${activePanel === 'ai-privacy' ? 'text-purple-400' : 'text-neutral-500'}`} />
                        Cá nhân hóa CineAI & Quyền riêng tư (GDPR)
                      </span>
                      <ChevronDown className={`h-3.5 w-3.5 text-neutral-500 transition-transform duration-300 ${activePanel === 'ai-privacy' ? 'rotate-180 text-white' : ''
                        }`} />
                    </button>

                    <AnimatePresence initial={false}>
                      {activePanel === 'ai-privacy' && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          className="overflow-hidden"
                        >
                          <div className="p-4 space-y-3.5 text-xs">
                            <p className="text-[10px] text-neutral-400 leading-relaxed">
                              Hệ thống CineAI (http://localhost:8032) phân tích lịch sử xem phim, đánh giá và tương tác để đưa ra đề xuất phim phù hợp nhất với bạn. Dữ liệu được bảo mật và tuân thủ quyền riêng tư người dùng theo chuẩn GDPR.
                            </p>

                            <div className="p-3 bg-black/50 border border-white/5 space-y-2">
                              <div className="flex justify-between text-[11px]">
                                <span className="text-neutral-400">Trạng thái mô hình:</span>
                                <span className="text-emerald-400 font-bold flex items-center gap-1">
                                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" /> Đang hoạt động (Dual Profile + Pearson CF)
                                </span>
                              </div>
                              <div className="flex justify-between text-[11px]">
                                <span className="text-neutral-400">Mã người dùng:</span>
                                <span className="text-white font-mono font-bold">#{currentUser?.id || 'GUEST'}</span>
                              </div>
                              <div className="flex justify-between text-[11px]">
                                <span className="text-neutral-400">Quyền được lãng quên:</span>
                                <span className="text-purple-300">Được bảo vệ (GDPR Article 17)</span>
                              </div>
                            </div>

                            <button
                              type="button"
                              onClick={handlePurgeAiData}
                              disabled={isPurgingAiData}
                              className="w-full py-2.5 bg-rose-950/20 hover:bg-rose-900/40 border border-rose-500/30 text-rose-300 hover:text-white font-sans uppercase text-[10px] transition tracking-widest font-black disabled:opacity-60 flex items-center justify-center gap-2 cursor-pointer"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                              {isPurgingAiData ? 'ĐANG XÓA DỮ LIỆU...' : 'XÓA TOÀN BỘ DỮ LIỆU ĐỀ XUẤT AI'}
                            </button>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>

                </div>

                {/* LOGOUT SECURE ACTION BAR */}
                <div className="border-t border-white/5 pt-3.5">
                  <button
                    onClick={() => {
                      playPing(300, 'sawtooth', 0.3);
                      onLogout();
                    }}
                    className="w-full flex items-center justify-center gap-2 p-3 text-xs font-black text-rose-400 hover:text-white bg-rose-950/5 hover:bg-rose-900/30 border border-rose-950/30 hover:border-rose-500/40 transition duration-300 uppercase tracking-[0.16em] text-center"
                  >
                    <LogOut className="h-3.5 w-3.5" />
                    ĐĂNG XUẤT</button>
                </div>

              </div>

            </div>

          </div>
        </>
      )}

      {/* ── MODAL CHI TIẾT LỆNH RÚT TIỀN (WITHDRAWAL VOUCHER) ── */}
      {selectedWdDetail && createPortal(
        <div
          onClick={(e) => { if (e.target === e.currentTarget) setSelectedWdDetail(null); }}
          className="fixed inset-0 z-[9999] flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-sm animate-in fade-in duration-200"
        >
          <div className="relative w-full max-w-[450px] max-h-[88vh] overflow-y-auto border border-amber-500/30 bg-[#0c0c0c] shadow-2xl p-4 sm:p-5 space-y-3 rounded-xl scrollbar-thin scrollbar-thumb-white/10 my-auto">
            {/* Header */}
            <div className="flex items-start justify-between border-b border-white/10 pb-2.5">
              <div className="flex items-center gap-2.5">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                  selectedWdDetail.status === 'PAID'
                    ? 'bg-emerald-500/20 border border-emerald-500/40 text-emerald-400'
                    : selectedWdDetail.status === 'REJECTED'
                      ? 'bg-rose-500/20 border border-rose-500/40 text-rose-400'
                      : 'bg-amber-500/20 border border-amber-500/40 text-amber-400'
                }`}>
                  {selectedWdDetail.status === 'PAID' ? (
                    <CheckCircle2 className="h-4 w-4" />
                  ) : selectedWdDetail.status === 'REJECTED' ? (
                    <XCircle className="h-4 w-4" />
                  ) : (
                    <Clock className="h-4 w-4" />
                  )}
                </div>
                <div>
                  <h3 className="text-xs sm:text-[13px] font-black uppercase tracking-wider text-white leading-tight">
                    {selectedWdDetail.status === 'PAID'
                      ? 'Biên nhận chuyển tiền thành công'
                      : selectedWdDetail.status === 'REJECTED'
                        ? 'Biên bản từ chối lệnh rút tiền'
                        : 'Phiếu yêu cầu rút tiền (Chờ duyệt)'}
                  </h3>
                  <p className="text-[11px] text-neutral-400 mt-0.5">
                    CineWallet · Hệ thống thanh toán CinePremier
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedWdDetail(null)}
                className="text-neutral-500 hover:text-white p-1 transition rounded-lg hover:bg-white/5"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Số tiền rút / Cộng lại */}
            <div className="text-center py-2.5 bg-black/60 border border-white/5 rounded-lg space-y-0.5">
              <p className="text-[11px] font-black uppercase tracking-wider text-neutral-400">
                {selectedWdDetail.status === 'REJECTED' ? 'Số tiền cộng vào ví' : 'Số tiền rút'}
              </p>
              <p className={`text-xl font-mono font-black ${
                selectedWdDetail.status === 'REJECTED'
                  ? 'text-emerald-400'
                  : selectedWdDetail.status === 'PAID'
                    ? 'text-white'
                    : 'text-amber-400'
              }`}>
                {selectedWdDetail.status === 'REJECTED' ? '+' : '-'}{Number(selectedWdDetail.amount || 0).toLocaleString('vi-VN')}đ
              </p>
              <div className="inline-block mt-0.5">
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider ${
                  selectedWdDetail.status === 'PAID'
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                    : selectedWdDetail.status === 'REJECTED'
                      ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                      : 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                }`}>
                  {selectedWdDetail.status === 'PAID'
                    ? '✓ Đã chuyển tiền thành công'
                    : selectedWdDetail.status === 'REJECTED'
                      ? '✓ Bị từ chối · Đã cộng tiền vào ví'
                      : '⏳ Đang chờ Admin duyệt chuyển khoản'}
                </span>
              </div>
            </div>

            {/* Thông báo tình trạng & Lý do từ chối (NỔI BẬT) */}
            {selectedWdDetail.status === 'REJECTED' && (
              <div className="p-2.5 sm:p-3 rounded-lg bg-rose-500/10 border border-rose-500/30 text-xs text-rose-200 space-y-1.5">
                <div className="flex items-start gap-2">
                  <AlertCircle className="h-3.5 w-3.5 text-rose-400 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-bold text-rose-300 text-xs">Lý do từ chối từ Quản trị viên:</p>
                    <p className="mt-1 text-white italic text-[11px] leading-relaxed bg-black/50 p-2 rounded-md border border-rose-500/20">
                      "{selectedWdDetail.processedNote || 'Thông tin tài khoản không hợp lệ hoặc giao dịch không đáp ứng điều kiện rút tiền.'}"
                    </p>
                  </div>
                </div>
                <div className="pt-1.5 border-t border-rose-500/20 flex items-center gap-1.5 text-emerald-400 font-bold text-[11px]">
                  <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
                  <span>Số tiền +{Number(selectedWdDetail.amount).toLocaleString('vi-VN')}đ đã được tự động CỘNG VÀO VÍ 100% vào số dư ví CineWallet của bạn.</span>
                </div>
              </div>
            )}

            {selectedWdDetail.status === 'PAID' && (
              <div className="p-2.5 sm:p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-xs text-emerald-200 flex items-start gap-2">
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <p className="font-bold text-emerald-300 text-xs">Giao dịch đã được duyệt & chuyển khoản thành công!</p>
                  <p className="text-neutral-300 leading-relaxed text-[11px]">
                    Admin đã chuyển tiền đến tài khoản của bạn vào <strong className="text-white font-mono">{formatDateTimeVi(selectedWdDetail.processedAt)}</strong>. Quý khách vui lòng kiểm tra tài khoản nhận.
                  </p>
                  {selectedWdDetail.processedNote && (
                    <p className="text-neutral-400 italic text-[11px] pt-0.5">Ghi chú: "{selectedWdDetail.processedNote}"</p>
                  )}
                </div>
              </div>
            )}

            {selectedWdDetail.status !== 'PAID' && selectedWdDetail.status !== 'REJECTED' && (
              <div className="p-2.5 sm:p-3 rounded-lg bg-amber-500/10 border border-amber-500/30 text-xs text-amber-200 flex items-start gap-2">
                <Clock className="h-3.5 w-3.5 text-amber-400 shrink-0 mt-0.5" />
                <div>
                  <p className="font-bold text-amber-300 text-xs">Yêu cầu rút tiền đang chờ xử lý</p>
                  <p className="text-neutral-300 mt-0.5 leading-relaxed text-[11px]">
                    Hệ thống đã tạm giữ số tiền rút. Ban quản trị đang kiểm tra và sẽ thực hiện chuyển khoản trong vòng 1-24 giờ làm việc.
                  </p>
                </div>
              </div>
            )}

            {/* Thông số chi tiết */}
            <div className="space-y-1 text-xs bg-black/40 p-2.5 sm:p-3 rounded-lg border border-white/5">
              <div className="flex items-center justify-between py-1 border-b border-white/5">
                <span className="text-neutral-400 text-[11px]">Mã yêu cầu rút tiền:</span>
                <div className="flex items-center gap-1.5 font-mono font-bold text-white text-[11px]">
                  <span>#WD-{selectedWdDetail.id}</span>
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard.writeText(`#WD-${selectedWdDetail.id}`);
                      showToast('Đã sao chép mã yêu cầu');
                    }}
                    className="text-neutral-400 hover:text-white p-0.5"
                  >
                    <Copy className="h-3 w-3" />
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-between py-1 border-b border-white/5">
                <span className="text-neutral-400 text-[11px]">Ngân hàng thụ hưởng:</span>
                <span className="font-bold text-white text-[11px]">{selectedWdDetail.bankName}</span>
              </div>

              <div className="flex items-center justify-between py-1 border-b border-white/5">
                <span className="text-neutral-400 text-[11px]">Số tài khoản:</span>
                <span className="font-mono font-bold text-amber-400 text-[11px]">{selectedWdDetail.accountNumber}</span>
              </div>

              <div className="flex items-center justify-between py-1 border-b border-white/5">
                <span className="text-neutral-400 text-[11px]">Tên chủ tài khoản:</span>
                <span className="font-bold text-white uppercase text-[11px]">{selectedWdDetail.accountHolder}</span>
              </div>

              <div className="flex items-center justify-between py-1 border-b border-white/5">
                <span className="text-neutral-400 text-[11px]">Thời gian gửi yêu cầu:</span>
                <span className="font-mono text-white text-[11px]">
                  {formatDateTimeVi(selectedWdDetail.createdAt)}
                </span>
              </div>

              {selectedWdDetail.processedAt && (
                <div className="flex items-center justify-between py-1 border-b border-white/5">
                  <span className="text-neutral-400 text-[11px]">
                    {selectedWdDetail.status === 'PAID' ? 'Thời gian chuyển tiền:' : 'Thời gian từ chối:'}
                  </span>
                  <span className="font-mono font-bold text-white text-[11px]">
                    {formatDateTimeVi(selectedWdDetail.processedAt)}
                  </span>
                </div>
              )}

              {selectedWdDetail.processedMethod && (
                <div className="flex items-center justify-between py-1">
                  <span className="text-neutral-400 text-[11px]">Phương thức chuyển khoản:</span>
                  <span className="text-neutral-100 font-medium text-[11px]">{selectedWdDetail.processedMethod}</span>
                </div>
              )}
            </div>

            {/* Button đóng */}
            <button
              type="button"
              onClick={() => setSelectedWdDetail(null)}
              className="w-full bg-white hover:bg-neutral-200 text-black py-2 text-xs font-black uppercase tracking-wider transition rounded-lg"
            >
              Đóng biên nhận
            </button>
          </div>
        </div>,
        document.body
      )}

      {/* ── MODAL CHI TIẾT GIAO DỊCH VÍ / HOÀN TIỀN VÉ ── */}
      {selectedTxDetail && createPortal(
        <div
          onClick={(e) => { if (e.target === e.currentTarget) setSelectedTxDetail(null); }}
          className="fixed inset-0 z-[9999] flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-sm animate-in fade-in duration-200"
        >
          <div className="relative w-full max-w-[450px] max-h-[88vh] overflow-y-auto border border-amber-500/30 bg-[#0c0c0c] shadow-2xl p-4 sm:p-5 space-y-3 rounded-xl scrollbar-thin scrollbar-thumb-white/10 my-auto">
            {/* Header */}
            <div className="flex items-start justify-between border-b border-white/10 pb-2.5">
              <div className="flex items-center gap-2.5">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                  (selectedTxDetail.type === 'REFUND_CREDIT' || selectedTxDetail.type === 'WITHDRAWAL_REFUND' || selectedTxDetail.type === 'WITHDRAWAL_REJECTED')
                    ? 'bg-emerald-500/20 border border-emerald-500/40 text-emerald-400'
                    : 'bg-amber-500/20 border border-amber-500/40 text-amber-400'
                }`}>
                  {(selectedTxDetail.type === 'REFUND_CREDIT' || selectedTxDetail.type === 'WITHDRAWAL_REFUND' || selectedTxDetail.type === 'WITHDRAWAL_REJECTED') ? (
                    <CheckCircle2 className="h-4 w-4" />
                  ) : (
                    <ArrowUpRight className="h-4 w-4" />
                  )}
                </div>
                <div>
                  <h3 className="text-xs sm:text-[13px] font-black uppercase tracking-wider text-white leading-tight">
                    {selectedTxDetail.type === 'REFUND_CREDIT'
                      ? 'Biên nhận hoàn tiền vé'
                      : (selectedTxDetail.type === 'WITHDRAWAL_REFUND' || selectedTxDetail.type === 'WITHDRAWAL_REJECTED')
                        ? 'Biên nhận hoàn trả số dư rút'
                        : selectedTxDetail.type === 'WITHDRAWAL_HOLD'
                          ? 'Chi tiết yêu cầu rút tiền'
                          : 'Chi tiết giao dịch ví'}
                  </h3>
                  <p className="text-[11px] text-neutral-400 mt-0.5">
                    {selectedTxDetail.type === 'REFUND_CREDIT'
                      ? 'Hoàn 100% tiền vé trực tiếp vào số dư ví CineWallet'
                      : (selectedTxDetail.type === 'WITHDRAWAL_REFUND' || selectedTxDetail.type === 'WITHDRAWAL_REJECTED')
                        ? 'Hoàn trả lại 100% số tiền vào số dư ví do lệnh rút bị từ chối'
                        : 'Mã đối soát giao dịch hệ thống CinePremier'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedTxDetail(null)}
                className="text-neutral-500 hover:text-white p-1 transition rounded-lg hover:bg-white/5"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Số tiền biến động */}
            <div className="text-center py-2.5 bg-black/60 border border-white/5 rounded-lg space-y-0.5">
              <p className="text-[11px] font-black uppercase tracking-wider text-neutral-400">
                {(selectedTxDetail.type === 'REFUND_CREDIT' || selectedTxDetail.type === 'WITHDRAWAL_REFUND' || selectedTxDetail.type === 'WITHDRAWAL_REJECTED')
                  ? 'Số tiền cộng vào ví'
                  : 'Số tiền giao dịch'}
              </p>
              <p className={`text-xl font-mono font-black ${
                (selectedTxDetail.type === 'REFUND_CREDIT' || selectedTxDetail.type === 'WITHDRAWAL_REFUND' || selectedTxDetail.type === 'WITHDRAWAL_REJECTED' || Number(selectedTxDetail.amount) > 0)
                  ? 'text-emerald-400'
                  : 'text-amber-400'
              }`}>
                {(selectedTxDetail.type === 'REFUND_CREDIT' || selectedTxDetail.type === 'WITHDRAWAL_REFUND' || selectedTxDetail.type === 'WITHDRAWAL_REJECTED' || Number(selectedTxDetail.amount) > 0) ? '+' : '-'}
                {Math.abs(Number(selectedTxDetail.amount || 0)).toLocaleString('vi-VN')}đ
              </p>
              <div className="inline-block mt-0.5">
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider ${
                  (selectedTxDetail.type === 'REFUND_CREDIT' || selectedTxDetail.type === 'WITHDRAWAL_REFUND' || selectedTxDetail.type === 'WITHDRAWAL_REJECTED')
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                    : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                }`}>
                  {selectedTxDetail.type === 'REFUND_CREDIT'
                    ? 'Đã hoàn tiền vé vào ví thành công (100%)'
                    : (selectedTxDetail.type === 'WITHDRAWAL_REFUND' || selectedTxDetail.type === 'WITHDRAWAL_REJECTED')
                      ? 'Đã cộng tiền vào ví thành công (100%)'
                      : 'Giao dịch thành công'}
                </span>
              </div>
            </div>

            {/* Thông số chi tiết */}
            <div className="space-y-1 text-xs bg-black/40 p-2.5 sm:p-3 rounded-lg border border-white/5">
              <div className="flex items-center justify-between py-1 border-b border-white/5">
                <span className="text-neutral-400 text-[11px]">Mã giao dịch / Tham chiếu:</span>
                <div className="flex items-center gap-1.5 font-mono font-bold text-white text-[11px]">
                  <span>{selectedTxDetail.referenceCode || selectedTxDetail.id || 'N/A'}</span>
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard.writeText(selectedTxDetail.referenceCode || selectedTxDetail.id || '');
                      showToast('Đã sao chép mã giao dịch');
                    }}
                    className="text-neutral-400 hover:text-white p-0.5"
                  >
                    <Copy className="h-3 w-3" />
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-between py-1 border-b border-white/5">
                <span className="text-neutral-400 text-[11px]">Thời gian ghi nhận:</span>
                <span className="font-mono text-white text-[11px]">
                  {selectedTxDetail.createdAt ? new Date(selectedTxDetail.createdAt).toLocaleString('vi-VN') : 'Vừa xong'}
                </span>
              </div>

              <div className="flex items-center justify-between py-1 border-b border-white/5">
                <span className="text-neutral-400 text-[11px]">Loại giao dịch:</span>
                <span className="font-bold text-white text-[11px]">
                  {selectedTxDetail.type === 'REFUND_CREDIT'
                    ? 'Hoàn tiền vé (Refund Ticket)'
                    : selectedTxDetail.type === 'WITHDRAWAL_HOLD'
                      ? 'Khấu trừ rút tiền (Withdrawal Hold)'
                      : (selectedTxDetail.type === 'WITHDRAWAL_REFUND' || selectedTxDetail.type === 'WITHDRAWAL_REJECTED')
                        ? 'Cộng tiền vào ví (Hoàn trả lệnh rút bị từ chối)'
                        : selectedTxDetail.type}
                </span>
              </div>

              {selectedTxDetail.balanceAfter !== undefined && selectedTxDetail.balanceAfter !== null && (
                <div className="flex items-center justify-between py-1 border-b border-white/5">
                  <span className="text-neutral-400 text-[11px]">Số dư ví sau GD:</span>
                  <span className="font-mono font-bold text-amber-400 text-[11px]">
                    {Number(selectedTxDetail.balanceAfter).toLocaleString('vi-VN')}đ
                  </span>
                </div>
              )}

              <div className="py-1">
                <span className="text-neutral-400 font-bold block mb-1 text-[11px]">Mô tả / Ghi chú:</span>
                <div className="p-2 bg-black/50 border border-white/10 rounded-md text-[11px] text-neutral-300 leading-relaxed italic">
                  {selectedTxDetail.description || (
                    selectedTxDetail.type === 'REFUND_CREDIT'
                      ? 'Khoản hoàn trả 100% giá trị tiền vé của quý khách đã được cộng vào tài khoản ví CineWallet. Quý khách có thể sử dụng ngay để đặt các suất chiếu khác hoặc thực hiện rút về tài khoản ngân hàng.'
                      : (selectedTxDetail.type === 'WITHDRAWAL_REFUND' || selectedTxDetail.type === 'WITHDRAWAL_REJECTED')
                        ? 'Khoản tiền yêu cầu rút đã được tự động cộng lại 100% vào số dư ví CineWallet của bạn do Quản trị viên từ chối lệnh rút tiền.'
                        : 'Giao dịch qua hệ thống thanh toán CinePremier.'
                  )}
                </div>
              </div>
            </div>

            {/* Button đóng */}
            <button
              type="button"
              onClick={() => setSelectedTxDetail(null)}
              className="w-full bg-white hover:bg-neutral-200 text-black py-2 text-xs font-black uppercase tracking-wider transition rounded-lg"
            >
              Đóng biên nhận
            </button>
          </div>
        </div>,
        document.body
      )}

    </div>
  );
}
