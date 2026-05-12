const storage = require('../../lib/storage');
const { withCors, readBody, json, publicProfile } = require('../../lib/util');
const { requireAuth } = require('../../lib/auth');

const EVENT_CAP = 30;
const FEED_LIMIT = 40;
const ALLOWED_TYPES = ['milestone', 'achievement', 'combo-high'];

function sanitizePayload(p) {
  if (!p || typeof p !== 'object') return {};
  const out = {};
  Object.keys(p).slice(0, 8).forEach(function (k) {
    const v = p[k];
    if (typeof v === 'string' && v.length <= 64) out[k] = v;
    else if (typeof v === 'number' && Number.isFinite(v)) out[k] = v;
  });
  return out;
}

async function opLog(req, res, body) {
  const account = await requireAuth(req, res, body);
  if (!account) return;
  const type = String(body.type || '');
  if (ALLOWED_TYPES.indexOf(type) < 0) return json(res, 400, { ok: false, error: 'invalid-type' });
  const codeKey = account.friendCode.replace('-', '');
  const events = (await storage.get('events:' + codeKey)) || [];
  const payload = sanitizePayload(body.payload || {});
  if ((type === 'milestone' || type === 'achievement') && payload.id) {
    const already = events.find(function (e) {
      return e.type === type && e.payload && e.payload.id === payload.id;
    });
    if (already) return json(res, 200, { ok: true, deduped: true });
  }
  events.unshift({ type: type, payload: payload, ts: new Date().toISOString() });
  while (events.length > EVENT_CAP) events.pop();
  await storage.set('events:' + codeKey, events);
  return json(res, 200, { ok: true });
}

async function opFeed(req, res, body) {
  const me = await requireAuth(req, res, body);
  if (!me) return;
  const codes = (me.friends || []).slice();
  if (!codes.length) return json(res, 200, { ok: true, events: [] });
  const accounts = (await storage.mget(codes.map(function (c) { return 'account:' + c; }))).filter(Boolean);
  const profileByCode = {};
  accounts.forEach(function (a) {
    profileByCode[a.friendCode.replace('-', '')] = publicProfile(a);
  });
  const eventLists = await storage.mget(codes.map(function (c) { return 'events:' + c; }));
  const merged = [];
  for (let i = 0; i < codes.length; i++) {
    const list = eventLists[i];
    if (!Array.isArray(list)) continue;
    const profile = profileByCode[codes[i]];
    if (!profile) continue;
    for (let j = 0; j < list.length; j++) {
      merged.push({ type: list[j].type, payload: list[j].payload, ts: list[j].ts, who: profile });
    }
  }
  merged.sort(function (a, b) { return new Date(b.ts).getTime() - new Date(a.ts).getTime(); });
  return json(res, 200, { ok: true, events: merged.slice(0, FEED_LIMIT) });
}

module.exports = withCors(async function (req, res) {
  if (req.method !== 'POST') return json(res, 405, { ok: false, error: 'method-not-allowed' });
  const body = await readBody(req);
  const op = req.query && req.query.op;
  if (op === 'log')  return opLog(req, res, body);
  if (op === 'feed') return opFeed(req, res, body);
  return json(res, 404, { ok: false, error: 'unknown-op', detail: 'op=' + op });
});
