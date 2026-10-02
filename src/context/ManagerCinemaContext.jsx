import React, { createContext, useContext, useState, useEffect, useMemo } from 'react';
import { getStoredAuth, request } from '../services/authService';
import { useAuthStore } from '../stores/useAuthStore';

const ManagerCinemaContext = createContext(null);

export function ManagerCinemaProvider({ children }) {
  const currentUser = useAuthStore((state) => state.currentUser);
  const [cinemas, setCinemas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Manager Cinema scope is strictly derived from currentUser.cinemaId (never from arbitrary localStorage)
  const assignedCinemaId = currentUser?.cinemaId ? String(currentUser.cinemaId) : '';

  const fetchCinemas = async () => {
    setLoading(true);
    setError('');
    try {
      const { accessToken } = getStoredAuth();
      let items = [];
      try {
        const data = await request('/api/v1/cinemas', { token: accessToken });
        items = Array.isArray(data) ? data : (data?.items || data?.content || []);
      } catch (e) {
        try {
          const data = await request('/api/v1/admin/cinemas', { token: accessToken });
          items = Array.isArray(data) ? data : (data?.items || data?.content || []);
        } catch (err2) {
          console.warn('Lỗi lấy danh sách rạp:', err2);
        }
      }
      setCinemas(items);
    } catch (err) {
      setError(err.message || 'Không thể tải thông tin cụm rạp.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCinemas();
  }, [assignedCinemaId]);

  const selectedCinema = useMemo(() => {
    if (!assignedCinemaId) return cinemas[0] || null;
    return cinemas.find((c) => String(c.id) === String(assignedCinemaId)) || {
      id: Number(assignedCinemaId),
      name: `Rạp #${assignedCinemaId}`,
      city: 'Chi nhánh được phân công'
    };
  }, [cinemas, assignedCinemaId]);

  return (
    <ManagerCinemaContext.Provider
      value={{
        cinemas,
        selectedCinemaId: assignedCinemaId,
        selectedCinema,
        loading,
        error,
        refreshCinemas: fetchCinemas
      }}
    >
      {children}
    </ManagerCinemaContext.Provider>
  );
}

export function useManagerCinema() {
  const ctx = useContext(ManagerCinemaContext);
  if (!ctx) {
    throw new Error('useManagerCinema must be used within a ManagerCinemaProvider');
  }
  return ctx;
}
