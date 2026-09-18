import React, { createContext, useContext, useState, useEffect } from 'react';
import { getStoredAuth, request } from '../services/authService';

const ManagerCinemaContext = createContext(null);

export function ManagerCinemaProvider({ children }) {
  const [cinemas, setCinemas] = useState([]);
  const [selectedCinemaId, setSelectedCinemaId] = useState(() => {
    return localStorage.getItem('manager_selected_cinema_id') || '';
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchCinemas = async () => {
    setLoading(true);
    setError('');
    try {
      const { accessToken } = getStoredAuth();
      if (!accessToken) throw new Error('Chưa đăng nhập');
      const data = await request('/api/v1/manager/cinemas', { token: accessToken });
      const items = Array.isArray(data) ? data : [];
      setCinemas(items);

      if (items.length > 0) {
        setSelectedCinemaId((prev) => {
          const exists = items.some((c) => String(c.id) === String(prev));
          const next = exists ? prev : String(items[0].id);
          localStorage.setItem('manager_selected_cinema_id', next);
          return next;
        });
      } else {
        setSelectedCinemaId('');
      }
    } catch (err) {
      setError(err.message || 'Không thể tải danh sách rạp được phân công.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCinemas();
  }, []);

  const handleSelectCinema = (id) => {
    setSelectedCinemaId(String(id));
    localStorage.setItem('manager_selected_cinema_id', String(id));
  };

  const selectedCinema = cinemas.find((c) => String(c.id) === String(selectedCinemaId)) || null;

  return (
    <ManagerCinemaContext.Provider
      value={{
        cinemas,
        selectedCinemaId,
        selectedCinema,
        setSelectedCinemaId: handleSelectCinema,
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
