import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  BarChart3,
  Brain,
  Download,
  Share2,
  CheckCircle2,
  Calendar,
  Clock,
  ArrowLeft,
  Copy,
  Check,
  Eye,
  X,
} from 'lucide-react';
import { SidebarLayout } from '../components/SidebarLayout';
import { authApi } from '../api/auth';
import { notificationService } from '../services/notificationService';

export const ReportsPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();

  const navState = (location.state as {
    transcript?: string;
    summary?: string;
    action_items?: any[];
    category?: string;
    file_id?: string;
    title?: string;
  } | null) || {};

  const [meetingTitle, setMeetingTitle] = useState<string>('');
  const [summary, setSummary] = useState<string>('');
  const [transcript, setTranscript] = useState<string>('');
  const [category, setCategory] = useState<string>('');
  const [actionItems, setActionItems] = useState<any[]>([]);
  const [copiedReport, setCopiedReport] = useState<boolean>(false);
  const [exportNotice, setExportNotice] = useState<string | null>(null);
  const [showPreviewModal, setShowPreviewModal] = useState<boolean>(false);

  useEffect(() => {
    const user = authApi.getCurrentUser();
    const token = authApi.getToken();

    if (!user || !token) {
      navigate('/');
      return;
    }

    const currentUserId = user?.id || user?._id;

    if (navState.title) setMeetingTitle(navState.title);
    if (navState.summary) setSummary(navState.summary);
    if (navState.transcript) setTranscript(navState.transcript);
    if (navState.category) setCategory(navState.category);
    if (navState.action_items) setActionItems(navState.action_items);

    if (!navState.summary) {
      try {
        const cached = localStorage.getItem('meetmind_active_report');
        let foundAny = false;
        if (cached) {
          const parsed = JSON.parse(cached);
          if (parsed?.userId && parsed.userId !== currentUserId) {
            localStorage.removeItem('meetmind_active_report');
          } else {
            if (parsed.title) setMeetingTitle(parsed.title);
            if (parsed.summary) setSummary(parsed.summary);
            if (parsed.transcript) setTranscript(parsed.transcript);
            if (parsed.category) setCategory(parsed.category);
            if (parsed.action_items) setActionItems(parsed.action_items);
            foundAny = true;
          }
        }

        if (!foundAny) {
          const activeActions = localStorage.getItem('meetmind_active_action_items');
          const activeSummary = localStorage.getItem('meetmind_active_summary');
          if (activeActions) {
            const parsedActions = JSON.parse(activeActions);
            if (parsedActions?.userId && parsedActions.userId !== currentUserId) {
              localStorage.removeItem('meetmind_active_action_items');
            } else {
              if (parsedActions.title) setMeetingTitle(parsedActions.title);
              if (parsedActions.summary) setSummary(parsedActions.summary);
              if (parsedActions.transcript) setTranscript(parsedActions.transcript);
              if (parsedActions.action_items) setActionItems(parsedActions.action_items);
              foundAny = true;
            }
          }
          if (activeSummary && !foundAny) {
            const parsedSummary = JSON.parse(activeSummary);
            if (parsedSummary?.userId && parsedSummary.userId !== currentUserId) {
              localStorage.removeItem('meetmind_active_summary');
            } else {
              if (parsedSummary.title) setMeetingTitle(parsedSummary.title);
              if (parsedSummary.summary) setSummary(parsedSummary.summary);
              if (parsedSummary.transcript) setTranscript(parsedSummary.transcript);
            }
          }
          const activeClass = localStorage.getItem('meetmind_active_classification');
          if (activeClass) {
            const parsedClass = JSON.parse(activeClass);
            if (parsedClass?.userId && parsedClass.userId !== currentUserId) {
              localStorage.removeItem('meetmind_active_classification');
            } else if (parsedClass.category) {
              setCategory(parsedClass.category);
            }
          }
        }
      } catch {
        // ignore
      }
    }
  }, [navigate]);

  const handleDownloadPDF = () => {
    const currentUser = authApi.getCurrentUser();
    if (currentUser?.id) {
      notificationService.addNotification(currentUser.id, {
        type: 'report',
        title: 'Report Downloaded',
        message: `Intelligence PDF exported for "${meetingTitle || 'Meeting'}"`,
      });
    }
    window.print();
  };

  const handleShareReport = () => {
    const reportText = `Meeting Intelligence Report: ${meetingTitle || 'Meeting Dossier'}\nCategory: ${category || 'General'}\nStatus: Completed\nGenerated: ${new Date().toLocaleDateString()}\n\nExecutive Summary:\n${summary.slice(0, 400)}...\n\nTasks Identified: ${actionItems.length}`;
    navigator.clipboard.writeText(reportText);

    const currentUser = authApi.getCurrentUser();
    if (currentUser?.id) {
      notificationService.addNotification(currentUser.id, {
        type: 'report',
        title: 'Report Shared',
        message: `Report summary copied to clipboard for sharing.`,
      });
    }

    setExportNotice('Report summary copied to clipboard for instant sharing.');
    setTimeout(() => setExportNotice(null), 3500);
  };

  const handleCopyReport = () => {
    const reportText = `Meeting: ${meetingTitle}\nCategory: ${category}\n\nSummary:\n${summary}\n\nTasks:\n${actionItems.map(a => `- ${a.task}`).join('\n')}`;
    navigator.clipboard.writeText(reportText);
    setCopiedReport(true);
    setTimeout(() => setCopiedReport(false), 2000);
  };

  const hasData = Boolean(summary || transcript || actionItems.length > 0);

  return (
    <SidebarLayout>
      <div style={styles.contentContainer}>
        {/* Header Row */}
        <div style={styles.headerRow}>
          <div>
            <div style={styles.badgePill}>
              <BarChart3 size={14} color="#6366F1" style={{ marginRight: '6px' }} />
              <span>Step 5: Final Executive Dossier</span>
            </div>
            <h1 style={styles.pageTitle}>Meeting Intelligence Report</h1>
            <p style={styles.pageSubtitle}>
              Synthesized executive dossier compiling meeting intelligence, action deliverables, and classification.
            </p>
          </div>

          {hasData && (
            <div style={styles.headerActions}>
              <button
                onClick={() => setShowPreviewModal(true)}
                style={styles.previewBtn}
                id="preview-report-btn"
              >
                <Eye size={16} style={{ marginRight: '8px' }} />
                <span>Preview Report</span>
              </button>

              <button
                onClick={handleDownloadPDF}
                style={styles.downloadPdfBtn}
                id="download-pdf-btn"
              >
                <Download size={16} style={{ marginRight: '8px' }} />
                <span>Download PDF</span>
              </button>

              <button
                onClick={handleShareReport}
                style={styles.shareReportBtn}
                id="share-report-btn"
              >
                <Share2 size={16} style={{ marginRight: '8px' }} />
                <span>Share Report</span>
              </button>
            </div>
          )}
        </div>

        {exportNotice && (
          <div style={styles.successBanner}>
            <CheckCircle2 size={18} color="#16A34A" style={{ marginRight: '10px' }} />
            <span>{exportNotice}</span>
          </div>
        )}

        {/* Empty State */}
        {!hasData && (
          <div style={styles.emptyContainer}>
            <div style={styles.emptyIconCircle}>
              <BarChart3 size={36} color="#94A3B8" />
            </div>
            <h3 style={styles.emptyTitle}>No reports generated yet.</h3>
            <p style={styles.emptySubtitle}>
              Upload your first PDF or audio recording to get started with automated executive reports.
            </p>
            <button onClick={() => navigate('/upload')} style={styles.emptyActionBtn}>
              <BarChart3 size={16} style={{ marginRight: '8px' }} />
              <span>Upload Document</span>
            </button>
          </div>
        )}

        {/* ================= REPORT SUMMARY METADATA BANNER ================= */}
        {hasData && (
          <div style={styles.metaBanner}>
            <div style={styles.metaCol}>
              <span style={styles.metaLabel}>Meeting Name</span>
              <span style={styles.metaValue}>{meetingTitle || 'Executive Session'}</span>
            </div>

            <div style={styles.metaDivider} />

            <div style={styles.metaCol}>
              <span style={styles.metaLabel}>Generated Date</span>
              <span style={styles.metaValue}>
                {new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
              </span>
            </div>

            <div style={styles.metaDivider} />

            <div style={styles.metaCol}>
              <span style={styles.metaLabel}>Report Summary</span>
              <span style={styles.metaValue}>
                {summary ? `${summary.split(/\s+/).filter(Boolean).length} words extracted` : 'Pending summary'}
              </span>
            </div>

            <div style={styles.metaDivider} />

            <div style={styles.metaCol}>
              <span style={styles.metaLabel}>Status</span>
              <div style={styles.statusBadgeCompleted}>
                <CheckCircle2 size={13} style={{ marginRight: '4px' }} />
                <span>Completed</span>
              </div>
            </div>
          </div>
        )}

        {/* ================= REPORT DOSSIER CARD ================= */}
        {Boolean(summary || transcript || actionItems.length > 0) && (
          <div style={styles.reportDossier}>
          {/* Dossier Header */}
          <div style={styles.dossierTop}>
            <div>
              <span style={styles.dossierOrg}>MeetMind AI Executive Briefing</span>
              <h2 style={styles.dossierTitle}>{meetingTitle}</h2>
              <div style={styles.dossierMetaRow}>
                <span style={styles.dossierMetaItem}>
                  <Calendar size={14} style={{ marginRight: '4px' }} />
                  {new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                </span>
                <span style={styles.dossierMetaItem}>
                  <Clock size={14} style={{ marginRight: '4px' }} />
                  Full Session Record
                </span>
              </div>
            </div>

            <div style={styles.categoryPill}>
              <Brain size={16} style={{ marginRight: '6px' }} />
              <span>{category}</span>
            </div>
          </div>

          {/* Dossier Section 1: Executive Summary */}
          <div style={styles.dossierSection}>
            <div style={styles.sectionTitleRow}>
              <div style={styles.sectionNumber}>1</div>
              <h3 style={styles.sectionHeading}>Executive Summary</h3>
              <button onClick={handleCopyReport} style={styles.copyTinyBtn} title="Copy summary text">
                {copiedReport ? <Check size={14} color="#16A34A" /> : <Copy size={14} />}
              </button>
            </div>
            <div style={styles.dossierTextWrap}>
              <div style={styles.formattedSummaryContent}>
                {summary.split('\n').map((line, idx) => {
                  const t = line.trim();
                  if (!t) return null;
                  if (t.startsWith('###')) {
                    return (
                      <h4 key={idx} style={styles.reportSubheading}>
                        {t.replace(/^###\s+/, '')}
                      </h4>
                    );
                  }
                  if (t.startsWith('•') || t.startsWith('-')) {
                    return (
                      <div key={idx} style={styles.reportBullet}>
                        <div style={styles.bulletDot} />
                        <span>{t.replace(/^[•\-*]\s*/, '')}</span>
                      </div>
                    );
                  }
                  return (
                    <p key={idx} style={styles.reportParagraph}>
                      {t}
                    </p>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Dossier Section 2: Action Items Deliverables */}
          <div style={styles.dossierSection}>
            <div style={styles.sectionTitleRow}>
              <div style={styles.sectionNumber}>2</div>
              <h3 style={styles.sectionHeading}>Actionable Deliverables & Responsibilities</h3>
            </div>
            <div style={styles.actionTable}>
              {actionItems.map((item, i) => (
                <div key={item.id || i} style={styles.actionTableRow}>
                  <div style={styles.actionStatusIcon}>
                    <CheckCircle2 size={16} color={item.status === 'Completed' ? '#10B981' : '#CBD5E1'} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <span style={styles.actionTaskText}>{item.task}</span>
                    <div style={styles.actionMeta}>
                      <span>Assignee: {item.assignee || 'Lead'}</span>
                      <span>•</span>
                      <span style={{ color: item.priority === 'High' ? '#DC2626' : '#6366F1' }}>
                        {item.priority || 'Normal'} Priority
                      </span>
                    </div>
                  </div>
                  <span style={styles.statusTag}>{item.status || 'Pending'}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Dossier Section 3: Transcription Excerpt */}
          <div style={styles.dossierSection}>
            <div style={styles.sectionTitleRow}>
              <div style={styles.sectionNumber}>3</div>
              <h3 style={styles.sectionHeading}>Meeting Transcript Excerpt</h3>
            </div>
            <div style={styles.transcriptBox}>
              <p style={styles.transcriptContent}>{transcript || 'No transcript text provided.'}</p>
            </div>
          </div>
        </div>
        )}

        {/* Footer Actions */}
        <div style={styles.footerRow}>
          <button onClick={() => navigate('/classification')} style={styles.backBtn}>
            <ArrowLeft size={16} style={{ marginRight: '8px' }} />
            <span>Back to Classification</span>
          </button>
          <button onClick={() => navigate('/upload')} style={styles.newMeetingBtn}>
            <span>Process Another Meeting</span>
          </button>
        </div>

        {/* Executive Report Preview Modal */}
        {showPreviewModal && (
          <div style={styles.modalOverlay} onClick={() => setShowPreviewModal(false)}>
            <div style={styles.modalBox} onClick={(e) => e.stopPropagation()}>
              <div style={styles.modalHeader}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Eye size={20} color="#6366F1" />
                  <h3 style={{ margin: 0, fontSize: '1.15rem', color: '#0F172A', fontWeight: 800 }}>
                    Executive Report Preview
                  </h3>
                </div>
                <button onClick={() => setShowPreviewModal(false)} style={styles.modalCloseBtn}>
                  <X size={18} />
                </button>
              </div>

              <div style={{ padding: '20px 0', maxHeight: '65vh', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div style={{ padding: '12px 16px', background: '#F8FAFC', borderRadius: '12px', border: '1px solid #E2E8F0' }}>
                  <h4 style={{ margin: '0 0 4px 0', color: '#0F172A' }}>{meetingTitle || 'Meeting Intelligence Brief'}</h4>
                  <span style={{ fontSize: '0.80rem', color: '#64748B' }}>
                    Category: {category || 'General'} • Generated: {new Date().toLocaleDateString()} • Status: Completed
                  </span>
                </div>

                <div>
                  <h5 style={{ margin: '0 0 6px 0', fontSize: '0.88rem', fontWeight: 700, color: '#4F46E5', textTransform: 'uppercase' }}>
                    Executive Summary
                  </h5>
                  <p style={{ fontSize: '0.88rem', color: '#334155', lineHeight: 1.6, whiteSpace: 'pre-wrap', margin: 0 }}>
                    {summary || 'No summary available.'}
                  </p>
                </div>

                {actionItems.length > 0 && (
                  <div>
                    <h5 style={{ margin: '0 0 8px 0', fontSize: '0.88rem', fontWeight: 700, color: '#059669', textTransform: 'uppercase' }}>
                      Action Deliverables ({actionItems.length})
                    </h5>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      {actionItems.map((item, idx) => (
                        <div key={idx} style={{ padding: '8px 12px', background: '#F8FAFC', borderRadius: '8px', border: '1px solid #E2E8F0', fontSize: '0.84rem' }}>
                          <span style={{ fontWeight: 600 }}>{idx + 1}. {item.task}</span>
                          <div style={{ fontSize: '0.74rem', color: '#64748B', marginTop: '2px' }}>
                            Status: {item.status} • Assignee: {item.assignee} • Priority: {item.priority}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', paddingTop: '12px', borderTop: '1px solid #F1F5F9' }}>
                <button onClick={() => setShowPreviewModal(false)} style={styles.modalCancelBtn}>
                  Close
                </button>
                <button onClick={() => { setShowPreviewModal(false); handleDownloadPDF(); }} style={styles.modalPrintBtn}>
                  <Download size={14} style={{ marginRight: '6px' }} />
                  <span>Print / Save PDF</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </SidebarLayout>
  );
};

const styles: { [key: string]: React.CSSProperties } = {
  contentContainer: {
    display: 'flex',
    flexDirection: 'column',
    gap: '28px',
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
  },
  downloadPdfBtn: {
    display: 'inline-flex',
    alignItems: 'center',
    padding: '11px 20px',
    borderRadius: '12px',
    background: 'linear-gradient(135deg, #6366F1, #8B5CF6)',
    color: '#FFFFFF',
    fontWeight: 700,
    fontSize: '0.88rem',
    border: 'none',
    cursor: 'pointer',
    boxShadow: '0 4px 12px rgba(99, 102, 241, 0.25)',
  },
  exportReportBtn: {
    display: 'inline-flex',
    alignItems: 'center',
    padding: '11px 18px',
    borderRadius: '12px',
    background: '#FFFFFF',
    border: '1px solid #CBD5E1',
    color: '#334155',
    fontWeight: 600,
    fontSize: '0.88rem',
    cursor: 'pointer',
  },
  successBanner: {
    display: 'flex',
    alignItems: 'center',
    padding: '12px 18px',
    background: '#F0FDF4',
    border: '1px solid #BBF7D0',
    color: '#15803D',
    borderRadius: '12px',
    fontSize: '0.88rem',
    fontWeight: 600,
  },
  reportDossier: {
    background: '#FFFFFF',
    border: '1px solid #E2E8F0',
    borderRadius: '24px',
    padding: '36px',
    boxShadow: '0 6px 20px rgba(0, 0, 0, 0.03)',
    display: 'flex',
    flexDirection: 'column',
    gap: '32px',
  },
  dossierTop: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    flexWrap: 'wrap',
    gap: '16px',
    borderBottom: '2px solid #F1F5F9',
    paddingBottom: '24px',
  },
  dossierOrg: {
    fontSize: '0.74rem',
    fontWeight: 800,
    color: '#6366F1',
    textTransform: 'uppercase',
    letterSpacing: '0.08em',
  },
  dossierTitle: {
    fontSize: '1.65rem',
    fontWeight: 800,
    color: '#0F172A',
    margin: '4px 0 8px 0',
  },
  dossierMetaRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '16px',
  },
  dossierMetaItem: {
    display: 'flex',
    alignItems: 'center',
    fontSize: '0.82rem',
    color: '#64748B',
    fontWeight: 500,
  },
  categoryPill: {
    display: 'inline-flex',
    alignItems: 'center',
    background: '#EEF2FF',
    color: '#4F46E5',
    padding: '6px 16px',
    borderRadius: '20px',
    fontWeight: 700,
    fontSize: '0.86rem',
  },
  dossierSection: {
    display: 'flex',
    flexDirection: 'column',
    gap: '14px',
  },
  sectionTitleRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
  },
  sectionNumber: {
    width: '26px',
    height: '26px',
    borderRadius: '8px',
    background: '#6366F1',
    color: '#FFFFFF',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '0.8rem',
    fontWeight: 800,
  },
  sectionHeading: {
    fontSize: '1.18rem',
    fontWeight: 700,
    color: '#0F172A',
    margin: 0,
    flex: 1,
  },
  copyTinyBtn: {
    background: 'none',
    border: '1px solid #E2E8F0',
    borderRadius: '8px',
    padding: '5px',
    color: '#64748B',
    cursor: 'pointer',
  },
  dossierTextWrap: {
    background: '#FAFAFD',
    border: '1px solid #EEF2FF',
    borderRadius: '16px',
    padding: '24px 28px',
  },
  formattedSummaryContent: {
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
  },
  reportSubheading: {
    fontSize: '1rem',
    fontWeight: 700,
    color: '#4F46E5',
    margin: '12px 0 4px 0',
  },
  reportBullet: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: '10px',
    fontSize: '0.94rem',
    lineHeight: 1.6,
    color: '#1E293B',
  },
  bulletDot: {
    width: '6px',
    height: '6px',
    borderRadius: '50%',
    background: '#6366F1',
    marginTop: '8px',
    flexShrink: 0,
  },
  reportParagraph: {
    fontSize: '0.94rem',
    lineHeight: 1.65,
    color: '#334155',
    margin: 0,
  },
  actionTable: {
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
  },
  actionTableRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '14px',
    padding: '14px 18px',
    background: '#F8FAFC',
    border: '1px solid #E2E8F0',
    borderRadius: '14px',
  },
  actionStatusIcon: {
    display: 'flex',
    alignItems: 'center',
  },
  actionTaskText: {
    fontSize: '0.92rem',
    fontWeight: 600,
    color: '#1E293B',
    display: 'block',
  },
  actionMeta: {
    fontSize: '0.78rem',
    color: '#64748B',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    marginTop: '3px',
  },
  statusTag: {
    fontSize: '0.76rem',
    fontWeight: 700,
    padding: '3px 10px',
    background: '#FFFFFF',
    border: '1px solid #E2E8F0',
    borderRadius: '10px',
    color: '#475569',
  },
  transcriptBox: {
    background: '#F8FAFC',
    border: '1px solid #E2E8F0',
    borderRadius: '14px',
    padding: '16px 20px',
    maxHeight: '160px',
    overflowY: 'auto',
  },
  transcriptContent: {
    fontSize: '0.88rem',
    lineHeight: 1.6,
    color: '#475569',
    margin: 0,
    whiteSpace: 'pre-wrap',
  },
  footerRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: '14px',
  },
  backBtn: {
    display: 'flex',
    alignItems: 'center',
    padding: '10px 18px',
    background: '#FFFFFF',
    border: '1px solid #CBD5E1',
    borderRadius: '12px',
    color: '#475569',
    fontSize: '0.86rem',
    fontWeight: 600,
    cursor: 'pointer',
  },
  newMeetingBtn: {
    display: 'flex',
    alignItems: 'center',
    padding: '11px 22px',
    background: 'linear-gradient(135deg, #6366F1, #8B5CF6)',
    color: '#FFFFFF',
    borderRadius: '12px',
    border: 'none',
    fontWeight: 700,
    fontSize: '0.88rem',
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
  previewBtn: {
    display: 'inline-flex',
    alignItems: 'center',
    padding: '11px 18px',
    borderRadius: '12px',
    background: '#FFFFFF',
    border: '1px solid #CBD5E1',
    color: '#334155',
    fontWeight: 600,
    fontSize: '0.88rem',
    cursor: 'pointer',
    boxShadow: '0 1px 3px rgba(0, 0, 0, 0.04)',
    transition: 'all 0.15s ease',
  },
  shareReportBtn: {
    display: 'inline-flex',
    alignItems: 'center',
    padding: '11px 18px',
    borderRadius: '12px',
    background: '#FFFFFF',
    border: '1px solid #CBD5E1',
    color: '#334155',
    fontWeight: 600,
    fontSize: '0.88rem',
    cursor: 'pointer',
    boxShadow: '0 1px 3px rgba(0, 0, 0, 0.04)',
    transition: 'all 0.15s ease',
  },
  metaBanner: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-around',
    flexWrap: 'wrap',
    gap: '14px',
    padding: '16px 24px',
    background: '#FFFFFF',
    border: '1px solid #E2E8F0',
    borderRadius: '16px',
    boxShadow: '0 2px 6px rgba(0, 0, 0, 0.02)',
  },
  metaCol: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '4px',
  },
  metaDivider: {
    width: '1px',
    height: '28px',
    background: '#E2E8F0',
  },
  metaLabel: {
    fontSize: '0.72rem',
    fontWeight: 700,
    color: '#64748B',
    textTransform: 'uppercase',
    letterSpacing: '0.04em',
  },
  metaValue: {
    fontSize: '0.92rem',
    fontWeight: 700,
    color: '#0F172A',
  },
  statusBadgeCompleted: {
    display: 'inline-flex',
    alignItems: 'center',
    padding: '3px 10px',
    borderRadius: '12px',
    background: '#ECFDF5',
    border: '1px solid #A7F3D0',
    color: '#059669',
    fontSize: '0.78rem',
    fontWeight: 700,
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
    maxWidth: '680px',
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
  modalCancelBtn: {
    padding: '8px 18px',
    borderRadius: '10px',
    border: '1px solid #CBD5E1',
    background: '#FFFFFF',
    color: '#475569',
    fontWeight: 600,
    fontSize: '0.84rem',
    cursor: 'pointer',
  },
  modalPrintBtn: {
    display: 'inline-flex',
    alignItems: 'center',
    padding: '8px 18px',
    borderRadius: '10px',
    border: 'none',
    background: 'linear-gradient(135deg, #6366F1, #8B5CF6)',
    color: '#FFFFFF',
    fontWeight: 600,
    fontSize: '0.84rem',
    cursor: 'pointer',
  },
};
