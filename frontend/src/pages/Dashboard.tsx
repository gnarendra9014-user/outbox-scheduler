import { useState, useCallback } from 'react';
import { Plus, Calendar, Send, AlertTriangle, BarChart3, RefreshCw } from 'lucide-react';
import { Header } from '../components/layout/Header';
import { Tabs } from '../components/ui/Tabs';
import { Button } from '../components/ui/Button';
import { ScheduledEmails } from '../components/emails/ScheduledEmails';
import { SentEmails } from '../components/emails/SentEmails';
import { ComposeModal } from '../components/compose/ComposeModal';
import { useEmailStats } from '../hooks/useEmails';

export function Dashboard() {
  const [activeTab, setActiveTab] = useState('scheduled');
  const [isComposeOpen, setIsComposeOpen] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const { stats } = useEmailStats();

  const handleRefresh = useCallback(() => {
    setRefreshKey((prev) => prev + 1);
  }, []);

  const tabs = [
    {
      id: 'scheduled',
      label: 'Scheduled',
      count: stats?.scheduled || 0,
    },
    {
      id: 'sent',
      label: 'Sent',
      count: stats?.sent || 0,
    },
  ];

  return (
    <div className="min-h-screen bg-dark-950">
      <Header />

      <main className="max-w-7xl mx-auto px-6 py-8">
        {/* Stats Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <StatCard
            icon={<Calendar className="w-5 h-5" />}
            label="Scheduled"
            value={stats?.scheduled || 0}
            color="blue"
          />
          <StatCard
            icon={<Send className="w-5 h-5" />}
            label="Sent"
            value={stats?.sent || 0}
            color="green"
          />
          <StatCard
            icon={<AlertTriangle className="w-5 h-5" />}
            label="Failed"
            value={stats?.failed || 0}
            color="red"
          />
          <StatCard
            icon={<BarChart3 className="w-5 h-5" />}
            label="Total"
            value={stats?.total || 0}
            color="purple"
          />
        </div>

        {/* Controls */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
          <Tabs tabs={tabs} activeTab={activeTab} onChange={setActiveTab} />

          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleRefresh}
              leftIcon={<RefreshCw className="w-4 h-4" />}
            >
              Refresh
            </Button>
            <Button
              variant="primary"
              onClick={() => setIsComposeOpen(true)}
              leftIcon={<Plus className="w-4 h-4" />}
            >
              Compose New Email
            </Button>
          </div>
        </div>

        {/* Content */}
        <div key={refreshKey}>
          {activeTab === 'scheduled' ? <ScheduledEmails /> : <SentEmails />}
        </div>
      </main>

      {/* Compose Modal */}
      <ComposeModal
        isOpen={isComposeOpen}
        onClose={() => setIsComposeOpen(false)}
        onSuccess={handleRefresh}
      />
    </div>
  );
}

// Stats Card sub-component
function StatCard({
  icon,
  label,
  value,
  color,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  color: 'blue' | 'green' | 'red' | 'purple';
}) {
  const colorMap = {
    blue: {
      bg: 'bg-blue-500/10',
      border: 'border-blue-500/20',
      icon: 'text-blue-400',
      value: 'text-blue-300',
    },
    green: {
      bg: 'bg-emerald-500/10',
      border: 'border-emerald-500/20',
      icon: 'text-emerald-400',
      value: 'text-emerald-300',
    },
    red: {
      bg: 'bg-red-500/10',
      border: 'border-red-500/20',
      icon: 'text-red-400',
      value: 'text-red-300',
    },
    purple: {
      bg: 'bg-purple-500/10',
      border: 'border-purple-500/20',
      icon: 'text-purple-400',
      value: 'text-purple-300',
    },
  };

  const c = colorMap[color];

  return (
    <div className={`glass-card-hover p-4 ${c.bg} border ${c.border}`}>
      <div className="flex items-center gap-3">
        <div className={`${c.icon}`}>{icon}</div>
        <div>
          <p className="text-xs text-dark-400 uppercase tracking-wider">{label}</p>
          <p className={`text-2xl font-bold ${c.value}`}>{value.toLocaleString()}</p>
        </div>
      </div>
    </div>
  );
}
