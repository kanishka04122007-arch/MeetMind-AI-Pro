import { api } from './auth';

export interface PDFDocumentItem {
  id: string;
  _id?: string;
  title: string;
  fileName: string;
  file_size?: number;
  extracted_text?: string;
  text?: string;
  content?: string;
  page_count?: number;
  word_count?: number;
  char_count?: number;
  status: string;
  created_at?: string;
  uploadDate?: string;
}

export interface MeetingAudioItem {
  id: string;
  _id?: string;
  file_id?: string;
  title: string;
  fileName: string;
  transcript?: string;
  transcript_text?: string;
  status: string;
  duration?: number;
  created_at?: string;
}

export const meetingsApi = {
  // ================= PDF MODULE (Module 2.1 & 2.3) =================
  async uploadPDF(file: File, title?: string): Promise<PDFDocumentItem> {
    const token = localStorage.getItem('token') || localStorage.getItem('meetmind_token');
    const formData = new FormData();
    formData.append('file', file);
    if (title) formData.append('title', title);

    const headers: Record<string, string> = {};
    if (token && typeof token === 'string' && token.trim()) {
      let cleanToken = token.trim().replace(/^["']|["']$/g, '');
      while (cleanToken.toLowerCase().startsWith('bearer ')) {
        cleanToken = cleanToken.slice(7).trim();
      }
      if (cleanToken.split('.').length === 3) {
        headers['Authorization'] = `Bearer ${cleanToken}`;
      }
    }

    const response = await api.post<PDFDocumentItem>('/api/documents/upload', formData, {
      headers,
    });
    return response.data;
  },

  async extractPDFText(docId: string): Promise<{
    text: string;
    extracted_text?: string;
    content?: string;
    page_count?: number;
    word_count?: number;
    char_count?: number;
    status?: string;
    message?: string;
    data?: any;
  }> {
    const response = await api.post<any>(`/api/documents/${docId}/extract`);
    const resData = response.data || {};
    // Ensure both res.text and res.data.text access patterns work seamlessly
    if (resData && typeof resData === 'object' && !resData.data) {
      resData.data = { ...resData };
    }
    return resData;
  },

  async getLatestDocument(): Promise<PDFDocumentItem | null> {
    try {
      const response = await api.get<PDFDocumentItem>('/api/documents/latest');
      return response.data;
    } catch {
      return null;
    }
  },

  async listDocuments(): Promise<PDFDocumentItem[]> {
    const response = await api.get<{ documents: PDFDocumentItem[] } | PDFDocumentItem[]>('/api/documents');
    if (Array.isArray(response.data)) {
      return response.data;
    }
    return (response.data as any).documents || [];
  },

  // ================= AUDIO MODULE (Module 2.2 & 2.4) =================
  async uploadAudio(file: File, title?: string): Promise<MeetingAudioItem> {
    // 3. Before audio upload, read token using:
    const token = localStorage.getItem("token");

    // 7. Add console.log(token) before upload for debugging
    console.log(token);
    console.log("Token before upload:", token);

    // 8 & 9. If token is missing, throw session expired error
    if (
      !token ||
      token.trim() === '' ||
      token === 'undefined' ||
      token === 'null' ||
      token === '[object Object]'
    ) {
      throw new Error("Please login again. Session expired.");
    }

    // 6. Remove any malformed token formatting (quotes, extra spaces, redundant 'Bearer ' prefix)
    let cleanToken = token.trim().replace(/^["']|["']$/g, '');
    while (cleanToken.toLowerCase().startsWith('bearer ')) {
      cleanToken = cleanToken.slice(7).trim();
    }
    cleanToken = cleanToken.replace(/^["']|["']$/g, '').trim();

    // Verify token contains 3 JWT sections separated by dots
    const parts = cleanToken.split('.');
    if (parts.length !== 3 || !parts[0] || !parts[1] || !parts[2]) {
      throw new Error("Please login again. Session expired.");
    }

    const formData = new FormData();
    formData.append('file', file);
    if (title) formData.append('title', title);

    // 4. Send Authorization header exactly as: Authorization: Bearer <token>
    // 5. Remove any hardcoded token values
    const headers: Record<string, string> = {
      'Authorization': `Bearer ${cleanToken}`,
    };

    const response = await api.post<MeetingAudioItem>('/api/meetings/upload', formData, {
      headers,
    });
    return response.data;
  },

  async transcribeAudio(fileId: string): Promise<{ transcript_text: string; transcript?: string; duration?: number }> {
    const token = localStorage.getItem('token');
    const headers: Record<string, string> = {};
    if (token) {
      let cleanToken = token.trim().replace(/^["']|["']$/g, '');
      while (cleanToken.toLowerCase().startsWith('bearer ')) {
        cleanToken = cleanToken.slice(7).trim();
      }
      cleanToken = cleanToken.replace(/^["']|["']$/g, '').trim();
      if (cleanToken) {
        headers['Authorization'] = `Bearer ${cleanToken}`;
      }
    }

    const endpoint = `/api/meetings/${fileId}/transcribe`;
    const fullUrl = `${api.defaults.baseURL || ''}${endpoint}`;
    const requestBody = {};

    console.log("[TRANSCRIBE DEBUG] meeting id:", fileId);
    console.log("[TRANSCRIBE DEBUG] URL:", fullUrl);
    console.log("[TRANSCRIBE DEBUG] request body:", requestBody);

    const response = await api.post<{ transcript_text: string; transcript?: string; duration?: number }>(
      endpoint,
      requestBody,
      { headers }
    );
    return response.data;
  },

  async listMeetings(): Promise<MeetingAudioItem[]> {
    const response = await api.get<{ meetings: MeetingAudioItem[] } | MeetingAudioItem[]>('/api/meetings');
    if (Array.isArray(response.data)) {
      return response.data;
    }
    return (response.data as any).meetings || [];
  },

  // ================= CLASSIFIER MODULE (Step 3 & 4) =================
  async classifyMeeting(payload: {
    text?: string;
    summary?: string;
    transcript?: string;
    file_id?: string;
    title?: string;
  }): Promise<ClassificationResult> {
    const response = await api.post<ClassificationResult>('/api/ml/classify', payload);
    return response.data;
  },

  async classifyText(text: string): Promise<ClassificationResult> {
    const response = await api.post<ClassificationResult>('/api/ml/classify', { text, summary: text });
    return response.data;
  },

  async getLatestClassification(): Promise<ClassificationResult | null> {
    try {
      const response = await api.get<ClassificationResult>('/api/ml/classify/latest');
      return response.data;
    } catch {
      return null;
    }
  },

  // ================= SUMMARY MODULE (Phase 3) =================
  async generateSummary(
    fileId?: string,
    transcriptText?: string,
    title?: string
  ): Promise<MeetingSummaryItem> {
    const token = localStorage.getItem('token');
    const headers: Record<string, string> = {};
    if (token) {
      let cleanToken = token.trim().replace(/^["']|["']$/g, '');
      while (cleanToken.toLowerCase().startsWith('bearer ')) {
        cleanToken = cleanToken.slice(7).trim();
      }
      cleanToken = cleanToken.replace(/^["']|["']$/g, '').trim();
      if (cleanToken) {
        headers['Authorization'] = `Bearer ${cleanToken}`;
      }
    }

    const endpoint = fileId ? `/api/meetings/${fileId}/summary` : `/api/meetings/summary`;
    const response = await api.post<MeetingSummaryItem>(
      endpoint,
      { file_id: fileId, transcript_text: transcriptText, title },
      { headers }
    );
    return response.data;
  },

  // ================= ACTION ITEMS MODULE =================
  async generateActionItems(
    summary?: string,
    meetingId?: string,
    title?: string,
    transcriptText?: string
  ): Promise<ActionItemsResponse> {
    const token = localStorage.getItem('token');
    const headers: Record<string, string> = {};
    if (token) {
      let cleanToken = token.trim().replace(/^["']|["']$/g, '');
      while (cleanToken.toLowerCase().startsWith('bearer ')) {
        cleanToken = cleanToken.slice(7).trim();
      }
      cleanToken = cleanToken.replace(/^["']|["']$/g, '').trim();
      if (cleanToken) {
        headers['Authorization'] = `Bearer ${cleanToken}`;
      }
    }

    const response = await api.post<ActionItemsResponse>(
      '/api/meetings/action-items',
      { summary, meeting_id: meetingId, title, transcript_text: transcriptText },
      { headers }
    );
    return response.data;
  },

  async getLatestActionItems(): Promise<ActionItemsResponse | null> {
    const token = localStorage.getItem('token');
    const headers: Record<string, string> = {};
    if (token) {
      let cleanToken = token.trim().replace(/^["']|["']$/g, '');
      while (cleanToken.toLowerCase().startsWith('bearer ')) {
        cleanToken = cleanToken.slice(7).trim();
      }
      cleanToken = cleanToken.replace(/^["']|["']$/g, '').trim();
      if (cleanToken) {
        headers['Authorization'] = `Bearer ${cleanToken}`;
      }
    }

    try {
      const response = await api.get<ActionItemsResponse>('/api/meetings/action-items/latest', { headers });
      return response.data;
    } catch {
      return null;
    }
  },

  async getActionItemsByMeeting(meetingId: string): Promise<ActionItemsResponse | null> {
    const token = localStorage.getItem('token');
    const headers: Record<string, string> = {};
    if (token) {
      let cleanToken = token.trim().replace(/^["']|["']$/g, '');
      while (cleanToken.toLowerCase().startsWith('bearer ')) {
        cleanToken = cleanToken.slice(7).trim();
      }
      cleanToken = cleanToken.replace(/^["']|["']$/g, '').trim();
      if (cleanToken) {
        headers['Authorization'] = `Bearer ${cleanToken}`;
      }
    }

    try {
      const response = await api.get<ActionItemsResponse>(`/api/meetings/action-items/${meetingId}`, { headers });
      return response.data;
    } catch {
      return null;
    }
  },

  // ================= LIVE DATABASE & USER DASHBOARD STATISTICS MODULE =================
  async getLiveStats(): Promise<LiveStatsResponse> {
    const response = await api.get<LiveStatsResponse>('/api/dashboard/stats');
    return response.data;
  },

  async getDashboardStats(): Promise<LiveStatsResponse> {
    const response = await api.get<LiveStatsResponse>('/api/dashboard/stats');
    return response.data;
  },
};

export interface MeetingSummaryItem {
  message?: string;
  file_id?: string;
  meeting_id?: string;
  source_type?: 'pdf' | 'audio' | string;
  source_text?: string;
  title?: string;
  summary: string;
  key_points?: string[];
  word_count?: number;
  created_at?: string;
  status?: string;
}

export interface ActionItemModel {
  task: string;
  priority: string;
  owner: string;
}

export interface ActionItemsResponse {
  message: string;
  meeting_id?: string;
  tasks: ActionItemModel[];
  count: number;
  created_at?: string;
  source?: string;
  title?: string;
}

export interface LiveStatsResponse {
  files_uploaded: number;
  transcripts: number;
  summaries: number;
  action_items: number;
  total_files?: number;
  total_transcripts?: number;
  total_summaries?: number;
  total_action_items?: number;
  live_database_statistics?: boolean;
  heading?: string;
  status?: string;
  user_id?: string;
  database_name?: string;
}

export interface ClassificationResult {
  category: string;
  confidence: number;
  reason: string;
  source: string;
  id?: string;
  created_at?: string;
  title?: string;
}


