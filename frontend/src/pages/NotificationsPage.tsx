import React from 'react';
import { CheckCircle2, MessageSquare, ChevronUp, Bell } from 'lucide-react';
import { Button } from '../components/ui/Button';

export const NotificationsPage = () => {
  const notifications = [
    { id: 1, type: 'resolved', message: "Your reported issue 'Broken ceiling fan' was marked as resolved.", time: "2 hours ago", unread: true, icon: CheckCircle2, color: 'text-emerald-500 bg-emerald-50' },
    { id: 2, type: 'upvote', message: "Your issue 'Waterlogging' just reached 100 upvotes!", time: "5 hours ago", unread: true, icon: ChevronUp, color: 'text-brand-500 bg-brand-50' },
    { id: 3, type: 'comment', message: "Authority AdminHawk commented on your issue.", time: "1 day ago", unread: false, icon: MessageSquare, color: 'text-blue-500 bg-blue-50' },
  ];

  return (
    <div className="max-w-3xl mx-auto py-8 px-4 sm:px-6">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-3xl font-display font-bold text-slate-900 flex items-center gap-3">
          <Bell className="text-brand-600" /> Notifications
        </h1>
        <Button variant="ghost" size="sm">Mark all as read</Button>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden divide-y divide-slate-100">
        {notifications.map(notif => (
          <div key={notif.id} className={`p-4 flex items-start gap-4 transition-colors hover:bg-slate-50 cursor-pointer ${notif.unread ? 'bg-brand-50/30' : ''}`}>
            <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${notif.color}`}>
              <notif.icon size={20} />
            </div>
            <div className="flex-1 min-w-0">
              <p className={`text-sm ${notif.unread ? 'font-semibold text-slate-900' : 'text-slate-700'}`}>{notif.message}</p>
              <p className="text-xs text-slate-400 mt-1">{notif.time}</p>
            </div>
            {notif.unread && <div className="w-2 h-2 rounded-full bg-brand-500 shrink-0 mt-2"></div>}
          </div>
        ))}
      </div>
    </div>
  );
};