const axios = require('axios');
const cfg = require('../config');

let tokenCache = { token: null, expiresAt: 0 };

async function getToken() {
  if (tokenCache.token && Date.now() < tokenCache.expiresAt - 60000) {
    return tokenCache.token;
  }
  const params = new URLSearchParams({
    grant_type: 'client_credentials',
    client_id: cfg.halo.clientId,
    client_secret: cfg.halo.clientSecret,
    scope: 'all',
  });
  if (cfg.halo.tenant) params.append('tenant', cfg.halo.tenant);

  const res = await axios.post(`${cfg.halo.baseUrl}/auth/token`, params.toString(), {
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  });
  tokenCache = {
    token: res.data.access_token,
    expiresAt: Date.now() + res.data.expires_in * 1000,
  };
  return tokenCache.token;
}

async function request(method, path, data = null, params = {}) {
  const token = await getToken();
  const res = await axios({
    method,
    url: `${cfg.halo.baseUrl}/api${path}`,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    params,
    data,
  });
  return res.data;
}

// ── Reads ───────────────────────────────────────────────────────────────────

async function getTicket(ticketId) {
  return request('GET', `/Tickets/${ticketId}`, null, { includedetails: true });
}

async function getTicketActions(ticketId, count = 30) {
  return request('GET', '/Actions', null, { ticket_id: ticketId, count });
}

async function searchTickets({ query, status, limit = 20 }) {
  return request('GET', '/Tickets', null, {
    pagesize: limit,
    ...(query && { search: query }),
    ...(status && { open_only: status === 'open' }),
  });
}

async function getUser(userId) {
  return request('GET', `/Users/${userId}`);
}

async function searchKB({ search, limit = 10 }) {
  return request('GET', '/KBArticle', null, { pagesize: limit, ...(search && { search }) });
}

async function getKBArticle(articleId) {
  return request('GET', `/KBArticle/${articleId}`, null, { includedetails: true });
}

// ── Writes (all gated by shadow mode) ──────────────────────────────────────
// Halo expects POST /Actions and POST /Tickets payloads wrapped in arrays.

async function addPrivateNote(ticketId, note) {
  return request('POST', '/Actions', [
    {
      ticket_id: parseInt(ticketId, 10),
      note,
      who: 'AIDA',
      actiontype_id: 1,
      hiddenfromuser: true,
      sendemail: false,
    },
  ]);
}

async function replyToUser(ticketId, message) {
  if (cfg.shadowMode) {
    return addPrivateNote(ticketId, `[SHADOW] Would have emailed user:\n\n${message}`);
  }
  return request('POST', '/Actions', [
    {
      ticket_id: parseInt(ticketId, 10),
      note: message,
      who: 'AIDA',
      actiontype_id: 1,
      hiddenfromuser: false,
      sendemail: true,
    },
  ]);
}

async function setStatus(ticketId, statusId) {
  if (cfg.shadowMode) {
    return addPrivateNote(ticketId, `[SHADOW] Would have set status_id to ${statusId}`);
  }
  return request('POST', '/Tickets', [{ id: parseInt(ticketId, 10), status_id: statusId }]);
}

async function escalate(ticketId, handoverNote) {
  if (cfg.shadowMode) {
    return addPrivateNote(
      ticketId,
      `[SHADOW] Would have escalated to team ${cfg.halo.escalationTeamId || '(unset)'} with handover:\n\n${handoverNote}`
    );
  }
  return request('POST', '/Actions', [
    {
      ticket_id: parseInt(ticketId, 10),
      note: handoverNote,
      who: 'AIDA',
      actiontype_id: 1,
      hiddenfromuser: true,
      sendemail: false,
      new_status: cfg.halo.status.inProgress,
      ...(cfg.halo.escalationTeamId && { new_team: cfg.halo.escalationTeamId }),
    },
  ]);
}

async function close(ticketId, resolutionNote) {
  if (cfg.shadowMode) {
    return addPrivateNote(ticketId, `[SHADOW] Would have closed with resolution:\n\n${resolutionNote}`);
  }
  await request('POST', '/Actions', [
    {
      ticket_id: parseInt(ticketId, 10),
      note: resolutionNote,
      who: 'AIDA',
      actiontype_id: 1,
      hiddenfromuser: false,
      sendemail: true,
    },
  ]);
  return setStatus(ticketId, cfg.halo.status.resolved);
}

module.exports = {
  getTicket,
  getTicketActions,
  searchTickets,
  getUser,
  searchKB,
  getKBArticle,
  addPrivateNote,
  replyToUser,
  setStatus,
  escalate,
  close,
};
