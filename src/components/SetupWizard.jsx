// src/components/SetupWizard.jsx
import React, { useState, useEffect, useRef, useCallback } from 'react';
import WizardStepIndicator from './WizardStepIndicator';
import DivisionSetup from './division/DivisionSetup';
import DivisionTeams from './division/DivisionTeams';
import SaveStatusIndicator from './SaveStatusIndicator';
import FormatRecommendation from './FormatRecommendation';
import { useWizardStore } from '../stores/wizardStore.js';
import useSyncStatusStore from '../stores/syncStatusStore.js';
import { supabase } from '../services/supabaseClient.js';

const GAME_MODES = [
  { value: '4on4', label: '4on4', desc: 'Classic team deathmatch' },
  { value: '2on2', label: '2on2', desc: 'Two-player teams' },
  { value: '1on1', label: '1on1', desc: 'Duel' },
  { value: 'ctf', label: 'CTF', desc: 'Capture the Flag' },
];

const DIVISION_PRESETS = ['Division 1', 'Division 2', 'Division 3', 'Pro', 'Open'];
const AUTOSAVE_DEBOUNCE_MS = 800;
const GUEST_DRAFTS_KEY = 'qwicky-wizard-drafts';

// ── localStorage guest draft helpers ────────────────────────────────────────

function readGuestDrafts() {
  try {
    const raw = localStorage.getItem(GUEST_DRAFTS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function writeGuestDraft(draftId, name, data, currentStep) {
  const drafts = readGuestDrafts().filter((d) => d.id !== draftId);
  const now = new Date().toISOString();
  // Enforce 10-draft cap — delete oldest by updatedAt
  const capped =
    drafts.length >= 10
      ? drafts.sort((a, b) => new Date(a.updatedAt) - new Date(b.updatedAt)).slice(1)
      : drafts;
  capped.push({
    id: draftId,
    name,
    data,
    currentStep,
    updatedAt: now,
    createdAt: capped.find((d) => d.id === draftId)?.createdAt || now,
  });
  localStorage.setItem(GUEST_DRAFTS_KEY, JSON.stringify(capped));
}

function deleteGuestDraft(draftId) {
  const drafts = readGuestDrafts().filter((d) => d.id !== draftId);
  localStorage.setItem(GUEST_DRAFTS_KEY, JSON.stringify(drafts));
}

// ── Component ────────────────────────────────────────────────────────────────

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

  // wizardStore
  const {
    draftId,
    setDraftId,
    setStep: setStoreStep,
    markDirty,
    markClean,
    reset: resetStore,
  } = useWizardStore();
  const { setSaving, setSynced, setError } = useSyncStatusStore.getState();

  const autosaveTimerRef = useRef(null);
  const stepInitialisedRef = useRef(false);
  const persistDraftRef = useRef(null);

  // Refs for latest tournament/step — used by persistDraft to avoid stale closures
  const tournamentRef = useRef(tournament);
  const stepRef = useRef(step);
  useEffect(() => {
    tournamentRef.current = tournament;
  }, [tournament]);
  useEffect(() => {
    stepRef.current = step;
  }, [step]);

  // ── Draft initialisation on mount ───────────────────────────────────────

  useEffect(() => {
    if (stepInitialisedRef.current) return;
    stepInitialisedRef.current = true;

    const initDraft = async () => {
      // If store already has a draftId (resume flow), nothing to create
      if (draftId) return;

      const id = crypto.randomUUID();
      setDraftId(id);
      // Only persist draft after user advances past step 0 (handled in handleNext)
    };

    initDraft();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Sync step to store whenever it changes
  useEffect(() => {
    setStoreStep(step);
  }, [step, setStoreStep]);

  useEffect(() => {
    localStorage.setItem('qw-skip-welcome', skipWelcome ? 'true' : 'false');
  }, [skipWelcome]);

  // ── Autosave ─────────────────────────────────────────────────────────────

  const persistDraft = useCallback(async () => {
    if (!draftId) return;
    // Read latest values from refs to avoid stale closure capturing pre-update state
    const currentTournament = tournamentRef.current;
    const currentStep = stepRef.current;
    // Only autosave if user has advanced past step 0
    if (currentStep === 0) return;

    const name = currentTournament.name || null;
    const teamCount = (currentTournament.divisions || []).reduce(
      (sum, d) => sum + (d.teams?.length || 0),
      0
    );
    const draftData = { ...currentTournament, currentStep, teamCount };

    setSaving();
    try {
      if (supabase) {
        const {
          data: { session },
        } = await supabase.auth.getSession();
        if (session) {
          // Supabase upsert — enforce 10-draft cap server-side (prune oldest client-side on create)
          const { error } = await supabase.from('tournament_drafts').upsert(
            {
              id: draftId,
              user_id: session.user.id,
              data: draftData,
              name,
              updated_at: new Date().toISOString(),
            },
            { onConflict: 'id' }
          );
          if (error) throw new Error(error.message);
          markClean();
          setSynced(Date.now());
          return;
        }
      }

      // Guest / no session: write to localStorage
      writeGuestDraft(draftId, name, draftData, currentStep);
      markClean();
      setSynced(Date.now());
    } catch (err) {
      setError(err.message || 'Autosave failed');
    }
    // tournament and step intentionally omitted — read via refs to avoid stale captures
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draftId, setSaving, setSynced, setError, markClean]);

  // Keep persistDraftRef current so scheduleAutosave always calls the latest version
  useEffect(() => {
    persistDraftRef.current = persistDraft;
  });

  const scheduleAutosave = useCallback(() => {
    markDirty();
    clearTimeout(autosaveTimerRef.current);
    autosaveTimerRef.current = setTimeout(
      () => persistDraftRef.current?.(),
      AUTOSAVE_DEBOUNCE_MS
    );
  }, [markDirty]);

  // Patch updateTournamentInfo to trigger autosave on blur
  const handleFieldBlur = useCallback(() => {
    scheduleAutosave();
  }, [scheduleAutosave]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      clearTimeout(autosaveTimerRef.current);
    };
  }, []);

  // ── Navigation ───────────────────────────────────────────────────────────

  const divisions = tournament.divisions || [];
  const totalDivisions = divisions.length;
  const currentDivision = divisions[wizardDivisionIndex] || null;

  const canNext = () => {
    switch (step) {
      case 0:
        return true;
      case 1:
        return (tournament.name || '').trim().length > 0;
      case 2:
        return divisions.length >= 1;
      case 3:
        return true;
      case 4:
        return true;
      case 5:
        return true;
      default:
        return true;
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
      if (nextStep === 3 || nextStep === 4) {
        setWizardDivisionIndex(0);
      }
      // Start persisting draft once user advances past step 0
      if (step === 0) {
        scheduleAutosave();
      }
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

  // "Save & exit" — force-save immediately then go back to landing
  const handleSaveAndExit = async () => {
    clearTimeout(autosaveTimerRef.current);
    await persistDraft();
    markClean();
    onBackToLanding();
  };

  // On wizard complete (publish): delete draft, clear store
  const handleComplete = async () => {
    clearTimeout(autosaveTimerRef.current);
    if (draftId) {
      try {
        if (supabase) {
          const {
            data: { session },
          } = await supabase.auth.getSession();
          if (session) {
            await supabase.from('tournament_drafts').delete().eq('id', draftId);
          }
        }
        deleteGuestDraft(draftId);
      } catch {
        // Non-fatal — draft cleanup failure should not block publish
      }
    }
    resetStore();
    onComplete();
  };

  // ── Division helpers ─────────────────────────────────────────────────────

  const handleAddPreset = (name) => {
    // Avoid duplicates
    if (divisions.some((d) => d.name === name)) return;
    addDivision(name);
  };

  const handleAddCustom = () => {
    const name = customDivName.trim();
    if (!name) return;
    if (divisions.some((d) => d.name === name)) return;
    addDivision(name);
    setCustomDivName('');
  };

  const handleRemoveDivision = (divId) => {
    removeDivision(divId);
    if (wizardDivisionIndex >= divisions.length - 1) {
      setWizardDivisionIndex(Math.max(0, divisions.length - 2));
    }
  };

  // ── Step renderers ───────────────────────────────────────────────────────

  const renderStep0 = () => (
    <div className="space-y-6">
      <div className="text-center mb-8">
        <h2 className="font-display font-bold text-2xl text-white mb-2">Welcome to QWICKY</h2>
        <p className="text-qw-muted">A few things to know before you start</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="qw-panel p-5">
          <div className="text-2xl mb-3">
            <svg
              className="w-8 h-8 text-qw-accent"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
              />
            </svg>
          </div>
          <h3 className="font-display font-semibold text-white mb-1">Browser Storage Only</h3>
          <p className="text-sm text-qw-muted">
            Your tournament data lives in this browser's local storage. It persists across sessions
            but isn't synced anywhere.
          </p>
        </div>

        <div className="qw-panel p-5">
          <div className="text-2xl mb-3">
            <svg
              className="w-8 h-8 text-qw-accent"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
              />
            </svg>
          </div>
          <h3 className="font-display font-semibold text-white mb-1">Export & Import</h3>
          <p className="text-sm text-qw-muted">
            Save your work by exporting to a JSON file. You can import it back anytime — even on a
            different computer.
          </p>
        </div>

        <div className="qw-panel p-5">
          <div className="text-2xl mb-3">
            <svg
              className="w-8 h-8 text-qw-accent"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
              />
            </svg>
          </div>
          <h3 className="font-display font-semibold text-white mb-1">Discord Bot (Optional)</h3>
          <p className="text-sm text-qw-muted">
            Players can submit match results via Discord. You'll review and approve them in the
            app's Results tab.
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
        Don&apos;t show this again
      </label>
    </div>
  );

  const renderStep1 = () => (
    <div className="space-y-6 max-w-lg mx-auto">
      <div className="text-center mb-6">
        <h2 className="font-display font-bold text-2xl text-white mb-2">Tournament Basics</h2>
        <p className="text-qw-muted">Name your tournament and pick a game mode</p>
      </div>

      <div>
        <label className="block text-sm font-semibold text-qw-muted mb-1.5">
          Tournament Name <span className="text-qw-loss">*</span>
        </label>
        <input
          type="text"
          value={tournament.name || ''}
          onChange={(e) => updateTournamentInfo({ name: e.target.value })}
          onBlur={handleFieldBlur}
          placeholder="e.g. EQL Season 38"
          className="w-full bg-qw-dark border border-qw-border rounded-lg px-4 py-3 text-white placeholder-qw-muted/50 focus:outline-none focus:border-qw-accent focus:shadow-input-focus transition-all text-lg"
          autoFocus
        />
      </div>

      <div>
        <label className="block text-sm font-semibold text-qw-muted mb-2">Game Mode</label>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {GAME_MODES.map((mode) => (
            <button
              key={mode.value}
              type="button"
              onClick={() => {
                updateTournamentInfo({ mode: mode.value });
                scheduleAutosave();
              }}
              className={`
                p-3 rounded-lg border-2 text-center transition-all
                ${
                  tournament.mode === mode.value
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

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-semibold text-qw-muted mb-1.5">Start Date</label>
          <input
            type="date"
            value={tournament.startDate || ''}
            onChange={(e) => updateTournamentInfo({ startDate: e.target.value })}
            onBlur={handleFieldBlur}
            className="w-full bg-qw-dark border border-qw-border rounded-lg px-3 py-2.5 text-white focus:outline-none focus:border-qw-accent focus:shadow-input-focus transition-all"
          />
        </div>
        <div>
          <label className="block text-sm font-semibold text-qw-muted mb-1.5">End Date</label>
          <input
            type="date"
            value={tournament.endDate || ''}
            onChange={(e) => updateTournamentInfo({ endDate: e.target.value })}
            onBlur={handleFieldBlur}
            className="w-full bg-qw-dark border border-qw-border rounded-lg px-3 py-2.5 text-white focus:outline-none focus:border-qw-accent focus:shadow-input-focus transition-all"
          />
        </div>
      </div>
    </div>
  );

  const renderStep2 = () => (
    <div className="space-y-6 max-w-lg mx-auto">
      <div className="text-center mb-6">
        <h2 className="font-display font-bold text-2xl text-white mb-2">Create Divisions</h2>
        <p className="text-qw-muted">Most tournaments have 2-3 skill-based divisions</p>
      </div>

      <div>
        <label className="block text-sm font-semibold text-qw-muted mb-2">Quick Add</label>
        <div className="flex flex-wrap gap-2">
          {DIVISION_PRESETS.map((name) => {
            const exists = divisions.some((d) => d.name === name);
            return (
              <button
                key={name}
                type="button"
                onClick={() => {
                  handleAddPreset(name);
                  scheduleAutosave();
                }}
                disabled={exists}
                className={`
                  px-4 py-2 rounded-lg text-sm font-semibold transition-all
                  ${
                    exists
                      ? 'bg-qw-accent/20 text-qw-accent border border-qw-accent/30 cursor-default'
                      : 'bg-qw-dark border border-qw-border text-qw-muted hover:text-white hover:border-qw-accent'
                  }
                `}
              >
                {exists ? '+ ' : '+ '}
                {name}
              </button>
            );
          })}
        </div>
      </div>

      <div>
        <label className="block text-sm font-semibold text-qw-muted mb-1.5">
          Custom Division Name
        </label>
        <div className="flex gap-2">
          <input
            type="text"
            value={customDivName}
            onChange={(e) => setCustomDivName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                handleAddCustom();
                scheduleAutosave();
              }
            }}
            placeholder="e.g. Rookie"
            className="flex-1 bg-qw-dark border border-qw-border rounded-lg px-3 py-2.5 text-white placeholder-qw-muted/50 focus:outline-none focus:border-qw-accent focus:shadow-input-focus transition-all"
          />
          <button
            type="button"
            onClick={() => {
              handleAddCustom();
              scheduleAutosave();
            }}
            disabled={!customDivName.trim()}
            className="qw-btn px-4 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Add
          </button>
        </div>
      </div>

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
                  onClick={() => {
                    handleRemoveDivision(div.id);
                    scheduleAutosave();
                  }}
                  className="text-qw-muted hover:text-qw-loss transition-colors p-1"
                  title="Remove division"
                >
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                    <path
                      fillRule="evenodd"
                      d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                      clipRule="evenodd"
                    />
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
        <div className="text-center mb-4">
          <h2 className="font-display font-bold text-2xl text-white mb-2">Add Teams</h2>
          {totalDivisions > 1 && (
            <div className="flex items-center justify-center gap-2 mt-3">
              {divisions.map((div, idx) => (
                <button
                  key={div.id}
                  type="button"
                  onClick={() => setWizardDivisionIndex(idx)}
                  className={`
                    px-3 py-1 rounded-full text-xs font-semibold transition-all
                    ${
                      idx === wizardDivisionIndex
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

        <DivisionTeams
          division={currentDivision}
          updateDivision={(updates) => {
            updateDivision(currentDivision.id, updates);
            scheduleAutosave();
          }}
          tournamentMode={tournament.mode}
          allDivisions={tournament.divisions}
        />

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

  const renderStep4 = () => {
    if (!currentDivision) {
      return <div className="text-center py-12 text-qw-muted">No divisions to configure.</div>;
    }

    const totalTeamCount = (tournament.divisions || []).reduce(
      (sum, d) => sum + (d.teams?.length || 0),
      0
    );

    return (
      <div className="space-y-4">
        <div className="text-center mb-4">
          <h2 className="font-display font-bold text-2xl text-white mb-2">Division Format</h2>
          {totalDivisions > 1 && (
            <div className="flex items-center justify-center gap-2 mt-3">
              {divisions.map((div, idx) => (
                <button
                  key={div.id}
                  type="button"
                  onClick={() => setWizardDivisionIndex(idx)}
                  className={`
                    px-3 py-1 rounded-full text-xs font-semibold transition-all
                    ${
                      idx === wizardDivisionIndex
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

        <FormatRecommendation teamCount={totalTeamCount} />

        <DivisionSetup
          division={currentDivision}
          updateDivision={(updates) => {
            updateDivision(currentDivision.id, updates);
            scheduleAutosave();
          }}
        />

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

  const renderStep5 = () => {
    const formatLabel = (f) => {
      switch (f) {
        case 'groups':
          return 'Groups + Playoffs';
        case 'single-elim':
          return 'Single Elimination';
        case 'double-elim':
          return 'Double Elimination';
        case 'multi-tier':
          return 'Multi-Tier Playoffs';
        default:
          return f;
      }
    };

    return (
      <div className="space-y-6 max-w-lg mx-auto">
        <div className="text-center mb-6">
          <h2 className="font-display font-bold text-2xl text-white mb-2">You&apos;re All Set!</h2>
          <p className="text-qw-muted">Here&apos;s a summary of your tournament</p>
        </div>

        <div className="qw-panel p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-display font-bold text-lg text-white">{tournament.name}</h3>
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

        <div className="qw-panel p-5">
          <h4 className="font-display font-semibold text-white mb-3">What&apos;s next</h4>
          <ul className="space-y-2 text-sm text-qw-muted">
            <li className="flex items-start gap-2">
              <span className="text-qw-accent mt-0.5">&#9656;</span>
              <span>
                Generate the <strong className="text-white">schedule</strong> for each division
              </span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-qw-accent mt-0.5">&#9656;</span>
              <span>
                Enter <strong className="text-white">results</strong> manually or via Discord
                integration
              </span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-qw-accent mt-0.5">&#9656;</span>
              <span>
                Export to <strong className="text-white">MediaWiki</strong> format for league pages
              </span>
            </li>
          </ul>
        </div>

        <p className="text-center text-sm text-qw-muted">
          Remember to <strong className="text-qw-accent">save (export)</strong> your work regularly!
        </p>

        <div className="text-center pt-2">
          <button type="button" onClick={handleComplete} className="qw-btn px-8 py-3 text-lg">
            Open Tournament &rarr;
          </button>
        </div>
      </div>
    );
  };

  const renderCurrentStep = () => {
    switch (step) {
      case 0:
        return renderStep0();
      case 1:
        return renderStep1();
      case 2:
        return renderStep2();
      case 3:
        return renderStep3();
      case 4:
        return renderStep4();
      case 5:
        return renderStep5();
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-qw-darker flex flex-col">
      {/* Top bar */}
      <div className="bg-qw-panel border-b border-qw-border px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center"
            style={{ background: '#FFB300' }}
          >
            <span className="font-logo font-black text-sm" style={{ color: '#121212' }}>
              QW
            </span>
          </div>
          <span className="font-display font-bold text-white text-sm">QWICKY</span>
          <span className="text-qw-muted text-xs ml-1">Setup</span>
        </div>
        <div className="flex items-center gap-3">
          <SaveStatusIndicator />
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
      </div>

      {/* Step indicator */}
      <div className="bg-qw-panel/50 border-b border-qw-border">
        <div className="max-w-2xl mx-auto">
          <WizardStepIndicator currentStep={step} onStepClick={handleStepClick} />
        </div>
      </div>

      {/* Step content */}
      <div className="flex-1 max-w-5xl w-full mx-auto px-4 py-8">{renderCurrentStep()}</div>

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
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M15 19l-7-7 7-7"
                />
              </svg>
              Back
            </button>

            {/* Step 3/4 context */}
            {(step === 3 || step === 4) && totalDivisions > 1 && (
              <span className="text-xs text-qw-muted font-mono">
                {wizardDivisionIndex + 1} / {totalDivisions}
              </span>
            )}

            {/* Save & exit — shown from step 1 onward */}
            {step >= 1 && (
              <button
                type="button"
                onClick={handleSaveAndExit}
                className="qw-btn-secondary px-4 py-2.5 text-sm"
              >
                Save &amp; exit
              </button>
            )}

            <button
              type="button"
              onClick={handleNext}
              disabled={!canNext()}
              className="qw-btn px-5 py-2.5 flex items-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {(step === 3 || step === 4) && wizardDivisionIndex < totalDivisions - 1
                ? 'Next Division'
                : 'Next'}
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 5l7 7-7 7"
                />
              </svg>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
