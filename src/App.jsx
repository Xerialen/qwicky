// src/App.jsx
import React, { useState, useMemo } from 'react';
import Header from './components/Header';
import LoadingSpinner from './components/LoadingSpinner';
import ErrorMessage from './components/ErrorMessage';
import TournamentInfo from './components/TournamentInfo';
import StandingsView from './components/StandingsView';
import ScheduleView from './components/ScheduleView';
import PlayersView from './components/PlayersView';
import TeamsView from './components/TeamsView';
import WikiExport from './components/WikiExport';
import { useAllTournamentData } from './hooks/useTournamentData';

function App() {
  const [activeTab, setActiveTab] = useState('standings');
  const { data: division, rawData, loading, error, refetch } = useAllTournamentData('Tournament');

  if (loading) {
    return <LoadingSpinner message="Loading tournament data..." />;
  }

  if (error) {
    return <ErrorMessage error={error} onRetry={refetch} />;
  }

  if (!division || !rawData) {
    return <ErrorMessage error="No data available" onRetry={refetch} />;
  }

  return (
    <div className="min-h-screen bg-qw-darker">
      {/* Decorative Elements */}
      <div className="noise-overlay" />
      <div className="scanline" />
      
      <Header 
        activeTab={activeTab} 
        setActiveTab={setActiveTab} 
        onRefresh={refetch} 
      />
      
      <main className="max-w-7xl mx-auto px-4 py-8 pb-24">
        <TournamentInfo division={division} />
        
        <div className="mt-8">
          {activeTab === 'standings' && (
            <StandingsView data={rawData.standings} />
          )}
          
          {activeTab === 'players' && (
            <PlayersView data={rawData.players} />
          )}
          
          {activeTab === 'schedule' && (
            <ScheduleView 
              groupGames={rawData.groupGames}
              playoffGames={rawData.playoffGames}
              scheduleConfig={rawData.scheduleConfig}
            />
          )}
          
          {activeTab === 'teams' && (
            <TeamsView data={rawData.teams} />
          )}
          
          {activeTab === 'wiki' && (
            <WikiExport division={division} />
          )}
        </div>
      </main>

      {/* Status Bar */}
      <div className="fixed bottom-0 left-0 right-0 bg-qw-panel border-t border-qw-border py-2 px-4 flex items-center justify-between text-xs font-mono text-qw-muted z-30" style={{ boxShadow: 'inset 0 1px 0 rgba(255, 177, 0, 0.1)' }}>
        <div className="flex items-center gap-4">
          <span className="flex items-center gap-2">
            <span className="w-2 h-2 bg-qw-win" style={{ boxShadow: '0 0 8px rgba(0, 255, 136, 0.8)' }}></span>
            <span className="text-qw-text">{division.name || 'TOURNAMENT'}</span>
          </span>
          <span className="text-qw-accent">|</span>
          <span><span className="text-qw-accent">{division.teams?.length || 0}</span> TEAMS</span>
          <span className="text-qw-accent">|</span>
          <span><span className="text-qw-win">{division.schedule?.filter(m => m.status === 'completed').length || 0}</span>/<span className="text-qw-text">{division.schedule?.length || 0}</span> MATCHES</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-qw-accent">//</span>
          <span>QW_ADMIN</span>
          <span className="text-qw-blue">v1.0</span>
        </div>
      </div>
    </div>
  );
}

export default App;
