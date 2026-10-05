import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, ChevronRight } from 'lucide-react';

export default function HeroBannerCarousel({
  banners = [],
  onBookMovie = null,
  onOpenTrailer = null,
  onSlideChange = null,
  onBannerClick = null,
  className = ''
}) {
  const navigate = useNavigate();
  const containerRef = useRef(null);

  // Guard against empty banners
  const bannerList = useMemo(() => {
    return Array.isArray(banners) && banners.length > 0 ? banners : [];
  }, [banners]);

  const realCount = bannerList.length;

  // Virtualized array ensuring >= 5 slots for 100% glitch-free 3D circular math
  const virtualSlides = useMemo(() => {
    if (realCount === 0) return [];
    if (realCount === 1) return [{ ...bannerList[0], _origIdx: 0, _vKey: 0 }];
    if (realCount >= 5) {
      return bannerList.map((b, idx) => ({ ...b, _origIdx: idx, _vKey: idx }));
    }
    // For 2, 3, or 4 banners, repeat to reach at least 6 items
    const repeats = Math.ceil(6 / realCount);
    const result = [];
    for (let r = 0; r < repeats; r++) {
      bannerList.forEach((b, idx) => {
        result.push({ ...b, _origIdx: idx, _vKey: r * realCount + idx });
      });
    }
    return result;
  }, [bannerList, realCount]);

  const virtualCount = virtualSlides.length;

  // Active virtual slide index
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isHovered, setIsHovered] = useState(false);

  // Drag / touch gesture state
  const [dragStartX, setDragStartX] = useState(0);
  const dragStartTimeRef = useRef(0);
  const isDraggingRef = useRef(false);

  // Responsive dimensions strictly locked to 1920x600 (3.2:1 ratio)
  const [dimensions, setDimensions] = useState({
    containerWidth: typeof window !== 'undefined' ? window.innerWidth : 1440,
    slideWidth: 1200,
    slideHeight: Math.round(1200 * (600 / 1920)),
    gap: 20
  });

  const updateDimensions = useCallback(() => {
    if (!containerRef.current) return;
    const width = containerRef.current.clientWidth || window.innerWidth;
    let sWidth;
    let gap = 20;

    if (width < 640) {
      sWidth = Math.round(width * 0.88);
      gap = 12;
    } else if (width < 1024) {
      sWidth = Math.min(Math.round(width * 0.84), 860);
      gap = 16;
    } else if (width < 1440) {
      sWidth = Math.min(Math.round(width * 0.84), 1200);
      gap = 20;
    } else {
      sWidth = Math.min(Math.round(width * 0.82), 1400);
      gap = 24;
    }

    const sHeight = Math.round(sWidth * (600 / 1920));
    setDimensions({ containerWidth: width, slideWidth: sWidth, slideHeight: sHeight, gap });
  }, []);

  useEffect(() => {
    updateDimensions();
    window.addEventListener('resize', updateDimensions);
    return () => window.removeEventListener('resize', updateDimensions);
  }, [updateDimensions]);

  // Preload all banner images into browser cache
  useEffect(() => {
    if (typeof window === 'undefined') return;
    bannerList.forEach((b) => {
      const src = b.imageDesktop || b.desktopImageUrl || b.imageMobile || b.mobileImageUrl;
      if (src) {
        const img = new Image();
        img.src = src;
      }
    });
  }, [bannerList]);

  // Helper: circular shortest distance from currentIndex to index i
  const getCircularOffset = useCallback((i, current, count) => {
    let diff = (i - current) % count;
    if (diff > count / 2) diff -= count;
    if (diff < -count / 2) diff += count;
    return diff;
  }, []);

  // Active original banner
  const activeRealIndex = virtualSlides[currentIndex]?._origIdx ?? 0;
  const activeBanner = bannerList[activeRealIndex] || null;
  const activeBannerImg = activeBanner
    ? (activeBanner.imageDesktop || activeBanner.desktopImageUrl || activeBanner.imageMobile || activeBanner.mobileImageUrl)
    : null;

  // Report slide change to parent for impression tracking
  useEffect(() => {
    if (realCount > 0 && onSlideChange && activeBanner) {
      onSlideChange(activeBanner);
    }
  }, [activeRealIndex, activeBanner, onSlideChange, realCount]);

  // Navigation handlers (Infinite circular wrap)
  const handleNext = useCallback(() => {
    if (virtualCount <= 1) return;
    setCurrentIndex((prev) => (prev + 1) % virtualCount);
  }, [virtualCount]);

  const handlePrev = useCallback(() => {
    if (virtualCount <= 1) return;
    setCurrentIndex((prev) => (prev - 1 + virtualCount) % virtualCount);
  }, [virtualCount]);

  const handleGoToRealIndex = useCallback((targetRealIdx) => {
    if (realCount <= 1) return;
    let bestIdx = currentIndex;
    let minDiff = Infinity;
    virtualSlides.forEach((s, idx) => {
      if (s._origIdx === targetRealIdx) {
        const diff = Math.abs(getCircularOffset(idx, currentIndex, virtualCount));
        if (diff < minDiff) {
          minDiff = diff;
          bestIdx = idx;
        }
      }
    });
    setCurrentIndex(bestIdx);
  }, [realCount, currentIndex, virtualCount, virtualSlides, getCircularOffset]);

  // Autoplay timer (6s)
  useEffect(() => {
    if (realCount <= 1 || isHovered) return;
    const interval = setInterval(() => {
      handleNext();
    }, 6000);
    return () => clearInterval(interval);
  }, [realCount, isHovered, handleNext]);

  // Handle banner card click
  const handleCardClick = useCallback((banner, diff) => {
    if (isDraggingRef.current) return;

    if (diff === -1) {
      handlePrev();
      return;
    }
    if (diff === 1) {
      handleNext();
      return;
    }
    if (diff !== 0) return;

    // Center active card click
    if (onBannerClick) {
      onBannerClick(banner);
    }

    const movieId = banner.linkedMovieId || banner.movieId;
    const isMovie = banner.type === 'MOVIE' || (!banner.type && movieId);
    const isFnb = banner.type === 'FNB' || banner.linkedFnbId;
    const customUrl = banner.ctaUrl || banner.primaryCtaUrl;

    if (isMovie && movieId) {
      if (customUrl && !customUrl.startsWith('/showtimes') && !customUrl.includes('movieId=')) {
        if (customUrl.startsWith('http://') || customUrl.startsWith('https://')) {
          window.open(customUrl, '_blank', 'noopener,noreferrer');
        } else {
          navigate(customUrl);
        }
      } else {
        navigate(`/movies/${movieId}`, { state: { scrollToShowtimes: true } });
      }
      return;
    }

    if (isFnb) {
      if (customUrl && !customUrl.startsWith('/showtimes')) {
        navigate(customUrl);
      } else {
        navigate('/concessions');
      }
      return;
    }

    if (customUrl) {
      if (customUrl.startsWith('http://') || customUrl.startsWith('https://')) {
        window.open(customUrl, '_blank', 'noopener,noreferrer');
      } else {
        navigate(customUrl);
      }
      return;
    }

    if (onBookMovie) {
      onBookMovie(banner);
    } else {
      navigate('/explore');
    }
  }, [navigate, onBannerClick, onBookMovie, handlePrev, handleNext]);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'ArrowLeft') handlePrev();
      if (e.key === 'ArrowRight') handleNext();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handlePrev, handleNext]);

  // Touch Swipe Handlers
  const handleTouchStart = (e) => {
    if (virtualCount <= 1) return;
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    setDragStartX(clientX);
    dragStartTimeRef.current = Date.now();
    isDraggingRef.current = false;
  };

  const handleTouchMove = (e) => {
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    if (Math.abs(clientX - dragStartX) > 10) {
      isDraggingRef.current = true;
    }
  };

  const handleTouchEnd = (e) => {
    if (virtualCount <= 1) return;
    const clientX = e.changedTouches ? e.changedTouches[0].clientX : e.clientX;
    const diff = clientX - dragStartX;
    const duration = Date.now() - dragStartTimeRef.current;

    // Clear dragging flag after short delay so click event doesn't misfire
    setTimeout(() => {
      isDraggingRef.current = false;
    }, 50);

    if (diff < -50 || (diff < -20 && duration < 300)) {
      handleNext();
    } else if (diff > 50 || (diff > 20 && duration < 300)) {
      handlePrev();
    }
  };

  if (realCount === 0) return null;

  return (
    <section
      ref={containerRef}
      className={`relative w-full overflow-hidden select-none bg-[#050507] ${className}`}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      id="hero-banner-carousel"
      aria-label="CinePremier Banner Showcase"
    >
      {/* ========================================================
          1. AMBIENT DYNAMIC BACKLIGHT GLOW (Rạp chiếu cao cấp)
          Ánh sáng màu phản chiếu tự động theo poster phim
      ======================================================== */}
      {activeBannerImg && (
        <div className="absolute inset-0 overflow-hidden pointer-events-none -z-10 select-none">
          <div
            className="absolute -inset-16 bg-cover bg-center filter blur-[110px] opacity-40 scale-125 transition-all duration-1000 ease-out"
            style={{
              backgroundImage: `url(${activeBannerImg})`,
            }}
          />
          <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-transparent to-[#050507]" />
        </div>
      )}

      {/* ========================================================
          2. CINEMATIC 3D DEPTH STAGE (Side-peek carousel mượt mà 100%)
          - Thấy card trước ở bên trái và card sau ở bên phải
          - Vòng lặp tuần hoàn toán học 100% không giật, không tua ngược
          - Thu nhỏ/làm mờ card phụ, nổi bật và sắc nét card chính
      ======================================================== */}
      <div
        className="relative mx-auto w-full overflow-hidden"
        style={{ height: `${dimensions.slideHeight}px` }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onMouseDown={handleTouchStart}
        onMouseMove={handleTouchMove}
        onMouseUp={handleTouchEnd}
      >
        {virtualSlides.map((banner, index) => {
          const diff = getCircularOffset(index, currentIndex, virtualCount);
          const pitch = dimensions.slideWidth + dimensions.gap;
          const translateX = diff * pitch;

          const isActive = diff === 0;
          const isLeftPeek = diff === -1;
          const isRightPeek = diff === 1;
          const isVisible = Math.abs(diff) <= 1;

          const bannerImg = banner.imageDesktop || banner.desktopImageUrl || banner.imageMobile || banner.mobileImageUrl;

          // Opacity & zIndex (Giữ cùng kích thước 100%, không zoom ra/vào)
          const opacity = isActive ? 1.0 : (isVisible ? 0.5 : 0);
          const filter = isActive ? 'brightness(1)' : 'brightness(0.7)';
          const zIndex = isActive ? 20 : (isVisible ? 10 : 0);

          // Disable transition for distant offscreen cards so they don't slide across stage
          const isFarOffscreen = Math.abs(diff) >= 2;
          const transitionStyle = isFarOffscreen
            ? 'none'
            : 'transform 600ms cubic-bezier(0.16, 1, 0.3, 1), opacity 600ms ease';

          return (
            <div
              key={`${banner.id || banner.backendId || 'b'}-${banner._vKey}`}
              onClick={() => handleCardClick(banner, diff)}
              style={{
                width: `${dimensions.slideWidth}px`,
                height: `${dimensions.slideHeight}px`,
                transform: `translate3d(calc(-50% + ${translateX}px), -50%, 0)`,
                opacity,
                filter,
                zIndex,
                pointerEvents: isVisible ? 'auto' : 'none',
                transition: transitionStyle
              }}
              className={`absolute top-1/2 left-1/2 aspect-[1920/600] rounded-none overflow-hidden bg-black shadow-2xl cursor-pointer`}
              title={isLeftPeek ? 'Xem banner trước' : isRightPeek ? 'Xem banner tiếp theo' : (banner.title || '')}
            >
              {/* Image banner tĩnh, không zoom ra (scale-100 cố định) */}
              <div className="w-full h-full overflow-hidden bg-black flex items-center justify-center">
                <img
                  src={bannerImg}
                  alt={banner.altText || banner.title || 'CinePremier Banner'}
                  className="w-full h-full object-cover object-center pointer-events-none select-none"
                  loading={isActive || isVisible ? 'eager' : 'lazy'}
                  decoding="async"
                />
              </div>

              {/* Peek slide hover dark overlay */}
              {!isActive && isVisible && (
                <div className="absolute inset-0 bg-black/25 hover:bg-transparent transition-colors duration-300" />
              )}
            </div>
          );
        })}
      </div>

      {/* ========================================================
          3. NAVIGATION ARROWS (Nút tròn mờ kính giống hệt ảnh mẫu)
      ======================================================== */}
      {realCount > 1 && (
        <>
          <button
            type="button"
            onClick={handlePrev}
            className="absolute left-2 sm:left-4 lg:left-6 top-1/2 -translate-y-1/2 z-30 flex h-9 w-9 sm:h-10 sm:w-10 items-center justify-center rounded-full bg-black/40 hover:bg-black/75 text-white border border-white/20 backdrop-blur-sm transition-all shadow-[0_4px_16px_rgba(0,0,0,0.5)] hover:scale-105 active:scale-95 cursor-pointer group"
            aria-label="Slide trước"
          >
            <ChevronLeft className="h-5 w-5 stroke-[2.2] group-hover:-translate-x-0.5 transition-transform" />
          </button>

          <button
            type="button"
            onClick={handleNext}
            className="absolute right-2 sm:right-4 lg:right-6 top-1/2 -translate-y-1/2 z-30 flex h-9 w-9 sm:h-10 sm:w-10 items-center justify-center rounded-full bg-black/40 hover:bg-black/75 text-white border border-white/20 backdrop-blur-sm transition-all shadow-[0_4px_16px_rgba(0,0,0,0.5)] hover:scale-105 active:scale-95 cursor-pointer group"
            aria-label="Slide tiếp theo"
          >
            <ChevronRight className="h-5 w-5 stroke-[2.2] group-hover:translate-x-0.5 transition-transform" />
          </button>
        </>
      )}

      {/* ========================================================
          4. CINEMA PROGRESS INDICATORS (Chấm tròn nhỏ tinh tế nằm trên thanh Mua vé nhanh)
          - Chấm tròn nhỏ xíu border viền trắng, chấm active màu trắng đặc
          - Căn giữa tuyệt đối, không có số trang bên phải
      ======================================================== */}
      {realCount > 1 && (
        <div className="absolute bottom-9 sm:bottom-11 inset-x-0 flex items-center justify-center z-25 pointer-events-none">
          <div className="bg-black/40 backdrop-blur-md px-2.5 py-1 rounded-full border border-white/10 shadow-md inline-flex items-center gap-1.5 pointer-events-auto">
            {bannerList.map((_, idx) => {
              const isActive = idx === activeRealIndex;
              return (
                <button
                  key={idx}
                  type="button"
                  onClick={() => handleGoToRealIndex(idx)}
                  className={`transition-all duration-300 rounded-full cursor-pointer ${
                    isActive
                      ? 'w-2 h-2 bg-white shadow-[0_0_6px_rgba(255,255,255,0.9)]'
                      : 'w-2 h-2 border border-white/60 bg-transparent hover:bg-white/40'
                  }`}
                  aria-label={`Chuyển đến slide ${idx + 1}`}
                />
              );
            })}
          </div>
        </div>
      )}
    </section>
  );
}
