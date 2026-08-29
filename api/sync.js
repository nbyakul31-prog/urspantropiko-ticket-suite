// Serverless In-Memory & /tmp Disk-Cached Cloud Sync State for URSPantropiko Ticket Suite
import fs from 'fs';
import path from 'path';

const DB_FILE = path.join('/tmp', 'ursp_sync_db.json');
const MAX_LOG_ENTRIES = 1000;

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
  initialized: false
};

function getState() {
  if (!memoryState.initialized) {
    const disk = readDiskCache();
    if (disk && Array.isArray(disk.attendees)) {
      memoryState.attendees = disk.attendees;
      memoryState.activityLog = disk.activityLog || [];
      memoryState.registrationLocked = !!disk.registrationLocked;
      memoryState.initialized = true;
    }
  }
  return memoryState;
}

function persistState(updater) {
  const current = getState();
  updater(current);
  current.initialized = true;
  writeDiskCache(current);
  return current;
}

function appendLogEntry(state, entry) {
  if (!entry || !entry.type) return;
  const entryId = entry.id || `log_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;

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
        // Handle full ticket list sync (authoritative from client)
        if (Array.isArray(data)) {
          s.attendees = data.filter(t => t && t.ticket_code);
        } else if (data && data.tickets && Array.isArray(data.tickets)) {
          s.attendees = data.tickets.filter(t => t && t.ticket_code);
        } else if (data && data.attendee && data.attendee.ticket_code) {
          s.attendees = [
            data.attendee,
            ...s.attendees.filter(a => a && a.ticket_code !== data.attendee.ticket_code && a.student_id !== data.attendee.student_id)
          ];
        }

        // Handle activity log entry addition
        if (data && data.logEntry) {
          appendLogEntry(s, data.logEntry);
        }

        // Handle activity log deletions (Gmail-like delete selected)
        if (data && Array.isArray(data.deleteLogIds) && data.deleteLogIds.length > 0) {
          const idSet = new Set(data.deleteLogIds);
          s.activityLog = s.activityLog.filter(l => l && !idSet.has(l.id));
        }

        // Handle clear all logs
        if (data && data.clearLogs === true) {
          s.activityLog = [];
        }

        // Handle bulk log sync
        if (data && Array.isArray(data.activityLog)) {
          data.activityLog.forEach(entry => appendLogEntry(s, entry));
        }

        if (data && typeof data.registrationLocked === 'boolean') {
          s.registrationLocked = data.registrationLocked;
        }
      });

      return res.status(200).json({
        success: true,
        count: state.attendees.length,
        data: state.attendees,
        activityLog: state.activityLog,
        registrationLocked: state.registrationLocked
      });
    } catch (e) {
      return res.status(400).json({ error: 'Invalid JSON body' });
    }
  }

  // GET: Return current sync state
  return res.status(200).json({
    success: true,
    count: state.attendees.length,
    data: state.attendees,
    activityLog: state.activityLog,
    registrationLocked: state.registrationLocked
  });
}
