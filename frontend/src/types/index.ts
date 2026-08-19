export type EmailStatus = 'PENDING' | 'QUEUED' | 'SENDING' | 'SENT' | 'FAILED' | 'RATE_LIMITED';

export interface User {
  id: string;
  email: string;
  name: string;
  avatar: string | null;
}

export interface Email {
  id: string;
  recipientEmail: string;
  senderEmail: string;
  subject: string;
  body: string;
  scheduledAt: string;
  sentAt: string | null;
  status: EmailStatus;
  batchId: string;
  previewUrl: string | null;
  error: string | null;
  createdAt: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface Stats {
  scheduled: number;
  sent: number;
  failed: number;
  total: number;
}

export interface Sender {
  id: string;
  email: string;
  name: string;
}

export interface ScheduleEmailPayload {
  subject: string;
  body: string;
  recipients: string[];
  senderEmail: string;
  startTime: string;
  delayBetweenEmails: number;
  maxPerHour: number;
}
