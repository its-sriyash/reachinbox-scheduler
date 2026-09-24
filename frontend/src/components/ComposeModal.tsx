import { useState, useRef, useEffect } from 'react';
import { X, Upload, FileText, CheckCircle2, Clipboard } from 'lucide-react';
import Papa from 'papaparse';
import { showToast } from './Toast';
import type { ScheduleEmailRequest } from '../types/email';

interface ComposeModalProps {
  open: boolean;
  onClose: () => void;
  onSchedule: (request: ScheduleEmailRequest) => Promise<void>;
}

interface FormErrors {
  subject?: string;
  body?: string;
  recipients?: string;
  sendAt?: string;
  delayBetweenEmails?: string;
  hourlyLimit?: string;
}

interface ParseReport {
  totalExtracted: number;
  validCount: number;
  duplicatesRemoved: number;
  invalidSkipped: number;
}

const EMAIL_REGEX =
  /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;

function extractEmailTokens(raw: string): string[] {
  return raw
    .split(/[\s,;<>]+/)
    .map((token) => token.trim().replace(/^['"]|['"]$/g, ''))
    .filter((token) => token.includes('@'));
}

export default function ComposeModal({ open, onClose, onSchedule }: ComposeModalProps) {
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [recipients, setRecipients] = useState<string[]>([]);
  const [recipientInputMode, setRecipientInputMode] = useState<'upload' | 'paste'>('upload');
  const [pastedText, setPastedText] = useState('');
  const [fileName, setFileName] = useState('');
  const [parseReport, setParseReport] = useState<ParseReport | null>(null);
  const [sendAt, setSendAt] = useState('');
  const [delayBetweenEmails, setDelayBetweenEmails] = useState(2);
  const [hourlyLimit, setHourlyLimit] = useState(100);
  const [errors, setErrors] = useState<FormErrors>({});
  const [submitting, setSubmitting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape' && open) {
        handleClose();
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open]);

  function resetForm() {
    setSubject('');
    setBody('');
    setRecipients([]);
    setPastedText('');
    setFileName('');
    setParseReport(null);
    setSendAt('');
    setDelayBetweenEmails(2);
    setHourlyLimit(100);
    setErrors({});
    setSubmitting(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  function handleClose() {
    resetForm();
    onClose();
  }

  function processExtractedCandidates(candidates: string[]) {
    const seen = new Set<string>();
    const valid: string[] = [];
    let duplicates = 0;
    let invalid = 0;

    for (const candidate of candidates) {
      const lower = candidate.toLowerCase();
      if (EMAIL_REGEX.test(lower)) {
        if (seen.has(lower)) {
          duplicates++;
        } else {
          seen.add(lower);
          valid.push(lower);
        }
      } else {
        invalid++;
      }
    }

    setParseReport({
      totalExtracted: candidates.length,
      validCount: valid.length,
      duplicatesRemoved: duplicates,
      invalidSkipped: invalid,
    });

    if (valid.length === 0) {
      setRecipients([]);
      setErrors((prev) => ({
        ...prev,
        recipients: 'No valid email addresses found in the provided input.',
      }));
    } else {
      setRecipients(valid);
      setErrors((prev) => {
        const next = { ...prev };
        delete next.recipients;
        return next;
      });
    }
  }

  function handlePastedTextChange(text: string) {
    setPastedText(text);
    if (!text.trim()) {
      setRecipients([]);
      setParseReport(null);
      return;
    }
    const candidates = extractEmailTokens(text);
    processExtractedCandidates(candidates);
  }

  function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    setParseReport(null);

    if (file.size === 0) {
      setRecipients([]);
      setErrors((prev) => ({ ...prev, recipients: 'The uploaded file is empty.' }));
      return;
    }

    const reader = new FileReader();

    reader.onload = (event) => {
      const text = event.target?.result as string;
      if (!text || text.trim().length === 0) {
        setRecipients([]);
        setErrors((prev) => ({ ...prev, recipients: 'The uploaded file is empty.' }));
        return;
      }

      const candidates: string[] = [];
      const isCsv = file.name.toLowerCase().endsWith('.csv');

      if (isCsv) {
        try {
          const result = Papa.parse<string[]>(text, { skipEmptyLines: true });
          for (const row of result.data) {
            if (Array.isArray(row)) {
              for (const cell of row) {
                if (typeof cell === 'string') {
                  candidates.push(...extractEmailTokens(cell));
                }
              }
            }
          }
        } catch {
          setRecipients([]);
          setErrors((prev) => ({
            ...prev,
            recipients: 'Failed to parse file. Please upload a valid CSV or plain text file.',
          }));
          return;
        }
      } else {
        candidates.push(...extractEmailTokens(text));
      }

      processExtractedCandidates(candidates);
    };

    reader.onerror = () => {
      setRecipients([]);
      setErrors((prev) => ({
        ...prev,
        recipients: 'Failed to read file from system.',
      }));
    };

    reader.readAsText(file);
  }

  function validate(): FormErrors {
    const newErrors: FormErrors = {};

    if (!subject.trim()) {
      newErrors.subject = 'Subject is required.';
    }

    if (!body.trim()) {
      newErrors.body = 'Email body is required.';
    }

    if (recipients.length === 0) {
      newErrors.recipients = 'At least one valid recipient email is required.';
    }

    if (!sendAt) {
      newErrors.sendAt = 'Start time is required.';
    } else {
      const selected = new Date(sendAt).getTime();
      if (isNaN(selected)) {
        newErrors.sendAt = 'Please select a valid date and time.';
      } else if (selected <= Date.now()) {
        newErrors.sendAt = 'Start time must be in the future.';
      }
    }

    if (isNaN(delayBetweenEmails) || delayBetweenEmails < 0) {
      newErrors.delayBetweenEmails = 'Delay must be 0 seconds or greater.';
    }

    if (isNaN(hourlyLimit) || hourlyLimit < 1) {
      newErrors.hourlyLimit = 'Hourly limit must be at least 1.';
    }

    return newErrors;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    const validationErrors = validate();
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      return;
    }

    setSubmitting(true);
    try {
      await onSchedule({
        subject: subject.trim(),
        body: body.trim(),
        recipients,
        sendAt: new Date(sendAt).toISOString(),
        delayBetweenEmails,
        hourlyLimit,
      });

      showToast(
        `Successfully scheduled ${recipients.length} email${recipients.length === 1 ? '' : 's'}!`,
        'success'
      );
      handleClose();
    } catch {
      showToast('Unable to prepare schedule request. Please try again.', 'error');
    } finally {
      setSubmitting(false);
    }
  }

  if (!open) return null;

  const minDateTime = new Date().toISOString().slice(0, 16);

  return (
    <div className="modal-overlay" onClick={handleClose} role="dialog" aria-modal="true" aria-labelledby="modal-title">
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2 id="modal-title" className="modal-title">
            <span className="vertical-orange-indicator" />
            Schedule New Email Batch
          </h2>
          <button onClick={handleClose} className="modal-close" aria-label="Close modal">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="modal-body">
          <div className="form-group">
            <label htmlFor="compose-subject" className="form-label">
              Subject <span className="text-orange-500">*</span>
            </label>
            <input
              id="compose-subject"
              type="text"
              className={`form-input ${errors.subject ? 'form-input-error' : ''}`}
              value={subject}
              onChange={(e) => {
                setSubject(e.target.value);
                if (errors.subject) setErrors((prev) => ({ ...prev, subject: undefined }));
              }}
              placeholder="e.g. Partnership Opportunity"
            />
            {errors.subject && <p className="form-error">{errors.subject}</p>}
          </div>

          <div className="form-group">
            <label htmlFor="compose-body" className="form-label">
              Body <span className="text-orange-500">*</span>
            </label>
            <textarea
              id="compose-body"
              className={`form-input form-textarea ${errors.body ? 'form-input-error' : ''}`}
              value={body}
              onChange={(e) => {
                setBody(e.target.value);
                if (errors.body) setErrors((prev) => ({ ...prev, body: undefined }));
              }}
              placeholder="Write your email content..."
              rows={4}
            />
            {errors.body && <p className="form-error">{errors.body}</p>}
          </div>

          <div className="form-group">
            <div className="flex items-center justify-between mb-1">
              <label className="form-label mb-0">
                Recipients <span className="text-orange-500">*</span>
              </label>
              <div className="flex items-center gap-1 bg-[var(--color-surface-secondary)] p-0.5 rounded-lg border border-[var(--color-border)] text-xs">
                <button
                  type="button"
                  onClick={() => setRecipientInputMode('upload')}
                  className={`px-2.5 py-1 rounded-md transition-all font-medium ${
                    recipientInputMode === 'upload'
                      ? 'bg-orange-500 text-white shadow-sm'
                      : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]'
                  }`}
                >
                  <Upload size={12} className="inline mr-1" /> File Upload
                </button>
                <button
                  type="button"
                  onClick={() => setRecipientInputMode('paste')}
                  className={`px-2.5 py-1 rounded-md transition-all font-medium ${
                    recipientInputMode === 'paste'
                      ? 'bg-orange-500 text-white shadow-sm'
                      : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]'
                  }`}
                >
                  <Clipboard size={12} className="inline mr-1" /> Paste CSV / Text
                </button>
              </div>
            </div>

            {recipientInputMode === 'upload' ? (
              <div
                className={`file-upload ${errors.recipients ? 'file-upload-error' : ''}`}
                onClick={() => fileInputRef.current?.click()}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    fileInputRef.current?.click();
                  }
                }}
                aria-label="Upload CSV or text file containing recipients"
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv,.txt,text/plain,text/csv"
                  onChange={handleFileUpload}
                  className="file-input-hidden"
                />
                {fileName ? (
                  <div className="file-selected">
                    <FileText size={20} />
                    <span>{fileName}</span>
                  </div>
                ) : (
                  <div className="file-placeholder">
                    <Upload size={22} />
                    <span>Upload CSV or text file</span>
                    <span className="file-hint">Auto-extracts emails, removes duplicates & skips invalid rows</span>
                  </div>
                )}
              </div>
            ) : (
              <textarea
                className={`form-input form-textarea text-xs ${errors.recipients ? 'form-input-error' : ''}`}
                value={pastedText}
                onChange={(e) => handlePastedTextChange(e.target.value)}
                placeholder="Paste CSV rows, comma-separated emails, or one address per line..."
                rows={3}
              />
            )}

            {errors.recipients && <p className="form-error">{errors.recipients}</p>}

            {recipients.length > 0 && (
              <div className="recipient-count flex items-center gap-1.5 mt-1">
                <CheckCircle2 size={15} className="text-emerald-500" />
                <span>
                  {recipients.length} valid email {recipients.length === 1 ? 'address' : 'addresses'} detected
                </span>
                {parseReport && (parseReport.duplicatesRemoved > 0 || parseReport.invalidSkipped > 0) && (
                  <span className="text-zinc-500 text-xs font-normal ml-1">
                    ({parseReport.duplicatesRemoved > 0 ? `${parseReport.duplicatesRemoved} duplicate${parseReport.duplicatesRemoved > 1 ? 's' : ''} removed` : ''}
                    {parseReport.duplicatesRemoved > 0 && parseReport.invalidSkipped > 0 ? ', ' : ''}
                    {parseReport.invalidSkipped > 0 ? `${parseReport.invalidSkipped} invalid skipped` : ''})
                  </span>
                )}
              </div>
            )}
          </div>

          <div className="form-row">
            <div className="form-group form-group-flex">
              <label htmlFor="sendAt" className="form-label">
                Start Time <span className="text-orange-500">*</span>
              </label>
              <input
                id="sendAt"
                type="datetime-local"
                className={`form-input ${errors.sendAt ? 'form-input-error' : ''}`}
                value={sendAt}
                onChange={(e) => {
                  setSendAt(e.target.value);
                  if (errors.sendAt) setErrors((prev) => ({ ...prev, sendAt: undefined }));
                }}
                min={minDateTime}
              />
              {errors.sendAt && <p className="form-error">{errors.sendAt}</p>}
            </div>

            <div className="form-group form-group-flex">
              <label htmlFor="delay" className="form-label">
                Delay Between Emails (sec)
              </label>
              <input
                id="delay"
                type="number"
                className={`form-input ${errors.delayBetweenEmails ? 'form-input-error' : ''}`}
                value={delayBetweenEmails}
                onChange={(e) => {
                  setDelayBetweenEmails(Number(e.target.value));
                  if (errors.delayBetweenEmails) setErrors((prev) => ({ ...prev, delayBetweenEmails: undefined }));
                }}
                min={0}
              />
              {errors.delayBetweenEmails && <p className="form-error">{errors.delayBetweenEmails}</p>}
            </div>

            <div className="form-group form-group-flex">
              <label htmlFor="hourlyLimit" className="form-label">
                Hourly Limit
              </label>
              <input
                id="hourlyLimit"
                type="number"
                className={`form-input ${errors.hourlyLimit ? 'form-input-error' : ''}`}
                value={hourlyLimit}
                onChange={(e) => {
                  setHourlyLimit(Number(e.target.value));
                  if (errors.hourlyLimit) setErrors((prev) => ({ ...prev, hourlyLimit: undefined }));
                }}
                min={1}
              />
              {errors.hourlyLimit && <p className="form-error">{errors.hourlyLimit}</p>}
            </div>
          </div>

          <div className="modal-footer">
            <button type="button" onClick={handleClose} className="btn btn-secondary">
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={submitting}>
              {submitting ? 'Scheduling…' : 'Schedule Emails'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
