'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  addMonths,
  subMonths,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  format,
  isSameMonth,
  isToday,
  parseISO
} from 'date-fns';
import { CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react';
import { Spinner } from '@/components/ui/Spinner';

type CalendarEvent = {
  id: string;
  recordId: string;
  module: string;
  date: string;
  time?: string;
  endTime?: string;
  title: string;
  subtitle?: string;
  status: string;
  kind: string;
  kindLabel: string;
  color: string;
  dot: string;
  href: string;
};

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export function CalendarView() {
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [month, setMonth] = useState(() => startOfMonth(new Date()));
  const [selectedDate, setSelectedDate] = useState(() => format(new Date(), 'yyyy-MM-dd'));

  useEffect(() => {
    fetch('/api/calendar/events')
      .then((r) => r.json())
      .then((json) => setEvents(json.events || []))
      .finally(() => setLoading(false));
  }, []);

  const eventsByDate = useMemo(() => {
    const map: Record<string, CalendarEvent[]> = {};
    for (const ev of events) {
      (map[ev.date] ||= []).push(ev);
    }
    for (const key of Object.keys(map)) {
      map[key].sort((a, b) => (a.time || '').localeCompare(b.time || ''));
    }
    return map;
  }, [events]);

  const days = useMemo(() => {
    const start = startOfWeek(startOfMonth(month), { weekStartsOn: 1 });
    const end = endOfWeek(endOfMonth(month), { weekStartsOn: 1 });
    return eachDayOfInterval({ start, end });
  }, [month]);

  function selectDay(day: Date) {
    setSelectedDate(format(day, 'yyyy-MM-dd'));
    if (!isSameMonth(day, month)) setMonth(startOfMonth(day));
  }

  function goToday() {
    const now = new Date();
    setMonth(startOfMonth(now));
    setSelectedDate(format(now, 'yyyy-MM-dd'));
  }

  const selectedEvents = eventsByDate[selectedDate] || [];
  const selectedDay = parseISO(selectedDate);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-bold uppercase tracking-widest text-[rgb(var(--accent))]">Spaces</p>
          <h1 className="mt-1 text-2xl font-black sm:text-3xl">Calendar</h1>
          <p className="mt-2 max-w-3xl text-sm text-slate-500">Viewings, meeting room bookings, renewals and reminders in one calendar.</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setMonth((m) => subMonths(m, 1))} className="btn-secondary px-3 py-2" aria-label="Previous month">
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button onClick={goToday} className="btn-secondary px-4 py-2 text-sm font-semibold">Today</button>
          <button onClick={() => setMonth((m) => addMonths(m, 1))} className="btn-secondary px-3 py-2" aria-label="Next month">
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="card p-4 sm:p-6">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-bold">{format(month, 'MMMM yyyy')}</h2>
            {loading && <Spinner size="sm" color="muted" />}
          </div>
          <div className="grid grid-cols-7 gap-1 text-center text-xs font-semibold uppercase tracking-wide text-slate-400">
            {WEEKDAYS.map((d) => (
              <div key={d} className="py-2">{d}</div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-1">
            {days.map((day) => {
              const key = format(day, 'yyyy-MM-dd');
              const dayEvents = eventsByDate[key] || [];
              const inMonth = isSameMonth(day, month);
              const selected = key === selectedDate;
              const today = isToday(day);
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => selectDay(day)}
                  className={`flex min-h-[92px] flex-col items-start gap-1 rounded-xl border p-1.5 text-left transition sm:min-h-[104px] sm:p-2 ${
                    selected
                      ? 'border-[rgb(var(--accent))] bg-orange-50/60 ring-2 ring-[rgb(var(--accent))]/30'
                      : 'border-slate-100 hover:border-slate-200 hover:bg-slate-50'
                  } ${!inMonth ? 'opacity-40' : ''}`}
                >
                  <span className={`grid h-6 w-6 place-items-center rounded-full text-xs font-bold ${today ? 'bg-[rgb(var(--accent))] text-white' : 'text-slate-600'}`}>
                    {format(day, 'd')}
                  </span>
                  <div className="flex w-full flex-col gap-0.5">
                    {dayEvents.slice(0, 3).map((ev) => (
                      <span key={ev.id} className="flex items-center gap-1 truncate text-[10px] font-medium text-slate-600">
                        <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${ev.dot}`} />
                        <span className="truncate">{ev.title}</span>
                      </span>
                    ))}
                    {dayEvents.length > 3 && <span className="text-[10px] font-semibold text-slate-400">+{dayEvents.length - 3} more</span>}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        <div className="card h-fit p-5">
          <div className="flex items-center gap-2 text-slate-400">
            <CalendarDays className="h-4 w-4" />
            <p className="text-xs font-semibold uppercase tracking-wide">{format(selectedDay, 'EEEE')}</p>
          </div>
          <h3 className="mt-1 text-lg font-bold">{format(selectedDay, 'd MMMM yyyy')}</h3>
          <p className="mt-1 text-xs text-slate-500">{selectedEvents.length} event{selectedEvents.length === 1 ? '' : 's'} scheduled</p>

          <div className="mt-5 space-y-3">
            {!loading && selectedEvents.length === 0 && (
              <p className="rounded-xl border border-dashed border-slate-200 p-4 text-center text-sm text-slate-400">No events scheduled for this day.</p>
            )}
            {selectedEvents.map((ev) => (
              <a key={ev.id} href={ev.href} className="block rounded-2xl border border-slate-100 p-3 transition hover:border-slate-200 hover:bg-slate-50">
                <div className="flex items-center justify-between gap-2">
                  <span className={`status-pill ${ev.color}`}>{ev.kindLabel}</span>
                  {ev.time && <span className="text-xs font-semibold text-slate-500">{ev.time}{ev.endTime ? ` – ${ev.endTime}` : ''}</span>}
                </div>
                <p className="mt-2 text-sm font-bold">{ev.title}</p>
                {ev.subtitle && <p className="mt-0.5 text-xs text-slate-500">{ev.subtitle}</p>}
                <p className="mt-1 text-[11px] font-medium text-slate-400">{ev.status}</p>
              </a>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
