// src/stores/dirtyGuardStore.js
// Zustand store for unsaved-changes tracking across sections.
// Each section marks itself dirty/clean independently so one section
// calling markClean cannot clear another section's unsaved state.

import { create } from 'zustand';

const useDirtyGuardStore = create((set) => ({
  // { [sectionId]: sectionName } — tracks which sections have unsaved changes
  dirtySections: {},
  // Function to call if user confirms leaving despite unsaved changes
  pendingNavigate: null,

  markDirty: (sectionId, sectionName) =>
    set((s) => ({ dirtySections: { ...s.dirtySections, [sectionId]: sectionName } })),

  markClean: (sectionId) =>
    set((s) => {
      const next = { ...s.dirtySections };
      delete next[sectionId];
      return { dirtySections: next };
    }),

  markAllClean: () => set({ dirtySections: {}, pendingNavigate: null }),

  setPendingNavigate: (fn) => set({ pendingNavigate: fn }),
  clearPendingNavigate: () => set({ pendingNavigate: null }),
}));

export default useDirtyGuardStore;
