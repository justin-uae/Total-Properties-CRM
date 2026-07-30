'use client';

import { useState } from 'react';
import { FileText, Upload, X } from 'lucide-react';
import { Spinner } from '@/components/ui/Spinner';
import { ImageLightbox } from '@/components/ui/ImageLightbox';
import { fmtDate } from '@/lib/utils';

type FileRef = { id: string; name: string; mimeType: string };
type Comment = { id: string; authorName: string; authorRole: string; message: string; createdAt: string };
type RecordRow = { id: string; status: string; data: Record<string, any> };

const CATEGORIES = ['AC', 'Maintenance', 'Electricity', 'Other'];
const STATUSES = ['Open', 'In Progress', 'Waiting Tenant', 'Completed', 'Closed'];

export function MaintenanceDetail({
  ticket,
  mode,
  onClose,
  onSaved
}: {
  ticket: RecordRow;
  mode: 'admin' | 'tenant';
  onClose: () => void;
  onSaved: () => void;
}) {
  // Default to locked unless the ticket was explicitly logged by staff — this also covers
  // tenant-submitted tickets created before the `createdByStaff` flag existed.
  const canEditDetails = mode === 'admin' && Boolean(ticket.data.createdByStaff);
  const canEditStatus = mode === 'admin';
  const commentsEndpoint = mode === 'admin' ? `/api/maintenance/${ticket.id}/comments` : `/api/tenant/maintenance/${ticket.id}/comments`;
  const fileBase = mode === 'admin' ? '/api/files' : '/api/tenant/files';

  const [category, setCategory] = useState(ticket.data.category || '');
  const [issue, setIssue] = useState(ticket.data.issue || '');
  const [photos, setPhotos] = useState<FileRef[]>(Array.isArray(ticket.data.resolution) ? ticket.data.resolution : []);
  const [status, setStatus] = useState(ticket.status);
  const [comments, setComments] = useState<Comment[]>(Array.isArray(ticket.data.comments) ? ticket.data.comments : []);
  const [newComment, setNewComment] = useState('');
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [postingComment, setPostingComment] = useState(false);
  const [lightbox, setLightbox] = useState<{ src: string; alt: string } | null>(null);
  const [error, setError] = useState('');

  async function uploadPhotos(files: FileList) {
    setUploading(true);
    try {
      for (const file of Array.from(files)) {
        const fd = new FormData();
        fd.append('file', file);
        fd.append('module', 'maintenance');
        fd.append('recordId', ticket.id);
        const res = await fetch('/api/files/upload', { method: 'POST', body: fd });
        const json = await res.json();
        if (!res.ok) { setError(json.message || 'Upload failed'); continue; }
        setPhotos((p) => [...p, { id: json.file.id, name: json.file.originalName, mimeType: json.file.mimeType }]);
      }
    } finally {
      setUploading(false);
    }
  }

  async function removePhoto(id: string) {
    await fetch(`/api/files/${id}`, { method: 'DELETE' });
    setPhotos((p) => p.filter((f) => f.id !== id));
  }

  async function save() {
    setSaving(true);
    setError('');
    try {
      const data = canEditDetails ? { ...ticket.data, category, issue, resolution: photos } : ticket.data;
      const res = await fetch(`/api/records/${ticket.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status, data })
      });
      const json = await res.json();
      if (!res.ok) { setError(json.message || 'Could not save ticket'); return; }
      onSaved();
    } finally {
      setSaving(false);
    }
  }

  async function addComment() {
    if (!newComment.trim()) return;
    setPostingComment(true);
    setError('');
    try {
      const res = await fetch(commentsEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: newComment.trim() })
      });
      const json = await res.json();
      if (!res.ok) { setError(json.message || 'Could not add comment'); return; }
      setComments(Array.isArray(json.record.data.comments) ? json.record.data.comments : []);
      setNewComment('');
      onSaved();
    } finally {
      setPostingComment(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-slate-100 p-4">
          <div>
            <p className="font-bold">{ticket.data.ticketNumber}</p>
            <p className="text-xs text-slate-500">{ticket.data.clientName}</p>
          </div>
          <button onClick={onClose} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100"><X className="h-4 w-4" /></button>
        </div>

        <div className="space-y-5 p-6">
          {mode === 'admin' && !canEditDetails && (
            <p className="rounded-xl bg-amber-50 px-3 py-2 text-xs font-medium text-amber-700">
              This ticket was submitted by the tenant — the category, details and photos cannot be edited, only status and comments.
            </p>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="label">Category</label>
              {canEditDetails ? (
                <select className="input" value={category} onChange={(e) => setCategory(e.target.value)}>
                  <option value="">Select...</option>
                  {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              ) : (
                <p className="text-sm font-medium text-slate-700">{category || '—'}</p>
              )}
            </div>
            {canEditStatus && (
              <div>
                <label className="label">Status</label>
                <select className="input" value={status} onChange={(e) => setStatus(e.target.value)}>
                  {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
            )}
          </div>

          <div>
            <label className="label">Details</label>
            {canEditDetails ? (
              <textarea className="input min-h-24" value={issue} onChange={(e) => setIssue(e.target.value)} />
            ) : (
              <p className="whitespace-pre-line rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">{issue || '—'}</p>
            )}
          </div>

          <div>
            <label className="label">Photos</label>
            <div className="space-y-3">
              {photos.length > 0 && (
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                  {photos.map((ref) => (
                    <div key={ref.id} className="overflow-hidden rounded-xl border border-slate-200 bg-slate-50">
                      {ref.mimeType?.startsWith('image/') ? (
                        <button type="button" onClick={() => setLightbox({ src: `${fileBase}/${ref.id}`, alt: ref.name })} className="block h-24 w-full">
                          <img src={`${fileBase}/${ref.id}`} alt={ref.name} className="h-24 w-full object-cover" />
                        </button>
                      ) : (
                        <a href={`${fileBase}/${ref.id}?download=true`} className="flex h-24 items-center justify-center"><FileText className="h-8 w-8 text-slate-400" /></a>
                      )}
                      <div className="flex items-center gap-1 border-t border-slate-200 bg-white px-2 py-1.5">
                        <a href={`${fileBase}/${ref.id}?download=true`} className="min-w-0 flex-1 truncate text-xs font-medium text-slate-700 hover:underline">{ref.name}</a>
                        {canEditDetails && (
                          <button type="button" onClick={() => removePhoto(ref.id)} className="text-xs font-medium text-red-500 hover:text-red-700">Remove</button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
              {photos.length === 0 && !canEditDetails && <p className="text-sm text-slate-500">No photos attached.</p>}
              {canEditDetails && (
                uploading ? (
                  <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4">
                    <Spinner size="sm" color="muted" />
                    <span className="text-sm text-slate-500">Uploading…</span>
                  </div>
                ) : (
                  <label className="flex cursor-pointer flex-col items-center gap-3 rounded-xl border-2 border-dashed border-slate-200 bg-slate-50 p-6 text-center transition hover:border-[rgb(var(--accent))]">
                    <Upload className="h-7 w-7 text-slate-400" />
                    <p className="text-sm font-medium text-slate-600">Click to add photos</p>
                    <input type="file" multiple className="sr-only" accept=".jpg,.jpeg,.png,.webp,.gif"
                      onChange={(e) => { const f = e.target.files; if (f && f.length) uploadPhotos(f); }} />
                  </label>
                )
              )}
            </div>
          </div>

          <div>
            <label className="label">Comments</label>
            <div className="space-y-2">
              {comments.length === 0 && <p className="text-sm text-slate-500">No comments yet.</p>}
              {comments.map((c) => (
                <div key={c.id} className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-semibold text-slate-700">{c.authorName} <span className="font-normal text-slate-400">({c.authorRole === 'TENANT' ? 'Tenant' : 'Staff'})</span></p>
                    <p className="text-[11px] text-slate-400">{fmtDate(c.createdAt)}</p>
                  </div>
                  <p className="mt-1 whitespace-pre-line text-sm text-slate-600">{c.message}</p>
                </div>
              ))}
            </div>
            <div className="mt-3 flex flex-col gap-2 sm:flex-row">
              <textarea className="input min-h-16 flex-1" placeholder="Add a comment..." value={newComment} onChange={(e) => setNewComment(e.target.value)} />
              <button type="button" onClick={addComment} disabled={postingComment || !newComment.trim()} className="btn-secondary shrink-0">
                {postingComment ? 'Posting…' : 'Add Comment'}
              </button>
            </div>
          </div>

          {error && <p className="rounded-xl bg-red-50 px-3 py-2 text-sm font-medium text-red-600">{error}</p>}

          <div className="flex flex-col gap-2 border-t border-slate-100 pt-5 sm:flex-row sm:justify-end">
            <button type="button" onClick={onClose} className="btn-secondary w-full sm:w-auto">Close</button>
            {mode === 'admin' && (
              <button type="button" onClick={save} disabled={saving} className="btn-primary flex w-full items-center justify-center gap-2 sm:w-auto sm:min-w-[120px]">
                {saving ? <><Spinner size="sm" color="white" /><span>Saving…</span></> : 'Save'}
              </button>
            )}
          </div>
        </div>
      </div>

      {lightbox && <ImageLightbox src={lightbox.src} alt={lightbox.alt} onClose={() => setLightbox(null)} />}
    </div>
  );
}
