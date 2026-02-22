// POST /api/analytics/heartbeat
// Records a heartbeat from an active tournament instance.
//
// Required Supabase table (create once in QWICKY Supabase dashboard):
//
//   CREATE TABLE active_tournaments (
//     id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
//     tournament_id TEXT UNIQUE NOT NULL,
//     tournament_name TEXT NOT NULL,
//     mode TEXT DEFAULT '',
//     start_date TEXT DEFAULT '',
//     end_date TEXT DEFAULT '',
//     division_count INTEGER DEFAULT 0,
//     total_teams INTEGER DEFAULT 0,
//     total_matches INTEGER DEFAULT 0,
//     completed_matches INTEGER DEFAULT 0,
//     last_heartbeat TIMESTAMPTZ DEFAULT NOW(),
//     created_at TIMESTAMPTZ DEFAULT NOW()
//   );

import { createClient } from '@supabase/supabase-js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const url = process.env.QWICKY_SUPABASE_URL;
  const key = process.env.QWICKY_SUPABASE_SERVICE_KEY;

  if (!url || !key) {
    return res.status(500).json({ error: 'Missing Supabase configuration' });
  }

  const {
    tournament_id,
    tournament_name,
    mode,
    start_date,
    end_date,
    division_count,
    total_teams,
    total_matches,
    completed_matches
  } = req.body || {};

  if (!tournament_id || !tournament_name) {
    return res.status(400).json({ error: 'tournament_id and tournament_name are required' });
  }

  try {
    const supabase = createClient(url, key);

    const { error } = await supabase
      .from('active_tournaments')
      .upsert({
        tournament_id,
        tournament_name,
        mode: mode || '',
        start_date: start_date || '',
        end_date: end_date || '',
        division_count: division_count || 0,
        total_teams: total_teams || 0,
        total_matches: total_matches || 0,
        completed_matches: completed_matches || 0,
        last_heartbeat: new Date().toISOString()
      }, {
        onConflict: 'tournament_id'
      });

    if (error) throw error;

    return res.json({ status: 'ok' });
  } catch (err) {
    console.error('Heartbeat error:', err);
    return res.status(500).json({ error: 'Failed to record heartbeat', details: err.message });
  }
}
