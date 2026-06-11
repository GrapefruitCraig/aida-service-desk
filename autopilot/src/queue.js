const cfg = require('./config');
const store = require('./db');

/**
 * In-process queue: runs are serialised per ticket (a ticket is never worked
 * by two runs at once) with a global concurrency cap across tickets.
 * Swappable for Redis/BullMQ if run volume ever outgrows one instance.
 */

let handler = null; // async (ticketId, event) => {}
const chains = new Map(); // ticketId -> tail promise

let active = 0;
const waiters = [];

async function withSlot(fn) {
  if (active >= cfg.policy.maxConcurrentRuns) {
    await new Promise((resolve) => waiters.push(resolve));
  }
  active++;
  try {
    return await fn();
  } finally {
    active--;
    const next = waiters.shift();
    if (next) next();
  }
}

function init(runHandler) {
  handler = runHandler;
}

function enqueue(ticketId, event) {
  const id = parseInt(ticketId, 10);
  if (!id || !handler) return;

  const prev = chains.get(id) || Promise.resolve();
  const next = prev
    .then(() => withSlot(() => handler(id, event)))
    .catch((err) => console.error(`[queue] run failed for ticket ${id}:`, err.message));
  chains.set(id, next);
  next.finally(() => {
    if (chains.get(id) === next) chains.delete(id);
  });
}

function startScheduler() {
  setInterval(() => {
    try {
      for (const f of store.dueFollowups()) {
        store.markFollowupDone(f.id);
        enqueue(f.ticket_id, { type: 'followup', reason: f.reason });
      }
    } catch (err) {
      console.error('[scheduler] error:', err.message);
    }
  }, 60 * 1000).unref();
}

module.exports = { init, enqueue, startScheduler };
