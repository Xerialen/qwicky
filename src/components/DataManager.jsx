// src/components/DataManager.jsx
import React, { useRef, useState } from 'react';
import DangerButton from './DangerButton';

export default function DataManager({ tournament, importTournament, resetTournament }) {
  const fileInputRef = useRef(null);
  const [dedupResult, setDedupResult] = useState(null);

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

  const handleDedup = () => {
    let rawDups = 0;
    let scheduleDups = 0;
    const cleaned = {
      ...tournament,
      divisions: (tournament.divisions || []).map(div => {
        // Dedup rawMaps by normalized fingerprint
        const seen = new Map();
        const dedupedRawMaps = [];
        for (const m of (div.rawMaps || [])) {
          const teams = (m.teams || []).map(t => (t || '').toLowerCase()).sort();
          const fp = `${(m.map || '').toLowerCase()}|${teams.join('vs')}|${m.timestamp || m.date || ''}`;
          if (!seen.has(fp)) {
            seen.set(fp, true);
            dedupedRawMaps.push(m);
          } else {
            rawDups++;
          }
        }

        // Dedup schedule match maps by map+scores
        const dedupedSchedule = (div.schedule || []).map(match => {
          if (!match.maps || match.maps.length <= 1) return match;
          const mapSeen = new Set();
          const cleanMaps = match.maps.filter(map => {
            const fp = `${(map.map || '').toLowerCase()}|${map.score1}|${map.score2}`;
            if (mapSeen.has(fp)) { scheduleDups++; return false; }
            mapSeen.add(fp);
            return true;
          });
          return { ...match, maps: cleanMaps };
        });

        return { ...div, rawMaps: dedupedRawMaps, schedule: dedupedSchedule };
      })
    };

    if (rawDups === 0 && scheduleDups === 0) {
      setDedupResult('clean');
      setTimeout(() => setDedupResult(null), 3000);
      return;
    }

    importTournament(cleaned);
    setDedupResult(`${rawDups + scheduleDups} duplicates removed`);
    setTimeout(() => setDedupResult(null), 5000);
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
          onClick={handleDedup}
          className="px-3 py-2 rounded bg-qw-dark border border-qw-border text-qw-muted hover:text-white hover:border-qw-accent transition-all text-sm"
          title="Remove duplicate maps"
        >
          {dedupResult === 'clean' ? '✓ Clean' : dedupResult ? `✓ ${dedupResult}` : 'Dedup'}
        </button>

        <DangerButton
          label="🗑️"
          confirmLabel="Confirm Reset"
          onConfirm={resetTournament}
          className="!px-2 !py-2"
        />
      </div>
    </div>
  );
}
