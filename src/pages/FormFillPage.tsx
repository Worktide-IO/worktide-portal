import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router';
import { ArrowLeft, CheckCircle2 } from 'lucide-react';

import { portalApi, type PortalFormDetail, type PortalFormField } from '@/lib/portal';

const inputClass = 'mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm';

export function FormFillPage() {
  const { id = '' } = useParams();
  const [form, setForm] = useState<PortalFormDetail | null>(null);
  const [values, setValues] = useState<Record<string, unknown>>({});
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<string | null>(null);

  useEffect(() => {
    portalApi.form(id).then(setForm).catch(() => setError('Fragebogen nicht gefunden oder kein Zugriff.'));
  }, [id]);

  // Preserve section order as it appears in the field list.
  const sections = useMemo(() => {
    const map = new Map<string, PortalFormField[]>();
    for (const f of form?.fields ?? []) {
      const s = f.section ?? 'Allgemein';
      (map.get(s) ?? map.set(s, []).get(s)!).push(f);
    }
    return [...map.entries()];
  }, [form]);

  function set(key: string, value: unknown) {
    setValues((v) => ({ ...v, [key]: value }));
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

  return (
    <div className="space-y-5">
      <Link to="/forms" className="inline-flex items-center gap-1.5 text-sm text-slate-600 hover:text-slate-900">
        <ArrowLeft className="size-4" /> Zurück
      </Link>

      <div>
        <h1 className="text-xl font-semibold">{form.title}</h1>
        {form.description ? <p className="mt-1 text-sm text-slate-500">{form.description}</p> : null}
      </div>

      <form onSubmit={submit} className="space-y-6">
        {sections.map(([section, fields]) => (
          <fieldset key={section} className="space-y-4 rounded-lg border border-slate-200 bg-white p-5">
            <legend className="px-1 text-sm font-semibold text-slate-700">{section}</legend>
            {fields.map((f) => (
              <Field key={f.key} field={f} value={values[f.key]} onChange={(v) => set(f.key, v)} />
            ))}
          </fieldset>
        ))}

        {error ? <p className="text-sm text-red-600">{error}</p> : null}

        <button
          type="submit"
          disabled={busy}
          className="cursor-pointer rounded bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          {busy ? 'Senden…' : 'Absenden'}
        </button>
      </form>
    </div>
  );
}

function Field({
  field,
  value,
  onChange,
}: {
  field: PortalFormField;
  value: unknown;
  onChange: (v: unknown) => void;
}) {
  const label = (
    <span className="text-sm font-medium">
      {field.label}
      {field.required ? <span className="text-red-500"> *</span> : null}
    </span>
  );
  const str = typeof value === 'string' ? value : '';

  if (field.type === 'textarea') {
    return (
      <label className="block">
        {label}
        <textarea
          rows={3}
          required={field.required}
          placeholder={field.placeholder ?? undefined}
          value={str}
          onChange={(e) => onChange(e.target.value)}
          className={inputClass}
        />
      </label>
    );
  }

  if (field.type === 'select') {
    return (
      <label className="block">
        {label}
        <select
          required={field.required}
          value={str}
          onChange={(e) => onChange(e.target.value)}
          className={`${inputClass} bg-white`}
        >
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
              <input
                type="radio"
                name={field.key}
                value={o}
                checked={str === o}
                required={field.required}
                onChange={() => onChange(o)}
              />
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

  // text | email | url | number | date | fallback
  const inputType = ['email', 'url', 'number', 'date'].includes(field.type) ? field.type : 'text';
  return (
    <label className="block">
      {label}
      <input
        type={inputType}
        required={field.required}
        placeholder={field.placeholder ?? undefined}
        value={str}
        onChange={(e) => onChange(e.target.value)}
        className={inputClass}
      />
    </label>
  );
}
