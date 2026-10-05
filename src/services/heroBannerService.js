import apiClient from '../configs/axios';
import { buildQueryString, getStoredAuth, request } from './authService';
import { uploadFile } from './apiFactory';

const adminRequest = (path, options = {}) => request(path, {
  ...options,
  token: getStoredAuth().accessToken
});

export const heroBannerService = {
  // Public APIs
  async getPublicHeroBanners(cinemaId = null) {
    try {
      const params = cinemaId ? { cinemaId } : {};
      const res = await apiClient.get('/api/v1/hero-banners', { params });
      return res.data?.data || [];
    } catch (err) {
      console.warn('Could not fetch public hero banners, fallback will be used:', err.message);
      return [];
    }
  },

  async recordImpression(bannerId) {
    if (!bannerId) return;
    try {
      await apiClient.post(`/api/v1/hero-banners/${bannerId}/impression`);
    } catch {
      // Non-blocking analytics
    }
  },

  async recordClick(bannerId) {
    if (!bannerId) return;
    try {
      await apiClient.post(`/api/v1/hero-banners/${bannerId}/click`);
    } catch {
      // Non-blocking analytics
    }
  },

  // Admin APIs use the shared session refresh and API error handling.
  async getAdminHeroBanners(params = {}) {
    return await adminRequest(`/api/v1/admin/hero-banners${buildQueryString(params)}`)
      || { items: [], totalItems: 0, totalPages: 1 };
  },

  getAdminHeroBanner(id) {
    return adminRequest(`/api/v1/admin/hero-banners/${id}`);
  },

  async getSummaryStats() {
    return await adminRequest('/api/v1/admin/hero-banners/summary') || {};
  },

  async getHotMovieSuggestions(limit = 6) {
    return await adminRequest(`/api/v1/admin/hero-banners/hot-movie-suggestions${buildQueryString({ limit })}`) || [];
  },

  createHeroBanner(payload) {
    return adminRequest('/api/v1/admin/hero-banners', { method: 'POST', body: payload });
  },

  updateHeroBanner(id, payload) {
    return adminRequest(`/api/v1/admin/hero-banners/${id}`, { method: 'PUT', body: payload });
  },

  publishHeroBanner(id) {
    return adminRequest(`/api/v1/admin/hero-banners/${id}/publish`, { method: 'POST', body: {} });
  },

  pauseHeroBanner(id) {
    return adminRequest(`/api/v1/admin/hero-banners/${id}/pause`, { method: 'POST', body: {} });
  },

  resumeHeroBanner(id) {
    return adminRequest(`/api/v1/admin/hero-banners/${id}/resume`, { method: 'POST', body: {} });
  },

  archiveHeroBanner(id) {
    return adminRequest(`/api/v1/admin/hero-banners/${id}/archive`, { method: 'POST', body: {} });
  },

  duplicateHeroBanner(id) {
    return adminRequest(`/api/v1/admin/hero-banners/${id}/duplicate`, { method: 'POST', body: {} });
  },

  reorderHeroBanners(bannerIds) {
    return adminRequest('/api/v1/admin/hero-banners/reorder', { method: 'PUT', body: { bannerIds } });
  },

  deleteDraftBanner(id) {
    return adminRequest(`/api/v1/admin/hero-banners/${id}`, { method: 'DELETE' });
  },

  uploadBannerImage(file, folder = 'hero-banners') {
    return uploadFile(getStoredAuth().accessToken, file, folder, '/api/v1/admin/uploads/images');
  },

  // Slot Management APIs
  getSlotSettings() {
    return adminRequest('/api/v1/admin/hero-banners/slots/settings');
  },

  updateSlotSettings(settings) {
    return adminRequest('/api/v1/admin/hero-banners/slots/settings', { method: 'PUT', body: settings });
  },

  getHeroSlots(cinemaId = null) {
    const query = cinemaId ? `?cinemaId=${cinemaId}` : '';
    return adminRequest(`/api/v1/admin/hero-banners/slots${query}`);
  },

  pinAutoSlot(position, cinemaId = null) {
    const query = cinemaId ? `?cinemaId=${cinemaId}` : '';
    return adminRequest(`/api/v1/admin/hero-banners/slots/${position}/pin${query}`, { method: 'POST', body: {} });
  },

  unassignSlot(position) {
    return adminRequest(`/api/v1/admin/hero-banners/slots/${position}`, { method: 'DELETE' });
  },

  assignBannerToSlot(position, bannerId) {
    return adminRequest(`/api/v1/admin/hero-banners/slots/${position}/assign/${bannerId}`, { method: 'POST', body: {} });
  }
};
