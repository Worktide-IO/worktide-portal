import { useEffect, useMemo, useState } from 'react';
import { intlLocale } from '@/lib/intl';
import { Check, MessageCircle, Sparkles, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { portalApi, type PortalProposal } from '@/lib/portal';
import { safeUrl } from '@/lib/safeUrl';

const TABS: { key: string; labelKey: string }[] = [
  { key: 'new', labelKey: 'proposals.tab_new' },
  { key: 'in_review', labelKey: 'proposals.tab_in_review' },
  { key: 'accepted', labelKey: 'proposals.tab_accepted' },
  { key: 'rejected', labelKey: 'proposals.tab_rejected' },
];

function formatPrice(cents: number | null | undefined, currency: string): string | null {
  if (cents === null || cents === undefined) return null;
  try {
    return new Intl.NumberFormat(intlLocale(), { style: 'currency', currency: currency.toUpperCase() }).format(cents / 100);
  } catch {
    return `${(cents / 100).toFixed(2)} ${currency.toUpperCase()}`;
  }
}

export function ProposalsPage() {
  const { t: translate } = useTranslation();
  const [proposals, setProposals] = useState<PortalProposal[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState('new');
  const [project, setProject] = useState('__all__');

  useEffect(() => {
    portalApi.proposals().then(setProposals).catch(() => setError(translate('proposals.load_error')));
  }, [translate]);

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
          <h1 className="text-xl font-semibold">{translate('proposals.title')}</h1>
          <p className="text-sm text-slate-500">{translate('proposals.subtitle')}</p>
        </div>
        {projects.length > 1 ? (
          <select
            value={project}
            onChange={(e) => setProject(e.target.value)}
            className="shrink-0 rounded border border-slate-300 bg-white px-3 py-2 text-sm"
            aria-label={translate('proposals.switch_project')}
          >
            <option value="__all__">{translate('proposals.all_projects')}</option>
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
            {translate(t.labelKey)}
            {counts[t.key] ? <span className="ml-1.5 text-xs text-slate-400">{counts[t.key]}</span> : null}
          </button>
        ))}
      </div>

      {proposals && visible.length === 0 ? (
        <p className="text-sm text-slate-500">{translate('proposals.empty')}</p>
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
  const { t } = useTranslation();
  if (!beforeUrl && !afterUrl) return null;
  return (
    <div className="mt-4 space-y-2">
      <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">{t('proposals.mockup')}</div>
      <div className="grid gap-3 sm:grid-cols-2">
        {beforeUrl ? <MockupImage url={beforeUrl} label={t('proposals.before')} /> : null}
        {afterUrl ? <MockupImage url={afterUrl} label={t('proposals.after')} /> : null}
      </div>
    </div>
  );
}

function ProposalCard({ proposal: p, onChange }: { proposal: PortalProposal; onChange: (p: PortalProposal) => void }) {
  const { t } = useTranslation();
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
      setError(t('proposals.action_failed'));
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
          <span className="font-medium text-slate-700">{t('proposals.expected_benefit')} </span>
          {p.expectedBenefit}
        </p>
      ) : null}

      <div className="mt-3 flex flex-wrap gap-2 text-xs text-slate-500">
        {p.effortHours !== null ? <span className="rounded bg-slate-100 px-2 py-0.5">{t('proposals.effort_hours', { hours: p.effortHours })}</span> : null}
        {formatPrice(p.costCents, p.currency) ? (
          <span className="rounded bg-slate-100 px-2 py-0.5">{formatPrice(p.costCents, p.currency)}</span>
        ) : null}
        {p.timeframeText ? <span className="rounded bg-slate-100 px-2 py-0.5">{p.timeframeText}</span> : null}
      </div>

      <MockupCompare beforeUrl={p.mockupBeforeUrl} afterUrl={p.mockupAfterUrl} />

      {p.variants.length > 0 && !decided ? (
        <div className="mt-4 space-y-2">
          <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">{t('proposals.compare_variants')}</div>
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
                  {[v.effortHours ? t('proposals.variant_hours', { hours: v.effortHours }) : null, formatPrice(v.costCents, p.currency)].filter(Boolean).join(' · ')}
                </div>
              </button>
            ))}
          </div>
        </div>
      ) : null}

      {p.customerFeedback ? (
        <p className="mt-3 rounded-md bg-slate-50 px-3 py-2 text-sm text-slate-600">
          <span className="font-medium">{t('proposals.your_query')} </span>
          {p.customerFeedback}
        </p>
      ) : null}

      {p.ticketIdentifier || p.offerReference ? (
        <p className="mt-3 text-sm text-green-700">
          {t('proposals.accepted_prefix')}
          {p.offerReference ? t('proposals.accepted_offer', { ref: p.offerReference }) : ''}
          {p.ticketIdentifier && p.offerReference ? ' ·' : ''}
          {p.ticketIdentifier ? t('proposals.accepted_ticket', { id: p.ticketIdentifier }) : ''}
          {t('proposals.accepted_suffix')}
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
              <Check className="size-4" /> {t('proposals.accept')}
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => setFeedbackOpen((o) => !o)}
              className="inline-flex items-center gap-1.5 rounded border border-slate-300 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
            >
              <MessageCircle className="size-4" /> {t('proposals.query')}
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => run(() => portalApi.rejectProposal(p.id))}
              className="inline-flex items-center gap-1.5 rounded border border-slate-300 px-3 py-2 text-sm text-slate-600 hover:bg-slate-50"
            >
              <X className="size-4" /> {t('proposals.reject')}
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
                placeholder={t('proposals.query_placeholder')}
                className="flex-1 rounded border border-slate-300 px-3 py-2 text-sm"
              />
              <button type="submit" disabled={busy || !feedback.trim()} className="rounded bg-[var(--brand-primary)] px-3 py-2 text-sm font-medium text-white disabled:opacity-50">
                {t('proposals.send')}
              </button>
            </form>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
