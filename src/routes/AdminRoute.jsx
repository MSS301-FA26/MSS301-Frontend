import React from 'react';
import { Navigate } from 'react-router-dom';
import { getStoredAuth, hasBackendAdminAccess, hasBackendManagerAccess } from '../services/authService';
import { useAuthStore } from '../stores/useAuthStore';

export default function AdminRoute({ children }) {
  const isLoggedIn = useAuthStore((state) => state.isLoggedIn);
  const isAuthReady = useAuthStore((state) => state.isAuthReady);
  const currentRole = useAuthStore((state) => state.currentRole);
  const currentUser = useAuthStore((state) => state.currentUser);
  const { accessToken, user } = getStoredAuth();
  const hasStoredAccess = hasBackendAdminAccess(accessToken, user) || hasBackendManagerAccess(accessToken, user);
  const hasContextAccess = currentRole === 'admin' || currentRole === 'manager' ||
    currentUser?.role === 'admin' || currentUser?.role === 'manager' ||
    hasBackendAdminAccess(accessToken, currentUser) || hasBackendManagerAccess(accessToken, currentUser);

  if (!isAuthReady) return null;
  if (!isLoggedIn && !accessToken) return <Navigate to="/" replace />;
  if (!hasStoredAccess && !hasContextAccess) return <Navigate to="/" replace />;
  return children;
}
