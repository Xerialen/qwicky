// src/components/division/DivisionSchedule.jsx
import React, { useState, useMemo, useRef } from 'react';

// Polygon (circle) method: produces N-1 rounds (N even) where every team
// plays exactly once per round. Odd team counts get a null bye placeholder.
function buildRoundRobinRounds(teamList) {
  const n = teamList.length;
  if (n < 2) return [];
  const padded = n % 2 !== 0 ? [...teamList, null] : [...teamList];
  const size = padded.length;
  const rotating = padded.slice(1);
  const rounds = [];

  for (let r = 0; r < size - 1; r++) {
    const roundMatches = [];
    // Fixed team vs last in rotation
    if (padded[0] !== null && rotating[rotating.length - 1] !== null) {
      roundMatches.push([padded[0], rotating[rotating.length - 1]]);
    }
    // Mirror pairs from the rest of the rotation
    for (let i = 0; i < Math.floor((rotating.length - 1) / 2); i++) {
      const a = rotating[i];
      const b = rotating[rotating.length - 2 - i];
      if (a !== null && b !== null) {
        roundMatches.push([a, b]);
      }
    }
    rounds.push(roundMatches);
    // Rotate: last element wraps to front
    const last = rotating.pop();
    rotating.unshift(last);
  }
  return rounds;
}

// Given a tournament start date and a round index, compute the date
// for that round based on the division's match pace setting.
function dateForRound(startDate, roundIndex, pace) {
  if (!startDate) return '';
  const daysPerRound = { daily: 1, 'twice-weekly': 4, weekly: 7, biweekly: 14 };
  const interval = daysPerRound[pace];
  if (!interval) return '';                          // 'flexible' → no date
  const d = new Date(startDate + 'T00:00:00');      // force local midnight, avoid tz shift
  d.setDate(d.getDate() + roundIndex * interval);
  return d.toISOString().split('T')[0];
}

export default function DivisionSchedule({ division, updateDivision, tournamentStartDate }) {
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingMatch, setEditingMatch] = useState(null);
  const [newMatch, setNewMatch] = useState({
    team1: '', team2: '', date: '', time: '', group: '', round: 'group'
  });
  const [draggedMatchId, setDraggedMatchId] = useState(null);
  const [dragOverRound, setDragOverRound] = useState(null);
  const dragGroupRef = useRef(null);

  const teams = division.teams || [];
  const schedule = division.schedule || [];

  const groups = useMemo(() => {
    return Array.from({ length: division.numGroups }, (_, i) => String.fromCharCode(65 + i));
  }, [division.numGroups]);

  const getDefaultBestOf = (round) => {
    switch (round) {
      case 'group': return division.groupStageBestOf;
      case 'quarter': return division.playoffQFBestOf || 3;
      case 'semi': return division.playoffSFBestOf || 3;
      case 'final': return division.playoffFinalBestOf;
      case 'third': return division.playoff3rdBestOf || 3;
      default: return 3;
    }
  };

  // Generate group schedule in round-robin waves: every team plays once
  // per round before any team plays again. Dates are prepopulated when the
  // tournament has a start date and the pace is not 'flexible'.
  const generateGroupSchedule = () => {
    const teamsByGroup = {};
    groups.forEach(g => teamsByGroup[g] = []);

    teams.forEach(team => {
      if (team.group && teamsByGroup[team.group]) {
        teamsByGroup[team.group].push(team);
      }
    });

    const unassignedCount = teams.filter(t => !t.group).length;
    if (unassignedCount > 0) {
      alert(`${unassignedCount} team(s) are not assigned to groups. Please assign all teams first in the Teams tab.`);
      return;
    }

    const meetings = division.groupMeetings || 1;
    const pace = division.matchPace || 'weekly';
    const newSchedule = [];
    let matchId = Date.now();

    for (const [groupName, groupTeams] of Object.entries(teamsByGroup)) {
      if (groupTeams.length < 2) continue;

      const rounds = buildRoundRobinRounds(groupTeams);

      for (let meeting = 0; meeting < meetings; meeting++) {
        const offset = meeting * rounds.length;

        rounds.forEach((roundMatches, roundIdx) => {
          const globalRound = offset + roundIdx;
          const date = dateForRound(tournamentStartDate, globalRound, pace);

          roundMatches.forEach(([teamA, teamB]) => {
            // Swap sides in even-numbered meetings for variety
            const t1 = meeting % 2 === 0 ? teamA : teamB;
            const t2 = meeting % 2 === 0 ? teamB : teamA;

            newSchedule.push({
              id: `match-${matchId++}-${groupName}`,
              team1: t1.name,
              team2: t2.name,
              group: groupName,
              round: 'group',
              roundNum: globalRound + 1,
              meeting: meeting + 1,
              bestOf: division.groupStageBestOf,
              date,
              time: '',
              status: 'scheduled',
              maps: []
            });
          });
        });
      }
    }

    if (newSchedule.length === 0) {
      alert('No matches to generate. Make sure teams are assigned to groups.');
      return;
    }

    if (window.confirm(`Generate ${newSchedule.length} group stage matches (${meetings}x round-robin)? This replaces existing schedule.`)) {
      updateDivision({ schedule: newSchedule });
    }
  };

  const handleAddMatch = (e) => {
    e.preventDefault();
    if (!newMatch.team1 || !newMatch.team2 || newMatch.team1 === newMatch.team2) {
      alert('Select two different teams');
      return;
    }

    const match = {
      id: `match-${Date.now()}`,
      team1: newMatch.team1,
      team2: newMatch.team2,
      group: newMatch.group,
      round: newMatch.round,
      bestOf: getDefaultBestOf(newMatch.round),
      date: newMatch.date,
      time: newMatch.time,
      status: 'scheduled',
      maps: []
    };

    updateDivision({ schedule: [...schedule, match] });
    setNewMatch({ team1: '', team2: '', date: '', time: '', group: '', round: 'group' });
    setShowAddForm(false);
  };

  const handleUpdateMatch = (matchId, updates) => {
    updateDivision({
      schedule: schedule.map(m => m.id === matchId ? { ...m, ...updates } : m)
    });
  };

  const handleRemoveMatch = (matchId) => {
    updateDivision({ schedule: schedule.filter(m => m.id !== matchId) });
  };

  const handleDragStart = (e, match) => {
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', match.id);
    dragGroupRef.current = match.group;
    requestAnimationFrame(() => setDraggedMatchId(match.id));
  };

  const handleDragEnd = () => {
    setDraggedMatchId(null);
    dragGroupRef.current = null;
    setDragOverRound(null);
  };

  const handleRoundDragOver = (e, groupName, roundNum) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (dragGroupRef.current === groupName) {
      setDragOverRound({ group: groupName, roundNum });
    }
  };

  const handleRoundDrop = (e, groupName, roundNum) => {
    e.preventDefault();
    setDragOverRound(null);
    setDraggedMatchId(null);
    dragGroupRef.current = null;

    const matchId = e.dataTransfer.getData('text/plain');
    if (!matchId) return;

    const sourceMatch = schedule.find(m => m.id === matchId);
    if (!sourceMatch || sourceMatch.group !== groupName || sourceMatch.roundNum === roundNum) return;

    const pace = division.matchPace || 'weekly';
    const newDate = dateForRound(tournamentStartDate, roundNum - 1, pace);

    const updates = { roundNum };
    if (newDate) updates.date = newDate;

    handleUpdateMatch(matchId, updates);
  };

  const groupedMatches = useMemo(() => {
    const grouped = { groups: {}, playoffs: [] };
    
    schedule.forEach(match => {
      if (match.round === 'group' && match.group) {
        if (!grouped.groups[match.group]) grouped.groups[match.group] = [];
        grouped.groups[match.group].push(match);
      } else {
        grouped.playoffs.push(match);
      }
    });

    return grouped;
  }, [schedule]);

  const rounds = [
    { id: 'group', label: 'Group Stage' },
    ...(division.playoffQFBestOf > 0 ? [{ id: 'quarter', label: 'Quarter Final' }] : []),
    ...(division.playoffSFBestOf > 0 ? [{ id: 'semi', label: 'Semi Final' }] : []),
    { id: 'final', label: 'Grand Final' },
    ...(division.playoff3rdBestOf > 0 ? [{ id: 'third', label: '3rd Place' }] : []),
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex gap-2">
          <button onClick={generateGroupSchedule} className="px-4 py-2 rounded border border-qw-border text-qw-muted hover:text-white hover:border-qw-accent">
            🎲 Generate Groups
          </button>
          <button onClick={() => setShowAddForm(!showAddForm)} className="qw-btn">
            + Add Match
          </button>
        </div>
        {schedule.length > 0 && (
          <button
            onClick={() => {
              if (window.confirm('Clear all scheduled matches?')) {
                updateDivision({ schedule: [] });
              }
            }}
            className="text-sm text-red-400 hover:text-red-300"
          >
            Clear All
          </button>
        )}
      </div>

      {/* Info about group assignments */}
      {teams.length > 0 && (
        <div className="p-3 bg-qw-dark rounded border border-qw-border text-sm">
          <span className="text-qw-muted">
            Teams: {teams.filter(t => t.group).length}/{teams.length} assigned to groups
            {' • '}
            Format: {division.groupMeetings || 1}× round-robin (Bo{division.groupStageBestOf})
            {' • '}
            Pace: {division.matchPace || 'weekly'}
            {tournamentStartDate && <span> • Dates from: {tournamentStartDate}</span>}
            {schedule.length > 0 && (
              <span>
                {' • '}
                <span className="text-white font-semibold">{schedule.length}</span> matches
                {' • '}
                <span className="text-qw-win">{schedule.filter(m => m.status === 'completed').length}</span> played
                {' • '}
                {schedule.filter(m => m.status !== 'completed').length} pending
              </span>
            )}
          </span>
        </div>
      )}

      {showAddForm && (
        <form onSubmit={handleAddMatch} className="qw-panel p-6">
          <h3 className="font-display text-lg text-qw-accent mb-4">ADD MATCH</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-qw-muted text-sm mb-1">Team 1</label>
              <select value={newMatch.team1} onChange={(e) => setNewMatch({ ...newMatch, team1: e.target.value })} className="w-full bg-qw-dark border border-qw-border rounded px-3 py-2 text-white" required>
                <option value="">Select...</option>
                {teams.map(t => <option key={t.id} value={t.name}>{t.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-qw-muted text-sm mb-1">Team 2</label>
              <select value={newMatch.team2} onChange={(e) => setNewMatch({ ...newMatch, team2: e.target.value })} className="w-full bg-qw-dark border border-qw-border rounded px-3 py-2 text-white" required>
                <option value="">Select...</option>
                {teams.filter(t => t.name !== newMatch.team1).map(t => <option key={t.id} value={t.name}>{t.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-qw-muted text-sm mb-1">Round</label>
              <select value={newMatch.round} onChange={(e) => setNewMatch({ ...newMatch, round: e.target.value })} className="w-full bg-qw-dark border border-qw-border rounded px-3 py-2 text-white">
                {rounds.map(r => <option key={r.id} value={r.id}>{r.label}</option>)}
              </select>
            </div>
            {newMatch.round === 'group' && (
              <div>
                <label className="block text-qw-muted text-sm mb-1">Group</label>
                <select value={newMatch.group} onChange={(e) => setNewMatch({ ...newMatch, group: e.target.value })} className="w-full bg-qw-dark border border-qw-border rounded px-3 py-2 text-white">
                  <option value="">Select...</option>
                  {groups.map(g => <option key={g} value={g}>Group {g}</option>)}
                </select>
              </div>
            )}
            <div>
              <label className="block text-qw-muted text-sm mb-1">Date</label>
              <input type="date" value={newMatch.date} onChange={(e) => setNewMatch({ ...newMatch, date: e.target.value })} className="w-full bg-qw-dark border border-qw-border rounded px-3 py-2 text-white" />
            </div>
            <div>
              <label className="block text-qw-muted text-sm mb-1">Time</label>
              <input type="time" value={newMatch.time} onChange={(e) => setNewMatch({ ...newMatch, time: e.target.value })} className="w-full bg-qw-dark border border-qw-border rounded px-3 py-2 text-white" />
            </div>
          </div>
          <div className="flex gap-2 mt-4">
            <button type="submit" className="qw-btn">Add Match</button>
            <button type="button" onClick={() => setShowAddForm(false)} className="px-4 py-2 text-qw-muted hover:text-white">Cancel</button>
          </div>
        </form>
      )}

      {schedule.length === 0 ? (
        <div className="qw-panel p-12 text-center">
          <div className="text-6xl mb-4">📅</div>
          <h3 className="font-display text-xl text-white mb-2">No Matches Scheduled</h3>
          <p className="text-qw-muted">Assign teams to groups, then generate schedule</p>
        </div>
      ) : (
        <>
          {Object.keys(groupedMatches.groups).length > 0 && (
            <div className="space-y-4">
              <h3 className="font-display text-lg text-qw-accent">GROUP STAGE</h3>
              <div className={`grid gap-4 ${Object.keys(groupedMatches.groups).length > 1 ? 'grid-cols-1 md:grid-cols-2' : ''}`}>
                {Object.entries(groupedMatches.groups).sort().map(([groupName, matches]) => {
                  // Bucket matches by round so we can render wave headers
                  const byRound = {};
                  matches.forEach(m => {
                    const rn = m.roundNum || 1;
                    if (!byRound[rn]) byRound[rn] = [];
                    byRound[rn].push(m);
                  });
                  const roundNums = Object.keys(byRound).map(Number).sort((a, b) => a - b);
                  const showRoundHeaders = roundNums.length > 1;

                  return (
                    <div key={groupName} className="qw-panel overflow-hidden">
                      <div className="bg-qw-dark px-4 py-2 border-b border-qw-border flex justify-between">
                        <h4 className="font-display font-bold text-white">Group {groupName}</h4>
                        <span className="text-xs text-qw-muted">{matches.length} matches</span>
                      </div>
                      <div className="max-h-[70vh] overflow-y-auto">
                        {roundNums.map(rn => {
                          const isDropTarget = dragOverRound?.group === groupName && dragOverRound?.roundNum === rn;
                          return (
                            <div
                              key={rn}
                              onDragOver={(e) => handleRoundDragOver(e, groupName, rn)}
                              onDrop={(e) => handleRoundDrop(e, groupName, rn)}
                              className={isDropTarget ? 'bg-qw-accent/10 ring-1 ring-inset ring-qw-accent/40' : ''}
                            >
                              {showRoundHeaders && (
                                <div className="px-3 py-1 bg-qw-darker border-b border-qw-border/50 flex items-center gap-2">
                                  <span className="text-xs font-mono text-qw-accent">Round {rn}</span>
                                  {byRound[rn][0]?.date && (
                                    <span className="text-xs font-mono text-qw-muted">— {byRound[rn][0].date}</span>
                                  )}
                                  {isDropTarget && <span className="text-xs text-qw-accent/70 ml-auto">↓ drop here</span>}
                                </div>
                              )}
                              <div className="divide-y divide-qw-border">
                                {byRound[rn].map(match => (
                                  <MatchRow
                                    key={match.id}
                                    match={match}
                                    onUpdate={handleUpdateMatch}
                                    onRemove={handleRemoveMatch}
                                    isEditing={editingMatch === match.id}
                                    setEditing={setEditingMatch}
                                    showDragHandle={showRoundHeaders}
                                    isDragging={draggedMatchId === match.id}
                                    onDragStart={(e) => handleDragStart(e, match)}
                                    onDragEnd={handleDragEnd}
                                    division={division}
                                  />
                                ))}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {groupedMatches.playoffs.length > 0 && (
            <div className="space-y-4">
              <h3 className="font-display text-lg text-qw-accent">PLAYOFFS</h3>
              <div className="qw-panel overflow-hidden">
                <div className="divide-y divide-qw-border">
                  {groupedMatches.playoffs.map(match => (
                    <MatchRow key={match.id} match={match} onUpdate={handleUpdateMatch} onRemove={handleRemoveMatch} isEditing={editingMatch === match.id} setEditing={setEditingMatch} showRound division={division} />
                  ))}
                </div>
              </div>
            </div>
          )}
        </>
      )}

    </div>
  );
}

function MatchRow({ match, onUpdate, onRemove, isEditing, setEditing, showRound, showDragHandle, isDragging, onDragStart, onDragEnd, division }) {
  const score = (() => {
    if (!match.maps || match.maps.length === 0) return null;
    let t1 = 0, t2 = 0;
    match.maps.forEach(m => {
      if (m.score1 > m.score2) t1++;
      else if (m.score2 > m.score1) t2++;
    });
    return { t1, t2 };
  })();

  return (
    <div
      className={`p-2 hover:bg-qw-dark/50 transition-colors group text-sm ${showDragHandle ? 'cursor-grab active:cursor-grabbing' : ''} ${isDragging ? 'opacity-40' : ''} ${match.status === 'scheduled' ? 'bg-blue-950/20' : ''}`}
      draggable={!!showDragHandle}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 flex-1">
          {showDragHandle && <span className="text-qw-muted/40 select-none text-xs">⠿</span>}
          <div className="w-16 text-xs text-qw-muted font-mono">
            <div>{match.date || 'TBD'}</div>
          </div>
          {showRound && <span className="px-1.5 py-0.5 bg-qw-accent/20 text-qw-accent text-xs rounded uppercase">{match.round}</span>}
          {match.meeting > 1 && <span className="text-qw-muted text-xs">#{match.meeting}</span>}
          <div className="flex items-center gap-1.5 flex-1">
            <span className={`font-body ${score?.t1 > score?.t2 ? 'text-qw-win font-semibold' : 'text-white'}`}>{match.team1}</span>
            {score ? (
              <span className="px-1.5 py-0.5 bg-qw-dark rounded font-mono text-xs">
                <span className={score.t1 > score.t2 ? 'text-qw-win' : ''}>{score.t1}</span>
                <span className="text-qw-muted mx-0.5">-</span>
                <span className={score.t2 > score.t1 ? 'text-qw-win' : ''}>{score.t2}</span>
              </span>
            ) : <span className="text-qw-muted text-xs">vs</span>}
            <span className={`font-body ${score?.t2 > score?.t1 ? 'text-qw-win font-semibold' : 'text-white'}`}>{match.team2}</span>
            {match.forfeit && (
              <span className="px-1.5 py-0.5 bg-red-900/30 border border-red-500/50 text-red-300 text-xs rounded font-semibold">FF</span>
            )}
            {!match.forfeit && match.maps?.some(m => m.forfeit) && (
              <span className="px-1.5 py-0.5 bg-orange-900/30 border border-orange-500/50 text-orange-300 text-xs rounded font-semibold">Map FF</span>
            )}
          </div>
          {match.status === 'scheduled' && (
            <span className="text-blue-400 text-xs" title="Scheduled">📅</span>
          )}
          {match.status === 'live' && (
            <span className="text-red-400 text-xs animate-pulse" title="Live">🔴</span>
          )}
          {match.status === 'completed' && (
            <span className="text-green-400 text-xs" title="Completed">✓</span>
          )}
          <span className="text-qw-muted text-xs">
            {match.round === 'group' && division?.groupStageType === 'playall' ? 'Go' : 'Bo'}{match.bestOf}
          </span>
        </div>
        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button onClick={() => setEditing(isEditing ? null : match.id)} className="p-1 text-qw-muted hover:text-white text-xs">✏️</button>
          <button onClick={() => onRemove(match.id)} className="p-1 text-red-400 hover:text-red-300 text-xs">✕</button>
        </div>
      </div>
      {isEditing && (
        <div className="mt-2 pt-2 border-t border-qw-border space-y-2">
          <div className="grid grid-cols-5 gap-2">
            <input type="date" value={match.date} onChange={(e) => onUpdate(match.id, { date: e.target.value })} className="bg-qw-darker border border-qw-border rounded px-2 py-1 text-white text-xs" />
            <input type="time" value={match.time} onChange={(e) => onUpdate(match.id, { time: e.target.value })} className="bg-qw-darker border border-qw-border rounded px-2 py-1 text-white text-xs" />
            <select value={match.round || 'group'} onChange={(e) => onUpdate(match.id, { round: e.target.value })} className="bg-qw-darker border border-qw-border rounded px-2 py-1 text-white text-xs">
              <option value="group">Group</option>
              <optgroup label="Winner's Bracket">
                <option value="r32">Round of 32</option>
                <option value="r16">Round of 16</option>
                <option value="quarter">Quarter-Finals</option>
                <option value="semi">Semi-Finals</option>
                <option value="final">Final</option>
              </optgroup>
              <optgroup label="Loser's Bracket">
                <option value="lr1">LR1</option>
                <option value="lr2">LR2</option>
                <option value="lr3">LR3</option>
                <option value="lr4">LR4</option>
                <option value="lr5">LR5</option>
                <option value="lr6">LR6</option>
                <option value="lsemi">L Semi-Finals</option>
                <option value="lfinal">L Final</option>
              </optgroup>
              <option value="grand">Grand Final</option>
              <option value="third">3rd Place</option>
            </select>
            <select value={match.status} onChange={(e) => onUpdate(match.id, { status: e.target.value })} className="bg-qw-darker border border-qw-border rounded px-2 py-1 text-white text-xs">
              <option value="scheduled">Scheduled</option>
              <option value="live">Live</option>
              <option value="completed">Completed</option>
            </select>
            <select value={match.bestOf} onChange={(e) => onUpdate(match.id, { bestOf: parseInt(e.target.value) })} className="bg-qw-darker border border-qw-border rounded px-2 py-1 text-white text-xs">
              <option value={1}>Bo1</option>
              <option value={3}>Bo3</option>
              <option value={5}>Bo5</option>
              <option value={7}>Bo7</option>
            </select>
          </div>
          {match.round === 'group' && (
            <div className="grid grid-cols-1">
              <label className="text-xs text-qw-muted mb-1">Group Stage Round:</label>
              <select
                value={match.roundNum || 1}
                onChange={(e) => onUpdate(match.id, { roundNum: parseInt(e.target.value) })}
                className="bg-qw-darker border border-qw-border rounded px-2 py-1 text-white text-xs"
              >
                {Array.from({ length: 20 }, (_, i) => i + 1).map(n => (
                  <option key={n} value={n}>Round {n}</option>
                ))}
              </select>
            </div>
          )}
          <div className="grid grid-cols-1">
            <select 
              value={match.forfeit || 'none'} 
              onChange={(e) => onUpdate(match.id, { forfeit: e.target.value === 'none' ? null : e.target.value })} 
              className="bg-qw-darker border border-qw-border rounded px-2 py-1 text-white text-xs"
            >
              <option value="none">No Forfeit (Match Level)</option>
              <option value="team1">{match.team1} forfeited (Match Level)</option>
              <option value="team2">{match.team2} forfeited (Match Level)</option>
            </select>
          </div>
          {match.maps && match.maps.length > 0 && (
            <div className="pt-2 border-t border-qw-border/50">
              <div className="flex items-center justify-between mb-2">
                <div className="text-xs text-qw-muted font-semibold">Map-Level Forfeits:</div>
                <button 
                  onClick={() => {
                    const newMap = {
                      id: `manual-ff-${Date.now()}`,
                      map: 'Unknown',
                      score1: 0,
                      score2: 0,
                      forfeit: null
                    };
                    onUpdate(match.id, { maps: [...match.maps, newMap] });
                  }}
                  className="px-2 py-0.5 bg-qw-accent/20 hover:bg-qw-accent/30 text-qw-accent text-xs rounded"
                >
                  + Add FF Map
                </button>
              </div>
              <div className="space-y-1">
                {match.maps.map((map, idx) => (
                  <div key={idx} className="flex items-center gap-2 bg-qw-darker/50 rounded px-2 py-1.5">
                    <span className="text-xs font-mono text-qw-muted w-6">{idx + 1}.</span>
                    <input 
                      type="text" 
                      value={map.map || ''} 
                      onChange={(e) => {
                        const newMaps = [...match.maps];
                        newMaps[idx] = { ...map, map: e.target.value };
                        onUpdate(match.id, { maps: newMaps });
                      }}
                      placeholder="Map name"
                      className="bg-qw-dark border border-qw-border rounded px-2 py-0.5 text-white text-xs flex-1"
                    />
                    <span className="text-xs text-qw-muted font-mono">{map.score1}-{map.score2}</span>
                    <select 
                      value={map.forfeit || 'none'} 
                      onChange={(e) => {
                        const newMaps = [...match.maps];
                        newMaps[idx] = { ...map, forfeit: e.target.value === 'none' ? null : e.target.value };
                        onUpdate(match.id, { maps: newMaps });
                      }}
                      className="bg-qw-dark border border-qw-border rounded px-2 py-0.5 text-white text-xs"
                    >
                      <option value="none">No FF</option>
                      <option value="team1">{match.team1} FF</option>
                      <option value="team2">{match.team2} FF</option>
                    </select>
                    <button 
                      onClick={() => {
                        const newMaps = match.maps.filter((_, i) => i !== idx);
                        onUpdate(match.id, { maps: newMaps });
                      }}
                      className="p-1 text-red-400 hover:text-red-300 text-xs"
                      title="Remove map"
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
          {(!match.maps || match.maps.length === 0) && (
            <div className="pt-2 border-t border-qw-border/50">
              <div className="text-xs text-qw-muted mb-2">No maps yet. Add a forfeited map:</div>
              <button 
                onClick={() => {
                  const newMap = {
                    id: `manual-ff-${Date.now()}`,
                    map: '',
                    score1: 0,
                    score2: 0,
                    forfeit: 'team2'  // Default to team2 FF
                  };
                  onUpdate(match.id, { maps: [newMap] });
                }}
                className="px-3 py-1.5 bg-qw-accent/20 hover:bg-qw-accent/30 text-qw-accent text-xs rounded"
              >
                + Add Forfeit Map
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
