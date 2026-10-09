import React, { useState } from 'react';
import { Heart, Play, Ticket, Star, Film, Clock, Sparkles, Calendar } from 'lucide-react';

const simplifyFormat = (fmt) => {
  if (!fmt) return '';
  const u = String(fmt).toUpperCase();
  if (u.includes('IMAX')) return 'IMAX';
  if (u.includes('4DX')) return '4DX';
  if (u.includes('3D')) return '3D';
  if (u.includes('2D')) return '2D';
  return u;
};

const getAgeBadgeStyle = (rating) => {
  const r = String(rating || '').toUpperCase();
  if (r === 'T18' || r === '18+' || r === 'C') return 'bg-[#E02424] text-white border-red-500/40';
  if (r === 'T16' || r === '16+') return 'bg-[#EA580C] text-white border-orange-500/40';
  if (r === 'T13' || r === '13+') return 'bg-[#EAB308] text-black font-black border-amber-400/50';
  if (r === 'K') return 'bg-[#0284C7] text-white border-sky-400/40';
  return 'bg-[#10B981] text-white border-emerald-400/40'; // P
};

const formatReleaseDateVN = (dateStr) => {
  if (!dateStr || dateStr === 'Đang cập nhật' || dateStr === 'Dang cap nhat') return '';
  try {
    const clean = String(dateStr).split('T')[0].trim();
    const parts = clean.split('-');
    if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`;
    return dateStr;
  } catch {
    return dateStr;
  }
};
const formatShortDate = formatReleaseDateVN;

export default function MovieCard({
  movie,
  onSelect = () => {},
  onBook = () => {},
  isWatchlisted = false,
  onToggleWatchlist = () => {},
  onOpenTrailer = null
}) {
  const [imgError, setImgError] = useState(false);

  const isBookable = Boolean(movie?.hasShowtimes || Number(movie?.showtimesCount) > 0 || movie?.status === 'NOW_SHOWING' || movie?.status === 'SCHEDULED' || (!movie?.status && !movie?.isUpcoming));
  const isUpcoming = movie?.status === 'UPCOMING' || movie?.isUpcoming;

  // Formats & Genres
  const rawFormat = movie?.formats?.[0] || (movie?.isImax ? 'IMAX' : movie?.format || '2D');
  const formatTag = simplifyFormat(rawFormat);

  const genreList = Array.isArray(movie?.genre) ? movie.genre : Array.isArray(movie?.genres) ? movie.genres : [];
  const primaryGenre = genreList.map(g => (typeof g === 'object' ? g.name : g)).filter(Boolean)[0] || 'Điện ảnh';

  // Duration
  const durationMinutes = movie?.durationMinutes || movie?.duration || 0;

  // Rating
  let ratingVal = null;
  if (movie?.ratings?.overall) ratingVal = Number(movie.ratings.overall).toFixed(1);
  else if (movie?.rating) ratingVal = Number(movie.rating).toFixed(1);
  else if (movie?.voteAverage) ratingVal = Number(movie.voteAverage).toFixed(1);

  // Poster Image
  const rawPoster = movie?.posterUrl || movie?.poster || movie?.avatarUrl || movie?.thumbnailUrl;
  const isPlaceholderRaw = typeof rawPoster === 'string' && (rawPoster.includes('placeholder') || rawPoster.trim() === '');
  const releaseShort = formatShortDate(movie?.releaseDate || movie?.upcomingDate);

  const handleCardClick = () => {
    onSelect(movie?.backendId || movie?.movieId || movie?.id);
  };

  const handlePlayTrailer = (e) => {
    e.stopPropagation();
    if (onOpenTrailer && movie?.trailerUrl) {
      onOpenTrailer(movie.trailerUrl, movie);
    } else {
      handleCardClick();
    }
  };

  return (
    <div
      className="group relative flex flex-col select-none transition-transform duration-300 hover:-translate-y-1.5"
      id={`movie-${movie?.backendId || movie?.id}`}
    >
      {/* 1. Poster Container (Aspect Ratio 2:3 - Bo góc mềm mại rounded-xl, đổ bóng điện ảnh) */}
      <div
        onClick={handleCardClick}
        className="relative aspect-[2/3] w-full overflow-hidden rounded-xl bg-[#0e0e16] border border-white/10 group-hover:border-[#F7C600]/80 transition-all duration-300 shadow-[0_8px_24px_rgba(0,0,0,0.65)] group-hover:shadow-[0_16px_36px_rgba(247,198,0,0.22),0_4px_16px_rgba(0,0,0,0.9)] cursor-pointer"
      >
        {!imgError && !isPlaceholderRaw && rawPoster ? (
          <img
            src={rawPoster}
            alt={movie?.title || 'Poster phim'}
            className="h-full w-full object-cover transition-transform duration-500 ease-out group-hover:scale-105"
            referrerPolicy="no-referrer"
            loading="lazy"
            onError={() => setImgError(true)}
          />
        ) : (
          /* Branded CinePremier Fallback */
          <div className="h-full w-full flex flex-col items-center justify-center p-4 bg-gradient-to-b from-[#181824] via-[#0c0c12] to-black text-center select-none">
            <div className="h-10 w-10 flex items-center justify-center rounded-xl bg-zinc-950 border border-[#F7C600]/40 text-[#F7C600] font-black text-lg shadow-[0_0_12px_rgba(247,198,0,0.25)] mb-2">
              C
            </div>
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-white">
              CINE<span className="text-[#F7C600]">PREMIER</span>
            </p>
            <p className="text-[9px] font-medium text-neutral-400 mt-1">
              Poster đang cập nhật
            </p>
            <Film className="h-4 w-4 text-neutral-600 mt-2.5" />
          </div>
        )}

        {/* Ambient Dark Bottom Gradient for base state contrast */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-transparent to-black/35 pointer-events-none" />

        {/* Top Badges (Release date for upcoming, or formatTag for now showing) */}
        {isUpcoming && (movie?.releaseDate || movie?.upcomingDate) ? (
          <div className="absolute top-2.5 left-2.5 z-10 pointer-events-none">
            <span className="rounded-md bg-purple-900/90 border border-purple-400/40 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-purple-200 backdrop-blur-md shadow-sm flex items-center gap-1">
              <Calendar className="h-2.5 w-2.5 text-purple-300" />
              <span>KHỞI CHIẾU {formatReleaseDateVN(movie?.releaseDate || movie?.upcomingDate)}</span>
            </span>
          </div>
        ) : formatTag ? (
          <div className="absolute top-2.5 left-2.5 z-10 pointer-events-none">
            <span className="rounded-md bg-black/80 border border-white/20 px-2 py-0.5 text-[9.5px] font-mono font-black uppercase tracking-wider text-amber-300 backdrop-blur-md shadow-sm">
              {formatTag}
            </span>
          </div>
        ) : null}

        {/* Bottom Corner Badges (Rating on left & Age on right) */}
        <div className="absolute bottom-2.5 left-2.5 right-2.5 flex items-center justify-between pointer-events-none z-10 group-hover:opacity-0 transition-opacity duration-200">
          {/* Rating Badge */}
          {ratingVal ? (
            <div className="flex items-center gap-1 bg-black/80 border border-white/15 px-2 py-0.5 rounded-md text-[10px] font-bold text-white backdrop-blur-md shadow">
              <Star className="h-2.5 w-2.5 fill-[#F7C600] text-[#F7C600]" />
              <span>{ratingVal}</span>
            </div>
          ) : <div />}

          {/* Age Rating Badge */}
          {movie?.ageRating && (
            <span className={`px-1.5 py-0.5 rounded-md text-[9.5px] font-black uppercase tracking-wider shadow-md border ${getAgeBadgeStyle(movie.ageRating)}`}>
              {movie.ageRating}
            </span>
          )}
        </div>

        {/* ========================================================
            Desktop Hover Overlay (Điện ảnh, tinh tế, thao tác tiện lợi)
        ======================================================== */}
        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/70 to-black/35 opacity-0 group-hover:opacity-100 transition-all duration-300 flex flex-col justify-between p-3.5 z-20 backdrop-blur-[2px]">
          {/* Top Row: Age Badge & Watchlist Heart Button */}
          <div className="flex justify-between items-center">
            {movie?.ageRating ? (
              <span className={`px-1.5 py-0.5 rounded-md text-[9px] font-black uppercase tracking-wider shadow border ${getAgeBadgeStyle(movie.ageRating)}`}>
                {movie.ageRating}
              </span>
            ) : <div />}

            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onToggleWatchlist(movie);
              }}
              className={`flex h-8 w-8 items-center justify-center rounded-full border transition-all duration-200 cursor-pointer shadow-md backdrop-blur-md ${
                isWatchlisted
                  ? 'bg-rose-500 border-rose-400 text-white shadow-[0_0_12px_rgba(244,63,94,0.5)]'
                  : 'bg-black/60 border-white/20 text-neutral-300 hover:border-[#F7C600] hover:text-white hover:bg-black/90 hover:scale-105'
              }`}
              title={isWatchlisted ? 'Xóa khỏi Watchlist' : 'Thêm vào Watchlist'}
            >
              <Heart className={`h-3.5 w-3.5 ${isWatchlisted ? 'fill-current' : ''}`} />
            </button>
          </div>

          {/* Center: Play Trailer Button */}
          <div className="flex flex-col items-center justify-center py-2 gap-1.5">
            <button
              type="button"
              onClick={handlePlayTrailer}
              className="flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-tr from-[#E5A800] via-[#F7C600] to-[#FFDE43] text-black shadow-[0_0_22px_rgba(247,198,0,0.65)] hover:scale-115 active:scale-95 transition-all duration-200 cursor-pointer group/play"
              title={movie?.trailerUrl ? 'Xem trailer chính thức' : 'Chi tiết phim'}
            >
              <Play className="h-5 w-5 fill-black ml-0.5 transition-transform group-hover/play:scale-110" />
            </button>
            <span className="text-[10px] font-black uppercase tracking-widest text-[#F7C600] drop-shadow-md">
              TRAILER
            </span>
          </div>

          {/* Bottom Actions */}
          <div className="space-y-1.5 translate-y-1 group-hover:translate-y-0 transition-transform duration-200">
            {isBookable ? (
              <>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onBook(movie);
                  }}
                  className="flex w-full items-center justify-center gap-1.5 rounded-lg bg-gradient-to-r from-[#FFDE43] via-[#F7C600] to-[#E5A800] py-2 text-[11px] font-black uppercase tracking-wider text-black transition-all hover:brightness-110 shadow-[0_4px_14px_rgba(247,198,0,0.4)] active:scale-[0.98] cursor-pointer"
                >
                  <Ticket className="h-3.5 w-3.5 stroke-[2.5]" />
                  <span>ĐẶT VÉ NGAY</span>
                </button>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onSelect(movie?.backendId || movie?.movieId || movie?.id);
                  }}
                  className="flex w-full items-center justify-center gap-1 rounded-lg border border-white/20 bg-white/10 hover:bg-white hover:text-black py-1.5 text-[11px] font-bold uppercase tracking-wider text-white transition-colors cursor-pointer"
                >
                  <span>CHI TIẾT</span>
                </button>
              </>
            ) : (
              <>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onSelect(movie?.backendId || movie?.movieId || movie?.id);
                  }}
                  className="flex w-full items-center justify-center gap-1.5 rounded-lg bg-gradient-to-r from-[#FFDE43] via-[#F7C600] to-[#E5A800] py-2 text-[11px] font-black uppercase tracking-wider text-black hover:brightness-110 transition-all cursor-pointer shadow-[0_4px_14px_rgba(247,198,0,0.4)]"
                >
                  <Play className="h-3 w-3 fill-current" />
                  <span>CHI TIẾT</span>
                </button>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onToggleWatchlist(movie);
                  }}
                  className={`flex w-full items-center justify-center gap-1 rounded-lg border py-1.5 text-[11px] font-bold uppercase tracking-wider transition-colors cursor-pointer ${
                    isWatchlisted
                      ? 'bg-rose-500/20 border-rose-500 text-rose-300'
                      : 'border-white/20 bg-black/60 text-neutral-300 hover:bg-white/10 hover:text-white'
                  }`}
                >
                  <Heart className={`h-3 w-3 ${isWatchlisted ? 'fill-current' : ''}`} />
                  <span>{isWatchlisted ? 'ĐÃ LƯU' : 'NHẮC TÔI'}</span>
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* 2. Text Info (Directly below poster, clean, well-spaced) */}
      <div className="mt-2.5 px-0.5">
        {/* Title */}
        <h3
          onClick={handleCardClick}
          className="cursor-pointer text-[14px] sm:text-[15px] font-bold text-white group-hover:text-[#F7C600] transition-colors line-clamp-1 leading-snug"
          title={movie?.title}
        >
          {movie?.title}
        </h3>

        {/* Metadata Line */}
        <div className="text-[12px] text-neutral-400 font-medium flex items-center gap-1.5 mt-0.5 truncate">
          <span>{primaryGenre}</span>
          <span className="text-neutral-600">•</span>
          <span>
            {isUpcoming && (movie?.releaseDate || movie?.upcomingDate)
              ? `Khởi chiếu ${formatReleaseDateVN(movie?.releaseDate || movie?.upcomingDate)}`
              : durationMinutes > 0
              ? `${durationMinutes} phút`
              : 'Đang cập nhật'}
          </span>
        </div>

        {/* Mobile Quick Action (Direct booking button for touch screens) */}
        {isBookable && (
          <div className="mt-2 sm:hidden">
            <button
              onClick={(e) => {
                e.stopPropagation();
                onBook(movie);
              }}
              className="w-full py-1.5 rounded-lg bg-[#F7C600] text-black font-black text-[11px] uppercase tracking-wider flex items-center justify-center gap-1 shadow-sm active:scale-95 transition-transform"
            >
              <Ticket className="h-3 w-3 stroke-[2.5]" />
              <span>Đặt Vé</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

