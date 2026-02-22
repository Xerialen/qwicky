import React, { useState, useEffect } from 'react';

export default function UsageAnalytics() {
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchAnalytics();
  }, []);

  const fetchAnalytics = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/analytics/active');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setAnalytics(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const timeAgo = (dateStr) => {
    const diff = Date.now() - new Date(dateStr).getTime();
    const minutes = Math.floor(diff / 60000);
    if (minutes < 1) return 'just now';
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    return `${Math.floor(hours / 24)}d ago`;
  };

  if (loading) {
    return (
      <div className="qw-panel p-12 text-center">
        <p className="text-qw-muted">Loading analytics...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="qw-panel p-12 text-center">
        <p className="text-red-400 mb-4">Failed to load analytics: {error}</p>
        <button onClick={fetchAnalytics} className="qw-btn">Retry</button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="qw-panel p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="font-display text-2xl text-white">Usage Analytics</h2>
            <p className="text-qw-muted text-sm mt-1">Active tournament overview</p>
          </div>
          <button onClick={fetchAnalytics} className="qw-btn-secondary text-sm px-3 py-1.5">
            Refresh
          </button>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-qw-dark rounded-lg p-5 border border-qw-border">
            <p className="text-qw-muted text-xs font-semibold uppercase mb-2">Active Now</p>
            <p className="text-4xl font-display font-bold text-qw-accent">{analytics.active_count}</p>
            <p className="text-qw-muted text-xs mt-1">tournaments with activity in last 48h</p>
          </div>
          <div className="bg-qw-dark rounded-lg p-5 border border-qw-border">
            <p className="text-qw-muted text-xs font-semibold uppercase mb-2">All Time</p>
            <p className="text-4xl font-display font-bold text-white">{analytics.total_all_time}</p>
            <p className="text-qw-muted text-xs mt-1">tournaments tracked</p>
          </div>
          <div className="bg-qw-dark rounded-lg p-5 border border-qw-border">
            <p className="text-qw-muted text-xs font-semibold uppercase mb-2">Total Teams</p>
            <p className="text-4xl font-display font-bold text-qw-blue">
              {analytics.active.reduce((sum, t) => sum + (t.total_teams || 0), 0)}
            </p>
            <p className="text-qw-muted text-xs mt-1">across active tournaments</p>
          </div>
        </div>
      </div>

      {/* Active Tournaments List */}
      {analytics.active.length > 0 ? (
        <div className="qw-panel p-6">
          <h3 className="font-display text-lg text-white mb-4">Active Tournaments</h3>
          <div className="space-y-3">
            {analytics.active.map((t) => (
              <div key={t.tournament_id} className="bg-qw-dark rounded-lg p-4 border border-qw-border flex items-center justify-between">
                <div>
                  <h4 className="text-white font-semibold">{t.tournament_name}</h4>
                  <div className="flex items-center gap-3 mt-1 text-xs text-qw-muted">
                    {t.mode && <span className="bg-qw-border px-2 py-0.5 rounded">{t.mode}</span>}
                    <span>{t.division_count} div{t.division_count !== 1 ? 's' : ''}</span>
                    <span>{t.total_teams} teams</span>
                    <span className="text-qw-win">{t.completed_matches}</span>
                    <span>/</span>
                    <span>{t.total_matches} matches</span>
                  </div>
                </div>
                <div className="text-right text-xs text-qw-muted">
                  <p>{timeAgo(t.last_heartbeat)}</p>
                  {t.start_date && (
                    <p className="mt-1">
                      {t.start_date}{t.end_date ? ` — ${t.end_date}` : ''}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="qw-panel p-12 text-center">
          <p className="text-qw-muted">No active tournaments at the moment</p>
        </div>
      )}
    </div>
  );
}
