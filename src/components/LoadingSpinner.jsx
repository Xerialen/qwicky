// src/components/LoadingSpinner.jsx
import React from 'react';

export default function LoadingSpinner({ message = 'Loading...' }) {
  return (
    <div className="min-h-screen bg-qw-darker flex items-center justify-center">
      <div className="text-center">
        <div className="relative w-16 h-16 mx-auto mb-4">
          <div className="absolute inset-0 border-4 border-qw-border rounded-full"></div>
          <div className="absolute inset-0 border-4 border-transparent border-t-qw-accent rounded-full animate-spin"></div>
        </div>
        <p className="text-qw-muted font-body">{message}</p>
      </div>
    </div>
  );
}
