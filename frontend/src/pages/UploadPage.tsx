import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Upload,
  FileText,
  Mic,
  Brain,
  Square,
  Play,
  Pause,
  RotateCcw,
  Radio,
  Volume2,
  Sparkles,
  RefreshCw,
  Copy,
  Check,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
  Maximize2,
  X,
} from 'lucide-react';
import { SidebarLayout } from '../components/SidebarLayout';
import { meetingsApi, type PDFDocumentItem, type MeetingAudioItem } from '../api/meetings';
import { authApi } from '../api/auth';
import { notificationService } from '../services/notificationService';

export const UploadPage: React.FC = () => {
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

  // ================= AUDIO STATE (UPLOAD & LIVE RECORDING) =================
  const [audioMode, setAudioMode] = useState<'upload' | 'record'>('upload');
  const audioInputRef = useRef<HTMLInputElement>(null);
  const [selectedAudio, setSelectedAudio] = useState<File | null>(null);
  const [audioTitle, setAudioTitle] = useState('');
  const [uploadingAudio, setUploadingAudio] = useState(false);
  const [transcribingAudio, setTranscribingAudio] = useState(false);
  const [currentAudioMeeting, setCurrentAudioMeeting] = useState<MeetingAudioItem | null>(null);
  const [uploadedFileId, setUploadedFileId] = useState<string | null>(null);
  const [audioSuccessMsg, setAudioSuccessMsg] = useState<string | null>(null);
  const [audioErrorMsg, setAudioErrorMsg] = useState<string | null>(null);

  // Live Microphone Recording State
  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null);
  const [recordedAudioUrl, setRecordedAudioUrl] = useState<string | null>(null);
  const [recordingError, setRecordingError] = useState<string | null>(null);
  const [isProcessingLiveAudio, setIsProcessingLiveAudio] = useState(false);
  const [generatingSummaryDirect, setGeneratingSummaryDirect] = useState(false);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioStreamRef = useRef<MediaStream | null>(null);
  const timerIntervalRef = useRef<any>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // ================= MODAL & CLIPBOARD STATE =================
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
        // 1. Fetch latest uploaded PDF document from MongoDB
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

        // 2. Fetch latest audio meeting from MongoDB
        const audios = await meetingsApi.listMeetings();
        if (isMounted && Array.isArray(audios) && audios.length > 0) {
          const latestAudio = audios[0];
          setCurrentAudioMeeting(latestAudio);
          const fileId =
            latestAudio.file_id || latestAudio.id || (latestAudio as any)._id;
          if (fileId) {
            setUploadedFileId(fileId);
          }
          if (latestAudio.title) {
            setAudioTitle(latestAudio.title);
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
  }, []);

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
      try {
        const u = authApi.getCurrentUser();
        const uid = u?.id || u?._id;
        if (uid) {
          notificationService.addNotification(uid, {
            title: 'PDF Uploaded Successfully',
            message: `Document "${doc.fileName}" was uploaded and indexed.`,
            type: 'upload',
          });
        }
      } catch {
        // ignore
      }
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

      // Support all response structures per required specification:
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

      // 1. Store extracted text and stats directly in React state
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
      try {
        const u = authApi.getCurrentUser();
        const uid = u?.id || u?._id;
        if (uid) {
          notificationService.addNotification(uid, {
            title: 'Transcript Generated',
            message: `Document processing completed for "${currentPdfDoc?.title || selectedPdf?.name || 'PDF Document'}".`,
            type: 'transcript',
          });
        }
      } catch {
        // ignore
      }
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
      try {
        const u = authApi.getCurrentUser();
        const uid = u?.id || u?._id;
        if (uid) {
          notificationService.addNotification(uid, {
            title: 'Audio Uploaded Successfully',
            message: `Recording "${meeting.fileName || audioTitle || 'Audio file'}" was uploaded.`,
            type: 'upload',
          });
        }
      } catch {
        // ignore
      }
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
    const fileId =
      uploadedFileId ||
      currentAudioMeeting?.file_id ||
      currentAudioMeeting?.id ||
      (currentAudioMeeting as any)?._id;

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
        const u = authApi.getCurrentUser();
        const uid = u?.id || u?._id;
        if (uid) {
          notificationService.addNotification(uid, {
            title: 'Transcript Generated',
            message: `Speech recognition completed for "${audioTitle || selectedAudio?.name || 'Meeting Recording'}".`,
            type: 'transcript',
          });
        }
      } catch {
        // ignore
      }

      // Cache active transcript for smooth multi-step workflow
      try {
        const currentUser = authApi.getCurrentUser();
        const currentUserId = currentUser?.id || currentUser?._id;
        localStorage.setItem(
          'meetmind_active_transcript',
          JSON.stringify({
            transcript: transcriptText,
            file_id: fileId,
            title: audioTitle || selectedAudio?.name || 'Meeting Recording',
            source_type: 'audio',
            userId: currentUserId,
          })
        );
      } catch {
        // ignore
      }
    } catch (err: any) {
      console.error('[UploadPage] Transcribe failed:', err);
      setAudioErrorMsg(err?.response?.data?.detail || err?.message || 'Unable to generate transcript. Please try again.');
    } finally {
      setTranscribingAudio(false);
    }
  };

  const handleContinueToSummary = (text: string, fileId?: string, title?: string, type: 'pdf' | 'audio' = 'pdf') => {
    const currentUser = authApi.getCurrentUser();
    const currentUserId = currentUser?.id || currentUser?._id;
    const payload = {
      transcript: text || '',
      file_id: fileId || '',
      title: title || (type === 'audio' ? 'Meeting Recording' : 'PDF Document'),
      source_type: type,
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
    if (!text) return;
    navigator.clipboard.writeText(text);
    if (type === 'pdf') {
      setCopiedPdf(true);
      setTimeout(() => setCopiedPdf(false), 2000);
    } else {
      setCopiedAudio(true);
      setTimeout(() => setCopiedAudio(false), 2000);
    }
  };

  // Cleanup recording resources on unmount
  useEffect(() => {
    return () => {
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
      if (audioStreamRef.current) {
        audioStreamRef.current.getTracks().forEach((track) => track.stop());
      }
      if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
        audioContextRef.current.close().catch(() => {});
      }
      if (recordedAudioUrl) {
        URL.revokeObjectURL(recordedAudioUrl);
      }
    };
  }, [recordedAudioUrl]);

  // Format recording duration into MM:SS
  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Real-time audio waveform visualizer using Web Audio API
  const drawVisualizer = () => {
    if (!analyserRef.current || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const bufferLength = analyserRef.current.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    analyserRef.current.getByteFrequencyData(dataArray);

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const barCount = 36;
    const step = Math.max(1, Math.floor(bufferLength / barCount));
    const spacing = 3;
    const totalSpacing = (barCount - 1) * spacing;
    const barWidth = Math.max(2, (canvas.width - totalSpacing) / barCount);

    for (let i = 0; i < barCount; i++) {
      const value = dataArray[i * step] || 0;
      const barHeight = Math.max(4, (value / 255) * canvas.height * 0.95);
      const x = i * (barWidth + spacing);
      const y = (canvas.height - barHeight) / 2;

      const gradient = ctx.createLinearGradient(0, y, 0, y + barHeight);
      gradient.addColorStop(0, '#8B5CF6');
      gradient.addColorStop(1, '#EC4899');
      ctx.fillStyle = gradient;

      if ((ctx as any).roundRect) {
        ctx.beginPath();
        (ctx as any).roundRect(x, y, barWidth, barHeight, 3);
        ctx.fill();
      } else {
        ctx.fillRect(x, y, barWidth, barHeight);
      }
    }

    animationFrameRef.current = requestAnimationFrame(drawVisualizer);
  };

  // Start live microphone recording
  const startRecording = async () => {
    setRecordingError(null);
    setAudioErrorMsg(null);
    setAudioSuccessMsg(null);
    if (recordedAudioUrl) {
      URL.revokeObjectURL(recordedAudioUrl);
      setRecordedAudioUrl(null);
    }
    setRecordedBlob(null);

    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('Audio recording is not supported in this browser environment.');
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
      audioStreamRef.current = stream;

      // Set up Web Audio Analyser
      try {
        const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
        if (AudioCtx) {
          const audioCtx = new AudioCtx();
          audioContextRef.current = audioCtx;
          const source = audioCtx.createMediaStreamSource(stream);
          const analyser = audioCtx.createAnalyser();
          analyser.fftSize = 128;
          source.connect(analyser);
          analyserRef.current = analyser;
          drawVisualizer();
        }
      } catch (audioCtxErr) {
        console.warn('AudioContext visualization setup note:', audioCtxErr);
      }

      // Detect supported mimeType
      const preferredMimeTypes = [
        'audio/webm;codecs=opus',
        'audio/webm',
        'audio/ogg;codecs=opus',
        'audio/ogg',
        'audio/mp4',
      ];
      let selectedMime = '';
      for (const m of preferredMimeTypes) {
        if (MediaRecorder.isTypeSupported(m)) {
          selectedMime = m;
          break;
        }
      }

      const options: MediaRecorderOptions = selectedMime ? { mimeType: selectedMime } : {};
      const recorder = new MediaRecorder(stream, options);
      mediaRecorderRef.current = recorder;
      audioChunksRef.current = [];

      recorder.ondataavailable = (event: BlobEvent) => {
        if (event.data && event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      recorder.onstop = () => {
        const mime = recorder.mimeType || 'audio/webm';
        const blob = new Blob(audioChunksRef.current, { type: mime });
        setRecordedBlob(blob);
        const url = URL.createObjectURL(blob);
        setRecordedAudioUrl(url);

        if (!audioTitle || audioTitle.trim() === '') {
          const now = new Date();
          const formattedDate = now.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
          const formattedTime = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
          setAudioTitle(`Live Meeting - ${formattedDate}, ${formattedTime}`);
        }
      };

      recorder.start(500); // chunk every 500ms
      setIsRecording(true);
      setIsPaused(false);
      setRecordingDuration(0);

      timerIntervalRef.current = window.setInterval(() => {
        setRecordingDuration((prev) => prev + 1);
      }, 1000);
    } catch (err: any) {
      console.error('Microphone access failed:', err);
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        setRecordingError('Microphone permission denied. Please allow microphone access in your browser to record live audio.');
      } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
        setRecordingError('No microphone detected. Please plug in or enable an audio input device.');
      } else {
        setRecordingError(`Could not access microphone: ${err.message || 'Unknown error'}`);
      }
    }
  };

  // Pause recording
  const pauseRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.pause();
      setIsPaused(true);
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    }
  };

  // Resume recording
  const resumeRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'paused') {
      mediaRecorderRef.current.resume();
      setIsPaused(false);
      timerIntervalRef.current = window.setInterval(() => {
        setRecordingDuration((prev) => prev + 1);
      }, 1000);
    }
  };

  // Stop recording
  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    if (audioStreamRef.current) {
      audioStreamRef.current.getTracks().forEach((track) => track.stop());
    }
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = null;
    }
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      audioContextRef.current.close().catch(() => {});
    }
    setIsRecording(false);
    setIsPaused(false);
  };

  // Discard recording
  const discardRecording = () => {
    stopRecording();
    if (recordedAudioUrl) {
      URL.revokeObjectURL(recordedAudioUrl);
      setRecordedAudioUrl(null);
    }
    setRecordedBlob(null);
    setRecordingDuration(0);
    setRecordingError(null);
  };

  // Convert recorded browser audio Blob to standard 16-bit PCM WAV for 100% universal compatibility
  const convertBlobToWav = async (blob: Blob): Promise<Blob> => {
    try {
      const arrayBuffer = await blob.arrayBuffer();
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return blob;
      const audioCtx = new AudioCtx();
      const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);

      const numOfChan = Math.min(audioBuffer.numberOfChannels, 2);
      const sampleRate = audioBuffer.sampleRate;
      const dataLength = audioBuffer.length * numOfChan * 2;
      const totalLength = 44 + dataLength;
      const outBuffer = new ArrayBuffer(totalLength);
      const view = new DataView(outBuffer);

      const writeString = (v: DataView, offset: number, str: string) => {
        for (let i = 0; i < str.length; i++) {
          v.setUint8(offset + i, str.charCodeAt(i));
        }
      };

      // RIFF chunk descriptor
      writeString(view, 0, 'RIFF');
      view.setUint32(4, 36 + dataLength, true); // chunkSize = 36 + subChunk2Size
      writeString(view, 8, 'WAVE');

      // FMT sub-chunk
      writeString(view, 12, 'fmt ');
      view.setUint32(16, 16, true); // subChunk1Size (16 for PCM)
      view.setUint16(20, 1, true); // audioFormat (1 = PCM)
      view.setUint16(22, numOfChan, true);
      view.setUint32(24, sampleRate, true);
      view.setUint32(28, sampleRate * numOfChan * 2, true); // byteRate
      view.setUint16(32, numOfChan * 2, true); // blockAlign
      view.setUint16(34, 16, true); // 16 bits per sample

      // data sub-chunk
      writeString(view, 36, 'data');
      view.setUint32(40, dataLength, true);

      const channels: Float32Array[] = [];
      for (let i = 0; i < numOfChan; i++) {
        channels.push(audioBuffer.getChannelData(i));
      }

      let pos = 44;
      for (let offset = 0; offset < audioBuffer.length; offset++) {
        for (let i = 0; i < numOfChan; i++) {
          const sample = Math.max(-1, Math.min(1, channels[i][offset]));
          view.setInt16(pos, sample < 0 ? sample * 32768 : sample * 32767, true);
          pos += 2;
        }
      }

      audioCtx.close().catch(() => {});
      return new Blob([outBuffer], { type: 'audio/wav' });
    } catch (err) {
      console.warn('WAV conversion fallback to original blob:', err);
      return blob;
    }
  };

  // Save live recording to MongoDB Atlas and transcribe with Whisper AI
  const handleSaveAndTranscribeRecording = async () => {
    if (!recordedBlob) {
      setAudioErrorMsg('No live recording audio captured. Please record first.');
      return;
    }

    const token = localStorage.getItem('token');
    if (!token || token.trim() === '' || token === 'undefined' || token === 'null') {
      setAudioErrorMsg('Please login again. Session expired.');
      authApi.logout();
      setTimeout(() => navigate('/'), 1500);
      return;
    }

    setIsProcessingLiveAudio(true);
    setAudioErrorMsg(null);
    setAudioSuccessMsg(null);

    try {
      // Convert to universally supported PCM WAV format
      const wavBlob = await convertBlobToWav(recordedBlob);
      const isWav = wavBlob.type.includes('wav');
      const ext = isWav ? '.wav' : (recordedBlob.type?.includes('ogg') ? '.ogg' : '.webm');
      const mime = isWav ? 'audio/wav' : (recordedBlob.type || 'audio/webm');

      const safeTitle = (audioTitle && audioTitle.trim()) || `Live Meeting - ${new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;
      const filename = `live_meeting_${Date.now()}${ext}`;
      const file = new File([wavBlob], filename, { type: mime });

      // Step 1: Upload live audio recording to MongoDB Atlas 'files' collection
      const meeting = await meetingsApi.uploadAudio(file, safeTitle, true);
      const fileId = meeting.file_id || meeting.id || (meeting as any)._id;
      setUploadedFileId(fileId);
      setCurrentAudioMeeting(meeting);

      // Step 2: Transcribe via Whisper AI and persist to MongoDB Atlas 'transcripts' and 'meetings'
      const result = await meetingsApi.transcribeAudio(fileId);
      const transcriptText = result.transcript_text || result.transcript || '';

      setCurrentAudioMeeting((prev) =>
        prev
          ? { ...prev, transcript: transcriptText, transcript_text: transcriptText, is_live_recording: true }
          : {
              id: fileId,
              file_id: fileId,
              title: safeTitle,
              fileName: filename,
              status: 'completed',
              transcript: transcriptText,
              transcript_text: transcriptText,
              is_live_recording: true,
            }
      );

      setAudioSuccessMsg('Live recording transcribed successfully and saved to MongoDB Atlas!');

      // Cache active transcript for smooth navigation to AI Summary & ML Classification
      try {
        const currentUser = authApi.getCurrentUser();
        const currentUserId = currentUser?.id || currentUser?._id;
        const transcriptPayload = {
          transcript: transcriptText,
          summary: transcriptText,
          text: transcriptText,
          file_id: fileId,
          title: safeTitle,
          source_type: 'audio',
          is_live_recording: true,
          userId: currentUserId,
        };
        localStorage.setItem('meetmind_active_transcript', JSON.stringify(transcriptPayload));
        localStorage.setItem('meetmind_active_summary', JSON.stringify(transcriptPayload));
      } catch {
        // ignore
      }

      try {
        const u = authApi.getCurrentUser();
        const uid = u?.id || u?._id;
        if (uid) {
          notificationService.addNotification(uid, {
            title: 'Live Recording Transcribed',
            message: `Speech recognition completed for "${safeTitle}". Saved in MongoDB Atlas.`,
            type: 'transcript',
          });
        }
      } catch {
        // ignore
      }
    } catch (err: any) {
      console.error('[UploadPage] Live recording transcribe failed:', err);
      const isAuthError = err.response?.status === 401 || err.message?.includes('Session expired');
      if (isAuthError) {
        setAudioErrorMsg('Please login again. Session expired.');
        authApi.logout();
        setTimeout(() => navigate('/'), 1500);
      } else {
        setAudioErrorMsg(err.response?.data?.detail || err.message || 'Failed to process live recording. Please try again.');
      }
    } finally {
      setIsProcessingLiveAudio(false);
    }
  };

  // Navigate directly to Machine Learning classification page
  const handleContinueToClassification = (text: string, fileId?: string, title?: string) => {
    const currentUser = authApi.getCurrentUser();
    const currentUserId = currentUser?.id || currentUser?._id;
    const payload = {
      transcript: text || '',
      summary: text || '',
      text: text || '',
      file_id: fileId || '',
      title: title || (audioMode === 'record' ? 'Live Meeting Recording' : 'Meeting Recording'),
      userId: currentUserId,
    };
    try {
      localStorage.setItem('meetmind_active_transcript', JSON.stringify(payload));
      localStorage.setItem('meetmind_active_summary', JSON.stringify(payload));
    } catch {
      // ignore
    }
    navigate('/classification', { state: payload });
  };

  // One-click generate summary and jump directly to summary page
  const handleDirectGenerateSummary = async () => {
    const text = currentAudioMeeting?.transcript || currentAudioMeeting?.transcript_text || '';
    const fileId = uploadedFileId || currentAudioMeeting?.file_id || currentAudioMeeting?.id || (currentAudioMeeting as any)?._id;
    const title = currentAudioMeeting?.title || audioTitle || 'Live Meeting Recording';

    if (!text || text.trim().length === 0) {
      setAudioErrorMsg('No transcript available yet. Please transcribe the recording first.');
      return;
    }

    setGeneratingSummaryDirect(true);
    setAudioErrorMsg(null);
    setAudioSuccessMsg(null);

    try {
      const summaryRes = await meetingsApi.generateSummary(fileId, text, title);
      const currentUser = authApi.getCurrentUser();
      const currentUserId = currentUser?.id || currentUser?._id;
      const payload = {
        transcript: text,
        file_id: fileId,
        title: title,
        source_type: 'audio',
        userId: currentUserId,
        summary: summaryRes.summary,
        key_points: summaryRes.key_points,
      };

      try {
        localStorage.setItem('meetmind_active_transcript', JSON.stringify(payload));
      } catch {
        // ignore
      }

      setAudioSuccessMsg('AI Summary generated successfully and stored in MongoDB Atlas!');
      navigate('/summary', { state: payload });
    } catch (err: any) {
      console.error('[UploadPage] Summary generation failed:', err);
      setAudioErrorMsg(err.response?.data?.detail || err.message || 'Failed to generate summary. Please try again.');
    } finally {
      setGeneratingSummaryDirect(false);
    }
  };

  return (
    <SidebarLayout>
      <div style={styles.contentContainer}>
        {/* Page Header */}
        <div style={styles.headerRow}>
          <div>
            <div style={styles.badgePill}>
              <Upload size={14} color="#6366F1" style={{ marginRight: '6px' }} />
              <span>Step 1: Content Ingestion</span>
            </div>
            <h1 style={styles.pageTitle}>Upload & Transcript</h1>
            <p style={styles.pageSubtitle}>
              Upload meeting documents or audio recordings, extract verified text, and jump to AI Summaries.
            </p>
          </div>
        </div>

        {/* ================= 2-COLUMN GRID ================= */}
        <div style={styles.gridRow}>
          {/* ================= CARD 1: PDF DOCUMENT UPLOAD ================= */}
          <div style={styles.card}>
            <div style={styles.cardHeader}>
              <div style={styles.cardIconWrap}>
                <FileText size={22} color="#6366F1" />
              </div>
              <div>
                <h3 style={styles.cardTitle}>PDF Document Upload</h3>
                <p style={styles.cardDesc}>Upload agendas, minutes, reports, or strategy documents</p>
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
                      : 'Supported format: .pdf'}
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

              {/* Action Buttons Row */}
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

              {/* "Go to Summary" Button directly under upload & extract buttons as requested */}
              {currentPdfDoc && (
                <button
                  onClick={() =>
                    handleContinueToSummary(
                      extractedText || currentPdfDoc.extracted_text || '',
                      currentPdfDoc.id || (currentPdfDoc as any)._id,
                      currentPdfDoc.title || pdfTitle || selectedPdf?.name,
                      'pdf'
                    )
                  }
                  style={styles.goToSummaryDirectBtn}
                  id="go-to-summary-pdf-direct-btn"
                  title="Jump directly to AI Summary for this document"
                >
                  <Sparkles size={16} style={{ marginRight: '8px' }} />
                  <span>Go to Summary</span>
                  <ArrowRight size={16} style={{ marginLeft: '8px' }} />
                </button>
              )}

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

                {/* Bottom Actions: Classify with ML Model & Continue to AI Summary */}
                {Boolean(extractedText && extractedText.trim().length > 0) && (
                  <div style={{ marginTop: '16px', display: 'flex', gap: '10px', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                    <button
                      onClick={() =>
                        handleContinueToClassification(
                          extractedText,
                          currentPdfDoc?.id || (currentPdfDoc as any)?._id,
                          currentPdfDoc?.title || pdfTitle || selectedPdf?.name
                        )
                      }
                      style={{
                        ...styles.secondaryActionBtn,
                        background: '#EEF2FF',
                        color: '#4F46E5',
                        border: '1px solid #C7D2FE',
                        fontWeight: 700,
                      }}
                      id="classify-ml-pdf-btn"
                      title="Run Scikit-Learn Machine Learning model to classify meeting category"
                    >
                      <Brain size={16} style={{ marginRight: '6px' }} />
                      <span>Classify with ML Model</span>
                    </button>

                    <button
                      onClick={() =>
                        handleContinueToSummary(
                          extractedText,
                          currentPdfDoc?.id || (currentPdfDoc as any)?._id,
                          currentPdfDoc?.title || pdfTitle || selectedPdf?.name,
                          'pdf'
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

          {/* ================= CARD 2: AUDIO INTELLIGENCE (UPLOAD & LIVE RECORDING) ================= */}
          <div style={styles.card}>
            <div style={styles.cardHeader}>
              <div style={{ ...styles.cardIconWrap, background: '#F5F3FF' }}>
                <Mic size={22} color="#8B5CF6" />
              </div>
              <div style={{ flex: 1 }}>
                <h3 style={styles.cardTitle}>Audio Intelligence & Speech AI</h3>
                <p style={styles.cardDesc}>Upload audio files or capture live meeting speech for AI transcription & summary</p>
              </div>
            </div>

            {/* Segmented Mode Selector: File Upload vs Live Recording */}
            <div style={styles.modeTabsWrap}>
              <button
                type="button"
                onClick={() => setAudioMode('upload')}
                style={{
                  ...styles.modeTabBtn,
                  ...(audioMode === 'upload' ? styles.modeTabBtnActive : {}),
                }}
                id="audio-mode-upload-tab"
              >
                <Upload size={15} style={{ marginRight: '6px' }} />
                <span>Upload Audio File</span>
              </button>

              <button
                type="button"
                onClick={() => setAudioMode('record')}
                style={{
                  ...styles.modeTabBtn,
                  ...(audioMode === 'record' ? styles.modeTabBtnActive : {}),
                }}
                id="audio-mode-record-tab"
              >
                {isRecording ? (
                  <span style={styles.livePulseDotActive} />
                ) : (
                  <Radio size={15} color={audioMode === 'record' ? '#7C3AED' : '#64748B'} style={{ marginRight: '6px' }} />
                )}
                <span>Live Audio Recording</span>
                <span style={styles.liveBadgeMini}>LIVE</span>
              </button>
            </div>

            <div style={styles.cardBody}>
              {/* ================= MODE 1: FILE UPLOAD ================= */}
              {audioMode === 'upload' && (
                <>
                  <input
                    type="file"
                    ref={audioInputRef}
                    onChange={handleAudioFileChange}
                    accept=".mp3,.wav,.mp4,.m4a,.webm,.weba,.ogg,audio/*,video/mp4"
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
                          : 'Supported formats: MP3, WAV, MP4, M4A, WebM, OGG'}
                      </span>
                    </div>
                  </div>

                  <div style={{ marginTop: '10px' }}>
                    <label style={styles.fieldLabel}>Meeting Title (Optional):</label>
                    <input
                      type="text"
                      value={audioTitle}
                      onChange={(e) => setAudioTitle(e.target.value)}
                      placeholder="e.g. Weekly Engineering Sync"
                      style={styles.textInput}
                    />
                  </div>

                  {/* Action Buttons Row */}
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
                </>
              )}

              {/* ================= MODE 2: LIVE AUDIO RECORDING STUDIO ================= */}
              {audioMode === 'record' && (
                <div style={styles.recorderStudioCard}>
                  {/* Top HUD: Status & Digital Stopwatch */}
                  <div style={styles.recorderHudRow}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      {isRecording && <span style={styles.livePulseDotActive} />}
                      <span
                        style={{
                          fontSize: '0.85rem',
                          fontWeight: 700,
                          color: isRecording ? '#DC2626' : isPaused ? '#D97706' : recordedBlob ? '#16A34A' : '#64748B',
                        }}
                      >
                        {isRecording
                          ? 'RECORDING LIVE AUDIO...'
                          : isPaused
                          ? 'RECORDING PAUSED'
                          : recordedBlob
                          ? 'AUDIO CAPTURE READY'
                          : 'MICROPHONE READY'}
                      </span>
                    </div>

                    <div style={styles.timerHudBadge}>
                      <span style={styles.timerMonoText}>{formatDuration(recordingDuration)}</span>
                    </div>
                  </div>

                  {/* Waveform / Visualizer Display */}
                  <div style={styles.visualizerContainer}>
                    <canvas
                      ref={canvasRef}
                      width={440}
                      height={48}
                      style={{
                        width: '100%',
                        height: '48px',
                        display: isRecording ? 'block' : 'none',
                      }}
                    />
                    {!isRecording && !recordedBlob && (
                      <div style={styles.visualizerIdleWrap}>
                        <Mic size={22} color="#8B5CF6" style={{ marginBottom: '4px' }} />
                        <span style={styles.visualizerIdleText}>
                          Click "Start Recording" to speak into your microphone in real time.
                        </span>
                      </div>
                    )}
                    {!isRecording && recordedBlob && (
                      <div style={styles.visualizerIdleWrap}>
                        <CheckCircle2 size={22} color="#16A34A" style={{ marginBottom: '4px' }} />
                        <span style={{ fontSize: '0.82rem', color: '#16A34A', fontWeight: 600 }}>
                          Live speech captured ({formatDuration(recordingDuration)}). Listen below or transcribe.
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Playback Preview Player if recorded */}
                  {recordedAudioUrl && (
                    <div style={styles.audioPreviewBox}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px' }}>
                        <Volume2 size={15} color="#6366F1" />
                        <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#334155' }}>
                          Playback Preview:
                        </span>
                      </div>
                      <audio controls src={recordedAudioUrl} style={{ width: '100%', height: '38px' }} />
                    </div>
                  )}

                  {/* Meeting Title Input */}
                  <div>
                    <label style={styles.fieldLabel}>Meeting Title:</label>
                    <input
                      type="text"
                      value={audioTitle}
                      onChange={(e) => setAudioTitle(e.target.value)}
                      placeholder="e.g. Live Client Sync - Oct 8, 2026"
                      style={styles.textInput}
                    />
                  </div>

                  {/* Recording Controls */}
                  <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginTop: '6px' }}>
                    {/* State A: Idle (No active recording and no recorded blob yet) */}
                    {!isRecording && !recordedBlob && (
                      <button
                        type="button"
                        onClick={startRecording}
                        style={styles.startRecordBtn}
                        id="start-live-recording-btn"
                      >
                        <Mic size={18} style={{ marginRight: '8px' }} />
                        <span>Start Recording</span>
                      </button>
                    )}

                    {/* State B: Actively Recording */}
                    {isRecording && (
                      <>
                        <button
                          type="button"
                          onClick={isPaused ? resumeRecording : pauseRecording}
                          style={styles.recordControlSecondaryBtn}
                          id="pause-resume-recording-btn"
                        >
                          {isPaused ? (
                            <>
                              <Play size={16} style={{ marginRight: '6px' }} />
                              <span>Resume</span>
                            </>
                          ) : (
                            <>
                              <Pause size={16} style={{ marginRight: '6px' }} />
                              <span>Pause</span>
                            </>
                          )}
                        </button>

                        <button
                          type="button"
                          onClick={stopRecording}
                          style={styles.stopRecordBtn}
                          id="stop-live-recording-btn"
                        >
                          <Square size={16} style={{ marginRight: '6px' }} />
                          <span>Stop Recording</span>
                        </button>

                        <button
                          type="button"
                          onClick={discardRecording}
                          style={styles.discardRecordBtn}
                          title="Cancel and discard current recording"
                        >
                          <RotateCcw size={16} style={{ marginRight: '6px' }} />
                          <span>Cancel</span>
                        </button>
                      </>
                    )}

                    {/* State C: Recording Captured and Ready to Transcribe & Save to MongoDB Atlas */}
                    {!isRecording && recordedBlob && (
                      <>
                        <button
                          type="button"
                          onClick={handleSaveAndTranscribeRecording}
                          disabled={isProcessingLiveAudio}
                          style={{
                            ...styles.primaryActionBtn,
                            background: 'linear-gradient(135deg, #10B981, #059669)',
                            opacity: isProcessingLiveAudio ? 0.7 : 1,
                            cursor: isProcessingLiveAudio ? 'not-allowed' : 'pointer',
                          }}
                          id="save-transcribe-live-audio-btn"
                        >
                          {isProcessingLiveAudio ? (
                            <>
                              <RefreshCw size={16} className="animate-spin" style={{ marginRight: '8px' }} />
                              <span>Saving to Atlas & Transcribing...</span>
                            </>
                          ) : (
                            <>
                              <Sparkles size={16} style={{ marginRight: '8px' }} />
                              <span>Save & Transcribe Recording</span>
                            </>
                          )}
                        </button>

                        <button
                          type="button"
                          onClick={discardRecording}
                          disabled={isProcessingLiveAudio}
                          style={styles.recordControlSecondaryBtn}
                          id="discard-rerecord-btn"
                        >
                          <RotateCcw size={15} style={{ marginRight: '6px' }} />
                          <span>Discard & Re-record</span>
                        </button>
                      </>
                    )}
                  </div>

                  {/* Recording-specific error alert */}
                  {recordingError && (
                    <div style={{ ...styles.errorAlert, marginTop: '8px' }}>
                      <AlertCircle size={16} style={{ marginRight: '8px', flexShrink: 0 }} />
                      <span>{recordingError}</span>
                    </div>
                  )}
                </div>
              )}

              {/* Shared Notifications */}
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

              {/* Direct Go to Summary Button (if meeting exists) */}
              {currentAudioMeeting && (
                <button
                  onClick={() =>
                    handleContinueToSummary(
                      currentAudioMeeting.transcript || currentAudioMeeting.transcript_text || '',
                      currentAudioMeeting.file_id || currentAudioMeeting.id || uploadedFileId || undefined,
                      currentAudioMeeting.title || audioTitle || selectedAudio?.name,
                      'audio'
                    )
                  }
                  style={styles.goToSummaryAudioDirectBtn}
                  id="go-to-summary-audio-direct-btn"
                  title="Jump directly to AI Summary for this audio recording"
                >
                  <Sparkles size={16} style={{ marginRight: '8px' }} />
                  <span>Go to Summary</span>
                  <ArrowRight size={16} style={{ marginLeft: '8px' }} />
                </button>
              )}

              {/* Unified Audio Transcript Result Box */}
              {currentAudioMeeting && (
                <div style={styles.resultBox}>
                  {(() => {
                    const audioText =
                      currentAudioMeeting.transcript || currentAudioMeeting.transcript_text || '';
                    const audioWordCount = audioText
                      ? audioText.trim().split(/\s+/).filter(Boolean).length
                      : 0;

                    return (
                      <>
                        <div style={styles.resultBoxHeader}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                            <Mic size={18} color="#8B5CF6" />
                            <span style={styles.resultBoxTitle}>
                              {currentAudioMeeting.is_live_recording ? 'Live Recording Transcript' : 'Meeting Transcript'}
                            </span>
                            <span style={{ ...styles.statusPill, background: '#F5F3FF', color: '#7C3AED' }}>
                              {audioText ? 'Completed' : 'Uploaded'}
                            </span>
                            {currentAudioMeeting.is_live_recording && (
                              <span style={{ ...styles.statusPill, background: '#FEF2F2', color: '#DC2626' }}>
                                Live Recording
                              </span>
                            )}
                            {audioText ? (
                              <span style={styles.wordCountBadge}>
                                Word Count: {audioWordCount}
                              </span>
                            ) : null}
                          </div>

                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            {audioText ? (
                              <>
                                <button
                                  onClick={() => {
                                    setModalData({
                                      title: currentAudioMeeting.title || audioTitle || selectedAudio?.name || 'Meeting Transcript',
                                      text: audioText,
                                      wordCount: audioWordCount,
                                      type: 'audio',
                                    });
                                    setIsFullTextModalOpen(true);
                                  }}
                                  style={styles.viewModalBtn}
                                  title="Open transcript in reader modal"
                                  id="view-full-audio-modal-btn"
                                >
                                  <Maximize2 size={13} style={{ marginRight: '5px' }} />
                                  <span>View Full Text</span>
                                </button>

                                <button
                                  onClick={() => copyToClipboard(audioText, 'audio')}
                                  style={styles.copyBtn}
                                  title="Copy transcript"
                                  id="copy-audio-text-btn"
                                >
                                  {copiedAudio ? (
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
                            ) : null}
                          </div>
                        </div>

                        <div style={styles.textContentArea}>
                          {audioText ? (
                            <p style={styles.extractedParagraph}>{audioText}</p>
                          ) : (
                            <div style={styles.emptyPlaceholderWrap}>
                              <Mic size={22} color="#94A3B8" style={{ marginBottom: '6px' }} />
                              <span style={styles.emptyPlaceholderText}>
                                Transcription pending. Click "Generate Transcript" or "Save & Transcribe".
                              </span>
                            </div>
                          )}
                        </div>

                        {Boolean(audioText) && (
                          <div style={{ marginTop: '16px', display: 'flex', gap: '10px', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                            {/* Machine Learning Classification Button */}
                            <button
                              onClick={() =>
                                handleContinueToClassification(
                                  audioText,
                                  currentAudioMeeting.file_id || currentAudioMeeting.id || uploadedFileId || undefined,
                                  currentAudioMeeting.title || audioTitle || selectedAudio?.name
                                )
                              }
                              style={{
                                ...styles.secondaryActionBtn,
                                background: '#EEF2FF',
                                color: '#4F46E5',
                                border: '1px solid #C7D2FE',
                                fontWeight: 700,
                              }}
                              id="classify-ml-audio-btn"
                              title="Classify meeting recording with Scikit-Learn Machine Learning model"
                            >
                              <Brain size={16} style={{ marginRight: '6px' }} />
                              <span>Classify with ML Model</span>
                            </button>

                            {/* Direct Summary Generation Button */}
                            <button
                              onClick={handleDirectGenerateSummary}
                              disabled={generatingSummaryDirect}
                              style={{
                                ...styles.secondaryActionBtn,
                                background: '#F5F3FF',
                                color: '#7C3AED',
                                border: '1px solid #DDD6FE',
                                fontWeight: 700,
                                opacity: generatingSummaryDirect ? 0.7 : 1,
                                cursor: generatingSummaryDirect ? 'not-allowed' : 'pointer',
                              }}
                              id="generate-ai-summary-direct-btn"
                              title="Generate AI summary immediately and store in MongoDB Atlas"
                            >
                              {generatingSummaryDirect ? (
                                <>
                                  <RefreshCw size={15} className="animate-spin" style={{ marginRight: '6px' }} />
                                  <span>Generating Summary...</span>
                                </>
                              ) : (
                                <>
                                  <Sparkles size={15} style={{ marginRight: '6px' }} />
                                  <span>Generate AI Summary</span>
                                </>
                              )}
                            </button>

                            {/* Continue to AI Summary Page Button */}
                            <button
                              onClick={() =>
                                handleContinueToSummary(
                                  audioText,
                                  currentAudioMeeting.file_id || currentAudioMeeting.id || uploadedFileId || undefined,
                                  currentAudioMeeting.title || audioTitle || selectedAudio?.name,
                                  'audio'
                                )
                              }
                              style={{
                                ...styles.continueSummaryBtn,
                                background: 'linear-gradient(135deg, #8B5CF6, #6366F1)',
                              }}
                              id="continue-to-ai-summary-btn"
                            >
                              <Sparkles size={16} style={{ marginRight: '8px' }} />
                              <span>Continue to AI Summary</span>
                              <ArrowRight size={18} style={{ marginLeft: '8px' }} />
                            </button>
                          </div>
                        )}
                      </>
                    );
                  })()}
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
                        ...styles.modalTypePill,
                        background: modalData.type === 'audio' ? '#F5F3FF' : '#EEF2FF',
                        color: modalData.type === 'audio' ? '#7C3AED' : '#4F46E5',
                      }}
                    >
                      {modalData.type === 'audio' ? 'Audio Transcript' : 'PDF Extracted Content'}
                    </span>
                    <span style={styles.modalWordCountPill}>
                      Word Count: {modalData.wordCount}
                    </span>
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <button
                  onClick={() => copyToClipboard(modalData.text, modalData.type)}
                  style={styles.modalCopyBtn}
                  title="Copy full text"
                >
                  {(modalData.type === 'pdf' ? copiedPdf : copiedAudio) ? (
                    <>
                      <Check size={14} color="#16A34A" style={{ marginRight: '6px' }} />
                      <span style={{ color: '#16A34A' }}>Copied</span>
                    </>
                  ) : (
                    <>
                      <Copy size={14} style={{ marginRight: '6px' }} />
                      <span>Copy All</span>
                    </>
                  )}
                </button>

                <button
                  onClick={() => setIsFullTextModalOpen(false)}
                  style={styles.modalCloseBtn}
                  title="Close reader"
                >
                  <X size={20} color="#64748B" />
                </button>
              </div>
            </div>

            <div style={styles.modalBody}>
              <div style={styles.modalTextCard}>
                <pre style={styles.modalPreText}>{modalData.text}</pre>
              </div>
            </div>

            <div style={styles.modalFooter}>
              <span style={{ fontSize: '0.86rem', color: '#64748B', fontWeight: 600 }}>
                Total Words: <strong style={{ color: '#0F172A' }}>{modalData.wordCount}</strong>
              </span>
              <div style={{ display: 'flex', gap: '12px' }}>
                <button
                  onClick={() => setIsFullTextModalOpen(false)}
                  style={styles.modalCancelBtn}
                >
                  Close
                </button>
                <button
                  onClick={() => {
                    setIsFullTextModalOpen(false);
                    handleContinueToSummary(
                      modalData.text,
                      modalData.type === 'pdf'
                        ? currentPdfDoc?.id || (currentPdfDoc as any)?._id
                        : uploadedFileId || currentAudioMeeting?.id,
                      modalData.title,
                      modalData.type
                    );
                  }}
                  style={styles.modalPrimaryBtn}
                >
                  <Sparkles size={16} style={{ marginRight: '8px' }} />
                  <span>Go to Summary</span>
                  <ArrowRight size={16} style={{ marginLeft: '8px' }} />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
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
    transition: 'all 0.15s ease',
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
    boxShadow: '0 2px 6px rgba(0,0,0,0.03)',
  },
  goToSummaryDirectBtn: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    padding: '11px 18px',
    borderRadius: '12px',
    background: '#EEF2FF',
    color: '#4F46E5',
    fontWeight: 700,
    fontSize: '0.88rem',
    border: '1px solid #C7D2FE',
    cursor: 'pointer',
    transition: 'all 0.15s ease',
    marginTop: '2px',
  },
  goToSummaryAudioDirectBtn: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    padding: '11px 18px',
    borderRadius: '12px',
    background: '#F5F3FF',
    color: '#7C3AED',
    fontWeight: 700,
    fontSize: '0.88rem',
    border: '1px solid #DDD6FE',
    cursor: 'pointer',
    transition: 'all 0.15s ease',
    marginTop: '2px',
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
    borderRadius: '16px',
    padding: '18px',
    marginTop: '6px',
  },
  resultBoxHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: '10px',
    marginBottom: '12px',
  },
  resultBoxTitle: {
    fontSize: '0.90rem',
    fontWeight: 700,
    color: '#1E293B',
  },
  statusPill: {
    fontSize: '0.72rem',
    fontWeight: 700,
    color: '#059669',
    background: '#ECFDF5',
    border: '1px solid #A7F3D0',
    padding: '2px 8px',
    borderRadius: '10px',
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
  copyBtn: {
    display: 'inline-flex',
    alignItems: 'center',
    background: '#FFFFFF',
    border: '1px solid #CBD5E1',
    borderRadius: '8px',
    padding: '5px 10px',
    cursor: 'pointer',
    color: '#64748B',
    boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
  },
  textContentArea: {
    background: '#FFFFFF',
    border: '1px solid #E2E8F0',
    borderRadius: '12px',
    padding: '14px 16px',
    maxHeight: '200px',
    overflowY: 'auto',
  },
  extractedParagraph: {
    fontSize: '0.88rem',
    lineHeight: 1.65,
    color: '#334155',
    margin: 0,
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-word',
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
  continueSummaryBtn: {
    display: 'inline-flex',
    alignItems: 'center',
    padding: '10px 20px',
    borderRadius: '12px',
    background: 'linear-gradient(135deg, #10B981, #059669)',
    color: '#FFFFFF',
    fontWeight: 700,
    fontSize: '0.88rem',
    border: 'none',
    cursor: 'pointer',
    boxShadow: '0 4px 12px rgba(16, 185, 129, 0.25)',
  },

  // Modal styles
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
    maxWidth: '820px',
    maxHeight: '85vh',
    display: 'flex',
    flexDirection: 'column',
    boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
    border: '1px solid #E2E8F0',
    overflow: 'hidden',
  },
  modalHeader: {
    padding: '20px 24px',
    borderBottom: '1px solid #F1F5F9',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    background: '#FAFAFD',
  },
  modalIconWrap: {
    width: '42px',
    height: '42px',
    borderRadius: '12px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  modalTitle: {
    fontSize: '1.1rem',
    fontWeight: 700,
    color: '#0F172A',
    margin: 0,
  },
  modalTypePill: {
    fontSize: '0.72rem',
    fontWeight: 700,
    padding: '2px 8px',
    borderRadius: '10px',
  },
  modalWordCountPill: {
    fontSize: '0.72rem',
    fontWeight: 700,
    background: '#ECFDF5',
    color: '#059669',
    border: '1px solid #A7F3D0',
    padding: '2px 8px',
    borderRadius: '10px',
  },
  modalCopyBtn: {
    display: 'inline-flex',
    alignItems: 'center',
    background: '#FFFFFF',
    border: '1px solid #CBD5E1',
    borderRadius: '10px',
    padding: '7px 12px',
    fontSize: '0.82rem',
    fontWeight: 600,
    color: '#475569',
    cursor: 'pointer',
  },
  modalCloseBtn: {
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    padding: '4px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: '8px',
  },
  modalBody: {
    padding: '24px',
    overflowY: 'auto',
    flex: 1,
  },
  modalTextCard: {
    background: '#F8FAFC',
    border: '1px solid #E2E8F0',
    borderRadius: '16px',
    padding: '20px',
  },
  modalPreText: {
    margin: 0,
    fontFamily: 'inherit',
    fontSize: '0.92rem',
    lineHeight: 1.7,
    color: '#334155',
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-word',
  },
  modalFooter: {
    padding: '16px 24px',
    borderTop: '1px solid #F1F5F9',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    background: '#FAFAFD',
  },
  modalCancelBtn: {
    padding: '9px 18px',
    borderRadius: '10px',
    background: '#FFFFFF',
    border: '1px solid #CBD5E1',
    color: '#475569',
    fontSize: '0.88rem',
    fontWeight: 600,
    cursor: 'pointer',
  },
  modalPrimaryBtn: {
    display: 'inline-flex',
    alignItems: 'center',
    padding: '9px 20px',
    borderRadius: '10px',
    background: 'linear-gradient(135deg, #6366F1, #8B5CF6)',
    color: '#FFFFFF',
    fontSize: '0.88rem',
    fontWeight: 700,
    border: 'none',
    cursor: 'pointer',
    boxShadow: '0 4px 12px rgba(99, 102, 241, 0.25)',
  },
  modeTabsWrap: {
    display: 'flex',
    background: '#F1F5F9',
    padding: '4px',
    borderRadius: '14px',
    gap: '6px',
    border: '1px solid #E2E8F0',
  },
  modeTabBtn: {
    flex: 1,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '9px 14px',
    borderRadius: '10px',
    border: 'none',
    background: 'transparent',
    color: '#64748B',
    fontSize: '0.84rem',
    fontWeight: 600,
    cursor: 'pointer',
    transition: 'all 0.18s ease',
  },
  modeTabBtnActive: {
    background: '#FFFFFF',
    color: '#7C3AED',
    fontWeight: 700,
    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.06)',
  },
  livePulseDotActive: {
    width: '8px',
    height: '8px',
    borderRadius: '50%',
    background: '#EF4444',
    marginRight: '6px',
    boxShadow: '0 0 8px #EF4444',
    display: 'inline-block',
  },
  liveBadgeMini: {
    marginLeft: '6px',
    background: '#EF4444',
    color: '#FFFFFF',
    fontSize: '0.66rem',
    fontWeight: 800,
    padding: '2px 6px',
    borderRadius: '8px',
    letterSpacing: '0.5px',
  },
  recorderStudioCard: {
    background: 'linear-gradient(180deg, #FAFAFD 0%, #F5F3FF 100%)',
    border: '1px solid #E0E7FF',
    borderRadius: '18px',
    padding: '20px',
    display: 'flex',
    flexDirection: 'column',
    gap: '14px',
    boxShadow: '0 2px 10px rgba(99, 102, 241, 0.04)',
  },
  recorderHudRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: '12px',
    borderBottom: '1px solid rgba(226, 232, 240, 0.8)',
  },
  timerHudBadge: {
    background: '#0F172A',
    color: '#38BDF8',
    padding: '4px 14px',
    borderRadius: '10px',
    boxShadow: 'inset 0 1px 3px rgba(0, 0, 0, 0.4)',
  },
  timerMonoText: {
    fontFamily: 'monospace',
    fontSize: '1.25rem',
    fontWeight: 700,
    letterSpacing: '1px',
  },
  visualizerContainer: {
    background: '#FFFFFF',
    border: '1px solid #E2E8F0',
    borderRadius: '14px',
    padding: '12px 16px',
    minHeight: '64px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  visualizerIdleWrap: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '4px',
    textAlign: 'center',
  },
  visualizerIdleText: {
    fontSize: '0.82rem',
    color: '#64748B',
  },
  audioPreviewBox: {
    background: '#FFFFFF',
    border: '1px solid #E2E8F0',
    borderRadius: '14px',
    padding: '12px',
  },
  startRecordBtn: {
    flex: 1,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '13px 20px',
    borderRadius: '12px',
    background: 'linear-gradient(135deg, #EF4444, #DC2626)',
    color: '#FFFFFF',
    fontWeight: 700,
    fontSize: '0.92rem',
    border: 'none',
    cursor: 'pointer',
    boxShadow: '0 4px 14px rgba(239, 68, 68, 0.35)',
    transition: 'all 0.15s ease',
  },
  recordControlSecondaryBtn: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '10px 16px',
    borderRadius: '12px',
    background: '#FFFFFF',
    color: '#475569',
    fontWeight: 600,
    fontSize: '0.86rem',
    border: '1px solid #CBD5E1',
    cursor: 'pointer',
    transition: 'all 0.15s ease',
  },
  stopRecordBtn: {
    flex: 1,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '10px 18px',
    borderRadius: '12px',
    background: '#DC2626',
    color: '#FFFFFF',
    fontWeight: 700,
    fontSize: '0.88rem',
    border: 'none',
    cursor: 'pointer',
    boxShadow: '0 3px 10px rgba(220, 38, 38, 0.3)',
  },
  discardRecordBtn: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '10px 14px',
    borderRadius: '12px',
    background: '#F1F5F9',
    color: '#64748B',
    fontWeight: 600,
    fontSize: '0.86rem',
    border: '1px solid #CBD5E1',
    cursor: 'pointer',
  },
};
