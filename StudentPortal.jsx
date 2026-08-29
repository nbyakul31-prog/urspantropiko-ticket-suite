import React, { useState, useEffect, useRef } from 'react';
import { QRCodeCanvas } from 'qrcode.react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from './lib/supabase';
import { sanitizeText, sanitizeStudentId } from './lib/security';
import { broadcastCloudUpdate } from './lib/cloudSync';

const COLLEGES_DATA = [
  {
    name: 'College of Business',
    short: 'CB',
    icon: '💼',
    color: '#10B981',
    bgColor: '#D1FAE5',
    textColor: '#065F46',
    borderColor: '#A7F3D0',
    sampleSections: ['BSBA 1-A', 'BSBA 2-A', 'BSBA 3-A', 'BSBA 4-B', 'BSA 1-A', 'BSA 2-A', 'BSHM 3-A']
  },
  {
    name: 'College of Education',
    short: 'COED',
    icon: '📚',
    color: '#F59E0B',
    bgColor: '#FEF3C7',
    textColor: '#92400E',
    borderColor: '#FDE68A',
    sampleSections: ['BSED 1-A', 'BSED 2-A', 'BSED 3-A', 'BEED 1-A', 'BEED 2-B', 'BTLED 3-A']
  },
  {
    name: 'College of Social Sciences',
    short: 'CSS',
    icon: '⚖️',
    color: '#8B5CF6',
    bgColor: '#EDE9FE',
    textColor: '#5B21B6',
    borderColor: '#DDD6FE',
    sampleSections: ['AB-POLSCI 1-A', 'AB-POLSCI 2-A', 'AB-SOC 3-A', 'BS-PSYCH 1-A', 'BS-PSYCH 2-A', 'BPA 3-A']
  }
];

export default function StudentPortal({
  onTicketGenerated,
  registrationLocked = false,
  isAdminAuthed = false,
  allTickets = []
}) {
  const [activeTab, setActiveTab] = useState('register'); // 'register' | 'retrieve'
  const [studentId, setStudentId] = useState('');
  const [lastName, setLastName] = useState('');
  const [firstName, setFirstName] = useState('');
  const [middleInitial, setMiddleInitial] = useState('');
  const [department, setDepartment] = useState('College of Business');
  const [yearLevel, setYearLevel] = useState('1st Year');
  const [section, setSection] = useState('BSBA 1-A');
  const [ticket, setTicket] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Retrieve Search State
  const [lookupQuery, setLookupQuery] = useState('');
  const [lookupError, setLookupError] = useState('');

  // Check if this student device has a saved pass in local storage
  const [savedLocalTicket, setSavedLocalTicket] = useState(null);

  useEffect(() => {
    try {
      const saved = localStorage.getItem('ursp_my_student_pass');
      if (saved) {
        setSavedLocalTicket(JSON.parse(saved));
      }
    } catch (e) {}
  }, []);

  // Show locked registration gate screen only for public students (Admins can still walk-in register)
  if (registrationLocked && !isAdminAuthed) {
    return (
      <div style={{
        minHeight: '70vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '40px 24px',
        textAlign: 'center'
      }}>
        <motion.div
          initial={{ opacity: 0, scale: 0.9, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ type: 'spring', stiffness: 300, damping: 22 }}
          style={{
            background: 'linear-gradient(135deg, rgba(30,10,10,0.92) 0%, rgba(15,23,42,0.97) 100%)',
            border: '2px solid rgba(239,68,68,0.55)',
            borderRadius: '24px',
            padding: '48px 40px',
            maxWidth: '520px',
            width: '100%',
            boxShadow: '0 25px 60px rgba(239,68,68,0.2)'
          }}
        >
          <motion.div
            animate={{ scale: [1, 1.08, 1] }}
            transition={{ repeat: Infinity, duration: 2, ease: 'easeInOut' }}
            style={{ fontSize: '5rem', marginBottom: '20px' }}
          >
            🔒
          </motion.div>
          <h2 style={{ color: '#FCA5A5', fontWeight: '900', fontSize: '1.6rem', margin: '0 0 10px' }}>
            Registration is Currently Closed
          </h2>
          <p style={{ color: '#94A3B8', fontSize: '14px', lineHeight: '1.7', margin: '0 0 24px' }}>
            The <strong style={{ color: '#FFF' }}>URSPANTROPIKO 2026</strong> online registration portal has been temporarily locked by the SSG Admin.
          </p>

          {/* If student already registered, allow them to view their pass even when registration is closed */}
          {savedLocalTicket ? (
            <button
              onClick={() => setTicket(savedLocalTicket)}
              style={{
                background: 'linear-gradient(135deg, #38BDF8 0%, #0284C7 100%)',
                color: '#FFF',
                border: 'none',
                padding: '12px 24px',
                borderRadius: '12px',
                fontWeight: '800',
                fontSize: '14px',
                cursor: 'pointer',
                marginBottom: '20px',
                boxShadow: '0 8px 25px rgba(56,189,248,0.4)'
              }}
            >
              🎟️ View My Saved Pass ({savedLocalTicket.full_name})
            </button>
          ) : (
            <div style={{
              padding: '14px 18px',
              background: 'rgba(239,68,68,0.1)',
              border: '1px solid rgba(239,68,68,0.25)',
              borderRadius: '12px',
              color: '#FCA5A5',
              fontSize: '12px',
              lineHeight: '1.6'
            }}>
              ⚠️ Registration will re-open once the SSG Admin unlocks the portal.
            </div>
          )}
        </motion.div>
      </div>
    );
  }

  const selectedCollegeObj = COLLEGES_DATA.find(c => c.name === department) || COLLEGES_DATA[0];

  const handleSelectCollege = (colName) => {
    setDepartment(colName);
    const col = COLLEGES_DATA.find(c => c.name === colName);
    if (col && col.sampleSections.length > 0) {
      setSection(col.sampleSections[0]);
    }
  };

  const handleGenerateTicket = async (e) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      if (registrationLocked && !isAdminAuthed) {
        throw new Error('Registration is currently closed by the SSG Admin. Please check back later.');
      }
      const sanitizedStudentId = sanitizeStudentId(studentId);
      const cleanLastName = sanitizeText(lastName).trim();
      const cleanFirstName = sanitizeText(firstName).trim();
      const rawMI = sanitizeText(middleInitial).trim().toUpperCase().replace(/\./g, '');

      if (!sanitizedStudentId) {
        throw new Error('Please enter a valid Student ID Number.');
      }
      if (!cleanLastName || !cleanFirstName) {
        throw new Error('Please enter both your Surname and First Name.');
      }

      // Mandatory format: Surname, FirstName M.I.
      const formattedFullName = rawMI 
        ? `${cleanLastName}, ${cleanFirstName} ${rawMI}.`
        : `${cleanLastName}, ${cleanFirstName}`;

      const cleanDept = sanitizeText(department);
      const cleanYear = sanitizeText(yearLevel);
      const cleanSection = sanitizeText(section);
      const generatedCode = 'URS-' + Math.floor(10000 + Math.random() * 90000);

      const newAttendee = {
        student_id: sanitizedStudentId,
        full_name: formattedFullName,
        department: cleanDept,
        year_level: cleanYear,
        program_section: cleanSection,
        ticket_code: generatedCode,
        payment_status: 'unpaid',
        day1_status: 'not_attended',
        day2_status: 'not_attended',
        created_at: new Date().toISOString()
      };

      try {
        if (supabase && typeof supabase.from === 'function') {
          supabase.from('attendees').insert([newAttendee]).then(() => {}).catch(() => {});
        }
      } catch (err) {}

      // Save to local storage & broadcast across devices
      try {
        const existingData = localStorage.getItem('ursp_masterlist_attendees_v5');
        let currentList = existingData ? JSON.parse(existingData) : [];
        currentList = [newAttendee, ...currentList.filter(t => t.ticket_code !== newAttendee.ticket_code && t.student_id !== newAttendee.student_id)];
        localStorage.setItem('ursp_masterlist_attendees_v5', JSON.stringify(currentList));

        // Save student pass for quick retrieval on this phone
        if (!isAdminAuthed) {
          localStorage.setItem('ursp_my_student_pass', JSON.stringify(newAttendee));
          setSavedLocalTicket(newAttendee);
        }

        const registrationPing = {
          type: 'registration',
          title: '🎉 STUDENT REGISTERED',
          message: `${newAttendee.full_name} (${newAttendee.student_id} • ${newAttendee.ticket_code}) registered to the masterlist.`,
          ticket_code: newAttendee.ticket_code,
          department: newAttendee.department
        };

        broadcastCloudUpdate(currentList, registrationPing);
      } catch (e) {
        console.error('Cloud broadcast notice:', e);
      }

      setTicket(newAttendee);

      if (onTicketGenerated) {
        onTicketGenerated(newAttendee);
      }
    } catch (err) {
      setError(err.message || 'An error occurred while generating your ticket.');
    } finally {
      setLoading(false);
    }
  };

  // Student Pass Lookup Handler
  const handleLookupPass = (e) => {
    if (e) e.preventDefault();
    setLookupError('');
    const q = (lookupQuery || '').trim().toLowerCase();
    if (!q) {
      setLookupError('Please enter your Student ID or Full Name.');
      return;
    }

    // Search in masterlist tickets
    const masterList = Array.isArray(allTickets) && allTickets.length > 0
      ? allTickets
      : (() => {
          try {
            const raw = localStorage.getItem('ursp_masterlist_attendees_v5');
            return raw ? JSON.parse(raw) : [];
          } catch (e) { return []; }
        })();

    const digitsOnly = q.replace(/\D/g, '');

    const found = masterList.find(t => {
      if (!t) return false;
      const tktCode = (t.ticket_code || '').toLowerCase();
      const sId = (t.student_id || '').toLowerCase();
      const name = (t.full_name || '').toLowerCase();
      const sIdDigits = (t.student_id || '').replace(/\D/g, '');

      return (
        tktCode === q ||
        sId === q ||
        name.includes(q) ||
        (digitsOnly.length >= 4 && sIdDigits === digitsOnly)
      );
    });

    if (found) {
      setTicket(found);
      if (!isAdminAuthed) {
        localStorage.setItem('ursp_my_student_pass', JSON.stringify(found));
        setSavedLocalTicket(found);
      }
    } else {
      setLookupError(`No registration found matching "${lookupQuery}". Please check your Student ID or register below.`);
    }
  };

  return (
    <div className="portal-container" style={{ maxWidth: '680px', margin: '0 auto', padding: '16px' }}>
      <motion.div
        className="portal-glass-card"
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.3 }}
        style={{
          background: 'rgba(15, 23, 42, 0.94)',
          border: '1px solid rgba(255, 255, 255, 0.12)',
          borderRadius: '24px',
          padding: '24px',
          boxShadow: '0 25px 60px rgba(0, 0, 0, 0.7)',
          backdropFilter: 'blur(20px)'
        }}
      >
        {/* Hero Poster Banner */}
        <div style={{
          position: 'relative',
          overflow: 'hidden',
          borderRadius: '16px',
          marginBottom: '18px',
          boxShadow: '0 12px 35px rgba(0,0,0,0.6)',
          border: '1.5px solid rgba(255, 209, 0, 0.4)'
        }}>
          <img
            src="/poster.jpg"
            alt="URSPANTROPIKO Acquaintance Party Poster"
            style={{ width: '100%', height: 'auto', maxHeight: '220px', objectFit: 'cover', display: 'block' }}
          />
          <div style={{
            position: 'absolute',
            inset: 0,
            background: 'linear-gradient(to top, rgba(0,0,0,0.85) 0%, rgba(0,0,0,0.2) 50%, transparent 100%)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'flex-end',
            padding: '14px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
              <span style={{ fontSize: '11px', background: '#EAB308', color: '#000', fontWeight: '900', padding: '3px 10px', borderRadius: '12px' }}>
                SEPT 17–18, 2026
              </span>
              <span style={{ fontSize: '11px', background: 'rgba(255,255,255,0.2)', color: '#FFF', fontWeight: '700', padding: '3px 10px', borderRadius: '12px' }}>
                📍 URS PILILLA GYMNASIUM
              </span>
            </div>
            <h1 style={{
              fontSize: '1.5rem',
              fontWeight: '900',
              color: '#FFD100',
              textShadow: '0 2px 10px rgba(0,0,0,0.8)',
              margin: 0,
              textAlign: 'center'
            }}>
              URSPANTROPIKO 2026
            </h1>
          </div>
        </div>

        {/* View Mode: PASS DISPLAY */}
        {ticket ? (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.3 }}
            style={{ textAlign: 'center' }}
          >
            {/* OFFICIAL PASS CARD */}
            <div style={{
              background: '#0B132B',
              border: '3px solid #FFD100',
              borderRadius: '24px',
              padding: '24px 20px',
              boxShadow: '0 20px 50px rgba(255, 209, 0, 0.25)',
              position: 'relative',
              overflow: 'hidden'
            }}>
              <div style={{
                display: 'inline-block',
                background: 'linear-gradient(135deg, #F97316 0%, #EAB308 100%)',
                color: '#000',
                fontSize: '12px',
                fontWeight: '900',
                padding: '4px 16px',
                borderRadius: '20px',
                marginBottom: '12px',
                letterSpacing: '0.5px'
              }}>
                OFFICIAL STUDENT ENTRANCE PASS
              </div>

              <h2 style={{ fontSize: '1.75rem', fontWeight: '900', color: '#FFD100', margin: '0 0 8px' }}>
                URSPANTROPIKO 2026
              </h2>

              <div style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                background: selectedCollegeObj?.bgColor || '#D1FAE5',
                color: selectedCollegeObj?.textColor || '#065F46',
                padding: '4px 14px',
                borderRadius: '20px',
                fontWeight: '800',
                fontSize: '0.82rem',
                border: `1px solid ${selectedCollegeObj?.borderColor || '#A7F3D0'}`,
                marginBottom: '12px'
              }}>
                {selectedCollegeObj?.icon || '💼'} {ticket.department} ({ticket.year_level || '1st Year'})
              </div>

              <div style={{ fontSize: '2rem', fontWeight: '900', color: '#38BDF8', letterSpacing: '1.5px', fontFamily: 'monospace', margin: '4px 0' }}>
                {ticket.ticket_code}
              </div>

              <div style={{ fontSize: '1.35rem', fontWeight: '800', color: '#FFF', marginTop: '4px' }}>
                {ticket.full_name}
              </div>

              <div style={{ fontSize: '0.88rem', color: '#94A3B8', marginTop: '2px' }}>
                ID: <b style={{ color: '#FFF' }}>{ticket.student_id}</b> &bull; Section: <b style={{ color: '#FFF' }}>{ticket.program_section}</b>
              </div>

              {/* High-Resolution Razor-Sharp QR Code */}
              <div style={{
                background: '#FFF',
                padding: '16px',
                borderRadius: '20px',
                display: 'inline-flex',
                margin: '18px auto',
                boxShadow: '0 10px 30px rgba(0,0,0,0.6)'
              }}>
                <QRCodeCanvas
                  value={ticket.ticket_code}
                  size={200}
                  level="H"
                  includeMargin={true}
                  fgColor="#000000"
                  bgColor="#FFFFFF"
                />
              </div>

              {/* PROMINENT SCREENSHOT REMINDER BANNER */}
              <div style={{
                background: 'linear-gradient(135deg, rgba(245, 158, 11, 0.25) 0%, rgba(217, 119, 6, 0.25) 100%)',
                border: '2px solid #F59E0B',
                borderRadius: '14px',
                padding: '14px 16px',
                color: '#FEF3C7',
                textAlign: 'center',
                margin: '12px 0',
                boxShadow: '0 0 20px rgba(245, 158, 11, 0.2)'
              }}>
                <div style={{ fontSize: '15px', fontWeight: '900', color: '#FFD100', marginBottom: '4px' }}>
                  📸 PLEASE SCREENSHOT YOUR PASS NOW!
                </div>
                <div style={{ fontSize: '12.5px', lineHeight: '1.5', color: '#FDE68A' }}>
                  Take a <strong>screenshot / screen capture</strong> of this pass and save it to your phone photos gallery. Present this QR code to the Ushers at the entrance gate.
                </div>
              </div>

              {/* Payment Info Box */}
              <div style={{
                background: 'rgba(255, 255, 255, 0.05)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                borderRadius: '10px',
                padding: '8px 12px',
                fontSize: '11.5px',
                color: '#CBD5E1'
              }}>
                ⚠️ <strong>Payment Notice:</strong> Submit payment to your Class Representative / Treasurer to verify admission.
              </div>
            </div>

            {/* Navigation Actions */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '18px' }}>
              {isAdminAuthed ? (
                <button
                  onClick={() => { setTicket(null); setActiveTab('register'); setStudentId(''); setLastName(''); setFirstName(''); setMiddleInitial(''); }}
                  style={{
                    background: 'linear-gradient(135deg, #10B981 0%, #059669 100%)',
                    color: '#FFF',
                    border: 'none',
                    padding: '14px',
                    borderRadius: '12px',
                    fontWeight: '800',
                    fontSize: '14px',
                    cursor: 'pointer'
                  }}
                >
                  ➕ Register Next Walk-In Student
                </button>
              ) : (
                <button
                  onClick={() => { setTicket(null); setActiveTab('register'); }}
                  style={{
                    background: 'rgba(255, 255, 255, 0.1)',
                    color: '#FFF',
                    border: '1px solid rgba(255, 255, 255, 0.2)',
                    padding: '12px',
                    borderRadius: '12px',
                    fontWeight: '700',
                    fontSize: '13px',
                    cursor: 'pointer'
                  }}
                >
                  ← Back to Registration / Lookup Portal
                </button>
              )}
            </div>
          </motion.div>
        ) : (
          /* REGISTRATION / LOOKUP FORM TABS */
          <div>
            {/* Top Mode Switcher Pills */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: '8px',
              background: 'rgba(0,0,0,0.4)',
              padding: '6px',
              borderRadius: '14px',
              border: '1px solid rgba(255,255,255,0.1)',
              marginBottom: '20px'
            }}>
              <button
                type="button"
                onClick={() => { setActiveTab('register'); setError(null); }}
                style={{
                  background: activeTab === 'register' ? 'linear-gradient(135deg, #FF6B35 0%, #F59E0B 100%)' : 'transparent',
                  color: activeTab === 'register' ? '#FFF' : '#94A3B8',
                  border: 'none',
                  borderRadius: '10px',
                  padding: '10px 12px',
                  fontWeight: '800',
                  fontSize: '13px',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  boxShadow: activeTab === 'register' ? '0 4px 15px rgba(255, 107, 53, 0.35)' : 'none'
                }}
              >
                📝 Register Entrance Pass
              </button>
              <button
                type="button"
                onClick={() => { setActiveTab('retrieve'); setError(null); setLookupError(''); }}
                style={{
                  background: activeTab === 'retrieve' ? 'linear-gradient(135deg, #38BDF8 0%, #0284C7 100%)' : 'transparent',
                  color: activeTab === 'retrieve' ? '#FFF' : '#94A3B8',
                  border: 'none',
                  borderRadius: '10px',
                  padding: '10px 12px',
                  fontWeight: '800',
                  fontSize: '13px',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  boxShadow: activeTab === 'retrieve' ? '0 4px 15px rgba(56, 189, 248, 0.35)' : 'none'
                }}
              >
                🔍 Retrieve / View My Pass
              </button>
            </div>

            {/* If public student has a saved pass on this phone, show a fast-access card */}
            {!isAdminAuthed && savedLocalTicket && activeTab === 'register' && (
              <div style={{
                background: 'rgba(56, 189, 248, 0.12)',
                border: '1px solid rgba(56, 189, 248, 0.35)',
                borderRadius: '12px',
                padding: '12px 16px',
                marginBottom: '16px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '10px'
              }}>
                <div>
                  <div style={{ fontSize: '13px', fontWeight: '800', color: '#38BDF8' }}>
                    🎟️ Active Pass Found
                  </div>
                  <div style={{ fontSize: '12px', color: '#CBD5E1' }}>
                    {savedLocalTicket.full_name} ({savedLocalTicket.ticket_code})
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setTicket(savedLocalTicket)}
                  style={{
                    background: '#38BDF8',
                    color: '#000',
                    border: 'none',
                    padding: '6px 14px',
                    borderRadius: '8px',
                    fontWeight: '800',
                    fontSize: '12px',
                    cursor: 'pointer',
                    whiteSpace: 'nowrap'
                  }}
                >
                  View Pass →
                </button>
              </div>
            )}

            {/* TAB 1: REGISTRATION FORM */}
            {activeTab === 'register' && (
              <form onSubmit={handleGenerateTicket} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                {error && (
                  <div style={{
                    background: 'rgba(239, 68, 68, 0.15)',
                    border: '1px solid #EF4444',
                    borderRadius: '10px',
                    padding: '10px 14px',
                    color: '#FCA5A5',
                    fontSize: '13px',
                    fontWeight: '600'
                  }}>
                    ⚠️ {error}
                  </div>
                )}

                {/* Student ID */}
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#CBD5E1', marginBottom: '4px' }}>
                    STUDENT ID NUMBER <span style={{ color: '#EF4444' }}>*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. 24-1725 or 1434514"
                    value={studentId}
                    onChange={(e) => setStudentId(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '12px 14px',
                      borderRadius: '10px',
                      background: 'rgba(0,0,0,0.4)',
                      border: '1px solid rgba(255,255,255,0.15)',
                      color: '#FFF',
                      fontSize: '14px',
                      outline: 'none'
                    }}
                  />
                </div>

                {/* Name Fields (Surname, First Name, MI) */}
                <div style={{ display: 'grid', gridTemplateColumns: '2fr 2fr 1fr', gap: '8px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '11px', fontWeight: '700', color: '#CBD5E1', marginBottom: '4px' }}>
                      SURNAME <span style={{ color: '#EF4444' }}>*</span>
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Britania"
                      value={lastName}
                      onChange={(e) => setLastName(e.target.value)}
                      style={{
                        width: '100%',
                        padding: '10px 12px',
                        borderRadius: '10px',
                        background: 'rgba(0,0,0,0.4)',
                        border: '1px solid rgba(255,255,255,0.15)',
                        color: '#FFF',
                        fontSize: '13px',
                        outline: 'none'
                      }}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '11px', fontWeight: '700', color: '#CBD5E1', marginBottom: '4px' }}>
                      FIRST NAME <span style={{ color: '#EF4444' }}>*</span>
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Luigi"
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value)}
                      style={{
                        width: '100%',
                        padding: '10px 12px',
                        borderRadius: '10px',
                        background: 'rgba(0,0,0,0.4)',
                        border: '1px solid rgba(255,255,255,0.15)',
                        color: '#FFF',
                        fontSize: '13px',
                        outline: 'none'
                      }}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '11px', fontWeight: '700', color: '#CBD5E1', marginBottom: '4px' }}>
                      M.I.
                    </label>
                    <input
                      type="text"
                      placeholder="E."
                      maxLength={2}
                      value={middleInitial}
                      onChange={(e) => setMiddleInitial(e.target.value)}
                      style={{
                        width: '100%',
                        padding: '10px 12px',
                        borderRadius: '10px',
                        background: 'rgba(0,0,0,0.4)',
                        border: '1px solid rgba(255,255,255,0.15)',
                        color: '#FFF',
                        fontSize: '13px',
                        textAlign: 'center',
                        outline: 'none'
                      }}
                    />
                  </div>
                </div>

                {/* Collegiate Department Selector */}
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#CBD5E1', marginBottom: '6px' }}>
                    COLLEGIATE DEPARTMENT <span style={{ color: '#EF4444' }}>*</span>
                  </label>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '6px' }}>
                    {COLLEGES_DATA.map(col => {
                      const isSelected = department === col.name;
                      return (
                        <button
                          key={col.name}
                          type="button"
                          onClick={() => handleSelectCollege(col.name)}
                          style={{
                            background: isSelected ? col.color : 'rgba(0,0,0,0.35)',
                            color: isSelected ? '#FFF' : '#94A3B8',
                            border: `1px solid ${isSelected ? col.color : 'rgba(255,255,255,0.1)'}`,
                            borderRadius: '10px',
                            padding: '8px 6px',
                            fontSize: '11px',
                            fontWeight: '800',
                            cursor: 'pointer',
                            textAlign: 'center',
                            transition: 'all 0.2s ease'
                          }}
                        >
                          <div>{col.icon}</div>
                          <div>{col.short}</div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Year Level & Section */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '11px', fontWeight: '700', color: '#CBD5E1', marginBottom: '4px' }}>
                      YEAR LEVEL
                    </label>
                    <select
                      value={yearLevel}
                      onChange={(e) => setYearLevel(e.target.value)}
                      style={{
                        width: '100%',
                        padding: '10px 12px',
                        borderRadius: '10px',
                        background: '#1E293B',
                        border: '1px solid rgba(255,255,255,0.15)',
                        color: '#FFF',
                        fontSize: '13px',
                        outline: 'none'
                      }}
                    >
                      <option value="1st Year">1st Year</option>
                      <option value="2nd Year">2nd Year</option>
                      <option value="3rd Year">3rd Year</option>
                      <option value="4th Year">4th Year</option>
                    </select>
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '11px', fontWeight: '700', color: '#CBD5E1', marginBottom: '4px' }}>
                      SECTION / PROGRAM
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. BSBA 1-A"
                      value={section}
                      onChange={(e) => setSection(e.target.value)}
                      style={{
                        width: '100%',
                        padding: '10px 12px',
                        borderRadius: '10px',
                        background: 'rgba(0,0,0,0.4)',
                        border: '1px solid rgba(255,255,255,0.15)',
                        color: '#FFF',
                        fontSize: '13px',
                        outline: 'none'
                      }}
                    />
                  </div>
                </div>

                {/* Submit Button */}
                <motion.button
                  type="submit"
                  disabled={loading}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  style={{
                    background: 'linear-gradient(135deg, #FF6B35 0%, #FFD100 100%)',
                    color: '#000',
                    border: 'none',
                    borderRadius: '12px',
                    padding: '14px',
                    fontSize: '15px',
                    fontWeight: '900',
                    cursor: loading ? 'not-allowed' : 'pointer',
                    marginTop: '6px',
                    boxShadow: '0 8px 25px rgba(255, 107, 53, 0.4)'
                  }}
                >
                  {loading ? '⏳ Generating Pass...' : '🎟️ Generate Official Entrance Pass'}
                </motion.button>
              </form>
            )}

            {/* TAB 2: RETRIEVE MY PASS */}
            {activeTab === 'retrieve' && (
              <form onSubmit={handleLookupPass} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <div style={{
                  background: 'rgba(56, 189, 248, 0.08)',
                  border: '1px solid rgba(56, 189, 248, 0.25)',
                  borderRadius: '12px',
                  padding: '12px 16px',
                  color: '#BAE6FD',
                  fontSize: '13px',
                  lineHeight: '1.5'
                }}>
                  💡 <strong>Forgot to screenshot your QR code?</strong> Enter your Student ID Number or Full Name below to retrieve your official pass instantly.
                </div>

                {lookupError && (
                  <div style={{
                    background: 'rgba(239, 68, 68, 0.15)',
                    border: '1px solid #EF4444',
                    borderRadius: '10px',
                    padding: '10px 14px',
                    color: '#FCA5A5',
                    fontSize: '13px',
                    fontWeight: '600'
                  }}>
                    ⚠️ {lookupError}
                  </div>
                )}

                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#CBD5E1', marginBottom: '4px' }}>
                    ENTER YOUR STUDENT ID OR FULL NAME
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. 24-1725, or Britania, Luigi"
                    value={lookupQuery}
                    onChange={(e) => setLookupQuery(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '12px 14px',
                      borderRadius: '10px',
                      background: 'rgba(0,0,0,0.4)',
                      border: '1px solid rgba(255,255,255,0.15)',
                      color: '#FFF',
                      fontSize: '14px',
                      outline: 'none'
                    }}
                  />
                </div>

                <motion.button
                  type="submit"
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  style={{
                    background: 'linear-gradient(135deg, #38BDF8 0%, #0284C7 100%)',
                    color: '#FFF',
                    border: 'none',
                    borderRadius: '12px',
                    padding: '14px',
                    fontSize: '14px',
                    fontWeight: '900',
                    cursor: 'pointer',
                    marginTop: '4px',
                    boxShadow: '0 8px 25px rgba(56, 189, 248, 0.4)'
                  }}
                >
                  🔍 Look Up & View My Entrance Pass
                </motion.button>
              </form>
            )}
          </div>
        )}

        {/* Footer info */}
        <div style={{
          marginTop: '18px',
          paddingTop: '12px',
          borderTop: '1px solid rgba(255, 255, 255, 0.1)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          fontSize: '11px',
          color: '#94A3B8'
        }}>
          <div>⚡ Powered by SSG &bull; URS Pililla Campus</div>
          <div style={{ color: '#FFD100', fontWeight: '700' }}>Official Ticketing Suite</div>
        </div>
      </motion.div>
    </div>
  );
}
