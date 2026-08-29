import React, { useState, useRef } from 'react';
import { QRCodeCanvas } from 'qrcode.react';
import html2canvas from 'html2canvas';
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

export default function StudentPortal({ onTicketGenerated, registrationLocked = false }) {
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
  const badgeRef = useRef(null);

  // Show locked registration gate screen
  if (registrationLocked) {
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
          <p style={{ color: '#94A3B8', fontSize: '14px', lineHeight: '1.7', margin: '0 0 28px' }}>
            The <strong style={{ color: '#FFF' }}>URSPANTROPIKO 2026</strong> registration portal has been temporarily locked by the SSG Admin. Please wait for the official opening or contact your class representative.
          </p>
          <div style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: '10px',
            justifyContent: 'center',
            marginBottom: '24px'
          }}>
            {[
              { icon: '🌴', text: 'URSP Acquaintance Party' },
              { icon: '📅', text: 'Sept 17–18, 2026' },
              { icon: '📍', text: 'URS Pililla Campus' }
            ].map(p => (
              <span key={p.text} style={{
                padding: '6px 14px',
                borderRadius: '20px',
                background: 'rgba(255,255,255,0.06)',
                border: '1px solid rgba(255,255,255,0.12)',
                color: '#CBD5E1',
                fontSize: '12px',
                fontWeight: '700'
              }}>{p.icon} {p.text}</span>
            ))}
          </div>
          <div style={{
            padding: '14px 18px',
            background: 'rgba(239,68,68,0.1)',
            border: '1px solid rgba(239,68,68,0.25)',
            borderRadius: '12px',
            color: '#FCA5A5',
            fontSize: '12px',
            lineHeight: '1.6'
          }}>
            ⚠️ Registration will re-open once the SSG Admin unlocks the portal. Check back soon!
          </div>
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
      if (registrationLocked) {
        throw new Error('Registration is currently closed by the SSG Admin. Please check back later.');
      }
      const sanitizedStudentId = sanitizeStudentId(studentId);
      const cleanLastName = sanitizeText(lastName).trim();
      const cleanFirstName = sanitizeText(firstName).trim();
      const rawMI = sanitizeText(middleInitial).trim().toUpperCase().replace(/\./g, '');

      if (!sanitizedStudentId) {
        throw new Error('Please enter a valid Student ID.');
      }
      if (!cleanLastName || !cleanFirstName) {
        throw new Error('Please enter both your Surname and First Name.');
      }

      // Mandatory format: Surname, FirstName M.I. (e.g. Britania, Luigi Emanuel E.)
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
        const { data, error: sbError } = await supabase
          .from('attendees')
          .insert([newAttendee])
          .select();

        if (sbError) {
          console.warn('Supabase insert notice (fallback to cloud sync active):', sbError.message);
        }
      } catch (err) {}

      // Cross-Device Real-Time Cloud Broadcast
      try {
        const existingData = localStorage.getItem('ursp_masterlist_attendees_v5');
        let currentList = existingData ? JSON.parse(existingData) : [];
        currentList = [newAttendee, ...currentList.filter(t => t.ticket_code !== newAttendee.ticket_code && t.student_id !== newAttendee.student_id)];
        localStorage.setItem('ursp_masterlist_attendees_v5', JSON.stringify(currentList));

        const registrationPing = {
          type: 'registration',
          title: '🎉 STUDENT REGISTERED',
          message: `${newAttendee.full_name} (${newAttendee.student_id} • ${newAttendee.ticket_code}) was registered to the masterlist.`,
          ticket_code: newAttendee.ticket_code,
          department: newAttendee.department
        };

        try {
          const rawDel = localStorage.getItem('ursp_masterlist_deleted_v5');
          if (rawDel) {
            const delSet = new Set(JSON.parse(rawDel));
            delSet.delete(newAttendee.ticket_code);
            localStorage.setItem('ursp_masterlist_deleted_v5', JSON.stringify(Array.from(delSet)));
          }
        } catch(e) {}

        // Real-Time Push to all connected PC Admins & Devices
        broadcastCloudUpdate(currentList, registrationPing);
      } catch (e) {
        console.error('Cloud broadcast sync notice:', e);
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

  const handleDownloadBadge = async () => {
    if (!badgeRef.current || !ticket) return;
    try {
      const originalCanvas = badgeRef.current.querySelector('canvas');

      const canvas = await html2canvas(badgeRef.current, {
        scale: 3,
        useCORS: true,
        allowTaint: true,
        backgroundColor: '#0F172A',
        logging: false,
        onclone: (clonedDoc) => {
          const clonedCanvas = clonedDoc.querySelector('.badge-qr-container canvas');
          if (originalCanvas && clonedCanvas) {
            clonedCanvas.width = originalCanvas.width;
            clonedCanvas.height = originalCanvas.height;
            const ctx = clonedCanvas.getContext('2d');
            if (ctx) {
              ctx.drawImage(originalCanvas, 0, 0);
            }
          }
        }
      });
      const image = canvas.toDataURL('image/png');
      const link = document.createElement('a');
      link.href = image;
      link.download = `URSPANTROPIKO_2026_TICKET_${ticket.ticket_code}.png`;
      link.click();
    } catch (err) {
      alert('Could not download image badge. Please take a screenshot of your ticket!');
    }
  };

  return (
    <div className="portal-container">
      <motion.div
        className="portal-glass-card"
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.4 }}
      >
        {/* Hero Poster Banner */}
        <motion.div
          className="portal-poster-hero"
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.1, duration: 0.5, type: 'spring' }}
          style={{
            position: 'relative',
            overflow: 'hidden',
            borderRadius: '16px',
            marginBottom: '16px',
            boxShadow: '0 12px 35px rgba(0,0,0,0.6)',
            border: '1.5px solid rgba(255, 209, 0, 0.4)'
          }}
        >
          <img
            src="/poster.jpg"
            alt="URSPANTROPIKO Acquaintance Party Poster"
            className="portal-poster-img"
            style={{ width: '100%', height: 'auto', maxHeight: '260px', objectFit: 'cover', display: 'block' }}
          />
          <div className="portal-poster-overlay" style={{
            position: 'absolute',
            inset: 0,
            background: 'linear-gradient(to top, rgba(0,0,0,0.85) 0%, rgba(0,0,0,0.2) 50%, transparent 100%)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'flex-end',
            padding: '16px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', marginBottom: '6px' }}>
              <motion.img
                src="/urs_logo.png"
                alt="University of Rizal System Main Seal"
                className="portal-hero-logo"
                whileHover={{ scale: 1.1, rotate: [0, -5, 5, 0] }}
                style={{
                  width: '56px',
                  height: '56px',
                  borderRadius: '50%',
                  border: '2.5px solid #38BDF8',
                  boxShadow: '0 0 25px rgba(56, 189, 248, 0.85), 0 6px 20px rgba(0, 0, 0, 0.8)',
                  objectFit: 'contain',
                  background: '#FFF'
                }}
              />
              <motion.img
                src="/logo.png"
                alt="URSP SSG Official Logo"
                className="portal-hero-logo"
                whileHover={{ scale: 1.1, rotate: [0, 5, -5, 0] }}
                style={{
                  width: '56px',
                  height: '56px',
                  borderRadius: '50%',
                  border: '2.5px solid #FFD100',
                  boxShadow: '0 0 25px rgba(255, 209, 0, 0.85), 0 6px 20px rgba(0, 0, 0, 0.8)',
                  objectFit: 'contain',
                  background: '#FFF'
                }}
              />
            </div>
            <h1 style={{
              fontFamily: "'Pacifico', cursive",
              fontSize: '24px',
              color: '#FFFFFF',
              textShadow: '0 2px 10px rgba(255, 107, 53, 0.8), 0 0 25px rgba(255, 209, 0, 0.5)',
              margin: '0 0 4px 0',
              lineHeight: 1.2,
              textAlign: 'center'
            }}>
              URSP Acquaintance Party
            </h1>
            <p style={{
              fontFamily: "'Fredoka', sans-serif",
              fontSize: '10px',
              fontWeight: '700',
              color: 'rgba(255, 255, 255, 0.9)',
              textTransform: 'uppercase',
              letterSpacing: '1px',
              margin: 0,
              textAlign: 'center'
            }}>
              URSPANTROPIKO: ONE ISLAND, ONE CAMPUS, ONE IDENTITY — RED HAWKS SOARING IN UNITY
            </p>
          </div>
        </motion.div>

        <div className="portal-event-strip">
          <div className="event-strip-item">
            <span>📅 Sept 17–18</span>
          </div>
          <div className="event-strip-item">
            <span>⏰ 5PM – 5AM</span>
          </div>
          <div className="event-strip-item">
            <span>📍 URS Gym</span>
          </div>
        </div>

        {!ticket ? (
          <motion.form
            onSubmit={handleGenerateTicket}
            className="portal-form"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            transition={{ delay: 0.2, duration: 0.3 }}
          >
            {error && <div className="portal-alert-error">{error}</div>}

            <div style={{ marginBottom: '16px' }}>
              <label className="portal-label" style={{ marginBottom: '8px' }}>Select Your College Division:</label>
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
                    </motion.button>
                  );
                })}
              </div>
            </div>

            <motion.div
              className="portal-form-group"
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.3, duration: 0.3 }}
              style={{ marginBottom: '14px' }}
            >
              <label className="portal-label">Student Number / ID *</label>
              <input
                type="text"
                placeholder="e.g. 2024-04001 or 24-1725"
                value={studentId}
                onChange={(e) => setStudentId(e.target.value)}
                required
                className="portal-input"
                style={{
                  background: 'rgba(0, 0, 0, 0.55)',
                  border: '1.5px solid rgba(255, 255, 255, 0.15)',
                  boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.5)',
                  height: '44px',
                  fontSize: '14px'
                }}
              />
            </motion.div>

            {/* Clean Structured Name Block: Perfectly Aligned 2-Row Layout */}
            <motion.div
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.4, duration: 0.3 }}
              style={{ marginBottom: '14px' }}
            >
              {/* Row 1: Surname */}
              <div className="portal-form-group" style={{ marginBottom: '12px' }}>
                <label className="portal-label">Surname (Apelyido) *</label>
                <input
                  type="text"
                  placeholder="e.g. Britania"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  required
                  className="portal-input"
                  style={{
                    background: 'rgba(0, 0, 0, 0.55)',
                    border: '1.5px solid rgba(255, 255, 255, 0.15)',
                    boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.5)',
                    height: '44px',
                    fontSize: '14px'
                  }}
                />
              </div>

              {/* Row 2: First Name + Middle Initial (Optional) - Strictly Leveled */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 80px', gap: '8px', alignItems: 'flex-start' }}>
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <label className="portal-label" style={{ fontSize: '11px', whiteSpace: 'nowrap', height: '18px', display: 'flex', alignItems: 'center', marginBottom: '6px' }}>
                    First Name (Pangalan) *
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Luigi Emanuel"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    required
                    className="portal-input"
                    style={{
                      background: 'rgba(0, 0, 0, 0.55)',
                      border: '1.5px solid rgba(255, 255, 255, 0.15)',
                      boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.5)',
                      height: '44px',
                      fontSize: '14px',
                      width: '100%',
                      boxSizing: 'border-box'
                    }}
                  />
                </div>

                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <label className="portal-label" style={{ fontSize: '11px', textAlign: 'center', whiteSpace: 'nowrap', height: '18px', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '6px' }}>
                    M.I. <span style={{ opacity: 0.6, fontSize: '10px', marginLeft: '2px' }}>(Opt)</span>
                  </label>
                  <input
                    type="text"
                    maxLength={3}
                    placeholder="M."
                    value={middleInitial}
                    onChange={(e) => setMiddleInitial(e.target.value)}
                    className="portal-input"
                    style={{
                      background: 'rgba(0, 0, 0, 0.55)',
                      border: '1.5px solid rgba(255, 255, 255, 0.15)',
                      boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.5)',
                      textAlign: 'center',
                      height: '44px',
                      fontSize: '14px',
                      width: '100%',
                      boxSizing: 'border-box'
                    }}
                  />
                </div>
              </div>
            </motion.div>

            <motion.div
              className="portal-form-row"
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.5, duration: 0.3 }}
              style={{ marginBottom: '18px' }}
            >
              <div className="portal-form-group" style={{ flex: 1 }}>
                <label className="portal-label">Year Level *</label>
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

              <div className="portal-form-group" style={{ flex: 1.2 }}>
                <label className="portal-label">Program &amp; Section *</label>
                <input
                  type="text"
                  placeholder={department === 'College of Education' ? 'e.g. BSED 3-A' : department === 'College of Social Sciences' ? 'e.g. BS-PSYCH 1-A' : 'e.g. BSBA 1-A'}
                  value={section}
                  onChange={(e) => setSection(e.target.value)}
                  required
                  className="portal-input"
                />
              </div>
            </motion.div>

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
                background: selectedCollegeObj?.bgColor || '#FEF3C7',
                color: selectedCollegeObj?.textColor || '#92400E',
                padding: '4px 14px',
                borderRadius: '20px',
                fontWeight: '800',
                fontSize: '0.82rem',
                border: `1px solid ${selectedCollegeObj?.borderColor || '#FDE68A'}`,
                marginBottom: '12px'
              }}>
                {selectedCollegeObj?.icon || '🎓'} {ticket.department} ({ticket.year_level})
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
                <QRCodeCanvas
                  value={ticket.ticket_code}
                  size={180}
                  level="H"
                  includeMargin={true}
                  fgColor="#000000"
                  bgColor="#FFFFFF"
                />
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
                onClick={handleDownloadBadge}
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
          marginTop: '16px',
          paddingTop: '12px',
          borderTop: '1px solid rgba(255, 255, 255, 0.1)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '8px',
          flexWrap: 'nowrap'
        }}>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ fontSize: '11px', fontWeight: '700', color: '#FEF08A', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              ⚡ Powered by SSG &bull; URS Pililla
            </div>
            <div style={{ fontSize: '10px', color: '#94A3B8', marginTop: '2px', display: 'flex', alignItems: 'center', gap: '4px', flexWrap: 'wrap' }}>
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
                  padding: '1px 6px',
                  borderRadius: '4px',
                  border: '1px solid rgba(225, 48, 108, 0.35)',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '3px',
                  fontSize: '10px'
                }}
              >
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ flexShrink: 0 }}>
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

          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
            <img
              src="/urs_logo.png"
              alt="URS Main Seal"
              style={{
                width: '28px',
                height: '28px',
                borderRadius: '50%',
                border: '1.5px solid #38BDF8',
                background: '#FFF',
                objectFit: 'contain'
              }}
            />
            <img
              src="/logo.png"
              alt="URSP SSG Seal"
              style={{
                width: '28px',
                height: '28px',
                borderRadius: '50%',
                border: '1.5px solid #FFD100',
                background: '#FFF',
                objectFit: 'contain'
              }}
            />
          </div>
        </div>
      </motion.div>
    </div>
  );
}
