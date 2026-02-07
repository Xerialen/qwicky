import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.QWICKY_SUPABASE_URL,
  process.env.QWICKY_SUPABASE_SERVICE_KEY
);

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const { tournamentId } = req.query;
  const status = req.query.status || 'pending';

  try {
    let query = supabase
      .from('match_submissions')
      .select('*')
      .eq('tournament_id', tournamentId)
      .order('created_at', { ascending: false });

    if (status !== 'all') {
      query = query.eq('status', status);
    }

    const { data, error } = await query;
    if (error) throw error;

    return res.json({ submissions: data });
  } catch (err) {
    console.error('Error fetching submissions:', err);
    return res.status(500).json({ error: 'Failed to fetch submissions' });
  }
}
