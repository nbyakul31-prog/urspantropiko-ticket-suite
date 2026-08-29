import React, { useState, useRef } from 'react';
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

  // Direct High-Resolution Canvas Pass Generator (100% crisp QR Code, zero blank box bugs)
  const handleDownloadBadge = async () => {
    if (!ticket) return;
    try {
      const qrCanvas = badgeRef.current?.querySelector('canvas');
      if (!qrCanvas) {
        alert('QR code is still preparing. Please tap Download again in a second.');
        return;
      }

      const width = 800;
      const height = 1120;
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');

      // Outer background
      ctx.fillStyle = '#060B18';
      ctx.fillRect(0, 0, width, height);

      // Inner card box with golden border
      const pad = 28;
      ctx.strokeStyle = '#FFD100';
      ctx.lineWidth = 4;
      ctx.fillStyle = '#0F172A';
      ctx.beginPath();
      if (typeof ctx.roundRect === 'function') {
        ctx.roundRect(pad, pad, width - pad * 2, height - pad * 2, 28);
      } else {
        ctx.rect(pad, pad, width - pad * 2, height - pad * 2);
      }
      ctx.fill();
      ctx.stroke();

      // Top Tag Pill
      const tagW = 340;
      const tagH = 40;
      const tagX = (width - tagW) / 2;
      const tagY = 65;
      const tagGrad = ctx.createLinearGradient(tagX, tagY, tagX + tagW, tagY);
      tagGrad.addColorStop(0, '#F97316');
      tagGrad.addColorStop(1, '#EAB308');
      ctx.fillStyle = tagGrad;
      ctx.beginPath();
      if (typeof ctx.roundRect === 'function') {
        ctx.roundRect(tagX, tagY, tagW, tagH, 20);
      } else {
        ctx.rect(tagX, tagY, tagW, tagH);
      }
      ctx.fill();

      ctx.fillStyle = '#000000';
      ctx.font = 'bold 15px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('OFFICIAL STUDENT ENTRANCE PASS', width / 2, tagY + tagH / 2);

      // Event Title
      ctx.fillStyle = '#FFD100';
      ctx.font = '900 38px sans-serif';
      ctx.fillText('URSPANTROPIKO 2026', width / 2, 160);

      // Department & Year Level Pill
      const deptText = `💼 ${ticket.department} (${ticket.year_level || '1st Year'})`;
      ctx.font = 'bold 16px sans-serif';
      const deptMetrics = ctx.measureText(deptText);
      const deptPillW = Math.max(deptMetrics.width + 44, 280);
      const deptPillH = 38;
      const deptPillX = (width - deptPillW) / 2;
      const deptPillY = 200;

      ctx.fillStyle = '#D1FAE5';
      ctx.beginPath();
      if (typeof ctx.roundRect === 'function') {
        ctx.roundRect(deptPillX, deptPillY, deptPillW, deptPillH, 19);
      } else {
        ctx.rect(deptPillX, deptPillY, deptPillW, deptPillH);
      }
      ctx.fill();
      ctx.strokeStyle = '#10B981';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      ctx.fillStyle = '#065F46';
      ctx.fillText(deptText, width / 2, deptPillY + deptPillH / 2);

      // Ticket Code (Cyan)
      ctx.fillStyle = '#38BDF8';
      ctx.font = '900 52px monospace, sans-serif';
      ctx.fillText(ticket.ticket_code, width / 2, 305);

      // Student Full Name
      ctx.fillStyle = '#FFFFFF';
      ctx.font = '800 30px sans-serif';
      ctx.fillText(ticket.full_name, width / 2, 360);

      // Student ID & Section Meta
      ctx.fillStyle = '#94A3B8';
      ctx.font = '600 19px sans-serif';
      ctx.fillText(`ID: ${ticket.student_id}   •   Section: ${ticket.program_section}`, width / 2, 405);

      // QR Code Container Box (White Rounded Rect)
      const qrBoxSize = 360;
      const qrBoxX = (width - qrBoxSize) / 2;
      const qrBoxY = 450;

      ctx.fillStyle = '#FFFFFF';
      ctx.beginPath();
      if (typeof ctx.roundRect === 'function') {
        ctx.roundRect(qrBoxX, qrBoxY, qrBoxSize, qrBoxSize, 24);
      } else {
        ctx.rect(qrBoxX, qrBoxY, qrBoxSize, qrBoxSize);
      }
      ctx.fill();

      // Direct QR Code pixel transfer from live canvas element
      const qrPad = 22;
      ctx.drawImage(
        qrCanvas,
        qrBoxX + qrPad,
        qrBoxY + qrPad,
        qrBoxSize - qrPad * 2,
        qrBoxSize - qrPad * 2
      );

      // Bottom Notice Box
      const noticW = width - 120;
      const noticH = 90;
      const noticX = 60;
      const noticY = 855;

      ctx.fillStyle = 'rgba(245, 158, 11, 0.12)';
      ctx.strokeStyle = 'rgba(245, 158, 11, 0.5)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      if (typeof ctx.roundRect === 'function') {
        ctx.roundRect(noticX, noticY, noticW, noticH, 16);
      } else {
        ctx.rect(noticX, noticY, noticW, noticH);
      }
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = '#FEF3C7';
      ctx.font = 'bold 15px sans-serif';
      ctx.fillText('⚠️ Payment Notice: Submit payment to your Class President / Treasurer.', width / 2, noticY + 34);
      ctx.font = '14px sans-serif';
      ctx.fillStyle = '#CBD5E1';
      ctx.fillText('Gate scanner unlocks admission automatically once verified.', width / 2, noticY + 60);

      // Bottom Footer Watermark
      ctx.fillStyle = '#64748B';
      ctx.font = '13px sans-serif';
      ctx.fillText('⚡ Powered by SSG • University of Rizal System Pililla Campus', width / 2, 1005);

      // Download Image as PNG
      const image = canvas.toDataURL('image/png', 1.0);
      const link = document.createElement('a');
      link.href = image;
      link.download = `URSPANTROPIKO_2026_TICKET_${ticket.ticket_code}.png`;
      link.click();
    } catch (err) {
      console.error('Badge download notice:', err);
      alert('Could not download image pass. Please take a screenshot of your ticket!');
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
        {/* Hero Poster Banner with Central Floating SSG Logo */}
        <motion.div
          className="portal-poster-hero"
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.1, duration: 0.5, type: 'spring' }}
          style={{
            position: 'relative',
            overflow: 'hidden',
            borderRadius: '20px',
            marginBottom: '14px',
            boxShadow: '0 15px 40px rgba(0,0,0,0.6)',
            border: '2px solid rgba(255, 209, 0, 0.45)',
            background: '#0B132B'
          }}
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
            background: 'linear-gradient(to top, rgba(11,19,43,0.95) 0%, rgba(11,19,43,0.4) 50%, rgba(0,0,0,0.2) 100%)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '20px 16px',
            textAlign: 'center'
          }}>
            {/* Center Floating SSG Seal */}
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.2, type: 'spring', stiffness: 260 }}
              style={{
                width: '76px',
                height: '76px',
                borderRadius: '50%',
                background: '#FFFFFF',
                border: '3px solid #FFD100',
                boxShadow: '0 8px 30px rgba(0,0,0,0.7), 0 0 20px rgba(255, 209, 0, 0.4)',
                padding: '4px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: '8px'
              }}
            >
              <img
                src="/logo.png"
                alt="SSG Official Seal"
                style={{ width: '100%', height: '100%', objectFit: 'contain' }}
              />
            </motion.div>

            <h1 style={{
              fontSize: '1.85rem',
              fontWeight: '900',
              color: '#FFF',
              textShadow: '0 0 15px rgba(255,209,0,0.6), 0 2px 10px rgba(0,0,0,0.9)',
              margin: '0 0 4px',
              letterSpacing: '0.5px'
            }}>
              URSP Acquaintance Party
            </h1>
            <p style={{
              fontSize: '0.78rem',
              fontWeight: '800',
              color: '#FEF08A',
              letterSpacing: '0.6px',
              textTransform: 'uppercase',
              maxWidth: '90%',
              margin: '0 auto',
              textShadow: '0 1px 8px rgba(0,0,0,0.8)',
              lineHeight: '1.4'
            }}>
              URSPANTROPIKO: ONE ISLAND, ONE CAMPUS, ONE IDENTITY &ndash; RED HAWKS SOARING IN UNITY
            </p>
          </div>
        </motion.div>

        {/* 3-Column Event Details Strip Card */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.4 }}
          style={{
            background: 'rgba(15, 23, 42, 0.85)',
            border: '1px solid rgba(255, 255, 255, 0.12)',
            borderRadius: '16px',
            padding: '12px 8px',
            marginBottom: '18px',
            display: 'grid',
            gridTemplateColumns: '1.1fr 1.1fr 1fr',
            gap: '8px',
            textAlign: 'center'
          }}
        >
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', borderRight: '1px solid rgba(255,255,255,0.08)', paddingRight: '4px' }}>
            <span style={{ fontSize: '11px', color: '#94A3B8', fontWeight: '700' }}>Sept</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginTop: '2px' }}>
              <span style={{ fontSize: '14px' }}>📅</span>
              <span style={{ fontSize: '12.5px', fontWeight: '900', color: '#FFD100' }}>17–18, 2026</span>
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', borderRight: '1px solid rgba(255,255,255,0.08)', paddingRight: '4px' }}>
            <span style={{ fontSize: '11px', color: '#FFD100', fontWeight: '800' }}>5:00 PM –</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginTop: '2px' }}>
              <span style={{ fontSize: '14px' }}>⏰</span>
              <span style={{ fontSize: '12px', fontWeight: '800', color: '#FFD100' }}>5:00 AM</span>
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
            <span style={{ fontSize: '11px', color: '#FFD100', fontWeight: '800' }}>URS</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginTop: '2px' }}>
              <span style={{ fontSize: '14px' }}>📍</span>
              <span style={{ fontSize: '12px', fontWeight: '800', color: '#FFD100' }}>Pililla Gym</span>
            </div>
          </div>
        </motion.div>

        {/* View Mode: PASS DISPLAY */}
        {ticket ? (
          <motion.div
            className="portal-ticket-view"
            initial={{ opacity: 0, scale: 0.9 }}
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

              {/* Prominent Screenshot Reminder Banner */}
              <div style={{
                background: 'linear-gradient(135deg, rgba(245, 158, 11, 0.25) 0%, rgba(217, 119, 6, 0.25) 100%)',
                border: '2px solid #F59E0B',
                borderRadius: '12px',
                padding: '12px 14px',
                color: '#FEF3C7',
                textAlign: 'center',
                margin: '12px 0'
              }}>
                <div style={{ fontSize: '14px', fontWeight: '900', color: '#FFD100', marginBottom: '2px' }}>
                  📸 PLEASE SCREENSHOT YOUR PASS NOW!
                </div>
                <div style={{ fontSize: '12px', color: '#FDE68A' }}>
                  Take a screenshot and save it to your photos gallery to present at the entrance gate.
                </div>
              </div>

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
        ) : (
          /* REGISTRATION FORM VIEW */
          <motion.form
            onSubmit={handleGenerateTicket}
            className="portal-form"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2, duration: 0.4 }}
          >
            {error && (
              <motion.div
                className="portal-alert-error"
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                style={{
                  background: 'rgba(239, 68, 68, 0.15)',
                  border: '1px solid #EF4444',
                  borderRadius: '12px',
                  padding: '12px 16px',
                  color: '#FCA5A5',
                  fontSize: '0.9rem',
                  fontWeight: '600',
                  marginBottom: '16px'
                }}
              >
                ⚠️ {error}
              </motion.div>
            )}

            {/* Student ID Number Input */}
            <div className="portal-form-group">
              <label className="portal-form-label">
                <span>STUDENT ID NUMBER</span>
                <span className="label-required">*</span>
              </label>
              <div className="portal-input-wrapper">
                <input
                  type="text"
                  required
                  placeholder="e.g. 24-1725 or 1434514"
                  className="portal-form-input"
                  value={studentId}
                  onChange={(e) => setStudentId(e.target.value)}
                />
              </div>
            </div>

            {/* Structured 3-Field Name Input (Surname, First Name, Middle Initial) */}
            <div className="portal-name-grid" style={{ display: 'grid', gridTemplateColumns: '2fr 2fr 1fr', gap: '10px' }}>
              <div className="portal-form-group">
                <label className="portal-form-label">
                  <span>SURNAME</span>
                  <span className="label-required">*</span>
                </label>
                <div className="portal-input-wrapper">
                  <input
                    type="text"
                    required
                    placeholder="e.g. Britania"
                    className="portal-form-input"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                  />
                </div>
              </div>

              <div className="portal-form-group">
                <label className="portal-form-label">
                  <span>FIRST NAME</span>
                  <span className="label-required">*</span>
                </label>
                <div className="portal-input-wrapper">
                  <input
                    type="text"
                    required
                    placeholder="e.g. Luigi"
                    className="portal-form-input"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                  />
                </div>
              </div>

              <div className="portal-form-group">
                <label className="portal-form-label">
                  <span>M.I.</span>
                </label>
                <div className="portal-input-wrapper">
                  <input
                    type="text"
                    placeholder="E."
                    maxLength={2}
                    className="portal-form-input"
                    style={{ textAlign: 'center' }}
                    value={middleInitial}
                    onChange={(e) => setMiddleInitial(e.target.value)}
                  />
                </div>
              </div>
            </div>

            {/* Collegiate Department Selector Grid */}
            <div className="portal-form-group">
              <label className="portal-form-label" style={{ color: '#FFD100', fontWeight: '900', fontSize: '12px', letterSpacing: '0.8px' }}>
                <span>SELECT YOUR COLLEGE DIVISION:</span>
                <span className="label-required">*</span>
              </label>
              <div className="portal-college-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' }}>
                {COLLEGES_DATA.map(col => {
                  const isSelected = department === col.name;
                  return (
                    <motion.button
                      key={col.name}
                      type="button"
                      whileHover={{ scale: 1.03 }}
                      whileTap={{ scale: 0.97 }}
                      onClick={() => handleSelectCollege(col.name)}
                      className={`portal-college-card ${isSelected ? 'selected' : ''}`}
                      style={{
                        background: isSelected ? col.color : 'rgba(15, 23, 42, 0.6)',
                        border: `1.5px solid ${isSelected ? col.color : 'rgba(255, 255, 255, 0.1)'}`,
                        color: isSelected ? '#FFF' : '#94A3B8',
                        padding: '10px 6px',
                        borderRadius: '12px',
                        cursor: 'pointer',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        gap: '4px',
                        boxShadow: isSelected ? `0 4px 15px ${col.color}40` : 'none',
                        transition: 'all 0.2s ease'
                      }}
                    >
                      <span style={{ fontSize: '1.2rem' }}>{col.icon}</span>
                      <span style={{ fontSize: '0.8rem', fontWeight: '800' }}>{col.short}</span>
                    </motion.button>
                  );
                })}
              </div>
            </div>

            {/* Academic Year Level and Section */}
            <div className="portal-grid-2col" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div className="portal-form-group">
                <label className="portal-form-label">YEAR LEVEL</label>
                <div className="portal-input-wrapper">
                  <select
                    className="portal-form-select"
                    value={yearLevel}
                    onChange={(e) => setYearLevel(e.target.value)}
                  >
                    <option value="1st Year">1st Year</option>
                    <option value="2nd Year">2nd Year</option>
                    <option value="3rd Year">3rd Year</option>
                    <option value="4th Year">4th Year</option>
                  </select>
                </div>
              </div>

              <div className="portal-form-group">
                <label className="portal-form-label">
                  <span>SECTION / PROGRAM</span>
                  <span className="label-required">*</span>
                </label>
                <div className="portal-input-wrapper">
                  <input
                    type="text"
                    required
                    placeholder="e.g. BSBA 1-A"
                    className="portal-form-input"
                    value={section}
                    onChange={(e) => setSection(e.target.value)}
                  />
                </div>
              </div>
            </div>

            {/* Submit Action */}
            <motion.button
              type="submit"
              disabled={loading}
              className="portal-btn-primary portal-btn-glow"
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              style={{
                background: 'linear-gradient(135deg, #FF6B35 0%, #FFD100 100%)',
                color: '#000',
                fontWeight: '900',
                padding: '16px',
                borderRadius: '14px',
                border: 'none',
                fontSize: '1rem',
                cursor: loading ? 'not-allowed' : 'pointer',
                boxShadow: '0 10px 30px rgba(255, 107, 53, 0.45)',
                marginTop: '10px'
              }}
            >
              {loading ? '⏳ Generating Pass...' : '🎟️ Generate Official Entrance Pass'}
            </motion.button>
          </motion.form>
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
