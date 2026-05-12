const storage = require('../../lib/storage');
const { withCors, readBody, json } = require('../../lib/util');
const { requireAuth } = require('../../lib/auth');

function num(v) { return typeof v === 'number' && isFinite(v) && v >= 0 ? Math.floor(v) : 0; }

module.exports = withCors(async function (req, res) {
  if (req.method !== 'POST') return json(res, 405, { ok: false, error: 'method-not-allowed' });
  const body = await readBody(req);
  const account = await requireAuth(req, res, body);
  if (!account) return;

  // Stats are monotonic — server keeps the max so a bad client can't lower them.
  const incomingCombo = num(body.highestCombo);
  const incomingChars = num(body.totalChars);
  const incomingDeletes = num(body.totalDeletes);
  const incomingEnters = num(body.totalEnters);

  let changed = false;
  if (incomingCombo > (account.highestCombo || 0)) { account.highestCombo = incomingCombo; changed = true; }
  if (incomingChars > (account.totalChars || 0)) { account.totalChars = incomingChars; changed = true; }
  if (incomingDeletes > (account.totalDeletes || 0)) { account.totalDeletes = incomingDeletes; changed = true; }
  if (incomingEnters > (account.totalEnters || 0)) { account.totalEnters = incomingEnters; changed = true; }

  if (changed) {
    account.updatedAt = new Date().toISOString();
    const codeKey = account.friendCode.replace('-', '');
    await storage.set('account:' + codeKey, account);
    // Mirror into sorted sets so global leaderboards are O(log N) reads.
    await storage.zadd('lb:combo', account.highestCombo, codeKey);
    await storage.zadd('lb:chars', account.totalChars, codeKey);
  }

  json(res, 200, {
    ok: true,
    highestCombo: account.highestCombo,
    totalChars: account.totalChars,
    totalDeletes: account.totalDeletes,
    totalEnters: account.totalEnters
  });
});
