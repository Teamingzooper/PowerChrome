const storage = require('../../lib/storage');
const {
  withCors, readBody, json,
  generateFriendCode, generateToken, sanitizeString,
  publicProfile
} = require('../../lib/util');
const { requireAuth } = require('../../lib/auth');

async function opInit(req, res, body) {
  const username = sanitizeString(body.username, 24) || 'player';
  const avatar = sanitizeString(body.avatar, 8) || '⚡';

  let friendCode = null;
  for (let i = 0; i < 4; i++) {
    const candidate = generateFriendCode();
    const existing = await storage.get('account:' + candidate.replace('-', ''));
    if (!existing) { friendCode = candidate; break; }
  }
  if (!friendCode) friendCode = generateFriendCode();

  const token = generateToken();
  const codeKey = friendCode.replace('-', '');
  const now = new Date().toISOString();
  const account = {
    friendCode: friendCode,
    token: token,
    username: username,
    avatar: avatar,
    createdAt: now,
    updatedAt: now,
    highestCombo: 0,
    totalChars: 0,
    totalDeletes: 0,
    totalEnters: 0,
    friends: []
  };
  await storage.set('account:' + codeKey, account);
  await storage.set('token:' + token, codeKey);

  return json(res, 200, {
    ok: true,
    friendCode: friendCode,
    token: token,
    account: { code: friendCode, username: username, avatar: avatar }
  });
}

async function opGet(req, res, body) {
  const account = await requireAuth(req, res, body);
  if (!account) return;
  return json(res, 200, {
    ok: true,
    account: publicProfile(account),
    friends: account.friends || []
  });
}

async function opUpdate(req, res, body) {
  const account = await requireAuth(req, res, body);
  if (!account) return;
  if (typeof body.username === 'string') {
    account.username = sanitizeString(body.username, 24);
  }
  if (typeof body.avatar === 'string') {
    account.avatar = sanitizeString(body.avatar, 8) || '⚡';
  }
  account.updatedAt = new Date().toISOString();
  await storage.set('account:' + account.friendCode.replace('-', ''), account);
  return json(res, 200, { ok: true, account: publicProfile(account) });
}

module.exports = withCors(async function (req, res) {
  if (req.method !== 'POST') return json(res, 405, { ok: false, error: 'method-not-allowed' });
  const body = await readBody(req);
  const op = req.query && req.query.op;
  if (op === 'init')   return opInit(req, res, body);
  if (op === 'get')    return opGet(req, res, body);
  if (op === 'update') return opUpdate(req, res, body);
  return json(res, 404, { ok: false, error: 'unknown-op', detail: 'op=' + op });
});
