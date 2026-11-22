import { useState, useEffect, useMemo, type ComponentType } from 'react';
import axios from 'axios';
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  RotateCw,
  Wrench,
  GraduationCap,
  Sparkles,
  CheckSquare,
  Clock,
  MapPin,
  Mail,
  AlertTriangle,
  Info,
  CalendarCheck,
} from 'lucide-react';
import { Button } from '../components/ui/Button';

export interface CalendarEventItem {
  id: string;
  title: string;
  category: 'exam' | 'event' | 'task' | 'maintenance';
  startDate: string; // YYYY-MM-DD
  endDate: string;   // YYYY-MM-DD
  timeWindow?: string;
  location?: string;
  description?: string;
  sourceSubject?: string;
}

interface CalendarResponse {
  success: boolean;
  events: CalendarEventItem[];
  lastSynced?: string;
  syncStatus?: string;
  emailSource?: string;
  message?: string;
}

const CATEGORY_CONFIG: Record<
  CalendarEventItem['category'],
  {
    label: string;
    icon: ComponentType<{ size?: number; className?: string }>;
    neonBadge: string;
    neonPill: string;
    neonBorder: string;
    neonDot: string;
    siteBadge: string;
  }
> = {
  exam: {
    label: 'Exams & Quizzes',
    icon: GraduationCap,
    neonBadge: 'bg-purple-500/20 border border-purple-400/60 text-purple-200',
    neonPill: 'bg-purple-900/60 text-purple-200 border-purple-400/60 hover:bg-purple-800/80',
    neonBorder: 'border-purple-400',
    neonDot: 'bg-purple-400 shadow-[0_0_8px_rgba(192,132,252,0.8)]',
    siteBadge: 'bg-purple-50 dark:bg-purple-500/10 text-purple-700 dark:text-purple-300 border-purple-200 dark:border-purple-800/60',
  },
  event: {
    label: 'Campus Events',
    icon: Sparkles,
    neonBadge: 'bg-cyan-500/20 border border-cyan-400/60 text-cyan-200',
    neonPill: 'bg-cyan-900/60 text-cyan-200 border-cyan-400/60 hover:bg-cyan-800/80',
    neonBorder: 'border-cyan-400',
    neonDot: 'bg-cyan-400 shadow-[0_0_8px_rgba(34,211,238,0.8)]',
    siteBadge: 'bg-cyan-50 dark:bg-cyan-500/10 text-cyan-700 dark:text-cyan-300 border-cyan-200 dark:border-cyan-800/60',
  },
  task: {
    label: 'Academic Tasks',
    icon: CheckSquare,
    neonBadge: 'bg-emerald-500/20 border border-emerald-400/60 text-emerald-200',
    neonPill: 'bg-emerald-900/60 text-emerald-200 border-emerald-400/60 hover:bg-emerald-800/80',
    neonBorder: 'border-emerald-400',
    neonDot: 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]',
    siteBadge: 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800/60',
  },
  maintenance: {
    label: 'Maintenance',
    icon: Wrench,
    neonBadge: 'bg-amber-500/20 border border-amber-400/60 text-amber-200',
    neonPill: 'bg-amber-900/60 text-amber-200 border-amber-400/60 hover:bg-amber-800/80',
    neonBorder: 'border-amber-400',
    neonDot: 'bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.8)]',
    siteBadge: 'bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800/60',
  },
};

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function getTodayYMD(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function formatDisplayDate(dateStr: string): string {
  try {
    const [y, m, d] = dateStr.split('-').map(Number);
    const date = new Date(y, m - 1, d);
    return date.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  } catch {
    return dateStr;
  }
}

function timeSince(dateIso?: string): string {
  if (!dateIso) return 'Never';
  try {
    const seconds = Math.floor((new Date().getTime() - new Date(dateIso).getTime()) / 1000);
    if (seconds < 60) return 'Just now';
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  } catch {
    return 'Recently';
  }
}

export const CalendarPage = () => {
  const [events, setEvents] = useState<CalendarEventItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [lastSynced, setLastSynced] = useState<string | undefined>();
  const [syncNotice, setSyncNotice] = useState<string>('');
  const [activeCategory, setActiveCategory] = useState<'all' | CalendarEventItem['category']>('all');

  const todayStr = useMemo(() => getTodayYMD(), []);

  // Calendar month state
  const [viewDate, setViewDate] = useState(() => {
    const d = new Date();
    d.setDate(1);
    return d;
  });

  // Selected date for detail drill-down (defaults to today)
  const [selectedDate, setSelectedDate] = useState<string>(todayStr);

  const fetchCalendar = async () => {
    setLoading(true);
    try {
      const res = await axios.get<CalendarResponse>('/api/calendar/events');
      if (res.data?.events) {
        // Strict present & future filter: endDate >= today
        const filtered = res.data.events.filter(
          item => (item.endDate || item.startDate) >= todayStr
        );
        setEvents(filtered);
        setLastSynced(res.data.lastSynced);
      }
    } catch (err) {
      console.error('Failed to load calendar events:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCalendar();
  }, [todayStr]);

  const handleSyncEmails = async () => {
    setSyncing(true);
    setSyncNotice('');
    try {
      const res = await axios.post<CalendarResponse>('/api/calendar/sync');
      if (res.data?.events) {
        const filtered = res.data.events.filter(
          item => (item.endDate || item.startDate) >= todayStr
        );
        setEvents(filtered);
        setLastSynced(res.data.lastSynced);
        setSyncNotice(res.data.message || 'Email sync completed.');
      }
    } catch (err: any) {
      setSyncNotice(err?.response?.data?.message || 'Sync failed. Please check backend credentials.');
    } finally {
      setSyncing(false);
    }
  };

  // Month navigation
  const prevMonth = () => {
    setViewDate(prev => {
      const d = new Date(prev);
      d.setMonth(d.getMonth() - 1);
      return d;
    });
  };

  const nextMonth = () => {
    setViewDate(prev => {
      const d = new Date(prev);
      d.setMonth(d.getMonth() + 1);
      return d;
    });
  };

  const jumpToToday = () => {
    const now = new Date();
    now.setDate(1);
    setViewDate(now);
    setSelectedDate(todayStr);
  };

  const currentYear = viewDate.getFullYear();
  const currentMonthIdx = viewDate.getMonth();
  const monthName = viewDate.toLocaleString('en-US', { month: 'long', year: 'numeric' });

  // Compute calendar grid days
  const calendarCells = useMemo(() => {
    const firstDayOfWeek = new Date(currentYear, currentMonthIdx, 1).getDay();
    const daysInCurrentMonth = new Date(currentYear, currentMonthIdx + 1, 0).getDate();
    const daysInPrevMonth = new Date(currentYear, currentMonthIdx, 0).getDate();

    const cells: Array<{
      dateStr: string;
      dayNumber: number;
      isCurrentMonth: boolean;
      isToday: boolean;
    }> = [];

    // Prev month padding
    for (let i = firstDayOfWeek - 1; i >= 0; i--) {
      const dayNum = daysInPrevMonth - i;
      const prevM = currentMonthIdx === 0 ? 12 : currentMonthIdx;
      const prevY = currentMonthIdx === 0 ? currentYear - 1 : currentYear;
      const mStr = String(prevM).padStart(2, '0');
      const dStr = String(dayNum).padStart(2, '0');
      const dateStr = `${prevY}-${mStr}-${dStr}`;
      cells.push({
        dateStr,
        dayNumber: dayNum,
        isCurrentMonth: false,
        isToday: dateStr === todayStr,
      });
    }

    // Current month days
    for (let d = 1; d <= daysInCurrentMonth; d++) {
      const mStr = String(currentMonthIdx + 1).padStart(2, '0');
      const dStr = String(d).padStart(2, '0');
      const dateStr = `${currentYear}-${mStr}-${dStr}`;
      cells.push({
        dateStr,
        dayNumber: d,
        isCurrentMonth: true,
        isToday: dateStr === todayStr,
      });
    }

    // Next month padding to complete 35 or 42 cells grid
    const remaining = (7 - (cells.length % 7)) % 7;
    for (let d = 1; d <= remaining; d++) {
      const nextM = currentMonthIdx === 11 ? 1 : currentMonthIdx + 2;
      const nextY = currentMonthIdx === 11 ? currentYear + 1 : currentYear;
      const mStr = String(nextM).padStart(2, '0');
      const dStr = String(d).padStart(2, '0');
      const dateStr = `${nextY}-${mStr}-${dStr}`;
      cells.push({
        dateStr,
        dayNumber: d,
        isCurrentMonth: false,
        isToday: dateStr === todayStr,
      });
    }

    return cells;
  }, [currentYear, currentMonthIdx, todayStr]);

  // Filter events based on active category
  const filteredEvents = useMemo(() => {
    if (activeCategory === 'all') return events;
    return events.filter(e => e.category === activeCategory);
  }, [events, activeCategory]);

  // Helper to test if an event is active on a given dateStr
  const getEventsForDate = (dateStr: string) => {
    return filteredEvents.filter(e => {
      const start = e.startDate;
      const end = e.endDate || e.startDate;
      return dateStr >= start && dateStr <= end;
    });
  };

  // Selected date events
  const selectedDateEvents = useMemo(() => {
    return events.filter(e => {
      const start = e.startDate;
      const end = e.endDate || e.startDate;
      return selectedDate >= start && selectedDate <= end;
    });
  }, [events, selectedDate]);

  // Scheduled maintenance notices (strictly category === 'maintenance', sorted soonest first)
  const maintenanceNotices = useMemo(() => {
    return events
      .filter(e => e.category === 'maintenance')
      .sort((a, b) => a.startDate.localeCompare(b.startDate));
  }, [events]);

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-8">
      {/* ── Top Header ────────────────────────────────────────────── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-200 dark:border-slate-800">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-brand-500/10 text-brand-600 dark:text-brand-400 border border-brand-500/20">
              <CalendarIcon size={24} />
            </div>
            <div>
              <h1 className="text-2xl font-display font-bold text-slate-900 dark:text-white tracking-tight">
                Campus Calendar &amp; Notices
              </h1>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
                Auto-synced from your email for upcoming events and scheduled maintenance.
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {lastSynced && (
            <div className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
              <Clock size={13} />
              <span>Synced {timeSince(lastSynced)}</span>
            </div>
          )}

          <Button
            type="button"
            variant="primary"
            onClick={handleSyncEmails}
            disabled={syncing || loading}
            className="gap-2 text-sm shadow-sm"
          >
            <RotateCw size={15} className={syncing ? 'animate-spin' : ''} />
            {syncing ? 'Syncing...' : 'Sync Emails'}
          </Button>
        </div>
      </div>

      {syncNotice && (
        <div className="flex items-center gap-2.5 text-xs px-4 py-3 rounded-xl bg-brand-50 dark:bg-brand-500/10 text-brand-700 dark:text-brand-300 border border-brand-200 dark:border-brand-500/30">
          <Info size={16} className="shrink-0" />
          <span>{syncNotice}</span>
        </div>
      )}

      {/* ── Filter Tabs ───────────────────────────────────────────── */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 text-xs">
        <button
          type="button"
          onClick={() => setActiveCategory('all')}
          className={`px-3.5 py-1.5 rounded-lg font-medium transition-all ${
            activeCategory === 'all'
              ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-sm'
              : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
          }`}
        >
          All Items ({events.length})
        </button>

        {(['maintenance', 'exam', 'event', 'task'] as const).map(cat => {
          const cfg = CATEGORY_CONFIG[cat];
          const count = events.filter(e => e.category === cat).length;
          const Icon = cfg.icon;
          const isActive = activeCategory === cat;

          return (
            <button
              key={cat}
              type="button"
              onClick={() => setActiveCategory(cat)}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg font-medium transition-all ${
                isActive
                  ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-sm'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
              }`}
            >
              <Icon size={14} />
              <span>{cfg.label}</span>
              <span className="opacity-75 font-mono">({count})</span>
            </button>
          );
        })}
      </div>

      {/* ── Section 1: Dark-Themed Neon Calendar ──────────────────── */}
      <div className="bg-slate-950 border border-slate-800/80 rounded-2xl p-5 sm:p-7 shadow-2xl text-slate-100">
        {/* Calendar Top Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <h2 className="text-xl sm:text-2xl font-display font-bold text-white tracking-tight">
              {monthName}
            </h2>
            <div className="flex items-center gap-1 bg-slate-900 border border-slate-800 rounded-lg p-0.5">
              <button
                type="button"
                onClick={prevMonth}
                aria-label="Previous Month"
                className="p-1.5 hover:bg-slate-800 text-slate-300 hover:text-white rounded-md transition-colors"
              >
                <ChevronLeft size={18} />
              </button>
              <button
                type="button"
                onClick={jumpToToday}
                className="px-2.5 py-1 text-xs font-semibold text-slate-300 hover:text-white hover:bg-slate-800 rounded-md transition-colors"
              >
                Today
              </button>
              <button
                type="button"
                onClick={nextMonth}
                aria-label="Next Month"
                className="p-1.5 hover:bg-slate-800 text-slate-300 hover:text-white rounded-md transition-colors"
              >
                <ChevronRight size={18} />
              </button>
            </div>
          </div>

          {/* Compact Neon Color Legend */}
          <div className="flex flex-wrap items-center gap-2 sm:gap-3 text-xs">
            {(['exam', 'event', 'task', 'maintenance'] as const).map(cat => {
              const cfg = CATEGORY_CONFIG[cat];
              return (
                <div
                  key={cat}
                  className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-900 border border-slate-800 text-slate-300"
                >
                  <span className={`w-2 h-2 rounded-full ${cfg.neonDot}`} />
                  <span className="capitalize">{cat}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Days of Week Headers */}
        <div className="grid grid-cols-7 gap-1 sm:gap-2 pt-4 pb-2 text-center">
          {WEEKDAYS.map(w => (
            <div key={w} className="text-[11px] sm:text-xs font-semibold uppercase tracking-wider text-slate-400">
              {w}
            </div>
          ))}
        </div>

        {/* Calendar Month Grid */}
        <div className="grid grid-cols-7 gap-1 sm:gap-2">
          {calendarCells.map(cell => {
            const cellEvents = getEventsForDate(cell.dateStr);
            const isSelected = cell.dateStr === selectedDate;
            const hasEvents = cellEvents.length > 0;

            return (
              <div
                key={cell.dateStr}
                onClick={() => setSelectedDate(cell.dateStr)}
                className={`min-h-[78px] sm:min-h-[96px] p-1.5 sm:p-2 rounded-xl border transition-all cursor-pointer flex flex-col justify-between ${
                  !cell.isCurrentMonth
                    ? 'opacity-30 bg-slate-900/30 border-slate-900/50'
                    : isSelected
                    ? 'bg-slate-900/90 border-brand-500 shadow-[0_0_12px_rgba(139,92,246,0.3)] ring-1 ring-brand-500'
                    : cell.isToday
                    ? 'bg-slate-900/60 border-slate-700 ring-1 ring-slate-600'
                    : 'bg-slate-900/40 border-slate-800/80 hover:border-slate-700 hover:bg-slate-900/70'
                }`}
              >
                {/* Cell Header: Day Number */}
                <div className="flex items-center justify-between">
                  <span
                    className={`text-xs font-mono font-medium rounded-full w-5 h-5 flex items-center justify-center ${
                      cell.isToday
                        ? 'bg-brand-500 text-white font-bold'
                        : isSelected
                        ? 'text-brand-300 font-bold'
                        : cell.isCurrentMonth
                        ? 'text-slate-300'
                        : 'text-slate-500'
                    }`}
                  >
                    {cell.dayNumber}
                  </span>

                  {hasEvents && (
                    <div className="flex items-center gap-1">
                      {cellEvents.slice(0, 3).map((ev, i) => (
                        <span
                          key={i}
                          className={`w-1.5 h-1.5 rounded-full ${CATEGORY_CONFIG[ev.category].neonDot}`}
                        />
                      ))}
                    </div>
                  )}
                </div>

                {/* Event Pills & Multi-day Spans */}
                <div className="space-y-1 mt-1 overflow-hidden">
                  {cellEvents.slice(0, 2).map(ev => {
                    const cfg = CATEGORY_CONFIG[ev.category];
                    const isStart = ev.startDate === cell.dateStr;
                    const isEnd = (ev.endDate || ev.startDate) === cell.dateStr;
                    const isMulti = ev.startDate !== (ev.endDate || ev.startDate);

                    // Multi-day pill shape connection
                    let roundedStyle = 'rounded-md';
                    if (isMulti) {
                      if (isStart && !isEnd) {
                        roundedStyle = 'rounded-l-md rounded-r-none border-r-0 mr-[-4px] sm:mr-[-8px]';
                      } else if (!isStart && !isEnd) {
                        roundedStyle = 'rounded-none border-x-0 mx-[-4px] sm:mx-[-8px]';
                      } else if (!isStart && isEnd) {
                        roundedStyle = 'rounded-r-md rounded-l-none border-l-0 ml-[-4px] sm:ml-[-8px]';
                      }
                    }

                    return (
                      <div
                        key={ev.id}
                        title={`${ev.title} (${ev.timeWindow || ''})`}
                        className={`text-[10px] sm:text-[11px] leading-tight px-1.5 py-0.5 font-medium border truncate transition-all ${roundedStyle} ${cfg.neonPill}`}
                      >
                        {ev.title}
                      </div>
                    );
                  })}

                  {cellEvents.length > 2 && (
                    <div className="text-[9px] sm:text-[10px] text-slate-400 font-mono pl-1">
                      +{cellEvents.length - 2} more
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Selected Date Detail Drawer */}
        <div className="mt-6 pt-5 border-t border-slate-800">
          <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <CalendarCheck size={18} className="text-brand-400" />
              <h3 className="text-sm sm:text-base font-semibold text-white">
                Scheduled for {formatDisplayDate(selectedDate)}
              </h3>
            </div>
            <span className="text-xs text-slate-400">
              {selectedDateEvents.length} {selectedDateEvents.length === 1 ? 'item' : 'items'}
            </span>
          </div>

          {selectedDateEvents.length === 0 ? (
            <div className="p-4 rounded-xl bg-slate-900/50 border border-slate-800/80 text-center text-xs text-slate-400">
              No campus events or maintenance notices scheduled for this day.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {selectedDateEvents.map(ev => {
                const cfg = CATEGORY_CONFIG[ev.category];
                const Icon = cfg.icon;

                return (
                  <div
                    key={ev.id}
                    className="p-3.5 rounded-xl bg-slate-900 border border-slate-800 hover:border-slate-700 transition-all flex flex-col justify-between gap-2"
                  >
                    <div>
                      <div className="flex items-center justify-between gap-2 mb-1.5">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${cfg.neonBadge}`}>
                          <Icon size={11} />
                          {ev.category}
                        </span>

                        {ev.timeWindow && (
                          <span className="text-[11px] font-mono text-slate-400 flex items-center gap-1">
                            <Clock size={11} />
                            {ev.timeWindow}
                          </span>
                        )}
                      </div>

                      <h4 className="text-sm font-semibold text-white leading-snug">
                        {ev.title}
                      </h4>

                      {ev.description && (
                        <p className="text-xs text-slate-300 mt-1 leading-relaxed">
                          {ev.description}
                        </p>
                      )}
                    </div>

                    <div className="pt-2 border-t border-slate-800/80 flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-400">
                      {ev.location && (
                        <span className="flex items-center gap-1">
                          <MapPin size={11} className="text-slate-500" />
                          <span>{ev.location}</span>
                        </span>
                      )}

                      {ev.sourceSubject && (
                        <span className="flex items-center gap-1 text-slate-500 truncate max-w-[200px]" title={ev.sourceSubject}>
                          <Mail size={11} />
                          <span className="truncate">{ev.sourceSubject}</span>
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* ── Section 2: Scheduled Maintenance & Construction Log ────── */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 sm:p-7 shadow-sm space-y-6">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
              <Wrench size={22} />
            </div>
            <div>
              <h2 className="text-xl font-display font-bold text-slate-900 dark:text-white tracking-tight">
                Scheduled Maintenance &amp; Construction
              </h2>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
                Official maintenance notices from email. Check here before reporting a new issue.
              </p>
            </div>
          </div>
        </div>

        {maintenanceNotices.length === 0 ? (
          <div className="p-8 rounded-xl bg-slate-50 dark:bg-slate-950/50 border border-slate-200 dark:border-slate-800 text-center">
            <div className="w-12 h-12 rounded-full bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 mx-auto flex items-center justify-center mb-3">
              <CalendarCheck size={24} />
            </div>
            <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
              No upcoming scheduled maintenance notices found.
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              All infrastructure facilities are currently operating on normal schedule.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {maintenanceNotices.map(maint => (
              <div
                key={maint.id}
                className="bg-white dark:bg-slate-950 rounded-xl border border-slate-200 dark:border-slate-800 p-4 sm:p-5 shadow-sm hover:border-amber-400/50 dark:hover:border-amber-500/40 transition-all flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between gap-2 mb-2 flex-wrap">
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-500/30">
                      <AlertTriangle size={12} />
                      Scheduled Maintenance
                    </span>

                    <span className="text-xs font-mono font-medium text-slate-500 dark:text-slate-400">
                      {formatDisplayDate(maint.startDate)}
                    </span>
                  </div>

                  <h3 className="text-base font-semibold text-slate-900 dark:text-white leading-snug">
                    {maint.title}
                  </h3>

                  {maint.description && (
                    <p className="text-sm text-slate-600 dark:text-slate-300 mt-2 leading-relaxed">
                      {maint.description}
                    </p>
                  )}
                </div>

                <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800/80 space-y-1.5 text-xs text-slate-500 dark:text-slate-400">
                  {maint.timeWindow && (
                    <div className="flex items-center gap-2">
                      <Clock size={13} className="text-amber-500 shrink-0" />
                      <span className="font-medium text-slate-700 dark:text-slate-300">
                        {maint.timeWindow}
                      </span>
                    </div>
                  )}

                  {maint.location && (
                    <div className="flex items-center gap-2">
                      <MapPin size={13} className="text-slate-400 shrink-0" />
                      <span>{maint.location}</span>
                    </div>
                  )}

                  {maint.sourceSubject && (
                    <div className="flex items-center gap-2 text-[11px] text-slate-400 truncate pt-1">
                      <Mail size={12} className="shrink-0 text-slate-400" />
                      <span className="truncate" title={maint.sourceSubject}>
                        Source: {maint.sourceSubject}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
