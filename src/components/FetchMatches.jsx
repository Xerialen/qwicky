// src/components/FetchMatches.jsx
import React, { useState } from 'react';
import { parseMatch } from '../utils/matchLogic';

export default function FetchMatches({ matches, setMatches }) {
  const [gameId, setGameId] = useState('');
  const [batchIds, setBatchIds] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [lastFetched, setLastFetched] = useState(null);
  const [mode, setMode] = useState('single'); // 'single' or 'batch'

  const fetchSingleGame = async (id) => {
    const response = await fetch(`/api/game/${id}`);
    if (!response.ok) {
      throw new Error(`Failed to fetch game ${id}: ${response.status}`);
    }
    const data = await response.json();
    return parseMatch(id, data);
  };

  const handleFetchSingle = async (e) => {
    e.preventDefault();
    if (!gameId.trim()) return;

    setLoading(true);
    setError(null);

    try {
      const parsed = await fetchSingleGame(gameId.trim());
      
      // Check if match already exists
      const exists = matches.some(m => m.id === parsed.id);
      if (exists) {
        setError(`Match ${parsed.id} already exists in the list`);
        setLoading(false);
        return;
      }

      setMatches([...matches, parsed]);
      setLastFetched(parsed);
      setGameId('');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleFetchBatch = async (e) => {
    e.preventDefault();
    const ids = batchIds
      .split(/[\n,\s]+/)
      .map(id => id.trim())
      .filter(id => id.length > 0);

    if (ids.length === 0) return;

    setLoading(true);
    setError(null);

    const results = [];
    const errors = [];
    
    for (const id of ids) {
      try {
        const parsed = await fetchSingleGame(id);
        const exists = matches.some(m => m.id === parsed.id);
        if (!exists && !results.some(r => r.id === parsed.id)) {
          results.push(parsed);
        }
      } catch (err) {
        errors.push(`${id}: ${err.message}`);
      }
    }

    if (results.length > 0) {
      setMatches([...matches, ...results]);
      setLastFetched(results[results.length - 1]);
    }

    if (errors.length > 0) {
      setError(`Failed to fetch ${errors.length} game(s):\n${errors.join('\n')}`);
    }

    setBatchIds('');
    setLoading(false);
  };

  const handleRemoveMatch = (id) => {
    setMatches(matches.filter(m => m.id !== id));
    if (lastFetched?.id === id) {
      setLastFetched(null);
    }
  };

  const handleClearAll = () => {
    if (window.confirm('Are you sure you want to remove all matches?')) {
      setMatches([]);
      setLastFetched(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Mode Toggle */}
      <div className="flex gap-2 mb-4">
        <button
          onClick={() => setMode('single')}
          className={`px-4 py-2 rounded font-body font-semibold transition-all
            ${mode === 'single' 
              ? 'bg-qw-accent text-qw-dark' 
              : 'bg-qw-panel border border-qw-border text-qw-muted hover:text-white'
            }`}
        >
          Single Fetch
        </button>
        <button
          onClick={() => setMode('batch')}
          className={`px-4 py-2 rounded font-body font-semibold transition-all
            ${mode === 'batch' 
              ? 'bg-qw-accent text-qw-dark' 
              : 'bg-qw-panel border border-qw-border text-qw-muted hover:text-white'
            }`}
        >
          Batch Fetch
        </button>
      </div>

      {/* Input Forms */}
      <div className="qw-panel p-6">
        <h2 className="font-display font-bold text-xl mb-4 text-qw-accent flex items-center gap-2">
          <span>⚡</span>
          {mode === 'single' ? 'Fetch Single Game' : 'Batch Fetch Games'}
        </h2>

        {mode === 'single' ? (
          <form onSubmit={handleFetchSingle} className="flex gap-3">
            <input
              type="text"
              value={gameId}
              onChange={(e) => setGameId(e.target.value)}
              placeholder="Enter Game ID..."
              className="flex-1 bg-qw-dark border border-qw-border rounded px-4 py-2 font-mono text-white focus:border-qw-accent focus:outline-none focus:ring-1 focus:ring-qw-accent"
              disabled={loading}
            />
            <button
              type="submit"
              disabled={loading || !gameId.trim()}
              className="qw-btn disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <span className="flex items-center gap-2">
                  <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  Fetching...
                </span>
              ) : (
                'Fetch'
              )}
            </button>
          </form>
        ) : (
          <form onSubmit={handleFetchBatch} className="space-y-3">
            <textarea
              value={batchIds}
              onChange={(e) => setBatchIds(e.target.value)}
              placeholder="Enter Game IDs (one per line or comma-separated)..."
              rows={5}
              className="w-full bg-qw-dark border border-qw-border rounded px-4 py-2 font-mono text-white focus:border-qw-accent focus:outline-none focus:ring-1 focus:ring-qw-accent resize-none"
              disabled={loading}
            />
            <button
              type="submit"
              disabled={loading || !batchIds.trim()}
              className="qw-btn disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <span className="flex items-center gap-2">
                  <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  Fetching...
                </span>
              ) : (
                'Fetch All'
              )}
            </button>
          </form>
        )}

        {/* Error Display */}
        {error && (
          <div className="mt-4 p-4 bg-red-900/30 border border-red-500/50 rounded text-red-300 font-mono text-sm whitespace-pre-wrap">
            {error}
          </div>
        )}

        {/* Last Fetched Preview */}
        {lastFetched && (
          <div className="mt-4 p-4 bg-qw-dark rounded border border-qw-border">
            <h3 className="font-display text-sm text-qw-accent mb-2">LAST FETCHED</h3>
            <div className="grid grid-cols-2 gap-4 font-mono text-sm">
              <div>
                <span className="text-qw-muted">ID:</span>
                <span className="ml-2 text-white">{lastFetched.id}</span>
              </div>
              <div>
                <span className="text-qw-muted">Map:</span>
                <span className="ml-2 text-white">{lastFetched.map}</span>
              </div>
              <div>
                <span className="text-qw-muted">Date:</span>
                <span className="ml-2 text-white">{lastFetched.date}</span>
              </div>
              <div>
                <span className="text-qw-muted">Mode:</span>
                <span className="ml-2 text-white">{lastFetched.mode}</span>
              </div>
              <div className="col-span-2">
                <span className="text-qw-muted">Teams:</span>
                <span className="ml-2 text-white">
                  {lastFetched.teams[0]} ({lastFetched.scores[lastFetched.teams[0]] || 0}) vs {lastFetched.teams[1]} ({lastFetched.scores[lastFetched.teams[1]] || 0})
                </span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Fetched Matches List */}
      <div className="qw-panel p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-display font-bold text-xl text-qw-accent flex items-center gap-2">
            <span>📦</span>
            Fetched Matches ({matches.length})
          </h2>
          {matches.length > 0 && (
            <button
              onClick={handleClearAll}
              className="qw-btn-secondary px-3 py-1 text-sm rounded border border-red-500/50 text-red-400 hover:bg-red-500/20"
            >
              Clear All
            </button>
          )}
        </div>

        {matches.length === 0 ? (
          <div className="text-center py-12 text-qw-muted">
            <div className="text-4xl mb-2">📭</div>
            <p className="font-body">No matches fetched yet</p>
            <p className="text-sm">Enter a Game ID above to get started</p>
          </div>
        ) : (
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {matches.map((match, idx) => (
              <div
                key={match.id}
                className="flex items-center justify-between p-3 bg-qw-dark rounded border border-qw-border hover:border-qw-accent/50 transition-colors group"
              >
                <div className="flex items-center gap-4">
                  <span className="text-qw-muted font-mono text-sm w-8">#{idx + 1}</span>
                  <div>
                    <div className="font-body font-semibold text-white">
                      {match.teams[0]} 
                      <span className="text-qw-accent mx-2">vs</span> 
                      {match.teams[1]}
                    </div>
                    <div className="flex gap-4 text-sm text-qw-muted font-mono">
                      <span>{match.map}</span>
                      <span>•</span>
                      <span>{match.scores[match.teams[0]] || 0} - {match.scores[match.teams[1]] || 0}</span>
                      <span>•</span>
                      <span>{match.id}</span>
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => handleRemoveMatch(match.id)}
                  className="opacity-0 group-hover:opacity-100 p-2 text-red-400 hover:text-red-300 hover:bg-red-500/20 rounded transition-all"
                  title="Remove match"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
