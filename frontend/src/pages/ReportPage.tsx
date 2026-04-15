import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Camera, MapPin, CheckCircle, ArrowRight, ArrowLeft } from 'lucide-react';
import { Button } from '../components/ui/Button';

export const ReportPage = () => {
  const [step, setStep] = useState(1);
  const navigate = useNavigate();

  const handleNext = () => setStep(s => Math.min(s + 1, 4));
  const handlePrev = () => setStep(s => Math.max(s - 1, 1));
  
  const submitReport = () => {
    // Simulate API call
    setTimeout(() => {
      navigate('/feed');
    }, 1000);
  };

  return (
    <div className="max-w-2xl mx-auto py-8 px-4 sm:px-6">
      <h1 className="text-3xl font-display font-bold text-slate-900 mb-6">Report an Issue</h1>
      
      {/* Stepper */}
      <div className="flex items-center justify-between mb-8 relative">
        <div className="absolute left-0 top-1/2 -translate-y-1/2 w-full h-1 bg-slate-200 -z-10 rounded-full"></div>
        <div className={`absolute left-0 top-1/2 -translate-y-1/2 h-1 bg-brand-600 -z-10 rounded-full transition-all duration-300`} style={{ width: `${((step - 1) / 3) * 100}%` }}></div>
        
        {[1, 2, 3, 4].map(num => (
          <div key={num} className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm transition-colors ${step >= num ? 'bg-brand-600 text-white' : 'bg-slate-200 text-slate-500'}`}>
            {step > num ? <CheckCircle size={16} /> : num}
          </div>
        ))}
      </div>

      <div className="bg-white p-6 sm:p-8 rounded-2xl shadow-sm border border-slate-200">
        {step === 1 && (
          <div className="animate-fade-in">
            <h2 className="text-xl font-bold mb-4">Issue Details</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Title</label>
                <input type="text" placeholder="e.g. Broken water cooler in Block B" className="w-full p-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-brand-500 outline-none" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Category</label>
                <select className="w-full p-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-brand-500 outline-none bg-white">
                  <option>Electrical</option><option>Sanitation</option><option>Plumbing</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Description</label>
                <textarea rows={4} placeholder="Provide specific details..." className="w-full p-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-brand-500 outline-none"></textarea>
              </div>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="animate-fade-in">
            <h2 className="text-xl font-bold mb-4 flex items-center gap-2"><MapPin className="text-brand-500"/> Location</h2>
            <div className="h-64 bg-slate-100 rounded-lg mb-4 flex items-center justify-center border-2 border-dashed border-slate-300">
              {/* Leaflet map goes here. Using placeholder for brevity */}
              <p className="text-slate-500 font-medium">Interactive Map Placeholder</p>
            </div>
            <input type="text" placeholder="Location Label (e.g. Main Library, 2nd Floor)" className="w-full p-3 border border-slate-300 rounded-lg outline-none" />
          </div>
        )}

        {step === 3 && (
          <div className="animate-fade-in">
            <h2 className="text-xl font-bold mb-4 flex items-center gap-2"><Camera className="text-brand-500"/> Add Photos</h2>
            <div className="border-2 border-dashed border-brand-300 bg-brand-50 rounded-xl p-8 text-center cursor-pointer hover:bg-brand-100 transition-colors">
              <Camera size={48} className="mx-auto text-brand-400 mb-3" />
              <p className="text-brand-700 font-medium">Click to upload or drag and drop</p>
              <p className="text-sm text-brand-500 mt-1">PNG, JPG up to 5MB</p>
            </div>
          </div>
        )}

        {step === 4 && (
          <div className="animate-fade-in">
            <h2 className="text-xl font-bold mb-4">Review & Submit</h2>
            <div className="bg-slate-50 p-4 rounded-xl space-y-3 text-sm">
              <p><span className="font-semibold text-slate-700">Reporting as:</span> AnonymousOwl#492</p>
              <p><span className="font-semibold text-slate-700">Category:</span> Electrical</p>
              <p><span className="font-semibold text-slate-700">Location:</span> Library, 2nd Floor</p>
            </div>
          </div>
        )}

        <div className="flex justify-between mt-8 pt-4 border-t border-slate-100">
          <Button variant="ghost" onClick={handlePrev} disabled={step === 1} className="gap-2">
            <ArrowLeft size={16} /> Back
          </Button>
          {step < 4 ? (
            <Button variant="primary" onClick={handleNext} className="gap-2">
              Next <ArrowRight size={16} />
            </Button>
          ) : (
            <Button variant="primary" onClick={submitReport} className="gap-2 bg-emerald-600 hover:bg-emerald-700">
              <CheckCircle size={16} /> Submit Report
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};