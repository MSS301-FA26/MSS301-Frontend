import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  DollarSign,
  Building2,
  RefreshCw,
  Edit3,
  Save,
  Check,
  X,
  Layers,
  Crown,
  Sparkles,
  Info,
  CheckCircle2,
  Baby,
  GraduationCap,
  User,
  Sliders,
  Tv,
  ArrowRight,
  ShieldCheck,
  AlertCircle
} from 'lucide-react';
import { adminService } from '../../../services/adminService';

// Format currency in Vietnamese Dong
const formatVnd = (value) => {
  if (value === null || value === undefined || value === '') return '0đ';
  return `${Number(value).toLocaleString('vi-VN')}đ`;
};

// Audience types meta info
const AUDIENCE_META = {
  CHILD: {
    type: 'CHILD',
    label: 'Trẻ em',
    subtitle: 'Dưới 12 tuổi hoặc cao dưới 1.3m',
    badge: 'bg-sky-500/15 text-sky-400 border-sky-500/30',
    accentColor: '#38bdf8',
    icon: Baby,
    defaultPrice: 10000
  },
  STUDENT: {
    type: 'STUDENT',
    label: 'Sinh viên',
    subtitle: 'Học sinh / Sinh viên có thẻ hợp lệ',
    badge: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
    accentColor: '#34d399',
    icon: GraduationCap,
    defaultPrice: 20000
  },
  ADULT: {
    type: 'ADULT',
    label: 'Người lớn',
    subtitle: 'Khách hàng phổ thông tiêu chuẩn',
    badge: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
    accentColor: '#fbbf24',
    icon: User,
    defaultPrice: 30000
  }
};

export default function AdminPricingPanel({ ctx }) {
  const { getAdminToken, showToast, isManager, currentUser, isAdmin } = ctx || {};
  const managerCinemaId = isManager && currentUser?.cinemaId ? Number(currentUser.cinemaId) : null;

  // 1. Cinemas State
  const [cinemas, setCinemas] = useState([]);
  const [selectedCinemaId, setSelectedCinemaId] = useState(managerCinemaId ? String(managerCinemaId) : '');
  const [loadingCinemas, setLoadingCinemas] = useState(false);

  // 2. Rooms State
  const [rooms, setRooms] = useState([]);
  const [selectedRoomId, setSelectedRoomId] = useState(null);
  const [loadingRooms, setLoadingRooms] = useState(false);

  // 3. Audience Surcharge State (per cinema)
  const [audiencePrices, setAudiencePrices] = useState({
    CHILD: 10000,
    STUDENT: 20000,
    ADULT: 30000
  });
  const [rawAudienceRecords, setRawAudienceRecords] = useState([]);
  const [loadingAudience, setLoadingAudience] = useState(false);
  const [savingAudienceType, setSavingAudienceType] = useState(null);
  const [isSavingAllAudience, setIsSavingAllAudience] = useState(false);

  // 4. Modal Edit Room Base Prices State
  const [isEditRoomModalOpen, setIsEditRoomModalOpen] = useState(false);
  const [roomBasePrices, setRoomBasePrices] = useState({
    standardPrice: 60000,
    vipPrice: 90000,
    couplePrice: 150000
  });
  const [isSavingRoomPrice, setIsSavingRoomPrice] = useState(false);

  // 5. View Mode: 'BY_ROOM' (Bảng chi tiết theo phòng) | 'ALL_ROOMS' (Ma trận tất cả các phòng)
  const [viewMode, setViewMode] = useState('BY_ROOM');

  // ================= LOAD CINEMAS =================
  const loadCinemas = useCallback(async () => {
    const token = getAdminToken();
    if (!token) return;
    setLoadingCinemas(true);
    try {
      const res = await adminService.getAdminCinemas(token, { size: 100 }).catch(() => []);
      const list = Array.isArray(res) ? res : (res?.items || res?.content || res?.data || []);
      setCinemas(list);

      // Set initial selected cinema
      if (managerCinemaId) {
        setSelectedCinemaId(String(managerCinemaId));
      } else if (list.length > 0 && !selectedCinemaId) {
        setSelectedCinemaId(String(list[0].id));
      }
    } catch (err) {
      showToast?.(err?.message || 'Không thể tải danh sách chi nhánh.');
    } finally {
      setLoadingCinemas(false);
    }
  }, [getAdminToken, showToast, managerCinemaId, selectedCinemaId]);

  useEffect(() => {
    loadCinemas();
  }, [loadCinemas]);

  // When managerCinemaId changes, lock selectedCinemaId
  useEffect(() => {
    if (managerCinemaId) {
      setSelectedCinemaId(String(managerCinemaId));
    }
  }, [managerCinemaId]);

  // Current selected cinema object
  const currentCinema = useMemo(() => {
    return cinemas.find((c) => String(c.id) === String(selectedCinemaId)) || null;
  }, [cinemas, selectedCinemaId]);

  // ================= LOAD ROOMS FOR SELECTED CINEMA =================
  const loadRoomsForCinema = useCallback(async (cinemaId) => {
    if (!cinemaId) {
      setRooms([]);
      setSelectedRoomId(null);
      return;
    }
    const token = getAdminToken();
    if (!token) return;

    setLoadingRooms(true);
    try {
      const res = await adminService.getAdminRooms(token, Number(cinemaId));
      const list = Array.isArray(res) ? res : (res?.data || []);
      setRooms(list);

      // Select first room by default if none selected or not in list
      if (list.length > 0) {
        setSelectedRoomId((prev) => {
          const exists = list.some((r) => r.id === prev);
          return exists ? prev : list[0].id;
        });
      } else {
        setSelectedRoomId(null);
      }
    } catch (err) {
      showToast?.(err?.message || 'Không thể tải danh sách phòng chiếu của chi nhánh.');
      setRooms([]);
      setSelectedRoomId(null);
    } finally {
      setLoadingRooms(false);
    }
  }, [getAdminToken, showToast]);

  // ================= LOAD AUDIENCE PRICES FOR SELECTED CINEMA =================
  const loadAudiencePricesForCinema = useCallback(async (cinemaId) => {
    if (!cinemaId) return;
    const token = getAdminToken();
    if (!token) return;

    setLoadingAudience(true);
    try {
      const res = await adminService.getAudiencePrices(token, Number(cinemaId));
      const list = Array.isArray(res) ? res : (res?.data || []);
      setRawAudienceRecords(list);

      const newMap = { CHILD: 10000, STUDENT: 20000, ADULT: 30000 };
      list.forEach((item) => {
        if (item.audienceType && newMap.hasOwnProperty(item.audienceType)) {
          newMap[item.audienceType] = Number(item.additionalPrice) || 0;
        }
      });
      setAudiencePrices(newMap);
    } catch (err) {
      showToast?.(err?.message || 'Không thể tải cấu hình giá cộng thêm theo đối tượng.');
    } finally {
      setLoadingAudience(false);
    }
  }, [getAdminToken, showToast]);

  // Reload rooms & audience prices when selectedCinemaId changes
  useEffect(() => {
    if (selectedCinemaId) {
      loadRoomsForCinema(selectedCinemaId);
      loadAudiencePricesForCinema(selectedCinemaId);
    }
  }, [selectedCinemaId, loadRoomsForCinema, loadAudiencePricesForCinema]);

  // Current selected room object
  const currentRoom = useMemo(() => {
    return rooms.find((r) => r.id === selectedRoomId) || null;
  }, [rooms, selectedRoomId]);

  // Synchronize modal edit room base prices when currentRoom changes
  useEffect(() => {
    if (currentRoom) {
      setRoomBasePrices({
        standardPrice: currentRoom.standardPrice ?? 60000,
        vipPrice: currentRoom.vipPrice ?? 90000,
        couplePrice: currentRoom.couplePrice ?? 150000
      });
    }
  }, [currentRoom]);

  // ================= SAVE AUDIENCE PRICE (SINGLE) =================
  const handleSaveSingleAudience = async (audienceType) => {
    if (!selectedCinemaId) {
      showToast?.('Vui lòng chọn chi nhánh cụm rạp.');
      return;
    }
    const token = getAdminToken();
    if (!token) return;

    const price = Number(audiencePrices[audienceType]);
    if (isNaN(price) || price < 0 || price > 500000) {
      showToast?.('Giá cộng thêm phải từ 0đ đến 500.000đ.');
      return;
    }

    setSavingAudienceType(audienceType);
    try {
      await adminService.upsertAudiencePrice(token, Number(selectedCinemaId), {
        audienceType,
        additionalPrice: price
      });
      showToast?.(`✓ Đã lưu giá cộng thêm cho ${AUDIENCE_META[audienceType]?.label}: ${formatVnd(price)}.`, 'success');
      loadAudiencePricesForCinema(selectedCinemaId);
    } catch (err) {
      showToast?.(err?.message || 'Lỗi khi lưu giá cộng thêm.');
    } finally {
      setSavingAudienceType(null);
    }
  };

  // ================= SAVE AUDIENCE PRICE (ALL 3 TYPES) =================
  const handleSaveAllAudience = async () => {
    if (!selectedCinemaId) {
      showToast?.('Vui lòng chọn chi nhánh cụm rạp.');
      return;
    }
    const token = getAdminToken();
    if (!token) return;

    for (const key of ['CHILD', 'STUDENT', 'ADULT']) {
      const price = Number(audiencePrices[key]);
      if (isNaN(price) || price < 0 || price > 500000) {
        showToast?.(`Giá cộng thêm của ${AUDIENCE_META[key].label} phải từ 0đ đến 500.000đ.`);
        return;
      }
    }

    setIsSavingAllAudience(true);
    try {
      const cinemaIdNum = Number(selectedCinemaId);
      await Promise.all([
        adminService.upsertAudiencePrice(token, cinemaIdNum, { audienceType: 'CHILD', additionalPrice: Number(audiencePrices.CHILD) }),
        adminService.upsertAudiencePrice(token, cinemaIdNum, { audienceType: 'STUDENT', additionalPrice: Number(audiencePrices.STUDENT) }),
        adminService.upsertAudiencePrice(token, cinemaIdNum, { audienceType: 'ADULT', additionalPrice: Number(audiencePrices.ADULT) })
      ]);
      showToast?.('✓ Đã cập nhật thành công bảng giá cho cả 3 đối tượng (Trẻ em, Sinh viên, Người lớn)!', 'success');
      loadAudiencePricesForCinema(selectedCinemaId);
    } catch (err) {
      showToast?.(err?.message || 'Lỗi khi lưu bảng giá.');
    } finally {
      setIsSavingAllAudience(false);
    }
  };

  // ================= SAVE ROOM BASE PRICES =================
  const handleSaveRoomBasePrices = async (e) => {
    e?.preventDefault();
    if (!currentRoom) return;
    const token = getAdminToken();
    if (!token) return;

    const sPrice = Number(roomBasePrices.standardPrice);
    const vPrice = Number(roomBasePrices.vipPrice);
    const cPrice = Number(roomBasePrices.couplePrice);

    if (isNaN(sPrice) || sPrice < 0 || isNaN(vPrice) || vPrice < 0 || isNaN(cPrice) || cPrice < 0) {
      showToast?.('Giá ghế phòng chiếu phải là số hợp lệ >= 0đ.');
      return;
    }

    setIsSavingRoomPrice(true);
    try {
      const payload = {
        cinemaId: currentRoom.cinemaId,
        name: currentRoom.name,
        roomType: currentRoom.roomType,
        rowCount: currentRoom.rowCount,
        columnCount: currentRoom.columnCount,
        status: currentRoom.status,
        standardPrice: sPrice,
        vipPrice: vPrice,
        couplePrice: cPrice,
        aislePosition: currentRoom.aislePosition ?? 0
      };

      await adminService.updateAdminRoom(token, currentRoom.id, payload);
      showToast?.(`✓ Đã cập nhật giá gốc phòng ${currentRoom.name} thành công!`, 'success');
      setIsEditRoomModalOpen(false);
      loadRoomsForCinema(selectedCinemaId);
    } catch (err) {
      showToast?.(err?.message || 'Không thể cập nhật giá gốc phòng chiếu.');
    } finally {
      setIsSavingRoomPrice(false);
    }
  };

  return (
    <div className="space-y-4 text-white select-none">
      {/* 1. Header Section */}
      <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between border-b border-white/10 pb-3">
        <div>
          <h1 className="text-sm sm:text-base font-black text-white flex items-center gap-2 uppercase tracking-wide">
            <DollarSign className="w-4 h-4 text-amber-400 shrink-0" />
            <span>Bảng Giá Vé Theo Lứa Tuổi & Phòng Chiếu</span>
          </h1>
          <p className="text-[11px] text-neutral-400 mt-0.5">
            Công thức chuẩn: <strong className="text-amber-400 font-mono">Giá bán cuối cùng = Giá ghế (phòng) + Giá cộng thêm theo đối tượng</strong>.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* View Mode Toggle */}
          <div className="flex items-center bg-black/60 border border-white/15 p-0.5">
            <button
              onClick={() => setViewMode('BY_ROOM')}
              className={`px-2.5 py-1 text-[10.5px] font-bold uppercase transition ${
                viewMode === 'BY_ROOM'
                  ? 'bg-amber-400 text-black font-black'
                  : 'text-neutral-400 hover:text-white'
              }`}
            >
              Theo phòng chiếu
            </button>
            <button
              onClick={() => setViewMode('ALL_ROOMS')}
              className={`px-2.5 py-1 text-[10.5px] font-bold uppercase transition ${
                viewMode === 'ALL_ROOMS'
                  ? 'bg-amber-400 text-black font-black'
                  : 'text-neutral-400 hover:text-white'
              }`}
            >
              Tất cả phòng ({rooms.length})
            </button>
          </div>

          <button
            onClick={() => {
              if (selectedCinemaId) {
                loadRoomsForCinema(selectedCinemaId);
                loadAudiencePricesForCinema(selectedCinemaId);
              }
            }}
            disabled={loadingRooms || loadingAudience}
            className="flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-bold text-neutral-300 bg-[#161b22] hover:bg-[#21262d] border border-white/15 rounded-none transition uppercase tracking-wider disabled:opacity-50"
          >
            <RefreshCw className={`w-3 h-3 ${loadingRooms || loadingAudience ? 'animate-spin' : ''}`} />
            Làm mới
          </button>
        </div>
      </div>

      {/* 2. Cinema Selection Bar (Only Admin can change cinema, Manager is locked) */}
      <div className="p-3 bg-[#12161c] border border-white/10 rounded-none flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="p-2 bg-amber-400/10 border border-amber-400/20 text-amber-400 rounded-none shrink-0">
            <Building2 className="w-4 h-4" />
          </div>
          <div>
            <div className="text-[10px] font-black uppercase tracking-wider text-neutral-400 flex items-center gap-1.5">
              <span>Chi nhánh áp dụng</span>
              {managerCinemaId ? (
                <span className="text-[9px] px-1.5 py-0.2 bg-amber-400/10 text-amber-400 border border-amber-400/30 uppercase font-black">
                  Quản lý chi nhánh
                </span>
              ) : (
                <span className="text-[9px] px-1.5 py-0.2 bg-purple-500/10 text-purple-400 border border-purple-500/30 uppercase font-black">
                  Quyền Admin (Toàn hệ thống)
                </span>
              )}
            </div>
            <div className="text-xs font-black text-white mt-0.5">
              {currentCinema ? currentCinema.name : 'Đang tải thông tin chi nhánh...'}
            </div>
          </div>
        </div>

        {/* Cinema Dropdown for Admin */}
        {!managerCinemaId && cinemas.length > 0 && (
          <div className="flex items-center gap-2">
            <span className="text-[11px] text-neutral-400 font-bold uppercase tracking-wider shrink-0">
              Chọn chi nhánh:
            </span>
            <select
              value={selectedCinemaId}
              onChange={(e) => setSelectedCinemaId(e.target.value)}
              className="px-3 py-1.5 bg-black/80 text-white border border-white/20 rounded-none text-[11px] font-bold focus:outline-none focus:border-amber-400 uppercase tracking-wide min-w-[240px]"
            >
              {cinemas.map((c) => (
                <option key={c.id} value={String(c.id)}>
                  {c.name?.toUpperCase()}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* 3. Rooms Selector Strip (Pills) */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-[10.5px] font-black text-neutral-400 uppercase tracking-wider flex items-center gap-1.5">
            <Tv className="w-3.5 h-3.5 text-amber-400" />
            <span>Danh sách phòng chiếu thuộc chi nhánh ({rooms.length} phòng):</span>
          </span>

          {currentRoom && (
            <button
              onClick={() => setIsEditRoomModalOpen(true)}
              className="flex items-center gap-1 text-[10.5px] text-amber-400 hover:text-amber-300 font-bold uppercase transition hover:underline"
            >
              <Edit3 className="w-3 h-3" />
              <span>Chỉnh sửa giá gốc {currentRoom.name}</span>
            </button>
          )}
        </div>

        {loadingRooms ? (
          <div className="p-4 text-center text-xs text-neutral-400 flex items-center justify-center gap-2 bg-[#12161c] border border-white/5">
            <RefreshCw className="w-3.5 h-3.5 animate-spin text-amber-400" />
            <span>Đang tải thông tin phòng chiếu...</span>
          </div>
        ) : rooms.length === 0 ? (
          <div className="p-4 text-center text-xs text-neutral-400 bg-[#12161c] border border-white/5">
            Chi nhánh này chưa có phòng chiếu nào được kích hoạt.
          </div>
        ) : (
          <div className="flex items-center gap-2 overflow-x-auto pb-1">
            {rooms.map((room) => {
              const isSelected = room.id === selectedRoomId;
              return (
                <button
                  key={room.id}
                  onClick={() => setSelectedRoomId(room.id)}
                  className={`px-3 py-2 border rounded-none text-left transition shrink-0 min-w-[140px] ${
                    isSelected
                      ? 'bg-amber-400/10 border-amber-400 text-white'
                      : 'bg-[#12161c] border-white/10 text-neutral-400 hover:border-white/25 hover:text-white'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <span className="text-xs font-black uppercase text-white">{room.name}</span>
                    <span className="text-[9px] px-1 py-0.2 bg-white/10 text-neutral-300 uppercase font-mono">
                      {room.roomType || 'STD'}
                    </span>
                  </div>
                  <div className="text-[9.5px] text-neutral-400 space-y-0.5 font-mono">
                    <div>Thường: <strong className="text-neutral-200">{formatVnd(room.standardPrice)}</strong></div>
                    <div>VIP: <strong className="text-amber-400">{formatVnd(room.vipPrice)}</strong></div>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* 4. MAIN PRICING TABLE - BY SELECTED ROOM */}
      {viewMode === 'BY_ROOM' && currentRoom && (
        <div className="border border-white/15 bg-[#12161c] rounded-none shadow-2xl overflow-hidden">
          {/* Table Header Context */}
          <div className="p-3.5 bg-black/60 border-b border-white/10 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2.5">
            <div>
              <div className="text-xs sm:text-sm font-black text-white uppercase tracking-wide flex items-center gap-2">
                <span>Bảng Giá Vé Chi Tiết: {currentRoom.name}</span>
                <span className="text-[10px] px-2 py-0.5 bg-amber-400/15 text-amber-400 border border-amber-400/30 uppercase font-bold">
                  Phòng {currentRoom.roomType}
                </span>
              </div>
              <div className="text-[10.5px] text-neutral-400 mt-0.5">
                Giá gốc phòng: Ghế thường <strong>{formatVnd(currentRoom.standardPrice)}</strong> | Ghế VIP <strong>{formatVnd(currentRoom.vipPrice)}</strong> | Ghế Đôi <strong>{formatVnd(currentRoom.couplePrice)}</strong>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleSaveAllAudience}
                disabled={isSavingAllAudience || loadingAudience}
                className="flex items-center gap-1.5 px-3.5 py-1.5 text-[11px] font-black text-black bg-amber-400 hover:bg-amber-300 border border-amber-400 rounded-none transition uppercase tracking-wider shadow-lg shadow-amber-500/10 disabled:opacity-50"
              >
                <Save className={`w-3 h-3 ${isSavingAllAudience ? 'animate-spin' : ''}`} />
                <span>{isSavingAllAudience ? 'Đang lưu...' : 'Lưu Bảng Giá'}</span>
              </button>
            </div>
          </div>

          {/* THE EXACT REQUESTED TABLE STRUCTURE */}
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-neutral-300 border-collapse">
              <thead>
                <tr className="border-b border-white/15 bg-black/80 text-[10.5px] font-black uppercase tracking-wider text-neutral-300">
                  <th className="px-5 py-3.5 border-r border-white/10 w-[240px]">
                    Đối tượng
                  </th>
                  <th className="px-5 py-3.5 border-r border-white/10 w-[200px] text-amber-400">
                    Giá cộng thêm (VNĐ)
                  </th>
                  <th className="px-5 py-3.5 border-r border-white/10 text-center">
                    <div>Ghế thường {formatVnd(currentRoom.standardPrice)}</div>
                    <div className="text-[9.5px] text-neutral-500 font-normal uppercase mt-0.5">Giá bán cuối cùng</div>
                  </th>
                  <th className="px-5 py-3.5 border-r border-white/10 text-center">
                    <div>Ghế VIP {formatVnd(currentRoom.vipPrice)}</div>
                    <div className="text-[9.5px] text-amber-500/70 font-normal uppercase mt-0.5">Giá bán cuối cùng</div>
                  </th>
                  <th className="px-5 py-3.5 text-center">
                    <div>Ghế Đôi {formatVnd(currentRoom.couplePrice)}</div>
                    <div className="text-[9.5px] text-pink-400/70 font-normal uppercase mt-0.5">Bán theo cặp vé</div>
                  </th>
                  <th className="px-4 py-3.5 text-center w-[90px]">
                    Thao tác
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/10">
                {['CHILD', 'STUDENT', 'ADULT'].map((typeKey) => {
                  const meta = AUDIENCE_META[typeKey];
                  const IconComp = meta.icon;
                  const surcharge = Number(audiencePrices[typeKey]) || 0;

                  // Final calculated prices
                  const finalStandard = Number(currentRoom.standardPrice || 0) + surcharge;
                  const finalVip = Number(currentRoom.vipPrice || 0) + surcharge;
                  // For couple seat, calculate pair surcharge (base + surcharge * 2)
                  const finalCouple = Number(currentRoom.couplePrice || 0) + surcharge * 2;

                  const isSavingThis = savingAudienceType === typeKey;

                  return (
                    <tr key={typeKey} className="hover:bg-white/[0.03] transition">
                      {/* Cột 1: Đối tượng */}
                      <td className="px-5 py-3.5 border-r border-white/10">
                        <div className="flex items-center gap-2.5">
                          <span
                            className="p-1.5 rounded-none border"
                            style={{
                              backgroundColor: `${meta.accentColor}15`,
                              borderColor: `${meta.accentColor}30`,
                              color: meta.accentColor
                            }}
                          >
                            <IconComp className="w-4 h-4" />
                          </span>
                          <div>
                            <div className="text-xs font-black text-white uppercase tracking-wide">
                              {meta.label}
                            </div>
                            <div className="text-[10px] text-neutral-400 mt-0.5">
                              {meta.subtitle}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Cột 2: Giá cộng thêm (Admin/Manager can edit) */}
                      <td className="px-5 py-3.5 border-r border-white/10">
                        <div className="relative">
                          <input
                            type="number"
                            step="1000"
                            min="0"
                            max="500000"
                            value={audiencePrices[typeKey]}
                            onChange={(e) => {
                              const val = Math.max(0, Math.min(500000, Number(e.target.value) || 0));
                              setAudiencePrices((prev) => ({ ...prev, [typeKey]: val }));
                            }}
                            className="w-full px-2.5 py-1.5 bg-black/80 border border-white/20 rounded-none text-xs font-mono font-black text-amber-400 focus:border-amber-400 focus:outline-none"
                            placeholder="0"
                          />
                          <span className="text-[9.5px] text-neutral-500 mt-1 block">
                            Nhập 0đ nếu không phụ thu
                          </span>
                        </div>
                      </td>

                      {/* Cột 3: Ghế thường (In đậm giá bán cuối cùng) */}
                      <td className="px-5 py-3.5 border-r border-white/10 text-center">
                        <div className="text-sm sm:text-base font-black text-white tracking-wide">
                          {formatVnd(finalStandard)}
                        </div>
                        <div className="text-[9.5px] text-neutral-400 font-mono mt-0.5">
                          (= {formatVnd(currentRoom.standardPrice)} + {formatVnd(surcharge)})
                        </div>
                      </td>

                      {/* Cột 4: Ghế VIP (In đậm giá bán cuối cùng) */}
                      <td className="px-5 py-3.5 border-r border-white/10 text-center bg-amber-500/[0.02]">
                        <div className="text-sm sm:text-base font-black text-amber-400 tracking-wide">
                          {formatVnd(finalVip)}
                        </div>
                        <div className="text-[9.5px] text-amber-400/70 font-mono mt-0.5">
                          (= {formatVnd(currentRoom.vipPrice)} + {formatVnd(surcharge)})
                        </div>
                      </td>

                      {/* Cột 5: Ghế Đôi (In đậm giá bán cuối cùng) */}
                      <td className="px-5 py-3.5 text-center bg-pink-500/[0.02]">
                        <div className="text-sm sm:text-base font-black text-pink-400 tracking-wide">
                          {formatVnd(finalCouple)}
                        </div>
                        <div className="text-[9.5px] text-pink-400/70 font-mono mt-0.5">
                          (= {formatVnd(currentRoom.couplePrice)} + 2x {formatVnd(surcharge)})
                        </div>
                      </td>

                      {/* Cột 6: Thao tác Lưu từng dòng */}
                      <td className="px-4 py-3.5 text-center">
                        <button
                          type="button"
                          onClick={() => handleSaveSingleAudience(typeKey)}
                          disabled={isSavingThis || loadingAudience || isSavingAllAudience}
                          className="px-2.5 py-1 text-[10px] font-black uppercase tracking-wider bg-white/5 hover:bg-white/10 text-neutral-200 border border-white/15 rounded-none transition disabled:opacity-50 flex items-center justify-center gap-1 mx-auto"
                          title="Lưu giá cho đối tượng này"
                        >
                          <Save className={`w-3 h-3 ${isSavingThis ? 'animate-spin text-amber-400' : ''}`} />
                          <span>Lưu</span>
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Footer Note */}
          <div className="p-3 bg-black/40 border-t border-white/10 text-[10.5px] text-neutral-400 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <div className="flex items-center gap-2">
              <Info className="w-3.5 h-3.5 text-amber-400 shrink-0" />
              <span>
                Khi khách hàng đặt vé trên website/app, Backend sẽ tự động lấy giá ghế của phòng này cộng với giá phụ thu đối tượng đã cấu hình để tính tiền vé.
              </span>
            </div>

            <button
              onClick={() => setIsEditRoomModalOpen(true)}
              className="text-amber-400 hover:text-amber-300 font-bold uppercase transition text-[10.5px] shrink-0"
            >
              Chỉnh sửa giá gốc phòng chiếu &rarr;
            </button>
          </div>
        </div>
      )}

      {/* 5. VIEW ALL ROOMS MATRIX (Tất cả phòng trong chi nhánh) */}
      {viewMode === 'ALL_ROOMS' && (
        <div className="border border-white/15 bg-[#12161c] rounded-none shadow-2xl overflow-hidden">
          <div className="p-3.5 bg-black/60 border-b border-white/10 flex items-center justify-between">
            <div>
              <h3 className="text-xs sm:text-sm font-black text-white uppercase tracking-wide">
                Ma Trận Tổng Hợp Giá Vé Tất Cả Các Phòng - {currentCinema?.name}
              </h3>
              <p className="text-[10.5px] text-neutral-400 mt-0.5">
                Xem tổng quan giá bán cuối cùng của tất cả các phòng chiếu trong chi nhánh này.
              </p>
            </div>
            <button
              onClick={handleSaveAllAudience}
              disabled={isSavingAllAudience || loadingAudience}
              className="flex items-center gap-1.5 px-3.5 py-1.5 text-[11px] font-black text-black bg-amber-400 hover:bg-amber-300 border border-amber-400 rounded-none uppercase transition disabled:opacity-50"
            >
              <Save className="w-3 h-3" />
              <span>Lưu Cấu Hình Giá</span>
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-neutral-300 border-collapse">
              <thead>
                <tr className="border-b border-white/15 bg-black/80 text-[10px] font-black uppercase tracking-wider text-neutral-400">
                  <th className="px-4 py-3 border-r border-white/10">Phòng chiếu</th>
                  <th className="px-4 py-3 border-r border-white/10">Loại phòng</th>
                  <th className="px-4 py-3 border-r border-white/10 text-center">Ghế Thường (Gốc)</th>
                  <th className="px-4 py-3 border-r border-white/10 text-center">
                    <span className="text-sky-400">Trẻ em (+{formatVnd(audiencePrices.CHILD)})</span>
                  </th>
                  <th className="px-4 py-3 border-r border-white/10 text-center">
                    <span className="text-emerald-400">Sinh viên (+{formatVnd(audiencePrices.STUDENT)})</span>
                  </th>
                  <th className="px-4 py-3 border-r border-white/10 text-center">
                    <span className="text-amber-400">Người lớn (+{formatVnd(audiencePrices.ADULT)})</span>
                  </th>
                  <th className="px-4 py-3 text-center">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {rooms.map((room) => {
                  const sPrice = Number(room.standardPrice || 0);
                  const vPrice = Number(room.vipPrice || 0);

                  return (
                    <tr key={room.id} className="hover:bg-white/[0.02] transition">
                      <td className="px-4 py-3 font-bold text-white border-r border-white/10">
                        {room.name}
                      </td>
                      <td className="px-4 py-3 border-r border-white/10">
                        <span className="px-1.5 py-0.2 bg-white/10 text-neutral-300 text-[9.5px] uppercase font-mono">
                          {room.roomType}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center font-mono text-neutral-300 border-r border-white/10">
                        <div>Thường: {formatVnd(sPrice)}</div>
                        <div className="text-amber-400/80 text-[10px]">VIP: {formatVnd(vPrice)}</div>
                      </td>

                      {/* Trẻ em */}
                      <td className="px-4 py-3 text-center border-r border-white/10 font-mono">
                        <div className="font-black text-sky-400 text-[12px]">{formatVnd(sPrice + Number(audiencePrices.CHILD))}</div>
                        <div className="text-[10px] text-sky-400/70">VIP: {formatVnd(vPrice + Number(audiencePrices.CHILD))}</div>
                      </td>

                      {/* Sinh viên */}
                      <td className="px-4 py-3 text-center border-r border-white/10 font-mono">
                        <div className="font-black text-emerald-400 text-[12px]">{formatVnd(sPrice + Number(audiencePrices.STUDENT))}</div>
                        <div className="text-[10px] text-emerald-400/70">VIP: {formatVnd(vPrice + Number(audiencePrices.STUDENT))}</div>
                      </td>

                      {/* Người lớn */}
                      <td className="px-4 py-3 text-center border-r border-white/10 font-mono">
                        <div className="font-black text-amber-400 text-[12px]">{formatVnd(sPrice + Number(audiencePrices.ADULT))}</div>
                        <div className="text-[10px] text-amber-400/70">VIP: {formatVnd(vPrice + Number(audiencePrices.ADULT))}</div>
                      </td>

                      <td className="px-4 py-3 text-center">
                        <button
                          onClick={() => {
                            setSelectedRoomId(room.id);
                            setViewMode('BY_ROOM');
                          }}
                          className="px-2.5 py-1 text-[10px] font-bold text-amber-400 bg-amber-400/10 hover:bg-amber-400/20 border border-amber-400/30 uppercase transition"
                        >
                          Chi tiết
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 6. MODAL: EDIT ROOM BASE PRICES */}
      {isEditRoomModalOpen && currentRoom && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="relative w-full max-w-md rounded-none bg-[#12161c] border border-white/20 p-5 shadow-2xl">
            <button
              onClick={() => setIsEditRoomModalOpen(false)}
              className="absolute top-4 right-4 text-neutral-400 hover:text-white p-1 hover:bg-white/10 rounded-none transition"
            >
              <X className="w-4 h-4" />
            </button>

            <h2 className="text-xs sm:text-sm font-black text-white mb-1 flex items-center gap-1.5 uppercase tracking-wide">
              <Edit3 className="w-4 h-4 text-amber-400" />
              <span>Chỉnh Sửa Giá Gốc: {currentRoom.name}</span>
            </h2>
            <p className="text-[11px] text-neutral-400 mb-4">
              Thay đổi giá gốc của các loại ghế trong phòng chiếu này. Bảng giá bán vé theo đối tượng sẽ tự động cộng dồn theo giá mới.
            </p>

            <form onSubmit={handleSaveRoomBasePrices} className="space-y-3.5">
              <div>
                <label className="block text-[10px] font-bold text-neutral-300 uppercase tracking-wider mb-1">
                  Giá Ghế Thường (STANDARD) <span className="text-amber-400">*</span>
                </label>
                <div className="relative">
                  <input
                    type="number"
                    step="1000"
                    min="0"
                    value={roomBasePrices.standardPrice}
                    onChange={(e) => setRoomBasePrices({ ...roomBasePrices, standardPrice: e.target.value })}
                    className="w-full px-2.5 py-1.5 bg-black/80 border border-white/15 rounded-none text-xs font-mono font-black text-white focus:border-amber-400 focus:outline-none"
                    placeholder="60000"
                    required
                  />
                  <span className="absolute right-3 top-1.5 text-[11px] text-neutral-400 font-bold">
                    {formatVnd(roomBasePrices.standardPrice)}
                  </span>
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-neutral-300 uppercase tracking-wider mb-1">
                  Giá Ghế VIP <span className="text-amber-400">*</span>
                </label>
                <div className="relative">
                  <input
                    type="number"
                    step="1000"
                    min="0"
                    value={roomBasePrices.vipPrice}
                    onChange={(e) => setRoomBasePrices({ ...roomBasePrices, vipPrice: e.target.value })}
                    className="w-full px-2.5 py-1.5 bg-black/80 border border-white/15 rounded-none text-xs font-mono font-black text-amber-400 focus:border-amber-400 focus:outline-none"
                    placeholder="90000"
                    required
                  />
                  <span className="absolute right-3 top-1.5 text-[11px] text-neutral-400 font-bold">
                    {formatVnd(roomBasePrices.vipPrice)}
                  </span>
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-neutral-300 uppercase tracking-wider mb-1">
                  Giá Ghế Đôi (COUPLE - Cặp vé) <span className="text-amber-400">*</span>
                </label>
                <div className="relative">
                  <input
                    type="number"
                    step="1000"
                    min="0"
                    value={roomBasePrices.couplePrice}
                    onChange={(e) => setRoomBasePrices({ ...roomBasePrices, couplePrice: e.target.value })}
                    className="w-full px-2.5 py-1.5 bg-black/80 border border-white/15 rounded-none text-xs font-mono font-black text-pink-400 focus:border-amber-400 focus:outline-none"
                    placeholder="150000"
                    required
                  />
                  <span className="absolute right-3 top-1.5 text-[11px] text-neutral-400 font-bold">
                    {formatVnd(roomBasePrices.couplePrice)}
                  </span>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-white/10">
                <button
                  type="button"
                  onClick={() => setIsEditRoomModalOpen(false)}
                  className="px-3.5 py-1.5 text-[10.5px] font-bold text-neutral-400 hover:text-white uppercase transition rounded-none"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={isSavingRoomPrice}
                  className="px-4 py-1.5 text-[10.5px] font-black text-black bg-amber-400 hover:bg-amber-300 border border-amber-400 uppercase tracking-wider transition rounded-none disabled:opacity-50"
                >
                  {isSavingRoomPrice ? 'Đang lưu...' : 'Lưu Giá Gốc'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
