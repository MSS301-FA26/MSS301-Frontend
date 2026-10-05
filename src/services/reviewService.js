import { request } from './authService';

export const reviewService = {
  getMovieReviews: (movieId, page = 0, size = 10) =>
    request(`/api/v1/reviews/movies/${encodeURIComponent(movieId)}?page=${page}&size=${size}`),

  getReviewSummary: (movieId) =>
    request(`/api/v1/reviews/movies/${encodeURIComponent(movieId)}/summary`),

  getAverageRating: (movieId) =>
    request(`/api/v1/reviews/movies/${encodeURIComponent(movieId)}/average-rating`),

  checkEligibility: (token, movieId) =>
    request(`/api/v1/reviews/movies/${encodeURIComponent(movieId)}/eligibility`, { token }),

  getMyReviews: (token) =>
    request('/api/v1/reviews/me', { token }),

  createReview: (token, movieId, payload) =>
    request(`/api/v1/reviews/movies/${encodeURIComponent(movieId)}`, {
      method: 'POST',
      token,
      body: payload
    }),

  updateReview: (token, reviewId, payload) =>
    request(`/api/v1/reviews/${encodeURIComponent(reviewId)}`, {
      method: 'PUT',
      token,
      body: payload
    }),

  reportReview: (token, reviewId, payload) =>
    request(`/api/v1/reviews/${encodeURIComponent(reviewId)}/report`, {
      method: 'POST',
      token,
      body: payload
    })
};
