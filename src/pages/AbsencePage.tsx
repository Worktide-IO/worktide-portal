import { useCallback, useEffect, useMemo, useState } from 'react';
import i18n from '@/i18n';
import { intlLocale } from '@/lib/intl';
import { useTranslation } from 'react-i18next';
import { CalendarOff, Plus, Trash2 } from 'lucide-react';

import { portalApi, type PortalContactAbsence } from '@/lib/portal';

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Portal self-service: the customer contact records when they're away so the
 * agency knows. Informational only. Gated by the `absence` feature.
 */
export function AbsencePage() {
  const { t } = useTranslation();
  const [absences, setAbsences] = useState<PortalContactAbsence[]>([]);
  const [start, setStart] = useState(todayISO());
  const [end, setEnd] = useState(todayISO());
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    portalApi.contactAbsences().then(setAbsences).catch(() => setAbsences([]));
  }, []);

  useEffect(load, [load]);

  const dateFmt = useMemo(
    () => new Intl.DateTimeFormat(intlLocale(), { day: '2-digit', month: '2-digit', year: 'numeric' }),
    [i18n.language],
  );
  const fmtRange = (a: string, b: string) =>
    a === b ? dateFmt.format(new Date(a)) : `${dateFmt.format(new Date(a))} – ${dateFmt.format(new Date(b))}`;

  function add() {
    if (!start || !end) return;
    if (end < start) {
      setError(t('absence.error_end_before_start'));
      return;
    }
    setBusy(true);
    setError(null);
    portalApi
      .createContactAbsence({ startsOn: start, endsOn: end, note: note.trim() || undefined })
      .then(() => {
        setNote('');
        load();
      })
      .catch(() => setError(t('absence.error_save_failed')))
      .finally(() => setBusy(false));
  }

  function remove(id: string) {
    portalApi
      .deleteContactAbsence(id)
      .then(load)
      .catch(() => setError(t('absence.error_delete_failed')));
  }

  return (
    <div className="mx-auto w-full max-w-2xl">
      <h1 className="mb-1 flex items-center gap-2 text-xl font-semibold text-slate-900">
        <CalendarOff className="size-5 text-slate-400" /> {t('absence.title')}
      </h1>
      <p className="mb-6 text-sm text-slate-500">
        {t('absence.intro')}
      </p>

      <div className="mb-6 rounded-xl border border-slate-200 bg-white p-4">
        <div className="flex flex-wrap items-end gap-3">
          <div className="space-y-1">
            <label className="block text-sm font-medium text-slate-700">{t('absence.field_from')}</label>
            <input type="date" value={start} min={todayISO()} onChange={(e) => setStart(e.target.value)} className="rounded-md border border-slate-300 px-3 py-2 text-sm" />
          </div>
          <div className="space-y-1">
            <label className="block text-sm font-medium text-slate-700">{t('absence.field_to')}</label>
            <input type="date" value={end} min={start} onChange={(e) => setEnd(e.target.value)} className="rounded-md border border-slate-300 px-3 py-2 text-sm" />
          </div>
          <div className="min-w-48 grow space-y-1">
            <label className="block text-sm font-medium text-slate-700">{t('absence.field_note')}</label>
            <input value={note} onChange={(e) => setNote(e.target.value)} placeholder={t('absence.note_placeholder')} className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
          </div>
          <button type="button" onClick={add} disabled={busy} className="inline-flex items-center gap-1 rounded-md bg-[var(--brand-primary)] px-4 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50">
            <Plus className="size-4" /> {t('absence.add')}
          </button>
        </div>
        {error ? <p className="mt-2 text-sm text-red-600">{error}</p> : null}
      </div>

      {absences.length === 0 ? (
        <p className="rounded-lg border border-dashed border-slate-200 bg-white py-12 text-center text-sm text-slate-500">
          {t('absence.empty')}
        </p>
      ) : (
        <div className="divide-y rounded-xl border border-slate-200 bg-white">
          {absences.map((a) => (
            <div key={a.id} className="flex items-center gap-3 px-4 py-3 text-sm">
              <div className="min-w-0 flex-1">
                <div className="font-medium text-slate-800">{fmtRange(a.startsOn, a.endsOn)}</div>
                {a.note ? <div className="truncate text-xs text-slate-500">{a.note}</div> : null}
              </div>
              <button type="button" onClick={() => remove(a.id)} className="rounded p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600" aria-label={t('absence.delete')}>
                <Trash2 className="size-4" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
