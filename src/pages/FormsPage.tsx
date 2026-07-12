import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { ClipboardList } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { portalApi, type PortalFormSummary } from '@/lib/portal';
import { useLocalize } from '@/lib/localize';

export function FormsPage() {
  const { t } = useTranslation();
  const localize = useLocalize();
  const [forms, setForms] = useState<PortalFormSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    portalApi.forms().then(setForms).catch(() => setError(t('forms.load_error')));
  }, [t]);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold">{t('forms.title')}</h1>
        <p className="text-sm text-slate-500">{t('forms.subtitle')}</p>
      </div>

      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      {forms === null && !error ? <p className="text-sm text-slate-500">{t('app.loading')}</p> : null}
      {forms && forms.length === 0 ? <p className="text-sm text-slate-500">{t('forms.empty')}</p> : null}

      <ul className="divide-y divide-slate-200 overflow-hidden rounded-lg border border-slate-200 bg-white">
        {(forms ?? []).map((f) => (
          <li key={f.id}>
            <Link to={`/forms/${f.id}`} className="flex items-center gap-3 px-4 py-3 hover:bg-slate-50">
              <ClipboardList className="size-4 shrink-0 text-slate-400" />
              <div className="min-w-0 flex-1">
                <div className="font-medium">{localize(f, 'title')}</div>
                {f.description ? <div className="text-xs text-slate-500">{localize(f, 'description')}</div> : null}
              </div>
              <span className="shrink-0 text-xs text-slate-400">{t('forms.field_count', { count: f.fieldCount })}</span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
