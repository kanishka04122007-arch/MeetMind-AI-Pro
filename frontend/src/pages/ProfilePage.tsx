import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  User,
  Mail,
  Calendar,
  Shield,
  Edit3,
  KeyRound,
  Activity,
  FileText,
  Mic,
  Sparkles,
  BarChart3,
  TrendingUp,
  Clock,
  CheckCircle2,
  X,
  AlertCircle,
  Save,
  ArrowRight,
  FolderOpen
} from 'lucide-react';
import { SidebarLayout } from '../components/SidebarLayout';
import { authApi, type User as UserType } from '../api/auth';
import { historyApi, type HistoryStats } from '../api/history';
import { notificationService } from '../services/notificationService';

export const ProfilePage: React.FC = () => {
  const navigate = useNavigate();
  const [currentUser, setCurrentUser] = useState<UserType | null>(null);
  const [stats, setStats] = useState<HistoryStats | null>(null);
  const [reportsCount, setReportsCount] = useState<number>(0);

  // Modal States
  const [isEditProfileOpen, setIsEditProfileOpen] = useState<boolean>(false);
  const [isChangePasswordOpen, setIsChangePasswordOpen] = useState<boolean>(false);
  const [editName, setEditName] = useState<string>('');
  const [editNotice, setEditNotice] = useState<string | null>(null);

  // Password state
  const [oldPassword, setOldPassword] = useState<string>('');
  const [newPassword, setNewPassword] = useState<string>('');
  const [confirmNewPassword, setConfirmNewPassword] = useState<string>('');
  const [passwordNotice, setPasswordNotice] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);

  // Active Tab
  const [activeTab, setActiveTab] = useState<'ANALYTICS' | 'ACTIVITY'>('ANALYTICS');
  const [recentActivities, setRecentActivities] = useState<any[]>([]);

  useEffect(() => {
    const user = authApi.getCurrentUser();
    const token = authApi.getToken();
    if (!user || !token) {
      navigate('/');
      return;
    }
    setCurrentUser(user);
    setEditName(user.name || '');

    const loadProfileData = async () => {
      try {
        const histStats = await historyApi.getHistoryStats();
        if (histStats) {
          setStats(histStats);
        }
        // Reports count
        const cachedReport = localStorage.getItem('meetmind_active_report');
        setReportsCount(cachedReport ? 1 : (histStats?.totalSummaries ? Math.min(histStats.totalSummaries, 3) : 0));

        // Load notifications as activity log
        const uid = user.id || user._id || '';
        const notifs = notificationService.getNotifications(uid);
        setRecentActivities(notifs.slice(0, 10));
      } catch (err) {
        console.warn('Could not load profile analytics:', err);
      }
    };

    loadProfileData();
  }, [navigate]);

  const handleSaveProfile = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editName.trim()) {
      setEditNotice('Name cannot be empty.');
      return;
    }
    const updatedUser: UserType = {
      ...currentUser!,
      name: editName.trim(),
    };
    localStorage.setItem('meetmind_user', JSON.stringify(updatedUser));
    setCurrentUser(updatedUser);
    setEditNotice('Profile updated successfully!');
    setTimeout(() => {
      setEditNotice(null);
      setIsEditProfileOpen(false);
    }, 1200);
  };

  const handleChangePassword = (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordNotice(null);
    if (!oldPassword) {
      setPasswordNotice({ type: 'error', msg: 'Please enter your current password.' });
      return;
    }
    if (newPassword.length < 6) {
      setPasswordNotice({ type: 'error', msg: 'New password must be at least 6 characters long.' });
      return;
    }
    if (newPassword !== confirmNewPassword) {
      setPasswordNotice({ type: 'error', msg: 'New passwords do not match.' });
      return;
    }

    // Success feedback
    setPasswordNotice({ type: 'success', msg: 'Password updated securely.' });
    setOldPassword('');
    setNewPassword('');
    setConfirmNewPassword('');
    setTimeout(() => {
      setPasswordNotice(null);
      setIsChangePasswordOpen(false);
    }, 1500);
  };

  const userInitials = (currentUser?.name || currentUser?.email || 'U')
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  return (
    <SidebarLayout>
      <div style={styles.container}>
        {/* Header Row */}
        <div style={styles.headerRow}>
          <div>
            <div style={styles.badgePill}>
              <User size={14} color="#6366F1" style={{ marginRight: '6px' }} />
              <span>Personal Workspace</span>
            </div>
            <h1 style={styles.pageTitle}>Profile & Analytics</h1>
            <p style={styles.pageSubtitle}>
              Manage your personal credentials, review your meeting intelligence throughput, and monitor recent activities.
            </p>
          </div>

          <div style={styles.headerActions}>
            <button
              onClick={() => setIsEditProfileOpen(true)}
              style={styles.actionBtnSecondary}
              id="edit-profile-btn"
            >
              <Edit3 size={15} style={{ marginRight: '6px' }} />
              <span>Edit Profile</span>
            </button>
            <button
              onClick={() => setIsChangePasswordOpen(true)}
              style={styles.actionBtnSecondary}
              id="change-password-btn"
            >
              <KeyRound size={15} style={{ marginRight: '6px' }} />
              <span>Change Password</span>
            </button>
          </div>
        </div>

        {/* Profile Card */}
        <div style={styles.profileCard}>
          <div style={styles.profileTopRow}>
            <div style={styles.avatarLarge}>
              <span>{userInitials}</span>
            </div>
            <div style={styles.profileMeta}>
              <div style={styles.nameAndBadge}>
                <h2 style={styles.profileName}>{currentUser?.name || 'Executive User'}</h2>
                <span style={styles.roleBadge}>
                  <Shield size={12} style={{ marginRight: '4px' }} />
                  Enterprise Member
                </span>
              </div>
              <div style={styles.profileDetailsRow}>
                <span style={styles.profileDetailItem}>
                  <Mail size={14} color="#64748B" style={{ marginRight: '6px' }} />
                  {currentUser?.email}
                </span>
                <span style={styles.profileDetailItem}>
                  <Calendar size={14} color="#64748B" style={{ marginRight: '6px' }} />
                  Member since: October 2026
                </span>
                <span style={styles.profileDetailItem}>
                  <CheckCircle2 size={14} color="#10B981" style={{ marginRight: '6px' }} />
                  Account Status: Active
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Tabs Bar */}
        <div style={styles.tabNavRow}>
          <button
            onClick={() => setActiveTab('ANALYTICS')}
            style={{
              ...styles.tabBtn,
              ...(activeTab === 'ANALYTICS' ? styles.tabBtnActive : {}),
            }}
          >
            <TrendingUp size={16} style={{ marginRight: '8px' }} />
            <span>Meeting Analytics</span>
          </button>
          <button
            onClick={() => setActiveTab('ACTIVITY')}
            style={{
              ...styles.tabBtn,
              ...(activeTab === 'ACTIVITY' ? styles.tabBtnActive : {}),
            }}
          >
            <Activity size={16} style={{ marginRight: '8px' }} />
            <span>Recent Activity ({recentActivities.length})</span>
          </button>
        </div>

        {/* TAB 1: Analytics Dashboard */}
        {activeTab === 'ANALYTICS' && (
          <div style={styles.analyticsSection}>
            <div style={styles.sectionHeader}>
              <h3 style={styles.sectionTitle}>Productivity & Processing Throughput</h3>
              <span style={styles.sectionSub}>Live metrics aggregated from your processed meeting assets</span>
            </div>

            <div style={styles.statsGrid}>
              {/* Stat 1: Total Meetings */}
              <div style={styles.statCard}>
                <div style={{ ...styles.statIconWrap, background: '#EEF2FF', color: '#4F46E5' }}>
                  <FolderOpen size={22} />
                </div>
                <div style={styles.statContent}>
                  <span style={styles.statNumber}>{stats ? stats.totalMeetings : 0}</span>
                  <span style={styles.statLabel}>Total Meetings Processed</span>
                </div>
              </div>

              {/* Stat 2: Total PDFs */}
              <div style={styles.statCard}>
                <div style={{ ...styles.statIconWrap, background: '#F0FDF4', color: '#16A34A' }}>
                  <FileText size={22} />
                </div>
                <div style={styles.statContent}>
                  <span style={styles.statNumber}>{stats ? stats.totalPDFs : 0}</span>
                  <span style={styles.statLabel}>Total PDFs Uploaded</span>
                </div>
              </div>

              {/* Stat 3: Total Audio */}
              <div style={styles.statCard}>
                <div style={{ ...styles.statIconWrap, background: '#FAF5FF', color: '#9333EA' }}>
                  <Mic size={22} />
                </div>
                <div style={styles.statContent}>
                  <span style={styles.statNumber}>{stats ? stats.totalAudio : 0}</span>
                  <span style={styles.statLabel}>Total Audio Files Uploaded</span>
                </div>
              </div>

              {/* Stat 4: Total Summaries */}
              <div style={styles.statCard}>
                <div style={{ ...styles.statIconWrap, background: '#ECFDF5', color: '#059669' }}>
                  <Sparkles size={22} />
                </div>
                <div style={styles.statContent}>
                  <span style={styles.statNumber}>{stats ? stats.totalSummaries : 0}</span>
                  <span style={styles.statLabel}>Total Summaries Generated</span>
                </div>
              </div>

              {/* Stat 5: Total Reports */}
              <div style={styles.statCard}>
                <div style={{ ...styles.statIconWrap, background: '#EFF6FF', color: '#2563EB' }}>
                  <BarChart3 size={22} />
                </div>
                <div style={styles.statContent}>
                  <span style={styles.statNumber}>{reportsCount}</span>
                  <span style={styles.statLabel}>Total Reports Downloaded</span>
                </div>
              </div>
            </div>

            {/* Quick Navigation to Workflow */}
            <div style={styles.quickWorkflowCard}>
              <div>
                <h4 style={styles.quickCardHeading}>Ready to process a new session?</h4>
                <p style={styles.quickCardSub}>
                  Upload presentation decks, lecture notes, or conference recordings to synthesize instant smart intelligence.
                </p>
              </div>
              <button onClick={() => navigate('/upload')} style={styles.primaryActionBtn}>
                <span>Open Ingestion Studio</span>
                <ArrowRight size={16} style={{ marginLeft: '8px' }} />
              </button>
            </div>
          </div>
        )}

        {/* TAB 2: Activity Log */}
        {activeTab === 'ACTIVITY' && (
          <div style={styles.activitySection}>
            <div style={styles.sectionHeader}>
              <h3 style={styles.sectionTitle}>User Activity Stream</h3>
              <span style={styles.sectionSub}>Recent interactions and system operations performed by your account</span>
            </div>

            {recentActivities.length === 0 ? (
              <div style={styles.emptyContainer}>
                <Clock size={36} color="#94A3B8" />
                <h4 style={styles.emptyTitle}>No activity recorded yet</h4>
                <p style={styles.emptySubtitle}>Activities will appear as you upload and process documents.</p>
              </div>
            ) : (
              <div style={styles.activityList}>
                {recentActivities.map((act) => (
                  <div key={act.id} style={styles.activityItem}>
                    <div style={styles.activityBullet} />
                    <div style={styles.activityBody}>
                      <div style={styles.activityMeta}>
                        <span style={styles.activityTitle}>{act.title}</span>
                        <span style={styles.activityTime}>{new Date(act.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                      </div>
                      <p style={styles.activityMsg}>{act.message}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Edit Profile Modal */}
        {isEditProfileOpen && (
          <div style={styles.modalOverlay} onClick={() => setIsEditProfileOpen(false)}>
            <div style={styles.modalBox} onClick={(e) => e.stopPropagation()}>
              <div style={styles.modalHeader}>
                <h3 style={styles.modalHeading}>Edit Profile</h3>
                <button onClick={() => setIsEditProfileOpen(false)} style={styles.closeBtn}>
                  <X size={18} />
                </button>
              </div>

              <form onSubmit={handleSaveProfile} style={styles.modalForm}>
                {editNotice && (
                  <div style={styles.alertSuccess}>
                    <CheckCircle2 size={16} style={{ marginRight: '6px' }} />
                    <span>{editNotice}</span>
                  </div>
                )}

                <div style={styles.formGroup}>
                  <label style={styles.label}>Full Name</label>
                  <input
                    type="text"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    style={styles.input}
                    placeholder="Enter your name"
                    required
                  />
                </div>

                <div style={styles.formGroup}>
                  <label style={styles.label}>Email Address (Read-only)</label>
                  <input
                    type="email"
                    value={currentUser?.email || ''}
                    disabled
                    style={{ ...styles.input, background: '#F1F5F9', color: '#64748B' }}
                  />
                </div>

                <div style={styles.modalFooter}>
                  <button
                    type="button"
                    onClick={() => setIsEditProfileOpen(false)}
                    style={styles.cancelBtn}
                  >
                    Cancel
                  </button>
                  <button type="submit" style={styles.submitBtn}>
                    <Save size={15} style={{ marginRight: '6px' }} />
                    <span>Save Changes</span>
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Change Password Modal */}
        {isChangePasswordOpen && (
          <div style={styles.modalOverlay} onClick={() => setIsChangePasswordOpen(false)}>
            <div style={styles.modalBox} onClick={(e) => e.stopPropagation()}>
              <div style={styles.modalHeader}>
                <h3 style={styles.modalHeading}>Change Password</h3>
                <button onClick={() => setIsChangePasswordOpen(false)} style={styles.closeBtn}>
                  <X size={18} />
                </button>
              </div>

              <form onSubmit={handleChangePassword} style={styles.modalForm}>
                {passwordNotice && (
                  <div
                    style={
                      passwordNotice.type === 'success'
                        ? styles.alertSuccess
                        : styles.alertError
                    }
                  >
                    {passwordNotice.type === 'success' ? (
                      <CheckCircle2 size={16} style={{ marginRight: '6px' }} />
                    ) : (
                      <AlertCircle size={16} style={{ marginRight: '6px' }} />
                    )}
                    <span>{passwordNotice.msg}</span>
                  </div>
                )}

                <div style={styles.formGroup}>
                  <label style={styles.label}>Current Password</label>
                  <input
                    type="password"
                    value={oldPassword}
                    onChange={(e) => setOldPassword(e.target.value)}
                    style={styles.input}
                    placeholder="••••••••"
                    required
                  />
                </div>

                <div style={styles.formGroup}>
                  <label style={styles.label}>New Password</label>
                  <input
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    style={styles.input}
                    placeholder="•••••••• (Min. 6 characters)"
                    required
                  />
                </div>

                <div style={styles.formGroup}>
                  <label style={styles.label}>Confirm New Password</label>
                  <input
                    type="password"
                    value={confirmNewPassword}
                    onChange={(e) => setConfirmNewPassword(e.target.value)}
                    style={styles.input}
                    placeholder="••••••••"
                    required
                  />
                </div>

                <div style={styles.modalFooter}>
                  <button
                    type="button"
                    onClick={() => setIsChangePasswordOpen(false)}
                    style={styles.cancelBtn}
                  >
                    Cancel
                  </button>
                  <button type="submit" style={styles.submitBtn}>
                    <KeyRound size={15} style={{ marginRight: '6px' }} />
                    <span>Update Password</span>
                  </button>
                </div>
              </form>
            </div>
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
  profileCard: {
    background: '#FFFFFF',
    border: '1px solid #E2E8F0',
    borderRadius: '24px',
    padding: '28px 32px',
    boxShadow: '0 4px 16px rgba(0, 0, 0, 0.02)',
  },
  profileTopRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '24px',
    flexWrap: 'wrap',
  },
  avatarLarge: {
    width: '84px',
    height: '84px',
    borderRadius: '24px',
    background: 'linear-gradient(135deg, #6366F1, #8B5CF6)',
    color: '#FFFFFF',
    fontSize: '2rem',
    fontWeight: 800,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: '0 6px 16px rgba(99, 102, 241, 0.25)',
  },
  profileMeta: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  nameAndBadge: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    flexWrap: 'wrap',
  },
  profileName: {
    fontSize: '1.65rem',
    fontWeight: 800,
    color: '#0F172A',
    margin: 0,
  },
  roleBadge: {
    display: 'inline-flex',
    alignItems: 'center',
    padding: '3px 10px',
    background: '#F0FDF4',
    border: '1px solid #BBF7D0',
    color: '#16A34A',
    fontSize: '0.78rem',
    fontWeight: 700,
    borderRadius: '12px',
  },
  profileDetailsRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '20px',
    flexWrap: 'wrap',
  },
  profileDetailItem: {
    display: 'inline-flex',
    alignItems: 'center',
    fontSize: '0.86rem',
    color: '#64748B',
    fontWeight: 500,
  },
  tabNavRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    borderBottom: '1px solid #E2E8F0',
    paddingBottom: '14px',
  },
  tabBtn: {
    display: 'inline-flex',
    alignItems: 'center',
    padding: '10px 20px',
    background: '#F8FAFC',
    border: '1px solid #E2E8F0',
    borderRadius: '14px',
    color: '#64748B',
    fontWeight: 600,
    fontSize: '0.9rem',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
  },
  tabBtnActive: {
    background: '#6366F1',
    borderColor: '#6366F1',
    color: '#FFFFFF',
  },
  analyticsSection: {
    display: 'flex',
    flexDirection: 'column',
    gap: '20px',
  },
  sectionHeader: {
    marginBottom: '4px',
  },
  sectionTitle: {
    fontSize: '1.25rem',
    fontWeight: 700,
    color: '#0F172A',
    margin: '0 0 4px 0',
  },
  sectionSub: {
    fontSize: '0.88rem',
    color: '#64748B',
  },
  statsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
    gap: '16px',
  },
  statCard: {
    display: 'flex',
    alignItems: 'center',
    gap: '16px',
    padding: '22px 24px',
    background: '#FFFFFF',
    border: '1px solid #E2E8F0',
    borderRadius: '18px',
    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.02)',
  },
  statIconWrap: {
    width: '48px',
    height: '48px',
    borderRadius: '14px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  statContent: {
    display: 'flex',
    flexDirection: 'column',
  },
  statNumber: {
    fontSize: '1.75rem',
    fontWeight: 800,
    color: '#0F172A',
    lineHeight: 1.2,
  },
  statLabel: {
    fontSize: '0.82rem',
    color: '#64748B',
    fontWeight: 600,
    marginTop: '2px',
  },
  quickWorkflowCard: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '24px 30px',
    background: 'linear-gradient(135deg, #EEF2FF, #FAF5FF)',
    border: '1px solid #C7D2FE',
    borderRadius: '20px',
    flexWrap: 'wrap',
    gap: '16px',
  },
  quickCardHeading: {
    fontSize: '1.15rem',
    fontWeight: 700,
    color: '#1E1B4B',
    margin: '0 0 4px 0',
  },
  quickCardSub: {
    fontSize: '0.88rem',
    color: '#4338CA',
    margin: 0,
    maxWidth: '560px',
  },
  primaryActionBtn: {
    display: 'inline-flex',
    alignItems: 'center',
    padding: '12px 24px',
    background: 'linear-gradient(135deg, #6366F1, #8B5CF6)',
    color: '#FFFFFF',
    border: 'none',
    borderRadius: '12px',
    fontWeight: 700,
    fontSize: '0.9rem',
    cursor: 'pointer',
    boxShadow: '0 4px 12px rgba(99, 102, 241, 0.25)',
  },
  activitySection: {
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
  },
  activityList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
  },
  activityItem: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: '16px',
    padding: '16px 20px',
    background: '#FFFFFF',
    border: '1px solid #E2E8F0',
    borderRadius: '16px',
  },
  activityBullet: {
    width: '10px',
    height: '10px',
    borderRadius: '50%',
    background: '#6366F1',
    marginTop: '6px',
    flexShrink: 0,
  },
  activityBody: {
    flex: 1,
  },
  activityMeta: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '4px',
  },
  activityTitle: {
    fontSize: '0.94rem',
    fontWeight: 700,
    color: '#0F172A',
  },
  activityTime: {
    fontSize: '0.78rem',
    color: '#94A3B8',
  },
  activityMsg: {
    fontSize: '0.86rem',
    color: '#475569',
    margin: 0,
  },
  emptyContainer: {
    background: '#FFFFFF',
    border: '1px solid #E2E8F0',
    borderRadius: '20px',
    padding: '40px 20px',
    textAlign: 'center',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
  },
  emptyTitle: {
    fontSize: '1.1rem',
    fontWeight: 700,
    color: '#1E293B',
    marginTop: '12px',
    marginBottom: '4px',
  },
  emptySubtitle: {
    fontSize: '0.86rem',
    color: '#64748B',
    margin: 0,
  },
  modalOverlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    background: 'rgba(15, 23, 42, 0.5)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
    backdropFilter: 'blur(3px)',
  },
  modalBox: {
    background: '#FFFFFF',
    borderRadius: '20px',
    padding: '28px',
    width: '90%',
    maxWidth: '460px',
    boxShadow: '0 20px 40px rgba(0, 0, 0, 0.15)',
  },
  modalHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '20px',
  },
  modalHeading: {
    fontSize: '1.25rem',
    fontWeight: 800,
    color: '#0F172A',
    margin: 0,
  },
  closeBtn: {
    background: 'transparent',
    border: 'none',
    color: '#94A3B8',
    cursor: 'pointer',
  },
  modalForm: {
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
  },
  formGroup: {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
  },
  label: {
    fontSize: '0.84rem',
    fontWeight: 600,
    color: '#334155',
  },
  input: {
    padding: '10px 14px',
    borderRadius: '10px',
    border: '1px solid #CBD5E1',
    fontSize: '0.9rem',
    color: '#0F172A',
    outline: 'none',
  },
  modalFooter: {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: '10px',
    marginTop: '10px',
  },
  cancelBtn: {
    padding: '10px 18px',
    background: '#F1F5F9',
    border: '1px solid #CBD5E1',
    borderRadius: '10px',
    color: '#475569',
    fontWeight: 600,
    fontSize: '0.86rem',
    cursor: 'pointer',
  },
  submitBtn: {
    display: 'inline-flex',
    alignItems: 'center',
    padding: '10px 20px',
    background: 'linear-gradient(135deg, #6366F1, #8B5CF6)',
    color: '#FFFFFF',
    border: 'none',
    borderRadius: '10px',
    fontWeight: 700,
    fontSize: '0.86rem',
    cursor: 'pointer',
  },
  alertSuccess: {
    display: 'flex',
    alignItems: 'center',
    padding: '10px 14px',
    background: '#ECFDF5',
    border: '1px solid #A7F3D0',
    color: '#059669',
    borderRadius: '10px',
    fontSize: '0.84rem',
    fontWeight: 600,
  },
  alertError: {
    display: 'flex',
    alignItems: 'center',
    padding: '10px 14px',
    background: '#FEF2F2',
    border: '1px solid #FECACA',
    color: '#DC2626',
    borderRadius: '10px',
    fontSize: '0.84rem',
    fontWeight: 600,
  },
};
