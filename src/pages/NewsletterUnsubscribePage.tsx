import { useEffect, useState } from 'react';
import { useParams } from 'react-router';
import { MailX } from 'lucide-react';

import { BrandMark } from '@/components/BrandMark';
import { Footer } from '@/components/Footer';
import { publicNewsletter } from '@/lib/publicNewsletter';

/** Public /newsletter/unsubscribe/:token — one-click opt-out, no account. */
export function NewsletterUnsubscribePage() {
  const { token = '' } = useParams();
  const [info, setInfo] = useState<{ newsletterTitle: string; unsubscribed: boolean } | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    publicNewsletter
      .info(token)
      .then((d) => {
        setInfo(d);
        setDone(d.unsubscribed);
      })
      .catch(() => setNotFound(true));
  }, [token]);

  function unsubscribe() {
    setBusy(true);
    publicNewsletter
      .unsubscribe(token)
      .then(() => setDone(true))
      .catch(() => setNotFound(true))
      .finally(() => setBusy(false));
  }

  return (
    <div className="flex min-h-screen flex-col bg-slate-50 text-slate-900">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-3xl items-center px-4 py-3">
          <BrandMark />
        </div>
      </header>
      <main className="mx-auto w-full max-w-xl flex-1 px-4 py-8">
        {notFound ? (
          <div className="rounded-lg border border-dashed border-slate-200 bg-white py-16 text-center text-sm text-slate-500">
            Dieser Abmelde-Link ist ungültig.
          </div>
        ) : !info ? (
          <p className="text-sm text-slate-500">Lädt…</p>
        ) : (
          <div className="rounded-xl border border-slate-200 bg-white px-6 py-8 text-center">
            <MailX className="mx-auto mb-3 size-9 text-slate-400" />
            <h1 className="text-lg font-semibold text-slate-900">{info.newsletterTitle}</h1>
            {done ? (
              <p className="mt-4 text-sm font-medium text-slate-700">
                Sie wurden von diesem Newsletter abgemeldet.
              </p>
            ) : (
              <>
                <p className="mt-2 text-sm text-slate-600">
                  Möchten Sie diesen Newsletter abbestellen?
                </p>
                <button
                  type="button"
                  onClick={unsubscribe}
                  disabled={busy}
                  className="mt-6 rounded-md border border-red-200 bg-red-50 px-4 py-2 text-sm font-semibold text-red-700 hover:bg-red-100 disabled:opacity-50"
                >
                  {busy ? 'Wird abgemeldet…' : 'Abbestellen'}
                </button>
              </>
            )}
          </div>
        )}
      </main>
      <Footer className="py-6" />
    </div>
  );
}
