import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Crop, Highlighter, Loader2, Square, X } from 'lucide-react';

type Tool = 'crop' | 'highlight' | 'blackout';
type Rect = { x: number; y: number; w: number; h: number };
type Annotation = { tool: 'highlight' | 'blackout' } & Rect;

/**
 * Full-screen snip editor: CROP a region, HIGHLIGHT the bug, or BLACK OUT
 * sensitive areas (destructive redaction — pixels painted over before upload).
 * Produces a PNG Blob. Rects tracked in natural-image coordinates.
 */
export function SnipEditor({
  imageDataUrl,
  onDone,
  onCancel,
}: {
  imageDataUrl: string;
  onDone: (blob: Blob) => void;
  onCancel: () => void;
}) {
  const { t } = useTranslation();
  const imgRef = useRef<HTMLImageElement | null>(null);
  const [tool, setTool] = useState<Tool>('crop');
  const [annotations, setAnnotations] = useState<Annotation[]>([]);
  const [crop, setCrop] = useState<Rect | null>(null);
  const [drag, setDrag] = useState<Rect | null>(null);
  const [busy, setBusy] = useState(false);
  const startRef = useRef<{ x: number; y: number } | null>(null);

  const toNatural = (clientX: number, clientY: number): { x: number; y: number } => {
    const el = imgRef.current;
    if (!el) return { x: 0, y: 0 };
    const rect = el.getBoundingClientRect();
    const sx = el.naturalWidth / rect.width;
    const sy = el.naturalHeight / rect.height;
    return {
      x: Math.max(0, Math.min(el.naturalWidth, (clientX - rect.left) * sx)),
      y: Math.max(0, Math.min(el.naturalHeight, (clientY - rect.top) * sy)),
    };
  };

  const onPointerDown = (e: React.PointerEvent) => {
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
    startRef.current = toNatural(e.clientX, e.clientY);
    setDrag({ ...startRef.current, w: 0, h: 0 });
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (!startRef.current) return;
    const p = toNatural(e.clientX, e.clientY);
    const s = startRef.current;
    setDrag({ x: Math.min(s.x, p.x), y: Math.min(s.y, p.y), w: Math.abs(p.x - s.x), h: Math.abs(p.y - s.y) });
  };
  const onPointerUp = () => {
    const r = drag;
    startRef.current = null;
    setDrag(null);
    if (!r || r.w < 4 || r.h < 4) return;
    if (tool === 'crop') setCrop(r);
    else setAnnotations((prev) => [...prev, { tool, ...r }]);
  };

  const toDisplay = (r: Rect): React.CSSProperties => {
    const el = imgRef.current;
    if (!el) return { display: 'none' };
    const rect = el.getBoundingClientRect();
    const sx = rect.width / el.naturalWidth;
    const sy = rect.height / el.naturalHeight;
    return { left: r.x * sx, top: r.y * sy, width: r.w * sx, height: r.h * sy };
  };

  const compose = async () => {
    setBusy(true);
    try {
      const img = new Image();
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = () => reject(new Error('image load failed'));
        img.src = imageDataUrl;
      });
      const canvas = document.createElement('canvas');
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('no 2d context');
      ctx.drawImage(img, 0, 0);

      for (const a of annotations.filter((x) => x.tool === 'highlight')) {
        ctx.fillStyle = 'rgba(250, 204, 21, 0.35)';
        ctx.fillRect(a.x, a.y, a.w, a.h);
        ctx.strokeStyle = '#eab308';
        ctx.lineWidth = 3;
        ctx.strokeRect(a.x, a.y, a.w, a.h);
      }
      for (const a of annotations.filter((x) => x.tool === 'blackout')) {
        ctx.fillStyle = '#000000';
        ctx.fillRect(a.x, a.y, a.w, a.h);
      }

      let out: HTMLCanvasElement = canvas;
      if (crop && crop.w > 4 && crop.h > 4) {
        const c2 = document.createElement('canvas');
        c2.width = Math.round(crop.w);
        c2.height = Math.round(crop.h);
        const cx = c2.getContext('2d');
        if (!cx) throw new Error('no 2d context');
        cx.drawImage(canvas, crop.x, crop.y, crop.w, crop.h, 0, 0, c2.width, c2.height);
        out = c2;
      }

      const blob = await new Promise<Blob | null>((resolve) => out.toBlob(resolve, 'image/png'));
      if (blob) onDone(blob);
      else onCancel();
    } catch {
      onCancel();
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onCancel]);

  const tools: { id: Tool; icon: typeof Crop; label: string }[] = [
    { id: 'crop', icon: Crop, label: t('feedback.snip.crop') },
    { id: 'highlight', icon: Highlighter, label: t('feedback.snip.highlight') },
    { id: 'blackout', icon: Square, label: t('feedback.snip.blackout') },
  ];

  const toolBtn = (active: boolean) =>
    `inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-sm ${
      active ? 'bg-white text-slate-900' : 'text-white hover:bg-white/10'
    }`;

  return (
    <div data-feedback-chrome="true" className="fixed inset-0 z-[100] flex flex-col bg-black/80">
      <div className="flex flex-wrap items-center gap-2 border-b border-white/10 bg-neutral-900/90 px-4 py-2 text-white">
        <div className="flex items-center gap-1">
          {tools.map((tl) => {
            const Icon = tl.icon;
            return (
              <button key={tl.id} type="button" className={toolBtn(tool === tl.id)} onClick={() => setTool(tl.id)}>
                <Icon className="size-4" /> {tl.label}
              </button>
            );
          })}
        </div>
        <span className="ml-2 hidden text-xs text-white/60 sm:inline">{t('feedback.snip.hint')}</span>
        <div className="ml-auto flex items-center gap-2">
          {(crop || annotations.length > 0) && (
            <button
              type="button"
              className="rounded-md px-2.5 py-1.5 text-sm text-white hover:bg-white/10"
              onClick={() => {
                setCrop(null);
                setAnnotations([]);
              }}
            >
              {t('feedback.snip.reset')}
            </button>
          )}
          <button type="button" className="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-sm text-white hover:bg-white/10" onClick={onCancel}>
            <X className="size-4" /> {t('action.cancel')}
          </button>
          <button
            type="button"
            className="inline-flex items-center gap-1.5 rounded-md bg-[var(--brand-primary)] px-3 py-1.5 text-sm font-medium text-white disabled:opacity-60"
            onClick={compose}
            disabled={busy}
          >
            {busy ? <Loader2 className="size-4 animate-spin" /> : null}
            {t('feedback.snip.attach')}
          </button>
        </div>
      </div>

      <div className="flex min-h-0 flex-1 items-center justify-center overflow-auto p-4">
        <div className="relative touch-none select-none" onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp}>
          <img ref={imgRef} src={imageDataUrl} alt="" draggable={false} className="max-h-[80vh] max-w-full cursor-crosshair rounded shadow-2xl" />
          {annotations.map((a, i) => (
            <div
              key={i}
              className={a.tool === 'highlight' ? 'pointer-events-none absolute border-2 border-yellow-400 bg-yellow-300/30' : 'pointer-events-none absolute bg-black'}
              style={toDisplay(a)}
            />
          ))}
          {crop && <div className="pointer-events-none absolute border-2 border-dashed border-sky-400 bg-sky-400/10" style={toDisplay(crop)} />}
          {drag && (
            <div
              className={
                tool === 'blackout'
                  ? 'pointer-events-none absolute bg-black/80'
                  : tool === 'highlight'
                    ? 'pointer-events-none absolute border-2 border-yellow-400 bg-yellow-300/30'
                    : 'pointer-events-none absolute border-2 border-dashed border-sky-400 bg-sky-400/10'
              }
              style={toDisplay(drag)}
            />
          )}
        </div>
      </div>
    </div>
  );
}
