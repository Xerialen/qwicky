// api/wiki/publish.mjs
// Vercel serverless function for publishing MediaWiki markup.
//
// POST /api/wiki/publish
// Body: { pageTitle, content, section?, summary?, credentials? }

import { createWikiClient, editPage } from './_wikiClient.mjs';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  }

  const { pageTitle, content, section, summary, credentials } = req.body || {};

  if (!pageTitle || !content) {
    return res.status(400).json({ ok: false, error: 'pageTitle and content are required' });
  }

  try {
    const client = createWikiClient(credentials);
    const result = await editPage(client, pageTitle, content, { section, summary });
    return res.status(result.ok ? 200 : 502).json(result);
  } catch (err) {
    console.error('Wiki publish error:', err);
    return res.status(500).json({ ok: false, error: err.message });
  }
}
