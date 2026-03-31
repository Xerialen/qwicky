/**
 * Admin API authentication middleware.
 *
 * Validates the Authorization header using one of two mechanisms:
 *   1. Supabase session JWT  — for browser callers (DivisionResults, wikiPublisher)
 *   2. ADMIN_API_KEY fallback — for server-to-server callers (Discord bot)
 *
 * Returns true if the request is authorised; writes a 401/500 response and
 * returns false otherwise.
 *
 * Usage:
 *   if (!await requireAdminAuth(req, res)) return;
 *
 * Callers must also include 'Authorization' in Access-Control-Allow-Headers
 * so browser preflight requests succeed.
 */
import { createClient } from '@supabase/supabase-js';

export async function requireAdminAuth(req, res) {
  const authHeader = req.headers['authorization'] || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : authHeader;

  if (!token) {
    res.status(401).json({ error: 'Unauthorized' });
    return false;
  }

  // 1. Try Supabase JWT (browser callers with an active session)
  const supabaseUrl = process.env.QWICKY_SUPABASE_URL;
  const serviceKey = process.env.QWICKY_SUPABASE_SERVICE_KEY;
  if (supabaseUrl && serviceKey) {
    const supabase = createClient(supabaseUrl, serviceKey);
    const { data: { user }, error } = await supabase.auth.getUser(token);
    if (!error && user) return true;
  }

  // 2. Accept QWICKY_SUPABASE_SERVICE_KEY for internal Vercel server-to-server calls
  if (serviceKey && token === serviceKey) return true;

  // 3. Fall back to static ADMIN_API_KEY (Discord bot server-to-server calls via Fly.io)
  const adminKey = process.env.ADMIN_API_KEY;
  if (adminKey && token === adminKey) return true;

  res.status(401).json({ error: 'Unauthorized' });
  return false;
}
