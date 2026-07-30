'use client';

import { X } from 'lucide-react';

export function ImageLightbox({ src, alt, onClose }: { src: string; alt: string; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/80" onClick={onClose} />
      <button onClick={onClose} className="absolute right-4 top-4 rounded-full bg-white/10 p-2 text-white hover:bg-white/20">
        <X className="h-5 w-5" />
      </button>
      <img src={src} alt={alt} className="relative max-h-[90vh] max-w-[90vw] rounded-lg object-contain shadow-2xl" />
    </div>
  );
}
