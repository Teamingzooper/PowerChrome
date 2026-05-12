const storage = require('../../lib/storage');
const { withCors, json, normalizeCode, publicProfile } = require('../../lib/util');

/* Public — no auth. Used both by the in-extension stats page (when looking
 * at a friend's full profile) and by the standalone /u/CODE share page.
 *
 * Accepts the friend code either via JSON body { code } or a ?code= query.
 */
module.exports = withCors(async function (req, res) {
  let raw = '';
  if (req.method === 'GET') {
    const url = new URL(req.url, 'https://x');
    raw = url.searchParams.get('code') || '';
  } else if (req.method === 'POST') {
    let buf = '';
    await new Promise(function (r) {
      req.on('data', function (c) { buf += c; });
      req.on('end', r);
      req.on('error', r);
    });
    try {
      const parsed = buf ? JSON.parse(buf) : {};
      raw = parsed.code || '';
    } catch (e) { /* ignore */ }
  } else {
    return json(res, 405, { ok: false, error: 'method-not-allowed' });
  }

  const code = normalizeCode(raw);
  if (code.length !== 8) return json(res, 400, { ok: false, error: 'invalid-code' });

  const account = await storage.get('account:' + code);
  if (!account) return json(res, 404, { ok: false, error: 'not-found' });

  const profile = publicProfile(account);
  // Also return the most recent events for the profile activity feed.
  const events = (await storage.get('events:' + code)) || [];
  json(res, 200, {
    ok: true,
    profile: profile,
    createdAt: account.createdAt || null,
    recentEvents: events.slice(0, 10)
  });
});
