// src/components/WikiExport.jsx
import React, { useState, useMemo } from 'react';
import { calculateStandings } from '../utils/matchLogic';
import { getSeriesSummary } from '../utils/matchLogic';
import {
  generateStandingsWiki,
  generateScheduleWiki,
  generateBracketWiki,
  generateSimpleBracketWiki,
  generateFullTournamentWiki
} from '../utils/wikiExport';

export default function WikiExport({ matches, bracketConfig }) {
  const [activeExport, setActiveExport] = useState('standings');
  const [copied, setCopied] = useState(false);
  const [options, setOptions] = useState({
    tournamentName: 'Tournament',
    useSimpleBracket: true,
    groupByDate: true,
    showHeaders: true
  });

  const standings = useMemo(() => calculateStandings(matches), [matches]);
  const seriesSummary = useMemo(() => getSeriesSummary(matches), [matches]);

  const wikiContent = useMemo(() => {
    switch (activeExport) {
      case 'standings':
        return generateStandingsWiki(standings, { 
          title: `${options.tournamentName} - Standings`,
          showHeader: options.showHeaders 
        });
      case 'schedule':
        return generateScheduleWiki(matches, { 
          title: `${options.tournamentName} - Schedule`,
          showHeader: options.showHeaders,
          groupByDate: options.groupByDate 
        });
      case 'bracket':
        if (options.useSimpleBracket) {
          let wiki = options.showHeaders ? `=== ${options.tournamentName} - Playoffs ===\n\n` : '';
          wiki += generateSimpleBracketWiki(bracketConfig, seriesSummary);
          return wiki;
        }
        return generateBracketWiki(bracketConfig, seriesSummary, { 
          title: `${options.tournamentName} - Playoffs`,
          showHeader: options.showHeaders 
        });
      case 'full':
        return generateFullTournamentWiki(standings, matches, bracketConfig, seriesSummary, options);
      default:
        return '';
    }
  }, [activeExport, standings, matches, bracketConfig, seriesSummary, options]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(wikiContent);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  const handleDownload = () => {
    const blob = new Blob([wikiContent], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${options.tournamentName.replace(/\s+/g, '_')}_${activeExport}.wiki.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const exportTypes = [
    { id: 'standings', label: 'Standings', icon: '🏆' },
    { id: 'schedule', label: 'Schedule', icon: '📋' },
    { id: 'bracket', label: 'Bracket', icon: '🎯' },
    { id: 'full', label: 'Full Page', icon: '📄' },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="font-display font-bold text-2xl text-white flex items-center gap-3">
          <span className="text-qw-accent">📝</span>
          Wiki Export
        </h2>
      </div>

      {/* Export Type Selection */}
      <div className="flex gap-2 flex-wrap">
        {exportTypes.map(type => (
          <button
            key={type.id}
            onClick={() => setActiveExport(type.id)}
            className={`px-4 py-2 rounded font-body font-semibold transition-all flex items-center gap-2
              ${activeExport === type.id
                ? 'bg-qw-accent text-qw-dark'
                : 'bg-qw-panel border border-qw-border text-qw-muted hover:text-white hover:border-qw-accent'
              }`}
          >
            <span>{type.icon}</span>
            {type.label}
          </button>
        ))}
      </div>

      {/* Options Panel */}
      <div className="qw-panel p-4">
        <h3 className="font-display text-sm text-qw-accent mb-3">EXPORT OPTIONS</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-qw-muted text-sm mb-1">Tournament Name</label>
            <input
              type="text"
              value={options.tournamentName}
              onChange={(e) => setOptions({ ...options, tournamentName: e.target.value })}
              className="w-full bg-qw-dark border border-qw-border rounded px-3 py-2 text-white font-mono text-sm"
            />
          </div>
          
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="showHeaders"
              checked={options.showHeaders}
              onChange={(e) => setOptions({ ...options, showHeaders: e.target.checked })}
              className="w-4 h-4 accent-qw-accent"
            />
            <label htmlFor="showHeaders" className="text-qw-muted text-sm">Include Headers</label>
          </div>

          {activeExport === 'schedule' && (
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="groupByDate"
                checked={options.groupByDate}
                onChange={(e) => setOptions({ ...options, groupByDate: e.target.checked })}
                className="w-4 h-4 accent-qw-accent"
              />
              <label htmlFor="groupByDate" className="text-qw-muted text-sm">Group by Date</label>
            </div>
          )}

          {(activeExport === 'bracket' || activeExport === 'full') && (
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="useSimpleBracket"
                checked={options.useSimpleBracket}
                onChange={(e) => setOptions({ ...options, useSimpleBracket: e.target.checked })}
                className="w-4 h-4 accent-qw-accent"
              />
              <label htmlFor="useSimpleBracket" className="text-qw-muted text-sm">Simple Table Bracket</label>
            </div>
          )}
        </div>
      </div>

      {/* Preview */}
      <div className="qw-panel overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 bg-qw-dark border-b border-qw-border">
          <h3 className="font-display text-sm text-qw-accent">WIKI MARKUP PREVIEW</h3>
          <div className="flex gap-2">
            <button
              onClick={handleCopy}
              className={`px-3 py-1 rounded text-sm font-body font-semibold transition-all flex items-center gap-2
                ${copied 
                  ? 'bg-qw-win text-white' 
                  : 'bg-qw-panel border border-qw-border text-qw-muted hover:text-white hover:border-qw-accent'
                }`}
            >
              {copied ? (
                <>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  Copied!
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
                  </svg>
                  Copy
                </>
              )}
            </button>
            <button
              onClick={handleDownload}
              className="px-3 py-1 rounded text-sm font-body font-semibold bg-qw-accent text-qw-dark hover:bg-qw-accent-dim transition-all flex items-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              Download
            </button>
          </div>
        </div>
        
        <div className="p-4 max-h-96 overflow-auto">
          <pre className="font-mono text-sm text-qw-text whitespace-pre-wrap break-words">
            {wikiContent || '<!-- No content to export -->'}
          </pre>
        </div>
      </div>

      {/* Tips */}
      <div className="qw-panel p-4">
        <h3 className="font-display text-sm text-qw-accent mb-2">WIKI EXPORT TIPS</h3>
        <ul className="text-qw-muted text-sm space-y-1">
          <li>• <strong>Standings:</strong> Uses standard ... ... ... wikitable format with <code>{'{{Abbr}}'}</code> for column headers</li>
          <li>• <strong>Schedule:</strong> Groups matches by date with team templates</li>
          <li>• <strong>Bracket:</strong> Simple table format works on most wikis; Liquipedia template requires the Bracket extension</li>
          <li>• <strong>Team templates:</strong> Uses <code>{'{{Team|name}}'}</code> format - adjust if your wiki uses different templates</li>
        </ul>
      </div>
    </div>
  );
}
