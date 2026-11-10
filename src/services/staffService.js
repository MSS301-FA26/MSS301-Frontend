import { request, unwrapListPayload } from './authService';

export const staffService = {
  lookupStaffCheckInBooking: (token, { bookingCode, qrCode }) => {
    const params = new URLSearchParams();
    if (bookingCode) params.set('bookingCode', bookingCode);
    if (qrCode) params.set('qrCode', qrCode);
    return request(`/api/v1/staff/check-in/lookup?${params.toString()}`, { token });
  },
  getRecentStaffCheckInBookings: (token, limit = 8) =>
    request(`/api/v1/staff/check-in/recent?limit=${encodeURIComponent(limit)}`, { token }),
  getStaffShowtimeBookings: (token, showtimeId) => request(`/api/v1/staff/check-in/showtimes/${encodeURIComponent(showtimeId)}/bookings`, { token }),
  checkInStaffBooking: (token, qrCode) => request('/api/v1/staff/check-in', {
    method: 'POST',
    token,
    body: { qrCode }
  }),
  checkInStaffSeats: (token, { bookingCode, ticketCodes }) => request('/api/v1/staff/check-in/seats', {
    method: 'POST',
    token,
    body: { bookingCode, ticketCodes }
  }),
  createStaffFoodOrder: (token, code, body) => request(`/api/v1/staff/check-in/food-orders?code=${encodeURIComponent(code)}`, {
    method: 'POST',
    token,
    body
  }),
  lookupFoodOrder: (token, code) => request(`/api/v1/staff/check-in/food-orders/lookup?code=${encodeURIComponent(code)}`, { token }),
  pickUpFoodOrder: (token, code, payload = {}) => request('/api/v1/staff/check-in/food-orders/pickup', {
    method: 'POST',
    token,
    body: { code: String(code), foodOrderCode: String(code), ...payload }
  }),
  getRecentFoodOrders: (token, limit = 50) =>
    request(`/api/v1/staff/check-in/food-orders/recent?limit=${encodeURIComponent(limit)}`, { token }),
  getStaffFoodItems: (token) => request('/api/v1/foods/all/items?size=100', { token })
    .catch(() => request('/api/v1/staff/foods/items?size=100', { token }))
    .then(unwrapListPayload),
  getStaffFoodCombos: (token) => request('/api/v1/foods/all/combos?size=100', { token })
    .catch(() => request('/api/v1/staff/foods/combos?size=100', { token }))
    .then(unwrapListPayload),
  updateStaffFoodItemStatus: (token, itemId, status) => request(`/api/v1/foods/items/${encodeURIComponent(itemId)}/status?status=${encodeURIComponent(status)}`, {
    method: 'PATCH',
    token,
    body: { status }
  }).catch(() => request(`/api/v1/staff/foods/items/${encodeURIComponent(itemId)}/status?status=${encodeURIComponent(status)}`, {
    method: 'PATCH',
    token,
    body: { status }
  })),
  updateStaffFoodComboStatus: (token, comboId, status) => request(`/api/v1/foods/combos/${encodeURIComponent(comboId)}/status?status=${encodeURIComponent(status)}`, {
    method: 'PATCH',
    token,
    body: { status }
  }).catch(() => request(`/api/v1/staff/foods/combos/${encodeURIComponent(comboId)}/status?status=${encodeURIComponent(status)}`, {
    method: 'PATCH',
    token,
    body: { status }
  })),
};
