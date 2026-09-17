// URSPantropiko Clean Cross-Device Cloud Sync Engine
const VERCEL_API_URL = '/api/sync';
const CLIENT_ID = 'client_' + Math.random().toString(36).substring(2) + '_' + Date.now();

export function getLocalDeletedCodes() {
  try {
    const raw = localStorage.getItem('ursp_deleted_codes_v1');
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch (e) {}
  return [];
}

/**
 * Broadcasts an update across all open tabs, phones, and devices.
 */
export async function broadcastCloudUpdate(ticketsList, newEventPing = null, registrationLocked = null, deletedTicketCodes = []) {
  // 1. Save to local storage
  try {
    if (Array.isArray(ticketsList)) {
      localStorage.setItem('ursp_masterlist_attendees_v6', JSON.stringify(ticketsList));
    }
    if (Array.isArray(deletedTicketCodes) && deletedTicketCodes.length > 0) {
      const existing = getLocalDeletedCodes();
      const union = Array.from(new Set([...existing, ...deletedTicketCodes]));
      localStorage.setItem('ursp_deleted_codes_v1', JSON.stringify(union));
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
        deletedTicketCodes: deletedTicketCodes,
        senderId: CLIENT_ID,
        timestamp: Date.now()
      });
      bc.close();
    }
  } catch (e) {}

  // 3. Push to Vercel Serverless Sync API (lightweight write acknowledgment only)
  try {
    const allDeleted = Array.from(new Set([...getLocalDeletedCodes(), ...(deletedTicketCodes || [])]));
    fetch(VERCEL_API_URL + '?light=true', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tickets: ticketsList,
        registrationLocked: registrationLocked,
        deletedTicketCodes: allDeleted,
        ping: newEventPing,
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
    fetch(VERCEL_API_URL + '?light=true', {
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

  try {
    const raw = localStorage.getItem('ursp_activity_log_v1');
    if (raw) {
      const idSet = new Set(deleteLogIds);
      const logs = JSON.parse(raw).filter(l => !idSet.has(l.id));
      localStorage.setItem('ursp_activity_log_v1', JSON.stringify(logs));
    }
  } catch (e) {}

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

  try {
    fetch(VERCEL_API_URL + '?light=true', {
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
    fetch(VERCEL_API_URL + '?light=true', {
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
export function listenToCloudUpdates(onUpdateReceived, onLockStatusReceived = null, onActivityLogReceived = null) {
  let pollInterval = null;
  let lastServerHash = '';
  let lastLockState = null;
  let lastLogHash = '';
  let lastPingTimestamp = 0;
  const mountTime = Date.now();

  // Method 1: Local Tab BroadcastChannel (Instant real-time sync across open tabs)
  let bc = null;
  try {
    if (typeof BroadcastChannel !== 'undefined') {
      bc = new BroadcastChannel('ursp_live_sync_channel');
      bc.onmessage = (e) => {
        if (e.data && e.data.senderId !== CLIENT_ID) {
          if (e.data.type === 'SYNC_TICKETS' && Array.isArray(e.data.tickets)) {
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

  // Method 2: Controlled Polling from Vercel API with HTTP 304 ETag caching for zero redundant bandwidth
  let lastETag = null;
  const fetchVercelSync = async () => {
    try {
      const headers = {};
      if (lastETag) {
        headers['If-None-Match'] = lastETag;
      }
      const res = await fetch(VERCEL_API_URL, { headers });
      if (res.status === 304) {
        // Zero changes on server — 0 bytes transferred
        return;
      }
      if (res.ok) {
        const etagHeader = res.headers.get('etag');
        if (etagHeader) lastETag = etagHeader;

        const json = await res.json();
        if (json) {
          // Sync tombstones across devices
          if (json.deletedCodes && Array.isArray(json.deletedCodes) && json.deletedCodes.length > 0) {
            const existing = getLocalDeletedCodes();
            const union = Array.from(new Set([...existing, ...json.deletedCodes]));
            try {
              localStorage.setItem('ursp_deleted_codes_v1', JSON.stringify(union));
            } catch (e) {}
          }

          // Check for incoming cross-device live event toast ping (Verification, Registration, Admission)
          let incomingPing = null;
          if (json.latestPing && json.latestPing.timestamp && json.latestPing.timestamp > lastPingTimestamp) {
            lastPingTimestamp = json.latestPing.timestamp;
            if (json.latestPing.senderId !== CLIENT_ID && (Date.now() - json.latestPing.timestamp < 8000)) {
              incomingPing = json.latestPing;
            }
          }

          // Attendee sync (triggers whenever server data changes or a new ping arrives)
          if (json.data && Array.isArray(json.data)) {
            const delSet = new Set(getLocalDeletedCodes());
            const filteredAttendees = json.data.filter(t => t && t.ticket_code && !delSet.has(t.ticket_code));
            const currentCodesHash = filteredAttendees.map(t => `${t.ticket_code}:${t.payment_status}:${t.day1_status}:${t.day2_status}`).join('|');
            if (currentCodesHash !== lastServerHash || incomingPing) {
              lastServerHash = currentCodesHash;
              onUpdateReceived(filteredAttendees, incomingPing);
            }
          }

          // Registration lock status
          if (json.registrationLocked !== undefined && json.registrationLocked !== null && json.registrationLocked !== lastLockState) {
            lastLockState = json.registrationLocked;
            if (onLockStatusReceived) {
              onLockStatusReceived(json.registrationLocked);
            }
          }

          // Activity log sync
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

  const startPolling = () => {
    if (pollInterval) clearInterval(pollInterval);
    pollInterval = setInterval(() => {
      if (typeof document !== 'undefined' && document.hidden) return;
      fetchVercelSync();
    }, 8500); // Balanced 8.5s interval: snappy real-time updates without overloading CDN
  };

  const handleActiveWake = () => {
    if (typeof document !== 'undefined') {
      if (!document.hidden) {
        fetchVercelSync();
        startPolling();
      } else if (pollInterval) {
        clearInterval(pollInterval);
        pollInterval = null;
      }
    }
  };

  if (typeof window !== 'undefined') {
    window.addEventListener('focus', handleActiveWake);
    document.addEventListener('visibilitychange', handleActiveWake);
  }

  fetchVercelSync();
  startPolling();

  return () => {
    if (bc) bc.close();
    if (pollInterval) clearInterval(pollInterval);
    if (typeof window !== 'undefined') {
      window.removeEventListener('focus', handleActiveWake);
      document.removeEventListener('visibilitychange', handleActiveWake);
    }
  };
}
