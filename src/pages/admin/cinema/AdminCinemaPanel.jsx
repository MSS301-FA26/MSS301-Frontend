import React, { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import * as THREE from 'three';
import {
  Building2, Plus, Edit3, Trash2, Power, RefreshCw, Save,
  MapPin, Phone, Globe2, ShieldCheck, CheckCircle2, AlertCircle,
  Search, X, Sparkles, Layers, Info, Loader2, Navigation, Check,
  Maximize2, Minimize2, Eye, EyeOff, Compass, Film
} from 'lucide-react';
import { adminService } from '../../../services/adminService';
import {
  getGhnProvinces,
  getGhnDistricts,
  getGhnWards
} from '../../../services/ghnService';

// =============================================================================
// GIS PROJECTION & VIETNAM GEOGRAPHIC DATA CONSTANTS
// =============================================================================

function gisToWorld(lon, lat) {
  const x = (lon - 106.1) * 14.2;
  const z = (16.0 - lat) * 14.2;
  return { x, z };
}

const VIETNAM_MAINLAND_GIS = [
  [105.32, 23.38], [105.85, 23.15], [106.58, 22.85], [106.82, 22.45],
  [107.52, 21.65], [107.98, 21.52], [107.25, 20.92], [106.72, 20.75],
  [106.58, 20.25], [106.12, 19.95], [105.85, 19.35], [105.68, 18.75],
  [106.05, 18.22], [106.48, 17.65], [107.12, 16.95], [107.65, 16.45],
  [108.22, 16.08], [108.65, 15.48], [108.92, 14.85], [109.25, 14.12],
  [109.32, 13.35], [109.45, 12.65], [109.22, 11.88], [108.85, 11.35],
  [108.15, 10.92], [107.52, 10.52], [107.08, 10.35], [106.78, 9.95],
  [106.35, 9.45],  [105.75, 9.05],  [105.15, 8.62],  [104.78, 8.58],
  [104.82, 9.18],  [105.05, 9.75],  [104.48, 10.38], [105.08, 10.82],
  [105.55, 10.98], [105.92, 11.48], [106.15, 11.95], [106.62, 11.88],
  [107.28, 12.25], [107.55, 13.15], [107.42, 14.05], [107.52, 14.68],
  [107.18, 15.52], [106.58, 16.32], [105.82, 17.25], [105.18, 18.08],
  [104.65, 18.85], [104.05, 19.35], [104.82, 19.85], [104.42, 20.45],
  [103.52, 20.92], [102.82, 21.45], [102.18, 22.38], [102.75, 22.75],
  [103.85, 22.82], [104.68, 23.08]
];

function isPointInPolygon(lon, lat, polygon) {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i][0], yi = polygon[i][1];
    const xj = polygon[j][0], yj = polygon[j][1];
    const intersect = ((yi > lat) !== (yj > lat)) &&
      (lon < (xj - xi) * (lat - yi) / (yj - yi + 0.00001) + xi);
    if (intersect) inside = !inside;
  }
  return inside;
}

// Comprehensive 63 Provinces & Cities GIS Coordinates of Vietnam
const VIETNAM_PROVINCES_GIS = {
  // ── ĐỒNG BẰNG SÔNG HỒNG & ĐÔNG BẮC / TÂY BẮC (MIỀN BẮC) ─────────────────────
  "HÀ NỘI":          { lon: 105.84, lat: 21.03, region: "MIỀN BẮC", archType: "TWIN" },
  "HANOI":           { lon: 105.84, lat: 21.03, region: "MIỀN BẮC", archType: "TWIN" },
  "HẢI PHÒNG":       { lon: 106.68, lat: 20.86, region: "MIỀN BẮC", archType: "ROYAL" },
  "QUẢNG NINH":      { lon: 107.07, lat: 20.95, region: "MIỀN BẮC", archType: "DOME" },
  "BẮC NINH":        { lon: 106.07, lat: 21.18, region: "MIỀN BẮC", archType: "TWIN" },
  "BẮC GIANG":       { lon: 106.20, lat: 21.27, region: "MIỀN BẮC", archType: "TWIN" },
  "HẢI DƯƠNG":       { lon: 106.32, lat: 20.94, region: "MIỀN BẮC", archType: "ROYAL" },
  "HƯNG YÊN":        { lon: 106.05, lat: 20.65, region: "MIỀN BẮC", archType: "ROYAL" },
  "HÀ NAM":          { lon: 105.92, lat: 20.54, region: "MIỀN BẮC", archType: "ROYAL" },
  "NAM ĐỊNH":        { lon: 106.17, lat: 20.43, region: "MIỀN BẮC", archType: "ROYAL" },
  "THÁI BÌNH":       { lon: 106.34, lat: 20.45, region: "MIỀN BẮC", archType: "ROYAL" },
  "NINH BÌNH":       { lon: 105.97, lat: 20.25, region: "MIỀN BẮC", archType: "ROYAL" },
  "VĨNH PHÚC":       { lon: 105.60, lat: 21.31, region: "MIỀN BẮC", archType: "TWIN" },
  "PHÚ THỌ":         { lon: 105.30, lat: 21.32, region: "MIỀN BẮC", archType: "TWIN" },
  "THÁI NGUYÊN":     { lon: 105.84, lat: 21.59, region: "MIỀN BẮC", archType: "TWIN" },
  "TUYÊN QUANG":     { lon: 105.21, lat: 21.82, region: "MIỀN BẮC", archType: "TWIN" },
  "HÀ GIANG":        { lon: 104.98, lat: 22.82, region: "MIỀN BẮC", archType: "TWIN" },
  "CAO BẰNG":        { lon: 106.26, lat: 22.67, region: "MIỀN BẮC", archType: "TWIN" },
  "BẮC KẠN":         { lon: 105.83, lat: 22.15, region: "MIỀN BẮC", archType: "TWIN" },
  "LẠNG SƠN":        { lon: 106.76, lat: 21.85, region: "MIỀN BẮC", archType: "TWIN" },
  "LÀO CAI":         { lon: 103.97, lat: 22.48, region: "MIỀN BẮC", archType: "TWIN" },
  "YÊN BÁI":         { lon: 104.87, lat: 21.72, region: "MIỀN BẮC", archType: "TWIN" },
  "HÒA BÌNH":        { lon: 105.34, lat: 20.82, region: "MIỀN BẮC", archType: "TWIN" },
  "SƠN LA":          { lon: 103.91, lat: 21.33, region: "MIỀN BẮC", archType: "TWIN" },
  "ĐIỆN BIÊN":       { lon: 103.02, lat: 21.39, region: "MIỀN BẮC", archType: "TWIN" },
  "LAI CHÂU":        { lon: 103.46, lat: 22.40, region: "MIỀN BẮC", archType: "TWIN" },

  // ── BẮC TRUNG BỘ & DUYÊN HẢI MIỀN TRUNG ─────────────────────────────────────
  "THANH HÓA":       { lon: 105.78, lat: 19.81, region: "MIỀN TRUNG", archType: "ROYAL" },
  "NGHỆ AN":         { lon: 105.68, lat: 18.67, region: "MIỀN TRUNG", archType: "ROYAL" },
  "HÀ TĨNH":         { lon: 105.90, lat: 18.34, region: "MIỀN TRUNG", archType: "ROYAL" },
  "QUẢNG BÌNH":      { lon: 106.60, lat: 17.47, region: "MIỀN TRUNG", archType: "ROYAL" },
  "QUẢNG TRỊ":       { lon: 107.19, lat: 16.82, region: "MIỀN TRUNG", archType: "ROYAL" },
  "THỪA THIÊN HUẾ":  { lon: 107.59, lat: 16.46, region: "MIỀN TRUNG", archType: "ROYAL" },
  "HUẾ":             { lon: 107.59, lat: 16.46, region: "MIỀN TRUNG", archType: "ROYAL" },
  "ĐÀ NẴNG":         { lon: 108.22, lat: 16.06, region: "MIỀN TRUNG", archType: "DRAGON" },
  "QUẢNG NAM":       { lon: 108.20, lat: 15.57, region: "MIỀN TRUNG", archType: "DRAGON" },
  "QUẢNG NGÃI":      { lon: 108.80, lat: 15.12, region: "MIỀN TRUNG", archType: "DOME" },
  "BÌNH ĐỊNH":       { lon: 109.05, lat: 13.78, region: "MIỀN TRUNG", archType: "DOME" },
  "PHÚ YÊN":         { lon: 109.28, lat: 13.09, region: "MIỀN TRUNG", archType: "DOME" },
  "KHÁNH HÒA":       { lon: 109.19, lat: 12.24, region: "MIỀN TRUNG", archType: "DOME" },
  "NHA TRANG":       { lon: 109.19, lat: 12.24, region: "MIỀN TRUNG", archType: "DOME" },
  "NINH THUẬN":      { lon: 108.99, lat: 11.57, region: "MIỀN TRUNG", archType: "DOME" },
  "BÌNH THUẬN":      { lon: 108.10, lat: 10.93, region: "MIỀN TRUNG", archType: "DOME" },

  // ── TÂY NGUYÊN (CENTRAL HIGHLANDS) ──────────────────────────────────────────
  "ĐẮK LẮK":         { lon: 108.05, lat: 12.68, region: "TÂY NGUYÊN", archType: "LOTUS" },
  "ĐẮC LẮC":         { lon: 108.05, lat: 12.68, region: "TÂY NGUYÊN", archType: "LOTUS" },
  "DAK LAK":         { lon: 108.05, lat: 12.68, region: "TÂY NGUYÊN", archType: "LOTUS" },
  "BUÔN MA THUỘT":   { lon: 108.05, lat: 12.68, region: "TÂY NGUYÊN", archType: "LOTUS" },
  "CƯ KUIN":         { lon: 108.08, lat: 12.58, region: "TÂY NGUYÊN", archType: "LOTUS" },
  "GIA LAI":         { lon: 108.00, lat: 13.98, region: "TÂY NGUYÊN", archType: "LOTUS" },
  "PLEIKU":          { lon: 108.00, lat: 13.98, region: "TÂY NGUYÊN", archType: "LOTUS" },
  "KON TUM":         { lon: 108.00, lat: 14.35, region: "TÂY NGUYÊN", archType: "LOTUS" },
  "ĐẮK NÔNG":        { lon: 107.69, lat: 12.00, region: "TÂY NGUYÊN", archType: "LOTUS" },
  "DAK NONG":        { lon: 107.69, lat: 12.00, region: "TÂY NGUYÊN", archType: "LOTUS" },
  "LÂM ĐỒNG":        { lon: 108.44, lat: 11.94, region: "TÂY NGUYÊN", archType: "LOTUS" },
  "ĐÀ LẠT":          { lon: 108.44, lat: 11.94, region: "TÂY NGUYÊN", archType: "LOTUS" },

  // ── ĐÔNG NAM BỘ (MIỀN NAM) ──────────────────────────────────────────────────
  "TP. HỒ CHÍ MINH": { lon: 106.70, lat: 10.78, region: "MIỀN NAM", archType: "BITEXCO" },
  "HỒ CHÍ MINH":     { lon: 106.70, lat: 10.78, region: "MIỀN NAM", archType: "BITEXCO" },
  "SÀI GÒN":         { lon: 106.70, lat: 10.78, region: "MIỀN NAM", archType: "BITEXCO" },
  "BÌNH DƯƠNG":      { lon: 106.65, lat: 10.98, region: "MIỀN NAM", archType: "LANDMARK" },
  "ĐỒNG NAI":        { lon: 106.84, lat: 10.95, region: "MIỀN NAM", archType: "LANDMARK" },
  "BÀ RỊA - VŨNG TÀU": { lon: 107.18, lat: 10.50, region: "MIỀN NAM", archType: "DOME" },
  "VŨNG TÀU":        { lon: 107.08, lat: 10.35, region: "MIỀN NAM", archType: "DOME" },
  "TÂY NINH":        { lon: 106.10, lat: 11.31, region: "MIỀN NAM", archType: "DOME" },
  "BÌNH PHƯỚC":      { lon: 106.88, lat: 11.53, region: "MIỀN NAM", archType: "DOME" },

  // ── ĐỒNG BẰNG SÔNG CỬU LONG (MIỀN TÂY) ───────────────────────────────────────
  "CẦN THƠ":         { lon: 105.78, lat: 10.03, region: "MIỀN TÂY", archType: "LOTUS" },
  "LONG AN":         { lon: 106.41, lat: 10.53, region: "MIỀN TÂY", archType: "LOTUS" },
  "TIỀN GIANG":      { lon: 106.36, lat: 10.36, region: "MIỀN TÂY", archType: "LOTUS" },
  "BẾN TRE":         { lon: 106.38, lat: 10.24, region: "MIỀN TÂY", archType: "LOTUS" },
  "TRÀ VINH":        { lon: 106.34, lat: 9.93, region: "MIỀN TÂY", archType: "LOTUS" },
  "VĨNH LONG":       { lon: 105.97, lat: 10.25, region: "MIỀN TÂY", archType: "LOTUS" },
  "ĐỒNG THÁP":       { lon: 105.63, lat: 10.46, region: "MIỀN TÂY", archType: "LOTUS" },
  "AN GIANG":        { lon: 105.13, lat: 10.52, region: "MIỀN TÂY", archType: "LOTUS" },
  "KIÊN GIANG":      { lon: 105.08, lat: 10.01, region: "MIỀN TÂY", archType: "LOTUS" },
  "PHÚ QUỐC":        { lon: 103.96, lat: 10.22, region: "MIỀN TÂY", archType: "DOME" },
  "HẬU GIANG":       { lon: 105.47, lat: 9.78, region: "MIỀN TÂY", archType: "LOTUS" },
  "SÓC TRĂNG":       { lon: 105.97, lat: 9.60, region: "MIỀN TÂY", archType: "LOTUS" },
  "BẠC LIÊU":        { lon: 105.72, lat: 9.29, region: "MIỀN TÂY", archType: "LOTUS" },
  "CÀ MAU":          { lon: 105.15, lat: 9.18, region: "MIỀN TÂY", archType: "LOTUS" }
};

// Robust Location Resolver for Any Cinema in Vietnam
function resolveLocationInfo(cityRaw, addressRaw) {
  const city = (cityRaw || '').trim();
  const address = (addressRaw || '').trim();

  const clean = (s) =>
    (s || '')
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/đ/g, "d")
      .replace(/Đ/g, "D")
      .toUpperCase();

  // 1. Inspect Address from right to left (Provinces are usually at the end)
  const addrParts = address.split(',').map(s => s.trim()).filter(Boolean);
  for (let i = addrParts.length - 1; i >= 0; i--) {
    const partClean = clean(addrParts[i]);
    for (const [name, info] of Object.entries(VIETNAM_PROVINCES_GIS)) {
      const nameClean = clean(name);
      if (partClean === nameClean || partClean.includes(nameClean) || nameClean.includes(partClean)) {
        return {
          city: name,
          region: info.region,
          lon: info.lon,
          lat: info.lat,
          archType: info.archType
        };
      }
    }
  }

  // 2. Direct city match
  if (city) {
    const cityClean = clean(city);
    for (const [name, info] of Object.entries(VIETNAM_PROVINCES_GIS)) {
      const nameClean = clean(name);
      if (cityClean === nameClean || cityClean.includes(nameClean) || nameClean.includes(cityClean)) {
        return {
          city: name,
          region: info.region,
          lon: info.lon,
          lat: info.lat,
          archType: info.archType
        };
      }
    }
  }

  // 3. Full text search in address string
  const fullAddressClean = clean(`${city} ${address}`);
  for (const [name, info] of Object.entries(VIETNAM_PROVINCES_GIS)) {
    const nameClean = clean(name);
    if (fullAddressClean.includes(nameClean)) {
      return {
        city: name,
        region: info.region,
        lon: info.lon,
        lat: info.lat,
        archType: info.archType
      };
    }
  }

  // Default fallback to TP. Hồ Chí Minh
  const def = VIETNAM_PROVINCES_GIS["TP. HỒ CHÍ MINH"];
  return {
    city: city || "TP. HỒ CHÍ MINH",
    region: def.region,
    lon: def.lon,
    lat: def.lat,
    archType: def.archType
  };
}

// =============================================================================
// MAIN COMPONENT
// =============================================================================

export default function AdminCinemaPanel({ ctx = {} }) {
  const {
    getAdminToken = () => null,
    showToast = () => {},
    addAuditLog = () => {},
    onCinemaChanged = () => {},
    onSectionChange = () => {},
    isAdmin = false,
    isManager = false,
    currentUser = null
  } = ctx || {};

  const userRole = (currentUser?.role || currentUser?.roles?.[0] || '').toUpperCase();
  const isEffectiveAdmin = isAdmin || userRole.includes('ADMIN');

  // ── States ────────────────────────────────────────────────────────────────
  const [cinemas, setCinemas] = useState([]);
  const [rooms, setRooms] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedCinemaId, setSelectedCinemaId] = useState(null);
  const [currentCityFilter, setCurrentCityFilter] = useState("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const [displayMode3D, setDisplayMode3D] = useState("MAP"); // 'MAP' or 'CAROUSEL'
  const [miniPreviewMode, setMiniPreviewMode] = useState("TOWER"); // 'TOWER' or 'HALL'
  const [inspectorMinimized, setInspectorMinimized] = useState(false);
  const [isLeftDrawerOpen, setIsLeftDrawerOpen] = useState(false);
  const [autoOrbitEnabled, setAutoOrbitEnabled] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showCallouts, setShowCallouts] = useState(true);

  // GHN Master Data Modal State
  const [isGhnModalOpen, setIsGhnModalOpen] = useState(false);
  const [ghnEditId, setGhnEditId] = useState(null);
  const [ghnProvinces, setGhnProvinces] = useState([]);
  const [ghnDistricts, setGhnDistricts] = useState([]);
  const [ghnWards, setGhnWards] = useState([]);
  const [selectedProvinceId, setSelectedProvinceId] = useState("");
  const [selectedDistrictId, setSelectedDistrictId] = useState("");
  const [selectedWardCode, setSelectedWardCode] = useState("");
  const [formName, setFormName] = useState("");
  const [formPhone, setFormPhone] = useState("");
  const [formStreet, setFormStreet] = useState("");
  const [formFullAddress, setFormFullAddress] = useState("");
  const [formStatus, setFormStatus] = useState("ACTIVE");
  const [isSaving, setIsSaving] = useState(false);
  const [formError, setFormError] = useState("");

  // Delete Confirm Modal State
  const [deleteConfirmCinema, setDeleteConfirmCinema] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Custom Toast State
  const [localToast, setLocalToast] = useState({ show: false, msg: "" });

  const triggerLocalToast = useCallback((msg) => {
    setLocalToast({ show: true, msg });
    if (window._localToastTimer) clearTimeout(window._localToastTimer);
    window._localToastTimer = setTimeout(() => {
      setLocalToast({ show: false, msg: "" });
    }, 2800);
  }, []);

  // ── Three.js Refs ─────────────────────────────────────────────────────────
  const viewportRef = useRef(null);
  const canvasRef = useRef(null);
  const miniCanvasRef = useRef(null);
  const svgLinesRef = useRef(null);
  const svgTetherRef = useRef(null);
  const labelsOverlayRef = useRef(null);

  // Three.js Scene Variables Refs
  const threeRef = useRef({
    scene: null,
    camera: null,
    renderer: null,
    raycaster: null,
    mouse: new THREE.Vector2(),
    cinemaNodesGroup: null,
    cinemaMeshMap: new Map(),
    hologramRingOuter: null,
    hologramRingInner: null,
    radarSweepMesh: null,
    flightArcPackets: [],
    boatFleet: [],
    animId: null
  });

  const miniThreeRef = useRef({
    scene: null,
    camera: null,
    renderer: null,
    rootGroup: null
  });

  // Camera Controller State Ref
  const camCtrlRef = useRef({
    target: new THREE.Vector3(6, 0, 4),
    goalTarget: new THREE.Vector3(6, 0, 4),
    spherical: { radius: 215, phi: 0.72, theta: 0.08 },
    goalSpherical: { radius: 215, phi: 0.72, theta: 0.08 },
    isDraggingLeft: false,
    isDraggingRight: false,
    prevMouse: { x: 0, y: 0 },
    pointerDownPos: { x: 0, y: 0 },
    keys: {}
  });

  // State mirror refs for animation loop
  const cinemasRef = useRef(cinemas);
  const selectedIdRef = useRef(selectedCinemaId);
  const displayModeRef = useRef(displayMode3D);
  const autoOrbitRef = useRef(autoOrbitEnabled);
  const inspectorMinimizedRef = useRef(inspectorMinimized);
  const showCalloutsRef = useRef(showCallouts);

  useEffect(() => { cinemasRef.current = cinemas; }, [cinemas]);
  useEffect(() => { selectedIdRef.current = selectedCinemaId; }, [selectedCinemaId]);
  useEffect(() => { displayModeRef.current = displayMode3D; }, [displayMode3D]);
  useEffect(() => { autoOrbitRef.current = autoOrbitEnabled; }, [autoOrbitEnabled]);
  useEffect(() => { inspectorMinimizedRef.current = inspectorMinimized; }, [inspectorMinimized]);
  useEffect(() => { showCalloutsRef.current = showCallouts; }, [showCallouts]);

  // ── Load Real Data From APIs ──────────────────────────────────────────────
  const loadData = useCallback(async () => {
    const token = getAdminToken();
    if (!token) return;
    setIsLoading(true);

    try {
      // 1. Fetch Cinemas
      let cinemaList = [];
      try {
        const res = await adminService.getAdminCinemas(token);
        cinemaList = Array.isArray(res) ? res : (res?.items || res?.content || []);
      } catch (err) {
        try {
          const single = await adminService.getAdminCinema(token);
          if (single) cinemaList = [single];
        } catch (e) {
          console.warn("Fallback single cinema failed:", e);
        }
      }

      // 2. Fetch Rooms to compute room count per cinema
      let roomsList = [];
      try {
        const roomsRes = await adminService.getAdminRooms(token);
        roomsList = Array.isArray(roomsRes) ? roomsRes : (roomsRes?.items || roomsRes?.content || []);
        setRooms(roomsList);
      } catch (e) {
        console.warn("Lỗi lấy danh sách phòng:", e);
      }

      // 3. Decorate Cinemas with Coordinates, Architecture & Rooms count
      const archTypes = ["BITEXCO", "LANDMARK", "TWIN", "ROYAL", "DRAGON", "LOTUS", "DOME"];
      const decorated = cinemaList.map((c, idx) => {
        const loc = resolveLocationInfo(c.city, c.address);
        
        // Count rooms for this cinema
        const roomCount = roomsList.filter(r => (r.cinemaId === c.id || r.cinema?.id === c.id)).length;

        // Deterministic geographic jitter for cinemas in the same city
        const angle = (Number(c.id || idx) * 137.5) * (Math.PI / 180);
        const radius = ((Number(c.id || idx) % 5) + 1) * 0.038;
        const lon = c.lon || (loc.lon + Math.cos(angle) * radius);
        const lat = c.lat || (loc.lat + Math.sin(angle) * radius);

        const archType = c.archType || loc.archType || archTypes[idx % archTypes.length];
        const isActive = c.status === "ACTIVE" || c.status === true;

        return {
          ...c,
          id: c.id,
          name: c.name || `CinemaAI ${loc.city}`,
          city: loc.city,
          region: loc.region,
          archName: c.archName || `TÒA THÁP ${loc.city} #${c.id}`,
          archType,
          address: c.address || `${loc.city}, Việt Nam`,
          phone: c.phone || "1900 6868",
          rooms: roomCount || c.roomCount || 0,
          active: isActive,
          lon,
          lat,
          calloutSide: idx % 2 === 0 ? "left" : "right"
        };
      });

      setCinemas(decorated);
      if (decorated.length > 0 && (!selectedCinemaId || !decorated.some(c => c.id === selectedCinemaId))) {
        setSelectedCinemaId(decorated[0].id);
      }
    } catch (err) {
      console.error("Lỗi tải danh sách cụm rạp:", err);
      showToast?.(err.message || "Không thể tải danh sách cụm rạp.", "error");
    } finally {
      setIsLoading(false);
    }
  }, [getAdminToken, selectedCinemaId, showToast]);

  // Initial Load
  useEffect(() => {
    loadData();
    getGhnProvinces().then(res => {
      if (res?.data) setGhnProvinces(res.data);
    }).catch(err => console.warn("Lỗi load GHN provinces:", err));
  }, []);

  // ── Filtered Cinemas ──────────────────────────────────────────────────────
  const filteredCinemas = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return cinemas.filter(c => {
      const matchCity = currentCityFilter === "ALL" || c.city === currentCityFilter;
      const matchQ = !q ||
        c.name.toLowerCase().includes(q) ||
        c.address.toLowerCase().includes(q) ||
        c.phone.toLowerCase().includes(q);
      return matchCity && matchQ;
    });
  }, [cinemas, currentCityFilter, searchQuery]);

  const selectedCinema = useMemo(() => {
    return cinemas.find(c => c.id === selectedCinemaId) || cinemas[0] || null;
  }, [cinemas, selectedCinemaId]);

  // ── Three.js Procedural Builders ──────────────────────────────────────────

  const buildPedestalAndStarfield = useCallback((scene) => {
    const tableGroup = new THREE.Group();
    scene.add(tableGroup);

    // Polar Grid Base
    const polarGrid = new THREE.PolarGridHelper(155, 24, 10, 64, 0x0e3a5c, 0x092238);
    polarGrid.position.y = -0.4;
    tableGroup.add(polarGrid);

    // Outer Cyan Ring
    const outerGeo = new THREE.RingGeometry(142, 145, 96);
    outerGeo.rotateX(-Math.PI / 2);
    const ringOuter = new THREE.Mesh(
      outerGeo,
      new THREE.MeshBasicMaterial({ color: 0x06b6d4, side: THREE.DoubleSide, transparent: true, opacity: 0.45 })
    );
    ringOuter.position.y = -0.2;
    tableGroup.add(ringOuter);
    threeRef.current.hologramRingOuter = ringOuter;

    // Inner Segmented Gold Ring
    const innerGeo = new THREE.RingGeometry(118, 120.2, 64, 1, 0, Math.PI * 1.65);
    innerGeo.rotateX(-Math.PI / 2);
    const ringInner = new THREE.Mesh(
      innerGeo,
      new THREE.MeshBasicMaterial({ color: 0xf59e0b, side: THREE.DoubleSide, transparent: true, opacity: 0.45 })
    );
    ringInner.position.y = -0.1;
    tableGroup.add(ringInner);
    threeRef.current.hologramRingInner = ringInner;

    // Radar Sweep Wedge
    const sweepGeo = new THREE.CircleGeometry(140, 32, 0, Math.PI / 5);
    sweepGeo.rotateX(-Math.PI / 2);
    const radarSweep = new THREE.Mesh(
      sweepGeo,
      new THREE.MeshBasicMaterial({ color: 0x06b6d4, side: THREE.DoubleSide, transparent: true, opacity: 0.09 })
    );
    radarSweep.position.y = -0.05;
    tableGroup.add(radarSweep);
    threeRef.current.radarSweepMesh = radarSweep;

    // Floating Hologram Starfield Particles
    const starCount = 380;
    const starPos = new Float32Array(starCount * 3);
    for (let i = 0; i < starCount; i++) {
      starPos[i * 3] = (Math.random() - 0.5) * 420;
      starPos[i * 3 + 1] = Math.random() * 140 + 2;
      starPos[i * 3 + 2] = (Math.random() - 0.5) * 420;
    }
    const starGeo = new THREE.BufferGeometry();
    starGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3));
    const starMat = new THREE.PointsMaterial({ color: 0x38bdf8, size: 1.35, transparent: true, opacity: 0.65 });
    scene.add(new THREE.Points(starGeo, starMat));
  }, []);

  const buildVietnamMap3D = useCallback((scene) => {
    const mapGroup = new THREE.Group();
    scene.add(mapGroup);

    // 1. Multi-Layered Extruded Mainland S-Shape
    const shape = new THREE.Shape();
    VIETNAM_MAINLAND_GIS.forEach(([lon, lat], idx) => {
      const { x, z } = gisToWorld(lon, lat);
      if (idx === 0) shape.moveTo(x, -z);
      else shape.lineTo(x, -z);
    });
    shape.closePath();

    const mainlandGeo = new THREE.ExtrudeGeometry(shape, {
      depth: 3.4,
      bevelEnabled: true,
      bevelSegments: 3,
      steps: 2,
      bevelSize: 0.55,
      bevelThickness: 0.55
    });
    mainlandGeo.rotateX(-Math.PI / 2);

    const mainlandMat = new THREE.MeshStandardMaterial({
      color: 0x0f3148,
      emissive: 0x071e2e,
      roughness: 0.35,
      metalness: 0.45
    });
    const mainlandMesh = new THREE.Mesh(mainlandGeo, mainlandMat);
    mapGroup.add(mainlandMesh);

    // 2. Dual Neon Coastline Tubes (Gold Upper + Cyan Lower)
    const borderUpper = [];
    const borderLower = [];
    VIETNAM_MAINLAND_GIS.forEach(([lon, lat]) => {
      const { x, z } = gisToWorld(lon, lat);
      borderUpper.push(new THREE.Vector3(x, 4.05, z));
      borderLower.push(new THREE.Vector3(x, 0.6, z));
    });
    borderUpper.push(borderUpper[0].clone());
    borderLower.push(borderLower[0].clone());

    const upperCurve = new THREE.CatmullRomCurve3(borderUpper, true);
    mapGroup.add(new THREE.Mesh(
      new THREE.TubeGeometry(upperCurve, 280, 0.45, 8, true),
      new THREE.MeshBasicMaterial({ color: 0xf59e0b })
    ));

    const lowerCurve = new THREE.CatmullRomCurve3(borderLower, true);
    mapGroup.add(new THREE.Mesh(
      new THREE.TubeGeometry(lowerCurve, 260, 0.32, 6, true),
      new THREE.MeshBasicMaterial({ color: 0x06b6d4 })
    ));

    // 3. Hex-Prism Elevation Matrix
    const hexGeo = new THREE.CylinderGeometry(1.22, 1.22, 1, 6);
    for (let lat = 8.8; lat <= 23.1; lat += 0.32) {
      for (let lon = 102.3; lon <= 109.4; lon += 0.32) {
        const offsetLon = lon + (Math.round(lat * 3) % 2 === 0 ? 0.16 : 0);
        if (isPointInPolygon(offsetLon, lat, VIETNAM_MAINLAND_GIS)) {
          const { x, z } = gisToWorld(offsetLon, lat);
          const isMountain = (lat > 20.5 && offsetLon < 105.2) || (lat > 11.5 && lat < 15.5 && offsetLon < 108.4);
          const h = isMountain ? (2.2 + Math.random() * 2.4) : (0.9 + Math.random() * 0.8);

          let hexColor = 0x10b981;
          if (lat >= 18.0) hexColor = isMountain ? 0xf59e0b : 0xfbbf24;
          else if (lat >= 13.0) hexColor = 0x06b6d4;

          const mat = new THREE.MeshStandardMaterial({
            color: hexColor,
            emissive: hexColor,
            emissiveIntensity: 0.28,
            roughness: 0.35,
            metalness: 0.55
          });
          const hex = new THREE.Mesh(hexGeo, mat);
          hex.scale.set(1, h, 1);
          hex.position.set(x, 3.6 + h / 2, z);
          mapGroup.add(hex);
        }
      }
    }

    // 4. Lũng Cú Flagpole + Islands
    const lungCuPos = gisToWorld(105.32, 23.36);
    buildFlagMarker(mapGroup, lungCuPos.x, 4.0, lungCuPos.z, 1.45);

    buildIsland(mapGroup, 103.96, 10.22, 1.9); // Phú Quốc
    buildIsland(mapGroup, 106.60, 8.68, 1.2);  // Côn Đảo
    buildIsland(mapGroup, 107.05, 20.80, 1.3); // Cát Bà

    // Sovereign Archipelagos: Hoàng Sa & Trường Sa with National Flags
    buildArchipelago(mapGroup, 111.0, 16.5); // Hoàng Sa (Đà Nẵng)
    buildArchipelago(mapGroup, 111.2, 10.2); // Trường Sa (Khánh Hòa)

    // Mini Boat Fleet cruising around archipelagos & sovereign waters
    buildMiniBoatFleet(mapGroup);

    // 5. Parabolic Laser Arcs Connecting Hubs
    const hn = gisToWorld(105.84, 21.03);
    const dn = gisToWorld(108.22, 16.06);
    const hcm = gisToWorld(106.70, 10.78);
    const ct = gisToWorld(105.78, 10.03);
    const hs = gisToWorld(111.0, 16.5);
    const ts = gisToWorld(111.2, 10.2);

    threeRef.current.flightArcPackets = [];
    createLaserArc(mapGroup, hn, dn, 28, 0xf59e0b);
    createLaserArc(mapGroup, dn, hcm, 30, 0x06b6d4);
    createLaserArc(mapGroup, hcm, ct, 14, 0x10b981);
    createLaserArc(mapGroup, dn, hs, 18, 0xfde047);
    createLaserArc(mapGroup, hcm, ts, 22, 0xfde047);
  }, []);

  const buildFlagMarker = (parent, x, y, z, scale = 1) => {
    const g = new THREE.Group();
    g.position.set(x, y, z);
    g.scale.set(scale, scale, scale);

    const base = new THREE.Mesh(
      new THREE.CylinderGeometry(1.1, 1.5, 2.2, 8),
      new THREE.MeshStandardMaterial({ color: 0xe2e8f0, roughness: 0.3 })
    );
    base.position.y = 1.1;
    g.add(base);

    const pole = new THREE.Mesh(
      new THREE.CylinderGeometry(0.18, 0.22, 8.8, 8),
      new THREE.MeshBasicMaterial({ color: 0xfef08a })
    );
    pole.position.y = 5.4;
    g.add(pole);

    const flagMesh = new THREE.Mesh(
      new THREE.BoxGeometry(4.8, 2.9, 0.24),
      new THREE.MeshBasicMaterial({ color: 0xdc2626 })
    );
    flagMesh.position.set(2.4, 8.2, 0);
    g.add(flagMesh);

    const starMesh = new THREE.Mesh(
      new THREE.CircleGeometry(0.8, 5),
      new THREE.MeshBasicMaterial({ color: 0xfde047, side: THREE.DoubleSide })
    );
    starMesh.position.set(2.4, 8.2, 0.16);
    starMesh.rotation.z = Math.PI / 10;
    g.add(starMesh);

    parent.add(g);
  };

  const buildIsland = (parent, lon, lat, radius) => {
    const { x, z } = gisToWorld(lon, lat);
    const mesh = new THREE.Mesh(
      new THREE.CylinderGeometry(radius * 0.8, radius * 1.15, 2.0, 7),
      new THREE.MeshStandardMaterial({ color: 0x10b981, emissive: 0x064e3b, roughness: 0.4 })
    );
    mesh.position.set(x, 1.0, z);
    parent.add(mesh);

    const ringGeo = new THREE.RingGeometry(radius * 1.1, radius * 1.6, 24);
    ringGeo.rotateX(-Math.PI / 2);
    const ring = new THREE.Mesh(
      ringGeo,
      new THREE.MeshBasicMaterial({ color: 0x06b6d4, side: THREE.DoubleSide, transparent: true, opacity: 0.6 })
    );
    ring.position.set(x, 0.2, z);
    parent.add(ring);
  };

  const buildArchipelago = (parent, lon, lat) => {
    const { x, z } = gisToWorld(lon, lat);
    const offsets = [[0, 0, 2.3], [-3.8, -2.2, 1.3], [3.6, -1.8, 1.4], [-2.4, 2.8, 1.2], [3.2, 2.6, 1.3]];
    offsets.forEach(([dx, dz, r], idx) => {
      const m = new THREE.Mesh(
        new THREE.CylinderGeometry(r * 0.75, r, 1.6, 6),
        new THREE.MeshStandardMaterial({ color: 0xf59e0b, emissive: 0x78350f, roughness: 0.35 })
      );
      m.position.set(x + dx, 0.8, z + dz);
      parent.add(m);

      const reefGeo = new THREE.RingGeometry(r * 1.05, r * 1.65, 18);
      reefGeo.rotateX(-Math.PI / 2);
      const reef = new THREE.Mesh(
        reefGeo,
        new THREE.MeshBasicMaterial({ color: 0x38bdf8, side: THREE.DoubleSide, transparent: true, opacity: 0.6 })
      );
      reef.position.set(x + dx, 0.15, z + dz);
      parent.add(reef);

      if (idx === 0) buildFlagMarker(parent, x, 1.6, z, 1.3);
    });
  };

  const createLaserArc = (parent, startXZ, endXZ, peakHeight, colorHex) => {
    const p0 = new THREE.Vector3(startXZ.x, 5, startXZ.z);
    const p2 = new THREE.Vector3(endXZ.x, 5, endXZ.z);
    const mid = new THREE.Vector3(
      (startXZ.x + endXZ.x) * 0.5,
      peakHeight,
      (startXZ.z + endXZ.z) * 0.5
    );

    const curve = new THREE.QuadraticBezierCurve3(p0, mid, p2);
    const tubeGeo = new THREE.TubeGeometry(curve, 48, 0.22, 6, false);
    const tubeMat = new THREE.MeshBasicMaterial({ color: colorHex, transparent: true, opacity: 0.55 });
    parent.add(new THREE.Mesh(tubeGeo, tubeMat));

    const packet = new THREE.Mesh(
      new THREE.SphereGeometry(0.85, 12, 12),
      new THREE.MeshBasicMaterial({ color: 0xffffff })
    );
    parent.add(packet);
    threeRef.current.flightArcPackets.push({
      mesh: packet,
      curve,
      t: Math.random(),
      speed: 0.0045 + Math.random() * 0.002
    });
  };

  const createMiniBoat = ({ scale = 1, hullColor = 0x1e293b, cabinColor = 0xffffff, hasFlag = true }) => {
    const boat = new THREE.Group();

    // 1. Sleek Streamlined Boat Hull
    const hullShape = new THREE.Shape();
    hullShape.moveTo(0, 2.2);     // Bow (Mũi thuyền nhọn lướt sóng hướng +Z)
    hullShape.lineTo(0.75, 0.8);   // Mạn trước phải
    hullShape.lineTo(0.85, -1.6); // Mạn giữa phải
    hullShape.lineTo(0.55, -2.1); // Góc đuôi phải
    hullShape.lineTo(-0.55, -2.1);// Góc đuôi trái
    hullShape.lineTo(-0.85, -1.6);// Mạn giữa trái
    hullShape.lineTo(-0.75, 0.8);  // Mạn trước trái
    hullShape.closePath();

    const hullGeo = new THREE.ExtrudeGeometry(hullShape, {
      depth: 0.7,
      bevelEnabled: true,
      bevelSegments: 2,
      steps: 1,
      bevelSize: 0.18,
      bevelThickness: 0.22
    });
    hullGeo.rotateX(Math.PI / 2); // Xoay để mũi hướng về +Z trên mặt phẳng nằm ngang

    const hullMat = new THREE.MeshStandardMaterial({
      color: hullColor,
      roughness: 0.35,
      metalness: 0.45
    });
    const hullMesh = new THREE.Mesh(hullGeo, hullMat);
    hullMesh.position.y = 0.2;
    boat.add(hullMesh);

    // Dải neon dạ quang chạy quanh mép thân thuyền (Hologram cyber line)
    const stripeGeo = new THREE.BoxGeometry(1.5, 0.12, 3.2);
    const stripeMat = new THREE.MeshBasicMaterial({ color: 0x06b6d4 });
    const stripe = new THREE.Mesh(stripeGeo, stripeMat);
    stripe.position.set(0, 0.45, -0.2);
    boat.add(stripe);

    // 2. Cabin / Buồng lái điều khiển
    const cabinGeo = new THREE.BoxGeometry(0.9, 0.65, 1.3);
    const cabinMat = new THREE.MeshStandardMaterial({
      color: cabinColor,
      roughness: 0.25,
      metalness: 0.2
    });
    const cabin = new THREE.Mesh(cabinGeo, cabinMat);
    cabin.position.set(0, 0.75, -0.3);
    boat.add(cabin);

    // Kính chắn gió buồng lái (Windshield phát sáng xanh cyan)
    const glassGeo = new THREE.BoxGeometry(0.82, 0.26, 0.35);
    const glassMat = new THREE.MeshBasicMaterial({ color: 0x38bdf8 });
    const glass = new THREE.Mesh(glassGeo, glassMat);
    glass.position.set(0, 0.85, 0.3);
    boat.add(glass);

    // 3. Cột cờ / Cột ăng-ten radar
    const mastGeo = new THREE.CylinderGeometry(0.05, 0.07, 1.4, 6);
    const mastMat = new THREE.MeshBasicMaterial({ color: 0xfef08a });
    const mast = new THREE.Mesh(mastGeo, mastMat);
    mast.position.set(0, 1.5, -0.5);
    boat.add(mast);

    // Đèn định vị trên đỉnh cột buồm (chớp sáng)
    const beaconLight = new THREE.Mesh(
      new THREE.SphereGeometry(0.18, 8, 8),
      new THREE.MeshBasicMaterial({ color: 0x06b6d4 })
    );
    beaconLight.position.set(0, 2.2, -0.5);
    boat.add(beaconLight);

    // 4. Quốc kỳ Việt Nam thu nhỏ kiêu hãnh trên đuôi thuyền (Cờ đỏ sao vàng)
    if (hasFlag) {
      const flagPole = new THREE.Mesh(
        new THREE.CylinderGeometry(0.04, 0.05, 1.3, 5),
        new THREE.MeshBasicMaterial({ color: 0xf3f4f6 })
      );
      flagPole.position.set(0, 1.0, -1.9);
      boat.add(flagPole);

      const flagMesh = new THREE.Mesh(
        new THREE.BoxGeometry(0.85, 0.52, 0.04),
        new THREE.MeshBasicMaterial({ color: 0xdc2626 })
      );
      flagMesh.position.set(0.42, 1.45, -1.9);
      boat.add(flagMesh);

      const starMesh = new THREE.Mesh(
        new THREE.CircleGeometry(0.13, 5),
        new THREE.MeshBasicMaterial({ color: 0xfde047, side: THREE.DoubleSide })
      );
      starMesh.position.set(0.42, 1.45, -1.87);
      boat.add(starMesh);
    }

    // 5. Vệt bọt sóng nước rẽ sóng (Glowing Water Wake Trail)
    const wakeGeo = new THREE.BufferGeometry();
    const wakeVertices = new Float32Array([
      0, 0.02, -1.8,
      -1.3, 0.02, -5.2,
      1.3, 0.02, -5.2
    ]);
    wakeGeo.setAttribute('position', new THREE.BufferAttribute(wakeVertices, 3));
    const wakeMat = new THREE.MeshBasicMaterial({
      color: 0x38bdf8,
      transparent: true,
      opacity: 0.38,
      side: THREE.DoubleSide
    });
    const wake = new THREE.Mesh(wakeGeo, wakeMat);
    boat.add(wake);

    // Vệt rẽ sóng viền mép hình chữ V
    const wakeLineGeo = new THREE.BufferGeometry();
    const wakeLineVertices = new Float32Array([
      -1.3, 0.03, -5.2,
      0, 0.03, -1.8,
      1.3, 0.03, -5.2
    ]);
    wakeLineGeo.setAttribute('position', new THREE.BufferAttribute(wakeLineVertices, 3));
    const wakeLine = new THREE.Line(
      wakeLineGeo,
      new THREE.LineBasicMaterial({ color: 0x7dd3fc, transparent: true, opacity: 0.6 })
    );
    boat.add(wakeLine);

    boat.scale.set(scale, scale, scale);
    return { boat, beaconLight, wake };
  };

  const buildMiniBoatFleet = (parent) => {
    threeRef.current.boatFleet = [];

    const fleetConfigs = [
      // ── Quần đảo Hoàng Sa (3 tàu tuần tra bảo vệ chủ quyền) ─────────────────
      {
        islandName: "HOANG_SA",
        lon: 111.0,
        lat: 16.5,
        radiusX: 9.8,
        radiusZ: 8.2,
        speed: 0.0092,
        initialAngle: 0.4,
        scale: 0.68,
        hullColor: 0x1e293b,
        cabinColor: 0xffffff,
        hasFlag: true,
        baseY: 0.45
      },
      {
        islandName: "HOANG_SA",
        lon: 111.0,
        lat: 16.5,
        radiusX: 15.5,
        radiusZ: 13.0,
        speed: -0.0068,
        initialAngle: 3.2,
        scale: 0.75,
        hullColor: 0x0f172a,
        cabinColor: 0xe2e8f0,
        hasFlag: true,
        baseY: 0.45
      },
      {
        islandName: "HOANG_SA",
        lon: 111.0,
        lat: 16.5,
        radiusX: 6.8,
        radiusZ: 6.0,
        speed: 0.0128,
        initialAngle: 1.8,
        scale: 0.58,
        hullColor: 0x0369a1,
        cabinColor: 0xffffff,
        hasFlag: true,
        baseY: 0.45
      },

      // ── Quần đảo Trường Sa (4 tàu kiểm ngư & tuần duyên bảo vệ chủ quyền) ──
      {
        islandName: "TRUONG_SA",
        lon: 111.2,
        lat: 10.2,
        radiusX: 11.5,
        radiusZ: 9.8,
        speed: 0.0086,
        initialAngle: 0.8,
        scale: 0.72,
        hullColor: 0x1e293b,
        cabinColor: 0xffffff,
        hasFlag: true,
        baseY: 0.45
      },
      {
        islandName: "TRUONG_SA",
        lon: 111.2,
        lat: 10.2,
        radiusX: 18.0,
        radiusZ: 15.2,
        speed: -0.0060,
        initialAngle: 2.6,
        scale: 0.78,
        hullColor: 0x0f172a,
        cabinColor: 0xf8fafc,
        hasFlag: true,
        baseY: 0.45
      },
      {
        islandName: "TRUONG_SA",
        lon: 111.2,
        lat: 10.2,
        radiusX: 7.2,
        radiusZ: 6.5,
        speed: 0.0118,
        initialAngle: 4.8,
        scale: 0.60,
        hullColor: 0x0284c7,
        cabinColor: 0xffffff,
        hasFlag: true,
        baseY: 0.45
      },
      {
        islandName: "TRUONG_SA",
        lon: 111.2,
        lat: 10.2,
        radiusX: 23.5,
        radiusZ: 19.5,
        speed: 0.0050,
        initialAngle: 5.4,
        scale: 0.82,
        hullColor: 0x1e293b,
        cabinColor: 0xffffff,
        hasFlag: true,
        baseY: 0.45
      },

      // ── Đảo Phú Quốc (1 thuyền tuần tra vùng biển Tây Nam) ─────────────────
      {
        islandName: "PHU_QUOC",
        lon: 103.96,
        lat: 10.22,
        radiusX: 6.8,
        radiusZ: 5.8,
        speed: 0.0094,
        initialAngle: 1.2,
        scale: 0.65,
        hullColor: 0x0284c7,
        cabinColor: 0xffffff,
        hasFlag: true,
        baseY: 0.45
      },

      // ── Côn Đảo (1 thuyền tuần tra) ───────────────────────────────────────
      {
        islandName: "CON_DAO",
        lon: 106.60,
        lat: 8.68,
        radiusX: 5.6,
        radiusZ: 4.8,
        speed: 0.0102,
        initialAngle: 2.1,
        scale: 0.62,
        hullColor: 0x1e293b,
        cabinColor: 0xffffff,
        hasFlag: true,
        baseY: 0.45
      },

      // ── Cát Bà / Vịnh Hạ Long (1 thuyền tuần tra Vịnh Bắc Bộ) ─────────────
      {
        islandName: "CAT_BA",
        lon: 107.05,
        lat: 20.80,
        radiusX: 5.8,
        radiusZ: 5.0,
        speed: 0.0098,
        initialAngle: 3.7,
        scale: 0.62,
        hullColor: 0x0f766e,
        cabinColor: 0xffffff,
        hasFlag: true,
        baseY: 0.45
      }
    ];

    fleetConfigs.forEach(cfg => {
      const center = gisToWorld(cfg.lon, cfg.lat);
      const { boat, beaconLight, wake } = createMiniBoat({
        scale: cfg.scale,
        hullColor: cfg.hullColor,
        cabinColor: cfg.cabinColor,
        hasFlag: cfg.hasFlag
      });

      parent.add(boat);

      threeRef.current.boatFleet.push({
        boat,
        beaconLight,
        wake,
        center,
        radiusX: cfg.radiusX,
        radiusZ: cfg.radiusZ,
        angle: cfg.initialAngle,
        speed: cfg.speed,
        baseY: cfg.baseY,
        tiltFactor: cfg.scale
      });
    });
  };

  const createTowerMesh = (archType, primaryColor, emissiveColor, isSelected, cinemaId) => {
    const group = new THREE.Group();
    const towerMat = new THREE.MeshStandardMaterial({
      color: primaryColor,
      emissive: emissiveColor,
      emissiveIntensity: isSelected ? 0.85 : 0.5,
      roughness: 0.2,
      metalness: 0.75
    });
    const wireMat = new THREE.MeshBasicMaterial({
      color: isSelected ? 0xfef08a : 0x38bdf8,
      wireframe: true,
      transparent: true,
      opacity: 0.32
    });

    let topHeight = 14;

    if (archType === "BITEXCO") {
      const bodyGeo = new THREE.CylinderGeometry(1.2, 2.1, 14, 18);
      const body = new THREE.Mesh(bodyGeo, towerMat);
      body.position.y = 7;
      body.userData.cinemaId = cinemaId;
      group.add(body);
      group.add(new THREE.Mesh(bodyGeo, wireMat).translateY(7));

      const pad = new THREE.Mesh(
        new THREE.CylinderGeometry(1.6, 1.6, 0.4, 18),
        new THREE.MeshBasicMaterial({ color: 0xfef08a })
      );
      pad.position.set(1.5, 9.8, 0);
      pad.userData.cinemaId = cinemaId;
      group.add(pad);
      topHeight = 15.5;
    } else if (archType === "LANDMARK") {
      const b1Geo = new THREE.BoxGeometry(3.2, 8, 3.2);
      const b2Geo = new THREE.BoxGeometry(2.2, 14, 2.2);
      const b3Geo = new THREE.BoxGeometry(1.3, 18, 1.3);
      [b1Geo, b2Geo, b3Geo].forEach((geo, idx) => {
        const h = [4, 7, 9][idx];
        const m = new THREE.Mesh(geo, towerMat);
        m.position.y = h;
        m.userData.cinemaId = cinemaId;
        group.add(m);
        group.add(new THREE.Mesh(geo, wireMat).translateY(h));
      });
      const spire = new THREE.Mesh(
        new THREE.CylinderGeometry(0.1, 0.4, 5, 8),
        new THREE.MeshBasicMaterial({ color: 0xfef08a })
      );
      spire.position.y = 20.5;
      group.add(spire);
      topHeight = 22.5;
    } else if (archType === "TWIN") {
      [-1.3, 1.3].forEach(dx => {
        const tGeo = new THREE.BoxGeometry(1.8, 13.5, 1.8);
        const t = new THREE.Mesh(tGeo, towerMat);
        t.position.set(dx, 6.75, 0);
        t.userData.cinemaId = cinemaId;
        group.add(t);
        const w = new THREE.Mesh(tGeo, wireMat);
        w.position.set(dx, 6.75, 0);
        group.add(w);
      });
      const bridge = new THREE.Mesh(
        new THREE.BoxGeometry(2.8, 0.9, 1.1),
        new THREE.MeshBasicMaterial({ color: 0x38bdf8 })
      );
      bridge.position.set(0, 9.5, 0);
      group.add(bridge);
      topHeight = 15;
    } else {
      const cylGeo = new THREE.CylinderGeometry(1.5, 2.2, 12, 10);
      const tower = new THREE.Mesh(cylGeo, towerMat);
      tower.position.y = 6;
      tower.userData.cinemaId = cinemaId;
      group.add(tower);
      group.add(new THREE.Mesh(cylGeo, wireMat).translateY(6));
      topHeight = 13.5;
    }

    return { group, topHeight };
  };

  const rebuildCinemaNodes = useCallback(() => {
    const { cinemaNodesGroup, cinemaMeshMap } = threeRef.current;
    if (!cinemaNodesGroup) return;

    while (cinemaNodesGroup.children.length > 0) {
      cinemaNodesGroup.remove(cinemaNodesGroup.children[0]);
    }
    cinemaMeshMap.clear();

    const activeId = selectedIdRef.current;
    const currentCinemas = filteredCinemas;

    currentCinemas.forEach(c => {
      const { x, z } = gisToWorld(c.lon, c.lat);
      const isSelected = c.id === activeId;

      const primaryColor = isSelected ? 0xf59e0b : (c.active ? 0x10b981 : 0x6b7280);
      const emissiveColor = isSelected ? 0xb45309 : (c.active ? 0x047857 : 0x374151);

      const { group: nodeGroup, topHeight } = createTowerMesh(
        c.archType,
        primaryColor,
        emissiveColor,
        isSelected,
        c.id
      );
      nodeGroup.position.set(x, 4.0, z);
      nodeGroup.userData.cinemaId = c.id;

      // Volumetric Vertical Light Beacon
      const beaconMat = new THREE.MeshBasicMaterial({
        color: isSelected ? 0xf59e0b : (c.active ? 0x06b6d4 : 0x6b7280),
        transparent: true,
        opacity: isSelected ? 0.52 : 0.22
      });
      const beacon = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 1.1, 24, 14), beaconMat);
      beacon.position.y = 12;
      nodeGroup.add(beacon);

      // Rotating Crown Ring above Skyscraper
      const crownRing = new THREE.Mesh(
        new THREE.TorusGeometry(2.2, 0.16, 8, 24),
        new THREE.MeshBasicMaterial({ color: isSelected ? 0xfef08a : 0x38bdf8 })
      );
      crownRing.rotation.x = Math.PI / 2;
      crownRing.position.y = topHeight + 1.5;
      nodeGroup.add(crownRing);

      // Ground Target Ring
      const ringGeo = new THREE.RingGeometry(2.6, 3.6, 32);
      ringGeo.rotateX(-Math.PI / 2);
      const ringMesh = new THREE.Mesh(
        ringGeo,
        new THREE.MeshBasicMaterial({
          color: isSelected ? 0xf59e0b : (c.active ? 0x10b981 : 0x6b7280),
          side: THREE.DoubleSide
        })
      );
      ringMesh.position.y = 0.25;
      nodeGroup.add(ringMesh);

      cinemaNodesGroup.add(nodeGroup);
      cinemaMeshMap.set(c.id, { group: nodeGroup, ringMesh, crownRing, topY: topHeight + 4.0 });
    });
  }, [filteredCinemas]);

  // Mini Turntable Preview
  const rebuildMiniTurntable = useCallback(() => {
    const { rootGroup, camera } = miniThreeRef.current;
    if (!rootGroup || !camera) return;

    while (rootGroup.children.length > 0) {
      rootGroup.remove(rootGroup.children[0]);
    }

    const c = selectedCinema;
    if (!c) return;

    if (miniPreviewMode === "TOWER") {
      camera.position.set(0, 14, 29);
      camera.lookAt(0, 7, 0);

      const { group } = createTowerMesh(c.archType, 0xf59e0b, 0x06b6d4, true, null);
      group.scale.set(0.75, 0.75, 0.75);
      rootGroup.add(group);
    } else {
      // 3D IMAX Auditorium Model
      camera.position.set(0, 15, 25);
      camera.lookAt(0, 3, 0);

      // Curved Screen
      const screenGeo = new THREE.CylinderGeometry(10, 10, 5.2, 24, 1, true, -Math.PI * 0.35, Math.PI * 0.7);
      const screenMat = new THREE.MeshBasicMaterial({ color: 0x38bdf8, side: THREE.DoubleSide });
      const screenMesh = new THREE.Mesh(screenGeo, screenMat);
      screenMesh.position.set(0, 4.2, -2);
      screenMesh.rotation.y = Math.PI;
      rootGroup.add(screenMesh);

      // Projector Light Beam Cone
      const coneGeo = new THREE.ConeGeometry(6.5, 13, 16, 1, true);
      coneGeo.rotateX(-Math.PI / 2);
      const coneMat = new THREE.MeshBasicMaterial({ color: 0x06b6d4, transparent: true, opacity: 0.16, side: THREE.DoubleSide });
      const cone = new THREE.Mesh(coneGeo, coneMat);
      cone.position.set(0, 4.5, 1.5);
      rootGroup.add(cone);

      // Tiered Cinema Seats
      const seatGeo = new THREE.BoxGeometry(0.85, 0.7, 0.75);
      for (let row = 0; row < 5; row++) {
        for (let col = -4; col <= 4; col++) {
          const isVip = row >= 2 && Math.abs(col) <= 2;
          const seatMat = new THREE.MeshStandardMaterial({
            color: isVip ? 0xf59e0b : (c.rooms > 0 ? 0x10b981 : 0x4b5563),
            emissive: isVip ? 0x92400e : 0x064e3b
          });
          const seat = new THREE.Mesh(seatGeo, seatMat);
          seat.position.set(col * 1.25, 0.6 + row * 0.75, -1.5 + row * 1.65);
          rootGroup.add(seat);
        }
      }
    }
  }, [selectedCinema, miniPreviewMode]);

  // ── 3D Camera Navigations ─────────────────────────────────────────────────
  const flyToSelectedCinema = useCallback((flyMode = "DRONE") => {
    const c = selectedCinema;
    if (!c) return;
    const cam = camCtrlRef.current;
    const { x, z } = gisToWorld(c.lon, c.lat);

    if (flyMode === "DRONE") {
      cam.goalTarget.set(x + 4, 5, z);
      cam.goalSpherical.radius = 52;
      cam.goalSpherical.phi = 0.98;
      cam.goalSpherical.theta = 0.34;
    } else if (flyMode === "CITY") {
      const loc = resolveLocationInfo(c.city, c.address);
      const hubCoords = gisToWorld(loc.lon, loc.lat);
      cam.goalTarget.set(hubCoords.x + 6, 0, hubCoords.z);
      cam.goalSpherical.radius = 108;
      cam.goalSpherical.phi = 0.78;
      cam.goalSpherical.theta = 0.10;
    } else {
      cam.goalTarget.set(x + 8, 3, z);
      cam.goalSpherical.radius = 85;
      cam.goalSpherical.phi = 0.85;
      cam.goalSpherical.theta = 0.18;
    }
  }, [selectedCinema]);

  const flyToVietnamOverview = useCallback(() => {
    setCurrentCityFilter("ALL");
    const cam = camCtrlRef.current;
    cam.goalTarget.set(8, 0, 4);
    cam.goalSpherical.radius = 220;
    cam.goalSpherical.phi = 0.68;
    cam.goalSpherical.theta = 0.06;
    triggerLocalToast("Toàn cảnh Sa Bàn Chữ S 3D Việt Nam");
  }, [triggerLocalToast]);

  const flyToIsland = useCallback((type) => {
    const pos = type === "HOANG_SA" ? gisToWorld(111.0, 16.5) : gisToWorld(111.2, 10.2);
    const cam = camCtrlRef.current;
    cam.goalTarget.set(pos.x, 2, pos.z);
    cam.goalSpherical.radius = 78;
    cam.goalSpherical.phi = 0.82;
    cam.goalSpherical.theta = -0.15;
    triggerLocalToast(type === "HOANG_SA"
      ? "★ Quần đảo Hoàng Sa (Thuộc TP. Đà Nẵng - Việt Nam)"
      : "★ Quần đảo Trường Sa (Thuộc Tỉnh Khánh Hòa - Việt Nam)");
  }, [triggerLocalToast]);

  const selectCinema = useCallback((id, fly = true) => {
    setSelectedCinemaId(id);
    selectedIdRef.current = id;
    if (fly) {
      const found = cinemasRef.current.find(c => c.id === id);
      if (found) {
        const { x, z } = gisToWorld(found.lon, found.lat);
        const cam = camCtrlRef.current;
        cam.goalTarget.set(x + 8, 3, z);
        cam.goalSpherical.radius = 85;
        cam.goalSpherical.phi = 0.85;
        cam.goalSpherical.theta = 0.18;
      }
    }
  }, []);

  const rotateCarousel = useCallback((dir) => {
    const list = [...cinemasRef.current].sort((a, b) => b.lat - a.lat);
    if (!list.length) return;
    const idx = list.findIndex(c => String(c.id) === String(selectedIdRef.current));
    const safeIdx = idx >= 0 ? idx : 0;
    const nextIdx = (safeIdx + dir + list.length) % list.length;
    const next = list[nextIdx];
    if (next) {
      selectCinema(next.id, true);
    }
  }, [selectCinema]);

  const stepCinemaNorthSouth = useCallback((dir) => {
    rotateCarousel(dir);
  }, [rotateCarousel]);

  // Auto-rotate effect when in CAROUSEL mode and autoOrbitEnabled is true
  useEffect(() => {
    if (displayMode3D !== "CAROUSEL" || !autoOrbitEnabled) return;
    const timer = setInterval(() => {
      rotateCarousel(1);
    }, 2800);
    return () => clearInterval(timer);
  }, [displayMode3D, autoOrbitEnabled, rotateCarousel]);

  // Carousel Drag & Wheel Handlers
  const wheelThrottledRef = useRef(false);
  const handleCarouselWheel = useCallback((e) => {
    if (wheelThrottledRef.current) return;
    if (Math.abs(e.deltaY) > 15 || Math.abs(e.deltaX) > 15) {
      wheelThrottledRef.current = true;
      const dir = (e.deltaY > 0 || e.deltaX > 0) ? 1 : -1;
      rotateCarousel(dir);
      setTimeout(() => {
        wheelThrottledRef.current = false;
      }, 260);
    }
  }, [rotateCarousel]);

  const dragStartRef = useRef(null);
  const handleCarouselPointerDown = useCallback((e) => {
    if (e.target.closest('button')) return;
    dragStartRef.current = e.clientX;
  }, []);
  const handleCarouselPointerUp = useCallback((e) => {
    if (dragStartRef.current === null) return;
    const deltaX = e.clientX - dragStartRef.current;
    dragStartRef.current = null;
    if (Math.abs(deltaX) > 35) {
      rotateCarousel(deltaX < 0 ? 1 : -1);
    }
  }, [rotateCarousel]);

  // ── Initialize Main Three.js Scene ────────────────────────────────────────
  useEffect(() => {
    const container = viewportRef.current;
    const canvas = canvasRef.current;
    if (!container || !canvas) return;

    // 1. Scene & Camera
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x04070d);
    scene.fog = new THREE.FogExp2(0x04070d, 0.0014);

    const camera = new THREE.PerspectiveCamera(42, container.clientWidth / container.clientHeight, 1, 1400);
    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: "high-performance" });
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();

    // Lighting
    scene.add(new THREE.AmbientLight(0xe0f2fe, 0.95));
    const sunLight = new THREE.DirectionalLight(0xfef08a, 1.35);
    sunLight.position.set(90, 200, 110);
    scene.add(sunLight);

    const rimLight = new THREE.DirectionalLight(0x38bdf8, 0.95);
    rimLight.position.set(-120, 140, -90);
    scene.add(rimLight);

    // Build World Elements
    buildPedestalAndStarfield(scene);
    buildVietnamMap3D(scene);

    const cinemaNodesGroup = new THREE.Group();
    scene.add(cinemaNodesGroup);

    threeRef.current.scene = scene;
    threeRef.current.camera = camera;
    threeRef.current.renderer = renderer;
    threeRef.current.raycaster = raycaster;
    threeRef.current.mouse = mouse;
    threeRef.current.cinemaNodesGroup = cinemaNodesGroup;

    // 2. Setup Pointer & Camera Controls
    const cam = camCtrlRef.current;

    const onPointerDown = (e) => {
      cam.pointerDownPos = { x: e.clientX, y: e.clientY };
      cam.prevMouse = { x: e.clientX, y: e.clientY };
      if (e.button === 0) cam.isDraggingLeft = true;
      if (e.button === 2 || e.button === 1) cam.isDraggingRight = true;
    };

    const onPointerMove = (e) => {
      const dx = e.clientX - cam.prevMouse.x;
      const dy = e.clientY - cam.prevMouse.y;
      cam.prevMouse = { x: e.clientX, y: e.clientY };

      if (cam.isDraggingLeft) {
        cam.goalSpherical.theta -= dx * 0.0065;
        cam.goalSpherical.phi = Math.max(0.28, Math.min(1.32, cam.goalSpherical.phi - dy * 0.0055));
      } else if (cam.isDraggingRight) {
        const panSpeed = cam.spherical.radius * 0.0016;
        const forward = new THREE.Vector3(Math.sin(cam.spherical.theta), 0, Math.cos(cam.spherical.theta));
        const right = new THREE.Vector3(forward.z, 0, -forward.x);
        cam.goalTarget.addScaledVector(right, -dx * panSpeed);
        cam.goalTarget.addScaledVector(forward, -dy * panSpeed);
      }
    };

    const onPointerUp = (e) => {
      const moveDist = Math.hypot(e.clientX - cam.pointerDownPos.x, e.clientY - cam.pointerDownPos.y);
      if (moveDist < 6 && e.button === 0 && e.target === canvas) {
        const rect = renderer.domElement.getBoundingClientRect();
        mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
        mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

        raycaster.setFromCamera(mouse, camera);
        const intersects = raycaster.intersectObjects(cinemaNodesGroup.children, true);
        if (intersects.length > 0) {
          let obj = intersects[0].object;
          while (obj && !obj.userData?.cinemaId) {
            obj = obj.parent;
          }
          if (obj && obj.userData?.cinemaId) {
            selectCinema(obj.userData.cinemaId, true);
          }
        }
      }
      cam.isDraggingLeft = false;
      cam.isDraggingRight = false;
    };

    const onWheel = (e) => {
      e.preventDefault();
      cam.goalSpherical.radius = Math.max(48, Math.min(340, cam.goalSpherical.radius + e.deltaY * 0.14));
    };

    const onKeyDown = (e) => {
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName)) return;
      if (displayModeRef.current === "CAROUSEL") {
        if (e.key === "ArrowLeft" || e.key.toLowerCase() === "a") {
          rotateCarousel(-1);
          return;
        }
        if (e.key === "ArrowRight" || e.key.toLowerCase() === "d") {
          rotateCarousel(1);
          return;
        }
      }
      cam.keys[e.key.toLowerCase()] = true;
    };
    const onKeyUp = (e) => {
      cam.keys[e.key.toLowerCase()] = false;
    };

    const onContextMenu = (e) => e.preventDefault();

    canvas.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
    canvas.addEventListener('wheel', onWheel, { passive: false });
    canvas.addEventListener('contextmenu', onContextMenu);
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);

    // 3. Project 3D to 2D helper
    const project3DTo2D = (worldVec) => {
      const v = worldVec.clone().project(camera);
      const w = renderer.domElement.clientWidth;
      const h = renderer.domElement.clientHeight;
      return {
        x: (v.x * 0.5 + 0.5) * w,
        y: (-v.y * 0.5 + 0.5) * h,
        visible: v.z < 1.0
      };
    };

    // 4. Main Animation Frame Loop
    let animId = null;

    const animate = () => {
      animId = requestAnimationFrame(animate);

      // WASD panning along S-Curve
      const panStep = 1.6;
      if (cam.keys['w'] || cam.keys['arrowup']) cam.goalTarget.z -= panStep;
      if (cam.keys['s'] || cam.keys['arrowdown']) cam.goalTarget.z += panStep;
      if (cam.keys['a'] || cam.keys['arrowleft']) cam.goalTarget.x -= panStep;
      if (cam.keys['d'] || cam.keys['arrowright']) cam.goalTarget.x += panStep;

      if (autoOrbitRef.current && !cam.isDraggingLeft) {
        cam.goalSpherical.theta += 0.0025;
      }

      // Smooth Camera Damping
      cam.target.lerp(cam.goalTarget, 0.08);
      cam.spherical.radius += (cam.goalSpherical.radius - cam.spherical.radius) * 0.08;
      cam.spherical.phi += (cam.goalSpherical.phi - cam.spherical.phi) * 0.08;
      cam.spherical.theta += (cam.goalSpherical.theta - cam.spherical.theta) * 0.08;

      const r = cam.spherical.radius;
      const phi = cam.spherical.phi;
      const theta = cam.spherical.theta;

      camera.position.x = cam.target.x + r * Math.sin(phi) * Math.sin(theta);
      camera.position.y = cam.target.y + r * Math.cos(phi);
      camera.position.z = cam.target.z + r * Math.sin(phi) * Math.cos(theta);
      camera.lookAt(cam.target);

      // Rotate Hologram Base Rings & Radar Wedge
      if (threeRef.current.hologramRingOuter) threeRef.current.hologramRingOuter.rotation.y += 0.002;
      if (threeRef.current.hologramRingInner) threeRef.current.hologramRingInner.rotation.y -= 0.0035;
      if (threeRef.current.radarSweepMesh) threeRef.current.radarSweepMesh.rotation.y -= 0.012;

      // Animate Flight Laser Arc Packets
      threeRef.current.flightArcPackets.forEach(item => {
        item.t = (item.t + item.speed) % 1.0;
        item.mesh.position.copy(item.curve.getPointAt(item.t));
      });

      // Animate Mini Boat Fleet cruising around archipelagos & sovereign waters
      if (threeRef.current.boatFleet && threeRef.current.boatFleet.length > 0) {
        const tNow = performance.now() * 0.001;
        threeRef.current.boatFleet.forEach((b, idx) => {
          b.angle += b.speed;
          const x = b.center.x + Math.cos(b.angle) * b.radiusX;
          const z = b.center.z + Math.sin(b.angle) * b.radiusZ;

          // Realistic water wave bobbing and pitching
          const waveBob = Math.sin(tNow * 3.2 + idx * 1.4) * 0.12;
          const waveRoll = Math.sin(tNow * 2.8 + idx * 1.1) * 0.06;
          const wavePitch = Math.cos(tNow * 3.2 + idx * 1.4) * 0.05;

          b.boat.position.set(x, b.baseY + waveBob, z);

          // Instantaneous tangent heading (Bow is along local +Z)
          const vx = -b.radiusX * Math.sin(b.angle) * b.speed;
          const vz = b.radiusZ * Math.cos(b.angle) * b.speed;
          const heading = Math.atan2(vx, vz);

          b.boat.rotation.set(0, heading, 0);
          b.boat.rotateX(wavePitch);
          b.boat.rotateZ(waveRoll);

          // Flashing navigation beacon light
          if (b.beaconLight) {
            const pulse = 0.5 + Math.sin(tNow * 7.0 + idx * 2.2) * 0.5;
            b.beaconLight.scale.set(1 + pulse * 0.35, 1 + pulse * 0.35, 1 + pulse * 0.35);
          }

          // Gentle wake trail opacity modulation
          if (b.wake && b.wake.material) {
            b.wake.material.opacity = 0.30 + Math.sin(tNow * 4.5 + idx) * 0.09;
          }
        });
      }

      // Pulse Selected Cinema Base Ring & Rotate Skyscraper Crowns
      const time = performance.now() * 0.004;
      const activeId = selectedIdRef.current;
      threeRef.current.cinemaMeshMap.forEach((info, id) => {
        if (info.crownRing) info.crownRing.rotation.z += 0.025;
        if (id === activeId && info.ringMesh) {
          const s = 1 + Math.sin(time) * 0.18;
          info.ringMesh.scale.set(s, s, 1);
        }
      });

      renderer.render(scene, camera);

      // Render Mini Turntable if active
      const mini = miniThreeRef.current;
      if (mini.renderer && mini.scene && mini.camera && mini.rootGroup) {
        mini.rootGroup.rotation.y += 0.012;
        mini.renderer.render(mini.scene, mini.camera);
      }

      // ── Update 2D Screen Callouts & SVG Leader Lines ───────────────────────
      if (displayModeRef.current === "MAP" && showCalloutsRef.current) {
        const w = renderer.domElement.clientWidth;
        const h = renderer.domElement.clientHeight;
        const leftBank = [];
        const rightBank = [];

        cinemasRef.current.forEach(c => {
          const { x, z } = gisToWorld(c.lon, c.lat);
          const nodeInfo = threeRef.current.cinemaMeshMap.get(c.id);
          const topY = nodeInfo ? nodeInfo.topY : 16;
          const proj = project3DTo2D(new THREE.Vector3(x, topY, z));
          if (!proj.visible) return;

          const item = { cinema: c, anchorX: proj.x, anchorY: proj.y };
          if (c.calloutSide === "left") leftBank.push(item);
          else rightBank.push(item);
        });

        // Vertical collision resolution
        const resolveVerticalCollisions = (bank, isLeft) => {
          bank.sort((a, b) => a.anchorY - b.anchorY);
          const minGap = 64;
          for (let i = 0; i < bank.length; i++) {
            let desiredY = Math.max(54, Math.min(h - 105, bank[i].anchorY - 24));
            if (i > 0 && desiredY < bank[i - 1].boxY + minGap) {
              desiredY = bank[i - 1].boxY + minGap;
            }
            bank[i].boxY = desiredY;
            const rawX = isLeft ? (bank[i].anchorX - 250) : (bank[i].anchorX + 55);
            const maxRightX = inspectorMinimizedRef.current ? (w - 220) : Math.min(w - 220, w - 425 - 215);
            bank[i].boxX = Math.max(16, Math.min(maxRightX, rawX));
          }
        };

        resolveVerticalCollisions(leftBank, true);
        resolveVerticalCollisions(rightBank, false);

        let linesSvg = "";
        const allPlaced = [
          ...leftBank.map(i => ({ ...i, isLeft: true })),
          ...rightBank.map(i => ({ ...i, isLeft: false }))
        ];

        allPlaced.forEach(item => {
          const c = item.cinema;
          const el = document.getElementById(`callout-card-${c.id}`);
          if (!el) return;

          el.style.transform = `translate3d(${Math.round(item.boxX)}px, ${Math.round(item.boxY)}px, 0)`;

          const cardW = 205;
          const cardH = 54;
          const lineStartX = item.isLeft ? (item.boxX + cardW) : item.boxX;
          const lineStartY = item.boxY + cardH * 0.5;
          const elbowX = lineStartX + (item.anchorX - lineStartX) * 0.45;

          const isSel = c.id === activeId;
          const stroke = isSel ? '#f59e0b' : (c.active ? 'rgba(6, 182, 212, 0.65)' : 'rgba(148, 163, 184, 0.4)');
          const strokeW = isSel ? '2.2' : '1.4';

          linesSvg += `
            <polyline
              points="${lineStartX},${lineStartY} ${elbowX},${lineStartY} ${item.anchorX},${item.anchorY}"
              fill="none"
              stroke="${stroke}"
              stroke-width="${strokeW}"
              ${isSel ? 'filter="url(#glow-amber)"' : 'stroke-dasharray="3,3"'}
            />
            <circle cx="${item.anchorX}" cy="${item.anchorY}" r="${isSel ? 4.5 : 3}" fill="${stroke}" />
          `;
        });

        if (svgLinesRef.current) {
          svgLinesRef.current.innerHTML = linesSvg;
        }
      } else {
        if (svgLinesRef.current) {
          svgLinesRef.current.innerHTML = "";
        }
      }

      if (displayModeRef.current === "MAP") {
        // Sovereign Archipelago Badges Positioning
        const hsPos = gisToWorld(111.0, 16.5);
        const tsPos = gisToWorld(111.2, 10.2);
        const hs2D = project3DTo2D(new THREE.Vector3(hsPos.x, 13, hsPos.z));
        const ts2D = project3DTo2D(new THREE.Vector3(tsPos.x, 13, tsPos.z));

        const hsEl = document.getElementById('island-badge-HS');
        const tsEl = document.getElementById('island-badge-TS');
        if (hsEl && hs2D.visible) {
          hsEl.style.transform = `translate3d(${Math.round(hs2D.x - 75)}px, ${Math.round(hs2D.y - 36)}px, 0)`;
        }
        if (tsEl && ts2D.visible) {
          tsEl.style.transform = `translate3d(${Math.round(ts2D.x - 75)}px, ${Math.round(ts2D.y - 36)}px, 0)`;
        }

        // Glowing Animated Tether from Skyscraper to Inspector Card
        const selCinema = cinemasRef.current.find(c => c.id === activeId);
        const inspCardEl = document.getElementById('inspector-card');
        if (selCinema && inspCardEl && svgTetherRef.current) {
          const { x, z } = gisToWorld(selCinema.lon, selCinema.lat);
          const nodeInfo = threeRef.current.cinemaMeshMap.get(selCinema.id);
          const proj = project3DTo2D(new THREE.Vector3(x, nodeInfo ? nodeInfo.topY : 16, z));
          const rect = inspCardEl.getBoundingClientRect();
          const containerRect = renderer.domElement.getBoundingClientRect();

          const targetX = rect.left - containerRect.left;
          const targetY = rect.top - containerRect.top + 42;
          const midX = proj.x + (targetX - proj.x) * 0.55;

          svgTetherRef.current.innerHTML = `
            <polyline
              class="animated-tether"
              points="${proj.x},${proj.y} ${midX},${targetY} ${targetX},${targetY}"
              fill="none"
              stroke="#f59e0b"
              stroke-width="2"
              stroke-dasharray="6,5"
              filter="url(#glow-amber)"
            />
            <circle cx="${proj.x}" cy="${proj.y}" r="5" fill="#f59e0b" />
            <circle cx="${targetX}" cy="${targetY}" r="4.5" fill="#f59e0b" />
          `;
        }
      } else {
        if (svgTetherRef.current) {
          svgTetherRef.current.innerHTML = "";
        }
      }
    };

    animate();
    threeRef.current.animId = animId;

    // Handle Resize
    const resizeObserver = new ResizeObserver(() => {
      if (!container || !renderer || !camera) return;
      camera.aspect = container.clientWidth / container.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(container.clientWidth, container.clientHeight);
    });
    resizeObserver.observe(container);

    // Cleanup
    return () => {
      cancelAnimationFrame(animId);
      resizeObserver.disconnect();
      canvas.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      canvas.removeEventListener('wheel', onWheel);
      canvas.removeEventListener('contextmenu', onContextMenu);
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      renderer.dispose();
      threeRef.current.boatFleet = [];
    };
  }, [buildPedestalAndStarfield, buildVietnamMap3D, selectCinema]);

  // ── Initialize Mini Turntable Scene ───────────────────────────────────────
  useEffect(() => {
    const canvas = miniCanvasRef.current;
    if (!canvas) return;

    const miniScene = new THREE.Scene();
    miniScene.background = new THREE.Color(0x060911);

    const miniCamera = new THREE.PerspectiveCamera(40, canvas.clientWidth / canvas.clientHeight, 0.5, 200);
    miniCamera.position.set(0, 14, 28);
    miniCamera.lookAt(0, 5, 0);

    const miniRenderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    miniRenderer.setSize(canvas.clientWidth, canvas.clientHeight);
    miniRenderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

    miniScene.add(new THREE.AmbientLight(0xdbeafe, 1.0));
    const dir = new THREE.DirectionalLight(0xfef08a, 1.3);
    dir.position.set(15, 30, 20);
    miniScene.add(dir);

    const miniGrid = new THREE.PolarGridHelper(12, 12, 5, 32, 0x1e3a5f, 0x0f243c);
    miniScene.add(miniGrid);

    const miniRootGroup = new THREE.Group();
    miniScene.add(miniRootGroup);

    miniThreeRef.current = {
      scene: miniScene,
      camera: miniCamera,
      renderer: miniRenderer,
      rootGroup: miniRootGroup
    };

    rebuildMiniTurntable();

    return () => {
      miniRenderer.dispose();
    };
  }, [rebuildMiniTurntable]);

  // Rebuild 3D Cinema Towers when data or selection changes
  useEffect(() => {
    rebuildCinemaNodes();
  }, [rebuildCinemaNodes, selectedCinemaId]);

  // Rebuild Mini Turntable when selected cinema or preview mode changes
  useEffect(() => {
    rebuildMiniTurntable();
  }, [rebuildMiniTurntable, selectedCinemaId, miniPreviewMode]);

  // ── CRUD Operations Connected to Real APIs ────────────────────────────────

  // Toggle Cinema Status
  const handleToggleStatus = async (cinema) => {
    if (!isEffectiveAdmin) {
      showToast?.('Chỉ Quản trị viên hệ thống (Admin) mới có quyền đổi trạng thái rạp.', 'warning');
      return;
    }
    const token = getAdminToken();
    if (!token) return;

    const nextStatus = cinema.active ? 'INACTIVE' : 'ACTIVE';
    try {
      await adminService.updateAdminCinemaByIdStatus(token, cinema.id, nextStatus);
      showToast?.(`Đã chuyển trạng thái rạp "${cinema.name}" sang ${nextStatus === 'ACTIVE' ? 'HOẠT ĐỘNG' : 'TẠM DỪNG'}!`, 'success');
      triggerLocalToast(`Đã ${nextStatus === 'ACTIVE' ? 'kích hoạt' : 'tạm dừng'} rạp ${cinema.name}`);
      addAuditLog?.('Đổi trạng thái rạp', `${cinema.name} -> ${nextStatus}`);
      await loadData();
      onCinemaChanged?.();
    } catch (err) {
      showToast?.(err.message || 'Không thể cập nhật trạng thái rạp.', 'error');
    }
  };

  // Open Create / Edit Modal
  const openGhnModal = async (editId = null) => {
    if (!isEffectiveAdmin) {
      showToast?.('Chỉ Quản trị viên hệ thống (Admin) mới có quyền quản lý chi nhánh rạp.', 'warning');
      return;
    }

    setGhnEditId(editId);
    setFormError('');

    // Ensure GHN provinces loaded
    let provs = ghnProvinces;
    if (provs.length === 0) {
      try {
        const res = await getGhnProvinces();
        provs = res?.data || [];
        setGhnProvinces(provs);
      } catch (e) {
        console.warn("Lỗi tải GHN provinces:", e);
      }
    }

    if (editId) {
      const c = cinemas.find(item => item.id === editId);
      if (!c) return;

      setFormName(c.name || '');
      setFormPhone(c.phone || '');
      setFormStatus(c.active ? 'ACTIVE' : 'INACTIVE');
      setFormFullAddress(c.address || '');

      // Attempt to match GHN Province
      const matchedProv = provs.find(p =>
        (c.city && p.ProvinceName.toLowerCase().includes(c.city.toLowerCase())) ||
        (c.address && c.address.toLowerCase().includes(p.ProvinceName.toLowerCase()))
      ) || provs[0];

      if (matchedProv) {
        setSelectedProvinceId(String(matchedProv.ProvinceID));
        try {
          const dRes = await getGhnDistricts(matchedProv.ProvinceID);
          const districts = dRes?.data || [];
          setGhnDistricts(districts);

          // Attempt to match district
          const matchedDist = districts.find(d =>
            c.address && c.address.toLowerCase().includes(d.DistrictName.toLowerCase())
          );

          if (matchedDist) {
            setSelectedDistrictId(String(matchedDist.DistrictID));
            const wRes = await getGhnWards(matchedDist.DistrictID);
            const wards = wRes?.data || [];
            setGhnWards(wards);

            const matchedWard = wards.find(w =>
              c.address && c.address.toLowerCase().includes(w.WardName.toLowerCase())
            );
            if (matchedWard) {
              setSelectedWardCode(String(matchedWard.WardCode));
            } else {
              setSelectedWardCode('');
            }
          } else {
            setSelectedDistrictId('');
            setSelectedWardCode('');
            setGhnWards([]);
          }
        } catch (err) {
          console.warn("Lỗi load districts:", err);
        }
      }
    } else {
      // New cinema defaults
      setFormName('');
      setFormPhone('');
      setFormStreet('');
      setFormStatus('ACTIVE');
      const defaultProv = provs.find(p => p.ProvinceName.includes('Hồ Chí Minh')) || provs[0];
      if (defaultProv) {
        setSelectedProvinceId(String(defaultProv.ProvinceID));
        setFormFullAddress(defaultProv.ProvinceName);
        try {
          const dRes = await getGhnDistricts(defaultProv.ProvinceID);
          setGhnDistricts(dRes?.data || []);
        } catch (e) {
          console.warn("Lỗi lấy quận huyện GHN:", e);
        }
      }
      setSelectedDistrictId('');
      setSelectedWardCode('');
      setGhnWards([]);
    }

    setIsGhnModalOpen(true);
  };

  const closeGhnModal = () => {
    setIsGhnModalOpen(false);
    setGhnEditId(null);
    setFormError('');
  };

  // GHN Cascading Change Handlers
  const handleProvinceSelect = async (provId) => {
    setSelectedProvinceId(provId);
    setSelectedDistrictId('');
    setSelectedWardCode('');
    setGhnDistricts([]);
    setGhnWards([]);

    const prov = ghnProvinces.find(p => String(p.ProvinceID) === String(provId));
    synthesizeAddress(formStreet, '', '', prov?.ProvinceName || '');

    if (provId) {
      try {
        const dRes = await getGhnDistricts(provId);
        setGhnDistricts(dRes?.data || []);
      } catch (err) {
        console.warn("Lỗi tải quận huyện GHN:", err);
      }
    }
  };

  const handleDistrictSelect = async (distId) => {
    setSelectedDistrictId(distId);
    setSelectedWardCode('');
    setGhnWards([]);

    const prov = ghnProvinces.find(p => String(p.ProvinceID) === String(selectedProvinceId));
    const dist = ghnDistricts.find(d => String(d.DistrictID) === String(distId));
    synthesizeAddress(formStreet, '', dist?.DistrictName || '', prov?.ProvinceName || '');

    if (distId) {
      try {
        const wRes = await getGhnWards(distId);
        setGhnWards(wRes?.data || []);
      } catch (err) {
        console.warn("Lỗi tải phường xã GHN:", err);
      }
    }
  };

  const handleWardSelect = (wardCode) => {
    setSelectedWardCode(wardCode);
    const prov = ghnProvinces.find(p => String(p.ProvinceID) === String(selectedProvinceId));
    const dist = ghnDistricts.find(d => String(d.DistrictID) === String(selectedDistrictId));
    const ward = ghnWards.find(w => String(w.WardCode) === String(wardCode));
    synthesizeAddress(formStreet, ward?.WardName || '', dist?.DistrictName || '', prov?.ProvinceName || '');
  };

  const handleStreetInput = (streetVal) => {
    setFormStreet(streetVal);
    const prov = ghnProvinces.find(p => String(p.ProvinceID) === String(selectedProvinceId));
    const dist = ghnDistricts.find(d => String(d.DistrictID) === String(selectedDistrictId));
    const ward = ghnWards.find(w => String(w.WardCode) === String(selectedWardCode));
    synthesizeAddress(streetVal, ward?.WardName || '', dist?.DistrictName || '', prov?.ProvinceName || '');
  };

  const synthesizeAddress = (street, ward, dist, prov) => {
    const parts = [street?.trim(), ward?.trim(), dist?.trim(), prov?.trim()].filter(Boolean);
    setFormFullAddress(parts.join(', '));
  };

  // Submit Modal Form (Create / Update Cinema API)
  const handleSubmitGhnForm = async (e) => {
    e.preventDefault();
    const token = getAdminToken();
    if (!token) return;

    if (!formName.trim()) {
      setFormError('Vui lòng nhập tên cụm rạp.');
      return;
    }
    if (!formFullAddress.trim()) {
      setFormError('Vui lòng nhập hoặc chọn địa chỉ cụm rạp.');
      return;
    }

    const cleanPhone = formPhone.replace(/\D/g, '');
    if (!cleanPhone || cleanPhone.length < 9) {
      setFormError('Số điện thoại hotline không hợp lệ (tối thiểu 9 số, bắt đầu bằng 0).');
      return;
    }
    if (!cleanPhone.startsWith('0')) {
      setFormError('Số điện thoại hotline phải bắt đầu bằng số 0.');
      return;
    }

    const prov = ghnProvinces.find(p => String(p.ProvinceID) === String(selectedProvinceId));
    let rawCity = prov ? prov.ProvinceName : "";
    if (!rawCity && formFullAddress) {
      const parts = formFullAddress.split(',').map(s => s.trim()).filter(Boolean);
      if (parts.length > 0) rawCity = parts[parts.length - 1];
    }
    const loc = resolveLocationInfo(rawCity, formFullAddress);
    const cityName = loc.city;

    const payload = {
      name: formName.trim().toUpperCase(),
      phone: cleanPhone,
      city: cityName,
      address: formFullAddress.trim(),
      status: formStatus
    };

    setIsSaving(true);
    setFormError('');

    try {
      if (ghnEditId) {
        // Real API Update
        await adminService.updateAdminCinemaById(token, ghnEditId, payload);
        showToast?.(`Đã cập nhật chi nhánh "${payload.name}" thành công!`, 'success');
        triggerLocalToast(`Đã cập nhật cụm rạp: ${payload.name}`);
        addAuditLog?.('Cập nhật cụm rạp', `${payload.name} (ID: ${ghnEditId})`);
      } else {
        // Real API Create
        const created = await adminService.createAdminCinema(token, payload);
        showToast?.(`Đã tạo mới chi nhánh "${payload.name}" thành công!`, 'success');
        triggerLocalToast(`Đã tạo mới: ${payload.name} trên sa bàn 3D chữ S!`);
        addAuditLog?.('Tạo cụm rạp mới', payload.name);
        if (created?.id) setSelectedCinemaId(created.id);
      }

      closeGhnModal();
      await loadData();
      onCinemaChanged?.();
    } catch (err) {
      console.error("Lỗi lưu chi nhánh rạp:", err);
      const msg = err.status === 409 || String(err.message).toLowerCase().includes('already exists')
        ? `Tên rạp "${payload.name}" đã tồn tại trên hệ thống. Vui lòng chọn tên khác.`
        : err.message || 'Không thể lưu thông tin chi nhánh rạp.';
      setFormError(msg);
    } finally {
      setIsSaving(false);
    }
  };

  // Delete Cinema
  const openDeleteModal = (cinema) => {
    if (!isEffectiveAdmin) {
      showToast?.('Chỉ Quản trị viên hệ thống (Admin) mới có quyền xóa chi nhánh rạp.', 'warning');
      return;
    }
    setDeleteConfirmCinema(cinema);
  };

  const handleConfirmDelete = async () => {
    if (!deleteConfirmCinema) return;
    const token = getAdminToken();
    if (!token) return;

    if (cinemas.length <= 1) {
      showToast?.("Hệ thống cần duy trì tối thiểu 1 cụm rạp!", "warning");
      setDeleteConfirmCinema(null);
      return;
    }

    setIsDeleting(true);
    try {
      await adminService.deleteAdminCinema(token, deleteConfirmCinema.id);
      showToast?.(`Đã xóa cụm rạp "${deleteConfirmCinema.name}" thành công!`, 'success');
      triggerLocalToast(`Đã xóa cụm rạp: ${deleteConfirmCinema.name}`);
      addAuditLog?.('Xóa cụm rạp', `${deleteConfirmCinema.name} (ID: ${deleteConfirmCinema.id})`);
      
      const remaining = cinemas.filter(c => c.id !== deleteConfirmCinema.id);
      if (remaining.length > 0) {
        setSelectedCinemaId(remaining[0].id);
      }
      setDeleteConfirmCinema(null);
      await loadData();
      onCinemaChanged?.();
    } catch (err) {
      showToast?.(err.message || 'Không thể xóa cụm rạp.', 'error');
    } finally {
      setIsDeleting(false);
    }
  };

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className={`relative flex flex-col bg-[#04060a] text-[#f5f5f5] select-none overflow-hidden transition-all duration-300 ${
      isFullscreen
        ? "fixed inset-0 z-[100] w-screen h-screen"
        : "w-full h-[calc(100vh-100px)] min-h-[720px] rounded-xl border border-[#1c2230] shadow-2xl"
    }`}>
      {/* Dynamic CSS Styles */}
      <style>{`
        .stage-3d { perspective: 1400px; transform-style: preserve-3d; }
        .map-callout-card {
          background: linear-gradient(135deg, rgba(13, 17, 26, 0.92) 0%, rgba(7, 10, 16, 0.95) 100%);
          backdrop-filter: blur(12px);
          border: 1px solid rgba(56, 189, 248, 0.22);
          box-shadow: 0 12px 30px rgba(0, 0, 0, 0.85), inset 0 1px 0 rgba(255, 255, 255, 0.08);
          transition: border-color 0.22s ease, box-shadow 0.22s ease;
        }
        .map-callout-card:hover {
          border-color: rgba(245, 158, 11, 0.8);
          box-shadow: 0 0 22px rgba(245, 158, 11, 0.35), 0 14px 32px rgba(0, 0, 0, 0.9);
        }
        .map-callout-card.active-callout {
          background: linear-gradient(135deg, rgba(28, 21, 9, 0.96) 0%, rgba(12, 14, 20, 0.96) 100%);
          border: 1.5px solid #f59e0b;
          box-shadow: 0 0 28px rgba(245, 158, 11, 0.42), inset 0 0 15px rgba(245, 158, 11, 0.12);
        }
        .inspector-3d-wrap { perspective: 1300px; }
        .inspector-panel {
          position: relative;
          background: linear-gradient(160deg, rgba(14, 18, 26, 0.95) 0%, rgba(8, 10, 15, 0.97) 100%);
          backdrop-filter: blur(20px);
          border: 1.5px solid rgba(245, 158, 11, 0.65);
          box-shadow: 0 30px 70px rgba(0, 0, 0, 0.95), 0 0 40px rgba(245, 158, 11, 0.16), inset 0 0 28px rgba(6, 182, 212, 0.07);
          transform-style: preserve-3d;
          transition: transform 0.15s ease-out, box-shadow 0.25s ease;
        }
        .inspector-panel::before {
          content: "";
          position: absolute;
          inset: 0;
          border-radius: 0.85rem;
          background: repeating-linear-gradient(to bottom, transparent 0px, transparent 3px, rgba(56, 189, 248, 0.025) 4px);
          pointer-events: none;
        }
        .cyber-corner {
          position: absolute;
          width: 12px;
          height: 12px;
          border-color: #f59e0b;
          pointer-events: none;
          z-index: 20;
        }
        .cyber-tl { top: -1px; left: -1px; border-top: 2.5px solid #f59e0b; border-left: 2.5px solid #f59e0b; border-top-left-radius: 10px; }
        .cyber-tr { top: -1px; right: -1px; border-top: 2.5px solid #06b6d4; border-right: 2.5px solid #06b6d4; border-top-right-radius: 10px; }
        .cyber-bl { bottom: -1px; left: -1px; border-bottom: 2.5px solid #06b6d4; border-left: 2.5px solid #06b6d4; border-bottom-left-radius: 10px; }
        .cyber-br { bottom: -1px; right: -1px; border-bottom: 2.5px solid #f59e0b; border-right: 2.5px solid #f59e0b; border-bottom-right-radius: 10px; }
        .carousel-3d-stage { perspective: 1600px; transform-style: preserve-3d; }
        .carousel-3d-card {
          position: absolute;
          top: 50%;
          left: 50%;
          width: 350px;
          margin-left: -175px;
          margin-top: -210px;
          transform-style: preserve-3d;
          transition: all 0.55s cubic-bezier(0.16, 1, 0.3, 1);
          background: linear-gradient(155deg, rgba(16, 20, 30, 0.95), rgba(8, 10, 15, 0.98));
          border: 1.5px solid rgba(255, 255, 255, 0.14);
          box-shadow: 0 25px 60px rgba(0, 0, 0, 0.9);
        }
        .carousel-3d-card.active-3d-card {
          border-color: #f59e0b;
          box-shadow: 0 0 45px rgba(245, 158, 11, 0.32), 0 30px 70px rgba(0, 0, 0, 0.95);
        }
        .ghn-modal-box {
          background-color: #0d0d0d;
          border: 1px solid #262626;
          box-shadow: 0 25px 70px rgba(0, 0, 0, 0.95);
        }
        .ghn-input {
          background-color: #080808;
          border: 1px solid #1f1f1f;
          color: #f5f5f5;
          transition: border-color 0.15s ease;
        }
        .ghn-input:focus {
          outline: none;
          border-color: #f59e0b;
        }
        .ghn-input::placeholder { color: #525252; }
        @keyframes pulseDash { to { stroke-dashoffset: -24; } }
        .animated-tether { animation: pulseDash 1s linear infinite; }
      `}</style>

      {/* ===================================================================== */}
      {/* TOP COMMAND BAR (MAXIMIZES 3D HOLOGRAM VIEWPORT)                      */}
      {/* ===================================================================== */}
      <header className="shrink-0 bg-[#080b11]/95 backdrop-blur-md border-b border-[#1c2230] px-4 lg:px-6 py-2.5 z-30">
        <div className="max-w-[1920px] mx-auto flex flex-wrap items-center justify-between gap-3">

          {/* Left: Brand Title & Live KPI Badges */}
          <div className="flex items-center gap-4">
            <div>
              <div className="flex items-center gap-1.5 text-[10px] font-extrabold tracking-widest uppercase text-[#f59e0b]">
                <Building2 className="w-3.5 h-3.5" />
                <span>HỆ THỐNG ĐA CỤM RẠP TOÀN QUỐC • SA BÀN 3D HOLOGRAM DẢI CHỮ S</span>
              </div>
              <h1 className="text-base sm:text-lg font-black tracking-tight text-white uppercase mt-0.5">
                QUẢN LÝ TOÀN BỘ CHI NHÁNH RẠP
              </h1>
            </div>

            {/* Compact Live KPI Pills */}
            <div className="hidden xl:flex items-center gap-2 pl-4 border-l border-[#1f2433]">
              <div className="bg-[#0e121b] border border-[#23293a] rounded px-2.5 py-1 flex items-center gap-1.5 text-xs">
                <span className="text-[#8a8f9e] text-[10px] font-bold uppercase">Tổng rạp</span>
                <span className="font-black text-white font-mono">{cinemas.length}</span>
              </div>
              <div className="bg-[#0e121b] border border-[#23293a] rounded px-2.5 py-1 flex items-center gap-1.5 text-xs">
                <span className="text-[#10b981] text-[10px] font-bold uppercase">Hoạt động</span>
                <span className="font-black text-[#10b981] font-mono">
                  {cinemas.filter(c => c.active).length}
                </span>
              </div>
              <div className="bg-[#0e121b] border border-[#23293a] rounded px-2.5 py-1 flex items-center gap-1.5 text-xs">
                <span className="text-[#f59e0b] text-[10px] font-bold uppercase">Tỉnh / TP</span>
                <span className="font-black text-[#f59e0b] font-mono">
                  {new Set(cinemas.map(c => c.city)).size}
                </span>
              </div>
              <div className="bg-[#0e121b] border border-[#23293a] rounded px-2.5 py-1 flex items-center gap-1.5 text-xs">
                <span className="text-[#06b6d4] text-[10px] font-bold uppercase">Phòng chiếu</span>
                <span className="font-black text-[#06b6d4] font-mono">
                  {cinemas.reduce((sum, c) => sum + Number(c.rooms || 0), 0)}
                </span>
              </div>
            </div>
          </div>

          {/* Center: Search + City Filter Pills + 3D Experience Mode Switcher */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative w-44 sm:w-52">
              <Search className="w-3.5 h-3.5 text-[#737373] absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Tìm tên rạp, địa chỉ..."
                className="w-full bg-[#07090e] border border-[#242a38] focus:border-[#f59e0b] rounded pl-8 pr-3 py-1.5 text-xs text-white placeholder-[#666] focus:outline-none transition"
              />
            </div>

            {/* City Filter Pills */}
            <div className="flex items-center bg-[#07090e] border border-[#242a38] rounded p-0.5 text-[11px] font-bold max-w-[500px] overflow-x-auto [scrollbar-width:none]">
              <button
                type="button"
                onClick={() => { setCurrentCityFilter("ALL"); flyToVietnamOverview(); }}
                className={`px-2.5 py-1 rounded-sm whitespace-nowrap transition ${
                  currentCityFilter === "ALL"
                    ? "bg-[#f59e0b] text-black font-extrabold"
                    : "text-[#a3a3a3] hover:text-white"
                }`}
              >
                🇻🇳 Tất cả ({cinemas.length})
              </button>
              {(() => {
                const uniqueCities = Array.from(new Set(cinemas.map(c => c.city))).filter(Boolean);
                uniqueCities.sort((a, b) => {
                  const locA = resolveLocationInfo(a, '');
                  const locB = resolveLocationInfo(b, '');
                  return locB.lat - locA.lat;
                });

                return uniqueCities.map(cityName => {
                  const count = cinemas.filter(c => c.city === cityName).length;
                  const label = cityName.replace(/^(TP\.?\s*|TỈNH\s*)/i, '');
                  return (
                    <button
                      key={cityName}
                      type="button"
                      onClick={() => {
                        setCurrentCityFilter(cityName);
                        const first = cinemas.find(c => c.city === cityName);
                        if (first) selectCinema(first.id, true);
                      }}
                      className={`px-2.5 py-1 rounded-sm whitespace-nowrap transition ${
                        currentCityFilter === cityName
                          ? "bg-[#f59e0b] text-black font-extrabold"
                          : "text-[#a3a3a3] hover:text-white"
                      }`}
                    >
                      {label} ({count})
                    </button>
                  );
                });
              })()}
            </div>

            {/* 3D Mode Switcher: Sa Bàn Chữ S vs Vòng Xoay Không Gian 3D */}
            <div className="flex items-center bg-[#07090e] border border-[#06b6d4]/40 rounded p-0.5 text-[11px] font-extrabold">
              <button
                type="button"
                onClick={() => setDisplayMode3D("MAP")}
                className={`px-2.5 py-1 rounded-sm transition flex items-center gap-1 ${
                  displayMode3D === "MAP"
                    ? "bg-[#06b6d4] text-black"
                    : "text-[#06b6d4] hover:text-white"
                }`}
              >
                <span>🗺️ Sa Bàn Chữ S 3D</span>
              </button>
              <button
                type="button"
                onClick={() => setDisplayMode3D("CAROUSEL")}
                className={`px-2.5 py-1 rounded-sm transition flex items-center gap-1 ${
                  displayMode3D === "CAROUSEL"
                    ? "bg-[#06b6d4] text-black"
                    : "text-[#06b6d4] hover:text-white"
                }`}
              >
                <span>🎠 Vòng Xoay Thẻ 3D</span>
              </button>
            </div>
          </div>

          {/* Right: Actions */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setAutoOrbitEnabled(prev => !prev)}
              className={`border font-bold text-xs px-3 py-1.5 rounded flex items-center gap-1.5 transition ${
                autoOrbitEnabled
                  ? "bg-[#f59e0b] text-black border-[#f59e0b] font-extrabold shadow-lg shadow-amber-500/30"
                  : "bg-[#111520] hover:bg-[#191f2e] border-[#283044] text-[#d4d4d4]"
              }`}
            >
              <span className={autoOrbitEnabled ? "animate-spin inline-block" : ""}>🔄</span>
              <span>
                {displayMode3D === "CAROUSEL"
                  ? (autoOrbitEnabled ? "DỪNG TỰ XOAY" : "TỰ ĐỘNG XOAY THẺ")
                  : (autoOrbitEnabled ? "DỪNG XOAY 3D" : "XOAY 3D")}
              </span>
            </button>
            <button
              type="button"
              onClick={flyToVietnamOverview}
              className="bg-[#111520] hover:bg-[#191f2e] border border-[#f59e0b]/45 text-[#f59e0b] font-bold text-xs px-3 py-1.5 rounded flex items-center gap-1.5 transition"
            >
              <span>🗺️ TOÀN CẢNH CHỮ S</span>
            </button>
            {displayMode3D === "MAP" && (
              <button
                type="button"
                onClick={() => {
                  setShowCallouts(prev => {
                    const next = !prev;
                    triggerLocalToast(next ? "Đã hiện thẻ thông tin rạp trên bản đồ 3D" : "Đã ẩn thẻ thông tin rạp để nhìn rõ sa bàn 3D");
                    return next;
                  });
                }}
                title={showCallouts ? "Ẩn các thẻ thông tin cụm rạp trên sa bàn 3D" : "Hiện các thẻ thông tin cụm rạp trên sa bàn 3D"}
                className={`border font-bold text-xs px-3 py-1.5 rounded flex items-center gap-1.5 transition ${
                  showCallouts
                    ? "bg-[#111520] hover:bg-[#191f2e] border-[#283044] text-[#d4d4d4]"
                    : "bg-[#f59e0b]/20 hover:bg-[#f59e0b]/30 border-[#f59e0b] text-[#f59e0b] font-extrabold shadow-md shadow-amber-500/20"
                }`}
              >
                {showCallouts ? <EyeOff className="w-3.5 h-3.5 text-[#06b6d4]" /> : <Eye className="w-3.5 h-3.5 text-[#f59e0b]" />}
                <span>{showCallouts ? "ẨN THẺ RẠP" : "HIỆN THẺ RẠP"}</span>
              </button>
            )}
            <button
              type="button"
              onClick={() => setIsFullscreen(prev => !prev)}
              title={isFullscreen ? "Thu nhỏ cửa sổ" : "Mở rộng toàn màn hình"}
              className="bg-[#111520] hover:bg-[#191f2e] border border-[#283044] text-[#a3a3a3] hover:text-white text-xs p-1.5 rounded flex items-center transition"
            >
              {isFullscreen ? <Minimize2 className="w-4 h-4 text-[#f59e0b]" /> : <Maximize2 className="w-4 h-4" />}
            </button>
            {isEffectiveAdmin && (
              <button
                type="button"
                onClick={() => openGhnModal()}
                className="bg-[#f59e0b] hover:bg-[#fbbf24] active:scale-95 text-black font-extrabold text-xs px-3.5 py-1.5 rounded flex items-center gap-1.5 transition shadow-lg shadow-amber-500/20"
              >
                <Plus className="w-4 h-4 stroke-[3]" />
                <span>THÊM CHI NHÁNH RẠP MỚI</span>
              </button>
            )}
          </div>
        </div>
      </header>

      {/* ===================================================================== */}
      {/* MAIN 3D HOLOGRAM WORKSPACE                                            */}
      {/* ===================================================================== */}
      <main ref={viewportRef} className="relative flex-1 w-full h-full overflow-hidden stage-3d">

        {/* Three.js Canvas */}
        <canvas ref={canvasRef} className="block w-full h-full cursor-grab active:cursor-grabbing" />

        {/* Crisp SVG Layer for Leader Lines & Hologram Tether */}
        <svg className="absolute inset-0 w-full h-full pointer-events-none z-10 overflow-visible">
          <defs>
            <filter id="glow-amber" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="2.5" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>
          <g ref={svgLinesRef} />
          <g ref={svgTetherRef} />
        </svg>

        {/* 2D Callouts Layer (Visible in MAP mode) */}
        <div
          ref={labelsOverlayRef}
          className={`absolute inset-0 w-full h-full pointer-events-none z-20 overflow-hidden ${
            displayMode3D === "MAP" ? "" : "hidden"
          }`}
        >
          {/* Sovereign Island Badges */}
          <div
            id="island-badge-HS"
            onClick={() => flyToIsland("HOANG_SA")}
            className="pointer-events-auto cursor-pointer absolute top-0 left-0 bg-[#141109]/92 border border-[#f59e0b]/65 rounded px-2.5 py-1 shadow-xl hover:scale-105 transition"
          >
            <div className="text-[10px] font-black uppercase text-[#fde047] flex items-center gap-1">
              <span className="text-red-500 font-bold">★</span>
              <span>QUẦN ĐẢO HOÀNG SA</span>
            </div>
            <div className="text-[9px] font-bold text-[#a3a3a3] uppercase">TP. ĐÀ NẴNG • VIỆT NAM</div>
          </div>

          <div
            id="island-badge-TS"
            onClick={() => flyToIsland("TRUONG_SA")}
            className="pointer-events-auto cursor-pointer absolute top-0 left-0 bg-[#141109]/92 border border-[#f59e0b]/65 rounded px-2.5 py-1 shadow-xl hover:scale-105 transition"
          >
            <div className="text-[10px] font-black uppercase text-[#fde047] flex items-center gap-1">
              <span className="text-red-500 font-bold">★</span>
              <span>QUẦN ĐẢO TRƯỜNG SA</span>
            </div>
            <div className="text-[9px] font-bold text-[#a3a3a3] uppercase">TỈNH KHÁNH HÒA • VIỆT NAM</div>
          </div>

          {/* Dynamic Cinema 2D Callout Cards */}
          {showCallouts && filteredCinemas.map(c => {
            const isSel = c.id === selectedCinemaId;
            const dotColor = c.active ? 'bg-[#10b981]' : 'bg-red-500';
            return (
              <div
                key={c.id}
                id={`callout-card-${c.id}`}
                onClick={() => selectCinema(c.id, true)}
                className={`map-callout-card pointer-events-auto cursor-pointer absolute top-0 left-0 w-[205px] rounded-lg px-2.5 py-1.5 ${
                  isSel ? 'active-callout' : ''
                }`}
              >
                <div className="flex items-center justify-between text-[9px] font-extrabold uppercase tracking-wider">
                  <span className="text-[#f59e0b] truncate">{c.city}</span>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <span className="text-[#8a8f9e] font-mono">#{c.id}</span>
                    <span className={`w-1.5 h-1.5 rounded-full ${dotColor}`} />
                    {isEffectiveAdmin && (
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); openGhnModal(c.id); }}
                        title="Chỉnh sửa nhanh rạp này"
                        className="text-[#a3a3a3] hover:text-[#f59e0b] px-1 rounded bg-white/5 hover:bg-white/10 transition"
                      >
                        ✏️ Sửa
                      </button>
                    )}
                  </div>
                </div>
                <div className="text-[11px] font-black uppercase text-white truncate mt-0.5">
                  {c.name.replace(/CINEMAAI\s*|CINEPREMIER\s*/i, '')}
                </div>
                <div className="flex items-center justify-between text-[10px] mt-0.5 font-mono">
                  <span className="text-[#a3a3a3] truncate max-w-[110px]">{c.phone}</span>
                  {c.rooms > 0 ? (
                    <span className="text-[#06b6d4] font-bold">{c.rooms} phòng</span>
                  ) : (
                    <span className="text-[#737373]">0 phòng</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* 3D Coverflow Carousel Layer (Visible in CAROUSEL mode) */}
        {displayMode3D === "CAROUSEL" && (
          <div
            className="absolute inset-0 z-20 flex items-center justify-center overflow-hidden"
            onWheel={handleCarouselWheel}
            onPointerDown={handleCarouselPointerDown}
            onPointerUp={handleCarouselPointerUp}
          >
            {/* Big Left Floating Navigation Arrow */}
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); rotateCarousel(-1); }}
              className="absolute left-4 sm:left-8 top-1/2 -translate-y-1/2 z-40 w-12 h-12 sm:w-14 sm:h-14 rounded-full bg-[#0c1018]/90 hover:bg-[#f59e0b] hover:text-black border border-[#2c364f] hover:border-[#f59e0b] text-white flex items-center justify-center text-xl font-black shadow-2xl transition-all duration-200 active:scale-95 group"
              title="Rạp trước (Phím ← hoặc kéo chuột sang phải)"
            >
              <span className="group-hover:-translate-x-0.5 transition-transform text-lg sm:text-xl">◀</span>
            </button>

            {/* Big Right Floating Navigation Arrow */}
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); rotateCarousel(1); }}
              className="absolute right-4 sm:right-8 top-1/2 -translate-y-1/2 z-40 w-12 h-12 sm:w-14 sm:h-14 rounded-full bg-[#0c1018]/90 hover:bg-[#f59e0b] hover:text-black border border-[#2c364f] hover:border-[#f59e0b] text-white flex items-center justify-center text-xl font-black shadow-2xl transition-all duration-200 active:scale-95 group"
              title="Rạp tiếp theo (Phím → hoặc kéo chuột sang trái)"
            >
              <span className="group-hover:translate-x-0.5 transition-transform text-lg sm:text-xl">▶</span>
            </button>

            {/* 3D Stage with Cards */}
            <div className="carousel-3d-stage relative w-full h-full">
              {(() => {
                const sorted = [...filteredCinemas].sort((a, b) => b.lat - a.lat);
                const activeIdx = Math.max(0, sorted.findIndex(c => String(c.id) === String(selectedCinemaId)));

                return sorted.map((c, idx) => {
                  const offset = idx - activeIdx;
                  const absOff = Math.abs(offset);
                  const translateX = offset * 260;
                  const translateZ = -absOff * 145;
                  const rotateY = offset * -28;
                  const opacity = absOff > 3 ? 0 : (1 - absOff * 0.2);
                  const zIndex = 50 - absOff;
                  const isSel = String(c.id) === String(selectedCinemaId);

                  return (
                    <div
                      key={c.id}
                      onClick={() => selectCinema(c.id, true)}
                      style={{
                        transform: `translate3d(${translateX}px, 0px, ${translateZ}px) rotateY(${rotateY}deg)`,
                        opacity,
                        zIndex,
                        pointerEvents: opacity === 0 ? 'none' : 'auto'
                      }}
                      className={`carousel-3d-card cursor-pointer rounded-2xl p-5 select-none ${
                        isSel ? 'active-3d-card' : 'hover:border-[#f59e0b]/70 hover:scale-[1.02]'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="px-2.5 py-0.5 rounded text-[10px] font-extrabold uppercase bg-[#f59e0b]/15 text-[#f59e0b] border border-[#f59e0b]/45">
                          {c.city}
                        </span>
                        <span className="text-xs font-mono font-bold text-[#8a8f9e]">ID #{c.id}</span>
                      </div>
                      <h3 className="text-base font-black uppercase text-white mt-2.5">{c.name}</h3>
                      <p className="text-xs text-[#a3a3a3] mt-2 line-clamp-2">{c.address}</p>
                      <div className="mt-3 pt-3 border-t border-white/10 flex items-center justify-between text-xs font-mono">
                        <span className="text-[#f59e0b]">📞 {c.phone}</span>
                        <span className="text-[#06b6d4] font-bold">{c.rooms} phòng chiếu</span>
                      </div>
                      <div className="mt-4 flex items-center justify-between gap-2">
                        {isEffectiveAdmin && (
                          <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); openGhnModal(c.id); }}
                            className="flex-1 bg-[#f59e0b] text-black font-extrabold text-[11px] py-2 rounded uppercase hover:bg-[#fbbf24] transition shadow-md"
                          >
                            ✏️ Chỉnh sửa
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setDisplayMode3D("MAP");
                            selectCinema(c.id, true);
                          }}
                          className="flex-1 bg-[#141a29] border border-[#2c364f] hover:border-[#f59e0b] text-white font-extrabold text-[11px] py-2 rounded uppercase transition"
                        >
                          🗺️ Định vị Chữ S
                        </button>
                      </div>
                    </div>
                  );
                });
              })()}
            </div>

            {/* Bottom Carousel Floating Controller & Pagination Dots */}
            <div className="absolute bottom-16 left-1/2 -translate-x-1/2 z-30 flex items-center gap-3 bg-[#090c14]/95 backdrop-blur-md px-4 py-2 rounded-full border border-[#252b3b] shadow-2xl">
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); rotateCarousel(-1); }}
                className="w-7 h-7 rounded-full bg-[#141824] hover:bg-[#f59e0b] hover:text-black text-white flex items-center justify-center text-xs font-black transition active:scale-95"
                title="Rạp trước (←)"
              >
                ◀
              </button>

              {/* Dots */}
              <div className="flex items-center gap-1.5 px-1">
                {(() => {
                  const sorted = [...filteredCinemas].sort((a, b) => b.lat - a.lat);
                  return sorted.map((c) => {
                    const isCur = String(c.id) === String(selectedCinemaId);
                    return (
                      <button
                        key={c.id}
                        type="button"
                        onClick={(e) => { e.stopPropagation(); selectCinema(c.id, true); }}
                        title={c.name}
                        className={`transition-all duration-300 rounded-full ${
                          isCur
                            ? "w-6 h-2 bg-[#f59e0b] shadow-md shadow-amber-500/50"
                            : "w-2 h-2 bg-white/25 hover:bg-white/60"
                        }`}
                      />
                    );
                  });
                })()}
              </div>

              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); rotateCarousel(1); }}
                className="w-7 h-7 rounded-full bg-[#141824] hover:bg-[#f59e0b] hover:text-black text-white flex items-center justify-center text-xs font-black transition active:scale-95"
                title="Rạp tiếp theo (→)"
              >
                ▶
              </button>

              <div className="h-4 w-px bg-white/10 mx-1" />

              {/* Auto Rotate Toggle on the Carousel Bar */}
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); setAutoOrbitEnabled(prev => !prev); }}
                className={`text-[10px] font-extrabold uppercase px-2.5 py-1 rounded-full transition flex items-center gap-1.5 ${
                  autoOrbitEnabled
                    ? "bg-[#f59e0b] text-black shadow-md shadow-amber-500/30"
                    : "bg-[#141824] hover:bg-[#1f2538] text-[#a3a3a3] hover:text-white"
                }`}
              >
                <span className={autoOrbitEnabled ? "animate-spin inline-block" : ""}>🔄</span>
                <span>{autoOrbitEnabled ? "Đang Tự Xoay" : "Tự Động Xoay"}</span>
              </button>
            </div>
          </div>
        )}

        {/* ================================================================= */}
        {/* COLLAPSIBLE LEFT S-SHAPE DRAWER                                   */}
        {/* ================================================================= */}
        <div className="absolute top-3 left-3 z-30 flex flex-col items-start gap-2">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setIsLeftDrawerOpen(prev => !prev)}
              className="bg-[#0c1018]/90 hover:bg-[#141b28] border border-[#f59e0b]/45 text-[#f59e0b] text-[11px] font-extrabold uppercase tracking-wider px-3 py-1.5 rounded-lg shadow-xl flex items-center gap-2 transition"
            >
              <Compass className="w-3.5 h-3.5" />
              <span>HÀNH TRÌNH DẢI CHỮ S</span>
              <span className="text-xs">{isLeftDrawerOpen ? "▲" : "▼"}</span>
            </button>

            {displayMode3D === "MAP" && (
              <button
                type="button"
                onClick={() => {
                  setShowCallouts(prev => {
                    const next = !prev;
                    triggerLocalToast(next ? "Đã hiện thẻ thông tin rạp trên bản đồ 3D" : "Đã ẩn thẻ thông tin rạp để nhìn rõ sa bàn 3D");
                    return next;
                  });
                }}
                title={showCallouts ? "Ẩn các thẻ thông tin cụm rạp trên sa bàn 3D" : "Hiện các thẻ thông tin cụm rạp trên sa bàn 3D"}
                className={`text-[11px] font-extrabold uppercase tracking-wider px-3 py-1.5 rounded-lg shadow-xl flex items-center gap-1.5 transition border backdrop-blur-md ${
                  showCallouts
                    ? "bg-[#0c1018]/90 hover:bg-[#141b28] border-[#242b3d] text-[#e2e8f0]"
                    : "bg-[#f59e0b]/20 hover:bg-[#f59e0b]/30 border-[#f59e0b] text-[#f59e0b]"
                }`}
              >
                {showCallouts ? <EyeOff className="w-3.5 h-3.5 text-[#06b6d4]" /> : <Eye className="w-3.5 h-3.5 text-[#f59e0b]" />}
                <span>{showCallouts ? "Ẩn nhãn rạp" : "Hiện nhãn rạp"}</span>
              </button>
            )}
          </div>

          {isLeftDrawerOpen && (
            <div className="w-[250px] max-h-[calc(100vh-220px)] overflow-y-auto bg-[#0b0e16]/92 backdrop-blur-xl border border-[#242b3d] rounded-xl p-3 shadow-2xl space-y-2.5">
              <div className="flex items-center justify-between border-b border-[#1d2332] pb-2">
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-[#f59e0b]">
                  ● BẮC ➔ TRUNG ➔ NAM
                </span>
                <button
                  type="button"
                  onClick={flyToVietnamOverview}
                  className="text-[10px] font-bold px-2 py-0.5 rounded bg-[#06b6d4]/15 text-[#06b6d4] border border-[#06b6d4]/30 hover:bg-[#06b6d4] hover:text-black transition"
                >
                  Toàn quốc
                </button>
              </div>

              {(() => {
                const uniqueCities = Array.from(new Set(cinemas.map(c => c.city))).filter(Boolean);
                uniqueCities.sort((a, b) => {
                  const locA = resolveLocationInfo(a, '');
                  const locB = resolveLocationInfo(b, '');
                  return locB.lat - locA.lat;
                });

                return uniqueCities.map((cityName, idx) => {
                  const list = cinemas.filter(c => c.city === cityName);
                  return (
                    <div key={cityName} className="space-y-1">
                      <div
                        onClick={() => {
                          setCurrentCityFilter(cityName);
                          const first = cinemas.find(c => c.city === cityName);
                          if (first) selectCinema(first.id, true);
                        }}
                        className="cursor-pointer flex items-center justify-between text-[11px] font-extrabold text-white hover:text-[#f59e0b] transition"
                      >
                        <span>{idx < 9 ? `0${idx + 1}` : idx + 1} {cityName}</span>
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#06b6d4]/15 text-[#06b6d4]">
                          {list.length} rạp
                        </span>
                      </div>
                      <div className="space-y-1 pl-2 border-l border-[#242c40]">
                        {list.map(c => {
                          const isSel = String(c.id) === String(selectedCinemaId);
                          return (
                            <button
                              key={c.id}
                              type="button"
                              onClick={() => selectCinema(c.id, true)}
                              className={`w-full text-left px-2 py-1 rounded text-[10px] flex items-center justify-between transition ${
                                isSel
                                  ? 'bg-[#f59e0b] text-black font-extrabold'
                                  : 'bg-[#121622] hover:bg-[#1a2030] text-[#d4d4d4]'
                              }`}
                            >
                              <span className="truncate">● {c.name.replace(/CINEMAAI\s*|CINEPREMIER\s*/i, '')}</span>
                              <span className="font-mono ml-1">{c.rooms}P</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                });
              })()}
            </div>
          )}
        </div>

        {/* ================================================================= */}
        {/* UPGRADED 3D HOLOGRAM INSPECTOR CARD (RIGHT SIDE)                  */}
        {/* ================================================================= */}
        <aside className="inspector-3d-wrap absolute top-3 right-3 z-30 w-[370px] sm:w-[400px]">
          <div
            id="inspector-card"
            className="inspector-panel rounded-xl p-4"
            onPointerMove={(e) => {
              const card = e.currentTarget;
              const rect = card.getBoundingClientRect();
              const nx = ((e.clientX - rect.left) / rect.width) * 2 - 1;
              const ny = ((e.clientY - rect.top) / rect.height) * 2 - 1;
              card.style.transform = `rotateY(${nx * 6}deg) rotateX(${-ny * 5}deg) translateZ(6px)`;
            }}
            onPointerLeave={(e) => {
              e.currentTarget.style.transform = `rotateY(0deg) rotateX(0deg) translateZ(0px)`;
            }}
          >
            {/* Glowing Cyber Brackets */}
            <div className="cyber-corner cyber-tl" />
            <div className="cyber-corner cyber-tr" />
            <div className="cyber-corner cyber-bl" />
            <div className="cyber-corner cyber-br" />

            {/* Row 1: City Badge + ID + Active Status + Collapse Toggle */}
            <div className="flex items-center justify-between gap-2 relative z-10">
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-0.5 rounded text-[10px] font-extrabold uppercase tracking-wider bg-[#f59e0b]/15 text-[#f59e0b] border border-[#f59e0b]/50">
                  {selectedCinema?.city || "VIỆT NAM"}
                </span>
                <span className="text-xs font-mono font-bold text-[#8a8f9e]">
                  ID #{selectedCinema?.id || "---"}
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                {selectedCinema?.active ? (
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-[#10b981]/15 text-[#10b981] border border-[#10b981]/40 flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#10b981]" />
                    <span>HOẠT ĐỘNG</span>
                  </span>
                ) : (
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-amber-500/15 text-amber-400 border border-amber-500/40 flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                    <span>TẠM DỪNG</span>
                  </span>
                )}
                <button
                  type="button"
                  onClick={() => setInspectorMinimized(prev => !prev)}
                  title="Thu gọn / Mở rộng thẻ"
                  className="text-[#8a8f9e] hover:text-white p-1 rounded hover:bg-white/5 transition"
                >
                  <span className={`inline-block transition-transform ${inspectorMinimized ? "rotate-180" : ""}`}>
                    ▼
                  </span>
                </button>
              </div>
            </div>

            {/* Row 2: Cinema Branch Title */}
            <h2 className="text-lg font-black uppercase tracking-tight text-[#f59e0b] mt-1.5 leading-snug relative z-10">
              {selectedCinema?.name || "CINEMAAI SYSTEM"}
            </h2>

            {/* Collapsible Body */}
            {!inspectorMinimized && (
              <div className="mt-2.5 space-y-2.5 relative z-10">

                {/* Embedded 3D Hologram Turntable Preview (Tower vs IMAX Auditorium) */}
                <div className="relative bg-[#060911] border border-[#1f293d] rounded-lg overflow-hidden h-[118px]">
                  <canvas ref={miniCanvasRef} className="w-full h-full block" />

                  <div className="absolute top-2 left-2.5 flex items-center gap-1.5 pointer-events-none">
                    <span className="w-2 h-2 rounded-full bg-[#06b6d4] animate-ping" />
                    <span className="text-[10px] font-extrabold uppercase tracking-wider text-[#06b6d4]">
                      {miniPreviewMode === "TOWER"
                        ? `HOLOGRAM 3D: ${selectedCinema?.archName || "TÒA THÁP RẠP"}`
                        : `SƠ ĐỒ 3D: ${selectedCinema?.rooms || 0} PHÒNG CHIẾU IMAX KẾT NỐI`}
                    </span>
                  </div>

                  <div className="absolute top-1.5 right-2 flex items-center gap-1 bg-[#0b0f19]/90 border border-[#253047] rounded p-0.5">
                    <button
                      type="button"
                      onClick={() => setMiniPreviewMode("TOWER")}
                      className={`px-2 py-0.5 rounded-sm text-[9px] font-extrabold uppercase transition ${
                        miniPreviewMode === "TOWER"
                          ? "bg-[#f59e0b] text-black"
                          : "text-[#a3a3a3] hover:text-white"
                      }`}
                    >
                      🏢 Tòa tháp 3D
                    </button>
                    <button
                      type="button"
                      onClick={() => setMiniPreviewMode("HALL")}
                      className={`px-2 py-0.5 rounded-sm text-[9px] font-extrabold uppercase transition ${
                        miniPreviewMode === "HALL"
                          ? "bg-[#06b6d4] text-black"
                          : "text-[#a3a3a3] hover:text-white"
                      }`}
                    >
                      🎬 Phòng IMAX 3D
                    </button>
                  </div>

                  <div className="absolute bottom-1.5 left-2.5 right-2.5 flex items-center justify-between text-[10px] pointer-events-none">
                    <span className="text-[#8a8f9e] font-bold uppercase">
                      VỊ TRÍ CHỮ S: <strong className="text-white">{selectedCinema?.region || "MIỀN NAM"}</strong>
                    </span>
                    <span className="text-[#fde047] font-extrabold uppercase font-mono">
                      {selectedCinema?.archType || "KIẾN TRÚC 3D"}
                    </span>
                  </div>
                </div>

                {/* 3D Camera Navigation Box */}
                <div className="bg-[#080b12] border border-[#1e2433] rounded-lg p-2.5">
                  <div className="flex items-center justify-between text-[10px] font-extrabold uppercase tracking-wider mb-2">
                    <span className="text-[#a3a3a3] flex items-center gap-1">
                      <span>🎮</span>
                      <span>ĐIỀU HƯỚNG GÓC NHÌN 3D RẠP NÀY</span>
                    </span>
                    <button
                      type="button"
                      onClick={flyToVietnamOverview}
                      className="text-[#06b6d4] hover:underline"
                    >
                      TOÀN CẢNH CHỮ S
                    </button>
                  </div>
                  <div className="grid grid-cols-3 gap-1.5">
                    <button
                      type="button"
                      onClick={() => flyToSelectedCinema("DRONE")}
                      className="bg-[#121723] hover:bg-[#1c2334] border border-[#283147] hover:border-[#f59e0b] text-white text-[11px] font-bold py-1.5 px-2 rounded flex items-center justify-center gap-1 transition"
                    >
                      <span>🚁</span>
                      <span>Cận cảnh</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => flyToSelectedCinema("CITY")}
                      className="bg-[#121723] hover:bg-[#1c2334] border border-[#283147] hover:border-[#f59e0b] text-white text-[11px] font-bold py-1.5 px-2 rounded flex items-center justify-center gap-1 transition"
                    >
                      <span>🏙️</span>
                      <span>Vùng TP</span>
                    </button>
                    <button
                      type="button"
                      onClick={flyToVietnamOverview}
                      className="bg-[#121723] hover:bg-[#1c2334] border border-[#283147] hover:border-[#f59e0b] text-white text-[11px] font-bold py-1.5 px-2 rounded flex items-center justify-center gap-1 transition"
                    >
                      <span>🇻🇳</span>
                      <span>Chữ S</span>
                    </button>
                  </div>
                </div>

                {/* Address, Phone & Rooms count */}
                <div className="space-y-1.5 text-xs pt-0.5">
                  <div className="flex items-start gap-2.5">
                    <MapPin className="w-4 h-4 text-[#f59e0b] shrink-0 mt-0.5" />
                    <span className="text-[#d4d4d4] leading-relaxed">
                      {selectedCinema?.address || "Đang cập nhật địa chỉ"}
                    </span>
                  </div>

                  <div className="flex items-center gap-2.5">
                    <Phone className="w-4 h-4 text-[#f59e0b] shrink-0" />
                    <span className="text-white font-semibold font-mono">
                      {selectedCinema?.phone || "Chưa có hotline"}
                    </span>
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <Film className="w-4 h-4 text-[#06b6d4] shrink-0" />
                      <span className={`font-bold ${selectedCinema?.rooms > 0 ? "text-[#06b6d4]" : "text-[#737373]"}`}>
                        {selectedCinema?.rooms > 0
                          ? `${selectedCinema.rooms} phòng chiếu đang kết nối`
                          : "Chưa có phòng chiếu nào"}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        onSectionChange?.('rooms');
                        setMiniPreviewMode('HALL');
                      }}
                      className="text-[11px] font-semibold text-[#06b6d4] hover:underline"
                    >
                      Quản lý phòng →
                    </button>
                  </div>
                </div>

                {/* Action Buttons: CHỈNH SỬA | TẠM DỪNG | PHÒNG CHIẾU | XÓA */}
                <div className="pt-2 border-t border-[#1e2433] flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-1.5">
                    {isEffectiveAdmin && (
                      <button
                        type="button"
                        onClick={() => openGhnModal(selectedCinema?.id)}
                        className="bg-[#141824] hover:bg-[#22283a] border border-[#2c344a] hover:border-[#f59e0b] text-white text-[11px] font-extrabold uppercase px-3 py-1.5 rounded flex items-center gap-1.5 transition"
                      >
                        <Edit3 className="w-3.5 h-3.5 text-[#f59e0b]" />
                        <span>CHỈNH SỬA</span>
                      </button>
                    )}

                    {isEffectiveAdmin && selectedCinema && (
                      <button
                        type="button"
                        onClick={() => handleToggleStatus(selectedCinema)}
                        className="bg-[#141824] hover:bg-[#22283a] border border-[#2c344a] text-[#d4d4d4] hover:text-white text-[11px] font-extrabold uppercase px-3 py-1.5 rounded flex items-center gap-1.5 transition"
                      >
                        <Power className="w-3.5 h-3.5" />
                        <span>{selectedCinema.active ? "⏻ TẠM DỪNG" : "⚡ KÍCH HOẠT"}</span>
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => onSectionChange?.('rooms')}
                      className="bg-[#06b6d4]/15 hover:bg-[#06b6d4]/25 border border-[#06b6d4]/45 text-[#06b6d4] text-[11px] font-extrabold uppercase px-3 py-1.5 rounded transition"
                    >
                      PHÒNG CHIẾU
                    </button>
                  </div>

                  {isEffectiveAdmin && selectedCinema && (
                    <button
                      type="button"
                      onClick={() => openDeleteModal(selectedCinema)}
                      title="Xóa chi nhánh rạp"
                      className="text-[#737373] hover:text-red-400 p-1.5 rounded hover:bg-red-500/10 transition"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>

                {/* North-to-South Cinema Stepper */}
                <div className="pt-2 border-t border-[#1e2433] flex items-center justify-between text-[11px] font-bold">
                  <button
                    type="button"
                    onClick={() => stepCinemaNorthSouth(-1)}
                    className="text-[#a3a3a3] hover:text-white transition flex items-center gap-1"
                  >
                    <span>◀ Rạp trước (Bắc)</span>
                  </button>
                  <span className="text-[#f59e0b] font-extrabold uppercase tracking-wider">
                    {(() => {
                      const sorted = [...cinemas].sort((a, b) => b.lat - a.lat);
                      const idx = sorted.findIndex(c => c.id === selectedCinema?.id);
                      return `RẠP ${idx >= 0 ? idx + 1 : 1} / ${sorted.length} (BẮC ➔ NAM)`;
                    })()}
                  </span>
                  <button
                    type="button"
                    onClick={() => stepCinemaNorthSouth(1)}
                    className="text-[#a3a3a3] hover:text-white transition flex items-center gap-1"
                  >
                    <span>Rạp tiếp (Nam) ▶</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </aside>

        {/* ================================================================= */}
        {/* COMPACT BOTTOM DOCK: QUICK S-SHAPE NAVIGATION                     */}
        {/* ================================================================= */}
        <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-30 flex flex-col items-center gap-1.5 max-w-[96vw]">
          <div className="bg-[#090c14]/95 backdrop-blur-md border border-[#23293a] rounded-xl px-2.5 py-1.5 flex items-center gap-1.5 shadow-2xl overflow-x-auto max-w-full">
            <button
              type="button"
              onClick={flyToVietnamOverview}
              className="shrink-0 px-2.5 py-1 rounded bg-[#f59e0b] text-black font-extrabold text-[11px] transition"
            >
              🇻🇳 Chữ S
            </button>
            <button
              type="button"
              onClick={() => flyToIsland("HOANG_SA")}
              className="shrink-0 px-2 py-1 rounded bg-[#141720] hover:bg-[#1e222f] text-[#fde047] border border-[#f59e0b]/30 font-bold text-[11px] transition"
            >
              ★ Hoàng Sa
            </button>
            <button
              type="button"
              onClick={() => flyToIsland("TRUONG_SA")}
              className="shrink-0 px-2 py-1 rounded bg-[#141720] hover:bg-[#1e222f] text-[#fde047] border border-[#f59e0b]/30 font-bold text-[11px] transition"
            >
              ★ Trường Sa
            </button>
            {displayMode3D === "MAP" && (
              <button
                type="button"
                onClick={() => {
                  setShowCallouts(prev => {
                    const next = !prev;
                    triggerLocalToast(next ? "Đã hiện thẻ thông tin rạp trên bản đồ 3D" : "Đã ẩn thẻ thông tin rạp để nhìn rõ sa bàn 3D");
                    return next;
                  });
                }}
                className={`shrink-0 px-2.5 py-1 rounded border font-bold text-[11px] flex items-center gap-1.5 transition ${
                  showCallouts
                    ? "bg-[#141720] hover:bg-[#1e222f] text-[#06b6d4] border-[#06b6d4]/40"
                    : "bg-[#f59e0b]/20 hover:bg-[#f59e0b]/30 text-[#f59e0b] border-[#f59e0b]"
                }`}
                title={showCallouts ? "Ẩn các thẻ rạp trên sa bàn 3D" : "Hiện các thẻ rạp trên sa bàn 3D"}
              >
                {showCallouts ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                <span>{showCallouts ? "Ẩn nhãn rạp" : "Hiện nhãn rạp"}</span>
              </button>
            )}
            <div className="h-4 w-[1px] bg-[#252b3b] mx-0.5 shrink-0" />
            <div className="flex items-center gap-1.5 overflow-x-auto">
              {[...filteredCinemas].sort((a, b) => b.lat - a.lat).map(c => {
                const isSel = c.id === selectedCinemaId;
                const dot = c.active ? 'bg-[#10b981]' : 'bg-red-500';
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => selectCinema(c.id, true)}
                    className={`shrink-0 px-2.5 py-1 rounded text-[11px] font-bold flex items-center gap-1.5 transition ${
                      isSel
                        ? 'bg-[#f59e0b] text-black font-extrabold'
                        : 'bg-[#141720] hover:bg-[#1e222f] text-[#d4d4d4] border border-[#262a38]'
                    }`}
                  >
                    <span className={`w-1.5 h-1.5 rounded-full ${isSel ? 'bg-black' : dot}`} />
                    <span>#{c.id} {c.name.replace(/CINEMAAI\s*|CINEPREMIER\s*/i, '')}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="bg-[#090c14]/85 border border-[#1f2433] rounded-full px-3.5 py-0.5 text-[10px] text-[#8a8f9e] hidden md:flex items-center gap-3">
            <span>🖱️ <strong className="text-[#d4d4d4]">Click Tòa tháp / Thẻ rạp:</strong> Bay 3D tới rạp</span>
            <span>•</span>
            <span>🔄 <strong className="text-[#d4d4d4]">Chuột trái:</strong> Xoay 3D</span>
            <span>•</span>
            <span>✋ <strong className="text-[#d4d4d4]">Chuột phải / WASD:</strong> Trượt dọc chữ S</span>
            <span>•</span>
            <span>🔍 <strong className="text-[#d4d4d4]">Cuộn chuột:</strong> Thu phóng</span>
          </div>
        </div>
      </main>

      {/* ===================================================================== */}
      {/* GHN MASTER DATA API MODAL (1:1 PIXEL PERFECT MATCH)                   */}
      {/* ===================================================================== */}
      {isGhnModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="ghn-modal-box w-full max-w-[760px] rounded-md overflow-hidden">

            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-[#1f1f1f] flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <Building2 className="w-5 h-5 text-[#f59e0b]" />
                <h2 className="text-sm sm:text-base font-extrabold uppercase tracking-wide text-[#f59e0b]">
                  {ghnEditId ? `CHỈNH SỬA CHI NHÁNH RẠP #${ghnEditId}` : "THÊM CHI NHÁNH RẠP MỚI"}
                </h2>
              </div>
              <button
                type="button"
                onClick={closeGhnModal}
                className="text-[#a3a3a3] hover:text-white transition p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Form Body */}
            <form onSubmit={handleSubmitGhnForm} className="p-6 space-y-5">
              {formError && (
                <div className="p-3 bg-red-500/10 border border-red-500/30 rounded text-xs text-red-400 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{formError}</span>
                </div>
              )}

              {/* Row 1: Tên cụm rạp & Số điện thoại Hotline */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[11px] font-extrabold uppercase tracking-wider text-[#d4d4d4] mb-2">
                    TÊN CỤM RẠP <span className="text-[#f59e0b]">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    placeholder="Ví dụ: CinePremier Landmark 81"
                    className="ghn-input w-full rounded px-3.5 py-2.5 text-sm"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-[11px] font-extrabold uppercase tracking-wider text-[#d4d4d4]">
                      SỐ ĐIỆN THOẠI HOTLINE <span className="text-[#f59e0b]">*</span>
                    </label>
                    <span className={`text-[11px] ${
                      formPhone.replace(/\D/g, '').length >= 9 && formPhone.startsWith('0')
                        ? "text-[#10b981] font-semibold"
                        : "text-[#737373]"
                    }`}>
                      {formPhone.replace(/\D/g, '').length}/10 số (bắt đầu bằng 0)
                    </span>
                  </div>
                  <input
                    type="text"
                    required
                    maxLength={11}
                    value={formPhone}
                    onChange={(e) => setFormPhone(e.target.value)}
                    placeholder="Ví dụ: 0901234567 hoặc 0901999199"
                    className="ghn-input w-full rounded px-3.5 py-2.5 text-sm"
                  />
                </div>
              </div>

              {/* Inner Box: CHỌN ĐỊA CHỈ QUA GHN (MASTER DATA API) */}
              <div className="bg-[#0a0a0a] border border-[#1f1f1f] rounded-md p-5 space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-[#1a1a1a]">
                  <div className="flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-[#f59e0b]" />
                    <span className="text-[11px] font-extrabold uppercase tracking-wider text-[#f59e0b]">
                      CHỌN ĐỊA CHỈ QUA GHN (MASTER DATA API)
                    </span>
                  </div>
                  <span className="text-[11px] text-[#737373]">
                    Chuẩn hóa địa giới hành chính
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[11px] font-extrabold uppercase tracking-wider text-[#d4d4d4] mb-2">
                      TỈNH / THÀNH PHỐ (GHN) <span className="text-[#f59e0b]">*</span>
                    </label>
                    <select
                      value={selectedProvinceId}
                      onChange={(e) => handleProvinceSelect(e.target.value)}
                      className="ghn-input w-full rounded px-3.5 py-2.5 text-sm font-medium border-[#f59e0b]"
                    >
                      <option value="">-- Chọn Tỉnh / Thành Phố --</option>
                      {ghnProvinces.map(p => (
                        <option key={p.ProvinceID} value={p.ProvinceID}>
                          {p.ProvinceName}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-extrabold uppercase tracking-wider text-[#d4d4d4] mb-2">
                      QUẬN / HUYỆN (GHN)
                    </label>
                    <select
                      value={selectedDistrictId}
                      onChange={(e) => handleDistrictSelect(e.target.value)}
                      className="ghn-input w-full rounded px-3.5 py-2.5 text-sm font-medium"
                    >
                      <option value="">-- Chọn Quận / Huyện --</option>
                      {ghnDistricts.map(d => (
                        <option key={d.DistrictID} value={d.DistrictID}>
                          {d.DistrictName}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-extrabold uppercase tracking-wider text-[#d4d4d4] mb-2">
                      PHƯỜNG / XÃ (GHN)
                    </label>
                    <select
                      value={selectedWardCode}
                      onChange={(e) => handleWardSelect(e.target.value)}
                      className="ghn-input w-full rounded px-3.5 py-2.5 text-sm font-medium"
                    >
                      <option value="">
                        {selectedDistrictId ? "-- Chọn Phường / Xã --" : "-- Chọn Quận/Huyện trước --"}
                      </option>
                      {ghnWards.map(w => (
                        <option key={w.WardCode} value={w.WardCode}>
                          {w.WardName}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-extrabold uppercase tracking-wider text-[#d4d4d4] mb-2">
                      SỐ NHÀ / TÒA NHÀ / TÊN ĐƯỜNG
                    </label>
                    <input
                      type="text"
                      value={formStreet}
                      onChange={(e) => handleStreetInput(e.target.value)}
                      placeholder="Ví dụ: Tầng B1, Tòa Landmark 81, 720A Điện Biên Phủ"
                      className="ghn-input w-full rounded px-3.5 py-2.5 text-sm"
                    />
                  </div>
                </div>
              </div>

              {/* ĐỊA CHỈ CHI TIẾT * */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-[11px] font-extrabold uppercase tracking-wider text-[#d4d4d4]">
                    ĐỊA CHỈ CHI TIẾT <span className="text-[#f59e0b]">*</span>
                  </label>
                  <span className="text-[11px] text-[#737373]">
                    Tự động tổng hợp từ GHN hoặc tinh chỉnh
                  </span>
                </div>
                <textarea
                  rows={2}
                  required
                  value={formFullAddress}
                  onChange={(e) => setFormFullAddress(e.target.value)}
                  className="ghn-input w-full rounded px-3.5 py-2.5 text-sm resize-none"
                />
              </div>

              {/* TRẠNG THÁI HOẠT ĐỘNG */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-[11px] font-extrabold uppercase tracking-wider text-[#d4d4d4]">
                    TRẠNG THÁI HOẠT ĐỘNG
                  </label>
                  <span className={`text-[11px] font-extrabold uppercase ${
                    formStatus === "ACTIVE" ? "text-[#10b981]" : "text-[#f59e0b]"
                  }`}>
                    {formStatus === "ACTIVE" ? "• ĐANG MỞ CỬA" : "• TẠM DỪNG"}
                  </span>
                </div>
                <select
                  value={formStatus}
                  onChange={(e) => setFormStatus(e.target.value)}
                  className="ghn-input w-full rounded px-3.5 py-2.5 text-sm font-bold text-white"
                >
                  <option value="ACTIVE">Đang hoạt động (Hiển thị cho khách hàng đặt vé)</option>
                  <option value="INACTIVE">Tạm dừng hoạt động (Bảo trì / Ngưng nhận khách)</option>
                </select>
              </div>

              {/* Modal Footer */}
              <div className="pt-3 border-t border-[#1f1f1f] flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={closeGhnModal}
                  className="px-5 py-2.5 rounded bg-[#121212] hover:bg-[#1c1c1c] border border-[#262626] text-xs font-extrabold uppercase tracking-wider text-[#a3a3a3] hover:text-white transition"
                >
                  HỦY BỎ
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="px-6 py-2.5 rounded bg-[#f59e0b] hover:bg-[#fbbf24] disabled:opacity-50 text-black text-xs font-extrabold uppercase tracking-wider flex items-center gap-2 transition shadow-lg shadow-amber-500/20"
                >
                  {isSaving ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>ĐANG LƯU...</span>
                    </>
                  ) : (
                    <>
                      <Save className="w-4 h-4" />
                      <span>{ghnEditId ? "CẬP NHẬT" : "TẠO MỚI"}</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirmCinema && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="ghn-modal-box max-w-sm w-full rounded-md p-6 text-center">
            <h3 className="text-base font-extrabold uppercase text-white">XÓA CHI NHÁNH RẠP?</h3>
            <p className="text-xs text-[#a3a3a3] mt-2 leading-relaxed">
              Bạn có chắc chắn muốn xóa chi nhánh "{deleteConfirmCinema.name}" khỏi hệ thống sa bàn 3D chữ S?
            </p>
            <div className="flex items-center justify-center gap-3 mt-5">
              <button
                type="button"
                onClick={() => setDeleteConfirmCinema(null)}
                className="px-4 py-2 rounded bg-[#141414] border border-[#262626] text-xs font-bold text-[#a3a3a3] hover:text-white transition"
              >
                HỦY BỎ
              </button>
              <button
                type="button"
                disabled={isDeleting}
                onClick={handleConfirmDelete}
                className="px-4 py-2 rounded bg-red-600 hover:bg-red-500 text-xs font-extrabold text-white transition flex items-center gap-1.5"
              >
                {isDeleting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                <span>XÓA RẠP</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Local 3D Cockpit Toast Notification */}
      <div className={`fixed top-16 left-1/2 -translate-x-1/2 z-50 pointer-events-none transition-all duration-300 ${
        localToast.show ? "opacity-100 scale-100" : "opacity-0 scale-95"
      }`}>
        <div className="bg-[#0e121b] border border-[#f59e0b] text-[#f59e0b] px-4 py-2 rounded-lg shadow-2xl text-xs font-bold flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-[#f59e0b] animate-ping" />
          <span>{localToast.msg}</span>
        </div>
      </div>
    </div>
  );
}
