const OpenAI = require('openai');
const cfg = require('../config');
const store = require('../db');
const halo = require('../integrations/halo');
const TOOLS = require('./tools');
const { executeTool } = require('./executor');
const { SYSTEM_PROMPT, buildEventMessage } = require('./prompt');

let _openai = null;
function openaiClient() {
  if (!_openai) {
    if (!cfg.openRouterKey) throw new Error('OPENROUTER_API_KEY is not set');
    _openai = new OpenAI({
      apiKey: cfg.openRouterKey,
      baseURL: 'https://openrouter.ai/api/v1',
      defaultHeaders: { 'X-Title': 'AIDA Autopilot' },
    });
  }
  return _openai;
}

const TERMINAL_STATES = new Set(['escalated', 'out_of_scope', 'closed']);

/**
 * One agent run on one ticket, triggered by an event
 * ({type: 'new_ticket'|'user_reply'|'followup'|'manual', reason?}).
 * The queue guarantees runs on the same ticket never overlap.
 */
async function handleTicketEvent(ticketId, event) {
  const row = store.ensureTicket(ticketId);

  // Terminal tickets are only re-workable by explicit manual trigger
  if (TERMINAL_STATES.has(row.state) && event.type !== 'manual') {
    console.log(`[runner] ticket ${ticketId} is ${row.state}; ignoring ${event.type}`);
    return;
  }

  const runId = store.startRun(ticketId, `${event.type}${event.reason ? `: ${event.reason}` : ''}`);
  console.log(`[runner] ticket ${ticketId} run ${runId} (${event.type}) state=${row.state}`);

  try {
    const ticket = await halo.getTicket(ticketId);
    const actions = await halo.getTicketActions(ticketId).catch(() => []);

    // Stand down if a human has taken the ticket over
    if (cfg.halo.agentId && ticket.agent_id && ticket.agent_id !== cfg.halo.agentId) {
      store.cancelFollowups(ticketId);
      store.updateTicket(ticketId, { state: 'closed' });
      store.finishRun(runId, 'released', `Ticket reassigned to agent ${ticket.agent_id}; AIDA stood down`);
      console.log(`[runner] ticket ${ticketId} owned by agent ${ticket.agent_id}; standing down`);
      return;
    }

    // A user reply resets the nudge clock
    let nudgeCount = row.nudge_count;
    if (event.type === 'user_reply') {
      nudgeCount = 0;
      store.updateTicket(ticketId, { nudgeCount: 0 });
      store.cancelFollowups(ticketId);
    }

    const messages = [
      { role: 'system', content: SYSTEM_PROMPT },
      {
        role: 'user',
        content: buildEventMessage({
          ticket,
          actions,
          row: { ...row, nudge_count: nudgeCount },
          event,
          policy: cfg.policy,
        }),
      },
    ];

    let outcome = null;

    for (let i = 0; i < cfg.policy.maxToolIterations && !outcome; i++) {
      const response = await openaiClient().chat.completions.create({
        model: cfg.model,
        max_tokens: 4096,
        tools: TOOLS,
        tool_choice: 'auto',
        messages,
      });

      const message = response.choices[0].message;
      messages.push(message);

      if (!message.tool_calls?.length) {
        // Model replied with text only — remind it a terminal call is required
        messages.push({
          role: 'user',
          content: 'You must end the run with a finish_run tool call. Call it now with the appropriate state.',
        });
        continue;
      }

      for (const call of message.tool_calls) {
        let input = {};
        try {
          input = JSON.parse(call.function.arguments || '{}');
        } catch {}

        if (call.function.name === 'finish_run') {
          outcome = input;
          messages.push({ role: 'tool', tool_call_id: call.id, content: 'Run ended.' });
          continue;
        }

        const { result, error } = await executeTool(ticketId, call.function.name, input);
        messages.push({
          role: 'tool',
          tool_call_id: call.id,
          content: error ? `Error: ${error}` : JSON.stringify(result),
        });
      }
    }

    if (!outcome) {
      await halo.addPrivateNote(ticketId, 'AIDA: run ended without an outcome (iteration limit). Flagged for human review.');
      store.updateTicket(ticketId, { state: 'needs_attention' });
      store.finishRun(runId, 'needs_attention', 'Iteration limit reached without finish_run');
      return;
    }

    await applyOutcome(ticketId, outcome, event, nudgeCount);
    store.finishRun(runId, outcome.state, outcome.summary);
    console.log(`[runner] ticket ${ticketId} run ${runId} → ${outcome.state}: ${outcome.summary}`);
  } catch (err) {
    console.error(`[runner] ticket ${ticketId} run ${runId} failed:`, err.response?.data || err.message);
    store.updateTicket(ticketId, { state: 'needs_attention' });
    store.finishRun(runId, 'error', err.message);
    await halo
      .addPrivateNote(ticketId, `AIDA: run failed with an internal error (${err.message}). Flagged for human review.`)
      .catch(() => {});
  }
}

/** Side-effects of each terminal state are enforced here, not by the model. */
async function applyOutcome(ticketId, outcome, event, nudgeCount) {
  const { state, scratchpad } = outcome;
  store.cancelFollowups(ticketId);

  switch (state) {
    case 'awaiting_user': {
      // A follow-up wake-up that ends back in awaiting_user means a nudge was sent
      const newNudgeCount = event.type === 'followup' ? nudgeCount + 1 : nudgeCount;
      store.updateTicket(ticketId, {
        state,
        scratchpad,
        nudgeCount: newNudgeCount,
      });
      store.scheduleFollowup(ticketId, cfg.policy.nudgeHours * 60, 'No user reply yet — nudge or close per policy');
      await halo.setStatus(ticketId, cfg.halo.status.awaitingUser);
      break;
    }

    case 'monitoring': {
      const minutes = Math.max(1, outcome.followup_minutes || 15);
      store.updateTicket(ticketId, { state, scratchpad });
      store.scheduleFollowup(ticketId, minutes, 'Verify the action you took');
      await halo.setStatus(ticketId, cfg.halo.status.inProgress);
      break;
    }

    case 'resolved_pending_confirm':
      store.updateTicket(ticketId, { state, scratchpad });
      store.scheduleFollowup(
        ticketId,
        cfg.policy.confirmCloseHours * 60,
        'No confirmation from user — close per policy if the verified fix stands'
      );
      break;

    case 'escalated':
    case 'out_of_scope':
      await halo.escalate(
        ticketId,
        outcome.handover_note || `AIDA ${state} without a handover note. Summary: ${outcome.summary}`
      );
      store.updateTicket(ticketId, { state: 'escalated', scratchpad });
      break;

    case 'closed_confirmed':
    case 'closed_no_response':
      await halo.close(
        ticketId,
        outcome.resolution_note || `Closed by AIDA (${state}). Summary: ${outcome.summary}`
      );
      store.updateTicket(ticketId, { state: 'closed', scratchpad });
      break;

    default:
      store.updateTicket(ticketId, { state: 'needs_attention', scratchpad });
      await halo.addPrivateNote(ticketId, `AIDA: unknown outcome state "${state}". Flagged for human review.`);
  }
}

module.exports = { handleTicketEvent };
