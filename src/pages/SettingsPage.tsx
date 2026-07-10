import { useEffect, useState } from 'react';
import { Bell, Check, Mail } from 'lucide-react';

import {
  portalApi,
  type NotificationChannelPrefs,
  type NotificationFrequency,
} from '@/lib/portal';

// Human labels for the notification types the backend knows about, in the
// order we want them shown. Keys mirror the NotificationType enum.
const TYPE_LABELS: { key: string; label: string; hint: string }[] = [
  { key: 'comment', label: 'Kommentare & Antworten', hint: 'Neue Antworten auf Ihre Tickets' },
  { key: 'task_assigned', label: 'Aufgaben', hint: 'Wenn Ihnen etwas zugewiesen wird' },
  { key: 'mention', label: 'Erwähnungen', hint: 'Wenn Sie @erwähnt werden' },
  { key: 'system', label: 'System & Monitoring', hint: 'Störungen und Wartungshinweise' },
  { key: 'launch', label: 'Neues & Launches', hint: 'Neue Produkte und Leistungen' },
  { key: 'ai', label: 'KI-Hinweise', hint: 'Vorschläge und Zusammenfassungen' },
];

const FREQUENCIES: { value: NotificationFrequency; label: string; hint: string }[] = [
  { value: 'instant', label: 'Sofort', hint: 'E-Mail bei jedem Ereignis' },
  { value: 'daily', label: 'Täglich', hint: 'Eine Zusammenfassung pro Tag' },
  { value: 'weekly', label: 'Wöchentlich', hint: 'Eine Zusammenfassung pro Woche' },
];

/** Portal Einstellungen — notification delivery preferences (email channel). */
export function SettingsPage() {
  const [prefs, setPrefs] = useState<NotificationChannelPrefs | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);

  useEffect(() => {
    portalApi
      .notificationPreferences()
      .then(setPrefs)
      .finally(() => setLoading(false));
  }, []);

  function patch(next: Partial<NotificationChannelPrefs>) {
    setPrefs((p) => (p ? { ...p, ...next } : p));
    setSavedAt(null);
  }

  function toggleType(key: string, value: boolean) {
    setPrefs((p) => (p ? { ...p, types: { ...p.types, [key]: value } } : p));
    setSavedAt(null);
  }

  function toggleQuietHours(enabled: boolean) {
    patch({ quietHours: enabled ? { start: '22:00', end: '07:00' } : null });
  }

  function save() {
    if (!prefs) return;
    setSaving(true);
    portalApi
      .saveNotificationPreferences(prefs)
      .then((saved) => {
        setPrefs(saved);
        setSavedAt(Date.now());
      })
      .finally(() => setSaving(false));
  }

  if (loading || !prefs) {
    return <p className="p-6 text-sm text-slate-500">Lädt…</p>;
  }

  const emailOn = prefs.email;

  return (
    <div className="mx-auto w-full max-w-2xl">
      <div className="mb-4">
        <h1 className="text-xl font-semibold text-slate-900">Einstellungen</h1>
        <p className="text-sm text-slate-500">Benachrichtigungen</p>
      </div>

      {/* In-app is always on — set expectations up front. */}
      <div className="mb-4 flex items-start gap-3 rounded-lg border border-slate-200 bg-white px-4 py-3">
        <Bell className="mt-0.5 size-5 shrink-0 text-[var(--brand-primary)]" />
        <div className="text-sm">
          <p className="font-medium text-slate-800">In-App-Benachrichtigungen</p>
          <p className="text-slate-500">
            Die Glocke oben zeigt Ihre Benachrichtigungen immer in Echtzeit — das lässt sich nicht abschalten.
          </p>
        </div>
      </div>

      <div className="rounded-lg border border-slate-200 bg-white">
        {/* Master email switch */}
        <label className="flex cursor-pointer items-start gap-3 border-b border-slate-100 px-4 py-4">
          <Mail className="mt-0.5 size-5 shrink-0 text-slate-400" />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-slate-800">E-Mail-Benachrichtigungen</p>
            <p className="text-xs text-slate-500">Zusätzlich zur Glocke per E-Mail informiert werden.</p>
          </div>
          <input
            type="checkbox"
            checked={emailOn}
            onChange={(e) => patch({ email: e.target.checked })}
            className="mt-0.5 size-4 shrink-0 accent-[var(--brand-primary)]"
          />
        </label>

        {/* Frequency */}
        <div className={`border-b border-slate-100 px-4 py-4 ${emailOn ? '' : 'pointer-events-none opacity-40'}`}>
          <p className="mb-2 text-sm font-medium text-slate-800">Häufigkeit</p>
          <div className="space-y-1.5">
            {FREQUENCIES.map((f) => (
              <label key={f.value} className="flex cursor-pointer items-center gap-2.5">
                <input
                  type="radio"
                  name="frequency"
                  checked={prefs.frequency === f.value}
                  onChange={() => patch({ frequency: f.value })}
                  disabled={!emailOn}
                  className="size-4 accent-[var(--brand-primary)]"
                />
                <span className="text-sm text-slate-700">{f.label}</span>
                <span className="text-xs text-slate-400">· {f.hint}</span>
              </label>
            ))}
          </div>
        </div>

        {/* Per-type toggles */}
        <div className={`border-b border-slate-100 px-4 py-4 ${emailOn ? '' : 'pointer-events-none opacity-40'}`}>
          <p className="mb-2 text-sm font-medium text-slate-800">Wobei möchten Sie E-Mails erhalten?</p>
          <div className="space-y-1.5">
            {TYPE_LABELS.map((t) => (
              <label key={t.key} className="flex cursor-pointer items-center gap-2.5">
                <input
                  type="checkbox"
                  checked={prefs.types[t.key] ?? true}
                  onChange={(e) => toggleType(t.key, e.target.checked)}
                  disabled={!emailOn}
                  className="size-4 accent-[var(--brand-primary)]"
                />
                <span className="text-sm text-slate-700">{t.label}</span>
                <span className="text-xs text-slate-400">· {t.hint}</span>
              </label>
            ))}
          </div>
        </div>

        {/* Quiet hours */}
        <div className={`px-4 py-4 ${emailOn ? '' : 'pointer-events-none opacity-40'}`}>
          <label className="flex cursor-pointer items-center gap-2.5">
            <input
              type="checkbox"
              checked={prefs.quietHours !== null}
              onChange={(e) => toggleQuietHours(e.target.checked)}
              disabled={!emailOn}
              className="size-4 accent-[var(--brand-primary)]"
            />
            <span className="text-sm font-medium text-slate-800">Ruhezeiten</span>
            <span className="text-xs text-slate-400">· keine Sofort-E-Mails in diesem Zeitfenster</span>
          </label>
          {prefs.quietHours !== null ? (
            <div className="mt-3 flex items-center gap-2 pl-6 text-sm text-slate-600">
              <span>Von</span>
              <input
                type="time"
                value={prefs.quietHours.start}
                onChange={(e) => patch({ quietHours: { ...prefs.quietHours!, start: e.target.value } })}
                className="rounded-md border border-slate-200 px-2 py-1"
              />
              <span>bis</span>
              <input
                type="time"
                value={prefs.quietHours.end}
                onChange={(e) => patch({ quietHours: { ...prefs.quietHours!, end: e.target.value } })}
                className="rounded-md border border-slate-200 px-2 py-1"
              />
            </div>
          ) : null}
        </div>
      </div>

      <div className="mt-4 flex items-center gap-3">
        <button
          type="button"
          onClick={save}
          disabled={saving}
          className="inline-flex items-center gap-1.5 rounded-md bg-[var(--brand-primary)] px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
        >
          {saving ? 'Speichert…' : 'Speichern'}
        </button>
        {savedAt !== null ? (
          <span className="inline-flex items-center gap-1 text-sm text-slate-500">
            <Check className="size-4 text-[var(--brand-primary)]" /> Gespeichert
          </span>
        ) : null}
      </div>
    </div>
  );
}
