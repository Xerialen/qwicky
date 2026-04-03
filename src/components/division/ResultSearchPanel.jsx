// src/components/division/ResultSearchPanel.jsx
import React, { useState } from 'react';
import QWStatsService from '../../services/QWStatsService';
import { supabase } from '../../services/supabaseClient';

const getAuthHeaders = async () => {
  if (!supabase) return {};
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) return {};
  return { Authorization: `Bearer ${session.access_token}` };
};

/**
 * Merged Browse + Discover panel.
 * Search by team tag/date (Browse) or auto-discover via confidence model (Discover).
 *
 * Props:
 *   division    — Division object
 *   tournament  — full tournament object
 *   tournamentId — string
 *   onImport(rawMaps) — parent calls addMapsInBatch with the raw map array
 *   onPostDiscovery(selected, summary) — optional; posts to Discord
 */
export default function ResultSearchPanel({ division, tournament, tournamentId, onImport, onPostDiscovery }) {
  // Browse state
  const [browseTag, setBrowseTag] = useState('');
  const [browseDateFrom, setBrowseDateFrom] = useState('');
  const [browseDateTo, setBrowseDateTo] = useState('');
  const [browseMapFilter, setBrowseMapFilter] = useState('');
  const [browseResults, setBrowseResults] = useState([]);
  const [browseLoading, setBrowseLoading] = useState(false);
  const [browseError, setBrowseError] = useState(null);
  const [browseSelected, setBrowseSelected] = useState(new Set());

  // Discover state
  const [discoverResults, setDiscoverResults] = useState(null);
  const [discoverLoading, setDiscoverLoading] = useState(false);
  const [discoverError, setDiscoverError] = useState(null);
  const [discoverSelected, setDiscoverSelected] = useState(new Set());

  const [activeTab, setActiveTab] = useState('browse');

  // --- Browse ---
  const handleBrowseSearch = async () => {
    if (!browseTag.trim()) return;
    setBrowseLoading(true);
    setBrowseError(null);
    setBrowseResults([]);
    setBrowseSelected(new Set());
    try {
      const opts = { limit: 30 };
      if (browseMapFilter) opts.map = browseMapFilter;
      if (browseDateFrom) {
        const monthsAgo = Math.ceil(
          (Date.now() - new Date(browseDateFrom).getTime()) / (30 * 24 * 60 * 60 * 1000)
        );
        if (monthsAgo > 0) opts.months = Math.min(monthsAgo + 1, 24);
      }
      const result = await QWStatsService.getForm(browseTag.trim(), opts);
      let games = result.games || [];
      if (browseDateFrom) {
        const from = new Date(browseDateFrom).getTime();
        games = games.filter((g) => new Date(g.playedAt).getTime() >= from);
      }
      if (browseDateTo) {
        const to = new Date(browseDateTo + 'T23:59:59').getTime();
        games = games.filter((g) => new Date(g.playedAt).getTime() <= to);
      }
      setBrowseResults(games);
    } catch (err) {
      setBrowseError(err.message);
    }
    setBrowseLoading(false);
  };

  const handleBrowseImport = () => {
    const selectedGames = browseResults.filter((_, i) => browseSelected.has(i));
    const teamTag = browseTag.trim().toLowerCase();
    const rawMaps = selectedGames.map((game) => {
      const team1 = teamTag;
      const team2 = (game.opponent || 'unknown').toLowerCase();
      const scores = { [team1]: game.teamFrags ?? 0, [team2]: game.oppFrags ?? 0 };
      let timestamp = null;
      try { if (game.playedAt) timestamp = new Date(game.playedAt).getTime(); } catch {}
      return {
        id: `browse-${game.id || game.demoSha256 || Date.now()}-${game.map}`,
        date: game.playedAt || null,
        timestamp,
        map: game.map || 'unknown',
        mode: '4on4',
        duration: null,
        teams: [team1, team2],
        matchupId: [team1, team2].sort().join('vs'),
        scores,
        originalData: game,
      };
    });
    onImport(rawMaps);
    setBrowseSelected(new Set());
  };

  // --- Discover ---
  const handleDiscover = async () => {
    setDiscoverLoading(true);
    setDiscoverError(null);
    setDiscoverResults(null);
    setDiscoverSelected(new Set());
    try {
      const mapPool = new Set();
      for (const div of tournament.divisions || []) {
        for (const match of div.schedule || []) {
          for (const map of match.maps || []) {
            if (map.map) mapPool.add(map.map);
          }
        }
      }
      if (mapPool.size === 0) {
        ['dm2', 'dm3', 'dm4', 'dm6', 'e1m2', 'aerowalk', 'ztndm3', 'skull'].forEach((m) =>
          mapPool.add(m)
        );
      }
      const config = {
        name: tournament.name || '',
        mode: tournament.mode || '4on4',
        startDate: tournament.startDate || '',
        endDate: tournament.endDate || '',
        mapPool: [...mapPool],
        tagPatterns: [],
        threshold: 0,
        divisions: [
          {
            id: division.id,
            name: division.name,
            teams: (division.teams || []).map((t) => ({
              name: t.name, tag: t.tag, aliases: t.aliases || [], players: t.players || '',
            })),
            schedule: (division.schedule || []).map((m) => ({
              team1: m.team1, team2: m.team2, date: m.date, bestOf: m.bestOf, status: m.status,
            })),
            isPlayoffs: division.format !== 'groups',
            bestOf: division.groupStageBestOf || 3,
          },
        ],
        aliasMap: {},
      };
      const authHeaders = await getAuthHeaders();
      const res = await fetch('/api/discover-games', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders },
        body: JSON.stringify({ config }),
      });
      const data = await res.json();
      if (!data.ok) throw new Error(data.error || 'Discovery failed');
      setDiscoverResults(data);
    } catch (err) {
      setDiscoverError(err.message);
    }
    setDiscoverLoading(false);
  };

  const handleDiscoverImport = () => {
    const candidates = discoverResults?.candidates || [];
    const rawMaps = [];
    for (const idx of discoverSelected) {
      const series = candidates[idx];
      if (!series) continue;
      for (const game of series.games) {
        const t1 = game.teams?.[0] || {};
        const t2 = game.teams?.[1] || {};
        const scores = { [series.team1]: t1.frags ?? 0, [series.team2]: t2.frags ?? 0 };
        let timestamp = null;
        try { if (game.timestamp) timestamp = new Date(game.timestamp).getTime(); } catch {}
        rawMaps.push({
          id: `discover-${game.id}-${game.map}`,
          date: game.timestamp || null,
          timestamp,
          map: game.map || 'unknown',
          mode: tournament.mode || '4on4',
          duration: null,
          teams: [series.team1, series.team2],
          matchupId: [series.team1, series.team2].sort().join('vs'),
          scores,
          originalData: game,
        });
      }
    }
    if (rawMaps.length > 0) {
      onImport(rawMaps);
      setDiscoverSelected(new Set());
    }
  };

  return (
    <div className="space-y-4">
      {/* Tab switcher */}
      <div className="flex gap-2">
        <button
          onClick={() => setActiveTab('browse')}
          className={`px-3 py-1.5 rounded text-sm font-semibold ${activeTab === 'browse' ? 'bg-qw-accent text-qw-dark' : 'bg-qw-panel border border-qw-border text-qw-muted hover:text-white'}`}
        >
          🔍 Browse
        </button>
        <button
          onClick={() => setActiveTab('discover')}
          className={`px-3 py-1.5 rounded text-sm font-semibold ${activeTab === 'discover' ? 'bg-qw-accent text-qw-dark' : 'bg-qw-panel border border-qw-border text-qw-muted hover:text-white'}`}
        >
          🎯 Discover
        </button>
      </div>

      {activeTab === 'browse' && (
        <div className="space-y-3">
          <p className="text-xs text-qw-muted">
            Search recent 4on4 games by team tag from the QW Stats API.
          </p>
          <div className="flex flex-wrap gap-3 items-end">
            <div className="flex-1 min-w-[140px]">
              <label className="block text-qw-muted text-xs mb-1">Team Tag *</label>
              <input
                type="text"
                value={browseTag}
                onChange={(e) => setBrowseTag(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleBrowseSearch()}
                placeholder="e.g. sr, def, fi"
                className="w-full bg-qw-darker border border-qw-border rounded px-3 py-2 text-white text-sm focus:border-qw-accent outline-none"
              />
            </div>
            <div>
              <label className="block text-qw-muted text-xs mb-1">From</label>
              <input type="date" value={browseDateFrom} onChange={(e) => setBrowseDateFrom(e.target.value)}
                className="bg-qw-darker border border-qw-border rounded px-3 py-2 text-white text-sm focus:border-qw-accent outline-none" />
            </div>
            <div>
              <label className="block text-qw-muted text-xs mb-1">To</label>
              <input type="date" value={browseDateTo} onChange={(e) => setBrowseDateTo(e.target.value)}
                className="bg-qw-darker border border-qw-border rounded px-3 py-2 text-white text-sm focus:border-qw-accent outline-none" />
            </div>
            <div>
              <label className="block text-qw-muted text-xs mb-1">Map</label>
              <select value={browseMapFilter} onChange={(e) => setBrowseMapFilter(e.target.value)}
                className="bg-qw-darker border border-qw-border rounded px-3 py-2 text-white text-sm focus:border-qw-accent outline-none">
                <option value="">All Maps</option>
                {['dm2', 'dm3', 'dm4', 'dm6', 'e1m2', 'aerowalk', 'ztndm3', 'skull'].map((m) => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
            </div>
            <button
              onClick={handleBrowseSearch}
              disabled={browseLoading || !browseTag.trim()}
              className="qw-btn px-6 py-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {browseLoading ? 'Searching...' : 'SEARCH'}
            </button>
          </div>

          {browseError && (
            <div className="p-3 bg-red-900/30 border border-red-500/50 rounded text-red-300 text-sm">{browseError}</div>
          )}

          {browseResults.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-qw-muted text-sm">{browseResults.length} game(s) found</span>
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => setBrowseSelected(
                      browseSelected.size === browseResults.length
                        ? new Set()
                        : new Set(browseResults.map((_, i) => i))
                    )}
                    className="text-sm text-qw-accent hover:text-white"
                  >
                    {browseSelected.size === browseResults.length ? 'Deselect All' : 'Select All'}
                  </button>
                  {browseSelected.size > 0 && (
                    <button onClick={handleBrowseImport} className="qw-btn px-4 py-1.5 text-sm">
                      Import Selected ({browseSelected.size})
                    </button>
                  )}
                </div>
              </div>
              <div className="space-y-2 max-h-[500px] overflow-y-auto">
                {browseResults.map((game, idx) => {
                  const isSelected = browseSelected.has(idx);
                  const isWin = game.result === 'win';
                  const isLoss = game.result === 'loss';
                  const dateStr = game.playedAt
                    ? new Date(game.playedAt).toLocaleDateString('sv-SE')
                    : '—';
                  return (
                    <div
                      key={game.id || idx}
                      onClick={() => {
                        const next = new Set(browseSelected);
                        if (next.has(idx)) next.delete(idx); else next.add(idx);
                        setBrowseSelected(next);
                      }}
                      className={`p-3 rounded border cursor-pointer transition-colors ${isSelected ? 'bg-qw-accent/10 border-qw-accent' : 'bg-qw-dark border-qw-border hover:border-qw-muted'}`}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-3 flex-1 min-w-0">
                          <input type="checkbox" checked={isSelected} readOnly className="accent-qw-accent flex-shrink-0" />
                          <span className="text-qw-muted text-xs font-mono w-20 flex-shrink-0">{dateStr}</span>
                          <span className="px-2 py-0.5 bg-qw-darker rounded text-xs font-mono text-qw-accent flex-shrink-0">{game.map || '?'}</span>
                          <span className="font-body font-semibold text-white truncate">{browseTag.trim().toLowerCase()}</span>
                          <span className="px-2 py-0.5 bg-qw-darker rounded font-mono text-sm flex-shrink-0">
                            <span className={isWin ? 'text-qw-win font-bold' : ''}>{game.teamFrags ?? '?'}</span>
                            <span className="text-qw-muted mx-1">-</span>
                            <span className={isLoss ? 'text-qw-win font-bold' : ''}>{game.oppFrags ?? '?'}</span>
                          </span>
                          <span className="font-body font-semibold text-white truncate">{game.opponent || '?'}</span>
                        </div>
                        <span className={`text-xs font-semibold px-2 py-0.5 rounded flex-shrink-0 ${isWin ? 'bg-qw-win/20 text-qw-win' : isLoss ? 'bg-qw-loss/20 text-qw-loss' : 'bg-qw-darker text-qw-muted'}`}>
                          {isWin ? 'W' : isLoss ? 'L' : 'D'}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {activeTab === 'discover' && (
        <div className="space-y-3">
          <p className="text-xs text-qw-muted">
            Automatically find games for this division's scheduled matchups using the QW Stats API.
            Uses the confidence model to score each candidate (roster, schedule, matchtag, series format).
          </p>
          <button
            onClick={handleDiscover}
            disabled={discoverLoading || (division.teams || []).length === 0}
            className="qw-btn px-6 py-2 disabled:opacity-50"
          >
            {discoverLoading ? 'Scanning...' : 'Discover Games'}
          </button>

          {discoverError && (
            <div className="p-3 bg-red-900/30 border border-red-500/50 rounded text-red-300 text-sm">{discoverError}</div>
          )}

          {discoverResults && (
            <div className="space-y-4">
              <div className="flex flex-wrap gap-4 text-sm">
                <span className="text-qw-muted">Scanned: <span className="text-white font-mono">{discoverResults.summary?.scanned || 0}</span></span>
                <span className="text-qw-muted">Passed gates: <span className="text-qw-win font-mono">{discoverResults.summary?.passed || 0}</span></span>
                <span className="text-qw-muted">Series: <span className="text-qw-accent font-mono">{discoverResults.candidates?.length || 0}</span></span>
              </div>

              {(discoverResults.candidates || []).length > 0 && (
                <>
                  <div className="flex items-center justify-between">
                    <button
                      onClick={() => setDiscoverSelected(
                        discoverSelected.size === discoverResults.candidates.length
                          ? new Set()
                          : new Set(discoverResults.candidates.map((_, i) => i))
                      )}
                      className="text-sm text-qw-accent hover:text-white"
                    >
                      {discoverSelected.size === discoverResults.candidates.length ? 'Deselect All' : 'Select All'}
                    </button>
                    <div className="flex gap-2">
                      {discoverSelected.size > 0 && (
                        <>
                          <button onClick={handleDiscoverImport} className="qw-btn px-4 py-1.5 text-sm">
                            Import Selected ({discoverSelected.size} series,{' '}
                            {[...discoverSelected].reduce((sum, idx) => sum + ((discoverResults.candidates[idx]?.games?.length) || 0), 0)}{' '}
                            maps)
                          </button>
                          {onPostDiscovery && (
                            <button
                              onClick={() => {
                                const selected = [...discoverSelected].map((idx) => discoverResults.candidates[idx]).filter(Boolean);
                                onPostDiscovery(selected, discoverResults.summary);
                              }}
                              className="qw-btn-secondary px-4 py-1.5 text-sm"
                              title="Post selected candidates to Discord"
                            >
                              Post to Discord
                            </button>
                          )}
                        </>
                      )}
                    </div>
                  </div>

                  <div className="space-y-2 max-h-[600px] overflow-y-auto">
                    {discoverResults.candidates.map((series, idx) => {
                      const isSelected = discoverSelected.has(idx);
                      const conf = series.avgConfidence || 0;
                      const confColor = conf >= 80 ? 'text-qw-win' : conf >= 50 ? 'text-amber-300' : 'text-qw-loss';
                      const confBg = conf >= 80 ? 'bg-qw-win/15 border-qw-win/30' : conf >= 50 ? 'bg-amber-500/15 border-amber-500/30' : 'bg-qw-loss/15 border-qw-loss/30';
                      return (
                        <div
                          key={`${series.team1}-${series.team2}-${idx}`}
                          onClick={() => {
                            const next = new Set(discoverSelected);
                            if (next.has(idx)) next.delete(idx); else next.add(idx);
                            setDiscoverSelected(next);
                          }}
                          className={`p-3 rounded border cursor-pointer transition-colors ${isSelected ? 'bg-qw-accent/10 border-qw-accent' : 'bg-qw-dark border-qw-border hover:border-qw-muted'}`}
                        >
                          <div className="flex items-center justify-between gap-3">
                            <div className="flex items-center gap-3 flex-1 min-w-0">
                              <input type="checkbox" checked={isSelected} readOnly className="accent-qw-accent flex-shrink-0" />
                              <span className="font-body font-semibold text-white truncate">{series.team1}</span>
                              <span className="text-qw-muted text-xs">vs</span>
                              <span className="font-body font-semibold text-white truncate">{series.team2}</span>
                            </div>
                            <div className="flex items-center gap-3 flex-shrink-0">
                              <span className="text-xs text-qw-muted">{series.mapCount} map{series.mapCount !== 1 ? 's' : ''}</span>
                              <span className={`px-2 py-0.5 rounded text-xs font-bold ${confBg} ${confColor}`}>{conf}%</span>
                            </div>
                          </div>
                          <div className="mt-2 flex flex-wrap gap-2">
                            {(series.games || []).map((game, gi) => {
                              const t1 = game.teams?.[0] || {};
                              const t2 = game.teams?.[1] || {};
                              const dateStr = game.timestamp ? new Date(game.timestamp).toLocaleDateString('sv-SE') : '';
                              return (
                                <div key={gi} className="flex items-center gap-2 text-xs bg-qw-darker px-2 py-1 rounded">
                                  <span className="text-qw-accent font-mono">{game.map}</span>
                                  <span className="font-mono">
                                    <span className={(t1.frags ?? 0) > (t2.frags ?? 0) ? 'text-qw-win' : 'text-white'}>{t1.frags ?? '?'}</span>
                                    <span className="text-qw-muted">-</span>
                                    <span className={(t2.frags ?? 0) > (t1.frags ?? 0) ? 'text-qw-win' : 'text-white'}>{t2.frags ?? '?'}</span>
                                  </span>
                                  {dateStr && <span className="text-qw-muted">{dateStr}</span>}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </>
              )}

              {(discoverResults.candidates || []).length === 0 && (
                <p className="text-qw-muted text-sm">
                  No matching games found. Make sure teams are set up and the tournament date range covers the period games were played.
                </p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
