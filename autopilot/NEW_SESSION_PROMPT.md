# T3C 1st Auto — stage prompts for new Claude Code sessions

Five stages, each a paste-ready prompt for a session that DOES the work (via git, the Halo
API, the Railway CLI, and curl) rather than producing instructions. Stages 1–2 need only
repo access; 3–5 need credentials placed in the **session environment as env vars** (listed
per stage). Stages can also be run back-to-back in one session if the environment has
everything from the start.

Every stage prompt assumes: primary repo `GrapefruitCraig/T3C-Auto`; `PLAN.md` and
`DEPLOYMENT.md` in it are the source of truth; never set `T3C_SHADOW_MODE=false`; never
scale past one replica.

---

## Stage 1 — Import the code

**Environment:** repos `GrapefruitCraig/T3C-Auto` (primary) + `GrapefruitCraig/aida-service-desk`.

> Import T3C 1st Auto into its permanent repo. The complete project is the `autopilot/`
> directory on branch `claude/autonomous-service-desk-agent-yvfmws` of `aida-service-desk`.
> Copy its full contents — including dotfiles (`.gitignore`, `.env.example`), excluding
> `node_modules/` and `data/` — to the ROOT of `T3C-Auto` on `main`.
> Before pushing, verify in the T3C-Auto working copy: (1) `npm install` succeeds,
> (2) `node --check` passes on every file under `src/`, (3) boot smoke test passes:
> `PORT=3099 DATA_DIR=/tmp/t3c T3C_WEBHOOK_SECRET=test timeout 5 node src/index.js`
> must print the startup banner including "Shadow mode: ON". Commit ("Initial import: T3C
> 1st Auto") and push to `main`. Do not modify any code beyond what import requires; do not
> push anything to `aida-service-desk`. Report the commit SHA and the verification output.

## Stage 2 — CI

**Environment:** repo `GrapefruitCraig/T3C-Auto`.

> Add CI to T3C-Auto. Create `.github/workflows/ci.yml` running on push and pull_request:
> Node 20, `npm ci`, `node --check` on every `src/**/*.js`, then the boot smoke test
> (`PORT=3099 DATA_DIR=/tmp/t3c T3C_WEBHOOK_SECRET=test timeout 5 node src/index.js | grep
> "Shadow mode: ON"` — wrap so the timeout's exit code doesn't fail the job when the banner
> printed). Push to `main`, then watch the Actions run via the GitHub tools until it
> completes; if it fails, fix and re-push until green. Report the green run URL.

## Stage 3 — Discover Halo instance values and commit the rollout config

**Environment:** repo `T3C-Auto` + env vars `HALO_BASE_URL`, `HALO_CLIENT_ID`,
`HALO_CLIENT_SECRET` (and `HALO_TENANT` if the instance needs it). Network access to the
Halo instance.

> Using the Halo PSA API directly (client-credentials token from `$HALO_BASE_URL/auth/token`,
> creds in env), discover the instance-specific values T3C 1st Auto needs — do NOT ask me
> for anything you can fetch:
> - `GET /api/Status` — map real status IDs for new / in progress / awaiting user (or
>   nearest equivalent) / resolved / closed
> - `GET /api/Agent` — find the bot's agent account (likely named AIDA or T3C); its ID
> - `GET /api/Team` — list teams; identify the 2nd line escalation candidates
> - `GET /api/Client` — list active clients as pilot candidates
> - `GET /api/TicketType` — list ticket types in scope for 1st line
> Where a choice is genuinely mine (escalation team, pilot client, in-scope ticket types,
> nudge policy, AGENT_NAME), present the discovered candidates with AskUserQuestion — IDs
> and names, not guesses. If no bot agent account exists, tell me exactly what to create in
> Halo (that one is admin-UI-only) and pause for the ID.
> Then audit KB coverage for the chosen pilot client: pull their last-90-days ticket
> summaries (`GET /api/Tickets`), cluster into categories, search `GET /api/KBArticle` per
> category, and produce a coverage table (category → ticket volume → matching KB article or
> GAP).
> Commit two files to `main`: `ROLLOUT.md` (all confirmed IDs and policy values, the KB
> coverage table with gaps flagged as pre-pilot work) and `railway.env.template` (every
> variable from `.env.example` filled with the real non-secret values — IDs, status map,
> region, `T3C_SHADOW_MODE=true` — secrets left as placeholders).

## Stage 4 — Deploy to Railway and wire the webhooks

**Environment:** repo `T3C-Auto` + env vars `RAILWAY_TOKEN` (Railway account/project token),
`OPENROUTER_API_KEY`, `HALO_BASE_URL`, `HALO_CLIENT_ID`, `HALO_CLIENT_SECRET`,
`HALO_TENANT` (if needed), `NINJA_CLIENT_ID`, `NINJA_CLIENT_SECRET`, `NINJA_REGION`,
`T3C_WEBHOOK_SECRET` (generate one first if unset). Network access to railway.app and the
Halo instance. Requires Stage 3's `ROLLOUT.md` in the repo.

> Deploy T3C 1st Auto to Railway using the Railway CLI non-interactively (`npm i -g
> @railway/cli`; `RAILWAY_TOKEN` is in the env — verify with `railway whoami`):
> 1. Create/link a project and deploy the repo (`railway init` / `railway link`, then
>    `railway up` from the repo root — `railway.toml` and the Dockerfile drive the build)
> 2. Attach a volume mounted at `/data` (`railway volume add -m /data`)
> 3. Set every variable from `railway.env.template`, filling secrets from the session env
>    (`railway variables set ...`). `T3C_SHADOW_MODE` MUST be `true`.
> 4. Expose a domain (`railway domain`), wait for deploy, then verify
>    `GET https://<domain>/health` returns `halo`, `ninja`, `openrouter` all `ok` and
>    `shadow_mode: true`. If anything is not `ok`, diagnose from `railway logs` and fix
>    before continuing.
> 5. Wire Halo: attempt to create the two webhooks via the Halo API (`POST /api/Webhook` —
>    endpoint `https://<domain>/webhooks/halo`, header `X-T3C-Token: <secret>`, payloads
>    `{"ticket_id": <ticket id variable>, "event": "new_ticket"}` and `{... "user_reply"}`).
>    Halo instances differ on whether webhook admin is API-exposed — if the endpoint
>    rejects it, fall back to printing the exact field values for the admin screen and
>    pause for me to confirm they're in.
> 6. The workflow routing rule (pilot client's in-scope tickets → bot agent account) is
>    admin-UI-only in Halo: print its exact definition from `ROLLOUT.md` and pause for my
>    confirmation.
> Finish by appending the deployed domain, project ID, and webhook status to `ROLLOUT.md`
> and pushing. Report the /health output verbatim.

## Stage 5 — Shadow validation

**Environment:** repo `T3C-Auto` + env vars `HALO_BASE_URL`, `HALO_CLIENT_ID`,
`HALO_CLIENT_SECRET`, `HALO_TENANT` (if needed), `T3C_URL` (deployed Railway URL),
`T3C_WEBHOOK_SECRET`. Network access to both.

> Run the shadow-mode validation suite for T3C 1st Auto end-to-end. Confirm
> `GET $T3C_URL/health` is all-`ok` with `shadow_mode: true` first. Then, via the Halo API,
> create four test tickets against the pilot/test client (mark each summary with
> `[T3C-TEST]`):
> 1. an issue covered by an existing KB article (pick one from ROLLOUT.md's coverage table)
> 2. an issue with NO KB coverage
> 3. a false claim about a device ("my laptop X is on and connected" for a device NinjaRMM
>    shows offline — pick a real offline device if one exists, else note the limitation)
> 4. a scenario whose KB procedure involves a reboot
> For each: trigger `POST $T3C_URL/api/run/<id>` with the `X-T3C-Token` header, wait for the
> run to finish (poll the ticket's actions via `GET /api/Actions?ticket_id=`), and pull the
> `[SHADOW]` notes. Evaluate each against PLAN.md §3's operating rules: KB cited and
> followed exactly (1); escalated with a structured handover, NOT improvised (2); verified
> device state reported over the user's claim (3); reboot gated on KB/consent and followed
> by a monitoring re-check, never a "fixed" claim (4). Also check every user-directed
> question is answerable by a non-technical person.
> Write `SHADOW_REPORT.md` (scenario → expected → observed → pass/fail → root cause for
> fails: prompt rule, KB gap, or code), commit and push. Where the fix is a KB gap, draft
> the missing article's content in the report. Where it's a prompt weakness, propose the
> exact edit to `src/agent/prompt.js` — strengthening the operating principles only, never
> relaxing them — and apply it if I approve. Iterate (you may re-run scenarios) until all
> four pass, then clean up: close the `[T3C-TEST]` tickets via the API. Going live
> (`T3C_SHADOW_MODE=false`) is MY decision — recommend it when warranted, don't do it.
