/* Storage adapter for the PowerChrome backend.
 *
 * Production:  Vercel KV (Upstash Redis) via REST. Set env vars
 *              KV_REST_API_URL and KV_REST_API_TOKEN. The Vercel KV
 *              integration sets these automatically when a KV store
 *              is linked to the project. Auto-detected at boot.
 *
 * Fallback:    Plain in-process Map. State is not shared between
 *              function instances or preserved across cold starts —
 *              fine for smoke-testing the API, not for real users.
 *
 * Surface matches: get / set / del / mget / zadd / zrange.
 */

const KV_URL = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL || '';
const KV_TOKEN = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN || '';
const HAS_KV = !!(KV_URL && KV_TOKEN);

async function kvCmd(args) {
  const res = await fetch(KV_URL, {
    method: 'POST',
    headers: {
      Authorization: 'Bearer ' + KV_TOKEN,
      'content-type': 'application/json'
    },
    body: JSON.stringify(args)
  });
  if (!res.ok) {
    throw new Error('KV ' + args[0] + ' failed: ' + res.status + ' ' + (await res.text()).slice(0, 200));
  }
  const data = await res.json();
  if (data && data.error) throw new Error('KV error: ' + data.error);
  return data ? data.result : null;
}

/* ---- In-memory fallback ---- */
const mem = {
  kv: new Map(),
  zset: new Map() // name -> Map<member, score>
};

function memGet(key) { return mem.kv.has(key) ? mem.kv.get(key) : null; }
function memSet(key, value) { mem.kv.set(key, value); }
function memDel(key) { mem.kv.delete(key); }
function memMget(keys) { return keys.map(memGet); }
function memZadd(name, score, member) {
  if (!mem.zset.has(name)) mem.zset.set(name, new Map());
  mem.zset.get(name).set(member, score);
}
function memZrange(name, start, stop, rev) {
  const set = mem.zset.get(name);
  if (!set) return [];
  const entries = Array.from(set.entries()).map(function (e) { return { member: e[0], score: e[1] }; });
  entries.sort(function (a, b) { return rev ? b.score - a.score : a.score - b.score; });
  if (stop < 0) stop = entries.length + stop;
  return entries.slice(start, stop + 1);
}

/* ---- Public surface ---- */
async function get(key) {
  if (HAS_KV) {
    const raw = await kvCmd(['GET', key]);
    if (raw == null) return null;
    try { return JSON.parse(raw); } catch (e) { return raw; }
  }
  return memGet(key);
}

async function set(key, value) {
  if (HAS_KV) {
    const serialized = typeof value === 'string' ? value : JSON.stringify(value);
    await kvCmd(['SET', key, serialized]);
    return;
  }
  // Memory mode: store the live value as-is so primitives round-trip cleanly.
  memSet(key, value);
}

async function del(key) {
  if (HAS_KV) {
    await kvCmd(['DEL', key]);
    return;
  }
  memDel(key);
}

async function mget(keys) {
  if (!keys || !keys.length) return [];
  if (HAS_KV) {
    const raws = await kvCmd(['MGET', ...keys]);
    if (!Array.isArray(raws)) return [];
    return raws.map(function (r) {
      if (r == null) return null;
      try { return JSON.parse(r); } catch (e) { return r; }
    });
  }
  return memMget(keys);
}

async function zadd(name, score, member) {
  if (HAS_KV) {
    await kvCmd(['ZADD', name, String(score), member]);
    return;
  }
  memZadd(name, score, member);
}

async function zrange(name, start, stop, rev) {
  if (HAS_KV) {
    const cmd = ['ZRANGE', name, String(start), String(stop), 'WITHSCORES'];
    if (rev) cmd.splice(4, 0, 'REV');
    const raw = await kvCmd(cmd);
    if (!Array.isArray(raw)) return [];
    const out = [];
    for (let i = 0; i < raw.length; i += 2) {
      out.push({ member: raw[i], score: Number(raw[i + 1]) });
    }
    return out;
  }
  return memZrange(name, start, stop, !!rev);
}

function getBackendKind() {
  return HAS_KV ? 'kv' : 'memory';
}

module.exports = { get, set, del, mget, zadd, zrange, getBackendKind };
