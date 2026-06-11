require('dotenv').config();

const num = (v, d) => (v !== undefined && v !== '' ? parseInt(v, 10) : d);
const bool = (v, d) => (v !== undefined && v !== '' ? v === 'true' || v === '1' : d);

module.exports = {
  port: num(process.env.PORT, 3002),
  webhookSecret: process.env.AIDA_WEBHOOK_SECRET || '',
  dataDir: process.env.DATA_DIR || './data',
  shadowMode: bool(process.env.AIDA_SHADOW_MODE, true),

  openRouterKey: process.env.OPENROUTER_API_KEY,
  model: process.env.OPENROUTER_MODEL || 'anthropic/claude-sonnet-4-5',

  halo: {
    baseUrl: process.env.HALO_BASE_URL,
    clientId: process.env.HALO_CLIENT_ID,
    clientSecret: process.env.HALO_CLIENT_SECRET,
    tenant: process.env.HALO_TENANT || '',
    agentId: num(process.env.AIDA_HALO_AGENT_ID, 0),
    escalationTeamId: num(process.env.AIDA_ESCALATION_TEAM_ID, 0),
    status: {
      new: num(process.env.HALO_STATUS_NEW, 1),
      inProgress: num(process.env.HALO_STATUS_IN_PROGRESS, 2),
      awaitingUser: num(process.env.HALO_STATUS_AWAITING_USER, 3),
      resolved: num(process.env.HALO_STATUS_RESOLVED, 4),
      closed: num(process.env.HALO_STATUS_CLOSED, 5),
    },
  },

  ninja: {
    baseUrl: process.env.NINJA_BASE_URL || '',
    region: (process.env.NINJA_REGION || 'eu').toLowerCase(),
    clientId: process.env.NINJA_CLIENT_ID,
    clientSecret: process.env.NINJA_CLIENT_SECRET,
  },

  policy: {
    maxConcurrentRuns: num(process.env.MAX_CONCURRENT_RUNS, 3),
    maxToolIterations: num(process.env.MAX_TOOL_ITERATIONS, 16),
    nudgeHours: num(process.env.NUDGE_HOURS, 24),
    maxNudges: num(process.env.MAX_NUDGES, 2),
    confirmCloseHours: num(process.env.CONFIRM_CLOSE_HOURS, 72),
  },
};
