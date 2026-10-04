import axios from 'axios';

// Helper to sanitize and validate a JWT string (must have 3 dot-separated parts)
export function sanitizeToken(rawToken: any): string | null {
  if (!rawToken || typeof rawToken !== 'string') return null;

  let cleaned = rawToken.trim().replace(/^["']|["']$/g, '');
  if (!cleaned || cleaned === 'undefined' || cleaned === 'null' || cleaned === '[object Object]') {
    return null;
  }

  // Remove any redundant 'Bearer ' prefix (case-insensitive)
  while (cleaned.toLowerCase().startsWith('bearer ')) {
    cleaned = cleaned.slice(7).trim();
  }
  cleaned = cleaned.replace(/^["']|["']$/g, '').trim();

  // Validate standard 3-part JWT structure (header.payload.signature)
  const parts = cleaned.split('.');
  if (parts.length !== 3 || !parts[0] || !parts[1] || !parts[2]) {
    return null;
  }

  return cleaned;
}

// Base Axios API client
// Note: Do not set default Content-Type to application/json so Axios can auto-set multipart boundaries
export const api = axios.create({
  baseURL: '', // Vite proxy forwards /api to backend
});

// Interceptor to automatically attach Bearer token to all outgoing requests
api.interceptors.request.use(
  (config) => {
    // Check 'token' (standard per STEP 5) and fallback to 'meetmind_token'
    const storedToken = localStorage.getItem('token') || localStorage.getItem('meetmind_token');
    const validToken = sanitizeToken(storedToken);

    if (validToken) {
      if (config.headers && typeof (config.headers as any).set === 'function') {
        (config.headers as any).set('Authorization', `Bearer ${validToken}`);
      } else {
        config.headers = config.headers || {};
        config.headers.Authorization = `Bearer ${validToken}`;
      }
    }

    // When sending FormData, let the browser and Axios handle multipart boundaries automatically
    if (config.data instanceof FormData && config.headers) {
      if (typeof (config.headers as any).delete === 'function') {
        (config.headers as any).delete('Content-Type');
      } else {
        delete (config.headers as any)['Content-Type'];
      }
    }

    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

export interface User {
  id?: string;
  _id?: string;
  name: string;
  email: string;
  role?: string;
}

export interface AuthResponse {
  token: string;
  access_token: string;
  token_type?: string;
  message?: string;
  welcome_message?: string;
  user: User;
}

export function clearActiveSessionData(): void {
  const keysToRemove = [
    'meetmind_active_transcript',
    'meetmind_active_summary',
    'meetmind_active_action_items',
    'meetmind_active_classification',
    'meetmind_active_report',
    'meetmind_active_file_id',
    'meetmind_active_title',
    'meetmind_active_meeting_id',
  ];
  keysToRemove.forEach((k) => {
    try {
      localStorage.removeItem(k);
    } catch {
      // ignore
    }
  });
}

export const authApi = {
  async login(email: string, password: string): Promise<AuthResponse> {
    // Clear previous user's stale cache before authenticating new user
    clearActiveSessionData();

    const response = await api.post<AuthResponse>('/api/auth/login', {
      email,
      password,
    });
    const data = response.data;

    // STEP 1 & STEP 5: Extract access_token from FastAPI response and save in localStorage
    const rawAccessToken = data.access_token || data.token;
    const cleanAccessToken = sanitizeToken(rawAccessToken);

    if (!cleanAccessToken) {
      throw new Error('Authentication failed: Server did not return a valid 3-part access_token.');
    }

    // Save token as 'token' (standard) and 'meetmind_token' (compatibility)
    localStorage.setItem('token', cleanAccessToken);
    localStorage.setItem('meetmind_token', cleanAccessToken);

    if (data.user) {
      localStorage.setItem('meetmind_user', JSON.stringify(data.user));
    }

    return data;
  },

  async register(name: string, email: string, password: string, confirmPassword?: string): Promise<AuthResponse> {
    // Clear previous user's stale cache before authenticating new user
    clearActiveSessionData();

    const response = await api.post<AuthResponse>('/api/auth/register', {
      name,
      email,
      password,
      confirm_password: confirmPassword || password,
    });
    const data = response.data;

    // STEP 1 & STEP 5: Extract access_token from FastAPI response and save in localStorage
    const rawAccessToken = data.access_token || data.token;
    const cleanAccessToken = sanitizeToken(rawAccessToken);

    if (!cleanAccessToken) {
      throw new Error('Authentication failed: Server did not return a valid 3-part access_token.');
    }

    localStorage.setItem('token', cleanAccessToken);
    localStorage.setItem('meetmind_token', cleanAccessToken);

    if (data.user) {
      localStorage.setItem('meetmind_user', JSON.stringify(data.user));
    }

    return data;
  },

  getCurrentUser(): User | null {
    const userStr = localStorage.getItem('meetmind_user');
    if (!userStr) return null;
    try {
      return JSON.parse(userStr);
    } catch {
      return null;
    }
  },

  getToken(): string | null {
    const raw = localStorage.getItem('token') || localStorage.getItem('meetmind_token');
    return sanitizeToken(raw);
  },

  logout(): void {
    clearActiveSessionData();
    localStorage.removeItem('token');
    localStorage.removeItem('meetmind_token');
    localStorage.removeItem('meetmind_user');
  },
};

