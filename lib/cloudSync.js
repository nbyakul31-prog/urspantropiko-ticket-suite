// URSPantropiko Clean Cross-Device Cloud Sync Engine
const VERCEL_API_URL = '/api/sync';
const CLIENT_ID = 'client_' + Math.random().toString(36).substring(2) + '_' + Date.now();

/**
 * Broadcasts an update across all open tabs, phones, and devices.
 */
export async function broadcastCloudUpdate(ticketsList, newEventPing = null) {
  // 1. Save to local storage
  try {
    localStorage.setItem('ursp_masterlist_attendees_v4', JSON.stringify(ticketsList));
  } catch (e) {}

  // 2. Broadcast to other local browser tabs (ignoring self)
  try {
    if (typeof BroadcastChannel !== 'undefined') {
      const bc = new BroadcastChannel('ursp_live_sync_channel');
      bc.postMessage({
        type: 'SYNC_TICKETS',
        tickets: ticketsList,
        ping: newEventPing,
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
        senderId: CLIENT_ID
      })
    }).catch(() => {});
  } catch (e) {}
}

/**
 * Listens for real-time cloud updates from other devices (phones, laptops, ushers)
 */
export function listenToCloudUpdates(onUpdateReceived) {
  let pollInterval = null;
  let lastServerHash = '';
  const mountTime = Date.now();

  // Method 1: Local Tab BroadcastChannel (Instant real-time sync across open tabs)
  let bc = null;
  try {
    if (typeof BroadcastChannel !== 'undefined') {
      bc = new BroadcastChannel('ursp_live_sync_channel');
      bc.onmessage = (e) => {
        // Ignore self-broadcasts or events created before this tab mounted
        if (e.data && e.data.senderId !== CLIENT_ID && e.data.tickets) {
          const isValidFreshPing = e.data.ping && (!e.data.timestamp || e.data.timestamp >= mountTime - 1000);
          onUpdateReceived(e.data.tickets, isValidFreshPing ? e.data.ping : null);
        }
      };
    }
  } catch (e) {}

  // Method 2: Controlled Polling from Vercel API every 4.5 seconds (gentle on CPU & rate limits)
  const fetchVercelSync = async () => {
    try {
      const res = await fetch(VERCEL_API_URL);
      if (res.ok) {
        const json = await res.json();
        if (json && json.data && Array.isArray(json.data) && json.data.length > 0) {
          const currentCodesHash = json.data.map(t => `${t.ticket_code}:${t.payment_status}:${t.day1_status}:${t.day2_status}`).join('|');
          if (currentCodesHash !== lastServerHash) {
            lastServerHash = currentCodesHash;
            // Silent list sync on poll (no ghost alerts on page load/poll)
            onUpdateReceived(json.data, null);
          }
        }
      }
    } catch (err) {}
  };

  fetchVercelSync();
  pollInterval = setInterval(fetchVercelSync, 4500);

  return () => {
    if (bc) bc.close();
    if (pollInterval) clearInterval(pollInterval);
  };
}
