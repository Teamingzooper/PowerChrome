const storage = require('../../lib/storage');
const { withCors, readBody, json, publicProfile, formatCode } = require('../../lib/util');
const { requireAuth } = require('../../lib/auth');

module.exports = withCors(async function (req, res) {
  if (req.method !== 'POST') return json(res, 405, { ok: false, error: 'method-not-allowed' });
  const body = await readBody(req);
  const me = await requireAuth(req, res, body);
  if (!me) return;

  const codes = (me.friends || []).slice(0, 100);
  if (codes.length === 0) return json(res, 200, { ok: true, friends: [] });

  const keys = codes.map(function (c) { return 'account:' + c; });
  const accounts = await storage.mget(keys);
  const out = [];
  for (let i = 0; i < accounts.length; i++) {
    const a = accounts[i];
    if (!a) continue;
    out.push(publicProfile(a));
  }
  json(res, 200, { ok: true, friends: out });
});
