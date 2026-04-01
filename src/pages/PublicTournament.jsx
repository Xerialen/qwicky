// src/pages/PublicTournament.jsx
import React, { useState, useEffect, useMemo, useCallback } from 'react';

const POLL_INTERVAL = 60000; // 60 seconds

const countryToFlag = (code) => {
  if (!code || code.length !== 2) return '';
  return String.fromCodePoint(
    ...code
      .toUpperCase()
      .split('')
      .map((c) => 0x1f1e6 + c.charCodeAt(0) - 65)
  );
};

function formatDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  if (isNaN(d)) return dateStr;
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

// ─── Standings Table ──────────────────────────────────────────────────────────
function StandingsTable({ standings, division }) {
  const advanceCount = division.advanceCount || 2;
  const hasMultiTier = division.format === 'multi-tier' && division.playoffTiers;

  const getTeamCountry = (teamName) => {
    const team = (division.teams || []).find((t) => t.name === teamName);
    return team?.country || '';
  };

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-xs text-qw-muted border-b border-qw-border">
            <th className="text-center w-10 py-2">#</th>
            <th className="text-left py-2">Team</th>
            <th className="text-center w-10 py-2">W</th>
            <th className="text-center w-10 py-2">L</th>
            <th className="text-center w-14 py-2">Maps</th>
            <th className="text-center w-10 py-2">Pts</th>
          </tr>
        </thead>
        <tbody>
          {standings.map((team, idx) => {
            const position = idx + 1;
            let advances = false;
            let tierColor = null;

            if (hasMultiTier) {
              const tier = division.playoffTiers.find((t) => {
                const [start, end] = t.positions.split('-').map((n) => parseInt(n.trim()));
                return position >= start && position <= end;
              });
              if (tier) {
                advances = true;
                const tierColors = {
                  gold: 'bg-amber-500/15',
                  silver: 'bg-gray-300/15',
                  bronze: 'bg-orange-700/15',
                };
                tierColor = tierColors[tier.id] || 'bg-qw-win/10';
              }
            } else {
              advances = idx < advanceCount;
            }

            let badgeClass = 'bg-qw-border text-qw-muted';
            if (idx === 0) {
              badgeClass = 'bg-qw-accent text-qw-dark';
            } else if (advances) {
              badgeClass = 'bg-qw-win/30 text-qw-win';
            }

            const rowBg = advances ? tierColor || 'bg-qw-win/5' : '';
            const country = getTeamCountry(team.name);

            return (
              <tr key={team.name} className={`border-b border-qw-border/30 ${rowBg}`}>
                <td className="text-center py-2">
                  <span
                    className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-[10px] font-display font-bold ${badgeClass}`}
                  >
                    {position}
                  </span>
                </td>
                <td className="py-2">
                  <div className="flex items-center gap-2">
                    {country && (
                      <span className="text-sm flex-shrink-0" title={country.toUpperCase()}>
                        {countryToFlag(country)}
                      </span>
                    )}
                    <span
                      className={`font-body text-sm ${idx === 0 ? 'text-qw-accent font-semibold' : 'text-white'}`}
                    >
                      {team.name}
                    </span>
                  </div>
                </td>
                <td className="text-center font-mono text-qw-win">{team.matchesWon}</td>
                <td className="text-center font-mono text-qw-loss">{team.matchesLost}</td>
                <td className="text-center font-mono">
                  <span className="text-qw-win">{team.mapsWon}</span>
                  <span className="text-qw-muted">-</span>
                  <span className="text-qw-loss">{team.mapsLost}</span>
                </td>
                <td className="text-center">
                  <span
                    className={`font-display font-bold ${idx === 0 ? 'text-qw-accent' : 'text-white'}`}
                  >
                    {team.points}
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ─── Recent Results ───────────────────────────────────────────────────────────
function RecentResults({ matches }) {
  if (!matches || matches.length === 0) return null;

  // Get last 10 completed matches, newest first
  const recent = matches
    .filter((m) => m.status === 'completed' && m.maps?.length > 0)
    .slice(-10)
    .reverse();

  if (recent.length === 0) return null;

  return (
    <div className="mt-4">
      <h4 className="text-xs font-display text-qw-muted uppercase tracking-wider mb-2">
        Recent Results
      </h4>
      <div className="space-y-1">
        {recent.map((match) => {
          const t1Maps = match.maps.filter((m) => (m.score1 || 0) > (m.score2 || 0)).length;
          const t2Maps = match.maps.filter((m) => (m.score2 || 0) > (m.score1 || 0)).length;
          const t1Won = t1Maps > t2Maps;
          const t2Won = t2Maps > t1Maps;

          return (
            <div
              key={match.id}
              className="flex items-center gap-2 px-3 py-1.5 rounded bg-qw-dark/50 text-sm"
            >
              <span
                className={`flex-1 text-right truncate ${t1Won ? 'text-qw-win font-semibold' : 'text-white'}`}
              >
                {match.team1}
              </span>
              <span className="font-mono text-xs px-2 py-0.5 rounded bg-qw-border/50 text-qw-accent flex-shrink-0">
                {t1Maps}-{t2Maps}
              </span>
              <span
                className={`flex-1 truncate ${t2Won ? 'text-qw-win font-semibold' : 'text-white'}`}
              >
                {match.team2}
              </span>
              {match.date && (
                <span className="text-[10px] text-qw-muted flex-shrink-0 hidden sm:inline">
                  {formatDate(match.date)}
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Simple Bracket View ──────────────────────────────────────────────────────
function SimpleBracket({ bracket, schedule }) {
  if (!bracket) return null;

  // Helper to find match score from schedule
  const findScore = (team1, team2, roundHint) => {
    if (!team1 || !team2 || !schedule) return null;
    const t1 = team1.toLowerCase();
    const t2 = team2.toLowerCase();

    // Map roundHint to schedule round values
    const hintToRound = {
      quarter: 'quarter',
      semi: 'semi',
      final: 'final',
      third: 'third',
      'grand-final': 'grand',
      'losers-r1': 'lr1',
      'losers-r2': 'lr2',
      'losers-r3': 'lr3',
      'losers-final': 'lfinal',
    };
    const scheduleRound = hintToRound[roundHint] || roundHint;

    const match = schedule.find((m) => {
      const mt1 = m.team1?.toLowerCase();
      const mt2 = m.team2?.toLowerCase();
      const roundMatch = !scheduleRound || m.round === scheduleRound;
      return roundMatch && ((mt1 === t1 && mt2 === t2) || (mt1 === t2 && mt2 === t1));
    });

    if (!match || !match.maps?.length) return null;
    const s1 = match.maps.filter((m) => (m.score1 || 0) > (m.score2 || 0)).length;
    const s2 = match.maps.filter((m) => (m.score2 || 0) > (m.score1 || 0)).length;
    // Flip scores if teams are reversed
    if (match.team1?.toLowerCase() === t2) return { s1: s2, s2: s1 };
    return { s1, s2 };
  };

  const renderMatch = (match, roundHint) => {
    if (!match) return null;
    const t1 = match.team1 || 'TBD';
    const t2 = match.team2 || 'TBD';
    const hasTeams = match.team1 && match.team2;

    // Use scoreOverride first, then look up from schedule
    let score =
      match.scoreOverride || (hasTeams ? findScore(match.team1, match.team2, roundHint) : null);
    const t1Won = score && score.s1 > score.s2;
    const t2Won = score && score.s2 > score.s1;

    return (
      <div
        key={match.id}
        className="flex flex-col rounded bg-qw-dark border border-qw-border/50 overflow-hidden text-xs font-mono w-full max-w-[220px]"
      >
        <div
          className={`flex items-center justify-between px-2 py-1 ${t1Won ? 'bg-qw-win/10' : ''}`}
        >
          <span
            className={`truncate ${t1Won ? 'text-qw-win font-semibold' : hasTeams ? 'text-white' : 'text-qw-muted'}`}
          >
            {t1}
          </span>
          {score && (
            <span className={`ml-1 ${t1Won ? 'text-qw-win' : 'text-qw-muted'}`}>{score.s1}</span>
          )}
        </div>
        <div className="border-t border-qw-border/30" />
        <div
          className={`flex items-center justify-between px-2 py-1 ${t2Won ? 'bg-qw-win/10' : ''}`}
        >
          <span
            className={`truncate ${t2Won ? 'text-qw-win font-semibold' : hasTeams ? 'text-white' : 'text-qw-muted'}`}
          >
            {t2}
          </span>
          {score && (
            <span className={`ml-1 ${t2Won ? 'text-qw-win' : 'text-qw-muted'}`}>{score.s2}</span>
          )}
        </div>
      </div>
    );
  };

  const renderRound = (label, matches, roundHint) => {
    if (!matches) return null;
    const arr = Array.isArray(matches) ? matches : [matches];
    if (arr.length === 0) return null;

    return (
      <div className="space-y-2">
        <h5 className="text-[10px] font-display text-qw-muted uppercase tracking-wider">{label}</h5>
        <div className="space-y-2">{arr.map((m) => renderMatch(m, roundHint))}</div>
      </div>
    );
  };

  const { winners } = bracket;

  return (
    <div className="mt-4">
      <h4 className="text-xs font-display text-qw-muted uppercase tracking-wider mb-3">
        Playoff Bracket
      </h4>
      <div className="flex flex-wrap gap-6 overflow-x-auto pb-2">
        {winners.round32 && renderRound('Round of 32', winners.round32, 'r32')}
        {winners.round16 && renderRound('Round of 16', winners.round16, 'r16')}
        {winners.round12 && renderRound('Round of 12', winners.round12, 'r12')}
        {winners.quarterFinals && renderRound('Quarter-Finals', winners.quarterFinals, 'quarter')}
        {renderRound('Semi-Finals', winners.semiFinals, 'semi')}
        {renderRound('Final', winners.final, 'final')}
        {bracket.thirdPlace?.team1 && renderRound('3rd Place', bracket.thirdPlace, 'third')}
        {bracket.grandFinal?.team1 && renderRound('Grand Final', bracket.grandFinal, 'grand-final')}
      </div>

      {/* Losers bracket (simplified) */}
      {bracket.losers && Object.keys(bracket.losers).length > 0 && (
        <div className="mt-4">
          <h5 className="text-[10px] font-display text-qw-muted uppercase tracking-wider mb-2">
            Losers Bracket
          </h5>
          <div className="flex flex-wrap gap-6 overflow-x-auto pb-2">
            {Object.entries(bracket.losers).map(([roundKey, matches]) => {
              const label =
                roundKey === 'final' ? 'Losers Final' : `Losers ${roundKey.replace('round', 'R')}`;
              const hint =
                roundKey === 'final' ? 'losers-final' : `losers-${roundKey.replace('round', 'r')}`;
              return <div key={roundKey}>{renderRound(label, matches, hint)}</div>;
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Division Section ─────────────────────────────────────────────────────────
function DivisionSection({ division }) {
  const [expanded, setExpanded] = useState(true);

  // Group standings by group
  const standingsByGroup = useMemo(() => {
    if (!division.standings) return {};
    const groups = {};
    division.standings.forEach((team) => {
      const g = team.group || 'A';
      if (!groups[g]) groups[g] = [];
      groups[g].push(team);
    });
    return groups;
  }, [division.standings]);

  const numGroups = Object.keys(standingsByGroup).length;
  const teams = division.teams || [];
  const schedule = division.schedule || [];

  return (
    <div className="qw-panel overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full bg-qw-dark px-4 py-3 border-b border-qw-border flex items-center justify-between hover:bg-qw-dark/80 transition-colors"
      >
        <h3 className="font-display font-bold text-lg text-qw-accent">{division.name}</h3>
        <div className="flex items-center gap-3 text-xs text-qw-muted">
          <span>{teams.length} teams</span>
          <span className={`transition-transform ${expanded ? 'rotate-180' : ''}`}>&#9660;</span>
        </div>
      </button>

      {expanded && (
        <div className="p-4 space-y-4">
          {/* Standings per group */}
          {numGroups > 0 && (
            <div className={`grid gap-4 ${numGroups > 1 ? 'md:grid-cols-2' : ''}`}>
              {Object.entries(standingsByGroup)
                .sort()
                .map(([groupName, groupStandings]) => (
                  <div key={groupName}>
                    {numGroups > 1 && (
                      <h4 className="text-xs font-display text-qw-muted uppercase tracking-wider mb-2">
                        Group {groupName}
                      </h4>
                    )}
                    <StandingsTable standings={groupStandings} division={division} />
                  </div>
                ))}
            </div>
          )}

          {/* No standings yet */}
          {(!division.standings || division.standings.length === 0) && teams.length > 0 && (
            <p className="text-qw-muted text-sm text-center py-4">
              No results yet. Check back for standings once matches are played.
            </p>
          )}

          {/* Recent Results */}
          <RecentResults matches={schedule} />

          {/* Bracket */}
          {division.bracket &&
            (division.bracket.winners?.semiFinals || division.bracket.winners?.final) && (
              <SimpleBracket bracket={division.bracket} schedule={schedule} />
            )}

          {/* Multi-tier brackets */}
          {division.playoffTiers && division.playoffTiers.length > 0 && (
            <div className="space-y-4 mt-4">
              {division.playoffTiers.map(
                (tier) =>
                  tier.bracket && (
                    <div key={tier.id}>
                      <h4 className="text-xs font-display text-qw-accent uppercase tracking-wider mb-2">
                        {tier.name}
                      </h4>
                      <SimpleBracket bracket={tier.bracket} schedule={schedule} />
                    </div>
                  )
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Main Public Tournament Page ──────────────────────────────────────────────
export default function PublicTournament({ slug }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState(null);

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch(`/api/public/${slug}`);
      if (res.status === 404) {
        setError('Tournament not found');
        setLoading(false);
        return;
      }
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      setData(json);
      setError(null);
      setLastUpdated(new Date());
    } catch (err) {
      // Only set error on initial load; keep stale data on refresh failures
      if (!data) {
        setError(err.message);
      }
    } finally {
      setLoading(false);
    }
  }, [slug, data]);

  // Initial fetch
  useEffect(() => {
    setLoading(true);
    setData(null);
    setError(null);
    fetchData();
  }, [slug]); // eslint-disable-line react-hooks/exhaustive-deps

  // Polling
  useEffect(() => {
    const interval = setInterval(fetchData, POLL_INTERVAL);
    return () => clearInterval(interval);
  }, [fetchData]);

  // ─── Loading State ────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="min-h-screen bg-qw-darker flex items-center justify-center">
        <div className="text-center">
          <div className="font-logo text-2xl text-qw-accent mb-4">QWICKY</div>
          <div className="text-qw-muted text-sm font-mono animate-pulse">Loading tournament...</div>
        </div>
      </div>
    );
  }

  // ─── Error State ──────────────────────────────────────────────────────
  if (error && !data) {
    return (
      <div className="min-h-screen bg-qw-darker flex items-center justify-center">
        <div className="qw-panel p-8 text-center max-w-md">
          <div className="font-logo text-2xl text-qw-accent mb-4">QWICKY</div>
          <h2 className="font-display text-xl text-white mb-2">
            {error === 'Tournament not found' ? 'Tournament Not Found' : 'Error'}
          </h2>
          <p className="text-qw-muted text-sm mb-4">
            {error === 'Tournament not found'
              ? `No tournament with slug "${slug}" was found.`
              : `Failed to load tournament: ${error}`}
          </p>
          <a href="/" className="qw-btn inline-block px-6 py-2 text-sm font-display font-semibold">
            Go to QWICKY
          </a>
        </div>
      </div>
    );
  }

  const tournament = data;
  const divisions = tournament.divisions || [];

  // Stats
  const totalTeams = divisions.reduce((sum, d) => sum + (d.teams?.length || 0), 0);
  const totalMatches = divisions.reduce((sum, d) => sum + (d.schedule?.length || 0), 0);
  const completedMatches = divisions.reduce(
    (sum, d) => sum + (d.schedule?.filter((m) => m.status === 'completed')?.length || 0),
    0
  );

  return (
    <div className="min-h-screen bg-qw-darker">
      {/* Header */}
      <header className="bg-qw-panel border-b border-qw-border">
        <div className="max-w-5xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="font-logo text-lg text-qw-accent tracking-wider">QW</span>
              <span className="text-qw-border">|</span>
              <span className="text-xs text-qw-muted font-mono uppercase tracking-wider">
                Tournament
              </span>
            </div>
            <div className="text-xs text-qw-muted font-mono">
              {lastUpdated && (
                <span title="Auto-refreshes every 60s">
                  Updated {lastUpdated.toLocaleTimeString()}
                </span>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Tournament Title */}
      <div className="max-w-5xl mx-auto px-4 py-6">
        <div className="mb-6">
          <h1 className="font-display font-bold text-2xl sm:text-3xl text-white mb-2">
            {tournament.name || 'Untitled Tournament'}
          </h1>
          <div className="flex flex-wrap items-center gap-3 text-sm text-qw-muted">
            {tournament.mode && (
              <span className="px-2 py-0.5 rounded bg-qw-accent/15 text-qw-accent font-mono text-xs uppercase">
                {tournament.mode}
              </span>
            )}
            {(tournament.startDate || tournament.endDate) && (
              <span className="font-mono text-xs">
                {formatDate(tournament.startDate)}
                {tournament.startDate && tournament.endDate && ' \u2013 '}
                {formatDate(tournament.endDate)}
              </span>
            )}
            <span className="text-qw-border">|</span>
            <span className="font-mono text-xs">
              <span className="text-qw-accent">{divisions.length}</span> div
              {divisions.length !== 1 ? 's' : ''}
            </span>
            <span className="font-mono text-xs">
              <span className="text-qw-accent">{totalTeams}</span> teams
            </span>
            <span className="font-mono text-xs">
              <span className="text-qw-win">{completedMatches}</span>/
              <span className="text-white">{totalMatches}</span> matches
            </span>
          </div>
        </div>

        {/* Divisions */}
        {divisions.length === 0 ? (
          <div className="qw-panel p-8 text-center">
            <p className="text-qw-muted">No divisions configured yet.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {divisions.map((div) => (
              <DivisionSection key={div.id} division={div} />
            ))}
          </div>
        )}
      </div>

      {/* Footer */}
      <footer className="border-t border-qw-border mt-12 py-4">
        <div className="max-w-5xl mx-auto px-4 flex items-center justify-between text-xs text-qw-muted font-mono">
          <span>
            Powered by <span className="font-logo text-qw-accent">QWICKY</span>
          </span>
          <span>QuakeWorld Tournament Admin</span>
        </div>
      </footer>
    </div>
  );
}
