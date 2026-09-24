'use client';

import { useEffect, useRef, useState, useTransition } from 'react';
import { toast } from 'sonner';
import {
  Paperclip,
  Upload,
  Trash2,
  FileText,
  FileSpreadsheet,
  Loader2,
  AlertTriangle,
} from 'lucide-react';
import { t, type Locale } from '@/lib/i18n';
import { Card, Dialog, Skeleton, secondaryBtnClass, dangerBtnClass } from '@/components/ui';
import {
  blobConfigured,
  listAttachments,
  uploadAttachment,
  deleteAttachment,
  type AttachmentRow,
  type AttachmentErrorCode,
} from '@/app/actions/attachments';
import { formatFileSize, isImageMime } from '@/lib/attachments';

/**
 * Universal attachment list + uploader for any entity (job, customer,
 * quote, invoice, review, lead). Job photos are attachments.
 *
 * File bytes are only ever served through /api/attachments/[id], which
 * re-checks tenant ownership before redirecting to the Blob URL.
 */
export default function Attachments({
  entityType,
  entityId,
  locale,
}: {
  entityType: string;
  entityId: string;
  locale: Locale;
}) {
  const [configured, setConfigured] = useState<boolean | null>(null);
  const [rows, setRows] = useState<AttachmentRow[]>([]);
  const [error, setError] = useState<AttachmentErrorCode | null>(null);
  const [uploading, startUpload] = useTransition();
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<AttachmentRow | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  function errMsg(code: AttachmentErrorCode): string {
    return t(locale, `attachments.errors.${code}`);
  }

  async function refresh() {
    const res = await listAttachments(entityType, entityId);
    if (res.ok && res.attachments) {
      setRows(res.attachments);
      setError(null);
    } else if (res.error) {
      setError(res.error);
    }
  }

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const ok = await blobConfigured();
      if (cancelled) return;
      setConfigured(ok);
      if (ok) await refresh();
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entityType, entityId]);

  function handleFileChosen() {
    const file = inputRef.current?.files?.[0];
    if (!file) return;
    setError(null);
    startUpload(async () => {
      const formData = new FormData();
      formData.set('entityType', entityType);
      formData.set('entityId', entityId);
      formData.set('file', file);
      const res = await uploadAttachment(formData);
      if (res.ok) {
        if (inputRef.current) inputRef.current.value = '';
        await refresh();
        toast.success(t(locale, 'attachments.uploaded'));
      } else if (res.error) {
        setError(res.error);
        toast.error(errMsg(res.error));
      }
    });
  }

  async function confirmDelete() {
    const row = pendingDelete;
    if (!row) return;
    setPendingDelete(null);
    setDeletingId(row.id);
    setError(null);
    const res = await deleteAttachment(row.id);
    setDeletingId(null);
    if (res.ok) {
      setRows((prev) => prev.filter((r) => r.id !== row.id));
      toast.success(t(locale, 'attachments.deleted'));
    } else if (res.error) {
      setError(res.error);
      toast.error(errMsg(res.error));
    }
  }

  function typeIcon(mimeType: string) {
    if (mimeType === 'application/pdf') return <FileText size={28} className="text-rose-500" />;
    if (mimeType === 'text/csv') return <FileSpreadsheet size={28} className="text-emerald-600" />;
    return <Paperclip size={28} className="text-zinc-400" />;
  }

  return (
    <Card className="p-5 md:p-6">
      <h2 className="text-sm font-bold text-zinc-900 mb-1 flex items-center gap-2">
        <Paperclip size={14} /> {t(locale, 'attachments.title')}
        {rows.length > 0 && (
          <span className="text-[11px] font-semibold text-zinc-400">({rows.length})</span>
        )}
      </h2>

      {configured === false && (
        <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-4">
          <p className="text-sm font-bold text-amber-900 flex items-center gap-2">
            <AlertTriangle size={14} /> {t(locale, 'attachments.blobSetupTitle')}
          </p>
          <p className="mt-2 text-xs text-amber-800 leading-relaxed">
            {t(locale, 'attachments.blobSetupBody')}
          </p>
        </div>
      )}

      {configured === true && (
        <>
          <p className="text-[11px] text-zinc-400 mt-1 mb-3">{t(locale, 'attachments.hint')}</p>

          {error && (
            <p className="text-xs font-semibold text-rose-600 bg-rose-50 border border-rose-200 rounded-xl px-3 py-2 mb-3">
              {errMsg(error)}
            </p>
          )}

          {rows.length === 0 && !uploading ? (
            <p className="text-xs text-zinc-400 py-2">{t(locale, 'attachments.noAttachments')}</p>
          ) : (
            <ul className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-4">
              {rows.map((row) => (
                <li
                  key={row.id}
                  className="relative group rounded-xl border border-zinc-200 overflow-hidden bg-zinc-50"
                >
                  {isImageMime(row.mimeType) ? (
                    <a
                      href={`/api/attachments/${row.id}`}
                      target="_blank"
                      rel="noreferrer"
                      title={t(locale, 'attachments.openLabel')}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={`/api/attachments/${row.id}`}
                        alt={row.fileName}
                        className="w-full h-28 object-cover"
                        loading="lazy"
                      />
                    </a>
                  ) : (
                    <a
                      href={`/api/attachments/${row.id}`}
                      target="_blank"
                      rel="noreferrer"
                      title={t(locale, 'attachments.openLabel')}
                      className="flex h-28 items-center justify-center bg-zinc-100"
                    >
                      {typeIcon(row.mimeType)}
                    </a>
                  )}
                  <div className="px-2 py-1.5">
                    <p className="text-[11px] font-semibold text-zinc-700 truncate" title={row.fileName}>
                      {row.fileName}
                    </p>
                    <p className="text-[10px] text-zinc-400">{formatFileSize(row.sizeBytes)}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setPendingDelete(row)}
                    disabled={deletingId === row.id}
                    aria-label={t(locale, 'attachments.deleteLabel')}
                    className="absolute top-1.5 right-1.5 rounded-lg bg-white/90 border border-zinc-200 min-w-[36px] min-h-[36px] p-2 text-zinc-500 hover:text-rose-600 hover:border-rose-200 shadow-sm disabled:opacity-50 flex items-center justify-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500/60"
                  >
                    {deletingId === row.id ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                  </button>
                </li>
              ))}
            </ul>
          )}

          <div className="flex items-center gap-2 pt-1 border-t border-zinc-100">
            <input
              ref={inputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif,application/pdf,text/csv"
              onChange={handleFileChosen}
              className="hidden"
              aria-label={t(locale, 'attachments.chooseFile')}
            />
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              disabled={uploading}
              className={secondaryBtnClass + ' disabled:opacity-50'}
            >
              {uploading ? (
                <>
                  <Loader2 size={16} className="animate-spin" /> {t(locale, 'attachments.uploading')}
                </>
              ) : (
                <>
                  <Upload size={16} /> {t(locale, 'attachments.uploadButton')}
                </>
              )}
            </button>
            <span className="text-[11px] text-zinc-400">{t(locale, 'attachments.hint')}</span>
          </div>
        </>
      )}

      {configured === null && (
        <div className="mt-3 grid grid-cols-3 gap-3" aria-hidden>
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-28 rounded-xl" />
          ))}
        </div>
      )}

      <Dialog
        open={pendingDelete !== null}
        onClose={() => setPendingDelete(null)}
        title={t(locale, 'attachments.confirmDeleteTitle')}
      >
        <p className="text-sm text-zinc-600 mb-6">
          {t(locale, 'attachments.confirmDelete').replace('{name}', pendingDelete?.fileName ?? '')}
        </p>
        <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
          <button type="button" onClick={() => setPendingDelete(null)} className={secondaryBtnClass}>
            {t(locale, 'attachments.cancel')}
          </button>
          <button type="button" onClick={confirmDelete} className={dangerBtnClass}>
            <Trash2 size={16} /> {t(locale, 'attachments.delete')}
          </button>
        </div>
      </Dialog>
    </Card>
  );
}
