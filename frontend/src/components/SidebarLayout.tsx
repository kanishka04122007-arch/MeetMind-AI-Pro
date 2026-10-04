import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  Home,
  Upload,
  FileText,
  CheckSquare,
  Brain,
  BarChart3,
  Clock,
  Settings,
  LogOut,
  X,
  Bell,
  User
} from 'lucide-react';
import { Logo } from './Logo';
import { authApi, type User as UserType } from '../api/auth';
import { notificationService } from '../services/notificationService';

interface SidebarLayoutProps {
  children: React.ReactNode;
}

interface MenuItem {
  name: string;
  route: string;
  icon: React.FC<{ size?: number; color?: string; style?: React.CSSProperties }>;
  description: string;
  badge?: boolean;
}

const MENU_ITEMS: MenuItem[] = [
  {
    name: 'Dashboard',
    route: '/dashboard',
    icon: Home,
    description: 'Overview of uploaded meetings',
  },
  {
    name: 'Upload & Transcript',
    route: '/upload',
    icon: Upload,
    description: 'Upload PDF or Audio and generate transcript',
  },
  {
    name: 'AI Summary',
    route: '/summary',
    icon: FileText,
    description: 'Generate AI-powered meeting summaries',
  },
  {
    name: 'Action Items',
    route: '/action-items',
    icon: CheckSquare,
    description: 'Generate actionable tasks from meetings',
  },
  {
    name: 'Meeting Classification',
    route: '/classification',
    icon: Brain,
    description: 'Classify meeting category using smart AI',
  },
  {
    name: 'Reports',
    route: '/reports',
    icon: BarChart3,
    description: 'View final meeting reports',
  },
  {
    name: 'History',
    route: '/history',
    icon: Clock,
    description: 'View previously processed meetings',
  },
  {
    name: 'Notifications',
    route: '/notifications',
    icon: Bell,
    description: 'Live alerts and activity stream',
    badge: true,
  },
  {
    name: 'Profile & Analytics',
    route: '/profile',
    icon: User,
    description: 'Personal user dashboard & metrics',
  },
];

export const SidebarLayout: React.FC<SidebarLayoutProps> = ({ children }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [currentUser, setCurrentUser] = useState<UserType | null>(null);
  const [showSettingsModal, setShowSettingsModal] = useState<boolean>(false);
  const [unreadCount, setUnreadCount] = useState<number>(0);

  useEffect(() => {
    const user = authApi.getCurrentUser();
    const token = authApi.getToken();

    if (!user || !token) {
      navigate('/');
      return;
    }
    setCurrentUser(user);

    const updateCount = () => {
      if (user?.id) {
        setUnreadCount(notificationService.getUnreadCount(user.id));
      }
    };

    updateCount();
    window.addEventListener('meetmind_notification_update', updateCount);
    window.addEventListener('storage', updateCount);

    return () => {
      window.removeEventListener('meetmind_notification_update', updateCount);
      window.removeEventListener('storage', updateCount);
    };
  }, [navigate]);

  const handleLogout = () => {
    authApi.logout();
    navigate('/');
  };

  const currentPath = location.pathname;

  return (
    <div style={styles.layoutContainer}>
      {/* ================= FIXED LEFT SIDEBAR (260px) ================= */}
      <aside style={styles.sidebar}>
        {/* Sidebar Header */}
        <div style={styles.sidebarHeader}>
          <Logo size="sm" showSubtitle={false} />
          <div style={styles.headerTextWrap}>
            <span style={styles.brandTitle}>MeetMind AI</span>
            <span style={styles.brandSubtitle}>Smart Meeting Intelligence</span>
          </div>
        </div>

        {/* Navigation Menu */}
        <nav style={styles.navMenu}>
          <div style={styles.menuLabel}>WORKFLOW & NAVIGATION</div>
          {MENU_ITEMS.map((item) => {
            const IconComponent = item.icon;
            const isActive = currentPath === item.route;

            return (
              <button
                key={item.route}
                onClick={() => navigate(item.route)}
                style={{
                  ...styles.menuItemBtn,
                  ...(isActive ? styles.activeMenuItem : styles.inactiveMenuItem),
                }}
                title={item.description}
                id={`sidebar-nav-${item.route.replace('/', '') || 'root'}`}
              >
                <div
                  style={{
                    ...styles.iconWrap,
                    ...(isActive ? styles.activeIconWrap : styles.inactiveIconWrap),
                    position: 'relative',
                  }}
                >
                  <IconComponent
                    size={18}
                    color={isActive ? '#FFFFFF' : '#64748B'}
                  />
                  {item.badge && unreadCount > 0 && (
                    <span
                      style={{
                        position: 'absolute',
                        top: -3,
                        right: -3,
                        width: '10px',
                        height: '10px',
                        borderRadius: '50%',
                        backgroundColor: '#EF4444',
                        border: '2px solid #FFFFFF',
                      }}
                    />
                  )}
                </div>
                <div style={styles.menuItemTextWrap}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
                    <span
                      style={{
                        ...styles.menuItemName,
                        color: isActive ? '#4F46E5' : '#334155',
                        fontWeight: isActive ? 700 : 500,
                      }}
                    >
                      {item.name}
                    </span>
                    {item.badge && unreadCount > 0 && (
                      <span
                        style={{
                          background: isActive ? '#4F46E5' : '#EF4444',
                          color: '#FFFFFF',
                          fontSize: '0.68rem',
                          fontWeight: 700,
                          padding: '1px 6px',
                          borderRadius: '10px',
                          marginLeft: '6px',
                        }}
                      >
                        {unreadCount > 99 ? '99+' : unreadCount}
                      </span>
                    )}
                  </div>
                  <span style={styles.menuItemDesc}>{item.description}</span>
                </div>
              </button>
            );
          })}
        </nav>

        {/* Sidebar Bottom Profile & Quick Actions */}
        <div style={styles.sidebarFooter}>
          {currentUser && (
            <div
              style={{ ...styles.userProfileCard, cursor: 'pointer' }}
              onClick={() => navigate('/profile')}
              title="View Profile & Analytics"
            >
              <div style={styles.avatarCircle}>
                {(currentUser.name || currentUser.email || 'U').charAt(0).toUpperCase()}
              </div>
              <div style={styles.userMeta}>
                <span style={styles.userName}>{currentUser.name || 'Executive User'}</span>
                <span style={styles.userEmail}>{currentUser.email}</span>
              </div>
            </div>
          )}

          <div style={styles.footerActionRow}>
            <button
              onClick={() => setShowSettingsModal(true)}
              style={styles.footerBtn}
              title="Application Settings"
            >
              <Settings size={15} style={{ marginRight: '6px' }} />
              <span>Settings</span>
            </button>
            <button
              onClick={handleLogout}
              style={{ ...styles.footerBtn, color: '#DC2626' }}
              title="Sign Out"
            >
              <LogOut size={15} style={{ marginRight: '6px' }} />
              <span>Logout</span>
            </button>
          </div>
        </div>
      </aside>

      {/* ================= MAIN CONTENT AREA ================= */}
      <div style={styles.mainWrapper}>
        <div style={styles.mainContentInner}>{children}</div>
      </div>

      {/* Settings Modal */}
      {showSettingsModal && (
        <div style={styles.modalOverlay} onClick={() => setShowSettingsModal(false)}>
          <div style={styles.modalBox} onClick={(e) => e.stopPropagation()}>
            <div style={styles.modalHeader}>
              <h3 style={{ margin: 0, fontSize: '1.2rem', color: '#0F172A' }}>Application Preferences</h3>
              <button
                onClick={() => setShowSettingsModal(false)}
                style={styles.modalCloseBtn}
              >
                <X size={18} />
              </button>
            </div>
            <div style={{ padding: '20px 0', display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={styles.settingLabel}>User Profile</label>
                <div style={styles.settingVal}>{currentUser?.name || 'User'} ({currentUser?.email})</div>
              </div>
              <div>
                <label style={styles.settingLabel}>Intelligence Engine</label>
                <div style={styles.settingVal}>MeetMind AI SaaS Engine v2.0 (Smart Speech Recognition & Analysis Core)</div>
              </div>
              <div>
                <label style={styles.settingLabel}>Active Workflow</label>
                <div style={styles.settingVal}>Ingest › Transcribe › Summarize › Tasks › Classify › Final Report</div>
              </div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', paddingTop: '10px' }}>
              <button
                onClick={() => setShowSettingsModal(false)}
                style={styles.modalDoneBtn}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const styles: { [key: string]: React.CSSProperties } = {
  layoutContainer: {
    display: 'flex',
    minHeight: '100vh',
    background: '#F8FAFC',
    color: '#0F172A',
    fontFamily: 'var(--font-sans, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif)',
  },
  sidebar: {
    width: '260px',
    height: '100vh',
    position: 'fixed',
    left: 0,
    top: 0,
    bottom: 0,
    background: '#FFFFFF',
    borderRight: '1px solid #E2E8F0',
    display: 'flex',
    flexDirection: 'column',
    zIndex: 40,
    boxShadow: '1px 0 6px 0 rgba(0, 0, 0, 0.03)',
  },
  sidebarHeader: {
    padding: '20px 18px',
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    borderBottom: '1px solid #F1F5F9',
  },
  headerTextWrap: {
    display: 'flex',
    flexDirection: 'column',
  },
  brandTitle: {
    fontSize: '1.05rem',
    fontWeight: 800,
    background: 'linear-gradient(135deg, #1E1B4B 0%, #4338CA 100%)',
    WebkitBackgroundClip: 'text',
    WebkitTextFillColor: 'transparent',
    letterSpacing: '-0.02em',
  },
  brandSubtitle: {
    fontSize: '0.72rem',
    color: '#64748B',
    fontWeight: 500,
  },
  navMenu: {
    flex: 1,
    overflowY: 'auto',
    padding: '16px 12px',
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
  },
  menuLabel: {
    fontSize: '0.68rem',
    fontWeight: 700,
    color: '#94A3B8',
    letterSpacing: '0.06em',
    padding: '0 8px 6px',
  },
  menuItemBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    padding: '9px 12px',
    borderRadius: '12px',
    border: 'none',
    cursor: 'pointer',
    textAlign: 'left',
    transition: 'all 0.18s ease',
    textDecoration: 'none',
    width: '100%',
  },
  activeMenuItem: {
    background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.12), rgba(139, 92, 246, 0.12))',
    boxShadow: '0 3px 12px rgba(99, 102, 241, 0.15)',
    borderLeft: '4px solid #6366F1',
  },
  inactiveMenuItem: {
    background: 'transparent',
    borderLeft: '4px solid transparent',
  },
  iconWrap: {
    width: '32px',
    height: '32px',
    borderRadius: '10px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    transition: 'all 0.18s ease',
  },
  activeIconWrap: {
    background: 'linear-gradient(135deg, #6366F1, #8B5CF6)',
  },
  inactiveIconWrap: {
    background: '#F1F5F9',
  },
  menuItemTextWrap: {
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
  },
  menuItemName: {
    fontSize: '0.86rem',
    lineHeight: 1.25,
    whiteSpace: 'nowrap',
    textOverflow: 'ellipsis',
    overflow: 'hidden',
  },
  menuItemDesc: {
    fontSize: '0.70rem',
    color: '#94A3B8',
    whiteSpace: 'nowrap',
    textOverflow: 'ellipsis',
    overflow: 'hidden',
    marginTop: '2px',
  },
  sidebarFooter: {
    padding: '16px 14px',
    borderTop: '1px solid #F1F5F9',
    background: '#FAFAFD',
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
  },
  userProfileCard: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    padding: '6px 4px',
  },
  avatarCircle: {
    width: '34px',
    height: '34px',
    borderRadius: '50%',
    background: 'linear-gradient(135deg, #6366F1, #8B5CF6)',
    color: '#FFFFFF',
    fontWeight: 700,
    fontSize: '0.9rem',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  userMeta: {
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
  },
  userName: {
    fontSize: '0.84rem',
    fontWeight: 700,
    color: '#0F172A',
    lineHeight: 1.2,
    whiteSpace: 'nowrap',
    textOverflow: 'ellipsis',
    overflow: 'hidden',
  },
  userEmail: {
    fontSize: '0.72rem',
    color: '#64748B',
    whiteSpace: 'nowrap',
    textOverflow: 'ellipsis',
    overflow: 'hidden',
  },
  footerActionRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  footerBtn: {
    flex: 1,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '7px 10px',
    background: '#FFFFFF',
    border: '1px solid #E2E8F0',
    borderRadius: '10px',
    fontSize: '0.78rem',
    fontWeight: 600,
    color: '#475569',
    cursor: 'pointer',
    transition: 'all 0.15s ease',
  },
  mainWrapper: {
    marginLeft: '260px',
    flex: 1,
    minHeight: '100vh',
    display: 'flex',
    flexDirection: 'column',
    background: '#F8FAFC',
  },
  mainContentInner: {
    width: '100%',
    maxWidth: '1260px',
    margin: '0 auto',
    padding: '32px 32px 64px',
  },
  modalOverlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    background: 'rgba(15, 23, 42, 0.45)',
    backdropFilter: 'blur(3px)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 100,
  },
  modalBox: {
    background: '#FFFFFF',
    borderRadius: '20px',
    padding: '24px 28px',
    width: '90%',
    maxWidth: '460px',
    boxShadow: '0 20px 40px rgba(0, 0, 0, 0.12)',
  },
  modalHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottom: '1px solid #F1F5F9',
    paddingBottom: '12px',
  },
  modalCloseBtn: {
    background: 'none',
    border: 'none',
    color: '#94A3B8',
    cursor: 'pointer',
  },
  settingLabel: {
    fontSize: '0.76rem',
    fontWeight: 700,
    color: '#64748B',
    textTransform: 'uppercase',
    letterSpacing: '0.04em',
  },
  settingVal: {
    fontSize: '0.88rem',
    color: '#1E293B',
    fontWeight: 600,
    marginTop: '3px',
  },
  modalDoneBtn: {
    padding: '8px 20px',
    background: 'linear-gradient(135deg, #6366F1, #8B5CF6)',
    color: '#FFFFFF',
    border: 'none',
    borderRadius: '10px',
    fontWeight: 600,
    fontSize: '0.85rem',
    cursor: 'pointer',
  },
};
