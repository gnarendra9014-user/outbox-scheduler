import { useState } from 'react';
import { Clock, ExternalLink } from 'lucide-react';
import { Table } from '../ui/Table';
import { StatusBadge } from '../ui/StatusBadge';
import { EmptyState } from '../ui/EmptyState';
import { TableSkeleton } from '../ui/Spinner';
import { useScheduledEmails } from '../../hooks/useEmails';
import type { Email } from '../../types';

export function ScheduledEmails() {
  const [page, setPage] = useState(1);
  const { data, isLoading, error } = useScheduledEmails(page);

  if (isLoading) {
    return (
      <div className="glass-card">
        <TableSkeleton rows={5} cols={4} />
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
          icon={<Clock className="w-7 h-7 text-dark-500" />}
          title="No scheduled emails"
          description="Schedule your first email campaign to see it here."
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
      key: 'scheduledAt',
      header: 'Scheduled For',
      render: (email: Email) => (
        <span className="text-dark-400 text-xs">
          {new Date(email.scheduledAt).toLocaleString()}
        </span>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (email: Email) => <StatusBadge status={email.status} />,
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
