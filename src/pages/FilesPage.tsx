import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ChevronLeft,
  ChevronRight,
  Download,
  FileAudio,
  FileIcon,
  FileImage,
  FileText,
  FileVideo,
  Folder as FolderIcon,
  Home,
  Loader2,
  Upload,
  X,
} from 'lucide-react';

import { useFileStream } from '@/lib/mercure';
import { portalApi, type PortalFileItem, type PortalFilesResponse, type PortalFolder } from '@/lib/portal';

type Crumb = { id: string; name: string };

type FileKind = 'image' | 'audio' | 'video' | 'pdf' | 'other';

function formatSize(size: number | string | null | undefined): string {
  const n = typeof size === 'string' ? Number(size) : (size ?? 0);
  if (!n || n <= 0) return '';
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

function fileKind(mime: string | null | undefined): FileKind {
  if (!mime) return 'other';
  if (mime.startsWith('image/')) return 'image';
  if (mime.startsWith('audio/')) return 'audio';
  if (mime.startsWith('video/')) return 'video';
  if (mime === 'application/pdf') return 'pdf';
  return 'other';
}

function isViewable(mime: string | null | undefined): boolean {
  const k = fileKind(mime);
  return k === 'image' || k === 'audio' || k === 'video';
}

function FileKindIcon({ mimeType, className }: { mimeType: string | null | undefined; className?: string }) {
  const kind = fileKind(mimeType);
  if (kind === 'audio') return <FileAudio className={`size-5 text-violet-500 ${className ?? ''}`} />;
  if (kind === 'video') return <FileVideo className={`size-5 text-rose-500 ${className ?? ''}`} />;
  if (kind === 'pdf')   return <FileText className={`size-5 text-red-500 ${className ?? ''}`} />;
  if (kind === 'image') return <FileImage className={`size-5 text-sky-500 ${className ?? ''}`} />;
  return <FileIcon className={`size-5 text-slate-400 ${className ?? ''}`} />;
}

function MediaViewer({
  files,
  index,
  urls,
  onClose,
  onPrev,
  onNext,
  onDownload,
}: {
  files: PortalFileItem[];
  index: number;
  urls: Record<string, string>;
  onClose: () => void;
  onPrev: () => void;
  onNext: () => void;
  onDownload: (f: PortalFileItem) => void;
}) {
  const current = files[index];
  const url = current ? urls[current.id] : null;
  const kind = current ? fileKind(current.mimeType) : 'other';
  const count = files.length;
  const hasPrev = index > 0;
  const hasNext = index < count - 1;

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowLeft' && hasPrev) onPrev();
      if (e.key === 'ArrowRight' && hasNext) onNext();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose, onPrev, onNext, hasPrev, hasNext]);

  if (!current) return null;

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black/90 backdrop-blur-sm" onClick={onClose}>
      <div className="flex items-center justify-between gap-3 p-3 text-white" onClick={(e) => e.stopPropagation()}>
        <span className="truncate text-sm">
          {current.name}
          {count > 1 ? <span className="ml-2 text-white/60">{index + 1} / {count}</span> : null}
        </span>
        <div className="flex items-center gap-1">
          <button type="button" onClick={() => onDownload(current)}
            className="rounded p-1.5 text-white/70 hover:bg-white/10 hover:text-white">
            <Download className="size-5" />
          </button>
          <button type="button" onClick={onClose}
            className="rounded p-1.5 text-white/70 hover:bg-white/10 hover:text-white">
            <X className="size-5" />
          </button>
        </div>
      </div>
      <div className="relative flex min-h-0 flex-1 items-center justify-center p-4" onClick={(e) => e.stopPropagation()}>
        {hasPrev && (
          <button type="button" onClick={onPrev}
            className="absolute left-2 z-10 rounded-full bg-white/10 p-2 text-white hover:bg-white/20">
            <ChevronLeft className="size-6" />
          </button>
        )}
        {!url ? (
          <Loader2 className="size-8 animate-spin text-white/70" />
        ) : kind === 'video' ? (
          <video src={url} controls autoPlay className="max-h-full max-w-full" />
        ) : kind === 'audio' ? (
          <div className="flex w-full max-w-lg flex-col items-center gap-4 px-6 text-white">
            <FileAudio className="size-16 text-white/70" />
            <audio src={url} controls autoPlay className="w-full" />
          </div>
        ) : (
          <img src={url} alt={current.name} className="max-h-full max-w-full object-contain" />
        )}
        {hasNext && (
          <button type="button" onClick={onNext}
            className="absolute right-2 z-10 rounded-full bg-white/10 p-2 text-white hover:bg-white/20">
            <ChevronRight className="size-6" />
          </button>
        )}
      </div>
    </div>
  );
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
  const [viewerIdx, setViewerIdx] = useState<number | null>(null);
  const [mediaUrls, setMediaUrls] = useState<Record<string, string>>({});
  const urlCacheRef = useRef<Map<string, string>>(new Map());

  const currentId = path.length > 0 ? path[path.length - 1].id : undefined;

  const loadUrl = useCallback(async (id: string): Promise<string> => {
    const cached = urlCacheRef.current.get(id);
    if (cached) return cached;
    const blob = await portalApi.downloadPortalFile(id);
    const url = URL.createObjectURL(blob);
    urlCacheRef.current.set(id, url);
    setMediaUrls((prev) => ({ ...prev, [id]: url }));
    return url;
  }, []);

  const load = useCallback(() => {
    setViewerIdx(null);
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

  useEffect(() => {
    return () => {
      for (const url of urlCacheRef.current.values()) URL.revokeObjectURL(url);
      urlCacheRef.current.clear();
    };
  }, []);

  useFileStream(load);

  const files = data?.files ?? [];
  const viewableFiles = useMemo(() => files.filter((f) => isViewable(f.mimeType)), [files]);

  // Prefetch image thumbnails
  const imageIds = useMemo(() => files.filter((f) => fileKind(f.mimeType) === 'image').map((f) => f.id).join(','), [files]);
  useEffect(() => {
    if (imageIds === '') return;
    let cancelled = false;
    void (async () => {
      for (const id of imageIds.split(',')) {
        if (cancelled || urlCacheRef.current.has(id)) continue;
        try { await loadUrl(id); } catch { /* skip */ }
      }
    })();
    return () => { cancelled = true; };
  }, [imageIds, loadUrl]);

  // Load viewer URL lazily (image is already prefetched, audio/video loads on demand)
  useEffect(() => {
    if (viewerIdx === null || !files[viewerIdx]) return;
    const f = files[viewerIdx];
    if (urlCacheRef.current.has(f.id)) return;
    void loadUrl(f.id);
  }, [viewerIdx, files, loadUrl]);

  const openFile = (f: PortalFileItem) => {
    const kind = fileKind(f.mimeType);
    if (kind === 'pdf') {
      portalApi.downloadPortalFile(f.id).then((blob) => {
        const url = URL.createObjectURL(blob);
        window.open(url, '_blank');
      }).catch(() => setError(t('files_list.download_error')));
      return;
    }
    if (kind === 'other') {
      downloadFile(f);
      return;
    }
    // image / audio / video → lightbox
    const idx = viewableFiles.findIndex((vf) => vf.id === f.id);
    if (idx >= 0) setViewerIdx(idx);
  };

  const downloadFile = async (f: PortalFileItem) => {
    try {
      const blob = await portalApi.downloadPortalFile(f.id);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = f.name;
      document.body.appendChild(a);
      a.click();
      a.remove();
    } catch {
      setError(t('files_list.download_error'));
    }
  };

  const openFolder = (f: PortalFolder) => {
    setPath((p) => [...p, { id: f.id, name: f.name }]);
  };
  const goTo = (index: number) => {
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

  const folders = data?.folders ?? [];
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
          {files.map((f) => {
            const isImg = fileKind(f.mimeType) === 'image';
            return (
              <li key={`f-${f.id}`} className="flex items-center gap-3 px-4 py-3 hover:bg-slate-50">
                <button type="button" onClick={() => openFile(f)} className="flex flex-1 items-center gap-3 text-left min-w-0">
                  {isImg && mediaUrls[f.id] ? (
                    <span className="relative size-9 shrink-0 overflow-hidden rounded border bg-slate-100">
                      <img src={mediaUrls[f.id]} alt={f.name} className="size-full object-cover" />
                    </span>
                  ) : (
                    <FileKindIcon mimeType={f.mimeType} />
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{f.name}</p>
                    <p className="text-xs text-slate-400">{formatSize(f.size)}</p>
                  </div>
                </button>
                <button
                  type="button"
                  onClick={() => void downloadFile(f)}
                  className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-sm text-slate-600 hover:bg-slate-100 shrink-0"
                >
                  <Download className="size-4" /> {t('files_list.download')}
                </button>
              </li>
            );
          })}
        </ul>
      ) : null}

      {viewerIdx !== null && (
        <MediaViewer
          files={viewableFiles}
          index={viewerIdx}
          urls={mediaUrls}
          onClose={() => setViewerIdx(null)}
          onPrev={() => setViewerIdx(Math.max(0, viewerIdx - 1))}
          onNext={() => setViewerIdx(Math.min(viewableFiles.length - 1, viewerIdx + 1))}
          onDownload={downloadFile}
        />
      )}
    </div>
  );
}
