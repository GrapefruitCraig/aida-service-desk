const axios = require('axios');
const cfg = require('../config');

let tokenCache = { token: null, expiresAt: 0 };

function baseUrl() {
  if (cfg.ninja.baseUrl) return cfg.ninja.baseUrl;
  const regions = {
    eu: 'https://eu-api.ninjarmm.com',
    us: 'https://app.ninjarmm.com',
    oc: 'https://oc.ninjarmm.com',
    ca: 'https://ca.ninjarmm.com',
  };
  return regions[cfg.ninja.region] || regions.eu;
}

async function getToken() {
  if (tokenCache.token && Date.now() < tokenCache.expiresAt - 60000) {
    return tokenCache.token;
  }
  const res = await axios.post(
    `${baseUrl()}/ws/oauth/token`,
    new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: cfg.ninja.clientId,
      client_secret: cfg.ninja.clientSecret,
      scope: 'monitoring management control',
    }).toString(),
    { headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' } }
  );
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
    url: `${baseUrl()}/api/v2${path}`,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    params,
    data,
  });
  return res.data;
}

// ── Reads ───────────────────────────────────────────────────────────────────
// Note: use /devices (the -detailed variant needs scopes beyond `monitoring`).

async function findDevices({ search, limit = 20 }) {
  const devices = await request('GET', '/devices', null, { pageSize: 200 });
  const q = (search || '').toLowerCase();
  const matched = q
    ? devices.filter(
        (d) =>
          d.systemName?.toLowerCase().includes(q) ||
          d.dnsName?.toLowerCase().includes(q) ||
          d.lastLoggedInUser?.toLowerCase().includes(q)
      )
    : devices;
  return matched.slice(0, limit);
}

async function getDeviceHealth(deviceId) {
  const [device, alerts] = await Promise.all([
    request('GET', `/device/${deviceId}`),
    request('GET', `/device/${deviceId}/alerts`).catch(() => []),
  ]);
  return { device, alerts };
}

async function getPatchStatus(deviceId) {
  return request('GET', `/device/${deviceId}/os-patch-installs`);
}

async function getSoftware(deviceId) {
  return request('GET', `/device/${deviceId}/software`);
}

// ── Actions (gated by shadow mode in the executor) ─────────────────────────

async function rebootDevice(deviceId, { message = 'Reboot requested by the service desk' } = {}) {
  return request('POST', `/device/${deviceId}/reboot`, { message, forced: false });
}

async function runScript(deviceId, { scriptBody, runAs = 'SYSTEM' }) {
  return request('POST', `/device/${deviceId}/script/run`, {
    scriptBody,
    runAs,
    language: 'POWERSHELL',
  });
}

module.exports = {
  findDevices,
  getDeviceHealth,
  getPatchStatus,
  getSoftware,
  rebootDevice,
  runScript,
};
