import React from 'react';

interface TabsProps {
  tabs: { id: string; label: string; count?: number }[];
  activeTab: string;
  onChange: (tabId: string) => void;
}

export function Tabs({ tabs, activeTab, onChange }: TabsProps) {
  return (
    <div className="flex items-center gap-1 bg-dark-800/50 rounded-lg p-1 border border-dark-700/50">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          onClick={() => onChange(tab.id)}
          className={`
            relative px-4 py-2 text-sm font-medium rounded-md transition-all duration-200
            ${
              activeTab === tab.id
                ? 'bg-primary-600/20 text-primary-300 shadow-sm'
                : 'text-dark-400 hover:text-dark-200 hover:bg-dark-700/50'
            }
          `}
        >
          {tab.label}
          {tab.count !== undefined && (
            <span
              className={`ml-2 px-1.5 py-0.5 text-xs rounded-full ${
                activeTab === tab.id
                  ? 'bg-primary-500/30 text-primary-200'
                  : 'bg-dark-700 text-dark-400'
              }`}
            >
              {tab.count}
            </span>
          )}
        </button>
      ))}
    </div>
  );
}
