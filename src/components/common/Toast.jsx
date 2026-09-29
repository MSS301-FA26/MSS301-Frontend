import React from 'react';
import { CheckCircle2, AlertCircle, AlertTriangle, Info, X } from 'lucide-react';

export default function Toast({ toast, onClose }) {
  if (!toast) return null;

  const tone = toast.tone || 'success';
  const isError = tone === 'sad' || tone === 'error';
  const isWarning = tone === 'warning';
  const isInfo = tone === 'info';

  const hasAction = toast.action?.onClick && toast.action?.label;

  // Clean any leading symbol/punctuation from text so it never repeats the icon
  const rawText = typeof toast.text === 'string' ? toast.text : (toast.message || '');
  const cleanText = rawText.replace(/^[✓✔✗xX!ℹ️\s]+/, '').trim();

  // Dark palette consistent with CinemaAdmin
  const toneConfig = isError
    ? {
        border: 'border-rose-500/30',
        bg: 'bg-[#181114]/95',
        shadow: 'shadow-[0_12px_36px_rgba(244,63,94,0.18)]',
        textColor: 'text-rose-100',
        icon: <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
      }
    : isWarning
    ? {
        border: 'border-amber-500/30',
        bg: 'bg-[#181510]/95',
        shadow: 'shadow-[0_12px_36px_rgba(245,184,0,0.18)]',
        textColor: 'text-amber-100',
        icon: <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
      }
    : isInfo
    ? {
        border: 'border-sky-500/30',
        bg: 'bg-[#10141a]/95',
        shadow: 'shadow-[0_12px_36px_rgba(14,165,233,0.18)]',
        textColor: 'text-sky-100',
        icon: <Info className="w-4 h-4 text-sky-400 shrink-0 mt-0.5" />
      }
    : {
        border: 'border-emerald-500/30',
        bg: 'bg-[#0f1714]/95',
        shadow: 'shadow-[0_12px_36px_rgba(16,185,129,0.18)]',
        textColor: 'text-emerald-100',
        icon: <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
      };

  return (
    <div
      className="fixed top-5 right-5 z-[9999] max-w-sm w-auto min-w-[280px] pointer-events-auto transition-all animate-in fade-in slide-in-from-top-2 duration-200"
      role="alert"
      aria-live="polite"
    >
      <div
        className={`border ${toneConfig.border} ${toneConfig.bg} ${toneConfig.shadow} text-white rounded-lg px-3.5 py-3 backdrop-blur-md shadow-2xl flex flex-col gap-2`}
      >
        <div className="flex items-start justify-between gap-3">
          {/* Status icon on the left */}
          {toneConfig.icon}

          {/* Message content in the center */}
          <div className="flex-1 min-w-0 pr-1">
            <p className={`text-xs sm:text-sm font-medium leading-relaxed whitespace-pre-line ${toneConfig.textColor}`}>
              {cleanText}
            </p>
          </div>

          {/* Close button on the right */}
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 p-1 -mr-1 -mt-1 text-neutral-400 hover:text-white rounded hover:bg-white/10 transition-colors"
            aria-label="Đóng thông báo"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Action + Cancel buttons (if action is attached) */}
        {hasAction && (
          <div className="flex items-center gap-2 pt-2 border-t border-white/10">
            <button
              type="button"
              onClick={() => {
                toast.action.onClick();
                onClose();
              }}
              className="flex-1 py-1 px-2.5 text-xs font-bold rounded bg-amber-500 hover:bg-amber-400 text-black transition"
            >
              {toast.action.label}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-1 px-2.5 text-xs font-medium rounded border border-white/20 text-neutral-300 hover:text-white hover:border-white/40 transition"
            >
              Hủy
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
