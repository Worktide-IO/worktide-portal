import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Bell, Check, Mail, MessageSquare } from 'lucide-react';

import {
  portalApi,
  type ChatProvider,
  type ChatWebhookStatus,
  type NotificationChannelPrefs,
  type NotificationFrequency,
} from '@/lib/portal';

// Human labels for the notification types the backend knows about, in the
// order we want them shown. Keys mirror the NotificationType enum.
// Labels/hints live in the i18n catalog under settings.notif_type.<key>.* and
// settings.frequency.<value>.* — resolved at render.
const TYPE_LABELS: { key: string }[] = [
  { key: 'comment' },
  { key: 'task_assigned' },
  { key: 'mention' },
  { key: 'system' },
  { key: 'launch' },
  { key: 'ai' },
];

const FREQUENCIES: { value: NotificationFrequency }[] = [
  { value: 'instant' },
  { value: 'daily' },
  { value: 'weekly' },
];

/** Portal Einstellungen — notification delivery preferences (email channel). */
export function SettingsPage() {
  const { t } = useTranslation();
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

        {/* Chat channel master switch (webhook configured below) */}
        <label className="flex cursor-pointer items-start gap-3 border-b border-slate-100 px-4 py-4">
          <MessageSquare className="mt-0.5 size-5 shrink-0 text-slate-400" />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-slate-800">Chat-Benachrichtigungen</p>
            <p className="text-xs text-slate-500">
              Zusätzlich per Slack, Mattermost oder Teams. Verbindung unten einrichten.
            </p>
          </div>
          <input
            type="checkbox"
            checked={prefs.chat}
            onChange={(e) => patch({ chat: e.target.checked })}
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
                <span className="text-sm text-slate-700">{t(`settings.frequency.${f.value}.label`)}</span>
                <span className="text-xs text-slate-400">· {t(`settings.frequency.${f.value}.hint`)}</span>
              </label>
            ))}
          </div>
        </div>

        {/* Per-type toggles */}
        <div className={`border-b border-slate-100 px-4 py-4 ${emailOn ? '' : 'pointer-events-none opacity-40'}`}>
          <p className="mb-2 text-sm font-medium text-slate-800">Wobei möchten Sie E-Mails erhalten?</p>
          <div className="space-y-1.5">
            {TYPE_LABELS.map((item) => (
              <label key={item.key} className="flex cursor-pointer items-center gap-2.5">
                <input
                  type="checkbox"
                  checked={prefs.types[item.key] ?? true}
                  onChange={(e) => toggleType(item.key, e.target.checked)}
                  disabled={!emailOn}
                  className="size-4 accent-[var(--brand-primary)]"
                />
                <span className="text-sm text-slate-700">{t(`settings.notif_type.${item.key}.label`)}</span>
                <span className="text-xs text-slate-400">· {t(`settings.notif_type.${item.key}.hint`)}</span>
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

      <ChatWebhookCard />
    </div>
  );
}

const CHAT_PROVIDERS: { value: ChatProvider; label: string }[] = [
  { value: 'slack', label: 'Slack' },
  { value: 'mattermost', label: 'Mattermost' },
  { value: 'teams', label: 'Microsoft Teams' },
];

/**
 * Chat-webhook setup — the destination for chat notifications. The URL is
 * write-only (the server only reports whether one is configured); "Test senden"
 * posts a live message so the user can confirm the connection.
 */
function ChatWebhookCard() {
  const [status, setStatus] = useState<ChatWebhookStatus | null>(null);
  const [provider, setProvider] = useState<ChatProvider>('slack');
  const [url, setUrl] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    portalApi
      .chatWebhook()
      .then((s) => {
        setStatus(s);
        if (s.provider) setProvider(s.provider);
      })
      .catch(() => setStatus({ provider: null, enabled: false, configured: false }));
  }, []);

  function saveWebhook() {
    if (!url.trim()) return;
    setBusy(true);
    setMsg(null);
    portalApi
      .saveChatWebhook({ provider, url: url.trim(), enabled: true })
      .then((s) => {
        setStatus(s);
        setUrl('');
        setMsg('Verbindung gespeichert.');
      })
      .catch(() => setMsg('Ungültige oder unsichere URL.'))
      .finally(() => setBusy(false));
  }

  function test() {
    setBusy(true);
    setMsg(null);
    portalApi
      .testChatWebhook()
      .then((r) => setMsg(r.sent ? 'Testnachricht gesendet ✓' : 'Senden fehlgeschlagen (Versand aktiviert?).'))
      .catch(() => setMsg('Senden fehlgeschlagen.'))
      .finally(() => setBusy(false));
  }

  function remove() {
    setBusy(true);
    portalApi
      .deleteChatWebhook()
      .then(() => {
        setStatus({ provider: null, enabled: false, configured: false });
        setMsg(null);
      })
      .finally(() => setBusy(false));
  }

  if (!status) return null;

  return (
    <div className="mt-6 rounded-lg border border-slate-200 bg-white p-4">
      <div className="mb-3 flex items-center gap-2">
        <MessageSquare className="size-5 text-slate-400" />
        <h2 className="text-sm font-semibold text-slate-800">Chat-Verbindung</h2>
      </div>

      {status.configured ? (
        <div className="mb-3 flex flex-wrap items-center gap-2 text-sm text-slate-600">
          <span className="rounded bg-slate-100 px-2 py-0.5 text-xs">
            {CHAT_PROVIDERS.find((p) => p.value === status.provider)?.label ?? status.provider} · eingerichtet
          </span>
          <button type="button" onClick={test} disabled={busy} className="rounded-md border border-slate-300 px-3 py-1 text-xs font-medium hover:bg-slate-50 disabled:opacity-50">
            Test senden
          </button>
          <button type="button" onClick={remove} disabled={busy} className="rounded-md border border-red-200 px-3 py-1 text-xs font-medium text-red-700 hover:bg-red-50 disabled:opacity-50">
            Entfernen
          </button>
        </div>
      ) : null}

      <div className="flex flex-wrap items-end gap-2">
        <div className="space-y-1">
          <label className="block text-xs font-medium text-slate-600">Dienst</label>
          <select value={provider} onChange={(e) => setProvider(e.target.value as ChatProvider)} className="rounded-md border border-slate-300 px-2 py-2 text-sm">
            {CHAT_PROVIDERS.map((p) => (
              <option key={p.value} value={p.value}>
                {p.label}
              </option>
            ))}
          </select>
        </div>
        <div className="min-w-56 grow space-y-1">
          <label className="block text-xs font-medium text-slate-600">
            Incoming-Webhook-URL {status.configured ? '(neu setzen)' : ''}
          </label>
          <input
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://hooks.slack.com/services/…"
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
          />
        </div>
        <button type="button" onClick={saveWebhook} disabled={busy || !url.trim()} className="rounded-md bg-[var(--brand-primary)] px-4 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50">
          Speichern
        </button>
      </div>
      {msg ? <p className="mt-2 text-xs text-slate-500">{msg}</p> : null}
    </div>
  );
}
