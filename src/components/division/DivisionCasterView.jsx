// src/components/division/DivisionCasterView.jsx
import React, { useState, useMemo } from 'react';
import {
  normalizeTeam,
  calculateHeadToHead,
  analyzeCommonOpponents,
  analyzeRecentForm,
  calculateMapStats,
  calculatePlayerStats,
  getPlayerSpotlight,
  generateCasterInsights,
  getMomentumLabel,
  getMomentumColor,
} from '../../utils/casterStats';
import QWStatsService from '../../services/QWStatsService';

// ─── Sub-components ───────────────────────────────────────────────────────────

const TrendArrow = ({ trend }) => (
  <span className={`text-sm ${
    trend === 'rising'  ? 'text-qw-win'  :
    trend === 'falling' ? 'text-qw-loss' :
    'text-qw-muted'
  }`}>
    {trend === 'rising' ? '↗' : trend === 'falling' ? '↘' : '→'}
  </span>
);

// Prominent streak badge — shown when streak >= 3
const StreakBadge = ({ streak, type }) => {
  if (!streak || streak < 3) return null;
  const isWin = type === 'W';
  return (
    <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded font-display font-bold text-xs mt-2 ${
      isWin
        ? 'bg-qw-win/20 text-qw-win border border-qw-win/40'
        : 'bg-qw-loss/20 text-qw-loss border border-qw-loss/40'
    }`}>
      <span>{isWin ? '🔥' : '❄️'}</span>
      {streak}-{isWin ? 'WIN' : 'LOSS'} STREAK
    </div>
  );
};

// Map result card — shows W/L result, map name, score and opponent on hover
const MapResultCard = ({ result }) => {
  const cls =
    result.result === 'W' ? 'bg-qw-win/20 text-qw-win border-qw-win/30' :
    result.result === 'L' ? 'bg-qw-loss/20 text-qw-loss border-qw-loss/30' :
    'bg-qw-border/20 text-qw-muted border-qw-border/30';
  return (
    <div
      title={`vs ${result.opponent || '?'} · ${result.map} · ${result.sf} – ${result.sa}`}
      className={`flex flex-col items-center justify-center rounded p-2 text-xs font-mono border cursor-default ${cls}`}
    >
      <span className="font-bold text-sm">{result.result}</span>
      <span className="text-[10px] opacity-80 truncate max-w-full" title={result.map}>{result.map}</span>
      <span className="text-[10px] opacity-60">{result.sf} – {result.sa}</span>
      {result.opponent && (
        <span className="text-[9px] opacity-50 truncate max-w-full">vs {result.opponent}</span>
      )}
    </div>
  );
};

// Tournament / Global toggle
const TabToggle = ({ value, onChange, disabled }) => (
  <div className="flex rounded overflow-hidden border border-qw-border text-xs font-display">
    {['tournament', 'global'].map(v => (
      <button
        key={v}
        onClick={() => !disabled && onChange(v)}
        disabled={disabled}
        className={`px-2.5 py-1 transition-colors capitalize ${
          value === v
            ? 'bg-qw-accent text-qw-dark font-bold'
            : 'bg-qw-border text-qw-muted hover:text-white'
        } disabled:opacity-40 disabled:cursor-not-allowed`}
      >
        {v === 'global' ? '🌍 Global' : 'Tournament'}
      </button>
    ))}
  </div>
);

// Always-visible quick-glance bar at the top of the analysis view
const QuickGlance = ({ team1, team2, h2h, form1, form2, mapStats1, mapStats2 }) => {
  let h2hText;
  if (h2h.totalMaps === 0) {
    h2hText = 'First meeting';
  } else if (h2h.team1Wins > h2h.team2Wins) {
    h2hText = `${team1} leads ${h2h.team1Wins}–${h2h.team2Wins}`;
  } else if (h2h.team2Wins > h2h.team1Wins) {
    h2hText = `${team2} leads ${h2h.team2Wins}–${h2h.team1Wins}`;
  } else {
    h2hText = `Even ${h2h.team1Wins}–${h2h.team2Wins}`;
  }

  const bestMap = (stats) => {
    if (!stats) return null;
    const entries = Object.entries(stats).filter(([, s]) => s.played >= 2);
    if (entries.length === 0) return null;
    return entries.sort((a, b) => b[1].winRate - a[1].winRate)[0][0];
  };

  const bm1 = bestMap(mapStats1);
  const bm2 = bestMap(mapStats2);

  const items = [
    { label: 'H2H', value: h2hText },
    { label: `${team1} form`, value: getMomentumLabel(form1.momentum), color: getMomentumColor(form1.momentum) },
    { label: `${team2} form`, value: getMomentumLabel(form2.momentum), color: getMomentumColor(form2.momentum) },
    bm1 && { label: `${team1} best map`, value: bm1, color: 'text-qw-win' },
    bm2 && { label: `${team2} best map`, value: bm2, color: 'text-qw-win' },
  ].filter(Boolean);

  return (
    <div className="qw-panel p-3 flex flex-wrap gap-x-5 gap-y-1.5">
      {items.map(({ label, value, color }) => (
        <div key={label} className="flex items-baseline gap-1.5 text-xs">
          <span className="text-qw-muted">{label}:</span>
          <span className={`font-semibold ${color || 'text-white'}`}>{value}</span>
        </div>
      ))}
    </div>
  );
};

const PlayerRow = ({ player }) => {
  const trendColor =
    player.trend === 'hot'  ? 'text-qw-win'  :
    player.trend === 'cold' ? 'text-qw-loss' :
    'text-qw-muted';
  const trendIcon = player.trend === 'hot' ? '▲' : player.trend === 'cold' ? '▼' : '—';
  return (
    <div className="flex items-center gap-2 py-1.5 text-xs border-b border-qw-border/20 last:border-0">
      <div className="flex-1 min-w-0">
        <div className="text-white truncate">{player.name}</div>
        <div className="text-qw-muted text-[10px] truncate">{player.team}</div>
      </div>
      <div className="text-right flex-shrink-0">
        <div className="font-mono font-bold text-white">{player.kdRatio}</div>
        <div className="text-[10px] text-qw-muted">{player.fragsPerMap}/map</div>
      </div>
      <span className={`text-sm flex-shrink-0 ${trendColor}`}>{trendIcon}</span>
    </div>
  );
};

// ─── Detailed player stats sub-components ────────────────────────────────────

function StatCell({ label, value, suffix, color }) {
  return (
    <div>
      <div className="text-qw-muted text-[9px] uppercase tracking-wide">{label}</div>
      <div className={`font-mono font-bold ${color || 'text-white'}`}>
        {value}{suffix && <span className="text-qw-muted font-normal text-[9px]">{suffix}</span>}
      </div>
    </div>
  );
}

function WeaponRow({ label, taken, kills, dropped, acc }) {
  return (
    <div className="flex items-center gap-1 text-[11px] font-mono">
      <span className="text-qw-accent font-display font-bold w-6">{label}</span>
      <span className="text-qw-muted" title="Taken (weapon pickups)">T:</span>
      <span className="text-white w-6">{taken}</span>
      <span className="text-qw-muted" title="Kills (enemies killed holding this weapon)">K:</span>
      <span className="text-qw-win w-6">{kills}</span>
      <span className="text-qw-muted" title="Dropped (died while holding)">D:</span>
      <span className="text-qw-loss w-6">{dropped}</span>
      {acc !== undefined && acc > 0 && (
        <>
          <span className="text-qw-muted ml-1">Acc:</span>
          <span className={acc >= 25 ? 'text-qw-win' : acc >= 18 ? 'text-yellow-400' : 'text-qw-muted'}>{acc}%</span>
        </>
      )}
    </div>
  );
}

function DetailedPlayerCard({ player, globalStats }) {
  const trendColor =
    player.trend === 'hot'  ? 'text-qw-win'  :
    player.trend === 'cold' ? 'text-qw-loss' :
    'text-qw-muted';
  const trendLabel = player.trend === 'hot' ? 'HOT' : player.trend === 'cold' ? 'COLD' : null;
  const trendIcon = player.trend === 'hot' ? '▲' : player.trend === 'cold' ? '▼' : null;

  return (
    <div className="rounded border border-qw-border/30 bg-qw-dark/40 p-3 space-y-2">
      {/* Header: name + trend + maps */}
      <div className="flex items-center justify-between">
        <div className="font-semibold text-white text-sm truncate">{player.name}</div>
        <div className="flex items-center gap-1.5 flex-shrink-0">
          {trendLabel && (
            <span className={`text-[10px] font-display font-bold ${trendColor}`}>
              {trendIcon} {trendLabel}
            </span>
          )}
          <span className="text-qw-muted text-[10px]">{player.mapsPlayed} maps</span>
        </div>
      </div>

      {/* Global stats overlay — shown when global API data is available */}
      {globalStats && (
        <div className="flex items-center gap-3 text-[10px] bg-qw-border/10 rounded px-2 py-1">
          <span className="text-qw-muted">🌍</span>
          {globalStats.eff != null && (
            <span className="text-qw-muted">Eff: <span className={
              globalStats.eff >= 50 ? 'text-qw-win font-bold' :
              globalStats.eff < 40  ? 'text-qw-loss' :
              'text-yellow-400'
            }>{globalStats.eff.toFixed(1)}%</span></span>
          )}
          {globalStats.avgDmg != null && (
            <span className="text-qw-muted">Dmg: <span className="text-white">{globalStats.avgDmg}</span></span>
          )}
          {globalStats.winRatePct != null && (
            <span className="text-qw-muted">Win: <span className="text-white">{globalStats.winRatePct}%</span></span>
          )}
          <span className="text-qw-muted">{globalStats.games}G</span>
        </div>
      )}

      {/* Core stats */}
      <div className="grid grid-cols-3 gap-x-3 gap-y-1 text-[11px]">
        <StatCell label="Frags" value={player.fragsPerMap} suffix="/map" />
        <StatCell label="K/D" value={player.kdRatio} color={player.kdRatio >= 1 ? 'text-qw-win' : 'text-qw-loss'} />
        <StatCell label="Eff" value={`${player.effPct}%`} color={player.effPct >= 50 ? 'text-qw-win' : player.effPct >= 40 ? 'text-yellow-400' : 'text-qw-loss'} />
        <StatCell label="Damage" value={player.avgDmg} />
        <StatCell label="ToDie" value={player.avgToDie} />
        <StatCell label="Speed" value={player.avgSpeed} />
      </div>

      {/* Weapon stats: RL & LG Taken / Kills / Dropped */}
      {player.hasDetailedStats && (
        <div className="border-t border-qw-border/20 pt-2 space-y-1">
          <WeaponRow label="RL" taken={player.rlTaken} kills={player.rlKills} dropped={player.rlDrop} />
          <WeaponRow label="LG" taken={player.lgTaken} kills={player.lgKills} dropped={player.lgDrop} acc={player.lgAcc} />
        </div>
      )}

      {/* Map control items */}
      {(player.ra > 0 || player.quad > 0) && (
        <div className="flex gap-3 text-[10px] text-qw-muted border-t border-qw-border/20 pt-1.5">
          {player.ra > 0 && <span>RA: <span className="text-white font-mono">{player.ra}</span>/opp</span>}
          {player.quad > 0 && <span>Quad: <span className="text-qw-accent font-mono">{player.quad}</span>/opp</span>}
        </div>
      )}
    </div>
  );
}

// ─── External API panels (defensive — API shape is not guaranteed) ────────────

const GlobalBadge = () => (
  <span className="ml-2 text-[10px] text-qw-muted font-normal normal-case tracking-normal">🌍 Global</span>
);

function ExtH2HPanel({ data, tag1 }) {
  const rows = Array.isArray(data) ? data : (data?.matches || data?.games || []);
  if (rows.length === 0) return <p className="text-qw-muted text-xs italic">No global H2H data found.</p>;
  const tag1Lower = tag1.toLowerCase();
  let wins1 = 0;

  const matches = rows.map(r => {
    const team = (r.team || r.teamA || '').toLowerCase();
    const result = (r.result || '').toUpperCase();
    const tag1Won = team === tag1Lower ? result === 'W' : result === 'L';
    if (tag1Won) wins1++;

    // Defensive: try common field names for map, date, scores
    const map = r.map || r.mapName || '';
    const rawDate = r.date || r.played_at || r.timestamp || '';
    const dateMatch = typeof rawDate === 'string' ? rawDate.match(/(\d{4}-\d{2}-\d{2})/) : null;
    const date = dateMatch ? dateMatch[1] : (typeof rawDate === 'string' ? rawDate.slice(0, 10) : '');

    return {
      map,
      date,
      score1: r.score1 ?? r.frags_for ?? r.scoreFor ?? null,
      score2: r.score2 ?? r.frags_against ?? r.scoreAgainst ?? null,
      tag1Won,
    };
  });

  const wins2 = rows.length - wins1;
  const hasMapInfo = matches.some(m => m.map);

  return (
    <div>
      {/* Summary score */}
      <div className="text-xs font-mono mb-2">
        <span className={wins1 > wins2 ? 'text-qw-win font-bold' : 'text-white'}>{wins1}</span>
        <span className="text-qw-muted"> – </span>
        <span className={wins2 > wins1 ? 'text-qw-win font-bold' : 'text-white'}>{wins2}</span>
        <span className="text-qw-muted ml-2">({rows.length} maps, 12 months)</span>
      </div>

      {/* Per-match breakdown */}
      {hasMapInfo && (
        <div className="space-y-0.5 max-h-48 overflow-y-auto">
          {matches.map((m, i) => (
            <div key={i} className="flex items-center gap-2 text-xs font-mono text-qw-muted">
              {m.date && (
                <span className="w-20 text-[10px] opacity-50 flex-shrink-0">{m.date}</span>
              )}
              <span className="w-12 text-qw-text flex-shrink-0" title={m.map}>{m.map || '—'}</span>
              {m.score1 != null && m.score2 != null ? (
                <>
                  <span className={m.tag1Won ? 'text-qw-win font-bold' : ''}>{m.score1}</span>
                  <span>–</span>
                  <span className={!m.tag1Won ? 'text-qw-win font-bold' : ''}>{m.score2}</span>
                </>
              ) : (
                <span className={m.tag1Won ? 'text-qw-win' : 'text-qw-loss'}>{m.tag1Won ? 'W' : 'L'}</span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ExtLoadingOverlay() {
  return (
    <div className="mt-3 flex items-center gap-2 text-qw-muted text-xs">
      <span className="inline-block w-3 h-3 border border-qw-accent border-t-transparent rounded-full animate-spin flex-shrink-0" />
      Loading global stats…
    </div>
  );
}

// ─── Data normalization helpers ───────────────────────────────────────────────

// Returns { wins, losses, total, winRatePct } or null
function normalizeExtForm(data) {
  if (!data) return null;
  const rows = Array.isArray(data) ? data : (data?.matches || data?.games || []);
  if (rows.length === 0) return null;
  const wins   = rows.filter(r => (r.result || '').toUpperCase() === 'W').length;
  const losses = rows.filter(r => (r.result || '').toUpperCase() === 'L').length;
  const total  = rows.length;
  return { wins, losses, total, winRatePct: total > 0 ? Math.round((wins / total) * 100) : 0 };
}

// Returns { [mapName]: { wins, losses, played, winRate, avgFragDiff } } or {}
// NOTE: API winRate is 0–100; converted to 0–1 fraction here to match local convention
function normalizeExtMaps(data) {
  const mapArray = data?.maps || (Array.isArray(data) ? data : []);
  if (mapArray.length === 0) return {};
  const result = {};
  for (const entry of mapArray) {
    const name = entry?.map;
    if (!name) continue;
    result[name] = {
      wins:        entry.wins        ?? 0,
      losses:      entry.losses      ?? 0,
      played:      entry.games       ?? ((entry.wins ?? 0) + (entry.losses ?? 0)),
      winRate:     entry.winRate != null ? entry.winRate / 100 : 0,
      avgFragDiff: entry.avgFragDiff ?? 0,
    };
  }
  return result;
}

// Returns [{ name, games, wins, winRatePct, eff, avgDmg }] or []
function normalizeExtRoster(data) {
  const players = Array.isArray(data) ? data : (data?.players || data?.roster || []);
  return players.map(p => ({
    name:       p.player || p.name || p.nick || '?',
    games:      p.games   ?? 0,
    wins:       p.wins    ?? 0,
    winRatePct: p.winRate ?? 0,
    eff:        p.eff     ?? null,
    avgDmg:     p.avgDmg  ?? null,
  }));
}

// ─── Comparison sub-components ────────────────────────────────────────────────

// Inline delta badge appended to the Momentum line in Recent Form
function FormDeltaBadge({ localForm, extFormData, extLoading }) {
  if (extLoading) return (
    <span className="ml-2 inline-flex items-center gap-1 text-[10px] text-qw-muted">
      <span className="inline-block w-2.5 h-2.5 border border-qw-accent border-t-transparent rounded-full animate-spin" />
    </span>
  );
  const extNorm = normalizeExtForm(extFormData);
  if (!extNorm) return null;
  const localTotal = localForm.wins + localForm.losses;
  if (localTotal === 0) return null;
  const localPct = Math.round(localForm.wins / localTotal * 100);
  const delta = localPct - extNorm.winRatePct;
  const isNeutral = Math.abs(delta) < 3;
  const deltaColor = isNeutral ? 'text-qw-muted' : delta > 0 ? 'text-qw-win' : 'text-qw-loss';
  const deltaText = isNeutral ? '±0%' : `${delta > 0 ? '+' : ''}${delta}%`;
  return (
    <span className="ml-3 inline-flex items-center gap-1 text-[10px] font-mono text-qw-muted">
      <span>Tournament: <span className="text-white">{localPct}%</span></span>
      <span>·</span>
      <span>Global: <span className="text-white">{extNorm.winRatePct}%</span></span>
      <span>·</span>
      <span className={`font-bold ${deltaColor}`}>{deltaText}</span>
      <span className="text-qw-muted/50 ml-0.5">🌍</span>
    </span>
  );
}

// Map performance rows for one team, with tournament/global toggle
function MapStatsPanel({ stats, extMapsData, extLoading, showGlobal }) {
  if (showGlobal) {
    const extStats = normalizeExtMaps(extMapsData);
    if (Object.keys(extStats).length === 0) {
      if (extLoading) return <ExtLoadingOverlay />;
      return <p className="text-qw-muted text-xs italic">No global map data.</p>;
    }
    return (
      <div className="space-y-2">
        {Object.entries(extStats)
          .sort((a, b) => b[1].played - a[1].played)
          .map(([mapName, es]) => {
            const localWR = stats?.[mapName]?.winRate ?? null;
            const delta = localWR !== null
              ? Math.round((localWR - es.winRate) * 100)
              : null;
            const deltaClass = delta === null ? 'text-qw-muted'
              : Math.abs(delta) < 3 ? 'text-qw-muted'
              : delta > 0 ? 'text-qw-win' : 'text-qw-loss';
            const deltaText = delta === null ? '—'
              : Math.abs(delta) < 3 ? '±0%'
              : `${delta > 0 ? '+' : ''}${delta}%`;
            return (
              <div key={mapName} className="space-y-0.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-mono text-qw-text" title={mapName}>{mapName}</span>
                  <div className="flex items-center gap-2 font-mono flex-shrink-0">
                    <span className="text-qw-muted">{es.wins}W–{es.losses}L</span>
                    <span className={`w-8 text-right ${es.winRate >= 0.5 ? 'text-qw-win' : 'text-qw-loss'}`}>
                      {Math.round(es.winRate * 100)}%
                    </span>
                    <span className="text-qw-muted text-[10px]">{es.played}G</span>
                    <span
                      className={`w-10 text-right text-[10px] ${deltaClass}`}
                      title="Tournament vs Global win rate (Δ)"
                    >
                      {deltaText}
                    </span>
                  </div>
                </div>
                <div className="h-1.5 bg-qw-border rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full ${es.winRate >= 0.5 ? 'bg-qw-win' : 'bg-qw-loss'}`}
                    style={{ width: `${Math.round(es.winRate * 100)}%` }}
                  />
                </div>
              </div>
            );
          })}
        <p className="text-[10px] text-qw-muted mt-1">Δ = Tournament vs. Global win rate</p>
      </div>
    );
  }

  // Tournament mode
  if (!stats || Object.keys(stats).length === 0) {
    return (
      <>
        <p className="text-qw-muted text-xs italic">No map data.</p>
        {extLoading && <ExtLoadingOverlay />}
      </>
    );
  }
  return (
    <div className="space-y-2">
      {Object.entries(stats)
        .sort((a, b) => b[1].played - a[1].played)
        .map(([mapName, s]) => (
          <div key={mapName} className="space-y-0.5">
            <div className="flex items-center justify-between text-xs">
              <span className="font-mono text-qw-text" title={mapName}>{mapName}</span>
              <div className="flex items-center gap-3 font-mono flex-shrink-0">
                <span className="text-qw-muted">{s.wins}W–{s.losses}L</span>
                <span className={`w-8 text-right ${s.winRate >= 0.5 ? 'text-qw-win' : 'text-qw-loss'}`}>
                  {Math.round(s.winRate * 100)}%
                </span>
                <span
                  className={`w-10 text-right ${s.avgFragDiff >= 0 ? 'text-qw-win' : 'text-qw-loss'}`}
                  title="Average frag differential"
                >
                  {s.avgFragDiff >= 0 ? '+' : ''}{s.avgFragDiff}
                </span>
              </div>
            </div>
            <div className="h-1.5 bg-qw-border rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${s.winRate >= 0.5 ? 'bg-qw-win' : 'bg-qw-loss'}`}
                style={{ width: `${Math.round(s.winRate * 100)}%` }}
              />
            </div>
          </div>
        ))}
    </div>
  );
}

// Single merged player row used in global spotlight view
function MergedPlayerRow({ extPlayer, localPlayer }) {
  const effColor = extPlayer.eff == null ? 'text-qw-muted'
    : extPlayer.eff >= 50 ? 'text-qw-win'
    : extPlayer.eff < 40  ? 'text-qw-loss'
    : 'text-yellow-400';
  return (
    <div className="flex items-center gap-2 py-1.5 text-xs border-b border-qw-border/20 last:border-0">
      <div className="flex-1 min-w-0">
        <div className="text-white truncate">{extPlayer.name}</div>
        <div className="text-qw-muted text-[10px]">{extPlayer.games}G global</div>
      </div>
      <div className="text-right flex-shrink-0 space-y-0.5">
        {extPlayer.eff != null && (
          <div className={`font-mono font-bold ${effColor}`}>{extPlayer.eff.toFixed(1)}% eff</div>
        )}
        {localPlayer && (
          <div className="text-[10px] text-qw-muted font-mono">
            K/D:{' '}
            <span className={localPlayer.kdRatio >= 1 ? 'text-qw-win' : 'text-qw-loss'}>
              {localPlayer.kdRatio}
            </span>
            {' '}
            {localPlayer.trend === 'hot'  ? <span className="text-qw-win">▲</span>
            : localPlayer.trend === 'cold' ? <span className="text-qw-loss">▼</span>
            : null}
          </div>
        )}
      </div>
    </div>
  );
}

// Player spotlight card — tournament mode shows hot/struggling, global shows roster eff
function PlayerSpotlightCard({ spotlight, team1, team2, extRoster1, extRoster2, extLoading, showGlobal }) {
  if (!showGlobal) {
    const allPlayers = spotlight.allPlayers || [];
    const hasDetailed = allPlayers.some(p => p.hasDetailedStats);

    // If no detailed ktxstats data, fall back to the simple Hot Hands / Under Pressure view
    if (!hasDetailed) {
      return (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <div className="text-xs text-qw-win font-display uppercase tracking-wider mb-2">Hot Hands</div>
            {spotlight.hotHands.length === 0
              ? <p className="text-qw-muted text-xs italic">Not enough data</p>
              : spotlight.hotHands.map(p => <PlayerRow key={p.name} player={p} />)
            }
          </div>
          <div>
            <div className="text-xs text-qw-loss font-display uppercase tracking-wider mb-2">Under Pressure</div>
            {spotlight.struggling.length === 0
              ? <p className="text-qw-muted text-xs italic">Not enough data</p>
              : spotlight.struggling.map(p => <PlayerRow key={p.name} player={p} />)
            }
          </div>
        </div>
      );
    }

    // Detailed view: per-team columns with full weapon/damage/item stats
    const t1n = normalizeTeam(team1);
    const t2n = normalizeTeam(team2);
    const team1Players = allPlayers
      .filter(p => normalizeTeam(p.team) === t1n)
      .sort((a, b) => b.fragsPerMap - a.fragsPerMap);
    const team2Players = allPlayers
      .filter(p => normalizeTeam(p.team) === t2n)
      .sort((a, b) => b.fragsPerMap - a.fragsPerMap);

    return (
      <div>
        {/* Weapon legend */}
        <div className="text-[10px] text-qw-muted mb-3 font-mono">
          T = Taken · K = Kills (enemy holding weapon) · D = Dropped
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <div className="text-xs text-qw-muted font-display uppercase tracking-wider mb-2 truncate" title={team1}>{team1}</div>
            <div className="space-y-2">
              {team1Players.length === 0
                ? <p className="text-qw-muted text-xs italic">No player data</p>
                : team1Players.map(p => <DetailedPlayerCard key={p.name} player={p} />)
              }
            </div>
          </div>
          <div>
            <div className="text-xs text-qw-muted font-display uppercase tracking-wider mb-2 truncate" title={team2}>{team2}</div>
            <div className="space-y-2">
              {team2Players.length === 0
                ? <p className="text-qw-muted text-xs italic">No player data</p>
                : team2Players.map(p => <DetailedPlayerCard key={p.name} player={p} />)
              }
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Global mode — show DetailedPlayerCards with global stats overlaid
  const allPlayers = spotlight.allPlayers || [];
  const hasDetailed = allPlayers.some(p => p.hasDetailedStats);
  const t1n = normalizeTeam(team1);
  const t2n = normalizeTeam(team2);

  const extPlayers1 = normalizeExtRoster(extRoster1);
  const extPlayers2 = normalizeExtRoster(extRoster2);

  if (extLoading) return <ExtLoadingOverlay />;

  // When local detailed stats exist, show DetailedPlayerCards with global overlay
  if (hasDetailed) {
    const team1Local = allPlayers.filter(p => normalizeTeam(p.team) === t1n).sort((a, b) => b.fragsPerMap - a.fragsPerMap);
    const team2Local = allPlayers.filter(p => normalizeTeam(p.team) === t2n).sort((a, b) => b.fragsPerMap - a.fragsPerMap);

    const extByName1 = {};
    for (const ep of extPlayers1) extByName1[(ep.name || '').toLowerCase().trim()] = ep;
    const extByName2 = {};
    for (const ep of extPlayers2) extByName2[(ep.name || '').toLowerCase().trim()] = ep;

    return (
      <div>
        <div className="text-[10px] text-qw-muted mb-3 font-mono">
          T = Taken · K = Kills (enemy holding weapon) · D = Dropped
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[
            { team: team1, players: team1Local, extMap: extByName1 },
            { team: team2, players: team2Local, extMap: extByName2 },
          ].map(({ team, players, extMap }) => (
            <div key={team}>
              <div className="text-xs text-qw-muted font-display uppercase tracking-wider mb-2 truncate" title={team}>
                {team} <span className="font-normal normal-case">(+ global)</span>
              </div>
              <div className="space-y-2">
                {players.length === 0
                  ? <p className="text-qw-muted text-xs italic">No player data</p>
                  : players.map(p => (
                      <DetailedPlayerCard
                        key={p.name}
                        player={p}
                        globalStats={extMap[(p.name || '').toLowerCase().trim()]}
                      />
                    ))
                }
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // Fallback: no local detailed stats — show MergedPlayerRow (global eff + local K/D)
  if (extPlayers1.length === 0 && extPlayers2.length === 0) {
    return <p className="text-qw-muted text-xs italic">No global roster data available.</p>;
  }

  const localByName = {};
  for (const p of allPlayers) localByName[(p.name || '').toLowerCase().trim()] = p;

  const renderColumn = (team, extPlayers) => (
    <div>
      <div className="text-xs text-qw-muted font-display uppercase tracking-wider mb-1.5 truncate">
        {team} <span className="font-normal normal-case">(3mo global)</span>
      </div>
      {extPlayers.length === 0
        ? <p className="text-qw-muted text-xs italic">No global roster data for {team}.</p>
        : extPlayers.map((ep, i) => {
            const localP = localByName[(ep.name || '').toLowerCase().trim()] ?? null;
            return <MergedPlayerRow key={`${ep.name}-${i}`} extPlayer={ep} localPlayer={localP} />;
          })
      }
    </div>
  );

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      {renderColumn(team1, extPlayers1.sort((a, b) => (b.eff ?? -1) - (a.eff ?? -1)))}
      {renderColumn(team2, extPlayers2.sort((a, b) => (b.eff ?? -1) - (a.eff ?? -1)))}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

const INSIGHT_ICONS  = { advantage: '🎯', consistency: '📊', momentum: '🔥', history: '📜' };
const INSIGHT_LABELS = { advantage: 'Advantage', consistency: 'Consistency', momentum: 'Momentum', history: 'History' };

export default function DivisionCasterView({ division }) {
  const rawMaps = division.rawMaps || [];
  const teams   = division.teams   || [];

  const [team1, setTeam1] = useState('');
  const [team2, setTeam2] = useState('');

  const [extData,    setExtData]    = useState(null);
  const [extLoading, setExtLoading] = useState(false);
  const [extError,   setExtError]   = useState(null);

  const [mapView1,   setMapView1]   = useState('tournament');
  const [mapView2,   setMapView2]   = useState('tournament');
  const [playerView, setPlayerView] = useState('tournament');

  const ready = !!(team1 && team2 && team1 !== team2);

  const getTag = (teamName) => {
    const t = teams.find(t => t.name === teamName);
    return t?.tag || teamName;
  };

  // ─── Local stats (computed from rawMaps) ─────────────────────────────────

  const localH2H = useMemo(
    () => ready ? calculateHeadToHead(team1, team2, rawMaps) : null,
    [team1, team2, rawMaps, ready]
  );

  const form1 = useMemo(
    () => ready ? analyzeRecentForm(team1, rawMaps) : null,
    [team1, rawMaps, ready]
  );
  const form2 = useMemo(
    () => ready ? analyzeRecentForm(team2, rawMaps) : null,
    [team2, rawMaps, ready]
  );

  const commonOpp = useMemo(
    () => ready ? analyzeCommonOpponents(team1, team2, rawMaps) : null,
    [team1, team2, rawMaps, ready]
  );

  const mapStats1 = useMemo(
    () => ready ? calculateMapStats(team1, rawMaps) : null,
    [team1, rawMaps, ready]
  );
  const mapStats2 = useMemo(
    () => ready ? calculateMapStats(team2, rawMaps) : null,
    [team2, rawMaps, ready]
  );

  // Spotlight: rank within the two selected teams only
  // allPlayers included for global mode fuzzy matching
  const spotlight = useMemo(() => {
    if (!ready) return null;
    const allStats = calculatePlayerStats(rawMaps);
    const t1n = normalizeTeam(team1);
    const t2n = normalizeTeam(team2);
    const teamPlayers = Object.values(allStats)
      .filter(p => normalizeTeam(p.team) === t1n || normalizeTeam(p.team) === t2n);
    return { ...getPlayerSpotlight(teamPlayers, 2), allPlayers: teamPlayers };
  }, [team1, team2, rawMaps, ready]);

  const insights = useMemo(
    () => ready ? generateCasterInsights(team1, team2, rawMaps) : [],
    [team1, team2, rawMaps, ready]
  );

  // ─── Bracket quick-picks ─────────────────────────────────────────────────

  const bracketMatchups = useMemo(() => {
    const matches = [];
    const bracket = division.bracket;
    if (!bracket) return matches;
    const addRound = (round) => {
      if (!round) return;
      const arr = Array.isArray(round) ? round : [round];
      arr.forEach(m => { if (m.team1 && m.team2) matches.push({ team1: m.team1, team2: m.team2, id: m.id }); });
    };
    const w = bracket.winners || {};
    [w.round32, w.round16, w.round12, w.quarterFinals, w.semiFinals, w.final,
     bracket.thirdPlace, bracket.grandFinal].forEach(addRound);
    if (bracket.losers) Object.values(bracket.losers).forEach(addRound);
    return matches;
  }, [division.bracket]);

  // ─── External API fetch ───────────────────────────────────────────────────

  const resetToggleViews = () => {
    setMapView1('tournament');
    setMapView2('tournament');
    setPlayerView('tournament');
  };

  const loadExtData = async () => {
    if (!ready) return;
    setExtLoading(true);
    setExtError(null);
    setExtData(null);
    resetToggleViews();
    const tag1 = getTag(team1);
    const tag2 = getTag(team2);
    try {
      const [rH2H, rF1, rF2, rM1, rM2, rR1, rR2] = await Promise.allSettled([
        QWStatsService.getH2H(tag1, tag2, { months: 12 }),
        QWStatsService.getForm(tag1, { months: 6 }),
        QWStatsService.getForm(tag2, { months: 6 }),
        QWStatsService.getMapStats(tag1, { months: 6 }),
        QWStatsService.getMapStats(tag2, { months: 6 }),
        QWStatsService.getRoster(tag1, { months: 3 }),
        QWStatsService.getRoster(tag2, { months: 3 }),
      ]);
      const results = [rH2H, rF1, rF2, rM1, rM2, rR1, rR2];
      if (results.every(r => r.status === 'rejected')) {
        const firstErr = results.find(r => r.status === 'rejected');
        setExtError(firstErr?.reason?.message || 'All requests failed');
        setExtLoading(false);
        return;
      }
      setExtData({
        h2h:     rH2H.status === 'fulfilled' ? rH2H.value : null,
        form1:   rF1.status  === 'fulfilled' ? rF1.value  : null,
        form2:   rF2.status  === 'fulfilled' ? rF2.value  : null,
        maps1:   rM1.status  === 'fulfilled' ? rM1.value  : null,
        maps2:   rM2.status  === 'fulfilled' ? rM2.value  : null,
        roster1: rR1.status  === 'fulfilled' ? rR1.value  : null,
        roster2: rR2.status  === 'fulfilled' ? rR2.value  : null,
      });
    } catch (err) {
      setExtError(err.message);
    } finally {
      setExtLoading(false);
    }
  };

  const clearSelection = () => {
    setTeam1(''); setTeam2(''); setExtData(null); setExtError(null);
    resetToggleViews();
  };

  // ─── Team selector ────────────────────────────────────────────────────────

  if (!ready) {
    const hasBracket  = bracketMatchups.length > 0;
    const hasRawMaps  = rawMaps.length > 0;
    const hasTeams    = teams.length > 0;

    return (
      <div className="space-y-4">
        <div className="qw-panel p-6">
          <h2 className="font-display font-bold text-xl text-qw-accent mb-1">🎙️ Caster View</h2>
          <p className="text-qw-muted text-sm mb-6">
            Pre-match analysis and talking points for casting.
          </p>

          {/* Bracket quick-picks — primary path */}
          {hasBracket && (
            <div className="mb-6">
              <h3 className="text-xs text-qw-muted font-display uppercase tracking-wider mb-2">
                ⚡ Bracket Matchups — Quick Pick
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {bracketMatchups.map(m => (
                  <button
                    key={m.id}
                    onClick={() => { setTeam1(m.team1); setTeam2(m.team2); setExtData(null); }}
                    className="flex items-center justify-between gap-2 px-4 py-3 rounded border-2 border-qw-accent/40 bg-qw-accent/5 text-sm hover:border-qw-accent hover:bg-qw-accent/15 transition-all focus:outline-none focus:ring-2 focus:ring-qw-accent/50"
                  >
                    <span className="font-semibold text-white truncate">{m.team1}</span>
                    <span className="text-qw-accent text-xs flex-shrink-0 font-bold">VS</span>
                    <span className="font-semibold text-white truncate text-right">{m.team2}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Manual selectors */}
          <h3 className="text-xs text-qw-muted font-display uppercase tracking-wider mb-2">
            {hasBracket ? 'Or select any two teams' : 'Select teams to analyse'}
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {[
              { label: 'Team 1', value: team1, set: v => { setTeam1(v); setExtData(null); resetToggleViews(); }, other: team2 },
              { label: 'Team 2', value: team2, set: v => { setTeam2(v); setExtData(null); resetToggleViews(); }, other: team1 },
            ].map(({ label, value, set, other }) => (
              <div key={label}>
                <label className="block text-qw-muted text-sm mb-1">{label}</label>
                <select
                  value={value}
                  onChange={e => set(e.target.value)}
                  className="w-full bg-qw-dark border border-qw-border rounded px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-qw-accent/50"
                >
                  <option value="">— Select team —</option>
                  {teams.map(t => (
                    <option key={t.id ?? t.name} value={t.name} disabled={t.name === other}>
                      {t.name}
                    </option>
                  ))}
                </select>
              </div>
            ))}
          </div>

          {/* Status notes */}
          {!hasTeams && (
            <p className="mt-4 text-qw-muted text-sm italic">
              No teams in this division yet. Add teams in the Teams tab first.
            </p>
          )}
          {hasTeams && !hasRawMaps && (
            <div className="mt-4 p-3 rounded border border-qw-border bg-qw-dark/50 text-sm space-y-1">
              <p className="text-qw-muted">
                No match results imported yet — local stats will be empty.
              </p>
              <p className="text-qw-muted">
                You can still select teams and load historical data from the QW Stats API after selecting.
              </p>
            </div>
          )}
        </div>
      </div>
    );
  }

  // ─── Analysis view ────────────────────────────────────────────────────────

  const extButtonLabel = extLoading ? 'Loading…' : extError ? 'Retry' : extData ? 'Refresh QW Stats' : 'Load QW Stats';

  const hasMapData = Object.keys(mapStats1 || {}).length > 0
    || Object.keys(mapStats2 || {}).length > 0
    || extData?.maps1
    || extData?.maps2;

  return (
    <div className="space-y-4">

      {/* Header bar */}
      <div className="qw-panel p-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <button
              onClick={clearSelection}
              className="text-qw-muted hover:text-white transition-colors text-sm flex-shrink-0 focus:outline-none focus:ring-2 focus:ring-qw-accent/50 rounded px-1"
            >
              ← Back
            </button>
            <div className="font-display font-bold text-lg flex items-center gap-2 min-w-0">
              <span className="text-white truncate" title={team1}>{team1}</span>
              <span className="text-qw-muted text-sm flex-shrink-0">vs</span>
              <span className="text-white truncate" title={team2}>{team2}</span>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <button
              onClick={loadExtData}
              disabled={extLoading}
              title="Fetch historical stats from the QW Stats API (qw-api.poker-affiliate.org)"
              className="px-3 py-1.5 text-xs rounded bg-qw-accent text-qw-dark font-semibold hover:bg-qw-accent/80 transition-all disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-qw-accent/50"
            >
              {extButtonLabel}
            </button>
          </div>
        </div>

        {extError && (
          <div className="mt-2 flex items-center gap-3 p-2.5 rounded border border-qw-loss/30 bg-qw-loss/5">
            <span className="text-qw-loss text-sm flex-shrink-0">⚠</span>
            <p className="text-qw-loss text-sm flex-1">
              Global stats unavailable — local data only.
              <span className="font-mono opacity-75 text-xs ml-2">{extError}</span>
            </p>
          </div>
        )}
        {extData && !extError && (
          <p className="mt-2 text-qw-muted text-xs">🌍 Global stats loaded (6–12 month window)</p>
        )}
      </div>

      {/* Quick Glance — always-visible summary */}
      <QuickGlance
        team1={team1} team2={team2}
        h2h={localH2H} form1={form1} form2={form2}
        mapStats1={mapStats1} mapStats2={mapStats2}
      />

      {/* Key Talking Points */}
      {insights.length > 0 && (
        <div className="qw-panel p-5 border border-qw-accent/25 bg-qw-accent/5">
          <h3 className="font-display font-bold text-qw-accent mb-3">💡 Key Talking Points</h3>
          <ul className="space-y-2">
            {insights.map((ins) => (
              <li key={`${ins.type}-${ins.text.slice(0, 30)}`} className="flex items-start gap-2 text-sm text-qw-text">
                <span className="flex-shrink-0 mt-0.5" role="img" aria-label={INSIGHT_LABELS[ins.type] || 'Note'}>
                  {INSIGHT_ICONS[ins.type] || '•'}
                </span>
                <span>{ins.text}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Head to Head */}
      <div className="qw-panel p-5">
        <h3 className="font-display font-bold text-white mb-3">
          Tournament Record
          <span className="text-qw-muted font-normal text-sm ml-2">(maps played this tournament)</span>
        </h3>

        {localH2H.totalMaps === 0 ? (
          <p className="text-qw-muted text-sm italic">No previous meetings in this tournament's data.</p>
        ) : (
          <>
            {/* Scoreboard */}
            <div className="grid grid-cols-3 gap-2 text-center mb-4">
              <div>
                <div className={`text-4xl font-display font-bold leading-none ${localH2H.team1Wins > localH2H.team2Wins ? 'text-qw-win' : 'text-white'}`}>
                  {localH2H.team1Wins}
                </div>
                <div className="text-xs text-qw-muted mt-1 truncate" title={team1}>{team1}</div>
              </div>
              <div className="flex flex-col items-center justify-center">
                <div className="text-xs text-qw-muted uppercase tracking-widest mb-1">Maps</div>
                <div className="text-2xl font-display font-bold text-qw-muted">{localH2H.totalMaps}</div>
              </div>
              <div>
                <div className={`text-4xl font-display font-bold leading-none ${localH2H.team2Wins > localH2H.team1Wins ? 'text-qw-win' : 'text-white'}`}>
                  {localH2H.team2Wins}
                </div>
                <div className="text-xs text-qw-muted mt-1 truncate" title={team2}>{team2}</div>
              </div>
            </div>
            {/* Per-map breakdown */}
            <div className="space-y-1 border-t border-qw-border/30 pt-3">
              {localH2H.maps.map((m, i) => (
                <div key={`h2h-${i}-${m.map}`} className="flex items-center gap-2 text-xs font-mono text-qw-muted">
                  <span className="w-16 text-qw-text flex-shrink-0" title={m.map}>{m.map}</span>
                  <span className={m.score1 > m.score2 ? 'text-qw-win font-bold' : ''}>{m.score1}</span>
                  <span>–</span>
                  <span className={m.score2 > m.score1 ? 'text-qw-win font-bold' : ''}>{m.score2}</span>
                  <span className="ml-auto opacity-50">{m.date ? m.date.split(' ')[0] : ''}</span>
                </div>
              ))}
            </div>
          </>
        )}

        {/* Global H2H */}
        {extLoading && <ExtLoadingOverlay />}
        {extData?.h2h && (
          <div className="mt-4 pt-3 border-t border-qw-border">
            <div className="text-xs text-qw-muted font-display uppercase tracking-wider mb-2">
              H2H <GlobalBadge />
            </div>
            <ExtH2HPanel data={extData.h2h} tag1={getTag(team1)} />
          </div>
        )}
      </div>

      {/* Recent Form */}
      <div className="qw-panel p-5">
        <h3 className="font-display font-bold text-white mb-4">
          Recent Form
          <span className="text-qw-muted font-normal text-sm ml-2">(last 5 maps, oldest → newest)</span>
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {[
            { form: form1, extForm: extData?.form1, team: team1 },
            { form: form2, extForm: extData?.form2, team: team2 },
          ].map(({ form, extForm, team }) => (
            <div key={team}>
              {/* Team header + record */}
              <div className="flex items-center justify-between mb-2">
                <span className="font-semibold text-white text-sm truncate" title={team}>{team}</span>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <TrendArrow trend={form.trend} />
                  <span className="font-mono text-qw-muted text-xs">{form.record}</span>
                </div>
              </div>

              {/* Map cards */}
              {form.last5Maps.length === 0 ? (
                <p className="text-qw-muted text-xs italic">No map data yet.</p>
              ) : (
                <div
                  className="grid gap-1"
                  style={{ gridTemplateColumns: `repeat(${form.last5Maps.length}, 1fr)` }}
                >
                  {form.last5Maps.map((r, i) => (
                    <MapResultCard key={`form-${team}-${i}-${r.map}`} result={r} />
                  ))}
                </div>
              )}

              {/* Momentum + inline global delta badge */}
              <div className="mt-2 text-xs text-qw-muted">
                Momentum:{' '}
                <span className={getMomentumColor(form.momentum)}>
                  {getMomentumLabel(form.momentum)}
                </span>
                <FormDeltaBadge localForm={form} extFormData={extForm} extLoading={extLoading} />
                {form.streak >= 2 && form.streak < 3 && (
                  <span className="ml-3">
                    {form.streakType === 'W'
                      ? <span className="text-qw-win">{form.streak}W streak</span>
                      : <span className="text-qw-loss">{form.streak}L streak</span>
                    }
                  </span>
                )}
              </div>

              {/* Prominent streak badge for 3+ */}
              <StreakBadge streak={form.streak} type={form.streakType} />
            </div>
          ))}
        </div>
      </div>

      {/* Common Opponents — table layout, capped at 5 */}
      {commonOpp && commonOpp.breakdown.length > 0 && (
        <div className="qw-panel p-5">
          <h3 className="font-display font-bold text-white mb-1">Common Opponents</h3>
          <p className="text-qw-muted text-xs mb-3">
            {commonOpp.summary.commonCount} shared opponent{commonOpp.summary.commonCount !== 1 ? 's' : ''} —{' '}
            <span className="text-qw-win">{team1}: {commonOpp.summary.team1Advantages} adv</span>
            {' · '}
            <span className="text-qw-win">{team2}: {commonOpp.summary.team2Advantages} adv</span>
          </p>
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-qw-border/40 text-qw-muted">
                <th className="text-left py-1.5 font-normal pr-3">Opponent</th>
                <th className="text-center py-1.5 font-normal px-2 truncate max-w-[80px]" title={team1}>{team1}</th>
                <th className="text-center py-1.5 font-normal px-2 truncate max-w-[80px]" title={team2}>{team2}</th>
                <th className="text-right py-1.5 font-normal pl-2">Edge</th>
              </tr>
            </thead>
            <tbody>
              {commonOpp.breakdown.slice(0, 5).map(({ opponent, team1Result, team2Result, advantage }) => (
                <tr key={opponent} className="border-b border-qw-border/20 last:border-0">
                  <td className="py-1.5 font-mono text-qw-text pr-3" title={opponent}>{opponent}</td>
                  <td className={`py-1.5 text-center font-mono px-2 ${advantage === 'team1' ? 'text-qw-win font-bold' : 'text-qw-muted'}`}>
                    {team1Result.wins}W–{team1Result.losses}L
                  </td>
                  <td className={`py-1.5 text-center font-mono px-2 ${advantage === 'team2' ? 'text-qw-win font-bold' : 'text-qw-muted'}`}>
                    {team2Result.wins}W–{team2Result.losses}L
                  </td>
                  <td className="py-1.5 text-right pl-2 whitespace-nowrap">
                    {advantage === 'team1' && <span className="text-qw-win text-[10px] font-display">T1 ▶</span>}
                    {advantage === 'team2' && <span className="text-qw-win text-[10px] font-display">◀ T2</span>}
                    {advantage === 'even'  && <span className="text-qw-muted text-[10px]">—</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {commonOpp.breakdown.length > 5 && (
            <p className="text-qw-muted text-[10px] mt-2">+{commonOpp.breakdown.length - 5} more opponents not shown</p>
          )}
        </div>
      )}

      {/* Map Performance */}
      {hasMapData && (
        <div className="qw-panel p-5">
          <h3 className="font-display font-bold text-white mb-4">Map Performance</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {[
              { stats: mapStats1, extMaps: extData?.maps1, team: team1, view: mapView1, setView: setMapView1 },
              { stats: mapStats2, extMaps: extData?.maps2, team: team2, view: mapView2, setView: setMapView2 },
            ].map(({ stats, extMaps, team, view, setView }) => (
              <div key={team}>
                <div className="flex items-center justify-between mb-2 gap-2">
                  <div className="font-semibold text-white text-sm truncate" title={team}>{team}</div>
                  {(extData || extLoading) && (
                    <TabToggle
                      value={view}
                      onChange={setView}
                      disabled={!extData}
                    />
                  )}
                </div>
                <MapStatsPanel
                  stats={stats}
                  extMapsData={extMaps}
                  extLoading={extLoading}
                  showGlobal={view === 'global'}
                />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Player Spotlight */}
      {spotlight && (spotlight.hotHands.length > 0 || spotlight.struggling.length > 0 || extData?.roster1 || extData?.roster2 || extLoading) && (
        <div className="qw-panel p-5">
          <div className="flex items-center justify-between mb-4 gap-2">
            <h3 className="font-display font-bold text-white">Player Spotlight</h3>
            {(extData || extLoading) && (
              <TabToggle
                value={playerView}
                onChange={setPlayerView}
                disabled={!extData}
              />
            )}
          </div>
          <PlayerSpotlightCard
            spotlight={spotlight}
            team1={team1}
            team2={team2}
            extRoster1={extData?.roster1}
            extRoster2={extData?.roster2}
            extLoading={extLoading}
            showGlobal={playerView === 'global'}
          />
        </div>
      )}

    </div>
  );
}
