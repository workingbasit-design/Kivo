'use client';

import { useEffect, useRef, useState } from 'react';
import { Card } from '@/components/ui';

/**
 * Client-side signing widget for the public /sign/[token] page.
 * Draw a signature on canvas (pointer events), or type a name and let it
 * act as the signature. The typed/typed-name input is always required —
 * it doubles as the legal signer name.
 */

export type SignStrings = {
  signName: string;
  signDrawHint: string;
  signClear: string;
  signButton: string;
  signedTitle: string;
  legalLine: string;
  errorGeneric: string;
  retry: string;
  signing: string;
};

function setupCanvas(canvas: HTMLCanvasElement): CanvasRenderingContext2D | null {
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  const dpr = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1;
  const w = canvas.clientWidth;
  const h = canvas.clientHeight;
  canvas.width = Math.max(1, Math.floor(w * dpr));
  canvas.height = Math.max(1, Math.floor(h * dpr));
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.lineWidth = 2.5;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.strokeStyle = '#161616';
  return ctx;
}

export default function SignClient({
  token,
  signerNameHint,
  strings: s,
}: {
  token: string;
  signerNameHint: string | null;
  strings: SignStrings;
}) {
  const [name, setName] = useState(signerNameHint ?? '');
  const [mode, setMode] = useState<'draw' | 'type'>('draw');
  const [hasInk, setHasInk] = useState(false);
  const [status, setStatus] = useState<'idle' | 'sending' | 'done' | 'error'>('idle');
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawingRef = useRef(false);
  const ctxRef = useRef<CanvasRenderingContext2D | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    ctxRef.current = setupCanvas(canvas);
    setHasInk(false);
    drawingRef.current = false;
  }, [mode]);

  const pos = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const rect = canvasRef.current!.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };

  const onPointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const ctx = ctxRef.current;
    if (!ctx) return;
    e.preventDefault();
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
    drawingRef.current = true;
    const p = pos(e);
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
  };

  const onPointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawingRef.current) return;
    const ctx = ctxRef.current;
    if (!ctx) return;
    e.preventDefault();
    const p = pos(e);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
    setHasInk(true);
  };

  const endStroke = () => {
    drawingRef.current = false;
  };

  const clear = () => {
    const canvas = canvasRef.current;
    const ctx = ctxRef.current;
    if (!canvas || !ctx) return;
    ctx.clearRect(0, 0, canvas.clientWidth, canvas.clientHeight);
    setHasInk(false);
  };

  const sign = async () => {
    const signerName = name.trim();
    if (!signerName || status === 'sending') return;
    // Either a drawn signature or the typed name counts as signature data —
    // one of the two must be present.
    const drawn =
      hasInk && canvasRef.current ? canvasRef.current.toDataURL('image/png') : null;
    const signatureData = drawn ?? `typed:${signerName}`;
    setStatus('sending');
    try {
      const res = await fetch(`/api/sign/${encodeURIComponent(token)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ signerName, signatureData }),
      });
      const json = (await res.json().catch(() => null)) as { ok?: boolean } | null;
      if (!res.ok || !json?.ok) throw new Error('sign failed');
      setStatus('done');
    } catch {
      setStatus('error');
    }
  };

  if (status === 'done') {
    return (
      <Card className="p-8 text-center">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100">
          <svg viewBox="0 0 24 24" className="h-7 w-7 text-emerald-700" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
            <path d="M20 6 9 17l-5-5" />
          </svg>
        </div>
        <h2 className="text-lg font-bold text-zinc-900">{s.signedTitle}</h2>
        <p className="mt-2 text-xs leading-relaxed text-zinc-500">{s.legalLine}</p>
      </Card>
    );
  }

  const nameOk = name.trim().length > 0;

  return (
    <Card className="p-5">
      {/* Draw / type mode toggle — labels reuse existing i18n keys in both languages. */}
      <div className="mb-4 grid grid-cols-2 gap-1 rounded-lg bg-zinc-100 p-1">
        <button
          type="button"
          onClick={() => setMode('draw')}
          className={`min-h-[44px] rounded-md px-3 py-2 text-sm font-semibold transition ${
            mode === 'draw' ? 'bg-white text-zinc-900 shadow-sm' : 'text-zinc-500'
          }`}
        >
          {s.signDrawHint}
        </button>
        <button
          type="button"
          onClick={() => setMode('type')}
          className={`min-h-[44px] rounded-md px-3 py-2 text-sm font-semibold transition ${
            mode === 'type' ? 'bg-white text-zinc-900 shadow-sm' : 'text-zinc-500'
          }`}
        >
          {s.signName}
        </button>
      </div>

      {mode === 'draw' ? (
        <div>
          <canvas
            ref={canvasRef}
            className="h-40 w-full touch-none rounded-lg border-2 border-dashed border-zinc-300 bg-white"
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={endStroke}
            onPointerCancel={endStroke}
            onPointerLeave={endStroke}
            aria-label={s.signDrawHint}
          />
          <button
            type="button"
            onClick={clear}
            className="mt-2 min-h-[44px] inline-flex items-center text-xs font-semibold text-zinc-500 underline underline-offset-2"
          >
            {s.signClear}
          </button>
        </div>
      ) : (
        <div className="rounded-lg border-2 border-dashed border-zinc-300 bg-white px-4 py-6">
          <p
            className="truncate text-center text-3xl text-zinc-900"
            style={{ fontFamily: '"Brush Script MT", "Segoe Script", cursive' }}
          >
            {name.trim() || '…'}
          </p>
        </div>
      )}

      <label className="mt-4 block">
        <span className="mb-1 block text-xs font-semibold text-zinc-700">{s.signName}</span>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={100}
          placeholder={signerNameHint ?? undefined}
          className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2.5 text-sm text-zinc-900 outline-none focus:border-ink focus:ring-1 focus:ring-ink"
        />
      </label>

      {status === 'error' && (
        <div className="mt-4 rounded-lg bg-red-50 px-4 py-3">
          <p className="text-sm font-semibold text-red-700">{s.errorGeneric}</p>
          <button
            type="button"
            onClick={() => setStatus('idle')}
            className="mt-1 min-h-[44px] inline-flex items-center text-xs font-semibold text-red-600 underline underline-offset-2"
          >
            {s.retry}
          </button>
        </div>
      )}

      <button
        type="button"
        onClick={sign}
        disabled={!nameOk || status === 'sending'}
        className="mt-4 min-h-[52px] w-full rounded-lg bg-ink px-4 py-3 text-sm font-bold text-white transition disabled:opacity-40"
      >
        {status === 'sending' ? s.signing : s.signButton}
      </button>

      <p className="mt-4 text-center text-[11px] leading-relaxed text-zinc-400">{s.legalLine}</p>
    </Card>
  );
}
