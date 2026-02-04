// src/components/ErrorMessage.jsx
import React from 'react';

export default function ErrorMessage({ error, onRetry }) {
  return (
    <div className="min-h-screen bg-qw-darker flex items-center justify-center">
      <div className="qw-panel p-8 max-w-md text-center">
        <div className="text-5xl mb-4">⚠️</div>
        <h2 className="font-display text-xl text-qw-loss mb-2">Error Loading Data</h2>
        <p className="text-qw-muted mb-6 font-mono text-sm">{error}</p>
        {onRetry && (
          <button
            onClick={onRetry}
            className="qw-btn"
          >
            Try Again
          </button>
        )}
      </div>
    </div>
  );
}
