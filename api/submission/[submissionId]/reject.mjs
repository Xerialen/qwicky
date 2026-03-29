import { createClient } from '@supabase/supabase-js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { submissionId } = req.query;
  const supabase = createClient(process.env.QWICKY_SUPABASE_URL, process.env.QWICKY_SUPABASE_SERVICE_KEY);

  try {
    const { data, error } = await supabase
      .from('match_submissions')
      .update({ status: 'rejected', reviewed_at: new Date().toISOString() })
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
        payload: { submission_id: submissionId, new_status: 'rejected', reviewer: 'admin' },
      }).then(() => {}).catch(() => {});
    }

    return res.json({ submission: data });
  } catch (err) {
    console.error('Error rejecting submission:', err);
    return res.status(500).json({ error: 'Failed to reject submission', details: err.message });
  }
}
