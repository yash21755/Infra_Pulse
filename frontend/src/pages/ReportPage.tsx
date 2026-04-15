import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Camera, MapPin, CheckCircle, ArrowRight, ArrowLeft, X } from 'lucide-react';
import { Button } from '../components/ui/Button';
import { MapContainer, TileLayer, Marker, useMapEvents } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import axios from 'axios';
import L from 'leaflet';

delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

function LocationMarker({ position, setPosition }: { position: L.LatLngExpression, setPosition: (p: [number, number]) => void }) {
  useMapEvents({
    click(e) {
      setPosition([e.latlng.lat, e.latlng.lng]);
    },
  });
  return <Marker position={position} />;
}

export const ReportPage = () => {
  const [step, setStep] = useState(1);
  const [submitError, setSubmitError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const navigate = useNavigate();

  const [formData, setFormData] = useState({
    title: '',
    category: 'Electrical',
    description: '',
    locationLabel: ''
  });
  const [position, setPosition] = useState<[number, number]>([28.5456, 77.2732]);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);

  const handleNext = () => setStep(s => Math.min(s + 1, 4));
  const handlePrev = () => setStep(s => Math.max(s - 1, 1));

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] || null;
    setImageFile(file);
    if (file) {
      const url = URL.createObjectURL(file);
      setImagePreview(url);
    } else {
      setImagePreview(null);
    }
  };

  const removeImage = () => {
    setImageFile(null);
    if (imagePreview) URL.revokeObjectURL(imagePreview);
    setImagePreview(null);
  };

  const submitReport = async () => {
    setSubmitError('');
    setIsSubmitting(true);
    try {
      const token = localStorage.getItem('infra_pulse_token');
      if (!token) {
        setSubmitError('You must be logged in to submit a report.');
        return;
      }

      const data = new FormData();
      data.append('title', formData.title);
      data.append('category', formData.category);
      data.append('description', formData.description);
      data.append('location', JSON.stringify({ lat: position[0], lng: position[1], label: formData.locationLabel }));
      if (imageFile) {
        data.append('image', imageFile);
      }

      await axios.post('http://localhost:5000/api/issues', data, {
        headers: {
          'Content-Type': 'multipart/form-data',
          'Authorization': `Bearer ${token}`,
        },
        withCredentials: true,
      });
      navigate('/feed');
    } catch (err: any) {
      const msg = err?.response?.data?.message || 'Failed to submit report. Please try again.';
      setSubmitError(msg);
    } finally {
      setIsSubmitting(false);
    }
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
                <input type="text" value={formData.title} onChange={e => setFormData({...formData, title: e.target.value})} placeholder="e.g. Broken water cooler in Block B" className="w-full p-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-brand-500 outline-none" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Category</label>
                <select value={formData.category} onChange={e => setFormData({...formData, category: e.target.value})} className="w-full p-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-brand-500 outline-none bg-white">
                  <option>Electrical</option><option>Sanitation</option><option>Plumbing</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Description</label>
                <textarea rows={4} value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} placeholder="Provide specific details..." className="w-full p-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-brand-500 outline-none"></textarea>
              </div>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="animate-fade-in">
            <h2 className="text-xl font-bold mb-4 flex items-center gap-2"><MapPin className="text-brand-500"/>Location</h2>
            <div className="h-64 bg-slate-100 rounded-lg mb-4 overflow-hidden border border-slate-200">
              <MapContainer center={position} zoom={17} style={{ height: '100%', width: '100%' }}>
                <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                <LocationMarker position={position} setPosition={setPosition} />
              </MapContainer>
            </div>
            <p className="text-xs text-slate-500 mb-3">Click on the map to pin the exact location of the issue.</p>
            <input type="text" value={formData.locationLabel} onChange={e => setFormData({...formData, locationLabel: e.target.value})} placeholder="Location Label (e.g. Main Library, 2nd Floor)" className="w-full p-3 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-brand-500" />
          </div>
        )}

        {step === 3 && (
          <div className="animate-fade-in">
            <h2 className="text-xl font-bold mb-4 flex items-center gap-2"><Camera className="text-brand-500"/> Add Photos</h2>
            <input type="file" id="report-photo" className="hidden" accept="image/*" onChange={handleImageChange} />

            {imagePreview ? (
              <div className="relative rounded-xl overflow-hidden border border-slate-200 shadow-sm">
                <img
                  src={imagePreview}
                  alt="Upload preview"
                  className="w-full max-h-72 object-cover"
                />
                <button
                  onClick={removeImage}
                  className="absolute top-2 right-2 bg-black/60 hover:bg-black/80 text-white rounded-full p-1.5 transition-colors"
                  title="Remove image"
                >
                  <X size={16} />
                </button>
                <div className="px-4 py-2 bg-slate-50 border-t border-slate-200 text-sm text-slate-600 flex items-center justify-between">
                  <span className="truncate max-w-xs">{imageFile?.name}</span>
                  <label htmlFor="report-photo" className="text-brand-600 hover:text-brand-700 font-medium cursor-pointer ml-2 shrink-0">
                    Change
                  </label>
                </div>
              </div>
            ) : (
              <label htmlFor="report-photo" className="border-2 border-dashed border-brand-300 bg-brand-50 rounded-xl p-8 text-center cursor-pointer hover:bg-brand-100 transition-colors block">
                <Camera size={48} className="mx-auto text-brand-400 mb-3" />
                <p className="text-brand-700 font-medium">Click to upload or drag and drop</p>
                <p className="text-sm text-brand-500 mt-1">PNG, JPG up to 5MB</p>
              </label>
            )}
          </div>
        )}

        {step === 4 && (
          <div className="animate-fade-in">
            <h2 className="text-xl font-bold mb-4">Review & Submit</h2>
            <div className="bg-slate-50 p-4 rounded-xl space-y-3 text-sm">
              <p><span className="font-semibold text-slate-700">Title:</span> {formData.title || <span className="text-slate-400 italic">Not provided</span>}</p>
              <p><span className="font-semibold text-slate-700">Category:</span> {formData.category}</p>
              <p><span className="font-semibold text-slate-700">Description:</span> {formData.description || <span className="text-slate-400 italic">Not provided</span>}</p>
              <p><span className="font-semibold text-slate-700">Location:</span> {formData.locationLabel || `${position[0].toFixed(4)}, ${position[1].toFixed(4)}`}</p>
              {imagePreview && (
                <div>
                  <p className="font-semibold text-slate-700 mb-2">Attached Photo:</p>
                  <img src={imagePreview} alt="Preview" className="rounded-lg max-h-40 object-cover border border-slate-200" />
                </div>
              )}
            </div>
            {submitError && (
              <div className="mt-4 p-3 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg">
                {submitError}
              </div>
            )}
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
            <Button variant="primary" onClick={submitReport} disabled={isSubmitting} className="gap-2 bg-emerald-600 hover:bg-emerald-700">
              <CheckCircle size={16} /> {isSubmitting ? 'Submitting...' : 'Submit Report'}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};