// src/components/DivisionView.jsx
import React, { useState } from 'react';
import DivisionSetup from './division/DivisionSetup';
import DivisionTeams from './division/DivisionTeams';
import DivisionSchedule from './division/DivisionSchedule';
import DivisionResults from './division/DivisionResults';
import DivisionStandings from './division/DivisionStandings';
import DivisionBracket from './division/DivisionBracket';
import DivisionWiki from './division/DivisionWiki';
import DivisionStats from './division/DivisionStats';

export default function DivisionView({ division, updateDivision, tournamentName, tournamentMode, tournamentStartDate, tournamentId, allDivisions }) {
  const [activeSubTab, setActiveSubTab] = useState('setup');

  const subTabs = [
    { id: 'setup', label: 'Setup', icon: '⚙️' },
    { id: 'teams', label: 'Teams', icon: '👥', count: division.teams?.length },
    { id: 'schedule', label: 'Schedule', icon: '📅', count: division.schedule?.length },
    { id: 'results', label: 'Results', icon: '📥' },
    { id: 'standings', label: 'Standings', icon: '🏆' },
    { id: 'bracket', label: 'Bracket', icon: '🎯' },
    { id: 'stats', label: 'Stats', icon: '📊' },
    { id: 'wiki', label: 'Wiki', icon: '📝' },
  ];

  const renderSubContent = () => {
    switch (activeSubTab) {
      case 'setup':
        return <DivisionSetup division={division} updateDivision={updateDivision} />;
      case 'teams':
        return <DivisionTeams division={division} updateDivision={updateDivision} tournamentMode={tournamentMode} allDivisions={allDivisions} />;
      case 'schedule':
        return <DivisionSchedule division={division} updateDivision={updateDivision} tournamentStartDate={tournamentStartDate} />;
      case 'results':
        return <DivisionResults division={division} updateDivision={updateDivision} tournamentId={tournamentId} />;
      case 'standings':
        return <DivisionStandings division={division} />;
      case 'bracket':
        return <DivisionBracket division={division} updateDivision={updateDivision} />;
      case 'stats':
        return <DivisionStats division={division} />;
      case 'wiki':
        return <DivisionWiki division={division} tournamentName={tournamentName} />;
      default:
        return <DivisionSetup division={division} updateDivision={updateDivision} />;
    }
  };

  // Calculate stats
  const completedMatches = division.schedule?.filter(m => m.status === 'completed').length || 0;
  const totalMatches = division.schedule?.length || 0;

  return (
    <div className="space-y-6">
      {/* Division Header */}
      <div className="qw-panel p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded bg-qw-accent/20 flex items-center justify-center">
              <span className="font-display font-bold text-qw-accent text-xl">
                {division.name.charAt(0)}
              </span>
            </div>
            <div>
              <h2 className="font-display font-bold text-2xl text-white">{division.name}</h2>
              <p className="text-sm text-qw-muted">
                {division.teams?.length || 0} teams • 
                {division.numGroups} groups • 
                {completedMatches}/{totalMatches} matches completed
              </p>
            </div>
          </div>
          <div className="text-right">
            <div className="text-sm text-qw-muted">Format</div>
            <div className="font-mono text-white">
              Groups Bo{division.groupStageBestOf} → 
              Playoffs Bo{division.playoffQFBestOf}/{division.playoffSFBestOf}/{division.playoffFinalBestOf}
            </div>
          </div>
        </div>
      </div>

      {/* Sub-navigation */}
      <div className="flex gap-1 overflow-x-auto pb-2">
        {subTabs.map((tab, idx) => (
          <button
            key={tab.id}
            onClick={() => setActiveSubTab(tab.id)}
            className={`
              px-4 py-2 font-body font-semibold text-sm whitespace-nowrap
              transition-all duration-200 rounded flex items-center gap-2
              ${activeSubTab === tab.id 
                ? 'bg-qw-accent text-qw-dark' 
                : 'bg-qw-panel border border-qw-border text-qw-muted hover:text-white hover:border-qw-accent'
              }
            `}
          >
            <span className="text-base">{tab.icon}</span>
            {tab.label}
            {tab.count !== undefined && tab.count > 0 && (
              <span className={`
                px-1.5 py-0.5 rounded text-xs
                ${activeSubTab === tab.id ? 'bg-qw-dark/30' : 'bg-qw-border'}
              `}>
                {tab.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Sub-content */}
      {renderSubContent()}
    </div>
  );
}
