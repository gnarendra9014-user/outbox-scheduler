import React from 'react';
import { Inbox } from 'lucide-react';

interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
}

export function EmptyState({
  icon,
  title,
  description,
  action,
}: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-6 text-center animate-fade-in">
      <div className="w-16 h-16 rounded-full bg-dark-800/80 border border-dark-700/50 flex items-center justify-center mb-4">
        {icon || <Inbox className="w-7 h-7 text-dark-500" />}
      </div>
      <h3 className="text-lg font-medium text-dark-200 mb-1">{title}</h3>
      {description && (
        <p className="text-sm text-dark-400 max-w-sm">{description}</p>
      )}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
