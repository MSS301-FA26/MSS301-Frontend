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
  const [selectedDate, setSelectedDate] = useState(() => getTomorrowStr());
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
  const [previewPriceMatrix, setPreviewPriceMatrix] = useState(null);
  const [loadingPricePreview, setLoadingPricePreview] = useState(false);

  useEffect(() => {
    if (!modalOpen || !formData.movieId || !formData.roomId || !formData.startTime) {
      setPreviewPriceMatrix(null);
      return;
    }
    const t = token();
    if (!t) return;
    let cancelled = false;
    setLoadingPricePreview(true);
    adminService.previewShowtimePrices(t, {
      movieId: Number(formData.movieId),
      slots: [{
        roomId: Number(formData.roomId),
        startTime: formData.startTime.length === 16 ? `${formData.startTime}:00` : formData.startTime,
        tempId: String(editingShowtime?.id || 'temp')
      }]
    }).then(res => {
      if (cancelled) return;
      const list = Array.isArray(res) ? res : (res?.data || []);
      if (list.length > 0) setPreviewPriceMatrix(list[0]);
      else setPreviewPriceMatrix(null);
    }).catch(() => {
      if (!cancelled) setPreviewPriceMatrix(null);
    }).finally(() => {
      if (!cancelled) setLoadingPricePreview(false);
    });
    return () => { cancelled = true; };
  }, [modalOpen, formData.movieId, formData.roomId, formData.startTime]); // eslint-disable-line react-hooks/exhaustive-deps

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
    const tomorrowStr = getTomorrowStr();
    const firstValidMovie = movies.find(m => !m.release || m.release <= tomorrowStr);
    const initialMovie = firstValidMovie?.id ? String(firstValidMovie.id) : (movies[0]?.id ? String(movies[0].id) : '');
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
    if (formData.startTime.slice(0, 10) < getTomorrowStr()) {
      showToast('Quy định: Suất chiếu phải được lên lịch trước ít nhất 1 ngày (từ ngày mai trở đi)', 'error');
      return;
    }
    const selM = movies.find(m => String(m.id) === String(formData.movieId));
    if (selM?.release && formData.startTime.slice(0, 10) < selM.release) {
      showToast(`🚫 Phim "${selM.title}" chưa tới ngày khởi chiếu (khởi chiếu từ ${selM.release})`, 'error');
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
            onClick={() => {
              if (selectedDate < getTomorrowStr()) {
                showToast('Hệ thống khóa tạo suất chiếu ở ngày hiện tại hoặc quá khứ (chỉ được tạo từ ngày mai trở đi)', 'warning');
                return;
              }
              openCreateModal();
            }}
            disabled={selectedDate < getTomorrowStr()}
            className={`flex items-center gap-2 px-3.5 py-2 font-semibold rounded-lg text-xs transition-all ${
              selectedDate < getTomorrowStr()
                ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30 cursor-not-allowed opacity-75'
                : 'bg-amber-500 hover:bg-amber-400 text-black shadow-lg shadow-amber-500/10'
            }`}
          >
            {selectedDate < getTomorrowStr() ? <AlertTriangle className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
            {selectedDate < getTomorrowStr() ? 'Khóa tạo (Hôm nay/Quá khứ)' : 'Tạo suất chiếu mới'}
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

      {/* Warning Banner for current/past date */}
      {selectedDate < getTomorrowStr() && (
        <div className="p-3 bg-rose-500/10 border border-rose-500/20 rounded-xl flex items-center justify-between gap-3 text-xs text-rose-300">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
            <span>
              <strong>Chế độ theo dõi & vận hành:</strong> Không thể tạo suất chiếu ở ngày hiện tại hoặc quá khứ. Suất chiếu bắt buộc phải lên lịch trước ít nhất 1 ngày (từ ngày mai trở đi).
            </span>
          </div>
          <button
            type="button"
            onClick={() => setSelectedDate(getTomorrowStr())}
            className="px-2.5 py-1 bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/30 rounded font-medium shrink-0 transition-colors"
          >
            👉 Chuyển sang ngày mai ({getTomorrowStr()})
          </button>
        </div>
      )}

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
                    {st.startTime ? (() => {
                      const d = new Date(st.startTime);
                      if (isNaN(d.getTime())) return st.startTime;
                      const hh = String(d.getHours()).padStart(2, '0');
                      const mm = String(d.getMinutes()).padStart(2, '0');
                      const day = String(d.getDate()).padStart(2, '0');
                      const mon = String(d.getMonth() + 1).padStart(2, '0');
                      const yr = d.getFullYear();
                      return `${hh}:${mm} - ${day}/${mon}/${yr}`;
                    })() : '—'}
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
                {(() => {
                  const isShowtimeOpened = Boolean(
                    editingShowtime && (
                      editingShowtime.status === 'OPEN' ||
                      editingShowtime.status === 'open' ||
                      Number(editingShowtime.sold || 0) > 0
                    )
                  );
                  return (
                    <>
                      <select
                        required
                        disabled={isShowtimeOpened}
                        value={formData.movieId}
                        onChange={(e) => setFormData({ ...formData, movieId: e.target.value })}
                        className={`w-full bg-neutral-900 border border-white/[0.12] rounded-lg p-2.5 text-white outline-none focus:border-amber-400 ${
                          isShowtimeOpened ? 'opacity-60 cursor-not-allowed bg-neutral-950 border-white/[0.08]' : ''
                        }`}
                        title={isShowtimeOpened ? 'Suất chiếu đã mở bán vé, không thể đổi phim' : 'Chọn phim cho suất chiếu'}
                      >
                        <option value="">-- Chọn phim từ thư viện --</option>
                        {movies.slice().sort((a, b) => {
                          const showDate = formData.startTime ? formData.startTime.slice(0, 10) : getTomorrowStr();
                          const aValid = (!a.release || a.release <= showDate);
                          const bValid = (!b.release || b.release <= showDate);
                          if (aValid && !bValid) return -1;
                          if (!aValid && bValid) return 1;
                          return 0;
                        }).map((m) => {
                          const showDate = formData.startTime ? formData.startTime.slice(0, 10) : '';
                          const isUnreleased = Boolean(m.release && showDate && showDate < m.release);
                          return (
                            <option key={m.id} value={m.id} disabled={isUnreleased}>
                              {m.title} {isUnreleased ? `🚫 [Chưa chiếu - từ ${m.release}]` : `(${m.duration || m.durationMinutes || 120} phút)`}
                            </option>
                          );
                        })}
                      </select>
                      {isShowtimeOpened && (
                        <span className="text-[11px] text-amber-400 font-semibold mt-1 block">
                          🔒 Suất chiếu đã mở bán vé ({editingShowtime.sold || 0} vé đã bán), khóa đổi phim.
                        </span>
                      )}
                    </>
                  );
                })()}
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
                  min={`${getTomorrowStr()}T00:00`}
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

              {/* Giá vé cơ bản & Ma trận giá chi tiết */}
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

              {/* THÔNG TIN BẢNG GIÁ VÉ CHI TIẾT (NGƯỜI LỚN, SINH VIÊN, TRẺ EM x GHẾ THƯỜNG, VIP, ĐÔI) */}
              {(() => {
                const formatPrice = (val) => {
                  if (val === null || val === undefined || val === '') return '0đ';
                  return `${Number(val).toLocaleString('vi-VN')}đ`;
                };

                const baseStd = Number(formData.price || 60000);
                const selectedRoom = rooms.find(r => String(r.id) === String(formData.roomId));

                const stdBase = previewPriceMatrix?.roomStandardPrice ?? baseStd;
                const vipBase = previewPriceMatrix?.roomVipPrice ?? (selectedRoom?.vipPrice || Math.round(baseStd * 1.3));
                const coupleBase = previewPriceMatrix?.roomCouplePrice ?? (selectedRoom?.couplePrice || Math.round(baseStd * 2.2));

                const childAdd = previewPriceMatrix?.childAdditional ?? 0;
                const studentAdd = previewPriceMatrix?.studentAdditional ?? 10000;
                const adultAdd = previewPriceMatrix?.adultAdditional ?? 20000;

                const childStd = previewPriceMatrix?.childStandardPrice ?? (stdBase + childAdd);
                const studentStd = previewPriceMatrix?.studentStandardPrice ?? (stdBase + studentAdd);
                const adultStd = previewPriceMatrix?.adultStandardPrice ?? (stdBase + adultAdd);

                const childVip = previewPriceMatrix?.childVipPrice ?? (vipBase + childAdd);
                const studentVip = previewPriceMatrix?.studentVipPrice ?? (vipBase + studentAdd);
                const adultVip = previewPriceMatrix?.adultVipPrice ?? (vipBase + adultAdd);

                const childCouple = previewPriceMatrix?.childChildCouplePrice ?? (coupleBase + childAdd * 2);
                const studentCouple = previewPriceMatrix?.studentStudentCouplePrice ?? (coupleBase + studentAdd * 2);
                const adultCouple = previewPriceMatrix?.adultAdultCouplePrice ?? (coupleBase + adultAdd * 2);

                return (
                  <div className="bg-[#121212] border border-white/[0.08] rounded-lg overflow-hidden shadow-sm">
                    <div className="px-3 py-2 bg-white/[0.03] border-b border-white/[0.08] flex items-center justify-between">
                      <span className="text-[11px] font-bold text-amber-400 uppercase tracking-wider">
                        🎫 Giá vé theo đối tượng & loại ghế
                      </span>
                      {loadingPricePreview ? (
                        <span className="text-[10px] text-neutral-400">⏳ Đang tính...</span>
                      ) : (
                        <span className="text-[10px] text-neutral-500">Cụm rạp</span>
                      )}
                    </div>
                    <table className="w-full text-center text-[11px] border-collapse">
                      <thead>
                        <tr className="border-b border-white/[0.08] bg-black/20 text-neutral-400">
                          <th className="py-2 px-2.5 text-left font-semibold">Loại ghế</th>
                          <th className="py-2 px-1.5 text-sky-400 font-bold">Trẻ em</th>
                          <th className="py-2 px-1.5 text-emerald-400 font-bold">Sinh viên</th>
                          <th className="py-2 px-1.5 text-amber-400 font-bold">Người lớn</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/[0.04]">
                        <tr>
                          <td className="py-2 px-2.5 text-left font-semibold text-neutral-200">Thường</td>
                          <td className="py-2 px-1.5 font-bold font-mono text-sky-400">{formatPrice(childStd)}</td>
                          <td className="py-2 px-1.5 font-bold font-mono text-emerald-400">{formatPrice(studentStd)}</td>
                          <td className="py-2 px-1.5 font-bold font-mono text-amber-400">{formatPrice(adultStd)}</td>
                        </tr>
                        <tr>
                          <td className="py-2 px-2.5 text-left font-semibold text-amber-400">Ghế VIP</td>
                          <td className="py-2 px-1.5 font-bold font-mono text-sky-400">{formatPrice(childVip)}</td>
                          <td className="py-2 px-1.5 font-bold font-mono text-emerald-400">{formatPrice(studentVip)}</td>
                          <td className="py-2 px-1.5 font-bold font-mono text-amber-400">{formatPrice(adultVip)}</td>
                        </tr>
                        <tr>
                          <td className="py-2 px-2.5 text-left font-semibold text-pink-400">Ghế Đôi</td>
                          <td className="py-2 px-1.5 font-bold font-mono text-sky-400">{formatPrice(childCouple)}</td>
                          <td className="py-2 px-1.5 font-bold font-mono text-emerald-400">{formatPrice(studentCouple)}</td>
                          <td className="py-2 px-1.5 font-bold font-mono text-amber-400">{formatPrice(adultCouple)}</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                );
              })()}

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
