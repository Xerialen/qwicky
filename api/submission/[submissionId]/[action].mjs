import { createClient } from '@supabase/supabase-js';
import { requireAdminAuth } from '../../_auth.mjs';

const VALID_ACTIONS = new Set(['approve', 'reject']);

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (!requireAdminAuth(req, res)) return;
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { submissionId, action } = req.query;

  if (!VALID_ACTIONS.has(action)) {
    return res.status(400).json({ error: 'Invalid action. Use approve or reject.' });
  }

  const newStatus = action === 'approve' ? 'approved' : 'rejected';
  const supabase = createClient(process.env.QWICKY_SUPABASE_URL, process.env.QWICKY_SUPABASE_SERVICE_KEY);

  try {
    const { data, error } = await supabase
      .from('match_submissions')
      .update({ status: newStatus, reviewed_at: new Date().toISOString() })
      .eq('id', submissionId)
      .select()
      .single();

    if (error) throw error;
    if (!data) return res.status(404).json({ error: 'Submission not found' });

    // Enqueue Discord embed edit notification (fire-and-forget)
    if (data.discord_message_id && data.discord_channel_id) {
      supabase.from('discord_notifications').insert({
        tournament_id: data.tournament_id,
        channel_id: data.discord_channel_id,
        notification_type: 'edit_submission',
        payload: { submission_id: submissionId, new_status: newStatus, reviewer: 'admin' },
      }).then(() => {}).catch(() => {});
    }

    // Fire-and-forget wiki auto-publish on approve
    if (action === 'approve' && data.tournament_id) {
      const baseUrl = `https://${req.headers.host || 'qwicky.vercel.app'}`;
      fetch(`${baseUrl}/api/wiki?action=auto-publish`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tournamentId: data.tournament_id,
          divisionId: data.division_id || undefined,
        }),
      }).catch(() => {});
    }

    return res.json({ submission: data });
  } catch (err) {
    console.error(`Error ${action}ing submission:`, err);
    return res.status(500).json({ error: `Failed to ${action} submission`, details: err.message });
  }
}
