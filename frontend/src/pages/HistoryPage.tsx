import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Clock,
  FileText,
  Mic,
  Search,
  Eye,
  Trash2,
  Download,
  ArrowUpDown,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  Layers,
  X,
  Copy,
  Check,
  RefreshCw,
  FolderOpen,
  Calendar,
  Tag,
  ListTodo,
  Printer,
  ShieldCheck,
  CopyPlus,
} from 'lucide-react';
import { SidebarLayout } from '../components/SidebarLayout';
import { historyApi, type HistoryMeetingItem, type HistoryStats } from '../api/history';
import { authApi } from '../api/auth';
import { notificationService } from '../services/notificationService';

type FilterType = 'ALL' | 'PDF' | 'AUDIO' | 'SUMMARY' | 'REPORT';

type SortOption = 'LATEST' | 'OLDEST' | 'A_Z' | 'Z_A';
type ViewMode = 'TIMELINE' | 'GRID';
type ModalTab = 'SUMMARY' | 'ACTIONS' | 'CLASSIFICATION' | 'TRANSCRIPT' | 'REPORT';

export const HistoryPage: React.FC = () => {
  const navigate = useNavigate();

  // Core Data States
  const [historyList, setHistoryList] = useState<HistoryMeetingItem[]>([]);
  const [stats, setStats] = useState<HistoryStats | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Search & Filter States
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [activeFilter, setActiveFilter] = useState<FilterType>('ALL');
  const [sortOption, setSortOption] = useState<SortOption>('LATEST');
  const [viewMode, setViewMode] = useState<ViewMode>('TIMELINE');

  // Modal States
  const [selectedMeeting, setSelectedMeeting] = useState<HistoryMeetingItem | null>(null);
  const [activeModalTab, setActiveModalTab] = useState<ModalTab>('SUMMARY');
  const [deleteTarget, setDeleteTarget] = useState<HistoryMeetingItem | null>(null);
  const [deleting, setDeleting] = useState<boolean>(false);
  const [copiedText, setCopiedText] = useState<boolean>(false);

  const showToast = useCallback((msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 4000);
  }, []);

  // Fetch real data from MongoDB collections
  const loadData = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setErrorMessage(null);

    try {
      const [meetingsData, statsData] = await Promise.all([
        historyApi.getHistoryList(),
        historyApi.getHistoryStats(),
      ]);
      setHistoryList(meetingsData || []);
      setStats(statsData || null);
      if (isRefresh) {
        showToast('Real-time history synchronized with cloud archive');
      }
    } catch (err: any) {
      console.error('Failed to load history:', err);
      setErrorMessage(err?.response?.data?.detail || err?.message || 'Failed to load cloud archive data');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [showToast]);

  useEffect(() => {
    const user = authApi.getCurrentUser();
    const token = authApi.getToken();
    if (!user || !token) {
      navigate('/');
      return;
    }

    loadData();

    // Auto-refresh when user returns to this tab / window focus
    const handleFocus = () => {
      loadData(true);
    };
    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, [navigate, loadData]);

  // Handle Delete Confirmation
  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await historyApi.deleteMeeting(deleteTarget.id);
      showToast(`Deleted "${deleteTarget.title}" record.`);
      const currentUser = authApi.getCurrentUser();
      if (currentUser?.id) {
        notificationService.addNotification(currentUser.id, {
          type: 'system',
          title: 'Meeting Record Deleted',
          message: `Removed "${deleteTarget.title}" from history archive.`,
        });
      }
      setDeleteTarget(null);
      if (selectedMeeting?.id === deleteTarget.id) {
        setSelectedMeeting(null);
      }
      // Re-fetch fresh live data
      await loadData(true);
    } catch (err: any) {
      console.error('Delete failed:', err);
      alert('Failed to delete meeting: ' + (err?.response?.data?.detail || err.message));
    } finally {
      setDeleting(false);
    }
  };

  // Handle Duplicate Meeting
  const handleDuplicateMeeting = (meeting: HistoryMeetingItem) => {
    const duplicatedItem: HistoryMeetingItem = {
      ...meeting,
      id: `dup-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      title: `${meeting.title} (Copy)`,
      uploadDate: new Date().toISOString(),
      formattedDate: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
    };

    setHistoryList((prev) => [duplicatedItem, ...prev]);
    showToast(`Duplicated "${meeting.title}" as new meeting record.`);

    const currentUser = authApi.getCurrentUser();
    if (currentUser?.id) {
      notificationService.addNotification(currentUser.id, {
        type: 'system',
        title: 'Meeting Duplicated',
        message: `Created duplicate record for "${meeting.title}"`,
      });
    }
  };

  // Filter & Search Logic
  const filteredAndSortedList = useMemo(() => {
    let list = [...historyList];

    // Filter by type: PDF, AUDIO, SUMMARY, REPORT
    if (activeFilter === 'PDF') {
      list = list.filter((item) => item.fileType === 'pdf');
    } else if (activeFilter === 'AUDIO') {
      list = list.filter((item) => item.fileType === 'audio');
    } else if (activeFilter === 'SUMMARY') {
      list = list.filter((item) => item.summaryStatus === 'Generated' || Boolean(item.summary));
    } else if (activeFilter === 'REPORT') {
      list = list.filter((item) => item.status === 'Completed' || item.summaryStatus === 'Generated');
    }

    // Search query matching
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter(
        (item) =>
          item.title?.toLowerCase().includes(q) ||
          item.fileName?.toLowerCase().includes(q) ||
          item.category?.toLowerCase().includes(q) ||
          item.summary?.toLowerCase().includes(q)
      );
    }

    // Sort
    list.sort((a, b) => {
      if (sortOption === 'LATEST') {
        return new Date(b.uploadDate || 0).getTime() - new Date(a.uploadDate || 0).getTime();
      }
      if (sortOption === 'OLDEST') {
        return new Date(a.uploadDate || 0).getTime() - new Date(b.uploadDate || 0).getTime();
      }
      if (sortOption === 'A_Z') {
        return (a.title || a.fileName || '').localeCompare(b.title || b.fileName || '');
      }
      if (sortOption === 'Z_A') {
        return (b.title || b.fileName || '').localeCompare(a.title || a.fileName || '');
      }
      return 0;
    });

    return list;
  }, [historyList, activeFilter, searchQuery, sortOption]);

  // Calculate filter counts
  const filterCounts = useMemo(() => {
    return {
      ALL: historyList.length,
      PDF: historyList.filter((i) => i.fileType === 'pdf').length,
      AUDIO: historyList.filter((i) => i.fileType === 'audio').length,
      SUMMARY: historyList.filter((i) => i.summaryStatus === 'Generated' || Boolean(i.summary)).length,
      REPORT: historyList.filter((i) => i.status === 'Completed' || i.summaryStatus === 'Generated').length,
    };
  }, [historyList]);

  // Export / Print PDF Dossier
  const handleDownloadPDF = (meeting: HistoryMeetingItem) => {
    const printWindow = window.open('', '_blank', 'width=900,height=800');
    if (!printWindow) {
      alert('Pop-up blocked. Please allow pop-ups to export the PDF dossier.');
      return;
    }

    const tasksHtml =
      meeting.actionItems && meeting.actionItems.length > 0
        ? meeting.actionItems
            .map(
              (t, idx) => `
          <tr style="border-bottom: 1px solid #e2e8f0;">
            <td style="padding: 10px; font-weight: 600;">#${idx + 1}</td>
            <td style="padding: 10px;">${t.task}</td>
            <td style="padding: 10px;"><span style="display:inline-block; padding: 2px 8px; border-radius: 6px; font-size: 12px; font-weight: 700; background: ${
              t.priority === 'High' ? '#FEE2E2; color: #991B1B' : '#FEF3C7; color: #92400E'
            };">${t.priority}</span></td>
            <td style="padding: 10px; color: #475569;">${t.owner || 'Student'}</td>
          </tr>`
            )
            .join('')
        : '<tr><td colspan="4" style="padding: 12px; text-align: center; color: #64748b;">No action items recorded</td></tr>';

    const pointsHtml =
      meeting.keyPoints && meeting.keyPoints.length > 0
        ? meeting.keyPoints.map((pt) => `<li style="margin-bottom: 6px;">${pt}</li>`).join('')
        : '<li>No key discussion points parsed</li>';

    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>MeetMind AI Executive Report - ${meeting.title}</title>
        <style>
          @page { size: A4; margin: 20mm; }
          body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
            color: #0f172a;
            line-height: 1.5;
            margin: 0;
            padding: 24px;
          }
          .header {
            border-bottom: 2px solid #4f46e5;
            padding-bottom: 16px;
            margin-bottom: 24px;
            display: flex;
            justify-content: space-between;
            align-items: flex-end;
          }
          .title { font-size: 24px; font-weight: 800; color: #1e1b4b; margin: 0 0 6px 0; }
          .meta-grid {
            display: grid;
            grid-template-columns: repeat(4, 1fr);
            gap: 12px;
            background: #f8fafc;
            padding: 14px;
            border-radius: 12px;
            border: 1px solid #e2e8f0;
            margin-bottom: 24px;
          }
          .meta-item { display: flex; flex-direction: column; }
          .meta-label { font-size: 11px; text-transform: uppercase; color: #64748b; font-weight: 700; }
          .meta-val { font-size: 13px; font-weight: 700; color: #0f172a; margin-top: 2px; }
          .section { margin-bottom: 24px; }
          .section-title {
            font-size: 16px;
            font-weight: 800;
            color: #312e81;
            border-bottom: 1px solid #e2e8f0;
            padding-bottom: 6px;
            margin-bottom: 12px;
          }
          .summary-box {
            background: #ffffff;
            border: 1px solid #cbd5e1;
            border-radius: 8px;
            padding: 14px;
            white-space: pre-wrap;
            font-size: 13px;
          }
          table { width: 100%; border-collapse: collapse; font-size: 13px; margin-top: 8px; }
          th { text-align: left; background: #f1f5f9; padding: 10px; color: #475569; font-size: 12px; }
          .footer {
            margin-top: 36px;
            padding-top: 12px;
            border-top: 1px solid #e2e8f0;
            font-size: 11px;
            color: #94a3b8;
            display: flex;
            justify-content: space-between;
          }
        </style>
      </head>
      <body>
        <div class="header">
          <div>
            <h1 class="title">MeetMind AI • Executive Session Dossier</h1>
            <div style="font-size: 13px; color: #6366f1; font-weight: 600;">Automated Meeting Intelligence & Classification Report</div>
          </div>
          <div style="text-align: right; font-size: 12px; color: #64748b;">
            <div>Session ID: <code>${meeting.id}</code></div>
            <div>Generated: ${new Date().toLocaleDateString()}</div>
          </div>
        </div>

        <div class="meta-grid">
          <div class="meta-item">
            <span class="meta-label">Document / Session</span>
            <span class="meta-val">${meeting.title}</span>
          </div>
          <div class="meta-item">
            <span class="meta-label">Source Format</span>
            <span class="meta-val">${meeting.sourceType}</span>
          </div>
          <div class="meta-item">
            <span class="meta-label">Uploaded Date</span>
            <span class="meta-val">${meeting.formattedDate}</span>
          </div>
          <div class="meta-item">
            <span class="meta-label">Classification</span>
            <span class="meta-val">${meeting.category} (${meeting.confidence}%)</span>
          </div>
        </div>

        <div class="section">
          <h2 class="section-title">1. Executive Summary</h2>
          <div class="summary-box">
            ${meeting.summary || 'Summary not yet generated for this meeting.'}
          </div>
        </div>

        ${
          meeting.keyPoints && meeting.keyPoints.length > 0
            ? `
        <div class="section">
          <h2 class="section-title">2. Key Strategic Takeaways</h2>
          <ul style="padding-left: 20px; font-size: 13px; color: #1e293b;">
            ${pointsHtml}
          </ul>
        </div>`
            : ''
        }

        <div class="section">
          <h2 class="section-title">3. Action Items & Commitments (${meeting.actionItemsCount} Tasks)</h2>
          <table>
            <thead>
              <tr>
                <th style="width: 40px;">No.</th>
                <th>Actionable Deliverable</th>
                <th style="width: 90px;">Priority</th>
                <th style="width: 120px;">Assigned</th>
              </tr>
            </thead>
            <tbody>
              ${tasksHtml}
            </tbody>
          </table>
        </div>

        <div class="section">
          <h2 class="section-title">4. Classification & NLP Intelligence</h2>
          <div style="background: #eef2ff; border: 1px solid #c7d2fe; padding: 12px; border-radius: 8px; font-size: 13px; color: #312e81;">
            <strong>Category:</strong> ${meeting.category} | <strong>Confidence:</strong> ${meeting.confidence}%<br/>
            <strong>Reasoning:</strong> ${meeting.reason || 'Categorized automatically based on extracted technical themes and keywords.'}
          </div>
        </div>

        <div class="footer">
          <span>Processed by MeetMind AI Platform (Meeting Intelligence Active)</span>
          <span>Official Verification Copy</span>
        </div>

        <script>
          window.onload = function() {
            window.print();
          };
        </script>
      </body>
      </html>
    `;

    printWindow.document.open();
    printWindow.document.write(htmlContent);
    printWindow.document.close();
  };

  const copyToClipboard = (text: string) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopiedText(true);
    setTimeout(() => setCopiedText(false), 2000);
  };

  return (
    <SidebarLayout>
      <div style={styles.pageContainer}>
        {/* Toast Notification */}
        {toastMessage && (
          <div style={styles.toast}>
            <CheckCircle2 size={18} color="#10B981" />
            <span>{toastMessage}</span>
          </div>
        )}

        {/* Header Row */}
        <div style={styles.headerRow}>
          <div>
            <div style={styles.topBadge}>
              <Clock size={13} color="#4F46E5" />
              <span>Meeting Intelligence Archive</span>
              <span style={styles.pulsingDot} />
            </div>
            <h1 style={styles.pageTitle}>Meeting History</h1>
            <p style={styles.pageSubtitle}>
              Audit trail of processed meetings, smart summaries, action items, and executive reports.
            </p>
          </div>

          <div style={styles.headerActions}>
            <button
              onClick={() => loadData(true)}
              style={styles.refreshBtn}
              title="Refresh live archive data"
              disabled={refreshing}
            >
              <RefreshCw
                size={16}
                color="#4F46E5"
                style={{
                  animation: refreshing ? 'spin 1s linear infinite' : 'none',
                  marginRight: '6px',
                }}
              />
              <span>{refreshing ? 'Syncing...' : 'Refresh Data'}</span>
            </button>

            <button onClick={() => navigate('/upload')} style={styles.uploadBtn}>
              <FolderOpen size={16} style={{ marginRight: '6px' }} />
              <span>Upload New File</span>
            </button>
          </div>
        </div>

        {/* Statistics Bar */}
        <div style={styles.statsGrid}>
          <div style={styles.statCard}>
            <div style={{ ...styles.statIconWrap, background: '#EEF2FF' }}>
              <Layers size={22} color="#4F46E5" />
            </div>
            <div>
              <div style={styles.statNumber}>
                {stats !== null ? stats.totalMeetings : historyList.length}
              </div>
              <div style={styles.statLabel}>Total Meetings</div>
            </div>
          </div>

          <div style={styles.statCard}>
            <div style={{ ...styles.statIconWrap, background: '#EFF6FF' }}>
              <FileText size={22} color="#2563EB" />
            </div>
            <div>
              <div style={styles.statNumber}>{stats !== null ? stats.totalPDFs : '—'}</div>
              <div style={styles.statLabel}>Total PDFs</div>
            </div>
          </div>

          <div style={styles.statCard}>
            <div style={{ ...styles.statIconWrap, background: '#F5F3FF' }}>
              <Mic size={22} color="#7C3AED" />
            </div>
            <div>
              <div style={styles.statNumber}>{stats !== null ? stats.totalAudio : '—'}</div>
              <div style={styles.statLabel}>Total Audio Files</div>
            </div>
          </div>

          <div style={styles.statCard}>
            <div style={{ ...styles.statIconWrap, background: '#ECFDF5' }}>
              <Sparkles size={22} color="#059669" />
            </div>
            <div>
              <div style={styles.statNumber}>{stats !== null ? stats.totalSummaries : '—'}</div>
              <div style={styles.statLabel}>Total Summaries</div>
            </div>
          </div>
        </div>

        {/* Search, Filter & Controls Row */}
        <div style={styles.controlsCard}>
          {/* Top Search Bar */}
          <div style={styles.searchBar}>
            <Search size={18} color="#94A3B8" style={{ marginLeft: '14px', flexShrink: 0 }} />
            <input
              type="text"
              placeholder="Search by meeting title, file name, or category..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={styles.searchInput}
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                style={styles.clearSearchBtn}
                title="Clear search"
              >
                <X size={16} color="#94A3B8" />
              </button>
            )}
          </div>

          {/* Filter Tabs & Sort Controls */}
          <div style={styles.filterAndSortRow}>
            {/* Filter Tabs: PDF, Audio, Summary, Report */}
            <div style={styles.filterPillsScroll}>
              {(
                [
                  { id: 'ALL', label: 'All Records' },
                  { id: 'PDF', label: 'PDF Documents' },
                  { id: 'AUDIO', label: 'Audio Recordings' },
                  { id: 'SUMMARY', label: 'Summaries' },
                  { id: 'REPORT', label: 'Reports' },
                ] as { id: FilterType; label: string }[]
              ).map((tab) => {
                const count = filterCounts[tab.id] ?? 0;
                const active = activeFilter === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveFilter(tab.id)}
                    style={{
                      ...styles.filterPill,
                      ...(active ? styles.filterPillActive : {}),
                    }}
                  >
                    <span>{tab.label}</span>
                    <span
                      style={{
                        ...styles.filterCountBadge,
                        ...(active ? styles.filterCountBadgeActive : {}),
                      }}
                    >
                      {count}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Sort & View Mode Controls */}
            <div style={styles.sortControlsWrap}>
              <div style={styles.sortSelectorWrap}>
                <ArrowUpDown size={14} color="#64748B" />
                <select
                  value={sortOption}
                  onChange={(e) => setSortOption(e.target.value as SortOption)}
                  style={styles.sortSelect}
                >
                  <option value="LATEST">Latest First</option>
                  <option value="OLDEST">Oldest First</option>
                  <option value="A_Z">A - Z</option>
                  <option value="Z_A">Z - A</option>
                </select>
              </div>

              {/* View Mode Toggle */}
              <div style={styles.viewToggleGroup}>
                <button
                  onClick={() => setViewMode('TIMELINE')}
                  style={{
                    ...styles.viewToggleBtn,
                    ...(viewMode === 'TIMELINE' ? styles.viewToggleBtnActive : {}),
                  }}
                  title="Timeline View"
                >
                  Timeline
                </button>
                <button
                  onClick={() => setViewMode('GRID')}
                  style={{
                    ...styles.viewToggleBtn,
                    ...(viewMode === 'GRID' ? styles.viewToggleBtnActive : {}),
                  }}
                  title="Card Grid View"
                >
                  Cards
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Error Alert */}
        {errorMessage && (
          <div style={styles.errorAlert}>
            <AlertCircle size={20} color="#DC2626" />
            <div>
              <strong>Archive Connection Notice:</strong> {errorMessage}
            </div>
          </div>
        )}

        {/* Loading State */}
        {loading && (
          <div style={styles.loadingContainer}>
            <RefreshCw size={28} color="#4F46E5" style={{ animation: 'spin 1s linear infinite' }} />
            <p style={{ marginTop: '12px', color: '#475569', fontWeight: 600 }}>
              Retrieving meeting records from cloud archive...
            </p>
          </div>
        )}

        {/* Empty State */}
        {!loading && filteredAndSortedList.length === 0 && (
          <div style={styles.emptyContainer}>
            <div style={styles.emptyIconCircle}>
              <FolderOpen size={36} color="#94A3B8" />
            </div>
            <h3 style={styles.emptyTitle}>
              {searchQuery ? 'No matching meetings found' : 'No meetings processed yet.'}
            </h3>
            <p style={styles.emptySubtitle}>
              {searchQuery
                ? `No sessions found matching "${searchQuery}". Try adjusting your filters.`
                : 'Upload your first PDF or audio recording to get started.'}
            </p>
            <button onClick={() => navigate('/upload')} style={styles.emptyActionBtn}>
              <FolderOpen size={16} style={{ marginRight: '8px' }} />
              <span>Go to Upload Page</span>
            </button>
          </div>
        )}

        {/* History Cards Display (Requirement 2 & 11) */}
        {!loading && filteredAndSortedList.length > 0 && (
          <div
            style={
              viewMode === 'TIMELINE' ? styles.timelineContainer : styles.cardGridContainer
            }
          >
            {filteredAndSortedList.map((item, index) => {
              const isPdf = item.fileType === 'pdf';
              const hasSummary = item.summaryStatus === 'Generated';
              const hasTranscript = item.transcriptStatus === 'Completed';

              return (
                <div key={item.id || index} style={styles.meetingCard}>
                  {/* Timeline connector marker */}
                  {viewMode === 'TIMELINE' && (
                    <div style={styles.timelineMarkerCol}>
                      <div
                        style={{
                          ...styles.timelineMarkerDot,
                          background: isPdf ? '#2563EB' : '#7C3AED',
                        }}
                      />
                      {index < filteredAndSortedList.length - 1 && (
                        <div style={styles.timelineLine} />
                      )}
                    </div>
                  )}

                  <div style={styles.cardMainContent}>
                    {/* Card Top: Source Type & Status Badge */}
                    <div style={styles.cardHeaderRow}>
                      <div style={styles.sourceTypeBadge}>
                        {isPdf ? (
                          <FileText size={14} color="#2563EB" style={{ marginRight: '6px' }} />
                        ) : (
                          <Mic size={14} color="#7C3AED" style={{ marginRight: '6px' }} />
                        )}
                        <span
                          style={{
                            fontWeight: 700,
                            color: isPdf ? '#1E40AF' : '#6D28D9',
                          }}
                        >
                          {item.sourceType}
                        </span>
                      </div>

                      <div style={styles.badgeRow}>
                        <span
                          style={{
                            ...styles.statusBadge,
                            ...(item.status === 'Completed'
                              ? styles.statusBadgeCompleted
                              : styles.statusBadgeProcessing),
                          }}
                        >
                          {item.status || 'Completed'}
                        </span>
                      </div>
                    </div>

                    {/* Meeting Title & File Name */}
                    <h3 style={styles.meetingTitle}>{item.title}</h3>
                    <div style={styles.fileNameRow}>
                      <span style={styles.fileNameText}>{item.fileName}</span>
                    </div>

                    {/* Meta Info Grid */}
                    <div style={styles.infoMetaGrid}>
                      <div style={styles.infoMetaItem}>
                        <span style={styles.infoMetaLabel}>Uploaded:</span>
                        <span style={styles.infoMetaValue}>
                          <Calendar size={12} style={{ marginRight: '4px' }} />
                          {item.formattedDate}
                        </span>
                      </div>

                      <div style={styles.infoMetaItem}>
                        <span style={styles.infoMetaLabel}>Summary:</span>
                        <span
                          style={{
                            ...styles.infoMetaBadge,
                            background: hasSummary ? '#ECFDF5' : '#FEF3C7',
                            color: hasSummary ? '#065F46' : '#92400E',
                          }}
                        >
                          {hasSummary ? 'Generated' : 'Pending'}
                        </span>
                      </div>

                      <div style={styles.infoMetaItem}>
                        <span style={styles.infoMetaLabel}>Transcript / Processing:</span>
                        <span
                          style={{
                            ...styles.infoMetaBadge,
                            background: hasTranscript ? '#EFF6FF' : '#F1F5F9',
                            color: hasTranscript ? '#1E40AF' : '#475569',
                          }}
                        >
                          {hasTranscript ? 'Completed' : 'Processing'}
                        </span>
                      </div>

                      <div style={styles.infoMetaItem}>
                        <span style={styles.infoMetaLabel}>Classification:</span>
                        <span style={styles.categoryPill}>
                          <Tag size={12} style={{ marginRight: '4px' }} />
                          {item.category}
                        </span>
                      </div>

                      <div style={styles.infoMetaItem}>
                        <span style={styles.infoMetaLabel}>Action Items:</span>
                        <span
                          style={{
                            ...styles.actionItemsBadge,
                            background:
                              item.actionItemsCount > 0 ? '#F5F3FF' : '#F8FAFC',
                            color: item.actionItemsCount > 0 ? '#6D28D9' : '#64748B',
                          }}
                        >
                          <ListTodo size={13} style={{ marginRight: '4px' }} />
                          {item.actionItemsCount} Tasks
                        </span>
                      </div>
                    </div>

                    {/* Card Actions Footer: View Details, Duplicate Meeting, Delete Record */}
                    <div style={styles.cardFooterActions}>
                      <button
                        onClick={() => {
                          setSelectedMeeting(item);
                          setActiveModalTab('SUMMARY');
                        }}
                        style={styles.viewDetailsBtn}
                        id={`view-details-${item.id}`}
                      >
                        <Eye size={15} style={{ marginRight: '6px' }} />
                        <span>View Details</span>
                      </button>

                      <button
                        onClick={() => handleDuplicateMeeting(item)}
                        style={styles.duplicateBtn}
                        title="Duplicate this meeting record"
                        id={`duplicate-meeting-${item.id}`}
                      >
                        <CopyPlus size={15} style={{ marginRight: '6px' }} />
                        <span>Duplicate</span>
                      </button>

                      <button
                        onClick={() => handleDownloadPDF(item)}
                        style={styles.downloadIconBtn}
                        title="Export Meeting Report as PDF"
                      >
                        <Download size={14} color="#475569" />
                        <span style={{ marginLeft: '4px' }}>PDF</span>
                      </button>

                      <button
                        onClick={() => setDeleteTarget(item)}
                        style={styles.deleteIconBtn}
                        title="Delete meeting record"
                        id={`delete-meeting-${item.id}`}
                      >
                        <Trash2 size={15} color="#DC2626" style={{ marginRight: '5px' }} />
                        <span>Delete</span>
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Complete Meeting Record Modal (Requirement 6) */}
        {selectedMeeting && (
          <div style={styles.modalOverlay} onClick={() => setSelectedMeeting(null)}>
            <div style={styles.modalCard} onClick={(e) => e.stopPropagation()}>
              {/* Modal Header */}
              <div style={styles.modalHeader}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span
                      style={{
                        ...styles.sourceTypeBadge,
                        background:
                          selectedMeeting.fileType === 'pdf' ? '#EFF6FF' : '#F5F3FF',
                        color:
                          selectedMeeting.fileType === 'pdf' ? '#1E40AF' : '#6D28D9',
                      }}
                    >
                      {selectedMeeting.sourceType}
                    </span>
                    <span style={styles.categoryPill}>{selectedMeeting.category}</span>
                    <span style={styles.modalDatePill}>
                      <Clock size={12} style={{ marginRight: '4px' }} />
                      {selectedMeeting.formattedDate}
                    </span>
                  </div>
                  <h2 style={styles.modalTitle}>{selectedMeeting.title}</h2>
                  <span style={styles.modalSub}>{selectedMeeting.fileName}</span>
                </div>

                <button
                  onClick={() => setSelectedMeeting(null)}
                  style={styles.modalCloseBtn}
                  title="Close modal"
                >
                  <X size={20} color="#64748B" />
                </button>
              </div>

              {/* Modal Tabs Navigation */}
              <div style={styles.modalTabsBar}>
                <button
                  onClick={() => setActiveModalTab('SUMMARY')}
                  style={{
                    ...styles.modalTabBtn,
                    ...(activeModalTab === 'SUMMARY' ? styles.modalTabBtnActive : {}),
                  }}
                >
                  <Sparkles size={15} style={{ marginRight: '6px' }} />
                  <span>AI Summary</span>
                </button>

                <button
                  onClick={() => setActiveModalTab('ACTIONS')}
                  style={{
                    ...styles.modalTabBtn,
                    ...(activeModalTab === 'ACTIONS' ? styles.modalTabBtnActive : {}),
                  }}
                >
                  <ListTodo size={15} style={{ marginRight: '6px' }} />
                  <span>Action Items ({selectedMeeting.actionItemsCount})</span>
                </button>

                <button
                  onClick={() => setActiveModalTab('CLASSIFICATION')}
                  style={{
                    ...styles.modalTabBtn,
                    ...(activeModalTab === 'CLASSIFICATION' ? styles.modalTabBtnActive : {}),
                  }}
                >
                  <Tag size={15} style={{ marginRight: '6px' }} />
                  <span>Classification ({selectedMeeting.category})</span>
                </button>

                <button
                  onClick={() => setActiveModalTab('TRANSCRIPT')}
                  style={{
                    ...styles.modalTabBtn,
                    ...(activeModalTab === 'TRANSCRIPT' ? styles.modalTabBtnActive : {}),
                  }}
                >
                  {selectedMeeting.fileType === 'pdf' ? (
                    <FileText size={15} style={{ marginRight: '6px' }} />
                  ) : (
                    <Mic size={15} style={{ marginRight: '6px' }} />
                  )}
                  <span>
                    {selectedMeeting.fileType === 'pdf' ? 'Extracted Text' : 'Transcript'}
                  </span>
                </button>

                <button
                  onClick={() => setActiveModalTab('REPORT')}
                  style={{
                    ...styles.modalTabBtn,
                    ...(activeModalTab === 'REPORT' ? styles.modalTabBtnActive : {}),
                  }}
                >
                  <Printer size={15} style={{ marginRight: '6px' }} />
                  <span>Generated Report</span>
                </button>
              </div>

              {/* Modal Tab Body */}
              <div style={styles.modalBody}>
                {/* 1. Summary Tab */}
                {activeModalTab === 'SUMMARY' && (
                  <div style={styles.tabContentWrap}>
                    <div style={styles.summaryBox}>
                      <div style={styles.boxHeaderRow}>
                        <h4 style={styles.boxHeading}>Executive Summary</h4>
                        <button
                          onClick={() => copyToClipboard(selectedMeeting.summary || '')}
                          style={styles.copyBtn}
                        >
                          {copiedText ? <Check size={14} color="#10B981" /> : <Copy size={14} />}
                          <span>{copiedText ? 'Copied' : 'Copy'}</span>
                        </button>
                      </div>
                      <div style={styles.summaryContentText}>
                        {selectedMeeting.summary || (
                          <span style={{ color: '#94A3B8' }}>
                            Summary has not been generated for this session yet.
                          </span>
                        )}
                      </div>
                    </div>

                    {selectedMeeting.keyPoints && selectedMeeting.keyPoints.length > 0 && (
                      <div style={{ marginTop: '16px' }}>
                        <h4 style={styles.boxHeading}>Key Discussion Takeaways</h4>
                        <ul style={styles.keyPointsList}>
                          {selectedMeeting.keyPoints.map((pt, idx) => (
                            <li key={idx} style={styles.keyPointItem}>
                              <span style={styles.keyPointBullet} />
                              <span>{pt}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                )}

                {/* 2. Action Items Tab */}
                {activeModalTab === 'ACTIONS' && (
                  <div style={styles.tabContentWrap}>
                    <div style={styles.boxHeaderRow}>
                      <h4 style={styles.boxHeading}>
                        Deliverables & Action Items ({selectedMeeting.actionItemsCount} Tasks)
                      </h4>
                    </div>

                    {selectedMeeting.actionItems && selectedMeeting.actionItems.length > 0 ? (
                      <div style={styles.tasksList}>
                        {selectedMeeting.actionItems.map((item, idx) => (
                          <div key={idx} style={styles.taskCard}>
                            <div style={styles.taskIndex}>{idx + 1}</div>
                            <div style={{ flex: 1 }}>
                              <p style={styles.taskText}>{item.task}</p>
                              <div style={styles.taskMetaRow}>
                                <span
                                  style={{
                                    ...styles.priorityBadge,
                                    background:
                                      item.priority === 'High' ? '#FEE2E2' : '#FEF3C7',
                                    color:
                                      item.priority === 'High' ? '#991B1B' : '#92400E',
                                  }}
                                >
                                  {item.priority} Priority
                                </span>
                                <span style={styles.ownerBadge}>
                                  Owner: {item.owner || 'Student'}
                                </span>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div style={styles.emptyBox}>
                        <p>No action items generated for this session.</p>
                      </div>
                    )}
                  </div>
                )}

                {/* 3. Classification Tab */}
                {activeModalTab === 'CLASSIFICATION' && (
                  <div style={styles.tabContentWrap}>
                    <div style={styles.classificationCard}>
                      <div style={styles.classHeader}>
                        <div>
                          <span style={styles.classLabel}>Predicted Taxonomy Category</span>
                          <h3 style={styles.classTitle}>{selectedMeeting.category}</h3>
                        </div>
                        <div style={styles.confidenceCircle}>
                          <span style={styles.confidenceNumber}>
                            {selectedMeeting.confidence}%
                          </span>
                          <span style={styles.confidenceLabel}>Confidence</span>
                        </div>
                      </div>

                      <div style={styles.reasonWrap}>
                        <div style={styles.reasonTitle}>
                          <ShieldCheck size={16} color="#4F46E5" style={{ marginRight: '6px' }} />
                          <span>AI Reason & Intelligence Attribution</span>
                        </div>
                        <p style={styles.reasonText}>
                          {selectedMeeting.reason ||
                            'Category assigned based on detected subject-matter keywords, meeting transcripts, and structural analysis.'}
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {/* 4. Transcript / Extracted Text Tab */}
                {activeModalTab === 'TRANSCRIPT' && (
                  <div style={styles.tabContentWrap}>
                    <div style={styles.boxHeaderRow}>
                      <h4 style={styles.boxHeading}>
                        {selectedMeeting.fileType === 'pdf'
                          ? 'Extracted Document Processing Content'
                          : 'Audio Speech-to-Text Transcript'}
                      </h4>
                      <button
                        onClick={() =>
                          copyToClipboard(
                            selectedMeeting.extractedText || selectedMeeting.transcript || ''
                          )
                        }
                        style={styles.copyBtn}
                      >
                        {copiedText ? <Check size={14} color="#10B981" /> : <Copy size={14} />}
                        <span>{copiedText ? 'Copied' : 'Copy Full Text'}</span>
                      </button>
                    </div>

                    <div style={styles.transcriptBox}>
                      {selectedMeeting.extractedText || selectedMeeting.transcript || (
                        <span style={{ color: '#94A3B8' }}>
                          No extracted text or transcript available for this file.
                        </span>
                      )}
                    </div>
                  </div>
                )}

                {/* 5. Generated Report Preview Tab */}
                {activeModalTab === 'REPORT' && (
                  <div style={styles.tabContentWrap}>
                    <div style={styles.reportPreviewCard}>
                      <div style={styles.reportBanner}>
                        <div>
                          <h4 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800 }}>
                            {selectedMeeting.title}
                          </h4>
                          <span style={{ fontSize: '0.8rem', opacity: 0.9 }}>
                            Official Dossier • {selectedMeeting.sourceType} •{' '}
                            {selectedMeeting.formattedDate}
                          </span>
                        </div>
                        <button
                          onClick={() => handleDownloadPDF(selectedMeeting)}
                          style={styles.printReportBtn}
                        >
                          <Download size={14} style={{ marginRight: '6px' }} />
                          <span>Export / Print PDF</span>
                        </button>
                      </div>

                      <div style={styles.reportSection}>
                        <h5 style={styles.reportSecHeading}>Executive Summary</h5>
                        <p style={{ fontSize: '0.88rem', color: '#334155', lineHeight: 1.6 }}>
                          {selectedMeeting.summary || 'Summary not yet generated.'}
                        </p>
                      </div>

                      <div style={styles.reportSection}>
                        <h5 style={styles.reportSecHeading}>
                          Action Deliverables ({selectedMeeting.actionItemsCount} items)
                        </h5>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                          {(selectedMeeting.actionItems || []).slice(0, 6).map((task, i) => (
                            <div key={i} style={styles.reportTaskLine}>
                              <span style={{ fontWeight: 700, color: '#4F46E5', width: '20px' }}>
                                •
                              </span>
                              <span style={{ flex: 1, fontSize: '0.84rem' }}>{task.task}</span>
                              <span
                                style={{
                                  fontSize: '0.72rem',
                                  fontWeight: 700,
                                  color: '#64748B',
                                }}
                              >
                                [{task.priority}]
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Modal Footer Actions */}
              <div style={styles.modalFooter}>
                <button
                  onClick={() => setDeleteTarget(selectedMeeting)}
                  style={styles.modalDeleteBtn}
                >
                  <Trash2 size={15} style={{ marginRight: '6px' }} />
                  <span>Delete Session</span>
                </button>

                <div style={{ display: 'flex', gap: '10px' }}>
                  <button
                    onClick={() => handleDownloadPDF(selectedMeeting)}
                    style={styles.modalDownloadBtn}
                  >
                    <Download size={15} style={{ marginRight: '6px' }} />
                    <span>Download Report PDF</span>
                  </button>
                  <button
                    onClick={() => setSelectedMeeting(null)}
                    style={styles.modalCloseMainBtn}
                  >
                    Close
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Delete Confirmation Dialog (Requirement 8) */}
        {deleteTarget && (
          <div style={styles.modalOverlay} onClick={() => setDeleteTarget(null)}>
            <div
              style={{ ...styles.modalCard, maxWidth: '480px' }}
              onClick={(e) => e.stopPropagation()}
            >
              <div style={styles.deleteDialogHeader}>
                <div style={styles.deleteWarnIconCircle}>
                  <Trash2 size={24} color="#DC2626" />
                </div>
                <h3 style={styles.deleteDialogTitle}>Delete Meeting Session?</h3>
                <p style={styles.deleteDialogDesc}>
                  Are you sure you want to permanently remove{' '}
                  <strong>"{deleteTarget.title}"</strong>?
                </p>
              </div>

              <div style={styles.deleteImpactBox}>
                <div style={styles.deleteImpactTitle}>
                  The following records will be permanently removed:
                </div>
                <ul style={styles.deleteImpactList}>
                  <li>• Document metadata & recording files</li>
                  <li>• Transcripts & processed document text</li>
                  <li>• Smart summaries & analytical highlights</li>
                  <li>• Action items & task deliverables</li>
                  <li>• Domain classification & confidence records</li>
                </ul>
              </div>

              <div style={styles.deleteDialogFooter}>
                <button
                  onClick={() => setDeleteTarget(null)}
                  style={styles.cancelBtn}
                  disabled={deleting}
                >
                  Cancel
                </button>
                <button
                  onClick={handleDeleteConfirm}
                  style={styles.confirmDeleteBtn}
                  disabled={deleting}
                >
                  {deleting ? 'Deleting Record...' : 'Yes, Delete Permanently'}
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
  pageContainer: {
    display: 'flex',
    flexDirection: 'column',
    gap: '24px',
    maxWidth: '1280px',
    margin: '0 auto',
    width: '100%',
  },
  toast: {
    position: 'fixed',
    top: '20px',
    right: '24px',
    background: '#1E293B',
    color: '#FFFFFF',
    padding: '12px 20px',
    borderRadius: '12px',
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    boxShadow: '0 10px 25px rgba(0, 0, 0, 0.2)',
    zIndex: 9999,
    fontSize: '0.88rem',
    fontWeight: 600,
  },
  headerRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    flexWrap: 'wrap',
    gap: '16px',
  },
  topBadge: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '8px',
    background: '#EEF2FF',
    color: '#4F46E5',
    padding: '4px 12px',
    borderRadius: '20px',
    fontSize: '0.78rem',
    fontWeight: 700,
    marginBottom: '8px',
  },
  pulsingDot: {
    width: '7px',
    height: '7px',
    borderRadius: '50%',
    background: '#10B981',
    boxShadow: '0 0 0 3px rgba(16, 185, 129, 0.2)',
  },
  pageTitle: {
    fontSize: '2rem',
    fontWeight: 800,
    color: '#0F172A',
    margin: 0,
    letterSpacing: '-0.025em',
  },
  pageSubtitle: {
    fontSize: '0.94rem',
    color: '#475569',
    margin: '6px 0 0 0',
  },
  headerActions: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
  },
  refreshBtn: {
    display: 'inline-flex',
    alignItems: 'center',
    padding: '10px 16px',
    background: '#FFFFFF',
    border: '1px solid #E2E8F0',
    borderRadius: '12px',
    color: '#4F46E5',
    fontSize: '0.86rem',
    fontWeight: 700,
    cursor: 'pointer',
    boxShadow: '0 1px 3px rgba(0, 0, 0, 0.04)',
    transition: 'all 0.15s ease',
  },
  uploadBtn: {
    display: 'inline-flex',
    alignItems: 'center',
    padding: '10px 18px',
    background: '#4F46E5',
    border: 'none',
    borderRadius: '12px',
    color: '#FFFFFF',
    fontSize: '0.86rem',
    fontWeight: 700,
    cursor: 'pointer',
    boxShadow: '0 4px 12px rgba(79, 70, 229, 0.25)',
    transition: 'all 0.15s ease',
  },
  statsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
    gap: '16px',
  },
  statCard: {
    background: '#FFFFFF',
    border: '1px solid #E2E8F0',
    borderRadius: '16px',
    padding: '18px 20px',
    display: 'flex',
    alignItems: 'center',
    gap: '16px',
    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.02)',
  },
  statIconWrap: {
    width: '46px',
    height: '46px',
    borderRadius: '12px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  statNumber: {
    fontSize: '1.6rem',
    fontWeight: 800,
    color: '#0F172A',
    lineHeight: 1.1,
  },
  statLabel: {
    fontSize: '0.78rem',
    fontWeight: 600,
    color: '#64748B',
    marginTop: '4px',
    textTransform: 'uppercase',
    letterSpacing: '0.03em',
  },
  controlsCard: {
    background: '#FFFFFF',
    border: '1px solid #E2E8F0',
    borderRadius: '20px',
    padding: '16px',
    display: 'flex',
    flexDirection: 'column',
    gap: '14px',
    boxShadow: '0 2px 10px rgba(0, 0, 0, 0.02)',
  },
  searchBar: {
    background: '#F8FAFC',
    border: '1px solid #E2E8F0',
    borderRadius: '14px',
    display: 'flex',
    alignItems: 'center',
    overflow: 'hidden',
  },
  searchInput: {
    flex: 1,
    border: 'none',
    outline: 'none',
    background: 'transparent',
    padding: '12px 14px',
    fontSize: '0.92rem',
    color: '#0F172A',
  },
  clearSearchBtn: {
    border: 'none',
    background: 'transparent',
    padding: '10px 14px',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterAndSortRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: '12px',
  },
  filterPillsScroll: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    overflowX: 'auto',
    paddingBottom: '2px',
  },
  filterPill: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px',
    padding: '6px 14px',
    background: '#F1F5F9',
    color: '#475569',
    border: '1px solid transparent',
    borderRadius: '20px',
    fontSize: '0.8rem',
    fontWeight: 700,
    cursor: 'pointer',
    whiteSpace: 'nowrap',
    transition: 'all 0.15s ease',
  },
  filterPillActive: {
    background: '#EEF2FF',
    color: '#4F46E5',
    borderColor: '#C7D2FE',
  },
  filterCountBadge: {
    background: '#E2E8F0',
    color: '#475569',
    fontSize: '0.72rem',
    padding: '1px 6px',
    borderRadius: '10px',
    fontWeight: 700,
  },
  filterCountBadgeActive: {
    background: '#4F46E5',
    color: '#FFFFFF',
  },
  sortControlsWrap: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
  },
  sortSelectorWrap: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    background: '#F8FAFC',
    border: '1px solid #E2E8F0',
    borderRadius: '10px',
    padding: '4px 10px',
  },
  sortSelect: {
    border: 'none',
    background: 'transparent',
    outline: 'none',
    fontSize: '0.82rem',
    fontWeight: 600,
    color: '#334155',
    cursor: 'pointer',
  },
  viewToggleGroup: {
    display: 'flex',
    background: '#F1F5F9',
    padding: '3px',
    borderRadius: '10px',
  },
  viewToggleBtn: {
    border: 'none',
    background: 'transparent',
    padding: '5px 12px',
    borderRadius: '8px',
    fontSize: '0.78rem',
    fontWeight: 700,
    color: '#64748B',
    cursor: 'pointer',
    transition: 'all 0.15s ease',
  },
  viewToggleBtnActive: {
    background: '#FFFFFF',
    color: '#4F46E5',
    boxShadow: '0 1px 4px rgba(0, 0, 0, 0.06)',
  },
  errorAlert: {
    background: '#FEF2F2',
    border: '1px solid #FCA5A5',
    color: '#991B1B',
    borderRadius: '14px',
    padding: '14px 18px',
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    fontSize: '0.88rem',
  },
  loadingContainer: {
    padding: '60px 20px',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    background: '#FFFFFF',
    borderRadius: '20px',
    border: '1px solid #E2E8F0',
  },
  emptyContainer: {
    padding: '60px 20px',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    background: '#FFFFFF',
    borderRadius: '20px',
    border: '1px solid #E2E8F0',
    textAlign: 'center',
  },
  emptyIconCircle: {
    width: '64px',
    height: '64px',
    borderRadius: '50%',
    background: '#F1F5F9',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: '16px',
  },
  emptyTitle: {
    fontSize: '1.2rem',
    fontWeight: 800,
    color: '#0F172A',
    margin: '0 0 6px 0',
  },
  emptySubtitle: {
    fontSize: '0.92rem',
    color: '#64748B',
    margin: '0 0 20px 0',
    maxWidth: '400px',
    whiteSpace: 'pre-line',
  },
  emptyActionBtn: {
    display: 'inline-flex',
    alignItems: 'center',
    padding: '10px 20px',
    background: '#4F46E5',
    color: '#FFFFFF',
    border: 'none',
    borderRadius: '12px',
    fontWeight: 700,
    fontSize: '0.88rem',
    cursor: 'pointer',
  },
  timelineContainer: {
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
    position: 'relative',
  },
  cardGridContainer: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))',
    gap: '20px',
  },
  meetingCard: {
    background: '#FFFFFF',
    border: '1px solid #E2E8F0',
    borderRadius: '20px',
    padding: '22px',
    display: 'flex',
    gap: '16px',
    boxShadow: '0 4px 14px rgba(0, 0, 0, 0.03)',
    transition: 'transform 0.15s ease, box-shadow 0.15s ease',
  },
  timelineMarkerCol: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    width: '24px',
    flexShrink: 0,
    paddingTop: '6px',
  },
  timelineMarkerDot: {
    width: '12px',
    height: '12px',
    borderRadius: '50%',
    boxShadow: '0 0 0 4px #EEF2FF',
  },
  timelineLine: {
    flex: 1,
    width: '2px',
    background: '#E2E8F0',
    marginTop: '6px',
  },
  cardMainContent: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
  },
  cardHeaderRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '10px',
  },
  sourceTypeBadge: {
    display: 'inline-flex',
    alignItems: 'center',
    fontSize: '0.78rem',
    fontWeight: 700,
    padding: '3px 10px',
    borderRadius: '8px',
    background: '#F8FAFC',
    border: '1px solid #E2E8F0',
  },
  badgeRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
  },
  statusBadge: {
    fontSize: '0.72rem',
    fontWeight: 700,
    padding: '3px 10px',
    borderRadius: '12px',
  },
  statusBadgeCompleted: {
    background: '#ECFDF5',
    color: '#059669',
  },
  statusBadgeProcessing: {
    background: '#FEF3C7',
    color: '#D97706',
  },
  meetingTitle: {
    fontSize: '1.18rem',
    fontWeight: 800,
    color: '#0F172A',
    margin: '0 0 4px 0',
    letterSpacing: '-0.015em',
  },
  fileNameRow: {
    fontSize: '0.8rem',
    color: '#64748B',
    marginBottom: '14px',
  },
  fileNameText: {
    display: 'inline-block',
    background: '#F1F5F9',
    padding: '2px 8px',
    borderRadius: '6px',
    fontFamily: 'monospace',
  },
  infoMetaGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
    gap: '10px',
    padding: '14px',
    background: '#F8FAFC',
    borderRadius: '14px',
    border: '1px solid #F1F5F9',
    marginBottom: '16px',
  },
  infoMetaItem: {
    display: 'flex',
    flexDirection: 'column',
    gap: '3px',
  },
  infoMetaLabel: {
    fontSize: '0.7rem',
    fontWeight: 700,
    color: '#64748B',
    textTransform: 'uppercase',
    letterSpacing: '0.03em',
  },
  infoMetaValue: {
    fontSize: '0.82rem',
    fontWeight: 600,
    color: '#1E293B',
    display: 'flex',
    alignItems: 'center',
  },
  infoMetaBadge: {
    display: 'inline-flex',
    alignItems: 'center',
    fontSize: '0.76rem',
    fontWeight: 700,
    padding: '2px 8px',
    borderRadius: '6px',
    width: 'fit-content',
  },
  categoryPill: {
    display: 'inline-flex',
    alignItems: 'center',
    background: '#EEF2FF',
    color: '#4F46E5',
    fontSize: '0.76rem',
    fontWeight: 700,
    padding: '2px 8px',
    borderRadius: '6px',
    width: 'fit-content',
  },
  actionItemsBadge: {
    display: 'inline-flex',
    alignItems: 'center',
    fontSize: '0.76rem',
    fontWeight: 700,
    padding: '2px 8px',
    borderRadius: '6px',
    width: 'fit-content',
  },
  cardFooterActions: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    marginTop: 'auto',
    paddingTop: '6px',
  },
  viewDetailsBtn: {
    flex: 1,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '9px 14px',
    background: '#4F46E5',
    color: '#FFFFFF',
    border: 'none',
    borderRadius: '10px',
    fontSize: '0.84rem',
    fontWeight: 700,
    cursor: 'pointer',
    transition: 'background 0.15s ease',
  },
  downloadIconBtn: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '9px 12px',
    background: '#F1F5F9',
    color: '#334155',
    border: '1px solid #E2E8F0',
    borderRadius: '10px',
    fontSize: '0.8rem',
    fontWeight: 600,
    cursor: 'pointer',
  },
  deleteIconBtn: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '9px 12px',
    background: '#FEE2E2',
    border: '1px solid #FECACA',
    borderRadius: '10px',
    cursor: 'pointer',
  },
  modalOverlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    background: 'rgba(15, 23, 42, 0.65)',
    backdropFilter: 'blur(4px)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
    padding: '20px',
  },
  modalCard: {
    background: '#FFFFFF',
    borderRadius: '24px',
    width: '100%',
    maxWidth: '820px',
    maxHeight: '90vh',
    display: 'flex',
    flexDirection: 'column',
    boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
    overflow: 'hidden',
  },
  modalHeader: {
    padding: '24px 28px',
    borderBottom: '1px solid #F1F5F9',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  modalTitle: {
    fontSize: '1.4rem',
    fontWeight: 800,
    color: '#0F172A',
    margin: '8px 0 2px 0',
  },
  modalSub: {
    fontSize: '0.84rem',
    color: '#64748B',
    fontFamily: 'monospace',
  },
  modalDatePill: {
    display: 'inline-flex',
    alignItems: 'center',
    fontSize: '0.74rem',
    color: '#64748B',
    fontWeight: 600,
  },
  modalCloseBtn: {
    border: 'none',
    background: '#F1F5F9',
    borderRadius: '50%',
    width: '36px',
    height: '36px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
  },
  modalTabsBar: {
    display: 'flex',
    background: '#F8FAFC',
    borderBottom: '1px solid #E2E8F0',
    padding: '0 24px',
    overflowX: 'auto',
  },
  modalTabBtn: {
    border: 'none',
    background: 'transparent',
    padding: '14px 16px',
    fontSize: '0.84rem',
    fontWeight: 700,
    color: '#64748B',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    borderBottom: '2px solid transparent',
    whiteSpace: 'nowrap',
  },
  modalTabBtnActive: {
    color: '#4F46E5',
    borderBottomColor: '#4F46E5',
    background: '#FFFFFF',
  },
  modalBody: {
    padding: '24px 28px',
    overflowY: 'auto',
    flex: 1,
  },
  tabContentWrap: {
    display: 'flex',
    flexDirection: 'column',
  },
  boxHeaderRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '12px',
  },
  boxHeading: {
    fontSize: '1.05rem',
    fontWeight: 800,
    color: '#0F172A',
    margin: 0,
  },
  copyBtn: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px',
    padding: '5px 12px',
    background: '#F1F5F9',
    border: '1px solid #CBD5E1',
    borderRadius: '8px',
    fontSize: '0.78rem',
    fontWeight: 600,
    color: '#334155',
    cursor: 'pointer',
  },
  summaryBox: {
    background: '#F8FAFC',
    border: '1px solid #E2E8F0',
    borderRadius: '16px',
    padding: '20px',
  },
  summaryContentText: {
    fontSize: '0.92rem',
    color: '#334155',
    lineHeight: 1.7,
    whiteSpace: 'pre-wrap',
  },
  keyPointsList: {
    listStyle: 'none',
    padding: 0,
    margin: '10px 0 0 0',
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
  },
  keyPointItem: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: '10px',
    fontSize: '0.88rem',
    color: '#1E293B',
    lineHeight: 1.5,
  },
  keyPointBullet: {
    width: '6px',
    height: '6px',
    borderRadius: '50%',
    background: '#4F46E5',
    marginTop: '7px',
    flexShrink: 0,
  },
  tasksList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
  },
  taskCard: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: '14px',
    padding: '14px 16px',
    background: '#F8FAFC',
    border: '1px solid #E2E8F0',
    borderRadius: '12px',
  },
  taskIndex: {
    width: '28px',
    height: '28px',
    borderRadius: '8px',
    background: '#EEF2FF',
    color: '#4F46E5',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontWeight: 800,
    fontSize: '0.8rem',
    flexShrink: 0,
  },
  taskText: {
    margin: 0,
    fontSize: '0.9rem',
    fontWeight: 600,
    color: '#0F172A',
    lineHeight: 1.4,
  },
  taskMetaRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    marginTop: '6px',
  },
  priorityBadge: {
    fontSize: '0.72rem',
    fontWeight: 700,
    padding: '2px 8px',
    borderRadius: '6px',
  },
  ownerBadge: {
    fontSize: '0.74rem',
    color: '#64748B',
    fontWeight: 600,
  },
  emptyBox: {
    padding: '40px',
    textAlign: 'center',
    color: '#94A3B8',
    background: '#F8FAFC',
    borderRadius: '14px',
  },
  classificationCard: {
    background: '#FFFFFF',
    border: '1px solid #E2E8F0',
    borderRadius: '18px',
    padding: '24px',
  },
  classHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: '20px',
    borderBottom: '1px solid #F1F5F9',
  },
  classLabel: {
    fontSize: '0.78rem',
    color: '#64748B',
    fontWeight: 700,
    textTransform: 'uppercase',
  },
  classTitle: {
    fontSize: '1.6rem',
    fontWeight: 800,
    color: '#4F46E5',
    margin: '4px 0 0 0',
  },
  confidenceCircle: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    background: '#ECFDF5',
    border: '1px solid #A7F3D0',
    padding: '10px 18px',
    borderRadius: '14px',
  },
  confidenceNumber: {
    fontSize: '1.4rem',
    fontWeight: 800,
    color: '#059669',
  },
  confidenceLabel: {
    fontSize: '0.7rem',
    fontWeight: 700,
    color: '#065F46',
    textTransform: 'uppercase',
  },
  reasonWrap: {
    marginTop: '20px',
  },
  reasonTitle: {
    display: 'flex',
    alignItems: 'center',
    fontSize: '0.9rem',
    fontWeight: 700,
    color: '#0F172A',
    marginBottom: '8px',
  },
  reasonText: {
    fontSize: '0.9rem',
    color: '#475569',
    lineHeight: 1.6,
    background: '#F8FAFC',
    padding: '14px 16px',
    borderRadius: '12px',
    border: '1px solid #E2E8F0',
    margin: 0,
  },
  transcriptBox: {
    background: '#F8FAFC',
    border: '1px solid #E2E8F0',
    borderRadius: '14px',
    padding: '18px',
    maxHeight: '340px',
    overflowY: 'auto',
    fontSize: '0.88rem',
    color: '#334155',
    lineHeight: 1.7,
    whiteSpace: 'pre-wrap',
    fontFamily: 'inherit',
  },
  reportPreviewCard: {
    background: '#FFFFFF',
    border: '1px solid #CBD5E1',
    borderRadius: '16px',
    padding: '24px',
  },
  reportBanner: {
    background: 'linear-gradient(135deg, #1E1B4B 0%, #312E81 100%)',
    color: '#FFFFFF',
    padding: '18px 20px',
    borderRadius: '12px',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '20px',
  },
  printReportBtn: {
    display: 'inline-flex',
    alignItems: 'center',
    padding: '8px 14px',
    background: '#FFFFFF',
    color: '#1E1B4B',
    border: 'none',
    borderRadius: '8px',
    fontSize: '0.8rem',
    fontWeight: 700,
    cursor: 'pointer',
  },
  reportSection: {
    marginBottom: '18px',
    borderBottom: '1px solid #F1F5F9',
    paddingBottom: '14px',
  },
  reportSecHeading: {
    fontSize: '0.94rem',
    fontWeight: 800,
    color: '#1E1B4B',
    margin: '0 0 8px 0',
  },
  reportTaskLine: {
    display: 'flex',
    alignItems: 'center',
    padding: '4px 0',
  },
  modalFooter: {
    padding: '18px 28px',
    borderTop: '1px solid #F1F5F9',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    background: '#FAFAFA',
  },
  modalDeleteBtn: {
    display: 'inline-flex',
    alignItems: 'center',
    padding: '9px 16px',
    background: '#FEE2E2',
    color: '#DC2626',
    border: '1px solid #FECACA',
    borderRadius: '10px',
    fontSize: '0.84rem',
    fontWeight: 700,
    cursor: 'pointer',
  },
  modalDownloadBtn: {
    display: 'inline-flex',
    alignItems: 'center',
    padding: '9px 18px',
    background: '#4F46E5',
    color: '#FFFFFF',
    border: 'none',
    borderRadius: '10px',
    fontSize: '0.84rem',
    fontWeight: 700,
    cursor: 'pointer',
  },
  modalCloseMainBtn: {
    padding: '9px 18px',
    background: '#FFFFFF',
    border: '1px solid #CBD5E1',
    borderRadius: '10px',
    fontSize: '0.84rem',
    fontWeight: 700,
    color: '#475569',
    cursor: 'pointer',
  },
  deleteDialogHeader: {
    padding: '24px 24px 12px 24px',
    textAlign: 'center',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
  },
  deleteWarnIconCircle: {
    width: '52px',
    height: '52px',
    borderRadius: '50%',
    background: '#FEE2E2',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: '12px',
  },
  deleteDialogTitle: {
    fontSize: '1.25rem',
    fontWeight: 800,
    color: '#0F172A',
    margin: '0 0 6px 0',
  },
  deleteDialogDesc: {
    fontSize: '0.9rem',
    color: '#475569',
    margin: 0,
    lineHeight: 1.5,
  },
  deleteImpactBox: {
    margin: '12px 24px',
    padding: '14px',
    background: '#FFF1F2',
    border: '1px solid #FFE4E6',
    borderRadius: '12px',
    fontSize: '0.82rem',
    color: '#9F1239',
  },
  deleteImpactTitle: {
    fontWeight: 700,
    marginBottom: '6px',
  },
  deleteImpactList: {
    listStyle: 'none',
    padding: 0,
    margin: 0,
    display: 'flex',
    flexDirection: 'column',
    gap: '3px',
    fontFamily: 'monospace',
  },
  deleteDialogFooter: {
    padding: '16px 24px',
    borderTop: '1px solid #F1F5F9',
    display: 'flex',
    justifyContent: 'flex-end',
    gap: '10px',
    background: '#FAFAFA',
  },
  cancelBtn: {
    padding: '10px 18px',
    background: '#FFFFFF',
    border: '1px solid #CBD5E1',
    borderRadius: '10px',
    fontSize: '0.84rem',
    fontWeight: 700,
    color: '#475569',
    cursor: 'pointer',
  },
  confirmDeleteBtn: {
    padding: '10px 20px',
    background: '#DC2626',
    color: '#FFFFFF',
    border: 'none',
    borderRadius: '10px',
    fontSize: '0.84rem',
    fontWeight: 700,
    cursor: 'pointer',
  },
  duplicateBtn: {
    display: 'inline-flex',
    alignItems: 'center',
    padding: '7px 12px',
    background: '#F8FAFC',
    border: '1px solid #CBD5E1',
    borderRadius: '10px',
    color: '#334155',
    fontSize: '0.80rem',
    fontWeight: 600,
    cursor: 'pointer',
    transition: 'all 0.15s ease',
  },
};
