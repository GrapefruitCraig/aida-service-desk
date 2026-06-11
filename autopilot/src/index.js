const express = require('express');
const helmet = require('helmet');
const morgan = require('morgan');
const cfg = require('./config');
const queue = require('./queue');
const { handleTicketEvent } = require('./agent/runner');

const app = express();
app.set('trust proxy', 1);
app.use(helmet());
app.use(express.json({ limit: '1mb' }));
app.use(morgan('tiny'));

queue.init(handleTicketEvent);
queue.startScheduler();

function authorised(req) {
  const token = req.get('x-t3c-token') || req.query.token;
  return cfg.webhookSecret && token === cfg.webhookSecret;
}

/** Pull a ticket ID out of whatever payload shape the Halo webhook is configured to send. */
function extractTicketId(body = {}) {
  return (
    body.ticket_id ??
    body.ticketId ??
    body.id ??
    body.ticket?.id ??
    body.Ticket?.ID ??
    null
  );
}

/**
 * POST /webhooks/halo
 * Configure two Halo webhooks at this endpoint (header X-T3C-Token: <secret>):
 *  - new ticket assigned to the agent → payload { "ticket_id": ..., "event": "new_ticket" }
 *  - customer reply on an agent-owned ticket → payload { "ticket_id": ..., "event": "user_reply" }
 */
app.post('/webhooks/halo', (req, res) => {
  if (!authorised(req)) return res.status(401).json({ error: 'unauthorised' });

  const ticketId = extractTicketId(req.body);
  if (!ticketId) return res.status(400).json({ error: 'no ticket id in payload' });

  const type = req.body.event === 'user_reply' ? 'user_reply' : 'new_ticket';
  queue.enqueue(ticketId, { type });
  res.json({ queued: true, ticketId, type });
});

/** Manual (re-)trigger for testing and for re-working terminal tickets. */
app.post('/api/run/:ticketId', (req, res) => {
  if (!authorised(req)) return res.status(401).json({ error: 'unauthorised' });
  queue.enqueue(req.params.ticketId, { type: 'manual', reason: req.body?.reason });
  res.json({ queued: true, ticketId: req.params.ticketId });
});

app.get('/health', async (req, res) => {
  const status = { openrouter: 'unknown', halo: 'unknown', ninja: 'unknown', shadow_mode: cfg.shadowMode };

  try {
    const OpenAI = require('openai');
    const client = new OpenAI({ apiKey: cfg.openRouterKey, baseURL: 'https://openrouter.ai/api/v1' });
    await client.models.list();
    status.openrouter = 'ok';
  } catch {
    status.openrouter = 'error';
  }

  try {
    await require('./integrations/halo').searchTickets({ limit: 1 });
    status.halo = 'ok';
  } catch (e) {
    status.halo = e.response?.status === 401 ? 'auth_error' : 'error';
  }

  try {
    await require('./integrations/ninja').findDevices({ search: '', limit: 1 });
    status.ninja = 'ok';
  } catch (e) {
    status.ninja = e.response?.status === 401 ? 'auth_error' : 'error';
  }

  res.json({ status, timestamp: new Date().toISOString() });
});

app.listen(cfg.port, () => {
  console.log(`T3C 1st Auto listening on :${cfg.port}`);
  console.log(`  Shadow mode: ${cfg.shadowMode ? 'ON (no user-facing actions)' : 'OFF (live)'}`);
  console.log(`  Model:       ${cfg.model}`);
  console.log(`  Halo:        ${cfg.halo.baseUrl || 'NOT CONFIGURED'}`);
});
