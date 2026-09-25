import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import {
  Film, Plus, Save, Undo2, RotateCcw,
  Search, Trash2, AlertTriangle, X, Eraser,
  Sparkles, AlertCircle, CheckCircle2, Loader2
} from 'lucide-react';
import { adminService } from '../../../services/adminService';

// ==========================================
// CONSTANTS & DEFINITIONS
// ==========================================
const ROW_LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

const BRUSHES = {
  std: { id: 'std', name: 'Thường', type: 'STANDARD', color: '#697078', bg: '#161b20', border: '#697078', text: '#e5e7eb' },
  vip: { id: 'vip', name: 'VIP', type: 'VIP', color: '#f5b800', bg: 'rgba(245,184,0,0.14)', border: '#f5b800', text: '#ffc400' },
  couple: { id: 'couple', name: 'Ghế đôi', type: 'COUPLE', color: '#ec4899', bg: '#831843', border: '#ec4899', text: '#f9a8d4' },
  off: { id: 'off', name: 'Trống / lối đi', type: 'OFF', color: '#40464f', bg: 'transparent', border: '#40464f', text: '#555555' },
  delete_seat: { id: 'delete_seat', name: 'Xóa ghế', type: 'DELETE', color: '#ef4444', bg: 'transparent', border: '#ef4444', text: '#ef4444' }
};

const ROOM_TYPE_OPTIONS = [
  { value: 'STANDARD', label: 'Tiêu chuẩn' },
  { value: 'TWO_D', label: '2D' },
  { value: 'THREE_D', label: '3D' },
  { value: 'IMAX', label: 'IMAX' },
  { value: 'VIP', label: 'VIP' }
];

const DEFAULT_PRICES = {
  std: 90000,
  vip: 110000,
  couple: 160000
};

// Generates row layout matrix from row count and column count
function generateDefaultRows(rowCount, colCount, defaultType = 'std') {
  const n = Math.min(26, Math.max(1, rowCount));
  const c = Math.min(30, Math.max(1, colCount));
  return Array.from({ length: n }, (_, i) => ({
    label: ROW_LETTERS[i] || `R${i + 1}`,
    seats: Array(c).fill(defaultType)
  }));
}

// Converts backend SeatResponse list into editor row structure
function mapBackendSeatsToRows(backendSeats, rowCount, columnCount) {
  if (!backendSeats || backendSeats.length === 0) {
    return generateDefaultRows(rowCount || 8, columnCount || 10);
  }

  // Group seats by rowLabel
  const groupedByRow = {};
  backendSeats.forEach(seat => {
    const label = (seat.rowLabel || 'A').toUpperCase();
    if (!groupedByRow[label]) groupedByRow[label] = [];
    groupedByRow[label].push(seat);
  });

  // Sort rows by displayOrder
  const sortedLabels = Object.keys(groupedByRow).sort((a, b) => {
    const orderA = groupedByRow[a][0]?.displayOrder ?? ROW_LETTERS.indexOf(a);
    const orderB = groupedByRow[b][0]?.displayOrder ?? ROW_LETTERS.indexOf(b);
    return orderA - orderB;
  });

  const rows = [];
  sortedLabels.forEach(label => {
    const rowSeats = groupedByRow[label].sort((a, b) => a.displayColumn - b.displayColumn);
    const isCoupleRow = rowSeats.length >= 2 && rowSeats.every(s => s.seatType === 'COUPLE' || s.status === 'UNAVAILABLE');

    if (isCoupleRow && rowSeats.length % 2 === 0) {
      const pairCount = rowSeats.length / 2;
      const seatArray = [];
      for (let p = 0; p < pairCount; p++) {
        const s1 = rowSeats[p * 2];
        const s2 = rowSeats[p * 2 + 1];
        if (s1?.status === 'UNAVAILABLE' && s2?.status === 'UNAVAILABLE') {
          seatArray.push('off');
        } else {
          seatArray.push('couple');
        }
      }
      rows.push({
        label,
        seats: seatArray
      });
      return;
    }

    const maxCol = Math.max(columnCount || 10, ...rowSeats.map(s => s.displayColumn || s.seatNumber || 1));
    const seatArray = Array(maxCol).fill('off');

    // Fill seats
    rowSeats.forEach(seat => {
      const colIdx = (seat.displayColumn || seat.seatNumber || 1) - 1;
      if (colIdx >= 0 && colIdx < maxCol) {
        if (seat.status === 'UNAVAILABLE') {
          seatArray[colIdx] = 'off';
        } else if (seat.seatType === 'COUPLE') {
          seatArray[colIdx] = 'couple';
        } else if (seat.seatType === 'VIP') {
          seatArray[colIdx] = 'vip';
        } else {
          seatArray[colIdx] = 'std';
        }
      }
    });

    rows.push({
      label,
      seats: seatArray
    });
  });

  return rows.length > 0 ? rows : generateDefaultRows(rowCount || 8, columnCount || 10);
}

// Format number in Vietnamese currency
function formatVnd(val) {
  return (Number(val) || 0).toLocaleString('vi-VN') + 'đ';
}

export default function AdminRoomsPanel({ ctx }) {
  const { getAdminToken, showToast: ctxToast, addAuditLog } = ctx;
  const getTokenRef = useRef(getAdminToken);
  useEffect(() => { getTokenRef.current = getAdminToken; }, [getAdminToken]);

  // Data states
  const [rooms, setRooms] = useState([]);
  const [selectedRoomId, setSelectedRoomId] = useState(null);
  const [isLoadingRooms, setIsLoadingRooms] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Editor states
  const [roomName, setRoomName] = useState('');
  const [roomType, setRoomType] = useState('STANDARD');
  const [floorNumber, setFloorNumber] = useState(1);
  const [roomActive, setRoomActive] = useState(true);
  const [aisleIndex, setAisleIndex] = useState(0);
  const [defaultCols, setDefaultCols] = useState(10);
  const [rows, setRows] = useState([]);
  const [prices, setPrices] = useState(DEFAULT_PRICES);

  // Interaction states
  const [brush, setBrush] = useState('std');
  const [dirty, setDirty] = useState(false);
  const [history, setHistory] = useState([]);
  const [activeTab, setActiveTab] = useState(0); // 0: Thông tin, 1: Hàng ghế, 2: Giá vé
  const [selectedRowIndex, setSelectedRowIndex] = useState(null);
  const [selectedSeatCoord, setSelectedSeatCoord] = useState(null);
  const isPaintingRef = useRef(false);

  // Modals & feedback
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [addModalForm, setAddModalForm] = useState({
    name: '',
    roomType: 'STANDARD',
    floor: 1,
    rowCount: 8,
    colCount: 10
  });
  const [confirmDialog, setConfirmDialog] = useState(null);
  const [localToast, setLocalToast] = useState(null);

  const showToast = useCallback((message, type = 'success') => {
    setLocalToast({ type, message });
    if (ctxToast) ctxToast(message, type);
    setTimeout(() => {
      setLocalToast(prev => (prev?.message === message ? null : prev));
    }, 2800);
  }, [ctxToast]);

  const currentRoom = useMemo(() => {
    return rooms.find(r => r.id === selectedRoomId) || null;
  }, [rooms, selectedRoomId]);

  // Filtered rooms list by search query
  const filteredRooms = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return rooms;
    return rooms.filter(r => (r.name || '').toLowerCase().includes(q));
  }, [rooms, searchQuery]);

  // Statistics calculation for the current editor rows
  const stats = useMemo(() => {
    let std = 0, vip = 0, couple = 0;
    rows.forEach(rw => {
      rw.seats.forEach(s => {
        if (s === 'std') std++;
        else if (s === 'vip') vip++;
        else if (s === 'couple') couple++;
      });
    });
    const total = std + vip + couple;
    const capacity = std + vip + couple * 2;
    const maxRev = (std * prices.std) + (vip * prices.vip) + (couple * prices.couple);
    return { std, vip, couple, total, capacity, maxRev };
  }, [rows, prices]);

  // Snapshot rows state for Undo (max 50)
  const pushHistory = useCallback(() => {
    setHistory(prev => {
      const next = [...prev, JSON.stringify(rows)];
      if (next.length > 50) next.shift();
      return next;
    });
  }, [rows]);

  const markDirty = useCallback(() => {
    setDirty(true);
  }, []);

  // Initialize room data when selecting a room
  const loadRoomIntoEditor = useCallback(async (room) => {
    if (!room) return;
    const token = getTokenRef.current?.();
    setRoomName(room.name || '');
    setRoomType(room.roomType || 'STANDARD');
    setFloorNumber(1);
    setRoomActive(room.status === 'ACTIVE');
    setAisleIndex(0);
    setDefaultCols(room.columnCount || 10);
    setHistory([]);
    setSelectedRowIndex(null);
    setSelectedSeatCoord(null);
    setDirty(false);

    try {
      if (token) {
        const backendSeats = await adminService.getAdminRoomSeats(token, room.id);
        const mappedRows = mapBackendSeatsToRows(backendSeats, room.rowCount, room.columnCount);
        setRows(mappedRows);
      } else {
        setRows(generateDefaultRows(room.rowCount || 8, room.columnCount || 10));
      }
    } catch (err) {
      console.warn('Failed to load room seats:', err);
      setRows(generateDefaultRows(room.rowCount || 8, room.columnCount || 10));
    }
  }, []);

  // Fetch all rooms from API
  const fetchRooms = useCallback(async (preferredId = null) => {
    const token = getTokenRef.current?.();
    if (!token) return;
    setIsLoadingRooms(true);
    try {
      const data = await adminService.getAdminRooms(token);
      const list = Array.isArray(data) ? data : (data?.items || data?.content || []);
      setRooms(list);

      const targetId = preferredId || (list.some(r => r.id === selectedRoomId) ? selectedRoomId : list[0]?.id || null);
      if (targetId) {
        setSelectedRoomId(targetId);
        const targetRoom = list.find(r => r.id === targetId);
        if (targetRoom) {
          await loadRoomIntoEditor(targetRoom);
        }
      }
    } catch (err) {
      showToast(err.message || 'Không thể tải danh sách phòng chiếu.', 'error');
    } finally {
      setIsLoadingRooms(false);
    }
  }, [loadRoomIntoEditor, selectedRoomId, showToast]);

  useEffect(() => {
    fetchRooms();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Warn on page unload if changes are unsaved
  useEffect(() => {
    const handleBeforeUnload = (e) => {
      if (dirty) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [dirty]);

  // Global keyboard shortcuts (1, 2, 3, 4, 5, Delete, Ctrl+Z, Ctrl+S)
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.target.matches('input, select, textarea')) return;
      if (e.key === '1') setBrush('std');
      else if (e.key === '2') setBrush('vip');
      else if (e.key === '3') setBrush('couple');
      else if (e.key === '4') setBrush('off');
      else if (e.key === '5') setBrush('delete_seat');

      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedSeatCoord) {
        deleteSingleSeat(selectedSeatCoord.r, selectedSeatCoord.s);
      }

      if ((e.ctrlKey || e.metaKey) && (e.key === 'z' || e.key === 'Z')) {
        e.preventDefault();
        handleUndo();
      }
      if ((e.ctrlKey || e.metaKey) && (e.key === 's' || e.key === 'S')) {
        e.preventDefault();
        handleSaveAll();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  });

  // ==========================================
  // SEAT PAINTING & EDITING LOGIC
  // ==========================================
  const deleteSingleSeat = (rIdx, sIdx) => {
    if (!rows[rIdx] || rows[rIdx].seats.length <= 1) {
      showToast('Hàng ghế cần có ít nhất 1 ghế. Nếu muốn xóa cả hàng hãy dùng nút Xóa hàng ở cột bên phải.', 'warning');
      return;
    }
    pushHistory();
    const targetSeatNumber = sIdx + 1;
    setRows(prevRows => prevRows.map((row, i) => {
      if (i !== rIdx) return row;
      const nextSeats = row.seats.filter((_, idx) => idx !== sIdx);
      return { ...row, seats: nextSeats };
    }));
    setSelectedSeatCoord(null);
    markDirty();
    showToast(`Đã xóa ghế ${rows[rIdx]?.label}${targetSeatNumber}, các ghế phía sau đã được dồn lên.`);
  };

  const paintSingleSeat = (rIdx, sIdx) => {
    if (!rows[rIdx] || rows[rIdx].seats[sIdx] === brush) return;
    setRows(prevRows => {
      const next = prevRows.map((row, i) => {
        if (i !== rIdx) return row;
        const newSeats = [...row.seats];
        newSeats[sIdx] = brush;
        return { ...row, seats: newSeats };
      });
      return next;
    });
    markDirty();
  };

  const handlePointerDownSeat = (rIdx, sIdx) => {
    if (brush === 'delete_seat') {
      deleteSingleSeat(rIdx, sIdx);
      return;
    }
    pushHistory();
    isPaintingRef.current = true;
    setSelectedSeatCoord({ r: rIdx, s: sIdx });
    paintSingleSeat(rIdx, sIdx);
  };

  const handlePointerEnterSeat = (rIdx, sIdx) => {
    if (brush === 'delete_seat') return;
    if (isPaintingRef.current) {
      paintSingleSeat(rIdx, sIdx);
    }
  };

  useEffect(() => {
    const stopPainting = () => {
      isPaintingRef.current = false;
    };
    window.addEventListener('pointerup', stopPainting);
    return () => window.removeEventListener('pointerup', stopPainting);
  }, []);

  const handlePaintRow = (rIdx) => {
    if (brush === 'delete_seat') {
      showToast('Để xóa cả hàng ghế, vui lòng dùng nút xóa hàng (icon thùng rác) ở cột bên phải.', 'warning');
      return;
    }
    pushHistory();
    setRows(prev => prev.map((row, i) => {
      if (i !== rIdx) return row;
      return { ...row, seats: row.seats.map(() => brush) };
    }));
    setSelectedRowIndex(rIdx);
    markDirty();
  };

  const handleUndo = () => {
    if (history.length === 0) return;
    setHistory(prev => {
      const copy = [...prev];
      const last = copy.pop();
      if (last) {
        try {
          setRows(JSON.parse(last));
          markDirty();
        } catch (err) {
          console.warn('Undo failed to parse state:', err);
        }
      }
      return copy;
    });
  };

  const handleResetLayout = () => {
    setConfirmDialog({
      title: 'Tạo lại sơ đồ ghế mặc định?',
      description: 'Toàn bộ ghế sẽ được đưa về ghế Tiêu chuẩn. Các thay đổi chưa lưu sẽ bị ghi đè.',
      onConfirm: () => {
        pushHistory();
        setRows(generateDefaultRows(rows.length, defaultCols, 'std'));
        markDirty();
        showToast('Đã đưa sơ đồ về trạng thái mặc định');
      }
    });
  };

  // Row manipulation in Tab 1
  const handleSetRowCount = (count) => {
    const n = Math.min(26, Math.max(1, Number(count) || 1));
    pushHistory();
    setRows(prev => {
      const next = [...prev];
      while (next.length < n) {
        const nextLetter = ROW_LETTERS[next.length] || `R${next.length + 1}`;
        next.push({ label: nextLetter, seats: Array(defaultCols).fill('std') });
      }
      return next.slice(0, n);
    });
    markDirty();
  };

  const handleSetColCount = (count) => {
    const c = Math.min(30, Math.max(1, Number(count) || 1));
    setDefaultCols(c);
    pushHistory();
    setRows(prev => prev.map(row => {
      const nextSeats = [...row.seats];
      while (nextSeats.length < c) nextSeats.push('std');
      return { ...row, seats: nextSeats.slice(0, c) };
    }));
    markDirty();
  };

  const handleAddRow = () => {
    if (rows.length >= 26) {
      showToast('Đã đạt giới hạn tối đa 26 hàng ghế (A-Z).', 'warning');
      return;
    }
    pushHistory();
    const nextLetter = ROW_LETTERS[rows.length] || `R${rows.length + 1}`;
    setRows(prev => [...prev, { label: nextLetter, seats: Array(defaultCols).fill('std') }]);
    markDirty();
    showToast(`Đã thêm hàng ${nextLetter}`);
  };

  const handleDeleteRow = (rIdx) => {
    if (rows.length <= 1) {
      showToast('Phòng chiếu phải có ít nhất 1 hàng ghế.', 'warning');
      return;
    }
    pushHistory();
    setRows(prev => {
      const next = prev.filter((_, i) => i !== rIdx);
      // Auto-relabel A, B, C...
      return next.map((row, i) => ({
        ...row,
        label: ROW_LETTERS[i] || `R${i + 1}`
      }));
    });
    setSelectedRowIndex(null);
    markDirty();
    showToast('Đã xóa hàng ghế và đánh lại chữ cái hàng');
  };

  const handleRowColChange = (rIdx, count) => {
    const c = Math.min(30, Math.max(1, Number(count) || 1));
    pushHistory();
    setRows(prev => prev.map((row, i) => {
      if (i !== rIdx) return row;
      const nextSeats = [...row.seats];
      while (nextSeats.length < c) nextSeats.push('std');
      return { ...row, seats: nextSeats.slice(0, c) };
    }));
    markDirty();
  };

  const handleRowTypeChange = (rIdx, type) => {
    pushHistory();
    setRows(prev => prev.map((row, i) => {
      if (i !== rIdx) return row;
      let nextSeats = [...row.seats];
      if (type === 'couple' && row.seats.length === defaultCols && defaultCols >= 4) {
        const pairCount = Math.floor(defaultCols / 2);
        nextSeats = Array(pairCount).fill('couple');
      } else if (type !== 'couple' && row.seats.length === Math.floor(defaultCols / 2)) {
        nextSeats = Array(defaultCols).fill(type);
      } else {
        nextSeats = row.seats.map(s => s === 'off' ? 'off' : type);
      }
      return { ...row, seats: nextSeats };
    }));
    markDirty();
  };

  // Switch Room with safety confirmation
  const handleSelectRoom = (room) => {
    if (room.id === selectedRoomId) return;
    if (dirty) {
      setConfirmDialog({
        title: 'Có thay đổi chưa lưu!',
        description: `Bạn đang có chỉnh sửa chưa lưu tại phòng "${currentRoom?.name}". Nếu chuyển sang "${room.name}", các thay đổi này sẽ bị hủy.`,
        onConfirm: () => {
          setSelectedRoomId(room.id);
          loadRoomIntoEditor(room);
        }
      });
      return;
    }
    setSelectedRoomId(room.id);
    loadRoomIntoEditor(room);
  };

  // ==========================================
  // SAVE, CREATE & DELETE ACTIONS
  // ==========================================
  const handleSaveAll = async () => {
    if (!currentRoom) return;
    const cleanName = roomName.trim();
    if (!cleanName) {
      showToast('Vui lòng nhập tên phòng chiếu.', 'warning');
      return;
    }
    const token = getTokenRef.current?.();
    if (!token) {
      showToast('Phiên làm việc hết hạn. Vui lòng đăng nhập lại.', 'error');
      return;
    }

    setIsSaving(true);
    try {
      // 1. Update basic room info
      const maxCols = Math.max(
        defaultCols,
        ...rows.map(r => r.seats.reduce((sum, s) => sum + (s === 'couple' ? 2 : 1), 0))
      );
      const roomPayload = {
        name: cleanName,
        roomType: roomType,
        rowCount: rows.length,
        columnCount: maxCols,
        status: roomActive ? 'ACTIVE' : 'INACTIVE'
      };
      await adminService.updateAdminRoom(token, currentRoom.id, roomPayload);

      // 2. Prepare SeatLayoutRequest for backend
      const normalizedRows = rows.map((row, idx) => {
        let seatNum = 0;
        let currentDisplayCol = 0;
        const validSeatNumbers = [];
        const seatTypes = [];
        const displayColumns = [];

        row.seats.forEach(s => {
          if (s === 'off') {
            currentDisplayCol++;
            return;
          }

          if (s === 'couple') {
            currentDisplayCol++;
            seatNum++;
            validSeatNumbers.push(seatNum);
            seatTypes.push('COUPLE');
            displayColumns.push(currentDisplayCol);

            currentDisplayCol++;
            seatNum++;
            validSeatNumbers.push(seatNum);
            seatTypes.push('COUPLE');
            displayColumns.push(currentDisplayCol);
          } else {
            currentDisplayCol++;
            seatNum++;
            validSeatNumbers.push(seatNum);
            seatTypes.push(s === 'vip' ? 'VIP' : 'STANDARD');
            displayColumns.push(currentDisplayCol);
          }
        });

        // Determine majority seatType for this row
        const rowTypes = row.seats.filter(s => s !== 'off');
        const coupleCount = rowTypes.filter(s => s === 'couple').length;
        const vipCount = rowTypes.filter(s => s === 'vip').length;
        let mainType = 'STANDARD';
        if (coupleCount > 0 && coupleCount >= rowTypes.length / 2) {
          mainType = 'COUPLE';
        } else if (vipCount > 0 && vipCount >= rowTypes.length / 2) {
          mainType = 'VIP';
        }

        return {
          rowLabel: row.label.toUpperCase(),
          displayOrder: idx + 1,
          startColumn: displayColumns[0] || 1,
          seatType: mainType,
          seatNumbers: validSeatNumbers.length > 0 ? validSeatNumbers : [1],
          seatTypes: seatTypes.length > 0 ? seatTypes : [mainType],
          displayColumns: displayColumns.length > 0 ? displayColumns : [1]
        };
      });

      const seatLayoutPayload = {
        defaultSeatType: 'STANDARD',
        rows: normalizedRows
      };

      // 3. Save / replace seat layout in backend
      await adminService.replaceAdminRoomSeats(token, currentRoom.id, seatLayoutPayload);

      setDirty(false);
      setHistory([]);
      addAuditLog?.('Cập nhật phòng & sơ đồ ghế', `${cleanName} (${stats.total} ghế)`);
      showToast(`✓ Đã lưu thay đổi cho "${cleanName}" thành công!`, 'success');

      // Refresh data
      await fetchRooms(currentRoom.id);
    } catch (err) {
      console.error('Save room error:', err);
      showToast(err.message || 'Không thể lưu thay đổi phòng chiếu.', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDiscardChanges = () => {
    if (!currentRoom) return;
    setConfirmDialog({
      title: 'Hủy lưu thay đổi?',
      description: `Khôi phục toàn bộ sơ đồ ghế và thông tin phòng "${currentRoom.name}" về dữ liệu ban đầu trước khi sửa?`,
      confirmLabel: 'Hủy thay đổi',
      onConfirm: async () => {
        setIsSaving(true);
        try {
          await loadRoomIntoEditor(currentRoom);
          showToast('Đã hủy các thay đổi và khôi phục trạng thái ban đầu.', 'info');
        } catch (err) {
          console.error('Discard changes error:', err);
          showToast('Không thể khôi phục trạng thái phòng.', 'error');
        } finally {
          setIsSaving(false);
        }
      }
    });
  };

  const handleToggleRoomActive = () => {
    setRoomActive(prev => !prev);
    markDirty();
  };

  const handleDeleteRoom = () => {
    if (!currentRoom) return;
    if (rooms.length <= 1) {
      showToast('Không thể xóa hoặc tạm ngừng phòng chiếu duy nhất còn lại.', 'warning');
      return;
    }

    setConfirmDialog({
      title: `Tạm ngừng / vô hiệu hóa "${currentRoom.name}"?`,
      description: 'Phòng chiếu sẽ được chuyển sang trạng thái Tạm Ngừng (INACTIVE) và không thể mở suất chiếu mới.',
      onConfirm: async () => {
        const token = getTokenRef.current?.();
        if (!token) return;
        setIsSaving(true);
        try {
          await adminService.updateAdminRoomStatus(token, currentRoom.id, 'INACTIVE');
          addAuditLog?.('Tạm ngừng phòng chiếu', currentRoom.name);
          showToast(`Đã chuyển "${currentRoom.name}" sang trạng thái tạm ngừng.`, 'success');
          await fetchRooms();
        } catch (err) {
          showToast(err.message || 'Không thể đổi trạng thái phòng.', 'error');
        } finally {
          setIsSaving(false);
        }
      }
    });
  };

  const handleOpenAddModal = () => {
    setAddModalForm({
      name: `Phòng ${String(rooms.length + 1).padStart(2, '0')}`,
      roomType: 'STANDARD',
      floor: 1,
      rowCount: 8,
      colCount: 10
    });
    setIsAddModalOpen(true);
  };

  const handleCreateRoom = async () => {
    const cleanName = addModalForm.name.trim();
    if (!cleanName) {
      showToast('Vui lòng nhập tên phòng.', 'warning');
      return;
    }
    const token = getTokenRef.current?.();
    if (!token) return;

    setIsSaving(true);
    try {
      const payload = {
        name: cleanName,
        roomType: addModalForm.roomType,
        rowCount: Number(addModalForm.rowCount) || 8,
        columnCount: Number(addModalForm.colCount) || 10,
        status: 'ACTIVE'
      };

      const newRoom = await adminService.createAdminRoom(token, payload);
      const initialLayout = {
        defaultSeatType: 'STANDARD',
        rows: generateDefaultRows(payload.rowCount, payload.columnCount, 'std').map((r, i) => ({
          rowLabel: r.label,
          displayOrder: i + 1,
          startColumn: 1,
          seatType: 'STANDARD',
          seatNumbers: Array.from({ length: payload.columnCount }, (_, k) => k + 1)
        }))
      };

      try {
        await adminService.createAdminRoomSeats(token, newRoom.id, initialLayout);
      } catch (seatErr) {
        console.warn('Initial seat generation note:', seatErr);
      }

      setIsAddModalOpen(false);
      addAuditLog?.('Tạo phòng chiếu mới', newRoom.name);
      showToast(`Đã tạo thành công "${newRoom.name}"!`, 'success');
      await fetchRooms(newRoom.id);
    } catch (err) {
      showToast(err.message || 'Không thể tạo phòng chiếu mới.', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-80px)] min-h-[640px] bg-[#07090c] text-[#f5f5f5] font-sans antialiased overflow-hidden select-none -m-5 sm:-m-6">
      {/* =========================================================================
          TOPBAR (HEADER) — 56-60px height, cinema style, all sharp square corners
          ========================================================================= */}
      <header className="h-14 sm:h-[58px] bg-[#0c0f13] border-b border-[#24282f] px-4 sm:px-6 flex items-center justify-between gap-3 shrink-0 shadow-md z-20">
        <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
          <div className="w-8 h-8 rounded-none bg-amber-500/10 border border-amber-500/25 flex items-center justify-center text-[#f5b800] shrink-0 shadow-inner">
            <Film className="w-4 h-4" />
          </div>
          <div className="flex items-center gap-2 truncate">
            <span className="font-mono text-xs sm:text-sm font-black tracking-widest text-[#f5f5f5] uppercase">
              PHÒNG CHIẾU
            </span>
            <span className="text-[#555b64] font-semibold text-xs">/</span>
            <span className="text-[#8b9098] font-bold text-xs truncate">
              {currentRoom?.name || '—'}
            </span>
            {dirty && (
              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-none bg-amber-500/10 border border-amber-500/30 text-[#f5b800] text-[10px] font-bold uppercase tracking-wider shrink-0 ml-1">
                <span className="w-1.5 h-1.5 rounded-none bg-[#f5b800] animate-pulse" />
                Chưa lưu
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 sm:gap-2.5 shrink-0">
          <button
            type="button"
            onClick={handleOpenAddModal}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-none border border-amber-500/30 bg-[#101318] hover:bg-amber-500/10 hover:border-amber-500/60 text-[#f5b800] text-xs font-bold uppercase tracking-wider transition"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Thêm phòng</span>
          </button>

          {dirty && (
            <button
              type="button"
              onClick={handleDiscardChanges}
              disabled={isSaving}
              className="inline-flex items-center gap-1.5 px-3 sm:px-3.5 py-2 rounded-none border border-neutral-700/80 bg-[#161b22] hover:bg-[#21262d] hover:border-neutral-500 text-neutral-300 hover:text-white text-xs font-bold uppercase tracking-wider transition-all disabled:opacity-50"
              title="Hủy các thay đổi chưa lưu và khôi phục dữ liệu ban đầu"
            >
              <RotateCcw className="w-3.5 h-3.5 text-neutral-400" />
              <span>Hủy lưu</span>
            </button>
          )}

          <button
            type="button"
            onClick={handleSaveAll}
            disabled={isSaving}
            className="inline-flex items-center gap-2 px-4 sm:px-5 py-2 rounded-none bg-[#f5b800] hover:bg-[#ffc933] active:bg-[#d99f00] text-[#090909] text-xs font-black uppercase tracking-wider shadow-lg shadow-amber-500/20 hover:shadow-amber-500/30 transition-all disabled:opacity-50"
          >
            {isSaving ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Save className="w-3.5 h-3.5" />
            )}
            <span>Lưu thay đổi</span>
          </button>
        </div>
      </header>

      {/* =========================================================================
          MAIN 3-COLUMN WORKSPACE: 250px | 1fr | 300px (SQUARE CORNERS)
          ========================================================================= */}
      <main className="flex-1 grid grid-cols-1 lg:grid-cols-[250px_1fr] xl:grid-cols-[250px_1fr_300px] gap-3.5 p-3.5 min-h-0 overflow-hidden">
        {/* =========================================================================
            LEFT COLUMN: ROOM SIDEBAR (Danh sách phòng)
            ========================================================================= */}
        <section className="bg-[#101318] border border-[#24282f] rounded-none flex flex-col min-h-0 shadow-[0_8px_24px_rgba(0,0,0,0.25)] overflow-hidden">
          <div className="p-3.5 border-b border-[#24282f] flex items-center justify-between shrink-0">
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-[#f5f5f5]">
                Danh sách phòng
              </h3>
              <p className="text-[11px] text-[#8b9098] mt-0.5">
                {rooms.length} phòng • {rooms.reduce((acc, r) => acc + (r.rowCount * r.columnCount || 0), 0)} ghế lý thuyết
              </p>
            </div>
            <button
              type="button"
              onClick={() => fetchRooms(selectedRoomId)}
              title="Làm mới danh sách"
              className="p-1.5 rounded-none text-[#8b9098] hover:text-white hover:bg-white/5 transition"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="p-3 flex-1 flex flex-col min-h-0">
            {/* Search Input */}
            <div className="relative mb-2.5 shrink-0">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-[#555b64]" />
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Tìm phòng..."
                className="w-full bg-[#080a0d] border border-[#252a31] focus:border-[#f5b800] focus:ring-1 focus:ring-[#f5b800]/25 rounded-none pl-8 pr-3 py-1.5 text-xs text-white placeholder-[#5d626a] outline-none transition"
              />
            </div>

            {/* Room List Scrollable */}
            <div className="flex-1 overflow-y-auto space-y-1 pr-1 custom-dark-scrollbar">
              {isLoadingRooms && (
                <div className="flex justify-center items-center py-10">
                  <Loader2 className="w-5 h-5 animate-spin text-[#f5b800]" />
                </div>
              )}

              {!isLoadingRooms && filteredRooms.length === 0 && (
                <div className="text-center py-8 text-xs text-[#555b64]">
                  Không tìm thấy phòng phù hợp.
                </div>
              )}

              {filteredRooms.map(r => {
                const isSelected = r.id === selectedRoomId;
                const isActive = r.status === 'ACTIVE';
                const avatarCode = r.name.replace(/\D/g, '').slice(-2) || r.name.slice(0, 2).toUpperCase();

                return (
                  <div
                    key={r.id}
                    onClick={() => handleSelectRoom(r)}
                    className={`group relative p-2.5 rounded-none cursor-pointer transition-all duration-150 flex items-center gap-2.5 border ${
                      isSelected
                        ? 'bg-gradient-to-r from-amber-500/15 via-amber-500/5 to-transparent border-[#a87900] border-l-[3px] border-l-[#f5b800] shadow-sm'
                        : 'bg-transparent border-transparent hover:bg-[#11151a] hover:border-[#24282f]'
                    }`}
                  >
                    {/* Room Avatar */}
                    <div
                      className={`w-9 h-9 rounded-none flex items-center justify-center font-mono font-bold text-xs shrink-0 transition ${
                        isSelected
                          ? 'bg-[#f5b800]/20 text-[#f5b800] border border-[#f5b800]/40 shadow-inner'
                          : 'bg-[#15181d] text-[#8b9098] border border-[#24282f] group-hover:text-white'
                      }`}
                    >
                      {avatarCode}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 truncate">
                        <span className={`text-xs font-bold truncate ${isSelected ? 'text-[#f5f5f5]' : 'text-[#d5d8dc]'}`}>
                          {r.name}
                        </span>
                        <span className="text-[10px] px-1.5 py-0.2 rounded-none bg-white/5 border border-white/10 text-[#8b9098] font-mono shrink-0">
                          {r.roomType || '2D'}
                        </span>
                      </div>
                      <div className="text-[11px] text-[#8b9098] mt-0.5 flex items-center gap-1.5 truncate">
                        <span className={`w-1.5 h-1.5 rounded-none shrink-0 ${isActive ? 'bg-[#00d68f]' : 'bg-[#555b64]'}`} />
                        <span>{r.rowCount} hàng • {r.rowCount * r.columnCount} ghế</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* =========================================================================
            CENTER COLUMN: SEAT EDITOR (Stage & Interactive Seat Grid)
            ========================================================================= */}
        <section className="bg-[#101318] border border-[#24282f] rounded-none flex flex-col min-h-0 shadow-[0_8px_24px_rgba(0,0,0,0.25)] overflow-hidden relative">
          {/* TOOLBAR */}
          <div className="h-11 bg-[#0c0f13] border-b border-[#24282f] px-3.5 flex items-center gap-2 shrink-0 flex-wrap">
            <span className="text-[11px] font-bold text-[#8b9098] uppercase tracking-wider mr-1">
              Bút vẽ:
            </span>

            {/* Brush Buttons */}
            {Object.values(BRUSHES).map(b => {
              const isActive = brush === b.id;
              const isDelete = b.id === 'delete_seat';
              return (
                <button
                  key={b.id}
                  type="button"
                  onClick={() => setBrush(b.id)}
                  title={isDelete ? 'Bút xóa ghế: click ghế để xóa và dồn hàng (Phím 5)' : `Bút ${b.name}`}
                  className={`flex items-center gap-1.5 px-2.5 py-1 rounded-none text-xs font-semibold border transition-all ${
                    isActive
                      ? isDelete
                        ? 'border-rose-500 bg-rose-500/15 text-rose-400 shadow-[0_0_8px_rgba(244,63,94,0.25)] ring-1 ring-rose-500/40'
                        : 'border-[#f5b800] bg-[#f5b800]/10 text-[#f5b800] shadow-[0_0_8px_rgba(245,184,0,0.15)] ring-1 ring-[#f5b800]/40'
                      : isDelete
                        ? 'border-rose-500/40 bg-rose-950/20 text-rose-300 hover:border-rose-500 hover:bg-rose-500/20'
                        : 'border-[#2a2f36] bg-[#11151a] text-[#c3c7cd] hover:border-[#3a3f47] hover:text-white'
                  }`}
                >
                  {isDelete ? (
                    <Eraser className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                  ) : (
                    <span
                      className="w-2.5 h-2.5 rounded-none shrink-0"
                      style={{
                        backgroundColor: b.id === 'off' ? 'transparent' : b.border,
                        border: b.id === 'off' ? '1.5px dashed #40464f' : 'none'
                      }}
                    />
                  )}
                  <span>{b.name}</span>
                </button>
              );
            })}

            <div className="w-[1px] h-4 bg-[#24282f] mx-1 shrink-0" />

            {/* Undo & Reset Buttons */}
            <button
              type="button"
              onClick={handleUndo}
              disabled={history.length === 0}
              title="Hoàn tác (Ctrl+Z)"
              className="flex items-center gap-1 px-2.5 py-1 rounded-none text-xs font-semibold border border-[#2a2f36] bg-[#11151a] text-[#c3c7cd] hover:text-white hover:border-[#3a3f47] disabled:opacity-40 disabled:cursor-not-allowed transition"
            >
              <Undo2 className="w-3 h-3" />
              <span>Hoàn tác</span>
            </button>

            <button
              type="button"
              onClick={handleResetLayout}
              title="Tạo lại sơ đồ ghế mặc định"
              className="flex items-center gap-1 px-2.5 py-1 rounded-none text-xs font-semibold border border-[#2a2f36] bg-[#11151a] text-[#c3c7cd] hover:text-white hover:border-[#3a3f47] transition"
            >
              <RotateCcw className="w-3 h-3" />
              <span>Tạo lại</span>
            </button>

            {selectedSeatCoord && (
              <button
                type="button"
                onClick={() => deleteSingleSeat(selectedSeatCoord.r, selectedSeatCoord.s)}
                title="Xóa ghế đang chọn và dồn các ghế sau lên (Phím Delete)"
                className="flex items-center gap-1 px-2.5 py-1 rounded-none text-xs font-semibold border border-rose-500/50 bg-rose-500/15 text-rose-300 hover:bg-rose-500/25 hover:border-rose-400 transition ml-1"
              >
                <Trash2 className="w-3 h-3 text-rose-400" />
                <span>Xóa ghế đang chọn</span>
              </button>
            )}

            <div className="flex-1" />

            {dirty && (
              <span className="text-[11px] font-bold text-[#f5b800] flex items-center gap-1">
                ● Chưa lưu
              </span>
            )}
          </div>

          {/* STAGE & SCREEN & SEAT GRID */}
          <div
            className="flex-1 overflow-auto p-6 sm:p-8 flex flex-col items-center justify-start custom-dark-scrollbar relative"
            style={{
              background: `radial-gradient(ellipse at 50% 0%, rgba(245,184,0,0.06), transparent 50%), #080a0d`,
              backgroundImage: `radial-gradient(ellipse at 50% 0%, rgba(245,184,0,0.06), transparent 50%), repeating-linear-gradient(0deg, transparent 0 23px, rgba(255,255,255,0.012) 23px 24px), repeating-linear-gradient(90deg, transparent 0 23px, rgba(255,255,255,0.012) 23px 24px)`
            }}
          >
            {/* Cinema Screen */}
            <div className="w-[min(76%,540px)] mb-2 flex flex-col items-center shrink-0">
              <div
                className="w-full h-2 rounded-none shadow-[0_8px_30px_rgba(245,184,0,0.22)]"
                style={{
                  background: 'linear-gradient(90deg, transparent, #c69100, #f5b800, #ffe082, #f5b800, #c69100, transparent)'
                }}
              />
              <span className="text-[11px] font-sans font-bold text-[#c9a94e] tracking-[0.25em] uppercase mt-2.5 mb-6 text-center whitespace-nowrap">
                MÀN HÌNH CHIẾU
              </span>
            </div>

            {/* Seat Grid */}
            <div
              className="flex flex-col select-none pb-6"
              style={{
                '--seat-w': '32px',
                '--seat-h': '28px',
                '--seat-gap': '6px',
                '--couple-w': 'calc(var(--seat-w) * 2 + var(--seat-gap))', // Exactly 70px: 2 seats + gap
                '--aisle-w': '16px',
                gap: '8px'
              }}
            >
              {rows.map((row, rIdx) => {
                let seatCount = 0;
                const isRowSelected = selectedRowIndex === rIdx;

                return (
                  <div key={row.label || rIdx} className="flex items-center" style={{ gap: '8px' }}>
                    {/* Row Label (Click to paint entire row) */}
                    <button
                      type="button"
                      title="Click để đổi cả hàng theo bút vẽ"
                      onClick={() => handlePaintRow(rIdx)}
                      style={{ width: 'var(--seat-w)', height: 'var(--seat-h)' }}
                      className={`rounded-none font-mono text-xs font-bold border transition flex items-center justify-center shrink-0 ${
                        isRowSelected
                          ? 'bg-[#f5b800] text-[#090909] border-[#f5b800] shadow-[0_0_8px_rgba(245,184,0,0.4)]'
                          : 'bg-[#101318] text-[#d5d8dc] border-[#30353d] hover:border-[#f5b800] hover:text-[#f5b800]'
                      }`}
                    >
                      {row.label}
                    </button>

                    {/* Seats in this row */}
                    <div className="flex items-center shrink-0" style={{ gap: 'var(--seat-gap)' }}>
                      {(() => {
                        let accumulatedCols = 0;
                        return row.seats.map((seatType, sIdx) => {
                          const isOff = seatType === 'off';
                          const isVip = seatType === 'vip';
                          const isCouple = seatType === 'couple';

                          // Numbering: skips 'off' seats
                          const num = isOff ? null : ++seatCount;

                          // Insert aisle gap if configured
                          const showAisle = aisleIndex > 0 && accumulatedCols === aisleIndex && sIdx > 0;
                          accumulatedCols += isCouple ? 2 : 1;

                          const isSeatSelected = selectedSeatCoord?.r === rIdx && selectedSeatCoord?.s === sIdx;

                          return (
                            <React.Fragment key={sIdx}>
                              {showAisle && (
                                <div style={{ width: 'var(--aisle-w)' }} className="shrink-0 pointer-events-none" aria-hidden="true" />
                              )}
                              <div
                                title={`${row.label}${num || ''} • ${BRUSHES[seatType]?.name || 'Ghế'}`}
                                onPointerDown={() => handlePointerDownSeat(rIdx, sIdx)}
                                onPointerEnter={() => handlePointerEnterSeat(rIdx, sIdx)}
                                className={`rounded-none text-[10.5px] font-mono font-bold flex items-center justify-center cursor-pointer transition-transform duration-75 relative shrink-0 ${
                                  isSeatSelected
                                    ? 'ring-2 ring-[#f5b800] shadow-[0_0_10px_rgba(245,184,0,0.5)] z-10 scale-105'
                                    : 'hover:-translate-y-0.5'
                                }`}
                                style={{
                                  width: isCouple ? 'var(--couple-w)' : 'var(--seat-w)',
                                  height: 'var(--seat-h)',
                                  backgroundColor: isOff ? 'transparent' : isCouple ? '#831843' : isVip ? 'rgba(245,184,0,0.14)' : '#161b20',
                                  border: isOff ? '1.5px dashed #40464f' : isCouple ? '1.5px solid #ec4899' : isVip ? '1.5px solid #f5b800' : '1.5px solid #697078',
                                  color: isOff ? '#555555' : isCouple ? '#f9a8d4' : isVip ? '#ffc400' : '#e5e7eb'
                                }}
                              >
                                {num || (isOff ? '·' : '')}
                              </div>
                            </React.Fragment>
                          );
                        });
                      })()}
                    </div>

                    {/* Right side row summary count */}
                    <span className="w-12 pl-2 text-[11px] font-mono text-[#8b9098] shrink-0 text-left">
                      {seatCount} ghế
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* LEGEND */}
          <div className="border-t border-[#24282f] bg-[#0c0f13] px-4 py-2 flex items-center justify-center gap-4 sm:gap-6 flex-wrap text-xs text-[#9ca3af] shrink-0">
            <span className="flex items-center gap-1.5">
              <span className="w-3.5 h-3 rounded-none bg-[#161b20] border border-[#697078]" />
              Ghế thường
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-3.5 h-3 rounded-none bg-amber-500/15 border border-[#f5b800]" />
              VIP
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-7 h-3 rounded-none bg-[#831843] border border-[#ec4899]" />
              Ghế đôi
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-3.5 h-3 rounded-none border border-dashed border-[#40464f]" />
              Trống / lối đi
            </span>
          </div>

          {/* STATS (4 BLOCKS) */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 p-3 sm:p-3.5 border-t border-[#24282f] bg-[#0c0f13] shrink-0">
            <div className="bg-[#11151a] border border-[#24282f] rounded-none p-2.5">
              <span className="block text-[10px] font-bold uppercase text-[#8b9098]">Tổng ghế</span>
              <b className="text-lg font-mono font-black text-white">{stats.total}</b>
            </div>
            <div className="bg-[#11151a] border border-[#24282f] rounded-none p-2.5">
              <span className="block text-[10px] font-bold uppercase text-[#8b9098]">Thường</span>
              <b className="text-lg font-mono font-black text-[#e5e7eb]">{stats.std}</b>
            </div>
            <div className="bg-[#11151a] border border-[#24282f] rounded-none p-2.5">
              <span className="block text-[10px] font-bold uppercase text-[#8b9098]">VIP</span>
              <b className="text-lg font-mono font-black text-[#f5b800]">{stats.vip}</b>
            </div>
            <div className="bg-[#11151a] border border-[#24282f] rounded-none p-2.5">
              <span className="block text-[10px] font-bold uppercase text-[#8b9098]">Ghế đôi</span>
              <b className="text-lg font-mono font-black text-[#ec4899]">
                {stats.couple} <span className="text-xs text-[#8b9098] font-normal">({stats.couple * 2} chỗ)</span>
              </b>
            </div>
          </div>
        </section>

        {/* =========================================================================
            RIGHT COLUMN: PROPERTIES PANEL (3 Tabs: Thông tin, Hàng ghế, Giá vé)
            ========================================================================= */}
        <section className="bg-[#101318] border border-[#24282f] rounded-none flex flex-col min-h-0 shadow-[0_8px_24px_rgba(0,0,0,0.25)] overflow-hidden lg:col-span-2 xl:col-span-1">
          {/* TABS HEADER */}
          <div className="flex border-b border-[#24282f] bg-[#0c0f13] shrink-0">
            {['Thông tin', 'Hàng ghế', 'Giá vé'].map((tabLabel, idx) => {
              const isActive = activeTab === idx;
              return (
                <button
                  key={tabLabel}
                  type="button"
                  onClick={() => setActiveTab(idx)}
                  className={`flex-1 py-2.5 text-xs font-bold transition-all relative ${
                    isActive ? 'text-[#f5b800]' : 'text-[#777d86] hover:text-[#d5d8dc]'
                  }`}
                >
                  {tabLabel}
                  {isActive && (
                    <span className="absolute bottom-0 left-0 right-0 h-[2px] bg-[#f5b800]" />
                  )}
                </button>
              );
            })}
          </div>

          {/* TAB PANES */}
          <div className="p-3.5 sm:p-4 overflow-y-auto flex-1 custom-dark-scrollbar space-y-3.5">
            {/* ---------------- TAB 0: THÔNG TIN ---------------- */}
            {activeTab === 0 && (
              <div className="space-y-3.5">
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-[#8b9098] mb-1.5">
                    Tên phòng
                  </label>
                  <input
                    type="text"
                    value={roomName}
                    onChange={e => { setRoomName(e.target.value); markDirty(); }}
                    placeholder="VD: Phòng 01"
                    className="w-full h-9 bg-[#080a0d] border border-[#292e35] focus:border-[#f5b800] focus:ring-1 focus:ring-[#f5b800]/25 rounded-none px-3 text-xs text-white outline-none transition"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2.5">
                  <div>
                    <label className="block text-[11px] font-bold uppercase tracking-wider text-[#8b9098] mb-1.5">
                      Loại phòng
                    </label>
                    <select
                      value={roomType}
                      onChange={e => { setRoomType(e.target.value); markDirty(); }}
                      className="w-full h-9 bg-[#080a0d] border border-[#292e35] focus:border-[#f5b800] focus:ring-1 focus:ring-[#f5b800]/25 rounded-none px-2.5 text-xs text-white outline-none transition"
                    >
                      {ROOM_TYPE_OPTIONS.map(opt => (
                        <option key={opt.value} value={opt.value} className="bg-[#101318] text-white">
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold uppercase tracking-wider text-[#8b9098] mb-1.5">
                      Tầng
                    </label>
                    <input
                      type="number"
                      min={1}
                      max={20}
                      value={floorNumber}
                      onChange={e => { setFloorNumber(Number(e.target.value) || 1); markDirty(); }}
                      className="w-full h-9 bg-[#080a0d] border border-[#292e35] focus:border-[#f5b800] focus:ring-1 focus:ring-[#f5b800]/25 rounded-none px-3 text-xs text-white outline-none transition"
                    />
                  </div>
                </div>

                {/* Switch Toggle: Đang hoạt động (SQUARE) */}
                <div className="flex items-center justify-between py-2 border-t border-[#24282f]/60 pt-3">
                  <span className="text-xs font-semibold text-[#f5f5f5]">
                    Đang hoạt động
                  </span>
                  <div
                    onClick={handleToggleRoomActive}
                    className={`w-10 h-5 rounded-none p-0.5 cursor-pointer transition-colors duration-200 relative ${
                      roomActive ? 'bg-[#00c987]' : 'bg-[#3e444c]'
                    }`}
                  >
                    <div
                      className={`w-4 h-4 rounded-none bg-white transition-transform duration-200 shadow-md ${
                        roomActive ? 'translate-x-5' : 'translate-x-0'
                      }`}
                    />
                  </div>
                </div>

                <hr className="border-none border-t border-[#24282f]" />

                {/* Hint Card: Mẹo nhanh */}
                <div className="bg-[#101419] border border-[#24282f] rounded-none p-3 text-xs text-[#8b9098] space-y-1.5 leading-relaxed">
                  <div className="flex items-center gap-1.5 text-[#f5b800] font-bold uppercase text-[11px]">
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>Mẹo nhanh</span>
                  </div>
                  <p>• Chọn <b>bút vẽ</b> rồi click hoặc kéo chuột lên ghế để đổi loại.</p>
                  <p>• Click vào <b>chữ cái hàng</b> để đổi cả hàng theo bút.</p>
                  <p>
                    • Phím tắt: <kbd className="px-1.5 py-0.5 rounded-none bg-black/60 border border-white/10 font-mono text-[10px] text-white">1</kbd> <kbd className="px-1.5 py-0.5 rounded-none bg-black/60 border border-white/10 font-mono text-[10px] text-white">2</kbd> <kbd className="px-1.5 py-0.5 rounded-none bg-black/60 border border-white/10 font-mono text-[10px] text-white">3</kbd> <kbd className="px-1.5 py-0.5 rounded-none bg-black/60 border border-white/10 font-mono text-[10px] text-white">4</kbd> đổi bút, <kbd className="px-1.5 py-0.5 rounded-none bg-black/60 border border-white/10 font-mono text-[10px] text-white">5</kbd> bút xóa ghế, <kbd className="px-1.5 py-0.5 rounded-none bg-black/60 border border-white/10 font-mono text-[10px] text-white">Delete</kbd> xóa ghế chọn, <kbd className="px-1.5 py-0.5 rounded-none bg-black/60 border border-white/10 font-mono text-[10px] text-white">Ctrl+Z</kbd> hoàn tác.
                  </p>
                </div>

                {/* Delete Room Button */}
                <button
                  type="button"
                  onClick={handleDeleteRoom}
                  className="w-full flex items-center justify-center gap-1.5 py-2.5 rounded-none border border-rose-500/35 hover:border-rose-500 hover:bg-rose-500/10 text-rose-400 text-xs font-bold transition"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Xóa / Vô hiệu hóa phòng</span>
                </button>
              </div>
            )}

            {/* ---------------- TAB 1: HÀNG GHẾ ---------------- */}
            {activeTab === 1 && (
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-2.5">
                  <div>
                    <label className="block text-[11px] font-bold uppercase tracking-wider text-[#8b9098] mb-1">
                      Số hàng
                    </label>
                    <input
                      type="number"
                      min={1}
                      max={26}
                      value={rows.length}
                      onChange={e => handleSetRowCount(e.target.value)}
                      className="w-full h-8 bg-[#080a0d] border border-[#292e35] focus:border-[#f5b800] rounded-none px-2.5 text-xs text-white text-center font-mono outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold uppercase tracking-wider text-[#8b9098] mb-1">
                      Ghế / hàng (mặc định)
                    </label>
                    <input
                      type="number"
                      min={1}
                      max={30}
                      value={defaultCols}
                      onChange={e => handleSetColCount(e.target.value)}
                      className="w-full h-8 bg-[#080a0d] border border-[#292e35] focus:border-[#f5b800] rounded-none px-2.5 text-xs text-white text-center font-mono outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-[#8b9098] mb-1">
                    Lối đi giữa (sau ghế số)
                  </label>
                  <input
                    type="number"
                    min={0}
                    max={defaultCols}
                    value={aisleIndex}
                    onChange={e => { setAisleIndex(Number(e.target.value) || 0); markDirty(); }}
                    placeholder="0 = không có"
                    className="w-full h-8 bg-[#080a0d] border border-[#292e35] focus:border-[#f5b800] rounded-none px-3 text-xs text-white font-mono outline-none"
                  />
                </div>

                <div className="border-t border-[#24282f] pt-2.5">
                  <span className="block text-[11px] font-bold uppercase tracking-wider text-[#8b9098] mb-2">
                    Chi tiết từng hàng
                  </span>

                  <div className="space-y-1.5 max-h-[280px] overflow-y-auto pr-1 custom-dark-scrollbar">
                    {rows.map((row, rIdx) => {
                      const mainType = row.seats.find(s => s !== 'off') || 'std';
                      const isSel = selectedRowIndex === rIdx;

                      return (
                        <div
                          key={rIdx}
                          className={`flex items-center gap-2 p-1.5 rounded-none border transition ${
                            isSel ? 'bg-[#f5b800]/10 border-[#f5b800]' : 'bg-[#0c0f13] border-[#272c33] hover:border-[#3a3f47]'
                          }`}
                        >
                          <b className="w-5 text-center font-mono text-xs text-white">{row.label}</b>
                          <input
                            type="number"
                            min={1}
                            max={30}
                            value={row.seats.length}
                            onChange={e => handleRowColChange(rIdx, e.target.value)}
                            title="Số ghế"
                            className="w-12 h-7 rounded-none border border-[#24282f] bg-[#080a0d] text-center text-xs font-mono text-white outline-none"
                          />
                          <select
                            value={mainType}
                            onChange={e => handleRowTypeChange(rIdx, e.target.value)}
                            className="flex-1 h-7 rounded-none border border-[#24282f] bg-[#080a0d] text-[11px] text-white px-1.5 outline-none"
                          >
                            <option value="std">Thường</option>
                            <option value="vip">VIP</option>
                            <option value="couple">Ghế đôi</option>
                          </select>
                          <button
                            type="button"
                            title="Xóa hàng này"
                            onClick={() => handleDeleteRow(rIdx)}
                            className="p-1 rounded-none text-[#8b9098] hover:text-rose-400 hover:bg-rose-500/10 transition"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      );
                    })}
                  </div>

                  <button
                    type="button"
                    onClick={handleAddRow}
                    className="w-full mt-2.5 py-2 rounded-none border border-[#24282f] bg-[#11151a] hover:bg-[#15181d] hover:border-[#3a3f47] text-[#f5b800] text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-1.5 transition"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Thêm hàng</span>
                  </button>
                </div>
              </div>
            )}

            {/* ---------------- TAB 2: GIÁ VÉ ---------------- */}
            {activeTab === 2 && (
              <div className="space-y-3.5">
                <p className="text-xs text-[#8b9098] leading-relaxed">
                  Thiết lập giá tham chiếu cơ bản theo từng loại ghế để tính toán doanh thu suất chiếu:
                </p>

                <div className="space-y-2">
                  <div className="flex items-center gap-2.5 p-2 rounded-none bg-[#0c0f13] border border-[#272c33]">
                    <span className="w-3.5 h-3.5 rounded-none bg-[#161b20] border border-[#697078] shrink-0" />
                    <span className="flex-1 text-xs text-white font-medium">Ghế thường</span>
                    <input
                      type="number"
                      step={5000}
                      value={prices.std}
                      onChange={e => {
                        const val = Math.max(0, Number(e.target.value) || 0);
                        setPrices(p => ({ ...p, std: val }));
                        markDirty();
                      }}
                      className="w-24 h-7 text-right px-2 rounded-none border border-[#24282f] bg-[#080a0d] text-xs font-mono text-white outline-none"
                    />
                    <small className="text-[#8b9098] text-xs font-mono">đ</small>
                  </div>

                  <div className="flex items-center gap-2.5 p-2 rounded-none bg-[#0c0f13] border border-[#272c33]">
                    <span className="w-3.5 h-3.5 rounded-none bg-amber-500/15 border border-[#f5b800] shrink-0" />
                    <span className="flex-1 text-xs text-white font-medium">Ghế VIP</span>
                    <input
                      type="number"
                      step={5000}
                      value={prices.vip}
                      onChange={e => {
                        const val = Math.max(0, Number(e.target.value) || 0);
                        setPrices(p => ({ ...p, vip: val }));
                        markDirty();
                      }}
                      className="w-24 h-7 text-right px-2 rounded-none border border-[#24282f] bg-[#080a0d] text-xs font-mono text-white outline-none"
                    />
                    <small className="text-[#8b9098] text-xs font-mono">đ</small>
                  </div>

                  <div className="flex items-center gap-2.5 p-2 rounded-none bg-[#0c0f13] border border-[#272c33]">
                    <span className="w-4 h-3 rounded-none bg-[#831843] border border-[#ec4899] shrink-0" />
                    <span className="flex-1 text-xs text-white font-medium">Ghế đôi</span>
                    <input
                      type="number"
                      step={5000}
                      value={prices.couple}
                      onChange={e => {
                        const val = Math.max(0, Number(e.target.value) || 0);
                        setPrices(p => ({ ...p, couple: val }));
                        markDirty();
                      }}
                      className="w-24 h-7 text-right px-2 rounded-none border border-[#24282f] bg-[#080a0d] text-xs font-mono text-white outline-none"
                    />
                    <small className="text-[#8b9098] text-xs font-mono">đ</small>
                  </div>
                </div>

                {/* Revenue Box */}
                <div
                  className="rounded-none border p-3.5 space-y-1 mt-4"
                  style={{
                    background: 'linear-gradient(135deg, rgba(245,184,0,0.10), rgba(245,184,0,0.02))',
                    borderColor: 'rgba(245,184,0,0.30)'
                  }}
                >
                  <span className="block text-[10px] font-black uppercase tracking-wider text-[#8b9098]">
                    DOANH THU TỐI ĐA / SUẤT (KÍN RẠP)
                  </span>
                  <div className="text-xl sm:text-2xl font-mono font-black text-[#f5b800] tracking-tight">
                    {formatVnd(stats.maxRev)}
                  </div>
                  <p className="text-[10px] text-[#8b9098] pt-1 border-t border-white/5">
                    Dựa trên {stats.std} thường + {stats.vip} VIP + {stats.couple} đôi.
                  </p>
                </div>
              </div>
            )}
          </div>
        </section>
      </main>

      {/* =========================================================================
          ADD ROOM MODAL (DARK THEME & SQUARE CORNERS)
          ========================================================================= */}
      {isAddModalOpen && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#101318] border border-[#292e35] rounded-none w-full max-w-sm p-5 space-y-4 shadow-2xl animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-[#24282f] pb-3">
              <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                <Plus className="w-4 h-4 text-[#f5b800]" /> Thêm phòng chiếu
              </h3>
              <button
                type="button"
                onClick={() => setIsAddModalOpen(false)}
                className="text-[#8b9098] hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-[#8b9098] mb-1">
                  Tên phòng
                </label>
                <input
                  type="text"
                  value={addModalForm.name}
                  onChange={e => setAddModalForm({ ...addModalForm, name: e.target.value })}
                  placeholder="VD: Phòng 05"
                  className="w-full h-9 bg-[#080a0d] border border-[#292e35] focus:border-[#f5b800] rounded-none px-3 text-xs text-white outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-[#8b9098] mb-1">
                    Loại phòng
                  </label>
                  <select
                    value={addModalForm.roomType}
                    onChange={e => setAddModalForm({ ...addModalForm, roomType: e.target.value })}
                    className="w-full h-9 bg-[#080a0d] border border-[#292e35] focus:border-[#f5b800] rounded-none px-2 text-xs text-white outline-none"
                  >
                    {ROOM_TYPE_OPTIONS.map(opt => (
                      <option key={opt.value} value={opt.value} className="bg-[#101318] text-white">
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-[#8b9098] mb-1">
                    Tầng
                  </label>
                  <input
                    type="number"
                    min={1}
                    value={addModalForm.floor}
                    onChange={e => setAddModalForm({ ...addModalForm, floor: Number(e.target.value) || 1 })}
                    className="w-full h-9 bg-[#080a0d] border border-[#292e35] focus:border-[#f5b800] rounded-none px-2 text-xs text-white text-center font-mono outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-[#8b9098] mb-1">
                    Số hàng
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={26}
                    value={addModalForm.rowCount}
                    onChange={e => setAddModalForm({ ...addModalForm, rowCount: Number(e.target.value) || 8 })}
                    className="w-full h-9 bg-[#080a0d] border border-[#292e35] focus:border-[#f5b800] rounded-none px-2 text-xs text-white text-center font-mono outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-[#8b9098] mb-1">
                    Ghế / hàng
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={30}
                    value={addModalForm.colCount}
                    onChange={e => setAddModalForm({ ...addModalForm, colCount: Number(e.target.value) || 10 })}
                    className="w-full h-9 bg-[#080a0d] border border-[#292e35] focus:border-[#f5b800] rounded-none px-2 text-xs text-white text-center font-mono outline-none"
                  />
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-[#24282f]">
              <button
                type="button"
                onClick={() => setIsAddModalOpen(false)}
                className="px-3.5 py-2 rounded-none border border-[#24282f] bg-[#11151a] hover:bg-[#15181d] text-[#c3c7cd] text-xs font-semibold"
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={handleCreateRoom}
                className="px-4 py-2 rounded-none bg-[#f5b800] hover:bg-[#ffc933] text-[#090909] text-xs font-bold uppercase tracking-wider"
              >
                Tạo phòng
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          CONFIRMATION MODAL (DARK THEME & SQUARE CORNERS)
          ========================================================================= */}
      {confirmDialog && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#101318] border border-[#292e35] rounded-none w-full max-w-sm p-5 space-y-3.5 shadow-2xl">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-none bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-[#f5b800] shrink-0">
                <AlertTriangle className="w-4 h-4" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-white uppercase tracking-wider">
                  {confirmDialog.title}
                </h4>
                <p className="text-xs text-[#8b9098] mt-1 leading-relaxed">
                  {confirmDialog.description}
                </p>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-[#24282f]">
              <button
                type="button"
                onClick={() => setConfirmDialog(null)}
                className="px-3.5 py-1.5 rounded-none border border-[#24282f] bg-[#11151a] text-[#c3c7cd] hover:text-white text-xs font-semibold"
              >
                Quay lại
              </button>
              <button
                type="button"
                onClick={() => {
                  const act = confirmDialog.onConfirm;
                  setConfirmDialog(null);
                  if (act) act();
                }}
                className="px-4 py-1.5 rounded-none bg-[#f5b800] hover:bg-[#ffc933] text-[#090909] text-xs font-bold uppercase tracking-wider"
              >
                {confirmDialog.confirmLabel || 'Xác nhận'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          TOAST NOTIFICATION (BOTTOM-CENTER, SQUARE CORNERS)
          ========================================================================= */}
      {localToast && (
        <div className="fixed bottom-5 left-1/2 -translate-x-1/2 z-50 bg-[#171b20] border border-[#30353d] text-[#f5f5f5] px-4 py-2.5 rounded-none shadow-2xl flex items-center gap-2 text-xs font-semibold animate-in fade-in slide-in-from-bottom-2 duration-150">
          {localToast.type === 'error' && <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />}
          {localToast.type === 'warning' && <AlertTriangle className="w-4 h-4 text-[#f5b800] shrink-0" />}
          {localToast.type === 'success' && <CheckCircle2 className="w-4 h-4 text-[#00d68f] shrink-0" />}
          <span>{localToast.message}</span>
        </div>
      )}
    </div>
  );
}
