import { create } from 'zustand';

let toastTimerId = null;

const resolveNextValue = (nextValue, previousValue) => (
  typeof nextValue === 'function' ? nextValue(previousValue) : nextValue
);

const clearToastTimer = () => {
  if (toastTimerId) {
    window.clearInterval(toastTimerId);
    toastTimerId = null;
  }
};

const startToastTimer = (set, get) => {
  clearToastTimer();
  if (!get().toast) return;

  toastTimerId = window.setInterval(() => {
    set((state) => {
      if (!state.toast) return state;
      const nextRemaining = Math.max(state.toast.remainingMs - 250, 0);
      if (nextRemaining === 0) {
        clearToastTimer();
        return { toast: null };
      }
      return { toast: { ...state.toast, remainingMs: nextRemaining } };
    });
  }, 250);
};

export const useUiStore = create((set, get) => ({
  showOTP: false,
  authMode: 'login',
  showWatchlist: false,
  toast: null,
  adminSidebarCollapsed: false,
  toggleAdminSidebar: () => set((state) => ({ adminSidebarCollapsed: !state.adminSidebarCollapsed })),

  setShowOTP: (showOTP) => set((state) => ({
    showOTP: resolveNextValue(showOTP, state.showOTP)
  })),
  setAuthMode: (authMode) => set((state) => ({
    authMode: resolveNextValue(authMode, state.authMode) || 'login'
  })),
  setShowWatchlist: (showWatchlist) => set((state) => ({
    showWatchlist: resolveNextValue(showWatchlist, state.showWatchlist)
  })),
  setToast: (toast) => {
    set((state) => ({
      toast: resolveNextValue(toast, state.toast)
    }));
    if (get().toast) {
      startToastTimer(set, get);
    } else {
      clearToastTimer();
    }
  },
  showToast: (text, durationMs = 3000, action = null, tone = 'success') => {
    let nextDuration = durationMs;
    let nextAction = action;
    let nextTone = tone;

    if (typeof durationMs === 'string') {
      nextTone = durationMs;
      nextDuration = (nextTone === 'error' || nextTone === 'sad') ? 4000 : 3000;
      nextAction = null;
    }

    if (nextTone === 'error') nextTone = 'sad';

    if (!Number.isFinite(Number(nextDuration)) || Number(nextDuration) <= 0) {
      nextDuration = (nextTone === 'error' || nextTone === 'sad') ? 4000 : 3000;
    }

    // Strip leading checkmark/icon characters from text
    const cleanText = typeof text === 'string'
      ? text.replace(/^[✓✔✗xX!ℹ️\s]+/, '').trim()
      : text;

    set({
      toast: {
        id: Date.now(),
        text: cleanText,
        durationMs: Number(nextDuration),
        remainingMs: Number(nextDuration),
        action: nextAction,
        tone: nextTone
      }
    });
    startToastTimer(set, get);
  }
}));
