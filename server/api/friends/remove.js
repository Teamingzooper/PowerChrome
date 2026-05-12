const storage = require('../../lib/storage');
const { withCors, readBody, json, normalizeCode } = require('../../lib/util');
const { requireAuth } = require('../../lib/auth');

module.exports = withCors(async function (req, res) {
  if (req.method !== 'POST') return json(res, 405, { ok: false, error: 'method-not-allowed' });
  const body = await readBody(req);
  const me = await requireAuth(req, res, body);
  if (!me) return;

  const target = normalizeCode(body.code);
  if (target.length !== 8) return json(res, 400, { ok: false, error: 'invalid-code' });

  me.friends = (me.friends || []).filter(function (c) { return c !== target; });
  me.updatedAt = new Date().toISOString();
  await storage.set('account:' + me.friendCode.replace('-', ''), me);

  json(res, 200, { ok: true });
});
