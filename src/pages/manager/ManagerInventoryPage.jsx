import React, { useState, useEffect } from 'react';
import {
  ShoppingBag, AlertTriangle, ArrowUpDown, Plus, RefreshCw,
  Clock, Package, FileText, CheckCircle2, History
} from 'lucide-react';
import { useManagerCinema } from '../../context/ManagerCinemaContext';
import { getStoredAuth, request } from '../../services/authService';
import { useUiStore } from '../../stores/useUiStore';

export default function ManagerInventoryPage() {
  const { selectedCinemaId, selectedCinema } = useManagerCinema();
  const showToast = useUiStore((state) => state.showToast);

  const [inventory, setInventory] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [filterType, setFilterType] = useState('ALL'); // 'ALL' | 'LOW_STOCK'
  const [loading, setLoading] = useState(true);

  // Stock Adjustment Modal
  const [adjustModalOpen, setAdjustModalOpen] = useState(false);
  const [adjustForm, setAdjustForm] = useState({
    foodItemId: '',
    type: 'IMPORT',
    quantityDelta: '',
    reason: ''
  });
  const [saving, setSaving] = useState(false);

  const token = () => getStoredAuth().accessToken;

  const loadData = async () => {
    if (!selectedCinemaId) return;
    setLoading(true);
    try {
      const invUrl = filterType === 'LOW_STOCK'
        ? `/api/v1/manager/cinemas/${selectedCinemaId}/inventory/low-stock`
        : `/api/v1/manager/cinemas/${selectedCinemaId}/inventory`;

      const [stockData, txData] = await Promise.all([
        request(invUrl, { token: token() }),
        request(`/api/v1/manager/cinemas/${selectedCinemaId}/inventory/transactions?size=20`, { token: token() }).catch(() => ({ items: [] }))
      ]);

      setInventory(Array.isArray(stockData) ? stockData : []);
      setTransactions(txData?.items || []);
    } catch (err) {
      showToast(err.message || 'Không thể tải dữ liệu tồn kho F&B', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [selectedCinemaId, filterType]);

  const openAdjustModal = (item = null) => {
    setAdjustForm({
      foodItemId: item ? String(item.foodItemId || item.id) : (inventory[0]?.foodItemId ? String(inventory[0].foodItemId) : ''),
      type: 'IMPORT',
      quantityDelta: '',
      reason: ''
    });
    setAdjustModalOpen(true);
  };

  const handleAdjustSubmit = async (e) => {
    e.preventDefault();
    if (!adjustForm.foodItemId || !adjustForm.quantityDelta || !adjustForm.reason.trim()) {
      showToast('Vui lòng điền đầy đủ thông tin điều chỉnh kho', 'error');
      return;
    }
    setSaving(true);
    try {
      await request(`/api/v1/manager/cinemas/${selectedCinemaId}/inventory/adjust`, {
        method: 'POST',
        token: token(),
        body: {
          cinemaId: Number(selectedCinemaId),
          foodItemId: Number(adjustForm.foodItemId),
          type: adjustForm.type,
          quantityDelta: Number(adjustForm.quantityDelta),
          reason: adjustForm.reason.trim()
        }
      });
      showToast('Đã ghi nhận điều chỉnh tồn kho thành công', 'success');
      setAdjustModalOpen(false);
      loadData();
    } catch (err) {
      showToast(err.message || 'Không thể điều chỉnh tồn kho', 'error');
    } finally {
      setSaving(false);
    }
  };

  const lowStockCount = inventory.filter((item) => (item.quantity || 0) <= (item.minStockThreshold || 10)).length;

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/[0.08] pb-5">
        <div>
          <span className="text-[10px] font-mono uppercase tracking-[0.2em] text-amber-400 font-bold">
            Vận hành kho F&B
          </span>
          <h1 className="text-2xl font-bold tracking-tight text-white mt-1">
            Quản lý Kho Bắp nước ({selectedCinema?.name})
          </h1>
          <p className="text-xs text-neutral-400 mt-0.5">
            Kiểm kê số lượng thực tế, xử lý hàng hỏng/hết hạn và ghi nhận nhật ký xuất nhập kho.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => openAdjustModal()}
            className="flex items-center gap-2 px-3.5 py-2 bg-amber-500 hover:bg-amber-400 text-black font-semibold rounded-lg text-xs transition-all shadow-lg shadow-amber-500/10"
          >
            <Plus className="w-4 h-4" />
            Nhập kho / Điều chỉnh tồn
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-4 rounded-xl bg-[#141414] border border-white/[0.08] flex items-center justify-between">
          <div>
            <p className="text-xs text-neutral-400 font-medium">Tổng mặt hàng trong kho</p>
            <p className="text-2xl font-bold text-white mt-1 font-mono">{inventory.length}</p>
          </div>
          <div className="p-3 bg-white/[0.04] text-neutral-300 rounded-xl">
            <Package className="w-5 h-5" />
          </div>
        </div>

        <div className="p-4 rounded-xl bg-[#141414] border border-white/[0.08] flex items-center justify-between">
          <div>
            <p className="text-xs text-neutral-400 font-medium">Hàng sắp hết (Cần nhập thêm)</p>
            <p className={`text-2xl font-bold mt-1 font-mono ${lowStockCount > 0 ? 'text-rose-400' : 'text-emerald-400'}`}>
              {lowStockCount}
            </p>
          </div>
          <div className={`p-3 rounded-xl ${lowStockCount > 0 ? 'bg-rose-500/10 text-rose-400' : 'bg-emerald-500/10 text-emerald-400'}`}>
            <AlertTriangle className="w-5 h-5" />
          </div>
        </div>

        <div className="p-4 rounded-xl bg-[#141414] border border-white/[0.08] flex items-center justify-between">
          <div>
            <p className="text-xs text-neutral-400 font-medium">Lịch sử giao dịch kho</p>
            <p className="text-2xl font-bold text-white mt-1 font-mono">{transactions.length}</p>
          </div>
          <div className="p-3 bg-white/[0.04] text-neutral-300 rounded-xl">
            <History className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center justify-between border-b border-white/[0.08] pb-3">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setFilterType('ALL')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              filterType === 'ALL'
                ? 'bg-amber-500 text-black font-semibold'
                : 'text-neutral-400 hover:text-white bg-white/[0.02]'
            }`}
          >
            Tất cả sản phẩm ({inventory.length})
          </button>
          <button
            onClick={() => setFilterType('LOW_STOCK')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors flex items-center gap-1.5 ${
              filterType === 'LOW_STOCK'
                ? 'bg-rose-500 text-white font-semibold'
                : 'text-neutral-400 hover:text-rose-300 bg-white/[0.02]'
            }`}
          >
            <AlertTriangle className="w-3.5 h-3.5" />
            Cảnh báo sắp hết
          </button>
        </div>

        <button
          onClick={loadData}
          className="p-1.5 text-neutral-400 hover:text-white bg-white/[0.02] hover:bg-white/[0.06] border border-white/[0.06] rounded-lg transition-colors"
          title="Làm mới"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Inventory Table */}
      {loading ? (
        <div className="py-16 text-center text-neutral-400 flex flex-col items-center gap-2">
          <RefreshCw className="w-5 h-5 animate-spin text-amber-400" />
          <p className="text-xs">Đang tải danh sách tồn kho...</p>
        </div>
      ) : inventory.length === 0 ? (
        <div className="py-16 text-center border border-dashed border-white/[0.08] rounded-xl bg-white/[0.01]">
          <ShoppingBag className="w-10 h-10 text-neutral-600 mx-auto mb-3" />
          <p className="text-sm font-medium text-neutral-300">Không có sản phẩm nào trong kho</p>
          <p className="text-xs text-neutral-500 mt-1">Bấm "Nhập kho / Điều chỉnh tồn" để cập nhật số lượng.</p>
        </div>
      ) : (
        <div className="border border-white/[0.08] rounded-xl overflow-hidden bg-[#121212]">
          <table className="w-full text-left text-xs text-neutral-300">
            <thead className="bg-[#181818] border-b border-white/[0.08] text-[11px] uppercase tracking-wider text-neutral-400">
              <tr>
                <th className="p-3.5">Món ăn / Nước uống</th>
                <th className="p-3.5">Phân loại</th>
                <th className="p-3.5">Tồn kho hiện tại</th>
                <th className="p-3.5">Ngưỡng tối thiểu</th>
                <th className="p-3.5">Trạng thái kho</th>
                <th className="p-3.5 text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.06]">
              {inventory.map((item) => {
                const isLow = (item.quantity || 0) <= (item.minStockThreshold || 10);
                return (
                  <tr key={item.id || item.foodItemId} className="hover:bg-white/[0.02] transition-colors">
                    <td className="p-3.5">
                      <p className="font-semibold text-white">{item.foodItemName || item.name || `Món #${item.foodItemId}`}</p>
                      <span className="text-[10px] text-neutral-500 font-mono">ID: {item.foodItemId || item.id}</span>
                    </td>
                    <td className="p-3.5 text-neutral-400">
                      {item.category || item.kind || 'F&B Item'}
                    </td>
                    <td className="p-3.5">
                      <span className={`text-base font-bold font-mono ${isLow ? 'text-rose-400' : 'text-white'}`}>
                        {item.quantity || 0}
                      </span>
                      <span className="text-neutral-500 text-[11px] ml-1">phần</span>
                    </td>
                    <td className="p-3.5 text-neutral-400 font-mono">
                      {item.minStockThreshold || 10} phần
                    </td>
                    <td className="p-3.5">
                      {isLow ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold bg-rose-500/10 text-rose-400 border border-rose-500/20">
                          <AlertTriangle className="w-3 h-3" /> Cảnh báo sắp hết
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                          <CheckCircle2 className="w-3 h-3" /> Ổn định
                        </span>
                      )}
                    </td>
                    <td className="p-3.5 text-right">
                      <button
                        onClick={() => openAdjustModal(item)}
                        className="px-2.5 py-1 text-xs font-medium text-amber-300 hover:text-black hover:bg-amber-400 border border-amber-400/40 rounded transition-colors"
                      >
                        Điều chỉnh
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Transactions History Section */}
      <div className="border border-white/[0.08] rounded-xl bg-[#121212] p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold text-white flex items-center gap-2">
            <History className="w-4 h-4 text-amber-400" />
            Nhật ký điều chỉnh tồn kho gần đây
          </h2>
        </div>

        {transactions.length === 0 ? (
          <p className="text-xs text-neutral-500 py-4 text-center">Chưa có lịch sử giao dịch nào được ghi nhận.</p>
        ) : (
          <div className="divide-y divide-white/[0.06] text-xs">
            {transactions.map((tx) => (
              <div key={tx.id} className="py-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-white">{tx.foodItemName || `Món #${tx.foodItemId}`}</span>
                    <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-white/[0.04] text-amber-300 border border-white/[0.06]">
                      {tx.type}
                    </span>
                  </div>
                  <p className="text-neutral-400 text-[11px]">
                    Lý do: <span className="text-neutral-200">{tx.reason || '—'}</span>
                  </p>
                </div>

                <div className="text-right shrink-0">
                  <div className="flex items-center gap-2 justify-end font-mono">
                    <span className="text-neutral-500">{tx.beforeQuantity}</span>
                    <span className="text-neutral-400">→</span>
                    <span className="text-white font-bold">{tx.afterQuantity}</span>
                    <span className={`font-bold ml-1 ${tx.quantityDelta > 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                      ({tx.quantityDelta > 0 ? `+${tx.quantityDelta}` : tx.quantityDelta})
                    </span>
                  </div>
                  <span className="text-[10px] text-neutral-500">
                    {tx.createdAt ? new Date(tx.createdAt).toLocaleString('vi-VN') : '—'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Adjust Modal */}
      {adjustModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="bg-[#181818] border border-white/[0.12] rounded-xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-white/[0.08] pb-3">
              <h3 className="font-semibold text-white flex items-center gap-2 text-sm">
                <ArrowUpDown className="w-4 h-4 text-amber-400" />
                Điều chỉnh tồn kho F&B
              </h3>
              <button
                type="button"
                onClick={() => setAdjustModalOpen(false)}
                className="text-neutral-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleAdjustSubmit} className="space-y-4 text-xs">
              <div>
                <label className="block text-neutral-300 font-medium mb-1">
                  Chọn mặt hàng *
                </label>
                <select
                  required
                  value={adjustForm.foodItemId}
                  onChange={(e) => setAdjustForm({ ...adjustForm, foodItemId: e.target.value })}
                  className="w-full bg-neutral-900 border border-white/[0.12] rounded-lg p-2.5 text-white outline-none focus:border-amber-400"
                >
                  <option value="">-- Chọn món --</option>
                  {inventory.map((item) => (
                    <option key={item.foodItemId || item.id} value={item.foodItemId || item.id}>
                      {item.foodItemName || item.name} (Hiện có: {item.quantity || 0})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-neutral-300 font-medium mb-1">
                  Loại thao tác điều chỉnh *
                </label>
                <select
                  value={adjustForm.type}
                  onChange={(e) => setAdjustForm({ ...adjustForm, type: e.target.value })}
                  className="w-full bg-neutral-900 border border-white/[0.12] rounded-lg p-2.5 text-white outline-none focus:border-amber-400"
                >
                  <option value="IMPORT">IMPORT (Nhập hàng mới)</option>
                  <option value="ADJUSTMENT">ADJUSTMENT (Điều chỉnh kiểm kê)</option>
                  <option value="DAMAGED">DAMAGED (Hàng hỏng / rơi vỡ)</option>
                  <option value="WASTE">WASTE (Hết hạn sử dụng / Hủy bỏ)</option>
                </select>
              </div>

              <div>
                <label className="block text-neutral-300 font-medium mb-1">
                  Số lượng thay đổi (+ để tăng, - để giảm) *
                </label>
                <input
                  required
                  type="number"
                  placeholder="Ví dụ: 50 hoặc -5"
                  value={adjustForm.quantityDelta}
                  onChange={(e) => setAdjustForm({ ...adjustForm, quantityDelta: e.target.value })}
                  className="w-full bg-neutral-900 border border-white/[0.12] rounded-lg p-2.5 text-white outline-none focus:border-amber-400 font-mono"
                />
              </div>

              <div>
                <label className="block text-neutral-300 font-medium mb-1">
                  Lý do điều chỉnh (Bắt buộc ghi rõ cho Audit) *
                </label>
                <input
                  required
                  maxLength={500}
                  placeholder="Ví dụ: Nhập 10 thùng bắp từ tổng kho; hoặc phát hiện 3 chai nước rách nhãn..."
                  value={adjustForm.reason}
                  onChange={(e) => setAdjustForm({ ...adjustForm, reason: e.target.value })}
                  className="w-full bg-neutral-900 border border-white/[0.12] rounded-lg p-2.5 text-white outline-none focus:border-amber-400 placeholder-neutral-500"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-white/[0.08]">
                <button
                  type="button"
                  onClick={() => setAdjustModalOpen(false)}
                  className="px-4 py-2 text-neutral-400 hover:text-white transition-colors"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-black font-semibold rounded-lg transition-colors disabled:opacity-50"
                >
                  {saving ? 'Đang lưu...' : 'Xác nhận điều chỉnh'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
