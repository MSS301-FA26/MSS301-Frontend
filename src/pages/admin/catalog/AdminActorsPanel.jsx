import React, { useState } from 'react';
import { motion } from 'motion/react';
import { Check, ChevronLeft, ChevronRight, Edit3, ImageUp, Plus, Search, Trash2, UserRound } from 'lucide-react';
import { adminService } from '../../../services/adminService';

export default function AdminActorsPanel({ ctx }) {
  const {
    actorSearch, setActorSearch, actorForm, setActorForm, actorErrors, setActorErrors,
    editingActorId, isActorLoading, isActorSaving, actors, filteredActors,
    actorPagination, setActorPagination,
    resetActorForm, handleActorSubmit, handleEditActor, handleDeleteActor,
    getAdminToken, showToast
  } = ctx;
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const { page = 0, totalPages = 1, totalItems = actors.length } = actorPagination || {};

  const handleActorSearchChange = (event) => {
    setActorPagination((prev) => ({ ...prev, page: 0 }));
    setActorSearch(event.target.value);
  };

  const goToActorPage = (nextPage) => {
    const safePage = Math.max(0, Math.min(nextPage, Math.max(totalPages - 1, 0)));
    setActorPagination((prev) => ({ ...prev, page: safePage }));
  };

  const updateField = (field, value) => {
    setActorForm((prev) => ({ ...prev, [field]: value }));
    if (actorErrors[field]) setActorErrors((prev) => ({ ...prev, [field]: undefined }));
  };

  const handleAvatarUpload = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    const token = getAdminToken();
    if (!token) return;

    setIsUploadingAvatar(true);
    try {
      const uploaded = await adminService.uploadAdminImage(token, file, 'actors');
      updateField('avatarUrl', uploaded.url);
      showToast('Ðã t?i ?nh di?n viên lên Cloudinary.');
    } catch (error) {
      showToast(error.message || 'Không th? t?i ?nh lên Cloudinary.');
    } finally {
      setIsUploadingAvatar(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className="space-y-6"
    >
      <div className="border border-white/[0.05] bg-gradient-to-r from-[#090909] to-[#050505] p-5">
        <span className="text-[9px] font-mono tracking-[0.24em] text-neutral-300 uppercase font-black">ADMIN ACTOR</span>
        <h2 className="text-xs font-black uppercase tracking-[0.18em] text-neutral-200 mt-1">Qu?n lý di?n viên</h2>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[340px_minmax(0,1fr)] gap-5 items-start">
        <form onSubmit={handleActorSubmit} className="border border-white/[0.05] bg-[#070707] p-4 space-y-4">
          <div className="flex items-center justify-between border-b border-white/[0.03] pb-3">
            <h3 className="text-xs font-black uppercase tracking-[0.18em] text-white">{editingActorId ? 'C?p nh?t di?n viên' : 'Thêm di?n viên'}</h3>
            {editingActorId && <button type="button" onClick={resetActorForm} className="text-[10px] uppercase text-amber-300">H?y s?a</button>}
          </div>

          <label className="block space-y-1">
            <span className="text-[10px] uppercase tracking-[0.18em] font-black text-neutral-200">Tên di?n viên ({actorForm.name.length}/50)</span>
            <input value={actorForm.name} maxLength={50} onChange={(event) => updateField('name', event.target.value)} className="w-full bg-black border border-white/[0.06] p-2.5 text-sm text-white focus:outline-none focus:border-amber-400" />
            {actorErrors.name && <span className="text-[10px] text-rose-400">{actorErrors.name}</span>}
          </label>

          <label className="block space-y-1">
            <span className="text-[10px] uppercase tracking-[0.18em] font-black text-neutral-200">Ti?u s? ({actorForm.biography.length}/1000)</span>
            <textarea value={actorForm.biography} maxLength={1000} rows={6} onChange={(event) => updateField('biography', event.target.value)} className="w-full resize-none bg-black border border-white/[0.06] p-2.5 text-sm text-white focus:outline-none focus:border-amber-400" />
          </label>

          <div className="space-y-2">
            <span className="text-[10px] uppercase tracking-[0.18em] font-black text-neutral-200 block">?nh d?i di?n</span>
            {actorForm.avatarUrl && (
              <div className="space-y-1">
                <img src={actorForm.avatarUrl} alt="Actor preview" className="w-full h-48 object-cover border border-white/[0.06] bg-black" onError={(e) => { e.currentTarget.onerror = null; e.currentTarget.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(actorForm.name || "Actor")}&background=1a1a1a&color=f59e0b&size=256&bold=true`; }} />
                <p className="text-[9px] text-neutral-200 truncate" title={actorForm.avatarUrl}>{actorForm.avatarUrl}</p>
              </div>
            )}
            <label className={`w-full py-3 border border-amber-500/40 bg-amber-500/10 text-amber-300 font-black text-xs uppercase flex items-center justify-center gap-2 cursor-pointer ${isUploadingAvatar ? 'opacity-50 pointer-events-none' : ''}`}>
              <ImageUp className="h-4 w-4" />
              {isUploadingAvatar ? 'Ðang t?i ?nh...' : actorForm.avatarUrl ? 'Ch?n ?nh khác' : 'Ch?n ?nh t? máy'}
              <input type="file" accept="image/jpeg,image/png,image/webp" onChange={handleAvatarUpload} className="hidden" />
            </label>
            <p className="text-[9px] text-neutral-200">JPG, PNG ho?c WEBP, t?i da 5 MB.</p>
          </div>

          <button disabled={isActorSaving} className="w-full py-3 bg-amber-500 text-black font-black text-xs uppercase flex items-center justify-center gap-2 disabled:opacity-50">
            {editingActorId ? <><Check className="h-4 w-4" /> C?p nh?t</> : <><Plus className="h-4 w-4" /> T?o di?n viên</>}
          </button>
        </form>

        <div className="border border-white/[0.05] bg-neutral-950 overflow-hidden">
          <div className="p-3 border-b border-white/[0.05] flex items-center justify-between gap-3">
            <h3 className="text-xs font-black uppercase tracking-[0.18em] text-white">{totalItems} di?n viên</h3>
            <div className="relative w-full max-w-72">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-neutral-200" />
              <input value={actorSearch} onChange={handleActorSearchChange} placeholder="Tìm di?n viên..." className="w-full bg-black border border-white/[0.06] py-2.5 pl-9 pr-3 text-xs text-white focus:outline-none focus:border-amber-400" />
            </div>
          </div>

          <div className="max-h-[620px] overflow-y-auto custom-scrollbar divide-y divide-white/[0.03]">
            {isActorLoading ? (
              <div className="p-10 text-center text-neutral-300">Ðang t?i di?n viên...</div>
            ) : filteredActors.length ? filteredActors.map((actor) => (
              <div key={actor.id} className="p-3 flex gap-3 items-center hover:bg-white/[0.03]">
                {actor.avatarUrl ? <img src={actor.avatarUrl} alt={actor.name} className="h-14 w-14 object-cover border border-white/[0.06]" onError={(e) => { e.currentTarget.onerror = null; e.currentTarget.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(actor.name || "Actor")}&background=1a1a1a&color=f59e0b&size=128&bold=true`; }} /> : <div className="h-14 w-14 border border-white/[0.06] grid place-items-center"><UserRound className="h-5 w-5 text-neutral-200" /></div>}
                <div className="min-w-0 flex-1">
                  <div className="text-xs font-black text-white uppercase truncate">{actor.name} <span className="text-neutral-200">#{actor.id}</span></div>
                  <div className="text-[10px] text-amber-300 mt-1">{actor.movieCount || 0} phim</div>
                  <div className="text-xs text-neutral-300 mt-1 line-clamp-2">{actor.biography || 'Chua có ti?u s?'}</div>
                </div>
                <button type="button" onClick={() => handleEditActor(actor)} className="p-2 text-amber-300 border border-amber-500/20"><Edit3 className="h-4 w-4" /></button>
                <button type="button" onClick={() => handleDeleteActor(actor)} className="p-2 text-rose-400 border border-rose-500/20"><Trash2 className="h-4 w-4" /></button>
              </div>
            )) : <div className="p-10 text-center text-neutral-300">Không tìm th?y di?n viên.</div>}
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-t border-white/[0.05] bg-[#060606] px-4 py-3">
            <span className="text-[10px] font-mono text-neutral-300">
              Trang <span className="text-amber-400 font-black">{page + 1}</span> / {totalPages}
              <span className="ml-2 text-neutral-200">({totalItems} di?n viên, 10 b?n ghi/trang)</span>
            </span>

            <div className="flex flex-wrap items-center gap-1">
              <button
                type="button"
                disabled={page === 0 || isActorLoading}
                onClick={() => goToActorPage(page - 1)}
                className="flex items-center gap-1 border border-white/[0.06] bg-black px-2.5 py-1.5 text-[10px] font-black uppercase text-neutral-200 hover:border-amber-500/50 hover:text-amber-300 disabled:opacity-30 disabled:cursor-not-allowed transition"
              >
                <ChevronLeft className="h-3 w-3" /> Tru?c
              </button>

              {Array.from({ length: totalPages }, (_, i) => i).map((i) => {
                const isNear = Math.abs(i - page) <= 1 || i === 0 || i === totalPages - 1;
                if (!isNear && Math.abs(i - page) === 2) {
                  return <span key={`actor-ellipsis-${i}`} className="px-1 text-neutral-300 text-xs select-none">...</span>;
                }
                if (!isNear) return null;
                return (
                  <button
                    key={i}
                    type="button"
                    disabled={isActorLoading}
                    onClick={() => goToActorPage(i)}
                    className={`min-w-[30px] h-[30px] border text-[10px] font-black transition ${i === page
                      ? 'border-amber-500 bg-amber-500 text-black'
                      : 'border-white/[0.06] bg-black text-neutral-200 hover:border-amber-500/50 hover:text-amber-300'
                      }`}
                  >
                    {i + 1}
                  </button>
                );
              })}

              <button
                type="button"
                disabled={page >= totalPages - 1 || isActorLoading}
                onClick={() => goToActorPage(page + 1)}
                className="flex items-center gap-1 border border-white/[0.06] bg-black px-2.5 py-1.5 text-[10px] font-black uppercase text-neutral-200 hover:border-amber-500/50 hover:text-amber-300 disabled:opacity-30 disabled:cursor-not-allowed transition"
              >
                Ti?p <ChevronRight className="h-3 w-3" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}


