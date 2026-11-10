import { normalizeMovie } from './movieService';

const LOCAL_STORAGE_KEY = 'cinepremier_wishlist_items';

const getStoredList = () => {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
};

const saveStoredList = (list) => {
  try {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(list));
  } catch {}
};

export const normalizeWishlistResponse = (payload) => {
  if (!Array.isArray(payload)) return [];
  return payload.map((item) => normalizeMovie({
    id: item.movieId || item.id,
    movieId: item.movieId || item.id,
    title: item.movieTitle || item.title,
    posterUrl: item.posterUrl,
    createdAt: item.createdAt || new Date().toISOString()
  }, {
    id: item.movieId || item.id,
    backendId: item.movieId || item.id,
    englishTitle: item.movieTitle || item.title || 'CinePremier Feature',
    posterUrl: item.posterUrl
  }));
};

export const wishlistService = {
  getWishlist: async () => {
    const list = getStoredList();
    return normalizeWishlistResponse(list);
  },
  addWishlist: async (_token, movieId, movieData = {}) => {
    const list = getStoredList();
    const idNum = Number(movieId);
    if (!list.some(item => Number(item.movieId || item.id) === idNum)) {
      list.push({
        movieId: idNum,
        id: idNum,
        movieTitle: movieData.title || '',
        posterUrl: movieData.posterUrl || '',
        createdAt: new Date().toISOString()
      });
      saveStoredList(list);
    }
    return { success: true };
  },
  removeWishlist: async (_token, movieId) => {
    const list = getStoredList();
    const idNum = Number(movieId);
    const updated = list.filter(item => Number(item.movieId || item.id) !== idNum);
    saveStoredList(updated);
    return { success: true };
  }
};

