// src/components/division/AddResultsPanel.jsx
import React, { useState } from 'react';
import ResultSearchPanel from './ResultSearchPanel';
import GameIdImportPanel from './GameIdImportPanel';

/**
 * Collapsible panel for adding results.
 * Question flow: "How do you have this result?" → search or game-id import.
 *
 * Props:
 *   division      — Division object
 *   tournament    — full tournament object
 *   tournamentId  — string
 *   onImport(maps) — parent calls addMapsInBatch
 *   onPostDiscovery(selected, summary) — optional Discord post callback
 */
export default function AddResultsPanel({
  division,
  tournament,
  tournamentId,
  onImport,
  onPostDiscovery,
}) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [mode, setMode] = useState(null); // null | 'search' | 'gameid'

  const handleToggle = () => {
    setIsExpanded((v) => !v);
    if (!isExpanded) setMode(null);
  };

  return (
    <div className="qw-panel overflow-hidden">
      <button
        onClick={handleToggle}
        className="w-full flex items-center justify-between px-6 py-4 bg-qw-dark border-b border-qw-border hover:bg-qw-dark/80 transition-colors"
      >
        <div className="flex items-center gap-3">
          <span className="text-xl">➕</span>
          <h3 className="font-display text-lg text-qw-accent">ADD RESULTS</h3>
          <span className="text-xs text-qw-muted">
            {isExpanded ? '' : '(search Discord / import by ID or file)'}
          </span>
        </div>
        <span
          className={`text-qw-accent transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`}
        >
          ▼
        </span>
      </button>

      {isExpanded && (
        <div className="p-6 space-y-6">
          {/* Question flow */}
          {!mode && (
            <div className="space-y-3">
              <p className="text-qw-muted text-sm font-semibold">How do you have this result?</p>
              <div className="flex flex-wrap gap-3">
                <button
                  onClick={() => setMode('search')}
                  className="px-4 py-3 rounded border border-qw-border bg-qw-dark hover:border-qw-accent hover:bg-qw-accent/10 text-white text-sm text-left transition-colors"
                >
                  <div className="font-semibold mb-1">🔍 From Discord / Search</div>
                  <div className="text-qw-muted text-xs">
                    Browse by team tag or auto-discover via confidence model
                  </div>
                </button>
                <button
                  onClick={() => setMode('gameid')}
                  className="px-4 py-3 rounded border border-qw-border bg-qw-dark hover:border-qw-accent hover:bg-qw-accent/10 text-white text-sm text-left transition-colors"
                >
                  <div className="font-semibold mb-1">🆔 I have a Game ID or JSON file</div>
                  <div className="text-qw-muted text-xs">
                    Paste Hub URLs / game IDs, or upload a .json file
                  </div>
                </button>
              </div>
            </div>
          )}

          {mode && (
            <div className="flex items-center gap-3 mb-2">
              <button
                onClick={() => setMode(null)}
                className="text-sm text-qw-muted hover:text-white"
              >
                ← Back
              </button>
              <span className="text-qw-muted text-sm">
                {mode === 'search' ? '🔍 Browse / Discover' : '🆔 Game ID / JSON Import'}
              </span>
            </div>
          )}

          {mode === 'search' && (
            <ResultSearchPanel
              division={division}
              tournament={tournament}
              tournamentId={tournamentId}
              onImport={onImport}
              onPostDiscovery={onPostDiscovery}
            />
          )}

          {mode === 'gameid' && <GameIdImportPanel onImport={onImport} />}
        </div>
      )}
    </div>
  );
}
