import React from 'react';
import { Navigate } from 'react-router-dom';
import {
  getStoredAuth,
  hasBackendAdminAccess,
  hasBackendManagerAccess,
  isAdmin as checkIsAdmin,
  isManager as checkIsManager
} from '../services/authService';
import { useAuthStore } from '../stores/useAuthStore';

export default function ManagerRoute({ children }) {
  const isAuthReady = useAuthStore((state) => state.isAuthReady);
  const isLoggedIn = useAuthStore((state) => state.isLoggedIn);
  const currentRole = useAuthStore((state) => state.currentRole);
  const currentUser = useAuthStore((state) => state.currentUser);
  const { accessToken, user } = getStoredAuth();

  const isUserAdmin = checkIsAdmin(currentUser) || checkIsAdmin(user) || currentRole === 'admin' || hasBackendAdminAccess(accessToken, user);
  const isUserManager = checkIsManager(currentUser) || checkIsManager(user) || currentRole === 'manager' || hasBackendManagerAccess(accessToken, user);

  if (!isAuthReady) return null;
  if (!isLoggedIn && !accessToken) return <Navigate to="/" replace />;

  // Admin navigating to /manager gets directed to /admin/overview
  if (isUserAdmin) {
    return <Navigate to="/admin/overview" replace />;
  }

  if (!isUserManager) return <Navigate to="/" replace />;
  return children;
}
