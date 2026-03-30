/**
 * Admin API authentication middleware.
 *
 * Validates the Authorization header against the ADMIN_API_KEY environment
 * variable. Returns true if the request is authorised; writes a 401 response
 * and returns false if not.
 *
 * Usage:
 *   if (!requireAdminAuth(req, res)) return;
 *
 * Callers must also include 'Authorization' in Access-Control-Allow-Headers
 * so browser preflight requests succeed.
 */
export function requireAdminAuth(req, res) {
  const expectedKey = process.env.ADMIN_API_KEY;
  if (!expectedKey) {
    // Misconfigured server — fail closed
    res.status(500).json({ error: 'Server auth not configured' });
    return false;
  }

  const authHeader = req.headers['authorization'] || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : authHeader;

  if (!token || token !== expectedKey) {
    res.status(401).json({ error: 'Unauthorized' });
    return false;
  }

  return true;
}
