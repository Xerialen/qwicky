// src/components/division/DivisionResults.jsx
import React, { useState, useRef, useMemo, useCallback } from 'react';
import { parseMatch } from '../../utils/matchLogic';

export default function DivisionResults({ division, updateDivision }) {
  const [mode, setMode] = useState('json');
  // API Fetch states
  const [apiInput, setApiInput] = useState('');
  const [apiStatus, setApiStatus] = useState(null);
  
  // JSON states
  const [jsonInput, setJsonInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [lastImported, setLastImported] = useState([]);
  const fileInputRef = useRef(null);

  const teams = division.teams || [];
  const schedule = division.schedule || [];
  const rawMaps = division.rawMaps || [];

  // --- TEAM LOOKUP & SERIES LOGIC (UNCHANGED) ---
  const teamsJson = JSON.stringify(teams.map(t => ({ name: t.name, tag: t.tag })));
  
  const teamLookup = useMemo(() => {
    const byTag = {};
    const byName = {};
    const byNameLower = {};
    
    teams.forEach(team => {
      if (team.tag) {
        byTag[team.tag.toLowerCase()] = team;
        const cleanTag = team.tag.replace(/[\[\]]/g, '').toLowerCase();
        if (cleanTag !== team.tag.toLowerCase()) {
          byTag[cleanTag] = team;
        }
      }
      byName[team.name] = team;
      byNameLower[team.name.toLowerCase()] = team;
    });
    return { byTag, byName, byNameLower };
  }, [teamsJson]);

  const resolveTeamName = useCallback((jsonTeamName) => {
    if (!jsonTeamName) return jsonTeamName;
    const lower = jsonTeamName.toLowerCase().trim();
    if (teamLookup.byName[jsonTeamName]) return teamLookup.byName[jsonTeamName].name;
    if (teamLookup.byNameLower[lower]) return teamLookup.byNameLower[lower].name;
    if (teamLookup.byTag[lower]) return teamLookup.byTag[lower].name;
    return jsonTeamName;
  }, [teamLookup]);

  const SERIES_GAP_MS = 2 * 60 * 60 * 1000;
  
  const detectedSeries = useMemo(() => {
    if (rawMaps.length === 0) return [];
    const matchupGroups = {};
    rawMaps.forEach(map => {
      const resolved1 = resolveTeamName(map.teams[0]);
      const resolved2 = resolveTeamName(map.teams[1]);
      const sortedTeams = [resolved1, resolved2].sort();
      const key = sortedTeams.join('vs');
      if (!matchupGroups[key]) matchupGroups[key] = [];
      matchupGroups[key].push({ ...map, resolvedTeams: sortedTeams });
    });

    const allSeries = [];
    Object.entries(matchupGroups).forEach(([matchupId, maps]) => {
      const sortedMaps = [...maps].sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));
      let currentSeries = [];
      let seriesIndex = 0;
      sortedMaps.forEach((map, idx) => {
        if (idx === 0) {
          currentSeries.push(map);
        } else {
          const prevMap = sortedMaps[idx - 1];
          const gap = (map.timestamp || 0) - (prevMap.timestamp || 0);
          if (gap > SERIES_GAP_MS || !map.timestamp || !prevMap.timestamp) {
            if (currentSeries.length > 0) {
              allSeries.push(buildSeries(matchupId, currentSeries, seriesIndex));
              seriesIndex++;
            }
            currentSeries = [map];
          } else {
            currentSeries.push(map);
          }
        }
      });
      if (currentSeries.length > 0) {
        allSeries.push(buildSeries(matchupId, currentSeries, seriesIndex));
      }
    });

    return allSeries.map(series => {
      const [t1, t2] = series.resolvedTeams;
      const t1Lower = t1.toLowerCase();
      const t2Lower = t2.toLowerCase();
      const scheduledMatch = schedule.find(m =>
        (m.team1.toLowerCase() === t1Lower && m.team2.toLowerCase() === t2Lower) ||
        (m.team1.toLowerCase() === t2Lower && m.team2.toLowerCase() === t1Lower)
      );
      return {
        ...series,
        scheduledMatch,
        isLinked: scheduledMatch?.maps?.some(m => series.maps.some(sm => sm.id === m.id))
      };
    });
  }, [rawMaps, schedule, resolveTeamName]);

  function buildSeries(matchupId, maps, index) {
    const resolvedTeams = maps[0].resolvedTeams;
    const originalTeams = maps[0].teams;
    const [t1, t2] = resolvedTeams;
    const mapWins = { [t1]: 0, [t2]: 0 };
    const totalFrags = { [t1]: 0, [t2]: 0 };
    maps.forEach(map => {
      const [orig1, orig2] = map.teams;
      const res1 = resolveTeamName(orig1);
      const res2 = resolveTeamName(orig2);
      const s1 = map.scores[orig1] || 0;
      const s2 = map.scores[orig2] || 0;
      if (totalFrags[res1] !== undefined) totalFrags[res1] += s1;
      if (totalFrags[res2] !== undefined) totalFrags[res2] += s2;
      if (s1 > s2 && mapWins[res1] !== undefined) mapWins[res1]++;
      else if (s2 > s1 && mapWins[res2] !== undefined) mapWins[res2]++;
    });
    const w1 = mapWins[t1] || 0;
    const w2 = mapWins[t2] || 0;
    const f1 = totalFrags[t1] || 0;
    const f2 = totalFrags[t2] || 0;
    const firstDate = maps[0]?.date?.split(' ')[0] || '';
    const lastDate = maps[maps.length - 1]?.date?.split(' ')[0] || '';

    return {
      id: `${matchupId}-${index}`,
      matchupId,
      seriesIndex: index,
      teams: originalTeams,
      resolvedTeams,
      maps,
      mapWins,
      totalFrags,
      score: { [t1]: w1, [t2]: w2 },
      frags: { [t1]: f1, [t2]: f2 },
      winner: w1 > w2 ? t1 : w2 > w1 ? t2 : null,
      dateDisplay: firstDate === lastDate ? firstDate : `${firstDate} - ${lastDate}`
    };
  }

  // --- CORE PARSING & UPDATING LOGIC (UNCHANGED) ---

  const processJsonData = (data, source = 'import') => {
    const parsed = [];
    const matches = Array.isArray(data) ? data : [data];
    matches.forEach((m, idx) => {
      try {
        // Check if it's a valid ktxstats JSON (with team_stats or players)
        // Note: 1on1 matches don't have 'teams' array, but do have 'players'
        if ((m.teams || m.players) && (m.team_stats || m.players)) {
          const gameId = m.demo || `${source}-${Date.now()}-${idx}`;
          parsed.push(parseMatch(gameId, m));
        } else if (m.matchupId && m.scores) {
          // Already processed match format
          parsed.push(m);
        }
      } catch (err) {
        console.error('Failed to process match:', err);
      }
    });
    return parsed;
  };

  const addMapsInBatch = (newMaps) => {
    // Duplicate detection: check by ID
    const existingIds = new Set(rawMaps.map(m => m.id));
    const uniqueNewMaps = newMaps.filter(m => !existingIds.has(m.id));
    
    // Additional duplicate detection: check by map+teams+timestamp (in case IDs differ but it's the same game)
    const existingFingerprints = new Set(
      rawMaps.map(m => `${m.map}|${m.teams.sort().join('vs')}|${m.timestamp || m.date}`)
    );
    const trulyUniqueMaps = uniqueNewMaps.filter(m => {
      const fingerprint = `${m.map}|${m.teams.sort().join('vs')}|${m.timestamp || m.date}`;
      return !existingFingerprints.has(fingerprint);
    });
    
    if (trulyUniqueMaps.length === 0) {
      console.log('No new unique maps to add (all duplicates)');
      return [];
    }
    
    console.log(`Adding ${trulyUniqueMaps.length} unique maps (filtered ${newMaps.length - trulyUniqueMaps.length} duplicates)`);
    
    const allMaps = [...rawMaps, ...trulyUniqueMaps];
    let newSchedule = [...schedule];
    
    trulyUniqueMaps.forEach(mapResult => {
      const [team1, team2] = mapResult.teams;
      const resolved1 = resolveTeamName(team1);
      const resolved2 = resolveTeamName(team2);
      
      const res1Lower = resolved1.toLowerCase();
      const res2Lower = resolved2.toLowerCase();
      const matchIdx = newSchedule.findIndex(m =>
        (m.team1.toLowerCase() === res1Lower && m.team2.toLowerCase() === res2Lower) ||
        (m.team1.toLowerCase() === res2Lower && m.team2.toLowerCase() === res1Lower)
      );

      if (matchIdx !== -1) {
        const match = { ...newSchedule[matchIdx] };
        // Check if this specific map is already in the match
        if (!match.maps?.some(mp => mp.id === mapResult.id)) {
          const isNormalOrder = match.team1.toLowerCase() === res1Lower;
          const score1 = isNormalOrder ? mapResult.scores[team1] : mapResult.scores[team2];
          const score2 = isNormalOrder ? mapResult.scores[team2] : mapResult.scores[team1];

          match.maps = [...(match.maps || []), {
            id: mapResult.id,
            map: mapResult.map,
            date: mapResult.date,
            score1,
            score2
          }];

          // For Play All (Go) group matches, completed = all maps played. For Best Of, completed = first to majority wins.
          const isGroupPlayAll = match.round === 'group' && division.groupStageType === 'playall';
          if (isGroupPlayAll) {
            match.status = match.maps.length >= match.bestOf ? 'completed' : 'live';
          } else {
            const neededWins = Math.ceil(match.bestOf / 2);
            let t1Wins = 0, t2Wins = 0;
            match.maps.forEach(mp => {
              if (mp.score1 > mp.score2) t1Wins++;
              else if (mp.score2 > mp.score1) t2Wins++;
            });
            match.status = (t1Wins >= neededWins || t2Wins >= neededWins) ? 'completed' : 'live';
          }
          newSchedule[matchIdx] = match;
        }
      }
    });

    updateDivision({ rawMaps: allMaps, schedule: newSchedule });
    return trulyUniqueMaps;
  };

  // --- API FETCH FUNCTION (CORRECTED FOR QUERY PARAMS) ---
  const handleApiFetch = async () => {
    if (!apiInput) return;
    setLoading(true);
    setApiStatus('Parsing inputs...');
    setLastImported([]);
    setError(null);
    
    // 1. Extract IDs from input
    const rawTokens = apiInput.split(/[\s,;\n]+/).filter(t => t.trim().length > 0);
    const idSet = new Set();
    
    rawTokens.forEach(token => {
      const clean = token.trim();
      
      // Case A: Exakt bara siffror (om du klistrar in id direkt)
      if (/^\d+$/.test(clean)) {
        idSet.add(clean);
        return;
      }

      // Case B: Hantera din specifika URL: ...?gameId=191818
      // Vi letar efter "gameId=" följt av siffror
      const queryMatch = clean.match(/gameId=(\d+)/i);
      
      if (queryMatch && queryMatch[1]) {
        idSet.add(queryMatch[1]);
      } else {
        // Case C: Fallback för andra länktyper (t.ex. /match/123)
        // Detta skadar inte att ha kvar om du skulle råka använda en annan sajt nån gång
        const pathMatch = clean.match(/(?:game|match|matches|demo)\/(\d+)/i);
        if (pathMatch && pathMatch[1]) {
          idSet.add(pathMatch[1]);
        }
      }
    });

    const ids = Array.from(idSet);

    // 2. Limit Check
    if (ids.length === 0) {
      setError("No valid Game IDs found. Ensure links contain 'gameId=...'");
      setLoading(false);
      return;
    }
    
    if (ids.length > 50) {
      setError(`Too many links! You pasted ${ids.length}. Max allowed is 50.`);
      setLoading(false);
      return;
    }

    setApiStatus(`Preparing to fetch ${ids.length} matches...`);

    const fetchedMatches = [];
    const errors = [];
    
    // 3. Fetch Loop
    for (const id of ids) {
      try {
        setApiStatus(`Fetching Game ID: ${id} (${fetchedMatches.length + 1}/${ids.length})...`);
        const response = await fetch(`/api/game/${id}`);
        const data = await response.json();

        if (data.status === 'success') {
          const parsed = parseMatch(id, data.data);
          fetchedMatches.push(parsed);
        } else {
          errors.push(`ID ${id}: ${data.message || 'Failed'}`);
        }
      } catch (err) {
        console.error(err);
        errors.push(`ID ${id}: Network Error`);
      }
    }

    // 4. Process Results
    if (fetchedMatches.length > 0) {
      const added = addMapsInBatch(fetchedMatches);
      setLastImported(added);
      setApiStatus(`? Success! Fetched ${fetchedMatches.length} matches.`);
      setApiInput(''); 
      setTimeout(() => setApiStatus(null), 5000);
    } 
    
    if (errors.length > 0) {
      if (fetchedMatches.length > 0) {
        setApiStatus(prev => `${prev} (with ${errors.length} errors)`);
        console.warn('Some fetches failed:', errors);
      } else {
        setError(errors.join('\n'));
        setApiStatus(null);
      }
    } else if (fetchedMatches.length === 0 && errors.length === 0) {
      setApiStatus('No matches found.');
    }
    setLoading(false);
  };
  // --- EVENT HANDLERS (UNCHANGED) ---
  const linkSeriesToMatch = (series, matchId) => {
    const match = schedule.find(m => m.id === matchId);
    if (!match) return;
    const [res1, res2] = series.resolvedTeams;
    const isNormalOrder = match.team1.toLowerCase() === res1.toLowerCase();
    const newSchedule = schedule.map(m => {
      if (m.id !== matchId) return m;
      const maps = series.maps.map(map => {
        // Use resolved teams to get scores, not original teams
        // This ensures consistent ordering regardless of JSON team order
        const score1 = isNormalOrder ? map.scores[res1] : map.scores[res2];
        const score2 = isNormalOrder ? map.scores[res2] : map.scores[res1];
        return { id: map.id, map: map.map, date: map.date, score1, score2 };
      });
      const isGroupPlayAll = m.round === 'group' && division.groupStageType === 'playall';
      let status;
      if (isGroupPlayAll) {
        status = maps.length >= m.bestOf ? 'completed' : 'live';
      } else {
        const neededWins = Math.ceil(m.bestOf / 2);
        let t1Wins = 0, t2Wins = 0;
        maps.forEach(mp => {
          if (mp.score1 > mp.score2) t1Wins++;
          else if (mp.score2 > mp.score1) t2Wins++;
        });
        status = (t1Wins >= neededWins || t2Wins >= neededWins) ? 'completed' : 'live';
      }
      return { ...m, maps, status };
    });
    updateDivision({ schedule: newSchedule });
  };

  const createMatchFromSeries = (series) => {
    const [t1, t2] = series.resolvedTeams;
    const newMatch = {
      id: `match-${Date.now()}`,
      team1: t1,
      team2: t2,
      group: '',
      round: 'group',
      bestOf: series.maps.length,
      date: series.maps[0]?.date?.split(' ')[0] || '',
      time: '',
      status: 'completed',
      maps: series.maps.map(map => ({
        id: map.id,
        map: map.map,
        date: map.date,
        // Use resolved teams for consistent ordering
        score1: map.scores[t1],
        score2: map.scores[t2]
      }))
    };
    updateDivision({ schedule: [...schedule, newMatch] });
  };

  const handleFileUpload = async (e) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    setError(null);
    setLoading(true);
    setLastImported([]);
    try {
      const allParsed = [];
      const errors = [];
      for (const file of Array.from(files)) {
        try {
          const text = await file.text();
          const data = JSON.parse(text);
          const parsed = processJsonData(data, file.name);
          allParsed.push(...parsed);
        } catch (err) {
          errors.push(`${file.name}: ${err.message}`);
        }
      }
      const added = addMapsInBatch(allParsed);
      setLastImported(added);
      if (errors.length) setError(errors.join('\n'));
    } catch (err) {
      setError(err.message);
    }
    setLoading(false);
    e.target.value = '';
  };

  const handleJsonPaste = () => {
    if (!jsonInput.trim()) return;
    setError(null);
    try {
      const data = JSON.parse(jsonInput);
      const parsed = processJsonData(data, 'pasted');
      const added = addMapsInBatch(parsed);
      setLastImported(added);
      setJsonInput('');
    } catch (err) {
      setError('Invalid JSON: ' + err.message);
    }
  };

  const handleClearResults = () => {
    if (window.confirm('Clear all imported results?')) {
      updateDivision({
        rawMaps: [],
        schedule: schedule.map(m => ({ ...m, maps: [], status: 'scheduled' }))
      });
      setLastImported([]);
    }
  };

  const removeSeries = (series) => {
    if (!window.confirm(`Remove this series (${series.maps.length} maps)?`)) return;
    
    // Get IDs of maps in this series
    const seriesToRemove = new Set(series.maps.map(m => m.id));
    
    // Filter out maps from this series
    const newRawMaps = rawMaps.filter(m => !seriesToRemove.has(m.id));
    
    // Also remove from schedule if linked
    let newSchedule = [...schedule];
    if (series.isLinked && series.scheduledMatch) {
      newSchedule = schedule.map(m => {
        if (m.id === series.scheduledMatch.id) {
          // Remove maps from this series
          const filteredMaps = (m.maps || []).filter(map => !seriesToRemove.has(map.id));
          const isGroupPlayAll = m.round === 'group' && division.groupStageType === 'playall';
          let status;
          if (filteredMaps.length === 0) {
            status = 'scheduled';
          } else if (isGroupPlayAll) {
            status = filteredMaps.length >= m.bestOf ? 'completed' : 'live';
          } else {
            const neededWins = Math.ceil(m.bestOf / 2);
            let t1Wins = 0, t2Wins = 0;
            filteredMaps.forEach(mp => {
              if (mp.score1 > mp.score2) t1Wins++;
              else if (mp.score2 > mp.score1) t2Wins++;
            });
            status = (t1Wins >= neededWins || t2Wins >= neededWins) ? 'completed' : 'live';
          }
          return { ...m, maps: filteredMaps, status };
        }
        return m;
      });
    }
    
    updateDivision({ rawMaps: newRawMaps, schedule: newSchedule });
  };

  const unlinkableMatches = schedule.filter(m => !m.maps || m.maps.length === 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex gap-2">
          <button onClick={() => setMode('json')} className={`px-4 py-2 rounded font-body font-semibold ${mode === 'json' ? 'bg-qw-accent text-qw-dark' : 'bg-qw-panel border border-qw-border text-qw-muted hover:text-white'}`}>
            📄 JSON Import
          </button>
          <button onClick={() => setMode('api')} className={`px-4 py-2 rounded font-body font-semibold ${mode === 'api' ? 'bg-qw-accent text-qw-dark' : 'bg-qw-panel border border-qw-border text-qw-muted hover:text-white'}`}>
            🌐 API Fetch
          </button>
        </div>
        {rawMaps.length > 0 && (
          <button onClick={handleClearResults} className="text-sm text-red-400 hover:text-red-300">Clear All</button>
        )}
      </div>

      {teams.length > 0 && (
        <div className="p-3 bg-qw-dark rounded border border-qw-border text-xs">
          <span className="text-qw-accent font-semibold">Team tag mapping:</span>
          <span className="text-qw-muted ml-2">
            {teams.slice(0, 5).map(t => `${t.tag} ? ${t.name}`).join(' | ')}
            {teams.length > 5 && ` (+${teams.length - 5} more)`}
          </span>
        </div>
      )}

      {mode === 'json' ? (
        <div className="qw-panel p-6 space-y-4">
          <h3 className="font-display text-lg text-qw-accent">IMPORT JSON FILES</h3>
          <input type="file" ref={fileInputRef} onChange={handleFileUpload} accept=".json" multiple className="hidden" />
          <button onClick={() => fileInputRef.current?.click()} disabled={loading} className="px-4 py-3 rounded border-2 border-dashed border-qw-border hover:border-qw-accent text-qw-muted hover:text-white transition-all w-full flex items-center justify-center gap-2 disabled:opacity-50">
            <span className="text-2xl">?</span>
            <span>{loading ? 'Processing...' : 'Select JSON files (Ctrl+click for multiple)'}</span>
          </button>
          
          <div>
            <label className="block text-qw-muted text-sm mb-1">Or paste JSON:</label>
            <textarea value={jsonInput} onChange={(e) => setJsonInput(e.target.value)} placeholder='{"teams": [...], "players": [...]}' rows={4} className="w-full bg-qw-dark border border-qw-border rounded px-4 py-2 font-mono text-white text-sm resize-none" />
            <button onClick={handleJsonPaste} disabled={!jsonInput.trim()} className="qw-btn mt-2 disabled:opacity-50">Import</button>
          </div>
        </div>
      ) : (
        // --- API FETCH UI (UPDATED) ---
        <div className="qw-panel p-6 space-y-4">
          <h3 className="font-display text-lg text-qw-accent">API FETCH</h3>
          <p className="text-sm text-qw-muted">Paste Game IDs or full URLs (up to 50) separated by spaces or newlines.</p>
          
          <div className="flex flex-col gap-2">
            <textarea 
              value={apiInput}
              onChange={(e) => setApiInput(e.target.value)}
              placeholder="e.g. 168085&#10;https://www.quakeworld.nu/matches/168086"
              rows={5}
              className="w-full bg-qw-darker text-white p-2 rounded border border-qw-border focus:border-qw-win outline-none font-mono text-sm resize-y"
            />
            <button 
              onClick={handleApiFetch}
              disabled={loading || !apiInput.trim()}
              className="qw-btn px-6 py-2 disabled:opacity-50 disabled:cursor-not-allowed self-end"
            >
              {loading ? 'Fetching...' : 'FETCH MATCHES'}
            </button>
          </div>
          
          {apiStatus && (
            <div className={`text-sm font-mono ${apiStatus.includes('?') ? 'text-qw-win' : 'text-qw-accent'}`}>
              {apiStatus}
            </div>
          )}
        </div>
      )}

      {error && <div className="p-4 bg-red-900/30 border border-red-500/50 rounded text-red-300 font-mono text-sm whitespace-pre-wrap">{error}</div>}

      {lastImported.length > 0 && (
        <div className="qw-panel p-4 border-l-4 border-qw-win">
          <h4 className="font-display text-sm text-qw-win mb-2">? IMPORTED {lastImported.length} MAP(S)</h4>
          <div className="text-sm text-qw-muted space-y-1 max-h-24 overflow-y-auto">
            {lastImported.map(m => (
              <div key={m.id}>
                {resolveTeamName(m.teams[0])} {m.scores[m.teams[0]]}-{m.scores[m.teams[1]]} {resolveTeamName(m.teams[1])} ({m.map})
              </div>
            ))}
          </div>
        </div>
      )}

      {/* DETECTED SERIES (UNCHANGED) */}
      {detectedSeries.length > 0 && (
        <div className="qw-panel p-6">
          <h3 className="font-display text-lg text-qw-accent mb-4">DETECTED SERIES ({detectedSeries.length})</h3>
          <p className="text-sm text-qw-muted mb-4">Maps grouped by matchup and time.</p>
          
          <div className="space-y-3">
            {detectedSeries.map(series => {
              const [t1, t2] = series.resolvedTeams;
              const w1 = series.score[t1] || 0;
              const w2 = series.score[t2] || 0;
              const f1 = series.frags?.[t1] || 0;
              const f2 = series.frags?.[t2] || 0;
              
              return (
                <div key={series.id} className={`p-4 rounded border ${series.isLinked ? 'bg-qw-win/10 border-qw-win/50' : 'bg-qw-dark border-qw-border'}`}>
                  <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
                    <div className="flex items-center gap-3 flex-wrap">
                      <span className={`font-body font-semibold ${w1 > w2 ? 'text-qw-win' : 'text-white'}`}>{t1}</span>
                      <span className="px-2 py-1 bg-qw-darker rounded font-mono">
                        <span className={w1 > w2 ? 'text-qw-win font-bold' : ''}>{w1}</span>
                        <span className="text-qw-muted mx-1">-</span>
                        <span className={w2 > w1 ? 'text-qw-win font-bold' : ''}>{w2}</span>
                      </span>
                      <span className={`font-body font-semibold ${w2 > w1 ? 'text-qw-win' : 'text-white'}`}>{t2}</span>
                      <span className="text-qw-muted text-sm">({series.maps.length} maps)</span>
                      <span className="px-2 py-0.5 bg-qw-darker rounded text-xs font-mono" title="Total frags">
                        <span className={f1 > f2 ? 'text-qw-accent' : 'text-qw-muted'}>{f1}</span>
                        <span className="text-qw-muted mx-1">-</span>
                        <span className={f2 > f1 ? 'text-qw-accent' : 'text-qw-muted'}>{f2}</span>
                        <span className="text-qw-muted ml-1">frags</span>
                      </span>
                      {series.dateDisplay && <span className="text-qw-muted text-xs bg-qw-darker px-2 py-0.5 rounded">{series.dateDisplay}</span>}
                    </div>
                    
                    <div className="flex items-center gap-2">
                      {series.isLinked ? (
                        <span className="text-qw-win text-sm">? Linked</span>
                      ) : series.scheduledMatch ? (
                        <button onClick={() => linkSeriesToMatch(series, series.scheduledMatch.id)} className="px-3 py-1 rounded bg-qw-accent text-qw-dark text-sm font-semibold">
                          Link to Match
                        </button>
                      ) : (
                        <div className="flex items-center gap-2">
                          {unlinkableMatches.length > 0 && (
                            <select onChange={(e) => e.target.value && linkSeriesToMatch(series, e.target.value)} className="bg-qw-darker border border-qw-border rounded px-2 py-1 text-sm text-white" defaultValue="">
                              <option value="" disabled>Link to...</option>
                              {unlinkableMatches.map(m => <option key={m.id} value={m.id}>{m.team1} vs {m.team2}</option>)}
                            </select>
                          )}
                          <button onClick={() => createMatchFromSeries(series)} className="px-3 py-1 rounded border border-qw-accent text-qw-accent text-sm hover:bg-qw-accent hover:text-qw-dark">
                            + Create Match
                          </button>
                        </div>
                      )}
                      <button 
                        onClick={() => removeSeries(series)} 
                        className="px-2 py-1 rounded text-red-400 hover:bg-red-900/30 hover:text-red-300 text-sm"
                        title="Remove this series"
                      >
                        🗑️
                      </button>
                    </div>
                  </div>
                  
                  <div className="flex flex-wrap gap-2 mt-2">
                    {series.maps.map(map => {
                      const [o1, o2] = map.teams;
                      const ms1 = map.scores[o1] || 0;
                      const ms2 = map.scores[o2] || 0;
                      return (
                        <span key={map.id} className="px-2 py-1 bg-qw-darker rounded text-xs font-mono">
                          {map.map}: <span className={ms1 > ms2 ? 'text-qw-win' : ''}>{ms1}</span>-<span className={ms2 > ms1 ? 'text-qw-win' : ''}>{ms2}</span>
                        </span>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* RAW MAPS (UNCHANGED) */}
      <div className="qw-panel p-6">
        <h3 className="font-display text-lg text-qw-accent mb-4">RAW MAPS ({rawMaps.length})</h3>
        {rawMaps.length === 0 ? (
          <div className="text-center py-8 text-qw-muted">
            <div className="text-4xl mb-2">?</div>
            <p>No results imported yet</p>
          </div>
        ) : (
          <div className="space-y-1 max-h-48 overflow-y-auto">
            {rawMaps.slice().reverse().map(map => (
              <div key={map.id} className="flex items-center justify-between p-2 bg-qw-dark rounded text-sm">
                <div className="flex items-center gap-3">
                  <span className="text-qw-muted font-mono text-xs">{map.map}</span>
                  <span className="text-white">{resolveTeamName(map.teams[0])} <span className="text-qw-accent">{map.scores[map.teams[0]]}-{map.scores[map.teams[1]]}</span> {resolveTeamName(map.teams[1])}</span>
                </div>
                <span className="text-qw-muted text-xs">{map.date?.split(' ')[0]}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}