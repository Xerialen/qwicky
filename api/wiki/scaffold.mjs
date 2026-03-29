// api/wiki/scaffold.mjs
// Batch-creates tournament wiki pages with proper boilerplate.
// Called by the Wiki Setup Wizard after the admin confirms page structure.
//
// POST /api/wiki/scaffold
// Body: {
//   pages: [{ title, tabIndex, contentBody }],
//   boilerplate: { navbox, infobox: {...}, tabs: [{name, link}] },
//   skipExisting: true,
//   summary: "Created via QWICKY"
// }

import { createWikiClient, editPage, getPageContent } from './_wikiClient.mjs';
import { assembleBoilerplate } from './_boilerplate.mjs';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });

  const { pages, boilerplate, skipExisting = true, summary = 'Created via QWICKY' } = req.body || {};

  if (!pages?.length || !boilerplate) {
    return res.status(400).json({ error: 'pages and boilerplate are required' });
  }

  if (!boilerplate.tabs?.length) {
    return res.status(400).json({ error: 'boilerplate.tabs must be a non-empty array' });
  }

  let client;
  try {
    client = createWikiClient();
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }

  const created = [];
  const skipped = [];
  const errors = [];

  for (const page of pages) {
    const { title, contentBody = '{{Abbr/TBD}}' } = page;

    if (!title) {
      errors.push({ title: '(empty)', error: 'Missing page title' });
      continue;
    }

    try {
      // Check if page exists
      if (skipExisting) {
        const existing = await getPageContent(client, title);
        if (existing.exists) {
          skipped.push({ title, reason: 'already exists' });
          continue;
        }
      }

      // Assemble full page content: boilerplate + content body
      const boilerplateText = assembleBoilerplate(boilerplate, title);
      const fullContent = boilerplateText + '\n\n' + contentBody;

      // Create the page
      const result = await editPage(client, title, fullContent, {
        summary: `${summary} — ${title.split('/').pop()}`,
      });

      if (result.ok) {
        created.push({ title, pageUrl: result.pageUrl });
      } else {
        errors.push({ title, error: result.error || 'Edit failed' });
      }
    } catch (err) {
      errors.push({ title, error: err.message });
    }
  }

  return res.json({
    ok: errors.length === 0,
    created,
    skipped,
    errors,
    total: { created: created.length, skipped: skipped.length, errors: errors.length },
  });
}
