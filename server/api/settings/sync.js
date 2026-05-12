const storage = require('../../lib/storage');
const { withCors, readBody, json } = require('../../lib/util');
const { requireAuth } = require('../../lib/auth');

const MAX_SETTINGS_BYTES = 8 * 1024; // sanity cap

function summarize(settings) {
  if (!settings || typeof settings !== 'object') return null;
  const out = {};
  Object.keys(settings).forEach(function (k) {
    if (k === 'token' || k === 'backendUrl' || k === 'backendKind') return;
    out[k] = settings[k];
  });
  return out;
}

module.exports = withCors(async function (req, res) {
  if (req.method !== 'POST') return json(res, 405, { ok: false, error: 'method-not-allowed' });
  const body = await readBody(req);
  const account = await requireAuth(req, res, body);
  if (!account) return;

  const op = body.op;
  const codeKey = account.friendCode.replace('-', '');

  if (op === 'pull') {
    const remote = await storage.get('settings:' + codeKey);
    if (!remote) return json(res, 200, { ok: true, settings: null });
    return json(res, 200, {
      ok: true,
      settings: remote.settings || null,
      updatedAt: remote.updatedAt || null,
      version: remote.version || 1
    });
  }

  if (op === 'push') {
    const settings = summarize(body.settings);
    if (!settings) return json(res, 400, { ok: false, error: 'invalid-settings' });
    const serialized = JSON.stringify(settings);
    if (serialized.length > MAX_SETTINGS_BYTES) {
      return json(res, 413, { ok: false, error: 'settings-too-large' });
    }
    const payload = {
      settings: settings,
      updatedAt: new Date().toISOString(),
      version: 1
    };
    await storage.set('settings:' + codeKey, payload);
    return json(res, 200, { ok: true, updatedAt: payload.updatedAt });
  }

  return json(res, 400, { ok: false, error: 'unknown-op' });
});
