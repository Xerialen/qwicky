// src/components/DivisionManager.jsx
import React, { useState } from 'react';

export default function DivisionManager({ 
  divisions, 
  activeDivisionId,
  setActiveDivisionId,
  addDivision, 
  removeDivision,
  duplicateDivision,
  setActiveTab 
}) {
  const [newDivName, setNewDivName] = useState('');
  const [showAddForm, setShowAddForm] = useState(false);

  const handleAddDivision = (e) => {
    e.preventDefault();
    if (!newDivName.trim()) return;
    
    addDivision(newDivName.trim());
    setNewDivName('');
    setShowAddForm(false);
  };

  const handleSelectDivision = (divId) => {
    setActiveDivisionId(divId);
    setActiveTab('division');
  };

  const handleRemoveDivision = (divId, divName) => {
    if (window.confirm(`Delete "${divName}"? This will remove all teams, schedule, and results for this division.`)) {
      removeDivision(divId);
    }
  };

  const suggestedNames = [
    'Division 1',
    'Division 2', 
    'Division 3',
    'Pro Division',
    'Amateur Division',
    'Open Division',
  ];

  // Filter out names that already exist
  const availableSuggestions = suggestedNames.filter(
    name => !divisions.some(d => d.name.toLowerCase() === name.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="font-display font-bold text-2xl text-white flex items-center gap-3">
          <span className="text-qw-accent">📁</span>
          Division Manager
        </h2>
        <button
          onClick={() => setShowAddForm(!showAddForm)}
          className="qw-btn"
        >
          + Add Division
        </button>
      </div>

      {/* Add Division Form */}
      {showAddForm && (
        <div className="qw-panel p-6">
          <h3 className="font-display text-lg text-qw-accent mb-4">CREATE NEW DIVISION</h3>
          <form onSubmit={handleAddDivision} className="space-y-4">
            <div>
              <label className="block text-qw-muted text-sm mb-1">Division Name</label>
              <input
                type="text"
                value={newDivName}
                onChange={(e) => setNewDivName(e.target.value)}
                placeholder="e.g., Division 1"
                className="w-full bg-qw-dark border border-qw-border rounded px-4 py-2 text-white"
                autoFocus
              />
            </div>
            
            {/* Quick suggestions */}
            {availableSuggestions.length > 0 && (
              <div>
                <label className="block text-qw-muted text-sm mb-2">Quick select:</label>
                <div className="flex flex-wrap gap-2">
                  {availableSuggestions.slice(0, 4).map(name => (
                    <button
                      key={name}
                      type="button"
                      onClick={() => setNewDivName(name)}
                      className="px-3 py-1 bg-qw-dark border border-qw-border rounded text-sm text-qw-muted hover:text-white hover:border-qw-accent transition-colors"
                    >
                      {name}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="flex gap-2">
              <button type="submit" className="qw-btn" disabled={!newDivName.trim()}>
                Create Division
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowAddForm(false);
                  setNewDivName('');
                }}
                className="px-4 py-2 rounded border border-qw-border text-qw-muted hover:text-white"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Divisions List */}
      {divisions.length === 0 ? (
        <div className="qw-panel p-12 text-center">
          <div className="text-6xl mb-4">📁</div>
          <h3 className="font-display text-2xl text-white mb-2">No Divisions Yet</h3>
          <p className="text-qw-muted mb-6">
            Create divisions to organize your tournament. Each division has its own teams, schedule, and standings.
          </p>
          {!showAddForm && (
            <button
              onClick={() => setShowAddForm(true)}
              className="qw-btn"
            >
              Create Your First Division
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {divisions.map((div, idx) => {
            const completedMatches = div.schedule?.filter(m => m.status === 'completed').length || 0;
            const totalMatches = div.schedule?.length || 0;
            const isActive = div.id === activeDivisionId;

            return (
              <div 
                key={div.id} 
                className={`qw-panel overflow-hidden transition-all ${isActive ? 'ring-2 ring-qw-accent' : ''}`}
              >
                {/* Header */}
                <div className="flex items-center justify-between p-4 bg-qw-dark border-b border-qw-border">
                  <div className="flex items-center gap-3">
                    <span className="w-10 h-10 rounded bg-qw-accent/20 flex items-center justify-center font-display font-bold text-qw-accent text-lg">
                      {idx + 1}
                    </span>
                    <div>
                      <h3 className="font-display font-bold text-white">{div.name}</h3>
                      <p className="text-xs text-qw-muted">
                        {div.format === 'groups' ? 'Groups → Playoffs' : div.format}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => handleSelectDivision(div.id)}
                    className="qw-btn text-sm"
                  >
                    Open
                  </button>
                </div>

                {/* Stats */}
                <div className="p-4">
                  <div className="grid grid-cols-3 gap-4 mb-4">
                    <div className="text-center">
                      <div className="font-display font-bold text-2xl text-white">
                        {div.teams?.length || 0}
                      </div>
                      <div className="text-xs text-qw-muted">Teams</div>
                    </div>
                    <div className="text-center">
                      <div className="font-display font-bold text-2xl text-white">
                        {div.numGroups || 2}
                      </div>
                      <div className="text-xs text-qw-muted">Groups</div>
                    </div>
                    <div className="text-center">
                      <div className="font-display font-bold text-2xl text-white">
                        {completedMatches}/{totalMatches}
                      </div>
                      <div className="text-xs text-qw-muted">Matches</div>
                    </div>
                  </div>

                  {/* Format info */}
                  <div className="flex items-center justify-between text-sm text-qw-muted mb-4">
                    <span>Groups: Bo{div.groupStageBestOf}</span>
                    <span>QF/SF: Bo{div.playoffQFBestOf}/{div.playoffSFBestOf}</span>
                    <span>Final: Bo{div.playoffFinalBestOf}</span>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center justify-between pt-3 border-t border-qw-border">
                    <button
                      onClick={() => duplicateDivision(div.id)}
                      className="text-sm text-qw-muted hover:text-white flex items-center gap-1"
                      title="Duplicate settings (not data)"
                    >
                      <span>📋</span> Duplicate Settings
                    </button>
                    <button
                      onClick={() => handleRemoveDivision(div.id, div.name)}
                      className="text-sm text-red-400 hover:text-red-300 flex items-center gap-1"
                    >
                      <span>🗑️</span> Delete
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Tips */}
      {divisions.length > 0 && (
        <div className="qw-panel p-4">
          <h3 className="font-display text-sm text-qw-accent mb-2">TIPS</h3>
          <ul className="text-qw-muted text-sm space-y-1">
            <li>• Each division has its own teams, schedule, standings, and bracket</li>
            <li>• Use "Duplicate Settings" to create a new division with the same format</li>
            <li>• Click "Open" to manage a division's teams, schedule, and results</li>
          </ul>
        </div>
      )}
    </div>
  );
}
