// api/public/tournaments.mjs
// Public read-only endpoint: list all tournaments.
// GET /api/public/tournaments

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.QWICKY_SUPABASE_URL,
  process.env.QWICKY_SUPABASE_SERVICE_KEY
);

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Cache-Control', 'public, max-age=60');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'GET only' });

  try {
    const { data, error } = await supabase
      .from('tournaments')
      .select('id, name, mode, start_date, end_date, updated_at')
      .order('updated_at', { ascending: false });

    if (error) throw error;

    const tournaments = (data || []).map(t => ({
      id: t.id,
      name: t.name,
      mode: t.mode,
      startDate: t.start_date,
      endDate: t.end_date,
      updatedAt: t.updated_at,
    }));

    return res.json({ tournaments });
  } catch (err) {
    console.error('[public/tournaments] Error:', err.message);
    return res.status(500).json({ error: 'Failed to fetch tournaments' });
  }
}
