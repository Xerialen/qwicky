// api/wiki/publish-section.mjs
// Publish wiki content to a specific section (by heading name) or replace
// the page body while preserving boilerplate (navbox/infobox/tabs).
//
// POST /api/wiki/publish-section
// Body: { pageName, sectionHeading?, content, summary? }
//
// If sectionHeading is provided: finds section by heading name, edits that section.
// If sectionHeading is null/empty: replaces page body after boilerplate.

import {
  createWikiClient, editPage, findSectionByHeading,
  getPageContent, findBoilerplateBoundary,
} from './_wikiClient.mjs';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  }

  const { pageName, sectionHeading, content, summary } = req.body || {};

  if (!pageName || !content) {
    return res.status(400).json({ ok: false, error: 'pageName and content are required' });
  }

  try {
    const client = createWikiClient();

    if (sectionHeading) {
      // ── Section-based publish: find section by heading name ──────────
      const sectionIndex = await findSectionByHeading(client, pageName, sectionHeading);

      if (sectionIndex === null) {
        // Section not found — return available sections for debugging
        const { getSections } = await import('./_wikiClient.mjs');
        const { sections } = await getSections(client, pageName);
        return res.status(404).json({
          ok: false,
          error: `Section "${sectionHeading}" not found on page "${pageName}"`,
          availableSections: sections.map(s => s.heading),
        });
      }

      const editSummary = summary || `Updated ${sectionHeading} via QWICKY`;
      const result = await editPage(client, pageName, content, {
        section: sectionIndex,
        summary: editSummary,
      });
      return res.status(result.ok ? 200 : 502).json(result);

    } else {
      // ── Full-page body publish: preserve boilerplate ────────────────
      const page = await getPageContent(client, pageName);

      if (!page.exists) {
        // Page doesn't exist — create it with content only
        const result = await editPage(client, pageName, content, {
          summary: summary || 'Created via QWICKY',
        });
        return res.status(result.ok ? 200 : 502).json(result);
      }

      // Find where boilerplate ends and body begins
      const boundary = findBoilerplateBoundary(page.content);
      const boilerplate = page.content.slice(0, boundary).trimEnd();

      // Replace body content, keep boilerplate header
      const newContent = boilerplate + '\n' + content;

      const result = await editPage(client, pageName, newContent, {
        summary: summary || 'Updated via QWICKY',
      });
      return res.status(result.ok ? 200 : 502).json(result);
    }
  } catch (err) {
    console.error('Wiki publish-section error:', err);
    return res.status(500).json({ ok: false, error: err.message });
  }
}
