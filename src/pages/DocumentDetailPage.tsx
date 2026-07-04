import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router';
import { ArrowLeft } from 'lucide-react';

import { portalApi, type PortalDocumentDetail } from '@/lib/portal';

export function DocumentDetailPage() {
  const { id = '' } = useParams();
  const [doc, setDoc] = useState<PortalDocumentDetail | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    portalApi
      .document(id)
      .then(setDoc)
      .catch(() => setError('Dokument nicht gefunden oder kein Zugriff.'));
  }, [id]);

  if (error) return <p className="text-sm text-red-600">{error}</p>;
  if (!doc) return <p className="text-sm text-slate-500">Lädt…</p>;

  return (
    <div className="space-y-5">
      <Link to="/documents" className="inline-flex items-center gap-1.5 text-sm text-slate-600 hover:text-slate-900">
        <ArrowLeft className="size-4" /> Zurück
      </Link>

      <div className="rounded-lg border border-slate-200 bg-white p-6">
        <h1 className="flex items-center gap-2 text-lg font-semibold">
          {doc.emoji ? <span>{doc.emoji}</span> : null}
          {doc.name}
        </h1>
        <p className="mt-1 text-xs text-slate-500">
          {[doc.spaceName, doc.projectName].filter(Boolean).join(' · ')}
        </p>
        {/* Body is markdown; rendered as preserved text for now (rich markdown
            rendering is a later polish — no renderer dependency yet). */}
        <div className="mt-4 whitespace-pre-wrap font-mono text-sm leading-relaxed text-slate-800">
          {doc.body ?? '—'}
        </div>
      </div>
    </div>
  );
}
