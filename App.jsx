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
const DELETED_KEY = 'ursp_masterlist_deleted_v4';

export const SAMPLE_TEST_ATTENDEES = [
  // --- COLLEGE OF BUSINESS (15 Students) ---
  { id: 'CB-01', ticket_code: 'TKT-20001', student_id: '2024-01001', full_name: 'Abad, Christian Paul', department: 'College of Business', year_level: '1st Year', program_section: 'BSBA 1-A', payment_status: 'paid', day1_status: 'attended', day1_time: '08:14 AM', day2_status: 'not_attended', day2_time: null, attendance_status: 'attended' },
  { id: 'CB-02', ticket_code: 'TKT-20002', student_id: '2024-01002', full_name: 'Alcantara, Bianca Mae', department: 'College of Business', year_level: '1st Year', program_section: 'BSBA 1-B', payment_status: 'unpaid', day1_status: 'not_attended', day1_time: null, day2_status: 'not_attended', day2_time: null, attendance_status: 'not_attended' },
  { id: 'CB-03', ticket_code: 'TKT-20003', student_id: '2023-01003', full_name: 'Aquino, Gerald Kim', department: 'College of Business', year_level: '2nd Year', program_section: 'BSA 2-A', payment_status: 'paid', day1_status: 'attended', day1_time: '08:26 AM', day2_status: 'attended', day2_time: '08:15 PM', attendance_status: 'attended' },
  { id: 'CB-04', ticket_code: 'TKT-20004', student_id: '2023-01004', full_name: 'Bautista, Janelle Rose', department: 'College of Business', year_level: '2nd Year', program_section: 'BSA 2-B', payment_status: 'unpaid', day1_status: 'not_attended', day1_time: null, day2_status: 'not_attended', day2_time: null, attendance_status: 'not_attended' },
  { id: 'CB-05', ticket_code: 'TKT-20005', student_id: '2022-01005', full_name: 'Castillo, Mark Anthony', department: 'College of Business', year_level: '3rd Year', program_section: 'BSBA 3-A', payment_status: 'paid', day1_status: 'not_attended', day1_time: null, day2_status: 'not_attended', day2_time: null, attendance_status: 'not_attended' },
  { id: 'CB-06', ticket_code: 'TKT-20006', student_id: '2022-01006', full_name: 'De Guzman, Patricia', department: 'College of Business', year_level: '3rd Year', program_section: 'BSBA 3-B', payment_status: 'unpaid', day1_status: 'not_attended', day1_time: null, day2_status: 'not_attended', day2_time: null, attendance_status: 'not_attended' },
  { id: 'CB-07', ticket_code: 'TKT-20007', student_id: '2021-01007', full_name: 'Domingo, Ralph Vincent', department: 'College of Business', year_level: '4th Year', program_section: 'BSA 4-A', payment_status: 'paid', day1_status: 'attended', day1_time: '08:35 AM', day2_status: 'not_attended', day2_time: null, attendance_status: 'attended' },
  { id: 'CB-08', ticket_code: 'TKT-20008', student_id: '2021-01008', full_name: 'Esguerra, Stephanie Jane', department: 'College of Business', year_level: '4th Year', program_section: 'BSA 4-B', payment_status: 'paid', day1_status: 'attended', day1_time: '08:40 AM', day2_status: 'attended', day2_time: '08:30 PM', attendance_status: 'attended' },
  { id: 'CB-09', ticket_code: 'TKT-20009', student_id: '2024-01009', full_name: 'Flores, Joshua Luke', department: 'College of Business', year_level: '1st Year', program_section: 'BSBA 1-A', payment_status: 'unpaid', day1_status: 'not_attended', day1_time: null, day2_status: 'not_attended', day2_time: null, attendance_status: 'not_attended' },
  { id: 'CB-10', ticket_code: 'TKT-20010', student_id: '2023-01010', full_name: 'Garcia, Katrina Danielle', department: 'College of Business', year_level: '2nd Year', program_section: 'BSA 2-A', payment_status: 'paid', day1_status: 'attended', day1_time: '08:22 AM', day2_status: 'not_attended', day2_time: null, attendance_status: 'attended' },
  { id: 'CB-11', ticket_code: 'TKT-20011', student_id: '2022-01011', full_name: 'Hernandez, Justin Clyde', department: 'College of Business', year_level: '3rd Year', program_section: 'BSBA 3-A', payment_status: 'paid', day1_status: 'attended', day1_time: '08:15 AM', day2_status: 'not_attended', day2_time: null, attendance_status: 'attended' },
  { id: 'CB-12', ticket_code: 'TKT-20012', student_id: '2021-01012', full_name: 'Ignacio, Camille Marie', department: 'College of Business', year_level: '4th Year', program_section: 'BSA 4-A', payment_status: 'unpaid', day1_status: 'not_attended', day1_time: null, day2_status: 'not_attended', day2_time: null, attendance_status: 'not_attended' },
  { id: 'CB-13', ticket_code: 'TKT-20013', student_id: '2024-01013', full_name: 'Lim, Chloe Denise', department: 'College of Business', year_level: '1st Year', program_section: 'BSBA 1-B', payment_status: 'paid', day1_status: 'attended', day1_time: '08:22 AM', day2_status: 'attended', day2_time: '08:30 PM', attendance_status: 'attended' },
  { id: 'CB-14', ticket_code: 'TKT-20014', student_id: '2023-01014', full_name: 'Mendoza, Danilo Jr.', department: 'College of Business', year_level: '2nd Year', program_section: 'BSA 2-B', payment_status: 'paid', day1_status: 'attended', day1_time: '08:40 AM', day2_status: 'not_attended', day2_time: null, attendance_status: 'attended' },
  { id: 'CB-15', ticket_code: 'TKT-20015', student_id: '2021-01015', full_name: 'Tan, Sophia Nicole', department: 'College of Business', year_level: '4th Year', program_section: 'BSBA 4-B', payment_status: 'unpaid', day1_status: 'not_attended', day1_time: null, day2_status: 'not_attended', day2_time: null, attendance_status: 'not_attended' },

  // --- COLLEGE OF EDUCATION (15 Students) ---
  { id: 'COED-01', ticket_code: 'TKT-30001', student_id: '2024-02001', full_name: 'Alano, Kimberly Joyce', department: 'College of Education', year_level: '1st Year', program_section: 'BSED 1-A', payment_status: 'paid', day1_status: 'attended', day1_time: '08:10 AM', day2_status: 'not_attended', day2_time: null, attendance_status: 'attended' },
  { id: 'COED-02', ticket_code: 'TKT-30002', student_id: '2024-02002', full_name: 'Bernardo, Kevin James', department: 'College of Education', year_level: '1st Year', program_section: 'BEED 1-B', payment_status: 'unpaid', day1_status: 'not_attended', day1_time: null, day2_status: 'not_attended', day2_time: null, attendance_status: 'not_attended' },
  { id: 'COED-03', ticket_code: 'TKT-30003', student_id: '2023-02003', full_name: 'Cabrera, Mary Grace', department: 'College of Education', year_level: '2nd Year', program_section: 'BTLED 2-A', payment_status: 'paid', day1_status: 'attended', day1_time: '08:30 AM', day2_status: 'attended', day2_time: '08:20 PM', attendance_status: 'attended' },
  { id: 'COED-04', ticket_code: 'TKT-30004', student_id: '2023-02004', full_name: 'Cruz, John Michael', department: 'College of Education', year_level: '2nd Year', program_section: 'BSED 2-B', payment_status: 'paid', day1_status: 'not_attended', day1_time: null, day2_status: 'not_attended', day2_time: null, attendance_status: 'not_attended' },
  { id: 'COED-05', ticket_code: 'TKT-30005', student_id: '2022-02005', full_name: 'Diaz, Angela Mae', department: 'College of Education', year_level: '3rd Year', program_section: 'BEED 3-B', payment_status: 'unpaid', day1_status: 'not_attended', day1_time: null, day2_status: 'not_attended', day2_time: null, attendance_status: 'not_attended' },
  { id: 'COED-06', ticket_code: 'TKT-30006', student_id: '2022-02006', full_name: 'Enriquez, Lance Matthew', department: 'College of Education', year_level: '3rd Year', program_section: 'BSED 3-A', payment_status: 'paid', day1_status: 'attended', day1_time: '08:18 AM', day2_status: 'not_attended', day2_time: null, attendance_status: 'attended' },
  { id: 'COED-07', ticket_code: 'TKT-30007', student_id: '2021-02007', full_name: 'Francisco, Andrea Nicole', department: 'College of Education', year_level: '4th Year', program_section: 'BTLED 4-A', payment_status: 'paid', day1_status: 'attended', day1_time: '08:45 AM', day2_status: 'attended', day2_time: '08:40 PM', attendance_status: 'attended' },
  { id: 'COED-08', ticket_code: 'TKT-30008', student_id: '2021-02008', full_name: 'Gomez, Patricia Anne', department: 'College of Education', year_level: '4th Year', program_section: 'BSED 4-B', payment_status: 'paid', day1_status: 'attended', day1_time: '08:35 AM', day2_status: 'not_attended', day2_time: null, attendance_status: 'attended' },
  { id: 'COED-09', ticket_code: 'TKT-30009', student_id: '2024-02009', full_name: 'Hilario, Daniel Joseph', department: 'College of Education', year_level: '1st Year', program_section: 'BEED 1-A', payment_status: 'unpaid', day1_status: 'not_attended', day1_time: null, day2_status: 'not_attended', day2_time: null, attendance_status: 'not_attended' },
  { id: 'COED-10', ticket_code: 'TKT-30010', student_id: '2023-02010', full_name: 'Javier, Roxanne Claire', department: 'College of Education', year_level: '2nd Year', program_section: 'BTLED 2-A', payment_status: 'paid', day1_status: 'attended', day1_time: '08:25 AM', day2_status: 'not_attended', day2_time: null, attendance_status: 'attended' },
  { id: 'COED-11', ticket_code: 'TKT-30011', student_id: '2022-02011', full_name: 'Laureano, Gabriel Ethan', department: 'College of Education', year_level: '3rd Year', program_section: 'BSED 3-A', payment_status: 'unpaid', day1_status: 'not_attended', day1_time: null, day2_status: 'not_attended', day2_time: null, attendance_status: 'not_attended' },
  { id: 'COED-12', ticket_code: 'TKT-30012', student_id: '2021-02012', full_name: 'Magno, Bea Marie', department: 'College of Education', year_level: '4th Year', program_section: 'BTLED 4-A', payment_status: 'paid', day1_status: 'attended', day1_time: '08:50 AM', day2_status: 'not_attended', day2_time: null, attendance_status: 'attended' },
  { id: 'COED-13', ticket_code: 'TKT-30013', student_id: '2024-02013', full_name: 'Navarro, Clarisse Joy', department: 'College of Education', year_level: '1st Year', program_section: 'BEED 1-B', payment_status: 'paid', day1_status: 'not_attended', day1_time: null, day2_status: 'not_attended', day2_time: null, attendance_status: 'not_attended' },
  { id: 'COED-14', ticket_code: 'TKT-30014', student_id: '2023-02014', full_name: 'Ocampo, Patrick Neil', department: 'College of Education', year_level: '2nd Year', program_section: 'BSED 2-A', payment_status: 'unpaid', day1_status: 'not_attended', day1_time: null, day2_status: 'not_attended', day2_time: null, attendance_status: 'not_attended' },
  { id: 'COED-15', ticket_code: 'TKT-30015', student_id: '2022-02015', full_name: 'Reyes, John Carlo', department: 'College of Education', year_level: '3rd Year', program_section: 'BSED 3-A', payment_status: 'paid', day1_status: 'attended', day1_time: '08:14 AM', day2_status: 'not_attended', day2_time: null, attendance_status: 'attended' },

  // --- COLLEGE OF SOCIAL SCIENCES (15 Students) ---
  { id: 'CSS-01', ticket_code: 'TKT-40001', student_id: '2024-03001', full_name: 'Agustin, Cedric Liam', department: 'College of Social Sciences', year_level: '1st Year', program_section: 'BS-PSYCH 1-A', payment_status: 'paid', day1_status: 'attended', day1_time: '08:12 AM', day2_status: 'not_attended', day2_time: null, attendance_status: 'attended' },
  { id: 'CSS-02', ticket_code: 'TKT-40002', student_id: '2024-03002', full_name: 'Beltran, Dianne Rose', department: 'College of Social Sciences', year_level: '1st Year', program_section: 'AB-POLSCI 1-B', payment_status: 'unpaid', day1_status: 'not_attended', day1_time: null, day2_status: 'not_attended', day2_time: null, attendance_status: 'not_attended' },
  { id: 'CSS-03', ticket_code: 'TKT-40003', student_id: '2023-03003', full_name: 'Cruz, Mark Kevin', department: 'College of Social Sciences', year_level: '2nd Year', program_section: 'AB-POLSCI 2-A', payment_status: 'paid', day1_status: 'attended', day1_time: '08:26 AM', day2_status: 'attended', day2_time: '08:15 PM', attendance_status: 'attended' },
  { id: 'CSS-04', ticket_code: 'TKT-40004', student_id: '2023-03004', full_name: 'David, Justine Faye', department: 'College of Social Sciences', year_level: '2nd Year', program_section: 'BS-PSYCH 2-B', payment_status: 'paid', day1_status: 'not_attended', day1_time: null, day2_status: 'not_attended', day2_time: null, attendance_status: 'not_attended' },
  { id: 'CSS-05', ticket_code: 'TKT-40005', student_id: '2022-03005', full_name: 'Esteban, Ryan Gabriel', department: 'College of Social Sciences', year_level: '3rd Year', program_section: 'AB-SOC 3-A', payment_status: 'unpaid', day1_status: 'not_attended', day1_time: null, day2_status: 'not_attended', day2_time: null, attendance_status: 'not_attended' },
  { id: 'CSS-06', ticket_code: 'TKT-40006', student_id: '2022-03006', full_name: 'Fernandez, Alyssa Joy', department: 'College of Social Sciences', year_level: '3rd Year', program_section: 'BS-PSYCH 3-A', payment_status: 'paid', day1_status: 'attended', day1_time: '08:20 AM', day2_status: 'not_attended', day2_time: null, attendance_status: 'attended' },
  { id: 'CSS-07', ticket_code: 'TKT-40007', student_id: '2021-03007', full_name: 'Gutierrez, Sean Marcus', department: 'College of Social Sciences', year_level: '4th Year', program_section: 'AB-POLSCI 4-A', payment_status: 'paid', day1_status: 'attended', day1_time: '08:35 AM', day2_status: 'attended', day2_time: '08:45 PM', attendance_status: 'attended' },
  { id: 'CSS-08', ticket_code: 'TKT-40008', student_id: '2021-03008', full_name: 'Herrera, Valerie Anne', department: 'College of Social Sciences', year_level: '4th Year', program_section: 'BS-PSYCH 4-B', payment_status: 'unpaid', day1_status: 'not_attended', day1_time: null, day2_status: 'not_attended', day2_time: null, attendance_status: 'not_attended' },
  { id: 'CSS-09', ticket_code: 'TKT-40009', student_id: '2024-03009', full_name: 'Isidro, Kyle Dominic', department: 'College of Social Sciences', year_level: '1st Year', program_section: 'AB-SOC 1-A', payment_status: 'paid', day1_status: 'attended', day1_time: '08:15 AM', day2_status: 'not_attended', day2_time: null, attendance_status: 'attended' },
  { id: 'CSS-10', ticket_code: 'TKT-40010', student_id: '2023-03010', full_name: 'Jimenez, Sarah Louise', department: 'College of Social Sciences', year_level: '2nd Year', program_section: 'BS-PSYCH 2-A', payment_status: 'paid', day1_status: 'attended', day1_time: '08:30 AM', day2_status: 'not_attended', day2_time: null, attendance_status: 'attended' },
  { id: 'CSS-11', ticket_code: 'TKT-40011', student_id: '2022-03011', full_name: 'Morales, Joshua', department: 'College of Social Sciences', year_level: '3rd Year', program_section: 'BS-PSYCH 3-A', payment_status: 'paid', day1_status: 'not_attended', day1_time: null, day2_status: 'not_attended', day2_time: null, attendance_status: 'not_attended' },
  { id: 'CSS-12', ticket_code: 'TKT-40012', student_id: '2021-03012', full_name: 'Noriega, Francine Gail', department: 'College of Social Sciences', year_level: '4th Year', program_section: 'AB-POLSCI 4-B', payment_status: 'unpaid', day1_status: 'not_attended', day1_time: null, day2_status: 'not_attended', day2_time: null, attendance_status: 'not_attended' },
  { id: 'CSS-13', ticket_code: 'TKT-40013', student_id: '2024-03013', full_name: 'Pascual, Brian Dave', department: 'College of Social Sciences', year_level: '1st Year', program_section: 'BS-PSYCH 1-B', payment_status: 'paid', day1_status: 'attended', day1_time: '08:18 AM', day2_status: 'not_attended', day2_time: null, attendance_status: 'attended' },
  { id: 'CSS-14', ticket_code: 'TKT-40014', student_id: '2023-03014', full_name: 'Quizon, Mikaela Marie', department: 'College of Social Sciences', year_level: '2nd Year', program_section: 'AB-SOC 2-A', payment_status: 'unpaid', day1_status: 'not_attended', day1_time: null, day2_status: 'not_attended', day2_time: null, attendance_status: 'not_attended' },
  { id: 'CSS-15', ticket_code: 'TKT-40015', student_id: '2022-03015', full_name: 'Santos, Gabriel', department: 'College of Social Sciences', year_level: '3rd Year', program_section: 'AB-SOC 3-A', payment_status: 'paid', day1_status: 'attended', day1_time: '08:40 AM', day2_status: 'not_attended', day2_time: null, attendance_status: 'attended' }
];

const SEED_FALLBACK = SAMPLE_TEST_ATTENDEES;

function getDeletedCodes() {
  try {
    const raw = localStorage.getItem(DELETED_KEY);
    if (raw) return new Set(JSON.parse(raw));
  } catch (e) {}
  return new Set();
}

function recordDeletedCode(code) {
  try {
    const set = getDeletedCodes();
    set.add(code);
    localStorage.setItem(DELETED_KEY, JSON.stringify(Array.from(set)));
  } catch (e) {}
}

function unrecordDeletedCode(code) {
  try {
    const set = getDeletedCodes();
    set.delete(code);
    localStorage.setItem(DELETED_KEY, JSON.stringify(Array.from(set)));
  } catch (e) {}
}

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
  const deletedSet = getDeletedCodes();
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed.filter(t => !deletedSet.has(t.ticket_code)).map(normalizeTicket);
      }
    }
  } catch (e) {
    console.warn('Could not read localStorage:', e);
  }
  return SEED_FALLBACK.filter(t => !deletedSet.has(t.ticket_code)).map(normalizeTicket);
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

  // Single Unified Toast System (Strictly 1 Toast with Dynamic +3s Extension per new inquiry/registree)
  const [activeToast, setActiveToast] = useState(null);
  const toastTimeoutRef = useRef(null);
  const toastExpireTimestampRef = useRef(0);
  const activeRegCountRef = useRef(0);
  const seenPingsMap = useRef(new Map());

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
      const deletedSet = getDeletedCodes();
      try {
        if (supabase && typeof supabase.from === 'function') {
          const { data, error } = await supabase.from('attendees').select('*').order('created_at', { ascending: false });
          if (!error && Array.isArray(data) && data.length > 0 && isMounted) {
            setTickets(prev => {
              const remoteMap = new Map();
              data.filter(t => !deletedSet.has(t.ticket_code)).forEach(t => remoteMap.set(t.ticket_code, normalizeTicket(t)));
              prev.filter(t => !deletedSet.has(t.ticket_code)).forEach(t => {
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
            const deletedSet = getDeletedCodes();
            if (payload.new && !deletedSet.has(payload.new.ticket_code) && isMounted) {
              const newRecord = normalizeTicket(payload.new);
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
              recordDeletedCode(payload.old.ticket_code);
              setTickets(prev => {
                const next = prev.filter(t => t.ticket_code !== payload.old.ticket_code && t.id !== payload.old.id);
                saveStoredTickets(next);
                return next;
              });
            }
          })
          .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'attendees' }, payload => {
            const deletedSet = getDeletedCodes();
            if (payload.new && !deletedSet.has(payload.new.ticket_code) && isMounted) {
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
      const deletedSet = getDeletedCodes();
      if (Array.isArray(cloudTickets) && isMounted) {
        setTickets(prev => {
          const map = new Map();
          // 1. Add cloud tickets (ignoring deleted attendees)
          cloudTickets.filter(t => !deletedSet.has(t.ticket_code)).forEach(t => {
            map.set(t.ticket_code, normalizeTicket(t));
          });
          // 2. Preserve any local attendees not marked as deleted
          prev.filter(t => !deletedSet.has(t.ticket_code)).forEach(t => {
            if (!map.has(t.ticket_code)) {
              map.set(t.ticket_code, t);
            }
          });

          const merged = Array.from(map.values());
          saveStoredTickets(merged);

          const prevHash = prev.map(t => `${t.ticket_code}:${t.payment_status}:${t.day1_status}:${t.day2_status}`).join('|');
          const nextHash = merged.map(t => `${t.ticket_code}:${t.payment_status}:${t.day1_status}:${t.day2_status}`).join('|');
          if (prevHash === nextHash) return prev;
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
    recordDeletedCode(code);
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

  // 6. Complete Database Flush Handler (Clears all records for pristine testing)
  const handleFlushDatabase = async () => {
    try {
      localStorage.removeItem(STORAGE_KEY);
      localStorage.removeItem(DELETED_KEY);
      localStorage.removeItem('cachedEventTickets');
    } catch (e) {}
    setTickets([]);
    broadcastUpdate([], {
      type: 'deletion',
      title: '🧹 MASTERLIST FLUSHED',
      message: 'All attendee records have been cleanly flushed for fresh event testing.'
    });

    try {
      if (supabase && typeof supabase.from === 'function') {
        supabase.from('attendees').delete().neq('ticket_code', 'SCHEMA_GUARD').then(() => {}).catch(() => {});
      }
    } catch (e) {}
  };

  // 7. Quick Load 45 Sample Attendees Handler (15 for each college)
  const handleLoadSampleAttendees = () => {
    try {
      localStorage.removeItem(DELETED_KEY);
    } catch (e) {}
    setTickets(SAMPLE_TEST_ATTENDEES);
    broadcastUpdate(SAMPLE_TEST_ATTENDEES, {
      type: 'registration',
      title: '⚡ 45 TEST ATTENDEES LOADED',
      message: 'Loaded 15 sample students for each of the 3 colleges to test auto-scroll viewports!'
    });
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
            onFlushDatabase={handleFlushDatabase}
            onLoadSampleAttendees={handleLoadSampleAttendees}
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
