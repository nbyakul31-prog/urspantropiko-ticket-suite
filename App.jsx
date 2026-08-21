import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import StudentPortal from './StudentPortal';
import AdminDashboard from './AdminDashboard';
import UsherScanner from './UsherScanner';
import BackgroundAmbient from './BackgroundAmbient';
import { supabase } from './lib/supabase';
import { checkPinRateLimit, recordFailedPinAttempt, resetPinAttempts, sanitizeText } from './lib/security';
import { broadcastCloudUpdate, listenToCloudUpdates } from './lib/cloudSync';

const STORAGE_KEY = 'ursp_masterlist_attendees_v4';

const SEED_FALLBACK = [
  { id: '1', ticket_code: 'TKT-10001', student_id: '2022-01001', full_name: 'John Carlo Reyes', department: 'College of Education', year_level: '3rd Year', program_section: 'BSED 3-A', payment_status: 'paid', day1_status: 'attended', day1_time: '08:14 AM', day2_status: 'not_attended', day2_time: null, attendance_status: 'attended' },
  { id: '2', ticket_code: 'TKT-10002', student_id: '2022-01002', full_name: 'Angela Mae Diaz', department: 'College of Education', year_level: '3rd Year', program_section: 'BEED 3-B', payment_status: 'unpaid', day1_status: 'not_attended', day1_time: null, day2_status: 'not_attended', day2_time: null, attendance_status: 'not_attended' },
  { id: '3', ticket_code: 'TKT-10003', student_id: '2023-02001', full_name: 'Mark Kevin Cruz', department: 'College of Social Sciences', year_level: '2nd Year', program_section: 'AB-POLSCI 2-A', payment_status: 'paid', day1_status: 'attended', day1_time: '08:26 AM', day2_status: 'attended', day2_time: '08:15 PM', attendance_status: 'attended' },
  { id: '4', ticket_code: 'TKT-10004', student_id: '2021-03001', full_name: 'Sophia Nicole Tan', department: 'College of Business', year_level: '4th Year', program_section: 'BSBA 4-B', payment_status: 'unpaid', day1_status: 'not_attended', day1_time: null, day2_status: 'not_attended', day2_time: null, attendance_status: 'not_attended' },
  { id: '5', ticket_code: 'TKT-10005', student_id: '2024-04001', full_name: 'Joshua Morales', department: 'College of Social Sciences', year_level: '1st Year', program_section: 'BS-PSYCH 1-A', payment_status: 'paid', day1_status: 'not_attended', day1_time: null, day2_status: 'not_attended', day2_time: null, attendance_status: 'not_attended' },
  { id: '6', ticket_code: 'TKT-10006', student_id: '2023-02002', full_name: 'Patricia Anne Gomez', department: 'College of Education', year_level: '2nd Year', program_section: 'BSED 2-A', payment_status: 'paid', day1_status: 'attended', day1_time: '08:35 AM', day2_status: 'not_attended', day2_time: null, attendance_status: 'attended' },
  { id: '7', ticket_code: 'TKT-10007', student_id: '2022-01003', full_name: 'Gabriel Santos', department: 'College of Social Sciences', year_level: '3rd Year', program_section: 'AB-SOC 3-A', payment_status: 'unpaid', day1_status: 'not_attended', day1_time: null, day2_status: 'not_attended', day2_time: null, attendance_status: 'not_attended' },
  { id: '8', ticket_code: 'TKT-10008', student_id: '2024-04002', full_name: 'Chloe Denise Lim', department: 'College of Business', year_level: '1st Year', program_section: 'BSBA 1-A', payment_status: 'paid', day1_status: 'attended', day1_time: '08:22 AM', day2_status: 'attended', day2_time: '08:30 PM', attendance_status: 'attended' },
  { id: '9', ticket_code: 'TKT-10009', student_id: '2023-03014', full_name: 'Danilo Mendoza Jr.', department: 'College of Business', year_level: '2nd Year', program_section: 'BSA 2-A', payment_status: 'paid', day1_status: 'attended', day1_time: '08:40 AM', day2_status: 'not_attended', day2_time: null, attendance_status: 'attended' },
  { id: '10', ticket_code: 'TKT-10010', student_id: '2021-01099', full_name: 'Bea Marie Alcantara', department: 'College of Education', year_level: '4th Year', program_section: 'BTLED 4-A', payment_status: 'paid', day1_status: 'not_attended', day1_time: null, day2_status: 'not_attended', day2_time: null, attendance_status: 'not_attended' }
];

function normalizeTicket(t) {
  return {
    ...t,
    day1_status: t.day1_status || (t.attendance_status === 'attended' ? 'attended' : 'not_attended'),
    day1_time: t.day1_time || t.attended_at || (t.attendance_status === 'attended' ? '08:15 AM' : null),
    day2_status: t.day2_status || 'not_attended',
    day2_time: t.day2_time || null,
    attendance_status: (t.day1_status === 'attended' || t.day2_status === 'attended' || t.attendance_status === 'attended') ? 'attended' : 'not_attended'
  };
}

function getStoredTickets() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed.map(normalizeTicket);
      }
    }
  } catch (e) {
    console.warn('Could not read localStorage:', e);
  }
  return SEED_FALLBACK.map(normalizeTicket);
}

function saveStoredTickets(ticketsList) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(ticketsList));
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

  const [showPinModal, setShowPinModal] = useState(false);
  const [pinInput, setPinInput] = useState('');
  const [pinError, setPinError] = useState('');
  const [pendingRoute, setPendingRoute] = useState(null);

  const getRoute = () => {
    const path = window.location.pathname.toLowerCase();
    const params = new URLSearchParams(window.location.search);
    const viewParam = params.get('view') || params.get('tab');
    const token = params.get('token');
    
    if (path.includes('admin') || viewParam === 'admin') {
      const isAuthed = sessionStorage.getItem('ursp_admin_authed') === 'true';
      if (isAuthed) return 'admin';
      return 'student'; // Fallback to student and trigger PIN modal
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

  // Live Toast Notification System (5-second auto-dismiss with rate-limiter)
  const [activeToasts, setActiveToasts] = useState([]);
  const lastToastTimeRef = useRef(0);
  const pendingRegistrationsCountRef = useRef(0);
  const rateLimitTimerRef = useRef(null);

  // Initial Route Security Check (Intercept direct ?view=admin links)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const viewParam = params.get('view');
    const token = params.get('token');
    
    if (viewParam === 'admin' && !isAdminAuthed) {
      setPendingRoute('admin');
      setPinError('');
      setPinInput('');
      setShowPinModal(true);
    } else if (viewParam === 'usher' && token !== 'USHER-MASTER-2026' && !isAdminAuthed) {
      setPendingRoute('usher');
      setPinError('');
      setPinInput('');
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

  const triggerToast = (toastObj) => {
    setActiveToasts(prev => [toastObj, ...prev.slice(0, 2)]);
    // 5-second automatic timer
    setTimeout(() => {
      setActiveToasts(prev => prev.filter(t => t.id !== toastObj.id));
    }, 5000);
  };

  const removeToast = (id) => {
    setActiveToasts(prev => prev.filter(t => t.id !== id));
  };

  const addLivePing = (ping) => {
    const enriched = {
      id: 'PING-' + Date.now() + '-' + Math.floor(Math.random() * 1000),
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

    // Rate Limiter: Instill 2-second rate limit on registration toasts to prevent popup spam
    const now = Date.now();
    if (ping.type === 'registration') {
      const timeSinceLast = now - lastToastTimeRef.current;
      if (timeSinceLast < 2000) {
        pendingRegistrationsCountRef.current += 1;
        if (!rateLimitTimerRef.current) {
          rateLimitTimerRef.current = setTimeout(() => {
            const count = pendingRegistrationsCountRef.current;
            pendingRegistrationsCountRef.current = 0;
            rateLimitTimerRef.current = null;
            if (count > 0) {
              const aggregatedPing = {
                id: 'PING-AGG-' + Date.now(),
                timestamp: getPHTimeString(),
                type: 'registration',
                title: '⚡ BATCH REGISTRATIONS',
                message: `✨ ${count} more student${count > 1 ? 's' : ''} just registered online!`
              };
              triggerToast(aggregatedPing);
            }
          }, 2200);
        }
        return;
      }
      lastToastTimeRef.current = now;
    }

    triggerToast(enriched);
  };

  // Setup Cross-Tab Broadcast Channel, LocalStorage & Supabase Real-Time Sync
  useEffect(() => {
    let isMounted = true;

    // 1. Query Supabase Remote DB upon loading (Syncs offline registrations seamlessly)
    async function syncFromSupabase() {
      try {
        if (supabase && typeof supabase.from === 'function') {
          const { data, error } = await supabase.from('attendees').select('*').order('created_at', { ascending: false });
          if (!error && Array.isArray(data) && data.length > 0 && isMounted) {
            setTickets(prev => {
              const remoteMap = new Map();
              data.forEach(t => remoteMap.set(t.ticket_code, normalizeTicket(t)));
              prev.forEach(t => {
                if (!remoteMap.has(t.ticket_code)) {
                  remoteMap.set(t.ticket_code, t);
                }
              });
              const merged = Array.from(remoteMap.values());
              saveStoredTickets(merged);
              return merged;
            });
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
              setTickets(prev => {
                if (prev.some(t => t.ticket_code === newRecord.ticket_code)) return prev;
                const next = [newRecord, ...prev];
                saveStoredTickets(next);
                return next;
              });
              addLivePing({
                type: 'registration',
                title: '🎉 LIVE CLOUD REGISTRATION',
                message: `${payload.new.full_name} (${payload.new.program_section}) registered via Vercel!`,
                ticket_code: payload.new.ticket_code,
                department: payload.new.department
              });
            }
          })
          .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'attendees' }, payload => {
            if (payload.old && isMounted) {
              setTickets(prev => {
                const next = prev.filter(t => t.ticket_code !== payload.old.ticket_code && t.id !== payload.old.id);
                saveStoredTickets(next);
                return next;
              });
            }
          })
          .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'attendees' }, payload => {
            if (payload.new && isMounted) {
              setTickets(prev => {
                const next = prev.map(t => t.ticket_code === payload.new.ticket_code ? normalizeTicket(payload.new) : t);
                saveStoredTickets(next);
                return next;
              });
            }
          })
          .subscribe();
      }
    } catch (err) {}

    // 3. Real-Time Cloud Listener for Cross-Device Sync (Phone <-> PC Admin)
    const cleanupCloudSync = listenToCloudUpdates((cloudTickets, ping) => {
      if (Array.isArray(cloudTickets) && cloudTickets.length > 0 && isMounted) {
        setTickets(prev => {
          const map = new Map();
          cloudTickets.forEach(t => map.set(t.ticket_code, normalizeTicket(t)));
          prev.forEach(t => {
            if (!map.has(t.ticket_code)) {
              map.set(t.ticket_code, t);
            }
          });
          const merged = Array.from(map.values());
          saveStoredTickets(merged);
          return merged;
        });
      }
      if (ping && isMounted) {
        addLivePing(ping);
      }
    });

    const handleStorage = (e) => {
      if (e.key === STORAGE_KEY && e.newValue) {
        try {
          const fresh = JSON.parse(e.newValue);
          if (Array.isArray(fresh)) {
            setTickets(fresh.map(normalizeTicket));
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
        title: existing ? '🔄 PASS RE-ACCESSED' : '🎉 NEW STUDENT REGISTERED',
        message: `${record.full_name} (${record.program_section}) ${existing ? 're-accessed existing ticket pass' : 'registered under ' + record.department}!`,
        ticket_code: record.ticket_code,
        department: record.department
      };

      const filtered = prev.filter(t => t.ticket_code !== record.ticket_code && t.student_id !== record.student_id);
      const nextList = [record, ...filtered];
      broadcastUpdate(nextList, ping);
      return nextList;
    });

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

  // 5. Delete Attendee Handler (Removes from Local, Broadcast & Supabase DB Table immediately)
  const handleDeleteAttendee = async (code) => {
    let deleted = null;
    setTickets(prev => {
      deleted = prev.find(t => t.ticket_code === code);
      const nextList = prev.filter(t => t.ticket_code !== code);
      const ping = deleted ? {
        type: 'deletion',
        title: '🗑️ ATTENDEE REMOVED',
        message: `${deleted.full_name} (${deleted.student_id} • ${deleted.ticket_code}) was removed from the masterlist.`,
        ticket_code: code,
        department: deleted.department
      } : null;
      broadcastUpdate(nextList, ping);
      return nextList;
    });

    // Real-Time Supabase Database Row Deletion (frees up Supabase table row immediately)
    try {
      if (supabase && typeof supabase.from === 'function') {
        supabase.from('attendees').delete().eq('ticket_code', code).then(() => {}).catch(() => {});
        supabase.from('tickets').delete().eq('ticket_code', code).then(() => {}).catch(() => {});
      }
    } catch (dbErr) {
      console.warn('Supabase DB row deletion sync:', dbErr);
    }

    return deleted;
  };

  const handleNavigate = (newRoute) => {
    if (newRoute === 'admin' && !isAdminAuthed) {
      setPendingRoute('admin');
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

  // Master Security Key Configuration (supports 11+ character enterprise passphrase & quick PIN)
  const MASTER_SECURITY_KEY = import.meta.env.VITE_ADMIN_MASTER_KEY || 'URSP@SSG2026!';
  const MASTER_SECURITY_PIN = '2026';
  // Single Toggle for dev/testing hint (easily turn false before September launch)
  const ENABLE_DEV_ACCESS_HINT = true;

  const handleUnlockWithPin = (e) => {
    if (e) e.preventDefault();

    // Check anti-brute force rate limit
    const rateCheck = checkPinRateLimit();
    if (!rateCheck.allowed) {
      setPinError(`🚫 Too many failed attempts. Security cooldown: ${rateCheck.remainingSeconds}s.`);
      return;
    }

    const cleanInput = pinInput.trim();
    const isAuthorized = 
      cleanInput === MASTER_SECURITY_PIN || 
      cleanInput.toUpperCase() === 'SSG2026' || 
      cleanInput === MASTER_SECURITY_KEY ||
      cleanInput.toUpperCase() === MASTER_SECURITY_KEY.toUpperCase();

    if (isAuthorized) {
      resetPinAttempts();
      setIsAdminAuthed(true);
      try {
        sessionStorage.setItem('ursp_admin_authed', 'true');
      } catch (err) {}
      setShowPinModal(false);
      const target = pendingRoute || 'admin';
      setRoute(target);
      const url = new URL(window.location);
      url.searchParams.set('view', target);
      window.history.pushState({}, '', url);
      setPendingRoute(null);
    } else {
      const attemptResult = recordFailedPinAttempt();
      if (attemptResult.locked) {
        setPinError(`🚫 Too many attempts. Access locked for 60 seconds.`);
      } else {
        setPinError(`❌ Access Denied: Invalid Security Clearance (${attemptResult.attemptsRemaining} attempt(s) left).`);
      }
    }
  };

  const handleLockAdmin = () => {
    setIsAdminAuthed(false);
    try {
      sessionStorage.removeItem('ursp_admin_authed');
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

      {/* Floating Real-Time Live Toast Notifications: Displayed ONLY in Admin Dashboard (5-Second Expiry & Rate-Limited) */}
      {isAdminAuthed && route === 'admin' && (
        <div className="global-toast-container">
          <AnimatePresence>
            {activeToasts.map(toast => (
              <motion.div
                key={toast.id}
                className={`toast-card toast-${toast.type || 'registration'}`}
                initial={{ opacity: 0, y: -20, scale: 0.92, x: 20 }}
                animate={{ opacity: 1, y: 0, scale: 1, x: 0 }}
                exit={{ opacity: 0, scale: 0.88, y: -15, transition: { duration: 0.25 } }}
                transition={{ type: "spring", stiffness: 380, damping: 25 }}
              >
                <div className="toast-header">
                  <span className="toast-title-badge">
                    {toast.type === 'registration' ? '🎉' : toast.type === 'payment' ? '💳' : toast.type === 'admission' ? '⚡' : toast.type === 'deletion' ? '🗑️' : '✨'} {toast.title || 'NOTIFICATION'}
                  </span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span className="toast-time">{toast.timestamp}</span>
                    <button
                      className="toast-close-btn"
                      onClick={() => removeToast(toast.id)}
                      title="Dismiss notification"
                    >
                      ✕
                    </button>
                  </div>
                </div>

                <div className="toast-msg">
                  {toast.message}
                </div>

                {/* 5-Second Animated Countdown Progress Bar */}
                <div className="toast-progress-bar" />
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}

      {/* Role-Based Dynamic Navigation Header */}
      <header className="global-app-nav">
        <div className="global-nav-inner">
          <div
            className="global-brand"
            onClick={() => {
              // Secret 3-tap admin trigger on mobile
              const now = Date.now();
              if (!window._lastTap || now - window._lastTap > 1500) {
                window._tapCount = 1;
              } else {
                window._tapCount = (window._tapCount || 0) + 1;
              }
              window._lastTap = now;

              if (window._tapCount >= 3 && !isAdminAuthed) {
                window._tapCount = 0;
                setPendingRoute('admin');
                setPinError('');
                setPinInput('');
                setShowPinModal(true);
              } else {
                handleNavigate('student');
              }
            }}
            style={{ cursor: 'pointer' }}
            title="URSPantropiko Portal"
          >
            <img src="/logo.png" alt="URSP Logo" className="global-nav-logo" />
            <div className="global-brand-text">
              <span className="global-brand-title">URSPANTROPIKO 2026</span>
              <span className="global-brand-sub">
                {route === 'student' ? 'Student Registration Portal' : route === 'admin' ? '🛡️ SSG Master Control Suite' : '📱 Gate Usher Scanner'}
              </span>
            </div>
          </div>

          {/* ADMIN AUTHENTICATED MODE: Full Role Switcher & Fallback Access */}
          {isAdminAuthed && (
            <nav className="global-nav-tabs">
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
                🔒 Lock Admin
              </button>
            </nav>
          )}

          {/* OFFICER LOGIN BUTTON: Only displayed on LocalHost or with ?admin=1 query to prevent public student clutter */}
          {!isAdminAuthed && route === 'student' && typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' || window.location.search.includes('admin=1')) && (
            <div className="flex items-center gap-3">
              <button
                className="btn-officer-login"
                onClick={() => {
                  setPendingRoute('admin');
                  setPinError('');
                  setPinInput('');
                  setShowPinModal(true);
                }}
              >
                🔒 SSG Officer Login
              </button>
            </div>
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
          <StudentPortal onTicketGenerated={handleTicketGenerated} />
        )}
        
        {route === 'admin' && (
          <AdminDashboard
            tickets={tickets}
            onTogglePayment={handleTogglePayment}
            onBulkVerify={handleBulkVerify}
            onAdmitStudent={handleAdmitStudent}
            onDeleteAttendee={handleDeleteAttendee}
            livePings={livePings}
            highlightedCode={highlightedCode}
          />
        )}
        
        {route === 'usher' && (
          <UsherScanner
            tickets={tickets}
            onAdmitStudent={handleAdmitStudent}
          />
        )}
      </main>

      {/* Security PIN Authorization Modal */}
      {showPinModal && (
        <div className="modal-security-overlay" onClick={() => setShowPinModal(false)}>
          <div className="modal-security-box" onClick={(e) => e.stopPropagation()}>
            <div className="security-shield-icon">🛡️</div>
            <h3 className="security-modal-title">SSG Master Security Clearance</h3>
            <p className="security-modal-desc">
              Protected Officer Access. Enter the authorized SSG Master Clearance Passphrase or PIN to access administrative gate controls.
            </p>

            {/* Dev Mode Access Hint Badge (removable with single command before September launch) */}
            {ENABLE_DEV_ACCESS_HINT && (
              <div style={{
                background: 'rgba(56, 189, 248, 0.12)',
                border: '1px dashed rgba(56, 189, 248, 0.35)',
                borderRadius: '8px',
                padding: '6px 12px',
                fontSize: '11px',
                color: '#38BDF8',
                marginBottom: '14px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px'
              }}>
                <span>🔑 <strong>Test Hint:</strong></span>
                <span>PIN: <code>2026</code> &bull; Passphrase: <code>URSP@SSG2026!</code></span>
              </div>
            )}

            <form onSubmit={handleUnlockWithPin} className="security-form">
              <input
                type="password"
                maxLength={32}
                placeholder="Enter Master Key or PIN"
                value={pinInput}
                onChange={(e) => setPinInput(e.target.value)}
                autoFocus
                className="security-pin-input"
                style={{ fontSize: '15px', letterSpacing: '2px', textAlign: 'center' }}
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
                  🔓 Authorize Access
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
