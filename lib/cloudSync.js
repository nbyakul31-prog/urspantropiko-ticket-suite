// URSPantropiko Real-Time Cross-Device Cloud Sync Relay
const RELAY_TOPIC = 'urspantropiko_masterlist_relay_v2026';
const RELAY_SSE_URL = `https://ntfy.sh/${RELAY_TOPIC}/sse`;
const RELAY_PUB_URL = `https://ntfy.sh/${RELAY_TOPIC}`;
const VERCEL_API_URL = '/api/sync';

/**
 * Broadcasts an update across all open tabs, phones, and devices worldwide in real-time.
 */
export async function broadcastCloudUpdate(ticketsList, newEventPing = null) {
  // 1. Sync to local storage & BroadcastChannel
  try {
    localStorage.setItem('ursp_masterlist_attendees_v4', JSON.stringify(ticketsList));
    if (typeof BroadcastChannel !== 'undefined') {
      const bc = new BroadcastChannel('ursp_live_sync_channel');
      bc.postMessage({ type: 'SYNC_TICKETS', tickets: ticketsList, ping: newEventPing });
      bc.close();
    }
  } catch (e) {}

  // 2. Push to Vercel Serverless Sync API
  try {
    fetch(VERCEL_API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tickets: ticketsList, event: newEventPing })
    }).catch(() => {});
  } catch (e) {}

  // 3. Real-Time Global SSE Relay for Instant Phone -> PC sync (under 200ms)
  try {
    fetch(RELAY_PUB_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'MASTERLIST_SYNC',
        tickets: ticketsList,
        ping: newEventPing,
        timestamp: Date.now()
      })
    }).catch(() => {});
  } catch (e) {}
}

/**
 * Listens for real-time cloud updates from other devices (phones, laptops, ushers)
 */
export function listenToCloudUpdates(onUpdateReceived) {
  let eventSource = null;
  let pollInterval = null;

  // Method 1: Local Tab BroadcastChannel
  let bc = null;
  try {
    if (typeof BroadcastChannel !== 'undefined') {
      bc = new BroadcastChannel('ursp_live_sync_channel');
      bc.onmessage = (e) => {
        if (e.data && e.data.tickets) {
          onUpdateReceived(e.data.tickets, e.data.ping);
        }
      };
    }
  } catch (e) {}

  // Method 2: Global SSE Cloud Relay
  try {
    eventSource = new EventSource(RELAY_SSE_URL);
    eventSource.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data);
        if (payload && payload.message) {
          const inner = JSON.parse(payload.message);
          if (inner && inner.tickets && Array.isArray(inner.tickets)) {
            onUpdateReceived(inner.tickets, inner.ping);
          }
        } else if (payload && payload.tickets && Array.isArray(payload.tickets)) {
          onUpdateReceived(payload.tickets, payload.ping);
        }
      } catch (err) {}
    };
  } catch (err) {
    console.warn('SSE Relay fallback notice:', err);
  }

  // Method 3: Fallback Polling from Vercel API every 4 seconds
  const fetchVercelSync = async () => {
    try {
      const res = await fetch(VERCEL_API_URL);
      if (res.ok) {
        const json = await res.json();
        if (json && json.data && Array.isArray(json.data) && json.data.length > 0) {
          onUpdateReceived(json.data, null);
        }
      }
    } catch (err) {}
  };

  fetchVercelSync();
  pollInterval = setInterval(fetchVercelSync, 4000);

  return () => {
    if (bc) bc.close();
    if (eventSource) eventSource.close();
    if (pollInterval) clearInterval(pollInterval);
  };
}
