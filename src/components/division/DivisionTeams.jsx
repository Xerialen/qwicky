// src/components/division/DivisionTeams.jsx
import React, { useState, useMemo } from 'react';

export default function DivisionTeams({ division, updateDivision, tournamentMode }) {
  const [newTeam, setNewTeam] = useState({ name: '', tag: '', country: '', group: '', players: '' });
  const [editingTeam, setEditingTeam] = useState(null);
  const [bulkInput, setBulkInput] = useState('');
  const [showBulkAdd, setShowBulkAdd] = useState(false);
  const [viewMode, setViewMode] = useState('list'); // 'list' or 'groups'

  const teams = division.teams || [];
  const is1on1 = tournamentMode === '1on1';
  
  // Dynamic labels based on mode
  const entityLabel = is1on1 ? 'Player' : 'Team';
  const entityLabelPlural = is1on1 ? 'Players' : 'Teams';
  
  const groups = useMemo(() => {
    return Array.from({ length: division.numGroups }, (_, i) => String.fromCharCode(65 + i));
  }, [division.numGroups]);

  // Group teams by their assigned group
  const teamsByGroup = useMemo(() => {
    const grouped = { unassigned: [] };
    groups.forEach(g => grouped[g] = []);
    
    teams.forEach(team => {
      if (team.group && grouped[team.group]) {
        grouped[team.group].push(team);
      } else {
        grouped.unassigned.push(team);
      }
    });
    
    return grouped;
  }, [teams, groups]);

  const handleAddTeam = (e) => {
    e.preventDefault();
    if (!newTeam.name.trim()) return;

    const team = {
      id: `team-${Date.now()}`,
      name: newTeam.name.trim(),
      tag: newTeam.tag.trim() || newTeam.name.trim().substring(0, 4).toUpperCase(),
      country: newTeam.country.trim().toLowerCase(),
      group: newTeam.group || '',
      players: newTeam.players.trim(),
    };

    updateDivision({ teams: [...teams, team] });
    setNewTeam({ name: '', tag: '', country: '', group: '', players: '' });
  };

  const handleBulkAdd = () => {
    const lines = bulkInput.split('\n').filter(l => l.trim());
    const newTeams = lines.map((line, idx) => {
      // Parse: "Team Name, TAG, country, group, player1 player2 player3" or just "Team Name"
      const parts = line.split(',').map(p => p.trim());
      const name = parts[0];
      const tag = parts[1] || name.substring(0, 4).toUpperCase();
      const country = (parts[2] || '').toLowerCase();
      const group = (parts[3] || '').toUpperCase();
      const players = parts[4] || '';

      return {
        id: `team-${Date.now()}-${idx}`,
        name,
        tag,
        country,
        group: groups.includes(group) ? group : '',
        players,
      };
    });

    updateDivision({ teams: [...teams, ...newTeams] });
    setBulkInput('');
    setShowBulkAdd(false);
  };

  const handleRemoveTeam = (teamId) => {
    updateDivision({ teams: teams.filter(t => t.id !== teamId) });
  };

  const handleUpdateTeam = (teamId, field, value) => {
    updateDivision({
      teams: teams.map(t => t.id === teamId ? { ...t, [field]: value } : t)
    });
  };

  const handleAssignGroup = (teamId, group) => {
    handleUpdateTeam(teamId, 'group', group);
  };

  const handleRandomizeGroups = () => {
    if (!window.confirm('Randomly assign all teams to groups?')) return;
    
    // Shuffle teams
    const shuffled = [...teams].sort(() => Math.random() - 0.5);
    const teamsPerGroup = division.teamsPerGroup;
    
    const updated = shuffled.map((team, idx) => {
      const groupIdx = Math.floor(idx / teamsPerGroup);
      const group = groupIdx < groups.length ? groups[groupIdx] : '';
      return { ...team, group };
    });

    updateDivision({ teams: updated });
  };

  const handleClearGroups = () => {
    if (!window.confirm('Clear all group assignments?')) return;
    updateDivision({
      teams: teams.map(t => ({ ...t, group: '' }))
    });
  };

  const handleClearAll = () => {
    if (window.confirm(`Remove all ${teams.length} teams?`)) {
      updateDivision({ teams: [] });
    }
  };

  return (
    <div className="space-y-6">
      {/* 1on1 Helper Banner */}
      {is1on1 && (
        <div className="qw-panel p-4 bg-qw-accent/10 border-qw-accent">
          <div className="flex items-start gap-3">
            <span className="text-2xl">💡</span>
            <div>
              <h4 className="font-body font-semibold text-white mb-1">1on1 Tournament Tip</h4>
              <p className="text-sm text-qw-muted">
                For 1on1 tournaments, each "team" represents a single player. 
                Just add the player's name in the "Team Name" field. 
                You can leave "Players" field empty or use it for alternate names.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Add Team Form */}
      <div className="qw-panel p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-display text-lg text-qw-accent">ADD {entityLabel.toUpperCase()}</h3>
          <button onClick={() => setShowBulkAdd(!showBulkAdd)} className="text-sm text-qw-muted hover:text-white">
            {showBulkAdd ? 'Single Add' : 'Bulk Add'}
          </button>
        </div>

        {showBulkAdd ? (
          <div className="space-y-3">
            <p className="text-sm text-qw-muted">
              One {entityLabel.toLowerCase()} per line: <code className="bg-qw-dark px-1 rounded">Name, TAG, country, Group{is1on1 ? '' : ', players'}</code>
            </p>
            <textarea
              value={bulkInput}
              onChange={(e) => setBulkInput(e.target.value)}
              placeholder={is1on1 
                ? "razer, raz, se, A\nzero, zer, se, A\nParadokS, prd, dk, B"
                : "Slackers, SLK, eu, A, ParadokS Zero grisling Phrenic\nHell Xpress, hx, se, B, Splash ok98 Shaka mm"}
              rows={6}
              className="w-full bg-qw-dark border border-qw-border rounded px-4 py-2 font-mono text-white text-sm resize-none"
            />
            <button onClick={handleBulkAdd} className="qw-btn" disabled={!bulkInput.trim()}>Add {entityLabelPlural}</button>
          </div>
        ) : (
          <form onSubmit={handleAddTeam} className="space-y-3">
            <div className="flex gap-3 flex-wrap">
              <input 
                type="text" 
                value={newTeam.name} 
                onChange={(e) => setNewTeam({ ...newTeam, name: e.target.value })} 
                placeholder={is1on1 ? "Player Name" : "Team Name"}
                className="flex-1 min-w-40 bg-qw-dark border border-qw-border rounded px-4 py-2 text-white" 
              />
              <input type="text" value={newTeam.tag} onChange={(e) => setNewTeam({ ...newTeam, tag: e.target.value })} placeholder="Tag" className="w-20 bg-qw-dark border border-qw-border rounded px-4 py-2 text-white" />
              <input type="text" value={newTeam.country} onChange={(e) => setNewTeam({ ...newTeam, country: e.target.value })} placeholder="Country" className="w-20 bg-qw-dark border border-qw-border rounded px-4 py-2 text-white" />
              <select value={newTeam.group} onChange={(e) => setNewTeam({ ...newTeam, group: e.target.value })} className="w-24 bg-qw-dark border border-qw-border rounded px-2 py-2 text-white">
                <option value="">No Group</option>
                {groups.map(g => <option key={g} value={g}>Group {g}</option>)}
              </select>
            </div>
            {!is1on1 && (
              <div className="flex gap-3">
                <input type="text" value={newTeam.players} onChange={(e) => setNewTeam({ ...newTeam, players: e.target.value })} placeholder="Players (for wiki): player1, player2, player3..." className="flex-1 bg-qw-dark border border-qw-border rounded px-4 py-2 text-white text-sm" />
                <button type="submit" className="qw-btn">Add</button>
              </div>
            )}
            {is1on1 && (
              <button type="submit" className="qw-btn w-full">Add {entityLabel}</button>
            )}
          </form>
        )}
      </div>

      {/* Group Assignment Actions */}
      {teams.length > 0 && (
        <div className="flex items-center justify-between">
          <div className="flex gap-2">
            <button onClick={() => setViewMode(viewMode === 'list' ? 'groups' : 'list')} className="px-3 py-1 rounded border border-qw-border text-sm text-qw-muted hover:text-white">
              {viewMode === 'list' ? '📊 View by Groups' : '📋 View as List'}
            </button>
            <button onClick={handleRandomizeGroups} className="px-3 py-1 rounded border border-qw-border text-sm text-qw-muted hover:text-white">
              🎲 Randomize Groups
            </button>
            <button onClick={handleClearGroups} className="px-3 py-1 rounded border border-qw-border text-sm text-qw-muted hover:text-white">
              ↩️ Clear Assignments
            </button>
          </div>
          <button onClick={handleClearAll} className="text-sm text-red-400 hover:text-red-300">Clear All Teams</button>
        </div>
      )}

      {/* Teams Display */}
      {teams.length === 0 ? (
        <div className="qw-panel p-12 text-center">
          <div className="text-4xl mb-2">👥</div>
          <p className="text-qw-muted">No teams added yet</p>
        </div>
      ) : viewMode === 'list' ? (
        <div className="qw-panel p-6">
          <h3 className="font-display text-lg text-qw-accent mb-4">TEAMS ({teams.length})</h3>
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {teams.map((team, idx) => (
              <div key={team.id} className="p-3 bg-qw-dark rounded border border-qw-border group">
                <div className="flex items-center gap-3">
                  <span className="text-qw-muted font-mono text-sm w-6">{idx + 1}.</span>
                  
                  {editingTeam === team.id ? (
                    <>
                      <input type="text" value={team.name} onChange={(e) => handleUpdateTeam(team.id, 'name', e.target.value)} className="flex-1 bg-qw-darker border border-qw-accent rounded px-2 py-1 text-white text-sm" placeholder="Team Name" />
                      <input type="text" value={team.tag} onChange={(e) => handleUpdateTeam(team.id, 'tag', e.target.value)} className="w-16 bg-qw-darker border border-qw-accent rounded px-2 py-1 text-white text-sm" placeholder="Tag" />
                      <input type="text" value={team.country} onChange={(e) => handleUpdateTeam(team.id, 'country', e.target.value)} className="w-12 bg-qw-darker border border-qw-accent rounded px-2 py-1 text-white text-sm" placeholder="cc" />
                      <select value={team.group || ''} onChange={(e) => handleUpdateTeam(team.id, 'group', e.target.value)} className="w-16 bg-qw-darker border border-qw-accent rounded px-1 py-1 text-white text-sm">
                        <option value="">-</option>
                        {groups.map(g => <option key={g} value={g}>{g}</option>)}
                      </select>
                      <button onClick={() => setEditingTeam(null)} className="text-qw-win hover:text-white px-2">✓</button>
                    </>
                  ) : (
                    <>
                      <span className="flex-1 font-body font-semibold text-white">{team.name}</span>
                      <span className="text-qw-muted font-mono text-sm">[{team.tag}]</span>
                      {team.country && <span className="text-qw-muted text-sm uppercase">{team.country}</span>}
                      <select value={team.group || ''} onChange={(e) => handleAssignGroup(team.id, e.target.value)} className="w-20 bg-qw-dark border border-qw-border rounded px-1 py-1 text-sm text-qw-muted">
                        <option value="">-</option>
                        {groups.map(g => <option key={g} value={g}>Grp {g}</option>)}
                      </select>
                      <button onClick={() => setEditingTeam(team.id)} className="opacity-0 group-hover:opacity-100 text-qw-muted hover:text-white transition-opacity">✏️</button>
                      <button onClick={() => handleRemoveTeam(team.id)} className="opacity-0 group-hover:opacity-100 text-red-400 hover:text-red-300 transition-opacity">✕</button>
                    </>
                  )}
                </div>
                {/* Players row - always show for editing, show if exists otherwise */}
                {editingTeam === team.id ? (
                  <div className="mt-2 ml-9">
                    <input 
                      type="text" 
                      value={team.players || ''} 
                      onChange={(e) => handleUpdateTeam(team.id, 'players', e.target.value)} 
                      className="w-full bg-qw-darker border border-qw-accent rounded px-2 py-1 text-white text-xs" 
                      placeholder="Players: player1, player2, player3..." 
                    />
                  </div>
                ) : team.players ? (
                  <div className="mt-1 ml-9 text-xs text-qw-muted">{team.players}</div>
                ) : null}
              </div>
            ))}
          </div>
        </div>
      ) : (
        /* Group View */
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {groups.map(groupName => (
            <div key={groupName} className="qw-panel overflow-hidden">
              <div className="bg-qw-dark px-4 py-2 border-b border-qw-border flex items-center justify-between">
                <h4 className="font-display font-bold text-qw-accent">Group {groupName}</h4>
                <span className="text-xs text-qw-muted">{teamsByGroup[groupName]?.length || 0}/{division.teamsPerGroup}</span>
              </div>
              <div className="p-3 min-h-24">
                {teamsByGroup[groupName]?.length === 0 ? (
                  <div className="text-center text-qw-muted text-sm py-4">No teams assigned</div>
                ) : (
                  <div className="space-y-1">
                    {teamsByGroup[groupName]?.map((team, idx) => (
                      <div key={team.id} className="flex items-center justify-between p-2 bg-qw-dark rounded text-sm group">
                        <span className="font-body text-white">{idx + 1}. {team.name}</span>
                        <div className="flex items-center gap-2">
                          {team.country && <span className="text-qw-muted uppercase text-xs">{team.country}</span>}
                          <button onClick={() => handleAssignGroup(team.id, '')} className="opacity-0 group-hover:opacity-100 text-red-400 text-xs">Remove</button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))}
          
          {/* Unassigned */}
          {teamsByGroup.unassigned?.length > 0 && (
            <div className="qw-panel overflow-hidden md:col-span-2">
              <div className="bg-qw-dark px-4 py-2 border-b border-qw-border">
                <h4 className="font-display font-bold text-qw-muted">Unassigned ({teamsByGroup.unassigned.length})</h4>
              </div>
              <div className="p-3">
                <div className="flex flex-wrap gap-2">
                  {teamsByGroup.unassigned.map(team => (
                    <div key={team.id} className="flex items-center gap-2 px-3 py-1 bg-qw-dark rounded border border-qw-border">
                      <span className="text-white text-sm">{team.name}</span>
                      <select onChange={(e) => handleAssignGroup(team.id, e.target.value)} value="" className="bg-transparent text-qw-accent text-xs border-none outline-none cursor-pointer">
                        <option value="" disabled>→ Group</option>
                        {groups.map(g => <option key={g} value={g}>{g}</option>)}
                      </select>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Summary */}
      {teams.length > 0 && (
        <div className="qw-panel p-4">
          <div className="flex items-center justify-between text-sm">
            <span className="text-qw-muted">
              {teams.length} teams total • 
              {teams.filter(t => t.group).length} assigned • 
              {teams.filter(t => !t.group).length} unassigned
            </span>
            <span className="text-qw-muted">
              Target: {division.numGroups} groups × {division.teamsPerGroup} teams = {division.numGroups * division.teamsPerGroup}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
