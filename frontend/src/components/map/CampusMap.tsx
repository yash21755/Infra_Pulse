import { useEffect, useState, useMemo } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import axios from 'axios';
import { Link } from 'react-router-dom';

// Fix for default marker icons in Leaflet with Vite
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

/** Colored circle markers per status */
function makeCircleIcon(status: string) {
  const color =
    status === 'resolved'    ? '#10b981' :
    status === 'in_progress' ? '#f59e0b' : '#6366f1';
  return L.divIcon({
    className: '',
    html: `<div style="width:14px;height:14px;border-radius:50%;background:${color};border:2px solid white;box-shadow:0 1px 4px rgba(0,0,0,.4)"></div>`,
    iconSize: [14, 14],
    iconAnchor: [7, 7],
  });
}

/** Auto-fit map bounds to visible markers */
function FitBounds({ positions }: { positions: [number, number][] }) {
  const map = useMap();
  useEffect(() => {
    if (positions.length > 0) {
      map.fitBounds(L.latLngBounds(positions), { padding: [48, 48], maxZoom: 18 });
    }
  }, [positions.length]);
  return null;
}

interface CampusMapProps {
  statusFilter?: string;
  priorityFilters?: string[];
}

export const CampusMap = ({ statusFilter = 'All', priorityFilters = ['Critical', 'High', 'Medium', 'Low'] }: CampusMapProps) => {
  const defaultCenter: [number, number] = [28.5456, 77.2732];
  const [issues, setIssues] = useState<any[]>([]);

  useEffect(() => {
    axios.get('/api/issues')
      .then(res => setIssues(Array.isArray(res.data) ? res.data : []))
      .catch(() => setIssues([]));
  }, []);

  const filtered = useMemo(() => {
    return issues.filter(issue => {
      if (!issue.location?.lat || !issue.location?.lng) return false;
      if (statusFilter !== 'All') {
        const statusMap: Record<string, string> = {
          'Open': 'open', 'In Progress': 'in_progress', 'Resolved': 'resolved',
        };
        if (issue.status !== statusMap[statusFilter]) return false;
      }
      if (priorityFilters.length && !priorityFilters.map(p => p.toLowerCase()).includes(issue.priority?.toLowerCase())) {
        return false;
      }
      return true;
    });
  }, [issues, statusFilter, priorityFilters]);

  const positions = filtered.map(i => [i.location.lat, i.location.lng] as [number, number]);

  const counts = useMemo(() => ({
    open:        issues.filter(i => i.status === 'open').length,
    in_progress: issues.filter(i => i.status === 'in_progress').length,
    resolved:    issues.filter(i => i.status === 'resolved').length,
  }), [issues]);

  return (
    <div className="w-full h-full relative z-0">
      <MapContainer center={defaultCenter} zoom={17} style={{ height: '100%', width: '100%' }}>
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        />
        {positions.length > 1 && <FitBounds positions={positions} />}
        {filtered.map(issue => (
          <Marker
            key={issue._id}
            position={[issue.location.lat, issue.location.lng]}
            icon={makeCircleIcon(issue.status)}
          >
            <Popup className="rounded-xl overflow-hidden dark:!bg-slate-900" minWidth={220}>
              <div className="font-body dark:text-slate-300">
                <div className="text-xs font-bold uppercase text-brand-600 dark:text-brand-400 mb-1">{issue.category ?? 'Issue'}</div>
                <h3 className="font-bold text-slate-900 dark:text-white text-sm mb-1 leading-tight">{issue.title}</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2 mb-2">{issue.description}</p>
                <div className="text-xs text-slate-500 dark:text-slate-400 mb-1">📍 {issue.location.label || 'Unknown location'}</div>
                <div className="flex justify-between items-center mt-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                  <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                    issue.status === 'resolved' ? 'bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-400' :
                    issue.status === 'in_progress' ? 'bg-amber-100 dark:bg-amber-500/20 text-amber-700 dark:text-amber-400' :
                    'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
                  }`}>
                    {issue.status?.replace('_', ' ')}
                  </span>
                  <Link to={`/issues/${issue._id}`} className="text-xs font-bold text-brand-600 dark:text-brand-400 hover:text-brand-700 dark:hover:text-brand-300">
                    View →
                  </Link>
                </div>
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>

      {/* Live legend bottom-right */}
      <div className="absolute bottom-6 right-6 z-[400] bg-white dark:bg-slate-900 rounded-xl shadow-md border border-slate-200 dark:border-slate-800 p-3 hidden sm:block pointer-events-none">
        <div className="flex flex-col gap-1.5 text-xs font-medium text-slate-600 dark:text-slate-300">
          <span className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-full bg-indigo-500" /> Open ({counts.open})</span>
          <span className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-full bg-amber-400" /> In Progress ({counts.in_progress})</span>
          <span className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-full bg-emerald-500" /> Resolved ({counts.resolved})</span>
        </div>
      </div>
    </div>
  );
};