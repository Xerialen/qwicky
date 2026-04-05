// src/hooks/useDirtyGuard.js
// Tracks unsaved-changes state per section and guards tab navigation.
// Uses Zustand store (dirtyGuardStore) so all components share state
// without prop drilling or module-level singletons.
//
// Usage:
//   const { isDirty, markDirty, markClean, guardedNavigate } = useDirtyGuard('my-section');
//
// sectionId — unique string identifying this component's dirty scope.
//   markDirty/markClean only affect this section; other sections are unaffected.
//   guardedNavigate checks whether *any* section is dirty (not just this one).

import { useCallback } from 'react';
import useDirtyGuardStore from '../stores/dirtyGuardStore';

export function useDirtyGuard(sectionId) {
  const markDirtyInStore = useDirtyGuardStore((s) => s.markDirty);
  const markCleanInStore = useDirtyGuardStore((s) => s.markClean);
  const setPendingNavigate = useDirtyGuardStore((s) => s.setPendingNavigate);
  const dirtySections = useDirtyGuardStore((s) => s.dirtySections);

  const isDirty = Object.keys(dirtySections).length > 0;

  const markDirty = useCallback(
    (sectionName = '') => markDirtyInStore(sectionId, sectionName),
    [sectionId, markDirtyInStore]
  );

  const markClean = useCallback(() => markCleanInStore(sectionId), [sectionId, markCleanInStore]);

  const guardedNavigate = useCallback(
    (navigate) => {
      if (!isDirty) {
        navigate();
        return;
      }
      setPendingNavigate(navigate);
    },
    [isDirty, setPendingNavigate]
  );

  return { isDirty, markDirty, markClean, guardedNavigate };
}
