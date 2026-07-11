import { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowLeft, CalendarCheck, Clock, MapPin, User } from 'lucide-react';

import { portalApi, type PortalMe, type PortalMeetingType } from '@/lib/portal';
import { publicBooking } from '@/lib/publicBooking';

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
 * In-portal appointment booking for a logged-in customer (roadmap §7). Lists the
 * workspace's bookable meeting types (authed /portal/meeting-types), then books a
 * slot through the public /book/{slug} endpoints — prefilled with the logged-in
 * contact's name + email, so no re-typing. Gated by the `booking` feature.
 */
export function BookingBookPage() {
  const [me, setMe] = useState<PortalMe | null>(null);
  const [types, setTypes] = useState<PortalMeetingType[]>([]);
  const [slug, setSlug] = useState<string | null>(null);
  const [date, setDate] = useState(todayISO(1));
  const [slots, setSlots] = useState<string[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [chosen, setChosen] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [booked, setBooked] = useState<{ start: string } | null>(null);

  useEffect(() => {
    portalApi.me().then(setMe).catch(() => undefined);
    portalApi.meetingTypes().then(setTypes).catch(() => setTypes([]));
  }, []);

  const type = useMemo(() => types.find((t) => t.slug === slug) ?? null, [types, slug]);

  const loadSlots = useCallback(() => {
    if (!slug) return;
    setLoadingSlots(true);
    publicBooking
      .slots(slug, date, date, INVITEE_TZ)
      .then((r) => setSlots(r.slots))
      .catch(() => setSlots([]))
      .finally(() => setLoadingSlots(false));
  }, [slug, date]);

  useEffect(loadSlots, [loadSlots]);

  const timeFmt = useMemo(() => new Intl.DateTimeFormat('de-DE', { hour: '2-digit', minute: '2-digit' }), []);
  const dateLongFmt = useMemo(
    () => new Intl.DateTimeFormat('de-DE', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' }),
    [],
  );

  const inviteeName = me ? `${me.contact.firstName} ${me.contact.lastName}`.trim() : '';
  const inviteeEmail = me?.contact.email ?? '';

  function book() {
    if (!slug || !chosen) return;
    if (!inviteeEmail) {
      setError('Für Ihr Konto ist keine E-Mail hinterlegt.');
      return;
    }
    setSubmitting(true);
    setError(null);
    publicBooking
      .book(slug, { start: chosen, name: inviteeName || inviteeEmail, email: inviteeEmail, timezone: INVITEE_TZ })
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

  function reset() {
    setSlug(null);
    setChosen(null);
    setBooked(null);
    setSlots([]);
    setError(null);
  }

  return (
    <div className="mx-auto w-full max-w-2xl">
      <h1 className="mb-1 text-xl font-semibold text-slate-900">Termin buchen</h1>
      <p className="mb-6 text-sm text-slate-500">Wählen Sie einen Termintyp und einen freien Slot.</p>

      {booked && type ? (
        <div className="rounded-xl border border-slate-200 bg-white px-6 py-10 text-center">
          <CalendarCheck className="mx-auto mb-3 size-10 text-[var(--brand-primary)]" />
          <h2 className="text-lg font-semibold text-slate-900">Termin gebucht!</h2>
          <p className="mt-1 text-sm text-slate-600">
            {dateLongFmt.format(new Date(booked.start))} um {timeFmt.format(new Date(booked.start))} Uhr
          </p>
          <p className="mt-3 text-sm text-slate-500">
            Eine Bestätigung mit Kalender-Datei wurde an <strong>{inviteeEmail}</strong> gesendet.
          </p>
          <button type="button" onClick={reset} className="mt-6 text-sm text-[var(--brand-primary)] hover:underline">
            Weiteren Termin buchen
          </button>
        </div>
      ) : !slug ? (
        types.length === 0 ? (
          <p className="rounded-lg border border-dashed border-slate-200 bg-white py-16 text-center text-sm text-slate-500">
            Zurzeit sind keine Termine buchbar.
          </p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {types.map((t) => (
              <button
                key={t.slug}
                type="button"
                onClick={() => setSlug(t.slug)}
                className="rounded-xl border border-slate-200 bg-white p-4 text-left transition hover:border-[var(--brand-primary)]"
              >
                <div className="font-semibold text-slate-900">{t.title}</div>
                <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-slate-500">
                  <span className="inline-flex items-center gap-1"><Clock className="size-3.5" /> {t.durationMinutes} Min.</span>
                  <span className="inline-flex items-center gap-1"><MapPin className="size-3.5" /> {locationLabel(t.locationType)}</span>
                  {t.hostName ? <span className="inline-flex items-center gap-1"><User className="size-3.5" /> {t.hostName}</span> : null}
                </div>
                {t.description ? <p className="mt-2 text-sm text-slate-600">{t.description}</p> : null}
              </button>
            ))}
          </div>
        )
      ) : (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
          <div className="border-b border-slate-100 px-6 py-5">
            <button type="button" onClick={reset} className="mb-3 inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-800">
              <ArrowLeft className="size-4" /> Andere Terminart
            </button>
            <h2 className="text-lg font-semibold text-slate-900">{type?.title}</h2>
            {type ? (
              <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-slate-500">
                <span className="inline-flex items-center gap-1.5"><Clock className="size-4" /> {type.durationMinutes} Min.</span>
                <span className="inline-flex items-center gap-1.5"><MapPin className="size-4" /> {locationLabel(type.locationType)}</span>
                {type.hostName ? <span className="inline-flex items-center gap-1.5"><User className="size-4" /> {type.hostName}</span> : null}
              </div>
            ) : null}
          </div>

          {chosen ? (
            <div className="px-6 py-5">
              <button type="button" onClick={() => setChosen(null)} className="mb-4 inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-800">
                <ArrowLeft className="size-4" /> Anderer Termin
              </button>
              <p className="mb-4 rounded-md bg-slate-50 px-3 py-2 text-sm font-medium text-slate-700">
                {dateLongFmt.format(new Date(chosen))} · {timeFmt.format(new Date(chosen))} Uhr
              </p>
              <p className="mb-4 text-sm text-slate-600">
                Buchung als <strong>{inviteeName || inviteeEmail}</strong>
                {inviteeEmail ? <> ({inviteeEmail})</> : null}.
              </p>
              {error ? <p className="mb-3 text-sm text-red-600">{error}</p> : null}
              <button type="button" onClick={book} disabled={submitting} className="w-full rounded-md bg-[var(--brand-primary)] px-4 py-2.5 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50">
                {submitting ? 'Buchung läuft…' : 'Termin buchen'}
              </button>
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
    </div>
  );
}
