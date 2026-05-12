const storage = require('../../lib/storage');
const { withCors, readBody, json, generateFriendCode, generateToken, sanitizeString } = require('../../lib/util');

module.exports = withCors(async function (req, res) {
  if (req.method !== 'POST') return json(res, 405, { ok: false, error: 'method-not-allowed' });
  const body = await readBody(req);
  const username = sanitizeString(body.username, 24) || 'player';
  const avatar = sanitizeString(body.avatar, 8) || '⚡';

  // Try a few times in case of (extremely unlikely) friend-code collision.
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

  json(res, 200, { ok: true, friendCode: friendCode, token: token, account: { code: friendCode, username, avatar } });
});
