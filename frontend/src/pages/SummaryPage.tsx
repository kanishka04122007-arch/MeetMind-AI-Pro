import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  Sparkles,
  FileText,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
  Copy,
  Check,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  FileCheck,
  Mic,
  ListChecks,
  ShieldAlert,
  Cpu,
  BookmarkCheck,
  Download,
  Clock,
} from 'lucide-react';
import { SidebarLayout } from '../components/SidebarLayout';
import { authApi } from '../api/auth';
import { meetingsApi, type MeetingSummaryItem } from '../api/meetings';
import { notificationService } from '../services/notificationService';

export const SummaryPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();

  const navState = (location.state as {
    transcript?: string;
    file_id?: string;
    title?: string;
    source_type?: 'pdf' | 'audio' | string;
  } | null) || {};

  // Source state (Extracted PDF Text or Audio Transcript)
  const [transcript, setTranscript] = useState<string>('');
  const [fileId, setFileId] = useState<string>('');
  const [meetingTitle, setMeetingTitle] = useState<string>('');
  const [sourceType, setSourceType] = useState<string>('pdf');

  // UI state
  const [isTranscriptExpanded, setIsTranscriptExpanded] = useState<boolean>(false);
  const [copiedTranscript, setCopiedTranscript] = useState<boolean>(false);
  const [copiedSummary, setCopiedSummary] = useState<boolean>(false);

  // Summary generation state
  const [loading, setLoading] = useState<boolean>(false);
  const [summaryData, setSummaryData] = useState<MeetingSummaryItem | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    const user = authApi.getCurrentUser();
    const token = authApi.getToken();

    if (!user || !token) {
      navigate('/');
      return;
    }

    const isPlaceholderText = (t?: string | null): boolean => {
      if (!t) return false;
      const l = t.toLowerCase();
      return (
        l.includes('scanned document') ||
        l.includes('visual materials indexed') ||
        l.includes('document overview') ||
        l.includes('[extracted document overview]')
      );
    };

    // 1. Check passed router state
    if (navState.transcript && navState.transcript.trim() && !isPlaceholderText(navState.transcript)) {
      setTranscript(navState.transcript);
      if (navState.file_id) setFileId(navState.file_id);
      if (navState.title) setMeetingTitle(navState.title);
      if (navState.source_type) setSourceType(navState.source_type);
      return;
    }

    // 2. Check localStorage cache
    try {
      const currentUser = authApi.getCurrentUser();
      const currentUserId = currentUser?.id || currentUser?._id;
      const cached = localStorage.getItem('meetmind_active_transcript');
      if (cached) {
        const parsed = JSON.parse(cached);
        if (parsed?.userId && parsed.userId !== currentUserId) {
          localStorage.removeItem('meetmind_active_transcript');
        } else if (parsed.transcript && !isPlaceholderText(parsed.transcript)) {
          setTranscript(parsed.transcript);
          if (parsed.file_id) setFileId(parsed.file_id);
          if (parsed.title) setMeetingTitle(parsed.title);
          if (parsed.source_type) setSourceType(parsed.source_type);
          return;
        } else if (isPlaceholderText(parsed.transcript)) {
          localStorage.removeItem('meetmind_active_transcript');
        }
      }
    } catch {
      // ignore
    }

    // 3. Auto-fetch latest extracted text from MongoDB
    const fetchLatestSource = async () => {
      try {
        const docs = await meetingsApi.listDocuments();
        if (Array.isArray(docs) && docs.length > 0) {
          const validDoc = docs.find((d) => d.extracted_text && !isPlaceholderText(d.extracted_text));
          if (validDoc && validDoc.extracted_text) {
            setTranscript(validDoc.extracted_text);
            setFileId(validDoc.id || (validDoc as any)._id || '');
            setMeetingTitle(validDoc.title || validDoc.fileName || 'Uploaded PDF Document');
            setSourceType('pdf');
            return;
          }
        }
        const audios = await meetingsApi.listMeetings();
        if (Array.isArray(audios) && audios.length > 0) {
          const latestAudio = audios[0];
          const text = latestAudio.transcript_text || latestAudio.transcript;
          if (text && !isPlaceholderText(text)) {
            setTranscript(text);
            setFileId(latestAudio.id || (latestAudio as any)._id || '');
            setMeetingTitle(latestAudio.title || latestAudio.fileName || 'Audio Recording');
            setSourceType('audio');
            return;
          }
        }
      } catch (err) {
        console.warn('Could not auto-fetch latest source:', err);
      }
    };

    fetchLatestSource();
  }, [navigate]);

  const handleCopyTranscript = () => {
    if (!transcript) return;
    navigator.clipboard.writeText(transcript);
    setCopiedTranscript(true);
    setTimeout(() => setCopiedTranscript(false), 2000);
  };

  const handleCopySummary = () => {
    if (!summaryData?.summary) return;
    navigator.clipboard.writeText(summaryData.summary);
    setCopiedSummary(true);
    setTimeout(() => setCopiedSummary(false), 2000);
  };

  const handleDownloadSummary = () => {
    if (!summaryData?.summary) return;
    const dateStr = summaryData.created_at ? new Date(summaryData.created_at).toLocaleString() : new Date().toLocaleString();
    const count = summaryData.word_count || summaryData.summary.split(/\s+/).filter(Boolean).length;
    const content = `# Executive Summary: ${meetingTitle || 'Meeting Intelligence Brief'}\n\nGenerated: ${dateStr}\nWord Count: ${count}\nStatus: Completed\nSource: ${sourceType === 'audio' ? 'Audio Recording' : 'PDF Document'}\n\n---\n\n${summaryData.summary}`;
    const blob = new Blob([content], { type: 'text/markdown;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `${(meetingTitle || 'meeting_summary').toLowerCase().replace(/[^a-z0-9]/gi, '_')}.md`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    const currentUser = authApi.getCurrentUser();
    if (currentUser?.id) {
      notificationService.addNotification(currentUser.id, {
        type: 'summary',
        title: 'Summary Downloaded',
        message: `Executive meeting summary downloaded for "${meetingTitle || 'Meeting'}"`,
      });
    }
  };

  // Generate Summary API Call
  const handleGenerateSummary = async () => {
    setLoading(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      const response = await meetingsApi.generateSummary(
        fileId || undefined,
        transcript || undefined,
        meetingTitle || undefined
      );

      setSummaryData(response);
      if (response.source_text && (!transcript || transcript.length < 50)) {
        setTranscript(response.source_text);
      }
      if (response.title) {
        setMeetingTitle(response.title);
      }
      if (response.source_type) {
        setSourceType(response.source_type);
      }
      if (response.file_id || response.meeting_id) {
        setFileId(response.file_id || response.meeting_id || '');
      }

      setSuccessMsg('Smart summary generated successfully.');

      const currentUser = authApi.getCurrentUser();
      if (currentUser?.id) {
        notificationService.addNotification(currentUser.id, {
          type: 'summary',
          title: 'Summary Generated',
          message: `Smart AI summary generated for "${response.title || meetingTitle || 'Meeting'}" (${response.word_count || '400+'} words).`,
        });
      }
    } catch (err: any) {
      console.error('Failed to generate summary:', err);
      const msg = err?.response?.data?.detail || err?.response?.data?.error || 'Unable to generate Smart Summary.';
      setErrorMsg(msg);
    } finally {
      setLoading(false);
    }
  };

  // Navigate to Action Items page
  const handleContinueToActionItems = () => {
    const currentUser = authApi.getCurrentUser();
    const currentUserId = currentUser?.id || currentUser?._id;
    const payload = {
      transcript: transcript,
      summary: summaryData?.summary || '',
      key_points: summaryData?.key_points || [],
      file_id: fileId,
      title: meetingTitle || 'Meeting Summary',
      userId: currentUserId,
    };

    try {
      localStorage.setItem('meetmind_active_summary', JSON.stringify(payload));
    } catch {
      // ignore
    }

    navigate('/action-items', { state: payload });
  };

  const getTranscriptPreview = () => {
    if (!transcript) return '';
    const sentences = transcript.split(/(?<=[.!?])\s+/);
    if (sentences.length <= 4) return transcript;
    return sentences.slice(0, 4).join(' ') + '...';
  };

  // Render structured 6-section summary
  const renderStructuredSummary = (summaryText: string) => {
    const sectionRegex = /###\s+([0-9]+\.\s+[^]+?)(?=\n###|\Z)/g;
    const rawMatches = Array.from(summaryText.matchAll(sectionRegex));

    if (rawMatches.length === 0) {
      // Split by double newline as fallback
      const blocks = summaryText.split('\n\n').filter((b) => b.trim());
      return (
        <div style={styles.plainSummaryBlock}>
          {blocks.map((block, idx) => (
            <p key={idx} style={styles.paragraphRow}>
              {block}
            </p>
          ))}
        </div>
      );
    }

    return (
      <div style={styles.structuredGrid}>
        {rawMatches.map((m, idx) => {
          const rawBlock = m[1].trim();
          const firstLineBreak = rawBlock.indexOf('\n');
          let heading = '';
          let body = '';

          if (firstLineBreak !== -1) {
            heading = rawBlock.slice(0, firstLineBreak).trim();
            body = rawBlock.slice(firstLineBreak).trim();
          } else {
            heading = rawBlock;
            body = '';
          }

          const headingClean = heading.replace(/^[0-9]+\.\s*/, '');
          const isOverview = heading.toLowerCase().includes('overview');
          const isDiscussion = heading.toLowerCase().includes('discussion');
          const isDecisions = heading.toLowerCase().includes('decisions');
          const isTech = heading.toLowerCase().includes('technical');
          const isRisks = heading.toLowerCase().includes('risks');

          const icon = isOverview ? (
            <BookmarkCheck size={18} color="#4F46E5" />
          ) : isDiscussion ? (
            <FileText size={18} color="#7C3AED" />
          ) : isDecisions ? (
            <CheckCircle2 size={18} color="#059669" />
          ) : isTech ? (
            <Cpu size={18} color="#0284C7" />
          ) : isRisks ? (
            <ShieldAlert size={18} color="#D97706" />
          ) : (
            <ListChecks size={18} color="#10B981" />
          );

          const lines = body.split('\n').filter((l) => l.trim().length > 0);

          return (
            <div key={idx} style={styles.sectionCard}>
              <div style={styles.sectionHeader}>
                <div style={styles.sectionHeaderIcon}>{icon}</div>
                <h4 style={styles.sectionTitle}>{headingClean}</h4>
              </div>

              <div style={styles.sectionContent}>
                {lines.map((line, lIdx) => {
                  const t = line.trim();
                  const isBullet = t.startsWith('•') || t.startsWith('-') || t.startsWith('*');
                  const cleanText = t.replace(/^[•\-*]\s*/, '');

                  if (isBullet) {
                    return (
                      <div key={lIdx} style={styles.bulletItem}>
                        <span style={styles.bulletSymbol}>•</span>
                        <span style={styles.bulletText}>{cleanText}</span>
                      </div>
                    );
                  }

                  return (
                    <p key={lIdx} style={styles.paragraphRow}>
                      {t}
                    </p>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  const wordCount = transcript ? transcript.split(/\s+/).filter(Boolean).length : 0;

  return (
    <SidebarLayout>
      <div style={styles.contentContainer}>
        {/* Header Row */}
        <div style={styles.headerRow}>
          <div>
            <div style={styles.badgePill}>
              <Sparkles size={14} color="#6366F1" style={{ marginRight: '6px' }} />
              <span>Step 2: Executive Intelligence Briefing</span>
            </div>
            <h1 style={styles.pageTitle}>AI Meeting Summary</h1>
            <p style={styles.pageSubtitle}>
              Synthesize 400-600 word executive intelligence from verified PDF documents and audio recordings.
            </p>
          </div>

          {meetingTitle && (
            <div style={styles.meetingSourceBadge}>
              <span style={styles.sourceLabel}>Active Meeting</span>
              <span style={styles.sourceTitle}>{meetingTitle}</span>
            </div>
          )}
        </div>

        {/* SECTION 1: Source Content */}
        <section style={styles.card}>
          <div style={styles.cardHeader}>
            <div style={styles.cardHeaderLeft}>
              <div style={styles.cardIconWrap}>
                {sourceType === 'audio' ? (
                  <Mic size={22} color="#6366F1" />
                ) : (
                  <FileText size={22} color="#6366F1" />
                )}
              </div>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <h3 style={styles.cardTitle}>Source Content</h3>
                  <span style={styles.sourceTypeBadge}>
                    {sourceType === 'audio' ? 'Audio Transcript' : 'PDF Extracted Text'}
                  </span>
                  {wordCount > 0 && (
                    <span style={styles.wordCountBadge}>{wordCount} words</span>
                  )}
                </div>
                <p style={styles.cardDesc}>
                  Raw verified content extracted from meeting recording or project document
                </p>
              </div>
            </div>

            <div style={styles.cardActions}>
              {transcript && (
                <button
                  onClick={handleCopyTranscript}
                  style={styles.ghostBtn}
                  title="Copy full source content"
                >
                  {copiedTranscript ? (
                    <>
                      <Check size={14} color="#16A34A" style={{ marginRight: '6px' }} />
                      <span style={{ color: '#16A34A' }}>Copied</span>
                    </>
                  ) : (
                    <>
                      <Copy size={14} style={{ marginRight: '6px' }} />
                      <span>Copy Text</span>
                    </>
                  )}
                </button>
              )}
            </div>
          </div>

          <div style={styles.cardBody}>
            {transcript ? (
              <>
                <div style={styles.transcriptScrollArea}>
                  <p style={styles.transcriptText}>
                    {isTranscriptExpanded ? transcript : getTranscriptPreview()}
                  </p>
                </div>

                {transcript.length > 200 && (
                  <div style={styles.toggleRow}>
                    <button
                      onClick={() => setIsTranscriptExpanded(!isTranscriptExpanded)}
                      style={styles.expandToggleBtn}
                      id="toggle-full-source-btn"
                    >
                      {isTranscriptExpanded ? (
                        <>
                          <ChevronUp size={16} style={{ marginRight: '6px' }} />
                          <span>Collapse Source Content</span>
                        </>
                      ) : (
                        <>
                          <ChevronDown size={16} style={{ marginRight: '6px' }} />
                          <span>View Full Source Content ({wordCount} words)</span>
                        </>
                      )}
                    </button>
                  </div>
                )}
              </>
            ) : (
              <div style={styles.emptySourceNotice}>
                <FileCheck size={28} color="#94A3B8" style={{ marginBottom: '8px' }} />
                <span style={{ fontSize: '0.92rem', color: '#64748B', fontWeight: 600 }}>
                  No documents uploaded yet.
                </span>
                <span style={{ fontSize: '0.82rem', color: '#94A3B8' }}>
                  Upload a PDF document or audio recording to generate AI summaries.
                </span>
              </div>
            )}
          </div>
        </section>

        {/* SECTION 2: AI Generated Summary */}
        <section style={styles.card}>
          <div style={styles.cardHeader}>
            <div style={styles.cardHeaderLeft}>
              <div style={{ ...styles.cardIconWrap, background: '#F5F3FF' }}>
                <Sparkles size={22} color="#8B5CF6" />
              </div>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <h3 style={styles.cardTitle}>Smart Summary</h3>
                  <span style={styles.aiModelBadge}>AI Engine • Meeting Intelligence</span>
                  {summaryData?.word_count ? (
                    <span style={styles.wordCountBadge}>{summaryData.word_count} words</span>
                  ) : null}
                </div>
                <p style={styles.cardDesc}>
                  Structured executive intelligence briefing divided into key strategic analytical domains
                </p>
              </div>
            </div>

            {summaryData && (
              <div style={styles.cardActions}>
                <button
                  onClick={handleCopySummary}
                  style={styles.ghostBtn}
                  title="Copy Smart Summary"
                  id="copy-summary-top-btn"
                >
                  {copiedSummary ? (
                    <>
                      <Check size={14} color="#16A34A" style={{ marginRight: '6px' }} />
                      <span style={{ color: '#16A34A' }}>Copied</span>
                    </>
                  ) : (
                    <>
                      <Copy size={14} style={{ marginRight: '6px' }} />
                      <span>Copy Summary</span>
                    </>
                  )}
                </button>
                <button
                  onClick={handleDownloadSummary}
                  style={styles.ghostBtn}
                  title="Download Summary File"
                  id="download-summary-top-btn"
                >
                  <Download size={14} style={{ marginRight: '6px' }} />
                  <span>Download Summary</span>
                </button>
              </div>
            )}
          </div>

          <div style={styles.cardBody}>
            {successMsg && (
              <div style={styles.successAlert} role="status">
                <CheckCircle2 size={18} color="#16A34A" style={{ marginRight: '10px', flexShrink: 0 }} />
                <span>{successMsg}</span>
              </div>
            )}

            {errorMsg && (
              <div style={styles.errorAlert} role="alert">
                <AlertCircle size={18} color="#DC2626" style={{ marginRight: '10px', flexShrink: 0 }} />
                <span>{errorMsg}</span>
              </div>
            )}

            {/* Summary Information Card */}
            {summaryData && (
              <div style={styles.summaryMetaCard}>
                <div style={styles.summaryMetaCol}>
                  <div style={styles.metaLabel}>
                    <Clock size={13} style={{ marginRight: '5px' }} />
                    <span>Generated Time</span>
                  </div>
                  <div style={styles.metaVal}>
                    {summaryData.created_at ? new Date(summaryData.created_at).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' }) : new Date().toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}
                  </div>
                </div>

                <div style={styles.summaryMetaDivider} />

                <div style={styles.summaryMetaCol}>
                  <div style={styles.metaLabel}>
                    <FileText size={13} style={{ marginRight: '5px' }} />
                    <span>Word Count</span>
                  </div>
                  <div style={styles.metaVal}>
                    {summaryData.word_count || (summaryData.summary ? summaryData.summary.split(/\s+/).filter(Boolean).length : 0)} words
                  </div>
                </div>

                <div style={styles.summaryMetaDivider} />

                <div style={styles.summaryMetaCol}>
                  <div style={styles.metaLabel}>
                    <CheckCircle2 size={13} style={{ marginRight: '5px', color: '#10B981' }} />
                    <span>Status</span>
                  </div>
                  <div style={{ ...styles.metaVal, color: '#059669', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#10B981' }} />
                    <span>Completed</span>
                  </div>
                </div>
              </div>
            )}

            {!summaryData && !loading && (
              <div style={styles.emptyStateContainer}>
                <div style={styles.emptyStateIconWrap}>
                  <Sparkles size={32} color="#8B5CF6" />
                </div>
                <h3 style={styles.emptyStateHeading}>No summary generated yet.</h3>
                <p style={styles.emptyStateSubtext}>
                  Click "Generate Summary" below to run the Smart Summary AI Engine on the verified meeting content.
                </p>
              </div>
            )}

            {loading && (
              <div style={styles.loadingContainer}>
                <RefreshCw
                  size={32}
                  className="animate-spin"
                  color="#6366F1"
                  style={{ marginBottom: '14px' }}
                />
                <span style={styles.loadingText}>Synthesizing Smart Summary...</span>
                <p style={styles.loadingSub}>
                  Activating Smart AI Engine, analyzing executive key points, and structuring intelligence domains...
                </p>
              </div>
            )}

            {summaryData && !loading && (
              <div style={styles.summaryResultBox}>
                {renderStructuredSummary(summaryData.summary)}
              </div>
            )}

            {/* Action Buttons Bar */}
            <div style={styles.actionButtonBar}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                <button
                  onClick={handleGenerateSummary}
                  disabled={loading}
                  style={{
                    ...styles.generateBtn,
                    opacity: loading ? 0.75 : 1,
                    cursor: loading ? 'not-allowed' : 'pointer',
                  }}
                  id="generate-summary-btn"
                >
                  {loading ? (
                    <>
                      <RefreshCw size={17} className="animate-spin" style={{ marginRight: '8px' }} />
                      <span>Generating Summary...</span>
                    </>
                  ) : summaryData ? (
                    <>
                      <RefreshCw size={17} style={{ marginRight: '8px' }} />
                      <span>Regenerate Summary</span>
                    </>
                  ) : (
                    <>
                      <Sparkles size={17} style={{ marginRight: '8px' }} />
                      <span>Generate Summary</span>
                    </>
                  )}
                </button>

                {summaryData && (
                  <>
                    <button
                      onClick={handleCopySummary}
                      style={styles.actionSecondaryBtn}
                      id="copy-summary-bottom-btn"
                    >
                      {copiedSummary ? (
                        <>
                          <Check size={16} color="#16A34A" style={{ marginRight: '6px' }} />
                          <span style={{ color: '#16A34A' }}>Copied</span>
                        </>
                      ) : (
                        <>
                          <Copy size={16} style={{ marginRight: '6px' }} />
                          <span>Copy Summary</span>
                        </>
                      )}
                    </button>

                    <button
                      onClick={handleDownloadSummary}
                      style={styles.actionSecondaryBtn}
                      id="download-summary-bottom-btn"
                    >
                      <Download size={16} style={{ marginRight: '6px' }} />
                      <span>Download Summary</span>
                    </button>
                  </>
                )}
              </div>

              {summaryData && (
                <button
                  onClick={handleContinueToActionItems}
                  style={styles.continueBtn}
                  id="continue-to-action-items-btn"
                >
                  <span>Continue to Action Items</span>
                  <ArrowRight size={18} style={{ marginLeft: '10px' }} />
                </button>
              )}
            </div>
          </div>
        </section>
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
  meetingSourceBadge: {
    background: '#FFFFFF',
    border: '1px solid #E2E8F0',
    borderRadius: '16px',
    padding: '10px 18px',
    display: 'flex',
    flexDirection: 'column',
    boxShadow: '0 2px 6px rgba(0, 0, 0, 0.02)',
  },
  sourceLabel: {
    fontSize: '0.70rem',
    color: '#64748B',
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
  },
  sourceTitle: {
    fontSize: '0.92rem',
    fontWeight: 700,
    color: '#1E293B',
    marginTop: '2px',
  },
  card: {
    background: '#FFFFFF',
    border: '1px solid #E2E8F0',
    borderRadius: '24px',
    padding: '28px',
    boxShadow: '0 4px 14px rgba(0, 0, 0, 0.03)',
    display: 'flex',
    flexDirection: 'column',
    gap: '20px',
  },
  cardHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: '16px',
    paddingBottom: '16px',
    borderBottom: '1px solid #F1F5F9',
  },
  cardHeaderLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: '14px',
  },
  cardIconWrap: {
    width: '46px',
    height: '46px',
    borderRadius: '14px',
    background: '#EEF2FF',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  cardTitle: {
    fontSize: '1.2rem',
    fontWeight: 700,
    color: '#0F172A',
    margin: 0,
  },
  cardDesc: {
    fontSize: '0.84rem',
    color: '#64748B',
    margin: '3px 0 0 0',
  },
  sourceTypeBadge: {
    fontSize: '0.74rem',
    fontWeight: 700,
    color: '#4F46E5',
    background: '#EEF2FF',
    border: '1px solid #C7D2FE',
    padding: '2px 8px',
    borderRadius: '10px',
  },
  aiModelBadge: {
    fontSize: '0.74rem',
    fontWeight: 700,
    color: '#7C3AED',
    background: '#F5F3FF',
    border: '1px solid #DDD6FE',
    padding: '2px 8px',
    borderRadius: '10px',
  },
  wordCountBadge: {
    fontSize: '0.74rem',
    fontWeight: 600,
    color: '#059669',
    background: '#ECFDF5',
    border: '1px solid #A7F3D0',
    padding: '2px 8px',
    borderRadius: '10px',
  },
  cardActions: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  ghostBtn: {
    display: 'flex',
    alignItems: 'center',
    background: '#F8FAFC',
    border: '1px solid #E2E8F0',
    borderRadius: '10px',
    padding: '7px 12px',
    fontSize: '0.82rem',
    fontWeight: 600,
    color: '#475569',
    cursor: 'pointer',
  },
  cardBody: {
    display: 'flex',
    flexDirection: 'column',
    gap: '18px',
  },
  transcriptScrollArea: {
    background: '#F8FAFC',
    border: '1px solid #E2E8F0',
    borderRadius: '16px',
    padding: '18px 22px',
    maxHeight: '220px',
    overflowY: 'auto',
  },
  transcriptText: {
    fontSize: '0.92rem',
    lineHeight: 1.7,
    color: '#334155',
    margin: 0,
    whiteSpace: 'pre-wrap',
  },
  toggleRow: {
    display: 'flex',
    justifyContent: 'center',
    marginTop: '-6px',
  },
  expandToggleBtn: {
    display: 'flex',
    alignItems: 'center',
    background: '#FFFFFF',
    border: '1px solid #CBD5E1',
    borderRadius: '20px',
    padding: '7px 16px',
    fontSize: '0.82rem',
    fontWeight: 600,
    color: '#4F46E5',
    cursor: 'pointer',
  },
  emptySourceNotice: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '30px 20px',
    background: '#F8FAFC',
    border: '1px dashed #CBD5E1',
    borderRadius: '16px',
    textAlign: 'center',
  },
  emptyStateContainer: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '48px 24px',
    background: '#FAFAFD',
    border: '2px dashed #E2E8F0',
    borderRadius: '18px',
    textAlign: 'center',
  },
  emptyStateIconWrap: {
    width: '60px',
    height: '60px',
    borderRadius: '18px',
    background: '#F5F3FF',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: '14px',
  },
  emptyStateHeading: {
    fontSize: '1.05rem',
    fontWeight: 700,
    color: '#1E293B',
    margin: '0 0 6px 0',
  },
  emptyStateSubtext: {
    fontSize: '0.88rem',
    color: '#64748B',
    margin: 0,
  },
  loadingContainer: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '44px 24px',
    background: '#FAFAFD',
    borderRadius: '18px',
    border: '1px solid #EEF2FF',
    textAlign: 'center',
  },
  loadingText: {
    fontSize: '1.1rem',
    fontWeight: 700,
    color: '#1E293B',
  },
  loadingSub: {
    fontSize: '0.86rem',
    color: '#64748B',
    margin: '6px 0 0 0',
    maxWidth: '540px',
  },
  summaryResultBox: {
    background: '#FAFAFD',
    border: '1px solid #E0E7FF',
    borderRadius: '20px',
    padding: '24px',
  },
  structuredGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))',
    gap: '20px',
  },
  sectionCard: {
    background: '#FFFFFF',
    border: '1px solid #E2E8F0',
    borderRadius: '16px',
    padding: '20px 22px',
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
    boxShadow: '0 2px 6px rgba(0, 0, 0, 0.02)',
  },
  sectionHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    paddingBottom: '10px',
    borderBottom: '1px solid #F1F5F9',
  },
  sectionHeaderIcon: {
    width: '32px',
    height: '32px',
    borderRadius: '10px',
    background: '#F8FAFC',
    border: '1px solid #E2E8F0',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  sectionTitle: {
    fontSize: '0.98rem',
    fontWeight: 700,
    color: '#0F172A',
    margin: 0,
  },
  sectionContent: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  bulletItem: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: '8px',
  },
  bulletSymbol: {
    color: '#6366F1',
    fontWeight: 700,
    lineHeight: 1.4,
  },
  bulletText: {
    fontSize: '0.90rem',
    lineHeight: 1.55,
    color: '#334155',
  },
  paragraphRow: {
    fontSize: '0.90rem',
    lineHeight: 1.6,
    color: '#334155',
    margin: 0,
  },
  plainSummaryBlock: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
  },
  successAlert: {
    display: 'flex',
    alignItems: 'center',
    padding: '12px 18px',
    background: '#F0FDF4',
    border: '1px solid #BBF7D0',
    borderRadius: '12px',
    color: '#15803D',
    fontSize: '0.88rem',
    fontWeight: 600,
  },
  errorAlert: {
    display: 'flex',
    alignItems: 'center',
    padding: '12px 18px',
    background: '#FEF2F2',
    border: '1px solid #FECACA',
    borderRadius: '12px',
    color: '#B91C1C',
    fontSize: '0.88rem',
    fontWeight: 600,
  },
  actionButtonBar: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: '14px',
    paddingTop: '16px',
    borderTop: '1px solid #F1F5F9',
  },
  generateBtn: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '12px 24px',
    borderRadius: '12px',
    background: 'linear-gradient(135deg, #6366F1, #8B5CF6)',
    color: '#FFFFFF',
    fontWeight: 700,
    fontSize: '0.92rem',
    border: 'none',
    boxShadow: '0 4px 14px rgba(99, 102, 241, 0.3)',
    transition: 'all 0.2s ease',
  },
  continueBtn: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '12px 26px',
    borderRadius: '12px',
    background: 'linear-gradient(135deg, #10B981, #059669)',
    color: '#FFFFFF',
    fontWeight: 700,
    fontSize: '0.92rem',
    border: 'none',
    cursor: 'pointer',
    boxShadow: '0 4px 14px rgba(16, 185, 129, 0.3)',
    transition: 'all 0.2s ease',
  },
  actionSecondaryBtn: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '11px 18px',
    borderRadius: '12px',
    background: '#FFFFFF',
    color: '#334155',
    fontWeight: 600,
    fontSize: '0.88rem',
    border: '1px solid #CBD5E1',
    cursor: 'pointer',
    boxShadow: '0 1px 3px rgba(0, 0, 0, 0.04)',
    transition: 'all 0.15s ease',
  },
  summaryMetaCard: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-around',
    flexWrap: 'wrap',
    gap: '12px',
    padding: '14px 20px',
    background: '#F8FAFC',
    border: '1px solid #E2E8F0',
    borderRadius: '14px',
  },
  summaryMetaCol: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '4px',
  },
  summaryMetaDivider: {
    width: '1px',
    height: '28px',
    background: '#E2E8F0',
  },
  metaLabel: {
    display: 'flex',
    alignItems: 'center',
    fontSize: '0.74rem',
    fontWeight: 700,
    color: '#64748B',
    textTransform: 'uppercase',
    letterSpacing: '0.04em',
  },
  metaVal: {
    fontSize: '0.92rem',
    fontWeight: 700,
    color: '#0F172A',
  },
};
