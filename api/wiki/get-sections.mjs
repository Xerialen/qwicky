// api/wiki/get-sections.mjs
// Get the section structure of a wiki page.
//
// GET /api/wiki/get-sections?page=The_Big_4/Season_2/Division_1

import { createWikiClient, getSections } from './_wikiClient.mjs';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  }

  const { page } = req.query || {};
  if (!page) {
    return res.status(400).json({ ok: false, error: 'page parameter required' });
  }

  try {
    const client = createWikiClient();
    const result = await getSections(client, page);
    return res.status(200).json(result);
  } catch (err) {
    return res.status(500).json({ ok: false, error: err.message });
  }
}
