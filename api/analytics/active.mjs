// GET /api/analytics/active
// Returns currently active tournaments (heartbeat within last 48 hours)
// and all-time count.

import { createClient } from '@supabase/supabase-js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const url = process.env.QWICKY_SUPABASE_URL;
  const key = process.env.QWICKY_SUPABASE_SERVICE_KEY;

  if (!url || !key) {
    return res.status(500).json({ error: 'Missing Supabase configuration' });
  }

  try {
    const supabase = createClient(url, key);

    // "Active" = heartbeat within last 48 hours
    const cutoff = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();

    const { data, error } = await supabase
      .from('active_tournaments')
      .select('*')
      .gte('last_heartbeat', cutoff)
      .order('last_heartbeat', { ascending: false });

    if (error) throw error;

    // Also get all-time count
    const { count, error: countError } = await supabase
      .from('active_tournaments')
      .select('*', { count: 'exact', head: true });

    if (countError) throw countError;

    return res.json({
      active: data || [],
      active_count: data?.length || 0,
      total_all_time: count || 0
    });
  } catch (err) {
    console.error('Error fetching active tournaments:', err);
    return res.status(500).json({ error: 'Failed to fetch analytics', details: err.message });
  }
}
