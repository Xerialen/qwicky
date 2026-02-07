import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.QWICKY_SUPABASE_URL,
  process.env.QWICKY_SUPABASE_SERVICE_KEY
);

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { submissionId } = req.query;

  try {
    const { data, error } = await supabase
      .from('match_submissions')
      .update({ status: 'approved', reviewed_at: new Date().toISOString() })
      .eq('id', submissionId)
      .select()
      .single();

    if (error) throw error;
    if (!data) return res.status(404).json({ error: 'Submission not found' });

    return res.json({ submission: data });
  } catch (err) {
    console.error('Error approving submission:', err);
    return res.status(500).json({ error: 'Failed to approve submission' });
  }
}
