const { withCors, readBody, json, publicProfile } = require('../../lib/util');
const { requireAuth } = require('../../lib/auth');

module.exports = withCors(async function (req, res) {
  if (req.method !== 'POST') return json(res, 405, { ok: false, error: 'method-not-allowed' });
  const body = await readBody(req);
  const account = await requireAuth(req, res, body);
  if (!account) return;
  json(res, 200, { ok: true, account: publicProfile(account), friends: account.friends || [] });
});
