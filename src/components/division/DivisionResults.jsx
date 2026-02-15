// src/components/division/DivisionResults.jsx
import React, { useState, useRef, useMemo, useCallback, useEffect } from 'react';
import { parseMatch, unicodeToAscii } from '../../utils/matchLogic';
import DivisionStats from './DivisionStats';

export default function DivisionResults({ division, updateDivision, tournamentId, tournament }) {
  const [mode, setMode] = useState('discord');
  const [showStats, setShowStats] = useState(false);
  // API Fetch states
  const [apiInput, setApiInput] = useState('');
  const [apiStatus, setApiStatus] = useState(null);

  // JSON states
  const [jsonInput, setJsonInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [lastImported, setLastImported] = useState([]);
  const fileInputRef = useRef(null);

  // Discord submission states
  const [submissions, setSubmissions] = useState([]);
  const [submissionsLoading, setSubmissionsLoading] = useState(false);
  const [submissionsError, setSubmissionsError] = useState(null);
  const [showApproved, setShowApproved] = useState(false);
  const [filterByDivision, setFilterByDivision] = useState(true);

  // Helper function to detect which division(s) a submission belongs to
  const detectSubmissionDivision = useCallback((submission) => {
    if (!submission?.game_data?.teams || !tournament?.divisions) return null;

    // Extract and clean team names from submission (handle QuakeWorld characters)
    const gameTeams = submission.game_data.teams.map(t => {
      const name = typeof t === 'object' ? t.name : t;
      return unicodeToAscii(name || '');
    }).filter(Boolean);

    if (gameTeams.length === 0) return null;

    // Check each division to see if it contains these teams
    const matchingDivisions = [];
    tournament.divisions.forEach(div => {
      // Build lookup map including team names, tags, and aliases
      const teamNameLookup = new Set();
      (div.teams || []).forEach(team => {
        // Clean team name for comparison (handles QuakeWorld characters)
        teamNameLookup.add(unicodeToAscii(team.name).toLowerCase());

        // Add team tag (and bracket-stripped variant) — ktxstats often uses clan tags as team names
        if (team.tag) {
          teamNameLookup.add(team.tag.toLowerCase());
          const cleanTag = team.tag.replace(/[\[\]]/g, '').toLowerCase();
          if (cleanTag !== team.tag.toLowerCase()) {
            teamNameLookup.add(cleanTag);
          }
        }

        // Also add aliases (clean them too!)
        if (team.aliases && Array.isArray(team.aliases)) {
          team.aliases.forEach(alias => {
            if (alias && alias.trim()) {
              // Clean alias before adding to lookup (in case user entered it with special chars)
              teamNameLookup.add(unicodeToAscii(alias).toLowerCase().trim());
            }
          });
        }
      });

      // Count how many game teams are found in this division
      const matchCount = gameTeams.filter(gt =>
        teamNameLookup.has(gt.toLowerCase())
      ).length;

      // If both teams are in this division, it's a match
      if (matchCount === gameTeams.length) {
        matchingDivisions.push(div);
      }
    });

    return matchingDivisions.length > 0 ? matchingDivisions : null;
  }, [tournament]);

  const fetchSubmissions = async (includeApproved) => {
    if (!tournamentId) return;
    setSubmissionsLoading(true);
    setSubmissionsError(null);
    try {
      const status = includeApproved ? 'all' : 'pending';
      const res = await fetch(`/api/submissions/${encodeURIComponent(tournamentId)}?status=${status}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to fetch');

      setSubmissions(data.submissions || []);
    } catch (err) {
      setSubmissionsError(err.message);
    }
    setSubmissionsLoading(false);
  };

  useEffect(() => { fetchSubmissions(showApproved); }, [tournamentId]);

  const handleApprove = async (submission) => {
    try {
      // Process game data FIRST, before marking as approved in DB
      // This way if parsing fails, the submission stays pending
      const gameData = submission.game_data;
      let parsed = null;
      if (gameData) {
        parsed = parseMatch(submission.game_id, gameData);
      }

      const res = await fetch(`/api/submission/${submission.id}/approve`, { method: 'POST' });
      if (!res.ok) throw new Error('Failed to approve');

      if (parsed) addMapsInBatch([parsed]);

      setSubmissions(prev => prev.filter(s => s.id !== submission.id));
    } catch (err) {
      setSubmissionsError(err.message);
    }
  };

  const handleReject = async (submission) => {
    try {
      const res = await fetch(`/api/submission/${submission.id}/reject`, { method: 'POST' });
      if (!res.ok) throw new Error('Failed to reject');
      setSubmissions(prev => prev.filter(s => s.id !== submission.id));
    } catch (err) {
      setSubmissionsError(err.message);
    }
  };

  const handleReprocess = (submission) => {
    try {
      const gameData = submission.game_data;
      if (gameData) {
        const parsed = parseMatch(submission.game_id, gameData);
        if (parsed) {
          const added = addMapsInBatch([parsed]);
          if (added.length > 0) {
            setSubmissions(prev => prev.filter(s => s.id !== submission.id));
          } else {
            setSubmissionsError('Already imported (duplicate detected)');
          }
        }
      }
    } catch (err) {
      setSubmissionsError(err.message);
    }
  };

  const handleBulkReprocess = () => {
    try {
      const approved = filteredSubmissions.filter(s => s.status === 'approved');
      const allParsed = [];
      for (const sub of approved) {
        const gameData = sub.game_data;
        if (gameData) {
          const parsed = parseMatch(sub.game_id, gameData);
          if (parsed) allParsed.push(parsed);
        }
      }
      if (allParsed.length > 0) {
        const added = addMapsInBatch(allParsed);
        if (added.length > 0) {
          const addedIds = new Set(added.map(m => m.id));
          const reprocessedSubIds = new Set(
            approved.filter(s => addedIds.has(s.game_id)).map(s => s.id)
          );
          setSubmissions(prev => prev.filter(s => !reprocessedSubIds.has(s.id)));
        } else {
          setSubmissionsError('All already imported (duplicates detected)');
        }
      }
    } catch (err) {
      setSubmissionsError(err.message);
    }
  };

  const handleBulkApprove = async () => {
    const pending = filteredSubmissions.filter(s => s.status === 'pending');
    const allParsed = [];
    const approvedSubIds = [];

    // First: parse all game data and approve in DB
    for (const sub of pending) {
      try {
        const gameData = sub.game_data;
        if (gameData) {
          const parsed = parseMatch(sub.game_id, gameData);
          if (parsed) allParsed.push(parsed);
        }

        const res = await fetch(`/api/submission/${sub.id}/approve`, { method: 'POST' });
        if (!res.ok) throw new Error(`Failed to approve ${sub.id}`);
        approvedSubIds.push(sub.id);
      } catch (err) {
        setSubmissionsError(err.message);
      }
    }

    // Then: add all maps in a single batch so series detection works
    if (allParsed.length > 0) {
      addMapsInBatch(allParsed);
    }

    if (approvedSubIds.length > 0) {
      const approvedSet = new Set(approvedSubIds);
      setSubmissions(prev => prev.filter(s => !approvedSet.has(s.id)));
    }
  };

  const teams = division.teams || [];
  const schedule = division.schedule || [];
  const rawMaps = division.rawMaps || [];

  // Filter submissions by detected division if enabled
  const filteredSubmissions = useMemo(() => {
    if (!filterByDivision) return submissions;

    return submissions.filter(sub => {
      const divisions = detectSubmissionDivision(sub);
      if (!divisions) return true; // Show if can't detect
      return divisions.some(d => d.id === division.id);
    });
  }, [submissions, filterByDivision, division.id, detectSubmissionDivision]);

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

      // Index aliases
      if (team.aliases && Array.isArray(team.aliases)) {
        team.aliases.forEach(alias => {
          if (alias && alias.trim()) {
            byNameLower[alias.toLowerCase().trim()] = team;
          }
        });
      }
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
      // Resolve scheduled team names through aliases before comparing
      const scheduledMatch = schedule.find(m => {
        const schedT1 = resolveTeamName(m.team1).toLowerCase();
        const schedT2 = resolveTeamName(m.team2).toLowerCase();
        return (schedT1 === t1Lower && schedT2 === t2Lower) ||
               (schedT1 === t2Lower && schedT2 === t1Lower);
      });
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

      // Find all candidate schedule entries for this team pair
      // IMPORTANT: Resolve scheduled team names through aliases before comparing
      const candidateIndices = [];
      newSchedule.forEach((m, idx) => {
        const schedTeam1Resolved = resolveTeamName(m.team1).toLowerCase();
        const schedTeam2Resolved = resolveTeamName(m.team2).toLowerCase();

        if ((schedTeam1Resolved === res1Lower && schedTeam2Resolved === res2Lower) ||
            (schedTeam1Resolved === res2Lower && schedTeam2Resolved === res1Lower)) {
          candidateIndices.push(idx);
        }
      });

      let matchIdx = -1;
      if (candidateIndices.length === 1) {
        matchIdx = candidateIndices[0];
      } else if (candidateIndices.length > 1) {
        // Multiple meetings (double round-robin): pick by date proximity,
        // preferring matches that don't have results yet
        const gameDate = mapResult.date?.split(' ')[0];
        const gameTime = gameDate ? new Date(gameDate + 'T00:00:00').getTime() : null;
        const emptyOnes = candidateIndices.filter(i => !newSchedule[i].maps?.length);
        const pool = emptyOnes.length > 0 ? emptyOnes : candidateIndices;

        if (gameTime) {
          let bestDist = Infinity;
          pool.forEach(idx => {
            const m = newSchedule[idx];
            if (m.date) {
              const dist = Math.abs(new Date(m.date + 'T00:00:00').getTime() - gameTime);
              if (dist < bestDist) { bestDist = dist; matchIdx = idx; }
            }
          });
        }
        if (matchIdx === -1) matchIdx = pool[0];
      }

      if (matchIdx !== -1) {
        const match = { ...newSchedule[matchIdx] };

        // Move match to the correct round based on the game's actual date
        if (match.round === 'group' && match.group && mapResult.date) {
          const gameDate = mapResult.date.split(' ')[0];
          if (gameDate) {
            const roundDates = {};
            newSchedule.forEach(m => {
              if (m.group === match.group && m.roundNum && m.date && !roundDates[m.roundNum]) {
                roundDates[m.roundNum] = m.date;
              }
            });
            if (Object.keys(roundDates).length > 0) {
              const gameTime = new Date(gameDate + 'T00:00:00').getTime();
              let bestRound = match.roundNum;
              let bestDist = match.date
                ? Math.abs(new Date(match.date + 'T00:00:00').getTime() - gameTime)
                : Infinity;
              for (const [rn, dateStr] of Object.entries(roundDates)) {
                const dist = Math.abs(new Date(dateStr + 'T00:00:00').getTime() - gameTime);
                if (dist < bestDist) { bestDist = dist; bestRound = Number(rn); }
              }
              if (bestRound !== match.roundNum) {
                match.roundNum = bestRound;
                match.date = roundDates[bestRound];
              }
            }
          }
        }

        // Check if this specific map is already in the match
        if (!match.maps?.some(mp => mp.id === mapResult.id)) {
          const isNormalOrder = match.team1.toLowerCase() === res1Lower;

          // Lookup scores using original team names from mapResult (they match the score keys)
          const rawScore1 = isNormalOrder ? mapResult.scores[team1] : mapResult.scores[team2];
          const rawScore2 = isNormalOrder ? mapResult.scores[team2] : mapResult.scores[team1];

          // Ensure scores are never undefined
          const score1 = rawScore1 ?? 0;
          const score2 = rawScore2 ?? 0;

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
        }
        newSchedule[matchIdx] = match;
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
    const matchT1Resolved = resolveTeamName(match.team1).toLowerCase();
    const isNormalOrder = matchT1Resolved === res1.toLowerCase();

    const newSchedule = schedule.map(m => {
      if (m.id !== matchId) return m;
      const maps = series.maps.map(map => {
        // CRITICAL: Scores are keyed by ORIGINAL team names, not resolved names
        // Must look up using map.teams, then reorder to match schedule
        const [mapT1, mapT2] = map.teams;  // Original team names from ktxstats
        const mapT1Resolved = resolveTeamName(mapT1);
        const mapT2Resolved = resolveTeamName(mapT2);

        // Check if this map's first team (when resolved) matches series' first resolved team
        const mapT1IsRes1 = mapT1Resolved.toLowerCase() === res1.toLowerCase();

        // Get scores using ORIGINAL team names as keys
        const mapScore1 = map.scores[mapT1] || 0;
        const mapScore2 = map.scores[mapT2] || 0;

        // Reorder scores to match series resolved team order (res1, res2)
        const scoreRes1 = mapT1IsRes1 ? mapScore1 : mapScore2;
        const scoreRes2 = mapT1IsRes1 ? mapScore2 : mapScore1;

        // Finally, map to scheduled match order (match.team1, match.team2)
        const score1 = isNormalOrder ? scoreRes1 : scoreRes2;
        const score2 = isNormalOrder ? scoreRes2 : scoreRes1;

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
    const [res1, res2] = series.resolvedTeams;

    // Detect group from teams if possible
    const team1Obj = teams.find(t => resolveTeamName(t.name).toLowerCase() === res1.toLowerCase());
    const team2Obj = teams.find(t => resolveTeamName(t.name).toLowerCase() === res2.toLowerCase());
    const detectedGroup = (team1Obj?.group === team2Obj?.group && team1Obj?.group) ? team1Obj.group : '';

    const newMatch = {
      id: `match-${Date.now()}`,
      team1: res1,
      team2: res2,
      group: detectedGroup,
      round: 'group',
      roundNum: 1,  // Default to round 1
      meeting: 1,   // Default to first meeting
      bestOf: series.maps.length,
      date: series.maps[0]?.date?.split(' ')[0] || '',
      time: '',
      status: 'completed',
      maps: series.maps.map(map => {
        // CRITICAL: Scores are keyed by ORIGINAL team names, not resolved names
        const [mapT1, mapT2] = map.teams;
        const mapT1Resolved = resolveTeamName(mapT1);

        // Check if this map's first team matches series' first resolved team
        const mapT1IsRes1 = mapT1Resolved.toLowerCase() === res1.toLowerCase();

        // Get scores using ORIGINAL team names as keys
        const mapScore1 = map.scores[mapT1] || 0;
        const mapScore2 = map.scores[mapT2] || 0;

        // Order scores to match series resolved team order
        const score1 = mapT1IsRes1 ? mapScore1 : mapScore2;
        const score2 = mapT1IsRes1 ? mapScore2 : mapScore1;

        return {
          id: map.id,
          map: map.map,
          date: map.date,
          score1,
          score2
        };
      })
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
        schedule: schedule.map(m => ({ ...m, maps: [], status: '' }))
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
          <button onClick={() => { setMode('discord'); fetchSubmissions(showApproved); }} className={`px-4 py-2 rounded font-body font-semibold ${mode === 'discord' ? 'bg-qw-accent text-qw-dark' : 'bg-qw-panel border border-qw-border text-qw-muted hover:text-white'}`}>
            🤖 Discord
          </button>
          <button onClick={() => setMode('api')} className={`px-4 py-2 rounded font-body font-semibold ${mode === 'api' ? 'bg-qw-accent text-qw-dark' : 'bg-qw-panel border border-qw-border text-qw-muted hover:text-white'}`}>
            🌐 API Fetch
          </button>
          <button onClick={() => setMode('json')} className={`px-4 py-2 rounded font-body font-semibold ${mode === 'json' ? 'bg-qw-accent text-qw-dark' : 'bg-qw-panel border border-qw-border text-qw-muted hover:text-white'}`}>
            📄 JSON Import
          </button>
        </div>
        {rawMaps.length > 0 && (
          <button onClick={handleClearResults} className="text-sm text-red-400 hover:text-red-300">Clear All</button>
        )}
      </div>

      {mode === 'discord' ? (
        <div className="qw-panel p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-display text-lg text-qw-accent">DISCORD SUBMISSIONS</h3>
            <div className="flex gap-2 items-center">
              {filteredSubmissions.filter(s => s.status === 'pending').length > 1 && (
                <button onClick={handleBulkApprove} className="px-3 py-1 rounded bg-qw-win text-qw-dark text-sm font-semibold">
                  Approve All ({filteredSubmissions.filter(s => s.status === 'pending').length})
                </button>
              )}
              {filteredSubmissions.filter(s => s.status === 'approved').length > 1 && (
                <button onClick={handleBulkReprocess} className="px-3 py-1 rounded bg-qw-accent text-qw-dark text-sm font-semibold">
                  Reprocess All ({filteredSubmissions.filter(s => s.status === 'approved').length})
                </button>
              )}
              <label className="flex items-center gap-1.5 text-xs text-qw-muted cursor-pointer">
                <input type="checkbox" checked={filterByDivision} onChange={(e) => setFilterByDivision(e.target.checked)} className="accent-qw-accent" />
                This Division Only
              </label>
              <label className="flex items-center gap-1.5 text-xs text-qw-muted cursor-pointer">
                <input type="checkbox" checked={showApproved} onChange={(e) => { setShowApproved(e.target.checked); fetchSubmissions(e.target.checked); }} className="accent-qw-accent" />
                Show Approved
              </label>
              <button onClick={() => fetchSubmissions(showApproved)} disabled={submissionsLoading} className="px-3 py-1 rounded border border-qw-border text-qw-muted text-sm hover:text-white disabled:opacity-50">
                {submissionsLoading ? 'Loading...' : 'Refresh'}
              </button>
            </div>
          </div>

          {!tournamentId && (
            <div className="p-4 bg-qw-dark rounded border border-qw-border text-qw-muted text-sm">
              Set a tournament name in the Info tab to enable Discord submissions.
            </div>
          )}

          {submissionsError && (
            <div className="p-3 bg-red-900/30 border border-red-500/50 rounded text-red-300 text-sm">{submissionsError}</div>
          )}

          {filteredSubmissions.length === 0 && !submissionsLoading && tournamentId && (
            <div className="text-center py-8 text-qw-muted">
              <div className="text-4xl mb-2">🤖</div>
              <p>No {filterByDivision ? `submissions for ${division.name}` : 'pending submissions'}</p>
              <p className="text-xs mt-1">
                {filterByDivision
                  ? `Uncheck "This Division Only" to see all submissions`
                  : 'Hub URLs posted in registered Discord channels will appear here.'}
              </p>
            </div>
          )}

          {filteredSubmissions.length > 0 && (
            <div className="space-y-2">
              {filteredSubmissions.map(sub => {
                const gameData = sub.game_data || {};
                const teams = gameData.teams || [];
                // Handle both formats: hub objects [{name, frags}] or ktxstats strings ["team"]
                // IMPORTANT: Clean QuakeWorld high-bit characters with unicodeToAscii
                const rawT1Name = typeof teams[0] === 'object' ? teams[0]?.name : teams[0] || '?';
                const rawT2Name = typeof teams[1] === 'object' ? teams[1]?.name : teams[1] || '?';
                const t1Name = unicodeToAscii(rawT1Name);
                const t2Name = unicodeToAscii(rawT2Name);
                const mapName = unicodeToAscii(gameData.map || '?');

                // Calculate frags: from hub objects, team_stats, or sum from players array
                let t1Frags, t2Frags;
                if (typeof teams[0] === 'object') {
                  t1Frags = teams[0]?.frags;
                  t2Frags = teams[1]?.frags;
                } else if (gameData.team_stats) {
                  // Use raw names for team_stats lookup (keys might have special chars)
                  t1Frags = gameData.team_stats[rawT1Name]?.frags;
                  t2Frags = gameData.team_stats[rawT2Name]?.frags;
                } else if (gameData.players) {
                  t1Frags = 0; t2Frags = 0;
                  gameData.players.forEach(p => {
                    if (p.team === teams[0]) t1Frags += (p.stats?.frags || 0);
                    else if (p.team === teams[1]) t2Frags += (p.stats?.frags || 0);
                  });
                }

                // Detect which division(s) this submission belongs to
                const detectedDivisions = detectSubmissionDivision(sub);
                const isCurrentDivision = detectedDivisions?.some(d => d.id === division.id);

                return (
                  <div key={sub.id} className="p-4 bg-qw-dark rounded border border-qw-border">
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-3 flex-wrap">
                          <span className="font-body font-semibold text-white">{t1Name}</span>
                          <span className="px-2 py-1 bg-qw-darker rounded font-mono text-sm">
                            <span className={(t1Frags || 0) > (t2Frags || 0) ? 'text-qw-win font-bold' : 'text-white'}>{t1Frags ?? '?'}</span>
                            <span className="text-qw-muted mx-1">-</span>
                            <span className={(t2Frags || 0) > (t1Frags || 0) ? 'text-qw-win font-bold' : 'text-white'}>{t2Frags ?? '?'}</span>
                          </span>
                          <span className="font-body font-semibold text-white">{t2Name}</span>
                          <span className="text-qw-muted text-xs bg-qw-darker px-2 py-0.5 rounded">{mapName}</span>
                          <span className="text-qw-muted text-xs bg-qw-darker px-2 py-0.5 rounded">{gameData.mode || '?'}</span>
                        </div>
                        <div className="text-xs text-qw-muted mt-1 flex items-center gap-2 flex-wrap">
                          <span>
                            Submitted by <span className="text-qw-accent">{sub.submitted_by_name}</span>
                            {' '}&middot;{' '}
                            {new Date(sub.created_at).toLocaleString()}
                            {' '}&middot;{' '}
                            Game #{sub.game_id}
                          </span>
                          {detectedDivisions ? (
                            detectedDivisions.length === 1 ? (
                              <span
                                className={`px-2 py-0.5 rounded text-xs font-semibold ${
                                  isCurrentDivision
                                    ? 'bg-qw-win/20 border border-qw-win/50 text-qw-win'
                                    : 'bg-blue-900/30 border border-blue-500/50 text-blue-300'
                                }`}
                                title={`Teams belong to ${detectedDivisions[0].name}`}
                              >
                                📍 {detectedDivisions[0].name}
                              </span>
                            ) : (
                              <span
                                className="px-2 py-0.5 bg-purple-900/30 border border-purple-500/50 text-purple-300 rounded text-xs font-semibold"
                                title={`Teams found in: ${detectedDivisions.map(d => d.name).join(', ')}`}
                              >
                                📍 Multiple ({detectedDivisions.length})
                              </span>
                            )
                          ) : (
                            <span
                              className="px-2 py-0.5 bg-yellow-900/30 border border-yellow-500/50 text-yellow-300 rounded text-xs font-semibold"
                              title="Teams not found in any division"
                            >
                              ⚠ Unknown Teams
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex gap-2 items-center">
                        {sub.status === 'approved' ? (
                          <>
                            <span className="text-qw-win text-xs font-semibold">Approved</span>
                            <button onClick={() => handleReprocess(sub)} className="px-3 py-1.5 rounded bg-qw-accent text-qw-dark text-sm font-semibold hover:bg-qw-accent/80">
                              Reprocess
                            </button>
                          </>
                        ) : (
                          <>
                            <button onClick={() => handleApprove(sub)} className="px-3 py-1.5 rounded bg-qw-win text-qw-dark text-sm font-semibold hover:bg-qw-win/80">
                              Approve
                            </button>
                            <button onClick={() => handleReject(sub)} className="px-3 py-1.5 rounded border border-red-500/50 text-red-400 text-sm hover:bg-red-900/30">
                              Reject
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ) : mode === 'json' ? (
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

      {/* PLAYER STATS - Expandable Section */}
      {rawMaps.length > 0 && (
        <div className="qw-panel overflow-hidden">
          <button
            onClick={() => setShowStats(!showStats)}
            className="w-full flex items-center justify-between px-6 py-4 bg-qw-dark border-b border-qw-border hover:bg-qw-dark/80 transition-colors"
          >
            <div className="flex items-center gap-3">
              <span className="text-xl">📊</span>
              <h3 className="font-display text-lg text-qw-accent">PLAYER STATISTICS</h3>
              <span className="text-xs text-qw-muted">
                (detailed stats from imported matches)
              </span>
            </div>
            <span className={`text-qw-accent transition-transform duration-200 ${showStats ? 'rotate-180' : ''}`}>
              ▼
            </span>
          </button>
          {showStats && (
            <div className="p-6">
              <DivisionStats division={division} />
            </div>
          )}
        </div>
      )}
    </div>
  );
}