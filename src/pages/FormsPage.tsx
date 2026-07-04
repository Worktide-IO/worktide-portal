import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { ClipboardList } from 'lucide-react';

import { portalApi, type PortalFormSummary } from '@/lib/portal';

export function FormsPage() {
  const [forms, setForms] = useState<PortalFormSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    portalApi.forms().then(setForms).catch(() => setError('Fragebögen konnten nicht geladen werden.'));
  }, []);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold">Fragebögen</h1>
        <p className="text-sm text-slate-500">Bitte helfen Sie uns mit ein paar Angaben.</p>
      </div>

      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      {forms === null && !error ? <p className="text-sm text-slate-500">Lädt…</p> : null}
      {forms && forms.length === 0 ? <p className="text-sm text-slate-500">Aktuell keine offenen Fragebögen.</p> : null}

      <ul className="divide-y divide-slate-200 overflow-hidden rounded-lg border border-slate-200 bg-white">
        {(forms ?? []).map((f) => (
          <li key={f.id}>
            <Link to={`/forms/${f.id}`} className="flex items-center gap-3 px-4 py-3 hover:bg-slate-50">
              <ClipboardList className="size-4 shrink-0 text-slate-400" />
              <div className="min-w-0 flex-1">
                <div className="font-medium">{f.title}</div>
                {f.description ? <div className="text-xs text-slate-500">{f.description}</div> : null}
              </div>
              <span className="shrink-0 text-xs text-slate-400">{f.fieldCount} Fragen</span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
