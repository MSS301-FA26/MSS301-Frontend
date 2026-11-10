import React from 'react';
import { Plus, Trash2, Minus, Sparkles, Layers, AlertCircle, ShoppingBag } from 'lucide-react';

const formatVnd = (value) => `${Number(value || 0).toLocaleString('vi-VN')}đ`;

export default function FoodComboBuilder({
  availableItems = [],
  comboItems = [],
  onChangeComboItems,
  comboPrice = 0
}) {
  const [selectedItemId, setSelectedItemId] = React.useState('');

  const handleAddItem = () => {
    if (!selectedItemId) return;
    const itemId = Number(selectedItemId);
    const existingIndex = comboItems.findIndex((i) => i.foodItemId === itemId);

    if (existingIndex >= 0) {
      const updated = [...comboItems];
      updated[existingIndex].quantity += 1;
      onChangeComboItems(updated);
    } else {
      const targetItem = availableItems.find((i) => i.id === itemId);
      if (!targetItem) return;
      onChangeComboItems([
        ...comboItems,
        {
          foodItemId: targetItem.id,
          name: targetItem.name,
          sku: targetItem.sku,
          unitPrice: targetItem.price,
          totalStock: targetItem.totalStock ?? 0,
          quantity: 1
        }
      ]);
    }
    setSelectedItemId('');
  };

  const handleUpdateQuantity = (index, delta) => {
    const updated = [...comboItems];
    const newQty = updated[index].quantity + delta;
    if (newQty <= 0) {
      handleRemoveItem(index);
    } else {
      updated[index].quantity = newQty;
      onChangeComboItems(updated);
    }
  };

  const handleRemoveItem = (index) => {
    const updated = comboItems.filter((_, i) => i !== index);
    onChangeComboItems(updated);
  };

  // Calculations
  const regularTotal = comboItems.reduce((acc, item) => {
    const itemInfo = availableItems.find((a) => a.id === item.foodItemId);
    const price = itemInfo ? itemInfo.price : (item.unitPrice || 0);
    return acc + (Number(price) * item.quantity);
  }, 0);

  const priceNum = Number(comboPrice) || 0;
  const savings = regularTotal > priceNum ? regularTotal - priceNum : 0;
  const savingsPercent = regularTotal > 0 ? Math.round((savings / regularTotal) * 100) : 0;

  // Max combos calculate
  const maxPossibleCombos = comboItems.length === 0 ? 0 : comboItems.reduce((min, ci) => {
    const itemInfo = availableItems.find((a) => a.id === ci.foodItemId);
    const stock = itemInfo ? (itemInfo.totalStock ?? 0) : 0;
    const possible = Math.floor(stock / Math.max(ci.quantity, 1));
    return Math.min(min, possible);
  }, 9999);

  return (
    <div className="space-y-4 border border-amber-500/20 bg-[#070707] p-4">
      <div className="flex items-center justify-between border-b border-white/10 pb-3">
        <div className="flex items-center gap-2">
          <Layers className="h-4 w-4 text-amber-400" />
          <span className="text-xs font-black uppercase tracking-wider text-white">
            Combo Builder (Thành phần combo) <span className="text-rose-400">*</span>
          </span>
        </div>
        <span className="text-[10px] font-mono text-neutral-400">
          {comboItems.length} món thành phần
        </span>
      </div>

      {/* Selector to add item */}
      <div className="flex gap-2">
        <select
          value={selectedItemId}
          onChange={(e) => setSelectedItemId(e.target.value)}
          className="flex-1 bg-black border border-white/10 p-2.5 text-xs text-white focus:outline-none focus:border-amber-400 font-medium"
        >
          <option value="">-- Chọn món lẻ thêm vào combo --</option>
          {availableItems
            .filter((item) => item.status !== 'ARCHIVED' && !item.deletedAt)
            .map((item) => (
              <option key={item.id} value={item.id}>
                {item.name} ({item.sku || `ID ${item.id}`}) — {formatVnd(item.price)} (Tồn: {item.totalStock ?? 0})
              </option>
            ))}
        </select>
        <button
          type="button"
          onClick={handleAddItem}
          disabled={!selectedItemId}
          className="px-4 py-2.5 bg-amber-500 hover:bg-amber-400 text-black text-xs font-black uppercase tracking-wider transition disabled:opacity-40 flex items-center gap-1.5 shrink-0"
        >
          <Plus className="h-3.5 w-3.5" />
          Thêm
        </button>
      </div>

      {/* Selected Items List */}
      {comboItems.length > 0 ? (
        <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
          {comboItems.map((item, idx) => {
            const itemInfo = availableItems.find((a) => a.id === item.foodItemId);
            const price = itemInfo ? itemInfo.price : (item.unitPrice || 0);
            const stock = itemInfo ? (itemInfo.totalStock ?? 0) : 0;
            const subtotal = Number(price) * item.quantity;

            return (
              <div
                key={item.foodItemId}
                className="flex items-center justify-between p-2.5 border border-white/10 bg-black/60 gap-3"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-black text-white truncate">{itemInfo?.name || item.name}</span>
                    <span className="text-[9px] font-mono font-bold px-1.5 py-0.5 bg-white/5 border border-white/10 text-amber-300">
                      {itemInfo?.sku || item.sku}
                    </span>
                  </div>
                  <div className="text-[10px] text-neutral-400 mt-0.5 flex items-center gap-3">
                    <span>Đơn giá: {formatVnd(price)}</span>
                    <span className="text-neutral-500">·</span>
                    <span>Tồn kho món: <b className="text-neutral-300 font-mono">{stock}</b></span>
                  </div>
                </div>

                <div className="flex items-center gap-3 shrink-0">
                  <div className="flex items-center border border-white/10 bg-neutral-900">
                    <button
                      type="button"
                      onClick={() => handleUpdateQuantity(idx, -1)}
                      className="p-1.5 text-neutral-400 hover:text-white transition"
                    >
                      <Minus className="h-3 w-3" />
                    </button>
                    <span className="px-2.5 text-xs font-mono font-black text-white">{item.quantity}</span>
                    <button
                      type="button"
                      onClick={() => handleUpdateQuantity(idx, 1)}
                      className="p-1.5 text-neutral-400 hover:text-white transition"
                    >
                      <Plus className="h-3 w-3" />
                    </button>
                  </div>

                  <span className="font-mono text-xs font-bold text-white w-20 text-right">
                    {formatVnd(subtotal)}
                  </span>

                  <button
                    type="button"
                    onClick={() => handleRemoveItem(idx)}
                    className="p-1.5 text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 border border-transparent hover:border-rose-500/30 transition"
                    title="Xóa món khỏi combo"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="p-4 border border-dashed border-white/10 text-center text-[11px] text-neutral-500">
          Combo chưa có thành phần nào. Vui lòng chọn món lẻ bên trên để thêm vào công thức combo.
        </div>
      )}

      {/* Real-time Pricing & Savings summary bar */}
      <div className="border border-white/10 bg-white/[0.02] p-3 space-y-2">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center divide-x divide-white/10">
          <div>
            <span className="text-[9px] uppercase tracking-wider text-neutral-400 block">Tổng giá bán lẻ</span>
            <span className="font-mono text-sm font-bold text-neutral-300">{formatVnd(regularTotal)}</span>
          </div>
          <div>
            <span className="text-[9px] uppercase tracking-wider text-neutral-400 block">Giá combo</span>
            <span className="font-mono text-sm font-black text-amber-300">{formatVnd(priceNum)}</span>
          </div>
          <div>
            <span className="text-[9px] uppercase tracking-wider text-neutral-400 block">Khách tiết kiệm</span>
            <span className={`font-mono text-sm font-black ${savings > 0 ? 'text-emerald-400' : 'text-neutral-500'}`}>
              {formatVnd(savings)} {savings > 0 ? `(-${savingsPercent}%)` : ''}
            </span>
          </div>
          <div>
            <span className="text-[9px] uppercase tracking-wider text-neutral-400 block">Tồn combo tối đa</span>
            <span className={`font-mono text-sm font-black ${maxPossibleCombos <= 0 ? 'text-rose-400' : maxPossibleCombos <= 5 ? 'text-amber-400' : 'text-emerald-400'}`}>
              {maxPossibleCombos === 9999 ? 0 : maxPossibleCombos} combo
            </span>
          </div>
        </div>

        {maxPossibleCombos === 0 && comboItems.length > 0 && (
          <div className="flex items-center gap-1.5 text-[10px] text-rose-400 font-bold bg-rose-500/10 p-2 border border-rose-500/20">
            <AlertCircle className="h-3.5 w-3.5 shrink-0" />
            Có ít nhất 1 món thành phần hết hàng! Combo sẽ hiển thị là HẾT HÀNG (OUT OF STOCK).
          </div>
        )}
      </div>
    </div>
  );
}
