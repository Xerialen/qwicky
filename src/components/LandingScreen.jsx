// src/components/LandingScreen.jsx
import React, { useRef } from 'react';

function timeAgo(dateStr) {
  if (!dateStr) return '';
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

export default function LandingScreen({
  hasExistingData,
  onCreateNew,
  onLoadFile,
  cloudTournaments,
  onLoadFromCloud,
  isLoading,
}) {
  const fileInputRef = useRef(null);

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const data = JSON.parse(event.target.result);
        if (!data.divisions && !data.name) throw new Error('Invalid tournament file');
        onLoadFile(data);
      } catch (err) {
        alert('Failed to load: ' + err.message);
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleNewTournament = () => {
    if (hasExistingData) {
      if (!window.confirm('Start a new tournament? Current data will be cleared.')) return;
    }
    onCreateNew();
  };

  const hasTournaments = cloudTournaments?.length > 0;

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
      <div className="mb-12 text-center">
        <h1 className="font-display font-bold text-2xl text-white tracking-tight">QWICKY</h1>
        <p className="text-xs text-qw-muted mt-1">tournament admin</p>
      </div>

      <div className="w-full max-w-sm space-y-3">
        {/* Tournament list */}
        {isLoading && (
          <div className="flex items-center justify-center gap-2 text-qw-muted text-xs py-6">
            <span className="animate-spin">...</span>
            <span>Loading tournaments</span>
          </div>
        )}

        {!isLoading && hasTournaments && (
          <>
            <div className="text-[10px] text-qw-muted uppercase tracking-widest">
              Your tournaments
            </div>
            {cloudTournaments.map((t) => (
              <button
                key={t.id}
                onClick={() => onLoadFromCloud(t.id)}
                className="w-full p-4 rounded-lg text-left border border-qw-border hover:border-qw-accent transition-colors group"
              >
                <div className="flex items-center justify-between">
                  <span className="font-display font-semibold text-white group-hover:text-qw-accent transition-colors">
                    {t.name}
                  </span>
                  <span className="text-qw-muted text-xs">&rarr;</span>
                </div>
                <div className="flex gap-3 text-xs text-qw-muted mt-1.5 font-mono">
                  {t.mode && <span>{t.mode}</span>}
                  {t.startDate && <span>{t.startDate}</span>}
                  {t.updatedAt && <span>updated {timeAgo(t.updatedAt)}</span>}
                </div>
              </button>
            ))}
          </>
        )}

        {!isLoading && !hasTournaments && (
          <div className="text-center py-6">
            <p className="text-qw-muted text-sm">No tournaments yet</p>
          </div>
        )}

        {/* Actions */}
        <div className="pt-3 flex gap-2">
          <button
            onClick={handleNewTournament}
            className={`flex-1 rounded-lg font-medium text-sm transition-colors py-2.5 ${
              hasTournaments
                ? 'border border-qw-border text-qw-muted hover:text-white hover:border-qw-accent'
                : 'bg-qw-accent text-qw-darker hover:bg-qw-accent-dim'
            }`}
          >
            New
          </button>
          <button
            onClick={() => fileInputRef.current?.click()}
            className="flex-1 rounded-lg font-medium text-sm border border-qw-border text-qw-muted hover:text-white hover:border-qw-accent transition-colors py-2.5"
          >
            Load file
          </button>
        </div>
      </div>

      <p className="mt-16 text-[10px] text-qw-muted/50 font-mono">qwicky v0.5</p>
    </div>
  );
}
