# Vault Setup — Obsidian ⇄ GitHub Direct Sync

Goal: the notes in this folder live in a dedicated private repo
(`grapefruitcraig/t3c-vault`), your Obsidian vault syncs to it automatically via
the **Obsidian Git** plugin, and Claude sessions can read/write notes by pushing
to the same repo. Decided 11 Jun 2026: dedicated vault repo + fine-grained PAT
over HTTPS.

```
Claude (cloud) ─push─► github.com/grapefruitcraig/t3c-vault ◄─auto sync─ Obsidian Git ◄─► your vault
```

---

## Step 1 — Create the repo (GitHub, ~30 seconds)

1. https://github.com/new
2. Name: `t3c-vault` · **Private** · do NOT add a README/.gitignore (keep it empty).

## Step 2 — Create the fine-grained PAT

1. GitHub → Settings → Developer settings → **Fine-grained personal access tokens**
   → Generate new token.
2. Name: `obsidian-git` · Expiration: 1 year (set a calendar reminder).
3. Repository access: **Only select repositories** → `t3c-vault`.
4. Permissions → Repository permissions → **Contents: Read and write**
   (Metadata: read is added automatically). Nothing else.
5. Generate and copy the token (`github_pat_...`) — you won't see it again.

## Step 3 — Seed the repo with these notes (your machine, one time)

```bash
# Grab the notes from the app repo branch
git clone --branch claude/coolify-self-hosted-plan-l86wwr \
  https://github.com/GrapefruitCraig/aida-service-desk.git /tmp/aida
mkdir t3c-vault && cd t3c-vault
cp -r "/tmp/aida/obsidian/AIDA Coolify Migration" .

# Keep Obsidian's per-device noise out of git
cat > .gitignore <<'EOF'
.obsidian/workspace.json
.obsidian/workspace-mobile.json
.obsidian/cache
.trash/
.DS_Store
EOF

git init -b main && git add -A && git commit -m "Seed vault: AIDA Coolify Migration project"
git remote add origin https://github.com/GrapefruitCraig/t3c-vault.git
git push -u origin main      # when prompted: username = GrapefruitCraig, password = the PAT
```

> Skip the clone if you already have the branch locally — just copy the
> `obsidian/AIDA Coolify Migration` folder.

## Step 4 — Open it as a vault and wire up Obsidian Git

1. Obsidian → **Open another vault → Open folder as vault** → choose `t3c-vault`.
   (Or copy the folder into an existing vault and `git init` there instead —
   but a dedicated vault keeps personal notes out of the company repo.)
2. Settings → Community plugins → turn off Restricted mode → Browse →
   install **"Git"** (a.k.a. Obsidian Git, by Vinzent) → Enable.
3. Plugin settings:
   - **Commit-and-sync interval**: 10 (minutes) — this is the "direct sync".
   - **Pull on startup**: on. **Push on commit-and-sync**: on (default).
   - Commit message: e.g. `vault sync: {{date}}`.
4. Desktop auth: the first push prompts for credentials — username
   `GrapefruitCraig`, password = the PAT; your OS git credential manager stores it.
   **Mobile**: plugin settings → Authentication → enter username + PAT there.
5. Test: edit a note → wait for the sync interval (or run command
   `Git: Commit-and-sync`) → confirm the commit appears on GitHub.

## Step 5 — Let Claude write to the vault

In Claude Code (web) → your environment's repository settings → add
`grapefruitcraig/t3c-vault` as an available repository. From then on, sessions can
be pointed at the vault repo and I can add/update notes (changelog entries, stage
tracker ticks, new project folders) by pushing to `main` — Obsidian pulls them in
on the next sync.

---

## Day-to-day behaviour

- **Your edits** → auto commit+push every 10 min (or on demand).
- **Claude's edits** → pushed to GitHub → appear in Obsidian on next pull/startup.
- **Conflicts** are rare with one human + one bot; if both edit the same note,
  Obsidian Git surfaces a merge-conflict file — keep the wanted lines, sync again.

## After this works (housekeeping)

- Remove the `obsidian/` folder from `aida-service-desk` — the vault repo becomes
  the single source for notes; the app repo keeps only `docs/coolify/` runbooks.
- New projects: create a new top-level folder per project in the vault, each with
  its own `Changelog Synopsis` as the primary note (same pattern as AIDA).
