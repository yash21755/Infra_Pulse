import { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import axios from 'axios';
import { Link } from 'react-router-dom';

// Fix for default marker icons in Leaflet with Webpack/Vite
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

export const CampusMap = () => {
  const defaultCenter: [number, number] = [28.5456, 77.2732];
  const [issues, setIssues] = useState<any[]>([]);

  useEffect(() => {
    axios.get('/api/issues')
      .then(res => {
        setIssues(Array.isArray(res.data) ? res.data : []);
      })
      .catch(() => setIssues([]));
  }, []);

  return (
    <div className="w-full h-full relative z-0">
      <MapContainer center={defaultCenter} zoom={17} style={{ height: '100%', width: '100%' }}>
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        />
        {Array.isArray(issues) && issues.map(issue => (
          <Marker key={issue._id} position={[issue.location.lat, issue.location.lng]}>
            <Popup className="rounded-xl overflow-hidden">
              <div className="font-body min-w-[200px]">
                <div className="text-xs font-bold uppercase text-brand-600 mb-1">{issue.category}</div>
                <h3 className="font-display font-bold text-slate-900 text-sm mb-2 leading-tight">{issue.title}</h3>
                <div className="flex justify-between items-center mt-3 pt-2 border-t border-slate-100">
                  <span className="text-xs font-medium text-slate-500">Votes: {issue.upvotes}</span>
                  <Link to={`/issues/${issue._id}`} className="text-xs font-bold text-brand-600 hover:text-brand-700">View →</Link>
                </div>
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  );
};