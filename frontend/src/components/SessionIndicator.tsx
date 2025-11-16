import React from 'react';

interface SessionIndicatorProps {
  sessions: string[];
  className?: string;
}

const SESSION_INFO: Record<string, { name: string; color: string; bgColor: string }> = {
  tokyo: {
    name: 'Tokyo',
    color: 'text-red-600',
    bgColor: 'bg-red-100',
  },
  london: {
    name: 'London',
    color: 'text-blue-600',
    bgColor: 'bg-blue-100',
  },
  newyork: {
    name: 'New York',
    color: 'text-green-600',
    bgColor: 'bg-green-100',
  },
  sydney: {
    name: 'Sydney',
    color: 'text-purple-600',
    bgColor: 'bg-purple-100',
  },
};

const SessionIndicator: React.FC<SessionIndicatorProps> = ({ sessions, className = '' }) => {
  if (!sessions || sessions.length === 0) {
    return (
      <div className={`flex items-center gap-1 text-xs text-gray-500 ${className}`}>
        <span className="w-2 h-2 rounded-full bg-gray-300"></span>
        <span>Market Closed</span>
      </div>
    );
  }

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      {sessions.map((session) => {
        const info = SESSION_INFO[session.toLowerCase()];
        if (!info) return null;

        return (
          <div
            key={session}
            className={`flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium ${info.color} ${info.bgColor}`}
          >
            <span className={`w-1.5 h-1.5 rounded-full bg-current animate-pulse`}></span>
            <span>{info.name}</span>
          </div>
        );
      })}
    </div>
  );
};

export default SessionIndicator;
