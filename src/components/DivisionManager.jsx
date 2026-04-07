// src/components/DivisionManager.jsx
import React, { useState } from 'react';
import DangerButton from './DangerButton';

export default function DivisionManager({
  divisions,
  activeDivisionId,
  setActiveDivisionId,
  addDivision,
  removeDivision,
  duplicateDivision,
  setActiveTab,
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

  const handleRemoveDivision = (divId) => {
    removeDivision(divId);
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
    (name) => !divisions.some((d) => d.name.toLowerCase() === name.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="font-headline font-bold text-2xl text-on-surface flex items-center gap-3">
          <span className="text-primary">📁</span>
          Division Manager
        </h2>
        <button onClick={() => setShowAddForm(!showAddForm)} className="qw-btn">
          + Add Division
        </button>
      </div>

      {/* Add Division Form */}
      {showAddForm && (
        <div className="qw-panel p-6">
          <h3 className="font-headline text-lg text-primary mb-4">CREATE NEW DIVISION</h3>
          <form onSubmit={handleAddDivision} className="space-y-4">
            <div>
              <label className="block text-on-surface-variant text-sm mb-1">Division Name</label>
              <input
                type="text"
                value={newDivName}
                onChange={(e) => setNewDivName(e.target.value)}
                placeholder="e.g., Division 1"
                className="w-full bg-surface-container-high border border-outline-variant rounded px-4 py-2 text-on-surface"
                autoFocus
              />
            </div>

            {/* Quick suggestions */}
            {availableSuggestions.length > 0 && (
              <div>
                <label className="block text-on-surface-variant text-sm mb-2">Quick select:</label>
                <div className="flex flex-wrap gap-2">
                  {availableSuggestions.slice(0, 4).map((name) => (
                    <button
                      key={name}
                      type="button"
                      onClick={() => setNewDivName(name)}
                      className="px-3 py-1 bg-surface-container-high border border-outline-variant rounded text-sm text-on-surface-variant hover:text-on-surface hover:border-primary transition-colors"
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
                className="px-4 py-2 rounded border border-outline-variant text-on-surface-variant hover:text-on-surface"
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
          <h3 className="font-headline text-2xl text-on-surface mb-2">No Divisions Yet</h3>
          <p className="text-on-surface-variant mb-6">
            Create divisions to organize your tournament. Each division has its own teams, schedule,
            and standings.
          </p>
          {!showAddForm && (
            <button onClick={() => setShowAddForm(true)} className="qw-btn">
              Create Your First Division
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {divisions.map((div, idx) => {
            const completedMatches =
              div.schedule?.filter((m) => m.status === 'completed').length || 0;
            const totalMatches = div.schedule?.length || 0;
            const isActive = div.id === activeDivisionId;

            return (
              <div
                key={div.id}
                className={`qw-panel overflow-hidden transition-all ${isActive ? 'ring-2 ring-primary' : ''}`}
              >
                {/* Header */}
                <div className="flex items-center justify-between p-4 bg-surface-container-high border-b border-outline-variant">
                  <div className="flex items-center gap-3">
                    <span className="w-10 h-10 rounded bg-primary/20 flex items-center justify-center font-headline font-bold text-primary text-lg">
                      {idx + 1}
                    </span>
                    <div>
                      <h3 className="font-headline font-bold text-on-surface">{div.name}</h3>
                      <p className="text-xs text-on-surface-variant">
                        {div.format === 'groups' ? 'Groups → Playoffs' : div.format}
                      </p>
                    </div>
                  </div>
                  <button onClick={() => handleSelectDivision(div.id)} className="qw-btn text-sm">
                    Open
                  </button>
                </div>

                {/* Stats */}
                <div className="p-4">
                  <div className="grid grid-cols-3 gap-4 mb-4">
                    <div className="text-center">
                      <div className="font-headline font-bold text-2xl text-on-surface">
                        {div.teams?.length || 0}
                      </div>
                      <div className="text-xs text-on-surface-variant">Teams</div>
                    </div>
                    <div className="text-center">
                      <div className="font-headline font-bold text-2xl text-on-surface">
                        {div.numGroups || 2}
                      </div>
                      <div className="text-xs text-on-surface-variant">Groups</div>
                    </div>
                    <div className="text-center">
                      <div className="font-headline font-bold text-2xl text-on-surface">
                        {completedMatches}/{totalMatches}
                      </div>
                      <div className="text-xs text-on-surface-variant">Matches</div>
                    </div>
                  </div>

                  {/* Format info */}
                  <div className="flex items-center justify-between text-sm text-on-surface-variant mb-4">
                    <span>Groups: Bo{div.groupStageBestOf}</span>
                    <span>
                      QF/SF: Bo{div.playoffQFBestOf}/{div.playoffSFBestOf}
                    </span>
                    <span>Final: Bo{div.playoffFinalBestOf}</span>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center justify-between pt-3 border-t border-outline-variant">
                    <button
                      onClick={() => duplicateDivision(div.id)}
                      className="text-sm text-on-surface-variant hover:text-on-surface flex items-center gap-1"
                      title="Duplicate settings (not data)"
                    >
                      <span>📋</span> Duplicate Settings
                    </button>
                    <DangerButton
                      label={`Delete ${div.name}`}
                      confirmLabel="Click to confirm deletion"
                      onConfirm={() => handleRemoveDivision(div.id)}
                    />
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
          <h3 className="font-headline text-sm text-primary mb-2">TIPS</h3>
          <ul className="text-on-surface-variant text-sm space-y-1">
            <li>• Each division has its own teams, schedule, standings, and bracket</li>
            <li>• Use "Duplicate Settings" to create a new division with the same format</li>
            <li>• Click "Open" to manage a division's teams, schedule, and results</li>
          </ul>
        </div>
      )}
    </div>
  );
}
