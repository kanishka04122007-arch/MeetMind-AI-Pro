export interface NotificationItem {
  id: string;
  userId: string;
  title: string;
  message: string;
  type: 'upload' | 'transcript' | 'summary' | 'action_items' | 'classification' | 'report' | 'system';
  timestamp: string;
  read: boolean;
}

const STORAGE_PREFIX = 'meetmind_notifications_';

export const notificationService = {
  getNotifications(userId: string): NotificationItem[] {
    if (!userId) return [];
    try {
      const raw = localStorage.getItem(`${STORAGE_PREFIX}${userId}`);
      if (!raw) {
        // Provide friendly default notification for user if empty
        const initialNotifs: NotificationItem[] = [
          {
            id: `notif-welcome-${Date.now()}`,
            userId,
            title: 'Welcome to MeetMind AI',
            message: 'Your meeting intelligence workspace is ready. Upload a PDF or audio recording to get started.',
            type: 'system',
            timestamp: new Date().toISOString(),
            read: false,
          },
        ];
        localStorage.setItem(`${STORAGE_PREFIX}${userId}`, JSON.stringify(initialNotifs));
        return initialNotifs;
      }
      return JSON.parse(raw);
    } catch {
      return [];
    }
  },

  addNotification(
    userId: string,
    data: {
      title: string;
      message: string;
      type: NotificationItem['type'];
    }
  ): NotificationItem {
    if (!userId) {
      throw new Error('User ID is required to add notifications');
    }
    const current = this.getNotifications(userId);
    const newNotif: NotificationItem = {
      id: `notif-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      userId,
      title: data.title,
      message: data.message,
      type: data.type,
      timestamp: new Date().toISOString(),
      read: false,
    };

    const updated = [newNotif, ...current].slice(0, 50); // keep last 50
    try {
      localStorage.setItem(`${STORAGE_PREFIX}${userId}`, JSON.stringify(updated));
      window.dispatchEvent(new CustomEvent('meetmind_notification_update', { detail: { userId } }));
    } catch (e) {
      console.warn('Failed to save notification:', e);
    }
    return newNotif;
  },

  markAsRead(userId: string, id: string): void {
    if (!userId) return;
    const current = this.getNotifications(userId);
    const updated = current.map((n) => (n.id === id ? { ...n, read: true } : n));
    try {
      localStorage.setItem(`${STORAGE_PREFIX}${userId}`, JSON.stringify(updated));
      window.dispatchEvent(new CustomEvent('meetmind_notification_update', { detail: { userId } }));
    } catch (e) {
      console.warn('Failed to update notification:', e);
    }
  },

  markAllAsRead(userId: string): void {
    if (!userId) return;
    const current = this.getNotifications(userId);
    const updated = current.map((n) => ({ ...n, read: true }));
    try {
      localStorage.setItem(`${STORAGE_PREFIX}${userId}`, JSON.stringify(updated));
      window.dispatchEvent(new CustomEvent('meetmind_notification_update', { detail: { userId } }));
    } catch (e) {
      console.warn('Failed to mark all notifications as read:', e);
    }
  },

  clearNotifications(userId: string): void {
    if (!userId) return;
    try {
      localStorage.setItem(`${STORAGE_PREFIX}${userId}`, JSON.stringify([]));
      window.dispatchEvent(new CustomEvent('meetmind_notification_update', { detail: { userId } }));
    } catch (e) {
      console.warn('Failed to clear notifications:', e);
    }
  },

  getUnreadCount(userId: string): number {
    if (!userId) return 0;
    const items = this.getNotifications(userId);
    return items.filter((n) => !n.read).length;
  },
};
