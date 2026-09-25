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

export default function AdminShowtimesPanel({ ctx }) {
  const { getAdminToken, showToast, moviesList } = ctx || {};
  const getTokenRef = useRef(getAdminToken);
  useEffect(() => { getTokenRef.current = getAdminToken; }, [getAdminToken]);

  /* State */
  const [date, setDate] = useState(todayStr());
  const [view, setView] = useState('day'); // 'day' | 'week'
  const [rooms, setRooms] = useState([]);
  const [adminMovies, setAdminMovies] = useState([]);
  const [shows, setShows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selId, setSelId] = useState(null);
  const [selMovie, setSelMovie] = useState(null);
  const [tabIdx, setTabIdx] = useState(0); // 0: detail, 1: overview, 2: warnings
  const [searchQuery, setSearchQuery] = useState('');
  const [dragGhost, setDragGhost] = useState(null);
  const [draggingShowId, setDraggingShowId] = useState(null);
  const [movieFilter, setMovieFilter] = useState('NOW_SHOWING'); // 'NOW_SHOWING' | 'UPCOMING' | 'ALL'
  const [loadingMovies, setLoadingMovies] = useState(false);

  /* Modals */
  const [addModal, setAddModal] = useState(null);
  const [copyModal, setCopyModal] = useState(false);
  const [autoModal, setAutoModal] = useState(false);

  /* Timeline Scroll */
  const tlWrapRef = useRef(null);
  const scrolledOnceRef = useRef(false);

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

  /* ================= FETCH ROOMS TỪ BE ================= */
  const fetchRooms = useCallback(async () => {
    try {
      const token = getTokenRef.current?.();
      let list = [];
      if (token) {
        try {
          const res = await adminService.getAdminRooms(token);
          list = Array.isArray(res) ? res : (res?.content || res?.items || []);
        } catch (e) {
          console.warn('Lỗi getAdminRooms:', e);
        }
      }
      if (list && list.length > 0) {
        const formatted = list.map((r, i) => ({
          id: r.id || r.roomId,
          name: r.name || `Phòng ${pad(i + 1)}`,
          type: r.type || r.roomType || '2D',
          seats: r.totalSeats || r.seatCount || 80,
          active: r.active !== false && r.status !== 'INACTIVE',
          price: r.price || DEFAULT_PRICES[r.type || '2D'] || DEFAULT_PRICES['2D']
        }));
        setRooms(formatted);
      }
    } catch (err) {
      console.warn('Lỗi lấy danh sách phòng:', err);
    }
  }, []);

  useEffect(() => {
    fetchMovies();
    fetchRooms();
  }, [fetchMovies, fetchRooms]);

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
  const fetchShowtimes = useCallback(async (targetDate = date) => {
    const token = getTokenRef.current?.();
    if (!token) return;

    setLoading(true);
    try {
      // Gọi API lấy danh sách suất chiếu (hỗ trợ phân trang và filter)
      // Gọi 2 query: lấy tất cả suất chiếu gần đây (size: 100) và lấy suất chiếu ngày đang chọn (nếu có)
      const resAll = await adminService.getAdminShowtimes(token, { page: 0, size: 100 });
      let itemsAll = Array.isArray(resAll) ? resAll : (resAll?.content || resAll?.items || resAll?.data?.content || []);

      // Nếu targetDate được chỉ định, gọi thêm query theo date để đảm bảo không bị miss
      let itemsDate = [];
      if (targetDate) {
        try {
          const resDate = await adminService.getAdminShowtimes(token, { date: targetDate, page: 0, size: 100 });
          itemsDate = Array.isArray(resDate) ? resDate : (resDate?.content || resDate?.items || resDate?.data?.content || []);
        } catch { /* ignore */ }
      }

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

      // Tự động bổ sung phòng từ suất chiếu nếu phòng đó chưa có trong `rooms`
      combinedItems.forEach(item => {
        const rid = Number(item.roomId || item.room?.id);
        const rname = item.roomName || item.room?.name;
        if (rid && rname) {
          setRooms(prevRooms => {
            if (!prevRooms.some(r => Number(r.id) === rid)) {
              return [...prevRooms, {
                id: rid,
                name: rname,
                type: item.roomType || '2D',
                seats: 80,
                active: true,
                price: DEFAULT_PRICES['2D']
              }];
            }
            return prevRooms;
          });
        }
      });
    } catch (err) {
      console.warn('Lỗi gọi API getAdminShowtimes:', err);
      showToast?.('Không thể tải lịch chiếu từ server: ' + err.message, 'error');
    } finally {
      setLoading(false);
    }
  }, [date, movies, showToast]);

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

  const dayShows = useCallback((d = date) => {
    return shows.filter(s => s.date === d);
  }, [shows, date]);

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
    const next = selMovie === id ? null : id;
    setSelMovie(next);
    if (next) showToast?.('Đã chọn phim – click vào khoảng trống trên dòng phòng để đặt suất', 'info');
  };

  const quickAdd = async (roomId, movieId, start) => {
    const m = M(movieId);
    const r = R(roomId);
    const fmt = m.formats.includes(r.type) ? r.type : (m.formats.includes('2D') ? '2D' : m.formats[0]);
    const candidate = {
      id: Math.random().toString(36).slice(2, 9),
      date,
      roomId,
      movieId,
      start,
      fmt,
      lang: m.lang,
      sold: 0,
      status: 'plan',
      note: ''
    };
    const v = validate(candidate);
    if (v.errs.length) {
      setAddModal({ roomId, movieId, start, date });
      showToast?.('⚠ ' + v.errs[0], 'warning');
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
        showToast?.(`✓ Đã tạo suất chiếu ${m.title} lúc ${start}`, 'success');
        fetchShowtimes(date);
      } catch (err) {
        showToast?.('Lỗi tạo suất chiếu: ' + err.message, 'error');
        return;
      }
    }
    setShows(prev => [...prev, candidate]);
    setSelId(candidate.id);
  };

  const handleUpdate = async (key, val) => {
    const s = shows.find(x => String(x.id) === String(selId));
    if (!s) return;
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

    const token = getTokenRef.current?.();
    if (token && s.id && !isNaN(Number(s.id))) {
      try {
        const statusMap = { 'open': 'OPEN', 'plan': 'SCHEDULED', 'cancel': 'CANCELLED', 'done': 'COMPLETED' };
        const payload = {
          movieId: Number(cand.movieId),
          roomId: Number(cand.roomId),
          startTime: `${cand.date}T${cand.start}:00`,
          status: statusMap[cand.status] || 'SCHEDULED'
        };
        await adminService.updateAdminShowtime(token, s.id, payload);
        showToast?.('Đã cập nhật suất chiếu thành công', 'success');
        fetchShowtimes(date);
      } catch (err) {
        console.warn('Lỗi update showtime:', err);
      }
    }

    setShows(prev => prev.map(x => String(x.id) === String(selId) ? cand : x));
    if (key === 'date') setDate(val);
  };

  const handleDelete = async () => {
    const s = shows.find(x => String(x.id) === String(selId));
    if (!s) return;
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

  const handleNextSlot = () => {
    const s = shows.find(x => String(x.id) === String(selId));
    if (!s) return;
    const start = toT(Math.ceil((endOf(s) + CLEAN) / 5) * 5);
    quickAdd(s.roomId, s.movieId, start);
  };

  const handleExportJSON = () => {
    const data = shows.map(s => ({
      ...s,
      end: toT(endOf(s)),
      movie: M(s.movieId).title,
      room: R(s.roomId).name
    }));
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }));
    a.download = `lich-chieu-${date}.json`;
    a.click();
    showToast?.('Đã xuất JSON', 'success');
  };

  /* Filtered Movies (Hỗ trợ lọc Phim đang chiếu từ BE) */
  const filteredMovies = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    return movies.filter(m => {
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
          height: 56px;
          background: #0d1117;
          border-bottom: 1px solid var(--line);
          display: flex;
          align-items: center;
          padding: 0 20px;
          gap: 12px;
          flex-shrink: 0;
        }
        .cinema-schedule-dark .logo {
          display: flex;
          align-items: center;
          gap: 10px;
          font-weight: 700;
          font-size: 15px;
        }
        .cinema-schedule-dark .logo i {
          width: 32px;
          height: 32px;
          border-radius: 10px;
          background: linear-gradient(135deg, #f5b800, #b45309);
          display: grid;
          place-items: center;
          color: #000;
          font-style: normal;
          font-size: 16px;
        }
        .cinema-schedule-dark .nav {
          display: flex;
          align-items: center;
          gap: 6px;
          margin-left: 10px;
        }
        .cinema-schedule-dark .nav .btn { padding: 6px 10px; }
        .cinema-schedule-dark .datebox {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 6px 12px;
          border: 1px solid var(--line);
          border-radius: 10px;
          background: #161b22;
          font-weight: 600;
        }
        .cinema-schedule-dark .datebox input {
          border: none;
          outline: none;
          font-weight: 600;
          background: transparent;
          color: #fff;
          cursor: pointer;
        }
        .cinema-schedule-dark .datebox small { color: var(--muted); font-weight: 500; }
        .cinema-schedule-dark .seg {
          display: flex;
          border: 1px solid var(--line);
          border-radius: 10px;
          overflow: hidden;
          background: #161b22;
        }
        .cinema-schedule-dark .seg button {
          padding: 7px 14px;
          font-weight: 600;
          font-size: 13px;
          color: var(--muted);
          transition: .15s;
        }
        .cinema-schedule-dark .seg button.on {
          background: var(--primary);
          color: #000;
        }
        .cinema-schedule-dark .spacer { flex: 1; }
        .cinema-schedule-dark .btn {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 8px 14px;
          border-radius: 10px;
          font-weight: 600;
          font-size: 13px;
          border: 1px solid var(--line);
          background: #161b22;
          color: #f0f6fc;
          transition: .15s;
          white-space: nowrap;
        }
        .cinema-schedule-dark .btn:hover { background: #21262d; border-color: #30363d; }
        .cinema-schedule-dark .btn.primary {
          background: var(--primary);
          color: #000;
          border-color: var(--primary);
          font-weight: 700;
        }
        .cinema-schedule-dark .btn.primary:hover { background: #e5a700; }
        .cinema-schedule-dark .btn.danger { color: var(--danger); }
        .cinema-schedule-dark .btn.danger:hover { background: rgba(220, 38, 38, 0.15); border-color: rgba(220, 38, 38, 0.3); }
        .cinema-schedule-dark .btn.sm { padding: 5px 10px; font-size: 12px; border-radius: 8px; }
        .cinema-schedule-dark .btn:disabled { opacity: .45; cursor: not-allowed; }

        /* Main 3 columns layout (cột phải mở rộng 345px để không bị thanh cuộn ngang) */
        .cinema-schedule-dark main {
          flex: 1;
          display: grid;
          grid-template-columns: 260px 1fr 345px;
          gap: 14px;
          padding: 14px;
          min-height: 0;
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
        <div className="logo">
          <i>🎬</i>
          CinemaAdmin
          <span style={{ color: 'var(--muted)', fontWeight: 500, fontSize: '13px', marginLeft: '6px' }}>
            / Lịch chiếu
          </span>
        </div>

        <div className="nav">
          <button className="btn" onClick={() => shiftDay(-1)}>‹</button>
          <div className="datebox">
            <input type="date" value={date} onChange={(e) => { setDate(e.target.value); setSelId(null); }} />
            <small>
              {DOW[new Date(date + 'T00:00:00').getDay()]}
              {date === todayStr() ? ' • Hôm nay' : ''}
            </small>
          </div>
          <button className="btn" onClick={() => shiftDay(1)}>›</button>
          <button className="btn sm" onClick={() => { setDate(todayStr()); setSelId(null); }}>Hôm nay</button>
          <button
            className="btn sm"
            onClick={() => fetchShowtimes(date)}
            title="Làm mới từ máy chủ"
            style={{ marginLeft: '4px', color: loading ? 'var(--primary)' : 'inherit' }}
          >
            ↻ {loading ? 'Đang tải...' : 'Làm mới'}
          </button>
        </div>

        <div className="seg">
          <button className={view === 'day' ? 'on' : ''} onClick={() => setView('day')}>Ngày</button>
          <button className={view === 'week' ? 'on' : ''} onClick={() => setView('week')}>Tuần</button>
        </div>

        <div className="spacer" />

        <button className="btn" onClick={() => setCopyModal(true)}>⧉ Sao chép lịch</button>
        <button className="btn" onClick={() => setAutoModal(true)}>✨ Xếp tự động</button>
        <button className="btn" onClick={handleExportJSON}>⬇ Xuất</button>
        <button className="btn primary" onClick={() => setAddModal({ date })}>＋ Thêm suất chiếu</button>
      </header>

      {/* ── MAIN 3 COLUMNS ── */}
      <main>
        {/* LEFT: movies */}
        <section className="card">
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
                const soon = m.status === 'UPCOMING' || m.release > date;
                const isSel = selMovie === m.id;

                return (
                  <div
                    key={m.id}
                    className={`movie ${isSel ? 'sel' : ''}`}
                    draggable
                    onDragStart={(e) => {
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
                    onClick={() => pickMovie(m.id)}
                    style={{ opacity: soon ? 0.6 : 1 }}
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
                        {soon ? `Khởi chiếu ${m.release.split('-').reverse().join('/')}` : `${n} suất hôm nay`}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="drag-hint">Kéo phim thả vào dòng phòng để tạo suất chiếu nhanh</div>
          </div>
        </section>

        {/* CENTER: timeline or week */}
        <section className="card">
          <div ref={tlWrapRef} className="tl-wrap">
            {view === 'day' ? (
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
                            quickAdd(r.id, Number(mid), start);
                          } else if (sid) {
                            const curShow = shows.find(x => String(x.id) === String(sid));
                            if (curShow) {
                              const cand = { ...curShow, roomId: r.id, start };
                              const val = validate(cand, curShow.id);
                              if (val.errs.length) return showToast?.('✕ ' + val.errs[0], 'error');
                              setShows(prev => prev.map(x => String(x.id) === String(sid) ? cand : x));
                              setSelId(curShow.id);
                              showToast?.('Đã di chuyển suất chiếu', 'success');
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
                              }}
                              className={`blk ${isSel ? 'sel' : ''} ${v.errs.length ? 'conflict' : ''} ${s.status === 'cancel' ? 'cancel' : ''}`}
                              style={{
                                left: `${left}px`,
                                width: `${wd + cw}px`,
                                background: m.color,
                                opacity: draggingShowId === s.id ? 0.35 : 1,
                                transition: 'opacity 0.15s ease'
                              }}
                              title={`${m.title} • ${s.start}–${toT(st + dur)} • ${s.sold}/${r.seats} vé`}
                            >
                              <b>{m.title}</b>
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

        {/* RIGHT: tabs */}
        <section className="card right">
          <div className="tabs">
            <button className={tabIdx === 0 ? 'on' : ''} onClick={() => setTabIdx(0)}>Chi tiết suất</button>
            <button className={tabIdx === 1 ? 'on' : ''} onClick={() => setTabIdx(1)}>Tổng quan ngày</button>
            <button className={tabIdx === 2 ? 'on' : ''} onClick={() => setTabIdx(2)}>
              Cảnh báo {allConflicts.length > 0 && <span style={{ background: 'var(--danger)', color: '#fff', borderRadius: '99px', padding: '0 6px', fontSize: '11px', marginLeft: '4px' }}>{allConflicts.length}</span>}
            </button>
          </div>

          <div className="card-b">
            {/* TAB 0 */}
            {tabIdx === 0 && (() => {
              const s = shows.find(x => String(x.id) === String(selId));
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
                  <div style={{ display: 'flex', gap: '10px', marginBottom: '12px' }}>
                    <div className="poster" style={{ background: m.color, width: '44px', height: '60px' }}>
                      {m.title.charAt(0)}
                    </div>
                    <div>
                      <b style={{ fontSize: '14px', color: '#fff' }}>{m.title}</b>
                      <div style={{ fontSize: '12px', color: 'var(--muted)', marginTop: '3px' }}>
                        {m.dur} phút • {m.age} • {m.formats.join('/')}
                      </div>
                      <span className={`status st-${s.status}`} style={{ marginTop: '6px' }}>
                        {stMap[s.status]}
                      </span>
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
                    <select value={s.movieId} onChange={(e) => handleUpdate('movieId', Number(e.target.value))}>
                      {movies.map(x => (
                        <option key={x.id} value={x.id}>{x.title}</option>
                      ))}
                    </select>
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
                      <label>Bắt đầu</label>
                      <input type="time" step="300" value={s.start} onChange={(e) => handleUpdate('start', e.target.value)} />
                    </div>
                    <div className="field">
                      <label>Kết thúc</label>
                      <input value={end} disabled style={{ background: '#1c2128', color: 'var(--muted)' }} />
                    </div>
                    <div className="field">
                      <label>Trống tới</label>
                      <input value={toT(endOf(s) + CLEAN)} disabled style={{ background: '#1c2128', color: 'var(--muted)' }} />
                    </div>
                  </div>

                  <div className="row2">
                    <div className="field">
                      <label>Định dạng</label>
                      <select value={s.fmt} onChange={(e) => handleUpdate('fmt', e.target.value)}>
                        {['2D', '3D', 'IMAX', '4DX'].map(f => (
                          <option key={f} value={f}>{f}</option>
                        ))}
                      </select>
                    </div>
                    <div className="field">
                      <label>Ngôn ngữ</label>
                      <select value={s.lang} onChange={(e) => handleUpdate('lang', e.target.value)}>
                        {['Phụ đề', 'Lồng tiếng', 'Tiếng Việt'].map(f => (
                          <option key={f} value={f}>{f}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="field">
                    <label>Trạng thái</label>
                    <select value={s.status} onChange={(e) => handleUpdate('status', e.target.value)}>
                      {Object.entries(stMap).map(([k, vv]) => (
                        <option key={k} value={k}>{vv}</option>
                      ))}
                    </select>
                  </div>

                  <div className="field">
                    <label>Ghi chú</label>
                    <input value={s.note || ''} placeholder="VD: suất chiếu sớm, ưu đãi thành viên..." onChange={(e) => handleUpdate('note', e.target.value)} />
                  </div>

                  <div className="kv">
                    <span>Vé đã bán</span>
                    <b>{s.sold}/{r.seats} ({pct}%)</b>
                  </div>
                  <div className="occ"><i style={{ width: `${pct}%` }} /></div>

                  <div className="kv" style={{ marginTop: '8px' }}>
                    <span>Giá vé (thường / VIP)</span>
                    <b>{fmtVN(prices.std)} / {fmtVN(prices.vip)} đ</b>
                  </div>
                  <div className="kv">
                    <span>Doanh thu ước tính</span>
                    <b>{fmtVN(s.sold * prices.std)} đ</b>
                  </div>
                  <div className="kv">
                    <span>Gồm quảng cáo / dọn phòng</span>
                    <b style={{ color: '#fff' }}>{ADS}′ / {CLEAN}′</b>
                  </div>

                  <div style={{ display: 'flex', gap: '6px', marginTop: '14px' }}>
                    <button
                      className="btn"
                      style={{ flex: 1, justifyContent: 'center', padding: '8px 6px', fontSize: '12px' }}
                      onClick={() => setAddModal({ roomId: s.roomId, movieId: s.movieId, date: s.date })}
                    >
                      ⧉ Nhân bản…
                    </button>
                    <button
                      className="btn"
                      style={{ flex: 1, justifyContent: 'center', padding: '8px 6px', fontSize: '12px' }}
                      onClick={handleNextSlot}
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
                      onClick={() => { setSelId(x.s.id); setTabIdx(0); }}
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
      </main>

      {/* ── MODALS ── */}
      {addModal && (
        <div className="modal-bg" onClick={(e) => { if (e.target.classList.contains('modal-bg')) setAddModal(null); }}>
          <AddModalContent
            params={addModal}
            movies={movies}
            rooms={rooms}
            onClose={() => setAddModal(null)}
            onSuccess={() => {
              setAddModal(null);
              showToast?.('✓ Đã tạo suất chiếu thành công', 'success');
              fetchShowtimes(date);
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

      {autoModal && (
        <div className="modal-bg" onClick={(e) => { if (e.target.classList.contains('modal-bg')) setAutoModal(false); }}>
          <AutoModalContent
            date={date}
            rooms={rooms}
            movies={movies}
            onClose={() => setAutoModal(false)}
            onSuccess={() => {
              setAutoModal(false);
              showToast?.('✓ Đã xếp lịch tự động thành công', 'success');
              fetchShowtimes(date);
            }}
            getAdminToken={getAdminToken}
            validate={validate}
            M={M}
            R={R}
          />
        </div>
      )}
    </div>
  );
}

/* ================= SUB-MODAL COMPONENTS ================= */

function AddModalContent({ params, movies, rooms, onClose, onSuccess, getAdminToken, validate, M, R, endOf }) {
  const [movieId, setMovieId] = useState(params.movieId || movies[0]?.id || 1);
  const [roomId, setRoomId] = useState(params.roomId || rooms[0]?.id || 1);
  const [date, setDate] = useState(params.date || todayStr());
  const [times, setTimes] = useState(new Set(params.start ? [params.start] : ['09:00', '13:30', '18:00']));
  const [customTime, setCustomTime] = useState('09:00');
  const [fmt, setFmt] = useState('2D');
  const [lang, setLang] = useState('Phụ đề');
  const [saving, setSaving] = useState(false);

  const m = M(movieId);
  const r = R(roomId);

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

  const handleSubmit = async () => {
    if (candidates.length === 0) return alert('Chọn ít nhất một giờ bắt đầu');
    const ok = candidates.filter(s => validate(s).errs.length === 0);
    if (ok.length === 0) return alert('✕ Không có suất nào hợp lệ (bị xung đột giờ hoặc phòng)');

    setSaving(true);
    const token = getAdminToken?.();

    let createdCount = 0;
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
          console.warn('Lỗi API create showtime:', err);
        }
      }
    }

    setSaving(false);
    onSuccess();
  };

  return (
    <div className="modal">
      <h3>Thêm suất chiếu</h3>
      <p>Giờ kết thúc tự tính = bắt đầu + thời lượng + {ADS}′ quảng cáo. Có thể tạo nhiều suất một lần.</p>

      <div className="field">
        <label>Phim</label>
        <select value={movieId} onChange={(e) => setMovieId(Number(e.target.value))}>
          {movies.map(x => (
            <option key={x.id} value={x.id}>{x.title} ({x.dur}′)</option>
          ))}
        </select>
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
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
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
        <button className="btn primary" disabled={saving} onClick={handleSubmit}>
          {saving ? 'Đang gửi API...' : 'Tạo suất chiếu'}
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
    if (!src.length) return alert('Ngày nguồn không có suất');

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
          <input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
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
        <button className="btn primary" disabled={saving} onClick={doCopy}>
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
    const ids = Array.from(selectedMovieIds);
    if (!ids.length) return alert('Chọn ít nhất 1 phim');
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

      <div className="acts">
        <button className="btn" onClick={onClose}>Huỷ</button>
        <button className="btn primary" disabled={saving} onClick={doAuto}>
          {saving ? 'Đang xếp lịch...' : 'Xếp lịch'}
        </button>
      </div>
    </div>
  );
}
