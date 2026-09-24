import { useState, useEffect } from 'react';
import { Plus, Search } from 'lucide-react';
import Header from '../components/Header';
import Tabs from '../components/Tabs';
import EmailTable from '../components/EmailTable';
import ComposeModal from '../components/ComposeModal';
import BackgroundParticles from '../components/BackgroundParticles';
import { getScheduledEmails, getSentEmails, scheduleEmails } from '../lib/api';
import type { User } from '../types/user';
import type { ScheduledEmail, SentEmail, ScheduleEmailRequest } from '../types/email';

interface DashboardProps {
  user: User;
  onLogout: () => void;
}

export default function Dashboard({ user, onLogout }: DashboardProps) {
  const [activeTab, setActiveTab] = useState('scheduled');
  const [scheduledEmails, setScheduledEmails] = useState<ScheduledEmail[]>([]);
  const [sentEmails, setSentEmails] = useState<SentEmail[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [composeOpen, setComposeOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    async function loadData() {
      setLoading(true);
      setError(null);
      try {
        const [scheduled, sent] = await Promise.all([
          getScheduledEmails(),
          getSentEmails(),
        ]);
        setScheduledEmails(scheduled);
        setSentEmails(sent);
      } catch {
        setError('Failed to load email records. Please try again.');
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  async function handleSchedule(request: ScheduleEmailRequest) {
    await scheduleEmails(request);
    const [updatedScheduled, updatedSent] = await Promise.all([
      getScheduledEmails(),
      getSentEmails(),
    ]);
    setScheduledEmails(updatedScheduled);
    setSentEmails(updatedSent);
  }

  const query = searchQuery.trim().toLowerCase();

  const filteredScheduled = scheduledEmails.filter((e) =>
    query ? e.recipient.toLowerCase().includes(query) || e.subject.toLowerCase().includes(query) : true
  );

  const filteredSent = sentEmails.filter((e) =>
    query ? e.recipient.toLowerCase().includes(query) || e.subject.toLowerCase().includes(query) : true
  );

  const scheduledColumns = [
    { key: 'recipient' as const, label: 'Recipient' },
    { key: 'subject' as const, label: 'Subject' },
    {
      key: 'scheduledAt' as const,
      label: 'Scheduled Time',
      render: (value: ScheduledEmail[keyof ScheduledEmail]) =>
        new Date(value as string).toLocaleString(),
    },
    { key: 'status' as const, label: 'Status' },
  ];

  const sentColumns = [
    { key: 'recipient' as const, label: 'Recipient' },
    { key: 'subject' as const, label: 'Subject' },
    {
      key: 'sentAt' as const,
      label: 'Sent Time',
      render: (value: SentEmail[keyof SentEmail]) =>
        new Date(value as string).toLocaleString(),
    },
    { key: 'status' as const, label: 'Status' },
  ];

  const tabs = [
    { id: 'scheduled', label: 'Scheduled', count: filteredScheduled.length },
    { id: 'sent', label: 'Sent', count: filteredSent.length },
  ];

  return (
    <div className="app-background min-h-screen">
      <BackgroundParticles />
      <Header user={user} onLogout={onLogout} />

      <main className="dashboard-main relative z-10">
        <section className="dual-cards-container mb-8">
          <div className="airshare-card">
            <div className="card-header-bar">
              <span className="vertical-orange-indicator" />
              <h2 className="card-heading">Compose Campaign</h2>
            </div>
            <p className="card-subtitle">
              Schedule bulk email batches with automatic CSV parsing, rate limits, and custom delay intervals
            </p>
            <div className="mt-auto pt-2">
              <button
                onClick={() => setComposeOpen(true)}
                className="btn-airshare-orange"
              >
                <Plus size={19} strokeWidth={2.5} />
                Schedule New Email Batch
              </button>
            </div>
          </div>

          <div className="airshare-card">
            <div className="card-header-bar">
              <span className="vertical-orange-indicator" />
              <h2 className="card-heading">Engine & Throttle</h2>
            </div>
            <p className="card-subtitle">
              BullMQ worker concurrency, Redis rate-limiting, and PostgreSQL persistence active.
            </p>
            <div className="mt-auto">
              <label className="input-label-airshare">ACTIVE SCHEDULER ENGINE</label>
              <div className="airshare-code-box active">
                <span className="status-dot-amber" />
                BULLMQ READY • REDIS THROTTLED
              </div>
              <div className="search-wrapper">
                <Search size={16} className="search-icon" />
                <input
                  type="text"
                  placeholder="Filter campaigns by recipient or subject..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="form-input search-input"
                />
              </div>
            </div>
          </div>
        </section>

        <section className="dashboard-content">
          <div className="px-6 py-4 border-b border-[var(--color-border)] flex items-center justify-between flex-wrap gap-4">
            <div className="card-header-bar mb-0">
              <span className="vertical-orange-indicator" />
              <h3 className="text-lg font-bold text-[var(--color-text-primary)] tracking-tight">Campaign Queue</h3>
            </div>
          </div>

          <Tabs tabs={tabs} activeTab={activeTab} onChange={setActiveTab} />

          <div className="table-section">
            {activeTab === 'scheduled' ? (
              <EmailTable
                data={filteredScheduled}
                columns={scheduledColumns}
                loading={loading}
                error={error}
                emptyTitle={query ? 'No matching scheduled emails' : 'No scheduled emails yet'}
                emptyDescription={
                  query
                    ? `No scheduled emails matched "${searchQuery}". Clear filter to view all.`
                    : 'Schedule your first email campaign to prepare the dispatch queue.'
                }
                emptyActionLabel={query ? 'Clear Filter' : 'Schedule your first email'}
                onEmptyAction={query ? () => setSearchQuery('') : () => setComposeOpen(true)}
              />
            ) : (
              <EmailTable
                data={filteredSent}
                columns={sentColumns}
                loading={loading}
                error={error}
                emptyTitle={query ? 'No matching sent emails' : 'No sent emails yet'}
                emptyDescription={
                  query
                    ? `No sent emails matched "${searchQuery}". Clear filter to view all.`
                    : 'Dispatched emails will appear here once the worker processes them.'
                }
                emptyActionLabel={query ? 'Clear Filter' : undefined}
                onEmptyAction={query ? () => setSearchQuery('') : undefined}
              />
            )}
          </div>
        </section>
      </main>

      <ComposeModal
        open={composeOpen}
        onClose={() => setComposeOpen(false)}
        onSchedule={handleSchedule}
      />
    </div>
  );
}
