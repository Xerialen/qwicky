// src/components/Header.jsx
import React from 'react';

export default function Header({ activeTab, setActiveTab, onRefresh }) {
  const tabs = [
    { id: 'standings', label: 'Standings', icon: '🏆' },
    { id: 'schedule', label: 'Schedule', icon: '📅' },
    { id: 'players', label: 'Players', icon: '👤' },
    { id: 'teams', label: 'Teams', icon: '👥' },
    { id: 'wiki', label: 'Wiki Export', icon: '📝' },
  ];

  return (
    <header className="bg-qw-panel border-b border-qw-border sticky top-0 z-40">
      <div className="max-w-7xl mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-qw-accent rounded flex items-center justify-center">
              <span className="font-display font-bold text-qw-dark text-lg">QW</span>
            </div>
            <div>
              <h1 className="font-display font-bold text-lg text-white">Tournament Admin</h1>
              <p className="text-xs text-qw-muted">QuakeWorld Wiki Generator</p>
            </div>
          </div>

          {/* Navigation */}
          <nav className="flex items-center gap-1">
            {tabs.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`
                  px-4 py-2 font-body font-semibold text-sm
                  transition-all duration-200 rounded flex items-center gap-2
                  ${activeTab === tab.id 
                    ? 'bg-qw-accent text-qw-dark' 
                    : 'text-qw-muted hover:text-white hover:bg-qw-dark'
                  }
                `}
              >
                <span>{tab.icon}</span>
                {tab.label}
              </button>
            ))}
          </nav>

          {/* Refresh Button */}
          <button
            onClick={onRefresh}
            className="qw-btn-secondary px-3 py-2 rounded border border-qw-border text-qw-muted hover:text-white hover:border-qw-accent transition-colors"
            title="Refresh data"
          >
            🔄 Refresh
          </button>
        </div>
      </div>
    </header>
  );
}
