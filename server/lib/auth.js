const storage = require('./storage');
const { json } = require('./util');

async function requireAuth(req, res, body) {
  const token = body && body.token;
  if (!token || typeof token !== 'string' || token.length < 16) {
    json(res, 401, { ok: false, error: 'missing-token' });
    return null;
  }
  const code = await storage.get('token:' + token);
  if (!code) {
    json(res, 401, { ok: false, error: 'invalid-token' });
    return null;
  }
  const account = await storage.get('account:' + code);
  if (!account || account.token !== token) {
    json(res, 401, { ok: false, error: 'invalid-token' });
    return null;
  }
  return account;
}

module.exports = { requireAuth };
