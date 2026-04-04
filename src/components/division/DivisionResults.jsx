// src/components/division/DivisionResults.jsx
import React, { useState, useRef, useMemo, useCallback, useEffect } from 'react';
import ConfirmModal from '../ConfirmModal';
import { parseMatch, unicodeToAscii } from '../../utils/matchLogic';
import {
  createTeamContext,
  resolveTeam as resolveTeamIdentity,
  resolveTeamFull,
} from '../../utils/teamIdentity';
import { scheduleWikiPublish } from '../../services/wikiPublisher';
import { supabase } from '../../services/supabaseClient';
import DivisionStats from './DivisionStats';
import ResultsPendingQueue from './ResultsPendingQueue';
import AddResultsPanel from './AddResultsPanel';

export default function DivisionResults({
  division,
  updateDivision,
  updateAnyDivision,
  tournamentId,
  tournament,
}) {
  const [showStats, setShowStats] = useState(false);
  const [showRawMaps, setShowRawMaps] = useState(false);
  const [showApprovedResults, setShowApprovedResults] = useState(false);
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

  // ── Auth ────────────────────────────────────────────────────────────────────

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

  // ── Division data ────────────────────────────────────────────────────────────

  const teams = division.teams || [];
  const schedule = division.schedule || [];
  const rawMaps = division.rawMaps || [];

  // ── Team resolution ──────────────────────────────────────────────────────────

  const teamsJson = JSON.stringify(
    teams.map((t) => ({ name: t.name, tag: t.tag, aliases: t.aliases }))
  );
  const teamCtx = useMemo(() => createTeamContext(teams), [teamsJson]);

  const resolveTeamName = useCallback(
    (jsonTeamName) => resolveTeamIdentity(jsonTeamName, teamCtx),
    [teamCtx]
  );

  // ── Division detection (for submission routing) ──────────────────────────────

  const detectSubmissionDivision = useCallback(
    (submission) => {
      if (!submission?.game_data?.teams || !tournament?.divisions) return null;
      const gameTeams = submission.game_data.teams
        .map((t) => (typeof t === 'object' ? t.name : t))
        .filter(Boolean);
      if (gameTeams.length === 0) return null;
      const matchingDivisions = [];
      tournament.divisions.forEach((div) => {
        const divTeams = div.teams || [];
        if (divTeams.length === 0) return;
        const divCtx = createTeamContext(divTeams);
        const matchCount = gameTeams.filter(
          (gt) => resolveTeamFull(gt, divCtx).match !== null
        ).length;
        if (matchCount === gameTeams.length) matchingDivisions.push(div);
      });
      return matchingDivisions.length > 0 ? matchingDivisions : null;
    },
    [tournament]
  );

  const getTargetDiv = (submission) => {
    const detected = detectSubmissionDivision(submission);
    if (!detected || detected.length !== 1) return null;
    const target = detected[0];
    return target.id !== division.id ? target : null;
  };

  // ── Series detection ─────────────────────────────────────────────────────────

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

  // ── Core map batch logic ─────────────────────────────────────────────────────

  const addMapsInBatch = (newMaps, targetDiv = null) => {
    const tDiv = targetDiv || division;
    const tRawMaps = tDiv.rawMaps || [];
    const tSchedule = tDiv.schedule || [];
    const tCtx = targetDiv ? createTeamContext(targetDiv.teams || []) : teamCtx;
    const tResolve = (name) => resolveTeamIdentity(name, tCtx);

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
      const baseId = String(m.id)
        .replace(/^browse-/, '')
        .replace(/-[^-]+$/, '');
      if (existingBaseIds.has(baseId)) return false;
      return true;
    });

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
        const mapTs = mapResult.timestamp || null;
        if (mapTs) {
          let bestAffinityDist = Infinity;
          candidateIndices.forEach((idx) => {
            const existingMaps = newSchedule[idx].maps || [];
            if (existingMaps.length === 0) return;
            for (const em of existingMaps) {
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
        if (!match.maps?.some((mp) => mp.id === mapResult.id)) {
          const isNormalOrder = match.team1.toLowerCase() === res1Lower;
          const rawScore1 = isNormalOrder ? mapResult.scores[team1] : mapResult.scores[team2];
          const rawScore2 = isNormalOrder ? mapResult.scores[team2] : mapResult.scores[team1];
          const score1 = rawScore1 ?? 0;
          const score2 = rawScore2 ?? 0;
          match.maps = [
            ...(match.maps || []),
            { id: mapResult.id, map: mapResult.map, date: mapResult.date, score1, score2 },
          ];
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

    if (targetDiv && updateAnyDivision) {
      updateAnyDivision(targetDiv.id, { rawMaps: allMaps, schedule: newSchedule });
    } else {
      updateDivision({ rawMaps: allMaps, schedule: newSchedule });
    }

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

  // ── Submission handlers (called from ResultsPendingQueue) ────────────────────

  const handleApprove = async (submission) => {
    const gameData = submission.game_data;
    let parsed = null;
    if (gameData) parsed = parseMatch(submission.game_id, gameData);

    const authHeaders = await getAuthHeaders();
    const res = await fetch(`/api/submission/${submission.id}/approve`, {
      method: 'POST',
      headers: authHeaders,
    });
    if (!res.ok) throw new Error('Failed to approve');
    if (parsed) addMapsInBatch([parsed], getTargetDiv(submission));
  };

  const handleReject = async (submission) => {
    const authHeaders = await getAuthHeaders();
    const res = await fetch(`/api/submission/${submission.id}/reject`, {
      method: 'POST',
      headers: authHeaders,
    });
    if (!res.ok) throw new Error('Failed to reject');
  };

  const handleReprocess = (submission) => {
    const gameData = submission.game_data;
    if (gameData) {
      const parsed = parseMatch(submission.game_id, gameData);
      if (parsed) addMapsInBatch([parsed], getTargetDiv(submission));
    }
  };

  // IMPORTANT (CLAUDE.md #15): collect all maps FIRST, then call addMapsInBatch ONCE per division
  const handleBulkApprove = async (pending) => {
    const byDiv = new Map();
    const authHeaders = await getAuthHeaders();
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
      } catch (err) {
        console.error(err);
      }
    }
    for (const { targetDiv, parsed } of byDiv.values()) {
      addMapsInBatch(parsed, targetDiv);
    }
  };

  // IMPORTANT (CLAUDE.md #15): batch maps per division, call addMapsInBatch ONCE each
  const handleBulkReprocess = (approved) => {
    const byDiv = new Map();
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
    for (const { targetDiv, parsed } of byDiv.values()) {
      addMapsInBatch(parsed, targetDiv);
    }
  };

  // ── AddResultsPanel import callback ─────────────────────────────────────────

  const handleImport = (maps) => {
    const added = addMapsInBatch(maps);
    if (added?.length > 0) setLastImported(added);
  };

  // ── Series management ────────────────────────────────────────────────────────

  const linkSeriesToMatch = (series, matchId) => {
    const match = schedule.find((m) => m.id === matchId);
    if (!match) return;
    const [res1, res2] = series.resolvedTeams;
    const matchT1Resolved = resolveTeamName(match.team1).toLowerCase();
    const isNormalOrder = matchT1Resolved === res1.toLowerCase();

    const newSchedule = schedule.map((m) => {
      if (m.id !== matchId) return m;
      const maps = series.maps.map((map) => {
        const [mapT1, mapT2] = map.teams;
        const mapT1Resolved = resolveTeamName(mapT1);
        const mapT1IsRes1 = mapT1Resolved.toLowerCase() === res1.toLowerCase();
        const mapScore1 = map.scores[mapT1] || 0;
        const mapScore2 = map.scores[mapT2] || 0;
        const scoreRes1 = mapT1IsRes1 ? mapScore1 : mapScore2;
        const scoreRes2 = mapT1IsRes1 ? mapScore2 : mapScore1;
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
      roundNum: 1,
      meeting: 1,
      bestOf: series.maps.length,
      date: series.maps[0]?.date?.split(' ')[0] || '',
      time: '',
      status: 'completed',
      maps: series.maps.map((map) => {
        const [mapT1, mapT2] = map.teams;
        const mapT1Resolved = resolveTeamName(mapT1);
        const mapT1IsRes1 = mapT1Resolved.toLowerCase() === res1.toLowerCase();
        const mapScore1 = map.scores[mapT1] || 0;
        const mapScore2 = map.scores[mapT2] || 0;
        const score1 = mapT1IsRes1 ? mapScore1 : mapScore2;
        const score2 = mapT1IsRes1 ? mapScore2 : mapScore1;
        return { id: map.id, map: map.map, date: map.date, score1, score2 };
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
    const newRawMaps = rawMaps.filter((m) => !seriesToRemove.has(m.id));
    let newSchedule = [...schedule];
    if (series.isLinked && series.scheduledMatch) {
      newSchedule = schedule.map((m) => {
        if (m.id !== series.scheduledMatch.id) return m;
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
      });
    }
    updateDivision({ rawMaps: newRawMaps, schedule: newSchedule });
  };

  const unlinkableMatches = schedule.filter((m) => !m.maps || m.maps.length === 0);

  // ── Render ───────────────────────────────────────────────────────────────────

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

      {/* Primary surface: pending Discord submissions */}
      <ResultsPendingQueue
        tournamentId={tournamentId}
        division={division}
        tournament={tournament}
        onApprove={handleApprove}
        onReject={handleReject}
        onApproveAll={handleBulkApprove}
        onReprocess={handleReprocess}
        onBulkReprocess={handleBulkReprocess}
        detectSubmissionDivision={detectSubmissionDivision}
      />

      {/* Last-import summary */}
      {lastImported.length > 0 && (
        <div className="qw-panel p-4 border-l-4 border-qw-win">
          <h4 className="font-display text-sm text-qw-win mb-2">
            ✓ IMPORTED {lastImported.length} MAP(S)
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

      {/* Approved results list — collapsed by default */}
      {detectedSeries.length > 0 && (
        <div className="qw-panel overflow-hidden">
          <button
            onClick={() => setShowApprovedResults((v) => !v)}
            className="w-full flex items-center justify-between px-6 py-4 bg-qw-dark border-b border-qw-border hover:bg-qw-dark/80 transition-colors"
          >
            <div className="flex items-center gap-3">
              <h3 className="font-display text-lg text-qw-accent">
                APPROVED RESULTS ({detectedSeries.length} series)
              </h3>
              {rawMaps.length > 0 && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleClearResults();
                  }}
                  className="text-xs text-red-400 hover:text-red-300 ml-2"
                >
                  Clear All
                </button>
              )}
            </div>
            <span
              className={`text-qw-accent transition-transform duration-200 ${showApprovedResults ? 'rotate-180' : ''}`}
            >
              ▼
            </span>
          </button>

          {showApprovedResults && (
            <div className="p-6 space-y-3">
              <p className="text-sm text-qw-muted">Maps grouped by matchup and time.</p>
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
                          <span className="text-qw-win text-sm">✓ Linked</span>
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
                            {map.map}: <span className={ms1 > ms2 ? 'text-qw-win' : ''}>{ms1}</span>
                            -<span className={ms2 > ms1 ? 'text-qw-win' : ''}>{ms2}</span>
                          </span>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Add results: collapsed panel with question flow */}
      <AddResultsPanel
        division={division}
        tournament={tournament}
        tournamentId={tournamentId}
        onImport={handleImport}
      />

      {/* Player Stats — expandable */}
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

      {/* Raw Maps — collapsible */}
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
                <div className="text-4xl mb-2">🗺️</div>
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
