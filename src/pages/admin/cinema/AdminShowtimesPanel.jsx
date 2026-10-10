import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { adminService } from '../../../services/adminService';
import { movieService } from '../../../services/movieService';

/* ================= CONSTANTS & HELPERS ================= */
const CLEAN = 15; // 15 phút dọn phòng
const ADS = 10;   // 10 phút quảng cáo
const OPEN = 8;   // Giờ mở cửa 08:00
const CLOSE = 25; // 01:00 sáng hôm sau (25h)
const DOW = ['Chủ nhật', 'Thứ hai', 'Thứ ba', 'Thứ tư', 'Thứ năm', 'Thứ sáu', 'Thứ bảy'];

const MOVIE_PALETTE = [
  '#dc2626', '#7c3aed', '#0ea5e9', '#ea580c', '#0d9488',
  '#e11d48', '#10b981', '#8b5cf6', '#f59e0b', '#0284c7'
];

const pad = (n) => String(n).padStart(2, '0');
const todayStr = () => {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

const getTomorrowStr = () => {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

const getApiErrorMessage = (err, fallback = 'Có lỗi xảy ra khi thực hiện thao tác.') => {
  if (!err) return fallback;
  const data = err?.response?.data;
  if (Array.isArray(data?.errors) && data.errors.length > 0) {
    return data.errors.map(e => e.message || `${e.field}: không hợp lệ`).join('; ');
  }
  if (data?.message) return data.message;
  return err?.message || fallback;
};
const toMin = (t) => {
  if (!t) return 0;
  const [h, m] = t.split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
};
const toT = (m) => {
  const safeM = Math.max(0, m);
  const h = Math.floor(safeM / 60) % 24;
  const min = safeM % 60;
  return `${pad(h)}:${pad(min)}`;
};
const fmtVN = (n) => (n || 0).toLocaleString('vi-VN');
const addDays = (s, n) => {
  const d = new Date(s + 'T00:00:00');
  d.setDate(d.getDate() + n);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};
const normalizeDateStr = (dateVal) => {
  if (!dateVal) return '';
  if (typeof dateVal === 'string' && dateVal.includes('T')) return dateVal.split('T')[0];
  return String(dateVal).slice(0, 10);
};

const DEFAULT_PRICES = {
  '2D': { std: 60000, vip: 90000, couple: 150000 },
  '3D': { std: 80000, vip: 110000, couple: 180000 },
  'IMAX': { std: 120000, vip: 160000, couple: 280000 },
  '4DX': { std: 140000, vip: 180000, couple: 300000 },
};

/* ================= RESIZABLE SPLITTER COMPONENT ================= */
function Splitter({ onDrag, isDragging, title = "Kéo để thay đổi độ rộng" }) {
  const [hovered, setHovered] = useState(false);

  return (
    <div
      role="separator"
      aria-orientation="vertical"
      title={title}
      draggable={false}
      className={`schedule-splitter ${isDragging ? 'is-dragging' : ''} ${hovered ? 'is-hovered' : ''}`}
      onMouseDown={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onDrag(e);
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <div className="splitter-line" />
      <div className="splitter-handle">
        <span className="splitter-dot" />
        <span className="splitter-dot" />
        <span className="splitter-dot" />
      </div>
    </div>
  );
}

export default function AdminShowtimesPanel({ ctx }) {
  const { getAdminToken, showToast, moviesList, isManager = false, isAdmin = false, currentUser = null } = ctx || {};
  const userRole = (currentUser?.role || currentUser?.roles?.[0] || '').toUpperCase();
  const isEffectiveAdmin = isAdmin || userRole.includes('ADMIN');
  const isEffectiveManager = !isEffectiveAdmin && (isManager || userRole.includes('MANAGER'));
  const managerCinemaId = isEffectiveManager && currentUser?.cinemaId ? String(currentUser.cinemaId) : null;
  const getTokenRef = useRef(getAdminToken);
  useEffect(() => { getTokenRef.current = getAdminToken; }, [getAdminToken]);

  /* State */
  const [date, setDate] = useState(() => getTomorrowStr());
  const [view, setView] = useState('day'); // 'day' | 'week'
  const [rooms, setRooms] = useState([]);
  const [adminMovies, setAdminMovies] = useState([]);
  const [shows, setShows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [cinemas, setCinemas] = useState([]);
  const [selectedCinemaId, setSelectedCinemaId] = useState(managerCinemaId || ctx?.assignedCinema?.id ? String(managerCinemaId || ctx?.assignedCinema?.id) : 'ALL');
  const fetchRoomsReqIdRef = useRef(0);
  const fetchShowsReqIdRef = useRef(0);
  const fetchShowtimesRef = useRef(null);
  const [selId, setSelId] = useState(null);
  const [selMovie, setSelMovie] = useState(null);
  const [tabIdx, setTabIdx] = useState(0); // 0: detail, 1: overview, 2: warnings
  const [searchQuery, setSearchQuery] = useState('');
  const [dragGhost, setDragGhost] = useState(null);
  const [draggingShowId, setDraggingShowId] = useState(null);
  const [movieFilter, setMovieFilter] = useState('NOW_SHOWING'); // 'NOW_SHOWING' | 'UPCOMING' | 'ALL'
  const [loadingMovies, setLoadingMovies] = useState(false);

  /* Date Validation Flags (Chính sách cấm tạo suất ở ngày hiện tại/quá khứ) */
  const isToday = date === todayStr();
  const isPast = date < todayStr();
  const isTodayOrPast = date < getTomorrowStr();

  /* Draft Mode & Price Preview State */
  const [isDraftMode, setIsDraftMode] = useState(true);
  const [draftShows, setDraftShows] = useState([]);
  const [previewModal, setPreviewModal] = useState(false);
  const [previewData, setPreviewData] = useState([]);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [isSavingAllDrafts, setIsSavingAllDrafts] = useState(false);

  /* Modals */
  const [addModal, setAddModal] = useState(null);
  const [copyModal, setCopyModal] = useState(false);
  const [cancelModal, setCancelModal] = useState(null);
  const [confirmClearDraftsModal, setConfirmClearDraftsModal] = useState(false);

  /* Price Matrix for Selected Showtime in Detail Panel */
  const [detailPriceMatrix, setDetailPriceMatrix] = useState(null);
  const [loadingDetailPrice, setLoadingDetailPrice] = useState(false);

  useEffect(() => {
    if (!selId) {
      setDetailPriceMatrix(null);
      return;
    }
    const s = findShowById(selId);
    if (!s || !s.movieId || !s.roomId) {
      setDetailPriceMatrix(null);
      return;
    }
    const token = getTokenRef.current?.();
    if (!token) return;

    let cancelled = false;
    setLoadingDetailPrice(true);
    adminService.previewShowtimePrices(token, {
      movieId: Number(s.movieId),
      slots: [{
        roomId: Number(s.roomId),
        startTime: `${s.date}T${s.start || '09:00'}:00`,
        tempId: String(s.id)
      }]
    }).then(res => {
      if (cancelled) return;
      const list = Array.isArray(res) ? res : (res?.data || []);
      if (list.length > 0) {
        setDetailPriceMatrix(list[0]);
      } else {
        setDetailPriceMatrix(null);
      }
    }).catch(err => {
      console.warn('Lỗi lấy ma trận giá chi tiết:', err);
      if (!cancelled) setDetailPriceMatrix(null);
    }).finally(() => {
      if (!cancelled) setLoadingDetailPrice(false);
    });

    return () => { cancelled = true; };
  }, [selId, shows, draftShows]); // eslint-disable-line react-hooks/exhaustive-deps

  /* Timeline Scroll */
  const tlWrapRef = useRef(null);
  const scrolledOnceRef = useRef(false);

  /* Resizable Splitters State */
  const mainContainerRef = useRef(null);
  const [leftWidth, setLeftWidth] = useState(() => {
    try {
      const v = localStorage.getItem('cinema_admin_schedule_left_w');
      return v ? Math.max(200, Math.min(420, Number(v))) : 260;
    } catch { return 260; }
  });
  const [rightWidth, setRightWidth] = useState(() => {
    try {
      const v = localStorage.getItem('cinema_admin_schedule_right_w');
      return v ? Math.max(260, Math.min(500, Number(v))) : 345;
    } catch { return 345; }
  });
  const [isRightPanelOpen, setIsRightPanelOpen] = useState(true);
  const [draggingSplitter, setDraggingSplitter] = useState(null); // 'left' | 'right' | null

  const leftWidthRef = useRef(leftWidth);
  const rightWidthRef = useRef(rightWidth);
  useEffect(() => { leftWidthRef.current = leftWidth; }, [leftWidth]);
  useEffect(() => { rightWidthRef.current = rightWidth; }, [rightWidth]);

  const handleStartDragLeft = useCallback((e) => {
    const startX = e.clientX;
    const startW = leftWidthRef.current;
    setDraggingSplitter('left');
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';

    const onMouseMove = (moveEvent) => {
      moveEvent.preventDefault();
      const deltaX = moveEvent.clientX - startX;
      const containerW = mainContainerRef.current?.getBoundingClientRect().width || window.innerWidth;
      const effectiveRight = isRightPanelOpen ? rightWidthRef.current : 0;
      const maxLeft = Math.max(200, containerW - effectiveRight - 400); // giữ ít nhất 400px cho timeline ở giữa
      const newW = Math.max(200, Math.min(Math.min(420, maxLeft), startW + deltaX));
      setLeftWidth(newW);
    };

    const onMouseUp = () => {
      setDraggingSplitter(null);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
      try {
        localStorage.setItem('cinema_admin_schedule_left_w', String(leftWidthRef.current));
      } catch { /* ignore */ }
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  }, [isRightPanelOpen]);

  const handleStartDragRight = useCallback((e) => {
    const startX = e.clientX;
    const startW = rightWidthRef.current;
    setDraggingSplitter('right');
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';

    const onMouseMove = (moveEvent) => {
      moveEvent.preventDefault();
      const deltaX = startX - moveEvent.clientX; // kéo sang trái làm tăng chiều rộng panel phải
      const containerW = mainContainerRef.current?.getBoundingClientRect().width || window.innerWidth;
      const maxRight = Math.max(260, containerW - leftWidthRef.current - 400); // giữ ít nhất 400px cho timeline ở giữa
      const newW = Math.max(260, Math.min(Math.min(500, maxRight), startW + deltaX));
      setRightWidth(newW);
    };

    const onMouseUp = () => {
      setDraggingSplitter(null);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
      try {
        localStorage.setItem('cinema_admin_schedule_right_w', String(rightWidthRef.current));
      } catch { /* ignore */ }
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  }, []);

  /* ================= FETCH MOVIES TỪ BE (NOW SHOWING & ALL) ================= */
  const fetchMovies = useCallback(async () => {
    setLoadingMovies(true);
    try {
      const token = getTokenRef.current?.();
      let list = [];

      // 1. Thử gọi API Admin (nếu có token)
      if (token) {
        try {
          const res = await adminService.searchAdminMovies(token, { size: 100 });
          list = Array.isArray(res) ? res : (res?.content || res?.items || []);
        } catch (e) {
          console.warn('adminService.searchAdminMovies không thành công, thử fallback sang public API:', e);
        }
      }

      // 2. Fallback gọi public API /api/v1/movies (luôn hoạt động trực tiếp qua Gateway)
      if (!list || list.length === 0) {
        try {
          const publicRes = await movieService.searchMovies({ size: 100 });
          list = Array.isArray(publicRes) ? publicRes : (publicRes?.content || publicRes?.items || []);
        } catch (e) {
          console.warn('Lỗi searchMovies public:', e);
        }
      }

      if (list && list.length > 0) {
        setAdminMovies(list);
      }
    } catch (err) {
      console.warn('Lỗi tải danh sách phim từ BE:', err);
    } finally {
      setLoadingMovies(false);
    }
  }, []);

  /* ================= LOAD CINEMAS TỪ BE ================= */
  const loadCinemas = useCallback(async () => {
    try {
      const token = getTokenRef.current?.();
      if (!token) return;
      const res = await adminService.getAdminCinemas(token);
      const list = Array.isArray(res) ? res : (res?.items || res?.content || []);
      setCinemas(list);
      if (list.length > 0) {
        setSelectedCinemaId((prev) => (isEffectiveManager || prev === 'ALL' || !prev) ? String(list[0].id) : prev);
      }
    } catch (e) {
      console.warn('Lỗi lấy danh sách rạp:', e);
    }
  }, []);

  /* ================= FETCH ROOMS TỪ BE ================= */
  const fetchRooms = useCallback(async (filterCinemaId = selectedCinemaId) => {
    const reqId = ++fetchRoomsReqIdRef.current;
    try {
      const token = getTokenRef.current?.();
      let list = [];
      if (token) {
        try {
          const cId = filterCinemaId !== 'ALL' && filterCinemaId ? Number(filterCinemaId) : null;
          const res = await adminService.getAdminRooms(token, cId);
          if (reqId !== fetchRoomsReqIdRef.current) return;
          list = Array.isArray(res) ? res : (res?.content || res?.items || []);
        } catch (e) {
          console.warn('Lỗi getAdminRooms:', e);
        }
      }
      if (reqId !== fetchRoomsReqIdRef.current) return;
      const formatted = (list || []).map((r, i) => ({
        id: r.id || r.roomId,
        name: r.name || `Phòng ${pad(i + 1)}`,
        type: r.type || r.roomType || '2D',
        seats: r.totalSeats || r.seatCount || 80,
        active: r.active !== false && r.status !== 'INACTIVE',
        standardPrice: Number(r.standardPrice || r.price?.std || 60000),
        vipPrice: Number(r.vipPrice || r.price?.vip || 80000),
        couplePrice: Number(r.couplePrice || r.price?.couple || 140000),
        price: r.price || { std: Number(r.standardPrice || 60000), vip: Number(r.vipPrice || 80000), couple: Number(r.couplePrice || 140000) }
      }));
      setRooms(formatted);
    } catch (err) {
      console.warn('Lỗi lấy danh sách phòng:', err);
    }
  }, [selectedCinemaId]);

  const fetchRoomsRef = useRef(fetchRooms);
  useEffect(() => { fetchRoomsRef.current = fetchRooms; }, [fetchRooms]);

  const fetchMoviesRef = useRef(fetchMovies);
  useEffect(() => { fetchMoviesRef.current = fetchMovies; }, [fetchMovies]);

  // Initial load only - does NOT re-trigger when user selects a different cinema in dropdown
  useEffect(() => {
    let cancelled = false;
    const initShowtimesData = async () => {
      try {
        const token = getTokenRef.current?.();
        if (!token) return;
        const res = await adminService.getAdminCinemas(token);
        if (cancelled) return;
        const list = Array.isArray(res) ? res : (res?.items || res?.content || []);
        setCinemas(list);
        const defaultCId = managerCinemaId || (list.length > 0 ? String(list[0].id) : 'ALL');
        setSelectedCinemaId(defaultCId);
        await fetchRoomsRef.current?.(defaultCId);
        if (cancelled) return;
        await fetchShowtimesRef.current?.(date, defaultCId);
        if (cancelled) return;
        await fetchMoviesRef.current?.();
      } catch (e) {
        console.warn('Lỗi khởi tạo showtimes:', e);
      }
    };
    initShowtimesData();
    return () => { cancelled = true; };
  }, [managerCinemaId]); // eslint-disable-line react-hooks/exhaustive-deps

  /* Merged Movies List từ Backend */
  const movies = useMemo(() => {
    const raw = adminMovies.length > 0 ? adminMovies : (moviesList || []);
    return raw.map((m, i) => {
      const dur = Number(m.duration || m.durationMinutes || 120);
      const formats = m.formats || (m.type ? [m.type] : ['2D', '3D', 'IMAX']);
      const age = m.ageRating || m.rating || (m.age ? `T${m.age}` : 'P');
      const release = normalizeDateStr(m.releaseDate || m.startDate || '2026-09-10');
      const end = normalizeDateStr(m.endDate || '2026-11-24');
      const color = m.color || MOVIE_PALETTE[i % MOVIE_PALETTE.length];
      const status = String(m.status || m.movieStatus || 'NOW_SHOWING').toUpperCase();
      return {
        id: m.id || m.backendId || i + 1,
        title: m.title || 'Phim chưa đặt tên',
        dur: dur > 0 ? dur : 120,
        formats: Array.isArray(formats) ? formats : ['2D'],
        age: age || 'P',
        color,
        release,
        end,
        hot: Boolean(m.isHot || m.featured || m.hot),
        lang: m.language || 'Tiếng Việt',
        posterUrl: m.posterUrl || m.poster || m.avatarUrl || null,
        status
      };
    });
  }, [adminMovies, moviesList]);

  /* ================= CALL API LOAD SHOWTIMES ================= */
  const fetchShowtimes = useCallback(async (targetDate = date, filterCinemaId = selectedCinemaId) => {
    const token = getTokenRef.current?.();
    if (!token) return;

    const reqId = ++fetchShowsReqIdRef.current;
    setLoading(true);
    try {
      const cId = filterCinemaId !== 'ALL' && filterCinemaId ? Number(filterCinemaId) : undefined;
      // Gọi API lấy danh sách suất chiếu (hỗ trợ phân trang và filter cinemaId)
      const resAll = await adminService.getAdminShowtimes(token, { ...(cId ? { cinemaId: cId } : {}), page: 0, size: 100 });
      if (reqId !== fetchShowsReqIdRef.current) return;
      let itemsAll = Array.isArray(resAll) ? resAll : (resAll?.content || resAll?.items || resAll?.data?.content || []);

      // Nếu targetDate được chỉ định, gọi thêm query theo date để đảm bảo không bị miss
      let itemsDate = [];
      if (targetDate) {
        try {
          const resDate = await adminService.getAdminShowtimes(token, { ...(cId ? { cinemaId: cId } : {}), date: targetDate, page: 0, size: 100 });
          if (reqId !== fetchShowsReqIdRef.current) return;
          itemsDate = Array.isArray(resDate) ? resDate : (resDate?.content || resDate?.items || resDate?.data?.content || []);
        } catch { /* ignore */ }
      }

      if (reqId !== fetchShowsReqIdRef.current) return;

      // Hợp nhất dữ liệu tránh trùng ID
      const mergedMap = new Map();
      [...itemsAll, ...itemsDate].forEach(item => {
        const idKey = String(item.id || item.showtimeId);
        if (idKey) mergedMap.set(idKey, item);
      });
      const combinedItems = Array.from(mergedMap.values());

      const mapped = combinedItems.map(s => {
        const movieId = s.movieId || s.movie?.id || s.movie?.backendId;
        const roomId = s.roomId || s.room?.id;

        // Trích xuất ngày và giờ chính xác từ chuỗi startTime ISO (không bị lệch timezone)
        let showDate = '';
        let showTime = '09:00';
        if (typeof s.startTime === 'string' && s.startTime.includes('T')) {
          const parts = s.startTime.split('T');
          showDate = parts[0];
          showTime = parts[1].slice(0, 5);
        } else if (s.startTime) {
          const dt = new Date(s.startTime);
          showDate = `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}`;
          showTime = `${pad(dt.getHours())}:${pad(dt.getMinutes())}`;
        }

        const foundMovie = movies.find(m => String(m.id) === String(movieId));
        const fmt = s.format || s.projectionType || (foundMovie?.formats?.[0]) || '2D';
        const statusMap = {
          'OPEN': 'open',
          'SCHEDULED': 'plan',
          'CANCELLED': 'cancel',
          'COMPLETED': 'done'
        };

        return {
          id: String(s.id || s.showtimeId || Math.random().toString(36).slice(2, 9)),
          date: showDate || todayStr(),
          roomId: Number(roomId),
          movieId: Number(movieId),
          start: showTime,
          fmt,
          lang: s.language || foundMovie?.lang || 'Phụ đề',
          sold: Number(s.bookedSeatsCount || s.sold || 0),
          status: statusMap[s.status] || (String(s.status || '').toLowerCase()) || 'open',
          note: s.note || '',
          price: {
            std: Number(s.basePrice || s.adultStandardPrice || 60000),
            vip: Number(s.vipPrice || s.adultVipPrice || 90000),
            couple: Number(s.couplePrice || s.adultCouplePrice || 150000)
          },
          raw: s
        };
      });

      setShows(mapped);

      // Batch l?y s? v? ?? b?n th?c t? t? booking-service
      const validIds = mapped.map(x => Number(x.id)).filter(id => !isNaN(id) && id > 0);
      // Batch lấy số vé đã bán thực tế từ booking-service
      if (validIds.length > 0 && typeof adminService?.getShowtimesTicketCounts === 'function') {
        adminService.getShowtimesTicketCounts(token, validIds)
          .then(countsMap => {
            if (countsMap && typeof countsMap === 'object' && reqId === fetchShowsReqIdRef.current) {
              setShows(prevShows => prevShows.map(item => {
                const cnt = countsMap[item.id] ?? countsMap[Number(item.id)];
                return cnt !== undefined ? { ...item, sold: Number(cnt) } : item;
              }));
            }
          })
          .catch(err => {
            console.warn('L?i t?i s? v? ?? b?n:', err);
          });
      }
    } catch (err) {
      if (reqId === fetchShowsReqIdRef.current) {
        console.warn('Lỗi gọi API getAdminShowtimes:', err);
        showToast?.('Không thể tải lịch chiếu từ server: ' + err.message, 'error');
      }
    } finally {
      if (reqId === fetchShowsReqIdRef.current) {
        setLoading(false);
      }
    }
  }, [date, selectedCinemaId, movies, showToast]);

  useEffect(() => {
    fetchShowtimesRef.current = fetchShowtimes;
  }, [fetchShowtimes]);

  // Gọi API tải suất chiếu khi component mount hoặc khi đổi ngày `date`
  useEffect(() => {
    fetchShowtimes(date);
  }, [date, fetchShowtimes]);

  /* Helpers */
  const M = useCallback((id) => movies.find(m => String(m.id) === String(id)) || {
    id, title: 'Chưa xác định', dur: 120, formats: ['2D'], age: 'P', color: '#64748b', lang: 'Phụ đề'
  }, [movies]);

  const R = useCallback((id) => rooms.find(r => Number(r.id) === Number(id)) || {
    id, name: 'Phòng', type: '2D', seats: 80, active: true
  }, [rooms]);

  const endOf = useCallback((s) => {
    const movie = M(s.movieId);
    return toMin(s.start) + (movie?.dur || 120) + ADS;
  }, [M]);

  const findShowById = useCallback((id) => {
    if (!id) return null;
    return shows.find(x => String(x.id) === String(id)) || draftShows.find(x => String(x.id) === String(id)) || null;
  }, [shows, draftShows]);

  const dayShows = useCallback((d = date) => {
    const saved = shows.filter(s => s.date === d);
    const drafts = draftShows.filter(s => s.date === d);
    return [...saved, ...drafts];
  }, [shows, draftShows, date]);

  /* Validation */
  const validate = useCallback((s, ignoreId = null) => {
    const errs = [];
    const warns = [];
    const m = M(s.movieId);
    const r = R(s.roomId);

    if (!m || !r) return { errs: ['Thiếu phim hoặc phòng'], warns };
    const st = toMin(s.start);
    const en = st + m.dur + ADS;

    if (!r.active) errs.push(`${r.name} đang tạm ngưng hoạt động`);
    if (m.formats && !m.formats.includes(s.fmt)) errs.push(`Phim không có bản ${s.fmt}`);
    if (s.fmt !== r.type && s.fmt !== '2D') {
      errs.push(`${r.name} là phòng ${r.type}, không chiếu được ${s.fmt}`);
    }
    if (m.release && s.date < m.release) errs.push(`Phim khởi chiếu từ ${m.release}`);
    if (m.end && s.date > m.end) warns.push(`Phim đã hết hạn chiếu (${m.end})`);
    if (st < OPEN * 60) errs.push(`Rạp mở cửa từ ${pad(OPEN)}:00`);
    if (en > CLOSE * 60) errs.push(`Suất kết thúc quá ${toT(CLOSE * 60)} (sau giờ đóng cửa)`);

    // Quy định: Suất chiếu phải được tạo trước ít nhất 1 ngày (từ ngày mai trở đi)
    if (s.date && s.date < getTomorrowStr()) {
      errs.push('Suất chiếu phải được lên lịch trước ít nhất 1 ngày (từ ngày mai trở đi)');
    }

    dayShows(s.date)
      .filter(o => Number(o.roomId) === Number(s.roomId) && String(o.id) !== String(ignoreId) && o.status !== 'cancel')
      .forEach(o => {
        const os = toMin(o.start);
        const oe = endOf(o) + CLEAN;
        if (st < oe && en + CLEAN > os) {
          errs.push(`Trùng với "${M(o.movieId).title}" (${o.start}–${toT(endOf(o))}) – cần cách ≥ ${CLEAN} phút dọn phòng`);
        }
      });

    const same = dayShows(s.date).filter(o =>
      Number(o.movieId) === Number(s.movieId) &&
      String(o.id) !== String(ignoreId) &&
      Math.abs(toMin(o.start) - st) < 20 &&
      o.status !== 'cancel'
    );
    if (same.length) {
      warns.push(`Có suất khác của cùng phim cách < 20 phút (${same.map(o => R(o.roomId).name).join(', ')})`);
    }

    if (m.age === 'P' && st >= 21 * 60) warns.push('Phim thiếu nhi chiếu sau 21:00 thường ít khách');
    if (m.age === 'T18' && st < 12 * 60) warns.push('Phim T18 chiếu buổi sáng thường ít khách');

    return { errs, warns };
  }, [M, R, endOf, dayShows]);

  const allConflicts = useMemo(() => {
    return dayShows().map(s => ({ s, ...validate(s, s.id) })).filter(x => x.errs.length || x.warns.length);
  }, [dayShows, validate]);

  /* Scroll Timeline to current time */
  useEffect(() => {
    if (tlWrapRef.current && !scrolledOnceRef.current) {
      scrolledOnceRef.current = true;
      const now = new Date();
      const mm = date === todayStr() ? now.getHours() * 60 + now.getMinutes() : OPEN * 60;
      tlWrapRef.current.scrollLeft = Math.max(0, (mm - OPEN * 60) / 60 * 96 - 200);
    }
  }, [date]);

  /* Actions */
  const shiftDay = (n) => {
    const next = addDays(date, view === 'week' ? n * 7 : n);
    setDate(next);
    setSelId(null);
  };

  const pickMovie = (id) => {
    const m = M(id);
    if (m?.release && date < m.release) {
      showToast?.(`🚫 Phim "${m.title}" chưa tới ngày khởi chiếu (khởi chiếu từ ${m.release}).`, 'warning');
      return;
    }
    const next = selMovie === id ? null : id;
    setSelMovie(next);
    if (next) showToast?.('Đã chọn phim – click vào khoảng trống trên dòng phòng để đặt suất', 'info');
  };

  const quickAdd = async (roomId, movieId, start) => {
    if (date < getTomorrowStr()) {
      showToast?.('🚫 Quy định: Suất chiếu phải được lên lịch trước ít nhất 1 ngày (từ ngày mai trở đi).', 'error');
      return;
    }
    const m = M(movieId);
    if (m?.release && date < m.release) {
      showToast?.(`🚫 Phim "${m.title}" chưa tới ngày khởi chiếu (từ ${m.release}).`, 'warning');
      return;
    }
    const r = R(roomId);
    const fmt = m.formats.includes(r.type) ? r.type : (m.formats.includes('2D') ? '2D' : m.formats[0]);
    const candidate = {
      id: 'draft_' + Math.random().toString(36).slice(2, 9),
      date,
      roomId,
      movieId,
      start,
      fmt,
      lang: m.lang,
      sold: 0,
      status: 'plan',
      isDraft: isDraftMode,
      note: ''
    };
    const v = validate(candidate);
    if (v.errs.length) {
      setAddModal({ roomId, movieId, start, date });
      showToast?.('⚠ ' + v.errs[0], 'warning');
      return;
    }

    if (isDraftMode) {
      setDraftShows(prev => [...prev, candidate]);
      setSelId(candidate.id);
      showToast?.(`📝 Đã thêm vào bản thảo: ${m.title} lúc ${start}`, 'info');
      return;
    }

    const token = getTokenRef.current?.();
    if (token) {
      try {
        const payload = {
          movieId: Number(movieId),
          roomId: Number(roomId),
          startTime: `${date}T${start}:00`,
          basePrice: DEFAULT_PRICES[fmt]?.std || 60000,
          vipPrice: DEFAULT_PRICES[fmt]?.vip || 90000,
          couplePrice: DEFAULT_PRICES[fmt]?.couple || 150000,
          status: 'SCHEDULED'
        };
        const created = await adminService.createAdminShowtime(token, payload);
        if (created?.id) candidate.id = String(created.id);
        candidate.isDraft = false;
        showToast?.(`✓ Đã tạo suất chiếu ${m.title} lúc ${start}`, 'success');
        fetchShowtimes(date);
      } catch (err) {
        showToast?.('✕ Lỗi tạo suất chiếu: ' + getApiErrorMessage(err), 'error');
        return;
      }
    }
    setShows(prev => [...prev, candidate]);
    setSelId(candidate.id);
  };

  const handleUpdate = async (key, val) => {
    const s = findShowById(selId);
    if (!s) return;
    const isShowtimeOpened = s.status === 'open' || s.status === 'OPEN' || Number(s.sold || 0) > 0;
    if (key === 'status' && isShowtimeOpened) {
      showToast?.('Suất chiếu đang bán vé, không thể đổi trạng thái!', 'warning');
      return;
    }
    if (key === 'movieId' && isShowtimeOpened) {
      showToast?.('Suất chiếu đã mở bán vé, không thể đổi phim!', 'warning');
      return;
    }
    const cand = { ...s, [key]: val };
    if (key === 'movieId') {
      const m = M(val);
      if (!m.formats.includes(cand.fmt)) cand.fmt = m.formats[0];
      cand.lang = m.lang;
    }
    const valRes = validate(cand, s.id);
    if (valRes.errs.length) {
      showToast?.('⚠ Đã lưu nhưng có xung đột: ' + valRes.errs[0], 'warning');
    }

    if (s.isDraft) {
      setDraftShows(prev => prev.map(x => String(x.id) === String(selId) ? cand : x));
      if (key === 'date') setDate(val);
      return;
    }

    const token = getTokenRef.current?.();
    if (token && s.id && !isNaN(Number(s.id))) {
      try {
        const statusMap = { 'open': 'OPEN', 'plan': 'SCHEDULED', 'cancel': 'CANCELLED', 'done': 'COMPLETED' };
        const stdPrice = cand.price?.std || cand.raw?.basePrice || DEFAULT_PRICES[cand.fmt]?.std || 60000;
        const vipPrice = cand.price?.vip || cand.raw?.vipPrice || DEFAULT_PRICES[cand.fmt]?.vip || 90000;
        const couplePrice = cand.price?.couple || cand.raw?.couplePrice || DEFAULT_PRICES[cand.fmt]?.couple || 150000;

        const payload = {
          movieId: Number(cand.movieId),
          roomId: Number(cand.roomId),
          startTime: `${cand.date}T${cand.start}:00`,
          basePrice: stdPrice,
          vipPrice: vipPrice,
          couplePrice: couplePrice,
          status: statusMap[cand.status] || cand.raw?.status || 'SCHEDULED'
        };
        await adminService.updateAdminShowtime(token, s.id, payload);
        showToast?.('✓ Đã cập nhật suất chiếu thành công', 'success');
        fetchShowtimes(date);
      } catch (err) {
        console.warn('Lỗi update showtime:', err);
        showToast?.('✕ Lỗi cập nhật suất chiếu: ' + getApiErrorMessage(err), 'error');
        return;
      }
    }

    setShows(prev => prev.map(x => String(x.id) === String(selId) ? cand : x));
    if (key === 'date') setDate(val);
  };

  const handleCancelShowtimeWithRefund = async () => {
    const s = findShowById(selId);
    if (!s || s.isDraft) return;
    setCancelModal({
      showtime: s,
      reason: 'Sự cố kỹ thuật phòng chiếu',
      submitting: false,
      loadingSummary: true,
      soldCount: Number(s.sold || 0),
      paidBookingsCount: null,
      totalRefundAmount: null
    });

    const token = getTokenRef.current?.();
    if (token && s.id && !isNaN(Number(s.id)) && typeof adminService?.getShowtimeBookingSummary === 'function') {
      try {
        const summary = await adminService.getShowtimeBookingSummary(token, s.id);
        if (summary) {
          const soldCount = Number(summary.soldTicketsCount ?? summary.paidTicketsCount ?? 0);
          const paidBookingsCount = Number(summary.paidBookingsCount ?? 0);
          const totalRefundAmount = Number(summary.totalRefundAmount ?? 0);
          setCancelModal(prev => prev && String(prev.showtime?.id) === String(s.id) ? ({
            ...prev,
            loadingSummary: false,
            soldCount,
            paidBookingsCount,
            totalRefundAmount,
            showtime: { ...prev.showtime, sold: soldCount }
          }) : prev);

          setShows(prevShows => prevShows.map(item =>
            String(item.id) === String(s.id) ? { ...item, sold: soldCount } : item
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
    const s = cancelModal.showtime;
    const finalReason = cancelModal.reason?.trim() || 'Sự cố kỹ thuật phòng chiếu';
    const token = getTokenRef.current?.();
    if (!token) return;

    setCancelModal(prev => ({ ...prev, submitting: true }));
    try {
      showToast?.('Đang xử lý hủy suất chiếu và hoàn tiền...', 'info');
      await adminService.cancelShowtimeAndRefund(token, s.id, finalReason);
      showToast?.('✓ Đã hủy suất chiếu và tự động hoàn tiền vào CineWallet thành công!', 'success');
      setCancelModal(null);
      setSelId(null);
      fetchShowtimes(date);
    } catch (err) {
      showToast?.('✕ Lỗi hủy suất chiếu: ' + getApiErrorMessage(err), 'error');
      setCancelModal(prev => ({ ...prev, submitting: false }));
    }
  };

  const handleDelete = async () => {
    const s = findShowById(selId);
    if (!s) return;

    if (s.isDraft) {
      setDraftShows(prev => prev.filter(x => String(x.id) !== String(selId)));
      setSelId(null);
      showToast?.('Đã xóa suất bản thảo', 'info');
      return;
    }

    if (!window.confirm(`Xoá suất ${s.start} – ${M(s.movieId).title}?`)) return;
    if (s.sold > 0 && !window.confirm(`Suất này đã bán ${s.sold} vé! Vẫn xoá? (Nên chuyển sang "Đã huỷ" thay vì xoá)`)) return;

    const token = getTokenRef.current?.();
    if (token && s.id && !isNaN(Number(s.id))) {
      try {
        await adminService.deleteAdminShowtime(token, s.id);
        showToast?.('Đã xoá suất chiếu thành công', 'success');
        fetchShowtimes(date);
      } catch (err) {
        showToast?.('Lỗi khi xoá: ' + err.message, 'error');
        return;
      }
    }
    setShows(prev => prev.filter(x => String(x.id) !== String(selId)));
    setSelId(null);
  };

  /* Draft Operations: Preview & Save All */
  const handlePreviewPrices = async (targetDrafts = draftShows) => {
    if (!targetDrafts || targetDrafts.length === 0) {
      showToast?.('Không có suất chiếu bản thảo nào để xem trước giá.', 'info');
      return;
    }

    const token = getTokenRef.current?.();
    if (!token) return;

    setLoadingPreview(true);
    setPreviewModal(true);
    try {
      const grouped = {};
      targetDrafts.forEach(s => {
        const mid = Number(s.movieId);
        if (!grouped[mid]) grouped[mid] = [];
        grouped[mid].push({
          roomId: Number(s.roomId),
          startTime: `${s.date}T${s.start}:00`,
          tempId: String(s.id)
        });
      });

      const requests = Object.entries(grouped).map(([mId, slots]) =>
        adminService.previewShowtimePrices(token, {
          movieId: Number(mId),
          slots
        }).catch(err => {
          console.warn('Preview prices error for movie', mId, err);
          return { data: [] };
        })
      );

      const responses = await Promise.all(requests);
      const combined = [];
      responses.forEach(res => {
        const list = Array.isArray(res) ? res : (res?.data || []);
        combined.push(...list);
      });

      setPreviewData(combined);
    } catch (err) {
      showToast?.('Lỗi khi tính toán bảng giá xem trước: ' + (err?.message || err), 'error');
    } finally {
      setLoadingPreview(false);
    }
  };

  const handleSaveAllDrafts = async () => {
    if (draftShows.length === 0) return;
    const token = getTokenRef.current?.();
    if (!token) return;

    const invalidDrafts = draftShows.map(s => ({ s, ...validate(s, s.id) })).filter(x => x.errs.length > 0);
    if (invalidDrafts.length > 0) {
      const firstErr = invalidDrafts[0].errs[0];
      const m = M(invalidDrafts[0].s.movieId);
      if (!window.confirm(`Có ${invalidDrafts.length} suất bản thảo đang có xung đột (${m.title}: ${firstErr}). Bạn vẫn muốn lưu các suất hợp lệ?`)) {
        return;
      }
    }

    const validDrafts = draftShows.filter(s => validate(s, s.id).errs.length === 0);
    if (validDrafts.length === 0) {
      showToast?.('Không có suất chiếu hợp lệ nào để lưu!', 'warning');
      return;
    }

    setIsSavingAllDrafts(true);
    let savedCount = 0;
    const savedIds = new Set();

    for (const s of validDrafts) {
      try {
        const payload = {
          movieId: Number(s.movieId),
          roomId: Number(s.roomId),
          startTime: `${s.date}T${s.start}:00`,
          basePrice: DEFAULT_PRICES[s.fmt]?.std || 60000,
          vipPrice: DEFAULT_PRICES[s.fmt]?.vip || 90000,
          couplePrice: DEFAULT_PRICES[s.fmt]?.couple || 150000,
          status: 'SCHEDULED'
        };
        await adminService.createAdminShowtime(token, payload);
        savedCount++;
        savedIds.add(String(s.id));
      } catch (err) {
        console.warn('Lỗi lưu suất chiếu:', err);
      }
    }

    setDraftShows(prev => prev.filter(d => !savedIds.has(String(d.id))));
    setIsSavingAllDrafts(false);
    setPreviewModal(false);

    showToast?.(`✓ Đã lưu thành công ${savedCount}/${validDrafts.length} suất chiếu vào hệ thống!`, 'success');
    fetchShowtimes(date);
  };

  const handleSaveSingleDraft = async (s) => {
    const token = getTokenRef.current?.();
    if (!token) return;

    const v = validate(s, s.id);
    if (v.errs.length > 0) {
      showToast?.('✕ ' + v.errs[0], 'error');
      return;
    }

    try {
      const payload = {
        movieId: Number(s.movieId),
        roomId: Number(s.roomId),
        startTime: `${s.date}T${s.start}:00`,
        basePrice: DEFAULT_PRICES[s.fmt]?.std || 60000,
        vipPrice: DEFAULT_PRICES[s.fmt]?.vip || 90000,
        couplePrice: DEFAULT_PRICES[s.fmt]?.couple || 150000,
        status: 'SCHEDULED'
      };
      await adminService.createAdminShowtime(token, payload);
      setDraftShows(prev => prev.filter(d => String(d.id) !== String(s.id)));
      showToast?.(`✓ Đã lưu suất chiếu ${M(s.movieId).title} lúc ${s.start}`, 'success');
      fetchShowtimes(date);
    } catch (err) {
      showToast?.('✕ Lỗi lưu suất chiếu: ' + getApiErrorMessage(err), 'error');
    }
  };

  const handleClearAllDrafts = () => {
    if (draftShows.length === 0) return;
    setConfirmClearDraftsModal(true);
  };

  const executeClearAllDrafts = () => {
    const count = draftShows.length;
    setDraftShows([]);
    setSelId(null);
    setConfirmClearDraftsModal(false);
    showToast?.(`Đã hủy bỏ tất cả ${count} suất chiếu bản thảo`, 'info');
  };

  const handleNextSlot = () => {
    const s = shows.find(x => String(x.id) === String(selId));
    if (!s) return;
    if (s.date < getTomorrowStr()) {
      showToast?.('🚫 Không thể tạo thêm suất chiếu cho ngày hiện tại hoặc quá khứ.', 'warning');
      return;
    }
    const start = toT(Math.ceil((endOf(s) + CLEAN) / 5) * 5);
    quickAdd(s.roomId, s.movieId, start);
  };



  /* Filtered Movies (Ưu tiên phim có thể tạo suất chiếu lên đầu tiên) */
  const filteredMovies = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    const list = movies.filter(m => {
      const matchSearch = !q || m.title.toLowerCase().includes(q);
      if (!matchSearch) return false;
      if (movieFilter === 'NOW_SHOWING') {
        return m.status === 'NOW_SHOWING' || (m.release <= date && m.end >= date);
      }
      if (movieFilter === 'UPCOMING') {
        return m.status === 'UPCOMING' || m.release > date;
      }
      return true;
    });

    // Sắp xếp: Ưu tiên phim có thể tạo suất chiếu (đã phát hành & chưa hết hạn) lên đầu tiên
    return list.slice().sort((a, b) => {
      const aValid = (!a.release || a.release <= date) && (!a.end || a.end >= date);
      const bValid = (!b.release || b.release <= date) && (!b.end || b.end >= date);
      if (aValid && !bValid) return -1;
      if (!aValid && bValid) return 1;
      return 0;
    });
  }, [movies, searchQuery, movieFilter, date]);

  /* Stats */
  const stats = useMemo(() => {
    const ds = dayShows().filter(s => s.status !== 'cancel');
    const cap = ds.reduce((a, s) => a + R(s.roomId).seats, 0);
    const sold = ds.reduce((a, s) => a + s.sold, 0);
    const act = rooms.filter(r => r.active);
    const used = ds.reduce((a, s) => a + M(s.movieId).dur + ADS + CLEAN, 0);
    const util = act.length ? Math.round(used / (act.length * (CLOSE - OPEN) * 60) * 100) : 0;
    const c = allConflicts.filter(x => x.errs.length > 0).length;
    return {
      showCount: ds.length,
      movieCount: new Set(ds.map(s => s.movieId)).size,
      util,
      fillRate: cap ? Math.round(sold / cap * 100) : 0,
      sold,
      cap,
      conflictsCount: c
    };
  }, [dayShows, rooms, allConflicts, M, R]);

  return (
    <div className="cinema-schedule-dark">
      {/* ── EMBEDDED CSS MATCHING EXACT SIZES OF HTML 1 (DARK THEMED) ── */}
      <style>{`
        .cinema-schedule-dark {
          --bg: #07090c;
          --card: #0d1117;
          --card-hover: #161b22;
          --line: #21262d;
          --text: #f0f6fc;
          --muted: #8b949e;
          --primary: #f5b800;
          --primary-2: rgba(245, 184, 0, 0.12);
          --ok: #16a34a;
          --warn: #f59e0b;
          --danger: #dc2626;
          --radius: 14px;
          --shadow: 0 4px 20px rgba(0, 0, 0, 0.4);
          --hourW: 96px;
          --rowH: 74px;
          font-family: Inter, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
          background: var(--bg);
          color: var(--text);
          font-size: 14px;
          height: calc(100vh - 72px);
          display: flex;
          flex-direction: column;
          overflow: hidden;
          box-sizing: border-box;
        }
        .cinema-schedule-dark * { box-sizing: border-box; }
        .cinema-schedule-dark button { font: inherit; cursor: pointer; border: none; background: none; color: inherit; }
        .cinema-schedule-dark input, .cinema-schedule-dark select, .cinema-schedule-dark textarea { font: inherit; color: inherit; }

        /* Custom Dark Scrollbar (Mỏng, thẩm mỹ) */
        .cinema-schedule-dark ::-webkit-scrollbar {
          width: 5px;
          height: 5px;
        }
        .cinema-schedule-dark ::-webkit-scrollbar-track {
          background: transparent;
        }
        .cinema-schedule-dark ::-webkit-scrollbar-thumb {
          background: #28303b;
          border-radius: 99px;
        }
        .cinema-schedule-dark ::-webkit-scrollbar-thumb:hover {
          background: #3e4856;
        }

        .cinema-schedule-dark header {
          min-height: 56px;
          height: auto;
          background: #0d1117;
          border-bottom: 1px solid var(--line);
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 8px 16px;
          gap: 10px 14px;
          flex-shrink: 0;
          flex-wrap: wrap;
          z-index: 10;
        }
        .cinema-schedule-dark .toolbar-group {
          display: flex;
          align-items: center;
          gap: 8px;
          flex-wrap: nowrap;
        }
        .cinema-schedule-dark .logo {
          display: flex;
          align-items: center;
          gap: 8px;
          font-weight: 800;
          font-size: 15px;
          white-space: nowrap;
        }
        .cinema-schedule-dark .logo i {
          width: 32px;
          height: 32px;
          border-radius: 9px;
          background: linear-gradient(135deg, #f5b800, #b45309);
          display: grid;
          place-items: center;
          color: #000;
          font-style: normal;
          font-size: 16px;
          flex-shrink: 0;
        }
        .cinema-schedule-dark .cinema-box {
          display: flex;
          align-items: center;
          gap: 6px;
          background: #161b22;
          padding: 0 10px;
          height: 38px;
          border-radius: 9px;
          border: 1px solid var(--line);
          box-sizing: border-box;
        }
        .cinema-schedule-dark .cinema-select {
          background: transparent;
          border: none;
          color: #fff;
          font-size: 12.5px;
          font-weight: 700;
          outline: none;
          cursor: pointer;
          height: 100%;
          font-family: inherit;
        }
        .cinema-schedule-dark .datebox-card {
          display: flex;
          flex-direction: column;
          justify-content: center;
          align-items: center;
          height: 38px;
          padding: 2px 10px;
          border: 1px solid var(--line);
          border-radius: 9px;
          background: #161b22;
          box-sizing: border-box;
          min-width: 150px;
          transition: border-color .15s, background .15s;
        }
        .cinema-schedule-dark .datebox-card.is-today {
          border-color: rgba(245, 184, 0, 0.45);
          background: #191e27;
        }
        .cinema-schedule-dark .date-input-wrap {
          display: flex;
          align-items: center;
          height: 18px;
        }
        .cinema-schedule-dark .date-input-native {
          border: none;
          outline: none;
          background: transparent;
          color: #fff;
          font-weight: 700;
          font-size: 12.5px;
          cursor: pointer;
          padding: 0;
          margin: 0;
          font-family: inherit;
          text-align: center;
        }
        .cinema-schedule-dark .date-sub-badge {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 4px;
          font-size: 10px;
          font-weight: 600;
          color: var(--muted);
          white-space: nowrap;
          line-height: 1;
        }
        .cinema-schedule-dark .datebox-card.is-today .date-sub-badge {
          color: var(--primary);
        }
        .cinema-schedule-dark .today-badge {
          color: var(--primary);
          font-weight: 700;
        }
        .cinema-schedule-dark .seg {
          display: flex;
          height: 38px;
          border: 1px solid var(--line);
          border-radius: 9px;
          overflow: hidden;
          background: #161b22;
          box-sizing: border-box;
        }
        .cinema-schedule-dark .seg button {
          padding: 0 14px;
          height: 100%;
          font-weight: 600;
          font-size: 12.5px;
          color: var(--muted);
          transition: .15s;
          white-space: nowrap;
          display: inline-flex;
          align-items: center;
        }
        .cinema-schedule-dark .seg button.on {
          background: var(--primary);
          color: #000;
          font-weight: 700;
        }
        .cinema-schedule-dark .btn {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 6px;
          height: 38px;
          padding: 0 14px;
          border-radius: 9px;
          font-weight: 600;
          font-size: 12.5px;
          border: 1px solid var(--line);
          background: #161b22;
          color: #f0f6fc;
          transition: .15s;
          white-space: nowrap;
          box-sizing: border-box;
          user-select: none;
        }
        .cinema-schedule-dark .btn:hover { background: #21262d; border-color: #30363d; }
        .cinema-schedule-dark .btn.nav-arrow {
          width: 32px;
          padding: 0;
          font-size: 18px;
          font-weight: 700;
          line-height: 1;
        }
        .cinema-schedule-dark .btn.btn-today-active {
          border-color: var(--primary);
          color: var(--primary);
          background: var(--primary-2);
          font-weight: 700;
        }
        .cinema-schedule-dark .btn.primary {
          background: var(--primary);
          color: #000;
          border-color: var(--primary);
          font-weight: 700;
        }
        .cinema-schedule-dark .btn.primary:hover { background: #e5a700; }
        .cinema-schedule-dark .btn.btn-active {
          background: var(--primary-2);
          border-color: var(--primary);
          color: var(--primary);
        }
        .cinema-schedule-dark .btn.btn-banned {
          background: rgba(239, 68, 68, 0.16) !important;
          border-color: rgba(239, 68, 68, 0.45) !important;
          color: #fca5a5 !important;
          cursor: not-allowed !important;
        }
        .cinema-schedule-dark .btn.btn-banned:hover {
          background: rgba(239, 68, 68, 0.26) !important;
        }
        .cinema-schedule-dark .datebox-card.is-past {
          border-color: rgba(239, 68, 68, 0.4);
          background: #1c1517;
        }
        .cinema-schedule-dark .btn.danger { color: var(--danger); }
        .cinema-schedule-dark .btn.danger:hover { background: rgba(220, 38, 38, 0.15); border-color: rgba(220, 38, 38, 0.3); }
        .cinema-schedule-dark .btn.sm { padding: 4px 8px; font-size: 11px; height: 26px; border-radius: 6px; }
        .cinema-schedule-dark .btn:disabled { opacity: .45; cursor: not-allowed; }
        .cinema-schedule-dark .conflict-badge {
          background: var(--danger);
          color: #fff;
          border-radius: 99px;
          padding: 1px 6px;
          font-size: 10px;
          font-weight: 700;
          margin-left: 2px;
          line-height: 1.2;
        }
        .cinema-schedule-dark .spin-icon {
          animation: spin 1s linear infinite;
        }
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }

        /* Main 3 columns layout with Resizable Splitters */
        .cinema-schedule-dark main {
          flex: 1;
          display: flex;
          flex-direction: row;
          align-items: stretch;
          padding: 10px 12px 12px;
          gap: 0;
          min-height: 0;
          overflow: hidden;
          width: 100%;
          position: relative;
          box-sizing: border-box;
        }
        .cinema-schedule-dark .panel-left {
          flex-shrink: 0;
          height: 100%;
          min-width: 200px;
          max-width: 440px;
        }
        .cinema-schedule-dark .panel-center {
          flex: 1 1 0%;
          min-width: 380px;
          height: 100%;
          overflow: hidden;
        }
        .cinema-schedule-dark .panel-right {
          flex-shrink: 0;
          height: 100%;
          min-width: 260px;
          max-width: 520px;
        }

        /* Resizable Splitter Styles */
        .cinema-schedule-dark .schedule-splitter {
          width: 10px;
          flex-shrink: 0;
          height: 100%;
          cursor: col-resize;
          position: relative;
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 15;
          user-select: none;
          touch-action: none;
          box-sizing: border-box;
        }
        .cinema-schedule-dark .schedule-splitter .splitter-line {
          width: 1.5px;
          height: 100%;
          background: var(--line);
          transition: background-color .15s, box-shadow .15s;
        }
        .cinema-schedule-dark .schedule-splitter .splitter-handle {
          position: absolute;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          width: 6px;
          height: 36px;
          background: #161b22;
          border: 1px solid #30363d;
          border-radius: 99px;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 3px;
          transition: background-color .15s, border-color .15s, box-shadow .15s, transform .15s;
          pointer-events: none;
        }
        .cinema-schedule-dark .schedule-splitter .splitter-dot {
          width: 2px;
          height: 2px;
          border-radius: 50%;
          background: #8b949e;
          transition: background-color .15s;
        }
        .cinema-schedule-dark .schedule-splitter:hover .splitter-line,
        .cinema-schedule-dark .schedule-splitter.is-dragging .splitter-line {
          background: var(--primary);
          box-shadow: 0 0 8px rgba(245, 184, 0, 0.45);
        }
        .cinema-schedule-dark .schedule-splitter:hover .splitter-handle,
        .cinema-schedule-dark .schedule-splitter.is-dragging .splitter-handle {
          background: var(--primary);
          border-color: var(--primary);
          box-shadow: 0 0 10px rgba(245, 184, 0, 0.6);
          transform: translate(-50%, -50%) scale(1.1);
        }
        .cinema-schedule-dark .schedule-splitter:hover .splitter-dot,
        .cinema-schedule-dark .schedule-splitter.is-dragging .splitter-dot {
          background: #000;
        }
        .cinema-schedule-dark .card {
          background: var(--card);
          border: 1px solid var(--line);
          border-radius: var(--radius);
          box-shadow: var(--shadow);
          display: flex;
          flex-direction: column;
          min-height: 0;
          overflow: hidden;
        }
        .cinema-schedule-dark .card-h {
          padding: 12px 16px;
          border-bottom: 1px solid var(--line);
          display: flex;
          align-items: center;
          gap: 10px;
          flex-shrink: 0;
        }
        .cinema-schedule-dark .card-h h3 { font-size: 14px; font-weight: 700; color: #fff; }
        .cinema-schedule-dark .card-h small { color: var(--muted); font-weight: 400; display: block; margin-top: 2px; }
        .cinema-schedule-dark .card-b {
          padding: 12px 14px;
          overflow-y: auto;
          overflow-x: hidden;
          flex: 1;
        }
        .cinema-schedule-dark .search {
          width: 100%;
          padding: 8px 10px 8px 32px;
          border: 1px solid #30363d;
          border-radius: 10px;
          background: #161b22 url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='14' height='14' fill='none' stroke='%238b949e' stroke-width='2' viewBox='0 0 24 24'%3E%3Ccircle cx='11' cy='11' r='7'/%3E%3Cpath d='m20 20-3.5-3.5'/%3E%3C/svg%3E") 10px center no-repeat;
          color: #fff;
          outline: none;
          margin-bottom: 10px;
        }
        .cinema-schedule-dark .search:focus { border-color: var(--primary); background-color: #1a202c; }

        /* movies */
        .cinema-schedule-dark .movie {
          display: flex;
          gap: 10px;
          padding: 9px;
          border-radius: 11px;
          border: 1px solid transparent;
          cursor: grab;
          margin-bottom: 6px;
          transition: .12s;
          background: #161b22;
        }
        .cinema-schedule-dark .movie:hover { background: #1c2128; border-color: #30363d; }
        .cinema-schedule-dark .movie:active { cursor: grabbing; }
        .cinema-schedule-dark .movie.sel { background: var(--primary-2); border-color: var(--primary); }
        .cinema-schedule-dark .poster {
          width: 38px;
          height: 52px;
          border-radius: 7px;
          flex-shrink: 0;
          display: grid;
          place-items: center;
          color: #fff;
          font-weight: 800;
          font-size: 15px;
          text-shadow: 0 1px 2px rgba(0,0,0,.5);
        }
        .cinema-schedule-dark .movie .t { font-weight: 600; font-size: 13px; line-height: 1.3; color: #fff; }
        .cinema-schedule-dark .movie .m { font-size: 11.5px; color: var(--muted); margin-top: 3px; display: flex; gap: 5px; flex-wrap: wrap; align-items: center; }
        .cinema-schedule-dark .tag { font-size: 10px; padding: 1px 6px; border-radius: 5px; background: #21262d; color: #c9d1d9; font-weight: 700; }
        .cinema-schedule-dark .tag.age { background: rgba(239, 68, 68, 0.2); color: #fca5a5; }
        .cinema-schedule-dark .tag.hot { background: rgba(245, 184, 0, 0.2); color: #fde047; }
        .cinema-schedule-dark .drag-hint { font-size: 11.5px; color: var(--muted); text-align: center; padding: 8px; border: 1px dashed var(--line); border-radius: 10px; margin-top: 6px; }

        /* timeline */
        .cinema-schedule-dark .tl-wrap { flex: 1; overflow: auto; position: relative; }
        .cinema-schedule-dark .tl { display: grid; grid-template-columns: 150px 1fr; min-width: max-content; }
        .cinema-schedule-dark .corner {
          position: sticky;
          top: 0;
          left: 0;
          z-index: 6 !important;
          padding: 10px 14px;
          font-size: 12px;
          color: var(--muted);
          font-weight: 600;
          border-right: 1px solid var(--line);
          background: #0d1117;
          border-bottom: 1px solid var(--line);
        }
        .cinema-schedule-dark .hours {
          display: flex;
          height: 38px;
          position: sticky;
          top: 0;
          z-index: 5;
          background: #0d1117;
          border-bottom: 1px solid var(--line);
        }
        .cinema-schedule-dark .hours span {
          width: var(--hourW);
          flex-shrink: 0;
          font-size: 11.5px;
          color: var(--muted);
          font-weight: 600;
          padding: 12px 0 0 6px;
          border-left: 1px solid var(--line);
        }
        .cinema-schedule-dark .roomcell {
          position: sticky;
          left: 0;
          background: #0d1117;
          z-index: 4;
          border-right: 1px solid var(--line);
          border-bottom: 1px solid var(--line);
          height: var(--rowH);
          padding: 10px 14px;
          display: flex;
          flex-direction: column;
          justify-content: center;
        }
        .cinema-schedule-dark .roomcell b { font-size: 13px; color: #fff; }
        .cinema-schedule-dark .roomcell small { color: var(--muted); font-size: 11px; margin-top: 2px; }
        .cinema-schedule-dark .roomcell .bar { height: 4px; background: #21262d; border-radius: 99px; margin-top: 6px; overflow: hidden; }
        .cinema-schedule-dark .roomcell .bar i { display: block; height: 100%; background: var(--primary); border-radius: 99px; }
        .cinema-schedule-dark .roomcell.off { opacity: .5; }
        .cinema-schedule-dark .track {
          position: relative;
          height: var(--rowH);
          border-bottom: 1px solid var(--line);
          background: repeating-linear-gradient(90deg, #161b22 0 1px, transparent 1px var(--hourW)),
                      repeating-linear-gradient(90deg, transparent 0 calc(var(--hourW)/2 - .5px), #13171e calc(var(--hourW)/2 - .5px) calc(var(--hourW)/2 + .5px), transparent calc(var(--hourW)/2 + .5px) var(--hourW));
        }
        .cinema-schedule-dark .track.over { background-color: rgba(245, 184, 0, 0.08); }
        .cinema-schedule-dark .track.off { background-color: rgba(22, 27, 34, 0.4); cursor: not-allowed; }
        .cinema-schedule-dark .blk {
          position: absolute;
          top: 9px;
          height: calc(var(--rowH) - 18px);
          border-radius: 9px;
          padding: 6px 9px;
          color: #fff;
          font-size: 12px;
          overflow: hidden;
          cursor: pointer;
          box-shadow: 0 2px 6px rgba(0,0,0,.3);
          transition: transform .1s, box-shadow .1s;
          border: 2px solid transparent;
        }
        .cinema-schedule-dark .blk:hover { transform: translateY(-1px); box-shadow: 0 6px 14px rgba(0,0,0,.45); z-index: 2; }
        .cinema-schedule-dark .blk.sel { border-color: #f5b800; box-shadow: 0 0 0 3px rgba(245, 184, 0, 0.35); }
        .cinema-schedule-dark .blk b { display: block; font-weight: 700; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; font-size: 12px; }
        .cinema-schedule-dark .blk span { opacity: .9; font-size: 11px; white-space: nowrap; font-family: monospace; }
        .cinema-schedule-dark .blk .clean {
          position: absolute;
          right: 0;
          top: 0;
          bottom: 0;
          background: repeating-linear-gradient(135deg, rgba(255,255,255,.35) 0 4px, transparent 4px 8px);
          border-left: 1px dashed rgba(255,255,255,.7);
        }
        .cinema-schedule-dark .blk.conflict { outline: 2px solid var(--danger); outline-offset: 1px; animation: pulse 1.2s infinite; }
        .cinema-schedule-dark .blk.cancel { background: #334155 !important; color: #94a3b8; text-decoration: line-through; }
        .cinema-schedule-dark .blk .sold { position: absolute; left: 0; bottom: 0; height: 3px; background: rgba(255,255,255,.85); }

        /* GHOST DROP TARGET PREVIEW - VIỀN NÉT ĐỨT SIÊU NỔI BẬT */
        .cinema-schedule-dark .ghost {
          position: absolute;
          top: 7px;
          height: calc(var(--rowH) - 14px);
          border-radius: 9px;
          border: 2.5px dashed #f59e0b;
          background: linear-gradient(135deg, rgba(245, 158, 11, 0.25) 0%, rgba(245, 158, 11, 0.09) 100%);
          box-shadow: 0 0 20px rgba(245, 158, 11, 0.6), inset 0 0 14px rgba(245, 158, 11, 0.22);
          pointer-events: none;
          z-index: 10;
          display: flex;
          align-items: center;
          padding: 0 10px;
          overflow: hidden;
          animation: ghostPulseNeon 1.1s infinite alternate ease-in-out;
          backdrop-filter: blur(3px);
        }
        @keyframes ghostPulseNeon {
          0% {
            border-color: #f59e0b;
            box-shadow: 0 0 14px rgba(245, 158, 11, 0.45), inset 0 0 10px rgba(245, 158, 11, 0.15);
          }
          100% {
            border-color: #fde047;
            box-shadow: 0 0 26px rgba(253, 224, 71, 0.85), inset 0 0 18px rgba(253, 224, 71, 0.3);
          }
        }
        .cinema-schedule-dark .ghost-time {
          font-size: 11.5px;
          font-weight: 800;
          color: #ffffff;
          text-shadow: 0 1px 4px rgba(0,0,0,0.9), 0 0 10px rgba(245, 158, 11, 0.95);
          white-space: nowrap;
          letter-spacing: 0.3px;
          z-index: 2;
        }
        .cinema-schedule-dark .ghost-clean {
          position: absolute;
          right: 0;
          top: 0;
          bottom: 0;
          background: repeating-linear-gradient(135deg, rgba(245, 158, 11, 0.35) 0 4px, transparent 4px 8px);
          border-left: 1.5px dashed rgba(245, 158, 11, 0.85);
        }
        @keyframes pulse { 50% { outline-color: #fca5a5; } }
        .cinema-schedule-dark .nowline { position: absolute; top: 0; bottom: 0; width: 2px; background: var(--danger); z-index: 3; pointer-events: none; }
        .cinema-schedule-dark .nowline::before { content: ""; position: absolute; top: -1px; left: -4px; width: 10px; height: 10px; border-radius: 50%; background: var(--danger); }

        /* week view */
        .cinema-schedule-dark .week { display: grid; grid-template-columns: 150px repeat(7, 1fr); min-width: 900px; }
        .cinema-schedule-dark .week > div { border-bottom: 1px solid var(--line); border-right: 1px solid var(--line); padding: 8px; min-height: 60px; font-size: 12px; }
        .cinema-schedule-dark .week .wh { position: sticky; top: 0; background: #0d1117; font-weight: 700; text-align: center; z-index: 3; padding: 10px 4px; color: #fff; }
        .cinema-schedule-dark .week .wh small { display: block; color: var(--muted); font-weight: 500; }
        .cinema-schedule-dark .week .wh.today { color: var(--primary); }
        .cinema-schedule-dark .week .wr { position: sticky; left: 0; background: #0d1117; font-weight: 700; z-index: 2; color: #fff; }
        .cinema-schedule-dark .week .cell { cursor: pointer; display: flex; flex-direction: column; gap: 3px; }
        .cinema-schedule-dark .week .cell:hover { background: #161b22; }
        .cinema-schedule-dark .week .chip { padding: 2px 6px; border-radius: 5px; color: #fff; font-size: 11px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .cinema-schedule-dark .week .more { color: var(--muted); font-size: 11px; }

        .cinema-schedule-dark .legend {
          display: flex;
          gap: 14px;
          padding: 9px 16px;
          border-top: 1px solid var(--line);
          font-size: 12px;
          color: var(--muted);
          flex-wrap: wrap;
          align-items: center;
          background: #0d1117;
          flex-shrink: 0;
        }
        .cinema-schedule-dark .legend span { display: flex; align-items: center; gap: 6px; }
        .cinema-schedule-dark .legend i { width: 14px; height: 12px; border-radius: 4px; display: inline-block; }
        .cinema-schedule-dark .stats {
          display: grid;
          grid-template-columns: repeat(5, 1fr);
          gap: 8px;
          padding: 10px 16px;
          border-top: 1px solid var(--line);
          background: #0d1117;
          flex-shrink: 0;
        }
        .cinema-schedule-dark .stat { background: #161b22; border: 1px solid var(--line); border-radius: 10px; padding: 8px 10px; }
        .cinema-schedule-dark .stat b { display: block; font-size: 17px; color: #fff; font-family: monospace; }
        .cinema-schedule-dark .stat span { font-size: 11px; color: var(--muted); }

        /* right tabs */
        .cinema-schedule-dark .tabs { display: flex; border-bottom: 1px solid var(--line); flex-shrink: 0; background: #0d1117; }
        .cinema-schedule-dark .tabs button {
          flex: 1;
          padding: 11px 4px;
          font-weight: 600;
          font-size: 12.5px;
          white-space: nowrap;
          color: var(--muted);
          border-bottom: 2px solid transparent;
          transition: .15s;
        }
        .cinema-schedule-dark .tabs button.on { color: var(--primary); border-color: var(--primary); }
        .cinema-schedule-dark .field { margin-bottom: 11px; }
        .cinema-schedule-dark .field label { display: block; font-size: 12px; font-weight: 600; color: var(--muted); margin-bottom: 5px; }
        .cinema-schedule-dark .field input, .cinema-schedule-dark .field select, .cinema-schedule-dark .field textarea {
          width: 100%;
          padding: 8px 10px;
          border: 1px solid #30363d;
          border-radius: 9px;
          background: #161b22;
          color: #fff;
          outline: none;
          transition: .15s;
          font-size: 13px;
        }
        .cinema-schedule-dark .field input:focus, .cinema-schedule-dark .field select:focus {
          border-color: var(--primary);
          box-shadow: 0 0 0 3px rgba(245, 184, 0, 0.2);
        }
        .cinema-schedule-dark .row2 { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
        .cinema-schedule-dark .row3 { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 8px; }
        .cinema-schedule-dark .kv { display: flex; justify-content: space-between; padding: 7px 0; border-bottom: 1px dashed var(--line); font-size: 13px; }
        .cinema-schedule-dark .kv span { color: var(--muted); }
        .cinema-schedule-dark .kv b { color: #fff; font-family: monospace; }
        .cinema-schedule-dark .alert { padding: 9px 12px; border-radius: 9px; font-size: 12.5px; line-height: 1.5; margin-bottom: 10px; }
        .cinema-schedule-dark .alert.err { background: rgba(220, 38, 38, 0.15); color: #fca5a5; border: 1px solid rgba(220, 38, 38, 0.3); }
        .cinema-schedule-dark .alert.ok { background: rgba(22, 163, 74, 0.15); color: #86efac; border: 1px solid rgba(22, 163, 74, 0.3); }
        .cinema-schedule-dark .alert.warn { background: rgba(245, 158, 11, 0.15); color: #fde047; border: 1px solid rgba(245, 158, 11, 0.3); }
        .cinema-schedule-dark .empty { color: var(--muted); text-align: center; padding: 40px 10px; font-size: 13px; line-height: 1.6; }
        .cinema-schedule-dark .empty i { font-size: 34px; display: block; margin-bottom: 8px; font-style: normal; }
        .cinema-schedule-dark .status { display: inline-flex; align-items: center; gap: 5px; font-size: 11px; font-weight: 700; padding: 3px 8px; border-radius: 99px; }
        .cinema-schedule-dark .st-open { background: rgba(22, 163, 74, 0.2); color: #4ade80; }
        .cinema-schedule-dark .st-plan { background: rgba(79, 70, 229, 0.2); color: #818cf8; }
        .cinema-schedule-dark .st-cancel { background: rgba(100, 116, 139, 0.2); color: #94a3b8; }
        .cinema-schedule-dark .st-done { background: rgba(107, 114, 128, 0.2); color: #9ca3af; }
        .cinema-schedule-dark .occ { height: 8px; background: #21262d; border-radius: 99px; overflow: hidden; margin-top: 4px; }
        .cinema-schedule-dark .occ i { display: block; height: 100%; background: linear-gradient(90deg, #f5b800, #ea580c); }
        .cinema-schedule-dark .list { display: flex; flex-direction: column; gap: 6px; }
        .cinema-schedule-dark .li { display: flex; align-items: center; gap: 8px; padding: 8px 10px; border: 1px solid var(--line); border-radius: 9px; font-size: 12.5px; cursor: pointer; background: #161b22; }
        .cinema-schedule-dark .li:hover { background: #1c2128; border-color: #30363d; }
        .cinema-schedule-dark .li i { width: 10px; height: 10px; border-radius: 3px; flex-shrink: 0; }
        .cinema-schedule-dark .li .t { flex: 1; min-width: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; color: #fff; }
        .cinema-schedule-dark .li small { color: var(--muted); }

        /* modals */
        .cinema-schedule-dark .modal-bg { position: fixed; inset: 0; background: rgba(0, 0, 0, 0.75); backdrop-filter: blur(4px); display: grid; place-items: center; z-index: 50; }
        .cinema-schedule-dark .modal { background: #0d1117; border: 1px solid var(--line); border-radius: 16px; width: 440px; padding: 22px; box-shadow: 0 20px 60px rgba(0,0,0,.5); max-height: 90vh; overflow: auto; color: #fff; }
        .cinema-schedule-dark .modal h3 { margin-bottom: 4px; font-size: 15px; font-weight: 700; color: #fff; }
        .cinema-schedule-dark .modal p { color: var(--muted); font-size: 12.5px; margin-bottom: 14px; }
        .cinema-schedule-dark .modal .acts { display: flex; justify-content: flex-end; gap: 8px; margin-top: 14px; }
        .cinema-schedule-dark .chips { display: flex; flex-wrap: wrap; gap: 6px; }
        .cinema-schedule-dark .chip-btn { padding: 5px 10px; border: 1px solid #30363d; border-radius: 8px; font-size: 12px; font-weight: 600; background: #161b22; color: #c9d1d9; cursor: pointer; transition: .15s; }
        .cinema-schedule-dark .chip-btn.on { background: var(--primary); color: #000; border-color: var(--primary); font-weight: 700; }
      `}</style>

      {/* ── HEADER ── */}
      <header>
        {/* GROUP 1: Logo & Cinema Selector */}
        <div className="toolbar-group">
          <div className="logo" style={{ whiteSpace: 'nowrap' }}>
            <i>🎬</i>
            <span style={{ fontWeight: 800, fontSize: '15px', color: '#fff', letterSpacing: '0.02em' }}>CinemaAdmin</span>
            <span style={{ color: 'var(--muted)', fontWeight: 500, fontSize: '13px', marginLeft: '6px' }}>
              / Lịch chiếu
            </span>
          </div>

          {/* Cinema Selector */}
          {isEffectiveAdmin ? (
            cinemas.length > 0 && (
              <div className="cinema-box">
                <span style={{ fontSize: '13px', flexShrink: 0 }}>🏢</span>
                <select
                  value={selectedCinemaId}
                  onChange={(e) => {
                    const cId = e.target.value;
                    setSelectedCinemaId(cId);
                    fetchRooms(cId);
                    fetchShowtimes(date, cId);
                  }}
                  className="cinema-select"
                  title="Chọn chi nhánh rạp"
                >
                  <option value="ALL" style={{ background: '#0d1117' }}>Tất cả cụm rạp ({cinemas.length})</option>
                  {cinemas.map(c => (
                    <option key={c.id} value={c.id} style={{ background: '#0d1117' }}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
            )
          ) : (
            <div className="cinema-box" style={{ background: 'rgba(6,182,212,0.1)', borderColor: 'rgba(6,182,212,0.3)' }}>
              <span style={{ fontSize: '13px', flexShrink: 0 }}>🏢</span>
              <span style={{ color: '#06b6d4', fontSize: '12px', fontWeight: 700, whiteSpace: 'nowrap' }}>
                {cinemas.find(c => String(c.id) === String(selectedCinemaId))?.name || (cinemas.length > 0 ? cinemas[0].name : ctx?.assignedCinema?.name || 'Chi nhánh của bạn')}
              </span>
            </div>
          )}
        </div>

        {/* GROUP 2: Date Navigation Cluster */}
        <div className="toolbar-group">
          <button className="btn nav-arrow" onClick={() => shiftDay(-1)} title="Ngày trước">‹</button>

          <div className={`datebox-card ${date === todayStr() ? 'is-today' : ''} ${isPast ? 'is-past' : ''}`}>
            <div className="date-input-wrap">
              <input
                type="date"
                value={date}
                onChange={(e) => { setDate(e.target.value); setSelId(null); }}
                className="date-input-native"
                title="Chọn ngày lịch chiếu"
              />
            </div>
            <div className="date-sub-badge">
              <span>{DOW[new Date(date + 'T00:00:00').getDay()]}</span>
              {date === todayStr() && <span className="today-badge">• Hôm nay (Vận hành)</span>}
              {isPast && <span style={{ color: '#f87171', fontWeight: 700 }}>• Quá khứ</span>}
              {date >= getTomorrowStr() && <span style={{ color: '#34d399', fontWeight: 700 }}>• Mở tạo lịch</span>}
            </div>
          </div>

          <button className="btn nav-arrow" onClick={() => shiftDay(1)} title="Ngày sau">›</button>

          <button
            className={`btn ${date === todayStr() ? 'btn-today-active' : ''}`}
            onClick={() => { setDate(todayStr()); setSelId(null); }}
            title="Xem lịch hôm nay"
          >
            Hôm nay
          </button>

          <button
            className="btn"
            onClick={() => fetchShowtimes(date)}
            title="Làm mới lịch chiếu từ máy chủ"
            style={{ color: loading ? 'var(--primary)' : 'inherit' }}
          >
            <span className={loading ? 'spin-icon' : ''} style={{ display: 'inline-block', marginRight: '4px' }}>↻</span>
            <span>{loading ? 'Đang tải...' : 'Làm mới'}</span>
          </button>
        </div>

        {/* GROUP 3: View Mode & Operations */}
        <div className="toolbar-group">
          <div className="seg">
            <button className={view === 'day' ? 'on' : ''} onClick={() => setView('day')}>Ngày</button>
            <button className={view === 'week' ? 'on' : ''} onClick={() => setView('week')}>Tuần</button>
          </div>

          <button
            className={`btn ${isDraftMode ? 'btn-today-active' : ''}`}
            onClick={() => setIsDraftMode(v => !v)}
            title={isDraftMode ? "Chế độ Bản thảo đang BẬT: Thao tác kéo thả sẽ lưu nháp trước khi lưu CSDL" : "Chế độ Bản thảo đang TẮT: Thao tác sẽ lưu trực tiếp vào CSDL"}
            style={{
              borderColor: isDraftMode ? 'var(--primary)' : 'inherit',
              color: isDraftMode ? 'var(--primary)' : 'inherit'
            }}
          >
            <span>📝</span>
            <span>{isDraftMode ? 'Bản thảo: BẬT' : 'Bản thảo: TẮT'}</span>
          </button>

          <button className="btn" onClick={() => setCopyModal(true)} title="Sao chép toàn bộ suất chiếu sang ngày khác">
            <span>⧉</span>
            <span>Sao chép lịch</span>
          </button>

          <button
            className={`btn ${isTodayOrPast ? 'btn-banned' : 'primary'}`}
            onClick={() => {
              if (isTodayOrPast) {
                showToast?.('🚫 Hệ thống khóa tạo suất chiếu ở ngày hiện tại hoặc quá khứ. Suất chiếu bắt buộc phải lên lịch trước ít nhất 1 ngày (từ ngày mai trở đi).', 'warning');
                return;
              }
              setAddModal({ date: date >= getTomorrowStr() ? date : getTomorrowStr() });
            }}
            title={isTodayOrPast ? "Chính sách: Khóa tạo suất chiếu ở ngày hiện tại/quá khứ (chỉ được tạo từ ngày mai trở đi)" : "Tạo suất chiếu mới"}
          >
            <span style={{ fontSize: '14px', fontWeight: 900 }}>{isTodayOrPast ? '🚫' : '＋'}</span>
            <span>{isTodayOrPast ? (isToday ? 'Khóa tạo (Hôm nay)' : 'Khóa tạo (Quá khứ)') : 'Thêm suất chiếu'}</span>
          </button>

          <button
            className={`btn ${isRightPanelOpen ? 'btn-active' : ''}`}
            onClick={() => setIsRightPanelOpen(v => !v)}
            title={isRightPanelOpen ? "Thu gọn bảng thông tin bên phải" : "Mở bảng thông tin bên phải"}
          >
            <span>📊</span>
            <span>{isRightPanelOpen ? 'Bảng thông tin' : 'Hiện thông tin'}</span>
            {allConflicts.length > 0 && (
              <span className="conflict-badge">{allConflicts.length}</span>
            )}
          </button>
        </div>
      </header>

      {/* ── BANNER KHÓA TẠO SUẤT CHIẾU Ở NGÀY HIỆN TẠI / QUÁ KHỨ ── */}
      {isTodayOrPast && (
        <div style={{
          background: 'linear-gradient(90deg, rgba(239, 68, 68, 0.16), rgba(245, 184, 0, 0.08))',
          borderBottom: '1px solid rgba(239, 68, 68, 0.35)',
          padding: '9px 18px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '12px',
          flexShrink: 0
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ fontSize: '18px' }}>🚫</span>
            <div>
              <div style={{ fontSize: '13px', color: '#fff', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span>Chế độ theo dõi & vận hành ({isToday ? 'Ngày hiện tại' : 'Ngày quá khứ'})</span>
                <span style={{ fontSize: '10px', background: 'rgba(239, 68, 68, 0.25)', color: '#f87171', border: '1px solid rgba(239, 68, 68, 0.4)', padding: '1px 6px', borderRadius: '4px', textTransform: 'uppercase', fontWeight: 800 }}>
                  Khóa tạo suất chiếu
                </span>
              </div>
              <p style={{ fontSize: '11.5px', color: '#94a3b8', margin: '2px 0 0 0' }}>
                Quy định vận hành: Suất chiếu phải được lên lịch trước ít nhất 1 ngày (từ ngày mai trở đi). Ngày hôm nay chỉ phục vụ kiểm tra trạng thái vé và xử lý sự cố.
              </p>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
            <button
              className="btn sm"
              onClick={() => { setDate(getTomorrowStr()); setSelId(null); }}
              title="Chuyển nhanh sang ngày mai để lên lịch chiếu"
              style={{ background: '#f59e0b', color: '#000', fontWeight: 700, border: 'none', display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}
            >
              <span>👉</span>
              <span>Lên lịch ngày mai ({getTomorrowStr()})</span>
            </button>
          </div>
        </div>
      )}

      {/* ── DRAFT ACTIONS BAR ── */}
      {draftShows.length > 0 && (
        <div style={{
          background: 'linear-gradient(90deg, rgba(245, 184, 0, 0.15), rgba(245, 184, 0, 0.04))',
          borderBottom: '1px solid rgba(245, 184, 0, 0.35)',
          padding: '8px 16px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '12px',
          flexShrink: 0
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '16px' }}>📋</span>
            <span style={{ fontSize: '12.5px', color: '#fff', fontWeight: 600 }}>
              Có <strong style={{ color: '#f5b800' }}>{draftShows.length}</strong> suất chiếu bản thảo chưa lưu vào hệ thống.
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button
              className="btn sm"
              onClick={() => handlePreviewPrices(draftShows)}
              disabled={loadingPreview}
              title="Xem trước bảng giá vé được tính toán tự động"
              style={{ background: '#161b22', border: '1px solid rgba(255,255,255,0.2)', color: '#fff' }}
            >
              <span>👁️ Xem trước giá</span>
            </button>
            <button
              className="btn primary sm"
              onClick={handleSaveAllDrafts}
              disabled={isSavingAllDrafts}
              title="Lưu tất cả suất bản thảo vào CSDL"
            >
              <span>💾 {isSavingAllDrafts ? 'Đang lưu...' : `Lưu tất cả (${draftShows.length})`}</span>
            </button>
            <button
              className="btn sm"
              onClick={handleClearAllDrafts}
              title="Hủy bỏ tất cả suất bản thảo"
              style={{ color: '#f85149', borderColor: 'rgba(248, 81, 73, 0.3)' }}
            >
              <span>🗑️ Hủy tất cả</span>
            </button>
          </div>
        </div>
      )}

      {/* ── MAIN 3 COLUMNS ── */}
      <main ref={mainContainerRef}>
        {/* LEFT: movies */}
        <section className="card panel-left" style={{ width: `${leftWidth}px`, flexShrink: 0 }}>
          <div className="card-h" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <h3>Phim đang chiếu</h3>
              <small>
                {movies.filter(m => m.status === 'NOW_SHOWING' || (m.release <= date && m.end >= date)).length} phim đang chiếu • {movies.filter(m => m.status === 'UPCOMING' || m.release > date).length} sắp chiếu
              </small>
            </div>
            <button
              className="btn sm"
              onClick={fetchMovies}
              title="Lấy lại danh sách phim từ Backend"
              style={{ fontSize: '11px', padding: '3px 8px', color: loadingMovies ? 'var(--primary)' : 'inherit' }}
            >
              ↻ {loadingMovies ? 'Đang tải...' : 'BE'}
            </button>
          </div>
          <div className="card-b">
            {isTodayOrPast && (
              <div style={{
                background: 'rgba(239, 68, 68, 0.12)',
                border: '1px solid rgba(239, 68, 68, 0.28)',
                borderRadius: '8px',
                padding: '6px 10px',
                marginBottom: '10px',
                fontSize: '11px',
                color: '#fca5a5',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}>
                <span>🚫</span>
                <span>Khóa kéo thả lên lịch cho ngày {isToday ? 'hôm nay' : 'quá khứ'}</span>
              </div>
            )}
            {/* Filter Tabs: Đang chiếu / Sắp chiếu / Tất cả */}
            <div style={{ display: 'flex', gap: '4px', marginBottom: '8px' }}>
              <button
                type="button"
                className={`tag ${movieFilter === 'NOW_SHOWING' ? 'hot' : ''}`}
                style={{
                  cursor: 'pointer',
                  padding: '4px 8px',
                  borderRadius: '6px',
                  border: '1px solid var(--line)',
                  background: movieFilter === 'NOW_SHOWING' ? 'var(--primary)' : '#161b22',
                  color: movieFilter === 'NOW_SHOWING' ? '#000' : '#c9d1d9',
                  fontWeight: movieFilter === 'NOW_SHOWING' ? 700 : 500,
                  fontSize: '11px',
                  transition: '0.15s'
                }}
                onClick={() => setMovieFilter('NOW_SHOWING')}
              >
                Đang chiếu ({movies.filter(m => m.status === 'NOW_SHOWING' || (m.release <= date && m.end >= date)).length})
              </button>
              <button
                type="button"
                className={`tag ${movieFilter === 'UPCOMING' ? 'hot' : ''}`}
                style={{
                  cursor: 'pointer',
                  padding: '4px 8px',
                  borderRadius: '6px',
                  border: '1px solid var(--line)',
                  background: movieFilter === 'UPCOMING' ? 'var(--primary)' : '#161b22',
                  color: movieFilter === 'UPCOMING' ? '#000' : '#c9d1d9',
                  fontWeight: movieFilter === 'UPCOMING' ? 700 : 500,
                  fontSize: '11px',
                  transition: '0.15s'
                }}
                onClick={() => setMovieFilter('UPCOMING')}
              >
                Sắp chiếu ({movies.filter(m => m.status === 'UPCOMING' || m.release > date).length})
              </button>
              <button
                type="button"
                className={`tag ${movieFilter === 'ALL' ? 'hot' : ''}`}
                style={{
                  cursor: 'pointer',
                  padding: '4px 8px',
                  borderRadius: '6px',
                  border: '1px solid var(--line)',
                  background: movieFilter === 'ALL' ? 'var(--primary)' : '#161b22',
                  color: movieFilter === 'ALL' ? '#000' : '#c9d1d9',
                  fontWeight: movieFilter === 'ALL' ? 700 : 500,
                  fontSize: '11px',
                  transition: '0.15s'
                }}
                onClick={() => setMovieFilter('ALL')}
              >
                Tất cả ({movies.length})
              </button>
            </div>

            <input
              className="search"
              placeholder="Tìm phim..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            <div>
              {filteredMovies.map(m => {
                const n = dayShows().filter(s => Number(s.movieId) === Number(m.id) && s.status !== 'cancel').length;
                const isUnreleased = Boolean(m.release && date < m.release);
                const isEnded = Boolean(m.end && date > m.end);
                const isInvalidForDate = isUnreleased || isEnded;
                const soon = m.status === 'UPCOMING' || isUnreleased;
                const isSel = selMovie === m.id;

                return (
                  <div
                    key={m.id}
                    className={`movie ${isSel ? 'sel' : ''}`}
                    draggable={!isInvalidForDate && !isTodayOrPast}
                    onDragStart={(e) => {
                      if (isInvalidForDate || isTodayOrPast) {
                        e.preventDefault();
                        return;
                      }
                      e.dataTransfer.setData('movieId', String(m.id));
                      window._dragMovieId = m.id;
                      window._dragShowId = null;
                      setDraggingShowId(null);
                      e.dataTransfer.effectAllowed = 'copy';
                    }}
                    onDragEnd={() => {
                      setDragGhost(null);
                      window._dragMovieId = null;
                      window._dragShowId = null;
                      setDraggingShowId(null);
                    }}
                    onClick={() => {
                      if (isUnreleased) {
                        showToast?.(`🚫 Phim "${m.title}" chưa tới ngày khởi chiếu (khởi chiếu từ ${m.release}). Vui lòng chọn ngày chiếu sau ${m.release}!`, 'warning');
                        return;
                      }
                      if (isEnded) {
                        showToast?.(`⚠️ Phim "${m.title}" đã hết hạn chiếu từ ngày ${m.end}.`, 'warning');
                        return;
                      }
                      if (isTodayOrPast) {
                        showToast?.('🚫 Không thể chọn phim lên lịch cho ngày hiện tại hoặc quá khứ.', 'warning');
                        return;
                      }
                      pickMovie(m.id);
                    }}
                    style={{
                      opacity: isInvalidForDate ? 0.42 : soon ? 0.7 : 1,
                      cursor: isInvalidForDate ? 'not-allowed' : 'pointer',
                      filter: isInvalidForDate ? 'grayscale(0.55)' : undefined
                    }}
                    title={
                      isUnreleased
                        ? `Phim chưa tới ngày khởi chiếu (khởi chiếu từ ${m.release}). Không thể lên lịch cho ngày ${date}.`
                        : isEnded
                          ? `Phim đã hết hạn chiếu (hạn đến ${m.end}).`
                          : isTodayOrPast
                            ? 'Ngày hiện tại đang khóa tạo mới.'
                            : 'Click để chọn hoặc kéo thả vào phòng chiếu'
                    }
                  >
                    <div className="poster" style={{ background: `linear-gradient(160deg, ${m.color}, ${m.color}99)`, overflow: 'hidden' }}>
                      {m.posterUrl ? (
                        <img
                          src={m.posterUrl}
                          alt={m.title}
                          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                          onError={(e) => { e.currentTarget.style.display = 'none'; }}
                        />
                      ) : (
                        m.title.charAt(0)
                      )}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div className="t">{m.title}</div>
                      <div className="m">
                        {m.dur}′ <span className="tag age">{m.age}</span>
                        {m.formats.map(f => (
                          <span key={f} className="tag">{f}</span>
                        ))}
                        {m.hot && <span className="tag hot">HOT</span>}
                      </div>
                      <div className="m">
                        {isUnreleased ? (
                          <span style={{ color: '#f87171', fontWeight: 700, fontSize: '10.5px' }}>
                            🚫 Chưa chiếu (từ {m.release.split('-').reverse().join('/')})
                          </span>
                        ) : isEnded ? (
                          <span style={{ color: '#f87171', fontWeight: 700, fontSize: '10.5px' }}>
                            ⚠️ Hết hạn ({m.end.split('-').reverse().join('/')})
                          </span>
                        ) : soon ? (
                          `Khởi chiếu ${m.release.split('-').reverse().join('/')}`
                        ) : (
                          `${n} suất hôm nay`
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="drag-hint">Kéo phim thả vào dòng phòng để tạo suất chiếu nhanh</div>
          </div>
        </section>

        {/* SPLITTER 1: Between Left Panel & Center Timeline */}
        <Splitter
          onDrag={handleStartDragLeft}
          isDragging={draggingSplitter === 'left'}
          title="Kéo sang trái / phải để điều chỉnh độ rộng danh sách phim"
        />

        {/* CENTER: timeline or week */}
        <section className="card panel-center" style={{ flex: '1 1 0%', minWidth: '380px' }}>
          {/* Quick Showtime Selection Action Banner */}
          {selId && (() => {
            const selShow = findShowById(selId);
            if (!selShow || selShow.isDraft) return null;
            const selM = M(selShow.movieId);
            const selR = R(selShow.roomId);
            return (
              <div style={{
                background: 'linear-gradient(90deg, rgba(239, 68, 68, 0.18), rgba(147, 51, 234, 0.15))',
                borderBottom: '1px solid rgba(239, 68, 68, 0.4)',
                padding: '8px 16px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '12px',
                flexShrink: 0
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0, overflow: 'hidden' }}>
                  <span style={{ fontSize: '15px' }}>🎬</span>
                  <span style={{ fontSize: '12px', color: '#fff', fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    Đang chọn suất: <strong style={{ color: '#fca5a5' }}>{selM?.title || 'Phim'}</strong> • Phòng: <strong style={{ color: '#38bdf8' }}>{selR?.name || selShow.roomId}</strong> • Giờ: <strong>{selShow.start}</strong> ({selShow.date}) • Đã bán: <strong style={{ color: '#f5b800' }}>{selShow.sold || 0} vé</strong>
                  </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
                  {selShow.status !== 'cancel' && (
                    <button
                      className="btn danger sm"
                      onClick={handleCancelShowtimeWithRefund}
                      title="Hủy suất chiếu do sự cố và tự động hoàn tiền toàn bộ vé vào CineWallet"
                      style={{
                        background: 'rgba(239, 68, 68, 0.25)',
                        border: '1px solid rgba(239, 68, 68, 0.6)',
                        color: '#fca5a5',
                        fontWeight: 700,
                        fontSize: '11.5px',
                        padding: '5px 12px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        borderRadius: '6px',
                        cursor: 'pointer'
                      }}
                    >
                      <span>⚠️ HỦY & HOÀN TIỀN SỰ CỐ</span>
                    </button>
                  )}
                  <button
                    className="btn sm"
                    onClick={() => setSelId(null)}
                    title="Bỏ chọn suất chiếu"
                    style={{ padding: '4px 8px', fontSize: '11px', color: 'var(--muted)' }}
                  >
                    ✕ Đóng
                  </button>
                </div>
              </div>
            );
          })()}
          <div ref={tlWrapRef} className="tl-wrap">
            {rooms.length === 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '360px', padding: '40px', textAlign: 'center', color: 'var(--muted)' }}>
                <div style={{ fontSize: '36px', marginBottom: '12px', opacity: 0.6 }}>🏢</div>
                <h4 style={{ color: '#fff', fontSize: '15px', fontWeight: 700, marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  Chi nhánh chưa có phòng chiếu hoạt động
                </h4>
                <p style={{ fontSize: '12.5px', maxWidth: '420px', lineHeight: 1.6, margin: '0 0 16px 0', color: 'var(--muted)' }}>
                  Cụm rạp đang chọn chưa có phòng chiếu nào được thiết lập. Vui lòng chuyển sang tab <strong style={{ color: '#f5b800' }}>Phòng chiếu &amp; ghế</strong> để tạo phòng chiếu trước khi điều phối lịch chiếu.
                </p>
              </div>
            ) : view === 'day' ? (
              <div className="tl">
                <div className="corner">Phòng / Giờ</div>
                <div className="hours">
                  {Array.from({ length: CLOSE - OPEN }, (_, i) => {
                    const h = OPEN + i;
                    return (
                      <span key={h}>{pad(h % 24)}:00</span>
                    );
                  })}
                </div>

                {rooms.map(r => {
                  const rs = dayShows().filter(s => Number(s.roomId) === Number(r.id));
                  const used = rs.filter(s => s.status !== 'cancel').reduce((a, s) => a + (M(s.movieId).dur || 120) + ADS + CLEAN, 0);
                  const pct = Math.min(100, Math.round(used / ((CLOSE - OPEN) * 60) * 100));

                  return (
                    <React.Fragment key={r.id}>
                      <div className={`roomcell ${r.active ? '' : 'off'}`}>
                        <b>{r.name}</b>
                        <small>{r.type} • {r.seats} ghế • {rs.length} suất{r.active ? '' : ' • Tạm ngưng'}</small>
                        <div className="bar">
                          <i style={{ width: `${pct}%` }} />
                        </div>
                      </div>

                      <div
                        className={`track ${r.active ? '' : 'off'}`}
                        style={{ width: `calc(var(--hourW) * ${CLOSE - OPEN})` }}
                        onClick={(e) => {
                          if (!r.active) return showToast?.('Phòng đang tạm ngưng', 'warning');
                          if (isTodayOrPast) {
                            return showToast?.('🚫 Không thể tạo suất chiếu ở ngày hiện tại hoặc quá khứ. Vui lòng bấm "Lên lịch ngày mai" để điều phối!', 'warning');
                          }
                          const x = e.clientX - e.currentTarget.getBoundingClientRect().left;
                          const mins = Math.round((OPEN * 60 + (x / 96) * 60) / 5) * 5;
                          const start = toT(mins);
                          if (selMovie) {
                            quickAdd(r.id, selMovie, start);
                          } else {
                            setAddModal({ roomId: r.id, start, date });
                          }
                        }}
                        onDragOver={(e) => {
                          e.preventDefault();
                          if (!r.active) return;
                          if (isTodayOrPast && !window._dragShowId) {
                            e.dataTransfer.dropEffect = 'none';
                            return;
                          }
                          e.currentTarget.classList.add('over');
                          const rect = e.currentTarget.getBoundingClientRect();
                          const x = e.clientX - rect.left;
                          const mins = Math.round((OPEN * 60 + (x / 96) * 60) / 5) * 5;
                          const start = toT(mins);
                          const mid = window._dragMovieId;
                          const gm = mid ? M(mid) : null;
                          const dur = (gm?.dur || 120) + ADS;
                          const left = ((mins - OPEN * 60) / 60) * 96;
                          const wd = ((dur + CLEAN) / 60) * 96;
                          const cw = (CLEAN / 60) * 96;

                          setDragGhost({
                            roomId: r.id,
                            left,
                            width: wd,
                            cleanWidth: cw,
                            time: `${start}–${toT(mins + dur)}`,
                            title: gm?.title || ''
                          });
                        }}
                        onDragLeave={(e) => {
                          if (!e.currentTarget.contains(e.relatedTarget)) {
                            e.currentTarget.classList.remove('over');
                            setDragGhost(null);
                          }
                        }}
                        onDrop={(e) => {
                          e.preventDefault();
                          e.currentTarget.classList.remove('over');
                          setDragGhost(null);
                          setDraggingShowId(null);
                          if (!r.active) return showToast?.('Phòng đang tạm ngưng', 'warning');
                          const x = e.clientX - e.currentTarget.getBoundingClientRect().left;
                          const mins = Math.round((OPEN * 60 + (x / 96) * 60) / 5) * 5;
                          const start = toT(mins);
                          const mid = e.dataTransfer.getData('movieId') || window._dragMovieId;
                          const sid = e.dataTransfer.getData('showId') || window._dragShowId;

                          if (mid && !sid) {
                            if (isTodayOrPast) {
                              return showToast?.('🚫 Không thể kéo thả tạo suất chiếu ở ngày hiện tại hoặc quá khứ.', 'warning');
                            }
                            quickAdd(r.id, Number(mid), start);
                          } else if (sid) {
                            const curShow = findShowById(sid);
                            if (curShow) {
                              const cand = { ...curShow, roomId: r.id, start };
                              const val = validate(cand, curShow.id);
                              if (val.errs.length) return showToast?.('✕ ' + val.errs[0], 'error');

                              // Nếu là bản thảo chưa lưu vào server:
                              if (curShow.isDraft) {
                                setDraftShows(prev => prev.map(x => String(x.id) === String(sid) ? cand : x));
                                setSelId(curShow.id);
                                showToast?.(`✓ Đã chuyển bản thảo sang ${start} (${r.name})`, 'info');
                                return;
                              }

                              // Nếu là suất chiếu đã lưu trong database: Gọi API cập nhật ngay lập tức
                              const token = getTokenRef.current?.();
                              if (token && curShow.id && !isNaN(Number(curShow.id))) {
                                (async () => {
                                  try {
                                    const statusMap = { 'open': 'OPEN', 'plan': 'SCHEDULED', 'cancel': 'CANCELLED', 'done': 'COMPLETED' };
                                    const stdPrice = cand.price?.std || cand.raw?.basePrice || DEFAULT_PRICES[cand.fmt]?.std || 60000;
                                    const vipPrice = cand.price?.vip || cand.raw?.vipPrice || DEFAULT_PRICES[cand.fmt]?.vip || 90000;
                                    const couplePrice = cand.price?.couple || cand.raw?.couplePrice || DEFAULT_PRICES[cand.fmt]?.couple || 150000;

                                    const payload = {
                                      movieId: Number(cand.movieId),
                                      roomId: Number(r.id),
                                      startTime: `${cand.date}T${start}:00`,
                                      basePrice: stdPrice,
                                      vipPrice: vipPrice,
                                      couplePrice: couplePrice,
                                      status: statusMap[cand.status] || cand.raw?.status || 'SCHEDULED'
                                    };

                                    await adminService.updateAdminShowtime(token, curShow.id, payload);
                                    setShows(prev => prev.map(x => String(x.id) === String(sid) ? cand : x));
                                    setSelId(curShow.id);
                                    showToast?.(`✓ Đã chuyển suất chiếu sang ${start} (${r.name})`, 'success');
                                    fetchShowtimes(date);
                                  } catch (err) {
                                    console.error('Lỗi di chuyển suất chiếu:', err);
                                    showToast?.('✕ Không thể di chuyển suất chiếu: ' + getApiErrorMessage(err), 'error');
                                  }
                                })();
                              } else {
                                setShows(prev => prev.map(x => String(x.id) === String(sid) ? cand : x));
                                setSelId(curShow.id);
                              }
                            }
                          }
                        }}
                      >
                        {/* Now Line */}
                        {date === todayStr() && (() => {
                          const now = new Date();
                          const mm = now.getHours() * 60 + now.getMinutes();
                          if (mm >= OPEN * 60 && mm < CLOSE * 60) {
                            const left = ((mm - OPEN * 60) / 60) * 96;
                            return <div className="nowline" style={{ left: `${left}px` }} />;
                          }
                          return null;
                        })()}

                        {/* Ghost Drop Preview Indicator */}
                        {dragGhost && dragGhost.roomId === r.id && (
                          <div
                            className="ghost"
                            style={{
                              left: `${dragGhost.left}px`,
                              width: `${dragGhost.width}px`
                            }}
                          >
                            <span className="ghost-time">
                              📍 ${dragGhost.time} ${dragGhost.title ? `• ${dragGhost.title}` : ''}
                            </span>
                            <div className="ghost-clean" style={{ width: `${dragGhost.cleanWidth}px` }} />
                          </div>
                        )}

                        {/* Show Blocks */}
                        {rs.map(s => {
                          const m = M(s.movieId);
                          const st = toMin(s.start);
                          const dur = (m.dur || 120) + ADS;
                          const left = ((st - OPEN * 60) / 60) * 96;
                          const wd = (dur / 60) * 96;
                          const cw = (CLEAN / 60) * 96;
                          const v = validate(s, s.id);
                          const sold = r.seats > 0 ? Math.round((s.sold / r.seats) * 100) : 0;
                          const isSel = selId === s.id;
                          const isDraft = Boolean(s.isDraft);

                          return (
                            <div
                              key={s.id}
                              draggable
                              onDragStart={(e) => {
                                e.stopPropagation();
                                e.dataTransfer.setData('showId', String(s.id));
                                window._dragShowId = s.id;
                                window._dragMovieId = s.movieId;
                                setDraggingShowId(s.id);
                              }}
                              onDragEnd={() => {
                                setDragGhost(null);
                                window._dragMovieId = null;
                                window._dragShowId = null;
                                setDraggingShowId(null);
                              }}
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelId(s.id);
                                setTabIdx(0);
                                setIsRightPanelOpen(true);
                              }}
                              className={`blk ${isSel ? 'sel' : ''} ${v.errs.length ? 'conflict' : ''} ${s.status === 'cancel' ? 'cancel' : ''} ${isDraft ? 'is-draft-slot' : ''}`}
                              style={{
                                left: `${left}px`,
                                width: `${wd + cw}px`,
                                background: isDraft ? `repeating-linear-gradient(45deg, ${m.color}, ${m.color} 10px, ${m.color}cc 10px, ${m.color}cc 20px)` : m.color,
                                border: isDraft ? '2px dashed #f5b800' : undefined,
                                boxShadow: isDraft ? '0 0 10px rgba(245, 184, 0, 0.4)' : undefined,
                                opacity: draggingShowId === s.id ? 0.35 : 1,
                                transition: 'opacity 0.15s ease'
                              }}
                              title={`${isDraft ? '[BẢN THẢO] ' : ''}${m.title} • ${s.start}–${toT(st + dur)} • ${s.sold}/${r.seats} vé`}
                            >
                              <b>{isDraft ? `[BẢN THẢO] ${m.title}` : m.title}</b>
                              <span>
                                {s.start}–{toT(st + dur)} • {s.fmt} {s.lang === 'Lồng tiếng' ? 'LT' : s.lang === 'Phụ đề' ? 'PĐ' : ''} • {sold}%
                              </span>
                              <div className="clean" style={{ width: `${cw}px` }} />
                              <div className="sold" style={{ width: `${(wd * sold) / 100}px` }} />
                            </div>
                          );
                        })}
                      </div>
                    </React.Fragment>
                  );
                })}
              </div>
            ) : (
              /* Week View */
              (() => {
                const dayOfWeek = (new Date(date + 'T00:00:00').getDay() + 6) % 7;
                const weekStart = addDays(date, -dayOfWeek);
                const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

                return (
                  <div className="week">
                    <div className="wh wr" style={{ zIndex: 4 }}>Phòng</div>
                    {days.map(d => {
                      const n = shows.filter(s => s.date === d && s.status !== 'cancel').length;
                      return (
                        <div key={d} className={`wh ${d === todayStr() ? 'today' : ''}`}>
                          {DOW[new Date(d + 'T00:00:00').getDay()]}
                          <small>{d.split('-').reverse().slice(0, 2).join('/')} • {n} suất</small>
                        </div>
                      );
                    })}

                    {rooms.map(r => (
                      <React.Fragment key={r.id}>
                        <div className="wr">
                          {r.name}
                          <small style={{ display: 'block', color: 'var(--muted)', fontWeight: 500 }}>{r.type}</small>
                        </div>
                        {days.map(d => {
                          const rShows = shows
                            .filter(s => s.date === d && Number(s.roomId) === Number(r.id))
                            .sort((a, b) => a.start.localeCompare(b.start));

                          return (
                            <div
                              key={d}
                              className="cell"
                              onClick={() => { setDate(d); setView('day'); }}
                            >
                              {rShows.slice(0, 4).map(s => (
                                <div
                                  key={s.id}
                                  className="chip"
                                  style={{
                                    background: M(s.movieId).color,
                                    opacity: s.status === 'cancel' ? 0.4 : 1
                                  }}
                                >
                                  {s.start} {M(s.movieId).title}
                                </div>
                              ))}
                              {rShows.length > 4 && <div className="more">+{rShows.length - 4} suất khác</div>}
                              {rShows.length === 0 && <div className="more">—</div>}
                            </div>
                          );
                        })}
                      </React.Fragment>
                    ))}
                  </div>
                );
              })()
            )}
          </div>

          {/* Legend */}
          <div className="legend">
            {Array.from(new Set(dayShows().map(s => s.movieId))).map(id => (
              <span key={id}>
                <i style={{ background: M(id).color }} />
                {M(id).title}
              </span>
            ))}
            <span style={{ marginLeft: 'auto' }}>
              <i style={{ background: 'repeating-linear-gradient(135deg, #94a3b8 0 3px, transparent 3px 6px)', border: '1px solid #94a3b8' }} />
              Dọn phòng {CLEAN}′
            </span>
            <span>
              <i style={{ border: '2px solid var(--danger)', background: 'none' }} />
              Xung đột
            </span>
          </div>

          {/* Stats */}
          <div className="stats">
            <div className="stat">
              <b>{stats.showCount}</b>
              <span>Suất chiếu</span>
            </div>
            <div className="stat">
              <b>{stats.movieCount}</b>
              <span>Phim</span>
            </div>
            <div className="stat">
              <b>{stats.util}%</b>
              <span>Công suất phòng</span>
            </div>
            <div className="stat">
              <b>{stats.fillRate}%</b>
              <span>Lấp đầy ({stats.sold}/{stats.cap} vé)</span>
            </div>
            <div className="stat">
              <b style={{ color: stats.conflictsCount ? 'var(--danger)' : 'var(--ok)' }}>{stats.conflictsCount}</b>
              <span>Xung đột</span>
            </div>
          </div>
        </section>

        {/* SPLITTER 2: Between Center Timeline & Right Info Panel */}
        {isRightPanelOpen && (
          <Splitter
            onDrag={handleStartDragRight}
            isDragging={draggingSplitter === 'right'}
            title="Kéo sang trái / phải để điều chỉnh độ rộng bảng thông tin"
          />
        )}

        {/* RIGHT: tabs */}
        {isRightPanelOpen && (
          <section className="card panel-right right" style={{ width: `${rightWidth}px`, flexShrink: 0 }}>
            <div className="tabs" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', overflow: 'hidden' }}>
                <button className={tabIdx === 0 ? 'on' : ''} onClick={() => setTabIdx(0)}>Chi tiết suất</button>
                <button className={tabIdx === 1 ? 'on' : ''} onClick={() => setTabIdx(1)}>Tổng quan ngày</button>
                <button className={tabIdx === 2 ? 'on' : ''} onClick={() => setTabIdx(2)}>
                  Cảnh báo {allConflicts.length > 0 && <span className="conflict-badge">{allConflicts.length}</span>}
                </button>
              </div>
              <button
                type="button"
                onClick={() => setIsRightPanelOpen(false)}
                title="Thu gọn bảng thông tin bên phải"
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: 'var(--muted)',
                  cursor: 'pointer',
                  padding: '4px 8px',
                  fontSize: '12px',
                  borderRadius: '6px',
                  marginRight: '6px',
                  transition: 'color .15s'
                }}
                onMouseEnter={(e) => { e.currentTarget.style.color = '#fff'; }}
                onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--muted)'; }}
              >
                ✕
              </button>
            </div>

            <div className="card-b">
              {/* TAB 0 */}
              {tabIdx === 0 && (() => {
                const s = findShowById(selId);
                if (!s) {
                  return (
                    <div className="empty">
                      <i>🎟️</i>
                      Chọn một suất chiếu trên lịch để xem / chỉnh sửa.<br />
                      Hoặc kéo phim vào dòng phòng để tạo suất mới.
                    </div>
                  );
                }

                const m = M(s.movieId);
                const r = R(s.roomId);
                const v = validate(s, s.id);
                const end = toT(endOf(s));
                const stMap = { open: 'Đang bán vé', plan: 'Đã lên lịch', cancel: 'Đã huỷ', done: 'Đã chiếu' };
                const pct = r.seats > 0 ? Math.round((s.sold / r.seats) * 100) : 0;
                const prices = s.price || r.price || DEFAULT_PRICES[s.fmt] || DEFAULT_PRICES['2D'];

                return (
                  <div>
                    {s.isDraft && (
                      <div style={{
                        background: 'rgba(245, 184, 0, 0.12)',
                        border: '1px dashed #f5b800',
                        padding: '10px 12px',
                        borderRadius: '6px',
                        marginBottom: '14px',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '8px'
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                          <span style={{ fontSize: '12px', color: '#f5b800', fontWeight: 800 }}>
                            📝 Suất Chiếu Bản Thảo (Chưa Lưu)
                          </span>
                          <span style={{ fontSize: '10.5px', background: 'rgba(245, 184, 0, 0.2)', color: '#f5b800', padding: '2px 6px', borderRadius: '4px', fontWeight: 700 }}>
                            DRAFT
                          </span>
                        </div>
                        <div style={{ display: 'flex', gap: '6px' }}>
                          <button
                            className="btn sm"
                            style={{ flex: 1, fontSize: '11px', padding: '4px 6px', background: '#161b22', border: '1px solid rgba(255,255,255,0.2)' }}
                            onClick={() => handlePreviewPrices([s])}
                            title="Xem trước giá vé tính toán cho suất này"
                          >
                            👁️ Xem giá
                          </button>
                          <button
                            className="btn primary sm"
                            style={{ flex: 1, fontSize: '11px', padding: '4px 6px' }}
                            onClick={() => handleSaveSingleDraft(s)}
                            title="Lưu ngay suất chiếu này vào hệ thống"
                          >
                            💾 Lưu ngay
                          </button>
                          <button
                            className="btn sm"
                            style={{ fontSize: '11px', padding: '4px 8px', color: '#f85149', borderColor: 'rgba(248,81,73,0.3)' }}
                            onClick={() => handleDeleteDraft(s.id)}
                            title="Xóa suất bản thảo này"
                          >
                            ✕
                          </button>
                        </div>
                      </div>
                    )}

                    <div style={{ display: 'flex', gap: '10px', marginBottom: '12px' }}>
                      <div className="poster" style={{ background: m.color, width: '44px', height: '60px' }}>
                        {m.title.charAt(0)}
                      </div>
                      <div>
                        <b style={{ fontSize: '14px', color: '#fff' }}>{m.title}</b>
                        <div style={{ fontSize: '12px', color: 'var(--muted)', marginTop: '3px' }}>
                          {m.dur} phút • {m.age} • {m.formats.join('/')}
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '6px', flexWrap: 'wrap' }}>
                          <span className={`status st-${s.status}`}>
                            {stMap[s.status]}
                          </span>
                          {Number(s.sold || 0) > 0 && (
                            <span style={{ fontSize: '11px', color: '#38bdf8', fontWeight: 700, background: 'rgba(56, 189, 248, 0.12)', padding: '2px 7px', borderRadius: '4px', border: '1px solid rgba(56, 189, 248, 0.3)' }}>
                              🎟️ {s.sold}/{r.seats} vé ({pct}%)
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {v.errs.map((e, i) => (
                      <div key={i} className="alert err">⛔ {e}</div>
                    ))}
                    {v.warns.map((w, i) => (
                      <div key={i} className="alert warn">⚠️ {w}</div>
                    ))}

                    <div className="field">
                      <label>Phim</label>
                      {(() => {
                        const isShowtimeOpened = s.status === 'open' || s.status === 'OPEN' || Number(s.sold || 0) > 0;
                        return (
                          <>
                            <select
                              value={s.movieId}
                              disabled={isShowtimeOpened}
                              onChange={(e) => handleUpdate('movieId', Number(e.target.value))}
                              style={
                                isShowtimeOpened
                                  ? { opacity: 0.6, cursor: 'not-allowed', background: '#161b22', borderColor: 'rgba(255,255,255,0.1)' }
                                  : {}
                              }
                              title={
                                isShowtimeOpened
                                  ? `Suất chiếu đã mở bán (${s.sold || 0} vé đã bán), không thể đổi phim`
                                  : 'Đổi phim cho suất chiếu'
                              }
                            >
                              {movies.map(x => (
                                <option key={x.id} value={x.id}>{x.title}</option>
                              ))}
                            </select>
                            {isShowtimeOpened && (
                              <span style={{ fontSize: '10.5px', color: '#f59e0b', display: 'block', marginTop: '3px', fontWeight: 600 }}>
                                🔒 Suất chiếu đã mở bán vé ({s.sold || 0} vé đã bán)
                              </span>
                            )}
                          </>
                        );
                      })()}
                    </div>

                    <div className="row2">
                      <div className="field">
                        <label>Phòng</label>
                        <select value={s.roomId} onChange={(e) => handleUpdate('roomId', Number(e.target.value))}>
                          {rooms.map(x => (
                            <option key={x.id} value={x.id}>{x.name} ({x.type})</option>
                          ))}
                        </select>
                      </div>
                      <div className="field">
                        <label>Ngày</label>
                        <input type="date" value={s.date} onChange={(e) => handleUpdate('date', e.target.value)} />
                      </div>
                    </div>

                    <div className="row3">
                      <div className="field">
                        <label>Bắt đầu (24h)</label>
                        <input
                          type="text"
                          value={s.start || ''}
                          placeholder="18:00"
                          maxLength={5}
                          style={{ fontFamily: 'monospace', fontWeight: 700, textAlign: 'center' }}
                          title="Định dạng 24h: HH:mm (VD: 18:00, 09:30)"
                          onChange={(e) => {
                            let v = e.target.value.replace(/[;.]/g, ':');
                            handleUpdate('start', v);
                          }}
                          onBlur={(e) => {
                            let val = (e.target.value || '').trim().replace(/[;.]/g, ':');
                            if (/^\d{1,2}$/.test(val)) {
                              val = val.padStart(2, '0') + ':00';
                              handleUpdate('start', val);
                            } else if (/^\d{1,2}:\d{1,2}$/.test(val)) {
                              const [hh, mm] = val.split(':');
                              val = hh.padStart(2, '0') + ':' + mm.padStart(2, '0');
                              handleUpdate('start', val);
                            }
                          }}
                        />
                      </div>
                      <div className="field">
                        <label>Kết thúc</label>
                        <input value={end} disabled style={{ background: '#1c2128', color: 'var(--muted)', textAlign: 'center', fontFamily: 'monospace' }} />
                      </div>
                      <div className="field">
                        <label>Trống tới</label>
                        <input value={toT(endOf(s) + CLEAN)} disabled style={{ background: '#1c2128', color: 'var(--muted)', textAlign: 'center', fontFamily: 'monospace' }} />
                      </div>
                    </div>

                    <div className="field">
                      <label>Trạng thái</label>
                      {(() => {
                        const isShowtimeOpened = s.status === 'open' || s.status === 'OPEN' || Number(s.sold || 0) > 0;
                        return (
                          <>
                            <select
                              value={s.status}
                              disabled={isShowtimeOpened}
                              onChange={(e) => handleUpdate('status', e.target.value)}
                              style={
                                isShowtimeOpened
                                  ? { opacity: 0.6, cursor: 'not-allowed', background: '#161b22', borderColor: 'rgba(255,255,255,0.1)' }
                                  : {}
                              }
                              title={
                                isShowtimeOpened
                                  ? 'Suất chiếu đang bán vé, không thể đổi trạng thái'
                                  : 'Thay đổi trạng thái suất chiếu'
                              }
                            >
                              {Object.entries(stMap).map(([k, vv]) => (
                                <option key={k} value={k}>{vv}</option>
                              ))}
                            </select>
                            {isShowtimeOpened && (
                              <span style={{ fontSize: '10.5px', color: '#f59e0b', display: 'block', marginTop: '3px', fontWeight: 600 }}>
                                🔒 Suất chiếu đang bán vé, không thể đổi trạng thái.
                              </span>
                            )}
                          </>
                        );
                      })()}
                    </div>

                    {/* THÔNG TIN BẢNG GIÁ VÉ CHI TIẾT (NGƯỜI LỚN, HSSV, TRẺ EM x GHẾ THƯỜNG, GHẾ VIP, GHẾ ĐÔI) */}
                    {(() => {
                      const formatPrice = (val) => {
                        if (val === null || val === undefined || val === '') return '0đ';
                        return `${Number(val).toLocaleString('vi-VN')}đ`;
                      };

                      const stdBase = detailPriceMatrix?.roomStandardPrice ?? s.raw?.basePrice ?? r?.standardPrice ?? prices?.std ?? 60000;
                      const vipBase = detailPriceMatrix?.roomVipPrice ?? s.raw?.vipPrice ?? r?.vipPrice ?? prices?.vip ?? 80000;
                      const coupleBase = detailPriceMatrix?.roomCouplePrice ?? s.raw?.couplePrice ?? r?.couplePrice ?? 140000;

                      const childAdd = detailPriceMatrix?.childAdditional ?? 0;
                      const studentAdd = detailPriceMatrix?.studentAdditional ?? 10000;
                      const adultAdd = detailPriceMatrix?.adultAdditional ?? 20000;

                      const childStd = detailPriceMatrix?.childStandardPrice ?? s.raw?.childStandardPrice ?? (stdBase + childAdd);
                      const studentStd = detailPriceMatrix?.studentStandardPrice ?? s.raw?.studentStandardPrice ?? (stdBase + studentAdd);
                      const adultStd = detailPriceMatrix?.adultStandardPrice ?? s.raw?.adultStandardPrice ?? (stdBase + adultAdd);

                      const childVip = detailPriceMatrix?.childVipPrice ?? s.raw?.childVipPrice ?? (vipBase + childAdd);
                      const studentVip = detailPriceMatrix?.studentVipPrice ?? s.raw?.studentVipPrice ?? (vipBase + studentAdd);
                      const adultVip = detailPriceMatrix?.adultVipPrice ?? s.raw?.adultVipPrice ?? (vipBase + adultAdd);

                      const childCouple = detailPriceMatrix?.childChildCouplePrice ?? s.raw?.childCouplePrice ?? (coupleBase + childAdd * 2);
                      const studentCouple = detailPriceMatrix?.studentStudentCouplePrice ?? s.raw?.studentCouplePrice ?? (coupleBase + studentAdd * 2);
                      const adultCouple = detailPriceMatrix?.adultAdultCouplePrice ?? s.raw?.adultCouplePrice ?? (coupleBase + adultAdd * 2);

                      return (
                        <div style={{
                          marginTop: '14px',
                          background: '#161b22',
                          border: '1px solid var(--line)',
                          borderRadius: '8px',
                          overflow: 'hidden',
                          boxShadow: '0 4px 12px rgba(0,0,0,0.25)'
                        }}>
                          <div style={{
                            padding: '8px 12px',
                            background: 'rgba(255, 255, 255, 0.04)',
                            borderBottom: '1px solid var(--line)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between'
                          }}>
                            <span style={{ fontSize: '11px', fontWeight: 800, color: '#f5b800', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                              🎫 Giá vé theo đối tượng & loại ghế
                            </span>
                            {loadingDetailPrice ? (
                              <span style={{ fontSize: '10px', color: 'var(--muted)' }}>⏳ Đang tải...</span>
                            ) : (
                              <span style={{ fontSize: '10px', color: '#8b949e' }}>Cụm rạp</span>
                            )}
                          </div>

                          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px', textAlign: 'center' }}>
                            <thead>
                              <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.08)', color: 'var(--muted)', background: 'rgba(0,0,0,0.25)' }}>
                                <th style={{ padding: '7px 8px', textAlign: 'left', fontWeight: 600 }}>Loại ghế</th>
                                <th style={{ padding: '7px 6px', color: '#38bdf8', fontWeight: 700 }}>Trẻ em</th>
                                <th style={{ padding: '7px 6px', color: '#34d399', fontWeight: 700 }}>Sinh viên</th>
                                <th style={{ padding: '7px 6px', color: '#fbbf24', fontWeight: 700 }}>Người lớn</th>
                              </tr>
                            </thead>
                            <tbody>
                              <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                                <td style={{ padding: '7px 8px', textAlign: 'left', fontWeight: 700, color: '#f1f5f9' }}>
                                  Thường
                                </td>
                                <td style={{ padding: '7px 6px', fontWeight: 800, color: '#38bdf8', fontFamily: 'monospace' }}>
                                  {formatPrice(childStd)}
                                </td>
                                <td style={{ padding: '7px 6px', fontWeight: 800, color: '#34d399', fontFamily: 'monospace' }}>
                                  {formatPrice(studentStd)}
                                </td>
                                <td style={{ padding: '7px 6px', fontWeight: 800, color: '#fbbf24', fontFamily: 'monospace' }}>
                                  {formatPrice(adultStd)}
                                </td>
                              </tr>
                              <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                                <td style={{ padding: '7px 8px', textAlign: 'left', fontWeight: 700, color: '#f5b800' }}>
                                  Ghế VIP
                                </td>
                                <td style={{ padding: '7px 6px', fontWeight: 800, color: '#38bdf8', fontFamily: 'monospace' }}>
                                  {formatPrice(childVip)}
                                </td>
                                <td style={{ padding: '7px 6px', fontWeight: 800, color: '#34d399', fontFamily: 'monospace' }}>
                                  {formatPrice(studentVip)}
                                </td>
                                <td style={{ padding: '7px 6px', fontWeight: 800, color: '#fbbf24', fontFamily: 'monospace' }}>
                                  {formatPrice(adultVip)}
                                </td>
                              </tr>
                              <tr>
                                <td style={{ padding: '7px 8px', textAlign: 'left', fontWeight: 700, color: '#ec4899' }}>
                                  Ghế Đôi
                                </td>
                                <td style={{ padding: '7px 6px', fontWeight: 800, color: '#38bdf8', fontFamily: 'monospace' }}>
                                  {formatPrice(childCouple)}
                                </td>
                                <td style={{ padding: '7px 6px', fontWeight: 800, color: '#34d399', fontFamily: 'monospace' }}>
                                  {formatPrice(studentCouple)}
                                </td>
                                <td style={{ padding: '7px 6px', fontWeight: 800, color: '#fbbf24', fontFamily: 'monospace' }}>
                                  {formatPrice(adultCouple)}
                                </td>
                              </tr>
                            </tbody>
                          </table>
                        </div>
                      );
                    })()}

                    {s.status !== 'cancel' && !s.isDraft && (
                      <div style={{ marginTop: '16px', paddingTop: '14px', borderTop: '1px solid var(--line)' }}>
                        <div style={{ fontSize: '11px', color: '#f87171', fontWeight: 700, marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <span>⚠️ THAO TÁC SỰ CỐ KHẨN CẤP:</span>
                        </div>
                        <button
                          className="btn danger"
                          style={{
                            width: '100%',
                            justifyContent: 'center',
                            padding: '10px 12px',
                            fontSize: '12px',
                            fontWeight: 'bold',
                            background: 'rgba(239, 68, 68, 0.15)',
                            border: '1px solid rgba(239, 68, 68, 0.5)',
                            color: '#f87171',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px',
                            borderRadius: '6px',
                            cursor: 'pointer',
                            boxShadow: '0 2px 8px rgba(239, 68, 68, 0.15)'
                          }}
                          onClick={handleCancelShowtimeWithRefund}
                          title="Hủy suất chiếu do sự cố và tự động hoàn tiền toàn bộ vé vào CineWallet của khách hàng"
                        >
                          <span>⚠️ HỦY & HOÀN TIỀN SỰ CỐ</span>
                        </button>
                        <div style={{ fontSize: '10.5px', color: 'var(--muted)', marginTop: '5px', textAlign: 'center' }}>
                          Tự động hoàn tiền vào CineWallet & giải phóng toàn bộ ghế
                        </div>
                      </div>
                    )}

                    <div style={{ display: 'flex', gap: '6px', marginTop: '14px' }}>
                      <button
                        className="btn"
                        style={{ flex: 1, justifyContent: 'center', padding: '8px 6px', fontSize: '12px' }}
                        onClick={() => setAddModal({
                          roomId: s.roomId,
                          movieId: s.movieId,
                          date: s.date < getTomorrowStr() ? getTomorrowStr() : s.date
                        })}
                        title={s.date < getTomorrowStr() ? "Nhân bản sang ngày mai (vì ngày hiện tại bị khóa tạo)" : "Nhân bản suất chiếu"}
                      >
                        ⧉ Nhân bản…
                      </button>
                      <button
                        className="btn"
                        style={{
                          flex: 1,
                          justifyContent: 'center',
                          padding: '8px 6px',
                          fontSize: '12px',
                          opacity: s.date < getTomorrowStr() ? 0.45 : 1,
                          cursor: s.date < getTomorrowStr() ? 'not-allowed' : 'pointer'
                        }}
                        disabled={s.date < getTomorrowStr()}
                        onClick={handleNextSlot}
                        title={s.date < getTomorrowStr() ? "Khóa tạo suất kế tiếp cho ngày hiện tại/quá khứ" : "Tạo suất kế tiếp"}
                      >
                        ⏭ Suất kế tiếp
                      </button>
                      <button
                        className="btn danger"
                        style={{ padding: '8px 10px' }}
                        onClick={handleDelete}
                        title="Xoá suất chiếu"
                      >
                        🗑
                      </button>
                    </div>
                  </div>
                );
              })()}

              {/* TAB 1 */}
              {tabIdx === 1 && (() => {
                const ds = dayShows();
                const byMovie = Array.from(new Set(ds.map(s => s.movieId))).map(id => ({
                  m: M(id),
                  n: ds.filter(s => Number(s.movieId) === Number(id) && s.status !== 'cancel').length,
                  sold: ds.filter(s => Number(s.movieId) === Number(id)).reduce((a, s) => a + s.sold, 0)
                })).sort((a, b) => b.n - a.n);

                const notIn = movies.filter(m => m.release <= date && m.end >= date && !ds.some(s => Number(s.movieId) === Number(m.id)));

                return (
                  <div>
                    <h4 style={{ fontSize: '12px', color: 'var(--muted)', marginBottom: '10px' }}>THEO PHÒNG</h4>
                    {rooms.map(r => {
                      const rs = ds.filter(s => Number(s.roomId) === Number(r.id) && s.status !== 'cancel')
                        .sort((a, b) => a.start.localeCompare(b.start));
                      const gaps = [];
                      let cur = OPEN * 60;
                      rs.forEach(s => {
                        const st = toMin(s.start);
                        if (st - cur >= 60) gaps.push(`${toT(cur)}–${toT(st)}`);
                        cur = endOf(s) + CLEAN;
                      });
                      if (CLOSE * 60 - cur >= 90) gaps.push(`${toT(cur)}–đóng cửa`);

                      const sold = rs.reduce((a, s) => a + s.sold, 0);
                      const cap = rs.length * r.seats;

                      return (
                        <div key={r.id} style={{ marginBottom: '14px' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 600 }}>
                            <span>{r.name} <small style={{ color: 'var(--muted)', fontWeight: 500 }}>{r.type}</small></span>
                            <span>{rs.length} suất</span>
                          </div>
                          <div className="occ"><i style={{ width: `${cap ? (sold / cap) * 100 : 0}%` }} /></div>
                          <div style={{ fontSize: '11.5px', color: 'var(--muted)', marginTop: '4px' }}>
                            Lấp đầy {cap ? Math.round((sold / cap) * 100) : 0}% • {rs.length ? `${rs[0].start} → ${toT(endOf(rs[rs.length - 1]))}` : 'Chưa có suất'}
                          </div>
                          {gaps.length > 0 && (
                            <div style={{ fontSize: '11.5px', color: '#f59e0b', marginTop: '3px' }}>
                              ⏱ Khoảng trống: {gaps.join(', ')}
                            </div>
                          )}
                        </div>
                      );
                    })}

                    <h4 style={{ fontSize: '12px', color: 'var(--muted)', margin: '14px 0 8px' }}>THEO PHIM</h4>
                    <div className="list">
                      {byMovie.map(x => (
                        <div key={x.m.id} className="li">
                          <i style={{ background: x.m.color }} />
                          <span className="t">{x.m.title}</span>
                          <small>{x.n} suất • {x.sold} vé</small>
                        </div>
                      ))}
                      {byMovie.length === 0 && <div className="empty">Chưa có suất</div>}
                    </div>

                    {notIn.length > 0 && (
                      <div className="alert warn" style={{ marginTop: '12px' }}>
                        Phim đang chiếu nhưng <b>chưa có suất</b> hôm nay: {notIn.map(m => m.title).join(', ')}
                      </div>
                    )}
                  </div>
                );
              })()}

              {/* TAB 2 */}
              {tabIdx === 2 && (() => {
                if (allConflicts.length === 0) {
                  return (
                    <div>
                      <div className="alert ok">✓ Lịch chiếu ngày này không có xung đột.</div>
                      <div className="empty" style={{ padding: '20px' }}>
                        Hệ thống kiểm tra: trùng giờ + thời gian dọn phòng, định dạng phim/phòng, ngày khởi chiếu, giờ mở/đóng cửa, phim cùng lúc, khung giờ phù hợp độ tuổi.
                      </div>
                    </div>
                  );
                }

                return (
                  <div className="list">
                    {allConflicts.map((x, idx) => (
                      <div
                        key={idx}
                        className="li"
                        style={{ flexDirection: 'column', alignItems: 'stretch', gap: '4px' }}
                        onClick={() => { setSelId(x.s.id); setTabIdx(0); setIsRightPanelOpen(true); }}
                      >
                        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                          <i style={{ background: M(x.s.movieId).color }} />
                          <b className="t">{x.s.start} • {M(x.s.movieId).title}</b>
                          <small>{R(x.s.roomId).name}</small>
                        </div>
                        {x.errs.map((e, ei) => (
                          <div key={ei} style={{ color: '#f87171', fontSize: '12px' }}>⛔ {e}</div>
                        ))}
                        {x.warns.map((w, wi) => (
                          <div key={wi} style={{ color: '#fde047', fontSize: '12px' }}>⚠️ {w}</div>
                        ))}
                      </div>
                    ))}
                  </div>
                );
              })()}
            </div>
          </section>
        )}
      </main>

      {/* ── MODALS ── */}
      {addModal && (
        <div className="modal-bg" onClick={(e) => { if (e.target.classList.contains('modal-bg')) setAddModal(null); }}>
          <AddModalContent
            params={addModal}
            movies={movies}
            rooms={rooms}
            onClose={() => setAddModal(null)}
            showToast={showToast}
            onSuccess={() => {
              setAddModal(null);
              showToast?.('✓ Đã tạo suất chiếu thành công', 'success');
              fetchShowtimes(date);
            }}
            onAddDraft={(draftList) => {
              setDraftShows(prev => [...prev, ...draftList]);
              setAddModal(null);
              showToast?.(`📝 Đã thêm ${draftList.length} suất chiếu vào bản thảo`, 'info');
            }}
            getAdminToken={getAdminToken}
            validate={validate}
            M={M}
            R={R}
            endOf={endOf}
          />
        </div>
      )}

      {copyModal && (
        <div className="modal-bg" onClick={(e) => { if (e.target.classList.contains('modal-bg')) setCopyModal(false); }}>
          <CopyModalContent
            date={date}
            shows={shows}
            onClose={() => setCopyModal(false)}
            showToast={showToast}
            onSuccess={(targetDate) => {
              setDate(targetDate);
              setCopyModal(false);
              showToast?.(`✓ Đã sao chép lịch chiếu sang ngày ${targetDate}`, 'success');
              fetchShowtimes(targetDate);
            }}
            getAdminToken={getAdminToken}
            validate={validate}
          />
        </div>
      )}

      {previewModal && (
        <div className="modal-bg" onClick={(e) => { if (e.target.classList.contains('modal-bg')) setPreviewModal(false); }}>
          <PreviewPricesModalContent
            previewData={previewData}
            loading={loadingPreview}
            draftCount={draftShows.length}
            onClose={() => setPreviewModal(false)}
            onSaveAll={handleSaveAllDrafts}
            isSaving={isSavingAllDrafts}
          />
        </div>
      )}

      {/* Modal Xác nhận Hủy tất cả Bản thảo (Đồng bộ phong cách hệ thống) */}
      {confirmClearDraftsModal && (
        <div
          className="modal-bg"
          onClick={(e) => {
            if (e.target.classList.contains('modal-bg')) setConfirmClearDraftsModal(false);
          }}
        >
          <div
            className="modal"
            style={{
              maxWidth: '450px',
              border: '1px solid rgba(239, 68, 68, 0.45)',
              boxShadow: '0 20px 40px rgba(0,0,0,0.8), 0 0 25px rgba(239, 68, 68, 0.2)'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '14px' }}>
              <div
                style={{
                  width: '40px',
                  height: '40px',
                  borderRadius: '10px',
                  background: 'rgba(239, 68, 68, 0.15)',
                  border: '1px solid rgba(239, 68, 68, 0.35)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '20px',
                  flexShrink: 0
                }}
              >
                🗑️
              </div>
              <div>
                <h3 style={{ margin: 0, color: '#f87171', fontSize: '15px', fontWeight: 800 }}>
                  Hủy bỏ suất chiếu bản thảo
                </h3>
                <span style={{ fontSize: '11px', color: 'var(--muted)' }}>
                  Xác nhận thao tác trên lịch chiếu
                </span>
              </div>
            </div>

            <p style={{ color: '#e6edf3', fontSize: '13px', lineHeight: 1.6, margin: '0 0 14px 0' }}>
              Bạn có chắc chắn muốn hủy bỏ tất cả{' '}
              <strong style={{ color: '#f5b800', fontWeight: 700 }}>
                {draftShows.length} suất chiếu bản thảo
              </strong>{' '}
              chưa lưu?
            </p>

            <div
              style={{
                background: 'rgba(239, 68, 68, 0.08)',
                border: '1px solid rgba(239, 68, 68, 0.25)',
                borderRadius: '8px',
                padding: '10px 12px',
                fontSize: '11.5px',
                color: '#fca5a5',
                marginBottom: '18px',
                lineHeight: 1.5
              }}
            >
              ⚠️ <strong>Lưu ý:</strong> Các suất chiếu bản thảo này chưa được lưu vào hệ thống. Thao tác này sẽ giải phóng toàn bộ các khung giờ dự kiến hiện tại.
            </div>

            <div className="acts" style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
              <button
                className="btn"
                type="button"
                onClick={() => setConfirmClearDraftsModal(false)}
              >
                Giữ lại
              </button>
              <button
                className="btn danger"
                type="button"
                onClick={executeClearAllDrafts}
                style={{
                  background: '#dc2626',
                  color: '#fff',
                  fontWeight: 700,
                  padding: '8px 16px',
                  borderRadius: '6px'
                }}
              >
                Xác nhận hủy ({draftShows.length})
              </button>
            </div>
          </div>
        </div>
      )}

      {cancelModal && (
        <div className="modal-bg" onClick={(e) => { if (e.target.classList.contains('modal-bg') && !cancelModal.submitting) setCancelModal(null); }}>
          <div className="modal" style={{ maxWidth: '480px', border: '1px solid rgba(239, 68, 68, 0.45)', boxShadow: '0 20px 40px rgba(0,0,0,0.8), 0 0 30px rgba(239, 68, 68, 0.15)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '14px' }}>
              <div style={{
                width: '38px', height: '38px', borderRadius: '10px',
                background: 'rgba(239, 68, 68, 0.15)', border: '1px solid rgba(239, 68, 68, 0.4)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '18px', color: '#f87171'
              }}>
                ⚠️
              </div>
              <div>
                <h3 style={{ fontSize: '15px', fontWeight: 700, color: '#fff', margin: 0 }}>
                  Xác nhận Hủy suất chiếu & Hoàn tiền
                </h3>
                <span style={{ fontSize: '11.5px', color: '#f87171', fontWeight: 600 }}>
                  Thao tác sự cố khẩn cấp (CineWallet)
                </span>
              </div>
            </div>

            <div style={{
              background: '#161b22', border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: '10px', padding: '12px 14px', marginBottom: '14px', fontSize: '12.5px', lineHeight: 1.6
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                <span style={{ color: 'var(--muted)' }}>Phim:</span>
                <strong style={{ color: '#fff' }}>{M(cancelModal.showtime?.movieId)?.title || 'Phim'}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                <span style={{ color: 'var(--muted)' }}>Phòng chiếu:</span>
                <span style={{ color: '#38bdf8', fontWeight: 600 }}>{R(cancelModal.showtime?.roomId)?.name || cancelModal.showtime?.roomId}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                <span style={{ color: 'var(--muted)' }}>Thời gian:</span>
                <span style={{ color: '#f5b800', fontWeight: 600 }}>{cancelModal.showtime?.start} ngày {cancelModal.showtime?.date}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: '6px', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                <span style={{ color: 'var(--muted)' }}>Vé đã bán (Cần hoàn):</span>
                {cancelModal.loadingSummary ? (
                  <span style={{ color: '#f5b800', fontSize: '12px' }}>🔄 Đang kiểm tra hệ thống...</span>
                ) : (
                  <strong style={{ color: (cancelModal.soldCount || 0) > 0 ? '#f87171' : '#34d399', fontSize: '13px' }}>
                    {cancelModal.soldCount || 0} vé {cancelModal.paidBookingsCount !== null && cancelModal.paidBookingsCount !== undefined ? `(${cancelModal.paidBookingsCount} đơn đặt)` : ''}
                  </strong>
                )}
              </div>
              {cancelModal.totalRefundAmount !== null && cancelModal.totalRefundAmount !== undefined && (
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '4px' }}>
                  <span style={{ color: 'var(--muted)' }}>Tổng tiền hoàn trả:</span>
                  <strong style={{ color: '#38bdf8', fontSize: '13px' }}>
                    {fmtVN(cancelModal.totalRefundAmount)} đ
                  </strong>
                </div>
              )}
            </div>

            <div style={{
              background: (cancelModal.soldCount || 0) > 0 ? 'rgba(239, 68, 68, 0.08)' : 'rgba(59, 130, 246, 0.08)',
              border: `1px solid ${(cancelModal.soldCount || 0) > 0 ? 'rgba(239, 68, 68, 0.25)' : 'rgba(59, 130, 246, 0.25)'}`,
              borderRadius: '8px', padding: '10px 12px', marginBottom: '14px', fontSize: '12px',
              color: (cancelModal.soldCount || 0) > 0 ? '#fca5a5' : '#93c5fd', lineHeight: 1.5
            }}>
              {(cancelModal.soldCount || 0) > 0 ? (
                <>💡 <strong>Lưu ý:</strong> Toàn bộ <strong>{cancelModal.soldCount} vé</strong> đã thanh toán ({fmtVN(cancelModal.totalRefundAmount || 0)} đ) sẽ được hệ thống <strong>tự động hoàn tiền 100% vào CineWallet</strong> của từng khách hàng và các ghế đã đặt sẽ được giải phóng ngay lập tức.</>
              ) : (
                <>ℹ️ Suất chiếu hiện tại <strong>chưa có vé thanh toán</strong>. Thao tác hủy sẽ chuyển trạng thái suất chiếu sang "Đã hủy" một cách an toàn mà không phát sinh hoàn tiền.</>
              )}
            </div>

            <div className="field" style={{ marginBottom: '16px' }}>
              <label style={{ fontSize: '12px', fontWeight: 600, color: '#e6edf3', marginBottom: '6px', display: 'block' }}>
                Lý do hủy suất chiếu:
              </label>
              <input
                type="text"
                value={cancelModal.reason}
                onChange={(e) => setCancelModal(prev => ({ ...prev, reason: e.target.value }))}
                placeholder="Nhập lý do hủy sự cố (VD: Sự cố kỹ thuật phòng chiếu, mất điện...)"
                disabled={cancelModal.submitting}
                style={{
                  width: '100%', padding: '9px 12px', background: '#161b22',
                  border: '1px solid #30363d', borderRadius: '8px', color: '#fff', fontSize: '12.5px', outline: 'none'
                }}
              />
            </div>

            <div className="acts" style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
              <button
                type="button"
                className="btn"
                onClick={() => setCancelModal(null)}
                disabled={cancelModal.submitting}
                style={{ padding: '8px 16px', fontSize: '12.5px' }}
              >
                Hủy bỏ
              </button>
              <button
                type="button"
                className="btn danger"
                onClick={handleConfirmCancelAndRefund}
                disabled={cancelModal.submitting}
                style={{
                  padding: '8px 18px', fontSize: '12.5px', fontWeight: 700,
                  background: '#dc2626', borderColor: '#b91c1c', color: '#fff',
                  display: 'flex', alignItems: 'center', gap: '6px'
                }}
              >
                {cancelModal.submitting ? 'Đang xử lý...' : '⚠️ Xác nhận Hủy & Hoàn tiền'}
              </button>
            </div>
          </div>
        </div>
      )}


    </div>
  );
}

/* ================= SUB-MODAL COMPONENTS ================= */

function AddModalContent({ params, movies, rooms, onClose, onSuccess, onAddDraft, getAdminToken, validate, M, R, endOf, showToast }) {
  const [date, setDate] = useState(() => {
    const target = params?.date || getTomorrowStr();
    return target < getTomorrowStr() ? getTomorrowStr() : target;
  });

  const getInitialMovieId = () => {
    if (params?.movieId) {
      const pm = M(params.movieId);
      if (!pm?.release || pm.release <= (params?.date || getTomorrowStr())) return Number(params.movieId);
    }
    const valid = movies.find(x => (!x.release || x.release <= date) && (!x.end || x.end >= date));
    return valid ? Number(valid.id) : (params?.movieId ? Number(params.movieId) : (movies[0]?.id ? Number(movies[0].id) : 1));
  };

  const [movieId, setMovieId] = useState(getInitialMovieId);
  const [roomId, setRoomId] = useState(params.roomId || rooms[0]?.id || 1);

  // Sắp xếp các phim có thể tạo suất chiếu lên đầu tiên trong dropdown
  const sortedModalMovies = useMemo(() => {
    return movies.slice().sort((a, b) => {
      const aValid = (!a.release || a.release <= date) && (!a.end || a.end >= date);
      const bValid = (!b.release || b.release <= date) && (!b.end || b.end >= date);
      if (aValid && !bValid) return -1;
      if (!aValid && bValid) return 1;
      return 0;
    });
  }, [movies, date]);

  // Tự động chuyển sang phim hợp lệ đầu tiên nếu phim hiện tại không thể tạo suất cho ngày này
  useEffect(() => {
    const curM = M(movieId);
    const isCurValid = curM && (!curM.release || curM.release <= date) && (!curM.end || curM.end >= date);
    if (!isCurValid && sortedModalMovies.length > 0) {
      const firstValid = sortedModalMovies.find(x => (!x.release || x.release <= date) && (!x.end || x.end >= date));
      if (firstValid && Number(firstValid.id) !== Number(movieId)) {
        setMovieId(Number(firstValid.id));
      }
    }
  }, [date, sortedModalMovies]); // eslint-disable-line react-hooks/exhaustive-deps
  const [times, setTimes] = useState(new Set(params.start ? [params.start] : ['09:00', '13:30', '18:00']));
  const [customTime, setCustomTime] = useState('09:00');
  const [fmt, setFmt] = useState('2D');
  const [lang, setLang] = useState('Phụ đề');
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');

  const m = M(movieId);
  const r = R(roomId);
  const isMovieUnreleased = Boolean(m?.release && date < m.release);
  const isMovieEnded = Boolean(m?.end && date > m.end);
  const isDateBanned = Boolean(date < getTomorrowStr());
  const isFormInvalid = isDateBanned || isMovieUnreleased || isMovieEnded;

  const sug = ['09:00', '11:30', '14:00', '16:30', '19:00', '21:30'];
  const allTimes = useMemo(() => Array.from(new Set([...sug, ...times])).sort(), [times]);

  const toggleTime = (t) => {
    setTimes(prev => {
      const next = new Set(prev);
      if (next.has(t)) next.delete(t);
      else next.add(t);
      return next;
    });
  };

  const addCustom = () => {
    if (!customTime) return;
    setTimes(prev => new Set([...prev, customTime]));
  };

  const candidates = useMemo(() => {
    return Array.from(times).sort().map(t => ({
      id: Math.random().toString(36).slice(2, 9),
      date,
      roomId: Number(roomId),
      movieId: Number(movieId),
      start: t,
      fmt,
      lang,
      sold: 0,
      status: 'plan',
      note: ''
    }));
  }, [times, date, roomId, movieId, fmt, lang]);

  const handleAddToDraft = () => {
    if (isDateBanned) {
      const msg = 'Quy định: Suất chiếu phải được lên lịch trước ít nhất 1 ngày (từ ngày mai trở đi).';
      setFormError(msg);
      showToast?.('🚫 ' + msg, 'error');
      return;
    }
    if (isMovieUnreleased) {
      const msg = `Phim "${m?.title}" chưa tới ngày khởi chiếu (khởi chiếu từ ${m?.release}).`;
      setFormError(msg);
      showToast?.('🚫 ' + msg, 'error');
      return;
    }
    if (isMovieEnded) {
      const msg = `Phim "${m?.title}" đã hết hạn chiếu (từ ${m?.end}).`;
      setFormError(msg);
      showToast?.('⚠️ ' + msg, 'warning');
      return;
    }
    if (candidates.length === 0) {
      const msg = 'Vui lòng chọn ít nhất một giờ bắt đầu.';
      setFormError(msg);
      showToast?.('⚠️ ' + msg, 'warning');
      return;
    }
    const ok = candidates.filter(s => validate(s).errs.length === 0);
    if (ok.length === 0) {
      const firstErr = validate(candidates[0]).errs[0] || 'Bị xung đột giờ hoặc phòng';
      setFormError(firstErr);
      showToast?.('✕ ' + firstErr, 'error');
      return;
    }
    setFormError('');
    const drafts = ok.map(s => ({
      ...s,
      id: 'draft_' + Math.random().toString(36).slice(2, 9),
      isDraft: true
    }));
    onAddDraft?.(drafts);
  };

  const handleSubmit = async () => {
    if (isDateBanned) {
      const msg = 'Quy định: Suất chiếu phải được lên lịch trước ít nhất 1 ngày (từ ngày mai trở đi).';
      setFormError(msg);
      showToast?.('🚫 ' + msg, 'error');
      return;
    }
    if (isMovieUnreleased) {
      const msg = `Phim "${m?.title}" chưa tới ngày khởi chiếu (khởi chiếu từ ${m?.release}).`;
      setFormError(msg);
      showToast?.('🚫 ' + msg, 'error');
      return;
    }
    if (isMovieEnded) {
      const msg = `Phim "${m?.title}" đã hết hạn chiếu (từ ${m?.end}).`;
      setFormError(msg);
      showToast?.('⚠️ ' + msg, 'warning');
      return;
    }
    if (candidates.length === 0) {
      const msg = 'Vui lòng chọn ít nhất một khung giờ bắt đầu.';
      setFormError(msg);
      showToast?.('⚠️ ' + msg, 'warning');
      return;
    }

    const ok = candidates.filter(s => validate(s).errs.length === 0);
    if (ok.length === 0) {
      const firstErr = validate(candidates[0]).errs[0] || 'Bị xung đột giờ hoặc phòng';
      setFormError(firstErr);
      showToast?.('✕ ' + firstErr, 'error');
      return;
    }

    setSaving(true);
    const token = getAdminToken?.();

    let createdCount = 0;
    const errorList = [];
    for (const c of ok) {
      if (token) {
        try {
          const payload = {
            movieId: Number(c.movieId),
            roomId: Number(c.roomId),
            startTime: `${c.date}T${c.start}:00`,
            basePrice: DEFAULT_PRICES[c.fmt]?.std || 60000,
            vipPrice: DEFAULT_PRICES[c.fmt]?.vip || 90000,
            couplePrice: DEFAULT_PRICES[c.fmt]?.couple || 150000,
            status: 'SCHEDULED'
          };
          await adminService.createAdminShowtime(token, payload);
          createdCount++;
        } catch (err) {
          const msg = getApiErrorMessage(err);
          console.warn('Lỗi API create showtime:', err);
          errorList.push(`Suất lúc ${c.start}: ${msg}`);
        }
      }
    }

    setSaving(false);
    if (errorList.length > 0) {
      const errMsg = errorList.join('; ');
      setFormError(errMsg);
      showToast?.('✕ Lỗi tạo suất chiếu: ' + errMsg, 'error');
      return;
    }
    onSuccess();
  };

  return (
    <div className="modal">
      <h3>Thêm suất chiếu</h3>
      <p>Giờ kết thúc tự tính = bắt đầu + thời lượng + {ADS}′ quảng cáo. Có thể tạo nhiều suất một lần.</p>

      <div className="field">
        <label>Phim (Ưu tiên phim có thể tạo suất lên đầu)</label>
        <select
          value={movieId}
          onChange={(e) => {
            setMovieId(Number(e.target.value));
            setFormError('');
          }}
        >
          {sortedModalMovies.map(x => {
            const unreleased = Boolean(x.release && date < x.release);
            const ended = Boolean(x.end && date > x.end);
            const isDisabled = unreleased || ended;
            return (
              <option key={x.id} value={x.id} disabled={isDisabled}>
                {x.title} {unreleased ? `🚫 [Chưa chiếu - từ ${x.release}]` : ended ? `⚠️ [Đã hết hạn]` : `(${x.dur}′)`}
              </option>
            );
          })}
        </select>
        {isMovieUnreleased && (
          <span style={{ fontSize: '11px', color: '#f87171', display: 'block', marginTop: '3px', fontWeight: 600 }}>
            🚫 Phim chưa khởi chiếu cho ngày {date}. Ngày khởi chiếu: {m?.release}
          </span>
        )}
      </div>

      <div className="row2">
        <div className="field">
          <label>Phòng</label>
          <select value={roomId} onChange={(e) => setRoomId(Number(e.target.value))}>
            {rooms.filter(x => x.active).map(x => (
              <option key={x.id} value={x.id}>{x.name} ({x.type})</option>
            ))}
          </select>
        </div>
        <div className="field">
          <label>Ngày</label>
          <input type="date" min={getTomorrowStr()} value={date} onChange={(e) => setDate(e.target.value)} />
          {date < getTomorrowStr() && (
            <span style={{ fontSize: '11px', color: '#f87171', display: 'block', marginTop: '3px' }}>
              ⚠️ Suất chiếu chỉ được lên lịch từ ngày {getTomorrowStr()} trở đi
            </span>
          )}
        </div>
      </div>

      <div className="field">
        <label>Giờ bắt đầu (chọn nhiều)</label>
        <div className="chips">
          {allTimes.map(t => (
            <button
              key={t}
              type="button"
              className={`chip-btn ${times.has(t) ? 'on' : ''}`}
              onClick={() => toggleTime(t)}
            >
              {t}
            </button>
          ))}
        </div>
        <div style={{ display: 'flex', gap: '6px', marginTop: '8px' }}>
          <input
            type="time"
            step="300"
            value={customTime}
            onChange={(e) => setCustomTime(e.target.value)}
            style={{ flex: 1, padding: '7px 10px', border: '1px solid #30363d', borderRadius: '8px', background: '#161b22', color: '#fff' }}
          />
          <button className="btn sm" type="button" onClick={addCustom}>+ Thêm giờ</button>
        </div>
      </div>

      <div className="row2">
        <div className="field">
          <label>Định dạng</label>
          <select value={fmt} onChange={(e) => setFmt(e.target.value)}>
            {m.formats.map(f => (
              <option key={f} value={f}>{f}</option>
            ))}
          </select>
        </div>
        <div className="field">
          <label>Ngôn ngữ</label>
          <select value={lang} onChange={(e) => setLang(e.target.value)}>
            {['Phụ đề', 'Lồng tiếng', 'Tiếng Việt'].map(f => (
              <option key={f} value={f}>{f}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Policy Alert Banner in Modal */}
      {isDateBanned && (
        <div className="alert err" style={{ marginBottom: 12 }}>
          🚫 <b>Chính sách vận hành:</b> Suất chiếu chỉ được lên lịch trước ít nhất 1 ngày (từ ngày {getTomorrowStr()} trở đi). Ngày hiện tại hoặc quá khứ bị khóa tạo mới.
        </div>
      )}

      {isMovieUnreleased && (
        <div className="alert err" style={{ marginBottom: 12 }}>
          🚫 <b>Phim chưa khởi chiếu:</b> Phim "{m?.title}" chỉ bắt đầu khởi chiếu từ ngày <b>{m?.release}</b>. Ngày suất chiếu hiện tại ({date}) chưa tới ngày khởi chiếu nên không thể tạo suất. Vui lòng chọn phim khác hoặc đổi ngày chiếu sang sau ngày khởi chiếu.
        </div>
      )}

      {isMovieEnded && (
        <div className="alert err" style={{ marginBottom: 12 }}>
          ⚠️ <b>Phim đã hết hạn chiếu:</b> Phim "{m?.title}" đã kết thúc đợt chiếu vào ngày <b>{m?.end}</b>.
        </div>
      )}

      {formError && (
        <div className="alert err" style={{ marginBottom: 12 }}>
          ✕ {formError}
        </div>
      )}

      {/* Preview */}
      <div>
        {candidates.map(s => {
          const v = validate(s);
          return (
            <div key={s.start} className={`alert ${v.errs.length ? 'err' : v.warns.length ? 'warn' : 'ok'}`}>
              <b>{s.start} → {toT(toMin(s.start) + m.dur + ADS)}</b> {v.errs[0] ? '⛔ ' + v.errs[0] : v.warns[0] ? '⚠️ ' + v.warns[0] : '✓ Hợp lệ'}
            </div>
          );
        })}
      </div>

      <div className="acts">
        <button className="btn" onClick={onClose}>Huỷ</button>
        {onAddDraft && (
          <button
            type="button"
            className="btn"
            disabled={saving || isFormInvalid}
            onClick={handleAddToDraft}
            style={{
              border: '1px dashed #f5b800',
              color: '#f5b800',
              background: 'rgba(245,184,0,0.06)',
              opacity: isFormInvalid ? 0.45 : 1,
              cursor: isFormInvalid ? 'not-allowed' : 'pointer'
            }}
          >
            📝 Lưu vào Bản thảo
          </button>
        )}
        <button
          className="btn primary"
          disabled={saving || isFormInvalid}
          onClick={handleSubmit}
          style={{
            opacity: isFormInvalid ? 0.45 : 1,
            cursor: isFormInvalid ? 'not-allowed' : 'pointer'
          }}
        >
          {saving ? 'Đang gửi API...' : 'Tạo & Lưu ngay'}
        </button>
      </div>
    </div>
  );
}

function CopyModalContent({ date, shows, onClose, onSuccess, getAdminToken, validate }) {
  const [from, setFrom] = useState(date);
  const [to, setTo] = useState(addDays(date, 1));
  const [rep, setRep] = useState(1);
  const [over, setOver] = useState(false);
  const [saving, setSaving] = useState(false);

  const doCopy = async () => {
    const src = shows.filter(s => s.date === from && s.status !== 'cancel');
    if (!src.length) {
      showToast?.('Ngày nguồn không có suất chiếu nào để sao chép', 'warning');
      return;
    }

    const tomorrow = getTomorrowStr();
    if (to < tomorrow) {
      showToast?.('🚫 Quy định: Suất chiếu chỉ được lên lịch trước ít nhất 1 ngày (từ ngày mai trở đi).', 'error');
      return;
    }

    setSaving(true);
    const token = getAdminToken?.();

    for (let i = 0; i < rep; i++) {
      const d = addDays(to, i);
      for (const s of src) {
        const c = { ...s, id: Math.random().toString(36).slice(2, 9), date: d, sold: 0, status: 'plan' };
        if (validate(c).errs.length === 0 && token) {
          try {
            const payload = {
              movieId: Number(c.movieId),
              roomId: Number(c.roomId),
              startTime: `${c.date}T${c.start}:00`,
              basePrice: c.price?.std || DEFAULT_PRICES[c.fmt]?.std || 60000,
              vipPrice: c.price?.vip || DEFAULT_PRICES[c.fmt]?.vip || 90000,
              couplePrice: c.price?.couple || DEFAULT_PRICES[c.fmt]?.couple || 150000,
              status: 'SCHEDULED'
            };
            await adminService.createAdminShowtime(token, payload);
          } catch (err) {
            console.warn('Lỗi copy showtime:', err);
          }
        }
      }
    }

    setSaving(false);
    onSuccess(to);
  };

  return (
    <div className="modal">
      <h3>Sao chép lịch chiếu</h3>
      <p>Sao chép toàn bộ suất của một ngày sang ngày khác (không sao chép vé đã bán). Suất xung đột sẽ bị bỏ qua.</p>

      <div className="row2">
        <div className="field">
          <label>Từ ngày</label>
          <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
        </div>
        <div className="field">
          <label>Đến ngày</label>
          <input type="date" min={getTomorrowStr()} value={to} onChange={(e) => setTo(e.target.value)} />
        </div>
      </div>

      <div className="field">
        <label>Lặp lại</label>
        <select value={rep} onChange={(e) => setRep(Number(e.target.value))}>
          <option value={1}>Chỉ 1 ngày</option>
          <option value={7}>7 ngày liên tiếp</option>
          <option value={14}>14 ngày liên tiếp</option>
        </select>
      </div>

      <label style={{ display: 'flex', gap: '8px', fontSize: '13px', marginBottom: '12px', cursor: 'pointer' }}>
        <input type="checkbox" checked={over} onChange={(e) => setOver(e.target.checked)} />
        Ghi đè (bỏ qua suất nếu gặp xung đột)
      </label>

      <div className="acts">
        <button className="btn" onClick={onClose}>Huỷ</button>
        {to < getTomorrowStr() && (
          <span style={{ fontSize: '11px', color: '#f87171', marginRight: 'auto' }}>
            ⚠️ Ngày đích phải từ {getTomorrowStr()} trở đi
          </span>
        )}
        <button
          className="btn primary"
          disabled={saving || to < getTomorrowStr()}
          onClick={doCopy}
          style={{
            opacity: to < getTomorrowStr() ? 0.45 : 1,
            cursor: to < getTomorrowStr() ? 'not-allowed' : 'pointer'
          }}
        >
          {saving ? 'Đang sao chép...' : 'Sao chép'}
        </button>
      </div>
    </div>
  );
}

function AutoModalContent({ date, rooms, movies, onClose, onSuccess, getAdminToken, validate, M, R }) {
  const [roomId, setRoomId] = useState(rooms.filter(r => r.active)[0]?.id || 1);
  const [start, setStart] = useState('09:00');
  const [selectedMovieIds, setSelectedMovieIds] = useState(new Set(movies.slice(0, 3).map(m => m.id)));
  const [round, setRound] = useState(15);
  const [saving, setSaving] = useState(false);

  const toggle = (id) => {
    setSelectedMovieIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const doAuto = async () => {
    if (date < getTomorrowStr()) {
      showToast?.('🚫 Quy định: Suất chiếu chỉ được lên lịch trước ít nhất 1 ngày (từ ngày mai trở đi).', 'error');
      return;
    }
    const ids = Array.from(selectedMovieIds);
    if (!ids.length) {
      showToast?.('Vui lòng chọn ít nhất 1 phim để tự động xếp lịch', 'warning');
      return;
    }
    const r = R(roomId);
    let t = toMin(start);
    let i = 0, guard = 0;
    const final = [];

    while (guard++ < 40) {
      const m = M(ids[i % ids.length]);
      const fmt = m.formats.includes(r.type) ? r.type : (m.formats.includes('2D') ? '2D' : null);
      if (!fmt) { i++; continue; }

      const c = {
        id: Math.random().toString(36).slice(2, 9),
        date,
        roomId,
        movieId: m.id,
        start: toT(t),
        fmt,
        lang: m.lang,
        sold: 0,
        status: 'plan',
        note: 'Tự động'
      };

      if (t + m.dur + ADS > CLOSE * 60) break;

      if (!validate(c).errs.length) {
        final.push(c);
        t = Math.ceil((t + m.dur + ADS + CLEAN) / round) * round;
      } else {
        t += round;
      }
      i++;
    }

    setSaving(true);
    const token = getAdminToken?.();
    for (const c of final) {
      if (token) {
        try {
          const payload = {
            movieId: Number(c.movieId),
            roomId: Number(c.roomId),
            startTime: `${c.date}T${c.start}:00`,
            basePrice: DEFAULT_PRICES[c.fmt]?.std || 60000,
            vipPrice: DEFAULT_PRICES[c.fmt]?.vip || 90000,
            couplePrice: DEFAULT_PRICES[c.fmt]?.couple || 150000,
            status: 'SCHEDULED'
          };
          await adminService.createAdminShowtime(token, payload);
        } catch (err) {
          console.warn('Lỗi auto create showtime:', err);
        }
      }
    }

    setSaving(false);
    onSuccess();
  };

  return (
    <div className="modal">
      <h3>Xếp lịch tự động</h3>
      <p>Lấp đầy một phòng bằng cách chiếu lặp lại các phim được chọn từ giờ bắt đầu đến giờ đóng cửa, tự chèn {ADS}′ quảng cáo + {CLEAN}′ dọn phòng.</p>

      <div className="row2">
        <div className="field">
          <label>Phòng</label>
          <select value={roomId} onChange={(e) => setRoomId(Number(e.target.value))}>
            {rooms.filter(r => r.active).map(x => (
              <option key={x.id} value={x.id}>{x.name} ({x.type})</option>
            ))}
          </select>
        </div>
        <div className="field">
          <label>Bắt đầu từ</label>
          <input type="time" step="300" value={start} onChange={(e) => setStart(e.target.value)} />
        </div>
      </div>

      <div className="field">
        <label>Phim luân phiên (theo thứ tự)</label>
        <div className="chips">
          {movies.filter(m => m.release <= date && m.end >= date).map(m => (
            <button
              key={m.id}
              type="button"
              className={`chip-btn ${selectedMovieIds.has(m.id) ? 'on' : ''}`}
              onClick={() => toggle(m.id)}
            >
              {m.title} ({m.dur}′)
            </button>
          ))}
        </div>
      </div>

      <div className="field">
        <label>Làm tròn giờ bắt đầu</label>
        <select value={round} onChange={(e) => setRound(Number(e.target.value))}>
          <option value={5}>5 phút</option>
          <option value={15}>15 phút</option>
          <option value={30}>30 phút</option>
        </select>
      </div>

      {date < getTomorrowStr() && (
        <div className="alert err" style={{ marginBottom: 12 }}>
          🚫 <b>Không thể xếp lịch:</b> Ngày đã chọn ({date}) là ngày hiện tại hoặc quá khứ. Tính năng tự động xếp lịch chỉ khả dụng từ ngày {getTomorrowStr()} trở đi.
        </div>
      )}

      <div className="acts">
        <button className="btn" onClick={onClose}>Huỷ</button>
        <button
          className="btn primary"
          disabled={saving || date < getTomorrowStr()}
          onClick={doAuto}
          style={{
            opacity: date < getTomorrowStr() ? 0.45 : 1,
            cursor: date < getTomorrowStr() ? 'not-allowed' : 'pointer'
          }}
        >
          {saving ? 'Đang xếp lịch...' : 'Xếp lịch'}
        </button>
      </div>
    </div>
  );
}


/* ================= PREVIEW PRICES MODAL COMPONENT ================= */

function PreviewPricesModalContent({
  previewData,
  loading,
  draftCount,
  onClose,
  onSaveAll,
  isSaving
}) {
  const formatVnd = (value) => {
    if (value === null || value === undefined || value === '') return '0đ';
    return `${Number(value).toLocaleString('vi-VN')}đ`;
  };

  const hasMissingAudience = previewData.some(p => p.audiencePriceMissing);

  return (
    <div className="modal" style={{ maxWidth: '960px', width: '95vw', maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--line)', paddingBottom: '12px', marginBottom: '14px' }}>
        <div>
          <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 800, color: '#fff', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span>👁️</span>
            <span>Xem Trước Bảng Giá Vé ({draftCount} suất bản thảo)</span>
          </h3>
          <p style={{ margin: '4px 0 0 0', fontSize: '12px', color: 'var(--muted)' }}>
            Ma trận giá vé được Catalog Service tự động tính toán (Giá gốc phòng + Phụ thu đối tượng) trước khi lưu vào CSDL.
          </p>
        </div>
        <button
          onClick={onClose}
          style={{ background: 'transparent', border: 'none', color: 'var(--muted)', fontSize: '18px', cursor: 'pointer', padding: '4px 8px' }}
        >
          ✕
        </button>
      </div>

      <div style={{ overflowY: 'auto', flex: 1, paddingRight: '4px' }}>
        {loading ? (
          <div style={{ padding: '60px', textAlign: 'center', color: 'var(--muted)' }}>
            <div style={{ fontSize: '32px', marginBottom: '12px' }}>🔄</div>
            <div style={{ fontSize: '14px', fontWeight: 700, color: '#fff' }}>Đang tính toán ma trận giá vé từ Catalog Service...</div>
            <p style={{ fontSize: '12px', color: 'var(--muted)', marginTop: '4px' }}>Đang áp dụng phụ thu Trẻ em, Học sinh/Sinh viên và Người lớn theo cụm rạp.</p>
          </div>
        ) : previewData.length === 0 ? (
          <div style={{ padding: '40px', textAlign: 'center', color: 'var(--muted)' }}>
            <p>Không có dữ liệu xem trước.</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {hasMissingAudience && (
              <div style={{ background: 'rgba(245, 184, 0, 0.12)', border: '1px solid rgba(245, 184, 0, 0.35)', padding: '10px 14px', borderRadius: '8px', fontSize: '12px', color: '#f5b800' }}>
                ⚠️ <strong>Cảnh báo:</strong> Cụm rạp chưa cấu hình đầy đủ phụ thu cả 3 nhóm đối tượng (Trẻ em, HSSV, Người lớn). Vui lòng cấu hình tại tab <strong>Quản lý Bảng giá</strong> để giá vé bán ra chính xác nhất.
              </div>
            )}

            {previewData.map((item, idx) => {
              const startStr = item.startTime ? item.startTime.replace('T', ' ').slice(11, 16) : '';
              const endStr = item.endTime ? item.endTime.replace('T', ' ').slice(11, 16) : '';
              const dateStr = item.startTime ? item.startTime.split('T')[0] : '';

              return (
                <div
                  key={idx}
                  style={{
                    background: '#12161c',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    borderRadius: '8px',
                    padding: '16px',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.3)'
                  }}
                >
                  {/* Slot Header */}
                  <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: '8px', borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: '10px', marginBottom: '12px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <span style={{ background: 'var(--primary)', color: '#000', fontWeight: 900, padding: '2px 8px', borderRadius: '4px', fontSize: '11px' }}>
                        #{idx + 1}
                      </span>
                      <strong style={{ fontSize: '15px', color: '#fff' }}>{item.movieTitle}</strong>
                      <span style={{ fontSize: '12px', color: 'var(--muted)' }}>• {item.roomName} ({item.cinemaName})</span>
                    </div>
                    <div style={{ fontSize: '12px', color: '#f5b800', fontWeight: 700 }}>
                      📅 {dateStr} • ⏰ {startStr} – {endStr}
                    </div>
                  </div>

                  {/* Surcharges Summary */}
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', marginBottom: '12px', fontSize: '11.5px', background: 'rgba(255,255,255,0.03)', padding: '8px 12px', borderRadius: '6px' }}>
                    <span style={{ color: 'var(--muted)' }}>Phụ thu rạp áp dụng:</span>
                    <span style={{ color: '#38bdf8' }}>Trẻ em: +{formatVnd(item.childAdditional)}</span>
                    <span style={{ color: '#34d399' }}>HSSV: +{formatVnd(item.studentAdditional)}</span>
                    <span style={{ color: '#fbbf24' }}>Người lớn: +{formatVnd(item.adultAdditional)}</span>
                  </div>

                  {/* Pricing Matrix Table */}
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', textAlign: 'left' }}>
                      <thead>
                        <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.1)', color: 'var(--muted)', fontSize: '11px', textTransform: 'uppercase' }}>
                          <th style={{ padding: '6px 10px' }}>Loại ghế</th>
                          <th style={{ padding: '6px 10px', textAlign: 'right' }}>Giá gốc phòng</th>
                          <th style={{ padding: '6px 10px', textAlign: 'center', color: '#38bdf8' }}>Trẻ Em (CHILD)</th>
                          <th style={{ padding: '6px 10px', textAlign: 'center', color: '#34d399' }}>HSSV (STUDENT)</th>
                          <th style={{ padding: '6px 10px', textAlign: 'center', color: '#fbbf24' }}>Người Lớn (ADULT)</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                          <td style={{ padding: '8px 10px', fontWeight: 700, color: '#fff' }}>Ghế Thường (STANDARD)</td>
                          <td style={{ padding: '8px 10px', textAlign: 'right', color: 'var(--muted)', fontFamily: 'monospace' }}>{formatVnd(item.roomStandardPrice)}</td>
                          <td style={{ padding: '8px 10px', textAlign: 'center', fontWeight: 800, color: '#38bdf8' }}>{formatVnd(item.childStandardPrice)}</td>
                          <td style={{ padding: '8px 10px', textAlign: 'center', fontWeight: 800, color: '#34d399' }}>{formatVnd(item.studentStandardPrice)}</td>
                          <td style={{ padding: '8px 10px', textAlign: 'center', fontWeight: 800, color: '#fbbf24' }}>{formatVnd(item.adultStandardPrice)}</td>
                        </tr>
                        <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                          <td style={{ padding: '8px 10px', fontWeight: 700, color: '#f5b800' }}>Ghế VIP</td>
                          <td style={{ padding: '8px 10px', textAlign: 'right', color: 'var(--muted)', fontFamily: 'monospace' }}>{formatVnd(item.roomVipPrice)}</td>
                          <td style={{ padding: '8px 10px', textAlign: 'center', fontWeight: 800, color: '#38bdf8' }}>{formatVnd(item.childVipPrice)}</td>
                          <td style={{ padding: '8px 10px', textAlign: 'center', fontWeight: 800, color: '#34d399' }}>{formatVnd(item.studentVipPrice)}</td>
                          <td style={{ padding: '8px 10px', textAlign: 'center', fontWeight: 800, color: '#fbbf24' }}>{formatVnd(item.adultVipPrice)}</td>
                        </tr>
                        <tr>
                          <td style={{ padding: '8px 10px', fontWeight: 700, color: '#ec4899' }}>Ghế Đôi (COUPLE - Cặp vé)</td>
                          <td style={{ padding: '8px 10px', textAlign: 'right', color: 'var(--muted)', fontFamily: 'monospace' }}>{formatVnd(item.roomCouplePrice)}</td>
                          <td style={{ padding: '8px 10px', textAlign: 'center', fontWeight: 800, color: '#38bdf8' }}>
                            <div>{formatVnd(item.childChildCouplePrice)}</div>
                            <div style={{ fontSize: '10px', color: 'var(--muted)', fontWeight: 400 }}>2 Trẻ em</div>
                          </td>
                          <td style={{ padding: '8px 10px', textAlign: 'center', fontWeight: 800, color: '#34d399' }}>
                            <div>{formatVnd(item.studentStudentCouplePrice)}</div>
                            <div style={{ fontSize: '10px', color: 'var(--muted)', fontWeight: 400 }}>2 HSSV</div>
                          </td>
                          <td style={{ padding: '8px 10px', textAlign: 'center', fontWeight: 800, color: '#fbbf24' }}>
                            <div>{formatVnd(item.adultAdultCouplePrice)}</div>
                            <div style={{ fontSize: '10px', color: 'var(--muted)', fontWeight: 400 }}>2 Người lớn</div>
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>

                  {item.warnings && item.warnings.length > 0 && (
                    <div style={{ marginTop: '10px', padding: '6px 10px', background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.25)', borderRadius: '4px', fontSize: '11px', color: '#fca5a5' }}>
                      {item.warnings.map((w, wi) => (
                        <div key={wi}>⚠️ {w}</div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Modal Footer Actions */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '10px', borderTop: '1px solid var(--line)', paddingTop: '14px', marginTop: '14px' }}>
        <button
          type="button"
          className="btn"
          onClick={onClose}
        >
          Đóng
        </button>
        <button
          type="button"
          className="btn primary"
          onClick={onSaveAll}
          disabled={isSaving || previewData.length === 0}
          style={{ padding: '8px 20px', fontWeight: 800 }}
        >
          {isSaving ? 'Đang lưu vào hệ thống...' : `💾 Xác nhận & Lưu tất cả (${draftCount} suất)`}
        </button>
      </div>
    </div>
  );
}
