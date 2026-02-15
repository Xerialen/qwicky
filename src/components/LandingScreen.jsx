// src/components/LandingScreen.jsx
import React, { useRef } from 'react';

export default function LandingScreen({
  hasExistingData,
  tournamentName,
  stats,
  onCreateNew,
  onContinue,
  onLoadFile,
}) {
  const fileInputRef = useRef(null);

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const data = JSON.parse(event.target.result);
        if (!data.divisions && !data.name) {
          throw new Error('Invalid tournament file');
        }
        onLoadFile(data);
      } catch (err) {
        alert('Failed to load file: ' + err.message);
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleNewTournament = () => {
    if (hasExistingData) {
      if (!window.confirm('Start a new tournament? Your current data will be cleared.')) return;
    }
    onCreateNew();
  };

  return (
    <div className="min-h-screen bg-qw-darker flex flex-col items-center justify-center px-4">
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        accept=".json"
        className="hidden"
      />

      {/* Branding */}
      <div className="flex items-center gap-4 mb-10">
        <div
          className="w-14 h-14 rounded-xl flex items-center justify-center shadow-card"
          style={{ background: '#FFB300' }}
        >
          <span className="font-logo font-black text-2xl" style={{ color: '#121212' }}>
            QW
          </span>
        </div>
        <div>
          <h1 className="font-display font-bold text-3xl text-white tracking-tight">QWICKY</h1>
          <p className="text-sm text-qw-muted">QuakeWorld tournament admin</p>
        </div>
      </div>

      {/* Continue card (when existing data) */}
      {hasExistingData && (
        <button
          onClick={onContinue}
          className="w-full max-w-md mb-6 qw-panel p-6 text-left hover:border-qw-accent border border-transparent transition-all group"
        >
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-display font-bold text-lg text-white group-hover:text-qw-accent transition-colors">
              Continue working on
            </h2>
            <svg className="w-5 h-5 text-qw-muted group-hover:text-qw-accent transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </div>
          <p className="font-display font-semibold text-qw-accent text-xl mb-2">
            {tournamentName || 'Untitled Tournament'}
          </p>
          <div className="flex items-center gap-3 text-xs font-mono text-qw-muted">
            <span><span className="text-qw-accent">{stats.divisions}</span> div</span>
            <span className="text-qw-border">|</span>
            <span><span className="text-qw-accent">{stats.teams}</span> teams</span>
            <span className="text-qw-border">|</span>
            <span><span className="text-qw-win">{stats.completed}</span>/<span className="text-qw-text">{stats.matches}</span> matches</span>
          </div>
        </button>
      )}

      {/* Action buttons */}
      <div className={`w-full max-w-md flex gap-3 ${hasExistingData ? '' : 'flex-col'}`}>
        <button
          onClick={handleNewTournament}
          className={`
            flex-1 rounded-lg font-display font-semibold transition-all
            flex items-center justify-center gap-2
            ${hasExistingData
              ? 'px-4 py-3 bg-qw-panel border border-qw-border text-qw-muted hover:text-white hover:border-qw-accent text-sm'
              : 'px-6 py-4 text-lg text-qw-dark hover:opacity-90'
            }
          `}
          style={!hasExistingData ? { backgroundColor: '#FFB300' } : undefined}
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Create New Tournament
        </button>

        <button
          onClick={() => fileInputRef.current?.click()}
          className={`
            flex-1 rounded-lg font-display font-semibold transition-all
            flex items-center justify-center gap-2
            ${hasExistingData
              ? 'px-4 py-3 bg-qw-panel border border-qw-border text-qw-muted hover:text-white hover:border-qw-accent text-sm'
              : 'px-6 py-4 bg-qw-panel border border-qw-border text-white hover:border-qw-accent text-lg'
            }
          `}
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
          </svg>
          Load from File
        </button>
      </div>

      {/* Footer */}
      <p className="mt-12 text-xs text-qw-muted font-mono">
        v0.4 · browser-only · by Xerial
      </p>
    </div>
  );
}
