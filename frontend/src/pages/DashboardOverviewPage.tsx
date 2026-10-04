import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Upload,
  FileText,
  CheckSquare,
  BarChart3,
  Sparkles,
  ArrowRight,
  TrendingUp,
} from 'lucide-react';
import { SidebarLayout } from '../components/SidebarLayout';
import { meetingsApi } from '../api/meetings';
import { authApi, type User as UserType } from '../api/auth';

export const DashboardOverviewPage: React.FC = () => {
  const navigate = useNavigate();
  const [currentUser, setCurrentUser] = useState<UserType | null>(null);
  const [liveStats, setLiveStats] = useState<{
    files_uploaded: number;
    transcripts: number;
    summaries: number;
    action_items: number;
    total_files: number;
    total_transcripts: number;
    total_summaries: number;
    total_action_items: number;
  } | null>(null);

  useEffect(() => {
    const user = authApi.getCurrentUser();
    setCurrentUser(user);

    // Fetch user-specific live MongoDB statistics
    const loadStats = async () => {
      try {
        const stats = await meetingsApi.getLiveStats();
        if (stats) {
          const files = stats.files_uploaded ?? stats.total_files ?? 0;
          const trs = stats.transcripts ?? stats.total_transcripts ?? 0;
          const sums = stats.summaries ?? stats.total_summaries ?? 0;
          const acts = stats.action_items ?? stats.total_action_items ?? 0;
          setLiveStats({
            files_uploaded: files,
            transcripts: trs,
            summaries: sums,
            action_items: acts,
            total_files: files,
            total_transcripts: trs,
            total_summaries: sums,
            total_action_items: acts,
          });
        }
      } catch (err) {
        console.warn('Could not load user dashboard stats:', err);
      }
    };

    loadStats();
    // Auto-refresh stats every 5 seconds so uploads immediately reflect
    const interval = setInterval(loadStats, 5000);
    return () => clearInterval(interval);
  }, []);

  return (
    <SidebarLayout>
      <div style={styles.container}>
        {/* Welcome Banner */}
        <div style={styles.welcomeBanner}>
          <div style={styles.bannerText}>
            <div style={styles.bannerPill}>
              <Sparkles size={14} color="#6366F1" style={{ marginRight: '6px' }} />
              <span>Executive Meeting Intelligence Platform</span>
            </div>
            <h1 style={styles.bannerHeading}>
              Welcome back, {currentUser?.name || 'Team Leader'} 👋
            </h1>
            <p style={styles.bannerSubtext}>
              Transform lengthy meeting recordings and PDF documents into structured summaries, actionable deliverables, and ML-powered strategic insights.
            </p>
            <div style={styles.bannerActions}>
              <button
                onClick={() => navigate('/upload')}
                style={styles.primaryActionBtn}
                id="banner-start-upload-btn"
              >
                <Upload size={16} style={{ marginRight: '8px' }} />
                <span>Upload New Meeting</span>
              </button>
              <button
                onClick={() => navigate('/summary')}
                style={styles.secondaryActionBtn}
              >
                <span>View AI Summaries</span>
                <ArrowRight size={16} style={{ marginLeft: '8px' }} />
              </button>
            </div>
          </div>
        </div>

        {/* User-Specific Meeting Analytics Header Bar (Requirement 8) */}
        <div style={styles.statsSectionHeader}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={styles.liveIndicatorDot} />
            <h3 style={styles.statsSectionTitle}>My Meeting Analytics</h3>
          </div>
          <span style={styles.liveMetaBadge}>Live Cloud Sync Active</span>
        </div>

        {/* Executive KPI Stats Cards - Real User MongoDB Counts */}
        <div style={styles.statsGrid}>
          <div style={styles.statCard}>
            <div style={{ ...styles.statIconCircle, background: '#EEF2FF' }}>
              <TrendingUp size={22} color="#6366F1" />
            </div>
            <div style={styles.statContent}>
              <span style={styles.statNumber}>{liveStats !== null ? liveStats.files_uploaded : '—'}</span>
              <span style={styles.statLabel}>Total Files Uploaded</span>
            </div>
          </div>

          <div style={styles.statCard}>
            <div style={{ ...styles.statIconCircle, background: '#F5F3FF' }}>
              <FileText size={22} color="#8B5CF6" />
            </div>
            <div style={styles.statContent}>
              <span style={styles.statNumber}>{liveStats !== null ? liveStats.transcripts : '—'}</span>
              <span style={styles.statLabel}>Total Transcripts</span>
            </div>
          </div>

          <div style={styles.statCard}>
            <div style={{ ...styles.statIconCircle, background: '#ECFDF5' }}>
              <Sparkles size={22} color="#10B981" />
            </div>
            <div style={styles.statContent}>
              <span style={styles.statNumber}>{liveStats !== null ? liveStats.summaries : '—'}</span>
              <span style={styles.statLabel}>Total Summaries</span>
            </div>
          </div>

          <div style={styles.statCard}>
            <div style={{ ...styles.statIconCircle, background: '#FFFBEB' }}>
              <CheckSquare size={22} color="#F59E0B" />
            </div>
            <div style={styles.statContent}>
              <span style={styles.statNumber}>{liveStats !== null ? liveStats.action_items : '—'}</span>
              <span style={styles.statLabel}>Total Action Items</span>
            </div>
          </div>
        </div>

        {/* End-to-End Workflow Pipeline Tracker */}
        <div style={styles.pipelineCard}>
          <div style={styles.pipelineHeader}>
            <h2 style={styles.pipelineTitle}>Meeting Intelligence Pipeline</h2>
            <span style={styles.pipelineSub}>Standard 6-stage automated intelligence flow</span>
          </div>

          <div style={styles.pipelineSteps}>
            <div style={styles.stepItem} onClick={() => navigate('/upload')}>
              <div style={styles.stepNumber}>1</div>
              <span style={styles.stepTitle}>Ingestion</span>
              <span style={styles.stepSubtitle}>Upload PDF / Audio</span>
            </div>
            <div style={styles.stepArrow}>›</div>

            <div style={styles.stepItem} onClick={() => navigate('/upload')}>
              <div style={styles.stepNumber}>2</div>
              <span style={styles.stepTitle}>Transcription</span>
              <span style={styles.stepSubtitle}>Speech Recognition</span>
            </div>
            <div style={styles.stepArrow}>›</div>

            <div style={styles.stepItem} onClick={() => navigate('/summary')}>
              <div style={styles.stepNumber}>3</div>
              <span style={styles.stepTitle}>AI Summary</span>
              <span style={styles.stepSubtitle}>6-Section Overview</span>
            </div>
            <div style={styles.stepArrow}>›</div>

            <div style={styles.stepItem} onClick={() => navigate('/action-items')}>
              <div style={styles.stepNumber}>4</div>
              <span style={styles.stepTitle}>Action Items</span>
              <span style={styles.stepSubtitle}>Task Allocation</span>
            </div>
            <div style={styles.stepArrow}>›</div>

            <div style={styles.stepItem} onClick={() => navigate('/classification')}>
              <div style={styles.stepNumber}>5</div>
              <span style={styles.stepTitle}>ML Classify</span>
              <span style={styles.stepSubtitle}>Domain Prediction</span>
            </div>
            <div style={styles.stepArrow}>›</div>

            <div style={styles.stepItem} onClick={() => navigate('/reports')}>
              <div style={styles.stepNumber}>6</div>
              <span style={styles.stepTitle}>Final Report</span>
              <span style={styles.stepSubtitle}>PDF Export</span>
            </div>
          </div>
        </div>

        {/* Quick Launchpad Cards */}
        <div style={styles.launchpadGrid}>
          <div style={styles.launchCard} onClick={() => navigate('/upload')}>
            <div style={{ ...styles.launchIcon, background: '#EEF2FF' }}>
              <Upload size={22} color="#6366F1" />
            </div>
            <h3 style={styles.launchTitle}>Upload & Transcript</h3>
            <p style={styles.launchDesc}>Upload audio or PDF files and extract speech/document text.</p>
            <span style={styles.launchLink}>Open Upload Studio →</span>
          </div>

          <div style={styles.launchCard} onClick={() => navigate('/summary')}>
            <div style={{ ...styles.launchIcon, background: '#F5F3FF' }}>
              <FileText size={22} color="#8B5CF6" />
            </div>
            <h3 style={styles.launchTitle}>AI Meeting Summary</h3>
            <p style={styles.launchDesc}>Generate structured 1-page summaries with key points and decisions.</p>
            <span style={styles.launchLink}>Generate Summary →</span>
          </div>

          <div style={styles.launchCard} onClick={() => navigate('/action-items')}>
            <div style={{ ...styles.launchIcon, background: '#ECFDF5' }}>
              <CheckSquare size={22} color="#10B981" />
            </div>
            <h3 style={styles.launchTitle}>Action Items</h3>
            <p style={styles.launchDesc}>Extract actionable tasks, assignees, priorities, and deadlines.</p>
            <span style={styles.launchLink}>Review Action Items →</span>
          </div>

          <div style={styles.launchCard} onClick={() => navigate('/reports')}>
            <div style={{ ...styles.launchIcon, background: '#EFF6FF' }}>
              <BarChart3 size={22} color="#3B82F6" />
            </div>
            <h3 style={styles.launchTitle}>Executive Reports</h3>
            <p style={styles.launchDesc}>Download comprehensive meeting dossiers in PDF and report formats.</p>
            <span style={styles.launchLink}>View Reports →</span>
          </div>
        </div>
      </div>
    </SidebarLayout>
  );
};

const styles: { [key: string]: React.CSSProperties } = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    gap: '28px',
  },
  welcomeBanner: {
    background: 'linear-gradient(135deg, #FFFFFF 0%, #F5F3FF 100%)',
    border: '1px solid #E0E7FF',
    borderRadius: '24px',
    padding: '32px 36px',
    boxShadow: '0 8px 24px rgba(99, 102, 241, 0.05)',
  },
  bannerText: {
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
  },
  bannerPill: {
    display: 'inline-flex',
    alignItems: 'center',
    background: '#EEF2FF',
    color: '#4F46E5',
    fontSize: '0.78rem',
    fontWeight: 700,
    padding: '4px 14px',
    borderRadius: '20px',
    width: 'fit-content',
  },
  bannerHeading: {
    fontSize: '2.1rem',
    fontWeight: 800,
    color: '#0F172A',
    margin: 0,
    letterSpacing: '-0.025em',
  },
  bannerSubtext: {
    fontSize: '1rem',
    color: '#475569',
    lineHeight: 1.6,
    margin: 0,
    maxWidth: '780px',
  },
  bannerActions: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    marginTop: '12px',
    flexWrap: 'wrap',
  },
  primaryActionBtn: {
    display: 'inline-flex',
    alignItems: 'center',
    padding: '12px 22px',
    borderRadius: '12px',
    background: 'linear-gradient(135deg, #6366F1, #8B5CF6)',
    color: '#FFFFFF',
    fontWeight: 700,
    fontSize: '0.9rem',
    border: 'none',
    cursor: 'pointer',
    boxShadow: '0 4px 14px rgba(99, 102, 241, 0.3)',
  },
  secondaryActionBtn: {
    display: 'inline-flex',
    alignItems: 'center',
    padding: '12px 20px',
    borderRadius: '12px',
    background: '#FFFFFF',
    color: '#4F46E5',
    fontWeight: 600,
    fontSize: '0.9rem',
    border: '1px solid #C7D2FE',
    cursor: 'pointer',
  },
  statsSectionHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '4px 8px',
    marginBottom: '-8px',
    flexWrap: 'wrap',
    gap: '12px',
  },
  liveIndicatorDot: {
    width: '10px',
    height: '10px',
    borderRadius: '50%',
    background: '#10B981',
    boxShadow: '0 0 0 3px rgba(16, 185, 129, 0.25)',
    display: 'inline-block',
  },
  statsSectionTitle: {
    fontSize: '1.05rem',
    fontWeight: 700,
    color: '#0F172A',
    margin: 0,
    letterSpacing: '-0.01em',
  },
  liveMetaBadge: {
    fontSize: '0.74rem',
    fontWeight: 700,
    color: '#059669',
    background: '#ECFDF5',
    border: '1px solid #A7F3D0',
    padding: '3px 10px',
    borderRadius: '12px',
  },
  statsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
    gap: '20px',
  },
  statCard: {
    background: '#FFFFFF',
    border: '1px solid #E2E8F0',
    borderRadius: '20px',
    padding: '22px',
    display: 'flex',
    alignItems: 'center',
    gap: '16px',
    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.02)',
  },
  statIconCircle: {
    width: '48px',
    height: '48px',
    borderRadius: '14px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  statContent: {
    display: 'flex',
    flexDirection: 'column',
  },
  statNumber: {
    fontSize: '1.65rem',
    fontWeight: 800,
    color: '#0F172A',
    lineHeight: 1.1,
  },
  statLabel: {
    fontSize: '0.82rem',
    color: '#64748B',
    marginTop: '4px',
    fontWeight: 500,
  },
  pipelineCard: {
    background: '#FFFFFF',
    border: '1px solid #E2E8F0',
    borderRadius: '20px',
    padding: '26px 30px',
    boxShadow: '0 4px 14px rgba(0, 0, 0, 0.02)',
  },
  pipelineHeader: {
    marginBottom: '20px',
  },
  pipelineTitle: {
    fontSize: '1.25rem',
    fontWeight: 700,
    color: '#0F172A',
    margin: 0,
  },
  pipelineSub: {
    fontSize: '0.84rem',
    color: '#64748B',
    marginTop: '2px',
  },
  pipelineSteps: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: '12px',
  },
  stepItem: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    padding: '12px 16px',
    background: '#F8FAFC',
    border: '1px solid #E2E8F0',
    borderRadius: '14px',
    cursor: 'pointer',
    transition: 'all 0.15s ease',
    minWidth: '120px',
    textAlign: 'center',
  },
  stepNumber: {
    width: '26px',
    height: '26px',
    borderRadius: '50%',
    background: '#6366F1',
    color: '#FFFFFF',
    fontSize: '0.8rem',
    fontWeight: 700,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: '6px',
  },
  stepTitle: {
    fontSize: '0.88rem',
    fontWeight: 700,
    color: '#1E293B',
  },
  stepSubtitle: {
    fontSize: '0.72rem',
    color: '#64748B',
    marginTop: '2px',
  },
  stepArrow: {
    fontSize: '1.5rem',
    color: '#CBD5E1',
    fontWeight: 700,
  },
  launchpadGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
    gap: '20px',
  },
  launchCard: {
    background: '#FFFFFF',
    border: '1px solid #E2E8F0',
    borderRadius: '20px',
    padding: '24px',
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
    cursor: 'pointer',
    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.02)',
    transition: 'transform 0.15s ease, box-shadow 0.15s ease',
  },
  launchIcon: {
    width: '44px',
    height: '44px',
    borderRadius: '12px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  launchTitle: {
    fontSize: '1.1rem',
    fontWeight: 700,
    color: '#0F172A',
    margin: 0,
  },
  launchDesc: {
    fontSize: '0.86rem',
    color: '#64748B',
    lineHeight: 1.5,
    margin: 0,
    flex: 1,
  },
  launchLink: {
    fontSize: '0.86rem',
    fontWeight: 700,
    color: '#4F46E5',
    marginTop: '8px',
  },
};
