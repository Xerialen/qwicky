// src/components/division/DivisionWiki.jsx
import React, { useState, useMemo } from 'react';
import { calculateStats, generateWikiTable } from '../../utils/statsLogic';
import { renderWikiPreview } from '../../utils/wikiPreview';
import { publishDivisionWiki } from '../../services/wikiPublisher';
import { supabase } from '../../services/supabaseClient';
import EmptyState from '../EmptyState';
import MaterialIcon from '../ui/MaterialIcon';
import {
  calculateStandings,
  generateStandingsWiki,
  generateMatchListWiki,
  generateBracketWiki,
} from '../../utils/qwikiMarkup';

export default function DivisionWiki({ division, tournamentName, updateDivision }) {
  const [activeExport, setActiveExport] = useState('standings');
  const [copied, setCopied] = useState(false);
  const [viewMode, setViewMode] = useState('code');
  const [showPublishModal, setShowPublishModal] = useState(false);
  const [publishState, setPublishState] = useState({ status: 'idle', message: '' });
  const [publishFields, setPublishFields] = useState({
    pageTitle: '',
    section: '',
    summary: 'Updated via QWICKY',
  });
  const [publishNowState, setPublishNowState] = useState({ status: 'idle', message: '' });
  const [options, setOptions] = useState({
    title: division.name || 'Division',
  });
  const [showAutoConfig, setShowAutoConfig] = useState(false);

  // Toggle states for export sections
  const [includeStandings, setIncludeStandings] = useState(true);
  const [includeMatches, setIncludeMatches] = useState(true);
  const [includeBracket, setIncludeBracket] = useState(false);

  const wikiConfig = division.wikiConfig || { enabled: false, targets: [] };

  const updateWikiConfig = (updates) => {
    if (!updateDivision) return;
    const updated = { ...wikiConfig, ...updates };
    updateDivision({ wikiConfig: updated });

    // Sync to Supabase (fire-and-forget)
    if (division.id) {
      fetch('/api/wiki?action=config-division', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ divisionId: division.id, wikiConfig: updated }),
      }).catch(() => {});
    }
  };

  const addTarget = (type) => {
    const targets = [...(wikiConfig.targets || []), { type, page: '', section: '' }];
    updateWikiConfig({ targets });
  };

  const updateTarget = (idx, field, value) => {
    const targets = [...(wikiConfig.targets || [])];
    targets[idx] = { ...targets[idx], [field]: value };
    updateWikiConfig({ targets });
  };

  const removeTarget = (idx) => {
    const targets = (wikiConfig.targets || []).filter((_, i) => i !== idx);
    updateWikiConfig({ targets });
  };

  const teams = division.teams || [];
  const schedule = division.schedule || [];
  const rawMaps = division.rawMaps || [];
  const standings = useMemo(() => calculateStandings(schedule, division), [schedule, division]);

  // Show empty state if no teams exist
  if (teams.length === 0) {
    return (
      <EmptyState
        icon="📝"
        title="Nothing to export yet"
        description="Add teams and match results before generating wiki markup. The wiki export will include standings, match results, and playoff brackets."
      />
    );
  }

  // Extract original ktxstats data for player stats calculation
  const ktxstatsData = useMemo(() => {
    if (!rawMaps || rawMaps.length === 0) return [];
    return rawMaps.map((m) => m.originalData).filter((d) => d && d.players);
  }, [rawMaps]);

  // Calculate player stats
  const playersDb = useMemo(() => {
    if (!ktxstatsData || ktxstatsData.length === 0) return {};
    return calculateStats(ktxstatsData);
  }, [ktxstatsData]);

  const wikiContent = useMemo(() => {
    switch (activeExport) {
      case 'standings':
        return generateStandingsWiki(standings, teams, division, options);
      case 'matches':
        return generateMatchListWiki(schedule, teams, division, options);
      case 'bracket':
        return generateBracketWiki(division.bracket, schedule, teams, division, options);
      case 'stats':
        return generateWikiTable(playersDb);
      case 'full':
        return (
          generateStandingsWiki(standings, teams, division, options) +
          '\n' +
          generateMatchListWiki(schedule, teams, division, options) +
          '\n' +
          generateBracketWiki(division.bracket, schedule, teams, division, {
            ...options,
            title: 'Playoffs',
          })
        );
      default:
        return '';
    }
  }, [activeExport, standings, schedule, division.bracket, teams, options, playersDb]);

  const handleCopy = async () => {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      try {
        await navigator.clipboard.writeText(wikiContent);
        setCopied(true);
      } catch (err) {
        console.warn('Clipboard API failed, trying fallback...', err);
        fallbackCopy();
      }
    } else {
      fallbackCopy();
    }
    setTimeout(() => setCopied(false), 2000);
  };

  const fallbackCopy = () => {
    const textArea = document.createElement('textarea');
    textArea.value = wikiContent;
    textArea.style.top = '0';
    textArea.style.left = '0';
    textArea.style.position = 'fixed';
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    try {
      const successful = document.execCommand('copy');
      if (successful) setCopied(true);
    } catch (err) {
      console.error('Fallback copy failed', err);
    }
    document.body.removeChild(textArea);
  };

  const handleDownload = () => {
    const blob = new Blob([wikiContent], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${division.name.replace(/\s+/g, '_')}_${activeExport}.wiki.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handlePublishToWiki = async () => {
    if (!publishFields.pageTitle.trim()) {
      setPublishState({ status: 'error', message: 'Page title is required' });
      return;
    }
    setPublishState({ status: 'publishing', message: 'Publishing to wiki...' });
    try {
      const payload = {
        pageTitle: publishFields.pageTitle.trim(),
        content: wikiContent,
        summary: publishFields.summary || 'Updated via QWICKY',
      };
      if (publishFields.section && publishFields.section !== '') {
        payload.section = parseInt(publishFields.section, 10);
      }
      const res = await fetch('/api/wiki?action=publish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (data.ok) {
        setPublishState({ status: 'success', message: `Published! ${data.pageUrl || ''}` });
      } else {
        setPublishState({ status: 'error', message: data.error || 'Unknown error' });
      }
    } catch (err) {
      setPublishState({ status: 'error', message: `Request failed: ${err.message}` });
    }
  };

  const completedMatches = schedule.filter((m) => m.status === 'completed').length;
  const outputSize = new Blob([wikiContent]).size;
  const outputSizeLabel = outputSize > 1024 ? `${(outputSize / 1024).toFixed(1)} KB` : `${outputSize} B`;

  return (
    <div className="space-y-6">
      {/* Header & Status */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black font-headline uppercase tracking-tighter text-on-surface">
            Wiki Export & Data
          </h1>
          <p className="text-secondary font-mono text-xs mt-1 uppercase tracking-widest">
            Runtime Environment // System.Wiki_Generator
          </p>
        </div>
        <div className="flex gap-2 font-mono text-[10px]">
          <span className="bg-surface-container-lowest px-2 py-1 border-l-2 border-primary">
            {wikiConfig.enabled ? 'AUTO-SYNC: ACTIVE' : 'AUTO-SYNC: OFF'}
          </span>
          <span className="bg-surface-container-lowest px-2 py-1 border-l-2 border-tertiary text-tertiary">
            {completedMatches} MATCHES
          </span>
        </div>
      </div>

      {/* Bento Layout Grid */}
      <div className="grid grid-cols-12 gap-6">
        {/* Left: Configuration Panel (4/12) */}
        <div className="col-span-12 lg:col-span-4 space-y-6">
          {/* Configuration Slab */}
          <div className="bg-surface-container-high p-6 flex flex-col space-y-6 relative overflow-hidden">
            <div className="absolute left-0 top-0 bottom-0 w-1 bg-primary" />
            <h2 className="font-headline font-bold uppercase tracking-widest text-sm text-on-surface-variant flex items-center">
              <MaterialIcon name="settings_input_component" className="mr-2 text-primary text-base" />
              Export Configuration
            </h2>

            {/* Toggles */}
            <div className="space-y-4">
              {[
                { label: 'Include Standings', checked: includeStandings, set: setIncludeStandings },
                { label: 'Include Match History', checked: includeMatches, set: setIncludeMatches },
                { label: 'Include Bracket', checked: includeBracket, set: setIncludeBracket },
              ].map(({ label, checked, set }) => (
                <label key={label} className="flex items-center justify-between group cursor-pointer">
                  <span className="text-xs font-medium text-on-surface-variant">{label}</span>
                  <div className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={(e) => set(e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-9 h-5 bg-surface-container-lowest rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-on-surface-variant/50 peer-checked:after:bg-primary after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-secondary-container" />
                  </div>
                </label>
              ))}
            </div>

            <hr className="border-outline-variant opacity-20" />

            {/* Template Selector */}
            <div className="space-y-3">
              <span className="text-[10px] uppercase tracking-widest text-secondary font-headline font-bold">
                Template Selector
              </span>
              <div className="grid grid-cols-1 gap-2">
                {[
                  { id: 'standings', label: 'Standings' },
                  { id: 'matches', label: 'Match List' },
                  { id: 'bracket', label: 'Bracket' },
                  { id: 'stats', label: 'Player Stats' },
                  { id: 'full', label: 'Full Page' },
                ].map((tmpl) => (
                  <button
                    key={tmpl.id}
                    onClick={() => setActiveExport(tmpl.id)}
                    className={`text-left px-4 py-3 bg-surface-container-lowest border-l-4 text-xs font-mono flex items-center justify-between transition-all ${
                      activeExport === tmpl.id
                        ? 'border-primary text-primary'
                        : 'border-transparent hover:border-outline-variant text-on-surface-variant/50 hover:text-on-surface-variant'
                    }`}
                  >
                    {tmpl.label}
                    {activeExport === tmpl.id && (
                      <MaterialIcon name="check_circle" className="text-xs" />
                    )}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Export Summary Info Card */}
          <div className="bg-surface-container-lowest border border-outline-variant/30 p-6">
            <h3 className="text-xs font-headline font-bold text-on-surface uppercase tracking-widest mb-4">
              Export Summary
            </h3>
            <div className="space-y-3 font-mono text-[10px] text-on-surface-variant/60">
              <div className="flex justify-between">
                <span>Total Teams</span>
                <span className="text-primary">{teams.length}</span>
              </div>
              <div className="flex justify-between">
                <span>Match Records</span>
                <span className="text-primary">{schedule.length}</span>
              </div>
              <div className="flex justify-between">
                <span>Output Lines</span>
                <span className="text-primary">{wikiContent.split('\n').length}</span>
              </div>
              <div className="flex justify-between">
                <span>Output Size</span>
                <span>{outputSizeLabel}</span>
              </div>
            </div>
          </div>

          {/* Auto-Publish Config */}
          {updateDivision && (
            <div className="bg-surface-container-high overflow-hidden">
              <button
                onClick={() => setShowAutoConfig(!showAutoConfig)}
                className="w-full flex items-center justify-between px-4 py-3 border-b border-outline-variant/10 hover:bg-surface-variant transition-colors"
              >
                <div className="flex items-center gap-3">
                  <span className={`w-2 h-2 rounded-full ${wikiConfig.enabled ? 'bg-tertiary' : 'bg-outline-variant'}`} />
                  <span className="font-headline text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">
                    Auto-Publish Config
                  </span>
                </div>
                <MaterialIcon name={showAutoConfig ? 'expand_less' : 'expand_more'} className="text-on-surface-variant/40 text-sm" />
              </button>

              {showAutoConfig && (
                <div className="p-4 space-y-4">
                  <div className="flex items-center justify-between">
                    <label className="text-on-surface text-xs">Enable auto-publish</label>
                    <button
                      onClick={() => updateWikiConfig({ enabled: !wikiConfig.enabled })}
                      className={`relative w-11 h-6 rounded-full transition-colors ${wikiConfig.enabled ? 'bg-tertiary' : 'bg-outline-variant'}`}
                    >
                      <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${wikiConfig.enabled ? 'translate-x-5' : 'translate-x-0.5'}`} />
                    </button>
                  </div>

                  {wikiConfig.enabled && (
                    <>
                      <div className="space-y-2">
                        <label className="text-on-surface-variant text-[10px] font-headline font-bold uppercase tracking-widest block">
                          Publish Targets
                        </label>
                        {(wikiConfig.targets || []).map((target, idx) => (
                          <div key={idx} className="flex gap-2 items-center">
                            <select
                              value={target.type}
                              onChange={(e) => updateTarget(idx, 'type', e.target.value)}
                              className="bg-surface-container-lowest border-b border-outline-variant px-2 py-1.5 text-xs text-on-surface w-24 font-mono"
                            >
                              <option value="standings">Standings</option>
                              <option value="matches">Matches</option>
                              <option value="bracket">Bracket</option>
                              <option value="full">Full</option>
                            </select>
                            <input
                              type="text"
                              value={target.page}
                              onChange={(e) => updateTarget(idx, 'page', e.target.value)}
                              placeholder="Wiki page name"
                              className="flex-1 text-xs"
                            />
                            <button onClick={() => removeTarget(idx)} className="text-error hover:text-error/80 px-1">
                              <MaterialIcon name="close" className="text-sm" />
                            </button>
                          </div>
                        ))}
                        <div className="flex gap-2">
                          {['standings', 'matches', 'bracket']
                            .filter((t) => !(wikiConfig.targets || []).some((x) => x.type === t))
                            .map((type) => (
                              <button
                                key={type}
                                onClick={() => addTarget(type)}
                                className="bg-surface-container-lowest border border-outline-variant/20 px-2 py-1 text-[9px] font-mono uppercase text-on-surface-variant/50 hover:text-primary transition-colors"
                              >
                                + {type}
                              </button>
                            ))}
                        </div>
                      </div>

                      {(wikiConfig.targets || []).some((t) => t.page) && (
                        <div className="pt-3 border-t border-outline-variant/20">
                          <div className="flex items-center gap-3">
                            <button
                              onClick={async () => {
                                setPublishNowState({ status: 'publishing', message: 'Publishing...' });
                                try {
                                  const fakeTournament = { settings: { wikiAutoPublish: true } };
                                  const { data: { session } } = await supabase.auth.getSession();
                                  const results = await publishDivisionWiki(division, fakeTournament, session?.access_token);
                                  const ok = results.filter((r) => r.ok);
                                  const fail = results.filter((r) => !r.ok);
                                  if (fail.length === 0) {
                                    setPublishNowState({ status: 'success', message: `Published ${ok.length} target(s)` });
                                  } else if (ok.length > 0) {
                                    setPublishNowState({ status: 'warn', message: `${ok.length} updated, ${fail.length} failed: ${fail[0]?.error}` });
                                  } else {
                                    setPublishNowState({ status: 'error', message: fail[0]?.error || 'Publish failed' });
                                  }
                                } catch (err) {
                                  setPublishNowState({ status: 'error', message: err.message });
                                }
                                setTimeout(() => setPublishNowState({ status: 'idle', message: '' }), 8000);
                              }}
                              disabled={publishNowState.status === 'publishing'}
                              className="heat-gradient text-on-primary-fixed px-4 py-1.5 text-[10px] font-headline font-bold uppercase tracking-widest disabled:opacity-50"
                            >
                              {publishNowState.status === 'publishing' ? 'Publishing...' : 'Publish Now'}
                            </button>
                            {publishNowState.status !== 'idle' && publishNowState.status !== 'publishing' && (
                              <span className={`text-xs ${
                                publishNowState.status === 'success' ? 'text-tertiary'
                                : publishNowState.status === 'warn' ? 'text-secondary'
                                : 'text-error'
                              }`}>
                                {publishNowState.message}
                              </span>
                            )}
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Right: Terminal-Style Preview & Output (8/12) */}
        <div className="col-span-12 lg:col-span-8 space-y-6 relative">
          <div className="bg-surface-container-high h-full min-h-[500px] flex flex-col relative">
            {/* Terminal Header */}
            <div className="flex items-center justify-between px-6 py-3 bg-surface-container-lowest border-b border-outline-variant/10">
              <div className="flex items-center space-x-2">
                <div className="w-2.5 h-2.5 rounded-full bg-error/40" />
                <div className="w-2.5 h-2.5 rounded-full bg-primary/40" />
                <div className="w-2.5 h-2.5 rounded-full bg-tertiary/40" />
                <span className="ml-4 font-mono text-[10px] text-on-surface-variant/40 uppercase tracking-widest">
                  mediawiki_{activeExport}_preview.txt
                </span>
              </div>
              <div className="flex items-center gap-3">
                <div className="flex gap-1">
                  <button
                    onClick={() => setViewMode('code')}
                    className={`px-3 py-1 text-[10px] font-bold uppercase tracking-widest transition-colors ${
                      viewMode === 'code'
                        ? 'bg-primary-container text-on-primary-fixed'
                        : 'bg-surface-container-high text-on-surface-variant/40 hover:text-on-surface-variant'
                    }`}
                  >
                    Code
                  </button>
                  <button
                    onClick={() => setViewMode('preview')}
                    className={`px-3 py-1 text-[10px] font-bold uppercase tracking-widest transition-colors ${
                      viewMode === 'preview'
                        ? 'bg-primary-container text-on-primary-fixed'
                        : 'bg-surface-container-high text-on-surface-variant/40 hover:text-on-surface-variant'
                    }`}
                  >
                    Preview
                  </button>
                </div>
                <div className="font-mono text-[10px] text-on-surface-variant/30">
                  UTF-8 // {wikiContent.split('\n').length} lines
                </div>
              </div>
            </div>

            {/* Code / Preview Block */}
            <div className="flex-1 p-6 overflow-y-auto bg-surface-container-lowest/50 max-h-[500px]">
              {viewMode === 'code' ? (
                <pre className="font-mono text-xs text-secondary-fixed-dim leading-relaxed whitespace-pre-wrap">
                  {wikiContent || '// No content generated'}
                </pre>
              ) : (
                <div className="wiki-preview">{renderWikiPreview(wikiContent, activeExport)}</div>
              )}
            </div>

            {/* Terminal Footer & Actions */}
            <div className="p-6 bg-surface-container-high border-t border-outline-variant/10 flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center space-x-4">
                <button
                  onClick={handleDownload}
                  className="flex items-center space-x-2 bg-surface-container-lowest px-4 py-2 hover:bg-surface-container-highest transition-colors active:scale-95 group"
                >
                  <MaterialIcon name="download" className="text-sm text-on-surface-variant/50 group-hover:text-primary transition-colors" />
                  <span className="font-headline font-bold uppercase tracking-widest text-[10px] text-on-surface-variant">
                    Download File
                  </span>
                </button>
                <button
                  onClick={() => {
                    setShowPublishModal(true);
                    setPublishState({ status: 'idle', message: '' });
                  }}
                  className="flex items-center space-x-2 bg-surface-container-lowest px-4 py-2 hover:bg-surface-container-highest transition-colors active:scale-95 group"
                >
                  <MaterialIcon name="publish" className="text-sm text-on-surface-variant/50 group-hover:text-primary transition-colors" />
                  <span className="font-headline font-bold uppercase tracking-widest text-[10px] text-on-surface-variant">
                    Publish to Wiki
                  </span>
                </button>
              </div>
              <button
                onClick={handleCopy}
                className={`flex items-center space-x-2 px-6 py-2.5 font-headline font-black uppercase tracking-widest text-xs transition-all active:scale-95 ${
                  copied
                    ? 'bg-tertiary/20 text-tertiary border border-tertiary/30'
                    : 'heat-gradient text-on-primary-fixed shadow-heat'
                }`}
              >
                <MaterialIcon name={copied ? 'check' : 'content_copy'} className="text-base" />
                <span>{copied ? 'Copied!' : 'Copy to Clipboard'}</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Footer Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-surface-container-high/50 p-4 border-l-4 border-outline-variant/30">
          <div className="text-[9px] uppercase tracking-tighter text-on-surface-variant/40 font-mono">Output Type</div>
          <div className="text-xs font-mono text-on-surface capitalize">{activeExport}</div>
        </div>
        <div className="bg-surface-container-high/50 p-4 border-l-4 border-outline-variant/30">
          <div className="text-[9px] uppercase tracking-tighter text-on-surface-variant/40 font-mono">Teams in Export</div>
          <div className="text-xs font-mono text-on-surface">{teams.length}</div>
        </div>
        <div className="bg-surface-container-high/50 p-4 border-l-4 border-outline-variant/30">
          <div className="text-[9px] uppercase tracking-tighter text-on-surface-variant/40 font-mono">Output Size</div>
          <div className="text-xs font-mono text-on-surface">{outputSizeLabel}</div>
        </div>
        <div className="bg-surface-container-high/50 p-4 border-l-4 border-outline-variant/30">
          <div className="text-[9px] uppercase tracking-tighter text-on-surface-variant/40 font-mono">Character Count</div>
          <div className="text-xs font-mono text-on-surface">{wikiContent.length.toLocaleString()}</div>
        </div>
      </div>

      {/* Team Players Help */}
      <div className="bg-surface-container-high p-4 border-l-4 border-outline-variant/20">
        <h4 className="font-headline text-[10px] font-bold uppercase tracking-widest text-on-surface-variant mb-2">
          Team Players
        </h4>
        <p className="text-[10px] text-on-surface-variant/50 font-mono mb-2">
          To include player names, add them in the Teams tab. Format: TeamName|player1, player2, player3
        </p>
        {teams.length > 0 && (
          <div className="flex flex-wrap gap-2 text-[10px]">
            {teams.slice(0, 4).map((t) => (
              <span key={t.id} className="px-2 py-1 bg-surface-container-lowest font-mono text-on-surface-variant/50">
                {t.name}: {t.players || <span className="italic">no players</span>}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Publish to Wiki Modal */}
      {showPublishModal && (
        <div
          className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4"
          onClick={() => setShowPublishModal(false)}
        >
          <div
            className="bg-surface-container-high border border-outline-variant w-full max-w-md p-6 space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="font-headline text-sm font-bold uppercase tracking-widest text-primary flex items-center gap-2">
              <MaterialIcon name="publish" className="text-base" />
              Publish to Wiki
            </h3>

            <div className="space-y-3">
              <div>
                <label className="block text-[10px] font-headline font-bold uppercase tracking-widest text-on-surface-variant mb-1">
                  Page Title *
                </label>
                <input
                  type="text"
                  value={publishFields.pageTitle}
                  onChange={(e) => setPublishFields((f) => ({ ...f, pageTitle: e.target.value }))}
                  placeholder="QW_Champions_League/Season_5/Division_1"
                  className="w-full"
                />
              </div>

              <div>
                <label className="block text-[10px] font-headline font-bold uppercase tracking-widest text-on-surface-variant mb-1">
                  Section (optional)
                </label>
                <input
                  type="text"
                  value={publishFields.section}
                  onChange={(e) => setPublishFields((f) => ({ ...f, section: e.target.value }))}
                  placeholder="Leave empty to edit entire page"
                  className="w-full"
                />
              </div>

              <div>
                <label className="block text-[10px] font-headline font-bold uppercase tracking-widest text-on-surface-variant mb-1">
                  Edit Summary
                </label>
                <input
                  type="text"
                  value={publishFields.summary}
                  onChange={(e) => setPublishFields((f) => ({ ...f, summary: e.target.value }))}
                  className="w-full"
                />
              </div>

              <div className="font-mono text-[9px] text-on-surface-variant/40 uppercase">
                Content: {activeExport} export ({wikiContent.length.toLocaleString()} chars)
              </div>
            </div>

            {publishState.status !== 'idle' && (
              <div className={`text-xs px-3 py-2 font-mono ${
                publishState.status === 'publishing' ? 'bg-primary/10 text-primary'
                : publishState.status === 'success' ? 'bg-tertiary/10 text-tertiary'
                : 'bg-error/10 text-error'
              }`}>
                {publishState.message}
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setShowPublishModal(false)}
                className="px-4 py-2 text-[10px] font-headline font-bold uppercase tracking-widest bg-surface-container-lowest text-on-surface-variant hover:text-on-surface transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handlePublishToWiki}
                disabled={publishState.status === 'publishing'}
                className="heat-gradient text-on-primary-fixed px-4 py-2 text-[10px] font-headline font-bold uppercase tracking-widest disabled:opacity-50"
              >
                {publishState.status === 'publishing' ? 'Publishing...' : 'Publish'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
