import { useEffect, useState } from 'react';
import { Mail } from 'lucide-react';
import { DynamicIcon } from 'lucide-react/dynamic';
import { useTranslation } from 'react-i18next';

import { portalApi, type PortalNewsletterNode } from '@/lib/portal';
import { useLocalize } from '@/lib/localize';

/**
 * Portal newsletter subscriptions — the customer's granted newsletter tree with
 * an opt-in checkbox per subscribable node. Toggling writes immediately
 * (optimistic, reverted on error). Non-subscribable nodes render as group
 * headers that only give the tree its shape.
 */
export function NewslettersPage() {
  const { t } = useTranslation();
  const [tree, setTree] = useState<PortalNewsletterNode[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<Record<string, boolean>>({});

  useEffect(() => {
    portalApi
      .newsletters()
      .then(setTree)
      .finally(() => setLoading(false));
  }, []);

  // Immutably flip `subscribed` for one node id anywhere in the tree.
  function setSubscribed(nodes: PortalNewsletterNode[], id: string, value: boolean): PortalNewsletterNode[] {
    return nodes.map((n) => {
      if (n.id === id) return { ...n, subscribed: value };
      if (n.children.length) return { ...n, children: setSubscribed(n.children, id, value) };
      return n;
    });
  }

  function toggle(node: PortalNewsletterNode) {
    if (busy[node.id]) return;
    const next = !node.subscribed;
    setBusy((b) => ({ ...b, [node.id]: true }));
    setTree((t) => (t ? setSubscribed(t, node.id, next) : t)); // optimistic
    const call = next ? portalApi.subscribeNewsletter(node.id) : portalApi.unsubscribeNewsletter(node.id);
    call
      .catch(() => setTree((t) => (t ? setSubscribed(t, node.id, !next) : t))) // revert
      .finally(() => setBusy((b) => ({ ...b, [node.id]: false })));
  }

  const empty = !loading && (tree === null || tree.length === 0);

  return (
    <div className="mx-auto w-full max-w-2xl">
      <div className="mb-4">
        <h1 className="text-xl font-semibold text-slate-900">{t('newsletters.title')}</h1>
        <p className="text-sm text-slate-500">{t('newsletters.subtitle')}</p>
      </div>

      {loading ? (
        <p className="text-sm text-slate-500">{t('app.loading')}</p>
      ) : empty ? (
        <div className="rounded-lg border border-dashed border-slate-200 py-16 text-center text-sm text-slate-500">
          <Mail className="mx-auto mb-2 size-6 opacity-40" />
          {t('newsletters.empty')}
        </div>
      ) : (
        <>
          <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
            {tree!.map((node, i) => (
              <NewsletterRow key={node.id} node={node} depth={0} busy={busy} onToggle={toggle} first={i === 0} />
            ))}
          </div>
          <p className="mt-3 text-xs text-slate-400">{t('newsletters.consent_notice')}</p>
        </>
      )}
    </div>
  );
}

function NewsletterRow({
  node,
  depth,
  busy,
  onToggle,
  first,
}: {
  node: PortalNewsletterNode;
  depth: number;
  busy: Record<string, boolean>;
  onToggle: (n: PortalNewsletterNode) => void;
  first: boolean;
}) {
  const localize = useLocalize();
  const pad = { paddingLeft: 16 + depth * 20 };
  return (
    <>
      {node.subscribable ? (
        <label
          className={`flex cursor-pointer items-start gap-3 px-4 py-3 hover:bg-slate-50 ${first ? '' : 'border-t border-slate-100'}`}
          style={pad}
        >
          <input
            type="checkbox"
            checked={node.subscribed}
            disabled={busy[node.id]}
            onChange={() => onToggle(node)}
            className="mt-0.5 size-4 shrink-0 accent-[var(--brand-primary)]"
          />
          <span className="min-w-0 flex-1">
            <span className="flex items-center gap-2">
              <DynamicIcon
                name={(node.icon || 'mail') as Parameters<typeof DynamicIcon>[0]['name']}
                className="size-4 shrink-0"
                style={{ color: node.color || '#94a3b8' }}
              />
              <span className="text-sm font-medium text-slate-800">{localize(node, 'title')}</span>
              {node.estimatedFrequencyLabel ? (
                <span className="shrink-0 rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-500">
                  {node.estimatedFrequencyLabel}
                </span>
              ) : null}
            </span>
            {node.description ? <span className="mt-0.5 block text-xs text-slate-500">{localize(node, 'description')}</span> : null}
          </span>
        </label>
      ) : (
        <div
          className={`px-4 pb-1 pt-3 text-xs font-semibold uppercase tracking-wide text-slate-400 ${first ? '' : 'border-t border-slate-100'}`}
          style={pad}
        >
          {localize(node, 'title')}
        </div>
      )}
      {node.children.map((child) => (
        <NewsletterRow key={child.id} node={child} depth={depth + 1} busy={busy} onToggle={onToggle} first={false} />
      ))}
    </>
  );
}
