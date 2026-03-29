// src/components/WikiSetupWizard.jsx
// 3-step wizard for connecting a QWICKY tournament to the QW Wiki.
// Step 1: Search for existing tournament pages on the wiki
// Step 2: Confirm/edit tournament metadata for the infobox
// Step 3: Preview and create page structure

import React, { useState } from 'react';

export default function WikiSetupWizard({ tournament, updateTournament, onClose }) {
  const [step, setStep] = useState(1);

  // Step 1 state
  const [searchQuery, setSearchQuery] = useState(tournament.name || '');
  const [searchResults, setSearchResults] = useState(null);
  const [searchLoading, setSearchLoading] = useState(false);
  const [selectedRoot, setSelectedRoot] = useState('');
  const [seasonName, setSeasonName] = useState('');
  const [createNew, setCreateNew] = useState(false);

  // Step 2 state
  const [navbox, setNavbox] = useState(tournament.wikiConfig?.navbox || '');
  const [infobox, setInfobox] = useState({
    name: tournament.name || '',
    image: '',
    organizer: '',
    type: 'Online',
    website: '',
    discord: '',
    twitch: '',
    prizepool: '',
    ...tournament.wikiConfig?.infobox,
  });

  // Step 3 state
  const [scaffoldLoading, setScaffoldLoading] = useState(false);
  const [scaffoldResult, setScaffoldResult] = useState(null);

  // Derived
  const divisionNames = (tournament.divisions || []).map(d => d.name);
  const seasonPage = selectedRoot
    ? `${selectedRoot}/${seasonName}`
    : seasonName;

  // ── Step 1: Search ──────────────────────────────────────────────────────────
  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    setSearchLoading(true);
    setSearchResults(null);
    try {
      const res = await fetch(`/api/wiki?action=scan&q=${encodeURIComponent(searchQuery)}`);
      const data = await res.json();
      setSearchResults(data.tournaments || []);
    } catch (err) {
      setSearchResults([]);
    }
    setSearchLoading(false);
  };

  const handleSelectTournament = async (root) => {
    setSelectedRoot(root);
    setCreateNew(false);

    // Deep scan to find existing seasons and extract boilerplate
    try {
      const res = await fetch(`/api/wiki?action=scan&prefix=${encodeURIComponent(root)}`);
      const data = await res.json();

      // Detect existing seasons (e.g., "Season 1", "Season 2")
      const seasons = (data.pages || [])
        .map(p => p.title)
        .filter(t => t !== root && !t.includes('/Division') && !t.includes('/Playoffs') && !t.includes('/Information'))
        .filter(t => t.split('/').length === root.split('/').length + 1)
        .sort();

      // Suggest next season name
      const lastSeason = seasons[seasons.length - 1];
      if (lastSeason) {
        const seasonMatch = lastSeason.match(/Season\s*(\d+)/i);
        if (seasonMatch) {
          setSeasonName(`Season ${parseInt(seasonMatch[1]) + 1}`);
        } else {
          setSeasonName('Season 2');
        }

        // Try to extract boilerplate from the latest season's first division page
        const latestSeasonPrefix = lastSeason;
        const divPage = (data.pages || []).find(p =>
          p.title.startsWith(latestSeasonPrefix + '/Division')
        );

        if (divPage?.boilerplate?.navbox) {
          setNavbox(divPage.boilerplate.navbox);
        }

        // Fetch infobox from latest season overview
        try {
          const infoRes = await fetch(`/api/wiki?action=scan&prefix=${encodeURIComponent(latestSeasonPrefix)}`);
          const infoData = await infoRes.json();
          const overviewPage = (infoData.pages || []).find(p => p.title === latestSeasonPrefix);
          if (overviewPage?.bodyPreview) {
            // Parse infobox fields from preview or full content
            // This is a best-effort extraction
          }
        } catch {}
      } else {
        setSeasonName('Season 1');
      }
    } catch {}
  };

  const handleCreateNew = () => {
    setCreateNew(true);
    setSelectedRoot('');
    setSeasonName('');
  };

  // ── Step 2: Build infobox ───────────────────────────────────────────────────
  const buildFullInfobox = () => {
    const maps = new Set();
    for (const div of tournament.divisions || []) {
      for (const match of div.schedule || []) {
        for (const map of match.maps || []) {
          if (map.map) maps.add(map.map);
        }
      }
    }

    const teamCount = (tournament.divisions || []).reduce(
      (sum, div) => sum + (div.teams?.length || 0), 0
    );

    const derived = {
      format: tournament.mode || '4on4',
      sdate: tournament.startDate || '',
      edate: tournament.endDate || '',
      year: tournament.startDate ? tournament.startDate.split('-')[0] : '',
      team_number: String(teamCount || ''),
    };

    const mapArray = [...maps];
    mapArray.forEach((m, i) => {
      if (i < 5) derived[`map${i + 1}`] = m;
    });

    return { ...derived, ...infobox };
  };

  // ── Step 3: Build pages and scaffold ────────────────────────────────────────
  const buildPages = () => {
    const pages = [
      { name: 'Overview', link: seasonPage, type: 'overview' },
    ];
    for (const divName of divisionNames) {
      pages.push({ name: divName, link: `${seasonPage}/${divName}`, type: 'division' });
    }
    pages.push({ name: 'Playoffs', link: `${seasonPage}/Playoffs`, type: 'playoffs' });
    pages.push({ name: 'Information', link: `${seasonPage}/Information`, type: 'information' });
    return pages;
  };

  const handleScaffold = async () => {
    setScaffoldLoading(true);
    setScaffoldResult(null);

    const pages = buildPages();
    const tabs = pages.map(p => ({ name: p.name, link: p.link }));
    const fullInfobox = buildFullInfobox();

    const payload = {
      pages: pages.map(p => ({
        title: p.link,
        contentBody: '{{Abbr/TBD}}',
      })),
      boilerplate: {
        navbox,
        infobox: fullInfobox,
        tabs,
      },
      skipExisting: true,
      summary: `Created via QWICKY — ${tournament.name || 'tournament setup'}`,
    };

    try {
      const res = await fetch('/api/wiki?action=scaffold', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const result = await res.json();
      setScaffoldResult(result);

      if (result.ok || result.created?.length > 0) {
        // Save wiki config to tournament (localStorage)
        const wikiConfig = {
          enabled: true,
          parentPage: selectedRoot || '',
          seasonPage,
          navbox,
          infobox,
          pages,
        };
        updateTournament({ wikiConfig });

        // Auto-configure division publish targets
        const divisions = tournament.divisions || [];
        const updatedDivisions = divisions.map(div => {
          const divPage = pages.find(p => p.name === div.name && p.type === 'division');
          if (!divPage) return div;
          return {
            ...div,
            wikiConfig: {
              enabled: true,
              targets: [
                { type: 'standings', page: divPage.link, section: '' },
                { type: 'matches', page: divPage.link, section: '' },
              ],
            },
          };
        });
        updateTournament({ divisions: updatedDivisions });

        // Sync to Supabase (fire-and-forget) so server-side auto-publish works
        const tournamentId = (tournament.name || '')
          .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
        if (tournamentId) {
          fetch('/api/wiki?action=config-tournament', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ tournamentId, wikiConfig }),
          }).catch(() => {});

          // Sync each division's wiki config
          for (const div of updatedDivisions) {
            if (div.wikiConfig?.enabled) {
              fetch('/api/wiki?action=config-division', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ divisionId: div.id, wikiConfig: div.wikiConfig }),
              }).catch(() => {});
            }
          }
        }
      }
    } catch (err) {
      setScaffoldResult({ ok: false, errors: [{ title: 'request', error: err.message }] });
    }

    setScaffoldLoading(false);
  };

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
      <div className="bg-qw-dark border border-qw-border rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-qw-border">
          <h2 className="font-display text-lg text-qw-accent">WIKI SETUP</h2>
          <div className="flex items-center gap-4">
            <div className="flex gap-1">
              {[1, 2, 3].map(s => (
                <div key={s} className={`w-8 h-1 rounded ${s <= step ? 'bg-qw-accent' : 'bg-qw-border'}`} />
              ))}
            </div>
            <button onClick={onClose} className="text-qw-muted hover:text-white text-xl">&times;</button>
          </div>
        </div>

        <div className="p-6">

          {/* ── STEP 1: Find Tournament ── */}
          {step === 1 && (
            <div className="space-y-4">
              <h3 className="font-display text-sm text-white">Find Existing Tournament on QWiki</h3>
              <p className="text-sm text-qw-muted">Search for your tournament series to connect to its existing wiki pages, or create a new structure.</p>

              <div className="flex gap-2">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleSearch()}
                  placeholder="e.g. The Big 4, EQL, NQR..."
                  className="flex-1 bg-qw-darker text-white p-2 rounded border border-qw-border focus:border-qw-accent outline-none text-sm"
                />
                <button onClick={handleSearch} disabled={searchLoading} className="qw-btn px-4 py-2 text-sm">
                  {searchLoading ? 'Searching...' : 'Search'}
                </button>
              </div>

              {searchResults !== null && (
                <div className="space-y-2">
                  {searchResults.length === 0 ? (
                    <p className="text-sm text-qw-muted">No tournaments found. You can create a new wiki structure.</p>
                  ) : (
                    searchResults.map(t => (
                      <button
                        key={t.root}
                        onClick={() => handleSelectTournament(t.root)}
                        className={`w-full text-left p-3 rounded border transition-colors ${selectedRoot === t.root
                          ? 'border-qw-accent bg-qw-accent/10'
                          : 'border-qw-border bg-qw-darker hover:border-qw-accent/50'
                        }`}
                      >
                        <div className="text-white font-semibold text-sm">{t.root}</div>
                        <div className="text-xs text-qw-muted">{t.matchCount || t.pages?.length || 0} pages</div>
                      </button>
                    ))
                  )}
                </div>
              )}

              {(selectedRoot || searchResults !== null) && (
                <div className="pt-2 border-t border-qw-border/50">
                  <button
                    onClick={handleCreateNew}
                    className={`w-full text-left p-3 rounded border transition-colors ${createNew
                      ? 'border-qw-accent bg-qw-accent/10'
                      : 'border-qw-border bg-qw-darker hover:border-qw-accent/50'
                    }`}
                  >
                    <div className="text-white font-semibold text-sm">+ Create New Tournament</div>
                    <div className="text-xs text-qw-muted">Start a fresh wiki page structure</div>
                  </button>
                </div>
              )}

              {(selectedRoot || createNew) && (
                <div className="space-y-2 pt-2">
                  {selectedRoot && (
                    <div>
                      <label className="text-xs text-qw-muted block mb-1">Season Name</label>
                      <input
                        type="text"
                        value={seasonName}
                        onChange={e => setSeasonName(e.target.value)}
                        placeholder="Season 2"
                        className="w-full bg-qw-darker text-white p-2 rounded border border-qw-border focus:border-qw-accent outline-none text-sm"
                      />
                      <div className="text-xs text-qw-muted mt-1">
                        Pages will be created under: <span className="text-qw-accent">{seasonPage || '...'}</span>
                      </div>
                    </div>
                  )}
                  {createNew && (
                    <div>
                      <label className="text-xs text-qw-muted block mb-1">Full Page Path</label>
                      <input
                        type="text"
                        value={seasonName}
                        onChange={e => setSeasonName(e.target.value)}
                        placeholder="My Tournament/Season 1"
                        className="w-full bg-qw-darker text-white p-2 rounded border border-qw-border focus:border-qw-accent outline-none text-sm"
                      />
                    </div>
                  )}

                  <button
                    onClick={() => setStep(2)}
                    disabled={!seasonPage}
                    className="qw-btn px-6 py-2 text-sm disabled:opacity-50"
                  >
                    Next: Metadata
                  </button>
                </div>
              )}
            </div>
          )}

          {/* ── STEP 2: Metadata ── */}
          {step === 2 && (
            <div className="space-y-4">
              <h3 className="font-display text-sm text-white">Tournament Metadata</h3>
              <p className="text-sm text-qw-muted">
                These fields populate the <code className="text-qw-accent">{'{{Infobox league}}'}</code> template on each wiki page.
                Format, dates, maps, and team count are auto-derived from your QWICKY setup.
              </p>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-qw-muted block mb-1">Display Name</label>
                  <input type="text" value={infobox.name} onChange={e => setInfobox(p => ({ ...p, name: e.target.value }))}
                    className="w-full bg-qw-darker text-white p-2 rounded border border-qw-border focus:border-qw-accent outline-none text-sm" />
                </div>
                <div>
                  <label className="text-xs text-qw-muted block mb-1">Navbox Template</label>
                  <input type="text" value={navbox} onChange={e => setNavbox(e.target.value)}
                    placeholder="e.g. TB4 Navbox (leave empty if none)"
                    className="w-full bg-qw-darker text-white p-2 rounded border border-qw-border focus:border-qw-accent outline-none text-sm" />
                </div>
                <div className="col-span-2">
                  <label className="text-xs text-qw-muted block mb-1">Organizers (wiki markup)</label>
                  <input type="text" value={infobox.organizer || ''} onChange={e => setInfobox(p => ({ ...p, organizer: e.target.value }))}
                    placeholder='{{player|Nas|flag=se}} {{player|peppe|flag=se}}'
                    className="w-full bg-qw-darker text-white p-2 rounded border border-qw-border focus:border-qw-accent outline-none text-sm" />
                </div>
                <div>
                  <label className="text-xs text-qw-muted block mb-1">Website</label>
                  <input type="text" value={infobox.website || ''} onChange={e => setInfobox(p => ({ ...p, website: e.target.value }))}
                    placeholder="thebig4.se"
                    className="w-full bg-qw-darker text-white p-2 rounded border border-qw-border focus:border-qw-accent outline-none text-sm" />
                </div>
                <div>
                  <label className="text-xs text-qw-muted block mb-1">Discord</label>
                  <input type="text" value={infobox.discord || ''} onChange={e => setInfobox(p => ({ ...p, discord: e.target.value }))}
                    placeholder="http://discord.quake.world"
                    className="w-full bg-qw-darker text-white p-2 rounded border border-qw-border focus:border-qw-accent outline-none text-sm" />
                </div>
                <div>
                  <label className="text-xs text-qw-muted block mb-1">Image</label>
                  <input type="text" value={infobox.image || ''} onChange={e => setInfobox(p => ({ ...p, image: e.target.value }))}
                    placeholder="TB4-S2-icon.png"
                    className="w-full bg-qw-darker text-white p-2 rounded border border-qw-border focus:border-qw-accent outline-none text-sm" />
                </div>
                <div>
                  <label className="text-xs text-qw-muted block mb-1">Prize Pool</label>
                  <input type="text" value={infobox.prizepool || ''} onChange={e => setInfobox(p => ({ ...p, prizepool: e.target.value }))}
                    className="w-full bg-qw-darker text-white p-2 rounded border border-qw-border focus:border-qw-accent outline-none text-sm" />
                </div>
              </div>

              <div className="text-xs text-qw-muted bg-qw-darker p-3 rounded border border-qw-border/50">
                <div className="font-semibold text-white mb-1">Auto-derived from QWICKY:</div>
                <div>Format: {tournament.mode || '4on4'}</div>
                <div>Start: {tournament.startDate || '(not set)'}</div>
                <div>Teams: {(tournament.divisions || []).reduce((s, d) => s + (d.teams?.length || 0), 0)}</div>
                <div>Divisions: {divisionNames.join(', ') || '(none)'}</div>
              </div>

              <div className="flex gap-2">
                <button onClick={() => setStep(1)} className="qw-btn-secondary px-4 py-2 text-sm">Back</button>
                <button onClick={() => setStep(3)} className="qw-btn px-6 py-2 text-sm">Next: Create Pages</button>
              </div>
            </div>
          )}

          {/* ── STEP 3: Create Pages ── */}
          {step === 3 && (
            <div className="space-y-4">
              <h3 className="font-display text-sm text-white">Page Structure</h3>
              <p className="text-sm text-qw-muted">
                These pages will be created on the QW Wiki with proper boilerplate (navbox, infobox, tabs).
                Existing pages will be skipped.
              </p>

              <div className="space-y-1">
                {buildPages().map((page, i) => (
                  <div key={page.link} className="flex items-center gap-3 p-2 bg-qw-darker rounded text-sm">
                    <span className="text-qw-accent font-mono w-6 text-center">{i + 1}</span>
                    <span className="text-white flex-1">{page.link}</span>
                    <span className="text-xs text-qw-muted capitalize">{page.type}</span>
                    <span className="text-xs text-qw-muted">This={i + 1}</span>
                  </div>
                ))}
              </div>

              {scaffoldResult && (
                <div className={`p-3 rounded border text-sm ${scaffoldResult.ok
                  ? 'bg-green-900/20 border-green-500/50 text-green-300'
                  : 'bg-red-900/20 border-red-500/50 text-red-300'
                }`}>
                  {scaffoldResult.ok ? (
                    <>
                      <div className="font-semibold">Pages created successfully!</div>
                      {scaffoldResult.created?.map(p => (
                        <div key={p.title} className="text-xs mt-1">+ {p.title}</div>
                      ))}
                      {scaffoldResult.skipped?.map(p => (
                        <div key={p.title} className="text-xs mt-1 text-qw-muted">- {p.title} (already exists)</div>
                      ))}
                      <div className="mt-2 text-xs text-qw-muted">
                        Auto-publish targets configured for each division. Wiki will auto-update as you approve games.
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="font-semibold">Some errors occurred:</div>
                      {scaffoldResult.created?.map(p => (
                        <div key={p.title} className="text-xs mt-1 text-green-400">+ {p.title}</div>
                      ))}
                      {scaffoldResult.errors?.map(e => (
                        <div key={e.title} className="text-xs mt-1">! {e.title}: {e.error}</div>
                      ))}
                    </>
                  )}
                </div>
              )}

              <div className="flex gap-2">
                <button onClick={() => setStep(2)} className="qw-btn-secondary px-4 py-2 text-sm">Back</button>
                {!scaffoldResult?.ok ? (
                  <button
                    onClick={handleScaffold}
                    disabled={scaffoldLoading}
                    className="qw-btn px-6 py-2 text-sm disabled:opacity-50"
                  >
                    {scaffoldLoading ? 'Creating Pages...' : 'Create Pages on Wiki'}
                  </button>
                ) : (
                  <button onClick={onClose} className="qw-btn px-6 py-2 text-sm">Done</button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
