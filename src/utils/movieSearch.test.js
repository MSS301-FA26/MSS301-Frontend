import test from 'node:test';
import assert from 'node:assert/strict';

import {
  defaultExploreStatus,
  deduplicateSearchMovies,
  getMovieSearchPath,
  getMovieSearchView,
  matchesMovieSearch,
} from './movieSearch.js';

const movie = {
  id: 7,
  title: 'Đào, Phở và Piano',
  englishTitle: 'Peach Blossom, Pho and Piano',
  director: 'Phi Tiến Sơn',
  actors: [{ name: 'Doãn Quốc Đam' }, 'Cao Thị Thùy Linh'],
  genre: [{ name: 'Chính kịch' }, 'Lịch sử'],
  status: 'UPCOMING',
};

test('movie search matches the Vietnamese title', () => {
  assert.equal(matchesMovieSearch(movie, 'Đào, Phở'), true);
});

test('movie search matches the English title', () => {
  assert.equal(matchesMovieSearch(movie, 'peach blossom'), true);
});

test('movie search ignores Vietnamese accents and extra whitespace', () => {
  assert.equal(matchesMovieSearch(movie, '  dao,   pho  '), true);
});

test('movie search is case-insensitive', () => {
  assert.equal(matchesMovieSearch(movie, 'PEACH BLOSSOM'), true);
});

test('movie search matches the director', () => {
  assert.equal(matchesMovieSearch(movie, 'phi tien son'), true);
});

test('movie search matches actors', () => {
  assert.equal(matchesMovieSearch(movie, 'doan quoc dam'), true);
});

test('movie search matches genres', () => {
  assert.equal(matchesMovieSearch(movie, 'chinh kich'), true);
});

test('movie search matches showtime dates and cinema addresses', () => {
  const movieWithShowtimes = {
    ...movie,
    showtimes: [
      {
        startTime: '2026-10-25T14:30:00',
        cinemaName: 'CinePremier Landmark 81',
        cinemaAddress: '720A Điện Biên Phủ, Bình Thạnh'
      }
    ]
  };
  assert.equal(matchesMovieSearch(movieWithShowtimes, '25/10'), true);
  assert.equal(matchesMovieSearch(movieWithShowtimes, 'Landmark 81'), true);
  assert.equal(matchesMovieSearch(movieWithShowtimes, 'Bình Thạnh'), true);
});

test('movie search returns no match for an unrelated title', () => {
  assert.equal(matchesMovieSearch(movie, 'khong ton tai'), false);
});

test('the shared matcher gives Header and Explore the same movie-only result', () => {
  const catalog = [movie, { id: 8, title: 'Mai', englishTitle: 'Mai', status: 'NOW_SHOWING' }];
  const headerResults = catalog.filter((item) => matchesMovieSearch(item, 'peach blossom'));
  const exploreResults = catalog.filter((item) => matchesMovieSearch(item, 'peach blossom'));

  assert.deepEqual(headerResults.map((item) => item.id), exploreResults.map((item) => item.id));
  assert.deepEqual(headerResults.map((item) => item.id), [7]);
});

test('deduplication removes inactive entries and duplicate identifiers', () => {
  const result = deduplicateSearchMovies([
    movie,
    { ...movie, title: 'Duplicate response row' },
    { id: 8, title: 'Hidden', status: 'INACTIVE' },
    { id: 9, title: 'Visible', status: 'NOW_SHOWING' },
  ]);

  assert.deepEqual(result.map((item) => item.id), [7, 9]);
});

test('header search without an explicit status searches the complete catalog', () => {
  assert.equal(defaultExploreStatus('dao pho', null), 'all');
  assert.equal(defaultExploreStatus('', null), 'now-showing');
  assert.equal(defaultExploreStatus('dao pho', 'upcoming'), 'upcoming');
});

test('loading does not expose a result count or an empty state', () => {
  const view = getMovieSearchView({ status: 'loading', catalog: [], fallbackMovies: [movie], query: '' });

  assert.equal(view.showResultCount, false);
  assert.equal(view.kind, 'loading');
  assert.deepEqual(view.results, []);
});

test('a successful empty catalog is distinct from an API error', () => {
  const emptyView = getMovieSearchView({ status: 'empty', catalog: [], fallbackMovies: [], query: '' });
  const errorView = getMovieSearchView({ status: 'error', catalog: [], fallbackMovies: [], query: '' });

  assert.equal(emptyView.kind, 'empty');
  assert.equal(errorView.kind, 'error');
  assert.equal(errorView.showResultCount, false);
});

test('an API error keeps valid fallback movies usable', () => {
  const view = getMovieSearchView({ status: 'error', catalog: [], fallbackMovies: [movie], query: 'peach' });

  assert.equal(view.kind, 'fallback');
  assert.equal(view.showResultCount, true);
  assert.deepEqual(view.results.map((item) => item.id), [7]);
});

test('a fallback catalog can still report no title matches without becoming an API empty state', () => {
  const view = getMovieSearchView({ status: 'error', catalog: [], fallbackMovies: [movie], query: 'Mai' });

  assert.equal(view.kind, 'fallback');
  assert.equal(view.noResults, true);
  assert.equal(view.resultCount, 0);
});

test('a settled search with no matches reports a no-results state', () => {
  const view = getMovieSearchView({ status: 'success', catalog: [movie], fallbackMovies: [], query: 'Mai' });

  assert.equal(view.kind, 'no-results');
  assert.equal(view.showResultCount, true);
  assert.equal(view.resultCount, 0);
});

test('catalog-backed suggestions disappear while searching', () => {
  const idleView = getMovieSearchView({ status: 'success', catalog: [movie], fallbackMovies: [], query: '' });
  const searchingView = getMovieSearchView({ status: 'success', catalog: [movie], fallbackMovies: [], query: 'dao' });

  assert.deepEqual(idleView.suggestions, [movie.title]);
  assert.deepEqual(searchingView.suggestions, []);
});

test('movie search path opens all movies for an empty query', () => {
  assert.equal(getMovieSearchPath(''), '/movies?status=all');
  assert.equal(getMovieSearchPath('   '), '/movies?status=all');
});

test('movie search path preserves and encodes a non-empty query', () => {
  assert.equal(getMovieSearchPath(' Đào Phở '), '/movies?q=%C4%90%C3%A0o%20Ph%E1%BB%9F');
});

test('movie search matches Russo Brothers when movie has director Russo Brothers', () => {
  const avengers = {
    id: 99,
    title: 'Avengers: Hồi Kết',
    englishTitle: 'Avengers: Endgame',
    director: 'Anthony Russo, Joe Russo (Russo Brothers)',
    actors: ['Robert Downey Jr.', 'Chris Evans'],
    status: 'NOW_SHOWING'
  };
  assert.equal(matchesMovieSearch(avengers, 'Russo Brothers'), true);
  assert.equal(matchesMovieSearch(avengers, 'Robert Downey'), true);
});

test('dedicated fields: directorQuery and actorQuery match specifically', () => {
  const avengers = {
    id: 99,
    title: 'Avengers: Hồi Kết',
    englishTitle: 'Avengers: Endgame',
    director: 'Anthony Russo, Joe Russo (Russo Brothers)',
    actors: ['Robert Downey Jr.', 'Chris Evans'],
    status: 'NOW_SHOWING'
  };
  // Matching directorQuery
  assert.equal(matchesMovieSearch(avengers, '', { directorQuery: 'Russo Brothers' }), true);
  // Non-matching directorQuery
  assert.equal(matchesMovieSearch(avengers, '', { directorQuery: 'Christopher Nolan' }), false);
  // Matching actorQuery
  assert.equal(matchesMovieSearch(avengers, '', { actorQuery: 'Downey' }), true);
  // Non-matching actorQuery
  assert.equal(matchesMovieSearch(avengers, '', { actorQuery: 'Tom Cruise' }), false);
});
