const express = require('express');
const axios = require('axios');
const Anthropic = require('@anthropic-ai/sdk');
const TOOLS = require('../tools/definitions');
const { executeTool } = require('../tools/executor');

const router = express.Router();
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const SYSTEM_PROMPT = `You are AIDA (AI Desk Agent), an expert AI-powered 1st line IT service desk agent for a managed service provider.

You have real-time access to:
- **Halo PSA** — create, update, search, and escalate support tickets
- **NinjaRMM** — view device health, alerts, offline devices, run remote scripts, and reboot endpoints

## Behaviour
- Be professional, concise, and solution-focused
- Always try to RESOLVE issues before creating a ticket — guide users through troubleshooting steps first
- When you create a ticket, confirm the ticket ID and SLA to the user
- When escalating, write a thorough handover note covering: issue summary, user impact, steps already taken, findings, and recommended next action
- For remote actions (reboot, script), always confirm with the user before executing
- Proactively check NinjaRMM when diagnosing device/connectivity issues
- Prioritise: P1=system-down/security breach, P2=major impact, P3=degraded service, P4=query/request

## Response format
- Use clear headings and numbered steps for troubleshooting
- Keep responses focused — don't repeat information already in the conversation
- After tool calls, present results in a clean, readable way
- Ticket IDs should always be shown prominently

Today's date: ${new Date().toLocaleDateString('en-GB', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}`;

/**
 * POST /api/agent/chat
 * Body: { messages: [...], stream: boolean }
 * Runs the full agentic loop (Claude → tools → Claude) and streams events via SSE.
 */
router.post('/chat', async (req, res) => {
  const { messages = [], stream: useStream = true } = req.body;

  if (!messages.length) {
    return res.status(400).json({ error: 'messages array is required' });
  }

  // Set up SSE
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no'); // Disable nginx buffering

  function send(event, data) {
    res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  }

  try {
    let conversationMessages = [...messages];
    let iterationCount = 0;
    const MAX_ITERATIONS = 10; // Safety limit for agentic loop

    while (iterationCount < MAX_ITERATIONS) {
      iterationCount++;

      // Call Claude with tools
      const response = await anthropic.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 4096,
        system: SYSTEM_PROMPT,
        tools: TOOLS,
        messages: conversationMessages,
      });

      // Stream any text content to client
      for (const block of response.content) {
        if (block.type === 'text' && block.text) {
          send('text', { text: block.text });
        }
      }

      // If Claude is done (no more tool calls), exit loop
      if (response.stop_reason === 'end_turn') {
        break;
      }

      // Process tool calls
      if (response.stop_reason === 'tool_use') {
        const toolUseBlocks = response.content.filter(b => b.type === 'tool_use');

        // Add Claude's response to conversation
        conversationMessages.push({
          role: 'assistant',
          content: response.content,
        });

        // Execute all tool calls (parallel where possible)
        const toolResults = await Promise.all(
          toolUseBlocks.map(async (toolUse) => {
            send('tool_start', { id: toolUse.id, name: toolUse.name, input: toolUse.input });

            const { result, error } = await executeTool(toolUse.name, toolUse.input);

            const toolResult = {
              type: 'tool_result',
              tool_use_id: toolUse.id,
              content: error
                ? `Error: ${error}`
                : JSON.stringify(result, null, 2),
              is_error: !!error,
            };

            send('tool_result', {
              id: toolUse.id,
              name: toolUse.name,
              success: !error,
              summary: error || summariseToolResult(toolUse.name, result),
            });

            return toolResult;
          })
        );

        // Add tool results to conversation
        conversationMessages.push({
          role: 'user',
          content: toolResults,
        });

        // Continue loop — Claude will process tool results and respond
        continue;
      }

      // Unexpected stop reason
      break;
    }

    if (iterationCount >= MAX_ITERATIONS) {
      send('text', { text: '\n\n⚠️ Reached maximum tool call limit. Please try a more specific request.' });
    }

    send('done', { iterations: iterationCount });
    res.end();

  } catch (err) {
    console.error('Agent error:', err);
    send('error', { message: err.message || 'Agent encountered an error' });
    res.end();
  }
});

/**
 * GET /api/agent/health
 * Integration health check
 */
router.get('/health', async (req, res) => {
  const status = {
    anthropic: 'unknown',
    halo: 'unknown',
    ninja: 'unknown',
  };

  try {
    await anthropic.models.list();
    status.anthropic = 'ok';
  } catch { status.anthropic = 'error'; }

  try {
    const halo = require('../tools/halo');
    await halo.searchTickets({ limit: 1 });
    status.halo = 'ok';
  } catch (e) { status.halo = e.response?.status === 401 ? 'auth_error' : 'error'; }

  try {
    const { getNinjaToken } = require('../tools/ninja');
    const token = await getNinjaToken();
    const healthUrl = 'https://eu-api.ninjarmm.com/api/v2/devices';
    console.log(`[health/ninja] GET ${healthUrl}`);
    const ninjaRes = await axios.get(healthUrl, {
      headers: { Authorization: `Bearer ${token}` },
      params: { pageSize: 1 },
    });
    console.log(`[health/ninja] GET ${healthUrl} → ${ninjaRes.status}`);
    status.ninja = 'ok';
  } catch (e) {
    console.error(`[health/ninja] status=${e.response?.status}`, JSON.stringify(e.response?.data), e.message);
    status.ninja = e.response?.status === 401 ? 'auth_error' : 'error';
    status.ninja_detail = e.response?.data || e.message;
  }

  res.json({ status, timestamp: new Date().toISOString() });
});

function summariseToolResult(toolName, result) {
  if (!result) return 'No data returned';
  try {
    switch (toolName) {
      case 'halo_create_ticket': return `Ticket #${result.id} created`;
      case 'halo_get_ticket': return `Ticket #${result.id}: ${result.summary}`;
      case 'halo_search_tickets': return `Found ${(result.tickets || result).length || 0} tickets`;
      case 'halo_update_ticket': return 'Ticket updated';
      case 'halo_escalate_ticket': return 'Ticket escalated';
      case 'ninja_get_devices': return `Found ${result.length || 0} devices`;
      case 'ninja_get_device_health': return `Device: ${result.device?.systemName || 'Unknown'} — ${result.device?.online ? 'Online' : 'Offline'}`;
      case 'ninja_get_active_alerts': return `${result.length || 0} active alerts`;
      case 'ninja_get_offline_devices': return `${result.length || 0} offline devices`;
      case 'ninja_reboot_device': return 'Reboot command sent';
      case 'ninja_run_script': return 'Script queued';
      default: return 'Done';
    }
  } catch { return 'Done'; }
}

module.exports = router;
