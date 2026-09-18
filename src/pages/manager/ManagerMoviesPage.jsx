import React, { useEffect, useState } from 'react';
import {
  Film, Plus, Clock, CheckCircle2, XCircle, AlertCircle,
  Upload, Send, RefreshCw, Edit3, Eye, FileText
} from 'lucide-react';
import { getStoredAuth, request } from '../../services/authService';
import { useUiStore } from '../../stores/useUiStore';

const emptyForm = {
  title: '',
  description: '',
  durationMinutes: 120,
  trailerUrl: '',
  posterUrl: '',
  avatarUrl: '',
  releaseDate: '',
  endDate: '',
  ageRating: 'T13',
  language: 'Tiếng Việt',
  subtitleLanguage: 'EN Sub',
  director: '',
  actorIds: [],
  mainActorIds: [],
  genreIds: []
};

export default function ManagerMoviesPage() {
  const showToast = useUiStore((state) => state.showToast);

  const [movies, setMovies] = useState([]);
  const [actors, setActors] = useState([]);
  const [genres, setGenres] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [targetMovie, setTargetMovie] = useState(null);
  const [editReason, setEditReason] = useState('');
  const [requests, setRequests] = useState([]);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('MOVIES'); // 'MOVIES' | 'FORM' | 'REQUESTS'

  const token = () => getStoredAuth().accessToken;

  const load = async () => {
    setLoading(true);
    try {
      const [moviePage, actorPage, genrePage, editRequests] = await Promise.all([
        request('/api/v1/admin/movies?size=100', { token: token() }),
        request('/api/v1/actors?size=100').catch(() => ({ items: [] })),
        request('/api/v1/genres?size=100').catch(() => ({ items: [] })),
        request('/api/v1/manager/movie-edit-requests', { token: token() }).catch(() => [])
      ]);
      setMovies(moviePage?.items || []);
      setActors(actorPage?.items || []);
      setGenres(genrePage?.items || []);
      setRequests(Array.isArray(editRequests) ? editRequests : []);
    } catch (err) {
      showToast(err.message || 'Không thể tải thư viện phim', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const upload = async (field, file) => {
    if (!file) return;
    setBusy(true);
    try {
      const body = new FormData();
      body.append('file', file);
      body.append('folder', field === 'trailerUrl' ? 'movies-trailers' : 'movies-posters');
      const uploaded = await request(
        `/api/v1/admin/uploads/${field === 'trailerUrl' ? 'videos' : 'images'}`,
        { method: 'POST', token: token(), body }
      );
      setForm((current) => ({ ...current, [field]: uploaded.url }));
      showToast(`Đã tải lên tệp cho ${field}`, 'success');
    } catch (err) {
      showToast(err.message || 'Tải lên tệp thất bại', 'error');
    } finally {
      setBusy(false);
    }
  };

  const handleSaveOrSubmitProposal = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      if (targetMovie?.publicationStatus === 'PUBLISHED') {
        if (!editReason.trim()) {
          showToast('Vui lòng nhập lý do đề xuất sửa phim đã công bố', 'error');
          setBusy(false);
          return;
        }
        await request(`/api/v1/manager/movie-edit-requests/movies/${targetMovie.id}`, {
          method: 'POST',
          token: token(),
          body: { proposed: form, reason: editReason.trim() }
        });
        showToast('Đã gửi đề xuất chỉnh sửa phim lên Admin thành công. Phim hiện tại vẫn mở bán bình thường.', 'success');
      } else if (targetMovie) {
        await request(`/api/v1/admin/movies/${targetMovie.id}`, {
          method: 'PUT',
          token: token(),
          body: form
        });
        showToast('Đã cập nhật bản nháp phim thành công', 'success');
      } else {
        const created = await request('/api/v1/admin/movies', {
          method: 'POST',
          token: token(),
          body: form
        });
        showToast(`Đã tạo bản nháp phim: ${created.title}`, 'success');
      }

      setForm(emptyForm);
      setTargetMovie(null);
      setEditReason('');
      setActiveTab('MOVIES');
      await load();
    } catch (err) {
      showToast(err.message || 'Không thể lưu thông tin phim', 'error');
    } finally {
      setBusy(false);
    }
  };

  const submitDraftForApproval = async (movieId) => {
    setBusy(true);
    try {
      await request(`/api/v1/admin/movies/${movieId}/submit`, { method: 'POST', token: token() });
      showToast('Đã gửi phim lên Admin phê duyệt công bố', 'success');
      await load();
    } catch (err) {
      showToast(err.message || 'Gửi duyệt thất bại', 'error');
    } finally {
      setBusy(false);
    }
  };

  const toggleActor = (id) => {
    setForm((current) => {
      const actorIds = current.actorIds.includes(id)
        ? current.actorIds.filter((val) => val !== id)
        : [...current.actorIds, id];
      return {
        ...current,
        actorIds,
        mainActorIds: current.mainActorIds.filter((val) => actorIds.includes(val))
      };
    });
  };

  const startEdit = (movie) => {
    setTargetMovie(movie);
    setForm({
      ...emptyForm,
      title: movie.title || '',
      description: movie.description || '',
      durationMinutes: movie.durationMinutes || movie.duration || 120,
      trailerUrl: movie.trailerUrl || '',
      posterUrl: movie.posterUrl || '',
      avatarUrl: movie.avatarUrl || '',
      ageRating: movie.ageRating || 'T13',
      language: movie.language || 'Tiếng Việt',
      subtitleLanguage: movie.subtitleLanguage || 'EN Sub',
      director: movie.director || '',
      actorIds: (movie.actors || []).map((actor) => actor.id),
      genreIds: (movie.genres || []).map((genre) => genre.id),
      mainActorIds: movie.mainActorIds || [],
      releaseDate: movie.releaseDate || '',
      endDate: movie.endDate || ''
    });
    setEditReason('');
    setActiveTab('FORM');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/[0.08] pb-5">
        <div>
          <span className="text-[10px] font-mono uppercase tracking-[0.2em] text-amber-400 font-bold">
            Thư viện phim & Đề xuất
          </span>
          <h1 className="text-2xl font-bold tracking-tight text-white mt-1">
            Quản lý Phim & Đề xuất chỉnh sửa
          </h1>
          <p className="text-xs text-neutral-400 mt-0.5">
            Tạo bản nháp phim mới, hoặc gửi đề xuất thay đổi nội dung phim đã công bố lên Admin.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              setTargetMovie(null);
              setForm(emptyForm);
              setActiveTab('FORM');
            }}
            className="flex items-center gap-2 px-3.5 py-2 bg-amber-500 hover:bg-amber-400 text-black font-semibold rounded-lg text-xs transition-all shadow-lg shadow-amber-500/10"
          >
            <Plus className="w-4 h-4" />
            Tạo bản nháp phim
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-white/[0.08] pb-3 text-xs">
        <button
          onClick={() => setActiveTab('MOVIES')}
          className={`px-3 py-1.5 rounded-lg font-medium transition-colors ${
            activeTab === 'MOVIES'
              ? 'bg-amber-500 text-black font-semibold'
              : 'text-neutral-400 hover:text-white bg-white/[0.02]'
          }`}
        >
          Danh sách phim ({movies.length})
        </button>
        <button
          onClick={() => setActiveTab('REQUESTS')}
          className={`px-3 py-1.5 rounded-lg font-medium transition-colors flex items-center gap-1.5 ${
            activeTab === 'REQUESTS'
              ? 'bg-amber-500 text-black font-semibold'
              : 'text-neutral-400 hover:text-white bg-white/[0.02]'
          }`}
        >
          <FileText className="w-3.5 h-3.5" />
          Yêu cầu sửa của tôi ({requests.length})
        </button>
        {targetMovie && (
          <button
            onClick={() => setActiveTab('FORM')}
            className={`px-3 py-1.5 rounded-lg font-medium transition-colors ${
              activeTab === 'FORM'
                ? 'bg-amber-500 text-black font-semibold'
                : 'text-neutral-400 hover:text-white bg-white/[0.02]'
            }`}
          >
            Đang chỉnh sửa: {targetMovie.title}
          </button>
        )}
      </div>

      {/* TAB 1: Movie Library Table */}
      {activeTab === 'MOVIES' && (
        <div className="border border-white/[0.08] rounded-xl overflow-hidden bg-[#121212]">
          <table className="w-full text-left text-xs text-neutral-300">
            <thead className="bg-[#181818] border-b border-white/[0.08] text-[11px] uppercase tracking-wider text-neutral-400">
              <tr>
                <th className="p-3.5">Phim</th>
                <th className="p-3.5">Thời lượng</th>
                <th className="p-3.5">Duyệt nội dung</th>
                <th className="p-3.5">Trạng thái công bố</th>
                <th className="p-3.5 text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.06]">
              {movies.map((m) => {
                const isPublished = m.publicationStatus === 'PUBLISHED';
                const isDraft = ['DRAFT', 'REJECTED'].includes(m.approvalStatus);

                return (
                  <tr key={m.id} className="hover:bg-white/[0.02] transition-colors">
                    <td className="p-3.5">
                      <p className="font-semibold text-white">{m.title}</p>
                      <p className="text-[10px] text-neutral-500 font-mono">ID: #{m.id}</p>
                    </td>
                    <td className="p-3.5 font-mono text-neutral-300">
                      {m.durationMinutes || m.duration || 120} phút
                    </td>
                    <td className="p-3.5">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                        m.approvalStatus === 'APPROVED'
                          ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                          : m.approvalStatus === 'PENDING'
                            ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                            : 'bg-neutral-800 text-neutral-400'
                      }`}>
                        {m.approvalStatus}
                      </span>
                    </td>
                    <td className="p-3.5">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                        isPublished
                          ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20'
                          : 'bg-neutral-800 text-neutral-400'
                      }`}>
                        {m.publicationStatus}
                      </span>
                    </td>
                    <td className="p-3.5 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => startEdit(m)}
                          className="px-2.5 py-1 rounded text-xs font-medium bg-white/[0.04] hover:bg-white/[0.08] text-neutral-200 hover:text-white border border-white/[0.08] transition-colors"
                        >
                          {isPublished ? 'Đề xuất sửa' : 'Sửa nháp'}
                        </button>
                        {isDraft && (
                          <button
                            disabled={busy}
                            onClick={() => submitDraftForApproval(m.id)}
                            className="px-2.5 py-1 rounded text-xs font-medium bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/30 transition-colors"
                          >
                            Gửi Admin duyệt
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* TAB 2: Edit Proposal / Draft Form */}
      {activeTab === 'FORM' && (
        <div className="border border-white/[0.08] rounded-xl bg-[#121212] p-6 space-y-5">
          <div className="flex items-center justify-between border-b border-white/[0.08] pb-3">
            <div>
              <h2 className="text-base font-bold text-white">
                {targetMovie?.publicationStatus === 'PUBLISHED'
                  ? `Đề xuất chỉnh sửa phim đã công bố: "${targetMovie.title}"`
                  : targetMovie
                    ? `Chỉnh sửa bản nháp: "${targetMovie.title}"`
                    : 'Tạo bản nháp phim mới'}
              </h2>
              {targetMovie?.publicationStatus === 'PUBLISHED' && (
                <p className="text-xs text-amber-300 mt-0.5">
                  Lưu ý: Thay đổi sẽ được gửi lên Admin dưới dạng đề xuất và chỉ áp dụng khi Admin phê duyệt.
                </p>
              )}
            </div>
            <button
              type="button"
              onClick={() => {
                setTargetMovie(null);
                setForm(emptyForm);
                setActiveTab('MOVIES');
              }}
              className="text-xs text-neutral-400 hover:text-white"
            >
              Hủy bỏ
            </button>
          </div>

          <form onSubmit={handleSaveOrSubmitProposal} className="space-y-4 text-xs">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-neutral-300 font-medium mb-1">Tên phim *</label>
                <input
                  required
                  type="text"
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  className="w-full bg-neutral-900 border border-white/[0.12] rounded-lg p-2.5 text-white outline-none focus:border-amber-400"
                />
              </div>

              <div>
                <label className="block text-neutral-300 font-medium mb-1">Thời lượng (phút) *</label>
                <input
                  required
                  type="number"
                  min="1"
                  value={form.durationMinutes}
                  onChange={(e) => setForm({ ...form, durationMinutes: Number(e.target.value) })}
                  className="w-full bg-neutral-900 border border-white/[0.12] rounded-lg p-2.5 text-white outline-none focus:border-amber-400 font-mono"
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-neutral-300 font-medium mb-1">Mô tả nội dung tóm tắt *</label>
                <textarea
                  required
                  rows={3}
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  className="w-full bg-neutral-900 border border-white/[0.12] rounded-lg p-2.5 text-white outline-none focus:border-amber-400"
                />
              </div>

              <div>
                <label className="block text-neutral-300 font-medium mb-1">Đạo diễn</label>
                <input
                  type="text"
                  value={form.director}
                  onChange={(e) => setForm({ ...form, director: e.target.value })}
                  className="w-full bg-neutral-900 border border-white/[0.12] rounded-lg p-2.5 text-white outline-none focus:border-amber-400"
                />
              </div>

              <div>
                <label className="block text-neutral-300 font-medium mb-1">Phân loại khán giả</label>
                <select
                  value={form.ageRating}
                  onChange={(e) => setForm({ ...form, ageRating: e.target.value })}
                  className="w-full bg-neutral-900 border border-white/[0.12] rounded-lg p-2.5 text-white outline-none focus:border-amber-400"
                >
                  {['P', 'K', 'T13', 'T16', 'T18'].map((r) => (
                    <option key={r} value={r}>{r}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-neutral-300 font-medium mb-1">Ngày phát hành</label>
                <input
                  type="date"
                  value={form.releaseDate}
                  onChange={(e) => setForm({ ...form, releaseDate: e.target.value })}
                  className="w-full bg-neutral-900 border border-white/[0.12] rounded-lg p-2.5 text-white outline-none focus:border-amber-400"
                />
              </div>

              <div>
                <label className="block text-neutral-300 font-medium mb-1">Ngày kết thúc dự kiến</label>
                <input
                  type="date"
                  value={form.endDate}
                  onChange={(e) => setForm({ ...form, endDate: e.target.value })}
                  className="w-full bg-neutral-900 border border-white/[0.12] rounded-lg p-2.5 text-white outline-none focus:border-amber-400"
                />
              </div>

              {/* Poster & Trailer Uploads */}
              <div>
                <label className="block text-neutral-300 font-medium mb-1">Poster phim (Ảnh)</label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => upload('posterUrl', e.target.files?.[0])}
                  className="block w-full text-neutral-400"
                />
                {form.posterUrl && <span className="text-[10px] text-emerald-400 mt-1 block truncate font-mono">{form.posterUrl}</span>}
              </div>

              <div>
                <label className="block text-neutral-300 font-medium mb-1">Banner phim (Ảnh ngang)</label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => upload('avatarUrl', e.target.files?.[0])}
                  className="block w-full text-neutral-400"
                />
                {form.avatarUrl && <span className="text-[10px] text-emerald-400 mt-1 block truncate font-mono">{form.avatarUrl}</span>}
              </div>

              <div className="md:col-span-2">
                <label className="block text-neutral-300 font-medium mb-1">Trailer video</label>
                <input
                  type="file"
                  accept="video/*"
                  onChange={(e) => upload('trailerUrl', e.target.files?.[0])}
                  className="block w-full text-neutral-400"
                />
                {form.trailerUrl && <span className="text-[10px] text-emerald-400 mt-1 block truncate font-mono">{form.trailerUrl}</span>}
              </div>

              {/* Lý do thay đổi nếu là phim đã công bố */}
              {targetMovie?.publicationStatus === 'PUBLISHED' && (
                <div className="md:col-span-2 bg-amber-500/[0.06] border border-amber-500/20 p-3 rounded-lg">
                  <label className="block text-amber-300 font-bold mb-1">
                    Lý do đề xuất thay đổi thông tin phim *
                  </label>
                  <input
                    required
                    type="text"
                    maxLength={500}
                    placeholder="Ví dụ: Đính chính lại thời lượng chuẩn hoặc cập nhật trailer bản quyền mới..."
                    value={editReason}
                    onChange={(e) => setEditReason(e.target.value)}
                    className="w-full bg-neutral-900 border border-white/[0.12] rounded-lg p-2.5 text-white outline-none focus:border-amber-400"
                  />
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-white/[0.08]">
              <button
                type="button"
                onClick={() => setActiveTab('MOVIES')}
                className="px-4 py-2 text-neutral-400 hover:text-white transition-colors"
              >
                Hủy
              </button>
              <button
                type="submit"
                disabled={busy}
                className="px-5 py-2 bg-amber-500 hover:bg-amber-400 text-black font-semibold rounded-lg transition-colors disabled:opacity-50"
              >
                {busy ? 'Đang gửi...' : targetMovie?.publicationStatus === 'PUBLISHED' ? 'Gửi đề xuất duyệt' : 'Lưu bản nháp'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* TAB 3: My Requests History */}
      {activeTab === 'REQUESTS' && (
        <div className="border border-white/[0.08] rounded-xl overflow-hidden bg-[#121212]">
          {requests.length === 0 ? (
            <p className="text-neutral-500 text-xs py-12 text-center">Bạn chưa gửi đề xuất chỉnh sửa nào.</p>
          ) : (
            <table className="w-full text-left text-xs text-neutral-300">
              <thead className="bg-[#181818] border-b border-white/[0.08] text-[11px] uppercase tracking-wider text-neutral-400">
                <tr>
                  <th className="p-3.5">Mã yêu cầu</th>
                  <th className="p-3.5">Phim</th>
                  <th className="p-3.5">Lý do đề xuất</th>
                  <th className="p-3.5">Trạng thái duyệt</th>
                  <th className="p-3.5">Phản hồi từ Admin</th>
                  <th className="p-3.5 text-right">Ngày gửi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.06]">
                {requests.map((req) => (
                  <tr key={req.id} className="hover:bg-white/[0.02] transition-colors">
                    <td className="p-3.5 font-mono text-neutral-500">#{req.id}</td>
                    <td className="p-3.5 font-semibold text-white">
                      {req.movieTitle || `Phim #${req.movieId}`}
                    </td>
                    <td className="p-3.5 text-neutral-300 max-w-xs truncate">
                      {req.reason || '—'}
                    </td>
                    <td className="p-3.5">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                        req.status === 'APPROVED'
                          ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                          : req.status === 'PENDING'
                            ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                            : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                      }`}>
                        {req.status}
                      </span>
                    </td>
                    <td className="p-3.5 text-rose-300 italic">
                      {req.rejectionReason || '—'}
                    </td>
                    <td className="p-3.5 text-right font-mono text-neutral-500">
                      {req.createdAt ? new Date(req.createdAt).toLocaleDateString('vi-VN') : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}
