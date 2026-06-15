# Kickoff prompt — new session for T3C 1st Auto

**Before you paste this:** create the new Claude Code session on an environment whose
repository access includes BOTH `GrapefruitCraig/T3C-Auto` (primary) and
`GrapefruitCraig/aida-service-desk` (source). Allow npm/network access. Then paste
everything below the line as the first message.

---

You are bootstrapping **T3C 1st Auto** into its permanent repository.

**What it is:** a finished, autonomous 1st line service desk agent for our MSP, built on
Halo PSA + NinjaRMM + OpenRouter. The existing Halo 1st line workflow hands it tickets via
webhook; it then owns each ticket to completion — fact-checking the report, following Halo
KB procedures, emailing the user, verifying fixes before claiming them, chasing silence, and
escalating with a structured handover. Operating principles (facts only, KB first,
non-technical questions only, tested fixes only) are load-bearing — never relax them.

**Where it lives now:** complete and committed in the `autopilot/` directory of
`GrapefruitCraig/aida-service-desk`, branch `claude/autonomous-service-desk-agent-yvfmws`.
It has NOT yet been copied into `T3C-Auto` (its permanent home) — that is your first job.

**Read first, in this order, from that `autopilot/` directory:**
1. `NEW_SESSION_PROMPT.md` — the five executable stage prompts (import → CI → Halo discovery
   → Railway deploy → shadow validation). This is your roadmap; follow it.
2. `PLAN.md` — process design, ticket lifecycle, rollout phases. Source of truth; do not
   redesign the architecture.
3. `DEPLOYMENT.md` — Railway pilot then in-house Docker, with the cutover runbook.

**Do now — Stage 1 (Import):** copy the full contents of `autopilot/` — including dotfiles
(`.gitignore`, `.env.example`), excluding `node_modules/` and `data/` — to the ROOT of
`T3C-Auto` on `main`. Before pushing, verify in the T3C-Auto working copy: (1) `npm install`
succeeds; (2) `node --check` passes on every file under `src/`; (3) boot smoke test prints
the banner including "Shadow mode: ON":
`PORT=3099 DATA_DIR=/tmp/t3c T3C_WEBHOOK_SECRET=test timeout 5 node src/index.js`
Commit ("Initial import: T3C 1st Auto") and push to `main`. Do not push anything to
`aida-service-desk`. Report the commit SHA and verification output, then stop and confirm
with me before starting Stage 2.

**Hard rules across all stages:** never set `T3C_SHADOW_MODE=false` (going live is my
decision); keep `numReplicas = 1`; subsequent stages (3–5) need credentials I will place in
the session environment as env vars — do not ask me to paste secrets into chat.

If you cannot access `T3C-Auto` (repository not authorized), stop immediately and tell me —
the session environment was created without access to it and needs to be recreated.

---
