import React, { useState, useEffect } from 'react';
import {
  Calendar, Plus, Trash2, Edit3, AlertCircle, Clock,
  Layers, Film, CheckCircle2, RefreshCw, XCircle, AlertTriangle
} from 'lucide-react';
import { useManagerCinema } from '../../context/ManagerCinemaContext';
import { adminService } from '../../services/adminService';
import { getStoredAuth, request } from '../../services/authService';
import { useUiStore } from '../../stores/useUiStore';

const getTomorrowStr = () => {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

const getApiErrorMessage = (err, fallback = 'Có lỗi xảy ra khi lưu suất chiếu.') => {
  if (!err) return fallback;
  const data = err?.response?.data;
  if (Array.isArray(data?.errors) && data.errors.length > 0) {
    return data.errors.map(e => e.message || `${e.field}: không hợp lệ`).join('; ');
  }
  if (data?.message) return data.message;
  return err?.message || fallback;
};

export default function ManagerShowtimesPage() {
  const { selectedCinemaId, selectedCinema } = useManagerCinema();
  const showToast = useUiStore((state) => state.showToast);

  const [showtimes, setShowtimes] = useState([]);
  const [rooms, setRooms] = useState([]);
  const [movies, setMovies] = useState([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [selectedDate, setSelectedDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [selectedRoomId, setSelectedRoomId] = useState('');

  // Create/Edit Modal
  const [modalOpen, setModalOpen] = useState(false);
  const [cancelModal, setCancelModal] = useState(null);
  const [editingShowtime, setEditingShowtime] = useState(null);
  const [formData, setFormData] = useState({
    movieId: '',
    roomId: '',
    startTime: '',
    price: 85000
  });
  const [availableSlots, setAvailableSlots] = useState([]);
  const [saving, setSaving] = useState(false);

  const token = () => getStoredAuth().accessToken;

  const loadDependencies = async () => {
    if (!selectedCinemaId) return;
    try {
      const [roomsData, moviesData] = await Promise.all([
        request(`/api/v1/manager/cinemas/${selectedCinemaId}/rooms`, { token: token() }).catch(() => []),
        request('/api/v1/movies', { token: token() }).catch(() => [])
      ]);
      setRooms(Array.isArray(roomsData) ? roomsData : []);
      setMovies(Array.isArray(moviesData) ? moviesData : []);
    } catch {
      // ignore
    }
  };

  const loadShowtimes = async () => {
    if (!selectedCinemaId) return;
    setLoading(true);
    try {
      let url = `/api/v1/manager/cinemas/${selectedCinemaId}/showtimes?size=50`;
      if (selectedDate) url += `&date=${selectedDate}`;
      if (selectedRoomId) url += `&roomId=${selectedRoomId}`;

      const res = await request(url, { token: token() });
      const items = res?.items || [];
      setShowtimes(items);
      const validIds = items.map(x => Number(x.id)).filter(id => !isNaN(id) && id > 0);
      if (validIds.length > 0) {
      if (validIds.length > 0 && typeof adminService?.getShowtimesTicketCounts === 'function') {
        adminService.getShowtimesTicketCounts(token(), validIds)
          .then(countsMap => {
            if (countsMap && typeof countsMap === 'object') {
              setShowtimes(prev => prev.map(item => {
                const cnt = countsMap[item.id] ?? countsMap[Number(item.id)];
                return cnt !== undefined ? { ...item, sold: Number(cnt) } : item;
              }));
            }
          })
          .catch(() => {});
      }
    } catch (err) {
      showToast(err.message || 'Không thể tải danh sách suất chiếu', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDependencies();
  }, [selectedCinemaId]);

  useEffect(() => {
    loadShowtimes();
  }, [selectedCinemaId, selectedDate, selectedRoomId]);

  const fetchAvailableSlots = async (roomId, date) => {
    if (!roomId || !date) return;
    try {
      const slots = await request(
        `/api/v1/manager/cinemas/${selectedCinemaId}/showtimes/available-slots?roomId=${roomId}&date=${date}`,
        { token: token() }
      );
      setAvailableSlots(Array.isArray(slots) ? slots : []);
    } catch {
      setAvailableSlots([]);
    }
  };

  const openCreateModal = () => {
    setEditingShowtime(null);
    const initialRoom = rooms[0]?.id ? String(rooms[0].id) : '';
    const initialMovie = movies[0]?.id ? String(movies[0].id) : '';
    const now = new Date();
    now.setHours(now.getHours() + 1, 0, 0, 0);
    const localIsoTime = new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 16);

    setFormData({
      movieId: initialMovie,
      roomId: initialRoom,
      startTime: `${getTomorrowStr()}T09:00`,
      price: 85000
    });
    if (initialRoom) {
      fetchAvailableSlots(initialRoom, localIsoTime.slice(0, 10));
    }
    setModalOpen(true);
  };

  const openEditModal = (st) => {
    setEditingShowtime(st);
    const dateFormatted = st.startTime ? st.startTime.slice(0, 16) : '';
    setFormData({
      movieId: String(st.movieId || ''),
      roomId: String(st.roomId || ''),
      startTime: dateFormatted,
      price: st.price || 85000
    });
    if (st.roomId && dateFormatted) {
      fetchAvailableSlots(st.roomId, dateFormatted.slice(0, 10));
    }
    setModalOpen(true);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!formData.movieId || !formData.roomId || !formData.startTime) {
      showToast('Vui lòng điền đầy đủ thông tin suất chiếu', 'error');
      return;
    }
    setSaving(true);
    try {
      const payload = {
        cinemaId: Number(selectedCinemaId),
        movieId: Number(formData.movieId),
        roomId: Number(formData.roomId),
        startTime: formData.startTime.length === 16 ? formData.startTime + ':00' : formData.startTime,
        price: Number(formData.price)
      };

      if (editingShowtime) {
        await request(`/api/v1/manager/cinemas/${selectedCinemaId}/showtimes/${editingShowtime.id}`, {
          method: 'PUT',
          token: token(),
          body: payload
        });
        showToast('Đã cập nhật suất chiếu thành công', 'success');
      } else {
        await request(`/api/v1/manager/cinemas/${selectedCinemaId}/showtimes`, {
          method: 'POST',
          token: token(),
          body: payload
        });
        showToast('Đã tạo suất chiếu mới thành công', 'success');
      }
      setModalOpen(false);
      loadShowtimes();
    } catch (err) {
      showToast(getApiErrorMessage(err), 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = async (st) => {
    setCancelModal({
      showtime: st,
      reason: 'Sự cố kỹ thuật phòng chiếu',
      submitting: false,
      loadingSummary: true,
      soldCount: Number(st.sold || 0),
      paidBookingsCount: null,
      totalRefundAmount: null
    });

    const t = token();
    if (t && st.id && !isNaN(Number(st.id)) && typeof adminService?.getShowtimeBookingSummary === 'function') {
      try {
        const summary = await adminService.getShowtimeBookingSummary(t, st.id);
        if (summary) {
          const soldCount = Number(summary.soldTicketsCount ?? summary.paidTicketsCount ?? 0);
          const paidBookingsCount = Number(summary.paidBookingsCount ?? 0);
          const totalRefundAmount = Number(summary.totalRefundAmount ?? 0);
          setCancelModal(prev => prev && String(prev.showtime?.id) === String(st.id) ? ({
            ...prev,
            loadingSummary: false,
            soldCount,
            paidBookingsCount,
            totalRefundAmount,
            showtime: { ...prev.showtime, sold: soldCount }
          }) : prev);

          setShowtimes(prev => prev.map(item =>
            String(item.id) === String(st.id) ? { ...item, sold: soldCount } : item
          ));
        }
      } catch (err) {
        console.warn('Lỗi lấy thông tin đặt vé suất chiếu:', err);
        setCancelModal(prev => prev ? ({ ...prev, loadingSummary: false }) : null);
      }
    } else {
      setCancelModal(prev => prev ? ({ ...prev, loadingSummary: false }) : null);
    }
  };

  const handleConfirmCancelAndRefund = async () => {
    if (!cancelModal?.showtime) return;
    const st = cancelModal.showtime;
    const finalReason = cancelModal.reason?.trim() || 'Sự cố kỹ thuật phòng chiếu';

    setCancelModal(prev => ({ ...prev, submitting: true }));
    try {
      showToast('Đang xử lý hủy suất chiếu và hoàn tiền...', 'info');
      await adminService.cancelShowtimeAndRefund(token(), st.id, finalReason);
      showToast('✓ Đã hủy suất chiếu và tự động hoàn tiền vào CineWallet thành công!', 'success');
      setCancelModal(null);
      loadShowtimes();
    } catch (err) {
      showToast(err.message || 'Không thể hủy suất chiếu', 'error');
      setCancelModal(prev => ({ ...prev, submitting: false }));
    }
  };

  const formatVND = (num) => (num || 0).toLocaleString('vi-VN') + ' đ';

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/[0.08] pb-5">
        <div>
          <span className="text-[10px] font-mono uppercase tracking-[0.2em] text-amber-400 font-bold">
            Vận hành suất chiếu
          </span>
          <h1 className="text-2xl font-bold tracking-tight text-white mt-1">
            Điều phối Lịch chiếu ({selectedCinema?.name})
          </h1>
          <p className="text-xs text-neutral-400 mt-0.5">
            Lên lịch chiếu, kiểm tra xung đột thời gian và quản lý hủy/hoàn tiền theo đúng nghiệp vụ.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={openCreateModal}
            className="flex items-center gap-2 px-3.5 py-2 bg-amber-500 hover:bg-amber-400 text-black font-semibold rounded-lg text-xs transition-all shadow-lg shadow-amber-500/10"
          >
            <Plus className="w-4 h-4" />
            Tạo suất chiếu mới
          </button>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="flex flex-wrap items-center gap-3 bg-[#141414] border border-white/[0.08] p-3 rounded-xl text-xs">
        <div className="flex items-center gap-2">
          <span className="text-neutral-400 font-medium">Ngày chiếu:</span>
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="bg-neutral-900 border border-white/[0.12] focus:border-amber-400 rounded px-2.5 py-1 text-white text-xs outline-none"
          />
        </div>

        <div className="flex items-center gap-2">
          <span className="text-neutral-400 font-medium">Phòng chiếu:</span>
          <select
            value={selectedRoomId}
            onChange={(e) => setSelectedRoomId(e.target.value)}
            className="bg-neutral-900 border border-white/[0.12] focus:border-amber-400 rounded px-2.5 py-1 text-white text-xs outline-none"
          >
            <option value="">Tất cả phòng ({rooms.length})</option>
            {rooms.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </select>
        </div>

        <button
          onClick={loadShowtimes}
          className="ml-auto flex items-center gap-1.5 px-3 py-1 bg-white/[0.04] hover:bg-white/[0.08] text-neutral-300 hover:text-white rounded border border-white/[0.08] transition-colors"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          Lọc
        </button>
      </div>

      {/* Showtimes Table */}
      {loading ? (
        <div className="py-16 text-center text-neutral-400 flex flex-col items-center gap-3">
          <RefreshCw className="w-6 h-6 animate-spin text-amber-400" />
          <p className="text-sm">Đang tải danh sách suất chiếu...</p>
        </div>
      ) : showtimes.length === 0 ? (
        <div className="py-16 text-center border border-dashed border-white/[0.08] rounded-xl bg-white/[0.01]">
          <Calendar className="w-10 h-10 text-neutral-600 mx-auto mb-3" />
          <p className="text-sm font-medium text-neutral-300">Không có suất chiếu nào phù hợp</p>
          <p className="text-xs text-neutral-500 mt-1">Hãy thay đổi ngày chọn hoặc bấm "Tạo suất chiếu mới".</p>
        </div>
      ) : (
        <div className="border border-white/[0.08] rounded-xl overflow-hidden bg-[#121212]">
          <table className="w-full text-left text-xs text-neutral-300">
            <thead className="bg-[#181818] border-b border-white/[0.08] text-[11px] uppercase tracking-wider text-neutral-400">
              <tr>
                <th className="p-3.5">ID</th>
                <th className="p-3.5">Phim</th>
                <th className="p-3.5">Phòng</th>
                <th className="p-3.5">Thời gian bắt đầu</th>
                <th className="p-3.5">Giá vé chuẩn</th>
                <th className="p-3.5">Trạng thái</th>
                <th className="p-3.5 text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.06]">
              {showtimes.map((st) => (
                <tr key={st.id} className="hover:bg-white/[0.02] transition-colors">
                  <td className="p-3.5 font-mono text-neutral-500">#{st.id}</td>
                  <td className="p-3.5">
                    <p className="font-semibold text-white">{st.movieTitle || `Phim #${st.movieId}`}</p>
                    <span className="text-[10px] text-neutral-500 font-mono">Movie ID: {st.movieId}</span>
                  </td>
                  <td className="p-3.5 font-medium text-neutral-200">
                    {st.roomName || `Phòng ${st.roomId}`}
                  </td>
                  <td className="p-3.5 font-mono text-amber-300">
                    {st.startTime ? new Date(st.startTime).toLocaleString('vi-VN') : '—'}
                  </td>
                  <td className="p-3.5 font-mono text-neutral-200">
                    {formatVND(st.price)}
                  </td>
                  <td className="p-3.5">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold ${
                      st.status === 'CANCELLED'
                        ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                        : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                    }`}>
                      {st.status || 'SCHEDULED'}
                    </span>
                  </td>
                  <td className="p-3.5 text-right">
                    <div className="flex items-center justify-end gap-1.5">
                      <button
                        onClick={() => openEditModal(st)}
                        className="p-1.5 text-neutral-400 hover:text-amber-300 hover:bg-white/[0.04] rounded transition-colors"
                        title="Chỉnh sửa"
                      >
                        <Edit3 className="w-4 h-4" />
                      </button>
                      {st.status !== 'CANCELLED' ? (
                        <button
                          onClick={() => handleCancel(st)}
                          className="inline-flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-semibold rounded bg-rose-500/15 text-rose-400 hover:bg-rose-500/25 border border-rose-500/30 transition-all shadow-sm"
                          title="Hủy suất chiếu & Tự động hoàn tiền vào CineWallet"
                        >
                          <AlertTriangle className="w-3.5 h-3.5 text-rose-400" />
                          <span>⚠️ Hủy & hoàn tiền</span>
                        </button>
                      ) : (
                        <span className="text-[11px] text-neutral-500 italic px-2 py-0.5">Đã hủy</span>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Create / Edit Modal */}
      {/* Cancel Showtime & Refund In-App Modal */}
      {cancelModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm" onClick={(e) => { if (e.target === e.currentTarget && !cancelModal.submitting) setCancelModal(null); }}>
          <div className="bg-[#181818] border border-rose-500/40 rounded-xl max-w-lg w-full p-6 shadow-2xl space-y-4 shadow-rose-950/20">
            <div className="flex items-center gap-3 border-b border-white/[0.08] pb-3">
              <div className="w-10 h-10 rounded-lg bg-rose-500/15 border border-rose-500/30 flex items-center justify-center text-lg text-rose-400 shrink-0">
                ⚠️
              </div>
              <div>
                <h3 className="font-semibold text-white text-base">
                  Xác nhận Hủy suất chiếu & Hoàn tiền
                </h3>
                <p className="text-xs text-rose-400 font-medium mt-0.5">
                  Thao tác sự cố khẩn cấp (CineWallet)
                </p>
              </div>
            </div>

            <div className="bg-white/[0.03] border border-white/[0.08] rounded-lg p-3.5 space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-neutral-400">Phim:</span>
                <strong className="text-white">{cancelModal.showtime?.movieTitle || `Phim #${cancelModal.showtime?.movieId}`}</strong>
              </div>
              <div className="flex justify-between">
                <span className="text-neutral-400">Phòng chiếu:</span>
                <span className="text-sky-400 font-semibold">{cancelModal.showtime?.roomName || `Phòng ${cancelModal.showtime?.roomId}`}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-neutral-400">Thời gian:</span>
                <span className="text-amber-400 font-mono">{cancelModal.showtime?.startTime ? new Date(cancelModal.showtime.startTime).toLocaleString('vi-VN') : '-'}</span>
              </div>
              <div className="flex justify-between pt-2 border-t border-white/[0.06]">
                <span className="text-neutral-400">Giá vé cơ bản:</span>
                <span className="text-neutral-200 font-mono">{formatVND(cancelModal.showtime?.price)}</span>
              </div>
              <div className="flex justify-between pt-2 border-t border-white/[0.06]">
                <span className="text-neutral-400">Vé đã bán (Cần hoàn):</span>
                {cancelModal.loadingSummary ? (
                  <span className="text-amber-400 text-[11px]">🔄 Đang kiểm tra hệ thống...</span>
                ) : (
                  <strong className={`font-mono text-xs ${(cancelModal.soldCount || 0) > 0 ? "text-rose-400" : "text-emerald-400"}`}>
                    {cancelModal.soldCount || 0} vé {cancelModal.paidBookingsCount !== null && cancelModal.paidBookingsCount !== undefined ? `(${cancelModal.paidBookingsCount} đơn đặt)` : ""}
                  </strong>
                )}
              </div>
              {cancelModal.totalRefundAmount !== null && cancelModal.totalRefundAmount !== undefined && (
                <div className="flex justify-between pt-1">
                  <span className="text-neutral-400">Tổng tiền hoàn trả:</span>
                  <strong className="text-sky-400 font-mono text-xs">
                    {formatVND(cancelModal.totalRefundAmount)}
                  </strong>
                </div>
              )}
            </div>

            <div className={`border rounded-lg p-3 text-xs leading-relaxed ${(cancelModal.soldCount || 0) > 0 ? "bg-rose-500/10 border-rose-500/25 text-rose-300" : "bg-sky-500/10 border-sky-500/25 text-sky-300"}`}>
              {(cancelModal.soldCount || 0) > 0 ? (
                <>💡 <strong>Lưu ý:</strong> Toàn bộ <strong>{cancelModal.soldCount} vé</strong> đã thanh toán ({formatVND(cancelModal.totalRefundAmount || 0)}) sẽ được hệ thống <strong>tự động hoàn tiền 100% vào CineWallet</strong> của từng khách hàng và các ghế đã đặt sẽ được giải phóng ngay lập tức.</>
              ) : (
                <>ℹ️ Suất chiếu hiện tại <strong>chưa có vé thanh toán</strong>. Thao tác hủy sẽ chuyển trạng thái suất chiếu sang "Đã hủy" một cách an toàn mà không phát sinh hoàn tiền.</>
              )}
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-neutral-200 block">
                Lý do hủy suất chiếu:
              </label>
              <input
                type="text"
                value={cancelModal.reason}
                onChange={(e) => setCancelModal(prev => ({ ...prev, reason: e.target.value }))}
                placeholder="Nhập lý do hủy sự cố (VD: Sự cố kỹ thuật phòng chiếu, mất điện...)"
                disabled={cancelModal.submitting}
                className="w-full px-3.5 py-2.5 bg-white/[0.05] border border-white/[0.12] rounded-lg text-white text-xs focus:outline-none focus:border-rose-500 transition-colors"
              />
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setCancelModal(null)}
                disabled={cancelModal.submitting}
                className="px-4 py-2 rounded-lg text-xs font-medium text-neutral-300 hover:bg-white/[0.06] transition-colors"
              >
                Hủy bỏ
              </button>
              <button
                type="button"
                onClick={handleConfirmCancelAndRefund}
                disabled={cancelModal.submitting}
                className="px-4 py-2 rounded-lg text-xs font-semibold bg-rose-600 hover:bg-rose-500 text-white transition-colors flex items-center gap-1.5 disabled:opacity-50"
              >
                {cancelModal.submitting ? 'Đang xử lý...' : '⚠️ Xác nhận Hủy & Hoàn tiền'}
              </button>
            </div>
          </div>
        </div>
      )}

      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="bg-[#181818] border border-white/[0.12] rounded-xl max-w-lg w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-white/[0.08] pb-3">
              <h3 className="font-semibold text-white flex items-center gap-2 text-sm">
                <Calendar className="w-4 h-4 text-amber-400" />
                {editingShowtime ? 'Chỉnh sửa suất chiếu' : 'Tạo suất chiếu mới'}
              </h3>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="text-neutral-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSave} className="space-y-4 text-xs">
              {/* Chọn phim */}
              <div>
                <label className="block text-neutral-300 font-medium mb-1">
                  Chọn phim *
                </label>
                <select
                  required
                  value={formData.movieId}
                  onChange={(e) => setFormData({ ...formData, movieId: e.target.value })}
                  className="w-full bg-neutral-900 border border-white/[0.12] rounded-lg p-2.5 text-white outline-none focus:border-amber-400"
                >
                  <option value="">-- Chọn phim từ thư viện --</option>
                  {movies.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.title} ({m.duration || m.durationMinutes || 120} phút)
                    </option>
                  ))}
                </select>
              </div>

              {/* Chọn phòng */}
              <div>
                <label className="block text-neutral-300 font-medium mb-1">
                  Phòng chiếu *
                </label>
                <select
                  required
                  value={formData.roomId}
                  onChange={(e) => {
                    setFormData({ ...formData, roomId: e.target.value });
                    if (formData.startTime) {
                      fetchAvailableSlots(e.target.value, formData.startTime.slice(0, 10));
                    }
                  }}
                  className="w-full bg-neutral-900 border border-white/[0.12] rounded-lg p-2.5 text-white outline-none focus:border-amber-400"
                >
                  <option value="">-- Chọn phòng chiếu --</option>
                  {rooms.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Thời gian bắt đầu */}
              <div>
                <label className="block text-neutral-300 font-medium mb-1">
                  Thời gian bắt đầu *
                </label>
                <input
                  required
                  type="datetime-local"
                  value={formData.startTime}
                  onChange={(e) => {
                    setFormData({ ...formData, startTime: e.target.value });
                    if (formData.roomId && e.target.value) {
                      fetchAvailableSlots(formData.roomId, e.target.value.slice(0, 10));
                    }
                  }}
                  className="w-full bg-neutral-900 border border-white/[0.12] rounded-lg p-2.5 text-white outline-none focus:border-amber-400"
                />
              </div>

              {/* Khung giờ trống gợi ý */}
              {availableSlots.length > 0 && (
                <div className="bg-white/[0.02] border border-white/[0.06] p-3 rounded-lg">
                  <span className="text-[10px] font-mono text-neutral-400 uppercase tracking-wider block mb-1.5">
                    Gợi ý khung giờ còn trống trong ngày:
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {availableSlots.slice(0, 8).map((slot, idx) => (
                      <button
                        type="button"
                        key={idx}
                        onClick={() => {
                          const datePart = formData.startTime.slice(0, 10);
                          setFormData({ ...formData, startTime: `${datePart}T${slot.start || slot}` });
                        }}
                        className="px-2 py-1 bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/20 rounded text-[11px] font-mono transition-colors"
                      >
                        {slot.start || slot}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Giá vé cơ bản */}
              <div>
                <label className="block text-neutral-300 font-medium mb-1">
                  Giá vé tiêu chuẩn (VND) *
                </label>
                <input
                  required
                  type="number"
                  min="10000"
                  step="5000"
                  value={formData.price}
                  onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                  className="w-full bg-neutral-900 border border-white/[0.12] rounded-lg p-2.5 text-white outline-none focus:border-amber-400 font-mono"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-white/[0.08]">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="px-4 py-2 text-neutral-400 hover:text-white transition-colors"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-black font-semibold rounded-lg transition-colors disabled:opacity-50"
                >
                  {saving ? 'Đang lưu...' : editingShowtime ? 'Lưu cập nhật' : 'Tạo suất chiếu'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
