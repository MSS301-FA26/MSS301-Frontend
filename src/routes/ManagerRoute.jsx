import React from 'react';
import { Navigate } from 'react-router-dom';
import { getStoredAuth, hasBackendManagerAccess } from '../services/authService';
import { useAuthStore } from '../stores/useAuthStore';

export default function ManagerRoute({ children }) {
  const ready = useAuthStore((state) => state.isAuthReady);
  const { accessToken, user } = getStoredAuth();
  if (!ready) return null;
  return hasBackendManagerAccess(accessToken, user) ? children : <Navigate to="/" replace />;
}
