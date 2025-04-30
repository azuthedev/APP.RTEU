import React from 'react';
import { AlertCircle, FileText, Calendar, Clock, User, ArrowUpRight } from 'lucide-react';
import { Link } from 'react-router-dom';

interface EmptyStateProps {
  title: string;
  description: string;
  icon?: 'file' | 'calendar' | 'clock' | 'alert' | 'user';
  actionLabel?: string;
  actionLink?: string;
  actionOnClick?: () => void;
  className?: string;
}

const EmptyState: React.FC<EmptyStateProps> = ({
  title,
  description,
  icon = 'alert',
  actionLabel,
  actionLink,
  actionOnClick,
  className = ''
}) => {
  const getIcon = () => {
    switch (icon) {
      case 'file': return <FileText className="h-12 w-12 text-gray-400 dark:text-gray-500" />;
      case 'calendar': return <Calendar className="h-12 w-12 text-gray-400 dark:text-gray-500" />;
      case 'clock': return <Clock className="h-12 w-12 text-gray-400 dark:text-gray-500" />;
      case 'user': return <User className="h-12 w-12 text-gray-400 dark:text-gray-500" />;
      case 'alert': 
      default: return <AlertCircle className="h-12 w-12 text-gray-400 dark:text-gray-500" />;
    }
  };

  const renderAction = () => {
    if (actionLink) {
      return (
        <Link
          to={actionLink}
          className="mt-4 inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
        >
          {actionLabel || 'View Details'}
          <ArrowUpRight className="ml-2 h-4 w-4" />
        </Link>
      );
    } else if (actionOnClick) {
      return (
        <button
          onClick={actionOnClick}
          className="mt-4 inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
        >
          {actionLabel || 'View Details'}
        </button>
      );
    }
    return null;
  };

  return (
    <div className={`p-8 text-center ${className}`}>
      <div className="flex justify-center mb-4">
        {getIcon()}
      </div>
      <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">{title}</h3>
      <p className="text-gray-500 dark:text-gray-400 mb-4 max-w-md mx-auto">
        {description}
      </p>
      {renderAction()}
    </div>
  );
};

export default EmptyState;