// src/components/EmptyState.jsx
import React from 'react';

export default function EmptyState({ icon, title, description, actionLabel, onAction }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <span className="text-4xl mb-3 opacity-40">{icon}</span>
      <h3 className="text-lg font-medium text-zinc-300 mb-1">{title}</h3>
      <p className="text-sm text-zinc-500 max-w-md mb-4">{description}</p>
      {actionLabel && onAction && (
        <button onClick={onAction} className="qw-btn text-sm px-4 py-2">
          {actionLabel}
        </button>
      )}
    </div>
  );
}
