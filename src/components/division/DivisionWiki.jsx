// src/components/division/DivisionWiki.jsx
import React, { useState, useMemo } from 'react';
import { calculateStats, generateWikiTable } from '../../utils/statsLogic';
import { renderWikiPreview } from '../../utils/wikiPreview';
import { publishDivisionWiki } from '../../services/wikiPublisher';
import { supabase } from '../../services/supabaseClient';
import EmptyState from '../EmptyState';
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
    // Check if the modern Clipboard API is available (requires HTTPS)
    if (navigator.clipboard && navigator.clipboard.writeText) {
      try {
        await navigator.clipboard.writeText(wikiContent);
        setCopied(true);
      } catch (err) {
        console.warn('Clipboard API failed, trying fallback...', err);
        fallbackCopy();
      }
    } else {
      // Fallback for non-secure contexts (HTTP/LAN)
      fallbackCopy();
    }
    setTimeout(() => setCopied(false), 2000);
  };

  // Helper function for the "Old School" copy method
  const fallbackCopy = () => {
    const textArea = document.createElement('textarea');
    textArea.value = wikiContent;

    // Prevent scrolling to bottom
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

  return (
    <div className="space-y-6">
      {/* Auto-Publish Config */}
      {updateDivision && (
        <div className="qw-panel overflow-hidden">
          <button
            onClick={() => setShowAutoConfig(!showAutoConfig)}
            className="w-full flex items-center justify-between px-4 py-3 bg-qw-dark border-b border-qw-border hover:bg-qw-darker transition-colors"
          >
            <div className="flex items-center gap-3">
              <span
                className={`w-2 h-2 rounded-full ${wikiConfig.enabled ? 'bg-qw-win' : 'bg-qw-border'}`}
              />
              <h3 className="font-display text-sm text-qw-accent">AUTO-PUBLISH</h3>
              <span className="text-xs text-qw-muted">
                {wikiConfig.enabled ? `${(wikiConfig.targets || []).length} target(s)` : 'disabled'}
              </span>
            </div>
            <span className="text-qw-muted text-xs">{showAutoConfig ? '▲' : '▼'}</span>
          </button>

          {showAutoConfig && (
            <div className="p-4 space-y-4">
              {/* Enable toggle */}
              <div className="flex items-center justify-between">
                <label className="text-white text-sm">Enable auto-publish for this division</label>
                <button
                  onClick={() => updateWikiConfig({ enabled: !wikiConfig.enabled })}
                  className={`relative w-11 h-6 rounded-full transition-colors ${wikiConfig.enabled ? 'bg-qw-win' : 'bg-qw-border'}`}
                >
                  <span
                    className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${wikiConfig.enabled ? 'translate-x-5' : 'translate-x-0.5'}`}
                  />
                </button>
              </div>

              {wikiConfig.enabled && (
                <>
                  {/* Targets table */}
                  <div className="space-y-2">
                    <label className="text-white text-sm font-semibold block">
                      Publish Targets
                    </label>
                    {(wikiConfig.targets || []).map((target, idx) => (
                      <div key={idx} className="flex gap-2 items-center">
                        <select
                          value={target.type}
                          onChange={(e) => updateTarget(idx, 'type', e.target.value)}
                          className="bg-qw-darker border border-qw-border rounded px-2 py-1.5 text-sm text-white w-28"
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
                          className="flex-1 bg-qw-darker border border-qw-border rounded px-2 py-1.5 text-sm text-white font-mono placeholder-qw-muted"
                        />
                        <input
                          type="text"
                          value={target.section}
                          onChange={(e) => updateTarget(idx, 'section', e.target.value)}
                          placeholder="Section (empty = full page)"
                          className="flex-1 bg-qw-darker border border-qw-border rounded px-2 py-1.5 text-sm text-white font-mono placeholder-qw-muted"
                        />
                        <button
                          onClick={() => removeTarget(idx)}
                          className="text-qw-loss hover:text-red-400 px-2 text-lg"
                        >
                          x
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
                            className="qw-btn-secondary px-3 py-1 text-xs capitalize"
                          >
                            + {type}
                          </button>
                        ))}
                    </div>
                  </div>

                  {/* Publish Now button */}
                  {(wikiConfig.targets || []).some((t) => t.page) && (
                    <div className="pt-3 border-t border-qw-border/30">
                      <div className="flex items-center gap-3">
                        <button
                          onClick={async () => {
                            setPublishNowState({ status: 'publishing', message: 'Publishing...' });
                            try {
                              // Build a minimal tournament object for the publisher
                              const fakeTournament = { settings: { wikiAutoPublish: true } };
                              const {
                                data: { session },
                              } = await supabase.auth.getSession();
                              const results = await publishDivisionWiki(
                                division,
                                fakeTournament,
                                session?.access_token
                              );
                              const ok = results.filter((r) => r.ok);
                              const fail = results.filter((r) => !r.ok);
                              if (fail.length === 0) {
                                setPublishNowState({
                                  status: 'success',
                                  message: `Published ${ok.length} target(s)`,
                                });
                              } else if (ok.length > 0) {
                                setPublishNowState({
                                  status: 'warn',
                                  message: `${ok.length} updated, ${fail.length} failed: ${fail[0]?.error}`,
                                });
                              } else {
                                setPublishNowState({
                                  status: 'error',
                                  message: fail[0]?.error || 'Publish failed',
                                });
                              }
                            } catch (err) {
                              setPublishNowState({ status: 'error', message: err.message });
                            }
                            setTimeout(
                              () => setPublishNowState({ status: 'idle', message: '' }),
                              8000
                            );
                          }}
                          disabled={publishNowState.status === 'publishing'}
                          className="qw-btn px-4 py-1.5 text-xs disabled:opacity-50"
                        >
                          {publishNowState.status === 'publishing'
                            ? 'Publishing...'
                            : 'Publish Now'}
                        </button>
                        {publishNowState.status !== 'idle' &&
                          publishNowState.status !== 'publishing' && (
                            <span
                              className={`text-xs ${
                                publishNowState.status === 'success'
                                  ? 'text-qw-win'
                                  : publishNowState.status === 'warn'
                                    ? 'text-amber-300'
                                    : 'text-qw-loss'
                              }`}
                            >
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

      <div className="flex gap-2 flex-wrap">
        {['standings', 'matches', 'bracket', 'stats', 'full'].map((type) => (
          <button
            key={type}
            onClick={() => setActiveExport(type)}
            className={`px-4 py-2 rounded font-body font-semibold capitalize ${activeExport === type ? 'bg-qw-accent text-qw-dark' : 'bg-qw-panel border border-qw-border text-qw-muted hover:text-white'}`}
          >
            {type === 'full' ? 'Full Page' : type === 'stats' ? 'Player Stats' : type}
          </button>
        ))}
      </div>

      <div className="qw-panel overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 bg-qw-dark border-b border-qw-border">
          <div className="flex items-center gap-4">
            <div>
              <h3 className="font-display text-sm text-qw-accent">WIKI OUTPUT</h3>
              <span className="text-xs text-zinc-500">
                {wikiContent.split('\n').length} lines · {wikiContent.length.toLocaleString()}{' '}
                characters
              </span>
            </div>
            <div className="flex gap-1">
              <button
                onClick={() => setViewMode('code')}
                className={`px-3 py-1 rounded text-xs font-semibold transition-colors ${
                  viewMode === 'code'
                    ? 'bg-qw-accent text-qw-dark'
                    : 'bg-zinc-800 text-zinc-400 hover:text-zinc-200'
                }`}
              >
                Code
              </button>
              <button
                onClick={() => setViewMode('preview')}
                className={`px-3 py-1 rounded text-xs font-semibold transition-colors ${
                  viewMode === 'preview'
                    ? 'bg-qw-accent text-qw-dark'
                    : 'bg-zinc-800 text-zinc-400 hover:text-zinc-200'
                }`}
              >
                Preview
              </button>
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleCopy}
              className={`px-3 py-1.5 rounded text-xs transition-all duration-200 ${
                copied
                  ? 'bg-qw-win/20 text-qw-win'
                  : 'bg-zinc-800 text-zinc-400 hover:text-zinc-200'
              }`}
            >
              {copied ? '✓ Copied!' : 'Copy to Clipboard'}
            </button>
            <button
              onClick={handleDownload}
              className="px-3 py-1.5 rounded text-xs bg-qw-accent text-qw-dark hover:bg-qw-accent-dim transition-colors"
            >
              ⬇ Download
            </button>
            <button
              onClick={() => {
                setShowPublishModal(true);
                setPublishState({ status: 'idle', message: '' });
              }}
              className="px-3 py-1.5 rounded text-xs bg-blue-600 text-white hover:bg-blue-500 transition-colors"
            >
              Publish to Wiki
            </button>
          </div>
        </div>
        <div className="p-4 max-h-[500px] overflow-auto">
          {viewMode === 'code' ? (
            <pre className="font-mono text-xs text-qw-text whitespace-pre-wrap">
              {wikiContent || ''}
            </pre>
          ) : (
            <div className="wiki-preview">{renderWikiPreview(wikiContent, activeExport)}</div>
          )}
        </div>
      </div>

      {/* Help section */}
      <div className="qw-panel p-4">
        <h4 className="font-display text-sm text-qw-accent mb-2">TEAM PLAYERS</h4>
        <p className="text-xs text-qw-muted mb-2">
          To include player names in wiki output, add them to each team in the Teams tab. The wiki
          templates use the format:{' '}
          <code className="bg-qw-dark px-1 rounded">TeamName|player1, player2, player3</code>
        </p>
        {teams.length > 0 && (
          <div className="flex flex-wrap gap-2 text-xs">
            {teams.slice(0, 4).map((t) => (
              <span key={t.id} className="px-2 py-1 bg-qw-dark rounded">
                {t.name}: {t.players || <span className="text-qw-muted italic">no players</span>}
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
            className="bg-qw-panel border border-qw-border rounded-lg w-full max-w-md p-6 space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="font-display text-sm text-qw-accent">PUBLISH TO WIKI</h3>

            <div className="space-y-3">
              <div>
                <label className="block text-xs text-qw-muted mb-1">Page Title *</label>
                <input
                  type="text"
                  value={publishFields.pageTitle}
                  onChange={(e) => setPublishFields((f) => ({ ...f, pageTitle: e.target.value }))}
                  placeholder="QW_Champions_League/Season_5/Division_1"
                  className="w-full bg-qw-dark border border-qw-border rounded px-3 py-2 text-sm text-qw-text placeholder-zinc-600 focus:outline-none focus:border-qw-accent"
                />
              </div>

              <div>
                <label className="block text-xs text-qw-muted mb-1">Section (optional)</label>
                <input
                  type="text"
                  value={publishFields.section}
                  onChange={(e) => setPublishFields((f) => ({ ...f, section: e.target.value }))}
                  placeholder="Leave empty to edit entire page"
                  className="w-full bg-qw-dark border border-qw-border rounded px-3 py-2 text-sm text-qw-text placeholder-zinc-600 focus:outline-none focus:border-qw-accent"
                />
              </div>

              <div>
                <label className="block text-xs text-qw-muted mb-1">Edit Summary</label>
                <input
                  type="text"
                  value={publishFields.summary}
                  onChange={(e) => setPublishFields((f) => ({ ...f, summary: e.target.value }))}
                  className="w-full bg-qw-dark border border-qw-border rounded px-3 py-2 text-sm text-qw-text placeholder-zinc-600 focus:outline-none focus:border-qw-accent"
                />
              </div>

              <div className="text-xs text-zinc-500">
                Content: {activeExport} export ({wikiContent.length.toLocaleString()} chars)
              </div>
            </div>

            {publishState.status !== 'idle' && (
              <div
                className={`text-xs px-3 py-2 rounded ${
                  publishState.status === 'publishing'
                    ? 'bg-blue-900/30 text-blue-300'
                    : publishState.status === 'success'
                      ? 'bg-qw-win/10 text-qw-win'
                      : 'bg-qw-loss/10 text-qw-loss'
                }`}
              >
                {publishState.message}
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setShowPublishModal(false)}
                className="px-4 py-2 rounded text-xs bg-zinc-800 text-zinc-400 hover:text-zinc-200 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handlePublishToWiki}
                disabled={publishState.status === 'publishing'}
                className={`px-4 py-2 rounded text-xs font-semibold transition-colors ${
                  publishState.status === 'publishing'
                    ? 'bg-blue-800 text-blue-300 cursor-wait'
                    : 'bg-blue-600 text-white hover:bg-blue-500'
                }`}
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
