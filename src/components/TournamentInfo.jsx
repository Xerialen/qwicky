// src/components/TournamentInfo.jsx
import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { calculateStandings } from './division/DivisionStandings';

const countryToFlag = (code) => {
  if (!code || code.length !== 2) return '';
  return String.fromCodePoint(
    ...code.toUpperCase().split('').map(c => 0x1F1E6 + c.charCodeAt(0) - 65)
  );
};

function DivisionStandingsCard({ division, onNavigate }) {
  const schedule = division.schedule || [];
  const { standings } = useMemo(
    () => calculateStandings(schedule, division),
    [schedule, division]
  );

  const standingsByGroup = useMemo(() => {
    const groups = {};
    standings.forEach(team => {
      const g = team.group || 'A';
      if (!groups[g]) groups[g] = [];
      groups[g].push(team);
    });
    return groups;
  }, [standings]);

  const teams = division.teams || [];
  if (teams.length === 0) return null;

  const numGroups = Object.keys(standingsByGroup).length;
  const advanceCount = division.advanceCount || 2;
  const hasMultiTier = division.format === 'multi-tier' && division.playoffTiers;

  // Get team country from division.teams
  const getTeamCountry = (teamName) => {
    const team = teams.find(t => t.name === teamName);
    return team?.country || '';
  };

  return (
    <div className="qw-panel overflow-hidden">
      <button
        onClick={() => onNavigate(division.id)}
        className="w-full bg-qw-dark px-4 py-3 border-b border-qw-border flex items-center justify-between hover:bg-qw-dark/80 transition-colors group"
      >
        <h3 className="font-display font-bold text-qw-accent group-hover:text-white transition-colors">
          {division.name}
        </h3>
        <span className="text-xs text-qw-muted">
          {teams.length} teams
        </span>
      </button>

      <div className={`${numGroups > 1 ? 'divide-y divide-qw-border/30' : ''}`}>
        {Object.entries(standingsByGroup).sort().map(([groupName, groupStandings]) => (
          <div key={groupName} className="px-3 py-2">
            {numGroups > 1 && (
              <div className="text-[10px] font-display text-qw-muted uppercase tracking-wider mb-1">
                Group {groupName}
              </div>
            )}
            <div className="space-y-0.5">
              {groupStandings.map((team, idx) => {
                const position = idx + 1;
                let advances = false;
                let tierColor = null;

                if (hasMultiTier) {
                  const tier = division.playoffTiers.find(t => {
                    const [start, end] = t.positions.split('-').map(n => parseInt(n.trim()));
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

                // Badge colors
                let badgeClass = 'bg-qw-border text-qw-muted';
                if (idx === 0) {
                  badgeClass = 'bg-qw-accent text-qw-dark';
                } else if (advances) {
                  badgeClass = 'bg-qw-win/30 text-qw-win';
                }

                const rowBg = advances ? (tierColor || 'bg-qw-win/5') : '';
                const country = getTeamCountry(team.name);

                return (
                  <div
                    key={team.name}
                    className={`flex items-center gap-2 px-2 py-1 rounded text-sm ${rowBg}`}
                  >
                    <span className={`inline-flex items-center justify-center w-5 h-5 rounded-full text-[10px] font-display font-bold flex-shrink-0 ${badgeClass}`}>
                      {position}
                    </span>
                    {country && (
                      <span className="text-sm flex-shrink-0" title={country.toUpperCase()}>
                        {countryToFlag(country)}
                      </span>
                    )}
                    <span className={`truncate font-body text-sm ${idx === 0 ? 'text-qw-accent font-semibold' : 'text-white'}`}>
                      {team.name}
                    </span>
                    <span className="ml-auto flex-shrink-0 font-mono text-xs text-qw-muted">
                      <span className="text-qw-win">{team.matchesWon}</span>
                      <span className="text-qw-muted">-</span>
                      <span className="text-qw-loss">{team.matchesLost}</span>
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function TournamentInfo({ tournament, updateTournament, onNavigateToDivision }) {
  const [copiedField, setCopiedField] = useState(null);
  const [showSettings, setShowSettings] = useState(false);
  const [channels, setChannels] = useState(null);
  const [channelsLoading, setChannelsLoading] = useState(false);
  const [channelsError, setChannelsError] = useState(null);

  const tournamentSlug = (tournament.name || 'my-tournament')
    .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

  const loadChannels = useCallback(async () => {
    setChannelsLoading(true);
    setChannelsError(null);
    try {
      const res = await fetch('/api/channels');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setChannels(data.channels || []);
    } catch (err) {
      setChannelsError(err.message);
    } finally {
      setChannelsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadChannels();
  }, [loadChannels]);

  const botInviteUrl = 'https://discord.com/oauth2/authorize?client_id=1469479991929733140&permissions=83968&integration_type=0&scope=bot+applications.commands';

  const copyToClipboard = (text, field) => {
    navigator.clipboard.writeText(text);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 2000);
  };

  // Determine if we should show the overview (has divisions with teams)
  const hasDivisionsWithTeams = tournament.divisions.length > 0 &&
    tournament.divisions.some(d => d.teams?.length > 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="font-display font-bold text-2xl text-white flex items-center gap-3">
          <span className="text-qw-accent">🏠</span>
          {hasDivisionsWithTeams ? 'Tournament Overview' : 'Tournament Information'}
        </h2>
      </div>

      {/* Standings Overview (when tournament has divisions with teams) */}
      {hasDivisionsWithTeams && (
        <>
          <div className={`grid gap-4 ${
            tournament.divisions.length === 1 ? 'grid-cols-1 max-w-xl' :
            tournament.divisions.length === 2 ? 'grid-cols-1 md:grid-cols-2' :
            'grid-cols-1 md:grid-cols-2 lg:grid-cols-3'
          }`}>
            {tournament.divisions.map(div => (
              <DivisionStandingsCard
                key={div.id}
                division={div}
                onNavigate={onNavigateToDivision}
              />
            ))}
          </div>

          {/* Settings toggle */}
          <button
            onClick={() => setShowSettings(!showSettings)}
            className="flex items-center gap-2 text-sm text-qw-muted hover:text-white transition-colors"
          >
            <span className={`transition-transform ${showSettings ? 'rotate-90' : ''}`}>
              ▸
            </span>
            <span>{showSettings ? 'Hide Settings' : 'Show Settings'}</span>
          </button>
        </>
      )}

      {/* Settings panels (always shown for new tournaments, collapsible for active ones) */}
      {(!hasDivisionsWithTeams || showSettings) && (
        <>
          <div className="qw-panel p-6">
            <h3 className="font-display text-lg text-qw-accent mb-4">BASIC INFO</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-qw-muted text-sm mb-1">Tournament Name</label>
                <input
                  type="text"
                  value={tournament.name || ''}
                  onChange={(e) => updateTournament({ name: e.target.value })}
                  placeholder="e.g., QW Champions League Season 5"
                  className="w-full bg-qw-dark border border-qw-border rounded px-4 py-2 text-white"
                />
              </div>
              <div>
                <label className="block text-qw-muted text-sm mb-1">Game Mode</label>
                <select
                  value={tournament.mode || '4on4'}
                  onChange={(e) => updateTournament({ mode: e.target.value })}
                  className="w-full bg-qw-dark border border-qw-border rounded px-4 py-2 text-white"
                >
                  <option value="1on1">1on1 (Duel)</option>
                  <option value="2on2">2on2</option>
                  <option value="4on4">4on4</option>
                  <option value="ctf">CTF</option>
                </select>
              </div>
              <div>
                <label className="block text-qw-muted text-sm mb-1">Start Date</label>
                <input
                  type="date"
                  value={tournament.startDate || ''}
                  onChange={(e) => updateTournament({ startDate: e.target.value })}
                  className="w-full bg-qw-dark border border-qw-border rounded px-4 py-2 text-white"
                />
              </div>
              <div>
                <label className="block text-qw-muted text-sm mb-1">End Date</label>
                <input
                  type="date"
                  value={tournament.endDate || ''}
                  onChange={(e) => updateTournament({ endDate: e.target.value })}
                  className="w-full bg-qw-dark border border-qw-border rounded px-4 py-2 text-white"
                />
              </div>
            </div>
          </div>

          {/* Discord Integration */}
          <div className="qw-panel p-6">
            <h3 className="font-display text-lg text-qw-accent mb-4">DISCORD INTEGRATION</h3>
            <p className="text-qw-muted text-sm mb-4">
              Connect a Discord channel so players can submit match results by posting hub URLs.
            </p>

            <div className="space-y-4">
              {/* Tournament ID */}
              <div className="p-4 bg-qw-dark rounded border border-qw-border">
                <label className="block text-qw-muted text-sm mb-1">Tournament ID (use this with /register)</label>
                <div className="flex items-center gap-2">
                  <code className="flex-1 bg-qw-darker px-4 py-2 rounded font-mono text-white text-sm">
                    {tournamentSlug}
                  </code>
                  <button
                    onClick={() => copyToClipboard(tournamentSlug, 'slug')}
                    className="px-3 py-2 rounded bg-qw-accent text-qw-dark text-sm font-semibold hover:bg-qw-accent/80"
                  >
                    {copiedField === 'slug' ? 'Copied!' : 'Copy'}
                  </button>
                </div>
              </div>

              {/* Register command */}
              <div className="p-4 bg-qw-dark rounded border border-qw-border">
                <label className="block text-qw-muted text-sm mb-1">Register command (paste in Discord)</label>
                <div className="flex items-center gap-2">
                  <code className="flex-1 bg-qw-darker px-4 py-2 rounded font-mono text-white text-sm">
                    /register tournament-id:{tournamentSlug}
                  </code>
                  <button
                    onClick={() => copyToClipboard(`/register tournament-id:${tournamentSlug}`, 'cmd')}
                    className="px-3 py-2 rounded bg-qw-accent text-qw-dark text-sm font-semibold hover:bg-qw-accent/80"
                  >
                    {copiedField === 'cmd' ? 'Copied!' : 'Copy'}
                  </button>
                </div>
              </div>

              {/* Bot invite */}
              <div className="p-4 bg-qw-dark rounded border border-qw-border">
                <label className="block text-qw-muted text-sm mb-2">Setup steps</label>
                <ol className="text-sm text-qw-muted space-y-2 list-decimal list-inside">
                  <li>
                    <a href={botInviteUrl} target="_blank" rel="noopener noreferrer" className="text-qw-accent hover:underline">
                      Invite QWICKY Bot to your Discord server
                    </a>
                  </li>
                  <li>Go to the channel where players will post results</li>
                  <li>Type the register command above</li>
                  <li>Players can now post hub.quakeworld.nu links and the bot will track them</li>
                  <li>Review submissions in the <span className="text-qw-accent">Results</span> tab of each division</li>
                </ol>
              </div>

              {/* Registered Channels status */}
              <div className="p-4 bg-qw-dark rounded border border-qw-border">
                <div className="flex items-center justify-between mb-3">
                  <label className="block text-qw-muted text-sm">Registered Channels</label>
                  <button
                    onClick={loadChannels}
                    disabled={channelsLoading}
                    className="px-2 py-1 text-xs rounded bg-qw-darker border border-qw-border text-qw-muted hover:text-white hover:border-qw-accent transition-all disabled:opacity-50"
                  >
                    {channelsLoading ? 'Loading…' : 'Refresh'}
                  </button>
                </div>

                {channelsError && (
                  <p className="text-qw-loss text-xs font-mono">Error: {channelsError}</p>
                )}

                {!channelsError && channels !== null && channels.length === 0 && (
                  <p className="text-qw-muted text-sm italic">No channels registered yet.</p>
                )}

                {!channelsError && channels !== null && channels.length > 0 && (
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs font-mono">
                      <thead>
                        <tr className="text-qw-muted border-b border-qw-border">
                          <th className="text-left pb-2 pr-4">Tournament</th>
                          <th className="text-left pb-2 pr-4">Division</th>
                          <th className="text-left pb-2 pr-4">Channel</th>
                          <th className="text-left pb-2 pr-4">Last game</th>
                          <th className="text-left pb-2">Activity</th>
                        </tr>
                      </thead>
                      <tbody>
                        {channels.map(ch => {
                          const isCurrent = ch.tournament_id === tournamentSlug;
                          const lastDate = ch.latest_submission_at;
                          const gameDate = ch.latest_game_date
                            ? ch.latest_game_date.split(' ')[0]
                            : null;
                          const daysAgo = lastDate
                            ? Math.floor((Date.now() - new Date(lastDate).getTime()) / 86400000)
                            : null;
                          const activityColor =
                            daysAgo === null ? 'text-qw-muted' :
                            daysAgo > 30 ? 'text-qw-loss' :
                            daysAgo > 14 ? 'text-yellow-400' :
                            'text-qw-win';
                          const activityLabel =
                            daysAgo === null ? 'never' :
                            daysAgo === 0 ? 'today' :
                            `${daysAgo}d ago`;

                          return (
                            <tr
                              key={ch.discord_channel_id}
                              className={`border-b border-qw-border/20 ${isCurrent ? 'text-qw-accent' : 'text-qw-text'}`}
                            >
                              <td className="py-1.5 pr-4">
                                {isCurrent && <span className="text-qw-win mr-1">●</span>}
                                {ch.tournament_id}
                              </td>
                              <td className="py-1.5 pr-4 text-qw-muted">
                                {ch.division_id || '—'}
                              </td>
                              <td className="py-1.5 pr-4 text-qw-muted">
                                …{ch.discord_channel_id.slice(-7)}
                              </td>
                              <td className="py-1.5 pr-4">
                                {gameDate || '—'}
                              </td>
                              <td className={`py-1.5 ${activityColor}`}>
                                {activityLabel}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}

                {channelsLoading && channels === null && (
                  <p className="text-qw-muted text-xs font-mono animate-pulse">Fetching channels…</p>
                )}
              </div>
            </div>
          </div>

          {/* Instructions */}
          <div className="qw-panel p-6">
            <h3 className="font-display text-lg text-qw-accent mb-4">WORKFLOW</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <div className="p-4 bg-qw-dark rounded border border-qw-border">
                <div className="flex items-center gap-2 mb-2">
                  <span className="w-6 h-6 rounded-full bg-qw-accent text-qw-dark flex items-center justify-center font-display font-bold text-sm">1</span>
                  <h4 className="font-display text-white">Create Divisions</h4>
                </div>
                <p className="text-qw-muted text-sm">
                  Set up divisions (e.g., Div 1, Div 2) with their own format settings.
                </p>
              </div>
              <div className="p-4 bg-qw-dark rounded border border-qw-border">
                <div className="flex items-center gap-2 mb-2">
                  <span className="w-6 h-6 rounded-full bg-qw-accent text-qw-dark flex items-center justify-center font-display font-bold text-sm">2</span>
                  <h4 className="font-display text-white">Add Teams</h4>
                </div>
                <p className="text-qw-muted text-sm">
                  Add teams to each division with names and country codes.
                </p>
              </div>
              <div className="p-4 bg-qw-dark rounded border border-qw-border">
                <div className="flex items-center gap-2 mb-2">
                  <span className="w-6 h-6 rounded-full bg-qw-accent text-qw-dark flex items-center justify-center font-display font-bold text-sm">3</span>
                  <h4 className="font-display text-white">Generate Schedule</h4>
                </div>
                <p className="text-qw-muted text-sm">
                  Auto-generate group stage matches or add manually.
                </p>
              </div>
              <div className="p-4 bg-qw-dark rounded border border-qw-border">
                <div className="flex items-center gap-2 mb-2">
                  <span className="w-6 h-6 rounded-full bg-qw-accent text-qw-dark flex items-center justify-center font-display font-bold text-sm">4</span>
                  <h4 className="font-display text-white">Import Results</h4>
                </div>
                <p className="text-qw-muted text-sm">
                  Fetch from API or upload JSON files with game results.
                </p>
              </div>
              <div className="p-4 bg-qw-dark rounded border border-qw-border">
                <div className="flex items-center gap-2 mb-2">
                  <span className="w-6 h-6 rounded-full bg-qw-accent text-qw-dark flex items-center justify-center font-display font-bold text-sm">5</span>
                  <h4 className="font-display text-white">View Standings</h4>
                </div>
                <p className="text-qw-muted text-sm">
                  See auto-calculated group standings and playoff brackets.
                </p>
              </div>
              <div className="p-4 bg-qw-dark rounded border border-qw-border">
                <div className="flex items-center gap-2 mb-2">
                  <span className="w-6 h-6 rounded-full bg-qw-accent text-qw-dark flex items-center justify-center font-display font-bold text-sm">6</span>
                  <h4 className="font-display text-white">Export to Wiki</h4>
                </div>
                <p className="text-qw-muted text-sm">
                  Generate MediaWiki markup for Liquipedia pages.
                </p>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Quick Overview (only when no teams yet but divisions exist) */}
      {!hasDivisionsWithTeams && (
        <div className="qw-panel p-6">
          <h3 className="font-display text-lg text-qw-accent mb-4">OVERVIEW</h3>

          {tournament.divisions.length === 0 ? (
            <div className="text-center py-8">
              <div className="text-5xl mb-4">🚀</div>
              <h4 className="font-display text-xl text-white mb-2">Ready to Get Started?</h4>
              <p className="text-qw-muted mb-4">
                Create divisions to organize your tournament. Each division can have its own teams, format, and schedule.
              </p>
              <p className="text-qw-muted text-sm">
                Go to <span className="text-qw-accent">Divisions</span> tab to create your first division.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {tournament.divisions.map((div, idx) => {
                const completedMatches = div.schedule?.filter(m => m.status === 'completed').length || 0;
                const totalMatches = div.schedule?.length || 0;
                const progress = totalMatches > 0 ? Math.round((completedMatches / totalMatches) * 100) : 0;

                return (
                  <div key={div.id} className="p-4 bg-qw-dark rounded border border-qw-border">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-3">
                        <span className="w-8 h-8 rounded bg-qw-accent/20 flex items-center justify-center font-display font-bold text-qw-accent">
                          {idx + 1}
                        </span>
                        <div>
                          <h4 className="font-body font-semibold text-white">{div.name}</h4>
                          <p className="text-xs text-qw-muted">
                            {div.teams?.length || 0} teams • {div.numGroups} groups • Bo{div.groupStageBestOf} groups / Bo{div.playoffFinalBestOf} final
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-mono text-sm text-white">
                          {completedMatches}/{totalMatches} matches
                        </div>
                        <div className="text-xs text-qw-muted">{progress}% complete</div>
                      </div>
                    </div>

                    {/* Progress bar */}
                    <div className="h-1.5 bg-qw-border rounded-full overflow-hidden">
                      <div
                        className="h-full bg-qw-accent rounded-full transition-all"
                        style={{ width: `${progress}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
