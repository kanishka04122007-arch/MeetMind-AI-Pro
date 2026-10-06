import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Upload,
  FileText,
  Mic,
  Sparkles,
  RefreshCw,
  Copy,
  Check,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
  TrendingUp,
  Maximize2,
  X,
} from 'lucide-react';
import { SidebarLayout } from '../components/SidebarLayout';
import { authApi } from '../api/auth';
import { meetingsApi, type PDFDocumentItem, type MeetingAudioItem } from '../api/meetings';

export const Dashboard: React.FC = () => {
  const navigate = useNavigate();

  // ================= PDF STATE =================
  const pdfInputRef = useRef<HTMLInputElement>(null);
  const [selectedPdf, setSelectedPdf] = useState<File | null>(null);
  const [pdfTitle, setPdfTitle] = useState('');
  const [uploadingPdf, setUploadingPdf] = useState(false);
  const [extractingPdf, setExtractingPdf] = useState(false);
  const [currentPdfDoc, setCurrentPdfDoc] = useState<PDFDocumentItem | null>(null);
  const [extractedText, setExtractedText] = useState<string>('');
  const [pdfPageCount, setPdfPageCount] = useState<number>(0);
  const [pdfWordCount, setPdfWordCount] = useState<number>(0);
  const [pdfCharCount, setPdfCharCount] = useState<number>(0);
  const [pdfSuccessMsg, setPdfSuccessMsg] = useState<string | null>(null);
  const [pdfErrorMsg, setPdfErrorMsg] = useState<string | null>(null);

  // Helper to identify and discard outdated synthetic placeholder text
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

  // ================= AUDIO STATE =================
  const audioInputRef = useRef<HTMLInputElement>(null);
  const [selectedAudio, setSelectedAudio] = useState<File | null>(null);
  const [audioTitle, setAudioTitle] = useState('');
  const [uploadingAudio, setUploadingAudio] = useState(false);
  const [transcribingAudio, setTranscribingAudio] = useState(false);
  const [currentAudioMeeting, setCurrentAudioMeeting] = useState<MeetingAudioItem | null>(null);
  const [uploadedFileId, setUploadedFileId] = useState<string | null>(null);
  const [audioSuccessMsg, setAudioSuccessMsg] = useState<string | null>(null);
  const [audioErrorMsg, setAudioErrorMsg] = useState<string | null>(null);

  const [copiedPdf, setCopiedPdf] = useState(false);
  const [copiedAudio, setCopiedAudio] = useState(false);
  const [isFullTextModalOpen, setIsFullTextModalOpen] = useState(false);
  const [modalData, setModalData] = useState<{
    title: string;
    text: string;
    wordCount: number;
    type: 'pdf' | 'audio';
  } | null>(null);

  // ================= PERSISTENCE: LOAD LATEST FROM MONGODB ON PAGE LOAD =================
  useEffect(() => {
    const user = authApi.getCurrentUser();
    const token = authApi.getToken();

    if (!user || !token) {
      navigate('/');
      return;
    }

    let isMounted = true;

    // Fast-hydrate from localStorage first for zero-flicker reload
    try {
      const currentUser = authApi.getCurrentUser();
      const currentUserId = currentUser?.id || currentUser?._id;
      const cached = localStorage.getItem('meetmind_active_transcript');
      if (cached) {
        const parsed = JSON.parse(cached);
        if (parsed?.userId && parsed.userId !== currentUserId) {
          localStorage.removeItem('meetmind_active_transcript');
        } else if (parsed?.source_type === 'pdf' && parsed?.transcript && !isPlaceholderText(parsed.transcript)) {
          setExtractedText(parsed.transcript);
          setPdfWordCount(parsed.transcript.trim().split(/\s+/).filter(Boolean).length);
          setPdfCharCount(parsed.transcript.length);
          if (parsed.title) setPdfTitle(parsed.title);
        }
      }
    } catch {
      // ignore
    }

    const loadLatestFromMongoDB = async () => {
      try {
        let latestDoc = await meetingsApi.getLatestDocument();
        if (!latestDoc) {
          const docs = await meetingsApi.listDocuments();
          if (Array.isArray(docs) && docs.length > 0) {
            latestDoc = docs[0];
          }
        }

        if (isMounted && latestDoc) {
          setCurrentPdfDoc(latestDoc);
          if (latestDoc.title) {
            setPdfTitle(latestDoc.title);
          }
          const text =
            latestDoc.extracted_text ||
            (latestDoc as any).text ||
            (latestDoc as any).content ||
            '';
          if (text && text.trim().length > 0 && !isPlaceholderText(text)) {
            setExtractedText(text);
            const count =
              latestDoc.word_count ||
              text.trim().split(/\s+/).filter(Boolean).length;
            setPdfWordCount(count);
            setPdfPageCount(latestDoc.page_count || 1);
            setPdfCharCount(latestDoc.char_count || text.length);
          }
        }
      } catch (err) {
        console.warn('Could not load latest records from MongoDB:', err);
      }
    };

    loadLatestFromMongoDB();

    return () => {
      isMounted = false;
    };
  }, [navigate]);

  // ================= HANDLERS: PDF =================
  const handlePdfFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      if (!file.name.toLowerCase().endsWith('.pdf')) {
        setPdfErrorMsg('Please select a valid PDF file (.pdf).');
        setSelectedPdf(null);
        return;
      }
      setSelectedPdf(file);
      setPdfTitle(file.name.replace(/\.[^/.]+$/, ''));
      setPdfErrorMsg(null);
      setPdfSuccessMsg(null);
    }
  };

  const handleUploadPDF = async () => {
    if (!selectedPdf) {
      setPdfErrorMsg('Please choose a PDF file to upload.');
      return;
    }
    setUploadingPdf(true);
    setPdfErrorMsg(null);
    setPdfSuccessMsg(null);

    try {
      const doc = await meetingsApi.uploadPDF(selectedPdf, pdfTitle);
      setCurrentPdfDoc(doc);

      // Check if text was already extracted on upload
      const autoExtracted =
        doc.extracted_text ||
        (doc as any).text ||
        (doc as any).content ||
        '';

      if (autoExtracted && autoExtracted.trim().length > 0 && !isPlaceholderText(autoExtracted)) {
        setExtractedText(autoExtracted);
        const count =
          doc.word_count ||
          autoExtracted.trim().split(/\s+/).filter(Boolean).length;
        setPdfWordCount(count);
        setPdfPageCount(doc.page_count || 1);
        setPdfCharCount(doc.char_count || autoExtracted.length);
      }

      setPdfSuccessMsg(`PDF document "${doc.fileName}" uploaded and processed successfully.`);
    } catch (err: any) {
      setPdfErrorMsg(err.response?.data?.detail || 'Failed to upload PDF. Please try again.');
    } finally {
      setUploadingPdf(false);
    }
  };

  const handleExtractPdfText = async () => {
    const docId = currentPdfDoc?.id || (currentPdfDoc as any)?._id;
    if (!docId) {
      setPdfErrorMsg('Please upload a PDF file first.');
      return;
    }

    setExtractingPdf(true);
    setPdfErrorMsg(null);
    setPdfSuccessMsg(null);

    try {
      const response: any = await meetingsApi.extractPDFText(docId);

      // Support all response structures:
      // response.data.text || response.data.extracted_text || response.data.content
      const rawExtracted =
        response?.data?.text ||
        response?.data?.extracted_text ||
        response?.data?.content ||
        response?.text ||
        response?.extracted_text ||
        response?.content ||
        (typeof response === 'string' ? response : '') ||
        '';

      const extracted = isPlaceholderText(rawExtracted) ? '' : rawExtracted;

      const wordCount =
        response?.data?.word_count ??
        response?.word_count ??
        (extracted ? extracted.trim().split(/\s+/).filter(Boolean).length : 0);

      const pageCount =
        response?.data?.page_count ??
        response?.page_count ??
        currentPdfDoc?.page_count ??
        1;

      const charCount =
        response?.data?.char_count ??
        response?.char_count ??
        (extracted ? extracted.length : 0);

      // 1. Store extracted text and counts directly in React state
      setExtractedText(extracted);
      setPdfWordCount(wordCount);
      setPdfPageCount(pageCount);
      setPdfCharCount(charCount);

      // Update currentPdfDoc
      setCurrentPdfDoc((prev) =>
        prev
          ? {
              ...prev,
              extracted_text: extracted,
              word_count: wordCount,
              page_count: pageCount,
              char_count: charCount,
            }
          : {
              id: docId,
              title: pdfTitle || selectedPdf?.name || 'PDF Document',
              fileName: selectedPdf?.name || 'document.pdf',
              extracted_text: extracted,
              page_count: pageCount,
              word_count: wordCount,
              char_count: charCount,
              status: 'processed',
            }
      );

      // Persist active transcript to localStorage for instant cross-tab access
      try {
        const currentUser = authApi.getCurrentUser();
        const currentUserId = currentUser?.id || currentUser?._id;
        localStorage.setItem(
          'meetmind_active_transcript',
          JSON.stringify({
            transcript: extracted,
            file_id: docId,
            title: currentPdfDoc?.title || pdfTitle || selectedPdf?.name || 'PDF Document',
            source_type: 'pdf',
            userId: currentUserId,
          })
        );
      } catch {
        // ignore
      }

      setPdfSuccessMsg('Document text extracted successfully.');
    } catch (err: any) {
      setPdfErrorMsg(
        err.response?.data?.detail || err.message || 'Text extraction failed. Please try again.'
      );
    } finally {
      setExtractingPdf(false);
    }
  };

  // ================= HANDLERS: AUDIO =================
  const handleAudioFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      const validExts = ['.mp3', '.wav', '.mp4', '.m4a'];
      const isExtValid = validExts.some((ext) => file.name.toLowerCase().endsWith(ext));
      if (!isExtValid) {
        setAudioErrorMsg('Unsupported audio format. Only MP3, WAV, MP4, and M4A are supported.');
        setSelectedAudio(null);
        return;
      }
      setSelectedAudio(file);
      setAudioTitle(file.name.replace(/\.[^/.]+$/, ''));
      setAudioErrorMsg(null);
      setAudioSuccessMsg(null);
    }
  };

  const handleUploadAudio = async () => {
    if (!selectedAudio) {
      setAudioErrorMsg('Please choose an audio or video file to upload.');
      return;
    }

    const token = localStorage.getItem('token');
    if (!token || token.trim() === '' || token === 'undefined' || token === 'null') {
      setAudioErrorMsg('Please login again. Session expired.');
      authApi.logout();
      setTimeout(() => navigate('/'), 1500);
      return;
    }

    setUploadingAudio(true);
    setAudioErrorMsg(null);
    setAudioSuccessMsg(null);

    try {
      const meeting = await meetingsApi.uploadAudio(selectedAudio, audioTitle);
      const fileId = meeting.file_id || meeting.id || (meeting as any)._id;
      setUploadedFileId(fileId);
      setCurrentAudioMeeting(meeting);
      setAudioSuccessMsg('Audio recording uploaded successfully.');
    } catch (err: any) {
      const isAuthError = err.response?.status === 401 || err.message?.includes('Session expired');
      if (isAuthError) {
        setAudioErrorMsg('Please login again. Session expired.');
        authApi.logout();
        setTimeout(() => navigate('/'), 1500);
      } else {
        setAudioErrorMsg(err.response?.data?.detail || 'Failed to upload audio. Please try again.');
      }
    } finally {
      setUploadingAudio(false);
    }
  };

  const handleTranscribeAudio = async () => {
    const fileId = uploadedFileId || currentAudioMeeting?.file_id || currentAudioMeeting?.id || (currentAudioMeeting as any)?._id;
    if (!fileId) {
      setAudioErrorMsg('Please select and upload an audio file first.');
      return;
    }
    setTranscribingAudio(true);
    setAudioErrorMsg(null);
    setAudioSuccessMsg(null);

    try {
      const result = await meetingsApi.transcribeAudio(fileId);
      const transcriptText = result.transcript_text || result.transcript || '';
      setCurrentAudioMeeting((prev) =>
        prev
          ? { ...prev, transcript: transcriptText, transcript_text: transcriptText }
          : {
              id: fileId,
              file_id: fileId,
              title: audioTitle || selectedAudio?.name || 'Meeting Recording',
              fileName: selectedAudio?.name || 'recording.mp3',
              status: 'completed',
              transcript: transcriptText,
              transcript_text: transcriptText,
            }
      );
      setAudioSuccessMsg('Transcript generated successfully.');

      try {
        const currentUser = authApi.getCurrentUser();
        const currentUserId = currentUser?.id || currentUser?._id;
        localStorage.setItem(
          'meetmind_active_transcript',
          JSON.stringify({
            transcript: transcriptText,
            file_id: fileId,
            title: audioTitle || selectedAudio?.name || 'Meeting Recording',
            userId: currentUserId,
          })
        );
      } catch {
        // ignore
      }
    } catch (err: any) {
      console.error('[Dashboard] Transcribe failed:', err);
      setAudioErrorMsg(err?.response?.data?.detail || err?.message || 'Unable to generate transcript. Please try again.');
    } finally {
      setTranscribingAudio(false);
    }
  };

  const handleContinueToSummary = (text: string, fileId?: string, title?: string) => {
    const currentUser = authApi.getCurrentUser();
    const currentUserId = currentUser?.id || currentUser?._id;
    const payload = {
      transcript: text,
      file_id: fileId || '',
      title: title || 'Meeting Transcript',
      userId: currentUserId,
    };
    try {
      localStorage.setItem('meetmind_active_transcript', JSON.stringify(payload));
    } catch {
      // ignore
    }
    navigate('/summary', { state: payload });
  };

  const copyToClipboard = (text: string, type: 'pdf' | 'audio') => {
    navigator.clipboard.writeText(text);
    if (type === 'pdf') {
      setCopiedPdf(true);
      setTimeout(() => setCopiedPdf(false), 2000);
    } else {
      setCopiedAudio(true);
      setTimeout(() => setCopiedAudio(false), 2000);
    }
  };

  return (
    <SidebarLayout>
      <div style={styles.container}>
        {/* Welcome Banner - Clean SaaS Header (No Database or Collection Labels) */}
        <div style={styles.welcomeBanner}>
          <div style={styles.welcomeText}>
            <div style={styles.badgePill}>
              <TrendingUp size={14} color="#6366F1" style={{ marginRight: '6px' }} />
              <span>Smart Meeting Intelligence Studio</span>
            </div>
            <h1 style={styles.welcomeHeading}>Meeting Upload & Ingestion Workspace</h1>
            <p style={styles.welcomeSub}>
              Upload meeting PDF documents or audio recordings to automatically generate verified transcripts and structured meeting intelligence.
            </p>
          </div>
        </div>

        {/* 2-Column Grid */}
        <div style={styles.gridRow}>
          {/* ================= CARD 1: PDF DOCUMENT UPLOAD ================= */}
          <div style={styles.card}>
            <div style={styles.cardHeader}>
              <div style={styles.cardIconWrap}>
                <FileText size={22} color="#6366F1" />
              </div>
              <div>
                <h3 style={styles.cardTitle}>PDF Document Upload</h3>
                <p style={styles.cardDesc}>Upload agendas, minutes, or presentation documents</p>
              </div>
            </div>

            <div style={styles.cardBody}>
              <input
                type="file"
                ref={pdfInputRef}
                onChange={handlePdfFileChange}
                accept=".pdf,application/pdf"
                style={{ display: 'none' }}
              />

              <div onClick={() => pdfInputRef.current?.click()} style={styles.dropZone}>
                <div style={styles.dropZoneIcon}>
                  <FileText size={22} color="#6366F1" />
                </div>
                <div style={{ textAlign: 'center' }}>
                  <span style={styles.dropZonePrimaryText}>
                    {selectedPdf ? selectedPdf.name : 'Choose a PDF document'}
                  </span>
                  <span style={styles.dropZoneSubText}>
                    {selectedPdf
                      ? `${(selectedPdf.size / 1024).toFixed(1)} KB • Click to change file`
                      : 'Supported formats: .pdf'}
                  </span>
                </div>
              </div>

              <div style={{ marginTop: '14px' }}>
                <label style={styles.fieldLabel}>Document Title (Optional):</label>
                <input
                  type="text"
                  value={pdfTitle}
                  onChange={(e) => setPdfTitle(e.target.value)}
                  placeholder="e.g. Q4 Strategy Review"
                  style={styles.textInput}
                />
              </div>

              <div style={styles.actionBtnRow}>
                <button
                  onClick={handleUploadPDF}
                  disabled={!selectedPdf || uploadingPdf}
                  style={{
                    ...styles.primaryActionBtn,
                    opacity: !selectedPdf || uploadingPdf ? 0.6 : 1,
                    cursor: !selectedPdf || uploadingPdf ? 'not-allowed' : 'pointer',
                  }}
                  id="upload-pdf-btn"
                >
                  {uploadingPdf ? (
                    <>
                      <RefreshCw size={16} className="animate-spin" style={{ marginRight: '8px' }} />
                      <span>Uploading...</span>
                    </>
                  ) : (
                    <>
                      <Upload size={16} style={{ marginRight: '8px' }} />
                      <span>Upload PDF</span>
                    </>
                  )}
                </button>

                {currentPdfDoc && (
                  <button
                    onClick={handleExtractPdfText}
                    disabled={extractingPdf}
                    style={styles.secondaryActionBtn}
                    id="extract-pdf-text-btn"
                  >
                    {extractingPdf ? (
                      <>
                        <RefreshCw size={16} className="animate-spin" style={{ marginRight: '6px' }} />
                        <span>Extracting...</span>
                      </>
                    ) : (
                      <>
                        <Sparkles size={16} style={{ marginRight: '6px' }} />
                        <span>Extract Text</span>
                      </>
                    )}
                  </button>
                )}
              </div>

              {pdfErrorMsg && (
                <div style={styles.errorAlert}>
                  <AlertCircle size={16} style={{ marginRight: '8px', flexShrink: 0 }} />
                  <span>{pdfErrorMsg}</span>
                </div>
              )}
              {pdfSuccessMsg && (
                <div style={styles.successAlert}>
                  <CheckCircle2 size={16} style={{ marginRight: '8px', flexShrink: 0 }} />
                  <span>{pdfSuccessMsg}</span>
                </div>
              )}

              {/* Extracted Document Content Card */}
              <div style={styles.resultBox} id="extracted-document-content-card">
                <div style={styles.resultBoxHeader}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                    <FileText size={18} color="#6366F1" />
                    <span style={styles.resultBoxTitle}>Extracted Document Content</span>
                    <span style={styles.statusPill}>Ready</span>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    {Boolean(extractedText && extractedText.trim().length > 0) && (
                      <>
                        <button
                          onClick={() => {
                            setModalData({
                              title: currentPdfDoc?.title || pdfTitle || selectedPdf?.name || 'Extracted PDF Document',
                              text: extractedText,
                              wordCount: pdfWordCount || extractedText.trim().split(/\s+/).filter(Boolean).length,
                              type: 'pdf',
                            });
                            setIsFullTextModalOpen(true);
                          }}
                          style={styles.viewModalBtn}
                          title="Open full text in reader modal"
                          id="view-full-pdf-modal-btn"
                        >
                          <Maximize2 size={13} style={{ marginRight: '5px' }} />
                          <span>View Full Text</span>
                        </button>

                        <button
                          onClick={() => copyToClipboard(extractedText, 'pdf')}
                          style={styles.copyBtn}
                          title="Copy extracted text"
                          id="copy-pdf-text-btn"
                        >
                          {copiedPdf ? (
                            <>
                              <Check size={14} color="#16A34A" style={{ marginRight: '4px' }} />
                              <span style={{ color: '#16A34A', fontSize: '0.78rem', fontWeight: 600 }}>Copied</span>
                            </>
                          ) : (
                            <>
                              <Copy size={14} style={{ marginRight: '4px' }} />
                              <span style={{ fontSize: '0.78rem', fontWeight: 600 }}>Copy Text</span>
                            </>
                          )}
                        </button>
                      </>
                    )}
                  </div>
                </div>

                {/* Stats Badges: Page count, Word count, Character count (Requirement 8) */}
                {Boolean(extractedText && extractedText.trim().length > 0) && (
                  <div style={{ marginBottom: '12px', display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                    <span style={styles.wordCountBadge} id="pdf-page-count-badge">
                      Page Count: {pdfPageCount || currentPdfDoc?.page_count || 1}
                    </span>
                    <span style={styles.wordCountBadge} id="pdf-word-count-badge">
                      Word Count: {pdfWordCount || extractedText.trim().split(/\s+/).filter(Boolean).length}
                    </span>
                    <span style={styles.wordCountBadge} id="pdf-char-count-badge">
                      Character Count: {pdfCharCount || extractedText.length}
                    </span>
                  </div>
                )}

                {/* Scrollable text area (Requirement 2 & 3) */}
                <div style={styles.textContentArea}>
                  {extractedText && extractedText.trim().length > 0 ? (
                    <p style={styles.extractedParagraph} id="extracted-pdf-content">
                      {extractedText}
                    </p>
                  ) : (
                    <div style={styles.emptyPlaceholderWrap}>
                      <FileText size={22} color="#94A3B8" style={{ marginBottom: '6px' }} />
                      <span style={styles.emptyPlaceholderText}>
                        No documents uploaded yet.
                      </span>
                    </div>
                  )}
                </div>

                {/* Bottom Action: Continue to AI Summary */}
                {Boolean(extractedText && extractedText.trim().length > 0) && (
                  <div style={{ marginTop: '16px', display: 'flex', justifyContent: 'flex-end' }}>
                    <button
                      onClick={() =>
                        handleContinueToSummary(
                          extractedText,
                          currentPdfDoc?.id || (currentPdfDoc as any)?._id,
                          currentPdfDoc?.title || pdfTitle || selectedPdf?.name
                        )
                      }
                      style={styles.continueSummaryBtn}
                      id="continue-to-ai-summary-pdf-btn"
                    >
                      <Sparkles size={16} style={{ marginRight: '8px' }} />
                      <span>Continue to AI Summary</span>
                      <ArrowRight size={18} style={{ marginLeft: '8px' }} />
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* ================= CARD 2: AUDIO UPLOAD & TRANSCRIPTION ================= */}
          <div style={styles.card}>
            <div style={styles.cardHeader}>
              <div style={{ ...styles.cardIconWrap, background: '#F5F3FF' }}>
                <Mic size={22} color="#8B5CF6" />
              </div>
              <div>
                <h3 style={styles.cardTitle}>Audio Upload & Transcription</h3>
                <p style={styles.cardDesc}>Upload recorded meetings to generate verified transcripts</p>
              </div>
            </div>

            <div style={styles.cardBody}>
              <input
                type="file"
                ref={audioInputRef}
                onChange={handleAudioFileChange}
                accept=".mp3,.wav,.mp4,.m4a,audio/*,video/mp4"
                style={{ display: 'none' }}
              />

              <div onClick={() => audioInputRef.current?.click()} style={styles.dropZone}>
                <div style={{ ...styles.dropZoneIcon, background: '#F5F3FF' }}>
                  <Mic size={22} color="#8B5CF6" />
                </div>
                <div style={{ textAlign: 'center' }}>
                  <span style={styles.dropZonePrimaryText}>
                    {selectedAudio ? selectedAudio.name : 'Choose an Audio / Video recording'}
                  </span>
                  <span style={styles.dropZoneSubText}>
                    {selectedAudio
                      ? `${(selectedAudio.size / (1024 * 1024)).toFixed(2)} MB • Click to change file`
                      : 'Supported formats: MP3, WAV, MP4, M4A'}
                  </span>
                </div>
              </div>

              <div style={{ marginTop: '14px' }}>
                <label style={styles.fieldLabel}>Meeting Title (Optional):</label>
                <input
                  type="text"
                  value={audioTitle}
                  onChange={(e) => setAudioTitle(e.target.value)}
                  placeholder="e.g. Weekly Engineering Sync"
                  style={styles.textInput}
                />
              </div>

              <div style={styles.actionBtnRow}>
                <button
                  onClick={handleUploadAudio}
                  disabled={!selectedAudio || uploadingAudio}
                  style={{
                    ...styles.primaryActionBtn,
                    background: 'linear-gradient(135deg, #8B5CF6, #6366F1)',
                    opacity: !selectedAudio || uploadingAudio ? 0.6 : 1,
                    cursor: !selectedAudio || uploadingAudio ? 'not-allowed' : 'pointer',
                  }}
                  id="upload-audio-btn"
                >
                  {uploadingAudio ? (
                    <>
                      <RefreshCw size={16} className="animate-spin" style={{ marginRight: '8px' }} />
                      <span>Uploading...</span>
                    </>
                  ) : (
                    <>
                      <Upload size={16} style={{ marginRight: '8px' }} />
                      <span>Upload Audio</span>
                    </>
                  )}
                </button>

                {currentAudioMeeting && (
                  <button
                    onClick={handleTranscribeAudio}
                    disabled={transcribingAudio}
                    style={styles.secondaryActionBtn}
                    id="generate-transcript-btn"
                  >
                    {transcribingAudio ? (
                      <>
                        <RefreshCw size={16} className="animate-spin" style={{ marginRight: '6px' }} />
                        <span>Transcribing...</span>
                      </>
                    ) : (
                      <>
                        <Sparkles size={16} style={{ marginRight: '6px' }} />
                        <span>Generate Transcript</span>
                      </>
                    )}
                  </button>
                )}
              </div>

              {audioErrorMsg && (
                <div style={styles.errorAlert}>
                  <AlertCircle size={16} style={{ marginRight: '8px', flexShrink: 0 }} />
                  <span>{audioErrorMsg}</span>
                </div>
              )}
              {audioSuccessMsg && (
                <div style={styles.successAlert}>
                  <CheckCircle2 size={16} style={{ marginRight: '8px', flexShrink: 0 }} />
                  <span>{audioSuccessMsg}</span>
                </div>
              )}

              {currentAudioMeeting && (
                <div style={styles.resultBox}>
                  <div style={styles.resultBoxHeader}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <Mic size={16} color="#8B5CF6" />
                      <span style={styles.resultBoxTitle}>Meeting Transcript</span>
                      <span style={styles.statusPill}>Completed</span>
                    </div>
                    {(currentAudioMeeting.transcript || currentAudioMeeting.transcript_text) && (
                      <button
                        onClick={() =>
                          copyToClipboard(
                            currentAudioMeeting.transcript || currentAudioMeeting.transcript_text || '',
                            'audio'
                          )
                        }
                        style={styles.copyBtn}
                        title="Copy transcript"
                      >
                        {copiedAudio ? <Check size={14} color="#16A34A" /> : <Copy size={14} />}
                      </button>
                    )}
                  </div>

                  <div style={styles.textContentArea}>
                    {currentAudioMeeting.transcript || currentAudioMeeting.transcript_text ? (
                      <p style={styles.extractedParagraph}>
                        {currentAudioMeeting.transcript || currentAudioMeeting.transcript_text}
                      </p>
                    ) : (
                      <span style={{ color: '#94A3B8', fontStyle: 'italic', fontSize: '0.88rem' }}>
                        Transcription in progress or pending. Click "Generate Transcript" above.
                      </span>
                    )}
                  </div>

                  {Boolean(currentAudioMeeting.transcript || currentAudioMeeting.transcript_text) && (
                    <div style={{ marginTop: '16px', display: 'flex', justifyContent: 'flex-end' }}>
                      <button
                        onClick={() =>
                          handleContinueToSummary(
                            currentAudioMeeting.transcript || currentAudioMeeting.transcript_text || '',
                            currentAudioMeeting.file_id || currentAudioMeeting.id || uploadedFileId || undefined,
                            currentAudioMeeting.title || audioTitle || selectedAudio?.name
                          )
                        }
                        style={styles.continueSummaryBtn}
                        id="continue-to-ai-summary-btn"
                      >
                        <span>Continue to AI Summary</span>
                        <ArrowRight size={18} style={{ marginLeft: '8px' }} />
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ================= VIEW FULL TEXT MODAL ================= */}
      {isFullTextModalOpen && modalData && (
        <div style={styles.modalOverlay} onClick={() => setIsFullTextModalOpen(false)}>
          <div style={styles.modalContainer} onClick={(e) => e.stopPropagation()}>
            <div style={styles.modalHeader}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div
                  style={{
                    ...styles.modalIconWrap,
                    background: modalData.type === 'audio' ? '#F5F3FF' : '#EEF2FF',
                  }}
                >
                  {modalData.type === 'audio' ? (
                    <Mic size={22} color="#8B5CF6" />
                  ) : (
                    <FileText size={22} color="#6366F1" />
                  )}
                </div>
                <div>
                  <h3 style={styles.modalTitle}>{modalData.title}</h3>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px' }}>
                    <span
                      style={{
                        ...styles.statusPill,
                        background: modalData.type === 'audio' ? '#F5F3FF' : '#ECFDF5',
                        color: modalData.type === 'audio' ? '#7C3AED' : '#059669',
                      }}
                    >
                      {modalData.type === 'audio' ? 'Audio Transcript' : 'Extracted PDF Document'}
                    </span>
                    <span style={styles.wordCountBadge}>Word Count: {modalData.wordCount}</span>
                  </div>
                </div>
              </div>

              <button
                onClick={() => setIsFullTextModalOpen(false)}
                style={styles.modalCloseBtn}
                title="Close modal"
                id="modal-close-btn"
              >
                <X size={18} />
              </button>
            </div>

            <div style={styles.modalBody}>
              <div style={styles.modalTextarea}>
                <p style={{ ...styles.extractedParagraph, fontSize: '0.94rem', lineHeight: 1.75 }}>
                  {modalData.text}
                </p>
              </div>
            </div>

            <div style={styles.modalFooter}>
              <button
                onClick={() => copyToClipboard(modalData.text, modalData.type)}
                style={styles.modalSecondaryBtn}
                id="modal-copy-btn"
              >
                {modalData.type === 'pdf' ? (
                  copiedPdf ? (
                    <>
                      <Check size={16} color="#16A34A" style={{ marginRight: '6px' }} />
                      <span style={{ color: '#16A34A', fontWeight: 600 }}>Copied to Clipboard!</span>
                    </>
                  ) : (
                    <>
                      <Copy size={16} style={{ marginRight: '6px' }} />
                      <span>Copy Full Text</span>
                    </>
                  )
                ) : copiedAudio ? (
                  <>
                    <Check size={16} color="#16A34A" style={{ marginRight: '6px' }} />
                    <span style={{ color: '#16A34A', fontWeight: 600 }}>Copied to Clipboard!</span>
                  </>
                ) : (
                  <>
                    <Copy size={16} style={{ marginRight: '6px' }} />
                    <span>Copy Full Text</span>
                  </>
                )}
              </button>

              <button
                onClick={() => setIsFullTextModalOpen(false)}
                style={styles.modalPrimaryBtn}
                id="modal-done-btn"
              >
                <span>Close</span>
              </button>
            </div>
          </div>
        </div>
      )}
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
    padding: '28px 32px',
    boxShadow: '0 8px 24px rgba(99, 102, 241, 0.05)',
  },
  welcomeText: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
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
    width: 'fit-content',
  },
  welcomeHeading: {
    fontSize: '2rem',
    fontWeight: 800,
    color: '#0F172A',
    margin: 0,
    letterSpacing: '-0.025em',
  },
  welcomeSub: {
    fontSize: '0.96rem',
    color: '#475569',
    lineHeight: 1.6,
    margin: 0,
    maxWidth: '780px',
  },
  gridRow: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(460px, 1fr))',
    gap: '24px',
  },
  card: {
    background: '#FFFFFF',
    border: '1px solid #E2E8F0',
    borderRadius: '24px',
    padding: '28px',
    boxShadow: '0 4px 14px rgba(0, 0, 0, 0.03)',
    display: 'flex',
    flexDirection: 'column',
    gap: '18px',
  },
  cardHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: '14px',
    paddingBottom: '16px',
    borderBottom: '1px solid #F1F5F9',
  },
  cardIconWrap: {
    width: '44px',
    height: '44px',
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
  cardBody: {
    display: 'flex',
    flexDirection: 'column',
    gap: '14px',
  },
  dropZone: {
    border: '2px dashed #CBD5E1',
    borderRadius: '16px',
    padding: '28px 18px',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '10px',
    cursor: 'pointer',
    background: '#FAFAFD',
  },
  dropZoneIcon: {
    width: '42px',
    height: '42px',
    borderRadius: '12px',
    background: '#EEF2FF',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dropZonePrimaryText: {
    fontSize: '0.92rem',
    fontWeight: 600,
    color: '#1E293B',
    display: 'block',
  },
  dropZoneSubText: {
    fontSize: '0.78rem',
    color: '#94A3B8',
    marginTop: '2px',
    display: 'block',
  },
  fieldLabel: {
    fontSize: '0.82rem',
    fontWeight: 600,
    color: '#475569',
    display: 'block',
    marginBottom: '6px',
  },
  textInput: {
    width: '100%',
    padding: '10px 14px',
    borderRadius: '10px',
    border: '1px solid #CBD5E1',
    fontSize: '0.88rem',
    outline: 'none',
    boxSizing: 'border-box',
  },
  actionBtnRow: {
    display: 'flex',
    gap: '10px',
    flexWrap: 'wrap',
    marginTop: '4px',
  },
  primaryActionBtn: {
    flex: 1,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '11px 18px',
    borderRadius: '12px',
    background: 'linear-gradient(135deg, #6366F1, #8B5CF6)',
    color: '#FFFFFF',
    fontWeight: 600,
    fontSize: '0.88rem',
    border: 'none',
    boxShadow: '0 4px 12px rgba(99, 102, 241, 0.25)',
  },
  secondaryActionBtn: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '11px 18px',
    borderRadius: '12px',
    background: '#FFFFFF',
    color: '#4F46E5',
    fontWeight: 600,
    fontSize: '0.88rem',
    border: '1px solid #C7D2FE',
    cursor: 'pointer',
  },
  errorAlert: {
    display: 'flex',
    alignItems: 'center',
    padding: '10px 14px',
    background: '#FEF2F2',
    border: '1px solid #FECACA',
    color: '#DC2626',
    borderRadius: '10px',
    fontSize: '0.85rem',
  },
  successAlert: {
    display: 'flex',
    alignItems: 'center',
    padding: '10px 14px',
    background: '#F0FDF4',
    border: '1px solid #BBF7D0',
    color: '#16A34A',
    borderRadius: '10px',
    fontSize: '0.85rem',
  },
  resultBox: {
    background: '#F8FAFC',
    border: '1px solid #E2E8F0',
    borderRadius: '14px',
    padding: '16px',
    marginTop: '6px',
  },
  resultBoxHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '10px',
  },
  resultBoxTitle: {
    fontSize: '0.86rem',
    fontWeight: 700,
    color: '#1E293B',
  },
  statusPill: {
    fontSize: '0.72rem',
    fontWeight: 700,
    color: '#059669',
    background: '#ECFDF5',
    padding: '2px 8px',
    borderRadius: '10px',
  },
  copyBtn: {
    background: '#FFFFFF',
    border: '1px solid #CBD5E1',
    borderRadius: '8px',
    padding: '5px 8px',
    cursor: 'pointer',
    color: '#64748B',
  },
  textContentArea: {
    background: '#FFFFFF',
    border: '1px solid #E2E8F0',
    borderRadius: '10px',
    padding: '12px 14px',
    maxHeight: '180px',
    overflowY: 'auto',
  },
  extractedParagraph: {
    fontSize: '0.88rem',
    lineHeight: 1.6,
    color: '#334155',
    margin: 0,
    whiteSpace: 'pre-wrap',
  },
  wordCountBadge: {
    fontSize: '0.72rem',
    fontWeight: 700,
    color: '#4F46E5',
    background: '#EEF2FF',
    border: '1px solid #C7D2FE',
    padding: '2px 8px',
    borderRadius: '10px',
  },
  viewModalBtn: {
    display: 'inline-flex',
    alignItems: 'center',
    background: '#FFFFFF',
    border: '1px solid #CBD5E1',
    borderRadius: '8px',
    padding: '5px 10px',
    cursor: 'pointer',
    color: '#4F46E5',
    fontSize: '0.78rem',
    fontWeight: 600,
    boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
  },
  emptyPlaceholderWrap: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '20px 10px',
    textAlign: 'center',
  },
  emptyPlaceholderText: {
    color: '#94A3B8',
    fontStyle: 'italic',
    fontSize: '0.88rem',
  },
  modalOverlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    background: 'rgba(15, 23, 42, 0.65)',
    backdropFilter: 'blur(5px)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 9999,
    padding: '24px',
  },
  modalContainer: {
    background: '#FFFFFF',
    borderRadius: '24px',
    width: '100%',
    maxWidth: '800px',
    maxHeight: '85vh',
    display: 'flex',
    flexDirection: 'column',
    boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
    border: '1px solid #E2E8F0',
    overflow: 'hidden',
    animation: 'fadeIn 0.2s ease-out',
  },
  modalHeader: {
    padding: '20px 24px',
    borderBottom: '1px solid #E2E8F0',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    background: '#F8FAFC',
  },
  modalIconWrap: {
    width: '44px',
    height: '44px',
    borderRadius: '12px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalTitle: {
    margin: 0,
    fontSize: '1.15rem',
    fontWeight: 700,
    color: '#0F172A',
  },
  modalCloseBtn: {
    background: '#FFFFFF',
    border: '1px solid #E2E8F0',
    borderRadius: '10px',
    width: '36px',
    height: '36px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    color: '#64748B',
  },
  modalBody: {
    padding: '24px',
    overflowY: 'auto',
    flex: 1,
  },
  modalTextarea: {
    background: '#F8FAFC',
    border: '1px solid #E2E8F0',
    borderRadius: '14px',
    padding: '20px',
    minHeight: '260px',
  },
  modalFooter: {
    padding: '16px 24px',
    borderTop: '1px solid #E2E8F0',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    background: '#FFFFFF',
  },
  modalSecondaryBtn: {
    display: 'inline-flex',
    alignItems: 'center',
    padding: '10px 18px',
    borderRadius: '10px',
    background: '#F1F5F9',
    color: '#334155',
    fontWeight: 600,
    fontSize: '0.86rem',
    border: '1px solid #CBD5E1',
    cursor: 'pointer',
  },
  modalPrimaryBtn: {
    display: 'inline-flex',
    alignItems: 'center',
    padding: '10px 22px',
    borderRadius: '10px',
    background: '#4F46E5',
    color: '#FFFFFF',
    fontWeight: 600,
    fontSize: '0.86rem',
    border: 'none',
    cursor: 'pointer',
  },
  continueSummaryBtn: {
    display: 'inline-flex',
    alignItems: 'center',
    padding: '10px 20px',
    borderRadius: '12px',
    background: 'linear-gradient(135deg, #10B981, #059669)',
    color: '#FFFFFF',
    fontWeight: 700,
    fontSize: '0.9rem',
    border: 'none',
    cursor: 'pointer',
    boxShadow: '0 4px 12px rgba(16, 185, 129, 0.25)',
  },
};
