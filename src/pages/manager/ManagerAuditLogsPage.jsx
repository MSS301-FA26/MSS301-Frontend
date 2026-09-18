import React, { useState, useEffect } from 'react';
import {
  ShieldAlert, Clock, User, FileText,
  RefreshCw, Search, CheckCircle2, AlertCircle
} from 'lucide-react';
import { useManagerCinema } from '../../context/ManagerCinemaContext';
import { getStoredAuth, request } from '../../services/authService';
import { useUiStore } from '../../stores/useUiStore';

export default function ManagerAuditLogsPage() {
  const { selectedCinemaId, selectedCinema } = useManagerCinema();
  const showToast = useUiStore((state) => state.showToast);

  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  const token = () => getStoredAuth().accessToken;

  const loadLogs = async () => {
    if (!selectedCinemaId) return;
    setLoading(true);
    try {
      const data = await request(`/api/v1/manager/cinemas/${selectedCinemaId}/audit-logs?size=100`, {
        token: token()
      });
      setLogs(data?.items || (Array.isArray(data) ? data : []));
    } catch (err) {
      showToast(err.message || 'Không thể tải nhật ký hoạt động', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadLogs();
  }, [selectedCinemaId]);

  const filteredLogs = logs.filter((l) => {
    if (!searchQuery.trim()) return true;
    const query = searchQuery.toLowerCase();
    return (
      (l.action && l.action.toLowerCase().includes(query)) ||
      (l.targetType && l.targetType.toLowerCase().includes(query)) ||
      (l.detail && l.detail.toLowerCase().includes(query)) ||
      (l.username && l.username.toLowerCase().includes(query))
    );
  });

  const getActionBadge = (action) => {
    switch (action) {
      case 'CREATE':
        return <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">CREATE</span>;
      case 'UPDATE':
        return <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-blue-500/10 text-blue-400 border border-blue-500/20">UPDATE</span>;
      case 'DELETE':
        return <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-rose-500/10 text-rose-400 border border-rose-500/20">DELETE</span>;
      default:
        return <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-neutral-800 text-neutral-300">{action}</span>;
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/[0.08] pb-5">
        <div>
          <span className="text-[10px] font-mono uppercase tracking-[0.2em] text-amber-400 font-bold">
            Nhật ký kiểm toán hệ thống
          </span>
          <h1 className="text-2xl font-bold tracking-tight text-white mt-1">
            Audit Log Chi nhánh ({selectedCinema?.name})
          </h1>
          <p className="text-xs text-neutral-400 mt-0.5">
            Lưu vết tự động mọi hành động tạo suất chiếu, đổi trạng thái ghế, xuất/nhập kho F&B của chi nhánh.
          </p>
        </div>

        <button
          onClick={loadLogs}
          className="flex items-center gap-2 px-3 py-2 bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.1] rounded-lg text-xs font-medium text-neutral-200 transition-colors self-start sm:self-center"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-amber-400' : ''}`} />
          Làm mới log
        </button>
      </div>

      {/* Search Input */}
      <div className="flex items-center gap-2 bg-[#141414] border border-white/[0.08] p-3 rounded-xl text-xs">
        <Search className="w-4 h-4 text-neutral-500 ml-1" />
        <input
          type="text"
          placeholder="Lọc theo hành động, đối tượng, người thực hiện hoặc nội dung..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full bg-transparent text-white text-xs outline-none placeholder-neutral-500"
        />
      </div>

      {/* Audit Log Table */}
      {loading ? (
        <div className="py-16 text-center text-neutral-400 flex flex-col items-center gap-2">
          <RefreshCw className="w-5 h-5 animate-spin text-amber-400" />
          <p className="text-xs">Đang tải nhật ký audit log...</p>
        </div>
      ) : filteredLogs.length === 0 ? (
        <div className="py-16 text-center border border-dashed border-white/[0.08] rounded-xl bg-white/[0.01]">
          <ShieldAlert className="w-10 h-10 text-neutral-600 mx-auto mb-3" />
          <p className="text-sm font-medium text-neutral-300">Không có bản ghi nhật ký nào</p>
          <p className="text-xs text-neutral-500 mt-1">Các thao tác vận hành trên rạp sẽ tự động xuất hiện tại đây.</p>
        </div>
      ) : (
        <div className="border border-white/[0.08] rounded-xl overflow-hidden bg-[#121212]">
          <table className="w-full text-left text-xs text-neutral-300">
            <thead className="bg-[#181818] border-b border-white/[0.08] text-[11px] uppercase tracking-wider text-neutral-400">
              <tr>
                <th className="p-3.5">Hành động</th>
                <th className="p-3.5">Đối tượng tác động</th>
                <th className="p-3.5">Chi tiết thao tác</th>
                <th className="p-3.5">Người thực hiện</th>
                <th className="p-3.5 text-right">Thời gian ghi nhận</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.06]">
              {filteredLogs.map((log) => (
                <tr key={log.id} className="hover:bg-white/[0.02] transition-colors">
                  <td className="p-3.5">
                    {getActionBadge(log.action)}
                  </td>
                  <td className="p-3.5 font-mono text-white font-medium">
                    {log.targetType} <span className="text-neutral-500">#{log.targetId}</span>
                  </td>
                  <td className="p-3.5 text-neutral-200">
                    {log.detail || '—'}
                  </td>
                  <td className="p-3.5">
                    <span className="font-medium text-amber-300">{log.username || 'System'}</span>
                  </td>
                  <td className="p-3.5 text-right font-mono text-neutral-400">
                    {log.createdAt ? new Date(log.createdAt).toLocaleString('vi-VN') : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
