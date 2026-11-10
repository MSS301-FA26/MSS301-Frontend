import axios from 'axios';
import { API_BASE_URL, STORAGE_KEYS } from '../configs/constants';

export const aiApiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000,
  headers: {
    Accept: 'application/json',
    'Content-Type': 'application/json',
    'ngrok-skip-browser-warning': 'true'
  }
});

aiApiClient.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem(STORAGE_KEYS.accessToken);

    if (token && !config.headers.Authorization) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    return config;
  },
  (error) => Promise.reject(error)
);

/**
 * Universal request wrapper for CinemaAI Intelligent Services
 * Requests go through API Gateway.
 */
export const aiRequest = async (
  path,
  {
    method = 'GET',
    body,
    params,
    token,
    timeout
  } = {}
) => {
  const headers = {
    Accept: 'application/json',
    'Content-Type': 'application/json'
  };

  // Optional explicit token overrides the interceptor token
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  try {
    const response = await aiApiClient.request({
      url: path,
      method: String(method || 'GET').toUpperCase(),
      headers,
      params,
      data: body,
      ...(timeout ? { timeout } : {})
    });

    const payload = response.data;

    if (
      payload &&
      typeof payload === 'object' &&
      'data' in payload
    ) {
      return payload.data;
    }

    return payload;
  } catch (error) {
    const errorMsg =
      error?.response?.data?.message ||
      error?.response?.data?.detail ||
      error?.message ||
      'Lỗi kết nối dịch vụ AI';

    const err = new Error(errorMsg);
    err.status = error?.response?.status;
    err.response = error?.response;

    throw err;
  }
};