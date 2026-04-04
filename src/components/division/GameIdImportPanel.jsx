// src/components/division/GameIdImportPanel.jsx
import React, { useState, useRef } from 'react';
import { parseMatch } from '../../utils/matchLogic';

/**
 * Merged API Fetch + JSON Import panel.
 * Accepts game IDs / Hub URLs (up to 50) or .json file upload / paste.
 *
 * Props:
 *   onImport(parsedMatches) — parent calls addMapsInBatch with the result
 */
export default function GameIdImportPanel({ onImport }) {
  const [gameIds, setGameIds] = useState('');
  const [jsonInput, setJsonInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState(null);
  const [error, setError] = useState(null);
  const fileInputRef = useRef(null);

  // --- API Fetch ---
  const handleApiFetch = async () => {
    if (!gameIds.trim()) return;
    setLoading(true);
    setStatus('Parsing inputs...');
    setError(null);

    const rawTokens = gameIds.split(/[\s,;\n]+/).filter((t) => t.trim().length > 0);
    const idSet = new Set();
    rawTokens.forEach((token) => {
      const clean = token.trim();
      if (/^\d+$/.test(clean)) {
        idSet.add(clean);
        return;
      }
      const queryMatch = clean.match(/gameId=(\d+)/i);
      if (queryMatch?.[1]) {
        idSet.add(queryMatch[1]);
        return;
      }
      const pathMatch = clean.match(/(?:game|match|matches|demo)\/(\d+)/i);
      if (pathMatch?.[1]) idSet.add(pathMatch[1]);
    });

    const ids = Array.from(idSet);
    if (ids.length === 0) {
      setError("No valid Game IDs found. Ensure links contain 'gameId=...'");
      setLoading(false);
      return;
    }
    if (ids.length > 50) {
      setError(`Too many links! You pasted ${ids.length}. Max allowed is 50.`);
      setLoading(false);
      return;
    }

    setStatus(`Preparing to fetch ${ids.length} matches...`);
    const fetched = [];
    const errors = [];

    for (const id of ids) {
      try {
        setStatus(`Fetching Game ID: ${id} (${fetched.length + 1}/${ids.length})...`);
        const res = await fetch(`/api/game/${id}`);
        const data = await res.json();
        if (data.status === 'success') {
          fetched.push(parseMatch(id, data.data));
        } else {
          errors.push(`ID ${id}: ${data.message || 'Failed'}`);
        }
      } catch (err) {
        errors.push(`ID ${id}: Network Error`);
      }
    }

    if (fetched.length > 0) {
      onImport(fetched);
      setStatus(`✓ Success! Fetched ${fetched.length} match(es).`);
      setGameIds('');
      setTimeout(() => setStatus(null), 5000);
    }
    if (errors.length > 0) {
      if (fetched.length > 0) {
        setStatus((prev) => `${prev} (with ${errors.length} error(s))`);
      } else {
        setError(errors.join('\n'));
        setStatus(null);
      }
    } else if (fetched.length === 0) {
      setStatus('No matches found.');
    }
    setLoading(false);
  };

  // --- JSON Paste ---
  const handleJsonPaste = () => {
    if (!jsonInput.trim()) return;
    setError(null);
    try {
      const data = JSON.parse(jsonInput);
      const matches = Array.isArray(data) ? data : [data];
      const parsed = [];
      matches.forEach((m, idx) => {
        if ((m.teams || m.players) && (m.team_stats || m.players)) {
          parsed.push(parseMatch(m.demo || `pasted-${Date.now()}-${idx}`, m));
        } else if (m.matchupId && m.scores) {
          parsed.push(m);
        }
      });
      if (parsed.length > 0) {
        onImport(parsed);
        setJsonInput('');
      } else {
        setError('No valid match data found in JSON.');
      }
    } catch (err) {
      setError('Invalid JSON: ' + err.message);
    }
  };

  // --- File Upload ---
  const handleFileUpload = async (e) => {
    const files = e.target.files;
    if (!files?.length) return;
    setError(null);
    setLoading(true);
    try {
      const allParsed = [];
      const errors = [];
      for (const file of Array.from(files)) {
        try {
          const text = await file.text();
          const data = JSON.parse(text);
          const matches = Array.isArray(data) ? data : [data];
          matches.forEach((m, idx) => {
            if ((m.teams || m.players) && (m.team_stats || m.players)) {
              allParsed.push(parseMatch(m.demo || `${file.name}-${idx}`, m));
            } else if (m.matchupId && m.scores) {
              allParsed.push(m);
            }
          });
        } catch (err) {
          errors.push(`${file.name}: ${err.message}`);
        }
      }
      if (allParsed.length > 0) onImport(allParsed);
      if (errors.length) setError(errors.join('\n'));
    } catch (err) {
      setError(err.message);
    }
    setLoading(false);
    e.target.value = '';
  };

  return (
    <div className="space-y-6">
      {/* API Fetch */}
      <div className="space-y-2">
        <h4 className="font-display text-sm text-qw-accent">FETCH BY GAME ID</h4>
        <p className="text-xs text-qw-muted">
          Paste Game IDs or full Hub URLs (up to 50), separated by spaces or newlines.
        </p>
        <textarea
          value={gameIds}
          onChange={(e) => setGameIds(e.target.value)}
          placeholder={'e.g. 168085\nhttps://www.quakeworld.nu/matches/168086'}
          rows={4}
          className="w-full bg-qw-darker text-white p-2 rounded border border-qw-border focus:border-qw-win outline-none font-mono text-sm resize-y"
        />
        <button
          onClick={handleApiFetch}
          disabled={loading || !gameIds.trim()}
          className="qw-btn px-6 py-2 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? 'Fetching...' : 'FETCH MATCHES'}
        </button>
        {status && (
          <div
            className={`text-sm font-mono ${status.includes('✓') ? 'text-qw-win' : 'text-qw-accent'}`}
          >
            {status}
          </div>
        )}
      </div>

      <div className="border-t border-qw-border" />

      {/* JSON Import */}
      <div className="space-y-2">
        <h4 className="font-display text-sm text-qw-accent">IMPORT JSON</h4>
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileUpload}
          accept=".json"
          multiple
          className="hidden"
        />
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={loading}
          className="px-4 py-3 rounded border-2 border-dashed border-qw-border hover:border-qw-accent text-qw-muted hover:text-white transition-all w-full flex items-center justify-center gap-2 disabled:opacity-50"
        >
          <span className="text-2xl">📄</span>
          <span>{loading ? 'Processing...' : 'Select JSON files (Ctrl+click for multiple)'}</span>
        </button>
        <label className="block text-qw-muted text-sm mb-1">Or paste JSON:</label>
        <textarea
          value={jsonInput}
          onChange={(e) => setJsonInput(e.target.value)}
          placeholder='{"teams": [...], "players": [...]}'
          rows={3}
          className="w-full bg-qw-dark border border-qw-border rounded px-4 py-2 font-mono text-white text-sm resize-none"
        />
        <button
          onClick={handleJsonPaste}
          disabled={!jsonInput.trim()}
          className="qw-btn mt-1 disabled:opacity-50"
        >
          Import
        </button>
      </div>

      {error && (
        <div className="p-4 bg-red-900/30 border border-red-500/50 rounded text-red-300 font-mono text-sm whitespace-pre-wrap">
          {error}
        </div>
      )}
    </div>
  );
}
