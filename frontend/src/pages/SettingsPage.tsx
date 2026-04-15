import React from 'react';
import { User, Bell, Shield, Trash2 } from 'lucide-react';
import { Button } from '../components/ui/Button';

export const SettingsPage = () => {
  return (
    <div className="max-w-3xl mx-auto py-8 px-4 sm:px-6 space-y-8">
      <h1 className="text-3xl font-display font-bold text-slate-900">Settings</h1>

      <section className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center gap-2 font-bold text-slate-700">
          <Bell size={18} /> Notification Preferences
        </div>
        <div className="p-6 space-y-6">
          {[
            { label: "Notify when my issue is resolved", default: true },
            { label: "Notify when my issue gets 10+ upvotes", default: true },
            { label: "Notify on status changes", default: true },
            { label: "Weekly digest email", default: false },
          ].map((item, i) => (
            <div key={i} className="flex items-center justify-between">
              <span className="text-sm font-medium text-slate-700">{item.label}</span>
              <label className="relative inline-flex items-center cursor-pointer">
                <input type="checkbox" className="sr-only peer" defaultChecked={item.default} />
                <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-brand-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-brand-600"></div>
              </label>
            </div>
          ))}
        </div>
      </section>

      <section className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center gap-2 font-bold text-slate-700">
          <Shield size={18} /> Privacy & Account
        </div>
        <div className="p-6">
          <p className="text-sm text-slate-600 mb-6">
            Infra_Pulse operates on strict anonymity. Your personal email is solely used for authentication and preventing spam. It is never displayed publicly or shared with campus authorities.
          </p>
          <div className="border-t border-slate-100 pt-6 mt-6">
            <h4 className="text-rose-600 font-bold flex items-center gap-2 mb-2"><Trash2 size={18} /> Danger Zone</h4>
            <p className="text-xs text-slate-500 mb-4">Permanently delete your account and remove all your upvotes. Your reported issues will remain to preserve platform integrity but will be detached from your identity.</p>
            <Button variant="danger" size="sm">Delete My Account</Button>
          </div>
        </div>
      </section>
    </div>
  );
};