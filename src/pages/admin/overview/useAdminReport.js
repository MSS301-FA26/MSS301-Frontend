import { useEffect, useRef, useState } from 'react';
import { adminService } from '../../../services/adminService';
import { presetRange, validateRange } from './reportUtils';

export default function useAdminReport(ctx, method = 'getAdminAnalytics') {
  const tokenRef = useRef(ctx.getAdminToken);
  tokenRef.current = ctx.getAdminToken;
  const managerCinema = ctx.isEffectiveManager || (ctx.isManager && !ctx.isAdmin)
    ? ctx.assignedCinema?.id ?? ctx.currentUser?.cinemaId : null;
  const initial = () => ({ ...presetRange('month'), cinemaId: managerCinema ? String(managerCinema) : '' });
  const [draft, setDraft] = useState(initial);
  const [applied, setApplied] = useState(initial);
  const [cinemas, setCinemas] = useState([]);
  const [cinemaError, setCinemaError] = useState('');
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [validation, setValidation] = useState('');
  const [loading, setLoading] = useState(true);
  const [updatedAt, setUpdatedAt] = useState(null);
  const [revision, setRevision] = useState(0);

  useEffect(() => {
    let cancelled = false;
    const token = tokenRef.current?.(false);
    if (!token) return;
    setCinemaError('');
    adminService.getAdminCinemas(token).then(result => {
      if (!cancelled) setCinemas(Array.isArray(result) ? result : result?.items ?? result?.content ?? []);
    }).catch(() => { if (!cancelled) setCinemaError('Không tải được danh sách rạp. Bấm Làm mới để thử lại.'); });
    return () => { cancelled = true; };
  }, [revision]);

  useEffect(() => {
    let cancelled = false;
    const token = tokenRef.current?.(false);
    setLoading(true); setError(''); setData(null);
    if (!token) {
      setError('Phiên quản trị đã hết hạn. Vui lòng đăng nhập lại.'); setLoading(false);
      return;
    }
    adminService[method](token, { ...applied, ...(managerCinema ? { cinemaId: managerCinema } : {}) }).then(result => {
      if (cancelled) return;
      if (!result || !Array.isArray(result.daily)) throw new Error('Dữ liệu báo cáo từ máy chủ không hợp lệ.');
      setData(result); setUpdatedAt(new Date());
    }).catch(err => {
      if (!cancelled) setError(err?.message || 'Không thể tải báo cáo. Vui lòng thử lại.');
    }).finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [applied, revision, method, managerCinema]);

  const apply = (next = draft) => {
    const message = validateRange(next);
    setValidation(message);
    if (message) return;
    setDraft(next); setApplied({ ...next });
  };
  return { draft, setDraft, applied, cinemas, cinemaError, managerCinema, data, error, validation, loading, updatedAt,
    dirty: Object.keys(draft).some(key => draft[key] !== applied[key]), apply,
    refresh: () => setRevision(value => value + 1) };
}
