// src/components/Header.jsx
import React, { useState } from 'react';

export default function Header({ 
  tournament, 
  divisions, 
  activeTab, 
  setActiveTab,
  activeDivisionId,
  setActiveDivisionId 
}) {
  const [showDivisionDropdown, setShowDivisionDropdown] = useState(false);

  const handleSelectDivision = (divId) => {
    setActiveDivisionId(divId);
    setActiveTab('division');
    setShowDivisionDropdown(false);
  };

  return (
    <header className="bg-qw-panel border-b border-qw-border sticky top-0 z-50" style={{ boxShadow: '0 0 20px rgba(255, 177, 0, 0.1), inset 0 -1px 0 rgba(255, 177, 0, 0.2)' }}>
      <div className="max-w-7xl mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 flex items-center justify-center relative" style={{ background: 'linear-gradient(135deg, #FFB100 0%, #CC8E00 100%)', boxShadow: '0 0 15px rgba(255, 177, 0, 0.5)' }}>
              <span className="font-display font-black text-qw-dark text-lg tracking-wider">QW</span>
              {/* Corner cuts */}
              <div className="absolute top-0 right-0 w-2 h-2 bg-qw-panel" style={{ clipPath: 'polygon(100% 0, 0 0, 100% 100%)' }} />
              <div className="absolute bottom-0 left-0 w-2 h-2 bg-qw-panel" style={{ clipPath: 'polygon(0 100%, 0 0, 100% 100%)' }} />
            </div>
            <div>
              <h1 className="font-display font-bold text-lg tracking-cyber text-white" style={{ textShadow: '0 0 10px rgba(255, 177, 0, 0.3)' }}>
                {tournament.name || 'TOURNAMENT ADMIN'}
              </h1>
              <p className="text-xs text-qw-accent font-mono -mt-1 tracking-wider">// QUAKEWORLD</p>
            </div>
          </div>

          {/* Navigation */}
          <nav className="flex items-center gap-1">
            {/* Tournament Info Tab */}
            <button
              onClick={() => setActiveTab('info')}
              className={`
                px-4 py-2 font-display font-semibold text-xs tracking-cyber uppercase
                transition-all duration-200 border-b-2
                ${activeTab === 'info' 
                  ? 'text-qw-accent bg-qw-dark border-qw-accent tab-active' 
                  : 'text-qw-muted hover:text-qw-blue border-transparent hover:border-qw-blue/50'
                }
              `}
              style={activeTab === 'info' ? { boxShadow: '0 4px 15px rgba(255, 177, 0, 0.3)' } : {}}
            >
              <span className="mr-1.5 opacity-70">&gt;</span>
              Info
            </button>

            {/* Divisions Manager Tab */}
            <button
              onClick={() => setActiveTab('divisions')}
              className={`
                px-4 py-2 font-display font-semibold text-xs tracking-cyber uppercase
                transition-all duration-200 border-b-2
                ${activeTab === 'divisions' 
                  ? 'text-qw-accent bg-qw-dark border-qw-accent tab-active' 
                  : 'text-qw-muted hover:text-qw-blue border-transparent hover:border-qw-blue/50'
                }
              `}
              style={activeTab === 'divisions' ? { boxShadow: '0 4px 15px rgba(255, 177, 0, 0.3)' } : {}}
            >
              <span className="mr-1.5 opacity-70">&gt;</span>
              Divisions
              {divisions.length > 0 && (
                <span className="ml-1.5 px-1.5 py-0.5 bg-qw-accent/20 border border-qw-accent/50 text-qw-accent text-xs font-mono">
                  {divisions.length}
                </span>
              )}
            </button>

            {/* Division Selector Dropdown */}
            {divisions.length > 0 && (
              <div className="relative">
                <button
                  onClick={() => setShowDivisionDropdown(!showDivisionDropdown)}
                  className={`
                    px-4 py-2 font-display font-semibold text-xs tracking-cyber uppercase
                    transition-all duration-200 border-b-2 flex items-center gap-2
                    ${activeTab === 'division' 
                      ? 'text-qw-accent bg-qw-dark border-qw-accent tab-active' 
                      : 'text-qw-muted hover:text-qw-blue border-transparent hover:border-qw-blue/50'
                    }
                  `}
                  style={activeTab === 'division' ? { boxShadow: '0 4px 15px rgba(255, 177, 0, 0.3)' } : {}}
                >
                  <span className="opacity-70">&gt;</span>
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
                    <div className="absolute top-full right-0 mt-1 w-64 bg-qw-panel border border-qw-border z-50 overflow-hidden" style={{ boxShadow: '0 0 30px rgba(0, 0, 0, 0.8), 0 0 15px rgba(255, 177, 0, 0.2)' }}>
                      <div className="px-3 py-2 border-b border-qw-border bg-qw-dark">
                        <span className="text-xs font-mono text-qw-muted">// SELECT DIVISION</span>
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
                              <span className="w-5 h-5 bg-qw-dark border border-qw-border flex items-center justify-center text-xs font-display text-qw-muted">
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
            )}
          </nav>
        </div>
      </div>
    </header>
  );
}
