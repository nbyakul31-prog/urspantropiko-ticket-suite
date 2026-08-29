import React, { useState, useEffect, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const LOG_CATEGORIES = [
  { id: 'all', label: 'All', icon: '📬', color: '#E2E8F0' },
  { id: 'registration', label: 'Registrations', icon: '🎉', color: '#34D399' },
  { id: 'payment', label: 'Payments', icon: '💳', color: '#FBBF24' },
  { id: 'admission', label: 'Admissions', icon: '⚡', color: '#38BDF8' },
  { id: 'deletion', label: 'Deletions', icon: '🗑️', color: '#F87171' },
  { id: 'system', label: 'System & Lock', icon: '🔒', color: '#A78BFA' }
];

const TYPE_CONFIG = {
  registration: { icon: '🎉', label: 'REGISTRATION', bg: 'rgba(16, 185, 129, 0.15)', border: 'rgba(16, 185, 129, 0.4)', color: '#34D399', accent: '#10B981' },
  payment: { icon: '💳', label: 'PAYMENT', bg: 'rgba(251, 191, 36, 0.15)', border: 'rgba(251, 191, 36, 0.4)', color: '#FBBF24', accent: '#F59E0B' },
  bulk_payment: { icon: '💰', label: 'BULK VERIFY', bg: 'rgba(251, 191, 36, 0.15)', border: 'rgba(251, 191, 36, 0.4)', color: '#FBBF24', accent: '#F59E0B' },
  admission: { icon: '⚡', label: 'GATE ENTRY', bg: 'rgba(56, 189, 248, 0.15)', border: 'rgba(56, 189, 248, 0.4)', color: '#38BDF8', accent: '#0EA5E9' },
  deletion: { icon: '🗑️', label: 'DELETION', bg: 'rgba(248, 113, 113, 0.15)', border: 'rgba(248, 113, 113, 0.4)', color: '#F87171', accent: '#EF4444' },
  system: { icon: '🔧', label: 'SYSTEM', bg: 'rgba(167, 139, 250, 0.15)', border: 'rgba(167, 139, 250, 0.4)', color: '#A78BFA', accent: '#8B5CF6' },
  lock: { icon: '🔒', label: 'SECURITY', bg: 'rgba(167, 139, 250, 0.15)', border: 'rgba(167, 139, 250, 0.4)', color: '#A78BFA', accent: '#8B5CF6' }
};

function getTypeConfig(type) {
  if (type === 'bulk_payment') return TYPE_CONFIG.bulk_payment;
  if (type === 'lock' || type === 'registration_lock') return TYPE_CONFIG.lock;
  if (TYPE_CONFIG[type]) return TYPE_CONFIG[type];
  return TYPE_CONFIG.system;
}

function getFilterCategory(type) {
  if (type === 'bulk_payment') return 'payment';
  if (type === 'lock' || type === 'registration_lock') return 'system';
  if (['registration', 'payment', 'admission', 'deletion'].includes(type)) return type;
  return 'system';
}

function formatLogTime(ts) {
  if (!ts) return '';
  try {
    const date = new Date(ts);
    if (isNaN(date.getTime())) return ts;
    const isToday = new Date().toDateString() === date.toDateString();
    return new Intl.DateTimeFormat('en-US', {
      timeZone: 'Asia/Manila',
      ...(isToday ? {} : { month: 'short', day: 'numeric' }),
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    }).format(date);
  } catch (e) {
    return ts;
  }
}

export default function NotificationsLog({
  activityLog = [],
  totalAttendees = 0,
  onDeleteLogs,
  onClearAllLogs,
  onNavigate
}) {
  const [activeCategory, setActiveCategory] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(25);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [pulseKey, setPulseKey] = useState(0);

  // Pulse when new activity arrives
  useEffect(() => {
    setPulseKey(prev => prev + 1);
  }, [activityLog.length]);

  // Reset to page 1 on filter or search changes
  useEffect(() => {
    setCurrentPage(1);
    setSelectedIds(new Set());
  }, [activeCategory, searchQuery, rowsPerPage]);

  // Filter and search
  const filteredLogs = useMemo(() => {
    return activityLog.filter(log => {
      // Category check
      if (activeCategory !== 'all' && getFilterCategory(log.type) !== activeCategory) {
        return false;
      }
      // Search query check
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const titleMatch = (log.title || '').toLowerCase().includes(q);
        const msgMatch = (log.message || '').toLowerCase().includes(q);
        const actorMatch = (log.actor || '').toLowerCase().includes(q);
        const codeMatch = (log.ticket_code || '').toLowerCase().includes(q);
        const deptMatch = (log.department || '').toLowerCase().includes(q);
        return titleMatch || msgMatch || actorMatch || codeMatch || deptMatch;
      }
      return true;
    });
  }, [activityLog, activeCategory, searchQuery]);

  // Counts by category
  const categoryCounts = useMemo(() => {
    const counts = { all: activityLog.length };
    activityLog.forEach(log => {
      const cat = getFilterCategory(log.type);
      counts[cat] = (counts[cat] || 0) + 1;
    });
    return counts;
  }, [activityLog]);

  // Pagination calculation
  const totalItems = filteredLogs.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / rowsPerPage));
  const startIndex = (currentPage - 1) * rowsPerPage;
  const endIndex = Math.min(startIndex + rowsPerPage, totalItems);
  const currentPageLogs = useMemo(() => {
    return filteredLogs.slice(startIndex, endIndex);
  }, [filteredLogs, startIndex, endIndex]);

  // Select all on current page
  const isAllCurrentPageSelected = currentPageLogs.length > 0 && currentPageLogs.every(l => selectedIds.has(l.id));
  const isSomeSelected = selectedIds.size > 0;

  const toggleSelectAllCurrentPage = () => {
    if (isAllCurrentPageSelected) {
      setSelectedIds(prev => {
        const next = new Set(prev);
        currentPageLogs.forEach(l => next.delete(l.id));
        return next;
      });
    } else {
      setSelectedIds(prev => {
        const next = new Set(prev);
        currentPageLogs.forEach(l => next.add(l.id));
        return next;
      });
    }
  };

  const toggleSelectRow = (id) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // Delete selected
  const handleDeleteSelected = () => {
    if (selectedIds.size === 0) return;
    if (onDeleteLogs) {
      onDeleteLogs(Array.from(selectedIds));
      setSelectedIds(new Set());
    }
  };

  // Delete single row
  const handleDeleteSingle = (id, e) => {
    e.stopPropagation();
    if (onDeleteLogs) {
      onDeleteLogs([id]);
      setSelectedIds(prev => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  };

  // Clear all logs
  const handleConfirmClearAll = () => {
    if (onClearAllLogs) {
      onClearAllLogs();
      setSelectedIds(new Set());
      setShowClearConfirm(false);
    }
  };

  return (
    <motion.div
      className="gmail-notif-container"
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 15 }}
      transition={{ duration: 0.3 }}
    >
      {/* ── Top Overview Header ── */}
      <div className="gmail-header-card">
        <div className="gmail-header-main">
          <div className="gmail-title-group">
            <h1 className="gmail-title">
              <span>📡 Live Activity & Audit Log</span>
            </h1>
            <p className="gmail-subtitle">
              Live chronological feed across all devices • Multi-page Gmail view
            </p>
          </div>

          <div className="gmail-header-badges">
            <motion.span
              className="gmail-live-pill"
              key={pulseKey}
              initial={{ scale: 1.15 }}
              animate={{ scale: 1 }}
              transition={{ duration: 0.2 }}
            >
              <span className="gmail-live-dot" />
              LIVE CLOUD FEED
            </motion.span>
            <span className="gmail-stat-pill">
              📊 <b>{activityLog.length.toLocaleString()}</b> Total Events
            </span>
            <span className="gmail-stat-pill">
              👥 <b>{totalAttendees.toLocaleString()}</b> In Masterlist
            </span>
          </div>
        </div>

        {/* ── Category Filter Pills ── */}
        <div className="gmail-category-bar">
          {LOG_CATEGORIES.map(cat => {
            const count = categoryCounts[cat.id] || 0;
            const isActive = activeCategory === cat.id;
            return (
              <button
                key={cat.id}
                type="button"
                className={`gmail-category-btn ${isActive ? 'active' : ''}`}
                onClick={() => setActiveCategory(cat.id)}
                style={{
                  '--cat-color': cat.color,
                  borderColor: isActive ? cat.color : 'transparent'
                }}
              >
                <span>{cat.icon}</span>
                <span>{cat.label}</span>
                <span className="gmail-category-count">{count.toLocaleString()}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Gmail-Style Main Inbox Frame ── */}
      <div className="gmail-inbox-frame">
        {/* ── Gmail Toolbar ── */}
        <div className="gmail-toolbar">
          {/* Left Toolbar: Master Checkbox & Bulk Actions */}
          <div className="gmail-toolbar-left">
            <label className="gmail-checkbox-wrap" title="Select all on this page">
              <input
                type="checkbox"
                checked={isAllCurrentPageSelected}
                onChange={toggleSelectAllCurrentPage}
                className="gmail-checkbox"
              />
              <span className="gmail-checkbox-custom" />
            </label>

            {isSomeSelected ? (
              <div className="gmail-selection-actions">
                <span className="gmail-selected-count">
                  <b>{selectedIds.size}</b> selected
                </span>
                <button
                  type="button"
                  className="gmail-btn-delete-selected"
                  onClick={handleDeleteSelected}
                  title="Delete selected notifications"
                >
                  🗑️ Delete Selected ({selectedIds.size})
                </button>
                <button
                  type="button"
                  className="gmail-btn-ghost-sm"
                  onClick={() => setSelectedIds(new Set())}
                >
                  Deselect
                </button>
              </div>
            ) : (
              <div className="gmail-toolbar-default-actions">
                <button
                  type="button"
                  className="gmail-btn-toolbar-ghost"
                  onClick={() => setShowClearConfirm(true)}
                  disabled={activityLog.length === 0}
                  title="Clear all logs"
                >
                  🧹 Clear Log History
                </button>
              </div>
            )}
          </div>

          {/* Center Toolbar: Instant Search Bar */}
          <div className="gmail-toolbar-center">
            <div className="gmail-search-box">
              <span className="gmail-search-icon">🔍</span>
              <input
                type="text"
                placeholder="Search name, student ID, ticket code, section, or action..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="gmail-search-input"
              />
              {searchQuery && (
                <button
                  type="button"
                  className="gmail-search-clear"
                  onClick={() => setSearchQuery('')}
                >
                  ✕
                </button>
              )}
            </div>
          </div>

          {/* Right Toolbar: Gmail Pagination Controls (< 1-25 of 1,240 >) */}
          <div className="gmail-toolbar-right">
            <div className="gmail-per-page-select-wrap">
              <span className="gmail-per-page-label">Show:</span>
              <select
                value={rowsPerPage}
                onChange={(e) => setRowsPerPage(Number(e.target.value))}
                className="gmail-per-page-select"
              >
                <option value={25}>25</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
              </select>
            </div>

            <div className="gmail-pagination-info">
              {totalItems > 0 ? (
                <span>
                  <b>{startIndex + 1}–{endIndex}</b> of <b>{totalItems.toLocaleString()}</b>
                </span>
              ) : (
                <span>0 of 0</span>
              )}
            </div>

            <div className="gmail-pagination-btns">
              <button
                type="button"
                className="gmail-page-btn"
                onClick={() => setCurrentPage(1)}
                disabled={currentPage === 1}
                title="First page"
              >
                «
              </button>
              <button
                type="button"
                className="gmail-page-btn"
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                title="Previous page"
              >
                ‹
              </button>
              <span className="gmail-page-indicator">
                {currentPage}/{totalPages}
              </span>
              <button
                type="button"
                className="gmail-page-btn"
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage >= totalPages}
                title="Next page"
              >
                ›
              </button>
              <button
                type="button"
                className="gmail-page-btn"
                onClick={() => setCurrentPage(totalPages)}
                disabled={currentPage >= totalPages}
                title="Last page"
              >
                »
              </button>
            </div>
          </div>
        </div>

        {/* ── Gmail Row-by-Row List ── */}
        <div className="gmail-rows-wrapper">
          {currentPageLogs.length === 0 ? (
            <div className="gmail-empty-box">
              <div className="gmail-empty-icon">📭</div>
              <h3>No Notifications Found</h3>
              <p>
                {searchQuery
                  ? `No logs match "${searchQuery}". Try a different search term.`
                  : activeCategory !== 'all'
                  ? `No ${activeCategory} activity recorded yet.`
                  : 'System activity (student registration, gate scan, payment verification) will appear here live in real-time.'}
              </p>
              {searchQuery && (
                <button
                  type="button"
                  className="gmail-btn-ghost-sm"
                  style={{ marginTop: '12px' }}
                  onClick={() => setSearchQuery('')}
                >
                  Clear Search Filter
                </button>
              )}
            </div>
          ) : (
            <div className="gmail-rows-list">
              {currentPageLogs.map((log) => {
                const config = getTypeConfig(log.type);
                const isSelected = selectedIds.has(log.id);

                return (
                  <div
                    key={log.id}
                    className={`gmail-row ${isSelected ? 'row-selected' : ''}`}
                    onClick={() => toggleSelectRow(log.id)}
                  >
                    {/* Left: Checkbox */}
                    <div className="gmail-row-check" onClick={(e) => e.stopPropagation()}>
                      <label className="gmail-checkbox-wrap">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleSelectRow(log.id)}
                          className="gmail-checkbox"
                        />
                        <span className="gmail-checkbox-custom" />
                      </label>
                    </div>

                    {/* Type Badge */}
                    <div className="gmail-row-badge-cell">
                      <span
                        className="gmail-row-pill"
                        style={{
                          background: config.bg,
                          borderColor: config.border,
                          color: config.color
                        }}
                      >
                        <span className="gmail-pill-icon">{config.icon}</span>
                        <span className="gmail-pill-text">{config.label}</span>
                      </span>
                    </div>

                    {/* Actor Origin */}
                    <div className="gmail-row-actor" title={log.actor}>
                      👤 {log.actor || 'System'}
                    </div>

                    {/* Snippet / Description (Single compact line) */}
                    <div className="gmail-row-body">
                      <span className="gmail-row-title">{log.title}</span>
                      <span className="gmail-row-sep">—</span>
                      <span className="gmail-row-snippet">{log.message}</span>
                    </div>

                    {/* Metadata Chips (Department, Ticket Code) */}
                    <div className="gmail-row-tags">
                      {log.department && (
                        <span className="gmail-tag-chip gmail-tag-dept" title={log.department}>
                          🎓 {log.department.replace('College of ', '')}
                        </span>
                      )}
                      {log.ticket_code && (
                        <span className="gmail-tag-chip gmail-tag-code">
                          🎫 {log.ticket_code}
                        </span>
                      )}
                    </div>

                    {/* Timestamp */}
                    <div className="gmail-row-time">
                      {formatLogTime(log.timestamp)}
                    </div>

                    {/* Hover Actions (Delete single row) */}
                    <div className="gmail-row-hover-actions" onClick={(e) => e.stopPropagation()}>
                      <button
                        type="button"
                        className="gmail-row-del-btn"
                        onClick={(e) => handleDeleteSingle(log.id, e)}
                        title="Delete notification"
                      >
                        ✕
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* ── Gmail Bottom Status & Pagination Footer ── */}
        <div className="gmail-bottom-footer">
          <div className="gmail-footer-meta">
            <span>⚡ Ultra-low DOM footprint (Page {currentPage} of {totalPages})</span>
            <span>•</span>
            <span>🔄 Real-time Cloud Sync Active (4s poll)</span>
            <span>•</span>
            <span>📱 Responsive Mobile & Desktop</span>
          </div>

          <div className="gmail-footer-pagination">
            <button
              type="button"
              className="gmail-page-btn-text"
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage === 1}
            >
              ← Previous
            </button>
            <span className="gmail-page-indicator">
              Page {currentPage} of {totalPages}
            </span>
            <button
              type="button"
              className="gmail-page-btn-text"
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              disabled={currentPage >= totalPages}
            >
              Next →
            </button>
          </div>
        </div>
      </div>

      {/* ── Clear All Confirmation Modal ── */}
      {showClearConfirm && (
        <div className="modal-security-overlay" onClick={() => setShowClearConfirm(false)}>
          <div className="modal-security-box" style={{ maxWidth: '420px' }} onClick={(e) => e.stopPropagation()}>
            <div style={{ fontSize: '36px', marginBottom: '8px' }}>🧹</div>
            <h3 className="security-modal-title">Clear All Notification Logs?</h3>
            <p className="security-modal-desc">
              This will wipe all <b>{activityLog.length.toLocaleString()}</b> activity log entries from this device and the live Vercel API. This action cannot be undone.
            </p>
            <div style={{ display: 'flex', gap: '8px', marginTop: '16px' }}>
              <button
                type="button"
                className="btn-security-cancel"
                onClick={() => setShowClearConfirm(false)}
                style={{ flex: 1 }}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn-security-submit"
                onClick={handleConfirmClearAll}
                style={{ flex: 1, background: '#EF4444', color: '#FFF' }}
              >
                Yes, Wipe Logs
              </button>
            </div>
          </div>
        </div>
      )}
    </motion.div>
  );
}
