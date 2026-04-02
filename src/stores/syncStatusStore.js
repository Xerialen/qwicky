// src/stores/syncStatusStore.js
// Global Zustand store for sync/save status. Replaces lastSyncStatus + isSyncing
// in useTournamentState so SaveStatusIndicator can subscribe without prop drilling.

import { create } from 'zustand';

const useSyncStatusStore = create((set) => ({
  // status: 'synced' | 'saving' | 'unsaved' | 'error' | 'local_only'
  status: 'local_only',
  errorMessage: null,
  lastSavedAt: null, // unix ms

  setSaving: () => set({ status: 'saving', errorMessage: null }),
  setSynced: (timestamp) => set({ status: 'synced', errorMessage: null, lastSavedAt: timestamp }),
  setUnsaved: () => set({ status: 'unsaved', errorMessage: null }),
  setError: (message) => set({ status: 'error', errorMessage: message ?? 'Sync failed' }),
  setLocalOnly: () => set({ status: 'local_only', errorMessage: null }),
}));

export default useSyncStatusStore;
