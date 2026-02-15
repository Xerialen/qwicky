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
    const slotRegex = /\{\{GroupTableSlot\|((?:[^{}]|\{\{[^{}]*\}\})*)\}\}/g;
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

// Parse a single MediaWiki cell, separating optional attributes from content.
// e.g. 'style="border-left: 3px solid #f00" | PlayerName' → { content: 'PlayerName', style: { borderLeft: '3px solid #f00' } }
function parseWikiCell(raw) {
  const trimmed = raw.trim();
  // Check for attribute | content pattern (single pipe with attributes before it)
  const attrMatch = trimmed.match(/^((?:style|class|colspan|rowspan)\s*=\s*"[^"]*"(?:\s+(?:style|class|colspan|rowspan)\s*=\s*"[^"]*")*)\s*\|\s*(.*)/s);
  if (attrMatch) {
    const attrs = attrMatch[1];
    const content = attrMatch[2].trim();
    // Extract inline style if present
    const styleMatch = attrs.match(/style\s*=\s*"([^"]*)"/);
    let style = null;
    if (styleMatch) {
      style = {};
      styleMatch[1].split(';').forEach(decl => {
        const [prop, val] = decl.split(':').map(s => s.trim());
        if (prop && val) {
          // Convert CSS property to camelCase for React
          const camelProp = prop.replace(/-([a-z])/g, (_, c) => c.toUpperCase());
          style[camelProp] = val;
        }
      });
    }
    return { content, style };
  }
  return { content: trimmed, style: null };
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
        const rawCells = trimmed.replace(/^\|/, '').split('||');
        const cells = rawCells.map(c => parseWikiCell(c));
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

// Background color mapping for standings rows (Liquipedia-style)
const bgColorMap = {
  up: 'wiki-row-up',
  stayup: 'wiki-row-stayup',
  stay: 'wiki-row-stay',
  staydown: 'wiki-row-staydown',
  down: 'wiki-row-down',
};

// Render the parsed data as React elements (Liquipedia-style)
export function renderStandingsPreview(markup) {
  const tables = parseGroupTables(markup);
  if (tables.length === 0) return React.createElement('p', { className: 'wiki-empty' }, 'No standings data to preview.');

  return React.createElement('div', { style: { display: 'flex', flexDirection: 'column', gap: '20px' } },
    tables.map((table, ti) =>
      React.createElement('table', { key: ti, className: 'wiki-table' },
        // Title row
        React.createElement('thead', null,
          React.createElement('tr', null,
            React.createElement('th', { className: 'wiki-table-title', colSpan: 6 }, table.title)
          ),
          table.info && React.createElement('tr', null,
            React.createElement('th', { className: 'wiki-table-subtitle', colSpan: 6 }, table.info)
          ),
          // Column headers
          React.createElement('tr', null,
            React.createElement('th', { style: { textAlign: 'center', width: '30px' } }, '#'),
            React.createElement('th', { style: { textAlign: 'left' } }, 'Team'),
            React.createElement('th', { style: { textAlign: 'center', width: '40px' } }, 'W'),
            React.createElement('th', { style: { textAlign: 'center', width: '40px' } }, 'L'),
            React.createElement('th', { style: { textAlign: 'center', width: '60px' } }, 'Maps'),
            React.createElement('th', { style: { textAlign: 'center', width: '40px' } }, 'M\u00B1')
          )
        ),
        React.createElement('tbody', null,
          table.slots.map((slot, si) =>
            React.createElement('tr', {
              key: si,
              className: bgColorMap[slot.bg] || ''
            },
              React.createElement('td', { className: 'wiki-place-col' }, slot.place),
              React.createElement('td', { className: slot.place === 1 ? 'wiki-team-col wiki-team-first' : 'wiki-team-col' },
                React.createElement('span', { style: { marginRight: '6px' } }, countryToFlag(slot.flag)),
                slot.teamName
              ),
              React.createElement('td', { className: 'wiki-stat-win' }, slot.winM),
              React.createElement('td', { className: 'wiki-stat-loss' }, slot.loseM),
              React.createElement('td', { className: 'wiki-stat-center', style: { fontFamily: 'monospace', fontSize: '12px' } },
                slot.winG, '-', slot.loseG
              ),
              React.createElement('td', {
                className: slot.diff.startsWith('+') ? 'wiki-stat-diff-pos' :
                  slot.diff.startsWith('-') ? 'wiki-stat-diff-neg' : 'wiki-stat-diff-zero',
                style: { fontFamily: 'monospace', fontSize: '12px' }
              }, slot.diff)
            )
          )
        )
      )
    )
  );
}

export function renderMatchesPreview(markup) {
  const matches = parseMatchList(markup);
  if (matches.length === 0) return React.createElement('p', { className: 'wiki-empty' }, 'No match data to preview.');

  return React.createElement('div', { style: { display: 'flex', flexDirection: 'column', gap: '6px' } },
    matches.map((m, i) =>
      React.createElement('div', { key: i, className: 'wiki-match-card' },
        // Team 1
        React.createElement('div', {
          className: `wiki-match-team wiki-match-team-right ${m.winner === '1' ? 'wiki-match-winner' : ''}`
        },
          React.createElement('span', null, m.team1),
          React.createElement('span', null, countryToFlag(m.team1Flag))
        ),
        // Score
        React.createElement('div', { className: 'wiki-match-score' },
          React.createElement('span', { className: m.winner === '1' ? 'wiki-match-score-win' : 'wiki-match-score-lose' }, m.score1),
          React.createElement('span', { style: { color: '#72777d' } }, ':'),
          React.createElement('span', { className: m.winner === '2' ? 'wiki-match-score-win' : 'wiki-match-score-lose' }, m.score2)
        ),
        // Team 2
        React.createElement('div', {
          className: `wiki-match-team ${m.winner === '2' ? 'wiki-match-winner' : ''}`
        },
          React.createElement('span', null, countryToFlag(m.team2Flag)),
          React.createElement('span', null, m.team2)
        ),
        // Maps detail
        m.maps.length > 0 && React.createElement('div', { className: 'wiki-match-maps' },
          m.maps.map((mp, mi) =>
            React.createElement('span', {
              key: mi,
              className: 'wiki-match-map',
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
    return React.createElement('p', { className: 'wiki-empty' }, 'No bracket data to preview.');
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

  return React.createElement('div', null,
    React.createElement('div', { style: { fontSize: '12px', color: '#54595d', marginBottom: '8px' } }, `${bracketType} Bracket`),
    sortedRounds.map(roundNum => {
      const entries = rounds[roundNum].sort((a, b) => a.slot - b.slot);
      // Group entries into pairs (matches)
      const pairs = [];
      for (let i = 0; i < entries.length; i += 2) {
        pairs.push([entries[i], entries[i + 1]].filter(Boolean));
      }

      return React.createElement('div', { key: roundNum },
        React.createElement('div', { className: 'wiki-bracket-round-title' },
          names[roundNum] || `Round ${roundNum}`
        ),
        React.createElement('div', null,
          pairs.map((pair, pi) =>
            React.createElement('div', { key: pi, className: 'wiki-bracket-matchup' },
              pair.map((entry, ei) =>
                React.createElement('div', {
                  key: ei,
                  className: `wiki-bracket-entry ${
                    entry.win ? 'wiki-bracket-entry-winner' :
                    entry.name === 'TBD' || !entry.name ? 'wiki-bracket-entry-tbd' : ''
                  }`
                },
                  React.createElement('span', { style: { width: '20px', fontSize: '14px' } }, countryToFlag(entry.flag)),
                  React.createElement('span', { className: 'wiki-bracket-entry-name' }, entry.name || 'TBD'),
                  React.createElement('span', {
                    className: `wiki-bracket-entry-score ${entry.win ? 'wiki-bracket-entry-score-win' : 'wiki-bracket-entry-score-lose'}`
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
  return React.createElement('div', null,
    lines.map((line, i) => {
      const trimmed = line.trim();
      if (trimmed.startsWith('== ') || trimmed.startsWith('=== ')) {
        const text = trimmed.replace(/^=+\s*/, '').replace(/\s*=+$/, '');
        const isH2 = trimmed.startsWith('== ') && !trimmed.startsWith('=== ');
        return React.createElement(isH2 ? 'h2' : 'h3', {
          key: i,
          className: isH2 ? 'wiki-section-h2' : 'wiki-section-h3'
        }, text);
      }
      if (trimmed.startsWith("'''") && trimmed.endsWith("'''")) {
        return React.createElement('div', { key: i, className: 'wiki-text-bold' },
          trimmed.replace(/'''/g, '')
        );
      }
      if (trimmed.startsWith('* ') || trimmed.startsWith('** ')) {
        const indent = trimmed.startsWith('** ') ? { marginLeft: '24px' } : {};
        const text = trimmed.replace(/^\*+\s*/, '');
        return React.createElement('div', { key: i, className: 'wiki-text-bullet', style: indent },
          '\u2022 ', text
        );
      }
      if (trimmed) {
        return React.createElement('div', { key: i, className: 'wiki-text-line' }, trimmed);
      }
      return null;
    })
  );
}

export function renderStatsPreview(markup) {
  const tables = parseWikiTable(markup);
  if (tables.length === 0) return React.createElement('p', { className: 'wiki-empty' }, 'No stats data to preview.');

  return React.createElement('div', { style: { display: 'flex', flexDirection: 'column', gap: '16px' } },
    tables.map((table, ti) =>
      React.createElement('div', { key: ti, style: { overflowX: 'auto' } },
        React.createElement('table', { className: 'wiki-table' },
          table.headers.length > 0 && React.createElement('thead', null,
            React.createElement('tr', null,
              table.headers.map((h, hi) =>
                React.createElement('th', { key: hi, style: { whiteSpace: 'nowrap' } }, h)
              )
            )
          ),
          React.createElement('tbody', null,
            table.rows.filter(r => r.length > 0).map((row, ri) =>
              React.createElement('tr', { key: ri },
                row.map((cell, ci) => {
                  const content = typeof cell === 'object' ? cell.content : cell;
                  const style = typeof cell === 'object' ? cell.style : null;
                  return React.createElement('td', { key: ci, style: { ...style, whiteSpace: 'nowrap' } }, content);
                })
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
    return React.createElement('p', { className: 'wiki-empty' }, 'No content to preview.');
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
          React.createElement('h2', { className: 'wiki-full-section-title' }, 'Standings'),
          renderStandingsPreview(wikiContent)
        ));
      }
      if (wikiContent.includes('{{MatchList')) {
        parts.push(React.createElement('div', { key: 'matches' },
          React.createElement('h2', { className: 'wiki-full-section-title' }, 'Match Results'),
          renderMatchesPreview(wikiContent)
        ));
      }
      if (wikiContent.includes('SEBracket') || wikiContent.includes('=== ') || wikiContent.includes('Winners Bracket')) {
        parts.push(React.createElement('div', { key: 'bracket' },
          React.createElement('h2', { className: 'wiki-full-section-title' }, 'Playoffs'),
          renderBracketPreview(wikiContent)
        ));
      }
      if (parts.length === 0) {
        return React.createElement('p', { className: 'wiki-empty' }, 'No previewable content found.');
      }
      return React.createElement('div', null, parts);
    }
    default:
      return React.createElement('p', { className: 'wiki-empty' }, 'Preview not available for this export type.');
  }
}
