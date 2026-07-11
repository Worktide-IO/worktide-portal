import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router';
import { useTranslation } from 'react-i18next';
import { CalendarX } from 'lucide-react';

import { BrandMark } from '@/components/BrandMark';
import { Footer } from '@/components/Footer';
import { publicBooking } from '@/lib/publicBooking';

/** Public /book/cancel/:token — lets an invitee cancel without an account. */
export function BookingCancelPage() {
  const { t } = useTranslation();
  const { token = '' } = useParams();
  const [info, setInfo] = useState<{ title: string; start: string; timezone: string; cancelled: boolean } | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    publicBooking
      .cancelInfo(token)
      .then((d) => {
        setInfo(d);
        setDone(d.cancelled);
      })
      .catch(() => setNotFound(true));
  }, [token]);

  const fmt = useMemo(
    () => new Intl.DateTimeFormat('de-DE', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' }),
    [],
  );

  function cancel() {
    setBusy(true);
    publicBooking
      .cancel(token)
      .then(() => setDone(true))
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
            {t('booking_cancel.not_found')}
          </div>
        ) : !info ? (
          <p className="text-sm text-slate-500">{t('app.loading')}</p>
        ) : (
          <div className="rounded-xl border border-slate-200 bg-white px-6 py-8 text-center">
            <CalendarX className="mx-auto mb-3 size-9 text-slate-400" />
            <h1 className="text-lg font-semibold text-slate-900">{info.title}</h1>
            <p className="mt-1 text-sm text-slate-600">
              {t('booking_cancel.time_at', { time: fmt.format(new Date(info.start)), tz: info.timezone })}
            </p>
            {done ? (
              <p className="mt-5 text-sm font-medium text-slate-700">{t('booking_cancel.cancelled')}</p>
            ) : (
              <button type="button" onClick={cancel} disabled={busy} className="mt-6 rounded-md border border-red-200 bg-red-50 px-4 py-2 text-sm font-semibold text-red-700 hover:bg-red-100 disabled:opacity-50">
                {busy ? t('booking_cancel.cancelling') : t('booking_cancel.cancel_button')}
              </button>
            )}
          </div>
        )}
      </main>
      <Footer className="py-6" />
    </div>
  );
}
