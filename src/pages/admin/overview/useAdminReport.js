import { useEffect, useRef, useState } from 'react';
import { adminService } from '../../../services/adminService';
import { presetRange, validateRange } from './reportUtils';

export default function useAdminReport(ctx, method = 'getAdminAnalytics') {
  const tokenRef = useRef(ctx.getAdminToken);
  tokenRef.current = ctx.getAdminToken;

  const isManagerRole = Boolean(ctx.isEffectiveManager || (ctx.isManager && !ctx.isAdmin));
  const managerCinema = isManagerRole
    ? (ctx.assignedCinema?.id ?? ctx.currentUser?.cinemaId ?? ctx.selectedCinemaId ?? null)
    : null;

  const initial = () => ({
    ...presetRange('month'),
    cinemaId: managerCinema ? String(managerCinema) : ''
  });

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

  // Sync draft and applied when managerCinema is resolved asynchronously
  useEffect(() => {
    if (managerCinema) {
      const cid = String(managerCinema);
      setDraft(prev => (prev.cinemaId === cid ? prev : { ...prev, cinemaId: cid }));
      setApplied(prev => (prev.cinemaId === cid ? prev : { ...prev, cinemaId: cid }));
    }
  }, [managerCinema]);

  // Load all cinemas for admin dropdown / manager reference
  useEffect(() => {
    let cancelled = false;
    const token = tokenRef.current?.(false);
    if (!token) return;
    setCinemaError('');
    adminService.getAdminCinemas(token).then(result => {
      if (!cancelled) setCinemas(Array.isArray(result) ? result : result?.items ?? result?.content ?? []);
    }).catch(() => {
      if (!cancelled) setCinemaError('Không tải được danh sách rạp. Bấm Làm mới để thử lại.');
    });
    return () => { cancelled = true; };
  }, [revision]);

  // Fetch report data
  useEffect(() => {
    let cancelled = false;
    const token = tokenRef.current?.(false);
    setLoading(true);
    setError('');
    setData(null);

    if (!token) {
      setError('Phiên quản trị đã hết hạn. Vui lòng đăng nhập lại.');
      setLoading(false);
      return;
    }

    const queryParams = {
      ...applied,
      ...(managerCinema ? { cinemaId: managerCinema } : {})
    };

    adminService[method](token, queryParams).then(result => {
      if (cancelled) return;
      if (!result || !Array.isArray(result.daily)) {
        throw new Error('Dữ liệu báo cáo từ máy chủ không hợp lệ.');
      }
      setData(result);
      setUpdatedAt(new Date());
    }).catch(err => {
      if (!cancelled) setError(err?.message || 'Không thể tải báo cáo. Vui lòng thử lại.');
    }).finally(() => {
      if (!cancelled) setLoading(false);
    });

    return () => { cancelled = true; };
  }, [applied, revision, method, managerCinema]);

  const apply = (next = draft) => {
    const nextWithCinema = managerCinema ? { ...next, cinemaId: String(managerCinema) } : next;
    const message = validateRange(nextWithCinema);
    setValidation(message);
    if (message) return;
    setDraft(nextWithCinema);
    setApplied({ ...nextWithCinema });
  };

  const setCinemaFilter = (cinemaId) => {
    if (isManagerRole) return; // Manager is permanently locked
    const next = { ...draft, cinemaId: cinemaId ? String(cinemaId) : '' };
    apply(next);
  };

  return {
    draft,
    setDraft,
    applied,
    cinemas,
    cinemaError,
    managerCinema,
    isManagerRole,
    data,
    error,
    validation,
    loading,
    updatedAt,
    dirty: Object.keys(draft).some(key => draft[key] !== applied[key]),
    apply,
    setCinemaFilter,
    refresh: () => setRevision(value => value + 1)
  };
}
