// src/components/DataManager.jsx
import React, { useRef } from 'react';

export default function DataManager({ tournament, importTournament, resetTournament }) {
  const fileInputRef = useRef(null);

  const handleExport = () => {
    const data = {
      ...tournament,
      exportedAt: new Date().toISOString(),
      version: 3
    };

    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const safeName = (tournament.name || 'tournament').replace(/[^a-z0-9]/gi, '_');
    a.download = `${safeName}_${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleImport = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const data = JSON.parse(event.target.result);
        
        if (!data.divisions && !data.name) {
          throw new Error('Invalid tournament file');
        }

        if (!window.confirm('Replace current tournament with imported data?')) {
          return;
        }

        importTournament(data);
        alert('Tournament imported successfully!');
      } catch (err) {
        alert('Failed to import: ' + err.message);
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const stats = {
    divisions: tournament.divisions?.length || 0,
    teams: tournament.divisions?.reduce((sum, d) => sum + (d.teams?.length || 0), 0) || 0,
    matches: tournament.divisions?.reduce((sum, d) => sum + (d.schedule?.length || 0), 0) || 0
  };

  return (
    <div className="fixed bottom-4 right-4 z-40">
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleImport}
        accept=".json"
        className="hidden"
      />
      
      <div className="flex items-center gap-2 bg-qw-panel border border-qw-border rounded-lg p-2 shadow-lg">
        <div className="hidden md:flex items-center gap-3 px-3 text-xs font-mono text-qw-muted border-r border-qw-border">
          <span>{stats.divisions}D</span>
          <span>{stats.teams}T</span>
          <span>{stats.matches}M</span>
        </div>

        <button
          onClick={() => fileInputRef.current?.click()}
          className="px-3 py-2 rounded bg-qw-dark border border-qw-border text-qw-muted hover:text-white hover:border-qw-accent transition-all flex items-center gap-2 text-sm"
          title="Load tournament"
        >
          📂 Load
        </button>

        <button
          onClick={handleExport}
          className="px-3 py-2 rounded bg-qw-accent text-qw-dark font-semibold transition-all flex items-center gap-2 text-sm hover:bg-qw-accent-dim"
          title="Save tournament"
        >
          💾 Save
        </button>

        <button
          onClick={resetTournament}
          className="px-2 py-2 rounded text-red-400 hover:text-red-300 hover:bg-red-500/20 transition-all"
          title="Reset all"
        >
          🗑️
        </button>
      </div>
    </div>
  );
}
