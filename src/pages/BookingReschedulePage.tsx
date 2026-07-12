import { useCallback, useEffect, useMemo, useState } from 'react';
import i18n from '@/i18n';
import { intlLocale } from '@/lib/intl';
import { useParams } from 'react-router';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, CalendarCheck, CalendarClock } from 'lucide-react';

import { BrandMark } from '@/components/BrandMark';
import { Footer } from '@/components/Footer';
import { publicBooking } from '@/lib/publicBooking';

const INVITEE_TZ = Intl.DateTimeFormat().resolvedOptions().timeZone;

function todayISO(offsetDays = 0): string {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return d.toISOString().slice(0, 10);
}

type RescheduleInfo = { slug: string; title: string; start: string; timezone: string; durationMinutes: number; cancelled: boolean };

/**
 * Public /book/reschedule/:token — lets an invitee move an existing booking to
 * a new slot without an account. The cancel-token in the path is the only
 * credential; renders its own branded chrome (no PortalLayout / auth) and talks
 * to /v1/book/* via the anonymous client. Flow: pick a day → pick a slot → done.
 */
export function BookingReschedulePage() {
  const { t } = useTranslation();
  const { token = '' } = useParams();
  const [info, setInfo] = useState<RescheduleInfo | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [date, setDate] = useState(todayISO(1));
  const [slots, setSlots] = useState<string[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [chosen, setChosen] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [moved, setMoved] = useState<{ start: string } | null>(null);

  useEffect(() => {
    publicBooking
      .rescheduleInfo(token)
      .then(setInfo)
      .catch(() => setNotFound(true));
  }, [token]);

  const loadSlots = useCallback(() => {
    if (!info || info.cancelled) return;
    setLoadingSlots(true);
    publicBooking
      .slots(info.slug, date, date, INVITEE_TZ)
      .then((r) => setSlots(r.slots))
      .catch(() => setSlots([]))
      .finally(() => setLoadingSlots(false));
  }, [info, date]);

  useEffect(loadSlots, [loadSlots]);

  const timeFmt = useMemo(() => new Intl.DateTimeFormat(intlLocale(), { hour: '2-digit', minute: '2-digit' }), [i18n.language]);
  const dateLongFmt = useMemo(
    () => new Intl.DateTimeFormat(intlLocale(), { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' }),
    [i18n.language],
  );
  const fullFmt = useMemo(
    () => new Intl.DateTimeFormat(intlLocale(), { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' }),
    [i18n.language],
  );

  function submit() {
    if (!chosen) return;
    setSubmitting(true);
    setError(null);
    publicBooking
      .reschedule(token, chosen)
      .then((r) => setMoved({ start: r.start }))
      .catch((e) => {
        const status = (e as { response?: { status?: number } })?.response?.status;
        setError(status === 409 ? t('booking_reschedule.err_slot_taken') : t('booking_reschedule.err_failed'));
        if (status === 409) {
          setChosen(null);
          loadSlots();
        }
      })
      .finally(() => setSubmitting(false));
  }

  return (
    <div className="flex min-h-screen flex-col bg-slate-50 text-slate-900">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-3xl items-center px-4 py-3">
          <BrandMark />
        </div>
      </header>

      <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-8">
        {notFound ? (
          <div className="rounded-lg border border-dashed border-slate-200 bg-white py-16 text-center text-sm text-slate-500">
            {t('booking_reschedule.not_found')}
          </div>
        ) : !info ? (
          <p className="text-sm text-slate-500">{t('app.loading')}</p>
        ) : info.cancelled ? (
          <div className="rounded-xl border border-slate-200 bg-white px-6 py-8 text-center">
            <h1 className="text-lg font-semibold text-slate-900">{info.title}</h1>
            <p className="mt-3 text-sm text-slate-600">{t('booking_reschedule.cancelled_note')}</p>
          </div>
        ) : (
          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
            <div className="border-b border-slate-100 px-6 py-5">
              <h1 className="text-xl font-semibold text-slate-900">{info.title}</h1>
              <p className="mt-2 inline-flex items-center gap-1.5 text-sm text-slate-500">
                <CalendarClock className="size-4" /> {t('booking_reschedule.current_appointment', { datetime: fullFmt.format(new Date(info.start)) })}
              </p>
            </div>

            {moved ? (
              <div className="px-6 py-10 text-center">
                <CalendarCheck className="mx-auto mb-3 size-10 text-[var(--brand-primary)]" />
                <h2 className="text-lg font-semibold text-slate-900">{t('booking_reschedule.moved_title')}</h2>
                <p className="mt-1 text-sm text-slate-600">
                  {t('booking_reschedule.moved_datetime', { date: dateLongFmt.format(new Date(moved.start)), time: timeFmt.format(new Date(moved.start)) })}
                </p>
                <p className="mt-3 text-sm text-slate-500">{t('booking_reschedule.moved_confirmation')}</p>
              </div>
            ) : chosen ? (
              <div className="px-6 py-5">
                <button type="button" onClick={() => setChosen(null)} className="mb-4 inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-800">
                  <ArrowLeft className="size-4" /> {t('booking_reschedule.other_slot')}
                </button>
                <p className="mb-4 rounded-md bg-slate-50 px-3 py-2 text-sm font-medium text-slate-700">
                  {t('booking_reschedule.new_slot', { date: dateLongFmt.format(new Date(chosen)), time: timeFmt.format(new Date(chosen)) })}
                </p>
                {error ? <p className="mb-3 text-sm text-red-600">{error}</p> : null}
                <button type="button" onClick={submit} disabled={submitting} className="w-full rounded-md bg-[var(--brand-primary)] px-4 py-2.5 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50">
                  {submitting ? t('booking_reschedule.moving') : t('booking_reschedule.move_button')}
                </button>
              </div>
            ) : (
              <div className="px-6 py-5">
                <label className="mb-1 block text-sm font-medium text-slate-700">{t('booking_reschedule.choose_new_date')}</label>
                <input type="date" value={date} min={todayISO(0)} onChange={(e) => setDate(e.target.value)} className="mb-4 rounded-md border border-slate-300 px-3 py-2 text-sm" />
                {loadingSlots ? (
                  <p className="text-sm text-slate-500">{t('app.loading')}</p>
                ) : slots.length === 0 ? (
                  <p className="rounded-md border border-dashed border-slate-200 py-8 text-center text-sm text-slate-500">
                    {t('booking_reschedule.no_slots')}
                  </p>
                ) : (
                  <>
                    <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                      {slots.map((s) => (
                        <button key={s} type="button" onClick={() => { setChosen(s); setError(null); }} className="rounded-md border border-slate-300 py-2 text-sm font-medium text-slate-700 hover:border-[var(--brand-primary)] hover:text-[var(--brand-primary)]">
                          {timeFmt.format(new Date(s))}
                        </button>
                      ))}
                    </div>
                    <p className="mt-3 text-xs text-slate-400">{t('booking_reschedule.timezone_note', { tz: INVITEE_TZ })}</p>
                  </>
                )}
              </div>
            )}
          </div>
        )}
      </main>
      <Footer className="py-6" />
    </div>
  );
}
