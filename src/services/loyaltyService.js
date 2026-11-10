import { request, buildQueryString } from './authService';

export const loyaltyService = {
  getMyLoyalty: (token) => request('/api/v1/loyalty/me', { token }),
  getConfiguration: (token, params = {}) => request(`/api/v1/loyalty/config${buildQueryString(params)}`, { token }),
  redeemMyPoints: (token, points) => request(`/api/v1/loyalty/me/redeem?points=${encodeURIComponent(points)}`, {
    method: 'POST',
    token
  })
};
