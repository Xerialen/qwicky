// src/hooks/useTournamentState.js
// React hook that manages tournament state with localStorage + Supabase dual persistence.
// localStorage provides instant render on mount; Supabase syncs in the background.

import { useState, useEffect, useRef, useCallback } from 'react';
import { isSupabaseEnabled } from '../services/supabaseClient.js';
import {
  syncTournament,
  loadTournament,
  listTournaments,
  tournamentSlug,
} from '../services/tournamentService.js';
import useSyncStatusStore from '../stores/syncStatusStore.js';

const STORAGE_KEY = 'qw-tournament-data';
const SYNC_DEBOUNCE_MS = 2000;

const DEFAULT_TOURNAMENT = {
  name: '',
  mode: '4on4',
  startDate: '',
  endDate: '',
  divisions: [],
  activeDivisionId: null,
};

// ── Helpers ──────────────────────────────────────────────────────────────────

function readLocalStorage() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      // Migration: ensure divisions array exists
      if (!parsed.divisions) {
        parsed.divisions = [];
      }
      return parsed;
    }
  } catch {
    // Corrupted data — fall back to default
  }
  return { ...DEFAULT_TOURNAMENT };
}

function writeLocalStorage(tournament, activeDivisionId) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...tournament, activeDivisionId }));
  } catch (err) {
    console.error('[useTournamentState] Failed to save to localStorage:', err);
  }
}

// ── Hook ─────────────────────────────────────────────────────────────────────

export function useTournamentState() {
  // Synchronous localStorage read — instant first render
  const [tournament, setTournament] = useState(() => {
    const cached = readLocalStorage();
    // Strip activeDivisionId out of tournament object (tracked separately)
    const { activeDivisionId: _stripped, ...rest } = cached;
    return rest;
  });

  const [activeDivisionId, setActiveDivisionId] = useState(() => {
    const cached = readLocalStorage();
    return cached.activeDivisionId || null;
  });

  const [isLoading, setIsLoading] = useState(false);
  const [cloudTournaments, setCloudTournaments] = useState([]);

  const { setSaving, setSynced, setUnsaved, setError, setLocalOnly } =
    useSyncStatusStore.getState();

  const syncTimerRef = useRef(null);
  const mountedRef = useRef(true);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      mountedRef.current = false;
      if (syncTimerRef.current) clearTimeout(syncTimerRef.current);
    };
  }, []);

  // ── Persist to localStorage + debounced Supabase sync ──────────────────────

  useEffect(() => {
    writeLocalStorage(tournament, activeDivisionId);

    // Mark unsaved immediately; sync will update to saving/synced/error
    setUnsaved();

    // Debounced cloud sync
    if (syncTimerRef.current) clearTimeout(syncTimerRef.current);
    syncTimerRef.current = setTimeout(async () => {
      if (!isSupabaseEnabled) {
        setLocalOnly();
        return;
      }
      if (!mountedRef.current) return;

      setSaving();
      try {
        const result = await syncTournament(tournament, activeDivisionId);
        if (mountedRef.current) {
          if (result.ok) {
            setSynced(Date.now());
          } else {
            setError(result.error ?? null);
          }
        }
      } catch (err) {
        if (mountedRef.current) setError(err.message ?? null);
      }
    }, SYNC_DEBOUNCE_MS);
  }, [tournament, activeDivisionId]);

  // ── Fetch cloud tournament list on mount ───────────────────────────────────

  useEffect(() => {
    if (!isSupabaseEnabled) return;

    let cancelled = false;

    (async () => {
      try {
        const list = await listTournaments();
        if (!cancelled && mountedRef.current) {
          setCloudTournaments(list);
        }
      } catch {
        // Non-critical — cloud list simply stays empty
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  // ── Background Supabase fetch on mount (merge if newer) ────────────────────

  useEffect(() => {
    if (!isSupabaseEnabled) return;
    // Only attempt if we have a named tournament in localStorage
    if (!tournament.name) return;

    let cancelled = false;

    (async () => {
      setIsLoading(true);
      try {
        const slug = tournamentSlug(tournament.name);
        if (!slug || slug === 'unnamed') return;

        const cloud = await loadTournament(slug);
        if (cancelled || !mountedRef.current) return;

        if (cloud) {
          // Use cloud data — it is the authoritative source when available
          const { activeDivisionId: cloudDivId, ...cloudTournament } = cloud;
          setTournament(cloudTournament);
          if (cloudDivId) setActiveDivisionId(cloudDivId);
        }
      } catch {
        // Supabase unreachable — localStorage cache is still valid
        console.info('[useTournamentState] Cloud fetch failed, using localStorage cache.');
      } finally {
        if (mountedRef.current) setIsLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
    // Only run on mount — tournament.name from initial localStorage read
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Load a specific tournament from Supabase ───────────────────────────────

  const loadFromCloud = useCallback(async (tournamentId) => {
    if (!isSupabaseEnabled) return null;

    setIsLoading(true);
    try {
      const cloud = await loadTournament(tournamentId);
      if (!mountedRef.current) return null;

      if (cloud) {
        const { activeDivisionId: cloudDivId, ...cloudTournament } = cloud;
        setTournament(cloudTournament);
        if (cloudDivId) setActiveDivisionId(cloudDivId);
        // localStorage is updated by the useEffect above
        return cloud;
      }
      return null;
    } catch (err) {
      console.warn('[useTournamentState] loadFromCloud failed:', err.message);
      if (mountedRef.current) setError(err.message);
      return null;
    } finally {
      if (mountedRef.current) setIsLoading(false);
    }
  }, []);

  return {
    tournament,
    setTournament,
    activeDivisionId,
    setActiveDivisionId,
    isLoading,
    loadFromCloud,
    cloudTournaments,
  };
}
