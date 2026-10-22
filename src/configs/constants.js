export const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080').replace(/\/$/, '');
export const AI_SERVICE_BASE_URL = (import.meta.env.VITE_AI_SERVICE_URL || 'http://localhost:8032').replace(/\/$/, '');
export const AI_GATEWAY_SECRET = import.meta.env.VITE_AI_GATEWAY_SECRET || 'cinema-gateway-secret-key-change-in-production';

export const STORAGE_KEYS = {
  accessToken: 'cinepremier_access_token',
  accessTokenExpiresAt: 'cinepremier_access_token_expires_at',
  refreshToken: 'cinepremier_refresh_token',
  user: 'cinepremier_auth_user',
  roles: 'cinepremier_auth_roles'
};

export const ADMIN_ACCESS_OVERRIDE = false;
