import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  Brain,
  FileText,
  Sparkles,
  ArrowRight,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Layers,
  Award,
  HelpCircle,
  Clock,
  Compass,
  Tag,
  X,
  Info,
} from 'lucide-react';
import { SidebarLayout } from '../components/SidebarLayout';
import { meetingsApi, type ClassificationResult } from '../api/meetings';
import { authApi } from '../api/auth';
import { notificationService } from '../services/notificationService';

export const ClassificationPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();

  const navState = (location.state as {
    transcript?: string;
    summary?: string;
    action_items?: any[];
    file_id?: string;
    title?: string;
    category?: string;
  } | null) || {};

  const [meetingTitle, setMeetingTitle] = useState<string>('');
  const [summary, setSummary] = useState<string>('');
  const [transcript, setTranscript] = useState<string>('');
  const [fileId, setFileId] = useState<string>('');
  const [actionItems, setActionItems] = useState<any[]>([]);

  const [classifying, setClassifying] = useState<boolean>(false);
  const [classificationResult, setClassificationResult] = useState<ClassificationResult | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [showInsightsModal, setShowInsightsModal] = useState<boolean>(false);

  const extractDynamicKeywords = (text: string): string[] => {
    if (!text || !text.trim()) return [];

    const lowerText = text.toLowerCase();
    const stopWords = new Set([
      'a', 'about', 'above', 'after', 'again', 'against', 'all', 'am', 'an', 'and', 'any', 'are',
      'as', 'at', 'be', 'because', 'been', 'before', 'being', 'below', 'between', 'both', 'but',
      'by', 'can', 'cannot', 'could', 'did', 'do', 'does', 'doing', 'down', 'during', 'each',
      'few', 'for', 'from', 'further', 'had', 'has', 'have', 'having', 'he', 'her', 'here',
      'hers', 'herself', 'him', 'himself', 'his', 'how', 'i', 'if', 'in', 'into', 'is', 'it',
      'its', 'itself', 'just', 'me', 'more', 'most', 'my', 'myself', 'no', 'nor', 'not', 'of',
      'off', 'on', 'once', 'only', 'or', 'other', 'our', 'ours', 'ourselves', 'out', 'over',
      'own', 'same', 'she', 'should', 'so', 'some', 'such', 'than', 'that', 'the', 'their',
      'theirs', 'them', 'themselves', 'then', 'there', 'these', 'they', 'this', 'those',
      'through', 'to', 'too', 'under', 'until', 'up', 'very', 'was', 'we', 'were', 'what',
      'when', 'where', 'which', 'while', 'who', 'whom', 'why', 'with', 'you', 'your', 'yours',
      'will', 'shall', 'may', 'might', 'must', 'also', 'etc', 'well', 'session', 'meeting',
      'pause', 'include', 'includes', 'goal', 'point', 'points', 'items', 'item', 'across', 'focusing'
    ]);

    const candidates: string[] = [];

    // 1. Markdown bullet items (e.g. • Testing of the assistant's core features)
    const bulletRegex = /[•\*\-]\s*([^\n\r•\*\-]+)/g;
    let match;
    while ((match = bulletRegex.exec(text)) !== null) {
      const phrase = match[1].trim().replace(/[.,;:]+$/, '');
      const words = phrase.split(/\s+/).filter((w) => !stopWords.has(w.toLowerCase()));
      if (words.length >= 1 && words.length <= 4 && phrase.length >= 4 && phrase.length <= 40) {
        if (lowerText.includes(phrase.toLowerCase())) {
          candidates.push(phrase);
        }
      }
    }

    // 2. Section headers or bold phrases
    const headerRegex = /(?:###|\*\*|##)\s*([^\n\r\*#]+)/g;
    while ((match = headerRegex.exec(text)) !== null) {
      const phrase = match[1].replace(/^\d+[\.\)]\s*/, '').trim().replace(/[.,;:]+$/, '');
      const words = phrase.split(/\s+/).filter((w) => !stopWords.has(w.toLowerCase()));
      if (words.length >= 1 && words.length <= 4 && phrase.length >= 4 && phrase.length <= 40) {
        if (lowerText.includes(phrase.toLowerCase())) {
          candidates.push(phrase);
        }
      }
    }

    // 3. Consecutive non-stopword bigrams from text
    const tokens = text.match(/[a-zA-Z0-9_\-]+/g) || [];
    for (let i = 0; i < tokens.length - 1; i++) {
      const w1 = tokens[i].trim();
      const w2 = tokens[i + 1].trim();
      if (w1.length > 2 && w2.length > 2 && !stopWords.has(w1.toLowerCase()) && !stopWords.has(w2.toLowerCase())) {
        const phrase = `${w1} ${w2}`;
        if (lowerText.includes(phrase.toLowerCase())) {
          candidates.push(phrase);
        }
      }
    }

    // 4. Frequent individual words
    const freq: Record<string, number> = {};
    for (const tok of tokens) {
      const clean = tok.trim();
      if (clean.length >= 4 && !stopWords.has(clean.toLowerCase())) {
        const cap = clean.charAt(0).toUpperCase() + clean.slice(1).toLowerCase();
        freq[cap] = (freq[cap] || 0) + 1;
      }
    }

    const sortedWords = Object.entries(freq).sort((a, b) => b[1] - a[1]);
    for (const [w] of sortedWords.slice(0, 12)) {
      if (lowerText.includes(w.toLowerCase())) {
        candidates.push(w);
      }
    }

    // Clean, format to Title Case, deduplicate, and strictly check presence in lowerText
    const toTitleCase = (str: string) =>
      str.replace(/\w\S*/g, (txt) => txt.charAt(0).toUpperCase() + txt.substring(1).toLowerCase());

    candidates.sort((a, b) => {
      const aWords = a.split(/\s+/).length;
      const bWords = b.split(/\s+/).length;
      if (aWords !== bWords) return bWords - aWords;
      return b.length - a.length;
    });

    const seen = new Set<string>();
    const results: string[] = [];

    for (const cand of candidates) {
      const formatted = toTitleCase(cand.trim());
      const lowerCand = formatted.toLowerCase();

      // STRICT CHECK: The term MUST exist in lowerText!
      if (lowerText.includes(lowerCand) && !seen.has(lowerCand) && formatted.length >= 3) {
        if (formatted.split(/\s+/).length === 1 && results.some((r) => r.toLowerCase().includes(lowerCand))) {
          continue;
        }
        seen.add(lowerCand);
        results.push(formatted);
        if (results.length >= 6) break;
      }
    }

    return results;
  };

  const getDetectedKeywords = (result: ClassificationResult | null, text: string): string[] => {
    if (!result && !text) return [];

    const fullSourceText = `${text || ''} ${result?.reason || ''}`.trim();
    const lowerSource = fullSourceText.toLowerCase();

    // 1. If backend/AI provided keywords, verify that each keyword strictly appears in the text
    if (result?.keywords && Array.isArray(result.keywords) && result.keywords.length > 0) {
      const valid = result.keywords
        .map((k) => String(k).trim())
        .filter((k) => k.length >= 3 && lowerSource.includes(k.toLowerCase()));

      if (valid.length >= 3) {
        return valid.slice(0, 6);
      }
      if (valid.length > 0) {
        const extra = extractDynamicKeywords(fullSourceText).filter(
          (k) => !valid.some((v) => v.toLowerCase() === k.toLowerCase())
        );
        return [...valid, ...extra].slice(0, 6);
      }
    }

    // 2. Dynamic extraction directly from the actual source content
    return extractDynamicKeywords(fullSourceText);
  };


  const executeClassification = useCallback(async (
    textToClassify: string,
    activeTitle?: string,
    activeFileId?: string
  ) => {
    setClassifying(true);
    setErrorMsg(null);

    try {
      const result = await meetingsApi.classifyMeeting({
        summary: textToClassify,
        text: textToClassify,
        transcript: transcript || undefined,
        title: activeTitle || meetingTitle || undefined,
        file_id: activeFileId || fileId || undefined,
      });

      setClassificationResult(result);

      // Persist in local storage
      const currentUser = authApi.getCurrentUser();
      const currentUserId = currentUser?.id || currentUser?._id;
      try {
        localStorage.setItem(
          'meetmind_active_classification',
          JSON.stringify({
            ...result,
            title: activeTitle || meetingTitle,
            userId: currentUserId,
          })
        );
      } catch {
        // ignore
      }

      if (currentUser?.id) {
        notificationService.addNotification(currentUser.id, {
          type: 'classification',
          title: 'Classification Completed',
          message: `Meeting classified as "${result.category}" (${result.confidence}% confidence).`,
        });
      }
    } catch (err: any) {
      console.warn('Classification API error:', err);
      setErrorMsg(err?.response?.data?.detail || 'Unable to classify meeting. Please try again.');
    } finally {
      setClassifying(false);
    }
  }, [fileId, meetingTitle, transcript]);

  useEffect(() => {
    const user = authApi.getCurrentUser();
    const token = authApi.getToken();

    if (!user || !token) {
      navigate('/');
      return;
    }

    let activeTitle = navState.title || '';
    let activeSummary = navState.summary || '';
    let activeTranscript = navState.transcript || '';
    let activeFileId = navState.file_id || '';
    let activeActions = navState.action_items || [];

    const currentUserId = user?.id || user?._id;

    // Fall back to stored caches if navState is missing items
    if (!activeSummary && !activeTranscript) {
      try {
        const cachedActions = localStorage.getItem('meetmind_active_action_items');
        if (cachedActions) {
          const parsed = JSON.parse(cachedActions);
          if (parsed?.userId && parsed.userId !== currentUserId) {
            localStorage.removeItem('meetmind_active_action_items');
          } else {
            if (parsed.title) activeTitle = activeTitle || parsed.title;
            if (parsed.summary) activeSummary = activeSummary || parsed.summary;
            if (parsed.transcript) activeTranscript = activeTranscript || parsed.transcript;
            if (parsed.action_items) activeActions = activeActions.length ? activeActions : parsed.action_items;
            if (parsed.file_id) activeFileId = activeFileId || parsed.file_id;
          }
        }
      } catch {
        // ignore
      }
    }

    if (!activeSummary) {
      try {
        const cachedSummary = localStorage.getItem('meetmind_active_summary');
        if (cachedSummary) {
          const parsed = JSON.parse(cachedSummary);
          if (parsed?.userId && parsed.userId !== currentUserId) {
            localStorage.removeItem('meetmind_active_summary');
          } else {
            if (parsed.title) activeTitle = activeTitle || parsed.title;
            if (parsed.summary) activeSummary = activeSummary || parsed.summary;
            if (parsed.transcript) activeTranscript = activeTranscript || parsed.transcript;
            if (parsed.file_id) activeFileId = activeFileId || parsed.file_id;
          }
        }
      } catch {
        // ignore
      }
    }

    if (!activeTranscript) {
      try {
        const cachedTrans = localStorage.getItem('meetmind_active_transcript');
        if (cachedTrans) {
          const parsed = JSON.parse(cachedTrans);
          if (parsed?.userId && parsed.userId !== currentUserId) {
            localStorage.removeItem('meetmind_active_transcript');
          } else {
            if (parsed.title) activeTitle = activeTitle || parsed.title;
            if (parsed.transcript) activeTranscript = activeTranscript || parsed.transcript;
            if (parsed.file_id) activeFileId = activeFileId || parsed.file_id;
          }
        }
      } catch {
        // ignore
      }
    }

    setMeetingTitle(activeTitle);
    setSummary(activeSummary);
    setTranscript(activeTranscript);
    setFileId(activeFileId);
    setActionItems(activeActions);

    // Check if we already have a real stored classification for this document
    try {
      const cachedClass = localStorage.getItem('meetmind_active_classification');
      if (cachedClass) {
        const parsed = JSON.parse(cachedClass);
        if (parsed?.userId && parsed.userId !== currentUserId) {
          localStorage.removeItem('meetmind_active_classification');
        } else if (parsed.category) {
          // If cached category is legacy "Account" or missing keywords, clear stale item
          if (parsed.category.toLowerCase() === 'account' || !parsed.keywords || parsed.keywords.length === 0) {
            localStorage.removeItem('meetmind_active_classification');
          } else if (!activeTitle || parsed.title === activeTitle) {
            setClassificationResult(parsed);
            return;
          }
        }
      }
    } catch {
      // ignore
    }

    // Auto-trigger classification if content is available
    const content = activeSummary || activeTranscript;
    if (content && content.trim().length > 10) {
      executeClassification(content, activeTitle, activeFileId);
    } else {
      // Fetch latest classification from MongoDB
      meetingsApi.getLatestClassification().then((res) => {
        if (res) {
          setClassificationResult(res);
          if (res.title) setMeetingTitle(res.title);
        }
      }).catch(() => {
        // ignore
      });
    }
  }, [navigate, executeClassification, navState.action_items, navState.file_id, navState.summary, navState.title, navState.transcript]);

  const handleClassifyMeeting = () => {
    const textToClassify = summary || transcript;
    if (!textToClassify.trim()) {
      setErrorMsg('No meeting text or summary available to classify. Upload or generate a summary first.');
      return;
    }
    executeClassification(textToClassify, meetingTitle, fileId);
  };

  const handleContinueToReports = () => {
    const currentUser = authApi.getCurrentUser();
    const currentUserId = currentUser?.id || currentUser?._id;
    const payload = {
      transcript: transcript || summary,
      summary: summary,
      action_items: actionItems,
      category: classificationResult?.category || 'Educational',
      confidence: classificationResult?.confidence || 96,
      reason: classificationResult?.reason || '',
      file_id: fileId,
      title: meetingTitle || 'Meeting Dossier',
      userId: currentUserId,
    };

    try {
      localStorage.setItem('meetmind_active_report', JSON.stringify(payload));
    } catch {
      // ignore
    }

    navigate('/reports', { state: payload });
  };

  const getCategoryTheme = (cat?: string) => {
    switch (cat?.toLowerCase()) {
      case 'educational':
        return {
          bg: '#ECFDF5',
          color: '#059669',
          border: '#A7F3D0',
          desc: 'Academic syllabus, course notes, curriculum topics, lectures, and educational learning deliverables.',
        };
      case 'technical':
        return {
          bg: '#EEF2FF',
          color: '#4F46E5',
          border: '#C7D2FE',
          desc: 'Software system architecture, backend deployment, APIs, security protocols, and engineering topics.',
        };
      case 'project review':
        return {
          bg: '#FFFBEB',
          color: '#D97706',
          border: '#FDE68A',
          desc: 'Milestones, sprint delivery tracking, release schedules, blockers, and execution roadmap.',
        };
      case 'research discussion':
        return {
          bg: '#F5F3FF',
          color: '#7C3AED',
          border: '#DDD6FE',
          desc: 'Scientific methodologies, experimental evaluations, algorithm benchmarks, and empirical analysis.',
        };
      case 'business meeting':
        return {
          bg: '#EFF6FF',
          color: '#2563EB',
          border: '#BFDBFE',
          desc: 'Corporate strategy, market positioning, executive KPIs, revenue targets, and commercial operations.',
        };
      case 'client discussion':
        return {
          bg: '#ECFEFF',
          color: '#0891B2',
          border: '#A5F3FC',
          desc: 'Customer requirements gathering, client deliverables, feedback reviews, and contractual commitments.',
        };
      case 'training session':
        return {
          bg: '#F0FDFA',
          color: '#0D9488',
          border: '#99F6E4',
          desc: 'Structured professional workshops, employee onboarding, hands-on tutorials, and skill upskilling.',
        };
      case 'academic seminar':
        return {
          bg: '#FFF1F2',
          color: '#E11D48',
          border: '#FECDD3',
          desc: 'Departmental guest lectures, college symposiums, university colloquia, and academic presentations.',
        };
      case 'product planning':
        return {
          bg: '#FFF7ED',
          color: '#EA580C',
          border: '#FED7AA',
          desc: 'Product feature roadmaps, UX wireframing, user story backlogs, and feature prioritization.',
        };
      default:
        return {
          bg: '#F8FAFC',
          color: '#475569',
          border: '#E2E8F0',
          desc: 'Cross-functional synchronization, internal operational huddles, and team collaboration.',
        };
    }
  };

  const theme = getCategoryTheme(classificationResult?.category);

  return (
    <SidebarLayout>
      <div style={styles.contentContainer}>
        {/* Header Row */}
        <div style={styles.headerRow}>
          <div>
            <div style={styles.badgePill}>
              <Brain size={14} color="#6366F1" style={{ marginRight: '6px' }} />
              <span>Step 4: Machine Learning Intelligence</span>
            </div>
            <h1 style={styles.pageTitle}>Meeting Classification</h1>
            <p style={styles.pageSubtitle}>
              Accurate domain classification, dynamic confidence scoring, and AI-grounded reasoning.
            </p>
          </div>

          {meetingTitle && (
            <div style={styles.meetingSourceBadge}>
              <span style={styles.sourceLabel}>Active Document</span>
              <span style={styles.sourceTitle}>{meetingTitle}</span>
            </div>
          )}
        </div>

        {/* Section 1: Meeting Summary Preview Card */}
        <section style={styles.card}>
          <div style={styles.cardHeader}>
            <div style={styles.cardHeaderLeft}>
              <div style={styles.cardIconWrap}>
                <FileText size={22} color="#6366F1" />
              </div>
              <div>
                <h3 style={styles.cardTitle}>Source Content Context</h3>
                <p style={styles.cardDesc}>
                  Input summary and transcript evaluated by the classification engine
                </p>
              </div>
            </div>
            {summary && (
              <span style={styles.summaryWordBadge}>
                {summary.split(/\s+/).filter(Boolean).length} words analyzed
              </span>
            )}
          </div>

          <div style={styles.cardBody}>
            <div style={styles.previewBox}>
              <p style={styles.previewText}>
                {summary || transcript || 'No source content loaded. Upload a document or meeting audio to classify.'}
              </p>
            </div>
          </div>
        </section>

        {/* Section 2: ML Classification Card */}
        <section style={styles.card}>
          <div style={styles.cardHeader}>
            <div style={styles.cardHeaderLeft}>
              <div style={{ ...styles.cardIconWrap, background: '#EEF2FF' }}>
                <Brain size={22} color="#6366F1" />
              </div>
              <div>
                <h3 style={styles.cardTitle}>Smart Meeting Classification</h3>
                <p style={styles.cardDesc}>
                  AI Engine category detection, confidence scoring, and keyword analysis
                </p>
              </div>
            </div>

            {classificationResult && (
              <div style={styles.sourceTag}>
                <Sparkles size={13} color="#10B981" style={{ marginRight: '6px' }} />
                <span>Source: {classificationResult.source || 'Generated from current summary.'}</span>
              </div>
            )}
          </div>

          <div style={styles.cardBody}>
            {errorMsg && (
              <div style={styles.errorAlert}>
                <AlertCircle size={16} style={{ marginRight: '8px' }} />
                <span>{errorMsg}</span>
              </div>
            )}

            {!classificationResult && !classifying && (
              <div style={styles.emptyState}>
                <div style={styles.emptyIconCircle}>
                  <Layers size={30} color="#6366F1" />
                </div>
                <h4 style={styles.emptyTitle}>
                  {summary || transcript ? 'Ready for Smart Meeting Classification' : 'No meetings processed yet.'}
                </h4>
                <p style={styles.emptySub}>
                  {summary || transcript
                    ? 'Click "Classify Meeting" to run AI Engine domain analysis and extract category, confidence %, and keywords.'
                    : 'Upload your first PDF or audio recording to get started.'}
                </p>
                {!(summary || transcript) && (
                  <button
                    onClick={() => navigate('/upload')}
                    style={styles.emptyActionBtn}
                    id="empty-upload-doc-btn"
                  >
                    <span>Upload Recording</span>
                  </button>
                )}
              </div>
            )}

            {classifying && (
              <div style={styles.loadingBox}>
                <RefreshCw size={32} className="animate-spin" color="#6366F1" style={{ marginBottom: '14px' }} />
                <h4 style={styles.loadingTitle}>Evaluating Meeting Domain with AI Engine...</h4>
                <p style={styles.loadingSub}>
                  Extracting semantic indicators, scoring taxonomy categories, and calculating confidence.
                </p>
              </div>
            )}

            {classificationResult && !classifying && (
              <div style={styles.resultBox}>
                {/* Top Section: Category, Confidence Score, and Status Grid */}
                <div style={styles.resultPrimaryGrid}>
                  {/* Category Card */}
                  <div style={styles.primaryMetricCard}>
                    <span style={styles.primaryMetricLabel}>Meeting Category</span>
                    <div style={{ ...styles.categoryBadge, background: theme.bg, color: theme.color, borderColor: theme.border }}>
                      <CheckCircle2 size={18} style={{ marginRight: '8px', flexShrink: 0 }} />
                      <span style={styles.categoryNameText}>{classificationResult.category}</span>
                    </div>
                    <p style={styles.categoryThemeDesc}>{theme.desc}</p>
                  </div>

                  {/* Confidence Score Card */}
                  <div style={styles.confidenceMetricCard}>
                    <span style={styles.primaryMetricLabel}>Confidence Score</span>
                    <div style={styles.confidenceScoreWrap}>
                      <span style={styles.confidenceNumber}>{classificationResult.confidence}%</span>
                      <Award size={22} color="#6366F1" style={{ marginLeft: '8px' }} />
                    </div>
                    <div style={styles.confidenceProgressBarBg}>
                      <div
                        style={{
                          ...styles.confidenceProgressBarFill,
                          width: `${classificationResult.confidence}%`,
                          background: classificationResult.confidence >= 90 ? '#10B981' : '#6366F1',
                        }}
                      />
                    </div>
                    <span style={styles.confidenceSub}>
                      Dynamically computed from semantic pattern density
                    </span>
                  </div>

                  {/* Status Card */}
                  <div style={styles.statusMetricCard}>
                    <span style={styles.primaryMetricLabel}>Status</span>
                    <div style={styles.statusCardBadge}>
                      <span style={styles.statusPulseDot} />
                      <span style={styles.statusCardText}>Completed</span>
                    </div>
                    <span style={styles.statusSubText}>
                      Domain verified and ready for report export
                    </span>
                  </div>
                </div>

                {/* Keywords Detected Section */}
                <div style={styles.keywordsCard}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                    <Tag size={16} color="#4F46E5" />
                    <span style={styles.keywordsTitle}>Keywords Detected</span>
                  </div>
                  <div style={styles.keywordsChipsWrap}>
                    {getDetectedKeywords(classificationResult, summary || transcript).map((kw, i) => (
                      <span key={i} style={styles.keywordChip}>
                        {kw}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Reason Card */}
                <div style={styles.reasonCard}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                    <HelpCircle size={17} color="#4F46E5" />
                    <span style={styles.reasonHeading}>Smart Analysis & Evidence</span>
                  </div>
                  <p style={styles.reasonText}>{classificationResult.reason}</p>
                </div>

                {/* Attribution Source Footer Bar */}
                <div style={styles.resultMetaFooter}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Compass size={14} color="#64748B" />
                    <span style={styles.sourceMetaText}>
                      <strong>Source:</strong> {classificationResult.source || 'Generated from current summary.'}
                    </span>
                  </div>
                  {classificationResult.created_at && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <Clock size={14} color="#94A3B8" />
                      <span style={styles.timestampMetaText}>
                        {new Date(classificationResult.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Action Buttons Bar */}
            <div style={styles.actionButtonBar}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                <button
                  onClick={handleClassifyMeeting}
                  disabled={classifying}
                  style={{
                    ...styles.classifyBtn,
                    opacity: classifying ? 0.75 : 1,
                    cursor: classifying ? 'not-allowed' : 'pointer',
                  }}
                  id="classify-meeting-btn"
                >
                  {classifying ? (
                    <>
                      <RefreshCw size={16} className="animate-spin" style={{ marginRight: '8px' }} />
                      <span>Analyzing Domain...</span>
                    </>
                  ) : classificationResult ? (
                    <>
                      <RefreshCw size={16} style={{ marginRight: '8px' }} />
                      <span>Re-Classify</span>
                    </>
                  ) : (
                    <>
                      <Sparkles size={16} style={{ marginRight: '8px' }} />
                      <span>Classify Meeting</span>
                    </>
                  )}
                </button>

                {classificationResult && (
                  <button
                    onClick={() => setShowInsightsModal(true)}
                    style={styles.actionSecondaryBtn}
                    id="view-insights-btn"
                  >
                    <Info size={16} style={{ marginRight: '6px' }} />
                    <span>View Insights</span>
                  </button>
                )}
              </div>

              {classificationResult && (
                <button
                  onClick={handleContinueToReports}
                  style={styles.continueBtn}
                  id="continue-to-reports-btn"
                >
                  <span>Continue to Reports</span>
                  <ArrowRight size={18} style={{ marginLeft: '10px' }} />
                </button>
              )}
            </div>
          </div>
        </section>

        {/* View Insights Modal */}
        {showInsightsModal && classificationResult && (
          <div style={styles.modalOverlay} onClick={() => setShowInsightsModal(false)}>
            <div style={styles.modalBox} onClick={(e) => e.stopPropagation()}>
              <div style={styles.modalHeader}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Brain size={20} color="#6366F1" />
                  <h3 style={{ margin: 0, fontSize: '1.15rem', color: '#0F172A', fontWeight: 800 }}>
                    Meeting Intelligence Insights
                  </h3>
                </div>
                <button
                  onClick={() => setShowInsightsModal(false)}
                  style={styles.modalCloseBtn}
                >
                  <X size={18} />
                </button>
              </div>

              <div style={{ padding: '20px 0', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div style={styles.insightRow}>
                  <span style={styles.insightLabel}>Primary Category</span>
                  <span style={{ fontWeight: 700, color: theme.color }}>{classificationResult.category}</span>
                </div>

                <div style={styles.insightRow}>
                  <span style={styles.insightLabel}>Confidence Score</span>
                  <span style={{ fontWeight: 700, color: '#0F172A' }}>{classificationResult.confidence}%</span>
                </div>

                <div style={styles.insightRow}>
                  <span style={styles.insightLabel}>Processing Status</span>
                  <span style={{ fontWeight: 700, color: '#059669' }}>Completed</span>
                </div>

                <div>
                  <span style={styles.insightLabel}>Detected Keywords</span>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '6px' }}>
                    {getDetectedKeywords(classificationResult, summary || transcript).map((kw, i) => (
                      <span key={i} style={styles.keywordChip}>
                        {kw}
                      </span>
                    ))}
                  </div>
                </div>

                <div>
                  <span style={styles.insightLabel}>Analytical Evidence</span>
                  <p style={{ fontSize: '0.86rem', color: '#475569', lineHeight: 1.6, margin: '6px 0 0 0' }}>
                    {classificationResult.reason}
                  </p>
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', paddingTop: '10px' }}>
                <button
                  onClick={() => setShowInsightsModal(false)}
                  style={styles.modalCloseBtnAction}
                >
                  Close Insights
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
  meetingSourceBadge: {
    background: '#FFFFFF',
    border: '1px solid #E2E8F0',
    borderRadius: '12px',
    padding: '8px 14px',
    display: 'flex',
    flexDirection: 'column',
    boxShadow: '0 2px 6px rgba(0, 0, 0, 0.02)',
  },
  sourceLabel: {
    fontSize: '0.68rem',
    color: '#64748B',
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
  },
  sourceTitle: {
    fontSize: '0.88rem',
    fontWeight: 700,
    color: '#1E293B',
    marginTop: '2px',
  },
  card: {
    background: '#FFFFFF',
    border: '1px solid #E2E8F0',
    borderRadius: '24px',
    padding: '26px',
    boxShadow: '0 4px 14px rgba(0, 0, 0, 0.03)',
    display: 'flex',
    flexDirection: 'column',
    gap: '18px',
  },
  cardHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: '14px',
    paddingBottom: '14px',
    borderBottom: '1px solid #F1F5F9',
  },
  cardHeaderLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: '14px',
  },
  cardIconWrap: {
    width: '42px',
    height: '42px',
    borderRadius: '14px',
    background: '#EEF2FF',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  cardTitle: {
    fontSize: '1.18rem',
    fontWeight: 700,
    color: '#0F172A',
    margin: 0,
  },
  cardDesc: {
    fontSize: '0.84rem',
    color: '#64748B',
    margin: '2px 0 0 0',
  },
  summaryWordBadge: {
    fontSize: '0.74rem',
    color: '#64748B',
    background: '#F1F5F9',
    padding: '4px 10px',
    borderRadius: '12px',
    fontWeight: 600,
  },
  sourceTag: {
    display: 'inline-flex',
    alignItems: 'center',
    background: '#ECFDF5',
    border: '1px solid #A7F3D0',
    color: '#065F46',
    fontSize: '0.78rem',
    fontWeight: 700,
    padding: '5px 12px',
    borderRadius: '12px',
  },
  cardBody: {
    display: 'flex',
    flexDirection: 'column',
    gap: '18px',
  },
  previewBox: {
    background: '#F8FAFC',
    border: '1px solid #E2E8F0',
    borderRadius: '16px',
    padding: '16px 20px',
    maxHeight: '140px',
    overflowY: 'auto',
  },
  previewText: {
    fontSize: '0.88rem',
    color: '#334155',
    lineHeight: 1.6,
    margin: 0,
  },
  errorAlert: {
    display: 'flex',
    alignItems: 'center',
    background: '#FEF2F2',
    border: '1px solid #FECACA',
    color: '#DC2626',
    padding: '12px 16px',
    borderRadius: '12px',
    fontSize: '0.88rem',
    fontWeight: 600,
  },
  emptyState: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '36px 20px',
    textAlign: 'center',
  },
  emptyIconCircle: {
    width: '60px',
    height: '60px',
    borderRadius: '20px',
    background: '#EEF2FF',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: '14px',
  },
  emptyTitle: {
    fontSize: '1.1rem',
    fontWeight: 700,
    color: '#0F172A',
    margin: '0 0 6px 0',
  },
  emptySub: {
    fontSize: '0.86rem',
    color: '#64748B',
    maxWidth: '440px',
    margin: 0,
  },
  loadingBox: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '36px 20px',
    textAlign: 'center',
  },
  loadingTitle: {
    fontSize: '1.08rem',
    fontWeight: 700,
    color: '#1E293B',
    margin: '0 0 6px 0',
  },
  loadingSub: {
    fontSize: '0.86rem',
    color: '#64748B',
    maxWidth: '460px',
    margin: 0,
  },
  resultBox: {
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
  },
  resultPrimaryGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
    gap: '16px',
  },
  primaryMetricCard: {
    background: '#FAFAFC',
    border: '1px solid #E2E8F0',
    borderRadius: '18px',
    padding: '20px',
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
  },
  primaryMetricLabel: {
    fontSize: '0.74rem',
    fontWeight: 700,
    color: '#64748B',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
  },
  categoryBadge: {
    display: 'inline-flex',
    alignItems: 'center',
    padding: '8px 16px',
    borderRadius: '14px',
    border: '1px solid',
    width: 'fit-content',
  },
  categoryNameText: {
    fontSize: '1.15rem',
    fontWeight: 800,
    letterSpacing: '-0.01em',
  },
  categoryThemeDesc: {
    fontSize: '0.84rem',
    color: '#64748B',
    lineHeight: 1.5,
    margin: 0,
  },
  confidenceMetricCard: {
    background: '#FAFAFC',
    border: '1px solid #E2E8F0',
    borderRadius: '18px',
    padding: '20px',
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
  },
  confidenceScoreWrap: {
    display: 'flex',
    alignItems: 'center',
  },
  confidenceNumber: {
    fontSize: '2rem',
    fontWeight: 900,
    color: '#0F172A',
    letterSpacing: '-0.03em',
  },
  confidenceProgressBarBg: {
    width: '100%',
    height: '8px',
    background: '#E2E8F0',
    borderRadius: '10px',
    overflow: 'hidden',
  },
  confidenceProgressBarFill: {
    height: '100%',
    borderRadius: '10px',
    transition: 'width 0.4s ease',
  },
  confidenceSub: {
    fontSize: '0.76rem',
    color: '#94A3B8',
  },
  reasonCard: {
    background: '#FFFFFF',
    border: '1px solid #E2E8F0',
    borderLeft: '4px solid #6366F1',
    borderRadius: '16px',
    padding: '18px 22px',
    boxShadow: '0 2px 6px rgba(0, 0, 0, 0.02)',
  },
  reasonHeading: {
    fontSize: '0.82rem',
    fontWeight: 700,
    color: '#4F46E5',
    textTransform: 'uppercase',
    letterSpacing: '0.04em',
  },
  reasonText: {
    fontSize: '0.92rem',
    color: '#1E293B',
    lineHeight: 1.6,
    margin: 0,
    fontWeight: 500,
  },
  resultMetaFooter: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '10px 16px',
    background: '#F8FAFC',
    borderRadius: '12px',
    border: '1px solid #F1F5F9',
    fontSize: '0.78rem',
  },
  sourceMetaText: {
    color: '#475569',
  },
  timestampMetaText: {
    color: '#94A3B8',
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
  classifyBtn: {
    display: 'inline-flex',
    alignItems: 'center',
    padding: '12px 24px',
    background: 'linear-gradient(135deg, #6366F1, #4F46E5)',
    color: '#FFFFFF',
    fontWeight: 700,
    fontSize: '0.90rem',
    border: 'none',
    borderRadius: '12px',
    cursor: 'pointer',
    boxShadow: '0 4px 12px rgba(79, 70, 229, 0.25)',
  },
  continueBtn: {
    display: 'inline-flex',
    alignItems: 'center',
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
  statusMetricCard: {
    background: '#FAFAFC',
    border: '1px solid #E2E8F0',
    borderRadius: '18px',
    padding: '20px',
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
  },
  statusCardBadge: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '8px',
    padding: '8px 16px',
    borderRadius: '14px',
    background: '#ECFDF5',
    border: '1px solid #A7F3D0',
    width: 'fit-content',
  },
  statusPulseDot: {
    width: '8px',
    height: '8px',
    borderRadius: '50%',
    background: '#10B981',
  },
  statusCardText: {
    fontSize: '1rem',
    fontWeight: 800,
    color: '#059669',
  },
  statusSubText: {
    fontSize: '0.80rem',
    color: '#64748B',
    lineHeight: 1.4,
  },
  keywordsCard: {
    background: '#FFFFFF',
    border: '1px solid #E2E8F0',
    borderRadius: '18px',
    padding: '18px 22px',
    boxShadow: '0 2px 6px rgba(0, 0, 0, 0.02)',
  },
  keywordsTitle: {
    fontSize: '0.84rem',
    fontWeight: 700,
    color: '#4F46E5',
    textTransform: 'uppercase',
    letterSpacing: '0.04em',
  },
  keywordsChipsWrap: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '8px',
  },
  keywordChip: {
    display: 'inline-flex',
    alignItems: 'center',
    padding: '6px 14px',
    borderRadius: '10px',
    background: '#F1F5F9',
    border: '1px solid #E2E8F0',
    color: '#1E293B',
    fontSize: '0.84rem',
    fontWeight: 600,
    transition: 'all 0.15s ease',
  },
  actionSecondaryBtn: {
    display: 'inline-flex',
    alignItems: 'center',
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
  emptyActionBtn: {
    display: 'inline-flex',
    alignItems: 'center',
    padding: '10px 20px',
    background: 'linear-gradient(135deg, #6366F1, #4F46E5)',
    color: '#FFFFFF',
    border: 'none',
    borderRadius: '12px',
    fontSize: '0.90rem',
    fontWeight: 600,
    cursor: 'pointer',
    marginTop: '16px',
    boxShadow: '0 4px 12px rgba(79, 70, 229, 0.25)',
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
    maxWidth: '520px',
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
  insightRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: '10px',
    borderBottom: '1px solid #F1F5F9',
  },
  insightLabel: {
    fontSize: '0.80rem',
    fontWeight: 700,
    color: '#64748B',
    textTransform: 'uppercase',
    letterSpacing: '0.04em',
  },
  modalCloseBtnAction: {
    padding: '9px 20px',
    background: 'linear-gradient(135deg, #6366F1, #8B5CF6)',
    color: '#FFFFFF',
    border: 'none',
    borderRadius: '10px',
    fontWeight: 600,
    fontSize: '0.86rem',
    cursor: 'pointer',
  },
};
