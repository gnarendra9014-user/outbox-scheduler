import { useState } from 'react';
import { Send, ExternalLink } from 'lucide-react';
import { Table } from '../ui/Table';
import { StatusBadge } from '../ui/StatusBadge';
import { EmptyState } from '../ui/EmptyState';
import { TableSkeleton } from '../ui/Spinner';
import { useSentEmails } from '../../hooks/useEmails';
import type { Email } from '../../types';

export function SentEmails() {
  const [page, setPage] = useState(1);
  const { data, isLoading, error } = useSentEmails(page);

  if (isLoading) {
    return (
      <div className="glass-card">
        <TableSkeleton rows={5} cols={5} />
      </div>
    );
  }

  if (error) {
    return (
      <div className="glass-card p-6">
        <p className="text-red-400 text-sm">{error}</p>
      </div>
    );
  }

  if (!data || data.data.length === 0) {
    return (
      <div className="glass-card">
        <EmptyState
          icon={<Send className="w-7 h-7 text-dark-500" />}
          title="No sent emails yet"
          description="Emails will appear here once they've been sent."
        />
      </div>
    );
  }

  const columns = [
    {
      key: 'recipient',
      header: 'Recipient',
      render: (email: Email) => (
        <span className="text-dark-200 font-medium">{email.recipientEmail}</span>
      ),
    },
    {
      key: 'subject',
      header: 'Subject',
      render: (email: Email) => (
        <span className="text-dark-300 truncate max-w-[200px] block">{email.subject}</span>
      ),
    },
    {
      key: 'sentAt',
      header: 'Sent At',
      render: (email: Email) => (
        <span className="text-dark-400 text-xs">
          {email.sentAt ? new Date(email.sentAt).toLocaleString() : '—'}
        </span>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (email: Email) => <StatusBadge status={email.status} />,
    },
    {
      key: 'preview',
      header: 'Preview',
      render: (email: Email) =>
        email.previewUrl ? (
          <a
            href={email.previewUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-xs text-primary-400 hover:text-primary-300 transition-colors"
          >
            View <ExternalLink className="w-3 h-3" />
          </a>
        ) : email.error ? (
          <span className="text-xs text-red-400 truncate max-w-[150px] block" title={email.error}>
            {email.error}
          </span>
        ) : (
          <span className="text-dark-500 text-xs">—</span>
        ),
    },
  ];

  return (
    <div className="glass-card overflow-hidden">
      <Table
        columns={columns}
        data={data.data}
        keyExtractor={(email) => email.id}
        page={page}
        totalPages={data.totalPages}
        onPageChange={setPage}
      />
    </div>
  );
}
