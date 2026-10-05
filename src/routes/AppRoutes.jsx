import React from 'react';
import { Navigate, Route, Routes, useLocation, useNavigate, useParams } from 'react-router-dom';
import UserLayout from '../layouts/UserLayout';
import HomeView from '@/pages/user/HomePage';
import ExploreView from '@/pages/user/ExplorePage';
import DetailView from '@/pages/user/MovieDetailPage';
import BookingView from '@/pages/user/BookingPage';
import ProfileView from '@/pages/user/ProfilePage';
import MyOrdersPage from '@/pages/user/MyOrdersPage';
import ShowtimesPage from '@/pages/user/ShowtimesPage';
import WishlistView from '@/pages/user/WishlistPage';
import AdminDashboard from '@/pages/admin/AdminPage';
import PoliciesPage from '@/pages/user/PoliciesPage';
import PaymentCallbackPage from '@/pages/user/PaymentCallbackPage';
import ConcessionsPage from '@/pages/user/ConcessionsPage';
import StaffCheckInPage from '@/pages/staff/StaffCheckInPage';
import GooglePasswordSetupPage from '@/pages/auth/GooglePasswordSetupPage';
import AdminRoute from './AdminRoute';
import StaffRoute from './StaffRoute';
import ManagerRoute from './ManagerRoute';
import ProtectedRoute from './ProtectedRoute';
import { getStoredAuth, isAdmin as checkIsAdmin, isManager as checkIsManager, isStaff as checkIsStaff, hasBackendAdminAccess, hasBackendManagerAccess } from '../services/authService';
import { useMovies } from '../stores/useMovieStore';
import { useAuthStore } from '../stores/useAuthStore';
import { useUiStore } from '../stores/useUiStore';

function AppShell({ children }) {
  return <UserLayout>{children}</UserLayout>;
}

function HomeRoute() {
  const navigate = useNavigate();
  const { moviesList } = useMovies();
  const showToast = useUiStore((state) => state.showToast);

  const goToTab = (tab) => {
    const paths = {
      home: '/',
      explore: '/movies',
      showtimes: '/showtimes',
      concessions: '/concessions',
      'my-tickets': '/tickets',
      wishlist: '/watchlist',
      profile: '/profile',
      policies: '/policies'
    };
    navigate(paths[tab] || '/');
  };

  const handleBookMovie = (movie) => {
    const isBookable = movie?.status === 'NOW_SHOWING' || (!movie?.status && !movie?.isUpcoming);
    const targetId = movie?.movieId || movie?.backendId || movie?.id;
    if (!isBookable) {
      showToast('Phim sắp chiếu chưa mở bán vé.');
    }
    navigate(`/movies/${targetId}`, { state: { scrollToShowtimes: true } });
  };

  return (
    <HomeView
      moviesList={moviesList}
      onSelectMovie={(id) => navigate(`/movies/${id}`)}
      onBookMovie={handleBookMovie}
      onTabChange={goToTab}
    />
  );
}

// Admin-only portal view
function AdminRouteView() {
  const navigate = useNavigate();
  const { section = 'overview' } = useParams();
  const showToast = useUiStore((state) => state.showToast);
  const currentUser = useAuthStore((state) => state.currentUser);
  const currentRole = useAuthStore((state) => state.currentRole);
  const { user, accessToken } = getStoredAuth();
  const effectiveUser = currentUser || user;

  const isUserAdmin = currentRole === 'admin' || checkIsAdmin(effectiveUser) || hasBackendAdminAccess(accessToken, effectiveUser);
  const isUserManager = !isUserAdmin && (currentRole === 'manager' || checkIsManager(effectiveUser) || hasBackendManagerAccess(accessToken, effectiveUser));

  // Manager must not access /admin routes - redirect them to /manager portal
  if (isUserManager) {
    return <Navigate to={`/manager/${section}`} replace />;
  }

  const {
    moviesList,
    setMoviesList,
    bookedTickets,
    setBookedTickets,
    fetchPublicFoodCatalog,
    publicCinema,
    fetchPublicCinema,
  } = useMovies();

  return (
    <AdminRoute>
      <AdminDashboard
        moviesList={moviesList}
        setMoviesList={setMoviesList}
        bookedTickets={bookedTickets}
        setBookedTickets={setBookedTickets}
        publicCinema={publicCinema}
        onCinemaChanged={fetchPublicCinema}
        onSelectMovie={(id) => navigate(`/movies/${id}`)}
        showToast={showToast}
        initialSection={section}
        onSectionChange={(nextSection) => navigate(`/admin/${nextSection}`)}
        onFoodCatalogChanged={() => fetchPublicFoodCatalog({ force: true })}
        isAdmin={isUserAdmin}
        isManager={false}
        basePath="/admin"
        currentUser={effectiveUser}
      />
    </AdminRoute>
  );
}

// Manager portal — same AdminDashboard UI, scoped to manager's cinema, basePath=/manager
function ManagerDashboardRouteView() {
  const navigate = useNavigate();
  const { section = 'overview' } = useParams();
  const showToast = useUiStore((state) => state.showToast);
  const currentUser = useAuthStore((state) => state.currentUser);
  const { user } = getStoredAuth();
  const effectiveUser = currentUser || user;

  const {
    moviesList,
    setMoviesList,
    bookedTickets,
    setBookedTickets,
    fetchPublicFoodCatalog,
    publicCinema,
    fetchPublicCinema,
  } = useMovies();

  return (
    <ManagerRoute>
      <div className="h-screen overflow-hidden w-full bg-[#0d0f14] text-white">
      <AdminDashboard
        moviesList={moviesList}
        setMoviesList={setMoviesList}
        bookedTickets={bookedTickets}
        setBookedTickets={setBookedTickets}
        publicCinema={publicCinema}
        onCinemaChanged={fetchPublicCinema}
        onSelectMovie={(id) => navigate(`/movies/${id}`)}
        showToast={showToast}
        initialSection={section}
        onSectionChange={(nextSection) => navigate(`/manager/${nextSection}`)}
        onFoodCatalogChanged={() => fetchPublicFoodCatalog({ force: true })}
        isAdmin={false}
        isManager={true}
        basePath="/manager"
        currentUser={effectiveUser}
      />
      </div>
    </ManagerRoute>
  );
}

export default function AppRoutes() {
  const location = useLocation();
  const currentUser = useAuthStore((state) => state.currentUser);
  const currentRole = useAuthStore((state) => state.currentRole);
  const mustSetupPassword = currentUser?.passwordChangeRequired;
  const { user } = getStoredAuth();
  const effectiveUser = currentUser || user;

  const isAdminUser = currentRole === 'admin' || checkIsAdmin(effectiveUser);
  const isManagerUser = currentRole === 'manager' || checkIsManager(effectiveUser);
  const isStaffUser = currentRole === 'staff' || checkIsStaff(effectiveUser);

  return (
    <Routes>
      <Route path="/setup-password" element={<GooglePasswordSetupPage />} />
      {mustSetupPassword && <Route path="*" element={<Navigate to="/setup-password" replace />} />}
      <Route path="/payment-callback" element={<PaymentCallbackPage />} />
      <Route path="/staff" element={<AppShell><StaffRoute><StaffCheckInPage /></StaffRoute></AppShell>} />

      {/* Root redirect by role */}
      <Route
        path="/"
        element={
          isAdminUser ? (
            <Navigate to="/admin/overview" replace />
          ) : isManagerUser ? (
            <Navigate to="/manager/overview" replace />
          ) : isStaffUser ? (
            <Navigate to="/staff" replace />
          ) : (
            <AppShell><HomeRoute /></AppShell>
          )
        }
      />

      {/* Admin-only portal — full access */}
      <Route path="/admin" element={<Navigate to="/admin/overview" replace />} />
      <Route path="/admin/:section" element={<AppShell><AdminRouteView /></AppShell>} />

      {/* Manager portal — same AdminDashboard UI, scoped to manager's cinema */}
      <Route path="/manager" element={<Navigate to="/manager/overview" replace />} />
      <Route path="/manager/:section" element={<ManagerDashboardRouteView />} />

      {/* Public / user routes */}
      <Route path="/movies" element={<AppShell><ExploreView /></AppShell>} />
      <Route path="/showtimes" element={<AppShell><ShowtimesPage /></AppShell>} />
      <Route path="/book" element={<Navigate to="/showtimes" replace />} />
      <Route path="/movies/:id" element={<AppShell><DetailView /></AppShell>} />
      <Route path="/movies/:id/book" element={<AppShell><ProtectedRoute><BookingView /></ProtectedRoute></AppShell>} />
      <Route path="/concessions" element={<AppShell><ConcessionsPage /></AppShell>} />
      <Route path="/tickets" element={<AppShell><ProtectedRoute><MyOrdersPage /></ProtectedRoute></AppShell>} />
      <Route path="/watchlist" element={isAdminUser ? <Navigate to="/admin/overview" replace /> : isManagerUser ? <Navigate to="/manager/overview" replace /> : isStaffUser ? <Navigate to="/staff" replace /> : <AppShell><ProtectedRoute><WishlistView /></ProtectedRoute></AppShell>} />
      <Route path="/profile" element={<AppShell><ProtectedRoute><ProfileView /></ProtectedRoute></AppShell>} />
      <Route path="/policies" element={<AppShell><PoliciesPage /></AppShell>} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
