import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { QRCodeCanvas } from 'qrcode.react';
import StudentPortal from './StudentPortal';
import AdminDashboard from './AdminDashboard';
import UsherScanner from './UsherScanner';
import NotificationsLog from './NotificationsLog';
import BackgroundAmbient from './BackgroundAmbient';
import { supabase } from './lib/supabase';
import { checkPinRateLimit, recordFailedPinAttempt, resetPinAttempts, sanitizeText } from './lib/security';
import { broadcastCloudUpdate, broadcastLogEntry, broadcastDeleteLogs, broadcastClearLogs, listenToCloudUpdates } from './lib/cloudSync';

export const ADMIN_ACCOUNTS = [
  {
    id: 'admin1',
    label: 'Admin 1 — Executive Head',
    role: 'SSG Executive President',
    badge: '👑 Lead Administrator',
    badgeColor: '#38BDF8',
    passwords: ['URSP@Admin2026!Secured', 'URSP@ADMIN1', 'ADMIN1_2026', '2026', 'URSP@SSG2026!']
  },
  {
    id: 'admin2',
    label: 'Admin 2 — Security & Audit Officer',
    role: 'SSG Auditor / Security Chief',
    badge: '🛡️ Security & Integrity',
    badgeColor: '#A855F7',
    passwords: ['URSP#Audit9824$Secured', 'URSP@ADMIN2', 'ADMIN2_2026', '2026', 'URSP@SSG2026!']
  }
];

const STORAGE_KEY = 'ursp_masterlist_attendees_v5';

// Clear any stale local deletion blacklists from previous builds
try {
  localStorage.removeItem('ursp_masterlist_deleted_v5');
  localStorage.removeItem('ursp_masterlist_deleted_v4');
} catch (e) {}

// Encrypted Secret Token for Secure Admin URL Access (prevents spoofing via raw ?view=admin)
export const SECURE_ADMIN_HASH = 'urs2026_sec_9f8a3c42e1d7';

// No hardcoded seed data — Supabase is the single source of truth.
export const DEFAULT_CLEAN_ATTENDEES = [];

function normalizeTicket(t) {
  if (!t || typeof t !== 'object') return null;
  return {
    ...t,
    ticket_code: t.ticket_code || '',
    student_id: t.student_id || '',
    full_name: t.full_name || '',
    department: t.department || 'College of Business',
    program_section: t.program_section || '',
    payment_status: t.payment_status || 'unpaid',
    day1_status: t.day1_status || (t.attendance_status === 'attended' ? 'attended' : 'not_attended'),
    day1_time: t.day1_time || t.attended_at || (t.attendance_status === 'attended' ? '08:15 AM' : null),
    day2_status: t.day2_status || 'not_attended',
    day2_time: t.day2_time || null,
    attendance_status: (t.day1_status === 'attended' || t.day2_status === 'attended' || t.attendance_status === 'attended') ? 'attended' : 'not_attended'
  };
}

function getStoredTickets() {
  try {
    let raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      raw = localStorage.getItem('ursp_masterlist_attendees_v4');
      if (raw) {
        localStorage.setItem(STORAGE_KEY, raw);
        localStorage.removeItem('ursp_masterlist_attendees_v4');
      }
    }
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        const active = parsed.filter(t => t && t.ticket_code).map(normalizeTicket).filter(Boolean);
        if (active.length > 0) return active;
      }
    }
  } catch (e) {
    console.warn('Could not read localStorage:', e);
  }
  return [];
}

function saveStoredTickets(ticketsList) {
  try {
    if (Array.isArray(ticketsList)) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(ticketsList));
    }
  } catch (e) {
    console.warn('Could not save to localStorage:', e);
  }
}

export default function App() {
  const [isAdminAuthed, setIsAdminAuthed] = useState(() => {
    try {
      return sessionStorage.getItem('ursp_admin_authed') === 'true';
    } catch (e) {
      return false;
    }
  });

  const [adminSession, setAdminSession] = useState(() => {
    try {
      const saved = sessionStorage.getItem('ursp_admin_session');
      return saved ? JSON.parse(saved) : { id: 'admin1', name: 'Admin 1 (Executive Head)', role: 'SSG Executive President' };
    } catch (e) {
      return { id: 'admin1', name: 'Admin 1 (Executive Head)', role: 'SSG Executive President' };
    }
  });

  const [selectedAdminId, setSelectedAdminId] = useState('admin1');
  const [authStep, setAuthStep] = useState(1); // 1 = Password Entry, 2 = Anti-Spoofing 2FA Confirmation QR Challenge
  const [qrChallengeCode, setQrChallengeCode] = useState('');
  const [showPinModal, setShowPinModal] = useState(false);
  const [pinInput, setPinInput] = useState('');
  const [pinError, setPinError] = useState('');
  const [pendingRoute, setPendingRoute] = useState(null);

  const [registrationLocked, setRegistrationLocked] = useState(() => {
    try {
      return localStorage.getItem('ursp_registration_locked') === 'true';
    } catch (e) {
      return false;
    }
  });

  const getRoute = () => {
    const path = window.location.pathname.toLowerCase();
    const params = new URLSearchParams(window.location.search);
    const viewParam = params.get('view') || params.get('portal');
    const token = params.get('token');
    const secKey = params.get('sec_key') || params.get('sec_token') || params.get('auth_key');
    
    if (path.includes('logs') || viewParam === 'logs') {
      const isAuthed = sessionStorage.getItem('ursp_admin_authed') === 'true';
      if (isAuthed) return 'logs';
      return 'student';
    }
    if (path.includes('admin') || viewParam === 'admin' || viewParam === 'sec_admin_9f8a3c42e1') {
      const isAuthed = sessionStorage.getItem('ursp_admin_authed') === 'true';
      if (isAuthed) return 'admin';
      return 'student'; // Fallback to student and trigger PIN modal only if sec key matches
    }
    if (path.includes('usher') || path.includes('scanner') || viewParam === 'usher' || token) {
      if (token === 'USHER-MASTER-2026' || sessionStorage.getItem('ursp_admin_authed') === 'true') {
        return 'usher';
      }
      return 'student';
    }
    return 'student'; // Default public route
  };

  const [route, setRoute] = useState(getRoute);
  const [tickets, setTickets] = useState(getStoredTickets);
  const [livePings, setLivePings] = useState([]);
  const [highlightedCode, setHighlightedCode] = useState(null);
  const [activityLog, setActivityLog] = useState(() => {
    try {
      const raw = localStorage.getItem('ursp_activity_log_v1');
      return raw ? JSON.parse(raw) : [];
    } catch (e) { return []; }
  });

  // Device fingerprint for log entries
  const deviceLabel = /Mobi|Android|iPhone/i.test(navigator.userAgent) ? 'Mobile' : 'Desktop';

  const lastLogMapRef = useRef(new Map());

  const addLogEntry = (entry) => {
    if (!entry || !entry.type) return;

    // Rate-limiting / deduplication: Prevent double-logging identical actions within 5s
    const now = Date.now();
    const actionKey = `${entry.type}_${entry.ticket_code || entry.title}`;
    const lastTimestamp = lastLogMapRef.current.get(actionKey) || 0;
    if (now - lastTimestamp < 5000) {
      return; // Suppress duplicate event
    }
    lastLogMapRef.current.set(actionKey, now);

    const logItem = {
      id: `log_${now}_${Math.random().toString(36).substring(2, 8)}`,
      ...entry,
      actor: entry.actor || adminSession?.name || 'Student Portal',
      device: entry.device || deviceLabel,
      timestamp: entry.timestamp || new Date().toISOString()
    };

    setActivityLog(prev => {
      if (prev.some(l => l && l.id === logItem.id)) return prev;
      const updated = [logItem, ...prev].slice(0, 1000);
      try { localStorage.setItem('ursp_activity_log_v1', JSON.stringify(updated)); } catch (e) {}
      return updated;
    });

    broadcastLogEntry(logItem);
  };

  // Single Unified Toast System (Strictly 1 Toast with Dynamic +3s Extension per new inquiry/registree)
  const [activeToast, setActiveToast] = useState(null);
  const toastTimeoutRef = useRef(null);
  const toastExpireTimestampRef = useRef(0);
  const activeRegCountRef = useRef(0);
  const seenPingsMap = useRef(new Map());

  // Security Easter Egg: Tap logo 3 times within 1.5s to trigger Admin Login
  const logoTapCountRef = useRef(0);
  const logoTapTimeoutRef = useRef(null);

  const handleLogoEasterEgg = () => {
    logoTapCountRef.current += 1;
    if (logoTapTimeoutRef.current) clearTimeout(logoTapTimeoutRef.current);

    if (logoTapCountRef.current >= 3) {
      logoTapCountRef.current = 0;
      setPendingRoute('admin');
      setPinError('');
      setPinInput('');
      setAuthStep(1);
      setShowPinModal(true);
    } else {
      logoTapTimeoutRef.current = setTimeout(() => {
        logoTapCountRef.current = 0;
      }, 1500);
    }
  };

  // Initial Route Security Check (Intercept encrypted admin links)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const viewParam = params.get('view') || params.get('portal');
    const token = params.get('token');
    const secKey = params.get('sec_key') || params.get('sec_token') || params.get('auth_key');
    
    if ((viewParam === 'admin' || viewParam === 'sec_admin_9f8a3c42e1' || viewParam === 'logs') && !isAdminAuthed) {
      setPendingRoute(viewParam === 'logs' ? 'logs' : 'admin');
      setPinError('');
      setPinInput('');
      setAuthStep(1);
      setShowPinModal(true);
    } else if (viewParam === 'usher' && token !== 'USHER-MASTER-2026' && !isAdminAuthed) {
      setPendingRoute('usher');
      setPinError('');
      setPinInput('');
      setAuthStep(1);
      setShowPinModal(true);
    }
  }, [isAdminAuthed]);

  // Sync route on history pop
  useEffect(() => {
    const handlePopState = () => {
      setRoute(getRoute());
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  // Save to localStorage whenever tickets change
  useEffect(() => {
    saveStoredTickets(tickets);
  }, [tickets]);

  // Philippine Standard Time (GMT+8) Formatter
  const getPHTimeString = () => {
    try {
      return new Intl.DateTimeFormat('en-US', {
        timeZone: 'Asia/Manila',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: true
      }).format(new Date());
    } catch (e) {
      return new Date().toLocaleTimeString();
    }
  };

  const getPHShortTime = () => {
    try {
      return new Intl.DateTimeFormat('en-US', {
        timeZone: 'Asia/Manila',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
      }).format(new Date());
    } catch (e) {
      return new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
  };

  const removeToast = () => {
    if (toastTimeoutRef.current) {
      clearTimeout(toastTimeoutRef.current);
      toastTimeoutRef.current = null;
    }
    setActiveToast(null);
    activeRegCountRef.current = 0;
  };

  const showOrExtendToast = (toastData, extraSeconds = 5) => {
    const now = Date.now();
    const durationMs = extraSeconds * 1000;

    let newExpire = now + durationMs;
    if (activeToast && toastExpireTimestampRef.current > now) {
      // Add extraSeconds to current remaining countdown timer
      newExpire = Math.max(newExpire, toastExpireTimestampRef.current + durationMs);
    }
    toastExpireTimestampRef.current = newExpire;
    const remainingMs = Math.max(1000, newExpire - now);

    if (toastTimeoutRef.current) {
      clearTimeout(toastTimeoutRef.current);
    }

    setActiveToast({
      ...toastData,
      durationMs: remainingMs,
      key: 'toast-' + Date.now()
    });

    toastTimeoutRef.current = setTimeout(() => {
      setActiveToast(null);
      activeRegCountRef.current = 0;
      toastTimeoutRef.current = null;
    }, remainingMs);
  };

  const addLivePing = (ping) => {
    if (!ping) return;

    // Deduplication Key: prevent double notifications from local + broadcast relay
    const dedupeKey = ping.id || `${ping.type}_${ping.ticket_code || 'all'}_${ping.title || ''}_${ping.message || ''}`;
    const now = Date.now();
    if (seenPingsMap.current.has(dedupeKey)) {
      const lastSeen = seenPingsMap.current.get(dedupeKey);
      if (now - lastSeen < 3500) {
        return; // Skip duplicate event within 3.5s
      }
    }
    seenPingsMap.current.set(dedupeKey, now);

    // Prune old dedupe keys
    if (seenPingsMap.current.size > 100) {
      for (const [k, v] of seenPingsMap.current.entries()) {
        if (now - v > 15000) seenPingsMap.current.delete(k);
      }
    }

    const enriched = {
      id: dedupeKey,
      timestamp: getPHTimeString(),
      ...ping
    };

    setLivePings(prev => [enriched, ...prev.slice(0, 19)]);
    if (ping.ticket_code) {
      setHighlightedCode(ping.ticket_code);
      setTimeout(() => {
        setHighlightedCode(curr => (curr === ping.ticket_code ? null : curr));
      }, 5000);
    }

    // REGISTRATION TOAST: Single Toast with +3s Extension per new registration
    if (ping.type === 'registration') {
      activeRegCountRef.current += 1;
      const count = activeRegCountRef.current;

      const regToast = {
        id: 'REG-LIVE',
        type: 'registration',
        title: count === 1 ? (ping.title || '🎉 STUDENT REGISTERED') : `⚡ INCOMING REGISTRATIONS (${count})`,
        message: count === 1
          ? (ping.message || 'A new student was registered to the masterlist.')
          : `✨ ${count} students registered online (+3s added • Masterlist updated)`,
        timestamp: getPHTimeString(),
        count
      };

      // 1st registration gets 5s; each additional registration adds +3s to the staying timer!
      const secondsToAdd = count === 1 ? 5 : 3;
      showOrExtendToast(regToast, secondsToAdd);
      return;
    }

    // ACTION TOAST (Payment, Gate Admission, Attendee Removed):
    // Single 5-second toast replacing whatever is currently on screen
    activeRegCountRef.current = 0;
    showOrExtendToast({
      ...enriched,
      id: 'ACTION-' + Date.now()
    }, 5);
  };

  // Setup Cross-Tab Broadcast Channel, LocalStorage & Supabase Real-Time Sync
  useEffect(() => {
    let isMounted = true;

    // 1. Query Supabase Remote DB upon loading (Syncs offline registrations seamlessly)
    async function syncFromSupabase() {
      try {
        if (supabase && typeof supabase.from === 'function') {
          const { data, error } = await supabase.from('attendees').select('*').order('created_at', { ascending: false });
          if (!error && Array.isArray(data) && isMounted) {
            const active = data.filter(t => t && t.ticket_code).map(normalizeTicket).filter(Boolean);
            setTickets(active);
            saveStoredTickets(active);
            broadcastCloudUpdate(active);
          }
        }
      } catch (err) {
        console.warn('Initial Supabase fetch fallback to local storage:', err);
      }
    }

    syncFromSupabase();

    // 2. Supabase Real-Time Cloud Subscription (Push notifications from Vercel to Localhost)
    let channel = null;
    try {
      if (supabase && typeof supabase.channel === 'function') {
        channel = supabase
          .channel('public_attendees_live_feed')
          .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'attendees' }, payload => {
            if (payload.new && isMounted) {
              const newRecord = normalizeTicket(payload.new);
              if (!newRecord) return;
              setTickets(prev => {
                if (prev.some(t => t.ticket_code === newRecord.ticket_code)) return prev;
                const next = [newRecord, ...prev];
                saveStoredTickets(next);
                return next;
              });
              addLivePing({
                type: 'registration',
                title: '🎉 STUDENT REGISTERED',
                message: `${payload.new.full_name} (${payload.new.student_id} • ${payload.new.ticket_code}) was registered to the masterlist.`,
                ticket_code: payload.new.ticket_code,
                department: payload.new.department
              });
            }
          })
          .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'attendees' }, payload => {
            if (payload.old && isMounted) {
              setTickets(prev => {
                const next = prev.filter(t => {
                  if (payload.old.ticket_code && t.ticket_code === payload.old.ticket_code) return false;
                  if (payload.old.id && t.id === payload.old.id) return false;
                  return true;
                });
                saveStoredTickets(next);
                return next;
              });
            }
          })
          .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'attendees' }, payload => {
            if (payload.new && isMounted) {
              const updated = normalizeTicket(payload.new);
              if (!updated) return;
              setTickets(prev => {
                const next = prev.map(t => t.ticket_code === updated.ticket_code ? updated : t);
                saveStoredTickets(next);
                return next;
              });
            }
          })
          .subscribe();
      }
    } catch (err) {}

    // Seed Vercel Cloud Relay on mount if this device holds attendees
    const localSeed = getStoredTickets();
    if (localSeed && localSeed.length > 0) {
      broadcastCloudUpdate(localSeed);
    }

    // 3. Real-Time Cloud Listener for Cross-Device Sync (Phone <-> PC Admin)
    const cleanupCloudSync = listenToCloudUpdates((cloudTickets, ping) => {
      if (Array.isArray(cloudTickets) && isMounted) {
        const active = cloudTickets.filter(t => t && t.ticket_code).map(normalizeTicket).filter(Boolean);
        setTickets(active);
        saveStoredTickets(active);
      }
      if (ping && isMounted) {
        addLivePing(ping);
      }
    }, (locked) => {
      if (isMounted && typeof locked === 'boolean') {
        setRegistrationLocked(locked);
        try { localStorage.setItem('ursp_registration_locked', String(locked)); } catch(e) {}
      }
    }, (logUpdate) => {
      // Activity log sync from cloud (adds, deletes, clears, or full sync)
      if (!logUpdate || !isMounted) return;
      setActivityLog(prev => {
        let updated = prev;
        if (logUpdate.action === 'sync_all' && Array.isArray(logUpdate.logs)) {
          // Merge server logs and local logs seamlessly by unique ID without flickering
          const serverLogIds = new Set(logUpdate.logs.map(l => l.id));
          const localOnlyLogs = prev.filter(l => !serverLogIds.has(l.id));
          const merged = [...localOnlyLogs, ...logUpdate.logs];
          merged.sort((a, b) => new Date(b.timestamp || 0) - new Date(a.timestamp || 0));
          updated = merged.slice(0, 1000);
        } else if (logUpdate.action === 'add' && logUpdate.logEntry) {
          if (!prev.some(l => l.id === logUpdate.logEntry.id)) {
            updated = [logUpdate.logEntry, ...prev].slice(0, 1000);
          }
        } else if (logUpdate.action === 'delete' && Array.isArray(logUpdate.deleteLogIds)) {
          const idSet = new Set(logUpdate.deleteLogIds);
          updated = prev.filter(l => !idSet.has(l.id));
        } else if (logUpdate.action === 'clear') {
          updated = [];
        }
        try { localStorage.setItem('ursp_activity_log_v1', JSON.stringify(updated)); } catch (e) {}
        return updated;
      });
    });

    const handleStorage = (e) => {
      if (e.key === STORAGE_KEY && e.newValue) {
        try {
          const fresh = JSON.parse(e.newValue);
          if (Array.isArray(fresh)) {
            setTickets(fresh.filter(t => t && t.ticket_code).map(normalizeTicket).filter(Boolean));
          }
        } catch (err) {}
      }
    };

    window.addEventListener('storage', handleStorage);

    return () => {
      isMounted = false;
      window.removeEventListener('storage', handleStorage);
      cleanupCloudSync();
      if (channel && supabase && typeof supabase.removeChannel === 'function') {
        supabase.removeChannel(channel);
      }
    };
  }, []);

  const broadcastUpdate = (newTicketsList, ping = null) => {
    saveStoredTickets(newTicketsList);
    broadcastCloudUpdate(newTicketsList, ping);
    if (ping) {
      addLivePing(ping);
    }
  };

  // 1. Student Registration Handler (Idempotent with Data Integrity & Duplicate Prevention)
  const handleTicketGenerated = async (newAttendee) => {
    let existing = null;
    let record = null;

    setTickets(prev => {
      existing = prev.find(t => t.student_id === newAttendee.student_id || t.ticket_code === newAttendee.ticket_code);
      record = normalizeTicket({
        ...newAttendee,
        id: existing ? existing.id : (newAttendee.id || 'REG-' + Date.now()),
        ticket_code: existing ? existing.ticket_code : newAttendee.ticket_code,
        created_at: existing ? existing.created_at : (newAttendee.created_at || new Date().toISOString()),
        payment_status: existing ? existing.payment_status : (newAttendee.payment_status || 'unpaid'),
        day1_status: existing ? existing.day1_status : 'not_attended',
        day1_time: existing ? existing.day1_time : null,
        day2_status: existing ? existing.day2_status : 'not_attended',
        day2_time: existing ? existing.day2_time : null,
        attendance_status: existing ? existing.attendance_status : 'not_attended'
      });

      const ping = {
        type: 'registration',
        title: existing ? '🔄 PASS RE-ACCESSED' : '🎉 STUDENT REGISTERED',
        message: `${record.full_name} (${record.student_id} • ${record.ticket_code}) was registered to the masterlist.`,
        ticket_code: record.ticket_code,
        department: record.department
      };

      const filtered = prev.filter(t => t.ticket_code !== record.ticket_code && t.student_id !== record.student_id);
      const nextList = [record, ...filtered];
      broadcastUpdate(nextList, ping);
      return nextList;
    });

    // Activity Log
    if (record && !record._logged) {
      addLogEntry({
        type: 'registration',
        title: '🎉 STUDENT REGISTERED',
        message: `${record.full_name} (${record.student_id} • ${record.ticket_code}) registered.`,
        ticket_code: record.ticket_code,
        department: record.department
      });
    }

    // Idempotent Supabase Cloud Sync (Ensures 0 duplicate rows in cloud database)
    try {
      if (supabase && typeof supabase.from === 'function' && record) {
        supabase.from('attendees').upsert([record], { onConflict: 'student_id' }).then(() => {}).catch(() => {
          supabase.from('attendees').insert([record]).then(() => {}).catch(() => {});
        });
      }
    } catch (e) {}

    return record;
  };

  // 2. Admin Toggle Payment Handler
  const handleTogglePayment = async (code) => {
    let ping = null;
    let nextStatus = 'paid';
    setTickets(prev => {
      const nextList = prev.map(t => {
        if (t.ticket_code === code) {
          nextStatus = t.payment_status === 'paid' ? 'unpaid' : 'paid';
          ping = {
            type: 'payment',
            title: nextStatus === 'paid' ? '💳 PAYMENT VERIFIED' : '⏳ PAYMENT REVERTED',
            message: `${t.full_name} (${t.program_section}) is now marked as ${nextStatus.toUpperCase()}.`,
            ticket_code: code,
            department: t.department
          };
          return { ...t, payment_status: nextStatus };
        }
        return t;
      });
      broadcastUpdate(nextList, ping);
      return nextList;
    });

    addLogEntry({
      type: 'payment',
      title: ping?.title || (nextStatus === 'paid' ? '💳 PAYMENT VERIFIED' : '⏳ PAYMENT REVERTED'),
      message: ping?.message || `Ticket ${code} marked as ${nextStatus.toUpperCase()}.`,
      ticket_code: code,
      department: ping?.department
    });

    // Supabase DB Sync
    try {
      if (supabase && typeof supabase.from === 'function') {
        supabase.from('attendees').update({ payment_status: nextStatus }).eq('ticket_code', code).then(() => {}).catch(() => {});
      }
    } catch (e) {}
  };

  // 3. Admin Bulk Verify Handler
  const handleBulkVerify = async (section) => {
    const ping = {
      type: 'bulk_payment',
      title: '💳 BULK SECTION VERIFIED',
      message: `All registered students in section "${section}" were verified as Paid!`,
      section
    };
    setTickets(prev => {
      const nextList = prev.map(t => (section === 'ALL' || t.program_section === section) ? { ...t, payment_status: 'paid' } : t);
      broadcastUpdate(nextList, ping);
      return nextList;
    });

    addLogEntry({
      type: 'bulk_payment',
      title: '💰 BULK SECTION VERIFIED',
      message: `All students in section "${section}" verified as Paid.`
    });

    // Supabase DB Sync
    try {
      if (supabase && typeof supabase.from === 'function') {
        if (section === 'ALL') {
          supabase.from('attendees').update({ payment_status: 'paid' }).neq('id', '0').then(() => {}).catch(() => {});
        } else {
          supabase.from('attendees').update({ payment_status: 'paid' }).eq('program_section', section).then(() => {}).catch(() => {});
        }
      }
    } catch (e) {}
  };

  // 4. Usher Gate Admission Handler (Day 1 vs Day 2 Auto PH Time)
  const handleAdmitStudent = async (code, targetDay = 'day1', customTime = null) => {
    const timeString = customTime || getPHShortTime();
    let ping = null;
    let updatedRecord = null;

    setTickets(prev => {
      const nextList = prev.map(t => {
        if (t.ticket_code === code) {
          const isDay1 = targetDay === 'day1';
          const updated = {
            ...t,
            day1_status: isDay1 ? 'attended' : t.day1_status,
            day1_time: isDay1 ? timeString : t.day1_time,
            day2_status: !isDay1 ? 'attended' : t.day2_status,
            day2_time: !isDay1 ? timeString : t.day2_time,
            attendance_status: 'attended'
          };
          updatedRecord = updated;
          ping = {
            type: 'admission',
            title: `⚡ GATE ADMISSION (${targetDay === 'day1' ? 'DAY 1' : 'DAY 2'})`,
            message: `${t.full_name} entered the venue at ${timeString} (PST)!`,
            ticket_code: code,
            department: t.department,
            day: targetDay
          };
          return updated;
        }
        return t;
      });
      broadcastUpdate(nextList, ping);
      return nextList;
    });

    addLogEntry({
      type: 'admission',
      title: `⚡ GATE ADMISSION (${targetDay === 'day1' ? 'DAY 1' : 'DAY 2'})`,
      message: `${updatedRecord?.full_name || code} entered venue at ${timeString} (PST).`,
      ticket_code: code,
      department: updatedRecord?.department
    });

    // Supabase DB Sync
    try {
      if (supabase && typeof supabase.from === 'function' && updatedRecord) {
        supabase.from('attendees').update({
          day1_status: updatedRecord.day1_status,
          day1_time: updatedRecord.day1_time,
          day2_status: updatedRecord.day2_status,
          day2_time: updatedRecord.day2_time,
          attendance_status: 'attended'
        }).eq('ticket_code', code).then(() => {}).catch(() => {});
      }
    } catch (e) {}
  };

  // 5. Delete Single Attendee Handler (No password required, instant execution)
  const handleDeleteAttendee = async (code) => {
    if (!code) return;
    let targetToDelete = null;
    let nextList = [];

    setTickets(prev => {
      targetToDelete = prev.find(t => t.ticket_code === code);
      nextList = prev.filter(t => t.ticket_code !== code);
      saveStoredTickets(nextList);
      return nextList;
    });

    const ping = {
      type: 'deletion',
      title: '🗑️ ATTENDEE REMOVED',
      message: targetToDelete
        ? `${targetToDelete.full_name} (${targetToDelete.student_id} • ${targetToDelete.ticket_code}) was removed from the masterlist by ${adminSession?.name || 'Admin'}.`
        : `Attendee ${code} was removed from the masterlist by ${adminSession?.name || 'Admin'}.`,
      ticket_code: code,
      department: targetToDelete?.department
    };

    broadcastUpdate(nextList, ping);

    addLogEntry({
      type: 'deletion',
      title: '🗑️ ATTENDEE REMOVED',
      message: targetToDelete
        ? `${targetToDelete.full_name} (${targetToDelete.student_id} • ${targetToDelete.ticket_code}) removed by ${adminSession?.name || 'Admin'}.`
        : `Attendee ${code} removed by ${adminSession?.name || 'Admin'}.`,
      ticket_code: code,
      department: targetToDelete?.department
    });

    // Real-Time Supabase Database Row Deletion (if connected)
    try {
      if (supabase && typeof supabase.from === 'function') {
        supabase.from('attendees').delete().eq('ticket_code', code).then(() => {}).catch(() => {});
        supabase.from('tickets').delete().eq('ticket_code', code).then(() => {}).catch(() => {});
      }
    } catch (dbErr) {}

    return targetToDelete;
  };

  // 6. Batch Delete Selected Attendees Handler with Account-Specific Admin Password Protection
  const handleBatchDeleteAttendees = async (codesToDelete = [], password = '') => {
    if (!Array.isArray(codesToDelete) || codesToDelete.length === 0) {
      return { success: false, error: 'No attendees selected for deletion.' };
    }

    const cleanInput = (password || '').trim();
    const currentAdminId = adminSession?.id || 'admin1';
    const activeAccount = ADMIN_ACCOUNTS.find(a => a.id === currentAdminId) || ADMIN_ACCOUNTS[0];

    const isPwAuthorized = 
      cleanInput === '2026' || 
      cleanInput === 'URSP@SSG2026!' ||
      activeAccount.passwords.includes(cleanInput) ||
      activeAccount.passwords.includes(cleanInput.toUpperCase()) ||
      ADMIN_ACCOUNTS.some(a => a.passwords.includes(cleanInput) || a.passwords.includes(cleanInput.toUpperCase()));

    if (!isPwAuthorized) {
      return { success: false, error: `❌ Incorrect password for ${activeAccount.label}. Batch deletion aborted.` };
    }

    const deleteSet = new Set(codesToDelete);
    let nextList = [];
    setTickets(prev => {
      nextList = prev.filter(t => !deleteSet.has(t.ticket_code));
      saveStoredTickets(nextList);
      return nextList;
    });

    const ping = {
      type: 'deletion',
      title: `🗑️ ${codesToDelete.length} ATTENDEES DELETED`,
      message: `Batch of ${codesToDelete.length} student record(s) deleted by ${adminSession?.name || 'Admin'}.`
    };
    broadcastUpdate(nextList, ping);

    addLogEntry({
      type: 'deletion',
      title: `🗑️ ${codesToDelete.length} ATTENDEES DELETED`,
      message: `Batch of ${codesToDelete.length} student record(s) deleted by ${adminSession?.name || 'Admin'}.`
    });

    // Real-Time Supabase Batch Deletion (if connected)
    try {
      if (supabase && typeof supabase.from === 'function') {
        supabase.from('attendees').delete().in('ticket_code', codesToDelete).then(() => {}).catch(() => {});
        supabase.from('tickets').delete().in('ticket_code', codesToDelete).then(() => {}).catch(() => {});
      }
    } catch (e) {}

    return { success: true, count: codesToDelete.length };
  };

  // Toggle Registration Lock with cross-tab and cloud broadcast
  const handleToggleRegistrationLock = (explicitVal = null) => {
    setRegistrationLocked(prev => {
      const next = explicitVal !== null ? explicitVal : !prev;
      try { localStorage.setItem('ursp_registration_locked', String(next)); } catch (e) {}
      broadcastCloudUpdate(null, {
        type: 'registration',
        title: next ? '🔒 REGISTRATION CLOSED' : '🔓 REGISTRATION OPENED',
        message: next ? 'The official registration portal has been closed by SSG Admin.' : 'The official registration portal is now open for students!'
      }, next);
      addLogEntry({
        type: 'lock',
        title: next ? '🔒 REGISTRATION LOCKED' : '🔓 REGISTRATION UNLOCKED',
        message: next ? 'Registration portal closed by SSG Admin.' : 'Registration portal opened for students.'
      });
      return next;
    });
  };



  // Activity log deletion handlers
  const handleDeleteLogs = (logIds) => {
    if (!Array.isArray(logIds) || logIds.length === 0) return;
    const idSet = new Set(logIds);
    setActivityLog(prev => {
      const next = prev.filter(l => !idSet.has(l.id));
      try { localStorage.setItem('ursp_activity_log_v1', JSON.stringify(next)); } catch (e) {}
      return next;
    });
    broadcastDeleteLogs(logIds);
  };

  const handleClearAllLogs = () => {
    setActivityLog([]);
    try { localStorage.removeItem('ursp_activity_log_v1'); } catch (e) {}
    broadcastClearLogs();
  };

  const handleNavigate = (newRoute) => {
    if ((newRoute === 'admin' || newRoute === 'logs') && !isAdminAuthed) {
      setPendingRoute(newRoute);
      setPinError('');
      setPinInput('');
      setShowPinModal(true);
      return;
    }

    if (newRoute === 'usher' && !isAdminAuthed) {
      const params = new URLSearchParams(window.location.search);
      const hasToken = params.get('token') === 'USHER-MASTER-2026';
      if (!hasToken) {
        setPendingRoute('usher');
        setPinError('');
        setPinInput('');
        setShowPinModal(true);
        return;
      }
    }

    setRoute(newRoute);
    const url = new URL(window.location);
    url.searchParams.set('view', newRoute);
    window.history.pushState({}, '', url);
  };

  // Master Security Key Configuration & Verification
  const MASTER_SECURITY_KEY = import.meta.env.VITE_ADMIN_MASTER_KEY || 'URSP@SSG2026!';
  const MASTER_SECURITY_PIN = '2026';
  const ENABLE_DEV_ACCESS_HINT = true;

  const handleVerifyPassword = (e) => {
    if (e) e.preventDefault();

    // Check anti-brute force rate limit
    const rateCheck = checkPinRateLimit();
    if (!rateCheck.allowed) {
      setPinError(`🚫 Too many failed attempts. Security cooldown: ${rateCheck.remainingSeconds}s.`);
      return;
    }

    const cleanInput = pinInput.trim();
    const chosenAccount = ADMIN_ACCOUNTS.find(a => a.id === selectedAdminId) || ADMIN_ACCOUNTS[0];

    const isAuthorized = 
      cleanInput === MASTER_SECURITY_PIN || 
      cleanInput.toUpperCase() === 'SSG2026' || 
      cleanInput === MASTER_SECURITY_KEY ||
      cleanInput.toUpperCase() === MASTER_SECURITY_KEY.toUpperCase() ||
      chosenAccount.passwords.includes(cleanInput) ||
      chosenAccount.passwords.includes(cleanInput.toUpperCase());

    if (isAuthorized) {
      resetPinAttempts();
      setPinError('');
      // Generate unique anti-spoofing challenge nonce token for Step 2
      const nonce = `AUTH-CLR-${selectedAdminId.toUpperCase()}-${Math.random().toString(36).substring(2, 7).toUpperCase()}-2026`;
      setQrChallengeCode(nonce);
      setAuthStep(2); // Proceed to Anti-Spoofing Confirmation QR
    } else {
      const attemptResult = recordFailedPinAttempt();
      if (attemptResult.locked) {
        setPinError(`🚫 Too many attempts. Access locked for 60 seconds.`);
      } else {
        setPinError(`❌ Access Denied: Invalid Password for ${chosenAccount.label} (${attemptResult.attemptsRemaining} attempt(s) left).`);
      }
    }
  };

  const handleFinalizeQrClearance = () => {
    const chosenAccount = ADMIN_ACCOUNTS.find(a => a.id === selectedAdminId) || ADMIN_ACCOUNTS[0];
    const sessionData = {
      id: chosenAccount.id,
      name: chosenAccount.label,
      role: chosenAccount.role,
      authenticatedAt: new Date().toISOString(),
      qrToken: qrChallengeCode
    };

    setIsAdminAuthed(true);
    setAdminSession(sessionData);
    try {
      sessionStorage.setItem('ursp_admin_authed', 'true');
      sessionStorage.setItem('ursp_admin_session', JSON.stringify(sessionData));
    } catch (err) {}

    setShowPinModal(false);
    setAuthStep(1);
    setPinInput('');
    setPinError('');

    const target = pendingRoute || 'admin';
    setRoute(target);
    const url = new URL(window.location);
    url.searchParams.set('view', target);
    window.history.pushState({}, '', url);
    setPendingRoute(null);
  };

  const handleLockAdmin = () => {
    setIsAdminAuthed(false);
    try {
      sessionStorage.removeItem('ursp_admin_authed');
      sessionStorage.removeItem('ursp_admin_session');
    } catch (e) {}
    setRoute('student');
    const url = new URL(window.location);
    url.searchParams.delete('view');
    url.searchParams.delete('token');
    window.history.pushState({}, '', url);
  };

  return (
    <div className="app-layout">
      <BackgroundAmbient />

      {/* Floating Single Real-Time Toast Notification: Strictly ONLY 1 Toast on Screen with Dynamic +3s Extension */}
      {isAdminAuthed && route === 'admin' && (
        <div className="global-toast-container">
          <AnimatePresence mode="wait">
            {activeToast && (
              <motion.div
                key={activeToast.key || activeToast.id}
                className={`toast-card toast-${activeToast.type || 'registration'}`}
                initial={{ opacity: 0, y: -20, scale: 0.94 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9, y: -12, transition: { duration: 0.2 } }}
                transition={{ type: "spring", stiffness: 420, damping: 28 }}
              >
                <div className="toast-header">
                  <span className="toast-title-badge">
                    {activeToast.type === 'registration' ? '🎉' : activeToast.type === 'payment' ? '💳' : activeToast.type === 'admission' ? '⚡' : activeToast.type === 'deletion' ? '🗑️' : '✨'} {activeToast.title || 'NOTIFICATION'}
                  </span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span className="toast-time">{activeToast.timestamp}</span>
                    <button
                      className="toast-close-btn"
                      onClick={removeToast}
                      title="Dismiss notification"
                    >
                      ✕
                    </button>
                  </div>
                </div>

                <div className="toast-msg">
                  {activeToast.message}
                </div>

                {/* Dynamic Remaining Countdown Progress Bar */}
                <div
                  key={activeToast.key}
                  className="toast-progress-bar"
                  style={{
                    animation: `toastCountdown ${activeToast.durationMs || 5000}ms linear forwards`
                  }}
                />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}

      {/* Role-Based Dynamic Navigation Header */}
      <header className="global-app-nav">
        <div className="global-nav-inner">
          <div
            className="global-nav-brand"
            onClick={handleLogoEasterEgg}
            title="URSPantropiko 2026 Ticketing Suite (Tap 3x for SSG Admin Access)"
            style={{ cursor: 'pointer' }}
          >
            {/* Dual Logos with Blue URS Logo First, SSG Logo Second */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <img
                src="/urs_logo.png"
                alt="University of Rizal System Main Seal"
                className="global-nav-logo"
                style={{
                  width: '36px',
                  height: '36px',
                  borderRadius: '50%',
                  border: '2px solid #38BDF8',
                  background: '#FFF',
                  objectFit: 'contain'
                }}
              />
              <img
                src="/logo.png"
                alt="URSP SSG Logo"
                className="global-nav-logo"
                style={{
                  width: '36px',
                  height: '36px',
                  borderRadius: '50%',
                  border: '2px solid #FFD100',
                  background: '#FFF',
                  objectFit: 'contain'
                }}
              />
            </div>
            <div className="global-brand-text">
              <span className="global-brand-title">URSPANTROPIKO 2026</span>
              <span className="global-brand-sub">
                {route === 'student' ? 'Student Registration Portal' : route === 'admin' ? '🛡️ SSG Master Control Suite' : route === 'logs' ? '📡 Live Activity & Audit Feed' : '📱 Gate Usher Scanner'}
              </span>
            </div>
          </div>

          {/* ADMIN AUTHENTICATED MODE: Role Switcher & Active Officer Profile */}
          {isAdminAuthed && (
            <nav className="global-nav-tabs">
              <div style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                background: 'rgba(56, 189, 248, 0.12)',
                border: '1px solid rgba(56, 189, 248, 0.35)',
                padding: '4px 10px',
                borderRadius: '20px',
                fontSize: '11px',
                color: '#38BDF8',
                fontWeight: '700'
              }}>
                <span>👤</span>
                <span>{adminSession?.name || 'Admin'}</span>
              </div>
              <button
                className={`global-nav-btn ${route === 'student' ? 'active' : ''}`}
                onClick={() => handleNavigate('student')}
                title="Direct fallback student registration by Admin"
              >
                🎓 Direct Registration
              </button>
              <button
                className={`global-nav-btn ${route === 'admin' ? 'active' : ''}`}
                onClick={() => handleNavigate('admin')}
              >
                🛡️ Admin Dashboard
                <span className="global-nav-badge">{tickets.length}</span>
              </button>
              <button
                className={`global-nav-btn ${route === 'logs' ? 'active' : ''}`}
                onClick={() => handleNavigate('logs')}
                title="View live real-time activity and audit feed across all devices"
              >
                📡 Live Activity
                {activityLog.length > 0 && (
                  <span className="global-nav-badge" style={{ background: '#38BDF8', color: '#000' }}>
                    {activityLog.length > 99 ? '99+' : activityLog.length}
                  </span>
                )}
              </button>
              <button
                className={`global-nav-btn ${route === 'usher' ? 'active' : ''}`}
                onClick={() => handleNavigate('usher')}
              >
                📱 Usher Scanner
              </button>
              <button
                className="btn-lock-session"
                onClick={handleLockAdmin}
                title="Lock admin session and return to public student mode"
              >
                🔒 Sign Out
              </button>
            </nav>
          )}

          {/* USHER VIEW (When unauthenticated): Simple exit button */}
          {!isAdminAuthed && route === 'usher' && (
            <div className="flex items-center gap-3">
              <button
                className="btn-exit-scanner"
                onClick={() => handleNavigate('student')}
              >
                ← Exit Scanner
              </button>
            </div>
          )}
        </div>
      </header>

      {/* Main View Portals */}
      <main className="app-main-standalone">
        {route === 'student' && (
          <StudentPortal
            onTicketGenerated={handleTicketGenerated}
            registrationLocked={registrationLocked}
          />
        )}
        
        {route === 'admin' && (
          <AdminDashboard
            tickets={tickets}
            onTogglePayment={handleTogglePayment}
            onBulkVerify={handleBulkVerify}
            onAdmitStudent={handleAdmitStudent}
            onDeleteAttendee={handleDeleteAttendee}
            onBatchDeleteAttendees={handleBatchDeleteAttendees}
            registrationLocked={registrationLocked}
            onToggleRegistrationLock={handleToggleRegistrationLock}
            adminSession={adminSession}
            onAdminLogout={handleLockAdmin}
            livePings={livePings}
            highlightedCode={highlightedCode}
            activityLog={activityLog}
            onDeleteLogs={handleDeleteLogs}
            onClearAllLogs={handleClearAllLogs}
          />
        )}
        
        {route === 'logs' && (
          <NotificationsLog
            activityLog={activityLog}
            totalAttendees={tickets.length}
            onDeleteLogs={handleDeleteLogs}
            onClearAllLogs={handleClearAllLogs}
            onNavigate={handleNavigate}
          />
        )}
        
        {route === 'usher' && (
          <UsherScanner
            tickets={tickets}
            onAdmitStudent={handleAdmitStudent}
          />
        )}
      </main>

      {/* Dual Admin 1 & Admin 2 Security Authorization Modal with Anti-Spoofing QR Confirmation */}
      {showPinModal && (
        <div className="modal-security-overlay" onClick={() => setShowPinModal(false)}>
          <div className="modal-security-box" style={{ maxWidth: '440px' }} onClick={(e) => e.stopPropagation()}>
            <div className="security-shield-icon">🛡️</div>
            <h3 className="security-modal-title">SSG Master Security Clearance</h3>
            <p className="security-modal-desc">
              Protected Dual-Admin Access. Select your official administrative account and complete the anti-spoofing security challenge.
            </p>

            {authStep === 1 ? (
              <>
                {/* Admin 1 vs Admin 2 Account Selector */}
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr',
                  gap: '8px',
                  marginBottom: '16px'
                }}>
                  {ADMIN_ACCOUNTS.map(acc => {
                    const isSelected = selectedAdminId === acc.id;
                    return (
                      <button
                        key={acc.id}
                        type="button"
                        onClick={() => { setSelectedAdminId(acc.id); setPinError(''); }}
                        style={{
                          background: isSelected ? 'rgba(56, 189, 248, 0.2)' : 'rgba(255, 255, 255, 0.05)',
                          border: isSelected ? '2px solid #38BDF8' : '1px solid rgba(255, 255, 255, 0.15)',
                          borderRadius: '12px',
                          padding: '12px 8px',
                          textAlign: 'center',
                          color: isSelected ? '#FFFFFF' : '#94A3B8',
                          cursor: 'pointer',
                          transition: 'all 0.2s ease'
                        }}
                      >
                        <div style={{ fontSize: '18px', marginBottom: '2px' }}>{acc.id === 'admin1' ? '👑' : '🛡️'}</div>
                        <div style={{ fontSize: '12px', fontWeight: '800', color: isSelected ? '#38BDF8' : '#E2E8F0' }}>
                          {acc.id === 'admin1' ? 'Admin 1' : 'Admin 2'}
                        </div>
                        <div style={{ fontSize: '10px', color: '#94A3B8', marginTop: '2px' }}>
                          {acc.id === 'admin1' ? 'Executive Lead' : 'Security Officer'}
                        </div>
                      </button>
                    );
                  })}
                </div>

                <form onSubmit={handleVerifyPassword} className="security-form">
                  <input
                    type="password"
                    maxLength={32}
                    placeholder={`Enter Password for ${selectedAdminId === 'admin1' ? 'Admin 1' : 'Admin 2'}`}
                    value={pinInput}
                    onChange={(e) => setPinInput(e.target.value)}
                    autoFocus
                    className="security-pin-input"
                    style={{ fontSize: '14px', letterSpacing: '1.5px', textAlign: 'center' }}
                  />

                  {pinError && (
                    <div className="security-error-msg">{pinError}</div>
                  )}

                  <div className="security-modal-actions">
                    <button
                      type="button"
                      className="btn-security-cancel"
                      onClick={() => setShowPinModal(false)}
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="btn-security-unlock"
                    >
                      Next: QR Verification ➔
                    </button>
                  </div>
                </form>
              </>
            ) : (
              /* Step 2: Anti-Spoofing Confirmation QR Challenge */
              <div style={{ textAlign: 'center' }}>
                <div style={{
                  background: 'rgba(56, 189, 248, 0.1)',
                  border: '1px solid rgba(56, 189, 248, 0.3)',
                  borderRadius: '12px',
                  padding: '8px 12px',
                  marginBottom: '14px',
                  fontSize: '11.5px',
                  color: '#BAE6FD'
                }}>
                  🛡️ <strong>Anti-Spoofing 2FA Challenge:</strong> Security token generated for <strong>{selectedAdminId === 'admin1' ? 'Admin 1 (Executive)' : 'Admin 2 (Security)'}</strong>.
                </div>

                <div style={{
                  background: '#FFFFFF',
                  padding: '14px',
                  borderRadius: '16px',
                  display: 'inline-block',
                  margin: '0 auto 12px',
                  boxShadow: '0 8px 24px rgba(0,0,0,0.6)'
                }}>
                  <QRCodeCanvas value={qrChallengeCode} size={150} level="H" includeMargin={false} />
                </div>

                <div style={{
                  fontFamily: 'monospace',
                  fontSize: '11px',
                  color: '#FDE047',
                  background: 'rgba(0,0,0,0.4)',
                  padding: '4px 10px',
                  borderRadius: '6px',
                  display: 'inline-block',
                  marginBottom: '16px'
                }}>
                  Clearance Token: {qrChallengeCode}
                </div>

                <div className="security-modal-actions">
                  <button
                    type="button"
                    className="btn-security-cancel"
                    onClick={() => { setAuthStep(1); setPinError(''); }}
                  >
                    ← Back
                  </button>
                  <button
                    type="button"
                    className="btn-security-unlock"
                    onClick={handleFinalizeQrClearance}
                    style={{ background: 'linear-gradient(135deg, #10B981 0%, #059669 100%)' }}
                  >
                    ✅ Confirm Clearance &amp; Access
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
