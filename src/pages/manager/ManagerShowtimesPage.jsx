import React, { useState, useEffect } from 'react';
import {
  Calendar, Plus, Trash2, Edit3, AlertCircle, Clock,
  Layers, Film, CheckCircle2, RefreshCw, XCircle, AlertTriangle
} from 'lucide-react';
import { useManagerCinema } from '../../context/ManagerCinemaContext';
import { getStoredAuth, request } from '../../services/authService';
import { useUiStore } from '../../stores/useUiStore';

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
      setShowtimes(res?.items || []);
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
      startTime: localIsoTime,
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
      showToast(err.message || 'Lỗi khi lưu suất chiếu (có thể bị trùng lịch)', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = async (st) => {
    const confirmMsg = `Bạn có chắc chắn muốn HỦY suất chiếu này?\n\nPhim: ${st.movieTitle || `#${st.movieId}`}\nThời gian: ${st.startTime}\n\nLưu ý: Tất cả vé đã thanh toán của suất chiếu này sẽ được hệ thống TỰ ĐỘNG HOÀN TIỀN cho khách hàng!`;
    if (!window.confirm(confirmMsg)) return;

    try {
      await request(`/api/v1/manager/cinemas/${selectedCinemaId}/showtimes/${st.id}`, {
        method: 'DELETE',
        token: token()
      });
      showToast('Đã hủy suất chiếu và kích hoạt quy trình hoàn tiền cho khách hàng.', 'info');
      loadShowtimes();
    } catch (err) {
      showToast(err.message || 'Không thể hủy suất chiếu', 'error');
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
                      {st.status !== 'CANCELLED' && (
                        <button
                          onClick={() => handleCancel(st)}
                          className="p-1.5 text-neutral-400 hover:text-rose-400 hover:bg-rose-500/10 rounded transition-colors"
                          title="Hủy suất chiếu & Hoàn tiền vé"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
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
