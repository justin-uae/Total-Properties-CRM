'use client';

import { forwardRef, useImperativeHandle, useRef, useState } from 'react';

export type SignaturePadHandle = {
  clear: () => void;
  isEmpty: () => boolean;
  toDataURL: () => string;
};

export const SignaturePad = forwardRef<SignaturePadHandle, { className?: string }>(function SignaturePad({ className }, ref) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const hasInk = useRef(false);
  const [empty, setEmpty] = useState(true);

  function context() {
    return canvasRef.current?.getContext('2d') || null;
  }

  function pointFromEvent(e: React.PointerEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    return { x: ((e.clientX - rect.left) / rect.width) * canvas.width, y: ((e.clientY - rect.top) / rect.height) * canvas.height };
  }

  function start(e: React.PointerEvent<HTMLCanvasElement>) {
    const ctx = context();
    if (!ctx) return;
    drawing.current = true;
    const { x, y } = pointFromEvent(e);
    ctx.beginPath();
    ctx.moveTo(x, y);
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  }

  function move(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!drawing.current) return;
    const ctx = context();
    if (!ctx) return;
    const { x, y } = pointFromEvent(e);
    ctx.lineWidth = 2.25;
    ctx.lineCap = 'round';
    ctx.strokeStyle = '#1759d9';
    ctx.lineTo(x, y);
    ctx.stroke();
    hasInk.current = true;
    setEmpty(false);
  }

  function end() {
    drawing.current = false;
  }

  useImperativeHandle(ref, () => ({
    clear() {
      const canvas = canvasRef.current;
      const ctx = context();
      if (canvas && ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
      hasInk.current = false;
      setEmpty(true);
    },
    isEmpty() {
      return !hasInk.current;
    },
    toDataURL() {
      return canvasRef.current?.toDataURL('image/png') || '';
    }
  }));

  return (
    <div className={className}>
      <canvas
        ref={canvasRef}
        width={480}
        height={160}
        className="w-full touch-none rounded-xl border-2 border-dashed border-slate-200 bg-white"
        onPointerDown={start}
        onPointerMove={move}
        onPointerUp={end}
        onPointerLeave={end}
      />
      {empty && <p className="mt-1 text-xs text-slate-400">Draw your signature above using your mouse or finger.</p>}
    </div>
  );
});
