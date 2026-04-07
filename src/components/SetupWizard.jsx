// src/components/SetupWizard.jsx
import React, { useState, useEffect } from 'react';
import WizardStepIndicator from './WizardStepIndicator';
import DivisionSetup from './division/DivisionSetup';
import DivisionTeams from './division/DivisionTeams';
import MaterialIcon from './ui/MaterialIcon';

const GAME_MODES = [
  { value: '4on4', label: '4on4', desc: 'Classic team deathmatch', icon: 'groups' },
  { value: '2on2', label: '2on2', desc: 'Two-player teams', icon: 'group' },
  { value: '1on1', label: '1on1', desc: 'Duel', icon: 'person' },
  { value: 'ctf', label: 'CTF', desc: 'Capture the Flag', icon: 'flag' },
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
  const [customDivName, setCustomDivName] = useState('');

  useEffect(() => {
    localStorage.setItem('qw-skip-welcome', skipWelcome ? 'true' : 'false');
  }, [skipWelcome]);

  const divisions = tournament.divisions || [];
  const totalDivisions = divisions.length;
  const currentDivision = divisions[wizardDivisionIndex] || null;

  const canNext = () => {
    switch (step) {
      case 0: return true;
      case 1: return (tournament.name || '').trim().length > 0;
      case 2: return divisions.length >= 1;
      default: return true;
    }
  };

  const handleNext = () => {
    if ((step === 3 || step === 4) && wizardDivisionIndex < totalDivisions - 1) {
      setWizardDivisionIndex((prev) => prev + 1);
      return;
    }
    if (step < 5) {
      const nextStep = step + 1;
      setStep(nextStep);
      if (nextStep === 3 || nextStep === 4) setWizardDivisionIndex(0);
    }
  };

  const handleBack = () => {
    if ((step === 3 || step === 4) && wizardDivisionIndex > 0) {
      setWizardDivisionIndex((prev) => prev - 1);
      return;
    }
    if (step === 0) {
      onBackToLanding();
    } else {
      const prevStep = step - 1;
      setStep(prevStep);
      if (prevStep === 3 || prevStep === 4) {
        setWizardDivisionIndex(Math.max(0, totalDivisions - 1));
      }
    }
  };

  const handleStepClick = (targetStep) => {
    setStep(targetStep);
    if (targetStep === 3 || targetStep === 4) setWizardDivisionIndex(0);
  };

  const handleSkipRemaining = () => {
    if (step === 3) { setStep(4); setWizardDivisionIndex(0); }
    else if (step === 4) { setStep(5); }
  };

  const handleAddPreset = (name) => {
    if (divisions.some((d) => d.name === name)) return;
    addDivision(name);
  };

  const handleAddCustom = () => {
    const name = customDivName.trim();
    if (!name || divisions.some((d) => d.name === name)) return;
    addDivision(name);
    setCustomDivName('');
  };

  const handleRemoveDivision = (divId) => {
    removeDivision(divId);
    if (wizardDivisionIndex >= divisions.length - 1) {
      setWizardDivisionIndex(Math.max(0, divisions.length - 2));
    }
  };

  // ─── Step renderers ────────────────────────────────────────────

  const renderStep0 = () => (
    <div>
      <div className="flex items-baseline gap-3 mb-8">
        <h1 className="text-4xl md:text-5xl font-headline font-black uppercase tracking-tighter text-on-surface">
          WELCOME TO QWICKY, ADMIN
        </h1>
        <span className="w-3 h-3 bg-primary animate-pulse" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[
          { icon: 'save', title: 'Local Storage', desc: 'All tournament data lives in your browser\'s local cache. No central server is used.' },
          { icon: 'upload_file', title: 'JSON Portability', desc: 'Use Export/Import to create physical backups of your tournament state and rosters.' },
          { icon: 'forum', title: 'Discord Bot', desc: 'Optionally connect a webhook to broadcast match results to your community server.' },
        ].map((card) => (
          <div key={card.icon} className="bg-surface-container-high p-5 border-l-4 border-outline-variant hover:border-primary transition-colors group">
            <MaterialIcon name={card.icon} className="text-primary mb-3 group-hover:scale-110 transition-transform" />
            <h3 className="font-headline font-bold text-xs uppercase tracking-widest mb-2 text-on-surface">
              {card.title}
            </h3>
            <p className="text-xs text-on-surface-variant leading-relaxed">{card.desc}</p>
          </div>
        ))}
      </div>

      <label className="flex items-center gap-3 mt-6 cursor-pointer group">
        <input
          type="checkbox"
          checked={skipWelcome}
          onChange={(e) => setSkipWelcome(e.target.checked)}
        />
        <span className="font-mono text-[10px] text-on-surface-variant uppercase tracking-widest">
          Don't show this orientation again.
        </span>
      </label>
    </div>
  );

  const renderStep1 = () => (
    <div className="space-y-8">
      <div className="flex items-center gap-4">
        <h2 className="font-headline font-bold text-sm uppercase tracking-widest text-secondary flex-shrink-0">
          Tournament Basics
        </h2>
        <div className="h-px w-full bg-outline-variant opacity-20" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <div className="space-y-2">
          <label className="font-headline text-[10px] uppercase tracking-[0.2em] text-on-surface-variant font-bold">
            Tournament Name
          </label>
          <input
            type="text"
            value={tournament.name || ''}
            onChange={(e) => updateTournamentInfo({ name: e.target.value })}
            placeholder="E.G. EQL SEASON 38"
            className="w-full"
            autoFocus
          />
        </div>

        <div className="space-y-2">
          <label className="font-headline text-[10px] uppercase tracking-[0.2em] text-on-surface-variant font-bold">
            Game Mode
          </label>
          <div className="flex flex-wrap gap-2">
            {GAME_MODES.map((mode) => (
              <label key={mode.value} className="relative flex-grow flex flex-col items-center justify-center p-3 bg-surface-container-high border border-outline-variant cursor-pointer hover:bg-surface-container-highest transition-colors">
                <input
                  type="radio"
                  name="gamemode"
                  checked={tournament.mode === mode.value}
                  onChange={() => updateTournamentInfo({ mode: mode.value })}
                  className="absolute opacity-0 peer"
                />
                <div className="peer-checked:text-primary transition-colors text-center text-on-surface-variant">
                  <MaterialIcon name={mode.icon} className="block mb-1" />
                  <span className="font-headline text-[9px] font-black tracking-widest uppercase">
                    {mode.label}
                  </span>
                </div>
                <div className="absolute inset-0 border-2 border-primary opacity-0 peer-checked:opacity-100 pointer-events-none" />
              </label>
            ))}
          </div>
        </div>

        <div className="md:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="space-y-2">
            <label className="font-headline text-[10px] uppercase tracking-[0.2em] text-on-surface-variant font-bold">
              Start Date (Optional)
            </label>
            <input
              type="date"
              value={tournament.startDate || ''}
              onChange={(e) => updateTournamentInfo({ startDate: e.target.value })}
              className="w-full"
            />
          </div>
          <div className="space-y-2">
            <label className="font-headline text-[10px] uppercase tracking-[0.2em] text-on-surface-variant font-bold">
              End Date (Optional)
            </label>
            <input
              type="date"
              value={tournament.endDate || ''}
              onChange={(e) => updateTournamentInfo({ endDate: e.target.value })}
              className="w-full"
            />
          </div>
        </div>
      </div>
    </div>
  );

  const renderStep2 = () => (
    <div className="space-y-8">
      <div>
        <h1 className="font-headline text-4xl font-black text-on-surface uppercase tracking-tighter mb-2">
          ESTABLISH YOUR SECTORS
        </h1>
        <p className="text-on-surface-variant text-sm leading-relaxed max-w-md">
          QuakeWorld is best played in skill tiers. How many divisions do you need?
        </p>
      </div>

      {/* Presets */}
      <div className="grid grid-cols-1 gap-2">
        {DIVISION_PRESETS.slice(0, 3).map((name, i) => {
          const exists = divisions.some((d) => d.name === name);
          return (
            <button
              key={name}
              onClick={() => handleAddPreset(name)}
              disabled={exists}
              className={`flex justify-between items-center p-4 border-l-4 transition-all text-left ${
                exists
                  ? 'bg-surface-container-high border-primary'
                  : 'bg-surface-container-lowest border-outline-variant hover:border-primary'
              }`}
            >
              <span className={`font-headline font-bold uppercase tracking-widest text-sm ${exists ? 'text-on-surface' : 'text-on-surface-variant'}`}>
                {name}
              </span>
              {exists && <MaterialIcon name="check" className="text-primary text-sm" />}
            </button>
          );
        })}
      </div>

      {/* Custom */}
      <div className="space-y-4">
        <div className="flex justify-between items-end border-b border-outline-variant pb-1">
          <label className="text-secondary font-headline uppercase tracking-widest text-[10px]">
            Active Sectors
          </label>
          {divisions.length === 0 && (
            <span className="text-error font-mono text-[9px] uppercase">
              At least one division required.
            </span>
          )}
        </div>
        <div className="space-y-2">
          {divisions.map((div, idx) => (
            <div key={div.id} className="flex items-center gap-3 bg-surface-container-lowest p-3 border-b border-primary/30">
              <span className="font-mono text-primary text-xs">{String(idx + 1).padStart(2, '0')}</span>
              <span className="flex-1 font-headline uppercase font-bold tracking-widest text-sm text-on-surface">
                {div.name}
              </span>
              <button onClick={() => handleRemoveDivision(div.id)} className="text-on-surface-variant/40 hover:text-error transition-colors">
                <MaterialIcon name="delete" className="text-sm" />
              </button>
            </div>
          ))}
          <div className="flex items-center gap-3 bg-surface-container-lowest p-3 border-b border-outline-variant/30">
            <span className="font-mono text-on-surface-variant/30 text-xs">{String(divisions.length + 1).padStart(2, '0')}</span>
            <input
              type="text"
              value={customDivName}
              onChange={(e) => setCustomDivName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAddCustom()}
              placeholder="Enter sector name..."
              className="flex-1 bg-transparent border-none focus:ring-0 font-headline uppercase font-bold tracking-widest text-sm text-on-surface-variant/50 p-0"
            />
            <button onClick={handleAddCustom} className="text-primary">
              <MaterialIcon name="add_circle" className="text-sm" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  const renderStep3 = () => {
    if (!currentDivision) {
      return <div className="text-center py-12 text-on-surface-variant">No divisions to configure.</div>;
    }
    return (
      <div className="space-y-4">
        <div className="mb-4">
          <h2 className="font-headline font-bold text-2xl text-on-surface uppercase tracking-tighter mb-2">
            FORMAT FOR {currentDivision.name.toUpperCase()}
          </h2>
          {totalDivisions > 1 && (
            <div className="flex items-center gap-2 mt-3">
              {divisions.map((div, idx) => (
                <button
                  key={div.id}
                  onClick={() => setWizardDivisionIndex(idx)}
                  className={`px-3 py-1 text-xs font-bold uppercase tracking-widest transition-all ${
                    idx === wizardDivisionIndex
                      ? 'bg-primary text-on-primary-fixed'
                      : 'bg-surface-container-high text-on-surface-variant hover:text-on-surface'
                  }`}
                >
                  {div.name}
                </button>
              ))}
            </div>
          )}
        </div>
        <DivisionSetup
          division={currentDivision}
          updateDivision={(updates) => updateDivision(currentDivision.id, updates)}
        />
        {totalDivisions > 1 && wizardDivisionIndex < totalDivisions - 1 && (
          <div className="text-center pt-2">
            <button onClick={handleSkipRemaining} className="font-mono text-[11px] text-on-surface-variant hover:text-primary transition-colors uppercase tracking-widest">
              Skip remaining divisions
            </button>
          </div>
        )}
      </div>
    );
  };

  const renderStep4 = () => {
    if (!currentDivision) {
      return <div className="text-center py-12 text-on-surface-variant">No divisions to configure.</div>;
    }
    return (
      <div className="space-y-4">
        <div className="mb-4">
          <h1 className="font-headline text-4xl font-black text-on-surface tracking-tighter uppercase mb-2">
            RECRUIT THE SQUADS
          </h1>
          <p className="text-on-surface-variant text-sm border-l-2 border-primary pl-4">
            Assign teams to <span className="text-primary font-bold">{currentDivision.name.toUpperCase()}</span>
          </p>
          {totalDivisions > 1 && (
            <div className="flex items-center gap-2 mt-3">
              {divisions.map((div, idx) => (
                <button
                  key={div.id}
                  onClick={() => setWizardDivisionIndex(idx)}
                  className={`px-3 py-1 text-xs font-bold uppercase tracking-widest transition-all ${
                    idx === wizardDivisionIndex
                      ? 'bg-primary text-on-primary-fixed'
                      : 'bg-surface-container-high text-on-surface-variant hover:text-on-surface'
                  }`}
                >
                  {div.name}
                </button>
              ))}
            </div>
          )}
        </div>
        <DivisionTeams
          division={currentDivision}
          updateDivision={(updates) => updateDivision(currentDivision.id, updates)}
          tournamentMode={tournament.mode}
          allDivisions={tournament.divisions}
        />
        {totalDivisions > 1 && wizardDivisionIndex < totalDivisions - 1 && (
          <div className="text-center pt-2">
            <button onClick={handleSkipRemaining} className="font-mono text-[11px] text-on-surface-variant hover:text-primary transition-colors uppercase tracking-widest">
              Skip remaining divisions
            </button>
          </div>
        )}
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
          <h2 className="font-headline font-black text-3xl text-on-surface uppercase tracking-tighter mb-2">
            LAUNCH READY
          </h2>
          <p className="text-on-surface-variant font-mono text-xs uppercase tracking-widest">
            Tournament configuration complete
          </p>
        </div>

        <div className="bg-surface-container-high p-6 space-y-4 relative border-t border-l border-outline-variant/20">
          <div className="flex items-center justify-between">
            <h3 className="font-headline text-2xl font-black text-primary tracking-tighter">
              {tournament.name}
            </h3>
            <span className="px-2 py-0.5 bg-primary-container/20 text-primary font-mono text-xs font-bold">
              {tournament.mode?.toUpperCase()}
            </span>
          </div>

          {(tournament.startDate || tournament.endDate) && (
            <p className="text-sm text-on-surface-variant font-mono">
              {tournament.startDate || '?'} — {tournament.endDate || '?'}
            </p>
          )}

          <div className="border-t border-outline-variant/20 pt-3 space-y-2">
            {divisions.map((div) => (
              <div key={div.id} className="flex justify-between items-center bg-surface p-2 text-[10px] font-mono">
                <span className="text-on-surface uppercase">{div.name}</span>
                <span className="text-primary">{div.teams?.length || 0} TEAMS</span>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-surface-container-low p-6 border border-outline-variant/10">
          <h3 className="font-headline text-[10px] font-bold tracking-widest text-on-surface-variant uppercase mb-4">
            What's Next?
          </h3>
          <div className="space-y-3">
            {['Generate Schedule', 'Sync Discord Bot', 'Enter Opening Matches'].map((item) => (
              <div key={item} className="flex items-center gap-3">
                <div className="w-4 h-4 border border-outline-variant bg-background" />
                <span className="font-mono text-[11px] text-on-surface-variant/60">{item}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="pt-4">
          <button onClick={onComplete} className="w-full heat-gradient text-on-primary-fixed font-headline font-black text-lg py-5 tracking-widest uppercase shadow-heat transition-all active:scale-[0.98]">
            LAUNCH COMMAND CENTER
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

  // ─── Layout ────────────────────────────────────────────────────

  return (
    <div className="h-screen flex flex-col bg-background">
      {/* Top bar */}
      <header className="bg-background border-b-4 border-background flex justify-between items-center w-full px-6 py-3">
        <div className="flex items-center gap-8">
          <span className="text-2xl font-black text-primary-container tracking-tighter font-headline">
            QWICKY
          </span>
          <nav className="hidden md:flex items-center gap-6">
            <span className="font-headline uppercase tracking-widest text-sm font-bold text-primary border-b-2 border-primary-container pb-1">
              Setup
            </span>
          </nav>
        </div>
        {step >= 1 && (
          <button
            onClick={onSkipToApp}
            className="font-headline uppercase tracking-widest text-xs font-bold text-on-surface-variant/40 hover:text-on-surface-variant transition-colors"
          >
            Skip to Dashboard
          </button>
        )}
      </header>

      {/* Main: sidebar + content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Sidebar step indicator */}
        <aside className="hidden md:flex flex-col w-64 bg-surface-container-high p-6 shrink-0">
          <WizardStepIndicator currentStep={step} onStepClick={handleStepClick} />
        </aside>

        {/* Step content */}
        <section className="flex-1 overflow-y-auto bg-surface p-8 md:p-12 space-y-12">
          {/* Mobile step indicator */}
          <div className="md:hidden flex items-center gap-4 mb-4">
            <div className="font-mono text-sm text-secondary tracking-tighter">
              PHASE_{String(step + 1).padStart(2, '0')} / 06
            </div>
            <div className="flex-1 h-1 bg-surface-container-high relative">
              <div className="absolute left-0 top-0 h-full heat-gradient transition-all" style={{ width: `${((step + 1) / 6) * 100}%` }} />
            </div>
          </div>

          {renderCurrentStep()}
        </section>
      </div>

      {/* Navigation footer */}
      {step < 5 && (
        <footer className="bg-surface-container-lowest border-t-2 border-surface-container-high px-8 py-4 flex justify-between items-center z-50">
          <button
            onClick={handleBack}
            className="flex items-center gap-2 text-on-surface-variant/50 hover:text-on-surface transition-colors font-headline uppercase tracking-widest text-xs font-bold active:scale-95 duration-100"
          >
            <MaterialIcon name="arrow_back" className="text-sm" />
            Back
          </button>

          {/* Step dots */}
          <div className="hidden md:flex flex-col items-center">
            <span className="text-[8px] font-mono text-on-surface-variant/30 uppercase tracking-[0.2em] mb-1">
              Current Protocol
            </span>
            <div className="flex gap-1">
              {[0, 1, 2, 3, 4, 5].map((i) => (
                <div key={i} className={`w-2 h-2 ${i <= step ? 'bg-primary' : 'bg-surface-container-high'}`} />
              ))}
            </div>
          </div>

          <button
            onClick={handleNext}
            disabled={!canNext()}
            className="heat-gradient text-on-primary-fixed px-10 py-3 font-headline font-black uppercase tracking-widest text-sm flex items-center gap-3 active:scale-95 duration-100 shadow-heat disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {(step === 3 || step === 4) && wizardDivisionIndex < totalDivisions - 1
              ? 'Next Division'
              : step === 4
                ? 'Next: Review'
                : 'Next'}
            <MaterialIcon name="bolt" className="text-sm" />
          </button>
        </footer>
      )}
    </div>
  );
}
