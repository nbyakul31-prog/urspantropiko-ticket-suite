import React, { useState, useRef } from 'react';
import QRCode from 'qrcode.react';
import html2canvas from 'html2canvas';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from './lib/supabase';
import { sanitizeText, sanitizeStudentId } from './lib/security';

const COLLEGES_DATA = [
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
  },
  {
    name: 'College of Business',
    short: 'CB',
    icon: '💼',
    color: '#10B981',
    bgColor: '#D1FAE5',
    textColor: '#065F46',
    borderColor: '#A7F3D0',
    sampleSections: ['BSBA 1-A', 'BSBA 2-A', 'BSBA 3-A', 'BSBA 4-B', 'BSA 1-A', 'BSA 2-A', 'BSHM 3-A']
  }
];

export default function StudentPortal({ onTicketGenerated }) {
  const [studentId, setStudentId] = useState('');
  const [fullName, setFullName] = useState('');
  const [department, setDepartment] = useState('College of Education');
  const [yearLevel, setYearLevel] = useState('3rd Year');
  const [section, setSection] = useState('BSED 3-A');
  const [ticket, setTicket] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const badgeRef = useRef(null);

  const selectedCollegeObj = COLLEGES_DATA.find(c => c.name === department) || COLLEGES_DATA[0];

  const handleSelectCollege = (colName) => {
    setDepartment(colName);
    const col = COLLEGES_DATA.find(c => c.name === colName);
    if (col && col.sampleSections.length > 0) {
      setSection(col.sampleSections[0]);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const cleanStudentId = sanitizeStudentId(studentId);
    const cleanFullName = sanitizeText(fullName);
    const cleanSection = sanitizeText(section);

    if (!cleanStudentId || !cleanFullName) {
      setError('Please provide a valid Student ID and Full Name.');
      setLoading(false);
      return;
    }

    const ticketCode = 'TKT-' + Math.floor(10000 + Math.random() * 90000);

    const newAttendee = {
      id: 'REG-' + Date.now(),
      ticket_code: ticketCode,
      student_id: cleanStudentId,
      full_name: cleanFullName,
      program_section: cleanSection,
      department: sanitizeText(department),
      year_level: sanitizeText(yearLevel),
      payment_status: 'unpaid',
      attendance_status: 'not_attended',
      created_at: new Date().toISOString()
    };

    try {
      // 1. Direct LocalStorage Sync Backup
      try {
        const raw = localStorage.getItem('ursp_masterlist_attendees_v3');
        const list = raw ? JSON.parse(raw) : [];
        const nextList = [newAttendee, ...list.filter(t => t.ticket_code !== newAttendee.ticket_code && t.student_id !== newAttendee.student_id)];
        localStorage.setItem('ursp_masterlist_attendees_v3', JSON.stringify(nextList));
        if (typeof BroadcastChannel !== 'undefined') {
          const ch = new BroadcastChannel('ursp_live_sync_channel');
          ch.postMessage({ type: 'SYNC_TICKETS', tickets: nextList });
          ch.close();
        }
      } catch (e) {}

      // 2. Notify App parent component
      if (onTicketGenerated) {
        await onTicketGenerated(newAttendee);
      }

      setTicket(newAttendee);
    } catch (err) {
      console.error('Registration handler:', err);
      setTicket(newAttendee);
    } finally {
      setLoading(false);
    }
  };

  const downloadBadge = async () => {
    if (!badgeRef.current) return;
    try {
      const canvas = await html2canvas(badgeRef.current, {
        backgroundColor: '#0F172A',
        scale: 2
      });
      const imageData = canvas.toDataURL('image/png');
      const link = document.createElement('a');
      link.href = imageData;
      link.download = `Ticket-Pass-${ticket?.ticket_code || 'student'}.png`;
      link.click();
    } catch (err) {
      console.error('Download error:', err);
    }
  };

  return (
    <motion.div
      className="portal-mobile-wrapper"
      initial={{ opacity: 0, y: 25 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 20 }}
      transition={{ duration: 0.4 }}
    >
      <motion.div
        className="portal-glass-card"
        whileHover={{ boxShadow: '0 35px 95px -10px rgba(0, 0, 0, 0.9), 0 0 60px rgba(255, 107, 53, 0.45)' }}
      >
        {/* Hero Poster Banner */}
        <motion.div
          className="portal-poster-hero"
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.1, duration: 0.5, type: 'spring' }}
          style={{ position: 'relative', overflow: 'hidden', borderRadius: '16px', marginBottom: '16px', boxShadow: '0 12px 35px rgba(0,0,0,0.6)' }}
        >
          <img
            src="/poster.jpg"
            alt="URSPANTROPIKO Acquaintance Party Poster"
            className="portal-poster-img"
            style={{ width: '100%', height: 'auto', maxHeight: '280px', objectFit: 'cover', display: 'block' }}
          />
          <div className="portal-poster-overlay" style={{
            position: 'absolute',
            inset: 0,
            background: 'linear-gradient(to top, rgba(0,0,0,0.75) 0%, rgba(0,0,0,0.1) 50%, transparent 100%)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'flex-end',
            padding: '16px'
          }}>
            <motion.img
              src="/logo.png"
              alt="URSP SSG Official Logo"
              className="portal-hero-logo"
              whileHover={{ scale: 1.1 }}
              style={{
                width: '74px',
                height: '74px',
                borderRadius: '50%',
                border: '3px solid #FFD100',
                boxShadow: '0 0 25px rgba(255, 209, 0, 0.85), 0 6px 20px rgba(0, 0, 0, 0.8)',
                objectFit: 'contain',
                background: '#FFF',
                marginBottom: '8px'
              }}
            />
            <div style={{
              fontFamily: "'Fredoka', sans-serif",
              fontSize: '11px',
              fontWeight: '700',
              color: '#FFD100',
              textTransform: 'uppercase',
              letterSpacing: '1px',
              textShadow: '0 2px 8px rgba(0,0,0,0.8)'
            }}>
              URSPANTROPIKO &bull; PILILLA CAMPUS
            </div>
          </div>
        </motion.div>

        {/* Event Info Strip */}
        <motion.div
          className="portal-event-strip"
          initial={{ opacity: 0, y: -5 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.3 }}
        >
          <div className="event-strip-item">
            <span className="event-strip-icon">📅</span>
            <span>Sept 17–18, 2026</span>
          </div>
          <div className="event-strip-divider"></div>
          <div className="event-strip-item">
            <span className="event-strip-icon">⏰</span>
            <span>5:00 PM – 5:00 AM</span>
          </div>
          <div className="event-strip-divider"></div>
          <div className="event-strip-item">
            <span className="event-strip-icon">📍</span>
            <span>URS Pililla Gym</span>
          </div>
        </motion.div>

        {!ticket ? (
          <motion.form
            onSubmit={handleSubmit}
            className="portal-form"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            transition={{ delay: 0.2, duration: 0.3 }}
          >
            {error && <div className="portal-alert-error">{error}</div>}

            {/* 3 COLLEGES INTERACTIVE SELECTOR CARDS */}
            <div style={{ marginBottom: '16px' }}>
              <label className="portal-label" style={{ marginBottom: '8px' }}>
                Select Your College Division:
              </label>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' }}>
                {COLLEGES_DATA.map(col => {
                  const isSelected = department === col.name;
                  return (
                    <motion.button
                      key={col.name}
                      type="button"
                      whileHover={{ scale: 1.04, y: -2 }}
                      whileTap={{ scale: 0.96 }}
                      onClick={() => handleSelectCollege(col.name)}
                      style={{
                        background: isSelected ? col.bgColor : 'rgba(0, 0, 0, 0.45)',
                        border: isSelected ? `2px solid ${col.color}` : '1px solid rgba(255, 255, 255, 0.12)',
                        color: isSelected ? col.textColor : '#E2E8F0',
                        borderRadius: '10px',
                        padding: '10px 6px',
                        cursor: 'pointer',
                        textAlign: 'center',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        gap: '4px',
                        boxShadow: isSelected ? `0 0 16px ${col.color}66` : 'none',
                        transition: 'all 0.25s ease'
                      }}
                    >
                      <span style={{ fontSize: '1.2rem' }}>{col.icon}</span>
                      <span style={{ fontSize: '0.75rem', fontWeight: '800' }}>{col.short}</span>
                      <span style={{ fontSize: '0.62rem', opacity: 0.85, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '100%' }}>
                        {col.name.replace('College of ', '')}
                      </span>
                    </motion.button>
                  );
                })}
              </div>
            </div>

            {/* Student ID Input */}
            <motion.div
              className="portal-form-group"
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.3, duration: 0.3 }}
            >
              <label className="portal-label">Student Number / ID</label>
              <input
                type="text"
                placeholder="e.g. 2022-09412"
                value={studentId}
                onChange={(e) => setStudentId(e.target.value)}
                required
                className="portal-input"
                style={{
                  background: 'rgba(0, 0, 0, 0.55)',
                  border: '1.5px solid rgba(255, 255, 255, 0.15)',
                  boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.5)'
                }}
              />
            </motion.div>

            {/* Full Name Input */}
            <motion.div
              className="portal-form-group"
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.4, duration: 0.3 }}
            >
              <label className="portal-label">Full Name</label>
              <input
                type="text"
                placeholder="e.g. Maria Clara Santos"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                required
                className="portal-input"
                style={{
                  background: 'rgba(0, 0, 0, 0.55)',
                  border: '1.5px solid rgba(255, 255, 255, 0.15)',
                  boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.5)'
                }}
              />
            </motion.div>

            {/* Year Level & Section */}
            <motion.div
              className="portal-form-row"
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.5, duration: 0.3 }}
            >
              <div className="portal-form-group" style={{ flex: 1 }}>
                <label className="portal-label">Year Level</label>
                <select
                  value={yearLevel}
                  onChange={(e) => setYearLevel(e.target.value)}
                  className="portal-select"
                  required
                >
                  <option value="1st Year">1st Year</option>
                  <option value="2nd Year">2nd Year</option>
                  <option value="3rd Year">3rd Year</option>
                  <option value="4th Year">4th Year</option>
                </select>
              </div>

              <div className="portal-form-group" style={{ flex: 1 }}>
                <label className="portal-label">Section</label>
                <input
                  type="text"
                  placeholder={department === 'College of Education' ? 'e.g. BSED 3-A, BEED 2-B' : department === 'College of Social Sciences' ? 'e.g. AB-POLSCI 2-A, BS-PSYCH 1-A' : 'e.g. BSBA 3-A, BSA 1-A'}
                  value={section}
                  onChange={(e) => setSection(e.target.value)}
                  required
                  className="portal-input"
                />
              </div>
            </motion.div>

            {/* Submit Button */}
            <motion.button
              type="submit"
              disabled={loading}
              className="portal-btn-primary"
              whileHover={{ scale: 1.03, y: -2 }}
              whileTap={{ scale: 0.97 }}
              style={{
                background: 'linear-gradient(135deg, #FF6B35 0%, #FFD100 100%)',
                boxShadow: '0 8px 25px rgba(255, 107, 53, 0.5)',
                color: '#000',
                fontWeight: '900',
                fontSize: '1.05rem',
                letterSpacing: '0.5px'
              }}
            >
              {loading ? 'Generating Your Official Pass...' : 'Generate Ticket & QR Pass ➔'}
            </motion.button>
          </motion.form>
        ) : (
          <motion.div
            className="portal-badge-result"
            initial={{ opacity: 0, scale: 0.92 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, y: 20 }}
            transition={{ delay: 0.2, duration: 0.4 }}
          >
            {/* Downloadable Visual Badge Pass */}
            <motion.div
              className="portal-badge-card"
              ref={badgeRef}
              whileHover={{ scale: 1.02 }}
              style={{
                background: 'linear-gradient(135deg, #0F172A 0%, #090D16 100%)',
                border: '2px solid #FFD100',
                boxShadow: '0 25px 60px rgba(0, 0, 0, 0.8), 0 0 35px rgba(255, 209, 0, 0.35)',
                borderRadius: '20px',
                padding: '24px 20px',
                textAlign: 'center'
              }}
            >
              <div className="badge-ribbon-tag">OFFICIAL STUDENT ENTRANCE PASS</div>
              <div className="badge-event-title" style={{ fontSize: '1.15rem', color: '#FFD100' }}>
                URSPANTROPIKO 2026
              </div>

              <div style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                background: selectedCollegeObj.bgColor,
                color: selectedCollegeObj.textColor,
                padding: '4px 14px',
                borderRadius: '20px',
                fontWeight: '800',
                fontSize: '0.82rem',
                border: `1px solid ${selectedCollegeObj.borderColor}`,
                marginBottom: '12px'
              }}>
                {selectedCollegeObj.icon} {ticket.department} ({ticket.year_level})
              </div>

              <div className="badge-code-display" style={{ fontSize: '1.75rem', fontWeight: '900', color: '#38BDF8', letterSpacing: '1px' }}>
                {ticket.ticket_code}
              </div>
              <div className="badge-student-name" style={{ fontSize: '1.3rem', fontWeight: '800', color: '#FFF', marginTop: '4px' }}>
                {ticket.full_name}
              </div>
              <div className="badge-student-meta" style={{ fontSize: '0.85rem', color: '#94A3B8', marginTop: '2px' }}>
                ID: <b>{ticket.student_id}</b> &bull; Section: <b>{ticket.program_section}</b>
              </div>

              <motion.div
                className="badge-qr-container"
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                style={{
                  background: '#FFF',
                  padding: '16px',
                  borderRadius: '16px',
                  display: 'inline-flex',
                  margin: '16px auto',
                  boxShadow: '0 8px 25px rgba(0,0,0,0.5)'
                }}
              >
                <QRCode value={ticket.ticket_code} size={160} level="H" />
              </motion.div>

              <div className="badge-warning-box" style={{
                background: 'rgba(245, 158, 11, 0.15)',
                border: '1px solid rgba(245, 158, 11, 0.4)',
                borderRadius: '8px',
                padding: '10px 14px',
                fontSize: '0.75rem',
                color: '#FEF3C7',
                marginTop: '10px'
              }}>
                ⚠️ <strong>Payment Notice:</strong> Submit payment to your Class President / Treasurer. Gate scanner unlocks once verified.
              </div>
            </motion.div>

            {/* Action Buttons */}
            <motion.div
              className="portal-badge-actions"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4, duration: 0.3 }}
              style={{ marginTop: '16px', display: 'flex', flexDirection: 'column', gap: '8px' }}
            >
              <motion.button
                className="portal-btn-primary"
                onClick={downloadBadge}
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.97 }}
              >
                📥 Download Pass as Image (PNG)
              </motion.button>
              <motion.button
                className="portal-btn-secondary"
                onClick={() => setTicket(null)}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                📝 Register Another Student
              </motion.button>
            </motion.div>
          </motion.div>
        )}

        {/* Student Portal Watermark Footer */}
        <div style={{
          marginTop: '20px',
          paddingTop: '16px',
          borderTop: '1px solid rgba(255, 255, 255, 0.1)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '12px'
        }}>
          <div>
            <div style={{ fontSize: '0.72rem', fontWeight: '700', color: '#FEF08A' }}>
              ⚡ Powered by SSG • URS Pililla Campus
            </div>
            <div style={{ fontSize: '0.68rem', color: '#94A3B8', marginTop: '2px', display: 'flex', alignItems: 'center', gap: '4px' }}>
              <span>Designed by</span>
              <a 
                href="https://instagram.com/noir_et_blancc66" 
                target="_blank" 
                rel="noreferrer" 
                style={{ 
                  color: '#E0F2FE', 
                  fontWeight: '700', 
                  textDecoration: 'none',
                  background: 'linear-gradient(135deg, rgba(225, 48, 108, 0.25), rgba(131, 58, 180, 0.25))',
                  padding: '2px 7px',
                  borderRadius: '6px',
                  border: '1px solid rgba(225, 48, 108, 0.35)',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px'
                }}
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ flexShrink: 0 }}>
                  <rect x="2" y="2" width="20" height="20" rx="5" stroke="url(#ig-grad-portal)" strokeWidth="2.2" />
                  <circle cx="12" cy="12" r="4.5" stroke="url(#ig-grad-portal)" strokeWidth="2.2" />
                  <circle cx="17.5" cy="6.5" r="1.2" fill="url(#ig-grad-portal)" />
                  <defs>
                    <linearGradient id="ig-grad-portal" x1="2" y1="22" x2="22" y2="2" gradientUnits="userSpaceOnUse">
                      <stop stopColor="#FFDC80" />
                      <stop offset="0.25" stopColor="#FCAF45" />
                      <stop offset="0.5" stopColor="#F56040" />
                      <stop offset="0.75" stopColor="#FD1D1D" />
                      <stop offset="1" stopColor="#833AB4" />
                    </linearGradient>
                  </defs>
                </svg>
                <span>@noir_et_blancc66</span>
              </a>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <img
              src="/logo.png"
              alt="URSP SSG Seal"
              style={{
                width: '32px',
                height: '32px',
                borderRadius: '50%',
                border: '1.5px solid #FFD100',
                background: '#FFF',
                objectFit: 'contain'
              }}
            />
            <img
              src="/urs_logo.png"
              alt="URS Main Seal"
              style={{
                width: '32px',
                height: '32px',
                borderRadius: '50%',
                border: '1.5px solid #38BDF8',
                background: '#FFF',
                objectFit: 'contain'
              }}
            />
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}
