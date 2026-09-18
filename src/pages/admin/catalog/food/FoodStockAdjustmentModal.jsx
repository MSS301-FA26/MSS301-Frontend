import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Check, Package, AlertTriangle, History, RefreshCw, ArrowUpRight, ArrowDownRight } from 'lucide-react';
import { adminService } from '../../../../services/adminService';

const ADJUST_TYPES = [
  { value: 'IMPORT', label: 'Nhập kho thêm (+)', desc: 'Nhập hàng từ nhà cung cấp', isAdd: true },
  { value: 'ADJUSTMENT', label: 'Kiểm kê định kỳ (=)', desc: 'Cập nhật lại số lượng thực tế đếm được', isSet: true },
  { value: 'DAMAGED', label: 'Hỏng hóc / Đổ vỡ (-)', desc: 'Sản phẩm bị rách, hỏng, đổ', isSubtract: true },
  { value: 'EXPIRED', label: 'Hết hạn sử dụng (-)', desc: 'Hết date phải tiêu hủy', isSubtract: true },
  { value: 'WASTE', label: 'Hao hụt / Mất mát (-)', desc: 'Thất thoát nguyên phụ liệu', isSubtract: true },
];

export default function FoodStockAdjustmentModal({
  isOpen,
  onClose,
  food,
  token,
  cinemas = [],
  onAdjustSuccess,
  showToast
}) {
  const [selectedCinemaId, setSelectedCinemaId] = React.useState(1);
  const [type, setType] = React.useState('IMPORT');
  const [quantity, setQuantity] = React.useState(10);
  const [reason, setReason] = React.useState('');
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [transactions, setTransactions] = React.useState([]);
  const [isLoadingTx, setIsLoadingTx] = React.useState(false);

  React.useEffect(() => {
    if (isOpen && food) {
      setReason('');
      setQuantity(10);
      setType('IMPORT');
      loadTransactions();
    }
    if (!isOpen) return;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, food, selectedCinemaId]);

  const loadTransactions = async () => {
    if (!token || !food) return;
    setIsLoadingTx(true);
    try {
      const res = await adminService.getAdminFoodInventoryTransactions(token, {
        foodItemId: food.id,
        cinemaId: selectedCinemaId,
        size: 5
      });
      setTransactions(res?.items || []);
    } catch {
      setTransactions([]);
    } finally {
      setIsLoadingTx(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!reason.trim()) {
      showToast('Vui lòng nhập lý do điều chỉnh tồn kho.');
      return;
    }
    const qty = Number(quantity);
    if (isNaN(qty) || qty < 0) {
      showToast('Số lượng phải là số dương hợp lệ.');
      return;
    }

    setIsSubmitting(true);
    try {
      const isSet = type === 'ADJUSTMENT';
      const isSubtract = type === 'DAMAGED' || type === 'EXPIRED' || type === 'WASTE';
      const payload = {
        cinemaId: selectedCinemaId,
        foodItemId: food.id,
        type: type,
        reason: reason.trim(),
        ...(isSet ? { newQuantity: qty } : { quantityDelta: isSubtract ? -qty : qty })
      };

      await adminService.adjustAdminFoodInventory(token, payload);
      showToast('Điều chỉnh tồn kho thành công!');
      if (onAdjustSuccess) onAdjustSuccess();
      onClose();
    } catch (err) {
      showToast(err.message || 'Không thể điều chỉnh tồn kho.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen || !food) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm overflow-y-auto"
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 15 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 15 }}
        className="relative w-full max-w-lg border border-amber-500/30 bg-[#0c0c0c] shadow-2xl p-6 space-y-5 my-8"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/10 pb-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center border border-amber-500/30 bg-amber-500/10 text-amber-400">
              <Package className="h-5 w-5" />
            </div>
            <div>
              <span className="text-[9px] font-mono uppercase tracking-[0.2em] text-neutral-400 font-black">
                QUẢN LÝ KHO · {food.sku || `ID #${food.id}`}
              </span>
              <h3 className="text-sm font-black uppercase tracking-[0.16em] text-white mt-0.5 truncate max-w-sm">
                Điều chỉnh tồn: {food.name}
              </h3>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-neutral-400 hover:text-white border border-white/10 hover:border-white/30 transition"
            title="Đóng cửa sổ"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Current Stock Banner */}
        <div className="flex items-center justify-between border border-white/10 bg-white/[0.02] p-3.5">
          <div>
            <span className="text-[9px] uppercase tracking-wider text-neutral-400 block">Tồn khả dụng toàn hệ thống</span>
            <span className="font-mono text-xl font-black text-amber-300">{food.totalStock ?? 0}</span>
            <span className="text-[10px] text-neutral-500 ml-1.5">đơn vị</span>
          </div>
          <div className="text-right">
            <span className="text-[9px] uppercase tracking-wider text-neutral-400 block">Mức báo sắp hết</span>
            <span className="font-mono text-sm font-bold text-neutral-300">{food.lowStockThreshold || 10} đơn vị</span>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Cinema Selection */}
          {cinemas.length > 1 && (
            <div className="space-y-1.5">
              <label className="text-[10px] uppercase tracking-[0.18em] text-neutral-200 font-black">
                Chi nhánh rạp áp dụng
              </label>
              <select
                value={selectedCinemaId}
                onChange={(e) => setSelectedCinemaId(Number(e.target.value))}
                className="w-full bg-black border border-white/10 p-2.5 text-xs text-white focus:outline-none focus:border-amber-400 font-bold"
              >
                {cinemas.map((c) => (
                  <option key={c.id} value={c.id}>{c.name} ({c.city || 'Toàn quốc'})</option>
                ))}
              </select>
            </div>
          )}

          {/* Adjustment Type */}
          <div className="space-y-1.5">
            <label className="text-[10px] uppercase tracking-[0.18em] text-neutral-200 font-black">
              Loại biến động kho <span className="text-rose-400">*</span>
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {ADJUST_TYPES.map((t) => (
                <button
                  key={t.value}
                  type="button"
                  onClick={() => setType(t.value)}
                  className={`text-left p-2.5 border transition ${
                    type === t.value
                      ? 'border-amber-400 bg-amber-400/10 text-white'
                      : 'border-white/[0.08] bg-black text-neutral-400 hover:text-white hover:border-white/20'
                  }`}
                >
                  <div className="text-xs font-black uppercase tracking-wider">{t.label}</div>
                  <div className="text-[9px] text-neutral-500 mt-0.5">{t.desc}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Quantity */}
          <div className="space-y-1.5">
            <label className="text-[10px] uppercase tracking-[0.18em] text-neutral-200 font-black">
              {type === 'ADJUSTMENT' ? 'Số lượng thực tế sau kiểm kê (=)' : 'Số lượng thay đổi (+/-)'} <span className="text-rose-400">*</span>
            </label>
            <input
              type="number"
              min="0"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              placeholder="VD: 50"
              className="w-full bg-black border border-white/10 p-3 text-sm text-white font-mono font-bold focus:outline-none focus:border-amber-400"
              required
            />
          </div>

          {/* Reason (Mandatory) */}
          <div className="space-y-1.5">
            <label className="text-[10px] uppercase tracking-[0.18em] text-neutral-200 font-black flex items-center justify-between">
              <span>Lý do điều chỉnh <span className="text-rose-400">*</span></span>
              <span className="text-[9px] text-amber-400/80 lowercase">Bắt buộc theo chuẩn kiểm toán</span>
            </label>
            <input
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="VD: Nhập thêm đợt cuối tuần, Kiểm đếm kho ngày 18/9..."
              className="w-full bg-black border border-white/10 p-3 text-xs text-white focus:outline-none focus:border-amber-400 font-medium"
              required
            />
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-white/10">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 border border-white/20 text-neutral-300 hover:text-white text-xs font-black uppercase tracking-widest transition"
            >
              Đóng
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2.5 bg-amber-500 hover:bg-amber-400 text-black font-black text-xs uppercase tracking-widest transition disabled:opacity-60 flex items-center gap-2"
            >
              {isSubmitting ? (
                <>
                  <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                  Đang ghi nhận...
                </>
              ) : (
                <>
                  <Check className="h-4 w-4" />
                  Xác nhận điều chỉnh
                </>
              )}
            </button>
          </div>
        </form>

        {/* Recent Transactions Trail */}
        <div className="border-t border-white/10 pt-4 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[9px] font-mono text-neutral-400 uppercase tracking-widest flex items-center gap-1.5">
              <History className="h-3 w-3 text-amber-400" />
              Lịch sử biến động gần đây
            </span>
            <button
              type="button"
              onClick={loadTransactions}
              className="text-[9px] text-neutral-400 hover:text-white uppercase tracking-wider transition"
            >
              Làm mới
            </button>
          </div>

          {isLoadingTx ? (
            <p className="text-[10px] text-neutral-500 py-2 text-center">Đang tải lịch sử...</p>
          ) : transactions.length > 0 ? (
            <div className="divide-y divide-white/[0.04] text-[10px]">
              {transactions.map((tx) => (
                <div key={tx.id} className="py-2 flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className={`font-mono font-bold ${
                        tx.type === 'IMPORT' ? 'text-emerald-400' : tx.type === 'SALE' ? 'text-cyan-400' : 'text-rose-400'
                      }`}>
                        {tx.type === 'IMPORT' ? '+' : '-'}{tx.quantity} ({tx.type})
                      </span>
                      <span className="text-neutral-500 font-mono">({tx.beforeQuantity} → {tx.afterQuantity})</span>
                    </div>
                    <p className="text-neutral-400 truncate text-[9px] mt-0.5">{tx.reason}</p>
                  </div>
                  <div className="text-right shrink-0 text-[9px] text-neutral-500 font-mono">
                    {new Date(tx.createdAt).toLocaleDateString('vi-VN')} {new Date(tx.createdAt).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-[10px] text-neutral-500 py-2 text-center">Chưa có giao dịch biến động kho nào.</p>
          )}
        </div>
      </motion.div>
    </div>
  );
}
