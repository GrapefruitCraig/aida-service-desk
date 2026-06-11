const cfg = require('../config');
const halo = require('../integrations/halo');
const ninja = require('../integrations/ninja');

/**
 * Executes one tool call, bound to the current ticket. Always resolves —
 * errors go back to the model as tool results so it can adapt or escalate.
 * finish_run is intercepted by the runner and never reaches here.
 */
async function executeTool(ticketId, name, input) {
  try {
    switch (name) {
      case 'halo_reply_to_user':
        await halo.replyToUser(ticketId, input.message);
        return { result: { sent: true, shadow: cfg.shadowMode } };

      case 'halo_add_private_note':
        await halo.addPrivateNote(ticketId, input.note);
        return { result: { added: true } };

      case 'halo_search_tickets':
        return { result: await halo.searchTickets(input) };

      case 'halo_search_kb':
        return { result: await halo.searchKB(input) };

      case 'halo_get_kb_article':
        return { result: await halo.getKBArticle(input.articleId) };

      case 'ninja_find_devices':
        return { result: await ninja.findDevices(input) };

      case 'ninja_get_device_health':
        return { result: await ninja.getDeviceHealth(input.deviceId) };

      case 'ninja_get_patch_status':
        return { result: await ninja.getPatchStatus(input.deviceId) };

      case 'ninja_get_software':
        return { result: await ninja.getSoftware(input.deviceId) };

      case 'ninja_reboot_device':
        if (cfg.shadowMode) {
          await halo.addPrivateNote(ticketId, `[SHADOW] Would have rebooted device ${input.deviceId}`);
          return { result: { shadow: true, note: 'Shadow mode: reboot NOT executed, logged to ticket instead' } };
        }
        return { result: await ninja.rebootDevice(input.deviceId, input) };

      case 'ninja_run_script':
        if (cfg.shadowMode) {
          await halo.addPrivateNote(
            ticketId,
            `[SHADOW] Would have run script on device ${input.deviceId} as ${input.runAs || 'SYSTEM'}:\n\n${input.scriptBody}`
          );
          return { result: { shadow: true, note: 'Shadow mode: script NOT executed, logged to ticket instead' } };
        }
        return { result: await ninja.runScript(input.deviceId, input) };

      default:
        return { error: `Unknown tool: ${name}` };
    }
  } catch (err) {
    console.error(`[executor] ${name} failed for ticket ${ticketId}:`, err.response?.data || err.message);
    return {
      error: err.response?.data?.message || err.message || 'Tool execution failed',
      status: err.response?.status,
    };
  }
}

module.exports = { executeTool };
