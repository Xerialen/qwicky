// src/components/DataControls.jsx
import React, { useRef } from 'react';

export default function DataControls({ 
  matches, 
  setMatches, 
  bracketConfig, 
  setBracketConfig 
}) {
  const fileInputRef = useRef(null);

  const handleExport = () => {
    const data = {
      version: 1,
      exportedAt: new Date().toISOString(),
      matches,
      bracketConfig
    };

    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `qw-tournament-${new Date().toISOString().split('T')[0]}.json`;
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
        
        if (data.matches && Array.isArray(data.matches)) {
          setMatches(data.matches);
        }
        
        if (data.bracketConfig) {
          setBracketConfig(data.bracketConfig);
        }

        alert('Data imported successfully!');
      } catch (err) {
        alert('Failed to import data: ' + err.message);
      }
    };
    reader.readAsText(file);
    
    // Reset file input
    e.target.value = '';
  };

  return (
    <div className="fixed bottom-4 right-4 flex gap-2 z-40">
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleImport}
        accept=".json"
        className="hidden"
      />
      
      <button
        onClick={() => fileInputRef.current?.click()}
        className="qw-btn-secondary px-4 py-2 rounded border border-qw-border bg-qw-panel hover:border-qw-accent flex items-center gap-2"
        title="Import tournament data"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
        </svg>
        Import
      </button>
      
      <button
        onClick={handleExport}
        className="qw-btn px-4 py-2 rounded flex items-center gap-2"
        title="Export tournament data"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
        </svg>
        Export
      </button>
    </div>
  );
}
