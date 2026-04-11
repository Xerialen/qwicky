import { useState } from 'react';
import MaterialIcon from './ui/MaterialIcon';
import HudPanel from './ui/HudPanel';
import SectionLabel from './ui/SectionLabel';
import WikiSetupWizard from './WikiSetupWizard';

export default function Dashboard({ tournament, updateTournament, onNavigateToDivision }) {
  const divisions = tournament.divisions || [];
  const [showWikiWizard, setShowWikiWizard] = useState(false);
  const [bannerDismissed, setBannerDismissed] = useState(false);
  const wikiConnected = tournament.wikiConfig?.enabled === true;

  // Calculate stats
  const totalTeams = divisions.reduce((sum, d) => sum + (d.teams?.length || 0), 0);
  const totalMatches = divisions.reduce((sum, d) => sum + (d.schedule?.length || 0), 0);
  const completedMatches = divisions.reduce(
    (sum, d) => sum + (d.schedule?.filter((m) => m.status === 'completed')?.length || 0),
    0
  );
  const pendingMatches = totalMatches - completedMatches;

  // Recent completed matches across all divisions (last 5)
  const recentResults = divisions
    .flatMap((d) =>
      (d.schedule || [])
        .filter((m) => m.status === 'completed' && m.team1Score !== undefined)
        .map((m) => ({ ...m, divisionName: d.name }))
    )
    .slice(-5)
    .reverse();

  // Upcoming scheduled matches
  const upcoming = divisions
    .flatMap((d) =>
      (d.schedule || [])
        .filter((m) => m.status !== 'completed')
        .slice(0, 3)
        .map((m) => ({ ...m, divisionName: d.name }))
    )
    .slice(0, 4);

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {!wikiConnected && !bannerDismissed && (
        <div
          data-testid="wiki-connect-banner"
          className="qw-panel p-4 flex items-center gap-4 border-l-4 border-primary"
        >
          <div className="flex-1">
            <div className="text-on-surface font-semibold text-sm">
              This tournament isn't connected to the wiki yet.
            </div>
            <div className="text-on-surface-variant text-xs mt-1">
              Set it up so results auto-publish as games are approved.
            </div>
          </div>
          <button
            onClick={() => setShowWikiWizard(true)}
            className="qw-btn px-4 py-2 text-sm"
          >
            Connect to Wiki
          </button>
          <button
            onClick={() => setBannerDismissed(true)}
            className="qw-btn-secondary px-3 py-2 text-xs"
          >
            Dismiss
          </button>
        </div>
      )}

      {showWikiWizard && (
        <WikiSetupWizard
          tournament={tournament}
          updateTournament={updateTournament}
          onClose={() => setShowWikiWizard(false)}
        />
      )}

      {/* Header HUD Stats */}
      <section className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4 border-b-2 border-surface-container-high pb-6">
        <div>
          <h1 className="font-headline text-3xl font-black tracking-tighter text-on-surface leading-tight">
            {tournament.name || 'UNTITLED TOURNAMENT'}
          </h1>
          <div className="flex items-center gap-4 mt-1">
            <span className="font-mono text-[10px] text-secondary flex items-center gap-1">
              <span className="w-1.5 h-1.5 bg-secondary rounded-full" />
              SYSTEM_ONLINE
            </span>
            <span className="font-mono text-[10px] text-on-surface-variant/40">
              MODE: {tournament.mode?.toUpperCase() || '4ON4'}
            </span>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-6">
          <div className="flex flex-col">
            <span className="font-headline uppercase text-[9px] tracking-widest text-on-surface-variant/50">
              Total Matches
            </span>
            <span className="font-mono text-xl font-bold text-primary">
              {totalMatches.toLocaleString()}
            </span>
          </div>
          <div className="flex flex-col">
            <span className="font-headline uppercase text-[9px] tracking-widest text-on-surface-variant/50">
              Pending
            </span>
            <span className="font-mono text-xl font-bold text-error">
              {pendingMatches}
            </span>
          </div>
          <div className="flex flex-col">
            <span className="font-headline uppercase text-[9px] tracking-widest text-on-surface-variant/50">
              Active Teams
            </span>
            <span className="font-mono text-xl font-bold text-tertiary">
              {totalTeams}
            </span>
          </div>
        </div>
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column */}
        <div className="lg:col-span-8 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Division Progress */}
            <HudPanel ribbon="active" className="p-5">
              <SectionLabel className="mb-6 block">Division Progress</SectionLabel>
              <div className="space-y-5">
                {divisions.length === 0 ? (
                  <p className="text-on-surface-variant/40 text-xs font-mono">
                    No divisions configured yet
                  </p>
                ) : (
                  divisions.map((div) => {
                    const total = div.schedule?.length || 0;
                    const done = div.schedule?.filter((m) => m.status === 'completed')?.length || 0;
                    const pct = total > 0 ? Math.round((done / total) * 100) : 0;
                    return (
                      <div key={div.id} className="space-y-1.5">
                        <div className="flex justify-between font-mono text-[10px] uppercase">
                          <span className="text-on-surface">{div.name}</span>
                          <span className="text-primary">{pct}%</span>
                        </div>
                        <div className="h-2 bg-surface-container-lowest w-full">
                          <div
                            className="h-full bg-primary transition-all"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </HudPanel>

            {/* Pending Submissions */}
            <HudPanel variant="lowest" className="p-5 flex flex-col justify-between border-b-4 border-error/50">
              <div>
                <SectionLabel className="mb-2 block">Pending Actions</SectionLabel>
                <p className="text-on-surface-variant/50 text-xs leading-relaxed">
                  Matches awaiting results or admin verification.
                </p>
              </div>
              <div className="mt-4 flex items-end justify-between">
                <span className="font-mono text-5xl font-black text-error leading-none">
                  {pendingMatches}
                </span>
                {pendingMatches > 0 && divisions.length > 0 && (
                  <button
                    onClick={() => onNavigateToDivision?.(divisions[0].id, 'results')}
                    className="text-[9px] uppercase tracking-tighter border border-error text-error px-2 py-1 hover:bg-error hover:text-on-error transition-all font-bold"
                  >
                    Review Now
                  </button>
                )}
              </div>
            </HudPanel>
          </div>

          {/* Recent Results */}
          <HudPanel variant="default" className="border border-outline-variant/15 overflow-hidden">
            <div className="bg-surface-container-high px-4 py-3 border-b border-outline-variant/10 flex justify-between items-center">
              <SectionLabel>Live Feed: Recent Results</SectionLabel>
              <span className="font-mono text-[9px] text-on-surface-variant/30">
                {recentResults.length} ENTRIES
              </span>
            </div>
            <div className="divide-y divide-outline-variant/10">
              {recentResults.length === 0 ? (
                <div className="p-4 text-center text-on-surface-variant/40 font-mono text-xs">
                  No completed matches yet
                </div>
              ) : (
                recentResults.map((m, i) => (
                  <div
                    key={i}
                    className="p-4 flex items-center justify-between hover:bg-surface-container-low transition-colors"
                  >
                    <div className="flex items-center gap-6">
                      <div className="flex items-center gap-3">
                        <span className="font-mono font-bold text-on-surface uppercase text-sm">
                          {m.team1 || 'TBD'}
                        </span>
                        <span className="font-mono text-primary font-black bg-primary-container/20 px-2">
                          {m.team1Score ?? '?'} - {m.team2Score ?? '?'}
                        </span>
                        <span className="font-mono font-bold text-on-surface-variant/50 uppercase text-sm">
                          {m.team2 || 'TBD'}
                        </span>
                      </div>
                      <span className="text-[9px] font-headline uppercase px-1.5 py-0.5 bg-surface-container-highest text-on-surface-variant/50">
                        {m.divisionName}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </HudPanel>
        </div>

        {/* Right Column */}
        <div className="lg:col-span-4 space-y-6">
          {/* Quick Actions */}
          <div className="bg-surface-container-high p-1 flex flex-col gap-1 border border-outline-variant/15">
            {divisions.length > 0 && (
              <>
                <button
                  onClick={() => onNavigateToDivision?.(divisions[0].id, 'results')}
                  className="bg-surface-container px-4 py-4 flex items-center justify-between hover:bg-surface-variant transition-colors border-l-2 border-secondary group text-left"
                >
                  <span className="font-headline font-bold uppercase text-[10px] text-on-surface">
                    Enter Results
                  </span>
                  <MaterialIcon
                    name="edit_note"
                    className="text-secondary text-sm group-hover:rotate-12 transition-transform"
                  />
                </button>
                <button
                  onClick={() => onNavigateToDivision?.(divisions[0].id, 'schedule')}
                  className="bg-surface-container px-4 py-4 flex items-center justify-between hover:bg-surface-variant transition-colors border-l-2 border-on-surface-variant/30 group text-left"
                >
                  <span className="font-headline font-bold uppercase text-[10px] text-on-surface">
                    View Schedule
                  </span>
                  <MaterialIcon
                    name="schema"
                    className="text-on-surface-variant/50 text-sm group-hover:scale-110 transition-transform"
                  />
                </button>
              </>
            )}
          </div>

          {/* Upcoming Schedule */}
          <HudPanel variant="lowest" className="border border-outline-variant/15 p-5">
            <div className="flex justify-between items-center mb-6">
              <SectionLabel>Upcoming</SectionLabel>
            </div>
            <div className="space-y-4">
              {upcoming.length === 0 ? (
                <p className="text-on-surface-variant/40 font-mono text-xs">
                  No upcoming matches
                </p>
              ) : (
                upcoming.map((m, i) => (
                  <div
                    key={i}
                    className="flex gap-4 items-start pb-4 border-b border-outline-variant/10 last:border-0"
                  >
                    <span className="font-mono text-xs text-on-surface-variant/50 px-2 py-1 bg-surface-container-high shrink-0">
                      R{m.round || '?'}
                    </span>
                    <div>
                      <p className="font-mono text-[10px] text-on-surface uppercase font-bold">
                        {m.team1 || 'TBD'} vs {m.team2 || 'TBD'}
                      </p>
                      <p className="font-mono text-[9px] text-on-surface-variant/40 mt-1">
                        {m.divisionName}
                      </p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </HudPanel>
        </div>
      </div>
    </div>
  );
}
