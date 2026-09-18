import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  CheckCircle2, XCircle, AlertCircle, Clock, Film, User,
  Calendar, ChevronDown, ChevronUp, RefreshCw, Eye, MessageSquare
} from 'lucide-react';
import { getStoredAuth, request } from '../../../services/authService';

export default function AdminApprovalsPanel({ showToast }) {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState('PENDING');
  const [expandedId, setExpandedId] = useState(null);
  const [processingId, setProcessingId] = useState(null);
  const [rejectModal, setRejectModal] = useState({ open: false, requestId: null, movieTitle: '', reason: '' });

  const token = () => getStoredAuth().accessToken;

  const fetchRequests = async () => {
    setLoading(true);
    try {
      const url = activeFilter === 'ALL'
        ? '/api/v1/admin/movie-edit-requests?status=ALL'
        : '/api/v1/admin/movie-edit-requests?status=PENDING';
      const data = await request(url, { token: token() });
      setRequests(Array.isArray(data) ? data : []);
    } catch (err) {
      showToast?.(err.message || 'Lỗi khi tải danh sách đề xuất', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRequests();
  }, [activeFilter]);

  const handleApprove = async (reqItem) => {
    if (!window.confirm(`Bạn có chắc chắn muốn CHẤP THUẬN và ÁP DỤNG các chỉnh sửa cho phim "${reqItem.movieTitle || `Phim #${reqItem.movieId}`}"?`)) {
      return;
    }
    setProcessingId(reqItem.id);
    try {
      await request(`/api/v1/admin/movie-edit-requests/${reqItem.id}/approve`, {
        method: 'POST',
        token: token()
      });
      showToast?.('Đã phê duyệt và cập nhật thông tin phim thành công!', 'success');
      await fetchRequests();
    } catch (err) {
      showToast?.(err.message || 'Không thể phê duyệt đề xuất', 'error');
    } finally {
      setProcessingId(null);
    }
  };

  const openRejectModal = (reqItem) => {
    setRejectModal({
      open: true,
      requestId: reqItem.id,
      movieTitle: reqItem.movieTitle || `Phim #${reqItem.movieId}`,
      reason: ''
    });
  };

  const handleConfirmReject = async (e) => {
    e.preventDefault();
    if (!rejectModal.reason.trim()) {
      showToast?.('Vui lòng nhập lý do từ chối', 'error');
      return;
    }
    setProcessingId(rejectModal.requestId);
    try {
      await request(`/api/v1/admin/movie-edit-requests/${rejectModal.requestId}/reject`, {
        method: 'POST',
        token: token(),
        body: { reason: rejectModal.reason.trim() }
      });
      showToast?.('Đã từ chối đề xuất chỉnh sửa phim.', 'info');
      setRejectModal({ open: false, requestId: null, movieTitle: '', reason: '' });
      await fetchRequests();
    } catch (err) {
      showToast?.(err.message || 'Không thể từ chối đề xuất', 'error');
    } finally {
      setProcessingId(null);
    }
  };

  const renderProposedDiff = (rawProposedData) => {
    if (!rawProposedData) return <p className="text-xs text-neutral-400 italic">Không có dữ liệu chi tiết.</p>;
    let parsed = null;
    try {
      parsed = typeof rawProposedData === 'string' ? JSON.parse(rawProposedData) : rawProposedData;
    } catch {
      return <pre className="text-xs font-mono bg-black/40 p-3 rounded text-neutral-300 overflow-x-auto">{rawProposedData}</pre>;
    }

    return (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
        {Object.entries(parsed).map(([key, val]) => {
          let displayVal = typeof val === 'object' ? JSON.stringify(val) : String(val);
          return (
            <div key={key} className="bg-white/[0.02] border border-white/[0.06] p-2.5 rounded">
              <span className="font-mono text-amber-400 uppercase text-[10px] tracking-wider block mb-0.5">{key}</span>
              <span className="text-neutral-200 break-words font-medium">{displayVal || '—'}</span>
            </div>
          );
        })}
      </div>
    );
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'PENDING':
        return <span className="inline-flex items-center gap-1 px-2.5 py-0.5 text-[11px] font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/30 rounded-full"><Clock className="w-3 h-3" /> Chờ duyệt</span>;
      case 'APPROVED':
        return <span className="inline-flex items-center gap-1 px-2.5 py-0.5 text-[11px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 rounded-full"><CheckCircle2 className="w-3 h-3" /> Đã chấp thuận</span>;
      case 'REJECTED':
        return <span className="inline-flex items-center gap-1 px-2.5 py-0.5 text-[11px] font-semibold bg-rose-500/10 text-rose-400 border border-rose-500/30 rounded-full"><XCircle className="w-3 h-3" /> Đã từ chối</span>;
      default:
        return <span className="inline-flex items-center px-2 py-0.5 text-xs bg-neutral-800 text-neutral-300 rounded">{status}</span>;
    }
  };

  const pendingCount = requests.filter(r => r.status === 'PENDING').length;

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/[0.08] pb-5">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
              <Film className="w-5 h-5 text-amber-400" />
              Trung tâm Duyệt đề xuất chỉnh sửa phim
            </h1>
            {pendingCount > 0 && (
              <span className="bg-amber-500 text-black text-xs font-bold px-2 py-0.5 rounded-full animate-pulse">
                {pendingCount} chờ duyệt
              </span>
            )}
          </div>
          <p className="text-xs text-neutral-400 mt-1">
            Xem xét và quyết định các đề xuất cập nhật thông tin phim do Cinema Managers gửi lên.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex bg-neutral-900 border border-white/[0.08] p-1 rounded-lg">
            <button
              onClick={() => setActiveFilter('PENDING')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                activeFilter === 'PENDING'
                  ? 'bg-amber-500 text-black font-semibold shadow'
                  : 'text-neutral-400 hover:text-white'
              }`}
            >
              Chờ duyệt
            </button>
            <button
              onClick={() => setActiveFilter('ALL')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                activeFilter === 'ALL'
                  ? 'bg-amber-500 text-black font-semibold shadow'
                  : 'text-neutral-400 hover:text-white'
              }`}
            >
              Tất cả lịch sử
            </button>
          </div>

          <button
            onClick={fetchRequests}
            disabled={loading}
            className="p-2 bg-neutral-900 border border-white/[0.08] hover:border-white/20 text-neutral-300 hover:text-white rounded-lg transition-colors"
            title="Làm mới"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <div className="py-16 text-center text-neutral-400 flex flex-col items-center gap-3">
          <RefreshCw className="w-6 h-6 animate-spin text-amber-400" />
          <p className="text-sm">Đang tải danh sách đề xuất...</p>
        </div>
      ) : requests.length === 0 ? (
        <div className="py-16 text-center border border-dashed border-white/[0.08] rounded-xl bg-white/[0.01]">
          <CheckCircle2 className="w-10 h-10 text-neutral-600 mx-auto mb-3" />
          <p className="text-sm font-medium text-neutral-300">Không có đề xuất chỉnh sửa nào cần duyệt</p>
          <p className="text-xs text-neutral-500 mt-1">Các đề xuất mới từ Cinema Manager sẽ xuất hiện tại đây.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {requests.map((item) => {
            const isExpanded = expandedId === item.id;
            const isPending = item.status === 'PENDING';
            const isProcessing = processingId === item.id;

            return (
              <div
                key={item.id}
                className={`border rounded-xl transition-all duration-200 overflow-hidden ${
                  isPending
                    ? 'bg-[#141414] border-amber-500/20 hover:border-amber-500/40'
                    : 'bg-[#121212] border-white/[0.06]'
                }`}
              >
                {/* Request Card Header */}
                <div className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="space-y-1.5 flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2.5">
                      <h3 className="font-semibold text-white text-base truncate">
                        {item.movieTitle || `Phim #${item.movieId}`}
                      </h3>
                      {getStatusBadge(item.status)}
                      <span className="text-[11px] font-mono text-neutral-500">ID #{item.id}</span>
                    </div>

                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-neutral-400">
                      <span className="flex items-center gap-1.5">
                        <User className="w-3.5 h-3.5 text-neutral-500" />
                        Người gửi: <strong className="text-neutral-200">{item.requesterName || `User #${item.requestedBy}`}</strong>
                      </span>
                      <span className="flex items-center gap-1.5">
                        <Calendar className="w-3.5 h-3.5 text-neutral-500" />
                        Gửi lúc: {item.createdAt ? new Date(item.createdAt).toLocaleString('vi-VN') : '—'}
                      </span>
                      {item.reviewedAt && (
                        <span className="flex items-center gap-1.5">
                          <Clock className="w-3.5 h-3.5 text-neutral-500" />
                          Duyệt lúc: {new Date(item.reviewedAt).toLocaleString('vi-VN')}
                        </span>
                      )}
                    </div>

                    {item.reason && (
                      <div className="mt-2 text-xs bg-black/40 border border-white/[0.04] p-2 rounded text-neutral-300">
                        <span className="font-semibold text-amber-400">Lý do đề xuất:</span> {item.reason}
                      </div>
                    )}

                    {item.rejectionReason && (
                      <div className="mt-2 text-xs bg-rose-950/30 border border-rose-500/20 p-2 rounded text-rose-300">
                        <span className="font-semibold">Lý do từ chối:</span> {item.rejectionReason}
                      </div>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                    <button
                      type="button"
                      onClick={() => setExpandedId(isExpanded ? null : item.id)}
                      className="px-3 py-1.5 text-xs font-medium text-neutral-300 hover:text-white bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] rounded-lg transition-colors flex items-center gap-1"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      {isExpanded ? 'Ẩn chi tiết' : 'Xem đề xuất'}
                      {isExpanded ? <ChevronUp className="w-3.5 h-3.5 ml-1" /> : <ChevronDown className="w-3.5 h-3.5 ml-1" />}
                    </button>

                    {isPending && (
                      <>
                        <button
                          type="button"
                          disabled={isProcessing}
                          onClick={() => handleApprove(item)}
                          className="px-3 py-1.5 text-xs font-semibold bg-emerald-500 hover:bg-emerald-400 text-black rounded-lg transition-colors flex items-center gap-1 shadow-sm disabled:opacity-50"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          Duyệt & Cập nhật
                        </button>
                        <button
                          type="button"
                          disabled={isProcessing}
                          onClick={() => openRejectModal(item)}
                          className="px-3 py-1.5 text-xs font-semibold bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 text-rose-300 hover:text-rose-200 rounded-lg transition-colors flex items-center gap-1 disabled:opacity-50"
                        >
                          <XCircle className="w-3.5 h-3.5" />
                          Từ chối
                        </button>
                      </>
                    )}
                  </div>
                </div>

                {/* Proposed Data Expansion Drawer */}
                <AnimatePresence>
                  {isExpanded && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="border-t border-white/[0.06] bg-black/40 p-4 sm:p-5"
                    >
                      <h4 className="text-xs font-semibold text-neutral-300 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                        <Film className="w-3.5 h-3.5 text-amber-400" />
                        Nội dung thông tin đề xuất thay đổi:
                      </h4>
                      {renderProposedDiff(item.proposedData)}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })}
        </div>
      )}

      {/* Reject Modal */}
      <AnimatePresence>
        {rejectModal.open && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-[#181818] border border-white/[0.12] rounded-xl max-w-md w-full p-5 shadow-2xl space-y-4"
            >
              <div className="flex items-center justify-between border-b border-white/[0.08] pb-3">
                <h3 className="font-semibold text-white flex items-center gap-2">
                  <XCircle className="w-5 h-5 text-rose-400" />
                  Từ chối đề xuất chỉnh sửa
                </h3>
                <button
                  type="button"
                  onClick={() => setRejectModal({ open: false, requestId: null, movieTitle: '', reason: '' })}
                  className="text-neutral-400 hover:text-white"
                >
                  ✕
                </button>
              </div>

              <p className="text-xs text-neutral-300">
                Bạn đang từ chối đề xuất cho phim <strong className="text-amber-300">{rejectModal.movieTitle}</strong>. Vui lòng giải thích rõ lý do để Manager điều chỉnh lại.
              </p>

              <form onSubmit={handleConfirmReject} className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-neutral-300 mb-1.5">
                    Lý do từ chối *
                  </label>
                  <textarea
                    required
                    rows={3}
                    maxLength={500}
                    value={rejectModal.reason}
                    onChange={(e) => setRejectModal({ ...rejectModal, reason: e.target.value })}
                    placeholder="Ví dụ: Thời lượng phim hoặc hình ảnh poster chưa đạt chuẩn chất lượng..."
                    className="w-full bg-neutral-900 border border-white/[0.12] focus:border-amber-400 focus:outline-none rounded-lg p-2.5 text-xs text-white placeholder-neutral-500"
                  />
                </div>

                <div className="flex justify-end gap-2 pt-2 border-t border-white/[0.06]">
                  <button
                    type="button"
                    onClick={() => setRejectModal({ open: false, requestId: null, movieTitle: '', reason: '' })}
                    className="px-3 py-1.5 text-xs text-neutral-400 hover:text-white transition-colors"
                  >
                    Hủy bỏ
                  </button>
                  <button
                    type="submit"
                    disabled={processingId === rejectModal.requestId || !rejectModal.reason.trim()}
                    className="px-4 py-1.5 text-xs font-semibold bg-rose-500 hover:bg-rose-600 text-white rounded-lg transition-colors disabled:opacity-50"
                  >
                    Xác nhận từ chối
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
