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
} from '../../utils/casterStats';
import QWStatsService from '../../services/QWStatsService';

// ─── Small reusable pieces ────────────────────────────────────────────────────

const TrendArrow = ({ trend }) => (
  <span className={
    trend === 'rising'  ? 'text-qw-win'  :
    trend === 'falling' ? 'text-qw-loss' :
    'text-qw-muted'
  }>
    {trend === 'rising' ? '↗' : trend === 'falling' ? '↘' : '→'}
  </span>
);

const MapResultCard = ({ result }) => {
  const bg =
    result.result === 'W' ? 'bg-qw-win/20 text-qw-win border-qw-win/30' :
    result.result === 'L' ? 'bg-qw-loss/20 text-qw-loss border-qw-loss/30' :
    'bg-qw-border/20 text-qw-muted border-qw-border/30';
  return (
    <div className={`flex flex-col items-center justify-center rounded p-1.5 text-xs font-mono border ${bg}`}>
      <span className="font-bold">{result.result}</span>
      <span className="text-[10px] opacity-80 truncate max-w-full">{result.map}</span>
      <span className="text-[10px] opacity-60">{result.sf}–{result.sa}</span>
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
    <div className="flex items-center gap-2 py-1 text-xs border-b border-qw-border/20 last:border-0">
      <div className="flex-1 min-w-0">
        <div className="text-white truncate">{player.name}</div>
        <div className="text-qw-muted text-[10px] truncate">{player.team}</div>
      </div>
      <div className="text-right flex-shrink-0">
        <div className="font-mono font-bold text-white">{player.kdRatio}</div>
        <div className="text-[10px] text-qw-muted">{player.fragsPerMap}/map</div>
      </div>
      <span className={`text-xs flex-shrink-0 ${trendColor}`}>{trendIcon}</span>
    </div>
  );
};

// ─── External API display helpers ─────────────────────────────────────────────

function ExtH2HPanel({ data, tag1, tag2 }) {
  const rows = Array.isArray(data) ? data : (data?.matches || data?.games || []);
  if (rows.length === 0) return <p className="text-qw-muted text-xs italic">No global H2H data found.</p>;

  let wins1 = 0;
  for (const r of rows) {
    const team = (r.team || r.teamA || '').toLowerCase();
    const res  = (r.result || '').toUpperCase();
    if (team === tag1.toLowerCase() && res === 'W') wins1++;
  }
  const wins2 = rows.length - wins1;

  return (
    <div className="text-xs font-mono">
      <span className={wins1 > wins2 ? 'text-qw-win font-bold' : 'text-white'}>{wins1}</span>
      <span className="text-qw-muted"> – </span>
      <span className={wins2 > wins1 ? 'text-qw-win font-bold' : 'text-white'}>{wins2}</span>
      <span className="text-qw-muted ml-2">({rows.length} maps)</span>
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
      Global (6mo):{' '}
      <span className="text-qw-win">{wins}W</span>–<span className="text-qw-loss">{losses}L</span>
      <span className="text-qw-muted ml-1">of {rows.length} maps</span>
    </div>
  );
}

function ExtRosterPanel({ data, team }) {
  const players = Array.isArray(data) ? data : (data?.players || data?.roster || []);
  if (players.length === 0) return <p className="text-qw-muted text-xs italic">No roster data for {team}.</p>;
  return (
    <div>
      <div className="text-xs text-qw-muted truncate mb-1.5">{team}</div>
      <div className="space-y-1">
        {players.slice(0, 5).map((p, i) => {
          const name = p.name || p.nick || p.player || '?';
          const kd   = p.kd ?? p.kdRatio ?? p.efficiency ?? null;
          return (
            <div key={i} className="flex items-center gap-2 text-xs font-mono">
              <span className="text-qw-text truncate flex-1">{name}</span>
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

// ─── Main component ───────────────────────────────────────────────────────────

export default function DivisionCasterView({ division }) {
  const rawMaps = division.rawMaps || [];
  const teams   = division.teams   || [];

  const [team1, setTeam1] = useState('');
  const [team2, setTeam2] = useState('');

  // External API state
  const [extData,    setExtData]    = useState(null);
  const [extLoading, setExtLoading] = useState(false);
  const [extError,   setExtError]   = useState(null);

  const ready = !!(team1 && team2 && team1 !== team2);

  // Resolve team tag from division.teams for the external API
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

  const allPlayerStats = useMemo(
    () => ready ? calculatePlayerStats(rawMaps) : null,
    [rawMaps, ready]
  );

  const spotlight = useMemo(() => {
    if (!allPlayerStats || !ready) return null;
    const all = getPlayerSpotlight(allPlayerStats, 2);
    const t1n = normalizeTeam(team1);
    const t2n = normalizeTeam(team2);
    return {
      hotHands:   all.hotHands.filter(p => normalizeTeam(p.team) === t1n || normalizeTeam(p.team) === t2n),
      struggling: all.struggling.filter(p => normalizeTeam(p.team) === t1n || normalizeTeam(p.team) === t2n),
    };
  }, [allPlayerStats, team1, team2, ready]);

  const insights = useMemo(
    () => ready ? generateCasterInsights(team1, team2, rawMaps) : [],
    [team1, team2, rawMaps, ready]
  );

  // ─── Quick-select from bracket ────────────────────────────────────────────

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
      const [h2h, ef1, ef2, em1, em2, er1, er2] = await Promise.allSettled([
        QWStatsService.getH2H(tag1, tag2, { months: 12 }),
        QWStatsService.getForm(tag1, { months: 6 }),
        QWStatsService.getForm(tag2, { months: 6 }),
        QWStatsService.getMapStats(tag1, { months: 6 }),
        QWStatsService.getMapStats(tag2, { months: 6 }),
        QWStatsService.getRoster(tag1, { months: 3 }),
        QWStatsService.getRoster(tag2, { months: 3 }),
      ]);
      setExtData({
        h2h:    h2h.status === 'fulfilled' ? h2h.value : null,
        form1:  ef1.status === 'fulfilled' ? ef1.value : null,
        form2:  ef2.status === 'fulfilled' ? ef2.value : null,
        maps1:  em1.status === 'fulfilled' ? em1.value : null,
        maps2:  em2.status === 'fulfilled' ? em2.value : null,
        roster1: er1.status === 'fulfilled' ? er1.value : null,
        roster2: er2.status === 'fulfilled' ? er2.value : null,
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
    return (
      <div className="space-y-4">
        <div className="qw-panel p-6">
          <h2 className="font-display font-bold text-xl text-qw-accent mb-1">Caster View</h2>
          <p className="text-qw-muted text-sm mb-6">
            Select two teams to generate pre-match analysis and talking points.
          </p>

          {/* Quick-select from bracket */}
          {bracketMatchups.length > 0 && (
            <div className="mb-6">
              <h3 className="text-xs text-qw-muted font-display uppercase tracking-wider mb-2">
                Bracket Matchups
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {bracketMatchups.map(m => (
                  <button
                    key={m.id}
                    onClick={() => { setTeam1(m.team1); setTeam2(m.team2); setExtData(null); }}
                    className="flex items-center justify-between gap-2 px-4 py-3 rounded border border-qw-border bg-qw-dark text-sm hover:border-qw-accent hover:text-white transition-all"
                  >
                    <span className="font-semibold text-white truncate">{m.team1}</span>
                    <span className="text-qw-muted text-xs flex-shrink-0">vs</span>
                    <span className="font-semibold text-white truncate text-right">{m.team2}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Manual selection */}
          <h3 className="text-xs text-qw-muted font-display uppercase tracking-wider mb-2">
            {bracketMatchups.length > 0 ? 'Or select manually' : 'Select teams'}
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
                  className="w-full bg-qw-dark border border-qw-border rounded px-3 py-2 text-white text-sm"
                >
                  <option value="">— Select team —</option>
                  {teams.map(t => (
                    <option key={t.id} value={t.name} disabled={t.name === other}>
                      {t.name}
                    </option>
                  ))}
                </select>
              </div>
            ))}
          </div>

          {teams.length === 0 && (
            <p className="mt-4 text-qw-muted text-sm italic">
              No teams in this division yet. Add teams in the Teams tab first.
            </p>
          )}

          {rawMaps.length === 0 && teams.length > 0 && (
            <p className="mt-4 text-yellow-400/80 text-sm">
              No map data imported yet. Import results to unlock local stats. Global stats (via QW Stats API) are still available after selecting teams.
            </p>
          )}
        </div>
      </div>
    );
  }

  // ─── Analysis view ────────────────────────────────────────────────────────

  const insightIcons = { advantage: '🎯', consistency: '📊', momentum: '🔥', history: '📜' };

  return (
    <div className="space-y-4">

      {/* Header */}
      <div className="qw-panel p-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-center gap-4">
            <button onClick={clearSelection} className="text-qw-muted hover:text-white transition-colors text-sm flex-shrink-0">
              ← Back
            </button>
            <div className="font-display font-bold text-lg flex items-center gap-2 min-w-0">
              <span className="text-white truncate">{team1}</span>
              <span className="text-qw-muted text-base flex-shrink-0">vs</span>
              <span className="text-white truncate">{team2}</span>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <button
              onClick={clearSelection}
              className="px-3 py-1.5 text-xs rounded bg-qw-dark border border-qw-border text-qw-muted hover:text-white hover:border-qw-accent transition-all"
            >
              Change Teams
            </button>
            <button
              onClick={loadExtData}
              disabled={extLoading}
              className="px-3 py-1.5 text-xs rounded bg-qw-accent text-qw-dark font-semibold hover:bg-qw-accent/80 transition-all disabled:opacity-50"
            >
              {extLoading ? 'Loading…' : extData ? 'Refresh Global Stats' : 'Load Global Stats'}
            </button>
          </div>
        </div>
        {extError && (
          <p className="mt-2 text-qw-loss text-xs font-mono">External API error: {extError}</p>
        )}
        {extData && !extError && (
          <p className="mt-2 text-qw-muted text-xs">Global stats loaded from QW Stats API (6–12 month window)</p>
        )}
      </div>

      {/* Insights */}
      {insights.length > 0 && (
        <div className="qw-panel p-5 border border-qw-accent/25 bg-qw-accent/5">
          <h3 className="font-display font-bold text-qw-accent mb-3">💡 Key Talking Points</h3>
          <ul className="space-y-2">
            {insights.map((ins, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-qw-text">
                <span className="flex-shrink-0 mt-0.5">{insightIcons[ins.type] || '•'}</span>
                <span>{ins.text}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Head to Head */}
      <div className="qw-panel p-5">
        <h3 className="font-display font-bold text-white mb-3">
          Head to Head
          <span className="text-qw-muted font-normal text-sm ml-2">(tournament maps)</span>
        </h3>

        {localH2H.totalMaps === 0 ? (
          <p className="text-qw-muted text-sm italic">No previous meetings in this tournament's data.</p>
        ) : (
          <>
            <div className="grid grid-cols-3 gap-4 text-center mb-4">
              <div>
                <div className={`text-3xl font-display font-bold ${localH2H.team1Wins > localH2H.team2Wins ? 'text-qw-win' : 'text-white'}`}>
                  {localH2H.team1Wins}
                </div>
                <div className="text-xs text-qw-muted truncate">{team1}</div>
              </div>
              <div className="text-center">
                <div className="text-lg font-mono text-qw-muted mt-1">{localH2H.totalMaps}</div>
                <div className="text-xs text-qw-muted">maps</div>
              </div>
              <div>
                <div className={`text-3xl font-display font-bold ${localH2H.team2Wins > localH2H.team1Wins ? 'text-qw-win' : 'text-white'}`}>
                  {localH2H.team2Wins}
                </div>
                <div className="text-xs text-qw-muted truncate">{team2}</div>
              </div>
            </div>
            <div className="space-y-1">
              {localH2H.maps.map((m, i) => (
                <div key={i} className="flex items-center gap-2 text-xs font-mono text-qw-muted">
                  <span className="w-16 text-qw-text flex-shrink-0">{m.map}</span>
                  <span className={m.score1 > m.score2 ? 'text-qw-win font-bold' : ''}>{m.score1}</span>
                  <span>–</span>
                  <span className={m.score2 > m.score1 ? 'text-qw-win font-bold' : ''}>{m.score2}</span>
                  <span className="ml-auto opacity-60">{m.date ? m.date.split(' ')[0] : ''}</span>
                </div>
              ))}
            </div>
          </>
        )}

        {extData?.h2h && (
          <div className="mt-4 pt-4 border-t border-qw-border">
            <div className="text-xs text-qw-muted font-display uppercase tracking-wider mb-2">
              Global H2H (12 months)
            </div>
            <ExtH2HPanel data={extData.h2h} tag1={getTag(team1)} tag2={getTag(team2)} />
          </div>
        )}
      </div>

      {/* Recent Form */}
      <div className="qw-panel p-5">
        <h3 className="font-display font-bold text-white mb-4">
          Recent Form
          <span className="text-qw-muted font-normal text-sm ml-2">(last 5 maps in tournament)</span>
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {[
            { form: form1, extForm: extData?.form1, team: team1 },
            { form: form2, extForm: extData?.form2, team: team2 },
          ].map(({ form, extForm, team }) => (
            <div key={team}>
              <div className="flex items-center justify-between mb-2">
                <span className="font-semibold text-white text-sm truncate">{team}</span>
                <div className="flex items-center gap-2 text-sm flex-shrink-0">
                  <TrendArrow trend={form.trend} />
                  <span className="font-mono text-qw-muted text-xs">{form.record}</span>
                </div>
              </div>

              {form.last5Maps.length === 0 ? (
                <p className="text-qw-muted text-xs italic">No map data yet.</p>
              ) : (
                <div
                  className="grid gap-1"
                  style={{ gridTemplateColumns: `repeat(${form.last5Maps.length}, 1fr)` }}
                >
                  {form.last5Maps.map((r, i) => <MapResultCard key={i} result={r} />)}
                </div>
              )}

              <div className="mt-2 text-xs text-qw-muted">
                Momentum:{' '}
                <span className={
                  form.momentum > 0.7 ? 'text-qw-win' :
                  form.momentum > 0.4 ? 'text-yellow-400' :
                  'text-qw-loss'
                }>
                  {getMomentumLabel(form.momentum)}
                </span>
                {form.streak >= 2 && (
                  <span className="ml-3">
                    {form.streakType === 'W'
                      ? <span className="text-qw-win">{form.streak}W streak</span>
                      : <span className="text-qw-loss">{form.streak}L streak</span>
                    }
                  </span>
                )}
              </div>

              {extForm && <ExtFormSummary data={extForm} />}
            </div>
          ))}
        </div>
      </div>

      {/* Common Opponents */}
      {commonOpp && commonOpp.breakdown.length > 0 && (
        <div className="qw-panel p-5">
          <h3 className="font-display font-bold text-white mb-1">Common Opponents</h3>
          <p className="text-qw-muted text-xs mb-4">
            {commonOpp.summary.commonCount} shared opponent{commonOpp.summary.commonCount !== 1 ? 's' : ''} —{' '}
            {team1}: <span className="text-qw-win">{commonOpp.summary.team1Advantages} adv</span>{' '}
            · {team2}: <span className="text-qw-win">{commonOpp.summary.team2Advantages} adv</span>
          </p>
          <div className="space-y-3">
            {commonOpp.breakdown.map(({ opponent, team1Result, team2Result, advantage }) => (
              <div key={opponent} className="grid grid-cols-[1fr_auto_1fr] gap-2 items-center text-xs">
                {/* Team 1 result */}
                <div className={`p-2.5 rounded border ${advantage === 'team1' ? 'border-qw-win/40 bg-qw-win/10' : 'border-qw-border/40 bg-qw-dark/50'}`}>
                  <div className="flex justify-between items-center mb-1">
                    <span className="font-mono font-bold">{team1Result.wins}W–{team1Result.losses}L</span>
                    {advantage === 'team1' && <span className="text-qw-win text-[10px] font-display">ADV</span>}
                  </div>
                  <div className="text-qw-muted">
                    {team1Result.fragDiff >= 0 ? '+' : ''}{team1Result.fragDiff} frags
                  </div>
                </div>

                {/* Opponent name */}
                <div className="text-center px-1">
                  <div className="text-[10px] text-qw-muted font-mono break-all">{opponent}</div>
                </div>

                {/* Team 2 result */}
                <div className={`p-2.5 rounded border ${advantage === 'team2' ? 'border-qw-win/40 bg-qw-win/10' : 'border-qw-border/40 bg-qw-dark/50'}`}>
                  <div className="flex justify-between items-center mb-1">
                    {advantage === 'team2' && <span className="text-qw-win text-[10px] font-display">ADV</span>}
                    <span className="font-mono font-bold ml-auto">{team2Result.wins}W–{team2Result.losses}L</span>
                  </div>
                  <div className="text-qw-muted text-right">
                    {team2Result.fragDiff >= 0 ? '+' : ''}{team2Result.fragDiff} frags
                  </div>
                </div>
              </div>
            ))}
          </div>
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
                <div className="font-semibold text-white text-sm mb-2 truncate">{team}</div>
                {Object.keys(stats).length === 0 ? (
                  <p className="text-qw-muted text-xs italic">No map data.</p>
                ) : (
                  <div className="space-y-1.5">
                    {Object.entries(stats)
                      .sort((a, b) => b[1].played - a[1].played)
                      .map(([mapName, s]) => (
                        <div key={mapName} className="flex items-center gap-2 text-xs font-mono">
                          <span className="w-14 text-qw-text flex-shrink-0">{mapName}</span>
                          <div className="flex-1 h-1.5 bg-qw-border rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full ${s.winRate >= 0.5 ? 'bg-qw-win' : 'bg-qw-loss'}`}
                              style={{ width: `${Math.round(s.winRate * 100)}%` }}
                            />
                          </div>
                          <span className={`w-8 text-right flex-shrink-0 ${s.winRate >= 0.5 ? 'text-qw-win' : 'text-qw-loss'}`}>
                            {Math.round(s.winRate * 100)}%
                          </span>
                          <span className="text-qw-muted w-12 text-right flex-shrink-0">
                            {s.wins}W–{s.losses}L
                          </span>
                          <span className={`w-10 text-right flex-shrink-0 ${s.avgFragDiff >= 0 ? 'text-qw-win' : 'text-qw-loss'}`}>
                            {s.avgFragDiff >= 0 ? '+' : ''}{s.avgFragDiff}
                          </span>
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

          {/* Global roster from API */}
          {(extData?.roster1 || extData?.roster2) && (
            <div className="mt-4 pt-4 border-t border-qw-border">
              <div className="text-xs text-qw-muted font-display uppercase tracking-wider mb-3">
                Global Roster Stats (3 months)
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {[
                  { roster: extData.roster1, team: team1 },
                  { roster: extData.roster2, team: team2 },
                ].map(({ roster, team }) => roster && (
                  <ExtRosterPanel key={team} data={roster} team={team} />
                ))}
              </div>
            </div>
          )}
        </div>
      )}

    </div>
  );
}
