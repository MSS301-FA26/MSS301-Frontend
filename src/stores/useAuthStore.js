import { create } from 'zustand';
import { authService, clearAuthSession, getStoredAuth, hasBackendAdminAccess, hasBackendManagerAccess, hasBackendStaffAccess, normalizeUser, saveAuthSession } from '../services/authService';
import { userService } from '../services/userService';

const resolveNextValue = (nextValue, previousValue) => (
  typeof nextValue === 'function' ? nextValue(previousValue) : nextValue
);

export const useAuthStore = create((set, get) => ({
  isLoggedIn: false,
  isAuthReady: false,
  currentUser: null,
  currentRole: 'user',

  setIsLoggedIn: (isLoggedIn) => set((state) => ({
    isLoggedIn: resolveNextValue(isLoggedIn, state.isLoggedIn)
  })),
  setIsAuthReady: (isAuthReady) => set((state) => ({
    isAuthReady: resolveNextValue(isAuthReady, state.isAuthReady)
  })),
  setCurrentUser: (currentUser) => set((state) => ({
    currentUser: resolveNextValue(currentUser, state.currentUser)
  })),
  setCurrentRole: (currentRole) => set((state) => ({
    currentRole: resolveNextValue(currentRole, state.currentRole) || 'user'
  })),

  setAuthSession: (user, role = user?.role || 'user') => set({
    isLoggedIn: Boolean(user),
    currentUser: user || null,
    currentRole: role || 'user'
  }),

  clearAuth: () => set({
    isLoggedIn: false,
    currentUser: null,
    currentRole: 'user'
  }),

  restoreSession: async () => {
    try {
      const { accessToken, accessTokenExpiresAt, refreshToken, user } = getStoredAuth();
      if (user) {
        const restoredRole = hasBackendAdminAccess(accessToken, user)
          ? 'admin'
          : hasBackendManagerAccess(accessToken, user)
            ? 'manager'
            : hasBackendStaffAccess(accessToken, user)
              ? 'staff'
              : user.role || 'user';
        get().setAuthSession({ ...user, role: restoredRole }, restoredRole);
      }
      if (!accessToken && !refreshToken) return;

      let token = accessToken;
      if (token && accessTokenExpiresAt && accessTokenExpiresAt <= Date.now() && refreshToken) {
        const refreshed = await authService.refresh(refreshToken);
        const refreshedUser = saveAuthSession(refreshed);
        token = refreshed.accessToken;
        get().setAuthSession(refreshedUser, refreshedUser.role || 'user');
      }

      if (!token && refreshToken) {
        const refreshed = await authService.refresh(refreshToken);
        const refreshedUser = saveAuthSession(refreshed);
        token = refreshed.accessToken;
        get().setAuthSession(refreshedUser, refreshedUser.role || 'user');
      }

      let profile;
      try {
        profile = await userService.getMyProfile(token);
      } catch {
        if (!refreshToken) throw new Error('Cannot refresh session without refresh token.');
        const refreshed = await authService.refresh(refreshToken);
        const refreshedUser = saveAuthSession(refreshed);
        token = refreshed.accessToken;
        get().setAuthSession(refreshedUser, refreshedUser.role || 'user');
        profile = await userService.getMyProfile(token);
      }

      const nextUser = normalizeUser(profile, profile.roles || user?.roles || [], token);
      localStorage.setItem('cinepremier_auth_user', JSON.stringify(nextUser));
      get().setAuthSession(nextUser, nextUser.role || 'user');
    } catch {
      clearAuthSession();
      get().clearAuth();
    } finally {
      get().setIsAuthReady(true);
    }
  },

  handleSessionExpired: ({ setShowOTP } = {}) => {
    clearAuthSession();
    get().clearAuth();
    get().setIsAuthReady(true);
    setShowOTP?.(true);
  },

  subscribeSessionExpired: ({ setShowOTP } = {}) => {
    const handleSessionExpired = () => get().handleSessionExpired({ setShowOTP });
    window.addEventListener('auth:session-expired', handleSessionExpired);
    return () => window.removeEventListener('auth:session-expired', handleSessionExpired);
  },

  performLogout: async ({ navigate, showToast } = {}) => {
    const state = get();
    const role = state.currentRole || state.currentUser?.role;
    const { refreshToken } = getStoredAuth();
    try {
      if (refreshToken) {
        await authService.logout(refreshToken);
      }
    } catch (error) {
      console.warn('Backend logout error:', error);
    } finally {
      clearAuthSession();
      get().clearAuth();
      get().setIsAuthReady(true);
      navigate?.('/');
      if (role === 'staff') {
        showToast?.('Đã kết thúc ca trực và đăng xuất khỏi hệ thống Staff.');
      } else {
        showToast?.('Đăng xuất tài khoản thành công.');
      }
    }
  },

  handleLogout: ({ navigate, showToast } = {}) => {
    const state = get();
    const role = state.currentRole || state.currentUser?.role;
    if (role === 'staff') {
      showToast?.(
        'Xác nhận kết thúc ca trực và đăng xuất khỏi tài khoản Nhân viên (Staff)?',
        10000,
        { label: 'Đăng xuất', onClick: () => get().performLogout({ navigate, showToast }) },
        'sad'
      );
      return;
    }
    showToast?.(
      'Bạn có chắc muốn đăng xuất không?\nCinePremier sẽ nhớ bạn lắm đó...',
      10000,
      { label: 'Đăng xuất', onClick: () => get().performLogout({ navigate, showToast }) },
      'sad'
    );
  },

  handleLoginSuccess: (userData, { navigate } = {}) => {
    get().setIsLoggedIn(true);
    get().setIsAuthReady(true);
    if (!userData) return;

    get().setAuthSession(userData, userData.role || 'user');
    const redirectPath = sessionStorage.getItem('cinepremier_post_login_redirect');
    sessionStorage.removeItem('cinepremier_post_login_redirect');
    if (userData.passwordChangeRequired) {
      navigate?.('/setup-password');
      return;
    }
    if (userData.role === 'admin' || userData.role === 'manager') {
      navigate?.('/admin/overview');
    } else if (userData.role === 'manager') {
      navigate?.('/admin/overview');
    } else if (userData.role === 'staff') {
      navigate?.('/staff');
    } else {
      navigate?.(redirectPath || '/');
    }
  }
}));
