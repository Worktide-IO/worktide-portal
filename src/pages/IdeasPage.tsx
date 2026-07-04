import { useEffect, useState } from 'react';
import { ChevronUp, Lightbulb, MessagesSquare, Plus, Send, Sparkles, Target } from 'lucide-react';

import {
  portalApi,
  type PortalBrainstormNote,
  type PortalGoal,
  type PortalIdea,
} from '@/lib/portal';

function formatWhen(iso: string): string {
  return new Date(iso).toLocaleString('de-DE', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
}

const ORIGIN_DOT: Record<string, string> = {
  customer: 'bg-slate-800',
  agency: 'bg-sky-500',
  ai: 'bg-violet-500',
};

const GOAL_STATUS_CLASSES: Record<string, string> = {
  reached: 'bg-green-100 text-green-700',
  on_track: 'bg-slate-100 text-slate-600',
  at_risk: 'bg-amber-100 text-amber-800',
  missed: 'bg-red-100 text-red-700',
};

function GoalCard({ g }: { g: PortalGoal }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4">
      <div className="flex items-start justify-between gap-3">
        <span className="font-medium">{g.title}</span>
        <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-medium ${GOAL_STATUS_CLASSES[g.status] ?? GOAL_STATUS_CLASSES.on_track}`}>
          {g.statusLabel}
        </span>
      </div>
      {g.progressPct !== null ? (
        <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100">
          <div className="h-full rounded-full bg-slate-800" style={{ width: `${g.progressPct}%` }} />
        </div>
      ) : null}
      <div className="mt-1 text-xs text-slate-500">
        {g.currentValue !== null && g.targetValue !== null
          ? `${g.currentValue} / ${g.targetValue}${g.unit ? ' ' + g.unit : ''}`
          : g.description}
      </div>
    </div>
  );
}

export function IdeasPage() {
  const [goals, setGoals] = useState<PortalGoal[] | null>(null);
  const [ideas, setIdeas] = useState<PortalIdea[] | null>(null);
  const [notes, setNotes] = useState<PortalBrainstormNote[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [busy, setBusy] = useState(false);
  const [noteText, setNoteText] = useState('');
  const [noteBusy, setNoteBusy] = useState(false);

  useEffect(() => {
    portalApi.goals().then(setGoals).catch(() => setError('Ziele konnten nicht geladen werden.'));
    portalApi.ideas().then(setIdeas).catch(() => setError('Ideen konnten nicht geladen werden.'));
    portalApi.brainstorm().then(setNotes).catch(() => setError('Brainstorming konnte nicht geladen werden.'));
  }, []);

  async function postNote(e: React.FormEvent) {
    e.preventDefault();
    if (!noteText.trim()) return;
    setNoteBusy(true);
    try {
      const created = await portalApi.postBrainstorm(noteText.trim());
      setNotes((prev) => [...(prev ?? []), created]);
      setNoteText('');
    } finally {
      setNoteBusy(false);
    }
  }

  async function toggleVote(idea: PortalIdea) {
    // Optimistic: flip locally, reconcile with the server response.
    const optimistic = { ...idea, hasVoted: !idea.hasVoted, voteCount: idea.voteCount + (idea.hasVoted ? -1 : 1) };
    setIdeas((prev) => sortIdeas((prev ?? []).map((i) => (i.id === idea.id ? optimistic : i))));
    try {
      const res = idea.hasVoted ? await portalApi.unvoteIdea(idea.id) : await portalApi.voteIdea(idea.id);
      setIdeas((prev) => sortIdeas((prev ?? []).map((i) => (i.id === idea.id ? { ...i, ...res } : i))));
    } catch {
      setIdeas((prev) => sortIdeas((prev ?? []).map((i) => (i.id === idea.id ? idea : i))));
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    setBusy(true);
    try {
      const created = await portalApi.submitIdea(title.trim());
      setIdeas((prev) => sortIdeas([created, ...(prev ?? [])]));
      setTitle('');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Ziele &amp; Ideen</h1>
        <p className="text-sm text-slate-500">Gemeinsame Ziele verfolgen und Ideen einbringen.</p>
      </div>

      {error ? <p className="text-sm text-red-600">{error}</p> : null}

      <section className="space-y-3">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-700">
          <Target className="size-4 text-slate-400" /> Ziele
        </h2>
        {goals && goals.length === 0 ? <p className="text-sm text-slate-500">Noch keine Ziele.</p> : null}
        <div className="grid gap-3 sm:grid-cols-3">
          {(goals ?? []).map((g) => (
            <GoalCard key={g.id} g={g} />
          ))}
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-700">
          <Lightbulb className="size-4 text-slate-400" /> Ideen fürs Business
        </h2>

        <form onSubmit={submit} className="flex gap-2">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Neue Idee einreichen…"
            className="flex-1 rounded border border-slate-300 px-3 py-2 text-sm"
          />
          <button
            type="submit"
            disabled={busy || !title.trim()}
            className="inline-flex items-center gap-1.5 rounded bg-slate-900 px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
          >
            <Plus className="size-4" /> Einreichen
          </button>
        </form>

        <ul className="space-y-2">
          {(ideas ?? []).map((idea) => (
            <li key={idea.id} className="flex items-start gap-3 rounded-lg border border-slate-200 bg-white p-3">
              <button
                type="button"
                onClick={() => toggleVote(idea)}
                aria-pressed={idea.hasVoted}
                className={`flex w-12 shrink-0 flex-col items-center rounded-md border px-1 py-1.5 text-sm transition ${
                  idea.hasVoted
                    ? 'border-slate-900 bg-slate-900 text-white'
                    : 'border-slate-200 text-slate-600 hover:border-slate-400'
                }`}
              >
                <ChevronUp className="size-4" />
                <span className="font-semibold">{idea.voteCount}</span>
              </button>
              <div className="min-w-0 flex-1">
                <div className="font-medium">{idea.title}</div>
                {idea.description ? <p className="mt-0.5 text-sm text-slate-600">{idea.description}</p> : null}
                <div className="mt-1 flex flex-wrap gap-2 text-xs text-slate-400">
                  <span>{idea.originLabel}</span>
                  <span>·</span>
                  <span>{idea.statusLabel}</span>
                  {idea.submittedBy ? (
                    <>
                      <span>·</span>
                      <span>{idea.submittedBy}</span>
                    </>
                  ) : null}
                </div>
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section className="space-y-3">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-700">
          <MessagesSquare className="size-4 text-slate-400" /> Brainstorming
        </h2>

        <div className="rounded-lg border border-slate-200 bg-white p-4">
          {notes && notes.length === 0 ? (
            <p className="text-sm text-slate-500">Noch keine Beiträge — starten Sie die Unterhaltung.</p>
          ) : null}

          <ul className="space-y-4">
            {(notes ?? []).map((n) => (
              <li key={n.id} className="flex gap-3">
                <span className={`mt-1.5 size-2 shrink-0 rounded-full ${ORIGIN_DOT[n.origin] ?? 'bg-slate-400'}`} />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    <span className={`font-medium ${n.isMine ? 'text-slate-900' : 'text-slate-600'}`}>
                      {n.authorName}
                    </span>
                    {n.origin === 'ai' ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-violet-100 px-1.5 py-0.5 text-violet-700">
                        <Sparkles className="size-3" /> KI
                      </span>
                    ) : null}
                    <span className="text-slate-400">{formatWhen(n.createdAt)}</span>
                  </div>
                  <p className="mt-0.5 whitespace-pre-wrap text-sm text-slate-700">{n.body}</p>
                </div>
              </li>
            ))}
          </ul>

          <form onSubmit={postNote} className="mt-4 flex gap-2 border-t border-slate-100 pt-3">
            <input
              value={noteText}
              onChange={(e) => setNoteText(e.target.value)}
              placeholder="Beitrag schreiben…"
              className="flex-1 rounded border border-slate-300 px-3 py-2 text-sm"
            />
            <button
              type="submit"
              disabled={noteBusy || !noteText.trim()}
              className="inline-flex items-center gap-1.5 rounded bg-slate-900 px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
            >
              <Send className="size-4" /> Senden
            </button>
          </form>
        </div>
      </section>
    </div>
  );
}

function sortIdeas(ideas: PortalIdea[]): PortalIdea[] {
  return [...ideas].sort((a, b) => b.voteCount - a.voteCount);
}
