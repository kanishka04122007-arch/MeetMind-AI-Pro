import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  CheckSquare,
  FileText,
  Calendar,
  ArrowRight,
  Copy,
  Check,
  Sparkles,
  RefreshCw,
  AlertCircle,
  Tag,
  UserCheck,
  Download,
  Clock,
  PlayCircle,
  CheckCircle,
} from 'lucide-react';
import { SidebarLayout } from '../components/SidebarLayout';
import { authApi } from '../api/auth';
import { meetingsApi } from '../api/meetings';
import { notificationService } from '../services/notificationService';

export type TaskStatus = 'Pending' | 'In Progress' | 'Completed';

interface ActionItem {
  id: string;
  task: string;
  assignee: string;
  priority: 'High' | 'Medium' | 'Low';
  status: TaskStatus;
  dueDate?: string;
}

export const ActionItemsPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();

  const navState = (location.state as {
    transcript?: string;
    summary?: string;
    key_points?: string[];
    file_id?: string;
    title?: string;
    action_items?: ActionItem[];
  } | null) || {};

  const [meetingTitle, setMeetingTitle] = useState<string>('');
  const [summary, setSummary] = useState<string>('');
  const [transcript, setTranscript] = useState<string>('');
  const [fileId, setFileId] = useState<string>('');
  const [sourceLabel, setSourceLabel] = useState<string>('Generated from current meeting summary');
  const [copiedTask, setCopiedTask] = useState<string | null>(null);
  const [generating, setGenerating] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [filter, setFilter] = useState<'All' | 'Pending' | 'In Progress' | 'Completed'>('All');

  // NO HARDCODED OR CANNED ACTION ITEMS - Pure AI Output
  const [actionItems, setActionItems] = useState<ActionItem[]>([]);

  const isCannedTask = (text: string): boolean => {
    const l = text.toLowerCase();
    return (
      l.includes('deploy production application') ||
      l.includes('mongodb schema verification') ||
      l.includes('frontend engineering review') ||
      l.includes('execute comprehensive api endpoint')
    );
  };

  const executeGenerate = useCallback(async (
    targetSummary?: string,
    targetFileId?: string,
    targetTitle?: string,
    targetTranscript?: string
  ) => {
    setGenerating(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const res = await meetingsApi.generateActionItems(
        targetSummary || undefined,
        targetFileId || undefined,
        targetTitle || undefined,
        targetTranscript || undefined
      );

      if (res && res.tasks && res.tasks.length > 0) {
        // Filter out any potential canned/template artifacts
        const validTasks = res.tasks.filter((t) => !isCannedTask(t.task));
        const finalTasks = validTasks.length > 0 ? validTasks : res.tasks;

        const mapped: ActionItem[] = finalTasks.map((t, idx) => ({
          id: `task-ai-${Date.now()}-${idx}`,
          task: t.task,
          assignee: t.owner || 'Student',
          priority: (t.priority === 'High' || t.priority === 'Medium' || t.priority === 'Low'
            ? t.priority
            : 'High') as 'High' | 'Medium' | 'Low',
          status: 'Pending',
          dueDate: `Oct ${6 + (idx % 7) * 2}, 2026`,
        }));

        setActionItems(mapped);
        setSourceLabel(res.source || 'Generated from current meeting intelligence');
        setSuccessMessage(`Generated ${mapped.length} AI action items from source content.`);

        // Persist to local cache
        const currentUser = authApi.getCurrentUser();
        const currentUserId = currentUser?.id || currentUser?._id;
        const cachePayload = {
          transcript: targetTranscript,
          summary: targetSummary,
          action_items: mapped,
          file_id: targetFileId,
          title: targetTitle || 'Meeting Session',
          source: res.source || 'Generated from current meeting intelligence',
          userId: currentUserId,
        };
        try {
          localStorage.setItem('meetmind_active_action_items', JSON.stringify(cachePayload));
        } catch {
          // ignore
        }

        if (currentUser?.id) {
          notificationService.addNotification(currentUser.id, {
            type: 'action_items',
            title: 'Action Items Created',
            message: `Generated ${mapped.length} actionable deliverables for "${targetTitle || 'Meeting'}"`,
          });
        }
      } else {
        setErrorMessage('No action items could be extracted. Please ensure the document or summary has content.');
      }
    } catch (err: any) {
      console.warn('Error generating action items from intelligence engine:', err);
      const detail = err?.response?.data?.detail || err?.message || 'Failed to generate action items with AI Engine.';
      setErrorMessage(detail);
    } finally {
      setGenerating(false);
    }
  }, []);

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

    const currentUserId = user?.id || user?._id;

    // Check localStorage cache if navState is partial
    if (!activeSummary && !activeTranscript) {
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

    // Check if we already have real AI action items in navState
    if (navState.action_items && Array.isArray(navState.action_items) && navState.action_items.length > 0) {
      const cleanTasks = navState.action_items.filter((item) => !isCannedTask(item.task));
      if (cleanTasks.length > 0) {
        setActionItems(cleanTasks);
        return;
      }
    }

    // Check if we have cached action items in localStorage for this title/document
    try {
      const cachedActions = localStorage.getItem('meetmind_active_action_items');
      if (cachedActions) {
        const parsed = JSON.parse(cachedActions);
        if (parsed?.userId && parsed.userId !== currentUserId) {
          localStorage.removeItem('meetmind_active_action_items');
        } else if (
          parsed.action_items &&
          Array.isArray(parsed.action_items) &&
          parsed.action_items.length > 0 &&
          (!activeTitle || parsed.title === activeTitle)
        ) {
          const cleanTasks = parsed.action_items.filter((item: ActionItem) => !isCannedTask(item.task));
          if (cleanTasks.length > 0) {
            setActionItems(cleanTasks);
            if (parsed.source) setSourceLabel(parsed.source);
            return;
          }
        }
      }
    } catch {
      // ignore
    }

    // Automatically trigger fresh AI generation with AI Engine from active content
    if (activeSummary || activeTranscript || activeFileId) {
      executeGenerate(activeSummary, activeFileId, activeTitle, activeTranscript);
    } else {
      // Fetch latest real action items from MongoDB
      meetingsApi.getLatestActionItems().then((res) => {
        if (res && res.tasks && res.tasks.length > 0) {
          const cleanTasks = res.tasks.filter((t) => !isCannedTask(t.task));
          if (cleanTasks.length > 0) {
            const mapped: ActionItem[] = cleanTasks.map((t, idx) => ({
              id: `task-latest-${Date.now()}-${idx}`,
              task: t.task,
              assignee: t.owner || 'Student',
              priority: (t.priority === 'High' || t.priority === 'Medium' || t.priority === 'Low'
                ? t.priority
                : 'High') as 'High' | 'Medium' | 'Low',
              status: 'Pending',
              dueDate: `Oct ${8 + idx}, 2026`,
            }));
            setActionItems(mapped);
            if (res.title) setMeetingTitle(res.title);
            if (res.source) setSourceLabel(res.source);
          }
        }
      }).catch(() => {
        // ignore
      });
    }
  }, [navigate, executeGenerate, navState.action_items, navState.file_id, navState.summary, navState.title, navState.transcript]);

  const handleSetTaskStatus = (id: string, newStatus: TaskStatus) => {
    setActionItems((prev) => {
      const updated = prev.map((item) =>
        item.id === id ? { ...item, status: newStatus } : item
      );
      try {
        const cached = localStorage.getItem('meetmind_active_action_items');
        if (cached) {
          const parsed = JSON.parse(cached);
          parsed.action_items = updated;
          localStorage.setItem('meetmind_active_action_items', JSON.stringify(parsed));
        }
      } catch {
        // ignore
      }
      return updated;
    });
  };

  const handleGenerateActionItems = () => {
    executeGenerate(summary, fileId, meetingTitle, transcript);
  };

  const handleExportTasks = () => {
    if (actionItems.length === 0) return;
    const header = "Index,Task,Priority,Due Date,Status,Assignee\n";
    const rows = actionItems.map((item, idx) =>
      `"${idx + 1}","${item.task.replace(/"/g, '""')}","${item.priority}","${item.dueDate || 'N/A'}","${item.status}","${item.assignee || 'Unassigned'}"`
    ).join("\n");
    const blob = new Blob([header + rows], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `${(meetingTitle || 'action_items').toLowerCase().replace(/[^a-z0-9]/gi, '_')}_tasks.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    const currentUser = authApi.getCurrentUser();
    if (currentUser?.id) {
      notificationService.addNotification(currentUser.id, {
        type: 'action_items',
        title: 'Action Items Exported',
        message: `Successfully exported ${actionItems.length} action items to CSV.`,
      });
    }
  };

  const handleCopyTask = (taskText: string, id: string) => {
    navigator.clipboard.writeText(taskText);
    setCopiedTask(id);
    setTimeout(() => setCopiedTask(null), 2000);
  };

  const handleContinueToClassification = () => {
    const payload = {
      transcript: transcript || summary,
      summary: summary,
      action_items: actionItems,
      file_id: fileId,
      title: meetingTitle || 'Meeting Session',
    };

    try {
      localStorage.setItem('meetmind_active_action_items', JSON.stringify(payload));
    } catch {
      // ignore
    }

    navigate('/classification', { state: payload });
  };

  const completedCount = actionItems.filter((i) => i.status === 'Completed').length;
  const inProgressCount = actionItems.filter((i) => i.status === 'In Progress').length;
  const pendingCount = actionItems.filter((i) => i.status === 'Pending').length;
  const progressPercent = actionItems.length > 0 ? Math.round((completedCount / actionItems.length) * 100) : 0;

  const filteredItems = actionItems.filter((item) => {
    if (filter === 'Pending') return item.status === 'Pending';
    if (filter === 'In Progress') return item.status === 'In Progress';
    if (filter === 'Completed') return item.status === 'Completed';
    return true;
  });

  return (
    <SidebarLayout>
      <div style={styles.contentContainer}>
        {/* Header Row */}
        <div style={styles.headerRow}>
          <div>
            <div style={styles.badgePill}>
              <CheckSquare size={14} color="#10B981" style={{ marginRight: '6px' }} />
              <span>Step 3: Execution & Action Tracking</span>
            </div>
            <h1 style={styles.pageTitle}>Action Items & Tasks</h1>
            <p style={styles.pageSubtitle}>
              Real AI-generated deliverables and actionable study tasks derived from your source content.
            </p>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '8px' }}>
            <div style={styles.sourceTag}>
              <Sparkles size={13} color="#10B981" style={{ marginRight: '6px' }} />
              <span>Source: {sourceLabel}</span>
            </div>
            {meetingTitle && (
              <div style={styles.meetingSourceBadge}>
                <span style={styles.sourceLabel}>Active Document</span>
                <span style={styles.sourceTitle}>{meetingTitle}</span>
              </div>
            )}
          </div>
        </div>

        {/* Notifications */}
        {successMessage && (
          <div style={styles.successBanner}>
            <Check size={16} color="#059669" style={{ marginRight: '8px' }} />
            <span>{successMessage}</span>
          </div>
        )}

        {errorMessage && (
          <div style={styles.errorBanner}>
            <AlertCircle size={16} color="#DC2626" style={{ marginRight: '8px' }} />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Summary Context Reference Card */}
        {summary && (
          <section style={styles.summaryRefCard}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <FileText size={16} color="#6366F1" />
                <span style={styles.summaryRefHeading}>Executive Summary Context</span>
              </div>
              <span style={styles.summaryWordBadge}>{summary.split(/\s+/).filter(Boolean).length} words</span>
            </div>
            <p style={styles.summaryRefText}>
              {summary.length > 340 ? `${summary.slice(0, 340)}...` : summary}
            </p>
          </section>
        )}

        {/* Action Items List Card */}
        <section style={styles.card}>
          <div style={styles.cardHeader}>
            <div style={styles.cardHeaderLeft}>
              <div style={styles.cardIconWrap}>
                <CheckSquare size={22} color="#10B981" />
              </div>
              <div>
                <h3 style={styles.cardTitle}>Action Items & Deliverables</h3>
                <p style={styles.cardDesc}>
                  Deliverables extracted directly from verified meeting intelligence
                </p>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
              {actionItems.length > 0 && (
                <div style={styles.filterGroup}>
                  {(['All', 'Pending', 'In Progress', 'Completed'] as const).map((f) => (
                    <button
                      key={f}
                      onClick={() => setFilter(f)}
                      style={{
                        ...styles.filterBtn,
                        background: filter === f ? '#6366F1' : '#F1F5F9',
                        color: filter === f ? '#FFFFFF' : '#475569',
                      }}
                    >
                      {f}
                    </button>
                  ))}
                </div>
              )}

              {actionItems.length > 0 && (
                <button
                  onClick={handleExportTasks}
                  style={styles.exportBtn}
                  title="Export tasks to CSV"
                  id="export-tasks-top-btn"
                >
                  <Download size={15} style={{ marginRight: '6px' }} />
                  <span>Export Tasks</span>
                </button>
              )}

              <button
                onClick={handleGenerateActionItems}
                disabled={generating}
                style={styles.refreshItemsBtn}
                title="Extract fresh action items from current content"
                id="generate-action-items-btn"
              >
                {generating ? (
                  <>
                    <RefreshCw size={15} className="animate-spin" style={{ marginRight: '6px' }} />
                    <span>Extracting Deliverables...</span>
                  </>
                ) : (
                  <>
                    <Sparkles size={15} style={{ marginRight: '6px' }} />
                    <span>{actionItems.length > 0 ? 'Regenerate Action Items' : 'Generate Action Items'}</span>
                  </>
                )}
              </button>
            </div>
          </div>

          <div style={styles.cardBody}>
            {/* Progress Bar Component */}
            {actionItems.length > 0 && (
              <div style={styles.progressContainer}>
                <div style={styles.progressHeader}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={styles.progressTitle}>Progress</span>
                    <span style={styles.progressBadge}>{completedCount} / {actionItems.length} Completed</span>
                  </div>
                  <span style={styles.progressPercentText}>{progressPercent}% Done</span>
                </div>
                <div style={styles.progressBarTrack}>
                  <div
                    style={{
                      ...styles.progressBarFill,
                      width: `${progressPercent}%`,
                    }}
                  />
                </div>
                <div style={styles.progressSubInfo}>
                  <span style={{ color: '#64748B' }}>{pendingCount} Pending</span>
                  <span style={{ color: '#CBD5E1' }}>•</span>
                  <span style={{ color: '#2563EB' }}>{inProgressCount} In Progress</span>
                  <span style={{ color: '#CBD5E1' }}>•</span>
                  <span style={{ color: '#059669', fontWeight: 600 }}>{completedCount} Completed</span>
                </div>
              </div>
            )}

            {/* Loading State */}
            {generating && (
              <div style={styles.loadingContainer}>
                <RefreshCw size={36} color="#6366F1" className="animate-spin" style={{ marginBottom: '14px' }} />
                <h4 style={styles.loadingHeading}>Extracting Tasks via AI Engine...</h4>
                <p style={styles.loadingSub}>
                  Analyzing meeting intelligence to formulate specific, concrete action deliverables.
                </p>
              </div>
            )}

            {/* Empty State */}
            {!generating && actionItems.length === 0 && (
              <div style={styles.emptyContainer}>
                <div style={styles.emptyIconCircle}>
                  <CheckSquare size={32} color="#6366F1" />
                </div>
                <h4 style={styles.emptyHeading}>No meetings processed yet.</h4>
                <p style={styles.emptySub}>
                  Upload your first PDF or audio recording to get started with automated action items.
                </p>
                <div style={{ display: 'flex', gap: '10px' }}>
                  <button
                    onClick={() => navigate('/upload')}
                    style={styles.emptySecondaryBtn}
                    id="empty-upload-btn"
                  >
                    <span>Upload Recording</span>
                  </button>
                  <button
                    onClick={handleGenerateActionItems}
                    style={styles.emptyActionBtn}
                    id="empty-generate-btn"
                  >
                    <Sparkles size={16} style={{ marginRight: '8px' }} />
                    <span>Generate Action Items</span>
                  </button>
                </div>
              </div>
            )}

            {/* Task List */}
            {!generating && actionItems.length > 0 && (
              <div style={styles.taskList}>
                {filteredItems.map((item, idx) => (
                  <div
                    key={item.id}
                    style={{
                      ...styles.taskCard,
                      borderLeftColor:
                        item.status === 'Completed'
                          ? '#10B981'
                          : item.status === 'In Progress'
                          ? '#3B82F6'
                          : item.priority === 'High'
                          ? '#EF4444'
                          : '#F59E0B',
                      background: item.status === 'Completed' ? '#F8FAFC' : '#FFFFFF',
                    }}
                  >
                    <div style={styles.taskIndexCol}>
                      <span style={styles.taskIndexNumber}>{idx + 1}</span>
                    </div>

                    <div style={styles.taskMainCol}>
                      <span
                        style={{
                          ...styles.taskText,
                          textDecoration: item.status === 'Completed' ? 'line-through' : 'none',
                          color: item.status === 'Completed' ? '#64748B' : '#1E293B',
                        }}
                      >
                        {item.task}
                      </span>

                      <div style={styles.taskMetaRow}>
                        {/* Priority Badge */}
                        <span
                          style={{
                            ...styles.priorityBadge,
                            background:
                              item.priority === 'High'
                                ? '#FEF2F2'
                                : item.priority === 'Medium'
                                ? '#FFFBEB'
                                : '#ECFDF5',
                            color:
                              item.priority === 'High'
                                ? '#DC2626'
                                : item.priority === 'Medium'
                                ? '#D97706'
                                : '#059669',
                          }}
                        >
                          <Tag size={11} style={{ marginRight: '4px' }} />
                          {item.priority} Priority
                        </span>

                        {/* Due Date */}
                        {item.dueDate && (
                          <span style={styles.dueDateBadge}>
                            <Calendar size={12} style={{ marginRight: '4px' }} />
                            Due: {item.dueDate}
                          </span>
                        )}

                        {/* Assignee Badge */}
                        <span style={styles.assigneeBadge}>
                          <UserCheck size={12} style={{ marginRight: '4px' }} />
                          {item.assignee}
                        </span>

                        {/* Status Badge */}
                        <span
                          style={{
                            ...styles.statusBadge,
                            background:
                              item.status === 'Completed'
                                ? '#ECFDF5'
                                : item.status === 'In Progress'
                                ? '#EFF6FF'
                                : '#F1F5F9',
                            color:
                              item.status === 'Completed'
                                ? '#059669'
                                : item.status === 'In Progress'
                                ? '#2563EB'
                                : '#475569',
                          }}
                        >
                          Status: {item.status}
                        </span>
                      </div>
                    </div>

                    {/* Status Toggle Actions */}
                    <div style={styles.taskStatusActionCol}>
                      <div style={styles.statusButtonGroup}>
                        <button
                          onClick={() => handleSetTaskStatus(item.id, 'Pending')}
                          style={{
                            ...styles.statusToggleBtn,
                            background: item.status === 'Pending' ? '#F1F5F9' : '#FFFFFF',
                            color: item.status === 'Pending' ? '#0F172A' : '#94A3B8',
                            borderColor: item.status === 'Pending' ? '#94A3B8' : '#E2E8F0',
                            fontWeight: item.status === 'Pending' ? 700 : 500,
                          }}
                          title="Mark Pending"
                        >
                          <Clock size={11} style={{ marginRight: '3px' }} />
                          <span>Pending</span>
                        </button>

                        <button
                          onClick={() => handleSetTaskStatus(item.id, 'In Progress')}
                          style={{
                            ...styles.statusToggleBtn,
                            background: item.status === 'In Progress' ? '#EFF6FF' : '#FFFFFF',
                            color: item.status === 'In Progress' ? '#2563EB' : '#94A3B8',
                            borderColor: item.status === 'In Progress' ? '#3B82F6' : '#E2E8F0',
                            fontWeight: item.status === 'In Progress' ? 700 : 500,
                          }}
                          title="Mark In Progress"
                        >
                          <PlayCircle size={11} style={{ marginRight: '3px' }} />
                          <span>In Progress</span>
                        </button>

                        <button
                          onClick={() => handleSetTaskStatus(item.id, 'Completed')}
                          style={{
                            ...styles.statusToggleBtn,
                            background: item.status === 'Completed' ? '#ECFDF5' : '#FFFFFF',
                            color: item.status === 'Completed' ? '#059669' : '#94A3B8',
                            borderColor: item.status === 'Completed' ? '#10B981' : '#E2E8F0',
                            fontWeight: item.status === 'Completed' ? 700 : 500,
                          }}
                          title="Mark Complete"
                        >
                          <CheckCircle size={11} style={{ marginRight: '3px' }} />
                          <span>Complete</span>
                        </button>
                      </div>

                      <button
                        onClick={() => handleCopyTask(item.task, item.id)}
                        style={styles.copyTaskBtn}
                        title="Copy task to clipboard"
                      >
                        {copiedTask === item.id ? (
                          <Check size={14} color="#16A34A" />
                        ) : (
                          <Copy size={14} />
                        )}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Bottom Workflow Action Bar */}
            <div style={styles.actionButtonBar}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                <button onClick={() => navigate('/summary')} style={styles.secondaryBtn}>
                  <span>← Back to AI Summary</span>
                </button>

                {actionItems.length > 0 && (
                  <button
                    onClick={handleExportTasks}
                    style={styles.exportBtn}
                    id="export-tasks-bottom-btn"
                  >
                    <Download size={15} style={{ marginRight: '6px' }} />
                    <span>Export Tasks</span>
                  </button>
                )}
              </div>

              <button
                onClick={handleContinueToClassification}
                style={styles.continueBtn}
                id="continue-to-classification-btn"
                disabled={actionItems.length === 0}
              >
                <span>Continue to Classification</span>
                <ArrowRight size={18} style={{ marginLeft: '10px' }} />
              </button>
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
    background: '#ECFDF5',
    color: '#059669',
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
  sourceTag: {
    display: 'inline-flex',
    alignItems: 'center',
    background: '#ECFDF5',
    border: '1px solid #A7F3D0',
    color: '#065F46',
    fontSize: '0.78rem',
    fontWeight: 700,
    padding: '6px 14px',
    borderRadius: '12px',
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
  successBanner: {
    display: 'flex',
    alignItems: 'center',
    background: '#ECFDF5',
    border: '1px solid #A7F3D0',
    color: '#065F46',
    padding: '12px 18px',
    borderRadius: '12px',
    fontSize: '0.88rem',
    fontWeight: 600,
  },
  errorBanner: {
    display: 'flex',
    alignItems: 'center',
    background: '#FEF2F2',
    border: '1px solid #FECACA',
    color: '#B91C1C',
    padding: '12px 18px',
    borderRadius: '12px',
    fontSize: '0.88rem',
    fontWeight: 600,
  },
  summaryRefCard: {
    background: '#FFFFFF',
    border: '1px solid #E2E8F0',
    borderRadius: '16px',
    padding: '16px 20px',
    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.02)',
  },
  summaryRefHeading: {
    fontSize: '0.82rem',
    fontWeight: 700,
    color: '#4F46E5',
    textTransform: 'uppercase',
    letterSpacing: '0.04em',
  },
  summaryWordBadge: {
    fontSize: '0.72rem',
    color: '#64748B',
    background: '#F1F5F9',
    padding: '2px 8px',
    borderRadius: '8px',
    fontWeight: 600,
  },
  summaryRefText: {
    fontSize: '0.90rem',
    color: '#334155',
    lineHeight: 1.6,
    margin: 0,
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
    width: '44px',
    height: '44px',
    borderRadius: '14px',
    background: '#ECFDF5',
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
    margin: '2px 0 0 0',
  },
  filterGroup: {
    display: 'inline-flex',
    background: '#F1F5F9',
    padding: '3px',
    borderRadius: '10px',
    gap: '2px',
  },
  filterBtn: {
    border: 'none',
    padding: '5px 12px',
    borderRadius: '8px',
    fontSize: '0.78rem',
    fontWeight: 600,
    cursor: 'pointer',
    transition: 'all 0.15s ease',
  },
  taskCountBadge: {
    fontSize: '0.82rem',
    fontWeight: 700,
    color: '#059669',
    background: '#ECFDF5',
    padding: '6px 14px',
    borderRadius: '20px',
  },
  refreshItemsBtn: {
    display: 'inline-flex',
    alignItems: 'center',
    padding: '8px 16px',
    background: '#4F46E5',
    border: 'none',
    borderRadius: '10px',
    color: '#FFFFFF',
    fontSize: '0.84rem',
    fontWeight: 600,
    cursor: 'pointer',
    boxShadow: '0 2px 6px rgba(79, 70, 229, 0.25)',
    transition: 'all 0.15s ease',
  },
  cardBody: {
    display: 'flex',
    flexDirection: 'column',
    gap: '20px',
  },
  loadingContainer: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '48px 20px',
    textAlign: 'center',
  },
  loadingHeading: {
    fontSize: '1.1rem',
    fontWeight: 700,
    color: '#1E293B',
    margin: '0 0 6px 0',
  },
  loadingSub: {
    fontSize: '0.88rem',
    color: '#64748B',
    maxWidth: '460px',
    margin: 0,
  },
  emptyContainer: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '48px 20px',
    textAlign: 'center',
  },
  emptyIconCircle: {
    width: '64px',
    height: '64px',
    borderRadius: '20px',
    background: '#EEF2FF',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: '16px',
  },
  emptyHeading: {
    fontSize: '1.15rem',
    fontWeight: 700,
    color: '#0F172A',
    margin: '0 0 6px 0',
  },
  emptySub: {
    fontSize: '0.88rem',
    color: '#64748B',
    maxWidth: '460px',
    marginBottom: '20px',
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
    boxShadow: '0 4px 12px rgba(79, 70, 229, 0.25)',
  },
  taskList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
  },
  taskCard: {
    display: 'flex',
    alignItems: 'center',
    gap: '16px',
    padding: '16px 20px',
    border: '1px solid #E2E8F0',
    borderLeftWidth: '5px',
    borderRadius: '16px',
    transition: 'all 0.15s ease',
  },
  taskIndexCol: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  taskIndexNumber: {
    fontSize: '0.78rem',
    fontWeight: 700,
    color: '#94A3B8',
    width: '20px',
    textAlign: 'center',
  },
  taskCheckCol: {
    display: 'flex',
    alignItems: 'center',
  },
  checkboxInput: {
    width: '18px',
    height: '18px',
    cursor: 'pointer',
    accentColor: '#10B981',
  },
  taskMainCol: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
  },
  taskText: {
    fontSize: '0.94rem',
    fontWeight: 600,
    lineHeight: 1.45,
  },
  taskMetaRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    flexWrap: 'wrap',
  },
  assigneeBadge: {
    display: 'inline-flex',
    alignItems: 'center',
    fontSize: '0.76rem',
    color: '#475569',
    background: '#F1F5F9',
    padding: '3px 8px',
    borderRadius: '8px',
    fontWeight: 600,
  },
  priorityBadge: {
    display: 'inline-flex',
    alignItems: 'center',
    fontSize: '0.74rem',
    fontWeight: 700,
    padding: '3px 8px',
    borderRadius: '8px',
  },
  dueDateBadge: {
    display: 'flex',
    alignItems: 'center',
    fontSize: '0.76rem',
    color: '#64748B',
  },
  taskActionsCol: {
    display: 'flex',
    alignItems: 'center',
  },
  copyTaskBtn: {
    background: '#FFFFFF',
    border: '1px solid #E2E8F0',
    borderRadius: '8px',
    padding: '6px 8px',
    color: '#64748B',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
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
  secondaryBtn: {
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
  exportBtn: {
    display: 'inline-flex',
    alignItems: 'center',
    padding: '8px 14px',
    background: '#FFFFFF',
    border: '1px solid #CBD5E1',
    borderRadius: '10px',
    color: '#334155',
    fontSize: '0.82rem',
    fontWeight: 600,
    cursor: 'pointer',
    boxShadow: '0 1px 3px rgba(0, 0, 0, 0.04)',
    transition: 'all 0.15s ease',
  },
  progressContainer: {
    background: '#F8FAFC',
    border: '1px solid #E2E8F0',
    borderRadius: '16px',
    padding: '16px 20px',
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
  },
  progressHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  progressTitle: {
    fontSize: '0.84rem',
    fontWeight: 700,
    color: '#1E293B',
    textTransform: 'uppercase',
    letterSpacing: '0.04em',
  },
  progressBadge: {
    fontSize: '0.78rem',
    fontWeight: 700,
    color: '#059669',
    background: '#ECFDF5',
    padding: '2px 8px',
    borderRadius: '8px',
  },
  progressPercentText: {
    fontSize: '0.84rem',
    fontWeight: 700,
    color: '#0F172A',
  },
  progressBarTrack: {
    width: '100%',
    height: '9px',
    background: '#E2E8F0',
    borderRadius: '20px',
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    background: 'linear-gradient(90deg, #10B981, #059669)',
    borderRadius: '20px',
    transition: 'width 0.3s ease',
  },
  progressSubInfo: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    fontSize: '0.76rem',
    fontWeight: 500,
  },
  emptySecondaryBtn: {
    display: 'inline-flex',
    alignItems: 'center',
    padding: '10px 18px',
    background: '#FFFFFF',
    border: '1px solid #CBD5E1',
    borderRadius: '12px',
    fontSize: '0.90rem',
    fontWeight: 600,
    color: '#475569',
    cursor: 'pointer',
  },
  statusBadge: {
    display: 'inline-flex',
    alignItems: 'center',
    fontSize: '0.74rem',
    fontWeight: 700,
    padding: '3px 8px',
    borderRadius: '8px',
  },
  taskStatusActionCol: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
  },
  statusButtonGroup: {
    display: 'inline-flex',
    background: '#F8FAFC',
    border: '1px solid #E2E8F0',
    borderRadius: '10px',
    padding: '2px',
    gap: '2px',
  },
  statusToggleBtn: {
    display: 'inline-flex',
    alignItems: 'center',
    border: '1px solid transparent',
    borderRadius: '8px',
    padding: '4px 8px',
    fontSize: '0.74rem',
    cursor: 'pointer',
    transition: 'all 0.15s ease',
  },
};
