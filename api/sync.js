// Serverless In-Memory & /tmp Disk-Cached Cloud Sync State for URSPantropiko Ticket Suite
import fs from 'fs';
import path from 'path';

const DB_FILE = path.join('/tmp', 'ursp_sync_db.json');
const MAX_LOG_ENTRIES = 1000;

function isRealAttendee(t) {
  if (!t || typeof t !== 'object' || !t.ticket_code) return false;
  const code = String(t.ticket_code).toUpperCase();
  if (code.startsWith('TKT-') || code.startsWith('MOCK-') || code.startsWith('DEMO-')) return false;
  return true;
}

function readDiskCache() {
  try {
    if (fs.existsSync(DB_FILE)) {
      const raw = fs.readFileSync(DB_FILE, 'utf8');
      if (raw) {
        return JSON.parse(raw);
      }
    }
  } catch (e) {}
  return null;
}

function writeDiskCache(state) {
  try {
    fs.writeFileSync(DB_FILE, JSON.stringify(state));
  } catch (e) {}
}

// In-memory process cache fallback
let memoryState = {
  attendees: [],
  activityLog: [],
  registrationLocked: false,
  latestPing: null,
  deletedCodes: [],
  deletedLogIds: [],
  version: 1,
  lastModified: Date.now(),
  initialized: false
};

function getState() {
  if (!memoryState.initialized) {
    const disk = readDiskCache();
    if (disk && Array.isArray(disk.attendees)) {
      memoryState.deletedCodes = Array.isArray(disk.deletedCodes) ? disk.deletedCodes : [];
      memoryState.deletedLogIds = Array.isArray(disk.deletedLogIds) ? disk.deletedLogIds : [];
      memoryState.attendees = disk.attendees.filter(t => isRealAttendee(t) && !memoryState.deletedCodes.includes(t.ticket_code));
      const logDelSet = new Set(memoryState.deletedLogIds);
      memoryState.activityLog = (disk.activityLog || []).filter(l => l && l.id && !logDelSet.has(l.id));
      memoryState.registrationLocked = !!disk.registrationLocked;
      memoryState.latestPing = disk.latestPing || null;
      memoryState.version = typeof disk.version === 'number' ? disk.version : 1;
      memoryState.lastModified = disk.lastModified || Date.now();
      memoryState.initialized = true;
    }
  }
  const delSet = new Set(memoryState.deletedCodes || []);
  const logDelSet = new Set(memoryState.deletedLogIds || []);
  memoryState.attendees = (memoryState.attendees || []).filter(t => isRealAttendee(t) && !delSet.has(t.ticket_code));
  memoryState.activityLog = (memoryState.activityLog || []).filter(l => l && l.id && !logDelSet.has(l.id));
  return memoryState;
}

function persistState(updater) {
  const current = getState();
  updater(current);
  current.version = (current.version || 0) + 1;
  current.lastModified = Date.now();
  current.initialized = true;
  writeDiskCache(current);
  return current;
}

function appendLogEntry(state, entry) {
  if (!entry || !entry.type) return;
  const entryId = entry.id || `log_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
  entry.id = entryId;

  // 0. Do not append if blacklisted in deletedLogIds
  if (state.deletedLogIds && state.deletedLogIds.includes(entryId)) return;

  // 1. Deduplicate by exact ID
  if (state.activityLog.some(l => l && l.id === entryId)) return;

  // 2. Deduplicate by semantic action signature within 15 seconds (distinguishing day1 vs day2)
  const isDuplicate = state.activityLog.some(l => {
    if (!l) return false;
    if (l.type !== entry.type) return false;
    if (entry.title && l.title && entry.title !== l.title) return false; // Different day/action
    if (entry.ticket_code && l.ticket_code === entry.ticket_code) {
      const diff = Math.abs(new Date(l.timestamp || 0).getTime() - new Date(entry.timestamp || Date.now()).getTime());
      return diff < 15000;
    }
    return false;
  });
  if (isDuplicate) return;

  const logItem = {
    id: entryId,
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
  state.activityLog.unshift(logItem);
  if (state.activityLog.length > MAX_LOG_ENTRIES) {
    state.activityLog = state.activityLog.slice(0, MAX_LOG_ENTRIES);
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

  const state = getState();

  if (req.method === 'POST' || req.method === 'PUT') {
    try {
      const data = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;

      persistState(s => {
        // Handle database reset
        if (data && (data.resetDatabase === true || data.cleanDatabase === true || data.purgeDummy === true)) {
          s.attendees = [];
          s.activityLog = [];
          s.latestPing = null;
          s.deletedCodes = [];
        }

        // Handle deleted ticket codes (tombstones)
        if (data && Array.isArray(data.deletedTicketCodes) && data.deletedTicketCodes.length > 0) {
          s.deletedCodes = Array.from(new Set([...(s.deletedCodes || []), ...data.deletedTicketCodes]));
        }
        const delSet = new Set(s.deletedCodes || []);

        // Handle attendee registration or update
        if (data && data.attendee && data.attendee.ticket_code && isRealAttendee(data.attendee) && !delSet.has(data.attendee.ticket_code)) {
          const newAtt = data.attendee;
          s.attendees = [
            newAtt,
            ...s.attendees.filter(a => a && a.ticket_code !== newAtt.ticket_code && a.student_id !== newAtt.student_id)
          ].filter(t => isRealAttendee(t) && !delSet.has(t.ticket_code));
        } else if (data && (Array.isArray(data) || (data.tickets && Array.isArray(data.tickets)))) {
          const incomingList = Array.isArray(data) ? data : data.tickets;
          const incomingReal = incomingList.filter(t => isRealAttendee(t) && !delSet.has(t.ticket_code));

          // Non-destructive Union Merge: Keep existing registered students on server
          const map = new Map();
          s.attendees.forEach(a => {
            if (a && a.ticket_code && !delSet.has(a.ticket_code)) map.set(a.ticket_code, a);
          });
          incomingReal.forEach(a => {
            if (!a || !a.ticket_code) return;
            const existing = map.get(a.ticket_code);
            if (existing) {
              map.set(a.ticket_code, {
                ...existing,
                ...a,
                payment_status: (a.payment_status === 'paid' || existing.payment_status === 'paid') ? 'paid' : (a.payment_status || existing.payment_status || 'unpaid'),
                day1_status: (a.day1_status === 'attended' || existing.day1_status === 'attended') ? 'attended' : 'not_attended',
                day2_status: (a.day2_status === 'attended' || existing.day2_status === 'attended') ? 'attended' : 'not_attended'
              });
            } else {
              map.set(a.ticket_code, a);
            }
          });
          s.attendees = Array.from(map.values());
        }

        // Handle activity log entry addition
        if (data && data.logEntry) {
          appendLogEntry(s, data.logEntry);
        }

        // Handle activity log deletions (Gmail-like delete selected)
        if (data && Array.isArray(data.deleteLogIds) && data.deleteLogIds.length > 0) {
          s.deletedLogIds = Array.from(new Set([...(s.deletedLogIds || []), ...data.deleteLogIds]));
          const idSet = new Set(s.deletedLogIds);
          s.activityLog = s.activityLog.filter(l => l && !idSet.has(l.id));
        }

        // Handle clear all logs
        if (data && data.clearLogs === true) {
          s.activityLog = [];
          s.deletedLogIds = [];
        }

        // Handle bulk log sync
        if (data && Array.isArray(data.activityLog)) {
          data.activityLog.forEach(entry => appendLogEntry(s, entry));
        }

        // Handle live event ping (for cross-device popup toasts)
        if (data && data.ping) {
          s.latestPing = {
            ...data.ping,
            senderId: data.senderId || null,
            timestamp: Date.now()
          };
        }

        if (data && typeof data.registrationLocked === 'boolean') {
          s.registrationLocked = data.registrationLocked;
        }
      });

      // Return lightweight acknowledgement for registration/log writes to save 99% outgoing bandwidth
      const isLightweight = (data && (data.attendee || data.logEntry || data.ping || data.deleteLogIds)) || req.query?.light === 'true';
      const wantFull = req.query?.full === 'true' || (data && Array.isArray(data.tickets) && !data.attendee);

      if (isLightweight && !wantFull) {
        return res.status(200).json({
          success: true,
          count: state.attendees.length,
          registrationLocked: state.registrationLocked,
          latestPing: state.latestPing,
          version: state.version,
          deletedCodes: state.deletedCodes || []
        });
      }

      const etag = `"${state.version || 1}_${state.attendees.length}_${(state.activityLog || []).length}_${state.registrationLocked ? 1 : 0}_${state.latestPing?.timestamp || 0}"`;
      res.setHeader('ETag', etag);

      return res.status(200).json({
        success: true,
        count: state.attendees.length,
        version: state.version,
        data: state.attendees,
        activityLog: state.activityLog,
        registrationLocked: state.registrationLocked,
        latestPing: state.latestPing,
        deletedCodes: state.deletedCodes || []
      });
    } catch (e) {
      return res.status(400).json({ error: 'Invalid JSON body' });
    }
  }

  // Fast lightweight query for registration lock check
  if (req.query && (req.query.field === 'lock' || req.query.lock === 'true')) {
    return res.status(200).json({
      success: true,
      registrationLocked: state.registrationLocked
    });
  }

  // GET: Return current sync state with ETag conditional 304 Not Modified
  const etag = `"${state.version || 1}_${state.attendees.length}_${(state.activityLog || []).length}_${state.registrationLocked ? 1 : 0}_${state.latestPing?.timestamp || 0}"`;
  res.setHeader('ETag', etag);
  // Edge CDN caching: Vercel Edge serves cached copies across devices, cutting Origin computation by 80%
  res.setHeader('Cache-Control', 'public, max-age=0, s-maxage=2, stale-while-revalidate=4');

  if (req.headers['if-none-match'] === etag) {
    return res.status(304).end();
  }

  // Return last 30 logs by default to keep payload ultra-compact, or full history if requested
  const returnFullLogs = req.query && (req.query.logs === 'all' || req.query.logs === 'true');
  const logsToReturn = returnFullLogs ? state.activityLog : (state.activityLog || []).slice(0, 30);

  return res.status(200).json({
    success: true,
    count: state.attendees.length,
    version: state.version,
    data: state.attendees,
    activityLog: logsToReturn,
    registrationLocked: state.registrationLocked,
    latestPing: state.latestPing,
    deletedCodes: state.deletedCodes || []
  });
}
