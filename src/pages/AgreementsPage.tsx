import { useEffect, useState } from 'react';
import { FileCheck2, FileText, Repeat } from 'lucide-react';

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

function AgreementCard({ a }: { a: PortalAgreement }) {
  const valid = formatDate(a.validUntil);
  const signed = formatDate(a.signedOn);
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
        {signed ? <span>Signiert am {signed}</span> : null}
        {valid ? <span>Gültig bis {valid}</span> : null}
        {a.hasDocument ? (
          <span className="inline-flex items-center gap-1 text-slate-600">
            <FileCheck2 className="size-3.5" /> Dokument hinterlegt
          </span>
        ) : null}
      </div>
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

  const offers = data.agreements.filter((a) => OFFER_STATUSES.has(a.status));
  const contracts = data.agreements.filter((a) => !OFFER_STATUSES.has(a.status));
  const empty = data.agreements.length === 0 && data.subscriptions.length === 0;

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
            <AgreementCard key={a.id} a={a} />
          ))}
        </Section>
      ) : null}

      {contracts.length > 0 ? (
        <Section icon={FileCheck2} title={`Verträge (${contracts.length})`}>
          {contracts.map((a) => (
            <AgreementCard key={a.id} a={a} />
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
        Digitale Freigabe/Signatur, Positionsdetails und Rechnungen folgen in einem späteren Schritt.
      </p>
    </div>
  );
}
