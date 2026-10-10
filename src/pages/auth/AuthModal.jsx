import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import {
  X, User, Mail, Lock, Phone, ShieldCheck, Check,
  Sparkles, ArrowRight, Eye, EyeOff, Film, Ticket,
  Heart, Sparkle, AlertCircle
} from 'lucide-react';
import { authService, saveAuthSession } from '../../services/authService';
import { movieService } from '../../services/movieService';
import { useAuthStore } from '../../stores/useAuthStore';
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

const AVATAR_PRESETS = [
  { id: 'critic', name: 'Nhà Phê Bình', emoji: '🎬', bg: 'from-amber-500 to-orange-600' },
  { id: 'popcorn', name: 'Tín Đồ Bắp Rang', emoji: '🍿', bg: 'from-yellow-400 to-gold-600' },
  { id: 'astronaut', name: 'Du Hành Vũ Trụ', emoji: '👩‍🚀', bg: 'from-cyan-500 to-blue-600' },
  { id: 'director', name: 'Đạo Diễn VIP', emoji: '🎥', bg: 'from-rose-500 to-red-600' },
  { id: 'cyberpunk', name: 'Cinephile 2088', emoji: '🕶️', bg: 'from-purple-500 to-fuchsia-600' }
];

const GENRE_PRESETS = [
  'Hành Động • IMAX', 'Khoa Học Viễn Tưởng', 'Kinh Dị • Giật Gân', 'Trinh Thám Noir', 'Tình Cảm • Lãng Mạn'
];

const GOOGLE_IDENTITY_SCRIPT_SRC = 'https://accounts.google.com/gsi/client';
const EMAIL_VERIFICATION_TTL_SECONDS = 10 * 60;

export default function AuthModal({
  isOpen,
  onClose,
  phoneNumber,
  setPhoneNumber,
  otpCode,
  setOtpCode,
  initialTab = 'login',
  onPolicyClick = () => { }
}) {
  const navigate = useNavigate();
  const handleLoginSuccess = useAuthStore((state) => state.handleLoginSuccess);
  const completeLogin = useCallback((user) => {
    handleLoginSuccess(user, { navigate });
  }, [handleLoginSuccess, navigate]);
  const [activeTab, setActiveTab] = useState('login'); // 'login' | 'register' | 'forgot_password'
  const loginMethod = 'password';
  const setLoginMethod = () => { };

  // Forgot Password / OTP Recovery States
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotOtp, setForgotOtp] = useState('');
  const [forgotNewPass, setForgotNewPass] = useState('');
  const [forgotConfirmPass, setForgotConfirmPass] = useState('');
  const [forgotStep, setForgotStep] = useState(1); // 1: Email Input, 2: Code verification, 3: Set new Password
  const [generatedForgotOtp, setGeneratedForgotOtp] = useState('');
  const [showForgotConfirmPass, setShowForgotConfirmPass] = useState(false);

  // Registration States
  const [regName, setRegName] = useState('');
  const [regPhone, setRegPhone] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regDateOfBirth, setRegDateOfBirth] = useState('');
  const [regUsername, setRegUsername] = useState('');
  const [regIdentityNumber, setRegIdentityNumber] = useState('');
  const [regConfirmPassword, setRegConfirmPassword] = useState('');
  const [regFavoriteCinemaId, setRegFavoriteCinemaId] = useState('');
  const [registrationCinemas, setRegistrationCinemas] = useState([]);
  const [cinemaLoadError, setCinemaLoadError] = useState(false);
  const [showRegPassword, setShowRegPassword] = useState(false);
  const [regOtp, setRegOtp] = useState('');
  const [registerStep, setRegisterStep] = useState('form'); // 'form' | 'verify'
  const [pendingRegistration, setPendingRegistration] = useState(null);
  const [emailOtpSecondsLeft, setEmailOtpSecondsLeft] = useState(0);
  const [emailOtpExpiresAt, setEmailOtpExpiresAt] = useState(null);
  const [selectedAvatar, setSelectedAvatar] = useState('director');
  const [selectedGenre, setSelectedGenre] = useState('Hành Động • IMAX');
  const [agreeTerms, setAgreeTerms] = useState(false);
  const [showPrivacyPolicy, setShowPrivacyPolicy] = useState(false);

  // Security & Visual States
  const [showPassword, setShowPassword] = useState(false);
  const [notification, setNotification] = useState(null); // { type: 'success'|'error', text: '' }
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [googleButtonError, setGoogleButtonError] = useState('');
  const [googleButtonReady, setGoogleButtonReady] = useState(false);
  const [googleButtonHostReady, setGoogleButtonHostReady] = useState(false);
  const googleScriptPromiseRef = useRef(null);
  const googleClientInitializedRef = useRef(false);
  const googleButtonRef = useRef(null);
  const googleClientId = (
    import.meta.env.VITE_GOOGLE_CLIENT_ID ||
    import.meta.env.GOOGLE_OAUTH_CLIENT_ID ||
    ''
  ).trim();
  const googleAllowedOrigins = String(import.meta.env.VITE_GOOGLE_ALLOWED_ORIGINS || '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
  const currentOrigin = typeof window !== 'undefined' ? window.location.origin : '';
  const isCurrentOriginConfigured = !googleAllowedOrigins.length || googleAllowedOrigins.includes(currentOrigin);
  const googleSetupHelp = `Origin hiện tại: ${currentOrigin}. Hãy thêm đúng origin này vào Google Cloud Console > OAuth Client > Authorized JavaScript origins.`;

  // Password Login States
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPass, setLoginPass] = useState('');

  useEffect(() => {
    if (!isOpen) return;
    if (!['login', 'register'].includes(initialTab)) return;
    setActiveTab(initialTab);
    if (initialTab === 'register') {
      setRegisterStep('form');
    }
  }, [initialTab, isOpen]);

  // Clean Web Audio VIP synth ping sound for high-class vibe
  const playPing = (freq = 440, type = 'sine', duration = 0.1) => {
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = type;
      osc.frequency.setValueAtTime(freq, ctx.currentTime);

      gain.gain.setValueAtTime(0.08, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start();
      osc.stop(ctx.currentTime + duration);
    } catch (e) {
      // Ignored if browser blocks audio autoplay
    }
  };

  const showToast = (type, text) => {
    setNotification({ type, text });
    if (type === 'success') {
      playPing(587.33, 'sine', 0.15); // D5 note
    } else {
      playPing(220, 'sawtooth', 0.2); // A3 buzz
    }
    setTimeout(() => {
      setNotification(null);
    }, 4500);
  };

  const startEmailOtpTimer = () => {
    const expiresAt = Date.now() + EMAIL_VERIFICATION_TTL_SECONDS * 1000;
    setEmailOtpExpiresAt(expiresAt);
    setEmailOtpSecondsLeft(EMAIL_VERIFICATION_TTL_SECONDS);
  };

  const bindGoogleButtonHost = useCallback((node) => {
    googleButtonRef.current = node;
    setGoogleButtonHostReady(Boolean(node));
  }, []);

  const resetGoogleButton = () => {
    if (googleButtonRef.current) {
      googleButtonRef.current.innerHTML = '';
    }
    setGoogleButtonReady(false);
  };

  const loadGoogleIdentityScript = () => {
    if (typeof window === 'undefined') {
      return Promise.reject(new Error('Google Identity chỉ hoạt động trên trình duyệt.'));
    }
    if (window.google?.accounts?.id) {
      return Promise.resolve(true);
    }
    if (googleScriptPromiseRef.current) {
      return googleScriptPromiseRef.current;
    }

    googleScriptPromiseRef.current = new Promise((resolve, reject) => {
      const existingScript = document.querySelector('script[data-google-identity="true"]');
      if (existingScript) {
        existingScript.addEventListener('load', () => resolve(true));
        existingScript.addEventListener('error', () => reject(new Error('Không thể tải Google Identity.')));
        return;
      }

      const script = document.createElement('script');
      script.src = GOOGLE_IDENTITY_SCRIPT_SRC;
      script.async = true;
      script.defer = true;
      script.dataset.googleIdentity = 'true';
      script.onload = () => resolve(true);
      script.onerror = () => reject(new Error('Không thể tải Google Identity.'));
      document.head.appendChild(script);
    });

    return googleScriptPromiseRef.current;
  };

  const renderGoogleSignInButton = async () => {
    if (!googleClientId || googleClientId.includes('YOUR_GOOGLE_WEB_CLIENT_ID')) {
      throw new Error('Thiếu VITE_GOOGLE_CLIENT_ID trong file .env của FE.');
    }
    if (!isCurrentOriginConfigured) {
      throw new Error(`Google Sign-In chua duoc cau hinh cho origin nay. ${googleSetupHelp}`);
    }

    await loadGoogleIdentityScript();
    if (!window.google?.accounts?.id) {
      throw new Error('Không thể tải Google Identity.');
    }

    if (!googleClientInitializedRef.current) {
      window.google.accounts.id.initialize({
        client_id: googleClientId,
        callback: handleGoogleCredential,
        ux_mode: 'popup'
      });
      googleClientInitializedRef.current = true;
    }

    if (!googleButtonRef.current) return false;

    googleButtonRef.current.innerHTML = '';
    const buttonWidth = Math.max(
      320,
      Math.ceil(googleButtonRef.current.getBoundingClientRect().width || 560)
    );
    window.google.accounts.id.renderButton(googleButtonRef.current, {
      theme: 'outline',
      size: 'large',
      text: 'signin_with',
      shape: 'rectangular',
      logo_alignment: 'left',
      width: buttonWidth
    });
    setGoogleButtonError('');
    setGoogleButtonReady(true);
    return true;
  };

  useEffect(() => {
    if (!isOpen || activeTab !== 'login') {
      setGoogleButtonReady(false);
      setGoogleButtonError('');
      return undefined;
    }

    setGoogleButtonError('');
    setGoogleButtonReady(false);

    if (!googleClientId || googleClientId.includes('YOUR_GOOGLE_WEB_CLIENT_ID')) {
      setGoogleButtonError('Thiếu VITE_GOOGLE_CLIENT_ID trong file .env của FE.');
      return;
    }
    if (!isCurrentOriginConfigured) {
      setGoogleButtonError(`Google Sign-In chưa được cấu hình cho origin này. ${googleSetupHelp}`);
      return undefined;
    }
    if (!googleButtonHostReady) return undefined;

    let cancelled = false;
    let frameId = 0;

    frameId = window.requestAnimationFrame(() => {
      renderGoogleSignInButton()
        .catch((error) => {
          if (!cancelled) {
            resetGoogleButton();
            setGoogleButtonError(error.message || 'Không thể hiển thị nút Google.');
          }
        });
    });

    return () => {
      cancelled = true;
      if (frameId) window.cancelAnimationFrame(frameId);
    };
  }, [isOpen, activeTab, googleClientId, googleButtonHostReady, isCurrentOriginConfigured, googleSetupHelp]);

  useEffect(() => {
    if (!isOpen || activeTab !== 'register' || registerStep !== 'verify' || !emailOtpExpiresAt) {
      return undefined;
    }

    const syncSecondsLeft = () => {
      setEmailOtpSecondsLeft(Math.max(Math.ceil((emailOtpExpiresAt - Date.now()) / 1000), 0));
    };

    syncSecondsLeft();
    const timerId = window.setInterval(() => {
      syncSecondsLeft();
    }, 1000);

    return () => window.clearInterval(timerId);
  }, [isOpen, activeTab, registerStep, emailOtpExpiresAt]);

  const handleGoogleCredential = async (credentialResponse) => {
    const credential = credentialResponse?.credential;
    if (!credential) {
      showToast('error', 'Google không trả về credential hợp lệ.');
      return;
    }

    setIsSubmitting(true);
    try {
      const authData = await authService.loginWithGoogle(credential);
      const user = saveAuthSession(authData);

      completeLogin(user);
      playPing(880, 'sine', 0.35);
      showToast('success', `Chào mừng ${user.name || user.email} đến với CinePremier!`);
      setTimeout(() => {
        onClose();
      }, 1200);
    } catch (error) {
      playPing(150, 'sawtooth', 0.2);
      showToast('error', error.message || 'Đăng nhập Google thất bại.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handlePasswordLogin = async (e) => {
    e.preventDefault();
    if (!loginEmail || !loginPass) {
      showToast('error', 'Vui lòng cung cấp toàn bộ tài khoản và mật khẩu.');
      return;
    }
    let targetEmail = loginEmail.trim();
    if (targetEmail.toLowerCase() === 'admin') targetEmail = 'admin@gmail.com';
    if (targetEmail.toLowerCase() === 'kh') targetEmail = 'kh@gmail.com';

    setIsSubmitting(true);
    try {
      const authData = await authService.login({
        email: targetEmail,
        password: loginPass.trim()
      });
      const user = saveAuthSession(authData);

      completeLogin(user);
      playPing(880, 'sine', 0.35);
      showToast('success', `Chào mừng ${user.name || user.email} trở lại CinePremier!`);
      setTimeout(() => {
        onClose();
      }, 1200);
    } catch (error) {
      playPing(150, 'sawtooth', 0.2);
      showToast('error', error.message || 'Tài khoản Email hoặc mật khẩu không chính xác.');
    } finally {
      setIsSubmitting(false);
    }
  };

  useEffect(() => {
    if (!isOpen || activeTab !== 'register' || registerStep !== 'form') return undefined;

    let cancelled = false;
    setCinemaLoadError(false);

    movieService.getPublicCinemas()
      .then((cinemas) => {
        if (!cancelled) {
          setRegistrationCinemas(
            cinemas.filter((cinema) => !cinema.status || cinema.status === 'ACTIVE')
          );
        }
      })
      .catch(() => {
        if (!cancelled) setCinemaLoadError(true);
      });

    return () => {
      cancelled = true;
    };
  }, [activeTab, isOpen, registerStep]);

  const handleRegister = async (e) => {
    e.preventDefault();
    const cleanName = regName.trim();
    const cleanPhone = regPhone.trim();
    const cleanUsername = regUsername.trim();
    const cleanIdentityNumber = regIdentityNumber.trim();

    if (!cleanName || !cleanPhone || !regEmail || !regPassword || !regDateOfBirth || !cleanUsername || !cleanIdentityNumber || !regConfirmPassword) {
      showToast('error', 'Quý khách vui lòng điền trọn vẹn thông tin đăng ký.');
      return;
    }
    if (cleanName.length > MAX_NAME_LENGTH) {
      showToast('error', NAME_VALIDATION_MESSAGE);
      return;
    }
    if (!isValidVietnamPhone(cleanPhone)) {
      showToast('error', PHONE_VALIDATION_MESSAGE);
      return;
    }
    if (/\s/.test(cleanUsername)) {
      showToast('error', 'Tên đăng nhập không được chứa khoảng trắng.');
      return;
    }
    if (!/^(\d{9}|\d{12})$/.test(cleanIdentityNumber)) {
      showToast('error', 'Số CCCD/CMND phải gồm 9 hoặc 12 chữ số.');
      return;
    }
    if (!isStrongPassword(regPassword)) {
      showToast('error', PASSWORD_VALIDATION_MESSAGE);
      return;
    }
    if (regPassword !== regConfirmPassword) {
      showToast('error', 'Xác thực mật khẩu chưa khớp.');
      return;
    }
    if (!agreeTerms) {
      showToast('error', 'Vui lòng đồng ý với Chính sách bảo mật để tiếp tục.');
      return;
    }
    setIsSubmitting(true);
    try {
      const cleanEmail = regEmail.trim();
      const cleanPassword = regPassword.trim();
      await authService.register({
        email: cleanEmail,
        password: cleanPassword,
        fullName: cleanName,
        phone: cleanPhone,
          birthYear: Number(regDateOfBirth.slice(0, 4)),
          username: cleanUsername,
          identityNumber: cleanIdentityNumber,
          preferredCinemaId: regFavoriteCinemaId ? Number(regFavoriteCinemaId) : null
      });

      setPendingRegistration({
        email: cleanEmail,
        password: cleanPassword,
        name: cleanName,
        avatar: selectedAvatar,
        genre: selectedGenre
      });
      setRegOtp('');
      setRegisterStep('verify');
      startEmailOtpTimer();
      playPing(660, 'sine', 0.2);
      showToast('success', `Hệ thống đã gửi mã xác thực đến ${cleanEmail}. Vui lòng nhập mã trong 10 phút.`);
    } catch (error) {
      showToast('error', error.message || 'Đăng ký thất bại. Vui lòng thử lại.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleVerifyRegistrationEmail = async (e) => {
    e.preventDefault();

    const email = pendingRegistration?.email || regEmail.trim();
    const password = pendingRegistration?.password || regPassword.trim();
    if (!email || !password) {
      showToast('error', 'Không tìm thấy thông tin đăng ký. Vui lòng đăng ký lại.');
      setRegisterStep('form');
      return;
    }
    if (!/^[0-9]{6}$/.test(regOtp.trim())) {
      showToast('error', 'Mã OTP phải gồm đúng 6 chữ số.');
      return;
    }

    setIsSubmitting(true);
    try {
      await authService.verifyEmail(email, regOtp.trim());

      const authData = await authService.login({
        email,
        password
      });
      const user = saveAuthSession(authData);
      const decoratedUser = {
        ...user,
        avatar: pendingRegistration?.avatar || selectedAvatar,
        genre: pendingRegistration?.genre || selectedGenre
      };

      const favoriteCinema = registrationCinemas.find(
        (cinema) => String(cinema.id) === String(regFavoriteCinemaId)
      );
      if (favoriteCinema) {
        localStorage.setItem('preferredCinema', JSON.stringify({
          id: favoriteCinema.id,
          name: favoriteCinema.name
        }));
      }

      completeLogin(decoratedUser);
      playPing(987.77, 'sine', 0.4);
      showToast('success', `Đăng ký ${pendingRegistration?.name || regName} thành công và đã xác minh email.`);
      setTimeout(() => {
        onClose();
        setRegisterStep('form');
        setRegOtp('');
        setPendingRegistration(null);
        setEmailOtpSecondsLeft(0);
        setEmailOtpExpiresAt(null);
      }, 1500);
    } catch (error) {
      showToast('error', error.message || 'Xác minh email thất bại. Vui lòng kiểm tra OTP hoặc gửi lại mã.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRequestNewVerificationOtp = async () => {
    const email = pendingRegistration?.email || regEmail.trim();
    if (!email) {
      showToast('error', 'Vui lòng nhập email trước khi gửi lại OTP.');
      return;
    }

    setIsSubmitting(true);
    try {
      await authService.requestEmailVerification(email);
      setRegOtp('');
      startEmailOtpTimer();
      playPing(660, 'triangle', 0.12);
      showToast('success', `Hệ thống đã gửi lại mã xác thực đến ${email}. Mã mới có hiệu lực trong 10 phút.`);
    } catch (error) {
      showToast('error', error.message || 'Không thể gửi lại OTP xác minh email.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleGoogleSignIn = async () => {
    if (!googleClientId || googleClientId.includes('YOUR_GOOGLE_WEB_CLIENT_ID')) {
      showToast('error', 'Thiếu VITE_GOOGLE_CLIENT_ID. Vui lòng cấu hình Google Client ID cho FE.');
      return;
    }
    if (!isCurrentOriginConfigured) {
      showToast('error', `Google Sign-In chưa được cấu hình cho origin này. ${googleSetupHelp}`);
      return;
    }

    playPing(600, 'triangle', 0.1);
    setGoogleButtonError('');
    try {
      const rendered = await renderGoogleSignInButton();
      if (!rendered) {
        showToast('error', 'Google Sign-In chưa sẵn sàng. Vui lòng thử lại.');
        return;
      }
      showToast('success', 'Nút Google đã sẵn sàng. Vui lòng bấm lại nút Google để tiếp tục.');
    } catch (error) {
      resetGoogleButton();
      showToast('error', error.message || 'Không thể khởi tạo Google Sign-In.');
    }
  };

  const handleForgotPassword = () => {
    playPing(400, 'sine', 0.1);
    // Switch to dedicated tab for Forgot Password
    setActiveTab('forgot_password');
    setForgotStep(1);
    setForgotEmail(loginEmail);
    setForgotOtp('');
    setForgotNewPass('');
    setForgotConfirmPass('');
    setGeneratedForgotOtp('');
  };

  const handleSendForgotOTP = async (e) => {
    e.preventDefault();
    if (!forgotEmail) {
      showToast('error', 'Vui lòng cung cấp địa chỉ Email.');
      return;
    }
    const cleanEmail = forgotEmail.trim();
    setIsSubmitting(true);
    playPing(440, 'triangle', 0.1);
    try {
      const tokenData = await authService.requestPasswordReset(cleanEmail);
      setGeneratedForgotOtp(tokenData?.token || '');
      setForgotEmail(cleanEmail);
      setForgotOtp('');
      setForgotNewPass('');
      setForgotConfirmPass('');
      setForgotStep(2);
      showToast('success', 'Đã gửi mã OTP đặt lại mật khẩu. Vui lòng kiểm tra email và nhập mã OTP.');
    } catch (error) {
      showToast('error', error.message || 'Không thể gửi mã OTP đặt lại mật khẩu.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleVerifyForgotOtp = async (e) => {
    e.preventDefault();
    if (!/^[0-9]{6}$/.test(forgotOtp.trim())) {
      showToast('error', 'Mã OTP phải gồm đúng 6 chữ số.');
      return;
    }

    setIsSubmitting(true);
    try {
      await authService.verifyPasswordResetOtp({
        email: forgotEmail.trim(),
        otp: forgotOtp.trim()
      });
      setForgotNewPass('');
      setForgotConfirmPass('');
      setForgotStep(3);
      playPing(660, 'sine', 0.18);
      showToast('success', 'OTP hợp lệ. Vui lòng thiết lập mật khẩu mới.');
    } catch (error) {
      showToast('error', error.message || 'OTP không hợp lệ hoặc đã hết hạn.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpdatePassword = async (e) => {
    e.preventDefault();
    if (!/^[0-9]{6}$/.test(forgotOtp.trim())) {
      showToast('error', 'Mã OTP phải gồm đúng 6 chữ số.');
      return;
    }
    if (!isStrongPassword(forgotNewPass)) {
      showToast('error', PASSWORD_VALIDATION_MESSAGE);
      return;
    }

    if (forgotNewPass !== forgotConfirmPass) {
      showToast('error', 'Mật khẩu mới không khớp.');
      return;
    }

    setIsSubmitting(true);
    try {
      await authService.confirmPasswordReset({
        email: forgotEmail.trim(),
        otp: forgotOtp.trim(),
        newPassword: forgotNewPass.trim(),
        confirmPassword: forgotConfirmPass.trim()
      });
      playPing(880, 'sine', 0.45);
      showToast('success', 'Đặt lại mật khẩu thành công. Hãy đăng nhập bằng mật khẩu mới.');

      setActiveTab('login');
      setForgotEmail('');
      setForgotOtp('');
      setForgotNewPass('');
      setForgotConfirmPass('');
      setGeneratedForgotOtp('');
      setForgotStep(1);
    } catch (error) {
      showToast('error', error.message || 'Không thể đặt lại mật khẩu.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-start justify-center overflow-y-auto bg-black/95 px-4 py-0 md:px-6 select-none">

      {/* Animated Glowing Ambient Spotlight in Background */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-20%] left-[-10%] w-[60%] h-[50%] rounded-full bg-indigo-900/10 blur-[120px] animate-pulse"></div>
        <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[60%] rounded-full bg-amber-500/5 blur-[120px]"></div>
      </div>

      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 15 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 15 }}
        transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
        className="w-full max-w-lg border border-neutral-800 bg-gradient-to-b from-[#0e0e0e] to-[#040404] text-white overflow-hidden relative shadow-[0_0_50px_rgba(0,0,0,0.8)] rounded-none"
        id="premium-auth-container"
      >

        {/* Header Indicator */}
        <div className="h-1 bg-gradient-to-r from-neutral-800 via-amber-400 to-neutral-800"></div>

        {/* Modal close & Brand */}
        <div className="p-6 md:px-8 pt-6 flex items-center justify-between border-b border-white/5 relative z-10">
          <div className="flex items-center space-x-2.5">
            <span className="h-6.5 w-6.5 flex items-center justify-center border border-amber-500/40 bg-amber-950/10 text-amber-400 font-serif italic text-xs font-black">
              C
            </span>
            <div>
              <h3 className="text-xs font-sans font-black tracking-[0.25em] text-neutral-400 uppercase">
                CINEPREMIER
              </h3>
            </div>
          </div>

          <button
            onClick={() => {
              playPing(300, 'sine', 0.08);
              onClose();
            }}
            className="p-1 px-2 border border-neutral-850 hover:border-white text-neutral-400 hover:text-white transition duration-200 text-xs sm:text-sm font-light uppercase flex items-center gap-1 bg-neutral-900/50"
            title="Đóng trang"
          >
            <X className="h-3.5 w-3.5" /> 
          </button>
        </div>

        {/* Toast Notification Container inside Modal */}
        <AnimatePresence>
          {notification && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className={`mx-6 mt-4 p-3.5 flex items-start gap-2.5 text-xs border ${notification.type === 'success'
                ? 'bg-emerald-950/30 border-emerald-500/40 text-emerald-400'
                : 'bg-rose-950/20 border-rose-500/40 text-rose-300'
                } shadow-lg relative z-20`}
            >
              {notification.type === 'success' ? (
                <Check className="h-4.5 w-4.5 shrink-0 text-emerald-400" />
              ) : (
                <AlertCircle className="h-4.5 w-4.5 shrink-0 text-rose-400" />
              )}
              <span className="font-semibold">{notification.text}</span>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Dynamic Tabs Toggle: Đăng Nhập vs Đăng Ký hoặc Khôi phục Mật khẩu */}
        <div className="px-6 md:px-8 pt-5 text-center">
          {activeTab === 'forgot_password' ? (
            <div className="flex items-center justify-between bg-[#0d0905] border border-amber-500/20 p-2 text-left">
              <div className="text-[11px] text-zinc-300 font-extrabold uppercase tracking-widest pl-2 flex items-center gap-1 bg-amber-950/10 px-2 py-1 border border-amber-500/10">
                🔒 KHÔI PHỤC MẬT KHẨU VIP
              </div>
              <button
                type="button"
                onClick={() => {
                  playPing(300, 'sine', 0.1);
                  setActiveTab('login');
                  setForgotStep(1);
                }}
                className="p-1.5 px-3 border border-amber-500/20 hover:border-amber-400 bg-black text-amber-400 hover:text-white transition duration-200 text-[10.5px] font-bold uppercase flex items-center gap-1 cursor-pointer"
              >
                ← Quay Lại Đăng Nhập
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-2 bg-[#090909] border border-neutral-900 p-1 rounded-none">
              <button
                onClick={() => {
                  playPing(350, 'sine', 0.1);
                  setActiveTab('login');
                }}
                className={`py-2.5 text-xs font-sans font-bold uppercase tracking-[0.15em] transition duration-300 relative ${activeTab === 'login'
                  ? 'text-white'
                  : 'text-neutral-400 hover:text-neutral-200'
                  }`}
              >
                Đăng Nhập
                {activeTab === 'login' && (
                  <motion.div layoutId="activeAuthTab" className="absolute bottom-0 left-0 right-0 h-0.5 bg-amber-400" />
                )}
              </button>
              <button
                onClick={() => {
                  playPing(380, 'sine', 0.1);
                  setActiveTab('register');
                }}
                className={`py-2.5 text-xs font-sans font-bold uppercase tracking-[0.15em] transition duration-300 relative ${activeTab === 'register'
                  ? 'text-white'
                  : 'text-neutral-400 hover:text-neutral-200'
                  }`}
              >
                ĐĂNG KÝ
                {activeTab === 'register' && (
                  <motion.div layoutId="activeAuthTab" className="absolute bottom-0 left-0 right-0 h-0.5 bg-amber-400" />
                )}
              </button>
            </div>
          )}
        </div>

        {/* Tab content screens */}
        <div className="p-6 md:p-8 space-y-5">
          <AnimatePresence mode="wait">
            {activeTab === 'login' ? (

              /***************** LOGIN VIEW *****************/
              <motion.div
                key="login-view"
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 10 }}
                transition={{ duration: 0.25 }}
                className="space-y-4"
              >
                {/* Embedded Login Method Switch: OTP vs Password */}
                <div className="hidden">
                  <span className="text-neutral-400 uppercase tracking-widest font-mono">Phương thức kiểm định:</span>
                  <div className="flex gap-4">
                    <button
                      type="button"
                      onClick={() => { playPing(400, 'sine', 0.05); setLoginMethod('otp'); }}
                      className={`font-extrabold uppercase tracking-wider ${loginMethod === 'otp' ? 'text-amber-400 border-b border-amber-400 pb-0.5' : 'text-neutral-400 hover:text-neutral-200'}`}
                    >
                      Mã OTP Di Động
                    </button>
                    <button
                      type="button"
                      onClick={() => { playPing(400, 'sine', 0.05); setLoginMethod('password'); }}
                      className={`font-extrabold uppercase tracking-wider ${loginMethod === 'password' ? 'text-amber-400 border-b border-amber-400 pb-0.5' : 'text-neutral-400 hover:text-neutral-200'}`}
                    >
                      Mật khẩu VIP
                    </button>
                  </div>
                </div>

                {loginMethod === 'otp' ? (
                  // OTP AUTH MODE
                  <div className="space-y-4">
                    {!otpSent ? (
                      <form onSubmit={handleSendOTP} className="space-y-4.5">
                        <p className="text-xs text-neutral-400 font-light leading-relaxed">
                          Nhập số điện thoại di động đăng ký thành viên. Hệ thống tự động kích hoạt vé điện tử rạp phim và áp dụng ưu đãi giảm <span className="text-amber-400 font-black">30% Combo Bắp nước Thượng hạng</span>.
                        </p>

                        <div className="space-y-1.5 focus-within:text-white">
                          <label className="block text-[10px] font-sans font-black uppercase tracking-[0.18em] text-neutral-300">
                            Số Điện Thoại VIP
                          </label>
                          <div className="relative">
                            <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-neutral-600 font-mono text-xs">+84</span>
                            <input
                              type="tel"
                              required
                              placeholder="09xx xxx xxx..."
                              value={phoneNumber}
                              onChange={(e) => setPhoneNumber(e.target.value)}
                              className="w-full border border-neutral-800 focus:border-amber-400/70 bg-neutral-950 py-3 pl-14 pr-4 text-xs font-mono font-bold tracking-widest text-white focus:outline-none transition-all placeholder-neutral-600"
                            />
                          </div>
                        </div>

                        <button
                          type="submit"
                          disabled={isSubmitting}
                          className="w-full bg-white hover:bg-neutral-200 text-black border border-white hover:border-neutral-200 font-sans font-black text-xs uppercase tracking-[0.2em] py-4 transition duration-300 cursor-pointer flex items-center justify-center gap-2"
                        >
                          {isSubmitting ? (
                            <span className="h-4 w-4 border-2 border-black border-t-transparent animate-spin rounded-full inline-block"></span>
                          ) : (
                            <>GỬI KHÓA KHÁCH SẠN OTP <ArrowRight className="h-3.5 w-3.5" /></>
                          )}
                        </button>
                      </form>
                    ) : (
                      <form onSubmit={handleVerifyOTP} className="space-y-4">
                        <div className="bg-[#0c0a05] border border-amber-500/20 p-4 text-xs space-y-1 text-amber-300">
                          <p className="font-bold">✓ Đã phát tín hiệu OTP đến số {phoneNumber}</p>
                          <p className="opacity-80">Quý khách vui lòng nhập mã <span className="font-mono font-extrabold underline text-amber-400 bg-amber-500/10 px-1 py-0.5">123456</span> để đi tiếp.</p>
                        </div>

                        <div className="space-y-1.5 focus-within:text-amber-400">
                          <label className="block text-[10px] font-sans font-black uppercase tracking-[0.18em] text-neutral-300">
                            Nhập 6 số bảo an
                          </label>
                          <input
                            type="text"
                            required
                            maxLength={6}
                            placeholder="● ● ● ● ● ●"
                            value={localOtp}
                            onChange={(e) => setLocalOtp(e.target.value)}
                            className="w-full border border-neutral-800 focus:border-amber-400 bg-neutral-950 py-3.5 text-center text-sm font-mono font-black tracking-[0.8em] text-white focus:outline-none transition-all placeholder-neutral-600"
                          />
                        </div>

                        <div className="flex gap-3 pt-1">
                          <button
                            type="button"
                            onClick={() => { playPing(300, 'sine', 0.1); setOtpSent(false); }}
                            className="w-1/3 border border-neutral-800 bg-[#060606] text-neutral-400 text-[10px] uppercase font-sans tracking-widest py-3.5 hover:text-white transition"
                          >
                            Quay Lại
                          </button>
                          <button
                            type="submit"
                            disabled={isSubmitting}
                            className="flex-1 bg-amber-500 text-black hover:bg-amber-400 font-sans font-black text-xs uppercase tracking-[0.2em] py-3.5 transition flex items-center justify-center gap-1"
                          >
                            {isSubmitting ? (
                              <span className="h-4 w-4 border-2 border-black border-t-transparent animate-spin rounded-full inline-block"></span>
                            ) : (
                              'PHÊ DUYỆT ĐĂNG NHẬP'
                            )}
                          </button>
                        </div>
                      </form>
                    )}
                  </div>
                ) : (
                  // STANDARD ID / PASS AUTH MODE
                  <form onSubmit={handlePasswordLogin} className="space-y-4.5">
                    <p className="text-xs text-neutral-400 font-light leading-relaxed">
                      Sử dụng tài khoản thành viên VIP hoặc quản trị để truy cập các dịch vụ rạp chiếu phim đặc quyền.
                    </p>

                    <div className="space-y-1.5 focus-within:text-white">
                      <label className="block text-[10px] font-sans font-black uppercase tracking-[0.18em] text-neutral-300">
                        Địa Chỉ Email
                      </label>
                      <div className="relative">
                        <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-neutral-600" />
                        <input
                          type="text"
                          required
                          placeholder="Nhập email của bạn..."
                          value={loginEmail}
                          onChange={(e) => setLoginEmail(e.target.value)}
                          className="w-full border border-neutral-800 focus:border-amber-400/70 bg-neutral-950 py-3 pl-10 pr-4 text-xs font-sans text-white focus:outline-none transition-all placeholder-neutral-600"
                        />
                      </div>
                    </div>

                    <div className="space-y-1.5 focus-within:text-white">
                      <label className="block text-[10px] font-sans font-black uppercase tracking-[0.18em] text-neutral-300">
                        Mật Khẩu Bảo Mật
                      </label>
                      <div className="relative">
                        <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-neutral-600" />
                        <input
                          type={showPassword ? "text" : "password"}
                          required
                          placeholder="••••••••••••"
                          value={loginPass}
                          onChange={(e) => setLoginPass(e.target.value)}
                          className="w-full border border-neutral-800 focus:border-amber-400/70 bg-neutral-950 py-3 pl-10 pr-10 text-xs text-white tracking-widest focus:outline-none transition-all placeholder-neutral-600"
                        />
                        <button
                          type="button"
                          onClick={() => { playPing(400, 'sine', 0.05); setShowPassword(!showPassword); }}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-500 hover:text-white p-1"
                        >
                          {showPassword ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                        </button>
                      </div>
                    </div>

                    <button
                      type="submit"
                      disabled={isSubmitting}
                      className="w-full bg-white hover:bg-neutral-200 text-black border border-white font-sans font-black text-xs uppercase tracking-[0.2em] py-4 transition flex items-center justify-center gap-2"
                    >
                      {isSubmitting ? (
                        <span className="h-4 w-4 border-2 border-black border-t-transparent animate-spin rounded-full inline-block"></span>
                      ) : (
                        <>ĐĂNG NHẬP<ArrowRight className="h-3.5 w-3.5" /></>
                      )}
                    </button>
                  </form>
                )}

                {/* Secure Google and Direct Action Section */}
                <div className="space-y-4 pt-1">

                  {/* Divider line */}
                  <div className="flex items-center">
                    <div className="flex-1 h-px bg-neutral-900"></div>
                    <span className="px-3 text-[10px] font-mono uppercase text-neutral-400 tracking-[0.2em] font-extrabold">HOẶC</span>
                    <div className="flex-1 h-px bg-neutral-900"></div>
                  </div>

                  {/* Google Authenticator — house-styled visual layer, real GIS button overlaid invisibly on top */}
                  <div className="google-signin-shell group relative h-[52px] w-full overflow-hidden border border-white/15 bg-black transition-colors duration-300 hover:border-white/50 hover:bg-white/5">
                    {!googleButtonError && (
                      <span
                        aria-hidden="true"
                        className="pointer-events-none absolute inset-0 flex items-center justify-center gap-3 px-4 text-xs font-sans font-black uppercase tracking-[0.2em] text-white"
                      >
                        <svg className="h-4 w-4 shrink-0" viewBox="0 0 48 48" aria-hidden="true">
                          <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
                          <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
                          <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
                          <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
                        </svg>
                        Đăng Nhập Bằng Google
                      </span>
                    )}
                    <div
                      ref={bindGoogleButtonHost}
                      className="google-signin-button absolute inset-0 h-[52px] w-full overflow-hidden opacity-0 [&>div]:flex [&>div]:w-full [&>div]:justify-center [&_iframe]:mx-auto [&_iframe]:w-full [&_iframe]:max-w-full"
                      aria-live="polite"
                    />
                    {!googleButtonReady && !googleButtonError && (
                      <button
                        type="button"
                        onClick={handleGoogleSignIn}
                        disabled={isSubmitting}
                        aria-label="Đăng nhập bằng Google"
                        className="google-signin-fallback absolute inset-0 h-[52px] w-full cursor-pointer bg-transparent disabled:cursor-not-allowed"
                      />
                    )}
                    {googleButtonError && (
                      <button
                        type="button"
                        onClick={handleGoogleSignIn}
                        className="relative flex min-h-[52px] w-full items-center justify-center gap-2 bg-black px-4 py-3 text-center text-[11px] font-sans font-bold uppercase tracking-[0.12em] text-red-400"
                      >
                        <AlertCircle className="h-4 w-4 shrink-0" />
                        {googleButtonError}
                      </button>
                    )}
                  </div>

                  {/* Redirection Links for Registrations and Password retrieval */}
                  <div className="flex items-center justify-between text-[11px] font-sans text-neutral-400 px-1 pt-1">
                    <button
                      type="button"
                      onClick={() => {
                        playPing(440, 'sine', 0.08);
                        setActiveTab('register');
                      }}
                      className="hover:text-amber-400 group flex items-center gap-1 transition-all duration-300 cursor-pointer text-left bg-transparent border-none p-0"
                    >
                      <span className="text-neutral-400">Chưa có tài khoản?</span>
                      <span className="font-extrabold text-neutral-200 group-hover:text-amber-400 underline decoration-amber-400/30 underline-offset-4 decoration-1">
                        Đăng Ký Ngay
                      </span>
                    </button>

                    <button
                      type="button"
                      onClick={handleForgotPassword}
                      className="hover:text-neutral-200 text-neutral-400 hover:underline underline-offset-4 transition cursor-pointer font-semibold bg-transparent border-none p-0"
                    >
                      Quên mật khẩu?
                    </button>
                  </div>

                </div>

              </motion.div>
            ) : activeTab === 'register' ? (

              /***************** JOIN/REGISTER VIEW *****************/
              <motion.div
                key="register-view"
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                transition={{ duration: 0.25 }}
                className="space-y-4"
              >
                {registerStep === 'verify' ? (
                  <form onSubmit={handleVerifyRegistrationEmail} className="space-y-4">
                    <div className="border border-amber-500/30 bg-amber-500/10 p-4 text-xs text-amber-100 space-y-2">
                      <div className="flex items-center gap-2 text-amber-300 font-black uppercase tracking-[0.16em]">
                        <ShieldCheck className="h-4 w-4" />
                        Xác thực email
                      </div>
                      <p className="leading-relaxed text-neutral-200">
                        Hệ thống đã gửi OTP đến  <b>{pendingRegistration?.email || regEmail}</b>.



                      </p>
                      <p className="font-mono text-[11px] text-amber-300">
                        {emailOtpSecondsLeft > 0
                          ? `OTP hết hạn sau ${Math.floor(emailOtpSecondsLeft / 60)}:${String(emailOtpSecondsLeft % 60).padStart(2, '0')}`
                          : 'OTP đã hết hạn. Hay gửi lại mã mới.'}
                      </p>
                    </div>

                    <div className="space-y-1.5">
                      <label className="block text-[10px] font-sans font-black uppercase tracking-[0.18em] text-neutral-300">
                        Mã OTP Email
                      </label>
                      <div className="relative">
                        <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-neutral-600" />
                        <input
                          type="text"
                          inputMode="numeric"
                          maxLength={6}
                          required
                          placeholder="Nhập mã OTP"
                          value={regOtp}
                          onChange={(e) => setRegOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                          className="w-full border border-neutral-800 focus:border-amber-400 bg-neutral-950 py-3 pl-9 pr-3 text-sm font-mono tracking-[0.4em] text-white focus:outline-none transition-all placeholder-neutral-600"
                        />
                      </div>
                    </div>

                    <button
                      type="submit"
                      disabled={isSubmitting}
                      className="w-full bg-amber-400 text-black border border-amber-400 font-sans font-black text-xs uppercase tracking-[0.2em] py-4 transition duration-300 flex items-center justify-center gap-2 cursor-pointer shadow-[0_4px_20px_rgba(245,158,11,0.2)]"
                    >
                      {isSubmitting ? (
                        <span className="h-4 w-4 border-2 border-black border-t-transparent animate-spin rounded-full inline-block"></span>
                      ) : (
                        <>XÁC THỰC EMAIL <Check className="h-4 w-4" /></>
                      )}
                    </button>

                    <div className="flex gap-3">
                      <button
                        type="button"
                        disabled={isSubmitting}
                        onClick={() => {
                          setRegisterStep('form');
                          setRegOtp('');
                        }}
                        className="w-1/3 border border-neutral-800 bg-[#060606] text-neutral-400 text-[10px] uppercase font-sans font-black tracking-[0.18em] py-3.5 hover:text-white transition cursor-pointer"
                      >
                        Quay lại
                      </button>
                      <button
                        type="button"
                        disabled={isSubmitting || emailOtpSecondsLeft > 0}
                        onClick={handleRequestNewVerificationOtp}
                        className="flex-1 border border-amber-500/40 bg-amber-500/10 text-amber-300 disabled:border-neutral-800 disabled:bg-neutral-950 disabled:text-neutral-600 text-[10px] uppercase font-sans font-black tracking-widest py-3.5 transition cursor-pointer"
                      >
                        Gửi lại mã OTP
                      </button>
                    </div>
                  </form>
                ) : (
                  <form onSubmit={handleRegister} className="space-y-4">


                    <div className="grid grid-cols-1 gap-3.5 md:grid-cols-2">
                      <div className="space-y-1">
                        <label htmlFor="register-full-name" className="block text-[10px] font-sans font-black uppercase tracking-[0.18em] text-neutral-300">Họ và tên <span className="text-amber-400">*</span></label>
                        <div className="relative">
                          <User className="absolute left-3 top-2.5 h-3.5 w-3.5 text-neutral-600" />
                          <input id="register-full-name" type="text" required maxLength={MAX_NAME_LENGTH} autoComplete="name" placeholder="Họ và tên" value={regName} onChange={(e) => setRegName(normalizeNameInput(e.target.value))} className="w-full border border-neutral-800 bg-neutral-950 py-2.5 pl-9 pr-3 text-xs text-white placeholder-neutral-600 transition-all focus:border-amber-400 focus:outline-none" />
                        </div>
                      </div>

                      <div className="space-y-1">
                        <label htmlFor="register-birth-date" className="block text-[10px] font-sans font-black uppercase tracking-[0.18em] text-neutral-300">Ngày sinh <span className="text-amber-400">*</span></label>
                        <input id="register-birth-date" type="date" required min="1900-01-01" max={new Date().toISOString().slice(0, 10)} autoComplete="bday" value={regDateOfBirth} onChange={(e) => setRegDateOfBirth(e.target.value)} className="w-full border border-neutral-800 bg-neutral-950 px-3 py-2.5 text-xs text-white [color-scheme:dark] transition-all focus:border-amber-400 focus:outline-none" />
                      </div>

                      <div className="space-y-1">
                        <label htmlFor="register-phone" className="block text-[10px] font-sans font-black uppercase tracking-[0.18em] text-neutral-300">Số điện thoại <span className="text-amber-400">*</span></label>
                        <div className="relative">
                          <Phone className="absolute left-3 top-2.5 h-3.5 w-3.5 text-neutral-600" />
                          <input id="register-phone" type="tel" required inputMode="numeric" pattern="(03|05|08|09)[0-9]{8}" maxLength={10} autoComplete="tel" placeholder="Số điện thoại" value={regPhone} onChange={(e) => setRegPhone(normalizePhoneInput(e.target.value))} className="w-full border border-neutral-800 bg-neutral-950 py-2.5 pl-9 pr-3 text-xs font-mono tracking-wide text-white placeholder-neutral-600 transition-all focus:border-amber-400 focus:outline-none" />
                        </div>
                      </div>

                      <div className="space-y-1">
                        <label htmlFor="register-username" className="block text-[10px] font-sans font-black uppercase tracking-[0.18em] text-neutral-300">Tên đăng nhập <span className="text-amber-400">*</span></label>
                        <div className="relative">
                          <User className="absolute left-3 top-2.5 h-3.5 w-3.5 text-neutral-600" />
                          <input id="register-username" type="text" required autoComplete="username" placeholder="Tên đăng nhập" value={regUsername} onChange={(e) => setRegUsername(e.target.value)} className="w-full border border-neutral-800 bg-neutral-950 py-2.5 pl-9 pr-3 text-xs text-white placeholder-neutral-600 transition-all focus:border-amber-400 focus:outline-none" />
                        </div>
                      </div>

                      <div className="space-y-1">
                        <label htmlFor="register-identity" className="block text-[10px] font-sans font-black uppercase tracking-[0.18em] text-neutral-300">CCCD/CMND <span className="text-amber-400">*</span></label>
                        <div className="relative">
                          <ShieldCheck className="absolute left-3 top-2.5 h-3.5 w-3.5 text-neutral-600" />
                          <input id="register-identity" type="text" required inputMode="numeric" pattern="[0-9]{9}|[0-9]{12}" maxLength={12} placeholder="Số CCCD/CMND" value={regIdentityNumber} onChange={(e) => setRegIdentityNumber(e.target.value.replace(/\D/g, '').slice(0, 12))} className="w-full border border-neutral-800 bg-neutral-950 py-2.5 pl-9 pr-3 text-xs font-mono tracking-wide text-white placeholder-neutral-600 transition-all focus:border-amber-400 focus:outline-none" />
                        </div>
                      </div>

                      <div className="space-y-1">
                        <label htmlFor="register-email" className="block text-[10px] font-sans font-black uppercase tracking-[0.18em] text-neutral-300">Email <span className="text-amber-400">*</span></label>
                        <div className="relative">
                          <Mail className="absolute left-3 top-2.5 h-3.5 w-3.5 text-neutral-600" />
                          <input id="register-email" type="email" required autoComplete="email" placeholder="Điền email" value={regEmail} onChange={(e) => setRegEmail(e.target.value)} className="w-full border border-neutral-800 bg-neutral-950 py-2.5 pl-9 pr-3 text-xs text-white placeholder-neutral-600 transition-all focus:border-amber-400 focus:outline-none" />
                        </div>
                      </div>

                      <div className="space-y-1 md:col-span-2">
                        <label htmlFor="register-favorite-cinema" className="block text-[10px] font-sans font-black uppercase tracking-[0.18em] text-neutral-300">Rạp yêu thích</label>
                        <select id="register-favorite-cinema" value={regFavoriteCinemaId} onChange={(e) => setRegFavoriteCinemaId(e.target.value)} disabled={cinemaLoadError} className="w-full border border-neutral-800 bg-neutral-950 px-3 py-2.5 text-xs text-white transition-all focus:border-amber-400 focus:outline-none disabled:cursor-not-allowed disabled:text-neutral-500">
                          <option value="">{cinemaLoadError ? 'Không thể tải danh sách rạp' : 'Chọn rạp'}</option>
                          {registrationCinemas.map((cinema) => <option key={cinema.id} value={cinema.id}>{cinema.name}</option>)}
                        </select>
                        {cinemaLoadError && <p className="text-[9px] text-neutral-500">Bạn vẫn có thể đăng ký mà không chọn rạp yêu thích.</p>}
                      </div>

                      <div className="space-y-1">
                        <label htmlFor="register-password" className="block text-[10px] font-sans font-black uppercase tracking-[0.18em] text-neutral-300">Mật khẩu <span className="text-amber-400">*</span></label>
                        <div className="relative">
                          <Lock className="absolute left-3 top-2.5 h-3.5 w-3.5 text-neutral-600" />
                          <input id="register-password" type={showRegPassword ? 'text' : 'password'} required autoComplete="new-password" placeholder="Mật khẩu" value={regPassword} onChange={(e) => setRegPassword(e.target.value)} className="w-full border border-neutral-800 bg-neutral-950 py-2.5 pl-9 pr-10 text-xs text-white placeholder-neutral-600 transition-all focus:border-amber-400 focus:outline-none" />
                          <button type="button" onClick={() => { playPing(350, 'sine', 0.05); setShowRegPassword(!showRegPassword); }} className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-600 transition hover:text-white" aria-label={showRegPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}>{showRegPassword ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}</button>
                        </div>
                      </div>

                      <div className="space-y-1">
                        <label htmlFor="register-confirm-password" className="block text-[10px] font-sans font-black uppercase tracking-[0.18em] text-neutral-300">Xác thực mật khẩu <span className="text-amber-400">*</span></label>
                        <div className="relative">
                          <Lock className="absolute left-3 top-2.5 h-3.5 w-3.5 text-neutral-600" />
                          <input id="register-confirm-password" type={showRegPassword ? 'text' : 'password'} required autoComplete="new-password" placeholder="Xác thực mật khẩu" value={regConfirmPassword} onChange={(e) => setRegConfirmPassword(e.target.value)} className="w-full border border-neutral-800 bg-neutral-950 py-2.5 pl-9 pr-3 text-xs text-white placeholder-neutral-600 transition-all focus:border-amber-400 focus:outline-none" />
                        </div>
                      </div>
                    </div>

                    <div className="flex items-start gap-2 text-[10px] leading-relaxed text-neutral-400">
                      <input id="register-privacy-policy" type="checkbox" checked={agreeTerms} onChange={(e) => setAgreeTerms(e.target.checked)} className="mt-0.5 h-3.5 w-3.5 accent-amber-400" />
                      <div>
                        <label htmlFor="register-privacy-policy" className="cursor-pointer">Tôi đã đọc và đồng ý với </label>
                        <button type="button" onClick={() => setShowPrivacyPolicy((isVisible) => !isVisible)} aria-expanded={showPrivacyPolicy} aria-controls="register-privacy-policy-details" className="font-bold text-amber-400 underline underline-offset-2 hover:text-amber-300">Chính sách bảo mật</button>.
                      </div>
                    </div>

                    {showPrivacyPolicy && (
                      <section id="register-privacy-policy-details" aria-label="Nội dung Chính sách bảo mật" className="max-h-56 overflow-y-auto border border-amber-400/25 bg-amber-400/5 p-3 text-[10px] leading-relaxed text-neutral-300 custom-scrollbar">
                        <h4 className="mb-2 flex items-center gap-1.5 font-sans text-[10px] font-black uppercase tracking-[0.16em] text-amber-300">
                          <ShieldCheck className="h-3.5 w-3.5" /> Chính sách bảo mật
                        </h4>
                        <div className="space-y-2">
                          <p>CinePremier thu thập thông tin đăng ký cần thiết để tạo tài khoản, xác minh email, đặt vé và hỗ trợ khách hàng.</p>
                          <p>Thông tin cá nhân được bảo vệ trong hệ thống; chúng tôi không chia sẻ cho bên thứ ba, trừ trường hợp cần thiết để cung cấp dịch vụ hoặc theo yêu cầu pháp luật.</p>
                          <p>Bạn có trách nhiệm cung cấp thông tin chính xác, bảo vệ mật khẩu và mã OTP của mình. Người dùng dưới 16 tuổi cần có sự đồng ý của cha mẹ hoặc người giám hộ hợp pháp.</p>
                          <p>CinePremier có thể cập nhật chính sách theo thời gian; phiên bản mới sẽ được công bố trên hệ thống.</p>
                        </div>
                      </section>
                    )}

                    {/* Large Register Button */}
                    <button
                      type="submit"
                      disabled={isSubmitting}
                      className="w-full bg-amber-400 text-black border border-amber-400 font-sans font-black text-xs uppercase tracking-[0.2em] py-4 transition duration-300 flex items-center justify-center gap-2 cursor-pointer shadow-[0_4px_20px_rgba(245,158,11,0.2)]"
                    >
                      {isSubmitting ? (
                        <span className="h-4 w-4 border-2 border-black border-t-transparent animate-spin rounded-full inline-block"></span>
                      ) : (
                        <>ĐĂNG KÝ <ArrowRight className="h-4 w-4" /></>
                      )}
                    </button>

                  </form>
                )}
              </motion.div>
            ) : (

              /***************** FORGOT PASSWORD / RECOVERY VIEW *****************/
              <motion.div
                key="forgot-password-view"
                initial={{ opacity: 0, scale: 0.96 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.96 }}
                transition={{ duration: 0.25 }}
                className="space-y-4"
              >
                {/* Visual Step Indicator */}
                <div className="flex justify-between items-center bg-[#09090c] border border-neutral-900 p-3 text-[10.5px] font-mono mb-2">
                  <span className={forgotStep >= 1 ? "text-amber-400 font-extrabold" : "text-neutral-500"}>1. Nhập Email {forgotStep > 1 && '✓'}</span>
                  <span className="text-neutral-700">➔</span>
                  <span className={forgotStep >= 2 ? "text-amber-400 font-extrabold" : "text-neutral-500"}>2. Xác Nhận OTP</span>
                  <span className="text-neutral-700">➔</span>
                  <span className={forgotStep >= 3 ? "text-amber-400 font-extrabold" : "text-neutral-500"}>3. Mật Khẩu Mới</span>
                </div>

                <p className="text-xs text-neutral-300 font-light leading-relaxed">
                  {forgotStep === 1 && "Nhập địa chỉ Email VIP liên kết để bảo lưu tài khoản hội viên và gửi tín hiệu kích hoạt mã bảo an."}
                  {forgotStep === 2 && "Nhập mã OTP 6 chữ số được gửi đến email. Sau khi xác nhận OTP, bạn mới có thể thiết lập mật khẩu mới."}
                  {forgotStep === 3 && PASSWORD_VALIDATION_MESSAGE}
                </p>

                {forgotStep === 1 && (
                  <form onSubmit={handleSendForgotOTP} className="space-y-4">
                    <div className="space-y-1.5 focus-within:text-white">
                      <label className="block text-[10px] font-sans font-black uppercase tracking-[0.18em] text-neutral-300">
                        Email Đăng Ký Hội Viên
                      </label>
                      <div className="relative">
                        <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-neutral-600" />
                        <input
                          type="text"
                          required
                          placeholder="Nhập email của quý khách (Vd: kh@gmail.com)..."
                          value={forgotEmail}
                          onChange={(e) => setForgotEmail(e.target.value)}
                          className="w-full border border-neutral-800 focus:border-amber-400/70 bg-neutral-950 py-3 pl-10 pr-4 text-xs font-sans text-white focus:outline-none transition-all placeholder-neutral-600"
                        />
                      </div>
                    </div>

                    <button
                      type="submit"
                      disabled={isSubmitting}
                      className="w-full bg-amber-400 hover:bg-amber-300 text-black border border-amber-400 hover:border-amber-300 font-sans font-black text-xs uppercase tracking-[0.2em] py-4 transition flex items-center justify-center gap-2 cursor-pointer shadow-[0_4px_15px_rgba(245,158,11,0.15)] animate-pulse"
                    >
                      {isSubmitting ? (
                        <span className="h-4 w-4 border-2 border-black border-t-transparent animate-spin rounded-full inline-block"></span>
                      ) : (
                        <>GỬI MÃ OTP <ArrowRight className="h-3.5 w-3.5" /></>
                      )}
                    </button>
                  </form>
                )}

                {forgotStep === 2 && (
                  <form onSubmit={handleVerifyForgotOtp} className="space-y-4">
                    <div className="bg-[#0c0a05] border border-amber-500/20 p-4 text-xs space-y-1.5 text-amber-300 rounded mb-2">
                      <p className="font-bold text-amber-400">Đã gửi mã OTP đặt lại mật khẩu</p>
                      <p className="opacity-90">Nhập mã OTP 6 chữ số được gửi đến email của bạn.</p>
                      <div className="flex items-center gap-2 pt-1">
                        {/* {generatedForgotOtp && (
                          <span className="font-mono font-black text-amber-400 bg-amber-500/15 px-3 py-1.5 border border-amber-500/40 text-[10px] rounded break-all">
                            Mã OTP: {generatedForgotOtp}
                          </span>
                        )} */}
                      </div>
                    </div>

                    <div className="space-y-1.5 focus-within:text-amber-400">
                      <label className="block text-[10px] font-sans font-black uppercase tracking-[0.18em] text-neutral-300">
                        Nhập mã OTP
                      </label>
                      <input
                        type="text"
                        required
                        inputMode="numeric"
                        maxLength={6}
                        placeholder="Nhập mã OTP gồm 6 chữ số..."
                        value={forgotOtp}
                        onChange={(e) => setForgotOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                        className="w-full border border-neutral-800 focus:border-amber-500 bg-neutral-950 py-3 px-3 text-xs font-mono font-black text-white focus:outline-none transition-all placeholder-neutral-600"
                      />
                    </div>

                    <div className="flex gap-3 pt-2">
                      <button
                        type="button"
                        onClick={() => { playPing(300, 'sine', 0.1); setForgotStep(1); }}
                        className="w-1/3 border border-neutral-800 bg-[#060606] text-neutral-400 text-[10px] uppercase font-sans font-black tracking-[0.18em] py-3.5 hover:text-white transition cursor-pointer"
                      >
                        Quay Lại
                      </button>
                      <button
                        type="submit"
                        disabled={isSubmitting}
                        className="flex-1 bg-amber-500 text-black hover:bg-amber-400 font-sans font-black text-xs uppercase tracking-[0.2em] py-3.5 transition flex items-center justify-center gap-1 cursor-pointer"
                      >
                        {isSubmitting ? (
                          <span className="h-4 w-4 border-2 border-black border-t-transparent animate-spin rounded-full inline-block"></span>
                        ) : (
                          'TIẾP TỤC ĐẶT MẬT KHẨU'
                        )}
                      </button>
                    </div>
                  </form>
                )}

                {forgotStep === 3 && (
                  <form onSubmit={handleUpdatePassword} className="space-y-4">
                    <div className="space-y-1.5 focus-within:text-white">
                      <label className="block text-[10px] font-sans font-black uppercase tracking-[0.18em] text-neutral-300">
                        Thiết lập mật khẩu mới
                      </label>
                      <div className="relative">
                        <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-neutral-600" />
                        <input
                          type={showForgotConfirmPass ? "text" : "password"}
                          required
                          placeholder="Tối thiểu 8 ký tự, có chữ hoa, chữ thường, số và ký tự đặc biệt..."
                          value={forgotNewPass}
                          onChange={(e) => setForgotNewPass(e.target.value)}
                          className="w-full border border-neutral-800 focus:border-amber-400/70 bg-neutral-950 py-3 pl-10 pr-10 text-xs text-white focus:outline-none transition-all placeholder-neutral-600"
                        />
                        <button
                          type="button"
                          onClick={() => { playPing(400, 'sine', 0.05); setShowForgotConfirmPass(!showForgotConfirmPass); }}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-500 hover:text-white p-1"
                        >
                          {showForgotConfirmPass ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                        </button>
                      </div>
                    </div>

                    <div className="space-y-1.5 focus-within:text-white">
                      <label className="block text-[10px] font-sans font-black uppercase tracking-[0.18em] text-neutral-300">
                        Xác nhận mật khẩu mới
                      </label>
                      <div className="relative">
                        <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-neutral-600" />
                        <input
                          type={showForgotConfirmPass ? "text" : "password"}
                          required
                          placeholder="Nhập lại mật khẩu mới..."
                          value={forgotConfirmPass}
                          onChange={(e) => setForgotConfirmPass(e.target.value)}
                          className="w-full border border-neutral-800 focus:border-amber-400/70 bg-neutral-950 py-3 pl-10 pr-10 text-xs text-white focus:outline-none transition-all placeholder-neutral-600"
                        />
                      </div>
                    </div>

                    <div className="flex gap-3 pt-2">
                      <button
                        type="button"
                        onClick={() => { playPing(300, 'sine', 0.1); setForgotStep(2); }}
                        className="w-1/3 border border-neutral-800 bg-[#060606] text-neutral-400 text-[10px] uppercase font-sans font-black tracking-[0.18em] py-3.5 hover:text-white transition cursor-pointer"
                      >
                        Quay Lại OTP
                      </button>
                      <button
                        type="submit"
                        disabled={isSubmitting}
                        className="flex-1 bg-emerald-500 hover:bg-emerald-400 text-black border border-emerald-500 font-sans font-black text-xs uppercase tracking-[0.2em] py-3.5 transition flex items-center justify-center gap-2 cursor-pointer shadow-[0_4px_15px_rgba(16,185,129,0.2)]"
                      >
                        {isSubmitting ? (
                          <span className="h-4 w-4 border-2 border-black border-t-transparent animate-spin rounded-full inline-block"></span>
                        ) : (
                          <>XÁC NHẬN ĐẶT LẠI MẬT KHẨU <Check className="h-3.5 w-3.5" /></>
                        )}
                      </button>
                    </div>
                  </form>
                )}
                {/* Subtext info logs */}
                <div className="bg-[#050505] p-3 text-[10px] text-zinc-400 border border-white/10 font-sans leading-relaxed text-center">
                  🔐 <span className="text-zinc-300 font-extrabold uppercase">Bảo mật chuẩn AES:</span> Mật khẩu mới được bảo mật nguyên gốc bằng tài khoản bảo mật cục bộ.
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Dynamic Interactive Footer displaying membership privileges */}
        <div className="border-t border-neutral-900 bg-[#060606] p-4 text-[11px] text-zinc-400 flex items-center justify-between font-mono">
          <span className="uppercase tracking-wider flex items-center gap-1">
            <ShieldCheck className="h-3.5 w-3.5 text-amber-500" /> An Toàn
          </span>
          <span className="text-right uppercase tracking-[0.1em]">CinePremier Club </span>
        </div>

      </motion.div>

    </div>
  );
}
