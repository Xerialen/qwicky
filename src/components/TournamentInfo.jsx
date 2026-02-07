// src/components/TournamentInfo.jsx
import React, { useState } from 'react';

export default function TournamentInfo({ tournament, updateTournament }) {
  const [copiedField, setCopiedField] = useState(null);

  const tournamentSlug = (tournament.name || 'my-tournament')
    .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

  const botInviteUrl = 'https://discord.com/oauth2/authorize?client_id=1469479991929733140&permissions=83968&integration_type=0&scope=bot+applications.commands';

  const copyToClipboard = (text, field) => {
    navigator.clipboard.writeText(text);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 2000);
  };
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="font-display font-bold text-2xl text-white flex items-center gap-3">
          <span className="text-qw-accent">🏠</span>
          Tournament Information
        </h2>
      </div>

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

      {/* Quick Overview */}
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
    </div>
  );
}
