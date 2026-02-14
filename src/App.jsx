// src/App.jsx
import React, { useState, useEffect } from 'react';
import Header from './components/Header';
import TournamentInfo from './components/TournamentInfo';
import DivisionManager from './components/DivisionManager';
import DivisionView from './components/DivisionView';

const STORAGE_KEY = 'qw-tournament-data';

// Default tournament structure
const createDefaultTournament = () => ({
  name: '',
  mode: '4on4',
  startDate: '',
  endDate: '',
  divisions: [],
  activeDivisionId: null
});

// Default division structure
export const createDefaultDivision = (name = 'Division 1') => ({
  id: `div-${Date.now()}`,
  name,
  // Format settings
  format: 'groups', // groups, single-elim, double-elim
  numGroups: 2,
  teamsPerGroup: 4,
  advanceCount: 2,
  // Group stage format
  groupStageBestOf: 3,
  groupStageType: 'bestof', // 'bestof' or 'playall'
  groupMeetings: 1, // 1 = single round-robin, 2 = double, etc.
  matchPace: 'weekly', // daily, twice-weekly, weekly, biweekly, flexible
  // Playoff settings
  playoffFormat: 'single', // 'single' or 'double' elimination
  playoffTeams: 4, // 4 or 8 teams in playoffs
  playoffR32BestOf: 3,
  playoffR32Type: 'bestof',
  playoffR16BestOf: 3,
  playoffR16Type: 'bestof',
  playoffQFBestOf: 3,
  playoffQFType: 'bestof',
  playoffSFBestOf: 3,
  playoffSFType: 'bestof',
  playoffFinalBestOf: 5,
  playoffFinalType: 'bestof',
  playoff3rdBestOf: 0,
  playoff3rdType: 'bestof',
  // Double elim specific
  playoffLosersBestOf: 3,
  playoffLosersType: 'bestof',
  playoffGrandFinalBestOf: 5,
  playoffGrandFinalType: 'bestof',
  playoffBracketReset: true,
  // Points system (no draws in Quake)
  pointsWin: 3,
  pointsLoss: 0,
  // Tie-breakers (in order of priority)
  tieBreakers: ['mapDiff', 'fragDiff', 'headToHead'],
  // Data
  teams: [],
  schedule: [],
  bracket: createDefaultBracket('single', 4),
  rawMaps: []
});

// Helper to create bracket structure based on format and team count
export function createDefaultBracket(format, teamCount) {
  if (format === 'double') {
    return createDoubleElimBracket(teamCount);
  }
  return createSingleElimBracket(teamCount);
}

function createSingleElimBracket(teamCount) {
  const bracket = {
    format: 'single',
    teamCount,
    winners: {},
    thirdPlace: { id: '3rd', team1: '', team2: '' }
  };
  
  // 32 teams: R32 → R16 → QF → SF → F
  if (teamCount >= 32) {
    bracket.winners.round32 = Array.from({ length: 16 }, (_, i) => ({
      id: `w-r32-${i + 1}`,
      team1: '',
      team2: ''
    }));
    bracket.winners.round16 = Array.from({ length: 8 }, (_, i) => ({
      id: `w-r16-${i + 1}`,
      team1: '',
      team2: ''
    }));
    bracket.winners.quarterFinals = Array.from({ length: 4 }, (_, i) => ({
      id: `w-qf${i + 1}`,
      team1: '',
      team2: ''
    }));
  }
  // 16 teams: R16 → QF → SF → F
  else if (teamCount >= 16) {
    bracket.winners.round16 = Array.from({ length: 8 }, (_, i) => ({
      id: `w-r16-${i + 1}`,
      team1: '',
      team2: ''
    }));
    bracket.winners.quarterFinals = Array.from({ length: 4 }, (_, i) => ({
      id: `w-qf${i + 1}`,
      team1: '',
      team2: ''
    }));
  }
  // 12 teams: Need 4 byes, 8 play first round → QF → SF → F
  else if (teamCount >= 12) {
    bracket.winners.round12 = Array.from({ length: 4 }, (_, i) => ({
      id: `w-r12-${i + 1}`,
      team1: '',
      team2: ''
    }));
    bracket.winners.quarterFinals = Array.from({ length: 4 }, (_, i) => ({
      id: `w-qf${i + 1}`,
      team1: '',
      team2: ''
    }));
  }
  // 8 teams: QF → SF → F
  else if (teamCount >= 8) {
    bracket.winners.quarterFinals = Array.from({ length: 4 }, (_, i) => ({
      id: `w-qf${i + 1}`,
      team1: '',
      team2: ''
    }));
  }
  
  // All brackets have SF and F
  bracket.winners.semiFinals = [
    { id: 'w-sf1', team1: '', team2: '' },
    { id: 'w-sf2', team1: '', team2: '' },
  ];
  
  bracket.winners.final = { id: 'w-final', team1: '', team2: '' };
  
  return bracket;
}

function createDoubleElimBracket(teamCount) {
  const bracket = {
    format: 'double',
    teamCount,
    winners: {},
    losers: {},
    grandFinal: { id: 'grand-final', team1: '', team2: '' },
    bracketReset: { id: 'bracket-reset', team1: '', team2: '', needed: false }
  };
  
  // 32 teams
  if (teamCount >= 32) {
    bracket.winners.round32 = Array.from({ length: 16 }, (_, i) => ({
      id: `w-r32-${i + 1}`,
      team1: '',
      team2: ''
    }));
    bracket.winners.round16 = Array.from({ length: 8 }, (_, i) => ({
      id: `w-r16-${i + 1}`,
      team1: '',
      team2: ''
    }));
    bracket.winners.quarterFinals = Array.from({ length: 4 }, (_, i) => ({
      id: `w-qf${i + 1}`,
      team1: '',
      team2: ''
    }));
    // Complex losers bracket for 32 teams
    bracket.losers.round1 = Array.from({ length: 8 }, (_, i) => ({
      id: `l-r1-${i + 1}`,
      team1: '',
      team2: ''
    }));
    bracket.losers.round2 = Array.from({ length: 8 }, (_, i) => ({
      id: `l-r2-${i + 1}`,
      team1: '',
      team2: ''
    }));
    bracket.losers.round3 = Array.from({ length: 4 }, (_, i) => ({
      id: `l-r3-${i + 1}`,
      team1: '',
      team2: ''
    }));
    bracket.losers.round4 = Array.from({ length: 4 }, (_, i) => ({
      id: `l-r4-${i + 1}`,
      team1: '',
      team2: ''
    }));
    bracket.losers.round5 = Array.from({ length: 2 }, (_, i) => ({
      id: `l-r5-${i + 1}`,
      team1: '',
      team2: ''
    }));
    bracket.losers.round6 = [{ id: 'l-r6-1', team1: '', team2: '' }];
    bracket.losers.final = { id: 'l-final', team1: '', team2: '' };
  }
  // 16 teams
  else if (teamCount >= 16) {
    bracket.winners.round16 = Array.from({ length: 8 }, (_, i) => ({
      id: `w-r16-${i + 1}`,
      team1: '',
      team2: ''
    }));
    bracket.winners.quarterFinals = Array.from({ length: 4 }, (_, i) => ({
      id: `w-qf${i + 1}`,
      team1: '',
      team2: ''
    }));
    bracket.losers.round1 = Array.from({ length: 4 }, (_, i) => ({
      id: `l-r1-${i + 1}`,
      team1: '',
      team2: ''
    }));
    bracket.losers.round2 = Array.from({ length: 4 }, (_, i) => ({
      id: `l-r2-${i + 1}`,
      team1: '',
      team2: ''
    }));
    bracket.losers.round3 = Array.from({ length: 2 }, (_, i) => ({
      id: `l-r3-${i + 1}`,
      team1: '',
      team2: ''
    }));
    bracket.losers.round4 = [{ id: 'l-r4-1', team1: '', team2: '' }];
    bracket.losers.final = { id: 'l-final', team1: '', team2: '' };
  }
  // 12 teams
  else if (teamCount >= 12) {
    bracket.winners.round12 = Array.from({ length: 4 }, (_, i) => ({
      id: `w-r12-${i + 1}`,
      team1: '',
      team2: ''
    }));
    bracket.winners.quarterFinals = Array.from({ length: 4 }, (_, i) => ({
      id: `w-qf${i + 1}`,
      team1: '',
      team2: ''
    }));
    bracket.losers.round1 = Array.from({ length: 2 }, (_, i) => ({
      id: `l-r1-${i + 1}`,
      team1: '',
      team2: ''
    }));
    bracket.losers.round2 = Array.from({ length: 2 }, (_, i) => ({
      id: `l-r2-${i + 1}`,
      team1: '',
      team2: ''
    }));
    bracket.losers.round3 = [{ id: 'l-r3-1', team1: '', team2: '' }];
    bracket.losers.final = { id: 'l-final', team1: '', team2: '' };
  }
  // 8 teams
  else if (teamCount >= 8) {
    bracket.winners.quarterFinals = [
      { id: 'w-qf1', team1: '', team2: '' },
      { id: 'w-qf2', team1: '', team2: '' },
      { id: 'w-qf3', team1: '', team2: '' },
      { id: 'w-qf4', team1: '', team2: '' },
    ];
    bracket.losers.round1 = [
      { id: 'l-r1-1', team1: '', team2: '' },
      { id: 'l-r1-2', team1: '', team2: '' },
    ];
    bracket.losers.round2 = [
      { id: 'l-r2-1', team1: '', team2: '' },
      { id: 'l-r2-2', team1: '', team2: '' },
    ];
    bracket.losers.round3 = [
      { id: 'l-r3-1', team1: '', team2: '' },
    ];
    bracket.losers.final = { id: 'l-final', team1: '', team2: '' };
  }
  // 4 teams
  else {
    bracket.losers.round1 = [
      { id: 'l-r1-1', team1: '', team2: '' },
    ];
    bracket.losers.final = { id: 'l-final', team1: '', team2: '' };
  }
  
  bracket.winners.semiFinals = [
    { id: 'w-sf1', team1: '', team2: '' },
    { id: 'w-sf2', team1: '', team2: '' },
  ];
  
  bracket.winners.final = { id: 'w-final', team1: '', team2: '' };
  
  return bracket;
}

function App() {
  // Main tournament state
  const [tournament, setTournament] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        // Migration: ensure divisions array exists
        if (!parsed.divisions) {
          parsed.divisions = [];
        }
        return parsed;
      }
      return createDefaultTournament();
    } catch {
      return createDefaultTournament();
    }
  });

  // UI state
  const [activeTab, setActiveTab] = useState('info'); // info, divisions, division
  const [activeDivisionId, setActiveDivisionId] = useState(tournament.activeDivisionId);

  // Persist to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        ...tournament,
        activeDivisionId
      }));
    } catch (err) {
      console.error('Failed to save tournament:', err);
    }
  }, [tournament, activeDivisionId]);

  // Get active division
  const activeDivision = tournament.divisions.find(d => d.id === activeDivisionId);

  // Update tournament info (not division-specific)
  const updateTournamentInfo = (updates) => {
    setTournament(prev => ({ ...prev, ...updates }));
  };

  // Add a new division
  const addDivision = (name) => {
    const newDiv = createDefaultDivision(name);
    setTournament(prev => ({
      ...prev,
      divisions: [...prev.divisions, newDiv]
    }));
    setActiveDivisionId(newDiv.id);
    setActiveTab('division');
    return newDiv.id;
  };

  // Remove a division
  const removeDivision = (divId) => {
    setTournament(prev => ({
      ...prev,
      divisions: prev.divisions.filter(d => d.id !== divId)
    }));
    if (activeDivisionId === divId) {
      const remaining = tournament.divisions.filter(d => d.id !== divId);
      setActiveDivisionId(remaining.length > 0 ? remaining[0].id : null);
      if (remaining.length === 0) {
        setActiveTab('divisions');
      }
    }
  };

  // Update a specific division
  const updateDivision = (divId, updates) => {
    setTournament(prev => ({
      ...prev,
      divisions: prev.divisions.map(d => 
        d.id === divId ? { ...d, ...updates } : d
      )
    }));
  };

  // Duplicate a division (copy settings, not data)
  const duplicateDivision = (divId) => {
    const source = tournament.divisions.find(d => d.id === divId);
    if (!source) return;

    const newDiv = {
      ...createDefaultDivision(`${source.name} (Copy)`),
      // Copy format settings
      format: source.format,
      numGroups: source.numGroups,
      teamsPerGroup: source.teamsPerGroup,
      advanceCount: source.advanceCount,
      groupStageBestOf: source.groupStageBestOf,
      playoffQFBestOf: source.playoffQFBestOf,
      playoffSFBestOf: source.playoffSFBestOf,
      playoffFinalBestOf: source.playoffFinalBestOf,
      playoff3rdBestOf: source.playoff3rdBestOf,
      pointsWin: source.pointsWin,
      pointsDraw: source.pointsDraw,
      pointsLoss: source.pointsLoss,
    };

    setTournament(prev => ({
      ...prev,
      divisions: [...prev.divisions, newDiv]
    }));
    
    return newDiv.id;
  };

  // Reset entire tournament
  const resetTournament = () => {
    if (!window.confirm('Reset ALL tournament data? This cannot be undone.')) return;
    if (!window.confirm('This will delete all divisions, teams, and results. Continue?')) return;
    
    setTournament(createDefaultTournament());
    setActiveDivisionId(null);
    setActiveTab('info');
  };

  // Import tournament data
  const importTournament = (data) => {
    if (data.divisions) {
      setTournament(data);
      if (data.divisions.length > 0) {
        setActiveDivisionId(data.activeDivisionId || data.divisions[0].id);
        setActiveTab('division');
      }
    }
  };

  // Calculate stats
  const stats = {
    divisions: tournament.divisions.length,
    teams: tournament.divisions.reduce((sum, d) => sum + (d.teams?.length || 0), 0),
    matches: tournament.divisions.reduce((sum, d) => sum + (d.schedule?.length || 0), 0),
    completed: tournament.divisions.reduce((sum, d) => 
      sum + (d.schedule?.filter(m => m.status === 'completed')?.length || 0), 0
    )
  };

  const renderContent = () => {
    switch (activeTab) {
      case 'info':
        return (
          <TournamentInfo
            tournament={tournament}
            updateTournament={updateTournamentInfo}
          />
        );
      case 'divisions':
        return (
          <DivisionManager
            divisions={tournament.divisions}
            activeDivisionId={activeDivisionId}
            setActiveDivisionId={setActiveDivisionId}
            addDivision={addDivision}
            removeDivision={removeDivision}
            duplicateDivision={duplicateDivision}
            setActiveTab={setActiveTab}
          />
        );
      case 'division':
        if (!activeDivision) {
          return (
            <div className="qw-panel p-12 text-center">
              <div className="text-6xl mb-4">📁</div>
              <h2 className="font-display text-2xl text-white mb-2">No Division Selected</h2>
              <p className="text-qw-muted mb-4">Select or create a division to get started</p>
              <button
                onClick={() => setActiveTab('divisions')}
                className="qw-btn"
              >
                Manage Divisions
              </button>
            </div>
          );
        }
        return (
          <DivisionView
            division={activeDivision}
            updateDivision={(updates) => updateDivision(activeDivision.id, updates)}
            tournamentName={tournament.name}
            tournamentMode={tournament.mode}
            tournamentStartDate={tournament.startDate}
            tournamentId={(tournament.name || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}
            allDivisions={tournament.divisions}
            tournament={tournament}
          />
        );
      default:
        return (
          <TournamentInfo
            tournament={tournament}
            updateTournament={updateTournamentInfo}
          />
        );
    }
  };

  return (
    <div className="min-h-screen bg-qw-darker">
      {/* Decorative Elements */}
      <div className="noise-overlay" />
      <div className="scanline" />
      
      {/* Header */}
      <Header
        tournament={tournament}
        divisions={tournament.divisions}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        activeDivisionId={activeDivisionId}
        setActiveDivisionId={setActiveDivisionId}
        importTournament={importTournament}
        resetTournament={resetTournament}
      />
      
      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 py-8 pb-24">
        {renderContent()}
      </main>
      
      {/* Status Bar */}
      <div className="fixed bottom-0 left-0 right-0 bg-qw-panel border-t border-qw-border py-2 px-4 flex items-center justify-between text-xs font-mono text-qw-muted z-30">
        <div className="flex items-center gap-4">
          <span className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-qw-win"></span>
            <span className="text-qw-text">{tournament.name || 'NEW_TOURNAMENT'}</span>
          </span>
          <span className="text-qw-accent">|</span>
          <span><span className="text-qw-accent">{stats.divisions}</span> DIV</span>
          <span className="text-qw-accent">|</span>
          <span><span className="text-qw-accent">{stats.teams}</span> TEAMS</span>
          <span className="text-qw-accent">|</span>
          <span><span className="text-qw-win">{stats.completed}</span>/<span className="text-qw-text">{stats.matches}</span> MATCHES</span>
        </div>
        <div className="flex items-center gap-2">
          <span>QW_ADMIN</span>
          <span className="text-qw-blue">v0.4</span>
        </div>
      </div>
    </div>
  );
}

export default App;
