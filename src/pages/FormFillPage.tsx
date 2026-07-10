import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router';
import { ArrowLeft, ArrowRight, CheckCircle2, Save, Star } from 'lucide-react';

import { portalApi, type FormBlock, type FormSchema, type PortalFormDetail } from '@/lib/portal';
import { evaluateForm, INPUT_TYPES } from '@/lib/formLogic';

const inputClass = 'mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm';

type PageState = 'offen' | 'in Arbeit' | 'vollständig';

const PAGE_STATE_CLASSES: Record<PageState, string> = {
  offen: 'bg-slate-100 text-slate-500',
  'in Arbeit': 'bg-amber-100 text-amber-800',
  vollständig: 'bg-green-100 text-green-700',
};

function isFilled(v: unknown): boolean {
  if (v === undefined || v === null || v === '') return false;
  if (Array.isArray(v)) return v.length > 0;
  if (typeof v === 'object') return Object.keys(v).length > 0;
  return true;
}

/**
 * The renderer always works off a v2 schema: use the server's `schema` when
 * present, otherwise synthesise one from the legacy flat `fields` (one page per
 * section) — mirroring the backend FormSchemaNormalizer so behaviour matches.
 */
function toSchema(form: PortalFormDetail): FormSchema {
  if (form.schema) return form.schema;

  const pages: FormSchema['pages'] = [];
  const bySection = new Map<string, number>();
  form.fields.forEach((f, i) => {
    const section = f.section ?? '';
    let idx = bySection.get(section);
    if (idx === undefined) {
      idx = pages.length;
      bySection.set(section, idx);
      pages.push({ id: `p${idx + 1}`, title: section || null, blocks: [] });
    }
    pages[idx].blocks.push({
      id: `b${i}`,
      key: f.key,
      type: f.type,
      label: f.label,
      required: f.required,
      options: f.options,
      placeholder: f.placeholder,
      hidden: false,
      min: null,
      max: null,
      rows: [],
    });
  });
  if (pages.length === 0) pages.push({ id: 'p1', title: null, blocks: [] });
  return { version: 2, pages, logic: [], calc: [] };
}

// Trails `value` by `ms`, collapsing bursts. Used to throttle full-form
// re-evaluation: inputs stay bound to the live `values` (so typing is instant),
// while branching/calc/progress recompute at most once per idle window.
function useDebounced<T>(value: T, ms: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return debounced;
}

function pageState(blocks: FormBlock[], activeKeys: Set<string>, values: Record<string, unknown>): PageState {
  const active = blocks.filter((b) => b.key && activeKeys.has(b.key));
  if (active.length === 0) return 'vollständig';
  const anyFilled = active.some((b) => isFilled(values[b.key]));
  if (!anyFilled) return 'offen';
  const requiredFilled = active.filter((b) => b.required).every((b) => isFilled(values[b.key]));
  return requiredFilled ? 'vollständig' : 'in Arbeit';
}

export function FormFillPage() {
  const { id = '' } = useParams();
  const [form, setForm] = useState<PortalFormDetail | null>(null);
  const [values, setValues] = useState<Record<string, unknown>>({});
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savedNote, setSavedNote] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const [step, setStep] = useState(0);

  useEffect(() => {
    portalApi
      .form(id)
      .then((f) => {
        setForm(f);
        if (f.draft) setValues(f.draft);
        if (f.draftSavedAt) setSavedNote('Entwurf gespeichert');
      })
      .catch(() => setError('Fragebogen nicht gefunden oder kein Zugriff.'));
  }, [id]);

  const schema = useMemo(() => (form ? toSchema(form) : null), [form]);

  // Re-run branching/calc off a debounced snapshot, not every keystroke — the
  // engine walks the whole form, and this feeds only live UX (visible blocks,
  // page order, calc totals, progress). Inputs bind to the live `values`, and
  // submit sends the live `values`, so the delay is invisible to correctness.
  const debouncedValues = useDebounced(values, 150);
  const evaluation = useMemo(
    () => (schema ? evaluateForm(schema, debouncedValues) : null),
    [schema, debouncedValues],
  );

  const orderedPages = useMemo(() => {
    if (!schema || !evaluation) return [];
    const byId = new Map(schema.pages.map((p) => [p.id, p]));
    return evaluation.pageOrder.map((pid) => byId.get(pid)).filter((p): p is FormSchema['pages'][number] => !!p);
  }, [schema, evaluation]);

  // A jump can shorten the reachable set — keep the step in range.
  useEffect(() => {
    if (orderedPages.length > 0 && step > orderedPages.length - 1) setStep(orderedPages.length - 1);
  }, [orderedPages.length, step]);

  const activeKeys = useMemo(() => new Set(evaluation?.activeKeys ?? []), [evaluation]);

  const progress = useMemo(() => {
    const keys = evaluation?.activeKeys ?? [];
    if (keys.length === 0) return 0;
    // Count fills from the same debounced snapshot the activeKeys came from, so
    // the ratio is always internally consistent.
    return Math.round((keys.filter((k) => isFilled(debouncedValues[k])).length / keys.length) * 100);
  }, [evaluation, debouncedValues]);

  function set(key: string, value: unknown) {
    setValues((v) => ({ ...v, [key]: value }));
    setSavedNote(null);
  }

  async function saveDraft() {
    setSaving(true);
    try {
      await portalApi.saveFormDraft(id, values);
      setSavedNote('Entwurf gespeichert');
    } finally {
      setSaving(false);
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await portalApi.submitForm(id, values);
      setDone(res.message ?? 'Vielen Dank für Ihre Angaben.');
    } catch (err) {
      const data = (err as { response?: { data?: { errors?: Record<string, string> } } })?.response?.data;
      setError(
        data?.errors
          ? 'Bitte prüfen Sie Ihre Angaben: ' + Object.values(data.errors).join(' · ')
          : 'Fragebogen konnte nicht gesendet werden.',
      );
      setBusy(false);
    }
  }

  if (error && !form) return <p className="text-sm text-red-600">{error}</p>;
  if (!form || !schema || !evaluation) return <p className="text-sm text-slate-500">Lädt…</p>;

  if (done) {
    return (
      <div className="space-y-4">
        <Link to="/forms" className="inline-flex items-center gap-1.5 text-sm text-slate-600 hover:text-slate-900">
          <ArrowLeft className="size-4" /> Zurück
        </Link>
        <div className="flex items-start gap-3 rounded-lg border border-green-200 bg-green-50 p-5">
          <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-green-600" />
          <div>
            <div className="font-medium text-green-800">Gesendet</div>
            <p className="text-sm text-green-700">{done}</p>
          </div>
        </div>
      </div>
    );
  }

  const currentPage = orderedPages[step] ?? orderedPages[0];
  const isLast = step === orderedPages.length - 1;
  const visibleBlocks = (currentPage?.blocks ?? []).filter((b) => evaluation.visibleBlocks[b.id] !== false && b.hidden !== true);
  const calcValues = evaluation.calc;

  return (
    <div className="space-y-5">
      <Link to="/forms" className="inline-flex items-center gap-1.5 text-sm text-slate-600 hover:text-slate-900">
        <ArrowLeft className="size-4" /> Zurück
      </Link>

      <div>
        <h1 className="text-xl font-semibold">{form.title}</h1>
        {form.description ? <p className="mt-1 text-sm text-slate-500">{form.description}</p> : null}
        <div className="mt-3 flex items-center gap-3">
          <div className="h-1.5 w-40 overflow-hidden rounded-full bg-slate-100">
            <div className="h-full rounded-full bg-slate-800" style={{ width: `${progress}%` }} />
          </div>
          <span className="text-xs text-slate-500">
            {savedNote ? `${savedNote} · ` : ''}
            {progress} % ausgefüllt
          </span>
        </div>
      </div>

      <div className="grid gap-5 sm:grid-cols-[13rem_1fr]">
        {/* Page navigation (jump-aware) with per-page status. */}
        <nav className="space-y-1">
          {orderedPages.map((page, i) => {
            const st = pageState(page.blocks, activeKeys, debouncedValues);
            const name = page.title ?? `Abschnitt ${i + 1}`;
            return (
              <button
                key={page.id}
                type="button"
                onClick={() => setStep(i)}
                className={`flex w-full items-center justify-between gap-2 rounded-md px-3 py-2 text-left text-sm ${
                  i === step ? 'bg-[var(--brand-primary)] text-white' : 'text-slate-700 hover:bg-slate-100'
                }`}
              >
                <span className="truncate">
                  {i + 1} · {name}
                </span>
                <span className={`shrink-0 rounded-full px-1.5 py-0.5 text-[10px] ${i === step ? 'bg-white/20 text-white' : PAGE_STATE_CLASSES[st]}`}>
                  {st}
                </span>
              </button>
            );
          })}
        </nav>

        <form onSubmit={submit} className="space-y-5">
          <fieldset className="space-y-4 rounded-lg border border-slate-200 bg-white p-5">
            {currentPage?.title ? <legend className="px-1 text-sm font-semibold text-slate-700">{currentPage.title}</legend> : null}
            {visibleBlocks.map((b) =>
              INPUT_TYPES.has(b.type) ? (
                <Field key={b.id} block={b} value={values[b.key]} onChange={(v) => set(b.key, v)} />
              ) : (
                <StaticBlock key={b.id} block={b} />
              ),
            )}
            {isLast && Object.keys(calcValues).length > 0 ? <CalcSummary calc={calcValues} /> : null}
          </fieldset>

          {error ? <p className="text-sm text-red-600">{error}</p> : null}

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              disabled={step === 0}
              onClick={() => setStep((s) => Math.max(0, s - 1))}
              className="inline-flex items-center gap-1.5 rounded border border-slate-300 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-40"
            >
              <ArrowLeft className="size-4" /> Zurück
            </button>

            {!isLast ? (
              <button
                type="button"
                onClick={() => setStep((s) => Math.min(orderedPages.length - 1, s + 1))}
                className="inline-flex items-center gap-1.5 rounded bg-[var(--brand-primary)] px-3 py-2 text-sm font-medium text-white"
              >
                Weiter <ArrowRight className="size-4" />
              </button>
            ) : (
              <button
                type="submit"
                disabled={busy}
                className="rounded bg-[var(--brand-primary)] px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
              >
                {busy ? 'Senden…' : 'Absenden'}
              </button>
            )}

            <button
              type="button"
              onClick={saveDraft}
              disabled={saving}
              className="inline-flex items-center gap-1.5 rounded border border-slate-300 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-50"
            >
              <Save className="size-4" /> {saving ? 'Speichern…' : 'Entwurf speichern'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function StaticBlock({ block }: { block: FormBlock }) {
  if (block.type === 'heading') return <h2 className="text-base font-semibold text-slate-800">{block.label}</h2>;
  return <p className="text-sm text-slate-500">{block.label}</p>;
}

function CalcSummary({ calc }: { calc: Record<string, number> }) {
  return (
    <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
      <div className="text-xs font-medium uppercase tracking-wide text-slate-500">Berechnet</div>
      <dl className="mt-1 space-y-0.5">
        {Object.entries(calc).map(([k, v]) => (
          <div key={k} className="flex justify-between text-sm">
            <dt className="text-slate-600">{k}</dt>
            <dd className="font-medium text-slate-800">{v}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

function Field({ block, value, onChange }: { block: FormBlock; value: unknown; onChange: (v: unknown) => void }) {
  const label = (
    <span className="text-sm font-medium">
      {block.label}
      {block.required ? <span className="text-red-500"> *</span> : null}
    </span>
  );
  const str = typeof value === 'string' ? value : typeof value === 'number' ? String(value) : '';

  if (block.type === 'multi_select') {
    const selected = Array.isArray(value) ? (value as string[]) : [];
    const toggle = (o: string) =>
      onChange(selected.includes(o) ? selected.filter((s) => s !== o) : [...selected, o]);
    return (
      <div>
        {label}
        <div className="mt-1 flex flex-wrap gap-3">
          {block.options.map((o) => (
            <label key={o} className="flex items-center gap-1.5 text-sm">
              <input type="checkbox" checked={selected.includes(o)} onChange={() => toggle(o)} />
              {o}
            </label>
          ))}
        </div>
      </div>
    );
  }

  if (block.type === 'rating') {
    const max = block.max && block.max > 0 ? block.max : 5;
    const current = typeof value === 'number' ? value : 0;
    return (
      <div>
        {label}
        <div className="mt-1 flex gap-1">
          {Array.from({ length: max }, (_, i) => i + 1).map((n) => (
            <button
              key={n}
              type="button"
              aria-label={`${n}`}
              onClick={() => onChange(n)}
              className={n <= current ? 'text-amber-500' : 'text-slate-300 hover:text-amber-300'}
            >
              <Star className="size-6" fill={n <= current ? 'currentColor' : 'none'} />
            </button>
          ))}
        </div>
      </div>
    );
  }

  if (block.type === 'scale') {
    const min = block.min ?? 0;
    const max = block.max && block.max > 0 ? block.max : 10;
    const current = typeof value === 'number' ? value : null;
    const steps = [];
    for (let n = min; n <= max; n += 1) steps.push(n);
    return (
      <div>
        {label}
        <div className="mt-1 flex flex-wrap gap-1.5">
          {steps.map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => onChange(n)}
              className={`size-8 rounded border text-sm ${
                current === n ? 'border-[var(--brand-primary)] bg-[var(--brand-primary)] text-white' : 'border-slate-300 text-slate-600 hover:bg-slate-50'
              }`}
            >
              {n}
            </button>
          ))}
        </div>
      </div>
    );
  }

  if (block.type === 'matrix') {
    const rows = block.rows ?? [];
    const answer = (value && typeof value === 'object' ? value : {}) as Record<string, string>;
    const setRow = (row: string, opt: string) => onChange({ ...answer, [row]: opt });
    return (
      <div>
        {label}
        <div className="mt-2 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr>
                <th />
                {block.options.map((o) => (
                  <th key={o} className="px-2 pb-1 text-center text-xs font-normal text-slate-500">
                    {o}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row} className="border-t border-slate-100">
                  <td className="py-1.5 pr-2 text-slate-700">{row}</td>
                  {block.options.map((o) => (
                    <td key={o} className="text-center">
                      <input type="radio" name={`${block.id}-${row}`} checked={answer[row] === o} onChange={() => setRow(row, o)} />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  if (block.type === 'long_text') {
    return (
      <label className="block">
        {label}
        <textarea rows={3} required={block.required} placeholder={block.placeholder ?? undefined} value={str} onChange={(e) => onChange(e.target.value)} className={inputClass} />
      </label>
    );
  }

  if (block.type === 'select') {
    return (
      <label className="block">
        {label}
        <select required={block.required} value={str} onChange={(e) => onChange(e.target.value)} className={`${inputClass} bg-white`}>
          <option value="">Bitte wählen…</option>
          {block.options.map((o) => (
            <option key={o} value={o}>
              {o}
            </option>
          ))}
        </select>
      </label>
    );
  }

  if (block.type === 'boolean') {
    return (
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={value === true} onChange={(e) => onChange(e.target.checked)} />
        {block.label}
      </label>
    );
  }

  if (block.type === 'file') {
    // v1: reference to an uploaded object (URL). Native upload widget is a
    // follow-up; a URL keeps the field usable without the storage round-trip.
    return (
      <label className="block">
        {label}
        <input type="url" required={block.required} placeholder={block.placeholder ?? 'https://…'} value={str} onChange={(e) => onChange(e.target.value)} className={inputClass} />
      </label>
    );
  }

  const inputType = ['email', 'url', 'number', 'date'].includes(block.type) ? block.type : 'text';
  return (
    <label className="block">
      {label}
      <input type={inputType} required={block.required} placeholder={block.placeholder ?? undefined} value={str} onChange={(e) => onChange(e.target.value)} className={inputClass} />
    </label>
  );
}

/** Comma-separated tags stored as a single string (kept simple for the API). */
