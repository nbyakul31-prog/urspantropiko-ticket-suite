import React, { useState, useMemo } from 'react';
import QRCode from 'qrcode.react';
import { motion, AnimatePresence } from 'framer-motion';
import { BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';

// 3 Official Colleges at URS Pililla
export const OFFICIAL_COLLEGES = [
  'College of Education',
  'College of Social Sciences',
  'College of Business'
];

export const getCollegeTheme = (collegeName) => {
  const norm = (collegeName || '').toLowerCase();
  if (norm.includes('education') || norm.includes('ed')) {
    return {
      name: 'College of Education',
      short: 'COED',
      badgeBg: '#FEF3C7',
      badgeText: '#92400E',
      badgeBorder: '#FDE68A',
      darkBadgeBg: 'rgba(245, 158, 11, 0.15)',
      darkBadgeText: '#FBBF24',
      darkBadgeBorder: 'rgba(245, 158, 11, 0.35)',
      solidColor: '#D97706',
      accentColor: '#F59E0B',
      rowBg: '#FFFDF5',
      icon: '📚'
    };
  }
  if (norm.includes('social') || norm.includes('css') || norm.includes('psych') || norm.includes('polsci')) {
    return {
      name: 'College of Social Sciences',
      short: 'CSS',
      badgeBg: '#EDE9FE',
      badgeText: '#5B21B6',
      badgeBorder: '#DDD6FE',
      darkBadgeBg: 'rgba(139, 92, 246, 0.15)',
      darkBadgeText: '#C4B5FD',
      darkBadgeBorder: 'rgba(139, 92, 246, 0.35)',
      solidColor: '#7C3AED',
      accentColor: '#8B5CF6',
      rowBg: '#FAF8FF',
      icon: '⚖️'
    };
  }
  if (norm.includes('business') || norm.includes('cba') || norm.includes('bsba') || norm.includes('accountancy')) {
    return {
      name: 'College of Business',
      short: 'CB',
      badgeBg: '#D1FAE5',
      badgeText: '#065F46',
      badgeBorder: '#A7F3D0',
      darkBadgeBg: 'rgba(16, 185, 129, 0.15)',
      darkBadgeText: '#6EE7B7',
      darkBadgeBorder: 'rgba(16, 185, 129, 0.35)',
      solidColor: '#059669',
      accentColor: '#10B981',
      rowBg: '#F4FDF8',
      icon: '💼'
    };
  }
  return {
    name: collegeName || 'General',
    short: 'UNIV',
    badgeBg: '#F1F5F9',
    badgeText: '#334155',
    badgeBorder: '#CBD5E1',
    darkBadgeBg: 'rgba(148, 163, 184, 0.15)',
    darkBadgeText: '#CBD5E1',
    darkBadgeBorder: 'rgba(148, 163, 184, 0.35)',
    solidColor: '#64748B',
    accentColor: '#94A3B8',
    rowBg: '#FFFFFF',
    icon: '🎓'
  };
};

export default function AdminDashboard({
  tickets = [],
  onTogglePayment,
  onBulkVerify,
  onAdmitStudent,
  onDeleteAttendee,
  livePings = [],
  highlightedCode = null,
  eventName = "URSPANTROPIKO: URSP Acquaintance Party 2026",
  eventLogo = null
}) {
  const [selectedDepartment, setSelectedDepartment] = useState('ALL');
  const [selectedSection, setSelectedSection] = useState('ALL');
  const [selectedYearLevel, setSelectedYearLevel] = useState('ALL');
  const [selectedPaymentStatus, setSelectedPaymentStatus] = useState('ALL');
  const [selectedDay1Status, setSelectedDay1Status] = useState('ALL');
  const [selectedDay2Status, setSelectedDay2Status] = useState('ALL');
  const [showDuplicatesOnly, setShowDuplicatesOnly] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState('masterlist'); // 'masterlist' | 'analytics' | 'access'

  // Delete attendee confirmation modal state
  const [attendeeToDelete, setAttendeeToDelete] = useState(null);

  // Live Philippine Standard Time (PST / GMT+8) Clock & Date
  const [phClock, setPhClock] = useState(() => {
    try {
      const now = new Date();
      return {
        time: new Intl.DateTimeFormat('en-US', {
          timeZone: 'Asia/Manila',
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          hour12: true
        }).format(now),
        date: new Intl.DateTimeFormat('en-US', {
          timeZone: 'Asia/Manila',
          weekday: 'short',
          month: 'short',
          day: 'numeric',
          year: 'numeric'
        }).format(now)
      };
    } catch (e) {
      return { time: new Date().toLocaleTimeString(), date: new Date().toLocaleDateString() };
    }
  });

  React.useEffect(() => {
    const timer = setInterval(() => {
      try {
        const now = new Date();
        setPhClock({
          time: new Intl.DateTimeFormat('en-US', {
            timeZone: 'Asia/Manila',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            hour12: true
          }).format(now),
          date: new Intl.DateTimeFormat('en-US', {
            timeZone: 'Asia/Manila',
            weekday: 'short',
            month: 'short',
            day: 'numeric',
            year: 'numeric'
          }).format(now)
        });
      } catch (e) {
        setPhClock({ time: new Date().toLocaleTimeString(), date: new Date().toLocaleDateString() });
      }
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Master Access Configuration
  const masterUsherToken = 'USHER-MASTER-2026';
  const [activeUshersCount, setActiveUshersCount] = useState(4);
  const [showStudentQRModal, setShowStudentQRModal] = useState(false);
  const [showUsherQRModal, setShowUsherQRModal] = useState(false);
  const [showExcelPreviewModal, setShowExcelPreviewModal] = useState(false);
  const [previewPaperSize, setPreviewPaperSize] = useState('a4_landscape');

  const origin = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:5173';
  const studentRegisterUrl = `${origin}/register`;
  const masterUsherUrl = `${origin}/usher?token=${masterUsherToken}`;

  // Duplicate Tracking across dataset
  const duplicatesMap = useMemo(() => {
    const idCounts = {};
    const nameCounts = {};
    tickets.forEach(t => {
      const id = (t.student_id || '').trim().toLowerCase();
      const name = (t.full_name || '').trim().toLowerCase();
      if (id) idCounts[id] = (idCounts[id] || 0) + 1;
      if (name) nameCounts[name] = (nameCounts[name] || 0) + 1;
    });
    return { idCounts, nameCounts };
  }, [tickets]);

  const duplicateAttendeesCount = useMemo(() => {
    return tickets.filter(t => {
      const id = (t.student_id || '').trim().toLowerCase();
      const name = (t.full_name || '').trim().toLowerCase();
      return (id && duplicatesMap.idCounts[id] > 1) || (name && duplicatesMap.nameCounts[name] > 1);
    }).length;
  }, [tickets, duplicatesMap]);

  // Filtered List based on all filters
  const filtered = useMemo(() => {
    return tickets.filter(item => {
      const matchDept = selectedDepartment === 'ALL' || item.department === selectedDepartment;
      const matchSec = selectedSection === 'ALL' || item.program_section === selectedSection;
      const matchYear = selectedYearLevel === 'ALL' || item.year_level === selectedYearLevel;
      const matchPayment = selectedPaymentStatus === 'ALL' || item.payment_status === selectedPaymentStatus;
      const matchDay1 = selectedDay1Status === 'ALL' || item.day1_status === selectedDay1Status;
      const matchDay2 = selectedDay2Status === 'ALL' || item.day2_status === selectedDay2Status;
      
      const idKey = (item.student_id || '').trim().toLowerCase();
      const nameKey = (item.full_name || '').trim().toLowerCase();
      const isDuplicate = (idKey && duplicatesMap.idCounts[idKey] > 1) || (nameKey && duplicatesMap.nameCounts[nameKey] > 1);
      const matchDuplicate = !showDuplicatesOnly || isDuplicate;

      const matchSearch = (item.full_name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
                          (item.student_id || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
                          (item.ticket_code || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
                          (item.program_section || '').toLowerCase().includes(searchQuery.toLowerCase());
      return matchDept && matchSec && matchYear && matchPayment && matchDay1 && matchDay2 && matchDuplicate && matchSearch;
    });
  }, [tickets, selectedDepartment, selectedSection, selectedYearLevel, selectedPaymentStatus, selectedDay1Status, selectedDay2Status, showDuplicatesOnly, searchQuery, duplicatesMap]);

  // KPI Calculations
  const totalCount = tickets.length;
  const paidCount = tickets.filter(i => i.payment_status === 'paid').length;
  const unpaidCount = totalCount - paidCount;
  const day1Count = tickets.filter(i => i.day1_status === 'attended').length;
  const day2Count = tickets.filter(i => i.day2_status === 'attended').length;
  const bothDaysCount = tickets.filter(i => i.day1_status === 'attended' && i.day2_status === 'attended').length;
  const paidPercent = totalCount > 0 ? Math.round((paidCount / totalCount) * 100) : 0;
  const day1Percent = totalCount > 0 ? Math.round((day1Count / totalCount) * 100) : 0;
  const day2Percent = totalCount > 0 ? Math.round((day2Count / totalCount) * 100) : 0;

  // 3-Colleges Metrics Breakdown
  const collegeMetrics = useMemo(() => {
    let eduCount = 0, socCount = 0, busCount = 0, otherCount = 0;
    let eduPaid = 0, socPaid = 0, busPaid = 0;
    let eduDay1 = 0, socDay1 = 0, busDay1 = 0;
    let eduDay2 = 0, socDay2 = 0, busDay2 = 0;

    filtered.forEach(t => {
      const dept = (t.department || '').toLowerCase();
      if (dept.includes('education')) {
        eduCount++;
        if (t.payment_status === 'paid') eduPaid++;
        if (t.day1_status === 'attended') eduDay1++;
        if (t.day2_status === 'attended') eduDay2++;
      } else if (dept.includes('social') || dept.includes('css')) {
        socCount++;
        if (t.payment_status === 'paid') socPaid++;
        if (t.day1_status === 'attended') socDay1++;
        if (t.day2_status === 'attended') socDay2++;
      } else if (dept.includes('business') || dept.includes('cba')) {
        busCount++;
        if (t.payment_status === 'paid') busPaid++;
        if (t.day1_status === 'attended') busDay1++;
        if (t.day2_status === 'attended') busDay2++;
      } else {
        otherCount++;
      }
    });

    const currentTotal = filtered.length;
    return {
      education: { count: eduCount, pct: currentTotal > 0 ? ((eduCount / currentTotal) * 100).toFixed(1) : '0.0', paid: eduPaid, day1: eduDay1, day2: eduDay2 },
      social: { count: socCount, pct: currentTotal > 0 ? ((socCount / currentTotal) * 100).toFixed(1) : '0.0', paid: socPaid, day1: socDay1, day2: socDay2 },
      business: { count: busCount, pct: currentTotal > 0 ? ((busCount / currentTotal) * 100).toFixed(1) : '0.0', paid: busPaid, day1: busDay1, day2: busDay2 },
      other: { count: otherCount, pct: currentTotal > 0 ? ((otherCount / currentTotal) * 100).toFixed(1) : '0.0' }
    };
  }, [filtered]);

  // Chart Data
  const deptData = [
    { name: 'COED (Education)', total: collegeMetrics.education.count, paid: collegeMetrics.education.paid, day1: collegeMetrics.education.day1, day2: collegeMetrics.education.day2 },
    { name: 'CSS (Social Sci)', total: collegeMetrics.social.count, paid: collegeMetrics.social.paid, day1: collegeMetrics.social.day1, day2: collegeMetrics.social.day2 },
    { name: 'CB (Business)', total: collegeMetrics.business.count, paid: collegeMetrics.business.paid, day1: collegeMetrics.business.day1, day2: collegeMetrics.business.day2 }
  ];

  const yearData = useMemo(() => {
    const counts = { '1st Year': 0, '2nd Year': 0, '3rd Year': 0, '4th Year': 0 };
    filtered.forEach(t => {
      const y = t.year_level || '1st Year';
      if (counts[y] !== undefined) counts[y]++;
      else counts['1st Year']++;
    });
    return Object.entries(counts).map(([name, value]) => ({ name, value }));
  }, [filtered]);

  const copyToClipboard = (text, label) => {
    navigator.clipboard.writeText(text);
    alert(`📋 ${label} copied to clipboard!`);
  };

  // Toggle Day Gate Attendance
  const handleToggleDay = (ticketCode, day) => {
    if (onAdmitStudent) {
      const targetTicket = tickets.find(t => t.ticket_code === ticketCode);
      if (!targetTicket) return;
      const isCurrentlyAttended = day === 'day1' ? targetTicket.day1_status === 'attended' : targetTicket.day2_status === 'attended';
      const newStatus = isCurrentlyAttended ? 'not_attended' : 'attended';
      const timeNow = newStatus === 'attended' ? new Intl.DateTimeFormat('en-US', {
        timeZone: 'Asia/Manila',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
      }).format(new Date()) : null;
      onAdmitStudent(ticketCode, day, timeNow);
    }
  };

  // Download Excel (.xls)
  const downloadExcel = () => {
    const totalInReport = filtered.length;
    const paidInReport = filtered.filter(i => i.payment_status === 'paid').length;
    const day1InReport = filtered.filter(i => i.day1_status === 'attended').length;
    const day2InReport = filtered.filter(i => i.day2_status === 'attended').length;
    const paidPct = totalInReport > 0 ? Math.round((paidInReport / totalInReport) * 100) : 0;
    const totalCols = 10;

    let tableHTML = `
      <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
      <head>
        <meta http-equiv="Content-Type" content="text/html; charset=UTF-8">
        <style>
          body { font-family: 'Segoe UI', Arial, sans-serif; font-size: 10pt; color: #1E293B; background-color: #FFFFFF; }
          .banner-univ { background-color: #881337; color: #FEF08A; font-size: 13pt; font-weight: bold; text-align: center; padding: 8px; border: 1px solid #4C0519; }
          .banner-main { background-color: #991B1B; color: #FFFFFF; font-size: 16pt; font-weight: 900; text-align: center; padding: 12px; }
          .banner-sub { background-color: #7F1D1D; color: #FEE2E2; font-size: 9.5pt; font-weight: bold; text-align: center; padding: 4px; }
          .banner-venue { background-color: #1E293B; color: #FFFFFF; font-size: 9pt; text-align: center; padding: 6px; }
          .banner-doc { background-color: #0F172A; color: #38BDF8; font-size: 10pt; font-weight: bold; text-align: center; padding: 6px; }
          .th-std { background-color: #0F172A; color: #FFFFFF; font-size: 9pt; font-weight: bold; padding: 8px 4px; border: 1px solid #334155; text-align: center; }
          .cell-center { text-align: center; vertical-align: middle; padding: 6px; border: 1px solid #E2E8F0; }
          .cell-left { text-align: left; vertical-align: middle; padding: 6px 10px; border: 1px solid #E2E8F0; }
          .badge-paid { background-color: #D1FAE5; color: #065F46; font-weight: bold; text-align: center; border: 1px solid #A7F3D0; }
          .badge-unpaid { background-color: #FEE2E2; color: #991B1B; font-weight: bold; text-align: center; border: 1px solid #FECACA; }
          .badge-attended { background-color: #DCFCE7; color: #15803D; font-weight: bold; text-align: center; border: 1px solid #86EFAC; }
          .badge-absent { background-color: #F1F5F9; color: #64748B; font-weight: bold; text-align: center; border: 1px solid #CBD5E1; }
        </style>
      </head>
      <body>
        <table border="1" style="border-collapse: collapse; width: 100%;">
          <tr>
            <td colspan="${totalCols}" class="banner-univ">🏛️ UNIVERSITY OF RIZAL SYSTEM • PILILLA CAMPUS</td>
          </tr>
          <tr>
            <td colspan="${totalCols}" class="banner-main">🎉 URSPANTROPIKO: ACQUAINTANCE PARTY &amp; GENERAL ASSEMBLY 2026</td>
          </tr>
          <tr>
            <td colspan="${totalCols}" class="banner-sub">"ONE ISLAND, ONE CAMPUS, ONE IDENTITY — RED HAWKS SOARING IN UNITY"</td>
          </tr>
          <tr>
            <td colspan="${totalCols}" class="banner-venue">📅 September 17-18, 2026 &nbsp;|&nbsp; 📍 University Gymnasium • URS Pililla Campus</td>
          </tr>
          <tr>
            <td colspan="${totalCols}" class="banner-doc">📋 Official 2-Day Attendance &amp; Ledger Audit Masterlist</td>
          </tr>

          <!-- Top Executive Analytics SITREP -->
          <tr>
            <td colspan="${totalCols}" style="background-color: #F8FAFC; padding: 10px; border: 1px solid #CBD5E1;">
              <table width="100%" border="0" style="border-collapse: collapse; text-align: center;">
                <tr>
                  <td style="width: 25%; padding: 8px; background-color: #0F172A; color: #FFFFFF; font-weight: bold; border-radius: 6px;">
                    👥 Total Registered<br/><span style="font-size: 14pt; color: #38BDF8;">${totalInReport}</span> Students
                  </td>
                  <td style="width: 25%; padding: 8px; background-color: #D1FAE5; color: #065F46; font-weight: bold; border: 1px solid #A7F3D0;">
                    💳 Paid &amp; Verified<br/><span style="font-size: 14pt;">${paidInReport}</span> (${paidPct}%)
                  </td>
                  <td style="width: 25%; padding: 8px; background-color: #FEF3C7; color: #92400E; font-weight: bold; border: 1px solid #FDE68A;">
                    🌅 Day 1 Admitted<br/><span style="font-size: 14pt;">${day1InReport}</span> Students
                  </td>
                  <td style="width: 25%; padding: 8px; background-color: #EDE9FE; color: #5B21B6; font-weight: bold; border: 1px solid #DDD6FE;">
                    🌴 Day 2 Admitted<br/><span style="font-size: 14pt;">${day2InReport}</span> Students
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Table Header Columns -->
          <tr>
            <th class="th-std" style="width: 45px;">#</th>
            <th class="th-std" style="width: 130px;">Ticket Ref</th>
            <th class="th-std" style="width: 130px;">Student ID</th>
            <th class="th-std" style="width: 220px;">Student Full Name</th>
            <th class="th-std" style="width: 210px;">College / Department</th>
            <th class="th-std" style="width: 140px;">Program &amp; Section</th>
            <th class="th-std" style="width: 110px;">Year Level</th>
            <th class="th-std" style="width: 150px;">Payment Status</th>
            <th class="th-std" style="width: 160px;">Day 1 (Sept 17)</th>
            <th class="th-std" style="width: 160px;">Day 2 (Sept 18)</th>
          </tr>
    `;

    filtered.forEach((d, idx) => {
      const theme = getCollegeTheme(d.department);
      const isPaid = d.payment_status === 'paid';
      const isDay1Attended = d.day1_status === 'attended';
      const isDay2Attended = d.day2_status === 'attended';

      tableHTML += `
        <tr style="background-color: ${theme.rowBg};">
          <td class="cell-center" style="font-weight: bold; color: #64748B;">${idx + 1}</td>
          <td class="cell-center" style="font-weight: bold; color: #1E293B; font-family: monospace;">${d.ticket_code}</td>
          <td class="cell-center" style="font-weight: bold; color: #0F172A; font-family: monospace; mso-number-format:'\\@';">${d.student_id}</td>
          <td class="cell-left" style="font-weight: bold; color: #0F172A;">${d.full_name}</td>
          <td class="cell-center" style="background-color: ${theme.badgeBg}; color: ${theme.badgeText}; font-weight: bold; border: 1px solid ${theme.badgeBorder};">
            ${theme.icon} ${d.department || 'N/A'}
          </td>
          <td class="cell-center" style="font-weight: bold; color: #1E293B;">${d.program_section}</td>
          <td class="cell-center">${d.year_level || '1st Year'}</td>
          <td class="${isPaid ? 'badge-paid' : 'badge-unpaid'}">
            ${isPaid ? '💳 PAID &amp; VERIFIED' : '⏳ UNPAID'}
          </td>
          <td class="${isDay1Attended ? 'badge-attended' : 'badge-absent'}">
            ${isDay1Attended ? `✅ IN (${d.day1_time || '08:14 AM'})` : '❌ NOT IN'}
          </td>
          <td class="${isDay2Attended ? 'badge-attended' : 'badge-absent'}">
            ${isDay2Attended ? `✅ IN (${d.day2_time || '08:45 PM'})` : '❌ NOT IN'}
          </td>
        </tr>
      `;
    });

    tableHTML += `
          <tr>
            <td colspan="${totalCols}" style="text-align: right; font-size: 9.5pt; color: #7F1D1D; padding: 12px; font-weight: bold; border: none; background-color: #F8FAFC;">
              ⚡ Powered by Supreme Student Government (SSG) • URS Pililla Campus | System by @noir_et_blancc66
            </td>
          </tr>
        </table>
      </body>
      </html>
    `;

    const blob = new Blob([tableHTML], { type: 'application/vnd.ms-excel;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `URSPANTROPIKO_2026_Masterlist_${new Date().toISOString().slice(0, 10)}.xls`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Print PDF Masterlist
  const handlePrint = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      alert('Please allow popups to open print preview.');
      return;
    }

    const totalInReport = filtered.length;
    const paidInReport = filtered.filter(i => i.payment_status === 'paid').length;
    const day1InReport = filtered.filter(i => i.day1_status === 'attended').length;
    const day2InReport = filtered.filter(i => i.day2_status === 'attended').length;
    const paidPct = totalInReport > 0 ? Math.round((paidInReport / totalInReport) * 100) : 0;

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>URSPANTROPIKO 2026 — 2-Day Masterlist Print Ledger</title>
        <style>
          @page { size: A4 landscape; margin: 10mm; }
          body { font-family: 'Segoe UI', Arial, sans-serif; font-size: 8.5pt; color: #0F172A; margin: 0; padding: 0; }
          .header-banner { background: #881337 !important; color: #FFF !important; padding: 12px 18px; border-radius: 6px; margin-bottom: 8px; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          .header-banner h1 { margin: 0; font-size: 13pt; color: #FEF08A; font-weight: 800; }
          .header-banner h2 { margin: 2px 0; font-size: 11pt; color: #FFF; }
          .header-banner p { margin: 0; font-size: 8pt; color: #E2E8F0; }
          .sitrep-strip { display: flex; gap: 8px; margin-bottom: 8px; }
          .sitrep-box { flex: 1; padding: 6px 10px; border-radius: 4px; font-size: 8pt; -webkit-print-color-adjust: exact; print-color-adjust: exact; text-align: center; }
          table { width: 100%; border-collapse: collapse; margin-top: 6px; }
          th { background: #0F172A !important; color: #FFF !important; padding: 5px 4px; font-size: 7.5pt; font-weight: 700; border: 1px solid #334155; text-align: center; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          td { padding: 4px 6px; border: 1px solid #CBD5E1; font-size: 8pt; vertical-align: middle; }
          .footer-strip { margin-top: 10px; display: flex; justify-content: space-between; font-size: 7.5pt; color: #64748B; border-top: 1px solid #CBD5E1; padding-top: 6px; }
        </style>
      </head>
      <body>
        <div class="header-banner" style="display: flex; align-items: center; justify-content: space-between; gap: 12px;">
          <img src="${window.location.origin}/logo.png" style="width: 52px; height: 52px; border-radius: 50%; background: #FFF; border: 2px solid #FEF08A; object-fit: contain;" />
          <div style="flex: 1; text-align: center;">
            <h1>🏛️ UNIVERSITY OF RIZAL SYSTEM • PILILLA CAMPUS</h1>
            <h2>🎉 URSPANTROPIKO: ACQUAINTANCE PARTY &amp; GENERAL ASSEMBLY 2026</h2>
            <p>📅 Sept 17-18, 2026 &nbsp;|&nbsp; 📍 University Gymnasium • URS Pililla &nbsp;|&nbsp; 📋 Official 2-Day Attendance &amp; Ledger Audit</p>
          </div>
          <img src="${window.location.origin}/urs_logo.png" style="width: 52px; height: 52px; border-radius: 50%; background: #FFF; border: 2px solid #38BDF8; object-fit: contain;" />
        </div>

        <div class="sitrep-strip">
          <div class="sitrep-box" style="background-color: #0F172A !important; color: #FFF !important;">
            <b>TOTAL REGISTERED:</b> <span style="color: #38BDF8; font-weight: 900;">${totalInReport}</span>
          </div>
          <div class="sitrep-box" style="background-color: #D1FAE5 !important; color: #065F46 !important;">
            <b>PAID &amp; VERIFIED:</b> <span style="font-weight: 900;">${paidInReport}</span> (${paidPct}%)
          </div>
          <div class="sitrep-box" style="background-color: #FEF3C7 !important; color: #92400E !important;">
            <b>DAY 1 ADMITTED:</b> <span style="font-weight: 900;">${day1InReport}</span>
          </div>
          <div class="sitrep-box" style="background-color: #EDE9FE !important; color: #5B21B6 !important;">
            <b>DAY 2 ADMITTED:</b> <span style="font-weight: 900;">${day2InReport}</span>
          </div>
        </div>

        <table>
          <thead>
            <tr>
              <th style="width: 25px;">#</th>
              <th style="width: 80px;">Ticket Ref</th>
              <th style="width: 85px;">Student ID</th>
              <th>Student Full Name</th>
              <th>College Department</th>
              <th>Section</th>
              <th>Year</th>
              <th>Payment Status</th>
              <th>Day 1 (Sept 17)</th>
              <th>Day 2 (Sept 18)</th>
            </tr>
          </thead>
          <tbody>
            ${filtered.map((d, idx) => {
              const theme = getCollegeTheme(d.department);
              const isPaid = d.payment_status === 'paid';
              const isDay1 = d.day1_status === 'attended';
              const isDay2 = d.day2_status === 'attended';
              return `
                <tr style="background-color: ${theme.rowBg} !important;">
                  <td style="text-align: center; font-weight: bold; color: #64748B;">${idx + 1}</td>
                  <td style="text-align: center; font-weight: bold; font-family: monospace;">${d.ticket_code}</td>
                  <td style="text-align: center; font-weight: bold; font-family: monospace;">${d.student_id}</td>
                  <td style="font-weight: bold; color: #0F172A;">${d.full_name}</td>
                  <td style="text-align: center; background-color: ${theme.badgeBg} !important; color: ${theme.badgeText} !important; font-weight: bold;">
                    ${theme.icon} ${theme.name}
                  </td>
                  <td style="text-align: center; font-weight: bold;">${d.program_section}</td>
                  <td style="text-align: center;">${d.year_level || '1st Year'}</td>
                  <td style="text-align: center; font-weight: bold; color: ${isPaid ? '#065F46' : '#991B1B'}; background-color: ${isPaid ? '#D1FAE5' : '#FEE2E2'} !important;">
                    ${isPaid ? '💳 PAID' : '⏳ UNPAID'}
                  </td>
                  <td style="text-align: center; font-weight: bold; color: ${isDay1 ? '#15803D' : '#64748B'}; background-color: ${isDay1 ? '#DCFCE7' : '#F1F5F9'} !important;">
                    ${isDay1 ? `✅ IN (${d.day1_time || '08:14 AM'})` : '❌ NOT IN'}
                  </td>
                  <td style="text-align: center; font-weight: bold; color: ${isDay2 ? '#15803D' : '#64748B'}; background-color: ${isDay2 ? '#DCFCE7' : '#F1F5F9'} !important;">
                    ${isDay2 ? `✅ IN (${d.day2_time || '08:45 PM'})` : '❌ NOT IN'}
                  </td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>

        <div class="footer-strip">
          <span>⚡ POWERED BY SUPREME STUDENT GOVERNMENT (SSG) • URS PILILLA CAMPUS | System by @noir_et_blancc66</span>
          <span>URSPANTROPIKO 2026 • OFFICIAL EVENT MASTERLIST</span>
        </div>

        <script>
          window.onload = function() { window.print(); }
        </script>
      </body>
      </html>
    `;

    printWindow.document.write(html);
    printWindow.document.close();
  };

  const [dismissedPingId, setDismissedPingId] = useState(null);

  const activePing = livePings.length > 0 && livePings[0].id !== dismissedPingId ? livePings[0] : null;

  return (
    <motion.div
      className="admin-root-container"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 20 }}
      transition={{ duration: 0.3 }}
    >
      {/* Floating Live Activity Toast Notification (Fixed cleanly below Navbar) */}
      <AnimatePresence>
        {activePing && (
          <motion.div
            key={activePing.id}
            initial={{ opacity: 0, y: -30, scale: 0.92, x: 20 }}
            animate={{ opacity: 1, y: 0, scale: 1, x: 0 }}
            exit={{ opacity: 0, y: -20, scale: 0.92, x: 20 }}
            transition={{ type: "spring", stiffness: 400, damping: 25 }}
            style={{
              position: 'fixed',
              top: '82px',
              right: '24px',
              zIndex: 99999,
              background: 'linear-gradient(135deg, rgba(15, 23, 42, 0.96) 0%, rgba(30, 41, 59, 0.96) 100%)',
              border: activePing.type === 'admission' ? '2px solid #10B981' : activePing.type === 'deletion' ? '2px solid #EF4444' : '2px solid #FFD100',
              borderRadius: '14px',
              padding: '12px 18px',
              boxShadow: '0 16px 40px rgba(0,0,0,0.7), 0 0 25px rgba(255, 209, 0, 0.25)',
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              maxWidth: '420px',
              backdropFilter: 'blur(20px)'
            }}
          >
            <div style={{
              fontSize: '1.4rem',
              background: activePing.type === 'admission' ? 'rgba(16, 185, 129, 0.2)' : activePing.type === 'deletion' ? 'rgba(239, 68, 68, 0.2)' : 'rgba(255, 209, 0, 0.2)',
              padding: '8px',
              borderRadius: '10px',
              border: `1px solid ${activePing.type === 'admission' ? '#10B981' : activePing.type === 'deletion' ? '#EF4444' : '#FFD100'}`
            }}>
              {activePing.type === 'admission' ? '⚡' : activePing.type === 'deletion' ? '🗑️' : '🎉'}
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: '0.75rem', fontWeight: '800', color: activePing.type === 'admission' ? '#34D399' : activePing.type === 'deletion' ? '#F87171' : '#FEF08A', textTransform: 'uppercase', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span>{activePing.title}</span>
                <span style={{ color: '#94A3B8', fontSize: '0.7rem' }}>{activePing.timestamp}</span>
              </div>
              <div style={{ fontSize: '0.82rem', color: '#FFFFFF', fontWeight: '600', marginTop: '2px', lineHeight: '1.3' }}>
                {activePing.message}
              </div>
            </div>
            <button
              onClick={() => setDismissedPingId(activePing.id)}
              style={{
                background: 'rgba(255,255,255,0.08)',
                border: 'none',
                color: '#94A3B8',
                cursor: 'pointer',
                borderRadius: '50%',
                width: '22px',
                height: '22px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '11px',
                marginLeft: '4px'
              }}
              title="Dismiss notification"
            >
              ✕
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Top Hero Brand Header with Motion Reveal & Watermark Clock */}
      <motion.section
        className="admin-hero-banner"
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ type: "spring", stiffness: 300, damping: 25 }}
      >
        {/* Giant Ambient Digital Clock Watermark */}
        <div className="hero-time-watermark" aria-hidden="true">
          {phClock.time}
        </div>

        <div className="admin-hero-top-row">
          <motion.div className="admin-brand-left" whileHover={{ scale: 1.01 }}>
            <img src="/logo.png" alt="URSP SSG Logo" className="brand-header-logo" />
            <div>
              <div className="brand-badge-row">
                <span className="brand-badge-pill">🏛️ UNIVERSITY OF RIZAL SYSTEM • PILILLA</span>
                <span className="brand-badge-pill highlight">⚡ 2-DAY LIVE RECONCILIATION</span>
                <span className="brand-badge-pill ph-pill">🇵🇭 VENUE RECONCILIATION</span>
              </div>
              <h1 className="admin-hero-title">URSPANTROPIKO 2026</h1>
              <p className="admin-hero-subtitle">
                "ONE ISLAND, ONE CAMPUS, ONE IDENTITY — RED HAWKS SOARING IN UNITY" • 📅 Sept 17-18, 2026
              </p>
            </div>
          </motion.div>

          {/* Big Command Center Digital Clock HUD Card */}
          <div className="hero-live-clock-card">
            <div className="live-clock-top">
              <span className="live-pulse-dot" />
              <span className="live-clock-label">PHILIPPINE STANDARD TIME (GMT+8)</span>
            </div>
            <div className="live-clock-digits">{phClock.time}</div>
            <div className="live-clock-date">{phClock.date}</div>
          </div>
        </div>

        {/* Bottom Quick Action Bar & Navigation */}
        <div className="admin-nav-bar">
          {/* Navigation Tab Pills with Smooth Active Pill Glow */}
          <div className="tab-pill-group">
            <button
              className={`tab-pill-btn ${activeTab === 'masterlist' ? 'active' : ''}`}
              onClick={() => setActiveTab('masterlist')}
            >
              📋 Masterlist &amp; Ledger
            </button>
            <button
              className={`tab-pill-btn ${activeTab === 'analytics' ? 'active' : ''}`}
              onClick={() => setActiveTab('analytics')}
            >
              📊 Graphical Analytics
            </button>
            <button
              className={`tab-pill-btn ${activeTab === 'access' ? 'active' : ''}`}
              onClick={() => setActiveTab('access')}
            >
              🛡️ Access Hub &amp; QRs
            </button>
          </div>

          <div className="btn-action-row">
            <motion.button
              className="btn-hero-action btn-hero-excel"
              whileHover={{ scale: 1.04, y: -1 }}
              whileTap={{ scale: 0.95 }}
              onClick={downloadExcel}
            >
              📊 Download Excel (.xls)
            </motion.button>
            <motion.button
              className="btn-hero-action btn-hero-preview"
              whileHover={{ scale: 1.04, y: -1 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => setShowExcelPreviewModal(true)}
            >
              👁️ Excel &amp; Print Preview
            </motion.button>
            <motion.button
              className="btn-hero-action btn-hero-student-qr"
              whileHover={{ scale: 1.04, y: -1 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => setShowStudentQRModal(true)}
            >
              📄 Student Pass QR
            </motion.button>
            <motion.button
              className="btn-hero-action btn-hero-usher-qr"
              whileHover={{ scale: 1.04, y: -1 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => setShowUsherQRModal(true)}
            >
              📲 Master Usher QR
            </motion.button>
          </div>
        </div>
      </motion.section>

      {/* Animated Motion Divider */}
      <motion.div
        className="motion-divider"
        initial={{ scaleX: 0.8, opacity: 0.4 }}
        whileInView={{ scaleX: 1, opacity: 1 }}
        viewport={{ once: true }}
        transition={{ duration: 0.6 }}
      />

      {/* 5-KPI Ribbon for 2-Day Event with Spring Scroll Reveal */}
      <section style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
        gap: '14px',
        marginBottom: '20px'
      }}>
        <motion.div
          className="kpi-card"
          initial={{ opacity: 0, y: 15 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          whileHover={{ scale: 1.025, y: -4 }}
          transition={{ type: "spring", stiffness: 350, damping: 22 }}
        >
          <div className="kpi-label">Total Registered</div>
          <div className="kpi-val text-blue">{totalCount.toLocaleString()}</div>
          <div className="kpi-sub">URS Pililla • Sept 17-18, 2026</div>
        </motion.div>
        <motion.div
          className="kpi-card"
          initial={{ opacity: 0, y: 15 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          whileHover={{ scale: 1.025, y: -4 }}
          transition={{ type: "spring", stiffness: 350, damping: 22, delay: 0.05 }}
        >
          <div className="kpi-label">Paid &amp; Verified</div>
          <div className="kpi-val text-green">{paidCount.toLocaleString()} <span className="text-sm font-normal">({paidPercent}%)</span></div>
          <div className="kpi-sub">Reconciled via Class Ledger</div>
        </motion.div>
        <motion.div
          className="kpi-card"
          initial={{ opacity: 0, y: 15 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          whileHover={{ scale: 1.025, y: -4 }}
          transition={{ type: "spring", stiffness: 350, damping: 22, delay: 0.1 }}
        >
          <div className="kpi-label">🌅 Day 1 Admitted</div>
          <div className="kpi-val text-yellow">{day1Count.toLocaleString()} <span className="text-sm font-normal">({day1Percent}%)</span></div>
          <div className="kpi-sub">Opening Assembly (Sept 17)</div>
        </motion.div>
        <motion.div
          className="kpi-card"
          initial={{ opacity: 0, y: 15 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          whileHover={{ scale: 1.025, y: -4 }}
          transition={{ type: "spring", stiffness: 350, damping: 22, delay: 0.15 }}
        >
          <div className="kpi-label">🌴 Day 2 Admitted</div>
          <div className="kpi-val" style={{ color: '#A78BFA' }}>{day2Count.toLocaleString()} <span className="text-sm font-normal">({day2Percent}%)</span></div>
          <div className="kpi-sub">Grand Culmination (Sept 18)</div>
        </motion.div>
        <motion.div
          className="kpi-card"
          initial={{ opacity: 0, y: 15 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          whileHover={{ scale: 1.025, y: -4 }}
          transition={{ type: "spring", stiffness: 350, damping: 22, delay: 0.2 }}
        >
          <div className="kpi-label">🌟 Both Days Complete</div>
          <div className="kpi-val text-green">{bothDaysCount.toLocaleString()}</div>
          <div className="kpi-sub">Attended Both Event Nights</div>
        </motion.div>
      </section>

      {/* Animated Motion Divider */}
      <motion.div
        className="motion-divider"
        initial={{ scaleX: 0.8, opacity: 0.4 }}
        whileInView={{ scaleX: 1, opacity: 1 }}
        viewport={{ once: true }}
        transition={{ duration: 0.6 }}
      />

      {/* 3 COLLEGES SUMMARY BANNER STRIP (Uniform, Modern, Responsive) */}
      <section className="college-summary-grid">
        {/* College of Education Card */}
        <motion.div
          className="college-card-uniform coed-card"
          whileHover={{ scale: 1.015, y: -2 }}
          whileTap={{ scale: 0.99 }}
        >
          <div className="college-card-header">
            <span className="college-chip chip-coed">
              📚 COED • College of Education
            </span>
            <span className="college-percent text-yellow">{collegeMetrics.education.pct}%</span>
          </div>

          <div className="college-card-body">
            <div className="college-main-stat">
              <span className="college-count">{collegeMetrics.education.count}</span>
              <span className="college-label">Enrolled</span>
            </div>

            <div className="college-stat-pills">
              <div className="stat-pill-item">
                <span className="stat-pill-label">💳 Paid:</span>
                <span className="stat-pill-val">{collegeMetrics.education.paid}</span>
              </div>
              <div className="stat-pill-item">
                <span className="stat-pill-label">🌅 Day 1:</span>
                <span className="stat-pill-val">{collegeMetrics.education.day1}</span>
              </div>
              <div className="stat-pill-item">
                <span className="stat-pill-label">🌴 Day 2:</span>
                <span className="stat-pill-val">{collegeMetrics.education.day2}</span>
              </div>
            </div>
          </div>
        </motion.div>

        {/* College of Social Sciences Card */}
        <motion.div
          className="college-card-uniform css-card"
          whileHover={{ scale: 1.015, y: -2 }}
          whileTap={{ scale: 0.99 }}
        >
          <div className="college-card-header">
            <span className="college-chip chip-css">
              ⚖️ CSS • College of Social Sciences
            </span>
            <span className="college-percent" style={{ color: '#C4B5FD' }}>{collegeMetrics.social.pct}%</span>
          </div>

          <div className="college-card-body">
            <div className="college-main-stat">
              <span className="college-count">{collegeMetrics.social.count}</span>
              <span className="college-label">Enrolled</span>
            </div>

            <div className="college-stat-pills">
              <div className="stat-pill-item">
                <span className="stat-pill-label">💳 Paid:</span>
                <span className="stat-pill-val">{collegeMetrics.social.paid}</span>
              </div>
              <div className="stat-pill-item">
                <span className="stat-pill-label">🌅 Day 1:</span>
                <span className="stat-pill-val">{collegeMetrics.social.day1}</span>
              </div>
              <div className="stat-pill-item">
                <span className="stat-pill-label">🌴 Day 2:</span>
                <span className="stat-pill-val">{collegeMetrics.social.day2}</span>
              </div>
            </div>
          </div>
        </motion.div>

        {/* College of Business Card */}
        <motion.div
          className="college-card-uniform cb-card"
          whileHover={{ scale: 1.015, y: -2 }}
          whileTap={{ scale: 0.99 }}
        >
          <div className="college-card-header">
            <span className="college-chip chip-cb">
              💼 CB • College of Business
            </span>
            <span className="college-percent text-green">{collegeMetrics.business.pct}%</span>
          </div>

          <div className="college-card-body">
            <div className="college-main-stat">
              <span className="college-count">{collegeMetrics.business.count}</span>
              <span className="college-label">Enrolled</span>
            </div>

            <div className="college-stat-pills">
              <div className="stat-pill-item">
                <span className="stat-pill-label">💳 Paid:</span>
                <span className="stat-pill-val">{collegeMetrics.business.paid}</span>
              </div>
              <div className="stat-pill-item">
                <span className="stat-pill-label">🌅 Day 1:</span>
                <span className="stat-pill-val">{collegeMetrics.business.day1}</span>
              </div>
              <div className="stat-pill-item">
                <span className="stat-pill-label">🌴 Day 2:</span>
                <span className="stat-pill-val">{collegeMetrics.business.day2}</span>
              </div>
            </div>
          </div>
        </motion.div>
      </section>

      {/* TAB 1: MASTERLIST & LEDGER RECONCILIATION */}
      {activeTab === 'masterlist' && (
        <motion.section
          className="panel-box"
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.3 }}
        >
          <div className="panel-toolbar">
            <div className="search-wrap">
              <motion.input
                type="text"
                placeholder="🔍 Search student name, ID, section, or ticket code..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="input-search"
                whileHover={{ scale: 1.01 }}
                whileTap={{ scale: 0.99 }}
              />
            </div>

            <div className="filter-group">
              {/* College Filter */}
              <motion.select
                value={selectedDepartment}
                onChange={(e) => setSelectedDepartment(e.target.value)}
                className="select-filter"
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                <option value="ALL">🏛️ All 3 Colleges</option>
                {OFFICIAL_COLLEGES.map(c => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </motion.select>

              {/* Section Filter */}
              <motion.select
                value={selectedSection}
                onChange={(e) => setSelectedSection(e.target.value)}
                className="select-filter"
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                <option value="ALL">All Sections</option>
                {[...new Set(tickets.map(t => t.program_section).filter(Boolean))].sort().map(sec => (
                  <option key={sec} value={sec}>{sec}</option>
                ))}
              </motion.select>

              {/* Year Level Filter */}
              <motion.select
                value={selectedYearLevel}
                onChange={(e) => setSelectedYearLevel(e.target.value)}
                className="select-filter"
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                <option value="ALL">All Year Levels</option>
                <option value="1st Year">1st Year</option>
                <option value="2nd Year">2nd Year</option>
                <option value="3rd Year">3rd Year</option>
                <option value="4th Year">4th Year</option>
              </motion.select>

              {/* Payment Filter */}
              <motion.select
                value={selectedPaymentStatus}
                onChange={(e) => setSelectedPaymentStatus(e.target.value)}
                className="select-filter"
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                <option value="ALL">All Payments</option>
                <option value="paid">💳 Paid &amp; Verified</option>
                <option value="unpaid">⏳ Unpaid Only</option>
              </motion.select>

              {/* Day 1 Filter */}
              <motion.select
                value={selectedDay1Status}
                onChange={(e) => setSelectedDay1Status(e.target.value)}
                className="select-filter"
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                <option value="ALL">🌅 Day 1: All</option>
                <option value="attended">✅ Day 1 In</option>
                <option value="not_attended">❌ Day 1 Absent</option>
              </motion.select>

              {/* Day 2 Filter */}
              <motion.select
                value={selectedDay2Status}
                onChange={(e) => setSelectedDay2Status(e.target.value)}
                className="select-filter"
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                <option value="ALL">🌴 Day 2: All</option>
                <option value="attended">✅ Day 2 In</option>
                <option value="not_attended">❌ Day 2 Absent</option>
              </motion.select>

              {/* Duplicate Detection Toggle Filter */}
              <motion.button
                type="button"
                className={`btn-dup-filter ${showDuplicatesOnly ? 'active' : ''}`}
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.97 }}
                onClick={() => setShowDuplicatesOnly(prev => !prev)}
                title="Toggle viewing duplicate entries only"
              >
                ⚠️ {showDuplicatesOnly ? 'Showing Duplicates' : 'Filter Duplicates'}
                <span className="dup-count-badge">{duplicateAttendeesCount}</span>
              </motion.button>

              {/* Bulk Verify Button */}
              {selectedSection !== 'ALL' && (
                <motion.button
                  className="btn-bulk-verify"
                  whileHover={{ scale: 1.03 }}
                  whileTap={{ scale: 0.97 }}
                  onClick={() => onBulkVerify(selectedSection)}
                >
                  ✅ Mark {selectedSection} Paid
                </motion.button>
              )}
            </div>
          </div>

          {/* Masterlist Data Table with Auto-Incremented Sequential Numbers */}
          <div className="table-responsive">
            <table className="master-table">
              <thead>
                <tr>
                  <th style={{ width: '50px', textAlign: 'center' }}>#</th>
                  <th style={{ width: '90px' }}>Ticket Ref</th>
                  <th>Student Name &amp; ID</th>
                  <th>Collegiate Department</th>
                  <th>Section &amp; Year</th>
                  <th>Payment Status</th>
                  <th style={{ width: '130px', textAlign: 'center' }}>🌅 Day 1 (Sept 17)</th>
                  <th style={{ width: '130px', textAlign: 'center' }}>🌴 Day 2 (Sept 18)</th>
                  <th style={{ width: '170px', textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((item, idx) => {
                  const theme = getCollegeTheme(item.department);
                  const isHighlighted = highlightedCode === item.ticket_code;
                  const isDay1 = item.day1_status === 'attended';
                  const isDay2 = item.day2_status === 'attended';

                  const idKey = (item.student_id || '').trim().toLowerCase();
                  const nameKey = (item.full_name || '').trim().toLowerCase();
                  const isDuplicateId = idKey && duplicatesMap.idCounts[idKey] > 1;
                  const isDuplicateName = nameKey && duplicatesMap.nameCounts[nameKey] > 1;
                  const isDuplicate = isDuplicateId || isDuplicateName;

                  return (
                    <motion.tr
                      layout
                      key={item.ticket_code || item.id}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.95 }}
                      transition={{ type: "spring", stiffness: 450, damping: 30 }}
                      className={`${isHighlighted ? 'row-highlight-pulse' : ''} ${isDuplicate ? 'row-duplicate-warn' : ''}`}
                    >
                      {/* Dynamic 1-to-N Auto-Increment Sequential Number */}
                      <td style={{ textAlign: 'center' }}>
                        <span className="row-seq-badge">#{idx + 1}</span>
                      </td>
                      <td>
                        <span className="ticket-code-pill font-mono">{item.ticket_code}</span>
                      </td>
                      <td>
                        <div className="font-bold text-white text-sm flex items-center gap-2">
                          <span>{item.full_name}</span>
                          {isDuplicate && (
                            <span className="duplicate-tag" title="Potential duplicate student entry detected">
                              ⚠️ {isDuplicateId ? 'Duplicate ID' : 'Duplicate Name'}
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-muted font-mono">ID: {item.student_id}</div>
                      </td>
                      <td>
                        <span
                          className="status-pill"
                          style={{
                            backgroundColor: theme.darkBadgeBg,
                            color: theme.darkBadgeText,
                            border: `1px solid ${theme.darkBadgeBorder}`,
                            fontWeight: '700'
                          }}
                        >
                          {theme.icon} {theme.name}
                        </span>
                      </td>
                      <td>
                        <div className="section-pill">{item.program_section}</div>
                        <div className="year-tag">{item.year_level || '1st Year'}</div>
                      </td>
                      <td>
                        <span
                          onClick={() => onTogglePayment(item.ticket_code)}
                          style={{ cursor: 'pointer' }}
                          title="Click to toggle payment status"
                          className={`status-pill ${item.payment_status === 'paid' ? 'status-paid' : 'status-unpaid'}`}
                        >
                          {item.payment_status === 'paid' ? '💳 Paid & Verified' : '⏳ Unpaid'}
                        </span>
                      </td>
                      
                      {/* Day 1 Check-In Column */}
                      <td style={{ textAlign: 'center' }}>
                        <button
                          type="button"
                          onClick={() => handleToggleDay(item.ticket_code, 'day1')}
                          className={`gate-checkin-btn ${isDay1 ? 'attended' : 'absent'}`}
                          title="Click to toggle Day 1 attendance"
                        >
                          {isDay1 ? `✅ In (${item.day1_time || '08:14 AM'})` : '❌ Absent'}
                        </button>
                      </td>

                      {/* Day 2 Check-In Column */}
                      <td style={{ textAlign: 'center' }}>
                        <button
                          type="button"
                          onClick={() => handleToggleDay(item.ticket_code, 'day2')}
                          className={`gate-checkin-btn ${isDay2 ? 'attended' : 'absent'}`}
                          title="Click to toggle Day 2 attendance"
                        >
                          {isDay2 ? `✅ In (${item.day2_time || '08:45 PM'})` : '❌ Absent'}
                        </button>
                      </td>

                      {/* Actions: Verify/Undo + Remove Row Button */}
                      <td style={{ textAlign: 'right' }}>
                        <div className="flex items-center justify-end gap-2">
                          <motion.button
                            className={`btn-action ${item.payment_status === 'paid' ? 'btn-undo' : 'btn-verify'}`}
                            whileHover={{ scale: 1.04 }}
                            whileTap={{ scale: 0.95 }}
                            onClick={() => onTogglePayment(item.ticket_code)}
                            title={item.payment_status === 'paid' ? 'Revert to unpaid' : 'Mark as paid'}
                          >
                            {item.payment_status === 'paid' ? 'Undo' : 'Verify'}
                          </motion.button>

                          <motion.button
                            className="btn-action-delete"
                            whileHover={{ scale: 1.08 }}
                            whileTap={{ scale: 0.92 }}
                            onClick={() => setAttendeeToDelete(item)}
                            title="Remove student from masterlist (Delete duplicate)"
                          >
                            🗑️
                          </motion.button>
                        </div>
                      </td>
                    </motion.tr>
                  );
                })}
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan="9" className="text-center py-8 text-muted">
                      {showDuplicatesOnly 
                        ? '🎉 No duplicate attendees found in the dataset!'
                        : 'No attendees match the current search / filter criteria.'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </motion.section>
      )}

      {/* TAB 2: GRAPHICAL ANALYTICS & 3 COLLEGES INFOGRAPHICS */}
      {activeTab === 'analytics' && (
        <motion.section
          className="analytics-layout"
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.3 }}
        >
          {/* Executive SITREP Summary Cards with Solid Dark Backing & Vibrant Highlighters */}
          <section className="sitrep-grid">
            <motion.div
              className="quick-action-card"
              initial={{ opacity: 0, y: 15 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              whileHover={{ scale: 1.025, y: -4 }}
              transition={{ type: "spring", stiffness: 350, damping: 22 }}
            >
              <div className="sitrep-card-header">
                <span className="sitrep-header-badge yellow">📊 LIVE AUDIT</span>
                <h3 className="sitrep-title">2-Day SITREP Summary</h3>
                <p className="sitrep-sub">Gate check-in velocity &amp; attendance breakdown.</p>
              </div>

              <div className="sitrep-metrics-list">
                <div className="sitrep-pill-row">
                  <span className="sitrep-pill-label">🌅 Day 1 Admitted:</span>
                  <span className="sitrep-highlight-tag yellow">{day1Count.toLocaleString()} <small>({day1Percent}%)</small></span>
                </div>
                <div className="sitrep-pill-row">
                  <span className="sitrep-pill-label">🌴 Day 2 Admitted:</span>
                  <span className="sitrep-highlight-tag purple">{day2Count.toLocaleString()} <small>({day2Percent}%)</small></span>
                </div>
                <div className="sitrep-pill-row">
                  <span className="sitrep-pill-label">💳 Verified Paid:</span>
                  <span className="sitrep-highlight-tag green">{paidCount.toLocaleString()} <small>({paidPercent}%)</small></span>
                </div>
              </div>
            </motion.div>

            <motion.div
              className="quick-action-card"
              initial={{ opacity: 0, y: 15 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              whileHover={{ scale: 1.025, y: -4 }}
              transition={{ type: "spring", stiffness: 350, damping: 22, delay: 0.08 }}
            >
              <div className="sitrep-card-header">
                <span className="sitrep-header-badge purple">🏛️ CAMPUS REACH</span>
                <h3 className="sitrep-title">3-Colleges Distribution</h3>
                <p className="sitrep-sub">Enrolled student representation across URS Pililla.</p>
              </div>

              <div className="sitrep-metrics-list">
                <div className="sitrep-pill-row">
                  <span className="sitrep-pill-label">📚 Education (COED):</span>
                  <span className="sitrep-highlight-tag yellow">{collegeMetrics.education.count} <small>({collegeMetrics.education.pct}%)</small></span>
                </div>
                <div className="sitrep-pill-row">
                  <span className="sitrep-pill-label">⚖️ Social Sci (CSS):</span>
                  <span className="sitrep-highlight-tag purple">{collegeMetrics.social.count} <small>({collegeMetrics.social.pct}%)</small></span>
                </div>
                <div className="sitrep-pill-row">
                  <span className="sitrep-pill-label">💼 Business (CB):</span>
                  <span className="sitrep-highlight-tag green">{collegeMetrics.business.count} <small>({collegeMetrics.business.pct}%)</small></span>
                </div>
              </div>
            </motion.div>

            <motion.div
              className="quick-action-card"
              initial={{ opacity: 0, y: 15 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              whileHover={{ scale: 1.025, y: -4 }}
              transition={{ type: "spring", stiffness: 350, damping: 22, delay: 0.16 }}
            >
              <div className="sitrep-card-header">
                <span className="sitrep-header-badge green">⚡ EXPORT DISPATCH</span>
                <h3 className="sitrep-title">Quick Export Actions</h3>
                <p className="sitrep-sub">Download official executive spreadsheets or printable reports.</p>
              </div>

              <div className="flex flex-col gap-2 mt-4">
                <motion.button
                  className="btn-bulk-verify w-full"
                  whileHover={{ scale: 1.03, y: -1 }}
                  whileTap={{ scale: 0.96 }}
                  onClick={downloadExcel}
                >
                  📊 Download Excel Sheet (.xls)
                </motion.button>
                <motion.button
                  className="btn-hero-preview w-full text-center"
                  whileHover={{ scale: 1.03, y: -1 }}
                  whileTap={{ scale: 0.96 }}
                  onClick={() => setShowExcelPreviewModal(true)}
                  style={{ justifyContent: 'center', padding: '10px 14px', fontSize: '13px' }}
                >
                  👁️ Open Excel &amp; Print Modal
                </motion.button>
              </div>
            </motion.div>
          </section>

          <div className="analytics-grid">
            {/* 3 Colleges Breakdown Bar Chart */}
            <motion.div
              className="chart-card"
              initial={{ opacity: 0, y: 15 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              whileHover={{ scale: 1.015, y: -3 }}
            >
              <div className="chart-header">
                <h3>3 Official Colleges Participation (COED / CSS / CB)</h3>
              </div>
              <div style={{ width: '100%', height: 300 }}>
                <ResponsiveContainer>
                  <BarChart data={deptData} margin={{ top: 20, right: 30, left: 0, bottom: 20 }}>
                    <XAxis dataKey="name" stroke="#94A3B8" fontSize={12} />
                    <YAxis stroke="#94A3B8" fontSize={11} />
                    <Tooltip contentStyle={{ backgroundColor: '#1E293B', borderColor: '#334155', borderRadius: '8px', color: '#FFF' }} />
                    <Legend />
                    <Bar dataKey="total" name="Total Registered" fill="#3B82F6" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="paid" name="Paid &amp; Verified" fill="#10B981" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="day1" name="Day 1 Admitted" fill="#F59E0B" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="day2" name="Day 2 Admitted" fill="#8B5CF6" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </motion.div>

            {/* Year Level Distribution Pie */}
            <motion.div
              className="chart-card"
              initial={{ opacity: 0, y: 15 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              whileHover={{ scale: 1.015, y: -3 }}
              transition={{ delay: 0.1 }}
            >
              <div className="chart-header">
                <h3>Academic Year Level Breakdown</h3>
              </div>
              <div style={{ width: '100%', height: 300 }}>
                <ResponsiveContainer>
                  <PieChart>
                    <Pie
                      data={yearData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={95}
                      paddingAngle={5}
                      dataKey="value"
                      label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                    >
                      {yearData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={['#3B82F6', '#10B981', '#F59E0B', '#8B5CF6'][index % 4]} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={{ backgroundColor: '#1E293B', borderColor: '#334155', borderRadius: '8px', color: '#FFF' }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </motion.div>
          </div>
        </motion.section>
      )}

      {/* TAB 3: ACCESS CONTROL & USHER MANAGEMENT (Centered & Polished) */}
      {activeTab === 'access' && (
        <motion.section
          style={{ maxWidth: '1050px', margin: '0 auto' }}
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.3 }}
        >
          <div className="access-hub-grid">
            {/* Card 1: Master Usher Scanner Pass */}
            <motion.div
              className="access-hub-card"
              initial={{ opacity: 0, y: 15 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              whileHover={{ scale: 1.025, y: -4 }}
              transition={{ type: "spring", stiffness: 350, damping: 22 }}
            >
              <div className="badge-tag">MARSHAL DISPATCH PASS</div>
              <h3 className="mt-3 text-lg font-bold text-white">Single Master Usher Access Pass</h3>
              <p className="text-xs text-muted mt-1 mb-2">
                Ushers scan this single QR from your screen with their mobile camera to unlock the gate scanner.
              </p>

              <div className="qr-container-box">
                <QRCode value={masterUsherUrl} size={180} level="H" />
              </div>

              <div className="w-full flex flex-col gap-2 mt-2">
                <div className="text-xs font-mono text-blue bg-[#0D1322] p-2 rounded border border-border-color break-all text-center">
                  {masterUsherUrl}
                </div>
                <motion.button
                  className="btn-bulk-verify w-full"
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => copyToClipboard(masterUsherUrl, "Usher Scanner Link")}
                >
                  📋 Copy Master Usher Link
                </motion.button>
                <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                  <a
                    href={masterUsherUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="btn-action btn-undo text-center block w-full mt-1"
                  >
                    📱 Open Scanner on this Device
                  </a>
                </motion.div>
              </div>
            </motion.div>

            {/* Card 2: Student Registration Broadcast */}
            <motion.div
              className="access-hub-card"
              initial={{ opacity: 0, y: 15 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              whileHover={{ scale: 1.025, y: -4 }}
              transition={{ type: "spring", stiffness: 350, damping: 22, delay: 0.1 }}
            >
              <div className="badge-tag">PUBLIC REGISTRATION PASS</div>
              <h3 className="mt-3 text-lg font-bold text-white">Student Registration Broadcast Hub</h3>
              <p className="text-xs text-muted mt-1 mb-2">
                Public registration link and QR pass for 1,400+ students across the 3 colleges.
              </p>

              <div className="qr-container-box">
                <QRCode value={studentRegisterUrl} size={180} level="H" />
              </div>

              <div className="w-full flex flex-col gap-2 mt-2">
                <div className="text-xs font-mono text-green bg-[#0D1322] p-2 rounded border border-border-color break-all text-center">
                  {studentRegisterUrl}
                </div>
                <motion.button
                  className="btn-bulk-verify w-full"
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => copyToClipboard(studentRegisterUrl, "Student Registration Link")}
                >
                  📋 Copy Public Registration Link
                </motion.button>
                <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                  <a
                    href={studentRegisterUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="btn-action btn-undo text-center block w-full mt-1"
                  >
                    📝 Open Student Registration Form
                  </a>
                </motion.div>
              </div>
            </motion.div>
          </div>
        </motion.section>
      )}

      {/* ========================================== */}
      {/* MODAL 1: EXCEL LIVE PREVIEW & PRINT/PDF MODAL */}
      {/* ========================================== */}
      {showExcelPreviewModal && (
        <div className="modal-backdrop" onClick={() => setShowExcelPreviewModal(false)}>
          <div
            className="modal-card"
            style={{ maxWidth: '1100px', width: '95%', maxHeight: '92vh', display: 'flex', flexDirection: 'column' }}
            onClick={e => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="modal-header" style={{ borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '14px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span style={{ fontSize: '1.4rem' }}>📊</span>
                <div>
                  <h3 style={{ margin: 0, fontSize: '1.15rem', color: '#FFF', fontWeight: '800' }}>
                    URSPantropiko 2-Day Excel Spreadsheet &amp; Print Preview
                  </h3>
                  <p style={{ margin: '2px 0 0 0', fontSize: '0.75rem', color: '#94A3B8' }}>
                    Live spreadsheet simulator with 3–Colleges color coding, 2-day gate records, and SITREP header.
                  </p>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <select
                  value={previewPaperSize}
                  onChange={e => setPreviewPaperSize(e.target.value)}
                  style={{
                    background: 'rgba(255,255,255,0.08)',
                    color: '#FFF',
                    border: '1px solid rgba(255,255,255,0.15)',
                    borderRadius: '8px',
                    padding: '6px 12px',
                    fontSize: '0.8rem'
                  }}
                >
                  <option value="a4_landscape">📄 A4 Landscape</option>
                  <option value="a4_portrait">📄 A4 Portrait</option>
                </select>

                <motion.button
                  className="btn-action btn-undo"
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={handlePrint}
                  style={{ padding: '6px 14px', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '6px' }}
                >
                  🖨️ Print / PDF
                </motion.button>

                <motion.button
                  className="btn-bulk-verify"
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={downloadExcel}
                  style={{ padding: '6px 14px', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '6px' }}
                >
                  ⬇️ Download Excel (.xls)
                </motion.button>

                <motion.button
                  className="btn-close"
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => setShowExcelPreviewModal(false)}
                >
                  ✕
                </motion.button>
              </div>
            </div>

            {/* Modal Body / Sheet Simulator */}
            <div className="modal-body" style={{ overflowY: 'auto', padding: '16px', background: '#090D16' }}>
              <div style={{
                background: '#FFFFFF',
                color: '#0F172A',
                borderRadius: '8px',
                padding: '16px',
                boxShadow: '0 8px 30px rgba(0,0,0,0.5)',
                minWidth: '780px'
              }}>
                {/* Official University Header */}
                <div style={{
                  background: 'linear-gradient(135deg, #881337 0%, #4C0519 100%)',
                  color: '#FFFFFF',
                  padding: '14px 20px',
                  borderRadius: '8px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '16px',
                  marginBottom: '12px',
                  boxShadow: '0 4px 14px rgba(0,0,0,0.3)'
                }}>
                  <img 
                    src="/logo.png" 
                    alt="URSP SSG Seal" 
                    style={{
                      width: '60px',
                      height: '60px',
                      borderRadius: '50%',
                      border: '2.5px solid #FFD100',
                      background: '#FFF',
                      objectFit: 'contain',
                      boxShadow: '0 0 15px rgba(255, 209, 0, 0.65)',
                      flexShrink: 0
                    }}
                  />
                  <div style={{ flex: 1, textAlign: 'center' }}>
                    <div style={{ fontSize: '0.88rem', fontWeight: '800', color: '#FEF08A', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                      🏛️ University of Rizal System • Pililla Campus
                    </div>
                    <h2 style={{ margin: '4px 0', fontSize: '1.25rem', fontWeight: '900', color: '#FFFFFF', letterSpacing: '0.5px' }}>
                      🎉 URSPANTROPIKO: ACQUAINTANCE PARTY &amp; GENERAL ASSEMBLY 2026
                    </h2>
                    <p style={{ margin: '2px 0 0 0', fontSize: '0.78rem', color: '#E2E8F0', fontWeight: '600' }}>
                      "ONE ISLAND, ONE CAMPUS, ONE IDENTITY — RED HAWKS SOARING IN UNITY" • 📅 Sept 17-18, 2026
                    </p>
                  </div>
                  <img 
                    src="/urs_logo.png" 
                    alt="URS University Main Seal" 
                    style={{
                      width: '60px',
                      height: '60px',
                      borderRadius: '50%',
                      border: '2.5px solid #38BDF8',
                      background: '#FFF',
                      objectFit: 'contain',
                      boxShadow: '0 0 15px rgba(56, 189, 248, 0.65)',
                      flexShrink: 0
                    }}
                  />
                </div>

                {/* SITREP Strip */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px', marginBottom: '10px' }}>
                  <div style={{ background: '#0F172A', color: '#FFF', padding: '8px', borderRadius: '6px', textAlign: 'center' }}>
                    <div style={{ fontSize: '0.68rem', color: '#94A3B8', fontWeight: 'bold' }}>TOTAL STUDENTS</div>
                    <div style={{ fontSize: '1.15rem', fontWeight: '900', color: '#38BDF8' }}>{filtered.length}</div>
                  </div>
                  <div style={{ background: '#D1FAE5', color: '#065F46', padding: '8px', borderRadius: '6px', textAlign: 'center', border: '1px solid #A7F3D0' }}>
                    <div style={{ fontSize: '0.68rem', fontWeight: 'bold' }}>PAID &amp; VERIFIED</div>
                    <div style={{ fontSize: '1.15rem', fontWeight: '900' }}>{filtered.filter(i => i.payment_status === 'paid').length}</div>
                  </div>
                  <div style={{ background: '#FEF3C7', color: '#92400E', padding: '8px', borderRadius: '6px', textAlign: 'center', border: '1px solid #FDE68A' }}>
                    <div style={{ fontSize: '0.68rem', fontWeight: 'bold' }}>DAY 1 ADMITTED</div>
                    <div style={{ fontSize: '1.15rem', fontWeight: '900' }}>{filtered.filter(i => i.day1_status === 'attended').length}</div>
                  </div>
                  <div style={{ background: '#EDE9FE', color: '#5B21B6', padding: '8px', borderRadius: '6px', textAlign: 'center', border: '1px solid #DDD6FE' }}>
                    <div style={{ fontSize: '0.68rem', fontWeight: 'bold' }}>DAY 2 ADMITTED</div>
                    <div style={{ fontSize: '1.15rem', fontWeight: '900' }}>{filtered.filter(i => i.day2_status === 'attended').length}</div>
                  </div>
                </div>

                {/* Spreadsheet Table Preview */}
                <div style={{ overflowX: 'auto', border: '1px solid #CBD5E1', borderRadius: '6px' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.74rem', textAlign: 'left' }}>
                    <thead>
                      <tr style={{ background: '#0F172A', color: '#FFFFFF' }}>
                        <th style={{ padding: '6px 4px', textAlign: 'center', width: '30px' }}>#</th>
                        <th style={{ padding: '6px' }}>Ticket Ref</th>
                        <th style={{ padding: '6px' }}>Student ID</th>
                        <th style={{ padding: '6px' }}>Student Name</th>
                        <th style={{ padding: '6px' }}>College Department</th>
                        <th style={{ padding: '6px', textAlign: 'center' }}>Section</th>
                        <th style={{ padding: '6px', textAlign: 'center' }}>Year</th>
                        <th style={{ padding: '6px', textAlign: 'center' }}>Payment</th>
                        <th style={{ padding: '6px', textAlign: 'center' }}>Day 1 (Sept 17)</th>
                        <th style={{ padding: '6px', textAlign: 'center' }}>Day 2 (Sept 18)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filtered.slice(0, 15).map((d, idx) => {
                        const theme = getCollegeTheme(d.department);
                        const isPaid = d.payment_status === 'paid';
                        const isDay1 = d.day1_status === 'attended';
                        const isDay2 = d.day2_status === 'attended';

                        return (
                          <tr key={d.ticket_code} style={{ background: theme.rowBg, borderBottom: '1px solid #E2E8F0' }}>
                            <td style={{ padding: '4px', textAlign: 'center', color: '#64748B', fontWeight: 'bold' }}>{idx + 1}</td>
                            <td style={{ padding: '4px 6px', fontWeight: 'bold', fontFamily: 'monospace' }}>{d.ticket_code}</td>
                            <td style={{ padding: '4px 6px', fontFamily: 'monospace' }}>{d.student_id}</td>
                            <td style={{ padding: '4px 6px', fontWeight: 'bold', color: '#0F172A' }}>{d.full_name}</td>
                            <td style={{ padding: '4px 6px' }}>
                              <span style={{ background: theme.badgeBg, color: theme.badgeText, padding: '1px 6px', borderRadius: '4px', fontWeight: 'bold', fontSize: '0.68rem', border: `1px solid ${theme.badgeBorder}` }}>
                                {theme.short} • {theme.name}
                              </span>
                            </td>
                            <td style={{ padding: '4px', textAlign: 'center', fontWeight: 'bold' }}>{d.program_section}</td>
                            <td style={{ padding: '4px', textAlign: 'center' }}>{d.year_level || '1st Year'}</td>
                            <td style={{ padding: '4px', textAlign: 'center' }}>
                              <span style={{ background: isPaid ? '#D1FAE5' : '#FEE2E2', color: isPaid ? '#065F46' : '#991B1B', padding: '1px 6px', borderRadius: '4px', fontWeight: 'bold', fontSize: '0.68rem' }}>
                                {isPaid ? '💳 PAID' : '⏳ UNPAID'}
                              </span>
                            </td>
                            <td style={{ padding: '4px', textAlign: 'center' }}>
                              <span style={{ background: isDay1 ? '#DCFCE7' : '#F1F5F9', color: isDay1 ? '#15803D' : '#64748B', padding: '1px 6px', borderRadius: '4px', fontWeight: 'bold', fontSize: '0.68rem' }}>
                                {isDay1 ? `✅ IN (${d.day1_time || '08:14 AM'})` : '❌ NOT IN'}
                              </span>
                            </td>
                            <td style={{ padding: '4px', textAlign: 'center' }}>
                              <span style={{ background: isDay2 ? '#EDE9FE' : '#F1F5F9', color: isDay2 ? '#5B21B6' : '#64748B', padding: '1px 6px', borderRadius: '4px', fontWeight: 'bold', fontSize: '0.68rem' }}>
                                {isDay2 ? `✅ IN (${d.day2_time || '08:45 PM'})` : '❌ NOT IN'}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                  {filtered.length > 15 && (
                    <div style={{ padding: '8px', textAlign: 'center', background: '#F8FAFC', color: '#64748B', fontSize: '0.75rem', fontStyle: 'italic' }}>
                      Showing preview of top 15 records. Download Excel (.xls) to view all {filtered.length} attendees with full formatting.
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: STUDENT REGISTRATION QR */}
      {showStudentQRModal && (
        <div className="modal-backdrop" onClick={() => setShowStudentQRModal(false)}>
          <div className="modal-card" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>📄 Public Student Registration QR</h3>
              <motion.button
                className="btn-close"
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => setShowStudentQRModal(false)}
              >
                ✕
              </motion.button>
            </div>
            <div className="modal-body text-center">
              <p className="text-xs text-muted mb-3">Project this QR on screens or print for students to scan and register.</p>
              <div className="qr-box-large">
                <QRCode value={studentRegisterUrl} size={220} level="H" />
              </div>
              <div className="modal-link-box">
                <div className="font-mono text-xs text-green break-all">{studentRegisterUrl}</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 3: MASTER USHER QR */}
      {showUsherQRModal && (
        <div className="modal-backdrop" onClick={() => setShowUsherQRModal(false)}>
          <div className="modal-card" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>🛡️ Master Usher Scanner Access QR</h3>
              <motion.button
                className="btn-close"
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => setShowUsherQRModal(false)}
              >
                ✕
              </motion.button>
            </div>
            <div className="modal-body text-center">
              <p className="text-xs text-muted mb-3">Have entrance marshals scan this single QR with their phone camera to unlock the gate scanner.</p>
              <div className="qr-box-large">
                <QRCode value={masterUsherUrl} size={220} level="H" />
              </div>
              <div className="modal-link-box">
                <div className="font-mono text-xs text-blue break-all">{masterUsherUrl}</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 4: DELETE ATTENDEE CONFIRMATION MODAL */}
      {attendeeToDelete && (
        <div className="modal-backdrop" onClick={() => setAttendeeToDelete(null)}>
          <motion.div
            className="modal-card"
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            onClick={e => e.stopPropagation()}
            style={{ maxWidth: '440px', border: '1.5px solid rgba(230, 57, 70, 0.5)' }}
          >
            <div className="modal-header" style={{ background: 'rgba(230, 57, 70, 0.12)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '1.3rem' }}>🗑️</span>
                <h3 style={{ color: '#FF8A8A', margin: 0 }}>Confirm Removal</h3>
              </div>
              <button className="btn-close" onClick={() => setAttendeeToDelete(null)}>✕</button>
            </div>

            <div className="modal-body">
              <p style={{ fontSize: '0.9rem', color: '#E2E8F0', lineHeight: '1.5', marginBottom: '14px' }}>
                Are you sure you want to permanently delete this attendee record from the masterlist?
              </p>

              <div style={{
                background: 'rgba(0, 0, 0, 0.45)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                borderRadius: '8px',
                padding: '12px 16px',
                marginBottom: '16px'
              }}>
                <div style={{ fontWeight: '800', color: '#FFF', fontSize: '1rem' }}>{attendeeToDelete.full_name}</div>
                <div style={{ fontSize: '0.8rem', color: '#94A3B8', fontFamily: 'monospace', marginTop: '2px' }}>
                  ID: {attendeeToDelete.student_id} &bull; Ref: {attendeeToDelete.ticket_code}
                </div>
                <div style={{ fontSize: '0.78rem', color: '#CBD5E1', marginTop: '4px' }}>
                  {attendeeToDelete.program_section} &bull; {attendeeToDelete.department}
                </div>
              </div>

              <div style={{ display: 'flex', gap: '10px' }}>
                <button
                  className="btn-action btn-undo"
                  style={{ flex: 1, padding: '10px' }}
                  onClick={() => setAttendeeToDelete(null)}
                >
                  Cancel
                </button>
                <motion.button
                  className="btn-danger-confirm"
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  style={{ flex: 1, padding: '10px' }}
                  onClick={() => {
                    if (onDeleteAttendee) {
                      onDeleteAttendee(attendeeToDelete.ticket_code);
                    }
                    setAttendeeToDelete(null);
                  }}
                >
                  🗑️ Yes, Delete
                </motion.button>
              </div>
            </div>
          </motion.div>
        </div>
      )}

      {/* Official Footer with Watermark & Dual Logos */}
      <footer style={{
        marginTop: '32px',
        padding: '18px 24px',
        background: 'var(--card-bg)',
        backdropFilter: 'blur(20px)',
        border: '1px solid var(--card-border)',
        borderRadius: '16px',
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '16px',
        boxShadow: '0 10px 30px rgba(0,0,0,0.4)'
      }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <div style={{ fontSize: '0.85rem', fontWeight: '800', color: '#FFFFFF', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span>⚡ Powered by:</span>
            <span style={{ color: '#FFD100' }}>Supreme Student Government (SSG) • URS Pililla Campus</span>
          </div>
          <div style={{ fontSize: '0.78rem', color: '#94A3B8', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span>💻 System &amp; UI Architecture by:</span>
            <a 
              href="https://instagram.com/noir_et_blancc66" 
              target="_blank" 
              rel="noreferrer"
              style={{ 
                color: '#E0F2FE', 
                fontWeight: '700', 
                textDecoration: 'none',
                background: 'linear-gradient(135deg, rgba(225, 48, 108, 0.2), rgba(131, 58, 180, 0.2))',
                padding: '3px 10px',
                borderRadius: '8px',
                border: '1px solid rgba(225, 48, 108, 0.4)',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                boxShadow: '0 2px 8px rgba(225, 48, 108, 0.25)'
              }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ flexShrink: 0 }}>
                <rect x="2" y="2" width="20" height="20" rx="5" stroke="url(#ig-grad-admin)" strokeWidth="2.2" />
                <circle cx="12" cy="12" r="4.5" stroke="url(#ig-grad-admin)" strokeWidth="2.2" />
                <circle cx="17.5" cy="6.5" r="1.2" fill="url(#ig-grad-admin)" />
                <defs>
                  <linearGradient id="ig-grad-admin" x1="2" y1="22" x2="22" y2="2" gradientUnits="userSpaceOnUse">
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

        {/* Dual Logos on Right Side */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div style={{ textAlign: 'right', fontSize: '0.72rem', color: '#94A3B8', fontWeight: '600' }}>
            <div>URSP SSG &bull; URS Main</div>
            <div style={{ color: '#FFD100' }}>Official Ticketing Suite</div>
          </div>
          <img 
            src="/logo.png" 
            alt="URSP SSG Seal" 
            style={{
              width: '46px',
              height: '46px',
              borderRadius: '50%',
              border: '2px solid #FFD100',
              background: '#FFF',
              objectFit: 'contain',
              boxShadow: '0 0 12px rgba(255, 209, 0, 0.6)'
            }}
          />
          <img 
            src="/urs_logo.png" 
            alt="URS University Main Seal" 
            style={{
              width: '46px',
              height: '46px',
              borderRadius: '50%',
              border: '2px solid #38BDF8',
              background: '#FFF',
              objectFit: 'contain',
              boxShadow: '0 0 12px rgba(56, 189, 248, 0.6)'
            }}
          />
        </div>
      </footer>
    </motion.div>
  );
}