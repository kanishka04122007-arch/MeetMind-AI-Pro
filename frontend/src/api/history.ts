import { api } from './auth';

export interface HistoryActionItem {
  task: string;
  priority: string;
  owner: string;
}

export interface HistoryMeetingItem {
  id: string;
  _id?: string;
  title: string;
  fileName: string;
  fileType: 'pdf' | 'audio';
  sourceType: 'PDF Document' | 'Audio Meeting' | 'Live Recording' | string;
  uploadDate: string;
  formattedDate: string;
  status: string;
  summaryStatus: 'Generated' | 'Pending';
  transcriptStatus: 'Completed' | 'Processing' | 'Pending';
  category: string;
  confidence: number;
  reason?: string;
  actionItemsCount: number;
  actionItems: HistoryActionItem[];
  summary?: string;
  keyPoints?: string[];
  transcript?: string;
  extractedText?: string;
  wordCount?: number;
  pageCount?: number;
  duration?: number;
  is_live_recording?: boolean;
}

export interface HistoryStats {
  totalMeetings: number;
  totalPDFs: number;
  totalAudio: number;
  totalSummaries: number;
  totalActionItems: number;
  totalClassifications: number;
}

export const historyApi = {
  async getHistoryList(): Promise<HistoryMeetingItem[]> {
    const response = await api.get<HistoryMeetingItem[]>('/api/history');
    return response.data;
  },

  async getHistoryStats(): Promise<HistoryStats> {
    const response = await api.get<HistoryStats>('/api/history/stats');
    return response.data;
  },

  async getMeetingRecord(id: string): Promise<HistoryMeetingItem> {
    const response = await api.get<HistoryMeetingItem>(`/api/history/${id}`);
    return response.data;
  },

  async deleteMeeting(id: string): Promise<{ success: boolean; message: string; deleted_counts?: Record<string, number> }> {
    const response = await api.delete<{ success: boolean; message: string; deleted_counts?: Record<string, number> }>(
      `/api/history/${id}`
    );
    return response.data;
  },
};
