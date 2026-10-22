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

export const matchesMovieSearch = (movie, query) => {
  const normalizedQuery = normalizeSearchText(query);
  if (!normalizedQuery) return true;

  const searchable = [
    movie?.title,
    movie?.englishTitle,
  ].join(' ');

  return normalizeSearchText(searchable).includes(normalizedQuery);
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

export const getMovieSearchView = ({ status, catalog = [], fallbackMovies = [], query = '' }) => {
  if (status === 'idle' || status === 'loading') {
    return { kind: status, results: [], suggestions: [], resultCount: 0, showResultCount: false };
  }

  const fallback = deduplicateSearchMovies(fallbackMovies);
  const hasFallback = status === 'error' && fallback.length > 0;
  const source = hasFallback ? fallback : deduplicateSearchMovies(catalog);
  const results = source.filter((movie) => matchesMovieSearch(movie, query));
  const normalizedQuery = normalizeSearchText(query);
  let kind = status;

  if (hasFallback) kind = 'fallback';
  else if (status === 'success' && results.length === 0 && normalizedQuery) kind = 'no-results';

  return {
    kind,
    results,
    suggestions: normalizedQuery ? [] : source.slice(0, 5).map((movie) => movie.title).filter(Boolean),
    resultCount: results.length,
    showResultCount: status === 'success' || status === 'empty' || hasFallback,
    noResults: Boolean(normalizedQuery) && results.length === 0 && (status === 'success' || hasFallback),
  };
};

export const defaultExploreStatus = (query, requestedStatus) => {
  const validStatuses = new Set(['now-showing', 'upcoming', 'all']);
  if (validStatuses.has(requestedStatus)) return requestedStatus;
  return normalizeSearchText(query) ? 'all' : 'now-showing';
};
