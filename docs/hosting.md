# RacingShape — Hosting & Deployment

The complete reference for hosting RacingShape. Target platform: **Fly.io**. One
always-on machine serves the API and the built web bundle from a single origin, with a
persistent volume for the SQLite database. Runs **~$2–4/month** with free auto-TLS on a
custom domain.

> **Status — pre-code.** The deploy artifacts (`Dockerfile`, `.dockerignore`,
> `fly.toml` at the repo root) are ready ahead of the application. They build and run
> once plans 01–03 exist — specifically once `npm run build` produces
> `api/dist/index.js` and `web/dist`. The single code change the API needs to serve the
> web bundle is in [§4](#4-one-api-change-serve-the-web-bundle). You cannot run
> `fly deploy` end-to-end until the app is scaffolded.

---

## 1. What we're hosting, and why it constrains the platform

RacingShape is one monorepo with three npm workspaces:

| Workspace | Role | Hosting relevance |
|---|---|---|
| `shared` | Types + scoring. | Build-time only. |
| `api` | Express 5 + `better-sqlite3`. Contains the in-process **GitHub poller** (60s interval) and the **NY-midnight reset scheduler**. SQLite file on disk. | The thing that must stay running, with a disk. |
| `web` | Vite/React static bundle. Talks only to `/api/*`. | Static files; served by the API in production. |

Three properties of the app rule out most "cheap/free" hosting and point at a small
always-on container with a volume:

1. **Always-on process.** The poller and reset scheduler are `setInterval`/timer loops
   inside the API process — no incoming HTTP request triggers them. If the host sleeps
   on idle (free tiers on Render, Fly auto-stop, etc.), event ingestion and score
   snapshots stop, leaving **gaps in the race and a broken replay**. This is a
   correctness constraint, not a convenience one.

   > 💡 **Serverless vs always-on:** a serverless function spins up per request and is
   > killed after it responds. A background poller has no request to attach to, so it
   > can't live there — it needs a process that persists between requests.

2. **Persistent disk.** SQLite is a file (`data/racingshape.db`). An ephemeral
   filesystem is wiped on every redeploy/restart, which loses all history. We need a
   real volume.

3. **Native module.** `better-sqlite3` compiles native bindings, so it can't run on
   edge/serverless runtimes (Cloudflare Workers, Vercel/Netlify functions). It needs a
   normal Node container or VM.

**Design choice — single image.** Rather than host the frontend separately, the API
serves the built `web/dist` as static files. Result: one process, one domain, no CORS,
one thing to deploy and pay for.

### Why Fly.io

Cheapest option that satisfies all three constraints with the least operational work:
a ~$2–4/mo machine + 1GB volume, free automatic TLS on a custom domain, one Dockerfile,
one `fly deploy`. Secrets via `fly secrets`. The main alternatives and their trade-offs:

| Option | ~Cost/mo | Notes |
|---|---|---|
| **Fly.io** *(chosen)* | $2–4 | One Dockerfile; free TLS; must disable auto-stop. |
| Railway | ~$5 | Push-to-deploy, volumes, simplest of all. |
| Render Starter | $7 + disk | Always-on only on paid tier; free tier sleeps (disqualified). |
| Hetzner VPS | ~€4 | Full control; you manage the VM + Caddy for TLS. |
| Oracle Cloud Always Free | $0 | Genuinely free ARM VM, but you hand-manage everything. |

Avoid anything serverless/edge, and any free tier that spins down on idle.

---

## 2. Deploy artifacts (already in the repo)

These live at the repo root and are documented inline:

- **`Dockerfile`** — multi-stage build. Stage 1 installs the native toolchain
  (`python3`, `make`, `g++`), runs `npm ci`, builds `shared` → `api` → `web`, then
  `npm prune --omit=dev`. Stage 2 is a lean Node 26 runtime with only the pruned
  dependency tree (including the compiled `better-sqlite3` binding) and the built
  `dist` output. Entrypoint: `node api/dist/index.js`.
- **`.dockerignore`** — forces a clean install/build by excluding local
  `node_modules`, `dist`, `.env`, and `data/` from the build context.
- **`fly.toml`** — one machine in `iad`, `shared-cpu-1x`/256mb, a `racingshape_data`
  volume mounted at `/data`, and the always-on settings (`auto_stop_machines = false`,
  `min_machines_running = 1`). Environment defaults (`PORT`, `DB_PATH`, `WEB_DIST`,
  `TZ`, `NODE_ENV`) are set here; `GITHUB_TOKEN` is **not** — it's a secret.

### Environment variables

| Var | Where set | Value | Notes |
|---|---|---|---|
| `PORT` | `fly.toml` | `8787` | Matches `internal_port`. |
| `DB_PATH` | `fly.toml` | `/data/racingshape.db` | On the mounted volume. |
| `WEB_DIST` | `fly.toml` | `/app/web/dist` | Where the API serves static files from. |
| `TZ` | `fly.toml` | `America/New_York` | Belt-and-suspenders; the race-date key is still derived via `Intl`. |
| `NODE_ENV` | `fly.toml` / Dockerfile | `production` | |
| `GITHUB_TOKEN` | **`fly secrets`** | *(your token)* | Server-side only; never in the image or the browser. |
| `REPO_OWNER` / `REPO_NAME` | default | `S2AI` / `s2shape` | Override via `fly secrets`/env only if needed. |
| `POLL_INTERVAL_MS` / `SNAPSHOT_INTERVAL_MS` | default | `60000` / `300000` | Defaults are fine. |

---

## 3. Prerequisites

```bash
# Install flyctl (macOS)
brew install flyctl

# Log in (opens a browser)
fly auth login
```

You also need a **GitHub token** with read access to the private `S2AI/s2shape` repo:
a classic PAT with `repo` scope, or a fine-grained token granting Contents, Issues, and
Pull requests: **read**.

---

## 4. One API change: serve the web bundle

The Dockerfile copies `web/dist` into the image and `fly.toml` sets
`WEB_DIST=/app/web/dist`. When `api/src/app.ts` is built, have `createApp` serve those
static files **after** the `/api/*` routes are registered and **before** the 404
handler, so API routes always win:

```ts
import express from 'express';
import path from 'node:path';

// …inside createApp(deps), after JSON middleware + all /api routes are registered:
const webDist = process.env.WEB_DIST;
if (webDist) {
  app.use(express.static(webDist));
  // SPA fallback: any non-/api path returns index.html (client-side routing).
  app.get(/^(?!\/api\/).*/, (_req, res) => {
    res.sendFile(path.join(webDist, 'index.html'));
  });
}
```

In development this is inert (`WEB_DIST` is unset), so you keep Vite on `:5173`
proxying `/api` to the API on `:8787`, exactly as plan 03 describes. In the container it
makes the API a single-origin app — no CORS, no second host.

---

## 5. One-time setup: app, volume, secret

```bash
# Create the app. Must match `app = "racingshape"` in fly.toml. If the name is taken,
# pick another and update fly.toml plus the volume/certs steps below.
fly apps create racingshape

# Volume for the SQLite file. Name must match fly.toml [[mounts]].source, and the
# region must match primary_region. 1GB is ample for daily dev-activity events.
fly volumes create racingshape_data --region iad --size 1

# Server-side secret — never baked into the image, never sent to the browser.
fly secrets set GITHUB_TOKEN=ghp_xxxxxxxxxxxxxxxxxxxx
```

---

## 6. Deploy

```bash
fly deploy
```

The first deploy builds the image (compiles `better-sqlite3`, builds all three
workspaces), provisions the machine against the volume, and starts it.

```bash
fly logs      # watch boot, poller ticks, any errors
fly status    # machine state + health
```

Confirm exactly **one** machine. A volume binds to a single machine, so never scale
past one:

```bash
fly scale count 1
```

Subsequent deploys are just `fly deploy` again.

---

## 7. Custom domain + TLS

**Subdomain (recommended — free):** e.g. `race.yourdomain.com`.

```bash
fly certs add race.yourdomain.com
```

Then at your DNS provider add a **CNAME**: `race` → `racingshape.fly.dev`. Verify and
let Fly issue the cert automatically:

```bash
fly certs show race.yourdomain.com
```

**Apex domain** (`yourdomain.com`): requires A/AAAA records pointing at Fly IPs. A
dedicated IPv4 costs **$2/mo** (`fly ips allocate-v4`); the shared IPv4 is free but
doesn't serve an apex cleanly. The subdomain path avoids this entirely. If you must use
the apex:

```bash
fly ips allocate-v4         # dedicated; $2/mo
fly ips list                # note the v4 + v6 addresses
fly certs add yourdomain.com
# then add A (v4) and AAAA (v6) records at your DNS provider
```

TLS is provisioned and auto-renewed by Fly once DNS resolves.

---

## 8. Operations

- **Deploys briefly stop the machine.** One machine + one volume means no rolling
  deploy — there's a sub-minute poller gap on each deploy. Fine for this app; deploy
  off-peak if you want a clean midnight rollover.
- **Backups.** The entire dataset is `/data/racingshape.db`. Fly keeps automatic daily
  volume snapshots; manage them with `fly volumes snapshots list` / `... create`. To
  pull a copy locally:
  ```bash
  fly ssh sftp get /data/racingshape.db ./racingshape-backup.db
  ```
- **Logs & shell.**
  ```bash
  fly logs                 # live tail
  fly ssh console          # shell into the machine
  ```
- **Memory.** If `fly logs` shows OOM kills, bump `memory = "512mb"` in `fly.toml`
  (~$1–2/mo more) and redeploy.
- **Growing the disk.** `fly volumes extend <volume-id> --size 3`.

---

## 9. Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| Build fails on `better-sqlite3` | Native toolchain missing | The Dockerfile installs `python3 make g++` in the build stage — confirm you're building via the provided Dockerfile, not a custom one. |
| App boots then exits immediately | `loadConfig` threw — `GITHUB_TOKEN` missing | `fly secrets set GITHUB_TOKEN=…`, then `fly deploy`. |
| Data resets on every deploy | DB not on the volume | Confirm `DB_PATH=/data/racingshape.db` and the `[[mounts]]` block; check `fly volumes list`. |
| Race has gaps / replay broken | Machine stopped on idle | Ensure `auto_stop_machines = false` and `min_machines_running = 1` in `fly.toml`. |
| Frontend 404s, API works | Web bundle not served | Apply the [§4](#4-one-api-change-serve-the-web-bundle) change; confirm `WEB_DIST` and that `web/dist` is in the image. |
| Custom domain won't get a cert | DNS not resolving yet | Recheck the CNAME/A records; `fly certs show <domain>` to see what Fly is waiting on. |
| GitHub 403s in logs | Rate limit / token scope | Poller backs off automatically (plan 02). Verify the token has read access to the private repo. |

---

## 10. Cost summary

| Item | ~Monthly |
|---|---|
| `shared-cpu-1x` / 256mb machine, always on | ~$2 |
| 1GB volume | ~$0.15 |
| TLS + subdomain | $0 |
| Dedicated IPv4 (apex domain only) | +$2 |
| **Typical total (subdomain)** | **~$2–4** |
