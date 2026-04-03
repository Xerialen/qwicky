// src/components/Header.jsx
import React, { useState, useRef } from 'react';
import ConfirmModal from './ConfirmModal';

export default function Header({
  tournament,
  divisions,
  activeTab,
  setActiveTab,
  activeDivisionId,
  setActiveDivisionId,
  importTournament,
  resetTournament,
  onGoHome,
}) {
  const [showDivisionDropdown, setShowDivisionDropdown] = useState(false);
  const fileInputRef = useRef(null);

  // Import confirm — holds parsed data until user confirms
  const [pendingImport, setPendingImport] = useState(null);

  // Reset two-step
  const [resetStep, setResetStep] = useState(null); // null | 'step1' | 'step2'

  const handleExport = () => {
    const data = {
      ...tournament,
      exportedAt: new Date().toISOString(),
      version: 3,
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const safeName = (tournament.name || 'tournament').replace(/[^a-z0-9]/gi, '_');
    a.download = `${safeName}_${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleImport = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const data = JSON.parse(event.target.result);
        if (!data.divisions && !data.name) {
          throw new Error('Invalid tournament file');
        }
        setPendingImport(data);
      } catch (err) {
        alert('Failed to import: ' + err.message);
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleImportConfirm = () => {
    importTournament(pendingImport);
    setPendingImport(null);
  };

  const handleResetClick = () => {
    setResetStep('step1');
  };

  const handleResetStep1Confirm = () => {
    setResetStep('step2');
  };

  const handleResetStep2Confirm = () => {
    setResetStep(null);
    resetTournament();
  };

  const handleSelectDivision = (divId) => {
    setActiveDivisionId(divId);
    setActiveTab('division');
    setShowDivisionDropdown(false);
  };

  const activeDivName = activeDivisionId
    ? divisions.find((d) => d.id === activeDivisionId)?.name
    : null;

  const divisionCount = divisions.reduce((sum, d) => sum + (d.teams?.length || 0), 0);
  const scheduleCount = divisions.reduce((sum, d) => sum + (d.schedule?.length || 0), 0);

  return (
    <header className="sticky top-0 z-50 border-b border-qw-border/50 bg-qw-darker/95 backdrop-blur-sm">
      <div className="max-w-7xl mx-auto px-4">
        <div className="flex items-center justify-between h-12">
          {/* Logo — text only */}
          <button
            onClick={() => onGoHome?.()}
            className="flex items-center gap-2 hover:opacity-70 transition-opacity"
          >
            <span className="font-display font-bold text-sm tracking-tight text-qw-accent">
              QWICKY
            </span>
          </button>

          {/* Nav — flat text links */}
          <nav className="flex items-center gap-1">
            <button
              onClick={() => setActiveTab('info')}
              className={`px-3 py-1.5 text-xs font-medium rounded transition-colors ${
                activeTab === 'info'
                  ? 'bg-qw-accent text-qw-darker'
                  : 'text-qw-muted hover:text-white'
              }`}
            >
              {tournament.name || 'Tournament'}
            </button>

            <button
              onClick={() => setActiveTab('divisions')}
              className={`px-3 py-1.5 text-xs font-medium rounded transition-colors ${
                activeTab === 'divisions'
                  ? 'bg-qw-accent text-qw-darker'
                  : 'text-qw-muted hover:text-white'
              }`}
            >
              Divisions{divisions.length > 0 ? ` (${divisions.length})` : ''}
            </button>

            <button
              onClick={() => setActiveTab('leaderboard')}
              className={`px-3 py-1.5 text-xs font-medium rounded transition-colors ${
                activeTab === 'leaderboard'
                  ? 'bg-qw-accent text-qw-darker'
                  : 'text-qw-muted hover:text-white'
              }`}
            >
              Leaderboard
            </button>

            {divisions.length > 0 && (
              <div className="relative">
                <button
                  onClick={() => setShowDivisionDropdown(!showDivisionDropdown)}
                  className={`px-3 py-1.5 text-xs font-medium rounded transition-colors flex items-center gap-1.5 ${
                    activeTab === 'division'
                      ? 'bg-qw-accent text-qw-darker'
                      : 'text-qw-muted hover:text-white'
                  }`}
                >
                  {activeDivName || 'Select'}
                  <svg
                    className={`w-3 h-3 transition-transform ${showDivisionDropdown ? 'rotate-180' : ''}`}
                    fill="currentColor"
                    viewBox="0 0 12 12"
                  >
                    <path d="M6 8L1 3h10z" />
                  </svg>
                </button>

                {showDivisionDropdown && (
                  <>
                    <div
                      className="fixed inset-0 z-40"
                      onClick={() => setShowDivisionDropdown(false)}
                    />
                    <div className="absolute top-full right-0 mt-1 w-48 bg-qw-dark border border-qw-border rounded-md z-50 overflow-hidden py-1">
                      {divisions.map((div) => (
                        <button
                          key={div.id}
                          onClick={() => handleSelectDivision(div.id)}
                          className={`w-full px-3 py-2 text-left text-xs transition-colors ${
                            div.id === activeDivisionId
                              ? 'text-qw-accent bg-qw-accent/10'
                              : 'text-qw-text hover:bg-qw-border/50'
                          }`}
                        >
                          <span className="font-medium">{div.name}</span>
                          <span className="text-qw-muted ml-2">{div.teams?.length || 0}</span>
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </div>
            )}
          </nav>

          {/* File controls — minimal */}
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleImport}
            accept=".json"
            className="hidden"
          />
          <div className="flex items-center gap-2">
            <button
              onClick={() => fileInputRef.current?.click()}
              className="text-xs text-qw-muted hover:text-white transition-colors"
              title="Load"
            >
              Load
            </button>
            <button
              onClick={handleExport}
              className="text-xs text-qw-muted hover:text-white transition-colors"
              title="Save"
            >
              Save
            </button>
            <button
              onClick={handleResetClick}
              className="text-xs text-qw-muted hover:text-red-400 transition-colors"
              title="Reset"
            >
              Reset
            </button>
          </div>
        </div>
      </div>

      {/* Import confirm modal */}
      {pendingImport && (
        <ConfirmModal
          title="Replace tournament data?"
          body="Replace current tournament with imported data? This will overwrite everything."
          confirmLabel="Replace"
          cancelLabel="Cancel"
          variant="default"
          onConfirm={handleImportConfirm}
          onCancel={() => setPendingImport(null)}
        />
      )}

      {/* Reset step 1 */}
      {resetStep === 'step1' && (
        <ConfirmModal
          title="Reset tournament?"
          body="This will permanently delete all tournament data including divisions, teams, schedule, and results. This cannot be undone."
          confirmLabel="Continue"
          cancelLabel="Cancel"
          variant="danger"
          onConfirm={handleResetStep1Confirm}
          onCancel={() => setResetStep(null)}
        />
      )}

      {/* Reset step 2 */}
      {resetStep === 'step2' && (
        <ConfirmModal
          title="Are you sure?"
          body={
            <span>
              You are about to permanently reset{' '}
              <strong className="text-white">{tournament.name || 'this tournament'}</strong>.
              {divisionCount > 0 && (
                <span>
                  {' '}
                  This includes{' '}
                  <strong className="text-white">
                    {divisions.length} division{divisions.length !== 1 ? 's' : ''}
                  </strong>
                  {divisionCount > 0
                    ? `, ${divisionCount} team${divisionCount !== 1 ? 's' : ''}`
                    : ''}
                  {scheduleCount > 0
                    ? `, and ${scheduleCount} scheduled match${scheduleCount !== 1 ? 'es' : ''}`
                    : ''}
                  .
                </span>
              )}
            </span>
          }
          confirmLabel="Reset Anyway"
          cancelLabel="Cancel"
          variant="danger"
          onConfirm={handleResetStep2Confirm}
          onCancel={() => setResetStep(null)}
        />
      )}
    </header>
  );
}
