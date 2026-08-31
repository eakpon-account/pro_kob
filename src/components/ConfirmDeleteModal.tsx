import React, { useEffect } from 'react';
import { AlertTriangle, Trash2, X } from 'lucide-react';

interface ConfirmDeleteModalProps {
  isOpen: boolean;
  title?: string;
  itemTitle?: string;
  itemSubtitle?: string;
  warningMessage?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  isDestructive?: boolean;
  isLoading?: boolean;
  onConfirm: () => void;
  onClose: () => void;
}

export const ConfirmDeleteModal: React.FC<ConfirmDeleteModalProps> = ({
  isOpen,
  title = 'ยืนยันการลบข้อมูล',
  itemTitle,
  itemSubtitle,
  warningMessage = 'การกระทำนี้ไม่สามารถยกเลิกได้ และข้อมูลที่เกี่ยวข้องจะถูกลบออกจากระบบอย่างถาวร',
  confirmLabel = 'ยืนยันการลบข้อมูล',
  cancelLabel = 'ยกเลิก',
  isDestructive = true,
  isLoading = false,
  onConfirm,
  onClose,
}) => {
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isLoading) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, isLoading, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4 animate-in fade-in duration-150"
      onClick={() => {
        if (!isLoading) onClose();
      }}
    >
      <div
        className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 overflow-hidden transform transition-all"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
              isDestructive ? 'bg-rose-100 text-rose-600' : 'bg-amber-100 text-amber-600'
            }`}>
              {isDestructive ? <Trash2 className="w-5 h-5" /> : <AlertTriangle className="w-5 h-5" />}
            </div>
            <div>
              <h3 className="font-bold text-slate-800 text-base">{title}</h3>
              <p className="text-xs text-slate-400">โปรดตรวจสอบก่อนดำเนินการ</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isLoading}
            className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer disabled:opacity-50"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Item Highlight Box */}
        {itemTitle && (
          <div className="mt-4 p-3 bg-slate-50 border border-slate-200 rounded-xl">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">รายการที่จะลบ:</p>
            <p className="text-sm font-bold text-slate-800 mt-0.5">{itemTitle}</p>
            {itemSubtitle && (
              <p className="text-xs text-slate-500 mt-0.5">{itemSubtitle}</p>
            )}
          </div>
        )}

        {/* Warning Body */}
        <div className="mt-4 p-3 bg-rose-50 border border-rose-100 rounded-xl flex items-start gap-2.5">
          <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
          <p className="text-xs text-rose-700 leading-relaxed font-medium">
            {warningMessage}
          </p>
        </div>

        {/* Action Buttons */}
        <div className="mt-6 flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
          <button
            type="button"
            onClick={onClose}
            disabled={isLoading}
            className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer disabled:opacity-50"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isLoading}
            className={`px-4 py-2 text-xs font-bold text-white rounded-lg shadow-xs transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50 ${
              isDestructive
                ? 'bg-rose-600 hover:bg-rose-700 active:bg-rose-800'
                : 'bg-amber-600 hover:bg-amber-700 active:bg-amber-800'
            }`}
          >
            {isLoading ? (
              <>
                <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                <span>กำลังดำเนินการ...</span>
              </>
            ) : (
              <>
                <Trash2 className="w-4 h-4" />
                <span>{confirmLabel}</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
