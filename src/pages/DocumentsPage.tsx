import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { useTranslation } from 'react-i18next';
import { FileText } from 'lucide-react';

import { portalApi, type PortalDocument } from '@/lib/portal';

export function DocumentsPage() {
  const { t } = useTranslation();
  const [docs, setDocs] = useState<PortalDocument[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    portalApi.documents().then(setDocs).catch(() => setError(t('documents_list.load_error')));
  }, [t]);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold">{t('documents_list.title')}</h1>
        <p className="text-sm text-slate-500">{t('documents_list.subtitle')}</p>
      </div>

      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      {docs === null && !error ? <p className="text-sm text-slate-500">{t('app.loading')}</p> : null}
      {docs && docs.length === 0 ? <p className="text-sm text-slate-500">{t('documents_list.empty')}</p> : null}

      <ul className="divide-y divide-slate-200 overflow-hidden rounded-lg border border-slate-200 bg-white">
        {(docs ?? []).map((d) => (
          <li key={d.id}>
            <Link to={`/documents/${d.id}`} className="flex items-center gap-3 px-4 py-3 hover:bg-slate-50">
              <span className="grid size-8 shrink-0 place-items-center rounded bg-slate-100 text-base">
                {d.emoji ?? <FileText className="size-4 text-slate-500" />}
              </span>
              <div className="min-w-0 flex-1">
                <div className="truncate font-medium">{d.name}</div>
                <div className="text-xs text-slate-500">
                  {[d.spaceName, d.projectName].filter(Boolean).join(' · ')}
                </div>
              </div>
              <span className="shrink-0 text-xs text-slate-400">
                {new Date(d.updatedAt).toLocaleDateString('de-DE', { dateStyle: 'medium' })}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
