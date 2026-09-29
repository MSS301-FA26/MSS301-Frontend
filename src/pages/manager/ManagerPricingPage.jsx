import React from 'react';
import AdminPricingPanel from '../admin/cinema/AdminPricingPanel';
import { getStoredAuth } from '../../services/authService';
import { useAuthStore } from '../../stores/useAuthStore';
import { useUiStore } from '../../stores/useUiStore';

export default function ManagerPricingPage() {
  const currentUser = useAuthStore((state) => state.currentUser);
  const showToast = useUiStore((state) => state.showToast);
  const { accessToken } = getStoredAuth();

  const ctx = {
    getAdminToken: () => accessToken,
    showToast,
    isAdmin: false,
    isManager: true,
    currentUser
  };

  return (
    <div className="p-6">
      <AdminPricingPanel ctx={ctx} />
    </div>
  );
}
