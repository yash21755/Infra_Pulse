import React, { useState, useEffect } from 'react';
import { CheckCircle2, MessageSquare, ChevronUp, Bell } from 'lucide-react';
import { Button } from '../components/ui/Button';
import axios from 'axios';

interface NotificationProps {
  _id: string;
  type: string;
  message: string;
  read: boolean;
  createdAt: string;
}

export const NotificationsPage = () => {
  const [notifications, setNotifications] = useState<NotificationProps[]>([]);

  useEffect(() => {
    fetchNotifications();
  }, []);

  const fetchNotifications = async () => {
    try {
      const res = await axios.get('http://localhost:5000/api/notifications', { withCredentials: true });
      setNotifications(res.data);
    } catch (err) {
      console.error(err);
    }
  };

  const markAllAsRead = async () => {
    try {
      await axios.put('http://localhost:5000/api/notifications/all/read', {}, { withCredentials: true });
      setNotifications(prev => prev.map(n => ({...n, read: true})));
    } catch (err) {
      console.error(err);
    }
  };

  const markAsRead = async (id: string, read: boolean) => {
    if (read) return;
    try {
      await axios.put(`http://localhost:5000/api/notifications/${id}/read`, {}, { withCredentials: true });
      setNotifications(prev => prev.map(n => n._id === id ? {...n, read: true} : n));
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="max-w-3xl mx-auto py-8 px-4 sm:px-6">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-3xl font-display font-bold text-slate-900 dark:text-white flex items-center gap-3">
          <Bell className="text-brand-600" /> Notifications
        </h1>
        <Button variant="ghost" size="sm" onClick={markAllAsRead}>Mark all as read</Button>
      </div>

      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 overflow-hidden divide-y divide-slate-100 dark:divide-slate-800">
        {notifications.length === 0 ? (
           <div className="p-8 text-center text-slate-500 dark:text-slate-400">No notifications yet.</div>
        ) : (
          notifications.map(notif => (
            <div key={notif._id} onClick={() => markAsRead(notif._id, notif.read)} className={`p-4 flex items-start gap-4 transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/50 cursor-pointer ${!notif.read ? 'bg-brand-50/30 dark:bg-brand-500/10' : ''}`}>
              <div className="w-10 h-10 rounded-full flex items-center justify-center shrink-0 text-brand-500 bg-brand-50 dark:bg-brand-500/20">
                <Bell size={20} />
              </div>
              <div className="flex-1 min-w-0">
                <p className={`text-sm ${!notif.read ? 'font-semibold text-slate-900 dark:text-white' : 'text-slate-700 dark:text-slate-300'}`}>{notif.message}</p>
                <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">{new Date(notif.createdAt).toLocaleString()}</p>
              </div>
              {!notif.read && <div className="w-2 h-2 rounded-full bg-brand-500 shrink-0 mt-2"></div>}
            </div>
          ))
        )}
      </div>
    </div>
  );
};