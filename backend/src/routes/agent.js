const express = require('express');
const axios = require('axios');
const OpenAI = require('openai');
const TOOLS = require('../tools/definitions');
const { executeTool } = require('../tools/executor');

const router = express.Router();

// OpenRouter uses the OpenAI-compatible API
const openai = new OpenAI({
  apiKey: process.env.OPENROUTER_API_KEY,
  baseURL: 'https://openrouter.ai/api/v1',
  defaultHeaders: {
    'HTTP-Referer': process.env.FRONTEND_URL || 'http://localhost:5173',
    'X-Title': 'Caida Service Desk',
  },
});

// Default model — can be overridden per-request or via env var
const DEFAULT_MODEL = process.env.OPENROUTER_MODEL || 'anthropic/claude-sonnet-4-5';

const SYSTEM_PROMPT = `You are Caida (AI Desk Agent), an expert AI-powered 1st line IT service desk agent for a managed service provider.

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
 * Convert Anthropic-style tool definitions to OpenAI function-calling format.
 * Anthropic:  { name, description, input_schema: { type, properties, required } }
 * OpenAI:     { type: 'function', function: { name, description, parameters: { type, properties, required } } }
 */
function toOpenAITools(anthropicTools) {
  return anthropicTools.map((t) => ({
    type: 'function',
    function: {
      name: t.name,
      description: t.description,
      parameters: t.input_schema,
    },
  }));
}

const OPENAI_TOOLS = toOpenAITools(TOOLS);

/**
 * POST /api/agent/chat
 * Body: { messages: [...], stream: boolean }
 * Runs the full agentic loop (OpenRouter → tools → OpenRouter) and streams events via SSE.
 */
router.post('/chat', async (req, res) => {
  const { messages = [] } = req.body;

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
    // Convert incoming messages from Anthropic format to OpenAI format if needed.
    // The frontend may already send OpenAI-style messages ({ role, content }).
    // Tool result messages from the agentic loop are built below in OpenAI format.
    let conversationMessages = [
      { role: 'system', content: SYSTEM_PROMPT },
      ...messages,
    ];

    let iterationCount = 0;
    const MAX_ITERATIONS = 10;

    while (iterationCount < MAX_ITERATIONS) {
      iterationCount++;

      const response = await openai.chat.completions.create({
        model: DEFAULT_MODEL,
        max_tokens: 4096,
        tools: OPENAI_TOOLS,
        tool_choice: 'auto',
        messages: conversationMessages,
      });

      const choice = response.choices[0];
      const message = choice.message;

      // Stream any text content to client
      if (message.content) {
        send('text', { text: message.content });
      }

      // If the model is done (no tool calls), exit loop
      if (choice.finish_reason === 'stop' || !message.tool_calls || message.tool_calls.length === 0) {
        break;
      }

      // Process tool calls
      if (choice.finish_reason === 'tool_calls' || message.tool_calls?.length > 0) {
        // Add the assistant message (with tool_calls) to conversation
        conversationMessages.push(message);

        // Execute all tool calls (parallel)
        const toolResultMessages = await Promise.all(
          message.tool_calls.map(async (toolCall) => {
            const toolName = toolCall.function.name;
            let toolInput;
            try {
              toolInput = JSON.parse(toolCall.function.arguments);
            } catch {
              toolInput = {};
            }

            send('tool_start', { id: toolCall.id, name: toolName, input: toolInput });

            const { result, error } = await executeTool(toolName, toolInput);

            send('tool_result', {
              id: toolCall.id,
              name: toolName,
              success: !error,
              summary: error || summariseToolResult(toolName, result),
            });

            // OpenAI tool result message format
            return {
              role: 'tool',
              tool_call_id: toolCall.id,
              content: error
                ? `Error: ${error}`
                : JSON.stringify(result, null, 2),
            };
          })
        );

        // Add tool results to conversation
        conversationMessages.push(...toolResultMessages);

        // Continue loop — model will process tool results and respond
        continue;
      }

      // Unexpected finish reason
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
    openrouter: 'unknown',
    halo: 'unknown',
    ninja: 'unknown',
  };

  try {
    // Lightweight check — list available models via OpenRouter
    await openai.models.list();
    status.openrouter = 'ok';
  } catch { status.openrouter = 'error'; }

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
