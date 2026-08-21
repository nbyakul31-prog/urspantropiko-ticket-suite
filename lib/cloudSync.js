// URSPantropiko Clean Cross-Device Cloud Sync
const VERCEL_API_URL = '/api/sync';
const CLIENT_ID = 'client_' + Math.random().toString(36).substring(2) + '_' + Date.now();

/**
 * Broadcasts an update across all open tabs, phones, and devices.
 */
export async function broadcastCloudUpdate(ticketsList, newEventPing = null) {
  // 1. Sync to local storage
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
        senderId: CLIENT_ID
      });
      bc.close();
    }
  } catch (e) {}

  // 3. Push to Vercel Serverless Sync API
  try {
    await fetch(VERCEL_API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tickets: ticketsList,
        event: newEventPing,
        senderId: CLIENT_ID,
        timestamp: Date.now()
      })
    });
  } catch (e) {}
}

/**
 * Listens for real-time cloud updates from other devices (phones, laptops, ushers)
 */
export function listenToCloudUpdates(onUpdateReceived) {
  let pollInterval = null;
  let lastServerHash = '';

  // Method 1: Local Tab BroadcastChannel
  let bc = null;
  try {
    if (typeof BroadcastChannel !== 'undefined') {
      bc = new BroadcastChannel('ursp_live_sync_channel');
      bc.onmessage = (e) => {
        // Ignore self-broadcasts to prevent infinite echo loops
        if (e.data && e.data.senderId !== CLIENT_ID && e.data.tickets) {
          onUpdateReceived(e.data.tickets, e.data.ping);
        }
      };
    }
  } catch (e) {}

  // Method 2: Smart Polling from Vercel API every 3.5 seconds
  const fetchVercelSync = async () => {
    try {
      const res = await fetch(VERCEL_API_URL);
      if (res.ok) {
        const json = await res.json();
        if (json && json.data && Array.isArray(json.data) && json.data.length > 0) {
          // Avoid re-triggering if server data hasn't changed
          const currentCodesHash = json.data.map(t => `${t.ticket_code}:${t.payment_status}:${t.day1_status}:${t.day2_status}`).join('|');
          if (currentCodesHash !== lastServerHash) {
            lastServerHash = currentCodesHash;
            // Only forward event if not sent by this client
            const eventToForward = (json.senderId !== CLIENT_ID) ? json.event : null;
            onUpdateReceived(json.data, eventToForward);
          }
        }
      }
    } catch (err) {}
  };

  fetchVercelSync();
  pollInterval = setInterval(fetchVercelSync, 3500);

  return () => {
    if (bc) bc.close();
    if (pollInterval) clearInterval(pollInterval);
  };
}
