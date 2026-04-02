// src/stores/wizardStore.js
// Scoped to the SetupWizard lifetime. Tracks wizard draft autosave state.

import { create } from 'zustand';

export const useWizardStore = create((set) => ({
  draftId: null,
  currentStep: 0,
  isDirty: false,

  setDraftId: (id) => set({ draftId: id }),
  setStep: (n) => set({ currentStep: n }),
  markDirty: () => set({ isDirty: true }),
  markClean: () => set({ isDirty: false }),
  reset: () => set({ draftId: null, currentStep: 0, isDirty: false }),
}));
