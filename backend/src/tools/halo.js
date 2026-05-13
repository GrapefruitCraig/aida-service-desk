const axios = require('axios');

let tokenCache = { token: null, expiresAt: 0 };

async function getHaloToken() {
  if (tokenCache.token && Date.now() < tokenCache.expiresAt - 60000) {
    return tokenCache.token;
  }
  const params = new URLSearchParams({
    grant_type: 'client_credentials',
    client_id: process.env.HALO_CLIENT_ID,
    client_secret: process.env.HALO_CLIENT_SECRET,
    scope: 'all',
  });
  if (process.env.HALO_TENANT) params.append('tenant', process.env.HALO_TENANT);

  const res = await axios.post(
    `${process.env.HALO_BASE_URL}/auth/token`,
    params.toString(),
    { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
  );
  tokenCache = {
    token: res.data.access_token,
    expiresAt: Date.now() + res.data.expires_in * 1000,
  };
  return tokenCache.token;
}

async function haloRequest(method, path, data = null, params = {}) {
  const token = await getHaloToken();
  const res = await axios({
    method,
    url: `${process.env.HALO_BASE_URL}/api${path}`,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    params,
    data,
  });
  return res.data;
}

// ── Ticket operations ──────────────────────────────────────────────────────

async function createTicket({ summary, details, priority, category, userId, userName, userEmail }) {
  // Halo priority IDs: 1=Critical, 2=High, 3=Medium, 4=Low
  const priorityMap = { critical: 1, high: 2, medium: 3, low: 4, p1: 1, p2: 2, p3: 3, p4: 4 };
  const priorityId = priorityMap[(priority || 'medium').toLowerCase()] || 3;

  const payload = {
    summary,
    details,
    priority_id: priorityId,
    tickettype_id: 1, // Incident (adjust for your Halo config)
    ...(userId && { user_id: userId }),
    ...(userName && { reportedby: userName }),
    ...(userEmail && { reportedby_email: userEmail }),
    ...(category && { category_1: category }),
  };

  const result = await haloRequest('POST', '/Tickets', [payload]);
  return result[0] || result;
}

async function getTicket(ticketId) {
  return haloRequest('GET', `/Tickets/${ticketId}`, null, {
    includedetails: true,
  });
}

async function searchTickets({ query, status, userId, limit = 20 }) {
  const params = {
    pagesize: limit,
    ...(query && { search: query }),
    ...(status && { open_only: status === 'open' }),
    ...(userId && { user_id: userId }),
  };
  return haloRequest('GET', '/Tickets', null, params);
}

async function updateTicket(ticketId, { status, note, assigneeId, priority }) {
  const statusMap = { open: 1, 'in-progress': 2, pending: 3, resolved: 4, closed: 5 };
  const payload = {
    id: parseInt(ticketId),
    ...(status && { status_id: statusMap[status.toLowerCase()] }),
    ...(assigneeId && { agent_id: assigneeId }),
    ...(priority && { priority_id: parseInt(priority) }),
  };
  if (note) {
    payload.actions = [{ note, who: 'AIDA Service Desk Agent', isoutgoing: false }];
  }
  return haloRequest('PUT', '/Tickets', [payload]);
}

async function escalateTicket(ticketId, { escalationNote, targetTeamId, targetAgentId }) {
  const payload = {
    id: parseInt(ticketId),
    status_id: 2, // In Progress
    ...(targetTeamId && { team_id: parseInt(targetTeamId) }),
    ...(targetAgentId && { agent_id: parseInt(targetAgentId) }),
    actions: [{
      note: `🔺 ESCALATION — AIDA Service Desk Agent\n\n${escalationNote}`,
      who: 'AIDA',
      isoutgoing: false,
      actiontype_id: 17, // Escalation action type
    }],
  };
  return haloRequest('PUT', '/Tickets', [payload]);
}

async function getAgents() {
  return haloRequest('GET', '/Agent', null, { pagesize: 50 });
}

async function getUsers({ search, limit = 10 }) {
  return haloRequest('GET', '/Users', null, {
    pagesize: limit,
    ...(search && { search }),
  });
}

module.exports = {
  createTicket,
  getTicket,
  searchTickets,
  updateTicket,
  escalateTicket,
  getAgents,
  getUsers,
};
