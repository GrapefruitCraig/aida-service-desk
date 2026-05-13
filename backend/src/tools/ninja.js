const axios = require('axios');

let tokenCache = { token: null, expiresAt: 0 };

function getNinjaBaseUrl() {
  if (process.env.NINJA_BASE_URL) return process.env.NINJA_BASE_URL;
  const regionMap = {
    eu: 'https://eu-api.ninjarmm.com',
    us: 'https://app.ninjarmm.com',
    oc: 'https://oc.ninjarmm.com',
    ca: 'https://ca.ninjarmm.com',
  };
  return regionMap[(process.env.NINJA_REGION || 'eu').toLowerCase()] || 'https://eu-api.ninjarmm.com';
}

async function getNinjaToken() {
  if (tokenCache.token && Date.now() < tokenCache.expiresAt - 60000) {
    return tokenCache.token;
  }
  const base = getNinjaBaseUrl();
  const params = new URLSearchParams({
    grant_type: 'client_credentials',
    client_id: process.env.NINJA_CLIENT_ID,
    client_secret: process.env.NINJA_CLIENT_SECRET,
    scope: 'monitoring management control',
  });
  const res = await axios.post(`${base}/ws/oauth/token`, params.toString(), {
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  });
  tokenCache = {
    token: res.data.access_token,
    expiresAt: Date.now() + res.data.expires_in * 1000,
  };
  return tokenCache.token;
}

async function ninjaRequest(method, path, data = null, params = {}) {
  const token = await getNinjaToken();
  const base = getNinjaBaseUrl();
  const res = await axios({
    method,
    url: `${base}/api/v2${path}`,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    params,
    data,
  });
  return res.data;
}

// ── Device operations ──────────────────────────────────────────────────────

async function getDevices({ search, organizationId, limit = 20 }) {
  const params = {
    pageSize: limit,
    ...(organizationId && { organizationId }),
  };
  const devices = await ninjaRequest('GET', '/devices-detailed', null, params);
  if (search) {
    const q = search.toLowerCase();
    return devices.filter(d =>
      d.systemName?.toLowerCase().includes(q) ||
      d.dnsName?.toLowerCase().includes(q) ||
      d.lastLoggedInUser?.toLowerCase().includes(q)
    );
  }
  return devices;
}

async function getDevice(deviceId) {
  return ninjaRequest('GET', `/device/${deviceId}`);
}

async function getDeviceHealth(deviceId) {
  const [device, alerts] = await Promise.all([
    ninjaRequest('GET', `/device/${deviceId}`),
    ninjaRequest('GET', `/device/${deviceId}/alerts`).catch(() => []),
  ]);
  return { device, alerts };
}

async function getActiveAlerts({ organizationId, severity } = {}) {
  const params = {
    ...(organizationId && { organizationId }),
    ...(severity && { severity }),
  };
  return ninjaRequest('GET', '/alerts', null, params);
}

async function getOfflineDevices() {
  const devices = await ninjaRequest('GET', '/devices-detailed', null, { pageSize: 200 });
  return devices.filter(d => d.online === false);
}

async function runDeviceScript(deviceId, { scriptId, scriptBody, runAs = 'SYSTEM' }) {
  // Run a saved script by ID or an ad-hoc script
  const payload = scriptId
    ? { id: scriptId, runAs }
    : { scriptBody, runAs, language: 'POWERSHELL' };
  return ninjaRequest('POST', `/device/${deviceId}/script/run`, payload);
}

async function rebootDevice(deviceId, { message = 'Reboot requested by service desk', forced = false } = {}) {
  return ninjaRequest('POST', `/device/${deviceId}/reboot`, {
    message,
    forced,
  });
}

async function getInstalledSoftware(deviceId) {
  return ninjaRequest('GET', `/device/${deviceId}/software`);
}

async function getPatchStatus(deviceId) {
  return ninjaRequest('GET', `/device/${deviceId}/os-patch-installs`);
}

async function getOrganizations() {
  return ninjaRequest('GET', '/organizations');
}

async function acknowledgeAlert(alertId) {
  return ninjaRequest('DELETE', `/alert/${alertId}`);
}

module.exports = {
  getDevices,
  getDevice,
  getDeviceHealth,
  getActiveAlerts,
  getOfflineDevices,
  runDeviceScript,
  rebootDevice,
  getInstalledSoftware,
  getPatchStatus,
  getOrganizations,
  acknowledgeAlert,
};
