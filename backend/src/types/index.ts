import { EmailStatus } from '@prisma/client';

// API Request types
export interface ScheduleEmailRequest {
  subject: string;
  body: string;
  recipients: string[];
  senderEmail: string;
  startTime: string; // ISO date string
  delayBetweenEmails: number; // milliseconds
  maxPerHour?: number;
}

// API Response types
export interface EmailResponse {
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

export interface StatsResponse {
  scheduled: number;
  sent: number;
  failed: number;
  total: number;
}

export interface UserResponse {
  id: string;
  email: string;
  name: string;
  avatar: string | null;
}

export interface SenderResponse {
  id: string;
  email: string;
  name: string;
}

// Job data for BullMQ
export interface EmailJobData {
  emailId: string;
  senderEmail: string;
  maxPerHour: number;
}

// Express request augmentation
declare global {
  namespace Express {
    interface Request {
      userId?: string;
    }
  }
}
