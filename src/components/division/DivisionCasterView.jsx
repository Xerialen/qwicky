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

// ─── External API panels (defensive — API shape is not guaranteed) ────────────

const GlobalBadge = () => (
  <span className="ml-2 text-[10px] text-qw-muted font-normal normal-case tracking-normal">🌍 Global</span>
);

function ExtH2HPanel({ data, tag1 }) {
  const rows = Array.isArray(data) ? data : (data?.matches || data?.games || []);
  if (rows.length === 0) return <p className="text-qw-muted text-xs italic">No global H2H data found.</p>;
  let wins1 = 0;
  for (const r of rows) {
    const team = (r.team || r.teamA || '').toLowerCase();
    if (team === tag1.toLowerCase() && (r.result || '').toUpperCase() === 'W') wins1++;
  }
  const wins2 = rows.length - wins1;
  return (
    <div className="text-xs font-mono">
      <span className={wins1 > wins2 ? 'text-qw-win font-bold' : 'text-white'}>{wins1}</span>
      <span className="text-qw-muted"> – </span>
      <span className={wins2 > wins1 ? 'text-qw-win font-bold' : 'text-white'}>{wins2}</span>
      <span className="text-qw-muted ml-2">({rows.length} maps, 12 months)</span>
    </div>
  );
}

function ExtFormSummary({ data }) {
  const rows = Array.isArray(data) ? data : (data?.matches || data?.games || []);
  if (rows.length === 0) return null;
  const wins   = rows.filter(r => (r.result || '').toUpperCase() === 'W').length;
  const losses = rows.filter(r => (r.result || '').toUpperCase() === 'L').length;
  return (
    <div className="mt-1.5 text-xs text-qw-muted font-mono">
      🌍 Global (6mo):{' '}
      <span className="text-qw-win">{wins}W</span>–<span className="text-qw-loss">{losses}L</span>
      <span className="ml-1">of {rows.length} maps</span>
    </div>
  );
}

function ExtRosterPanel({ data, team }) {
  const players = Array.isArray(data) ? data : (data?.players || data?.roster || []);
  if (players.length === 0) return <p className="text-qw-muted text-xs italic">No roster data for {team}.</p>;
  return (
    <div>
      <div className="text-xs text-qw-muted truncate mb-1.5" title={team}>{team}</div>
      <div className="space-y-1">
        {players.slice(0, 5).map((p, i) => {
          const name = p.name || p.nick || p.player || '?';
          const kd   = p.kd ?? p.kdRatio ?? p.efficiency ?? null;
          return (
            <div key={`${name}-${i}`} className="flex items-center gap-2 text-xs font-mono">
              <span className="text-qw-text truncate flex-1" title={name}>{name}</span>
              {kd !== null && (
                <span className={`flex-shrink-0 ${parseFloat(kd) >= 1 ? 'text-qw-win' : 'text-qw-loss'}`}>
                  {parseFloat(kd).toFixed(2)}
                </span>
              )}
            </div>
          );
        })}
      </div>
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
  const spotlight = useMemo(() => {
    if (!ready) return null;
    const allStats = calculatePlayerStats(rawMaps);
    const t1n = normalizeTeam(team1);
    const t2n = normalizeTeam(team2);
    const teamPlayers = Object.values(allStats)
      .filter(p => normalizeTeam(p.team) === t1n || normalizeTeam(p.team) === t2n);
    return getPlayerSpotlight(teamPlayers, 2);
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

  const loadExtData = async () => {
    if (!ready) return;
    setExtLoading(true);
    setExtError(null);
    setExtData(null);
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

  const clearSelection = () => { setTeam1(''); setTeam2(''); setExtData(null); setExtError(null); };

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
              { label: 'Team 1', value: team1, set: v => { setTeam1(v); setExtData(null); }, other: team2 },
              { label: 'Team 2', value: team2, set: v => { setTeam2(v); setExtData(null); }, other: team1 },
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
          <div className="mt-2 flex items-center gap-3">
            <p className="text-qw-loss text-xs flex-1">
              Global stats unavailable — local data only.{' '}
              <span className="font-mono opacity-60 text-[10px]">{extError}</span>
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

              {/* Momentum */}
              <div className="mt-2 text-xs text-qw-muted">
                Momentum:{' '}
                <span className={getMomentumColor(form.momentum)}>
                  {getMomentumLabel(form.momentum)}
                </span>
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

              {/* Global form */}
              {extLoading && <ExtLoadingOverlay />}
              {extForm && <ExtFormSummary data={extForm} />}
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
      {(Object.keys(mapStats1 || {}).length > 0 || Object.keys(mapStats2 || {}).length > 0) && (
        <div className="qw-panel p-5">
          <h3 className="font-display font-bold text-white mb-4">Map Performance</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {[
              { stats: mapStats1, team: team1 },
              { stats: mapStats2, team: team2 },
            ].map(({ stats, team }) => (
              <div key={team}>
                <div className="font-semibold text-white text-sm mb-2 truncate" title={team}>{team}</div>
                {Object.keys(stats).length === 0 ? (
                  <p className="text-qw-muted text-xs italic">No map data.</p>
                ) : (
                  <div className="space-y-2">
                    {Object.entries(stats)
                      .sort((a, b) => b[1].played - a[1].played)
                      .map(([mapName, s]) => (
                        <div key={`${team}-${mapName}`} className="space-y-0.5">
                          <div className="flex items-center justify-between text-xs">
                            <span className="font-mono text-qw-text" title={mapName}>{mapName}</span>
                            <div className="flex items-center gap-3 font-mono flex-shrink-0">
                              <span className="text-qw-muted">{s.wins}W–{s.losses}L</span>
                              <span className={`w-8 text-right ${s.winRate >= 0.5 ? 'text-qw-win' : 'text-qw-loss'}`}>
                                {Math.round(s.winRate * 100)}%
                              </span>
                              <span className={`w-10 text-right ${s.avgFragDiff >= 0 ? 'text-qw-win' : 'text-qw-loss'}`}
                                title="Average frag differential">
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
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Player Spotlight */}
      {spotlight && (spotlight.hotHands.length > 0 || spotlight.struggling.length > 0) && (
        <div className="qw-panel p-5">
          <h3 className="font-display font-bold text-white mb-4">Player Spotlight</h3>
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

          {(extLoading || extData?.roster1 || extData?.roster2) && (
            <div className="mt-4 pt-4 border-t border-qw-border">
              <div className="text-xs text-qw-muted font-display uppercase tracking-wider mb-3">
                Roster Stats <GlobalBadge /> (3 months)
              </div>
              {extLoading ? <ExtLoadingOverlay /> : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {[
                    { roster: extData?.roster1, team: team1 },
                    { roster: extData?.roster2, team: team2 },
                  ].map(({ roster, team }) => roster && (
                    <ExtRosterPanel key={team} data={roster} team={team} />
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

    </div>
  );
}
