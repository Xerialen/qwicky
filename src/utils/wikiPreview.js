// src/utils/wikiPreview.js
// Lightweight parsers to render QWICKY's wiki markup as styled HTML preview.
// These only handle the specific templates QWICKY generates — not a general MediaWiki parser.

import React from 'react';

// Parse GroupTableStart/GroupTableSlot templates into structured data
function parseGroupTables(markup) {
  const tables = [];
  // Split on GroupTableStart to find each table
  const tableBlocks = markup.split('{{GroupTableStart|');

  for (let i = 1; i < tableBlocks.length; i++) {
    const block = tableBlocks[i];
    const endIdx = block.indexOf('{{GroupTableEnd}}');
    const content = endIdx >= 0 ? block.substring(0, endIdx) : block;

    // Extract title from first parameter
    const titleEnd = content.indexOf('|');
    const title = titleEnd >= 0 ? content.substring(0, titleEnd).trim() : '';

    // Extract info parameter
    const infoMatch = content.match(/\|info=([^}]*)/);
    const info = infoMatch ? infoMatch[1].trim() : '';

    // Parse GroupTableSlot entries
    const slots = [];
    const slotRegex = /\{\{GroupTableSlot\|([^}]*(?:\{\{[^}]*\}\}[^}]*)*)\}\}/g;
    let slotMatch;
    while ((slotMatch = slotRegex.exec(content)) !== null) {
      const slotContent = slotMatch[1];

      // Extract team name from TeamAbbr template
      const teamAbbrMatch = slotContent.match(/\{\{TeamAbbr\|[^|]*\|([^|]*)\|/);
      const teamName = teamAbbrMatch ? teamAbbrMatch[1].trim() : '';

      // Extract flag
      const flagMatch = slotContent.match(/flag=(\w+)/);
      const flag = flagMatch ? flagMatch[1] : '';

      // Extract stats
      const placeMatch = slotContent.match(/place=(\d+)/);
      const winMMatch = slotContent.match(/win_m=(\d+)/);
      const loseMMatch = slotContent.match(/lose_m=(\d+)/);
      const winGMatch = slotContent.match(/win_g=(\d+)/);
      const loseGMatch = slotContent.match(/lose_g=(\d+)/);
      const diffMatch = slotContent.match(/diff=([+-]?\d+)/);
      const bgMatch = slotContent.match(/bg=(\w+)/);

      slots.push({
        teamName,
        flag,
        place: placeMatch ? parseInt(placeMatch[1]) : 0,
        winM: winMMatch ? parseInt(winMMatch[1]) : 0,
        loseM: loseMMatch ? parseInt(loseMMatch[1]) : 0,
        winG: winGMatch ? parseInt(winGMatch[1]) : 0,
        loseG: loseGMatch ? parseInt(loseGMatch[1]) : 0,
        diff: diffMatch ? diffMatch[1] : '0',
        bg: bgMatch ? bgMatch[1] : 'stay',
      });
    }

    tables.push({ title, info, slots });
  }
  return tables;
}

// Parse MatchList/MatchMaps templates
function parseMatchList(markup) {
  const matches = [];
  const matchRegex = /\|match\d+=\{\{MatchMaps\n([\s\S]*?)\}\}\s*\n\}/g;
  // Simpler approach: split on |match{N}={{MatchMaps
  const matchBlocks = markup.split(/\|match\d+=\{\{MatchMaps\n/);

  for (let i = 1; i < matchBlocks.length; i++) {
    const block = matchBlocks[i];
    const endIdx = block.indexOf('}}\n}}');
    const content = endIdx >= 0 ? block.substring(0, endIdx) : block;

    const p1Match = content.match(/\|player1=\{\{Abbr\|([^|]*)\|/);
    const p1FlagMatch = content.match(/\|player1flag=(\w+)/);
    const p2Match = content.match(/\|player2=\{\{Abbr\|([^|]*)\|/);
    const p2FlagMatch = content.match(/\|player2flag=(\w+)/);
    const winnerMatch = content.match(/\|winner=(\d*)/);
    const games1Match = content.match(/\|games1=(\d+)/);
    const games2Match = content.match(/\|games2=(\d+)/);

    // Parse individual maps from BracketMatchSummary
    const maps = [];
    const mapRegex = /\|map(\d+)=(\w*)\s*\|map\d+win=(\d*)\s*\|map\d+p1frags=(\w*)\s*\|map\d+p2frags=(\w*)/g;
    let mapMatch;
    while ((mapMatch = mapRegex.exec(content)) !== null) {
      maps.push({
        num: parseInt(mapMatch[1]),
        map: mapMatch[2],
        winner: mapMatch[3],
        p1frags: mapMatch[4],
        p2frags: mapMatch[5],
      });
    }

    matches.push({
      team1: p1Match ? p1Match[1].trim() : '',
      team1Flag: p1FlagMatch ? p1FlagMatch[1] : '',
      team2: p2Match ? p2Match[1].trim() : '',
      team2Flag: p2FlagMatch ? p2FlagMatch[1] : '',
      winner: winnerMatch ? winnerMatch[1] : '',
      score1: games1Match ? parseInt(games1Match[1]) : 0,
      score2: games2Match ? parseInt(games2Match[1]) : 0,
      maps,
    });
  }
  return matches;
}

// Parse bracket templates (4SE, 8SE, 16SE, 32SE)
function parseBracket(markup) {
  const bracketMatch = markup.match(/\{\{(\d+SE)Bracket/);
  if (!bracketMatch) return null;

  const bracketType = bracketMatch[1];
  const rounds = {};

  // Parse all round entries: R{round}D{slot} or R{round}W{slot}
  const entryRegex = /\|R(\d+)([DW])(\d+)=([^|]*)\s*\|R\d+[DW]\d+race=[^|]*\|R\d+[DW]\d+flag=(\w*)\s*\|R\d+[DW]\d+score=(\d*)\s*\|R\d+[DW]\d+win=(\d*)/g;
  let entry;
  while ((entry = entryRegex.exec(markup)) !== null) {
    const round = parseInt(entry[1]);
    const type = entry[2]; // D=initial, W=winner's side
    const slot = parseInt(entry[3]);
    const name = entry[4].trim();
    const flag = entry[5];
    const score = entry[6];
    const win = entry[7];

    if (!rounds[round]) rounds[round] = [];
    rounds[round].push({ slot, type, name, flag, score, win: win === '1' });
  }

  return { bracketType, rounds };
}

// Parse generic wikitable (for stats)
function parseWikiTable(markup) {
  const lines = markup.split('\n');
  const tables = [];
  let currentTable = null;

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith('{|')) {
      currentTable = { headers: [], rows: [] };
    } else if (trimmed === '|}') {
      if (currentTable) tables.push(currentTable);
      currentTable = null;
    } else if (currentTable) {
      if (trimmed.startsWith('!')) {
        // Header row
        const headers = trimmed.replace(/^!/, '').split('!!').map(h => h.trim());
        currentTable.headers = headers;
      } else if (trimmed.startsWith('|-')) {
        // Row separator — start a new row
        currentTable.rows.push([]);
      } else if (trimmed.startsWith('|') && !trimmed.startsWith('|-') && !trimmed.startsWith('|}')) {
        const cells = trimmed.replace(/^\|/, '').split('||').map(c => c.trim());
        if (currentTable.rows.length === 0) currentTable.rows.push([]);
        const lastRow = currentTable.rows[currentTable.rows.length - 1];
        lastRow.push(...cells);
      }
    }
  }

  return tables;
}

// Map 2-letter country code to flag emoji
const countryToFlag = (code) => {
  if (!code || code.length !== 2) return '';
  return String.fromCodePoint(
    ...code.toUpperCase().split('').map(c => 0x1F1E6 + c.charCodeAt(0) - 65)
  );
};

// Background color mapping for standings rows
const bgColorMap = {
  up: 'bg-emerald-900/40 border-l-2 border-emerald-500',
  stayup: 'bg-teal-900/25 border-l-2 border-teal-600',
  stay: 'bg-amber-900/20 border-l-2 border-amber-700',
  staydown: 'bg-orange-900/20 border-l-2 border-orange-700',
  down: 'bg-red-900/25 border-l-2 border-red-700',
};

// Render the parsed data as React elements
export function renderStandingsPreview(markup) {
  const tables = parseGroupTables(markup);
  if (tables.length === 0) return React.createElement('p', { className: 'text-qw-muted text-sm italic' }, 'No standings data to preview.');

  return React.createElement('div', { className: 'space-y-6' },
    tables.map((table, ti) =>
      React.createElement('div', { key: ti, className: 'border border-qw-border rounded overflow-hidden' },
        // Table header
        React.createElement('div', { className: 'bg-qw-dark px-4 py-2 border-b border-qw-border' },
          React.createElement('h4', { className: 'font-display font-bold text-qw-accent text-sm' }, table.title),
          table.info && React.createElement('p', { className: 'text-xs text-qw-muted mt-0.5' }, table.info)
        ),
        // Table content
        React.createElement('table', { className: 'w-full text-sm' },
          React.createElement('thead', null,
            React.createElement('tr', { className: 'bg-qw-dark/50 text-xs text-qw-muted' },
              React.createElement('th', { className: 'text-center w-8 py-1.5' }, '#'),
              React.createElement('th', { className: 'text-left py-1.5' }, 'Team'),
              React.createElement('th', { className: 'text-center w-10 py-1.5' }, 'W'),
              React.createElement('th', { className: 'text-center w-10 py-1.5' }, 'L'),
              React.createElement('th', { className: 'text-center w-12 py-1.5' }, 'Maps'),
              React.createElement('th', { className: 'text-center w-10 py-1.5' }, 'M\u00B1')
            )
          ),
          React.createElement('tbody', null,
            table.slots.map((slot, si) =>
              React.createElement('tr', {
                key: si,
                className: `border-t border-qw-border/30 ${bgColorMap[slot.bg] || ''}`
              },
                React.createElement('td', { className: 'text-center py-1.5 text-qw-muted' }, slot.place),
                React.createElement('td', { className: 'py-1.5 flex items-center gap-1.5' },
                  React.createElement('span', { className: 'text-sm' }, countryToFlag(slot.flag)),
                  React.createElement('span', { className: slot.place === 1 ? 'text-qw-accent font-semibold' : 'text-white' }, slot.teamName)
                ),
                React.createElement('td', { className: 'text-center text-qw-win' }, slot.winM),
                React.createElement('td', { className: 'text-center text-qw-loss' }, slot.loseM),
                React.createElement('td', { className: 'text-center font-mono text-xs' },
                  React.createElement('span', { className: 'text-qw-win' }, slot.winG),
                  '-',
                  React.createElement('span', { className: 'text-qw-loss' }, slot.loseG)
                ),
                React.createElement('td', {
                  className: `text-center font-mono text-xs font-semibold ${
                    slot.diff.startsWith('+') ? 'text-qw-win' :
                    slot.diff.startsWith('-') ? 'text-qw-loss' : 'text-qw-muted'
                  }`
                }, slot.diff)
              )
            )
          )
        )
      )
    )
  );
}

export function renderMatchesPreview(markup) {
  const matches = parseMatchList(markup);
  if (matches.length === 0) return React.createElement('p', { className: 'text-qw-muted text-sm italic' }, 'No match data to preview.');

  return React.createElement('div', { className: 'space-y-2' },
    matches.map((m, i) =>
      React.createElement('div', {
        key: i,
        className: 'flex items-center gap-3 p-3 bg-qw-dark rounded border border-qw-border/50'
      },
        // Team 1
        React.createElement('div', { className: `flex items-center gap-1.5 flex-1 justify-end ${m.winner === '1' ? 'text-qw-accent font-semibold' : 'text-white'}` },
          React.createElement('span', null, m.team1),
          React.createElement('span', { className: 'text-sm' }, countryToFlag(m.team1Flag))
        ),
        // Score
        React.createElement('div', { className: 'flex items-center gap-1 font-mono text-sm font-bold min-w-[3rem] justify-center' },
          React.createElement('span', { className: m.winner === '1' ? 'text-qw-win' : 'text-white' }, m.score1),
          React.createElement('span', { className: 'text-qw-muted' }, ':'),
          React.createElement('span', { className: m.winner === '2' ? 'text-qw-win' : 'text-white' }, m.score2)
        ),
        // Team 2
        React.createElement('div', { className: `flex items-center gap-1.5 flex-1 ${m.winner === '2' ? 'text-qw-accent font-semibold' : 'text-white'}` },
          React.createElement('span', { className: 'text-sm' }, countryToFlag(m.team2Flag)),
          React.createElement('span', null, m.team2)
        ),
        // Maps detail
        m.maps.length > 0 && React.createElement('div', { className: 'flex gap-1 ml-2' },
          m.maps.map((mp, mi) =>
            React.createElement('span', {
              key: mi,
              className: 'text-[10px] text-qw-muted px-1 py-0.5 bg-qw-panel rounded',
              title: `${mp.p1frags}-${mp.p2frags}`
            }, mp.map || '?')
          )
        )
      )
    )
  );
}

export function renderBracketPreview(markup) {
  const bracketData = parseBracket(markup);
  if (!bracketData) {
    // Check for section headers and text-based brackets (double elim, multi-tier text)
    if (markup.includes('===') || markup.includes('Winners Bracket') || markup.includes('TBD')) {
      return renderTextBracketPreview(markup);
    }
    return React.createElement('p', { className: 'text-qw-muted text-sm italic' }, 'No bracket data to preview.');
  }

  const { bracketType, rounds } = bracketData;
  const roundNames = {
    '4SE': { 1: 'Semi-Finals', 2: 'Final / 3rd Place' },
    '8SE': { 1: 'Quarter-Finals', 2: 'Semi-Finals', 3: 'Final / 3rd Place' },
    '16SE': { 1: 'Round of 16', 2: 'Quarter-Finals', 3: 'Semi-Finals', 4: 'Final / 3rd Place' },
    '32SE': { 1: 'Round of 32', 2: 'Round of 16', 3: 'Quarter-Finals', 4: 'Semi-Finals', 5: 'Final / 3rd Place' },
  };
  const names = roundNames[bracketType] || {};

  const sortedRounds = Object.keys(rounds).map(Number).sort((a, b) => a - b);

  return React.createElement('div', { className: 'space-y-4' },
    React.createElement('div', { className: 'text-xs text-qw-muted mb-2' }, `${bracketType} Bracket`),
    sortedRounds.map(roundNum => {
      const entries = rounds[roundNum].sort((a, b) => a.slot - b.slot);
      // Group entries into pairs (matches)
      const pairs = [];
      for (let i = 0; i < entries.length; i += 2) {
        pairs.push([entries[i], entries[i + 1]].filter(Boolean));
      }

      return React.createElement('div', { key: roundNum, className: 'mb-4' },
        React.createElement('h4', { className: 'font-display text-xs text-qw-accent uppercase mb-2' },
          names[roundNum] || `Round ${roundNum}`
        ),
        React.createElement('div', { className: 'space-y-2' },
          pairs.map((pair, pi) =>
            React.createElement('div', {
              key: pi,
              className: 'inline-flex flex-col bg-qw-dark rounded border border-qw-border/50 overflow-hidden mr-3 mb-2'
            },
              pair.map((entry, ei) =>
                React.createElement('div', {
                  key: ei,
                  className: `flex items-center gap-2 px-3 py-1.5 text-sm ${
                    ei === 0 ? '' : 'border-t border-qw-border/30'
                  } ${entry.win ? 'bg-qw-win/10' : ''}`
                },
                  React.createElement('span', { className: 'text-sm w-5' }, countryToFlag(entry.flag)),
                  React.createElement('span', {
                    className: `min-w-[8rem] ${entry.win ? 'text-qw-accent font-semibold' : entry.name === 'TBD' ? 'text-qw-muted italic' : 'text-white'}`
                  }, entry.name || 'TBD'),
                  React.createElement('span', {
                    className: `font-mono text-xs ml-2 ${entry.win ? 'text-qw-win font-bold' : 'text-qw-muted'}`
                  }, entry.score)
                )
              )
            )
          )
        )
      );
    })
  );
}

function renderTextBracketPreview(markup) {
  // For text-based brackets (double elim, multi-tier), render the markup as styled text
  const lines = markup.split('\n').filter(l => l.trim());
  return React.createElement('div', { className: 'space-y-1' },
    lines.map((line, i) => {
      const trimmed = line.trim();
      if (trimmed.startsWith('== ') || trimmed.startsWith('=== ')) {
        const text = trimmed.replace(/^=+\s*/, '').replace(/\s*=+$/, '');
        const isH2 = trimmed.startsWith('== ') && !trimmed.startsWith('=== ');
        return React.createElement(isH2 ? 'h3' : 'h4', {
          key: i,
          className: `font-display ${isH2 ? 'text-qw-accent text-base mt-4' : 'text-white text-sm mt-3'}`
        }, text);
      }
      if (trimmed.startsWith("'''") && trimmed.endsWith("'''")) {
        return React.createElement('div', { key: i, className: 'font-semibold text-white text-sm mt-2' },
          trimmed.replace(/'''/g, '')
        );
      }
      if (trimmed.startsWith('* ') || trimmed.startsWith('** ')) {
        const indent = trimmed.startsWith('** ') ? 'ml-4' : '';
        const text = trimmed.replace(/^\*+\s*/, '');
        return React.createElement('div', { key: i, className: `text-sm text-qw-muted ${indent}` },
          '\u2022 ', text
        );
      }
      if (trimmed) {
        return React.createElement('div', { key: i, className: 'text-sm text-qw-muted' }, trimmed);
      }
      return null;
    })
  );
}

export function renderStatsPreview(markup) {
  const tables = parseWikiTable(markup);
  if (tables.length === 0) return React.createElement('p', { className: 'text-qw-muted text-sm italic' }, 'No stats data to preview.');

  return React.createElement('div', { className: 'space-y-4' },
    tables.map((table, ti) =>
      React.createElement('div', { key: ti, className: 'border border-qw-border rounded overflow-hidden overflow-x-auto' },
        React.createElement('table', { className: 'w-full text-sm' },
          table.headers.length > 0 && React.createElement('thead', null,
            React.createElement('tr', { className: 'bg-qw-dark text-xs text-qw-muted' },
              table.headers.map((h, hi) =>
                React.createElement('th', { key: hi, className: 'px-2 py-1.5 text-left whitespace-nowrap' }, h)
              )
            )
          ),
          React.createElement('tbody', null,
            table.rows.filter(r => r.length > 0).map((row, ri) =>
              React.createElement('tr', { key: ri, className: 'border-t border-qw-border/30' },
                row.map((cell, ci) =>
                  React.createElement('td', { key: ci, className: 'px-2 py-1 text-white whitespace-nowrap' }, cell)
                )
              )
            )
          )
        )
      )
    )
  );
}

// Main entry point: render preview for any export type
export function renderWikiPreview(wikiContent, activeExport) {
  if (!wikiContent) {
    return React.createElement('p', { className: 'text-qw-muted text-sm italic' }, 'No content to preview.');
  }

  switch (activeExport) {
    case 'standings':
      return renderStandingsPreview(wikiContent);
    case 'matches':
      return renderMatchesPreview(wikiContent);
    case 'bracket':
      return renderBracketPreview(wikiContent);
    case 'stats':
      return renderStatsPreview(wikiContent);
    case 'full': {
      // Full page: try to render each section
      const parts = [];
      // Split into sections based on templates
      if (wikiContent.includes('{{GroupTableStart')) {
        parts.push(React.createElement('div', { key: 'standings' },
          React.createElement('h3', { className: 'font-display text-qw-accent text-sm mb-3 uppercase' }, 'Standings'),
          renderStandingsPreview(wikiContent)
        ));
      }
      if (wikiContent.includes('{{MatchList')) {
        parts.push(React.createElement('div', { key: 'matches', className: 'mt-6' },
          React.createElement('h3', { className: 'font-display text-qw-accent text-sm mb-3 uppercase' }, 'Match Results'),
          renderMatchesPreview(wikiContent)
        ));
      }
      if (wikiContent.includes('SEBracket') || wikiContent.includes('=== ') || wikiContent.includes('Winners Bracket')) {
        // Extract bracket portion (after MatchList ends or from bracket template)
        parts.push(React.createElement('div', { key: 'bracket', className: 'mt-6' },
          React.createElement('h3', { className: 'font-display text-qw-accent text-sm mb-3 uppercase' }, 'Playoffs'),
          renderBracketPreview(wikiContent)
        ));
      }
      if (parts.length === 0) {
        return React.createElement('p', { className: 'text-qw-muted text-sm italic' }, 'No previewable content found.');
      }
      return React.createElement('div', { className: 'space-y-2' }, parts);
    }
    default:
      return React.createElement('p', { className: 'text-qw-muted text-sm italic' }, 'Preview not available for this export type.');
  }
}
