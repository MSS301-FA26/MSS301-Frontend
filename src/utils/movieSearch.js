export const normalizeSearchText = (value) => String(value ?? '')
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .replace(/[đĐ]/g, 'd')
  .toLowerCase()
  .replace(/[^a-z0-9\s]/g, ' ')
  .replace(/\s+/g, ' ')
  .trim();

export const getMovieSearchPath = (query) => {
  const trimmedQuery = String(query ?? '').trim();
  return trimmedQuery ? `/movies?q=${encodeURIComponent(trimmedQuery)}` : '/movies?status=all';
};

/**
 * Format Date helper - extracts date keys and formats for date-based search
 */
export const getLocalDateString = (d = new Date()) => {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export const extractMovieActors = (movie) => {
  const list = [];
  if (Array.isArray(movie?.actors)) {
    movie.actors.forEach((a) => {
      if (typeof a === 'string') list.push(a);
      else if (a && typeof a.name === 'string') list.push(a.name);
      else if (a && typeof a.actorName === 'string') list.push(a.actorName);
    });
  }
  if (typeof movie?.mainActors === 'string') {
    movie.mainActors.split(/[,;\n•·]/).forEach((s) => list.push(s.trim()));
  } else if (Array.isArray(movie?.mainActors)) {
    movie.mainActors.forEach((s) => typeof s === 'string' && list.push(s));
  }
  if (typeof movie?.castList === 'string') {
    movie.castList.split(/[,;\n•·]/).forEach((s) => list.push(s.trim()));
  }
  return Array.from(new Set(list.filter(Boolean)));
};

export const extractMovieDirectors = (movie) => {
  const d = movie?.director || movie?.directorName || movie?.raw?.director || movie?.raw?.directorName;
  if (!d) return [];
  const invalidPlaceholders = new Set(['dang cap nhat', 'chua cap nhat', 'updating', 'n a']);
  const cleanItem = (str) => {
    const norm = normalizeSearchText(str);
    if (!norm || invalidPlaceholders.has(norm)) return null;
    return String(str).trim();
  };

  const list = [];
  if (typeof d === 'string') {
    d.split(/[,;\n•·]/).forEach((s) => {
      const cleaned = cleanItem(s);
      if (cleaned) list.push(cleaned);
    });
  } else if (Array.isArray(d)) {
    d.forEach((item) => {
      const cleaned = cleanItem(item);
      if (cleaned) list.push(cleaned);
    });
  }
  return Array.from(new Set(list));
};

export const extractMovieGenres = (movie) => {
  const list = [];
  const genres = movie?.genre || movie?.genres;
  if (Array.isArray(genres)) {
    genres.forEach((g) => {
      if (typeof g === 'string') list.push(g);
      else if (g && typeof g.name === 'string') list.push(g.name);
    });
  } else if (typeof genres === 'string') {
    genres.split(/[,;\n•·]/).forEach((s) => list.push(s.trim()));
  }
  return Array.from(new Set(list.filter(Boolean)));
};

export const extractMovieDates = (movie) => {
  const todayKey = getLocalDateString();
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowKey = getLocalDateString(tomorrow);

  const rawDateStrings = [];
  if (movie?.releaseDate) rawDateStrings.push(String(movie.releaseDate));
  if (movie?.upcomingDate) rawDateStrings.push(String(movie.upcomingDate));
  if (movie?.premiereDate) rawDateStrings.push(String(movie.premiereDate));
  if (Array.isArray(movie?.screeningDates)) {
    movie.screeningDates.forEach((d) => rawDateStrings.push(String(d)));
  }
  if (Array.isArray(movie?.showtimes)) {
    movie.showtimes.forEach((st) => {
      if (st?.startTime) rawDateStrings.push(String(st.startTime).split('T')[0]);
    });
  }

  const dateItems = [];
  const seenKeys = new Set();

  rawDateStrings.forEach((raw) => {
    if (!raw) return;
    let key = '';
    let day = '';
    let month = '';
    let year = '';

    // Match YYYY-MM-DD
    const isoMatch = raw.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
    if (isoMatch) {
      year = isoMatch[1];
      month = String(isoMatch[2]).padStart(2, '0');
      day = String(isoMatch[3]).padStart(2, '0');
      key = `${year}-${month}-${day}`;
    } else {
      // Match DD/MM/YYYY or DD-MM-YYYY
      const dmyMatch = raw.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})/);
      if (dmyMatch) {
        day = String(dmyMatch[1]).padStart(2, '0');
        month = String(dmyMatch[2]).padStart(2, '0');
        year = dmyMatch[3];
        key = `${year}-${month}-${day}`;
      } else {
        // Partial DD/MM
        const dmMatch = raw.match(/^(\d{1,2})[/-](\d{1,2})/);
        if (dmMatch) {
          day = String(dmMatch[1]).padStart(2, '0');
          month = String(dmMatch[2]).padStart(2, '0');
          key = `${day}-${month}`;
        }
      }
    }

    if (!key || seenKeys.has(key)) return;
    seenKeys.add(key);

    const isToday = key === todayKey;
    const isTomorrow = key === tomorrowKey;
    const display = day && month ? (year ? `${day}/${month}/${year}` : `${day}/${month}`) : raw;

    const variations = [
      key,
      display,
      `${day}/${month}`,
      `${day}-${month}`,
      `${day} ${month}`,
      year ? `${day} ${month} ${year}` : ''
    ].filter(Boolean);

    dateItems.push({
      key,
      display,
      isToday,
      isTomorrow,
      variations
    });
  });

  return dateItems;
};

export const extractMovieCinemas = (movie) => {
  const list = [];
  const seen = new Set();

  const addCinema = (cinema) => {
    if (!cinema) return;
    const name = cinema.name || cinema.cinemaName || '';
    const address = cinema.address || cinema.cinemaAddress || '';
    const city = cinema.city || cinema.cinemaCity || '';
    const id = cinema.id ?? cinema.cinemaId;
    const key = `${id || ''}-${name}`;
    if (!name || seen.has(key)) return;
    seen.add(key);
    list.push({ id, name, address, city });
  };

  if (Array.isArray(movie?.cinemas)) {
    movie.cinemas.forEach(addCinema);
  }
  if (Array.isArray(movie?.showtimes)) {
    movie.showtimes.forEach((st) => {
      addCinema(st.cinema || {
        id: st.cinemaId,
        name: st.cinemaName,
        address: st.cinemaAddress || st.address,
        city: st.cinemaCity || st.city
      });
    });
  }
  if (movie?.cinemaName || movie?.cinemaAddress) {
    addCinema({
      id: movie.cinemaId,
      name: movie.cinemaName,
      address: movie.cinemaAddress,
      city: movie.cinemaCity
    });
  }

  return list;
};

export const matchesCinemaSearch = (cinema, query) => {
  const normalizedQuery = normalizeSearchText(query);
  if (!normalizedQuery) return true;
  const searchable = [
    cinema?.name,
    cinema?.address,
    cinema?.city,
    cinema?.district,
    ...(Array.isArray(cinema?.facilities) ? cinema.facilities : [])
  ].join(' ');
  return normalizeSearchText(searchable).includes(normalizedQuery);
};

export const getMovieMatchReasons = (movie, query = '', options = {}) => {
  const normalizedQuery = normalizeSearchText(query);
  const normalizedDirectorQuery = normalizeSearchText(options.directorQuery);
  const normalizedActorQuery = normalizeSearchText(options.actorQuery);
  const normalizedDateQuery = normalizeSearchText(options.selectedDate);

  const reasons = [];

  // Check 1: Dedicated Director Query (User typed specifically into Director input)
  if (normalizedDirectorQuery) {
    const directors = extractMovieDirectors(movie);
    const matchedDirector = directors.find((d) => normalizeSearchText(d).includes(normalizedDirectorQuery));
    if (!matchedDirector) {
      return { matched: false, reasons: [] };
    }
    reasons.push({ type: 'director', label: 'Đạo diễn', value: matchedDirector });
  }

  // Check 2: Dedicated Actor Query (User typed specifically into Actor input)
  if (normalizedActorQuery) {
    const actors = extractMovieActors(movie);
    const matchedActor = actors.find((a) => normalizeSearchText(a).includes(normalizedActorQuery));
    if (!matchedActor) {
      return { matched: false, reasons: [] };
    }
    reasons.push({ type: 'actor', label: 'Diễn viên', value: matchedActor });
  }

  // Check 3: Selected Date (User selected a date from the date picker / pills)
  if (normalizedDateQuery) {
    const dates = extractMovieDates(movie);
    const matchedDate = dates.find((d) => {
      return d.key === options.selectedDate || d.variations.some((v) => normalizeSearchText(v).includes(normalizedDateQuery));
    });
    if (!matchedDate) {
      return { matched: false, reasons: [] };
    }
    reasons.push({
      type: 'date',
      label: 'Ngày chiếu',
      value: matchedDate.display,
      isToday: matchedDate.isToday,
      isTomorrow: matchedDate.isTomorrow
    });
  }

  // Check 4: Selected Cinema ID (User selected a cinema from the dropdown)
  if (options.selectedCinemaId && options.selectedCinemaId !== 'ALL') {
    const cinemas = extractMovieCinemas(movie);
    const matchedCinema = cinemas.find((c) => String(c.id) === String(options.selectedCinemaId));
    if (!matchedCinema) {
      return { matched: false, reasons: [] };
    }
    reasons.push({
      type: 'cinema',
      label: 'Rạp chiếu',
      value: matchedCinema.name,
      address: matchedCinema.address || matchedCinema.city
    });
  }

  // Check 5: General Query (Title, or broad search across all fields)
  if (normalizedQuery) {
    let generalMatched = false;

    // Title & English Title
    const titleNorm = normalizeSearchText(movie?.title);
    const englishTitleNorm = normalizeSearchText(movie?.englishTitle);
    if (titleNorm.includes(normalizedQuery)) {
      reasons.push({ type: 'title', label: 'Tên phim', value: movie?.title });
      generalMatched = true;
    } else if (englishTitleNorm.includes(normalizedQuery)) {
      reasons.push({ type: 'title', label: 'Tên gốc', value: movie?.englishTitle });
      generalMatched = true;
    }

    // Director (if not already filtered by directorQuery)
    if (!normalizedDirectorQuery) {
      const directors = extractMovieDirectors(movie);
      const matchedDirector = directors.find((d) => normalizeSearchText(d).includes(normalizedQuery));
      if (matchedDirector) {
        reasons.push({ type: 'director', label: 'Đạo diễn', value: matchedDirector });
        generalMatched = true;
      }
    }

    // Actors (if not already filtered by actorQuery)
    if (!normalizedActorQuery) {
      const actors = extractMovieActors(movie);
      const matchedActor = actors.find((a) => normalizeSearchText(a).includes(normalizedQuery));
      if (matchedActor) {
        reasons.push({ type: 'actor', label: 'Diễn viên', value: matchedActor });
        generalMatched = true;
      }
    }

    // Genre
    const genres = extractMovieGenres(movie);
    const matchedGenre = genres.find((g) => normalizeSearchText(g).includes(normalizedQuery));
    if (matchedGenre) {
      reasons.push({ type: 'genre', label: 'Thể loại', value: matchedGenre });
      generalMatched = true;
    }

    // Showtime / Release dates (if not already filtered by selectedDate)
    if (!normalizedDateQuery) {
      const dates = extractMovieDates(movie);
      const isQueryToday = normalizedQuery === 'hom nay' || normalizedQuery === 'today';
      const isQueryTomorrow = normalizedQuery === 'ngay mai' || normalizedQuery === 'tomorrow';
      const matchedDate = dates.find((d) => {
        if (isQueryToday && d.isToday) return true;
        if (isQueryTomorrow && d.isTomorrow) return true;
        return d.variations.some((v) => normalizeSearchText(v).includes(normalizedQuery));
      });
      if (matchedDate) {
        reasons.push({
          type: 'date',
          label: 'Ngày chiếu',
          value: matchedDate.display,
          isToday: matchedDate.isToday,
          isTomorrow: matchedDate.isTomorrow
        });
        generalMatched = true;
      }
    }

    // Cinemas (if not already filtered by selectedCinemaId)
    if (!options.selectedCinemaId || options.selectedCinemaId === 'ALL') {
      const cinemas = extractMovieCinemas(movie);
      const matchedCinema = cinemas.find((c) => {
        const normName = normalizeSearchText(c.name);
        const normAddr = normalizeSearchText(c.address);
        const normCity = normalizeSearchText(c.city);
        return normName.includes(normalizedQuery) || normAddr.includes(normalizedQuery) || normCity.includes(normalizedQuery);
      });
      if (matchedCinema) {
        reasons.push({
          type: 'cinema',
          label: 'Rạp chiếu',
          value: matchedCinema.name,
          address: matchedCinema.address || matchedCinema.city
        });
        generalMatched = true;
      }
    }

    if (!generalMatched) {
      return { matched: false, reasons: [] };
    }
  }

  // If no filters at all were specified, it's a default match
  const hasAnyFilter = Boolean(
    normalizedQuery ||
    normalizedDirectorQuery ||
    normalizedActorQuery ||
    normalizedDateQuery ||
    (options.selectedCinemaId && options.selectedCinemaId !== 'ALL')
  );
  if (!hasAnyFilter) {
    return { matched: true, reasons: [] };
  }

  // Check filter category if specified: 'all' | 'movie' | 'people' | 'cinema' | 'date'
  const filterCategory = options.filterCategory || 'all';
  let matched = reasons.length > 0;
  if (filterCategory === 'movie') {
    matched = reasons.some((r) => r.type === 'title');
  } else if (filterCategory === 'people') {
    matched = reasons.some((r) => r.type === 'director' || r.type === 'actor');
  } else if (filterCategory === 'cinema') {
    matched = reasons.some((r) => r.type === 'cinema');
  } else if (filterCategory === 'date') {
    matched = reasons.some((r) => r.type === 'date');
  }

  return { matched, reasons };
};

export const matchesMovieSearch = (movie, query = '', options = {}) => {
  return getMovieMatchReasons(movie, query, options).matched;
};

export const deduplicateSearchMovies = (movies = []) => {
  const seenIds = new Set();
  const seenTitles = new Set();

  return (Array.isArray(movies) ? movies : []).filter((movie) => {
    if (!movie || movie.status === 'INACTIVE' || movie.isInactive) return false;

    const rawId = movie.backendId ?? movie.movieId ?? movie.id;
    const id = rawId === undefined || rawId === null ? '' : String(rawId).trim();
    const title = normalizeSearchText(movie.title || movie.englishTitle);
    if ((id && seenIds.has(id)) || (title && seenTitles.has(title))) return false;

    if (id) seenIds.add(id);
    if (title) seenTitles.add(title);
    return true;
  });
};

/**
 * Enriches movies with their matching showtimes and cinemas
 */
export const enrichMoviesWithShowtimes = (movies = [], showtimes = [], cinemas = []) => {
  const cinemaMap = new Map();
  (Array.isArray(cinemas) ? cinemas : []).forEach((c) => {
    if (c?.id) cinemaMap.set(String(c.id), c);
  });

  const showtimesByMovie = new Map();
  (Array.isArray(showtimes) ? showtimes : []).forEach((st) => {
    if (!st || !st.movieId) return;
    const mId = String(st.movieId);
    if (!showtimesByMovie.has(mId)) showtimesByMovie.set(mId, []);

    const cinema = cinemaMap.get(String(st.cinemaId)) || {
      id: st.cinemaId,
      name: st.cinemaName,
      address: st.cinemaAddress || st.address,
      city: st.cinemaCity || st.city
    };

    showtimesByMovie.get(mId).push({
      ...st,
      cinema
    });
  });

  return (Array.isArray(movies) ? movies : []).map((movie) => {
    const mId = String(movie.backendId ?? movie.movieId ?? movie.id);
    const movieShowtimes = showtimesByMovie.get(mId) || [];

    const movieCinemas = [];
    const seenCinemaIds = new Set();
    const movieScreeningDates = new Set();

    movieShowtimes.forEach((st) => {
      if (st.cinema && !seenCinemaIds.has(String(st.cinema.id))) {
        seenCinemaIds.add(String(st.cinema.id));
        movieCinemas.push(st.cinema);
      }
      if (st.startTime) {
        movieScreeningDates.add(String(st.startTime).split('T')[0]);
      }
    });

    return {
      ...movie,
      showtimes: movieShowtimes.length > 0 ? movieShowtimes : movie.showtimes,
      cinemas: movieCinemas.length > 0 ? movieCinemas : movie.cinemas,
      screeningDates: Array.from(movieScreeningDates)
    };
  });
};

export const getMovieSearchView = ({
  status,
  catalog = [],
  fallbackMovies = [],
  query = '',
  directorQuery = '',
  actorQuery = '',
  filterCategory = 'all',
  selectedDate = '',
  selectedCinemaId = '',
  cinemasList = [],
  showtimesList = []
}) => {
  if (status === 'idle' || status === 'loading') {
    return {
      kind: status,
      results: [],
      matchingCinemas: [],
      suggestions: [],
      availableDates: [],
      resultCount: 0,
      showResultCount: false,
      noResults: false
    };
  }

  const rawFallback = deduplicateSearchMovies(fallbackMovies);
  const hasFallback = status === 'error' && rawFallback.length > 0;
  const rawSource = hasFallback ? rawFallback : deduplicateSearchMovies(catalog);

  // Enrich with showtimes and cinemas if provided
  const source = showtimesList.length > 0 || cinemasList.length > 0
    ? enrichMoviesWithShowtimes(rawSource, showtimesList, cinemasList)
    : rawSource;

  // Filter movies with explicit search options
  const searchOptions = {
    filterCategory,
    directorQuery,
    actorQuery,
    selectedDate,
    selectedCinemaId
  };
  const resultsWithReasons = source
    .map((movie) => {
      const matchData = getMovieMatchReasons(movie, query, searchOptions);
      return matchData.matched ? { ...movie, matchReasons: matchData.reasons } : null;
    })
    .filter(Boolean);

  // Filter cinemas
  const matchingCinemas = (Array.isArray(cinemasList) ? cinemasList : []).filter((c) =>
    matchesCinemaSearch(c, query)
  );

  const normalizedQuery = normalizeSearchText(query);
  const hasAnyFilterActive = Boolean(
    normalizedQuery ||
    normalizeSearchText(directorQuery) ||
    normalizeSearchText(actorQuery) ||
    normalizeSearchText(selectedDate) ||
    (selectedCinemaId && selectedCinemaId !== 'ALL')
  );

  let kind = status;
  if (hasFallback) kind = 'fallback';
  else if (status === 'success' && resultsWithReasons.length === 0 && matchingCinemas.length === 0 && hasAnyFilterActive) {
    kind = 'no-results';
  }

  // Compute available dates from next 7 days
  const today = new Date();
  const availableDates = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(today);
    d.setDate(today.getDate() + i);
    const key = getLocalDateString(d);
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const label = i === 0 ? 'Hôm nay' : i === 1 ? 'Ngày mai' : `${day}/${month}`;
    return { key, label, display: `${day}/${month}` };
  });

  // Suggestions: movie titles from source catalog
  const suggestions = normalizedQuery
    ? []
    : source.slice(0, 5).map((m) => m.title).filter(Boolean);

  const totalResults = resultsWithReasons.length + matchingCinemas.length;

  return {
    kind,
    results: resultsWithReasons,
    matchingCinemas,
    availableDates,
    suggestions,
    resultCount: resultsWithReasons.length,
    cinemaCount: matchingCinemas.length,
    totalResults,
    showResultCount: status === 'success' || status === 'empty' || hasFallback,
    noResults: hasAnyFilterActive && totalResults === 0 && (status === 'success' || hasFallback),
  };
};

export const defaultExploreStatus = (query, requestedStatus) => {
  const validStatuses = new Set(['now-showing', 'upcoming', 'all']);
  if (validStatuses.has(requestedStatus)) return requestedStatus;
  return normalizeSearchText(query) ? 'all' : 'now-showing';
};
