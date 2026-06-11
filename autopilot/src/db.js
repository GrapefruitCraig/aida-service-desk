const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');
const cfg = require('./config');

fs.mkdirSync(cfg.dataDir, { recursive: true });
const db = new Database(path.join(cfg.dataDir, 't3c_auto.db'));
db.pragma('journal_mode = WAL');

db.exec(`
CREATE TABLE IF NOT EXISTS tickets (
  ticket_id   INTEGER PRIMARY KEY,
  state       TEXT NOT NULL DEFAULT 'triaging',
  scratchpad  TEXT NOT NULL DEFAULT '',
  nudge_count INTEGER NOT NULL DEFAULT 0,
  created_at  TEXT NOT NULL,
  updated_at  TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS followups (
  id        INTEGER PRIMARY KEY AUTOINCREMENT,
  ticket_id INTEGER NOT NULL,
  due_at    INTEGER NOT NULL,
  reason    TEXT NOT NULL DEFAULT '',
  done      INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_followups_due ON followups (done, due_at);
CREATE TABLE IF NOT EXISTS runs (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  ticket_id   INTEGER NOT NULL,
  trigger     TEXT NOT NULL,
  outcome     TEXT,
  summary     TEXT,
  started_at  TEXT NOT NULL,
  finished_at TEXT
);
`);

const now = () => new Date().toISOString();

function ensureTicket(ticketId) {
  db.prepare(
    'INSERT OR IGNORE INTO tickets (ticket_id, created_at, updated_at) VALUES (?, ?, ?)'
  ).run(ticketId, now(), now());
  return db.prepare('SELECT * FROM tickets WHERE ticket_id = ?').get(ticketId);
}

function updateTicket(ticketId, { state, scratchpad, nudgeCount }) {
  const cur = ensureTicket(ticketId);
  db.prepare(
    'UPDATE tickets SET state = ?, scratchpad = ?, nudge_count = ?, updated_at = ? WHERE ticket_id = ?'
  ).run(
    state ?? cur.state,
    scratchpad ?? cur.scratchpad,
    nudgeCount ?? cur.nudge_count,
    now(),
    ticketId
  );
}

function scheduleFollowup(ticketId, minutes, reason) {
  db.prepare('INSERT INTO followups (ticket_id, due_at, reason) VALUES (?, ?, ?)').run(
    ticketId,
    Date.now() + minutes * 60 * 1000,
    reason || ''
  );
}

function cancelFollowups(ticketId) {
  db.prepare('UPDATE followups SET done = 1 WHERE ticket_id = ? AND done = 0').run(ticketId);
}

function dueFollowups() {
  return db.prepare('SELECT * FROM followups WHERE done = 0 AND due_at <= ?').all(Date.now());
}

function markFollowupDone(id) {
  db.prepare('UPDATE followups SET done = 1 WHERE id = ?').run(id);
}

function startRun(ticketId, trigger) {
  return db
    .prepare('INSERT INTO runs (ticket_id, trigger, started_at) VALUES (?, ?, ?)')
    .run(ticketId, trigger, now()).lastInsertRowid;
}

function finishRun(runId, outcome, summary) {
  db.prepare('UPDATE runs SET outcome = ?, summary = ?, finished_at = ? WHERE id = ?').run(
    outcome,
    summary || '',
    now(),
    runId
  );
}

module.exports = {
  db,
  ensureTicket,
  updateTicket,
  scheduleFollowup,
  cancelFollowups,
  dueFollowups,
  markFollowupDone,
  startRun,
  finishRun,
};
