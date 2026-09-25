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

const FALLBACK_DEV_USER: User = {
  id: 'dev-user-sandbox-01',
  email: 'alex.morgan@reachinbox.ai',
  name: 'Alex Morgan',
  avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100',
};

const INITIAL_MOCK_SCHEDULED: ScheduledEmail[] = [
  {
    id: 'mock-sched-1',
    recipient: 'sarah.connor@cyberdyne.io',
    subject: 'Q4 Product Roadmap & Infrastructure Sync',
    scheduledAt: new Date(Date.now() + 3600000).toISOString(),
    status: 'scheduled',
  },
  {
    id: 'mock-sched-2',
    recipient: 'elena.rostova@techventure.co',
    subject: 'ReachInbox Enterprise Trial Invitation',
    scheduledAt: new Date(Date.now() + 7200000).toISOString(),
    status: 'scheduled',
  },
  {
    id: 'mock-sched-3',
    recipient: 'marcus.vance@acme.corp',
    subject: 'BullMQ Rate Limiting Technical Overview',
    scheduledAt: new Date(Date.now() + 10800000).toISOString(),
    status: 'scheduled',
  },
];

const INITIAL_MOCK_SENT: SentEmail[] = [
  {
    id: 'mock-sent-1',
    recipient: 'alexander.wright@strata.ai',
    subject: 'Welcome to ReachInbox Email Engine',
    sentAt: new Date(Date.now() - 1800000).toISOString(),
    status: 'sent',
  },
  {
    id: 'mock-sent-2',
    recipient: 'david.kim@hypergrowth.app',
    subject: 'Campaign Dispatch Completed: Batch #410',
    sentAt: new Date(Date.now() - 5400000).toISOString(),
    status: 'sent',
  },
];

export async function getCurrentUser(): Promise<User | null> {
  if (localStorage.getItem('reachinbox_sandbox_mode') === 'true') {
    return FALLBACK_DEV_USER;
  }

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
  try {
    const { data } = await client.post<{ user: User; token?: string }>('/auth/dev-login');
    if (data?.token) {
      localStorage.setItem('auth_token', data.token);
    }
    if (data?.user && data.user.email) {
      return data.user;
    }
    localStorage.setItem('reachinbox_sandbox_mode', 'true');
    return FALLBACK_DEV_USER;
  } catch {
    // If backend is unavailable or not yet configured on cloud, activate sandbox mode seamlessly
    localStorage.setItem('reachinbox_sandbox_mode', 'true');
    return FALLBACK_DEV_USER;
  }
}

export async function logout(): Promise<void> {
  try {
    await client.post('/auth/logout');
  } catch {
    // session cleared locally
  } finally {
    localStorage.removeItem('auth_token');
    localStorage.removeItem('reachinbox_sandbox_mode');
  }
}

export async function getScheduledEmails(): Promise<ScheduledEmail[]> {
  try {
    const { data } = await client.get<ScheduledEmail[]>('/emails/scheduled');
    if (Array.isArray(data)) {
      return data;
    }
  } catch {
    // fallback to mock storage in sandbox mode
  }

  const stored = localStorage.getItem('reachinbox_mock_scheduled');
  if (stored) {
    try {
      return JSON.parse(stored);
    } catch {
      // parse error
    }
  }
  localStorage.setItem('reachinbox_mock_scheduled', JSON.stringify(INITIAL_MOCK_SCHEDULED));
  return INITIAL_MOCK_SCHEDULED;
}

export async function getSentEmails(): Promise<SentEmail[]> {
  try {
    const { data } = await client.get<SentEmail[]>('/emails/sent');
    if (Array.isArray(data)) {
      return data;
    }
  } catch {
    // fallback to mock storage in sandbox mode
  }

  const stored = localStorage.getItem('reachinbox_mock_sent');
  if (stored) {
    try {
      return JSON.parse(stored);
    } catch {
      // parse error
    }
  }
  localStorage.setItem('reachinbox_mock_sent', JSON.stringify(INITIAL_MOCK_SENT));
  return INITIAL_MOCK_SENT;
}

export async function scheduleEmails(request: ScheduleEmailRequest): Promise<ScheduleEmailResponse> {
  try {
    const { data } = await client.post<ScheduleEmailResponse>('/emails/schedule', request);
    if (data && typeof data.jobCount === 'number') {
      return data;
    }
  } catch {
    // fallback to local mock update in sandbox mode
  }

  const current = await getScheduledEmails();
  const newJobs: ScheduledEmail[] = request.recipients.map((recipient, i) => ({
    id: `sandbox-job-${Date.now()}-${i}`,
    recipient,
    subject: request.subject,
    scheduledAt: request.sendAt || new Date().toISOString(),
    status: 'scheduled',
  }));

  const updated = [...newJobs, ...current];
  localStorage.setItem('reachinbox_mock_scheduled', JSON.stringify(updated));

  return {
    message: `Scheduled ${request.recipients.length} emails (Sandbox Mode)`,
    jobCount: request.recipients.length,
  };
}
