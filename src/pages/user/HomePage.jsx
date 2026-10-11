import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import {
  Play, Ticket, Calendar, Heart, Star, ChevronLeft, ChevronRight,
  Sparkles, Building2, MapPin, Send, X, Popcorn, ArrowRight, Bell, Mail, Film,
  Clock, Award, Crown, Percent, Shield, Zap, CheckCircle2, Phone, ExternalLink
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import MovieCard from '@/components/common/MovieCard';
import QuickBookingBar from '@/components/common/QuickBookingBar';
import HeroBannerCarousel from '@/components/common/HeroBannerCarousel';
import { useMovies } from '../../stores/useMovieStore';
import { useAuthStore } from '../../stores/useAuthStore';
import { useUiStore } from '../../stores/useUiStore';
import { getStoredAuth, unwrapListPayload } from '../../services/authService';
import { movieService } from '../../services/movieService';
import { loyaltyService } from '../../services/loyaltyService';
import { chatService } from '../../services/chatService';
import { heroBannerService } from '../../services/heroBannerService';
import ReactMarkdown from 'react-markdown';

const STATIC_FALLBACK_BANNERS = [
  {
    id: 'fallback-dune-2',
    type: 'MOVIE',
    movieId: 3,
    title: 'DUNE: HÀNH TINH CÁT - PHẦN HAI',
    subtitle: 'Paul Atreides hợp lực cùng Chani và tộc Fremen mở ra cuộc viễn chinh báo thù vĩ đại.',
    badge: 'SIÊU PHẨM TOÀN CẦU',
    format: 'IMAX LASER 70MM',
    imageDesktop: 'https://image.tmdb.org/t/p/w1280/8ZTVqvKDQ8emSGUEMjsS4yHAwrp.jpg',
    imageMobile: 'https://image.tmdb.org/t/p/w780/8ZTVqvKDQ8emSGUEMjsS4yHAwrp.jpg',
    primaryCtaType: 'BOOK_NOW',
    primaryCtaLabel: 'ĐẶT VÉ NGAY',
    primaryCtaUrl: '/showtimes?movieId=3',
    secondaryCtaType: 'VIEW_MOVIE',
    secondaryCtaLabel: 'CHI TIẾT PHIM',
    secondaryCtaUrl: '/movies/3',
    focalPoint: 'CENTER'
  },
  {
    id: 'fallback-deadpool',
    type: 'MOVIE',
    movieId: 5,
    title: 'DEADPOOL & WOLVERINE',
    subtitle: 'Cặp đôi đối lập huyền thoại kết hợp giải cứu Đa vũ trụ với phong cách hành động bùng nổ.',
    badge: 'BOM TẤN HÀNH ĐỘNG',
    format: '4DX CINEMA',
    imageDesktop: 'https://image.tmdb.org/t/p/w1280/yDHYTfA3R0jFYba16jBB1ef8oIt.jpg',
    imageMobile: 'https://image.tmdb.org/t/p/w780/yDHYTfA3R0jFYba16jBB1ef8oIt.jpg',
    primaryCtaType: 'BOOK_NOW',
    primaryCtaLabel: 'ĐẶT VÉ NGAY',
    primaryCtaUrl: '/showtimes?movieId=5',
    secondaryCtaType: 'VIEW_MOVIE',
    secondaryCtaLabel: 'XEM TRAILER',
    secondaryCtaUrl: 'https://www.youtube.com/watch?v=73_1biulkYk',
    focalPoint: 'CENTER'
  }
];

const CINEMA_IMAGES_MAP = {
  1: 'https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?auto=format&fit=crop&w=800&q=80',
  2: 'https://images.unsplash.com/photo-1517604931442-7e0c8ed2963c?auto=format&fit=crop&w=800&q=80',
  3: 'https://images.unsplash.com/photo-1595769816263-9b910be24d5f?auto=format&fit=crop&w=800&q=80',
  4: 'https://images.unsplash.com/photo-1585647347483-22b66260dfff?auto=format&fit=crop&w=800&q=80',
  5: 'https://images.unsplash.com/photo-1478720568477-152d9b164e26?auto=format&fit=crop&w=800&q=80'
};


const MOVIE_BACKDROPS_MAP = {
  12: 'https://image.tmdb.org/t/p/w1280/7RyHsO4yDXtBv1zUU3mTpHeQ0d5.jpg', // Avengers: Secret Wars A
  17: 'https://image.tmdb.org/t/p/w1280/7RyHsO4yDXtBv1zUU3mTpHeQ0d5.jpg', // Avengers: Secret Wars
  7: 'https://image.tmdb.org/t/p/w1280/iN41Ccw4DctL8npfmYg1j5Tr1eb.jpg',  // Avatar: Fire and Ash
  8: 'https://image.tmdb.org/t/p/w1280/4HodYYKEIsGOdinkGi2Ucz6X9i0.jpg',  // Spider-Man Beyond the Spider-Verse
  10: 'https://image.tmdb.org/t/p/w1280/tOqIwliWMovSIZ9DyvHcHI7p2im.jpg', // Gladiator II
  9: 'https://image.tmdb.org/t/p/w1280/tElnmtQ6yz1PjN1kePNl8yMSb59.jpg',  // Joker: Điên Có Đôi
  16: 'https://image.tmdb.org/t/p/w1280/tElnmtQ6yz1PjN1kePNl8yMSb59.jpg', // Joker: Folie à Deux
  13: 'https://res.cloudinary.com/dmcodhbcc/image/upload/v1790518321/cinemaai/movies-banners/f59unluxbxmjc0tpsfpb.png', // PHIM JAVA
  14: 'https://res.cloudinary.com/dmcodhbcc/image/upload/v1790518832/cinemaai/movies-banners/eizoijydy8sxutb5ayff.png', // PHIM ỔỔN
  15: 'https://res.cloudinary.com/dmcodhbcc/image/upload/v1790519366/cinemaai/movies-banners/mstrnl8ceija6zgh1ypw.png', // PHIM CHESSS
  5: 'https://image.tmdb.org/t/p/w1280/yDHYTfA3R0jFYba16jBB1ef8oIt.jpg',  // Deadpool & Wolverine
  3: 'https://image.tmdb.org/t/p/w1280/8ZTVqvKDQ8emSGUEMjsS4yHAwrp.jpg',  // Dune: Part Two
  4: 'https://image.tmdb.org/t/p/w1280/fm6KqXpk3M2HVveHwCrBSSBaO0V.jpg',  // Oppenheimer
  6: 'https://image.tmdb.org/t/p/w1280/7cqKGQMnNabzOpi7qaIgZvQ7NGV.jpg',  // Inside Out 2
  11: 'https://image.tmdb.org/t/p/w1280/x2LSRK2Cm7MZhjluni1msVJ3wDF.jpg', // Interstellar
  1: 'https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?auto=format&fit=crop&w=1920&q=85', // Mai
  2: 'https://images.unsplash.com/photo-1518676590629-3dcbd9c5a5c9?auto=format&fit=crop&w=1920&q=85'  // Lật Mặt 7
};

const CURATED_PROMOTIONS = [
  {
    id: 'promo-1',
    code: 'CINE65K',
    name: 'MEMBER WEDNESDAY • ĐỒNG GIÁ 65K',
    description: 'Đồng giá 65.000đ vé xem phim 2D Standard & VIP vào mỗi Thứ 4 hàng tuần cho toàn bộ hội viên CinePremier.',
    discountType: 'FIXED',
    discountValue: 65000,
    endDate: '2026-12-31'
  },
  {
    id: 'promo-2',
    code: 'TRUFFLE30',
    name: 'COMBO GOURMET TRUFFLE GIẢM 30K',
    description: 'Giảm ngay 30.000đ khi đặt trước combo bắp nấm Truffle đen thượng hạng cùng vé xem phim qua web.',
    discountType: 'FIXED',
    discountValue: 30000,
    endDate: '2026-11-30'
  },
  {
    id: 'promo-3',
    code: 'STUDENT50',
    name: 'CINE STUDENT • GIÁ VÉ 50.000Đ',
    description: 'Áp dụng cho học sinh, sinh viên xuất trình thẻ trước 17:00 các ngày trong tuần từ Thứ 2 đến Thứ 6.',
    discountType: 'FIXED',
    discountValue: 50000,
    endDate: '2026-12-31'
  },
  {
    id: 'promo-4',
    code: 'CINECLUB10',
    name: 'TÍCH ĐIỂM 10% HỘI VIÊN MỌI CHI TIÊU',
    description: 'Hoàn 10% giá trị chi tiêu thành điểm CinePoint để quy đổi trực tiếp vé xem phim và bắp nước miễn phí.',
    discountType: 'PERCENTAGE',
    discountValue: 10,
    endDate: '2026-12-31'
  }
];

const CURATED_FOODS = [
  {
    id: 'combo-1',
    name: 'Combo CineSingle',
    categoryName: 'BẮP NƯỚC ĐƠN',
    group: 'COMBO',
    description: '1 Bắp rang bơ thơm giòn cỡ lớn + 1 Nước ngọt có ga 32oz mát lạnh sảng khoái',
    price: 89000,
    regularPriceSum: 110000,
    imageUrl: 'https://images.unsplash.com/photo-1572177812156-58036aae439c?auto=format&fit=crop&w=800&q=80',
    status: 'ACTIVE'
  },
  {
    id: 'combo-2',
    name: 'Combo CineCouple',
    categoryName: 'DÀNH CHO 2 NGƯỜI',
    group: 'COMBO',
    description: '1 Bắp lớn 2 ngăn vị Phô mai & Caramel + 2 Nước ngọt có ga 32oz tùy chọn',
    price: 119000,
    regularPriceSum: 145000,
    imageUrl: 'https://images.unsplash.com/photo-1512149177596-f817c7ef5d4c?auto=format&fit=crop&w=800&q=80',
    status: 'ACTIVE'
  },
  {
    id: 'combo-3',
    name: 'Combo Truffle Gourmet Signature',
    categoryName: 'ĐỘC QUYỀN CINEPREMIER',
    group: 'COMBO',
    description: '1 Bắp rang nấm Truffle đen hoàng gia + 2 Trà đào cam sả hạt chia tươi mát',
    price: 159000,
    regularPriceSum: 195000,
    imageUrl: 'https://images.unsplash.com/photo-1505686994434-e3cc5abf1330?auto=format&fit=crop&w=800&q=80',
    status: 'ACTIVE'
  },
  {
    id: 'combo-4',
    name: 'Combo Family Feast VIP',
    categoryName: 'GIA ĐÌNH & BẠN BÈ',
    group: 'COMBO',
    description: '2 Bắp khổng lồ đa vị + 4 Nước ngọt 32oz + 1 Phần Snack khoai tây giòn cay',
    price: 219000,
    regularPriceSum: 270000,
    imageUrl: 'https://images.unsplash.com/photo-1578849278619-e73505e9610f?auto=format&fit=crop&w=800&q=80',
    status: 'ACTIVE'
  },
  {
    id: 'item-101',
    name: 'Bắp Rang Bơ Hoàng Gia (L)',
    categoryName: 'BẮP RANG BƠ',
    group: 'POPCORN',
    description: 'Bắp rang ngô Mỹ hạt nở to tròn đều, phủ bơ vàng thơm ngậy đặc trưng',
    price: 65000,
    regularPriceSum: 80000,
    imageUrl: 'https://images.unsplash.com/photo-1585647347384-2593bc35786b?auto=format&fit=crop&w=800&q=80',
    status: 'ACTIVE'
  },
  {
    id: 'item-102',
    name: 'Bắp Rang Phô Mai & Caramel (L)',
    categoryName: 'BẮP RANG BƠ',
    group: 'POPCORN',
    description: 'Bắp 2 ngăn giòn rụm kết hợp phô mai mặn béo ngậy và caramel ngọt dịu',
    price: 75000,
    regularPriceSum: 90000,
    imageUrl: 'https://images.unsplash.com/photo-1578849278619-e73505e9610f?auto=format&fit=crop&w=800&q=80',
    status: 'ACTIVE'
  },
  {
    id: 'item-103',
    name: 'Coca Cola Zero / Regular (32oz)',
    categoryName: 'NƯỚC NGỌT CÓ GA',
    group: 'DRINK',
    description: 'Nước ngọt có ga mát lạnh sảng khoái ly lớn 32oz đập tan cơn khát',
    price: 39000,
    regularPriceSum: 45000,
    imageUrl: 'https://images.unsplash.com/photo-1622483767028-3f66f32aef97?auto=format&fit=crop&w=800&q=80',
    status: 'ACTIVE'
  },
  {
    id: 'item-104',
    name: 'Trà Đào Cam Sả Hạt Chia',
    categoryName: 'TRÀ TRÁI CÂY',
    group: 'DRINK',
    description: 'Trà đào thanh mát với miếng đào giòn ngọt, hương sả tươi và hạt chia dinh dưỡng',
    price: 49000,
    regularPriceSum: 59000,
    imageUrl: 'https://images.unsplash.com/photo-1556679343-c7306c1976bc?auto=format&fit=crop&w=800&q=80',
    status: 'ACTIVE'
  },
  {
    id: 'item-105',
    name: 'Xúc Xích Đức Phô Mai Nướng',
    categoryName: 'ĂN VẶT & MÓN NÓNG',
    group: 'SNACK',
    description: 'Xúc xích Đức xông khói nóng hổi với nhân phô mai tan chảy đậm đà',
    price: 45000,
    regularPriceSum: 55000,
    imageUrl: 'https://images.unsplash.com/photo-1541592106381-b31e9677c0e5?auto=format&fit=crop&w=800&q=80',
    status: 'ACTIVE'
  },
  {
    id: 'item-106',
    name: 'Snack Khoai Tây Lắc Phô Mai BBQ',
    categoryName: 'ĂN VẶT & MÓN NÓNG',
    group: 'SNACK',
    description: 'Khoai tây chiên giòn rụm lắc bột phô mai vị BBQ thơm lừng hấp dẫn',
    price: 42000,
    regularPriceSum: 50000,
    imageUrl: 'https://images.unsplash.com/photo-1582293041079-7814c2f12063?auto=format&fit=crop&w=800&q=80',
    status: 'ACTIVE'
  }
];

const extractYoutubeId = (url = '') => {
  const trimmed = url.trim();
  if (/^[a-zA-Z0-9_-]{11}$/.test(trimmed)) return trimmed;
  try {
    const parsed = new URL(trimmed);
    const host = parsed.hostname.replace(/^www\./, '');
    const parts = parsed.pathname.split('/').filter(Boolean);
    if (host === 'youtu.be') return parts[0] || '';
    if (host.endsWith('youtube.com')) {
      const videoId = parsed.searchParams.get('v');
      if (videoId) return videoId;
      if (['embed', 'shorts', 'live'].includes(parts[0])) return parts[1] || '';
    }
  } catch {
    // fallback
  }
  const patterns = [
    /youtube\.com\/watch\?v=([a-zA-Z0-9_-]{11})/,
    /youtu\.be\/([a-zA-Z0-9_-]{11})/,
    /youtube\.com\/embed\/([a-zA-Z0-9_-]{11})/,
    /youtube\.com\/shorts\/([a-zA-Z0-9_-]{11})/
  ];
  return patterns.map((p) => trimmed.match(p)?.[1]).find(Boolean) || '';
};

export default function HomePage({
  onSelectMovie = () => {},
  onBookMovie = () => {},
  onTabChange = () => {}
}) {
  const navigate = useNavigate();
  const { watchlist = [], handleToggleWatchlist, foodCatalog = [], fetchPublicFoodCatalog } = useMovies();
  const isLoggedIn = useAuthStore((state) => state.isLoggedIn);
  const currentUser = useAuthStore((state) => state.currentUser);
  const setShowOTP = useUiStore((state) => state.setShowOTP);
  const setAuthMode = useUiStore((state) => state.setAuthMode);
  const showToast = useUiStore((state) => state.showToast);

  useEffect(() => {
    fetchPublicFoodCatalog?.({ force: false });
  }, [fetchPublicFoodCatalog]);

  // Trailer modal state
  const [trailerModalData, setTrailerModalData] = useState(null);
  const trailerModalUrl = trailerModalData?.url || (typeof trailerModalData === 'string' ? trailerModalData : null);
  const setTrailerModalUrl = useCallback((val) => {
    if (!val) {
      setTrailerModalData(null);
    } else if (typeof val === 'string') {
      setTrailerModalData({ url: val, title: 'Official Trailer' });
    } else {
      setTrailerModalData(val);
    }
  }, []);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && trailerModalData) {
        setTrailerModalData(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [trailerModalData]);

  // Newsletter state
  const [moviesList, setLandingMovies] = useState([]);
  const [cinemas, setCinemas] = useState([]);
  const [combos, setCombos] = useState([]);
  const [promotions, setPromotions] = useState([]);
  const [genres, setGenres] = useState([]);
  const [loyaltyConfig, setLoyaltyConfig] = useState(null);
  const [userLoyalty, setUserLoyalty] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadErrors, setLoadErrors] = useState([]);
  const [selectedCinemaCity, setSelectedCinemaCity] = useState('ALL');
  const [selectedSpotlightCinemaId, setSelectedSpotlightCinemaId] = useState(null);

  const activeCinemas = useMemo(() => {
    return cinemas.filter(cinema => !cinema.status || cinema.status === 'ACTIVE');
  }, [cinemas]);

  const cinemaCities = useMemo(() => {
    const list = Array.from(new Set(activeCinemas.map(c => c.city).filter(Boolean)));
    return ['ALL', ...list];
  }, [activeCinemas]);

  const filteredCinemas = useMemo(() => {
    if (selectedCinemaCity === 'ALL') return activeCinemas;
    return activeCinemas.filter(c => c.city === selectedCinemaCity);
  }, [activeCinemas, selectedCinemaCity]);

  const spotlightCinema = useMemo(() => {
    if (filteredCinemas.length === 0) return null;
    const found = filteredCinemas.find(c => String(c.id) === String(selectedSpotlightCinemaId));
    return found || filteredCinemas[0];
  }, [filteredCinemas, selectedSpotlightCinemaId]);

  useEffect(() => {
    let cancelled = false;
    const loadMovies = async () => {
      const first = await movieService.searchMoviesPage({ page: 0, size: 100 });
      const rest = await Promise.all(Array.from({ length: first.totalPages - 1 }, (_, i) => movieService.searchMoviesPage({ page: i + 1, size: 100 })));
      return [first, ...rest].flatMap(page => page.items).filter(movie => !movie.isInactive && !movie.isEnded && movie.status !== 'DRAFT');
    };

    Promise.allSettled([
      loadMovies(),
      movieService.getPublicCinemas(),
      movieService.getFoodCombos(),
      movieService.getActivePromotions(),
      movieService.getGenres(),
      loyaltyService.getConfiguration()
    ]).then(results => {
      if (cancelled) return;
      const setters = [setLandingMovies, setCinemas, setCombos, setPromotions, setGenres, (val) => setLoyaltyConfig(val?.data || val)];
      const labels = ['phim', 'rạp', 'combo', 'khuyến mãi', 'thể loại', 'hội viên'];
      results.forEach((result, i) => {
        if (i === 5) {
          setters[i](result.status === 'fulfilled' ? result.value : null);
        } else {
          setters[i](result.status === 'fulfilled' ? unwrapListPayload(result.value) : []);
        }
      });
      setLoadErrors(results.flatMap((result, i) => result.status === 'rejected' ? [labels[i]] : []));
      setLoading(false);
    });

    const { accessToken } = getStoredAuth();
    if (accessToken) {
      loyaltyService.getMyLoyalty(accessToken)
        .then((res) => { if (!cancelled) setUserLoyalty(res?.data || res); })
        .catch(() => {});
    }

    return () => { cancelled = true; };
  }, [isLoggedIn]);


  // Hero Banner: Lấy banner ngang của các phim từ API, chỉ lấy 5 phim mới nhất
  const dynamicBanners = useMemo(() => {
    const banners = [];

    // Lọc phim hợp lệ (bỏ qua INACTIVE / ENDED)
    const validMovies = moviesList.filter(
      (m) => !m.isInactive && m.status !== 'INACTIVE' && m.status !== 'ENDED'
    );

    // Khử trùng lặp tên phim (ví dụ Avengers Secret Wars có 2 bản A và thường)
    const seenTitles = new Set();
    const uniqueMovies = [];
    for (const movie of validMovies) {
      const normalizedTitle = String(movie.title || '')
        .toLowerCase()
        .replace(/\s+[a-z]$/i, '')
        .trim();
      if (!seenTitles.has(normalizedTitle)) {
        seenTitles.add(normalizedTitle);
        uniqueMovies.push(movie);
      }
    }

    // Sắp xếp danh sách phim theo thời gian đăng/tạo mới nhất -> ID mới nhất -> ngày phát hành mới nhất
    const newestCandidateMovies = uniqueMovies
      .sort((a, b) => {
        const createdA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const createdB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        if (createdB !== createdA) return createdB - createdA;

        const idA = Number(a.backendId || a.id || 0);
        const idB = Number(b.backendId || b.id || 0);
        if (idB !== idA) return idB - idA;

        const timeA = a.releaseDate ? new Date(a.releaseDate).getTime() : 0;
        const timeB = b.releaseDate ? new Date(b.releaseDate).getTime() : 0;
        return timeB - timeA;
      })
      .slice(0, 20); // Lấy danh sách ứng viên phim mới nhất

    newestCandidateMovies.forEach((movie, index) => {
      const movieId = movie.backendId || movie.id;
      // Lấy trực tiếp banner ngang từ API (avatarUrl hoặc bannerUrl)
      const apiHorizontalBanner = movie.bannerUrl || movie.avatarUrl;
      const backdrop = (apiHorizontalBanner && !apiHorizontalBanner.includes('placeholder'))
        ? (MOVIE_BACKDROPS_MAP[movieId] || apiHorizontalBanner)
        : (MOVIE_BACKDROPS_MAP[movieId] || movie.posterUrl);

      const isNowShowing = movie.isNowShowing || movie.status === 'NOW_SHOWING';
      const badgeText = isNowShowing ? 'BOM TẤN ĐANG CHIẾU' : (movie.releaseDate ? `SẮP KHỞI CHIẾU • ${movie.releaseDate}` : 'SẮP KHỞI CHIẾU');
      const formatText = movie.duration ? `${movie.duration} PHÚT • ${movie.ageRating || 'T16'} • IMAX LASER` : 'IMAX LASER 70MM';
      const ctaText = isNowShowing ? 'ĐẶT VÉ NGAY' : 'CHI TIẾT PHIM';
      const ctaTargetUrl = `/movies/${movieId}`;

      banners.push({
        id: `banner-movie-${movieId}`,
        backendId: movieId,
        type: 'MOVIE',
        movieId: movieId,
        linkedMovieId: movieId,
        name: `Banner: ${movie.title}`,
        title: movie.title.toUpperCase(),
        subtitle: movie.synopsis
          ? (movie.synopsis.length > 115 ? `${movie.synopsis.slice(0, 115)}...` : movie.synopsis)
          : (movie.englishTitle || 'Trải nghiệm đỉnh cao phòng vé CinePremier'),
        badge: badgeText,
        format: formatText,
        formatLabel: formatText,
        imageDesktop: backdrop,
        imageMobile: movie.posterUrl || backdrop,
        desktopImageUrl: backdrop,
        mobileImageUrl: movie.posterUrl || backdrop,
        focalPoint: 'CENTER',
        ctaLabel: ctaText,
        ctaUrl: ctaTargetUrl,
        primaryCtaLabel: ctaText,
        primaryCtaUrl: ctaTargetUrl,
        secondaryCtaLabel: movie.trailerUrl ? 'XEM TRAILER' : (isNowShowing ? 'LỊCH CHIẾU' : 'CHI TIẾT'),
        secondaryCtaUrl: movie.trailerUrl || `/movies/${movieId}`,
        rating: movie.ratings?.overall || movie.voteAverage || movie.rating || null,
        status: movie.status,
        slideDurationSeconds: 6,
        priority: 10 - index,
        sortOrder: index + 1
      });
    });

    return banners;
  }, [moviesList]);

  // Backend Hero Banner state
  const [backendHeroBanners, setBackendHeroBanners] = useState([]);
  const [isHeroLoading, setIsHeroLoading] = useState(true);
  const recordedImpressionsRef = useRef(new Set());

  // Load public hero banners from backend API
  useEffect(() => {
    let cancelled = false;
    const fetchHeroBanners = async () => {
      try {
        let preferredCinemaId = null;
        try {
          const stored = localStorage.getItem('selectedCinema') || localStorage.getItem('preferredCinema');
          if (stored) {
            const parsed = JSON.parse(stored);
            preferredCinemaId = parsed?.id || parsed?.cinemaId;
          }
        } catch {}

        const data = await heroBannerService.getPublicHeroBanners(preferredCinemaId);
        if (!cancelled && Array.isArray(data) && data.length > 0) {
          setBackendHeroBanners(data);
        }
      } catch (err) {
        console.warn('Backend hero banners load fallback to dynamic/static:', err);
      } finally {
        if (!cancelled) setIsHeroLoading(false);
      }
    };

    fetchHeroBanners();
    return () => { cancelled = true; };
  }, []);

  // Mục tiêu: luôn đảm bảo có ít nhất 5 banner trên Hero Carousel
  // Nếu Admin đăng N banner (< 5, ví dụ: 2 banner), tự động bổ sung (5 - N) phim mới nhất
  const TARGET_HERO_COUNT = 5;

  const activeHeroBanners = useMemo(() => {
    // 1. Lọc ra các banner thật do Admin tạo/quản lý (ID > 0 và không phải default template)
    const realAdminBanners = backendHeroBanners.filter(b => {
      const bId = Number(b.id || 0);
      return bId > 0 && !String(b.name || '').includes('Default Experience') && !String(b.title || '').includes('CINEPREMIER CINEMAS');
    });

    // Nếu Admin đã đăng từ 5 banner trở lên thì hiển thị đầy đủ banner của Admin
    if (realAdminBanners.length >= TARGET_HERO_COUNT) {
      return realAdminBanners;
    }

    // 2. Nếu Admin đăng ít hơn 5 banner (ví dụ 2 banner, 1 banner hoặc 0 banner):
    // Tự động bổ sung các phim mới nhất cho đủ 5 banner, loại trừ phim đã xuất hiện trong banner của Admin
    const existingMovieIds = new Set();
    const existingTitles = new Set();
    realAdminBanners.forEach(b => {
      if (b.linkedMovieId) existingMovieIds.add(String(b.linkedMovieId));
      if (b.movieId) existingMovieIds.add(String(b.movieId));
      if (b.title) existingTitles.add(String(b.title).toUpperCase().trim());
    });

    const neededCount = TARGET_HERO_COUNT - realAdminBanners.length;
    const additionalBanners = [];

    for (const dynBanner of dynamicBanners) {
      if (additionalBanners.length >= neededCount) break;
      const mId = String(dynBanner.movieId || dynBanner.linkedMovieId || '');
      const mTitle = String(dynBanner.title || '').toUpperCase().trim();
      // Không chọn trùng phim đã có trong banner của Admin
      if (existingMovieIds.has(mId) || existingTitles.has(mTitle)) {
        continue;
      }
      additionalBanners.push({
        ...dynBanner,
        sortOrder: realAdminBanners.length + additionalBanners.length + 1
      });
    }

    const combined = [...realAdminBanners, ...additionalBanners];
    if (combined.length > 0) {
      return combined;
    }

    if (backendHeroBanners.length > 0) {
      return backendHeroBanners;
    }

    return STATIC_FALLBACK_BANNERS;
  }, [backendHeroBanners, dynamicBanners]);

  const handleHeroSlideChange = useCallback((banner) => {
    const rawId = banner?.backendId || banner?.id;
    const bannerId = typeof rawId === 'number' ? rawId : (typeof rawId === 'string' && /^\d+$/.test(rawId) ? Number(rawId) : null);
    if (bannerId && !recordedImpressionsRef.current.has(bannerId)) {
      recordedImpressionsRef.current.add(bannerId);
      heroBannerService.recordImpression(bannerId).catch(() => {});
    }
  }, []);

  const handleHeroBannerClick = useCallback((banner) => {
    const rawId = banner?.backendId || banner?.id;
    const bannerId = typeof rawId === 'number' ? rawId : (typeof rawId === 'string' && /^\d+$/.test(rawId) ? Number(rawId) : null);
    if (bannerId) {
      heroBannerService.recordClick(bannerId).catch(() => {});
    }
  }, []);

  // Curated fallbacks if backend tables are unseeded
  const effectivePromotions = useMemo(() => {
    return promotions.length > 0 ? promotions : CURATED_PROMOTIONS;
  }, [promotions]);

  const effectiveFoods = useMemo(() => {
    const list = Array.isArray(foodCatalog)
      ? foodCatalog.filter(item => !item.status || item.status === 'ACTIVE' || item.status === 'LOW_STOCK')
      : [];
    let combined = [];
    if (list.length > 0) {
      const existingIds = new Set(list.map(f => String(f.id)));
      const existingNames = new Set(list.map(f => (f.name || '').toLowerCase().trim()));
      const extras = CURATED_FOODS.filter(cf => !existingIds.has(String(cf.id)) && !existingNames.has((cf.name || '').toLowerCase().trim()));
      combined = [...list, ...extras];
    } else {
      combined = CURATED_FOODS;
    }

    const seen = new Set();
    return combined.filter(item => {
      const idKey = String(item.id);
      if (seen.has(idKey)) return false;
      seen.add(idKey);
      return true;
    });
  }, [foodCatalog]);

  // AI PopBot Chat state
  const [chatOpen, setChatOpen] = useState(false);
  const [chatInput, setChatInput] = useState('');
  const [chatMessages, setChatMessages] = useState([
    { role: 'bot', text: 'Xin chào! 🍿 Tôi là PopBot AI — Trợ lý điện ảnh CinePremier. Quý khách muốn tìm phim gì hôm nay?' }
  ]);
  const [chatSending, setChatSending] = useState(false);
  const chatEndRef = useRef(null);

  // Genre filter for Now Showing
  const [selectedGenreFilter, setSelectedGenreFilter] = useState('ALL');


  // Dynamic genre tabs with counts for Now Showing
  const nowShowingGenreTabs = useMemo(() => {
    const counts = { ALL: 0 };
    const genreMap = new Map();

    moviesList.forEach((movie) => {
      if (movie.isNowShowing) {
        counts.ALL = (counts.ALL || 0) + 1;
        const genres = Array.isArray(movie.genre)
          ? movie.genre
          : Array.isArray(movie.genres)
          ? movie.genres
          : [];
        genres.forEach((g) => {
          const name = typeof g === 'object' ? g.name : g;
          if (name && typeof name === 'string' && name.trim()) {
            const cleanName = name.trim();
            counts[cleanName] = (counts[cleanName] || 0) + 1;
            genreMap.set(cleanName.toLowerCase(), cleanName);
          }
        });
      }
    });

    const popularOrdered = ['Hành Động', 'Khoa Học', 'Sci-Fi', 'Tâm Lý', 'Hoạt Hình', 'Kinh Dị', 'Hài Hước', 'Gia Đình'];
    const tabs = [{ key: 'ALL', label: 'Tất cả', count: counts.ALL || 0 }];
    const usedKeys = new Set(['all']);

    popularOrdered.forEach((pop) => {
      const match = Array.from(genreMap.keys()).find((k) => k.includes(pop.toLowerCase()) || pop.toLowerCase().includes(k));
      if (match && !usedKeys.has(match)) {
        usedKeys.add(match);
        const originalName = genreMap.get(match);
        tabs.push({ key: originalName, label: originalName, count: counts[originalName] || 0 });
      }
    });

    genreMap.forEach((originalName, lowerKey) => {
      if (!usedKeys.has(lowerKey) && counts[originalName] > 0) {
        usedKeys.add(lowerKey);
        tabs.push({ key: originalName, label: originalName, count: counts[originalName] || 0 });
      }
    });

    if (tabs.length === 1) {
      return [
        { key: 'ALL', label: 'Tất cả', count: counts.ALL || 0 },
        { key: 'Hành Động', label: 'Hành Động' },
        { key: 'Khoa Học', label: 'Sci-Fi' },
        { key: 'Tâm Lý', label: 'Tâm Lý' },
        { key: 'Hoạt Hình', label: 'Hoạt Hình' }
      ];
    }

    return tabs.slice(0, 6);
  }, [moviesList]);

  const nowShowingMovies = useMemo(() => {
    return moviesList.filter((movie) => {
      if (!movie.isNowShowing) return false;
      if (selectedGenreFilter === 'ALL') return true;
      const movieGenres = (Array.isArray(movie.genre) ? movie.genre : Array.isArray(movie.genres) ? movie.genres : [])
        .map((g) => (typeof g === 'object' ? g.name : String(g)).toLowerCase());
      const filterLower = selectedGenreFilter.toLowerCase();
      return movieGenres.some((g) => g.includes(filterLower) || filterLower.includes(g));
    });
  }, [moviesList, selectedGenreFilter]);
  const comingSoonMovies = useMemo(() => moviesList.filter(movie => movie.isUpcoming), [moviesList]);

  const nowPlayingRef = useRef(null);
  const comingSoonRef = useRef(null);
  const fnbRef = useRef(null);

  // Carousel bounds & drag tracking for Now Showing, Coming Soon & F&B
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(true);
  const [scrollProgress, setScrollProgress] = useState(0);

  const [canComingSoonScrollLeft, setCanComingSoonScrollLeft] = useState(false);
  const [canComingSoonScrollRight, setCanComingSoonScrollRight] = useState(true);

  const [canFnbScrollLeft, setCanFnbScrollLeft] = useState(false);
  const [canFnbScrollRight, setCanFnbScrollRight] = useState(true);

  const checkScrollBounds = useCallback(() => {
    const el = nowPlayingRef.current;
    if (el) {
      setCanScrollLeft(el.scrollLeft > 15);
      setCanScrollRight(el.scrollLeft < el.scrollWidth - el.clientWidth - 15);
      const maxScroll = el.scrollWidth - el.clientWidth;
      if (maxScroll > 0) {
        setScrollProgress(Math.min(100, Math.max(0, (el.scrollLeft / maxScroll) * 100)));
      }
    }
    const cs = comingSoonRef.current;
    if (cs) {
      setCanComingSoonScrollLeft(cs.scrollLeft > 15);
      setCanComingSoonScrollRight(cs.scrollLeft < cs.scrollWidth - cs.clientWidth - 15);
    }
    const fnb = fnbRef.current;
    if (fnb) {
      setCanFnbScrollLeft(fnb.scrollLeft > 15);
      setCanFnbScrollRight(fnb.scrollLeft < fnb.scrollWidth - fnb.clientWidth - 15);
    }
  }, []);

  useEffect(() => {
    const el = nowPlayingRef.current;
    const cs = comingSoonRef.current;
    const fnb = fnbRef.current;
    checkScrollBounds();
    const t = setTimeout(checkScrollBounds, 300);
    if (el) el.addEventListener('scroll', checkScrollBounds, { passive: true });
    if (cs) cs.addEventListener('scroll', checkScrollBounds, { passive: true });
    if (fnb) fnb.addEventListener('scroll', checkScrollBounds, { passive: true });
    window.addEventListener('resize', checkScrollBounds);
    return () => {
      clearTimeout(t);
      if (el) el.removeEventListener('scroll', checkScrollBounds);
      if (cs) cs.removeEventListener('scroll', checkScrollBounds);
      if (fnb) fnb.removeEventListener('scroll', checkScrollBounds);
      window.removeEventListener('resize', checkScrollBounds);
    };
  }, [nowShowingMovies, comingSoonMovies, effectiveFoods, checkScrollBounds]);

  const scrollContainer = (ref, dir) => {
    if (ref.current) {
      ref.current.scrollBy({ left: dir * ref.current.clientWidth, behavior: 'smooth' });
    }
  };

  const handleSendChat = async (overrideMsg) => {
    const userMsg = (overrideMsg ?? chatInput).trim();
    if (!userMsg || chatSending) return;
    setChatMessages((prev) => [
      ...prev,
      { role: 'user', text: userMsg },
      { role: 'bot', text: '🤖 PopBot đang tìm kiếm...' }
    ]);
    setChatInput('');
    setChatSending(true);
    try {
      const { accessToken } = getStoredAuth();
      const res = await chatService.sendMessage({
        message: userMsg,
        userId: currentUser?.id,
        token: accessToken,
        scope: 'home'
      });
      setChatMessages((prev) => {
        const next = [...prev];
        next[next.length - 1] = {
          role: 'bot',
          text: res?.reply || res?.data?.reply || res?.message || 'Tôi đã tìm thấy thông tin phim phù hợp cho bạn.',
          data: res?.data || null
        };
        return next;
      });
    } catch {
      setChatMessages((prev) => {
        const next = [...prev];
        next[next.length - 1] = { role: 'bot', text: 'Không thể kết nối trợ lý. Vui lòng thử lại sau.' };
        return next;
      });
    } finally {
      setChatSending(false);
    }
  };

  const isMovieWatchlisted = (movie) => {
    const id = String(movie?.backendId || movie?.movieId || movie?.id);
    return watchlist.some((item) => String(item.backendId || item.movieId || item.id) === id);
  };

  const handleHeroBook = (bannerOrMovie) => {
    if (onBookMovie) {
      onBookMovie(bannerOrMovie);
    } else {
      const id = bannerOrMovie?.movieId || bannerOrMovie?.backendId || bannerOrMovie?.id;
      if (id) navigate(`/movies/${id}`, { state: { scrollToShowtimes: true } });
      else navigate('/showtimes');
    }
  };

  return (
    <div className="relative bg-[#050507] text-white selection:bg-[#F7C600] selection:text-black">

      {/* ========================================================
          1. FULL-WIDTH HORIZONTAL BANNER CAROUSEL (REFERENCE 1)
          - Full viewport width (100vw), no black side margins
          - Active center banner (~78–82%) + side peeks (10% left / 10% right)
          - Physical translate3d sliding (STRICTLY NO OPACITY FADE)
          - Autoplay, pause on hover, touch/mouse drag swipe
      ======================================================== */}
      {isHeroLoading ? (
        /* Skeleton placeholder khớp kích thước carousel */
        <div className="w-full relative overflow-hidden bg-neutral-950" style={{ height: 'clamp(340px, 52vw, 680px)' }}>
          <div className="absolute inset-0 bg-gradient-to-r from-neutral-900 via-neutral-800 to-neutral-900 animate-pulse" />
          <div className="absolute bottom-10 left-[10%] space-y-3 w-[40%]">
            <div className="h-4 w-24 bg-neutral-700 rounded animate-pulse" />
            <div className="h-8 w-full bg-neutral-700 rounded animate-pulse" />
            <div className="h-4 w-3/4 bg-neutral-800 rounded animate-pulse" />
            <div className="flex gap-3 mt-4">
              <div className="h-10 w-32 bg-neutral-700 rounded animate-pulse" />
              <div className="h-10 w-28 bg-neutral-800 rounded animate-pulse" />
            </div>
          </div>
        </div>
      ) : (
        <HeroBannerCarousel
          banners={activeHeroBanners}
          onBookMovie={handleHeroBook}
          onOpenTrailer={(url) => setTrailerModalUrl(url)}
          onSlideChange={handleHeroSlideChange}
          onBannerClick={handleHeroBannerClick}
        />
      )}

      {/* ========================================================
          2. QUICK BOOKING (MUA VÉ NHANH)
          - Overlap đáy Carousel: -32px đến -40px (-mt-8 sm:-mt-10) giống giao diện cũ
          - Flow: 1.Phim -> 2.Rạp -> 3.Ngày -> 4.Suất -> 5.MUA VÉ NHANH
          - Spacing: 56px-64px trước "Phim đang chiếu"
      ======================================================== */}
      <div className="-mt-7 sm:-mt-8 relative z-30 mx-auto max-w-[1040px] px-3 sm:px-4 mb-14 sm:mb-16">
        <QuickBookingBar movies={moviesList} />
      </div>

      {/* Main Content Layout Container (Max-width: 1240px, Spacing: 72–84px) */}
      <div className="mx-auto max-w-[1240px] px-4 sm:px-6 lg:px-8 space-y-16 sm:space-y-20 pb-20">

        {/* ========================================================
            3. PHIM ĐANG CHIẾU (NOW SHOWING)
        {/* ========================================================
            3. PHIM ĐANG CHIẾU (NOW SHOWING)
            Thiết kế rạp phim sang trọng, tab bo tròn mượt mà, thao tác tiện lợi
        ======================================================== */}
        <section id="now-showing-section" className="space-y-4">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-white/[0.08] pb-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-[#F7C600] animate-pulse shadow-[0_0_10px_rgba(247,198,0,0.8)]" />
                <span className="text-[11px] font-black uppercase tracking-[0.18em] text-[#F7C600]">
                  PHÒNG VÉ CINEPREMIER
                </span>
              </div>
              <h2 className="text-xl sm:text-2xl lg:text-3xl font-black uppercase tracking-tight text-white mt-1">
                PHIM ĐANG CHIẾU
              </h2>
              <p className="text-xs sm:text-sm text-neutral-400 mt-0.5">
                Những siêu phẩm điện ảnh đang khuấy đảo phòng vé tuần này
              </p>
            </div>

            {/* Chỉ giữ duy nhất nút XEM TẤT CẢ màu trắng */}
            <button
              onClick={() => {
                window.scrollTo({ top: 0, behavior: 'instant' });
                navigate('/movies?status=now-showing');
              }}
              className="px-5 py-2 rounded-full text-xs font-black uppercase tracking-wider bg-white text-black hover:bg-neutral-200 active:scale-95 transition-all flex items-center gap-1.5 shadow-[0_2px_12px_rgba(255,255,255,0.25)] shrink-0 cursor-pointer"
            >
              <span>XEM TẤT CẢ</span>
              <ArrowRight className="h-3.5 w-3.5 stroke-[2.5] transition-transform group-hover:translate-x-0.5" />
            </button>
          </div>

          {/* Cards Carousel Container: 5 thẻ gọn gàng, nút tròn nhỏ 2 bên, không che viền thẻ */}
          <div className="flex items-center gap-1.5 sm:gap-2.5 lg:gap-3">
            {/* Nút lùi trang bên trái: Nhỏ tròn */}
            <button
              type="button"
              onClick={() => scrollContainer(nowPlayingRef, -1)}
              disabled={!canScrollLeft}
              aria-label="Phim trước"
              className={`shrink-0 flex h-8 w-8 sm:h-9 sm:w-9 lg:h-10 lg:w-10 items-center justify-center rounded-full border backdrop-blur-md transition-all duration-200 ${
                canScrollLeft
                  ? 'border-white/20 bg-neutral-950/90 text-white hover:bg-[#F7C600] hover:text-black hover:border-[#F7C600] hover:scale-110 active:scale-95 shadow-[0_4px_16px_rgba(0,0,0,0.7)] cursor-pointer'
                  : 'border-white/5 bg-white/[0.02] text-white/20 opacity-20 cursor-not-allowed pointer-events-none'
              }`}
            >
              <ChevronLeft className="h-4 w-4 sm:h-5 sm:w-5 stroke-[2.5]" />
            </button>

            {/* Danh sách 5 thẻ phim với padding px-2 sm:px-2.5 để không bao giờ bị cắt/che viền hover */}
            <div
              ref={nowPlayingRef}
              className="flex-1 min-w-0 flex gap-2.5 sm:gap-3 md:gap-3.5 lg:gap-4 overflow-x-auto scroll-smooth snap-x snap-mandatory py-3 px-2 sm:px-2.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden select-none"
            >
              {nowShowingMovies.map((movie) => (
                <div
                  key={movie.backendId || movie.id}
                  className="snap-start shrink-0 movie-card-column"
                >
                  <MovieCard
                    movie={movie}
                    onSelect={(id) => onSelectMovie(id)}
                    onBook={(m) => onBookMovie(m)}
                    isWatchlisted={isMovieWatchlisted(movie)}
                    onToggleWatchlist={handleToggleWatchlist}
                    onOpenTrailer={(url, m) => {
                      setTrailerModalData({ url, title: m?.title || movie.title, movie: m || movie });
                    }}
                  />
                </div>
              ))}
            </div>

            {/* Nút tiến trang bên phải: Nhỏ tròn */}
            <button
              type="button"
              onClick={() => scrollContainer(nowPlayingRef, 1)}
              disabled={!canScrollRight}
              aria-label="Phim tiếp theo"
              className={`shrink-0 flex h-8 w-8 sm:h-9 sm:w-9 lg:h-10 lg:w-10 items-center justify-center rounded-full border backdrop-blur-md transition-all duration-200 ${
                canScrollRight
                  ? 'border-white/20 bg-neutral-950/90 text-white hover:bg-[#F7C600] hover:text-black hover:border-[#F7C600] hover:scale-110 active:scale-95 shadow-[0_4px_16px_rgba(0,0,0,0.7)] cursor-pointer'
                  : 'border-white/5 bg-white/[0.02] text-white/20 opacity-20 cursor-not-allowed pointer-events-none'
              }`}
            >
              <ChevronRight className="h-4 w-4 sm:h-5 sm:w-5 stroke-[2.5]" />
            </button>
          </div>

          {/* Trạng thái trống khi lọc không có kết quả */}
          {!loading && nowShowingMovies.length === 0 && (
            <div className="py-14 text-center border border-white/10 rounded-2xl bg-white/[0.02] backdrop-blur-sm">
              <Film className="h-10 w-10 text-neutral-600 mx-auto mb-3" />
              <p className="text-neutral-300 text-sm font-semibold">Chưa có phim nào thuộc thể loại này.</p>
              <p className="text-neutral-500 text-xs mt-1">Vui lòng chọn danh mục khác hoặc khám phá tất cả phim đang chiếu.</p>
              <button
                onClick={() => setSelectedGenreFilter('ALL')}
                className="mt-4 px-5 py-2 rounded-full bg-gradient-to-r from-[#FFDE43] via-[#F7C600] to-[#E5A800] text-black font-black text-xs uppercase tracking-wider hover:brightness-110 shadow-[0_4px_16px_rgba(247,198,0,0.35)] transition-all cursor-pointer"
              >
                Xem tất cả phim đang chiếu
              </button>
            </div>
          )}
        </section>

        {/* ========================================================
            4. FEATURED MOVIE (BOM TẤN TUẦN NÀY)
            Height: 360–390px (Gọn gàng, không oversized)
        ======================================================== */}
        {/* ========================================================
            5. PHIM SẮP CHIẾU (COMING SOON)
        ======================================================== */}
        <section id="coming-soon-section" className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3 border-b border-white/[0.08] pb-3.5">
            <div>
              <div className="flex items-center gap-1.5">
                <span className="h-1.5 w-1.5 rounded-full bg-purple-500 animate-pulse" />
                <span className="text-[11px] font-black uppercase tracking-[0.16em] text-purple-400">
                  SẮP KHỞI CHIẾU
                </span>
              </div>
              <h2 className="text-xl sm:text-2xl lg:text-[28px] font-black uppercase tracking-tight text-white mt-0.5">
                PHIM SẮP CHIẾU
              </h2>
              <p className="text-xs text-neutral-400">
                Đón chờ những bom tấn tiếp theo sắp đổ bộ phòng vé
              </p>
            </div>

            {/* Chỉ giữ duy nhất nút XEM TOÀN BỘ màu trắng */}
            <button
              onClick={() => {
                window.scrollTo({ top: 0, behavior: 'instant' });
                navigate('/movies?status=upcoming');
              }}
              className="px-5 py-2 rounded-full text-xs font-black uppercase tracking-wider bg-white text-black hover:bg-neutral-200 active:scale-95 transition-all flex items-center gap-1.5 shadow-[0_2px_12px_rgba(255,255,255,0.25)] shrink-0 cursor-pointer"
            >
              <span>XEM TOÀN BỘ</span>
              <ArrowRight className="h-3.5 w-3.5 stroke-[2.5] transition-transform group-hover:translate-x-0.5" />
            </button>
          </div>

          {/* Cards Carousel Container: 5 thẻ gọn gàng, nút tròn nhỏ 2 bên, không che viền thẻ */}
          <div className="flex items-center gap-1.5 sm:gap-2.5 lg:gap-3">
            {/* Nút lùi trang bên trái: Nhỏ tròn */}
            <button
              type="button"
              onClick={() => scrollContainer(comingSoonRef, -1)}
              disabled={!canComingSoonScrollLeft}
              aria-label="Phim trước"
              className={`shrink-0 flex h-8 w-8 sm:h-9 sm:w-9 lg:h-10 lg:w-10 items-center justify-center rounded-full border backdrop-blur-md transition-all duration-200 ${
                canComingSoonScrollLeft
                  ? 'border-white/20 bg-neutral-950/90 text-white hover:bg-purple-600 hover:text-white hover:border-purple-500 hover:scale-110 active:scale-95 shadow-[0_4px_16px_rgba(0,0,0,0.7)] cursor-pointer'
                  : 'border-white/5 bg-white/[0.02] text-white/20 opacity-20 cursor-not-allowed pointer-events-none'
              }`}
            >
              <ChevronLeft className="h-4 w-4 sm:h-5 sm:w-5 stroke-[2.5]" />
            </button>

            <div
              ref={comingSoonRef}
              className="flex-1 min-w-0 flex gap-2.5 sm:gap-3 md:gap-3.5 lg:gap-4 overflow-x-auto scroll-smooth snap-x snap-mandatory py-3 px-2 sm:px-2.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden select-none"
            >
              {comingSoonMovies.map((movie) => (
                <div
                  key={movie.backendId || movie.id}
                  className="snap-start shrink-0 movie-card-column"
                >
                  <MovieCard
                    movie={movie}
                    onSelect={(id) => onSelectMovie(id)}
                    onBook={(m) => onSelectMovie(m.backendId || m.id)}
                    isWatchlisted={isMovieWatchlisted(movie)}
                    onToggleWatchlist={handleToggleWatchlist}
                    onOpenTrailer={(url, m) => {
                      setTrailerModalData({ url, title: m?.title || movie.title, movie: m || movie });
                    }}
                  />
                </div>
              ))}
            </div>

            {/* Nút tiến trang bên phải: Nhỏ tròn */}
            <button
              type="button"
              onClick={() => scrollContainer(comingSoonRef, 1)}
              disabled={!canComingSoonScrollRight}
              aria-label="Phim tiếp theo"
              className={`shrink-0 flex h-8 w-8 sm:h-9 sm:w-9 lg:h-10 lg:w-10 items-center justify-center rounded-full border backdrop-blur-md transition-all duration-200 ${
                canComingSoonScrollRight
                  ? 'border-white/20 bg-neutral-950/90 text-white hover:bg-purple-600 hover:text-white hover:border-purple-500 hover:scale-110 active:scale-95 shadow-[0_4px_16px_rgba(0,0,0,0.7)] cursor-pointer'
                  : 'border-white/5 bg-white/[0.02] text-white/20 opacity-20 cursor-not-allowed pointer-events-none'
              }`}
            >
              <ChevronRight className="h-4 w-4 sm:h-5 sm:w-5 stroke-[2.5]" />
            </button>
          </div>
          {!loading && comingSoonMovies.length === 0 && <p className="text-neutral-400">Chưa có dữ liệu.</p>}
        </section>

        {/* ========================================================
            6. RẠP CINEPREMIER (INTERACTIVE CINEMA SPOTLIGHT)
            Thiết kế Spotlight 2 cột tinh tế, gọn gàng, chuẩn landing page
        ======================================================== */}
        <section id="cinemas-section" className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3 border-b border-white/[0.08] pb-3.5">
            <div>
              <div className="flex items-center gap-1.5">
                <span className="h-1.5 w-1.5 rounded-full bg-[#F7C600] animate-pulse" />
                <span className="text-[11px] font-black uppercase tracking-[0.16em] text-[#F7C600]">
                  KHÔNG GIAN ĐIỆN ẢNH
                </span>
              </div>
              <h2 className="text-xl sm:text-2xl lg:text-[28px] font-black uppercase tracking-tight text-white mt-0.5">
                RẠP CINEPREMIER
              </h2>
              <p className="text-xs text-neutral-400">
                Tìm kiếm cụm rạp phù hợp nhất với trải nghiệm của bạn
              </p>
            </div>

            {/* Link sang trang lịch chiếu rạp đầy đủ */}
            <button
              type="button"
              onClick={() => {
                window.scrollTo({ top: 0, behavior: 'instant' });
                navigate('/showtimes');
              }}
              className="px-5 py-2 rounded-full text-xs font-black uppercase tracking-wider bg-white text-black hover:bg-neutral-200 active:scale-95 transition-all flex items-center gap-1.5 shadow-[0_2px_12px_rgba(255,255,255,0.25)] shrink-0 cursor-pointer"
            >
              <span>XEM LỊCH CHIẾU THEO RẠP</span>
              <ArrowRight className="h-3.5 w-3.5 stroke-[2.5] transition-transform group-hover:translate-x-0.5" />
            </button>
          </div>

          {/* Khung tương tác Spotlight 2 cột */}
          {activeCinemas.length === 0 && !loading ? (
            <div className="p-8 text-center border border-white/10 bg-[#09090D] text-neutral-400 text-xs">
              Chưa có dữ liệu rạp khả dụng.
            </div>
          ) : (
            <div className="border border-white/10 bg-[#09090D] shadow-[0_12px_36px_rgba(0,0,0,0.6)] overflow-hidden">
              
              {/* Header Bar: City Filter Tabs */}
              <div className="flex items-center justify-between gap-2 px-4 py-2.5 bg-black/40 border-b border-white/[0.08] overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                <div className="flex items-center gap-1.5 shrink-0">
                  <Building2 className="h-3.5 w-3.5 text-[#F7C600]" />
                  <span className="text-xs font-bold text-neutral-400 uppercase tracking-wider mr-1 hidden sm:inline">
                    Khu vực:
                  </span>
                  {cinemaCities.map((city) => {
                    const isSelected = selectedCinemaCity === city;
                    const label = city === 'ALL' ? 'Tất cả khu vực' : city;
                    const count = city === 'ALL'
                      ? activeCinemas.length
                      : activeCinemas.filter((c) => c.city === city).length;

                    return (
                      <button
                        key={city}
                        type="button"
                        onClick={() => {
                          setSelectedCinemaCity(city);
                          const firstOfCity = city === 'ALL' ? activeCinemas[0] : activeCinemas.find(c => c.city === city);
                          if (firstOfCity) setSelectedSpotlightCinemaId(firstOfCity.id);
                        }}
                        className={`px-3 py-1 text-xs font-bold rounded-full transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
                          isSelected
                            ? 'bg-[#F7C600] text-black shadow-[0_2px_8px_rgba(247,198,0,0.35)] font-black'
                            : 'bg-white/5 hover:bg-white/10 text-neutral-300 hover:text-white border border-white/10'
                        }`}
                      >
                        <span>{label}</span>
                        <span className={`text-[10px] px-1 py-0.2 rounded-full ${isSelected ? 'bg-black/20 text-black' : 'bg-white/10 text-neutral-400'}`}>
                          {count}
                        </span>
                      </button>
                    );
                  })}
                </div>

                <span className="text-[11px] text-neutral-400 font-mono hidden md:inline shrink-0">
                  {filteredCinemas.length} cụm rạp tiêu chuẩn
                </span>
              </div>

              {/* Main Body: Cột trái (List rạp) + Cột phải (Spotlight Chi tiết rạp) */}
              <div className="grid grid-cols-1 lg:grid-cols-12 min-h-[360px]">
                
                {/* CỘT TRÁI (List rạp tinh gọn, cuộn mượt nếu nhiều rạp) */}
                <div className="lg:col-span-5 border-b lg:border-b-0 lg:border-r border-white/[0.08] p-3 space-y-2 max-h-[380px] overflow-y-auto custom-scrollbar bg-black/20">
                  {filteredCinemas.map((cinema) => {
                    const isSelected = spotlightCinema && String(spotlightCinema.id) === String(cinema.id);
                    const facilities = cinema.name.includes('Landmark')
                      ? ['IMAX Laser 70mm', 'Dolby Atmos']
                      : ['IMAX Laser', 'Dolby Atmos'];

                    return (
                      <div
                        key={cinema.id}
                        onClick={() => setSelectedSpotlightCinemaId(cinema.id)}
                        className={`p-3 transition-all cursor-pointer border ${
                          isSelected
                            ? 'bg-amber-500/[0.08] border-[#F7C600]/80 shadow-[0_2px_12px_rgba(247,198,0,0.15)] ring-1 ring-[#F7C600]/40'
                            : 'bg-white/[0.02] border-white/5 hover:bg-white/[0.05] hover:border-white/20'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className={`h-1.5 w-1.5 rounded-full shrink-0 ${isSelected ? 'bg-[#F7C600] animate-pulse' : 'bg-neutral-500'}`} />
                              <h4 className={`text-xs sm:text-sm font-bold truncate ${isSelected ? 'text-[#F7C600]' : 'text-white'}`}>
                                {cinema.name}
                              </h4>
                            </div>

                            <p className="flex items-center gap-1 text-[11px] text-neutral-400 mt-1 line-clamp-1">
                              <MapPin className="h-3 w-3 text-neutral-400 shrink-0" />
                              <span className="truncate">{cinema.address}</span>
                            </p>
                          </div>

                          <span className={`text-[10px] font-mono shrink-0 px-1.5 py-0.5 rounded ${
                            isSelected ? 'bg-[#F7C600] text-black font-black' : 'bg-white/10 text-neutral-300'
                          }`}>
                            {cinema.city || 'Việt Nam'}
                          </span>
                        </div>

                        {/* Chips công nghệ mini */}
                        <div className="flex items-center gap-1.5 mt-2">
                          {facilities.map((f) => (
                            <span key={f} className="text-[9px] px-1.5 py-0.2 bg-white/5 border border-white/10 text-neutral-300 rounded">
                              {f}
                            </span>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* CỘT PHẢI (Spotlight Display - Đẹp mắt, Cinematic, Đầy đủ hành động) */}
                {spotlightCinema && (() => {
                  const cinemaImg = CINEMA_IMAGES_MAP[spotlightCinema.id] || 'https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?auto=format&fit=crop&w=1200&q=80';
                  const mapUrl = `https://maps.google.com/?q=${encodeURIComponent([spotlightCinema.name, spotlightCinema.address, spotlightCinema.city].filter(Boolean).join(' '))}`;
                  const facilities = spotlightCinema.name.includes('Landmark')
                    ? ['IMAX Laser 70mm', 'Dolby Atmos 360°', 'Ghế da Gold Class VIP', 'Lounge Bar']
                    : ['IMAX Laser', 'Dolby Atmos 360°', 'Phòng chiếu VIP', 'Lounge Bar'];

                  return (
                    <div className="lg:col-span-7 relative min-h-[340px] flex flex-col justify-between overflow-hidden bg-neutral-950">
                      {/* Background ảnh rạp cực đẹp với hiệu ứng chuyển động nhẹ */}
                      <img
                        src={cinemaImg}
                        alt={spotlightCinema.name}
                        className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 hover:scale-105"
                      />
                      {/* Lớp gradient cinematic nhiều lớp */}
                      <div className="absolute inset-0 bg-gradient-to-t from-[#09090D] via-[#09090D]/75 to-black/40" />

                      {/* Top Badges */}
                      <div className="relative z-10 p-4 sm:p-5 flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="bg-black/80 border border-[#F7C600]/60 px-2.5 py-1 text-[10px] font-black uppercase text-[#F7C600] rounded-full backdrop-blur-md flex items-center gap-1.5 shadow-md">
                            <Sparkles className="h-3 w-3 text-[#F7C600]" />
                            <span>RẠP TIÊU CHUẨN VIP</span>
                          </span>
                          <span className="bg-black/60 border border-white/20 px-2.5 py-1 text-[10px] font-mono text-neutral-200 rounded-full backdrop-blur-md">
                            08:00 - 24:00
                          </span>
                        </div>

                        {spotlightCinema.phone && (
                          <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-black/60 border border-white/10 text-xs text-neutral-300 font-mono backdrop-blur-md">
                            <Phone className="h-3 w-3 text-[#F7C600]" />
                            <span>Hotline: {spotlightCinema.phone}</span>
                          </div>
                        )}
                      </div>

                      {/* Bottom Info & Action Buttons */}
                      <div className="relative z-10 p-4 sm:p-6 space-y-3.5 bg-gradient-to-t from-[#09090D] via-[#09090D]/90 to-transparent pt-8">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 bg-[#F7C600] text-black rounded">
                              {spotlightCinema.city || 'Việt Nam'}
                            </span>
                          </div>
                          <h3 className="text-xl sm:text-2xl font-black text-white mt-1.5 tracking-tight">
                            {spotlightCinema.name}
                          </h3>
                          <p className="flex items-start gap-1.5 text-xs text-neutral-300 mt-1 leading-relaxed">
                            <MapPin className="h-3.5 w-3.5 text-[#F7C600] shrink-0 mt-0.5" />
                            <span>{spotlightCinema.address} {spotlightCinema.city ? `(${spotlightCinema.city})` : ''}</span>
                          </p>
                        </div>

                        {/* Tiện ích phòng chiếu */}
                        <div className="flex flex-wrap gap-1.5 pt-1">
                          {facilities.map((fac) => (
                            <span
                              key={fac}
                              className="border border-white/15 bg-white/10 backdrop-blur-sm px-2.5 py-0.5 text-[10px] font-medium text-neutral-200 rounded"
                            >
                              {fac}
                            </span>
                          ))}
                        </div>

                        {/* Nút thao tác chính */}
                        <div className="pt-2 flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
                          <button
                            type="button"
                            onClick={() => {
                              window.scrollTo({ top: 0, behavior: 'instant' });
                              navigate(`/showtimes?cinemaId=${spotlightCinema.id}`);
                            }}
                            className="flex-1 flex items-center justify-center gap-2 rounded-md bg-gradient-to-r from-[#FFDE43] via-[#F7C600] to-[#E5A800] hover:brightness-110 active:scale-[0.99] py-2.5 px-4 text-xs font-black uppercase text-black transition-all shadow-[0_2px_14px_rgba(247,198,0,0.35)] cursor-pointer"
                          >
                            <Ticket className="h-3.5 w-3.5 stroke-[2.5]" />
                            <span>XEM LỊCH CHIẾU RẠP NÀY</span>
                          </button>

                          <a
                            href={mapUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="flex items-center justify-center gap-1.5 rounded-md border border-white/20 bg-white/5 hover:bg-white/15 active:scale-[0.99] py-2.5 px-4 text-xs font-bold uppercase text-white transition-all cursor-pointer"
                          >
                            <MapPin className="h-3.5 w-3.5 text-[#F7C600]" />
                            <span>Chỉ Đường</span>
                            <ExternalLink className="h-3 w-3 opacity-60 ml-0.5" />
                          </a>
                        </div>
                      </div>
                    </div>
                  );
                })()}

              </div>
            </div>
          )}
        </section>



        {/* ========================================================
            8. BẮP NƯỚC & COMBO (F&B CONCESSIONS)
        ======================================================== */}
        <section id="fnb-section" className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3 border-b border-white/[0.08] pb-3.5">
            <div>
              <div className="flex items-center gap-1.5">
                <span className="h-1.5 w-1.5 rounded-full bg-[#F7C600] animate-pulse" />
                <span className="text-[11px] font-black uppercase tracking-[0.16em] text-[#F7C600]">
                  ẨM THỰC ĐIỆN ẢNH
                </span>
              </div>
              <h2 className="text-xl sm:text-2xl lg:text-[28px] font-black uppercase tracking-tight text-white mt-0.5">
                BẮP NƯỚC & COMBO
              </h2>
              <p className="text-xs text-neutral-400">
                Không thể thiếu cho một buổi xem phim trọn vẹn và bùng nổ vị giác
              </p>
            </div>

            <button
              onClick={() => {
                window.scrollTo({ top: 0, behavior: 'instant' });
                navigate('/concessions');
              }}
              className="px-5 py-2 rounded-full text-xs font-black uppercase tracking-wider bg-white text-black hover:bg-neutral-200 active:scale-95 transition-all flex items-center gap-1.5 shadow-[0_2px_12px_rgba(255,255,255,0.25)] shrink-0 cursor-pointer"
            >
              <Popcorn className="h-3.5 w-3.5" />
              <span>ĐẶT BẮP NƯỚC</span>
              <ArrowRight className="h-3.5 w-3.5 stroke-[2.5] transition-transform group-hover:translate-x-0.5" />
            </button>
          </div>

          {/* Cards Carousel Container: Nút tròn 2 bên lùi/tiến trang ("trang tiếp theo") */}
          <div className="flex items-center gap-1.5 sm:gap-2.5 lg:gap-3">
            {/* Nút lùi trang bên trái: Nhỏ tròn */}
            <button
              type="button"
              onClick={() => scrollContainer(fnbRef, -1)}
              disabled={!canFnbScrollLeft}
              aria-label="Món trước"
              className={`shrink-0 flex h-8 w-8 sm:h-9 sm:w-9 lg:h-10 lg:w-10 items-center justify-center rounded-full border backdrop-blur-md transition-all duration-200 ${
                canFnbScrollLeft
                  ? 'border-white/20 bg-neutral-950/90 text-white hover:bg-purple-600 hover:text-white hover:border-purple-500 hover:scale-110 active:scale-95 shadow-[0_4px_16px_rgba(0,0,0,0.7)] cursor-pointer'
                  : 'border-white/5 bg-white/[0.02] text-white/20 opacity-20 cursor-not-allowed pointer-events-none'
              }`}
            >
              <ChevronLeft className="h-4 w-4 sm:h-5 sm:w-5 stroke-[2.5]" />
            </button>

            <div
              ref={fnbRef}
              className="flex-1 min-w-0 flex gap-3 sm:gap-4 overflow-x-auto scroll-smooth snap-x snap-mandatory py-3 px-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden select-none"
            >
              {effectiveFoods.map((food) => (
                <div
                  key={food.id}
                  className="snap-start shrink-0 w-[265px] sm:w-[285px] lg:w-[305px] group flex flex-col justify-between rounded-xl overflow-hidden border border-white/10 bg-[#0d0e15] hover:border-[#F7C600]/50 transition-all duration-300 hover:-translate-y-1 shadow-[0_10px_25px_rgba(0,0,0,0.7)] hover:shadow-[0_12px_30px_rgba(247,198,0,0.15)]"
                >
                  <div className="relative aspect-[16/10] w-full overflow-hidden bg-neutral-900">
                    <img
                      src={food.imageUrl}
                      alt={food.name}
                      className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-108"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-[#0d0e15] via-transparent to-transparent opacity-60 group-hover:opacity-40 transition-opacity" />
                    <div className="absolute top-2.5 left-2.5 rounded-full bg-black/80 border border-[#F7C600]/50 px-2.5 py-0.5 text-[9px] font-black uppercase text-[#F7C600] backdrop-blur-md shadow-md">
                      {food.categoryName || (food.group === 'COMBO' ? 'COMBO ĐIỆN ẢNH' : food.group === 'POPCORN' ? 'BẮP RANG BƠ' : food.group === 'DRINK' ? 'NƯỚC UỐNG' : 'ĂN VẶT')}
                    </div>
                  </div>

                  <div className="p-4 flex flex-col justify-between flex-1 space-y-3">
                    <div>
                      <h4 className="text-sm font-bold text-white group-hover:text-[#F7C600] transition-colors line-clamp-1">
                        {food.name}
                      </h4>
                      <p className="text-[11.5px] text-neutral-400 mt-1 line-clamp-2 leading-relaxed">
                        {food.description}
                      </p>
                    </div>

                    <div className="pt-3 border-t border-white/10 flex items-center justify-between">
                      <div>
                        <span className="text-base font-black text-[#F7C600]">
                          {Number(food.price || 0).toLocaleString('vi-VN')}đ
                        </span>
                        {food.regularPriceSum && (
                          <span className="ml-1.5 text-[11px] text-neutral-500 line-through">
                            {Number(food.regularPriceSum).toLocaleString('vi-VN')}đ
                          </span>
                        )}
                      </div>

                      <button
                        type="button"
                        onClick={() => {
                          navigate(`/concessions?comboId=${encodeURIComponent(food.id)}&comboName=${encodeURIComponent(food.name)}`);
                          window.scrollTo({ top: 0, behavior: 'instant' });
                        }}
                        className="flex items-center gap-1.5 rounded-md bg-gradient-to-r from-[#FFDE43] via-[#F7C600] to-[#E5A800] hover:brightness-110 active:scale-95 px-3.5 py-1.5 text-xs font-bold text-black transition-all shadow-[0_2px_10px_rgba(247,198,0,0.2)] cursor-pointer"
                      >
                        <span>Chọn</span>
                        <ArrowRight className="h-3 w-3" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Nút tiến trang bên phải: Nhỏ tròn */}
            <button
              type="button"
              onClick={() => scrollContainer(fnbRef, 1)}
              disabled={!canFnbScrollRight}
              aria-label="Món tiếp theo"
              className={`shrink-0 flex h-8 w-8 sm:h-9 sm:w-9 lg:h-10 lg:w-10 items-center justify-center rounded-full border backdrop-blur-md transition-all duration-200 ${
                canFnbScrollRight
                  ? 'border-white/20 bg-neutral-950/90 text-white hover:bg-purple-600 hover:text-white hover:border-purple-500 hover:scale-110 active:scale-95 shadow-[0_4px_16px_rgba(0,0,0,0.7)] cursor-pointer'
                  : 'border-white/5 bg-white/[0.02] text-white/20 opacity-20 cursor-not-allowed pointer-events-none'
              }`}
            >
              <ChevronRight className="h-4 w-4 sm:h-5 sm:w-5 stroke-[2.5]" />
            </button>
          </div>
        </section>
      </div>{/* End Main Container */}


      {/* ========================================================
          POPBOT AI ASSISTANT (FLOATING CHATBOT - Compact 48-50px)
      ======================================================== */}
      <div className="fixed bottom-5 right-5 z-[95] flex flex-col items-end gap-2.5">
        {chatOpen && (
          <div
            className="w-[310px] sm:w-[340px] bg-[#09090D] border border-purple-500/40 rounded-none overflow-hidden shadow-[0_16px_50px_rgba(0,0,0,0.9)] flex flex-col"
            style={{ height: 420 }}
          >
            <div className="flex items-center justify-between px-3.5 py-2.5 bg-gradient-to-r from-purple-950/80 to-[#09090D] border-b border-purple-500/30">
              <div className="flex items-center gap-2">
                <div className="h-7 w-7 rounded-none bg-purple-600 flex items-center justify-center font-bold text-white text-xs">
                  🍿
                </div>
                <div>
                  <h4 className="text-xs font-black uppercase text-white tracking-wider">PopBot AI</h4>
                  <p className="text-[9.5px] text-purple-300">Trợ lý điện ảnh CinePremier</p>
                </div>
              </div>
              <button onClick={() => setChatOpen(false)} className="text-neutral-400 hover:text-white p-1">
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-3.5 space-y-2.5 [scrollbar-width:thin]">
              {chatMessages.map((msg, i) => (
                <div key={i} className={`flex gap-2 ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
                  <div
                    className={`rounded-none px-3 py-2 text-xs leading-relaxed max-w-[85%] ${
                      msg.role === 'user'
                        ? 'bg-purple-700 text-white'
                        : 'bg-neutral-900 border border-white/10 text-neutral-200'
                    }`}
                  >
                    {msg.role === 'user' ? (
                      msg.text
                    ) : (
                      <ReactMarkdown
                        components={{
                          p: ({ children }) => <p className="mb-1.5 last:mb-0 leading-relaxed">{children}</p>,
                          strong: ({ children }) => <strong className="font-semibold text-purple-300">{children}</strong>,
                          em: ({ children }) => <em className="italic text-purple-200">{children}</em>,
                          ul: ({ children }) => <ul className="list-disc pl-4 mb-1.5 space-y-0.5">{children}</ul>,
                          ol: ({ children }) => <ol className="list-decimal pl-4 mb-1.5 space-y-0.5">{children}</ol>,
                          li: ({ children }) => <li className="leading-relaxed">{children}</li>,
                          a: ({ href, children }) => (
                            <a href={href} target="_blank" rel="noreferrer" className="text-purple-400 underline hover:text-purple-300">
                              {children}
                            </a>
                          ),
                          code: ({ children }) => <code className="bg-white/10 px-1 py-0.5 rounded text-[11px] font-mono">{children}</code>
                        }}
                      >
                        {msg.text}
                      </ReactMarkdown>
                    )}
                    {Array.isArray(msg.data?.movies) && msg.data.movies.length > 0 && (
                      <div className="mt-2 pt-2 border-t border-white/10 flex flex-wrap gap-1.5">
                        {msg.data.movies.map((m, mIdx) => (
                          <button
                            key={mIdx}
                            onClick={() => {
                              setChatOpen(false);
                              onSelectMovie(m.movieId || m.id);
                            }}
                            className="px-2 py-1 bg-purple-900/60 hover:bg-purple-800 border border-purple-500/40 text-[10px] text-white rounded transition flex items-center gap-1 cursor-pointer"
                          >
                            <span>🎬</span>
                            <span className="font-semibold truncate max-w-[140px]">{m.title}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ))}
              <div ref={chatEndRef} />
            </div>

            <div className="p-2.5 border-t border-white/10 bg-black/60 flex items-center gap-1.5">
              <input
                type="text"
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') handleSendChat(); }}
                placeholder="Hỏi về phim, giá vé, lịch chiếu..."
                className="flex-1 bg-white/5 border border-white/10 rounded-none px-3 py-1.5 text-xs text-white placeholder-neutral-500 outline-none focus:border-purple-400"
              />
              <button
                onClick={() => handleSendChat()}
                className="h-7 w-7 rounded-none bg-purple-600 hover:bg-purple-500 flex items-center justify-center text-white shrink-0"
              >
                <Send className="h-3 w-3" />
              </button>
            </div>
          </div>
        )}

        <button
          onClick={() => setChatOpen(!chatOpen)}
          className="h-12 w-12 rounded-none bg-gradient-to-tr from-purple-700 to-amber-500 p-0.5 shadow-[0_0_18px_rgba(138,0,245,0.45)] hover:scale-105 transition-transform flex items-center justify-center select-none"
          title="Chat cùng PopBot AI"
          id="btn-popbot-ai"
        >
          <div className="w-full h-full bg-[#09090D] rounded-none flex items-center justify-center text-xl">
            🍿
          </div>
        </button>
      </div>

      {/* ========================================================
          CINEMATIC TRAILER MODAL POPUP
      ======================================================== */}
      {trailerModalData && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 md:p-10 bg-black/90 backdrop-blur-md animate-fade-in"
          onClick={() => setTrailerModalData(null)}
        >
          <div
            className="relative w-full max-w-4xl rounded-2xl overflow-hidden bg-neutral-950 border border-white/20 shadow-[0_20px_60px_rgba(0,0,0,0.95),0_0_40px_rgba(247,198,0,0.2)]"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-white/10 bg-neutral-900/90">
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-[#F7C600] animate-pulse shadow-[0_0_8px_rgba(247,198,0,0.8)]" />
                <h3 className="text-sm sm:text-base font-black uppercase tracking-wide text-white truncate max-w-md">
                  {trailerModalData.title || 'Official Trailer'}
                </h3>
              </div>
              <button
                onClick={() => setTrailerModalData(null)}
                className="h-8 w-8 rounded-full bg-white/10 hover:bg-white/20 text-neutral-300 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
                title="Đóng (Esc)"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Video Player */}
            <div className="relative aspect-video w-full bg-black">
              {extractYoutubeId(trailerModalData.url) ? (
                <iframe
                  src={`https://www.youtube-nocookie.com/embed/${extractYoutubeId(trailerModalData.url)}?autoplay=1&rel=0&modestbranding=1`}
                  title={trailerModalData.title || 'Trailer'}
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                  className="w-full h-full border-0"
                />
              ) : (
                <div className="w-full h-full flex flex-col items-center justify-center text-center p-6">
                  <Film className="h-12 w-12 text-neutral-600 mb-2" />
                  <p className="text-neutral-400 text-sm">Trailer đang được cập nhật cho bộ phim này.</p>
                </div>
              )}
            </div>

            {/* Modal Footer with Quick Booking Action */}
            {trailerModalData.movie && (
              <div className="flex items-center justify-between px-5 py-3 border-t border-white/10 bg-neutral-900/80">
                <div className="text-xs text-neutral-400 hidden sm:block">
                  Trải nghiệm phim tại các cụm rạp chuẩn quốc tế CinePremier
                </div>
                <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                  <button
                    onClick={() => {
                      const m = trailerModalData.movie;
                      setTrailerModalData(null);
                      onSelectMovie(m.backendId || m.id);
                    }}
                    className="px-4 py-2 rounded-lg bg-white/10 hover:bg-white/20 text-white text-xs font-bold uppercase tracking-wider transition-colors cursor-pointer"
                  >
                    Xem Chi Tiết
                  </button>
                  <button
                    onClick={() => {
                      const m = trailerModalData.movie;
                      setTrailerModalData(null);
                      onBookMovie(m);
                    }}
                    className="px-5 py-2 rounded-lg bg-gradient-to-r from-[#FFDE43] via-[#F7C600] to-[#E5A800] text-black text-xs font-black uppercase tracking-wider shadow-[0_4px_16px_rgba(247,198,0,0.35)] hover:brightness-110 transition-all cursor-pointer flex items-center gap-1.5"
                  >
                    <Ticket className="h-3.5 w-3.5 stroke-[2.5]" />
                    <span>Đặt Vé Ngay</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
