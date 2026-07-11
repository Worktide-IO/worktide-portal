import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router';
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

  const timeFmt = useMemo(() => new Intl.DateTimeFormat('de-DE', { hour: '2-digit', minute: '2-digit' }), []);
  const dateLongFmt = useMemo(
    () => new Intl.DateTimeFormat('de-DE', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' }),
    [],
  );
  const fullFmt = useMemo(
    () => new Intl.DateTimeFormat('de-DE', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' }),
    [],
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
        setError(status === 409 ? 'Dieser Termin ist leider nicht mehr frei. Bitte wählen Sie einen anderen.' : 'Verschieben fehlgeschlagen.');
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
            Dieser Termin wurde nicht gefunden.
          </div>
        ) : !info ? (
          <p className="text-sm text-slate-500">Lädt…</p>
        ) : info.cancelled ? (
          <div className="rounded-xl border border-slate-200 bg-white px-6 py-8 text-center">
            <h1 className="text-lg font-semibold text-slate-900">{info.title}</h1>
            <p className="mt-3 text-sm text-slate-600">Dieser Termin ist storniert und kann nicht mehr verschoben werden.</p>
          </div>
        ) : (
          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
            <div className="border-b border-slate-100 px-6 py-5">
              <h1 className="text-xl font-semibold text-slate-900">{info.title}</h1>
              <p className="mt-2 inline-flex items-center gap-1.5 text-sm text-slate-500">
                <CalendarClock className="size-4" /> Aktueller Termin: {fullFmt.format(new Date(info.start))} Uhr
              </p>
            </div>

            {moved ? (
              <div className="px-6 py-10 text-center">
                <CalendarCheck className="mx-auto mb-3 size-10 text-[var(--brand-primary)]" />
                <h2 className="text-lg font-semibold text-slate-900">Termin verschoben!</h2>
                <p className="mt-1 text-sm text-slate-600">
                  {dateLongFmt.format(new Date(moved.start))} um {timeFmt.format(new Date(moved.start))} Uhr
                </p>
                <p className="mt-3 text-sm text-slate-500">Eine aktualisierte Bestätigung mit Kalender-Datei wurde per E-Mail gesendet.</p>
              </div>
            ) : chosen ? (
              <div className="px-6 py-5">
                <button type="button" onClick={() => setChosen(null)} className="mb-4 inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-800">
                  <ArrowLeft className="size-4" /> Anderer Termin
                </button>
                <p className="mb-4 rounded-md bg-slate-50 px-3 py-2 text-sm font-medium text-slate-700">
                  Neuer Termin: {dateLongFmt.format(new Date(chosen))} · {timeFmt.format(new Date(chosen))} Uhr
                </p>
                {error ? <p className="mb-3 text-sm text-red-600">{error}</p> : null}
                <button type="button" onClick={submit} disabled={submitting} className="w-full rounded-md bg-[var(--brand-primary)] px-4 py-2.5 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50">
                  {submitting ? 'Wird verschoben…' : 'Termin verschieben'}
                </button>
              </div>
            ) : (
              <div className="px-6 py-5">
                <label className="mb-1 block text-sm font-medium text-slate-700">Neues Datum wählen</label>
                <input type="date" value={date} min={todayISO(0)} onChange={(e) => setDate(e.target.value)} className="mb-4 rounded-md border border-slate-300 px-3 py-2 text-sm" />
                {loadingSlots ? (
                  <p className="text-sm text-slate-500">Lädt…</p>
                ) : slots.length === 0 ? (
                  <p className="rounded-md border border-dashed border-slate-200 py-8 text-center text-sm text-slate-500">
                    Keine freien Termine an diesem Tag.
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
                    <p className="mt-3 text-xs text-slate-400">Zeiten in Ihrer Zeitzone ({INVITEE_TZ}).</p>
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
