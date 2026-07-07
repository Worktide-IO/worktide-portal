import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router';
import { ArrowLeft, ArrowRight, CheckCircle2, Save, X } from 'lucide-react';

import { portalApi, type PortalFormDetail, type PortalFormField } from '@/lib/portal';

const inputClass = 'mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm';

type SectionState = 'offen' | 'in Arbeit' | 'vollständig';

const SECTION_STATE_CLASSES: Record<SectionState, string> = {
  offen: 'bg-slate-100 text-slate-500',
  'in Arbeit': 'bg-amber-100 text-amber-800',
  vollständig: 'bg-green-100 text-green-700',
};

function isFilled(v: unknown): boolean {
  return v !== undefined && v !== null && v !== '';
}

function sectionState(fields: PortalFormField[], values: Record<string, unknown>): SectionState {
  const anyFilled = fields.some((f) => isFilled(values[f.key]));
  if (!anyFilled) return 'offen';
  const requiredAllFilled = fields.filter((f) => f.required).every((f) => isFilled(values[f.key]));
  return requiredAllFilled ? 'vollständig' : 'in Arbeit';
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

  // Sections in field order.
  const sections = useMemo(() => {
    const map = new Map<string, PortalFormField[]>();
    for (const f of form?.fields ?? []) {
      const s = f.section ?? 'Allgemein';
      (map.get(s) ?? map.set(s, []).get(s)!).push(f);
    }
    return [...map.entries()];
  }, [form]);

  const progress = useMemo(() => {
    const fields = form?.fields ?? [];
    if (fields.length === 0) return 0;
    return Math.round((fields.filter((f) => isFilled(values[f.key])).length / fields.length) * 100);
  }, [form, values]);

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
  if (!form) return <p className="text-sm text-slate-500">Lädt…</p>;

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

  const [currentSection, currentFields] = sections[step] ?? ['', []];
  const isLast = step === sections.length - 1;

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
        {/* Section navigation with per-section status. */}
        <nav className="space-y-1">
          {sections.map(([name, fields], i) => {
            const st = sectionState(fields, values);
            return (
              <button
                key={name}
                type="button"
                onClick={() => setStep(i)}
                className={`flex w-full items-center justify-between gap-2 rounded-md px-3 py-2 text-left text-sm ${
                  i === step ? 'bg-[var(--brand-primary)] text-white' : 'text-slate-700 hover:bg-slate-100'
                }`}
              >
                <span className="truncate">
                  {i + 1} · {name}
                </span>
                <span className={`shrink-0 rounded-full px-1.5 py-0.5 text-[10px] ${i === step ? 'bg-white/20 text-white' : SECTION_STATE_CLASSES[st]}`}>
                  {st}
                </span>
              </button>
            );
          })}
        </nav>

        <form onSubmit={submit} className="space-y-5">
          <fieldset className="space-y-4 rounded-lg border border-slate-200 bg-white p-5">
            <legend className="px-1 text-sm font-semibold text-slate-700">{currentSection}</legend>
            {currentFields.map((f) => (
              <Field key={f.key} field={f} value={values[f.key]} onChange={(v) => set(f.key, v)} />
            ))}
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
                onClick={() => setStep((s) => Math.min(sections.length - 1, s + 1))}
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

function Field({ field, value, onChange }: { field: PortalFormField; value: unknown; onChange: (v: unknown) => void }) {
  const label = (
    <span className="text-sm font-medium">
      {field.label}
      {field.required ? <span className="text-red-500"> *</span> : null}
    </span>
  );
  const str = typeof value === 'string' ? value : '';

  if (field.type === 'tags') {
    return (
      <div>
        {label}
        <TagsInput value={str} placeholder={field.placeholder} onChange={onChange} />
      </div>
    );
  }

  if (field.type === 'textarea') {
    return (
      <label className="block">
        {label}
        <textarea rows={3} required={field.required} placeholder={field.placeholder ?? undefined} value={str} onChange={(e) => onChange(e.target.value)} className={inputClass} />
      </label>
    );
  }

  if (field.type === 'select') {
    return (
      <label className="block">
        {label}
        <select required={field.required} value={str} onChange={(e) => onChange(e.target.value)} className={`${inputClass} bg-white`}>
          <option value="">Bitte wählen…</option>
          {field.options.map((o) => (
            <option key={o} value={o}>
              {o}
            </option>
          ))}
        </select>
      </label>
    );
  }

  if (field.type === 'radio') {
    return (
      <div>
        {label}
        <div className="mt-1 flex flex-wrap gap-4">
          {field.options.map((o) => (
            <label key={o} className="flex items-center gap-1.5 text-sm">
              <input type="radio" name={field.key} value={o} checked={str === o} required={field.required} onChange={() => onChange(o)} />
              {o}
            </label>
          ))}
        </div>
      </div>
    );
  }

  if (field.type === 'checkbox') {
    return (
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={value === true} onChange={(e) => onChange(e.target.checked)} />
        {field.label}
      </label>
    );
  }

  const inputType = ['email', 'url', 'number', 'date'].includes(field.type) ? field.type : 'text';
  return (
    <label className="block">
      {label}
      <input type={inputType} required={field.required} placeholder={field.placeholder ?? undefined} value={str} onChange={(e) => onChange(e.target.value)} className={inputClass} />
    </label>
  );
}

/** Comma-separated tags stored as a single string (kept simple for the API). */
function TagsInput({ value, placeholder, onChange }: { value: string; placeholder: string | null; onChange: (v: string) => void }) {
  const [draft, setDraft] = useState('');
  const tags = value ? value.split(',').map((t) => t.trim()).filter(Boolean) : [];

  function commit(raw: string) {
    const t = raw.trim().replace(/,$/, '');
    if (t === '') return;
    onChange([...new Set([...tags, t])].join(', '));
    setDraft('');
  }

  function remove(tag: string) {
    onChange(tags.filter((t) => t !== tag).join(', '));
  }

  return (
    <div className={`${inputClass} flex flex-wrap items-center gap-1.5`}>
      {tags.map((t) => (
        <span key={t} className="inline-flex items-center gap-1 rounded bg-slate-100 px-2 py-0.5 text-xs text-slate-700">
          {t}
          <button type="button" onClick={() => remove(t)} className="text-slate-400 hover:text-slate-700">
            <X className="size-3" />
          </button>
        </span>
      ))}
      <input
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ',') {
            e.preventDefault();
            commit(draft);
          }
        }}
        onBlur={() => commit(draft)}
        placeholder={tags.length === 0 ? (placeholder ?? 'Tippen + Enter') : ''}
        className="min-w-24 flex-1 border-0 p-0 text-sm outline-none focus:ring-0"
      />
    </div>
  );
}
