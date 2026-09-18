import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getStoredAuth, request } from '../../../services/authService';

const initial = { email: '', password: '', fullName: '', phone: '', cinemaIds: [] };

export default function AdminManagersPage() {
  const [managers, setManagers] = useState([]);
  const [cinemas, setCinemas] = useState([]);
  const [form, setForm] = useState(initial);
  const [assignments, setAssignments] = useState({});
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const token = () => getStoredAuth().accessToken;
  const load = async () => {
    const [users, available] = await Promise.all([
      request('/api/v1/admin/users?role=MANAGER', { token: token() }),
      request('/api/v1/admin/users/managers/cinemas', { token: token() })
    ]);
    const list = Array.isArray(users) ? users : [];
    setManagers(list);
    setCinemas(Array.isArray(available) ? available : []);
    const pairs = await Promise.all(list.map(async (manager) => [manager.id,
      await request(`/api/v1/admin/users/managers/${manager.id}/cinemas`, { token: token() })]));
    setAssignments(Object.fromEntries(pairs));
  };
  useEffect(() => { load().catch((cause) => setError(cause.message)); }, []);
  const toggle = (ids, id) => ids.includes(id) ? ids.filter((value) => value !== id) : [...ids, id];
  const create = async (event) => {
    event.preventDefault(); setBusy(true); setError('');
    try { await request('/api/v1/admin/users/managers', { method: 'POST', token: token(), body: form }); setForm(initial); setNotice('Đã tạo Manager.'); await load(); }
    catch (cause) { setError(cause.message); } finally { setBusy(false); }
  };
  const saveAssignment = async (managerId) => {
    setBusy(true); setError('');
    try { await request(`/api/v1/admin/users/managers/${managerId}/cinemas`, { method: 'PATCH', token: token(), body: { cinemaIds: assignments[managerId] || [] } }); setNotice('Đã lưu phân công rạp.'); await load(); }
    catch (cause) { setError(cause.message); } finally { setBusy(false); }
  };
  const deactivate = async (managerId) => {
    setBusy(true); setError('');
    try { await request(`/api/v1/admin/users/${managerId}/status`, { method: 'PATCH', token: token(), body: { status: 'DISABLED' } }); setNotice('Đã vô hiệu hóa Manager.'); await load(); }
    catch (cause) { setError(cause.message); } finally { setBusy(false); }
  };
  return <main className="h-full overflow-auto bg-zinc-950 p-6 text-white">
    <Link to="/admin/users" className="text-sm text-amber-300">← Quản lý người dùng</Link>
    <h1 className="my-5 text-2xl font-bold">Quản lý Manager</h1>
    {error && <p role="alert" className="my-2 text-rose-300">{error}</p>}{notice && <p className="my-2 text-emerald-300">{notice}</p>}
    <form onSubmit={create} className="grid max-w-3xl gap-3 border border-white/10 p-4 md:grid-cols-2">
      <h2 className="md:col-span-2">Tạo tài khoản Manager</h2>
      {[['fullName', 'Họ tên'], ['email', 'Email'], ['phone', 'Số điện thoại'], ['password', 'Mật khẩu']].map(([key, label]) => <label key={key} className="text-sm">{label}<input required={key !== 'phone'} type={key === 'password' ? 'password' : key === 'email' ? 'email' : 'text'} className="mt-1 w-full border border-white/20 bg-zinc-900 p-2" value={form[key]} onChange={(event) => setForm({ ...form, [key]: event.target.value })} /></label>)}
      <fieldset className="md:col-span-2"><legend>Rạp được quản lý *</legend>{cinemas.map((cinema) => <label key={cinema.id} className="mr-4 inline-flex gap-1"><input type="checkbox" checked={form.cinemaIds.includes(cinema.id)} onChange={() => setForm({ ...form, cinemaIds: toggle(form.cinemaIds, cinema.id) })} />{cinema.name}</label>)}</fieldset>
      <button disabled={busy || !form.cinemaIds.length} className="bg-amber-400 p-2 font-bold text-black disabled:opacity-50">Tạo Manager</button>
    </form>
    <section className="mt-6 max-w-3xl space-y-4"><h2 className="font-bold">Manager hiện có</h2>{managers.map((manager) => <article key={manager.id} className="border border-white/10 p-4"><p className="font-semibold">{manager.fullName} · {manager.email} · {manager.status}</p><div className="my-3">{cinemas.map((cinema) => <label key={cinema.id} className="mr-4 inline-flex gap-1 text-sm"><input type="checkbox" checked={(assignments[manager.id] || []).includes(cinema.id)} onChange={() => setAssignments((current) => ({ ...current, [manager.id]: toggle(current[manager.id] || [], cinema.id) }))} />{cinema.name}</label>)}</div><div className="flex gap-2"><button disabled={busy || !(assignments[manager.id] || []).length} onClick={() => saveAssignment(manager.id)} className="border border-amber-400 px-3 py-1 text-amber-300">Lưu phân công</button>{manager.status !== 'DISABLED' && <button disabled={busy} onClick={() => deactivate(manager.id)} className="border border-rose-400 px-3 py-1 text-rose-300">Vô hiệu hóa</button>}</div></article>)}</section>
  </main>;
}
