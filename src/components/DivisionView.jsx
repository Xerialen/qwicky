// src/components/DivisionView.jsx
import React, { useState, useEffect } from 'react';
import DivisionSetup from './division/DivisionSetup';
import DivisionTeams from './division/DivisionTeams';
import DivisionSchedule from './division/DivisionSchedule';
import DivisionResults from './division/DivisionResults';
import DivisionBracket from './division/DivisionBracket';
import DivisionWiki from './division/DivisionWiki';
import DivisionCasterView from './division/DivisionCasterView';
import MaterialIcon from './ui/MaterialIcon';

export default function DivisionView({
  division,
  updateDivision,
  updateAnyDivision,
  tournamentName,
  tournamentMode,
  tournamentStartDate,
  tournamentId,
  allDivisions,
  tournament,
  initialSubTab,
  activeSubTab: externalSubTab,
  setActiveSubTab: setExternalSubTab,
}) {
  // Use external sub-tab from header if provided, otherwise internal
  const [internalSubTab, setInternalSubTab] = useState(initialSubTab || 'setup');
  const activeSubTab = externalSubTab || internalSubTab;
  const setActiveSubTab = setExternalSubTab || setInternalSubTab;

  // Respond to external navigation requests
  useEffect(() => {
    if (initialSubTab) {
      setActiveSubTab(initialSubTab);
    }
  }, [initialSubTab]);

  const renderSubContent = () => {
    switch (activeSubTab) {
      case 'setup':
        return <DivisionSetup division={division} updateDivision={updateDivision} />;
      case 'teams':
        return (
          <DivisionTeams
            division={division}
            updateDivision={updateDivision}
            tournamentMode={tournamentMode}
            allDivisions={allDivisions}
          />
        );
      case 'schedule':
        return (
          <DivisionSchedule
            division={division}
            updateDivision={updateDivision}
            tournamentStartDate={tournamentStartDate}
            allDivisions={allDivisions}
            tournamentId={tournamentId}
          />
        );
      case 'results':
        return (
          <DivisionResults
            division={division}
            updateDivision={updateDivision}
            updateAnyDivision={updateAnyDivision}
            tournamentId={tournamentId}
            tournament={tournament}
          />
        );
      case 'bracket':
        return <DivisionBracket division={division} updateDivision={updateDivision} />;
      case 'caster':
        return <DivisionCasterView division={division} />;
      case 'wiki':
        return (
          <DivisionWiki
            division={division}
            tournamentName={tournamentName}
            updateDivision={updateDivision}
          />
        );
      default:
        return <DivisionSetup division={division} updateDivision={updateDivision} />;
    }
  };

  const completedMatches = division.schedule?.filter((m) => m.status === 'completed').length || 0;
  const totalMatches = division.schedule?.length || 0;

  return (
    <div className="space-y-6">
      {/* Division Header */}
      <div className="flex items-center justify-between border-b-2 border-surface-container-high pb-4">
        <div>
          <h1 className="text-4xl font-black text-on-surface tracking-tighter uppercase font-headline mb-1">
            {division.name}
          </h1>
          <div className="flex gap-6 text-on-surface-variant/50 font-mono text-[10px] uppercase">
            <span>{division.teams?.length || 0} teams</span>
            <span>{division.numGroups} groups</span>
            <span>{completedMatches}/{totalMatches} matches</span>
          </div>
        </div>
        <div className="text-right hidden lg:block">
          <div className="text-[9px] text-on-surface-variant/40 font-headline uppercase tracking-widest">
            Format
          </div>
          <div className="font-mono text-on-surface text-sm">
            Groups Bo{division.groupStageBestOf} → Playoffs Bo{division.playoffFinalBestOf}
          </div>
        </div>
      </div>

      {/* Sub-content */}
      {renderSubContent()}
    </div>
  );
}
