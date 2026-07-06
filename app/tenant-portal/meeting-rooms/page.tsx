'use client';

import { useEffect, useState } from 'react';
import { fmtDate } from '@/lib/utils';
import { Spinner } from '@/components/ui/Spinner';
import { Plus } from 'lucide-react';

type RecordRow = { id: string; title: string; status: string; data: Record<string, any>; createdAt: string };

export default function TenantMeetingRoomsPage() {
  const [rooms, setRooms] = useState<RecordRow[]>([]);
  const [bookings, setBookings] = useState<RecordRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState({ roomName: '', location: '', bookingDate: '', startTime: '', endTime: '', numberOfPeople: '' });

  async function load() {
    setLoading(true);
    const roomsRes = await fetch('/api/tenant/meeting-rooms').then((r) => r.json());
    const bookingsRes = await fetch('/api/tenant/meeting-room-bookings').then((r) => r.json());
    setRooms(roomsRes.records || []);
    setBookings(bookingsRes.records || []);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  function pickRoom(roomName: string) {
    const room = rooms.find((r) => r.data.roomName === roomName);
    setForm((f) => ({ ...f, roomName, location: room?.data.location || '' }));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError('');
    const res = await fetch('/api/tenant/meeting-room-bookings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form)
    });
    const json = await res.json();
    setSaving(false);
    if (!res.ok) { setError(json.message || 'Booking failed'); return; }
    setShowForm(false);
    setForm({ roomName: '', location: '', bookingDate: '', startTime: '', endTime: '', numberOfPeople: '' });
    await load();
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-black sm:text-3xl">Meeting Rooms</h1>
          <p className="mt-2 text-sm text-slate-500">Book an available meeting room and track your bookings.</p>
        </div>
        <button onClick={() => setShowForm(true)} className="btn-primary"><Plus className="mr-2 inline h-4 w-4" />Book a Room</button>
      </div>

      {showForm && (
        <div className="card p-6">
          <div className="mb-5 flex items-center justify-between">
            <h2 className="text-xl font-bold">Book a Meeting Room</h2>
            <button onClick={() => setShowForm(false)} className="btn-secondary">Cancel</button>
          </div>
          <form onSubmit={submit} className="grid gap-4 md:grid-cols-2">
            {error && <p className="rounded-xl bg-red-50 px-3 py-2 text-sm font-medium text-red-600 md:col-span-2">{error}</p>}
            <div>
              <label className="label">Room</label>
              <select className="input" disabled={saving} value={form.roomName} onChange={(e) => pickRoom(e.target.value)} required>
                <option value="">Select a room...</option>
                {rooms.map((r) => <option key={r.id} value={r.data.roomName}>{r.data.roomName} ({r.data.location}, capacity {r.data.capacity})</option>)}
              </select>
            </div>
            <div>
              <label className="label">Number of People</label>
              <input className="input" type="number" disabled={saving} value={form.numberOfPeople} onChange={(e) => setForm({ ...form, numberOfPeople: e.target.value })} />
            </div>
            <div>
              <label className="label">Date</label>
              <input className="input" type="date" disabled={saving} value={form.bookingDate} onChange={(e) => setForm({ ...form, bookingDate: e.target.value })} required />
            </div>
            <div>
              <label className="label">Start Time</label>
              <input className="input" type="time" disabled={saving} value={form.startTime} onChange={(e) => setForm({ ...form, startTime: e.target.value })} required />
            </div>
            <div>
              <label className="label">End Time</label>
              <input className="input" type="time" disabled={saving} value={form.endTime} onChange={(e) => setForm({ ...form, endTime: e.target.value })} required />
            </div>
            <div className="flex flex-col gap-2 sm:flex-row sm:justify-end md:col-span-2">
              <button type="button" onClick={() => setShowForm(false)} disabled={saving} className="btn-secondary w-full sm:w-auto">Cancel</button>
              <button className="btn-primary flex w-full items-center justify-center gap-2 sm:w-auto sm:min-w-[120px]" disabled={saving}>
                {saving ? <><Spinner size="sm" color="white" /><span>Booking...</span></> : 'Book Room'}
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="card overflow-hidden">
        <div className="border-b border-slate-100 p-5">
          <h2 className="font-bold">Your Bookings</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase text-slate-500">
              <tr>
                <th className="px-5 py-3 whitespace-nowrap">Room</th>
                <th className="px-5 py-3 whitespace-nowrap">Date</th>
                <th className="px-5 py-3 whitespace-nowrap">Time</th>
                <th className="px-5 py-3 whitespace-nowrap">People</th>
                <th className="px-5 py-3 whitespace-nowrap">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr><td className="px-5 py-8 text-slate-500" colSpan={5}><Spinner size="sm" color="muted" /></td></tr>
              ) : bookings.length === 0 ? (
                <tr><td className="px-5 py-8 text-slate-500" colSpan={5}>No bookings yet.</td></tr>
              ) : bookings.map((row) => (
                <tr key={row.id}>
                  <td className="px-5 py-4 whitespace-nowrap font-semibold">{row.data.roomName}</td>
                  <td className="px-5 py-4 whitespace-nowrap">{fmtDate(row.data.bookingDate)}</td>
                  <td className="px-5 py-4 whitespace-nowrap">{row.data.startTime} - {row.data.endTime}</td>
                  <td className="px-5 py-4 whitespace-nowrap">{row.data.numberOfPeople || '—'}</td>
                  <td className="px-5 py-4 whitespace-nowrap"><span className="status-pill bg-orange-50 text-orange-700">{row.status}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
