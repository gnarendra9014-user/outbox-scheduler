import { useState } from 'react';
import { Clock, Trash2 } from 'lucide-react';
import { Table } from '../ui/Table';
import { StatusBadge } from '../ui/StatusBadge';
import { EmptyState } from '../ui/EmptyState';
import { TableSkeleton } from '../ui/Spinner';
import { useScheduledEmails } from '../../hooks/useEmails';
import api from '../../api/client';
import toast from 'react-hot-toast';
import type { Email } from '../../types';

export function ScheduledEmails() {
  const [page, setPage] = useState(1);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const { data, isLoading, error, refetch } = useScheduledEmails(page);

  const handleDelete = async (id: string) => {
    if (!window.confirm('Are you sure you want to cancel this scheduled email?')) {
      return;
    }

    setDeletingId(id);
    try {
      await api.delete(`/emails/${id}`);
      toast.success('Scheduled email cancelled successfully');
      refetch();
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to cancel email');
    } finally {
      setDeletingId(null);
    }
  };

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
    {
      key: 'actions',
      header: 'Action',
      render: (email: Email) => (
        <button
          onClick={() => handleDelete(email.id)}
          disabled={deletingId === email.id}
          className="p-1.5 rounded-lg text-dark-400 hover:text-red-400 hover:bg-red-500/10 transition-all duration-150 disabled:opacity-50"
          title="Cancel scheduled email"
        >
          <Trash2 className="w-4 h-4" />
        </button>
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
