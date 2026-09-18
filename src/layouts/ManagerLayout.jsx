import React from 'react';
import ManagerSidebar from '../components/manager/ManagerSidebar';
import { ManagerCinemaProvider, useManagerCinema } from '../context/ManagerCinemaContext';
import { MapPin, ShieldCheck, Clock } from 'lucide-react';

function ManagerHeader() {
  const { selectedCinema, loading } = useManagerCinema();

  return (
    <header className="h-16 shrink-0 border-b border-white/[0.08] bg-[#141414] px-6 flex items-center justify-between">
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2 text-xs text-neutral-400">
          <MapPin className="w-4 h-4 text-amber-400" />
          <span className="text-white font-semibold text-sm">
            {loading ? 'Đang tải thông tin rạp...' : selectedCinema?.name || 'Chưa chọn rạp'}
          </span>
          {selectedCinema?.city && (
            <span className="text-[11px] px-2 py-0.5 rounded bg-white/[0.05] border border-white/[0.08] text-neutral-300">
              {selectedCinema.city}
            </span>
          )}
        </div>
      </div>

      <div className="flex items-center gap-4 text-xs">
        <div className="hidden sm:flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 font-medium">
          <ShieldCheck className="w-3.5 h-3.5" />
          <span>Vận hành chuẩn RBAC Scoped</span>
        </div>
      </div>
    </header>
  );
}

function ManagerLayoutInner({ children }) {
  return (
    <div className="flex h-screen w-screen overflow-hidden bg-[#0e0e0e] text-neutral-100 font-sans">
      <ManagerSidebar />
      <div className="flex-1 flex flex-col min-w-0 h-screen overflow-hidden">
        <ManagerHeader />
        <main className="flex-1 overflow-y-auto bg-[#0a0a0a] [scrollbar-width:thin] [scrollbar-color:#333_transparent]">
          {children}
        </main>
      </div>
    </div>
  );
}

export default function ManagerLayout({ children }) {
  return (
    <ManagerCinemaProvider>
      <ManagerLayoutInner>{children}</ManagerLayoutInner>
    </ManagerCinemaProvider>
  );
}
