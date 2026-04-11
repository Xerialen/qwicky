// src/components/Header.jsx
import React, { useRef } from 'react';
import MaterialIcon from './ui/MaterialIcon';

const sectionTabs = [
  { id: 'setup',    label: 'Setup' },
  { id: 'teams',    label: 'Teams' },
  { id: 'schedule', label: 'Schedule' },
  { id: 'results',  label: 'Results' },
  { id: 'bracket',  label: 'Bracket' },
  { id: 'wiki',     label: 'Wiki' },
];

export default function Header({
  tournament,
  activeTab,
  setActiveTab,
  activeDivisionId,
  importTournament,
  resetTournament,
  onGoHome,
  onOpenSettings,
  // Division sub-tab (forwarded to DivisionView)
  activeSubTab,
  setActiveSubTab,
}) {
  const fileInputRef = useRef(null);

  const handleExport = () => {
    const data = {
      ...tournament,
      exportedAt: new Date().toISOString(),
      version: 3,
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const safeName = (tournament.name || 'tournament').replace(/[^a-z0-9]/gi, '_');
    a.download = `${safeName}_${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleImport = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const data = JSON.parse(event.target.result);
        if (!data.divisions && !data.name) {
          throw new Error('Invalid tournament file');
        }
        if (!window.confirm('Replace current tournament with imported data?')) return;
        importTournament(data);
      } catch (err) {
        alert('Failed to import: ' + err.message);
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  // Show section tabs only when viewing a division
  const showSectionTabs = activeTab === 'division' && activeDivisionId;

  return (
    <header className="bg-background border-b-4 border-background flex justify-between items-center w-full px-6 py-3 sticky top-0 z-50">
      {/* Left: Logo + Section Tabs */}
      <div className="flex items-center gap-8">
        <button
          onClick={() => onGoHome?.()}
          className="hover:opacity-70 transition-opacity"
        >
          <span className="text-2xl font-black text-primary-container tracking-tighter font-headline">
            QWICKY
          </span>
        </button>

        {showSectionTabs && (
          <nav className="hidden md:flex gap-6 items-center">
            {sectionTabs.map((tab) => {
              const isActive = activeSubTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveSubTab?.(tab.id)}
                  className={`font-headline uppercase tracking-widest text-sm font-bold transition-colors pb-1 ${
                    isActive
                      ? 'text-primary border-b-2 border-primary-container'
                      : 'text-on-surface-variant/40 hover:text-on-surface-variant/70'
                  }`}
                >
                  {tab.label}
                </button>
              );
            })}
          </nav>
        )}
      </div>

      {/* Right: Actions */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleImport}
        accept=".json"
        className="hidden"
      />
      <div className="flex items-center gap-4">
        <div className="hidden lg:flex items-center gap-2">
          <button
            onClick={() => fileInputRef.current?.click()}
            className="font-headline uppercase tracking-widest text-xs font-bold text-on-surface-variant/50 hover:text-on-surface-variant hover:bg-surface-container-high px-3 py-1 transition-colors"
          >
            Import JSON
          </button>
          <button
            onClick={handleExport}
            className="font-headline uppercase tracking-widest text-xs font-bold text-primary hover:bg-surface-container-high px-3 py-1 transition-colors"
          >
            Export JSON
          </button>
        </div>
        <div className="flex items-center gap-1 border-l border-surface-variant/30 pl-4">
          <button
            onClick={handleExport}
            className="p-2 text-on-surface-variant/50 hover:text-on-surface-variant hover:bg-surface-container-high transition-colors"
            title="Save"
          >
            <MaterialIcon name="save" />
          </button>
          <button
            onClick={onOpenSettings}
            className="p-2 text-on-surface-variant/50 hover:text-on-surface-variant hover:bg-surface-container-high transition-colors"
            title="Settings"
            aria-label="Open tournament settings"
          >
            <MaterialIcon name="settings" />
          </button>
        </div>
      </div>
    </header>
  );
}
