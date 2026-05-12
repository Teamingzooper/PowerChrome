const storage = require('../../lib/storage');
const { withCors, readBody, json, normalizeCode, formatCode, publicProfile } = require('../../lib/util');
const { requireAuth } = require('../../lib/auth');

module.exports = withCors(async function (req, res) {
  if (req.method !== 'POST') return json(res, 405, { ok: false, error: 'method-not-allowed' });
  const body = await readBody(req);
  const me = await requireAuth(req, res, body);
  if (!me) return;

  const target = normalizeCode(body.code);
  if (target.length !== 8) return json(res, 400, { ok: false, error: 'invalid-code' });
  const myCode = me.friendCode.replace('-', '');
  if (target === myCode) return json(res, 400, { ok: false, error: 'cannot-add-self' });

  const friend = await storage.get('account:' + target);
  if (!friend) return json(res, 404, { ok: false, error: 'unknown-code' });

  me.friends = me.friends || [];
  if (me.friends.indexOf(target) >= 0) {
    return json(res, 200, { ok: true, friend: publicProfile(friend), alreadyAdded: true });
  }
  me.friends.push(target);
  me.updatedAt = new Date().toISOString();
  await storage.set('account:' + myCode, me);

  json(res, 200, { ok: true, friend: publicProfile(friend) });
});
