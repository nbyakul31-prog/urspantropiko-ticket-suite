// Serverless In-Memory Cloud Sync State for URSPantropiko Ticket Suite
// Synchronizes Attendees, Deletion Blacklist, Activity Logs, and Registration Lock in Real-Time

let cachedAttendees = [];
let cachedDeletedCodes = new Set();
let cachedRegistrationLocked = false;
let cachedActivityLog = [];

const MAX_LOG_ENTRIES = 1000;

function appendLogEntry(entry) {
  if (!entry || !entry.type) return;
  const logItem = {
    id: entry.id || `log_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
    type: entry.type,
    title: entry.title || '',
    message: entry.message || '',
    actor: entry.actor || 'System',
    device: entry.device || 'Unknown',
    department: entry.department || null,
    ticket_code: entry.ticket_code || null,
    timestamp: entry.timestamp || new Date().toISOString(),
    server_time: new Date().toISOString()
  };
  cachedActivityLog.unshift(logItem);
  if (cachedActivityLog.length > MAX_LOG_ENTRIES) {
    cachedActivityLog = cachedActivityLog.slice(0, MAX_LOG_ENTRIES);
  }
  return logItem;
}

export default function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method === 'POST' || req.method === 'PUT') {
    try {
      const data = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;

      // Handle recorded deletions (Blacklist)
      if (data && Array.isArray(data.deletedCodes)) {
        data.deletedCodes.forEach(code => {
          if (code) cachedDeletedCodes.add(String(code));
        });
      }
      if (data && data.deleteTicketCode) {
        cachedDeletedCodes.add(String(data.deleteTicketCode));
      }

      // Handle ticket list sync
      if (Array.isArray(data)) {
        cachedAttendees = data.filter(t => t && t.ticket_code && !cachedDeletedCodes.has(t.ticket_code));
      } else if (data && data.tickets && Array.isArray(data.tickets)) {
        cachedAttendees = data.tickets.filter(t => t && t.ticket_code && !cachedDeletedCodes.has(t.ticket_code));
      } else if (data && data.attendee && data.attendee.ticket_code) {
        cachedDeletedCodes.delete(data.attendee.ticket_code);
        cachedAttendees = [
          data.attendee,
          ...cachedAttendees.filter(a => a && a.ticket_code !== data.attendee.ticket_code && a.student_id !== data.attendee.student_id)
        ];
      }

      // Handle activity log entry addition
      if (data && data.logEntry) {
        appendLogEntry(data.logEntry);
      }

      // Handle activity log deletions (Gmail-like delete selected)
      if (data && Array.isArray(data.deleteLogIds) && data.deleteLogIds.length > 0) {
        const idSet = new Set(data.deleteLogIds);
        cachedActivityLog = cachedActivityLog.filter(l => l && !idSet.has(l.id));
      }

      // Handle clear all logs
      if (data && data.clearLogs === true) {
        cachedActivityLog = [];
      }

      // Handle bulk log sync
      if (data && Array.isArray(data.activityLog)) {
        data.activityLog.forEach(entry => appendLogEntry(entry));
      }

      if (data && typeof data.registrationLocked === 'boolean') {
        cachedRegistrationLocked = data.registrationLocked;
      }

      return res.status(200).json({
        success: true,
        count: cachedAttendees.length,
        data: cachedAttendees,
        deletedCodes: Array.from(cachedDeletedCodes),
        activityLog: cachedActivityLog,
        registrationLocked: cachedRegistrationLocked
      });
    } catch (e) {
      return res.status(400).json({ error: 'Invalid JSON body' });
    }
  }

  // GET: Return current sync state
  return res.status(200).json({
    success: true,
    data: (cachedAttendees || []).filter(t => t && t.ticket_code && !cachedDeletedCodes.has(t.ticket_code)),
    deletedCodes: Array.from(cachedDeletedCodes),
    activityLog: cachedActivityLog || [],
    registrationLocked: cachedRegistrationLocked
  });
}
