// api/wiki/_wikiClient.mjs
// Shared MediaWiki API client used by all wiki endpoints.
// Handles login, CSRF tokens, page editing, section querying, and content fetching.

/**
 * Create a wiki client session with credentials from env vars.
 * Returns an object with methods for interacting with the MediaWiki API.
 */
export function createWikiClient(credentialsOverride) {
  const username = credentialsOverride?.username || process.env.WIKI_BOT_USERNAME;
  const password = credentialsOverride?.password || process.env.WIKI_BOT_PASSWORD;
  const apiUrl = credentialsOverride?.apiUrl || process.env.WIKI_API_URL;

  if (!username || !password || !apiUrl) {
    throw new Error('Wiki credentials not configured. Set WIKI_BOT_USERNAME, WIKI_BOT_PASSWORD, and WIKI_API_URL.');
  }

  // Simple cookie jar persisted across requests in this session
  const cookies = {};

  function parseCookies(response) {
    const raw = response.headers.get('set-cookie') || '';
    const parts = raw.split(/,(?=\s*\w+=)/);
    for (const part of parts) {
      const [pair] = part.split(';');
      if (!pair) continue;
      const eqIdx = pair.indexOf('=');
      if (eqIdx === -1) continue;
      const name = pair.slice(0, eqIdx).trim();
      const value = pair.slice(eqIdx + 1).trim();
      if (name) cookies[name] = value;
    }
  }

  function cookieHeader() {
    return Object.entries(cookies).map(([k, v]) => `${k}=${v}`).join('; ');
  }

  async function apiPost(params) {
    const body = new URLSearchParams(params);
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': 'QWICKYBot/1.0 (QuakeWorld tournament admin; vercel serverless)',
        Cookie: cookieHeader(),
      },
      body,
    });
    parseCookies(response);
    return response.json();
  }

  async function apiGet(params) {
    const qs = new URLSearchParams(params).toString();
    const response = await fetch(`${apiUrl}?${qs}`, {
      headers: {
        'User-Agent': 'QWICKYBot/1.0',
        Cookie: cookieHeader(),
      },
    });
    parseCookies(response);
    return response.json();
  }

  let loggedIn = false;

  async function ensureLoggedIn() {
    if (loggedIn) return;

    // Step 1: Get login token
    const tokenData = await apiPost({ action: 'query', meta: 'tokens', type: 'login', format: 'json' });
    const loginToken = tokenData?.query?.tokens?.logintoken;
    if (!loginToken) throw new Error('Failed to obtain login token from wiki API');

    // Step 2: Login
    const loginResult = await apiPost({
      action: 'login', lgname: username, lgpassword: password, lgtoken: loginToken, format: 'json',
    });
    if (loginResult?.login?.result !== 'Success') {
      throw new Error(`Wiki login failed: ${loginResult?.login?.result || 'unknown'} — ${loginResult?.login?.reason || ''}`);
    }

    loggedIn = true;
  }

  async function getCsrfToken() {
    await ensureLoggedIn();
    const csrfData = await apiPost({ action: 'query', meta: 'tokens', format: 'json' });
    const token = csrfData?.query?.tokens?.csrftoken;
    if (!token) throw new Error('Failed to obtain CSRF token');
    return token;
  }

  return { apiUrl, apiPost, apiGet, ensureLoggedIn, getCsrfToken };
}

/**
 * Edit a wiki page (or a section of it).
 * @param {object} client - from createWikiClient()
 * @param {string} pageTitle - Wiki page name
 * @param {string} content - Wikitext content
 * @param {object} [opts]
 * @param {string|number} [opts.section] - Section number (omit for full page)
 * @param {string} [opts.summary] - Edit summary
 */
export async function editPage(client, pageTitle, content, opts = {}) {
  const csrfToken = await client.getCsrfToken();

  const editParams = {
    action: 'edit',
    title: pageTitle,
    text: content,
    summary: opts.summary || 'Updated via QWICKY',
    token: csrfToken,
    bot: '1',
    format: 'json',
  };
  if (opts.section !== undefined && opts.section !== null && opts.section !== '') {
    editParams.section = String(opts.section);
  }

  const result = await client.apiPost(editParams);

  if (result?.edit?.result === 'Success') {
    const baseUrl = client.apiUrl.replace(/\/api\.php$/i, '').replace(/\/w$/, '/wiki');
    const pageUrl = `${baseUrl}/${encodeURIComponent(pageTitle).replace(/%2F/g, '/')}`;
    return { ok: true, pageUrl };
  }

  return { ok: false, error: `Edit failed: ${JSON.stringify(result?.edit || result?.error || result)}` };
}

/**
 * Get sections of a wiki page.
 * @returns {{ sections: Array<{ index: string, heading: string, level: string }> }}
 */
export async function getSections(client, pageTitle) {
  const data = await client.apiGet({
    action: 'parse', page: pageTitle, prop: 'sections', format: 'json',
  });

  if (data?.error) {
    return { ok: false, error: data.error.info || 'Page not found', sections: [] };
  }

  const sections = (data?.parse?.sections || []).map(s => ({
    index: s.index,
    heading: s.line,
    level: s.level,
  }));

  return { ok: true, sections };
}

/**
 * Get the raw wikitext content of a page.
 */
export async function getPageContent(client, pageTitle) {
  const data = await client.apiGet({
    action: 'query', titles: pageTitle, prop: 'revisions', rvprop: 'content', rvslots: 'main', format: 'json',
  });

  const pages = data?.query?.pages || {};
  for (const [pid, page] of Object.entries(pages)) {
    if (pid === '-1') return { ok: false, exists: false, content: '' };
    const revs = page.revisions || [];
    if (revs.length) {
      const content = revs[0]?.slots?.main?.['*'] || revs[0]?.['*'] || '';
      return { ok: true, exists: true, content };
    }
  }

  return { ok: false, exists: false, content: '' };
}

/**
 * Search for pages matching a query (full-text search).
 */
export async function searchPages(client, query, limit = 30) {
  const data = await client.apiGet({
    action: 'query', list: 'search', srsearch: query, srlimit: String(limit), format: 'json',
  });

  return (data?.query?.search || []).map(r => r.title);
}

/**
 * List all pages with a given prefix.
 */
export async function listPages(client, prefix, limit = 50) {
  const data = await client.apiGet({
    action: 'query', list: 'allpages', apprefix: prefix, aplimit: String(limit), format: 'json',
  });

  return (data?.query?.allpages || []).map(p => p.title);
}

/**
 * Find section index by heading name (case-insensitive).
 * Returns the index string, or null if not found.
 */
export async function findSectionByHeading(client, pageTitle, heading) {
  const { sections } = await getSections(client, pageTitle);
  const target = heading.toLowerCase().trim();
  const match = sections.find(s => s.heading.toLowerCase().trim() === target);
  return match ? match.index : null;
}

/**
 * Extract {{Infobox league}} fields from wikitext with full support for:
 * - multi-line values
 * - nested templates in values (e.g., organizer={{player|Nas|flag=se}})
 * - pipe-escaped values
 * - HTML comments
 *
 * Walks balanced braces to find the closing }} of the Infobox.
 * Returns null if no {{Infobox league}} found or if brace walk fails.
 *
 * @param {string} wikitext
 * @returns {Object|null}
 */
export function extractInfobox(wikitext) {
  if (!wikitext) return null;
  // Strip HTML comments to simplify parsing
  const stripped = wikitext.replace(/<!--[\s\S]*?-->/g, '');

  const openRe = /\{\{\s*Infobox\s+league\s*\n?/i;
  const openMatch = stripped.match(openRe);
  if (!openMatch) return null;

  const startIdx = openMatch.index + openMatch[0].length;
  let depth = 1;
  let i = startIdx;
  while (i < stripped.length - 1) {
    const pair = stripped.slice(i, i + 2);
    if (pair === '{{') { depth++; i += 2; continue; }
    if (pair === '}}') {
      depth--;
      if (depth === 0) break;
      i += 2;
      continue;
    }
    i++;
  }
  if (depth !== 0) return null;

  const body = stripped.slice(startIdx, i);
  const fields = {};

  // Split on `|` at depth 0. Track both {{...}} and [[...]] depth so pipes
  // inside nested templates or wikitext links (e.g. [[Player:Nas|Nas]]) are
  // kept inside the current chunk.
  const chunks = [];
  let buf = '';
  let templateDepth = 0;
  let linkDepth = 0;
  for (let j = 0; j < body.length; j++) {
    const two = body.slice(j, j + 2);
    if (two === '{{') { templateDepth++; buf += two; j++; continue; }
    if (two === '}}') { templateDepth--; buf += two; j++; continue; }
    if (two === '[[') { linkDepth++; buf += two; j++; continue; }
    if (two === ']]') { linkDepth--; buf += two; j++; continue; }
    const ch = body[j];
    if (ch === '|' && templateDepth === 0 && linkDepth === 0) {
      chunks.push(buf);
      buf = '';
      continue;
    }
    buf += ch;
  }
  if (buf) chunks.push(buf);

  for (const chunk of chunks) {
    const eq = chunk.indexOf('=');
    if (eq === -1) continue;
    const key = chunk.slice(0, eq).trim();
    const value = chunk.slice(eq + 1).trim();
    if (key) fields[key] = value;
  }

  return Object.keys(fields).length > 0 ? fields : null;
}

/**
 * Extract division page names from a season overview's {{Tabs static}} template.
 * Returns tab names that start with "Division" (case-insensitive).
 *
 * @param {string} wikitext
 * @returns {string[]}
 */
export function extractDivisionNames(wikitext) {
  if (!wikitext) return [];
  const tabsMatch = wikitext.match(/\{\{\s*Tabs static\s*\n([\s\S]*?)\n\}\}/i);
  if (!tabsMatch) return [];
  const names = [];
  const re = /\|\s*name\d+\s*=\s*([^\n|]+)/g;
  let m;
  while ((m = re.exec(tabsMatch[1])) !== null) {
    const name = m[1].trim();
    if (/^Division\b/i.test(name)) names.push(name);
  }
  return names;
}

/**
 * Detect the boilerplate boundary in a page's content.
 * Returns the byte position where the body content starts (after navbox/infobox/tabs).
 */
export function findBoilerplateBoundary(content) {
  // Look for first content-bearing template or section heading after boilerplate
  const patterns = [
    /\{\{GroupTableStart/,       // Standings table
    /\{\{MatchList/,             // Match results
    /\{\{\d+[A-Z]+Bracket/,     // Bracket templates (4SEBracket, 16DEBracket, etc.)
    /\{\{PrizepoolSE/,          // Prize pool
    /\{\{Abbr\/TBD\}\}/,        // TBD placeholder
    /^==\s/m,                    // First section heading
  ];

  for (const pattern of patterns) {
    const match = content.match(pattern);
    if (match) return match.index;
  }

  // Fallback: after last }} of boilerplate templates
  let lastClose = 0;
  let depth = 0;
  for (let i = 0; i < content.length - 1; i++) {
    if (content[i] === '{' && content[i + 1] === '{') depth++;
    if (content[i] === '}' && content[i + 1] === '}') {
      depth--;
      if (depth === 0) lastClose = i + 2;
    }
  }

  return lastClose || 0;
}
