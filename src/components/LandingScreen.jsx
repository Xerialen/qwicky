// src/components/LandingScreen.jsx
import React, { useRef, useState, useEffect } from 'react';
import WizardDraftCard from './WizardDraftCard.jsx';
import { supabase } from '../services/supabaseClient.js';

const GUEST_DRAFTS_KEY = 'qwicky-wizard-drafts';
const DRAFTS_FETCH_TIMEOUT_MS = 8000;

function timeAgo(dateStr) {
  if (!dateStr) return '';
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

// Read guest drafts from localStorage
function readGuestDrafts() {
  try {
    const raw = localStorage.getItem(GUEST_DRAFTS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

// Delete a guest draft from localStorage
function deleteGuestDraft(draftId) {
  const drafts = readGuestDrafts().filter((d) => d.id !== draftId);
  localStorage.setItem(GUEST_DRAFTS_KEY, JSON.stringify(drafts));
}

export default function LandingScreen({
  hasExistingData,
  onCreateNew,
  onLoadFile,
  cloudTournaments,
  onLoadFromCloud,
  isLoading,
  onResume,
}) {
  const fileInputRef = useRef(null);
  const [drafts, setDrafts] = useState([]);
  const [draftsLoading, setDraftsLoading] = useState(true);
  const [draftsError, setDraftsError] = useState(null);
  const fetchAttemptRef = useRef(0);

  const fetchDrafts = async () => {
    setDraftsLoading(true);
    setDraftsError(null);
    const attempt = ++fetchAttemptRef.current;

    // Timeout guard
    const timeoutId = setTimeout(() => {
      if (fetchAttemptRef.current === attempt) {
        setDraftsLoading(false);
        setDraftsError('timeout');
      }
    }, DRAFTS_FETCH_TIMEOUT_MS);

    try {
      if (supabase) {
        const {
          data: { session },
        } = await supabase.auth.getSession();
        if (session) {
          const { data, error } = await supabase
            .from('tournament_drafts')
            .select('id, name, data, created_at, updated_at')
            .order('updated_at', { ascending: false })
            .limit(10);

          if (fetchAttemptRef.current !== attempt) return;
          clearTimeout(timeoutId);

          if (error) {
            setDraftsError(error.message);
            setDraftsLoading(false);
            return;
          }

          // Normalise shape
          const normalised = (data || []).map((row) => ({
            id: row.id,
            name: row.name || row.data?.name || null,
            updatedAt: row.updated_at,
            createdAt: row.created_at,
            currentStep: row.data?.currentStep ?? null,
            teamCount: row.data?.teamCount ?? null,
            source: 'supabase',
          }));
          setDrafts(normalised);
          setDraftsLoading(false);
          return;
        }
      }

      // Guest / no session: read from localStorage
      clearTimeout(timeoutId);
      if (fetchAttemptRef.current !== attempt) return;
      const guestDrafts = readGuestDrafts().map((d) => ({ ...d, source: 'local' }));
      setDrafts(guestDrafts);
      setDraftsLoading(false);
    } catch (err) {
      clearTimeout(timeoutId);
      if (fetchAttemptRef.current !== attempt) return;
      setDraftsError(err.message || 'Failed to load drafts');
      setDraftsLoading(false);
    }
  };

  useEffect(() => {
    fetchDrafts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleDeleteDraft = async (draftId) => {
    const draft = drafts.find((d) => d.id === draftId);
    if (!draft) return;

    if (draft.source === 'supabase' && supabase) {
      const { error } = await supabase.from('tournament_drafts').delete().eq('id', draftId);
      if (error) throw new Error(error.message);
    } else {
      deleteGuestDraft(draftId);
    }

    setDrafts((prev) => prev.filter((d) => d.id !== draftId));
  };

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const data = JSON.parse(event.target.result);
        if (!data.divisions && !data.name) throw new Error('Invalid tournament file');
        onLoadFile(data);
      } catch (err) {
        alert('Failed to load: ' + err.message);
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleNewTournament = () => {
    if (hasExistingData) {
      if (!window.confirm('Start a new tournament? Current data will be cleared.')) return;
    }
    onCreateNew();
  };

  const hasTournaments = cloudTournaments?.length > 0;

  return (
    <div className="min-h-screen bg-qw-darker flex flex-col items-center justify-center px-4">
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        accept=".json"
        className="hidden"
      />

      {/* Branding */}
      <div className="mb-12 text-center">
        <h1 className="font-display font-bold text-2xl text-white tracking-tight">QWICKY</h1>
        <p className="text-xs text-qw-muted mt-1">tournament admin</p>
      </div>

      <div className="w-full max-w-sm space-y-3">
        {/* Draft resume card */}
        <WizardDraftCard
          drafts={drafts}
          onResume={onResume}
          onDeleteDraft={handleDeleteDraft}
          onDismiss={() => {}}
          isLoading={draftsLoading}
          fetchError={draftsError}
          onRetryFetch={fetchDrafts}
        />

        {/* Tournament list */}
        {isLoading && (
          <div className="flex items-center justify-center gap-2 text-qw-muted text-xs py-6">
            <span className="animate-spin">...</span>
            <span>Loading tournaments</span>
          </div>
        )}

        {!isLoading && hasTournaments && (
          <>
            <div className="text-[10px] text-qw-muted uppercase tracking-widest">
              Your tournaments
            </div>
            {cloudTournaments.map((t) => (
              <button
                key={t.id}
                onClick={() => onLoadFromCloud(t.id)}
                className="w-full p-4 rounded-lg text-left border border-qw-border hover:border-qw-accent transition-colors group"
              >
                <div className="flex items-center justify-between">
                  <span className="font-display font-semibold text-white group-hover:text-qw-accent transition-colors">
                    {t.name}
                  </span>
                  <span className="text-qw-muted text-xs">&rarr;</span>
                </div>
                <div className="flex gap-3 text-xs text-qw-muted mt-1.5 font-mono">
                  {t.mode && <span>{t.mode}</span>}
                  {t.startDate && <span>{t.startDate}</span>}
                  {t.updatedAt && <span>updated {timeAgo(t.updatedAt)}</span>}
                </div>
              </button>
            ))}
          </>
        )}

        {!isLoading && !hasTournaments && (
          <div className="text-center py-6">
            <p className="text-qw-muted text-sm">No tournaments yet</p>
          </div>
        )}

        {/* Actions */}
        <div className="pt-3 flex gap-2">
          <button
            onClick={handleNewTournament}
            className={`flex-1 rounded-lg font-medium text-sm transition-colors py-2.5 ${
              hasTournaments
                ? 'border border-qw-border text-qw-muted hover:text-white hover:border-qw-accent'
                : 'bg-qw-accent text-qw-darker hover:bg-qw-accent-dim'
            }`}
          >
            New
          </button>
          <button
            onClick={() => fileInputRef.current?.click()}
            className="flex-1 rounded-lg font-medium text-sm border border-qw-border text-qw-muted hover:text-white hover:border-qw-accent transition-colors py-2.5"
          >
            Load file
          </button>
        </div>
      </div>

      <p className="mt-16 text-[10px] text-qw-muted/50 font-mono">qwicky v0.5</p>
    </div>
  );
}
