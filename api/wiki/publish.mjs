// api/wiki/publish.mjs
// Vercel serverless function for publishing MediaWiki markup via the MediaWiki API.
// Uses pure HTTP (no Playwright) — suitable for serverless environments.
//
// POST /api/wiki/publish
// Body: { pageTitle, content, section?, summary?, credentials? }
//
// Credentials come from either:
//   1. Request body: credentials: { username, password, apiUrl }
//   2. Environment variables: WIKI_BOT_USERNAME, WIKI_BOT_PASSWORD, WIKI_API_URL

export default async function handler(req, res) {
  // Only allow POST
  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  }

  const { pageTitle, content, section, summary, credentials } = req.body || {};

  if (!pageTitle || !content) {
    return res.status(400).json({ ok: false, error: 'pageTitle and content are required' });
  }

  // Resolve credentials: request body > env vars
  const username = credentials?.username || process.env.WIKI_BOT_USERNAME;
  const password = credentials?.password || process.env.WIKI_BOT_PASSWORD;
  const apiUrl = credentials?.apiUrl || process.env.WIKI_API_URL;

  if (!username || !password || !apiUrl) {
    return res.status(400).json({
      ok: false,
      error: 'Wiki credentials not configured. Set WIKI_BOT_USERNAME, WIKI_BOT_PASSWORD, and WIKI_API_URL environment variables, or pass credentials in the request body.',
    });
  }

  const editSummary = summary || 'Updated via QWICKY';

  try {
    const result = await publishToWiki({ apiUrl, username, password, pageTitle, content, section, editSummary });
    if (result.ok) {
      return res.status(200).json({ ok: true, pageUrl: result.pageUrl });
    } else {
      return res.status(502).json({ ok: false, error: result.error });
    }
  } catch (err) {
    console.error('Wiki publish error:', err);
    return res.status(500).json({ ok: false, error: `Server error: ${err.message}` });
  }
}

// ---------------------------------------------------------------------------
// MediaWiki API client (self-contained, no external dependencies)
// ---------------------------------------------------------------------------

async function publishToWiki({ apiUrl, username, password, pageTitle, content, section, editSummary }) {
  // Simple cookie jar
  const cookies = {};

  function parseCookies(response) {
    const raw = response.headers.get('set-cookie') || '';
    // Multiple set-cookie headers get joined with comma by some runtimes;
    // split on comma that is NOT inside an expires date
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
    return Object.entries(cookies)
      .map(([k, v]) => `${k}=${v}`)
      .join('; ');
  }

  async function apiPost(params) {
    const body = new URLSearchParams(params);
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': 'QWICKYBot/1.0 (QuakeWorld tournament admin tool; vercel serverless)',
        Cookie: cookieHeader(),
      },
      body,
    });
    parseCookies(response);
    return response.json();
  }

  // Step 1: Get login token
  const tokenData = await apiPost({
    action: 'query',
    meta: 'tokens',
    type: 'login',
    format: 'json',
  });
  const loginToken = tokenData?.query?.tokens?.logintoken;
  if (!loginToken) {
    return { ok: false, error: 'Failed to obtain login token from wiki API' };
  }

  // Step 2: Login
  const loginResult = await apiPost({
    action: 'login',
    lgname: username,
    lgpassword: password,
    lgtoken: loginToken,
    format: 'json',
  });
  if (loginResult?.login?.result !== 'Success') {
    return {
      ok: false,
      error: `Wiki login failed: ${loginResult?.login?.result || 'unknown'} — ${loginResult?.login?.reason || ''}`,
    };
  }

  // Step 3: Get CSRF token
  const csrfData = await apiPost({
    action: 'query',
    meta: 'tokens',
    format: 'json',
  });
  const csrfToken = csrfData?.query?.tokens?.csrftoken;
  if (!csrfToken) {
    return { ok: false, error: 'Failed to obtain CSRF token' };
  }

  // Step 4: Edit page
  const editParams = {
    action: 'edit',
    title: pageTitle,
    text: content,
    summary: editSummary,
    token: csrfToken,
    bot: '1',
    format: 'json',
  };
  if (section !== undefined && section !== null && section !== '') {
    editParams.section = String(section);
  }

  const editResult = await apiPost(editParams);

  if (editResult?.edit?.result === 'Success') {
    const baseUrl = apiUrl.replace(/\/api\.php$/, '');
    const pageUrl = `${baseUrl}/${encodeURIComponent(pageTitle).replace(/%2F/g, '/')}`;
    return { ok: true, pageUrl };
  }

  return {
    ok: false,
    error: `Edit failed: ${JSON.stringify(editResult?.edit || editResult?.error || editResult)}`,
  };
}
