import axios from 'axios';
import { AI_SERVICE_BASE_URL, AI_GATEWAY_SECRET } from '../configs/constants';

export const aiApiClient = axios.create({
  baseURL: AI_SERVICE_BASE_URL,
  timeout: 30000,
  headers: {
    Accept: 'application/json',
    'Content-Type': 'application/json',
    'X-Gateway-Secret': AI_GATEWAY_SECRET,
    'ngrok-skip-browser-warning': 'true'
  }
});

// Request interceptor to attach dynamic headers if needed
aiApiClient.interceptors.request.use((config) => {
  if (!config.headers['X-Gateway-Secret']) {
    config.headers['X-Gateway-Secret'] = AI_GATEWAY_SECRET;
  }
  return config;
}, (error) => Promise.reject(error));

/**
 * Universal request wrapper for CinemaAI Intelligent Services (port 8032)
 */
export const aiRequest = async (path, { method = 'GET', body, params, token, timeout } = {}) => {
  const headers = {
    Accept: 'application/json',
    'Content-Type': 'application/json',
    'X-Gateway-Secret': AI_GATEWAY_SECRET
  };

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
    // Unwrap ApiResponse[T] envelope if present
    if (payload && typeof payload === 'object' && 'data' in payload) {
      return payload.data;
    }
    return payload;
  } catch (error) {
    const errorMsg = error?.response?.data?.message
      || error?.response?.data?.detail
      || error?.message
      || 'Lỗi kết nối dịch vụ AI';
    const err = new Error(errorMsg);
    err.status = error?.response?.status;
    err.response = error?.response;
    throw err;
  }
};
