import type { EmailStatus } from '../../types';

interface StatusBadgeProps {
  status: EmailStatus;
}

const statusConfig: Record<EmailStatus, { label: string; className: string }> = {
  PENDING: { label: 'Pending', className: 'badge-pending' },
  QUEUED: { label: 'Queued', className: 'badge-queued' },
  SENDING: { label: 'Sending', className: 'badge-sending' },
  SENT: { label: 'Sent', className: 'badge-sent' },
  FAILED: { label: 'Failed', className: 'badge-failed' },
  RATE_LIMITED: { label: 'Rate Limited', className: 'badge-rate-limited' },
};

export function StatusBadge({ status }: StatusBadgeProps) {
  const config = statusConfig[status] || statusConfig.PENDING;

  return (
    <span className={config.className}>
      <span className="w-1.5 h-1.5 rounded-full bg-current" />
      {config.label}
    </span>
  );
}
