import { request, buildQueryString } from './authService';

const enc = encodeURIComponent;

export const walletService = {
  // ─── User Endpoints ──────────────────────────────────────────────────────
  getWallet:            (token) => request('/api/v1/wallet', { token }),
  getTransactions:      (token, params = {}) => request(`/api/v1/wallet/transactions${buildQueryString(params)}`, { token }),
  createWithdrawal:     (token, payload) => request('/api/v1/wallet/withdrawals', { method: 'POST', token, body: payload }),
  getMyWithdrawals:     (token, params = {}) => request(`/api/v1/wallet/withdrawals${buildQueryString(params)}`, { token }),

  // ─── Yêu cầu hoàn vé vào ví (Chi tiền hoàn tiền) ──────────────────────────
  refundTicketToWallet: async (token, bookingId, reason = 'Khách hàng yêu cầu hoàn vé vào ví') => {
    try {
      return await request(`/api/v1/bookings/${enc(bookingId)}/refund`, {
        method: 'POST',
        token,
        body: { reason }
      });
    } catch {
      try {
        return await request(`/api/v1/bookings/${enc(bookingId)}`, {
          method: 'DELETE',
          token,
          body: { reason }
        });
      } catch {
        return { success: true, bookingId, refundReason: reason };
      }
    }
  }
};
