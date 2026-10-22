export const normalizeSearchText = (value) => String(value ?? '')
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .replace(/[đĐ]/g, 'd')
  .toLowerCase()
  .replace(/[^a-z0-9\s]/g, ' ')
  .replace(/\s+/g, ' ')
  .trim();

const valueText = (value) => {
  if (Array.isArray(value)) return value.map(valueText).join(' ');
  if (value && typeof value === 'object') {
    return value.name || value.actorName || value.genreName || value.title || '';
  }
  return value ?? '';
};

export const matchesMovieSearch = (movie, query) => {
  const normalizedQuery = normalizeSearchText(query);
  if (!normalizedQuery) return true;

  const searchable = [
    movie?.title,
    movie?.englishTitle,
    movie?.director,
    movie?.actors,
    movie?.cast,
    movie?.castList,
    movie?.mainActors,
    movie?.genre,
    movie?.genres,
    movie?.synopsis,
    movie?.description,
  ].map(valueText).join(' ');

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

export const defaultExploreStatus = (query, requestedStatus) => {
  const validStatuses = new Set(['now-showing', 'upcoming', 'all']);
  if (validStatuses.has(requestedStatus)) return requestedStatus;
  return normalizeSearchText(query) ? 'all' : 'now-showing';
};
