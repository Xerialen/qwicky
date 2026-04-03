// src/hooks/useDirtyGuard.js
// Tracks unsaved-changes state across sections and guards tab navigation.
// Uses module-level singleton so markDirty/markClean/guardedNavigate are shared
// across all components without prop drilling or a separate context provider.

import React, { useEffect, useCallback, useReducer } from 'react';
import ConfirmModal from '../components/ConfirmModal';

// ── Singleton state ───────────────────────────────────────────────────────────

let _isDirty = false;
let _sectionName = '';
let _pendingNavigate = null;
const _listeners = new Set();

function _notify() {
  _listeners.forEach((fn) => fn());
}

// ── Hook ─────────────────────────────────────────────────────────────────────

export function useDirtyGuard() {
  // Subscribe to singleton state changes
  const [, forceUpdate] = useReducer((x) => x + 1, 0);

  useEffect(() => {
    _listeners.add(forceUpdate);
    return () => _listeners.delete(forceUpdate);
  }, []);

  const markDirty = useCallback((sectionName = '') => {
    _isDirty = true;
    _sectionName = sectionName;
    _notify();
  }, []);

  const markClean = useCallback(() => {
    _isDirty = false;
    _sectionName = '';
    _pendingNavigate = null;
    _notify();
  }, []);

  const guardedNavigate = useCallback((navigate) => {
    if (!_isDirty) {
      navigate();
      return;
    }
    _pendingNavigate = navigate;
    _notify();
  }, []);

  const DirtyModal =
    _pendingNavigate !== null ? (
      <ConfirmModal
        title="You have unsaved changes. Leave anyway?"
        body={`Your changes to ${_sectionName || 'this section'} have not been saved. If you leave now, they will be lost.`}
        confirmLabel="Leave anyway"
        cancelLabel="Stay"
        onConfirm={() => {
          const nav = _pendingNavigate;
          _isDirty = false;
          _sectionName = '';
          _pendingNavigate = null;
          _notify();
          nav();
        }}
        onCancel={() => {
          _pendingNavigate = null;
          _notify();
        }}
      />
    ) : null;

  return {
    isDirty: _isDirty,
    markDirty,
    markClean,
    guardedNavigate,
    DirtyModal,
  };
}
