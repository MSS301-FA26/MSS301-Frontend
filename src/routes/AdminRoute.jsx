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

export default function AdminRoute({ children }) {
  const isLoggedIn = useAuthStore((state) => state.isLoggedIn);
  const isAuthReady = useAuthStore((state) => state.isAuthReady);
  const currentRole = useAuthStore((state) => state.currentRole);
  const currentUser = useAuthStore((state) => state.currentUser);
  const { accessToken, user } = getStoredAuth();

  const isUserAdmin = checkIsAdmin(currentUser) || checkIsAdmin(user) || currentRole === 'admin' || hasBackendAdminAccess(accessToken, user);
  const isUserManager = checkIsManager(currentUser) || checkIsManager(user) || currentRole === 'manager' || hasBackendManagerAccess(accessToken, user);

  if (!isAuthReady) return null;
  if (!isLoggedIn && !accessToken) return <Navigate to="/" replace />;

  // Unified Portal: Both Admin and Manager can access /admin/**
  if (!isUserAdmin && !isUserManager) {
    return <Navigate to="/" replace />;
  }
  return children;
}
