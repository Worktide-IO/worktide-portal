import { useCallback, useEffect, useState } from 'react';
import type { TFunction } from 'i18next';
import { useTranslation } from 'react-i18next';
import { Loader2, MessagesSquare, Plus, Send, X } from 'lucide-react';

import {
  portalApi,
  type FeedbackAuthorLabel,
  type FeedbackDetail,
  type FeedbackTicket,
} from '@/lib/portal';
import { openFeedback } from '@/components/feedback/FeedbackWidget';

const CATEGORY_KEYS = ['bug', 'feature', 'ui_ux'] as const;
const STATUS_KEYS = ['new', 'triaged', 'planned', 'in_progress', 'done', 'declined'] as const;

export function FeedbackPage() {
  const { t } = useTranslation();
  const [tickets, setTickets] = useState<FeedbackTicket[]>([]);
  const [loading, setLoading] = useState(true);
  const [category, setCategory] = useState('');
  const [status, setStatus] = useState('');
  const [selected, setSelected] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    portalApi
      .listFeedback({ category: category || undefined, status: status || undefined })
      .then(setTickets)
      .catch(() => undefined)
      .finally(() => setLoading(false));
  }, [category, status]);

  useEffect(() => {
    load();
  }, [load]);

  // Refresh when a report is filed via the global widget while viewing the board.
  useEffect(() => {
    const onSubmitted = () => load();
    window.addEventListener('wt-feedback-submitted', onSubmitted);
    return () => window.removeEventListener('wt-feedback-submitted', onSubmitted);
  }, [load]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-semibold">
            <MessagesSquare className="size-5" /> {t('feedback.board_title')}
          </h1>
          <p className="text-sm text-slate-500">{t('feedback.board_subtitle')}</p>
        </div>
        <button
          type="button"
          onClick={() => openFeedback()}
          className="inline-flex items-center gap-1.5 rounded-md bg-[var(--brand-primary)] px-3 py-2 text-sm font-medium text-white"
        >
          <Plus className="size-4" /> {t('feedback.new')}
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Chip label={t('feedback.filter_all')} active={category === ''} onClick={() => setCategory('')} />
        {CATEGORY_KEYS.map((k) => (
          <Chip key={k} label={t(`feedback.category.${k}`)} active={category === k} onClick={() => setCategory(k)} />
        ))}
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="ml-1 rounded-md border border-slate-200 bg-white px-2 py-1 text-sm text-slate-600"
        >
          <option value="">{t('feedback.filter_any_status')}</option>
          {STATUS_KEYS.map((k) => (
            <option key={k} value={k}>
              {t(`feedback.status.${k}`)}
            </option>
          ))}
        </select>
      </div>

      {loading ? (
        <div className="flex justify-center py-16 text-slate-400">
          <Loader2 className="size-6 animate-spin" />
        </div>
      ) : tickets.length === 0 ? (
        <div className="rounded-lg border border-dashed border-slate-200 py-16 text-center text-sm text-slate-500">
          {t('feedback.empty')}
        </div>
      ) : (
        <ul className="space-y-2">
          {tickets.map((ticket) => (
            <li key={ticket.id}>
              <button
                type="button"
                onClick={() => setSelected(ticket.id)}
                className="flex w-full items-center gap-3 rounded-lg border border-slate-200 bg-white p-3 text-left hover:bg-slate-50"
              >
                <span aria-hidden className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: ticket.category.color ?? '#94a3b8' }} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="truncate font-medium">{ticket.title}</span>
                    {ticket.isMine && (
                      <span className="shrink-0 rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-500">{t('feedback.author.you')}</span>
                    )}
                  </div>
                  <div className="mt-0.5 flex items-center gap-2 text-xs text-slate-500">
                    <span>{categoryLabel(ticket.category, t)}</span>
                    <span>·</span>
                    <span>{authorText(ticket.authorLabel, t)}</span>
                    {ticket.replyCount > 0 && (
                      <>
                        <span>·</span>
                        <span className="inline-flex items-center gap-1">
                          <MessagesSquare className="size-3" /> {ticket.replyCount}
                        </span>
                      </>
                    )}
                  </div>
                </div>
                <StatusBadge status={ticket.status} />
              </button>
            </li>
          ))}
        </ul>
      )}

      {selected && <DetailModal id={selected} onClose={() => setSelected(null)} onReplied={load} />}
    </div>
  );
}

function Chip({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full border px-3 py-1 text-xs ${active ? 'border-[var(--brand-primary)] bg-[var(--brand-primary)]/10 text-slate-900' : 'border-slate-200 text-slate-500 hover:bg-slate-50'}`}
    >
      {label}
    </button>
  );
}

function StatusBadge({ status }: { status: FeedbackTicket['status'] }) {
  const { t } = useTranslation();
  return (
    <span className={`shrink-0 rounded px-2 py-0.5 text-xs ${status.isCompleted ? 'bg-slate-100 text-slate-500' : 'bg-sky-50 text-sky-700'}`}>
      {statusLabel(status, t)}
    </span>
  );
}

function DetailModal({ id, onClose, onReplied }: { id: string; onClose: () => void; onReplied: () => void }) {
  const { t } = useTranslation();
  const [detail, setDetail] = useState<FeedbackDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [reply, setReply] = useState('');
  const [sending, setSending] = useState(false);

  useEffect(() => {
    setLoading(true);
    portalApi
      .feedbackDetail(id)
      .then(setDetail)
      .catch(() => undefined)
      .finally(() => setLoading(false));
  }, [id]);

  const sendReply = async () => {
    const content = reply.trim();
    if (!content || sending) return;
    setSending(true);
    try {
      const created = await portalApi.replyFeedback(id, content);
      setDetail((prev) => (prev ? { ...prev, replies: [...prev.replies, created] } : prev));
      setReply('');
      onReplied();
    } catch {
      /* ignore */
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[90] flex items-start justify-center overflow-auto bg-black/40 p-4 sm:items-center" onClick={onClose}>
      <div className="flex max-h-[85vh] w-full max-w-lg flex-col rounded-lg bg-white p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
        {loading || !detail ? (
          <div className="flex justify-center py-16 text-slate-400">
            <Loader2 className="size-6 animate-spin" />
          </div>
        ) : (
          <>
            <div className="mb-2 flex items-start justify-between gap-3">
              <h2 className="text-lg font-semibold">{detail.ticket.title}</h2>
              <button type="button" onClick={onClose} aria-label={t('action.cancel')} className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700">
                <X className="size-5" />
              </button>
            </div>
            <div className="mb-3 flex flex-wrap items-center gap-2 text-xs text-slate-500">
              <span>{categoryLabel(detail.ticket.category, t)}</span>
              <span>·</span>
              <span>{statusLabel(detail.ticket.status, t)}</span>
              <span>·</span>
              <span>{authorText(detail.ticket.authorLabel, t)}</span>
            </div>

            <div className="min-h-0 flex-1 space-y-4 overflow-auto">
              {detail.ticket.description && <p className="whitespace-pre-wrap text-sm text-slate-700">{detail.ticket.description}</p>}
              <div className="space-y-3 border-t border-slate-100 pt-3">
                <h3 className="text-xs font-medium uppercase text-slate-400">
                  {t('feedback.replies')} ({detail.replies.length})
                </h3>
                {detail.replies.length === 0 && <p className="text-sm text-slate-500">{t('feedback.no_replies')}</p>}
                {detail.replies.map((r) => (
                  <div key={r.id} className="rounded-md bg-slate-50 p-2.5 text-sm">
                    <div className="mb-1 text-xs font-medium text-slate-500">{authorText(r.authorLabel, t)}</div>
                    <p className="whitespace-pre-wrap">{r.content}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-3 space-y-2 border-t border-slate-100 pt-3">
              <textarea
                value={reply}
                onChange={(e) => setReply(e.target.value)}
                placeholder={t('feedback.reply_placeholder')}
                rows={2}
                className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm focus:border-[var(--brand-primary)] focus:outline-none"
              />
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={sendReply}
                  disabled={sending || !reply.trim()}
                  className="inline-flex items-center gap-1.5 rounded-md bg-[var(--brand-primary)] px-3 py-1.5 text-sm font-medium text-white disabled:opacity-60"
                >
                  {sending ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
                  {t('feedback.reply_send')}
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function authorText(label: FeedbackAuthorLabel, t: TFunction): string {
  if (label && typeof label === 'object') return label.name ?? t('feedback.author.user');
  return t(`feedback.author.${label}`);
}
function categoryLabel(cat: FeedbackTicket['category'], t: TFunction): string {
  return t(`feedback.category.${cat.key}`, { defaultValue: cat.label ?? cat.key });
}
function statusLabel(status: FeedbackTicket['status'], t: TFunction): string {
  return t(`feedback.status.${status.key}`, { defaultValue: status.label });
}
