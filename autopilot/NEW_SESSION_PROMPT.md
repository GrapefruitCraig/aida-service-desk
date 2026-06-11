# Prompt for a new Claude Code session — take T3C 1st Auto to production

**Session setup (before starting):** create the session on an environment with access to
BOTH repositories: `GrapefruitCraig/T3C-Auto` (primary working repo) and
`GrapefruitCraig/aida-service-desk` (source). Allow network access for npm.

Paste everything below as the first message:

---

You are taking **T3C 1st Auto** — an autonomous 1st line service desk agent for our MSP,
built on Halo PSA + NinjaRMM + OpenRouter — from finished code to production. The complete
system lives in the `autopilot/` directory of the `aida-service-desk` repo on branch
`claude/autonomous-service-desk-agent-yvfmws`. The repo `T3C-Auto` is its permanent home and
is currently empty (or near-empty).

Treat `PLAN.md` (process design, ticket lifecycle, rollout phases) and `DEPLOYMENT.md`
(Railway pilot → in-house Docker, cutover runbook) in that directory as the source of truth.
Do not redesign the architecture.

Work through these stages, in order:

**1. Import.** Copy the full contents of `autopilot/` (including dotfiles such as
`.gitignore` and `.env.example`, excluding `node_modules` and `data/`) to the root of
`T3C-Auto` on `main`. Verify before pushing: `npm install`, `node --check` on every file in
`src/`, and a boot smoke test (`PORT=3099 DATA_DIR=/tmp/t3c-test T3C_WEBHOOK_SECRET=test
timeout 5 node src/index.js` — must print the startup banner with "Shadow mode: ON").
Commit and push.

**2. CI.** Add a GitHub Actions workflow to T3C-Auto that runs on every push: `npm ci`,
syntax checks on all `src/**/*.js`, and the boot smoke test. Nothing fancier.

**3. Phase 0 decisions.** Ask me (in one batch, using AskUserQuestion where it fits) for the
instance-specific values the code needs:
- Halo status IDs for new / in progress / awaiting user / resolved / closed on OUR instance
- The Halo agent account ID created for the bot (`T3C_HALO_AGENT_ID`)
- Escalation target team ID (`T3C_ESCALATION_TEAM_ID`)
- Nudge policy confirmation (defaults: 24h, max 2, then close-no-response)
- The pilot client
- The display name the agent signs with (`AGENT_NAME`, default AIDA)

**4. Deployment pack.** Using my answers, produce: (a) the exact Railway variable list
(complete `.env` values minus secrets, `T3C_SHADOW_MODE=true`), (b) the two Halo webhook
configurations — endpoint URL, `X-T3C-Token` header, and JSON payloads
`{"ticket_id": ..., "event": "new_ticket"}` / `{"ticket_id": ..., "event": "user_reply"}` —
and (c) the Halo workflow-rule definition that routes the pilot client's in-scope tickets to
the bot's agent account. Commit this as `ROLLOUT.md` in the repo. I will click the Railway
and Halo admin screens myself; your job is that nothing is left ambiguous.

**5. Shadow validation.** Once I give you the deployed Railway URL: verify `GET /health`
shows `halo`, `ninja`, `openrouter` all `ok` and `shadow_mode: true`; then have me trigger
(or trigger via curl if I give you the secret) `POST /api/run/<test ticket id>` for the test
scenarios in PRODUCTION validation: a KB-covered issue, an issue with no KB coverage, a
false user claim about a device, and a reboot scenario. Review the `[SHADOW]` notes the
agent left in Halo against the operating rules in PLAN.md §3 and report what passed and what
needs prompt/KB fixes — iterate with me until shadow output is consistently right.

Hard rules: never set `T3C_SHADOW_MODE=false` yourself — going live is my call. Keep
`numReplicas = 1`. Don't push anything to `aida-service-desk`. The agent's operating
principles (facts only, KB first, non-technical questions only, tested fixes only) are
load-bearing — any prompt edits must strengthen them, never relax them.
