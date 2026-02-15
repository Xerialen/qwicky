// src/components/SetupWizard.jsx
import React, { useState, useEffect } from 'react';
import WizardStepIndicator from './WizardStepIndicator';
import DivisionSetup from './division/DivisionSetup';
import DivisionTeams from './division/DivisionTeams';

const GAME_MODES = [
  { value: '4on4', label: '4on4', desc: 'Classic team deathmatch' },
  { value: '2on2', label: '2on2', desc: 'Two-player teams' },
  { value: '1on1', label: '1on1', desc: 'Duel' },
  { value: 'ctf', label: 'CTF', desc: 'Capture the Flag' },
];

const DIVISION_PRESETS = ['Division 1', 'Division 2', 'Division 3', 'Pro', 'Open'];

export default function SetupWizard({
  tournament,
  updateTournamentInfo,
  addDivision,
  removeDivision,
  updateDivision,
  onComplete,
  onSkipToApp,
  onBackToLanding,
}) {
  const [step, setStep] = useState(() => {
    const skipWelcome = localStorage.getItem('qw-skip-welcome') === 'true';
    return skipWelcome ? 1 : 0;
  });
  const [skipWelcome, setSkipWelcome] = useState(
    () => localStorage.getItem('qw-skip-welcome') === 'true'
  );
  const [wizardDivisionIndex, setWizardDivisionIndex] = useState(0);

  // Custom division name input
  const [customDivName, setCustomDivName] = useState('');

  useEffect(() => {
    localStorage.setItem('qw-skip-welcome', skipWelcome ? 'true' : 'false');
  }, [skipWelcome]);

  const divisions = tournament.divisions || [];
  const totalDivisions = divisions.length;

  // Current division for steps 3 & 4
  const currentDivision = divisions[wizardDivisionIndex] || null;

  const canNext = () => {
    switch (step) {
      case 0: return true;
      case 1: return (tournament.name || '').trim().length > 0;
      case 2: return divisions.length >= 1;
      case 3: return true;
      case 4: return true;
      case 5: return true;
      default: return true;
    }
  };

  const handleNext = () => {
    // Steps 3 & 4: cycle through divisions before advancing
    if ((step === 3 || step === 4) && wizardDivisionIndex < totalDivisions - 1) {
      setWizardDivisionIndex(prev => prev + 1);
      return;
    }

    if (step < 5) {
      const nextStep = step + 1;
      setStep(nextStep);
      // Reset division cycling when entering step 3 or 4
      if (nextStep === 3 || nextStep === 4) {
        setWizardDivisionIndex(0);
      }
    }
  };

  const handleBack = () => {
    // Steps 3 & 4: cycle backwards through divisions first
    if ((step === 3 || step === 4) && wizardDivisionIndex > 0) {
      setWizardDivisionIndex(prev => prev - 1);
      return;
    }

    if (step === 0) {
      onBackToLanding();
    } else {
      const prevStep = step - 1;
      setStep(prevStep);
      // When going back to step 3 or 4, start at last division
      if (prevStep === 3 || prevStep === 4) {
        setWizardDivisionIndex(Math.max(0, totalDivisions - 1));
      }
    }
  };

  const handleStepClick = (targetStep) => {
    setStep(targetStep);
    if (targetStep === 3 || targetStep === 4) {
      setWizardDivisionIndex(0);
    }
  };

  const handleSkipRemaining = () => {
    if (step === 3) {
      setStep(4);
      setWizardDivisionIndex(0);
    } else if (step === 4) {
      setStep(5);
    }
  };

  const handleAddPreset = (name) => {
    // Avoid duplicates
    if (divisions.some(d => d.name === name)) return;
    addDivision(name);
  };

  const handleAddCustom = () => {
    const name = customDivName.trim();
    if (!name) return;
    if (divisions.some(d => d.name === name)) return;
    addDivision(name);
    setCustomDivName('');
  };

  const handleRemoveDivision = (divId) => {
    removeDivision(divId);
    // Fix cycling index if needed
    if (wizardDivisionIndex >= divisions.length - 1) {
      setWizardDivisionIndex(Math.max(0, divisions.length - 2));
    }
  };

  // ─── Step renderers ────────────────────────────────────────────────

  const renderStep0 = () => (
    <div className="space-y-6">
      <div className="text-center mb-8">
        <h2 className="font-display font-bold text-2xl text-white mb-2">
          Welcome to QWICKY
        </h2>
        <p className="text-qw-muted">
          A few things to know before you start
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="qw-panel p-5">
          <div className="text-2xl mb-3">
            <svg className="w-8 h-8 text-qw-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
          </div>
          <h3 className="font-display font-semibold text-white mb-1">Browser Storage Only</h3>
          <p className="text-sm text-qw-muted">
            Your tournament data lives in this browser's local storage. It persists across sessions but isn't synced anywhere.
          </p>
        </div>

        <div className="qw-panel p-5">
          <div className="text-2xl mb-3">
            <svg className="w-8 h-8 text-qw-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
          </div>
          <h3 className="font-display font-semibold text-white mb-1">Export & Import</h3>
          <p className="text-sm text-qw-muted">
            Save your work by exporting to a JSON file. You can import it back anytime — even on a different computer.
          </p>
        </div>

        <div className="qw-panel p-5">
          <div className="text-2xl mb-3">
            <svg className="w-8 h-8 text-qw-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
          </div>
          <h3 className="font-display font-semibold text-white mb-1">Discord Bot (Optional)</h3>
          <p className="text-sm text-qw-muted">
            Players can submit match results via Discord. You'll review and approve them in the app's Results tab.
          </p>
        </div>
      </div>

      <label className="flex items-center gap-2 justify-center text-sm text-qw-muted cursor-pointer mt-4">
        <input
          type="checkbox"
          checked={skipWelcome}
          onChange={(e) => setSkipWelcome(e.target.checked)}
          className="rounded border-qw-border bg-qw-dark text-qw-accent focus:ring-qw-accent"
        />
        Don't show this again
      </label>
    </div>
  );

  const renderStep1 = () => (
    <div className="space-y-6 max-w-lg mx-auto">
      <div className="text-center mb-6">
        <h2 className="font-display font-bold text-2xl text-white mb-2">
          Tournament Basics
        </h2>
        <p className="text-qw-muted">
          Name your tournament and pick a game mode
        </p>
      </div>

      {/* Tournament name */}
      <div>
        <label className="block text-sm font-semibold text-qw-muted mb-1.5">
          Tournament Name <span className="text-qw-loss">*</span>
        </label>
        <input
          type="text"
          value={tournament.name || ''}
          onChange={(e) => updateTournamentInfo({ name: e.target.value })}
          placeholder="e.g. EQL Season 38"
          className="w-full bg-qw-dark border border-qw-border rounded-lg px-4 py-3 text-white placeholder-qw-muted/50 focus:outline-none focus:border-qw-accent focus:shadow-input-focus transition-all text-lg"
          autoFocus
        />
      </div>

      {/* Game mode */}
      <div>
        <label className="block text-sm font-semibold text-qw-muted mb-2">
          Game Mode
        </label>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {GAME_MODES.map((mode) => (
            <button
              key={mode.value}
              type="button"
              onClick={() => updateTournamentInfo({ mode: mode.value })}
              className={`
                p-3 rounded-lg border-2 text-center transition-all
                ${tournament.mode === mode.value
                  ? 'border-qw-accent bg-qw-accent/10 text-white'
                  : 'border-qw-border bg-qw-dark text-qw-muted hover:border-qw-accent/50 hover:text-white'
                }
              `}
            >
              <div className="font-display font-bold text-lg">{mode.label}</div>
              <div className="text-xs mt-0.5 opacity-70">{mode.desc}</div>
            </button>
          ))}
        </div>
      </div>

      {/* Dates */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-semibold text-qw-muted mb-1.5">
            Start Date
          </label>
          <input
            type="date"
            value={tournament.startDate || ''}
            onChange={(e) => updateTournamentInfo({ startDate: e.target.value })}
            className="w-full bg-qw-dark border border-qw-border rounded-lg px-3 py-2.5 text-white focus:outline-none focus:border-qw-accent focus:shadow-input-focus transition-all"
          />
        </div>
        <div>
          <label className="block text-sm font-semibold text-qw-muted mb-1.5">
            End Date
          </label>
          <input
            type="date"
            value={tournament.endDate || ''}
            onChange={(e) => updateTournamentInfo({ endDate: e.target.value })}
            className="w-full bg-qw-dark border border-qw-border rounded-lg px-3 py-2.5 text-white focus:outline-none focus:border-qw-accent focus:shadow-input-focus transition-all"
          />
        </div>
      </div>
    </div>
  );

  const renderStep2 = () => (
    <div className="space-y-6 max-w-lg mx-auto">
      <div className="text-center mb-6">
        <h2 className="font-display font-bold text-2xl text-white mb-2">
          Create Divisions
        </h2>
        <p className="text-qw-muted">
          Most tournaments have 2-3 skill-based divisions
        </p>
      </div>

      {/* Preset buttons */}
      <div>
        <label className="block text-sm font-semibold text-qw-muted mb-2">
          Quick Add
        </label>
        <div className="flex flex-wrap gap-2">
          {DIVISION_PRESETS.map((name) => {
            const exists = divisions.some(d => d.name === name);
            return (
              <button
                key={name}
                type="button"
                onClick={() => handleAddPreset(name)}
                disabled={exists}
                className={`
                  px-4 py-2 rounded-lg text-sm font-semibold transition-all
                  ${exists
                    ? 'bg-qw-accent/20 text-qw-accent border border-qw-accent/30 cursor-default'
                    : 'bg-qw-dark border border-qw-border text-qw-muted hover:text-white hover:border-qw-accent'
                  }
                `}
              >
                {exists ? '+ ' : '+ '}{name}
              </button>
            );
          })}
        </div>
      </div>

      {/* Custom name */}
      <div>
        <label className="block text-sm font-semibold text-qw-muted mb-1.5">
          Custom Division Name
        </label>
        <div className="flex gap-2">
          <input
            type="text"
            value={customDivName}
            onChange={(e) => setCustomDivName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleAddCustom()}
            placeholder="e.g. Rookie"
            className="flex-1 bg-qw-dark border border-qw-border rounded-lg px-3 py-2.5 text-white placeholder-qw-muted/50 focus:outline-none focus:border-qw-accent focus:shadow-input-focus transition-all"
          />
          <button
            type="button"
            onClick={handleAddCustom}
            disabled={!customDivName.trim()}
            className="qw-btn px-4 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Add
          </button>
        </div>
      </div>

      {/* Created divisions list */}
      {divisions.length > 0 && (
        <div>
          <label className="block text-sm font-semibold text-qw-muted mb-2">
            Divisions ({divisions.length})
          </label>
          <div className="space-y-2">
            {divisions.map((div, idx) => (
              <div
                key={div.id}
                className="flex items-center justify-between bg-qw-dark border border-qw-border rounded-lg px-4 py-3"
              >
                <div className="flex items-center gap-3">
                  <span className="w-6 h-6 bg-qw-border rounded flex items-center justify-center text-xs font-mono text-qw-muted">
                    {idx + 1}
                  </span>
                  <span className="font-semibold text-white">{div.name}</span>
                </div>
                <button
                  type="button"
                  onClick={() => handleRemoveDivision(div.id)}
                  className="text-qw-muted hover:text-qw-loss transition-colors p-1"
                  title="Remove division"
                >
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                  </svg>
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {divisions.length === 0 && (
        <p className="text-center text-qw-muted text-sm py-4">
          Add at least one division to continue
        </p>
      )}
    </div>
  );

  const renderStep3 = () => {
    if (!currentDivision) {
      return (
        <div className="text-center py-12 text-qw-muted">
          No divisions to configure. Go back and create some.
        </div>
      );
    }

    return (
      <div className="space-y-4">
        {/* Division selector header */}
        <div className="text-center mb-4">
          <h2 className="font-display font-bold text-2xl text-white mb-2">
            Division Format
          </h2>
          {totalDivisions > 1 && (
            <div className="flex items-center justify-center gap-2 mt-3">
              {divisions.map((div, idx) => (
                <button
                  key={div.id}
                  type="button"
                  onClick={() => setWizardDivisionIndex(idx)}
                  className={`
                    px-3 py-1 rounded-full text-xs font-semibold transition-all
                    ${idx === wizardDivisionIndex
                      ? 'bg-qw-accent text-qw-dark'
                      : 'bg-qw-dark border border-qw-border text-qw-muted hover:text-white'
                    }
                  `}
                >
                  {div.name}
                </button>
              ))}
            </div>
          )}
          <p className="text-qw-muted text-sm mt-2">
            Configuring: {currentDivision.name} ({wizardDivisionIndex + 1} of {totalDivisions})
          </p>
        </div>

        {/* Embedded DivisionSetup */}
        <DivisionSetup
          division={currentDivision}
          updateDivision={(updates) => updateDivision(currentDivision.id, updates)}
        />

        {/* Skip remaining link */}
        {totalDivisions > 1 && wizardDivisionIndex < totalDivisions - 1 && (
          <div className="text-center pt-2">
            <button
              type="button"
              onClick={handleSkipRemaining}
              className="text-sm text-qw-muted hover:text-qw-accent transition-colors underline"
            >
              Skip remaining divisions
            </button>
          </div>
        )}
      </div>
    );
  };

  const renderStep4 = () => {
    if (!currentDivision) {
      return (
        <div className="text-center py-12 text-qw-muted">
          No divisions to configure.
        </div>
      );
    }

    return (
      <div className="space-y-4">
        {/* Division selector header */}
        <div className="text-center mb-4">
          <h2 className="font-display font-bold text-2xl text-white mb-2">
            Add Teams
          </h2>
          {totalDivisions > 1 && (
            <div className="flex items-center justify-center gap-2 mt-3">
              {divisions.map((div, idx) => (
                <button
                  key={div.id}
                  type="button"
                  onClick={() => setWizardDivisionIndex(idx)}
                  className={`
                    px-3 py-1 rounded-full text-xs font-semibold transition-all
                    ${idx === wizardDivisionIndex
                      ? 'bg-qw-accent text-qw-dark'
                      : 'bg-qw-dark border border-qw-border text-qw-muted hover:text-white'
                    }
                  `}
                >
                  {div.name}
                </button>
              ))}
            </div>
          )}
          <p className="text-qw-muted text-sm mt-2">
            {currentDivision.name} ({wizardDivisionIndex + 1} of {totalDivisions})
            <span className="mx-2">·</span>
            <span className="text-qw-muted/70">You can also add teams later from the main app</span>
          </p>
        </div>

        {/* Embedded DivisionTeams */}
        <DivisionTeams
          division={currentDivision}
          updateDivision={(updates) => updateDivision(currentDivision.id, updates)}
          tournamentMode={tournament.mode}
          allDivisions={tournament.divisions}
        />

        {/* Skip links */}
        <div className="text-center pt-2 flex items-center justify-center gap-4">
          {totalDivisions > 1 && wizardDivisionIndex < totalDivisions - 1 && (
            <button
              type="button"
              onClick={handleSkipRemaining}
              className="text-sm text-qw-muted hover:text-qw-accent transition-colors underline"
            >
              Skip remaining divisions
            </button>
          )}
        </div>
      </div>
    );
  };

  const renderStep5 = () => {
    const formatLabel = (f) => {
      switch (f) {
        case 'groups': return 'Groups + Playoffs';
        case 'single-elim': return 'Single Elimination';
        case 'double-elim': return 'Double Elimination';
        case 'multi-tier': return 'Multi-Tier Playoffs';
        default: return f;
      }
    };

    return (
      <div className="space-y-6 max-w-lg mx-auto">
        <div className="text-center mb-6">
          <h2 className="font-display font-bold text-2xl text-white mb-2">
            You're All Set!
          </h2>
          <p className="text-qw-muted">
            Here's a summary of your tournament
          </p>
        </div>

        {/* Summary card */}
        <div className="qw-panel p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-display font-bold text-lg text-white">
              {tournament.name}
            </h3>
            <span className="px-2 py-0.5 bg-qw-accent/20 text-qw-accent rounded text-xs font-mono font-semibold">
              {tournament.mode}
            </span>
          </div>

          {(tournament.startDate || tournament.endDate) && (
            <p className="text-sm text-qw-muted">
              {tournament.startDate || '?'} — {tournament.endDate || '?'}
            </p>
          )}

          <div className="border-t border-qw-border pt-3 space-y-2">
            {divisions.map((div) => (
              <div key={div.id} className="flex items-center justify-between text-sm">
                <span className="text-white font-semibold">{div.name}</span>
                <span className="text-qw-muted font-mono text-xs">
                  {formatLabel(div.format)} · {div.teams?.length || 0} teams
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* What's next */}
        <div className="qw-panel p-5">
          <h4 className="font-display font-semibold text-white mb-3">What's next</h4>
          <ul className="space-y-2 text-sm text-qw-muted">
            <li className="flex items-start gap-2">
              <span className="text-qw-accent mt-0.5">&#9656;</span>
              <span>Generate the <strong className="text-white">schedule</strong> for each division</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-qw-accent mt-0.5">&#9656;</span>
              <span>Enter <strong className="text-white">results</strong> manually or via Discord integration</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-qw-accent mt-0.5">&#9656;</span>
              <span>Export to <strong className="text-white">MediaWiki</strong> format for league pages</span>
            </li>
          </ul>
        </div>

        <p className="text-center text-sm text-qw-muted">
          Remember to <strong className="text-qw-accent">save (export)</strong> your work regularly!
        </p>

        <div className="text-center pt-2">
          <button
            type="button"
            onClick={onComplete}
            className="qw-btn px-8 py-3 text-lg"
          >
            Open Tournament &rarr;
          </button>
        </div>
      </div>
    );
  };

  const renderCurrentStep = () => {
    switch (step) {
      case 0: return renderStep0();
      case 1: return renderStep1();
      case 2: return renderStep2();
      case 3: return renderStep3();
      case 4: return renderStep4();
      case 5: return renderStep5();
      default: return null;
    }
  };

  return (
    <div className="min-h-screen bg-qw-darker flex flex-col">
      {/* Top bar with branding + skip */}
      <div className="bg-qw-panel border-b border-qw-border px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center"
            style={{ background: '#FFB300' }}
          >
            <span className="font-logo font-black text-sm" style={{ color: '#121212' }}>QW</span>
          </div>
          <span className="font-display font-bold text-white text-sm">QWICKY</span>
          <span className="text-qw-muted text-xs ml-1">Setup</span>
        </div>
        {step >= 1 && (
          <button
            type="button"
            onClick={onSkipToApp}
            className="text-xs text-qw-muted hover:text-qw-accent transition-colors"
          >
            Skip setup &rarr;
          </button>
        )}
      </div>

      {/* Step indicator */}
      <div className="bg-qw-panel/50 border-b border-qw-border">
        <div className="max-w-2xl mx-auto">
          <WizardStepIndicator currentStep={step} onStepClick={handleStepClick} />
        </div>
      </div>

      {/* Step content */}
      <div className="flex-1 max-w-5xl w-full mx-auto px-4 py-8">
        {renderCurrentStep()}
      </div>

      {/* Navigation buttons (not shown on step 5 — it has its own CTA) */}
      {step < 5 && (
        <div className="bg-qw-panel border-t border-qw-border px-4 py-4">
          <div className="max-w-5xl mx-auto flex items-center justify-between">
            <button
              type="button"
              onClick={handleBack}
              className="qw-btn-secondary px-5 py-2.5 flex items-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              Back
            </button>

            {/* Step 3/4 context: show which division we're on */}
            {(step === 3 || step === 4) && totalDivisions > 1 && (
              <span className="text-xs text-qw-muted font-mono">
                {wizardDivisionIndex + 1} / {totalDivisions}
              </span>
            )}

            <button
              type="button"
              onClick={handleNext}
              disabled={!canNext()}
              className="qw-btn px-5 py-2.5 flex items-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {(step === 3 || step === 4) && wizardDivisionIndex < totalDivisions - 1
                ? 'Next Division'
                : 'Next'
              }
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
