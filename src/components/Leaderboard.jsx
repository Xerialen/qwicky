// src/components/Leaderboard.jsx
// Leaderboard UI — consumes /api/stats?action=leaderboard via statsService.

import React, { useState, useEffect, useCallback } from 'react';
import { fetchLeaderboard } from '../services/statsService';

const MODES = [
  { value: '4on4', label: '4on4' },
  { value: '2on2', label: '2on2' },
  { value: '1on1', label: '1on1' },
];

const STATS = [
  { value: 'damage_given', label: 'Damage Given' },
  { value: 'frags', label: 'Avg Frags' },
  { value: 'damage_enemy_weapons', label: 'EWEP' },
  { value: 'rl_kills_enemy', label: 'RL Enemy Kills' },
  { value: 'lg_pct', label: 'LG%' },
  { value: 'kills', label: 'Kills' },
  { value: 'deaths', label: 'Deaths' },
  { value: 'damage_taken', label: 'Damage Taken' },
  { value: 'taken_to_die', label: 'Taken to Die' },
  { value: 'rl_hits', label: 'RL Hits' },
  { value: 'rl_dropped', label: 'RL Dropped' },
  { value: 'rl_picked_up', label: 'RL Picked Up' },
  { value: 'lg_kills_enemy', label: 'LG Enemy Kills' },
  { value: 'lg_dropped', label: 'LG Dropped' },
  { value: 'quad_pickups', label: 'Quad Pickups' },
  { value: 'pent_pickups', label: 'Pent Pickups' },
  { value: 'ra_pickups', label: 'RA Pickups' },
  { value: 'ya_pickups', label: 'YA Pickups' },
  { value: 'ga_pickups', label: 'GA Pickups' },
  { value: 'mh_pickups', label: 'MH Pickups' },
];

const PERIODS = [
  { value: 'all', label: 'All-time' },
  { value: '30d', label: 'Last 30 days' },
  { value: '7d', label: 'Last 7 days' },
];

function SegmentControl({ options, value, onChange }) {
  return (
    <div className="flex rounded overflow-hidden border border-qw-border">
      {options.map((opt) => (
        <button
          key={opt.value}
          onClick={() => onChange(opt.value)}
          className={`px-3 py-1.5 text-xs font-medium transition-colors ${
            value === opt.value
              ? 'bg-qw-accent text-qw-darker'
              : 'text-qw-muted hover:text-white bg-qw-dark'
          }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

export default function Leaderboard() {
  const [mode, setMode] = useState('4on4');
  const [stat, setStat] = useState('damage_given');
  const [period, setPeriod] = useState('all');
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await fetchLeaderboard({ mode, stat, period, limit: 25 });
      setRows(result?.data ?? []);
    } catch (err) {
      setError(err.message);
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [mode, stat, period]);

  useEffect(() => {
    load();
  }, [load]);

  const statLabel = STATS.find((s) => s.value === stat)?.label ?? stat;
  const isPercent = stat === 'lg_pct';

  const formatValue = (v) => {
    if (v == null) return '—';
    if (isPercent) return `${v}%`;
    return v;
  };

  return (
    <div className="space-y-4 animate-fade-in">
      {/* Controls */}
      <div className="flex flex-wrap items-center gap-3">
        <SegmentControl options={MODES} value={mode} onChange={setMode} />
        <SegmentControl options={PERIODS} value={period} onChange={setPeriod} />

        <select
          value={stat}
          onChange={(e) => setStat(e.target.value)}
          className="bg-qw-dark border border-qw-border text-qw-text text-xs rounded px-2 py-1.5 focus:outline-none focus:border-qw-accent"
        >
          {STATS.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </select>
      </div>

      {/* Table */}
      <div className="qw-panel overflow-hidden">
        {loading && (
          <div className="flex items-center justify-center py-16 gap-3">
            <div className="w-5 h-5 border-2 border-qw-border border-t-qw-accent rounded-full animate-spin" />
            <span className="text-qw-muted text-sm">Loading…</span>
          </div>
        )}

        {!loading && error && (
          <div className="py-12 text-center">
            <p className="text-qw-loss text-sm mb-3">{error}</p>
            <button onClick={load} className="qw-btn text-xs">
              Retry
            </button>
          </div>
        )}

        {!loading && !error && rows.length === 0 && (
          <div className="py-16 text-center">
            <div className="text-5xl mb-3">📊</div>
            <p className="text-qw-muted text-sm">No data for these filters.</p>
            <p className="text-qw-muted text-xs mt-1">
              Try a longer time period or different mode.
            </p>
          </div>
        )}

        {!loading && !error && rows.length > 0 && (
          <table className="w-full">
            <thead>
              <tr className="bg-qw-dark border-b border-qw-border">
                <th className="w-12 px-4 py-2.5 text-center text-xs font-medium text-qw-muted">
                  #
                </th>
                <th className="px-4 py-2.5 text-left   text-xs font-medium text-qw-muted">
                  Player
                </th>
                <th className="w-20 px-4 py-2.5 text-center text-xs font-medium text-qw-muted">
                  Games
                </th>
                <th className="w-28 px-4 py-2.5 text-right  text-xs font-medium text-qw-accent">
                  {statLabel}
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, idx) => {
                const player = row.player ?? row[0];
                const games = row.games ?? row[1];
                const value = row.value ?? row[2];
                const isFirst = idx === 0;
                return (
                  <tr
                    key={`${player}-${idx}`}
                    className={`border-b border-qw-border/40 transition-colors hover:bg-qw-accent/5 ${
                      isFirst ? 'bg-qw-accent/10' : ''
                    }`}
                  >
                    <td className="px-4 py-2 text-center font-mono text-xs text-qw-muted">
                      {isFirst ? <span className="text-qw-accent font-bold">1</span> : idx + 1}
                    </td>
                    <td className="px-4 py-2 font-medium text-sm text-qw-text">{player}</td>
                    <td className="px-4 py-2 text-center font-mono text-xs text-qw-muted">
                      {games}
                    </td>
                    <td className="px-4 py-2 text-right font-mono text-sm font-semibold text-qw-text">
                      {formatValue(value)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
