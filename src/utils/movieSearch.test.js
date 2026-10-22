import test from 'node:test';
import assert from 'node:assert/strict';

import {
  defaultExploreStatus,
  deduplicateSearchMovies,
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

test('movie search ignores Vietnamese accents and case across supported fields', () => {
  assert.equal(matchesMovieSearch(movie, 'DAO PHO'), true);
  assert.equal(matchesMovieSearch(movie, 'peach blossom'), true);
  assert.equal(matchesMovieSearch(movie, 'phi tien son'), true);
  assert.equal(matchesMovieSearch(movie, 'doan quoc dam'), true);
  assert.equal(matchesMovieSearch(movie, 'chinh kich'), true);
  assert.equal(matchesMovieSearch(movie, 'khong ton tai'), false);
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
