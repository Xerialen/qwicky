// src/components/division/DivisionTeams.jsx
import React, { useState, useMemo } from 'react';
import {
  parseTeamsFromBulkText,
  parseTeamsFromCSV,
  parseTeamsFromJSON,
  validateTeams,
  detectDuplicates
} from '../../utils/teamImport';
import TeamImportPreview from './TeamImportPreview';

export default function DivisionTeams({ division, updateDivision, tournamentMode, allDivisions = [] }) {
  const [newTeam, setNewTeam] = useState({ name: '', tag: '', country: '', group: '', players: '' });
  const [editingTeam, setEditingTeam] = useState(null);
  const [bulkInput, setBulkInput] = useState('');
  const [showBulkAdd, setShowBulkAdd] = useState(false);
  const [viewMode, setViewMode] = useState('list'); // 'list' or 'groups'
  const [previewTeams, setPreviewTeams] = useState(null);
  const [clipboardFeedback, setClipboardFeedback] = useState('');

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
    // Parse teams using enhanced parser
    const parsedTeams = parseTeamsFromBulkText(bulkInput);

    // Validate teams
    const validatedTeams = validateTeams(parsedTeams, teams, groups);

    // Check for conflicts with existing teams
    const teamsWithConflicts = detectDuplicates(validatedTeams, teams);

    // Show preview modal
    setPreviewTeams(teamsWithConflicts);
  };

  const handleConfirmImport = (teamsToImport) => {
    // Generate final IDs and add to division
    const finalTeams = teamsToImport.map((team, idx) => ({
      ...team,
      id: `team-${Date.now()}-${idx}`,
      // Remove validation fields
      errors: undefined,
      warnings: undefined,
      isValid: undefined,
      conflicts: undefined,
      hasConflict: undefined,
    }));

    updateDivision({ teams: [...teams, ...finalTeams] });
    setBulkInput('');
    setShowBulkAdd(false);
    setPreviewTeams(null);
  };

  const handleCancelImport = () => {
    setPreviewTeams(null);
  };

  const handlePasteFromClipboard = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text.trim()) {
        setBulkInput(text);
        setClipboardFeedback('✓ Pasted from clipboard');
        setTimeout(() => setClipboardFeedback(''), 2000);
      } else {
        setClipboardFeedback('⚠ Clipboard is empty');
        setTimeout(() => setClipboardFeedback(''), 2000);
      }
    } catch (error) {
      setClipboardFeedback('⚠ Clipboard access denied - paste manually');
      setTimeout(() => setClipboardFeedback(''), 3000);
    }
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      let parsedTeams = [];

      if (file.name.endsWith('.json')) {
        parsedTeams = parseTeamsFromJSON(text);
      } else if (file.name.endsWith('.csv')) {
        parsedTeams = parseTeamsFromCSV(text);
      } else {
        alert('Unsupported file format. Please use .csv or .json files.');
        return;
      }

      if (parsedTeams.length === 0) {
        alert('No teams found in file. Please check the format.');
        return;
      }

      // Validate and show preview
      const validatedTeams = validateTeams(parsedTeams, teams, groups);
      const teamsWithConflicts = detectDuplicates(validatedTeams, teams);
      setPreviewTeams(teamsWithConflicts);

      // Reset file input
      e.target.value = '';
    } catch (error) {
      console.error('File parse error:', error);
      alert('Error reading file. Please check the format.');
    }
  };

  const handleImportFromDivision = (sourceDivisionId, clearGroups = false) => {
    const sourceDivision = allDivisions.find(d => d.id === sourceDivisionId);
    if (!sourceDivision || !sourceDivision.teams || sourceDivision.teams.length === 0) {
      alert('No teams found in selected division.');
      return;
    }

    // Clone teams and optionally clear group assignments
    const clonedTeams = sourceDivision.teams.map(team => ({
      ...team,
      id: `team-${Date.now()}-${Math.random()}`, // Generate new IDs
      group: clearGroups ? '' : team.group,
    }));

    // Validate and show preview
    const validatedTeams = validateTeams(clonedTeams, teams, groups);
    const teamsWithConflicts = detectDuplicates(validatedTeams, teams);
    setPreviewTeams(teamsWithConflicts);
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
      {/* Empty State with Getting Started Guide */}
      {teams.length === 0 && (
        <div className="qw-panel p-8">
          <div className="text-center max-w-2xl mx-auto">
            <div className="text-6xl mb-4">👥</div>
            <h3 className="font-display text-2xl text-white mb-2">No Teams Yet</h3>
            <p className="text-qw-muted mb-6">
              Choose the fastest way to add your {entityLabelPlural.toLowerCase()}:
            </p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-left">
              <div className="p-4 bg-qw-dark rounded border border-qw-border">
                <div className="text-2xl mb-2">✍️</div>
                <h4 className="font-semibold text-white mb-1">Bulk Import</h4>
                <p className="text-sm text-qw-muted">
                  Paste a list of teams from your signup sheet. Fastest for tournaments with many teams.
                </p>
              </div>
              <div className="p-4 bg-qw-dark rounded border border-qw-border">
                <div className="text-2xl mb-2">📁</div>
                <h4 className="font-semibold text-white mb-1">Upload File</h4>
                <p className="text-sm text-qw-muted">
                  Import from CSV or JSON file. Great if you have data in a spreadsheet.
                </p>
              </div>
              <div className="p-4 bg-qw-dark rounded border border-qw-border">
                <div className="text-2xl mb-2">👤</div>
                <h4 className="font-semibold text-white mb-1">Add Manually</h4>
                <p className="text-sm text-qw-muted">
                  Add teams one by one. Good for small tournaments or testing.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 1on1 Helper Banner */}
      {is1on1 && teams.length === 0 && (
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
          <div>
            <h3 className="font-display text-lg text-qw-accent">ADD {entityLabel.toUpperCase()}</h3>
            <p className="text-xs text-qw-muted mt-1">
              {showBulkAdd ? 'Paste multiple teams at once' : 'Add one team at a time'}
            </p>
          </div>
          <button
            onClick={() => setShowBulkAdd(!showBulkAdd)}
            className="px-3 py-1.5 rounded border border-qw-border text-sm text-qw-muted hover:text-white hover:border-qw-accent"
          >
            {showBulkAdd ? '👤 Single' : '✍️ Bulk'}
          </button>
        </div>

        {showBulkAdd ? (
          <div className="space-y-3">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1">
                <p className="text-sm text-qw-muted mb-1">
                  One {entityLabel.toLowerCase()} per line. Supports multiple formats:
                </p>
                <div className="text-xs text-qw-muted space-y-0.5">
                  <div>• CSV: <code className="bg-qw-dark px-1 rounded">Name, TAG, country, Group{is1on1 ? '' : ', players'}</code></div>
                  <div>• Natural: <code className="bg-qw-dark px-1 rounded">Team Name [TAG] 🇸🇪 - player1, player2</code></div>
                  <div>• Simple: <code className="bg-qw-dark px-1 rounded">Team Name</code></div>
                </div>
              </div>
              <button
                onClick={handlePasteFromClipboard}
                className="px-3 py-1.5 rounded border border-qw-border text-sm text-qw-muted hover:text-white hover:border-qw-accent whitespace-nowrap"
                title="Paste from clipboard"
              >
                📋 Paste
              </button>
            </div>
            {clipboardFeedback && (
              <div className="text-xs text-qw-accent">
                {clipboardFeedback}
              </div>
            )}
            <textarea
              value={bulkInput}
              onChange={(e) => setBulkInput(e.target.value)}
              placeholder={is1on1
                ? "razer, raz, se, A\nzero, zer, se, A\nParadokS [prd] 🇩🇰"
                : "Slackers, SLK, eu, A, ParadokS Zero grisling Phrenic\nHell Xpress [hx] 🇸🇪 - Splash ok98 Shaka mm\nTeam Paradoks"}
              rows={6}
              className="w-full bg-qw-dark border border-qw-border rounded px-4 py-2 font-mono text-white text-sm resize-none"
            />
            <button onClick={handleBulkAdd} className="qw-btn" disabled={!bulkInput.trim()}>
              Preview & Import
            </button>
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

      {/* File Upload */}
      <div className="qw-panel p-6">
        <div className="mb-4">
          <h3 className="font-display text-lg text-qw-accent">IMPORT FROM FILE</h3>
          <p className="text-xs text-qw-muted mt-1">
            Upload from spreadsheet or previous tournament export
          </p>
        </div>
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <label className="qw-btn cursor-pointer">
              📁 Choose File
              <input
                type="file"
                accept=".csv,.json"
                onChange={handleFileUpload}
                className="hidden"
              />
            </label>
            <span className="text-xs text-qw-muted">
              Supported: .csv, .json
            </span>
          </div>
          <div className="text-xs text-qw-muted space-y-1">
            <div>• CSV format: <code className="bg-qw-dark px-1 rounded">Name,Tag,Country,Group,Players</code></div>
            <div>• JSON format: Array of team objects or full tournament export</div>
          </div>
        </div>
      </div>

      {/* Import from Another Division */}
      {allDivisions && allDivisions.length > 1 && (
        <div className="qw-panel p-6">
          <div className="mb-4">
            <h3 className="font-display text-lg text-qw-accent">COPY FROM ANOTHER DIVISION</h3>
            <p className="text-xs text-qw-muted mt-1">
              Reuse teams from another division in this tournament
            </p>
          </div>
          <div className="space-y-3">
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
              <select
                id="source-division"
                onChange={(e) => {
                  const divisionId = e.target.value;
                  const clearGroups = document.getElementById('clear-groups-checkbox')?.checked || false;
                  if (divisionId) {
                    handleImportFromDivision(divisionId, clearGroups);
                  }
                }}
                className="flex-1 bg-qw-dark border border-qw-border rounded px-4 py-2 text-white"
              >
                <option value="">Select division...</option>
                {allDivisions
                  .filter(d => d.id !== division.id)
                  .map(d => (
                    <option key={d.id} value={d.id}>
                      {d.name} ({d.teams?.length || 0} teams)
                    </option>
                  ))}
              </select>
              <label className="flex items-center gap-2 text-sm text-qw-muted whitespace-nowrap">
                <input
                  type="checkbox"
                  id="clear-groups-checkbox"
                  className="rounded border-qw-border bg-qw-dark"
                />
                Clear group assignments
              </label>
            </div>
          </div>
        </div>
      )}

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
      {teams.length > 0 && (
        viewMode === 'list' ? (
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
        )
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

      {/* Import Preview Modal */}
      {previewTeams && (
        <TeamImportPreview
          teams={previewTeams}
          onConfirm={handleConfirmImport}
          onCancel={handleCancelImport}
          title="Preview Bulk Import"
        />
      )}
    </div>
  );
}
