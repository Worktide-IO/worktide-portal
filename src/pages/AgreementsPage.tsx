import { useEffect, useState } from 'react';
import { FileCheck2, FileText, PenLine, Repeat } from 'lucide-react';

import { portalApi, type PortalAgreement, type PortalAgreements, type PortalSubscription } from '@/lib/portal';

const OFFER_STATUSES = new Set(['draft', 'in_negotiation']);

function formatDate(iso: string | null): string | null {
  return iso ? new Date(iso).toLocaleDateString('de-DE', { dateStyle: 'medium' }) : null;
}

function formatPrice(cents: number, currency: string): string {
  try {
    return new Intl.NumberFormat('de-DE', { style: 'currency', currency: currency.toUpperCase() }).format(
      cents / 100,
    );
  } catch {
    return `${(cents / 100).toFixed(2)} ${currency.toUpperCase()}`;
  }
}

function AgreementCard({ a, onChange }: { a: PortalAgreement; onChange: (a: PortalAgreement) => void }) {
  const valid = formatDate(a.validUntil);
  const signed = formatDate(a.signedOn);
  const [signOpen, setSignOpen] = useState(false);
  const [fullName, setFullName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function sign(e: React.FormEvent) {
    e.preventDefault();
    if (!fullName.trim()) return;
    setBusy(true);
    setError(null);
    try {
      onChange(await portalApi.signAgreement(a.id, fullName.trim()));
      setSignOpen(false);
    } catch {
      setError('Signatur fehlgeschlagen.');
      setBusy(false);
    }
  }

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          {a.reference ? <div className="font-mono text-xs text-slate-400">{a.reference}</div> : null}
          <div className="font-medium">{a.type}</div>
        </div>
        <span
          className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-medium ${
            a.isSigned ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-800'
          }`}
        >
          {a.statusLabel}
        </span>
      </div>
      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
        {a.signedBy ? <span>Signiert von {a.signedBy}</span> : signed ? <span>Signiert am {signed}</span> : null}
        {valid ? <span>Gültig bis {valid}</span> : null}
        {a.hasDocument ? (
          <span className="inline-flex items-center gap-1 text-slate-600">
            <FileCheck2 className="size-3.5" /> Dokument hinterlegt
          </span>
        ) : null}
      </div>

      {a.lineItems.length > 0 ? (
        <div className="mt-3 rounded-md border border-slate-100 bg-slate-50/60 p-3">
          <ul className="divide-y divide-slate-100 text-sm">
            {a.lineItems.map((li, i) => (
              <li key={i} className="flex items-baseline justify-between gap-3 py-1.5 first:pt-0 last:pb-0">
                <span className="min-w-0 text-slate-700">
                  {li.quantity !== 1 ? <span className="text-slate-400">{li.quantity}× </span> : null}
                  {li.description}
                </span>
                <span className="shrink-0 tabular-nums text-slate-600">
                  {formatPrice(li.amountCents, a.currency)}
                </span>
              </li>
            ))}
          </ul>
          <div className="mt-2 flex items-baseline justify-between border-t border-slate-200 pt-2 text-sm font-semibold">
            <span>{a.totalIsRecurring ? 'Summe / Monat (netto)' : 'Summe (netto)'}</span>
            <span className="tabular-nums">{formatPrice(a.totalCents, a.currency)}</span>
          </div>
        </div>
      ) : null}

      {a.canSign ? (
        <div className="mt-3">
          {!signOpen ? (
            <button
              type="button"
              onClick={() => setSignOpen(true)}
              className="inline-flex items-center gap-1.5 rounded bg-slate-900 px-3 py-2 text-sm font-medium text-white"
            >
              <PenLine className="size-4" /> Digital signieren
            </button>
          ) : (
            <form onSubmit={sign} className="space-y-2">
              <label className="block text-sm">
                Ihr vollständiger Name (Unterschrift)
                <input
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  autoFocus
                  className="mt-1 w-full max-w-sm rounded border border-slate-300 px-3 py-2 text-sm"
                />
              </label>
              <p className="text-xs text-slate-400">
                Mit dem Signieren nehmen Sie das Angebot verbindlich an.
              </p>
              {error ? <p className="text-sm text-red-600">{error}</p> : null}
              <div className="flex gap-2">
                <button type="submit" disabled={busy || !fullName.trim()} className="rounded bg-slate-900 px-3 py-2 text-sm font-medium text-white disabled:opacity-50">
                  {busy ? 'Signieren…' : 'Verbindlich signieren'}
                </button>
                <button type="button" onClick={() => setSignOpen(false)} className="rounded border border-slate-300 px-3 py-2 text-sm text-slate-600">
                  Abbrechen
                </button>
              </div>
            </form>
          )}
        </div>
      ) : null}
    </div>
  );
}

function SubscriptionCard({ s }: { s: PortalSubscription }) {
  const active = s.status === 'active' || s.status === 'trial';
  const next = formatDate(s.nextBillingOn);
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="font-medium">{s.name}</div>
          {s.description ? <div className="text-xs text-slate-500">{s.description}</div> : null}
        </div>
        <span
          className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-medium ${
            active ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'
          }`}
        >
          {s.statusLabel}
        </span>
      </div>
      <div className="mt-2 flex items-baseline gap-1.5">
        <span className="text-lg font-semibold">{formatPrice(s.priceCents, s.currency)}</span>
        <span className="text-xs text-slate-500">/ {s.billingLabel}</span>
      </div>
      <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-400">
        {s.systemName ? <span>{s.systemName}</span> : null}
        {next ? <span>Nächste Abrechnung {next}</span> : null}
      </div>
    </div>
  );
}

function Section({ icon: Icon, title, children }: { icon: typeof FileText; title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-700">
        <Icon className="size-4 text-slate-400" /> {title}
      </h2>
      <div className="grid gap-3 sm:grid-cols-2">{children}</div>
    </section>
  );
}

export function AgreementsPage() {
  const [data, setData] = useState<PortalAgreements | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    portalApi
      .agreements()
      .then(setData)
      .catch(() => setError('Angebote & Verträge konnten nicht geladen werden.'));
  }, []);

  if (error) return <p className="text-sm text-red-600">{error}</p>;
  if (!data) return <p className="text-sm text-slate-500">Lädt…</p>;

  function replaceAgreement(updated: PortalAgreement) {
    setData((prev) => (prev ? { ...prev, agreements: prev.agreements.map((a) => (a.id === updated.id ? updated : a)) } : prev));
  }

  const offers = data.agreements.filter((a) => OFFER_STATUSES.has(a.status));
  const contracts = data.agreements.filter((a) => !OFFER_STATUSES.has(a.status));
  const projectOffers = data.projectOffers ?? [];
  const empty = data.agreements.length === 0 && data.subscriptions.length === 0 && projectOffers.length === 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Angebote &amp; Verträge</h1>
        <p className="text-sm text-slate-500">Ihre Angebote, Verträge und laufenden Leistungen.</p>
      </div>

      {empty ? <p className="text-sm text-slate-500">Noch nichts hinterlegt.</p> : null}

      {offers.length > 0 ? (
        <Section icon={FileText} title={`Angebote (${offers.length})`}>
          {offers.map((a) => (
            <AgreementCard key={a.id} a={a} onChange={replaceAgreement} />
          ))}
        </Section>
      ) : null}

      {contracts.length > 0 ? (
        <Section icon={FileCheck2} title={`Verträge (${contracts.length})`}>
          {contracts.map((a) => (
            <AgreementCard key={a.id} a={a} onChange={replaceAgreement} />
          ))}
        </Section>
      ) : null}

      {projectOffers.length > 0 ? (
        <Section icon={FileText} title="Angebote aus Vorschlägen">
          {projectOffers.map((o) => (
            <div key={o.id} className="rounded-lg border border-slate-200 bg-white p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="font-mono text-xs text-slate-400">{o.reference}</div>
                  <div className="font-medium">{o.title}</div>
                </div>
                <span className="shrink-0 rounded-full bg-amber-100 px-2.5 py-1 text-xs font-medium text-amber-800">
                  {o.statusLabel}
                </span>
              </div>
              <div className="mt-2 text-lg font-semibold">{formatPrice(o.amountCents, o.currency)}</div>
            </div>
          ))}
        </Section>
      ) : null}

      {data.subscriptions.length > 0 ? (
        <Section icon={Repeat} title="Laufende Leistungen">
          {data.subscriptions.map((s) => (
            <SubscriptionCard key={s.id} s={s} />
          ))}
        </Section>
      ) : null}

      <p className="pt-1 text-xs text-slate-400">
        Rechnungen folgen in einem späteren Schritt.
      </p>
    </div>
  );
}
