import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router';
import { ArrowLeft, CalendarCheck, Clock, MapPin, User } from 'lucide-react';

import { BrandMark } from '@/components/BrandMark';
import { Footer } from '@/components/Footer';
import { publicBooking, type BookingMeetingType } from '@/lib/publicBooking';

const INVITEE_TZ = Intl.DateTimeFormat().resolvedOptions().timeZone;

function todayISO(offsetDays = 0): string {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return d.toISOString().slice(0, 10);
}

function locationLabel(type: string): string {
  return type === 'phone' ? 'Telefon' : type === 'in_person' ? 'Vor Ort' : 'Videocall';
}

/**
 * Public, unauthenticated booking page at /book/:slug. Renders its own branded
 * chrome (no PortalLayout / auth) and talks to /v1/book/* via the anonymous
 * client. Flow: pick a day → pick a slot → enter details → confirmation.
 */
export function BookingPage() {
  const { slug = '' } = useParams();
  const [type, setType] = useState<BookingMeetingType | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [date, setDate] = useState(todayISO(1));
  const [slots, setSlots] = useState<string[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [chosen, setChosen] = useState<string | null>(null);
  const [form, setForm] = useState({ name: '', email: '', notes: '', _hp: '' });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [booked, setBooked] = useState<{ start: string } | null>(null);

  useEffect(() => {
    publicBooking
      .type(slug)
      .then(setType)
      .catch(() => setNotFound(true));
  }, [slug]);

  const loadSlots = useCallback(() => {
    if (!type) return;
    setLoadingSlots(true);
    publicBooking
      .slots(slug, date, date, INVITEE_TZ)
      .then((r) => setSlots(r.slots))
      .catch(() => setSlots([]))
      .finally(() => setLoadingSlots(false));
  }, [slug, date, type]);

  useEffect(loadSlots, [loadSlots]);

  const timeFmt = useMemo(
    () => new Intl.DateTimeFormat('de-DE', { hour: '2-digit', minute: '2-digit' }),
    [],
  );
  const dateLongFmt = useMemo(
    () => new Intl.DateTimeFormat('de-DE', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' }),
    [],
  );

  function submit() {
    if (!chosen) return;
    const name = form.name.trim();
    const email = form.email.trim();
    if (!name || !email) {
      setError('Bitte Name und E-Mail angeben.');
      return;
    }
    setSubmitting(true);
    setError(null);
    publicBooking
      .book(slug, { start: chosen, name, email, notes: form.notes.trim() || undefined, timezone: INVITEE_TZ, _hp: form._hp })
      .then((r) => setBooked({ start: r.start }))
      .catch((e) => {
        const status = (e as { response?: { status?: number } })?.response?.status;
        setError(status === 409 ? 'Dieser Termin ist leider nicht mehr frei. Bitte wählen Sie einen anderen.' : 'Buchung fehlgeschlagen.');
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
            Dieser Buchungslink ist nicht verfügbar.
          </div>
        ) : !type ? (
          <p className="text-sm text-slate-500">Lädt…</p>
        ) : (
          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
            <div className="border-b border-slate-100 px-6 py-5">
              <h1 className="text-xl font-semibold text-slate-900">{type.title}</h1>
              <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-slate-500">
                <span className="inline-flex items-center gap-1.5"><Clock className="size-4" /> {type.durationMinutes} Min.</span>
                <span className="inline-flex items-center gap-1.5"><MapPin className="size-4" /> {locationLabel(type.locationType)}</span>
                {type.hostName ? <span className="inline-flex items-center gap-1.5"><User className="size-4" /> {type.hostName}</span> : null}
              </div>
              {type.description ? <p className="mt-3 text-sm text-slate-600">{type.description}</p> : null}
            </div>

            {booked ? (
              <div className="px-6 py-10 text-center">
                <CalendarCheck className="mx-auto mb-3 size-10 text-[var(--brand-primary)]" />
                <h2 className="text-lg font-semibold text-slate-900">Termin gebucht!</h2>
                <p className="mt-1 text-sm text-slate-600">
                  {dateLongFmt.format(new Date(booked.start))} um {timeFmt.format(new Date(booked.start))} Uhr
                </p>
                <p className="mt-3 text-sm text-slate-500">
                  Eine Bestätigung mit Kalender-Datei wurde an <strong>{form.email}</strong> gesendet.
                </p>
              </div>
            ) : chosen ? (
              <div className="px-6 py-5">
                <button type="button" onClick={() => setChosen(null)} className="mb-4 inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-800">
                  <ArrowLeft className="size-4" /> Anderer Termin
                </button>
                <p className="mb-4 rounded-md bg-slate-50 px-3 py-2 text-sm font-medium text-slate-700">
                  {dateLongFmt.format(new Date(chosen))} · {timeFmt.format(new Date(chosen))} Uhr
                </p>
                <div className="space-y-3">
                  <div>
                    <label className="mb-1 block text-sm font-medium text-slate-700">Name</label>
                    <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium text-slate-700">E-Mail</label>
                    <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium text-slate-700">Notiz (optional)</label>
                    <textarea rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
                  </div>
                  {/* Honeypot — hidden from humans. */}
                  <input tabIndex={-1} autoComplete="off" value={form._hp} onChange={(e) => setForm({ ...form, _hp: e.target.value })} className="hidden" aria-hidden />
                  {error ? <p className="text-sm text-red-600">{error}</p> : null}
                  <button type="button" onClick={submit} disabled={submitting} className="w-full rounded-md bg-[var(--brand-primary)] px-4 py-2.5 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50">
                    {submitting ? 'Buchung läuft…' : 'Termin buchen'}
                  </button>
                </div>
              </div>
            ) : (
              <div className="px-6 py-5">
                <label className="mb-1 block text-sm font-medium text-slate-700">Datum wählen</label>
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
