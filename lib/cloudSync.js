// URSPantropiko Clean Cross-Device Cloud Sync Engine
const VERCEL_API_URL = '/api/sync';
const CLIENT_ID = 'client_' + Math.random().toString(36).substring(2) + '_' + Date.now();

/**
 * Broadcasts an update across all open tabs, phones, and devices.
 */
export async function broadcastCloudUpdate(ticketsList, newEventPing = null, registrationLocked = null, deletedCodes = null) {
  // 1. Save to local storage
  try {
    if (ticketsList) {
      localStorage.setItem('ursp_masterlist_attendees_v5', JSON.stringify(ticketsList));
    }
    if (registrationLocked !== null && registrationLocked !== undefined) {
      localStorage.setItem('ursp_registration_locked', String(registrationLocked));
    }
  } catch (e) {}

  // 2. Broadcast to other local browser tabs (ignoring self)
  try {
    if (typeof BroadcastChannel !== 'undefined') {
      const bc = new BroadcastChannel('ursp_live_sync_channel');
      bc.postMessage({
        type: 'SYNC_TICKETS',
        tickets: ticketsList,
        ping: newEventPing,
        registrationLocked: registrationLocked,
        deletedCodes: deletedCodes,
        senderId: CLIENT_ID,
        timestamp: Date.now()
      });
      bc.close();
    }
  } catch (e) {}

  // 3. Push to Vercel Serverless Sync API
  try {
    fetch(VERCEL_API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tickets: ticketsList,
        deletedCodes: deletedCodes,
        registrationLocked: registrationLocked,
        senderId: CLIENT_ID
      })
    }).catch(() => {});
  } catch (e) {}
}

/**
 * Broadcasts an activity log entry to the Vercel API and local tabs.
 */
export async function broadcastLogEntry(logEntry) {
  if (!logEntry) return;

  // 1. Save to local activity log cache
  try {
    const raw = localStorage.getItem('ursp_activity_log_v1');
    let logs = raw ? JSON.parse(raw) : [];
    logs.unshift(logEntry);
    if (logs.length > 1000) logs = logs.slice(0, 1000);
    localStorage.setItem('ursp_activity_log_v1', JSON.stringify(logs));
  } catch (e) {}

  // 2. Broadcast to local tabs
  try {
    if (typeof BroadcastChannel !== 'undefined') {
      const bc = new BroadcastChannel('ursp_live_sync_channel');
      bc.postMessage({
        type: 'ACTIVITY_LOG_ADD',
        logEntry: logEntry,
        senderId: CLIENT_ID,
        timestamp: Date.now()
      });
      bc.close();
    }
  } catch (e) {}

  // 3. Push to Vercel API
  try {
    fetch(VERCEL_API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        logEntry: logEntry,
        senderId: CLIENT_ID
      })
    }).catch(() => {});
  } catch (e) {}
}

/**
 * Broadcasts deletion of specific activity logs across all devices.
 */
export async function broadcastDeleteLogs(deleteLogIds) {
  if (!Array.isArray(deleteLogIds) || deleteLogIds.length === 0) return;

  // 1. Update local storage
  try {
    const raw = localStorage.getItem('ursp_activity_log_v1');
    if (raw) {
      const idSet = new Set(deleteLogIds);
      const logs = JSON.parse(raw).filter(l => !idSet.has(l.id));
      localStorage.setItem('ursp_activity_log_v1', JSON.stringify(logs));
    }
  } catch (e) {}

  // 2. Broadcast to local tabs
  try {
    if (typeof BroadcastChannel !== 'undefined') {
      const bc = new BroadcastChannel('ursp_live_sync_channel');
      bc.postMessage({
        type: 'ACTIVITY_LOG_DELETE',
        deleteLogIds: deleteLogIds,
        senderId: CLIENT_ID,
        timestamp: Date.now()
      });
      bc.close();
    }
  } catch (e) {}

  // 3. Push deletion to Vercel API
  try {
    fetch(VERCEL_API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        deleteLogIds: deleteLogIds,
        senderId: CLIENT_ID
      })
    }).catch(() => {});
  } catch (e) {}
}

/**
 * Broadcasts clearing of all activity logs across all devices.
 */
export async function broadcastClearLogs() {
  try {
    localStorage.removeItem('ursp_activity_log_v1');
  } catch (e) {}

  try {
    if (typeof BroadcastChannel !== 'undefined') {
      const bc = new BroadcastChannel('ursp_live_sync_channel');
      bc.postMessage({
        type: 'ACTIVITY_LOG_CLEAR',
        senderId: CLIENT_ID,
        timestamp: Date.now()
      });
      bc.close();
    }
  } catch (e) {}

  try {
    fetch(VERCEL_API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        clearLogs: true,
        senderId: CLIENT_ID
      })
    }).catch(() => {});
  } catch (e) {}
}

/**
 * Listens for real-time cloud updates from other devices (phones, laptops, ushers)
 */
export function listenToCloudUpdates(onUpdateReceived, onLockStatusReceived = null, onActivityLogReceived = null, onDeletedCodesReceived = null) {
  let pollInterval = null;
  let lastServerHash = '';
  let lastLockState = null;
  let lastLogHash = '';
  let lastDeletedHash = '';
  const mountTime = Date.now();

  // Method 1: Local Tab BroadcastChannel (Instant real-time sync across open tabs)
  let bc = null;
  try {
    if (typeof BroadcastChannel !== 'undefined') {
      bc = new BroadcastChannel('ursp_live_sync_channel');
      bc.onmessage = (e) => {
        // Ignore self-broadcasts
        if (e.data && e.data.senderId !== CLIENT_ID) {
          if (e.data.deletedCodes && onDeletedCodesReceived) {
            onDeletedCodesReceived(e.data.deletedCodes);
          }
          if (e.data.type === 'SYNC_TICKETS' && e.data.tickets !== undefined) {
            const isValidFreshPing = e.data.ping && (!e.data.timestamp || e.data.timestamp >= mountTime - 1000);
            onUpdateReceived(e.data.tickets, isValidFreshPing ? e.data.ping : null);
          }
          if (e.data.type === 'ACTIVITY_LOG_ADD' && e.data.logEntry && onActivityLogReceived) {
            onActivityLogReceived({ action: 'add', logEntry: e.data.logEntry });
          }
          if (e.data.type === 'ACTIVITY_LOG_DELETE' && e.data.deleteLogIds && onActivityLogReceived) {
            onActivityLogReceived({ action: 'delete', deleteLogIds: e.data.deleteLogIds });
          }
          if (e.data.type === 'ACTIVITY_LOG_CLEAR' && onActivityLogReceived) {
            onActivityLogReceived({ action: 'clear' });
          }
          if (e.data.registrationLocked !== undefined && e.data.registrationLocked !== null && onLockStatusReceived) {
            onLockStatusReceived(e.data.registrationLocked);
          }
        }
      };
    }
  } catch (e) {}

  // Method 2: Controlled Polling from Vercel API every 4 seconds
  const fetchVercelSync = async () => {
    try {
      const res = await fetch(VERCEL_API_URL);
      if (res.ok) {
        const json = await res.json();
        if (json) {
          // 1. Deleted codes blacklist sync
          if (json.deletedCodes && Array.isArray(json.deletedCodes)) {
            const delHash = json.deletedCodes.sort().join('|');
            if (delHash !== lastDeletedHash) {
              lastDeletedHash = delHash;
              if (onDeletedCodesReceived) {
                onDeletedCodesReceived(json.deletedCodes);
              }
            }
          }

          // 2. Attendee sync
          if (json.data && Array.isArray(json.data)) {
            const currentCodesHash = json.data.map(t => `${t.ticket_code}:${t.payment_status}:${t.day1_status}:${t.day2_status}`).join('|');
            if (currentCodesHash !== lastServerHash) {
              lastServerHash = currentCodesHash;
              onUpdateReceived(json.data, null);
            }
          }

          // 3. Registration lock status
          if (json.registrationLocked !== undefined && json.registrationLocked !== null && json.registrationLocked !== lastLockState) {
            lastLockState = json.registrationLocked;
            if (onLockStatusReceived) {
              onLockStatusReceived(json.registrationLocked);
            }
          }

          // 4. Activity log sync
          if (json.activityLog && Array.isArray(json.activityLog) && onActivityLogReceived) {
            const logHash = `${json.activityLog.length}_${json.activityLog[0]?.id || '0'}_${json.activityLog[json.activityLog.length - 1]?.id || '0'}`;
            if (logHash !== lastLogHash) {
              lastLogHash = logHash;
              onActivityLogReceived({ action: 'sync_all', logs: json.activityLog });
            }
          }
        }
      }
    } catch (err) {}
  };

  fetchVercelSync();
  pollInterval = setInterval(fetchVercelSync, 3000);

  return () => {
    if (bc) bc.close();
    if (pollInterval) clearInterval(pollInterval);
  };
}
