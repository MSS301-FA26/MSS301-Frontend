import React from 'react';
import { motion } from 'motion/react';
import { X, History, TrendingUp, TrendingDown, DollarSign } from 'lucide-react';
import { adminService } from '../../../../services/adminService';

const formatVnd = (value) => `${Number(value || 0).toLocaleString('vi-VN')}đ`;

export default function FoodPriceHistoryModal({
  isOpen,
  onClose,
  food,
  kind = 'item',
  token
}) {
  const [history, setHistory] = React.useState([]);
  const [isLoading, setIsLoading] = React.useState(false);

  React.useEffect(() => {
    if (isOpen && food && token) {
      loadHistory();
    }
    if (!isOpen) return;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, food, kind, token]);

  const loadHistory = async () => {
    setIsLoading(true);
    try {
      const data = await adminService.getAdminFoodPriceHistory(token, food.id, kind);
      setHistory(Array.isArray(data) ? data : []);
    } catch {
      setHistory([]);
    } finally {
      setIsLoading(false);
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
              <History className="h-5 w-5" />
            </div>
            <div>
              <span className="text-[9px] font-mono uppercase tracking-[0.2em] text-neutral-400 font-black">
                LỊCH SỬ ĐỔI GIÁ · {food.sku || `ID #${food.id}`}
              </span>
              <h3 className="text-sm font-black uppercase tracking-[0.16em] text-white mt-0.5 truncate max-w-sm">
                {food.name}
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

        {/* Current Price Display */}
        <div className="flex items-center justify-between border border-white/10 bg-white/[0.02] p-3.5">
          <div>
            <span className="text-[9px] uppercase tracking-wider text-neutral-400 block">Giá bán hiện tại</span>
            <span className="font-mono text-2xl font-black text-amber-300">{formatVnd(food.price)}</span>
          </div>
          {food.costPrice > 0 && (
            <div className="text-right">
              <span className="text-[9px] uppercase tracking-wider text-neutral-400 block">Giá vốn định mức</span>
              <span className="font-mono text-sm font-bold text-neutral-400">{formatVnd(food.costPrice)}</span>
            </div>
          )}
        </div>

        {/* Timeline Table */}
        <div className="space-y-3">
          <h4 className="text-[10px] font-black uppercase tracking-wider text-neutral-300">
            Chi tiết các lần điều chỉnh giá
          </h4>

          {isLoading ? (
            <p className="text-center py-6 text-neutral-400 font-mono text-xs">Đang tải lịch sử giá...</p>
          ) : history.length > 0 ? (
            <div className="max-h-64 overflow-y-auto border border-white/10 divide-y divide-white/[0.05]">
              {history.map((h) => {
                const diff = Number(h.difference || (h.newPrice - h.oldPrice));
                const isIncrease = diff > 0;
                return (
                  <div key={h.id} className="p-3 flex items-center justify-between hover:bg-white/[0.02] transition">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs text-neutral-400 line-through">{formatVnd(h.oldPrice)}</span>
                        <span className="text-neutral-500">→</span>
                        <span className="font-mono text-xs font-bold text-white">{formatVnd(h.newPrice)}</span>
                        <span className={`inline-flex items-center gap-0.5 text-[10px] font-mono font-bold px-1.5 py-0.5 ${
                          isIncrease ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/10 text-rose-400'
                        }`}>
                          {isIncrease ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                          {isIncrease ? '+' : ''}{formatVnd(diff)}
                        </span>
                      </div>
                      <p className="text-[9px] text-neutral-500 mt-1">Người sửa: {h.changedBy || 'ADMIN'}</p>
                    </div>
                    <div className="text-right text-[9px] font-mono text-neutral-400">
                      {new Date(h.changedAt).toLocaleDateString('vi-VN')}
                      <div className="text-neutral-600">{new Date(h.changedAt).toLocaleTimeString('vi-VN')}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-8 border border-dashed border-white/10">
              <DollarSign className="h-8 w-8 text-neutral-600 mx-auto mb-2" />
              <p className="text-xs text-neutral-400">Chưa ghi nhận lần đổi giá nào.</p>
              <p className="text-[10px] text-neutral-600 mt-0.5">Món ăn này vẫn giữ mức giá ban đầu kể từ khi tạo.</p>
            </div>
          )}
        </div>

        <div className="pt-2 border-t border-white/10 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2.5 border border-white/20 text-neutral-300 hover:text-white text-xs font-black uppercase tracking-widest transition"
          >
            Đóng
          </button>
        </div>
      </motion.div>
    </div>
  );
}
