import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronRight, Download, File as FileIcon, Folder as FolderIcon, Home, Loader2, Upload } from 'lucide-react';

import { portalApi, type PortalFileItem, type PortalFilesResponse, type PortalFolder } from '@/lib/portal';

type Crumb = { id: string; name: string };

function formatSize(size: number | string | null | undefined): string {
  const n = typeof size === 'string' ? Number(size) : (size ?? 0);
  if (!n || n <= 0) return '';
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Customer-facing file area. Everything shown is scoped to the caller's own
 * customer server-side (PortalFilesController); this page just browses folders,
 * downloads, and uploads into the current folder.
 */
export function FilesPage() {
  const { t } = useTranslation();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [path, setPath] = useState<Crumb[]>([]);
  const [data, setData] = useState<PortalFilesResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const currentId = path.length > 0 ? path[path.length - 1].id : undefined;

  const load = useCallback(() => {
    portalApi
      .files(currentId)
      .then((d) => {
        setData(d);
        setError(null);
      })
      .catch(() => setError(t('files_list.load_error')));
  }, [currentId, t]);

  useEffect(() => {
    load();
  }, [load]);

  const openFolder = (f: PortalFolder) => {
    setData(null);
    setPath((p) => [...p, { id: f.id, name: f.name }]);
  };
  const goTo = (index: number) => {
    setData(null);
    setPath((p) => (index < 0 ? [] : p.slice(0, index + 1)));
  };

  const onFilesPicked = async (list: FileList | null) => {
    if (!list || list.length === 0) return;
    setBusy(true);
    try {
      for (const file of Array.from(list)) {
        await portalApi.uploadPortalFile(currentId ?? null, file);
      }
      load();
    } catch {
      setError(t('files_list.upload_error'));
    } finally {
      setBusy(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const download = async (f: PortalFileItem) => {
    try {
      const blob = await portalApi.downloadPortalFile(f.id);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = f.name;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch {
      setError(t('files_list.download_error'));
    }
  };

  const folders = data?.folders ?? [];
  const files = data?.files ?? [];
  const empty = data !== null && folders.length === 0 && files.length === 0;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold">{t('files_list.title')}</h1>
          <p className="text-sm text-slate-500">{t('files_list.subtitle')}</p>
        </div>
        <button
          type="button"
          disabled={busy}
          onClick={() => fileInputRef.current?.click()}
          className="inline-flex items-center gap-2 rounded-md bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-60"
        >
          {busy ? <Loader2 className="size-4 animate-spin" /> : <Upload className="size-4" />}
          {t('files_list.upload')}
        </button>
        <input
          ref={fileInputRef}
          type="file"
          multiple
          className="hidden"
          onChange={(e) => void onFilesPicked(e.target.files)}
        />
      </div>

      {/* Breadcrumb */}
      <div className="flex items-center gap-1 text-sm text-slate-500">
        <button type="button" onClick={() => goTo(-1)} className="inline-flex items-center gap-1 hover:text-slate-900">
          <Home className="size-3.5" /> {t('files_list.root')}
        </button>
        {path.map((crumb, i) => (
          <span key={crumb.id} className="inline-flex items-center gap-1">
            <ChevronRight className="size-3.5" />
            <button type="button" onClick={() => goTo(i)} className="max-w-40 truncate hover:text-slate-900">
              {crumb.name}
            </button>
          </span>
        ))}
      </div>

      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      {data === null && !error ? <p className="text-sm text-slate-500">{t('app.loading')}</p> : null}
      {empty ? <p className="text-sm text-slate-500">{t('files_list.empty')}</p> : null}

      {!empty && data !== null ? (
        <ul className="divide-y divide-slate-200 rounded-lg border border-slate-200 bg-white">
          {folders.map((f) => (
            <li key={`d-${f.id}`}>
              <button
                type="button"
                onClick={() => openFolder(f)}
                className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-slate-50"
              >
                <FolderIcon className="size-5 text-sky-500" />
                <span className="font-medium">{f.name}</span>
              </button>
            </li>
          ))}
          {files.map((f) => (
            <li key={`f-${f.id}`} className="flex items-center gap-3 px-4 py-3">
              <FileIcon className="size-5 text-slate-400" />
              <span className="flex-1 truncate">{f.name}</span>
              <span className="text-xs tabular-nums text-slate-400">{formatSize(f.size)}</span>
              <button
                type="button"
                onClick={() => void download(f)}
                className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-sm text-slate-600 hover:bg-slate-100"
              >
                <Download className="size-4" /> {t('files_list.download')}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
