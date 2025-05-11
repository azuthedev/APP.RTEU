import React, { useState } from 'react';
import DatabaseBrowser from './DatabaseBrowser';
import InviteLinks from './InviteLinks';
import FeatureFlagAdmin from './FeatureFlagAdmin';
import SystemStatus from './SystemStatus';
import ToastSimulator from './ToastSimulator';
import ConsoleLogStream from './ConsoleLogStream';
import { Database, Flag, Settings, Link, Activity, MessageSquare, BarChart, ArrowLeft } from 'lucide-react';

const tabs = [
  { id: 'database', label: 'Database Browser', icon: Database },
  { id: 'feature-flags', label: 'Feature Flags', icon: Flag },
  { id: 'invite-links', label: 'Invite Links', icon: Link },
  { id: 'system-status', label: 'System Health', icon: Activity },
  { id: 'toast-simulator', label: 'Toast Simulator', icon: MessageSquare },
  { id: 'log-stream', label: 'Log Stream', icon: BarChart },
];

const AdminDeveloperTools: React.FC = () => {
  const [activeTab, setActiveTab] = useState<string | null>(null);

  const handleBackToMenu = () => {
    setActiveTab(null);
  };

  return (
    <div>
      <div className="mb-8">
        <h2 className="text-xl font-semibold dark:text-white mb-2">Developer Tools</h2>
      </div>

      {/* Tab Content */}
      {activeTab && (
        <div className="mb-6">
          <button
            onClick={handleBackToMenu}
            className="flex items-center text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 mb-4"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Tools Menu
          </button>
          
          {activeTab === 'database' && <DatabaseBrowser />}
          {activeTab === 'feature-flags' && <FeatureFlagAdmin />}
          {activeTab === 'invite-links' && <InviteLinks />}
          {activeTab === 'system-status' && <SystemStatus />}
          {activeTab === 'toast-simulator' && <ToastSimulator />}
          {activeTab === 'log-stream' && <ConsoleLogStream />}
        </div>
      )}

      {/* Initial state - no tab selected */}
      {!activeTab && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-8 text-center border dark:border-gray-700">
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">Developer Tools Dashboard</h3>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className="p-6 bg-gray-50 dark:bg-gray-700 rounded-lg text-center hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors border dark:border-gray-600"
              >
                <tab.icon className="w-8 h-8 mb-3 mx-auto text-blue-600 dark:text-blue-400" />
                <h4 className="text-gray-900 dark:text-white font-medium mb-1">{tab.label}</h4>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  {tab.id === 'database' && 'Browse and query database tables'}
                  {tab.id === 'feature-flags' && 'Manage feature flags and toggles'}
                  {tab.id === 'invite-links' && 'Create and manage invite links'}
                  {tab.id === 'system-status' && 'Monitor system health metrics'}
                  {tab.id === 'toast-simulator' && 'Test notification toasts'}
                  {tab.id === 'log-stream' && 'View application logs'}
                </p>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminDeveloperTools;
