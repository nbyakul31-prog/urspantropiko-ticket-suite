import React, { useState, useEffect, useRef } from 'react';
import { Html5Qrcode } from "html5-qrcode";
import { motion } from 'framer-motion';

export default function UsherScanner({ tickets = [], onAdmitStudent }) {
  const [scannedCode, setScannedCode] = useState('');
  const [currentResult, setCurrentResult] = useState(null);
  const [manualCode, setManualCode] = useState('');
  const [isScanning, setIsScanning] = useState(false);
  const [gateCount, setGateCount] = useState(0);
  const [cameraError, setCameraError] = useState(null);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [cachedTickets, setCachedTickets] = useState([]);
  const html5QrCodeRef = useRef(null);

  const [daySelectionMode, setDaySelectionMode] = useState('auto'); // 'auto' | 'day1' | 'day2'

  // Automatic Philippine Standard Time (GMT+8) Detection
  const getAutoPHDay = () => {
    try {
      const phDate = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Asia/Manila',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
      }).format(new Date());
      const day = parseInt(phDate.split('-')[2], 10);
      if (day === 18) return 'day2';
      return 'day1';
    } catch (e) {
      return 'day1';
    }
  };

  const activeDay = daySelectionMode === 'auto' ? getAutoPHDay() : daySelectionMode;
  const activeDayLabel = activeDay === 'day1' ? '🌅 DAY 1 (Sept 17)' : '🌴 DAY 2 (Sept 18)';

  // Sync count of admitted attendees for active day
  useEffect(() => {
    const ticketsToUse = isOnline ? tickets : cachedTickets;
    const count = ticketsToUse.filter(t => (activeDay === 'day1' ? t.day1_status === 'attended' : t.day2_status === 'attended')).length;
    setGateCount(count);
  }, [isOnline, tickets, cachedTickets, activeDay]);

  // Handle online/offline events
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      processAdmissionQueue();
    };
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Load cached tickets from localStorage on mount
  useEffect(() => {
    const loadCached = () => {
      try {
        const cached = localStorage.getItem('cachedEventTickets');
        if (cached) {
          setCachedTickets(JSON.parse(cached));
        }
      } catch (err) {
        console.error('Failed to load cached tickets:', err);
      }
    };
    loadCached();
  }, []);

  // Save tickets to localStorage when we are online and tickets update
  useEffect(() => {
    if (isOnline && tickets.length > 0) {
      try {
        localStorage.setItem('cachedEventTickets', JSON.stringify(tickets));
        setCachedTickets(tickets);
      } catch (err) {
        console.error('Failed to cache tickets:', err);
      }
    }
  }, [isOnline, tickets]);

  // Audio Beep Synthesis
  const playTone = (freq, duration) => {
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) throw new Error('No AudioContext support');
      const ctx = new AudioContext();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.1, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + duration);
    } catch (e) {
      try {
        const beep = new Audio('data:audio/wav;base64,UklGRl9vT19XQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YU9vT18=');
        beep.volume = 0.1;
        beep.play().catch(() => {});
      } catch (fallbackError) {}
    }
  };

  const handleScan = (code) => {
    if (!code) return;
    const cleanCode = code.trim().toUpperCase();
    setScannedCode(cleanCode);

    const ticketsToValidate = isOnline ? tickets : cachedTickets;
    const student = ticketsToValidate.find(t => t.ticket_code?.toUpperCase() === cleanCode);

    if (!student) {
      playTone(180, 0.3);
      setCurrentResult({
        type: 'danger',
        title: '🔴 INVALID TICKET',
        msg: `Code "${cleanCode}" was not found in the attendee database.`
      });
      return;
    }

    const isAlreadyCheckedIn = activeDay === 'day1' ? student.day1_status === 'attended' : student.day2_status === 'attended';
    const checkInTime = activeDay === 'day1' ? student.day1_time : student.day2_time;

    if (isAlreadyCheckedIn) {
      playTone(300, 0.25);
      setCurrentResult({
        type: 'warning',
        title: `⚠️ ALREADY ADMITTED (${activeDayLabel})`,
        student,
        msg: `Admitted at ${checkInTime || '08:15 AM'}. Duplicate ticket scans are prohibited for this day.`
      });
      return;
    }

    if (student.payment_status !== 'paid') {
      playTone(220, 0.35);
      setCurrentResult({
        type: 'danger',
        title: '🔴 PAYMENT UNVERIFIED',
        student,
        msg: 'Payment has not been validated by Class President. Direct attendee to Help Desk.'
      });
      return;
    }

    // SUCCESS: VALID PASS
    playTone(880, 0.15);
    setCurrentResult({
      type: 'success',
      title: `🟢 VALID PASS — ADMIT (${activeDayLabel})`,
      student,
      msg: 'Verify that the attendee physical School ID matches the name below.'
    });
  };

  const confirmAdmit = () => {
    if (currentResult && currentResult.student) {
      const student = currentResult.student;
      const timeNow = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

      if (isOnline) {
        onAdmitStudent(student.ticket_code, activeDay, timeNow);
        playTone(1200, 0.2);
        handleScan(student.ticket_code);
      } else {
        updateLocalCacheAndQueueAdmission(student.ticket_code, activeDay, timeNow);
        playTone(1200, 0.2);
        setCurrentResult(prev => ({
          ...prev,
          student: {
            ...prev.student,
            [activeDay === 'day1' ? 'day1_status' : 'day2_status']: 'attended',
            [activeDay === 'day1' ? 'day1_time' : 'day2_time']: timeNow
          }
        }));
      }
    }
  };

  const updateLocalCacheAndQueueAdmission = (ticketCode) => {
    // Update local cache
    setCachedTickets(prev => {
      const updated = prev.map(t =>
        t.ticket_code === ticketCode
          ? { ...t, attendance_status: 'attended', attended_at: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) }
          : t
      );
      // Save to localStorage
      try {
        localStorage.setItem('cachedEventTickets', JSON.stringify(updated));
      } catch (err) {
        console.error('Failed to update cached tickets:', err);
      }
      return updated;
    });

    // Queue the admission for when we come back online
    const queueItem = {
      type: 'ADMIT',
      ticketCode: ticketCode,
      timestamp: new Date().toISOString()
    };

    try {
      const queue = JSON.parse(localStorage.getItem('admissionQueue') || '[]');
      queue.push(queueItem);
      localStorage.setItem('admissionQueue', JSON.stringify(queue));
    } catch (err) {
      console.error('Failed to queue admission:', err);
    }
  };

  const processAdmissionQueue = () => {
    try {
      const queue = JSON.parse(localStorage.getItem('admissionQueue') || '[]');
      if (queue.length === 0) return;

      // Process each queued admission
      queue.forEach(item => {
        if (item.type === 'ADMIT') {
          onAdmitStudent(item.ticketCode);
        }
      });

      // Clear the queue after processing
      localStorage.removeItem('admissionQueue');

      // Optionally, show a toast or notification that sync is complete
      // For now, we'll just log
      console.log(`Processed ${queue.length} queued admissions`);
    } catch (err) {
      console.error('Failed to process admission queue:', err);
    }
  };

  const startScanner = async () => {
    setCameraError(null);
    try {
      if (!html5QrCodeRef.current) {
        html5QrCodeRef.current = new Html5Qrcode("reader-container");
      }
      await html5QrCodeRef.current.start(
        { facingMode: "environment" },
        { fps: 10, qrbox: { width: 220, height: 220 } },
        (decodedText) => {
          handleScan(decodedText);
        },
        () => {} // frame error handler
      );
      setIsScanning(true);
    } catch (err) {
      console.error("Camera startup error:", err);
      setCameraError("Camera unavailable or permission denied. Please use manual code scan or test buttons below.");
      setIsScanning(false);
    }
  };

  const stopScanner = async () => {
    if (html5QrCodeRef.current) {
      try {
        if (html5QrCodeRef.current.isScanning) {
          await html5QrCodeRef.current.stop();
        }
        await html5QrCodeRef.current.clear();
      } catch (e) {
        console.warn("Camera stop notice:", e);
      }
      html5QrCodeRef.current = null;
    }
    setIsScanning(false);
  };

  useEffect(() => {
    return () => {
      if (html5QrCodeRef.current) {
        try {
          if (html5QrCodeRef.current.isScanning) {
            html5QrCodeRef.current.stop();
          }
          html5QrCodeRef.current.clear();
        } catch (e) {}
      }
    };
  }, []);

  return (
    <motion.div
      className="usher-mobile-wrapper"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 20 }}
      transition={{ duration: 0.3 }}
    >
      <motion.div
        className="usher-glass-card"
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
      >

        {/* Top Header */}
        <motion.div
          className="usher-header-box"
          initial={{ opacity: 0, x: -10 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.1, duration: 0.3 }}
          style={{ marginBottom: '14px' }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <img
                src="/logo.png"
                alt="URSP SSG Logo"
                style={{
                  width: '42px',
                  height: '42px',
                  borderRadius: '50%',
                  border: '2px solid #FFD100',
                  background: '#FFF',
                  objectFit: 'contain'
                }}
              />
              <div>
                <h1 style={{ fontSize: '17px', fontWeight: '800', color: '#FFF', margin: 0, lineHeight: 1.2 }}>
                  Usher QR Scanner
                </h1>
                <p style={{ fontSize: '10px', color: '#94A3B8', margin: '2px 0 0 0' }}>
                  URSPantropiko Gate Check-in
                </p>
              </div>
            </div>
            
            <span style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
              background: 'rgba(6, 214, 160, 0.15)',
              border: '1px solid rgba(6, 214, 160, 0.4)',
              color: '#34D399',
              borderRadius: '6px',
              padding: '3px 8px',
              fontSize: '10px',
              fontWeight: '800',
              whiteSpace: 'nowrap'
            }}>
              ● LIVE DB
            </span>
          </div>

          {/* 2-Day Event Gate Switcher */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: '6px',
            background: 'rgba(0,0,0,0.45)',
            padding: '6px',
            borderRadius: '12px',
            border: '1px solid rgba(255,255,255,0.1)',
            marginTop: '12px'
          }}>
            <button
              type="button"
              onClick={() => setDaySelectionMode('auto')}
              style={{
                background: daySelectionMode === 'auto' ? '#FFD100' : 'rgba(255,255,255,0.06)',
                color: daySelectionMode === 'auto' ? '#000' : '#E2E8F0',
                border: 'none',
                borderRadius: '8px',
                padding: '6px 4px',
                fontSize: '10.5px',
                fontWeight: '800',
                cursor: 'pointer',
                textAlign: 'center',
                lineHeight: 1.2,
                transition: 'all 0.2s ease'
              }}
            >
              ⚡ Auto ({getAutoPHDay() === 'day1' ? 'D1' : 'D2'})
            </button>
            <button
              type="button"
              onClick={() => setDaySelectionMode('day1')}
              style={{
                background: activeDay === 'day1' && daySelectionMode !== 'auto' ? '#F59E0B' : 'rgba(255,255,255,0.06)',
                color: activeDay === 'day1' && daySelectionMode !== 'auto' ? '#000' : '#E2E8F0',
                border: 'none',
                borderRadius: '8px',
                padding: '6px 4px',
                fontSize: '10.5px',
                fontWeight: '800',
                cursor: 'pointer',
                textAlign: 'center',
                lineHeight: 1.2,
                transition: 'all 0.2s ease'
              }}
            >
              🌅 Day 1 (17th)
            </button>
            <button
              type="button"
              onClick={() => setDaySelectionMode('day2')}
              style={{
                background: activeDay === 'day2' && daySelectionMode !== 'auto' ? '#10B981' : 'rgba(255,255,255,0.06)',
                color: activeDay === 'day2' && daySelectionMode !== 'auto' ? '#000' : '#E2E8F0',
                border: 'none',
                borderRadius: '8px',
                padding: '6px 4px',
                fontSize: '10.5px',
                fontWeight: '800',
                cursor: 'pointer',
                textAlign: 'center',
                lineHeight: 1.2,
                transition: 'all 0.2s ease'
              }}
            >
              🌴 Day 2 (18th)
            </button>
          </div>

          <div className="usher-counter-box">
            <div className="counter-number">{gateCount}</div>
            <div className="counter-label">Admitted for {activeDayLabel}</div>
          </div>

          {/* Online/Offline Indicator */}
          {!isOnline && (
            <span className="text-xs text-danger">• Offline</span>
          )}
        </motion.div>

        {/* Camera Viewfinder (Dedicated empty DOM element for html5-qrcode) */}
        <motion.div
          className="viewfinder-container"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 10 }}
          transition={{ delay: 0.2, duration: 0.3 }}
        >
          <div className="viewfinder-box-outer">
            {/* Sibling element for reader - React never puts children inside this */}
            <div id="reader-container" style={{ width: '100%', minHeight: isScanning ? '220px' : '0' }}></div>

            {/* Standby overlay displayed when not scanning */}
            {!isScanning && (
              <motion.div
                className="viewfinder-standby"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                transition={{ delay: 0.3, duration: 0.3 }}
              >
                <div className="camera-icon-large">📷</div>
                <div className="standby-text">Camera Standby</div>
                <motion.button
                  type="button"
                  className="btn-start-camera"
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={startScanner}
                >
                  ▶ Start Camera Scanner
                </motion.button>
              </motion.div>
            )}
          </div>

          {isScanning && (
            <motion.button
              type="button"
              className="btn-stop-camera"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={stopScanner}
            >
              ⏹ Stop Camera
            </motion.button>
          )}

          {cameraError && (
            <motion.div
              className="camera-error-banner"
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ delay: 0.3, duration: 0.3 }}
            >
              {cameraError}
            </motion.div>
          )}
        </motion.div>

        {/* Manual Code Input Bar */}
        <motion.form
          onSubmit={(e) => { e.preventDefault(); handleScan(manualCode); }}
          className="manual-input-form"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 10 }}
          transition={{ delay: 0.4, duration: 0.3 }}
        >
          <motion.input
            type="text"
            placeholder="Type ticket code (e.g. TKT-10001)..."
            value={manualCode}
            onChange={(e) => setManualCode(e.target.value)}
            className="manual-input"
          />
          <motion.button
            type="submit"
            className="btn-manual-scan"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            Scan Code
          </motion.button>
        </motion.form>

        {/* Quick Test Demo Buttons */}
        <motion.div
          className="demo-buttons-grid"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 10 }}
          transition={{ delay: 0.5, duration: 0.3 }}
        >
          <motion.button
            type="button"
            className="btn-demo demo-paid"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => handleScan('TKT-10001')}
          >
            🟢 Test Paid (TKT-10001)
          </motion.button>
          <motion.button
            type="button"
            className="btn-demo demo-unpaid"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => handleScan('TKT-10002')}
          >
            🔴 Test Unpaid (TKT-10002)
          </motion.button>
          <motion.button
            type="button"
            className="btn-demo demo-attended"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => handleScan('TKT-10003')}
          >
            🟢 Test Attended (TKT-10003)
          </motion.button>
          <motion.button
            type="button"
            className="btn-demo demo-unpaid2"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => handleScan('TKT-10004')}
          >
            🔴 Test Unpaid (TKT-10004)
          </motion.button>
        </motion.div>

        {/* Result Alerts */}
        {currentResult && (
          <motion.div
            className={`result-box result-${currentResult.type} p-4 mb-4 rounded-lg`}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            transition={{ delay: 0.3, duration: 0.3 }}
          >
            <div className="text-base font-extrabold mb-2">{currentResult.title}</div>

            {currentResult.student && (
              <motion.div
                className="space-y-2"
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                transition={{ delay: 0.4, duration: 0.3 }}
              >
                <div className="text-xl font-bold text-white">{currentResult.student.full_name}</div>
                <div className="flex items-center gap-2 text-xs text-primary font-mono font-bold">
                  <div>ID: {currentResult.student.student_id}</div>
                  <div className="w-px h-4 bg-border-color"></div>
                  <div>{currentResult.student.program_section}</div>
                </div>
                <div className="text-xs text-muted">
                  Dept: {currentResult.student.department} • Year: {currentResult.student.year_level}
                </div>
              </motion.div>
            )}

            <div className="mt-2 text-xs text-muted">{currentResult.msg}</div>

            {currentResult.type === 'success' && currentResult.student.attendance_status !== 'attended' && (
              <motion.button
                className="btn btn-success w-full mt-4 font-bold text-lg"
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={confirmAdmit}
              >
                ✓ Tap to Check-In & Admit
              </motion.button>
            )}

            {(currentResult.type === 'error' || currentResult.type === 'danger') && (
              <motion.button
                className="btn btn-ghost w-full mt-4 text-xs"
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => {
                  setCurrentResult(null);
                  if (!isScanning) startScanner();
                }}
              >
                Try Again
              </motion.button>
            )}
          </motion.div>
        )}

        {/* Instructions */}
        {!currentResult && !isScanning && (
          <motion.div
            className="text-center text-muted text-sm"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            transition={{ delay: 0.6, duration: 0.3 }}
          >
            <p>📱 Point camera at QR code or enter code manually</p>
            <p className="mt-1">🟢 Green = Valid • 🔴 Red = Unpaid • ⚠️ Orange = Already Scanned</p>
          </motion.div>
        )}
        {isScanning && !currentResult && (
          <motion.div
            className="text-center text-muted text-sm"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            transition={{ delay: 0.6, duration: 0.3 }}
          >
            <p>📷 Scanning... Point camera at QR code</p>
          </motion.div>
        )}
      </motion.div>
    </motion.div>
  );
}