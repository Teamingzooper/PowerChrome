const storage = require('../../lib/storage');
const { withCors, readBody, json, normalizeCode, publicProfile } = require('../../lib/util');
const { requireAuth } = require('../../lib/auth');

async function opAdd(req, res, body) {
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
  return json(res, 200, { ok: true, friend: publicProfile(friend) });
}

async function opRemove(req, res, body) {
  const me = await requireAuth(req, res, body);
  if (!me) return;
  const target = normalizeCode(body.code);
  if (target.length !== 8) return json(res, 400, { ok: false, error: 'invalid-code' });
  me.friends = (me.friends || []).filter(function (c) { return c !== target; });
  me.updatedAt = new Date().toISOString();
  await storage.set('account:' + me.friendCode.replace('-', ''), me);
  return json(res, 200, { ok: true });
}

async function opList(req, res, body) {
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
  return json(res, 200, { ok: true, friends: out });
}

module.exports = withCors(async function (req, res) {
  if (req.method !== 'POST') return json(res, 405, { ok: false, error: 'method-not-allowed' });
  const body = await readBody(req);
  const op = req.query && req.query.op;
  if (op === 'add')    return opAdd(req, res, body);
  if (op === 'remove') return opRemove(req, res, body);
  if (op === 'list')   return opList(req, res, body);
  return json(res, 404, { ok: false, error: 'unknown-op', detail: 'op=' + op });
});
