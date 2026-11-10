import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import {
  Plus, Trash2, Edit3, Eye, Play, Pause, Copy, Archive, Sparkles,
  Film, Layers, ChevronRight, ChevronLeft, Image as ImageIcon, Monitor, Smartphone,
  AlertTriangle, RefreshCw, Sliders, X, Search, Clock, Calendar,
  Ticket, Tag, ChevronDown, Check, Info, Pin
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { heroBannerService } from '../../../services/heroBannerService';
import { adminService } from '../../../services/adminService';
import { movieService } from '../../../services/movieService';
import HeroBannerCarousel from '../../../components/common/HeroBannerCarousel';

// 3 types exclusively for Create/Edit Wizard (Sections 1 & 2)
const CREATE_BANNER_TYPES = [
  {
    value: 'MOVIE',
    label: 'PHIM ĐIỆN ẢNH',
    subtitle: 'Liên kết với phim',
    icon: Film,
    color: 'border-amber-400 bg-amber-500/10 text-amber-300'
  },
  {
    value: 'FNB',
    label: 'BẮP NƯỚC & F&B',
    subtitle: 'Liên kết sản phẩm / combo',
    icon: Sparkles,
    color: 'border-amber-400 bg-amber-500/10 text-amber-300'
  },
  {
    value: 'CUSTOM',
    label: 'BANNER TÙY CHỈNH',
    subtitle: 'Tự upload hình ảnh và cấu hình nội dung',
    icon: Layers,
    color: 'border-amber-400 bg-amber-500/10 text-amber-300'
  }
];


const HIGHLIGHT_BADGE_OPTIONS = [
  'Không có',
  'Đang chiếu',
  'Phim mới',
  'Phim hot',
  'Sắp chiếu',
  'Đề xuất',
  'Tùy chỉnh...'
];

const CTA_TYPES = [
  { value: 'BOOK_NOW', label: 'ĐẶT VÉ NGAY' },
  { value: 'VIEW_MOVIE', label: 'CHI TIẾT PHIM' },
  { value: 'VIEW_PROMOTION', label: 'XEM ƯU ĐÃI' },
  { value: 'VIEW_FNB', label: 'ĐẶT BẮP NƯỚC' },
  { value: 'VIEW_EVENT', label: 'XEM SỰ KIỆN' },
  { value: 'MEMBERSHIP', label: 'HỘI VIÊN' },
  { value: 'INTERNAL_URL', label: 'ĐƯỜNG DẪN NỘI BỘ' },
  { value: 'EXTERNAL_URL', label: 'LIÊN KẾT NGOÀI (HTTP/HTTPS)' },
  { value: 'NONE', label: 'KHÔNG CÓ NÚT' }
];

const FOCAL_POINTS = [
  { value: 'LEFT', label: 'Canh trái (Left)' },
  { value: 'CENTER', label: 'Chính giữa (Center)' },
  { value: 'RIGHT', label: 'Canh phải (Right)' }
];

const SCOPE_TYPES = [
  { value: 'GLOBAL', label: 'Toàn hệ thống (Global)' },
  { value: 'CITY', label: 'Theo Tỉnh/Thành phố (City)' },
  { value: 'CINEMA', label: 'Theo Cụm rạp chỉ định (Cinema)' }
];

// ─── POPUP CALENDAR & 24H TIME PICKER (HÔM NAY TRỞ ĐI, CHUẨN 24H) ─────────────
const DAYS_OF_WEEK = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'];
const HOURS_24 = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0'));
const MINUTES_60 = Array.from({ length: 60 }, (_, i) => String(i).padStart(2, '0'));

function CalendarDateTimePicker({
  value,
  onChange,
  label,
  helperText,
  isEnd = false,
  minDateStr = null
}) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef(null);
  const popupRef = useRef(null);

  // Parse current value
  const parsed = useMemo(() => {
    if (!value) return { dateStr: '', hour: isEnd ? '23' : '00', minute: isEnd ? '59' : '00' };
    try {
      const [dPart, tPart] = value.split('T');
      const [h, min] = (tPart || '').split(':');
      return {
        dateStr: dPart || '',
        hour: h ? h.padStart(2, '0') : (isEnd ? '23' : '00'),
        minute: min ? min.padStart(2, '0') : (isEnd ? '59' : '00')
      };
    } catch {
      return { dateStr: '', hour: isEnd ? '23' : '00', minute: isEnd ? '59' : '00' };
    }
  }, [value, isEnd]);

  // Today in local YYYY-MM-DD
  const todayStr = useMemo(() => {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }, []);

  // Effective minDate: chỉ cho chọn từ ngày hôm nay trở đi (hoặc từ minDateStr nếu minDateStr > hôm nay)
  const effectiveMin = useMemo(() => {
    if (isEnd && minDateStr && minDateStr > todayStr) {
      return minDateStr;
    }
    return todayStr;
  }, [isEnd, minDateStr, todayStr]);

  // Calendar month view state
  const [viewDate, setViewDate] = useState(() => {
    if (value) {
      const [dPart] = value.split('T');
      const [y, m] = (dPart || '').split('-');
      if (y && m) return new Date(Number(y), Number(m) - 1, 1);
    }
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });

  // Keep viewDate in sync when value changes
  useEffect(() => {
    if (value) {
      const [dPart] = value.split('T');
      const [y, m] = (dPart || '').split('-');
      if (y && m) {
        setViewDate(new Date(Number(y), Number(m) - 1, 1));
      }
    }
  }, [value]);

  // Outside click close: ignores clicks inside popupRef or containerRef
  useEffect(() => {
    function handleClickOutside(e) {
      if (popupRef.current && popupRef.current.contains(e.target)) {
        return;
      }
      if (containerRef.current && containerRef.current.contains(e.target)) {
        return;
      }
      setIsOpen(false);
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const viewYear = viewDate.getFullYear();
  const viewMonth = viewDate.getMonth(); // 0 to 11

  const handlePrevMonth = () => {
    setViewDate(new Date(viewYear, viewMonth - 1, 1));
  };

  const handleNextMonth = () => {
    setViewDate(new Date(viewYear, viewMonth + 1, 1));
  };

  // Days in month & start day offset (Mon=0, Sun=6)
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const firstDayOfWeek = (new Date(viewYear, viewMonth, 1).getDay() + 6) % 7;

  // Can navigate to previous month?
  const isPrevMonthDisabled = useMemo(() => {
    if (!effectiveMin) return false;
    const prevMonthEnd = new Date(viewYear, viewMonth, 0);
    const py = prevMonthEnd.getFullYear();
    const pm = String(prevMonthEnd.getMonth() + 1).padStart(2, '0');
    const pd = String(prevMonthEnd.getDate()).padStart(2, '0');
    return `${py}-${pm}-${pd}` < effectiveMin;
  }, [viewYear, viewMonth, effectiveMin]);

  const handleSelectDay = (dayNum) => {
    const selectedD = String(dayNum).padStart(2, '0');
    const selectedM = String(viewMonth + 1).padStart(2, '0');
    const selectedY = String(viewYear);
    const newDateStr = `${selectedY}-${selectedM}-${selectedD}`;

    const h = parsed.hour || (isEnd ? '23' : '00');
    const min = parsed.minute || (isEnd ? '59' : '00');

    onChange(`${newDateStr}T${h}:${min}`);
  };

  const handleTimeChange = (type, val) => {
    const curDate = parsed.dateStr || todayStr;
    const h = type === 'hour' ? val : parsed.hour;
    const min = type === 'minute' ? val : parsed.minute;
    onChange(`${curDate}T${h}:${min}`);
  };

  // Set to Today
  const handleSetToday = () => {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    const h = parsed.hour || (isEnd ? '23' : '00');
    const min = parsed.minute || (isEnd ? '59' : '00');
    onChange(`${y}-${m}-${d}T${h}:${min}`);
    setViewDate(new Date(y, now.getMonth(), 1));
  };

  // Formatted display in button
  const formattedDisplay = useMemo(() => {
    if (!value) return null;
    try {
      const [dPart, tPart] = value.split('T');
      const [y, m, d] = (dPart || '').split('-');
      return `${tPart || '00:00'} • Ngày ${d}/${m}/${y}`;
    } catch {
      return value;
    }
  }, [value]);

  return (
    <div className="relative space-y-1.5" ref={containerRef}>
      <div className="flex items-center justify-between gap-1">
        <label className="text-[10px] font-mono uppercase text-neutral-300 font-bold flex items-center gap-1.5">
          <span>{label}</span>
          <span className="text-[9px] text-neutral-500 font-normal">{helperText}</span>
        </label>
        {value && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onChange('');
            }}
            className="text-[9.5px] font-mono text-rose-400 hover:text-rose-300 hover:underline cursor-pointer"
          >
            ✕ Xóa
          </button>
        )}
      </div>

      {/* Trigger Button: Click to open calendar popup */}
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className={`w-full px-3 py-2 bg-black border text-left flex items-center justify-between transition cursor-pointer ${
          value
            ? 'border-amber-400/50 bg-amber-500/5 hover:border-amber-400'
            : 'border-white/15 hover:border-white/30'
        }`}
      >
        <div className="flex items-center gap-2 min-w-0">
          <Calendar className={`h-4 w-4 shrink-0 ${value ? 'text-amber-400' : 'text-neutral-500'}`} />
          {formattedDisplay ? (
            <span className="text-xs font-mono font-bold text-amber-300 truncate">
              {formattedDisplay}
            </span>
          ) : (
            <span className="text-xs text-neutral-500 truncate font-mono">
              {isEnd ? 'Trống (Không giới hạn)' : 'Trống (Ngay khi xuất bản)'}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1 shrink-0 ml-1">
          <ChevronDown className="h-3.5 w-3.5 text-neutral-400" />
        </div>
      </button>

      {/* Popup Modal Lịch Trực Quan (Tâm màn hình, không đè layout) */}
      {isOpen && typeof document !== 'undefined' && createPortal(
        <div
          className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs select-none"
          onClick={(e) => {
            if (e.target === e.currentTarget) setIsOpen(false);
          }}
        >
          <div
            ref={popupRef}
            className="w-full max-w-[340px] bg-neutral-950 border border-amber-400/50 shadow-[0_20px_60px_rgba(0,0,0,0.95)] text-white p-4 relative"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header Popup */}
            <div className="flex items-center justify-between pb-3 border-b border-white/10 mb-3">
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-amber-400" />
                <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-amber-300">
                  {label}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="text-neutral-400 hover:text-white p-1 hover:bg-white/10 transition cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Calendar Header: Month/Year navigation */}
            <div className="flex items-center justify-between pb-2 mb-2 border-b border-white/10">
              <button
                type="button"
                disabled={isPrevMonthDisabled}
                onClick={handlePrevMonth}
                className={`p-1.5 border border-white/15 hover:border-amber-400 transition ${
                  isPrevMonthDisabled ? 'opacity-25 cursor-not-allowed' : 'hover:bg-amber-400/10 text-white cursor-pointer'
                }`}
                title="Tháng trước"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>

              <span className="text-xs font-mono font-bold uppercase tracking-wider text-amber-300">
                Tháng {viewMonth + 1}, {viewYear}
              </span>

              <button
                type="button"
                onClick={handleNextMonth}
                className="p-1.5 border border-white/15 hover:border-amber-400 hover:bg-amber-400/10 text-white transition cursor-pointer"
                title="Tháng sau"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>

            {/* Days of Week Header */}
            <div className="grid grid-cols-7 gap-1 text-center mb-1">
              {DAYS_OF_WEEK.map((d, idx) => (
                <span
                  key={d}
                  className={`text-[10px] font-mono font-bold py-1 ${
                    idx >= 5 ? 'text-amber-400/80' : 'text-neutral-400'
                  }`}
                >
                  {d}
                </span>
              ))}
            </div>

            {/* Month Days Grid */}
            <div className="grid grid-cols-7 gap-1 text-center">
              {/* Empty padding before day 1 */}
              {Array.from({ length: firstDayOfWeek }).map((_, i) => (
                <span key={`empty-${i}`} className="h-8 w-full" />
              ))}

              {/* Day buttons */}
              {Array.from({ length: daysInMonth }, (_, i) => {
                const dayNum = i + 1;
                const dStr = `${viewYear}-${String(viewMonth + 1).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;
                const isDisabled = effectiveMin ? dStr < effectiveMin : false;
                const isSelected = parsed.dateStr === dStr;
                const isCurrentDay = dStr === todayStr;

                return (
                  <button
                    key={dayNum}
                    type="button"
                    disabled={isDisabled}
                    onClick={() => handleSelectDay(dayNum)}
                    className={`h-8 w-full text-xs font-mono transition flex items-center justify-center rounded-none ${
                      isDisabled
                        ? 'text-neutral-600 cursor-not-allowed bg-transparent line-through opacity-40'
                        : isSelected
                          ? 'bg-amber-400 text-black font-extrabold shadow-[0_0_12px_rgba(247,198,0,0.6)] cursor-pointer'
                          : isCurrentDay
                            ? 'border border-amber-400 text-amber-300 font-bold hover:bg-amber-400/20 cursor-pointer'
                            : 'text-neutral-200 hover:bg-neutral-800 hover:text-white cursor-pointer'
                    }`}
                    title={isDisabled ? (isEnd && minDateStr && minDateStr > todayStr ? 'Không thể chọn ngày trước thời gian bắt đầu' : 'Chỉ có thể chọn từ hôm nay trở đi') : isCurrentDay ? 'Hôm nay' : ''}
                  >
                    {dayNum}
                  </button>
                );
              })}
            </div>

            {/* 24-Hour Time Row */}
            <div className="mt-3.5 pt-2.5 border-t border-white/10 flex items-center justify-between gap-2">
              <span className="text-[10.5px] font-mono uppercase font-bold text-neutral-300 flex items-center gap-1.5">
                <Clock className="h-3.5 w-3.5 text-amber-400" /> Giờ (24h):
              </span>
              <div className="flex items-center gap-1.5 font-mono">
                <select
                  value={parsed.hour}
                  onChange={(e) => handleTimeChange('hour', e.target.value)}
                  className="px-2 py-1 bg-black border border-white/20 text-xs text-amber-300 font-bold focus:border-amber-400 focus:outline-none cursor-pointer"
                >
                  {HOURS_24.map(h => (
                    <option key={h} value={h}>{h}h</option>
                  ))}
                </select>
                <span className="text-white font-bold">:</span>
                <select
                  value={parsed.minute}
                  onChange={(e) => handleTimeChange('minute', e.target.value)}
                  className="px-2 py-1 bg-black border border-white/20 text-xs text-amber-300 font-bold focus:border-amber-400 focus:outline-none cursor-pointer"
                >
                  {MINUTES_60.map(m => (
                    <option key={m} value={m}>{m}p</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Quick Action Shortcuts */}
            <div className="mt-3 pt-2.5 border-t border-white/10 flex items-center justify-between text-[10px] font-mono flex-wrap gap-1.5">
              <div className="flex items-center gap-1.5">
                {!isEnd && (
                  <button
                    type="button"
                    onClick={handleSetToday}
                    className="px-2.5 py-1 bg-neutral-900 border border-white/15 text-amber-400 hover:text-amber-300 hover:border-amber-400 transition cursor-pointer font-bold"
                  >
                    Hôm nay
                  </button>
                )}
                {value && (
                  <button
                    type="button"
                    onClick={() => onChange('')}
                    className="px-2 py-1 bg-neutral-900 border border-rose-500/30 text-rose-400 hover:text-rose-300 hover:border-rose-400 transition cursor-pointer"
                  >
                    ✕ Xóa trống
                  </button>
                )}
              </div>

              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="px-3.5 py-1 bg-amber-400 hover:bg-amber-300 text-black font-bold uppercase transition cursor-pointer ml-auto"
              >
                Xác nhận
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}

export default function AdminHeroBannerPanel(props) {
  const mergedProps = props?.ctx ? { ...props.ctx, ...props } : props;
  const {
    moviesList = [],
    publicCinema = [],
    showToast = () => {},
    isAdmin = true,
    isManager = false,
    currentUser = null,
    heroBannerInitialMovieId = null,
    setHeroBannerInitialMovieId = () => {},
    preselectedMovieId = null,
    onClearPreselectedMovie = () => {}
  } = mergedProps;

  // Resilient Cinemas list (handles null, undefined, or single object)
  const cinemaList = useMemo(() => {
    if (Array.isArray(publicCinema)) return publicCinema;
    if (publicCinema && Array.isArray(publicCinema.items)) return publicCinema.items;
    if (publicCinema && typeof publicCinema === 'object' && publicCinema.id) return [publicCinema];
    return [];
  }, [publicCinema]);

  const [internalCinemas, setInternalCinemas] = useState([]);
  const effectiveCinemas = useMemo(() => {
    return cinemaList.length > 0 ? cinemaList : internalCinemas;
  }, [cinemaList, internalCinemas]);

  useEffect(() => {
    if (cinemaList.length === 0) {
      movieService.getPublicCinemas()
        .then(res => {
          const list = Array.isArray(res) ? res : Array.isArray(res?.items) ? res.items : Array.isArray(res?.data) ? res.data : [];
          if (list.length > 0) setInternalCinemas(list);
        })
        .catch(() => {});
    }
  }, [cinemaList]);

  // Resilient Movies list (handles null or empty list)
  const [internalMovies, setInternalMovies] = useState([]);
  const effectiveMovies = useMemo(() => {
    if (Array.isArray(moviesList) && moviesList.length > 0) return moviesList;
    return internalMovies;
  }, [moviesList, internalMovies]);

  useEffect(() => {
    if (!Array.isArray(moviesList) || moviesList.length === 0) {
      movieService.searchMoviesPage({ page: 0, size: 100 })
        .then(res => {
          const list = Array.isArray(res) ? res : Array.isArray(res?.items) ? res.items : [];
          if (list.length > 0) setInternalMovies(list);
        })
        .catch(() => {});
    }
  }, [moviesList]);

  // Cinema filter (for slot management)
  const [cinemaFilter, setCinemaFilter] = useState('');

  // Data states
  const [banners, setBanners] = useState([]);
  const [loading, setLoading] = useState(false);
  const [isReordering, setIsReordering] = useState(false);

  // Form Modal state
  const [showModal, setShowModal] = useState(false);
  const [modalMode, setModalMode] = useState('create'); // 'create' | 'edit'
  const [editingBannerId, setEditingBannerId] = useState(null);
  const [formStep, setFormStep] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [uploadingDesktop, setUploadingDesktop] = useState(false);

  // F&B Products & Combos list
  const [fnbList, setFnbList] = useState([]);
  const [fnbSearchTerm, setFnbSearchTerm] = useState('');
  const [movieSearchTerm, setMovieSearchTerm] = useState('');
  const [autoUseMovieData, setAutoUseMovieData] = useState(true);
  const [customDisplayMode, setCustomDisplayMode] = useState('overlay'); // 'overlay' | 'imageOnly'
  const [badgeOption, setBadgeOption] = useState('Đang chiếu');
  const [customBadgeText, setCustomBadgeText] = useState('');
  const [showAdvancedContent, setShowAdvancedContent] = useState(false);

  // Hero Slot Management States (Sections 63-116)
  const [slotSettings, setSlotSettings] = useState({
    slotCount: 5,
    autoFillEnabled: true,
    autoSourceNowShowing: true,
    autoSourceComingSoon: false,
    refreshMinutes: 15
  });
  const [heroSlots, setHeroSlots] = useState([]);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [showSlotSettingsModal, setShowSlotSettingsModal] = useState(false);
  const [assigningSlotPosition, setAssigningSlotPosition] = useState(null);
  const [showAssignBannerModal, setShowAssignBannerModal] = useState(false);
  const [movieInputFocused, setMovieInputFocused] = useState(false);

  // Preview state
  const [previewDevice, setPreviewDevice] = useState('desktop'); // desktop, tablet, mobile
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [previewingBanner, setPreviewingBanner] = useState(null);

  // Initial Form state (Sections 1-22)
  const defaultForm = {
    name: '',
    type: 'MOVIE',
    title: '',
    isImageOnly: false,
    subtitle: '',
    description: '',
    badge: 'Đang chiếu',
    formatLabel: 'IMAX LASER 70MM',
    desktopImageUrl: '',
    mobileImageUrl: '',
    altText: '',
    focalPoint: 'CENTER',
    linkedMovieId: '',
    linkedPromotionId: '',
    linkedFnbId: '',
    fnbType: '',
    primaryCtaType: 'BOOK_NOW',
    primaryCtaLabel: 'ĐẶT VÉ NGAY',
    primaryCtaUrl: '',
    secondaryCtaType: 'NONE',
    secondaryCtaLabel: '',
    secondaryCtaUrl: '',
    scopeType: isManager ? 'CINEMA' : 'GLOBAL',
    targetCity: '',
    cinemaIds: [],
    priority: 1,
    sortOrder: 1,
    slideDurationSeconds: 6,
    startAt: '',
    endAt: '',
    publishNow: false
  };

  const [formData, setFormData] = useState(defaultForm);
  const [formErrors, setFormErrors] = useState({});

  // Filtered lists and selected objects for form selectors (Sections 4-22)
  const filteredMoviesForSelect = useMemo(() => {
    if (!movieSearchTerm.trim()) return effectiveMovies;
    const term = movieSearchTerm.toLowerCase().trim();
    return effectiveMovies.filter(m =>
      (m.title && m.title.toLowerCase().includes(term)) ||
      (m.englishTitle && m.englishTitle.toLowerCase().includes(term)) ||
      (m.id && String(m.id).includes(term)) ||
      (m.backendId && String(m.backendId).includes(term))
    );
  }, [effectiveMovies, movieSearchTerm]);

  const selectedMovieObj = useMemo(() => {
    if (!formData.linkedMovieId) return null;
    return effectiveMovies.find(m => String(m.backendId || m.id) === String(formData.linkedMovieId)) || null;
  }, [effectiveMovies, formData.linkedMovieId]);

  // Map các phim đã có Hero Banner (loại trừ banner đang được chỉnh sửa)
  const publishedMovieIdsMap = useMemo(() => {
    const map = new Map();
    banners.forEach(b => {
      if (editingBannerId && String(b.id) === String(editingBannerId)) return;
      if (b.status === 'ARCHIVED') return;
      const mId = b.linkedMovieId || b.movieId || (b.type === 'MOVIE' ? b.targetEntityId : null);
      if (mId) {
        map.set(String(mId), b);
      }
    });
    return map;
  }, [banners, editingBannerId]);

  const filteredFnbForSelect = useMemo(() => {
    if (!fnbSearchTerm.trim()) return fnbList;
    const term = fnbSearchTerm.toLowerCase().trim();
    return fnbList.filter(f =>
      (f.name && f.name.toLowerCase().includes(term)) ||
      (f.description && f.description.toLowerCase().includes(term))
    );
  }, [fnbList, fnbSearchTerm]);

  const selectedFnbObj = useMemo(() => {
    if (!formData.linkedFnbId) return null;
    return fnbList.find(f => String(f.id) === String(formData.linkedFnbId)) || null;
  }, [fnbList, formData.linkedFnbId]);

  // Fetch Banners
  const fetchBanners = useCallback(async () => {
    setLoading(true);
    try {
      const params = {
        page: 0,
        size: 50,
        cinemaId: cinemaFilter ? Number(cinemaFilter) : undefined
      };
      const res = await heroBannerService.getAdminHeroBanners(params);
      setBanners(res.items || []);
    } catch (err) {
      showToast(err.message || 'Không thể tải danh sách Hero Banner');
    } finally {
      setLoading(false);
    }
  }, [cinemaFilter]);

  // Fetch Slot Settings & Resolved Slots
  const fetchSlotSettings = useCallback(async () => {
    try {
      const res = await heroBannerService.getSlotSettings();
      if (res && res.data) setSlotSettings(res.data);
      else if (res && res.slotCount) setSlotSettings(res);
    } catch (err) {
      console.warn('Could not fetch slot settings:', err.message);
    }
  }, []);

  const fetchSlots = useCallback(async () => {
    setSlotsLoading(true);
    try {
      const res = await heroBannerService.getHeroSlots(cinemaFilter ? Number(cinemaFilter) : null);
      const list = res?.data || res || [];
      setHeroSlots(Array.isArray(list) ? list : []);
    } catch (err) {
      console.warn('Could not fetch hero slots:', err.message);
    } finally {
      setSlotsLoading(false);
    }
  }, [cinemaFilter]);

  // Fetch F&B Products & Combos on mount
  useEffect(() => {
    Promise.allSettled([
      movieService.getFoodItems(),
      movieService.getFoodCombos()
    ]).then(([itemsRes, combosRes]) => {
      const items = (itemsRes.status === 'fulfilled' && Array.isArray(itemsRes.value))
        ? itemsRes.value.map(i => ({ ...i, fnbType: 'ITEM' }))
        : [];
      const combos = (combosRes.status === 'fulfilled' && Array.isArray(combosRes.value))
        ? combosRes.value.map(c => ({ ...c, fnbType: 'COMBO' }))
        : [];
      setFnbList([...combos, ...items]);
    }).catch(() => {});
  }, []);

  useEffect(() => {
    fetchSlotSettings();
    fetchSlots();
  }, [fetchSlotSettings, fetchSlots]);

  useEffect(() => {
    fetchBanners();
  }, [fetchBanners]);

  // ========================================================
  // AUTO-FILL & BACKFILL TO ENSURE AT LEAST 5 BANNERS ON HERO
  // ========================================================
  const TARGET_HERO_COUNT = 5;
  const [isAutoPublishing, setIsAutoPublishing] = useState(false);

  // 1. Phân loại banner thật do Admin tạo/quản trị (Đang xuất bản)
  const realActiveBanners = useMemo(() => {
    return banners.filter(b => {
      const isPub = b.status === 'PUBLISHED';
      return isPub && !String(b.name || '').includes('Default Experience') && !String(b.title || '').includes('CINEPREMIER CINEMAS');
    });
  }, [banners]);

  // 2. Danh sách phim mới nhất được sắp xếp theo createdAt DESC, id DESC, releaseDate DESC
  const sortedNewestMovies = useMemo(() => {
    if (!Array.isArray(effectiveMovies) || effectiveMovies.length === 0) return [];
    return [...effectiveMovies].sort((a, b) => {
      const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      if (dateB !== dateA) return dateB - dateA;
      const idA = Number(a.backendId || a.id || 0);
      const idB = Number(b.backendId || b.id || 0);
      if (idB !== idA) return idB - idA;
      const relA = a.releaseDate ? new Date(a.releaseDate).getTime() : 0;
      const relB = b.releaseDate ? new Date(b.releaseDate).getTime() : 0;
      return relB - relA;
    });
  }, [effectiveMovies]);

  // 3. Tính toán các banner tự động bù (5 - N phim mới nhất)
  const autoFilledBanners = useMemo(() => {
    const neededCount = Math.max(0, TARGET_HERO_COUNT - realActiveBanners.length);
    if (neededCount === 0 || sortedNewestMovies.length === 0) return [];

    const existingMovieIds = new Set();
    const existingTitles = new Set();
    banners.forEach(b => {
      if (b.linkedMovieId) existingMovieIds.add(String(b.linkedMovieId));
      if (b.movieId) existingMovieIds.add(String(b.movieId));
      if (b.title) existingTitles.add(String(b.title).toUpperCase().trim());
    });

    const list = [];
    for (const movie of sortedNewestMovies) {
      if (list.length >= neededCount) break;
      const movieId = movie.backendId || movie.id;
      const movieTitle = String(movie.title || '').toUpperCase().trim();
      if (existingMovieIds.has(String(movieId)) || existingTitles.has(movieTitle)) {
        continue;
      }

      const isNowShowing = movie.isNowShowing || movie.status === 'NOW_SHOWING';
      const backdrop = movie.avatarUrl || movie.bannerUrl || movie.posterUrl || 'https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?auto=format&fit=crop&w=1920&q=85';

      list.push({
        id: `auto-fill-${movieId}`,
        isAutoFilled: true,
        originalMovie: movie,
        linkedMovieId: movieId,
        name: `[TỰ ĐỘNG ĐƯA LÊN] ${movie.title}`,
        title: movie.title.toUpperCase(),
        subtitle: movie.synopsis
          ? (movie.synopsis.length > 100 ? `${movie.synopsis.slice(0, 100)}...` : movie.synopsis)
          : (movie.englishTitle || 'Phim mới tự động đưa lên Hero Carousel'),
        badge: isNowShowing ? 'BOM TẤN ĐANG CHIẾU' : 'PHIM MỚI NHẤT',
        formatLabel: movie.duration ? `${movie.duration} PHÚT • ${movie.ageRating || 'P'} • IMAX LASER` : 'IMAX LASER 70MM',
        desktopImageUrl: backdrop,
        mobileImageUrl: backdrop,
        type: 'MOVIE',
        primaryCtaType: 'BOOK_NOW',
        primaryCtaLabel: isNowShowing ? 'ĐẶT VÉ NGAY' : 'CHI TIẾT PHIM',
        primaryCtaUrl: isNowShowing ? `/showtimes?movieId=${movieId}` : `/movies/${movieId}`,
        secondaryCtaType: movie.trailerUrl ? 'INTERNAL_URL' : 'NONE',
        secondaryCtaLabel: movie.trailerUrl ? 'XEM TRAILER' : '',
        secondaryCtaUrl: movie.trailerUrl || '',
        scopeType: 'GLOBAL',
        status: 'PUBLISHED',
        sortOrder: realActiveBanners.length + list.length + 1,
        slideDurationSeconds: 6,
        impressionsCount: 0,
        clicksCount: 0,
        ctr: 0,
        startAt: movie.releaseDate || null,
        endAt: null
      });
    }

    return list;
  }, [realActiveBanners, sortedNewestMovies, banners]);


  // 5. Thao tác: 1-Click tự động đưa các phim mới lên thành Banner chính thức trong CSDL
  const handleAutoPublishNewestMovies = async () => {
    if (autoFilledBanners.length === 0) {
      showToast('Hệ thống đã có đủ 5 banner chính thức!');
      return;
    }

    setIsAutoPublishing(true);
    let successCount = 0;
    try {
      for (const autoItem of autoFilledBanners) {
        const movie = autoItem.originalMovie;
        const movieId = movie.backendId || movie.id;
        const isNowShowing = movie.isNowShowing || movie.status === 'NOW_SHOWING';
        const backdrop = movie.avatarUrl || movie.bannerUrl || movie.posterUrl || 'https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?auto=format&fit=crop&w=1920&q=85';

        const payload = {
          name: `Banner: ${movie.title}`,
          type: 'MOVIE',
          title: movie.title.toUpperCase(),
          subtitle: movie.synopsis ? (movie.synopsis.length > 120 ? `${movie.synopsis.slice(0, 120)}...` : movie.synopsis) : (movie.englishTitle || 'Phim mới trên CinePremier'),
          badge: isNowShowing ? 'BOM TẤN ĐANG CHIẾU' : 'PHIM MỚI NHẤT',
          formatLabel: movie.duration ? `${movie.duration} PHÚT • ${movie.ageRating || 'P'} • IMAX LASER` : 'IMAX LASER 70MM',
          desktopImageUrl: backdrop,
          mobileImageUrl: backdrop,
          primaryCtaType: 'BOOK_NOW',
          primaryCtaLabel: isNowShowing ? 'ĐẶT VÉ NGAY' : 'CHI TIẾT PHIM',
          primaryCtaUrl: isNowShowing ? `/showtimes?movieId=${movieId}` : `/movies/${movieId}`,
          secondaryCtaType: movie.trailerUrl ? 'INTERNAL_URL' : null,
          secondaryCtaLabel: movie.trailerUrl ? 'XEM TRAILER' : null,
          secondaryCtaUrl: movie.trailerUrl || null,
          scopeType: isManager ? 'CINEMA' : 'GLOBAL',
          cinemaIds: [],
          priority: 5 - successCount,
          sortOrder: banners.length + successCount + 1,
          slideDurationSeconds: 6,
          publishNow: true
        };

        await heroBannerService.createHeroBanner(payload);
        successCount++;
      }

      showToast(`Đã tự động lưu và xuất bản ${successCount} banner phim mới nhất vào CSDL thành công!`);
      await fetchBanners();
    } catch (err) {
      showToast(err.message || 'Lỗi khi tự động lưu banner vào hệ thống');
    } finally {
      setIsAutoPublishing(false);
    }
  };

  // 6. Thao tác: Lưu 1 banner tự động thành banner chính thức trong CSDL
  const handleSaveAutoBannerAsOfficial = async (movie) => {
    const movieId = movie.backendId || movie.id;
    const isNowShowing = movie.isNowShowing || movie.status === 'NOW_SHOWING';
    const backdrop = movie.avatarUrl || movie.bannerUrl || movie.posterUrl || 'https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?auto=format&fit=crop&w=1920&q=85';

    const payload = {
      name: `Banner: ${movie.title}`,
      type: 'MOVIE',
      title: movie.title.toUpperCase(),
      subtitle: movie.synopsis ? (movie.synopsis.length > 120 ? `${movie.synopsis.slice(0, 120)}...` : movie.synopsis) : (movie.englishTitle || 'Phim mới trên CinePremier'),
      badge: isNowShowing ? 'BOM TẤN ĐANG CHIẾU' : 'PHIM MỚI NHẤT',
      formatLabel: movie.duration ? `${movie.duration} PHÚT • ${movie.ageRating || 'P'} • IMAX LASER` : 'IMAX LASER 70MM',
      desktopImageUrl: backdrop,
      mobileImageUrl: backdrop,
      primaryCtaType: 'BOOK_NOW',
      primaryCtaLabel: isNowShowing ? 'ĐẶT VÉ NGAY' : 'CHI TIẾT PHIM',
      primaryCtaUrl: isNowShowing ? `/showtimes?movieId=${movieId}` : `/movies/${movieId}`,
      secondaryCtaType: movie.trailerUrl ? 'INTERNAL_URL' : null,
      secondaryCtaLabel: movie.trailerUrl ? 'XEM TRAILER' : null,
      secondaryCtaUrl: movie.trailerUrl || null,
      scopeType: isManager ? 'CINEMA' : 'GLOBAL',
      cinemaIds: [],
      priority: 5,
      sortOrder: (banners.length || 0) + 1,
      slideDurationSeconds: 6,
      publishNow: true
    };

    try {
      await heroBannerService.createHeroBanner(payload);
      showToast(`Đã lưu "${movie.title}" thành Banner chính thức thành công!`);
      await fetchBanners();
    } catch (err) {
      showToast(err.message || 'Lỗi khi lưu banner chính thức');
    }
  };

  // Auto trigger create with preselected movie if passed (from props or cross-tab adminCtx)
  const effectivePreselectedMovieId = heroBannerInitialMovieId || preselectedMovieId;
  useEffect(() => {
    if (effectivePreselectedMovieId && effectiveMovies.length > 0) {
      const movie = effectiveMovies.find(m => String(m.backendId || m.id) === String(effectivePreselectedMovieId));
      if (movie) {
        handleOpenCreateForMovie(movie);
        if (setHeroBannerInitialMovieId) setHeroBannerInitialMovieId(null);
        if (onClearPreselectedMovie) onClearPreselectedMovie();
      }
    }
  }, [effectivePreselectedMovieId, effectiveMovies]);

  // Action: Open Create Modal
  const handleOpenCreate = () => {
    setFormData({
      ...defaultForm,
      scopeType: isManager ? 'CINEMA' : 'GLOBAL',
      sortOrder: (banners.length || 0) + 1
    });
    setFormErrors({});
    setFormStep(1);
    setModalMode('create');
    setEditingBannerId(null);
    setMovieSearchTerm('');
    setFnbSearchTerm('');
    setCustomDisplayMode('overlay');
    setBadgeOption('Đang chiếu');
    setCustomBadgeText('');
    setAutoUseMovieData(true);
    setShowAdvancedContent(false);
    setShowModal(true);
  };

  // Action: "ĐƯA LÊN HERO" for specific movie
  const handleOpenCreateForMovie = (movie) => {
    const movieId = movie.backendId || movie.id;
    const isNowShowing = movie.isNowShowing || movie.status === 'NOW_SHOWING';
    const backdrop = movie.bannerUrl || movie.avatarUrl || movie.posterUrl || '';

    setFormData({
      ...defaultForm,
      type: 'MOVIE',
      linkedMovieId: movieId,
      name: `${movie.title} - Hero`,
      title: movie.title.toUpperCase(),
      subtitle: movie.synopsis
        ? (movie.synopsis.length > 120 ? `${movie.synopsis.slice(0, 120)}...` : movie.synopsis)
        : (movie.englishTitle || 'Trải nghiệm đỉnh cao phòng vé CinePremier'),
      badge: isNowShowing ? 'Đang chiếu' : 'Sắp chiếu',
      formatLabel: movie.duration ? `${movie.duration} PHÚT • ${movie.ageRating || 'P'} • IMAX LASER` : 'IMAX LASER 70MM',
      desktopImageUrl: backdrop,
      mobileImageUrl: backdrop,
      primaryCtaType: 'BOOK_NOW',
      primaryCtaLabel: isNowShowing ? 'ĐẶT VÉ NGAY' : 'CHI TIẾT PHIM',
      primaryCtaUrl: isNowShowing ? `/showtimes?movieId=${movieId}` : `/movies/${movieId}`,
      secondaryCtaType: movie.trailerUrl ? 'INTERNAL_URL' : 'NONE',
      secondaryCtaLabel: movie.trailerUrl ? 'XEM TRAILER' : '',
      secondaryCtaUrl: movie.trailerUrl || '',
      scopeType: isManager ? 'CINEMA' : 'GLOBAL',
      sortOrder: (banners.length || 0) + 1
    });
    setBadgeOption(isNowShowing ? 'Đang chiếu' : 'Sắp chiếu');
    setCustomBadgeText('');
    setAutoUseMovieData(true);
    setFormErrors({});
    setFormStep(1); // Mở Bước 1 đã gộp đồng bộ đầy đủ nội dung & hình ảnh
    setModalMode('create');
    setEditingBannerId(null);
    setShowModal(true);
  };

  // Action: Edit Banner
  const handleOpenEdit = (banner) => {
    const isImageOnly = Boolean(banner.isImageOnly);
    setFormData({
      name: banner.name || '',
      type: banner.type || 'MOVIE',
      title: banner.title || '',
      isImageOnly,
      subtitle: banner.subtitle || '',
      description: banner.description || '',
      badge: banner.badge || '',
      formatLabel: banner.formatLabel || '',
      desktopImageUrl: banner.desktopImageUrl || '',
      mobileImageUrl: banner.mobileImageUrl || '',
      altText: banner.altText || '',
      focalPoint: banner.focalPoint || 'CENTER',
      linkedMovieId: banner.linkedMovieId || '',
      linkedFnbId: banner.linkedFnbId || '',
      fnbType: banner.fnbType || '',
      linkedPromotionId: banner.linkedPromotionId || '',
      primaryCtaType: banner.primaryCtaType || 'BOOK_NOW',
      primaryCtaLabel: banner.primaryCtaLabel || 'ĐẶT VÉ NGAY',
      primaryCtaUrl: banner.primaryCtaUrl || '',
      secondaryCtaType: banner.secondaryCtaType || 'NONE',
      secondaryCtaLabel: banner.secondaryCtaLabel || '',
      secondaryCtaUrl: banner.secondaryCtaUrl || '',
      scopeType: banner.scopeType || 'GLOBAL',
      targetCity: banner.targetCity || '',
      cinemaIds: banner.cinemas ? banner.cinemas.map(c => c.id) : [],
      priority: banner.priority || 1,
      sortOrder: banner.sortOrder || 1,
      slideDurationSeconds: banner.slideDurationSeconds || 6,
      startAt: banner.startAt ? banner.startAt.slice(0, 16) : '',
      endAt: banner.endAt ? banner.endAt.slice(0, 16) : '',
      publishNow: banner.status === 'PUBLISHED'
    });
    setCustomDisplayMode(isImageOnly ? 'imageOnly' : 'overlay');
    setBadgeOption(HIGHLIGHT_BADGE_OPTIONS.includes(banner.badge) ? banner.badge : (banner.badge ? 'Tùy chỉnh...' : 'Không có'));
    setCustomBadgeText(!HIGHLIGHT_BADGE_OPTIONS.includes(banner.badge) ? banner.badge : '');
    setAutoUseMovieData(Boolean(banner.linkedMovieId));
    setShowAdvancedContent(false);
    setFormErrors({});
    setFormStep(1);
    setModalMode('edit');
    setEditingBannerId(banner.id);
    setShowModal(true);
  };

  // Movie selection change in form (Section 5, 6, 7, 8, 9, 10)
  const handleSelectMovieInForm = (movieId) => {
    const movie = effectiveMovies.find(m => String(m.backendId || m.id) === String(movieId));
    if (!movie) {
      setFormData(prev => ({ ...prev, linkedMovieId: movieId }));
      return;
    }
    const isNowShowing = movie.isNowShowing || movie.status === 'NOW_SHOWING';
    const backdrop = movie.bannerUrl || movie.avatarUrl || movie.posterUrl || '';

    const synSnippet = movie.synopsis
      ? (movie.synopsis.length > 120 ? `${movie.synopsis.slice(0, 120)}...` : movie.synopsis)
      : (movie.englishTitle || '');

    setFormData(prev => ({
      ...prev,
      linkedMovieId: movie.backendId || movie.id,
      name: prev.name && prev.name !== `Banner: ` && !prev.name.endsWith('- Hero') ? prev.name : `${movie.title} - Hero`,
      title: autoUseMovieData ? movie.title.toUpperCase() : (prev.title || movie.title.toUpperCase()),
      subtitle: prev.subtitle || synSnippet,
      badge: isNowShowing ? 'Đang chiếu' : 'Sắp chiếu',
      formatLabel: movie.duration ? `${movie.duration} PHÚT • ${movie.ageRating || 'P'} • IMAX LASER` : 'IMAX LASER 70MM',
      desktopImageUrl: backdrop || '',
      mobileImageUrl: backdrop || '',
      primaryCtaType: 'BOOK_NOW',
      primaryCtaLabel: isNowShowing ? 'ĐẶT VÉ NGAY' : 'CHI TIẾT PHIM',
      primaryCtaUrl: isNowShowing ? `/showtimes?movieId=${movie.backendId || movie.id}` : `/movies/${movie.backendId || movie.id}`,
      secondaryCtaType: movie.trailerUrl ? 'INTERNAL_URL' : 'NONE',
      secondaryCtaLabel: movie.trailerUrl ? 'XEM TRAILER' : '',
      secondaryCtaUrl: movie.trailerUrl || ''
    }));
    setBadgeOption(isNowShowing ? 'Đang chiếu' : 'Sắp chiếu');
  };

  // F&B selection change in form (Section 15, 16, 17, 18)
  const handleSelectFnbInForm = (fnbId) => {
    const fnb = fnbList.find(f => String(f.id) === String(fnbId));
    if (!fnb) {
      setFormData(prev => ({
        ...prev,
        linkedFnbId: fnbId,
        desktopImageUrl: '',
        mobileImageUrl: ''
      }));
      return;
    }
    const img = fnb.imageUrl || fnb.image || '';
    const formattedPrice = fnb.price ? new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(fnb.price) : '';

    setFormData(prev => ({
      ...prev,
      linkedFnbId: fnb.id,
      fnbType: fnb.fnbType || 'ITEM',
      name: `${fnb.name} - F&B Hero`,
      title: fnb.name.toUpperCase(),
      subtitle: fnb.description ? (fnb.description.length > 100 ? `${fnb.description.slice(0, 100)}...` : fnb.description) : (formattedPrice ? `Giá chỉ từ ${formattedPrice}` : 'Ưu đãi bắp nước đặc biệt'),
      badge: fnb.fnbType === 'COMBO' ? 'Phim hot' : 'Đề xuất',
      desktopImageUrl: img || '',
      mobileImageUrl: img || '',
      primaryCtaType: 'VIEW_FNB',
      primaryCtaLabel: 'ĐẶT BẮP NƯỚC',
      primaryCtaUrl: '/concessions',
      secondaryCtaType: 'NONE',
      secondaryCtaLabel: '',
      secondaryCtaUrl: ''
    }));
    setBadgeOption('Đề xuất');
  };

  // Type change handler with safety check (Section 42)
  const handleTypeChange = (newType) => {
    if (newType === formData.type) return;
    setMovieSearchTerm('');
    setFnbSearchTerm('');
    setFormData(prev => {
      let initialCta = 'BOOK_NOW';
      let initialCtaLabel = 'ĐẶT VÉ NGAY';
      let initialCtaUrl = '';

      if (newType === 'MOVIE') {
        initialCta = 'BOOK_NOW';
        initialCtaLabel = 'ĐẶT VÉ NGAY';
      } else if (newType === 'FNB') {
        initialCta = 'VIEW_FNB';
        initialCtaLabel = 'ĐẶT BẮP NƯỚC';
        initialCtaUrl = '/concessions';
      } else if (newType === 'CUSTOM') {
        initialCta = 'INTERNAL_URL';
        initialCtaLabel = 'XEM NGAY';
        initialCtaUrl = '/';
      }

      return {
        ...prev,
        type: newType,
        linkedMovieId: '',
        linkedFnbId: '',
        desktopImageUrl: '',
        mobileImageUrl: '',
        name: '',
        title: '',
        subtitle: '',
        primaryCtaType: initialCta,
        primaryCtaLabel: initialCtaLabel,
        primaryCtaUrl: initialCtaUrl
      };
    });
  };

  // Image Upload Handlers
  const handleUploadImage = async (field, file) => {
    if (!file) return;

    setUploadingDesktop(true);

    try {
      const res = await heroBannerService.uploadBannerImage(file, 'hero-banners');
      const url = res.url || res.secureUrl || res.data?.url;
      if (!url) throw new Error('Không nhận được URL ảnh từ máy chủ');

      setFormData(prev => ({ ...prev, desktopImageUrl: url, mobileImageUrl: url }));
      setFormErrors(prev => ({ ...prev, desktopImageUrl: undefined }));
      showToast('Đã tải lên ảnh banner 1920x600 thành công!');
    } catch (err) {
      showToast(err.message || 'Lỗi khi tải ảnh lên máy chủ');
    } finally {
      setUploadingDesktop(false);
    }
  };

  // Form Validation — bao gồm kiểm tra trùng lặp movie/FnB
  const validateForm = () => {
    const errs = {};
    if (!formData.desktopImageUrl?.trim()) errs.desktopImageUrl = 'Bắt buộc tải lên hoặc nhập URL ảnh banner (1920x600)';

    if (formData.type === 'MOVIE') {
      if (!formData.linkedMovieId) errs.linkedMovieId = 'Vui lòng tìm và chọn một bộ phim liên kết';
      // Kiểm tra phim đã có banner (không cho trùng), bỏ qua khi edit chính banner đó
      const duplicateMovie = banners.find(b =>
        b.id !== editingBannerId &&
        b.type === 'MOVIE' &&
        b.status !== 'ARCHIVED' &&
        String(b.linkedMovieId || b.movieId || '') === String(formData.linkedMovieId)
      );
      if (duplicateMovie) {
        errs.linkedMovieId = `Phim này đã có Hero Banner "${duplicateMovie.name || duplicateMovie.title}" (${duplicateMovie.status}). Vui lòng chọn phim khác hoặc chỉnh sửa banner hiện có.`;
      }
    } else if (formData.type === 'FNB') {
      if (!formData.linkedFnbId) errs.linkedFnbId = 'Vui lòng tìm và chọn một sản phẩm hoặc combo F&B';
      // Kiểm tra F&B đã có banner
      const duplicateFnb = banners.find(b =>
        b.id !== editingBannerId &&
        b.type === 'FNB' &&
        b.status !== 'ARCHIVED' &&
        String(b.linkedFnbId || '') === String(formData.linkedFnbId)
      );
      if (duplicateFnb) {
        errs.linkedFnbId = `Sản phẩm / combo này đã có Hero Banner "${duplicateFnb.name || duplicateFnb.title}" (${duplicateFnb.status}). Vui lòng chọn sản phẩm khác.`;
      }
    } else if (formData.type === 'CUSTOM') {
      if (!formData.name?.trim()) {
        errs.name = 'Vui lòng nhập tên banner';
      }
      if (!formData.primaryCtaUrl?.trim()) {
        errs.primaryCtaUrl = 'Bắt buộc nhập đường dẫn URL điều hướng khi nhấp vào banner';
      }
    }

    if (formData.primaryCtaUrl?.trim() && (formData.primaryCtaUrl.startsWith('http://') || formData.primaryCtaUrl.startsWith('https://') || formData.primaryCtaUrl.includes('://'))) {
      if (!formData.primaryCtaUrl.startsWith('http://') && !formData.primaryCtaUrl.startsWith('https://')) {
        errs.primaryCtaUrl = 'URL ngoài phải bắt đầu bằng http:// hoặc https://';
      }
    }

    if (formData.scopeType === 'CITY' && !formData.targetCity?.trim()) {
      errs.targetCity = 'Vui lòng nhập tỉnh/thành phố áp dụng';
    }

    if (formData.scopeType === 'CINEMA' && (!formData.cinemaIds || formData.cinemaIds.length === 0)) {
      errs.cinemaIds = 'Vui lòng chọn ít nhất một cụm rạp áp dụng';
    }

    if (formData.startAt && formData.endAt) {
      const start = new Date(formData.startAt);
      const end = new Date(formData.endAt);
      if (end <= start) {
        errs.endAt = 'Thời gian kết thúc phải lớn hơn thời gian bắt đầu';
      }
    }

    setFormErrors(errs);
    return Object.keys(errs).length === 0;
  };

  // Submit Handler
  const handleSubmitForm = async (publishImmediately = false) => {
    if (!validateForm()) {
      showToast('Vui lòng kiểm tra lại các trường thông tin bị thiếu hoặc không hợp lệ');
      return;
    }

    setSubmitting(true);
    try {
      const autoName = selectedMovieObj?.title ? `${selectedMovieObj.title} - Hero` : (selectedFnbObj?.name ? `${selectedFnbObj.name} - Hero` : 'Hero Banner');
      const finalName = formData.name?.trim() || autoName;

      // Tính toán URL điều hướng trực tiếp khi nhấp banner
      let finalCtaUrl = formData.primaryCtaUrl?.trim() || null;
      let finalCtaType = 'VIEW_MOVIE';

      if (formData.type === 'MOVIE') {
        finalCtaType = 'VIEW_MOVIE';
        if (!finalCtaUrl && formData.linkedMovieId) {
          finalCtaUrl = `/movies/${formData.linkedMovieId}`;
        }
      } else if (formData.type === 'FNB') {
        finalCtaType = 'VIEW_FNB';
        if (!finalCtaUrl) {
          finalCtaUrl = '/concessions';
        }
      } else if (formData.type === 'CUSTOM') {
        finalCtaType = finalCtaUrl?.startsWith('http') ? 'EXTERNAL_URL' : 'INTERNAL_URL';
      }

      const payload = {
        name: finalName,
        type: formData.type,
        title: '',
        isImageOnly: true,
        subtitle: null,
        description: null,
        badge: null,
        formatLabel: null,
        desktopImageUrl: formData.desktopImageUrl.trim(),
        mobileImageUrl: formData.desktopImageUrl.trim(),
        altText: formData.altText?.trim() || null,
        focalPoint: 'CENTER',
        linkedMovieId: formData.type === 'MOVIE' && formData.linkedMovieId ? Number(formData.linkedMovieId) : null,
        linkedFnbId: formData.type === 'FNB' && formData.linkedFnbId ? Number(formData.linkedFnbId) : null,
        fnbType: formData.type === 'FNB' ? formData.fnbType : null,
        linkedPromotionId: null,
        primaryCtaType: finalCtaType,
        primaryCtaLabel: 'CHI TIẾT',
        primaryCtaUrl: finalCtaUrl,
        secondaryCtaType: null,
        secondaryCtaLabel: null,
        secondaryCtaUrl: null,
        scopeType: formData.scopeType,
        targetCity: formData.targetCity?.trim() || null,
        cinemaIds: formData.scopeType === 'CINEMA' ? formData.cinemaIds : [],
        priority: Number(formData.priority) || 1,
        sortOrder: Number(formData.sortOrder) || 1,
        slideDurationSeconds: Number(formData.slideDurationSeconds) || 6,
        startAt: formData.startAt ? `${formData.startAt}:00` : null,
        endAt: formData.endAt ? `${formData.endAt}:00` : null,
        publishNow: publishImmediately
      };

      if (modalMode === 'create') {
        await heroBannerService.createHeroBanner(payload);
        showToast(publishImmediately ? 'Đã tạo và xuất bản Banner thành công!' : 'Đã lưu bản nháp Banner thành công!');
      } else {
        await heroBannerService.updateHeroBanner(editingBannerId, payload);
        if (publishImmediately) {
          await heroBannerService.publishHeroBanner(editingBannerId);
        }
        showToast('Cập nhật Banner thành công!');
      }

      setShowModal(false);
      fetchBanners();
      fetchSlots();
    } catch (err) {
      showToast(err.response?.data?.message || err.message || 'Lỗi khi lưu Banner');
    } finally {
      setSubmitting(false);
    }
  };

  // Hero Slot Actions (Sections 63-116)
  const handleUpdateSlotCount = async (newCount) => {
    const clamped = Math.max(1, Math.min(10, newCount));
    if (clamped === slotSettings.slotCount) return;
    try {
      const updated = await heroBannerService.updateSlotSettings({
        ...slotSettings,
        slotCount: clamped
      });
      const data = updated?.data || updated;
      setSlotSettings(data);
      showToast(`Đã đổi số lượng Hero Carousel thành ${clamped} Slot`);
      fetchSlots();
      fetchBanners();
    } catch (err) {
      showToast(err.message || 'Lỗi khi cập nhật số lượng slot');
    }
  };

  const handleToggleAutoFill = async () => {
    const nextVal = !slotSettings.autoFillEnabled;
    try {
      const updated = await heroBannerService.updateSlotSettings({
        ...slotSettings,
        autoFillEnabled: nextVal
      });
      const data = updated?.data || updated;
      setSlotSettings(data);
      showToast(nextVal ? 'Đã BẬT tự động lấp đầy Hero Carousel' : 'Đã TẮT tự động lấp đầy Hero Carousel');
      fetchSlots();
      fetchBanners();
    } catch (err) {
      showToast(err.message || 'Lỗi khi thay đổi cấu hình Auto-fill');
    }
  };

  const handlePinAutoSlot = async (position) => {
    try {
      await heroBannerService.pinAutoSlot(position, cinemaFilter ? Number(cinemaFilter) : null);
      showToast(`Đã ghim phim tại Slot ${position} thành Banner chính thức trong CSDL!`);
      fetchSlots();
      fetchBanners();
    } catch (err) {
      showToast(err.message || 'Lỗi khi ghim phim vào Hero');
    }
  };

  const handleUnassignSlot = async (position) => {
    try {
      await heroBannerService.unassignSlot(position);
      showToast(`Đã gỡ banner khỏi Slot ${position}`);
      fetchSlots();
      fetchBanners();
    } catch (err) {
      showToast(err.message || 'Lỗi khi gỡ banner khỏi slot');
    }
  };

  const handleAssignBannerToSlot = async (bannerId) => {
    if (!assigningSlotPosition || !bannerId) return;
    try {
      await heroBannerService.assignBannerToSlot(assigningSlotPosition, bannerId);
      showToast(`Đã gán banner vào Slot ${assigningSlotPosition} thành công!`);
      setShowAssignBannerModal(false);
      setAssigningSlotPosition(null);
      fetchSlots();
      fetchBanners();
    } catch (err) {
      showToast(err.message || 'Lỗi khi gán banner vào slot');
    }
  };

  // Actions on Table Rows
  const handlePublish = async (banner) => {
    try {
      await heroBannerService.publishHeroBanner(banner.id);
      showToast(`Đã xuất bản banner "${banner.title}" thành công!`);
      fetchBanners();
    } catch (err) {
      showToast(err.response?.data?.message || err.message || 'Không thể xuất bản banner');
    }
  };

  const handlePause = async (banner) => {
    try {
      await heroBannerService.pauseHeroBanner(banner.id);
      showToast(`Đã tạm dừng banner "${banner.title}"`);
      fetchBanners();
    } catch (err) {
      showToast(err.response?.data?.message || err.message || 'Không thể tạm dừng banner');
    }
  };

  const handleResume = async (banner) => {
    try {
      await heroBannerService.resumeHeroBanner(banner.id);
      showToast(`Đã tiếp tục chạy banner "${banner.title}"`);
      fetchBanners();
    } catch (err) {
      showToast(err.response?.data?.message || err.message || 'Không thể tiếp tục banner');
    }
  };

  const handleArchive = async (banner) => {
    try {
      await heroBannerService.archiveHeroBanner(banner.id);
      showToast(`Đã đưa banner "${banner.title}" vào lưu trữ`);
      fetchBanners();
    } catch (err) {
      showToast(err.response?.data?.message || err.message || 'Không thể lưu trữ banner');
    }
  };

  const handleDuplicate = async (banner) => {
    try {
      await heroBannerService.duplicateHeroBanner(banner.id);
      showToast(`Đã nhân bản banner "${banner.title}" thành công!`);
      fetchBanners();
    } catch (err) {
      showToast(err.response?.data?.message || err.message || 'Không thể nhân bản banner');
    }
  };

  const handleDeleteDraft = async (banner) => {
    if (!window.confirm(`Xác nhận xóa bản nháp banner "${banner.name}"?`)) return;
    try {
      await heroBannerService.deleteDraftBanner(banner.id);
      showToast('Đã xóa bản nháp thành công');
      fetchBanners();
    } catch (err) {
      showToast(err.response?.data?.message || err.message || 'Không thể xóa bản nháp');
    }
  };

  // Reorder Handlers (Move Up / Down)
  const handleMoveOrder = async (index, direction) => {
    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= banners.length) return;

    const newBanners = [...banners];
    const temp = newBanners[index];
    newBanners[index] = newBanners[targetIndex];
    newBanners[targetIndex] = temp;

    setBanners(newBanners);
    setIsReordering(true);

    try {
      const bannerIds = newBanners.map(b => b.id);
      await heroBannerService.reorderHeroBanners(bannerIds);
      showToast('Đã lưu thứ tự hiển thị banner mới');
    } catch (err) {
      showToast('Không thể lưu thứ tự banner, vui lòng thử lại');
      fetchBanners();
    } finally {
      setIsReordering(false);
    }
  };

  // Preview Modal
  const handleOpenPreview = (banner) => {
    setPreviewingBanner(banner);
    setPreviewDevice('desktop');
    setShowPreviewModal(true);
  };

  return (
    <div className="space-y-6 pb-20 text-white select-none">

      {/* ========================================================
          1. HEADER & ACTION BUTTONS
      ======================================================== */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/10 pb-5">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-none bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
              <Sparkles className="h-4 w-4" />
            </div>
            <h1 className="text-lg sm:text-xl font-black uppercase tracking-wider text-white">
              HERO BANNER MANAGEMENT
            </h1>
          </div>
          <p className="text-xs text-neutral-400 mt-1 pl-10">
            Quản lý toàn bộ Hero Banner &amp; Carousel trên Landing Page CINEPREMIER
          </p>
        </div>


      </div>


      {/* ========================================================
          3.5. HERO CAROUSEL SLOTS & TỰ ĐỘNG LẤP ĐẦY (SECTIONS 63-116)
      ======================================================== */}
      <div className="p-4 bg-[#0a0b0e] border border-amber-500/30 rounded-none space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-3 border-b border-white/10">
          <div>
            <div className="flex items-center gap-2">
              <Layers className="h-4 w-4 text-[#F7C600]" />
              <h3 className="text-sm font-black uppercase tracking-wider text-white">
                QUẢN LÝ VỊ TRÍ HERO CAROUSEL (SLOT MANAGEMENT)
              </h3>
              <span className="px-2 py-0.5 bg-amber-400/10 border border-amber-400/30 text-amber-300 text-[10px] font-bold font-mono">
                {slotSettings.slotCount || 5} SLOTS
              </span>
            </div>
            <p className="text-[11px] text-neutral-400 mt-0.5">
              Quy tắc ưu tiên: <strong className="text-amber-300">THỦ CÔNG (MANUAL) &gt; TỰ ĐỘNG (AUTO)</strong>. Hệ thống tự động lấp đầy các vị trí còn thiếu bằng phim hot đang chiếu.
            </p>
          </div>

          <div className="flex items-center flex-wrap gap-2.5">
            {/* Stepper for Slot Count */}
            <div className="flex items-center bg-black border border-white/20 p-1">
              <span className="text-[10px] font-mono uppercase text-neutral-400 px-2 font-bold">Số Slot:</span>
              <button
                type="button"
                onClick={() => handleUpdateSlotCount(slotSettings.slotCount - 1)}
                disabled={slotSettings.slotCount <= 1}
                className="w-7 h-7 bg-neutral-900 hover:bg-neutral-800 disabled:opacity-40 text-white font-black text-sm flex items-center justify-center transition border border-white/10 cursor-pointer"
                title="Giảm 1 slot"
              >
                -
              </button>
              <span className="w-8 text-center font-mono font-bold text-amber-400 text-xs">
                {slotSettings.slotCount || 5}
              </span>
              <button
                type="button"
                onClick={() => handleUpdateSlotCount(slotSettings.slotCount + 1)}
                disabled={slotSettings.slotCount >= 10}
                className="w-7 h-7 bg-neutral-900 hover:bg-neutral-800 disabled:opacity-40 text-white font-black text-sm flex items-center justify-center transition border border-white/10 cursor-pointer"
                title="Tăng 1 slot"
              >
                +
              </button>
            </div>

            {/* Toggle Auto Fill */}
            <button
              type="button"
              onClick={handleToggleAutoFill}
              className={`px-3 py-1.5 border text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 transition cursor-pointer ${
                slotSettings.autoFillEnabled
                  ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-300 hover:bg-emerald-500/20'
                  : 'bg-neutral-900 border-white/20 text-neutral-400 hover:text-white'
              }`}
              title="Bật/Tắt tự động lấp đầy Hero Carousel khi chưa đủ banner"
            >
              <Sparkles className="h-3.5 w-3.5" />
              <span>TỰ ĐỘNG LẤP ĐẦY:</span>
              <strong className={slotSettings.autoFillEnabled ? 'text-emerald-400' : 'text-neutral-500'}>
                {slotSettings.autoFillEnabled ? 'BẬT' : 'TẮT'}
              </strong>
            </button>

            {/* Refresh Slots Button */}
            <button
              type="button"
              onClick={() => { fetchSlots(); fetchSlotSettings(); }}
              className="p-1.5 bg-black border border-white/20 hover:border-amber-400 text-neutral-300 hover:text-white transition cursor-pointer"
              title="Làm mới danh sách vị trí"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${slotsLoading ? 'animate-spin text-amber-400' : ''}`} />
            </button>
          </div>
        </div>


        {/* Slots Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3">
          {heroSlots.map((slot) => {
            const isManual = slot.assignmentType === 'MANUAL';
            const isAuto = slot.assignmentType === 'AUTO';
            const isEmpty = slot.assignmentType === 'EMPTY';

            const title = isManual
              ? (slot.banner?.title || slot.banner?.name || 'Banner thủ công')
              : isAuto
                ? (slot.autoMovie?.title || 'Phim tự động')
                : 'Vị trí trống';

            const imageUrl = isManual
              ? (slot.banner?.desktopImageUrl || slot.banner?.mobileImageUrl)
              : isAuto
                ? (slot.autoMovie?.bannerUrl || slot.autoMovie?.avatarUrl || slot.autoMovie?.posterUrl)
                : null;

            return (
              <div
                key={slot.position}
                className={`relative border flex flex-col justify-between p-3 transition ${
                  isManual
                    ? 'bg-amber-500/5 border-amber-500/40 hover:border-amber-400'
                    : isAuto
                      ? 'bg-purple-900/10 border-purple-500/30 hover:border-purple-400'
                      : 'bg-black/40 border-dashed border-white/20'
                }`}
              >
                {/* Slot Header */}
                <div className="flex items-center justify-between gap-1 mb-2">
                  <span className="text-[11px] font-black font-mono text-white tracking-wider">
                    SLOT #{slot.position}
                  </span>
                  <span className={`text-[9px] font-black uppercase font-mono px-1.5 py-0.5 border ${
                    isManual
                      ? 'bg-amber-400 text-black border-amber-400'
                      : isAuto
                        ? 'bg-purple-500/20 text-purple-300 border-purple-500/40'
                        : 'bg-white/5 text-neutral-500 border-white/10'
                  }`}>
                    {isManual ? 'MANUAL' : isAuto ? 'AUTO' : 'TRỐNG'}
                  </span>
                </div>

                {/* Slot Visual & Content */}
                <div className="space-y-2 flex-1">
                  {imageUrl ? (
                    <div className="relative aspect-[1920/600] w-full overflow-hidden bg-neutral-950 border border-white/10">
                      <img
                        src={imageUrl}
                        alt={title}
                        className="w-full h-full object-cover object-center"
                      />
                      {isManual && slot.banner?.badge && (
                        <span className="absolute top-1 left-1 px-1 py-0.5 bg-black/80 text-[#F7C600] text-[8px] font-bold uppercase">
                          {slot.banner.badge}
                        </span>
                      )}
                      {isAuto && (
                        <span className="absolute top-1 left-1 px-1 py-0.5 bg-purple-900/90 text-purple-200 text-[8px] font-bold uppercase">
                          PHIM HOT
                        </span>
                      )}
                    </div>
                  ) : (
                    <div className="aspect-[16/9] w-full bg-neutral-950 border border-dashed border-white/10 flex flex-col items-center justify-center text-neutral-600 p-2 text-center">
                      <span className="text-[10px] font-mono">Chưa gán banner</span>
                    </div>
                  )}

                  <div>
                    <h4 className="text-xs font-bold text-white line-clamp-1 uppercase">
                      {title}
                    </h4>
                    <p className="text-[10px] text-neutral-400 line-clamp-1 mt-0.5">
                      {isManual
                        ? (slot.banner?.subtitle || 'Banner từ thư viện')
                        : isAuto
                          ? `${slot.autoMovie?.duration ? `${slot.autoMovie.duration}p • ` : ''}${slot.autoMovie?.ageRating || 'P'} • Đang chiếu`
                          : 'Sẽ không hiển thị slide trắng'}
                    </p>
                  </div>
                </div>

                {/* Slot Actions */}
                <div className="pt-2 mt-2 border-t border-white/10 flex items-center gap-1.5">
                  {isManual && (
                    <>
                      <button
                        type="button"
                        onClick={() => handleOpenEdit(slot.banner)}
                        className="flex-1 py-1 bg-amber-500/10 hover:bg-amber-400 text-amber-300 hover:text-black border border-amber-500/30 text-[9.5px] font-bold uppercase tracking-wider transition text-center cursor-pointer"
                        title="Chỉnh sửa Banner"
                      >
                        SỬA
                      </button>
                      <button
                        type="button"
                        onClick={() => handleUnassignSlot(slot.position)}
                        className="py-1 px-2 bg-rose-500/10 hover:bg-rose-600 text-rose-300 hover:text-white border border-rose-500/30 text-[9.5px] font-bold uppercase transition cursor-pointer"
                        title="Gỡ khỏi Hero (Banner vẫn còn trong thư viện)"
                      >
                        GỠ
                      </button>
                    </>
                  )}

                  {isAuto && (
                    <>
                      <button
                        type="button"
                        onClick={() => handlePinAutoSlot(slot.position)}
                        className="flex-1 py-1 bg-amber-500/20 hover:bg-amber-400 text-amber-300 hover:text-black border border-amber-500/40 text-[9.5px] font-bold uppercase tracking-wider transition flex items-center justify-center gap-1 cursor-pointer"
                        title="Ghim phim này thành Banner thủ công trong CSDL"
                      >
                        <Pin className="h-2.5 w-2.5" />
                        <span>GHIM</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setAssigningSlotPosition(slot.position);
                          setShowAssignBannerModal(true);
                        }}
                        className="py-1 px-2 bg-purple-500/20 hover:bg-purple-600 text-purple-200 hover:text-white border border-purple-500/30 text-[9.5px] font-bold uppercase transition cursor-pointer"
                        title="Thay bằng Banner từ thư viện"
                      >
                        THAY
                      </button>
                    </>
                  )}

                  {isEmpty && (
                    <button
                      type="button"
                      onClick={() => {
                        // Mở wizard Tạo Banner với sortOrder = vị trí slot
                        setFormData({
                          ...defaultForm,
                          scopeType: isManager ? 'CINEMA' : 'GLOBAL',
                          sortOrder: slot.position
                        });
                        setFormErrors({});
                        setFormStep(1);
                        setModalMode('create');
                        setEditingBannerId(null);
                        setMovieSearchTerm('');
                        setFnbSearchTerm('');
                        setCustomDisplayMode('overlay');
                        setBadgeOption('Đang chiếu');
                        setCustomBadgeText('');
                        setAutoUseMovieData(true);
                        setShowAdvancedContent(false);
                        setShowModal(true);
                      }}
                      className="w-full py-1.5 bg-amber-500/15 hover:bg-amber-400 text-amber-300 hover:text-black border border-amber-500/40 text-[9.5px] font-bold uppercase tracking-wider transition flex items-center justify-center gap-1 cursor-pointer"
                    >
                      <Plus className="h-3 w-3" />
                      <span>TẠO BANNER MỚI</span>
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ========================================================
          6. MODAL TẠO / CHỈNH SỬA BANNER (MULTI-STEP WIZARD)
      ======================================================== */}
      <AnimatePresence>
        {showModal && (
          <div className="fixed inset-0 z-[150] flex items-center justify-center p-3 sm:p-5 bg-black/85 backdrop-blur-sm overflow-y-auto">
            <motion.div
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.96 }}
              transition={{ duration: 0.2 }}
              className="relative w-full max-w-5xl bg-[#0c0d12] border border-amber-500/40 shadow-2xl rounded-none flex flex-col max-h-[92vh] overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Modal Header */}
              <div className="flex items-center justify-between border-b border-white/10 px-5 py-4 bg-black">
                <div className="flex items-center gap-2.5">
                  <div className="h-8 w-8 bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
                    <Sparkles className="h-4 w-4" />
                  </div>
                  <div>
                    <h3 className="text-sm sm:text-base font-black uppercase tracking-wider text-white">
                      {modalMode === 'create' ? 'TẠO MỚI HERO BANNER' : 'CHỈNH SỬA HERO BANNER'}
                    </h3>
                    <p className="text-[10px] text-neutral-400">
                      Thiết lập nội dung, hình ảnh, phạm vi &amp; lịch trình hiển thị
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="p-1.5 text-neutral-400 hover:text-white border border-white/10 hover:border-white/30 rounded-none transition cursor-pointer"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              {/* Modal Body */}
              <div className="p-5 overflow-y-auto space-y-5 custom-scrollbar flex-1">
                <div className="space-y-4">
                  {/* Choose Banner Type - Exactly 3 Types in 1 Row on Desktop (Section 1, 40) */}
                  <div>
                      <label className="block text-[11px] font-mono uppercase tracking-wider text-neutral-300 font-bold mb-2">
                        Loại Hero Banner <span className="text-amber-400">*</span>
                      </label>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        {CREATE_BANNER_TYPES.map((t) => {
                          const Icon = t.icon;
                          const isSelected = formData.type === t.value;
                          return (
                            <button
                              key={t.value}
                              type="button"
                              onClick={() => handleTypeChange(t.value)}
                              className={`p-3.5 border text-left flex flex-col justify-between h-[88px] transition rounded-none cursor-pointer ${
                                isSelected
                                  ? 'border-amber-400 bg-amber-500/10 text-white shadow-[0_0_14px_rgba(247,198,0,0.25)]'
                                  : 'border-white/10 bg-black/40 text-neutral-400 hover:border-white/30 hover:text-white'
                              }`}
                            >
                              <div className="flex items-center justify-between">
                                <span className={`text-xs font-black uppercase tracking-wider flex items-center gap-1.5 ${isSelected ? 'text-[#F7C600]' : 'text-white'}`}>
                                  <Icon className="h-4 w-4" />
                                  {t.label}
                                </span>
                                {isSelected && (
                                  <span className="w-2 h-2 rounded-full bg-amber-400 shadow-[0_0_8px_#F7C600]"></span>
                                )}
                              </div>
                              <span className="text-[10.5px] text-neutral-400 leading-snug line-clamp-2">
                                {t.subtitle}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Bố cục 2 cột đồng bộ: Trái = Thông tin & Nội dung, Phải = Hình ảnh & CTA */}
                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
                      {/* CỘT TRÁI (col-span-12 lg:col-span-6): THÔNG TIN & NỘI DUNG */}
                      <div className="lg:col-span-6 space-y-4">

                        {/* ═══ TYPE 1: PHIM ĐIỆN ẢNH (CONDITIONAL FORM - SECTIONS 5-14) ═══ */}
                        {formData.type === 'MOVIE' && (
                          <div className="p-4 bg-neutral-950 border border-white/10 space-y-3.5">
                            <div className="flex items-center justify-between pb-2 border-b border-white/10">
                              <label className="text-xs font-mono uppercase tracking-wider text-amber-400 font-bold flex items-center gap-1.5">
                                <Film className="h-4 w-4" /> Phim liên kết &amp; Nội dung
                              </label>
                              <span className="text-[10px] text-neutral-400 font-mono">Thông tin phim</span>
                            </div>

                            {/* Searchable Movie Selector */}
                            <div className="space-y-1.5">
                              <label className="block text-[10px] font-mono uppercase tracking-wider text-neutral-300 font-bold">
                                Chọn phim từ hệ thống <span className="text-amber-400">*</span>
                              </label>

                              <div className="relative">
                                <div className="relative">
                                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-neutral-400 pointer-events-none z-10" />
                                  <input
                                    type="text"
                                    value={movieSearchTerm || (selectedMovieObj && !movieInputFocused ? selectedMovieObj.title : '')}
                                    onChange={(e) => {
                                      setMovieSearchTerm(e.target.value);
                                      if (!e.target.value) {
                                        setFormData(prev => ({
                                          ...prev,
                                          linkedMovieId: '',
                                          desktopImageUrl: '',
                                          mobileImageUrl: '',
                                          name: '',
                                          title: '',
                                          primaryCtaUrl: ''
                                        }));
                                      }
                                    }}
                                    onFocus={(e) => {
                                      e.target.select();
                                      setMovieSearchTerm('');
                                      setMovieInputFocused(true);
                                    }}
                                    onBlur={() => {
                                      setTimeout(() => setMovieInputFocused(false), 150);
                                    }}
                                    placeholder="🔍 Tìm phim theo tên tiếng Việt, tựa gốc, mã..."
                                    className={`w-full pl-9 pr-10 py-2 bg-black border text-xs text-white rounded-none focus:outline-none ${
                                      formErrors.linkedMovieId ? 'border-rose-500' : 'border-white/15 focus:border-amber-400'
                                    }`}
                                    autoComplete="off"
                                  />
                                  {(movieSearchTerm || formData.linkedMovieId) && (
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setMovieSearchTerm('');
                                        setFormData(prev => ({
                                          ...prev,
                                          linkedMovieId: '',
                                          desktopImageUrl: '',
                                          mobileImageUrl: '',
                                          name: '',
                                          title: '',
                                          primaryCtaUrl: ''
                                        }));
                                      }}
                                      className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-500 hover:text-white transition"
                                    >
                                      <X className="h-3.5 w-3.5" />
                                    </button>
                                  )}
                                </div>

                                {/* Dropdown gợi ý: hiện khi focus hoặc tìm kiếm */}
                                {movieInputFocused && filteredMoviesForSelect.length > 0 && (
                                  <div className="absolute z-50 left-0 right-0 top-full mt-0.5 bg-neutral-950 border border-amber-500/40 shadow-2xl max-h-60 overflow-y-auto">
                                    {!movieSearchTerm.trim() && (
                                      <div className="px-3 py-1.5 text-[9px] font-mono text-neutral-500 uppercase tracking-wider border-b border-white/10">
                                        Gợi ý — {filteredMoviesForSelect.length} phim trong hệ thống
                                      </div>
                                    )}
                                    {filteredMoviesForSelect.slice(0, 25).map(m => {
                                      const mId = String(m.backendId || m.id);
                                      const existingBanner = publishedMovieIdsMap.get(mId);
                                      const isAlreadyPublished = Boolean(existingBanner);
                                      const isCurrentSelected = String(formData.linkedMovieId) === mId;

                                      return (
                                        <button
                                          key={mId}
                                          type="button"
                                          disabled={isAlreadyPublished}
                                          onMouseDown={(e) => e.preventDefault()}
                                          onClick={() => {
                                            if (isAlreadyPublished) return;
                                            handleSelectMovieInForm(m.backendId || m.id);
                                            setMovieSearchTerm('');
                                            setMovieInputFocused(false);
                                          }}
                                          className={`w-full flex items-center gap-2.5 px-3 py-2 text-left border-b border-white/5 last:border-0 transition ${
                                            isAlreadyPublished
                                              ? 'opacity-40 bg-black/40 cursor-not-allowed hover:bg-black/40'
                                              : isCurrentSelected
                                                ? 'bg-amber-500/15 border-l-2 border-l-amber-400 cursor-pointer'
                                                : 'hover:bg-amber-500/10 cursor-pointer'
                                          }`}
                                          title={isAlreadyPublished ? `Phim này đã có Banner "${existingBanner.name || existingBanner.title}", không thể chọn trùng!` : ''}
                                        >
                                          {(m.posterUrl || m.avatarUrl) ? (
                                            <img src={m.posterUrl || m.avatarUrl} alt={m.title} className={`w-7 h-9 object-cover shrink-0 border border-white/10 ${isAlreadyPublished ? 'grayscale' : ''}`} />
                                          ) : (
                                            <div className="w-7 h-9 bg-neutral-900 shrink-0 flex items-center justify-center border border-white/10">
                                              <Film className="h-3 w-3 text-neutral-600" />
                                            </div>
                                          )}
                                          <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2">
                                              <div className={`text-[11px] font-bold truncate ${isAlreadyPublished ? 'text-neutral-500 line-through' : 'text-white'}`}>
                                                {m.title}
                                              </div>
                                              {isAlreadyPublished && (
                                                <span className="shrink-0 text-[8.5px] font-mono font-bold px-1.5 py-0.2 bg-rose-500/15 text-rose-400 border border-rose-500/30">
                                                  ĐÃ ĐĂNG
                                                </span>
                                              )}
                                            </div>
                                            <div className="text-[9.5px] text-neutral-400 font-mono mt-0.5">
                                              {m.duration ? `${m.duration}p` : '?p'} • {m.ageRating || 'P'} •{' '}
                                              <span className={m.isNowShowing || m.status === 'NOW_SHOWING' ? 'text-emerald-400' : 'text-amber-400'}>
                                                {m.isNowShowing || m.status === 'NOW_SHOWING' ? 'ĐANG CHIẾU' : 'SẮP CHIẾU'}
                                              </span>
                                            </div>
                                          </div>
                                          {isCurrentSelected && (
                                            <Check className="h-3.5 w-3.5 text-amber-400 shrink-0" />
                                          )}
                                        </button>
                                      );
                                    })}
                                    {filteredMoviesForSelect.length > 25 && (
                                      <div className="px-3 py-1.5 text-[9.5px] text-neutral-500 font-mono border-t border-white/10">
                                        Còn {filteredMoviesForSelect.length - 25} phim khác — hãy nhập cụ thể hơn
                                      </div>
                                    )}
                                  </div>
                                )}

                                {movieInputFocused && movieSearchTerm.trim() && filteredMoviesForSelect.length === 0 && (
                                  <div className="absolute z-50 left-0 right-0 top-full mt-0.5 bg-neutral-950 border border-white/15 px-3 py-2.5 text-[10.5px] text-neutral-500">
                                    Không tìm thấy phim nào cho "<span className="text-white">{movieSearchTerm}</span>"
                                  </div>
                                )}
                              </div>
                              {formErrors.linkedMovieId && (
                                <p className="text-[10px] text-rose-400 font-mono">{formErrors.linkedMovieId}</p>
                              )}

                              {/* Compact Movie Preview Card */}
                              {selectedMovieObj && (
                                <div className="flex items-center gap-3 p-2 bg-neutral-900 border border-white/10 mt-1.5">
                                  <div className="w-10 h-14 bg-neutral-950 border border-white/15 shrink-0 overflow-hidden">
                                    {selectedMovieObj.posterUrl || selectedMovieObj.avatarUrl ? (
                                      <img
                                        src={selectedMovieObj.posterUrl || selectedMovieObj.avatarUrl}
                                        alt={selectedMovieObj.title}
                                        className="w-full h-full object-cover"
                                      />
                                    ) : (
                                      <div className="w-full h-full flex items-center justify-center text-[9px] text-neutral-500">NO IMG</div>
                                    )}
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2">
                                      <h4 className="text-xs font-bold text-white uppercase truncate">
                                        {selectedMovieObj.title}
                                      </h4>
                                      <span className={`text-[8.5px] font-bold px-1.5 py-0.5 border ${
                                        selectedMovieObj.isNowShowing || selectedMovieObj.status === 'NOW_SHOWING'
                                          ? 'text-emerald-400 border-emerald-500/30 bg-emerald-500/10'
                                          : 'text-amber-400 border-amber-500/30 bg-amber-500/10'
                                      }`}>
                                        {selectedMovieObj.isNowShowing || selectedMovieObj.status === 'NOW_SHOWING' ? 'ĐANG CHIẾU' : 'SẮP CHIẾU'}
                                      </span>
                                    </div>
                                    <div className="text-[10px] text-neutral-400 mt-0.5 flex items-center gap-2 font-mono">
                                      <span>{selectedMovieObj.duration ? `${selectedMovieObj.duration}p` : 'Đang cập nhật'}</span>
                                      <span>•</span>
                                      <span className="text-amber-400 font-bold">{selectedMovieObj.ageRating || 'P'}</span>
                                      <span>•</span>
                                      <span className="truncate">{selectedMovieObj.genre || selectedMovieObj.genres || 'Điện ảnh'}</span>
                                    </div>
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>
                        )}

                    {/* ═══ TYPE 2: BẮP NƯỚC & F&B (CONDITIONAL FORM - SECTIONS 15-19) ═══ */}
                    {formData.type === 'FNB' && (
                      <div className="space-y-3.5">
                        {/* Searchable F&B Selector */}
                        <div className="p-3.5 bg-black/70 border border-amber-500/30 rounded-none space-y-2.5">
                          <label className="block text-[11px] font-mono uppercase tracking-wider text-amber-300 font-bold">
                            Chọn sản phẩm / combo F&B <span className="text-amber-400">*</span>
                          </label>

                          <div className="flex flex-col sm:flex-row gap-2">
                            <div className="relative flex-1">
                              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-neutral-400" />
                              <input
                                type="text"
                                value={fnbSearchTerm}
                                onChange={(e) => setFnbSearchTerm(e.target.value)}
                                placeholder="🔍 Tìm bắp nước, combo, nước ngọt..."
                                className="w-full pl-9 pr-3 py-2 bg-neutral-950 border border-white/15 focus:border-amber-400 text-xs text-white rounded-none focus:outline-none"
                              />
                            </div>

                            <select
                              value={formData.linkedFnbId || ''}
                              onChange={(e) => handleSelectFnbInForm(e.target.value)}
                              className={`flex-1 px-3 py-2 bg-neutral-950 border text-xs text-white rounded-none focus:outline-none ${
                                formErrors.linkedFnbId ? 'border-rose-500' : 'border-white/15 focus:border-amber-400'
                              }`}
                            >
                              <option value="">-- Danh sách sản phẩm / combo ({filteredFnbForSelect.length} mục) --</option>
                              {filteredFnbForSelect.map(f => (
                                <option key={f.id} value={f.id}>
                                  {f.name} {f.price ? `(${new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(f.price)})` : ''} [{f.fnbType === 'COMBO' ? 'COMBO' : 'MÓN LẺ'}]
                                </option>
                              ))}
                            </select>
                          </div>
                          {formErrors.linkedFnbId && (
                            <p className="text-[10px] text-rose-400 font-mono">{formErrors.linkedFnbId}</p>
                          )}

                          {/* Compact F&B Preview Card */}
                          {selectedFnbObj && (
                            <div className="flex items-center gap-3 p-2.5 bg-neutral-900/80 border border-white/10 mt-2">
                              <div className="w-14 h-14 bg-neutral-950 border border-white/15 shrink-0 overflow-hidden flex items-center justify-center">
                                {selectedFnbObj.imageUrl || selectedFnbObj.image ? (
                                  <img
                                    src={selectedFnbObj.imageUrl || selectedFnbObj.image}
                                    alt={selectedFnbObj.name}
                                    className="w-full h-full object-cover"
                                  />
                                ) : (
                                  <Sparkles className="h-6 w-6 text-amber-400" />
                                )}
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                  <h4 className="text-xs font-bold text-white uppercase truncate">
                                    {selectedFnbObj.name}
                                  </h4>
                                  <span className="text-[9px] font-bold px-1.5 py-0.2 border text-emerald-400 border-emerald-500/30 bg-emerald-500/10">
                                    {selectedFnbObj.fnbType === 'COMBO' ? 'COMBO ĐẶC BIỆT' : 'SẢN PHẨM'}
                                  </span>
                                </div>
                                <div className="text-[10.5px] text-neutral-400 mt-0.5 flex items-center gap-2">
                                  {selectedFnbObj.price && (
                                    <span className="text-[#F7C600] font-mono font-bold">
                                      {new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(selectedFnbObj.price)}
                                    </span>
                                  )}
                                  <span>•</span>
                                  <span>{selectedFnbObj.description || 'Ưu đãi bắp nước'}</span>
                                </div>
                              </div>
                            </div>
                          )}

                          {/* Inventory / Out-of-stock Notice (Section 19) */}
                          {selectedFnbObj && selectedFnbObj.available === false && (
                            <div className="p-2 bg-amber-500/10 border border-amber-500/30 text-amber-300 text-[10.5px] flex items-center gap-2">
                              <AlertTriangle className="h-3.5 w-3.5 text-amber-400 shrink-0" />
                              <span>Sản phẩm này có thể đang hết hàng tại một số cụm rạp.</span>
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {/* ═══ TYPE 3: BANNER TÙY CHỈNH ═══ */}
                    {formData.type === 'CUSTOM' && (
                      <div className="space-y-3.5">
                        <div>
                          <label className="block text-[10px] font-mono uppercase tracking-wider text-neutral-300 mb-1 font-bold">
                            Tên Banner <span className="text-amber-400">*</span>
                          </label>
                          <input
                            type="text"
                            value={formData.name}
                            onChange={(e) => setFormData({ ...formData, name: e.target.value, title: '' })}
                            placeholder="Ví dụ: Chiến dịch mùa hè CinePremier"
                            className="w-full px-3 py-2 bg-black border border-white/10 focus:border-amber-400 text-xs text-white rounded-none focus:outline-none"
                          />
                          {formErrors.name && <p className="text-[10px] text-rose-400 mt-1">{formErrors.name}</p>}
                        </div>
                      </div>
                    )}
                      </div>

                      {/* CỘT PHẢI (col-span-12 lg:col-span-6): HÌNH ẢNH & ĐIỀU HƯỚNG */}
                      <div className="lg:col-span-6">
                        <div className="p-4 bg-neutral-950 border border-white/10 space-y-3.5">
                          <div className="flex items-center justify-between pb-2 border-b border-white/10">
                            <span className="text-xs font-mono uppercase tracking-wider text-amber-400 font-bold flex items-center gap-1.5">
                              <ImageIcon className="h-4 w-4" /> Ảnh Banner (1920×600) &amp; Điều hướng
                            </span>
                            {/* Quick Button: Dùng ảnh gốc từ phim / F&B */}
                            {formData.type === 'MOVIE' && selectedMovieObj && (
                              <button
                                type="button"
                                onClick={() => {
                                  const backdrop = selectedMovieObj.avatarUrl || selectedMovieObj.bannerUrl || selectedMovieObj.posterUrl || '';
                                  setFormData(prev => ({
                                    ...prev,
                                    desktopImageUrl: backdrop,
                                    mobileImageUrl: backdrop
                                  }));
                                  showToast('Đã áp dụng ảnh gốc từ phim!');
                                }}
                                className="px-2.5 py-1 bg-amber-400 hover:bg-amber-300 text-black text-[10px] font-bold uppercase transition rounded-none cursor-pointer"
                              >
                                📸 Dùng ảnh phim
                              </button>
                            )}
                            {formData.type === 'FNB' && selectedFnbObj && (
                              <button
                                type="button"
                                onClick={() => {
                                  const img = selectedFnbObj.imageUrl || selectedFnbObj.image || '';
                                  setFormData(prev => ({
                                    ...prev,
                                    desktopImageUrl: img,
                                    mobileImageUrl: img
                                  }));
                                  showToast('Đã áp dụng ảnh gốc của F&B!');
                                }}
                                className="px-2.5 py-1 bg-emerald-400 hover:bg-emerald-300 text-black text-[10px] font-bold uppercase transition rounded-none cursor-pointer"
                              >
                                📸 Dùng ảnh F&B
                              </button>
                            )}
                          </div>

                          {/* Universal Banner Image (1920x600) */}
                          {formData.type === 'MOVIE' && !selectedMovieObj ? (
                            <div className="py-12 px-4 border border-dashed border-amber-500/20 bg-black/40 text-center flex flex-col items-center justify-center">
                              <div className="w-12 h-12 bg-amber-500/10 border border-amber-500/30 flex items-center justify-center mb-3">
                                <Film className="h-6 w-6 text-amber-400" />
                              </div>
                              <h4 className="text-xs font-bold text-amber-300 uppercase tracking-wider">
                                Vui lòng chọn phim trước
                              </h4>
                              <p className="text-[11px] text-neutral-400 mt-1.5 max-w-xs leading-relaxed">
                                Chọn một bộ phim ở cột bên trái để hiển thị khu vực chỉnh sửa và thêm ảnh banner (1920×600).
                              </p>
                            </div>
                          ) : formData.type === 'FNB' && !selectedFnbObj ? (
                            <div className="py-12 px-4 border border-dashed border-emerald-500/20 bg-black/40 text-center flex flex-col items-center justify-center">
                              <div className="w-12 h-12 bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center mb-3">
                                <Sparkles className="h-6 w-6 text-emerald-400" />
                              </div>
                              <h4 className="text-xs font-bold text-emerald-300 uppercase tracking-wider">
                                Vui lòng chọn món F&B trước
                              </h4>
                              <p className="text-[11px] text-neutral-400 mt-1.5 max-w-xs leading-relaxed">
                                Chọn một sản phẩm / combo F&B ở cột bên trái để hiển thị khu vực chỉnh sửa và thêm ảnh banner.
                              </p>
                            </div>
                          ) : (
                            <div className="space-y-2">
                              <div className="relative h-36 bg-black border border-dashed border-white/20 overflow-hidden flex flex-col items-center justify-center group">
                                {formData.desktopImageUrl ? (
                                  <>
                                    <img
                                      src={formData.desktopImageUrl}
                                      alt="Banner preview"
                                      className="w-full h-full object-cover object-center"
                                    />
                                    <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center gap-2 transition">
                                      <label className="px-3 py-1.5 bg-amber-400 hover:bg-amber-300 text-black text-[11px] font-bold uppercase cursor-pointer rounded-none">
                                        Thay ảnh
                                        <input
                                          type="file"
                                          accept="image/jpeg,image/png,image/webp"
                                          className="hidden"
                                          onChange={(e) => handleUploadImage('desktopImageUrl', e.target.files?.[0])}
                                        />
                                      </label>
                                      <button
                                        type="button"
                                        onClick={() => setFormData({ ...formData, desktopImageUrl: '', mobileImageUrl: '' })}
                                        className="px-3 py-1.5 bg-rose-600 hover:bg-rose-500 text-white text-[11px] font-bold uppercase rounded-none cursor-pointer"
                                      >
                                        Xóa
                                      </button>
                                    </div>
                                  </>
                                ) : (
                                  <label className="flex flex-col items-center gap-1.5 cursor-pointer text-center p-3">
                                    {uploadingDesktop ? (
                                      <RefreshCw className="h-6 w-6 animate-spin text-amber-400" />
                                    ) : (
                                      <ImageIcon className="h-6 w-6 text-neutral-500" />
                                    )}
                                    <span className="text-xs font-bold text-neutral-300">Tải lên ảnh Banner (1920×600)</span>
                                    <span className="text-[9px] font-mono text-neutral-500">
                                      JPG, PNG, WEBP tối đa 5MB
                                    </span>
                                    <input
                                      type="file"
                                      accept="image/jpeg,image/png,image/webp"
                                      className="hidden"
                                      onChange={(e) => handleUploadImage('desktopImageUrl', e.target.files?.[0])}
                                    />
                                  </label>
                                )}
                              </div>
                              <input
                                type="text"
                                value={formData.desktopImageUrl}
                                onChange={(e) => setFormData({ ...formData, desktopImageUrl: e.target.value, mobileImageUrl: e.target.value })}
                                placeholder="Hoặc dán trực tiếp link URL ảnh banner 1920x600..."
                                className="w-full px-3 py-1.5 bg-black border border-white/10 text-xs text-white rounded-none focus:border-amber-400 focus:outline-none font-mono"
                              />
                              {formErrors.desktopImageUrl && (
                                <p className="text-[10px] text-rose-400 font-mono">{formErrors.desktopImageUrl}</p>
                              )}
                            </div>
                          )}

                          {/* BANNER CLICK DESTINATION / ĐIỀU HƯỚNG KHI BẤM BANNER */}
                          <div className="space-y-1.5 pt-2 border-t border-white/10">
                            <div className="flex items-center justify-between">
                              <label className="text-[10px] font-mono uppercase tracking-wider text-amber-400 font-bold flex items-center gap-1.5">
                                🔗 Điều hướng khi nhấp Banner
                              </label>
                              <span className="text-[9.5px] text-neutral-400 font-mono truncate max-w-[200px]">
                                {formData.type === 'MOVIE' && (
                                  <>Mặc định: <span className="text-amber-300">{selectedMovieObj ? `/movies/${selectedMovieObj.backendId || selectedMovieObj.id}` : '/movies/:id'}</span></>
                                )}
                                {formData.type === 'FNB' && (
                                  <>Mặc định: <span className="text-emerald-300">/concessions</span></>
                                )}
                                {formData.type === 'CUSTOM' && (
                                  <span className="text-amber-400 font-bold">* Bắt buộc</span>
                                )}
                              </span>
                            </div>
                            <input
                              type="text"
                              value={formData.primaryCtaUrl}
                              onChange={(e) => setFormData({ ...formData, primaryCtaUrl: e.target.value })}
                              placeholder={
                                formData.type === 'MOVIE'
                                  ? (selectedMovieObj ? `/movies/${selectedMovieObj.backendId || selectedMovieObj.id} (Tùy chọn - để trống dùng mặc định)` : 'Mặc định: /movies/:id (Tùy chọn - để trống dùng mặc định)')
                                  : formData.type === 'FNB'
                                    ? '/concessions (Tùy chọn - để trống dùng mặc định)'
                                    : 'Ví dụ: /promotions/uu-dai hoặc https://...'
                              }
                              className="w-full px-3 py-2 bg-black border border-white/15 text-xs text-white rounded-none font-mono focus:border-amber-400 focus:outline-none"
                            />
                            {formErrors.primaryCtaUrl && (
                              <p className="text-[10px] text-rose-400 mt-0.5">{formErrors.primaryCtaUrl}</p>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* ========================================================
                        LỊCH TRÌNH & THỜI GIAN TRÌNH CHIẾU BANNER (1 HÀNG 3 CHỨC NĂNG)
                    ======================================================== */}
                    <div className="p-3.5 bg-neutral-950 border border-white/10 mt-3">
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5 items-end">
                        {/* 1. Bắt đầu */}
                        <div>
                          <CalendarDateTimePicker
                            label="Thời gian bắt đầu"
                            helperText="(Trống = Ngay khi xuất bản)"
                            value={formData.startAt}
                            onChange={(val) => setFormData(prev => ({ ...prev, startAt: val }))}
                          />
                        </div>

                        {/* 2. Kết thúc */}
                        <div>
                          <CalendarDateTimePicker
                            label="Thời gian kết thúc"
                            helperText="(Trống = Không giới hạn)"
                            value={formData.endAt}
                            minDateStr={formData.startAt ? formData.startAt.split('T')[0] : null}
                            onChange={(val) => setFormData(prev => ({ ...prev, endAt: val }))}
                            isEnd={true}
                          />
                          {formErrors.endAt && <p className="text-[10px] text-rose-400 mt-1">{formErrors.endAt}</p>}
                        </div>

                        {/* 3. Thời gian chuyển slide */}
                        <div>
                          <div className="flex items-center justify-between mb-1.5">
                            <label className="text-[10px] font-mono uppercase text-neutral-300 font-bold">
                              Thời gian slide
                            </label>
                            <span className="font-mono font-bold text-amber-400 text-xs bg-amber-500/10 px-2 py-0.5 border border-amber-500/20">
                              {formData.slideDurationSeconds}s
                            </span>
                          </div>
                          <div className="flex items-center h-[37px] px-2 bg-black border border-white/15">
                            <input
                              type="range"
                              min="4"
                              max="10"
                              value={formData.slideDurationSeconds}
                              onChange={(e) => setFormData({ ...formData, slideDurationSeconds: Number(e.target.value) })}
                              className="w-full accent-amber-400 cursor-pointer"
                            />
                          </div>
                        </div>
                      </div>
                    </div>

                  </div>
                </div>

              {/* Modal Footer Controls */}
              <div className="border-t border-white/10 bg-black px-5 py-3.5 flex items-center justify-between flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 border border-white/15 bg-neutral-900 text-neutral-300 hover:text-white text-xs font-bold uppercase rounded-none transition cursor-pointer"
                >
                  HỦY BỎ
                </button>

                <div className="flex items-center gap-2.5">
                  <button
                    type="button"
                    disabled={submitting}
                    onClick={() => handleSubmitForm(false)}
                    className="px-4 py-2 border border-white/20 bg-neutral-900 text-neutral-300 hover:text-white text-xs font-bold uppercase rounded-none transition disabled:opacity-50 cursor-pointer"
                  >
                    {submitting ? 'ĐANG LƯU...' : 'LƯU BẢN NHÁP'}
                  </button>

                  <button
                    type="button"
                    disabled={submitting}
                    onClick={() => handleSubmitForm(true)}
                    className="px-5 py-2 bg-[#F7C600] hover:bg-[#ffd633] text-black text-xs font-black uppercase tracking-wider rounded-none transition shadow-[0_0_16px_rgba(247,198,0,0.35)] disabled:opacity-50 cursor-pointer"
                  >
                    {submitting
                      ? 'ĐANG XỬ LÝ...'
                      : (formData.startAt && new Date(formData.startAt) > new Date())
                        ? 'LÊN LỊCH CHIẾN DỊCH'
                        : 'XUẤT BẢN NGAY'}
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ========================================================
          6.5. MODAL GÁN BANNER VÀO HERO SLOT (SECTIONS 70, 75, 99)
      ======================================================== */}
      <AnimatePresence>
        {showAssignBannerModal && (
          <div className="fixed inset-0 z-[155] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="relative w-full max-w-2xl bg-[#0c0d12] border border-amber-500/40 shadow-2xl p-5 space-y-4"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between border-b border-white/10 pb-3">
                <div className="flex items-center gap-2">
                  <Layers className="h-4 w-4 text-[#F7C600]" />
                  <h3 className="text-sm font-black uppercase tracking-wider text-white">
                    GÁN BANNER VÀO SLOT #{assigningSlotPosition}
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setShowAssignBannerModal(false);
                    setAssigningSlotPosition(null);
                  }}
                  className="p-1 text-neutral-400 hover:text-white"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <p className="text-xs text-neutral-300">
                Chọn một banner từ thư viện để hiển thị cố định tại vị trí này trên Hero Carousel. Vị trí này sẽ chuyển sang trạng thái <strong>THỦ CÔNG (MANUAL)</strong> và được bảo vệ khỏi Auto-fill.
              </p>

              <div className="max-h-72 overflow-y-auto space-y-2 pr-1 custom-scrollbar">
                {banners.length === 0 ? (
                  <div className="p-6 text-center text-xs text-neutral-500">
                    Chưa có banner nào trong hệ thống. Vui lòng tạo banner mới trước.
                  </div>
                ) : (
                  banners.map((b) => (
                    <div
                      key={b.id}
                      className="p-3 bg-black/60 border border-white/10 hover:border-amber-400/50 flex items-center justify-between gap-3 transition"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-24 aspect-[1920/600] bg-neutral-900 border border-white/10 overflow-hidden shrink-0">
                          {b.desktopImageUrl ? (
                            <img src={b.desktopImageUrl} alt={b.title} className="w-full h-full object-cover object-center" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-[9px] text-neutral-600">NO IMG</div>
                          )}
                        </div>
                        <div className="min-w-0">
                          <h4 className="text-xs font-bold text-white uppercase truncate">{b.title || b.name}</h4>
                          <div className="text-[10px] text-neutral-400 flex items-center gap-2 mt-0.5">
                            <span>{b.type}</span>
                            <span>•</span>
                            <span className={b.status === 'PUBLISHED' ? 'text-emerald-400 font-bold' : 'text-neutral-500'}>{b.status}</span>
                          </div>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleAssignBannerToSlot(b.id)}
                        className="px-3 py-1.5 bg-[#F7C600] hover:bg-amber-300 text-black text-[10.5px] font-black uppercase tracking-wider rounded-none shrink-0 transition cursor-pointer"
                      >
                        GÁN VÀO SLOT #{assigningSlotPosition}
                      </button>
                    </div>
                  ))
                )}
              </div>

              <div className="pt-2 border-t border-white/10 flex justify-end">
                <button
                  type="button"
                  onClick={() => {
                    setShowAssignBannerModal(false);
                    setAssigningSlotPosition(null);
                  }}
                  className="px-4 py-1.5 border border-white/20 text-neutral-300 hover:text-white text-xs font-bold uppercase transition"
                >
                  ĐÓNG
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ========================================================
          7. FULL PREVIEW MODAL (DESKTOP / TABLET / MOBILE)
      ======================================================== */}
      <AnimatePresence>
        {showPreviewModal && previewingBanner && (
          <div className="fixed inset-0 z-[160] flex items-center justify-center p-3 sm:p-6 bg-black/90 backdrop-blur-md">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="relative w-full max-w-6xl bg-[#0c0d12] border border-amber-500/40 rounded-none shadow-2xl p-4 sm:p-6 space-y-4"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between border-b border-white/10 pb-3">
                <div className="flex items-center gap-3">
                  <h3 className="text-sm font-black uppercase tracking-wider text-white">
                    MÔ PHỎNG HIỂN THỊ HERO CAROUSEL: <span className="text-amber-400">{previewingBanner.title}</span>
                  </h3>
                </div>

                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-1 bg-black p-1 border border-white/10">
                    <button
                      type="button"
                      onClick={() => setPreviewDevice('desktop')}
                      className={`px-2.5 py-1 text-xs font-bold uppercase transition ${previewDevice === 'desktop' ? 'bg-amber-400 text-black' : 'text-neutral-400'}`}
                    >
                      <Monitor className="h-3.5 w-3.5 inline mr-1" /> Desktop
                    </button>
                    <button
                      type="button"
                      onClick={() => setPreviewDevice('mobile')}
                      className={`px-2.5 py-1 text-xs font-bold uppercase transition ${previewDevice === 'mobile' ? 'bg-amber-400 text-black' : 'text-neutral-400'}`}
                    >
                      <Smartphone className="h-3.5 w-3.5 inline mr-1" /> Mobile
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={() => setShowPreviewModal(false)}
                    className="p-1.5 text-neutral-400 hover:text-white border border-white/10 rounded-none"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              </div>

              {/* Viewport simulation container */}
              <div className="flex justify-center bg-black/90 p-4 border border-white/5 min-h-[300px] overflow-hidden">
                <div className={`transition-all duration-300 w-full ${
                  previewDevice === 'mobile' ? 'max-w-[430px]' : 'max-w-full'
                }`}>
                  <HeroBannerCarousel
                    banners={[{
                      id: previewingBanner.id,
                      type: previewingBanner.type,
                      title: previewingBanner.title,
                      subtitle: previewingBanner.subtitle,
                      badge: previewingBanner.badge,
                      format: previewingBanner.formatLabel,
                      imageDesktop: previewingBanner.desktopImageUrl,
                      imageMobile: previewingBanner.mobileImageUrl || previewingBanner.desktopImageUrl,
                      ctaLabel: previewingBanner.primaryCtaLabel,
                      ctaUrl: previewingBanner.primaryCtaUrl,
                      secondaryCtaLabel: previewingBanner.secondaryCtaLabel,
                      secondaryCtaUrl: previewingBanner.secondaryCtaUrl
                    }]}
                  />
                </div>
              </div>

              <div className="flex items-center justify-between text-[11px] font-mono text-neutral-400 pt-2 border-t border-white/10">
                <span>Trạng thái: <strong className="text-white">{previewingBanner.status}</strong></span>
                <span>Phạm vi: <strong className="text-white">{previewingBanner.scopeType}</strong></span>
                <span>Thời lượng chuyển slide: <strong className="text-amber-400">{previewingBanner.slideDurationSeconds} giây</strong></span>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}