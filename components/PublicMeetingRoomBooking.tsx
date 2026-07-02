'use client';

import { useState } from 'react';

export function PublicMeetingRoomBooking() {
  const [form, setForm] = useState<Record<string, string>>({});
  const [message, setMessage] = useState('');
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setMessage('');
    const res = await fetch('/api/public/meeting-room-booking', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) });
    const json = await res.json();
    setMessage(res.ok ? 'Booking request received. Our team will confirm shortly.' : json.message || 'Could not submit booking');
  }
  const field = (name: string, label: string, type = 'text') => (
    <div>
      <label className="label">{label}</label>
      <input className="input" type={type} value={form[name] || ''} onChange={(e) => setForm({ ...form, [name]: e.target.value })} required />
    </div>
  );
  return (
    <form onSubmit={submit} className="mx-auto max-w-3xl rounded-2xl bg-white p-5 shadow-soft sm:rounded-3xl sm:p-8">
      <h1 className="mt-2 text-2xl font-black sm:text-3xl">Book a Meeting Room</h1>
      <p className="mt-2 text-sm text-slate-500">Choose your room, location, number of people and booking time.</p>
      {message && <div className="mt-6 rounded-2xl bg-orange-50 p-4 text-sm font-semibold text-orange-700">{message}</div>}
      <div className="mt-6 grid gap-4 sm:mt-8 md:grid-cols-2">
        {field('customerName', 'Full Name')}
        {field('telephone', 'Telephone', 'tel')}
        {field('email', 'Email', 'email')}
        {field('roomName', 'Meeting Room')}
        {field('location', 'Location')}
        {field('numberOfPeople', 'Number of People', 'number')}
        {field('bookingDate', 'Booking Date', 'date')}
        {field('startTime', 'Start Time', 'time')}
        {field('endTime', 'End Time', 'time')}
      </div>
      <button className="btn-primary mt-6 w-full py-3 sm:mt-8">Request Booking</button>
    </form>
  );
}
