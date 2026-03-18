// api/aliases.mjs
// CRUD endpoint for team_aliases table.
// GET  /api/aliases?tournamentId=<id>           — list aliases for tournament + globals
// POST /api/aliases                             — create alias
// DELETE /api/aliases?id=<uuid>                — delete alias by id

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.QWICKY_SUPABASE_URL,
  process.env.QWICKY_SUPABASE_SERVICE_KEY
);

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  // ── GET — list aliases ──────────────────────────────────────────────────────
  if (req.method === 'GET') {
    const { tournamentId } = req.query;
    if (!tournamentId) {
      return res.status(400).json({ error: 'tournamentId is required' });
    }

    const { data, error } = await supabase
      .from('team_aliases')
      .select('*')
      .or(`tournament_id.eq.${tournamentId},is_global.eq.true`)
      .order('created_at', { ascending: false });

    if (error) return res.status(500).json({ error: error.message });
    return res.json(data || []);
  }

  // ── POST — create alias ─────────────────────────────────────────────────────
  if (req.method === 'POST') {
    const { tournamentId, teamId, alias, canonical, isGlobal = false, source = 'manual' } = req.body || {};

    if (!alias || !canonical) {
      return res.status(400).json({ error: 'alias and canonical are required' });
    }

    const { data, error } = await supabase
      .from('team_aliases')
      .insert({
        tournament_id: isGlobal ? null : (tournamentId || null),
        team_id: teamId || null,
        alias: alias.toLowerCase().trim(),
        canonical,
        is_global: isGlobal,
        source,
      })
      .select()
      .single();

    if (error) {
      if (error.code === '23505') return res.status(409).json({ error: 'Alias already exists' });
      return res.status(500).json({ error: error.message });
    }
    return res.status(201).json(data);
  }

  // ── DELETE — remove alias ───────────────────────────────────────────────────
  if (req.method === 'DELETE') {
    const { id } = req.query;
    if (!id) return res.status(400).json({ error: 'id is required' });

    const { error } = await supabase
      .from('team_aliases')
      .delete()
      .eq('id', id);

    if (error) return res.status(500).json({ error: error.message });
    return res.status(204).end();
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
