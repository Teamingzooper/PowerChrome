# PowerChrome API

Serverless backend for the [PowerChrome](https://github.com/Teamingzooper/PowerChrome) Chrome extension. Handles accounts, friends, and leaderboards.

## Deploy

```bash
cd server
vercel deploy --prod
```

Or click the deploy button in Vercel after pointing it at this directory.

## Persistence (one-time setup)

Without storage, this API runs but state resets every cold start. To enable real persistence:

1. Open the deployed project in the Vercel dashboard.
2. **Storage** tab → **Connect Database** → **KV** (Upstash).
3. Vercel auto-injects `KV_REST_API_URL` and `KV_REST_API_TOKEN` into the runtime.
4. Redeploy (or wait for the next invocation — env vars are read at request time).

`GET /api/health` reports the active storage backend (`memory` or `kv`).

## Routes

| Method | Path | Auth | Description |
|---|---|---|---|
| GET  | `/api/health` | none | health + backend kind |
| POST | `/api/account/init` | none | `{ username, avatar }` → `{ friendCode, token }` |
| POST | `/api/account/get` | token | returns this user's profile + friend codes |
| POST | `/api/account/update` | token | update username / avatar |
| POST | `/api/stats/sync` | token | monotonic counters; server takes the max |
| POST | `/api/friends/add` | token | add by code |
| POST | `/api/friends/remove` | token | remove by code |
| POST | `/api/friends/list` | token | hydrate friend codes into profiles |
| POST | `/api/leaderboard` | token (friends) / optional (global) | `{ kind: 'combo' \| 'chars', scope: 'friends' \| 'global' }` |

Auth: include `token` in the JSON body. The token is the secret returned from `/api/account/init`. Don't share it.

## Data model

```
account:<friendCodeNoDash>  → { friendCode, token, username, avatar, highestCombo, totalChars, totalDeletes, totalEnters, friends: [...] }
token:<token>               → friendCodeNoDash
lb:combo                    → ZSET (member=friendCodeNoDash, score=highestCombo)
lb:chars                    → ZSET (member=friendCodeNoDash, score=totalChars)
```

All stats are write-max — clients can sync as often as they like, the server never lowers them.

## Local development

```bash
cd server
npm install -g vercel
vercel dev
```

Visit `http://localhost:3000/api/health`.
