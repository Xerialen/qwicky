// src/components/WikiSetupWizard.jsx
// 3-step wizard for connecting a QWICKY tournament to the QW Wiki.
// Step 1: Find or create tournament wiki pages
// Step 2: Confirm/edit tournament metadata for the infobox
// Step 3: Preview and create page structure

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { publishDivisionWiki } from '../services/wikiPublisher';
import { supabase } from '../services/supabaseClient';

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
  const [existingPages, setExistingPages] = useState(null); // { title: boolean }
  const [checkingPages, setCheckingPages] = useState(false);

  // Phase 1: inheritance tracking
  const [inheritedFrom, setInheritedFrom] = useState(null);
  const [inheritedKeys, setInheritedKeys] = useState(new Set());
  const [inheritedDivisionNames, setInheritedDivisionNames] = useState([]);
  const [inheritWarning, setInheritWarning] = useState(null);
  const [publishCurrent, setPublishCurrent] = useState(false);
  const [publishProgress, setPublishProgress] = useState(null);
  const [remappedDivisionNames, setRemappedDivisionNames] = useState(null);

  const setInfoboxField = useCallback((key, value) => {
    setInfobox((p) => ({ ...p, [key]: value }));
    setInheritedKeys((prev) => {
      if (!prev.has(key)) return prev;
      const next = new Set(prev);
      next.delete(key);
      return next;
    });
  }, []);

  // Derived
  const divisionNames = (tournament.divisions || []).map((d) => d.name);
  const effectiveDivisionNames = remappedDivisionNames || divisionNames;
  const seasonPage =
    entryMode === 'url'
      ? directPath
      : entryMode === 'new'
        ? seasonName
        : selectedRoot
          ? `${selectedRoot}/${seasonName}`
          : seasonName;

  // Phase 1: default publish-current-state checkbox based on whether the tournament has content
  useEffect(() => {
    if (step !== 3) return;
    const hasContent = (tournament.divisions || []).some(
      (d) => (d.schedule || []).some((m) => m.status === 'completed')
    );
    setPublishCurrent(hasContent);
  }, [step, tournament.divisions]);

  // ── Check which pages already exist when entering Step 3 ─────────────────
  useEffect(() => {
    if (step !== 3 || !seasonPage) return;
    let cancelled = false;
    setCheckingPages(true);
    setExistingPages(null);

    (async () => {
      const pages = buildPages();
      const result = {};
      try {
        const res = await fetch(`/api/wiki?action=scan&prefix=${encodeURIComponent(seasonPage)}`);
        const data = await res.json();
        const existingTitles = new Set(
          (data.pages || []).filter((p) => p.exists).map((p) => p.title)
        );
        for (const page of pages) {
          result[page.link] = existingTitles.has(page.link);
        }
      } catch {
        // If scan fails, assume none exist
        for (const page of pages) result[page.link] = false;
      }
      if (!cancelled) {
        setExistingPages(result);
        setCheckingPages(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [step, seasonPage]);

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

    // Reset any prior inheritance state so switching from one result to another
    // doesn't carry stale badges, navbox, or inherited values forward.
    setInheritWarning(null);
    setInheritedFrom(null);
    setInheritedKeys(new Set());
    setInheritedDivisionNames([]);
    setNavbox('');
    setInfobox((prev) => ({
      ...prev,
      // keep the user's original name (from QWICKY tournament state)
      organizer: '',
      website: '',
      discord: '',
      image: '',
      twitch: '',
      prizepool: '',
    }));

    try {
      const res = await fetch(`/api/wiki?action=scan&prefix=${encodeURIComponent(root)}`);
      const data = await res.json();

      const seasons = (data.pages || [])
        .map((p) => p.title)
        .filter(
          (t) =>
            t !== root &&
            !t.includes('/Division') &&
            !t.includes('/Playoffs') &&
            !t.includes('/Information')
        )
        .filter((t) => t.split('/').length === root.split('/').length + 1)
        .sort();

      const lastSeason = seasons[seasons.length - 1];
      if (lastSeason) {
        const seasonMatch = lastSeason.match(/Season\s*(\d+)/i);
        setSeasonName(seasonMatch ? `Season ${parseInt(seasonMatch[1]) + 1}` : 'Season 2');

        const divPage = (data.pages || []).find((p) =>
          p.title.startsWith(lastSeason + '/Division')
        );
        if (divPage?.boilerplate?.navbox) {
          setNavbox(divPage.boilerplate.navbox);
          setInheritedKeys((prev) => new Set([...prev, 'navbox']));
          setInheritedFrom(lastSeason);
        }

        // Phase 1: fetch the last season's overview to inherit full infobox
        try {
          const pageRes = await fetch(`/api/wiki?action=fetch-page&title=${encodeURIComponent(lastSeason)}`);
          if (pageRes.ok) {
            const pageData = await pageRes.json();
            if (pageData.ok) {
              if (!pageData.infobox) {
                setInheritWarning(`Could not parse prior season infobox from ${lastSeason}. Please fill in manually.`);
              } else {
                const inherited = { ...pageData.infobox };
                if (inherited.year && /^\d{4}$/.test(inherited.year)) {
                  inherited.year = String(parseInt(inherited.year) + 1);
                }
                const keys = new Set();
                // Skip QWICKY-derived fields AND the display name, which must stay
                // anchored to the current tournament rather than copied from the prior season.
                const SKIP = new Set(['name', 'sdate', 'edate', 'team_number', 'map1', 'map2', 'map3', 'map4', 'map5']);
                setInfobox((prev) => {
                  const merged = { ...prev };
                  for (const [k, v] of Object.entries(inherited)) {
                    if (v && !SKIP.has(k)) {
                      merged[k] = v;
                      keys.add(k);
                    }
                  }
                  return merged;
                });
                setInheritedKeys((prev) => new Set([...prev, ...keys]));
                setInheritedFrom(lastSeason);
                if (pageData.divisionNames?.length) {
                  setInheritedDivisionNames(pageData.divisionNames);
                }
              }
            }
          }
        } catch {
          // Graceful degradation — leave fields blank for manual entry
        }
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
      (sum, div) => sum + (div.teams?.length || 0),
      0
    );
    const derived = {
      format: tournament.mode || '4on4',
      sdate: tournament.startDate || '',
      edate: tournament.endDate || '',
      year: tournament.startDate ? tournament.startDate.split('-')[0] : '',
      team_number: String(teamCount || ''),
    };
    [...maps].forEach((m, i) => {
      if (i < 5) derived[`map${i + 1}`] = m;
    });
    return { ...derived, ...infobox };
  };

  const buildPages = () => {
    const pages = [{ name: 'Overview', link: seasonPage, type: 'overview' }];
    for (const divName of effectiveDivisionNames) {
      pages.push({ name: divName, link: `${seasonPage}/${divName}`, type: 'division' });
    }
    pages.push({ name: 'Playoffs', link: `${seasonPage}/Playoffs`, type: 'playoffs' });
    pages.push({ name: 'Information', link: `${seasonPage}/Information`, type: 'information' });
    return pages;
  };

  // Local wikitext assembler for the Step 3 preview only. The real scaffold
  // still goes through the server (api/wiki/_boilerplate.mjs).
  const buildOverviewPreview = () => {
    const pages = buildPages();
    const fullInfobox = buildFullInfobox();
    const parts = [];
    if (navbox) parts.push(`{{${navbox}}}`);
    if (Object.keys(fullInfobox).length > 0) {
      const lines = ['{{Infobox league'];
      for (const [k, v] of Object.entries(fullInfobox)) {
        if (v !== '' && v !== undefined && v !== null) lines.push(`|${k}=${v}`);
      }
      lines.push('}}');
      parts.push(lines.join('\n'));
    }
    const tabsLines = ['{{Tabs static'];
    pages.forEach((p, i) => {
      tabsLines.push(`|name${i + 1}=${p.name}`);
      tabsLines.push(`|link${i + 1}=${p.link}`);
    });
    tabsLines.push('|This=1');
    tabsLines.push('}}');
    parts.push(tabsLines.join('\n'));
    // Match what scaffold sends: server assembles boilerplate + '\n\n' + contentBody,
    // and the client currently passes '{{Abbr/TBD}}' as contentBody at handleScaffold.
    // Include it here so the preview matches the created page exactly.
    return parts.join('\n\n') + '\n\n{{Abbr/TBD}}';
  };

  const runPublishCurrent = async (divisions) => {
    if (!publishCurrent) return;
    const activeTournament = {
      ...tournament,
      settings: { ...(tournament.settings || {}), wikiAutoPublish: true },
    };
    // publish-section is a WRITE action gated by requireAdminAuth on the server,
    // so we need to pass the current session access_token.
    let token = null;
    try {
      const { data: { session } } = await supabase.auth.getSession();
      token = session?.access_token ?? null;
    } catch {}

    let ok = 0;
    let failed = 0;
    for (const div of divisions) {
      if (!div.wikiConfig?.enabled) continue;
      setPublishProgress(`Publishing ${div.name}…`);
      try {
        const results = await publishDivisionWiki(div, activeTournament, token);
        const anyFailed = (results || []).some((r) => r.ok === false);
        if (anyFailed) failed++;
        else ok++;
      } catch (err) {
        console.error('publish-current failed for', div.name, err);
        failed++;
      }
    }
    if (failed > 0) {
      setPublishProgress(`Published ${ok} division(s); ${failed} failed (check browser console).`);
    } else {
      setPublishProgress(`Published ${ok} division(s).`);
    }
  };

  const handleScaffold = async () => {
    setScaffoldLoading(true);
    setScaffoldResult(null);
    const pages = buildPages();
    const tabs = pages.map((p) => ({ name: p.name, link: p.link }));
    const fullInfobox = buildFullInfobox();

    try {
      const res = await fetch('/api/wiki?action=scaffold', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pages: pages.map((p) => ({ title: p.link, contentBody: '{{Abbr/TBD}}' })),
          boilerplate: { navbox, infobox: fullInfobox, tabs },
          skipExisting: true,
          summary: `Created via QWICKY — ${tournament.name || 'tournament setup'}`,
        }),
      });
      const result = await res.json();
      setScaffoldResult(result);

      if (result.ok || result.created?.length > 0) {
        const wikiConfig = {
          enabled: true,
          parentPage: selectedRoot || '',
          seasonPage,
          navbox,
          infobox,
          pages,
        };
        updateTournament({ wikiConfig });

        // Pair QWICKY divisions with scaffolded pages by index, not by name.
        // When the user picks "Use wiki names", divPage.name differs from div.name
        // (e.g. QWICKY "Premier" maps to wiki "Division 1"), so name matching fails.
        // effectiveDivisionNames is in the same order as tournament.divisions.
        const divisionPages = pages.filter((p) => p.type === 'division');
        const playoffsPage = pages.find((p) => p.type === 'playoffs');
        const tournamentDivisions = tournament.divisions || [];
        const unpaired = [];
        const updatedDivisions = tournamentDivisions.map((div, idx) => {
          const divPage = divisionPages[idx];
          if (!divPage) {
            unpaired.push(div.name);
            return div;
          }
          // Division page gets a single 'full' target (standings + matches
          // combined) so they don't overwrite each other — each target is a
          // full-body publish, and two full-body publishes to the same page
          // with no section heading would leave only the last one.
          const targets = [
            { type: 'full', page: divPage.link, section: '' },
          ];
          // Playoffs page gets a bracket target for the first division only
          // (single shared Playoffs page for the tournament).
          if (playoffsPage && idx === 0) {
            targets.push({ type: 'bracket', page: playoffsPage.link, section: '' });
          }
          return {
            ...div,
            wikiConfig: { enabled: true, targets },
          };
        });
        if (unpaired.length > 0) {
          console.warn(
            `Wiki setup: ${unpaired.length} division(s) could not be paired with a scaffold page and will NOT auto-publish: ${unpaired.join(', ')}. ` +
              `This happens when there are more QWICKY divisions than scaffold pages.`
          );
          setPublishProgress(
            `Warning: ${unpaired.length} division(s) not connected to wiki — see console.`
          );
        }
        updateTournament({ divisions: updatedDivisions });

        // Sync to Supabase
        const tournamentId = (tournament.name || '')
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/^-|-$/g, '');
        if (tournamentId) {
          fetch('/api/wiki?action=config-tournament', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ tournamentId, wikiConfig }),
          }).catch(() => {});
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

  // ── Inherited-from badge ────────────────────────────────────────────────────
  const InheritedBadge = ({ fieldKey }) =>
    inheritedKeys.has(fieldKey) ? (
      <span
        className="inline-flex items-center gap-0.5 ml-1 text-[10px] text-tertiary border border-tertiary/40 rounded px-1 py-0.5"
        title={`Inherited from ${inheritedFrom || 'prior season'}. Edit to override.`}
      >
        ↩ inherited
      </span>
    ) : null;

  // ── Spinner component ───────────────────────────────────────────────────────
  const Spinner = () => (
    <svg className="animate-spin h-4 w-4 text-primary" viewBox="0 0 24 24" fill="none">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
      />
    </svg>
  );

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
      <div
        className="bg-surface-container-high border border-outline-variant  max-w-2xl w-full max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-outline-variant">
          <h2 className="font-headline text-lg text-primary">WIKI SETUP</h2>
          <div className="flex items-center gap-4">
            <div className="flex gap-1">
              {[1, 2, 3].map((s) => (
                <div
                  key={s}
                  className={`w-8 h-1 rounded ${s <= step ? 'bg-primary' : 'bg-outline-variant'}`}
                />
              ))}
            </div>
            <button onClick={onClose} className="text-on-surface-variant hover:text-on-surface text-xl">
              &times;
            </button>
          </div>
        </div>

        <div className="p-6">
          {/* ── STEP 1: Find / Create ── */}
          {step === 1 && (
            <div className="space-y-4">
              <h3 className="font-headline text-sm text-on-surface">Connect to QW Wiki</h3>
              <p className="text-sm text-on-surface-variant">
                Choose how to set up your tournament's wiki pages.
              </p>

              {/* Entry mode selector */}
              {!entryMode && (
                <div className="space-y-2">
                  <button
                    onClick={() => {
                      setEntryMode('search');
                      setSearchQuery(tournament.name || '');
                    }}
                    className="w-full text-left p-4  border border-outline-variant bg-background hover:border-primary/50 transition-colors group"
                  >
                    <div className="text-on-surface font-semibold text-sm group-hover:text-primary">
                      Search existing tournaments
                    </div>
                    <div className="text-xs text-on-surface-variant mt-1">
                      Find your tournament series on the wiki (e.g. The Big 4, EQL, NQR)
                    </div>
                  </button>
                  <button
                    onClick={() => setEntryMode('url')}
                    className="w-full text-left p-4  border border-outline-variant bg-background hover:border-primary/50 transition-colors group"
                  >
                    <div className="text-on-surface font-semibold text-sm group-hover:text-primary">
                      Enter wiki page path or URL
                    </div>
                    <div className="text-xs text-on-surface-variant mt-1">
                      Paste the direct URL or path to your tournament's parent page
                    </div>
                  </button>
                  <button
                    onClick={() => setEntryMode('new')}
                    className="w-full text-left p-4  border border-outline-variant bg-background hover:border-primary/50 transition-colors group"
                  >
                    <div className="text-on-surface font-semibold text-sm group-hover:text-primary">
                      Create from scratch
                    </div>
                    <div className="text-xs text-on-surface-variant mt-1">
                      First tournament ever? Set up a brand new wiki page structure
                    </div>
                  </button>
                </div>
              )}

              {/* Search mode */}
              {entryMode === 'search' && (
                <div className="space-y-3">
                  <button
                    onClick={() => {
                      setEntryMode(null);
                      setSearchResults(null);
                      setSelectedRoot('');
                    }}
                    className="text-xs text-on-surface-variant hover:text-on-surface"
                  >
                    &larr; Back
                  </button>

                  <div className="relative">
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => {
                        setSearchQuery(e.target.value);
                        setSelectedRoot('');
                      }}
                      placeholder="Start typing a tournament name..."
                      autoFocus
                      className="w-full bg-background text-on-surface p-3  border border-outline-variant focus:border-primary outline-none text-sm pr-10"
                    />
                    <div className="absolute right-3 top-1/2 -translate-y-1/2">
                      {searchLoading ? (
                        <Spinner />
                      ) : (
                        searchQuery.length >= 2 && (
                          <span className="text-xs text-on-surface-variant">
                            {searchResults?.length ?? ''}
                          </span>
                        )
                      )}
                    </div>
                  </div>

                  {/* Results */}
                  {searchResults !== null && !searchLoading && (
                    <div className="space-y-1 max-h-48 overflow-y-auto">
                      {searchResults.length === 0 && searchQuery.length >= 2 && (
                        <p className="text-sm text-on-surface-variant py-2">
                          No tournaments found for "{searchQuery}"
                        </p>
                      )}
                      {searchResults.map((t) => (
                        <button
                          key={t.root}
                          onClick={() => handleSelectTournament(t.root)}
                          className={`w-full text-left p-3 rounded border transition-colors ${
                            selectedRoot === t.root
                              ? 'border-primary bg-primary/10'
                              : 'border-outline-variant/50 bg-background hover:border-primary/50'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <span className="text-on-surface font-semibold text-sm">{t.root}</span>
                            <span className="text-xs text-on-surface-variant">
                              {t.matchCount || t.pages?.length || 0} pages
                            </span>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}

                  {/* Season name after selection */}
                  {selectedRoot && (
                    <div className="p-3 bg-background  border border-primary/30 space-y-2">
                      {scanLoading ? (
                        <div className="flex items-center gap-2 text-sm text-on-surface-variant py-2">
                          <Spinner /> Scanning existing pages...
                        </div>
                      ) : (
                        <>
                          <label className="text-xs text-on-surface-variant block">Season Name</label>
                          <input
                            type="text"
                            value={seasonName}
                            onChange={(e) => setSeasonName(e.target.value)}
                            placeholder="Season 2"
                            className="w-full bg-surface-container-high text-on-surface p-2 rounded border border-outline-variant focus:border-primary outline-none text-sm"
                          />
                          <div className="text-xs text-on-surface-variant">
                            Pages at:{' '}
                            <span className="text-primary font-mono">{seasonPage || '...'}</span>
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
                  <button
                    onClick={() => {
                      setEntryMode(null);
                      setDirectPath('');
                    }}
                    className="text-xs text-on-surface-variant hover:text-on-surface"
                  >
                    &larr; Back
                  </button>

                  <div>
                    <label className="text-xs text-on-surface-variant block mb-1">
                      Wiki page URL or path
                    </label>
                    <input
                      type="text"
                      value={directPath}
                      onChange={(e) => setDirectPath(parseWikiPath(e.target.value))}
                      placeholder="https://quakeworld.nu/wiki/The_Big_4/Season_3 or The Big 4/Season 3"
                      autoFocus
                      className="w-full bg-background text-on-surface p-3  border border-outline-variant focus:border-primary outline-none text-sm"
                    />
                    {directPath && (
                      <div className="text-xs text-on-surface-variant mt-2">
                        Pages at: <span className="text-primary font-mono">{directPath}</span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Create new mode */}
              {entryMode === 'new' && (
                <div className="space-y-3">
                  <button
                    onClick={() => {
                      setEntryMode(null);
                      setSeasonName('');
                    }}
                    className="text-xs text-on-surface-variant hover:text-on-surface"
                  >
                    &larr; Back
                  </button>

                  <div>
                    <label className="text-xs text-on-surface-variant block mb-1">
                      Full page path for your tournament
                    </label>
                    <input
                      type="text"
                      value={seasonName}
                      onChange={(e) => setSeasonName(e.target.value)}
                      placeholder="My Tournament/Season 1"
                      autoFocus
                      className="w-full bg-background text-on-surface p-3  border border-outline-variant focus:border-primary outline-none text-sm"
                    />
                    <p className="text-xs text-on-surface-variant mt-2">
                      Division pages, Playoffs, and Information pages will be created as sub-pages.
                    </p>
                    {seasonName && (
                      <div className="text-xs text-on-surface-variant mt-1">
                        Example:{' '}
                        <span className="text-primary font-mono">{seasonName}/Division 1</span>,{' '}
                        <span className="text-primary font-mono">{seasonName}/Playoffs</span>
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
              <h3 className="font-headline text-sm text-on-surface">Tournament Metadata</h3>
              {inheritWarning && (
                <div className="p-3 bg-amber-900/20 border border-amber-500/30 rounded text-xs text-amber-300">
                  {inheritWarning}
                </div>
              )}
              <p className="text-sm text-on-surface-variant">
                These fields populate the{' '}
                <code className="text-primary">{'{{Infobox league}}'}</code> template. Format,
                dates, maps, and team count are auto-derived.
              </p>

              {inheritedDivisionNames.length > 0 &&
                inheritedDivisionNames.length === divisionNames.length &&
                inheritedDivisionNames.some((n, i) => n !== divisionNames[i]) && (
                  <div
                    data-testid="division-remap-panel"
                    className="p-3 bg-background border border-primary/30 rounded space-y-2"
                  >
                    <div className="text-xs text-on-surface-variant">
                      Your QWICKY divisions are named differently from the prior wiki season.
                    </div>
                    <table className="w-full text-xs">
                      <thead className="text-on-surface-variant">
                        <tr>
                          <th className="text-left py-1">QWICKY</th>
                          <th className="text-left py-1">Wiki (prior season)</th>
                        </tr>
                      </thead>
                      <tbody>
                        {divisionNames.map((q, i) => (
                          <tr key={q}>
                            <td className="text-on-surface py-0.5">{q}</td>
                            <td className="text-primary py-0.5">{inheritedDivisionNames[i]}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    <div className="flex gap-2 pt-1">
                      <button
                        onClick={() => setRemappedDivisionNames(null)}
                        className={`qw-btn-secondary text-xs px-3 py-1 ${
                          remappedDivisionNames === null ? 'border-primary' : ''
                        }`}
                      >
                        Use QWICKY names
                      </button>
                      <button
                        onClick={() => setRemappedDivisionNames([...inheritedDivisionNames])}
                        className={`qw-btn-secondary text-xs px-3 py-1 ${
                          remappedDivisionNames ? 'border-primary' : ''
                        }`}
                      >
                        Use wiki names
                      </button>
                    </div>
                  </div>
                )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-on-surface-variant block mb-1">
                    Display Name
                    <InheritedBadge fieldKey="name" />
                  </label>
                  <input
                    type="text"
                    value={infobox.name}
                    onChange={(e) => setInfoboxField('name', e.target.value)}
                    className="w-full bg-background text-on-surface p-2 rounded border border-outline-variant focus:border-primary outline-none text-sm"
                  />
                </div>
                <div>
                  <label className="text-xs text-on-surface-variant block mb-1">
                    Navbox Template
                    <InheritedBadge fieldKey="navbox" />
                  </label>
                  <input
                    type="text"
                    value={navbox}
                    onChange={(e) => {
                      setNavbox(e.target.value);
                      setInheritedKeys((prev) => {
                        if (!prev.has('navbox')) return prev;
                        const next = new Set(prev);
                        next.delete('navbox');
                        return next;
                      });
                    }}
                    placeholder="e.g. TB4 Navbox (leave empty if none)"
                    className="w-full bg-background text-on-surface p-2 rounded border border-outline-variant focus:border-primary outline-none text-sm"
                  />
                </div>
                <div className="col-span-2">
                  <label className="text-xs text-on-surface-variant block mb-1">
                    Organizers (wiki markup)
                    <InheritedBadge fieldKey="organizer" />
                  </label>
                  <input
                    type="text"
                    value={infobox.organizer || ''}
                    onChange={(e) => setInfoboxField('organizer', e.target.value)}
                    placeholder="{{player|Nas|flag=se}} {{player|peppe|flag=se}}"
                    className="w-full bg-background text-on-surface p-2 rounded border border-outline-variant focus:border-primary outline-none text-sm"
                  />
                </div>
                <div>
                  <label className="text-xs text-on-surface-variant block mb-1">
                    Website
                    <InheritedBadge fieldKey="website" />
                  </label>
                  <input
                    type="text"
                    value={infobox.website || ''}
                    onChange={(e) => setInfoboxField('website', e.target.value)}
                    placeholder="thebig4.se"
                    className="w-full bg-background text-on-surface p-2 rounded border border-outline-variant focus:border-primary outline-none text-sm"
                  />
                </div>
                <div>
                  <label className="text-xs text-on-surface-variant block mb-1">
                    Discord
                    <InheritedBadge fieldKey="discord" />
                  </label>
                  <input
                    type="text"
                    value={infobox.discord || ''}
                    onChange={(e) => setInfoboxField('discord', e.target.value)}
                    placeholder="http://discord.quake.world"
                    className="w-full bg-background text-on-surface p-2 rounded border border-outline-variant focus:border-primary outline-none text-sm"
                  />
                </div>
                <div>
                  <label className="text-xs text-on-surface-variant block mb-1">
                    Image
                    <InheritedBadge fieldKey="image" />
                  </label>
                  <input
                    type="text"
                    value={infobox.image || ''}
                    onChange={(e) => setInfoboxField('image', e.target.value)}
                    placeholder="TB4-S2-icon.png"
                    className="w-full bg-background text-on-surface p-2 rounded border border-outline-variant focus:border-primary outline-none text-sm"
                  />
                </div>
                <div>
                  <label className="text-xs text-on-surface-variant block mb-1">
                    Prize Pool
                    <InheritedBadge fieldKey="prizepool" />
                  </label>
                  <input
                    type="text"
                    value={infobox.prizepool || ''}
                    onChange={(e) => setInfoboxField('prizepool', e.target.value)}
                    className="w-full bg-background text-on-surface p-2 rounded border border-outline-variant focus:border-primary outline-none text-sm"
                  />
                </div>
              </div>

              <div className="text-xs text-on-surface-variant bg-background p-3 rounded border border-outline-variant/50">
                <div className="font-semibold text-on-surface mb-1">Auto-derived from QWICKY:</div>
                <div>
                  Format: {tournament.mode || '4on4'} | Start: {tournament.startDate || '(not set)'}{' '}
                  | Teams:{' '}
                  {(tournament.divisions || []).reduce((s, d) => s + (d.teams?.length || 0), 0)} |
                  Divisions: {divisionNames.join(', ') || '(none)'}
                </div>
              </div>

              {/* Template reference */}
              <details className="text-xs">
                <summary className="text-on-surface-variant cursor-pointer hover:text-on-surface">
                  Wiki template reference
                </summary>
                <div className="mt-2 p-3 bg-background rounded border border-outline-variant/50 space-y-2 text-on-surface-variant font-mono">
                  <div>
                    <span className="text-primary">{'{{Infobox league}}'}</span> — Tournament
                    header with metadata
                  </div>
                  <div>
                    <span className="text-primary">{'{{Tabs static}}'}</span> — Navigation tabs
                    between pages
                  </div>
                  <div>
                    <span className="text-primary">{'{{GroupTableStart}}'}</span> — Group stage
                    standings table
                  </div>
                  <div>
                    <span className="text-primary">{'{{GroupTableSlot}}'}</span> — Team row in
                    standings
                  </div>
                  <div>
                    <span className="text-primary">{'{{MatchList}}'}</span> — Match results
                    container
                  </div>
                  <div>
                    <span className="text-primary">{'{{MatchMaps}}'}</span> — Individual match
                    with map scores
                  </div>
                  <div>
                    <span className="text-primary">{'{{4SETeamBracket}}'}</span> — 4-team single
                    elimination bracket
                  </div>
                  <div>
                    <span className="text-primary">{'{{8SETeamBracket}}'}</span> — 8-team single
                    elimination bracket
                  </div>
                  <div>
                    <span className="text-primary">{'{{player|Name|flag=xx}}'}</span> — Player
                    link with country flag
                  </div>
                  <div>
                    <span className="text-primary">{'{{Abbr/TBD}}'}</span> — "To be determined"
                    placeholder
                  </div>
                </div>
              </details>

              <div className="flex gap-2">
                <button onClick={() => setStep(1)} className="qw-btn-secondary px-4 py-2 text-sm">
                  Back
                </button>
                <button onClick={() => setStep(3)} className="qw-btn px-6 py-2 text-sm flex-1">
                  Next: Create Pages
                </button>
              </div>
            </div>
          )}

          {/* ── STEP 3: Create Pages ── */}
          {step === 3 && (
            <div className="space-y-4">
              <h3 className="font-headline text-sm text-on-surface">Page Structure</h3>

              {/* Safety notice */}
              <div className="flex items-start gap-2 p-3 bg-blue-900/20 border border-blue-500/30 rounded text-xs text-blue-300">
                <span className="text-blue-400 mt-0.5">&#9432;</span>
                <div>
                  <span className="font-semibold">Existing pages will NOT be overwritten.</span>{' '}
                  Only new pages are created. Pages that already exist on the wiki are safely
                  skipped.
                </div>
              </div>

              {checkingPages && (
                <div className="flex items-center gap-2 text-sm text-on-surface-variant py-2">
                  <Spinner /> Checking existing pages on wiki...
                </div>
              )}

              <details className="text-xs">
                <summary className="cursor-pointer text-on-surface-variant hover:text-on-surface">
                  Preview overview page
                </summary>
                <pre
                  data-testid="overview-preview"
                  className="mt-2 p-3 bg-background border border-outline-variant/50 rounded overflow-x-auto text-[11px] font-mono whitespace-pre-wrap text-on-surface-variant"
                >
                  {buildOverviewPreview()}
                </pre>
              </details>

              <div className="space-y-1">
                {buildPages().map((page, i) => {
                  const exists = existingPages?.[page.link];
                  return (
                    <div
                      key={page.link}
                      className={`flex items-center gap-3 p-2 rounded text-sm ${exists ? 'bg-surface-container-high/50' : 'bg-background'}`}
                    >
                      <span className="font-mono w-6 text-center">
                        {existingPages === null ? (
                          <span className="text-primary">{i + 1}</span>
                        ) : exists ? (
                          <span className="text-on-surface-variant" title="Already exists — will be skipped">
                            &#10003;
                          </span>
                        ) : (
                          <span className="text-tertiary" title="Will be created">
                            +
                          </span>
                        )}
                      </span>
                      <span
                        className={`flex-1 font-mono text-xs ${exists ? 'text-on-surface-variant' : 'text-on-surface'}`}
                      >
                        {page.link}
                      </span>
                      <span className="text-xs capitalize text-on-surface-variant">{page.type}</span>
                      {existingPages !== null && (
                        <span
                          className={`text-[10px] px-1.5 py-0.5 rounded ${exists ? 'bg-zinc-700 text-zinc-400' : 'bg-qw-win/20 text-tertiary'}`}
                        >
                          {exists ? 'exists' : 'new'}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>

              {existingPages && Object.values(existingPages).every((v) => v) && (
                <div className="p-3 bg-amber-900/20 border border-amber-500/30 rounded text-xs text-amber-300">
                  All pages already exist. Nothing will be created, but auto-publish targets will
                  still be configured.
                </div>
              )}

              {!scaffoldResult?.ok && (
                <div className="flex items-start gap-2 text-xs p-3 bg-background rounded border border-outline-variant/50">
                  <input
                    id="publish-current-state"
                    type="checkbox"
                    checked={publishCurrent}
                    onChange={(e) => setPublishCurrent(e.target.checked)}
                    className="mt-0.5"
                  />
                  <label htmlFor="publish-current-state" className="text-on-surface-variant">
                    Also publish current QWICKY data to these pages now
                    <div className="text-[11px] text-on-surface-variant/80 mt-0.5">
                      Prevents pages from being born empty. Unchecked if the tournament has no matches yet.
                    </div>
                  </label>
                </div>
              )}

              {publishProgress && (
                <div className="text-xs text-on-surface-variant py-1">{publishProgress}</div>
              )}

              {scaffoldResult && (
                <div
                  className={`p-3 rounded border text-sm ${
                    scaffoldResult.ok
                      ? 'bg-green-900/20 border-green-500/50 text-green-300'
                      : 'bg-red-900/20 border-red-500/50 text-red-300'
                  }`}
                >
                  {scaffoldResult.ok ? (
                    <>
                      <div className="font-semibold">Pages created successfully!</div>
                      {scaffoldResult.created?.map((p) => (
                        <div key={p.title} className="text-xs mt-1">
                          + {p.title}
                        </div>
                      ))}
                      {scaffoldResult.skipped?.map((p) => (
                        <div key={p.title} className="text-xs mt-1 text-on-surface-variant">
                          - {p.title} (exists)
                        </div>
                      ))}
                      <div className="mt-2 text-xs text-on-surface-variant">
                        Auto-publish targets configured. Wiki updates as you approve games.
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="font-semibold">Some errors occurred:</div>
                      {scaffoldResult.created?.map((p) => (
                        <div key={p.title} className="text-xs mt-1 text-tertiary">
                          + {p.title}
                        </div>
                      ))}
                      {scaffoldResult.errors?.map((e) => (
                        <div key={e.title} className="text-xs mt-1">
                          ! {e.title}: {e.error}
                        </div>
                      ))}
                    </>
                  )}
                </div>
              )}

              <div className="flex gap-2">
                <button onClick={() => setStep(2)} className="qw-btn-secondary px-4 py-2 text-sm">
                  Back
                </button>
                {!scaffoldResult?.ok ? (
                  <button
                    onClick={handleScaffold}
                    disabled={scaffoldLoading}
                    className="qw-btn px-6 py-2 text-sm flex-1 disabled:opacity-50"
                  >
                    {scaffoldLoading ? (
                      <span className="flex items-center justify-center gap-2">
                        <Spinner /> Creating Pages...
                      </span>
                    ) : (
                      'Create Pages on Wiki'
                    )}
                  </button>
                ) : (
                  <button
                    onClick={async () => {
                      if (publishCurrent) {
                        await runPublishCurrent(tournament.divisions || []);
                      }
                      onClose();
                    }}
                    className="qw-btn px-6 py-2 text-sm flex-1"
                  >
                    Done
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
