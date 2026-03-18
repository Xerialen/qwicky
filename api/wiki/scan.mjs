// api/wiki/scan.mjs
// Search and scan QWiki pages for connecting QWICKY to existing tournament pages.
//
// GET /api/wiki/scan?q=big+4+season+2       — fuzzy search, returns grouped results
// GET /api/wiki/scan?prefix=The_Big_4/Season_2  — deep scan of specific tournament

import {
  createWikiClient, searchPages, listPages,
  getSections, getPageContent, findBoilerplateBoundary,
} from './_wikiClient.mjs';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  }

  const { q, prefix } = req.query || {};

  if (!q && !prefix) {
    return res.status(400).json({ ok: false, error: 'Provide ?q=search+terms or ?prefix=Page_Prefix' });
  }

  try {
    const client = createWikiClient();

    if (q && !prefix) {
      // ── Fuzzy search mode ──────────────────────────────────────────
      const results = await searchPages(client, q, 30);

      // Group by root page (longest common prefix up to first /)
      const groups = new Map();
      for (const title of results) {
        // Find root: "The Big 4/Season 2/Division 1" → "The Big 4/Season 2"
        const parts = title.split('/');
        // Try 2-level root first, then 1-level
        const root2 = parts.length >= 2 ? parts.slice(0, 2).join('/') : parts[0];
        const root1 = parts[0];
        const root = results.some(t => t.startsWith(root2 + '/') && t !== root2) ? root2 : root1;

        if (!groups.has(root)) groups.set(root, []);
        groups.get(root).push(title);
      }

      const tournaments = [...groups.entries()].map(([root, pages]) => ({
        root,
        pages: [...new Set(pages)].sort(),
        matchCount: pages.length,
      }));

      return res.status(200).json({ ok: true, tournaments });
    }

    // ── Deep scan mode (prefix) ──────────────────────────────────────
    const pageNames = await listPages(client, prefix);

    const pages = [];
    for (const title of pageNames) {
      const [sectionsResult, contentResult] = await Promise.all([
        getSections(client, title),
        getPageContent(client, title),
      ]);

      const pageInfo = {
        title,
        exists: contentResult.exists,
        sections: sectionsResult.sections || [],
        hasContent: false,
        boilerplate: null,
        bodyPreview: '',
      };

      if (contentResult.exists && contentResult.content) {
        const content = contentResult.content;
        const boundary = findBoilerplateBoundary(content);
        const boilerplateText = content.slice(0, boundary);
        const body = content.slice(boundary).trim();

        pageInfo.hasContent = body.length > 0 && !body.startsWith('{{Abbr/TBD}}');
        pageInfo.bodyPreview = body.slice(0, 200);

        // Parse boilerplate for navbox and tabs info
        const navboxMatch = boilerplateText.match(/\{\{(\w[\w\s]*?Navbox|[A-Z]+\s*navbox)\}\}/i);
        const tabsMatch = boilerplateText.match(/\{\{Tabs static[\s\S]*?\|This=(\d+)/);
        const infoboxMatch = boilerplateText.match(/\{\{Infobox\s+(league|lan)/i);

        pageInfo.boilerplate = {
          navbox: navboxMatch ? navboxMatch[1] : null,
          tabIndex: tabsMatch ? parseInt(tabsMatch[1]) : null,
          infoboxType: infoboxMatch ? infoboxMatch[1] : null,
        };
      }

      pages.push(pageInfo);
    }

    // Detect layout pattern
    const hasPlayoffsPage = pages.some(p => p.title.toLowerCase().includes('playoff'));
    const hasDivisionPages = pages.some(p => /division|div\s?\d/i.test(p.title));
    const suggestedLayout = hasPlayoffsPage && hasDivisionPages ? 'multi-page' : 'single-page';

    return res.status(200).json({
      ok: true,
      prefix,
      pages,
      suggestedLayout,
      pageCount: pages.length,
    });

  } catch (err) {
    console.error('Wiki scan error:', err);
    return res.status(500).json({ ok: false, error: err.message });
  }
}
