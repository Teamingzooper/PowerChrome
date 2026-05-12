const storage = require('../../lib/storage');
const { withCors, readBody, json, sanitizeString, publicProfile } = require('../../lib/util');
const { requireAuth } = require('../../lib/auth');

module.exports = withCors(async function (req, res) {
  if (req.method !== 'POST') return json(res, 405, { ok: false, error: 'method-not-allowed' });
  const body = await readBody(req);
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

  json(res, 200, { ok: true, account: publicProfile(account) });
});
