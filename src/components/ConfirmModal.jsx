// src/components/ConfirmModal.jsx
import React, { useEffect } from 'react';

/**
 * Reusable confirm modal.
 * Props:
 *   title        — modal heading
 *   body         — modal body text (string or JSX)
 *   confirmLabel — confirm button text (default "Confirm")
 *   cancelLabel  — cancel button text (default "Cancel")
 *   variant      — "default" | "danger" (default "default")
 *   onConfirm    — called when user confirms
 *   onCancel     — called when user cancels or clicks backdrop
 */
export default function ConfirmModal({
  title,
  body,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  variant = 'default',
  onConfirm,
  onCancel,
}) {
  // Close on Escape key
  useEffect(() => {
    const handleKey = (e) => {
      if (e.key === 'Escape') onCancel?.();
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [onCancel]);

  return (
    <div
      className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4"
      onClick={onCancel}
    >
      <div
        className="bg-qw-dark border border-qw-border rounded-lg w-full max-w-md shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-5">
          <h2 className="font-display font-semibold text-white text-base mb-2">{title}</h2>
          <div className="text-sm text-qw-muted">{body}</div>
        </div>
        <div className="px-5 pb-5 flex justify-end gap-3">
          <button
            onClick={onCancel}
            className="qw-btn-secondary text-sm px-4 py-1.5"
          >
            {cancelLabel}
          </button>
          <button
            onClick={onConfirm}
            className={variant === 'danger' ? 'qw-btn-danger text-sm px-4 py-1.5' : 'qw-btn text-sm px-4 py-1.5'}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
