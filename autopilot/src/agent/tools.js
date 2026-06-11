/**
 * Tool definitions (OpenAI function-calling format, used via OpenRouter).
 * Write-tools take no ticket ID — the executor binds them to the current
 * ticket, so the agent cannot act outside the ticket's scope.
 */

const def = (name, description, properties = {}, required = []) => ({
  type: 'function',
  function: {
    name,
    description,
    parameters: { type: 'object', properties, required },
  },
});

const TOOLS = [
  // ── Halo: current ticket (write) ──────────────────────────────────────────
  def(
    'halo_reply_to_user',
    'Send an email reply to the end user via the ticket. The ONLY channel to the user. Plain, non-technical language. One question per message.',
    { message: { type: 'string', description: 'The message to email to the user' } },
    ['message']
  ),
  def(
    'halo_add_private_note',
    'Add an internal note to the ticket (hidden from the user). Use for the engineer-facing record: facts verified with sources, attempts, tested results, KB articles followed.',
    { note: { type: 'string' } },
    ['note']
  ),

  // ── Halo: reads ───────────────────────────────────────────────────────────
  def(
    'halo_search_tickets',
    'Search other tickets (read-only) — for history, duplicates, or "I reported this before" claims.',
    {
      query: { type: 'string', description: 'Keyword search' },
      status: { type: 'string', enum: ['open', 'closed', 'all'] },
      limit: { type: 'number' },
    },
    ['query']
  ),
  def(
    'halo_search_kb',
    'Search the Halo knowledge base. ALWAYS search before giving guidance — documented client-specific procedures override generic advice.',
    {
      search: { type: 'string', description: 'Keywords: issue, product, client' },
      limit: { type: 'number' },
    },
    ['search']
  ),
  def(
    'halo_get_kb_article',
    'Retrieve the full content of a KB article by ID. Read it in full before following or citing it.',
    { articleId: { type: 'string' } },
    ['articleId']
  ),

  // ── NinjaRMM: reads ───────────────────────────────────────────────────────
  def(
    'ninja_find_devices',
    'Find devices in NinjaRMM by hostname, DNS name, or last logged-in username. Use to locate the affected user’s device.',
    { search: { type: 'string' }, limit: { type: 'number' } },
    ['search']
  ),
  def(
    'ninja_get_device_health',
    'Full device state: online status, OS, hardware, plus active alerts. Use to fact-check device claims and to verify fixes.',
    { deviceId: { type: 'number' } },
    ['deviceId']
  ),
  def('ninja_get_patch_status', 'OS patch install history/status for a device.', { deviceId: { type: 'number' } }, ['deviceId']),
  def('ninja_get_software', 'Installed software list for a device.', { deviceId: { type: 'number' } }, ['deviceId']),

  // ── NinjaRMM: actions ─────────────────────────────────────────────────────
  def(
    'ninja_reboot_device',
    'Reboot a device (never forced). Only with a KB-documented procedure for this issue OR explicit user agreement in a reply. Verify afterwards via monitoring.',
    {
      deviceId: { type: 'number' },
      message: { type: 'string', description: 'Message shown on the device before reboot' },
    },
    ['deviceId']
  ),
  def(
    'ninja_run_script',
    'Run a PowerShell script on a device. Only scripts taken from a KB article you retrieved this run. Verify the outcome afterwards.',
    {
      deviceId: { type: 'number' },
      scriptBody: { type: 'string' },
      runAs: { type: 'string', enum: ['SYSTEM', 'LOGGED_ON_USER'] },
    },
    ['deviceId', 'scriptBody']
  ),

  // ── Terminal ──────────────────────────────────────────────────────────────
  def(
    'finish_run',
    'End this run — REQUIRED as the final call of every run. Choose the ticket state and persist your working memory.',
    {
      state: {
        type: 'string',
        enum: [
          'awaiting_user',
          'monitoring',
          'resolved_pending_confirm',
          'escalated',
          'out_of_scope',
          'closed_confirmed',
          'closed_no_response',
        ],
      },
      summary: { type: 'string', description: 'One line: what this run did' },
      scratchpad: {
        type: 'string',
        description: 'Your full working memory for the next run: facts verified (with sources), device IDs, KB articles used, what you asked / are waiting for',
      },
      followup_minutes: {
        type: 'number',
        description: 'Required for monitoring: minutes until you are woken to verify',
      },
      handover_note: {
        type: 'string',
        description: 'Required for escalated/out_of_scope: issue summary, user impact, facts verified (sources), attempts with tested results, recommended next action, escalation reason',
      },
      resolution_note: {
        type: 'string',
        description: 'Required for closed_*: issue → verified fix, emailed to the user on closure',
      },
    },
    ['state', 'summary', 'scratchpad']
  ),
];

module.exports = TOOLS;
