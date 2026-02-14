// src/components/DangerButton.jsx
import { useState, useEffect } from 'react';

export default function DangerButton({ label, confirmLabel, onConfirm, className = '' }) {
  const [confirming, setConfirming] = useState(false);

  useEffect(() => {
    if (!confirming) return;
    const timer = setTimeout(() => setConfirming(false), 3000);
    return () => clearTimeout(timer);
  }, [confirming]);

  return (
    <button
      onClick={() => {
        if (confirming) {
          onConfirm();
          setConfirming(false);
        } else {
          setConfirming(true);
        }
      }}
      className={`px-3 py-1.5 text-sm rounded-md transition-all duration-200 ${
        confirming
          ? 'bg-red-600 text-white ring-2 ring-red-400 ring-offset-1 ring-offset-zinc-900'
          : 'bg-zinc-800 text-red-400 hover:bg-zinc-700'
      } ${className}`}
    >
      {confirming ? confirmLabel || 'Click again to confirm' : label}
    </button>
  );
}
