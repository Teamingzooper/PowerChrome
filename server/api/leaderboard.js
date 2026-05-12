const storage = require('../lib/storage');
const { withCors, readBody, json, publicProfile } = require('../lib/util');
const { requireAuth } = require('../lib/auth');

module.exports = withCors(async function (req, res) {
  if (req.method !== 'POST') return json(res, 405, { ok: false, error: 'method-not-allowed' });
  const body = await readBody(req);
  const kind = body.kind === 'chars' ? 'chars' : 'combo';
  const scope = body.scope === 'global' ? 'global' : 'friends';
  const limit = Math.max(3, Math.min(50, parseInt(body.limit, 10) || 20));

  let codes = [];
  let me = null;
  if (scope === 'friends') {
    me = await requireAuth(req, res, body);
    if (!me) return;
    codes = (me.friends || []).slice();
    codes.push(me.friendCode.replace('-', ''));
  } else {
    // Global: top N by score from sorted set, then fetch accounts
    const zsetName = kind === 'chars' ? 'lb:chars' : 'lb:combo';
    const top = await storage.zrange(zsetName, 0, limit - 1, true);
    codes = top.map(function (t) { return t.member; });
    if (body.token) {
      const maybeMe = await storage.get('token:' + body.token);
      if (maybeMe) {
        const myAcc = await storage.get('account:' + maybeMe);
        if (myAcc) {
          me = myAcc;
          if (codes.indexOf(maybeMe) < 0) codes.push(maybeMe);
        }
      }
    }
  }

  if (codes.length === 0) return json(res, 200, { ok: true, rows: [] });

  const keys = codes.map(function (c) { return 'account:' + c; });
  const accounts = (await storage.mget(keys)).filter(Boolean);

  const field = kind === 'chars' ? 'totalChars' : 'highestCombo';
  accounts.sort(function (a, b) { return (b[field] || 0) - (a[field] || 0); });
  const rows = accounts.slice(0, limit).map(function (a) {
    const p = publicProfile(a);
    p.isMe = me && a.friendCode === me.friendCode;
    return p;
  });

  json(res, 200, { ok: true, rows: rows, kind: kind, scope: scope });
});
