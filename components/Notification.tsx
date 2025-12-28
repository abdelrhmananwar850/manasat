import React, { useEffect } from 'react';

interface NotificationProps {
  message: string;
  type: 'success' | 'info' | 'warning';
  onClose: () => void;
  duration?: number;
}

const Notification: React.FC<NotificationProps> = ({ message, type, onClose, duration = 2000 }) => {
  useEffect(() => {
    const timer = setTimeout(onClose, duration);
    return () => clearTimeout(timer);
  }, [onClose, duration]);

  const bgColor = {
    success: 'bg-green-500',
    info: 'bg-blue-500',
    warning: 'bg-yellow-500'
  }[type];

  const icon = {
    success: '✓',
    info: 'ℹ',
    warning: '⚠'
  }[type];

  return (
    <div className={`fixed bottom-4 right-4 z-50 ${bgColor} text-white px-4 py-2 rounded-lg shadow-lg flex items-center gap-2 text-sm animate-in slide-in-from-bottom duration-300 max-w-xs`}>
      <span>{icon}</span>
      <span className="font-medium truncate">{message}</span>
      <button onClick={onClose} className="hover:opacity-70 text-xs">✕</button>
    </div>
  );
};

export default Notification;
