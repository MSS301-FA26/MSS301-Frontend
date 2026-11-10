import { request } from './authService';

export const paymentService = {
  createVnpayPayment: (token, bookingId) => {
    const id = typeof bookingId === 'object' ? bookingId?.bookingId : bookingId;
    return request(`/api/v1/payments/vnpay/create?bookingId=${id}`, { method: 'POST', token });
  },
  createVnpayPaymentUrl: (token, params) => {
    const bookingId = typeof params === 'object' ? params?.bookingId : params;
    const foodOrderId = typeof params === 'object' ? params?.foodOrderId : null;
    const query = bookingId ? `bookingId=${bookingId}` : (foodOrderId ? `foodOrderId=${foodOrderId}` : '');
    return request(`/api/v1/payments/vnpay/create${query ? `?${query}` : ''}`, {
      method: 'POST',
      token,
      body: typeof params === 'object' ? params : { bookingId }
    });
  },
  mockPayment: (token, bookingId) => request(`/api/v1/payments/mock?bookingId=${bookingId}`, { method: 'POST', token }),
  getPaymentByBooking: (token, bookingId) => request(`/api/v1/payments/booking/${bookingId}`, { token }),
  createVnpayFoodOrderPayment: (token, foodOrderId) => request(`/api/v1/payments/food-orders/${foodOrderId}/vnpay/create`, { method: 'POST', token }),
  mockFoodOrderPayment: (token, foodOrderId) => request(`/api/v1/payments/food-orders/${foodOrderId}/mock`, { method: 'POST', token })
};
