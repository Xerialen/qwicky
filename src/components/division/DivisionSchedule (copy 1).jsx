// src/components/division/DivisionSchedule.jsx
import React, { useState, useMemo } from 'react';

export default function DivisionSchedule({ division, updateDivision }) {
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingMatch, setEditingMatch] = useState(null);
  const [newMatch, setNewMatch] = useState({
    team1: '', team2: '', date: '', time: '', group: '', round: 'group'
  });

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

  // Generate group schedule respecting assigned groups
  const generateGroupSchedule = () => {
    // Group teams by their assigned group
    const teamsByGroup = {};
    groups.forEach(g => teamsByGroup[g] = []);
    
    teams.forEach(team => {
      if (team.group && teamsByGroup[team.group]) {
        teamsByGroup[team.group].push(team);
      }
    });

    // Check if all teams are assigned
    const unassignedCount = teams.filter(t => !t.group).length;
    if (unassignedCount > 0) {
      alert(`${unassignedCount} team(s) are not assigned to groups. Please assign all teams first in the Teams tab.`);
      return;
    }

    const newSchedule = [];
    const meetings = division.groupMeetings || 1;
    
    for (const [groupName, groupTeams] of Object.entries(teamsByGroup)) {
      if (groupTeams.length < 2) continue;
      
      for (let meeting = 0; meeting < meetings; meeting++) {
        for (let i = 0; i < groupTeams.length; i++) {
          for (let j = i + 1; j < groupTeams.length; j++) {
            newSchedule.push({
              id: `match-${Date.now()}-${groupName}-${i}-${j}-${meeting}`,
              team1: groupTeams[i].name,
              team2: groupTeams[j].name,
              group: groupName,
              round: 'group',
              meeting: meeting + 1,
              bestOf: division.groupStageBestOf,
              date: '',
              time: '',
              status: 'scheduled',
              maps: []
            });
          }
        }
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
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {Object.entries(groupedMatches.groups).sort().map(([groupName, matches]) => (
                  <div key={groupName} className="qw-panel overflow-hidden">
                    <div className="bg-qw-dark px-4 py-2 border-b border-qw-border flex justify-between">
                      <h4 className="font-display font-bold text-white">Group {groupName}</h4>
                      <span className="text-xs text-qw-muted">{matches.length} matches</span>
                    </div>
                    <div className="divide-y divide-qw-border max-h-64 overflow-y-auto">
                      {matches.map(match => (
                        <MatchRow key={match.id} match={match} onUpdate={handleUpdateMatch} onRemove={handleRemoveMatch} isEditing={editingMatch === match.id} setEditing={setEditingMatch} />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {groupedMatches.playoffs.length > 0 && (
            <div className="space-y-4">
              <h3 className="font-display text-lg text-qw-accent">PLAYOFFS</h3>
              <div className="qw-panel overflow-hidden">
                <div className="divide-y divide-qw-border">
                  {groupedMatches.playoffs.map(match => (
                    <MatchRow key={match.id} match={match} onUpdate={handleUpdateMatch} onRemove={handleRemoveMatch} isEditing={editingMatch === match.id} setEditing={setEditingMatch} showRound />
                  ))}
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {schedule.length > 0 && (
        <div className="grid grid-cols-3 gap-4">
          <div className="qw-panel p-4 text-center">
            <div className="text-2xl font-display font-bold text-white">{schedule.length}</div>
            <div className="text-xs text-qw-muted">Total</div>
          </div>
          <div className="qw-panel p-4 text-center">
            <div className="text-2xl font-display font-bold text-qw-win">{schedule.filter(m => m.status === 'completed').length}</div>
            <div className="text-xs text-qw-muted">Completed</div>
          </div>
          <div className="qw-panel p-4 text-center">
            <div className="text-2xl font-display font-bold text-qw-muted">{schedule.filter(m => m.status === 'scheduled').length}</div>
            <div className="text-xs text-qw-muted">Pending</div>
          </div>
        </div>
      )}
    </div>
  );
}

function MatchRow({ match, onUpdate, onRemove, isEditing, setEditing, showRound }) {
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
    <div className="p-2 hover:bg-qw-dark/50 transition-colors group text-sm">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 flex-1">
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
          </div>
          <span className="text-qw-muted text-xs">Bo{match.bestOf}</span>
        </div>
        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button onClick={() => setEditing(isEditing ? null : match.id)} className="p-1 text-qw-muted hover:text-white text-xs">✏️</button>
          <button onClick={() => onRemove(match.id)} className="p-1 text-red-400 hover:text-red-300 text-xs">✕</button>
        </div>
      </div>
      {isEditing && (
        <div className="mt-2 pt-2 border-t border-qw-border grid grid-cols-5 gap-2">
          <input type="date" value={match.date} onChange={(e) => onUpdate(match.id, { date: e.target.value })} className="bg-qw-darker border border-qw-border rounded px-2 py-1 text-white text-xs" />
          <input type="time" value={match.time} onChange={(e) => onUpdate(match.id, { time: e.target.value })} className="bg-qw-darker border border-qw-border rounded px-2 py-1 text-white text-xs" />
          <select value={match.round || 'group'} onChange={(e) => onUpdate(match.id, { round: e.target.value })} className="bg-qw-darker border border-qw-border rounded px-2 py-1 text-white text-xs">
            <option value="group">Group</option>
            <option value="r32">Round of 32</option>
            <option value="r16">Round of 16</option>
            <option value="quarter">Quarter-Finals</option>
            <option value="semi">Semi-Finals</option>
            <option value="final">Final</option>
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
      )}
    </div>
  );
}
