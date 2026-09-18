import React, { useState, useEffect, useMemo } from 'react';
import {
  Layers, Armchair, AlertTriangle, CheckCircle2,
  Wrench, Ban, RefreshCw, Info, Edit3
} from 'lucide-react';
import { useManagerCinema } from '../../context/ManagerCinemaContext';
import { getStoredAuth, request } from '../../services/authService';
import { useUiStore } from '../../stores/useUiStore';

export default function ManagerRoomsPage() {
  const { selectedCinemaId, selectedCinema } = useManagerCinema();
  const showToast = useUiStore((state) => state.showToast);

  const [rooms, setRooms] = useState([]);
  const [selectedRoomId, setSelectedRoomId] = useState('');
  const [seats, setSeats] = useState([]);
  const [loadingRooms, setLoadingRooms] = useState(true);
  const [loadingSeats, setLoadingSeats] = useState(false);

  // Seat Status Edit Modal
  const [selectedSeat, setSelectedSeat] = useState(null);
  const [seatModalOpen, setSeatModalOpen] = useState(false);
  const [targetStatus, setTargetStatus] = useState('AVAILABLE');
  const [reason, setReason] = useState('');
  const [savingStatus, setSavingStatus] = useState(false);

  const token = () => getStoredAuth().accessToken;

  // Load Rooms
  const loadRooms = async () => {
    if (!selectedCinemaId) return;
    setLoadingRooms(true);
    try {
      const data = await request(`/api/v1/manager/cinemas/${selectedCinemaId}/rooms`, { token: token() });
      const items = Array.isArray(data) ? data : [];
      setRooms(items);
      if (items.length > 0) {
        setSelectedRoomId(String(items[0].id));
      }
    } catch (err) {
      showToast(err.message || 'Không thể tải danh sách phòng chiếu', 'error');
    } finally {
      setLoadingRooms(false);
    }
  };

  // Load Seats for selected Room
  const loadSeats = async (roomId) => {
    if (!selectedCinemaId || !roomId) return;
    setLoadingSeats(true);
    try {
      const data = await request(`/api/v1/manager/cinemas/${selectedCinemaId}/rooms/${roomId}/seats`, { token: token() });
      setSeats(Array.isArray(data) ? data : []);
    } catch (err) {
      showToast(err.message || 'Không thể tải sơ đồ ghế của phòng', 'error');
    } finally {
      setLoadingSeats(false);
    }
  };

  useEffect(() => {
    loadRooms();
  }, [selectedCinemaId]);

  useEffect(() => {
    if (selectedRoomId) {
      loadSeats(selectedRoomId);
    }
  }, [selectedCinemaId, selectedRoomId]);

  // Group seats by Row for grid rendering
  const seatRows = useMemo(() => {
    const grouped = {};
    seats.forEach((seat) => {
      const rowName = seat.rowName || seat.row || (seat.seatCode ? seat.seatCode.charAt(0) : 'A');
      if (!grouped[rowName]) grouped[rowName] = [];
      grouped[rowName].push(seat);
    });

    // Sort seat rows alphabetically
    return Object.keys(grouped).sort().map((rowName) => {
      const rowSeats = grouped[rowName].sort((a, b) => {
        const numA = Number(a.seatNumber || a.number || 0);
        const numB = Number(b.seatNumber || b.number || 0);
        return numA - numB;
      });
      return { rowName, seats: rowSeats };
    });
  }, [seats]);

  const activeRoom = rooms.find((r) => String(r.id) === String(selectedRoomId)) || null;

  const openSeatModal = (seat) => {
    setSelectedSeat(seat);
    setTargetStatus(seat.status === 'MAINTENANCE' || seat.status === 'BLOCKED' ? 'AVAILABLE' : 'MAINTENANCE');
    setReason(seat.reason || '');
    setSeatModalOpen(true);
  };

  const handleSaveSeatStatus = async (e) => {
    e.preventDefault();
    if (!selectedSeat) return;
    if (targetStatus !== 'AVAILABLE' && !reason.trim()) {
      showToast('Vui lòng ghi rõ lý do bảo trì / khóa ghế', 'error');
      return;
    }
    setSavingStatus(true);
    try {
      await request(
        `/api/v1/manager/cinemas/${selectedCinemaId}/rooms/${selectedRoomId}/seats/${selectedSeat.id}/status`,
        {
          method: 'PATCH',
          token: token(),
          body: {
            status: targetStatus,
            reason: reason.trim()
          }
        }
      );
      showToast(`Đã chuyển trạng thái ghế ${selectedSeat.seatCode || selectedSeat.id} sang ${targetStatus}`, 'success');
      setSeatModalOpen(false);
      loadSeats(selectedRoomId);
    } catch (err) {
      showToast(err.message || 'Lỗi khi cập nhật trạng thái ghế', 'error');
    } finally {
      setSavingStatus(false);
    }
  };

  // Seat styling based on status
  const getSeatStyle = (seat) => {
    if (seat.status === 'MAINTENANCE') {
      return 'bg-amber-500/20 text-amber-400 border-amber-500/40 hover:bg-amber-500/30';
    }
    if (seat.status === 'BLOCKED') {
      return 'bg-rose-500/20 text-rose-400 border-rose-500/40 hover:bg-rose-500/30';
    }
    if (seat.status === 'BOOKED') {
      return 'bg-neutral-800 text-neutral-500 border-neutral-700 cursor-not-allowed';
    }
    if (seat.type === 'VIP') {
      return 'bg-purple-950/40 text-purple-300 border-purple-500/30 hover:bg-purple-900/40';
    }
    return 'bg-[#181818] text-neutral-300 border-white/[0.08] hover:border-amber-400 hover:text-white';
  };

  // Counts
  const totalCount = seats.length;
  const maintenanceCount = seats.filter((s) => s.status === 'MAINTENANCE').length;
  const blockedCount = seats.filter((s) => s.status === 'BLOCKED').length;
  const availableCount = totalCount - maintenanceCount - blockedCount;

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/[0.08] pb-5">
        <div>
          <span className="text-[10px] font-mono uppercase tracking-[0.2em] text-amber-400 font-bold">
            Quản lý phòng chiếu & ghế
          </span>
          <h1 className="text-2xl font-bold tracking-tight text-white mt-1">
            Sơ đồ ghế & Khóa ghế bảo trì
          </h1>
          <p className="text-xs text-neutral-400 mt-0.5">
            Xem trực quan trạng thái ghế của từng phòng và trực tiếp khóa/mở ghế hỏng cần bảo dưỡng.
          </p>
        </div>

        <button
          onClick={() => loadSeats(selectedRoomId)}
          disabled={loadingSeats}
          className="flex items-center gap-2 px-3 py-2 bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.1] rounded-lg text-xs font-medium text-neutral-200 transition-colors self-start sm:self-center"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loadingSeats ? 'animate-spin text-amber-400' : ''}`} />
          Làm mới sơ đồ
        </button>
      </div>

      {/* Room Tabs */}
      <div className="flex flex-wrap items-center gap-2 border-b border-white/[0.08] pb-3">
        {rooms.map((room) => {
          const isActive = String(room.id) === String(selectedRoomId);
          return (
            <button
              key={room.id}
              onClick={() => setSelectedRoomId(String(room.id))}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-medium transition-all ${
                isActive
                  ? 'bg-amber-500 text-black font-bold shadow-md shadow-amber-500/10'
                  : 'bg-white/[0.03] text-neutral-400 hover:text-white hover:bg-white/[0.06] border border-white/[0.06]'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              <span>{room.name}</span>
              <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${isActive ? 'bg-black/20 text-black' : 'bg-white/10 text-neutral-300'}`}>
                {room.totalSeats || '—'} ghế
              </span>
            </button>
          );
        })}
      </div>

      {/* Room Stats & Legend */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
        <div className="p-3 bg-[#141414] border border-white/[0.06] rounded-xl flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-emerald-500/10 text-emerald-400 flex items-center justify-center font-bold">
            <CheckCircle2 className="w-4 h-4" />
          </div>
          <div>
            <p className="text-[11px] text-neutral-400">Khả dụng</p>
            <p className="text-base font-bold text-white font-mono">{availableCount}</p>
          </div>
        </div>

        <div className="p-3 bg-[#141414] border border-white/[0.06] rounded-xl flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-amber-500/10 text-amber-400 flex items-center justify-center font-bold">
            <Wrench className="w-4 h-4" />
          </div>
          <div>
            <p className="text-[11px] text-neutral-400">Bảo trì (Hỏng)</p>
            <p className="text-base font-bold text-amber-400 font-mono">{maintenanceCount}</p>
          </div>
        </div>

        <div className="p-3 bg-[#141414] border border-white/[0.06] rounded-xl flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-rose-500/10 text-rose-400 flex items-center justify-center font-bold">
            <Ban className="w-4 h-4" />
          </div>
          <div>
            <p className="text-[11px] text-neutral-400">Đang khóa</p>
            <p className="text-base font-bold text-rose-400 font-mono">{blockedCount}</p>
          </div>
        </div>

        <div className="p-3 bg-[#141414] border border-white/[0.06] rounded-xl flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-purple-500/10 text-purple-400 flex items-center justify-center font-bold">
            <Armchair className="w-4 h-4" />
          </div>
          <div>
            <p className="text-[11px] text-neutral-400">Tổng số ghế</p>
            <p className="text-base font-bold text-neutral-200 font-mono">{totalCount}</p>
          </div>
        </div>
      </div>

      {/* Screen Canvas Area */}
      <div className="border border-white/[0.08] rounded-xl bg-[#121212] p-6 sm:p-10 flex flex-col items-center justify-center space-y-8 overflow-x-auto">
        {/* Cinema Screen Curve */}
        <div className="w-full max-w-2xl flex flex-col items-center">
          <div className="w-3/4 h-2 bg-gradient-to-r from-transparent via-amber-400 to-transparent rounded-full shadow-lg shadow-amber-500/30" />
          <span className="text-[10px] uppercase font-mono tracking-[0.3em] text-neutral-500 mt-2">
            MÀN HÌNH CHIẾU
          </span>
        </div>

        {/* Live Interactive Seat Map */}
        {loadingSeats ? (
          <div className="py-12 flex flex-col items-center gap-2 text-neutral-400 text-xs">
            <RefreshCw className="w-5 h-5 animate-spin text-amber-400" />
            <p>Đang dựng sơ đồ ghế phòng chiếu...</p>
          </div>
        ) : seatRows.length === 0 ? (
          <p className="text-neutral-500 text-xs py-10">Chưa có dữ liệu ghế cho phòng chiếu này.</p>
        ) : (
          <div className="space-y-2.5">
            {seatRows.map(({ rowName, seats: rowSeats }) => (
              <div key={rowName} className="flex items-center gap-2">
                <span className="w-6 text-center text-xs font-mono font-bold text-neutral-500">
                  {rowName}
                </span>
                <div className="flex items-center gap-1.5">
                  {rowSeats.map((seat) => {
                    const isDefective = seat.status === 'MAINTENANCE' || seat.status === 'BLOCKED';
                    return (
                      <button
                        key={seat.id}
                        onClick={() => openSeatModal(seat)}
                        className={`w-8 h-8 rounded-lg text-[11px] font-mono font-bold flex flex-col items-center justify-center border transition-all cursor-pointer relative group ${getSeatStyle(seat)}`}
                        title={`Ghế ${seat.seatCode || `${rowName}${seat.seatNumber}`} (${seat.status}) - Bấm để đổi trạng thái`}
                      >
                        {isDefective ? (
                          <Wrench className="w-3.5 h-3.5 text-amber-400" />
                        ) : (
                          <span>{seat.seatNumber || seat.number}</span>
                        )}

                        {/* Tooltip on hover */}
                        <div className="absolute bottom-full mb-1 hidden group-hover:block z-10 px-2 py-1 bg-black/90 border border-white/20 rounded text-[10px] text-white whitespace-nowrap pointer-events-none shadow-lg">
                          Ghế {seat.seatCode || `${rowName}${seat.seatNumber}`} · {seat.status}
                          {seat.reason && ` (${seat.reason})`}
                        </div>
                      </button>
                    );
                  })}
                </div>
                <span className="w-6 text-center text-xs font-mono font-bold text-neutral-500">
                  {rowName}
                </span>
              </div>
            ))}
          </div>
        )}

        <div className="text-[11px] text-neutral-400 flex items-center gap-1.5 bg-black/40 border border-white/[0.04] px-3 py-1.5 rounded-lg">
          <Info className="w-3.5 h-3.5 text-amber-400" />
          <span>Bấm vào bất kỳ ghế nào để đánh dấu ghế hỏng / mở lại ghế sau khi sửa chữa.</span>
        </div>
      </div>

      {/* Seat Status Edit Modal */}
      {seatModalOpen && selectedSeat && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="bg-[#181818] border border-white/[0.12] rounded-xl max-w-md w-full p-5 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-white/[0.08] pb-3">
              <h3 className="font-semibold text-white flex items-center gap-2 text-sm">
                <Armchair className="w-4 h-4 text-amber-400" />
                Cập nhật trạng thái Ghế {selectedSeat.seatCode || selectedSeat.id}
              </h3>
              <button
                type="button"
                onClick={() => setSeatModalOpen(false)}
                className="text-neutral-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveSeatStatus} className="space-y-4 text-xs">
              <div>
                <label className="block text-neutral-300 font-medium mb-1.5">
                  Trạng thái vận hành ghế *
                </label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setTargetStatus('AVAILABLE')}
                    className={`p-2.5 rounded-lg border text-center font-medium transition-all ${
                      targetStatus === 'AVAILABLE'
                        ? 'bg-emerald-500/20 border-emerald-500 text-emerald-300'
                        : 'bg-neutral-900 border-white/[0.08] text-neutral-400 hover:text-white'
                    }`}
                  >
                    <CheckCircle2 className="w-4 h-4 mx-auto mb-1" />
                    Khả dụng
                  </button>

                  <button
                    type="button"
                    onClick={() => setTargetStatus('MAINTENANCE')}
                    className={`p-2.5 rounded-lg border text-center font-medium transition-all ${
                      targetStatus === 'MAINTENANCE'
                        ? 'bg-amber-500/20 border-amber-500 text-amber-300'
                        : 'bg-neutral-900 border-white/[0.08] text-neutral-400 hover:text-white'
                    }`}
                  >
                    <Wrench className="w-4 h-4 mx-auto mb-1" />
                    Bảo trì (Hỏng)
                  </button>

                  <button
                    type="button"
                    onClick={() => setTargetStatus('BLOCKED')}
                    className={`p-2.5 rounded-lg border text-center font-medium transition-all ${
                      targetStatus === 'BLOCKED'
                        ? 'bg-rose-500/20 border-rose-500 text-rose-300'
                        : 'bg-neutral-900 border-white/[0.08] text-neutral-400 hover:text-white'
                    }`}
                  >
                    <Ban className="w-4 h-4 mx-auto mb-1" />
                    Khóa tạm
                  </button>
                </div>
              </div>

              {targetStatus !== 'AVAILABLE' && (
                <div>
                  <label className="block text-neutral-300 font-medium mb-1">
                    Lý do hư hỏng / bảo trì *
                  </label>
                  <textarea
                    required
                    rows={3}
                    maxLength={255}
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    placeholder="Ví dụ: Đệm ghế bị rách, gãy tay vịn, hỏng motor ngả lưng..."
                    className="w-full bg-neutral-900 border border-white/[0.12] rounded-lg p-2.5 text-white outline-none focus:border-amber-400 placeholder-neutral-500"
                  />
                </div>
              )}

              <div className="flex justify-end gap-2 pt-3 border-t border-white/[0.08]">
                <button
                  type="button"
                  onClick={() => setSeatModalOpen(false)}
                  className="px-4 py-2 text-neutral-400 hover:text-white transition-colors"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={savingStatus}
                  className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-black font-semibold rounded-lg transition-colors disabled:opacity-50"
                >
                  {savingStatus ? 'Đang lưu...' : 'Lưu trạng thái'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
