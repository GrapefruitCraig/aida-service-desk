/**
 * Tool definitions passed to Claude API.
 * Claude decides which tools to call; the backend executes them.
 */

const TOOLS = [
  // ── HALO PSA ──────────────────────────────────────────────────────────────
  {
    name: 'halo_create_ticket',
    description: 'Create a new support ticket in Halo PSA. Use when the user reports an issue that needs tracking or cannot be resolved immediately.',
    input_schema: {
      type: 'object',
      properties: {
        summary: { type: 'string', description: 'Short one-line summary of the issue' },
        details: { type: 'string', description: 'Full description of the issue including any troubleshooting already attempted' },
        priority: { type: 'string', enum: ['critical', 'high', 'medium', 'low'], description: 'Ticket priority. Use critical only for outages affecting multiple users.' },
        category: { type: 'string', description: 'Category e.g. Network, Hardware, Software, Access, Email, VPN' },
        userName: { type: 'string', description: 'Name of the affected user' },
        userEmail: { type: 'string', description: 'Email address of the affected user' },
      },
      required: ['summary', 'details', 'priority'],
    },
  },
  {
    name: 'halo_get_ticket',
    description: 'Retrieve full details of a specific Halo PSA ticket by its ID.',
    input_schema: {
      type: 'object',
      properties: {
        ticketId: { type: 'string', description: 'The Halo ticket ID number' },
      },
      required: ['ticketId'],
    },
  },
  {
    name: 'halo_search_tickets',
    description: 'Search or list tickets in Halo PSA. Use to look up open tickets, tickets for a user, or search by keyword.',
    input_schema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Keyword to search in ticket summaries and details' },
        status: { type: 'string', enum: ['open', 'closed', 'all'], description: 'Filter by status' },
        limit: { type: 'number', description: 'Maximum number of tickets to return (default 20)' },
      },
      required: [],
    },
  },
  {
    name: 'halo_update_ticket',
    description: 'Update a Halo PSA ticket — change status, add a note, reassign, or change priority.',
    input_schema: {
      type: 'object',
      properties: {
        ticketId: { type: 'string', description: 'The Halo ticket ID to update' },
        status: { type: 'string', enum: ['open', 'in-progress', 'pending', 'resolved', 'closed'], description: 'New status' },
        note: { type: 'string', description: 'Internal note to add to the ticket' },
        priority: { type: 'string', enum: ['1', '2', '3', '4'], description: '1=Critical, 2=High, 3=Medium, 4=Low' },
      },
      required: ['ticketId'],
    },
  },
  {
    name: 'halo_escalate_ticket',
    description: 'Escalate a ticket to 2nd or 3rd line support in Halo PSA with a structured handover note. Use when the issue is beyond 1st line scope.',
    input_schema: {
      type: 'object',
      properties: {
        ticketId: { type: 'string', description: 'Ticket ID to escalate' },
        escalationNote: { type: 'string', description: 'Detailed handover note for the next-line engineer: what was tried, what was found, recommended next steps' },
        targetTeamId: { type: 'string', description: 'ID of the 2nd/3rd line team to assign to (optional)' },
      },
      required: ['ticketId', 'escalationNote'],
    },
  },
  {
    name: 'halo_get_users',
    description: 'Search for users in Halo PSA by name or email.',
    input_schema: {
      type: 'object',
      properties: {
        search: { type: 'string', description: 'Name or email to search for' },
        limit: { type: 'number', description: 'Max results (default 10)' },
      },
      required: ['search'],
    },
  },

  // ── NINJA RMM ─────────────────────────────────────────────────────────────
  {
    name: 'ninja_get_devices',
    description: 'Search for devices/endpoints in NinjaRMM by name, username, or organisation.',
    input_schema: {
      type: 'object',
      properties: {
        search: { type: 'string', description: 'Device name, hostname, or last logged-in username to search for' },
        limit: { type: 'number', description: 'Max number of devices to return' },
      },
      required: [],
    },
  },
  {
    name: 'ninja_get_device_health',
    description: 'Get full health status of a specific device in NinjaRMM including CPU, RAM, disk, online status, OS, and active alerts.',
    input_schema: {
      type: 'object',
      properties: {
        deviceId: { type: 'number', description: 'The NinjaRMM device ID' },
      },
      required: ['deviceId'],
    },
  },
  {
    name: 'ninja_get_active_alerts',
    description: 'Get all active alerts across the estate in NinjaRMM. Optionally filter by severity.',
    input_schema: {
      type: 'object',
      properties: {
        severity: { type: 'string', enum: ['CRITICAL', 'MAJOR', 'MINOR', 'NONE'], description: 'Filter alerts by severity level' },
      },
      required: [],
    },
  },
  {
    name: 'ninja_get_offline_devices',
    description: 'Get a list of all devices currently offline in NinjaRMM.',
    input_schema: {
      type: 'object',
      properties: {},
      required: [],
    },
  },
  {
    name: 'ninja_reboot_device',
    description: 'Remotely reboot a device via NinjaRMM. Always confirm with the user before rebooting.',
    input_schema: {
      type: 'object',
      properties: {
        deviceId: { type: 'number', description: 'NinjaRMM device ID to reboot' },
        message: { type: 'string', description: 'Message shown to the user on the device before reboot' },
        forced: { type: 'boolean', description: 'Force reboot without waiting for user (use cautiously)' },
      },
      required: ['deviceId'],
    },
  },
  {
    name: 'ninja_run_script',
    description: 'Run a PowerShell or script on a remote device via NinjaRMM. Use for remote remediation tasks.',
    input_schema: {
      type: 'object',
      properties: {
        deviceId: { type: 'number', description: 'NinjaRMM device ID' },
        scriptBody: { type: 'string', description: 'PowerShell script content to run' },
        runAs: { type: 'string', enum: ['SYSTEM', 'LOGGED_ON_USER'], description: 'Run as SYSTEM or as the logged-on user' },
      },
      required: ['deviceId', 'scriptBody'],
    },
  },
  {
    name: 'ninja_get_software',
    description: 'Get installed software list for a device in NinjaRMM.',
    input_schema: {
      type: 'object',
      properties: {
        deviceId: { type: 'number', description: 'NinjaRMM device ID' },
      },
      required: ['deviceId'],
    },
  },
  {
    name: 'ninja_get_patch_status',
    description: 'Get OS patch status and pending updates for a device in NinjaRMM.',
    input_schema: {
      type: 'object',
      properties: {
        deviceId: { type: 'number', description: 'NinjaRMM device ID' },
      },
      required: ['deviceId'],
    },
  },
];

module.exports = TOOLS;
