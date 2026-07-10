import { useEffect, useMemo, useState } from 'react';
import { Check, MessageCircle, Sparkles, X } from 'lucide-react';

import { portalApi, type PortalProposal } from '@/lib/portal';
import { safeUrl } from '@/lib/safeUrl';

const TABS: { key: string; label: string }[] = [
  { key: 'new', label: 'Neu' },
  { key: 'in_review', label: 'In Prüfung' },
  { key: 'accepted', label: 'Angenommen' },
  { key: 'rejected', label: 'Abgelehnt' },
];

function formatPrice(cents: number | null | undefined, currency: string): string | null {
  if (cents === null || cents === undefined) return null;
  try {
    return new Intl.NumberFormat('de-DE', { style: 'currency', currency: currency.toUpperCase() }).format(cents / 100);
  } catch {
    return `${(cents / 100).toFixed(2)} ${currency.toUpperCase()}`;
  }
}

export function ProposalsPage() {
  const [proposals, setProposals] = useState<PortalProposal[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState('new');
  const [project, setProject] = useState('__all__');

  useEffect(() => {
    portalApi.proposals().then(setProposals).catch(() => setError('Vorschläge konnten nicht geladen werden.'));
  }, []);

  const projects = useMemo(
    () => [...new Set((proposals ?? []).map((p) => p.projectName))].sort(),
    [proposals],
  );

  // Proposals in the selected project (drives both the tab counts and the list).
  const inProject = (proposals ?? []).filter((p) => project === '__all__' || p.projectName === project);

  const counts = useMemo(() => {
    const c: Record<string, number> = {};
    for (const p of inProject) c[p.status] = (c[p.status] ?? 0) + 1;
    return c;
  }, [inProject]);

  function replace(updated: PortalProposal) {
    setProposals((prev) => (prev ?? []).map((p) => (p.id === updated.id ? updated : p)));
  }

  const visible = inProject.filter((p) => p.status === tab);

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">Vorschläge</h1>
          <p className="text-sm text-slate-500">Ideen zu Ihren Projekten – ansehen, vergleichen und entscheiden.</p>
        </div>
        {projects.length > 1 ? (
          <select
            value={project}
            onChange={(e) => setProject(e.target.value)}
            className="shrink-0 rounded border border-slate-300 bg-white px-3 py-2 text-sm"
            aria-label="Projekt wechseln"
          >
            <option value="__all__">Alle Projekte</option>
            {projects.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        ) : null}
      </div>

      {error ? <p className="text-sm text-red-600">{error}</p> : null}

      <div className="flex flex-wrap gap-1 border-b border-slate-200">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            className={`-mb-px border-b-2 px-3 py-2 text-sm ${
              tab === t.key ? 'border-slate-900 font-medium text-slate-900' : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            {t.label}
            {counts[t.key] ? <span className="ml-1.5 text-xs text-slate-400">{counts[t.key]}</span> : null}
          </button>
        ))}
      </div>

      {proposals && visible.length === 0 ? (
        <p className="text-sm text-slate-500">Keine Vorschläge in dieser Ansicht.</p>
      ) : null}

      <div className="space-y-4">
        {visible.map((p) => (
          <ProposalCard key={p.id} proposal={p} onChange={replace} />
        ))}
      </div>
    </div>
  );
}

// Before/after mockup images ("Vorher/Nachher"). Agency-hosted URLs; each is
// optional. A broken/unreachable image quietly removes itself so the card
// never shows a broken-image icon.
function MockupImage({ url, label }: { url: string; label: string }) {
  const [broken, setBroken] = useState(false);
  const safe = safeUrl(url);
  if (broken || !safe) return null;
  return (
    <figure className="min-w-0 space-y-1">
      <figcaption className="text-xs font-medium uppercase tracking-wide text-slate-400">{label}</figcaption>
      <a href={safe} target="_blank" rel="noreferrer" className="block overflow-hidden rounded-lg border border-slate-200">
        <img
          src={safe}
          alt={label}
          loading="lazy"
          onError={() => setBroken(true)}
          className="h-40 w-full bg-slate-50 object-cover transition hover:opacity-90"
        />
      </a>
    </figure>
  );
}

function MockupCompare({ beforeUrl, afterUrl }: { beforeUrl: string | null; afterUrl: string | null }) {
  if (!beforeUrl && !afterUrl) return null;
  return (
    <div className="mt-4 space-y-2">
      <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">Mockup</div>
      <div className="grid gap-3 sm:grid-cols-2">
        {beforeUrl ? <MockupImage url={beforeUrl} label="Vorher" /> : null}
        {afterUrl ? <MockupImage url={afterUrl} label="Nachher" /> : null}
      </div>
    </div>
  );
}

function ProposalCard({ proposal: p, onChange }: { proposal: PortalProposal; onChange: (p: PortalProposal) => void }) {
  const [variant, setVariant] = useState<number | undefined>(undefined);
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [feedback, setFeedback] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const decided = p.status === 'accepted' || p.status === 'rejected';

  // Resolves true iff the action succeeded, so form callers only clear/close on
  // success. A failure surfaces an inline message instead of silently vanishing.
  async function run(fn: () => Promise<PortalProposal>): Promise<boolean> {
    setBusy(true);
    setError(null);
    try {
      onChange(await fn());
      return true;
    } catch {
      setError('Aktion fehlgeschlagen. Bitte erneut versuchen.');
      return false;
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-xs text-slate-400">
            {p.origin === 'ai' ? <Sparkles className="size-3.5" /> : null}
            <span>{p.originLabel}</span>
            <span>·</span>
            <span>{p.projectName}</span>
          </div>
          <h2 className="mt-0.5 font-semibold">{p.title}</h2>
        </div>
        <span className="shrink-0 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600">{p.statusLabel}</span>
      </div>

      {p.rationale ? <p className="mt-3 text-sm text-slate-700">{p.rationale}</p> : null}
      {p.expectedBenefit ? (
        <p className="mt-2 text-sm text-slate-600">
          <span className="font-medium text-slate-700">Erwarteter Nutzen: </span>
          {p.expectedBenefit}
        </p>
      ) : null}

      <div className="mt-3 flex flex-wrap gap-2 text-xs text-slate-500">
        {p.effortHours !== null ? <span className="rounded bg-slate-100 px-2 py-0.5">~ {p.effortHours} Std.</span> : null}
        {formatPrice(p.costCents, p.currency) ? (
          <span className="rounded bg-slate-100 px-2 py-0.5">{formatPrice(p.costCents, p.currency)}</span>
        ) : null}
        {p.timeframeText ? <span className="rounded bg-slate-100 px-2 py-0.5">{p.timeframeText}</span> : null}
      </div>

      <MockupCompare beforeUrl={p.mockupBeforeUrl} afterUrl={p.mockupAfterUrl} />

      {p.variants.length > 0 && !decided ? (
        <div className="mt-4 space-y-2">
          <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">Varianten vergleichen</div>
          <div className="grid gap-2 sm:grid-cols-2">
            {p.variants.map((v, i) => (
              <button
                key={i}
                type="button"
                onClick={() => setVariant(i)}
                className={`rounded-lg border p-3 text-left text-sm transition ${
                  variant === i ? 'border-slate-900 ring-1 ring-slate-900' : 'border-slate-200 hover:border-slate-400'
                }`}
              >
                <div className="font-medium">{v.label}</div>
                <div className="mt-1 text-xs text-slate-500">
                  {[v.effortHours ? `${v.effortHours} Std.` : null, formatPrice(v.costCents, p.currency)].filter(Boolean).join(' · ')}
                </div>
              </button>
            ))}
          </div>
        </div>
      ) : null}

      {p.customerFeedback ? (
        <p className="mt-3 rounded-md bg-slate-50 px-3 py-2 text-sm text-slate-600">
          <span className="font-medium">Ihre Rückfrage: </span>
          {p.customerFeedback}
        </p>
      ) : null}

      {p.ticketIdentifier || p.offerReference ? (
        <p className="mt-3 text-sm text-green-700">
          Angenommen →{p.offerReference ? ` Angebot ${p.offerReference}` : ''}
          {p.ticketIdentifier && p.offerReference ? ' ·' : ''}
          {p.ticketIdentifier ? ` Ticket ${p.ticketIdentifier}` : ''} angelegt.
        </p>
      ) : null}

      {!decided ? (
        <div className="mt-4 space-y-2">
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={busy}
              onClick={() => run(() => portalApi.acceptProposal(p.id, variant))}
              className="inline-flex items-center gap-1.5 rounded bg-[var(--brand-primary)] px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
            >
              <Check className="size-4" /> Annehmen
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => setFeedbackOpen((o) => !o)}
              className="inline-flex items-center gap-1.5 rounded border border-slate-300 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
            >
              <MessageCircle className="size-4" /> Rückfrage
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => run(() => portalApi.rejectProposal(p.id))}
              className="inline-flex items-center gap-1.5 rounded border border-slate-300 px-3 py-2 text-sm text-slate-600 hover:bg-slate-50"
            >
              <X className="size-4" /> Ablehnen
            </button>
          </div>

          {error ? <p className="text-sm text-red-600">{error}</p> : null}

          {feedbackOpen ? (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (!feedback.trim()) return;
                run(() => portalApi.sendProposalFeedback(p.id, feedback.trim())).then((ok) => {
                  if (!ok) return;
                  setFeedback('');
                  setFeedbackOpen(false);
                });
              }}
              className="flex gap-2"
            >
              <input
                value={feedback}
                onChange={(e) => setFeedback(e.target.value)}
                placeholder="Ihre Rückfrage…"
                className="flex-1 rounded border border-slate-300 px-3 py-2 text-sm"
              />
              <button type="submit" disabled={busy || !feedback.trim()} className="rounded bg-[var(--brand-primary)] px-3 py-2 text-sm font-medium text-white disabled:opacity-50">
                Senden
              </button>
            </form>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
