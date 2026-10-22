import { aiRequest } from './aiClient.js';
import { unwrapListPayload } from './authService';
import { normalizeMovie } from './movieService';

const getRecommendationMovie = (item = {}) => item.movie || item.movieInfo || item.film || item;

export const pickRecExplanation = (item = {}) => {
  const out = {};
  const fields = [
    'source', 'reason', 'predictedRating', 'neighborCount', 'anchorTitle',
    'matchedGenres', 'matchedActors', 'sameDirector', 'directorName',
    'avgRating', 'ratingCount', 'bookingCount'
  ];
  for (const key of fields) {
    if (item[key] !== undefined && item[key] !== null) out[key] = item[key];
  }
  if (typeof item.similarity === 'number') out.similarity = item.similarity;
  else if (typeof item.score === 'number') out.similarity = item.score;
  return out;
};

export const normalizeRecommendation = (item = {}) => {
  const source = getRecommendationMovie(item);
  const movieId = item.movieId ?? item.movie_id ?? source.id ?? source.movieId;
  const posterUrl = item.posterUrl
    || item.poster_url
    || item.moviePosterUrl
    || item.imageUrl
    || source.posterUrl
    || source.poster_url
    || source.moviePosterUrl
    || source.imageUrl
    || source.thumbnailUrl;

  const score = typeof item.score === 'number'
    ? item.score
    : (typeof item.similarity === 'number' ? item.similarity : null);

  return {
    ...normalizeMovie({
      ...source,
      id: movieId,
      movieId,
      title: item.title || source.title || source.name,
      posterUrl,
      genres: item.genres || source.genres || []
    }, {
      id: movieId,
      backendId: movieId,
      posterUrl
    }),
    similarity: score,
    score,
    reason: item.reason || '',
    source: item.source || 'HYBRID',
    releaseYear: item.releaseYear || source.releaseYear,
    ...pickRecExplanation(item)
  };
};

export const normalizeRecommendationResponse = (payload) => {
  const rawList = Array.isArray(payload?.recommendations)
    ? payload.recommendations
    : unwrapListPayload(payload);
  return rawList.map(normalizeRecommendation);
};

export const normalizeRecommendationSet = (payload) => {
  const rawList = Array.isArray(payload?.recommendations)
    ? payload.recommendations
    : unwrapListPayload(payload);
  return {
    strategy: payload?.strategy || 'HYBRID',
    setId: payload?.setId ?? null,
    experimentVariant: payload?.experimentVariant || 'CONTROL',
    branchId: payload?.branchId ?? null,
    items: rawList.map(normalizeRecommendation)
  };
};

export const recommendationService = {
  /**
   * GET /api/v1/recommendations/movies/{movie_id}/similar
   * Similar movies based on semantic content and metadata embedding similarity
   */
  getContentRecommendations: (movieId, { limit = 6 } = {}) =>
    aiRequest(`/api/v1/recommendations/movies/${encodeURIComponent(movieId)}/similar`, {
      params: { limit }
    }).then(normalizeRecommendationResponse),

  /**
   * GET /api/v1/recommendations/users/{user_id}
   * Personalized movie recommendations (dual profile content + Pearson CF + availability + branch scoring)
   */
  getUserRecommendations: (userId, { branchId = null, limit = 10 } = {}) => {
    const params = { limit };
    if (branchId !== null && branchId !== undefined) params.branch_id = branchId;
    return aiRequest(`/api/v1/recommendations/users/${encodeURIComponent(userId)}`, { params })
      .then(normalizeRecommendationSet);
  },

  /**
   * Backward-compatible alias for getUserRecommendations
   */
  getCollaborativeRecommendations: (userId, token, options = {}) =>
    recommendationService.getUserRecommendations(userId, options)
      .then((res) => res.items),

  /**
   * GET /api/v1/recommendations/trending
   * Trending and popular movies currently showing (ideal for guests & cold start)
   */
  getTrendingRecommendations: ({ branchId = null, limit = 10 } = {}) => {
    const params = { limit };
    if (branchId !== null && branchId !== undefined) params.branch_id = branchId;
    return aiRequest('/api/v1/recommendations/trending', { params })
      .then(normalizeRecommendationSet);
  },

  /**
   * POST /api/v1/recommendations/feedbacks
   * Submit user feedback or explicit rating/dislike signal (MOVIE_RATED, MOVIE_LIKED, MOVIE_DISLIKED)
   */
  recordFeedback: ({ userId, movieId, interactionType, rating = null, comment = null }) =>
    aiRequest('/api/v1/recommendations/feedbacks', {
      method: 'POST',
      body: {
        userId: Number(userId),
        movieId: Number(movieId),
        interactionType,
        rating: rating !== null ? Number(rating) : null,
        comment: comment || null
      }
    }),

  /**
   * POST /api/v1/recommendations/clicks
   * Record recommendation item click event for CTR analytics and conversion tracking
   */
  recordClick: ({ setId, movieId, userId }) =>
    aiRequest('/api/v1/recommendations/clicks', {
      method: 'POST',
      body: {
        setId: Number(setId),
        movieId: Number(movieId),
        userId: Number(userId)
      }
    }),

  /**
   * POST /api/v1/recommendations/reviews
   * Submit user movie review with comment and rating for aspect-based sentiment & consistency analysis
   */
  submitReview: ({ userId, movieId, rating, comment }) =>
    aiRequest('/api/v1/recommendations/reviews', {
      method: 'POST',
      body: {
        userId: Number(userId),
        movieId: Number(movieId),
        rating: Number(rating),
        comment: String(comment || '')
      }
    }),

  /**
   * GET /api/v1/recommendations/metrics
   * Full-funnel conversion telemetry and A/B test uplift analytics
   */
  getRecommendationMetrics: ({ branchId = null } = {}) => {
    const params = {};
    if (branchId !== null && branchId !== undefined) params.branch_id = branchId;
    return aiRequest('/api/v1/recommendations/metrics', { params });
  },

  /**
   * Backward-compatible alias for getRecommendationMetrics
   */
  getRecommendationStats: () => recommendationService.getRecommendationMetrics(),

  /**
   * DELETE /api/v1/recommendations/users/{user_id}/data
   * Purge all user preference records, reviews, recommendation history (GDPR right to be forgotten)
   */
  purgeUserData: (userId) =>
    aiRequest(`/api/v1/recommendations/users/${encodeURIComponent(userId)}/data`, {
      method: 'DELETE'
    }),

  /**
   * POST /api/v1/search/adaptive
   * Adaptive multi-tier movie search using Soft Utility Supervision and Entropy Fallback
   */
  adaptiveSearch: (query, limit = 10) =>
    aiRequest('/api/v1/search/adaptive', {
      method: 'POST',
      body: { query: String(query).trim(), limit: Number(limit) }
    }),

  /**
   * GET /api/v1/ai/metrics
   * Telemetry and latency metrics (P50, P95, route distribution)
   */
  getAiMetrics: () => aiRequest('/api/v1/ai/metrics'),

  /**
   * GET /api/v1/prompts
   * List LLM prompt templates
   */
  getPrompts: (activeOnly = false) =>
    aiRequest('/api/v1/prompts', { params: { active_only: activeOnly } })
};
