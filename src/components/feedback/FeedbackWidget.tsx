import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Bug, Camera, Lightbulb, Loader2, Paintbrush, X } from 'lucide-react';

import { portalApi, type FeedbackSubmitInput } from '@/lib/portal';
import { getDiagnostics } from '@/lib/diagnostics';
import { captureViewport } from '@/lib/screenshot';
import { queueFeedback } from '@/lib/feedbackQueue';
import { SnipEditor } from './SnipEditor';

const OPEN_EVENT = 'wt-open-feedback';

export type FeedbackPrefill = { title?: string; description?: string; category?: string };

/** Open the feedback reporter from anywhere (header button, error boundary). */
export function openFeedback(prefill?: FeedbackPrefill): void {
  window.dispatchEvent(new CustomEvent<FeedbackPrefill>(OPEN_EVENT, { detail: prefill ?? {} }));
}

const CATEGORIES: { key: string; icon: typeof Bug }[] = [
  { key: 'bug', icon: Bug },
  { key: 'feature', icon: Lightbulb },
  { key: 'ui_ux', icon: Paintbrush },
];

function isNetworkError(err: unknown): boolean {
  const e = err as { response?: unknown; code?: string };
  return !e?.response || e.code === 'ERR_NETWORK' || e.code === 'ECONNABORTED';
}

/** The portal feedback reporter — a global overlay opened via {@link openFeedback}. */
export function FeedbackWidget() {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [category, setCategory] = useState('bug');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [includeDiagnostics, setIncludeDiagnostics] = useState(true);
  const [shot, setShot] = useState<{ blob: Blob; url: string } | null>(null);
  const [captureUrl, setCaptureUrl] = useState<string | null>(null);
  const [capturing, setCapturing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<FeedbackPrefill>).detail ?? {};
      setTitle(detail.title ?? '');
      setDescription(detail.description ?? '');
      setCategory(detail.category ?? 'bug');
      setOpen(true);
    };
    window.addEventListener(OPEN_EVENT, handler);
    return () => window.removeEventListener(OPEN_EVENT, handler);
  }, []);

  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(id);
  }, [toast]);

  const clearShot = () =>
    setShot((prev) => {
      if (prev) URL.revokeObjectURL(prev.url);
      return null;
    });

  const resetAndClose = () => {
    clearShot();
    setTitle('');
    setDescription('');
    setCategory('bug');
    setIncludeDiagnostics(true);
    setOpen(false);
  };

  const startSnip = async () => {
    setCapturing(true);
    setOpen(false);
    await new Promise((r) => setTimeout(r, 180));
    try {
      setCaptureUrl(await captureViewport());
    } catch {
      setToast(t('feedback.screenshot_failed'));
      setOpen(true);
    } finally {
      setCapturing(false);
    }
  };

  const submit = async () => {
    const trimmed = title.trim();
    if (!trimmed || submitting) return;
    setSubmitting(true);

    const input: FeedbackSubmitInput = {
      title: trimmed,
      category,
      description: description.trim() || undefined,
      route: location.pathname + location.search,
      appVersion: (import.meta.env?.VITE_APP_VERSION as string | undefined) ?? undefined,
      diagnostics: includeDiagnostics ? getDiagnostics() : undefined,
    };

    try {
      const ticket = await portalApi.submitFeedback(input);
      if (shot) {
        try {
          await portalApi.uploadFeedbackScreenshot(ticket.id, shot.blob);
        } catch {
          /* screenshot best-effort */
        }
      }
      setToast(t('feedback.submitted'));
      window.dispatchEvent(new Event('wt-feedback-submitted'));
      resetAndClose();
    } catch (err) {
      if (isNetworkError(err)) {
        queueFeedback(input);
        setToast(t('feedback.queued'));
        resetAndClose();
      } else {
        setToast(t('feedback.submit_failed'));
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      {captureUrl && (
        <SnipEditor
          imageDataUrl={captureUrl}
          onDone={(blob) => {
            clearShot();
            setShot({ blob, url: URL.createObjectURL(blob) });
            setCaptureUrl(null);
            setOpen(true);
          }}
          onCancel={() => {
            setCaptureUrl(null);
            setOpen(true);
          }}
        />
      )}

      {toast && (
        <div data-feedback-chrome="true" className="fixed bottom-4 left-1/2 z-[110] -translate-x-1/2 rounded-md bg-slate-900 px-4 py-2 text-sm text-white shadow-lg">
          {toast}
        </div>
      )}

      {open && (
        <div data-feedback-chrome="true" className="fixed inset-0 z-[90] flex items-start justify-center overflow-auto bg-black/40 p-4 sm:items-center">
          <div className="w-full max-w-lg rounded-lg bg-white p-5 shadow-xl">
            <div className="mb-3 flex items-start justify-between">
              <div>
                <h2 className="flex items-center gap-2 text-lg font-semibold">
                  <Bug className="size-5" /> {t('feedback.title')}
                </h2>
                <p className="mt-0.5 text-sm text-slate-500">{t('feedback.description')}</p>
              </div>
              <button type="button" onClick={resetAndClose} aria-label={t('action.cancel')} className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700">
                <X className="size-5" />
              </button>
            </div>

            <div className="space-y-3">
              <div className="grid grid-cols-3 gap-2">
                {CATEGORIES.map((c) => {
                  const Icon = c.icon;
                  const active = category === c.key;
                  return (
                    <button
                      key={c.key}
                      type="button"
                      onClick={() => setCategory(c.key)}
                      className={`flex flex-col items-center gap-1 rounded-md border p-2 text-xs ${
                        active ? 'border-[var(--brand-primary)] bg-[var(--brand-primary)]/5 text-slate-900' : 'border-slate-200 text-slate-500 hover:bg-slate-50'
                      }`}
                    >
                      <Icon className="size-4" />
                      {t(`feedback.category.${c.key}`)}
                    </button>
                  );
                })}
              </div>

              <div>
                <label htmlFor="fb-title" className="mb-1 block text-sm font-medium text-slate-700">{t('feedback.label_title')}</label>
                <input
                  id="fb-title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder={t('feedback.placeholder_title')}
                  className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm focus:border-[var(--brand-primary)] focus:outline-none"
                  autoFocus
                />
              </div>

              <div>
                <label htmlFor="fb-desc" className="mb-1 block text-sm font-medium text-slate-700">{t('feedback.label_description')}</label>
                <textarea
                  id="fb-desc"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder={t('feedback.placeholder_description')}
                  rows={4}
                  className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm focus:border-[var(--brand-primary)] focus:outline-none"
                />
              </div>

              <div>
                {shot ? (
                  <div className="flex items-center gap-2">
                    <img src={shot.url} alt="" className="h-12 w-auto rounded border border-slate-200" />
                    <button type="button" onClick={clearShot} className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-800">
                      <X className="size-4" /> {t('feedback.remove_screenshot')}
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={startSnip}
                    disabled={capturing}
                    className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-60"
                  >
                    {capturing ? <Loader2 className="size-4 animate-spin" /> : <Camera className="size-4" />}
                    {t('feedback.add_screenshot')}
                  </button>
                )}
              </div>

              <label className="flex cursor-pointer items-start justify-between gap-3 rounded-md bg-slate-50 p-2.5">
                <span>
                  <span className="block text-sm text-slate-700">{t('feedback.include_diagnostics')}</span>
                  <span className="block text-xs text-slate-500">{t('feedback.diagnostics_hint')}</span>
                </span>
                <input
                  type="checkbox"
                  checked={includeDiagnostics}
                  onChange={(e) => setIncludeDiagnostics(e.target.checked)}
                  className="mt-1 size-4 accent-[var(--brand-primary)]"
                />
              </label>
            </div>

            <div className="mt-4 flex justify-end gap-2">
              <button type="button" onClick={resetAndClose} className="rounded-md px-3 py-2 text-sm text-slate-600 hover:bg-slate-100">
                {t('action.cancel')}
              </button>
              <button
                type="button"
                onClick={submit}
                disabled={submitting || !title.trim()}
                className="inline-flex items-center gap-1.5 rounded-md bg-[var(--brand-primary)] px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
              >
                {submitting ? <Loader2 className="size-4 animate-spin" /> : null}
                {t('feedback.send')}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
