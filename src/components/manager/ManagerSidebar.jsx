import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard, Calendar, Layers,
  Ticket, Users, BarChart3,
  DollarSign, Building2, LogOut
} from 'lucide-react';
import { useManagerCinema } from '../../context/ManagerCinemaContext';
import { useAuthStore } from '../../stores/useAuthStore';
import { useUiStore } from '../../stores/useUiStore';

const NAV_ITEMS = [
  { to: '/manager/overview', label: 'Tổng quan vận hành', icon: LayoutDashboard },
  { to: '/manager/staff', label: 'Nhân viên cụm rạp', icon: Users },
  { to: '/manager/rooms', label: 'Phòng chiếu & Ghế', icon: Layers },
  { to: '/manager/showtimes', label: 'Quản lý suất chiếu', icon: Calendar },
  { to: '/manager/pricing', label: 'Bảng giá vé rạp', icon: DollarSign },
  { to: '/manager/bookings', label: 'Vé & Check-in', icon: Ticket },
  { to: '/manager/reports', label: 'Báo cáo doanh thu', icon: BarChart3 },
];

export default function ManagerSidebar() {
  const navigate = useNavigate();
  const { selectedCinema, loading } = useManagerCinema();
  const currentUser = useAuthStore((state) => state.currentUser);
  const handleLogout = useAuthStore((state) => state.handleLogout);
  const showToast = useUiStore((state) => state.showToast);

  return (
    <aside className="w-64 shrink-0 h-screen bg-[#111111] border-r border-white/[0.08] flex flex-col select-none">
      {/* Brand Header */}
      <div className="h-16 shrink-0 px-5 flex items-center gap-3 border-b border-white/[0.08]">
        <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center font-serif font-black italic text-black shadow-lg shadow-amber-500/20">
          M
        </div>
        <div className="min-w-0">
          <div className="text-xs font-black uppercase tracking-[0.18em] text-white flex items-center gap-1">
            CINE<span className="text-amber-400">AI</span>
            <span className="text-[9px] px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20 font-mono font-bold tracking-normal ml-1">
              MANAGER
            </span>
          </div>
          <p className="text-[10px] text-neutral-400 truncate">Hệ thống điều hành cụm rạp</p>
        </div>
      </div>

      {/* Cinema Badge Card (Fixed to currentUser.cinemaId) */}
      <div className="p-3 border-b border-white/[0.08] bg-black/20">
        <label className="block text-[10px] font-mono uppercase tracking-wider text-neutral-400 mb-1.5 flex items-center gap-1">
          <Building2 className="w-3 h-3 text-amber-400" />
          Rạp đang quản lý
        </label>
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-300 font-semibold text-xs">
          <span className="truncate">
            {loading ? 'Đang tải rạp...' : selectedCinema?.name || (currentUser?.cinemaId ? `Rạp #${currentUser.cinemaId}` : 'Chưa phân công')}
          </span>
          {selectedCinema?.city && (
            <span className="ml-auto text-[9px] px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-200">
              {selectedCinema.city}
            </span>
          )}
        </div>
      </div>

      {/* Navigation Links */}
      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1 text-xs">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `flex items-center gap-2.5 px-3 py-2.5 rounded-lg font-medium transition-all duration-150 ${
                  isActive
                    ? 'bg-amber-500/10 text-amber-400 border border-amber-500/30 font-semibold shadow-sm'
                    : 'text-neutral-300 hover:text-white hover:bg-white/[0.04]'
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-amber-400' : 'text-neutral-400'}`} />
                  <span className="truncate">{item.label}</span>
                  {isActive && <span className="ml-auto w-1.5 h-1.5 rounded-full bg-amber-400" />}
                </>
              )}
            </NavLink>
          );
        })}
      </nav>

      {/* User Footer */}
      <div className="p-3 border-t border-white/[0.08] bg-[#0c0c0c] flex items-center justify-between gap-2">
        <div className="min-w-0 flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-full bg-neutral-800 border border-white/10 flex items-center justify-center font-bold text-xs text-amber-400">
            {currentUser?.fullName?.charAt(0)?.toUpperCase() || currentUser?.name?.charAt(0)?.toUpperCase() || 'M'}
          </div>
          <div className="min-w-0">
            <p className="text-xs font-semibold text-white truncate leading-tight">
              {currentUser?.fullName || currentUser?.name || 'Cinema Manager'}
            </p>
            <p className="text-[10px] text-neutral-500 truncate leading-tight mt-0.5">
              {currentUser?.email || 'manager@cinema.vn'}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => handleLogout({ navigate, showToast })}
          className="p-1.5 text-neutral-400 hover:text-rose-300 hover:bg-rose-500/10 rounded-lg transition-colors shrink-0"
          title="Đăng xuất"
        >
          <LogOut className="w-4 h-4" />
        </button>
      </div>
    </aside>
  );
}
