import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getStoredAuth, request } from '../../services/authService';

export default function ManagerDashboard() {
  const [cinemas, setCinemas] = useState([]);
  const [cinemaId, setCinemaId] = useState('');
  const [showtimes, setShowtimes] = useState([]);
  const [inventory, setInventory] = useState([]);
  const [movements, setMovements] = useState([]);
  const [adjustment, setAdjustment] = useState({ foodItemId: '', type: 'ADJUSTMENT', quantityDelta: '', reason: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    const { accessToken } = getStoredAuth();
    request('/api/v1/manager/cinemas', { token: accessToken })
      .then((items) => {
        if (!active) return;
        setCinemas(Array.isArray(items) ? items : []);
        setCinemaId((current) => current || String(items?.[0]?.id || ''));
      })
      .catch((cause) => { if (active) setError(cause.message || 'Không tải được rạp được phân công.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!cinemaId) return undefined;
    let active = true;
    const { accessToken } = getStoredAuth();
    Promise.all([
      request(`/api/v1/manager/cinemas/${encodeURIComponent(cinemaId)}/showtimes?size=20`, { token: accessToken }),
      request(`/api/v1/manager/cinemas/${encodeURIComponent(cinemaId)}/inventory`, { token: accessToken }),
      request(`/api/v1/manager/cinemas/${encodeURIComponent(cinemaId)}/inventory/transactions?size=10`, { token: accessToken })
    ]).then(([schedule, stock, history]) => {
      if (!active) return;
      setShowtimes(schedule?.items || []);
      setInventory(Array.isArray(stock) ? stock : []);
      setMovements(history?.items || []);
      setError('');
    }).catch((cause) => { if (active) setError(cause.message || 'Không tải được dữ liệu vận hành.'); });
    return () => { active = false; };
  }, [cinemaId]);

  const adjustStock = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError('');
    try {
      const { accessToken } = getStoredAuth();
      await request(`/api/v1/manager/cinemas/${encodeURIComponent(cinemaId)}/inventory/adjust`, {
        method: 'POST', token: accessToken,
        body: { cinemaId: Number(cinemaId), foodItemId: Number(adjustment.foodItemId), type: adjustment.type,
          quantityDelta: Number(adjustment.quantityDelta), reason: adjustment.reason.trim() }
      });
      const [stock, history] = await Promise.all([
        request(`/api/v1/manager/cinemas/${encodeURIComponent(cinemaId)}/inventory`, { token: accessToken }),
        request(`/api/v1/manager/cinemas/${encodeURIComponent(cinemaId)}/inventory/transactions?size=10`, { token: accessToken })
      ]);
      setInventory(stock || []);
      setMovements(history?.items || []);
      setAdjustment({ foodItemId: '', type: 'ADJUSTMENT', quantityDelta: '', reason: '' });
    } catch (cause) { setError(cause.message || 'Không điều chỉnh được tồn kho.'); }
    finally { setSaving(false); }
  };

  return (
    <main className="mx-auto max-w-5xl space-y-6 px-4 py-8 text-white">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div><p className="text-xs uppercase tracking-widest text-amber-400">Quản lý vận hành</p><h1 className="mt-1 text-2xl font-bold">Rạp được phân công</h1></div>
        <Link to="/manager/movies" className="border border-amber-400 px-4 py-2 text-sm text-amber-300">Thư viện phim</Link>
      </div>
      {loading && <p>Đang tải...</p>}
      {error && <p role="alert" className="text-rose-300">{error}</p>}
      {!loading && !cinemas.length && !error && <p>Chưa có rạp được phân công. Hãy liên hệ Admin.</p>}
      {cinemas.length > 0 && <label className="block max-w-sm text-sm">Chọn rạp
        <select className="mt-2 w-full border border-white/20 bg-zinc-900 p-2" value={cinemaId} onChange={(event) => setCinemaId(event.target.value)}>
          {cinemas.map((cinema) => <option key={cinema.id} value={cinema.id}>{cinema.name}</option>)}
        </select>
      </label>}
      {cinemaId && <div className="grid gap-6 md:grid-cols-2">
        <section className="border border-white/10 bg-zinc-950 p-4"><h2 className="font-semibold">Suất chiếu</h2>
          <ul className="mt-3 space-y-2 text-sm">{showtimes.map((showtime) => <li key={showtime.id} className="border-t border-white/10 py-2">{showtime.movieTitle || `Phim #${showtime.movieId}`} · {showtime.startTime} · {showtime.status}</li>)}</ul>
          {!showtimes.length && <p className="mt-3 text-sm text-zinc-400">Chưa có suất chiếu trong danh sách.</p>}
        </section>
        <section className="border border-white/10 bg-zinc-950 p-4"><h2 className="font-semibold">Tồn kho bắp nước</h2>
          <ul className="mt-3 space-y-2 text-sm">{inventory.map((item) => <li key={item.id || item.foodItemId} className="border-t border-white/10 py-2">{item.foodItemName || `Món #${item.foodItemId}`} · {item.quantity} còn trong kho</li>)}</ul>
          {!inventory.length && <p className="mt-3 text-sm text-zinc-400">Chưa có dữ liệu tồn kho.</p>}
          {inventory.length > 0 && <form onSubmit={adjustStock} className="mt-4 space-y-2 border-t border-white/10 pt-3 text-sm">
            <h3 className="font-semibold">Điều chỉnh tồn kho</h3>
            <select required className="w-full bg-zinc-900 p-2" value={adjustment.foodItemId} onChange={(event) => setAdjustment({ ...adjustment, foodItemId: event.target.value })}>
              <option value="">Chọn món</option>{inventory.map((item) => <option key={item.foodItemId} value={item.foodItemId}>{item.foodItemName}</option>)}
            </select>
            <select className="w-full bg-zinc-900 p-2" value={adjustment.type} onChange={(event) => setAdjustment({ ...adjustment, type: event.target.value })}>
              {['IMPORT', 'ADJUSTMENT', 'DAMAGED', 'WASTE'].map((type) => <option key={type} value={type}>{type}</option>)}
            </select>
            <input required type="number" className="w-full bg-zinc-900 p-2" placeholder="Thay đổi số lượng, có thể âm" value={adjustment.quantityDelta} onChange={(event) => setAdjustment({ ...adjustment, quantityDelta: event.target.value })} />
            <input required maxLength={500} className="w-full bg-zinc-900 p-2" placeholder="Lý do điều chỉnh" value={adjustment.reason} onChange={(event) => setAdjustment({ ...adjustment, reason: event.target.value })} />
            <button disabled={saving} className="bg-amber-400 px-4 py-2 font-semibold text-black disabled:opacity-50">Lưu điều chỉnh</button>
          </form>}
        </section>
      </div>}
      {cinemaId && <section className="border border-white/10 bg-zinc-950 p-4"><h2 className="font-semibold">Lịch sử tồn kho</h2><ul className="mt-2 space-y-1 text-sm">{movements.map((entry) => <li key={entry.id}>{entry.foodItemName} · {entry.type} · {entry.beforeQuantity} → {entry.afterQuantity} · {entry.reason}</li>)}</ul></section>}
    </main>
  );
}
