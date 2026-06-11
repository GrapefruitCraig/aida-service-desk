const halo = require('./halo');
const ninja = require('./ninja');

/**
 * Execute a tool call made by Claude.
 * Returns { result, error } — always resolves (errors are returned to Claude as tool results).
 */
async function executeTool(toolName, toolInput) {
  try {
    let result;

    switch (toolName) {
      // ── Halo PSA ─────────────────────────────────────────────────────────
      case 'halo_create_ticket':
        result = await halo.createTicket(toolInput);
        break;

      case 'halo_get_ticket':
        result = await halo.getTicket(toolInput.ticketId);
        break;

      case 'halo_search_tickets':
        result = await halo.searchTickets(toolInput);
        break;

      case 'halo_update_ticket':
        result = await halo.updateTicket(toolInput.ticketId, toolInput);
        break;

      case 'halo_escalate_ticket':
        result = await halo.escalateTicket(toolInput.ticketId, toolInput);
        break;

      case 'halo_get_users':
        result = await halo.getUsers(toolInput);
        break;

      case 'halo_search_kb':
        result = await halo.searchKBArticles(toolInput);
        break;

      case 'halo_get_kb_article':
        result = await halo.getKBArticle(toolInput.articleId);
        break;

      // ── NinjaRMM ─────────────────────────────────────────────────────────
      case 'ninja_get_devices':
        result = await ninja.getDevices(toolInput);
        break;

      case 'ninja_get_device_health':
        result = await ninja.getDeviceHealth(toolInput.deviceId);
        break;

      case 'ninja_get_active_alerts':
        result = await ninja.getActiveAlerts(toolInput);
        break;

      case 'ninja_get_offline_devices':
        result = await ninja.getOfflineDevices();
        break;

      case 'ninja_reboot_device':
        result = await ninja.rebootDevice(toolInput.deviceId, toolInput);
        break;

      case 'ninja_run_script':
        result = await ninja.runDeviceScript(toolInput.deviceId, toolInput);
        break;

      case 'ninja_get_software':
        result = await ninja.getInstalledSoftware(toolInput.deviceId);
        break;

      case 'ninja_get_patch_status':
        result = await ninja.getPatchStatus(toolInput.deviceId);
        break;

      default:
        return { error: `Unknown tool: ${toolName}` };
    }

    return { result };
  } catch (err) {
    console.error(`Tool error [${toolName}]:`, err.response?.data || err.message);
    // Return a structured error so Claude can explain it gracefully
    return {
      error: err.response?.data?.message || err.message || 'Tool execution failed',
      status: err.response?.status,
    };
  }
}

module.exports = { executeTool };
