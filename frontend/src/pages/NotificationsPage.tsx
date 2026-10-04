import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Bell,
  CheckCheck,
  Trash2,
  Upload,
  FileText,
  CheckSquare,
  Brain,
  BarChart3,
  Mic,
  Info,
  CheckCircle2,
  Clock,
} from 'lucide-react';
import { SidebarLayout } from '../components/SidebarLayout';
import { authApi } from '../api/auth';
import { notificationService, type NotificationItem } from '../services/notificationService';

export const NotificationsPage: React.FC = () => {
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [activeFilter, setActiveFilter] = useState<'ALL' | 'UNREAD'>('ALL');
  const [userId, setUserId] = useState<string>('');

  const loadNotifications = () => {
    const user = authApi.getCurrentUser();
    if (!user) return;
    const uid = user.id || user._id || '';
    setUserId(uid);
    const list = notificationService.getNotifications(uid);
    setNotifications(list);
  };

  useEffect(() => {
    const user = authApi.getCurrentUser();
    const token = authApi.getToken();
    if (!user || !token) {
      navigate('/');
      return;
    }
    loadNotifications();

    const handleUpdate = () => {
      loadNotifications();
    };
    window.addEventListener('meetmind_notification_update', handleUpdate);
    return () => {
      window.removeEventListener('meetmind_notification_update', handleUpdate);
    };
  }, [navigate]);

  const handleMarkAsRead = (id: string) => {
    if (!userId) return;
    notificationService.markAsRead(userId, id);
    loadNotifications();
  };

  const handleMarkAllAsRead = () => {
    if (!userId) return;
    notificationService.markAllAsRead(userId);
    loadNotifications();
  };

  const handleClearAll = () => {
    if (!userId) return;
    notificationService.clearNotifications(userId);
    loadNotifications();
  };

  const filtered = notifications.filter((n) => {
    if (activeFilter === 'UNREAD') return !n.read;
    return true;
  });

  const unreadCount = notifications.filter((n) => !n.read).length;

  const getTypeIcon = (type: NotificationItem['type']) => {
    switch (type) {
      case 'upload':
        return <Upload size={18} color="#6366F1" />;
      case 'transcript':
        return <Mic size={18} color="#8B5CF6" />;
      case 'summary':
        return <FileText size={18} color="#10B981" />;
      case 'action_items':
        return <CheckSquare size={18} color="#F59E0B" />;
      case 'classification':
        return <Brain size={18} color="#EC4899" />;
      case 'report':
        return <BarChart3 size={18} color="#3B82F6" />;
      default:
        return <Info size={18} color="#6366F1" />;
    }
  };

  const getTypeBadgeStyle = (type: NotificationItem['type']) => {
    switch (type) {
      case 'upload':
        return { bg: '#EEF2FF', color: '#4F46E5', label: 'Upload' };
      case 'transcript':
        return { bg: '#F5F3FF', color: '#7C3AED', label: 'Speech Recognition' };
      case 'summary':
        return { bg: '#ECFDF5', color: '#059669', label: 'Smart Summary' };
      case 'action_items':
        return { bg: '#FFFBEB', color: '#D97706', label: 'Action Items' };
      case 'classification':
        return { bg: '#FDF2F8', color: '#DB2777', label: 'Intelligence' };
      case 'report':
        return { bg: '#EFF6FF', color: '#2563EB', label: 'Report' };
      default:
        return { bg: '#F1F5F9', color: '#475569', label: 'System' };
    }
  };

  const formatTimestamp = (ts: string) => {
    if (!ts) return 'Just now';
    try {
      const date = new Date(ts);
      const now = new Date();
      const diffMs = now.getTime() - date.getTime();
      const diffMins = Math.floor(diffMs / (1000 * 60));
      if (diffMins < 1) return 'Just now';
      if (diffMins < 60) return `${diffMins}m ago`;
      const diffHours = Math.floor(diffMins / 60);
      if (diffHours < 24) return `${diffHours}h ago`;
      return date.toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
    } catch {
      return 'Recently';
    }
  };

  return (
    <SidebarLayout>
      <div style={styles.container}>
        {/* Header Row */}
        <div style={styles.headerRow}>
          <div>
            <div style={styles.badgePill}>
              <Bell size={14} color="#6366F1" style={{ marginRight: '6px' }} />
              <span>Activity Center</span>
            </div>
            <h1 style={styles.pageTitle}>Notifications & Activity</h1>
            <p style={styles.pageSubtitle}>
              Stay informed on all meeting uploads, speech transcriptions, summaries, and generated reports.
            </p>
          </div>

          <div style={styles.headerActions}>
            <button
              onClick={handleMarkAllAsRead}
              disabled={unreadCount === 0}
              style={{
                ...styles.actionBtnSecondary,
                opacity: unreadCount === 0 ? 0.5 : 1,
                cursor: unreadCount === 0 ? 'not-allowed' : 'pointer',
              }}
              title="Mark all as read"
              id="mark-all-read-btn"
            >
              <CheckCheck size={16} style={{ marginRight: '6px' }} />
              <span>Mark All as Read</span>
            </button>
            <button
              onClick={handleClearAll}
              disabled={notifications.length === 0}
              style={{
                ...styles.actionBtnDanger,
                opacity: notifications.length === 0 ? 0.5 : 1,
                cursor: notifications.length === 0 ? 'not-allowed' : 'pointer',
              }}
              title="Clear all notifications"
              id="clear-all-notifications-btn"
            >
              <Trash2 size={16} style={{ marginRight: '6px' }} />
              <span>Clear Notifications</span>
            </button>
          </div>
        </div>

        {/* Filter Controls Row */}
        <div style={styles.filterRow}>
          <div style={styles.tabsWrap}>
            <button
              onClick={() => setActiveFilter('ALL')}
              style={{
                ...styles.filterTab,
                ...(activeFilter === 'ALL' ? styles.filterTabActive : {}),
              }}
              id="filter-all-notifications"
            >
              <span>All Activity</span>
              <span style={styles.tabBadge}>{notifications.length}</span>
            </button>
            <button
              onClick={() => setActiveFilter('UNREAD')}
              style={{
                ...styles.filterTab,
                ...(activeFilter === 'UNREAD' ? styles.filterTabActive : {}),
              }}
              id="filter-unread-notifications"
            >
              <span>Unread</span>
              {unreadCount > 0 && (
                <span style={{ ...styles.tabBadge, background: '#6366F1', color: '#FFFFFF' }}>
                  {unreadCount}
                </span>
              )}
            </button>
          </div>
        </div>

        {/* Notifications List */}
        {filtered.length === 0 ? (
          <div style={styles.emptyContainer}>
            <div style={styles.emptyIconCircle}>
              <Bell size={36} color="#94A3B8" />
            </div>
            <h3 style={styles.emptyTitle}>No notifications available.</h3>
            <p style={styles.emptySubtitle}>
              You're all caught up! New updates, summaries, and meeting processing notices will appear here.
            </p>
            <button onClick={() => navigate('/upload')} style={styles.emptyActionBtn}>
              <Upload size={16} style={{ marginRight: '8px' }} />
              <span>Upload New Meeting</span>
            </button>
          </div>
        ) : (
          <div style={styles.notificationList}>
            {filtered.map((item) => {
              const badge = getTypeBadgeStyle(item.type);
              return (
                <div
                  key={item.id}
                  style={{
                    ...styles.notificationCard,
                    ...(item.read ? styles.notificationCardRead : styles.notificationCardUnread),
                  }}
                  onClick={() => !item.read && handleMarkAsRead(item.id)}
                >
                  {/* Status Indicator Dot */}
                  <div style={styles.indicatorCol}>
                    <div
                      style={{
                        ...styles.unreadDot,
                        background: item.read ? '#CBD5E1' : '#6366F1',
                      }}
                    />
                  </div>

                  {/* Icon */}
                  <div style={{ ...styles.iconCircle, background: badge.bg }}>
                    {getTypeIcon(item.type)}
                  </div>

                  {/* Content */}
                  <div style={styles.contentCol}>
                    <div style={styles.cardHeaderLine}>
                      <span style={{ ...styles.typeBadge, background: badge.bg, color: badge.color }}>
                        {badge.label}
                      </span>
                      <span style={styles.timestampText}>
                        <Clock size={12} style={{ marginRight: '4px' }} />
                        {formatTimestamp(item.timestamp)}
                      </span>
                    </div>
                    <h4 style={styles.notifTitle}>{item.title}</h4>
                    <p style={styles.notifMessage}>{item.message}</p>
                  </div>

                  {/* Quick Action */}
                  <div style={styles.actionCol}>
                    {!item.read && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleMarkAsRead(item.id);
                        }}
                        style={styles.markReadBtn}
                        title="Mark as read"
                      >
                        <CheckCircle2 size={16} color="#6366F1" />
                        <span>Mark read</span>
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </SidebarLayout>
  );
};

const styles: { [key: string]: React.CSSProperties } = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    gap: '24px',
  },
  headerRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    flexWrap: 'wrap',
    gap: '16px',
  },
  badgePill: {
    display: 'inline-flex',
    alignItems: 'center',
    background: '#EEF2FF',
    color: '#4F46E5',
    fontSize: '0.78rem',
    fontWeight: 700,
    padding: '4px 12px',
    borderRadius: '20px',
    marginBottom: '8px',
  },
  pageTitle: {
    fontSize: '2rem',
    fontWeight: 800,
    color: '#0F172A',
    margin: 0,
    letterSpacing: '-0.025em',
  },
  pageSubtitle: {
    fontSize: '0.98rem',
    color: '#475569',
    margin: '6px 0 0 0',
  },
  headerActions: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    flexWrap: 'wrap',
  },
  actionBtnSecondary: {
    display: 'inline-flex',
    alignItems: 'center',
    padding: '10px 16px',
    background: '#FFFFFF',
    border: '1px solid #CBD5E1',
    borderRadius: '12px',
    color: '#334155',
    fontWeight: 600,
    fontSize: '0.86rem',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
  },
  actionBtnDanger: {
    display: 'inline-flex',
    alignItems: 'center',
    padding: '10px 16px',
    background: '#FEF2F2',
    border: '1px solid #FECACA',
    borderRadius: '12px',
    color: '#DC2626',
    fontWeight: 600,
    fontSize: '0.86rem',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
  },
  filterRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottom: '1px solid #E2E8F0',
    paddingBottom: '14px',
  },
  tabsWrap: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  filterTab: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '8px',
    padding: '8px 16px',
    background: '#F8FAFC',
    border: '1px solid #E2E8F0',
    borderRadius: '20px',
    color: '#64748B',
    fontSize: '0.86rem',
    fontWeight: 600,
    cursor: 'pointer',
    transition: 'all 0.2s ease',
  },
  filterTabActive: {
    background: '#6366F1',
    borderColor: '#6366F1',
    color: '#FFFFFF',
  },
  tabBadge: {
    padding: '2px 8px',
    borderRadius: '10px',
    background: '#E2E8F0',
    color: '#475569',
    fontSize: '0.74rem',
    fontWeight: 700,
  },
  notificationList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
  },
  notificationCard: {
    display: 'flex',
    alignItems: 'center',
    gap: '16px',
    padding: '18px 20px',
    borderRadius: '16px',
    border: '1px solid #E2E8F0',
    background: '#FFFFFF',
    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.02)',
    transition: 'all 0.2s ease',
    cursor: 'pointer',
  },
  notificationCardUnread: {
    background: '#FAFAFF',
    borderColor: '#C7D2FE',
    borderLeftWidth: '4px',
    borderLeftColor: '#6366F1',
  },
  notificationCardRead: {
    background: '#FFFFFF',
    borderColor: '#E2E8F0',
  },
  indicatorCol: {
    display: 'flex',
    alignItems: 'center',
  },
  unreadDot: {
    width: '8px',
    height: '8px',
    borderRadius: '50%',
  },
  iconCircle: {
    width: '42px',
    height: '42px',
    borderRadius: '12px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  contentCol: {
    flex: 1,
  },
  cardHeaderLine: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    marginBottom: '4px',
  },
  typeBadge: {
    padding: '2px 8px',
    borderRadius: '6px',
    fontSize: '0.72rem',
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: '0.04em',
  },
  timestampText: {
    display: 'inline-flex',
    alignItems: 'center',
    fontSize: '0.76rem',
    color: '#94A3B8',
    fontWeight: 500,
  },
  notifTitle: {
    fontSize: '0.98rem',
    fontWeight: 700,
    color: '#0F172A',
    margin: '0 0 3px 0',
  },
  notifMessage: {
    fontSize: '0.88rem',
    color: '#475569',
    margin: 0,
    lineHeight: 1.5,
  },
  actionCol: {
    flexShrink: 0,
  },
  markReadBtn: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px',
    padding: '6px 12px',
    background: '#EEF2FF',
    border: '1px solid #C7D2FE',
    borderRadius: '8px',
    color: '#4F46E5',
    fontSize: '0.8rem',
    fontWeight: 600,
    cursor: 'pointer',
  },
  emptyContainer: {
    background: '#FFFFFF',
    border: '1px solid #E2E8F0',
    borderRadius: '24px',
    padding: '60px 24px',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    textAlign: 'center',
    boxShadow: '0 4px 14px rgba(0, 0, 0, 0.02)',
  },
  emptyIconCircle: {
    width: '72px',
    height: '72px',
    borderRadius: '50%',
    background: '#F1F5F9',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: '16px',
  },
  emptyTitle: {
    fontSize: '1.25rem',
    fontWeight: 700,
    color: '#1E293B',
    marginBottom: '8px',
  },
  emptySubtitle: {
    fontSize: '0.92rem',
    color: '#64748B',
    maxWidth: '440px',
    marginBottom: '24px',
    lineHeight: 1.5,
  },
  emptyActionBtn: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '8px',
    padding: '12px 24px',
    background: 'linear-gradient(135deg, #6366F1, #8B5CF6)',
    color: '#FFFFFF',
    border: 'none',
    borderRadius: '12px',
    fontWeight: 600,
    fontSize: '0.92rem',
    cursor: 'pointer',
  },
};
