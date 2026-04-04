// src/components/division/DivisionResults.jsx
import React, { useState, useRef, useMemo, useCallback, useEffect } from 'react';
import ConfirmModal from '../ConfirmModal';
import { parseMatch, unicodeToAscii } from '../../utils/matchLogic';
import {
  createTeamContext,
  resolveTeam as resolveTeamIdentity,
  resolveTeamFull,
} from '../../utils/teamIdentity';
import { confidenceLabel, confidenceColor } from '../../utils/matchConfidence';
import { scheduleWikiPublish } from '../../services/wikiPublisher';
import { supabase } from '../../services/supabaseClient';
import DivisionStats from './DivisionStats';
import QWStatsService from '../../services/QWStatsService';

export default function DivisionResults({
  division,
  updateDivision,
  updateAnyDivision,
  tournamentId,
  tournament,
}) {
  const [mode, setMode] = useState('discord');
  const [showMoreOptions, setShowMoreOptions] = useState(false);
  const [showStats, setShowStats] = useState(false);
  const [showRawMaps, setShowRawMaps] = useState(false);
  // API Fetch states
  const [apiInput, setApiInput] = useState('');
  const [apiStatus, setApiStatus] = useState(null);

  // JSON states
  const [jsonInput, setJsonInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [lastImported, setLastImported] = useState([]);
  const fileInputRef = useRef(null);
  const sessionTokenRef = useRef(null);

  // Discord submission states
  const [submissions, setSubmissions] = useState([]);
  const [submissionsLoading, setSubmissionsLoading] = useState(false);
  const [submissionsError, setSubmissionsError] = useState(null);
  const [showApproved, setShowApproved] = useState(false);
  const [filterByDivision, setFilterByDivision] = useState(true);

  // Wiki publish toast
  const [wikiToast, setWikiToast] = useState(null);
  const [pendingConfirm, setPendingConfirm] = useState(null);

  // Discover states
  const [discoverResults, setDiscoverResults] = useState(null);
  const [discoverLoading, setDiscoverLoading] = useState(false);
  const [discoverError, setDiscoverError] = useState(null);
  const [discoverSelected, setDiscoverSelected] = useState(new Set());

  // Browse states
  const [browseTeamTag, setBrowseTeamTag] = useState('');

  const [browseDateFrom, setBrowseDateFrom] = useState('');
  const [browseDateTo, setBrowseDateTo] = useState('');
  const [browseMapFilter, setBrowseMapFilter] = useState('');
  const [browseResults, setBrowseResults] = useState([]);
  const [browseLoading, setBrowseLoading] = useState(false);
  const [browseError, setBrowseError] = useState(null);
  const [browseSelected, setBrowseSelected] = useState(new Set());

  // Helper function to detect which division(s) a submission belongs to
  const detectSubmissionDivision = useCallback(
    (submission) => {
      if (!submission?.game_data?.teams || !tournament?.divisions) return null;

      // Extract raw team names from submission
      const gameTeams = submission.game_data.teams
        .map((t) => {
          const name = typeof t === 'object' ? t.name : t;
          return name || '';
        })
        .filter(Boolean);

      if (gameTeams.length === 0) return null;

      // Check each division to see if it contains these teams (using teamResolver)
      const matchingDivisions = [];
      tournament.divisions.forEach((div) => {
        const divTeams = div.teams || [];
        if (divTeams.length === 0) return;

        // Count how many game teams resolve to a known team in this division
        const divCtx = createTeamContext(divTeams);
        const matchCount = gameTeams.filter((gt) => {
          const result = resolveTeamFull(gt, divCtx);
          return result.match !== null;
        }).length;

        // If all teams are in this division, it's a match
        if (matchCount === gameTeams.length) {
          matchingDivisions.push(div);
        }
      });

      return matchingDivisions.length > 0 ? matchingDivisions : null;
    },
    [tournament]
  );

  useEffect(() => {
    if (!supabase) return;
    supabase.auth.getSession().then(({ data: { session } }) => {
      sessionTokenRef.current = session?.access_token ?? null;
    });
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_, session) => {
      sessionTokenRef.current = session?.access_token ?? null;
    });
    return () => subscription.unsubscribe();
  }, []);

  const getAuthHeaders = async () => {
    if (!supabase) return {};
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session?.access_token) return {};
    return { Authorization: `Bearer ${session.access_token}` };
  };

  const fetchSubmissions = async (includeApproved) => {
    if (!tournamentId) return;
    setSubmissionsLoading(true);
    setSubmissionsError(null);
    try {
      const status = includeApproved ? 'all' : 'pending';
      const res = await fetch(
        `/api/admin?action=submissions&tournamentId=${encodeURIComponent(tournamentId)}&status=${status}`
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to fetch');

      setSubmissions(data.submissions || []);
    } catch (err) {
      setSubmissionsError(err.message);
    }
    setSubmissionsLoading(false);
  };

  useEffect(() => {
    fetchSubmissions(showApproved);
  }, [tournamentId]);

  // Find the target division for a submission (returns null for current division)
  const getTargetDiv = (submission) => {
    const detected = detectSubmissionDivision(submission);
    if (!detected || detected.length !== 1) return null; // ambiguous or undetected → current division
    const target = detected[0];
    return target.id !== division.id ? target : null; // null = current division (no routing needed)
  };

  const handleApprove = async (submission) => {
    try {
      // Process game data FIRST, before marking as approved in DB
      // This way if parsing fails, the submission stays pending
      const gameData = submission.game_data;
      let parsed = null;
      if (gameData) {
        parsed = parseMatch(submission.game_id, gameData);
      }

      const authHeaders = await getAuthHeaders();
      const res = await fetch(`/api/submission/${submission.id}/approve`, {
        method: 'POST',
        headers: authHeaders,
      });
      if (!res.ok) throw new Error('Failed to approve');

      if (parsed) addMapsInBatch([parsed], getTargetDiv(submission));

      setSubmissions((prev) => prev.filter((s) => s.id !== submission.id));
    } catch (err) {
      setSubmissionsError(err.message);
    }
  };

  const handleReject = async (submission) => {
    try {
      const authHeaders = await getAuthHeaders();
      const res = await fetch(`/api/submission/${submission.id}/reject`, {
        method: 'POST',
        headers: authHeaders,
      });
      if (!res.ok) throw new Error('Failed to reject');
      setSubmissions((prev) => prev.filter((s) => s.id !== submission.id));
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
          const added = addMapsInBatch([parsed], getTargetDiv(submission));
          if (added.length > 0) {
            setSubmissions((prev) => prev.filter((s) => s.id !== submission.id));
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
      const approved = filteredSubmissions.filter((s) => s.status === 'approved');
      // Group parsed maps by target division for correct routing and series detection
      const byDiv = new Map(); // divId → { targetDiv, parsed[] }
      for (const sub of approved) {
        const gameData = sub.game_data;
        if (gameData) {
          const parsed = parseMatch(sub.game_id, gameData);
          if (parsed) {
            const target = getTargetDiv(sub);
            const key = target ? target.id : division.id;
            if (!byDiv.has(key)) byDiv.set(key, { targetDiv: target, parsed: [] });
            byDiv.get(key).parsed.push(parsed);
          }
        }
      }
      let totalAdded = [];
      for (const { targetDiv, parsed } of byDiv.values()) {
        const added = addMapsInBatch(parsed, targetDiv);
        totalAdded = totalAdded.concat(added);
      }
      if (totalAdded.length > 0) {
        const addedIds = new Set(totalAdded.map((m) => m.id));
        const reprocessedSubIds = new Set(
          approved.filter((s) => addedIds.has(s.game_id)).map((s) => s.id)
        );
        setSubmissions((prev) => prev.filter((s) => !reprocessedSubIds.has(s.id)));
      } else {
        setSubmissionsError('All already imported (duplicates detected)');
      }
    } catch (err) {
      setSubmissionsError(err.message);
    }
  };

  const handleBulkApprove = async () => {
    const pending = filteredSubmissions.filter((s) => s.status === 'pending');
    // Group parsed maps by target division for correct routing and series detection
    const byDiv = new Map(); // divId → { targetDiv, parsed[] }
    const approvedSubIds = [];
    const authHeaders = await getAuthHeaders();

    // First: parse all game data and approve in DB
    for (const sub of pending) {
      try {
        const gameData = sub.game_data;
        if (gameData) {
          const parsed = parseMatch(sub.game_id, gameData);
          if (parsed) {
            const target = getTargetDiv(sub);
            const key = target ? target.id : division.id;
            if (!byDiv.has(key)) byDiv.set(key, { targetDiv: target, parsed: [] });
            byDiv.get(key).parsed.push(parsed);
          }
        }

        const res = await fetch(`/api/submission/${sub.id}/approve`, {
          method: 'POST',
          headers: authHeaders,
        });
        if (!res.ok) throw new Error(`Failed to approve ${sub.id}`);
        approvedSubIds.push(sub.id);
      } catch (err) {
        setSubmissionsError(err.message);
      }
    }

    // Then: add maps per division in a single batch so series detection works
    for (const { targetDiv, parsed } of byDiv.values()) {
      addMapsInBatch(parsed, targetDiv);
    }

    if (approvedSubIds.length > 0) {
      const approvedSet = new Set(approvedSubIds);
      setSubmissions((prev) => prev.filter((s) => !approvedSet.has(s.id)));
    }
  };

  const teams = division.teams || [];
  const schedule = division.schedule || [];
  const rawMaps = division.rawMaps || [];

  // Filter submissions by detected division if enabled
  const filteredSubmissions = useMemo(() => {
    if (!filterByDivision) return submissions;

    return submissions.filter((sub) => {
      const divisions = detectSubmissionDivision(sub);
      if (!divisions) return true; // Show if can't detect
      return divisions.some((d) => d.id === division.id);
    });
  }, [submissions, filterByDivision, division.id, detectSubmissionDivision]);

  // --- TEAM LOOKUP & SERIES LOGIC ---

  // Memoized team context for the current division (replaces inline lookups)
  const teamsJson = JSON.stringify(
    teams.map((t) => ({ name: t.name, tag: t.tag, aliases: t.aliases }))
  );
  const teamCtx = useMemo(() => createTeamContext(teams), [teamsJson]);

  // Standalone helper: resolve a team name against any division's teams
  function resolveTeamNameWithLookup(jsonTeamName, divTeams) {
    if (!jsonTeamName) return jsonTeamName;
    const ctx = divTeams === teams ? teamCtx : createTeamContext(divTeams);
    return resolveTeamIdentity(jsonTeamName, ctx);
  }

  const resolveTeamName = useCallback(
    (jsonTeamName) => resolveTeamIdentity(jsonTeamName, teamCtx),
    [teamCtx]
  );

  const SERIES_GAP_MS = 2 * 60 * 60 * 1000;

  const detectedSeries = useMemo(() => {
    if (rawMaps.length === 0) return [];
    const matchupGroups = {};
    rawMaps.forEach((map) => {
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

    return allSeries.map((series) => {
      const [t1, t2] = series.resolvedTeams;
      const t1Lower = t1.toLowerCase();
      const t2Lower = t2.toLowerCase();
      // Find all matching schedule entries for this team pair
      const candidates = schedule.filter((m) => {
        const schedT1 = resolveTeamName(m.team1).toLowerCase();
        const schedT2 = resolveTeamName(m.team2).toLowerCase();
        return (
          (schedT1 === t1Lower && schedT2 === t2Lower) ||
          (schedT1 === t2Lower && schedT2 === t1Lower)
        );
      });

      let scheduledMatch = null;
      if (candidates.length === 1) {
        scheduledMatch = candidates[0];
      } else if (candidates.length > 1) {
        // Multiple meetings: prefer the one whose scheduled date is closest to the series' date range
        const seriesDate = series.maps[0]?.date?.split(' ')[0];
        const seriesTime = seriesDate ? new Date(seriesDate + 'T00:00:00').getTime() : null;
        if (seriesTime) {
          let bestDist = Infinity;
          candidates.forEach((m) => {
            if (m.date) {
              const dist = Math.abs(new Date(m.date + 'T00:00:00').getTime() - seriesTime);
              if (dist < bestDist) {
                bestDist = dist;
                scheduledMatch = m;
              }
            }
          });
        }
        if (!scheduledMatch) scheduledMatch = candidates[0];
      }
      return {
        ...series,
        scheduledMatch,
        isLinked: scheduledMatch?.maps?.some((m) => series.maps.some((sm) => sm.id === m.id)),
      };
    });
  }, [rawMaps, schedule, resolveTeamName]);

  function buildSeries(matchupId, maps, index) {
    const resolvedTeams = maps[0].resolvedTeams;
    const originalTeams = maps[0].teams;
    const [t1, t2] = resolvedTeams;
    const mapWins = { [t1]: 0, [t2]: 0 };
    const totalFrags = { [t1]: 0, [t2]: 0 };
    maps.forEach((map) => {
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
      dateDisplay: firstDate === lastDate ? firstDate : `${firstDate} - ${lastDate}`,
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

  const addMapsInBatch = (newMaps, targetDiv = null) => {
    // When targetDiv is provided, operate on that division's data instead of the current one
    const tDiv = targetDiv || division;
    const tRawMaps = tDiv.rawMaps || [];
    const tSchedule = tDiv.schedule || [];
    const tCtx = targetDiv ? createTeamContext(targetDiv.teams || []) : teamCtx;
    const tResolve = (name) => resolveTeamIdentity(name, tCtx);

    // Duplicate detection: check by ID (also strip "browse-" prefix for cross-path matching)
    const existingIds = new Set(tRawMaps.map((m) => m.id));
    const existingBaseIds = new Set(
      tRawMaps.map((m) =>
        String(m.id)
          .replace(/^browse-/, '')
          .replace(/-[^-]+$/, '')
      )
    );
    const uniqueNewMaps = newMaps.filter((m) => {
      if (existingIds.has(m.id)) return false;
      // Cross-path check: "browse-12345-dm3" should match existing "12345"
      const baseId = String(m.id)
        .replace(/^browse-/, '')
        .replace(/-[^-]+$/, '');
      if (existingBaseIds.has(baseId)) return false;
      return true;
    });

    // Additional duplicate detection: normalized fingerprint (handles team name variants)
    // Resolves team names so "sr", "SR", "-s-", "òó" all produce the same fingerprint
    const makeFingerprint = (m) => {
      const resolvedTeams = (m.teams || []).map((t) => tResolve(t).toLowerCase());
      return `${(m.map || '').toLowerCase()}|${resolvedTeams.sort().join('vs')}|${m.timestamp || m.date}`;
    };
    const existingFingerprints = new Set(tRawMaps.map(makeFingerprint));
    const trulyUniqueMaps = uniqueNewMaps.filter(
      (m) => !existingFingerprints.has(makeFingerprint(m))
    );

    if (trulyUniqueMaps.length === 0) {
      console.log('No new unique maps to add (all duplicates)');
      return [];
    }

    console.log(
      `Adding ${trulyUniqueMaps.length} unique maps (filtered ${newMaps.length - trulyUniqueMaps.length} duplicates)`
    );

    const allMaps = [...tRawMaps, ...trulyUniqueMaps];
    let newSchedule = [...tSchedule];

    trulyUniqueMaps.forEach((mapResult) => {
      const [team1, team2] = mapResult.teams;
      const resolved1 = tResolve(team1);
      const resolved2 = tResolve(team2);

      const res1Lower = resolved1.toLowerCase();
      const res2Lower = resolved2.toLowerCase();

      // Find all candidate schedule entries for this team pair
      // IMPORTANT: Resolve scheduled team names through aliases before comparing
      const candidateIndices = [];
      newSchedule.forEach((m, idx) => {
        const schedTeam1Resolved = tResolve(m.team1).toLowerCase();
        const schedTeam2Resolved = tResolve(m.team2).toLowerCase();

        if (
          (schedTeam1Resolved === res1Lower && schedTeam2Resolved === res2Lower) ||
          (schedTeam1Resolved === res2Lower && schedTeam2Resolved === res1Lower)
        ) {
          candidateIndices.push(idx);
        }
      });

      let matchIdx = -1;
      if (candidateIndices.length === 1) {
        matchIdx = candidateIndices[0];
      } else if (candidateIndices.length > 1) {
        // Multiple meetings (group + playoffs, double round-robin, etc.)
        // Use timestamp-based series affinity to cluster maps from the same session
        const mapTs = mapResult.timestamp || null;

        // Priority 1: Series affinity — if a candidate already has maps whose timestamps
        // are within SERIES_GAP_MS of this map, it belongs to the same series
        if (mapTs) {
          let bestAffinityDist = Infinity;
          candidateIndices.forEach((idx) => {
            const existingMaps = newSchedule[idx].maps || [];
            if (existingMaps.length === 0) return;
            // Check timestamp proximity to any existing map on this candidate
            for (const em of existingMaps) {
              // Look up the raw map's timestamp from allMaps (schedule maps don't store timestamp)
              const rawMap = allMaps.find((rm) => rm.id === em.id);
              const emTs = rawMap?.timestamp;
              if (emTs) {
                const dist = Math.abs(mapTs - emTs);
                if (dist <= SERIES_GAP_MS && dist < bestAffinityDist) {
                  bestAffinityDist = dist;
                  matchIdx = idx;
                }
              }
            }
          });
        }

        // Priority 2: Prefer empty candidates, pick by closest scheduled date
        if (matchIdx === -1) {
          const gameDate = mapResult.date?.split(' ')[0];
          const gameTime = gameDate ? new Date(gameDate + 'T00:00:00').getTime() : null;
          const emptyOnes = candidateIndices.filter((i) => !newSchedule[i].maps?.length);
          const pool = emptyOnes.length > 0 ? emptyOnes : candidateIndices;

          if (gameTime) {
            let bestDist = Infinity;
            pool.forEach((idx) => {
              const m = newSchedule[idx];
              if (m.date) {
                const dist = Math.abs(new Date(m.date + 'T00:00:00').getTime() - gameTime);
                if (dist < bestDist) {
                  bestDist = dist;
                  matchIdx = idx;
                }
              }
            });
          }
          if (matchIdx === -1) matchIdx = pool[0];
        }
      }

      if (matchIdx !== -1) {
        const match = { ...newSchedule[matchIdx] };

        // Move match to the correct round based on the game's actual date
        if (match.round === 'group' && match.group && mapResult.date) {
          const gameDate = mapResult.date.split(' ')[0];
          if (gameDate) {
            const roundDates = {};
            newSchedule.forEach((m) => {
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
                if (dist < bestDist) {
                  bestDist = dist;
                  bestRound = Number(rn);
                }
              }
              if (bestRound !== match.roundNum) {
                match.roundNum = bestRound;
                match.date = roundDates[bestRound];
              }
            }
          }
        }

        // Check if this specific map is already in the match
        if (!match.maps?.some((mp) => mp.id === mapResult.id)) {
          const isNormalOrder = match.team1.toLowerCase() === res1Lower;

          // Lookup scores using original team names from mapResult (they match the score keys)
          const rawScore1 = isNormalOrder ? mapResult.scores[team1] : mapResult.scores[team2];
          const rawScore2 = isNormalOrder ? mapResult.scores[team2] : mapResult.scores[team1];

          // Ensure scores are never undefined
          const score1 = rawScore1 ?? 0;
          const score2 = rawScore2 ?? 0;

          match.maps = [
            ...(match.maps || []),
            {
              id: mapResult.id,
              map: mapResult.map,
              date: mapResult.date,
              score1,
              score2,
            },
          ];

          // For Play All (Go) group matches, completed = all maps played. For Best Of, completed = first to majority wins.
          const isGroupPlayAll = match.round === 'group' && tDiv.groupStageType === 'playall';
          if (isGroupPlayAll) {
            match.status = match.maps.length >= match.bestOf ? 'completed' : 'live';
          } else {
            const neededWins = Math.ceil(match.bestOf / 2);
            let t1Wins = 0,
              t2Wins = 0;
            match.maps.forEach((mp) => {
              if (mp.score1 > mp.score2) t1Wins++;
              else if (mp.score2 > mp.score1) t2Wins++;
            });
            match.status = t1Wins >= neededWins || t2Wins >= neededWins ? 'completed' : 'live';
          }
        }
        newSchedule[matchIdx] = match;
      }
    });

    // Route update to the correct division
    if (targetDiv && updateAnyDivision) {
      updateAnyDivision(targetDiv.id, { rawMaps: allMaps, schedule: newSchedule });
    } else {
      updateDivision({ rawMaps: allMaps, schedule: newSchedule });
    }

    // Trigger wiki auto-publish (debounced 10s) if configured
    if (trulyUniqueMaps.length > 0) {
      const publishDiv = { ...tDiv, rawMaps: allMaps, schedule: newSchedule };
      scheduleWikiPublish(
        publishDiv,
        tournament,
        (results) => {
          const ok = results.filter((r) => r.ok);
          const fail = results.filter((r) => !r.ok);
          if (ok.length > 0 && fail.length === 0) {
            setWikiToast({ type: 'success', message: `Wiki updated: ${ok.length} target(s)` });
          } else if (ok.length > 0) {
            setWikiToast({
              type: 'warn',
              message: `Wiki: ${ok.length} updated, ${fail.length} failed`,
            });
          } else if (fail.length > 0) {
            setWikiToast({
              type: 'error',
              message: `Wiki publish failed: ${fail[0]?.error || 'unknown error'}`,
            });
          }
          setTimeout(() => setWikiToast(null), 6000);
        },
        10000,
        sessionTokenRef.current
      );
    }

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
    const rawTokens = apiInput.split(/[\s,;\n]+/).filter((t) => t.trim().length > 0);
    const idSet = new Set();

    rawTokens.forEach((token) => {
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
        setApiStatus((prev) => `${prev} (with ${errors.length} errors)`);
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
    const match = schedule.find((m) => m.id === matchId);
    if (!match) return;
    const [res1, res2] = series.resolvedTeams;
    const matchT1Resolved = resolveTeamName(match.team1).toLowerCase();
    const isNormalOrder = matchT1Resolved === res1.toLowerCase();

    const newSchedule = schedule.map((m) => {
      if (m.id !== matchId) return m;
      const maps = series.maps.map((map) => {
        // CRITICAL: Scores are keyed by ORIGINAL team names, not resolved names
        // Must look up using map.teams, then reorder to match schedule
        const [mapT1, mapT2] = map.teams; // Original team names from ktxstats
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
        let t1Wins = 0,
          t2Wins = 0;
        maps.forEach((mp) => {
          if (mp.score1 > mp.score2) t1Wins++;
          else if (mp.score2 > mp.score1) t2Wins++;
        });
        status = t1Wins >= neededWins || t2Wins >= neededWins ? 'completed' : 'live';
      }
      return { ...m, maps, status };
    });
    updateDivision({ schedule: newSchedule });
  };

  const createMatchFromSeries = (series) => {
    const [res1, res2] = series.resolvedTeams;

    // Detect group from teams if possible
    const team1Obj = teams.find(
      (t) => resolveTeamName(t.name).toLowerCase() === res1.toLowerCase()
    );
    const team2Obj = teams.find(
      (t) => resolveTeamName(t.name).toLowerCase() === res2.toLowerCase()
    );
    const detectedGroup =
      team1Obj?.group === team2Obj?.group && team1Obj?.group ? team1Obj.group : '';

    const newMatch = {
      id: `match-${Date.now()}`,
      team1: res1,
      team2: res2,
      group: detectedGroup,
      round: 'group',
      roundNum: 1, // Default to round 1
      meeting: 1, // Default to first meeting
      bestOf: series.maps.length,
      date: series.maps[0]?.date?.split(' ')[0] || '',
      time: '',
      status: 'completed',
      maps: series.maps.map((map) => {
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
          score2,
        };
      }),
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
    setPendingConfirm({
      title: 'Clear all imported results?',
      body: 'This will remove all map data and reset all match results. This cannot be undone.',
      confirmLabel: 'Clear Results',
      variant: 'danger',
      onConfirm: () => {
        updateDivision({
          rawMaps: [],
          schedule: schedule.map((m) => ({ ...m, maps: [], status: '' })),
        });
        setLastImported([]);
      },
    });
  };

  const removeSeries = (series) => {
    setPendingConfirm({
      title: `Remove this series?`,
      body: `This series contains ${series.maps.length} map${series.maps.length !== 1 ? 's' : ''}. Removing it will unlink these maps from the schedule.`,
      confirmLabel: 'Remove Series',
      variant: 'danger',
      onConfirm: () => doRemoveSeries(series),
    });
  };

  const doRemoveSeries = (series) => {
    // Get IDs of maps in this series
    const seriesToRemove = new Set(series.maps.map((m) => m.id));

    // Filter out maps from this series
    const newRawMaps = rawMaps.filter((m) => !seriesToRemove.has(m.id));

    // Also remove from schedule if linked
    let newSchedule = [...schedule];
    if (series.isLinked && series.scheduledMatch) {
      newSchedule = schedule.map((m) => {
        if (m.id === series.scheduledMatch.id) {
          // Remove maps from this series
          const filteredMaps = (m.maps || []).filter((map) => !seriesToRemove.has(map.id));
          const isGroupPlayAll = m.round === 'group' && division.groupStageType === 'playall';
          let status;
          if (filteredMaps.length === 0) {
            status = 'scheduled';
          } else if (isGroupPlayAll) {
            status = filteredMaps.length >= m.bestOf ? 'completed' : 'live';
          } else {
            const neededWins = Math.ceil(m.bestOf / 2);
            let t1Wins = 0,
              t2Wins = 0;
            filteredMaps.forEach((mp) => {
              if (mp.score1 > mp.score2) t1Wins++;
              else if (mp.score2 > mp.score1) t2Wins++;
            });
            status = t1Wins >= neededWins || t2Wins >= neededWins ? 'completed' : 'live';
          }
          return { ...m, maps: filteredMaps, status };
        }
        return m;
      });
    }

    updateDivision({ rawMaps: newRawMaps, schedule: newSchedule });
  };

  const unlinkableMatches = schedule.filter((m) => !m.maps || m.maps.length === 0);

  return (
    <div className="space-y-6">
      {/* Wiki publish toast */}
      {wikiToast && (
        <div
          className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-lg shadow-lg text-sm font-semibold transition-all ${
            wikiToast.type === 'success'
              ? 'bg-qw-win/20 border border-qw-win/40 text-qw-win'
              : wikiToast.type === 'warn'
                ? 'bg-amber-500/20 border border-amber-500/40 text-amber-300'
                : 'bg-qw-loss/20 border border-qw-loss/40 text-qw-loss'
          }`}
        >
          {wikiToast.message}
          <button
            onClick={() => setWikiToast(null)}
            className="ml-3 text-xs opacity-60 hover:opacity-100"
          >
            &times;
          </button>
        </div>
      )}

      <div className="flex items-center justify-between">
        <div className="flex gap-2 flex-wrap">
          <button
            onClick={() => {
              setMode('discord');
              fetchSubmissions(showApproved);
            }}
            className={`px-4 py-2 rounded font-body font-semibold ${mode === 'discord' ? 'bg-qw-accent text-qw-dark' : 'bg-qw-panel border border-qw-border text-qw-muted hover:text-white'}`}
          >
            🤖 Discord
          </button>
          <button
            onClick={() => setMode('browse')}
            className={`px-4 py-2 rounded font-body font-semibold ${mode === 'browse' ? 'bg-qw-accent text-qw-dark' : 'bg-qw-panel border border-qw-border text-qw-muted hover:text-white'}`}
          >
            🔍 Browse
          </button>
          <button
            onClick={() => setMode('discover')}
            className={`px-4 py-2 rounded font-body font-semibold ${mode === 'discover' ? 'bg-qw-accent text-qw-dark' : 'bg-qw-panel border border-qw-border text-qw-muted hover:text-white'}`}
          >
            🎯 Discover
          </button>
          <button
            onClick={() => setShowMoreOptions((v) => !v)}
            className={`px-4 py-2 rounded font-body font-semibold ${(mode === 'api' || mode === 'json') ? 'bg-qw-accent text-qw-dark' : 'bg-qw-panel border border-qw-border text-qw-muted hover:text-white'}`}
          >
            {showMoreOptions ? '▲ Less' : '▼ More options'}
          </button>
          {showMoreOptions && (
            <>
              <button
                onClick={() => setMode('api')}
                className={`px-4 py-2 rounded font-body font-semibold ${mode === 'api' ? 'bg-qw-accent text-qw-dark' : 'bg-qw-panel border border-qw-border text-qw-muted hover:text-white'}`}
              >
                🌐 API Fetch
              </button>
              <button
                onClick={() => setMode('json')}
                className={`px-4 py-2 rounded font-body font-semibold ${mode === 'json' ? 'bg-qw-accent text-qw-dark' : 'bg-qw-panel border border-qw-border text-qw-muted hover:text-white'}`}
              >
                📄 JSON Import
              </button>
            </>
          )}
        </div>
        {rawMaps.length > 0 && (
          <button onClick={handleClearResults} className="text-sm text-red-400 hover:text-red-300">
            Clear All
          </button>
        )}
      </div>

      {mode === 'discord' ? (
        <div className="qw-panel p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-display text-lg text-qw-accent">DISCORD SUBMISSIONS</h3>
            <div className="flex gap-2 items-center">
              {filteredSubmissions.filter((s) => s.status === 'pending').length > 1 && (
                <button
                  onClick={handleBulkApprove}
                  className="px-3 py-1 rounded bg-qw-win text-qw-dark text-sm font-semibold"
                >
                  Approve All ({filteredSubmissions.filter((s) => s.status === 'pending').length})
                </button>
              )}
              {filteredSubmissions.filter((s) => s.status === 'approved').length > 1 && (
                <button
                  onClick={handleBulkReprocess}
                  className="px-3 py-1 rounded bg-qw-accent text-qw-dark text-sm font-semibold"
                >
                  Reprocess All ({filteredSubmissions.filter((s) => s.status === 'approved').length}
                  )
                </button>
              )}
              <label className="flex items-center gap-1.5 text-xs text-qw-muted cursor-pointer">
                <input
                  type="checkbox"
                  checked={filterByDivision}
                  onChange={(e) => setFilterByDivision(e.target.checked)}
                  className="accent-qw-accent"
                />
                This Division Only
              </label>
              <label className="flex items-center gap-1.5 text-xs text-qw-muted cursor-pointer">
                <input
                  type="checkbox"
                  checked={showApproved}
                  onChange={(e) => {
                    setShowApproved(e.target.checked);
                    fetchSubmissions(e.target.checked);
                  }}
                  className="accent-qw-accent"
                />
                Show Approved
              </label>
              <button
                onClick={() => fetchSubmissions(showApproved)}
                disabled={submissionsLoading}
                className="px-3 py-1 rounded border border-qw-border text-qw-muted text-sm hover:text-white disabled:opacity-50"
              >
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
            <div className="p-3 bg-red-900/30 border border-red-500/50 rounded text-red-300 text-sm">
              {submissionsError}
            </div>
          )}

          {filteredSubmissions.length === 0 && !submissionsLoading && tournamentId && (
            <div className="text-center py-8 text-qw-muted">
              <div className="text-4xl mb-2">🤖</div>
              <p>
                No {filterByDivision ? `submissions for ${division.name}` : 'pending submissions'}
              </p>
              <p className="text-xs mt-1">
                {filterByDivision
                  ? `Uncheck "This Division Only" to see all submissions`
                  : 'Hub URLs posted in registered Discord channels will appear here.'}
              </p>
            </div>
          )}

          {filteredSubmissions.length > 0 && (
            <div className="space-y-2">
              {filteredSubmissions.map((sub) => {
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
                  t1Frags = 0;
                  t2Frags = 0;
                  gameData.players.forEach((p) => {
                    if (p.team === teams[0]) t1Frags += p.stats?.frags || 0;
                    else if (p.team === teams[1]) t2Frags += p.stats?.frags || 0;
                  });
                }

                // Detect which division(s) this submission belongs to
                const detectedDivisions = detectSubmissionDivision(sub);
                const isCurrentDivision = detectedDivisions?.some((d) => d.id === division.id);

                return (
                  <div key={sub.id} className="p-4 bg-qw-dark rounded border border-qw-border">
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-3 flex-wrap">
                          <span className="font-body font-semibold text-white">{t1Name}</span>
                          <span className="px-2 py-1 bg-qw-darker rounded font-mono text-sm">
                            <span
                              className={
                                (t1Frags || 0) > (t2Frags || 0)
                                  ? 'text-qw-win font-bold'
                                  : 'text-white'
                              }
                            >
                              {t1Frags ?? '?'}
                            </span>
                            <span className="text-qw-muted mx-1">-</span>
                            <span
                              className={
                                (t2Frags || 0) > (t1Frags || 0)
                                  ? 'text-qw-win font-bold'
                                  : 'text-white'
                              }
                            >
                              {t2Frags ?? '?'}
                            </span>
                          </span>
                          <span className="font-body font-semibold text-white">{t2Name}</span>
                          <span className="text-qw-muted text-xs bg-qw-darker px-2 py-0.5 rounded">
                            {mapName}
                          </span>
                          <span className="text-qw-muted text-xs bg-qw-darker px-2 py-0.5 rounded">
                            {gameData.mode || '?'}
                          </span>
                          {sub.flags?.confidence != null && (
                            <span
                              className={`text-xs font-semibold px-2 py-0.5 rounded bg-qw-darker ${confidenceColor(sub.flags.confidence)}`}
                              title={
                                sub.flags.breakdown
                                  ? `Team: ${sub.flags.breakdown.teamMatch}/40, Schedule: ${sub.flags.breakdown.scheduleProximity}/30, BestOf: ${sub.flags.breakdown.bestOfFit}/15, Series: ${sub.flags.breakdown.seriesAffinity}/15`
                                  : `Confidence: ${sub.flags.confidence}%`
                              }
                            >
                              {confidenceLabel(sub.flags.confidence)} {sub.flags.confidence}%
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-qw-muted mt-1 flex items-center gap-2 flex-wrap">
                          <span>
                            {gameData.date && (
                              <>
                                <span className="text-qw-text">
                                  📅 {gameData.date.replace(/\s*\+\d{4}$/, '').trim()}
                                </span>{' '}
                                &middot;{' '}
                              </>
                            )}
                            Submitted by{' '}
                            <span className="text-qw-accent">{sub.submitted_by_name}</span> &middot;{' '}
                            {new Date(sub.created_at).toLocaleString()} &middot; Game #{sub.game_id}
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
                                title={`Teams found in: ${detectedDivisions.map((d) => d.name).join(', ')}`}
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
                            <button
                              onClick={() => handleReprocess(sub)}
                              className="px-3 py-1.5 rounded bg-qw-accent text-qw-dark text-sm font-semibold hover:bg-qw-accent/80"
                            >
                              Reprocess
                            </button>
                          </>
                        ) : (
                          <>
                            <button
                              onClick={() => handleApprove(sub)}
                              className="px-3 py-1.5 rounded bg-qw-win text-qw-dark text-sm font-semibold hover:bg-qw-win/80"
                            >
                              Approve
                            </button>
                            <button
                              onClick={() => handleReject(sub)}
                              className="px-3 py-1.5 rounded border border-red-500/50 text-red-400 text-sm hover:bg-red-900/30"
                            >
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
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileUpload}
            accept=".json"
            multiple
            className="hidden"
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={loading}
            className="px-4 py-3 rounded border-2 border-dashed border-qw-border hover:border-qw-accent text-qw-muted hover:text-white transition-all w-full flex items-center justify-center gap-2 disabled:opacity-50"
          >
            <span className="text-2xl">?</span>
            <span>{loading ? 'Processing...' : 'Select JSON files (Ctrl+click for multiple)'}</span>
          </button>

          <div>
            <label className="block text-qw-muted text-sm mb-1">Or paste JSON:</label>
            <textarea
              value={jsonInput}
              onChange={(e) => setJsonInput(e.target.value)}
              placeholder='{"teams": [...], "players": [...]}'
              rows={4}
              className="w-full bg-qw-dark border border-qw-border rounded px-4 py-2 font-mono text-white text-sm resize-none"
            />
            <button
              onClick={handleJsonPaste}
              disabled={!jsonInput.trim()}
              className="qw-btn mt-2 disabled:opacity-50"
            >
              Import
            </button>
          </div>
        </div>
      ) : mode === 'discover' ? (
        // --- DISCOVER GAMES UI ---
        <div className="qw-panel p-6 space-y-4">
          <h3 className="font-display text-lg text-qw-accent">DISCOVER GAMES</h3>
          <p className="text-sm text-qw-muted">
            Automatically find games for this division's scheduled matchups using the QW Stats API.
            Uses the confidence model to score each candidate (roster, schedule, matchtag, series
            format).
          </p>

          <button
            onClick={async () => {
              setDiscoverLoading(true);
              setDiscoverError(null);
              setDiscoverResults(null);
              setDiscoverSelected(new Set());
              try {
                // Build maps from all divisions
                const mapPool = new Set();
                for (const div of tournament.divisions || []) {
                  for (const match of div.schedule || []) {
                    for (const map of match.maps || []) {
                      if (map.map) mapPool.add(map.map);
                    }
                  }
                }
                // Also add common QW maps as fallback
                if (mapPool.size === 0) {
                  ['dm2', 'dm3', 'dm4', 'dm6', 'e1m2', 'aerowalk', 'ztndm3', 'skull'].forEach((m) =>
                    mapPool.add(m)
                  );
                }

                const config = {
                  name: tournament.name || '',
                  mode: tournament.mode || '4on4',
                  startDate: tournament.startDate || '',
                  endDate: tournament.endDate || '',
                  mapPool: [...mapPool],
                  tagPatterns: [],
                  threshold: 0,
                  divisions: [
                    {
                      id: division.id,
                      name: division.name,
                      teams: (division.teams || []).map((t) => ({
                        name: t.name,
                        tag: t.tag,
                        aliases: t.aliases || [],
                        players: t.players || '',
                      })),
                      schedule: (division.schedule || []).map((m) => ({
                        team1: m.team1,
                        team2: m.team2,
                        date: m.date,
                        bestOf: m.bestOf,
                        status: m.status,
                      })),
                      isPlayoffs: division.format !== 'groups',
                      bestOf: division.groupStageBestOf || 3,
                    },
                  ],
                  aliasMap: {},
                };

                const authHeaders = await getAuthHeaders();
                const res = await fetch('/api/discover-games', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json', ...authHeaders },
                  body: JSON.stringify({ config }),
                });
                const data = await res.json();
                if (!data.ok) throw new Error(data.error || 'Discovery failed');
                setDiscoverResults(data);
              } catch (err) {
                setDiscoverError(err.message);
              }
              setDiscoverLoading(false);
            }}
            disabled={discoverLoading || (division.teams || []).length === 0}
            className="qw-btn px-6 py-2 disabled:opacity-50"
          >
            {discoverLoading ? 'Scanning...' : 'Discover Games'}
          </button>

          {discoverError && (
            <div className="p-3 bg-red-900/30 border border-red-500/50 rounded text-red-300 text-sm">
              {discoverError}
            </div>
          )}

          {discoverResults && (
            <div className="space-y-4">
              {/* Summary */}
              <div className="flex flex-wrap gap-4 text-sm">
                <span className="text-qw-muted">
                  Scanned:{' '}
                  <span className="text-white font-mono">
                    {discoverResults.summary?.scanned || 0}
                  </span>
                </span>
                <span className="text-qw-muted">
                  Passed gates:{' '}
                  <span className="text-qw-win font-mono">
                    {discoverResults.summary?.passed || 0}
                  </span>
                </span>
                <span className="text-qw-muted">
                  Rejected:{' '}
                  <span className="text-qw-loss font-mono">
                    {discoverResults.summary?.rejected || 0}
                  </span>
                </span>
                <span className="text-qw-muted">
                  Series:{' '}
                  <span className="text-qw-accent font-mono">
                    {discoverResults.candidates?.length || 0}
                  </span>
                </span>
              </div>

              {(discoverResults.candidates || []).length > 0 && (
                <>
                  {/* Select all / Import */}
                  <div className="flex items-center justify-between">
                    <button
                      onClick={() => {
                        const all = discoverResults.candidates || [];
                        if (discoverSelected.size === all.length) {
                          setDiscoverSelected(new Set());
                        } else {
                          setDiscoverSelected(new Set(all.map((_, i) => i)));
                        }
                      }}
                      className="text-sm text-qw-accent hover:text-white"
                    >
                      {discoverSelected.size === (discoverResults.candidates || []).length
                        ? 'Deselect All'
                        : 'Select All'}
                    </button>
                    {discoverSelected.size > 0 && (
                      <button
                        onClick={() => {
                          const candidates = discoverResults.candidates || [];
                          const newMaps = [];
                          for (const idx of discoverSelected) {
                            const series = candidates[idx];
                            if (!series) continue;
                            for (const game of series.games) {
                              const t1 = game.teams?.[0] || {};
                              const t2 = game.teams?.[1] || {};
                              const scores = {};
                              scores[series.team1] = t1.frags ?? 0;
                              scores[series.team2] = t2.frags ?? 0;
                              let timestamp = null;
                              if (game.timestamp) {
                                // eslint-disable-next-line no-empty
                                try {
                                  timestamp = new Date(game.timestamp).getTime();
                                } catch {}
                              }
                              newMaps.push({
                                id: `discover-${game.id}-${game.map}`,
                                date: game.timestamp || null,
                                timestamp,
                                map: game.map || 'unknown',
                                mode: tournament.mode || '4on4',
                                duration: null,
                                teams: [series.team1, series.team2],
                                matchupId: [series.team1, series.team2].sort().join('vs'),
                                scores,
                                originalData: game,
                              });
                            }
                          }
                          const added = addMapsInBatch(newMaps);
                          if (added && added.length > 0) {
                            setLastImported(added);
                            setDiscoverSelected(new Set());
                          }
                        }}
                        className="qw-btn px-4 py-1.5 text-sm"
                      >
                        Import Selected ({discoverSelected.size} series,{' '}
                        {[...discoverSelected].reduce(
                          (sum, idx) =>
                            sum + ((discoverResults.candidates || [])[idx]?.games?.length || 0),
                          0
                        )}{' '}
                        maps)
                      </button>
                    )}
                    {discoverSelected.size > 0 && (
                      <button
                        onClick={async () => {
                          const selected = [...discoverSelected]
                            .map((idx) => discoverResults.candidates[idx])
                            .filter(Boolean);
                          try {
                            const apiBase = import.meta.env.VITE_API_BASE_URL || '';
                            const res = await fetch(
                              `${apiBase}/api/discord?action=post-discovery`,
                              {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({
                                  tournamentId,
                                  candidates: selected,
                                  summary: discoverResults.summary || null,
                                }),
                              }
                            );
                            const data = await res.json();
                            if (!res.ok) throw new Error(data.error || 'Failed');
                            setWikiToast({
                              type: data.channels > 0 ? 'success' : 'warn',
                              message:
                                data.channels > 0
                                  ? `Posted ${selected.length} candidate(s) to ${data.channels} channel(s)`
                                  : 'No registered channels',
                            });
                          } catch (err) {
                            setWikiToast({ type: 'error', message: err.message });
                          }
                          setTimeout(() => setWikiToast(null), 5000);
                        }}
                        className="qw-btn-secondary px-4 py-1.5 text-sm flex items-center gap-1.5"
                        title="Post selected candidates to Discord with Approve/Reject buttons"
                      >
                        <svg width="14" height="11" viewBox="0 0 71 55" fill="currentColor">
                          <path d="M60.1 4.9A58.5 58.5 0 0045.4.2a.2.2 0 00-.2.1 40.7 40.7 0 00-1.8 3.7 54 54 0 00-16.2 0A26.4 26.4 0 0025.4.3a.2.2 0 00-.2-.1A58.4 58.4 0 0010.5 5 59.6 59.6 0 00.4 45.2a.3.3 0 00.1.2 58.9 58.9 0 0017.7 9 .2.2 0 00.3-.1 42 42 0 003.6-5.9.2.2 0 00-.1-.3 38.8 38.8 0 01-5.5-2.7.2.2 0 01 0-.4c.4-.3.7-.6 1.1-.8a.2.2 0 01.2 0 42 42 0 0035.8 0 .2.2 0 01.2 0l1.1.9a.2.2 0 010 .3 36.4 36.4 0 01-5.5 2.7.2.2 0 00-.1.3 47.2 47.2 0 003.6 5.9.2.2 0 00.3.1A58.7 58.7 0 0070 45.4a.3.3 0 00.1-.2c1.6-16.7-2.7-31.2-11.5-44A.2.2 0 0058 .5zM23.7 37.1c-3.8 0-6.9-3.5-6.9-7.8s3-7.8 6.9-7.8c3.9 0 7 3.5 6.9 7.8 0 4.3-3 7.8-6.9 7.8zm25.5 0c-3.8 0-6.9-3.5-6.9-7.8s3-7.8 6.9-7.8c3.9 0 7 3.5 6.9 7.8 0 4.3-3.1 7.8-6.9 7.8z" />
                        </svg>
                        Post to Discord
                      </button>
                    )}
                  </div>

                  {/* Series list */}
                  <div className="space-y-2 max-h-[600px] overflow-y-auto">
                    {(discoverResults.candidates || []).map((series, idx) => {
                      const isSelected = discoverSelected.has(idx);
                      const conf = series.avgConfidence || 0;
                      const confColor =
                        conf >= 80 ? 'text-qw-win' : conf >= 50 ? 'text-amber-300' : 'text-qw-loss';
                      const confBg =
                        conf >= 80
                          ? 'bg-qw-win/15 border-qw-win/30'
                          : conf >= 50
                            ? 'bg-amber-500/15 border-amber-500/30'
                            : 'bg-qw-loss/15 border-qw-loss/30';
                      return (
                        <div
                          key={`${series.team1}-${series.team2}-${idx}`}
                          onClick={() => {
                            const next = new Set(discoverSelected);
                            if (next.has(idx)) next.delete(idx);
                            else next.add(idx);
                            setDiscoverSelected(next);
                          }}
                          className={`p-3 rounded border cursor-pointer transition-colors ${
                            isSelected
                              ? 'bg-qw-accent/10 border-qw-accent'
                              : 'bg-qw-dark border-qw-border hover:border-qw-muted'
                          }`}
                        >
                          <div className="flex items-center justify-between gap-3">
                            <div className="flex items-center gap-3 flex-1 min-w-0">
                              <input
                                type="checkbox"
                                checked={isSelected}
                                readOnly
                                className="accent-qw-accent flex-shrink-0"
                              />
                              <span className="font-body font-semibold text-white truncate">
                                {series.team1}
                              </span>
                              <span className="text-qw-muted text-xs">vs</span>
                              <span className="font-body font-semibold text-white truncate">
                                {series.team2}
                              </span>
                            </div>
                            <div className="flex items-center gap-3 flex-shrink-0">
                              <span className="text-xs text-qw-muted">
                                {series.mapCount} map{series.mapCount !== 1 ? 's' : ''}
                              </span>
                              <span className="text-xs text-qw-muted">{series.source}</span>
                              <span
                                className={`px-2 py-0.5 rounded text-xs font-bold ${confBg} ${confColor}`}
                              >
                                {conf}%
                              </span>
                            </div>
                          </div>
                          {/* Per-map details */}
                          <div className="mt-2 flex flex-wrap gap-2">
                            {(series.games || []).map((game, gi) => {
                              const t1 = game.teams?.[0] || {};
                              const t2 = game.teams?.[1] || {};
                              const dateStr = game.timestamp
                                ? new Date(game.timestamp).toLocaleDateString('sv-SE')
                                : '';
                              return (
                                <div
                                  key={gi}
                                  className="flex items-center gap-2 text-xs bg-qw-darker px-2 py-1 rounded"
                                >
                                  <span className="text-qw-accent font-mono">{game.map}</span>
                                  <span className="font-mono">
                                    <span
                                      className={
                                        (t1.frags ?? 0) > (t2.frags ?? 0)
                                          ? 'text-qw-win'
                                          : 'text-white'
                                      }
                                    >
                                      {t1.frags ?? '?'}
                                    </span>
                                    <span className="text-qw-muted">-</span>
                                    <span
                                      className={
                                        (t2.frags ?? 0) > (t1.frags ?? 0)
                                          ? 'text-qw-win'
                                          : 'text-white'
                                      }
                                    >
                                      {t2.frags ?? '?'}
                                    </span>
                                  </span>
                                  {dateStr && <span className="text-qw-muted">{dateStr}</span>}
                                  <span
                                    className={`${game.confidence?.total >= 80 ? 'text-qw-win' : game.confidence?.total >= 50 ? 'text-amber-300' : 'text-qw-loss'}`}
                                  >
                                    {game.confidence?.total ?? '?'}
                                  </span>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </>
              )}

              {(discoverResults.candidates || []).length === 0 && (
                <p className="text-qw-muted text-sm">
                  No matching games found. Make sure teams are set up and the tournament date range
                  covers the period games were played.
                </p>
              )}
            </div>
          )}
        </div>
      ) : mode === 'browse' ? (
        // --- BROWSE / SEARCH UI ---
        <div className="qw-panel p-6 space-y-4">
          <h3 className="font-display text-lg text-qw-accent">BROWSE GAMES</h3>
          <p className="text-sm text-qw-muted">
            Search recent 4on4 games by team tag from the QW Stats API. Import basic match data
            (teams, score, map, date) directly.
          </p>

          <div className="flex flex-wrap gap-3 items-end">
            <div className="flex-1 min-w-[140px]">
              <label className="block text-qw-muted text-xs mb-1">Team Tag *</label>
              <input
                type="text"
                value={browseTeamTag}
                onChange={(e) => setBrowseTeamTag(e.target.value)}
                placeholder="e.g. sr, def, fi"
                className="w-full bg-qw-darker border border-qw-border rounded px-3 py-2 text-white text-sm focus:border-qw-accent outline-none"
              />
            </div>
            <div>
              <label className="block text-qw-muted text-xs mb-1">From</label>
              <input
                type="date"
                value={browseDateFrom}
                onChange={(e) => setBrowseDateFrom(e.target.value)}
                className="bg-qw-darker border border-qw-border rounded px-3 py-2 text-white text-sm focus:border-qw-accent outline-none"
              />
            </div>
            <div>
              <label className="block text-qw-muted text-xs mb-1">To</label>
              <input
                type="date"
                value={browseDateTo}
                onChange={(e) => setBrowseDateTo(e.target.value)}
                className="bg-qw-darker border border-qw-border rounded px-3 py-2 text-white text-sm focus:border-qw-accent outline-none"
              />
            </div>
            <div>
              <label className="block text-qw-muted text-xs mb-1">Map</label>
              <select
                value={browseMapFilter}
                onChange={(e) => setBrowseMapFilter(e.target.value)}
                className="bg-qw-darker border border-qw-border rounded px-3 py-2 text-white text-sm focus:border-qw-accent outline-none"
              >
                <option value="">All Maps</option>
                {['dm2', 'dm3', 'dm4', 'dm6', 'e1m2', 'aerowalk', 'ztndm3', 'skull'].map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            </div>
            <button
              onClick={async () => {
                if (!browseTeamTag.trim()) return;
                setBrowseLoading(true);
                setBrowseError(null);
                setBrowseResults([]);
                setBrowseSelected(new Set());
                try {
                  const opts = { limit: 30 };
                  if (browseMapFilter) opts.map = browseMapFilter;
                  if (browseDateFrom) {
                    const monthsAgo = Math.ceil(
                      (Date.now() - new Date(browseDateFrom).getTime()) / (30 * 24 * 60 * 60 * 1000)
                    );
                    if (monthsAgo > 0) opts.months = Math.min(monthsAgo + 1, 24);
                  }
                  const result = await QWStatsService.getForm(browseTeamTag.trim(), opts);
                  let games = result.games || [];
                  if (browseDateFrom) {
                    const from = new Date(browseDateFrom).getTime();
                    games = games.filter((g) => new Date(g.playedAt).getTime() >= from);
                  }
                  if (browseDateTo) {
                    const to = new Date(browseDateTo + 'T23:59:59').getTime();
                    games = games.filter((g) => new Date(g.playedAt).getTime() <= to);
                  }
                  setBrowseResults(games);
                } catch (err) {
                  setBrowseError(err.message);
                }
                setBrowseLoading(false);
              }}
              disabled={browseLoading || !browseTeamTag.trim()}
              className="qw-btn px-6 py-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {browseLoading ? 'Searching...' : 'SEARCH'}
            </button>
          </div>

          {browseError && (
            <div className="p-3 bg-red-900/30 border border-red-500/50 rounded text-red-300 text-sm">
              {browseError}
            </div>
          )}

          {browseResults.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-qw-muted text-sm">{browseResults.length} game(s) found</span>
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => {
                      if (browseSelected.size === browseResults.length) {
                        setBrowseSelected(new Set());
                      } else {
                        setBrowseSelected(new Set(browseResults.map((_, i) => i)));
                      }
                    }}
                    className="text-sm text-qw-accent hover:text-white"
                  >
                    {browseSelected.size === browseResults.length ? 'Deselect All' : 'Select All'}
                  </button>
                  {browseSelected.size > 0 && (
                    <button
                      onClick={() => {
                        const selectedGames = browseResults.filter((_, i) => browseSelected.has(i));
                        const teamTag = browseTeamTag.trim().toLowerCase();
                        const newMaps = selectedGames.map((game) => {
                          const team1 = teamTag;
                          const team2 = (game.opponent || 'unknown').toLowerCase();
                          const scores = {};
                          scores[team1] = game.teamFrags ?? 0;
                          scores[team2] = game.oppFrags ?? 0;
                          let timestamp = null;
                          if (game.playedAt) {
                            try {
                              timestamp = new Date(game.playedAt).getTime();
                            } catch (e) {
                              /* ignore */
                            }
                          }
                          return {
                            id: `browse-${game.id || game.demoSha256 || Date.now()}-${game.map}`,
                            date: game.playedAt || null,
                            timestamp,
                            map: game.map || 'unknown',
                            mode: '4on4',
                            duration: null,
                            teams: [team1, team2],
                            matchupId: [team1, team2].sort().join('vs'),
                            scores,
                            originalData: game,
                          };
                        });
                        const added = addMapsInBatch(newMaps);
                        if (added && added.length > 0) {
                          setLastImported(added);
                          setBrowseSelected(new Set());
                        }
                      }}
                      className="qw-btn px-4 py-1.5 text-sm"
                    >
                      Import Selected ({browseSelected.size})
                    </button>
                  )}
                </div>
              </div>

              <div className="space-y-2 max-h-[500px] overflow-y-auto">
                {browseResults.map((game, idx) => {
                  const isSelected = browseSelected.has(idx);
                  const isWin = game.result === 'win';
                  const isLoss = game.result === 'loss';
                  const dateStr = game.playedAt
                    ? new Date(game.playedAt).toLocaleDateString('sv-SE')
                    : '\u2014';
                  return (
                    <div
                      key={game.id || idx}
                      onClick={() => {
                        const next = new Set(browseSelected);
                        if (next.has(idx)) next.delete(idx);
                        else next.add(idx);
                        setBrowseSelected(next);
                      }}
                      className={`p-3 rounded border cursor-pointer transition-colors ${
                        isSelected
                          ? 'bg-qw-accent/10 border-qw-accent'
                          : 'bg-qw-dark border-qw-border hover:border-qw-muted'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-3 flex-1 min-w-0">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            readOnly
                            className="accent-qw-accent flex-shrink-0"
                          />
                          <span className="text-qw-muted text-xs font-mono w-20 flex-shrink-0">
                            {dateStr}
                          </span>
                          <span className="px-2 py-0.5 bg-qw-darker rounded text-xs font-mono text-qw-accent flex-shrink-0">
                            {game.map || '?'}
                          </span>
                          <span className="font-body font-semibold text-white truncate">
                            {browseTeamTag.trim().toLowerCase()}
                          </span>
                          <span className="px-2 py-0.5 bg-qw-darker rounded font-mono text-sm flex-shrink-0">
                            <span className={isWin ? 'text-qw-win font-bold' : ''}>
                              {game.teamFrags ?? '?'}
                            </span>
                            <span className="text-qw-muted mx-1">-</span>
                            <span className={isLoss ? 'text-qw-win font-bold' : ''}>
                              {game.oppFrags ?? '?'}
                            </span>
                          </span>
                          <span className="font-body font-semibold text-white truncate">
                            {game.opponent || '?'}
                          </span>
                        </div>
                        <span
                          className={`text-xs font-semibold px-2 py-0.5 rounded flex-shrink-0 ${
                            isWin
                              ? 'bg-qw-win/20 text-qw-win'
                              : isLoss
                                ? 'bg-qw-loss/20 text-qw-loss'
                                : 'bg-qw-darker text-qw-muted'
                          }`}
                        >
                          {isWin ? 'W' : isLoss ? 'L' : 'D'}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {browseResults.length === 0 && !browseLoading && !browseError && browseTeamTag && (
            <p className="text-qw-muted text-sm">
              Enter a team tag and click Search to find recent 4on4 games.
            </p>
          )}
        </div>
      ) : (
        // --- API FETCH UI (UPDATED) ---
        <div className="qw-panel p-6 space-y-4">
          <h3 className="font-display text-lg text-qw-accent">API FETCH</h3>
          <p className="text-sm text-qw-muted">
            Paste Game IDs or full URLs (up to 50) separated by spaces or newlines.
          </p>

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
            <div
              className={`text-sm font-mono ${apiStatus.includes('?') ? 'text-qw-win' : 'text-qw-accent'}`}
            >
              {apiStatus}
            </div>
          )}
        </div>
      )}

      {error && (
        <div className="p-4 bg-red-900/30 border border-red-500/50 rounded text-red-300 font-mono text-sm whitespace-pre-wrap">
          {error}
        </div>
      )}

      {lastImported.length > 0 && (
        <div className="qw-panel p-4 border-l-4 border-qw-win">
          <h4 className="font-display text-sm text-qw-win mb-2">
            ? IMPORTED {lastImported.length} MAP(S)
          </h4>
          <div className="text-sm text-qw-muted space-y-1 max-h-24 overflow-y-auto">
            {lastImported.map((m) => (
              <div key={m.id}>
                {resolveTeamName(m.teams[0])} {m.scores[m.teams[0]]}-{m.scores[m.teams[1]]}{' '}
                {resolveTeamName(m.teams[1])} ({m.map})
              </div>
            ))}
          </div>
        </div>
      )}

      {/* DETECTED SERIES (UNCHANGED) */}
      {detectedSeries.length > 0 && (
        <div className="qw-panel p-6">
          <h3 className="font-display text-lg text-qw-accent mb-4">
            DETECTED SERIES ({detectedSeries.length})
          </h3>
          <p className="text-sm text-qw-muted mb-4">Maps grouped by matchup and time.</p>

          <div className="space-y-3">
            {detectedSeries.map((series) => {
              const [t1, t2] = series.resolvedTeams;
              const w1 = series.score[t1] || 0;
              const w2 = series.score[t2] || 0;
              const f1 = series.frags?.[t1] || 0;
              const f2 = series.frags?.[t2] || 0;

              return (
                <div
                  key={series.id}
                  className={`p-4 rounded border ${series.isLinked ? 'bg-qw-win/10 border-qw-win/50' : 'bg-qw-dark border-qw-border'}`}
                >
                  <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
                    <div className="flex items-center gap-3 flex-wrap">
                      <span
                        className={`font-body font-semibold ${w1 > w2 ? 'text-qw-win' : 'text-white'}`}
                      >
                        {t1}
                      </span>
                      <span className="px-2 py-1 bg-qw-darker rounded font-mono">
                        <span className={w1 > w2 ? 'text-qw-win font-bold' : ''}>{w1}</span>
                        <span className="text-qw-muted mx-1">-</span>
                        <span className={w2 > w1 ? 'text-qw-win font-bold' : ''}>{w2}</span>
                      </span>
                      <span
                        className={`font-body font-semibold ${w2 > w1 ? 'text-qw-win' : 'text-white'}`}
                      >
                        {t2}
                      </span>
                      <span className="text-qw-muted text-sm">({series.maps.length} maps)</span>
                      <span
                        className="px-2 py-0.5 bg-qw-darker rounded text-xs font-mono"
                        title="Total frags"
                      >
                        <span className={f1 > f2 ? 'text-qw-accent' : 'text-qw-muted'}>{f1}</span>
                        <span className="text-qw-muted mx-1">-</span>
                        <span className={f2 > f1 ? 'text-qw-accent' : 'text-qw-muted'}>{f2}</span>
                        <span className="text-qw-muted ml-1">frags</span>
                      </span>
                      {series.dateDisplay && (
                        <span className="text-qw-muted text-xs bg-qw-darker px-2 py-0.5 rounded">
                          {series.dateDisplay}
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      {series.isLinked ? (
                        <span className="text-qw-win text-sm">? Linked</span>
                      ) : series.scheduledMatch ? (
                        <button
                          onClick={() => linkSeriesToMatch(series, series.scheduledMatch.id)}
                          className="px-3 py-1 rounded bg-qw-accent text-qw-dark text-sm font-semibold"
                        >
                          Link to Match
                        </button>
                      ) : (
                        <div className="flex items-center gap-2">
                          {unlinkableMatches.length > 0 && (
                            <select
                              onChange={(e) =>
                                e.target.value && linkSeriesToMatch(series, e.target.value)
                              }
                              className="bg-qw-darker border border-qw-border rounded px-2 py-1 text-sm text-white"
                              defaultValue=""
                            >
                              <option value="" disabled>
                                Link to...
                              </option>
                              {unlinkableMatches.map((m) => (
                                <option key={m.id} value={m.id}>
                                  {m.team1} vs {m.team2}
                                </option>
                              ))}
                            </select>
                          )}
                          <button
                            onClick={() => createMatchFromSeries(series)}
                            className="px-3 py-1 rounded border border-qw-accent text-qw-accent text-sm hover:bg-qw-accent hover:text-qw-dark"
                          >
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
                    {series.maps.map((map) => {
                      const [o1, o2] = map.teams;
                      const ms1 = map.scores[o1] || 0;
                      const ms2 = map.scores[o2] || 0;
                      return (
                        <span
                          key={map.id}
                          className="px-2 py-1 bg-qw-darker rounded text-xs font-mono"
                        >
                          {map.map}: <span className={ms1 > ms2 ? 'text-qw-win' : ''}>{ms1}</span>-
                          <span className={ms2 > ms1 ? 'text-qw-win' : ''}>{ms2}</span>
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
              <span className="text-xs text-qw-muted">(detailed stats from imported matches)</span>
            </div>
            <span
              className={`text-qw-accent transition-transform duration-200 ${showStats ? 'rotate-180' : ''}`}
            >
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

      {/* RAW MAPS - Collapsible Section */}
      <div className="qw-panel overflow-hidden">
        <button
          onClick={() => setShowRawMaps(!showRawMaps)}
          className="w-full flex items-center justify-between px-6 py-4 bg-qw-dark border-b border-qw-border hover:bg-qw-dark/80 transition-colors"
        >
          <div className="flex items-center gap-3">
            <span className="text-xl">🗺️</span>
            <h3 className="font-display text-lg text-qw-accent">RAW MAPS ({rawMaps.length})</h3>
          </div>
          <span
            className={`text-qw-accent transition-transform duration-200 ${showRawMaps ? 'rotate-180' : ''}`}
          >
            ▼
          </span>
        </button>
        {showRawMaps && (
          <div className="p-6">
            {rawMaps.length === 0 ? (
              <div className="text-center py-8 text-qw-muted">
                <div className="text-4xl mb-2">?</div>
                <p>No results imported yet</p>
              </div>
            ) : (
              <div className="space-y-1 max-h-48 overflow-y-auto">
                {rawMaps
                  .slice()
                  .reverse()
                  .map((map) => (
                    <div
                      key={map.id}
                      className="flex items-center justify-between p-2 bg-qw-dark rounded text-sm"
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-qw-muted font-mono text-xs">{map.map}</span>
                        <span className="text-white">
                          {resolveTeamName(map.teams[0])}{' '}
                          <span className="text-qw-accent">
                            {map.scores[map.teams[0]]}-{map.scores[map.teams[1]]}
                          </span>{' '}
                          {resolveTeamName(map.teams[1])}
                        </span>
                      </div>
                      <span className="text-qw-muted text-xs">{map.date?.split(' ')[0]}</span>
                    </div>
                  ))}
              </div>
            )}
          </div>
        )}
      </div>

      {pendingConfirm && (
        <ConfirmModal
          title={pendingConfirm.title}
          body={pendingConfirm.body}
          confirmLabel={pendingConfirm.confirmLabel}
          variant={pendingConfirm.variant}
          onConfirm={() => {
            pendingConfirm.onConfirm();
            setPendingConfirm(null);
          }}
          onCancel={() => setPendingConfirm(null)}
        />
      )}
    </div>
  );
}
