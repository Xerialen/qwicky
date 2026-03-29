// src/components/WikiSetupWizard.jsx
// 3-step wizard for connecting a QWICKY tournament to the QW Wiki.
// Step 1: Find or create tournament wiki pages
// Step 2: Confirm/edit tournament metadata for the infobox
// Step 3: Preview and create page structure

import React, { useState, useEffect, useRef, useCallback } from 'react';

export default function WikiSetupWizard({ tournament, updateTournament, onClose }) {
  const [step, setStep] = useState(1);

  // Step 1 state
  const [entryMode, setEntryMode] = useState(null); // 'search' | 'url' | 'new'
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState(null);
  const [searchLoading, setSearchLoading] = useState(false);
  const [selectedRoot, setSelectedRoot] = useState('');
  const [seasonName, setSeasonName] = useState('');
  const [directPath, setDirectPath] = useState('');
  const [scanLoading, setScanLoading] = useState(false);
  const searchTimerRef = useRef(null);

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
  const seasonPage = entryMode === 'url'
    ? directPath
    : entryMode === 'new'
      ? seasonName
      : selectedRoot
        ? `${selectedRoot}/${seasonName}`
        : seasonName;

  // ── Debounced search ────────────────────────────────────────────────────────
  const doSearch = useCallback(async (query) => {
    if (!query || query.length < 2) {
      setSearchResults(null);
      return;
    }
    setSearchLoading(true);
    try {
      const res = await fetch(`/api/wiki?action=scan&q=${encodeURIComponent(query)}`);
      const data = await res.json();
      setSearchResults(data.tournaments || []);
    } catch {
      setSearchResults([]);
    }
    setSearchLoading(false);
  }, []);

  useEffect(() => {
    if (entryMode !== 'search') return;
    clearTimeout(searchTimerRef.current);
    if (searchQuery.length < 2) {
      setSearchResults(null);
      return;
    }
    searchTimerRef.current = setTimeout(() => doSearch(searchQuery), 400);
    return () => clearTimeout(searchTimerRef.current);
  }, [searchQuery, entryMode, doSearch]);

  // ── Deep scan on tournament selection ───────────────────────────────────────
  const handleSelectTournament = async (root) => {
    setSelectedRoot(root);
    setScanLoading(true);

    try {
      const res = await fetch(`/api/wiki?action=scan&prefix=${encodeURIComponent(root)}`);
      const data = await res.json();

      const seasons = (data.pages || [])
        .map(p => p.title)
        .filter(t => t !== root && !t.includes('/Division') && !t.includes('/Playoffs') && !t.includes('/Information'))
        .filter(t => t.split('/').length === root.split('/').length + 1)
        .sort();

      const lastSeason = seasons[seasons.length - 1];
      if (lastSeason) {
        const seasonMatch = lastSeason.match(/Season\s*(\d+)/i);
        setSeasonName(seasonMatch ? `Season ${parseInt(seasonMatch[1]) + 1}` : 'Season 2');

        const divPage = (data.pages || []).find(p =>
          p.title.startsWith(lastSeason + '/Division')
        );
        if (divPage?.boilerplate?.navbox) setNavbox(divPage.boilerplate.navbox);
      } else {
        setSeasonName('Season 1');
      }
    } catch {}
    setScanLoading(false);
  };

  // ── Validate direct URL/path ────────────────────────────────────────────────
  const parseWikiPath = (input) => {
    // Accept full URLs or bare paths
    let path = input.trim();
    // Strip wiki URL prefixes
    path = path.replace(/^https?:\/\/(www\.)?quakeworld\.nu\/(wiki|w)\//, '');
    // Strip leading/trailing slashes
    path = path.replace(/^\/+|\/+$/g, '');
    // Replace underscores with spaces
    path = path.replace(/_/g, ' ');
    return path;
  };

  // ── Build info and pages ────────────────────────────────────────────────────
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
    [...maps].forEach((m, i) => { if (i < 5) derived[`map${i + 1}`] = m; });
    return { ...derived, ...infobox };
  };

  const buildPages = () => {
    const pages = [{ name: 'Overview', link: seasonPage, type: 'overview' }];
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

    try {
      const res = await fetch('/api/wiki?action=scaffold', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pages: pages.map(p => ({ title: p.link, contentBody: '{{Abbr/TBD}}' })),
          boilerplate: { navbox, infobox: fullInfobox, tabs },
          skipExisting: true,
          summary: `Created via QWICKY — ${tournament.name || 'tournament setup'}`,
        }),
      });
      const result = await res.json();
      setScaffoldResult(result);

      if (result.ok || result.created?.length > 0) {
        const wikiConfig = { enabled: true, parentPage: selectedRoot || '', seasonPage, navbox, infobox, pages };
        updateTournament({ wikiConfig });

        const updatedDivisions = (tournament.divisions || []).map(div => {
          const divPage = pages.find(p => p.name === div.name && p.type === 'division');
          if (!divPage) return div;
          return { ...div, wikiConfig: { enabled: true, targets: [
            { type: 'standings', page: divPage.link, section: '' },
            { type: 'matches', page: divPage.link, section: '' },
          ]}};
        });
        updateTournament({ divisions: updatedDivisions });

        // Sync to Supabase
        const tournamentId = (tournament.name || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
        if (tournamentId) {
          fetch('/api/wiki?action=config-tournament', {
            method: 'PUT', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ tournamentId, wikiConfig }),
          }).catch(() => {});
          for (const div of updatedDivisions) {
            if (div.wikiConfig?.enabled) {
              fetch('/api/wiki?action=config-division', {
                method: 'PUT', headers: { 'Content-Type': 'application/json' },
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

  // ── Spinner component ───────────────────────────────────────────────────────
  const Spinner = () => (
    <svg className="animate-spin h-4 w-4 text-qw-accent" viewBox="0 0 24 24" fill="none">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  );

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

          {/* ── STEP 1: Find / Create ── */}
          {step === 1 && (
            <div className="space-y-4">
              <h3 className="font-display text-sm text-white">Connect to QW Wiki</h3>
              <p className="text-sm text-qw-muted">Choose how to set up your tournament's wiki pages.</p>

              {/* Entry mode selector */}
              {!entryMode && (
                <div className="space-y-2">
                  <button
                    onClick={() => { setEntryMode('search'); setSearchQuery(tournament.name || ''); }}
                    className="w-full text-left p-4 rounded-lg border border-qw-border bg-qw-darker hover:border-qw-accent/50 transition-colors group"
                  >
                    <div className="text-white font-semibold text-sm group-hover:text-qw-accent">Search existing tournaments</div>
                    <div className="text-xs text-qw-muted mt-1">Find your tournament series on the wiki (e.g. The Big 4, EQL, NQR)</div>
                  </button>
                  <button
                    onClick={() => setEntryMode('url')}
                    className="w-full text-left p-4 rounded-lg border border-qw-border bg-qw-darker hover:border-qw-accent/50 transition-colors group"
                  >
                    <div className="text-white font-semibold text-sm group-hover:text-qw-accent">Enter wiki page path or URL</div>
                    <div className="text-xs text-qw-muted mt-1">Paste the direct URL or path to your tournament's parent page</div>
                  </button>
                  <button
                    onClick={() => setEntryMode('new')}
                    className="w-full text-left p-4 rounded-lg border border-qw-border bg-qw-darker hover:border-qw-accent/50 transition-colors group"
                  >
                    <div className="text-white font-semibold text-sm group-hover:text-qw-accent">Create from scratch</div>
                    <div className="text-xs text-qw-muted mt-1">First tournament ever? Set up a brand new wiki page structure</div>
                  </button>
                </div>
              )}

              {/* Search mode */}
              {entryMode === 'search' && (
                <div className="space-y-3">
                  <button onClick={() => { setEntryMode(null); setSearchResults(null); setSelectedRoot(''); }} className="text-xs text-qw-muted hover:text-white">&larr; Back</button>

                  <div className="relative">
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={e => { setSearchQuery(e.target.value); setSelectedRoot(''); }}
                      placeholder="Start typing a tournament name..."
                      autoFocus
                      className="w-full bg-qw-darker text-white p-3 rounded-lg border border-qw-border focus:border-qw-accent outline-none text-sm pr-10"
                    />
                    <div className="absolute right-3 top-1/2 -translate-y-1/2">
                      {searchLoading ? <Spinner /> : searchQuery.length >= 2 && (
                        <span className="text-xs text-qw-muted">{searchResults?.length ?? ''}</span>
                      )}
                    </div>
                  </div>

                  {/* Results */}
                  {searchResults !== null && !searchLoading && (
                    <div className="space-y-1 max-h-48 overflow-y-auto">
                      {searchResults.length === 0 && searchQuery.length >= 2 && (
                        <p className="text-sm text-qw-muted py-2">No tournaments found for "{searchQuery}"</p>
                      )}
                      {searchResults.map(t => (
                        <button
                          key={t.root}
                          onClick={() => handleSelectTournament(t.root)}
                          className={`w-full text-left p-3 rounded border transition-colors ${selectedRoot === t.root
                            ? 'border-qw-accent bg-qw-accent/10'
                            : 'border-qw-border/50 bg-qw-darker hover:border-qw-accent/50'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <span className="text-white font-semibold text-sm">{t.root}</span>
                            <span className="text-xs text-qw-muted">{t.matchCount || t.pages?.length || 0} pages</span>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}

                  {/* Season name after selection */}
                  {selectedRoot && (
                    <div className="p-3 bg-qw-darker rounded-lg border border-qw-accent/30 space-y-2">
                      {scanLoading ? (
                        <div className="flex items-center gap-2 text-sm text-qw-muted py-2">
                          <Spinner /> Scanning existing pages...
                        </div>
                      ) : (
                        <>
                          <label className="text-xs text-qw-muted block">Season Name</label>
                          <input
                            type="text"
                            value={seasonName}
                            onChange={e => setSeasonName(e.target.value)}
                            placeholder="Season 2"
                            className="w-full bg-qw-dark text-white p-2 rounded border border-qw-border focus:border-qw-accent outline-none text-sm"
                          />
                          <div className="text-xs text-qw-muted">
                            Pages at: <span className="text-qw-accent font-mono">{seasonPage || '...'}</span>
                          </div>
                        </>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Direct URL mode */}
              {entryMode === 'url' && (
                <div className="space-y-3">
                  <button onClick={() => { setEntryMode(null); setDirectPath(''); }} className="text-xs text-qw-muted hover:text-white">&larr; Back</button>

                  <div>
                    <label className="text-xs text-qw-muted block mb-1">Wiki page URL or path</label>
                    <input
                      type="text"
                      value={directPath}
                      onChange={e => setDirectPath(parseWikiPath(e.target.value))}
                      placeholder="https://quakeworld.nu/wiki/The_Big_4/Season_3 or The Big 4/Season 3"
                      autoFocus
                      className="w-full bg-qw-darker text-white p-3 rounded-lg border border-qw-border focus:border-qw-accent outline-none text-sm"
                    />
                    {directPath && (
                      <div className="text-xs text-qw-muted mt-2">
                        Pages at: <span className="text-qw-accent font-mono">{directPath}</span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Create new mode */}
              {entryMode === 'new' && (
                <div className="space-y-3">
                  <button onClick={() => { setEntryMode(null); setSeasonName(''); }} className="text-xs text-qw-muted hover:text-white">&larr; Back</button>

                  <div>
                    <label className="text-xs text-qw-muted block mb-1">Full page path for your tournament</label>
                    <input
                      type="text"
                      value={seasonName}
                      onChange={e => setSeasonName(e.target.value)}
                      placeholder="My Tournament/Season 1"
                      autoFocus
                      className="w-full bg-qw-darker text-white p-3 rounded-lg border border-qw-border focus:border-qw-accent outline-none text-sm"
                    />
                    <p className="text-xs text-qw-muted mt-2">
                      Division pages, Playoffs, and Information pages will be created as sub-pages.
                    </p>
                    {seasonName && (
                      <div className="text-xs text-qw-muted mt-1">
                        Example: <span className="text-qw-accent font-mono">{seasonName}/Division 1</span>, <span className="text-qw-accent font-mono">{seasonName}/Playoffs</span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Next button */}
              {entryMode && seasonPage && (
                <button
                  onClick={() => setStep(2)}
                  disabled={scanLoading}
                  className="qw-btn px-6 py-2 text-sm disabled:opacity-50 w-full"
                >
                  Next: Metadata
                </button>
              )}
            </div>
          )}

          {/* ── STEP 2: Metadata ── */}
          {step === 2 && (
            <div className="space-y-4">
              <h3 className="font-display text-sm text-white">Tournament Metadata</h3>
              <p className="text-sm text-qw-muted">
                These fields populate the <code className="text-qw-accent">{'{{Infobox league}}'}</code> template.
                Format, dates, maps, and team count are auto-derived.
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
                <div>Format: {tournament.mode || '4on4'} | Start: {tournament.startDate || '(not set)'} | Teams: {(tournament.divisions || []).reduce((s, d) => s + (d.teams?.length || 0), 0)} | Divisions: {divisionNames.join(', ') || '(none)'}</div>
              </div>

              {/* Template reference */}
              <details className="text-xs">
                <summary className="text-qw-muted cursor-pointer hover:text-white">Wiki template reference</summary>
                <div className="mt-2 p-3 bg-qw-darker rounded border border-qw-border/50 space-y-2 text-qw-muted font-mono">
                  <div><span className="text-qw-accent">{'{{Infobox league}}'}</span> — Tournament header with metadata</div>
                  <div><span className="text-qw-accent">{'{{Tabs static}}'}</span> — Navigation tabs between pages</div>
                  <div><span className="text-qw-accent">{'{{GroupTableStart}}'}</span> — Group stage standings table</div>
                  <div><span className="text-qw-accent">{'{{GroupTableSlot}}'}</span> — Team row in standings</div>
                  <div><span className="text-qw-accent">{'{{MatchList}}'}</span> — Match results container</div>
                  <div><span className="text-qw-accent">{'{{MatchMaps}}'}</span> — Individual match with map scores</div>
                  <div><span className="text-qw-accent">{'{{4SETeamBracket}}'}</span> — 4-team single elimination bracket</div>
                  <div><span className="text-qw-accent">{'{{8SETeamBracket}}'}</span> — 8-team single elimination bracket</div>
                  <div><span className="text-qw-accent">{'{{player|Name|flag=xx}}'}</span> — Player link with country flag</div>
                  <div><span className="text-qw-accent">{'{{Abbr/TBD}}'}</span> — "To be determined" placeholder</div>
                </div>
              </details>

              <div className="flex gap-2">
                <button onClick={() => setStep(1)} className="qw-btn-secondary px-4 py-2 text-sm">Back</button>
                <button onClick={() => setStep(3)} className="qw-btn px-6 py-2 text-sm flex-1">Next: Create Pages</button>
              </div>
            </div>
          )}

          {/* ── STEP 3: Create Pages ── */}
          {step === 3 && (
            <div className="space-y-4">
              <h3 className="font-display text-sm text-white">Page Structure</h3>
              <p className="text-sm text-qw-muted">
                These pages will be created with boilerplate (navbox, infobox, tabs). Existing pages are skipped.
              </p>

              <div className="space-y-1">
                {buildPages().map((page, i) => (
                  <div key={page.link} className="flex items-center gap-3 p-2 bg-qw-darker rounded text-sm">
                    <span className="text-qw-accent font-mono w-6 text-center">{i + 1}</span>
                    <span className="text-white flex-1 font-mono text-xs">{page.link}</span>
                    <span className="text-xs text-qw-muted capitalize">{page.type}</span>
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
                      {scaffoldResult.created?.map(p => <div key={p.title} className="text-xs mt-1">+ {p.title}</div>)}
                      {scaffoldResult.skipped?.map(p => <div key={p.title} className="text-xs mt-1 text-qw-muted">- {p.title} (exists)</div>)}
                      <div className="mt-2 text-xs text-qw-muted">Auto-publish targets configured. Wiki updates as you approve games.</div>
                    </>
                  ) : (
                    <>
                      <div className="font-semibold">Some errors occurred:</div>
                      {scaffoldResult.created?.map(p => <div key={p.title} className="text-xs mt-1 text-green-400">+ {p.title}</div>)}
                      {scaffoldResult.errors?.map(e => <div key={e.title} className="text-xs mt-1">! {e.title}: {e.error}</div>)}
                    </>
                  )}
                </div>
              )}

              <div className="flex gap-2">
                <button onClick={() => setStep(2)} className="qw-btn-secondary px-4 py-2 text-sm">Back</button>
                {!scaffoldResult?.ok ? (
                  <button onClick={handleScaffold} disabled={scaffoldLoading} className="qw-btn px-6 py-2 text-sm flex-1 disabled:opacity-50">
                    {scaffoldLoading ? (
                      <span className="flex items-center justify-center gap-2"><Spinner /> Creating Pages...</span>
                    ) : 'Create Pages on Wiki'}
                  </button>
                ) : (
                  <button onClick={onClose} className="qw-btn px-6 py-2 text-sm flex-1">Done</button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
