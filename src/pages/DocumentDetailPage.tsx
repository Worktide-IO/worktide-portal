import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router';
import { ArrowLeft } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

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
        {/* Body is markdown (GFM). react-markdown renders to plain elements;
            Tailwind Typography's `prose` styles them. */}
        {doc.body ? (
          <div className="prose prose-slate prose-sm mt-4 max-w-none">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{doc.body}</ReactMarkdown>
          </div>
        ) : (
          <p className="mt-4 text-sm text-slate-400">Kein Inhalt.</p>
        )}
      </div>
    </div>
  );
}
