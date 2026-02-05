// src/components/Header.jsx
import React, { useState, useRef } from 'react';

export default function Header({
  tournament,
  divisions,
  activeTab,
  setActiveTab,
  activeDivisionId,
  setActiveDivisionId,
  importTournament,
  resetTournament
}) {
  const [showDivisionDropdown, setShowDivisionDropdown] = useState(false);
  const fileInputRef = useRef(null);

  const handleExport = () => {
    const data = {
      ...tournament,
      exportedAt: new Date().toISOString(),
      version: 3
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
        alert('Tournament imported successfully!');
      } catch (err) {
        alert('Failed to import: ' + err.message);
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleSelectDivision = (divId) => {
    setActiveDivisionId(divId);
    setActiveTab('division');
    setShowDivisionDropdown(false);
  };

  return (
    <header className="bg-qw-panel border-b border-qw-border sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ background: '#FFB300' }}>
              <span className="font-logo font-black text-lg" style={{ color: '#121212' }}>QW</span>
            </div>
            <div>
              <h1 className="font-display font-bold text-lg text-white">
                QWICKY
              </h1>
              <p className="text-xs text-qw-muted -mt-0.5">tournament admin tools - by Xerial</p>
            </div>
          </div>

          {/* Navigation + Save Controls */}
          <div className="flex items-center gap-3">
            <nav className="flex items-center gap-1">
            {/* Tournament Info Tab */}
            <button
              onClick={() => setActiveTab('info')}
              className={`
                px-4 py-2 font-display font-semibold text-xs uppercase
                transition-all duration-200 rounded
                ${activeTab === 'info'
                  ? 'bg-qw-accent text-qw-dark tab-active'
                  : 'bg-qw-border text-qw-muted hover:text-white'
                }
              `}
            >
              Info
            </button>

            {/* Divisions Manager Tab */}
            <button
              onClick={() => setActiveTab('divisions')}
              className={`
                px-4 py-2 font-display font-semibold text-xs uppercase
                transition-all duration-200 rounded flex items-center
                ${activeTab === 'divisions'
                  ? 'bg-qw-accent text-qw-dark tab-active'
                  : 'bg-qw-border text-qw-muted hover:text-white'
                }
              `}
            >
              Divisions
              {divisions.length > 0 && (
                <span className={`ml-1.5 px-1.5 py-0.5 rounded text-xs font-mono ${activeTab === 'divisions' ? 'bg-qw-dark/40 text-qw-dark' : 'bg-qw-accent/20 text-qw-accent'}`}>
                  {divisions.length}
                </span>
              )}
            </button>

            {/* Division Selector Dropdown */}
            {divisions.length > 0 && (
              <>
                <span className="text-qw-muted text-xs font-mono">{tournament.name || 'TOURNAMENT'}</span>
                <span className="text-qw-border text-xs">›</span>
                <div className="relative">
                <button
                  onClick={() => setShowDivisionDropdown(!showDivisionDropdown)}
                  className={`
                    px-4 py-2 font-display font-semibold text-xs uppercase
                    transition-all duration-200 rounded flex items-center gap-2
                    ${activeTab === 'division'
                      ? 'bg-qw-accent text-qw-dark tab-active'
                      : 'bg-qw-border text-qw-muted hover:text-white'
                    }
                  `}
                >
                  {activeDivisionId
                    ? divisions.find(d => d.id === activeDivisionId)?.name || 'SELECT'
                    : 'SELECT'
                  }
                  <svg className={`w-3 h-3 transition-transform ${showDivisionDropdown ? 'rotate-180' : ''}`} fill="currentColor" viewBox="0 0 12 12">
                    <path d="M6 8L1 3h10z" />
                  </svg>
                </button>

                {/* Dropdown */}
                {showDivisionDropdown && (
                  <>
                    <div 
                      className="fixed inset-0 z-40" 
                      onClick={() => setShowDivisionDropdown(false)}
                    />
                    <div className="absolute top-full right-0 mt-1 w-64 bg-qw-panel border border-qw-border rounded-lg z-50 overflow-hidden shadow-xl">
                      <div className="px-3 py-2 border-b border-qw-border bg-qw-dark rounded-t-lg">
                        <span className="text-xs text-qw-muted font-semibold uppercase">Select Division</span>
                      </div>
                      <div className="py-1">
                        {divisions.map((div, idx) => (
                          <button
                            key={div.id}
                            onClick={() => handleSelectDivision(div.id)}
                            className={`
                              w-full px-4 py-2.5 text-left text-sm font-mono
                              flex items-center justify-between
                              transition-all duration-150
                              ${div.id === activeDivisionId 
                                ? 'bg-qw-accent/20 text-qw-accent border-l-2 border-qw-accent' 
                                : 'text-white hover:bg-qw-dark hover:text-qw-blue border-l-2 border-transparent'
                              }
                            `}
                          >
                            <span className="flex items-center gap-3">
                              <span className="w-5 h-5 bg-qw-dark border border-qw-border rounded flex items-center justify-center text-xs font-semibold text-qw-muted">
                                {idx + 1}
                              </span>
                              <span className="tracking-wide">{div.name}</span>
                            </span>
                            <span className="text-qw-muted text-xs">
                              [{div.teams?.length || 0}]
                            </span>
                          </button>
                        ))}
                      </div>
                    </div>
                  </>
                )}
              </div>
              </>
            )}
            </nav>

            {/* Save Controls */}
            <input type="file" ref={fileInputRef} onChange={handleImport} accept=".json" className="hidden" />
            <div className="flex items-center gap-1 pl-3 border-l border-qw-border">
              <button
                onClick={() => fileInputRef.current?.click()}
                className="px-3 py-1.5 rounded bg-qw-dark border border-qw-border text-qw-muted hover:text-white hover:border-qw-accent transition-all flex items-center gap-1.5 text-sm"
                title="Load tournament"
              >
                📂 Load
              </button>
              <button
                onClick={handleExport}
                className="px-3 py-1.5 rounded font-semibold transition-all flex items-center gap-1.5 text-sm text-white hover:opacity-90"
                style={{ backgroundColor: '#F97316' }}
                title="Save tournament"
              >
                💾 Save
              </button>
              <button
                onClick={resetTournament}
                className="px-2 py-1.5 rounded text-red-400 hover:text-red-300 hover:bg-red-500/20 transition-all"
                title="Reset all"
              >
                🗑️
              </button>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
