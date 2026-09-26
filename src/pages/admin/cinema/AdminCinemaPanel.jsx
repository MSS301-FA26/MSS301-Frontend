import React, { useEffect, useState, useMemo } from 'react';
import {
  Building2, Plus, Edit3, Trash2, Power, RefreshCw, Save,
  MapPin, Phone, Globe2, ShieldCheck, CheckCircle2, AlertCircle,
  Search, X, Sparkles, Layers, Info
} from 'lucide-react';
import { adminService } from '../../../services/adminService';

const emptyForm = {
  id: null,
  name: '',
  address: '',
  city: 'TP. Hồ Chí Minh',
  phone: '',
  status: 'ACTIVE'
};

const COMMON_CITIES = ['TP. Hồ Chí Minh', 'Hà Nội', 'Đà Nẵng', 'Hải Phòng', 'Cần Thơ', 'Bình Dương'];

export default function AdminCinemaPanel({ ctx = {} }) {
  const {
    getAdminToken = () => null,
    showToast = () => {},
    addAuditLog = () => {},
    onCinemaChanged = () => {},
    isAdmin = false,
    isManager = false
  } = ctx;

  const [cinemas, setCinemas] = useState([]);
  const [rooms, setRooms] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCity, setSelectedCity] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [modalForm, setModalForm] = useState(emptyForm);
  const [formError, setFormError] = useState('');

  // Delete Confirm State
  const [deleteConfirmId, setDeleteConfirmId] = useState(null);

  const loadData = async () => {
    const token = getAdminToken();
    if (!token) return;
    setIsLoading(true);
    try {
      // 1. Fetch all cinemas
      let cinemaList = [];
      try {
        const res = await adminService.getAdminCinemas(token);
        cinemaList = Array.isArray(res) ? res : (res?.items || res?.content || []);
      } catch (err) {
        try {
          const single = await adminService.getAdminCinema(token);
          if (single) cinemaList = [single];
        } catch (e) {
          console.warn('Fallback single cinema failed:', e);
        }
      }
      setCinemas(cinemaList);

      // 2. Fetch all rooms to count rooms per cinema
      try {
        const roomsRes = await adminService.getAdminRooms(token);
        const roomsList = Array.isArray(roomsRes) ? roomsRes : (roomsRes?.items || roomsRes?.content || []);
        setRooms(roomsList);
      } catch (e) {
        console.warn('Lỗi lấy danh sách phòng:', e);
      }
    } catch (error) {
      showToast(error.message || 'Không thể tải danh sách cụm rạp.', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Filtered cinemas
  const filteredCinemas = useMemo(() => {
    return cinemas.filter((c) => {
      const matchSearch =
        !searchQuery ||
        c.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.address?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.city?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.phone?.includes(searchQuery);

      const matchCity = selectedCity === 'ALL' || c.city === selectedCity;
      const matchStatus = statusFilter === 'ALL' || c.status === statusFilter;

      return matchSearch && matchCity && matchStatus;
    });
  }, [cinemas, searchQuery, selectedCity, statusFilter]);

  // Unique cities list
  const availableCities = useMemo(() => {
    const set = new Set();
    cinemas.forEach((c) => {
      if (c.city) set.add(c.city.trim());
    });
    return Array.from(set);
  }, [cinemas]);

  // Open Create Modal (Admin only)
  const handleOpenCreate = () => {
    if (!isAdmin) {
      showToast('Chỉ Quản trị viên hệ thống (Admin) mới có quyền tạo cụm rạp mới.', 'warning');
      return;
    }
    setModalForm({
      id: null,
      name: '',
      address: '',
      city: 'TP. Hồ Chí Minh',
      phone: '',
      status: 'ACTIVE'
    });
    setFormError('');
    setIsModalOpen(true);
  };

  // Open Edit Modal (Admin only)
  const handleOpenEdit = (cinema) => {
    if (!isAdmin) {
      showToast('Chỉ Quản trị viên hệ thống (Admin) mới có quyền chỉnh sửa chi nhánh rạp.', 'warning');
      return;
    }
    setModalForm({
      id: cinema.id,
      name: cinema.name || '',
      address: cinema.address || '',
      city: cinema.city || '',
      phone: cinema.phone || '',
      status: cinema.status || 'ACTIVE'
    });
    setFormError('');
    setIsModalOpen(true);
  };

  // Submit Modal Form (Create or Update)
  const handleSubmitModal = async (e) => {
    e.preventDefault();
    const token = getAdminToken();
    if (!token) return;

    if (!isAdmin) {
      setFormError('Bạn không có quyền quản trị chi nhánh rạp.');
      return;
    }

    if (!modalForm.name.trim()) {
      setFormError('Vui lòng nhập tên cụm rạp.');
      return;
    }
    if (!modalForm.address.trim()) {
      setFormError('Vui lòng nhập địa chỉ cụm rạp.');
      return;
    }

    setIsSaving(true);
    setFormError('');
    try {
      const payload = {
        name: modalForm.name.trim(),
        address: modalForm.address.trim(),
        city: modalForm.city.trim(),
        phone: modalForm.phone.trim(),
        status: modalForm.status
      };

      if (modalForm.id) {
        // Update
        await adminService.updateAdminCinemaById(token, modalForm.id, payload);
        showToast(`Đã cập nhật cụm rạp "${payload.name}" thành công!`, 'success');
        addAuditLog?.('Cập nhật cụm rạp', `${payload.name} (ID: ${modalForm.id})`);
      } else {
        // Create
        await adminService.createAdminCinema(token, payload);
        showToast(`Đã tạo mới cụm rạp "${payload.name}" thành công!`, 'success');
        addAuditLog?.('Tạo cụm rạp mới', payload.name);
      }

      setIsModalOpen(false);
      await loadData();
      onCinemaChanged?.();
    } catch (err) {
      console.error('Lỗi lưu thông tin rạp:', err);
      const msg =
        err.status === 409 || String(err.message).toLowerCase().includes('already exists')
          ? `Tên rạp "${modalForm.name}" đã tồn tại trên hệ thống. Vui lòng chọn tên khác.`
          : err.message || 'Không thể lưu thông tin rạp.';
      setFormError(msg);
    } finally {
      setIsSaving(false);
    }
  };

  // Toggle Cinema Status
  const handleToggleStatus = async (cinema) => {
    if (!isAdmin) {
      showToast('Chỉ Quản trị viên hệ thống (Admin) mới có quyền đổi trạng thái rạp.', 'warning');
      return;
    }
    const token = getAdminToken();
    if (!token) return;

    const nextStatus = cinema.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
    try {
      await adminService.updateAdminCinemaByIdStatus(token, cinema.id, nextStatus);
      showToast(`Đã chuyển trạng thái rạp "${cinema.name}" sang ${nextStatus === 'ACTIVE' ? 'HOẠT ĐỘNG' : 'TẠM DỪNG'}!`, 'success');
      addAuditLog?.('Đổi trạng thái rạp', `${cinema.name} -> ${nextStatus}`);
      await loadData();
      onCinemaChanged?.();
    } catch (err) {
      showToast(err.message || 'Không thể cập nhật trạng thái rạp.', 'error');
    }
  };

  // Delete or Deactivate Cinema
  const handleDelete = async (id, name) => {
    if (!isAdmin) {
      showToast('Chỉ Quản trị viên hệ thống (Admin) mới có quyền xóa chi nhánh rạp.', 'warning');
      return;
    }
    const token = getAdminToken();
    if (!token) return;

    try {
      await adminService.deleteAdminCinema(token, id);
      showToast(`Đã xử lý xóa/vô hiệu hóa rạp "${name}" thành công!`, 'success');
      addAuditLog?.('Xóa cụm rạp', `${name} (ID: ${id})`);
      setDeleteConfirmId(null);
      await loadData();
      onCinemaChanged?.();
    } catch (err) {
      showToast(err.message || 'Không thể xóa rạp.', 'error');
    }
  };

  return (
    <div className="space-y-6">
      {/* ── TOP STATS & ACTIONS HEADER ──────────────────────────────────────────────────────── */}
      <section className="border border-white/10 bg-[#070707] p-5 sm:p-7 relative overflow-hidden">
        <div className="absolute -right-20 -top-20 h-64 w-64 rounded-full bg-amber-500/5 blur-3xl pointer-events-none" />

        <div className="relative flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
          <div className="max-w-2xl">
            <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.26em] text-amber-400">
              <Building2 className="h-4 w-4" />
              Hệ thống đa cụm rạp toàn quốc
            </div>
            <h2 className="mt-2 text-2xl font-black uppercase tracking-tight text-white sm:text-3xl">
              Quản Lý Toàn Bộ Chi Nhánh Rạp
            </h2>
            <p className="mt-2 max-w-xl text-xs leading-relaxed text-neutral-400">
              {isAdmin
                ? 'Quản trị viên có toàn quyền thêm mới chi nhánh, cấu hình thông tin vận hành, hotline và kích hoạt hoặc tạm dừng rạp.'
                : 'Xem thông tin các cụm rạp và cơ sở hạ tầng phòng chiếu được kết nối trên hệ thống CinemaAI.'}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {isAdmin && (
              <button
                type="button"
                onClick={handleOpenCreate}
                className="flex items-center gap-2 border border-amber-500 bg-amber-500 px-4 py-3 text-[10px] font-black uppercase tracking-[0.16em] text-black shadow-lg shadow-amber-500/20 transition hover:bg-amber-400 cursor-pointer"
              >
                <Plus className="h-4 w-4 stroke-[3]" /> Thêm chi nhánh rạp mới
              </button>
            )}

            <button
              type="button"
              onClick={loadData}
              disabled={isLoading}
              className="flex items-center gap-2 border border-white/10 bg-black/60 px-4 py-3 text-[10px] font-black uppercase tracking-[0.16em] text-neutral-300 transition hover:border-amber-400/50 hover:text-amber-300 cursor-pointer"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? 'animate-spin text-amber-400' : ''}`} /> Làm mới
            </button>
          </div>
        </div>

        {/* Quick Stats bar */}
        <div className="mt-7 grid grid-cols-2 gap-3 border-t border-white/10 pt-5 sm:grid-cols-4">
          <div className="border border-white/5 bg-black/40 p-3.5">
            <span className="text-[9px] font-black uppercase tracking-wider text-neutral-500">Tổng cụm rạp</span>
            <div className="mt-1 text-2xl font-black text-white">{cinemas.length}</div>
          </div>
          <div className="border border-white/5 bg-black/40 p-3.5">
            <span className="text-[9px] font-black uppercase tracking-wider text-emerald-400">Đang hoạt động</span>
            <div className="mt-1 text-2xl font-black text-emerald-400">
              {cinemas.filter((c) => c.status === 'ACTIVE').length}
            </div>
          </div>
          <div className="border border-white/5 bg-black/40 p-3.5">
            <span className="text-[9px] font-black uppercase tracking-wider text-amber-400">Tỉnh / Thành phố</span>
            <div className="mt-1 text-2xl font-black text-amber-400">
              {availableCities.length || 1}
            </div>
          </div>
          <div className="border border-white/5 bg-black/40 p-3.5">
            <span className="text-[9px] font-black uppercase tracking-wider text-cyan-400">Tổng phòng chiếu</span>
            <div className="mt-1 text-2xl font-black text-cyan-400">{rooms.length}</div>
          </div>
        </div>
      </section>

      {/* ── TOOLBAR: SEARCH & FILTERS ───────────────────────────────────────────────────────── */}
      <section className="border border-white/10 bg-[#070707] p-4 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-500" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Tìm theo tên rạp, địa chỉ, số hotline..."
            className="h-10 w-full border border-white/10 bg-black/80 pl-10 pr-4 text-xs text-white placeholder-neutral-500 outline-none transition focus:border-amber-400"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* City Filter */}
          <div className="flex items-center gap-1.5 border border-white/10 bg-black px-3 py-1.5 text-xs text-neutral-300">
            <Globe2 className="h-3.5 w-3.5 text-amber-400" />
            <select
              value={selectedCity}
              onChange={(e) => setSelectedCity(e.target.value)}
              className="bg-transparent text-xs font-bold text-white outline-none cursor-pointer"
            >
              <option value="ALL" className="bg-neutral-900 text-white">Tất cả thành phố</option>
              {availableCities.map((city) => (
                <option key={city} value={city} className="bg-neutral-900 text-white">
                  {city}
                </option>
              ))}
            </select>
          </div>

          {/* Status Filter */}
          <div className="flex items-center border border-white/10 bg-black p-0.5 text-[9px] font-black uppercase tracking-wider">
            <button
              onClick={() => setStatusFilter('ALL')}
              className={`px-3 py-1.5 transition ${statusFilter === 'ALL' ? 'bg-amber-500 text-black font-black' : 'text-neutral-400 hover:text-white'}`}
            >
              Tất cả
            </button>
            <button
              onClick={() => setStatusFilter('ACTIVE')}
              className={`px-3 py-1.5 transition ${statusFilter === 'ACTIVE' ? 'bg-emerald-500 text-black font-black' : 'text-neutral-400 hover:text-white'}`}
            >
              Hoạt động
            </button>
            <button
              onClick={() => setStatusFilter('INACTIVE')}
              className={`px-3 py-1.5 transition ${statusFilter === 'INACTIVE' ? 'bg-rose-500 text-black font-black' : 'text-neutral-400 hover:text-white'}`}
            >
              Tạm dừng
            </button>
          </div>
        </div>
      </section>

      {/* ── CINEMA CARDS GRID ───────────────────────────────────────────────────────────── */}
      <section>
        {isLoading ? (
          <div className="border border-white/10 bg-[#070707] py-20 text-center">
            <RefreshCw className="mx-auto h-8 w-8 animate-spin text-amber-400" />
            <p className="mt-4 text-xs font-bold uppercase tracking-wider text-neutral-400">
              Đang tải danh sách cụm rạp...
            </p>
          </div>
        ) : filteredCinemas.length === 0 ? (
          <div className="border border-white/10 bg-[#070707] py-16 text-center">
            <Building2 className="mx-auto h-12 w-12 text-neutral-600" />
            <h3 className="mt-3 text-sm font-black uppercase tracking-wide text-neutral-300">
              Không tìm thấy cụm rạp nào phù hợp
            </h3>
            <p className="mt-1 text-xs text-neutral-500">
              Thử thay đổi từ khóa tìm kiếm hoặc bấm nút "Thêm chi nhánh rạp mới".
            </p>
            {isAdmin && (
              <button
                onClick={handleOpenCreate}
                className="mt-5 inline-flex items-center gap-2 border border-amber-500/40 bg-amber-500/10 px-5 py-2.5 text-[9px] font-black uppercase tracking-[0.2em] text-amber-400 hover:bg-amber-500 hover:text-black transition cursor-pointer"
              >
                <Plus className="h-3.5 w-3.5" /> Tạo cụm rạp ngay
              </button>
            )}
          </div>
        ) : (
          <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-2">
            {filteredCinemas.map((cinema) => {
              const isActive = cinema.status === 'ACTIVE';
              const cinemaRooms = rooms.filter((r) => r.cinemaId === cinema.id || r.cinemaName === cinema.name);

              return (
                <div
                  key={cinema.id}
                  className={`group relative border transition-all duration-300 bg-[#080808] p-5 sm:p-6 ${
                    isActive
                      ? 'border-white/10 hover:border-amber-500/50 hover:shadow-lg hover:shadow-amber-500/5'
                      : 'border-white/5 opacity-75 hover:opacity-100 hover:border-white/20'
                  }`}
                >
                  {/* Top Bar: Name, City, Status */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="inline-block border border-amber-500/40 bg-amber-500/10 px-2 py-0.5 text-[8.5px] font-black uppercase tracking-widest text-amber-400">
                          {cinema.city || 'Toàn quốc'}
                        </span>
                        <span className="text-[9px] font-mono text-neutral-500">ID #{cinema.id}</span>
                      </div>
                      <h3 className="mt-2 text-lg font-black uppercase tracking-tight text-white group-hover:text-amber-400 transition-colors">
                        {cinema.name}
                      </h3>
                    </div>

                    <span
                      className={`inline-flex items-center gap-1.5 border px-2.5 py-1 text-[8px] font-black uppercase tracking-[0.16em] ${
                        isActive
                          ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400'
                          : 'border-rose-500/30 bg-rose-500/10 text-rose-400'
                      }`}
                    >
                      <span className={`h-1.5 w-1.5 rounded-full ${isActive ? 'bg-emerald-400 animate-pulse' : 'bg-rose-400'}`} />
                      {isActive ? 'Hoạt động' : 'Tạm dừng'}
                    </span>
                  </div>

                  {/* Details */}
                  <div className="mt-4 space-y-2 border-t border-white/5 pt-4 text-xs">
                    <div className="flex items-start gap-2.5 text-neutral-300">
                      <MapPin className="h-4 w-4 shrink-0 text-amber-500/80 mt-0.5" />
                      <span className="line-clamp-2 leading-relaxed">{cinema.address || 'Chưa cập nhật địa chỉ'}</span>
                    </div>

                    <div className="flex items-center gap-2.5 text-neutral-300">
                      <Phone className="h-3.5 w-3.5 shrink-0 text-amber-500/80" />
                      <span className="font-mono">{cinema.phone || 'Chưa có hotline'}</span>
                    </div>

                    <div className="flex items-center gap-2.5 text-neutral-400 pt-1">
                      <Layers className="h-3.5 w-3.5 shrink-0 text-cyan-400" />
                      <span className="font-bold text-neutral-200">
                        {cinemaRooms.length > 0 ? (
                          <span className="text-cyan-400">{cinemaRooms.length} phòng chiếu đang kết nối</span>
                        ) : (
                          <span className="text-neutral-500">Chưa có phòng chiếu nào</span>
                        )}
                      </span>
                    </div>
                  </div>

                  {/* Action buttons (Admin only) */}
                  <div className="mt-5 flex items-center justify-between border-t border-white/10 pt-4">
                    {isAdmin ? (
                      <>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => handleOpenEdit(cinema)}
                            className="flex items-center gap-1.5 border border-white/10 bg-white/5 px-3 py-2 text-[9px] font-black uppercase tracking-wider text-neutral-200 transition hover:border-amber-400/50 hover:bg-amber-400/10 hover:text-amber-300 cursor-pointer"
                          >
                            <Edit3 className="h-3 w-3" /> Chỉnh sửa
                          </button>

                          <button
                            type="button"
                            onClick={() => handleToggleStatus(cinema)}
                            className={`flex items-center gap-1.5 border px-3 py-2 text-[9px] font-black uppercase tracking-wider transition cursor-pointer ${
                              isActive
                                ? 'border-white/10 bg-white/5 text-neutral-400 hover:border-rose-500/40 hover:text-rose-400'
                                : 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20'
                            }`}
                          >
                            <Power className="h-3 w-3" /> {isActive ? 'Tạm dừng' : 'Kích hoạt'}
                          </button>
                        </div>

                        {deleteConfirmId === cinema.id ? (
                          <div className="flex items-center gap-2">
                            <span className="text-[9px] font-bold text-rose-400">Xóa rạp?</span>
                            <button
                              type="button"
                              onClick={() => handleDelete(cinema.id, cinema.name)}
                              className="border border-rose-500 bg-rose-500 px-2.5 py-1.5 text-[8.5px] font-black uppercase text-white hover:bg-rose-600"
                            >
                              Xóa
                            </button>
                            <button
                              type="button"
                              onClick={() => setDeleteConfirmId(null)}
                              className="border border-white/10 px-2 py-1.5 text-[8.5px] text-neutral-400 hover:text-white"
                            >
                              Hủy
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setDeleteConfirmId(cinema.id)}
                            className="text-neutral-500 hover:text-rose-400 transition p-1.5 cursor-pointer"
                            title="Xóa cụm rạp"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        )}
                      </>
                    ) : (
                      <span className="text-[10px] text-neutral-500 font-mono italic">
                        Chi nhánh trực thuộc CinemaAI
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* ── MODAL: CREATE / EDIT CINEMA (Admin Only) ───────────────────────────────────────── */}
      {isModalOpen && isAdmin && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full max-w-lg border border-white/15 bg-[#0a0a0a] shadow-2xl relative">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-white/10 px-6 py-4">
              <div className="flex items-center gap-2 text-xs font-black uppercase tracking-wider text-amber-400">
                <Building2 className="h-4 w-4" />
                {modalForm.id ? `Chỉnh sửa cụm rạp #${modalForm.id}` : 'Thêm chi nhánh rạp mới'}
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="text-neutral-400 hover:text-white transition cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleSubmitModal} className="p-6 space-y-4">
              {formError && (
                <div className="flex items-center gap-2.5 border border-rose-500/40 bg-rose-500/10 p-3 text-xs text-rose-300">
                  <AlertCircle className="h-4 w-4 shrink-0 text-rose-400" />
                  <span>{formError}</span>
                </div>
              )}

              {/* Tên cụm rạp */}
              <label className="block space-y-1.5">
                <span className="text-[10px] font-black uppercase tracking-wider text-neutral-300">
                  Tên cụm rạp <span className="text-amber-400">*</span>
                </span>
                <input
                  type="text"
                  required
                  value={modalForm.name}
                  onChange={(e) => setModalForm({ ...modalForm, name: e.target.value })}
                  placeholder="Ví dụ: CinemaAI Landmark 81"
                  className="h-11 w-full border border-white/10 bg-black px-3.5 text-xs text-white placeholder-neutral-600 outline-none transition focus:border-amber-400"
                />
              </label>

              {/* Tỉnh / Thành phố */}
              <div className="grid grid-cols-2 gap-3">
                <label className="block space-y-1.5">
                  <span className="text-[10px] font-black uppercase tracking-wider text-neutral-300">
                    Tỉnh / Thành phố
                  </span>
                  <input
                    type="text"
                    value={modalForm.city}
                    onChange={(e) => setModalForm({ ...modalForm, city: e.target.value })}
                    placeholder="TP. Hồ Chí Minh"
                    list="city-suggestions"
                    className="h-11 w-full border border-white/10 bg-black px-3.5 text-xs text-white placeholder-neutral-600 outline-none transition focus:border-amber-400"
                  />
                  <datalist id="city-suggestions">
                    {COMMON_CITIES.map((c) => (
                      <option key={c} value={c} />
                    ))}
                  </datalist>
                </label>

                {/* Hotline */}
                <label className="block space-y-1.5">
                  <span className="text-[10px] font-black uppercase tracking-wider text-neutral-300">
                    Số điện thoại hotline
                  </span>
                  <input
                    type="text"
                    value={modalForm.phone}
                    onChange={(e) => setModalForm({ ...modalForm, phone: e.target.value })}
                    placeholder="0901234567"
                    className="h-11 w-full border border-white/10 bg-black px-3.5 text-xs text-white placeholder-neutral-600 outline-none transition focus:border-amber-400 font-mono"
                  />
                </label>
              </div>

              {/* Địa chỉ đầy đủ */}
              <label className="block space-y-1.5">
                <span className="text-[10px] font-black uppercase tracking-wider text-neutral-300">
                  Địa chỉ chi tiết <span className="text-amber-400">*</span>
                </span>
                <textarea
                  required
                  rows={3}
                  value={modalForm.address}
                  onChange={(e) => setModalForm({ ...modalForm, address: e.target.value })}
                  placeholder="Ví dụ: Tầng B1, Tòa nhà Landmark 81, 720A Điện Biên Phủ, P. 22, Bình Thạnh"
                  className="w-full border border-white/10 bg-black p-3.5 text-xs text-white placeholder-neutral-600 outline-none transition focus:border-amber-400 resize-none"
                />
              </label>

              {/* Trạng thái */}
              <label className="block space-y-1.5">
                <span className="text-[10px] font-black uppercase tracking-wider text-neutral-300">
                  Trạng thái hoạt động
                </span>
                <select
                  value={modalForm.status}
                  onChange={(e) => setModalForm({ ...modalForm, status: e.target.value })}
                  className="h-11 w-full border border-white/10 bg-black px-3 text-xs font-bold text-white outline-none transition focus:border-amber-400 cursor-pointer"
                >
                  <option value="ACTIVE" className="bg-neutral-900 text-emerald-400">
                    Đang hoạt động (Hiển thị cho khách hàng đặt vé)
                  </option>
                  <option value="INACTIVE" className="bg-neutral-900 text-rose-400">
                    Tạm dừng (Bảo trì hoặc đóng cửa tạm thời)
                  </option>
                </select>
              </label>

              {/* Buttons */}
              <div className="flex items-center justify-end gap-3 pt-4 border-t border-white/10">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="border border-white/10 bg-transparent px-4 py-2.5 text-xs font-bold uppercase tracking-wider text-neutral-400 hover:text-white transition cursor-pointer"
                >
                  Hủy bỏ
                </button>

                <button
                  type="submit"
                  disabled={isSaving}
                  className="flex items-center gap-2 border border-amber-500 bg-amber-500 px-6 py-2.5 text-xs font-black uppercase tracking-wider text-black hover:bg-amber-400 transition disabled:opacity-50 cursor-pointer"
                >
                  <Save className="h-4 w-4" />
                  {isSaving ? 'Đang lưu...' : modalForm.id ? 'Cập nhật' : 'Tạo mới'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
