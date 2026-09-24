import axios from 'axios';
import type { User } from '../types/user';
import type { ScheduledEmail, SentEmail, ScheduleEmailRequest, ScheduleEmailResponse } from '../types/email';

const baseURL = import.meta.env.VITE_API_BASE_URL || '/api';

const client = axios.create({
  baseURL,
  withCredentials: true,
  timeout: 15000,
});

client.interceptors.request.use((config) => {
  const token = localStorage.getItem('auth_token');
  if (token && !config.headers.Authorization) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

client.interceptors.response.use(
  (response) => {
    // If a request intended for the API returned HTML (e.g. from an SPA rewrite fallback), reject it
    if (typeof response.data === 'string' && (response.data.includes('<!DOCTYPE') || response.data.includes('<!doctype') || response.data.includes('<html'))) {
      return Promise.reject(new Error('Received HTML response instead of JSON API payload'));
    }
    return response;
  },
  (error) => Promise.reject(error)
);

export async function getCurrentUser(): Promise<User | null> {
  try {
    const { data } = await client.get('/auth/me');
    if (!data || typeof data !== 'object' || typeof (data as User).email !== 'string') {
      return null;
    }
    return data as User;
  } catch {
    return null;
  }
}

export async function devLogin(): Promise<User> {
  const { data } = await client.post<{ user: User; token?: string }>('/auth/dev-login');
  if (data.token) {
    localStorage.setItem('auth_token', data.token);
  }
  return data.user;
}

export async function logout(): Promise<void> {
  try {
    await client.post('/auth/logout');
  } catch {
    // session cleared locally
  } finally {
    localStorage.removeItem('auth_token');
  }
}

export async function getScheduledEmails(): Promise<ScheduledEmail[]> {
  const { data } = await client.get<ScheduledEmail[]>('/emails/scheduled');
  return data;
}

export async function getSentEmails(): Promise<SentEmail[]> {
  const { data } = await client.get<SentEmail[]>('/emails/sent');
  return data;
}

export async function scheduleEmails(request: ScheduleEmailRequest): Promise<ScheduleEmailResponse> {
  const { data } = await client.post<ScheduleEmailResponse>('/emails/schedule', request);
  return data;
}
